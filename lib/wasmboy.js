import fetch from 'unfetch'
import Promise from 'promise-polyfill';
import wasmModule from '../dist/wasm/index.untouched.wasm';
import { WasmBoyGraphics } from './graphics/graphics';
import { WasmBoyAudio } from './audio/audio';
import { WasmBoyController } from './controller/controller';
import { WasmBoyMemory } from './memory/memory';

// requestAnimationFrame() for headless mode
const raf = require('raf');

// Constant to define wasm memory size on instantiation
const WASMBOY_MEMORY_SIZE = 0x87FFFF;

class WasmBoyLib {

  // Start the request to our wasm module
  constructor() {
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.headless = false;
    this.canvasElement = undefined;
    this.paused = false;
    this.ready = false;
    this.renderId = false;
    this.updateId = false;

    // Options
    // TODO: Allow setting this on/off
    this.isAudioEnabled = true;

    // Test properties
    this.frameSkip = 0;

    // TODO: Remove this debug code
    this.logRequest = false;
    this.performanceTimestamps = {};
  }

  // Function to initialize our Wasmboy
  initialize(canvasElement) {
    this.headless = false;
    this.canvasElement = canvasElement;
    this.frameSkip = 0;
  }

  // Function to intialize WasmBoy For Headless
  // TODO: Allow passing a speed for how many frames to render per second
  // Will hopefully speed up testing
  initializeHeadless(frameSkip) {
    this.headless = true;
    if (frameSkip) {
      this.frameSkip = frameSkip;
    }
  }

  // Finish request for wasm module, and fetch game
  loadGame(game) {
    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/
    this.ready = false;
    return new Promise((resolve, reject) => {

      // Pause the game in case it was running
      this.pauseGame().then(() => {
        // Get our promises
        const initPromises = [
          this._fetchGameAsByteArray(game),
          this._getWasmInstance()
        ];

        if (!this.headless && WasmBoyMemory.getLoadedCartridgeMemoryState().RAM) {
          initPromises.push(WasmBoyMemory.saveCartridgeRam());
        }

        Promise.all(initPromises).then((responses) => {

          // Check if we are running headless
          if(this.headless) {
            WasmBoyMemory.initializeHeadless(this.wasmInstance, this.wasmByteMemory);
            // Clear what is currently in memory, then load the cartridge memory
            WasmBoyMemory.clearMemory();

            // TODO: Handle passing a boot rom
            WasmBoyMemory.loadCartridgeRom(responses[0], false);
            this.ready = true;

            resolve();
          } else {
            // Finally intialize all of our services
            // Initialize our services
            Promise.all([
              WasmBoyGraphics.initialize(this.canvasElement, this.wasmInstance, this.wasmByteMemory),
              WasmBoyAudio.initialize(this.wasmInstance, this.wasmByteMemory),
              WasmBoyController.initialize(this.wasmInstance),
              WasmBoyMemory.initialize(this.wasmInstance, this.wasmByteMemory)
            ]).then(() => {

              // Clear what is currently in memory, then load the carttridge memory
              WasmBoyMemory.clearMemory();


              // TODO: Handle passing a boot rom
              WasmBoyMemory.loadCartridgeRom(responses[0], false);

              // Load the game's cartridge ram
              WasmBoyMemory.loadCartridgeRam().then(() => {
                this.ready = true;
                resolve();
              }).catch((error) => {
                reject(error);
              });
            }).catch((error) => {
              reject(error);
            });
          }
        }).catch((error) => {
          reject(error);
        });
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

    // Start our update and render process
    this._emulatorUpdate();
    this.updateId = setInterval(() => {
      this._emulatorUpdate();
    }, 1000 / 60);
    this.renderId = raf(() => {
      this._emulatorRender();
    });
  }

  // Function to pause the game, returns a promise
  // Will try to wait until the emulation sync is returned, and then will
  // Allow any actions
  pauseGame() {
    this.paused = true;
    raf.cancel(this.currentAnimationFrame);
    return new Promise((resolve) => {
      setTimeout(() => {
        // Timeout after
        resolve();
      }, 100);
    });
  }

  // Function to return the current game object in memory
  getWasmBoyMemoryForLoadedGame() {
    return WasmBoyMemory.getCartridgeObject();
  }

  saveState() {
    // Pause the game in case it was running
    this.pauseGame().then(() => {
      // Save our state to wasmMemory
      WasmBoyMemory.saveState().then(() => {
        this.resumeGame();
      });
    });
  }

  loadState() {
    // Pause the game in case it was running, and set to not ready
    this.pauseGame().then(() => {
      WasmBoyMemory.loadState().then(() => {
        this.resumeGame();
      });
    });
  }

  // Function to run an update on the emulator itself
  _emulatorUpdate() {
    // Update (Execute a frame)
    let response = this.wasmInstance.exports.update();

    // Reset the audio queue if we are headless
    if(this.headless) {
      this.wasmInstance.exports.resetAudioQueue();
    }

    // Handle our update() response
    if(response > 0) {
      // See: wasm/cpu/opcodes update() function
      // 1 = render a frame
      // 2 = replace boot rom
      // TODO: Find what should go here
      switch(response) {
        case 1:
        case 2:
        case 3:
          break;
      }
      return true;
    } else {
      console.log('Wasmboy Crashed!');
      console.log(`Program Counter: 0x${this.wasmInstance.exports.getProgramCounter().toString(16)}`)
      console.log(`Opcode: 0x${this.wasmByteMemory[this.wasmInstance.exports.getProgramCounter()].toString(16)}`);
      return false;
    }
  }

  // Function to render our emulator output
  _emulatorRender() {
      // Render the display
      WasmBoyGraphics.renderFrame();

      // Play the audio
      if(this.isAudioEnabled) {
        WasmBoyAudio.playAudio();
      } else {
        this.wasmInstance.exports.resetAudioQueue();
      }

      // Update our controller
      WasmBoyController.updateController();

      this.renderId = raf(() => {
        this._emulatorRender();
      });
  }

  // Private funciton to returna promise to our wasmModule
  // This allow will re-load the wasm module, that way we can obtain a new wasm instance
  // For each time we load a game
  _getWasmInstance() {
    return new Promise((resolve, reject) => {

      // Get our wasm instance from our wasmModule
      const memoryBase =
      wasmModule({
        env: {
          log: (message, arg0, arg1, arg2, arg3, arg4, arg5) => {
            // Grab our string
            var len = new Uint32Array(this.wasmInstance.exports.memory.buffer, message, 1)[0];
            var str = String.fromCharCode.apply(null, new Uint16Array(this.wasmInstance.exports.memory.buffer, message + 4, len));
            if (arg0) str = str.replace("$0", arg0);
            if (arg1) str = str.replace("$1", arg1);
            if (arg2) str = str.replace("$2", arg2);
            if (arg3) str = str.replace("$3", arg3);
            if (arg4) str = str.replace("$4", arg4);
            if (arg5) str = str.replace("$5", arg5);

            console.log("[WasmBoy] " + str);
          },
          hexLog: (arg0, arg1, arg2, arg3, arg4, arg5) => {

            if(!this.logRequest) {

              // Comment this line to disable throttle
              this.logRequest = true;

              // Grab our arguments, and log as hex
              let logString = '[WasmBoy]';
              if (arg0) logString += ` 0x${arg0.toString(16)} `;
              if (arg1) logString += ` 0x${arg1.toString(16)} `;
              if (arg2) logString += ` 0x${arg2.toString(16)} `;
              if (arg3) logString += ` 0x${arg3.toString(16)} `;
              if (arg4) logString += ` 0x${arg4.toString(16)} `;
              if (arg5) logString += ` 0x${arg5.toString(16)} `;

              setTimeout(() => {
                console.log(logString);
                this.logRequest = false;
              }, 250);
            }
          },
          performanceTimestamp: (id, value) => {
            if(!this.performanceTimestamps[id]) {
              this.performanceTimestamps[id] = {};
              this.performanceTimestamps[id].throttle = false;
              this.performanceTimestamps[id].totalTime = 0;
              this.performanceTimestamps[id].value = 0;
            }
            if(!this.performanceTimestamps[id].throttle) {
              if (this.performanceTimestamps[id].timestamp) {
                // sleep a millisecond for hopefully more accurate times
                let endTime = performance.now();
                let timeDifference = endTime - this.performanceTimestamps[id].timestamp;
                this.performanceTimestamps[id].throttle = true;
                this.performanceTimestamps[id].totalTime += timeDifference;
                console.log(`[WasmBoy] Performance Timestamp. ID: ${id}, Time: ${timeDifference}, value difference: ${value - this.performanceTimestamps[id].value}, total time: ${this.performanceTimestamps[id].totalTime}`);
                this.performanceTimestamps[id].timestamp = false;
                setTimeout(() => {
                  this.performanceTimestamps[id].throttle = false;
                }, 100)
              } else {
                this.performanceTimestamps[id].timestamp = performance.now();
                this.performanceTimestamps[id].value = value;
              }
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
        // TODO: Scale Memory as needed with Cartridge size
        if (memory.buffer.byteLength < WASMBOY_MEMORY_SIZE) {
          memory.grow(136);
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
      if (ArrayBuffer.isView(game) && game.constructor === Uint8Array) {
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
          if(!blob.ok) {
            return Promise.reject(blob);
          }

          return blob.arrayBuffer();
        }).then(bytes => {
          const byteArray = new Uint8Array(bytes);
          resolve(byteArray);
        }).catch((error) => {
          reject(error);
        });
      }
    });
  }
}

export const WasmBoy = new WasmBoyLib();
export { WasmBoyAudio } from './audio/audio';
export { WasmBoyGraphics } from './graphics/graphics';
export { WasmBoyController } from './controller/controller';
// TODO: Remove this, and consolidate public api in Wasmboy
export { WasmBoyMemory } from './memory/memory';
