import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import InputSubmit from '../../inputSubmit';

import VirtualList from '../../virtualList';

import './viewer.css';

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

  for (let i = 0; i < gbMemory.length; i++) {
    data[i] = {
      address: i,
      value: gbMemory[i]
    };
  }

  return data;
};

// Our unsub
let unsubLoading = false;
let unsubWasmBoy = false;

export default class MemoryViewer extends Component {
  constructor() {
    super();

    // 30 px rows
    this.rowHeight = 30;
    // 450 px total height
    this.height = 450;

    this.updateTimeout = false;

    this.state.readBreakpoint = 0;
    this.state.writeBreakpoint = 0;
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

    return updateTask().then(data => {
      this.data = data;
    });
  }

  renderRow(row) {
    // Our classes for the row
    const classes = ['memory-viewer__list__virtual__row'];
    classes.push(`memory-viewer-row-${row.address}`);

    // The row height needs to be forced, or will mess up virtual list overscan
    // Height is set in CSS for performance
    // Can't set background color here, as rows are rendered ahead of time
    return (
      <div class={classes.join(' ')}>
        <div class="memory-viewer__list__virtual__row__actions">
          <button class="remove-default-button" onClick={() => this.setState({ breakpoint: row.address })}>
            {this.state.breakpoint === row.address ? <div>🔴</div> : <div>⚪</div>}
          </button>
          <button class="remove-default-button" onClick={() => this.showInstructionInfo(row.gbOpcode)}>
            <div>ℹ️</div>
          </button>
        </div>
        <div class="memory-viewer__list__virtual__row__address">
          {row.address
            .toString(16)
            .toUpperCase()
            .padStart(4, '0')}
        </div>
        <div class="memory-viewer__list__virtual__row__value">
          {row.value
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')}
        </div>
      </div>
    );
  }

  render() {
    const classes = ['memory-viewer'];
    if (this.state.wasmboy.ready) {
      classes.push('memory-viewer--ready');
    }
    if (this.state.loading.controlLoading) {
      classes.push('memory-viewer--control-loading');
    }
    if (this.state.running) {
      classes.push('memory-viewer--running');
    }

    return (
      <div class={classes.join(' ')}>
        <h1>Memory Viewer</h1>

        <div class="memory-viewer__not-ready">
          <i>Please Load a ROM to view GB Memory.</i>
        </div>

        <div class="donut" />

        <div class="memory-viewer__control">
          <InputSubmit
            class="memory-viewer__control__jump-address"
            type="text"
            pattern="[a-fA-F\d]+"
            initialValue="100"
            label="Jump To Address: 0x"
            buttonText="Jump"
            maxlength="4"
            onSubmit={value => this.scrollToAddress(parseInt(value, 16))}
          />
        </div>

        <div class="memory-viewer__header-list">
          <div class="memory-viewer__header-list__actions">Actions</div>
          <div class="memory-viewer__header-list__address">Address (Hex)</div>
          <div class="memory-viewer__header-list__value">Value (Hex)</div>
        </div>
        <div class="memory-viewer__list">
          <VirtualList
            class="memory-viewer__list__virtual"
            data={this.data}
            rowHeight={this.rowHeight}
            height={this.height}
            renderRow={row => this.renderRow(row)}
          />
        </div>
      </div>
    );
  }
}
