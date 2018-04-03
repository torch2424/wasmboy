import { Component } from 'preact';
import { NumberBaseTable } from './numberBaseTable';

// Function to get a value in gameboy memory, to wasmboy memory
const getWasmBoyOffsetFromGameBoyOffset = (gameboyOffset, wasmboy) => {
  // 0x6000 For the Extra WRAM Banks
  // TODO Make this use the wasm memory map version
  let wasmAddress = (gameboyOffset - 0x8000) + wasmboy.wasmInstance.exports.gameBoyInternalMemoryLocation + 0x6000;
  return wasmAddress;
}

let autoUpdateValueTableId = false;

export class WasmBoyDebugger extends Component {

  constructor() {
		super();
		// set our state to if we are initialized or not
		this.state = {
      showValueTable: false,
      autoUpdateValueTable: false,
      breakPoint: "48",
      valueTable: {
        cpu: {},
        ppu: {},
        apu: {},
        timers: {},
        interrupts: {}
      }
    };
	}

  // Function to simply flip a boolean on the state
  flipShowStatus(stateKey, wasmboy) {
    const newState = Object.assign({}, this.state);
    newState[stateKey] = !newState[stateKey];
    this.setState(newState);

    // Fireoff a a raf for updating the value table
    if (stateKey === 'autoUpdateValueTable') {
      if(this.state.autoUpdateValueTable) {
        const autoUpdateValueTable = () => {
          this.updateValueTable(wasmboy);
          if(autoUpdateValueTableId) {
            autoUpdateValueTableId = requestAnimationFrame(() => {
              autoUpdateValueTable();
            });
          }
        }
        autoUpdateValueTableId = true;
        autoUpdateValueTable();
      } else {
        cancelAnimationFrame(autoUpdateValueTable);
        autoUpdateValueTableId = false;
      }
    }
  }

  // Function to return the hidden class deoending oin a boolean in state
  getStateClass(stateKey) {
    return this.state[stateKey] ? '' : 'hide';
  }

  // Function to runa  single opcode
  stepOpcode(wasmboy, wasmboyGraphics, skipDebugOutput) {

    wasmboy.pauseGame().then(() => {
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
      this.updateValueTable(wasmboy);
    });
  }

  // Function to run a specifed number of opcodes for faster stepping
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
    this.updateValueTable(wasmboy);
  }

  // Function to keep running opcodes untila breakpoint is reached
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
        this.updateValueTable(wasmboy);
        requestAnimationFrame(() => {
          console.log('Reached Breakpoint, that satisfies test inside runNumberOfOpcodes');
        });
    }
  }

  logWasmBoyMemory(wasmBoy) {
    console.log(`[WasmBoy Debugger] Memory:`, wasmBoy.wasmByteMemory);
  }

  updateValueTable(wasmboy) {

    // Create our new valueTable object
    const valueTable = {
      cpu: {},
      ppu: {},
      apu: {},
      timers: {},
      interrupts: {}
    };

    // Update CPU valueTable
    valueTable.cpu['Program Counter (PC)'] = wasmboy.wasmInstance.exports.getProgramCounter();
    valueTable.cpu['Opcode at PC'] = wasmboy.wasmInstance.exports.getOpcodeAtProgramCounter();
    valueTable.cpu['Stack Pointer'] = wasmboy.wasmInstance.exports.getStackPointer();
    valueTable.cpu['Register A'] = wasmboy.wasmInstance.exports.getRegisterA();
    valueTable.cpu['Register F'] = wasmboy.wasmInstance.exports.getRegisterF();
    valueTable.cpu['Register B'] = wasmboy.wasmInstance.exports.getRegisterB();
    valueTable.cpu['Register C'] = wasmboy.wasmInstance.exports.getRegisterC();
    valueTable.cpu['Register D'] = wasmboy.wasmInstance.exports.getRegisterD();
    valueTable.cpu['Register E'] = wasmboy.wasmInstance.exports.getRegisterE();
    valueTable.cpu['Register H'] = wasmboy.wasmInstance.exports.getRegisterH();
    valueTable.cpu['Register L'] = wasmboy.wasmInstance.exports.getRegisterL();
    valueTable.cpu = Object.assign({}, valueTable.cpu);

    // Update PPU valueTable
    valueTable.ppu['Scanline Register (LY) - 0xFF44'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF44, wasmboy)];
    valueTable.ppu['LCD Status (STAT) - 0xFF41'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF41, wasmboy)];
    valueTable.ppu['LCD Control (LCDC) - 0xFF40'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF40, wasmboy)];
    valueTable.ppu['Scroll X - 0xFF43'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF43, wasmboy)];
    valueTable.ppu['Scroll Y - 0xFF42'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF42, wasmboy)];
    valueTable.ppu['Window X - 0xFF4B'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF4B, wasmboy)];
    valueTable.ppu['Window Y - 0xFF4A'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF4A, wasmboy)];

    // Update Timers valueTable
    valueTable.timers['TIMA - 0xFF05'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF05, wasmboy)];
    valueTable.timers['TMA - 0xFF06'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF06, wasmboy)];
    valueTable.timers['TIMC/TAC - 0xFF07'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF07, wasmboy)];
    valueTable.timers['DIV/Divider Register - 0xFF04'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF04, wasmboy)];

    // Update interrupts valueTable
    if(wasmboy.wasmInstance.exports.areInterruptsEnabled()) {
      valueTable.interrupts['Interrupt Master Switch'] = 0x01;
    } else {
      valueTable.interrupts['Interrupt Master Switch'] = 0x00;
    }
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];
    valueTable.interrupts['IF/Interrupt Request - 0xFF0F'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF0F, wasmboy)];

    // Update APU valueTable
    // Add the register valueTable for our 4 channels
    for (let channelNum = 1; channelNum <= 4; channelNum++) {
      for (let registerNum = 0; registerNum < 5; registerNum++) {
        let registerAddress = 0xFF10 + (5 * (channelNum - 1)) + registerNum;
        valueTable.apu[`Channel ${channelNum} - NR${channelNum}${registerNum} - 0x${(registerAddress).toString(16).toUpperCase()}`] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(registerAddress, wasmboy)];
      }
    }
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];

    // Clone our valueTable, that it is immutable and will cause change detection
    const newState = Object.assign({}, this.state);
    newState.valueTable = valueTable
    this.setState(newState);
  }



	render(props) {
		return (
      <div>
          <h1>Debugger</h1>

          <h2>Control Flow Actions:</h2>

          <div class="debuggerAction">
            <button onclick={() => {this.stepOpcode(props.wasmboy, props.wasmboyGraphics);}}>Step Opcode</button>
          </div>

          <div class="debuggerAction">
            <button onclick={() => {this.runNumberOfOpcodes(props.wasmboy, props.wasmboyGraphics);}}>Run Hardcoded number of opcodes</button>
          </div>

          <div class="debuggerAction">
            0x<input id="number"
             type="string"
             value={this.state.breakPoint }
             onChange={(evt) => { this.state.breakPoint = evt.target.value; }} />
            <button onclick={() => {this.breakPoint(props.wasmboy, props.wasmboyGraphics);}}>Breakpoint (HEX)</button>
          </div>

          <h2>Wasmboy State Actions:</h2>

          <div class="debuggerAction">
            <button onclick={() => {this.logWasmBoyMemory(props.wasmboy)}}>Log Memory to console</button>
          </div>

          <div class="debuggerAction">
            <button onclick={() => {props.wasmboyAudio.debugSaveCurrentAudioBufferToWav()}}>Save Current Audio buffer to wav</button>
          </div>

          <div class="debuggerAction">
            <button onclick={() => { this.state.showValueTable = true; this.updateValueTable(props.wasmboy)}}>Update Value Table</button>
          </div>

          <h2>Debugger Options:</h2>

          <div>
            <label for="showValueTable">Show Value Table</label>
            <input
              id="showValueTable"
              type="checkbox"
              checked={ this.state.showValueTable }
              onChange={ () => { this.flipShowStatus('showValueTable'); this.updateValueTable(props.wasmboy) } } />
          </div>

          <div>
            <label for="autoUpdateValueTable">Auto Update Value Table</label>
            <input
              id="autoUpdateValueTable"
              type="checkbox"
              checked={ this.state.autoUpdateValueTable }
              onChange={ () => { this.state.showValueTable = true; this.flipShowStatus('autoUpdateValueTable', props.wasmboy); } } />
          </div>

          <div className={ this.getStateClass('showValueTable') }>
            <h2>Value Table</h2>

            <h3>Cpu Info:</h3>
            <a href="http://gbdev.gg8.se/wiki/articles/Pan_Docs#CPU_Specifications" target="blank"><i>Reference Doc</i></a>
            <NumberBaseTable object={this.state.valueTable.cpu}></NumberBaseTable>

            <h3>PPU Info:</h3>
            <a href="http://gbdev.gg8.se/wiki/articles/Video_Display" target="blank"><i>Reference Doc</i></a>
            <NumberBaseTable object={this.state.valueTable.ppu}></NumberBaseTable>

            <h3>APU Info:</h3>
            <a href="http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware" target="blank"><i>Reference Doc</i></a>
            <NumberBaseTable object={this.state.valueTable.apu}></NumberBaseTable>

            <h3>Timer Info:</h3>
            <a href="http://gbdev.gg8.se/wiki/articles/Timer_and_Divider_Registers" target="blank"><i>Reference Doc</i></a>
            <NumberBaseTable object={this.state.valueTable.timers}></NumberBaseTable>

            <h3>Interrupt Info:</h3>
            <a href="http://gbdev.gg8.se/wiki/articles/Interrupts" target="blank"><i>Reference Doc</i></a>
            <NumberBaseTable object={this.state.valueTable.interrupts}></NumberBaseTable>
          </div>
      </div>
		);
	}
}
