import { Component } from "preact";
import { NumberBaseTable } from "./numberBaseTable/numberBaseTable";
import { WasmBoyBackgroundMap } from "./wasmboyBackgroundMap/wasmboyBackgroundMap";
import { WasmBoyTileData } from "./wasmboyTileData/wasmboyTileData";
import "./wasmboyDebugger.css";

// Function to get a value in gameboy memory, to wasmboy memory
const getWasmBoyOffsetFromGameBoyOffset = (gameboyOffset, wasmboy) => {
  return wasmboy.wasmInstance.exports.getWasmBoyOffsetFromGameBoyOffset(
    gameboyOffset
  );
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
      breakPoint: "40",
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
  flipShowStatus(stateKey, wasmboy) {
    const newState = Object.assign({}, this.state);
    newState[stateKey] = !newState[stateKey];
    this.setState(newState);

    // Fireoff a a raf for updating the value table
    if (stateKey === "autoUpdateValueTable") {
      if (this.state.autoUpdateValueTable) {
        const autoUpdateValueTable = () => {
          this.updateValueTable(wasmboy);
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
    return this.state[stateKey] ? "" : "hide";
  }

  // Function to runa  single opcode
  stepOpcode(wasmboy, wasmboyGraphics, skipDebugOutput) {
    return new Promise(resolve => {
      const numberOfCycles = wasmboy.wasmInstance.exports.emulationStep();

      if (numberOfCycles <= 0) {
        console.error("Opcode not recognized! Check wasm logs.");
        this.updateDebugInfo(wasmboy);
        throw new Error();
      }

      if (skipDebugOutput) {
        resolve();
        return;
      }
      wasmboyGraphics.renderFrame();
      this.updateValueTable(wasmboy);

      resolve();
    });
  }

  // Function to run a specifed number of opcodes for faster stepping
  runNumberOfOpcodes(
    wasmboy,
    wasmboyGraphics,
    numberOfOpcodes,
    breakPoint,
    skipDebugOutput
  ) {
    // Keep stepping until highest opcode increases
    let opcodesToRun = this.state.opcodesToRun;
    if (numberOfOpcodes) {
      opcodesToRun = numberOfOpcodes;
    }

    return new Promise(resolve => {
      let opcodesRan = 0;

      const runOpcode = () => {
        this.stepOpcode(wasmboy, wasmboyGraphics, true).then(() => {
          if (
            breakPoint &&
            breakPoint === wasmboy.wasmInstance.exports.getProgramCounter()
          ) {
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

          wasmboyGraphics.renderFrame();
          this.updateValueTable(wasmboy);

          resolve();
        });
      };
      runOpcode();
    });
  }

  // Function to keep running opcodes until a breakpoint is reached
  breakPoint(wasmboy, wasmboyGraphics, skipInitialStep) {
    // Set our opcode breakpoint
    const breakPoint = parseInt(this.state.breakPoint, 16);

    let initialStepPromise = Promise.resolve();
    if (!skipInitialStep) {
      initialStepPromise = this.runNumberOfOpcodes(
        wasmboy,
        wasmboyGraphics,
        1,
        breakPoint
      );
    }

    initialStepPromise.then(() => {
      if (wasmboy.wasmInstance.exports.getProgramCounter() !== breakPoint) {
        requestAnimationFrame(() => {
          this.runNumberOfOpcodes(
            wasmboy,
            wasmboyGraphics,
            2000 + Math.floor(Math.random() * 10),
            breakPoint,
            true
          ).then(() => {
            wasmboyGraphics.renderFrame();
            this.updateValueTable(wasmboy);
            this.breakPoint(wasmboy, wasmboyGraphics, true);
          });
        });
      } else {
        console.log(
          "Reached Breakpoint, that satisfies test inside runNumberOfOpcodes"
        );
        wasmboyGraphics.renderFrame();
        this.updateValueTable(wasmboy);
      }
    });
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
    valueTable.cpu[
      "Program Counter (PC)"
    ] = wasmboy.wasmInstance.exports.getProgramCounter();
    valueTable.cpu[
      "Opcode at PC"
    ] = wasmboy.wasmInstance.exports.getOpcodeAtProgramCounter();
    valueTable.cpu[
      "Stack Pointer"
    ] = wasmboy.wasmInstance.exports.getStackPointer();
    valueTable.cpu["Register A"] = wasmboy.wasmInstance.exports.getRegisterA();
    valueTable.cpu["Register F"] = wasmboy.wasmInstance.exports.getRegisterF();
    valueTable.cpu["Register B"] = wasmboy.wasmInstance.exports.getRegisterB();
    valueTable.cpu["Register C"] = wasmboy.wasmInstance.exports.getRegisterC();
    valueTable.cpu["Register D"] = wasmboy.wasmInstance.exports.getRegisterD();
    valueTable.cpu["Register E"] = wasmboy.wasmInstance.exports.getRegisterE();
    valueTable.cpu["Register H"] = wasmboy.wasmInstance.exports.getRegisterH();
    valueTable.cpu["Register L"] = wasmboy.wasmInstance.exports.getRegisterL();
    valueTable.cpu = Object.assign({}, valueTable.cpu);

    // Update PPU valueTable
    valueTable.ppu["Scanline Register (LY) - 0xFF44"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff44, wasmboy)
      ];
    valueTable.ppu["LCD Status (STAT) - 0xFF41"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff41, wasmboy)
      ];
    valueTable.ppu["LCD Control (LCDC) - 0xFF40"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff40, wasmboy)
      ];
    valueTable.ppu["Scroll X - 0xFF43"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff43, wasmboy)
      ];
    valueTable.ppu["Scroll Y - 0xFF42"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff42, wasmboy)
      ];
    valueTable.ppu["Window X - 0xFF4B"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff4b, wasmboy)
      ];
    valueTable.ppu["Window Y - 0xFF4A"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff4a, wasmboy)
      ];

    // Update Timers valueTable
    valueTable.timers["TIMA - 0xFF05"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff05, wasmboy)
      ];
    valueTable.timers["TMA - 0xFF06"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff06, wasmboy)
      ];
    valueTable.timers["TIMC/TAC - 0xFF07"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff07, wasmboy)
      ];
    valueTable.timers["DIV/Divider Register - 0xFF04"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff04, wasmboy)
      ];

    // Update interrupts valueTable
    // TODO: Interrupot master switch
    // if(wasmboy.wasmInstance.exports.areInterruptsEnabled()) {
    //   valueTable.interrupts['Interrupt Master Switch'] = 0x01;
    // } else {
    //   valueTable.interrupts['Interrupt Master Switch'] = 0x00;
    // }
    valueTable.interrupts["IE/Interrupt Enabled - 0xFFFF"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xffff, wasmboy)
      ];
    valueTable.interrupts["IF/Interrupt Request - 0xFF0F"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xff0f, wasmboy)
      ];

    // Update APU valueTable
    // Add the register valueTable for our 4 channels
    for (let channelNum = 1; channelNum <= 4; channelNum++) {
      for (let registerNum = 0; registerNum < 5; registerNum++) {
        let registerAddress = 0xff10 + 5 * (channelNum - 1) + registerNum;
        valueTable.apu[
          `Channel ${channelNum} - NR${channelNum}${registerNum} - 0x${registerAddress
            .toString(16)
            .toUpperCase()}`
        ] =
          wasmboy.wasmByteMemory[
            getWasmBoyOffsetFromGameBoyOffset(registerAddress, wasmboy)
          ];
      }
    }
    valueTable.interrupts["IE/Interrupt Enabled - 0xFFFF"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xffff, wasmboy)
      ];
    valueTable.interrupts["IE/Interrupt Enabled - 0xFFFF"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xffff, wasmboy)
      ];
    valueTable.interrupts["IE/Interrupt Enabled - 0xFFFF"] =
      wasmboy.wasmByteMemory[
        getWasmBoyOffsetFromGameBoyOffset(0xffff, wasmboy)
      ];

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
              this.stepOpcode(props.wasmboy, props.wasmboyGraphics).then(
                () => {}
              );
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
              this.runNumberOfOpcodes(
                props.wasmboy,
                props.wasmboyGraphics
              ).then(() => {});
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
              this.breakPoint(props.wasmboy, props.wasmboyGraphics);
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
              this.logWasmBoyMemory(props.wasmboy);
            }}
          >
            Log Memory to console
          </button>
        </div>

        <div class="debuggerAction">
          <button
            class="button"
            onclick={() => {
              props.wasmboyAudio.debugSaveCurrentAudioBufferToWav();
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
              this.updateValueTable(props.wasmboy);
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
                this.flipShowStatus("showValueTable");
                this.updateValueTable(props.wasmboy);
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
                this.flipShowStatus("autoUpdateValueTable", props.wasmboy);
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
                this.flipShowStatus("showBackgroundMap");
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
                this.flipShowStatus("showTileData");
              }}
            />
          </label>
        </div>

        <div
          className={this.getStateClass("showValueTable") + " animated fadeIn"}
        >
          <h2>Value Table</h2>

          <h3>Cpu Info:</h3>
          <a
            href="http://gbdev.gg8.se/wiki/articles/Pan_Docs#CPU_Specifications"
            target="blank"
          >
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.cpu} />

          <h3>PPU Info:</h3>
          <a
            href="http://gbdev.gg8.se/wiki/articles/Video_Display"
            target="blank"
          >
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.ppu} />

          <h3>APU Info:</h3>
          <a
            href="http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware"
            target="blank"
          >
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.apu} />

          <h3>Timer Info:</h3>
          <a
            href="http://gbdev.gg8.se/wiki/articles/Timer_and_Divider_Registers"
            target="blank"
          >
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.timers} />

          <h3>Interrupt Info:</h3>
          <a href="http://gbdev.gg8.se/wiki/articles/Interrupts" target="blank">
            <i>Reference Doc</i>
          </a>
          <NumberBaseTable object={this.state.valueTable.interrupts} />
        </div>

        <div
          className={
            this.getStateClass("showBackgroundMap") + " animated fadeIn"
          }
        >
          <WasmBoyBackgroundMap
            wasmboy={props.wasmboy}
            shouldUpdate={this.state.showBackgroundMap}
            getWasmBoyOffsetFromGameBoyOffset={
              getWasmBoyOffsetFromGameBoyOffset
            }
          />
        </div>

        <div
          className={this.getStateClass("showTileData") + " animated fadeIn"}
        >
          <WasmBoyTileData
            wasmboy={props.wasmboy}
            shouldUpdate={this.state.showTileData}
            getWasmBoyOffsetFromGameBoyOffset={
              getWasmBoyOffsetFromGameBoyOffset
            }
          />
        </div>
      </div>
    );
  }
}
