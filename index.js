import './style';
import { Component } from 'preact';
import { WasmBoy, WasmBoyGraphics, WasmBoyAudio } from './lib/wasmboy.js';
import { WasmBoyDebugger, WasmBoySystemControls } from './debugger/index';

export default class App extends Component {

	// Using componentDidMount to wait for the canvas element to be inserted in DOM
	componentDidMount() {
		// Get our canvas element
		const canvasElement = document.querySelector(".wasmboy__canvas-container__canvas");

		// Load our game
		WasmBoy.initialize(canvasElement)
		WasmBoy.loadGame('./games/linksawakening.gb')
		.then(() => {
			console.log('Wasmboy Ready!');
		});
	}

	render() {
		return (
			<div>
				<h1>WasmBoy</h1>
				<div className="wasmboy__canvas-container">
    			<canvas className="wasmboy__canvas-container__canvas"
            style="border: 1px solid black;"
            width="640"
            height="480">
          </canvas>
        </div>
				<WasmBoySystemControls wasmboy={WasmBoy}></WasmBoySystemControls>
				<WasmBoyDebugger wasmboy={WasmBoy} wasmboyGraphics={WasmBoyGraphics} wasmboyAudio={WasmBoyAudio}></WasmBoyDebugger>
			</div>
		);
	}
}
