import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import InputSubmit from '../../inputSubmit';

import VirtualList from '../../virtualList';

import { virtualListWidgetScrollToAddress } from '../../virtualListWidget';

import './viewer.css';

let gbMemory = [];
let gbMemoryStart;
let gbMemorySize;
let gbMemoryEnd;
let updateTask = async data => {
  if (!gbMemoryStart) {
    gbMemoryStart = await WasmBoy._getWasmConstant('DEBUG_GAMEBOY_MEMORY_LOCATION');
    gbMemorySize = await WasmBoy._getWasmConstant('DEBUG_GAMEBOY_MEMORY_SIZE');
    gbMemoryEnd = gbMemoryStart + gbMemorySize;
  }

  const updateGbMemoryCore = async () => {
    await WasmBoy._runWasmExport('updateDebugGBMemory');
  };
  const updateGbMemory = async () => {
    gbMemory = await WasmBoy._getWasmMemorySection(gbMemoryStart, gbMemoryEnd);
  };

  //await WasmBoy._runWasmExport('updateDebugGBMemory');
  // gbMemory = await WasmBoy._getWasmMemorySection(gbMemoryStart, gbMemoryEnd);

  await updateGbMemoryCore();
  await updateGbMemory();

  for (let i = 0; i < gbMemory.length; i++) {
    data[i] = {
      address: i,
      value: gbMemory[i]
    };
  }

  gbMemory = [];
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

    this.state.readBreakpoint = -1;
    this.state.writeBreakpoint = -1;
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

    return updateTask(this.data).then(() => {
      // Need to re-render to pass data :p
      this.setState({});
    });
  }

  scrollToAddress(address) {
    virtualListWidgetScrollToAddress(
      address, // address,
      this.data, // data
      this.base, // Base
      this.rowHeight, // rowHeight
      'memory-viewer' // classRowNumberPrefix
    );
  }

  scrollToBreakpoint(isRead) {
    if (isRead && this.state.readBreakpoint >= 0) {
      this.scrollToAddress(this.state.readBreakpoint);
    }

    if (!isRead && this.state.writeBreakpoint >= 0) {
      this.scrollToAddress(this.state.writeBreakpoint);
    }
  }

  async toggleBreakpoint(isRead, address) {
    let breakpointKey = 'writeBreakpoint';
    if (isRead) {
      breakpointKey = 'readBreakpoint';
    }

    if (this.state[breakpointKey] === address) {
      if (isRead) {
        await WasmBoy._runWasmExport('resetReadGbMemoryBreakpoint');
      } else {
        await WasmBoy._runWasmExport('resetWriteGbMemoryBreakpoint');
      }

      const newBreakpointState = {};
      newBreakpointState[breakpointKey] = -1;
      this.setState(newBreakpointState);
    } else {
      if (isRead) {
        await WasmBoy._runWasmExport('setReadGbMemoryBreakpoint', [address]);
      } else {
        await WasmBoy._runWasmExport('setWriteGbMemoryBreakpoint', [address]);
      }

      const newBreakpointState = {};
      newBreakpointState[breakpointKey] = address;
      this.setState(newBreakpointState);
    }
  }

  renderRow(row) {
    // Our classes for the row
    const classes = ['virtual-list-widget__list__virtual__row'];
    classes.push(`memory-viewer-row-${row.address}`);

    // The row height needs to be forced, or will mess up virtual list overscan
    // Height is set in CSS for performance
    // Can't set background color here, as rows are rendered ahead of time
    return (
      <div class={classes.join(' ')}>
        <div class="memory-viewer__list__virtual__row__breakpoint virtual-list-widget__list__virtual__row__button-row virtual-list-widget__list-cell">
          <button class="remove-default-button" onClick={() => this.toggleBreakpoint(true, row.address)}>
            {this.state.readBreakpoint === row.address ? <div>R: 🔴</div> : <div>R: ⚪</div>}
          </button>
          <button class="remove-default-button" onClick={() => this.toggleBreakpoint(false, row.address)}>
            {this.state.writeBreakpoint === row.address ? <div>W: 🔴</div> : <div>W: ⚪</div>}
          </button>
        </div>
        <div class="virtual-list-widget__list__virtual__row__hex virtual-list-widget__list-cell">
          {row.address
            .toString(16)
            .toUpperCase()
            .padStart(4, '0')}
        </div>
        <div class="virtual-list-widget__list__virtual__row__hex virtual-list-widget__list-cell">
          {row.value
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')}
        </div>
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
        <h1>Memory Viewer</h1>

        <div class="virtual-list-widget__not-ready">
          <i>Please Load a ROM to view GB Memory.</i>
        </div>

        <div class="donut" />

        <div class="memory-viewer__container virtual-list-widget__container">
          <div class="virtual-list-widget__info">
            {this.state.readBreakpoint >= 0 ? (
              <div>
                Read Breakpoint: 0x
                {this.state.readBreakpoint
                  .toString(16)
                  .toUpperCase()
                  .padStart(4, '0')}
              </div>
            ) : (
              ''
            )}
            {this.state.writeBreakpoint >= 0 ? (
              <div>
                Write Breakpoint: 0x
                {this.state.writeBreakpoint
                  .toString(16)
                  .toUpperCase()
                  .padStart(4, '0')}
              </div>
            ) : (
              ''
            )}
          </div>
          <div class="virtual-list-widget__control">
            {this.state.readBreakpoint >= 0 ? <button onClick={() => this.scrollToBreakpoint(true)}>Scroll To Read Breakpoint</button> : ''}
            {this.state.writeBreakpoint >= 0 ? (
              <button onClick={() => this.scrollToBreakpoint(false)}>Scroll To Write Breakpoint</button>
            ) : (
              ''
            )}
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
          </div>

          <div class="virtual-list-widget__header-list">
            <div class="memory-viewer__header-list__breakpoint virtual-list-widget__list-cell">Breakpoint (Read/Write)</div>
            <div class="virtual-list-widget__header-list__hex virtual-list-widget__list-cell">Address (Hex)</div>
            <div class="virtual-list-widget__header-list__hex virtual-list-widget__list-cell">Value (Hex)</div>
          </div>
          <div class="virtual-list-widget__list">
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
