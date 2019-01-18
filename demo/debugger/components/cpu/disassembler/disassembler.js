import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import { GBOpcodes } from 'gb-instructions-opcodes';

import './disassembler.css';

import VirtualList from 'preact-virtual-list';

// Long Living functions to avoid memory leaks
// https://developers.google.com/web/tools/chrome-devtools/memory-problems/#identify_js_heap_memory_leaks_with_allocation_timelines
// https://stackoverflow.com/questions/18364175/best-practices-for-reducing-garbage-collector-activity-in-javascript
let gbMemory = [];
const data = [];
let gbMemoryStart;
let gbMemorySize;
let gbMemoryEnd;
const updateTask = async () => {
  if (!gbMemoryStart) {
    gbMemoryStart = await WasmBoy._getWasmConstant('DEBUG_GAMEBOY_MEMORY_LOCATION');
    gbMemorySize = await WasmBoy._getWasmConstant('DEBUG_GAMEBOY_MEMORY_SIZE');
    gbMemoryEnd = gbMemoryStart + gbMemorySize;
  }

  await WasmBoy._runWasmExport('updateDebugGBMemory', []);
  gbMemory = await WasmBoy._getWasmMemorySection(gbMemoryStart, gbMemoryEnd);

  // Build our rows
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
        index: i,
        data: gbMemory[i],
        isCb,
        params,
        mnemonic: gbOpcode.instruction.mnemonic,
        cycles
      };

      i += params.length;
    }
  }

  // Get our program Counter
  return await WasmBoy._runWasmExport('getProgramCounter');
};

// Our unsub
let unsubLoading = false;
let unsubWasmBoy = false;

export default class Disassembler extends Component {
  constructor() {
    super();

    // 30 px rows
    this.rowHeight = 30;

    this.updateInterval = false;

    this.state.programCounter = 0;
    this.state.wasmboy = {};
    this.state.loading = {};
  }

  componentDidMount() {
    this.ready = false;
    unsubLoading = Pubx.subscribe(PUBX_KEYS.LOADING, newState => this.setState({ loading: newState }));
    unsubWasmBoy = Pubx.subscribe(PUBX_KEYS.WASMBOY, newState => this.setState({ wasmboy: newState }));

    this.updateInterval = setInterval(() => this.intervalUpdate(), 500);

    console.log(GBOpcodes);
    console.log(GBOpcodes.opcodes['0x01']);
  }

  componentWillUnmount() {
    if (unsubLoading) {
      unsubLoading();
    }
    if (unsubWasmBoy) {
      unsubWasmBoy();
    }

    clearInterval(this.updateInterval);
  }

  intervalUpdate() {
    if (!WasmBoy.isReady()) {
      return;
    }

    updateTask().then(programCounter => {
      // Check if the program counter changed, if it did, scroll to it
      if (programCounter !== this.state.programCounter) {
        const virtualListElement = this.base.querySelector('.disassembler__list__virtual');

        if (virtualListElement) {
          // Scroll to the current PC element.
          const top = this.rowHeight * programCounter;
          virtualListElement.scrollTop = top;
        }
      }

      // Have to re-render to pass data
      this.setState({
        programCounter
      });
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

    // The row height needs to be forced, or will mess up virtual list overscan
    // Height is set in CSS for performance
    // Can't set background color here, as rows are rendered ahead of time
    return (
      <div id={`disassembler-row-${row.index}`} class="disassembler__list__virtual__row">
        <div class="disassembler__list__virtual__row__actions" />
        <div class="disassembler__list__virtual__row__mnemonic">{row.mnemonic}</div>
        <div class="disassembler__list__virtual__row__cycles">{row.cycles}</div>
        <div class="disassembler__list__virtual__row__address">
          {row.index
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
    return (
      <div
        class={`disassembler 
        ${this.state.wasmboy.ready ? 'disassembler--ready' : ''} 
        ${this.state.loading.controlLoading ? 'disassembler--control-loading' : ''}`}
      >
        <h1>Disassembler</h1>

        <div class="disassembler__not-ready">
          <i>Please Load a ROM to be disassmbled.</i>
        </div>

        {/*Style tag to apply styles to whatever our current program counter is at*/}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          #disassembler-row-${this.state.programCounter} {
            background-color: rgba(13, 136, 244, 0.78);
          }
        `
          }}
        />

        <div class="disassembler__container">
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
              data={data}
              rowHeight={this.rowHeight}
              renderRow={row => this.renderRow(row)}
            />
          </div>
        </div>
      </div>
    );
  }
}
