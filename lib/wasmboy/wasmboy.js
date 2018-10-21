// Modules
import fetch from 'unfetch';
import Promise from 'promise-polyfill';

// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyMemory } from '../memory/memory';

// Other lib helpers
import { instantiateWorkers } from '../worker/instantiate';
import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { loadROMToWasmBoy } from './loadrom';
import { render } from './render';
import { libWorkerOnMessage } from './onmessage';

// requestAnimationFrame() for headless mode
const raf = require('raf');

// Our Main Orchestrator of the WasmBoy lib
class WasmBoyLibService {
  // Start the request to our wasm module
  constructor() {
    this.worker = undefined;
    this.canvasElement = undefined;
    this.paused = false;
    this.ready = false;
    this.loadedAndStarted = false;
    this.renderId = false;
    this.loadedROM = false;

    this.fps = 0;

    // Reset our config and stateful elements that depend on it
    // this.options is set here
    this._resetConfig();
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

      if (this.wasmInstance && this.wasmByteMemory) {
        await WasmBoyGraphics.initialize(this.canvasElement, this.wasmInstance, this.wasmByteMemory, this.options.updateGraphicsCallback);
      }
    };

    return setCanvasTask();
  }

  getCanvas() {
    return this.canvasElement;
  }

  // Finish request for wasm module, and fetch game
  loadROM(ROM, fetchHeaders) {
    const boundLoadROM = loadROMToWasmBoy.bind(this);
    return boundLoadROM(ROM, fetchHeaders);
  }

  // function to start/resume
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
      }
      if (this.options.onPlay) {
        this.options.onPlay();
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

      // Cancel our update and render loop
      raf.cancel(this.renderId);
      this.renderId = false;

      // Cancel any playing audio
      // Audio played with latency may be still going on here
      WasmBoyAudio.cancelAllAudio(true);

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

  // Simply returns the FPS we get back from the lib worker
  getFPS() {
    return this.fps;
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
      updateGraphicsCallback: false,
      updateAudioCallback: false,
      saveStateCallback: false,
      onReady: false,
      onPlay: false,
      onPause: false,
      onLoadedAndStarted: false
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
