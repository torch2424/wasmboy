import { Component } from 'preact';
import { WasmBoy } from '../../../dist/wasmboy.wasm.esm';
import { NumberBaseTable } from './numberBaseTable/numberBaseTable';
import { WasmBoyBackgroundMap } from './wasmboyBackgroundMap/wasmboyBackgroundMap';
import { WasmBoyTileData } from './wasmboyTileData/wasmboyTileData';
import './wasmboyDebugger.css';

// Function to get a value in gameboy memory, to wasmboy memory
const getWasmBoyOffsetFromGameBoyOffset = async gameboyOffset => {
  return await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [gameboyOffset]);
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
      opcodesStepped: '0',
      cyclesRan: '0',
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
    const stepOpcodeTask = async () => {
      const numberOfCycles = await WasmBoy._runWasmExport('emulationStep');

      if (numberOfCycles <= 0) {
        console.error('Opcode not recognized! Check wasm logs.');
        this.updateDebugInfo();
        throw new Error();
      }

      this.updateExecutionProgress();

      if (skipDebugOutput) {
        return;
      }
      this.updateValueTable();
    };
    return stepOpcodeTask();
  }

  // Function to run a specifed number of opcodes for faster stepping
  runNumberOfOpcodes(numberOfOpcodes, breakPoint, skipDebugOutput) {
    // Keep stepping until highest opcode increases
    let opcodesToRun = this.state.opcodesToRun;
    if (numberOfOpcodes) {
      opcodesToRun = numberOfOpcodes;
    }

    const runNumberOfOpcodesTask = async () => {
      let opcodesRan = 0;

      const runOpcode = async () => {
        await this.stepOpcode(true);

        if (!skipDebugOutput) {
          this.updateValueTable();
        }
        const programCounter = await WasmBoy._runWasmExport('getProgramCounter');
        if (breakPoint && breakPoint === programCounter) {
          if (skipDebugOutput) {
            this.updateValueTable();
          }
          return;
        }

        if (opcodesRan < opcodesToRun) {
          opcodesRan++;
          await runOpcode();
          return;
        }
      };
      await runOpcode();
    };
    return runNumberOfOpcodesTask();
  }

  // Function to keep running opcodes until a breakpoint is reached
  breakPoint(skipInitialStep) {
    // Set our opcode breakpoint
    const breakPoint = parseInt(this.state.breakPoint, 16);

    const breakPointTask = async () => {
      if (!skipInitialStep) {
        await this.runNumberOfOpcodes(1, breakPoint);
      }

      const response = await WasmBoy._runWasmExport('executeFrameUntilBreakpoint', [breakPoint]);
      if (response === 0) {
        requestAnimationFrame(() => {
          this.updateExecutionProgress();
          this.updateValueTable();
          this.breakPoint(true);
        });
      } else if (response === -1) {
        throw new Error('WasmBoy Crashed while trying to reach the breakpoint');
      } else {
        console.log('Reached Breakpoint, that satisfies test inside runNumberOfOpcodes');
        this.updateExecutionProgress();
        this.updateValueTable();
      }
    };
    breakPointTask();
  }

  logWasmBoyMemory() {
    WasmBoy._getWasmMemorySection().then(wasmByteMemory => {
      console.log(`[WasmBoy Debugger] Entire WasmBoy Memory:`, wasmByteMemory);
    });
  }

  logGameBoyMemory() {
    const asyncTask = async () => {
      const location = await WasmBoy._getWasmConstant('GAMEBOY_INTERNAL_MEMORY_LOCATION');
      const size = await WasmBoy._getWasmConstant('GAMEBOY_INTERNAL_MEMORY_SIZE');
      const memory = await WasmBoy._getWasmMemorySection(location, location + size + 1);
      console.log(`[WasmBoy Debugger] Gameboy Memory:`, memory);
    };
    asyncTask();
  }

  updateExecutionProgress() {
    // Async task to get the
    // opcodes stepped, cycles ran, etc...

    const asyncTask = async () => {
      const opcodesStepped = await WasmBoy._getStepsAsString();
      const cyclesRan = await WasmBoy._getCyclesAsString();
      this.setState({
        ...this.state,
        opcodesStepped,
        cyclesRan
      });
    };
    asyncTask();
  }

  updateValueTable() {
    // Check that we have our instance and byte memory
    if (!WasmBoy.isReady()) {
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

    const getValueTableTask = async () => {
      // Update CPU valueTable
      valueTable.cpu['Program Counter (PC)'] = await WasmBoy._runWasmExport('getProgramCounter');
      valueTable.cpu['Opcode at PC'] = await WasmBoy._runWasmExport('getOpcodeAtProgramCounter');
      valueTable.cpu['Stack Pointer'] = await WasmBoy._runWasmExport('getStackPointer');
      valueTable.cpu['Register A'] = await WasmBoy._runWasmExport('getRegisterA');
      valueTable.cpu['Register F'] = await WasmBoy._runWasmExport('getRegisterF');
      valueTable.cpu['Register B'] = await WasmBoy._runWasmExport('getRegisterB');
      valueTable.cpu['Register C'] = await WasmBoy._runWasmExport('getRegisterC');
      valueTable.cpu['Register D'] = await WasmBoy._runWasmExport('getRegisterD');
      valueTable.cpu['Register E'] = await WasmBoy._runWasmExport('getRegisterE');
      valueTable.cpu['Register H'] = await WasmBoy._runWasmExport('getRegisterH');
      valueTable.cpu['Register L'] = await WasmBoy._runWasmExport('getRegisterL');
      valueTable.cpu = Object.assign({}, valueTable.cpu);

      // Get all of the gameboy 0xffXX memory
      const debugMemoryStart = await getWasmBoyOffsetFromGameBoyOffset(0xff00);
      const debugMemoryEnd = await getWasmBoyOffsetFromGameBoyOffset(0xffff);
      const debugMemory = await WasmBoy._getWasmMemorySection(debugMemoryStart, debugMemoryEnd + 1);

      // Update PPU
      valueTable.ppu['Scanline Register (LY) - 0xFF44'] = await WasmBoy._runWasmExport('getLY');
      valueTable.ppu['LCD Status (STAT) - 0xFF41'] = debugMemory[0x0041];
      valueTable.ppu['LCD Control (LCDC) - 0xFF40'] = debugMemory[0x0040];
      valueTable.ppu['Scroll X - 0xFF43'] = debugMemory[0x0043];
      valueTable.ppu['Scroll Y - 0xFF42'] = debugMemory[0x0042];
      valueTable.ppu['Window X - 0xFF4B'] = debugMemory[0x004b];
      valueTable.ppu['Window Y - 0xFF4A'] = debugMemory[0x004a];

      // Update Timers valueTable
      valueTable.timers['TIMA - 0xFF05'] = await WasmBoy._runWasmExport('getTIMA');
      valueTable.timers['TMA - 0xFF06'] = await WasmBoy._runWasmExport('getTMA');
      valueTable.timers['TIMC/TAC - 0xFF07'] = await WasmBoy._runWasmExport('getTAC');
      valueTable.timers['DIV/Divider Register - 0xFF04'] = await WasmBoy._runWasmExport('getDIV');

      // Update interrupts valueTable
      // TODO: Interrupot master switch
      // if(WasmBoy._getWasmInstance().exports.areInterruptsEnabled()) {
      //   valueTable.interrupts['Interrupt Master Switch'] = 0x01;
      // } else {
      //   valueTable.interrupts['Interrupt Master Switch'] = 0x00;
      // }
      valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = debugMemory[0x00ff];
      valueTable.interrupts['IF/Interrupt Request - 0xFF0F'] = debugMemory[0x000f];

      // Update APU valueTable
      // Add the register valueTable for our 4 channels
      for (let channelNum = 1; channelNum <= 4; channelNum++) {
        for (let registerNum = 0; registerNum < 5; registerNum++) {
          let registerAddress = 0xff10 + 5 * (channelNum - 1) + registerNum;
          valueTable.apu[`Channel ${channelNum} - NR${channelNum}${registerNum} - 0x${registerAddress.toString(16).toUpperCase()}`] =
            debugMemory[registerAddress & 0x00ff];
        }
      }

      // Clone our valueTable, that it is immutable and will cause change detection
      const newState = Object.assign({}, this.state);
      newState.valueTable = valueTable;
      this.setState(newState);
    };
    getValueTableTask();
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
          Breakpoint Line Number: 0x
          <input
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
            Log Entire WasmBoy Memory to console
          </button>
        </div>

        <div class="debuggerAction">
          <button
            class="button"
            onclick={() => {
              this.logGameBoyMemory();
            }}
          >
            Log Gameboy Memory to console
          </button>
        </div>

        <div class="debuggerAction">
          <button
            class="button"
            onclick={() => {
              console.log('Retrieving Cartridge Info...');
              WasmBoy._getCartridgeInfo().then(cartridgeInfo => {
                console.log('Cartridge Info:', cartridgeInfo);
              });
            }}
          >
            Log Cartridge Info to Console
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

        <div>
          <h2>Opcodes Stepped: {this.state.opcodesStepped}</h2>
          <h2>Cycles Ran: {this.state.cyclesRan}</h2>
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
