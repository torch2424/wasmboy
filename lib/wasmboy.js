import fetch from 'unfetch'
import Promise from 'promise-polyfill';
import wasmModule from '../dist/wasm/index.untouched.wasm';
import { WasmBoyGraphics } from './graphics/graphics';
import { WasmBoyAudio } from './audio/audio';
import { WasmBoyController } from './controller/controller';
import { WasmBoyMemory } from './memory/memory';

// requestAnimationFrame() for headless mode
const raf = require('raf');

// Function to get performance timestamp
// This is to support node vs. Browser
const getPerformanceTimestamp = () => {
  if (typeof window !== 'undefined') {
    return performance.now();
  }
  return Date.now();
}

class WasmBoyLib {

  // Start the request to our wasm module
  constructor() {
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.canvasElement = undefined;
    this.paused = false;
    this.pauseFpsThrottle = false;
    this.ready = false;
    this.renderId = false;
    this.updateId = false;

    // Options, can't be undefined
    this.headless = false;
    this.isGbcEnabled = true;
    this.isAudioEnabled = true;
    this.gameboyFrameRate = 60;
    this.gameboyFpsCap = 60;
    this.fpsTimeStamps = [];
    this.frameSkip = 0;
    this.frameSkipCounter = 0;

    // Options for wasm
    this.audioBatchProcessing = false;
    this.graphicsBatchProcessing = false;
    this.timersBatchProcessing = false;
    this.graphicsDisableScanlineRendering = false;
    this.audioAccumulateSamples = false;

    // Debug code
    this.logRequest = false;
    this.performanceTimestamps = {};
  }

  // Function to initialize our Wasmboy
  initialize(canvasElement, wasmBoyOptions) {

    // Get our canvas elements
    this.canvasElement = canvasElement;

    // Set our defaults
    this.headless = false;
    this.isAudioEnabled = true;
    this.gameboyFrameRate = 60;
    this.gameboyFpsCap = 60;
    this.fpsTimeStamps = [];
    this.frameSkip = 0;
    this.frameSkipCounter = 0;

    // Defaults for wasm
    this.audioBatchProcessing = false;
    this.graphicsBatchProcessing = false;
    this.timersBatchProcessing = false;
    this.graphicsDisableScanlineRendering = false;
    this.audioAccumulateSamples = false;


    // set our options
    if(wasmBoyOptions) {

      // Set all options
      Object.keys(wasmBoyOptions).forEach((key) => {
        if (this[key] !== undefined) {
          this[key] = wasmBoyOptions[key];
        }
      });

      // Aliases
      // Gameboy Speed / Framerate
      if(wasmBoyOptions.gameboySpeed) {
        let gameboyFrameRate = Math.floor(wasmBoyOptions.gameboySpeed * 60);
        if(gameboyFrameRate <= 0) {
          gameboyFrameRate = 1;
        }
        this.gameboyFrameRate = gameboyFrameRate;
        this.gameboyFpsCap = gameboyFrameRate;
      }

      // Check some conflicting variables
      if (this.gameboyFrameRate > this.gameboyFpsCap) {
        this.gameboyFrameRate = this.gameboyFpsCap
      }
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
            WasmBoyMemory.resetState();

            // TODO: Handle passing a boot rom
            WasmBoyMemory.loadCartridgeRom(responses[0], false, false);
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
              WasmBoyMemory.resetState();


              // TODO: Handle passing a boot rom
              WasmBoyMemory.loadCartridgeRom(responses[0], this.isGbcEnabled, false);

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

  // Function to reset wasmBoy, with an optional set of options
  reset(wasmBoyOptions) {
    this.initialize(this.canvasElement, wasmBoyOptions);
    WasmBoyMemory.resetState();
    if (this.wasmInstance) {
      // Run our initialization on the core
      this.wasmInstance.exports.config(
        this.audioBatchProcessing ? 1 : 0,
        this.graphicsBatchProcessing ? 1 : 0,
        this.timersBatchProcessing ? 1 : 0,
        this.graphicsDisableScanlineRendering ? 1 : 0,
        this.audioAccumulateSamples ? 1 : 0
      );
    }
  }

  // Function to start the game
  startGame() {
    return this.resumeGame();
  }

  resumeGame() {
    if (!this.ready) {
      return false;
    }

    // Reset the audio queue index to stop weird pauses when trying to load a game
    this.wasmInstance.exports.resetAudioQueue();

    // Start our update and render process
    // Can't time by raf, as raf is not garunteed to be 60fps
    // Need to run like a web game, where updates to the state of the core are done a 60 fps
    // but we can render whenever the user would actually see the changes browser side in a raf
    // https://developer.mozilla.org/en-US/docs/Games/Anatomy
    this._emulatorUpdate();

    // Undo any pause
    this.paused = false;

    if(!this.updateId) {

      const intervalRate = 1000 / this.gameboyFrameRate;

      // Reset the frameTimeStamps
      this.fpsTimeStamps = [];

      // 1000 / 60 = 60fps
      this.updateId = setInterval(() => {
        this._emulatorUpdate();
      }, intervalRate);
    }

    if(!this.renderId && !this.headless) {
      this.renderId = raf(() => {
        this._emulatorRender();
      });
    }

    // Finally set up out pause fps throttle
    // This will allow us to know if we just un paused
    this.pauseFpsThrottle = true;
    setTimeout(() => {
      this.pauseFpsThrottle = false;
    }, 3000);
  }

  // Function to pause the game, returns a promise
  // Will try to wait until the emulation sync is returned, and then will
  // Allow any actions
  pauseGame() {
    this.paused = true;

    // Cancel our update and render loop
    raf.cancel(this.renderId);
    this.renderId = false;
    clearInterval(this.updateId);
    this.updateId = false;

    // Wait a raf to ensure everything is done
    return new Promise((resolve) => {
      raf(() => {
        resolve();
      });
    });
  }

  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  getFps() {
    if(this.pauseFpsThrottle) {
      return this.gameboyFpsCap;
    }
    return this.fpsTimeStamps.length;
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

    // Don't run if paused
    if (this.paused) {
      return true;
    }

    // Track our Fps
    // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
    let currentHighResTime = getPerformanceTimestamp();
    while (this.fpsTimeStamps[0] < currentHighResTime - 1000) {
      this.fpsTimeStamps.shift();
    }

    // Framecap at 60fps
    const currentFps = this.getFps();
    if (currentFps > this.gameboyFpsCap) {
      return true;
    } else {
      this.fpsTimeStamps.push(currentHighResTime);
    }

    // If audio is enabled, sync by audio
    // Check how many samples we have, and if we are getting too ahead, need to skip the update
    // Magic number is from experimenting and this seems to go good
    // TODO: Make this a preference, or calculate from perfrmance.now()
    // TODO Make audio que ocnstant in wasmboy audio, and make itr a function to be callsed in wasmboy audiio
    if(!this.headless &&
      !this.pauseFpsThrottle &&
      this.isAudioEnabled &&
      this.wasmInstance.exports.getAudioQueueIndex() > (9000 * (this.gameboyFpsCap / 60)) &&
      this.gameboyFpsCap <= 60) {
      // TODO: Waiting for time stretching to resolve may be causing this
      return true;
    }

    // Update (Execute a frame)
    let response = this.wasmInstance.exports.update();

    // Handle our update() response
    if(response > 0) {
      // See: wasm/cpu/opcodes update() function
      // 1 = render a frame
      // 2 = replace boot rom
      // TODO: Find what should go here
      switch(response) {
        case 1:
        case 2:
          break;
      }

      return true;
    } else {
      console.log('Wasmboy Crashed!');
      console.log(`Program Counter: 0x${this.wasmInstance.exports.getProgramCounter().toString(16)}`)
      console.log(`Opcode: 0x${this.wasmByteMemory[this.wasmInstance.exports.getProgramCounter()].toString(16)}`);
      this.pauseGame();
      return false;
    }
  }

  // Function to render our emulator output
  _emulatorRender() {

      // Don't run if paused
      if (this.paused) {
        return true;
      }

      // Check if we have frameskip
      let shouldSkipRenderingFrame = false;
      if (this.frameSkip && this.frameSkip > 0) {
        this.frameSkipCounter++;

        if (this.frameSkipCounter < this.frameSkip) {
          shouldSkipRenderingFrame = true;
        } else {
          this.frameSkipCounter = 0;
        }
      }

      // Render the display
      if(!shouldSkipRenderingFrame) {
        WasmBoyGraphics.renderFrame();
      }

      // Play the audio
      if(this.isAudioEnabled) {
        WasmBoyAudio.playAudio(this.getFps(), this.gameboyFpsCap > 60);
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
            if (arg0 !== -9999) str = str.replace("$0", arg0);
            if (arg1 !== -9999) str = str.replace("$1", arg1);
            if (arg2 !== -9999) str = str.replace("$2", arg2);
            if (arg3 !== -9999) str = str.replace("$3", arg3);
            if (arg4 !== -9999) str = str.replace("$4", arg4);
            if (arg5 !== -9999) str = str.replace("$5", arg5);

            console.log("[WasmBoy] " + str);
          },
          hexLog: (arg0, arg1, arg2, arg3, arg4, arg5) => {

            if(!this.logRequest) {

              // Grab our arguments, and log as hex
              let logString = '[WasmBoy]';
              if (arg0 !== -9999) logString += ` 0x${arg0.toString(16)} `;
              if (arg1 !== -9999) logString += ` 0x${arg1.toString(16)} `;
              if (arg2 !== -9999) logString += ` 0x${arg2.toString(16)} `;
              if (arg3 !== -9999) logString += ` 0x${arg3.toString(16)} `;
              if (arg4 !== -9999) logString += ` 0x${arg4.toString(16)} `;
              if (arg5 !== -9999) logString += ` 0x${arg5.toString(16)} `;

              // Uncomment to unthrottle
              //console.log(logString);

              // Comment the lines below to disable throttle
              this.logRequest = true;
              setTimeout(() => {
                console.log(logString);
                this.logRequest = false;
              }, Math.floor(Math.random() * 500));


            }
          },
          performanceTimestamp: (id, value) => {

            if(id === -9999) {
              id = 0;
            }

            if (value === -9999) {
              value = 0;
            }

            if(!this.performanceTimestamps[id]) {
              this.performanceTimestamps[id] = {};
              this.performanceTimestamps[id].throttle = false;
              this.performanceTimestamps[id].totalTime = 0;
              this.performanceTimestamps[id].value = 0;
            }
            if(!this.performanceTimestamps[id].throttle) {
              if (this.performanceTimestamps[id].timestamp) {
                // sleep a millisecond for hopefully more accurate times
                let endTime = getPerformanceTimestamp();
                let timeDifference = endTime - this.performanceTimestamps[id].timestamp;
                this.performanceTimestamps[id].throttle = true;
                this.performanceTimestamps[id].totalTime += timeDifference;
                console.log(`[WasmBoy] Performance Timestamp. ID: ${id}, Time: ${timeDifference}, value difference: ${value - this.performanceTimestamps[id].value}, total time: ${this.performanceTimestamps[id].totalTime}`);
                this.performanceTimestamps[id].timestamp = false;
                setTimeout(() => {
                  this.performanceTimestamps[id].throttle = false;
                }, 100)
              } else {
                this.performanceTimestamps[id].timestamp = getPerformanceTimestamp();
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

        // NOTE: Memory growing is now done in the wasm itself
        // Grow memory to wasmboy memory map
        // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
        // if (memory.buffer.byteLength < this.wasmInstance.exports.wasmMemorySize) {
        //   // Scale to the maximum needed pages
        //   memory.grow(Math.ceil(this.wasmInstance.exports.wasmMemorySize / 1024 / 64));
        // }

        // Will stay in sync
        this.wasmByteMemory = new Uint8Array(this.wasmInstance.exports.memory.buffer);

        // Run our initialization on the core
        this.wasmInstance.exports.config(
          this.audioBatchProcessing ? 1 : 0,
          this.graphicsBatchProcessing ? 1 : 0,
          this.timersBatchProcessing ? 1 : 0,
          this.graphicsDisableScanlineRendering ? 1 : 0,
          this.audioAccumulateSamples ? 1 : 0
        );
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
