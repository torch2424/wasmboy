import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import InputSubmit from '../../inputSubmit';

import VirtualList from '../../virtualList';

import './viewer.css';

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
  }

  render() {
    return (
      <div class="memory-viewer">
        <h1>Memory Viewer</h1>
      </div>
    );
  }
}
