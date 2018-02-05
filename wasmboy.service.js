import fetch from 'unfetch'
import Promise from 'promise-polyfill';

// TODO: Handle rejects

class WasmBoy {

  // Start the request to our wasm module
  constructor() {
    this.wasmModuleRequest = fetch('dist/wasm/index.untouched.wasm')
    .then(response => response.arrayBuffer());
    this._maxCycles = 69905;
    this._currentCycles = 0;
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.gameBytes = undefined;

    this.debugState = {
      currentOpcode: undefined
    }
  }

  // Finish request for wasm module, and fetch game
  loadGame(pathToGame) {
    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/
    return new Promise((resolve, reject) => {
      // Vaguely trying an IFFIE Pattern and diving our instance, and game fetch
      Promise.all([
        this._getWasmInstance(),
        this._fetchGameAsByteArray('DMG_ROM.gb'),
        this._fetchGameAsByteArray(pathToGame)
      ]).then((responses) => {
        // Responses already bound to this, simple resolve parent promise
        // Set our gamebytes
        const biosBytes = responses[1];
        this.gameBytes = responses[2];

        // Load the game data into actual memory
        for(let i = 0; i < 0x7FFF; i++) {

          // Load the bios, then the game
          if(i < 0x100) {
            this.wasmByteMemory[i] = biosBytes[i];
          } else if(this.gameBytes[i]) {
              this.wasmByteMemory[i] = this.gameBytes[i];
          }
        }

        console.log(this.wasmByteMemory);
        resolve();
      })
    });
  }

  // TODO: move this
  runNumberOfOpcodes(numberOfOpcodes, opcodeToStop) {
    // Keep stepping until highest opcode increases
    let opcodesToRun = 2000;
    if(numberOfOpcodes) {
      opcodesToRun = numberOfOpcodes
    }
    for(let i = 0; i < opcodesToRun; i++) {
      this.stepOpcodes(true);
      if(opcodeToStop && opcodeToStop === this.wasmInstance.exports.getProgramCounter()) {
        i = opcodesToRun;
      }
    }
    this._render();
    this._debug();
  }

  // TODO: Move this
  breakPoint(skipInitialStep) {
    // Set our opcode breakpoint
    const breakPoint = 0x80;

    if(!skipInitialStep) {
      this.runNumberOfOpcodes(1, breakPoint);
    }

    if(this.wasmInstance.exports.getProgramCounter() !== breakPoint) {
      requestAnimationFrame(() => {
        this.runNumberOfOpcodes(10000, breakPoint);
        this.breakPoint(true);
      });
    } else {
      this._render();
      requestAnimationFrame(() => {
        this._debug();
        console.log('Reached Breakpoint!');
      })
    }
  }

  // TODO: move this
  stepOpcodes(skipDebugOutput) {
    if(skipDebugOutput) {
      this._executeOpcode(false, true);
      return;
    }
    this._executeOpcode(true, true);
    console.log(`Wasm Logs: 0x${this.wasmInstance.exports.getCurrentLogValue().toString(16)} ${this.wasmInstance.exports.getCurrentLogId()}`);
    this._render();
    this._debug(true);
  }


  // Function to start the game
  startGame() {

    // Set our canvas and our context
    this.canvas = document.getElementById('canvas');
    this.canvasContext = canvas.getContext('2d');
    this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvasContext.scale(3, 3);

    // TODO: Don't initialize if running boot rom
    //this.wasmInstance.exports.initialize();
    console.log(`Starting programCounter position: 0x${this.wasmInstance.exports.getProgramCounter().toString(16)}`);

    // TODO: Offload as much of this as possible to WASM
    // Feeding wasm bytes is probably going to slow things down, would be nice to just place the game in wasm memory
    // And read from there
    const emulationLoop = () => {

      // http://www.codeslinger.co.uk/pages/projects/gameboy/beginning.html
      // Run the Decode Loop
      let error = false;
      while(this._currentCycles < this._maxCycles && !error) {
        const numberOfCycles = this._executeOpcode();
        if(numberOfCycles !== false && numberOfCycles > 0) {
          this._currentCycles += numberOfCycles;
        } else {
          error = true;
        }
      }
      // Reset our cycles
      this._currentCycles = 0;

      if(error) {
        return false;
      }

      // Render the display
      //console.log('Rendering Frame');
      this._render();

      requestAnimationFrame(() => {
          emulationLoop();
      });
      return true;
    }


    requestAnimationFrame(() => {
      emulationLoop();
    });
  }

  // Private funciton to returna promise to our wasmModule
  _getWasmInstance() {
    return new Promise((resolve, reject) => {

      if (this.wasmInstance) {
        resolve(this.wasmInstance);
      }

      // Get our wasm instance from our request
      this.wasmInstance = this.wasmModuleRequest.then((binary) => {
        WebAssembly.instantiate(binary, {}).then((instantiatedWasm) => {

          const instance = instantiatedWasm.instance;
          const module = instantiatedWasm.module;
          // Log we got the wasm module loaded
          console.log('wasmboy wasm module instance instantiated', instance);

          // Get our memory from our wasm instance
          const memory = instance.exports.memory;

          // Grow our wasm memory to what we need if not already
          console.log('Growing Memory if needed...');
          console.log('Current memory size:', memory.buffer.byteLength);
          // Gameboy has a memory size of 0xFFFF
          // + (256 * 256) bits of data for graphics another 0xFFFF
          if (memory.buffer.byteLength < 0xFFFF + 0xFFFF) {
            console.log('Growing memory...');
            memory.grow(2);
            console.log('New memory size:', memory.buffer.byteLength);
          } else {
            console.log('Not growing memory...');
          }

          this.wasmInstance = instance;
          // Will stay in sync
          this.wasmByteMemory = new Uint8Array(this.wasmInstance.exports.memory.buffer);

          resolve(this.wasmInstance);

        });
      });
    });
  }

  // Private function to fetch a game
  _fetchGameAsByteArray(pathToGame) {
    return new Promise((resolve, reject) => {
      // Load our backup file
      fetch(pathToGame)
      .then(blob => {
        return blob.arrayBuffer();
      }).then(bytes => {
        const byteArray = new Uint8Array(bytes);
        resolve(byteArray);
      });
    });
  }

  _executeOpcode(showOpcodeInfo, saveCurrentOpcode) {
    // Get our opcode
    // opcodes are at most 3 bytes: https://gbatemp.net/threads/what-size-are-gameboy-opcodes.467282/
    // Therefore, we will pass all 3 bytes, and then the the wasm module should be able to do what it needs, wether or Not
    // it needs all 3
    // TODO: NOTE: Reember we are laoding game into byte memory
    const opcode = this.wasmByteMemory[this.wasmInstance.exports.getProgramCounter()];
    // NOTE: For some odd reason, dataBytes are backwords ONLY when concatenated.
    // See and test: http://gbdev.gg8.se/wiki/articles/Gameboy_Bootstrap_ROM
    // To verfiy
    const dataByteOne = this.wasmByteMemory[this.wasmInstance.exports.getProgramCounter() + 1];
    const dataByteTwo = this.wasmByteMemory[this.wasmInstance.exports.getProgramCounter() + 2];

    if(opcode === undefined) {
      console.log('ERROR! No Opcode found at programCounter position: ', this.wasmInstance.exports.getProgramCounter().toString(16));
      return false;
    }

    if(showOpcodeInfo) {
      console.log(`opcode: 0x${opcode.toString(16)}, dataByteOne: 0x${dataByteOne.toString(16)}, dataByteTwo: ${dataByteTwo.toString(16)}, programCounter: ${this.wasmInstance.exports.getProgramCounter().toString(16)}`);
    }

    if(saveCurrentOpcode) {
      // Set our currentOpcode
      this.debugState.currentOpcode = opcode;
    }

    // Returns the number of cycles the instruction took
    const numberOfCycles = this.wasmInstance.exports.handleOpcode(
      opcode,
      dataByteOne,
      dataByteTwo
    );

    // Function will return < 0 if the opcode was not recognized
    if (numberOfCycles < 0x0000) {
      console.log(`Error! Opcode not recognized! Opcode: 0x${opcode.toString(16)}`);
      return false;
    }

    return numberOfCycles;
  }

  _render() {
    console.log('Rendering...');
    // Draw the pixels
    // 160x144
    // TODO: Maybe set y back to 144?, works with 143
    for(let y = 0; y < 143; y++) {
      for (let x = 0; x < 160; x++) {

        const pixelIndex = 0x10000 + (y * 160) + x;
        const color = this.wasmByteMemory[pixelIndex];
        if (color) {
          let fillStyle = false;
          if(color === 1) {
            fillStyle = "#FFFFFF";
          } else if (color === 2) {
            fillStyle = "#D3D3D3";
          } else if (color === 3) {
            fillStyle = "#A9A9A9";
          } else {
            fillStyle = "#000000";
          }
          this.canvasContext.fillStyle = fillStyle;
          this.canvasContext.fillRect(x, y, 1, 1);
        } else {
          // TODO: Remove this testing code:
          this.canvasContext.fillStyle = "#f30000";
          this.canvasContext.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // Private funciton to debug wasm
  _debug(shouldShowLogs) {

    // Log memory changes
    const memChanges = [];
    this.wasmByteMemory.forEach((element, index) => {
      if(element !== 0) {
        memChanges.push({
          value: element,
          index: '0x' + index.toString(16)
        })
      }
    });

    if(shouldShowLogs) {
      console.log(`Wasm Logs: 0x${this.wasmInstance.exports.getCurrentLogValue().toString(16)} ${this.wasmInstance.exports.getCurrentLogId()}`);
      console.log('Memory Changes: ', memChanges);
      console.log('Current Memory: ', this.wasmByteMemory);
    }

    // Print out all of our info
    const cpuDebugDiv = document.getElementById('cpu-debug-info');
    const ppuDebugDiv = document.getElementById('ppu-debug-info');

    const createSectionWithText = (text, value) => {
      const sectionDiv = document.createElement("div");
      let sectionContent;
      if(value) {
          sectionContent = document.createTextNode(`${text}: ${value.toString(2)} | 0x${value.toString(16)} | ${value}`);
      } else {
        sectionContent = document.createTextNode(`${text}`);
      }
      sectionDiv.appendChild(sectionContent);
      return sectionDiv;
    }


    if(cpuDebugDiv) {

      // Clear the cpu Debug Div
      // https://stackoverflow.com/questions/3955229/remove-all-child-elements-of-a-dom-node-in-javascript
      while (cpuDebugDiv.firstChild) {
          cpuDebugDiv.removeChild(cpuDebugDiv.firstChild);
      }

      const sections = [];

      // CPU
      sections.push(createSectionWithText('Register A', this.wasmInstance.exports.getRegisterA()));
      sections.push(createSectionWithText('Register B', this.wasmInstance.exports.getRegisterB()));
      sections.push(createSectionWithText('Register C', this.wasmInstance.exports.getRegisterC()));
      sections.push(createSectionWithText('Register D', this.wasmInstance.exports.getRegisterD()));
      sections.push(createSectionWithText('Register E', this.wasmInstance.exports.getRegisterE()));
      sections.push(createSectionWithText('Register H', this.wasmInstance.exports.getRegisterH()));
      sections.push(createSectionWithText('Register L', this.wasmInstance.exports.getRegisterL()));
      sections.push(createSectionWithText('Register F', this.wasmInstance.exports.getRegisterF()));
      sections.push(createSectionWithText('Program Counter', this.wasmInstance.exports.getProgramCounter()));
      sections.push(createSectionWithText('Stack pointer', this.wasmInstance.exports.getStackPointer()));

      sections.forEach((section) => {
        cpuDebugDiv.appendChild(section);
      });
    }

    if(ppuDebugDiv) {

      // Clear the cpu Debug Div
      // https://stackoverflow.com/questions/3955229/remove-all-child-elements-of-a-dom-node-in-javascript
      while (ppuDebugDiv.firstChild) {
          ppuDebugDiv.removeChild(ppuDebugDiv.firstChild);
      }

      const sections = [];

      // PPU
      sections.push(createSectionWithText('scanlineRegister', this.wasmByteMemory[0xFF44]));
      sections.push(createSectionWithText('LCD Status', this.wasmByteMemory[0xFF41]));
      sections.push(createSectionWithText('LCD Control', this.wasmByteMemory[0xFF40]));
      sections.push(createSectionWithText('Scroll X', this.wasmByteMemory[0xFF43]));
      sections.push(createSectionWithText('Scroll Y', this.wasmByteMemory[0xFF42]));
      sections.push(createSectionWithText('Window X', this.wasmByteMemory[0xFF4B]));
      sections.push(createSectionWithText('Window Y', this.wasmByteMemory[0xFF4A]));

      sections.forEach((section) => {
        ppuDebugDiv.appendChild(section);
      });
    }

  }
}

export const WasmBoyService = new WasmBoy();
