'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// Some shared constants by the graphics lib and worker
const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;

const WORKER_MESSAGE_TYPE = {
  CONNECT: 'CONNECT',
  INSTANTIATE_WASM: 'INSTANTIATE_WASM',
  CLEAR_MEMORY: 'CLEAR_MEMORY',
  CLEAR_MEMORY_DONE: 'CLEAR_MEMORY_DONE',
  GET_MEMORY: 'GET_MEMORY',
  SET_MEMORY: 'SET_MEMORY',
  SET_MEMORY_DONE: 'SET_MEMORY_DONE',
  GET_CONSTANTS: 'GET_CONSTANTS',
  GET_CONSTANTS_DONE: 'GET_CONSTANTS_DONE',
  CONFIG: 'CONFIG',
  RESET_AUDIO_QUEUE: 'RESET_AUDIO_QUEUE',
  PLAY: 'PLAY',
  PLAY_UNTIL_BREAKPOINT: 'PLAY_UNTIL_BREAKPOINT',
  BREAKPOINT: 'BREAKPOINT',
  PAUSE: 'PAUSE',
  UPDATED: 'UPDATED',
  CRASHED: 'CRASHED',
  SET_JOYPAD_STATE: 'SET_JOYPAD_STATE',
  AUDIO_LATENCY: 'AUDIO_LATENCY',
  RUN_WASM_EXPORT: 'RUN_WASM_EXPORT',
  GET_WASM_MEMORY_SECTION: 'GET_WASM_MEMORY_SECTION',
  GET_WASM_CONSTANT: 'GET_WASM_CONSTANT',
  FORCE_OUTPUT_FRAME: 'FORCE_OUTPUT_FRAME'
};
const WORKER_ID = {
  LIB: 'LIB',
  GRAPHICS: 'GRAPHICS',
  MEMORY: 'MEMORY',
  CONTROLLER: 'CONTROLLER',
  AUDIO: 'AUDIO'
};
const MEMORY_TYPE = {
  CARTRIDGE_RAM: 'CARTRIDGE_RAM',
  CARTRIDGE_ROM: 'CARTRIDGE_ROM',
  CARTRIDGE_HEADER: 'CARTRIDGE_HEADER',
  GAMEBOY_MEMORY: 'GAMEBOY_MEMORY',
  PALETTE_MEMORY: 'PALETTE_MEMORY',
  INTERNAL_STATE: 'INTERNAL_STATE'
};

function getEventData(event) {
  if (event.data) {
    return event.data;
  }

  return event;
}
const isInBrowser = typeof self !== 'undefined'; // Function to read a base64 string as a buffer

function readBase64String(base64String) {
  if (isInBrowser) {
    return base64String;
  } else {
    return readBase64Buffer(base64String).toString('utf8');
  }
}
function readBase64Buffer(base64String) {
  return Buffer.from(base64String.split(',')[1], 'base64');
}

// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

class WasmBoyGraphicsService {
  constructor() {
    this.worker = undefined;
    this.updateGraphicsCallback = undefined;
    this.frameQueue = undefined;
    this.frameQueueRenderPromise = undefined;
    this.canvasElement = undefined;
    this.canvasContext = undefined;
    this.canvasImageData = undefined;
    this.imageDataArray = undefined;
    this.imageDataArrayChanged = false;
  }

  initialize(canvasElement, updateGraphicsCallback) {
    this.updateGraphicsCallback = updateGraphicsCallback; // Initialiuze our cached wasm constants
    // WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = this.wasmInstance.exports.frameInProgressVideoOutputLocation.valueOf();
    // Reset our frame queue and render promises

    this.frameQueue = [];

    const initializeTask = async () => {
      // Prepare our canvas
      this.canvasElement = canvasElement;
      this.canvasContext = this.canvasElement.getContext('2d');
      this.canvasElement.width = GAMEBOY_CAMERA_WIDTH;
      this.canvasElement.height = GAMEBOY_CAMERA_HEIGHT;
      this.canvasImageData = this.canvasContext.createImageData(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT); // Add some css for smooth 8-bit canvas scaling
      // https://stackoverflow.com/questions/7615009/disable-interpolation-when-scaling-a-canvas
      // https://caniuse.com/#feat=css-crisp-edges

      this.canvasElement.style = `
        image-rendering: optimizeSpeed;
        image-rendering: -moz-crisp-edges;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: -o-crisp-edges;
        image-rendering: pixelated;
        -ms-interpolation-mode: nearest-neighbor;
      `; // Fill the canvas with a blank screen
      // using client width since we are not requiring a width and height oin the canvas
      // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
      // TODO: Mention respopnsive canvas scaling in the docs

      this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height); // Finally make sure we set our constants for our worker

      if (this.worker) {
        await this.worker.postMessage({
          type: WORKER_MESSAGE_TYPE.GET_CONSTANTS
        });
      }
    };

    return initializeTask();
  } // Function to set our worker


  setWorker(worker) {
    this.worker = worker;
    this.worker.addMessageListener(event => {
      const eventData = getEventData(event);

      switch (eventData.message.type) {
        case WORKER_MESSAGE_TYPE.UPDATED:
          {
            this.imageDataArray = new Uint8ClampedArray(eventData.message.imageDataArrayBuffer);
            this.imageDataArrayChanged = true;
            return;
          }
      }
    });
  } // Function to render a frame
  // Will add the frame to the frame queue to be rendered
  // Returns the promise from this.drawFrameQueue
  // Which resolves once all frames are rendered


  renderFrame() {
    // Check if we have new graphics to show
    if (!this.imageDataArrayChanged) {
      return;
    }

    this.imageDataArrayChanged = false; // Check for a callback for accessing image data

    if (this.updateGraphicsCallback) {
      this.updateGraphicsCallback(this.imageDataArray);
    } // Add our new imageData


    for (let i = 0; i < this.imageDataArray.length; i++) {
      this.canvasImageData.data[i] = this.imageDataArray[i];
    }

    this.canvasContext.clearRect(0, 0, GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);
    this.canvasContext.putImageData(this.canvasImageData, 0, 0);
  }

}

const WasmBoyGraphics = new WasmBoyGraphicsService();

// Tons of help from:
// Both of these make it sound off
// Latency controls how much delay audio has, larger = more delay, goal is to be as small as possible
// Time remaining controls how far ahead we can be., larger = more frames rendered before playing a new set of samples. goal is to be as small as possible. May want to adjust this number according to performance of device
// These magic numbers just come from preference, can be set as options

const DEFAULT_AUDIO_LATENCY_IN_MILLI = 100;
const WASMBOY_SAMPLE_RATE = 48000; // Some canstants that use the ones above that will allow for faster performance

const DEFAULT_AUDIO_LATENCY_IN_SECONDS = DEFAULT_AUDIO_LATENCY_IN_MILLI / 1000; // The minimum fps we can have, before we start time stretching for slowness

const SLOW_TIME_STRETCH_MIN_FPS = 57;

class WasmBoyAudioService {
  constructor() {
    // Wasmboy instance and memory
    this.worker = undefined;
    this.updateAudioCallback = undefined;
    this.audioContext = undefined;
    this.audioBuffer = undefined; // The play time for our audio samples

    this.audioPlaytime = undefined;
    this.audioSources = []; // Average fps for time stretching

    this.averageTimeStretchFps = []; // Our sound output Location, we will initialize this in init

    this.WASMBOY_SOUND_OUTPUT_LOCATION = 0;
  }

  initialize(updateAudioCallback) {
    const initializeTask = async () => {
      this.updateAudioCallback = updateAudioCallback;
      this.averageTimeStretchFps = [];

      if (this.audioSources.length > 0) {
        this.cancelAllAudio();
      }

      this.audioSources = [];

      this._createAudioContextIfNone(); // Lastly get our audio constants


      return this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.GET_CONSTANTS
      });
    };

    return initializeTask();
  } // Ensure that Audio is blessed.
  // Meaning, the audioContext won't be
  // affected by any autoplay issues.
  // https://www.chromium.org/audio-video/autoplay


  resumeAudioContext() {
    this._createAudioContextIfNone();

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      this.audioPlaytime = this.audioContext.currentTime;
    }
  }

  resetTimeStretch() {
    // Simply reset our average FPS counter array
    this.averageTimeStretchFps = [];
  }

  setWorker(worker) {
    this.worker = worker;
    this.worker.addMessageListener(event => {
      const eventData = getEventData(event);

      switch (eventData.message.type) {
        case WORKER_MESSAGE_TYPE.UPDATED:
          {
            // Dont wait for raf.
            // Audio being shown is not dependent on the browser drawing a frame :)
            this.playAudio(eventData.message.fps, eventData.message.allowFastSpeedStretching, eventData.message.numberOfSamples, eventData.message.leftChannel, eventData.message.rightChannel); // Next, send back how much forward latency
            // we have

            let latency = 0;

            if (this.audioContext.currentTime && this.audioContext.currentTime > 0) {
              latency = this.audioPlaytime - this.audioContext.currentTime;
            }

            this.worker.postMessage({
              type: WORKER_MESSAGE_TYPE.AUDIO_LATENCY,
              latency
            });
            return;
          }
      }
    });
  } // Function to queue up and audio buyffer to be played
  // Returns a promise so that we may "sync by audio"
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/dau8e2w/


  playAudio(currentFps, allowFastSpeedStretching, numberOfSamples, leftChannelBuffer, rightChannelBuffer) {
    // Find our averageFps
    let fps = currentFps || 60; // Check if we got a huge fps outlier.
    // If so, let's just reset our average.
    // This will fix the slow gradual ramp down

    const fpsDifference = Math.abs(currentFps - this.averageTimeStretchFps[this.averageTimeStretchFps.length - 1]);

    if (fpsDifference && fpsDifference >= 15) {
      this.resetTimeStretch();
    } // Find our average fps for time stretching


    this.averageTimeStretchFps.push(currentFps); // TODO Make the multiplier Const the timeshift speed

    if (this.averageTimeStretchFps.length > Math.floor(SLOW_TIME_STRETCH_MIN_FPS * 3)) {
      this.averageTimeStretchFps.shift();
    } // Make sure we have a minimum number of time stretch fps timestamps to judge the average time


    if (this.averageTimeStretchFps.length >= SLOW_TIME_STRETCH_MIN_FPS) {
      fps = this.averageTimeStretchFps.reduce((accumulator, currentValue) => {
        return accumulator + currentValue;
      });
      fps = Math.floor(fps / this.averageTimeStretchFps.length);
    } // Find if we should time stretch this sample or not from our current fps


    let playbackRate = 1.0;

    if (fps < SLOW_TIME_STRETCH_MIN_FPS || allowFastSpeedStretching) {
      // Has to be 60 to get accurent playback regarless of fps cap
      playbackRate = playbackRate * (fps / 60);

      if (playbackRate <= 0) {
        playbackRate = 0.01;
      }
    } // Create an audio buffer, with a left and right channel


    this.audioBuffer = this.audioContext.createBuffer(2, numberOfSamples, WASMBOY_SAMPLE_RATE);

    if (this.audioBuffer.copyToChannel) {
      this.audioBuffer.copyToChannel(new Float32Array(leftChannelBuffer), 0, 0);
      this.audioBuffer.copyToChannel(new Float32Array(rightChannelBuffer), 1, 0);
    } else {
      // Safari fallback
      this.audioBuffer.getChannelData(0).set(new Float32Array(leftChannelBuffer));
      this.audioBuffer.getChannelData(1).set(new Float32Array(rightChannelBuffer));
    } // Get an AudioBufferSourceNode.
    // This is the AudioNode to use when we want to play an AudioBuffer


    let source = this.audioContext.createBufferSource(); // set the buffer in the AudioBufferSourceNode

    source.buffer = this.audioBuffer; // Set our playback rate for time resetretching

    source.playbackRate.setValueAtTime(playbackRate, this.audioContext.currentTime); // Call our callback, if we have one

    let finalNode = source;

    if (this.updateAudioCallback) {
      const responseNode = this.updateAudioCallback(this.audioContext, source);

      if (responseNode) {
        finalNode = responseNode;
      }
    } // connect the AudioBufferSourceNode to the
    // destination so we can hear the sound


    finalNode.connect(this.audioContext.destination); // Check if we made it in time
    // Idea from: https://github.com/binji/binjgb/blob/master/demo/demo.js

    let audioContextCurrentTime = this.audioContext.currentTime;
    let audioContextCurrentTimeWithLatency = audioContextCurrentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
    this.audioPlaytime = this.audioPlaytime || audioContextCurrentTimeWithLatency;

    if (this.audioPlaytime < audioContextCurrentTime) {
      // We took too long, or something happen and hiccup'd the emulator, reset audio playback times
      this.cancelAllAudio();
      this.audioPlaytime = audioContextCurrentTimeWithLatency;
    } // start the source playing


    source.start(this.audioPlaytime); // Set our new audio playtime goal

    const sourcePlaybackLength = numberOfSamples / (WASMBOY_SAMPLE_RATE * playbackRate);
    this.audioPlaytime = this.audioPlaytime + sourcePlaybackLength; // Cancel all audio sources on the tail that play before us

    while (this.audioSources[this.audioSources.length - 1] && this.audioSources[this.audioSources.length - 1].playtime <= this.audioPlaytime) {
      this.audioSources[this.audioSources.length - 1].source.stop();
      this.audioSources.pop();
    } // Add the source so we can stop this if needed


    this.audioSources.push({
      source: source,
      playTime: this.audioPlaytime,
      fps: fps
    }); // Shift ourselves out when finished

    const timeUntilSourceEnds = this.audioPlaytime - this.audioContext.currentTime + 500;
    setTimeout(() => {
      this.audioSources.shift();
    }, timeUntilSourceEnds);
  }

  cancelAllAudio(stopCurrentAudio) {
    if (!this.audioContext) {
      return;
    } // Cancel all audio That was queued to play


    for (let i = 0; i < this.audioSources.length; i++) {
      if (stopCurrentAudio || this.audioSources[i].playTime > this.audioPlaytime) {
        this.audioSources[i].source.stop();
      }
    } // Reset our audioPlaytime


    this.audioPlaytime = this.audioContext.currentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
  }

  _createAudioContextIfNone() {
    if (!this.audioContext) {
      // Get our Audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

}

const WasmBoyAudio = new WasmBoyAudioService();

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    var ownKeys = Object.keys(source);

    if (typeof Object.getOwnPropertySymbols === 'function') {
      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }

    ownKeys.forEach(function (key) {
      _defineProperty(target, key, source[key]);
    });
  }

  return target;
}

// Get our idb instance, and initialize to asn idb-keyval
// This is so we don't get the default keyval DB name. And will allow
// Parent projects to use the slimmer idb keyval
// https://www.npmjs.com/package/idb
// Need to wrap in rollup replace to stop
// node commonjs from breaking

/*ROLLUP_REPLACE_BROWSER
import idb from 'idb';
ROLLUP_REPLACE_BROWSER*/
let keyval = false; // Get our idb dPromise

if (typeof window !== 'undefined') {
  const dbPromise = idb.open('wasmboy', 1, upgradeDB => {
    upgradeDB.createObjectStore('keyval');
  }); // Get our idb-keyval instance

  keyval = {
    get(key) {
      return dbPromise.then(db => {
        return db.transaction('keyval').objectStore('keyval').get(key);
      });
    },

    set(key, val) {
      return dbPromise.then(db => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(val, key);
        return tx.complete;
      });
    },

    delete(key) {
      return dbPromise.then(db => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').delete(key);
        return tx.complete;
      });
    },

    clear() {
      return dbPromise.then(db => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').clear();
        return tx.complete;
      });
    },

    keys() {
      return dbPromise.then(db => {
        const tx = db.transaction('keyval');
        const keys = [];
        const store = tx.objectStore('keyval'); // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
        // openKeyCursor isn't supported by Safari, so we fall back

        (store.iterateKeyCursor || store.iterateCursor).call(store, cursor => {
          if (!cursor) return;
          keys.push(cursor.key);
          cursor.continue();
        });
        return tx.complete.then(() => keys);
      });
    }

  };
}

const idbKeyval = keyval;

// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions
//  Will save the state in parts, to easy memory map changes:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
const WASMBOY_SAVE_STATE_SCHEMA = {
  wasmboyMemory: {
    wasmBoyInternalState: [],
    wasmBoyPaletteMemory: [],
    gameBoyMemory: [],
    cartridgeRam: []
  },
  date: undefined,
  isAuto: undefined
}; // Function to return a save state of the current memory

function getSaveState() {
  // Save our internal wasmboy state to memory
  // Should be done whenever we send back memory
  // this.wasmInstance.exports.saveState();
  let saveState = Object.assign({}, WASMBOY_SAVE_STATE_SCHEMA);
  saveState.wasmboyMemory.wasmBoyInternalState = this.internalState;
  saveState.wasmboyMemory.wasmBoyPaletteMemory = this.paletteMemory;
  saveState.wasmboyMemory.gameBoyMemory = this.gameboyMemory;
  saveState.wasmboyMemory.cartridgeRam = this.cartridgeRam;
  saveState.date = Date.now();
  saveState.isAuto = false;

  if (this.saveStateCallback) {
    this.saveStateCallback(saveState);
  }

  return saveState;
}

// Functions here are depedent on WasmBoyMemory state.

function _prepareAndStoreAutoSave() {
  // Check if the game is currently playing
  if (!this.internalState) {
    return null;
  } // Get our cartridge ram and header
  // Use this.cartridgeHeader and this.cartridgeRam
  //const header = getCartridgeHeader.bind(this)();
  //const cartridgeRam = getCartridgeRam.bind(this)();
  // Get our save state, and un type our arrays


  const saveState = getSaveState.bind(this)();
  const saveStateMemoryKeys = Object.keys(saveState.wasmboyMemory);

  for (let i = 0; i < saveStateMemoryKeys.length; i++) {
    saveState.wasmboyMemory[saveStateMemoryKeys[i]] = Array.prototype.slice.call(saveState.wasmboyMemory[saveStateMemoryKeys[i]]);
  } // Set isAuto


  saveState.isAuto = true; // Need to conert types arrays, and back, or selse wll get indexed JSON
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays

  localStorage.setItem(this.WASMBOY_UNLOAD_STORAGE, JSON.stringify({
    header: Array.prototype.slice.call(this.cartridgeHeader),
    cartridgeRam: Array.prototype.slice.call(this.cartridgeRam),
    saveState: saveState
  }));
  return null;
} // Function to find any autosaves in localstorage, and commit them to our idb


function _findAndCommitAutoSave() {
  const findAndCommitAutoSaveTask = async () => {
    // Load any unloaded storage in our localStorage
    const unloadStorage = localStorage.getItem(this.WASMBOY_UNLOAD_STORAGE);

    if (unloadStorage) {
      const unloadStorageObject = JSON.parse(unloadStorage);
      localStorage.removeItem(this.WASMBOY_UNLOAD_STORAGE);
      const header = new Uint8Array(unloadStorageObject.header);
      const cartridgeRam = new Uint8Array(unloadStorageObject.cartridgeRam); // Get our save state, and re-type our array

      const saveState = unloadStorageObject.saveState;

      if (saveState) {
        const saveStateMemoryKeys = Object.keys(saveState.wasmboyMemory);

        for (let i = 0; i < saveStateMemoryKeys.length; i++) {
          saveState.wasmboyMemory[saveStateMemoryKeys[i]] = new Uint8Array(saveState.wasmboyMemory[saveStateMemoryKeys[i]]);
        }
      }

      await this.saveCartridgeRam(header, cartridgeRam);
      await this.saveState(header, saveState);
    }
  };

  return findAndCommitAutoSaveTask();
} // Function to set event listeners to run our unload handler


function initializeAutoSave() {
  // Set listeners to ensure we save our cartridge ram before closing
  window.addEventListener('beforeunload', () => {
    _prepareAndStoreAutoSave.bind(this)();
  }, false);
  window.addEventListener('unload', () => {
    _prepareAndStoreAutoSave.bind(this)();
  }, false);
  window.addEventListener('pagehide', () => {
    _prepareAndStoreAutoSave.bind(this)();
  }, false); // Mobile Page visibility, for pressing home, closing tabs, task switcher, etc...
  // https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/

  document.addEventListener('visibilitychange', () => {
    // fires when user switches tabs, apps, goes to homescreen, etc.
    // NOTE: This will not create a new save state in desktop browser,
    // Because the localstorage string is only picked up on refresh :)
    // Unless you force kill the browser or something, which is what we want
    // Anyways
    if (document.visibilityState === 'hidden') {
      _prepareAndStoreAutoSave.bind(this)();
    }
  }); // Restore any autosave lingering to be committed

  return _findAndCommitAutoSave.bind(this)();
}

class WasmBoyMemoryService {
  constructor() {
    this.worker = undefined;
    this.saveStateCallback = undefined;
    this.loadedCartridgeMemoryState = {
      ROM: false,
      RAM: false
    }; // Our different types of memory

    this.cartridgeRom = undefined;
    this.cartridgeHeader = undefined;
    this.cartridgeRam = undefined;
    this.gameboyMemory = undefined;
    this.paletteMemory = undefined;
    this.internalState = undefined; // Going to set the key for idbKeyval as the cartridge header.
    // Then, for each cartridge, it will return an object.
    // there will be a cartridgeRam Key, settings Key, and a saveState key
    // Not going to make one giant object, as we want to keep idb transactions light and fast

    this.WASMBOY_UNLOAD_STORAGE = 'WASMBOY_UNLOAD_STORAGE'; // Define some constants since calls to wasm are expensive

    this.WASMBOY_GAME_BYTES_LOCATION = 0;
    this.WASMBOY_GAME_RAM_BANKS_LOCATION = 0;
    this.WASMBOY_INTERNAL_STATE_SIZE = 0;
    this.WASMBOY_INTERNAL_STATE_LOCATION = 0;
    this.WASMBOY_INTERNAL_MEMORY_SIZE = 0;
    this.WASMBOY_INTERNAL_MEMORY_LOCATION = 0;
    this.WASMBOY_PALETTE_MEMORY_SIZE = 0;
    this.WASMBOY_PALETTE_MEMORY_LOCATION = 0;
  }

  initialize(headless, saveStateCallback) {
    const initializeTask = async () => {
      if (headless) {
        this.saveStateCallback = saveStateCallback;
        await this._initializeConstants();
      } else {
        this.saveStateCallback = saveStateCallback;
        await this._initializeConstants(); // initialize the autosave feature

        await initializeAutoSave.call(this);
      }
    };

    return initializeTask();
  }

  setWorker(worker) {
    this.worker = worker; // Also set our handler

    this.worker.addMessageListener(event => {
      const eventData = getEventData(event);

      switch (eventData.message.type) {
        case WORKER_MESSAGE_TYPE.UPDATED:
          {
            // Simply set our memory
            const memoryTypes = Object.keys(eventData.message);
            delete memoryTypes.type;

            if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_ROM)) {
              this.cartridgeRom = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_ROM]);
            }

            if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_RAM)) {
              this.cartridgeRam = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_RAM]);
            }

            if (memoryTypes.includes(MEMORY_TYPE.GAMEBOY_MEMORY)) {
              this.gameboyMemory = new Uint8Array(eventData.message[MEMORY_TYPE.GAMEBOY_MEMORY]);
            }

            if (memoryTypes.includes(MEMORY_TYPE.PALETTE_MEMORY)) {
              this.paletteMemory = new Uint8Array(eventData.message[MEMORY_TYPE.PALETTE_MEMORY]);
            }

            if (memoryTypes.includes(MEMORY_TYPE.INTERNAL_STATE)) {
              this.internalState = new Uint8Array(eventData.message[MEMORY_TYPE.INTERNAL_STATE]);
            }

            return;
          }
      }
    });
  }

  getLoadedCartridgeMemoryState() {
    return this.loadedCartridgeMemoryState;
  }

  clearMemory() {
    // Clear Wasm memory
    // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
    return this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY
    }).then(event => {
      this.loadedCartridgeMemoryState.ROM = false;
      this.loadedCartridgeMemoryState.RAM = false; // Reset everything

      this.cartridgeRom = undefined;
      this.cartridgeHeader = undefined;
      this.cartridgeRam = undefined;
      this.gameboyMemory = undefined;
      this.paletteMemory = undefined;
      this.internalState = undefined;
    });
  }

  loadCartridgeRom(ROM) {
    const loadTask = async () => {
      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_ROM] = ROM.buffer; // Don't pass the rom as a transferrable, since,
      // We want to keep a copy of it for reset

      await this.worker.postMessage(_objectSpread({
        type: WORKER_MESSAGE_TYPE.SET_MEMORY
      }, workerMemoryObject)).then(event => {
        this.loadedCartridgeMemoryState.ROM = true;
      }); // Also get our cartridge header

      await this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.GET_MEMORY,
        memoryTypes: [MEMORY_TYPE.CARTRIDGE_ROM, MEMORY_TYPE.CARTRIDGE_HEADER]
      }).then(event => {
        const eventData = getEventData(event);
        this.cartridgeRom = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_ROM]);
        this.cartridgeHeader = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_HEADER]);
      });
    };

    return loadTask();
  } // Function to save the cartridge ram
  // This emulates the cartridge having a battery to
  // Keep things like Pokemon Save data in memory
  // Also allows passing in a a Uint8Array header and ram to be set manually


  saveCartridgeRam(passedHeader, passedCartridgeRam) {
    const saveCartridgeRamTask = async () => {
      // Get the entire header in byte memory
      // Each version of a rom can have similar title and checksums
      // Therefore comparing all of it should help with this :)
      // https://drive.google.com/file/d/0B7y-o-Uytiv9OThXWXFCM1FPbGs/view
      let header;
      let cartridgeRam;

      if (passedHeader && passedCartridgeRam) {
        header = passedHeader;
        cartridgeRam = passedCartridgeRam;
      } else {
        header = this.cartridgeHeader;
        cartridgeRam = this.cartridgeRam;
      }

      if (!header || !cartridgeRam) {
        throw new Error('Error parsing the cartridgeRam or cartridge header');
      } // Get our cartridge object


      let cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject) {
        cartridgeObject = {};
      } // Set the cartridgeRam to our cartridgeObject


      cartridgeObject.cartridgeRam = cartridgeRam;
      await idbKeyval.set(header, cartridgeObject);
    };

    return saveCartridgeRamTask();
  } // function to load the cartridge ram
  // opposite of above


  loadCartridgeRam() {
    const loadCartridgeRamTask = async () => {
      const header = this.cartridgeHeader;

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      const cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject || !cartridgeObject.cartridgeRam) {
        return;
      } // Set the cartridgeRam
      // Don't transfer, because we want to keep a reference to it


      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM] = cartridgeObject.cartridgeRam.buffer;
      await this.worker.postMessage(_objectSpread({
        type: WORKER_MESSAGE_TYPE.SET_MEMORY
      }, workerMemoryObject)).then(event => {
        this.loadedCartridgeMemoryState.RAM = true;
        this.cartridgeRam = cartridgeObject.cartridgeRam;
      });
    };

    return loadCartridgeRamTask();
  } // Function to save the state to the indexeddb


  saveState(passedHeader, passedSaveState) {
    const saveStateTask = async () => {
      // Get our save state
      let saveState;
      let header;

      if (passedHeader && passedSaveState) {
        saveState = passedSaveState;
        header = passedHeader;
      } else {
        saveState = getSaveState.call(this);
        header = this.cartridgeHeader;
      }

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      let cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject) {
        cartridgeObject = {};
      }

      if (!cartridgeObject.saveStates) {
        cartridgeObject.saveStates = [];
      }

      cartridgeObject.saveStates.push(saveState);
      await idbKeyval.set(header, cartridgeObject);
      return saveState;
    };

    return saveStateTask();
  }

  loadState(saveState) {
    const loadStateTask = async () => {
      const header = this.cartridgeHeader;

      if (!header) {
        throw new Error('Error getting the cartridge header');
      }

      if (!saveState) {
        const cartridgeObject = await idbKeyval.get(header);

        if (!cartridgeObject || !cartridgeObject.saveStates) {
          throw new Error('No Save State passed, and no cartridge object found');
          return;
        }

        saverState = cartridgeObject.saveStates[0];
      }

      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM] = saveState.wasmboyMemory.cartridgeRam.buffer;
      workerMemoryObject[MEMORY_TYPE.GAMEBOY_MEMORY] = saveState.wasmboyMemory.gameBoyMemory.buffer;
      workerMemoryObject[MEMORY_TYPE.PALETTE_MEMORY] = saveState.wasmboyMemory.wasmBoyPaletteMemory.buffer;
      workerMemoryObject[MEMORY_TYPE.INTERNAL_STATE] = saveState.wasmboyMemory.wasmBoyInternalState.buffer;
      await this.worker.postMessage(_objectSpread({
        type: WORKER_MESSAGE_TYPE.SET_MEMORY
      }, workerMemoryObject), [workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM], workerMemoryObject[MEMORY_TYPE.GAMEBOY_MEMORY], workerMemoryObject[MEMORY_TYPE.PALETTE_MEMORY], workerMemoryObject[MEMORY_TYPE.INTERNAL_STATE]]);
      await this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.GET_MEMORY,
        memoryTypes: [MEMORY_TYPE.CARTRIDGE_RAM, MEMORY_TYPE.GAMEBOY_MEMORY, MEMORY_TYPE.PALETTE_MEMORY, MEMORY_TYPE.INTERNAL_STATE]
      }).then(event => {
        const eventData = getEventData(event);
        this.cartridgeRam = eventData.message[MEMORY_TYPE.CARTRIDGE_RAM];
        this.gameboyMemory = eventData.message[MEMORY_TYPE.GAMEBOY_MEMORY];
        this.paletteMemory = eventData.message[MEMORY_TYPE.PALETTE_MEMORY];
        this.internalState = eventData.message[MEMORY_TYPE.INTERNAL_STATE];
      });
    };

    return loadStateTask();
  } // Function to return the current cartridge object


  getCartridgeObject() {
    return idbKeyval.get(this.cartridgeHeader);
  } // Function to return all informationh aboyut the currently loaded cart.
  // This will include, the ROM, the RAM, the header, and the indivudal pieces of the header
  // See: http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header


  getCartridgeInfo() {
    if (!this.loadedCartridgeMemoryState.ROM) {
      return Promise.reject('No ROM has been loaded');
    }

    let getCartridgeInfoTask = async () => {
      const cartridgeInfo = {};
      cartridgeInfo.header = this.cartridgeHeader;
      cartridgeInfo.ROM = this.cartridgeRom;
      cartridgeInfo.RAM = this.cartridgeRam; // Now parse our header for additional information

      cartridgeInfo.nintendoLogo = cartridgeInfo.ROM.slice(0x104, 0x134);
      cartridgeInfo.title = cartridgeInfo.ROM.slice(0x134, 0x144);
      cartridgeInfo.titleAsString = String.fromCharCode.apply(null, cartridgeInfo.title);
      cartridgeInfo.manufacturerCode = cartridgeInfo.ROM.slice(0x13f, 0x143);
      cartridgeInfo.CGBFlag = cartridgeInfo.ROM[0x143];
      cartridgeInfo.newLicenseeCode = cartridgeInfo.ROM.slice(0x144, 0x146);
      cartridgeInfo.SGBFlag = cartridgeInfo.ROM[0x146];
      cartridgeInfo.cartridgeType = cartridgeInfo.ROM[0x147];
      cartridgeInfo.ROMSize = cartridgeInfo.ROM[0x148];
      cartridgeInfo.RAMSize = cartridgeInfo.ROM[0x149];
      cartridgeInfo.destinationCode = cartridgeInfo.ROM[0x14a];
      cartridgeInfo.oldLicenseeCode = cartridgeInfo.ROM[0x14b];
      cartridgeInfo.maskROMVersionNumber = cartridgeInfo.ROM[0x14c];
      cartridgeInfo.headerChecksum = cartridgeInfo.ROM[0x14d];
      cartridgeInfo.globalChecksum = cartridgeInfo.ROM.slice(0x14e, 0x150);
      return cartridgeInfo;
    };

    return getCartridgeInfoTask();
  }

  _initializeConstants() {
    // Initialize our cached wasm constants
    return this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.GET_CONSTANTS
    }).then(event => {
      const eventData = getEventData(event);
      Object.keys(this).forEach(key => {
        if (eventData.message[key] !== undefined) {
          this[key] = eventData.message[key];
        }
      });
    });
  }

} // Create a singleton to export


const WasmBoyMemory = new WasmBoyMemoryService();

function d(a){for(var b=1;b<arguments.length;b++){var c=null!=arguments[b]?arguments[b]:{},e=Object.keys(c);"function"===typeof Object.getOwnPropertySymbols&&(e=e.concat(Object.getOwnPropertySymbols(c).filter(function(a){return Object.getOwnPropertyDescriptor(c,a).enumerable})));e.forEach(function(b){var e=c[b];b in a?Object.defineProperty(a,b,{value:e,enumerable:!0,configurable:!0,writable:!0}):a[b]=e;});}return a}
let g={DPAD_UP:"DPAD_UP",DPAD_RIGHT:"DPAD_RIGHT",DPAD_DOWN:"DPAD_DOWN",DPAD_LEFT:"DPAD_LEFT",LEFT_ANALOG_HORIZONTAL_AXIS:"LEFT_ANALOG_HORIZONTAL_AXIS",LEFT_ANALOG_VERTICAL_AXIS:"LEFT_ANALOG_VERTICAL_AXIS",LEFT_ANALOG_UP:"LEFT_ANALOG_UP",LEFT_ANALOG_RIGHT:"LEFT_ANALOG_RIGHT",LEFT_ANALOG_DOWN:"LEFT_ANALOG_DOWN",LEFT_ANALOG_LEFT:"LEFT_ANALOG_LEFT",RIGHT_ANALOG_HORIZONTAL_AXIS:"RIGHT_ANALOG_HORIZONTAL_AXIS",RIGHT_ANALOG_VERTICAL_AXIS:"RIGHT_ANALOG_VERTICAL_AXIS",RIGHT_ANALOG_UP:"RIGHT_ANALOG_UP",RIGHT_ANALOG_RIGHT:"RIGHT_ANALOG_RIGHT",
RIGHT_ANALOG_DOWN:"RIGHT_ANALOG_DOWN",RIGHT_ANALOG_LEFT:"RIGHT_ANALOG_LEFT",A:"A",B:"B",X:"X",Y:"Y",LEFT_TRIGGER:"LEFT_TRIGGER",LEFT_BUMPER:"LEFT_BUMPER",RIGHT_TRIGGER:"RIGHT_TRIGGER",RIGHT_BUMPER:"RIGHT_BUMPER",SELECT:"SELECT",START:"START",SPECIAL:"SPECIAL"};class h{constructor(){}enable(){throw Error("enable() must be overridden");}disable(){throw Error("disable() must be overridden");}getState(){throw Error("getState() must be overridden");}}
let k="input textarea button select option optgroup label datalist".split(" "),l=["Alt","Control","Meta","OS"];
class m extends h{constructor(){super();this.keymap={};Object.keys(g).forEach((a)=>{this.keymap[a]={keys:[],value:void 0};});this.enableIgnoreWhenInputElementFocused();this.enableIgnoreWhenModifierState();this._boundUpdateKeymapValues=this._updateKeymapValues.bind(this);}enable(){if("undefined"===typeof window)throw Error("Keyboard can only be used with a browser environment");window.addEventListener("keyup",this._boundUpdateKeymapValues);window.addEventListener("keydown",this._boundUpdateKeymapValues);}disable(){if("undefined"===
typeof window)throw Error("Keyboard can only be used with a browser environment");window.removeEventListener("keyup",this._boundUpdateKeymapValues);window.removeEventListener("keydown",this._boundUpdateKeymapValues);}getState(){let a=d({},g);Object.keys(this.keymap).forEach((b)=>{a[b]=this.keymap[b].value;});Object.keys(a).forEach((b)=>{"string"===typeof a[b]&&delete a[b];});return a}enableIgnoreWhenInputElementFocused(){this.ignoreWhenInputElementFocused=!0;}disableIgnoreWhenInputElementFocused(){this.ignoreWhenInputElementFocused=
!1;}enableIgnoreWhenModifierState(){this.ignoreOnModifierState=!0;}disableIgnoreWhenModifierState(){this.ignoreOnModifierState=!1;}setKeysToResponsiveGamepadInput(a,b){if(!a||!b||0===a.length)throw Error("Could not set the specificed keyboard keys to input");"string"===typeof a&&(a=[a]);this.keymap[b].keys=a;}_isFocusedOnInputElement(){return k.some((a)=>document.activeElement&&document.activeElement.tagName.toLowerCase()===a.toLowerCase()?!0:!1)}_isInModifierState(a){return l.some((b)=>a.getModifierState(b)||
a.code===b)}_updateKeymapValues(a){this.ignoreWhenInputElementFocused&&this._isFocusedOnInputElement()||this.ignoreOnModifierState&&this._isInModifierState(a)||(a.preventDefault(),Object.keys(this.keymap).some((b)=>this.keymap[b].keys.some((c)=>c===a.code?(this.keymap[b].value="keydown"===a.type?!0:!1,!0):!1)));}}
class n extends h{constructor(){super();this.gamepadAnalogStickDeadZone=.25;this.keymap={};}enable(){}disable(){}getState(a){let b=this._getGamepads();a||(a=0);let c=b[a];if(!c)return !1;Object.keys(this.keymap).forEach((a)=>{if(this.keymap[a].buttons)this.keymap[a].value=this.keymap[a].buttons.some((a)=>this._isButtonPressed(c,a));else if(this.keymap[a].axis){let b=this._getAnalogStickAxis(c,this.keymap[a].axis);this.keymap[a].value=b;}});let e=d({},g);Object.keys(this.keymap).forEach((a)=>{e[a]=this.keymap[a].value;});
e[g.LEFT_ANALOG_DOWN]=e.LEFT_ANALOG_VERTICAL_AXIS>this.gamepadAnalogStickDeadZone;e[g.LEFT_ANALOG_UP]=e.LEFT_ANALOG_VERTICAL_AXIS<-1*this.gamepadAnalogStickDeadZone;e[g.LEFT_ANALOG_RIGHT]=e.LEFT_ANALOG_HORIZONTAL_AXIS>this.gamepadAnalogStickDeadZone;e[g.LEFT_ANALOG_LEFT]=e.LEFT_ANALOG_HORIZONTAL_AXIS<-1*this.gamepadAnalogStickDeadZone;e[g.RIGHT_ANALOG_DOWN]=e.RIGHT_ANALOG_VERTICAL_AXIS>this.gamepadAnalogStickDeadZone;e[g.RIGHT_ANALOG_UP]=e.RIGHT_ANALOG_VERTICAL_AXIS<-1*this.gamepadAnalogStickDeadZone;
e[g.RIGHT_ANALOG_RIGHT]=e.RIGHT_ANALOG_HORIZONTAL_AXIS>this.gamepadAnalogStickDeadZone;e[g.RIGHT_ANALOG_LEFT]=e.RIGHT_ANALOG_HORIZONTAL_AXIS<-1*this.gamepadAnalogStickDeadZone;Object.keys(e).forEach((a)=>{"string"===typeof e[a]&&delete e[a];});return e}setGamepadButtonsToResponsiveGamepadInput(a,b){if(!a||!b||0===a.length)throw Error("Could not set the specificed buttons to input");"number"===typeof a&&(a=[a]);this.keymap[b]={};this.keymap[b].buttons=a;}setGamepadAxisToResponsiveGamepadInput(a,b){if(void 0===
a||!b)throw Error("Could not set the specificed buttons to input");if("number"===typeof axes)throw Error("Must pass in an axis id");this.keymap[b]={};this.keymap[b].axis=a;}_isButtonPressed(a,b){return a.buttons[b]?a.buttons[b].pressed:!1}_getGamepads(){return navigator.getGamepads?navigator.getGamepads():[]}_getAnalogStickAxis(a,b){return a?a.axes[b]||0:0}}let q="touchstart touchmove touchend mousedown mousemove mouseup mouseleave".split(" ");
class r{constructor(a){if(!a)throw Error("Touch inputs require an element.");this.listeners=[];this.element=a;this._addTouchStyles();this.boundingClientRect=void 0;this._updateElementBoundingClientRect();this.active=!1;this.boundUpdateElementRect=this._updateElementBoundingClientRect.bind(this);this.boundTouchEvent=this._touchEvent.bind(this);}remove(){this._removeTouchStyles();this.stopListening();this.element=void 0;}listen(){if(!this.element)throw Error("You must supply an element first with add()");
window.addEventListener("resize",this.boundUpdateElementRect);q.forEach((a)=>{this.element.addEventListener(a,this.boundTouchEvent);});}stopListening(){if(!this.element)throw Error("You must supply an element first with add()");window.removeEventListener("resize",this.boundUpdateElementRect);q.forEach((a)=>{this.element.removeEventListener(a,this.boundTouchEvent);});}_touchEvent(a){if(a&&(!a.type.includes("touch")||a.touches)){a.preventDefault();var b="touchstart"===a.type||"touchmove"===a.type||"mousedown"===
a.type,c="mousemove"===a.type,e=!b&&!c;this._updateActiveStatus(b,e);this._updateTouchStyles(b,c,e);if(this.onTouchEvent)this.onTouchEvent(a,b,c,e);}}_updateElementBoundingClientRect(){this.boundingClientRect=this.element.getBoundingClientRect();}_addTouchStyles(){this.element.style.userSelect="none";}_removeTouchStyles(){this.element.style.userSelect="";}_updateTouchStyles(a,b){b||(a?this.element.classList.add("active"):this.element.classList.remove("active"));}_updateActiveStatus(a,b){this.active&&b?
this.active=!1:!this.active&&a&&(this.active=!0);}}function t(a,b){let c;a.type.includes("touch")?c=a.touches[0]:a.type.includes("mouse")&&(c=a);return {rectCenterX:(b.right-b.left)/2,rectCenterY:(b.bottom-b.top)/2,touchX:c.clientX-b.left,touchY:c.clientY-b.top}}
class u extends r{constructor(a,b){super(a);this.config=b?b:{allowMultipleDirections:!1};this._resetState();}_resetState(){this.state={DPAD_UP:!1,DPAD_RIGHT:!1,DPAD_DOWN:!1,DPAD_LEFT:!1};}onTouchEvent(a){if(this.active){var {rectCenterX:a,rectCenterY:b,touchX:c,touchY:e}=t(a,this.boundingClientRect);if(!(c>a+this.boundingClientRect.width/2+50)){this._resetState();var f=this.boundingClientRect.width/20,p=this.boundingClientRect.height/20;this.config.allowMultipleDirections?(this.setHorizontalState(c,
f),this.setVerticalState(e,p)):Math.abs(a-c)+this.boundingClientRect.width/8>Math.abs(b-e)?this.setHorizontalState(c,f):this.setVerticalState(e);}}else this._resetState();}setHorizontalState(a,b){b&&Math.abs(this.boundingClientRect.width/2-a)<=b||(a<this.boundingClientRect.width/2?this.state.DPAD_LEFT=!0:this.state.DPAD_RIGHT=!0);}setVerticalState(a,b){b&&Math.abs(this.boundingClientRect.height/2-a)<b||(a<this.boundingClientRect.height/2?this.state.DPAD_UP=!0:this.state.DPAD_DOWN=!0);}}
class v extends r{constructor(a){super(a);this._resetState();}_resetState(){this.state={HORIZONTAL_AXIS:0,VERTICAL_AXIS:0,UP:!1,RIGHT:!1,DOWN:!1,LEFT:!1};this.element.style.transform="translate(0px, 0px)";this.deadzone=.5;}onTouchEvent(a){if(this.active){var {rectCenterX:a,rectCenterY:b,touchX:c,touchY:e}=t(a,this.boundingClientRect);c=(c-a)/a;1<c?c=1:-1>c&&(c=-1);e=(e-b)/b;1<e?e=1:-1>e&&(e=-1);this.element.style.transform=`translate(${a*c/2}px, ${b*e/2}px)`;this.state.HORIZONTAL_AXIS=c;this.state.VERTICAL_AXIS=
e;this.state.UP=!1;this.state.RIGHT=!1;this.state.DOWN=!1;this.state.LEFT=!1;Math.abs(c)>this.deadzone&&(0<c?this.state.RIGHT=!0:0>c&&(this.state.LEFT=!0));Math.abs(e)>this.deadzone&&(0<e?this.state.DOWN=!0:0>e&&(this.state.UP=!0));}else this._resetState();}}class w extends r{constructor(a,b){super(a);this.input=b;}}let x={LEFT:"LEFT",RIGHT:"RIGHT"};
class y extends h{constructor(){super();this.enabled=!1;this.dpads=[];this.leftAnalogs=[];this.rightAnalogs=[];this.buttons=[];}enable(){if("undefined"===typeof window)throw Error("TouchInput can only be used with a browser environment");this.enabled=!0;this.dpads.forEach((a)=>a.listen());this.leftAnalogs.forEach((a)=>a.listen());this.rightAnalogs.forEach((a)=>a.listen());this.buttons.forEach((a)=>a.listen());}disable(){if("undefined"===typeof window)throw Error("TouchInput can only be used with a browser environment");
this.enabled=!1;this.dpads.forEach((a)=>a.stopListening());this.leftAnalogs.forEach((a)=>a.stopListening());this.rightAnalogs.forEach((a)=>a.stopListening());this.buttons.forEach((a)=>a.stopListening());}getState(){let a=d({},g);this.buttons.forEach((b)=>{a[b.input]=b.active;});this.dpads.forEach((b)=>{Object.keys(b.state).forEach((c)=>{a[c]=b.state[c]||a[c];});});0<this.leftAnalogs.length&&(a.LEFT_ANALOG_HORIZONTAL_AXIS=this.leftAnalogs[0].state.HORIZONTAL_AXIS,a.LEFT_ANALOG_VERTICAL_AXIS=this.leftAnalogs[0].state.VERTICAL_AXIS,
a.LEFT_ANALOG_UP=this.leftAnalogs[0].state.UP,a.LEFT_ANALOG_RIGHT=this.leftAnalogs[0].state.RIGHT,a.LEFT_ANALOG_DOWN=this.leftAnalogs[0].state.DOWN,a.LEFT_ANALOG_LEFT=this.leftAnalogs[0].state.LEFT);0<this.rightAnalogs.length&&(a.RIGHT_ANALOG_HORIZONTAL_AXIS=this.rightAnalogs[0].state.HORIZONTAL_AXIS,a.RIGHT_ANALOG_VERTICAL_AXIS=this.rightAnalogs[0].state.VERTICAL_AXIS,a.RIGHT_ANALOG_UP=this.rightAnalogs[0].state.UP,a.RIGHT_ANALOG_RIGHT=this.rightAnalogs[0].state.RIGHT,a.RIGHT_ANALOG_DOWN=this.rightAnalogs[0].state.DOWN,
a.RIGHT_ANALOG_LEFT=this.rightAnalogs[0].state.LEFT);Object.keys(a).forEach((b)=>{"string"===typeof a[b]&&delete a[b];});return a}addButtonInput(a,b){let c=new w(a,b);this.enabled&&c.listen();this.buttons.push(c);return ()=>{c.stopListening();this.buttons.splice(this.buttons.indexOf(c),1);}}addDpadInput(a,b){let c=new u(a,b);this.enabled&&c.listen();this.dpads.push(c);return ()=>{c.stopListening();this.dpads.splice(this.dpads.indexOf(c),1);}}addLeftAnalogInput(a){this.addAnalogInput(a,x.LEFT);}addRightAnalogInput(a){this.addAnalogInput(a,
x.RIGHT);}addAnalogInput(a,b){let c=new v(a);this.enabled&&c.listen();if(b===x.LEFT)return this.leftAnalogs.push(c),()=>{c.stopListening();this.leftAnalogs.splice(this.leftAnalogs.indexOf(c),1);};this.rightAnalogs.push(c);return ()=>{c.stopListening();this.rightAnalogs.splice(this.rightAnalogs.indexOf(c),1);}}}
class z{constructor(){this.RESPONSIVE_GAMEPAD_INPUTS=g;this._enabled=!1;this._multipleDirectionInput=!0;this.Keyboard=new m;this.Gamepad=new n;this.TouchInput=new y;this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowUp","Numpad8"],g.DPAD_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyW"],g.LEFT_ANALOG_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyI"],g.RIGHT_ANALOG_UP);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([12],g.DPAD_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowRight",
"Numpad6"],g.DPAD_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyD"],g.LEFT_ANALOG_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyL"],g.RIGHT_ANALOG_RIGHT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([15],g.DPAD_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowDown","Numpad5","Numpad2"],g.DPAD_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyS"],g.LEFT_ANALOG_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyK"],g.RIGHT_ANALOG_DOWN);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([13],
g.DPAD_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowLeft","Numpad4"],g.DPAD_LEFT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyA"],g.LEFT_ANALOG_LEFT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyJ"],g.RIGHT_ANALOG_LEFT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([14],g.DPAD_LEFT);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([0],g.LEFT_ANALOG_HORIZONTAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([1],g.LEFT_ANALOG_VERTICAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([2],
g.RIGHT_ANALOG_HORIZONTAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([3],g.RIGHT_ANALOG_VERTICAL_AXIS);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyX","Semicolon","Numpad7"],g.A);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([0],g.A);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyZ","Escape","Quote","Backspace","Numpad9"],g.B);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([1],g.B);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyC"],g.X);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([2],
g.X);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyV"],g.Y);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([3],g.Y);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyQ"],g.LEFT_TRIGGER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([6],g.LEFT_TRIGGER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyE"],g.LEFT_BUMPER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([4],g.LEFT_BUMPER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyU"],g.RIGHT_TRIGGER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([7],
g.RIGHT_TRIGGER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyO"],g.RIGHT_BUMPER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([5],g.RIGHT_BUMPER);this.Keyboard.setKeysToResponsiveGamepadInput(["Enter","Numpad3"],g.START);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([9],g.START);this.Keyboard.setKeysToResponsiveGamepadInput(["ShiftRight","ShiftLeft","Tab","Numpad1"],g.SELECT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([8],g.SELECT);this.Keyboard.setKeysToResponsiveGamepadInput(["Space",
"Backslash","Backquote"],g.SPECIAL);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([16],g.SPECIAL);this.plugins=[];this.inputChangeMap={};this.inputChangeOldState={};this.cancelInputChangeListener=void 0;}getVersion(){return "1.0.0"}enable(){this.Keyboard.enable();this.Gamepad.enable();this.TouchInput.enable();0<Object.keys(this.inputChangeMap).length&&this._startInputChangeInterval();this._enabled=!0;}disable(){this.Keyboard.disable();this.Gamepad.disable();this.TouchInput.disable();this.cancelInputChangeListener&&
(this.cancelInputChangeListener(),this.cancelInputChangeListener=void 0);this._enabled=!1;}isEnabled(){return this._enabled}addPlugin(a){this.plugins.push(a);if(a.onAddPlugin)a.onAddPlugin();return ()=>{if(a.onRemovePlugin)a.onRemovePlugin();this.plugins.splice(this.plugins.indexOf(a),1);}}getState(){if(!this._enabled)return {};let a=d({},g),b=this.Gamepad.getState(),c=this.TouchInput.getState(),e=this.Keyboard.getState();a=d({},g);Object.keys(a).forEach((f)=>{a[f]=b[f]||c[f]||e[f];});["LEFT","RIGHT"].forEach((b)=>
{[g[`${b}_ANALOG_HORIZONTAL_AXIS`],g[`${b}_ANALOG_VERTICAL_AXIS`]].forEach((c,e)=>{if("number"!==typeof a[c]){if(0===e||2===e)a[c]=a[g[`${b}_ANALOG_RIGHT`]]?1:a[g[`${b}_ANALOG_LEFT`]]?-1:0;if(1===e||3===e)a[c]=a[g[`${b}_ANALOG_UP`]]?-1:a[g[`${b}_ANALOG_DOWN`]]?1:0;}});});a.UP=a.DPAD_UP||a.LEFT_ANALOG_UP;a.RIGHT=a.DPAD_RIGHT||a.LEFT_ANALOG_RIGHT;a.DOWN=a.DPAD_DOWN||a.LEFT_ANALOG_DOWN;a.LEFT=a.DPAD_LEFT||a.LEFT_ANALOG_LEFT;Object.keys(a).forEach((b)=>{if(void 0===a[b]||"string"===typeof a[b])a[b]=!1;});
this.plugins.forEach((b)=>{b.onGetState&&(b=b.onGetState(a))&&(this.state=b);});return a}onInputsChange(a,b){"string"===typeof a&&(a=[a]);this.inputChangeMap[a]={codes:a,callback:b};this.cancelInputChangeListener||this._startInputChangeInterval();return ()=>{delete this.inputChangeMap[a];}}_startInputChangeInterval(){let a=setInterval(this._inputChangeIntervalHandler.bind(this),16);this.cancelInputChangeListener=()=>clearInterval(a);}_inputChangeIntervalHandler(){let a=this.getState(),b=[];Object.keys(a).forEach((c)=>
{a[c]!==this.inputChangeOldState[c]&&b.push(c);});Object.keys(this.inputChangeMap).forEach((c)=>{this.inputChangeMap[c].codes.some((a)=>b.includes(a))&&this.inputChangeMap[c].callback(a);});this.inputChangeOldState=a;}}let A=new z;var ResponsiveGamepad=A;

// Responsive Gamepad plugin to simulate GB Inputs
function ResponsiveGamepadPluginGB() {
  return {
    onGetState: state => {
      const gamepadA = state.A;
      const gamepadB = state.B;
      state.A = gamepadA || state.X;
      state.B = gamepadB || state.Y;
      return state;
    }
  };
}

// https://github.com/torch2424/responsive-gamepad

class WasmBoyControllerService {
  constructor() {
    // Our wasm instance
    this.worker = undefined;
    this.isEnabled = false; // Bind Repsonsive Gamepad to this

    this.ResponsiveGamepad = ResponsiveGamepad;
    ResponsiveGamepad.addPlugin(ResponsiveGamepadPluginGB());
  }

  initialize() {
    if (!this.isEnabled) {
      this.enableDefaultJoypad();
    }

    return Promise.resolve();
  }

  setWorker(worker) {
    this.worker = worker;
  }

  updateController() {
    if (!this.isEnabled) {
      return {};
    } // Create an abstracted controller state


    const controllerState = ResponsiveGamepad.getState(); // Set the new controller state on the instance

    this.setJoypadState(controllerState); // Return the controller state in case we need something from it

    return controllerState;
  }

  setJoypadState(controllerState) {
    const setJoypadStateParamsAsArray = [controllerState.UP ? 1 : 0, controllerState.RIGHT ? 1 : 0, controllerState.DOWN ? 1 : 0, controllerState.LEFT ? 1 : 0, controllerState.A ? 1 : 0, controllerState.B ? 1 : 0, controllerState.SELECT ? 1 : 0, controllerState.START ? 1 : 0];
    this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.SET_JOYPAD_STATE,
      setJoypadStateParamsAsArray
    });
  }

  enableDefaultJoypad() {
    this.isEnabled = true;
    ResponsiveGamepad.enable();
  }

  disableDefaultJoypad() {
    this.isEnabled = false;
    ResponsiveGamepad.disable();
  }

}

const WasmBoyController = new WasmBoyControllerService();

var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIHhhKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gYmEoYSxiKXtIYT9zZWxmLnBvc3RNZXNzYWdlKGEsYik6UmEucG9zdE1lc3NhZ2UoYSxiKX1mdW5jdGlvbiB5YShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKEhhKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKEhhKXNlbGYub25tZXNzYWdlPWE7ZWxzZSBSYS5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gTyhhLGIsZSl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksSWErKyxiPWAke2J9LSR7SWF9YCwxRTU8SWEmJihJYT0wKSk7cmV0dXJue3dvcmtlcklkOmUsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBDYihhLGIpe2I9eGEoYik7CnN3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBDLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZnJhbWVJblByb2dyZXNzVmlkZW9PdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCksYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX1NJWkUudmFsdWVPZigpLGEuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE8oe3R5cGU6Qy5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBEYihhLGIpe2I9eGEoYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIEMuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE8oe3R5cGU6Qy5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEMuQVVESU9fTEFURU5DWTphLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9Yi5tZXNzYWdlLmxhdGVuY3l9fWZ1bmN0aW9uIEViKGEsYil7Yj14YShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgQy5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gZmIoYSl7aWYoIWEud2FzbUJ5dGVNZW1vcnkpcmV0dXJuIG5ldyBVaW50OEFycmF5OwpsZXQgYj1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN10sZT12b2lkIDA7aWYoMD09PWIpcmV0dXJuIG5ldyBVaW50OEFycmF5OzE8PWImJjM+PWI/ZT0zMjc2ODo1PD1iJiY2Pj1iP2U9MjA0ODoxNTw9YiYmMTk+PWI/ZT0zMjc2ODoyNTw9YiYmMzA+PWImJihlPTEzMTA3Mik7cmV0dXJuIGU/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2UpOm5ldyBVaW50OEFycmF5fWZ1bmN0aW9uIGdiKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gRmIoYSxiKXtiPXhhKGIpOwpzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgQy5DTEVBUl9NRU1PUlk6Zm9yKHZhciBjPTA7Yzw9YS53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7YysrKWEud2FzbUJ5dGVNZW1vcnlbY109MDtjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoMCk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE8oe3R5cGU6Qy5DTEVBUl9NRU1PUllfRE9ORSx3YXNtQnl0ZU1lbW9yeTpjLmJ1ZmZlcn0sYi5tZXNzYWdlSWQpLFtjLmJ1ZmZlcl0pO2JyZWFrO2Nhc2UgQy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCk7CmEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTyh7dHlwZTpDLkdFVF9DT05TVEFOVFNfRE9ORSwKV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lUmFtQmFua3NMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVMb2NhdGlvbi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLlNFVF9NRU1PUlk6Yz1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2MuaW5jbHVkZXMoRS5DQVJUUklER0VfUk9NKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0UuQ0FSVFJJREdFX1JPTV0pLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEUuQ0FSVFJJREdFX1JBTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtFLkNBUlRSSURHRV9SQU1dKSxhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04pO2MuaW5jbHVkZXMoRS5HQU1FQk9ZX01FTU9SWSkmJgphLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbRS5HQU1FQk9ZX01FTU9SWV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04pO2MuaW5jbHVkZXMoRS5QQUxFVFRFX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtFLlBBTEVUVEVfTUVNT1JZXSksYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEUuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0UuSU5URVJOQUxfU1RBVEVdKSxhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04pLGEud2FzbUluc3RhbmNlLmV4cG9ydHMubG9hZFN0YXRlKCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShPKHt0eXBlOkMuU0VUX01FTU9SWV9ET05FfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5HRVRfTUVNT1JZOntjPXt0eXBlOkMuR0VUX01FTU9SWX07CmNvbnN0IGU9W107dmFyIHk9Yi5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKHkuaW5jbHVkZXMoRS5DQVJUUklER0VfUk9NKSl7aWYoYS53YXNtQnl0ZU1lbW9yeSl7dmFyIHY9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddO3ZhciBkPXZvaWQgMDswPT09dj9kPTMyNzY4OjE8PXYmJjM+PXY/ZD0yMDk3MTUyOjU8PXYmJjY+PXY/ZD0yNjIxNDQ6MTU8PXYmJjE5Pj12P2Q9MjA5NzE1MjoyNTw9diYmMzA+PXYmJihkPTgzODg2MDgpO3Y9ZD9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK2QpOm5ldyBVaW50OEFycmF5fWVsc2Ugdj1uZXcgVWludDhBcnJheTt2PXYuYnVmZmVyO2NbRS5DQVJUUklER0VfUk9NXT12O2UucHVzaCh2KX15LmluY2x1ZGVzKEUuQ0FSVFJJREdFX1JBTSkmJih2PWZiKGEpLmJ1ZmZlcixjW0UuQ0FSVFJJREdFX1JBTV09diwKZS5wdXNoKHYpKTt5LmluY2x1ZGVzKEUuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5Pyh2PWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCx2PWEud2FzbUJ5dGVNZW1vcnkuc2xpY2Uodix2KzI3KSk6dj1uZXcgVWludDhBcnJheSx2PXYuYnVmZmVyLGNbRS5DQVJUUklER0VfSEVBREVSXT12LGUucHVzaCh2KSk7eS5pbmNsdWRlcyhFLkdBTUVCT1lfTUVNT1JZKSYmKHY9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsY1tFLkdBTUVCT1lfTUVNT1JZXT12LGUucHVzaCh2KSk7eS5pbmNsdWRlcyhFLlBBTEVUVEVfTUVNT1JZKSYmKHY9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGNbRS5QQUxFVFRFX01FTU9SWV09dixlLnB1c2godikpO3kuaW5jbHVkZXMoRS5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLHk9Z2IoYSkuYnVmZmVyLGNbRS5JTlRFUk5BTF9TVEFURV09eSxlLnB1c2goeSkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShPKGMsYi5tZXNzYWdlSWQpLGUpfX19ZnVuY3Rpb24gayhhLGIpe3JldHVybihhJjI1NSk8PDh8YiYyNTV9ZnVuY3Rpb24gRyhhKXtyZXR1cm4oYSY2NTI4MCk+Pjh9ZnVuY3Rpb24gSChhLGIpe3JldHVybiBiJn4oMTw8YSl9ZnVuY3Rpb24gbihhLGIpe3JldHVybiAwIT0oYiYxPDxhKX1mdW5jdGlvbiBTYShhKXt2YXIgYj1hO24oNyxiKSYmKGI9LTEqKDI1Ni1hKSk7cmV0dXJuIGJ9ZnVuY3Rpb24gSmEoYSxjKXthPTE8PGEmMjU1O2IucmVnaXN0ZXJGPTA8Yz9iLnJlZ2lzdGVyRnxhOmIucmVnaXN0ZXJGJgooMjU1XmEpO3JldHVybiBiLnJlZ2lzdGVyRn1mdW5jdGlvbiBsKGEpe0phKDcsYSl9ZnVuY3Rpb24gdChhKXtKYSg2LGEpfWZ1bmN0aW9uIEQoYSl7SmEoNSxhKX1mdW5jdGlvbiB1KGEpe0phKDQsYSl9ZnVuY3Rpb24gcmEoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjcmMX1mdW5jdGlvbiBVKCl7cmV0dXJuIGIucmVnaXN0ZXJGPj40JjF9ZnVuY3Rpb24gUyhhLGIpezA8PWI/MCE9PSgoYSYxNSkrKGImMTUpJjE2KT9EKDEpOkQoMCk6KE1hdGguYWJzKGIpJjE1KT4oYSYxNSk/RCgxKTpEKDApfWZ1bmN0aW9uIFRhKGEsYil7MDw9Yj9hPihhK2ImMjU1KT91KDEpOnUoMCk6TWF0aC5hYnMoYik+YT91KDEpOnUoMCl9ZnVuY3Rpb24gdWEoYSxiLGUpe2U/KGE9YV5iXmErYiwwIT09KGEmMTYpP0QoMSk6RCgwKSwwIT09KGEmMjU2KT91KDEpOnUoMCkpOihlPWErYiY2NTUzNSxlPGE/dSgxKTp1KDApLDAhPT0oKGFeYl5lKSY0MDk2KT9EKDEpOkQoMCkpfWZ1bmN0aW9uIEthKGEsYixlKXt2b2lkIDA9PT0KZSYmKGU9ITEpO3ZhciBjPWE7ZXx8KGM9eChiKT4+MiphJjMpO2E9MjQyO3N3aXRjaChjKXtjYXNlIDE6YT0xNjA7YnJlYWs7Y2FzZSAyOmE9ODg7YnJlYWs7Y2FzZSAzOmE9OH1yZXR1cm4gYX1mdW5jdGlvbiBMYShhLGIsZSl7Yj04KmErMipiO2E9aGIoYisxLGUpO2U9aGIoYixlKTtyZXR1cm4gayhhLGUpfWZ1bmN0aW9uIGRhKGEsYil7cmV0dXJuIDgqKChiJjMxPDw1KmEpPj41KmEpfWZ1bmN0aW9uIGhiKGEsYil7YSY9NjM7YiYmKGErPTY0KTtyZXR1cm4gZ1s2NzU4NCthXX1mdW5jdGlvbiBNYShhLGIsZSx5KXt2b2lkIDA9PT1lJiYoZT0wKTt2b2lkIDA9PT15JiYoeT0hMSk7ZSY9Mzt5JiYoZXw9NCk7Z1s2OTYzMisoMTYwKmIrYSldPWV9ZnVuY3Rpb24gaWIoYSxiLGUseSx2LGQsaCxmLGwscCxrLG0seCl7dmFyIGM9MDtiPXphKGIsYSk7YT1hYShiKzIqZCxlKTtlPWFhKGIrMipkKzEsZSk7Zm9yKGQ9eTtkPD12O2QrKylpZihiPWgrKGQteSksYjxsKXt2YXIgSz1kO2lmKDA+Cnh8fCFuKDUseCkpSz03LUs7dmFyIHZhPTA7bihLLGUpJiYodmErPTEsdmE8PD0xKTtuKEssYSkmJih2YSs9MSk7aWYoMDw9eCl7dmFyIHQ9TGEoeCY3LHZhLCExKTtLPWRhKDAsdCk7dmFyIHc9ZGEoMSx0KTt0PWRhKDIsdCl9ZWxzZSAwPj1tJiYobT1yLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLHc9Sz10PUthKHZhLG0sayk7dmFyIHE9MyooZipsK2IpO2dbcCtxXT1LO2dbcCtxKzFdPXc7Z1twK3ErMl09dDtLPSExOzA8PXgmJihLPW4oNyx4KSk7TWEoYixmLHZhLEspO2MrK31yZXR1cm4gY31mdW5jdGlvbiB6YShhLGIpe2lmKGE9PT1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQpe3ZhciBjPWIrMTI4O24oNyxiKSYmKGM9Yi0xMjgpO3JldHVybiBhKzE2KmN9cmV0dXJuIGErMTYqYn1mdW5jdGlvbiBqYihhLGIpe3N3aXRjaChhKXtjYXNlIDE6cmV0dXJuIG4oYiwxMjkpO2Nhc2UgMjpyZXR1cm4gbihiLDEzNSk7Y2FzZSAzOnJldHVybiBuKGIsCjEyNik7ZGVmYXVsdDpyZXR1cm4gbihiLDEpfX1mdW5jdGlvbiBrYigpe3ZhciBhPWxiKCk7MjA0Nz49YSYmMDx6Lk5SeDBTd2VlcFNoaWZ0JiYoei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1hLHouc2V0RnJlcXVlbmN5KGEpLGE9bGIoKSk7MjA0NzxhJiYoei5pc0VuYWJsZWQ9ITEpfWZ1bmN0aW9uIGxiKCl7dmFyIGE9ei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeTthPj49ei5OUngwU3dlZXBTaGlmdDtyZXR1cm4gYT16Lk5SeDBOZWdhdGU/ei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeS1hOnouc3dlZXBTaGFkb3dGcmVxdWVuY3krYX1mdW5jdGlvbiBOYShhKXtzd2l0Y2goYSl7Y2FzZSB6LmNoYW5uZWxOdW1iZXI6aWYody5jaGFubmVsMURhY0VuYWJsZWQhPT16LmlzRGFjRW5hYmxlZClyZXR1cm4gdy5jaGFubmVsMURhY0VuYWJsZWQ9ei5pc0RhY0VuYWJsZWQsITA7YnJlYWs7Y2FzZSBMLmNoYW5uZWxOdW1iZXI6aWYody5jaGFubmVsMkRhY0VuYWJsZWQhPT1MLmlzRGFjRW5hYmxlZClyZXR1cm4gdy5jaGFubmVsMkRhY0VuYWJsZWQ9CkwuaXNEYWNFbmFibGVkLCEwO2JyZWFrO2Nhc2UgSS5jaGFubmVsTnVtYmVyOmlmKHcuY2hhbm5lbDNEYWNFbmFibGVkIT09SS5pc0RhY0VuYWJsZWQpcmV0dXJuIHcuY2hhbm5lbDNEYWNFbmFibGVkPUkuaXNEYWNFbmFibGVkLCEwO2JyZWFrO2Nhc2UgTS5jaGFubmVsTnVtYmVyOmlmKHcuY2hhbm5lbDREYWNFbmFibGVkIT09TS5pc0RhY0VuYWJsZWQpcmV0dXJuIHcuY2hhbm5lbDREYWNFbmFibGVkPU0uaXNEYWNFbmFibGVkLCEwfXJldHVybiExfWZ1bmN0aW9uIE9hKCl7aWYoIShmLmN1cnJlbnRDeWNsZXM8Zi5iYXRjaFByb2Nlc3NDeWNsZXMoKSkpZm9yKDtmLmN1cnJlbnRDeWNsZXM+PWYuYmF0Y2hQcm9jZXNzQ3ljbGVzKCk7KW1iKGYuYmF0Y2hQcm9jZXNzQ3ljbGVzKCkpLGYuY3VycmVudEN5Y2xlcy09Zi5iYXRjaFByb2Nlc3NDeWNsZXMoKX1mdW5jdGlvbiBtYihhKXtmLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXIrPWE7aWYoZi5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPj0KZi5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzKCkpe2YuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlci09Zi5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzKCk7c3dpdGNoKGYuZnJhbWVTZXF1ZW5jZXIpe2Nhc2UgMDp6LnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtNLnVwZGF0ZUxlbmd0aCgpO2JyZWFrO2Nhc2UgMjp6LnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtNLnVwZGF0ZUxlbmd0aCgpO3oudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDQ6ei51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO0kudXBkYXRlTGVuZ3RoKCk7TS51cGRhdGVMZW5ndGgoKTticmVhaztjYXNlIDY6ei51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO0kudXBkYXRlTGVuZ3RoKCk7TS51cGRhdGVMZW5ndGgoKTt6LnVwZGF0ZVN3ZWVwKCk7YnJlYWs7Y2FzZSA3OnoudXBkYXRlRW52ZWxvcGUoKSxMLnVwZGF0ZUVudmVsb3BlKCksCk0udXBkYXRlRW52ZWxvcGUoKX1mLmZyYW1lU2VxdWVuY2VyKz0xOzg8PWYuZnJhbWVTZXF1ZW5jZXImJihmLmZyYW1lU2VxdWVuY2VyPTApO3ZhciBiPSEwfWVsc2UgYj0hMTtpZihWLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXMmJiFiKXtiPXoud2lsbENoYW5uZWxVcGRhdGUoYSl8fE5hKHouY2hhbm5lbE51bWJlcik7dmFyIGU9TC53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8TmEoTC5jaGFubmVsTnVtYmVyKSx5PUkud2lsbENoYW5uZWxVcGRhdGUoYSl8fE5hKEkuY2hhbm5lbE51bWJlciksdj1NLndpbGxDaGFubmVsVXBkYXRlKGEpfHxOYShNLmNoYW5uZWxOdW1iZXIpO2ImJih3LmNoYW5uZWwxU2FtcGxlPXouZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtlJiYody5jaGFubmVsMlNhbXBsZT1MLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7eSYmKHcuY2hhbm5lbDNTYW1wbGU9SS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO3YmJih3LmNoYW5uZWw0U2FtcGxlPU0uZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTsKaWYoYnx8ZXx8eXx8dil3Lm5lZWRUb1JlbWl4U2FtcGxlcz0hMDtmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXIrPWEqZi5kb3duU2FtcGxlQ3ljbGVNdWx0aXBsaWVyO2YuZG93blNhbXBsZUN5Y2xlQ291bnRlcj49Zi5tYXhEb3duU2FtcGxlQ3ljbGVzKCkmJihmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXItPWYubWF4RG93blNhbXBsZUN5Y2xlcygpLCh3Lm5lZWRUb1JlbWl4U2FtcGxlc3x8dy5taXhlclZvbHVtZUNoYW5nZWR8fHcubWl4ZXJFbmFibGVkQ2hhbmdlZCkmJm5iKHcuY2hhbm5lbDFTYW1wbGUsdy5jaGFubmVsMlNhbXBsZSx3LmNoYW5uZWwzU2FtcGxlLHcuY2hhbm5lbDRTYW1wbGUpLGE9dy5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGUrMSxiPTU4ODgwMCsyKmYuYXVkaW9RdWV1ZUluZGV4LGdbYl09dy5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZSsxKzEsZ1tiKzFdPWErMSxmLmF1ZGlvUXVldWVJbmRleCs9MSxmLmF1ZGlvUXVldWVJbmRleD49KGYud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemUvCjJ8MCktMSYmLS1mLmF1ZGlvUXVldWVJbmRleCl9ZWxzZSBiPXouZ2V0U2FtcGxlKGEpfDAsZT1MLmdldFNhbXBsZShhKXwwLHk9SS5nZXRTYW1wbGUoYSl8MCx2PU0uZ2V0U2FtcGxlKGEpfDAsdy5jaGFubmVsMVNhbXBsZT1iLHcuY2hhbm5lbDJTYW1wbGU9ZSx3LmNoYW5uZWwzU2FtcGxlPXksdy5jaGFubmVsNFNhbXBsZT12LGYuZG93blNhbXBsZUN5Y2xlQ291bnRlcis9YSpmLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXIsZi5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPj1mLm1heERvd25TYW1wbGVDeWNsZXMoKSYmKGYuZG93blNhbXBsZUN5Y2xlQ291bnRlci09Zi5tYXhEb3duU2FtcGxlQ3ljbGVzKCksYT1uYihiLGUseSx2KSxiPUcoYSksZT01ODg4MDArMipmLmF1ZGlvUXVldWVJbmRleCxnW2VdPWIrMSsxLGdbZSsxXT0oYSYyNTUpKzIsZi5hdWRpb1F1ZXVlSW5kZXgrPTEsZi5hdWRpb1F1ZXVlSW5kZXg+PShmLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplLzJ8MCktMSYmLS1mLmF1ZGlvUXVldWVJbmRleCl9CmZ1bmN0aW9uIFVhKCl7cmV0dXJuIGYuYXVkaW9RdWV1ZUluZGV4fWZ1bmN0aW9uIFZhKCl7Zi5hdWRpb1F1ZXVlSW5kZXg9MH1mdW5jdGlvbiBuYihhLGIsZSx5KXt2b2lkIDA9PT1hJiYoYT0xNSk7dm9pZCAwPT09YiYmKGI9MTUpO3ZvaWQgMD09PWUmJihlPTE1KTt2b2lkIDA9PT15JiYoeT0xNSk7dy5taXhlclZvbHVtZUNoYW5nZWQ9ITE7dmFyIGM9MCxkPTA7Yz1mLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD9jK2E6YysxNTtjPWYuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0P2MrYjpjKzE1O2M9Zi5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ/YytlOmMrMTU7Yz1mLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD9jK3k6YysxNTtkPWYuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD9kK2E6ZCsxNTtkPWYuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD9kK2I6ZCsxNTtkPWYuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD8KZCtlOmQrMTU7ZD1mLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCt5OmQrMTU7dy5taXhlckVuYWJsZWRDaGFuZ2VkPSExO3cubmVlZFRvUmVtaXhTYW1wbGVzPSExO2E9b2IoYyxmLk5SNTBMZWZ0TWl4ZXJWb2x1bWUrMSk7ZD1vYihkLGYuTlI1MFJpZ2h0TWl4ZXJWb2x1bWUrMSk7dy5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT1hO3cucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPWQ7cmV0dXJuIGsoYSxkKX1mdW5jdGlvbiBvYihhLGIpe2lmKDYwPT09YSlyZXR1cm4gMTI3O2E9MUU1KihhLTYwKSpiLzh8MDthPWEvMUU1fDA7YSs9NjA7YT0xRTUqYS8oMTJFNi8yNTR8MCl8MDtyZXR1cm4gYXw9MH1mdW5jdGlvbiBBYShhKXtQYSghMSk7dmFyIGM9eChwLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCk7Yz1IKGEsYyk7cC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9YztoKHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LGMpOwpiLnN0YWNrUG9pbnRlci09MjtiLmlzSGFsdGVkKCk7Yz1iLnN0YWNrUG9pbnRlcjt2YXIgZT1iLnByb2dyYW1Db3VudGVyLHk9RyhlKSxkPWMrMTtoKGMsZSYyNTUpO2goZCx5KTtzd2l0Y2goYSl7Y2FzZSBwLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0OnAuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7Yi5wcm9ncmFtQ291bnRlcj02NDticmVhaztjYXNlIHAuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ6cC5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTcyO2JyZWFrO2Nhc2UgcC5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0OnAuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTgwO2JyZWFrO2Nhc2UgcC5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdDpwLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9ODg7YnJlYWs7Y2FzZSBwLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0OnAuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9CiExLGIucHJvZ3JhbUNvdW50ZXI9OTZ9fWZ1bmN0aW9uIHdhKGEpe3ZhciBiPXgocC5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpO2J8PTE8PGE7cC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9YjtoKHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LGIpfWZ1bmN0aW9uIFBhKGEpe2E/cC5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMDpwLm1hc3RlckludGVycnVwdFN3aXRjaD0hMX1mdW5jdGlvbiBXYShhKXtmb3IodmFyIGI9MDtiPGE7KXt2YXIgZT1tLmRpdmlkZXJSZWdpc3RlcjtiKz00O20uZGl2aWRlclJlZ2lzdGVyKz00OzY1NTM1PG0uZGl2aWRlclJlZ2lzdGVyJiYobS5kaXZpZGVyUmVnaXN0ZXItPTY1NTM2KTttLnRpbWVyRW5hYmxlZCYmKG0udGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT8obS50aW1lckNvdW50ZXI9bS50aW1lck1vZHVsbyxwLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsd2EocC5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0KSwKbS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExLG0udGltZXJDb3VudGVyV2FzUmVzZXQ9ITApOm0udGltZXJDb3VudGVyV2FzUmVzZXQmJihtLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExKSxwYihlLG0uZGl2aWRlclJlZ2lzdGVyKSYmWGEoKSl9fWZ1bmN0aW9uIFhhKCl7bS50aW1lckNvdW50ZXIrPTE7MjU1PG0udGltZXJDb3VudGVyJiYobS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSEwLG0udGltZXJDb3VudGVyPTApfWZ1bmN0aW9uIHBiKGEsYil7dmFyIGM9WWEobS50aW1lcklucHV0Q2xvY2spO3JldHVybiBuKGMsYSkmJiFuKGMsYik/ITA6ITF9ZnVuY3Rpb24gWWEoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gOTtjYXNlIDE6cmV0dXJuIDM7Y2FzZSAyOnJldHVybiA1O2Nhc2UgMzpyZXR1cm4gN31yZXR1cm4gMH1mdW5jdGlvbiBzYShhKXt2YXIgYz1iLmlzU3RvcHBlZD0hMTtHYihhKXx8KGM9ITApO2ZhKGEsITApO2MmJihjPSExLDM+PWEmJihjPSEwKSxhPSExLApBLmlzRHBhZFR5cGUmJmMmJihhPSEwKSxBLmlzQnV0dG9uVHlwZSYmIWMmJihhPSEwKSxhJiYocC5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD0hMCx3YShwLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0KSkpfWZ1bmN0aW9uIEdiKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIEEudXA7Y2FzZSAxOnJldHVybiBBLnJpZ2h0O2Nhc2UgMjpyZXR1cm4gQS5kb3duO2Nhc2UgMzpyZXR1cm4gQS5sZWZ0O2Nhc2UgNDpyZXR1cm4gQS5hO2Nhc2UgNTpyZXR1cm4gQS5iO2Nhc2UgNjpyZXR1cm4gQS5zZWxlY3Q7Y2FzZSA3OnJldHVybiBBLnN0YXJ0O2RlZmF1bHQ6cmV0dXJuITF9fWZ1bmN0aW9uIGZhKGEsYil7c3dpdGNoKGEpe2Nhc2UgMDpBLnVwPWI7YnJlYWs7Y2FzZSAxOkEucmlnaHQ9YjticmVhaztjYXNlIDI6QS5kb3duPWI7YnJlYWs7Y2FzZSAzOkEubGVmdD1iO2JyZWFrO2Nhc2UgNDpBLmE9YjticmVhaztjYXNlIDU6QS5iPWI7YnJlYWs7Y2FzZSA2OkEuc2VsZWN0PWI7YnJlYWs7CmNhc2UgNzpBLnN0YXJ0PWJ9fWZ1bmN0aW9uIHFiKGEsYyxlKXtmb3IodmFyIHk9MDt5PGU7eSsrKXtmb3IodmFyIHY9WmEoYSt5KSxnPWMreTs0MDk1OTxnOylnLT04MTkyO1FhKGcsdikmJmgoZyx2KX1hPTMyO2IuR0JDRG91YmxlU3BlZWQmJihhPTY0KTtkLkRNQUN5Y2xlcys9ZS8xNiphfWZ1bmN0aW9uIFFhKGEsYyl7aWYoYT09PWIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaClyZXR1cm4gaChiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gsYyYxKSwhMTt2YXIgZT1kLnZpZGVvUmFtTG9jYXRpb24seT1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbjtpZihhPGUpe2lmKCFkLmlzUm9tT25seSlpZig4MTkxPj1hKXtpZighZC5pc01CQzJ8fG4oNCxjKSljJj0xNSwwPT09Yz9kLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE6MTA9PT1jJiYoZC5pc1JhbUJhbmtpbmdFbmFibGVkPSEwKX1lbHNlIDE2MzgzPj1hPyFkLmlzTUJDNXx8MTIyODc+PWE/KGQuaXNNQkMyJiYoZC5jdXJyZW50Um9tQmFuaz0KYyYxNSksZC5pc01CQzE/KGMmPTMxLGQuY3VycmVudFJvbUJhbmsmPTIyNCk6ZC5pc01CQzM/KGMmPTEyNyxkLmN1cnJlbnRSb21CYW5rJj0xMjgpOmQuaXNNQkM1JiYoZC5jdXJyZW50Um9tQmFuayY9MCksZC5jdXJyZW50Um9tQmFua3w9Yyk6KGE9MCxlPWQuY3VycmVudFJvbUJhbmsmMjU1LDA8YyYmKGE9MSksZC5jdXJyZW50Um9tQmFuaz1rKGEsZSkpOiFkLmlzTUJDMiYmMjQ1NzU+PWE/ZC5pc01CQzEmJmQuaXNNQkMxUm9tTW9kZUVuYWJsZWQ/KGQuY3VycmVudFJvbUJhbmsmPTMxLGQuY3VycmVudFJvbUJhbmt8PWMmMjI0KTooYz1kLmlzTUJDNT9jJjE1OmMmMyxkLmN1cnJlbnRSYW1CYW5rPWMpOiFkLmlzTUJDMiYmMzI3Njc+PWEmJmQuaXNNQkMxJiYobigwLGMpP2QuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA6ZC5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMSk7cmV0dXJuITF9aWYoYT49ZSYmYTxkLmNhcnRyaWRnZVJhbUxvY2F0aW9uKXJldHVybiEwO2lmKGE+PWQuZWNob1JhbUxvY2F0aW9uJiYKYTx5KXJldHVybiBoKGEtODE5MixjKSwhMDtpZihhPj15JiZhPD1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZClyZXR1cm4gMj5CLmN1cnJlbnRMY2RNb2RlPyExOiEwO2lmKGE+PWQudW51c2FibGVNZW1vcnlMb2NhdGlvbiYmYTw9ZC51bnVzYWJsZU1lbW9yeUVuZExvY2F0aW9uKXJldHVybiExO2lmKGE9PT1OLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sKXJldHVybiBOLnVwZGF0ZVRyYW5zZmVyQ29udHJvbChjKTtpZig2NTI5Njw9YSYmNjUzMTg+PWEpe09hKCk7aWYoYT09PWYubWVtb3J5TG9jYXRpb25OUjUyfHxmLk5SNTJJc1NvdW5kRW5hYmxlZCl7c3dpdGNoKGEpe2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDA6ei51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDA6SS51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDE6ei51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDE6TC51cGRhdGVOUngxKGMpOwpicmVhaztjYXNlIEkubWVtb3J5TG9jYXRpb25OUngxOkkudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIE0ubWVtb3J5TG9jYXRpb25OUngxOk0udXBkYXRlTlJ4MShjKTticmVhaztjYXNlIHoubWVtb3J5TG9jYXRpb25OUngyOnoudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUngyOkwudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEkubWVtb3J5TG9jYXRpb25OUngyOkkudm9sdW1lQ29kZUNoYW5nZWQ9ITA7SS51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgTS5tZW1vcnlMb2NhdGlvbk5SeDI6TS51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDM6ei51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDM6TC51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDM6SS51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgTS5tZW1vcnlMb2NhdGlvbk5SeDM6TS51cGRhdGVOUngzKGMpOwpicmVhaztjYXNlIHoubWVtb3J5TG9jYXRpb25OUng0Om4oNyxjKSYmKHoudXBkYXRlTlJ4NChjKSx6LnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4NDpuKDcsYykmJihMLnVwZGF0ZU5SeDQoYyksTC50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDQ6big3LGMpJiYoSS51cGRhdGVOUng0KGMpLEkudHJpZ2dlcigpKTticmVhaztjYXNlIE0ubWVtb3J5TG9jYXRpb25OUng0Om4oNyxjKSYmKE0udXBkYXRlTlJ4NChjKSxNLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBmLm1lbW9yeUxvY2F0aW9uTlI1MDpmLnVwZGF0ZU5SNTAoYyk7dy5taXhlclZvbHVtZUNoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBmLm1lbW9yeUxvY2F0aW9uTlI1MTpmLnVwZGF0ZU5SNTEoYyk7dy5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO2JyZWFrO2Nhc2UgZi5tZW1vcnlMb2NhdGlvbk5SNTI6aWYoZi51cGRhdGVOUjUyKGMpLCFuKDcsYykpZm9yKGM9NjUyOTY7NjUzMTg+CmM7YysrKWgoYywwKX1jPSEwfWVsc2UgYz0hMTtyZXR1cm4gY302NTMyODw9YSYmNjUzNDM+PWEmJk9hKCk7aWYoYT49Qi5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wmJmE8PXIubWVtb3J5TG9jYXRpb25XaW5kb3dYKXtpZihhPT09Qi5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wpcmV0dXJuIEIudXBkYXRlTGNkQ29udHJvbChjKSwhMDtpZihhPT09Qi5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cylyZXR1cm4gQi51cGRhdGVMY2RTdGF0dXMoYyksITE7aWYoYT09PXIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyKXJldHVybiByLnNjYW5saW5lUmVnaXN0ZXI9MCxoKGEsMCksITE7aWYoYT09PUIubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmUpcmV0dXJuIEIuY29pbmNpZGVuY2VDb21wYXJlPWMsITA7aWYoYT09PXIubWVtb3J5TG9jYXRpb25EbWFUcmFuc2Zlcil7Yzw8PTg7Zm9yKGE9MDsxNTk+PWE7YSsrKWU9eChjK2EpLGgoZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24rCmEsZSk7ZC5ETUFDeWNsZXM9NjQ0O3JldHVybiEwfXN3aXRjaChhKXtjYXNlIHIubWVtb3J5TG9jYXRpb25TY3JvbGxYOnIuc2Nyb2xsWD1jO2JyZWFrO2Nhc2Ugci5tZW1vcnlMb2NhdGlvblNjcm9sbFk6ci5zY3JvbGxZPWM7YnJlYWs7Y2FzZSByLm1lbW9yeUxvY2F0aW9uV2luZG93WDpyLndpbmRvd1g9YzticmVhaztjYXNlIHIubWVtb3J5TG9jYXRpb25XaW5kb3dZOnIud2luZG93WT1jfXJldHVybiEwfWlmKGE9PT1kLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpcmV0dXJuIGIuR0JDRW5hYmxlZCYmKGQuaXNIYmxhbmtIZG1hQWN0aXZlJiYhbig3LGMpPyhkLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMSxjPXgoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyKSxoKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcixjfDEyOCkpOihhPXgoZC5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VIaWdoKSxlPXgoZC5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VMb3cpLGE9ayhhLGUpJjY1NTIwLAplPXgoZC5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkhpZ2gpLHk9eChkLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uTG93KSxlPWsoZSx5KSxlPShlJjgxNzYpK2QudmlkZW9SYW1Mb2NhdGlvbix5PUgoNyxjKSx5PTE2Kih5KzEpLG4oNyxjKT8oZC5pc0hibGFua0hkbWFBY3RpdmU9ITAsZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc9eSxkLmhibGFua0hkbWFTb3VyY2U9YSxkLmhibGFua0hkbWFEZXN0aW5hdGlvbj1lLGgoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLEgoNyxjKSkpOihxYihhLGUseSksaChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMjU1KSkpKSwhMTtpZigoYT09PWQubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFua3x8YT09PWQubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmJmQuaXNIYmxhbmtIZG1hQWN0aXZlJiYoMTYzODQ8PWQuaGJsYW5rSGRtYVNvdXJjZSYmMzI3Njc+PWQuaGJsYW5rSGRtYVNvdXJjZXx8NTMyNDg8PQpkLmhibGFua0hkbWFTb3VyY2UmJjU3MzQzPj1kLmhibGFua0hkbWFTb3VyY2UpKXJldHVybiExO2lmKGE+PUJhLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVJbmRleCYmYTw9QmEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7aWYoYT09PUJhLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVEYXRhfHxhPT09QmEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7ZT14KGEtMSk7ZT1IKDYsZSk7eT0hMTthPT09QmEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSYmKHk9ITApO3ZhciB2PWUmNjM7eSYmKHYrPTY0KTtnWzY3NTg0K3ZdPWM7Yz1lOy0tYTtuKDcsYykmJmgoYSxjKzF8MTI4KX1yZXR1cm4hMH1pZihhPj1tLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyJiZhPD1tLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sKXtXYShtLmN1cnJlbnRDeWNsZXMpO20uY3VycmVudEN5Y2xlcz0wO3N3aXRjaChhKXtjYXNlIG0ubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXI6cmV0dXJuIG0udXBkYXRlRGl2aWRlclJlZ2lzdGVyKGMpLAohMTtjYXNlIG0ubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI6bS51cGRhdGVUaW1lckNvdW50ZXIoYyk7YnJlYWs7Y2FzZSBtLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG86bS51cGRhdGVUaW1lck1vZHVsbyhjKTticmVhaztjYXNlIG0ubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w6bS51cGRhdGVUaW1lckNvbnRyb2woYyl9cmV0dXJuITB9YT09PUEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3RlciYmQS51cGRhdGVKb3lwYWQoYyk7aWYoYT09PXAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KXJldHVybiBwLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZChjKSwhMDthPT09cC5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQmJnAudXBkYXRlSW50ZXJydXB0RW5hYmxlZChjKTtyZXR1cm4hMH1mdW5jdGlvbiAkYShhKXtzd2l0Y2goYT4+MTIpe2Nhc2UgMDpjYXNlIDE6Y2FzZSAyOmNhc2UgMzpyZXR1cm4gYSs4NTA5NDQ7Y2FzZSA0OmNhc2UgNTpjYXNlIDY6Y2FzZSA3OnZhciBjPQpkLmN1cnJlbnRSb21CYW5rO2QuaXNNQkM1fHwwIT09Y3x8KGM9MSk7cmV0dXJuIDE2Mzg0KmMrKGEtZC5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb24pKzg1MDk0NDtjYXNlIDg6Y2FzZSA5OnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz14KGQubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmMSksYS1kLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKmM7Y2FzZSAxMDpjYXNlIDExOnJldHVybiA4MTkyKmQuY3VycmVudFJhbUJhbmsrKGEtZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbikrNzE5ODcyO2Nhc2UgMTI6cmV0dXJuIGEtZC5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzI7Y2FzZSAxMzpyZXR1cm4gYz0wLGIuR0JDRW5hYmxlZCYmKGM9eChkLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmspJjcpLDE+YyYmKGM9MSksYS1kLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbisxODQzMis0MDk2KihjLTEpO2RlZmF1bHQ6cmV0dXJuIGEtZC5lY2hvUmFtTG9jYXRpb24rCjUxMjAwfX1mdW5jdGlvbiBoKGEsYil7YT0kYShhKTtnW2FdPWJ9ZnVuY3Rpb24gUShhLGIpe2dbYV09Yj8xOjB9ZnVuY3Rpb24gcmIoYSl7ci5zY2FubGluZUN5Y2xlQ291bnRlcj0wO3Iuc2NhbmxpbmVSZWdpc3Rlcj0wO2goci5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIsMCk7dmFyIGI9eChCLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTtiPUgoMSxiKTtiPUgoMCxiKTtCLmN1cnJlbnRMY2RNb2RlPTA7aChCLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGIpO2lmKGEpZm9yKGE9MDs1MjEyMTY+YTthKyspZ1s2NzU4NCthXT0yNTV9ZnVuY3Rpb24gc2IoYSxiKXt2YXIgYz1CLmNvaW5jaWRlbmNlQ29tcGFyZTswIT09YSYmMSE9PWF8fHIuc2NhbmxpbmVSZWdpc3RlciE9PWM/Yj1IKDIsYik6KGJ8PTQsbig2LGIpJiYocC5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMCx3YShwLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSkpO3JldHVybiBifWZ1bmN0aW9uIHRiKGEsYyxlLAp5LGQsaCl7Zm9yKHZhciB2PXk+PjM7MTYwPmQ7ZCsrKXt2YXIgZj1kK2g7MjU2PD1mJiYoZi09MjU2KTt2YXIgbD1lKzMyKnYrKGY+PjMpLEs9YWEobCwwKSxwPSExO2lmKFYudGlsZUNhY2hpbmcpe3ZhciBtPWQ7dmFyIGs9YSx0PWYscT1sLHc9Syx1PTA7aWYoMDxrJiY4PG0mJnc9PT1oYS50aWxlSWQmJm09PT1oYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjayl7dmFyIHo9dz0hMTtuKDUseChxLTEpKSYmKHc9ITApO24oNSx4KHEpKSYmKHo9ITApO2ZvcihxPTA7OD5xO3ErKylpZih3IT09eiYmKHE9Ny1xKSwxNjA+PW0rcSl7Zm9yKHZhciBCPW0tKDgtcSksQz05MzE4NCszKigxNjAqaysobStxKSksQT0wOzM+QTtBKyspY2EobStxLGssQSxnW0MrQV0pO0I9Z1s2OTYzMisoMTYwKmsrQildO01hKG0rcSxrLEgoMixCKSxuKDIsQikpO3UrK319ZWxzZSBoYS50aWxlSWQ9dzttPj1oYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjayYmKGhhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrPQptKzgsaz10JTgsbTxrJiYoaGEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2srPWspKTttPXU7MDxtJiYoZCs9bS0xLHA9ITApfVYudGlsZVJlbmRlcmluZyYmIXA/KHA9ZCxtPWEsdT1jLGs9eSU4LHQ9MCwwPT1wJiYodD1mLWYvOCo4KSxmPTcsMTYwPHArOCYmKGY9MTYwLXApLHc9LTEsej0wLGIuR0JDRW5hYmxlZCYmKHc9YWEobCwxKSxuKDMsdykmJih6PTEpLG4oNix3KSYmKGs9Ny1rKSksbT1pYihLLHUseix0LGYsayxwLG0sMTYwLDkzMTg0LCExLDAsdyksMDxtJiYoZCs9bS0xKSk6cHx8KGIuR0JDRW5hYmxlZD8ocD1kLG09YSxrPXksdT16YShjLEspLGw9YWEobCwxKSxrJT04LG4oNixsKSYmKGs9Ny1rKSx0PTAsbigzLGwpJiYodD0xKSxLPWFhKHUrMiprLHQpLHU9YWEodSsyKmsrMSx0KSxrPWYlOCxuKDUsbCl8fChrPTctayksZj0wLG4oayx1KSYmKGY9ZisxPDwxKSxuKGssSykmJihmKz0xKSxrPUxhKGwmNyxmLCExKSxLPWRhKDAsayksdT1kYSgxLGspLGs9ZGEoMiwKayksY2EocCxtLDAsSyksY2EocCxtLDEsdSksY2EocCxtLDIsayksTWEocCxtLGYsbig3LGwpKSk6KGw9ZCxwPWEsdT15LG09emEoYyxLKSx1JT04LEs9YWEobSsyKnUsMCksbT1hYShtKzIqdSsxLDApLHU9Ny1mJTgsZj0wLG4odSxtKSYmKGY9ZisxPDwxKSxuKHUsSykmJihmKz0xKSxLPUthKGYsci5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlKSxjYShsLHAsMCxLKSxjYShsLHAsMSxLKSxjYShsLHAsMixLKSxNYShsLHAsZikpKX19ZnVuY3Rpb24gdWIoYSl7aWYoQi5lbmFibGVkKWZvcihyLnNjYW5saW5lQ3ljbGVDb3VudGVyKz1hO3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXI+PXIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTspe3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXItPXIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTthPXIuc2NhbmxpbmVSZWdpc3RlcjtpZigxNDQ9PT1hKXtpZihWLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nKWZvcih2YXIgYj0wOzE0ND49CmI7YisrKWFiKGIpO2Vsc2UgYWIoYSk7Zm9yKGI9MDsxNDQ+YjtiKyspZm9yKHZhciBlPTA7MTYwPmU7ZSsrKWdbNjk2MzIrKDE2MCpiK2UpXT0wO2hhLnRpbGVJZD0tMTtoYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz0tMX1lbHNlIDE0ND5hJiYoVi5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZ3x8YWIoYSkpO2E9MTUzPGE/MDphKzE7ci5zY2FubGluZVJlZ2lzdGVyPWF9aWYoQi5lbmFibGVkKWlmKGI9ci5zY2FubGluZVJlZ2lzdGVyLGU9Qi5jdXJyZW50TGNkTW9kZSxhPTAsMTQ0PD1iP2E9MTpyLnNjYW5saW5lQ3ljbGVDb3VudGVyPj1yLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERSgpP2E9MjpyLnNjYW5saW5lQ3ljbGVDb3VudGVyPj1yLk1JTl9DWUNMRVNfVFJBTlNGRVJfREFUQV9MQ0RfTU9ERSgpJiYoYT0zKSxlIT09YSl7Yj14KEIubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO0IuY3VycmVudExjZE1vZGU9YTtlPSExO3N3aXRjaChhKXtjYXNlIDA6Yj0KSCgwLGIpO2I9SCgxLGIpO2U9bigzLGIpO2JyZWFrO2Nhc2UgMTpiPUgoMSxiKTtifD0xO2U9big0LGIpO2JyZWFrO2Nhc2UgMjpiPUgoMCxiKTtifD0yO2U9big1LGIpO2JyZWFrO2Nhc2UgMzpifD0zfWUmJihwLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSEwLHdhKHAuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpKTswPT09YSYmZC5pc0hibGFua0hkbWFBY3RpdmUmJihlPTE2LGQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPGUmJihlPWQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nKSxxYihkLmhibGFua0hkbWFTb3VyY2UsZC5oYmxhbmtIZG1hRGVzdGluYXRpb24sZSksZC5oYmxhbmtIZG1hU291cmNlKz1lLGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uKz1lLGQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nLT1lLDA+PWQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPyhkLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMSxoKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlciwKMjU1KSk6aChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsSCg3LGQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nLzE2LTEpKSk7MT09PWEmJihwLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPSEwLHdhKHAuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQpKTtiPXNiKGEsYik7aChCLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGIpfWVsc2UgMTUzPT09YiYmKGI9eChCLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKSxiPXNiKGEsYiksaChCLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGIpKX1mdW5jdGlvbiBhYihhKXt2YXIgYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ7Qi5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0JiYoYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCk7aWYoYi5HQkNFbmFibGVkfHxCLmJnRGlzcGxheUVuYWJsZWQpe3ZhciBlPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0O0IuYmdUaWxlTWFwRGlzcGxheVNlbGVjdCYmCihlPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpO3ZhciBkPXIuc2Nyb2xsWCx2PWErci5zY3JvbGxZOzI1Njw9diYmKHYtPTI1Nik7dGIoYSxjLGUsdiwwLGQpfUIud2luZG93RGlzcGxheUVuYWJsZWQmJihlPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0LEIud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3QmJihlPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpLGQ9ci53aW5kb3dYLHY9ci53aW5kb3dZLGE8dnx8KGQtPTcsdGIoYSxjLGUsYS12LGQsLTEqZCkpKTtpZihCLnNwcml0ZURpc3BsYXlFbmFibGUpZm9yKGM9Qi50YWxsU3ByaXRlU2l6ZSxlPTM5OzA8PWU7ZS0tKXt2PTQqZTt2YXIgZj14KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrdik7ZD14KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrdisxKTt2YXIgaD14KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrCnYrMik7Zi09MTY7ZC09ODt2YXIgbD04O2MmJihsPTE2LDE9PT1oJTImJi0taCk7aWYoYT49ZiYmYTxmK2wpe3Y9eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK3YrMyk7dmFyIG09big3LHYpLGs9big2LHYpLHA9big1LHYpO2Y9YS1mO2smJihmLT1sLGYqPS0xLC0tZik7Zio9MjtoPXphKHIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0LGgpO2w9aCs9ZjtmPTA7Yi5HQkNFbmFibGVkJiZuKDMsdikmJihmPTEpO2g9YWEobCxmKTtsPWFhKGwrMSxmKTtmb3IoZj03OzA8PWY7Zi0tKXtrPWY7cCYmKGstPTcsayo9LTEpO3ZhciBxPTA7bihrLGwpJiYocSs9MSxxPDw9MSk7bihrLGgpJiYocSs9MSk7aWYoMCE9PXEmJihrPWQrKDctZiksMDw9ayYmMTYwPj1rKSl7dmFyIHQ9ITEsdT0hMSx3PSExO2IuR0JDRW5hYmxlZCYmIUIuYmdEaXNwbGF5RW5hYmxlZCYmKHQ9ITApO2lmKCF0KXt2YXIgej1nWzY5NjMyKygxNjAqYStrKV0sQT16JjM7bSYmMDwKQT91PSEwOmIuR0JDRW5hYmxlZCYmbigyLHopJiYwPEEmJih3PSEwKX1pZih0fHwhdSYmIXcpYi5HQkNFbmFibGVkPyh1PUxhKHYmNyxxLCEwKSxxPWRhKDAsdSksdD1kYSgxLHUpLHU9ZGEoMix1KSxjYShrLGEsMCxxKSxjYShrLGEsMSx0KSxjYShrLGEsMix1KSk6KHQ9ci5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVPbmUsbig0LHYpJiYodD1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bykscT1LYShxLHQpLGNhKGssYSwwLHEpLGNhKGssYSwxLHEpLGNhKGssYSwyLHEpKX19fX19ZnVuY3Rpb24gY2EoYSxiLGUsZCl7Z1s5MzE4NCszKigxNjAqYithKStlXT1kfWZ1bmN0aW9uIGFhKGEsYil7cmV0dXJuIGdbYS1kLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKihiJjEpXX1mdW5jdGlvbiBiYihhKXt2YXIgYz1kLnZpZGVvUmFtTG9jYXRpb247cmV0dXJuIGE8Y3x8YT49YyYmYTxkLmNhcnRyaWRnZVJhbUxvY2F0aW9uPy0xOmE+PWQuZWNob1JhbUxvY2F0aW9uJiZhPApkLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj94KGEtODE5Mik6YT49ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24mJmE8PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uRW5kPzI+Qi5jdXJyZW50TGNkTW9kZT8yNTU6LTE6YT09PWIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaD8oYT0yNTUsYz14KGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCksbigwLGMpfHwoYT1IKDAsYSkpLGIuR0JDRG91YmxlU3BlZWR8fChhPUgoNyxhKSksYSk6YT09PXIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyPyhoKGEsci5zY2FubGluZVJlZ2lzdGVyKSxyLnNjYW5saW5lUmVnaXN0ZXIpOjY1Mjk2PD1hJiY2NTMxOD49YT8oT2EoKSxhPWE9PT1mLm1lbW9yeUxvY2F0aW9uTlI1Mj94KGYubWVtb3J5TG9jYXRpb25OUjUyKSYxMjh8MTEyOi0xLGEpOjY1MzI4PD1hJiY2NTM0Mz49YT8oT2EoKSwtMSk6YT09PW0ubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXI/CihjPUcobS5kaXZpZGVyUmVnaXN0ZXIpLGgoYSxjKSxjKTphPT09bS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcj8oaChhLG0udGltZXJDb3VudGVyKSxtLnRpbWVyQ291bnRlcik6YT09PXAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0PzIyNHxwLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZTphPT09QS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyPyhhPUEuam95cGFkUmVnaXN0ZXJGbGlwcGVkLEEuaXNEcGFkVHlwZT8oYT1BLnVwP0goMixhKTphfDQsYT1BLnJpZ2h0P0goMCxhKTphfDEsYT1BLmRvd24/SCgzLGEpOmF8OCxhPUEubGVmdD9IKDEsYSk6YXwyKTpBLmlzQnV0dG9uVHlwZSYmKGE9QS5hP0goMCxhKTphfDEsYT1BLmI/SCgxLGEpOmF8MixhPUEuc2VsZWN0P0goMixhKTphfDQsYT1BLnN0YXJ0P0goMyxhKTphfDgpLGF8MjQwKTotMX1mdW5jdGlvbiB4KGEpe3JldHVybiBnWyRhKGEpXX1mdW5jdGlvbiBaYShhKXt2YXIgYj1iYihhKTtzd2l0Y2goYil7Y2FzZSAtMTpyZXR1cm4geChhKTsKZGVmYXVsdDpyZXR1cm4gYn19ZnVuY3Rpb24gUihhKXtyZXR1cm4gMDxnW2FdPyEwOiExfWZ1bmN0aW9uIGlhKGEpe1MoYi5yZWdpc3RlckEsYSk7VGEoYi5yZWdpc3RlckEsYSk7Yi5yZWdpc3RlckE9Yi5yZWdpc3RlckErYSYyNTU7MD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKTt0KDApfWZ1bmN0aW9uIGphKGEpe3ZhciBjPWIucmVnaXN0ZXJBK2ErVSgpJjI1NTswIT0oKGIucmVnaXN0ZXJBXmFeYykmMTYpP0QoMSk6RCgwKTswPChiLnJlZ2lzdGVyQSthK1UoKSYyNTYpP3UoMSk6dSgwKTtiLnJlZ2lzdGVyQT1jOzA9PT1iLnJlZ2lzdGVyQT9sKDEpOmwoMCk7dCgwKX1mdW5jdGlvbiBrYShhKXt2YXIgYz0tMSphO1MoYi5yZWdpc3RlckEsYyk7VGEoYi5yZWdpc3RlckEsYyk7Yi5yZWdpc3RlckE9Yi5yZWdpc3RlckEtYSYyNTU7MD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKTt0KDEpfWZ1bmN0aW9uIGxhKGEpe3ZhciBjPWIucmVnaXN0ZXJBLWEtVSgpJjI1NTswIT0oKGIucmVnaXN0ZXJBXgphXmMpJjE2KT9EKDEpOkQoMCk7MDwoYi5yZWdpc3RlckEtYS1VKCkmMjU2KT91KDEpOnUoMCk7Yi5yZWdpc3RlckE9YzswPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApO3QoMSl9ZnVuY3Rpb24gbWEoYSl7Yi5yZWdpc3RlckEmPWE7MD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKTt0KDApO0QoMSk7dSgwKX1mdW5jdGlvbiBuYShhKXtiLnJlZ2lzdGVyQT0oYi5yZWdpc3RlckFeYSkmMjU1OzA9PT1iLnJlZ2lzdGVyQT9sKDEpOmwoMCk7dCgwKTtEKDApO3UoMCl9ZnVuY3Rpb24gb2EoYSl7Yi5yZWdpc3RlckF8PWE7MD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKTt0KDApO0QoMCk7dSgwKX1mdW5jdGlvbiBwYShhKXthKj0tMTtTKGIucmVnaXN0ZXJBLGEpO1RhKGIucmVnaXN0ZXJBLGEpOzA9PT1iLnJlZ2lzdGVyQSthP2woMSk6bCgwKTt0KDEpfWZ1bmN0aW9uIHRhKGEsYil7MD09PShiJjE8PGEpP2woMSk6bCgwKTt0KDApO0QoMSk7cmV0dXJuIGJ9ZnVuY3Rpb24gWihhLGIsZSl7cmV0dXJuIDA8CmI/ZXwxPDxhOmUmfigxPDxhKX1mdW5jdGlvbiBDYShhKXthPVNhKGEpO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcithJjY1NTM1O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1fWZ1bmN0aW9uIHZiKGEpe2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1O2IuaXNIYWx0QnVnJiYoYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyLTEmNjU1MzUpO3N3aXRjaCgoYSYyNDApPj40KXtjYXNlIDA6cmV0dXJuIEhiKGEpO2Nhc2UgMTpyZXR1cm4gSWIoYSk7Y2FzZSAyOnJldHVybiBKYihhKTtjYXNlIDM6cmV0dXJuIEtiKGEpO2Nhc2UgNDpyZXR1cm4gTGIoYSk7Y2FzZSA1OnJldHVybiBNYihhKTtjYXNlIDY6cmV0dXJuIE5iKGEpO2Nhc2UgNzpyZXR1cm4gT2IoYSk7Y2FzZSA4OnJldHVybiBQYihhKTtjYXNlIDk6cmV0dXJuIFFiKGEpO2Nhc2UgMTA6cmV0dXJuIFJiKGEpO2Nhc2UgMTE6cmV0dXJuIFNiKGEpOwpjYXNlIDEyOnJldHVybiBUYihhKTtjYXNlIDEzOnJldHVybiBVYihhKTtjYXNlIDE0OnJldHVybiBWYihhKTtkZWZhdWx0OnJldHVybiBXYihhKX19ZnVuY3Rpb24gSihhKXtxYSg0KTtyZXR1cm4gWmEoYSl9ZnVuY3Rpb24gVChhLGIpe3FhKDQpO1FhKGEsYikmJmgoYSxiKX1mdW5jdGlvbiBlYShhKXtxYSg4KTt2YXIgYj1iYihhKTtzd2l0Y2goYil7Y2FzZSAtMTpiPXgoYSl9YSs9MTt2YXIgZT1iYihhKTtzd2l0Y2goZSl7Y2FzZSAtMTphPXgoYSk7YnJlYWs7ZGVmYXVsdDphPWV9cmV0dXJuIGsoYSxiKX1mdW5jdGlvbiBXKGEsYil7cWEoOCk7dmFyIGM9RyhiKTtiJj0yNTU7dmFyIGQ9YSsxO1FhKGEsYikmJmgoYSxiKTtRYShkLGMpJiZoKGQsYyl9ZnVuY3Rpb24gRigpe3FhKDQpO3JldHVybiB4KGIucHJvZ3JhbUNvdW50ZXIpfWZ1bmN0aW9uIFkoKXtxYSg0KTt2YXIgYT14KGIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSk7cmV0dXJuIGsoYSxGKCkpfWZ1bmN0aW9uIEhiKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIDQ7CmNhc2UgMTpyZXR1cm4gYT1ZKCksYi5yZWdpc3RlckI9RyhhKSxiLnJlZ2lzdGVyQz1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjpyZXR1cm4gVChrKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxiLnJlZ2lzdGVyQSksNDtjYXNlIDM6cmV0dXJuIGE9ayhiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYSsrLGIucmVnaXN0ZXJCPUcoYSksYi5yZWdpc3RlckM9YSYyNTUsODtjYXNlIDQ6cmV0dXJuIFMoYi5yZWdpc3RlckIsMSksYi5yZWdpc3RlckI9Yi5yZWdpc3RlckIrMSYyNTUsMD09PWIucmVnaXN0ZXJCP2woMSk6bCgwKSx0KDApLDQ7Y2FzZSA1OnJldHVybiBTKGIucmVnaXN0ZXJCLC0xKSxiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQi0xJjI1NSwwPT09Yi5yZWdpc3RlckI/bCgxKTpsKDApLHQoMSksNDtjYXNlIDY6cmV0dXJuIGIucmVnaXN0ZXJCPUYoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSwKNDtjYXNlIDc6MTI4PT09KGIucmVnaXN0ZXJBJjEyOCk/dSgxKTp1KDApO2E9Yjt2YXIgYz1iLnJlZ2lzdGVyQTthLnJlZ2lzdGVyQT0oYzw8MXxjPj43KSYyNTU7bCgwKTt0KDApO0QoMCk7cmV0dXJuIDQ7Y2FzZSA4OnJldHVybiBXKFkoKSxiLnN0YWNrUG9pbnRlciksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDk6cmV0dXJuIGE9ayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYz1rKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSx1YShhLGMsITEpLGE9YStjJjY1NTM1LGIucmVnaXN0ZXJIPUcoYSksYi5yZWdpc3Rlckw9YSYyNTUsdCgwKSw4O2Nhc2UgMTA6cmV0dXJuIGIucmVnaXN0ZXJBPUooayhiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDQ7Y2FzZSAxMTpyZXR1cm4gYT1rKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyQj1HKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSAxMjpyZXR1cm4gUyhiLnJlZ2lzdGVyQywKMSksYi5yZWdpc3RlckM9Yi5yZWdpc3RlckMrMSYyNTUsMD09PWIucmVnaXN0ZXJDP2woMSk6bCgwKSx0KDApLDQ7Y2FzZSAxMzpyZXR1cm4gUyhiLnJlZ2lzdGVyQywtMSksYi5yZWdpc3RlckM9Yi5yZWdpc3RlckMtMSYyNTUsMD09PWIucmVnaXN0ZXJDP2woMSk6bCgwKSx0KDEpLDQ7Y2FzZSAxNDpyZXR1cm4gYi5yZWdpc3RlckM9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAxNTpyZXR1cm4gMDwoYi5yZWdpc3RlckEmMSk/dSgxKTp1KDApLGE9YixjPWIucmVnaXN0ZXJBLGEucmVnaXN0ZXJBPShjPj4xfGM8PDcpJjI1NSxsKDApLHQoMCksRCgwKSw0fXJldHVybi0xfWZ1bmN0aW9uIEliKGEpe3N3aXRjaChhKXtjYXNlIDE2OmlmKGIuR0JDRW5hYmxlZCYmKGE9SihiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLG4oMCxhKSkpcmV0dXJuIGE9SCgwLGEpLG4oNyxhKT8oYi5HQkNEb3VibGVTcGVlZD0hMSxhPUgoNyxhKSk6KGIuR0JDRG91YmxlU3BlZWQ9CiEwLGF8PTEyOCksVChiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gsYSksNjg7Yi5pc1N0b3BwZWQ9ITA7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7cmV0dXJuIDQ7Y2FzZSAxNzpyZXR1cm4gYT1ZKCksYi5yZWdpc3RlckQ9RyhhKSxiLnJlZ2lzdGVyRT1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMTg6cmV0dXJuIFQoayhiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSksYi5yZWdpc3RlckEpLDQ7Y2FzZSAxOTpyZXR1cm4gYT1rKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVyRD1HKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDg7Y2FzZSAyMDpyZXR1cm4gUyhiLnJlZ2lzdGVyRCwxKSxiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyRCsxJjI1NSwwPT09Yi5yZWdpc3RlckQ/bCgxKTpsKDApLHQoMCksNDtjYXNlIDIxOnJldHVybiBTKGIucmVnaXN0ZXJELC0xKSxiLnJlZ2lzdGVyRD0KYi5yZWdpc3RlckQtMSYyNTUsMD09PWIucmVnaXN0ZXJEP2woMSk6bCgwKSx0KDEpLDQ7Y2FzZSAyMjpyZXR1cm4gYi5yZWdpc3RlckQ9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMzpyZXR1cm4gYT0hMSwxMjg9PT0oYi5yZWdpc3RlckEmMTI4KSYmKGE9ITApLGIucmVnaXN0ZXJBPShiLnJlZ2lzdGVyQTw8MXxVKCkpJjI1NSxhP3UoMSk6dSgwKSxsKDApLHQoMCksRCgwKSw0O2Nhc2UgMjQ6cmV0dXJuIENhKEYoKSksODtjYXNlIDI1OmE9ayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9ayhiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSk7dWEoYSxjLCExKTthPWErYyY2NTUzNTtiLnJlZ2lzdGVySD1HKGEpO2IucmVnaXN0ZXJMPWEmMjU1O3QoMCk7cmV0dXJuIDg7Y2FzZSAyNjpyZXR1cm4gYT1rKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQT1KKGEpLDQ7Y2FzZSAyNzpyZXR1cm4gYT1rKGIucmVnaXN0ZXJELApiLnJlZ2lzdGVyRSksYT1hLTEmNjU1MzUsYi5yZWdpc3RlckQ9RyhhKSxiLnJlZ2lzdGVyRT1hJjI1NSw4O2Nhc2UgMjg6cmV0dXJuIFMoYi5yZWdpc3RlckUsMSksYi5yZWdpc3RlckU9Yi5yZWdpc3RlckUrMSYyNTUsMD09PWIucmVnaXN0ZXJFP2woMSk6bCgwKSx0KDApLDQ7Y2FzZSAyOTpyZXR1cm4gUyhiLnJlZ2lzdGVyRSwtMSksYi5yZWdpc3RlckU9Yi5yZWdpc3RlckUtMSYyNTUsMD09PWIucmVnaXN0ZXJFP2woMSk6bCgwKSx0KDEpLDQ7Y2FzZSAzMDpyZXR1cm4gYi5yZWdpc3RlckU9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAzMTpyZXR1cm4gYT0hMSwxPT09KGIucmVnaXN0ZXJBJjEpJiYoYT0hMCksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPj4xfFUoKTw8NykmMjU1LGE/dSgxKTp1KDApLGwoMCksdCgwKSxEKDApLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSmIoYSl7c3dpdGNoKGEpe2Nhc2UgMzI6cmV0dXJuIDA9PT1yYSgpPwpDYShGKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAzMzpyZXR1cm4gYT1ZKCksYi5yZWdpc3Rlckg9RyhhKSxiLnJlZ2lzdGVyTD1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMzQ6cmV0dXJuIGE9ayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksVChhLGIucmVnaXN0ZXJBKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1HKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSAzNTpyZXR1cm4gYT1rKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1HKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSAzNjpyZXR1cm4gUyhiLnJlZ2lzdGVySCwxKSxiLnJlZ2lzdGVySD1iLnJlZ2lzdGVySCsxJjI1NSwwPT09Yi5yZWdpc3Rlckg/bCgxKTpsKDApLHQoMCksNDtjYXNlIDM3OnJldHVybiBTKGIucmVnaXN0ZXJILC0xKSxiLnJlZ2lzdGVySD1iLnJlZ2lzdGVySC0KMSYyNTUsMD09PWIucmVnaXN0ZXJIP2woMSk6bCgwKSx0KDEpLDQ7Y2FzZSAzODpyZXR1cm4gYi5yZWdpc3Rlckg9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAzOTp2YXIgYz0wOzA8KGIucmVnaXN0ZXJGPj41JjEpJiYoY3w9Nik7MDxVKCkmJihjfD05Nik7MDwoYi5yZWdpc3RlckY+PjYmMSk/YT1iLnJlZ2lzdGVyQS1jJjI1NTooOTwoYi5yZWdpc3RlckEmMTUpJiYoY3w9NiksMTUzPGIucmVnaXN0ZXJBJiYoY3w9OTYpLGE9Yi5yZWdpc3RlckErYyYyNTUpOzA9PT1hP2woMSk6bCgwKTswIT09KGMmOTYpP3UoMSk6dSgwKTtEKDApO2IucmVnaXN0ZXJBPWE7cmV0dXJuIDQ7Y2FzZSA0MDpyZXR1cm4gMDxyYSgpP0NhKEYoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDQxOnJldHVybiBhPWsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLHVhKGEsYSwhMSksYT0yKmEmNjU1MzUsYi5yZWdpc3Rlckg9CkcoYSksYi5yZWdpc3Rlckw9YSYyNTUsdCgwKSw4O2Nhc2UgNDI6cmV0dXJuIGE9ayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckE9SihhKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1HKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSA0MzpyZXR1cm4gYT1rKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1HKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSA0NDpyZXR1cm4gUyhiLnJlZ2lzdGVyTCwxKSxiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCsxJjI1NSwwPT09Yi5yZWdpc3Rlckw/bCgxKTpsKDApLHQoMCksNDtjYXNlIDQ1OnJldHVybiBTKGIucmVnaXN0ZXJMLC0xKSxiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTC0xJjI1NSwwPT09Yi5yZWdpc3Rlckw/bCgxKTpsKDApLHQoMSksNDtjYXNlIDQ2OnJldHVybiBiLnJlZ2lzdGVyTD1GKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDQ3OnJldHVybiBiLnJlZ2lzdGVyQT0KfmIucmVnaXN0ZXJBLHQoMSksRCgxKSw0fXJldHVybi0xfWZ1bmN0aW9uIEtiKGEpe3N3aXRjaChhKXtjYXNlIDQ4OnJldHVybiAwPT09VSgpP0NhKEYoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDQ5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1ZKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDUwOnJldHVybiBhPWsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLFQoYSxiLnJlZ2lzdGVyQSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9RyhhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNTE6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzEmNjU1MzUsODtjYXNlIDUyOmE9ayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9SihhKTtTKGMsMSk7Yz1jKzEmMjU1OzA9PT1jP2woMSk6bCgwKTt0KDApO1QoYSxjKTtyZXR1cm4gNDtjYXNlIDUzOnJldHVybiBhPWsoYi5yZWdpc3RlckgsCmIucmVnaXN0ZXJMKSxjPUooYSksUyhjLC0xKSxjPWMtMSYyNTUsMD09PWM/bCgxKTpsKDApLHQoMSksVChhLGMpLDQ7Y2FzZSA1NDpyZXR1cm4gVChrKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA1NTpyZXR1cm4gdCgwKSxEKDApLHUoMSksNDtjYXNlIDU2OnJldHVybiAxPT09VSgpP0NhKEYoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDU3OnJldHVybiBhPWsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLHVhKGEsYi5zdGFja1BvaW50ZXIsITEpLGE9YStiLnN0YWNrUG9pbnRlciY2NTUzNSxiLnJlZ2lzdGVySD1HKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHQoMCksODtjYXNlIDU4OnJldHVybiBhPWsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBPUooYSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9RyhhKSxiLnJlZ2lzdGVyTD0KYSYyNTUsNDtjYXNlIDU5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0xJjY1NTM1LDg7Y2FzZSA2MDpyZXR1cm4gUyhiLnJlZ2lzdGVyQSwxKSxiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQSsxJjI1NSwwPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApLHQoMCksNDtjYXNlIDYxOnJldHVybiBTKGIucmVnaXN0ZXJBLC0xKSxiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQS0xJjI1NSwwPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApLHQoMSksNDtjYXNlIDYyOnJldHVybiBiLnJlZ2lzdGVyQT1GKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDYzOnJldHVybiB0KDApLEQoMCksMDxVKCk/dSgwKTp1KDEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gTGIoYSl7c3dpdGNoKGEpe2Nhc2UgNjQ6cmV0dXJuIDQ7Y2FzZSA2NTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckMsNDtjYXNlIDY2OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyRCwKNDtjYXNlIDY3OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyRSw0O2Nhc2UgNjg6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJILDQ7Y2FzZSA2OTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckwsNDtjYXNlIDcwOnJldHVybiBiLnJlZ2lzdGVyQj1KKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgNzE6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJBLDQ7Y2FzZSA3MjpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckIsNDtjYXNlIDczOnJldHVybiA0O2Nhc2UgNzQ6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJELDQ7Y2FzZSA3NTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckUsNDtjYXNlIDc2OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVySCw0O2Nhc2UgNzc6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJMLDQ7Y2FzZSA3ODpyZXR1cm4gYi5yZWdpc3RlckM9SihrKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksCjQ7Y2FzZSA3OTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckEsNH1yZXR1cm4tMX1mdW5jdGlvbiBNYihhKXtzd2l0Y2goYSl7Y2FzZSA4MDpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckIsNDtjYXNlIDgxOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQyw0O2Nhc2UgODI6cmV0dXJuIDQ7Y2FzZSA4MzpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckUsNDtjYXNlIDg0OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVySCw0O2Nhc2UgODU6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJMLDQ7Y2FzZSA4NjpyZXR1cm4gYi5yZWdpc3RlckQ9SihrKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDg3OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQSw0O2Nhc2UgODg6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJCLDQ7Y2FzZSA4OTpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckMsNDtjYXNlIDkwOnJldHVybiBiLnJlZ2lzdGVyRT0KYi5yZWdpc3RlckQsNDtjYXNlIDkxOnJldHVybiA0O2Nhc2UgOTI6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJILDQ7Y2FzZSA5MzpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckwsNDtjYXNlIDk0OnJldHVybiBiLnJlZ2lzdGVyRT1KKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgOTU6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gTmIoYSl7c3dpdGNoKGEpe2Nhc2UgOTY6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJCLDQ7Y2FzZSA5NzpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckMsNDtjYXNlIDk4OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyRCw0O2Nhc2UgOTk6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMDA6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILDQ7Y2FzZSAxMDE6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMDI6cmV0dXJuIGIucmVnaXN0ZXJIPQpKKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTAzOnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQSw0O2Nhc2UgMTA0OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQiw0O2Nhc2UgMTA1OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQyw0O2Nhc2UgMTA2OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRCw0O2Nhc2UgMTA3OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTA4OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVySCw0O2Nhc2UgMTA5OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTEwOnJldHVybiBiLnJlZ2lzdGVyTD1KKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTExOnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIE9iKGEpe3N3aXRjaChhKXtjYXNlIDExMjpyZXR1cm4gVChrKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSwKYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMTM6cmV0dXJuIFQoayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMTQ6cmV0dXJuIFQoayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMTU6cmV0dXJuIFQoayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckUpLDQ7Y2FzZSAxMTY6cmV0dXJuIFQoayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckgpLDQ7Y2FzZSAxMTc6cmV0dXJuIFQoayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMTg6cmV0dXJuIGQuaXNIYmxhbmtIZG1hQWN0aXZlfHxiLmVuYWJsZUhhbHQoKSw0O2Nhc2UgMTE5OnJldHVybiBUKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTIwOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQiw0O2Nhc2UgMTIxOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQywKNDtjYXNlIDEyMjpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckQsNDtjYXNlIDEyMzpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckUsNDtjYXNlIDEyNDpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckgsNDtjYXNlIDEyNTpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckwsNDtjYXNlIDEyNjpyZXR1cm4gYi5yZWdpc3RlckE9SihrKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDEyNzpyZXR1cm4gNH1yZXR1cm4tMX1mdW5jdGlvbiBQYihhKXtzd2l0Y2goYSl7Y2FzZSAxMjg6cmV0dXJuIGlhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTI5OnJldHVybiBpYShiLnJlZ2lzdGVyQyksNDtjYXNlIDEzMDpyZXR1cm4gaWEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMzE6cmV0dXJuIGlhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTMyOnJldHVybiBpYShiLnJlZ2lzdGVySCksNDtjYXNlIDEzMzpyZXR1cm4gaWEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMzQ6cmV0dXJuIGE9CkooayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGlhKGEpLDQ7Y2FzZSAxMzU6cmV0dXJuIGlhKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTM2OnJldHVybiBqYShiLnJlZ2lzdGVyQiksNDtjYXNlIDEzNzpyZXR1cm4gamEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMzg6cmV0dXJuIGphKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTM5OnJldHVybiBqYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE0MDpyZXR1cm4gamEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNDE6cmV0dXJuIGphKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTQyOnJldHVybiBhPUooayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGphKGEpLDQ7Y2FzZSAxNDM6cmV0dXJuIGphKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIFFiKGEpe3N3aXRjaChhKXtjYXNlIDE0NDpyZXR1cm4ga2EoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNDU6cmV0dXJuIGthKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTQ2OnJldHVybiBrYShiLnJlZ2lzdGVyRCksNDsKY2FzZSAxNDc6cmV0dXJuIGthKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTQ4OnJldHVybiBrYShiLnJlZ2lzdGVySCksNDtjYXNlIDE0OTpyZXR1cm4ga2EoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTA6cmV0dXJuIGE9SihrKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksa2EoYSksNDtjYXNlIDE1MTpyZXR1cm4ga2EoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxNTI6cmV0dXJuIGxhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTUzOnJldHVybiBsYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE1NDpyZXR1cm4gbGEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNTU6cmV0dXJuIGxhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTU2OnJldHVybiBsYShiLnJlZ2lzdGVySCksNDtjYXNlIDE1NzpyZXR1cm4gbGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTg6cmV0dXJuIGE9SihrKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksbGEoYSksNDtjYXNlIDE1OTpyZXR1cm4gbGEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gUmIoYSl7c3dpdGNoKGEpe2Nhc2UgMTYwOnJldHVybiBtYShiLnJlZ2lzdGVyQiksCjQ7Y2FzZSAxNjE6cmV0dXJuIG1hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTYyOnJldHVybiBtYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE2MzpyZXR1cm4gbWEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNjQ6cmV0dXJuIG1hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTY1OnJldHVybiBtYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE2NjpyZXR1cm4gYT1KKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxtYShhKSw0O2Nhc2UgMTY3OnJldHVybiBtYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE2ODpyZXR1cm4gbmEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNjk6cmV0dXJuIG5hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTcwOnJldHVybiBuYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE3MTpyZXR1cm4gbmEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNzI6cmV0dXJuIG5hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTczOnJldHVybiBuYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE3NDpyZXR1cm4gYT1KKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSwKbmEoYSksNDtjYXNlIDE3NTpyZXR1cm4gbmEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gU2IoYSl7c3dpdGNoKGEpe2Nhc2UgMTc2OnJldHVybiBvYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE3NzpyZXR1cm4gb2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNzg6cmV0dXJuIG9hKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTc5OnJldHVybiBvYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE4MDpyZXR1cm4gb2EoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxODE6cmV0dXJuIG9hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTgyOnJldHVybiBhPUooayhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLG9hKGEpLDQ7Y2FzZSAxODM6cmV0dXJuIG9hKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTg0OnJldHVybiBwYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE4NTpyZXR1cm4gcGEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxODY6cmV0dXJuIHBhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTg3OnJldHVybiBwYShiLnJlZ2lzdGVyRSksCjQ7Y2FzZSAxODg6cmV0dXJuIHBhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTg5OnJldHVybiBwYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE5MDpyZXR1cm4gYT1KKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxwYShhKSw0O2Nhc2UgMTkxOnJldHVybiBwYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBUYihhKXtzd2l0Y2goYSl7Y2FzZSAxOTI6cmV0dXJuIDA9PT1yYSgpPyhiLnByb2dyYW1Db3VudGVyPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDEyKTo4O2Nhc2UgMTkzOnJldHVybiBhPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJCPUcoYSksYi5yZWdpc3RlckM9YSYyNTUsNDtjYXNlIDE5NDppZigwPT09cmEoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTsKcmV0dXJuIDEyO2Nhc2UgMTk1OnJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2Nhc2UgMTk2OmlmKDA9PT1yYSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDE5NzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGsoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpKSw4O2Nhc2UgMTk4OnJldHVybiBpYShGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAxOTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPQowLDg7Y2FzZSAyMDA6cmV0dXJuIDE9PT1yYSgpPyhiLnByb2dyYW1Db3VudGVyPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDEyKTo4O2Nhc2UgMjAxOnJldHVybiBiLnByb2dyYW1Db3VudGVyPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDg7Y2FzZSAyMDI6aWYoMT09PXJhKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjAzOnZhciBjPUYoKTthPS0xO3ZhciBlPSExLGQ9MCxmPTAsZz1jJTg7c3dpdGNoKGcpe2Nhc2UgMDpkPWIucmVnaXN0ZXJCO2JyZWFrO2Nhc2UgMTpkPWIucmVnaXN0ZXJDO2JyZWFrO2Nhc2UgMjpkPWIucmVnaXN0ZXJEO2JyZWFrO2Nhc2UgMzpkPWIucmVnaXN0ZXJFO2JyZWFrO2Nhc2UgNDpkPWIucmVnaXN0ZXJIO2JyZWFrO2Nhc2UgNTpkPQpiLnJlZ2lzdGVyTDticmVhaztjYXNlIDY6ZD1KKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKTticmVhaztjYXNlIDc6ZD1iLnJlZ2lzdGVyQX12YXIgaD0oYyYyNDApPj40O3N3aXRjaChoKXtjYXNlIDA6Nz49Yz8oYz1kLDEyOD09PShjJjEyOCk/dSgxKTp1KDApLGM9KGM8PDF8Yz4+NykmMjU1LDA9PT1jP2woMSk6bCgwKSx0KDApLEQoMCksZj1jLGU9ITApOjE1Pj1jJiYoYz1kLDA8KGMmMSk/dSgxKTp1KDApLGM9KGM+PjF8Yzw8NykmMjU1LDA9PT1jP2woMSk6bCgwKSx0KDApLEQoMCksZj1jLGU9ITApO2JyZWFrO2Nhc2UgMToyMz49Yz8oYz1kLGU9ITEsMTI4PT09KGMmMTI4KSYmKGU9ITApLGM9KGM8PDF8VSgpKSYyNTUsZT91KDEpOnUoMCksMD09PWM/bCgxKTpsKDApLHQoMCksRCgwKSxmPWMsZT0hMCk6MzE+PWMmJihjPWQsZT0hMSwxPT09KGMmMSkmJihlPSEwKSxjPShjPj4xfFUoKTw8NykmMjU1LGU/dSgxKTp1KDApLDA9PT1jP2woMSk6bCgwKSx0KDApLEQoMCksZj0KYyxlPSEwKTticmVhaztjYXNlIDI6Mzk+PWM/KGM9ZCxlPSExLDEyOD09PShjJjEyOCkmJihlPSEwKSxjPWM8PDEmMjU1LGU/dSgxKTp1KDApLDA9PT1jP2woMSk6bCgwKSx0KDApLEQoMCksZj1jLGU9ITApOjQ3Pj1jJiYoYz1kLGU9ITEsMTI4PT09KGMmMTI4KSYmKGU9ITApLGQ9ITEsMT09PShjJjEpJiYoZD0hMCksYz1jPj4xJjI1NSxlJiYoY3w9MTI4KSwwPT09Yz9sKDEpOmwoMCksdCgwKSxEKDApLGQ/dSgxKTp1KDApLGY9YyxlPSEwKTticmVhaztjYXNlIDM6NTU+PWM/KGM9ZCxjPSgoYyYxNSk8PDR8KGMmMjQwKT4+NCkmMjU1LDA9PT1jP2woMSk6bCgwKSx0KDApLEQoMCksdSgwKSxmPWMsZT0hMCk6NjM+PWMmJihjPWQsZT0hMSwxPT09KGMmMSkmJihlPSEwKSxjPWM+PjEmMjU1LDA9PT1jP2woMSk6bCgwKSx0KDApLEQoMCksZT91KDEpOnUoMCksZj1jLGU9ITApO2JyZWFrO2Nhc2UgNDo3MT49Yz8oZj10YSgwLGQpLGU9ITApOjc5Pj1jJiYoZj10YSgxLGQpLGU9ITApO2JyZWFrOwpjYXNlIDU6ODc+PWM/KGY9dGEoMixkKSxlPSEwKTo5NT49YyYmKGY9dGEoMyxkKSxlPSEwKTticmVhaztjYXNlIDY6MTAzPj1jPyhmPXRhKDQsZCksZT0hMCk6MTExPj1jJiYoZj10YSg1LGQpLGU9ITApO2JyZWFrO2Nhc2UgNzoxMTk+PWM/KGY9dGEoNixkKSxlPSEwKToxMjc+PWMmJihmPXRhKDcsZCksZT0hMCk7YnJlYWs7Y2FzZSA4OjEzNT49Yz8oZj1aKDAsMCxkKSxlPSEwKToxNDM+PWMmJihmPVooMSwwLGQpLGU9ITApO2JyZWFrO2Nhc2UgOToxNTE+PWM/KGY9WigyLDAsZCksZT0hMCk6MTU5Pj1jJiYoZj1aKDMsMCxkKSxlPSEwKTticmVhaztjYXNlIDEwOjE2Nz49Yz8oZj1aKDQsMCxkKSxlPSEwKToxNzU+PWMmJihmPVooNSwwLGQpLGU9ITApO2JyZWFrO2Nhc2UgMTE6MTgzPj1jPyhmPVooNiwwLGQpLGU9ITApOjE5MT49YyYmKGY9Wig3LDAsZCksZT0hMCk7YnJlYWs7Y2FzZSAxMjoxOTk+PWM/KGY9WigwLDEsZCksZT0hMCk6MjA3Pj1jJiYoZj1aKDEsMSxkKSxlPSEwKTsKYnJlYWs7Y2FzZSAxMzoyMTU+PWM/KGY9WigyLDEsZCksZT0hMCk6MjIzPj1jJiYoZj1aKDMsMSxkKSxlPSEwKTticmVhaztjYXNlIDE0OjIzMT49Yz8oZj1aKDQsMSxkKSxlPSEwKToyMzk+PWMmJihmPVooNSwxLGQpLGU9ITApO2JyZWFrO2Nhc2UgMTU6MjQ3Pj1jPyhmPVooNiwxLGQpLGU9ITApOjI1NT49YyYmKGY9Wig3LDEsZCksZT0hMCl9c3dpdGNoKGcpe2Nhc2UgMDpiLnJlZ2lzdGVyQj1mO2JyZWFrO2Nhc2UgMTpiLnJlZ2lzdGVyQz1mO2JyZWFrO2Nhc2UgMjpiLnJlZ2lzdGVyRD1mO2JyZWFrO2Nhc2UgMzpiLnJlZ2lzdGVyRT1mO2JyZWFrO2Nhc2UgNDpiLnJlZ2lzdGVySD1mO2JyZWFrO2Nhc2UgNTpiLnJlZ2lzdGVyTD1mO2JyZWFrO2Nhc2UgNjooND5ofHw3PGgpJiZUKGsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGYpO2JyZWFrO2Nhc2UgNzpiLnJlZ2lzdGVyQT1mfWUmJihhPTQpO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1O3JldHVybiBhOwpjYXNlIDIwNDppZigxPT09cmEoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiksYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMDU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Y2FzZSAyMDY6cmV0dXJuIGphKEYoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIwNzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9OH1yZXR1cm4tMX1mdW5jdGlvbiBVYihhKXtzd2l0Y2goYSl7Y2FzZSAyMDg6cmV0dXJuIDA9PT0KVSgpPyhiLnByb2dyYW1Db3VudGVyPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDEyKTo4O2Nhc2UgMjA5OnJldHVybiBhPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJEPUcoYSksYi5yZWdpc3RlckU9YSYyNTUsNDtjYXNlIDIxMDppZigwPT09VSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIxMjppZigwPT09VSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyKSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIxMzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9CmIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixrKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSksODtjYXNlIDIxNDpyZXR1cm4ga2EoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjE1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0xNiw4O2Nhc2UgMjE2OnJldHVybiAxPT09VSgpPyhiLnByb2dyYW1Db3VudGVyPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDEyKTo4O2Nhc2UgMjE3OnJldHVybiBiLnByb2dyYW1Db3VudGVyPWVhKGIuc3RhY2tQb2ludGVyKSxQYSghMCksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSw4O2Nhc2UgMjE4OmlmKDE9PT1VKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WSgpLAo4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIyMDppZigxPT09VSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIyMjpyZXR1cm4gbGEoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjIzOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0yNCw4fXJldHVybi0xfWZ1bmN0aW9uIFZiKGEpe3N3aXRjaChhKXtjYXNlIDIyNDpyZXR1cm4gYT1GKCksVCg2NTI4MCthLGIucmVnaXN0ZXJBKSxiLnByb2dyYW1Db3VudGVyPQpiLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIyNTpyZXR1cm4gYT1lYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSxiLnJlZ2lzdGVySD1HKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSAyMjY6cmV0dXJuIFQoNjUyODArYi5yZWdpc3RlckMsYi5yZWdpc3RlckEpLDQ7Y2FzZSAyMjk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixrKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksODtjYXNlIDIzMDpyZXR1cm4gbWEoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjMxOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0zMiw4O2Nhc2UgMjMyOnJldHVybiBhPVNhKEYoKSksdWEoYi5zdGFja1BvaW50ZXIsCmEsITApLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyK2EmNjU1MzUsbCgwKSx0KDApLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDEyO2Nhc2UgMjMzOnJldHVybiBiLnByb2dyYW1Db3VudGVyPWsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLDQ7Y2FzZSAyMzQ6cmV0dXJuIFQoWSgpLGIucmVnaXN0ZXJBKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjM4OnJldHVybiBuYShGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMzk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTQwLDh9cmV0dXJuLTF9ZnVuY3Rpb24gV2IoYSl7c3dpdGNoKGEpe2Nhc2UgMjQwOnJldHVybiBhPUYoKSxiLnJlZ2lzdGVyQT1KKDY1MjgwK2EpJjI1NSwKYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDI0MTpyZXR1cm4gYT1lYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSxiLnJlZ2lzdGVyQT1HKGEpLGIucmVnaXN0ZXJGPWEmMjU1LDQ7Y2FzZSAyNDI6cmV0dXJuIGIucmVnaXN0ZXJBPUooNjUyODArYi5yZWdpc3RlckMpJjI1NSw0O2Nhc2UgMjQzOnJldHVybiBQYSghMSksNDtjYXNlIDI0NTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGsoYi5yZWdpc3RlckEsYi5yZWdpc3RlckYpKSw4O2Nhc2UgMjQ2OnJldHVybiBvYShGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyNDc6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPQo0OCw4O2Nhc2UgMjQ4OnJldHVybiBhPVNhKEYoKSksbCgwKSx0KDApLHVhKGIuc3RhY2tQb2ludGVyLGEsITApLGE9Yi5zdGFja1BvaW50ZXIrYSY2NTUzNSxiLnJlZ2lzdGVySD1HKGEpLGIucmVnaXN0ZXJMPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAyNDk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWsoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLDg7Y2FzZSAyNTA6cmV0dXJuIGIucmVnaXN0ZXJBPUooWSgpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjUxOnJldHVybiBQYSghMCksNDtjYXNlIDI1NDpyZXR1cm4gcGEoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjU1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0KNTYsOH1yZXR1cm4tMX1mdW5jdGlvbiBxYShhKXswPGQuRE1BQ3ljbGVzJiYoYSs9ZC5ETUFDeWNsZXMsZC5ETUFDeWNsZXM9MCk7Yi5jdXJyZW50Q3ljbGVzKz1hO2lmKCFiLmlzU3RvcHBlZCl7aWYoVi5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZyl7aWYoci5jdXJyZW50Q3ljbGVzKz1hLCEoci5jdXJyZW50Q3ljbGVzPHIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCkpKWZvcig7ci5jdXJyZW50Q3ljbGVzPj1yLmJhdGNoUHJvY2Vzc0N5Y2xlcygpOyl1YihyLmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSxyLmN1cnJlbnRDeWNsZXMtPXIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCl9ZWxzZSB1YihhKTtWLmF1ZGlvQmF0Y2hQcm9jZXNzaW5nP2YuY3VycmVudEN5Y2xlcys9YTptYihhKTt2YXIgYz1hO2lmKE4udHJhbnNmZXJTdGFydEZsYWcpZm9yKHZhciBlPTA7ZTxjOyl7dmFyIGc9Ti5jdXJyZW50Q3ljbGVzO2UrPTQ7Ti5jdXJyZW50Q3ljbGVzKz00OzY1NTM1PE4uY3VycmVudEN5Y2xlcyYmKE4uY3VycmVudEN5Y2xlcy09CjY1NTM2KTt2YXIgaz1OLmN1cnJlbnRDeWNsZXM7dmFyIGw9Ti5pc0Nsb2NrU3BlZWRGYXN0PzI6NztuKGwsZykmJiFuKGwsaykmJihnPXgoTi5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyRGF0YSksZz0oZzw8MSkrMSxnJj0yNTUsaChOLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJEYXRhLGcpLE4ubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQrPTEsOD09PU4ubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQmJihOLm51bWJlck9mQml0c1RyYW5zZmVycmVkPTAscC5pc1NlcmlhbEludGVycnVwdFJlcXVlc3RlZD0hMCx3YShwLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0KSxnPXgoTi5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyQ29udHJvbCksaChOLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sLEgoNyxnKSksTi50cmFuc2ZlclN0YXJ0RmxhZz0hMSkpfX1WLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz8obS5jdXJyZW50Q3ljbGVzKz1hLFdhKG0uY3VycmVudEN5Y2xlcyksCm0uY3VycmVudEN5Y2xlcz0wKTpXYShhKTtYLmN5Y2xlcys9YTtYLmN5Y2xlcz49WC5jeWNsZXNQZXJDeWNsZVNldCYmKFguY3ljbGVTZXRzKz0xLFguY3ljbGVzLT1YLmN5Y2xlc1BlckN5Y2xlU2V0KX1mdW5jdGlvbiBjYigpe3JldHVybiBEYSghMCwtMSwtMSl9ZnVuY3Rpb24gRGEoYSxjLGUpe3ZvaWQgMD09PWMmJihjPS0xKTt2b2lkIDA9PT1lJiYoZT0tMSk7YT0xMDI0OzA8Yz9hPWM6MD5jJiYoYT0tMSk7Zm9yKHZhciBkPSExLGY9ITEsZz0hMSxoPSExOyEoZHx8Znx8Z3x8aCk7KWM9ZGIoKSwwPmM/ZD0hMDpiLmN1cnJlbnRDeWNsZXM+PWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKT9mPSEwOi0xPGEmJlVhKCk+PWE/Zz0hMDotMTxlJiZiLnByb2dyYW1Db3VudGVyPT09ZSYmKGg9ITApO2lmKGYpcmV0dXJuIGIuY3VycmVudEN5Y2xlcy09Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpLFAuUkVTUE9OU0VfQ09ORElUSU9OX0ZSQU1FO2lmKGcpcmV0dXJuIFAuUkVTUE9OU0VfQ09ORElUSU9OX0FVRElPOwppZihoKXJldHVybiBQLlJFU1BPTlNFX0NPTkRJVElPTl9CUkVBS1BPSU5UO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlci0xJjY1NTM1O3JldHVybi0xfWZ1bmN0aW9uIGRiKCl7RWE9ITA7aWYoYi5pc0hhbHRCdWcpe3ZhciBhPXgoYi5wcm9ncmFtQ291bnRlcik7YT12YihhKTtxYShhKTtiLmV4aXRIYWx0QW5kU3RvcCgpfXAubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXkmJihwLm1hc3RlckludGVycnVwdFN3aXRjaD0hMCxwLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PSExKTtpZigwPChwLmludGVycnVwdHNFbmFibGVkVmFsdWUmcC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmMzEpKXthPSExO3AubWFzdGVySW50ZXJydXB0U3dpdGNoJiYhYi5pc0hhbHROb0p1bXAmJihwLmlzVkJsYW5rSW50ZXJydXB0RW5hYmxlZCYmcC5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD8oQWEocC5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCksYT0hMCk6cC5pc0xjZEludGVycnVwdEVuYWJsZWQmJgpwLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPyhBYShwLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSxhPSEwKTpwLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkJiZwLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KEFhKHAuYml0UG9zaXRpb25UaW1lckludGVycnVwdCksYT0hMCk6cC5pc1NlcmlhbEludGVycnVwdEVuYWJsZWQmJnAuaXNTZXJpYWxJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KEFhKHAuYml0UG9zaXRpb25TZXJpYWxJbnRlcnJ1cHQpLGE9ITApOnAuaXNKb3lwYWRJbnRlcnJ1cHRFbmFibGVkJiZwLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkJiYoQWEocC5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCksYT0hMCkpO3ZhciBjPTA7YSYmKGM9MjAsYi5pc0hhbHRlZCgpJiYoYi5leGl0SGFsdEFuZFN0b3AoKSxjKz00KSk7Yi5pc0hhbHRlZCgpJiZiLmV4aXRIYWx0QW5kU3RvcCgpO2E9Y31lbHNlIGE9MDswPGEmJnFhKGEpO2E9NDtiLmlzSGFsdGVkKCl8fGIuaXNTdG9wcGVkfHwKKGE9eChiLnByb2dyYW1Db3VudGVyKSxhPXZiKGEpKTtiLnJlZ2lzdGVyRiY9MjQwO2lmKDA+PWEpcmV0dXJuIGE7cWEoYSk7UC5zdGVwcys9MTtQLnN0ZXBzPj1QLnN0ZXBzUGVyU3RlcFNldCYmKFAuc3RlcFNldHMrPTEsUC5zdGVwcy09UC5zdGVwc1BlclN0ZXBTZXQpO3JldHVybiBhfWZ1bmN0aW9uIFhiKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpO2EuZnBzVGltZVN0YW1wcy5wdXNoKGIpO2EudGltZVN0YW1wc1VudGlsUmVhZHktLTswPmEudGltZVN0YW1wc1VudGlsUmVhZHkmJihhLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTApO3JldHVybiBifWZ1bmN0aW9uIHdiKGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6CjEyMH1mdW5jdGlvbiB4YihhKXtjb25zdCBiPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTithLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFKS5idWZmZXI7YS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTyh7dHlwZTpDLlVQREFURUQsZ3JhcGhpY3NGcmFtZUJ1ZmZlcjpifSksW2JdKX1mdW5jdGlvbiB5YihhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCkpLWEuZnBzVGltZVN0YW1wc1thLmZwc1RpbWVTdGFtcHMubGVuZ3RoLTFdO2I9emItYjswPmImJihiPTApO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0FiKGEpfSxNYXRoLmZsb29yKGIpKX1mdW5jdGlvbiBBYihhLGIpe2lmKGEucGF1c2VkKXJldHVybiEwO3ZvaWQgMCE9PWImJih6Yj1iKTtGYT1hLmdldEZQUygpOwppZihGYT5hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxKXJldHVybiBhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKSx5YihhKSwhMDtYYihhKTtjb25zdCBjPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoKGIpPT57bGV0IGU7Yz9lYihhLGIpOihlPXZvaWQgMCE9PWEuYnJlYWtwb2ludD9hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZVVudGlsQnJlYWtwb2ludChhLmJyZWFrcG9pbnQpOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksYihlKSl9KSkudGhlbigoYik9PntpZigwPD1iKXtiYShPKHt0eXBlOkMuVVBEQVRFRCxmcHM6RmF9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPQowKTtjfHx4YihhKTtjb25zdCBlPXt0eXBlOkMuVVBEQVRFRH07ZVtFLkNBUlRSSURHRV9SQU1dPWZiKGEpLmJ1ZmZlcjtlW0UuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2VbRS5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7ZVtFLklOVEVSTkFMX1NUQVRFXT1nYihhKS5idWZmZXI7T2JqZWN0LmtleXMoZSkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1lW2FdJiYoZVthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTyhlKSwKW2VbRS5DQVJUUklER0VfUkFNXSxlW0UuR0FNRUJPWV9NRU1PUlldLGVbRS5QQUxFVFRFX01FTU9SWV0sZVtFLklOVEVSTkFMX1NUQVRFXV0pOzI9PT1iP2JhKE8oe3R5cGU6Qy5CUkVBS1BPSU5UfSkpOnliKGEpfWVsc2UgYmEoTyh7dHlwZTpDLkNSQVNIRUR9KSksYS5wYXVzZWQ9ITB9KX1mdW5jdGlvbiBlYihhLGIpe3ZhciBjPS0xO2M9dm9pZCAwIT09YS5icmVha3BvaW50P2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpb1VudGlsQnJlYWtwb2ludCgxMDI0LGEuYnJlYWtwb2ludCk6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvKDEwMjQpOzEhPT1jJiZiKGMpO2lmKDE9PT1jKXtjPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0QXVkaW9RdWV1ZUluZGV4KCk7Y29uc3QgZT1GYT49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmZT8oQmIoYSwKYyksc2V0VGltZW91dCgoKT0+e3diKGEpO2ViKGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooQmIoYSxjKSxlYihhLGIpKX19ZnVuY3Rpb24gQmIoYSxiKXtjb25zdCBjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE8oe3R5cGU6Qy5VUERBVEVELGF1ZGlvQnVmZmVyOmMsbnVtYmVyT2ZTYW1wbGVzOmIsZnBzOkZhLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX0pLFtjXSk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKX1jb25zdCBIYT0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCBSYTtIYXx8KFJhPXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7CmNvbnN0IEM9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLEdFVF9NRU1PUlk6IkdFVF9NRU1PUlkiLFNFVF9NRU1PUlk6IlNFVF9NRU1PUlkiLFNFVF9NRU1PUllfRE9ORToiU0VUX01FTU9SWV9ET05FIixHRVRfQ09OU1RBTlRTOiJHRVRfQ09OU1RBTlRTIixHRVRfQ09OU1RBTlRTX0RPTkU6IkdFVF9DT05TVEFOVFNfRE9ORSIsQ09ORklHOiJDT05GSUciLFJFU0VUX0FVRElPX1FVRVVFOiJSRVNFVF9BVURJT19RVUVVRSIsUExBWToiUExBWSIsUExBWV9VTlRJTF9CUkVBS1BPSU5UOiJQTEFZX1VOVElMX0JSRUFLUE9JTlQiLEJSRUFLUE9JTlQ6IkJSRUFLUE9JTlQiLFBBVVNFOiJQQVVTRSIsVVBEQVRFRDoiVVBEQVRFRCIsQ1JBU0hFRDoiQ1JBU0hFRCIsU0VUX0pPWVBBRF9TVEFURToiU0VUX0pPWVBBRF9TVEFURSIsCkFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCIsRk9SQ0VfT1VUUFVUX0ZSQU1FOiJGT1JDRV9PVVRQVVRfRlJBTUUifSxFPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IElhPTA7Y29uc3QgZz1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTEwOTUwNCksR2E9e3NpemU6KCk9PjkxMDk1MDQsZ3JvdzooKT0+e30sd2FzbUJ5dGVNZW1vcnk6Z307dmFyIFY9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLmVuYWJsZUJvb3RSb209ITE7YS51c2VHYmNXaGVuQXZhaWxhYmxlPSEwO2EuYXVkaW9CYXRjaFByb2Nlc3Npbmc9ITE7YS5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0hMTthLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz0hMTthLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPSExO2EuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0hMTthLnRpbGVSZW5kZXJpbmc9ITE7YS50aWxlQ2FjaGluZz0hMTtyZXR1cm4gYX0oKSxCYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXg9NjUzODQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlRGF0YT02NTM4NTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZUluZGV4PTY1Mzg2O2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YT02NTM4NztyZXR1cm4gYX0oKSxoYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS50aWxlSWQ9LTE7YS5ob3Jpem9udGFsRmxpcD0KITE7YS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz0tMTtyZXR1cm4gYX0oKSx6PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYil7YS5OUngwU3dlZXBQZXJpb2Q9KGImMTEyKT4+NDthLk5SeDBOZWdhdGU9bigzLGIpO2EuTlJ4MFN3ZWVwU2hpZnQ9YiY3fTthLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxRHV0eT1iPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTsKYS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9big2LGIpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtRKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtnWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2dbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2dbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtnWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtnWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtnWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHk7USgxMDQ5KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzU3dlZXBFbmFibGVkKTtnWzEwNTArCjUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zd2VlcENvdW50ZXI7Z1sxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1SKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWdbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1nWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1nWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmR1dHlDeWNsZT1nWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9Z1sxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1N3ZWVwRW5hYmxlZD1SKDEwNDkrNTAqYS5zYXZlU3RhdGVTbG90KTthLnN3ZWVwQ291bnRlcj1nWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XTthLnN3ZWVwU2hhZG93RnJlcXVlbmN5PQpnWzEwNTUrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjgpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsMTkxKTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDI0Myk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MywxOTMpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTkxKX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9NCooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEucmVzZXRUaW1lcigpLAphLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSs9MSw4PD1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkmJihhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MCkpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPTE7amIoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYyo9LTEpO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EucmVzZXRUaW1lcigpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9YS5mcmVxdWVuY3k7YS5zd2VlcENvdW50ZXI9YS5OUngwU3dlZXBQZXJpb2Q7YS5pc1N3ZWVwRW5hYmxlZD0wPGEuTlJ4MFN3ZWVwUGVyaW9kJiYKMDxhLk5SeDBTd2VlcFNoaWZ0PyEwOiExOzA8YS5OUngwU3dlZXBTaGlmdCYma2IoKTthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLnVwZGF0ZVN3ZWVwPWZ1bmN0aW9uKCl7LS1hLnN3ZWVwQ291bnRlcjswPj1hLnN3ZWVwQ291bnRlciYmKGEuc3dlZXBDb3VudGVyPWEuTlJ4MFN3ZWVwUGVyaW9kLGEuaXNTd2VlcEVuYWJsZWQmJjA8YS5OUngwU3dlZXBQZXJpb2QmJmtiKCkpfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmCihhLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09YS5lbnZlbG9wZUNvdW50ZXImJihhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmEudm9sdW1lP2Eudm9sdW1lKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYil7dmFyIGM9Yj4+ODtiJj0yNTU7dmFyIGQ9eChhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGM7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MyxiKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuTlJ4NEZyZXF1ZW5jeU1TQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUyOTY7YS5OUngwU3dlZXBQZXJpb2Q9MDthLk5SeDBOZWdhdGU9ITE7YS5OUngwU3dlZXBTaGlmdD0wO2EubWVtb3J5TG9jYXRpb25OUngxPQo2NTI5NzthLk5SeDFEdXR5PTA7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1Mjk4O2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPTA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUyOTk7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMDA7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLmNoYW5uZWxOdW1iZXI9MTthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kdXR5Q3ljbGU9MDthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MDthLmlzU3dlZXBFbmFibGVkPSExO2Euc3dlZXBDb3VudGVyPTA7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT0wO2Euc2F2ZVN0YXRlU2xvdD0KNztyZXR1cm4gYX0oKSxMPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxRHV0eT1iPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1uKDYsYik7YS5OUng0RnJlcXVlbmN5TVNCPWImNzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTsKYS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtRKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtnWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2dbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2dbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtnWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtnWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtnWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9UigxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1nWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1nWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxlbmd0aENvdW50ZXI9Z1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF07CmEudm9sdW1lPWdbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZHV0eUN5Y2xlPWdbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1nWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MS0xLDI1NSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MSw2Myk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MiwwKTtoKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTg0KX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9NCooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT0KZnVuY3Rpb24oYil7YS5mcmVxdWVuY3lUaW1lci09YjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLnJlc2V0VGltZXIoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSs9MSw4PD1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkmJihhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MCkpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPTE7amIoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYyo9LTEpO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EucmVzZXRUaW1lcigpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2EuaXNEYWNFbmFibGVkfHwKKGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+YS52b2x1bWU/YS52b2x1bWUrPTE6IWEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMDxhLnZvbHVtZSYmLS1hLnZvbHVtZSkpfTthLnNldEZyZXF1ZW5jeT1mdW5jdGlvbihiKXt2YXIgYz0KYj4+ODtiJj0yNTU7dmFyIGQ9eChhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGM7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MyxiKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuTlJ4NEZyZXF1ZW5jeU1TQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMDI7YS5OUngxRHV0eT0wO2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwMzthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA0O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzA1O2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5jaGFubmVsTnVtYmVyPQoyO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wO2Euc2F2ZVN0YXRlU2xvdD04O3JldHVybiBhfSgpLEk9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MD1mdW5jdGlvbihiKXthLmlzRGFjRW5hYmxlZD1uKDcsYil9O2EudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFMZW5ndGhMb2FkPWI7YS5sZW5ndGhDb3VudGVyPTI1Ni1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyVm9sdW1lQ29kZT1iPj41JjE1fTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS51cGRhdGVOUng0PQpmdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPW4oNixiKTthLk5SeDRGcmVxdWVuY3lNU0I9YiY3O2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7USgxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtnWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7Z1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlVGFibGVQb3NpdGlvbn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1SKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWdbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1nWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVUYWJsZVBvc2l0aW9uPWdbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdfTsKYS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjcpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsMjU1KTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDE1OSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LDE4NCk7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMH07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9MiooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEucmVzZXRUaW1lcigpLGEuZnJlcXVlbmN5VGltZXItPQpiLGEud2F2ZVRhYmxlUG9zaXRpb24rPTEsMzI8PWEud2F2ZVRhYmxlUG9zaXRpb24mJihhLndhdmVUYWJsZVBvc2l0aW9uPTApKTtiPTA7dmFyIGM9YS52b2x1bWVDb2RlO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZClhLnZvbHVtZUNvZGVDaGFuZ2VkJiYoYz14KGEubWVtb3J5TG9jYXRpb25OUngyKSxjPWM+PjUmMTUsYS52b2x1bWVDb2RlPWMsYS52b2x1bWVDb2RlQ2hhbmdlZD0hMSk7ZWxzZSByZXR1cm4gMTU7dmFyIGQ9eChhLm1lbW9yeUxvY2F0aW9uV2F2ZVRhYmxlKyhhLndhdmVUYWJsZVBvc2l0aW9uLzJ8MCkpO2Q9MD09PWEud2F2ZVRhYmxlUG9zaXRpb24lMj9kPj40JjE1OmQmMTU7c3dpdGNoKGMpe2Nhc2UgMDpkPj49NDticmVhaztjYXNlIDE6Yj0xO2JyZWFrO2Nhc2UgMjpkPj49MTtiPTI7YnJlYWs7ZGVmYXVsdDpkPj49MixiPTR9cmV0dXJuKDA8Yj9kL2I6MCkrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJgooYS5sZW5ndGhDb3VudGVyPTI1Nik7YS5yZXNldFRpbWVyKCk7YS53YXZlVGFibGVQb3NpdGlvbj0wO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXImJiFhLnZvbHVtZUNvZGVDaGFuZ2VkPyExOiEwfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLmN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25OUngwPTY1MzA2O2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzA3O2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwODthLk5SeDJWb2x1bWVDb2RlPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMDk7YS5OUngzRnJlcXVlbmN5TFNCPQowO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzEwO2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5tZW1vcnlMb2NhdGlvbldhdmVUYWJsZT02NTMyODthLmNoYW5uZWxOdW1iZXI9MzthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLndhdmVUYWJsZVBvc2l0aW9uPTA7YS52b2x1bWVDb2RlPTA7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMTthLnNhdmVTdGF0ZVNsb3Q9OTtyZXR1cm4gYX0oKSxNPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPQpiJjc7YS5pc0RhY0VuYWJsZWQ9MDwoYiYyNDgpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzQ2xvY2tTaGlmdD1iPj40O2EuTlJ4M1dpZHRoTW9kZT1uKDMsYik7YS5OUngzRGl2aXNvckNvZGU9YiY3O3N3aXRjaChhLk5SeDNEaXZpc29yQ29kZSl7Y2FzZSAwOmEuZGl2aXNvcj04O2JyZWFrO2Nhc2UgMTphLmRpdmlzb3I9MTY7YnJlYWs7Y2FzZSAyOmEuZGl2aXNvcj0zMjticmVhaztjYXNlIDM6YS5kaXZpc29yPTQ4O2JyZWFrO2Nhc2UgNDphLmRpdmlzb3I9NjQ7YnJlYWs7Y2FzZSA1OmEuZGl2aXNvcj04MDticmVhaztjYXNlIDY6YS5kaXZpc29yPTk2O2JyZWFrO2Nhc2UgNzphLmRpdmlzb3I9MTEyfX07YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9big2LGIpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe1EoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0VuYWJsZWQpO2dbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7CmdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2dbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtnWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtnWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1SKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWdbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1nWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1nWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj1nWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MS0KMSwyNTUpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsMjU1KTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxOTEpfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYj1hLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShiKX07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYil7YS5mcmVxdWVuY3lUaW1lci09YjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLmZyZXF1ZW5jeVRpbWVyPWEuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kKCksYS5mcmVxdWVuY3lUaW1lci09YixiPWEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyJjFeYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI+PjEmMSxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj4+PTEsYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXJ8PQpiPDwxNCxhLk5SeDNXaWR0aE1vZGUmJihhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3RlciY9LTY1LGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfD1iPDw2KSk7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWI9YS52b2x1bWU7ZWxzZSByZXR1cm4gMTU7dmFyIGM9bigwLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyKT8tMToxO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EuZnJlcXVlbmN5VGltZXI9YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2QoKTthLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj0zMjc2NzthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT0KZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7cmV0dXJuIDA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcj8hMTohMH07YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2Q9ZnVuY3Rpb24oKXt2YXIgYz1hLmRpdmlzb3I8PGEuTlJ4M0Nsb2NrU2hpZnQ7Yi5HQkNEb3VibGVTcGVlZCYmKGMqPTIpO3JldHVybiBjfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+YS52b2x1bWU/YS52b2x1bWUrPTE6IWEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmCjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTMxMjthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMTM7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTMxNDthLk5SeDNDbG9ja1NoaWZ0PTA7YS5OUngzV2lkdGhNb2RlPSExO2EuTlJ4M0Rpdmlzb3JDb2RlPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMTU7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLmNoYW5uZWxOdW1iZXI9NDthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeVRpbWVyPTA7YS5lbnZlbG9wZUNvdW50ZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLnZvbHVtZT0wO2EuZGl2aXNvcj0wO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPTA7YS5zYXZlU3RhdGVTbG90PQoxMDtyZXR1cm4gYX0oKSx3PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmNoYW5uZWwxU2FtcGxlPTE1O2EuY2hhbm5lbDJTYW1wbGU9MTU7YS5jaGFubmVsM1NhbXBsZT0xNTthLmNoYW5uZWw0U2FtcGxlPTE1O2EuY2hhbm5lbDFEYWNFbmFibGVkPSExO2EuY2hhbm5lbDJEYWNFbmFibGVkPSExO2EuY2hhbm5lbDNEYWNFbmFibGVkPSExO2EuY2hhbm5lbDREYWNFbmFibGVkPSExO2EubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O2EucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzthLm1peGVyVm9sdW1lQ2hhbmdlZD0hMTthLm1peGVyRW5hYmxlZENoYW5nZWQ9ITE7YS5uZWVkVG9SZW1peFNhbXBsZXM9ITE7cmV0dXJuIGF9KCksZj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD8xNzQ6ODd9O2EudXBkYXRlTlI1MD1mdW5jdGlvbihiKXthLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9CmI+PjQmNzthLk5SNTBSaWdodE1peGVyVm9sdW1lPWImN307YS51cGRhdGVOUjUxPWZ1bmN0aW9uKGIpe2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PW4oNyxiKTthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD1uKDYsYik7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9big1LGIpO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PW4oNCxiKTthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9bigzLGIpO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD1uKDIsYik7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PW4oMSxiKTthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ9bigwLGIpfTthLnVwZGF0ZU5SNTI9ZnVuY3Rpb24oYil7YS5OUjUySXNTb3VuZEVuYWJsZWQ9big3LGIpfTthLm1heEZyYW1lU2VxdWVuY2VDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD8KMTYzODQ6ODE5Mn07YS5tYXhEb3duU2FtcGxlQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGIuQ0xPQ0tfU1BFRUQoKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtnWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI7Z1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyO2dbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJhbWVTZXF1ZW5jZXJ9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPWdbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj1nWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmZyYW1lU2VxdWVuY2VyPWdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO1ZhKCl9O2EuY3VycmVudEN5Y2xlcz0wO2EubWVtb3J5TG9jYXRpb25OUjUwPTY1MzE2O2EuTlI1MExlZnRNaXhlclZvbHVtZT0wO2EuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9CjA7YS5tZW1vcnlMb2NhdGlvbk5SNTE9NjUzMTc7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EubWVtb3J5TG9jYXRpb25OUjUyPTY1MzE4O2EuTlI1MklzU291bmRFbmFibGVkPSEwO2EubWVtb3J5TG9jYXRpb25DaGFubmVsM0xvYWRSZWdpc3RlclN0YXJ0PTY1MzI4O2EuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj0wOwphLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXI9NDhFMzthLmZyYW1lU2VxdWVuY2VyPTA7YS5hdWRpb1F1ZXVlSW5kZXg9MDthLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplPTEzMTA3MjthLnNhdmVTdGF0ZVNsb3Q9NjtyZXR1cm4gYX0oKSxwPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZUludGVycnVwdEVuYWJsZWQ9ZnVuY3Rpb24oYil7YS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQ9bihhLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0LGIpO2EuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPW4oYS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCxiKTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPW4oYS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0LGIpO2EuaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkPW4oYS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCxiKTthLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZD1uKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlPQpifTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZD1mdW5jdGlvbihiKXthLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPW4oYS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCxiKTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPW4oYS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCxiKTthLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9bihhLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQsYik7YS5pc1NlcmlhbEludGVycnVwdFJlcXVlc3RlZD1uKGEuYml0UG9zaXRpb25TZXJpYWxJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD1uKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9Yn07YS5hcmVJbnRlcnJ1cHRzUGVuZGluZz1mdW5jdGlvbigpe3JldHVybiAwPChhLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSZhLmludGVycnVwdHNFbmFibGVkVmFsdWUmMzEpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe1EoMTAyNCsKNTAqYS5zYXZlU3RhdGVTbG90LGEubWFzdGVySW50ZXJydXB0U3dpdGNoKTtRKDEwMjUrNTAqYS5zYXZlU3RhdGVTbG90LGEubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXkpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EubWFzdGVySW50ZXJydXB0U3dpdGNoPVIoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9UigxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKHgoYS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQpKTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZCh4KGEubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KSl9O2EubWFzdGVySW50ZXJydXB0U3dpdGNoPSExO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9ITE7YS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdD0wO2EuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ9MTthLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ9CjI7YS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdD0zO2EuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQ9NDthLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZD02NTUzNTthLmludGVycnVwdHNFbmFibGVkVmFsdWU9MDthLmlzVkJsYW5rSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzTGNkSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRFbmFibGVkPSExO2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0PTY1Mjk1O2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPTA7YS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5zYXZlU3RhdGVTbG90PQoyO3JldHVybiBhfSgpLG09ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIDI1Nn07YS51cGRhdGVEaXZpZGVyUmVnaXN0ZXI9ZnVuY3Rpb24oYil7Yj1hLmRpdmlkZXJSZWdpc3RlcjthLmRpdmlkZXJSZWdpc3Rlcj0wO2goYS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlciwwKTthLnRpbWVyRW5hYmxlZCYmcGIoYixhLmRpdmlkZXJSZWdpc3RlcikmJlhhKCl9O2EudXBkYXRlVGltZXJDb3VudGVyPWZ1bmN0aW9uKGIpe2lmKGEudGltZXJFbmFibGVkKXtpZihhLnRpbWVyQ291bnRlcldhc1Jlc2V0KXJldHVybjthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXkmJihhLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITEpfWEudGltZXJDb3VudGVyPWJ9O2EudXBkYXRlVGltZXJNb2R1bG89ZnVuY3Rpb24oYil7YS50aW1lck1vZHVsbz1iO2EudGltZXJFbmFibGVkJiZhLnRpbWVyQ291bnRlcldhc1Jlc2V0JiYoYS50aW1lckNvdW50ZXI9CmEudGltZXJNb2R1bG8sYS50aW1lckNvdW50ZXJXYXNSZXNldD0hMSl9O2EudXBkYXRlVGltZXJDb250cm9sPWZ1bmN0aW9uKGIpe3ZhciBjPWEudGltZXJFbmFibGVkO2EudGltZXJFbmFibGVkPW4oMixiKTtiJj0zO2lmKCFjKXtjPVlhKGEudGltZXJJbnB1dENsb2NrKTt2YXIgZD1ZYShiKTsoYS50aW1lckVuYWJsZWQ/bihjLGEuZGl2aWRlclJlZ2lzdGVyKTpuKGMsYS5kaXZpZGVyUmVnaXN0ZXIpJiZuKGQsYS5kaXZpZGVyUmVnaXN0ZXIpKSYmWGEoKX1hLnRpbWVySW5wdXRDbG9jaz1ifTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2dbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztnWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmRpdmlkZXJSZWdpc3RlcjtRKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90LGEudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheSk7USgxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLnRpbWVyQ291bnRlcldhc1Jlc2V0KTtoKGEubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXIsCmEudGltZXJDb3VudGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRDeWNsZXM9Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kaXZpZGVyUmVnaXN0ZXI9Z1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PVIoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EudGltZXJDb3VudGVyV2FzUmVzZXQ9UigxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS50aW1lckNvdW50ZXI9eChhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyKTthLnRpbWVyTW9kdWxvPXgoYS5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvKTthLnRpbWVySW5wdXRDbG9jaz14KGEubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2wpfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPTY1Mjg0O2EuZGl2aWRlclJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcj02NTI4NTthLnRpbWVyQ291bnRlcj0KMDthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITE7YS50aW1lckNvdW50ZXJXYXNSZXNldD0hMTthLnRpbWVyQ291bnRlck1hc2s9MDthLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG89NjUyODY7YS50aW1lck1vZHVsbz0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w9NjUyODc7YS50aW1lckVuYWJsZWQ9ITE7YS50aW1lcklucHV0Q2xvY2s9MDthLnNhdmVTdGF0ZVNsb3Q9NTtyZXR1cm4gYX0oKSxOPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZVRyYW5zZmVyQ29udHJvbD1mdW5jdGlvbihiKXthLmlzU2hpZnRDbG9ja0ludGVybmFsPW4oMCxiKTthLmlzQ2xvY2tTcGVlZEZhc3Q9bigxLGIpO2EudHJhbnNmZXJTdGFydEZsYWc9big3LGIpO3JldHVybiEwfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJEYXRhPTY1MjgxO2EubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckNvbnRyb2w9NjUyODI7YS5udW1iZXJPZkJpdHNUcmFuc2ZlcnJlZD0KMDthLmlzU2hpZnRDbG9ja0ludGVybmFsPSExO2EuaXNDbG9ja1NwZWVkRmFzdD0hMTthLnRyYW5zZmVyU3RhcnRGbGFnPSExO3JldHVybiBhfSgpLEE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSm95cGFkPWZ1bmN0aW9uKGIpe2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPWJeMjU1O2EuaXNEcGFkVHlwZT1uKDQsYS5qb3lwYWRSZWdpc3RlckZsaXBwZWQpO2EuaXNCdXR0b25UeXBlPW4oNSxhLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EudXBkYXRlSm95cGFkKHgoYS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyKSl9O2EudXA9ITE7YS5kb3duPSExO2EubGVmdD0hMTthLnJpZ2h0PSExO2EuYT0hMTthLmI9ITE7YS5zZWxlY3Q9ITE7YS5zdGFydD0hMTthLm1lbW9yeUxvY2F0aW9uSm95cGFkUmVnaXN0ZXI9NjUyODA7YS5qb3lwYWRSZWdpc3RlckZsaXBwZWQ9MDthLmlzRHBhZFR5cGU9CiExO2EuaXNCdXR0b25UeXBlPSExO2Euc2F2ZVN0YXRlU2xvdD0zO3JldHVybiBhfSgpLEI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTGNkU3RhdHVzPWZ1bmN0aW9uKGIpe3ZhciBjPXgoYS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyk7Yj1iJjI0OHxjJjd8MTI4O2goYS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxiKX07YS51cGRhdGVMY2RDb250cm9sPWZ1bmN0aW9uKGIpe3ZhciBjPWEuZW5hYmxlZDthLmVuYWJsZWQ9big3LGIpO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9big2LGIpO2Eud2luZG93RGlzcGxheUVuYWJsZWQ9big1LGIpO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD1uKDQsYik7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PW4oMyxiKTthLnRhbGxTcHJpdGVTaXplPW4oMixiKTthLnNwcml0ZURpc3BsYXlFbmFibGU9bigxLGIpO2EuYmdEaXNwbGF5RW5hYmxlZD1uKDAsYik7YyYmIWEuZW5hYmxlZCYmcmIoITApOyFjJiZhLmVuYWJsZWQmJgpyYighMSl9O2EubWVtb3J5TG9jYXRpb25MY2RTdGF0dXM9NjUzNDU7YS5jdXJyZW50TGNkTW9kZT0wO2EubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmU9NjUzNDk7YS5jb2luY2lkZW5jZUNvbXBhcmU9MDthLm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbD02NTM0NDthLmVuYWJsZWQ9ITA7YS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdD0hMTthLndpbmRvd0Rpc3BsYXlFbmFibGVkPSExO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD0hMTthLmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS50YWxsU3ByaXRlU2l6ZT0hMTthLnNwcml0ZURpc3BsYXlFbmFibGU9ITE7YS5iZ0Rpc3BsYXlFbmFibGVkPSExO3JldHVybiBhfSgpLHI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGEuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKX07YS5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORT1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPwoxNTM9PT1hLnNjYW5saW5lUmVnaXN0ZXI/ODo5MTI6MTUzPT09YS5zY2FubGluZVJlZ2lzdGVyPzQ6NDU2fTthLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERT1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzc1MjozNzZ9O2EuTUlOX0NZQ0xFU19UUkFOU0ZFUl9EQVRBX0xDRF9NT0RFPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/NDk4OjI0OX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtnWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnNjYW5saW5lQ3ljbGVDb3VudGVyO2dbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPUIuY3VycmVudExjZE1vZGU7aChhLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlcixhLnNjYW5saW5lUmVnaXN0ZXIpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07Qi5jdXJyZW50TGNkTW9kZT1nWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTsKYS5zY2FubGluZVJlZ2lzdGVyPXgoYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpO0IudXBkYXRlTGNkQ29udHJvbCh4KEIubWVtb3J5TG9jYXRpb25MY2RDb250cm9sKSl9O2EuY3VycmVudEN5Y2xlcz0wO2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj02NTM0ODthLnNjYW5saW5lUmVnaXN0ZXI9MDthLm1lbW9yeUxvY2F0aW9uRG1hVHJhbnNmZXI9NjUzNTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFg9NjUzNDc7YS5zY3JvbGxYPTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFk9NjUzNDY7YS5zY3JvbGxZPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1g9NjUzNTU7YS53aW5kb3dYPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1k9NjUzNTQ7YS53aW5kb3dZPTA7YS5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ9Mzg5MTI7YS5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydD0zOTkzNjthLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ9CjM0ODE2O2EubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0PTMyNzY4O2EubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGU9NjUwMjQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlPTY1MzUxO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lPTY1MzUyO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvPTY1MzUzO2Euc2F2ZVN0YXRlU2xvdD0xO3JldHVybiBhfSgpLGQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50Um9tQmFuaztnWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRSYW1CYW5rO1EoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1JhbUJhbmtpbmdFbmFibGVkKTtRKDEwMjkrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMxUm9tTW9kZUVuYWJsZWQpO1EoMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3QsCmEuaXNSb21Pbmx5KTtRKDEwMzErNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMxKTtRKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMyKTtRKDEwMzMrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMzKTtRKDEwMzQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkM1KX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRSb21CYW5rPWdbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudFJhbUJhbms9Z1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1JhbUJhbmtpbmdFbmFibGVkPVIoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9UigxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc1JvbU9ubHk9UigxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzE9UigxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzI9UigxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzM9UigxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdCk7CmEuaXNNQkM1PVIoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLmNhcnRyaWRnZVJvbUxvY2F0aW9uPTA7YS5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb249MTYzODQ7YS52aWRlb1JhbUxvY2F0aW9uPTMyNzY4O2EuY2FydHJpZGdlUmFtTG9jYXRpb249NDA5NjA7YS5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb249NDkxNTI7YS5pbnRlcm5hbFJhbUJhbmtPbmVMb2NhdGlvbj01MzI0ODthLmVjaG9SYW1Mb2NhdGlvbj01NzM0NDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj02NTAyNDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD02NTE4MzthLnVudXNhYmxlTWVtb3J5TG9jYXRpb249NjUxODQ7YS51bnVzYWJsZU1lbW9yeUVuZExvY2F0aW9uPTY1Mjc5O2EuY3VycmVudFJvbUJhbms9MDthLmN1cnJlbnRSYW1CYW5rPTA7YS5pc1JhbUJhbmtpbmdFbmFibGVkPSExO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA7YS5pc1JvbU9ubHk9ITA7YS5pc01CQzE9CiExO2EuaXNNQkMyPSExO2EuaXNNQkMzPSExO2EuaXNNQkM1PSExO2EubWVtb3J5TG9jYXRpb25IZG1hU291cmNlSGlnaD02NTM2MTthLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdz02NTM2MjthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaD02NTM2MzthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uTG93PTY1MzY0O2EubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcj02NTM2NTthLkRNQUN5Y2xlcz0wO2EuaXNIYmxhbmtIZG1hQWN0aXZlPSExO2EuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPTA7YS5oYmxhbmtIZG1hU291cmNlPTA7YS5oYmxhbmtIZG1hRGVzdGluYXRpb249MDthLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbms9NjUzNTk7YS5tZW1vcnlMb2NhdGlvbkdCQ1dSQU1CYW5rPTY1MzkyO2Euc2F2ZVN0YXRlU2xvdD00O3JldHVybiBhfSgpLGI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuQ0xPQ0tfU1BFRUQ9ZnVuY3Rpb24oKXtyZXR1cm4gYS5HQkNEb3VibGVTcGVlZD8KODM4ODYwODo0MTk0MzA0fTthLk1BWF9DWUNMRVNfUEVSX0ZSQU1FPWZ1bmN0aW9uKCl7cmV0dXJuIGEuR0JDRG91YmxlU3BlZWQ/MTQwNDQ4OjcwMjI0fTthLmVuYWJsZUhhbHQ9ZnVuY3Rpb24oKXtwLm1hc3RlckludGVycnVwdFN3aXRjaD9hLmlzSGFsdE5vcm1hbD0hMDowPT09KHAuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSZwLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSYzMSk/YS5pc0hhbHROb0p1bXA9ITA6YS5pc0hhbHRCdWc9ITB9O2EuZXhpdEhhbHRBbmRTdG9wPWZ1bmN0aW9uKCl7YS5pc0hhbHROb0p1bXA9ITE7YS5pc0hhbHROb3JtYWw9ITE7YS5pc0hhbHRCdWc9ITE7YS5pc1N0b3BwZWQ9ITF9O2EuaXNIYWx0ZWQ9ZnVuY3Rpb24oKXtyZXR1cm4gYS5pc0hhbHROb3JtYWx8fGEuaXNIYWx0Tm9KdW1wPyEwOiExfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2dbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJBO2dbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPQphLnJlZ2lzdGVyQjtnWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQztnWzEwMjcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRDtnWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRTtnWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVySDtnWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyTDtnWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRjtnWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN0YWNrUG9pbnRlcjtnWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnByb2dyYW1Db3VudGVyO2dbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztRKDEwNDErNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNIYWx0Tm9ybWFsKTtRKDEwNDIrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNIYWx0Tm9KdW1wKTtRKDEwNDMrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNIYWx0QnVnKTtRKDEwNDQrCjUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzU3RvcHBlZCl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5yZWdpc3RlckE9Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckI9Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckM9Z1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckQ9Z1sxMDI3KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckU9Z1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckg9Z1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckw9Z1sxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckY9Z1sxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zdGFja1BvaW50ZXI9Z1sxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5wcm9ncmFtQ291bnRlcj1nWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmN1cnJlbnRDeWNsZXM9Z1sxMDM2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc0hhbHROb3JtYWw9ClIoMTA0MSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNIYWx0Tm9KdW1wPVIoMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNIYWx0QnVnPVIoMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNTdG9wcGVkPVIoMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLkdCQ0VuYWJsZWQ9ITE7YS5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoPTY1MzU3O2EuR0JDRG91YmxlU3BlZWQ9ITE7YS5yZWdpc3RlckE9MDthLnJlZ2lzdGVyQj0wO2EucmVnaXN0ZXJDPTA7YS5yZWdpc3RlckQ9MDthLnJlZ2lzdGVyRT0wO2EucmVnaXN0ZXJIPTA7YS5yZWdpc3Rlckw9MDthLnJlZ2lzdGVyRj0wO2Euc3RhY2tQb2ludGVyPTA7YS5wcm9ncmFtQ291bnRlcj0wO2EuY3VycmVudEN5Y2xlcz0wO2EuaXNIYWx0Tm9ybWFsPSExO2EuaXNIYWx0Tm9KdW1wPSExO2EuaXNIYWx0QnVnPSExO2EuaXNTdG9wcGVkPSExO2Euc2F2ZVN0YXRlU2xvdD0wO3JldHVybiBhfSgpLFg9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLmN5Y2xlc1BlckN5Y2xlU2V0PTJFOTthLmN5Y2xlU2V0cz0wO2EuY3ljbGVzPTA7cmV0dXJuIGF9KCksUD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5zdGVwc1BlclN0ZXBTZXQ9MkU5O2Euc3RlcFNldHM9MDthLnN0ZXBzPTA7YS5SRVNQT05TRV9DT05ESVRJT05fRVJST1I9LTE7YS5SRVNQT05TRV9DT05ESVRJT05fRlJBTUU9MDthLlJFU1BPTlNFX0NPTkRJVElPTl9BVURJTz0xO2EuUkVTUE9OU0VfQ09ORElUSU9OX0JSRUFLUE9JTlQ9MjtyZXR1cm4gYX0oKTsxNDA+R2Euc2l6ZSgpJiZHYS5ncm93KDE0MC1HYS5zaXplKCkpO3ZhciBFYT0hMSxZYj1PYmplY3QuZnJlZXplKHttZW1vcnk6R2EsY29uZmlnOmZ1bmN0aW9uKGEsYyxlLGcsayxsLG4scSx0KXtWLmVuYWJsZUJvb3RSb209MDxhPyEwOiExO1YudXNlR2JjV2hlbkF2YWlsYWJsZT0wPGM/ITA6ITE7Vi5hdWRpb0JhdGNoUHJvY2Vzc2luZz0wPGU/ITA6ITE7Vi5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0wPGc/ITA6CiExO1YudGltZXJzQmF0Y2hQcm9jZXNzaW5nPTA8az8hMDohMTtWLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPTA8bD8hMDohMTtWLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXM9MDxuPyEwOiExO1YudGlsZVJlbmRlcmluZz0wPHE/ITA6ITE7Vi50aWxlQ2FjaGluZz0wPHQ/ITA6ITE7YT14KDMyMyk7Yi5HQkNFbmFibGVkPTE5Mj09PWF8fFYudXNlR2JjV2hlbkF2YWlsYWJsZSYmMTI4PT09YT8hMDohMTtiLkdCQ0RvdWJsZVNwZWVkPSExO2IucmVnaXN0ZXJBPTA7Yi5yZWdpc3RlckI9MDtiLnJlZ2lzdGVyQz0wO2IucmVnaXN0ZXJEPTA7Yi5yZWdpc3RlckU9MDtiLnJlZ2lzdGVySD0wO2IucmVnaXN0ZXJMPTA7Yi5yZWdpc3RlckY9MDtiLnN0YWNrUG9pbnRlcj0wO2IucHJvZ3JhbUNvdW50ZXI9MDtiLmN1cnJlbnRDeWNsZXM9MDtiLmlzSGFsdE5vcm1hbD0hMTtiLmlzSGFsdE5vSnVtcD0hMTtiLmlzSGFsdEJ1Zz0hMTtiLmlzU3RvcHBlZD0hMTtiLkdCQ0VuYWJsZWQ/KGIucmVnaXN0ZXJBPQoxNyxiLnJlZ2lzdGVyRj0xMjgsYi5yZWdpc3RlckI9MCxiLnJlZ2lzdGVyQz0wLGIucmVnaXN0ZXJEPTI1NSxiLnJlZ2lzdGVyRT04NixiLnJlZ2lzdGVySD0wLGIucmVnaXN0ZXJMPTEzKTooYi5yZWdpc3RlckE9MSxiLnJlZ2lzdGVyRj0xNzYsYi5yZWdpc3RlckI9MCxiLnJlZ2lzdGVyQz0xOSxiLnJlZ2lzdGVyRD0wLGIucmVnaXN0ZXJFPTIxNixiLnJlZ2lzdGVySD0xLGIucmVnaXN0ZXJMPTc3KTtiLnByb2dyYW1Db3VudGVyPTI1NjtiLnN0YWNrUG9pbnRlcj02NTUzNDtkLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE7ZC5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMDthPXgoMzI3KTtkLmlzUm9tT25seT0hMTtkLmlzTUJDMT0hMTtkLmlzTUJDMj0hMTtkLmlzTUJDMz0hMTtkLmlzTUJDNT0hMTswPT09YT9kLmlzUm9tT25seT0hMDoxPD1hJiYzPj1hP2QuaXNNQkMxPSEwOjU8PWEmJjY+PWE/ZC5pc01CQzI9ITA6MTU8PWEmJjE5Pj1hP2QuaXNNQkMzPSEwOjI1PD1hJiYzMD49YSYmKGQuaXNNQkM1PQohMCk7ZC5jdXJyZW50Um9tQmFuaz0xO2QuY3VycmVudFJhbUJhbms9MDtoKDY1MzYxLDI1NSk7aCg2NTM2MiwyNTUpO2goNjUzNjMsMjU1KTtoKDY1MzY0LDI1NSk7aCg2NTM2NSwyNTUpO3IuY3VycmVudEN5Y2xlcz0wO3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXI9MDtyLnNjYW5saW5lUmVnaXN0ZXI9MDtyLnNjcm9sbFg9MDtyLnNjcm9sbFk9MDtyLndpbmRvd1g9MDtyLndpbmRvd1k9MDtiLkdCQ0VuYWJsZWQ/KHIuc2NhbmxpbmVSZWdpc3Rlcj0xNDQsaCg2NTM0NCwxNDUpLGgoNjUzNDUsMTI5KSxoKDY1MzQ4LDE0NCksaCg2NTM1MSwyNTIpKTooci5zY2FubGluZVJlZ2lzdGVyPTE0NCxoKDY1MzQ0LDE0NSksaCg2NTM0NSwxMzMpLGgoNjUzNTAsMjU1KSxoKDY1MzUxLDI1MiksaCg2NTM1MiwyNTUpLGgoNjUzNTMsMjU1KSk7aCg2NTM1OSwwKTtoKDY1MzkyLDEpO2IuR0JDRW5hYmxlZD8oaCg2NTM4NCwxOTIpLGgoNjUzODUsMjU1KSxoKDY1Mzg2LDE5MyksaCg2NTM4NywxMykpOihoKDY1Mzg0LAoyNTUpLGgoNjUzODUsMjU1KSxoKDY1Mzg2LDI1NSksaCg2NTM4NywyNTUpKTtmLmN1cnJlbnRDeWNsZXM9MDtmLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9MDtmLk5SNTBSaWdodE1peGVyVm9sdW1lPTA7Zi5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2YuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDtmLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2YuTlI1MklzU291bmRFbmFibGVkPSEwO2YuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0wO2YuZG93blNhbXBsZUN5Y2xlQ291bnRlcj0KMDtmLmZyYW1lU2VxdWVuY2VyPTA7Zi5hdWRpb1F1ZXVlSW5kZXg9MDt6LmluaXRpYWxpemUoKTtMLmluaXRpYWxpemUoKTtJLmluaXRpYWxpemUoKTtNLmluaXRpYWxpemUoKTtoKGYubWVtb3J5TG9jYXRpb25OUjUwLDExOSk7aChmLm1lbW9yeUxvY2F0aW9uTlI1MSwyNDMpO2goZi5tZW1vcnlMb2NhdGlvbk5SNTIsMjQxKTt3LmNoYW5uZWwxU2FtcGxlPTE1O3cuY2hhbm5lbDJTYW1wbGU9MTU7dy5jaGFubmVsM1NhbXBsZT0xNTt3LmNoYW5uZWw0U2FtcGxlPTE1O3cuY2hhbm5lbDFEYWNFbmFibGVkPSExO3cuY2hhbm5lbDJEYWNFbmFibGVkPSExO3cuY2hhbm5lbDNEYWNFbmFibGVkPSExO3cuY2hhbm5lbDREYWNFbmFibGVkPSExO3cubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O3cucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzt3Lm1peGVyVm9sdW1lQ2hhbmdlZD0hMDt3Lm1peGVyRW5hYmxlZENoYW5nZWQ9ITA7dy5uZWVkVG9SZW1peFNhbXBsZXM9CiExO3AudXBkYXRlSW50ZXJydXB0RW5hYmxlZCgwKTtoKHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkLHAuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSk7cC51cGRhdGVJbnRlcnJ1cHRSZXF1ZXN0ZWQoMjI1KTtoKHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LHAuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlKTttLmN1cnJlbnRDeWNsZXM9MDttLmRpdmlkZXJSZWdpc3Rlcj0wO20udGltZXJDb3VudGVyPTA7bS50aW1lck1vZHVsbz0wO20udGltZXJFbmFibGVkPSExO20udGltZXJJbnB1dENsb2NrPTA7bS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExO20udGltZXJDb3VudGVyV2FzUmVzZXQ9ITE7Yi5HQkNFbmFibGVkPyhoKDY1Mjg0LDMwKSxtLmRpdmlkZXJSZWdpc3Rlcj03ODQwKTooaCg2NTI4NCwxNzEpLG0uZGl2aWRlclJlZ2lzdGVyPTQzOTgwKTtoKDY1Mjg3LDI0OCk7bS50aW1lcklucHV0Q2xvY2s9MjQ4O04uY3VycmVudEN5Y2xlcz0wO04ubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQ9CjA7Yi5HQkNFbmFibGVkPyhoKDY1MjgyLDEyNCksTi51cGRhdGVUcmFuc2ZlckNvbnRyb2woMTI0KSk6KGgoNjUyODIsMTI2KSxOLnVwZGF0ZVRyYW5zZmVyQ29udHJvbCgxMjYpKTtiLkdCQ0VuYWJsZWQ/KGgoNjUzOTIsMjQ4KSxoKDY1MzU5LDI1NCksaCg2NTM1NywxMjYpLGgoNjUyODAsMjA3KSxoKDY1Mjk1LDIyNSksaCg2NTM4OCwyNTQpLGgoNjUzOTcsMTQzKSk6KGgoNjUzOTIsMjU1KSxoKDY1MzU5LDI1NSksaCg2NTM1NywyNTUpLGgoNjUyODAsMjA3KSxoKDY1Mjk1LDIyNSkpO0VhPSExO1guY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O1guY3ljbGVTZXRzPTA7WC5jeWNsZXM9MDtQLnN0ZXBzUGVyU3RlcFNldD0yRTk7UC5zdGVwU2V0cz0wO1Auc3RlcHM9MH0saGFzQ29yZVN0YXJ0ZWQ6ZnVuY3Rpb24oKXtyZXR1cm4gRWE/MTowfSxzYXZlU3RhdGU6ZnVuY3Rpb24oKXtiLnNhdmVTdGF0ZSgpO3Iuc2F2ZVN0YXRlKCk7cC5zYXZlU3RhdGUoKTtBLnNhdmVTdGF0ZSgpO2Quc2F2ZVN0YXRlKCk7Cm0uc2F2ZVN0YXRlKCk7Zi5zYXZlU3RhdGUoKTt6LnNhdmVTdGF0ZSgpO0wuc2F2ZVN0YXRlKCk7SS5zYXZlU3RhdGUoKTtNLnNhdmVTdGF0ZSgpO0VhPSExfSxsb2FkU3RhdGU6ZnVuY3Rpb24oKXtiLmxvYWRTdGF0ZSgpO3IubG9hZFN0YXRlKCk7cC5sb2FkU3RhdGUoKTtBLmxvYWRTdGF0ZSgpO2QubG9hZFN0YXRlKCk7bS5sb2FkU3RhdGUoKTtmLmxvYWRTdGF0ZSgpO3oubG9hZFN0YXRlKCk7TC5sb2FkU3RhdGUoKTtJLmxvYWRTdGF0ZSgpO00ubG9hZFN0YXRlKCk7RWE9ITE7WC5jeWNsZXNQZXJDeWNsZVNldD0yRTk7WC5jeWNsZVNldHM9MDtYLmN5Y2xlcz0wO1Auc3RlcHNQZXJTdGVwU2V0PTJFOTtQLnN0ZXBTZXRzPTA7UC5zdGVwcz0wfSxnZXRTdGVwc1BlclN0ZXBTZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gUC5zdGVwc1BlclN0ZXBTZXR9LGdldFN0ZXBTZXRzOmZ1bmN0aW9uKCl7cmV0dXJuIFAuc3RlcFNldHN9LGdldFN0ZXBzOmZ1bmN0aW9uKCl7cmV0dXJuIFAuc3RlcHN9LApleGVjdXRlTXVsdGlwbGVGcmFtZXM6ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPTAsZD0wO2Q8YSYmMDw9YjspYj1jYigpLGQrPTE7cmV0dXJuIDA+Yj9iOjB9LGV4ZWN1dGVGcmFtZTpjYixleGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvOmZ1bmN0aW9uKGEpe3ZvaWQgMD09PWEmJihhPTApO3JldHVybiBEYSghMCxhLC0xKX0sZXhlY3V0ZUZyYW1lVW50aWxCcmVha3BvaW50OmZ1bmN0aW9uKGEpe3JldHVybiBEYSghMCwtMSxhKX0sZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpb1VudGlsQnJlYWtwb2ludDpmdW5jdGlvbihhLGIpe3JldHVybiBEYSghMCxhLGIpfSxleGVjdXRlVW50aWxDb25kaXRpb246RGEsZXhlY3V0ZVN0ZXA6ZGIsZ2V0Q3ljbGVzUGVyQ3ljbGVTZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gWC5jeWNsZXNQZXJDeWNsZVNldH0sZ2V0Q3ljbGVTZXRzOmZ1bmN0aW9uKCl7cmV0dXJuIFguY3ljbGVTZXRzfSxnZXRDeWNsZXM6ZnVuY3Rpb24oKXtyZXR1cm4gWC5jeWNsZXN9LHNldEpveXBhZFN0YXRlOmZ1bmN0aW9uKGEsCmIsZCxmLGcsaCxrLGwpezA8YT9zYSgwKTpmYSgwLCExKTswPGI/c2EoMSk6ZmEoMSwhMSk7MDxkP3NhKDIpOmZhKDIsITEpOzA8Zj9zYSgzKTpmYSgzLCExKTswPGc/c2EoNCk6ZmEoNCwhMSk7MDxoP3NhKDUpOmZhKDUsITEpOzA8az9zYSg2KTpmYSg2LCExKTswPGw/c2EoNyk6ZmEoNywhMSl9LGdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXI6VWEsY2xlYXJBdWRpb0J1ZmZlcjpWYSxXQVNNQk9ZX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfTUVNT1JZX1NJWkU6OTE3NTA0MCxXQVNNQk9ZX1dBU01fUEFHRVM6MTQwLEFTU0VNQkxZU0NSSVBUX01FTU9SWV9MT0NBVElPTjowLEFTU0VNQkxZU0NSSVBUX01FTU9SWV9TSVpFOjEwMjQsV0FTTUJPWV9TVEFURV9MT0NBVElPTjoxMDI0LFdBU01CT1lfU1RBVEVfU0laRToxMDI0LEdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjIwNDgsR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTo2NTUzNSxWSURFT19SQU1fTE9DQVRJT046MjA0OCwKVklERU9fUkFNX1NJWkU6MTYzODQsV09SS19SQU1fTE9DQVRJT046MTg0MzIsV09SS19SQU1fU0laRTozMjc2OCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjo1MTIwMCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjE2Mzg0LEdSQVBISUNTX09VVFBVVF9MT0NBVElPTjo2NzU4NCxHUkFQSElDU19PVVRQVVRfU0laRTo1MjEyMTYsR0JDX1BBTEVUVEVfTE9DQVRJT046Njc1ODQsR0JDX1BBTEVUVEVfU0laRTo1MTIsQkdfUFJJT1JJVFlfTUFQX0xPQ0FUSU9OOjY5NjMyLEJHX1BSSU9SSVRZX01BUF9TSVpFOjIzNTUyLEZSQU1FX0xPQ0FUSU9OOjkzMTg0LEZSQU1FX1NJWkU6OTMxODQsQkFDS0dST1VORF9NQVBfTE9DQVRJT046MjMyNDQ4LEJBQ0tHUk9VTkRfTUFQX1NJWkU6MTk2NjA4LFRJTEVfREFUQV9MT0NBVElPTjo0MjkwNTYsVElMRV9EQVRBX1NJWkU6MTQ3NDU2LE9BTV9USUxFU19MT0NBVElPTjo1NzY1MTIsT0FNX1RJTEVTX1NJWkU6MTIyODgsCkFVRElPX0JVRkZFUl9MT0NBVElPTjo1ODg4MDAsQVVESU9fQlVGRkVSX1NJWkU6MTMxMDcyLENBUlRSSURHRV9SQU1fTE9DQVRJT046NzE5ODcyLENBUlRSSURHRV9SQU1fU0laRToxMzEwNzIsQ0FSVFJJREdFX1JPTV9MT0NBVElPTjo4NTA5NDQsQ0FSVFJJREdFX1JPTV9TSVpFOjgyNTg1NjAsREVCVUdfR0FNRUJPWV9NRU1PUllfTE9DQVRJT046OTEwOTUwNCxERUJVR19HQU1FQk9ZX01FTU9SWV9TSVpFOjY1NTM1LGdldFdhc21Cb3lPZmZzZXRGcm9tR2FtZUJveU9mZnNldDokYSxnZXRSZWdpc3RlckE6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckF9LGdldFJlZ2lzdGVyQjpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQn0sZ2V0UmVnaXN0ZXJDOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJDfSxnZXRSZWdpc3RlckQ6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckR9LGdldFJlZ2lzdGVyRTpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRX0sZ2V0UmVnaXN0ZXJIOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJIfSwKZ2V0UmVnaXN0ZXJMOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJMfSxnZXRSZWdpc3RlckY6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckZ9LGdldFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXJ9LGdldFN0YWNrUG9pbnRlcjpmdW5jdGlvbigpe3JldHVybiBiLnN0YWNrUG9pbnRlcn0sZ2V0T3Bjb2RlQXRQcm9ncmFtQ291bnRlcjpmdW5jdGlvbigpe3JldHVybiB4KGIucHJvZ3JhbUNvdW50ZXIpfSxnZXRMWTpmdW5jdGlvbigpe3JldHVybiByLnNjYW5saW5lUmVnaXN0ZXJ9LGRyYXdCYWNrZ3JvdW5kTWFwVG9XYXNtTWVtb3J5OmZ1bmN0aW9uKGEpe3ZhciBjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydDtCLmJnV2luZG93VGlsZURhdGFTZWxlY3QmJihjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0KTt2YXIgZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDsKQi5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTtmb3IodmFyIGY9MDsyNTY+ZjtmKyspZm9yKHZhciBoPTA7MjU2Pmg7aCsrKXt2YXIgaz1mLGw9aCxtPWQrMzIqKGs+PjMpKyhsPj4zKSxwPWFhKG0sMCk7cD16YShjLHApO3ZhciBxPWslODtrPWwlODtrPTctaztsPTA7Yi5HQkNFbmFibGVkJiYwPGEmJihsPWFhKG0sMSkpO24oNixsKSYmKHE9Ny1xKTt2YXIgdD0wO24oMyxsKSYmKHQ9MSk7bT1hYShwKzIqcSx0KTtwPWFhKHArMipxKzEsdCk7cT0wO24oayxwKSYmKHErPTEscTw8PTEpO24oayxtKSYmKHErPTEpO3A9MyooMjU2KmYraCk7aWYoYi5HQkNFbmFibGVkJiYwPGEpbD1MYShsJjcscSwhMSksaz1kYSgwLGwpLG09ZGEoMSxsKSxxPWRhKDIsbCksbD0yMzI0NDgrcCxnW2xdPWssZ1tsKzFdPW0sZ1tsKzJdPXE7ZWxzZSBmb3Ioaz1LYShxLHIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksbT0wOzM+Cm07bSsrKWw9MjMyNDQ4K3ArbSxnW2xdPWt9fSxkcmF3VGlsZURhdGFUb1dhc21NZW1vcnk6ZnVuY3Rpb24oKXtmb3IodmFyIGE9MDsyMz5hO2ErKylmb3IodmFyIGI9MDszMT5iO2IrKyl7dmFyIGQ9MDsxNTxiJiYoZD0xKTt2YXIgZj1hOzE1PGEmJihmLT0xNSk7Zjw8PTQ7Zj0xNTxiP2YrKGItMTUpOmYrYjt2YXIgZz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydDsxNTxhJiYoZz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQpO2Zvcih2YXIgaD0wOzg+aDtoKyspaWIoZixnLGQsMCw3LGgsOCpiLDgqYStoLDI0OCw0MjkwNTYsITAsMCwtMSl9fSxnZXRESVY6ZnVuY3Rpb24oKXtyZXR1cm4gbS5kaXZpZGVyUmVnaXN0ZXJ9LGdldFRJTUE6ZnVuY3Rpb24oKXtyZXR1cm4gbS50aW1lckNvdW50ZXJ9LGdldFRNQTpmdW5jdGlvbigpe3JldHVybiBtLnRpbWVyTW9kdWxvfSxnZXRUQUM6ZnVuY3Rpb24oKXt2YXIgYT1tLnRpbWVySW5wdXRDbG9jazsKbS50aW1lckVuYWJsZWQmJihhfD00KTtyZXR1cm4gYX0sdXBkYXRlRGVidWdHQk1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzY1NTM1Pj1hO2ErKyl7dmFyIGI9WmEoYSk7Z1s5MTA5NTA0K2FdPWJ9fSx1cGRhdGU6Y2IsZW11bGF0aW9uU3RlcDpkYixnZXRBdWRpb1F1ZXVlSW5kZXg6VWEscmVzZXRBdWRpb1F1ZXVlOlZhLHdhc21NZW1vcnlTaXplOjkxNzUwNDAsd2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbjoxMDI0LHdhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZToxMDI0LGdhbWVCb3lJbnRlcm5hbE1lbW9yeUxvY2F0aW9uOjIwNDgsZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZTo2NTUzNSx2aWRlb091dHB1dExvY2F0aW9uOjY3NTg0LGZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb246OTMxODQsZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uOjY3NTg0LGdhbWVib3lDb2xvclBhbGV0dGVTaXplOjUxMixiYWNrZ3JvdW5kTWFwTG9jYXRpb246MjMyNDQ4LHRpbGVEYXRhTWFwOjQyOTA1NiwKc291bmRPdXRwdXRMb2NhdGlvbjo1ODg4MDAsZ2FtZUJ5dGVzTG9jYXRpb246ODUwOTQ0LGdhbWVSYW1CYW5rc0xvY2F0aW9uOjcxOTg3Mn0pO2NvbnN0IFpiPWFzeW5jKCk9Pih7aW5zdGFuY2U6e2V4cG9ydHM6WWJ9LGJ5dGVNZW1vcnk6R2Eud2FzbUJ5dGVNZW1vcnksdHlwZToiVHlwZVNjcmlwdCJ9KTtsZXQgRmEsemIscTtxPXtncmFwaGljc1dvcmtlclBvcnQ6dm9pZCAwLG1lbW9yeVdvcmtlclBvcnQ6dm9pZCAwLGNvbnRyb2xsZXJXb3JrZXJQb3J0OnZvaWQgMCxhdWRpb1dvcmtlclBvcnQ6dm9pZCAwLHdhc21JbnN0YW5jZTp2b2lkIDAsd2FzbUJ5dGVNZW1vcnk6dm9pZCAwLG9wdGlvbnM6dm9pZCAwLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjowLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTowLApXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU6MCxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjowLHBhdXNlZDohMCx1cGRhdGVJZDp2b2lkIDAsdGltZVN0YW1wc1VudGlsUmVhZHk6MCxmcHNUaW1lU3RhbXBzOltdLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsYnJlYWtwb2ludDp2b2lkIDAsbWVzc2FnZUhhbmRsZXI6KGEpPT57Y29uc3QgYj14YShhKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgQy5DT05ORUNUOiJHUkFQSElDUyI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KHEuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx5YShDYi5iaW5kKHZvaWQgMCxxKSwKcS5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8ocS5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx5YShGYi5iaW5kKHZvaWQgMCxxKSxxLm1lbW9yeVdvcmtlclBvcnQpKToiQ09OVFJPTExFUiI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KHEuY29udHJvbGxlcldvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHlhKEViLmJpbmQodm9pZCAwLHEpLHEuY29udHJvbGxlcldvcmtlclBvcnQpKToiQVVESU8iPT09Yi5tZXNzYWdlLndvcmtlcklkJiYocS5hdWRpb1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHlhKERiLmJpbmQodm9pZCAwLHEpLHEuYXVkaW9Xb3JrZXJQb3J0KSk7YmEoTyh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEMuSU5TVEFOVElBVEVfV0FTTTooYXN5bmMoKT0+e2xldCBhO2E9YXdhaXQgWmIoKTtxLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO3Eud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5OwpiYShPKHt0eXBlOmEudHlwZX0sYi5tZXNzYWdlSWQpKX0pKCk7YnJlYWs7Y2FzZSBDLkNPTkZJRzpxLndhc21JbnN0YW5jZS5leHBvcnRzLmNvbmZpZy5hcHBseShxLGIubWVzc2FnZS5jb25maWcpO3Eub3B0aW9ucz1iLm1lc3NhZ2Uub3B0aW9ucztiYShPKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5SRVNFVF9BVURJT19RVUVVRTpxLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpO2JhKE8odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLlBMQVk6Y2FzZSBDLlBMQVlfVU5USUxfQlJFQUtQT0lOVDppZighcS5wYXVzZWR8fCFxLndhc21JbnN0YW5jZXx8IXEud2FzbUJ5dGVNZW1vcnkpe2JhKE8oe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfXEucGF1c2VkPSExO3EuZnBzVGltZVN0YW1wcz1bXTtxLmZyYW1lU2tpcENvdW50ZXI9MDtxLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtxLmJyZWFrcG9pbnQ9dm9pZCAwOwpiLm1lc3NhZ2UuYnJlYWtwb2ludCYmKHEuYnJlYWtwb2ludD1iLm1lc3NhZ2UuYnJlYWtwb2ludCk7QWIocSwxRTMvcS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpO3diKHEpO2JhKE8odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLlBBVVNFOnEucGF1c2VkPSEwO3EudXBkYXRlSWQmJihjbGVhclRpbWVvdXQocS51cGRhdGVJZCkscS51cGRhdGVJZD12b2lkIDApO2JhKE8odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP3Eud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpxLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7YmEoTyh7dHlwZTpDLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0KMDtsZXQgYz1xLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiLm1lc3NhZ2Uuc3RhcnQmJihhPWIubWVzc2FnZS5zdGFydCk7Yi5tZXNzYWdlLmVuZCYmKGM9Yi5tZXNzYWdlLmVuZCk7YT1xLndhc21CeXRlTWVtb3J5LnNsaWNlKGEsYykuYnVmZmVyO2JhKE8oe3R5cGU6Qy5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSBDLkdFVF9XQVNNX0NPTlNUQU5UOmJhKE8oe3R5cGU6Qy5HRVRfV0FTTV9DT05TVEFOVCxyZXNwb25zZTpxLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5GT1JDRV9PVVRQVVRfRlJBTUU6eGIocSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZygiVW5rbm93biBXYXNtQm95IFdvcmtlciBtZXNzYWdlOiIsYil9fSxnZXRGUFM6KCk9PjA8cS50aW1lU3RhbXBzVW50aWxSZWFkeT9xLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZToKcS5mcHNUaW1lU3RhbXBzP3EuZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07eWEocS5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

var wasmboyGraphicsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsZil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6ZixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGs7Y29uc3QgbT0oYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6ZyhjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOnthPW5ldyBVaW50OENsYW1wZWRBcnJheShhLm1lc3NhZ2UuZ3JhcGhpY3NGcmFtZUJ1ZmZlcik7Y29uc3QgZj1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTIxNjApLGQ9bmV3IFVpbnQ4Q2xhbXBlZEFycmF5KDMpO2ZvcihsZXQgYz0wOzE0ND5jO2MrKylmb3IobGV0IGU9MDsxNjA+ZTtlKyspe3ZhciBiPTMqKDE2MCpjK2UpO2ZvcihsZXQgYz0wOzM+YztjKyspZFtjXT1hW2IrY107Yj00KihlKzE2MCpjKTtmW2JdPWRbMF07ZltiKzFdPWRbMV07ZltiKzJdPWRbMl07ZltiKzNdPTI1NX1hPWZ9ZyhjKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bCgoYSk9PnthPWEuZGF0YT8KYS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjprPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sayk7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmsucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

var wasmboyAudioWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG0oYSxiKXtoP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpuLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gcChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGgpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoaClzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugbi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsZCl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksaysrLGI9YCR7Yn0tJHtrfWAsMUU1PGsmJihrPTApKTtyZXR1cm57d29ya2VySWQ6ZCxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGg9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgbjtofHwobj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgaz0wO2NvbnN0IHE9KGEpPT57YT0oYS0xKS8xMjctMTsuMDA4Pk1hdGguYWJzKGEpJiYoYT0wKTtyZXR1cm4gYS8yLjV9O2xldCBsO2NvbnN0IHI9KGEpPT57YT1hLmRhdGE/YS5kYXRhOmE7aWYoYS5tZXNzYWdlKXN3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjptKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiVVBEQVRFRCI6e3ZhciBiPW5ldyBVaW50OEFycmF5KGEubWVzc2FnZS5hdWRpb0J1ZmZlcik7dmFyIGQ9YS5tZXNzYWdlLm51bWJlck9mU2FtcGxlcztjb25zdCBjPW5ldyBGbG9hdDMyQXJyYXkoZCk7dmFyIGY9bmV3IEZsb2F0MzJBcnJheShkKTtsZXQgZz0wO2QqPTI7Zm9yKHZhciBlPTA7ZTxkO2UrPTIpY1tnXT1xKGJbZV0pLGcrKztnPTA7Zm9yKGU9MTtlPGQ7ZSs9MilmW2ddPXEoYltlXSksZysrO2I9Yy5idWZmZXI7Zj1mLmJ1ZmZlcn1tKGMoe3R5cGU6IlVQREFURUQiLGxlZnRDaGFubmVsOmIscmlnaHRDaGFubmVsOmYsCm51bWJlck9mU2FtcGxlczphLm1lc3NhZ2UubnVtYmVyT2ZTYW1wbGVzLGZwczphLm1lc3NhZ2UuZnBzLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzphLm1lc3NhZ2UuYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nfSksW2IsZl0pfX07cCgoYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNPTk5FQ1QiOmw9YS5tZXNzYWdlLnBvcnRzWzBdO3AocixsKTttKGModm9pZCAwLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX0NPTlNUQU5UUyI6bC5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkFVRElPX0xBVEVOQ1kiOmwucG9zdE1lc3NhZ2UoYyhhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGEpfX0pfSkoKTsK";

var wasmboyControllerWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihjKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKGMpc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIGUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLGQrKyxiPWAke2J9LSR7ZH1gLDFFNTxkJiYoZD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1jb25zdCBjPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY7bGV0IGU7Y3x8KGU9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtsZXQgZD0wLGY7Y29uc3Qgaz0oYSk9Pnt9O2coKGEpPT57YT1hLmRhdGE/YS5kYXRhOgphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6Zj1hLm1lc3NhZ2UucG9ydHNbMF07ZyhrLGYpO2E9aCh2b2lkIDAsYS5tZXNzYWdlSWQpO2M/c2VsZi5wb3N0TWVzc2FnZShhLHZvaWQgMCk6ZS5wb3N0TWVzc2FnZShhLHZvaWQgMCk7YnJlYWs7Y2FzZSAiU0VUX0pPWVBBRF9TVEFURSI6Zi5wb3N0TWVzc2FnZShoKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYSl9fSl9KSgpOwo=";

var wasmboyMemoryWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGY7Y29uc3Qgaz0oYSxiKT0+e2NvbnN0IGQ9W107T2JqZWN0LmtleXMoYi5tZXNzYWdlKS5mb3JFYWNoKChhKT0+eyJ0eXBlIiE9PWEmJmQucHVzaChiLm1lc3NhZ2VbYV0pfSk7Y29uc3QgZT1jKGIubWVzc2FnZSxiLm1lc3NhZ2VJZCk7YT9mLnBvc3RNZXNzYWdlKGUsZCk6ZyhlLGQpfSxtPShhKT0+e2E9YS5kYXRhP2EuZGF0YTphO2lmKGEubWVzc2FnZSlzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNMRUFSX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSxbYS5tZXNzYWdlLndhc21CeXRlTWVtb3J5XSk7YnJlYWs7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiU0VUX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6ayghMSxhKTticmVhaztjYXNlICJVUERBVEVEIjprKCExLGEpfX07bCgoYSk9PnthPQphLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpmPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sZik7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkNMRUFSX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKHt0eXBlOiJDTEVBUl9NRU1PUlkifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmYucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlNFVF9NRU1PUlkiOmsoITAsYSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

// Smarter workers.
// Workers with ids, pub sub, etc...
// https://medium.com/dailyjs/threads-in-node-10-5-0-a-practical-intro-3b85a0a3c953
const {
  Worker
} = require('worker_threads');

let idCounter = 0;

const generateId = () => {
  const randomId = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(2, 10);
  idCounter++;
  const id = `${randomId}-${idCounter}`;

  if (idCounter > 100000) {
    idCounter = 0;
  }

  return id;
};

function getSmartWorkerMessage(message, messageId, workerId) {
  if (!messageId) {
    messageId = generateId();
  }

  return {
    workerId,
    messageId,
    message
  };
}
class SmartWorker {
  constructor(workerUrl, id) {
    this.id = generateId();

    if (id) {
      this.id = id;
    }

    this.messageListeners = [];
    /*ROLLUP_REPLACE_PROD_BROWSER
    
    // Can't load base63 data string directly because safari
    // https://stackoverflow.com/questions/10343913/how-to-create-a-web-worker-from-a-string
     let workerJs = atob(workerUrl.split(',')[1]);
    let blob;
    try {
      blob = new Blob([workerJs], {type: 'application/javascript'});
    } catch (e) {
      // Legacy
      window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
      blob = new BlobBuilder();
      blob.append(workerJs);
      blob = blob.getBlob();
    }
    this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = this._onMessageHandler.bind(this);
    
    ROLLUP_REPLACE_PROD_BROWSER*/

    /*ROLLUP_REPLACE_DEV_BROWSER
     this.worker = new Worker(workerUrl);
    this.worker.onmessage = this._onMessageHandler.bind(this);
     ROLLUP_REPLACE_DEV_BROWSER*/
    // Split by Comma, to remove the file header from the base 64 string

    const workerAsString = readBase64String(workerUrl);
    this.worker = new Worker(workerAsString, {
      eval: true
    });
    this.worker.on('message', this._onMessageHandler.bind(this));
  }

  postMessage(message, transfer) {
    const messageObject = getSmartWorkerMessage(message, undefined, this.id);
    const messageId = messageObject.messageId;
    const messageIdListener = new Promise(resolve => {
      // Listen for a message with the same message id to be returned
      this.addMessageListener((responseMessage, messageListener) => {
        const eventData = getEventData(responseMessage);

        if (eventData.messageId === messageId) {
          this.removeMessageListener(messageListener.id);
          resolve(eventData);
        }
      });
    });
    this.worker.postMessage(messageObject, transfer);
    return messageIdListener;
  }

  addMessageListener(callback) {
    this.messageListeners.push({
      id: generateId(),
      callback: callback
    });
  }

  removeMessageListener(id) {
    let messageListenerIndex;
    this.messageListeners.some((messageListener, index) => {
      if (messageListener.id === id) {
        messageListenerIndex = index;
        return true;
      }

      return false;
    });

    if (messageListenerIndex !== undefined) {
      this.messageListeners.splice(messageListenerIndex, 1);
    }
  }

  _onMessageHandler(message) {
    this.messageListeners.forEach(messageListener => {
      messageListener.callback(message, messageListener);
    });
  }

}

// WasmBoy Modules

const {
  MessageChannel
} = require('worker_threads');

const instantiateWorkers = async () => {
  // Create our workers
  let libWorkerUrl;
  libWorkerUrl = wasmboyLibTsWorkerUrl;
  const libWorker = new SmartWorker(libWorkerUrl, WORKER_ID.LIB);
  const graphicsWorker = new SmartWorker(wasmboyGraphicsWorkerUrl, WORKER_ID.GRAPHICS);
  const audioWorker = new SmartWorker(wasmboyAudioWorkerUrl, WORKER_ID.AUDIO);
  const controllerWorker = new SmartWorker(wasmboyControllerWorkerUrl, WORKER_ID.CONTROLLER);
  const memoryWorker = new SmartWorker(wasmboyMemoryWorkerUrl, WORKER_ID.MEMORY); // Create an array of promises for when each worker is ready

  const workerReadyPromises = []; // Add our workers to an array,

  const childWorkers = [graphicsWorker, audioWorker, controllerWorker, memoryWorker]; // Create a messaging channel between our main lib worker,
  // And all of the children workers

  childWorkers.forEach(childWorker => {
    // Create our message channel
    // https://stackoverflow.com/questions/14191394/web-workers-communication-using-messagechannel-html5
    const messageChannel = new MessageChannel();
    const workerReadyPromise = new Promise(resolve => {
      // Our resolve function
      let messagesReceived = 0;

      const tryResolveWorkerReady = () => {
        messagesReceived++;

        if (messagesReceived >= 2) {
          resolve();
        }
      }; // Post our connect messages


      libWorker.postMessage({
        type: WORKER_MESSAGE_TYPE.CONNECT,
        workerId: childWorker.id,
        ports: [messageChannel.port1]
      }, [messageChannel.port1]).then(() => {
        tryResolveWorkerReady();
      });
      childWorker.postMessage({
        type: WORKER_MESSAGE_TYPE.CONNECT,
        workerId: libWorker.id,
        ports: [messageChannel.port2]
      }, [messageChannel.port2]).then(() => {
        tryResolveWorkerReady();
      });
    });
    workerReadyPromises.push(workerReadyPromise);
  }); // Wait for all workers to be ready

  await Promise.all(workerReadyPromises); // Finally, pass the ready workers to all of our children lib

  WasmBoyGraphics.setWorker(graphicsWorker);
  WasmBoyAudio.setWorker(audioWorker);
  WasmBoyController.setWorker(controllerWorker);
  WasmBoyMemory.setWorker(memoryWorker); // Return the main worker for the main lib

  return libWorker;
};

// Taken/Modified From: https://github.com/photopea/UZIP.js
let UZIP = {}; // Make it a hacky es module

const uzip = UZIP;

UZIP['parse'] = function (buf // ArrayBuffer
) {
  let rUs = UZIP.bin.readUshort,
      rUi = UZIP.bin.readUint,
      o = 0,
      out = {};
  let data = new Uint8Array(buf);
  let eocd = data.length - 4;

  while (rUi(data, eocd) != 0x06054b50) eocd--;

  o = eocd;
  o += 4; // sign  = 0x06054b50

  o += 4; // disks = 0;

  let cnu = rUs(data, o);
  o += 2;
  let cnt = rUs(data, o);
  o += 2;
  let csize = rUi(data, o);
  o += 4;
  let coffs = rUi(data, o);
  o += 4;
  o = coffs;

  for (let i = 0; i < cnu; i++) {
    let sign = rUi(data, o);
    o += 4;
    o += 4; // versions;

    o += 4; // flag + compr

    o += 4; // time

    let crc32 = rUi(data, o);
    o += 4;
    let csize = rUi(data, o);
    o += 4;
    let usize = rUi(data, o);
    o += 4;
    let nl = rUs(data, o),
        el = rUs(data, o + 2),
        cl = rUs(data, o + 4);
    o += 6; // name, extra, comment

    o += 8; // disk, attribs

    let roff = rUi(data, o);
    o += 4;
    o += nl + el + cl;

    UZIP._readLocal(data, roff, out, csize, usize);
  } //console.log(out);


  return out;
};

UZIP._readLocal = function (data, o, out, csize, usize) {
  let rUs = UZIP.bin.readUshort,
      rUi = UZIP.bin.readUint;
  let sign = rUi(data, o);
  o += 4;
  let ver = rUs(data, o);
  o += 2;
  let gpflg = rUs(data, o);
  o += 2; //if((gpflg&8)!=0) throw "unknown sizes";

  let cmpr = rUs(data, o);
  o += 2;
  let time = rUi(data, o);
  o += 4;
  let crc32 = rUi(data, o);
  o += 4; //let csize = rUi(data, o);  o+=4;
  //let usize = rUi(data, o);  o+=4;

  o += 8;
  let nlen = rUs(data, o);
  o += 2;
  let elen = rUs(data, o);
  o += 2;
  let name = UZIP.bin.readUTF8(data, o, nlen);
  o += nlen;
  o += elen; //console.log(sign.toString(16), ver, gpflg, cmpr, crc32.toString(16), "csize, usize", csize, usize, nlen, elen, name, o);

  let file = new Uint8Array(data.buffer, o);

  if (cmpr == 0) out[name] = new Uint8Array(file.buffer.slice(o, o + csize));else if (cmpr == 8) {
    let buf = new Uint8Array(usize);
    UZIP.inflateRaw(file, buf); //let nbuf = pako["inflateRaw"](file);
    //for(let i=0; i<buf.length; i++) if(buf[i]!=nbuf[i]) {  console.log(buf.length, nbuf.length, usize, i);  throw "e";  }

    out[name] = buf;
  } else throw 'unknown compression method: ' + cmpr;
};

UZIP.inflateRaw = function (file, buf) {
  return UZIP.F.inflate(file, buf);
};

UZIP.inflate = function (file, buf) {
  let CMF = file[0],
      FLG = file[1];

  return UZIP.inflateRaw(new Uint8Array(file.buffer, file.byteOffset + 2, file.length - 6), buf);
};

UZIP.deflate = function (data, opts
/*, buf, off*/
) {
  if (opts == null) opts = {
    level: 6
  };
  let off = 0,
      buf = new Uint8Array(50 + Math.floor(data.length * 1.1));
  buf[off] = 120;
  buf[off + 1] = 156;
  off += 2;
  off = UZIP.F.deflateRaw(data, buf, off, opts.level);
  let crc = UZIP.adler(data, 0, data.length);
  buf[off + 0] = crc >>> 24 & 255;
  buf[off + 1] = crc >>> 16 & 255;
  buf[off + 2] = crc >>> 8 & 255;
  buf[off + 3] = crc >>> 0 & 255;
  return new Uint8Array(buf.buffer, 0, off + 4);
};

UZIP.deflateRaw = function (data, opts) {
  if (opts == null) opts = {
    level: 6
  };
  let buf = new Uint8Array(50 + Math.floor(data.length * 1.1));
  let off;
  off = UZIP.F.deflateRaw(data, buf, off, opts.level);
  return new Uint8Array(buf.buffer, 0, off);
};

UZIP.encode = function (obj) {
  let tot = 0,
      wUi = UZIP.bin.writeUint,
      wUs = UZIP.bin.writeUshort;
  let zpd = {};

  for (let p in obj) {
    let cpr = !UZIP._noNeed(p),
        buf = obj[p],
        crc = UZIP.crc.crc(buf, 0, buf.length);
    zpd[p] = {
      cpr: cpr,
      usize: buf.length,
      crc: crc,
      file: cpr ? UZIP.deflateRaw(buf) : buf
    };
  }

  for (let p in zpd) tot += zpd[p].file.length + 30 + 46 + 2 * UZIP.bin.sizeUTF8(p);

  tot += 22;
  let data = new Uint8Array(tot),
      o = 0;
  let fof = [];

  for (let p in zpd) {
    let file = zpd[p];
    fof.push(o);
    o = UZIP._writeHeader(data, o, p, file, 0);
  }

  let i = 0,
      ioff = o;

  for (let p in zpd) {
    let file = zpd[p];
    fof.push(o);
    o = UZIP._writeHeader(data, o, p, file, 1, fof[i++]);
  }

  let csize = o - ioff;
  wUi(data, o, 0x06054b50);
  o += 4;
  o += 4; // disks

  wUs(data, o, i);
  o += 2;
  wUs(data, o, i);
  o += 2; // number of c d records

  wUi(data, o, csize);
  o += 4;
  wUi(data, o, ioff);
  o += 4;
  o += 2;
  return data.buffer;
}; // no need to compress .PNG, .ZIP, .JPEG ....


UZIP._noNeed = function (fn) {
  let ext = fn.split('.').pop().toLowerCase();
  return 'png,jpg,jpeg,zip'.indexOf(ext) != -1;
};

UZIP._writeHeader = function (data, o, p, obj, t, roff) {
  let wUi = UZIP.bin.writeUint,
      wUs = UZIP.bin.writeUshort;
  let file = obj.file;
  wUi(data, o, t == 0 ? 0x04034b50 : 0x02014b50);
  o += 4; // sign

  if (t == 1) o += 2; // ver made by

  wUs(data, o, 20);
  o += 2; // ver

  wUs(data, o, 0);
  o += 2; // gflip

  wUs(data, o, obj.cpr ? 8 : 0);
  o += 2; // cmpr

  wUi(data, o, 0);
  o += 4; // time

  wUi(data, o, obj.crc);
  o += 4; // crc32

  wUi(data, o, file.length);
  o += 4; // csize

  wUi(data, o, obj.usize);
  o += 4; // usize

  wUs(data, o, UZIP.bin.sizeUTF8(p));
  o += 2; // nlen

  wUs(data, o, 0);
  o += 2; // elen

  if (t == 1) {
    o += 2; // comment length

    o += 2; // disk number

    o += 6; // attributes

    wUi(data, o, roff);
    o += 4; // usize
  }

  let nlen = UZIP.bin.writeUTF8(data, o, p);
  o += nlen;

  if (t == 0) {
    data.set(file, o);
    o += file.length;
  }

  return o;
};

UZIP.crc = {
  table: function () {
    let tab = new Uint32Array(256);

    for (let n = 0; n < 256; n++) {
      let c = n;

      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ c >>> 1;else c = c >>> 1;
      }

      tab[n] = c;
    }

    return tab;
  }(),
  update: function (c, buf, off, len) {
    for (let i = 0; i < len; i++) c = UZIP.crc.table[(c ^ buf[off + i]) & 0xff] ^ c >>> 8;

    return c;
  },
  crc: function (b, o, l) {
    return UZIP.crc.update(0xffffffff, b, o, l) ^ 0xffffffff;
  }
};

UZIP.adler = function (data, o, len) {
  let a = 1,
      b = 0;
  let off = o,
      end = o + len;

  while (off < end) {
    let eend = Math.min(off + 5552, end);

    while (off < eend) {
      a += data[off++];
      b += a;
    }

    a = a % 65521;
    b = b % 65521;
  }

  return b << 16 | a;
};

UZIP.bin = {
  readUshort: function (buff, p) {
    return buff[p] | buff[p + 1] << 8;
  },
  writeUshort: function (buff, p, n) {
    buff[p] = n & 255;
    buff[p + 1] = n >> 8 & 255;
  },
  readUint: function (buff, p) {
    return buff[p + 3] * (256 * 256 * 256) + (buff[p + 2] << 16 | buff[p + 1] << 8 | buff[p]);
  },
  writeUint: function (buff, p, n) {
    buff[p] = n & 255;
    buff[p + 1] = n >> 8 & 255;
    buff[p + 2] = n >> 16 & 255;
    buff[p + 3] = n >> 24 & 255;
  },
  readASCII: function (buff, p, l) {
    let s = '';

    for (let i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]);

    return s;
  },
  writeASCII: function (data, p, s) {
    for (let i = 0; i < s.length; i++) data[p + i] = s.charCodeAt(i);
  },
  pad: function (n) {
    return n.length < 2 ? '0' + n : n;
  },
  readUTF8: function (buff, p, l) {
    let s = '',
        ns;

    for (let i = 0; i < l; i++) s += '%' + UZIP.bin.pad(buff[p + i].toString(16));

    try {
      ns = decodeURIComponent(s);
    } catch (e) {
      return UZIP.bin.readASCII(buff, p, l);
    }

    return ns;
  },
  writeUTF8: function (buff, p, str) {
    let strl = str.length,
        i = 0;

    for (let ci = 0; ci < strl; ci++) {
      let code = str.charCodeAt(ci);

      if ((code & 0xffffffff - (1 << 7) + 1) == 0) {
        buff[p + i] = code;
        i++;
      } else if ((code & 0xffffffff - (1 << 11) + 1) == 0) {
        buff[p + i] = 192 | code >> 6;
        buff[p + i + 1] = 128 | code >> 0 & 63;
        i += 2;
      } else if ((code & 0xffffffff - (1 << 16) + 1) == 0) {
        buff[p + i] = 224 | code >> 12;
        buff[p + i + 1] = 128 | code >> 6 & 63;
        buff[p + i + 2] = 128 | code >> 0 & 63;
        i += 3;
      } else if ((code & 0xffffffff - (1 << 21) + 1) == 0) {
        buff[p + i] = 240 | code >> 18;
        buff[p + i + 1] = 128 | code >> 12 & 63;
        buff[p + i + 2] = 128 | code >> 6 & 63;
        buff[p + i + 3] = 128 | code >> 0 & 63;
        i += 4;
      } else throw 'e';
    }

    return i;
  },
  sizeUTF8: function (str) {
    let strl = str.length,
        i = 0;

    for (let ci = 0; ci < strl; ci++) {
      let code = str.charCodeAt(ci);

      if ((code & 0xffffffff - (1 << 7) + 1) == 0) {
        i++;
      } else if ((code & 0xffffffff - (1 << 11) + 1) == 0) {
        i += 2;
      } else if ((code & 0xffffffff - (1 << 16) + 1) == 0) {
        i += 3;
      } else if ((code & 0xffffffff - (1 << 21) + 1) == 0) {
        i += 4;
      } else throw 'e';
    }

    return i;
  }
};
UZIP.F = {};

UZIP.F.deflateRaw = function (data, out, opos, lvl) {
  let opts = [
  /*
  ush good_length; /* reduce lazy search above this match length 
  ush max_lazy;    /* do not perform lazy search above this match length 
       ush nice_length; /* quit search above this match length 
  */

  /*      good lazy nice chain */

  /* 0 */
  [0, 0, 0, 0, 0]
  /* store only */
  ,
  /* 1 */
  [4, 4, 8, 4, 0]
  /* max speed, no lazy matches */
  ,
  /* 2 */
  [4, 5, 16, 8, 0],
  /* 3 */
  [4, 6, 16, 16, 0],
  /* 4 */
  [4, 10, 16, 32, 0]
  /* lazy matches */
  ,
  /* 5 */
  [8, 16, 32, 32, 0],
  /* 6 */
  [8, 16, 128, 128, 0],
  /* 7 */
  [8, 32, 128, 256, 0],
  /* 8 */
  [32, 128, 258, 1024, 1],
  /* 9 */
  [32, 258, 258, 4096, 1]];
  /* max compression */

  let opt = opts[lvl];
  let U = UZIP.F.U,
      goodIndex = UZIP.F._goodIndex,
      hash = UZIP.F._hash,
      putsE = UZIP.F._putsE;
  let i = 0,
      pos = opos << 3,
      cvrd = 0,
      dlen = data.length;

  if (lvl == 0) {
    while (i < dlen) {
      let len = Math.min(0xffff, dlen - i);
      putsE(out, pos, i + len == dlen ? 1 : 0);
      pos = UZIP.F._copyExact(data, i, len, out, pos + 8);
      i += len;
    }

    return pos >>> 3;
  }

  let lits = U.lits,
      strt = U.strt,
      prev = U.prev,
      li = 0,
      lc = 0,
      bs = 0,
      ebits = 0,
      c = 0,
      nc = 0; // last_item, literal_count, block_start

  if (dlen > 2) {
    nc = UZIP.F._hash(data, 0);
    strt[nc] = 0;
  }

  for (i = 0; i < dlen; i++) {
    c = nc; //*

    if (i + 1 < dlen - 2) {
      nc = UZIP.F._hash(data, i + 1);
      let ii = i + 1 & 0x7fff;
      prev[ii] = strt[nc];
      strt[nc] = ii;
    } //*/


    if (cvrd <= i) {
      if (li > 14000 || lc > 26697) {
        if (cvrd < i) {
          lits[li] = i - cvrd;
          li += 2;
          cvrd = i;
        }

        pos = UZIP.F._writeBlock(i == dlen - 1 || cvrd == dlen ? 1 : 0, lits, li, ebits, data, bs, i - bs, out, pos);
        li = lc = ebits = 0;
        bs = i;
      }

      let mch = 0; //if(nmci==i) mch= nmch;  else

      if (i < dlen - 2) mch = UZIP.F._bestMatch(data, i, prev, c, Math.min(opt[2], dlen - i), opt[3]);

      if (mch != 0) {
        let len = mch >>> 16,
            dst = mch & 0xffff; //if(i-dst<0) throw "e";

        let lgi = goodIndex(len, U.of0);
        U.lhst[257 + lgi]++;
        let dgi = goodIndex(dst, U.df0);
        U.dhst[dgi]++;
        ebits += U.exb[lgi] + U.dxb[dgi];
        lits[li] = len << 23 | i - cvrd;
        lits[li + 1] = dst << 16 | lgi << 8 | dgi;
        li += 2;
        cvrd = i + len;
      } else {
        U.lhst[data[i]]++;
      }

      lc++;
    }
  }

  if (bs != i || data.length == 0) {
    if (cvrd < i) {
      lits[li] = i - cvrd;
      li += 2;
      cvrd = i;
    }

    pos = UZIP.F._writeBlock(1, lits, li, ebits, data, bs, i - bs, out, pos);
    li = 0;
    lc = 0;
    li = lc = ebits = 0;
    bs = i;
  }

  while ((pos & 7) != 0) pos++;

  return pos >>> 3;
};

UZIP.F._bestMatch = function (data, i, prev, c, nice, chain) {
  let ci = i & 0x7fff,
      pi = prev[ci]; //console.log("----", i);

  let dif = ci - pi + (1 << 15) & 0x7fff;
  if (pi == ci || c != UZIP.F._hash(data, i - dif)) return 0;
  let tl = 0,
      td = 0; // top length, top distance

  let dlim = Math.min(0x7fff, i);

  while (dif <= dlim && --chain != 0 && pi != ci
  /*&& c==UZIP.F._hash(data,i-dif)*/
  ) {
    if (tl == 0 || data[i + tl] == data[i + tl - dif]) {
      let cl = UZIP.F._howLong(data, i, dif);

      if (cl > tl) {
        tl = cl;
        td = dif;
        if (tl >= nice) break; //*

        if (dif + 2 < cl) cl = dif + 2;
        let maxd = 0; // pi does not point to the start of the word

        for (let j = 0; j < cl - 2; j++) {
          let ei = i - dif + j + (1 << 15) & 0x7fff;
          let li = prev[ei];
          let curd = ei - li + (1 << 15) & 0x7fff;

          if (curd > maxd) {
            maxd = curd;
            pi = ei;
          }
        } //*/

      }
    }

    ci = pi;
    pi = prev[ci];
    dif += ci - pi + (1 << 15) & 0x7fff;
  }

  return tl << 16 | td;
};

UZIP.F._howLong = function (data, i, dif) {
  if (data[i] != data[i - dif] || data[i + 1] != data[i + 1 - dif] || data[i + 2] != data[i + 2 - dif]) return 0;
  let oi = i,
      l = Math.min(data.length, i + 258);
  i += 3; //while(i+4<l && data[i]==data[i-dif] && data[i+1]==data[i+1-dif] && data[i+2]==data[i+2-dif] && data[i+3]==data[i+3-dif]) i+=4;

  while (i < l && data[i] == data[i - dif]) i++;

  return i - oi;
};

UZIP.F._hash = function (data, i) {
  return (data[i] << 8 | data[i + 1]) + (data[i + 2] << 4) & 0xffff; //let hash_shift = 0, hash_mask = 255;
  //let h = data[i+1] % 251;
  //h = (((h << 8) + data[i+2]) % 251);
  //h = (((h << 8) + data[i+2]) % 251);
  //h = ((h<<hash_shift) ^ (c) ) & hash_mask;
  //return h | (data[i]<<8);
  //return (data[i] | (data[i+1]<<8));
}; //UZIP.___toth = 0;


UZIP.saved = 0;

UZIP.F._writeBlock = function (BFINAL, lits, li, ebits, data, o0, l0, out, pos) {
  let U = UZIP.F.U,
      putsF = UZIP.F._putsF,
      putsE = UZIP.F._putsE; //*

  let T, ML, MD, MH, numl, numd, numh, lset, dset;
  U.lhst[256]++;
  T = UZIP.F.getTrees();
  ML = T[0];
  MD = T[1];
  MH = T[2];
  numl = T[3];
  numd = T[4];
  numh = T[5];
  lset = T[6];
  dset = T[7];
  let cstSize = ((pos + 3 & 7) == 0 ? 0 : 8 - (pos + 3 & 7)) + 32 + (l0 << 3);
  let fxdSize = ebits + UZIP.F.contSize(U.fltree, U.lhst) + UZIP.F.contSize(U.fdtree, U.dhst);
  let dynSize = ebits + UZIP.F.contSize(U.ltree, U.lhst) + UZIP.F.contSize(U.dtree, U.dhst);
  dynSize += 14 + 3 * numh + UZIP.F.contSize(U.itree, U.ihst) + (U.ihst[16] * 2 + U.ihst[17] * 3 + U.ihst[18] * 7);

  for (let j = 0; j < 286; j++) U.lhst[j] = 0;

  for (let j = 0; j < 30; j++) U.dhst[j] = 0;

  for (let j = 0; j < 19; j++) U.ihst[j] = 0; //*/


  let BTYPE = cstSize < fxdSize && cstSize < dynSize ? 0 : fxdSize < dynSize ? 1 : 2;
  putsF(out, pos, BFINAL);
  putsF(out, pos + 1, BTYPE);
  pos += 3;

  if (BTYPE == 0) {
    while ((pos & 7) != 0) pos++;

    pos = UZIP.F._copyExact(data, o0, l0, out, pos);
  } else {
    let ltree, dtree;

    if (BTYPE == 1) {
      ltree = U.fltree;
      dtree = U.fdtree;
    }

    if (BTYPE == 2) {
      UZIP.F.makeCodes(U.ltree, ML);
      UZIP.F.revCodes(U.ltree, ML);
      UZIP.F.makeCodes(U.dtree, MD);
      UZIP.F.revCodes(U.dtree, MD);
      UZIP.F.makeCodes(U.itree, MH);
      UZIP.F.revCodes(U.itree, MH);
      ltree = U.ltree;
      dtree = U.dtree;
      putsE(out, pos, numl - 257);
      pos += 5; // 286

      putsE(out, pos, numd - 1);
      pos += 5; // 30

      putsE(out, pos, numh - 4);
      pos += 4; // 19

      for (let i = 0; i < numh; i++) putsE(out, pos + i * 3, U.itree[(U.ordr[i] << 1) + 1]);

      pos += 3 * numh;
      pos = UZIP.F._codeTiny(lset, U.itree, out, pos);
      pos = UZIP.F._codeTiny(dset, U.itree, out, pos);
    }

    let off = o0;

    for (let si = 0; si < li; si += 2) {
      let qb = lits[si],
          len = qb >>> 23,
          end = off + (qb & (1 << 23) - 1);

      while (off < end) pos = UZIP.F._writeLit(data[off++], ltree, out, pos);

      if (len != 0) {
        let qc = lits[si + 1],
            dst = qc >> 16,
            lgi = qc >> 8 & 255,
            dgi = qc & 255;
        pos = UZIP.F._writeLit(257 + lgi, ltree, out, pos);
        putsE(out, pos, len - U.of0[lgi]);
        pos += U.exb[lgi];
        pos = UZIP.F._writeLit(dgi, dtree, out, pos);
        putsF(out, pos, dst - U.df0[dgi]);
        pos += U.dxb[dgi];
        off += len;
      }
    }

    pos = UZIP.F._writeLit(256, ltree, out, pos);
  } //console.log(pos-opos, fxdSize, dynSize, cstSize);


  return pos;
};

UZIP.F._copyExact = function (data, off, len, out, pos) {
  let p8 = pos >>> 3;
  out[p8] = len;
  out[p8 + 1] = len >>> 8;
  out[p8 + 2] = 255 - out[p8];
  out[p8 + 3] = 255 - out[p8 + 1];
  p8 += 4;
  out.set(new Uint8Array(data.buffer, off, len), p8); //for(let i=0; i<len; i++) out[p8+i]=data[off+i];

  return pos + (len + 4 << 3);
};
/*
	Interesting facts:
	- decompressed block can have bytes, which do not occur in a Huffman tree (copied from the previous block by reference)
*/


UZIP.F.getTrees = function () {
  let U = UZIP.F.U;

  let ML = UZIP.F._hufTree(U.lhst, U.ltree, 15);

  let MD = UZIP.F._hufTree(U.dhst, U.dtree, 15);

  let lset = [],
      numl = UZIP.F._lenCodes(U.ltree, lset);

  let dset = [],
      numd = UZIP.F._lenCodes(U.dtree, dset);

  for (let i = 0; i < lset.length; i += 2) U.ihst[lset[i]]++;

  for (let i = 0; i < dset.length; i += 2) U.ihst[dset[i]]++;

  let MH = UZIP.F._hufTree(U.ihst, U.itree, 7);

  let numh = 19;

  while (numh > 4 && U.itree[(U.ordr[numh - 1] << 1) + 1] == 0) numh--;

  return [ML, MD, MH, numl, numd, numh, lset, dset];
};

UZIP.F.getSecond = function (a) {
  let b = [];

  for (let i = 0; i < a.length; i += 2) b.push(a[i + 1]);

  return b;
};

UZIP.F.nonZero = function (a) {
  let b = '';

  for (let i = 0; i < a.length; i += 2) if (a[i + 1] != 0) b += (i >> 1) + ',';

  return b;
};

UZIP.F.contSize = function (tree, hst) {
  let s = 0;

  for (let i = 0; i < hst.length; i++) s += hst[i] * tree[(i << 1) + 1];

  return s;
};

UZIP.F._codeTiny = function (set, tree, out, pos) {
  for (let i = 0; i < set.length; i += 2) {
    let l = set[i],
        rst = set[i + 1]; //console.log(l, pos, tree[(l<<1)+1]);

    pos = UZIP.F._writeLit(l, tree, out, pos);
    let rsl = l == 16 ? 2 : l == 17 ? 3 : 7;

    if (l > 15) {
      UZIP.F._putsE(out, pos, rst, rsl);

      pos += rsl;
    }
  }

  return pos;
};

UZIP.F._lenCodes = function (tree, set) {
  let len = tree.length;

  while (len != 2 && tree[len - 1] == 0) len -= 2; // when no distances, keep one code with length 0


  for (let i = 0; i < len; i += 2) {
    let l = tree[i + 1],
        nxt = i + 3 < len ? tree[i + 3] : -1,
        nnxt = i + 5 < len ? tree[i + 5] : -1,
        prv = i == 0 ? -1 : tree[i - 1];

    if (l == 0 && nxt == l && nnxt == l) {
      let lz = i + 5;

      while (lz + 2 < len && tree[lz + 2] == l) lz += 2;

      let zc = Math.min(lz + 1 - i >>> 1, 138);
      if (zc < 11) set.push(17, zc - 3);else set.push(18, zc - 11);
      i += zc * 2 - 2;
    } else if (l == prv && nxt == l && nnxt == l) {
      let lz = i + 5;

      while (lz + 2 < len && tree[lz + 2] == l) lz += 2;

      let zc = Math.min(lz + 1 - i >>> 1, 6);
      set.push(16, zc - 3);
      i += zc * 2 - 2;
    } else set.push(l, 0);
  }

  return len >>> 1;
};

UZIP.F._hufTree = function (hst, tree, MAXL) {
  let list = [],
      hl = hst.length,
      tl = tree.length,
      i = 0;

  for (i = 0; i < tl; i += 2) {
    tree[i] = 0;
    tree[i + 1] = 0;
  }

  for (i = 0; i < hl; i++) if (hst[i] != 0) list.push({
    lit: i,
    f: hst[i]
  });

  let end = list.length,
      l2 = list.slice(0);
  if (end == 0) return 0; // empty histogram (usually for dist)

  if (end == 1) {
    let lit = list[0].lit,
        l2 = lit == 0 ? 1 : 0;
    tree[(lit << 1) + 1] = 1;
    tree[(l2 << 1) + 1] = 1;
    return 1;
  }

  list.sort(function (a, b) {
    return a.f - b.f;
  });
  let a = list[0],
      b = list[1],
      i0 = 0,
      i1 = 1,
      i2 = 2;
  list[0] = {
    lit: -1,
    f: a.f + b.f,
    l: a,
    r: b,
    d: 0
  };

  while (i1 != end - 1) {
    if (i0 != i1 && (i2 == end || list[i0].f < list[i2].f)) {
      a = list[i0++];
    } else {
      a = list[i2++];
    }

    if (i0 != i1 && (i2 == end || list[i0].f < list[i2].f)) {
      b = list[i0++];
    } else {
      b = list[i2++];
    }

    list[i1++] = {
      lit: -1,
      f: a.f + b.f,
      l: a,
      r: b
    };
  }

  let maxl = UZIP.F.setDepth(list[i1 - 1], 0);

  if (maxl > MAXL) {
    UZIP.F.restrictDepth(l2, MAXL, maxl);
    maxl = MAXL;
  }

  for (i = 0; i < end; i++) tree[(l2[i].lit << 1) + 1] = l2[i].d;

  return maxl;
};

UZIP.F.setDepth = function (t, d) {
  if (t.lit != -1) {
    t.d = d;
    return d;
  }

  return Math.max(UZIP.F.setDepth(t.l, d + 1), UZIP.F.setDepth(t.r, d + 1));
};

UZIP.F.restrictDepth = function (dps, MD, maxl) {
  let i = 0,
      bCost = 1 << maxl - MD,
      dbt = 0;
  dps.sort(function (a, b) {
    return b.d == a.d ? a.f - b.f : b.d - a.d;
  });

  for (i = 0; i < dps.length; i++) if (dps[i].d > MD) {
    let od = dps[i].d;
    dps[i].d = MD;
    dbt += bCost - (1 << maxl - od);
  } else break;

  dbt = dbt >>> maxl - MD;

  while (dbt > 0) {
    let od = dps[i].d;

    if (od < MD) {
      dps[i].d++;
      dbt -= 1 << MD - od - 1;
    } else i++;
  }

  for (; i >= 0; i--) if (dps[i].d == MD && dbt < 0) {
    dps[i].d--;
    dbt++;
  }

  if (dbt != 0) console.log('debt left');
};

UZIP.F._goodIndex = function (v, arr) {
  let i = 0;
  if (arr[i | 16] <= v) i |= 16;
  if (arr[i | 8] <= v) i |= 8;
  if (arr[i | 4] <= v) i |= 4;
  if (arr[i | 2] <= v) i |= 2;
  if (arr[i | 1] <= v) i |= 1;
  return i;
};

UZIP.F._writeLit = function (ch, ltree, out, pos) {
  UZIP.F._putsF(out, pos, ltree[ch << 1]);

  return pos + ltree[(ch << 1) + 1];
};

UZIP.F.inflate = function (data, buf) {
  if (data[0] == 3 && data[1] == 0) return buf ? buf : new Uint8Array(0);
  let F = UZIP.F,
      bitsF = F._bitsF,
      bitsE = F._bitsE,
      decodeTiny = F._decodeTiny,
      makeCodes = F.makeCodes,
      codes2map = F.codes2map,
      get17 = F._get17;
  let U = F.U;
  let noBuf = buf == null;
  if (noBuf) buf = new Uint8Array(data.length >> 2 << 3);
  let BFINAL = 0,
      BTYPE = 0,
      HLIT = 0,
      HDIST = 0,
      HCLEN = 0,
      ML = 0,
      MD = 0;
  let off = 0,
      pos = 0;
  let lmap, dmap;

  while (BFINAL == 0) {
    BFINAL = bitsF(data, pos, 1);
    BTYPE = bitsF(data, pos + 1, 2);
    pos += 3; //console.log(BFINAL, BTYPE);

    if (BTYPE == 0) {
      if ((pos & 7) != 0) pos += 8 - (pos & 7);
      let p8 = (pos >>> 3) + 4,
          len = data[p8 - 4] | data[p8 - 3] << 8; //console.log(len);//bitsF(data, pos, 16),

      if (noBuf) buf = UZIP.F._check(buf, off + len);
      buf.set(new Uint8Array(data.buffer, data.byteOffset + p8, len), off); //for(let i=0; i<len; i++) buf[off+i] = data[p8+i];
      //for(let i=0; i<len; i++) if(buf[off+i] != data[p8+i]) throw "e";

      pos = p8 + len << 3;
      off += len;
      continue;
    }

    if (noBuf) buf = UZIP.F._check(buf, off + (1 << 17));

    if (BTYPE == 1) {
      lmap = U.flmap;
      dmap = U.fdmap;
      ML = (1 << 9) - 1;
      MD = (1 << 5) - 1;
    }

    if (BTYPE == 2) {
      HLIT = bitsE(data, pos, 5) + 257;
      HDIST = bitsE(data, pos + 5, 5) + 1;
      HCLEN = bitsE(data, pos + 10, 4) + 4;
      pos += 14;

      for (let i = 0; i < 38; i += 2) {
        U.itree[i] = 0;
        U.itree[i + 1] = 0;
      }

      let tl = 1;

      for (let i = 0; i < HCLEN; i++) {
        let l = bitsE(data, pos + i * 3, 3);
        U.itree[(U.ordr[i] << 1) + 1] = l;
        if (l > tl) tl = l;
      }

      pos += 3 * HCLEN; //console.log(itree);

      makeCodes(U.itree, tl);
      codes2map(U.itree, tl, U.imap);
      lmap = U.lmap;
      dmap = U.dmap;
      let ml = decodeTiny(U.imap, (1 << tl) - 1, HLIT, data, pos, U.ltree);
      ML = (1 << (ml >>> 24)) - 1;
      pos += ml & 0xffffff;
      makeCodes(U.ltree, ml >>> 24);
      codes2map(U.ltree, ml >>> 24, lmap);
      let md = decodeTiny(U.imap, (1 << tl) - 1, HDIST, data, pos, U.dtree);
      MD = (1 << (md >>> 24)) - 1;
      pos += md & 0xffffff;
      makeCodes(U.dtree, md >>> 24);
      codes2map(U.dtree, md >>> 24, dmap);
    } //let ooff=off, opos=pos;


    while (true) {
      let code = lmap[get17(data, pos) & ML];
      pos += code & 15;
      let lit = code >>> 4; //U.lhst[lit]++;

      if (lit >>> 8 == 0) {
        buf[off++] = lit;
      } else if (lit == 256) {
        break;
      } else {
        let end = off + lit - 254;

        if (lit > 264) {
          let ebs = U.ldef[lit - 257];
          end = off + (ebs >>> 3) + bitsE(data, pos, ebs & 7);
          pos += ebs & 7;
        } //UZIP.F.dst[end-off]++;


        let dcode = dmap[get17(data, pos) & MD];
        pos += dcode & 15;
        let dlit = dcode >>> 4;
        let dbs = U.ddef[dlit],
            dst = (dbs >>> 4) + bitsF(data, pos, dbs & 15);
        pos += dbs & 15; //let o0 = off-dst, stp = Math.min(end-off, dst);
        //if(stp>20) while(off<end) {  buf.copyWithin(off, o0, o0+stp);  off+=stp;  }  else
        //if(end-dst<=off) buf.copyWithin(off, off-dst, end-dst);  else
        //if(dst==1) buf.fill(buf[off-1], off, end);  else

        while (off < end) {
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
        }

        off = end; //while(off!=end) {  buf[off]=buf[off++-dst];  }
      }
    } //console.log(off-ooff, (pos-opos)>>>3);

  } //console.log(UZIP.F.dst);
  //console.log(tlen, dlen, off-tlen+tcnt);


  return buf.length == off ? buf : buf.slice(0, off);
};

UZIP.F._check = function (buf, len) {
  let bl = buf.length;
  if (len <= bl) return buf;
  let nbuf = new Uint8Array(bl << 1);

  for (let i = 0; i < bl; i += 4) {
    nbuf[i] = buf[i];
    nbuf[i + 1] = buf[i + 1];
    nbuf[i + 2] = buf[i + 2];
    nbuf[i + 3] = buf[i + 3];
  }

  return nbuf;
};

UZIP.F._decodeTiny = function (lmap, LL, len, data, pos, tree) {
  let opos = pos;
  let bitsE = UZIP.F._bitsE,
      get17 = UZIP.F._get17;
  let dlen = len << 1,
      i = 0,
      mx = 0; //if(pos<1000) console.log("--------");
  //console.log("----", pos, ":",  data[7],data[8], data[9], data[10], data[11]);

  while (i < dlen) {
    let code = lmap[get17(data, pos) & LL];
    pos += code & 15;
    let lit = code >>> 4; //if(pos<1000) console.log(lit, i>>>1);
    //if(i<20)console.log(lit, code>>>9, pos);

    if (lit <= 15) {
      tree[i] = 0;
      tree[i + 1] = lit;
      if (lit > mx) mx = lit;
      i += 2;
    } else {
      let ll = 0,
          n = 0;

      if (lit == 16) {
        n = 3 + bitsE(data, pos, 2) << 1;
        pos += 2;
        ll = tree[i - 1];
      } else if (lit == 17) {
        n = 3 + bitsE(data, pos, 3) << 1;
        pos += 3;
      } else if (lit == 18) {
        n = 11 + bitsE(data, pos, 7) << 1;
        pos += 7;
      }

      let ni = i + n;

      while (i < ni) {
        tree[i] = 0;
        tree[i + 1] = ll;
        i += 2;
      }
    }
  }

  let tl = tree.length;

  while (i < tl) {
    tree[i + 1] = 0;
    i += 2;
  }

  return mx << 24 | pos - opos;
};

UZIP.F.makeCodes = function (tree, MAX_BITS) {
  // code, length
  let U = UZIP.F.U;
  let max_code = tree.length;
  let code, bits, n, i, len;
  let bl_count = U.bl_count;

  for (let i = 0; i <= MAX_BITS; i++) bl_count[i] = 0;

  for (i = 1; i < max_code; i += 2) bl_count[tree[i]]++;

  let next_code = U.next_code; // smallest code for each length

  code = 0;
  bl_count[0] = 0;

  for (bits = 1; bits <= MAX_BITS; bits++) {
    code = code + bl_count[bits - 1] << 1;
    next_code[bits] = code;
  }

  for (n = 0; n < max_code; n += 2) {
    len = tree[n + 1];

    if (len != 0) {
      tree[n] = next_code[len];
      next_code[len]++;
    }
  }
};

UZIP.F.codes2map = function (tree, MAX_BITS, map) {
  let max_code = tree.length;
  let U = UZIP.F.U,
      r15 = U.rev15;

  for (let i = 0; i < max_code; i += 2) if (tree[i + 1] != 0) {
    let lit = i >> 1;
    let cl = tree[i + 1],
        val = lit << 4 | cl; // :  (0x8000 | (U.of0[lit-257]<<7) | (U.exb[lit-257]<<4) | cl);

    let rest = MAX_BITS - cl,
        i0 = tree[i] << rest,
        i1 = i0 + (1 << rest); //tree[i]=r15[i0]>>>(15-MAX_BITS);

    while (i0 != i1) {
      let p0 = r15[i0] >>> 15 - MAX_BITS;
      map[p0] = val;
      i0++;
    }
  }
};

UZIP.F.revCodes = function (tree, MAX_BITS) {
  let r15 = UZIP.F.U.rev15,
      imb = 15 - MAX_BITS;

  for (let i = 0; i < tree.length; i += 2) {
    let i0 = tree[i] << MAX_BITS - tree[i + 1];
    tree[i] = r15[i0] >>> imb;
  }
};

UZIP.F._putsE = function (dt, pos, val) {
  val = val << (pos & 7);
  let o = pos >>> 3;
  dt[o] |= val;
  dt[o + 1] |= val >>> 8;
};

UZIP.F._putsF = function (dt, pos, val) {
  val = val << (pos & 7);
  let o = pos >>> 3;
  dt[o] |= val;
  dt[o + 1] |= val >>> 8;
  dt[o + 2] |= val >>> 16;
};

UZIP.F._bitsE = function (dt, pos, length) {
  return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8) >>> (pos & 7) & (1 << length) - 1;
};

UZIP.F._bitsF = function (dt, pos, length) {
  return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16) >>> (pos & 7) & (1 << length) - 1;
};
/*
UZIP.F._get9 = function(dt, pos) {
	return ((dt[pos>>>3] | (dt[(pos>>>3)+1]<<8))>>>(pos&7))&511;
} */


UZIP.F._get17 = function (dt, pos) {
  // return at least 17 meaningful bytes
  return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16) >>> (pos & 7);
};

UZIP.F._get25 = function (dt, pos) {
  // return at least 17 meaningful bytes
  return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16 | dt[(pos >>> 3) + 3] << 24) >>> (pos & 7);
};

UZIP.F.U = {
  next_code: new Uint16Array(16),
  bl_count: new Uint16Array(16),
  ordr: [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
  of0: [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 999, 999, 999],
  exb: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0],
  ldef: new Uint16Array(32),
  df0: [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 65535, 65535],
  dxb: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0],
  ddef: new Uint32Array(32),
  flmap: new Uint16Array(512),
  fltree: [],
  fdmap: new Uint16Array(32),
  fdtree: [],
  lmap: new Uint16Array(32768),
  ltree: [],
  dmap: new Uint16Array(32768),
  dtree: [],
  imap: new Uint16Array(512),
  itree: [],
  //rev9 : new Uint16Array(  512)
  rev15: new Uint16Array(1 << 15),
  lhst: new Uint32Array(286),
  dhst: new Uint32Array(30),
  ihst: new Uint32Array(19),
  lits: new Uint32Array(15000),
  strt: new Uint16Array(1 << 16),
  prev: new Uint16Array(1 << 15)
};

(function () {
  let U = UZIP.F.U;
  let len = 1 << 15;

  for (let i = 0; i < len; i++) {
    let x = i;
    x = (x & 0xaaaaaaaa) >>> 1 | (x & 0x55555555) << 1;
    x = (x & 0xcccccccc) >>> 2 | (x & 0x33333333) << 2;
    x = (x & 0xf0f0f0f0) >>> 4 | (x & 0x0f0f0f0f) << 4;
    x = (x & 0xff00ff00) >>> 8 | (x & 0x00ff00ff) << 8;
    U.rev15[i] = (x >>> 16 | x << 16) >>> 17;
  }

  for (let i = 0; i < 32; i++) {
    U.ldef[i] = U.of0[i] << 3 | U.exb[i];
    U.ddef[i] = U.df0[i] << 4 | U.dxb[i];
  }

  let i = 0;

  for (; i <= 143; i++) U.fltree.push(0, 8);

  for (; i <= 255; i++) U.fltree.push(0, 9);

  for (; i <= 279; i++) U.fltree.push(0, 7);

  for (; i <= 287; i++) U.fltree.push(0, 8);

  UZIP.F.makeCodes(U.fltree, 9);
  UZIP.F.codes2map(U.fltree, 9, U.flmap);
  UZIP.F.revCodes(U.fltree, 9);

  for (i = 0; i < 32; i++) U.fdtree.push(0, 5);

  UZIP.F.makeCodes(U.fdtree, 5);
  UZIP.F.codes2map(U.fdtree, 5, U.fdmap);
  UZIP.F.revCodes(U.fdtree, 5);

  for (let i = 0; i < 19; i++) U.itree.push(0, 0);

  for (let i = 0; i < 286; i++) U.ltree.push(0, 0);

  for (let i = 0; i < 30; i++) U.dtree.push(0, 0);
})();

// Modules
// Private function to fetch a game

const fetchROMAsByteArray = (ROM, loadOptions) => {
  const fetchROMAsByteArrayTask = async () => {
    // Check if we were passed straight bytes
    if (ArrayBuffer.isView(ROM) && ROM.constructor === Uint8Array) {
      return ROM;
    } else if (typeof ROM === 'object' && ROM.size) {
      // We were passed a file from HTML file input
      // Read the file as a Uint8Array
      const byteArray = await getROMFromFileReaderAsByteArray(ROM);

      if (ROM.name.toLowerCase().endsWith('.zip')) {
        return await parseByteArrayAsZip(byteArray);
      }

      return byteArray;
    } else {
      // We were passed a URL
      // Fetch the file
      // First check if we have headers
      const fetchHeaders = {};

      if (loadOptions && loadOptions.headers) {
        fetchHeaders.headers = loadOptions.headers;
      }

      let bytes = await fetch(ROM, fetchHeaders).then(blob => {
        if (!blob.ok) {
          return Promise.reject(blob);
        }

        return blob.arrayBuffer();
      });
      let fileName = ROM;

      if (loadOptions && loadOptions.fileName) {
        fileName = loadOptions.fileName;
      } // Get our byteArray


      const byteArray = new Uint8Array(bytes);

      if (fileName.toLowerCase().endsWith('.zip')) {
        return await parseByteArrayAsZip(byteArray);
      }

      return byteArray;
    }
  };

  return fetchROMAsByteArrayTask();
};

const getROMFromFileReaderAsByteArray = async ROM => {
  const fileReaderByteArray = await new Promise((resolve, reject) => {
    // Read the file object
    // https://www.javascripture.com/FileReader#readAsArrayBuffer_Blob
    const fileReader = new FileReader();

    fileReader.onload = () => {
      const byteArray = new Uint8Array(fileReader.result);
      resolve(byteArray);
    };

    fileReader.readAsArrayBuffer(ROM);
  });
  return fileReaderByteArray;
}; // Function to parse and find the gb files within an archive


const parseByteArrayAsZip = async byteArray => {
  // Parse the zip using UZIP
  const unzipObject = await uzip.parse(byteArray); // Find the ROM in the output

  let foundROM = false;
  const unzipObjectKeys = Object.keys(unzipObject);
  unzipObjectKeys.some(key => {
    const lowercaseKey = key.toLowerCase();

    if (lowercaseKey.includes('.gb') || lowercaseKey.includes('.gbc')) {
      foundROM = unzipObject[key];
      return true;
    }

    return false;
  });

  if (!foundROM) {
    throw new Error('Could not find a ROM in zip...');
  }

  return foundROM;
};

// Functions here are depedent on WasmBoyMemory state.
// NOTE: **Should bind the wasmboy this here**

function loadROMToWasmBoy(ROM, fetchHeaders) {
  // Getting started with wasm
  // http://webassembly.org/getting-started/js-api/
  this.ready = false;
  this.loadedAndStarted = false;

  const initializeTask = async () => {
    // Get our promises
    const initPromises = [fetchROMAsByteArray(ROM, fetchHeaders), this._instantiateWorkers()];

    if (!this.options.headless && WasmBoyMemory.getLoadedCartridgeMemoryState().RAM) {
      initPromises.push(WasmBoyMemory.saveCartridgeRam());
    }

    let ROMAsByteArray;
    await Promise.all(initPromises).then(responses => {
      ROMAsByteArray = responses[0];
    }); // Now tell the wasm module to instantiate wasm

    const response = await this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.INSTANTIATE_WASM
    });
    this.coreType = response.message.type;
    return ROMAsByteArray;
  };

  const loadROMAndConfigTask = async ROM => {
    // Clear what is currently in memory, then load the cartridge memory
    await WasmBoyMemory.clearMemory(); // TODO: Handle passing a boot rom

    await WasmBoyMemory.loadCartridgeRom(ROM); // Save the game that we loaded if we need to reload the game

    this.loadedROM = ROM; // Run our initialization on the core

    await this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.CONFIG,
      config: [0, // TODO: Include Boot Rom
      this.options.isGbcEnabled ? 1 : 0, this.options.audioBatchProcessing ? 1 : 0, this.options.graphicsBatchProcessing ? 1 : 0, this.options.timersBatchProcessing ? 1 : 0, this.options.graphicsDisableScanlineRendering ? 1 : 0, this.options.audioAccumulateSamples ? 1 : 0, this.options.tileRendering ? 1 : 0, this.options.tileCaching ? 1 : 0],
      options: {
        gameboyFrameRate: this.options.gameboyFrameRate,
        headless: this.options.headless,
        isAudioEnabled: this.options.isAudioEnabled,
        frameSkip: this.options.frameSkip
      }
    });
  };

  const loadROMTask = async () => {
    // Pause wasmBoy
    await this.pause(); // Initialize any needed parts of wasmboy

    let ROM = await initializeTask(); // Check if we are running headless

    if (this.options.headless) {
      await WasmBoyMemory.initialize(this.options.headless, this.options.saveStateCallback);
      await loadROMAndConfigTask(ROM);
      this.ready = true;

      if (this.options.onReady) {
        this.options.onReady();
      }
    } else {
      // Finally intialize all of our services
      // Initialize our services
      await Promise.all([WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback), WasmBoyAudio.initialize(this.options.updateAudioCallback), WasmBoyController.initialize(), WasmBoyMemory.initialize(this.options.headless, this.options.saveStateCallback)]);
      await loadROMAndConfigTask(ROM); // Load the game's cartridge ram

      await WasmBoyMemory.loadCartridgeRam();
      this.ready = true;

      if (this.options.onReady) {
        this.options.onReady();
      }
    }
  };

  return loadROMTask();
}

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var performanceNow = createCommonjsModule(function (module) {
// Generated by CoffeeScript 1.12.2
(function() {
  var getNanoSeconds, hrtime, loadTime, moduleLoadTime, nodeLoadTime, upTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - nodeLoadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    moduleLoadTime = getNanoSeconds();
    upTime = process.uptime() * 1e9;
    nodeLoadTime = moduleLoadTime - upTime;
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(commonjsGlobal);


});

var root = typeof window === 'undefined' ? commonjsGlobal : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix];

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix];
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix];
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id$1 = 0
    , queue = []
    , frameDuration = 1000 / 60;

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = performanceNow()
        , next = Math.max(0, frameDuration - (_now - last));
      last = next + _now;
      setTimeout(function() {
        var cp = queue.slice(0);
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0;
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last);
            } catch(e) {
              setTimeout(function() { throw e }, 0);
            }
          }
        }
      }, Math.round(next));
    }
    queue.push({
      handle: ++id$1,
      callback: callback,
      cancelled: false
    });
    return id$1
  };

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true;
      }
    }
  };
}

var raf_1 = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
};
var cancel = function() {
  caf.apply(root, arguments);
};
var polyfill = function(object) {
  if (!object) {
    object = root;
  }
  object.requestAnimationFrame = raf;
  object.cancelAnimationFrame = caf;
};
raf_1.cancel = cancel;
raf_1.polyfill = polyfill;

// Functions here are depedent on WasmBoyMemory state.

function render() {
  // Don't run if paused
  if (this.paused) {
    return true;
  } // Check if we have frameskip


  let shouldSkipRenderingFrame = false;

  if (this.frameSkip && this.frameSkip > 0) {
    this.frameSkipCounter++;

    if (this.frameSkipCounter < this.frameSkip) {
      shouldSkipRenderingFrame = true;
    } else {
      this.frameSkipCounter = 0;
    }
  } // Render the display


  if (!shouldSkipRenderingFrame) {
    WasmBoyGraphics.renderFrame();
  } // Update our controller


  WasmBoyController.updateController();
  this.renderId = raf_1(() => {
    render.call(this);
  });
}

function index(buffer, opt) {
  opt = opt || {};

  var numChannels = buffer.numberOfChannels;
  var sampleRate = buffer.sampleRate;
  var format = opt.float32 ? 3 : 1;
  var bitDepth = format === 3 ? 32 : 16;

  var result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  return encodeWAV(result, format, sampleRate, numChannels, bitDepth)
}

function encodeWAV (samples, format, sampleRate, numChannels, bitDepth) {
  var bytesPerSample = bitDepth / 8;
  var blockAlign = numChannels * bytesPerSample;

  var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  var view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);
  if (format === 1) { // Raw PCM
    floatTo16BitPCM(view, 44, samples);
  } else {
    writeFloat32(view, 44, samples);
  }

  return buffer
}

function interleave (inputL, inputR) {
  var length = inputL.length + inputR.length;
  var result = new Float32Array(length);

  var index = 0;
  var inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result
}

function writeFloat32 (output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true);
  }
}

function floatTo16BitPCM (output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString (view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

var BigInteger = createCommonjsModule(function (module) {
var bigInt = (function (undefined) {

    var BASE = 1e7,
        LOG_BASE = 7,
        MAX_INT = 9007199254740992,
        MAX_INT_ARR = smallToArray(MAX_INT),
        DEFAULT_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

    var supportsNativeBigInt = typeof BigInt === "function";

    function Integer(v, radix, alphabet, caseSensitive) {
        if (typeof v === "undefined") return Integer[0];
        if (typeof radix !== "undefined") return +radix === 10 && !alphabet ? parseValue(v) : parseBase(v, radix, alphabet, caseSensitive);
        return parseValue(v);
    }

    function BigInteger(value, sign) {
        this.value = value;
        this.sign = sign;
        this.isSmall = false;
    }
    BigInteger.prototype = Object.create(Integer.prototype);

    function SmallInteger(value) {
        this.value = value;
        this.sign = value < 0;
        this.isSmall = true;
    }
    SmallInteger.prototype = Object.create(Integer.prototype);

    function NativeBigInt(value) {
        this.value = value;
    }
    NativeBigInt.prototype = Object.create(Integer.prototype);

    function isPrecise(n) {
        return -MAX_INT < n && n < MAX_INT;
    }

    function smallToArray(n) { // For performance reasons doesn't reference BASE, need to change this function if BASE changes
        if (n < 1e7)
            return [n];
        if (n < 1e14)
            return [n % 1e7, Math.floor(n / 1e7)];
        return [n % 1e7, Math.floor(n / 1e7) % 1e7, Math.floor(n / 1e14)];
    }

    function arrayToSmall(arr) { // If BASE changes this function may need to change
        trim(arr);
        var length = arr.length;
        if (length < 4 && compareAbs(arr, MAX_INT_ARR) < 0) {
            switch (length) {
                case 0: return 0;
                case 1: return arr[0];
                case 2: return arr[0] + arr[1] * BASE;
                default: return arr[0] + (arr[1] + arr[2] * BASE) * BASE;
            }
        }
        return arr;
    }

    function trim(v) {
        var i = v.length;
        while (v[--i] === 0);
        v.length = i + 1;
    }

    function createArray(length) { // function shamelessly stolen from Yaffle's library https://github.com/Yaffle/BigInteger
        var x = new Array(length);
        var i = -1;
        while (++i < length) {
            x[i] = 0;
        }
        return x;
    }

    function truncate(n) {
        if (n > 0) return Math.floor(n);
        return Math.ceil(n);
    }

    function add(a, b) { // assumes a and b are arrays with a.length >= b.length
        var l_a = a.length,
            l_b = b.length,
            r = new Array(l_a),
            carry = 0,
            base = BASE,
            sum, i;
        for (i = 0; i < l_b; i++) {
            sum = a[i] + b[i] + carry;
            carry = sum >= base ? 1 : 0;
            r[i] = sum - carry * base;
        }
        while (i < l_a) {
            sum = a[i] + carry;
            carry = sum === base ? 1 : 0;
            r[i++] = sum - carry * base;
        }
        if (carry > 0) r.push(carry);
        return r;
    }

    function addAny(a, b) {
        if (a.length >= b.length) return add(a, b);
        return add(b, a);
    }

    function addSmall(a, carry) { // assumes a is array, carry is number with 0 <= carry < MAX_INT
        var l = a.length,
            r = new Array(l),
            base = BASE,
            sum, i;
        for (i = 0; i < l; i++) {
            sum = a[i] - base + carry;
            carry = Math.floor(sum / base);
            r[i] = sum - carry * base;
            carry += 1;
        }
        while (carry > 0) {
            r[i++] = carry % base;
            carry = Math.floor(carry / base);
        }
        return r;
    }

    BigInteger.prototype.add = function (v) {
        var n = parseValue(v);
        if (this.sign !== n.sign) {
            return this.subtract(n.negate());
        }
        var a = this.value, b = n.value;
        if (n.isSmall) {
            return new BigInteger(addSmall(a, Math.abs(b)), this.sign);
        }
        return new BigInteger(addAny(a, b), this.sign);
    };
    BigInteger.prototype.plus = BigInteger.prototype.add;

    SmallInteger.prototype.add = function (v) {
        var n = parseValue(v);
        var a = this.value;
        if (a < 0 !== n.sign) {
            return this.subtract(n.negate());
        }
        var b = n.value;
        if (n.isSmall) {
            if (isPrecise(a + b)) return new SmallInteger(a + b);
            b = smallToArray(Math.abs(b));
        }
        return new BigInteger(addSmall(b, Math.abs(a)), a < 0);
    };
    SmallInteger.prototype.plus = SmallInteger.prototype.add;

    NativeBigInt.prototype.add = function (v) {
        return new NativeBigInt(this.value + parseValue(v).value);
    };
    NativeBigInt.prototype.plus = NativeBigInt.prototype.add;

    function subtract(a, b) { // assumes a and b are arrays with a >= b
        var a_l = a.length,
            b_l = b.length,
            r = new Array(a_l),
            borrow = 0,
            base = BASE,
            i, difference;
        for (i = 0; i < b_l; i++) {
            difference = a[i] - borrow - b[i];
            if (difference < 0) {
                difference += base;
                borrow = 1;
            } else borrow = 0;
            r[i] = difference;
        }
        for (i = b_l; i < a_l; i++) {
            difference = a[i] - borrow;
            if (difference < 0) difference += base;
            else {
                r[i++] = difference;
                break;
            }
            r[i] = difference;
        }
        for (; i < a_l; i++) {
            r[i] = a[i];
        }
        trim(r);
        return r;
    }

    function subtractAny(a, b, sign) {
        var value;
        if (compareAbs(a, b) >= 0) {
            value = subtract(a, b);
        } else {
            value = subtract(b, a);
            sign = !sign;
        }
        value = arrayToSmall(value);
        if (typeof value === "number") {
            if (sign) value = -value;
            return new SmallInteger(value);
        }
        return new BigInteger(value, sign);
    }

    function subtractSmall(a, b, sign) { // assumes a is array, b is number with 0 <= b < MAX_INT
        var l = a.length,
            r = new Array(l),
            carry = -b,
            base = BASE,
            i, difference;
        for (i = 0; i < l; i++) {
            difference = a[i] + carry;
            carry = Math.floor(difference / base);
            difference %= base;
            r[i] = difference < 0 ? difference + base : difference;
        }
        r = arrayToSmall(r);
        if (typeof r === "number") {
            if (sign) r = -r;
            return new SmallInteger(r);
        } return new BigInteger(r, sign);
    }

    BigInteger.prototype.subtract = function (v) {
        var n = parseValue(v);
        if (this.sign !== n.sign) {
            return this.add(n.negate());
        }
        var a = this.value, b = n.value;
        if (n.isSmall)
            return subtractSmall(a, Math.abs(b), this.sign);
        return subtractAny(a, b, this.sign);
    };
    BigInteger.prototype.minus = BigInteger.prototype.subtract;

    SmallInteger.prototype.subtract = function (v) {
        var n = parseValue(v);
        var a = this.value;
        if (a < 0 !== n.sign) {
            return this.add(n.negate());
        }
        var b = n.value;
        if (n.isSmall) {
            return new SmallInteger(a - b);
        }
        return subtractSmall(b, Math.abs(a), a >= 0);
    };
    SmallInteger.prototype.minus = SmallInteger.prototype.subtract;

    NativeBigInt.prototype.subtract = function (v) {
        return new NativeBigInt(this.value - parseValue(v).value);
    };
    NativeBigInt.prototype.minus = NativeBigInt.prototype.subtract;

    BigInteger.prototype.negate = function () {
        return new BigInteger(this.value, !this.sign);
    };
    SmallInteger.prototype.negate = function () {
        var sign = this.sign;
        var small = new SmallInteger(-this.value);
        small.sign = !sign;
        return small;
    };
    NativeBigInt.prototype.negate = function () {
        return new NativeBigInt(-this.value);
    };

    BigInteger.prototype.abs = function () {
        return new BigInteger(this.value, false);
    };
    SmallInteger.prototype.abs = function () {
        return new SmallInteger(Math.abs(this.value));
    };
    NativeBigInt.prototype.abs = function () {
        return new NativeBigInt(this.value >= 0 ? this.value : -this.value);
    };


    function multiplyLong(a, b) {
        var a_l = a.length,
            b_l = b.length,
            l = a_l + b_l,
            r = createArray(l),
            base = BASE,
            product, carry, i, a_i, b_j;
        for (i = 0; i < a_l; ++i) {
            a_i = a[i];
            for (var j = 0; j < b_l; ++j) {
                b_j = b[j];
                product = a_i * b_j + r[i + j];
                carry = Math.floor(product / base);
                r[i + j] = product - carry * base;
                r[i + j + 1] += carry;
            }
        }
        trim(r);
        return r;
    }

    function multiplySmall(a, b) { // assumes a is array, b is number with |b| < BASE
        var l = a.length,
            r = new Array(l),
            base = BASE,
            carry = 0,
            product, i;
        for (i = 0; i < l; i++) {
            product = a[i] * b + carry;
            carry = Math.floor(product / base);
            r[i] = product - carry * base;
        }
        while (carry > 0) {
            r[i++] = carry % base;
            carry = Math.floor(carry / base);
        }
        return r;
    }

    function shiftLeft(x, n) {
        var r = [];
        while (n-- > 0) r.push(0);
        return r.concat(x);
    }

    function multiplyKaratsuba(x, y) {
        var n = Math.max(x.length, y.length);

        if (n <= 30) return multiplyLong(x, y);
        n = Math.ceil(n / 2);

        var b = x.slice(n),
            a = x.slice(0, n),
            d = y.slice(n),
            c = y.slice(0, n);

        var ac = multiplyKaratsuba(a, c),
            bd = multiplyKaratsuba(b, d),
            abcd = multiplyKaratsuba(addAny(a, b), addAny(c, d));

        var product = addAny(addAny(ac, shiftLeft(subtract(subtract(abcd, ac), bd), n)), shiftLeft(bd, 2 * n));
        trim(product);
        return product;
    }

    // The following function is derived from a surface fit of a graph plotting the performance difference
    // between long multiplication and karatsuba multiplication versus the lengths of the two arrays.
    function useKaratsuba(l1, l2) {
        return -0.012 * l1 - 0.012 * l2 + 0.000015 * l1 * l2 > 0;
    }

    BigInteger.prototype.multiply = function (v) {
        var n = parseValue(v),
            a = this.value, b = n.value,
            sign = this.sign !== n.sign,
            abs;
        if (n.isSmall) {
            if (b === 0) return Integer[0];
            if (b === 1) return this;
            if (b === -1) return this.negate();
            abs = Math.abs(b);
            if (abs < BASE) {
                return new BigInteger(multiplySmall(a, abs), sign);
            }
            b = smallToArray(abs);
        }
        if (useKaratsuba(a.length, b.length)) // Karatsuba is only faster for certain array sizes
            return new BigInteger(multiplyKaratsuba(a, b), sign);
        return new BigInteger(multiplyLong(a, b), sign);
    };

    BigInteger.prototype.times = BigInteger.prototype.multiply;

    function multiplySmallAndArray(a, b, sign) { // a >= 0
        if (a < BASE) {
            return new BigInteger(multiplySmall(b, a), sign);
        }
        return new BigInteger(multiplyLong(b, smallToArray(a)), sign);
    }
    SmallInteger.prototype._multiplyBySmall = function (a) {
        if (isPrecise(a.value * this.value)) {
            return new SmallInteger(a.value * this.value);
        }
        return multiplySmallAndArray(Math.abs(a.value), smallToArray(Math.abs(this.value)), this.sign !== a.sign);
    };
    BigInteger.prototype._multiplyBySmall = function (a) {
        if (a.value === 0) return Integer[0];
        if (a.value === 1) return this;
        if (a.value === -1) return this.negate();
        return multiplySmallAndArray(Math.abs(a.value), this.value, this.sign !== a.sign);
    };
    SmallInteger.prototype.multiply = function (v) {
        return parseValue(v)._multiplyBySmall(this);
    };
    SmallInteger.prototype.times = SmallInteger.prototype.multiply;

    NativeBigInt.prototype.multiply = function (v) {
        return new NativeBigInt(this.value * parseValue(v).value);
    };
    NativeBigInt.prototype.times = NativeBigInt.prototype.multiply;

    function square(a) {
        //console.assert(2 * BASE * BASE < MAX_INT);
        var l = a.length,
            r = createArray(l + l),
            base = BASE,
            product, carry, i, a_i, a_j;
        for (i = 0; i < l; i++) {
            a_i = a[i];
            carry = 0 - a_i * a_i;
            for (var j = i; j < l; j++) {
                a_j = a[j];
                product = 2 * (a_i * a_j) + r[i + j] + carry;
                carry = Math.floor(product / base);
                r[i + j] = product - carry * base;
            }
            r[i + l] = carry;
        }
        trim(r);
        return r;
    }

    BigInteger.prototype.square = function () {
        return new BigInteger(square(this.value), false);
    };

    SmallInteger.prototype.square = function () {
        var value = this.value * this.value;
        if (isPrecise(value)) return new SmallInteger(value);
        return new BigInteger(square(smallToArray(Math.abs(this.value))), false);
    };

    NativeBigInt.prototype.square = function (v) {
        return new NativeBigInt(this.value * this.value);
    };

    function divMod1(a, b) { // Left over from previous version. Performs faster than divMod2 on smaller input sizes.
        var a_l = a.length,
            b_l = b.length,
            base = BASE,
            result = createArray(b.length),
            divisorMostSignificantDigit = b[b_l - 1],
            // normalization
            lambda = Math.ceil(base / (2 * divisorMostSignificantDigit)),
            remainder = multiplySmall(a, lambda),
            divisor = multiplySmall(b, lambda),
            quotientDigit, shift, carry, borrow, i, l, q;
        if (remainder.length <= a_l) remainder.push(0);
        divisor.push(0);
        divisorMostSignificantDigit = divisor[b_l - 1];
        for (shift = a_l - b_l; shift >= 0; shift--) {
            quotientDigit = base - 1;
            if (remainder[shift + b_l] !== divisorMostSignificantDigit) {
                quotientDigit = Math.floor((remainder[shift + b_l] * base + remainder[shift + b_l - 1]) / divisorMostSignificantDigit);
            }
            // quotientDigit <= base - 1
            carry = 0;
            borrow = 0;
            l = divisor.length;
            for (i = 0; i < l; i++) {
                carry += quotientDigit * divisor[i];
                q = Math.floor(carry / base);
                borrow += remainder[shift + i] - (carry - q * base);
                carry = q;
                if (borrow < 0) {
                    remainder[shift + i] = borrow + base;
                    borrow = -1;
                } else {
                    remainder[shift + i] = borrow;
                    borrow = 0;
                }
            }
            while (borrow !== 0) {
                quotientDigit -= 1;
                carry = 0;
                for (i = 0; i < l; i++) {
                    carry += remainder[shift + i] - base + divisor[i];
                    if (carry < 0) {
                        remainder[shift + i] = carry + base;
                        carry = 0;
                    } else {
                        remainder[shift + i] = carry;
                        carry = 1;
                    }
                }
                borrow += carry;
            }
            result[shift] = quotientDigit;
        }
        // denormalization
        remainder = divModSmall(remainder, lambda)[0];
        return [arrayToSmall(result), arrayToSmall(remainder)];
    }

    function divMod2(a, b) { // Implementation idea shamelessly stolen from Silent Matt's library http://silentmatt.com/biginteger/
        // Performs faster than divMod1 on larger input sizes.
        var a_l = a.length,
            b_l = b.length,
            result = [],
            part = [],
            base = BASE,
            guess, xlen, highx, highy, check;
        while (a_l) {
            part.unshift(a[--a_l]);
            trim(part);
            if (compareAbs(part, b) < 0) {
                result.push(0);
                continue;
            }
            xlen = part.length;
            highx = part[xlen - 1] * base + part[xlen - 2];
            highy = b[b_l - 1] * base + b[b_l - 2];
            if (xlen > b_l) {
                highx = (highx + 1) * base;
            }
            guess = Math.ceil(highx / highy);
            do {
                check = multiplySmall(b, guess);
                if (compareAbs(check, part) <= 0) break;
                guess--;
            } while (guess);
            result.push(guess);
            part = subtract(part, check);
        }
        result.reverse();
        return [arrayToSmall(result), arrayToSmall(part)];
    }

    function divModSmall(value, lambda) {
        var length = value.length,
            quotient = createArray(length),
            base = BASE,
            i, q, remainder, divisor;
        remainder = 0;
        for (i = length - 1; i >= 0; --i) {
            divisor = remainder * base + value[i];
            q = truncate(divisor / lambda);
            remainder = divisor - q * lambda;
            quotient[i] = q | 0;
        }
        return [quotient, remainder | 0];
    }

    function divModAny(self, v) {
        var value, n = parseValue(v);
        if (supportsNativeBigInt) {
            return [new NativeBigInt(self.value / n.value), new NativeBigInt(self.value % n.value)];
        }
        var a = self.value, b = n.value;
        var quotient;
        if (b === 0) throw new Error("Cannot divide by zero");
        if (self.isSmall) {
            if (n.isSmall) {
                return [new SmallInteger(truncate(a / b)), new SmallInteger(a % b)];
            }
            return [Integer[0], self];
        }
        if (n.isSmall) {
            if (b === 1) return [self, Integer[0]];
            if (b == -1) return [self.negate(), Integer[0]];
            var abs = Math.abs(b);
            if (abs < BASE) {
                value = divModSmall(a, abs);
                quotient = arrayToSmall(value[0]);
                var remainder = value[1];
                if (self.sign) remainder = -remainder;
                if (typeof quotient === "number") {
                    if (self.sign !== n.sign) quotient = -quotient;
                    return [new SmallInteger(quotient), new SmallInteger(remainder)];
                }
                return [new BigInteger(quotient, self.sign !== n.sign), new SmallInteger(remainder)];
            }
            b = smallToArray(abs);
        }
        var comparison = compareAbs(a, b);
        if (comparison === -1) return [Integer[0], self];
        if (comparison === 0) return [Integer[self.sign === n.sign ? 1 : -1], Integer[0]];

        // divMod1 is faster on smaller input sizes
        if (a.length + b.length <= 200)
            value = divMod1(a, b);
        else value = divMod2(a, b);

        quotient = value[0];
        var qSign = self.sign !== n.sign,
            mod = value[1],
            mSign = self.sign;
        if (typeof quotient === "number") {
            if (qSign) quotient = -quotient;
            quotient = new SmallInteger(quotient);
        } else quotient = new BigInteger(quotient, qSign);
        if (typeof mod === "number") {
            if (mSign) mod = -mod;
            mod = new SmallInteger(mod);
        } else mod = new BigInteger(mod, mSign);
        return [quotient, mod];
    }

    BigInteger.prototype.divmod = function (v) {
        var result = divModAny(this, v);
        return {
            quotient: result[0],
            remainder: result[1]
        };
    };
    NativeBigInt.prototype.divmod = SmallInteger.prototype.divmod = BigInteger.prototype.divmod;


    BigInteger.prototype.divide = function (v) {
        return divModAny(this, v)[0];
    };
    NativeBigInt.prototype.over = NativeBigInt.prototype.divide = SmallInteger.prototype.over = SmallInteger.prototype.divide = BigInteger.prototype.over = BigInteger.prototype.divide;

    BigInteger.prototype.mod = function (v) {
        return divModAny(this, v)[1];
    };
    NativeBigInt.prototype.mod = NativeBigInt.prototype.remainder = SmallInteger.prototype.remainder = SmallInteger.prototype.mod = BigInteger.prototype.remainder = BigInteger.prototype.mod;

    BigInteger.prototype.pow = function (v) {
        var n = parseValue(v),
            a = this.value,
            b = n.value,
            value, x, y;
        if (b === 0) return Integer[1];
        if (a === 0) return Integer[0];
        if (a === 1) return Integer[1];
        if (a === -1) return n.isEven() ? Integer[1] : Integer[-1];
        if (n.sign) {
            return Integer[0];
        }
        if (!n.isSmall) throw new Error("The exponent " + n.toString() + " is too large.");
        if (this.isSmall) {
            if (isPrecise(value = Math.pow(a, b)))
                return new SmallInteger(truncate(value));
        }
        x = this;
        y = Integer[1];
        while (true) {
            if (b & 1 === 1) {
                y = y.times(x);
                --b;
            }
            if (b === 0) break;
            b /= 2;
            x = x.square();
        }
        return y;
    };
    SmallInteger.prototype.pow = BigInteger.prototype.pow;

    var pow;
    if (supportsNativeBigInt) {
        // forced to use eval because ** is a syntax error on pre-ECMAScript2017 environments.
        pow = eval("(a,b)=>a**b");
    }

    NativeBigInt.prototype.pow = function (v) {
        var n = parseValue(v);
        var a = this.value, b = n.value;
        if (b === BigInt(0)) return Integer[1];
        if (a === BigInt(0)) return Integer[0];
        if (a === BigInt(1)) return Integer[1];
        if (a === BigInt(-1)) return n.isEven() ? Integer[1] : Integer[-1];
        if (n.isNegative()) return new NativeBigInt(BigInt(0));
        return new NativeBigInt(pow(a, b));
    };

    BigInteger.prototype.modPow = function (exp, mod) {
        exp = parseValue(exp);
        mod = parseValue(mod);
        if (mod.isZero()) throw new Error("Cannot take modPow with modulus 0");
        var r = Integer[1],
            base = this.mod(mod);
        while (exp.isPositive()) {
            if (base.isZero()) return Integer[0];
            if (exp.isOdd()) r = r.multiply(base).mod(mod);
            exp = exp.divide(2);
            base = base.square().mod(mod);
        }
        return r;
    };
    NativeBigInt.prototype.modPow = SmallInteger.prototype.modPow = BigInteger.prototype.modPow;

    function compareAbs(a, b) {
        if (a.length !== b.length) {
            return a.length > b.length ? 1 : -1;
        }
        for (var i = a.length - 1; i >= 0; i--) {
            if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
        }
        return 0;
    }

    BigInteger.prototype.compareAbs = function (v) {
        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (n.isSmall) return 1;
        return compareAbs(a, b);
    };
    SmallInteger.prototype.compareAbs = function (v) {
        var n = parseValue(v),
            a = Math.abs(this.value),
            b = n.value;
        if (n.isSmall) {
            b = Math.abs(b);
            return a === b ? 0 : a > b ? 1 : -1;
        }
        return -1;
    };
    NativeBigInt.prototype.compareAbs = function (v) {
        var a = this.value;
        var b = parseValue(v).value;
        a = a >= 0 ? a : -a;
        b = b >= 0 ? b : -b;
        return a === b ? 0 : a > b ? 1 : -1;
    };

    BigInteger.prototype.compare = function (v) {
        // See discussion about comparison with Infinity:
        // https://github.com/peterolson/BigInteger.js/issues/61
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }

        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (this.sign !== n.sign) {
            return n.sign ? 1 : -1;
        }
        if (n.isSmall) {
            return this.sign ? -1 : 1;
        }
        return compareAbs(a, b) * (this.sign ? -1 : 1);
    };
    BigInteger.prototype.compareTo = BigInteger.prototype.compare;

    SmallInteger.prototype.compare = function (v) {
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }

        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (n.isSmall) {
            return a == b ? 0 : a > b ? 1 : -1;
        }
        if (a < 0 !== n.sign) {
            return a < 0 ? -1 : 1;
        }
        return a < 0 ? 1 : -1;
    };
    SmallInteger.prototype.compareTo = SmallInteger.prototype.compare;

    NativeBigInt.prototype.compare = function (v) {
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }
        var a = this.value;
        var b = parseValue(v).value;
        return a === b ? 0 : a > b ? 1 : -1;
    };
    NativeBigInt.prototype.compareTo = NativeBigInt.prototype.compare;

    BigInteger.prototype.equals = function (v) {
        return this.compare(v) === 0;
    };
    NativeBigInt.prototype.eq = NativeBigInt.prototype.equals = SmallInteger.prototype.eq = SmallInteger.prototype.equals = BigInteger.prototype.eq = BigInteger.prototype.equals;

    BigInteger.prototype.notEquals = function (v) {
        return this.compare(v) !== 0;
    };
    NativeBigInt.prototype.neq = NativeBigInt.prototype.notEquals = SmallInteger.prototype.neq = SmallInteger.prototype.notEquals = BigInteger.prototype.neq = BigInteger.prototype.notEquals;

    BigInteger.prototype.greater = function (v) {
        return this.compare(v) > 0;
    };
    NativeBigInt.prototype.gt = NativeBigInt.prototype.greater = SmallInteger.prototype.gt = SmallInteger.prototype.greater = BigInteger.prototype.gt = BigInteger.prototype.greater;

    BigInteger.prototype.lesser = function (v) {
        return this.compare(v) < 0;
    };
    NativeBigInt.prototype.lt = NativeBigInt.prototype.lesser = SmallInteger.prototype.lt = SmallInteger.prototype.lesser = BigInteger.prototype.lt = BigInteger.prototype.lesser;

    BigInteger.prototype.greaterOrEquals = function (v) {
        return this.compare(v) >= 0;
    };
    NativeBigInt.prototype.geq = NativeBigInt.prototype.greaterOrEquals = SmallInteger.prototype.geq = SmallInteger.prototype.greaterOrEquals = BigInteger.prototype.geq = BigInteger.prototype.greaterOrEquals;

    BigInteger.prototype.lesserOrEquals = function (v) {
        return this.compare(v) <= 0;
    };
    NativeBigInt.prototype.leq = NativeBigInt.prototype.lesserOrEquals = SmallInteger.prototype.leq = SmallInteger.prototype.lesserOrEquals = BigInteger.prototype.leq = BigInteger.prototype.lesserOrEquals;

    BigInteger.prototype.isEven = function () {
        return (this.value[0] & 1) === 0;
    };
    SmallInteger.prototype.isEven = function () {
        return (this.value & 1) === 0;
    };
    NativeBigInt.prototype.isEven = function () {
        return (this.value & BigInt(1)) === BigInt(0);
    };

    BigInteger.prototype.isOdd = function () {
        return (this.value[0] & 1) === 1;
    };
    SmallInteger.prototype.isOdd = function () {
        return (this.value & 1) === 1;
    };
    NativeBigInt.prototype.isOdd = function () {
        return (this.value & BigInt(1)) === BigInt(1);
    };

    BigInteger.prototype.isPositive = function () {
        return !this.sign;
    };
    SmallInteger.prototype.isPositive = function () {
        return this.value > 0;
    };
    NativeBigInt.prototype.isPositive = SmallInteger.prototype.isPositive;

    BigInteger.prototype.isNegative = function () {
        return this.sign;
    };
    SmallInteger.prototype.isNegative = function () {
        return this.value < 0;
    };
    NativeBigInt.prototype.isNegative = SmallInteger.prototype.isNegative;

    BigInteger.prototype.isUnit = function () {
        return false;
    };
    SmallInteger.prototype.isUnit = function () {
        return Math.abs(this.value) === 1;
    };
    NativeBigInt.prototype.isUnit = function () {
        return this.abs().value === BigInt(1);
    };

    BigInteger.prototype.isZero = function () {
        return false;
    };
    SmallInteger.prototype.isZero = function () {
        return this.value === 0;
    };
    NativeBigInt.prototype.isZero = function () {
        return this.value === BigInt(0);
    };

    BigInteger.prototype.isDivisibleBy = function (v) {
        var n = parseValue(v);
        if (n.isZero()) return false;
        if (n.isUnit()) return true;
        if (n.compareAbs(2) === 0) return this.isEven();
        return this.mod(n).isZero();
    };
    NativeBigInt.prototype.isDivisibleBy = SmallInteger.prototype.isDivisibleBy = BigInteger.prototype.isDivisibleBy;

    function isBasicPrime(v) {
        var n = v.abs();
        if (n.isUnit()) return false;
        if (n.equals(2) || n.equals(3) || n.equals(5)) return true;
        if (n.isEven() || n.isDivisibleBy(3) || n.isDivisibleBy(5)) return false;
        if (n.lesser(49)) return true;
        // we don't know if it's prime: let the other functions figure it out
    }

    function millerRabinTest(n, a) {
        var nPrev = n.prev(),
            b = nPrev,
            r = 0,
            d, i, x;
        while (b.isEven()) b = b.divide(2), r++;
        next: for (i = 0; i < a.length; i++) {
            if (n.lesser(a[i])) continue;
            x = bigInt(a[i]).modPow(b, n);
            if (x.isUnit() || x.equals(nPrev)) continue;
            for (d = r - 1; d != 0; d--) {
                x = x.square().mod(n);
                if (x.isUnit()) return false;
                if (x.equals(nPrev)) continue next;
            }
            return false;
        }
        return true;
    }

    // Set "strict" to true to force GRH-supported lower bound of 2*log(N)^2
    BigInteger.prototype.isPrime = function (strict) {
        var isPrime = isBasicPrime(this);
        if (isPrime !== undefined) return isPrime;
        var n = this.abs();
        var bits = n.bitLength();
        if (bits <= 64)
            return millerRabinTest(n, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]);
        var logN = Math.log(2) * bits.toJSNumber();
        var t = Math.ceil((strict === true) ? (2 * Math.pow(logN, 2)) : logN);
        for (var a = [], i = 0; i < t; i++) {
            a.push(bigInt(i + 2));
        }
        return millerRabinTest(n, a);
    };
    NativeBigInt.prototype.isPrime = SmallInteger.prototype.isPrime = BigInteger.prototype.isPrime;

    BigInteger.prototype.isProbablePrime = function (iterations) {
        var isPrime = isBasicPrime(this);
        if (isPrime !== undefined) return isPrime;
        var n = this.abs();
        var t = iterations === undefined ? 5 : iterations;
        for (var a = [], i = 0; i < t; i++) {
            a.push(bigInt.randBetween(2, n.minus(2)));
        }
        return millerRabinTest(n, a);
    };
    NativeBigInt.prototype.isProbablePrime = SmallInteger.prototype.isProbablePrime = BigInteger.prototype.isProbablePrime;

    BigInteger.prototype.modInv = function (n) {
        var t = bigInt.zero, newT = bigInt.one, r = parseValue(n), newR = this.abs(), q, lastT, lastR;
        while (!newR.isZero()) {
            q = r.divide(newR);
            lastT = t;
            lastR = r;
            t = newT;
            r = newR;
            newT = lastT.subtract(q.multiply(newT));
            newR = lastR.subtract(q.multiply(newR));
        }
        if (!r.isUnit()) throw new Error(this.toString() + " and " + n.toString() + " are not co-prime");
        if (t.compare(0) === -1) {
            t = t.add(n);
        }
        if (this.isNegative()) {
            return t.negate();
        }
        return t;
    };

    NativeBigInt.prototype.modInv = SmallInteger.prototype.modInv = BigInteger.prototype.modInv;

    BigInteger.prototype.next = function () {
        var value = this.value;
        if (this.sign) {
            return subtractSmall(value, 1, this.sign);
        }
        return new BigInteger(addSmall(value, 1), this.sign);
    };
    SmallInteger.prototype.next = function () {
        var value = this.value;
        if (value + 1 < MAX_INT) return new SmallInteger(value + 1);
        return new BigInteger(MAX_INT_ARR, false);
    };
    NativeBigInt.prototype.next = function () {
        return new NativeBigInt(this.value + BigInt(1));
    };

    BigInteger.prototype.prev = function () {
        var value = this.value;
        if (this.sign) {
            return new BigInteger(addSmall(value, 1), true);
        }
        return subtractSmall(value, 1, this.sign);
    };
    SmallInteger.prototype.prev = function () {
        var value = this.value;
        if (value - 1 > -MAX_INT) return new SmallInteger(value - 1);
        return new BigInteger(MAX_INT_ARR, true);
    };
    NativeBigInt.prototype.prev = function () {
        return new NativeBigInt(this.value - BigInt(1));
    };

    var powersOfTwo = [1];
    while (2 * powersOfTwo[powersOfTwo.length - 1] <= BASE) powersOfTwo.push(2 * powersOfTwo[powersOfTwo.length - 1]);
    var powers2Length = powersOfTwo.length, highestPower2 = powersOfTwo[powers2Length - 1];

    function shift_isSmall(n) {
        return Math.abs(n) <= BASE;
    }

    BigInteger.prototype.shiftLeft = function (v) {
        var n = parseValue(v).toJSNumber();
        if (!shift_isSmall(n)) {
            throw new Error(String(n) + " is too large for shifting.");
        }
        if (n < 0) return this.shiftRight(-n);
        var result = this;
        if (result.isZero()) return result;
        while (n >= powers2Length) {
            result = result.multiply(highestPower2);
            n -= powers2Length - 1;
        }
        return result.multiply(powersOfTwo[n]);
    };
    NativeBigInt.prototype.shiftLeft = SmallInteger.prototype.shiftLeft = BigInteger.prototype.shiftLeft;

    BigInteger.prototype.shiftRight = function (v) {
        var remQuo;
        var n = parseValue(v).toJSNumber();
        if (!shift_isSmall(n)) {
            throw new Error(String(n) + " is too large for shifting.");
        }
        if (n < 0) return this.shiftLeft(-n);
        var result = this;
        while (n >= powers2Length) {
            if (result.isZero() || (result.isNegative() && result.isUnit())) return result;
            remQuo = divModAny(result, highestPower2);
            result = remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
            n -= powers2Length - 1;
        }
        remQuo = divModAny(result, powersOfTwo[n]);
        return remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
    };
    NativeBigInt.prototype.shiftRight = SmallInteger.prototype.shiftRight = BigInteger.prototype.shiftRight;

    function bitwise(x, y, fn) {
        y = parseValue(y);
        var xSign = x.isNegative(), ySign = y.isNegative();
        var xRem = xSign ? x.not() : x,
            yRem = ySign ? y.not() : y;
        var xDigit = 0, yDigit = 0;
        var xDivMod = null, yDivMod = null;
        var result = [];
        while (!xRem.isZero() || !yRem.isZero()) {
            xDivMod = divModAny(xRem, highestPower2);
            xDigit = xDivMod[1].toJSNumber();
            if (xSign) {
                xDigit = highestPower2 - 1 - xDigit; // two's complement for negative numbers
            }

            yDivMod = divModAny(yRem, highestPower2);
            yDigit = yDivMod[1].toJSNumber();
            if (ySign) {
                yDigit = highestPower2 - 1 - yDigit; // two's complement for negative numbers
            }

            xRem = xDivMod[0];
            yRem = yDivMod[0];
            result.push(fn(xDigit, yDigit));
        }
        var sum = fn(xSign ? 1 : 0, ySign ? 1 : 0) !== 0 ? bigInt(-1) : bigInt(0);
        for (var i = result.length - 1; i >= 0; i -= 1) {
            sum = sum.multiply(highestPower2).add(bigInt(result[i]));
        }
        return sum;
    }

    BigInteger.prototype.not = function () {
        return this.negate().prev();
    };
    NativeBigInt.prototype.not = SmallInteger.prototype.not = BigInteger.prototype.not;

    BigInteger.prototype.and = function (n) {
        return bitwise(this, n, function (a, b) { return a & b; });
    };
    NativeBigInt.prototype.and = SmallInteger.prototype.and = BigInteger.prototype.and;

    BigInteger.prototype.or = function (n) {
        return bitwise(this, n, function (a, b) { return a | b; });
    };
    NativeBigInt.prototype.or = SmallInteger.prototype.or = BigInteger.prototype.or;

    BigInteger.prototype.xor = function (n) {
        return bitwise(this, n, function (a, b) { return a ^ b; });
    };
    NativeBigInt.prototype.xor = SmallInteger.prototype.xor = BigInteger.prototype.xor;

    var LOBMASK_I = 1 << 30, LOBMASK_BI = (BASE & -BASE) * (BASE & -BASE) | LOBMASK_I;
    function roughLOB(n) { // get lowestOneBit (rough)
        // SmallInteger: return Min(lowestOneBit(n), 1 << 30)
        // BigInteger: return Min(lowestOneBit(n), 1 << 14) [BASE=1e7]
        var v = n.value,
            x = typeof v === "number" ? v | LOBMASK_I :
                typeof v === "bigint" ? v | BigInt(LOBMASK_I) :
                    v[0] + v[1] * BASE | LOBMASK_BI;
        return x & -x;
    }

    function integerLogarithm(value, base) {
        if (base.compareTo(value) <= 0) {
            var tmp = integerLogarithm(value, base.square(base));
            var p = tmp.p;
            var e = tmp.e;
            var t = p.multiply(base);
            return t.compareTo(value) <= 0 ? { p: t, e: e * 2 + 1 } : { p: p, e: e * 2 };
        }
        return { p: bigInt(1), e: 0 };
    }

    BigInteger.prototype.bitLength = function () {
        var n = this;
        if (n.compareTo(bigInt(0)) < 0) {
            n = n.negate().subtract(bigInt(1));
        }
        if (n.compareTo(bigInt(0)) === 0) {
            return bigInt(0);
        }
        return bigInt(integerLogarithm(n, bigInt(2)).e).add(bigInt(1));
    };
    NativeBigInt.prototype.bitLength = SmallInteger.prototype.bitLength = BigInteger.prototype.bitLength;

    function max(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        return a.greater(b) ? a : b;
    }
    function min(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        return a.lesser(b) ? a : b;
    }
    function gcd(a, b) {
        a = parseValue(a).abs();
        b = parseValue(b).abs();
        if (a.equals(b)) return a;
        if (a.isZero()) return b;
        if (b.isZero()) return a;
        var c = Integer[1], d, t;
        while (a.isEven() && b.isEven()) {
            d = min(roughLOB(a), roughLOB(b));
            a = a.divide(d);
            b = b.divide(d);
            c = c.multiply(d);
        }
        while (a.isEven()) {
            a = a.divide(roughLOB(a));
        }
        do {
            while (b.isEven()) {
                b = b.divide(roughLOB(b));
            }
            if (a.greater(b)) {
                t = b; b = a; a = t;
            }
            b = b.subtract(a);
        } while (!b.isZero());
        return c.isUnit() ? a : a.multiply(c);
    }
    function lcm(a, b) {
        a = parseValue(a).abs();
        b = parseValue(b).abs();
        return a.divide(gcd(a, b)).multiply(b);
    }
    function randBetween(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        var low = min(a, b), high = max(a, b);
        var range = high.subtract(low).add(1);
        if (range.isSmall) return low.add(Math.floor(Math.random() * range));
        var digits = toBase(range, BASE).value;
        var result = [], restricted = true;
        for (var i = 0; i < digits.length; i++) {
            var top = restricted ? digits[i] : BASE;
            var digit = truncate(Math.random() * top);
            result.push(digit);
            if (digit < top) restricted = false;
        }
        return low.add(Integer.fromArray(result, BASE, false));
    }

    var parseBase = function (text, base, alphabet, caseSensitive) {
        alphabet = alphabet || DEFAULT_ALPHABET;
        text = String(text);
        if (!caseSensitive) {
            text = text.toLowerCase();
            alphabet = alphabet.toLowerCase();
        }
        var length = text.length;
        var i;
        var absBase = Math.abs(base);
        var alphabetValues = {};
        for (i = 0; i < alphabet.length; i++) {
            alphabetValues[alphabet[i]] = i;
        }
        for (i = 0; i < length; i++) {
            var c = text[i];
            if (c === "-") continue;
            if (c in alphabetValues) {
                if (alphabetValues[c] >= absBase) {
                    if (c === "1" && absBase === 1) continue;
                    throw new Error(c + " is not a valid digit in base " + base + ".");
                }
            }
        }
        base = parseValue(base);
        var digits = [];
        var isNegative = text[0] === "-";
        for (i = isNegative ? 1 : 0; i < text.length; i++) {
            var c = text[i];
            if (c in alphabetValues) digits.push(parseValue(alphabetValues[c]));
            else if (c === "<") {
                var start = i;
                do { i++; } while (text[i] !== ">" && i < text.length);
                digits.push(parseValue(text.slice(start + 1, i)));
            }
            else throw new Error(c + " is not a valid character");
        }
        return parseBaseFromArray(digits, base, isNegative);
    };

    function parseBaseFromArray(digits, base, isNegative) {
        var val = Integer[0], pow = Integer[1], i;
        for (i = digits.length - 1; i >= 0; i--) {
            val = val.add(digits[i].times(pow));
            pow = pow.times(base);
        }
        return isNegative ? val.negate() : val;
    }

    function stringify(digit, alphabet) {
        alphabet = alphabet || DEFAULT_ALPHABET;
        if (digit < alphabet.length) {
            return alphabet[digit];
        }
        return "<" + digit + ">";
    }

    function toBase(n, base) {
        base = bigInt(base);
        if (base.isZero()) {
            if (n.isZero()) return { value: [0], isNegative: false };
            throw new Error("Cannot convert nonzero numbers to base 0.");
        }
        if (base.equals(-1)) {
            if (n.isZero()) return { value: [0], isNegative: false };
            if (n.isNegative())
                return {
                    value: [].concat.apply([], Array.apply(null, Array(-n.toJSNumber()))
                        .map(Array.prototype.valueOf, [1, 0])
                    ),
                    isNegative: false
                };

            var arr = Array.apply(null, Array(n.toJSNumber() - 1))
                .map(Array.prototype.valueOf, [0, 1]);
            arr.unshift([1]);
            return {
                value: [].concat.apply([], arr),
                isNegative: false
            };
        }

        var neg = false;
        if (n.isNegative() && base.isPositive()) {
            neg = true;
            n = n.abs();
        }
        if (base.isUnit()) {
            if (n.isZero()) return { value: [0], isNegative: false };

            return {
                value: Array.apply(null, Array(n.toJSNumber()))
                    .map(Number.prototype.valueOf, 1),
                isNegative: neg
            };
        }
        var out = [];
        var left = n, divmod;
        while (left.isNegative() || left.compareAbs(base) >= 0) {
            divmod = left.divmod(base);
            left = divmod.quotient;
            var digit = divmod.remainder;
            if (digit.isNegative()) {
                digit = base.minus(digit).abs();
                left = left.next();
            }
            out.push(digit.toJSNumber());
        }
        out.push(left.toJSNumber());
        return { value: out.reverse(), isNegative: neg };
    }

    function toBaseString(n, base, alphabet) {
        var arr = toBase(n, base);
        return (arr.isNegative ? "-" : "") + arr.value.map(function (x) {
            return stringify(x, alphabet);
        }).join('');
    }

    BigInteger.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    SmallInteger.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    NativeBigInt.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    BigInteger.prototype.toString = function (radix, alphabet) {
        if (radix === undefined) radix = 10;
        if (radix !== 10) return toBaseString(this, radix, alphabet);
        var v = this.value, l = v.length, str = String(v[--l]), zeros = "0000000", digit;
        while (--l >= 0) {
            digit = String(v[l]);
            str += zeros.slice(digit.length) + digit;
        }
        var sign = this.sign ? "-" : "";
        return sign + str;
    };

    SmallInteger.prototype.toString = function (radix, alphabet) {
        if (radix === undefined) radix = 10;
        if (radix != 10) return toBaseString(this, radix, alphabet);
        return String(this.value);
    };

    NativeBigInt.prototype.toString = SmallInteger.prototype.toString;

    NativeBigInt.prototype.toJSON = BigInteger.prototype.toJSON = SmallInteger.prototype.toJSON = function () { return this.toString(); };

    BigInteger.prototype.valueOf = function () {
        return parseInt(this.toString(), 10);
    };
    BigInteger.prototype.toJSNumber = BigInteger.prototype.valueOf;

    SmallInteger.prototype.valueOf = function () {
        return this.value;
    };
    SmallInteger.prototype.toJSNumber = SmallInteger.prototype.valueOf;
    NativeBigInt.prototype.valueOf = NativeBigInt.prototype.toJSNumber = function () {
        return parseInt(this.toString(), 10);
    };

    function parseStringValue(v) {
        if (isPrecise(+v)) {
            var x = +v;
            if (x === truncate(x))
                return supportsNativeBigInt ? new NativeBigInt(BigInt(x)) : new SmallInteger(x);
            throw new Error("Invalid integer: " + v);
        }
        var sign = v[0] === "-";
        if (sign) v = v.slice(1);
        var split = v.split(/e/i);
        if (split.length > 2) throw new Error("Invalid integer: " + split.join("e"));
        if (split.length === 2) {
            var exp = split[1];
            if (exp[0] === "+") exp = exp.slice(1);
            exp = +exp;
            if (exp !== truncate(exp) || !isPrecise(exp)) throw new Error("Invalid integer: " + exp + " is not a valid exponent.");
            var text = split[0];
            var decimalPlace = text.indexOf(".");
            if (decimalPlace >= 0) {
                exp -= text.length - decimalPlace - 1;
                text = text.slice(0, decimalPlace) + text.slice(decimalPlace + 1);
            }
            if (exp < 0) throw new Error("Cannot include negative exponent part for integers");
            text += (new Array(exp + 1)).join("0");
            v = text;
        }
        var isValid = /^([0-9][0-9]*)$/.test(v);
        if (!isValid) throw new Error("Invalid integer: " + v);
        if (supportsNativeBigInt) {
            return new NativeBigInt(BigInt(sign ? "-" + v : v));
        }
        var r = [], max = v.length, l = LOG_BASE, min = max - l;
        while (max > 0) {
            r.push(+v.slice(min, max));
            min -= l;
            if (min < 0) min = 0;
            max -= l;
        }
        trim(r);
        return new BigInteger(r, sign);
    }

    function parseNumberValue(v) {
        if (supportsNativeBigInt) {
            return new NativeBigInt(BigInt(v));
        }
        if (isPrecise(v)) {
            if (v !== truncate(v)) throw new Error(v + " is not an integer.");
            return new SmallInteger(v);
        }
        return parseStringValue(v.toString());
    }

    function parseValue(v) {
        if (typeof v === "number") {
            return parseNumberValue(v);
        }
        if (typeof v === "string") {
            return parseStringValue(v);
        }
        if (typeof v === "bigint") {
            return new NativeBigInt(v);
        }
        return v;
    }
    // Pre-define numbers in range [-999,999]
    for (var i = 0; i < 1000; i++) {
        Integer[i] = parseValue(i);
        if (i > 0) Integer[-i] = parseValue(-i);
    }
    // Backwards compatibility
    Integer.one = Integer[1];
    Integer.zero = Integer[0];
    Integer.minusOne = Integer[-1];
    Integer.max = max;
    Integer.min = min;
    Integer.gcd = gcd;
    Integer.lcm = lcm;
    Integer.isInstance = function (x) { return x instanceof BigInteger || x instanceof SmallInteger || x instanceof NativeBigInt; };
    Integer.randBetween = randBetween;

    Integer.fromArray = function (digits, base, isNegative) {
        return parseBaseFromArray(digits.map(parseValue), parseValue(base || 10), isNegative);
    };

    return Integer;
})();

// Node.js check
if (module.hasOwnProperty("exports")) {
    module.exports = bigInt;
}
});

let currentRaf = undefined;

const forceOutputFrame = () => {
  WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.FORCE_OUTPUT_FRAME
  });
  WasmBoyGraphics.renderFrame();
};

const saveCurrentAudioBufferToWav = () => {
  if (!WasmBoyAudio.audioBuffer) {
    return;
  }

  const wav = index(WasmBoyAudio.audioBuffer);
  const blob = new window.Blob([new DataView(wav)], {
    type: 'audio/wav'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  document.body.appendChild(anchor);
  anchor.style = 'display: none';
  anchor.href = url;
  anchor.download = 'audio.wav';
  anchor.click();
  window.URL.revokeObjectURL(url);
};
const runNumberOfFrames = async frames => {
  await WasmBoyLib.pause(); // Set up a raf function to continually update the canvas

  const rafUpdateCanvas = () => {
    currentRaf = raf_1(() => {
      if (currentRaf) {
        forceOutputFrame();
        rafUpdateCanvas();
      }
    });
  };

  rafUpdateCanvas();

  for (let i = 0; i < frames; i++) {
    await runWasmExport('executeFrame', []);
  }

  currentRaf = undefined;
  forceOutputFrame();
};
const playUntilBreakpoint = async breakpoint => {
  await WasmBoyLib.play(breakpoint);
  const message = await waitForLibWorkerMessageType(WORKER_MESSAGE_TYPE.BREAKPOINT);
  await WasmBoyLib.pause();
};
const runWasmExport = async (exportKey, parameters) => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.RUN_WASM_EXPORT,
    export: exportKey,
    parameters
  });
  const eventData = getEventData(event);
  return eventData.message.response;
};
const getWasmMemorySection = async (start, end) => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.GET_WASM_MEMORY_SECTION,
    start,
    end
  });
  const eventData = getEventData(event);
  return new Uint8Array(eventData.message.response);
};
const getWasmConstant = async constantKey => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.GET_WASM_CONSTANT,
    constant: constantKey
  });
  const eventData = getEventData(event);
  return eventData.message.response;
};
const getStepsAsString = async radix => {
  const stepsPerStepSet = await runWasmExport('getStepsPerStepSet');
  const stepSets = await runWasmExport('getStepSets');
  const steps = await runWasmExport('getSteps');
  const bigSteps = BigInteger(stepsPerStepSet).multiply(stepSets).add(steps);

  if (radix) {
    return bigSteps.toString(radix);
  }

  return bigSteps.toString(10);
};
const getCyclesAsString = async radix => {
  const cyclesPerCycleSet = await runWasmExport('getCyclesPerCycleSet');
  const cycleSets = await runWasmExport('getCycleSets');
  const cycles = await runWasmExport('getCycles');
  const bigCycles = BigInteger(cyclesPerCycleSet).multiply(cycleSets).add(cycles);

  if (radix) {
    return bigCycles.toString(radix);
  }

  return bigCycles.toString(10);
};

// Functions here are depedent on WasmBoyMemory state.
const messageRequests = {};
function waitForLibWorkerMessageType(messageType) {
  if (!messageRequests[messageType]) {
    messageRequests[messageType] = [];
  }

  const promise = new Promise(resolve => {
    messageRequests[messageType].push(resolve);
  });
  return promise;
} // Functions to handle the lib worker messages

function libWorkerOnMessage(event) {
  const eventData = getEventData(event);

  if (!eventData.message) {
    return;
  }

  if (messageRequests[eventData.message.type]) {
    messageRequests[eventData.message.type].forEach(request => request(eventData.message));
  }

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.UPDATED:
      {
        this.fps = eventData.message.fps;
        return;
      }

    case WORKER_MESSAGE_TYPE.CRASHED:
      {
        const crashedTask = async () => {
          await this.pause();
          console.log('Wasmboy Crashed!');
          let programCounter = await runWasmExport('getProgramCounter');
          let gameboyMemoryConstant = await getWasmConstant('GAMEBOY_INTERNAL_MEMORY_LOCATION');
          let opcode = await getWasmMemorySection(gameboyMemoryConstant + programCounter, gameboyMemoryConstant + programCounter + 1);
          console.log(`Program Counter: 0x${programCounter.toString(16)}`);
          console.log(`Opcode: 0x${opcode[0].toString(16)}`);
        };

        crashedTask();
        return;
      }

    default:

  }
}

// WasmBoy Modules

class WasmBoyLibService {
  // Start the request to our wasm module
  constructor() {
    this.worker = undefined;
    this.coreType = undefined;
    this.canvasElement = undefined;
    this.paused = false;
    this.ready = false;
    this.loadedAndStarted = false;
    this.renderId = false;
    this.loadedROM = false;
    this.fps = 0; // Reset our config and stateful elements that depend on it
    // this.options is set here

    this._resetConfig(); // Add some listeners for when we are put into the background


    if (typeof window !== 'undefined') {
      window.document.addEventListener('visibilitychange', () => {
        // fires when user switches tabs, apps, goes to homescreen, etc.
        if (document.visibilityState === 'hidden') {
          if (this.options && this.options.disablePauseOnHidden) {
            return;
          }

          this.pause();
        }
      });
    }
  } // Function to initialize/configure Wasmboy


  config(wasmBoyOptions, canvasElement) {
    const configTask = async () => {
      // Pause any currently running game
      await this.pause(); // Get our canvas elements

      await this.setCanvas(canvasElement); // Reset our config and stateful elements that depend on it
      // If we have a new config to take its place

      if (wasmBoyOptions || !this.options) {
        this._resetConfig();
      } // set our options


      if (wasmBoyOptions) {
        // Set all options
        Object.keys(wasmBoyOptions).forEach(key => {
          if (this.options[key] !== undefined) {
            this.options[key] = wasmBoyOptions[key];
          }
        }); // Aliases
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
  } // Function to return our current configuration as an object


  getConfig() {
    return this.options;
  } // Function to get/set our canvas element
  // Useful for vaporboy


  setCanvas(canvasElement) {
    if (!canvasElement) {
      return Promise.resolve();
    }

    const setCanvasTask = async () => {
      await this.pause(); // Set our new canvas element, and re-run init on graphics to apply styles and things

      this.canvasElement = canvasElement;
      await WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback);
    };

    return setCanvasTask();
  }

  getCanvas() {
    return this.canvasElement;
  } // Finish request for wasm module, and fetch game


  loadROM(ROM, fetchHeaders) {
    const boundLoadROM = loadROMToWasmBoy.bind(this);
    return boundLoadROM(ROM, fetchHeaders);
  } // Function to start/resume


  play(optionalBreakpoint) {
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
      } // Bless the audio, this is to fix any autoplay issues


      if (!this.options.headless) {
        WasmBoyAudio.resumeAudioContext();
        WasmBoyAudio.resetTimeStretch();
      } // Reset the audio queue index to stop weird pauses when trying to load a game


      await this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.RESET_AUDIO_QUEUE
      }); // Undo any pause

      this.paused = false;

      if (!this.updateId) {
        if (optionalBreakpoint) {
          await this.worker.postMessage({
            type: WORKER_MESSAGE_TYPE.PLAY_UNTIL_BREAKPOINT,
            breakpoint: optionalBreakpoint
          });
        } else {
          await this.worker.postMessage({
            type: WORKER_MESSAGE_TYPE.PLAY
          });
        }
      }

      if (!this.renderId && !this.options.headless) {
        this.renderId = raf_1(() => {
          render.call(this);
        });
      }
    };

    return playTask();
  } // Function to pause the game, returns a promise
  // Will try to wait until the emulation sync is returned, and then will
  // Allow any actions


  pause() {
    const pauseTask = async () => {
      this.paused = true;

      if (this.ready && this.options.onPause) {
        this.options.onPause();
      } // Cancel our update and render loop


      raf_1.cancel(this.renderId);
      this.renderId = false; // Cancel any playing audio
      // Audio played with latency may be still going on here

      if (!this.options.headless) {
        WasmBoyAudio.cancelAllAudio(true);
      }

      if (this.worker) {
        await this.worker.postMessage({
          type: WORKER_MESSAGE_TYPE.PAUSE
        });
      } // Wait a raf to ensure everything is done


      await new Promise(resolve => {
        raf_1(() => {
          resolve();
        });
      });
    };

    return pauseTask();
  } // Function to reset wasmBoy, with an optional set of options


  reset(wasmBoyOptions) {
    const resetTask = async () => {
      this.config(wasmBoyOptions, this.canvasElement); // Reload the game if one was already loaded

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
  } // Function to return the save states for the game


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
  } // Simply returns the FPS we get back from the lib worker


  getFPS() {
    return this.fps;
  } // Simply returns our current Core Type


  getCoreType() {
    return this.coreType;
  } // Private Function to reset options to default


  _resetConfig() {
    // Reset Fps Metering
    this.fpsTimeStamps = [];
    this.frameSkipCounter = 0; // Configurable Options
    // Set callbacks to null and not undefined,
    // For when configs are passed, we will be sure to
    // add them as keys

    this.options = {
      headless: false,
      disablePauseOnHidden: false,
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
      updateGraphicsCallback: null,
      updateAudioCallback: null,
      saveStateCallback: null,
      onReady: null,
      onPlay: null,
      onPause: null,
      onLoadedAndStarted: null
    };
  } // Function to instantiate and set up our workers
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

const WasmBoyLib = new WasmBoyLibService();

var name = "wasmboy";
var description = "Gameboy / Gameboy Color Emulator written for Web Assembly using AssemblyScript. Shell/Debugger in Preact";
var keywords = [
	"web-assembly",
	"webassembly",
	"gameboy",
	"emulator",
	"emulation",
	"assemblyscript",
	"gameboy-color"
];
var author = "Aaron Turner";
var version = "0.3.4";
var license = "Apache-2.0";
var homepage = "https://wasmboy.app";
var repository = {
	type: "git",
	url: "git+https://github.com/torch2424/wasmBoy.git"
};
var bugs = {
	url: "https://github.com/torch2424/wasmBoy/issues"
};
var main = "dist/wasmboy.wasm.cjs.js";
var module$1 = "dist/wasmboy.wasm.esm.js";
var browser = "dist/wasmboy.wasm.umd.js";
var iife = "dist/wasmboy.wasm.iife.js";
var scripts = {
	prepare: "npx run-s core:build lib:build",
	start: "npx concurrently --kill-others --names \"DEBUGGER,CORE,LIB\" -c \"bgBlue.bold,bgMagenta.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run core:watch\" \"npm run lib:watch:wasm\"",
	"start:ts": "npx concurrently --kill-others --names \"DEBUGGER,LIBANDCORETS\" -c \"bgBlue.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run lib:watch:ts\"",
	dev: "npm run start",
	watch: "npm run start",
	"dev:ts": "npm run start:ts",
	"watch:ts": "npm run start:ts",
	build: "npx run-s core:build lib:build:wasm",
	deploy: "npx run-s lib:deploy demo:deploy",
	prettier: "npm run prettier:lint:fix",
	"prettier:lint": "npx run-s prettier:lint:message prettier:lint:list",
	"prettier:lint:message": "echo \"Listing unlinted files, will show nothing if everything is fine.\"",
	"prettier:lint:list": "npx prettier --config .prettierrc --list-different rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
	"prettier:lint:fix": "npx prettier --config .prettierrc --write rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
	precommit: "npx pretty-quick --staged",
	"core:watch": "npx watch \"npm run core:build\" core",
	"core:build": "npx run-s core:build:asc core:build:dist core:build:done",
	"core:build:asc": "npx asc core/index.ts -b dist/core/core.untouched.wasm -t dist/core/core.untouched.wast -O3 --validate --sourceMap core/dist/core.untouched.wasm.map --memoryBase 0",
	"core:build:asc:measure": "npm run core:build:asc -- --measure --noEmit",
	"core:build:ts:measure": "npx tsc --project core/tsconfig.json --noEmit --extendedDiagnostics",
	"core:build:dist": "npx run-s core:build:dist:mkdir core:build:dist:cp",
	"core:build:dist:mkdir": "mkdir -p build/assets",
	"core:build:dist:cp": "cp dist/core/*.untouched.* build/assets",
	"core:build:done": "echo \"Built Core!\"",
	"lib:build": "npx run-s lib:build:wasm lib:build:ts lib:build:ts:getcoreclosure",
	"lib:watch:wasm": "npx rollup -c -w --environment WASM",
	"lib:build:wasm": "npx rollup -c --environment PROD,WASM",
	"lib:watch:ts": "npx rollup -c -w --environment TS",
	"lib:build:ts": "npx rollup -c --environment PROD,TS",
	"lib:build:ts:esnext": "npx rollup -c --environment PROD,TS,ES_NEXT",
	"lib:build:ts:getcoreclosure": "npx rollup -c --environment PROD,TS,GET_CORE_CLOSURE",
	"lib:deploy": "npx run-s core:build lib:build:wasm lib:build:ts lib:deploy:np",
	"lib:deploy:np": "npx np",
	test: "npm run test:accuracy",
	"test:accuracy": "npx run-s build test:accuracy:nobuild",
	"test:accuracy:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/accuracy/accuracy-test.js --exit",
	"test:perf": "npm run test:performance",
	"test:performance": "npx run-s build test:performance:nobuild",
	"test:performance:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/performance/performance-test.js --exit",
	"debugger:dev": "npm run debugger:watch",
	"debugger:watch": "npx rollup -c -w --environment DEBUGGER,SERVE",
	"debugger:build": "npx rollup -c --environment DEBUGGER",
	"benchmark:build": "npx rollup -c --environment PROD,TS,BENCHMARK",
	"benchmark:build:skiplib": "npx rollup -c --environment PROD,TS,BENCHMARK,SKIP_LIB",
	"benchmark:dev": "npm run benchmark:watch",
	"benchmark:watch": "npx rollup -c -w --environment TS,BENCHMARK,SERVE",
	"amp:build": "npx rollup -c --environment PROD,TS,AMP",
	"amp:build:skiplib": "npx rollup -c --environment PROD,TS,AMP,SKIP_LIB",
	"amp:dev": "npm run amp:watch",
	"amp:watch": "npx rollup -c -w --environment TS,AMP,SERVE",
	"demo:build": "npx run-s core:build lib:build demo:build:apps",
	"demo:build:apps": "npx run-s debugger:build benchmark:build:skiplib amp:build:skiplib",
	"demo:cname": "echo 'wasmboy.app' > build/CNAME",
	"demo:dist": "cp -r dist/ build/dist",
	"demo:gh-pages": "npx gh-pages -d build",
	"demo:deploy": "npx run-s demo:build demo:dist demo:cname demo:gh-pages"
};
var files = [
	"dist",
	"README.md",
	"LICENSE"
];
var dependencies = {
	"audiobuffer-to-wav": "git+https://github.com/torch2424/audiobuffer-to-wav.git#es-module-rollup",
	idb: "^2.1.3",
	raf: "^3.4.0",
	"responsive-gamepad": "1.1.0"
};
var devDependencies = {
	"@ampproject/rollup-plugin-closure-compiler": "^0.7.2",
	"@babel/core": "^7.1.2",
	"@babel/plugin-proposal-class-properties": "^7.1.0",
	"@babel/plugin-proposal-export-default-from": "^7.2.0",
	"@babel/plugin-proposal-object-rest-spread": "^7.0.0",
	"@babel/plugin-transform-react-jsx": "^7.0.0",
	"@phosphor/commands": "^1.6.1",
	"@phosphor/default-theme": "^0.1.0",
	"@phosphor/messaging": "^1.2.2",
	"@phosphor/widgets": "^1.6.0",
	assemblyscript: "github:AssemblyScript/assemblyscript",
	"babel-plugin-filter-imports": "^2.0.3",
	"babel-preset-env": "^1.6.1",
	"big-integer": "^1.6.38",
	"browser-detect": "^0.2.28",
	bulma: "^0.7.1",
	"chart.js": "^2.7.3",
	"chartjs-plugin-downsample": "^1.0.2",
	chota: "^0.5.2",
	concurrently: "^3.5.1",
	"devtools-detect": "^2.2.0",
	"gb-instructions-opcodes": "0.0.4",
	"gh-pages": "^1.1.0",
	husky: "^1.0.0-rc.8",
	"load-script": "^1.0.0",
	"markdown-table": "^1.1.1",
	microseconds: "^0.1.0",
	mocha: "^5.0.1",
	"normalize.css": "^8.0.1",
	np: "^3.1.0",
	"npm-run-all": "^4.1.5",
	"performance-now": "^2.1.0",
	"pngjs-image": "^0.11.7",
	"postcss-import": "^12.0.1",
	preact: "^8.2.1",
	"preact-compat": "^3.17.0",
	"preact-portal": "^1.1.3",
	"preact-virtual-list": "^0.3.1",
	prettier: "^1.12.1",
	"pretty-quick": "^1.6.0",
	pubx: "0.0.3",
	"recursive-readdir-sync": "^1.0.6",
	rollup: "^0.66.1",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-bundle-size": "^1.0.2",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-copy-glob": "^0.2.2",
	"rollup-plugin-delete": "^0.1.2",
	"rollup-plugin-hash": "^1.3.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-postcss": "^1.6.2",
	"rollup-plugin-replace": "^2.1.0",
	"rollup-plugin-serve": "^0.6.0",
	"rollup-plugin-typescript": "^1.0.0",
	"rollup-plugin-url": "^2.1.0",
	"source-map-loader": "^0.2.4",
	"stats-lite": "^2.2.0",
	traverse: "^0.6.6",
	tslib: "^1.9.3",
	typescript: "^3.1.3",
	"uglifyjs-webpack-plugin": "^1.2.3",
	"url-loader": "^1.0.1",
	valoo: "^2.1.0",
	watch: "^1.0.2",
	"webpack-dev-server": "^3.1.10"
};
var packageJson = {
	name: name,
	description: description,
	keywords: keywords,
	author: author,
	version: version,
	license: license,
	homepage: homepage,
	repository: repository,
	bugs: bugs,
	main: main,
	module: module$1,
	browser: browser,
	iife: iife,
	scripts: scripts,
	files: files,
	dependencies: dependencies,
	devDependencies: devDependencies
};

// Build our public lib api
// export an object that public exposes parts of the singleton
// Need to bind to preserve this
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_objects/Function/bind

const WasmBoy = {
  config: WasmBoyLib.config.bind(WasmBoyLib),
  getCoreType: WasmBoyLib.getCoreType.bind(WasmBoyLib),
  getConfig: WasmBoyLib.getConfig.bind(WasmBoyLib),
  setCanvas: WasmBoyLib.setCanvas.bind(WasmBoyLib),
  getCanvas: WasmBoyLib.getCanvas.bind(WasmBoyLib),
  loadROM: WasmBoyLib.loadROM.bind(WasmBoyLib),
  play: WasmBoyLib.play.bind(WasmBoyLib),
  pause: WasmBoyLib.pause.bind(WasmBoyLib),
  reset: WasmBoyLib.reset.bind(WasmBoyLib),
  isPlaying: () => {
    return !WasmBoyLib.paused;
  },
  isPaused: () => {
    return WasmBoyLib.paused;
  },
  isReady: () => {
    return WasmBoyLib.ready;
  },
  isLoadedAndStarted: () => {
    return WasmBoyLib.loadedAndStarted;
  },
  getVersion: () => {
    return packageJson.version;
  },
  saveState: WasmBoyLib.saveState.bind(WasmBoyLib),
  getSaveStates: WasmBoyLib.getSaveStates.bind(WasmBoyLib),
  loadState: WasmBoyLib.loadState.bind(WasmBoyLib),
  getFPS: WasmBoyLib.getFPS.bind(WasmBoyLib),
  ResponsiveGamepad: WasmBoyController.ResponsiveGamepad,
  enableDefaultJoypad: WasmBoyController.enableDefaultJoypad.bind(WasmBoyController),
  disableDefaultJoypad: WasmBoyController.disableDefaultJoypad.bind(WasmBoyController),
  setJoypadState: WasmBoyController.setJoypadState.bind(WasmBoyController),
  resumeAudioContext: WasmBoyAudio.resumeAudioContext.bind(WasmBoyAudio),
  _getCartridgeInfo: WasmBoyMemory.getCartridgeInfo.bind(WasmBoyMemory),
  _playUntilBreakpoint: playUntilBreakpoint,
  _runNumberOfFrames: runNumberOfFrames,
  _saveCurrentAudioBufferToWav: saveCurrentAudioBufferToWav,
  _runWasmExport: runWasmExport,
  _getWasmMemorySection: getWasmMemorySection,
  _getWasmConstant: getWasmConstant,
  _getStepsAsString: getStepsAsString,
  _getCyclesAsString: getCyclesAsString
};

exports.WasmBoy = WasmBoy;
//# sourceMappingURL=wasmboy.ts.cjs.js.map
