import { h, Component } from 'preact';

import { GBOpcodes } from 'gb-instructions-opcodes';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import InputSubmit from '../../inputSubmit';

import VirtualList from '../../virtualList';

import { virtualListWidgetScrollToAddress } from '../../virtualListWidget';

import { stepOpcode, runNumberOfOpcodes } from '../opcode.js';

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
    gbMemoryEnd = gbMemoryStart + gbMemorySize;
  }

  const data = [];

  await WasmBoy._runWasmExport('updateDebugGBMemory');
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

  // Free up gbMemory
  gbMemory = [];

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
    this.state.breakpoint = -1;
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
        if (!this.state.running && (!this.state.wasmboy.ready || !this.state.wasmboy.playing)) {
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
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Stepped Opcode! 😄');
  }

  runNumberOfOpcodes(value) {
    if (!WasmBoy.isReady()) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please load a ROM. 💾');
      return;
    }

    const numberOfOpcodes = value;

    runNumberOfOpcodes(numberOfOpcodes);

    if (!numberOfOpcodes || numberOfOpcodes < 1) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please enter a valid value. 😄');
      return;
    }

    this.setState({
      running: true
    });

    const runOpcodesPromise = runNumberOfOpcodes(numberOfOpcodes);
    runOpcodesPromise.then(() => {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification(`Ran ${numberOfOpcodes} opcodes! 😄`);
      this.update();
      this.setState({
        running: false
      });
    });
    Pubx.get(PUBX_KEYS.LOADING).addControlPromise(runOpcodesPromise);
  }

  async toggleBreakpoint(address) {
    if (this.state.breakpoint === address) {
      await WasmBoy._runWasmExport('resetProgramCounterBreakpoint');
      this.setState({
        breakpoint: -1
      });
    } else {
      await WasmBoy._runWasmExport('setProgramCounterBreakpoint', [address]);
      this.setState({
        breakpoint: address
      });
    }
  }

  scrollToProgramCounter() {
    this.scrollToAddress(this.state.programCounter);
  }

  scrollToBreakpoint() {
    if (this.state.breakpoint >= 0) {
      this.scrollToAddress(this.state.breakpoint);
    }
  }

  scrollToAddress(address) {
    virtualListWidgetScrollToAddress(
      address, // address,
      this.data, // data
      this.base, // Base
      this.rowHeight, // rowHeight
      'disassembler' // classRowNumberPrefix
    );
  }

  showInstructionInfo(gbOpcode) {
    // Using a stateless functional component
    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      const flags = gbOpcode.instruction.flags;

      return (
        <div class="virtual-list-widget__opcode-info">
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
    let paramColumn = <div class="virtual-list-widget__list__virtual__row__hex virtual-list-widget__list-cell" />;
    if (row.params && row.params.length > 0) {
      let paramValue = row.params[0];
      if (row.params[1]) {
        paramValue = (row.params[1] << 8) + paramValue;
      }

      paramColumn = (
        <div class="virtual-list-widget__list__virtual__row__hex virtual-list-widget__list-cell">
          {paramValue
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')}
        </div>
      );
    }

    // Our classes for the row
    const classes = ['virtual-list-widget__list__virtual__row'];
    classes.push(`disassembler-row-${row.address}`);
    for (let i = 1; i <= row.params.length; i++) {
      classes.push(`disassembler-row-${row.address + i}`);
    }

    // The row height needs to be forced, or will mess up virtual list overscan
    // Height is set in CSS for performance
    // Can't set background color here, as rows are rendered ahead of time
    return (
      <div class={classes.join(' ')}>
        <div class="disassembler__list__virtual__row__actions virtual-list-widget__list__virtual__row__button-row virtual-list-widget__list-cell">
          <button class="remove-default-button" onClick={() => this.toggleBreakpoint(row.address)}>
            {this.state.breakpoint === row.address ? <div>🔴</div> : <div>⚪</div>}
          </button>
          <button class="remove-default-button" onClick={() => this.showInstructionInfo(row.gbOpcode)}>
            <div>ℹ️</div>
          </button>
        </div>
        <div class="disassembler__list__virtual__row__mnemonic virtual-list-widget__list-cell">{row.mnemonic}</div>
        <div class="disassembler__list__virtual__row__cycles virtual-list-widget__list-cell">{row.cycles}</div>
        <div class="virtual-list-widget__list__virtual__row__hex virtual-list-widget__list-cell">
          {row.address
            .toString(16)
            .toUpperCase()
            .padStart(4, '0')}
        </div>
        <div class="virtual-list-widget__list__virtual__row__hex virtual-list-widget__list-cell">
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
    const classes = ['virtual-list-widget'];
    if (this.state.wasmboy.ready) {
      classes.push('virtual-list-widget--ready');
    }
    if (this.state.loading.controlLoading) {
      classes.push('virtual-list-widget--control-loading');
    }
    if (this.state.running) {
      classes.push('virtual-list-widget--running');
    }

    return (
      <div class={classes.join(' ')}>
        <h1>Disassembler</h1>

        <div>
          <i>ROMs will not autoplay while this widget is open.</i>
        </div>

        <div class="virtual-list-widget__not-ready">
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

        <div class="disassembler__container virtual-list-widget__container">
          <div class="virtual-list-widget__info">
            <div>
              Program Counter: 0x
              {this.state.programCounter
                .toString(16)
                .toUpperCase()
                .padStart(2, '0')}
            </div>
            {this.state.breakpoint >= 0 ? (
              <div>
                Breakpoint: 0x
                {this.state.breakpoint
                  .toString(16)
                  .toUpperCase()
                  .padStart(4, '0')}
              </div>
            ) : (
              ''
            )}
          </div>

          <div class="virtual-list-widget__control">
            <button onClick={() => this.stepOpcode()}>Step</button>
            <button onClick={() => this.scrollToProgramCounter()}>Scroll To Program Counter</button>
            {this.state.breakpoint >= 0 ? <button onClick={() => this.scrollToBreakpoint()}>Scroll To Breakpoint</button> : ''}
            <InputSubmit
              class="virtual-list-widget__control__jump-address"
              type="text"
              pattern="[a-fA-F\d]+"
              initialValue="100"
              label="Jump To Address: 0x"
              buttonText="Jump"
              maxlength="4"
              onSubmit={value => this.scrollToAddress(parseInt(value, 16))}
            />
            <InputSubmit
              class="virtual-list-widget__control__run-opcodes"
              type="number"
              initialValue="100"
              label="Run Number of Opcodes:"
              buttonText="Run"
              min="1"
              onSubmit={value => this.runNumberOfOpcodes(value)}
            />
          </div>

          <div class="disassembler__header-list virtual-list-widget__header-list">
            <div class="disassembler__header-list__actions virtual-list-widget__list-cell">Actions</div>
            <div class="disassembler__header-list__mnemonic virtual-list-widget__list-cell">Instruction</div>
            <div class="disassembler__header-list__cycles virtual-list-widget__list-cell">Cycles</div>
            <div class="virtual-list-widget__header-list__hex virtual-list-widget__list-cell">Address (Hex)</div>
            <div class="virtual-list-widget__header-list__hex virtual-list-widget__list-cell">Opcode (Hex)</div>
            <div class="virtual-list-widget__header-list__hex virtual-list-widget__list-cell">Constant (Hex)</div>
          </div>
          <div class="disassembler__list virtual-list-widget__list">
            <VirtualList
              class="virtual-list-widget__list__virtual"
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
