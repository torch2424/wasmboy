import { h, Component } from 'preact';

import { GBOpcodes } from 'gb-instructions-opcodes';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import InputSubmit from '../../inputSubmit';

import VirtualList from '../../virtualList';

import { stepOpcode, runNumberOfOpcodes, runUntilBreakPoint } from '../opcode.js';

import './disassembler.css';

// Long Living functions to avoid memory leaks
// https://developers.google.com/web/tools/chrome-devtools/memory-problems/#identify_js_heap_memory_leaks_with_allocation_timelines
// https://stackoverflow.com/questions/18364175/best-practices-for-reducing-garbage-collector-activity-in-javascript
let gbMemory = [];
let gbMemoryStart;
let gbMemorySize;
let gbMemoryEnd;
let updateTask = async () => {
  if (!gbMemoryStart) {
    gbMemoryStart = await WasmBoy._getWasmConstant('DEBUG_GAMEBOY_MEMORY_LOCATION');
    gbMemorySize = await WasmBoy._getWasmConstant('DEBUG_GAMEBOY_MEMORY_SIZE');
    gbMemoryEnd = gbMemoryStart + gbMemorySize + 1;
  }

  const data = [];

  await WasmBoy._runWasmExport('updateDebugGBMemory', []);
  gbMemory = await WasmBoy._getWasmMemorySection(gbMemoryStart, gbMemoryEnd);

  // Build our rows
  let address = 0;
  for (let i = 0; i < gbMemory.length; i++) {
    const opcode = gbMemory[i];
    const gbOpcode = GBOpcodes.getOpcode(opcode);
    let gbOpcodeParams = [];
    if (gbOpcode) {
      let cycles = gbOpcode.cycles;
      if (Array.isArray(cycles)) {
        cycles = cycles.join(', ');
      }

      gbOpcodeParams = gbOpcode.params;

      // Check if our instruction has parameters
      const params = [];
      let isCb = false;
      if (opcode === 0xcb) {
        isCb = true;
        params.push(gbMemory[i + 1]);
      } else {
        if (gbOpcodeParams.includes('d8')) {
          params.push(gbMemory[i + 1]);
        } else if (gbOpcodeParams.includes('d16')) {
          params.push(gbMemory[i + 1]);
          params.push(gbMemory[i + 2]);
        }
      }

      data[i] = {
        address: address,
        data: gbMemory[i],
        isCb,
        params,
        mnemonic: gbOpcode.instruction.mnemonic,
        cycles,
        gbOpcode
      };

      address++;
      address += params.length;

      // Make sure we don't exceed our total memory
      if (address > 0xffff) {
        i = gbMemory.length;
      }
    }
  }

  // Get our program Counter
  return data;
};

// Our unsub
let unsubLoading = false;
let unsubWasmBoy = false;

export default class Disassembler extends Component {
  constructor() {
    super();

    // 30 px rows
    this.rowHeight = 30;
    // 450 px total height
    this.height = 450;

    this.updateTimeout = false;

    this.state.programCounter = 0;
    this.state.wasmboy = {};
    this.state.loading = {};

    this.data = [];
  }

  componentDidMount() {
    this.ready = false;
    unsubLoading = Pubx.subscribe(PUBX_KEYS.LOADING, newState => this.setState({ loading: newState }));
    unsubWasmBoy = Pubx.subscribe(PUBX_KEYS.WASMBOY, newState => {
      this.setState({ wasmboy: newState });
      this.update();
      setTimeout(() => this.scrollToAddress(this.state.programCounter), 250);
    });
    this.setState({
      loading: Pubx.get(PUBX_KEYS.LOADING),
      wasmboy: Pubx.get(PUBX_KEYS.WASMBOY)
    });

    const updateLoop = () => {
      this.updateTimeout = setTimeout(() => {
        if (!this.state.wasmboy.ready || !this.state.wasmboy.playing) {
          updateLoop();
          return;
        }

        this.update().then(() => {
          if (this.updateTimeout) {
            updateLoop();
          }
        });
      }, 250);
    };
    updateLoop();
  }

  componentWillUnmount() {
    if (unsubLoading) {
      unsubLoading();
    }
    if (unsubWasmBoy) {
      unsubWasmBoy();
    }

    // CLean up, and try to get the updateTask out of memory
    clearTimeout(this.updateTimeout);
    this.updateTimeout = false;
  }

  update() {
    if (!WasmBoy.isReady()) {
      return Promise.resolve();
    }

    return updateTask()
      .then(data => {
        delete this.data;
        this.data = data;
        return WasmBoy._runWasmExport('getProgramCounter');
      })
      .then(programCounter => {
        // Check if the program counter changed, if it did, scroll to it
        if (programCounter !== this.state.programCounter) {
          this.scrollToAddress(programCounter);
        }

        // Have to re-render to pass data
        this.setState({
          programCounter
        });
      });
  }

  stepOpcode() {
    stepOpcode();
    this.update();
  }

  scrollToProgramCounter() {
    this.scrollToAddress(this.state.programCounter);
  }

  scrollToAddress(address) {
    const virtualListElement = this.base.querySelector('.disassembler__list__virtual');

    if (virtualListElement) {
      // We need to find which row the address is closest to.
      let rowIndex = 0;
      for (let i = address; i > 0; i--) {
        if (this.data[i] && (this.data[i].address === address || address > this.data[i].address)) {
          rowIndex = i;
          i = 0;
        }
      }

      // Get a row offset
      let rowOffset = 2;
      if (rowIndex < rowOffset || address >= 0xffd0) {
        rowOffset = 0;
      }

      // Set the scrolltop
      let top = this.rowHeight * rowIndex;
      top -= this.rowHeight * rowOffset;
      virtualListElement.scrollTop = top;

      // Now the virtual list is weird, so this will now render the rows
      // So now let's find the element, and figure out how far out of view it is
      setTimeout(() => {
        let row = this.base.querySelector(`.disassembler__list__virtual .disassembler-row-${address}`);
        if (!row) {
          row = this.base.querySelector(`.disassembler__list__virtual > div > div > div[id]`);
        }

        if (!row) {
          return;
        }

        const listRect = virtualListElement.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();

        const difference = listRect.y - rowRect.y;
        if (difference > 0) {
          top = virtualListElement.scrollTop - difference;
          top -= this.rowHeight * rowOffset;
          virtualListElement.scrollTop = top;
        }
      });
    }
  }

  showInstructionInfo(gbOpcode) {
    // Using a stateless functional component
    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      const flags = gbOpcode.instruction.flags;

      return (
        <div class="disassembler__opcode-info">
          <h1>
            {gbOpcode.instruction.mnemonic} ({gbOpcode.value})
          </h1>
          <div>{gbOpcode.instruction.description}</div>
          <h3>Cycles</h3>
          <div>{gbOpcode.cycles}</div>
          <h3>Flags</h3>
          <div>
            <b>Z</b>: {flags[0].shorthand} {flags[0].description}
          </div>
          <div>
            <b>N</b>: {flags[1].shorthand} {flags[1].description}
          </div>
          <div>
            <b>H</b>: {flags[2].shorthand} {flags[2].description}
          </div>
          <div>
            <b>C</b>: {flags[3].shorthand} {flags[3].description}
          </div>
        </div>
      );
    });
  }

  renderRow(row) {
    let paramColumn = <div class="disassembler__list__virtual__row__param" />;
    if (row.params && row.params.length > 0) {
      let paramValue = row.params[0];
      if (row.params[1]) {
        paramValue = (row.params[1] << 8) + paramValue;
      }

      paramColumn = (
        <div class="disassembler__list__virtual__row__param">
          {paramValue
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')}
        </div>
      );
    }

    // Our classes for the row
    const classes = ['disassembler__list__virtual__row'];
    classes.push(`disassembler-row-${row.address}`);
    for (let i = 1; i <= row.params.length; i++) {
      classes.push(`disassembler-row-${row.address + i}`);
    }

    // The row height needs to be forced, or will mess up virtual list overscan
    // Height is set in CSS for performance
    // Can't set background color here, as rows are rendered ahead of time
    return (
      <div class={classes.join(' ')}>
        <div class="disassembler__list__virtual__row__actions">
          <button class="button clear" onClick={() => this.showInstructionInfo(row.gbOpcode)}>
            ℹ️
          </button>
        </div>
        <div class="disassembler__list__virtual__row__mnemonic">{row.mnemonic}</div>
        <div class="disassembler__list__virtual__row__cycles">{row.cycles}</div>
        <div class="disassembler__list__virtual__row__address">
          {row.address
            .toString(16)
            .toUpperCase()
            .padStart(4, '0')}
        </div>
        <div class="disassembler__list__virtual__row__value">
          {row.data
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')}
        </div>
        {paramColumn}
      </div>
    );
  }

  render() {
    const classes = ['disassembler'];
    if (this.state.wasmboy.ready) {
      classes.push('disassembler--ready');
    }
    if (this.state.loading.controlLoading) {
      classes.push('disassembler--control-loading');
    }

    return (
      <div class={classes.join(' ')}>
        <h1>Disassembler</h1>

        <div class="disassembler__not-ready">
          <i>Please Load a ROM to be disassmbled.</i>
        </div>

        <div class="donut" />

        {/*Style tag to apply styles to whatever our current program counter is at*/}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          .disassembler-row-${this.state.programCounter} {
            background-color: rgba(13, 136, 244, 0.78);
          }
        `
          }}
        />

        <div class="disassembler__container">
          <div class="disassembler__info">
            Program Counter: 0x
            {this.state.programCounter
              .toString(16)
              .toUpperCase()
              .padStart(2, '0')}
          </div>

          <div class="disassembler__control">
            <button onClick={() => this.stepOpcode()}>Step</button>
            <button onClick={() => this.scrollToProgramCounter()}>Scroll To Program Counter</button>
            <InputSubmit
              class="disassembler__control__jump-address"
              type="text"
              pattern="[a-fA-F\d]+"
              initalValue="100"
              label="Jump To Address: 0x"
              maxlength="4"
              onSubmit={value => this.scrollToAddress(parseInt(value, 16))}
            />
          </div>

          <div class="disassembler__header-list">
            <div class="disassembler__header-list__actions">Actions</div>
            <div class="disassembler__header-list__mnemonic">Instruction</div>
            <div class="disassembler__header-list__cycles">Cycles</div>
            <div class="disassembler__header-list__address">Address (Hex)</div>
            <div class="disassembler__header-list__value">Opcode (Hex)</div>
            <div class="disassembler__header-list__param">Constant (Hex)</div>
          </div>
          <div class="disassembler__list">
            <VirtualList
              class="disassembler__list__virtual"
              data={this.data}
              rowHeight={this.rowHeight}
              height={this.height}
              renderRow={row => this.renderRow(row)}
            />
          </div>
        </div>
      </div>
    );
  }
}
