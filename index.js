import './style';
import 'bulma/css/bulma.css';
import { Component } from 'preact';
import { WasmBoy, WasmBoyGraphics, WasmBoyAudio, WasmBoyController, WasmBoyMemory } from './lib/wasmboy.js';
import { WasmBoyDebugger, WasmBoySystemControls, WasmBoyOptions, WasmBoyGamepad } from './debugger/index';

// Old Perf Options
// WasmBoy.initialize(canvasElement, {
// 	frameSkip: 1,
// 	audioBatchProcessing: true,
// 	timersBatchProcessing: true,
// 	audioAccumulateSamples: true,
// 	graphicsDisableScanlineRendering: true
// });

//const defaultGamePath = './test/accuracy/testroms/blargg/cpu_instrs.gb';
const defaultGamePath = './games/linksawakening.gb';

const wasmBoyDefaultOptions = {
	isGbcEnabled: true,
	isAudioEnabled: true,
	frameSkip: 1,
	audioBatchProcessing: true,
	timersBatchProcessing: false,
	audioAccumulateSamples: true,
	graphicsBatchProcessing: false,
	graphicsDisableScanlineRendering: false,
	tileRendering: true,
	tileCaching: true,
	gameboySpeed: 1.0,
	saveStateCallback: (saveStateObject) => {
		// Function called everytime a savestate occurs
		// Used by the WasmBoySystemControls to show screenshots on save states
		saveStateObject.screenshotCanvasDataURL = WasmBoyGraphics.canvasElement.toDataURL();
		return saveStateObject;
	}
};

// Our canvas element
let canvasElement = undefined;

export default class App extends Component {

	constructor() {
		super();

		this.state = {
			showDebugger: false,
			showOptions: false
		}
	}

	// Using componentDidMount to wait for the canvas element to be inserted in DOM
	componentDidMount() {
		// Get our canvas element
		canvasElement = document.querySelector(".wasmboy__canvas-container__canvas");

		// Load our game
		WasmBoy.initialize(canvasElement, wasmBoyDefaultOptions);

		// Add our touch inputs
		// Add our touch inputs
		const dpadElement = document.getElementById('gamepadDpad');
		const startElement = document.getElementById('gamepadStart');
		const selectElement = document.getElementById('gamepadSelect');
		const aElement = document.getElementById('gamepadA');
		const bElement = document.getElementById('gamepadB');

		WasmBoyController.addTouchInput('UP', dpadElement, 'DPAD', 'UP');
		WasmBoyController.addTouchInput('RIGHT', dpadElement, 'DPAD', 'RIGHT');
		WasmBoyController.addTouchInput('DOWN', dpadElement, 'DPAD', 'DOWN');
		WasmBoyController.addTouchInput('LEFT', dpadElement, 'DPAD', 'LEFT');
		WasmBoyController.addTouchInput('A', aElement, 'BUTTON');
		WasmBoyController.addTouchInput('B', bElement, 'BUTTON');
		WasmBoyController.addTouchInput('START', startElement, 'BUTTON');
		WasmBoyController.addTouchInput('SELECT', selectElement, 'BUTTON');

		//WasmBoy.loadGame('./test/testroms/blargg/cpu_instrs.gb')
		WasmBoy.loadGame(defaultGamePath)
		.then(() => {
			console.log('Wasmboy Ready!');
		}).catch((error) => {
			console.log('Load Game Error:', error);
		});
	}

	render() {

		// Optionally render the options
		let optionsComponent = (
			<div></div>
		)
		if (this.state.showOptions) {
			optionsComponent = (
				<div className={ "wasmboy__options" }>
					<WasmBoyOptions wasmBoy={WasmBoy} defaultOptions={wasmBoyDefaultOptions}></WasmBoyOptions>
				</div>
			)
		}

		// optionally render the debugger
		let debuggerComponent = (
			<div></div>
		)
		if (this.state.showDebugger) {
			debuggerComponent = (
				<div className={ "wasmboy__debugger" }>
					<WasmBoyDebugger wasmboy={WasmBoy} wasmboyGraphics={WasmBoyGraphics} wasmboyAudio={WasmBoyAudio}></WasmBoyDebugger>
				</div>
			)
		}

		return (
			<div>
				<h1>WasmBoy Demo</h1>
				<div style="text-align: center">
          <label for="showOptions">Show Options</label>
          <input
            id="showOptions"
            type="checkbox"
            checked={ this.state.showOptions }
            onChange={ () => {
								const newState = Object.assign({}, this.state);
								newState.showOptions = !newState.showOptions;
								this.setState(newState);
							}
						} />
        </div>

				{optionsComponent}

				<div style="text-align: center">
          <label for="showDebugger">Show Debugger</label>
          <input
            id="showDebugger"
            type="checkbox"
            checked={ this.state.showDebugger }
            onChange={ () => {
								const newState = Object.assign({}, this.state);
								newState.showDebugger = !newState.showDebugger;
								this.setState(newState);
							}
						} />
        </div>

				{debuggerComponent}

				<div class="wasmboy__systemControls">
					<WasmBoySystemControls wasmboy={WasmBoy} wasmboyMemory={WasmBoyMemory}></WasmBoySystemControls>
				</div>
				<div className="wasmboy__canvas-container">
    			<canvas className="wasmboy__canvas-container__canvas">
          </canvas>
        </div>

				<WasmBoyGamepad></WasmBoyGamepad>

			</div>
		);
	}
}
