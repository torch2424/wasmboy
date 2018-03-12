import fetch from 'unfetch'
import Promise from 'promise-polyfill';
import wasmModule from '../dist/wasm/index.untouched.wasm';
import { WasmBoyGraphics } from './graphics/graphics';
import { WasmBoyAudio } from './audio/audio';
import { WasmBoyController } from './controller/controller';
import { WasmBoyMemory } from './memory/memory';

// Constant to define wasm memory size on instantiation
const WASMBOY_MEMORY_SIZE = 0x87FFFF;

class WasmBoyLib {

  // Start the request to our wasm module
  constructor() {
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.headless = false;
    this.canvasElement = undefined;
    this.emulationSyncPromise = undefined;
    this.paused = false;
    this.ready = false;

    // Options
    // TODO: Allow setting this on/off
    this.isAudioEnabled = false;

    // Test properties
    this.frameSkip = 0;

    // TODO: Remove this debug code
    this.logRequest = false;
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

    this._emulationLoop();
  }

  // Function to pause the game, returns a promise
  // Will try to wait until the emulation sync is returned, and then will
  // Allow any actions
  pauseGame() {
    this.paused = true;
    if (this.emulationSyncPromise) {
      return new Promise((resolve) => {
        this.emulationSyncPromise.then(() => {
          this.emulationSyncPromise = undefined;
          resolve();
        });
      });
    }
    return Promise.resolve();
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

  // Loop performed to keep the emulator continuosly running
  _emulationLoop() {
    // Offload as much of this as possible to WASM
    // Feeding wasm bytes is probably going to slow things down, would be nice to just place the game in wasm memory
    // And read from there

    // Update (Execute a frame)
    let response = this.wasmInstance.exports.update();
    // Allow skipping render and animation frame steps to skip frames.
    // Useful for speeding up tests
    if (this.frameSkip) {
      for (let i = 0; i < this.frameSkip; i++) {
        response = this.wasmInstance.exports.update();
      }
    }

    // Handle our uodate() response
    // See: wasm/cpu/opcodes update() function
    // 1 = render a frame
    // 2 = play audio buffer
    // 3 = replace boot rom
    if(response > 0) {

      // The emulation loop will be synced by this.emulationSyncPromise
      // For instance, Graphics will sync by 60fps using requestAnimationFrame()
      // Audio will sync by much time we need to wait for samples to play
      // Defaults to a simple setTimeout() for headless usage
      if (!this.headless) {

        // Check the response
        if (response === 1) {
          // Render the display

          if(!this.isAudioEnabled) {
            this.emulationSyncPromise = WasmBoyGraphics.renderFrame();
          } else {
            WasmBoyGraphics.renderFrame();
          }
        } else if (response === 2) {
          if(this.isAudioEnabled) {
            // Play the audio
            this.emulationSyncPromise = WasmBoyAudio.playAudio();
          } else {
            this.wasmInstance.exports.resetAudioQueue();
          }
        } else if (response > 3) {
          // TODO: Boot rom handling
          console.log('Unhandled response from update():', response);
        }

        // Get the controller state, and pass to wasm
        // NOTE: Sets the joypad state on the wasm instance for us
        WasmBoyController.updateController();
      }

      // Run another emulation loop
      if (this.emulationSyncPromise) {
        // Wait until the sync promise, and then clear it
        this.emulationSyncPromise.then(() => {
          if(!this.paused) {
            this.emulationSyncPromise = undefined;
            this._emulationLoop();
          }
        });
      } else {
        // Default to a set timeout, to not block the event loop
        setTimeout(() => {
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
  // This allow will re-load the wasm module, that way we can obtain a new wasm instance
  // For each time we load a game
  _getWasmInstance() {
    return new Promise((resolve, reject) => {

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
