// Compoonent that contains the canvas and the actual output
// of WasmBoy

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../pubx.config';

import WasmBoy from '../../wasmboy';

import './wasmboyControls.css';

export default class WasmBoyControls extends Component {
  constructor() {
    super();

    // Exerytime WasmBoy gets updated, simply re-render
    Pubx.subscribe(PUBX_KEYS.WASMBOY, newState => this.setState(newState));
  }

  render() {
    return (
      <div class="wasmboy-controls">
        <h1>WasmBoy</h1>
        <div>WasmBoy Version: {this.state.version}</div>
        <div>WasmBoy Core Type: {this.state.core}</div>

        <h1>ROM</h1>
        <div>Loaded ROM Filename: {this.state.name}</div>

        <h1>Controls</h1>
        <div>
          <button onClick={() => WasmBoy.play()}>Play</button>
          <button onClick={() => WasmBoy.pause()}>Pause</button>
        </div>
      </div>
    );
  }
}
