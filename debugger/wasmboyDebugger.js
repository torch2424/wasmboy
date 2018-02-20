import { Component } from 'preact';
import { WasmBoy } from '../lib/wasmboy';
import { NumberBaseTable } from './numberBaseTable';

export class WasmBoyDebugger extends Component {

  constructor() {
		super();
		// set our state to if we are initialized or not
		this.state = {
      cpu: {},
      ppu: {},
      timers: {},
      interrupts: {}
    };
	}

  stepOpcode(skipDebugOutput) {
    const numberOfCycles = WasmBoy.wasmInstance.exports.emulationStep();

    if(numberOfCycles <= 0) {
      console.error('Opcode not recognized! Check wasm logs.');
      this.updateDebugInfo();
      throw new Error();
    }

    if(skipDebugOutput) {
      return;
    }
    WasmBoy.render();
    this.updateDebugInfo();
  }

  runNumberOfOpcodes(numberOfOpcodes, stopAtOpcode, stopOpcodeShouldHaveValue) {
    // Keep stepping until highest opcode increases
    let opcodesToRun = 2000;
    if(numberOfOpcodes) {
      opcodesToRun = numberOfOpcodes
    }
    for(let i = 0; i < opcodesToRun; i++) {
      this.stepOpcode(true);
      if(stopAtOpcode && stopAtOpcode === WasmBoy.wasmInstance.exports.getProgramCounter()) {
        if(!stopOpcodeShouldHaveValue ||
          stopOpcodeShouldHaveValue === WasmBoy.wasmByteMemory[WasmBoy.wasmInstance.exports.getProgramCounter()]) {
            i = opcodesToRun;
          }
      }
    }
    WasmBoy.render();
    this.updateDebugInfo();
  }

  breakPoint(skipInitialStep) {
    // Set our opcode breakpoint
    const breakPoint = 0x60;

    if(!skipInitialStep) {
      this.runNumberOfOpcodes(1, breakPoint);
    }

    if(WasmBoy.wasmInstance.exports.getProgramCounter() !== breakPoint) {
      requestAnimationFrame(() => {
        this.runNumberOfOpcodes(2000, breakPoint, 0x34);
        this.breakPoint(true);
      });
    } else {
        WasmBoy.render();
        requestAnimationFrame(() => {
          this.updateDebugInfo();
          console.log('Reached Breakpoint, that satisfies test inside runNumberOfOpcodes');
        });
    }
  }

  updateDebugInfo() {

    // Log our memory
    console.log(`WasmBoy Memory`, WasmBoy.wasmByteMemory);

    // Create our new state object
    const state = {
      cpu: {},
      ppu: {},
      timers: {},
      interrupts: {}
    };

    // Update CPU State
    state.cpu['Program Counter (PC)'] = WasmBoy.wasmInstance.exports.getProgramCounter();
    state.cpu['Opcode at PC'] = WasmBoy.wasmByteMemory[WasmBoy.wasmInstance.exports.getProgramCounter() + 0x018000];
    state.cpu['Previous Opcode'] = WasmBoy.wasmInstance.exports.getPreviousOpcode();
    state.cpu['Stack Pointer'] = WasmBoy.wasmInstance.exports.getStackPointer();
    state.cpu['Register A'] = WasmBoy.wasmInstance.exports.getRegisterA();
    state.cpu['Register F'] = WasmBoy.wasmInstance.exports.getRegisterF();
    state.cpu['Register B'] = WasmBoy.wasmInstance.exports.getRegisterB();
    state.cpu['Register C'] = WasmBoy.wasmInstance.exports.getRegisterC();
    state.cpu['Register D'] = WasmBoy.wasmInstance.exports.getRegisterD();
    state.cpu['Register E'] = WasmBoy.wasmInstance.exports.getRegisterE();
    state.cpu['Register H'] = WasmBoy.wasmInstance.exports.getRegisterH();
    state.cpu['Register L'] = WasmBoy.wasmInstance.exports.getRegisterL();
    state.cpu = Object.assign({}, state.cpu);

    // Update PPU State
    state.ppu['Scanline Register (LY) - 0xFF44'] = WasmBoy.wasmByteMemory[0xFF44 - 0x8000];
    state.ppu['LCD Status (STAT) - 0xFF41'] = WasmBoy.wasmByteMemory[0xFF41 - 0x8000];
    state.ppu['LCD Control (LCDC) - 0xFF40'] = WasmBoy.wasmByteMemory[0xFF40 - 0x8000];
    state.ppu['Scroll X - 0xFF43'] = WasmBoy.wasmByteMemory[0xFF43 - 0x8000];
    state.ppu['Scroll Y - 0xFF42'] = WasmBoy.wasmByteMemory[0xFF42 - 0x8000];
    state.ppu['Window X - 0xFF4B'] = WasmBoy.wasmByteMemory[0xFF4B - 0x8000];
    state.ppu['Window Y - 0xFF4A'] = WasmBoy.wasmByteMemory[0xFF4A - 0x8000];

    // Update Timers State
    state.timers['TIMA - 0xFF05'] = WasmBoy.wasmByteMemory[0xFF05 - 0x8000];
    state.timers['TMA - 0xFF06'] = WasmBoy.wasmByteMemory[0xFF06 - 0x8000];
    state.timers['TIMC/TAC - 0xFF07'] = WasmBoy.wasmByteMemory[0xFF07 - 0x8000];
    state.timers['DIV/Divider Register - 0xFF04'] = WasmBoy.wasmByteMemory[0xFF04 - 0x8000];

    // Update interrupts state
    if(WasmBoy.wasmInstance.exports.areInterruptsEnabled()) {
      state.interrupts['Interrupt Master Switch'] = 0x01;
    } else {
      state.interrupts['Interrupt Master Switch'] = 0x00;
    }
    state.interrupts['IE/Interrupt Enabled - 0xFFFF'] = WasmBoy.wasmByteMemory[0xFFFF - 0x8000];
    state.interrupts['IF/Interrupt Request - 0xFF0F'] = WasmBoy.wasmByteMemory[0xFF0F - 0x8000];

    // Clone our state, that it is immutable and will cause change detection
    this.setState(state);
  }



	render() {
		return (
      <div>
        <h2>Debugger:</h2>

        <button onclick={() => {this.updateDebugInfo()}}>Update Current Debug Info</button>

        <button onclick={() => {this.stepOpcode();}}>Step Opcode</button>

        <button onclick={() => {this.runNumberOfOpcodes();}}>Run Hardcoded number of opcodes loop</button>

        <button onclick={() => {this.breakPoint();}}>Run Until hardcoded breakpoint</button>

        <h3>Cpu Info:</h3>
        <NumberBaseTable object={this.state.cpu}></NumberBaseTable>

        <h3>PPU Info:</h3>
        <NumberBaseTable object={this.state.ppu}></NumberBaseTable>

        <h3>Timer Info:</h3>
        <NumberBaseTable object={this.state.timers}></NumberBaseTable>

        <h3>Interrupt Info:</h3>
        <NumberBaseTable object={this.state.interrupts}></NumberBaseTable>
      </div>
		);
	}
}
