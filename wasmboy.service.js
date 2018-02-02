import fetch from 'unfetch'
import Promise from 'promise-polyfill';

// TODO: Handle rejects

export class Wasmboy {

  // Start the request to our wasm module
  constructor() {
    this.wasmModuleRequest = fetch('dist/wasm/index.untouched.wasm')
    .then(response => response.arrayBuffer());
    this._maxCycles = 69905;
    this._currentCycles = 0;
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.gameBytes = undefined;
    this.debugSpeed = 1000;
    this.decodeTimeout = undefined;
  }

  // Finish request for wasm module, and fetch game
  loadGame(pathToGame) {
    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/
    return new Promise((resolve, reject) => {
      // Vaguely trying an IFFIE Pattern and diving our instance, and game fetch
      Promise.all([
        this._getWasmInstance(),
        this._fetchGameAsByteArray(pathToGame)
      ]).then((responses) => {
        // Responses already bound to this, simple resolve parent paromise
        resolve();
      })
    });
  }

  // Function to start the game
  startGame() {

    this.wasmInstance.exports.initialize();
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
        if(numberOfCycles) {
          this._currentCycles += numberOfCycles;
          // Timers (Handled by Wasm)
          // graphics
          // Do Intterupts
        } else {
          error = true;
        }
      }

      console.log('TODO: RENDER CANVAS!');
      this._debug();
      //requestAnimationFrame(emulationLoop);
    }
    requestAnimationFrame(emulationLoop);
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
          // Gameboy has a memory size of 65536
          if (memory.buffer.byteLength < 65536) {
            console.log('Growing memory...');
            memory.grow(1);
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
        console.log('Opcode array: ', byteArray);
        this.gameBytes = byteArray;
        resolve(this.gameBytes);
      });
    });
  }

  _executeOpcode() {
    // Get our opcode
    // opcodes are at most 3 bytes: https://gbatemp.net/threads/what-size-are-gameboy-opcodes.467282/
    // Therefore, we will pass all 3 bytes, and then the the wasm module should be able to do what it needs, wether or Not
    // it needs all 3
    const opcode = this.gameBytes[this.wasmInstance.exports.getProgramCounter()];
    const dataByteOne = this.gameBytes[this.wasmInstance.exports.getProgramCounter() + 1];
    const dataByteTwo = this.gameBytes[this.wasmInstance.exports.getProgramCounter() + 2];

    if(opcode === undefined) {
      console.log('ERROR! No Opcode found at programCounter position');
      return false;
    }

    // Returns the program counter position for next instruction to be fetched
    const numberOfCycles = this.wasmInstance.exports.handleOpcode(
      opcode,
      dataByteOne,
      dataByteTwo
    );

    // Function will return < 0 if the opcode was not recognized
    if (numberOfCycles < 0x0000) {
      console.log('Error! Opcode not recognized');
      return false;
    }

    return numberOfCycles;
  }

  // Private funciton to debug wasm
  _debug(opcodeMessage) {
    // Print out all of our info
    const cpuDebugDiv = document.getElementById('cpu-debug-info');
    if(cpuDebugDiv) {
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

      // Clear the cpu Debug Div
      // https://stackoverflow.com/questions/3955229/remove-all-child-elements-of-a-dom-node-in-javascript
      while (cpuDebugDiv.firstChild) {
          cpuDebugDiv.removeChild(cpuDebugDiv.firstChild);
      }

      // Try to get our decode speed
      const cpuSpeedSlider = document.getElementById('cpu-debug-speed');
      if(cpuSpeedSlider) {
        this.debugSpeed = cpuSpeedSlider.value;
      }

      const sections = [];
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

      console.log('Memory Changes: ', memChanges);
      console.log('Current Memory: ', this.wasmByteMemory);

      sections.forEach((section) => {
        cpuDebugDiv.appendChild(section);
      });
    }
  }
}
