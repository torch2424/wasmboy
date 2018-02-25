import fetch from 'unfetch'
import Promise from 'promise-polyfill';
import wasmModule from '../dist/wasm/index.untouched.wasm';
import { WasmBoyGraphics } from './wasmboyGraphics';
import { WasmBoyAudio } from './wasmboyAudio';
import { WasmBoyController } from './wasmboyController';

// Polyfill for raf for testing in node, defaults to builtin window.requestAnimationFrame
const raf = require('raf');

class WasmBoyLib {

  // Start the request to our wasm module
  constructor() {
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.gameBytes = undefined;
    this.headless = false;
    this.canvasElement = undefined;
    this.paused = false;
    this.ready = false;

    // TODO: Remove this debug code
    this.logRequest = false;
  }

  // Function to initialize our Wasmboy
  initialize(canvasElement) {
    this.canvasElement = canvasElement;
  }

  // Function to intialize WasmBoy For Headless
  initializeHeadless() {
    this.headless = true;
  }

  // Finish request for wasm module, and fetch game
  loadGame(game) {
    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/
    this.ready = false;
    return new Promise((resolve, reject) => {

      // Get our promises
      const initPromises = [
        this._fetchGameAsByteArray(game)
      ];
      if(!this.wasmInstance) {
        initPromises.push(this._getWasmInstance());
      }

      Promise.all(initPromises).then((responses) => {

        // Pause the game in case it was running, and set to not ready
        this.pauseGame();
        this.ready = false;

        // raf to ensure the game is not running while we paused
        raf(() => {
          // Responses already bound to this, simple resolve parent promise
          // Set our gamebytes
          this.gameBytes = responses[0];

          // Clear Wasm memory
          // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
          for(let i = 0; i <= this.wasmByteMemory.length; i++) {
            this.wasmByteMemory[i] = 0;
          }

          // Load the game data into actual memory
          // In our wasmboy memory map, game data starts at:
          // 0x043400
          for(let i = 0; i < this.gameBytes.length; i++) {
            if (this.gameBytes[i]) {
              this.wasmByteMemory[0x043400 + i] = this.gameBytes[i];
            }
          }

          // TODO: Pass in if we are using the boot rom
          this.wasmInstance.exports.initialize(0);

          // Check if we are running headless
          if(this.headless) {
            this.ready = true;
            resolve();
          } else {
            // Finally intialize all of our services
            // Initialize our services
            Promise.all([
              WasmBoyGraphics.initialize(this.canvasElement, this.wasmInstance, this.wasmByteMemory),
              WasmBoyAudio.initialize(this.wasmInstance, this.wasmByteMemory),
              WasmBoyController.initialize(this.wasmInstance)
            ]).then(() => {
              this.ready = true;
              resolve();
            }).catch((error) => {
              reject(error);
            });
          }
        });
      }).catch((error) => {
        reject(error);
      });
    });
  }

  // Function to start the game
  startGame() {
    return this.resumeGame();
  }

  resumeGame() {
    if (!this.ready) {
      return false;
    }

    // Un-pause the game
    this.paused = false;

    raf(() => {
      this._emulationLoop();
    });
  }

  pauseGame() {
    this.paused = true;
  }

  // Loop performed to keep the emulator continuosly running
  _emulationLoop() {
    // Offload as much of this as possible to WASM
    // Feeding wasm bytes is probably going to slow things down, would be nice to just place the game in wasm memory
    // And read from there

    // Update (Execute a frame)
    const response = this.wasmInstance.exports.update();

    if(response > 0) {

      if (!this.headless) {
        // Play the audio
        WasmBoyAudio.playAudio();

        // Render the display
        WasmBoyGraphics.renderFrame();

        // Get the controller state, and pass to wasm
        // NOTE: Sets the joypad state on the wasm instance for us
        WasmBoyController.updateController();
      }

      // Run another frame
      if(!this.paused) {

        raf(() => {
            this._emulationLoop();
        });
      }
      return true;
    } else {
      console.log('Wasmboy Crashed!');
        console.log(`Program Counter: 0x${this.wasmInstance.exports.getProgramCounter().toString(16)}`)
        console.log(`Opcode: 0x${this.wasmByteMemory[this.wasmInstance.exports.getProgramCounter()].toString(16)}`);
    }
  }

  // Private funciton to returna promise to our wasmModule
  _getWasmInstance() {
    return new Promise((resolve, reject) => {

      if (this.wasmInstance) {
        resolve(this.wasmInstance);
      }



      // Get our wasm instance from our wasmModule
      wasmModule({
        env: {
          log: (message, numArgs, arg0, arg1, arg2, arg3, arg4, arg5) => {
            // Grab our string
            var len = new Uint32Array(this.wasmInstance.exports.memory.buffer, message, 1)[0];
            var str = String.fromCharCode.apply(null, new Uint16Array(this.wasmInstance.exports.memory.buffer, message + 4, len));
            if (numArgs > 0) str = str.replace("$0", arg0);
            if (numArgs > 1) str = str.replace("$1", arg1);
            if (numArgs > 2) str = str.replace("$2", arg2);
            if (numArgs > 3) str = str.replace("$3", arg3);
            if (numArgs > 4) str = str.replace("$4", arg4);
            if (numArgs > 5) str = str.replace("$5", arg5);

            // Log the string if no throttle
            console.log("[WasmBoy] " + str);
          },
          hexLog: (numArgs, arg0, arg1, arg2, arg3, arg4, arg5) => {

            if(!this.logRequest) {

              // Comment this line to disable throttle
              this.logRequest = true;

              // Grab our arguments, and log as hex
              let logString = '[WasmBoy]';
              if (numArgs > 0) logString += ` 0x${arg0.toString(16)} `;
              if (numArgs > 1) logString += ` 0x${arg1.toString(16)} `;
              if (numArgs > 2) logString += ` 0x${arg2.toString(16)} `;
              if (numArgs > 3) logString += ` 0x${arg3.toString(16)} `;
              if (numArgs > 4) logString += ` 0x${arg4.toString(16)} `;
              if (numArgs > 5) logString += ` 0x${arg5.toString(16)} `;

              setTimeout(() => {
                console.log(logString);
                this.logRequest = false;
              }, 250);
            }
          }
        }
      }).then((instantiatedWasm) => {
        // Using || since rollup and webpack wasm loaders will return differently
        const instance = this.wasmInstance = instantiatedWasm.instance || instantiatedWasm;
        const module = instantiatedWasm.module;

        // Get our memory from our wasm instance
        const memory = instance.exports.memory;

        // Grow memory to wasmboy memory map
        // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
        // TODO: Scale Memory as needed
        if (memory.buffer.byteLength < 0x86FFFF) {
          memory.grow(135);
        }

        // Will stay in sync
        this.wasmByteMemory = new Uint8Array(this.wasmInstance.exports.memory.buffer);

        resolve(this.wasmInstance);

      });
    });
  }

  // Private function to fetch a game
  _fetchGameAsByteArray(game) {
    return new Promise((resolve, reject) => {
      if (ArrayBuffer.isView(game)) {
        // Simply resolve with the input
        resolve(game);
        return;
      } else if (typeof game === 'object' && game.size) {
        // Read the file object
        // https://www.javascripture.com/FileReader#readAsArrayBuffer_Blob
        const fileReader = new FileReader();
        fileReader.onload = () => {
          const byteArray = new Uint8Array(fileReader.result);
          resolve(byteArray);
        }
        fileReader.readAsArrayBuffer(game);
      } else {
        // Fetch the file
        fetch(game)
        .then(blob => {
          return blob.arrayBuffer();
        }).then(bytes => {
          const byteArray = new Uint8Array(bytes);
          resolve(byteArray);
        });
      }
    });
  }
}

export const WasmBoy = new WasmBoyLib();
export { WasmBoyAudio } from './wasmboyAudio';
export { WasmBoyGraphics } from './wasmboyGraphics';
