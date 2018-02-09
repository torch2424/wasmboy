import './style';
import { Component } from 'preact';
import { WasmBoy, WasmBoyDebugger, WasmBoySystemControls } from './wasmboy/index.js';

export default class App extends Component {

	// Using componentDidMount to wait for the canvas element to be inserted in DOM
	componentDidMount() {
		// Get our canvas element
		const canvasElement = document.querySelector(".wasmboy__canvas-container__canvas");
		// Load our game
		WasmBoy.loadGame(canvasElement, 'blarggsCpu/01-special.gb')
    .then(() => {
      console.log('Wasmboy Ready!');
			// TODO: Remove this degub code
			//WasmBoy.startGame();
    });
	}

	render() {
		return (
			<div>
				<h1>WasmBoy</h1>
				<div class="wasmboy__canvas-container">
    			<canvas class="wasmboy__canvas-container__canvas"
            style="border: 1px solid black;"
            width="640"
            height="480">
          </canvas>
        </div>
				<WasmBoySystemControls></WasmBoySystemControls>
				<WasmBoyDebugger></WasmBoyDebugger>
			</div>
		);
	}
}
