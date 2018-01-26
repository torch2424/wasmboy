import fetch from 'unfetch'
import Promise from 'promise-polyfill';

// TODO: Handle rejects

export class Wasmboy {

  // Start the request to our wasm module
  constructor() {
    this.wasmModuleRequest = fetch('dist/wasm/index.untouched.wasm')
    .then(response => response.arrayBuffer());
    this.wasmInstance = undefined;
    this.gameBytes = undefined;
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
    // https://gist.github.com/scottferg/3886608
    // Every gameboy cartridge has an offset of 0x134


    // Loop through the op codes as the program couunter states
    // Program Counter always starts at 0x0000
    let localProgramCounterPosition = 0x0000;

    const decodeLoop = () => {
      // Get our opcode
      // opcodes are at most 3 bytes: https://gbatemp.net/threads/what-size-are-gameboy-opcodes.467282/
      // Therefore, we will pass all 3 bytes, and then the the wasm module should be able to do what it needs, wether or Not
      // it needs all 3
      const opcode = this.gameBytes[localProgramCounterPosition];
      const dataByteOne = this.gameBytes[localProgramCounterPosition + 1];
      const dataByteTwo = this.gameBytes[localProgramCounterPosition + 2];

      if(!opcode) {
        console.log('No Opcode found at programCounter position');
        return;
      }

      console.log(
        'Decoding Opcode: ',
        opcode.toString(16),
        dataByteOne.toString(16),
        dataByteTwo.toString(16)
      );

      // Returns the program counter position for next instruction to be fetched
      const nextProgramCounterPosition = this.wasmInstance.exports.handleOpcode(
        opcode,
        dataByteOne,
        dataByteTwo
      );

      // Function will return < 0 if the opcode was not recognized
      if (nextProgramCounterPosition < 0x0000) {
        console.log('Error! Opcode not recognized');
      } else {
        console.log('Fetching next opcode at position: ', nextProgramCounterPosition);
        localProgramCounterPosition = nextProgramCounterPosition
        requestAnimationFrame(decodeLoop);
      }
    }
    requestAnimationFrame(decodeLoop);
  }

  // Private funciton to returna promise to our wasmModule
  _getWasmInstance() {
    return new Promise((resolve, reject) => {

      if (this.wasmInstance) {
        resolve(this.wasmInstance);
      }

      // Get our wasm instance from our request
      this.wasmInstance = this.wasmModuleRequest.then((binary) => {

        // Log we got the wasm module loaded
        console.log('wasmboy wasm instantiated');

        // Create the wasm module, and get it's instance
        const module = new WebAssembly.Module(binary);
        const instance = new WebAssembly.Instance(module, {});

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
        resolve(this.wasmInstance);
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
}
