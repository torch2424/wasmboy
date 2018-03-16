import { Component } from 'preact';

export class WasmBoySystemControls extends Component {

  constructor(props) {
		super(props);
		// set our state to if we are initialized or not
		this.state = {
    };

    let fpsCounter;
    fpsCounter = () => {
      this.setState({
        fps: props.wasmboy.getFps()
      });
      setTimeout(() => {
        fpsCounter();
      }, 500);
    }
    fpsCounter();
	}

  // Allow passing a file
  // https://gist.github.com/AshikNesin/e44b1950f6a24cfcd85330ffc1713513
  loadGame(wasmboy, event) {
    wasmboy.loadGame(event.target.files[0])
    .then(() => {
      console.log('wasmboy Ready!');
    });
  }

  render(props) {
    return (
      <div className="system-controls">
        <input type="file" onChange={(event) => {this.loadGame(props.wasmboy, event)}}></input>
        <button onclick={() => {props.wasmboy.startGame();}}>Start Game</button>
        <button onclick={() => {props.wasmboy.pauseGame();}}>Pause Game</button>
        <button onclick={() => {props.wasmboy.resumeGame();}}>Resume Game</button>
        <button onclick={() => {props.wasmboy.saveState();}}>Save State</button>
        <button onclick={() => {props.wasmboy.loadState();}}>Load State</button>
        <div>Gameboy FPS: {this.state.fps}</div>
      </div>
    )
  }

}
