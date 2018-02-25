import { Component } from 'preact';
import { WasmBoy } from '../lib/wasmboy';

export class WasmBoySystemControls extends Component {

  constructor() {
		super();
		// set our state to if we are initialized or not
		this.state = {
    };
	}

  // Allow passing a file
  // https://gist.github.com/AshikNesin/e44b1950f6a24cfcd85330ffc1713513
  loadGame(event) {
    WasmBoy.loadGame(event.target.files[0])
    .then(() => {
      console.log('WasmBoy Ready!');
    });
  }

  render() {
    return (
      <div className="system-controls">
        <input type="file" onChange={(event) => {this.loadGame(event)}}></input>
        <button onclick={() => {WasmBoy.startGame();}}>Start Game</button>
        <button onclick={() => {WasmBoy.pauseGame();}}>Pause Game</button>
        <button onclick={() => {WasmBoy.resumeGame();}}>Resume Game</button>
      </div>
    )
  }

}
