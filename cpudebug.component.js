import { Component } from 'preact';
import { WasmBoyService } from './wasmboy.service';

export class CpuDebugComponent extends Component {

  constructor() {
		super();
		// set our state to if we are initialized or not
		this.state = {};
	}

  componentDidMount() {
    console.clear();
    console.log('cpudebug componentDidMount()');
  }

	render() {
		return (
      <div>
        <h2>CPU Debug:</h2>

        <button onclick={() => {WasmBoyService.stepOpcodes();}}>Step Opcode</button>

        <h3>Decode Speed:</h3>
        <input type="range" min="0" max="1000" value="1000" class="slider" id="cpu-debug-speed" />

        <h3>Cpu Info:</h3>
        <div id="cpu-debug-info">
        </div>
      </div>
		);
	}
}
