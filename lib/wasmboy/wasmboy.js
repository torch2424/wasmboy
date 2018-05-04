// Modules
import fetch from 'unfetch';
import Promise from 'promise-polyfill';

// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyController } from '../controller/controller';
import { WasmBoyMemory } from '../memory/memory';

// Other lib helpers
import { instantiateWasm } from '../wasm/instantiate';
import { fetchROMAsByteArray } from './rom';
import { render } from './render';
import { update } from './update';

// requestAnimationFrame() for headless mode
const raf = require('raf');

// Our Main Orchestrator of the WasmBoy lib
class WasmBoyLibService {
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
    this.loadedROM = false;

    // Reset our config and stateful elements that depend on it
    this._resetConfig();

    // Debug code
    this.logRequest = false;
    this.performanceTimestamps = {};
  }

  // Function to initialize/configure Wasmboy
  config(wasmBoyOptions, canvasElement) {
    // Get our canvas elements
    this.canvasElement = canvasElement;

    // Reset our config and stateful elements that depend on it
    this._resetConfig();

    // set our options
    if (wasmBoyOptions) {
      // Set all options
      Object.keys(wasmBoyOptions).forEach(key => {
        if (this.options[key] !== undefined) {
          this.options[key] = wasmBoyOptions[key];
        }
      });

      // Aliases
      // Gameboy Speed / Framerate
      if (wasmBoyOptions.gameboySpeed) {
        let gameboyFrameRate = Math.floor(wasmBoyOptions.gameboySpeed * 60);
        if (gameboyFrameRate <= 0) {
          gameboyFrameRate = 1;
        }
        this.options.gameboyFrameRate = gameboyFrameRate;
      }
    }

    return Promise.resolve();
  }

  // Function to return our current configuration as an object
  getConfig() {
    return this.options;
  }

  // Finish request for wasm module, and fetch game
  loadROM(ROM, fetchHeaders) {
    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/
    this.ready = false;
    return new Promise((resolve, reject) => {
      // Pause the game in case it was running
      this.pause().then(() => {
        // Get our promises
        const initPromises = [fetchROMAsByteArray(ROM, fetchHeaders), this._instantiateWasm()];

        if (!this.options.headless && WasmBoyMemory.getLoadedCartridgeMemoryState().RAM) {
          initPromises.push(WasmBoyMemory.saveCartridgeRam());
        }

        Promise.all(initPromises)
          .then(responses => {
            // Save the game that we loaded if we need to reload the game
            this.loadedROM = ROM;

            // Check if we are running headless
            if (this.options.headless) {
              WasmBoyMemory.initialize(this.options.headless, this.wasmInstance, this.wasmByteMemory, this.options.saveStateCallback).then(() => {
                // Clear what is currently in memory, then load the cartridge memory
                WasmBoyMemory.clearMemory();
                WasmBoyMemory.resetState();

                // TODO: Handle passing a boot rom
                WasmBoyMemory.loadCartridgeRom(responses[0]);

                // Run our initialization on the core
                this.wasmInstance.exports.config(
                  0, // TODO: Include Boot Rom
                  this.options.isGbcEnabled ? 1 : 0,
                  this.options.audioBatchProcessing ? 1 : 0,
                  this.options.graphicsBatchProcessing ? 1 : 0,
                  this.options.timersBatchProcessing ? 1 : 0,
                  this.options.graphicsDisableScanlineRendering ? 1 : 0,
                  this.options.audioAccumulateSamples ? 1 : 0,
                  this.options.tileRendering ? 1 : 0,
                  this.options.tileCaching ? 1 : 0
                );

                this.ready = true;

                resolve();
              });
            } else {
              // Finally intialize all of our services
              // Initialize our services
              Promise.all([
                WasmBoyGraphics.initialize(this.canvasElement, this.wasmInstance, this.wasmByteMemory),
                WasmBoyAudio.initialize(this.wasmInstance, this.wasmByteMemory),
                WasmBoyController.initialize(this.wasmInstance),
                WasmBoyMemory.initialize(this.options.headless, this.wasmInstance, this.wasmByteMemory, this.options.saveStateCallback)
              ])
                .then(() => {
                  // Clear what is currently in memory, then load the carttridge memory
                  WasmBoyMemory.clearMemory();
                  WasmBoyMemory.resetState();

                  // TODO: Handle passing a boot rom
                  WasmBoyMemory.loadCartridgeRom(responses[0]);

                  // Run our initialization on the core
                  this.wasmInstance.exports.config(
                    0, // TODO: Include Boot Rom
                    this.options.isGbcEnabled ? 1 : 0,
                    this.options.audioBatchProcessing ? 1 : 0,
                    this.options.graphicsBatchProcessing ? 1 : 0,
                    this.options.timersBatchProcessing ? 1 : 0,
                    this.options.graphicsDisableScanlineRendering ? 1 : 0,
                    this.options.audioAccumulateSamples ? 1 : 0,
                    this.options.tileRendering ? 1 : 0,
                    this.options.tileCaching ? 1 : 0
                  );

                  // Load the game's cartridge ram
                  WasmBoyMemory.loadCartridgeRam()
                    .then(() => {
                      this.ready = true;
                      resolve();
                    })
                    .catch(error => {
                      reject(error);
                    });
                })
                .catch(error => {
                  reject(error);
                });
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    });
  }

  // function to start/resume
  play() {
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
    update(this);

    // Undo any pause
    this.paused = false;

    if (!this.updateId) {
      const intervalRate = 1000 / this.options.gameboyFrameRate;

      // Reset the frameTimeStamps
      this.fpsTimeStamps = [];

      // 1000 / 60 = 60fps
      this.updateId = setInterval(() => {
        update(this);
      }, intervalRate);
    }

    if (!this.renderId && !this.options.headless) {
      this.renderId = raf(() => {
        render(this);
      });
    }

    // Finally set up out pause fps throttle
    // This will allow us to know if we just un paused
    this.pauseFpsThrottle = true;
    setTimeout(() => {
      this.pauseFpsThrottle = false;
    }, 1000);

    return Promise.resolve();
  }

  // Function to pause the game, returns a promise
  // Will try to wait until the emulation sync is returned, and then will
  // Allow any actions
  pause() {
    this.paused = true;

    // Cancel our update and render loop
    raf.cancel(this.renderId);
    this.renderId = false;
    clearInterval(this.updateId);
    this.updateId = false;

    // Wait a raf to ensure everything is done
    return new Promise(resolve => {
      raf(() => {
        resolve();
      });
    });
  }

  // Function to reset wasmBoy, with an optional set of options
  reset(wasmBoyOptions) {
    this.config(wasmBoyOptions, this.canvasElement);
    WasmBoyMemory.resetState();
    // Reload the game if one was already loaded
    if (this.loadedROM && !this.options.headless) {
      return this.loadROM(this.loadedROM);
    }

    return Promise.resolve();
  }

  saveState() {
    return new Promise((resolve, reject) => {
      // Pause the game in case it was running
      this.pause()
        .then(() => {
          WasmBoyMemory.saveState()
            .then(() => {
              resolve();
            })
            .catch(error => {
              reject(error);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  // Function to return the save states for the game
  getSaveStates() {
    return new Promise((resolve, reject) => {
      WasmBoyMemory.getCartridgeObject()
        .then(cartridgeObject => {
          resolve(cartridgeObject.saveStates);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  loadState(saveState) {
    return new Promise((resolve, reject) => {
      // Pause the game in case it was running, and set to not ready
      this.pause()
        .then(() => {
          WasmBoyMemory.loadState(saveState)
            .then(() => {
              resolve();
            })
            .catch(error => {
              reject(error);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  // Function to return the current FPS
  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  getFPS() {
    if (this.pauseFpsThrottle) {
      return this.options.gameboyFrameRate;
    } else if (this.fpsTimeStamps) {
      return this.fpsTimeStamps.length;
    }

    return 0;
  }

  // Private Function to reset options to default
  _resetConfig() {
    // Reset Fps Metering
    this.fpsTimeStamps = [];
    this.frameSkipCounter = 0;

    // Configurable Options
    this.options = {
      headless: false,
      isAudioEnabled: true,
      gameboyFrameRate: 60,
      frameSkip: 0,
      includeBootROM: false,
      isGbcEnabled: true,
      audioBatchProcessing: false,
      graphicsBatchProcessing: false,
      timersBatchProcessing: false,
      graphicsDisableScanlineRendering: false,
      audioAccumulateSamples: false,
      tileRendering: false,
      tileCaching: false,
      saveStateCallback: false
    };
  }

  // Wrapper around instantiateWasm() to ensure we don't already have the instance
  _instantiateWasm() {
    if (this.wasmInstance) {
      return Promise.resolve();
    } else {
      return new Promise((resolve, reject) => {
        instantiateWasm()
          .then(response => {
            this.wasmInstance = response.instance;
            this.wasmByteMemory = response.byteMemory;
            resolve();
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
}

export const WasmBoyLib = new WasmBoyLibService();
