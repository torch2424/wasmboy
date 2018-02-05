import { Component } from 'preact';
import { WasmBoyService } from './wasmboy.service';

export class DebugComponent extends Component {

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
        <h2>Debugger:</h2>

        <button onclick={() => {WasmBoyService._debug();}}>Update Current Debug Info</button>

        <button onclick={() => {WasmBoyService.stepOpcodes();}}>Step Opcode</button>

        <button onclick={() => {WasmBoyService.runNumberOfOpcodes();}}>Run Hardcoded number of opcodes loop</button>

        <button onclick={() => {WasmBoyService.breakPoint();}}>Run Until hardcoded breakpoint</button>

        <h3>Cpu Info:</h3>
        <div id="cpu-debug-info">
        </div>

        <h3>PPU Info:</h3>
        <div id="ppu-debug-info">
        </div>
      </div>
		);
	}
}
