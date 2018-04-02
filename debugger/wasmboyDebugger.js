import { Component } from 'preact';
import { NumberBaseTable } from './numberBaseTable';

// Function to get a value in gameboy memory, to wasmboy memory
const getWasmBoyOffsetFromGameBoyOffset = (gameboyOffset, wasmboy) => {
  return (gameboyOffset - 0x8000) + wasmboy.wasmInstance.exports.gameBoyInternalMemoryLocation();
}

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

  stepOpcode(wasmboy, wasmboyGraphics, skipDebugOutput) {
    const numberOfCycles = wasmboy.wasmInstance.exports.emulationStep();

    if(numberOfCycles <= 0) {
      console.error('Opcode not recognized! Check wasm logs.');
      this.updateDebugInfo(wasmboy);
      throw new Error();
    }

    if(skipDebugOutput) {
      return;
    }
    wasmboyGraphics.renderFrame();
    this.updateDebugInfo(wasmboy);
  }

  runNumberOfOpcodes(wasmboy, wasmboyGraphics, numberOfOpcodes, stopAtOpcode, stopOpcodeShouldHaveValue, skipDebugOutput) {
    // Keep stepping until highest opcode increases
    let opcodesToRun = 2000;
    if(numberOfOpcodes) {
      opcodesToRun = numberOfOpcodes
    }
    for(let i = 0; i < opcodesToRun; i++) {
      this.stepOpcode(wasmboy, wasmboyGraphics, true);
      if(stopAtOpcode && stopAtOpcode === wasmboy.wasmInstance.exports.getProgramCounter()) {
        if(!stopOpcodeShouldHaveValue ||
          stopOpcodeShouldHaveValue === wasmboy.wasmByteMemory[wasmboy.wasmInstance.exports.getProgramCounter()]) {
            i = opcodesToRun;
          }
      }
    }

    if(skipDebugOutput) {
      return;
    }
    wasmboyGraphics.renderFrame();
    this.updateDebugInfo(wasmboy);
  }

  breakPoint(wasmboy, wasmboyGraphics, skipInitialStep) {
    // Set our opcode breakpoint
    const breakPoint = 0x7C33;

    if(!skipInitialStep) {
      this.runNumberOfOpcodes(wasmboy, wasmboyGraphics, 1, breakPoint);
    }

    if(wasmboy.wasmInstance.exports.getProgramCounter() !== breakPoint) {
      requestAnimationFrame(() => {
        this.runNumberOfOpcodes(wasmboy, wasmboyGraphics, 200, breakPoint, false, true);
        this.breakPoint(wasmboy, wasmboyGraphics, true);
      });
    } else {
        wasmboyGraphics.renderFrame();
        requestAnimationFrame(() => {
          this.updateDebugInfo(wasmboy);
          console.log('Reached Breakpoint, that satisfies test inside runNumberOfOpcodes');
        });
    }
  }

  updateDebugInfo(wasmboy) {

    // Log our memory
    console.log(`[WasmBoy Debugger] Memory:`, wasmboy.wasmByteMemory);

    // Create our new state object
    const state = {
      cpu: {},
      ppu: {},
      timers: {},
      interrupts: {}
    };

    // Update CPU State
    state.cpu['Program Counter (PC)'] = wasmboy.wasmInstance.exports.getProgramCounter();
    state.cpu['Opcode at PC'] = wasmboy.wasmInstance.exports.getOpcodeAtProgramCounter();
    state.cpu['Stack Pointer'] = wasmboy.wasmInstance.exports.getStackPointer();
    state.cpu['Register A'] = wasmboy.wasmInstance.exports.getRegisterA();
    state.cpu['Register F'] = wasmboy.wasmInstance.exports.getRegisterF();
    state.cpu['Register B'] = wasmboy.wasmInstance.exports.getRegisterB();
    state.cpu['Register C'] = wasmboy.wasmInstance.exports.getRegisterC();
    state.cpu['Register D'] = wasmboy.wasmInstance.exports.getRegisterD();
    state.cpu['Register E'] = wasmboy.wasmInstance.exports.getRegisterE();
    state.cpu['Register H'] = wasmboy.wasmInstance.exports.getRegisterH();
    state.cpu['Register L'] = wasmboy.wasmInstance.exports.getRegisterL();
    state.cpu = Object.assign({}, state.cpu);

    // Update PPU State
    state.ppu['Scanline Register (LY) - 0xFF44'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF44, wasmboy)];
    state.ppu['LCD Status (STAT) - 0xFF41'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF41, wasmboy)];
    state.ppu['LCD Control (LCDC) - 0xFF40'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF40, wasmboy)];
    state.ppu['Scroll X - 0xFF43'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF43, wasmboy)];
    state.ppu['Scroll Y - 0xFF42'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF42, wasmboy)];
    state.ppu['Window X - 0xFF4B'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF4B, wasmboy)];
    state.ppu['Window Y - 0xFF4A'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF4A, wasmboy)];

    // Update Timers State
    state.timers['TIMA - 0xFF05'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF05, wasmboy)];
    state.timers['TMA - 0xFF06'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF06, wasmboy)];
    state.timers['TIMC/TAC - 0xFF07'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF07, wasmboy)];
    state.timers['DIV/Divider Register - 0xFF04'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF04, wasmboy)];

    // Update interrupts state
    if(wasmboy.wasmInstance.exports.areInterruptsEnabled()) {
      state.interrupts['Interrupt Master Switch'] = 0x01;
    } else {
      state.interrupts['Interrupt Master Switch'] = 0x00;
    }
    state.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];
    state.interrupts['IF/Interrupt Request - 0xFF0F'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF0F, wasmboy)];

    // Clone our state, that it is immutable and will cause change detection
    this.setState(state);
  }



	render(props) {
		return (
      <div>
        <h2>Debugger:</h2>

        <button onclick={() => {this.updateDebugInfo(props.wasmboy)}}>Update Current Debug Info</button>

        <button onclick={() => {this.stepOpcode(props.wasmboy, props.wasmboyGraphics);}}>Step Opcode</button>

        <button onclick={() => {this.runNumberOfOpcodes(props.wasmboy, props.wasmboyGraphics);}}>Run Hardcoded number of opcodes loop</button>

        <button onclick={() => {this.breakPoint(props.wasmboy, props.wasmboyGraphics);}}>Run Until hardcoded breakpoint</button>

        <button onclick={() => {props.wasmboyAudio.debugSaveCurrentAudioBufferToWav()}}>Save Current Audio buffer to wav</button>

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
