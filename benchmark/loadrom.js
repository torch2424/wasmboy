import { h, Component } from 'preact';
import Portal from 'preact-portal';

import '../debugger/wasmboyFilePicker/wasmboyFilePicker.css';

// Import some functions from our lib
import { fetchROMAsByteArray } from '../lib/wasmboy/fetchrom.js';

// Import our open source roms from the debugger
import { openSourceROMs, getOpenSourceROMElements } from '../debugger/wasmboyFilePicker/openSourceROMs';

export default class LoadROMSelector extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ROM: null,
      showROMs: false,
      loading: false
    };
  }

  componentDidMount() {
    this.openSourceROMElements = getOpenSourceROMElements(this.loadROMIntoCores.bind(this));
  }

  loadROMIntoCores(openSourceROM) {
    this.setState({
      ...this.state,
      ROM: openSourceROM.title,
      showROMs: false,
      loading: true
    });

    const wasmboyWasmCore = this.props.WasmBoyWasmCore;
    const wasmboyTsCore = this.props.WasmBoyTsCore;

    const loadROMTask = async () => {
      // Clear Wasm memory
      // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
      for (let i = 0; i <= wasmboyTsCore.byteMemory.length; i++) {
        wasmboyTsCore.byteMemory[i] = 0;
        wasmboyWasmCore.byteMemory[i] = 0;
      }

      // Fetch the rom
      const ROM = await fetchROMAsByteArray(openSourceROM.url);

      // Set the ROM in byte memory
      wasmboyTsCore.byteMemory.set(ROM, wasmboyTsCore.WASMBOY_GAME_BYTES_LOCATION);
      wasmboyWasmCore.byteMemory.set(ROM, wasmboyTsCore.WASMBOY_GAME_BYTES_LOCATION);

      this.props.ROMLoaded();

      this.setState({
        ...this.state,
        loading: false
      });
    };
    // Wrap in a set timeout to avoid setState weirdness
    setTimeout(() => {
      loadROMTask();
    });
  }

  render() {
    return (
      <div>
        {this.state.loading ? (
          <div class="donut" />
        ) : (
          <div>
            <button onClick={() => this.setState({ ...this.state, showROMs: true })}>Choose ROM</button>
            <div>Current ROM: {this.state.ROM}</div>
          </div>
        )}

        {/*Open Source ROMs Modal*/}
        {this.state.showROMs ? (
          <Portal into="body">
            <div class="modal is-active">
              <div class="modal-background">
                <div class="modal-content">
                  <h1>Load Open Source ROM</h1>
                  <div class="open-source-ROM-container">{this.openSourceROMElements}</div>
                </div>
                <button class="modal-close is-large" aria-label="close" onClick={() => this.setState({ ...this.state, showROMs: false })} />
              </div>
            </div>
          </Portal>
        ) : null}
      </div>
    );
  }
}
