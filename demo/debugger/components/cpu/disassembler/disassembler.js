import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import './disassembler.css';

import VirtualList from 'preact-virtual-list';

// Long Living functions to avoid memory leaks
// https://developers.google.com/web/tools/chrome-devtools/memory-problems/#identify_js_heap_memory_leaks_with_allocation_timelines
// https://stackoverflow.com/questions/18364175/best-practices-for-reducing-garbage-collector-activity-in-javascript
const updateTask = async () => {
  const gbMemoryStart = await WasmBoy._getWasmConstant('DEBUG_GAMEBOY_MEMORY_LOCATION');
  const gbMemorySize = await WasmBoy._getWasmConstant('DEBUG_GAMEBOY_MEMORY_SIZE');
  const gbMemoryEnd = gbMemoryStart + gbMemorySize;
  await WasmBoy._runWasmExport('updateDebugGBMemory', []);
  return await WasmBoy._getWasmMemorySection(gbMemoryStart, gbMemoryEnd);
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
    this.data = [];

    this.state.programCounter = 0;
    this.state.wasmboy = {};
    this.state.loading = {};
  }

  componentDidMount() {
    this.ready = false;
    unsubLoading = Pubx.subscribe(PUBX_KEYS.LOADING, newState => this.setState({ loading: newState }));
    unsubWasmBoy = Pubx.subscribe(PUBX_KEYS.WASMBOY, newState => this.setState({ wasmboy: newState }));

    this.updateInterval = setInterval(() => this.intervalUpdate(), 500);
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

    updateTask()
      .then(gbMemory => {
        // Build our rows
        for (let i = 0; i < gbMemory.length; i++) {
          this.data[i] = {
            index: i,
            data: gbMemory[i]
          };
        }

        // Get our program Counter
        return WasmBoy._runWasmExport('getProgramCounter');

        // Have to re-render to pass data
        this.setState({});
      })
      .then(programCounter => {
        // Check if the program counter changed, if it did, scroll to it
        if (programCounter !== this.state.programCounter) {
          const virtualElement = this.base.querySelector('.disassembler__list__virtual > div > div');

          if (virtualElement) {
            const top = this.rowHeight * programCounter;
            virtualElement.style.top = `${top}px`;
          }
        }

        // Have to re-render to pass data
        this.setState({
          programCounter
        });
      });
  }

  renderRow(row) {
    return (
      <div class="disassembler__list__virtual__row">
        <div class="disassembler__list__virtual__row__index">
          {row.index
            .toString(16)
            .toUpperCase()
            .padStart(4, '0')}
        </div>
        <div class="disassembler__list__virtual__row__data">{row.data.toString(16).toUpperCase()}</div>
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

        <div class="disassembler__list">
          <VirtualList class="disassembler__list__virtual" data={this.data} rowHeight={this.rowHeight} renderRow={this.renderRow} />
        </div>
      </div>
    );
  }
}
