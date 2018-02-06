import { Component } from 'preact';
import { WasmBoy } from '../wasmboy';
import { NumberBaseTable } from './numberBaseTable';

export class WasmBoyDebugger extends Component {

  constructor() {
		super();
		// set our state to if we are initialized or not
		this.state = {
      registers: {},
      ppu: {}
    };
	}

  updateDebugInfo() {

    // Create our new state object
    const state = {
      registers: {},
      ppu: {}
    };

    // Update CPU State
    state.registers['A'] = WasmBoy.wasmInstance.exports.getRegisterA();
    state.registers['F'] = WasmBoy.wasmInstance.exports.getRegisterF();
    state.registers['B'] = WasmBoy.wasmInstance.exports.getRegisterB();
    state.registers['C'] = WasmBoy.wasmInstance.exports.getRegisterC();
    state.registers['D'] = WasmBoy.wasmInstance.exports.getRegisterD();
    state.registers['E'] = WasmBoy.wasmInstance.exports.getRegisterE();
    state.registers['H'] = WasmBoy.wasmInstance.exports.getRegisterH();
    state.registers['L'] = WasmBoy.wasmInstance.exports.getRegisterL();

    // Update PPU State
    state.ppu['Scanline Register (LY) - 0xFF44'] = WasmBoy.wasmByteMemory[0xFF44];
    state.ppu['LCD Status (STAT) - 0xFF41'] = WasmBoy.wasmByteMemory[0xFF41];
    state.ppu['LCD Control (LCDC) - 0xFF40'] = WasmBoy.wasmByteMemory[0xFF40];
    state.ppu['Scroll X - 0xFF43'] = WasmBoy.wasmByteMemory[0xFF43];
    state.ppu['Scroll Y - 0xFF42'] = WasmBoy.wasmByteMemory[0xFF42];
    state.ppu['Window X - 0xFF4B'] = WasmBoy.wasmByteMemory[0xFF4B];
    state.ppu['Window Y - 0xFF4A'] = WasmBoy.wasmByteMemory[0xFF4A];

    // Clone our state, that it is immutable and will cause change detection
    this.setState(state);
  }



	render() {
		return (
      <div>
        <h2>Debugger:</h2>

        <button onclick={() => {this.updateDebugInfo()}}>Update Current Debug Info</button>

        <button onclick={() => {WasmBoy.stepOpcodes();}}>Step Opcode</button>

        <button onclick={() => {WasmBoy.runNumberOfOpcodes();}}>Run Hardcoded number of opcodes loop</button>

        <button onclick={() => {WasmBoy.breakPoint();}}>Run Until hardcoded breakpoint</button>

        <h3>Cpu Info:</h3>
        <NumberBaseTable object={this.state.registers}></NumberBaseTable>

        <h3>PPU Info:</h3>
        <NumberBaseTable object={this.state.ppu}></NumberBaseTable>
      </div>
		);
	}
}
