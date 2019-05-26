// WasmBoy Modules
import { WasmBoyPlugins } from '../plugins/plugins';
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyMemory } from '../memory/memory';

// Other lib helpers
import { instantiateWorkers } from '../worker/instantiate';
import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';
import { loadROMToWasmBoy } from './load';
import { render } from './render';
import { libWorkerOnMessage } from './onmessage';

// requestAnimationFrame() for headless mode
import raf from 'raf';

let isWindowUnloading = false;

// Our Main Orchestrator of the WasmBoy lib
class WasmBoyLibService {
  // Start the request to our wasm module
  constructor() {
    this.worker = undefined;
    this.coreType = undefined;
    this.canvasElement = undefined;
    this.paused = false;
    this.ready = false;
    this.loadedAndStarted = false;
    this.initialized = false;
    this.renderId = false;
    this.loadedROM = false;

    this.fps = 0;
    this.speed = 1.0;

    // Reset our config and stateful elements that depend on it
    // this.options is set here
    this._resetConfig();

    // Add some listeners for when we are put into the background
    if (typeof window !== 'undefined') {
      // Calling promises in the hidden visibility change
      // On page reload, leaks memory
      // https://bugs.chromium.org/p/chromium/issues/detail?id=932885&can=1&q=torchh2424%40gmail.com&colspec=ID%20Pri%20M%20Stars%20ReleaseBlock%20Component%20Status%20Owner%20Summary%20OS%20Modified
      // Thus we need this hack, to get around this
      window.addEventListener('beforeunload', function(event) {
        isWindowUnloading = true;
      });

      window.document.addEventListener('visibilitychange', () => {
        // fires when user switches tabs, apps, goes to homescreen, etc.
        if (document.visibilityState === 'hidden') {
          if (this.options && this.options.disablePauseOnHidden) {
            return;
          }

          setTimeout(() => {
            if (!isWindowUnloading) {
              // See the comment above about the memory leak
              // This fires off a bunch of promises, thus a leak
              this.pause();
            }
          }, 0);
        }
      });
    }
  }

  // Function to initialize/configure Wasmboy
  config(wasmBoyOptions, canvasElement) {
    const configTask = async () => {
      // Pause any currently running game
      await this.pause();

      // Get our canvas elements
      await this.setCanvas(canvasElement);

      // Reset our config and stateful elements that depend on it
      // If we have a new config to take its place
      if (wasmBoyOptions || !this.options) {
        this._resetConfig();
      }

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
    };

    return configTask();
  }

  // Function to return our current configuration as an object
  getConfig() {
    return this.options;
  }

  // Function to get/set our canvas element
  // Useful for vaporboy
  setCanvas(canvasElement) {
    if (!canvasElement) {
      return Promise.resolve();
    }

    const setCanvasTask = async () => {
      await this.pause();

      // Set our new canvas element, and re-run init on graphics to apply styles and things
      this.canvasElement = canvasElement;

      await WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback);
    };

    return setCanvasTask();
  }

  getCanvas() {
    return this.canvasElement;
  }

  // Finish request for wasm module, and fetch boot ROM
  addBootROM(type, file, fetchHeaders, additionalInfo) {
    return WasmBoyMemory.addBootROM(type, file, fetchHeaders, additionalInfo);
  }

  getBootROMs() {
    return WasmBoyMemory.getBootROMs();
  }

  // Finish request for wasm module, and fetch game
  loadROM(ROM, fetchHeaders) {
    const boundLoadROM = loadROMToWasmBoy.bind(this);
    return boundLoadROM(ROM, fetchHeaders);
  }

  // Function to start/resume
  play() {
    const playTask = async () => {
      if (!this.ready) {
        return;
      }
      if (!this.loadedAndStarted) {
        this.loadedAndStarted = true;
        if (this.options.onLoadedAndStarted) {
          this.options.onLoadedAndStarted();
        }
        WasmBoyPlugins.runHook({
          key: 'loadedAndStarted'
        });
      }
      if (this.options.onPlay) {
        this.options.onPlay();
      }

      WasmBoyPlugins.runHook({
        key: 'play'
      });

      // Bless the audio, this is to fix any autoplay issues
      if (!this.options.headless) {
        WasmBoyAudio.resumeAudioContext();
        WasmBoyAudio.resetTimeStretch();
      }

      // Reset the audio queue index to stop weird pauses when trying to load a game
      await this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.RESET_AUDIO_QUEUE
      });

      // Undo any pause
      this.paused = false;

      if (!this.updateId) {
        await this.worker.postMessage({
          type: WORKER_MESSAGE_TYPE.PLAY
        });
      }

      if (!this.renderId && !this.options.headless) {
        this.renderId = raf(() => {
          render.call(this);
        });
      }
    };

    return playTask();
  }

  // Function to pause the game, returns a promise
  // Will try to wait until the emulation sync is returned, and then will
  // Allow any actions
  pause() {
    const pauseTask = async () => {
      this.paused = true;
      if (this.ready && this.options.onPause) {
        this.options.onPause();
      }

      WasmBoyPlugins.runHook({
        key: 'pause'
      });

      // Cancel our update and render loop
      raf.cancel(this.renderId);
      this.renderId = false;

      // Cancel any playing audio
      // Audio played with latency may be still going on here
      if (!this.options.headless) {
        WasmBoyAudio.cancelAllAudio(true);
      }

      if (this.worker) {
        await this.worker.postMessage({
          type: WORKER_MESSAGE_TYPE.PAUSE
        });
      }

      // Wait a raf to ensure everything is done
      await new Promise(resolve => {
        raf(() => {
          resolve();
        });
      });
    };

    return pauseTask();
  }

  // Function to reset wasmBoy, with an optional set of options
  reset(wasmBoyOptions) {
    const resetTask = async () => {
      this.config(wasmBoyOptions, this.canvasElement);
      // Reload the game if one was already loaded
      if (this.loadedROM) {
        return this.loadROM(this.loadedROM);
      }
    };

    return resetTask();
  }

  getSavedMemory() {
    return WasmBoyMemory.getSavedMemory();
  }

  saveLoadedCartridge(additionalInfo) {
    return WasmBoyMemory.saveLoadedCartridge(additionalInfo);
  }

  deleteSavedCartridge(cartridge) {
    return WasmBoyMemory.deleteSavedCartridge(cartridge);
  }

  saveState() {
    const saveStateTask = async () => {
      await this.pause();
      const saveState = await WasmBoyMemory.saveState();
      return saveState;
    };

    return saveStateTask();
  }

  // Function to return the save states for the game
  getSaveStates() {
    const getSaveStatesTask = async () => {
      let cartridgeObject = await WasmBoyMemory.getCartridgeObject();
      if (!cartridgeObject) {
        return [];
      } else {
        return cartridgeObject.saveStates;
      }
    };

    return getSaveStatesTask();
  }

  loadState(saveState) {
    const loadStateTask = async () => {
      await this.pause();
      await WasmBoyMemory.loadState(saveState);
    };

    return loadStateTask();
  }

  deleteState(saveState) {
    const deleteStateTask = async () => {
      await WasmBoyMemory.deleteState(saveState);
    };

    return deleteStateTask();
  }

  // Simply returns the FPS we get back from the lib worker
  getFPS() {
    return this.fps;
  }

  // Simply returns our current Core Type
  getCoreType() {
    return this.coreType;
  }

  getSpeed() {
    return this.speed;
  }

  // Set the speed of the emulator
  // Should be a float. And by X times as fast
  setSpeed(speed) {
    if (speed <= 0) {
      speed = 0.1;
    }

    const setSpeedTask = async () => {
      if (this.worker) {
        this.speed = speed;

        WasmBoyAudio.setSpeed(speed);

        await this.worker.postMessageIgnoreResponse({
          type: WORKER_MESSAGE_TYPE.SET_SPEED,
          speed
        });
      }

      // Wait a raf to ensure everything is done
      await new Promise(resolve => {
        raf(() => {
          resolve();
        });
      });
    };
    setSpeedTask();
  }

  // Function to return if we currently are playing as a gbc console
  isGBC() {
    const isGBCTask = async () => {
      const event = await WasmBoyLib.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.IS_GBC
      });

      const eventData = getEventData(event);

      return eventData.message.response;
    };
    return isGBCTask();
  }

  // Private Function to reset options to default
  _resetConfig() {
    // Reset Fps Metering
    this.fpsTimeStamps = [];
    this.frameSkipCounter = 0;

    // Configurable Options
    // Set callbacks to null and not undefined,
    // For when configs are passed, we will be sure to
    // add them as keys
    this.options = {
      headless: false,
      disablePauseOnHidden: false,
      isAudioEnabled: true,
      enableAudioDebugging: false,
      gameboyFrameRate: 60,
      frameSkip: 0,
      enableBootROMIfAvailable: true,
      isGbcEnabled: true,
      isGbcColorizationEnabled: true,
      gbcColorizationPalette: null,
      audioBatchProcessing: false,
      graphicsBatchProcessing: false,
      timersBatchProcessing: false,
      graphicsDisableScanlineRendering: false,
      audioAccumulateSamples: false,
      tileRendering: false,
      tileCaching: false,
      maxNumberOfAutoSaveStates: 10,
      updateGraphicsCallback: null,
      updateAudioCallback: null,
      saveStateCallback: null,
      breakpointCallback: null,
      onReady: null,
      onPlay: null,
      onPause: null,
      onLoadedAndStarted: null
    };
  }

  // Function to instantiate and set up our workers
  // This ensures we don't create workers twice
  _instantiateWorkers() {
    const instantiateWorkersTask = async () => {
      if (this.worker) {
        return;
      } else {
        this.worker = await instantiateWorkers();
        this.worker.addMessageListener(libWorkerOnMessage.bind(this));
      }
    };

    return instantiateWorkersTask();
  }
}

export const WasmBoyLib = new WasmBoyLibService();
