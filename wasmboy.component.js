// Simply a ES6 version of the Assembly script game of life demo
// https://github.com/AssemblyScript/assemblyscript/tree/master/examples/game-of-life
import { Component } from 'preact';
import fetch from 'unfetch'
import Promise from 'promise-polyfill';

import { Wasmboy } from './wasmboy.service';
import { CpuDebugComponent } from './cpudebug.component';

export class WasmboyComponent extends Component {

  constructor() {
		super();
		// set our state to if we are initialized or not
		this.state = {
			initialized: false,
      wasmBoy: undefined
		};
	}

  componentDidMount() {
    console.clear();
    console.log('Playground componentDidMount()');
    this.initialize();
  }

  initialize() {
    // Some hack-y code to test loading the wasm module
    if(this.state.initialized) return;
    this.state.initialized = true;

    this.state.wasmBoy = new Wasmboy();
    this.state.wasmBoy
    .loadGame('pokemonred.gb')
    .then(() => {
      this.state.wasmBoy.startGame();
    });
  }

	render() {
		return (
      <div>
        <div class="canvas-container">
    			<canvas id="canvas"
            style="border: 1px solid black;"
            width="640"
            height="480">
          </canvas>
        </div>
        <CpuDebugComponent></CpuDebugComponent>
      </div>
		);
	}
}
