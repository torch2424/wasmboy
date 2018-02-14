import { Component } from 'preact';
import { WasmBoy } from '../lib/wasmboy';

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
        <button onclick={() => {WasmBoy.startGame();}}>Start Game</button>
        <button onclick={() => {WasmBoy.pauseGame();}}>Pause Game</button>
        <button onclick={() => {WasmBoy.resumeGame();}}>Resume Game</button>
      </div>
    )
  }

}
