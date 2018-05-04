import { Component } from 'preact';
import { WasmBoy } from '../../lib/index';
import { NumberBaseTable } from './numberBaseTable/numberBaseTable';
import { WasmBoyBackgroundMap } from './wasmboyBackgroundMap/wasmboyBackgroundMap';
import { WasmBoyTileData } from './wasmboyTileData/wasmboyTileData';
import './wasmboyDebugger.css';

// Function to get a value in gameboy memory, to wasmboy memory
const getWasmBoyOffsetFromGameBoyOffset = gameboyOffset => {
  return WasmBoy._getWasmInstance().exports.getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
};

let autoUpdateValueTableId = false;

export class WasmBoyDebugger extends Component {
  constructor() {
    super();
    // set our state to if we are initialized or not
    this.state = {
      showValueTable: false,
      autoUpdateValueTable: false,
      showBackgroundMap: false,
      showTileData: false,
      breakPoint: '40',
      opcodesToRun: 2000,
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
  flipShowStatus(stateKey) {
    const newState = Object.assign({}, this.state);
    newState[stateKey] = !newState[stateKey];
    this.setState(newState);

    // Fireoff a a raf for updating the value table
    if (stateKey === 'autoUpdateValueTable') {
      if (this.state.autoUpdateValueTable) {
        const autoUpdateValueTable = () => {
          this.updateValueTable();
          if (autoUpdateValueTableId) {
            autoUpdateValueTableId = requestAnimationFrame(() => {
              autoUpdateValueTable();
            });
          }
        };
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
  stepOpcode(skipDebugOutput) {
    return new Promise(resolve => {
      const numberOfCycles = WasmBoy._getWasmInstance().exports.emulationStep();

      if (numberOfCycles <= 0) {
        console.error('Opcode not recognized! Check wasm logs.');
        this.updateDebugInfo();
        throw new Error();
      }

      if (skipDebugOutput) {
        resolve();
        return;
      }
      this.updateValueTable();

      resolve();
    });
  }

  // Function to run a specifed number of opcodes for faster stepping
  runNumberOfOpcodes(numberOfOpcodes, breakPoint, skipDebugOutput) {
    // Keep stepping until highest opcode increases
    let opcodesToRun = this.state.opcodesToRun;
    if (numberOfOpcodes) {
      opcodesToRun = numberOfOpcodes;
    }

    return new Promise(resolve => {
      let opcodesRan = 0;

      const runOpcode = () => {
        this.stepOpcode(true).then(() => {
          if (breakPoint && breakPoint === WasmBoy._getWasmInstance().exports.getProgramCounter()) {
            resolve();
            return;
          }

          if (opcodesRan < opcodesToRun) {
            opcodesRan++;
            runOpcode();
            return;
          }

          if (skipDebugOutput) {
            resolve();
            return;
          }

          this.updateValueTable();

          resolve();
        });
      };
      runOpcode();
    });
  }

  // Function to keep running opcodes until a breakpoint is reached
  breakPoint(skipInitialStep) {
    // Set our opcode breakpoint
    const breakPoint = parseInt(this.state.breakPoint, 16);

    let initialStepPromise = Promise.resolve();
    if (!skipInitialStep) {
      initialStepPromise = this.runNumberOfOpcodes(1, breakPoint);
    }

    initialStepPromise.then(() => {
      if (WasmBoy._getWasmInstance().exports.getProgramCounter() !== breakPoint) {
        requestAnimationFrame(() => {
          this.runNumberOfOpcodes(2000 + Math.floor(Math.random() * 10), breakPoint, true).then(() => {
            this.updateValueTable();
            this.breakPoint(true);
          });
        });
      } else {
        console.log('Reached Breakpoint, that satisfies test inside runNumberOfOpcodes');
        this.updateValueTable();
      }
    });
  }

  logWasmBoyMemory() {
    console.log(`[WasmBoy Debugger] Memory:`, WasmBoy._getWasmByteMemory());
  }

  updateValueTable() {
    // Check that we have our instance and byte memory
    if (!WasmBoy._getWasmInstance() || !WasmBoy._getWasmByteMemory()) {
      return;
    }

    // Create our new valueTable object
    const valueTable = {
      cpu: {},
      ppu: {},
      apu: {},
      timers: {},
      interrupts: {}
    };

    // Update CPU valueTable
    valueTable.cpu['Program Counter (PC)'] = WasmBoy._getWasmInstance().exports.getProgramCounter();
    valueTable.cpu['Opcode at PC'] = WasmBoy._getWasmInstance().exports.getOpcodeAtProgramCounter();
    valueTable.cpu['Stack Pointer'] = WasmBoy._getWasmInstance().exports.getStackPointer();
    valueTable.cpu['Register A'] = WasmBoy._getWasmInstance().exports.getRegisterA();
    valueTable.cpu['Register F'] = WasmBoy._getWasmInstance().exports.getRegisterF();
    valueTable.cpu['Register B'] = WasmBoy._getWasmInstance().exports.getRegisterB();
    valueTable.cpu['Register C'] = WasmBoy._getWasmInstance().exports.getRegisterC();
    valueTable.cpu['Register D'] = WasmBoy._getWasmInstance().exports.getRegisterD();
    valueTable.cpu['Register E'] = WasmBoy._getWasmInstance().exports.getRegisterE();
    valueTable.cpu['Register H'] = WasmBoy._getWasmInstance().exports.getRegisterH();
    valueTable.cpu['Register L'] = WasmBoy._getWasmInstance().exports.getRegisterL();
    valueTable.cpu = Object.assign({}, valueTable.cpu);

    // Update PPU valueTable
    valueTable.ppu['Scanline Register (LY) - 0xFF44'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff44)];
    valueTable.ppu['LCD Status (STAT) - 0xFF41'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff41)];
    valueTable.ppu['LCD Control (LCDC) - 0xFF40'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff40)];
    valueTable.ppu['Scroll X - 0xFF43'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff43)];
    valueTable.ppu['Scroll Y - 0xFF42'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff42)];
    valueTable.ppu['Window X - 0xFF4B'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff4b)];
    valueTable.ppu['Window Y - 0xFF4A'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff4a)];

    // Update Timers valueTable
    valueTable.timers['TIMA - 0xFF05'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff05)];
    valueTable.timers['TMA - 0xFF06'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff06)];
    valueTable.timers['TIMC/TAC - 0xFF07'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff07)];
    valueTable.timers['DIV/Divider Register - 0xFF04'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff04)];

    // Update interrupts valueTable
    // TODO: Interrupot master switch
    // if(WasmBoy._getWasmInstance().exports.areInterruptsEnabled()) {
    //   valueTable.interrupts['Interrupt Master Switch'] = 0x01;
    // } else {
    //   valueTable.interrupts['Interrupt Master Switch'] = 0x00;
    // }
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xffff)];
    valueTable.interrupts['IF/Interrupt Request - 0xFF0F'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xff0f)];

    // Update APU valueTable
    // Add the register valueTable for our 4 channels
    for (let channelNum = 1; channelNum <= 4; channelNum++) {
      for (let registerNum = 0; registerNum < 5; registerNum++) {
        let registerAddress = 0xff10 + 5 * (channelNum - 1) + registerNum;
        valueTable.apu[
          `Channel ${channelNum} - NR${channelNum}${registerNum} - 0x${registerAddress.toString(16).toUpperCase()}`
        ] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(registerAddress)];
      }
    }
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xffff)];
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xffff)];
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = WasmBoy._getWasmByteMemory()[getWasmBoyOffsetFromGameBoyOffset(0xffff)];

    // Clone our valueTable, that it is immutable and will cause change detection
    const newState = Object.assign({}, this.state);
    newState.valueTable = valueTable;
    this.setState(newState);
  }

  render(props) {
    return (
      <div class="wasmboy__debugger animated fadeIn">
        <h1>Debugger</h1>

        <h2>Control Flow Actions:</h2>

        <div class="debuggerAction">
          <button
            class="button"
            onclick={() => {
              this.stepOpcode().then(() => {});
            }}
          >
            Step Opcode
          </button>
        </div>

        <div class="debuggerAction">
          Run Specified Number of Opcodes:
          <input
            type="number"
            class="input"
            value={this.state.opcodesToRun}
            onChange={evt => {
              this.state.opcodesToRun = evt.target.value;
            }}
          />
          <button
            class="button"
            onclick={() => {
              this.runNumberOfOpcodes().then(() => {});
            }}
          >
            Run number of opcodes
          </button>
        </div>

        <div class="debuggerAction">
          Breakpoint Line Number: 0x<input
            type="string"
            class="input"
            value={this.state.breakPoint}
            onChange={evt => {
              this.state.breakPoint = evt.target.value;
            }}
          />
          <button
            class="button"
            onclick={() => {
              this.breakPoint();
            }}
          >
            Run To Breakpoint
          </button>
        </div>

        <h2>Wasmboy State Actions:</h2>

        <div class="debuggerAction">
          <button
            class="button"
            onclick={() => {
              this.logWasmBoyMemory();
            }}
          >
            Log Memory to console
          </button>
        </div>

        <div class="debuggerAction">
          <button
            class="button"
            onclick={() => {
              WasmBoy._saveCurrentAudioBufferToWav();
            }}
          >
            Save Current Audio buffer to wav
          </button>
        </div>

        <div class="debuggerAction">
          <button
            class="button"
            onclick={() => {
              this.state.showValueTable = true;
              this.updateValueTable();
            }}
          >
            Update Value Table
          </button>
        </div>

        <h2>Debugger Elements:</h2>

        <div>
          <label class="checkbox" for="showValueTable">
            Show Value Table
            <input
              id="showValueTable"
              type="checkbox"
              checked={this.state.showValueTable}
              onChange={() => {
                this.flipShowStatus('showValueTable');
                this.updateValueTable();
              }}
            />
          </label>
        </div>

        <div>
          <label class="checkbox" for="autoUpdateValueTable">
            Auto Update Value Table
            <input
              id="autoUpdateValueTable"
              type="checkbox"
              checked={this.state.autoUpdateValueTable}
              onChange={() => {
                this.state.showValueTable = true;
                this.flipShowStatus('autoUpdateValueTable');
              }}
            />
          </label>
        </div>

        <div>
          <label class="checkbox" for="showBackgroundMap">
            Show Background Map
            <input
              id="showBackgroundMap"
              type="checkbox"
              checked={this.state.showBackgroundMap}
              onChange={() => {
                this.flipShowStatus('showBackgroundMap');
              }}
            />
          </label>
        </div>

        <div>
          <label class="checkbox" for="showTileData">
            Show Tile Data
            <input
              id="showTileData"
              type="checkbox"
              checked={this.state.showTileData}
              onChange={() => {
                this.flipShowStatus('showTileData');
              }}
            />
          </label>
        </div>

        <div className={this.getStateClass('showValueTable') + ' animated fadeIn'}>
          <h2>Value Table</h2>

          <h3>Cpu Info:</h3>
          <a href="http://gbdev.gg8.se/wiki/articles/Pan_Docs#CPU_Specifications" target="blank">
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.cpu} />

          <h3>PPU Info:</h3>
          <a href="http://gbdev.gg8.se/wiki/articles/Video_Display" target="blank">
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.ppu} />

          <h3>APU Info:</h3>
          <a href="http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware" target="blank">
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.apu} />

          <h3>Timer Info:</h3>
          <a href="http://gbdev.gg8.se/wiki/articles/Timer_and_Divider_Registers" target="blank">
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.timers} />

          <h3>Interrupt Info:</h3>
          <a href="http://gbdev.gg8.se/wiki/articles/Interrupts" target="blank">
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.interrupts} />
        </div>

        <div className={this.getStateClass('showBackgroundMap') + ' animated fadeIn'}>
          <WasmBoyBackgroundMap
            shouldUpdate={this.state.showBackgroundMap}
            getWasmBoyOffsetFromGameBoyOffset={getWasmBoyOffsetFromGameBoyOffset}
          />
        </div>

        <div className={this.getStateClass('showTileData') + ' animated fadeIn'}>
          <WasmBoyTileData shouldUpdate={this.state.showTileData} getWasmBoyOffsetFromGameBoyOffset={getWasmBoyOffsetFromGameBoyOffset} />
        </div>
      </div>
    );
  }
}
