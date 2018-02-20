import './style';
import { Component } from 'preact';
import { WasmBoy } from './lib/index';
import { WasmBoyDebugger, WasmBoySystemControls } from './debugger/index';

export default class App extends Component {

	// Using componentDidMount to wait for the canvas element to be inserted in DOM
	componentDidMount() {
		// Get our canvas element
		const canvasElement = document.querySelector(".wasmboy__canvas-container__canvas");
		// Load our game
		WasmBoy.initialize(canvasElement, '../dist/wasm/index.untouched.wasm').then(() => {
			WasmBoy.loadGame('mbc1/megaman2.gb')
	    .then(() => {
	      console.log('Wasmboy Ready!');
				// TODO: Remove this debug code
				// WasmBoy.startGame();
	    });
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
				<div id="audio-wave"></div>
				<WasmBoySystemControls></WasmBoySystemControls>
				<WasmBoyDebugger></WasmBoyDebugger>
			</div>
		);
	}
}
