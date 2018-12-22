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
  PAUSE: 'PAUSE',
  UPDATED: 'UPDATED',
  CRASHED: 'CRASHED',
  SET_JOYPAD_STATE: 'SET_JOYPAD_STATE',
  AUDIO_LATENCY: 'AUDIO_LATENCY',
  RUN_WASM_EXPORT: 'RUN_WASM_EXPORT',
  GET_WASM_MEMORY_SECTION: 'GET_WASM_MEMORY_SECTION',
  GET_WASM_CONSTANT: 'GET_WASM_CONSTANT'
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

// Define a keyboard key schema
var keyInputSchema = {
  ID: undefined,
  ACTIVE: false,
  KEY_CODE: undefined

  // Define a gamepad button schema
  // https://w3c.github.io/gamepad/#remapping
};var gamepadInputSchema = {
  ID: undefined,
  ACTIVE: false,
  BUTTON_ID: undefined,
  JOYSTICK: {
    AXIS_ID: undefined,
    IS_POSITIVE: undefined
  }
};

var touchInputSchema = {
  ID: undefined,
  ACTIVE: false,
  ELEMENT: undefined,
  TYPE: undefined,
  DIRECTION: undefined,
  EVENT_HANDLER: undefined,
  BOUNDING_RECT: undefined

  // Define our finaly kerboard schema here
};var keyMapSchema = {
  UP: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  RIGHT: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  DOWN: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  LEFT: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  A: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  B: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  SELECT: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  START: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  }

  // Function to return an ID for our input
  // https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
};function getInputId() {

  var idGenerator = function idGenerator() {
    return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(2, 10);
  };

  var stringId = "" + idGenerator() + idGenerator();
  return stringId.slice();
}

function getKeyInput(keyCode) {
  var input = Object.assign({}, keyInputSchema);
  input.ID = getInputId();
  input.KEY_CODE = keyCode;
  return input;
}

function getGamepadInput(gamepadButtonId, axisId, axisIsPositive) {
  var input = Object.assign({}, gamepadInputSchema);
  input.ID = getInputId();
  input.JOYSTICK = Object.assign({}, gamepadInputSchema.JOYSTICK);
  if (gamepadButtonId || gamepadButtonId === 0) {
    input.BUTTON_ID = gamepadButtonId;
  } else if (axisId !== undefined && axisIsPositive !== undefined) {
    input.JOYSTICK.AXIS_ID = axisId;
    input.JOYSTICK.IS_POSITIVE = axisIsPositive;
  }
  return input;
}

function getTouchInput(element, type, direction, eventHandler) {
  var input = Object.assign({}, touchInputSchema);

  input.ID = getInputId();

  // TODO: Check the type for a valid type

  // Add our passed parameters
  input.ELEMENT = element;
  input.TYPE = type;
  input.DIRECTION = direction;
  input.EVENT_HANDLER = eventHandler;

  // Add our bounding rect
  var boundingRect = input.ELEMENT.getBoundingClientRect();
  input.BOUNDING_RECT = boundingRect;

  // Define our eventListener functions
  var eventListenerCallback = function eventListenerCallback(event) {
    if (input.EVENT_HANDLER) {
      input.EVENT_HANDLER(event);
    }
  };

  // Add event listeners to the element
  input.ELEMENT.addEventListener("touchstart", eventListenerCallback);
  input.ELEMENT.addEventListener("touchmove", eventListenerCallback);
  input.ELEMENT.addEventListener("touchend", eventListenerCallback);
  input.ELEMENT.addEventListener("mousedown", eventListenerCallback);
  input.ELEMENT.addEventListener("mouseup", eventListenerCallback);

  return input;
}

function KeyMapSchema() {
  return Object.assign({}, keyMapSchema);
}

var Key = {

  BACKSPACE: 8,
  TAB: 9,
  RETURN: 13,
  SHIFT: 16,
  CTRL: 17,
  ALT: 18,
  ESCAPE: 27,
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  END: 35,
  HOME: 36,

  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,

  W: 87,
  A: 65,
  S: 83,
  D: 68,
  Q: 81,
  E: 69,
  X: 88,
  Z: 90,

  SEMI_COLON: 186,
  SINGLE_QUOTE: 222,
  BACK_SLASH: 220,

  NUMPAD_0: 96,
  NUMPAD_1: 97,
  NUMPAD_2: 98,
  NUMPAD_3: 99,
  NUMPAD_4: 100,
  NUMPAD_5: 101,
  NUMPAD_6: 102,
  NUMPAD_7: 103,
  NUMPAD_8: 104,
  NUMPAD_9: 105
};

var keymap = KeyMapSchema();

// Up
keymap.UP.KEYBOARD.push(getKeyInput(Key.ARROW_UP));
keymap.UP.KEYBOARD.push(getKeyInput(Key.W));
keymap.UP.KEYBOARD.push(getKeyInput(Key.NUMPAD_8));
keymap.UP.GAMEPAD.push(getGamepadInput(12));
keymap.UP.GAMEPAD.push(getGamepadInput(false, 1, false));
keymap.UP.GAMEPAD.push(getGamepadInput(false, 3, false));

// Right
keymap.RIGHT.KEYBOARD.push(getKeyInput(Key.ARROW_RIGHT));
keymap.RIGHT.KEYBOARD.push(getKeyInput(Key.D));
keymap.RIGHT.KEYBOARD.push(getKeyInput(Key.NUMPAD_6));
keymap.RIGHT.GAMEPAD.push(getGamepadInput(15));
keymap.RIGHT.GAMEPAD.push(getGamepadInput(false, 0, true));
keymap.RIGHT.GAMEPAD.push(getGamepadInput(false, 2, true));

// Down
keymap.DOWN.KEYBOARD.push(getKeyInput(Key.ARROW_DOWN));
keymap.DOWN.KEYBOARD.push(getKeyInput(Key.S));
keymap.DOWN.KEYBOARD.push(getKeyInput(Key.NUMPAD_5));
keymap.DOWN.KEYBOARD.push(getKeyInput(Key.NUMPAD_2));
keymap.DOWN.GAMEPAD.push(getGamepadInput(13));
keymap.DOWN.GAMEPAD.push(getGamepadInput(false, 1, true));
keymap.DOWN.GAMEPAD.push(getGamepadInput(false, 3, true));

// Left
keymap.LEFT.KEYBOARD.push(getKeyInput(Key.ARROW_LEFT));
keymap.LEFT.KEYBOARD.push(getKeyInput(Key.A));
keymap.LEFT.KEYBOARD.push(getKeyInput(Key.NUMPAD_4));
keymap.LEFT.GAMEPAD.push(getGamepadInput(14));
keymap.LEFT.GAMEPAD.push(getGamepadInput(false, 0, false));
keymap.LEFT.GAMEPAD.push(getGamepadInput(false, 2, false));

// A
keymap.A.KEYBOARD.push(getKeyInput(Key.X));
keymap.A.KEYBOARD.push(getKeyInput(Key.SEMI_COLON));
keymap.A.KEYBOARD.push(getKeyInput(Key.NUMPAD_7));
keymap.A.GAMEPAD.push(getGamepadInput(0));
keymap.A.GAMEPAD.push(getGamepadInput(1));

// B
keymap.B.KEYBOARD.push(getKeyInput(Key.Z));
keymap.B.KEYBOARD.push(getKeyInput(Key.ESCAPE));
keymap.B.KEYBOARD.push(getKeyInput(Key.SINGLE_QUOTE));
keymap.B.KEYBOARD.push(getKeyInput(Key.BACKSPACE));
keymap.B.KEYBOARD.push(getKeyInput(Key.NUMPAD_9));
keymap.B.GAMEPAD.push(getGamepadInput(2));
keymap.B.GAMEPAD.push(getGamepadInput(3));

// Start
keymap.START.KEYBOARD.push(getKeyInput(Key.RETURN));
keymap.START.KEYBOARD.push(getKeyInput(Key.SPACE));
keymap.START.KEYBOARD.push(getKeyInput(Key.NUMPAD_3));
keymap.START.GAMEPAD.push(getGamepadInput(9));

// Select
keymap.SELECT.KEYBOARD.push(getKeyInput(Key.SHIFT));
keymap.SELECT.KEYBOARD.push(getKeyInput(Key.TAB));
keymap.SELECT.KEYBOARD.push(getKeyInput(Key.BACK_SLASH));
keymap.SELECT.KEYBOARD.push(getKeyInput(Key.NUMPAD_1));
keymap.SELECT.GAMEPAD.push(getGamepadInput(8));

var KEYMAP = function KEYMAP() {
  return JSON.parse(JSON.stringify(keymap));
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

// HTML Tags that can be focused on, where the library should be disabled
// https://www.w3schools.com/tags/ref_byfunc.asp
var INPUT_HTML_TAGS = ['input', 'textarea', 'button', 'select', 'option', 'optgroup', 'label', 'datalist'];

// Helpers for accessing gamepad
// Similar to: https://github.com/torch2424/picoDeploy/blob/master/src/assets/3pLibs/pico8gamepad/pico8gamepad.js
function getAnalogStickAxis(gamepad, axisId) {
  return gamepad.axes[axisId] || 0.0;
}

function isButtonPressed(gamepad, buttonId) {
  return gamepad.buttons[buttonId] ? gamepad.buttons[buttonId].pressed : false;
}

var ResponsiveGamepadService = function () {
  function ResponsiveGamepadService() {
    classCallCheck(this, ResponsiveGamepadService);

    // Our settings
    this.gamepadAnalogStickDeadZone = 0.25;
    this.keyMapKeys = Object.keys(KeyMapSchema());
    this.keyMap = KEYMAP();
    this.enabled = false;
    this.addedEventListeners = false;
  }

  createClass(ResponsiveGamepadService, [{
    key: 'enable',
    value: function enable(keyMap) {

      // TODO: Verify it is a valid keymap passed
      if (keyMap) {
        this.keyMap = keyMap;
      }

      // Add our key event listeners
      // Wrapping in this for preact prerender
      if (!this.addedEventListeners && typeof window !== "undefined") {
        window.addEventListener('keyup', this.updateKeyboard.bind(this));
        window.addEventListener('keydown', this.updateKeyboard.bind(this));
        // Add a resize listen to update the gamepad rect on resize
        window.addEventListener("resize", this.updateTouchpadRect.bind(this));

        this.addedEventListeners = true;
      }

      this.enabled = true;
    }

    // Disable responsive gamepad, and remove all the listeners

  }, {
    key: 'disable',
    value: function disable() {
      this.keyMap = undefined;

      this.enabled = false;
    }
  }, {
    key: 'isEnabled',
    value: function isEnabled() {
      return this.enabled;
    }
  }, {
    key: 'addTouchInput',
    value: function addTouchInput(keyMapKey, element, type, direction) {
      var _this = this;

      // Declare our touch input
      // TODO: May have to add the event handler after getting the input
      var touchInput = void 0;
      touchInput = getTouchInput(element, type, direction, function (event) {
        _this.updateTouchpad(keyMapKey, touchInput, event);
      });

      // Add the input to our keymap
      this.keyMap[keyMapKey].TOUCHPAD.push(touchInput);

      // Return the touchInput ID so that is may be removed later
      return touchInput.ID;
    }
  }, {
    key: 'removeTouchInput',
    value: function removeTouchInput(keyMapKey, touchInputId) {
      // Search for the input in our touch pad for every key
      var touchInputIndex = undefined;

      this.keyMap[keyMapKey].TOUCHPAD.some(function (input, index) {
        if (input.ID === touchInputId) {
          touchInputIndex = index;
          return true;
        }

        return false;
      });

      // If we found the key and index, remove the touch input
      if (touchInputIndex !== undefined) {
        this.keyMap[keyMapKey].TOUCHPAD.splice(touchInputIndex, 1);
        return true;
      }

      return false;
    }
  }, {
    key: 'getState',
    value: function getState() {
      var _this2 = this;

      if (!this.enabled) {
        return {};
      }

      // Keyboard handled by listeners on window

      // Update the gamepad state
      this.updateGamepad();

      // Touch Handled by listeners on touchInputs

      // Create an abstracted controller state
      var controllerState = {};

      // Loop through our Keys, and quickly build our controller state
      this.keyMapKeys.forEach(function (key) {

        // Find if any of the keyboard, gamepad or touchpad buttons are pressed
        var keyboardState = _this2.keyMap[key].KEYBOARD.some(function (keyInput) {
          return keyInput.ACTIVE;
        });

        if (keyboardState) {
          controllerState[key] = true;
          return;
        }

        // Find if any of the keyboard, gamepad or touchpad buttons are pressed
        var gamepadState = _this2.keyMap[key].GAMEPAD.some(function (gamepadInput) {
          return gamepadInput.ACTIVE;
        });

        if (gamepadState) {
          controllerState[key] = true;
          return;
        }

        // Find if any of the keyboard, gamepad or touchpad buttons are pressed
        var touchState = _this2.keyMap[key].TOUCHPAD.some(function (touchInput) {
          return touchInput.ACTIVE;
        });

        if (touchState) {
          controllerState[key] = true;
          return;
        }

        controllerState[key] = false;
      });

      // Return the controller state in case we need something from it
      return controllerState;
    }

    // Function to return if we are ignoring input for key events

  }, {
    key: 'isIgnoringKeyEvents',
    value: function isIgnoringKeyEvents() {

      // Checking for window for preact prerender
      if (typeof window === "undefined") {
        return true;
      }

      return INPUT_HTML_TAGS.some(function (htmlTag) {
        if (document.activeElement && document.activeElement.tagName.toLowerCase() === htmlTag.toLowerCase()) {
          return true;
        }
        return false;
      });
    }

    // Function to handle keyboard update events

  }, {
    key: 'updateKeyboard',
    value: function updateKeyboard(keyEvent) {
      var _this3 = this;

      if (!this.enabled) {
        return;
      }

      // Checking for window for preact prerender
      if (typeof window === "undefined") {
        return;
      }

      // Ignore the event if focus on a input-table field
      // https://www.w3schools.com/tags/ref_byfunc.asp
      if (keyEvent && keyEvent.target && keyEvent.target.tagName) {
        var isTargetInputField = INPUT_HTML_TAGS.some(function (htmlTag) {
          if (keyEvent && keyEvent.target.tagName.toLowerCase() === htmlTag.toLowerCase()) {
            return true;
          }
          return false;
        });

        if (isTargetInputField) {
          return;
        }
      }

      // Get the new state of the key
      var isPressed = false;
      if (keyEvent.type === 'keydown') {
        isPressed = true;
      }

      // Loop through our keys
      this.keyMapKeys.forEach(function (key) {
        _this3.keyMap[key].KEYBOARD.forEach(function (keyInput, index) {
          if (keyInput.KEY_CODE === keyEvent.keyCode) {
            _this3.keyMap[key].KEYBOARD[index].ACTIVE = isPressed;
          }
        });
      });

      // If we found a key, prevent default so page wont scroll and things
      keyEvent.preventDefault();
    }

    // Function to check the gamepad API for the gamepad state

  }, {
    key: 'updateGamepad',
    value: function updateGamepad() {
      var _this4 = this;

      // Similar to: https://github.com/torch2424/picoDeploy/blob/master/src/assets/3pLibs/pico8gamepad/pico8gamepad.js
      // Gampad Diagram: https://www.html5rocks.com/en/tutorials/doodles/gamepad/#toc-gamepadinfo
      var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

      var _loop = function _loop(i) {

        // Get our current gamepad
        var gamepad = gamepads[i];

        if (!gamepad) {
          return 'continue';
        }

        // Loop through our keys
        _this4.keyMapKeys.forEach(function (key) {
          _this4.keyMap[key].GAMEPAD.forEach(function (gamepadInput, index) {

            // Check if we are a gamepad button
            if (_this4.keyMap[key].GAMEPAD[index].BUTTON_ID || _this4.keyMap[key].GAMEPAD[index].BUTTON_ID === 0) {
              _this4.keyMap[key].GAMEPAD[index].ACTIVE = isButtonPressed(gamepad, _this4.keyMap[key].GAMEPAD[index].BUTTON_ID);
            }

            // Check if we are an axis
            if (_this4.keyMap[key].GAMEPAD[index].JOYSTICK.AXIS_ID !== undefined && _this4.keyMap[key].GAMEPAD[index].JOYSTICK.IS_POSITIVE !== undefined) {
              if (_this4.keyMap[key].GAMEPAD[index].JOYSTICK.IS_POSITIVE) {
                _this4.keyMap[key].GAMEPAD[index].ACTIVE = getAnalogStickAxis(gamepad, _this4.keyMap[key].GAMEPAD[index].JOYSTICK.AXIS_ID) > +_this4.gamepadAnalogStickDeadZone;
              } else {
                _this4.keyMap[key].GAMEPAD[index].ACTIVE = getAnalogStickAxis(gamepad, _this4.keyMap[key].GAMEPAD[index].JOYSTICK.AXIS_ID) < -_this4.gamepadAnalogStickDeadZone;
              }
            }
          });
        });
      };

      for (var i = 0; i < gamepads.length; i++) {
        var _ret = _loop(i);

        if (_ret === 'continue') continue;
      }
    }

    // Function to update button position and size

  }, {
    key: 'updateTouchpadRect',
    value: function updateTouchpadRect() {
      var _this5 = this;

      // Read from the DOM, and get each of our elements position, doing this here, as it is best to read from the dom in sequence
      // use element.getBoundingRect() top, bottom, left, right to get clientX and clientY in touch events :)
      // https://stackoverflow.com/questions/442404/retrieve-the-position-x-y-of-an-html-element
      //console.log("GamepadComponent: Updating Rect()...");
      this.keyMapKeys.forEach(function (key) {
        _this5.keyMap[key].TOUCHPAD.forEach(function (touchInput, index) {
          var boundingRect = _this5.keyMap[key].TOUCHPAD[index].ELEMENT.getBoundingClientRect();
          _this5.keyMap[key].TOUCHPAD[index].BOUNDING_RECT = boundingRect;
        });
      });
    }

    // Reset all Diretion keys for a DPAD for touch Inputs

  }, {
    key: 'resetTouchDpad',
    value: function resetTouchDpad() {
      var _this6 = this;

      var dpadKeys = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

      dpadKeys.forEach(function (dpadKey) {
        _this6.keyMap[dpadKey].TOUCHPAD.forEach(function (touchInput) {
          touchInput.ACTIVE = false;
        });
      });
    }

    // Function called on an event of a touchInput SVG Element

  }, {
    key: 'updateTouchpad',
    value: function updateTouchpad(keyMapKey, touchInput, event) {

      if (!this.enabled) {
        return;
      }

      if (!event || event.type.includes('touch') && !event.touches) return;

      //event.stopPropagation();
      event.preventDefault();

      //this.debugCurrentTouch(event);

      // Check for active event types
      if (event.type === "touchstart" || event.type === "touchmove" || event.type === "mousedown") {
        // Active

        if (touchInput.TYPE === 'DPAD') {

          // Calculate for the correct key
          // Only using the first touch, since we shouldn't be having two fingers on the dpad
          var touch = void 0;
          if (event.type.includes('touch')) {
            touch = event.touches[0];
          } else if (event.type.includes('mouse')) {
            touch = event;
          }

          // Find if the horizontal or vertical influence is greater
          // Find our centers of our rectangles, and our unbiased X Y values on the rect
          var rectCenterX = (touchInput.BOUNDING_RECT.right - touchInput.BOUNDING_RECT.left) / 2;
          var rectCenterY = (touchInput.BOUNDING_RECT.bottom - touchInput.BOUNDING_RECT.top) / 2;
          var touchX = touch.clientX - touchInput.BOUNDING_RECT.left;
          var touchY = touch.clientY - touchInput.BOUNDING_RECT.top;

          // Lesson From: picoDeploy
          // Fix for shoot button causing the character to move right on multi touch error
          // + 50 for some buffer
          if (touchX > rectCenterX + touchInput.BOUNDING_RECT.width / 2 + 50) {
            // Ignore the event
            return;
          }

          // Create an additonal influece for horizontal, to make it feel better
          var horizontalInfluence = touchInput.BOUNDING_RECT.width / 8;

          // Determine if we are horizontal or vertical
          var isHorizontal = Math.abs(rectCenterX - touchX) + horizontalInfluence > Math.abs(rectCenterY - touchY);

          // Find if left or right from width, vice versa for height
          if (isHorizontal) {
            // Add a horizontal dead zone
            var deadzoneSize = touchInput.BOUNDING_RECT.width / 20;
            if (Math.abs(touchInput.BOUNDING_RECT.width / 2 - touchX) > deadzoneSize) {

              var isLeft = touchX < touchInput.BOUNDING_RECT.width / 2;

              if (isLeft && touchInput.DIRECTION === 'LEFT') {
                touchInput.ACTIVE = true;
              } else if (!isLeft && touchInput.DIRECTION === 'RIGHT') {
                touchInput.ACTIVE = true;
              } else {
                touchInput.ACTIVE = false;
              }
            }
          } else {
            var isUp = touchY < touchInput.BOUNDING_RECT.height / 2;
            if (isUp && touchInput.DIRECTION === 'UP') {
              touchInput.ACTIVE = true;
            } else if (!isUp && touchInput.DIRECTION === 'DOWN') {
              touchInput.ACTIVE = true;
            } else {
              touchInput.ACTIVE = false;
            }
          }
        }

        // Button Type
        if (touchInput.TYPE === 'BUTTON') {
          touchInput.ACTIVE = true;
        }
      } else {
        // Not active

        // Handle Dpad Type
        if (touchInput.TYPE === 'DPAD') {
          this.resetTouchDpad();
        }

        // Button Type
        if (touchInput.TYPE === 'BUTTON') {
          touchInput.ACTIVE = false;
        }
      }
    }
  }]);
  return ResponsiveGamepadService;
}();

// Exports


var ResponsiveGamepad = new ResponsiveGamepadService();

// https://github.com/torch2424/responsive-gamepad

class WasmBoyControllerService {
  constructor() {
    // Our wasm instance
    this.worker = undefined;
    this.isEnabled = false;
    this.enableDefaultJoypad();
  }

  initialize() {
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
    ResponsiveGamepad.enable(KEYMAP());
  }

  disableDefaultJoypad() {
    this.isEnabled = false;
    ResponsiveGamepad.disable(KEYMAP());
  }

  addTouchInput(keyMapKey, element, type, direction) {
    return ResponsiveGamepad.addTouchInput(keyMapKey, element, type, direction);
  }

  removeTouchInput(keyMapKey, touchInputId) {
    return ResponsiveGamepad.removeTouchInput(keyMapKey, touchInputId);
  }

}

const WasmBoyController = new WasmBoyControllerService();

var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIHdhKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gYmEoYSxiKXtGYT9zZWxmLnBvc3RNZXNzYWdlKGEsYik6UmEucG9zdE1lc3NhZ2UoYSxiKX1mdW5jdGlvbiB4YShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKEZhKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKEZhKXNlbGYub25tZXNzYWdlPWE7ZWxzZSBSYS5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gTihhLGIsZil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksR2ErKyxiPWAke2J9LSR7R2F9YCwxRTU8R2EmJihHYT0wKSk7cmV0dXJue3dvcmtlcklkOmYsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiB6YihhLGIpe2I9d2EoYik7CnN3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBFLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZnJhbWVJblByb2dyZXNzVmlkZW9PdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCksYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX1NJWkUudmFsdWVPZigpLGEuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6RS5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBBYihhLGIpe2I9d2EoYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIEUuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6RS5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEUuQVVESU9fTEFURU5DWTphLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9Yi5tZXNzYWdlLmxhdGVuY3l9fWZ1bmN0aW9uIEJiKGEsYil7Yj13YShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgRS5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gZWIoYSl7aWYoIWEud2FzbUJ5dGVNZW1vcnkpcmV0dXJuIG5ldyBVaW50OEFycmF5OwpsZXQgYj1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN10sZj12b2lkIDA7aWYoMD09PWIpcmV0dXJuIG5ldyBVaW50OEFycmF5OzE8PWImJjM+PWI/Zj0zMjc2ODo1PD1iJiY2Pj1iP2Y9MjA0ODoxNTw9YiYmMTk+PWI/Zj0zMjc2ODoyNTw9YiYmMzA+PWImJihmPTEzMTA3Mik7cmV0dXJuIGY/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2YpOm5ldyBVaW50OEFycmF5fWZ1bmN0aW9uIGZiKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gQ2IoYSxiKXtiPXdhKGIpOwpzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgRS5DTEVBUl9NRU1PUlk6Zm9yKHZhciBjPTA7Yzw9YS53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7YysrKWEud2FzbUJ5dGVNZW1vcnlbY109MDtjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoMCk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6RS5DTEVBUl9NRU1PUllfRE9ORSx3YXNtQnl0ZU1lbW9yeTpjLmJ1ZmZlcn0sYi5tZXNzYWdlSWQpLFtjLmJ1ZmZlcl0pO2JyZWFrO2Nhc2UgRS5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCk7CmEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpFLkdFVF9DT05TVEFOVFNfRE9ORSwKV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lUmFtQmFua3NMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVMb2NhdGlvbi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBFLlNFVF9NRU1PUlk6Yz1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2MuaW5jbHVkZXMoRi5DQVJUUklER0VfUk9NKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuQ0FSVFJJREdFX1JPTV0pLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEYuQ0FSVFJJREdFX1JBTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtGLkNBUlRSSURHRV9SQU1dKSxhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04pO2MuaW5jbHVkZXMoRi5HQU1FQk9ZX01FTU9SWSkmJgphLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbRi5HQU1FQk9ZX01FTU9SWV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04pO2MuaW5jbHVkZXMoRi5QQUxFVFRFX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtGLlBBTEVUVEVfTUVNT1JZXSksYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEYuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuSU5URVJOQUxfU1RBVEVdKSxhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04pLGEud2FzbUluc3RhbmNlLmV4cG9ydHMubG9hZFN0YXRlKCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOkUuU0VUX01FTU9SWV9ET05FfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgRS5HRVRfTUVNT1JZOntjPXt0eXBlOkUuR0VUX01FTU9SWX07CmNvbnN0IGY9W107dmFyIHU9Yi5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKHUuaW5jbHVkZXMoRi5DQVJUUklER0VfUk9NKSl7aWYoYS53YXNtQnl0ZU1lbW9yeSl7dmFyIHg9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddO3ZhciBkPXZvaWQgMDswPT09eD9kPTMyNzY4OjE8PXgmJjM+PXg/ZD0yMDk3MTUyOjU8PXgmJjY+PXg/ZD0yNjIxNDQ6MTU8PXgmJjE5Pj14P2Q9MjA5NzE1MjoyNTw9eCYmMzA+PXgmJihkPTgzODg2MDgpO3g9ZD9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK2QpOm5ldyBVaW50OEFycmF5fWVsc2UgeD1uZXcgVWludDhBcnJheTt4PXguYnVmZmVyO2NbRi5DQVJUUklER0VfUk9NXT14O2YucHVzaCh4KX11LmluY2x1ZGVzKEYuQ0FSVFJJREdFX1JBTSkmJih4PWViKGEpLmJ1ZmZlcixjW0YuQ0FSVFJJREdFX1JBTV09eCwKZi5wdXNoKHgpKTt1LmluY2x1ZGVzKEYuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5Pyh4PWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCx4PWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoeCx4KzI3KSk6eD1uZXcgVWludDhBcnJheSx4PXguYnVmZmVyLGNbRi5DQVJUUklER0VfSEVBREVSXT14LGYucHVzaCh4KSk7dS5pbmNsdWRlcyhGLkdBTUVCT1lfTUVNT1JZKSYmKHg9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsY1tGLkdBTUVCT1lfTUVNT1JZXT14LGYucHVzaCh4KSk7dS5pbmNsdWRlcyhGLlBBTEVUVEVfTUVNT1JZKSYmKHg9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGNbRi5QQUxFVFRFX01FTU9SWV09eCxmLnB1c2goeCkpO3UuaW5jbHVkZXMoRi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLHU9ZmIoYSkuYnVmZmVyLGNbRi5JTlRFUk5BTF9TVEFURV09dSxmLnB1c2godSkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKGMsYi5tZXNzYWdlSWQpLGYpfX19ZnVuY3Rpb24gbChhLGIpe3JldHVybihhJjI1NSk8PDh8YiYyNTV9ZnVuY3Rpb24gSChhKXtyZXR1cm4oYSY2NTI4MCk+Pjh9ZnVuY3Rpb24gSyhhLGIpe3JldHVybiBiJn4oMTw8YSl9ZnVuY3Rpb24gbihhLGIpe3JldHVybiAwIT0oYiYxPDxhKX1mdW5jdGlvbiBTYShhKXt2YXIgYj1hO24oNyxiKSYmKGI9LTEqKDI1Ni1hKSk7cmV0dXJuIGJ9ZnVuY3Rpb24gSGEoYSxjKXthPTE8PGEmMjU1O2IucmVnaXN0ZXJGPTA8Yz9iLnJlZ2lzdGVyRnxhOmIucmVnaXN0ZXJGJgooMjU1XmEpO3JldHVybiBiLnJlZ2lzdGVyRn1mdW5jdGlvbiBtKGEpe0hhKDcsYSl9ZnVuY3Rpb24gdChhKXtIYSg2LGEpfWZ1bmN0aW9uIEMoYSl7SGEoNSxhKX1mdW5jdGlvbiB3KGEpe0hhKDQsYSl9ZnVuY3Rpb24gcWEoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjcmMX1mdW5jdGlvbiBTKCl7cmV0dXJuIGIucmVnaXN0ZXJGPj40JjF9ZnVuY3Rpb24gUShhLGIpezA8PWI/MCE9PSgoYSYxNSkrKGImMTUpJjE2KT9DKDEpOkMoMCk6KE1hdGguYWJzKGIpJjE1KT4oYSYxNSk/QygxKTpDKDApfWZ1bmN0aW9uIFRhKGEsYil7MDw9Yj9hPihhK2ImMjU1KT93KDEpOncoMCk6TWF0aC5hYnMoYik+YT93KDEpOncoMCl9ZnVuY3Rpb24gdWEoYSxiLGYpe2Y/KGE9YV5iXmErYiwwIT09KGEmMTYpP0MoMSk6QygwKSwwIT09KGEmMjU2KT93KDEpOncoMCkpOihmPWErYiY2NTUzNSxmPGE/dygxKTp3KDApLDAhPT0oKGFeYl5mKSY0MDk2KT9DKDEpOkMoMCkpfWZ1bmN0aW9uIElhKGEsYixmKXt2b2lkIDA9PT0KZiYmKGY9ITEpO3ZhciBjPWE7Znx8KGM9eShiKT4+MiphJjMpO2E9MjQyO3N3aXRjaChjKXtjYXNlIDE6YT0xNjA7YnJlYWs7Y2FzZSAyOmE9ODg7YnJlYWs7Y2FzZSAzOmE9OH1yZXR1cm4gYX1mdW5jdGlvbiBKYShhLGIsZil7Yj04KmErMipiO2E9Z2IoYisxLGYpO2Y9Z2IoYixmKTtyZXR1cm4gbChhLGYpfWZ1bmN0aW9uIGNhKGEsYil7cmV0dXJuIDgqKChiJjMxPDw1KmEpPj41KmEpfWZ1bmN0aW9uIGdiKGEsYil7YSY9NjM7YiYmKGErPTY0KTtyZXR1cm4gZ1s2NzU4NCthXX1mdW5jdGlvbiBLYShhLGIsZix1KXt2b2lkIDA9PT1mJiYoZj0wKTt2b2lkIDA9PT11JiYodT0hMSk7ZiY9Mzt1JiYoZnw9NCk7Z1s2OTYzMisoMTYwKmIrYSldPWZ9ZnVuY3Rpb24gaGIoYSxiLGYsdSx4LGQsaCxlLG0sayxsLHAscmEpe3ZvaWQgMD09PWwmJihsPSExKTt2b2lkIDA9PT1wJiYocD0wKTt2b2lkIDA9PT1yYSYmKHJhPS0xKTt2YXIgYz0wO2I9eWEoYixhKTthPVooYisyKmQsZik7Zj1aKGIrCjIqZCsxLGYpO2ZvcihkPXU7ZDw9eDtkKyspaWYoYj1oKyhkLXUpLGI8bSl7dmFyIEI9ZDtpZigwPnJhfHwhbig1LHJhKSlCPTctQjt2YXIgdmE9MDtuKEIsZikmJih2YSs9MSx2YTw8PTEpO24oQixhKSYmKHZhKz0xKTtpZigwPD1yYSl7dmFyIHQ9SmEocmEmNyx2YSwhMSk7Qj1jYSgwLHQpO3ZhciB5PWNhKDEsdCk7dD1jYSgyLHQpfWVsc2UgMD49cCYmKHA9ci5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlKSx5PUI9dD1JYSh2YSxwLGwpO3ZhciBxPTMqKGUqbStiKTtnW2srcV09QjtnW2srcSsxXT15O2dbaytxKzJdPXQ7Qj0hMTswPD1yYSYmKEI9big3LHJhKSk7S2EoYixlLHZhLEIpO2MrK31yZXR1cm4gY31mdW5jdGlvbiB5YShhLGIpe2lmKGE9PT1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQpe3ZhciBjPWIrMTI4O24oNyxiKSYmKGM9Yi0xMjgpO3JldHVybiBhKzE2KmN9cmV0dXJuIGErMTYqYn1mdW5jdGlvbiBpYihhLGIpe3N3aXRjaChhKXtjYXNlIDE6cmV0dXJuIG4oYiwKMTI5KTtjYXNlIDI6cmV0dXJuIG4oYiwxMzUpO2Nhc2UgMzpyZXR1cm4gbihiLDEyNik7ZGVmYXVsdDpyZXR1cm4gbihiLDEpfX1mdW5jdGlvbiBqYigpe3ZhciBhPWtiKCk7MjA0Nz49YSYmMDx6Lk5SeDBTd2VlcFNoaWZ0JiYoei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1hLHouc2V0RnJlcXVlbmN5KGEpLGE9a2IoKSk7MjA0NzxhJiYoei5pc0VuYWJsZWQ9ITEpfWZ1bmN0aW9uIGtiKCl7dmFyIGE9ei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeTthPj49ei5OUngwU3dlZXBTaGlmdDtyZXR1cm4gYT16Lk5SeDBOZWdhdGU/ei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeS1hOnouc3dlZXBTaGFkb3dGcmVxdWVuY3krYX1mdW5jdGlvbiBMYShhKXtzd2l0Y2goYSl7Y2FzZSB6LmNoYW5uZWxOdW1iZXI6aWYocS5jaGFubmVsMURhY0VuYWJsZWQhPT16LmlzRGFjRW5hYmxlZClyZXR1cm4gcS5jaGFubmVsMURhY0VuYWJsZWQ9ei5pc0RhY0VuYWJsZWQsITA7YnJlYWs7Y2FzZSBMLmNoYW5uZWxOdW1iZXI6aWYocS5jaGFubmVsMkRhY0VuYWJsZWQhPT0KTC5pc0RhY0VuYWJsZWQpcmV0dXJuIHEuY2hhbm5lbDJEYWNFbmFibGVkPUwuaXNEYWNFbmFibGVkLCEwO2JyZWFrO2Nhc2UgSS5jaGFubmVsTnVtYmVyOmlmKHEuY2hhbm5lbDNEYWNFbmFibGVkIT09SS5pc0RhY0VuYWJsZWQpcmV0dXJuIHEuY2hhbm5lbDNEYWNFbmFibGVkPUkuaXNEYWNFbmFibGVkLCEwO2JyZWFrO2Nhc2UgTS5jaGFubmVsTnVtYmVyOmlmKHEuY2hhbm5lbDREYWNFbmFibGVkIT09TS5pc0RhY0VuYWJsZWQpcmV0dXJuIHEuY2hhbm5lbDREYWNFbmFibGVkPU0uaXNEYWNFbmFibGVkLCEwfXJldHVybiExfWZ1bmN0aW9uIE1hKCl7aWYoIShlLmN1cnJlbnRDeWNsZXM8ZS5iYXRjaFByb2Nlc3NDeWNsZXMoKSkpZm9yKDtlLmN1cnJlbnRDeWNsZXM+PWUuYmF0Y2hQcm9jZXNzQ3ljbGVzKCk7KWxiKGUuYmF0Y2hQcm9jZXNzQ3ljbGVzKCkpLGUuY3VycmVudEN5Y2xlcy09ZS5iYXRjaFByb2Nlc3NDeWNsZXMoKX1mdW5jdGlvbiBsYihhKXtlLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXIrPQphO2lmKGUuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj49ZS5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzKCkpe2UuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlci09ZS5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzKCk7c3dpdGNoKGUuZnJhbWVTZXF1ZW5jZXIpe2Nhc2UgMDp6LnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtNLnVwZGF0ZUxlbmd0aCgpO2JyZWFrO2Nhc2UgMjp6LnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtNLnVwZGF0ZUxlbmd0aCgpO3oudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDQ6ei51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO0kudXBkYXRlTGVuZ3RoKCk7TS51cGRhdGVMZW5ndGgoKTticmVhaztjYXNlIDY6ei51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO0kudXBkYXRlTGVuZ3RoKCk7TS51cGRhdGVMZW5ndGgoKTt6LnVwZGF0ZVN3ZWVwKCk7YnJlYWs7Y2FzZSA3OnoudXBkYXRlRW52ZWxvcGUoKSwKTC51cGRhdGVFbnZlbG9wZSgpLE0udXBkYXRlRW52ZWxvcGUoKX1lLmZyYW1lU2VxdWVuY2VyKz0xOzg8PWUuZnJhbWVTZXF1ZW5jZXImJihlLmZyYW1lU2VxdWVuY2VyPTApO3ZhciBiPSEwfWVsc2UgYj0hMTtpZihULmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXMmJiFiKXtiPXoud2lsbENoYW5uZWxVcGRhdGUoYSl8fExhKHouY2hhbm5lbE51bWJlcik7dmFyIGY9TC53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8TGEoTC5jaGFubmVsTnVtYmVyKSx1PUkud2lsbENoYW5uZWxVcGRhdGUoYSl8fExhKEkuY2hhbm5lbE51bWJlcikseD1NLndpbGxDaGFubmVsVXBkYXRlKGEpfHxMYShNLmNoYW5uZWxOdW1iZXIpO2ImJihxLmNoYW5uZWwxU2FtcGxlPXouZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtmJiYocS5jaGFubmVsMlNhbXBsZT1MLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7dSYmKHEuY2hhbm5lbDNTYW1wbGU9SS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO3gmJihxLmNoYW5uZWw0U2FtcGxlPQpNLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7aWYoYnx8Znx8dXx8eClxLm5lZWRUb1JlbWl4U2FtcGxlcz0hMDtlLmRvd25TYW1wbGVDeWNsZUNvdW50ZXIrPWEqZS5kb3duU2FtcGxlQ3ljbGVNdWx0aXBsaWVyO2UuZG93blNhbXBsZUN5Y2xlQ291bnRlcj49ZS5tYXhEb3duU2FtcGxlQ3ljbGVzKCkmJihlLmRvd25TYW1wbGVDeWNsZUNvdW50ZXItPWUubWF4RG93blNhbXBsZUN5Y2xlcygpLChxLm5lZWRUb1JlbWl4U2FtcGxlc3x8cS5taXhlclZvbHVtZUNoYW5nZWR8fHEubWl4ZXJFbmFibGVkQ2hhbmdlZCkmJm1iKHEuY2hhbm5lbDFTYW1wbGUscS5jaGFubmVsMlNhbXBsZSxxLmNoYW5uZWwzU2FtcGxlLHEuY2hhbm5lbDRTYW1wbGUpLGE9cS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGUrMSxiPTU4ODgwMCsyKmUuYXVkaW9RdWV1ZUluZGV4LGdbYl09cS5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZSsxKzEsZ1tiKzFdPWErMSxlLmF1ZGlvUXVldWVJbmRleCs9CjEsZS5hdWRpb1F1ZXVlSW5kZXg+PShlLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplLzJ8MCktMSYmLS1lLmF1ZGlvUXVldWVJbmRleCl9ZWxzZSBiPXouZ2V0U2FtcGxlKGEpfDAsZj1MLmdldFNhbXBsZShhKXwwLHU9SS5nZXRTYW1wbGUoYSl8MCx4PU0uZ2V0U2FtcGxlKGEpfDAscS5jaGFubmVsMVNhbXBsZT1iLHEuY2hhbm5lbDJTYW1wbGU9ZixxLmNoYW5uZWwzU2FtcGxlPXUscS5jaGFubmVsNFNhbXBsZT14LGUuZG93blNhbXBsZUN5Y2xlQ291bnRlcis9YSplLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXIsZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPj1lLm1heERvd25TYW1wbGVDeWNsZXMoKSYmKGUuZG93blNhbXBsZUN5Y2xlQ291bnRlci09ZS5tYXhEb3duU2FtcGxlQ3ljbGVzKCksYT1tYihiLGYsdSx4KSxiPUgoYSksZj01ODg4MDArMiplLmF1ZGlvUXVldWVJbmRleCxnW2ZdPWIrMSsxLGdbZisxXT0oYSYyNTUpKzIsZS5hdWRpb1F1ZXVlSW5kZXgrPTEsZS5hdWRpb1F1ZXVlSW5kZXg+PQooZS53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZS8yfDApLTEmJi0tZS5hdWRpb1F1ZXVlSW5kZXgpfWZ1bmN0aW9uIFVhKCl7cmV0dXJuIGUuYXVkaW9RdWV1ZUluZGV4fWZ1bmN0aW9uIFZhKCl7ZS5hdWRpb1F1ZXVlSW5kZXg9MH1mdW5jdGlvbiBtYihhLGIsZix1KXt2b2lkIDA9PT1hJiYoYT0xNSk7dm9pZCAwPT09YiYmKGI9MTUpO3ZvaWQgMD09PWYmJihmPTE1KTt2b2lkIDA9PT11JiYodT0xNSk7cS5taXhlclZvbHVtZUNoYW5nZWQ9ITE7dmFyIGM9MCxkPTA7Yz1lLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD9jK2E6YysxNTtjPWUuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0P2MrYjpjKzE1O2M9ZS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ/YytmOmMrMTU7Yz1lLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD9jK3U6YysxNTtkPWUuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD9kK2E6ZCsxNTsKZD1lLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCtiOmQrMTU7ZD1lLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCtmOmQrMTU7ZD1lLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCt1OmQrMTU7cS5taXhlckVuYWJsZWRDaGFuZ2VkPSExO3EubmVlZFRvUmVtaXhTYW1wbGVzPSExO2E9bmIoYyxlLk5SNTBMZWZ0TWl4ZXJWb2x1bWUrMSk7ZD1uYihkLGUuTlI1MFJpZ2h0TWl4ZXJWb2x1bWUrMSk7cS5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT1hO3EucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPWQ7cmV0dXJuIGwoYSxkKX1mdW5jdGlvbiBuYihhLGIpe2lmKDYwPT09YSlyZXR1cm4gMTI3O2E9MUU1KihhLTYwKSpiLzh8MDthPWEvMUU1fDA7YSs9NjA7YT0xRTUqYS8oMTJFNi8yNTR8MCl8MDtyZXR1cm4gYXw9MH1mdW5jdGlvbiBOYShhKXtPYSghMSk7dmFyIGM9eShrLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCk7CmM9SyhhLGMpO2suaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWM7aChrLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCxjKTtiLnN0YWNrUG9pbnRlci09MjtiLmlzSGFsdGVkKCk7Yz1iLnN0YWNrUG9pbnRlcjt2YXIgZj1iLnByb2dyYW1Db3VudGVyLHU9SChmKSxkPWMrMTtoKGMsZiYyNTUpO2goZCx1KTtzd2l0Y2goYSl7Y2FzZSBrLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0OmsuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7Yi5wcm9ncmFtQ291bnRlcj02NDticmVhaztjYXNlIGsuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ6ay5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTcyO2JyZWFrO2Nhc2Ugay5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0OmsuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTgwO2JyZWFrO2Nhc2Ugay5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdDprLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPQohMSxiLnByb2dyYW1Db3VudGVyPTk2fX1mdW5jdGlvbiB6YShhKXt2YXIgYj15KGsubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KTtifD0xPDxhO2suaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWI7aChrLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCxiKX1mdW5jdGlvbiBPYShhKXthP2subWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9ITA6ay5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITF9ZnVuY3Rpb24gV2EoYSl7Zm9yKHZhciBiPTA7YjxhOyl7dmFyIGY9cC5kaXZpZGVyUmVnaXN0ZXI7Yis9NDtwLmRpdmlkZXJSZWdpc3Rlcis9NDs2NTUzNTxwLmRpdmlkZXJSZWdpc3RlciYmKHAuZGl2aWRlclJlZ2lzdGVyLT02NTUzNik7cC50aW1lckVuYWJsZWQmJihwLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk/KHAudGltZXJDb3VudGVyPXAudGltZXJNb2R1bG8say5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSEwLHphKGsuYml0UG9zaXRpb25UaW1lckludGVycnVwdCksCnAudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMSxwLnRpbWVyQ291bnRlcldhc1Jlc2V0PSEwKTpwLnRpbWVyQ291bnRlcldhc1Jlc2V0JiYocC50aW1lckNvdW50ZXJXYXNSZXNldD0hMSksb2IoZixwLmRpdmlkZXJSZWdpc3RlcikmJlhhKCkpfX1mdW5jdGlvbiBYYSgpe3AudGltZXJDb3VudGVyKz0xOzI1NTxwLnRpbWVyQ291bnRlciYmKHAudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMCxwLnRpbWVyQ291bnRlcj0wKX1mdW5jdGlvbiBvYihhLGIpe3ZhciBjPVlhKHAudGltZXJJbnB1dENsb2NrKTtyZXR1cm4gbihjLGEpJiYhbihjLGIpPyEwOiExfWZ1bmN0aW9uIFlhKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIDk7Y2FzZSAxOnJldHVybiAzO2Nhc2UgMjpyZXR1cm4gNTtjYXNlIDM6cmV0dXJuIDd9cmV0dXJuIDB9ZnVuY3Rpb24gc2EoYSl7dmFyIGM9Yi5pc1N0b3BwZWQ9ITE7RGIoYSl8fChjPSEwKTtlYShhLCEwKTtjJiYoYz0hMSwzPj1hJiYoYz0hMCksYT0hMSwKQS5pc0RwYWRUeXBlJiZjJiYoYT0hMCksQS5pc0J1dHRvblR5cGUmJiFjJiYoYT0hMCksYSYmKGsuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsemEoay5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCkpKX1mdW5jdGlvbiBEYihhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiBBLnVwO2Nhc2UgMTpyZXR1cm4gQS5yaWdodDtjYXNlIDI6cmV0dXJuIEEuZG93bjtjYXNlIDM6cmV0dXJuIEEubGVmdDtjYXNlIDQ6cmV0dXJuIEEuYTtjYXNlIDU6cmV0dXJuIEEuYjtjYXNlIDY6cmV0dXJuIEEuc2VsZWN0O2Nhc2UgNzpyZXR1cm4gQS5zdGFydDtkZWZhdWx0OnJldHVybiExfX1mdW5jdGlvbiBlYShhLGIpe3N3aXRjaChhKXtjYXNlIDA6QS51cD1iO2JyZWFrO2Nhc2UgMTpBLnJpZ2h0PWI7YnJlYWs7Y2FzZSAyOkEuZG93bj1iO2JyZWFrO2Nhc2UgMzpBLmxlZnQ9YjticmVhaztjYXNlIDQ6QS5hPWI7YnJlYWs7Y2FzZSA1OkEuYj1iO2JyZWFrO2Nhc2UgNjpBLnNlbGVjdD1iO2JyZWFrOwpjYXNlIDc6QS5zdGFydD1ifX1mdW5jdGlvbiBwYihhLGMsZil7Zm9yKHZhciB1PTA7dTxmO3UrKyl7Zm9yKHZhciB4PXFiKGErdSksZz1jK3U7NDA5NTk8ZzspZy09ODE5MjtQYShnLHgpJiZoKGcseCl9YT0zMjtiLkdCQ0RvdWJsZVNwZWVkJiYoYT02NCk7ZC5ETUFDeWNsZXMrPWYvMTYqYX1mdW5jdGlvbiBQYShhLGMpe2lmKGE9PT1iLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpcmV0dXJuIGgoYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoLGMmMSksITE7dmFyIGY9ZC52aWRlb1JhbUxvY2F0aW9uLHU9ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb247aWYoYTxmKXtpZighZC5pc1JvbU9ubHkpaWYoODE5MT49YSl7aWYoIWQuaXNNQkMyfHxuKDQsYykpYyY9MTUsMD09PWM/ZC5pc1JhbUJhbmtpbmdFbmFibGVkPSExOjEwPT09YyYmKGQuaXNSYW1CYW5raW5nRW5hYmxlZD0hMCl9ZWxzZSAxNjM4Mz49YT8hZC5pc01CQzV8fDEyMjg3Pj1hPyhkLmlzTUJDMiYmKGQuY3VycmVudFJvbUJhbms9CmMmMTUpLGQuaXNNQkMxPyhjJj0zMSxkLmN1cnJlbnRSb21CYW5rJj0yMjQpOmQuaXNNQkMzPyhjJj0xMjcsZC5jdXJyZW50Um9tQmFuayY9MTI4KTpkLmlzTUJDNSYmKGQuY3VycmVudFJvbUJhbmsmPTApLGQuY3VycmVudFJvbUJhbmt8PWMpOihhPTAsZj1kLmN1cnJlbnRSb21CYW5rJjI1NSwwPGMmJihhPTEpLGQuY3VycmVudFJvbUJhbms9bChhLGYpKTohZC5pc01CQzImJjI0NTc1Pj1hP2QuaXNNQkMxJiZkLmlzTUJDMVJvbU1vZGVFbmFibGVkPyhkLmN1cnJlbnRSb21CYW5rJj0zMSxkLmN1cnJlbnRSb21CYW5rfD1jJjIyNCk6KGM9ZC5pc01CQzU/YyYxNTpjJjMsZC5jdXJyZW50UmFtQmFuaz1jKTohZC5pc01CQzImJjMyNzY3Pj1hJiZkLmlzTUJDMSYmKG4oMCxjKT9kLmlzTUJDMVJvbU1vZGVFbmFibGVkPSEwOmQuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITEpO3JldHVybiExfWlmKGE+PWYmJmE8ZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbilyZXR1cm4hMDtpZihhPj1kLmVjaG9SYW1Mb2NhdGlvbiYmCmE8dSlyZXR1cm4gaChhLTgxOTIsYyksITA7aWYoYT49dSYmYTw9ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQpcmV0dXJuIDI+RC5jdXJyZW50TGNkTW9kZT8hMTohMDtpZihhPj1kLnVudXNhYmxlTWVtb3J5TG9jYXRpb24mJmE8PWQudW51c2FibGVNZW1vcnlFbmRMb2NhdGlvbilyZXR1cm4hMTtpZig2NTI5Njw9YSYmNjUzMTg+PWEpe01hKCk7aWYoYT09PWUubWVtb3J5TG9jYXRpb25OUjUyfHxlLk5SNTJJc1NvdW5kRW5hYmxlZCl7c3dpdGNoKGEpe2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDA6ei51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDA6SS51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDE6ei51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDE6TC51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDE6SS51cGRhdGVOUngxKGMpOwpicmVhaztjYXNlIE0ubWVtb3J5TG9jYXRpb25OUngxOk0udXBkYXRlTlJ4MShjKTticmVhaztjYXNlIHoubWVtb3J5TG9jYXRpb25OUngyOnoudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUngyOkwudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEkubWVtb3J5TG9jYXRpb25OUngyOkkudm9sdW1lQ29kZUNoYW5nZWQ9ITA7SS51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgTS5tZW1vcnlMb2NhdGlvbk5SeDI6TS51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDM6ei51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDM6TC51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDM6SS51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgTS5tZW1vcnlMb2NhdGlvbk5SeDM6TS51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDQ6big3LGMpJiYoei51cGRhdGVOUng0KGMpLAp6LnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4NDpuKDcsYykmJihMLnVwZGF0ZU5SeDQoYyksTC50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDQ6big3LGMpJiYoSS51cGRhdGVOUng0KGMpLEkudHJpZ2dlcigpKTticmVhaztjYXNlIE0ubWVtb3J5TG9jYXRpb25OUng0Om4oNyxjKSYmKE0udXBkYXRlTlJ4NChjKSxNLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBlLm1lbW9yeUxvY2F0aW9uTlI1MDplLnVwZGF0ZU5SNTAoYyk7cS5taXhlclZvbHVtZUNoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBlLm1lbW9yeUxvY2F0aW9uTlI1MTplLnVwZGF0ZU5SNTEoYyk7cS5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO2JyZWFrO2Nhc2UgZS5tZW1vcnlMb2NhdGlvbk5SNTI6aWYoZS51cGRhdGVOUjUyKGMpLCFuKDcsYykpZm9yKGM9NjUyOTY7NjUzMTg+YztjKyspaChjLDApfWM9ITB9ZWxzZSBjPSExO3JldHVybiBjfTY1MzI4PD1hJiY2NTM0Mz49YSYmCk1hKCk7aWYoYT49RC5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wmJmE8PXIubWVtb3J5TG9jYXRpb25XaW5kb3dYKXtpZihhPT09RC5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wpcmV0dXJuIEQudXBkYXRlTGNkQ29udHJvbChjKSwhMDtpZihhPT09RC5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cylyZXR1cm4gRC51cGRhdGVMY2RTdGF0dXMoYyksITE7aWYoYT09PXIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyKXJldHVybiByLnNjYW5saW5lUmVnaXN0ZXI9MCxoKGEsMCksITE7aWYoYT09PUQubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmUpcmV0dXJuIEQuY29pbmNpZGVuY2VDb21wYXJlPWMsITA7aWYoYT09PXIubWVtb3J5TG9jYXRpb25EbWFUcmFuc2Zlcil7Yzw8PTg7Zm9yKGE9MDsxNTk+PWE7YSsrKWY9eShjK2EpLGgoZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24rYSxmKTtkLkRNQUN5Y2xlcz02NDQ7cmV0dXJuITB9c3dpdGNoKGEpe2Nhc2Ugci5tZW1vcnlMb2NhdGlvblNjcm9sbFg6ci5zY3JvbGxYPQpjO2JyZWFrO2Nhc2Ugci5tZW1vcnlMb2NhdGlvblNjcm9sbFk6ci5zY3JvbGxZPWM7YnJlYWs7Y2FzZSByLm1lbW9yeUxvY2F0aW9uV2luZG93WDpyLndpbmRvd1g9YzticmVhaztjYXNlIHIubWVtb3J5TG9jYXRpb25XaW5kb3dZOnIud2luZG93WT1jfXJldHVybiEwfWlmKGE9PT1kLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpcmV0dXJuIGIuR0JDRW5hYmxlZCYmKGQuaXNIYmxhbmtIZG1hQWN0aXZlJiYhbig3LGMpPyhkLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMSxjPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyKSxoKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcixjfDEyOCkpOihhPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VIaWdoKSxmPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VMb3cpLGE9bChhLGYpJjY1NTIwLGY9eShkLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaCksdT15KGQubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25Mb3cpLApmPWwoZix1KSxmPShmJjgxNzYpK2QudmlkZW9SYW1Mb2NhdGlvbix1PUsoNyxjKSx1PTE2Kih1KzEpLG4oNyxjKT8oZC5pc0hibGFua0hkbWFBY3RpdmU9ITAsZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc9dSxkLmhibGFua0hkbWFTb3VyY2U9YSxkLmhibGFua0hkbWFEZXN0aW5hdGlvbj1mLGgoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLEsoNyxjKSkpOihwYihhLGYsdSksaChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMjU1KSkpKSwhMTtpZigoYT09PWQubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFua3x8YT09PWQubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmJmQuaXNIYmxhbmtIZG1hQWN0aXZlJiYoMTYzODQ8PWQuaGJsYW5rSGRtYVNvdXJjZSYmMzI3Njc+PWQuaGJsYW5rSGRtYVNvdXJjZXx8NTMyNDg8PWQuaGJsYW5rSGRtYVNvdXJjZSYmNTczNDM+PWQuaGJsYW5rSGRtYVNvdXJjZSkpcmV0dXJuITE7aWYoYT49QWEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZUluZGV4JiYKYTw9QWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7aWYoYT09PUFhLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVEYXRhfHxhPT09QWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7Zj15KGEtMSk7Zj1LKDYsZik7dT0hMTthPT09QWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSYmKHU9ITApO3ZhciB4PWYmNjM7dSYmKHgrPTY0KTtnWzY3NTg0K3hdPWM7Yz1mOy0tYTtuKDcsYykmJmgoYSxjKzF8MTI4KX1yZXR1cm4hMH1pZihhPj1wLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyJiZhPD1wLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sKXtXYShwLmN1cnJlbnRDeWNsZXMpO3AuY3VycmVudEN5Y2xlcz0wO3N3aXRjaChhKXtjYXNlIHAubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXI6cmV0dXJuIHAudXBkYXRlRGl2aWRlclJlZ2lzdGVyKGMpLCExO2Nhc2UgcC5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcjpwLnVwZGF0ZVRpbWVyQ291bnRlcihjKTsKYnJlYWs7Y2FzZSBwLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG86cC51cGRhdGVUaW1lck1vZHVsbyhjKTticmVhaztjYXNlIHAubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w6cC51cGRhdGVUaW1lckNvbnRyb2woYyl9cmV0dXJuITB9YT09PUEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3RlciYmQS51cGRhdGVKb3lwYWQoYyk7aWYoYT09PWsubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KXJldHVybiBrLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZChjKSwhMDthPT09ay5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQmJmsudXBkYXRlSW50ZXJydXB0RW5hYmxlZChjKTtyZXR1cm4hMH1mdW5jdGlvbiBaYShhKXtzd2l0Y2goYT4+MTIpe2Nhc2UgMDpjYXNlIDE6Y2FzZSAyOmNhc2UgMzpyZXR1cm4gYSs4NTA5NDQ7Y2FzZSA0OmNhc2UgNTpjYXNlIDY6Y2FzZSA3OnZhciBjPWQuY3VycmVudFJvbUJhbms7ZC5pc01CQzV8fDAhPT1jfHwoYz0xKTtyZXR1cm4gMTYzODQqCmMrKGEtZC5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb24pKzg1MDk0NDtjYXNlIDg6Y2FzZSA5OnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz15KGQubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmMSksYS1kLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKmM7Y2FzZSAxMDpjYXNlIDExOnJldHVybiA4MTkyKmQuY3VycmVudFJhbUJhbmsrKGEtZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbikrNzE5ODcyO2Nhc2UgMTI6cmV0dXJuIGEtZC5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzI7Y2FzZSAxMzpyZXR1cm4gYz0wLGIuR0JDRW5hYmxlZCYmKGM9eShkLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmspJjcpLDE+YyYmKGM9MSksYS1kLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbisxODQzMis0MDk2KihjLTEpO2RlZmF1bHQ6cmV0dXJuIGEtZC5lY2hvUmFtTG9jYXRpb24rNTEyMDB9fWZ1bmN0aW9uIGgoYSxiKXthPVphKGEpO2dbYV09Yn1mdW5jdGlvbiBPKGEsCmIpe2dbYV09Yj8xOjB9ZnVuY3Rpb24gcmIoYSxjLGYsdSxkLGgpe2Zvcih2YXIgeD11Pj4zOzE2MD5kO2QrKyl7dmFyIGU9ZCtoOzI1Njw9ZSYmKGUtPTI1Nik7dmFyIG09ZiszMip4KyhlPj4zKSxwPVoobSwwKSxrPSExO2lmKFQudGlsZUNhY2hpbmcpe3ZhciBsPWQ7dmFyIEI9YSx0PWUscT1tLHc9cCx2PTA7aWYoMDxCJiY4PGwmJnc9PT1mYS50aWxlSWQmJmw9PT1mYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjayl7dmFyIHo9dz0hMTtuKDUseShxLTEpKSYmKHc9ITApO24oNSx5KHEpKSYmKHo9ITApO2ZvcihxPTA7OD5xO3ErKylpZih3IT09eiYmKHE9Ny1xKSwxNjA+PWwrcSl7Zm9yKHZhciBBPWwtKDgtcSksRD05MzE4NCszKigxNjAqQisobCtxKSksQz0wOzM+QztDKyspYWEobCtxLEIsQyxnW0QrQ10pO0E9Z1s2OTYzMisoMTYwKkIrQSldO0thKGwrcSxCLEsoMixBKSxuKDIsQSkpO3YrK319ZWxzZSBmYS50aWxlSWQ9dztsPj1mYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjayYmCihmYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz1sKzgsQj10JTgsbDxCJiYoZmEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2srPUIpKTtsPXY7MDxsJiYoZCs9bC0xLGs9ITApfVQudGlsZVJlbmRlcmluZyYmIWs/KGs9ZCxsPWEsdj1jLEI9dSU4LHQ9MCwwPT1rJiYodD1lLWUvOCo4KSxlPTcsMTYwPGsrOCYmKGU9MTYwLWspLHc9LTEsej0wLGIuR0JDRW5hYmxlZCYmKHc9WihtLDEpLG4oMyx3KSYmKHo9MSksbig2LHcpJiYoQj03LUIpKSxsPWhiKHAsdix6LHQsZSxCLGssbCwxNjAsOTMxODQsITEsMCx3KSwwPGwmJihkKz1sLTEpKTprfHwoYi5HQkNFbmFibGVkPyhrPWQsbD1hLEI9dSx2PXlhKGMscCksbT1aKG0sMSksQiU9OCxuKDYsbSkmJihCPTctQiksdD0wLG4oMyxtKSYmKHQ9MSkscD1aKHYrMipCLHQpLHY9Wih2KzIqQisxLHQpLEI9ZSU4LG4oNSxtKXx8KEI9Ny1CKSxlPTAsbihCLHYpJiYoZT1lKzE8PDEpLG4oQixwKSYmKGUrPTEpLEI9SmEobSY3LGUsITEpLApwPWNhKDAsQiksdj1jYSgxLEIpLEI9Y2EoMixCKSxhYShrLGwsMCxwKSxhYShrLGwsMSx2KSxhYShrLGwsMixCKSxLYShrLGwsZSxuKDcsbSkpKToobT1kLGs9YSx2PXUsbD15YShjLHApLHYlPTgscD1aKGwrMip2LDApLGw9WihsKzIqdisxLDApLHY9Ny1lJTgsZT0wLG4odixsKSYmKGU9ZSsxPDwxKSxuKHYscCkmJihlKz0xKSxwPUlhKGUsci5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlKSxhYShtLGssMCxwKSxhYShtLGssMSxwKSxhYShtLGssMixwKSxLYShtLGssZSkpKX19ZnVuY3Rpb24gc2IoYSl7aWYoRC5lbmFibGVkKWZvcihyLnNjYW5saW5lQ3ljbGVDb3VudGVyKz1hO3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXI+PXIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTspe3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXItPXIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTthPXIuc2NhbmxpbmVSZWdpc3RlcjtpZigxNDQ9PT1hKXtpZihULmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nKWZvcih2YXIgYj0KMDsxNDQ+PWI7YisrKSRhKGIpO2Vsc2UgJGEoYSk7Zm9yKGI9MDsxNDQ+YjtiKyspZm9yKHZhciBmPTA7MTYwPmY7ZisrKWdbNjk2MzIrKDE2MCpiK2YpXT0wO2ZhLnRpbGVJZD0tMTtmYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz0tMX1lbHNlIDE0ND5hJiYoVC5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZ3x8JGEoYSkpO2E9MTUzPGE/MDphKzE7ci5zY2FubGluZVJlZ2lzdGVyPWF9aWYoRC5lbmFibGVkKXtpZihhPXIuc2NhbmxpbmVSZWdpc3RlcixmPUQuY3VycmVudExjZE1vZGUsYj0wLDE0NDw9YT9iPTE6ci5zY2FubGluZUN5Y2xlQ291bnRlcj49ci5NSU5fQ1lDTEVTX1NQUklURVNfTENEX01PREUoKT9iPTI6ci5zY2FubGluZUN5Y2xlQ291bnRlcj49ci5NSU5fQ1lDTEVTX1RSQU5TRkVSX0RBVEFfTENEX01PREUoKSYmKGI9MyksZiE9PWIpe2Y9eShELm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTtELmN1cnJlbnRMY2RNb2RlPWI7dmFyIHU9ITE7c3dpdGNoKGIpe2Nhc2UgMDpmPQpLKDAsZik7Zj1LKDEsZik7dT1uKDMsZik7YnJlYWs7Y2FzZSAxOmY9SygxLGYpO2Z8PTE7dT1uKDQsZik7YnJlYWs7Y2FzZSAyOmY9SygwLGYpO2Z8PTI7dT1uKDUsZik7YnJlYWs7Y2FzZSAzOmZ8PTN9dSYmKGsuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsemEoay5iaXRQb3NpdGlvbkxjZEludGVycnVwdCkpOzA9PT1iJiZkLmlzSGJsYW5rSGRtYUFjdGl2ZSYmKHU9MTYsZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc8dSYmKHU9ZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmcpLHBiKGQuaGJsYW5rSGRtYVNvdXJjZSxkLmhibGFua0hkbWFEZXN0aW5hdGlvbix1KSxkLmhibGFua0hkbWFTb3VyY2UrPXUsZC5oYmxhbmtIZG1hRGVzdGluYXRpb24rPXUsZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmctPXUsMD49ZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc/KGQuaXNIYmxhbmtIZG1hQWN0aXZlPSExLGgoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLAoyNTUpKTpoKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcixLKDcsZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmcvMTYtMSkpKTsxPT09YiYmKGsuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsemEoay5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCkpO3U9RC5jb2luY2lkZW5jZUNvbXBhcmU7MCE9PWImJjEhPT1ifHxhIT09dT9mPUsoMixmKTooZnw9NCxuKDYsZikmJihrLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSEwLHphKGsuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpKSk7aChELm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGYpfX1lbHNlIHIuc2NhbmxpbmVDeWNsZUNvdW50ZXI9MCxyLnNjYW5saW5lUmVnaXN0ZXI9MCxoKHIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyLDApLGY9eShELm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKSxmPUsoMSxmKSxmPUsoMCxmKSxELmN1cnJlbnRMY2RNb2RlPTAsaChELm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLApmKX1mdW5jdGlvbiAkYShhKXt2YXIgYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ7RC5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0JiYoYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCk7aWYoYi5HQkNFbmFibGVkfHxELmJnRGlzcGxheUVuYWJsZWQpe3ZhciBmPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0O0QuYmdUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGY9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCk7dmFyIHU9ci5zY3JvbGxYLGQ9YStyLnNjcm9sbFk7MjU2PD1kJiYoZC09MjU2KTtyYihhLGMsZixkLDAsdSl9RC53aW5kb3dEaXNwbGF5RW5hYmxlZCYmKGY9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQsRC53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGY9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCksdT1yLndpbmRvd1gsZD1yLndpbmRvd1ksCmE8ZHx8KHUtPTcscmIoYSxjLGYsYS1kLHUsLTEqdSkpKTtpZihELnNwcml0ZURpc3BsYXlFbmFibGUpZm9yKGM9RC50YWxsU3ByaXRlU2l6ZSxmPTM5OzA8PWY7Zi0tKXtkPTQqZjt2YXIgZT15KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCk7dT15KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCsxKTt2YXIgaD15KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCsyKTtlLT0xNjt1LT04O3ZhciBsPTg7YyYmKGw9MTYsMT09PWglMiYmLS1oKTtpZihhPj1lJiZhPGUrbCl7ZD15KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCszKTt2YXIgbT1uKDcsZCksaz1uKDYsZCkscD1uKDUsZCk7ZT1hLWU7ayYmKGUtPWwsZSo9LTEsLS1lKTtlKj0yO2g9eWEoci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQsaCk7bD1oKz1lO2U9MDtiLkdCQ0VuYWJsZWQmJm4oMyxkKSYmKGU9MSk7Cmg9WihsLGUpO2w9WihsKzEsZSk7Zm9yKGU9NzswPD1lO2UtLSl7az1lO3AmJihrLT03LGsqPS0xKTt2YXIgcT0wO24oayxsKSYmKHErPTEscTw8PTEpO24oayxoKSYmKHErPTEpO2lmKDAhPT1xJiYoaz11Kyg3LWUpLDA8PWsmJjE2MD49aykpe3ZhciB0PSExLHY9ITEsdz0hMTtiLkdCQ0VuYWJsZWQmJiFELmJnRGlzcGxheUVuYWJsZWQmJih0PSEwKTtpZighdCl7dmFyIHo9Z1s2OTYzMisoMTYwKmErayldLEE9eiYzO20mJjA8QT92PSEwOmIuR0JDRW5hYmxlZCYmbigyLHopJiYwPEEmJih3PSEwKX1pZih0fHwhdiYmIXcpYi5HQkNFbmFibGVkPyh2PUphKGQmNyxxLCEwKSxxPWNhKDAsdiksdD1jYSgxLHYpLHY9Y2EoMix2KSxhYShrLGEsMCxxKSxhYShrLGEsMSx0KSxhYShrLGEsMix2KSk6KHQ9ci5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVPbmUsbig0LGQpJiYodD1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bykscT1JYShxLHQpLGFhKGssYSwwLHEpLGFhKGssYSwKMSxxKSxhYShrLGEsMixxKSl9fX19fWZ1bmN0aW9uIGFhKGEsYixmLGQpe2dbOTMxODQrMyooMTYwKmIrYSkrZl09ZH1mdW5jdGlvbiBaKGEsYil7cmV0dXJuIGdbYS1kLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKihiJjEpXX1mdW5jdGlvbiBhYihhKXt2YXIgYz1kLnZpZGVvUmFtTG9jYXRpb247cmV0dXJuIGE8Y3x8YT49YyYmYTxkLmNhcnRyaWRnZVJhbUxvY2F0aW9uPy0xOmE+PWQuZWNob1JhbUxvY2F0aW9uJiZhPGQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uP3koYS04MTkyKTphPj1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbiYmYTw9ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQ/Mj5ELmN1cnJlbnRMY2RNb2RlPzI1NTotMTphPT09Yi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoPyhhPTI1NSxjPXkoYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoKSxuKDAsYyl8fChhPUsoMCxhKSksYi5HQkNEb3VibGVTcGVlZHx8KGE9Syg3LAphKSksYSk6YT09PXIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyPyhoKGEsci5zY2FubGluZVJlZ2lzdGVyKSxyLnNjYW5saW5lUmVnaXN0ZXIpOjY1Mjk2PD1hJiY2NTMxOD49YT8oTWEoKSxhPWE9PT1lLm1lbW9yeUxvY2F0aW9uTlI1Mj95KGUubWVtb3J5TG9jYXRpb25OUjUyKSYxMjh8MTEyOi0xLGEpOjY1MzI4PD1hJiY2NTM0Mz49YT8oTWEoKSwtMSk6YT09PXAubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXI/KGM9SChwLmRpdmlkZXJSZWdpc3RlciksaChhLGMpLGMpOmE9PT1wLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyPyhoKGEscC50aW1lckNvdW50ZXIpLHAudGltZXJDb3VudGVyKTphPT09ay5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3Q/MjI0fGsuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlOmE9PT1BLm1lbW9yeUxvY2F0aW9uSm95cGFkUmVnaXN0ZXI/KGE9QS5qb3lwYWRSZWdpc3RlckZsaXBwZWQsQS5pc0RwYWRUeXBlPyhhPUEudXA/SygyLAphKTphfDQsYT1BLnJpZ2h0P0soMCxhKTphfDEsYT1BLmRvd24/SygzLGEpOmF8OCxhPUEubGVmdD9LKDEsYSk6YXwyKTpBLmlzQnV0dG9uVHlwZSYmKGE9QS5hP0soMCxhKTphfDEsYT1BLmI/SygxLGEpOmF8MixhPUEuc2VsZWN0P0soMixhKTphfDQsYT1BLnN0YXJ0P0soMyxhKTphfDgpLGF8MjQwKTotMX1mdW5jdGlvbiB5KGEpe3JldHVybiBnW1phKGEpXX1mdW5jdGlvbiBxYihhKXt2YXIgYj1hYihhKTtzd2l0Y2goYil7Y2FzZSAtMTpyZXR1cm4geShhKTtkZWZhdWx0OnJldHVybiBifX1mdW5jdGlvbiBQKGEpe3JldHVybiAwPGdbYV0/ITA6ITF9ZnVuY3Rpb24gaGEoYSl7UShiLnJlZ2lzdGVyQSxhKTtUYShiLnJlZ2lzdGVyQSxhKTtiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQSthJjI1NTswPT09Yi5yZWdpc3RlckE/bSgxKTptKDApO3QoMCl9ZnVuY3Rpb24gaWEoYSl7dmFyIGM9Yi5yZWdpc3RlckErYStTKCkmMjU1OzAhPSgoYi5yZWdpc3RlckFeYV5jKSYxNik/QygxKTpDKDApOwowPChiLnJlZ2lzdGVyQSthK1MoKSYyNTYpP3coMSk6dygwKTtiLnJlZ2lzdGVyQT1jOzA9PT1iLnJlZ2lzdGVyQT9tKDEpOm0oMCk7dCgwKX1mdW5jdGlvbiBqYShhKXt2YXIgYz0tMSphO1EoYi5yZWdpc3RlckEsYyk7VGEoYi5yZWdpc3RlckEsYyk7Yi5yZWdpc3RlckE9Yi5yZWdpc3RlckEtYSYyNTU7MD09PWIucmVnaXN0ZXJBP20oMSk6bSgwKTt0KDEpfWZ1bmN0aW9uIGthKGEpe3ZhciBjPWIucmVnaXN0ZXJBLWEtUygpJjI1NTswIT0oKGIucmVnaXN0ZXJBXmFeYykmMTYpP0MoMSk6QygwKTswPChiLnJlZ2lzdGVyQS1hLVMoKSYyNTYpP3coMSk6dygwKTtiLnJlZ2lzdGVyQT1jOzA9PT1iLnJlZ2lzdGVyQT9tKDEpOm0oMCk7dCgxKX1mdW5jdGlvbiBsYShhKXtiLnJlZ2lzdGVyQSY9YTswPT09Yi5yZWdpc3RlckE/bSgxKTptKDApO3QoMCk7QygxKTt3KDApfWZ1bmN0aW9uIG1hKGEpe2IucmVnaXN0ZXJBPShiLnJlZ2lzdGVyQV5hKSYyNTU7MD09PWIucmVnaXN0ZXJBP20oMSk6Cm0oMCk7dCgwKTtDKDApO3coMCl9ZnVuY3Rpb24gbmEoYSl7Yi5yZWdpc3RlckF8PWE7MD09PWIucmVnaXN0ZXJBP20oMSk6bSgwKTt0KDApO0MoMCk7dygwKX1mdW5jdGlvbiBvYShhKXthKj0tMTtRKGIucmVnaXN0ZXJBLGEpO1RhKGIucmVnaXN0ZXJBLGEpOzA9PT1iLnJlZ2lzdGVyQSthP20oMSk6bSgwKTt0KDEpfWZ1bmN0aW9uIHRhKGEsYil7MD09PShiJjE8PGEpP20oMSk6bSgwKTt0KDApO0MoMSk7cmV0dXJuIGJ9ZnVuY3Rpb24gWShhLGIsZil7cmV0dXJuIDA8Yj9mfDE8PGE6ZiZ+KDE8PGEpfWZ1bmN0aW9uIEJhKGEpe2E9U2EoYSk7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyK2EmNjU1MzU7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzV9ZnVuY3Rpb24gdGIoYSl7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7Yi5pc0hhbHRCdWcmJihiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXItMSY2NTUzNSk7CnN3aXRjaCgoYSYyNDApPj40KXtjYXNlIDA6cmV0dXJuIEViKGEpO2Nhc2UgMTpyZXR1cm4gRmIoYSk7Y2FzZSAyOnJldHVybiBHYihhKTtjYXNlIDM6cmV0dXJuIEhiKGEpO2Nhc2UgNDpyZXR1cm4gSWIoYSk7Y2FzZSA1OnJldHVybiBKYihhKTtjYXNlIDY6cmV0dXJuIEtiKGEpO2Nhc2UgNzpyZXR1cm4gTGIoYSk7Y2FzZSA4OnJldHVybiBNYihhKTtjYXNlIDk6cmV0dXJuIE5iKGEpO2Nhc2UgMTA6cmV0dXJuIE9iKGEpO2Nhc2UgMTE6cmV0dXJuIFBiKGEpO2Nhc2UgMTI6cmV0dXJuIFFiKGEpO2Nhc2UgMTM6cmV0dXJuIFJiKGEpO2Nhc2UgMTQ6cmV0dXJuIFNiKGEpO2RlZmF1bHQ6cmV0dXJuIFRiKGEpfX1mdW5jdGlvbiBKKGEpe3BhKDQpO3JldHVybiBxYihhKX1mdW5jdGlvbiBSKGEsYil7cGEoNCk7UGEoYSxiKSYmaChhLGIpfWZ1bmN0aW9uIGRhKGEpe3BhKDgpO3ZhciBiPWFiKGEpO3N3aXRjaChiKXtjYXNlIC0xOmI9eShhKX1hKz0xO3ZhciBmPWFiKGEpO3N3aXRjaChmKXtjYXNlIC0xOmE9CnkoYSk7YnJlYWs7ZGVmYXVsdDphPWZ9cmV0dXJuIGwoYSxiKX1mdW5jdGlvbiBVKGEsYil7cGEoOCk7dmFyIGM9SChiKTtiJj0yNTU7dmFyIGQ9YSsxO1BhKGEsYikmJmgoYSxiKTtQYShkLGMpJiZoKGQsYyl9ZnVuY3Rpb24gRygpe3BhKDQpO3JldHVybiB5KGIucHJvZ3JhbUNvdW50ZXIpfWZ1bmN0aW9uIFgoKXtwYSg0KTt2YXIgYT15KGIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSk7cmV0dXJuIGwoYSxHKCkpfWZ1bmN0aW9uIEViKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIDQ7Y2FzZSAxOnJldHVybiBhPVgoKSxiLnJlZ2lzdGVyQj1IKGEpLGIucmVnaXN0ZXJDPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAyOnJldHVybiBSKGwoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMzpyZXR1cm4gYT1sKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxhKyssYi5yZWdpc3RlckI9SChhKSxiLnJlZ2lzdGVyQz0KYSYyNTUsODtjYXNlIDQ6cmV0dXJuIFEoYi5yZWdpc3RlckIsMSksYi5yZWdpc3RlckI9Yi5yZWdpc3RlckIrMSYyNTUsMD09PWIucmVnaXN0ZXJCP20oMSk6bSgwKSx0KDApLDQ7Y2FzZSA1OnJldHVybiBRKGIucmVnaXN0ZXJCLC0xKSxiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQi0xJjI1NSwwPT09Yi5yZWdpc3RlckI/bSgxKTptKDApLHQoMSksNDtjYXNlIDY6cmV0dXJuIGIucmVnaXN0ZXJCPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNzoxMjg9PT0oYi5yZWdpc3RlckEmMTI4KT93KDEpOncoMCk7YT1iO3ZhciBjPWIucmVnaXN0ZXJBO2EucmVnaXN0ZXJBPShjPDwxfGM+PjcpJjI1NTttKDApO3QoMCk7QygwKTtyZXR1cm4gNDtjYXNlIDg6cmV0dXJuIFUoWCgpLGIuc3RhY2tQb2ludGVyKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgOTpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSwKYz1sKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSx1YShhLGMsITEpLGE9YStjJjY1NTM1LGIucmVnaXN0ZXJIPUgoYSksYi5yZWdpc3Rlckw9YSYyNTUsdCgwKSw4O2Nhc2UgMTA6cmV0dXJuIGIucmVnaXN0ZXJBPUoobChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDQ7Y2FzZSAxMTpyZXR1cm4gYT1sKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyQj1IKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSAxMjpyZXR1cm4gUShiLnJlZ2lzdGVyQywxKSxiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQysxJjI1NSwwPT09Yi5yZWdpc3RlckM/bSgxKTptKDApLHQoMCksNDtjYXNlIDEzOnJldHVybiBRKGIucmVnaXN0ZXJDLC0xKSxiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQy0xJjI1NSwwPT09Yi5yZWdpc3RlckM/bSgxKTptKDApLHQoMSksNDtjYXNlIDE0OnJldHVybiBiLnJlZ2lzdGVyQz1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKwoxJjY1NTM1LDQ7Y2FzZSAxNTpyZXR1cm4gMDwoYi5yZWdpc3RlckEmMSk/dygxKTp3KDApLGE9YixjPWIucmVnaXN0ZXJBLGEucmVnaXN0ZXJBPShjPj4xfGM8PDcpJjI1NSxtKDApLHQoMCksQygwKSw0fXJldHVybi0xfWZ1bmN0aW9uIEZiKGEpe3N3aXRjaChhKXtjYXNlIDE2OmlmKGIuR0JDRW5hYmxlZCYmKGE9SihiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLG4oMCxhKSkpcmV0dXJuIGE9SygwLGEpLG4oNyxhKT8oYi5HQkNEb3VibGVTcGVlZD0hMSxhPUsoNyxhKSk6KGIuR0JDRG91YmxlU3BlZWQ9ITAsYXw9MTI4KSxSKGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCxhKSw2ODtiLmlzU3RvcHBlZD0hMDtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtyZXR1cm4gNDtjYXNlIDE3OnJldHVybiBhPVgoKSxiLnJlZ2lzdGVyRD1IKGEpLGIucmVnaXN0ZXJFPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7CmNhc2UgMTg6cmV0dXJuIFIobChiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSksYi5yZWdpc3RlckEpLDQ7Y2FzZSAxOTpyZXR1cm4gYT1sKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVyRD1IKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDg7Y2FzZSAyMDpyZXR1cm4gUShiLnJlZ2lzdGVyRCwxKSxiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyRCsxJjI1NSwwPT09Yi5yZWdpc3RlckQ/bSgxKTptKDApLHQoMCksNDtjYXNlIDIxOnJldHVybiBRKGIucmVnaXN0ZXJELC0xKSxiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyRC0xJjI1NSwwPT09Yi5yZWdpc3RlckQ/bSgxKTptKDApLHQoMSksNDtjYXNlIDIyOnJldHVybiBiLnJlZ2lzdGVyRD1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzOnJldHVybiBhPSExLDEyOD09PShiLnJlZ2lzdGVyQSYxMjgpJiYoYT0hMCksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPDwxfFMoKSkmCjI1NSxhP3coMSk6dygwKSxtKDApLHQoMCksQygwKSw0O2Nhc2UgMjQ6cmV0dXJuIEJhKEcoKSksODtjYXNlIDI1OmE9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9bChiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSk7dWEoYSxjLCExKTthPWErYyY2NTUzNTtiLnJlZ2lzdGVySD1IKGEpO2IucmVnaXN0ZXJMPWEmMjU1O3QoMCk7cmV0dXJuIDg7Y2FzZSAyNjpyZXR1cm4gYT1sKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQT1KKGEpLDQ7Y2FzZSAyNzpyZXR1cm4gYT1sKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyRD1IKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDg7Y2FzZSAyODpyZXR1cm4gUShiLnJlZ2lzdGVyRSwxKSxiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyRSsxJjI1NSwwPT09Yi5yZWdpc3RlckU/bSgxKTptKDApLHQoMCksNDtjYXNlIDI5OnJldHVybiBRKGIucmVnaXN0ZXJFLC0xKSxiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyRS0KMSYyNTUsMD09PWIucmVnaXN0ZXJFP20oMSk6bSgwKSx0KDEpLDQ7Y2FzZSAzMDpyZXR1cm4gYi5yZWdpc3RlckU9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAzMTpyZXR1cm4gYT0hMSwxPT09KGIucmVnaXN0ZXJBJjEpJiYoYT0hMCksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPj4xfFMoKTw8NykmMjU1LGE/dygxKTp3KDApLG0oMCksdCgwKSxDKDApLDR9cmV0dXJuLTF9ZnVuY3Rpb24gR2IoYSl7c3dpdGNoKGEpe2Nhc2UgMzI6cmV0dXJuIDA9PT1xYSgpP0JhKEcoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDMzOnJldHVybiBhPVgoKSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAzNDpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxSKGEsYi5yZWdpc3RlckEpLAphPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSAzNTpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSAzNjpyZXR1cm4gUShiLnJlZ2lzdGVySCwxKSxiLnJlZ2lzdGVySD1iLnJlZ2lzdGVySCsxJjI1NSwwPT09Yi5yZWdpc3Rlckg/bSgxKTptKDApLHQoMCksNDtjYXNlIDM3OnJldHVybiBRKGIucmVnaXN0ZXJILC0xKSxiLnJlZ2lzdGVySD1iLnJlZ2lzdGVySC0xJjI1NSwwPT09Yi5yZWdpc3Rlckg/bSgxKTptKDApLHQoMSksNDtjYXNlIDM4OnJldHVybiBiLnJlZ2lzdGVySD1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDM5OnZhciBjPTA7MDwoYi5yZWdpc3RlckY+PjUmMSkmJihjfD02KTswPFMoKSYmKGN8PTk2KTswPChiLnJlZ2lzdGVyRj4+NiYxKT9hPWIucmVnaXN0ZXJBLQpjJjI1NTooOTwoYi5yZWdpc3RlckEmMTUpJiYoY3w9NiksMTUzPGIucmVnaXN0ZXJBJiYoY3w9OTYpLGE9Yi5yZWdpc3RlckErYyYyNTUpOzA9PT1hP20oMSk6bSgwKTswIT09KGMmOTYpP3coMSk6dygwKTtDKDApO2IucmVnaXN0ZXJBPWE7cmV0dXJuIDQ7Y2FzZSA0MDpyZXR1cm4gMDxxYSgpP0JhKEcoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDQxOnJldHVybiBhPWwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLHVhKGEsYSwhMSksYT0yKmEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSx0KDApLDg7Y2FzZSA0MjpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQT1KKGEpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUgoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDQzOnJldHVybiBhPWwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJIPQpIKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSA0NDpyZXR1cm4gUShiLnJlZ2lzdGVyTCwxKSxiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCsxJjI1NSwwPT09Yi5yZWdpc3Rlckw/bSgxKTptKDApLHQoMCksNDtjYXNlIDQ1OnJldHVybiBRKGIucmVnaXN0ZXJMLC0xKSxiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTC0xJjI1NSwwPT09Yi5yZWdpc3Rlckw/bSgxKTptKDApLHQoMSksNDtjYXNlIDQ2OnJldHVybiBiLnJlZ2lzdGVyTD1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDQ3OnJldHVybiBiLnJlZ2lzdGVyQT1+Yi5yZWdpc3RlckEsdCgxKSxDKDEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSGIoYSl7c3dpdGNoKGEpe2Nhc2UgNDg6cmV0dXJuIDA9PT1TKCk/QmEoRygpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgNDk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPVgoKSxiLnByb2dyYW1Db3VudGVyPQpiLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDUwOnJldHVybiBhPWwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLFIoYSxiLnJlZ2lzdGVyQSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNTE6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzEmNjU1MzUsODtjYXNlIDUyOmE9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9SihhKTtRKGMsMSk7Yz1jKzEmMjU1OzA9PT1jP20oMSk6bSgwKTt0KDApO1IoYSxjKTtyZXR1cm4gNDtjYXNlIDUzOnJldHVybiBhPWwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGM9SihhKSxRKGMsLTEpLGM9Yy0xJjI1NSwwPT09Yz9tKDEpOm0oMCksdCgxKSxSKGEsYyksNDtjYXNlIDU0OnJldHVybiBSKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDU1OnJldHVybiB0KDApLApDKDApLHcoMSksNDtjYXNlIDU2OnJldHVybiAxPT09UygpP0JhKEcoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDU3OnJldHVybiBhPWwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLHVhKGEsYi5zdGFja1BvaW50ZXIsITEpLGE9YStiLnN0YWNrUG9pbnRlciY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHQoMCksODtjYXNlIDU4OnJldHVybiBhPWwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBPUooYSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTEmNjU1MzUsODtjYXNlIDYwOnJldHVybiBRKGIucmVnaXN0ZXJBLDEpLGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJBKzEmMjU1LDA9PT1iLnJlZ2lzdGVyQT9tKDEpOm0oMCksdCgwKSw0O2Nhc2UgNjE6cmV0dXJuIFEoYi5yZWdpc3RlckEsCi0xKSxiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQS0xJjI1NSwwPT09Yi5yZWdpc3RlckE/bSgxKTptKDApLHQoMSksNDtjYXNlIDYyOnJldHVybiBiLnJlZ2lzdGVyQT1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDYzOnJldHVybiB0KDApLEMoMCksMDxTKCk/dygwKTp3KDEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSWIoYSl7c3dpdGNoKGEpe2Nhc2UgNjQ6cmV0dXJuIDQ7Y2FzZSA2NTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckMsNDtjYXNlIDY2OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyRCw0O2Nhc2UgNjc6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJFLDQ7Y2FzZSA2ODpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckgsNDtjYXNlIDY5OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyTCw0O2Nhc2UgNzA6cmV0dXJuIGIucmVnaXN0ZXJCPUoobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA3MTpyZXR1cm4gYi5yZWdpc3RlckI9CmIucmVnaXN0ZXJBLDQ7Y2FzZSA3MjpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckIsNDtjYXNlIDczOnJldHVybiA0O2Nhc2UgNzQ6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJELDQ7Y2FzZSA3NTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckUsNDtjYXNlIDc2OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVySCw0O2Nhc2UgNzc6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJMLDQ7Y2FzZSA3ODpyZXR1cm4gYi5yZWdpc3RlckM9SihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDc5OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIEpiKGEpe3N3aXRjaChhKXtjYXNlIDgwOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQiw0O2Nhc2UgODE6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJDLDQ7Y2FzZSA4MjpyZXR1cm4gNDtjYXNlIDgzOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyRSwKNDtjYXNlIDg0OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVySCw0O2Nhc2UgODU6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJMLDQ7Y2FzZSA4NjpyZXR1cm4gYi5yZWdpc3RlckQ9SihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDg3OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQSw0O2Nhc2UgODg6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJCLDQ7Y2FzZSA4OTpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckMsNDtjYXNlIDkwOnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyRCw0O2Nhc2UgOTE6cmV0dXJuIDQ7Y2FzZSA5MjpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckgsNDtjYXNlIDkzOnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyTCw0O2Nhc2UgOTQ6cmV0dXJuIGIucmVnaXN0ZXJFPUoobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA5NTpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckEsCjR9cmV0dXJuLTF9ZnVuY3Rpb24gS2IoYSl7c3dpdGNoKGEpe2Nhc2UgOTY6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJCLDQ7Y2FzZSA5NzpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckMsNDtjYXNlIDk4OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyRCw0O2Nhc2UgOTk6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMDA6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILDQ7Y2FzZSAxMDE6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMDI6cmV0dXJuIGIucmVnaXN0ZXJIPUoobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSAxMDM6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJBLDQ7Y2FzZSAxMDQ6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJCLDQ7Y2FzZSAxMDU6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJDLDQ7Y2FzZSAxMDY6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJELAo0O2Nhc2UgMTA3OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTA4OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVySCw0O2Nhc2UgMTA5OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTEwOnJldHVybiBiLnJlZ2lzdGVyTD1KKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTExOnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIExiKGEpe3N3aXRjaChhKXtjYXNlIDExMjpyZXR1cm4gUihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQiksNDtjYXNlIDExMzpyZXR1cm4gUihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQyksNDtjYXNlIDExNDpyZXR1cm4gUihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyRCksNDtjYXNlIDExNTpyZXR1cm4gUihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyRSksCjQ7Y2FzZSAxMTY6cmV0dXJuIFIobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckgpLDQ7Y2FzZSAxMTc6cmV0dXJuIFIobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMTg6cmV0dXJuIGQuaXNIYmxhbmtIZG1hQWN0aXZlfHxiLmVuYWJsZUhhbHQoKSw0O2Nhc2UgMTE5OnJldHVybiBSKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTIwOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQiw0O2Nhc2UgMTIxOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQyw0O2Nhc2UgMTIyOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyRCw0O2Nhc2UgMTIzOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTI0OnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVySCw0O2Nhc2UgMTI1OnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTI2OnJldHVybiBiLnJlZ2lzdGVyQT0KSihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDEyNzpyZXR1cm4gNH1yZXR1cm4tMX1mdW5jdGlvbiBNYihhKXtzd2l0Y2goYSl7Y2FzZSAxMjg6cmV0dXJuIGhhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTI5OnJldHVybiBoYShiLnJlZ2lzdGVyQyksNDtjYXNlIDEzMDpyZXR1cm4gaGEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMzE6cmV0dXJuIGhhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTMyOnJldHVybiBoYShiLnJlZ2lzdGVySCksNDtjYXNlIDEzMzpyZXR1cm4gaGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMzQ6cmV0dXJuIGE9SihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksaGEoYSksNDtjYXNlIDEzNTpyZXR1cm4gaGEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxMzY6cmV0dXJuIGlhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTM3OnJldHVybiBpYShiLnJlZ2lzdGVyQyksNDtjYXNlIDEzODpyZXR1cm4gaWEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMzk6cmV0dXJuIGlhKGIucmVnaXN0ZXJFKSwKNDtjYXNlIDE0MDpyZXR1cm4gaWEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNDE6cmV0dXJuIGlhKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTQyOnJldHVybiBhPUoobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGlhKGEpLDQ7Y2FzZSAxNDM6cmV0dXJuIGlhKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIE5iKGEpe3N3aXRjaChhKXtjYXNlIDE0NDpyZXR1cm4gamEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNDU6cmV0dXJuIGphKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTQ2OnJldHVybiBqYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE0NzpyZXR1cm4gamEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNDg6cmV0dXJuIGphKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTQ5OnJldHVybiBqYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE1MDpyZXR1cm4gYT1KKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxqYShhKSw0O2Nhc2UgMTUxOnJldHVybiBqYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE1MjpyZXR1cm4ga2EoYi5yZWdpc3RlckIpLAo0O2Nhc2UgMTUzOnJldHVybiBrYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE1NDpyZXR1cm4ga2EoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNTU6cmV0dXJuIGthKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTU2OnJldHVybiBrYShiLnJlZ2lzdGVySCksNDtjYXNlIDE1NzpyZXR1cm4ga2EoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTg6cmV0dXJuIGE9SihsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksa2EoYSksNDtjYXNlIDE1OTpyZXR1cm4ga2EoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gT2IoYSl7c3dpdGNoKGEpe2Nhc2UgMTYwOnJldHVybiBsYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE2MTpyZXR1cm4gbGEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNjI6cmV0dXJuIGxhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTYzOnJldHVybiBsYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE2NDpyZXR1cm4gbGEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNjU6cmV0dXJuIGxhKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTY2OnJldHVybiBhPQpKKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxsYShhKSw0O2Nhc2UgMTY3OnJldHVybiBsYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE2ODpyZXR1cm4gbWEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNjk6cmV0dXJuIG1hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTcwOnJldHVybiBtYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE3MTpyZXR1cm4gbWEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNzI6cmV0dXJuIG1hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTczOnJldHVybiBtYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE3NDpyZXR1cm4gYT1KKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxtYShhKSw0O2Nhc2UgMTc1OnJldHVybiBtYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBQYihhKXtzd2l0Y2goYSl7Y2FzZSAxNzY6cmV0dXJuIG5hKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTc3OnJldHVybiBuYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE3ODpyZXR1cm4gbmEoYi5yZWdpc3RlckQpLDQ7CmNhc2UgMTc5OnJldHVybiBuYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE4MDpyZXR1cm4gbmEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxODE6cmV0dXJuIG5hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTgyOnJldHVybiBhPUoobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLG5hKGEpLDQ7Y2FzZSAxODM6cmV0dXJuIG5hKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTg0OnJldHVybiBvYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE4NTpyZXR1cm4gb2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxODY6cmV0dXJuIG9hKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTg3OnJldHVybiBvYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE4ODpyZXR1cm4gb2EoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxODk6cmV0dXJuIG9hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTkwOnJldHVybiBhPUoobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLG9hKGEpLDQ7Y2FzZSAxOTE6cmV0dXJuIG9hKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIFFiKGEpe3N3aXRjaChhKXtjYXNlIDE5MjpyZXR1cm4gMD09PQpxYSgpPyhiLnByb2dyYW1Db3VudGVyPWRhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDEyKTo4O2Nhc2UgMTkzOnJldHVybiBhPWRhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJCPUgoYSksYi5yZWdpc3RlckM9YSYyNTUsNDtjYXNlIDE5NDppZigwPT09cWEoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1YKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAxOTU6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WCgpLDg7Y2FzZSAxOTY6aWYoMD09PXFhKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9WCgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKwoyJjY1NTM1O3JldHVybiAxMjtjYXNlIDE5NzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGwoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpKSw4O2Nhc2UgMTk4OnJldHVybiBoYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAxOTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTAsODtjYXNlIDIwMDpyZXR1cm4gMT09PXFhKCk/KGIucHJvZ3JhbUNvdW50ZXI9ZGEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAyMDE6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9ZGEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsODtjYXNlIDIwMjppZigxPT09CnFhKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WCgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjAzOnZhciBjPUcoKTthPS0xO3ZhciBmPSExLGQ9MCxlPTAsZz1jJTg7c3dpdGNoKGcpe2Nhc2UgMDpkPWIucmVnaXN0ZXJCO2JyZWFrO2Nhc2UgMTpkPWIucmVnaXN0ZXJDO2JyZWFrO2Nhc2UgMjpkPWIucmVnaXN0ZXJEO2JyZWFrO2Nhc2UgMzpkPWIucmVnaXN0ZXJFO2JyZWFrO2Nhc2UgNDpkPWIucmVnaXN0ZXJIO2JyZWFrO2Nhc2UgNTpkPWIucmVnaXN0ZXJMO2JyZWFrO2Nhc2UgNjpkPUoobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpO2JyZWFrO2Nhc2UgNzpkPWIucmVnaXN0ZXJBfXZhciBoPShjJjI0MCk+PjQ7c3dpdGNoKGgpe2Nhc2UgMDo3Pj1jPyhjPWQsMTI4PT09KGMmMTI4KT93KDEpOncoMCksYz0oYzw8MXxjPj43KSYyNTUsMD09PWM/bSgxKTptKDApLHQoMCksQygwKSxlPWMsZj0hMCk6MTU+PWMmJgooYz1kLDA8KGMmMSk/dygxKTp3KDApLGM9KGM+PjF8Yzw8NykmMjU1LDA9PT1jP20oMSk6bSgwKSx0KDApLEMoMCksZT1jLGY9ITApO2JyZWFrO2Nhc2UgMToyMz49Yz8oYz1kLGY9ITEsMTI4PT09KGMmMTI4KSYmKGY9ITApLGM9KGM8PDF8UygpKSYyNTUsZj93KDEpOncoMCksMD09PWM/bSgxKTptKDApLHQoMCksQygwKSxlPWMsZj0hMCk6MzE+PWMmJihjPWQsZj0hMSwxPT09KGMmMSkmJihmPSEwKSxjPShjPj4xfFMoKTw8NykmMjU1LGY/dygxKTp3KDApLDA9PT1jP20oMSk6bSgwKSx0KDApLEMoMCksZT1jLGY9ITApO2JyZWFrO2Nhc2UgMjozOT49Yz8oYz1kLGY9ITEsMTI4PT09KGMmMTI4KSYmKGY9ITApLGM9Yzw8MSYyNTUsZj93KDEpOncoMCksMD09PWM/bSgxKTptKDApLHQoMCksQygwKSxlPWMsZj0hMCk6NDc+PWMmJihjPWQsZj0hMSwxMjg9PT0oYyYxMjgpJiYoZj0hMCksZD0hMSwxPT09KGMmMSkmJihkPSEwKSxjPWM+PjEmMjU1LGYmJihjfD0xMjgpLDA9PT1jP20oMSk6Cm0oMCksdCgwKSxDKDApLGQ/dygxKTp3KDApLGU9YyxmPSEwKTticmVhaztjYXNlIDM6NTU+PWM/KGM9ZCxjPSgoYyYxNSk8PDR8KGMmMjQwKT4+NCkmMjU1LDA9PT1jP20oMSk6bSgwKSx0KDApLEMoMCksdygwKSxlPWMsZj0hMCk6NjM+PWMmJihjPWQsZj0hMSwxPT09KGMmMSkmJihmPSEwKSxjPWM+PjEmMjU1LDA9PT1jP20oMSk6bSgwKSx0KDApLEMoMCksZj93KDEpOncoMCksZT1jLGY9ITApO2JyZWFrO2Nhc2UgNDo3MT49Yz8oZT10YSgwLGQpLGY9ITApOjc5Pj1jJiYoZT10YSgxLGQpLGY9ITApO2JyZWFrO2Nhc2UgNTo4Nz49Yz8oZT10YSgyLGQpLGY9ITApOjk1Pj1jJiYoZT10YSgzLGQpLGY9ITApO2JyZWFrO2Nhc2UgNjoxMDM+PWM/KGU9dGEoNCxkKSxmPSEwKToxMTE+PWMmJihlPXRhKDUsZCksZj0hMCk7YnJlYWs7Y2FzZSA3OjExOT49Yz8oZT10YSg2LGQpLGY9ITApOjEyNz49YyYmKGU9dGEoNyxkKSxmPSEwKTticmVhaztjYXNlIDg6MTM1Pj1jPyhlPVkoMCwwLGQpLApmPSEwKToxNDM+PWMmJihlPVkoMSwwLGQpLGY9ITApO2JyZWFrO2Nhc2UgOToxNTE+PWM/KGU9WSgyLDAsZCksZj0hMCk6MTU5Pj1jJiYoZT1ZKDMsMCxkKSxmPSEwKTticmVhaztjYXNlIDEwOjE2Nz49Yz8oZT1ZKDQsMCxkKSxmPSEwKToxNzU+PWMmJihlPVkoNSwwLGQpLGY9ITApO2JyZWFrO2Nhc2UgMTE6MTgzPj1jPyhlPVkoNiwwLGQpLGY9ITApOjE5MT49YyYmKGU9WSg3LDAsZCksZj0hMCk7YnJlYWs7Y2FzZSAxMjoxOTk+PWM/KGU9WSgwLDEsZCksZj0hMCk6MjA3Pj1jJiYoZT1ZKDEsMSxkKSxmPSEwKTticmVhaztjYXNlIDEzOjIxNT49Yz8oZT1ZKDIsMSxkKSxmPSEwKToyMjM+PWMmJihlPVkoMywxLGQpLGY9ITApO2JyZWFrO2Nhc2UgMTQ6MjMxPj1jPyhlPVkoNCwxLGQpLGY9ITApOjIzOT49YyYmKGU9WSg1LDEsZCksZj0hMCk7YnJlYWs7Y2FzZSAxNToyNDc+PWM/KGU9WSg2LDEsZCksZj0hMCk6MjU1Pj1jJiYoZT1ZKDcsMSxkKSxmPSEwKX1zd2l0Y2goZyl7Y2FzZSAwOmIucmVnaXN0ZXJCPQplO2JyZWFrO2Nhc2UgMTpiLnJlZ2lzdGVyQz1lO2JyZWFrO2Nhc2UgMjpiLnJlZ2lzdGVyRD1lO2JyZWFrO2Nhc2UgMzpiLnJlZ2lzdGVyRT1lO2JyZWFrO2Nhc2UgNDpiLnJlZ2lzdGVySD1lO2JyZWFrO2Nhc2UgNTpiLnJlZ2lzdGVyTD1lO2JyZWFrO2Nhc2UgNjooND5ofHw3PGgpJiZSKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGUpO2JyZWFrO2Nhc2UgNzpiLnJlZ2lzdGVyQT1lfWYmJihhPTQpO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1O3JldHVybiBhO2Nhc2UgMjA0OmlmKDE9PT1xYSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyKSxiLnByb2dyYW1Db3VudGVyPVgoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIwNTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItCjImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9WCgpLDg7Y2FzZSAyMDY6cmV0dXJuIGlhKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIwNzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9OH1yZXR1cm4tMX1mdW5jdGlvbiBSYihhKXtzd2l0Y2goYSl7Y2FzZSAyMDg6cmV0dXJuIDA9PT1TKCk/KGIucHJvZ3JhbUNvdW50ZXI9ZGEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAyMDk6cmV0dXJuIGE9ZGEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckQ9SChhKSxiLnJlZ2lzdGVyRT1hJjI1NSw0OwpjYXNlIDIxMDppZigwPT09UygpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVgoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIxMjppZigwPT09UygpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyKSxiLnByb2dyYW1Db3VudGVyPVgoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIxMzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGwoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpKSw4O2Nhc2UgMjE0OnJldHVybiBqYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMTU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsClUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0xNiw4O2Nhc2UgMjE2OnJldHVybiAxPT09UygpPyhiLnByb2dyYW1Db3VudGVyPWRhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDEyKTo4O2Nhc2UgMjE3OnJldHVybiBiLnByb2dyYW1Db3VudGVyPWRhKGIuc3RhY2tQb2ludGVyKSxPYSghMCksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSw4O2Nhc2UgMjE4OmlmKDE9PT1TKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WCgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjIwOmlmKDE9PT1TKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9WCgpLDg7Yi5wcm9ncmFtQ291bnRlcj0KYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIyMjpyZXR1cm4ga2EoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjIzOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0yNCw4fXJldHVybi0xfWZ1bmN0aW9uIFNiKGEpe3N3aXRjaChhKXtjYXNlIDIyNDpyZXR1cm4gYT1HKCksUig2NTI4MCthLGIucmVnaXN0ZXJBKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjI1OnJldHVybiBhPWRhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJIPUgoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDIyNjpyZXR1cm4gUig2NTI4MCtiLnJlZ2lzdGVyQyxiLnJlZ2lzdGVyQSksNDtjYXNlIDIyOTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9CmIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksODtjYXNlIDIzMDpyZXR1cm4gbGEoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjMxOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0zMiw4O2Nhc2UgMjMyOnJldHVybiBhPVNhKEcoKSksdWEoYi5zdGFja1BvaW50ZXIsYSwhMCksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrYSY2NTUzNSxtKDApLHQoMCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsMTI7Y2FzZSAyMzM6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksNDtjYXNlIDIzNDpyZXR1cm4gUihYKCksYi5yZWdpc3RlckEpLGIucHJvZ3JhbUNvdW50ZXI9CmIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjM4OnJldHVybiBtYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMzk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTQwLDh9cmV0dXJuLTF9ZnVuY3Rpb24gVGIoYSl7c3dpdGNoKGEpe2Nhc2UgMjQwOnJldHVybiBhPUcoKSxiLnJlZ2lzdGVyQT1KKDY1MjgwK2EpJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjQxOnJldHVybiBhPWRhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJBPUgoYSksYi5yZWdpc3RlckY9YSYyNTUsNDtjYXNlIDI0MjpyZXR1cm4gYi5yZWdpc3RlckE9Sig2NTI4MCtiLnJlZ2lzdGVyQykmMjU1LDQ7Y2FzZSAyNDM6cmV0dXJuIE9hKCExKSwKNDtjYXNlIDI0NTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGwoYi5yZWdpc3RlckEsYi5yZWdpc3RlckYpKSw4O2Nhc2UgMjQ2OnJldHVybiBuYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyNDc6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTQ4LDg7Y2FzZSAyNDg6cmV0dXJuIGE9U2EoRygpKSxtKDApLHQoMCksdWEoYi5zdGFja1BvaW50ZXIsYSwhMCksYT1iLnN0YWNrUG9pbnRlcithJjY1NTM1LGIucmVnaXN0ZXJIPUgoYSksYi5yZWdpc3Rlckw9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDI0OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksCjg7Y2FzZSAyNTA6cmV0dXJuIGIucmVnaXN0ZXJBPUooWCgpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjUxOnJldHVybiBPYSghMCksNDtjYXNlIDI1NDpyZXR1cm4gb2EoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjU1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj01Niw4fXJldHVybi0xfWZ1bmN0aW9uIHBhKGEpezA8ZC5ETUFDeWNsZXMmJihhKz1kLkRNQUN5Y2xlcyxkLkRNQUN5Y2xlcz0wKTtiLmN1cnJlbnRDeWNsZXMrPWE7aWYoIWIuaXNTdG9wcGVkKXtpZihULmdyYXBoaWNzQmF0Y2hQcm9jZXNzaW5nKXtpZihyLmN1cnJlbnRDeWNsZXMrPWEsIShyLmN1cnJlbnRDeWNsZXM8ci5iYXRjaFByb2Nlc3NDeWNsZXMoKSkpZm9yKDtyLmN1cnJlbnRDeWNsZXM+PQpyLmJhdGNoUHJvY2Vzc0N5Y2xlcygpOylzYihyLmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSxyLmN1cnJlbnRDeWNsZXMtPXIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCl9ZWxzZSBzYihhKTtULmF1ZGlvQmF0Y2hQcm9jZXNzaW5nP2UuY3VycmVudEN5Y2xlcys9YTpsYihhKX1ULnRpbWVyc0JhdGNoUHJvY2Vzc2luZz8ocC5jdXJyZW50Q3ljbGVzKz1hLFdhKHAuY3VycmVudEN5Y2xlcykscC5jdXJyZW50Q3ljbGVzPTApOldhKGEpO1YuY3ljbGVzKz1hO1YuY3ljbGVzPj1WLmN5Y2xlc1BlckN5Y2xlU2V0JiYoVi5jeWNsZVNldHMrPTEsVi5jeWNsZXMtPVYuY3ljbGVzUGVyQ3ljbGVTZXQpfWZ1bmN0aW9uIGJiKCl7cmV0dXJuIFFhKCEwLC0xLC0xKX1mdW5jdGlvbiBRYShhLGMsZil7dm9pZCAwPT09YyYmKGM9LTEpO3ZvaWQgMD09PWYmJihmPS0xKTthPTEwMjQ7MDxjP2E9YzowPmMmJihhPS0xKTtmb3IodmFyIGQ9ITEsZT0hMSxnPSExLGg9ITE7IShkfHxlfHxnfHxoKTspYz1jYigpLDA+Yz8KZD0hMDpiLmN1cnJlbnRDeWNsZXM+PWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKT9lPSEwOi0xPGEmJlVhKCk+PWE/Zz0hMDotMTxmJiZiLnByb2dyYW1Db3VudGVyPT09ZiYmKGg9ITApO2lmKGUpcmV0dXJuIGIuY3VycmVudEN5Y2xlcy09Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpLDA7aWYoZylyZXR1cm4gMTtpZihoKXJldHVybiAyO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlci0xJjY1NTM1O3JldHVybi0xfWZ1bmN0aW9uIGNiKCl7Q2E9ITA7aWYoYi5pc0hhbHRCdWcpe3ZhciBhPXkoYi5wcm9ncmFtQ291bnRlcik7YT10YihhKTtwYShhKTtiLmV4aXRIYWx0QW5kU3RvcCgpfWsubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXkmJihrLm1hc3RlckludGVycnVwdFN3aXRjaD0hMCxrLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PSExKTtpZigwPChrLmludGVycnVwdHNFbmFibGVkVmFsdWUmay5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmMzEpKXthPSExO2subWFzdGVySW50ZXJydXB0U3dpdGNoJiYKIWIuaXNIYWx0Tm9KdW1wJiYoay5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQmJmsuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KE5hKGsuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQpLGE9ITApOmsuaXNMY2RJbnRlcnJ1cHRFbmFibGVkJiZrLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPyhOYShrLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSxhPSEwKTprLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkJiZrLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KE5hKGsuYml0UG9zaXRpb25UaW1lckludGVycnVwdCksYT0hMCk6ay5pc0pveXBhZEludGVycnVwdEVuYWJsZWQmJmsuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQmJihOYShrLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0KSxhPSEwKSk7dmFyIGM9MDthJiYoYz0yMCxiLmlzSGFsdGVkKCkmJihiLmV4aXRIYWx0QW5kU3RvcCgpLGMrPTQpKTtiLmlzSGFsdGVkKCkmJmIuZXhpdEhhbHRBbmRTdG9wKCk7YT1jfWVsc2UgYT0wOwowPGEmJnBhKGEpO2E9NDtiLmlzSGFsdGVkKCl8fGIuaXNTdG9wcGVkfHwoYT15KGIucHJvZ3JhbUNvdW50ZXIpLGE9dGIoYSkpO2IucmVnaXN0ZXJGJj0yNDA7aWYoMD49YSlyZXR1cm4gYTtwYShhKTtXLnN0ZXBzKz0xO1cuc3RlcHM+PVcuc3RlcHNQZXJTdGVwU2V0JiYoVy5zdGVwU2V0cys9MSxXLnN0ZXBzLT1XLnN0ZXBzUGVyU3RlcFNldCk7cmV0dXJuIGF9ZnVuY3Rpb24gVWIoYSl7Y29uc3QgYj0idW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKTtmb3IoO2EuZnBzVGltZVN0YW1wc1swXTxiLTFFMzspYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCk7YS5mcHNUaW1lU3RhbXBzLnB1c2goYik7YS50aW1lU3RhbXBzVW50aWxSZWFkeS0tOzA+YS50aW1lU3RhbXBzVW50aWxSZWFkeSYmKGEudGltZVN0YW1wc1VudGlsUmVhZHk9MCk7cmV0dXJuIGJ9ZnVuY3Rpb24gdWIoYSl7YS50aW1lU3RhbXBzVW50aWxSZWFkeT05MD49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU/CjEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIHZiKGEpe3ZhciBiPSgidW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKSktYS5mcHNUaW1lU3RhbXBzW2EuZnBzVGltZVN0YW1wcy5sZW5ndGgtMV07Yj13Yi1iOzA+YiYmKGI9MCk7YS51cGRhdGVJZD1zZXRUaW1lb3V0KCgpPT57eGIoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIHhiKGEsYil7aWYoYS5wYXVzZWQpcmV0dXJuITA7dm9pZCAwIT09YiYmKHdiPWIpO0RhPWEuZ2V0RlBTKCk7aWYoRGE+YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUrMSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksdmIoYSksITA7VWIoYSk7Y29uc3QgYz0hYS5vcHRpb25zLmhlYWRsZXNzJiYhYS5wYXVzZUZwc1Rocm90dGxlJiZhLm9wdGlvbnMuaXNBdWRpb0VuYWJsZWQ7KG5ldyBQcm9taXNlKChiKT0+e2xldCBmO2M/ZGIoYSxiKTooZj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWUoKSxiKGYpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2JhKE4oe3R5cGU6RS5VUERBVEVELGZwczpEYX0pKTtiPSExO2Eub3B0aW9ucy5mcmFtZVNraXAmJjA8YS5vcHRpb25zLmZyYW1lU2tpcCYmKGEuZnJhbWVTa2lwQ291bnRlcisrLGEuZnJhbWVTa2lwQ291bnRlcjw9YS5vcHRpb25zLmZyYW1lU2tpcD9iPSEwOmEuZnJhbWVTa2lwQ291bnRlcj0wKTtifHwoYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyLGEuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6RS5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSkpO2NvbnN0IGM9e3R5cGU6RS5VUERBVEVEfTtjW0YuQ0FSVFJJREdFX1JBTV09CmViKGEpLmJ1ZmZlcjtjW0YuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2NbRi5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7Y1tGLklOVEVSTkFMX1NUQVRFXT1mYihhKS5idWZmZXI7T2JqZWN0LmtleXMoYykuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1jW2FdJiYoY1thXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTihjKSxbY1tGLkNBUlRSSURHRV9SQU1dLGNbRi5HQU1FQk9ZX01FTU9SWV0sY1tGLlBBTEVUVEVfTUVNT1JZXSwKY1tGLklOVEVSTkFMX1NUQVRFXV0pO3ZiKGEpfWVsc2UgYmEoTih7dHlwZTpFLkNSQVNIRUR9KSksYS5wYXVzZWQ9ITB9KX1mdW5jdGlvbiBkYihhLGIpe3ZhciBjPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbygxMDI0KTsxIT09YyYmYihjKTtpZigxPT09Yyl7Yz1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdldEF1ZGlvUXVldWVJbmRleCgpO2NvbnN0IGY9RGE+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlOy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmY/KHliKGEsYyksc2V0VGltZW91dCgoKT0+e3ViKGEpO2RiKGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooeWIoYSxjKSxkYihhLGIpKX19ZnVuY3Rpb24geWIoYSxiKXtjb25zdCBjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTiwKYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOkUuVVBEQVRFRCxhdWRpb0J1ZmZlcjpjLG51bWJlck9mU2FtcGxlczpiLGZwczpEYSxhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6NjA8YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9KSxbY10pO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCl9Y29uc3QgRmE9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgUmE7RmF8fChSYT1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2NvbnN0IEU9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLEdFVF9NRU1PUlk6IkdFVF9NRU1PUlkiLFNFVF9NRU1PUlk6IlNFVF9NRU1PUlkiLFNFVF9NRU1PUllfRE9ORToiU0VUX01FTU9SWV9ET05FIiwKR0VUX0NPTlNUQU5UUzoiR0VUX0NPTlNUQU5UUyIsR0VUX0NPTlNUQU5UU19ET05FOiJHRVRfQ09OU1RBTlRTX0RPTkUiLENPTkZJRzoiQ09ORklHIixSRVNFVF9BVURJT19RVUVVRToiUkVTRVRfQVVESU9fUVVFVUUiLFBMQVk6IlBMQVkiLFBBVVNFOiJQQVVTRSIsVVBEQVRFRDoiVVBEQVRFRCIsQ1JBU0hFRDoiQ1JBU0hFRCIsU0VUX0pPWVBBRF9TVEFURToiU0VUX0pPWVBBRF9TVEFURSIsQVVESU9fTEFURU5DWToiQVVESU9fTEFURU5DWSIsUlVOX1dBU01fRVhQT1JUOiJSVU5fV0FTTV9FWFBPUlQiLEdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOiJHRVRfV0FTTV9NRU1PUllfU0VDVElPTiIsR0VUX1dBU01fQ09OU1RBTlQ6IkdFVF9XQVNNX0NPTlNUQU5UIn0sRj17Q0FSVFJJREdFX1JBTToiQ0FSVFJJREdFX1JBTSIsQ0FSVFJJREdFX1JPTToiQ0FSVFJJREdFX1JPTSIsQ0FSVFJJREdFX0hFQURFUjoiQ0FSVFJJREdFX0hFQURFUiIsR0FNRUJPWV9NRU1PUlk6IkdBTUVCT1lfTUVNT1JZIiwKUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTtsZXQgR2E9MDtjb25zdCBnPW5ldyBVaW50OENsYW1wZWRBcnJheSg5MTA5NTA0KSxFYT17c2l6ZTooKT0+OTEwOTUwNCxncm93OigpPT57fSx3YXNtQnl0ZU1lbW9yeTpnfTt2YXIgVD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5lbmFibGVCb290Um9tPSExO2EudXNlR2JjV2hlbkF2YWlsYWJsZT0hMDthLmF1ZGlvQmF0Y2hQcm9jZXNzaW5nPSExO2EuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmc9ITE7YS50aW1lcnNCYXRjaFByb2Nlc3Npbmc9ITE7YS5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZz0hMTthLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXM9ITE7YS50aWxlUmVuZGVyaW5nPSExO2EudGlsZUNhY2hpbmc9ITE7cmV0dXJuIGF9KCksQWE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZUluZGV4PQo2NTM4NDthLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVEYXRhPTY1Mzg1O2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlSW5kZXg9NjUzODY7YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhPTY1Mzg3O3JldHVybiBhfSgpLGZhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnRpbGVJZD0tMTthLmhvcml6b250YWxGbGlwPSExO2EubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9LTE7cmV0dXJuIGF9KCksej1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVOUngwPWZ1bmN0aW9uKGIpe2EuTlJ4MFN3ZWVwUGVyaW9kPShiJjExMik+PjQ7YS5OUngwTmVnYXRlPW4oMyxiKTthLk5SeDBTd2VlcFNoaWZ0PWImN307YS51cGRhdGVOUngxPWZ1bmN0aW9uKGIpe2EuTlJ4MUR1dHk9Yj4+NiYzO2EuTlJ4MUxlbmd0aExvYWQ9YiY2MzthLmxlbmd0aENvdW50ZXI9NjQtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGIpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPQpiPj40JjE1O2EuTlJ4MkVudmVsb3BlQWRkTW9kZT1uKDMsYik7YS5OUngyRW52ZWxvcGVQZXJpb2Q9YiY3O2EuaXNEYWNFbmFibGVkPTA8KGImMjQ4KX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGIpe2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPW4oNixiKTthLk5SeDRGcmVxdWVuY3lNU0I9YiY3O2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7TygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtnWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmVudmVsb3BlQ291bnRlcjtnWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7CmdbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2dbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZHV0eUN5Y2xlO2dbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eTtPKDEwNDkrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNTd2VlcEVuYWJsZWQpO2dbMTA1MCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuc3dlZXBDb3VudGVyO2dbMTA1NSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuc3dlZXBTaGFkb3dGcmVxdWVuY3l9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9UCgxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1nWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1nWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxlbmd0aENvdW50ZXI9Z1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWU9Z1sxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kdXR5Q3ljbGU9CmdbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1nWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmlzU3dlZXBFbmFibGVkPVAoMTA0OSs1MCphLnNhdmVTdGF0ZVNsb3QpO2Euc3dlZXBDb3VudGVyPWdbMTA1MCs1MCphLnNhdmVTdGF0ZVNsb3RdO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9Z1sxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2goYS5tZW1vcnlMb2NhdGlvbk5SeDAsMTI4KTtoKGEubWVtb3J5TG9jYXRpb25OUngxLDE5MSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MiwyNDMpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsMTkzKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LDE5MSl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGIpfTthLnJlc2V0VGltZXI9ZnVuY3Rpb24oKXthLmZyZXF1ZW5jeVRpbWVyPQo0KigyMDQ4LWEuZnJlcXVlbmN5KTtiLkdCQ0RvdWJsZVNwZWVkJiYoYS5mcmVxdWVuY3lUaW1lcio9Mil9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGIpe2EuZnJlcXVlbmN5VGltZXItPWI7MD49YS5mcmVxdWVuY3lUaW1lciYmKGI9TWF0aC5hYnMoYS5mcmVxdWVuY3lUaW1lciksYS5yZXNldFRpbWVyKCksYS5mcmVxdWVuY3lUaW1lci09YixhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkrPTEsODw9YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5JiYoYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PTApKTtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYj1hLnZvbHVtZTtlbHNlIHJldHVybiAxNTt2YXIgYz0xO2liKGEuTlJ4MUR1dHksYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5KXx8KGMqPS0xKTtyZXR1cm4gYypiKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTY0KTthLnJlc2V0VGltZXIoKTsKYS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1hLmZyZXF1ZW5jeTthLnN3ZWVwQ291bnRlcj1hLk5SeDBTd2VlcFBlcmlvZDthLmlzU3dlZXBFbmFibGVkPTA8YS5OUngwU3dlZXBQZXJpb2QmJjA8YS5OUngwU3dlZXBTaGlmdD8hMDohMTswPGEuTlJ4MFN3ZWVwU2hpZnQmJmpiKCk7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7cmV0dXJuIDA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcj8hMTohMH07YS51cGRhdGVTd2VlcD1mdW5jdGlvbigpey0tYS5zd2VlcENvdW50ZXI7MD49YS5zd2VlcENvdW50ZXImJihhLnN3ZWVwQ291bnRlcj1hLk5SeDBTd2VlcFBlcmlvZCxhLmlzU3dlZXBFbmFibGVkJiYwPGEuTlJ4MFN3ZWVwUGVyaW9kJiZqYigpKX07YS51cGRhdGVMZW5ndGg9CmZ1bmN0aW9uKCl7MDxhLmxlbmd0aENvdW50ZXImJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYS5sZW5ndGhDb3VudGVyOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmlzRW5hYmxlZD0hMSl9O2EudXBkYXRlRW52ZWxvcGU9ZnVuY3Rpb24oKXstLWEuZW52ZWxvcGVDb3VudGVyOzA+PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2QsMCE9PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYxNT5hLnZvbHVtZT9hLnZvbHVtZSs9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGEudm9sdW1lJiYtLWEudm9sdW1lKSl9O2Euc2V0RnJlcXVlbmN5PWZ1bmN0aW9uKGIpe3ZhciBjPWI+Pjg7YiY9MjU1O3ZhciBkPXkoYS5tZW1vcnlMb2NhdGlvbk5SeDQpJjI0OHxjO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsYik7aChhLm1lbW9yeUxvY2F0aW9uTlJ4NCxkKTthLk5SeDNGcmVxdWVuY3lMU0I9YjthLk5SeDRGcmVxdWVuY3lNU0I9CmM7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MD02NTI5NjthLk5SeDBTd2VlcFBlcmlvZD0wO2EuTlJ4ME5lZ2F0ZT0hMTthLk5SeDBTd2VlcFNoaWZ0PTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUyOTc7YS5OUngxRHV0eT0wO2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTI5ODthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1Mjk5O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzAwO2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5jaGFubmVsTnVtYmVyPTE7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9MDthLmZyZXF1ZW5jeVRpbWVyPQowO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wO2EuaXNTd2VlcEVuYWJsZWQ9ITE7YS5zd2VlcENvdW50ZXI9MDthLnN3ZWVwU2hhZG93RnJlcXVlbmN5PTA7YS5zYXZlU3RhdGVTbG90PTc7cmV0dXJuIGF9KCksTD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVOUngxPWZ1bmN0aW9uKGIpe2EuTlJ4MUR1dHk9Yj4+NiYzO2EuTlJ4MUxlbmd0aExvYWQ9YiY2MzthLmxlbmd0aENvdW50ZXI9NjQtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGIpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPWI+PjQmMTU7YS5OUngyRW52ZWxvcGVBZGRNb2RlPW4oMyxiKTthLk5SeDJFbnZlbG9wZVBlcmlvZD1iJjc7YS5pc0RhY0VuYWJsZWQ9MDwoYiYyNDgpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5mcmVxdWVuY3k9CmEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPW4oNixiKTthLk5SeDRGcmVxdWVuY3lNU0I9YiY3O2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7TygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtnWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmVudmVsb3BlQ291bnRlcjtnWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7Z1sxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS52b2x1bWU7Z1sxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kdXR5Q3ljbGU7Z1sxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5fTthLmxvYWRTdGF0ZT0KZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1QKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWdbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1nWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1nWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmR1dHlDeWNsZT1nWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9Z1sxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2goYS5tZW1vcnlMb2NhdGlvbk5SeDEtMSwyNTUpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsNjMpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDIsMCk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LDE4NCl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPQphLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShiKX07YS5yZXNldFRpbWVyPWZ1bmN0aW9uKCl7YS5mcmVxdWVuY3lUaW1lcj00KigyMDQ4LWEuZnJlcXVlbmN5KTtiLkdCQ0RvdWJsZVNwZWVkJiYoYS5mcmVxdWVuY3lUaW1lcio9Mil9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGIpe2EuZnJlcXVlbmN5VGltZXItPWI7MD49YS5mcmVxdWVuY3lUaW1lciYmKGI9TWF0aC5hYnMoYS5mcmVxdWVuY3lUaW1lciksYS5yZXNldFRpbWVyKCksYS5mcmVxdWVuY3lUaW1lci09YixhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkrPTEsODw9YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5JiYoYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PTApKTtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYj1hLnZvbHVtZTtlbHNlIHJldHVybiAxNTt2YXIgYz0xO2liKGEuTlJ4MUR1dHksYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5KXx8KGMqPS0xKTtyZXR1cm4gYypiKzE1fTsKYS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj02NCk7YS5yZXNldFRpbWVyKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7cmV0dXJuIDA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcj8hMTohMH07YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXswPGEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPSExKX07YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpey0tYS5lbnZlbG9wZUNvdW50ZXI7MD49YS5lbnZlbG9wZUNvdW50ZXImJihhLmVudmVsb3BlQ291bnRlcj0KYS5OUngyRW52ZWxvcGVQZXJpb2QsMCE9PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYxNT5hLnZvbHVtZT9hLnZvbHVtZSs9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGEudm9sdW1lJiYtLWEudm9sdW1lKSl9O2Euc2V0RnJlcXVlbmN5PWZ1bmN0aW9uKGIpe3ZhciBjPWI+Pjg7YiY9MjU1O3ZhciBkPXkoYS5tZW1vcnlMb2NhdGlvbk5SeDQpJjI0OHxjO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsYik7aChhLm1lbW9yeUxvY2F0aW9uTlJ4NCxkKTthLk5SeDNGcmVxdWVuY3lMU0I9YjthLk5SeDRGcmVxdWVuY3lNU0I9YzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLmN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzAyO2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMDM7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9CiExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMDQ7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMDU7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLmNoYW5uZWxOdW1iZXI9MjthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kdXR5Q3ljbGU9MDthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MDthLnNhdmVTdGF0ZVNsb3Q9ODtyZXR1cm4gYX0oKSxJPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYil7YS5pc0RhY0VuYWJsZWQ9big3LGIpfTthLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxTGVuZ3RoTG9hZD1iO2EubGVuZ3RoQ291bnRlcj0yNTYtYS5OUngxTGVuZ3RoTG9hZH07CmEudXBkYXRlTlJ4Mj1mdW5jdGlvbihiKXthLk5SeDJWb2x1bWVDb2RlPWI+PjUmMTV9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1uKDYsYik7YS5OUng0RnJlcXVlbmN5TVNCPWImNzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe08oMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0VuYWJsZWQpO2dbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7Z1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2dbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZVRhYmxlUG9zaXRpb259O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ClAoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZVRhYmxlUG9zaXRpb249Z1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2goYS5tZW1vcnlMb2NhdGlvbk5SeDAsMTI3KTtoKGEubWVtb3J5TG9jYXRpb25OUngxLDI1NSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MiwxNTkpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxODQpO2Eudm9sdW1lQ29kZUNoYW5nZWQ9ITB9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGIpfTthLnJlc2V0VGltZXI9ZnVuY3Rpb24oKXthLmZyZXF1ZW5jeVRpbWVyPTIqKDIwNDgtYS5mcmVxdWVuY3kpOwpiLkdCQ0RvdWJsZVNwZWVkJiYoYS5mcmVxdWVuY3lUaW1lcio9Mil9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGIpe2EuZnJlcXVlbmN5VGltZXItPWI7MD49YS5mcmVxdWVuY3lUaW1lciYmKGI9TWF0aC5hYnMoYS5mcmVxdWVuY3lUaW1lciksYS5yZXNldFRpbWVyKCksYS5mcmVxdWVuY3lUaW1lci09YixhLndhdmVUYWJsZVBvc2l0aW9uKz0xLDMyPD1hLndhdmVUYWJsZVBvc2l0aW9uJiYoYS53YXZlVGFibGVQb3NpdGlvbj0wKSk7Yj0wO3ZhciBjPWEudm9sdW1lQ29kZTtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYS52b2x1bWVDb2RlQ2hhbmdlZCYmKGM9eShhLm1lbW9yeUxvY2F0aW9uTlJ4MiksYz1jPj41JjE1LGEudm9sdW1lQ29kZT1jLGEudm9sdW1lQ29kZUNoYW5nZWQ9ITEpO2Vsc2UgcmV0dXJuIDE1O3ZhciBkPXkoYS5tZW1vcnlMb2NhdGlvbldhdmVUYWJsZSsoYS53YXZlVGFibGVQb3NpdGlvbi8yfDApKTtkPTA9PT1hLndhdmVUYWJsZVBvc2l0aW9uJTI/ZD4+CjQmMTU6ZCYxNTtzd2l0Y2goYyl7Y2FzZSAwOmQ+Pj00O2JyZWFrO2Nhc2UgMTpiPTE7YnJlYWs7Y2FzZSAyOmQ+Pj0xO2I9MjticmVhaztkZWZhdWx0OmQ+Pj0yLGI9NH1yZXR1cm4oMDxiP2QvYjowKSsxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj0yNTYpO2EucmVzZXRUaW1lcigpO2Eud2F2ZVRhYmxlUG9zaXRpb249MDthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyJiYhYS52b2x1bWVDb2RlQ2hhbmdlZD8hMTohMH07YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXswPGEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPQohMSl9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUzMDY7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMDc7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1MzA4O2EuTlJ4MlZvbHVtZUNvZGU9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTMwOTthLk5SeDNGcmVxdWVuY3lMU0I9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMxMDthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EubWVtb3J5TG9jYXRpb25XYXZlVGFibGU9NjUzMjg7YS5jaGFubmVsTnVtYmVyPTM7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9MDthLmZyZXF1ZW5jeVRpbWVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS53YXZlVGFibGVQb3NpdGlvbj0wO2Eudm9sdW1lQ29kZT0wO2Eudm9sdW1lQ29kZUNoYW5nZWQ9ITE7YS5zYXZlU3RhdGVTbG90PTk7cmV0dXJuIGF9KCksTT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9CmEudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFMZW5ndGhMb2FkPWImNjM7YS5sZW5ndGhDb3VudGVyPTY0LWEuTlJ4MUxlbmd0aExvYWR9O2EudXBkYXRlTlJ4Mj1mdW5jdGlvbihiKXthLk5SeDJTdGFydGluZ1ZvbHVtZT1iPj40JjE1O2EuTlJ4MkVudmVsb3BlQWRkTW9kZT1uKDMsYik7YS5OUngyRW52ZWxvcGVQZXJpb2Q9YiY3O2EuaXNEYWNFbmFibGVkPTA8KGImMjQ4KX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGIpe2EuTlJ4M0Nsb2NrU2hpZnQ9Yj4+NDthLk5SeDNXaWR0aE1vZGU9bigzLGIpO2EuTlJ4M0Rpdmlzb3JDb2RlPWImNztzd2l0Y2goYS5OUngzRGl2aXNvckNvZGUpe2Nhc2UgMDphLmRpdmlzb3I9ODticmVhaztjYXNlIDE6YS5kaXZpc29yPTE2O2JyZWFrO2Nhc2UgMjphLmRpdmlzb3I9MzI7YnJlYWs7Y2FzZSAzOmEuZGl2aXNvcj00ODticmVhaztjYXNlIDQ6YS5kaXZpc29yPTY0O2JyZWFrO2Nhc2UgNTphLmRpdmlzb3I9ODA7YnJlYWs7Y2FzZSA2OmEuZGl2aXNvcj0KOTY7YnJlYWs7Y2FzZSA3OmEuZGl2aXNvcj0xMTJ9fTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1uKDYsYil9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7TygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtnWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmVudmVsb3BlQ291bnRlcjtnWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7Z1sxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS52b2x1bWU7Z1sxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXJ9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9UCgxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1nWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1nWzEwMjkrCjUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWdbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eudm9sdW1lPWdbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPWdbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtoKGEubWVtb3J5TG9jYXRpb25OUngxLTEsMjU1KTtoKGEubWVtb3J5TG9jYXRpb25OUngxLDI1NSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MiwwKTtoKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTkxKX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGIpe2EuZnJlcXVlbmN5VGltZXItPWI7MD49YS5mcmVxdWVuY3lUaW1lciYmKGI9TWF0aC5hYnMoYS5mcmVxdWVuY3lUaW1lciksCmEuZnJlcXVlbmN5VGltZXI9YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2QoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGI9YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXImMV5hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj4+MSYxLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPj49MSxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcnw9Yjw8MTQsYS5OUngzV2lkdGhNb2RlJiYoYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXImPS02NSxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcnw9Yjw8NikpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPW4oMCxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcik/LTE6MTtyZXR1cm4gYypiKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTY0KTthLmZyZXF1ZW5jeVRpbWVyPQphLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZCgpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPTMyNzY3O2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXI/ITE6ITB9O2EuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kPWZ1bmN0aW9uKCl7dmFyIGM9YS5kaXZpc29yPDxhLk5SeDNDbG9ja1NoaWZ0O2IuR0JDRG91YmxlU3BlZWQmJihjKj0yKTtyZXR1cm4gY307YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXswPGEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPQohMSl9O2EudXBkYXRlRW52ZWxvcGU9ZnVuY3Rpb24oKXstLWEuZW52ZWxvcGVDb3VudGVyOzA+PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2QsMCE9PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYxNT5hLnZvbHVtZT9hLnZvbHVtZSs9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGEudm9sdW1lJiYtLWEudm9sdW1lKSl9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMTI7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1MzEzO2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPTA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMTQ7YS5OUngzQ2xvY2tTaGlmdD0wO2EuTlJ4M1dpZHRoTW9kZT0hMTthLk5SeDNEaXZpc29yQ29kZT0wO2EubWVtb3J5TG9jYXRpb25OUng0PQo2NTMxNTthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuY2hhbm5lbE51bWJlcj00O2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kaXZpc29yPTA7YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MDthLnNhdmVTdGF0ZVNsb3Q9MTA7cmV0dXJuIGF9KCkscT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5jaGFubmVsMVNhbXBsZT0xNTthLmNoYW5uZWwyU2FtcGxlPTE1O2EuY2hhbm5lbDNTYW1wbGU9MTU7YS5jaGFubmVsNFNhbXBsZT0xNTthLmNoYW5uZWwxRGFjRW5hYmxlZD0hMTthLmNoYW5uZWwyRGFjRW5hYmxlZD0hMTthLmNoYW5uZWwzRGFjRW5hYmxlZD0hMTthLmNoYW5uZWw0RGFjRW5hYmxlZD0hMTthLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzthLnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7YS5taXhlclZvbHVtZUNoYW5nZWQ9CiExO2EubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMTthLm5lZWRUb1JlbWl4U2FtcGxlcz0hMTtyZXR1cm4gYX0oKSxlPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzE3NDo4N307YS51cGRhdGVOUjUwPWZ1bmN0aW9uKGIpe2EuTlI1MExlZnRNaXhlclZvbHVtZT1iPj40Jjc7YS5OUjUwUmlnaHRNaXhlclZvbHVtZT1iJjd9O2EudXBkYXRlTlI1MT1mdW5jdGlvbihiKXthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD1uKDcsYik7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9big2LGIpO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PW4oNSxiKTthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD1uKDQsYik7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PW4oMyxiKTthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9Cm4oMixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9bigxLGIpO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD1uKDAsYil9O2EudXBkYXRlTlI1Mj1mdW5jdGlvbihiKXthLk5SNTJJc1NvdW5kRW5hYmxlZD1uKDcsYil9O2EubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzE2Mzg0OjgxOTJ9O2EubWF4RG93blNhbXBsZUN5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBiLkNMT0NLX1NQRUVEKCl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyO2dbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZG93blNhbXBsZUN5Y2xlQ291bnRlcjtnWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyYW1lU2VxdWVuY2VyfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0KZ1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPWdbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZnJhbWVTZXF1ZW5jZXI9Z1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07VmEoKX07YS5jdXJyZW50Q3ljbGVzPTA7YS5tZW1vcnlMb2NhdGlvbk5SNTA9NjUzMTY7YS5OUjUwTGVmdE1peGVyVm9sdW1lPTA7YS5OUjUwUmlnaHRNaXhlclZvbHVtZT0wO2EubWVtb3J5TG9jYXRpb25OUjUxPTY1MzE3O2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PQohMDthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5tZW1vcnlMb2NhdGlvbk5SNTI9NjUzMTg7YS5OUjUySXNTb3VuZEVuYWJsZWQ9ITA7YS5tZW1vcnlMb2NhdGlvbkNoYW5uZWwzTG9hZFJlZ2lzdGVyU3RhcnQ9NjUzMjg7YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPTA7YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPTA7YS5kb3duU2FtcGxlQ3ljbGVNdWx0aXBsaWVyPTQ4RTM7YS5mcmFtZVNlcXVlbmNlcj0wO2EuYXVkaW9RdWV1ZUluZGV4PTA7YS53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZT0xMzEwNzI7YS5zYXZlU3RhdGVTbG90PTY7cmV0dXJuIGF9KCksaz1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkPWZ1bmN0aW9uKGIpe2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPW4oYS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCxiKTthLmlzTGNkSW50ZXJydXB0RW5hYmxlZD1uKGEuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQsCmIpO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9bihhLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQ9bihhLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0LGIpO2EuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZT1ifTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZD1mdW5jdGlvbihiKXthLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPW4oYS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCxiKTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPW4oYS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCxiKTthLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9bihhLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD1uKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9Yn07YS5hcmVJbnRlcnJ1cHRzUGVuZGluZz1mdW5jdGlvbigpe3JldHVybiAwPAooYS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmYS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJjMxKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtPKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEubWFzdGVySW50ZXJydXB0U3dpdGNoKTtPKDEwMjUrNTAqYS5zYXZlU3RhdGVTbG90LGEubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXkpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EubWFzdGVySW50ZXJydXB0U3dpdGNoPVAoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9UCgxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKHkoYS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQpKTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZCh5KGEubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KSl9O2EubWFzdGVySW50ZXJydXB0U3dpdGNoPSExO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9CiExO2EuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ9MDthLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0PTE7YS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0PTI7YS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdD00O2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkPTY1NTM1O2EuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZT0wO2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9ITE7YS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQ9ITE7YS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3Q9NjUyOTU7YS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9MDthLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5zYXZlU3RhdGVTbG90PQoyO3JldHVybiBhfSgpLHA9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIDI1Nn07YS51cGRhdGVEaXZpZGVyUmVnaXN0ZXI9ZnVuY3Rpb24oYil7Yj1hLmRpdmlkZXJSZWdpc3RlcjthLmRpdmlkZXJSZWdpc3Rlcj0wO2goYS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlciwwKTthLnRpbWVyRW5hYmxlZCYmb2IoYixhLmRpdmlkZXJSZWdpc3RlcikmJlhhKCl9O2EudXBkYXRlVGltZXJDb3VudGVyPWZ1bmN0aW9uKGIpe2lmKGEudGltZXJFbmFibGVkKXtpZihhLnRpbWVyQ291bnRlcldhc1Jlc2V0KXJldHVybjthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXkmJihhLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITEpfWEudGltZXJDb3VudGVyPWJ9O2EudXBkYXRlVGltZXJNb2R1bG89ZnVuY3Rpb24oYil7YS50aW1lck1vZHVsbz1iO2EudGltZXJFbmFibGVkJiZhLnRpbWVyQ291bnRlcldhc1Jlc2V0JiYoYS50aW1lckNvdW50ZXI9CmEudGltZXJNb2R1bG8sYS50aW1lckNvdW50ZXJXYXNSZXNldD0hMSl9O2EudXBkYXRlVGltZXJDb250cm9sPWZ1bmN0aW9uKGIpe3ZhciBjPWEudGltZXJFbmFibGVkO2EudGltZXJFbmFibGVkPW4oMixiKTtiJj0zO2lmKCFjKXtjPVlhKGEudGltZXJJbnB1dENsb2NrKTt2YXIgZD1ZYShiKTsoYS50aW1lckVuYWJsZWQ/bihjLGEuZGl2aWRlclJlZ2lzdGVyKTpuKGMsYS5kaXZpZGVyUmVnaXN0ZXIpJiZuKGQsYS5kaXZpZGVyUmVnaXN0ZXIpKSYmWGEoKX1hLnRpbWVySW5wdXRDbG9jaz1ifTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2dbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztnWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmRpdmlkZXJSZWdpc3RlcjtPKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90LGEudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheSk7TygxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLnRpbWVyQ291bnRlcldhc1Jlc2V0KTtoKGEubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXIsCmEudGltZXJDb3VudGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRDeWNsZXM9Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kaXZpZGVyUmVnaXN0ZXI9Z1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PVAoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EudGltZXJDb3VudGVyV2FzUmVzZXQ9UCgxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS50aW1lckNvdW50ZXI9eShhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyKTthLnRpbWVyTW9kdWxvPXkoYS5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvKTthLnRpbWVySW5wdXRDbG9jaz15KGEubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2wpfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPTY1Mjg0O2EuZGl2aWRlclJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcj02NTI4NTthLnRpbWVyQ291bnRlcj0KMDthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITE7YS50aW1lckNvdW50ZXJXYXNSZXNldD0hMTthLnRpbWVyQ291bnRlck1hc2s9MDthLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG89NjUyODY7YS50aW1lck1vZHVsbz0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w9NjUyODc7YS50aW1lckVuYWJsZWQ9ITE7YS50aW1lcklucHV0Q2xvY2s9MDthLnNhdmVTdGF0ZVNsb3Q9NTtyZXR1cm4gYX0oKSxBPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZUpveXBhZD1mdW5jdGlvbihiKXthLmpveXBhZFJlZ2lzdGVyRmxpcHBlZD1iXjI1NTthLmlzRHBhZFR5cGU9big0LGEuam95cGFkUmVnaXN0ZXJGbGlwcGVkKTthLmlzQnV0dG9uVHlwZT1uKDUsYS5qb3lwYWRSZWdpc3RlckZsaXBwZWQpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe307YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnVwZGF0ZUpveXBhZCh5KGEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3RlcikpfTsKYS51cD0hMTthLmRvd249ITE7YS5sZWZ0PSExO2EucmlnaHQ9ITE7YS5hPSExO2EuYj0hMTthLnNlbGVjdD0hMTthLnN0YXJ0PSExO2EubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3Rlcj02NTI4MDthLmpveXBhZFJlZ2lzdGVyRmxpcHBlZD0wO2EuaXNEcGFkVHlwZT0hMTthLmlzQnV0dG9uVHlwZT0hMTthLnNhdmVTdGF0ZVNsb3Q9MztyZXR1cm4gYX0oKSxEPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZUxjZFN0YXR1cz1mdW5jdGlvbihiKXt2YXIgYz15KGEubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO2I9YiYyNDh8YyY3fDEyODtoKGEubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsYil9O2EudXBkYXRlTGNkQ29udHJvbD1mdW5jdGlvbihiKXthLmVuYWJsZWQ9big3LGIpO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9big2LGIpO2Eud2luZG93RGlzcGxheUVuYWJsZWQ9big1LGIpO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD1uKDQsYik7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PQpuKDMsYik7YS50YWxsU3ByaXRlU2l6ZT1uKDIsYik7YS5zcHJpdGVEaXNwbGF5RW5hYmxlPW4oMSxiKTthLmJnRGlzcGxheUVuYWJsZWQ9bigwLGIpfTthLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzPTY1MzQ1O2EuY3VycmVudExjZE1vZGU9MDthLm1lbW9yeUxvY2F0aW9uQ29pbmNpZGVuY2VDb21wYXJlPTY1MzQ5O2EuY29pbmNpZGVuY2VDb21wYXJlPTA7YS5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2w9NjUzNDQ7YS5lbmFibGVkPSEwO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS53aW5kb3dEaXNwbGF5RW5hYmxlZD0hMTthLmJnV2luZG93VGlsZURhdGFTZWxlY3Q9ITE7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PSExO2EudGFsbFNwcml0ZVNpemU9ITE7YS5zcHJpdGVEaXNwbGF5RW5hYmxlPSExO2EuYmdEaXNwbGF5RW5hYmxlZD0hMTtyZXR1cm4gYX0oKSxyPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBhLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCl9OwphLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/MTUzPT09YS5zY2FubGluZVJlZ2lzdGVyPzg6OTEyOjE1Mz09PWEuc2NhbmxpbmVSZWdpc3Rlcj80OjQ1Nn07YS5NSU5fQ1lDTEVTX1NQUklURVNfTENEX01PREU9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD83NTI6Mzc2fTthLk1JTl9DWUNMRVNfVFJBTlNGRVJfREFUQV9MQ0RfTU9ERT1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzQ5ODoyNDl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zY2FubGluZUN5Y2xlQ291bnRlcjtnWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1ELmN1cnJlbnRMY2RNb2RlO2goYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIsYS5zY2FubGluZVJlZ2lzdGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnNjYW5saW5lQ3ljbGVDb3VudGVyPWdbMTAyNCsKNTAqYS5zYXZlU3RhdGVTbG90XTtELmN1cnJlbnRMY2RNb2RlPWdbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2Euc2NhbmxpbmVSZWdpc3Rlcj15KGEubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyKTtELnVwZGF0ZUxjZENvbnRyb2woeShELm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbCkpfTthLmN1cnJlbnRDeWNsZXM9MDthLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXI9NjUzNDg7YS5zY2FubGluZVJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyPTY1MzUwO2EubWVtb3J5TG9jYXRpb25TY3JvbGxYPTY1MzQ3O2Euc2Nyb2xsWD0wO2EubWVtb3J5TG9jYXRpb25TY3JvbGxZPTY1MzQ2O2Euc2Nyb2xsWT0wO2EubWVtb3J5TG9jYXRpb25XaW5kb3dYPTY1MzU1O2Eud2luZG93WD0wO2EubWVtb3J5TG9jYXRpb25XaW5kb3dZPTY1MzU0O2Eud2luZG93WT0wO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0PQozODkxMjthLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0PTM5OTM2O2EubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydD0zNDgxNjthLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydD0zMjc2ODthLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlPTY1MDI0O2EubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZT02NTM1MTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZT02NTM1MjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bz02NTM1MzthLnNhdmVTdGF0ZVNsb3Q9MTtyZXR1cm4gYX0oKSxkPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2dbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudFJvbUJhbms7Z1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50UmFtQmFuaztPKDEwMjgrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNSYW1CYW5raW5nRW5hYmxlZCk7Ck8oMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc01CQzFSb21Nb2RlRW5hYmxlZCk7TygxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzUm9tT25seSk7TygxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDMSk7TygxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDMik7TygxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDMyk7TygxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDNSl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5jdXJyZW50Um9tQmFuaz1nWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmN1cnJlbnRSYW1CYW5rPWdbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNSYW1CYW5raW5nRW5hYmxlZD1QKDEwMjgrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPVAoMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNSb21Pbmx5PVAoMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxPVAoMTAzMSs1MCoKYS5zYXZlU3RhdGVTbG90KTthLmlzTUJDMj1QKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzTUJDMz1QKDEwMzMrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzTUJDNT1QKDEwMzQrNTAqYS5zYXZlU3RhdGVTbG90KX07YS5jYXJ0cmlkZ2VSb21Mb2NhdGlvbj0wO2Euc3dpdGNoYWJsZUNhcnRyaWRnZVJvbUxvY2F0aW9uPTE2Mzg0O2EudmlkZW9SYW1Mb2NhdGlvbj0zMjc2ODthLmNhcnRyaWRnZVJhbUxvY2F0aW9uPTQwOTYwO2EuaW50ZXJuYWxSYW1CYW5rWmVyb0xvY2F0aW9uPTQ5MTUyO2EuaW50ZXJuYWxSYW1CYW5rT25lTG9jYXRpb249NTMyNDg7YS5lY2hvUmFtTG9jYXRpb249NTczNDQ7YS5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb249NjUwMjQ7YS5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQ9NjUxODM7YS51bnVzYWJsZU1lbW9yeUxvY2F0aW9uPTY1MTg0O2EudW51c2FibGVNZW1vcnlFbmRMb2NhdGlvbj02NTI3OTthLmN1cnJlbnRSb21CYW5rPQowO2EuY3VycmVudFJhbUJhbms9MDthLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE7YS5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMDthLmlzUm9tT25seT0hMDthLmlzTUJDMT0hMTthLmlzTUJDMj0hMTthLmlzTUJDMz0hMTthLmlzTUJDNT0hMTthLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUhpZ2g9NjUzNjE7YS5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VMb3c9NjUzNjI7YS5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkhpZ2g9NjUzNjM7YS5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkxvdz02NTM2NDthLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXI9NjUzNjU7YS5ETUFDeWNsZXM9MDthLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMTthLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz0wO2EuaGJsYW5rSGRtYVNvdXJjZT0wO2EuaGJsYW5rSGRtYURlc3RpbmF0aW9uPTA7YS5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rPTY1MzU5O2EubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaz0KNjUzOTI7YS5zYXZlU3RhdGVTbG90PTQ7cmV0dXJuIGF9KCksYj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5DTE9DS19TUEVFRD1mdW5jdGlvbigpe3JldHVybiBhLkdCQ0RvdWJsZVNwZWVkPzgzODg2MDg6NDE5NDMwNH07YS5NQVhfQ1lDTEVTX1BFUl9GUkFNRT1mdW5jdGlvbigpe3JldHVybiBhLkdCQ0RvdWJsZVNwZWVkPzE0MDQ0ODo3MDIyNH07YS5lbmFibGVIYWx0PWZ1bmN0aW9uKCl7ay5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g/YS5pc0hhbHROb3JtYWw9ITA6MD09PShrLmludGVycnVwdHNFbmFibGVkVmFsdWUmay5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmMzEpP2EuaXNIYWx0Tm9KdW1wPSEwOmEuaXNIYWx0QnVnPSEwfTthLmV4aXRIYWx0QW5kU3RvcD1mdW5jdGlvbigpe2EuaXNIYWx0Tm9KdW1wPSExO2EuaXNIYWx0Tm9ybWFsPSExO2EuaXNIYWx0QnVnPSExO2EuaXNTdG9wcGVkPSExfTthLmlzSGFsdGVkPWZ1bmN0aW9uKCl7cmV0dXJuIGEuaXNIYWx0Tm9ybWFsfHwKYS5pc0hhbHROb0p1bXA/ITA6ITF9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3RlckE7Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3RlckI7Z1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3RlckM7Z1sxMDI3KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3RlckQ7Z1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3RlckU7Z1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3Rlckg7Z1sxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3Rlckw7Z1sxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3RlckY7Z1sxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zdGFja1BvaW50ZXI7Z1sxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5wcm9ncmFtQ291bnRlcjtnWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRDeWNsZXM7TygxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdCwKYS5pc0hhbHROb3JtYWwpO08oMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0hhbHROb0p1bXApO08oMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0hhbHRCdWcpO08oMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1N0b3BwZWQpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EucmVnaXN0ZXJBPWdbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJCPWdbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJDPWdbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJEPWdbMTAyNys1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJFPWdbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJIPWdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJMPWdbMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJGPWdbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Euc3RhY2tQb2ludGVyPWdbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdOwphLnByb2dyYW1Db3VudGVyPWdbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudEN5Y2xlcz1nWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XTthLmlzSGFsdE5vcm1hbD1QKDEwNDErNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzSGFsdE5vSnVtcD1QKDEwNDIrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzSGFsdEJ1Zz1QKDEwNDMrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzU3RvcHBlZD1QKDEwNDQrNTAqYS5zYXZlU3RhdGVTbG90KX07YS5HQkNFbmFibGVkPSExO2EubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaD02NTM1NzthLkdCQ0RvdWJsZVNwZWVkPSExO2EucmVnaXN0ZXJBPTA7YS5yZWdpc3RlckI9MDthLnJlZ2lzdGVyQz0wO2EucmVnaXN0ZXJEPTA7YS5yZWdpc3RlckU9MDthLnJlZ2lzdGVySD0wO2EucmVnaXN0ZXJMPTA7YS5yZWdpc3RlckY9MDthLnN0YWNrUG9pbnRlcj0wO2EucHJvZ3JhbUNvdW50ZXI9MDthLmN1cnJlbnRDeWNsZXM9MDthLmlzSGFsdE5vcm1hbD0KITE7YS5pc0hhbHROb0p1bXA9ITE7YS5pc0hhbHRCdWc9ITE7YS5pc1N0b3BwZWQ9ITE7YS5zYXZlU3RhdGVTbG90PTA7cmV0dXJuIGF9KCksVj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5jeWNsZXNQZXJDeWNsZVNldD0yRTk7YS5jeWNsZVNldHM9MDthLmN5Y2xlcz0wO3JldHVybiBhfSgpLFc9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuc3RlcHNQZXJTdGVwU2V0PTJFOTthLnN0ZXBTZXRzPTA7YS5zdGVwcz0wO3JldHVybiBhfSgpOzEzOT5FYS5zaXplKCkmJkVhLmdyb3coMTM5LUVhLnNpemUoKSk7dmFyIENhPSExLFZiPU9iamVjdC5mcmVlemUoe21lbW9yeTpFYSxjb25maWc6ZnVuY3Rpb24oYSxjLGYsZyxsLG4sbSx0LHYpe1QuZW5hYmxlQm9vdFJvbT0wPGE/ITA6ITE7VC51c2VHYmNXaGVuQXZhaWxhYmxlPTA8Yz8hMDohMTtULmF1ZGlvQmF0Y2hQcm9jZXNzaW5nPTA8Zj8hMDohMTtULmdyYXBoaWNzQmF0Y2hQcm9jZXNzaW5nPTA8Zz8hMDohMTtULnRpbWVyc0JhdGNoUHJvY2Vzc2luZz0KMDxsPyEwOiExO1QuZ3JhcGhpY3NEaXNhYmxlU2NhbmxpbmVSZW5kZXJpbmc9MDxuPyEwOiExO1QuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0wPG0/ITA6ITE7VC50aWxlUmVuZGVyaW5nPTA8dD8hMDohMTtULnRpbGVDYWNoaW5nPTA8dj8hMDohMTthPXkoMzIzKTtiLkdCQ0VuYWJsZWQ9MTkyPT09YXx8VC51c2VHYmNXaGVuQXZhaWxhYmxlJiYxMjg9PT1hPyEwOiExO2IuR0JDRG91YmxlU3BlZWQ9ITE7Yi5yZWdpc3RlckE9MDtiLnJlZ2lzdGVyQj0wO2IucmVnaXN0ZXJDPTA7Yi5yZWdpc3RlckQ9MDtiLnJlZ2lzdGVyRT0wO2IucmVnaXN0ZXJIPTA7Yi5yZWdpc3Rlckw9MDtiLnJlZ2lzdGVyRj0wO2Iuc3RhY2tQb2ludGVyPTA7Yi5wcm9ncmFtQ291bnRlcj0wO2IuY3VycmVudEN5Y2xlcz0wO2IuaXNIYWx0Tm9ybWFsPSExO2IuaXNIYWx0Tm9KdW1wPSExO2IuaXNIYWx0QnVnPSExO2IuaXNTdG9wcGVkPSExO2IuR0JDRW5hYmxlZD8oYi5yZWdpc3RlckE9MTcsYi5yZWdpc3RlckY9CjEyOCxiLnJlZ2lzdGVyQj0wLGIucmVnaXN0ZXJDPTAsYi5yZWdpc3RlckQ9MjU1LGIucmVnaXN0ZXJFPTg2LGIucmVnaXN0ZXJIPTAsYi5yZWdpc3Rlckw9MTMpOihiLnJlZ2lzdGVyQT0xLGIucmVnaXN0ZXJGPTE3NixiLnJlZ2lzdGVyQj0wLGIucmVnaXN0ZXJDPTE5LGIucmVnaXN0ZXJEPTAsYi5yZWdpc3RlckU9MjE2LGIucmVnaXN0ZXJIPTEsYi5yZWdpc3Rlckw9NzcpO2IucHJvZ3JhbUNvdW50ZXI9MjU2O2Iuc3RhY2tQb2ludGVyPTY1NTM0O2QuaXNSYW1CYW5raW5nRW5hYmxlZD0hMTtkLmlzTUJDMVJvbU1vZGVFbmFibGVkPSEwO2E9eSgzMjcpO2QuaXNSb21Pbmx5PSExO2QuaXNNQkMxPSExO2QuaXNNQkMyPSExO2QuaXNNQkMzPSExO2QuaXNNQkM1PSExOzA9PT1hP2QuaXNSb21Pbmx5PSEwOjE8PWEmJjM+PWE/ZC5pc01CQzE9ITA6NTw9YSYmNj49YT9kLmlzTUJDMj0hMDoxNTw9YSYmMTk+PWE/ZC5pc01CQzM9ITA6MjU8PWEmJjMwPj1hJiYoZC5pc01CQzU9ITApO2QuY3VycmVudFJvbUJhbms9CjE7ZC5jdXJyZW50UmFtQmFuaz0wO2goNjUzNjEsMjU1KTtoKDY1MzYyLDI1NSk7aCg2NTM2MywyNTUpO2goNjUzNjQsMjU1KTtoKDY1MzY1LDI1NSk7ci5jdXJyZW50Q3ljbGVzPTA7ci5zY2FubGluZUN5Y2xlQ291bnRlcj0wO3Iuc2NhbmxpbmVSZWdpc3Rlcj0wO3Iuc2Nyb2xsWD0wO3Iuc2Nyb2xsWT0wO3Iud2luZG93WD0wO3Iud2luZG93WT0wO2IuR0JDRW5hYmxlZD8oci5zY2FubGluZVJlZ2lzdGVyPTE0NCxoKDY1MzQ0LDE0NSksaCg2NTM0NSwxMjkpLGgoNjUzNDgsMTQ0KSxoKDY1MzUxLDI1MikpOihyLnNjYW5saW5lUmVnaXN0ZXI9MTQ0LGgoNjUzNDQsMTQ1KSxoKDY1MzQ1LDEzMyksaCg2NTM1MCwyNTUpLGgoNjUzNTEsMjUyKSxoKDY1MzUyLDI1NSksaCg2NTM1MywyNTUpKTtoKDY1MzU5LDApO2goNjUzOTIsMSk7Yi5HQkNFbmFibGVkPyhoKDY1Mzg0LDE5MiksaCg2NTM4NSwyNTUpLGgoNjUzODYsMTkzKSxoKDY1Mzg3LDEzKSk6KGgoNjUzODQsMjU1KSxoKDY1Mzg1LAoyNTUpLGgoNjUzODYsMjU1KSxoKDY1Mzg3LDI1NSkpO2UuY3VycmVudEN5Y2xlcz0wO2UuTlI1MExlZnRNaXhlclZvbHVtZT0wO2UuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9MDtlLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD0hMDtlLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD0hMDtlLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD0hMDtlLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD0hMDtlLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7ZS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD0hMDtlLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7ZS5OUjUySXNTb3VuZEVuYWJsZWQ9ITA7ZS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPTA7ZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPTA7ZS5mcmFtZVNlcXVlbmNlcj0KMDtlLmF1ZGlvUXVldWVJbmRleD0wO3ouaW5pdGlhbGl6ZSgpO0wuaW5pdGlhbGl6ZSgpO0kuaW5pdGlhbGl6ZSgpO00uaW5pdGlhbGl6ZSgpO2goZS5tZW1vcnlMb2NhdGlvbk5SNTAsMTE5KTtoKGUubWVtb3J5TG9jYXRpb25OUjUxLDI0Myk7aChlLm1lbW9yeUxvY2F0aW9uTlI1MiwyNDEpO3EuY2hhbm5lbDFTYW1wbGU9MTU7cS5jaGFubmVsMlNhbXBsZT0xNTtxLmNoYW5uZWwzU2FtcGxlPTE1O3EuY2hhbm5lbDRTYW1wbGU9MTU7cS5jaGFubmVsMURhY0VuYWJsZWQ9ITE7cS5jaGFubmVsMkRhY0VuYWJsZWQ9ITE7cS5jaGFubmVsM0RhY0VuYWJsZWQ9ITE7cS5jaGFubmVsNERhY0VuYWJsZWQ9ITE7cS5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7cS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O3EubWl4ZXJWb2x1bWVDaGFuZ2VkPSEwO3EubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMDtxLm5lZWRUb1JlbWl4U2FtcGxlcz0hMTtrLnVwZGF0ZUludGVycnVwdEVuYWJsZWQoMCk7Cmgoay5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQsay5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlKTtrLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZCgyMjUpO2goay5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3Qsay5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUpO3AuY3VycmVudEN5Y2xlcz0wO3AuZGl2aWRlclJlZ2lzdGVyPTA7cC50aW1lckNvdW50ZXI9MDtwLnRpbWVyTW9kdWxvPTA7cC50aW1lckVuYWJsZWQ9ITE7cC50aW1lcklucHV0Q2xvY2s9MDtwLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITE7cC50aW1lckNvdW50ZXJXYXNSZXNldD0hMTtiLkdCQ0VuYWJsZWQ/KGgoNjUyODQsMzApLHAuZGl2aWRlclJlZ2lzdGVyPTc4NDApOihoKDY1Mjg0LDE3MSkscC5kaXZpZGVyUmVnaXN0ZXI9NDM5ODApO2goNjUyODcsMjQ4KTtwLnRpbWVySW5wdXRDbG9jaz0yNDg7Yi5HQkNFbmFibGVkPyhoKDY1MzkyLDI0OCksaCg2NTM1OSwyNTQpLGgoNjUzNTcsMTI2KSxoKDY1MjgwLAoyMDcpLGgoNjUyODIsMTI0KSxoKDY1Mjk1LDIyNSksaCg2NTM4OCwyNTQpLGgoNjUzOTcsMTQzKSk6KGgoNjUzOTIsMjU1KSxoKDY1MzU5LDI1NSksaCg2NTM1NywyNTUpLGgoNjUyODAsMjA3KSxoKDY1MjgyLDEyNiksaCg2NTI5NSwyMjUpKTtDYT0hMTtWLmN5Y2xlc1BlckN5Y2xlU2V0PTJFOTtWLmN5Y2xlU2V0cz0wO1YuY3ljbGVzPTA7Vy5zdGVwc1BlclN0ZXBTZXQ9MkU5O1cuc3RlcFNldHM9MDtXLnN0ZXBzPTB9LGhhc0NvcmVTdGFydGVkOmZ1bmN0aW9uKCl7cmV0dXJuIENhPzE6MH0sc2F2ZVN0YXRlOmZ1bmN0aW9uKCl7Yi5zYXZlU3RhdGUoKTtyLnNhdmVTdGF0ZSgpO2suc2F2ZVN0YXRlKCk7QS5zYXZlU3RhdGUoKTtkLnNhdmVTdGF0ZSgpO3Auc2F2ZVN0YXRlKCk7ZS5zYXZlU3RhdGUoKTt6LnNhdmVTdGF0ZSgpO0wuc2F2ZVN0YXRlKCk7SS5zYXZlU3RhdGUoKTtNLnNhdmVTdGF0ZSgpO0NhPSExfSxsb2FkU3RhdGU6ZnVuY3Rpb24oKXtiLmxvYWRTdGF0ZSgpO3IubG9hZFN0YXRlKCk7CmsubG9hZFN0YXRlKCk7QS5sb2FkU3RhdGUoKTtkLmxvYWRTdGF0ZSgpO3AubG9hZFN0YXRlKCk7ZS5sb2FkU3RhdGUoKTt6LmxvYWRTdGF0ZSgpO0wubG9hZFN0YXRlKCk7SS5sb2FkU3RhdGUoKTtNLmxvYWRTdGF0ZSgpO0NhPSExO1YuY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O1YuY3ljbGVTZXRzPTA7Vi5jeWNsZXM9MDtXLnN0ZXBzUGVyU3RlcFNldD0yRTk7Vy5zdGVwU2V0cz0wO1cuc3RlcHM9MH0sZ2V0U3RlcHNQZXJTdGVwU2V0OmZ1bmN0aW9uKCl7cmV0dXJuIFcuc3RlcHNQZXJTdGVwU2V0fSxnZXRTdGVwU2V0czpmdW5jdGlvbigpe3JldHVybiBXLnN0ZXBTZXRzfSxnZXRTdGVwczpmdW5jdGlvbigpe3JldHVybiBXLnN0ZXBzfSxleGVjdXRlTXVsdGlwbGVGcmFtZXM6ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPTAsZD0wO2Q8YSYmMDw9YjspYj1iYigpLGQrPTE7cmV0dXJuIDA+Yj9iOjB9LGV4ZWN1dGVGcmFtZTpiYixleGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvOmZ1bmN0aW9uKGEpe3ZvaWQgMD09PQphJiYoYT0wKTtyZXR1cm4gUWEoITAsYSwtMSl9LGV4ZWN1dGVGcmFtZVVudGlsQnJlYWtwb2ludDpmdW5jdGlvbihhKXthPVFhKCEwLC0xLGEpO3JldHVybiAyPT09YT8xOmF9LGV4ZWN1dGVVbnRpbENvbmRpdGlvbjpRYSxleGVjdXRlU3RlcDpjYixnZXRDeWNsZXNQZXJDeWNsZVNldDpmdW5jdGlvbigpe3JldHVybiBWLmN5Y2xlc1BlckN5Y2xlU2V0fSxnZXRDeWNsZVNldHM6ZnVuY3Rpb24oKXtyZXR1cm4gVi5jeWNsZVNldHN9LGdldEN5Y2xlczpmdW5jdGlvbigpe3JldHVybiBWLmN5Y2xlc30sc2V0Sm95cGFkU3RhdGU6ZnVuY3Rpb24oYSxiLGQsZSxnLGgsbCxrKXswPGE/c2EoMCk6ZWEoMCwhMSk7MDxiP3NhKDEpOmVhKDEsITEpOzA8ZD9zYSgyKTplYSgyLCExKTswPGU/c2EoMyk6ZWEoMywhMSk7MDxnP3NhKDQpOmVhKDQsITEpOzA8aD9zYSg1KTplYSg1LCExKTswPGw/c2EoNik6ZWEoNiwhMSk7MDxrP3NhKDcpOmVhKDcsITEpfSxnZXROdW1iZXJPZlNhbXBsZXNJbkF1ZGlvQnVmZmVyOlVhLApjbGVhckF1ZGlvQnVmZmVyOlZhLFdBU01CT1lfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9NRU1PUllfU0laRTo5MTA5NTA0LFdBU01CT1lfV0FTTV9QQUdFUzoxMzksQVNTRU1CTFlTQ1JJUFRfTUVNT1JZX0xPQ0FUSU9OOjAsQVNTRU1CTFlTQ1JJUFRfTUVNT1JZX1NJWkU6MTAyNCxXQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OOjEwMjQsV0FTTUJPWV9TVEFURV9TSVpFOjEwMjQsR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MjA0OCxHQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjY1NTM1LFZJREVPX1JBTV9MT0NBVElPTjoyMDQ4LFZJREVPX1JBTV9TSVpFOjE2Mzg0LFdPUktfUkFNX0xPQ0FUSU9OOjE4NDMyLFdPUktfUkFNX1NJWkU6MzI3NjgsT1RIRVJfR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046NTEyMDAsT1RIRVJfR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRToxNjM4NCxHUkFQSElDU19PVVRQVVRfTE9DQVRJT046Njc1ODQsR1JBUEhJQ1NfT1VUUFVUX1NJWkU6NTIxMjE2LApHQkNfUEFMRVRURV9MT0NBVElPTjo2NzU4NCxHQkNfUEFMRVRURV9TSVpFOjUxMixCR19QUklPUklUWV9NQVBfTE9DQVRJT046Njk2MzIsQkdfUFJJT1JJVFlfTUFQX1NJWkU6MjM1NTIsRlJBTUVfTE9DQVRJT046OTMxODQsRlJBTUVfU0laRTo5MzE4NCxCQUNLR1JPVU5EX01BUF9MT0NBVElPTjoyMzI0NDgsQkFDS0dST1VORF9NQVBfU0laRToxOTY2MDgsVElMRV9EQVRBX0xPQ0FUSU9OOjQyOTA1NixUSUxFX0RBVEFfU0laRToxNDc0NTYsT0FNX1RJTEVTX0xPQ0FUSU9OOjU3NjUxMixPQU1fVElMRVNfU0laRToxMjI4OCxBVURJT19CVUZGRVJfTE9DQVRJT046NTg4ODAwLEFVRElPX0JVRkZFUl9TSVpFOjEzMTA3MixDQVJUUklER0VfUkFNX0xPQ0FUSU9OOjcxOTg3MixDQVJUUklER0VfUkFNX1NJWkU6MTMxMDcyLENBUlRSSURHRV9ST01fTE9DQVRJT046ODUwOTQ0LENBUlRSSURHRV9ST01fU0laRTo4MjU4NTYwLGdldFdhc21Cb3lPZmZzZXRGcm9tR2FtZUJveU9mZnNldDpaYSwKZ2V0UmVnaXN0ZXJBOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJBfSxnZXRSZWdpc3RlckI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckJ9LGdldFJlZ2lzdGVyQzpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQ30sZ2V0UmVnaXN0ZXJEOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJEfSxnZXRSZWdpc3RlckU6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckV9LGdldFJlZ2lzdGVySDpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVySH0sZ2V0UmVnaXN0ZXJMOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJMfSxnZXRSZWdpc3RlckY6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckZ9LGdldFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXJ9LGdldFN0YWNrUG9pbnRlcjpmdW5jdGlvbigpe3JldHVybiBiLnN0YWNrUG9pbnRlcn0sZ2V0T3Bjb2RlQXRQcm9ncmFtQ291bnRlcjpmdW5jdGlvbigpe3JldHVybiB5KGIucHJvZ3JhbUNvdW50ZXIpfSwKZ2V0TFk6ZnVuY3Rpb24oKXtyZXR1cm4gci5zY2FubGluZVJlZ2lzdGVyfSxkcmF3QmFja2dyb3VuZE1hcFRvV2FzbU1lbW9yeTpmdW5jdGlvbihhKXt2b2lkIDA9PT1hJiYoYT0wKTt2YXIgYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ7RC5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0JiYoYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCk7dmFyIGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7RC5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTtmb3IodmFyIGU9MDsyNTY+ZTtlKyspZm9yKHZhciBoPTA7MjU2Pmg7aCsrKXt2YXIgbD1lLGs9aCxtPWQrMzIqKGw+PjMpKyhrPj4zKSxwPVoobSwwKTtwPXlhKGMscCk7dmFyIHE9bCU4O2w9ayU4O2w9Ny1sO2s9MDtiLkdCQ0VuYWJsZWQmJjA8YSYmKGs9WihtLDEpKTtuKDYsaykmJihxPTctcSk7CnZhciB0PTA7bigzLGspJiYodD0xKTttPVoocCsyKnEsdCk7cD1aKHArMipxKzEsdCk7cT0wO24obCxwKSYmKHErPTEscTw8PTEpO24obCxtKSYmKHErPTEpO3A9MyooMjU2KmUraCk7aWYoYi5HQkNFbmFibGVkJiYwPGEpaz1KYShrJjcscSwhMSksbD1jYSgwLGspLG09Y2EoMSxrKSxxPWNhKDIsayksaz0yMzI0NDgrcCxnW2tdPWwsZ1trKzFdPW0sZ1trKzJdPXE7ZWxzZSBmb3IobD1JYShxLHIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksbT0wOzM+bTttKyspaz0yMzI0NDgrcCttLGdba109bH19LGRyYXdUaWxlRGF0YVRvV2FzbU1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzIzPmE7YSsrKWZvcih2YXIgYj0wOzMxPmI7YisrKXt2YXIgZD0wOzE1PGImJihkPTEpO3ZhciBlPWE7MTU8YSYmKGUtPTE1KTtlPDw9NDtlPTE1PGI/ZSsoYi0xNSk6ZStiO3ZhciBoPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0OzE1PGEmJihoPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCk7CmZvcih2YXIgZz0wOzg+ZztnKyspaGIoZSxoLGQsMCw3LGcsOCpiLDgqYStnLDI0OCw0MjkwNTYsITApfX0sZ2V0RElWOmZ1bmN0aW9uKCl7cmV0dXJuIHAuZGl2aWRlclJlZ2lzdGVyfSxnZXRUSU1BOmZ1bmN0aW9uKCl7cmV0dXJuIHAudGltZXJDb3VudGVyfSxnZXRUTUE6ZnVuY3Rpb24oKXtyZXR1cm4gcC50aW1lck1vZHVsb30sZ2V0VEFDOmZ1bmN0aW9uKCl7dmFyIGE9cC50aW1lcklucHV0Q2xvY2s7cC50aW1lckVuYWJsZWQmJihhfD00KTtyZXR1cm4gYX0sdXBkYXRlOmJiLGVtdWxhdGlvblN0ZXA6Y2IsZ2V0QXVkaW9RdWV1ZUluZGV4OlVhLHJlc2V0QXVkaW9RdWV1ZTpWYSx3YXNtTWVtb3J5U2l6ZTo5MTA5NTA0LHdhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb246MTAyNCx3YXNtQm95SW50ZXJuYWxTdGF0ZVNpemU6MTAyNCxnYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbjoyMDQ4LGdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemU6NjU1MzUsdmlkZW9PdXRwdXRMb2NhdGlvbjo2NzU4NCwKZnJhbWVJblByb2dyZXNzVmlkZW9PdXRwdXRMb2NhdGlvbjo5MzE4NCxnYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb246Njc1ODQsZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemU6NTEyLGJhY2tncm91bmRNYXBMb2NhdGlvbjoyMzI0NDgsdGlsZURhdGFNYXA6NDI5MDU2LHNvdW5kT3V0cHV0TG9jYXRpb246NTg4ODAwLGdhbWVCeXRlc0xvY2F0aW9uOjg1MDk0NCxnYW1lUmFtQmFua3NMb2NhdGlvbjo3MTk4NzJ9KTtjb25zdCBXYj1hc3luYygpPT4oe2luc3RhbmNlOntleHBvcnRzOlZifSxieXRlTWVtb3J5OkVhLndhc21CeXRlTWVtb3J5LHR5cGU6IlR5cGVTY3JpcHQifSk7bGV0IERhLHdiLHY7dj17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCwKV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxmcmFtZVNraXBDb3VudGVyOjAsY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kczowLG1lc3NhZ2VIYW5kbGVyOihhKT0+e2NvbnN0IGI9d2EoYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIEUuQ09OTkVDVDoiR1JBUEhJQ1MiPT09CmIubWVzc2FnZS53b3JrZXJJZD8odi5ncmFwaGljc1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHhhKHpiLmJpbmQodm9pZCAwLHYpLHYuZ3JhcGhpY3NXb3JrZXJQb3J0KSk6Ik1FTU9SWSI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KHYubWVtb3J5V29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0seGEoQ2IuYmluZCh2b2lkIDAsdiksdi5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyh2LmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx4YShCYi5iaW5kKHZvaWQgMCx2KSx2LmNvbnRyb2xsZXJXb3JrZXJQb3J0KSk6IkFVRElPIj09PWIubWVzc2FnZS53b3JrZXJJZCYmKHYuYXVkaW9Xb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx4YShBYi5iaW5kKHZvaWQgMCx2KSx2LmF1ZGlvV29ya2VyUG9ydCkpO2JhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBFLklOU1RBTlRJQVRFX1dBU006KGFzeW5jKCk9Pgp7bGV0IGE7YT1hd2FpdCBXYigpO3Yud2FzbUluc3RhbmNlPWEuaW5zdGFuY2U7di53YXNtQnl0ZU1lbW9yeT1hLmJ5dGVNZW1vcnk7YmEoTih7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgRS5DT05GSUc6di53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkodixiLm1lc3NhZ2UuY29uZmlnKTt2Lm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7YmEoTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEUuUkVTRVRfQVVESU9fUVVFVUU6di53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKTtiYShOKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgRS5QTEFZOmlmKCF2LnBhdXNlZHx8IXYud2FzbUluc3RhbmNlfHwhdi53YXNtQnl0ZU1lbW9yeSl7YmEoTih7ZXJyb3I6ITB9LGIubWVzc2FnZUlkKSk7YnJlYWt9di5wYXVzZWQ9ITE7di5mcHNUaW1lU3RhbXBzPVtdO3YuZnJhbWVTa2lwQ291bnRlcj0wO3YuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0KMDt4Yih2LDFFMy92Lm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7dWIodik7YmEoTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEUuUEFVU0U6di5wYXVzZWQ9ITA7di51cGRhdGVJZCYmKGNsZWFyVGltZW91dCh2LnVwZGF0ZUlkKSx2LnVwZGF0ZUlkPXZvaWQgMCk7YmEoTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEUuUlVOX1dBU01fRVhQT1JUOmE9Yi5tZXNzYWdlLnBhcmFtZXRlcnM/di53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XS5hcHBseSh2b2lkIDAsYi5tZXNzYWdlLnBhcmFtZXRlcnMpOnYud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0oKTtiYShOKHt0eXBlOkUuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBFLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPTA7bGV0IGM9di53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7Yi5tZXNzYWdlLnN0YXJ0JiYoYT0KYi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoYz1iLm1lc3NhZ2UuZW5kKTthPXYud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxjKS5idWZmZXI7YmEoTih7dHlwZTpFLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCksW2FdKTticmVha31jYXNlIEUuR0VUX1dBU01fQ09OU1RBTlQ6YmEoTih7dHlwZTpFLkdFVF9XQVNNX0NPTlNUQU5ULHJlc3BvbnNlOnYud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmNvbnN0YW50XS52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhiKX19LGdldEZQUzooKT0+MDx2LnRpbWVTdGFtcHNVbnRpbFJlYWR5P3Yub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlOnYuZnBzVGltZVN0YW1wcz92LmZwc1RpbWVTdGFtcHMubGVuZ3RoOjB9O3hhKHYubWVzc2FnZUhhbmRsZXIpfSkoKTsK";

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
    /*ROLLUP_REPLACE_BROWSER
    
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
     ROLLUP_REPLACE_BROWSER*/
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
            return millerRabinTest(n, [2, 325, 9375, 28178, 450775, 9780504, 1795265022]);
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

function libWorkerOnMessage(event) {
  const eventData = getEventData(event);

  if (!eventData.message) {
    return;
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

      if (this.wasmInstance && this.wasmByteMemory) {
        await WasmBoyGraphics.initialize(this.canvasElement, this.wasmInstance, this.wasmByteMemory, this.options.updateGraphicsCallback);
      }
    };

    return setCanvasTask();
  }

  getCanvas() {
    return this.canvasElement;
  } // Finish request for wasm module, and fetch game


  loadROM(ROM, fetchHeaders) {
    const boundLoadROM = loadROMToWasmBoy.bind(this);
    return boundLoadROM(ROM, fetchHeaders);
  } // function to start/resume


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
        await this.worker.postMessage({
          type: WORKER_MESSAGE_TYPE.PLAY
        });
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
var version = "0.3.3";
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
	"debugger:watch": "npx preact watch --src demo/debugger",
	"debugger:serve": "npx run-s debugger:build debugger:serve:nobuild",
	"debugger:serve:nobuild": "npx preact serve",
	"debugger:build": "npx preact build -p --src demo/debugger --template demo/template.html --no-prerender",
	"benchmark:build": "npx rollup -c --environment PROD,TS,BENCHMARK",
	"benchmark:build:skiplib": "npx rollup -c --environment PROD,TS,BENCHMARK,SKIP_LIB",
	"benchmark:dev": "npm run benchmark:watch",
	"benchmark:watch": "npx rollup -c -w --environment TS,BENCHMARK,SERVE",
	"amp:build": "npx rollup -c --environment PROD,TS,AMP",
	"amp:build:skiplib": "npx rollup -c --environment PROD,TS,AMP,SKIP_LIB",
	"amp:dev": "npm run amp:watch",
	"amp:watch": "npx rollup -c -w --environment TS,AMP,SERVE",
	"demo:build": "npx run-s core:build lib:build demo:build:apps",
	"demo:build:apps": "npx run-s debugger:build benchmark:build:skiplib amp:build:skiplib demo:build:manifest",
	"demo:build:manifest": "cp demo/manifest.json build/",
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
	"responsive-gamepad": "0.1.3"
};
var devDependencies = {
	"@ampproject/rollup-plugin-closure-compiler": "^0.7.2",
	"@babel/core": "^7.1.2",
	"@babel/plugin-proposal-class-properties": "^7.1.0",
	"@babel/plugin-proposal-object-rest-spread": "^7.0.0",
	"@babel/plugin-transform-react-jsx": "^7.0.0",
	assemblyscript: "github:AssemblyScript/assemblyscript#c769f65bacd5392e5c9efab112b33244fc0a0c8f",
	"babel-plugin-filter-imports": "^2.0.3",
	"babel-preset-env": "^1.6.1",
	"big-integer": "^1.6.38",
	"browser-detect": "^0.2.28",
	bulma: "^0.7.1",
	"chart.js": "^2.7.3",
	"chartjs-plugin-downsample": "^1.0.2",
	concurrently: "^3.5.1",
	"gh-pages": "^1.1.0",
	husky: "^1.0.0-rc.8",
	"load-script": "^1.0.0",
	"markdown-table": "^1.1.1",
	microseconds: "^0.1.0",
	mocha: "^5.0.1",
	np: "^3.1.0",
	"npm-run-all": "^4.1.5",
	"performance-now": "^2.1.0",
	"pngjs-image": "^0.11.7",
	preact: "^8.2.1",
	"preact-cli": "^2.2.1",
	"preact-cli-sw-precache": "^1.0.3",
	"preact-compat": "^3.17.0",
	"preact-portal": "^1.1.3",
	prettier: "^1.12.1",
	"pretty-quick": "^1.6.0",
	"recursive-readdir-sync": "^1.0.6",
	rollup: "^0.66.1",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-bundle-size": "^1.0.2",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-copy-glob": "^0.2.2",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-postcss": "^1.6.2",
	"rollup-plugin-replace": "^2.1.0",
	"rollup-plugin-serve": "^0.6.0",
	"rollup-plugin-typescript": "^1.0.0",
	"rollup-plugin-url": "^1.4.0",
	"source-map-loader": "^0.2.4",
	"stats-lite": "^2.2.0",
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
  enableDefaultJoypad: WasmBoyController.enableDefaultJoypad.bind(WasmBoyController),
  disableDefaultJoypad: WasmBoyController.disableDefaultJoypad.bind(WasmBoyController),
  setJoypadState: WasmBoyController.setJoypadState.bind(WasmBoyController),
  addTouchInput: WasmBoyController.addTouchInput.bind(WasmBoyController),
  removeTouchInput: WasmBoyController.removeTouchInput.bind(WasmBoyController),
  resumeAudioContext: WasmBoyAudio.resumeAudioContext.bind(WasmBoyAudio),
  _getCartridgeInfo: WasmBoyMemory.getCartridgeInfo.bind(WasmBoyMemory),
  _saveCurrentAudioBufferToWav: saveCurrentAudioBufferToWav,
  _runWasmExport: runWasmExport,
  _getWasmMemorySection: getWasmMemorySection,
  _getWasmConstant: getWasmConstant,
  _getStepsAsString: getStepsAsString,
  _getCyclesAsString: getCyclesAsString
};

exports.WasmBoy = WasmBoy;
//# sourceMappingURL=wasmboy.ts.cjs.js.map
