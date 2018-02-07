import { Component } from 'preact';
import { WasmBoy } from '../wasmboy';

export class WasmBoySystemControls extends Component {

  constructor() {
		super();
		// set our state to if we are initialized or not
		this.state = {
    };
	}

  render() {
    return (
      <div className="system-controls">
        <button onclick={() => {WasmBoy.startGame();}}>Start/Resume Game</button>
        <button onclick={() => {WasmBoy.pauseGame();}}>Pause Game</button>
      </div>
    )
  }

}
