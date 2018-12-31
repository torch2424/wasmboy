// Component that represents the information
// About what is currently playing, and it's performance

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import './wasmboyInfo.css';

export default class WasmBoyInfo extends Component {
  constructor() {
    super();

    // Exerytime WasmBoy gets updated, simply re-render
    Pubx.subscribe(PUBX_KEYS.WASMBOY, newState => this.setState(newState));

    this.state = {
      cartridge: {}
    };
  }

  componentDidMount() {
    Pubx.get(PUBX_KEYS.WASMBOY).update();

    const callback = () => {
      const fpsElement = document.getElementById('wasmboy-info__fps');
      if (fpsElement) {
        fpsElement.textContent = `WasmBoy Current FPS: ${WasmBoy.getFPS()}`;
      }
    };
    setInterval(callback, 1000);
  }

  render() {
    return (
      <div class="wasmboy-info">
        <h1>WasmBoy</h1>
        <div>WasmBoy Version: {this.state.version}</div>
        <div>WasmBoy Core Type: {this.state.core}</div>
        <div id="wasmboy-info__fps" />
        <button onClick={() => console.log('WasmBoy', WasmBoy)}>Log WasmBoy Object to JS Console</button>

        <h1>ROM</h1>
        <div>Loaded ROM Filename: {this.state.filename}</div>
        <h3>
          <a target="_blank" href="http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header">
            Cartridge Header
          </a>
        </h3>
        <div>Title: {this.state.cartridge.titleAsString}</div>
        <div>Manufacturer Code: {JSON.stringify(this.state.cartridge.manufacturerCode)}</div>
        <div>CGB Flag: {JSON.stringify(this.state.cartridge.CGBFlag)}</div>
        <div>New Licensee Code: {JSON.stringify(this.state.cartridge.newLicenseeCode)}</div>
        <div>Cartridge Type: {JSON.stringify(this.state.cartridge.cartridgeType)}</div>
        <div>ROM Size: {JSON.stringify(this.state.cartridge.ROMSize)}</div>
        <div>RAM Size: {JSON.stringify(this.state.cartridge.RAMSize)}</div>
        <div>Destination Code: {JSON.stringify(this.state.cartridge.destinationCode)}</div>
        <div>Old Licensee Code: {JSON.stringify(this.state.cartridge.oldLicenseeCode)}</div>
        <div>Mask ROM Version number: {JSON.stringify(this.state.cartridge.maskROMVersionNumber)}</div>
        <div>Header Checksum: {JSON.stringify(this.state.cartridge.headerChecksum)}</div>
        <div>Global Checksum: {JSON.stringify(this.state.cartridge.globalChecksum)}</div>

        <button onClick={() => WasmBoy._getCartridgeInfo().then(info => console.log('Cartridge Info', info))}>
          Log Cartridge Info Object to JS Console
        </button>
      </div>
    );
  }
}
