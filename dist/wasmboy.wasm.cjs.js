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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6dS5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBGKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBnLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKX19ZnVuY3Rpb24gRyhhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLApXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZy5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZy5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geChhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGM9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2M9MzI3Njg6CjU8PWImJjY+PWI/Yz0yMDQ4OjE1PD1iJiYxOT49Yj9jPTMyNzY4OjI1PD1iJiYzMD49YiYmKGM9MTMxMDcyKTtyZXR1cm4gYz9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04rYyk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24geShhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIEkoYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGcuQ0xFQVJfTUVNT1JZOmZvcih2YXIgYz0wO2M8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2MrKylhLndhc21CeXRlTWVtb3J5W2NdPTA7Yz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApOwphLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpnLkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmMuYnVmZmVyfSxiLm1lc3NhZ2VJZCksW2MuYnVmZmVyXSk7YnJlYWs7Y2FzZSBnLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCeXRlc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpfSwKYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGcuU0VUX01FTU9SWTpjPU9iamVjdC5rZXlzKGIubWVzc2FnZSk7Yy5pbmNsdWRlcyhmLkNBUlRSSURHRV9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5DQVJUUklER0VfUk9NXSksYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2MuaW5jbHVkZXMoZi5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2YuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7Yy5pbmNsdWRlcyhmLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2YuR0FNRUJPWV9NRU1PUlldKSxhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKGYuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5QQUxFVFRFX01FTU9SWV0pLAphLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pO2MuaW5jbHVkZXMoZi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5JTlRFUk5BTF9TVEFURV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zy5TRVRfTUVNT1JZX0RPTkV9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLkdFVF9NRU1PUlk6e2M9e3R5cGU6Zy5HRVRfTUVNT1JZfTtjb25zdCBsPVtdO3ZhciBkPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihkLmluY2x1ZGVzKGYuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD0KZSYmMz49ZT9tPTIwOTcxNTI6NTw9ZSYmNj49ZT9tPTI2MjE0NDoxNTw9ZSYmMTk+PWU/bT0yMDk3MTUyOjI1PD1lJiYzMD49ZSYmKG09ODM4ODYwOCk7ZT1tP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbSk6bmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7Y1tmLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWQuaW5jbHVkZXMoZi5DQVJUUklER0VfUkFNKSYmKGU9eChhKS5idWZmZXIsY1tmLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtkLmluY2x1ZGVzKGYuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGNbZi5DQVJUUklER0VfSEVBREVSXT0KZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5HQU1FQk9ZX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLGNbZi5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGNbZi5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGQ9eShhKS5idWZmZXIsY1tmLklOVEVSTkFMX1NUQVRFXT0KZCxsLnB1c2goZCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGMsYi5tZXNzYWdlSWQpLGwpfX19ZnVuY3Rpb24gSihhKXtjb25zdCBiPSJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGItMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTthLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB6KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEEoYSl7dmFyIGI9KCJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS0KYS5mcHNUaW1lU3RhbXBzW2EuZnBzVGltZVN0YW1wcy5sZW5ndGgtMV07Yj1CLWI7MD5iJiYoYj0wKTthLnVwZGF0ZUlkPXNldFRpbWVvdXQoKCk9PntDKGEpfSxNYXRoLmZsb29yKGIpKX1mdW5jdGlvbiBDKGEsYil7aWYoYS5wYXVzZWQpcmV0dXJuITA7dm9pZCAwIT09YiYmKEI9Yik7cj1hLmdldEZQUygpO2lmKHI+YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUrMSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksQShhKSwhMDtKKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZTtjP3YoYSxiKTooZT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLGIoZSkpfSkpLnRoZW4oKGIpPT57aWYoMDw9Yil7ayhoKHt0eXBlOmcuVVBEQVRFRCxmcHM6cn0pKTtiPSExO2Eub3B0aW9ucy5mcmFtZVNraXAmJjA8YS5vcHRpb25zLmZyYW1lU2tpcCYmCihhLmZyYW1lU2tpcENvdW50ZXIrKyxhLmZyYW1lU2tpcENvdW50ZXI8PWEub3B0aW9ucy5mcmFtZVNraXA/Yj0hMDphLmZyYW1lU2tpcENvdW50ZXI9MCk7Ynx8KGI9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OK2EuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkUpLmJ1ZmZlcixhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuVVBEQVRFRCxncmFwaGljc0ZyYW1lQnVmZmVyOmJ9KSxbYl0pKTtjb25zdCBjPXt0eXBlOmcuVVBEQVRFRH07Y1tmLkNBUlRSSURHRV9SQU1dPXgoYSkuYnVmZmVyO2NbZi5HQU1FQk9ZX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXI7CmNbZi5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7Y1tmLklOVEVSTkFMX1NUQVRFXT15KGEpLmJ1ZmZlcjtPYmplY3Qua2V5cyhjKS5mb3JFYWNoKChhKT0+e3ZvaWQgMD09PWNbYV0mJihjW2FdPShuZXcgVWludDhBcnJheSkuYnVmZmVyKX0pO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGMpLFtjW2YuQ0FSVFJJREdFX1JBTV0sY1tmLkdBTUVCT1lfTUVNT1JZXSxjW2YuUEFMRVRURV9NRU1PUlldLGNbZi5JTlRFUk5BTF9TVEFURV1dKTtBKGEpfWVsc2UgayhoKHt0eXBlOmcuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHYoYSxiKXt2YXIgYz1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PQpjJiZiKGMpO2lmKDE9PT1jKXtjPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0QXVkaW9RdWV1ZUluZGV4KCk7Y29uc3QgZD1yPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTsuMjU8YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzJiZkPyhEKGEsYyksc2V0VGltZW91dCgoKT0+e3ooYSk7dihhLGIpfSxNYXRoLmZsb29yKE1hdGguZmxvb3IoMUUzKihhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMtLjI1KSkvMTApKSk6KEQoYSxjKSx2KGEsYikpfX1mdW5jdGlvbiBEKGEsYil7Y29uc3QgYz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuVVBEQVRFRCxhdWRpb0J1ZmZlcjpjLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDwKYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9KSxbY10pO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCl9Y29uc3QgcD0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCB1O3B8fCh1PXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgZz17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIiwKUEFVU0U6IlBBVVNFIixVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQifSxmPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IHQ9MCxLPXt9O2NvbnN0IHc9e2Vudjp7bG9nOihhLGIsYyxkLGUsZyxmKT0+e3ZhciBoPShuZXcgVWludDMyQXJyYXkod2FzbUluc3RhbmNlLmV4cG9ydHMubWVtb3J5LmJ1ZmZlciwKYSwxKSlbMF07YT1TdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsbmV3IFVpbnQxNkFycmF5KHdhc21JbnN0YW5jZS5leHBvcnRzLm1lbW9yeS5idWZmZXIsYSs0LGgpKTstOTk5OSE9PWImJihhPWEucmVwbGFjZSgiJDAiLGIpKTstOTk5OSE9PWMmJihhPWEucmVwbGFjZSgiJDEiLGMpKTstOTk5OSE9PWQmJihhPWEucmVwbGFjZSgiJDIiLGQpKTstOTk5OSE9PWUmJihhPWEucmVwbGFjZSgiJDMiLGUpKTstOTk5OSE9PWcmJihhPWEucmVwbGFjZSgiJDQiLGcpKTstOTk5OSE9PWYmJihhPWEucmVwbGFjZSgiJDUiLGYpKTtjb25zb2xlLmxvZygiW1dhc21Cb3ldICIrYSl9LGhleExvZzooYSxiLGMsZCxlLGcpPT57aWYoIUtbYV0pe2xldCBmPSJbV2FzbUJveV0iOy05OTk5IT09YSYmKGYrPWAgMHgke2EudG9TdHJpbmcoMTYpfSBgKTstOTk5OSE9PWImJihmKz1gIDB4JHtiLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1jJiYoZis9YCAweCR7Yy50b1N0cmluZygxNil9IGApOy05OTk5IT09CmQmJihmKz1gIDB4JHtkLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1lJiYoZis9YCAweCR7ZS50b1N0cmluZygxNil9IGApOy05OTk5IT09ZyYmKGYrPWAgMHgke2cudG9TdHJpbmcoMTYpfSBgKTtjb25zb2xlLmxvZyhmKX19fX0sRT1hc3luYyhhKT0+e2xldCBiPXZvaWQgMDtyZXR1cm4gYj1XZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZz9hd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZyhmZXRjaChhKSx3KTphd2FpdCAoYXN5bmMoKT0+e2NvbnN0IGI9YXdhaXQgZmV0Y2goYSkudGhlbigoYSk9PmEuYXJyYXlCdWZmZXIoKSk7cmV0dXJuIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGIsdyl9KSgpfSxMPWFzeW5jKGEpPT57YT1CdWZmZXIuZnJvbShhLnNwbGl0KCIsIilbMV0sImJhc2U2NCIpO3JldHVybiBhd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShhLHcpfSxNPWFzeW5jKGEpPT57YT0oYT9hd2FpdCBFKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmZoQmdDWDkvZjM5L2YzOS9md0JnQUFCZ0FYOEJmMkFDZjM4QVlBRi9BR0FDZjM4QmYyQUFBWDlnQTM5L2Z3Ri9ZQU4vZjM4QVlBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCSDkvZjM4QVlBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FBTzRBcllDQWdJQ0FnRUJBd0VCQVFFQkFRRUJBUVVFQkFFQkJBRUJBUUFHQlFNQkFRRUJBUUVCQVFFQkFRRUNBUVFCQVFRQkFRRUJBUUVCQVFFQkJnWUdBZ1lHQlFVTEJRVUZCUXNLQlFVRkJ3VUhCd3dLRFFrSkNBZ0RCQUVCQVFZR0JBRUdCZ0VCQVFFR0JBRUJBUUVCQWdJQ0FnSUNBUVVDQmdFQ0JnRUNBZ1lHQWdZR0JnVU9DQVFDQWdRRUFRSUdBZ0lEQkFRRUJBUUVCQVFFQkFRRUJBUUVBUVFCQkFFRUFRUUVCQVVFQkFZR0JBZ0RBd0VDQlFFRUFRUUVCQVFGQXdnQkFRRUVBUVFFQmdZR0F3VUVBd1FFQkFJREF3Z0NBZ0lHQWdJRUFnSUdCZ1lDQWdJQ0FnRUNBd1FFQWdRRUFnUUVBZ1FFQWdJQ0FnSUNBZ0lDQWdJRkJ3SUNCQUlDQWdJQkJnTUVCZ1FHQmdZSEJnSUNBZ1lHQmdJREFRUUVEd1lHQmdZR0JnWUdCZ1lHQmdRTUFRWUdCZ1lCQWdRSEJBVURBUUFBQnBNTGhRSi9BRUVBQzM4QVFZQ0FyQVFMZndCQml3RUxmd0JCQUF0L0FFR0FDQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVILy93TUxmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FrQVFMZndCQmdPZ2ZDMzhBUVlDUUJBdC9BRUdBQkF0L0FFR0FvQVFMZndCQmdMZ0JDMzhBUVlEWUJRdC9BRUdBMkFVTGZ3QkJnSmdPQzM4QVFZQ0FEQXQvQUVHQW1Cb0xmd0JCZ0lBSkMzOEFRWUNZSXd0L0FFR0E0QUFMZndCQmdQZ2pDMzhBUVlDQUNBdC9BRUdBK0NzTGZ3QkJnSUFJQzM4QVFZRDRNd3QvQUVHQWlQZ0RDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQnovNERDMzhCUVFBTGZ3RkI4UDREQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFmOEFDMzhCUWY4QUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVlEM0FndC9BVUdBZ0FnTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhWL2dNTGZ3RkIwZjREQzM4QlFkTCtBd3QvQVVIVC9nTUxmd0ZCMVA0REMzOEJRZWorQXd0L0FVSHIvZ01MZndGQjZmNERDMzhCUVFBTGZ3QkJnSUNzQkF0L0FFR0FDQXQvQUVHQUNBdC9BRUdBRUF0L0FFSC8vd01MZndCQmdKQUVDMzhBUVlDUUJBdC9BRUdBQkF0L0FFR0EyQVVMZndCQmdKZ09DMzhBUVlDWUdndC9BRUdBK0NNTGZ3QkJnUGdyQzM4QVFZRDRNd3NIeFE5ZEJtMWxiVzl5ZVFJQUJtTnZibVpwWndBWkRtaGhjME52Y21WVGRHRnlkR1ZrQUJvSmMyRjJaVk4wWVhSbEFDZ0piRzloWkZOMFlYUmxBRGdTWjJWMFUzUmxjSE5RWlhKVGRHVndVMlYwQURrTFoyVjBVM1JsY0ZObGRITUFPZ2huWlhSVGRHVndjd0E3RldWNFpXTjFkR1ZOZFd4MGFYQnNaVVp5WVcxbGN3Q1NBZ3hsZUdWamRYUmxSbkpoYldVQWtRSUlYM05sZEdGeVoyTUFzd0laWlhobFkzVjBaVVp5WVcxbFFXNWtRMmhsWTJ0QmRXUnBid0N5QWh0bGVHVmpkWFJsUm5KaGJXVlZiblJwYkVKeVpXRnJjRzlwYm5RQWxBSVZaWGhsWTNWMFpWVnVkR2xzUTI5dVpHbDBhVzl1QUxRQ0MyVjRaV04xZEdWVGRHVndBSTBDRkdkbGRFTjVZMnhsYzFCbGNrTjVZMnhsVTJWMEFKVUNER2RsZEVONVkyeGxVMlYwY3dDV0FnbG5aWFJEZVdOc1pYTUFsd0lPYzJWMFNtOTVjR0ZrVTNSaGRHVUFuUUlmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnQ1BBaEJqYkdWaGNrRjFaR2x2UW5WbVptVnlBRElYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERBQk5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXdFU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF3SWVRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdNYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREJCWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdVU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3WWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJ4eEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2dTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdrT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQ2hGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNTERWZFBVa3RmVWtGTlgxTkpXa1VERENaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTU5JazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVUREaGhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNEREeFJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNUUZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9BeEVRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1TR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01URkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF4UU9SbEpCVFVWZlRFOURRVlJKVDA0REZRcEdVa0ZOUlY5VFNWcEZBeFlYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERGeE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhnU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4a09WRWxNUlY5RVFWUkJYMU5KV2tVREdoSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERHdzVQUVUxZlZFbE1SVk5mVTBsYVJRTWNGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZEVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF4NFdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNZkVrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTWdGa05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0RElSSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURJaUZuWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUUFBZ3huWlhSU1pXZHBjM1JsY2tFQW5nSU1aMlYwVW1WbmFYTjBaWEpDQUo4Q0RHZGxkRkpsWjJsemRHVnlRd0NnQWd4blpYUlNaV2RwYzNSbGNrUUFvUUlNWjJWMFVtVm5hWE4wWlhKRkFLSUNER2RsZEZKbFoybHpkR1Z5U0FDakFneG5aWFJTWldkcGMzUmxja3dBcEFJTVoyVjBVbVZuYVhOMFpYSkdBS1VDRVdkbGRGQnliMmR5WVcxRGIzVnVkR1Z5QUtZQ0QyZGxkRk4wWVdOclVHOXBiblJsY2dDbkFobG5aWFJQY0dOdlpHVkJkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFLZ0NCV2RsZEV4WkFLa0NIV1J5WVhkQ1lXTnJaM0p2ZFc1a1RXRndWRzlYWVhOdFRXVnRiM0o1QUxVQ0dHUnlZWGRVYVd4bFJHRjBZVlJ2VjJGemJVMWxiVzl5ZVFDc0FnWm5aWFJFU1ZZQXJRSUhaMlYwVkVsTlFRQ3VBZ1puWlhSVVRVRUFyd0lHWjJWMFZFRkRBTEFDQm5Wd1pHRjBaUUNSQWcxbGJYVnNZWFJwYjI1VGRHVndBSTBDRW1kbGRFRjFaR2x2VVhWbGRXVkpibVJsZUFDUEFnOXlaWE5sZEVGMVpHbHZVWFZsZFdVQU1nNTNZWE50VFdWdGIzSjVVMmw2WlFQM0FSeDNZWE50UW05NVNXNTBaWEp1WVd4VGRHRjBaVXh2WTJGMGFXOXVBL2dCR0hkaGMyMUNiM2xKYm5SbGNtNWhiRk4wWVhSbFUybDZaUVA1QVIxbllXMWxRbTk1U1c1MFpYSnVZV3hOWlcxdmNubE1iMk5oZEdsdmJnUDZBUmxuWVcxbFFtOTVTVzUwWlhKdVlXeE5aVzF2Y25sVGFYcGxBL3NCRTNacFpHVnZUM1YwY0hWMFRHOWpZWFJwYjI0RC9BRWlabkpoYldWSmJsQnliMmR5WlhOelZtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnUC9BUnRuWVcxbFltOTVRMjlzYjNKUVlXeGxkSFJsVEc5allYUnBiMjREL1FFWFoyRnRaV0p2ZVVOdmJHOXlVR0ZzWlhSMFpWTnBlbVVEL2dFVlltRmphMmR5YjNWdVpFMWhjRXh2WTJGMGFXOXVBNEFDQzNScGJHVkVZWFJoVFdGd0E0RUNFM052ZFc1a1QzVjBjSFYwVEc5allYUnBiMjREZ2dJUloyRnRaVUo1ZEdWelRHOWpZWFJwYjI0RGhBSVVaMkZ0WlZKaGJVSmhibXR6VEc5allYUnBiMjREZ3dJSUFyRUNDdGpNQWJZQ0t3RUNmeU10SVFFakxrVWlBZ1JBSUFGRklRSUxJQUlFUUVFQklRRUxJQUZCRG5RZ0FFR0FnQUZyYWdzUEFDTXhRUTEwSUFCQmdNQUNhMm9MdHdFQkFuOENRQUpBQWtBQ1FBSkFBa0FDUUNBQVFReDFJZ0loQVNBQ1JRMEFBa0FnQVVFQmF3NE5BUUVCQWdJQ0FnTURCQVFGQmdBTERBWUxJQUJCZ1BnemFnOExJQUFRQUVHQStETnFEd3RCQUNFQkl5OEVRQ013RUFOQkFYRWhBUXNnQUVHQWtINXFJQUZCRFhScUR3c2dBQkFCUVlENEsyb1BDeUFBUVlDUWZtb1BDMEVBSVFFakx3UkFJeklRQTBFSGNTRUJDeUFCUVFGSUJFQkJBU0VCQ3lBQUlBRkJESFJxUVlEd2ZXb1BDeUFBUVlCUWFnc0pBQ0FBRUFJdEFBQUxtUUVBUVFBa00wRUFKRFJCQUNRMVFRQWtOa0VBSkRkQkFDUTRRUUFrT1VFQUpEcEJBQ1E3UVFBa1BFRUFKRDFCQUNRK1FRQWtQMEVBSkVCQkFDUkJRUUFrUWlNdkJFQkJFU1EwUVlBQkpEdEJBQ1ExUVFBa05rSC9BU1EzUWRZQUpEaEJBQ1E1UVEwa09nVkJBU1EwUWJBQkpEdEJBQ1ExUVJNa05rRUFKRGRCMkFFa09FRUJKRGxCelFBa09ndEJnQUlrUFVIKy93TWtQQXVrQVFFQ2YwRUFKRU5CQVNSRVFjY0NFQU1oQVVFQUpFVkJBQ1JHUVFBa1IwRUFKRWhCQUNRdUlBRUVRQ0FCUVFGT0lnQUVRQ0FCUVFOTUlRQUxJQUFFUUVFQkpFWUZJQUZCQlU0aUFBUkFJQUZCQmt3aEFBc2dBQVJBUVFFa1J3VWdBVUVQVGlJQUJFQWdBVUVUVENFQUN5QUFCRUJCQVNSSUJTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQUVRRUVCSkM0TEN3c0xCVUVCSkVVTFFRRWtMVUVBSkRFTEN3QWdBQkFDSUFFNkFBQUxMd0JCMGY0RFFmOEJFQVpCMHY0RFFmOEJFQVpCMC80RFFmOEJFQVpCMVA0RFFmOEJFQVpCMWY0RFFmOEJFQVlMbUFFQVFRQWtTVUVBSkVwQkFDUkxRUUFrVEVFQUpFMUJBQ1JPUVFBa1R5TXZCRUJCa0FFa1MwSEEvZ05Ca1FFUUJrSEIvZ05CZ1FFUUJrSEUvZ05Ca0FFUUJrSEgvZ05CL0FFUUJnVkJrQUVrUzBIQS9nTkJrUUVRQmtIQi9nTkJoUUVRQmtIRy9nTkIvd0VRQmtISC9nTkIvQUVRQmtISS9nTkIvd0VRQmtISi9nTkIvd0VRQmd0QnovNERRUUFRQmtIdy9nTkJBUkFHQzA4QUl5OEVRRUhvL2dOQndBRVFCa0hwL2dOQi93RVFCa0hxL2dOQndRRVFCa0hyL2dOQkRSQUdCVUhvL2dOQi93RVFCa0hwL2dOQi93RVFCa0hxL2dOQi93RVFCa0hyL2dOQi93RVFCZ3NMTHdCQmtQNERRWUFCRUFaQmtmNERRYjhCRUFaQmt2NERRZk1CRUFaQmsvNERRY0VCRUFaQmxQNERRYjhCRUFZTExBQkJsZjREUWY4QkVBWkJsdjREUVQ4UUJrR1gvZ05CQUJBR1FaaitBMEVBRUFaQm1mNERRYmdCRUFZTE1nQkJtdjREUWY4QUVBWkJtLzREUWY4QkVBWkJuUDREUVo4QkVBWkJuZjREUVFBUUJrR2UvZ05CdUFFUUJrRUJKR0FMTFFCQm4vNERRZjhCRUFaQm9QNERRZjhCRUFaQm9mNERRUUFRQmtHaS9nTkJBQkFHUWFQK0EwRy9BUkFHQ3pnQVFROGtZVUVQSkdKQkR5UmpRUThrWkVFQUpHVkJBQ1JtUVFBa1owRUFKR2hCL3dBa2FVSC9BQ1JxUVFFa2EwRUJKR3hCQUNSdEMyY0FRUUFrVUVFQUpGRkJBQ1JTUVFFa1UwRUJKRlJCQVNSVlFRRWtWa0VCSkZkQkFTUllRUUVrV1VFQkpGcEJBU1JiUVFBa1hFRUFKRjFCQUNSZVFRQWtYeEFLRUFzUURCQU5RYVQrQTBIM0FCQUdRYVgrQTBIekFSQUdRYWIrQTBIeEFSQUdFQTRMRFFBZ0FVRUJJQUIwY1VFQVJ3c21BRUVBSUFBUUVDUnVRUUVnQUJBUUpHOUJBaUFBRUJBa2NFRUVJQUFRRUNSeElBQWtjZ3NtQUVFQUlBQVFFQ1J6UVFFZ0FCQVFKSFJCQWlBQUVCQWtkVUVFSUFBUUVDUjJJQUFrZHdzYkFFRUFFQkZCLy84REkzSVFCa0hoQVJBU1FZLytBeU4zRUFZTFVnQkJBQ1I0UVFBa2VVRUFKSHBCQUNSN1FRQWtmRUVBSkgxQkFDUitRUUFrZnlNdkJFQkJoUDREUVI0UUJrR2dQU1I1QlVHRS9nTkJxd0VRQmtITTF3SWtlUXRCaC80RFFmZ0JFQVpCK0FFa2ZRc0pBQ0FBUVFGeEpDTUxGUUJCZ0tqV3VRY2tnQUZCQUNTQkFVRUFKSUlCQ3hVQVFZQ28xcmtISklNQlFRQWtoQUZCQUNTRkFRdlBBUUVDZjBIREFoQURJZ0ZCd0FGR0lnQkZCRUFqSlFSL0lBRkJnQUZHQlNNbEN5RUFDeUFBQkVCQkFTUXZCVUVBSkM4TEVBUVFCUkFIRUFnUUNSQVBFQk1RRkNNdkJFQkI4UDREUWZnQkVBWkJ6LzREUWY0QkVBWkJ6ZjREUWY0QUVBWkJnUDREUWM4QkVBWkJndjREUWZ3QUVBWkJqLzREUWVFQkVBWkI3UDREUWY0QkVBWkI5ZjREUVk4QkVBWUZRZkQrQTBIL0FSQUdRYy8rQTBIL0FSQUdRYzMrQTBIL0FSQUdRWUQrQTBIUEFSQUdRWUwrQTBIK0FCQUdRWS8rQTBIaEFSQUdDMEVBRUJVUUZoQVhDNTBCQUNBQVFRQktCRUJCQVNRa0JVRUFKQ1FMSUFGQkFFb0VRRUVCSkNVRlFRQWtKUXNnQWtFQVNnUkFRUUVrSmdWQkFDUW1DeUFEUVFCS0JFQkJBU1FuQlVFQUpDY0xJQVJCQUVvRVFFRUJKQ2dGUVFBa0tBc2dCVUVBU2dSQVFRRWtLUVZCQUNRcEN5QUdRUUJLQkVCQkFTUXFCVUVBSkNvTElBZEJBRW9FUUVFQkpDc0ZRUUFrS3dzZ0NFRUFTZ1JBUVFFa0xBVkJBQ1FzQ3hBWUN3d0FJeU1FUUVFQkR3dEJBQXNPQUNBQVFZQUlhaUFCUVRKc2Fnc1pBQ0FCUVFGeEJFQWdBRUVCT2dBQUJTQUFRUUE2QUFBTEM2TUJBRUVBUVFBUUd5TTBPZ0FBUVFGQkFCQWJJelU2QUFCQkFrRUFFQnNqTmpvQUFFRURRUUFRR3lNM09nQUFRUVJCQUJBYkl6ZzZBQUJCQlVFQUVCc2pPVG9BQUVFR1FRQVFHeU02T2dBQVFRZEJBQkFiSXpzNkFBQkJDRUVBRUJzalBEc0JBRUVLUVFBUUd5TTlPd0VBUVF4QkFCQWJJejQyQWdCQkVVRUFFQnNqUHhBY1FSSkJBQkFiSTBBUUhFRVRRUUFRR3lOQkVCeEJGRUVBRUJzalFoQWNDeUVBUVFCQkFSQWJJMG8yQWdCQkJFRUJFQnNqaGdFNkFBQkJ4UDRESTBzUUJnc1lBRUVBUVFJUUd5T0hBUkFjUVFGQkFoQWJJNGdCRUJ3TEF3QUJDMTRBUVFCQkJCQWJJeTA3QVFCQkFrRUVFQnNqTVRzQkFFRUVRUVFRR3lOREVCeEJCVUVFRUJzalJCQWNRUVpCQkJBYkkwVVFIRUVIUVFRUUd5TkdFQnhCQ0VFRUVCc2pSeEFjUVFsQkJCQWJJMGdRSEVFS1FRUVFHeU11RUJ3TE5BQkJBRUVGRUJzamVEWUNBRUVFUVFVUUd5TjVOZ0lBUVFoQkJSQWJJMzRRSEVFTFFRVVFHeU4vRUJ4QmhmNERJM29RQmdzakFFRUFRUVlRR3lOY05nSUFRUVJCQmhBYkkxMDZBQUJCQlVFR0VCc2pYam9BQUF0NEFFRUFRUWNRR3lPSkFSQWNRUUZCQnhBYkk0b0JOZ0lBUVFWQkJ4QWJJNHNCTmdJQVFRbEJCeEFiSTR3Qk5nSUFRUTVCQnhBYkk0MEJOZ0lBUVJOQkJ4QWJJNDRCT2dBQVFSUkJCeEFiSTQ4Qk9nQUFRUmxCQnhBYkk1QUJFQnhCR2tFSEVCc2prUUUyQWdCQkgwRUhFQnNqa2dFN0FRQUxWUUJCQUVFSUVCc2prd0VRSEVFQlFRZ1FHeU9VQVRZQ0FFRUZRUWdRR3lPVkFUWUNBRUVKUVFnUUd5T1dBVFlDQUVFT1FRZ1FHeU9YQVRZQ0FFRVRRUWdRR3lPWUFUb0FBRUVVUVFnUUd5T1pBVG9BQUFzeEFFRUFRUWtRR3lPYUFSQWNRUUZCQ1JBYkk1c0JOZ0lBUVFWQkNSQWJJNXdCTmdJQVFRbEJDUkFiSTUwQk93RUFDMGtBUVFCQkNoQWJJNTRCRUJ4QkFVRUtFQnNqbndFMkFnQkJCVUVLRUJzam9BRTJBZ0JCQ1VFS0VCc2pvUUUyQWdCQkRrRUtFQnNqb2dFMkFnQkJFMEVLRUJzam93RTdBUUFMSEFBUUhSQWVFQjhRSUJBaEVDSVFJeEFrRUNVUUpoQW5RUUFRRlFzU0FDQUFMUUFBUVFCS0JFQkJBUThMUVFBTG93RUFRUUJCQUJBYkxRQUFKRFJCQVVFQUVCc3RBQUFrTlVFQ1FRQVFHeTBBQUNRMlFRTkJBQkFiTFFBQUpEZEJCRUVBRUJzdEFBQWtPRUVGUVFBUUd5MEFBQ1E1UVFaQkFCQWJMUUFBSkRwQkIwRUFFQnN0QUFBa08wRUlRUUFRR3k4QkFDUThRUXBCQUJBYkx3RUFKRDFCREVFQUVCc29BZ0FrUGtFUlFRQVFHeEFwSkQ5QkVrRUFFQnNRS1NSQVFSTkJBQkFiRUNra1FVRVVRUUFRR3hBcEpFSUxTZ0JCQnlBQUVCQWtwQUZCQmlBQUVCQWtwUUZCQlNBQUVCQWtwZ0ZCQkNBQUVCQWtwd0ZCQXlBQUVCQWtxQUZCQWlBQUVCQWtxUUZCQVNBQUVCQWtxZ0ZCQUNBQUVCQWtxd0VMS1FCQkFFRUJFQnNvQWdBa1NrRUVRUUVRR3kwQUFDU0dBVUhFL2dNUUF5UkxRY0QrQXhBREVDc0xLQUJCQUVFQ0VCc1FLU1NIQVVFQlFRSVFHeEFwSklnQlFmLy9BeEFERUJGQmovNERFQU1RRWdzZkFDQUFRZjhCY3lTc0FVRUVJNndCRUJBa3JRRkJCU09zQVJBUUpLNEJDd29BUVlEK0F4QURFQzRMWGdCQkFFRUVFQnN2QVFBa0xVRUNRUVFRR3k4QkFDUXhRUVJCQkJBYkVDa2tRMEVGUVFRUUd4QXBKRVJCQmtFRUVCc1FLU1JGUVFkQkJCQWJFQ2trUmtFSVFRUVFHeEFwSkVkQkNVRUVFQnNRS1NSSVFRcEJCQkFiRUNra0xndEVBRUVBUVFVUUd5Z0NBQ1I0UVFSQkJSQWJLQUlBSkhsQkNFRUZFQnNRS1NSK1FRdEJCUkFiRUNra2YwR0YvZ01RQXlSNlFZYitBeEFESkh0QmgvNERFQU1rZlFzR0FFRUFKRjhMSlFCQkFFRUdFQnNvQWdBa1hFRUVRUVlRR3kwQUFDUmRRUVZCQmhBYkxRQUFKRjRRTWd0NEFFRUFRUWNRR3hBcEpJa0JRUUZCQnhBYktBSUFKSW9CUVFWQkJ4QWJLQUlBSklzQlFRbEJCeEFiS0FJQUpJd0JRUTVCQnhBYktBSUFKSTBCUVJOQkJ4QWJMUUFBSkk0QlFSUkJCeEFiTFFBQUpJOEJRUmxCQnhBYkVDa2trQUZCR2tFSEVCc29BZ0Fra1FGQkgwRUhFQnN2QVFBa2tnRUxWUUJCQUVFSUVCc1FLU1NUQVVFQlFRZ1FHeWdDQUNTVUFVRUZRUWdRR3lnQ0FDU1ZBVUVKUVFnUUd5Z0NBQ1NXQVVFT1FRZ1FHeWdDQUNTWEFVRVRRUWdRR3kwQUFDU1lBVUVVUVFnUUd5MEFBQ1NaQVFzeEFFRUFRUWtRR3hBcEpKb0JRUUZCQ1JBYktBSUFKSnNCUVFWQkNSQWJLQUlBSkp3QlFRbEJDUkFiTHdFQUpKMEJDMGtBUVFCQkNoQWJFQ2trbmdGQkFVRUtFQnNvQWdBa253RkJCVUVLRUJzb0FnQWtvQUZCQ1VFS0VCc29BZ0Frb1FGQkRrRUtFQnNvQWdBa29nRkJFMEVLRUJzdkFRQWtvd0VMSUFBUUtoQXNFQzBRTHhBd0VERVFNeEEwRURVUU5oQTNRUUFRRlJBV0VCY0xCUUFqZ3dFTEJRQWpoQUVMQlFBamhRRUxDUUFnQUVILy93TnhDeVlBSXpNRVFDTkxRWmtCUmdSQVFRZ1BDMEdRQnc4TEkwdEJtUUZHQkVCQkJBOExRY2dEQ3dRQUVEMExGUUFnQUVHQWtINXFJQUZCQVhGQkRYUnFMUUFBQ3c0QUlBRkJvQUZzSUFCcVFRTnNDeFVBSUFBZ0FSQkFRWURZQldvZ0Ftb2dBem9BQUFzTEFDQUJRYUFCYkNBQWFnc1FBQ0FBSUFFUVFrR0FvQVJxTFFBQUN3MEFJQUZCQVNBQWRFRi9jM0VMQ2dBZ0FVRUJJQUIwY2dzckFRRi9JQUpCQTNFaEJDQURRUUZ4QkVCQkFpQUVFRVVoQkFzZ0FDQUJFRUpCZ0tBRWFpQUVPZ0FBQzY0Q0FRTi9JQUZCQUVvaUF3UkFJQUJCQ0VvaEF3c2dBd1JBSUFZanNBRkdJUU1MSUFNRVFDQUFJN0VCUmlFREN5QURCRUJCQUNFRFFRQWhCa0VGSUFSQkFXc1FBeEFRQkVCQkFTRURDMEVGSUFRUUF4QVFCRUJCQVNFR0N3SkFRUUFoQkFOQUlBUkJDRTROQVNBRElBWkhCRUJCQnlBRWF5RUVDeUFBSUFScVFhQUJUQVJBSUFCQkNDQUVhMnNoQ0NBQUlBUnFJQUVRUUVHQTJBVnFJUWtDUUVFQUlRVURRQ0FGUVFOT0RRRWdBQ0FFYWlBQklBVWdDU0FGYWkwQUFCQkJJQVZCQVdvaEJRd0FBQXNBQ3lBQUlBUnFJQUZCQWlBSUlBRVFReUlGRUVSQkFpQUZFQkFRUmlBSFFRRnFJUWNMSUFSQkFXb2hCQXdBQUFzQUN3VWdCaVN3QVFzZ0FDT3hBVTRFUUNBQVFRaHFKTEVCSUFBZ0FrRUlieUlHU0FSQUk3RUJJQVpxSkxFQkN3c2dCd3M0QVFGL0lBQkJnSkFDUmdSQUlBRkJnQUZxSVFKQkJ5QUJFQkFFUUNBQlFZQUJheUVDQ3lBQUlBSkJCSFJxRHdzZ0FDQUJRUVIwYWdza0FRRi9JQUJCUDNFaEFpQUJRUUZ4QkVBZ0FrRkFheUVDQ3lBQ1FZQ1FCR290QUFBTEVnQWdBRUgvQVhGQkNIUWdBVUgvQVhGeUN5QUJBWDhnQUVFRGRDQUJRUUYwYWlJRFFRRnFJQUlRU1NBRElBSVFTUkJLQ3hVQUlBRkJIeUFBUVFWc0lnQjBjU0FBZFVFRGRBdFpBQ0FDUVFGeFJRUkFJQUVRQXlBQVFRRjBkVUVEY1NFQUMwSHlBU0VCQWtBQ1FBSkFBa0FDUUNBQVJRMEVBa0FnQUVFQmF3NERBZ01FQUFzTUJBQUxBQXRCb0FFaEFRd0NDMEhZQUNFQkRBRUxRUWdoQVFzZ0FRc05BQ0FCSUFKc0lBQnFRUU5zQzZzQ0FRWi9JQUVnQUJCSUlBVkJBWFJxSWdBZ0FoQS9JUkVnQUVFQmFpQUNFRDhoRWdKQUlBTWhBQU5BSUFBZ0JFb05BU0FHSUFBZ0EydHFJZzRnQ0VnRVFDQUFJUUVnREVFQVNDSUNSUVJBUVFVZ0RCQVFSU0VDQ3lBQ0JFQkJCeUFCYXlFQkMwRUFJUUlnQVNBU0VCQUVRRUVDSVFJTElBRWdFUkFRQkVBZ0FrRUJhaUVDQ3lBTVFRQk9CSDlCQUNBTVFRZHhJQUpCQUJCTElnVVFUQ0VQUVFFZ0JSQk1JUUZCQWlBRkVFd0ZJQXRCQUV3RVFFSEgvZ01oQ3dzZ0FpQUxJQW9RVFNJRklROGdCU0lCQ3lFRklBa2dEaUFISUFnUVRtb2lFQ0FQT2dBQUlCQkJBV29nQVRvQUFDQVFRUUpxSUFVNkFBQkJBQ0VCSUF4QkFFNEVRRUVISUF3UUVDRUJDeUFPSUFjZ0FpQUJFRVlnRFVFQmFpRU5DeUFBUVFGcUlRQU1BQUFMQUFzZ0RRdUZBUUVEZnlBRFFRaHZJUU1nQUVVRVFDQUNJQUpCQ0cxQkEzUnJJUWNMUVFjaENDQUFRUWhxUWFBQlNnUkFRYUFCSUFCcklRZ0xRWDhoQWlNdkJFQkJBeUFFUVFFUVB5SUNRZjhCY1JBUUJFQkJBU0VKQzBFR0lBSVFFQVJBUVFjZ0Eyc2hBd3NMSUFZZ0JTQUpJQWNnQ0NBRElBQWdBVUdnQVVHQTJBVkJBRUVBSUFJUVR3dmRBUUFnQlNBR0VFZ2hCaUFFUVFFUVB5RUVJQU5CQ0c4aEEwRUdJQVFRRUFSQVFRY2dBMnNoQXd0QkFDRUZRUU1nQkJBUUJFQkJBU0VGQ3lBR0lBTkJBWFJxSWdNZ0JSQS9JUVlnQTBFQmFpQUZFRDhoQlNBQ1FRaHZJUU5CQlNBRUVCQkZCRUJCQnlBRGF5RURDMEVBSVFJZ0F5QUZFQkFFUUVFQ0lRSUxJQU1nQmhBUUJFQWdBa0VCYWlFQ0MwRUFJQVJCQjNFZ0FrRUFFRXNpQXhCTUlRVkJBU0FERUV3aEJrRUNJQU1RVENFRElBQWdBVUVBSUFVUVFTQUFJQUZCQVNBR0VFRWdBQ0FCUVFJZ0F4QkJJQUFnQVNBQ1FRY2dCQkFRRUVZTGZ3QWdCQ0FGRUVnZ0EwRUliMEVCZEdvaUJFRUFFRDhoQlVFQUlRTWdCRUVCYWtFQUVEOGhCRUVISUFKQkNHOXJJZ0lnQkJBUUJFQkJBaUVEQ3lBQ0lBVVFFQVJBSUFOQkFXb2hBd3NnQUNBQlFRQWdBMEhIL2dOQkFCQk5JZ0lRUVNBQUlBRkJBU0FDRUVFZ0FDQUJRUUlnQWhCQklBQWdBU0FEUVFBUVJndmNBUUVHZnlBRFFRTjFJUXNDUUFOQUlBUkJvQUZPRFFFZ0JDQUZhaUlHUVlBQ1RnUkFJQVpCZ0FKcklRWUxJQUlnQzBFRmRHb2dCa0VEZFdvaUNVRUFFRDhoQjBFQUlRb2pMQVJBSUFRZ0FDQUdJQU1nQ1NBQklBY1FSeUlJUVFCS0JFQWdCQ0FJUVFGcmFpRUVRUUVoQ2dzTEl5c0VmeUFLUlFVakt3c2lDQVJBSUFRZ0FDQUdJQU1nQ1NBQklBY1FVQ0lJUVFCS0JFQWdCQ0FJUVFGcmFpRUVDd1VnQ2tVRVFDTXZCRUFnQkNBQUlBWWdBeUFKSUFFZ0J4QlJCU0FFSUFBZ0JpQURJQUVnQnhCU0N3c0xJQVJCQVdvaEJBd0FBQXNBQ3dzc0FRSi9JMHdoQkNBQUkwMXFJZ05CZ0FKT0JFQWdBMEdBQW1zaEF3c2dBQ0FCSUFJZ0EwRUFJQVFRVXdzd0FRTi9JMDRoQXlBQUkwOGlCRWdFUUE4TElBTkJCMnNpQTBGL2JDRUZJQUFnQVNBQ0lBQWdCR3NnQXlBRkVGTUxoZ1VCRUg4Q1FFRW5JUWtEUUNBSlFRQklEUUVnQ1VFQ2RDSURRWUQ4QTJvUUF5RUNJQU5CZ2Z3RGFoQURJUXNnQTBHQy9BTnFFQU1oQkNBQ1FSQnJJUUlnQzBFSWF5RUxRUWdoQlNBQlFRRnhCRUJCRUNFRklBUkJBbTlCQVVZRVFDQUVRUUZySVFRTEN5QUFJQUpPSWdZRVFDQUFJQUlnQldwSUlRWUxJQVlFUUVFSElBTkJnL3dEYWhBRElnWVFFQ0VNUVFZZ0JoQVFJUU5CQlNBR0VCQWhEeUFBSUFKcklRSWdBd1JBSUFJZ0JXdEJmMnhCQVdzaEFndEJnSUFDSUFRUVNDQUNRUUYwYWlFRVFRQWhBaU12Qkg5QkF5QUdFQkFGSXk4TElnTUVRRUVCSVFJTElBUWdBaEEvSVJBZ0JFRUJhaUFDRUQ4aEVRSkFRUWNoQlFOQUlBVkJBRWdOQVNBRklRSWdEd1JBSUFKQkIydEJmMndoQWd0QkFDRUlJQUlnRVJBUUJFQkJBaUVJQ3lBQ0lCQVFFQVJBSUFoQkFXb2hDQXNnQ0FSQUlBdEJCeUFGYTJvaUIwRUFUaUlDQkVBZ0IwR2dBVXdoQWdzZ0FnUkFRUUFoQWtFQUlRMUJBQ0VPSXk4RWZ5T3JBVVVGSXk4TElnUUVRRUVCSVFJTElBSkZCRUFnQnlBQUVFTWlDa0VEY1NFRElBd0VmeUFEUVFCS0JTQU1DeUlFQkVCQkFTRU5CU012Qkg5QkFpQUtFQkFGSXk4TElnUUVRQ0FEUVFCS0lRUUxJQVFFUUVFQklRNExDd3NnQWtVRVFDQU5SU0lEQkg4Z0RrVUZJQU1MSVFJTElBSUVRQ012QkVCQkFDQUdRUWR4SUFoQkFSQkxJZ01RVENFRVFRRWdBeEJNSVFKQkFpQURFRXdoQXlBSElBQkJBQ0FFRUVFZ0J5QUFRUUVnQWhCQklBY2dBRUVDSUFNUVFRVkJ5UDRESVFOQkJDQUdFQkFFUUVISi9nTWhBd3NnQnlBQVFRQWdDQ0FEUVFBUVRTSUtFRUVnQnlBQVFRRWdDaEJCSUFjZ0FFRUNJQW9RUVFzTEN3c2dCVUVCYXlFRkRBQUFDd0FMQ3lBSlFRRnJJUWtNQUFBTEFBc0xiUUVDZjBHQWtBSWhBaU9uQVFSQVFZQ0FBaUVDQ3lNdkJIOGpMd1VqcXdFTElnRUVRRUdBc0FJaEFTT29BUVJBUVlDNEFpRUJDeUFBSUFJZ0FSQlVDeU9tQVFSQVFZQ3dBaUVCSTZVQkJFQkJnTGdDSVFFTElBQWdBaUFCRUZVTEk2b0JCRUFnQUNPcEFSQldDd3NsQVFGL0FrQURRQ0FBUVpBQlN3MEJJQUJCL3dGeEVGY2dBRUVCYWlFQURBQUFDd0FMQzBvQkFuOENRQU5BSUFCQmtBRk9EUUVDUUVFQUlRRURRQ0FCUWFBQlRnMEJJQUVnQUJCQ1FZQ2dCR3BCQURvQUFDQUJRUUZxSVFFTUFBQUxBQXNnQUVFQmFpRUFEQUFBQ3dBTEN3d0FRWDhrc0FGQmZ5U3hBUXNPQUNNekJFQkI4QVVQQzBINEFnc09BQ016QkVCQjhnTVBDMEg1QVFzYUFRRi9JQUJCai80REVBTVFSU0lCSkhkQmovNERJQUVRQmdzS0FFRUJKSFJCQVJCZEN3NEFJek1FUUVHdUFROExRZGNBQ3hBQUl6TUVRRUdBZ0FFUEMwR0F3QUFMTGdFQmZ5T01BVUVBU2lJQUJFQWp0Z0VoQUFzZ0FBUkFJNHdCUVFGckpJd0JDeU9NQVVVRVFFRUFKSWtCQ3dzdUFRRi9JNVlCUVFCS0lnQUVRQ08zQVNFQUN5QUFCRUFqbGdGQkFXc2tsZ0VMSTVZQlJRUkFRUUFra3dFTEN5NEJBWDhqbkFGQkFFb2lBQVJBSTdnQklRQUxJQUFFUUNPY0FVRUJheVNjQVFzam5BRkZCRUJCQUNTYUFRc0xMZ0VCZnlPaEFVRUFTaUlBQkVBanVRRWhBQXNnQUFSQUk2RUJRUUZySktFQkN5T2hBVVVFUUVFQUpKNEJDd3NpQVFGL0k1SUJJN3NCZFNFQUk3d0JCSDhqa2dFZ0FHc0ZJNUlCSUFCcUN5SUFDMFVCQW45QmxQNERFQU5CK0FGeElRRkJrLzRESUFCQi93RnhJZ0lRQmtHVS9nTWdBU0FBUVFoMUlnQnlFQVlnQWlTOUFTQUFKTDRCSTc0QlFRaDBJNzBCY2lTL0FRczVBUUovRUdVaUFFSC9EMHdpQVFSQUk3c0JRUUJLSVFFTElBRUVRQ0FBSkpJQklBQVFaaEJsSVFBTElBQkIvdzlLQkVCQkFDU0pBUXNMTHdBamtRRkJBV3Nra1FFamtRRkJBRXdFUUNPNkFTU1JBU09RQVFSL0k3b0JRUUJLQlNPUUFRc0VRQkJuQ3dzTFlBRUJmeU9MQVVFQmF5U0xBU09MQVVFQVRBUkFJOEFCSklzQkk0c0JCRUFqd1FFRWZ5T05BVUVQU0FVandRRUxJZ0FFUUNPTkFVRUJhaVNOQVFVandRRkZJZ0FFUUNPTkFVRUFTaUVBQ3lBQUJFQWpqUUZCQVdza2pRRUxDd3NMQzJBQkFYOGpsUUZCQVdza2xRRWpsUUZCQUV3RVFDUENBU1NWQVNPVkFRUkFJOE1CQkg4amx3RkJEMGdGSThNQkN5SUFCRUFqbHdGQkFXb2tsd0VGSThNQlJTSUFCRUFqbHdGQkFFb2hBQXNnQUFSQUk1Y0JRUUZySkpjQkN3c0xDd3RnQVFGL0k2QUJRUUZySktBQkk2QUJRUUJNQkVBanhBRWtvQUVqb0FFRVFDUEZBUVIvSTZJQlFROUlCU1BGQVFzaUFBUkFJNklCUVFGcUpLSUJCU1BGQVVVaUFBUkFJNklCUVFCS0lRQUxJQUFFUUNPaUFVRUJheVNpQVFzTEN3c0xqUUVCQVg4alhDQUFhaVJjSTF3UVlFNEVRQ05jRUdCckpGd0NRQUpBQWtBQ1FBSkFJMTRpQVFSQUFrQWdBVUVDYXc0R0FnQURBQVFGQUFzTUJRc1FZUkJpRUdNUVpBd0VDeEJoRUdJUVl4QmtFR2dNQXdzUVlSQmlFR01RWkF3Q0N4QmhFR0lRWXhCa0VHZ01BUXNRYVJCcUVHc0xJMTVCQVdva1hpTmVRUWhPQkVCQkFDUmVDMEVCRHd0QkFBc2RBQ1BHQVNBQWFpVEdBU09LQVNQR0FXdEJBRW9FUUVFQUR3dEJBUXVEQVFFQmZ3SkFBa0FDUUFKQUlBQkJBVWNFUUNBQUlnRkJBa1lOQVNBQlFRTkdEUUlnQVVFRVJnMEREQVFMSTJVanh3RkhCRUFqeHdFa1pVRUJEd3RCQUE4TEkyWWp5QUZIQkVBanlBRWtaa0VCRHd0QkFBOExJMmNqeVFGSEJFQWp5UUVrWjBFQkR3dEJBQThMSTJnanlnRkhCRUFqeWdFa2FFRUJEd3RCQUE4TFFRQUxIUUFqeXdFZ0FHb2t5d0VqbEFFanl3RnJRUUJLQkVCQkFBOExRUUVMS1FBanpBRWdBR29rekFFam13RWp6QUZyUVFCS0lnQUVRQ05nUlNFQUN5QUFCRUJCQUE4TFFRRUxIUUFqelFFZ0FHb2t6UUVqbndFanpRRnJRUUJLQkVCQkFBOExRUUVMSFFCQmdCQWp2d0ZyUVFKMEpJb0JJek1FUUNPS0FVRUJkQ1NLQVFzTFJRRUJmd0pBQWtBQ1FDQUFRUUZIQkVBZ0FDSUNRUUpHRFFFZ0FrRURSZzBDREFNTElBRkJnUUVRRUE4TElBRkJod0VRRUE4TElBRkIvZ0FRRUE4TElBRkJBUkFRQzM4QkFYOGppZ0VnQUdza2lnRWppZ0ZCQUV3RVFDT0tBU0VBRUhJamlnRWdBRUVBSUFCcklBQkJBRW9iYXlTS0FTT1BBVUVCYWlTUEFTT1BBVUVJVGdSQVFRQWtqd0VMQ3lPSkFRUi9JOGNCQlNPSkFRc2lBQVIvSTQwQkJVRVBEd3NoQUVFQklRRWp6Z0VqandFUWMwVUVRRUYvSVFFTElBRWdBR3hCRDJvTEVnRUJmeVBHQVNFQVFRQWt4Z0VnQUJCMEN4MEFRWUFRSTg4QmEwRUNkQ1NVQVNNekJFQWpsQUZCQVhRa2xBRUxDMzhCQVg4amxBRWdBR3NrbEFFamxBRkJBRXdFUUNPVUFTRUFFSFlqbEFFZ0FFRUFJQUJySUFCQkFFb2JheVNVQVNPWkFVRUJhaVNaQVNPWkFVRUlUZ1JBUVFBa21RRUxDeU9UQVFSL0k4Z0JCU09UQVFzaUFBUi9JNWNCQlVFUER3c2hBRUVCSVFFajBBRWptUUVRYzBVRVFFRi9JUUVMSUFFZ0FHeEJEMm9MRWdFQmZ5UExBU0VBUVFBa3l3RWdBQkIzQ3gwQVFZQVFJOUVCYTBFQmRDU2JBU016QkVBam13RkJBWFFrbXdFTEN3UUFJQUFMaUFJQkFuOGptd0VnQUdza213RWptd0ZCQUV3RVFDT2JBU0VDRUhram13RWdBa0VBSUFKcklBSkJBRW9iYXlTYkFTT2RBVUVCYWlTZEFTT2RBVUVnVGdSQVFRQWtuUUVMQzBFQUlRSWowZ0VoQUNPYUFRUi9JOGtCQlNPYUFRc2lBUVJBSTJBRVFFR2MvZ01RQTBFRmRVRVBjU0lBSk5JQlFRQWtZQXNGUVE4UEN5T2RBVUVDYlJCNlFiRCtBMm9RQXlFQkk1MEJRUUp2Qkg4Z0FVRVBjUVVnQVVFRWRVRVBjUXNoQVFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFZ0FFRUNSZzBDREFNTElBRkJCSFVoQVF3REMwRUJJUUlNQWdzZ0FVRUJkU0VCUVFJaEFnd0JDeUFCUVFKMUlRRkJCQ0VDQ3lBQ1FRQktCSDhnQVNBQ2JRVkJBQXNpQVVFUGFnc1NBUUYvSTh3QklRQkJBQ1RNQVNBQUVIc0xHd0VCZnlQVEFTUFVBWFFoQUNNekJFQWdBRUVCZENFQUN5QUFDNjhCQVFGL0k1OEJJQUJySko4Qkk1OEJRUUJNQkVBam53RWhBQkI5Sko4Qkk1OEJJQUJCQUNBQWF5QUFRUUJLRzJza253RWpvd0ZCQVhFaEFTT2pBVUVCZFVFQmNTRUFJNk1CUVFGMUpLTUJJNk1CSUFFZ0FITWlBVUVPZEhJa293RWoxUUVFUUNPakFVRy9mM0Vrb3dFam93RWdBVUVHZEhJa293RUxDeU9lQVFSL0k4b0JCU09lQVFzaUFBUi9JNklCQlVFUER3c2hBVUVBSTZNQkVCQUVmMEYvQlVFQkN5SUFJQUZzUVE5cUN4SUJBWDhqelFFaEFFRUFKTTBCSUFBUWZnc1NBQ016QkVCQmdJQ0FCQThMUVlDQWdBSUxCUUFRZ0FFTE9nQWdBRUU4UmdSQVFmOEFEd3NnQUVFOGEwR2dqUVpzSUFGc1FRaHRFSHBCb0kwR2JSQjZRVHhxUWFDTkJteEJqUEVDRUhwdEVIb1FlZ3U2QVFFQmYwRUFKR3NqVXdSL0lBQUZRUThMSVFRalZBUi9JQVFnQVdvRklBUkJEMm9MSVFRalZRUi9JQVFnQW1vRklBUkJEMm9MSVFRalZnUi9JQVFnQTJvRklBUkJEMm9MSVFRalZ3Ui9JQUFGUVE4TElRQWpXQVIvSUFBZ0FXb0ZJQUJCRDJvTElRQWpXUVIvSUFBZ0Ftb0ZJQUJCRDJvTElRQWpXZ1IvSUFBZ0Eyb0ZJQUJCRDJvTElRQkJBQ1JzUVFBa2JTQUVJMUZCQVdvUWdnRWhBU0FBSTFKQkFXb1FnZ0VoQUNBQkpHa2dBQ1JxSUFFZ0FCQktDeVVCQVg4Z0FrRUJkRUdBK0NOcUlnTWdBRUVCYWpvQUFDQURRUUZxSUFGQkFXbzZBQUFMbWdJQkJIOGdBQkJ0SWdGRkJFQkJBUkJ1SVFFTElBQVFieUlDUlFSQVFRSVFiaUVDQ3lBQUVIQWlBMFVFUUVFREVHNGhBd3NnQUJCeElnUkZCRUJCQkJCdUlRUUxJQUZCQVhFRVFCQjFKR0VMSUFKQkFYRUVRQkI0SkdJTElBTkJBWEVFUUJCOEpHTUxJQVJCQVhFRVFCQi9KR1FMSUFGQkFYRkZCRUFnQWlFQkN5QUJRUUZ4UlFSQUlBTWhBUXNnQVVFQmNVVUVRQ0FFSVFFTElBRkJBWEVFUUVFQkpHMExJMTBnQUNQV0FXeHFKRjBqWFJDQkFVNEVRQ05kRUlFQmF5UmRJMjBFZnlOdEJTTnJDeUlCUlFSQUkyd2hBUXNnQVFSQUkyRWpZaU5qSTJRUWd3RWFDeU5wUVFGcUkycEJBV29qWHhDRUFTTmZRUUZxSkY4ajF3RkJBbTBRZWtFQmF5RUJJMThnQVU0RVFDTmZRUUZySkY4TEN3c01BQ0FBUVlEK0EzRkJDSFVMQ0FBZ0FFSC9BWEVMa3dFQkJIOGdBQkIwRUhvaEFTQUFFSGNRZWlFQ0lBQVFleEI2SVFNZ0FCQitFSG9oQkNBQkpHRWdBaVJpSUFNa1l5QUVKR1FqWFNBQUk5WUJiR29rWFNOZEVJRUJUZ1JBSTEwUWdRRnJKRjBnQVNBQ0lBTWdCQkNEQVNJQUVJWUJRUUZxSUFBUWh3RkJBV29qWHhDRUFTTmZRUUZxSkY4ajF3RkJBbTBRZWtFQmF5RUFJMThnQUU0RVFDTmZRUUZySkY4TEN3c2xBUUYvSUFBUWJDRUJJeW9FZnlBQlJRVWpLZ3NpQVFSQUlBQVFoUUVGSUFBUWlBRUxDeVFBSTFBUVgwZ0VRQThMQTBBalVCQmZUZ1JBRUY4UWlRRWpVQkJmYXlSUURBRUxDd3R6QVFGL0lBQkJwdjREUmdSQVFhYitBeEFEUVlBQmNTRUJJNGtCQkg5QkFDQUJFRVVGUVFBZ0FSQkVDeG9qa3dFRWYwRUJJQUVRUlFWQkFTQUJFRVFMR2lPYUFRUi9RUUlnQVJCRkJVRUNJQUVRUkFzYUk1NEJCSDlCQXlBQkVFVUZRUU1nQVJCRUN4b2dBVUh3QUhJUEMwRi9DOFFCQVFGL0k2d0JJUUFqclFFRVFDUFlBUVIvUVFJZ0FCQkVCVUVDSUFBUVJRc2hBQ1BaQVFSL1FRQWdBQkJFQlVFQUlBQVFSUXNoQUNQYUFRUi9RUU1nQUJCRUJVRURJQUFRUlFzaEFDUGJBUVIvUVFFZ0FCQkVCVUVCSUFBUVJRc2hBQVVqcmdFRVFDUGNBUVIvUVFBZ0FCQkVCVUVBSUFBUVJRc2hBQ1BkQVFSL1FRRWdBQkJFQlVFQklBQVFSUXNoQUNQZUFRUi9RUUlnQUJCRUJVRUNJQUFRUlFzaEFDUGZBUVIvUVFNZ0FCQkVCVUVESUFBUVJRc2hBQXNMSUFCQjhBRnlDOVFDQVFGL0lBQkJnSUFDU0FSQVFYOFBDeUFBUVlDQUFrNGlBUVJBSUFCQmdNQUNTQ0VCQ3lBQkJFQkJmdzhMSUFCQmdNQURUaUlCQkVBZ0FFR0EvQU5JSVFFTElBRUVRQ0FBUVlCQWFoQUREd3NnQUVHQS9BTk9JZ0VFUUNBQVFaLzlBMHdoQVFzZ0FRUkFJNFlCUVFKSUJFQkIvd0VQQzBGL0R3c2dBRUhOL2dOR0JFQkIvd0VoQVVFQVFjMytBeEFERUJCRkJFQkJBRUgvQVJCRUlRRUxJek5GQkVCQkJ5QUJFRVFoQVFzZ0FROExJQUJCeFA0RFJnUkFJQUFqU3hBR0kwc1BDeUFBUVpEK0EwNGlBUVJBSUFCQnB2NERUQ0VCQ3lBQkJFQVFpZ0VnQUJDTEFROExJQUJCc1A0RFRpSUJCRUFnQUVHLy9nTk1JUUVMSUFFRVFCQ0tBVUYvRHdzZ0FFR0UvZ05HQkVBZ0FDTjVFSVlCSWdFUUJpQUJEd3NnQUVHRi9nTkdCRUFnQUNONkVBWWplZzhMSUFCQmovNERSZ1JBSTNkQjRBRnlEd3NnQUVHQS9nTkdCRUFRakFFUEMwRi9DeHdCQVg4Z0FCQ05BU0lCUVg5R0JFQWdBQkFERHdzZ0FVSC9BWEVMN1FJQkFuOGpSUVJBRHdzZ0FFSC9QMHdFUUNOSEJIOUJCQ0FCUWY4QmNSQVFSUVVqUndzaUFFVUVRQ0FCUVE5eElnSUVRQ0FDUVFwR0JFQkJBU1JEQ3dWQkFDUkRDd3NGSUFCQi8vOEFUQVJBSXk1RklnSkZCRUFnQUVILzN3Qk1JUUlMSUFJRVFDTkhCRUFnQVVFUGNTUXRDeUFCSVFJalJnUkFJQUpCSDNFaEFpTXRRZUFCY1NRdEJTTklCRUFnQWtIL0FIRWhBaU10UVlBQmNTUXRCU011QkVCQkFDUXRDd3NMSXkwZ0FuSWtMUVZCQUNFQ0l5MFFod0VoQXlBQlFRQktCRUJCQVNFQ0N5QUNJQU1RU2lRdEN3VWpSMFVpQXdSQUlBQkIvNzhCVENFREN5QURCRUFqUmdSL0kwUUZJMFlMSWdBRVFDTXRRUjl4SkMwakxTQUJRZUFCY1hJa0xROExJMGdFUUNBQlFRaE9JZ01FUUNBQlFReE1JUU1MQ3lBQklRTWpMZ1IvSUFOQkQzRUZJQU5CQTNFTElnTWtNUVVqUjBVaUF3UkFJQUJCLy84QlRDRURDeUFEQkVBalJnUkFRUUFnQVVIL0FYRVFFQVJBUVFFa1JBVkJBQ1JFQ3dzTEN3c0xDeDhBSUFCQjhBQnhRUVIxSkxvQlFRTWdBQkFRSkx3QklBQkJCM0VrdXdFTEN3QkJCeUFBRUJBa3lRRUxId0FnQUVFR2RVRURjU1RPQVNBQVFUOXhKT0FCUWNBQUkrQUJheVNNQVFzZkFDQUFRUVoxUVFOeEpOQUJJQUJCUDNFazRRRkJ3QUFqNFFGckpKWUJDeEVBSUFBazRnRkJnQUlqNGdGckpKd0JDeFFBSUFCQlAzRWs0d0ZCd0FBajR3RnJKS0VCQ3lvQUlBQkJCSFZCRDNFazVBRkJBeUFBRUJBa3dRRWdBRUVIY1NUQUFTQUFRZmdCY1VFQVNpVEhBUXNxQUNBQVFRUjFRUTl4Sk9VQlFRTWdBQkFRSk1NQklBQkJCM0Vrd2dFZ0FFSDRBWEZCQUVva3lBRUxEUUFnQUVFRmRVRVBjU1RtQVFzcUFDQUFRUVIxUVE5eEpPY0JRUU1nQUJBUUpNVUJJQUJCQjNFa3hBRWdBRUg0QVhGQkFFb2t5Z0VMRkFBZ0FDUzlBU08rQVVFSWRDTzlBWElrdndFTEZBQWdBQ1RvQVNQcEFVRUlkQ1BvQVhJa3p3RUxGQUFnQUNUcUFTUHJBVUVJZENQcUFYSWswUUVMaEFFQkFYOGdBRUVFZFNUVUFVRURJQUFRRUNUVkFTQUFRUWR4Sk93QkFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNQc0FTSUJCRUFDUUNBQlFRRnJEZ2NDQXdRRkJnY0lBQXNNQ0F0QkNDVFRBUThMUVJBazB3RVBDMEVnSk5NQkR3dEJNQ1RUQVE4TFFjQUFKTk1CRHd0QjBBQWswd0VQQzBIZ0FDVFRBUThMUWZBQUpOTUJDd3NnQUVFR0lBQVFFQ1MyQVNBQVFRZHhKTDRCSTc0QlFRaDBJNzBCY2lTL0FRdHFBUUYvUVFFa2lRRWpqQUZGQkVCQndBQWtqQUVMRUhJandBRWtpd0VqNUFFa2pRRWp2d0Vra2dFanVnRWtrUUVqdWdGQkFFb2lBQVJBSTdzQlFRQktJUUFMSUFBRVFFRUJKSkFCQlVFQUpKQUJDeU83QVVFQVNnUkFFR2NMSThjQlJRUkFRUUFraVFFTEN5QUFRUVlnQUJBUUpMY0JJQUJCQjNFazZRRWo2UUZCQ0hRajZBRnlKTThCQ3k0QVFRRWtrd0VqbGdGRkJFQkJ3QUFrbGdFTEVIWWp3Z0VrbFFFajVRRWtsd0VqeUFGRkJFQkJBQ1NUQVFzTElBQkJCaUFBRUJBa3VBRWdBRUVIY1NUckFTUHJBVUVJZENQcUFYSWswUUVMSndCQkFTU2FBU09jQVVVRVFFR0FBaVNjQVFzUWVVRUFKSjBCSThrQlJRUkFRUUFrbWdFTEN3c0FRUVlnQUJBUUpMa0JDemdBUVFFa25nRWpvUUZGQkVCQndBQWtvUUVMRUgwa253RWp4QUVrb0FFajV3RWtvZ0ZCLy84QkpLTUJJOG9CUlFSQVFRQWtuZ0VMQ3hNQUlBQkJCSFZCQjNFa1VTQUFRUWR4SkZJTFFnQkJCeUFBRUJBa1ZrRUdJQUFRRUNSVlFRVWdBQkFRSkZSQkJDQUFFQkFrVTBFRElBQVFFQ1JhUVFJZ0FCQVFKRmxCQVNBQUVCQWtXRUVBSUFBUUVDUlhDd29BUVFjZ0FCQVFKRnNMbEFNQkFYOENRQ0FBUWFiK0EwY2lBZ1JBSTF0RklRSUxJQUlFUUVFQUR3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUNRWkQrQTBjRVFBSkFJQUpCa2Y0RGF3NFdBd2NMRHdBRUNBd1FBZ1VKRFJFQUJnb09FaE1VRlFBTERCVUxJQUVRa0FFTUZRc2dBUkNSQVF3VUN5QUJFSklCREJNTElBRVFrd0VNRWdzZ0FSQ1VBUXdSQ3lBQkVKVUJEQkFMSUFFUWxnRU1Ed3NnQVJDWEFRd09DMEVCSkdBZ0FSQ1lBUXdOQ3lBQkVKa0JEQXdMSUFFUW1nRU1Dd3NnQVJDYkFRd0tDeUFCRUp3QkRBa0xJQUVRblFFTUNBdEJCeUFCRUJBRVFDQUJFSjRCRUo4QkN3d0hDMEVISUFFUUVBUkFJQUVRb0FFUW9RRUxEQVlMUVFjZ0FSQVFCRUFnQVJDaUFSQ2pBUXNNQlF0QkJ5QUJFQkFFUUNBQkVLUUJFS1VCQ3d3RUN5QUJFS1lCUVFFa2F3d0RDeUFCRUtjQlFRRWtiQXdDQ3lBQkVLZ0JRUWNnQVJBUVJRUkFBa0JCa1A0RElRSURRQ0FDUWFiK0EwNE5BU0FDUVFBUUJpQUNRUUZxSVFJTUFBQUxBQXNMREFFTFFRRVBDMEVCQ3h3QVFjSCtBMEVISUFCQitBRnhRY0grQXhBRFFRZHhjaEJGRUFZTFBnRUJmeUFBUVFoMElRRUNRRUVBSVFBRFFDQUFRWjhCU2cwQklBQkJnUHdEYWlBQklBQnFFQU1RQmlBQVFRRnFJUUFNQUFBTEFBdEJoQVVrcndFTEV3QWo3d0VRQXlQd0FSQURFRXBCOFA4RGNRc1hBQ1B4QVJBREkvSUJFQU1RU2tId1AzRkJnSUFDYWd1TEFRRURmeU12UlFSQUR3c2pzZ0VFZjBFSElBQVFFRVVGSTdJQkN5SUJCRUJCQUNTeUFTUHVBUkFESVFFajdnRkJCeUFCRUVVUUJnOExFS3dCSVFFUXJRRWhBa0VISUFBUVJFRUJha0VFZENFRFFRY2dBQkFRQkVCQkFTU3lBU0FESkxNQklBRWt0QUVnQWlTMUFTUHVBVUVISUFBUVJCQUdCU0FCSUFJZ0F4QytBU1B1QVVIL0FSQUdDd3NtQVFGL0lBQkJQM0VoQXlBQ1FRRnhCRUFnQTBGQWF5RURDeUFEUVlDUUJHb2dBVG9BQUFzWUFFRUhJQUFRRUFSQUlBRkJCeUFBUVFGcUVFVVFCZ3NMU2dFQ2Z5QUFJL1VCUmlJQ1JRUkFJQUFqOUFGR0lRSUxJQUlFUUVFR0lBQkJBV3NRQXhCRUlRSWdBQ1AwQVVZRVFFRUJJUU1MSUFJZ0FTQURFSzhCSUFJZ0FFRUJheEN3QVFzTENnQkJBU1IxUVFJUVhRczhBUUYvQWtBQ1FBSkFBa0FnQUFSQUlBQWlBVUVCUmcwQklBRkJBa1lOQWlBQlFRTkdEUU1NQkF0QkNROExRUU1QQzBFRkR3dEJCdzhMUVFBTEp3RUJmeU45RUxNQklnSWdBQkFRSWdBRVFDQUNJQUVRRUVVaEFBc2dBQVJBUVFFUEMwRUFDeG9BSTNwQkFXb2tlaU42UWY4QlNnUkFRUUVrZmtFQUpIb0xDMllCQW44RFFDQUJJQUJJQkVBamVTRUNJQUZCQkdvaEFTTjVRUVJxSkhramVVSC8vd05LQkVBamVVR0FnQVJySkhrTEkzd0VRQ04rQkVBamV5UjZFTElCUVFBa2ZrRUJKSDhGSTM4RVFFRUFKSDhMQ3lBQ0kza1F0QUVFUUJDMUFRc0xEQUVMQ3dzTEFDTjRFTFlCUVFBa2VBc3BBQ041SVFCQkFDUjVRWVQrQTBFQUVBWWpmQVIvSUFBamVSQzBBUVVqZkFzaUFBUkFFTFVCQ3dzYUFDTjhCRUFqZndSQUR3c2pmZ1JBUVFBa2Znc0xJQUFrZWdzYkFDQUFKSHNqZkFSL0kzOEZJM3dMQkVBamV5UjZRUUFrZndzTFdBRUNmeU44SVFGQkFpQUFFQkFrZkNBQVFRTnhJUUlnQVVVRVFDTjlFTE1CSVFBZ0FoQ3pBU0VCSTN3RVFDQUFJM2tRRUNFQUJTQUFJM2tRRUNJQUJFQWdBU041RUJBaEFBc0xJQUFFUUJDMUFRc0xJQUlrZlF2UkJRRUJmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERJQUZCQVhFUUJnd0NDeUFBUVlDQUFrZ0VRQ0FBSUFFUWp3RU1BZ3NnQUVHQWdBSk9JZ0lFUUNBQVFZREFBa2doQWdzZ0FnMEFJQUJCZ01BRFRpSUNCRUFnQUVHQS9BTklJUUlMSUFJRVFDQUFRWUJBYWlBQkVBWU1BUXNnQUVHQS9BTk9JZ0lFUUNBQVFaLzlBMHdoQWdzZ0FnUkFJNFlCUVFKSURRSU1BUXNnQUVHZy9RTk9JZ0lFUUNBQVFmLzlBMHdoQWdzZ0FnMEJJQUJCa1A0RFRpSUNCRUFnQUVHbS9nTk1JUUlMSUFJRVFCQ0tBU0FBSUFFUXFRRVBDeUFBUWJEK0EwNGlBZ1JBSUFCQnYvNERUQ0VDQ3lBQ0JFQVFpZ0VMSUFCQndQNERUaUlDQkVBZ0FFSEwvZ05NSVFJTElBSUVRQ0FBUWNEK0EwWUVRQ0FCRUNzTUFnc2dBRUhCL2dOR0JFQWdBUkNxQVF3REN5QUFRY1QrQTBZRVFFRUFKRXNnQUVFQUVBWU1Bd3NnQUVIRi9nTkdCRUFnQVNUdEFRd0NDeUFBUWNiK0EwWUVRQ0FCRUtzQkRBSUxBa0FDUUFKQUFrQWdBQ0lDUWNQK0EwY0VRQUpBSUFKQnd2NERhdzRLQWdBQUFBQUFBQUFFQXdBTERBUUxJQUVrVEF3RkN5QUJKRTBNQkFzZ0FTUk9EQU1MSUFFa1R3d0NDd3dCQ3lBQUkrNEJSZ1JBSUFFUXJnRU1BZ3NnQUNNeVJpSUNSUVJBSUFBak1FWWhBZ3NnQWdSQUk3SUJCRUFqdEFGQmdJQUJUaUlDQkVBanRBRkIvLzhCVENFQ0N5QUNSUVJBSTdRQlFZQ2dBMDRpQWdSQUk3UUJRZisvQTB3aEFnc0xJQUlOQXdzTElBQWo4d0ZPSWdJRVFDQUFJL1FCVENFQ0N5QUNCRUFnQUNBQkVMRUJEQUVMSUFCQmhQNERUaUlDQkVBZ0FFR0gvZ05NSVFJTElBSUVRQkMzQVFKQUFrQUNRQUpBSUFBaUFrR0UvZ05IQkVBQ1FDQUNRWVgrQTJzT0F3SURCQUFMREFRTElBRVF1QUVNQmdzZ0FSQzVBUXdFQ3lBQkVMb0JEQU1MSUFFUXV3RU1BZ3NNQVFzZ0FFR0EvZ05HQkVBZ0FSQXVDeUFBUVkvK0EwWUVRQ0FCRUJJTUFRc2dBRUgvL3dOR0JFQWdBUkFSREFFTFFRRVBDMEVCRHd0QkFBc1NBQ0FBSUFFUXZBRUVRQ0FBSUFFUUJnc0xhQUVEZndKQUEwQWdBeUFDVGcwQklBQWdBMm9RamdFaEJTQUJJQU5xSVFRRFFDQUVRZisvQWtvRVFDQUVRWUJBYWlFRURBRUxDeUFFSUFVUXZRRWdBMEVCYWlFRERBQUFDd0FMUVNBaEF5TXpCRUJCd0FBaEF3c2pyd0VnQXlBQ1FSQnRiR29rcndFTGJRRUJmeU95QVVVRVFBOExRUkFoQUNPekFVRVFTQVJBSTdNQklRQUxJN1FCSTdVQklBQVF2Z0VqdEFFZ0FHb2t0QUVqdFFFZ0FHb2t0UUVqc3dFZ0FHc2tzd0Vqc3dGQkFFd0VRRUVBSkxJQkkrNEJRZjhCRUFZRkkrNEJRUWNqc3dGQkVHMUJBV3NRUkJBR0N3c0tBRUVCSkhOQkFCQmRDOU1DQVFWL0k2UUJSUVJBUVFBa1NrRUFKRXRCeFA0RFFRQVFCa0VBUVFGQndmNERFQU1RUkJCRUlRTkJBQ1NHQVVIQi9nTWdBeEFHRHdzamhnRWhBU05MSWdOQmtBRk9CRUJCQVNFQ0JTTktFRnRPQkVCQkFpRUNCU05LRUZ4T0JFQkJBeUVDQ3dzTElBRWdBa2NFUUVIQi9nTVFBeUVBSUFJa2hnRkJBQ0VCQWtBQ1FBSkFBa0FDUUNBQ0lRUWdBa1VOQUFKQUlBUkJBV3NPQXdJREJBQUxEQVFMUVFOQkFVRUFJQUFRUkJCRUlnQVFFQ0VCREFNTFFRUkJBRUVCSUFBUVJCQkZJZ0FRRUNFQkRBSUxRUVZCQVVFQUlBQVFSQkJGSWdBUUVDRUJEQUVMUVFGQkFDQUFFRVVRUlNFQUN5QUJCRUFRWGdzZ0FrVUVRQkMvQVFzZ0FrRUJSZ1JBRU1BQkN5UHRBU0VFSUFKRklnRkZCRUFnQWtFQlJpRUJDeUFCQkVBZ0F5QUVSaUVCQ3lBQkJFQkJCa0VDSUFBUVJTSUFFQkFFUUJCZUN3VkJBaUFBRUVRaEFBdEJ3ZjRESUFBUUJnc0xiQUVCZnlPa0FRUkFJMG9nQUdva1NnTkFJMG9RUFU0RVFDTktFRDFySkVvalN5SUJRWkFCUmdSQUl5a0VRQkJZQlNBQkVGY0xFRmtRV2dVZ0FVR1FBVWdFUUNNcFJRUkFJQUVRVndzTEN5QUJRWmtCU2dSL1FRQUZJQUZCQVdvTElnRWtTd3dCQ3dzTEVNRUJDeVFBSTBrUVBrZ0VRQThMQTBBalNSQStUZ1JBRUQ0UXdnRWpTUkErYXlSSkRBRUxDd3NvQUNPQ0FTQUFhaVNDQVNPQ0FTT0FBVTRFUUNPQkFVRUJhaVNCQVNPQ0FTT0FBV3NrZ2dFTEMyWUFJNjhCUVFCS0JFQWdBQ092QVdvaEFFRUFKSzhCQ3lNK0lBQnFKRDRqUWtVRVFDTW5CRUFqU1NBQWFpUkpFTU1CQlNBQUVNSUJDeU1tQkVBalVDQUFhaVJRQlNBQUVJa0JDd3NqS0FSQUkzZ2dBR29rZUJDM0FRVWdBQkMyQVFzZ0FCREVBUXNRQUVFRUVNVUJJejFCQVdvUVBCQURDd3NBUVFRUXhRRWpQUkFEQ3hJQUVNWUJRZjhCY1JESEFVSC9BWEVRU2dzT0FFRUVFTVVCSUFBZ0FSQzlBUXN2QVFGL1FRRWdBSFFRaHdFaEFpQUJRUUJLQkVBak95QUNja0gvQVhFa093VWpPeUFDUWY4QmMzRWtPd3NqT3dzS0FFRUZJQUFReWdFYUMwNEFJQUZCQUU0RVFDQUFRUTl4SUFGQkQzRnFFSWNCUVJCeEJFQkJBUkRMQVFWQkFCRExBUXNGSUFGQkFDQUJheUFCUVFCS0cwRVBjU0FBUVE5eFN3UkFRUUVReXdFRlFRQVF5d0VMQ3dzS0FFRUhJQUFReWdFYUN3b0FRUVlnQUJES0FSb0xDZ0JCQkNBQUVNb0JHZ3NVQUNBQVFRRjBJQUJCL3dGeFFRZDJjaENIQVFzM0FRSi9JQUVRaGdFaEFpQUFRUUZxSVFNZ0FDQUJFSWNCSWdFUXZBRUVRQ0FBSUFFUUJnc2dBeUFDRUx3QkJFQWdBeUFDRUFZTEN3NEFRUWdReFFFZ0FDQUJFTkVCQzRNQkFDQUNRUUZ4QkVBZ0FFSC8vd054SWdBZ0FXb2hBaUFBSUFGeklBSnpJZ0pCRUhFRVFFRUJFTXNCQlVFQUVNc0JDeUFDUVlBQ2NRUkFRUUVRendFRlFRQVF6d0VMQlNBQUlBRnFFRHdpQWlBQVFmLy9BM0ZKQkVCQkFSRFBBUVZCQUJEUEFRc2dBQ0FCY3lBQ2MwR0FJSEVRUEFSQVFRRVF5d0VGUVFBUXl3RUxDd3NNQUVFRUVNVUJJQUFRamdFTEZBQWdBRUgvQVhGQkFYWWdBRUVIZEhJUWh3RUwwd1FCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUFrQWdBRUVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc01GQXNReUFGQi8vOERjU0lBRUlZQlFmOEJjU1ExSUFBUWh3RkIvd0Z4SkRZTUVBc2pOU00yRUVvak5CREpBUXdTQ3lNMUl6WVFTa0VCYWtILy93TnhJZ0FRaGdGQi93RnhKRFVNRFFzak5VRUJFTXdCSXpWQkFXb1Fod0VrTlNNMUJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FRd1FDeU0xUVg4UXpBRWpOVUVCYXhDSEFTUTFJelVFUUVFQUVNMEJCVUVCRU0wQkMwRUJFTTRCREE4TEVNY0JRZjhCY1NRMURBd0xJelJCZ0FGeFFZQUJSZ1JBUVFFUXp3RUZRUUFRendFTEl6UVEwQUVrTkF3TUN4RElBVUgvL3dOeEl6d1EwZ0VNQ1Fzak9TTTZFRW9pQUNNMUl6WVFTaUlCUWYvL0EzRkJBQkRUQVNBQUlBRnFFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNlFRQVF6Z0ZCQ0E4TEl6VWpOaEJLRU5RQlFmOEJjU1EwREFvTEl6VWpOaEJLUVFGckVEd2lBQkNHQVVIL0FYRWtOUXdGQ3lNMlFRRVF6QUVqTmtFQmFoQ0hBU1EySXpZRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QkRBZ0xJelpCZnhETUFTTTJRUUZyRUljQkpEWWpOZ1JBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VNQndzUXh3RkIvd0Z4SkRZTUJBc2pORUVCY1VFQVN3UkFRUUVRendFRlFRQVF6d0VMSXpRUTFRRWtOQXdFQzBGL0R3c2dBQkNIQVVIL0FYRWtOa0VJRHdzalBVRUNhaEE4SkQwTUFnc2pQVUVCYWhBOEpEME1BUXRCQUJETkFVRUFFTTRCUVFBUXl3RUxRUVFMQ2dBak8wRUVka0VCY1FzT0FDQUFRUUYwRU5jQmNoQ0hBUXNvQVFGL1FRY2dBRUVZZEVFWWRTSUJFQkFFUUVHQUFpQUFRUmgwUVJoMWEwRi9iQ0VCQ3lBQkN5TUJBWDhnQUJEWkFTRUJJejBnQVVFWWRFRVlkV29RUENROUl6MUJBV29RUENROUN4VUFJQUJCL3dGeFFRRjJFTmNCUVFkMGNoQ0hBUXVsQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFUVJ3UkFBa0FnQUVFUmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTHdSQVFRQkJ6ZjRERU5RQlFmOEJjU0lBRUJBRVFFSE4vZ05CQjBFQUlBQVFSQ0lBRUJBRWYwRUFKRE5CQnlBQUVFUUZRUUVrTTBFSElBQVFSUXNpQUJESkFVSEVBQThMQzBFQkpFSU1FUXNReUFGQi8vOERjU0lBRUlZQlFmOEJjU1EzSUFBUWh3RkIvd0Z4SkRnalBVRUNhaEE4SkQwTUVnc2pOeU00RUVvak5CREpBUXdSQ3lNM0l6Z1FTa0VCYWhBOElnQVFoZ0ZCL3dGeEpEY01EUXNqTjBFQkVNd0JJemRCQVdvUWh3RWtOeU0zQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVF3UEN5TTNRWDhRekFFak4wRUJheENIQVNRM0l6Y0VRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJEQTRMRU1jQlFmOEJjU1EzREFzTFFRQWhBQ00wUVlBQmNVR0FBVVlFUUVFQklRQUxJelFRMkFFa05Bd0xDeERIQVJEYUFVRUlEd3NqT1NNNkVFb2lBQ00zSXpnUVNpSUJRZi8vQTNGQkFCRFRBU0FBSUFGcUVEd2lBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2UVFBUXpnRkJDQThMSXpjak9CQktRZi8vQTNFUTFBRkIvd0Z4SkRRTUNRc2pOeU00RUVwQkFXc1FQQ0lBRUlZQlFmOEJjU1EzREFVTEl6aEJBUkRNQVNNNFFRRnFFSWNCSkRnak9BUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRU1Cd3NqT0VGL0VNd0JJemhCQVdzUWh3RWtPQ000QkVCQkFCRE5BUVZCQVJETkFRdEJBUkRPQVF3R0N4REhBVUgvQVhFa09Bd0RDMEVBSVFBak5FRUJjVUVCUmdSQVFRRWhBQXNqTkJEYkFTUTBEQU1MUVg4UEN5QUFFSWNCUWY4QmNTUTRRUWdQQ3lNOVFRRnFFRHdrUFF3QkN5QUFCRUJCQVJEUEFRVkJBQkRQQVF0QkFCRE5BVUVBRU00QlFRQVF5d0VMUVFRTENnQWpPMEVIZGtFQmNRc0tBQ003UVFWMlFRRnhDd29BSXp0QkJuWkJBWEVMaUFZQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVnUndSQUFrQWdBRUVoYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc1EzUUVFUUNNOVFRRnFFRHdrUFFVUXh3RVEyZ0VMUVFnUEN4RElBVUgvL3dOeElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPaU05UVFKcUVEd2tQUXdRQ3lNNUl6b1FTaUlBUWYvL0EzRWpOQkRKQVNBQVFRRnFFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNkRBOExJemtqT2hCS1FRRnFFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNlFRZ1BDeU01UVFFUXpBRWpPVUVCYWhDSEFTUTVJemtFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCREEwTEl6bEJmeERNQVNNNVFRRnJFSWNCSkRrak9RUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRU1EQXNReHdGQi93RnhKRGtNQ2dzUTNnRkJBRXNFUUVFR0lRRUxFTmNCUVFCTEJFQWdBVUhnQUhJaEFRc1Ezd0ZCQUVzRWZ5TTBJQUZyRUljQkJTTTBRUTl4UVFsTEJFQWdBVUVHY2lFQkN5TTBRWmtCU3dSQUlBRkI0QUJ5SVFFTEl6UWdBV29RaHdFTElnQUVRRUVBRU0wQkJVRUJFTTBCQ3lBQlFlQUFjUVJBUVFFUXp3RUZRUUFRendFTFFRQVF5d0VnQUNRMERBb0xFTjBCUVFCTEJFQVF4d0VRMmdFRkl6MUJBV29RUENROUMwRUlEd3NqT1NNNkVFb2lBU0FCUWYvL0EzRkJBQkRUQVNBQlFRRjBFRHdpQVJDR0FVSC9BWEVrT1NBQkVJY0JRZjhCY1NRNlFRQVF6Z0ZCQ0E4TEl6a2pPaEJLSWdGQi8vOERjUkRVQVVIL0FYRWtOQ0FCUVFGcUVEd2lBUkNHQVVIL0FYRWtPU0FCRUljQlFmOEJjU1E2REFjTEl6a2pPaEJLUVFGckVEd2lBUkNHQVVIL0FYRWtPU0FCRUljQlFmOEJjU1E2UVFnUEN5TTZRUUVRekFFak9rRUJhaENIQVNRNkl6b0VRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJEQVVMSXpwQmZ4RE1BU002UVFGckVJY0JKRG9qT2dSQVFRQVF6UUVGUVFFUXpRRUxRUUVRemdFTUJBc1F4d0ZCL3dGeEpEb01BZ3NqTkVGL2MwSC9BWEVrTkVFQkVNNEJRUUVReXdFTUFndEJmdzhMSXoxQkFXb1FQQ1E5QzBFRUMvQUVBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBQ1FDQUFRVEZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN4RFhBUVJBSXoxQkFXb1FQQ1E5QlJESEFSRGFBUXRCQ0E4TEVNZ0JRZi8vQTNFa1BDTTlRUUpxRUR3a1BRd1NDeU01SXpvUVNpSUFRZi8vQTNFak5CREpBUXdQQ3lNOFFRRnFFRHdrUEVFSUR3c2pPU002RUVvaUFFSC8vd054RU5RQklnRkJBUkRNQVNBQlFRRnFFSWNCSWdFRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QkRBNExJemtqT2hCS0lnQkIvLzhEY1JEVUFTSUJRWDhRekFFZ0FVRUJheENIQVNJQkJFQkJBQkROQVFWQkFSRE5BUXRCQVJET0FRd05DeU01SXpvUVNrSC8vd054RU1jQlFmOEJjUkRKQVF3S0MwRUFFTTRCUVFBUXl3RkJBUkRQQVF3TUN4RFhBVUVCUmdSQUVNY0JFTm9CQlNNOVFRRnFFRHdrUFF0QkNBOExJemtqT2hCS0lnRWpQRUVBRU5NQklBRWpQR29RUENJQUVJWUJRZjhCY1NRNUlBQVFod0ZCL3dGeEpEcEJBQkRPQVVFSUR3c2pPU002RUVvaUFFSC8vd054RU5RQlFmOEJjU1EwREFjTEl6eEJBV3NRUENROFFRZ1BDeU0wUVFFUXpBRWpORUVCYWhDSEFTUTBJelFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCREFjTEl6UkJmeERNQVNNMFFRRnJFSWNCSkRRak5BUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRU1CZ3NReHdGQi93RnhKRFFNQWd0QkFCRE9BVUVBRU1zQkVOY0JRUUJMQkVCQkFCRFBBUVZCQVJEUEFRc01CQXRCZnc4TEl6MUJBV29RUENROURBSUxJQUJCQVdzUVBDSUFFSVlCUWY4QmNTUTVJQUFRaHdGQi93RnhKRG9NQVFzZ0FFSC8vd054SUFFUXlRRUxRUVFMMlFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUJIQkVBZ0FDSUJRY0VBUmcwQkFrQWdBVUhDQUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc01FQXNqTmlRMURBOExJemNrTlF3T0N5TTRKRFVNRFFzak9TUTFEQXdMSXpva05Rd0xDeU01SXpvUVNoRFVBVUgvQVhFa05Rd0tDeU0wSkRVTUNRc2pOU1EyREFnTERBY0xJemNrTmd3R0N5TTRKRFlNQlFzak9TUTJEQVFMSXpva05nd0RDeU01SXpvUVNoRFVBVUgvQVhFa05nd0NDeU0wSkRZTUFRdEJmdzhMUVFRTDJRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFCSEJFQWdBQ0lCUWRFQVJnMEJBa0FnQVVIU0FHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlNRM0RCQUxJellrTnd3UEN3d09DeU00SkRjTURRc2pPU1EzREF3TEl6b2tOd3dMQ3lNNUl6b1FTaERVQVVIL0FYRWtOd3dLQ3lNMEpEY01DUXNqTlNRNERBZ0xJellrT0F3SEN5TTNKRGdNQmdzTUJRc2pPU1E0REFRTEl6b2tPQXdEQ3lNNUl6b1FTaERVQVVIL0FYRWtPQXdDQ3lNMEpEZ01BUXRCZnc4TFFRUUwyUUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUNJQlFlRUFSZzBCQWtBZ0FVSGlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5TUTVEQkFMSXpZa09Rd1BDeU0zSkRrTURnc2pPQ1E1REEwTERBd0xJem9rT1F3TEN5TTVJem9RU2hEVUFVSC9BWEVrT1F3S0N5TTBKRGtNQ1Fzak5TUTZEQWdMSXpZa09nd0hDeU0zSkRvTUJnc2pPQ1E2REFVTEl6a2tPZ3dFQ3d3REN5TTVJem9RU2hEVUFVSC9BWEVrT2d3Q0N5TTBKRG9NQVF0QmZ3OExRUVFMSWdBamh3RUVRRUVCSkQ4UEN5TnlJM2R4UVI5eFJRUkFRUUVrUUE4TFFRRWtRUXVKQWdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBRWNFUUNBQUlnRkI4UUJHRFFFQ1FDQUJRZklBYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5TTVJem9RU2lNMUVNa0JEQkFMSXprak9oQktJellReVFFTUR3c2pPU002RUVvak54REpBUXdPQ3lNNUl6b1FTaU00RU1rQkRBMExJemtqT2hCS0l6a1F5UUVNREFzak9TTTZFRW9qT2hESkFRd0xDeU95QVVVRVFCRGxBUXNNQ2dzak9TTTZFRW9qTkJESkFRd0pDeU0xSkRRTUNBc2pOaVEwREFjTEl6Y2tOQXdHQ3lNNEpEUU1CUXNqT1NRMERBUUxJem9rTkF3REN5TTVJem9RU2hEVUFVSC9BWEVrTkF3Q0N3d0JDMEYvRHd0QkJBdEtBQ0FCUVFCT0JFQWdBRUgvQVhFZ0FDQUJhaENIQVVzRVFFRUJFTThCQlVFQUVNOEJDd1VnQVVFQUlBRnJJQUZCQUVvYklBQkIvd0Z4U2dSQVFRRVF6d0VGUVFBUXp3RUxDd3MzQVFGL0l6UWdBRUgvQVhFaUFSRE1BU00wSUFFUTV3RWpOQ0FBYWhDSEFTUTBJelFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCQzJzQkFYOGpOQ0FBYWhEWEFXb1Fod0VoQVNNMElBQnpJQUZ6RUljQlFSQnhCRUJCQVJETEFRVkJBQkRMQVFzak5DQUFRZjhCY1dvUTF3RnFFRHhCZ0FKeFFRQkxCRUJCQVJEUEFRVkJBQkRQQVFzZ0FTUTBJelFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCQytJQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCZ0FGSEJFQUNRQ0FCUVlFQmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlJEb0FRd1FDeU0yRU9nQkRBOExJemNRNkFFTURnc2pPQkRvQVF3TkN5TTVFT2dCREF3TEl6b1E2QUVNQ3dzak9TTTZFRW9RMUFFUTZBRU1DZ3NqTkJEb0FRd0pDeU0xRU9rQkRBZ0xJellRNlFFTUJ3c2pOeERwQVF3R0N5TTRFT2tCREFVTEl6a1E2UUVNQkFzak9oRHBBUXdEQ3lNNUl6b1FTaERVQVJEcEFRd0NDeU0wRU9rQkRBRUxRWDhQQzBFRUN6b0JBWDhqTkNBQVFmOEJjVUYvYkNJQkVNd0JJelFnQVJEbkFTTTBJQUJyRUljQkpEUWpOQVJBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VMYXdFQmZ5TTBJQUJyRU5jQmF4Q0hBU0VCSXpRZ0FITWdBWE5CRUhFUWh3RUVRRUVCRU1zQkJVRUFFTXNCQ3lNMElBQkIvd0Z4YXhEWEFXc1FQRUdBQW5GQkFFc0VRRUVCRU04QkJVRUFFTThCQ3lBQkpEUWpOQVJBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VMNGdFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdRQVVjRVFBSkFJQUZCa1FGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU0xRU9zQkRCQUxJellRNndFTUR3c2pOeERyQVF3T0N5TTRFT3NCREEwTEl6a1E2d0VNREFzak9oRHJBUXdMQ3lNNUl6b1FTaERVQVJEckFRd0tDeU0wRU9zQkRBa0xJelVRN0FFTUNBc2pOaERzQVF3SEN5TTNFT3dCREFZTEl6Z1E3QUVNQlFzak9SRHNBUXdFQ3lNNkVPd0JEQU1MSXprak9oQktFTlFCRU93QkRBSUxJelFRN0FFTUFRdEJmdzhMUVFRTEtBQWpOQ0FBY1NRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJRUUVReXdGQkFCRFBBUXNyQUNNMElBQnpFSWNCSkRRak5BUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVVFQUVNOEJDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJvQUZIQkVBQ1FDQUJRYUVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkR1QVF3UUN5TTJFTzRCREE4TEl6Y1E3Z0VNRGdzak9CRHVBUXdOQ3lNNUVPNEJEQXdMSXpvUTdnRU1Dd3NqT1NNNkVFb1ExQUVRN2dFTUNnc2pOQkR1QVF3SkN5TTFFTzhCREFnTEl6WVE3d0VNQndzak54RHZBUXdHQ3lNNEVPOEJEQVVMSXprUTd3RU1CQXNqT2hEdkFRd0RDeU01SXpvUVNoRFVBUkR2QVF3Q0N5TTBFTzhCREFFTFFYOFBDMEVFQ3l3QUl6UWdBSEpCL3dGeEpEUWpOQVJBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0ZCQUJETEFVRUFFTThCQ3pNQkFYOGpOQ0FBUWY4QmNVRi9iQ0lCRU13Qkl6UWdBUkRuQVNNMElBRnFCRUJCQUJETkFRVkJBUkROQVF0QkFSRE9BUXZpQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRYkFCUndSQUFrQWdBVUd4QVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVROFFFTUVBc2pOaER4QVF3UEN5TTNFUEVCREE0TEl6Z1E4UUVNRFFzak9SRHhBUXdNQ3lNNkVQRUJEQXNMSXprak9oQktFTlFCRVBFQkRBb0xJelFROFFFTUNRc2pOUkR5QVF3SUN5TTJFUElCREFjTEl6Y1E4Z0VNQmdzak9CRHlBUXdGQ3lNNUVQSUJEQVFMSXpvUThnRU1Bd3NqT1NNNkVFb1ExQUVROGdFTUFnc2pOQkR5QVF3QkMwRi9Ed3RCQkF0Q0FRSi9Ba0FDUUNBQUVJMEJJZ0ZCZjBjRVFBd0NDeUFBRUFNaEFRc0xBa0FDUUNBQVFRRnFJZ0lRalFFaUFFRi9SdzBCSUFJUUF5RUFDd3NnQUNBQkVFb0xEQUJCQ0JERkFTQUFFUFFCQ3pzQUlBQkJnQUZ4UVlBQlJnUkFRUUVRendFRlFRQVF6d0VMSUFBUTBBRWlBQVJBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0ZCQUJETEFTQUFDemtBSUFCQkFYRkJBRXNFUUVFQkVNOEJCVUVBRU04QkN5QUFFTlVCSWdBRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0VnQUF0SUFRRi9JQUJCZ0FGeFFZQUJSZ1JBUVFFaEFRc2dBQkRZQVNFQUlBRUVRRUVCRU04QkJVRUFFTThCQ3lBQUJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FVRUFFTXNCSUFBTFJnRUJmeUFBUVFGeFFRRkdCRUJCQVNFQkN5QUFFTnNCSVFBZ0FRUkFRUUVRendFRlFRQVF6d0VMSUFBRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0VnQUF0TEFRRi9JQUJCZ0FGeFFZQUJSZ1JBUVFFaEFRc2dBRUVCZEJDSEFTRUFJQUVFUUVFQkVNOEJCVUVBRU04QkN5QUFCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVBRU1zQklBQUxhd0VDZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFCQkFYRkJBVVlFUUVFQklRSUxJQUJCL3dGeFFRRjJFSWNCSVFBZ0FRUkFJQUJCZ0FGeUlRQUxJQUFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCUVFBUXl3RWdBZ1JBUVFFUXp3RUZRUUFRendFTElBQUxPQUFnQUVFUGNVRUVkQ0FBUWZBQmNVRUVkbklRaHdFaUFBUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVVFQUVNOEJJQUFMU3dFQmZ5QUFRUUZ4UVFGR0JFQkJBU0VCQ3lBQVFmOEJjVUVCZGhDSEFTSUFCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVBRU1zQklBRUVRRUVCRU04QkJVRUFFTThCQ3lBQUN5Z0FJQUZCQVNBQWRIRkIvd0Z4QkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVVFQkVNc0JJQUVMSUFBZ0FVRUFTZ1IvSUFKQkFTQUFkSElGSUFKQkFTQUFkRUYvYzNFTElnSUwyd2dCQjM5QmZ5RUdBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQ0c4aUJ5RUZJQWRGRFFBQ1FDQUZRUUZyRGdjQ0F3UUZCZ2NJQUFzTUNBc2pOU0VCREFjTEl6WWhBUXdHQ3lNM0lRRU1CUXNqT0NFQkRBUUxJemtoQVF3REN5TTZJUUVNQWdzak9TTTZFRW9RMUFFaEFRd0JDeU0wSVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklRUWdCVVVOQUFKQUlBUkJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTElBQkJCMHdFUUNBQkVQWUJJUUpCQVNFREJTQUFRUTlNQkVBZ0FSRDNBU0VDUVFFaEF3c0xEQThMSUFCQkYwd0VRQ0FCRVBnQklRSkJBU0VEQlNBQVFSOU1CRUFnQVJENUFTRUNRUUVoQXdzTERBNExJQUJCSjB3RVFDQUJFUG9CSVFKQkFTRURCU0FBUVM5TUJFQWdBUkQ3QVNFQ1FRRWhBd3NMREEwTElBQkJOMHdFUUNBQkVQd0JJUUpCQVNFREJTQUFRVDlNQkVBZ0FSRDlBU0VDUVFFaEF3c0xEQXdMSUFCQnh3Qk1CRUJCQUNBQkVQNEJJUUpCQVNFREJTQUFRYzhBVEFSQVFRRWdBUkQrQVNFQ1FRRWhBd3NMREFzTElBQkIxd0JNQkVCQkFpQUJFUDRCSVFKQkFTRURCU0FBUWQ4QVRBUkFRUU1nQVJEK0FTRUNRUUVoQXdzTERBb0xJQUJCNXdCTUJFQkJCQ0FCRVA0QklRSkJBU0VEQlNBQVFlOEFUQVJBUVFVZ0FSRCtBU0VDUVFFaEF3c0xEQWtMSUFCQjl3Qk1CRUJCQmlBQkVQNEJJUUpCQVNFREJTQUFRZjhBVEFSQVFRY2dBUkQrQVNFQ1FRRWhBd3NMREFnTElBQkJod0ZNQkVCQkFFRUFJQUVRL3dFaEFrRUJJUU1GSUFCQmp3Rk1CRUJCQVVFQUlBRVEvd0VoQWtFQklRTUxDd3dIQ3lBQVFaY0JUQVJBUVFKQkFDQUJFUDhCSVFKQkFTRURCU0FBUVo4QlRBUkFRUU5CQUNBQkVQOEJJUUpCQVNFREN3c01CZ3NnQUVHbkFVd0VRRUVFUVFBZ0FSRC9BU0VDUVFFaEF3VWdBRUd2QVV3RVFFRUZRUUFnQVJEL0FTRUNRUUVoQXdzTERBVUxJQUJCdHdGTUJFQkJCa0VBSUFFUS93RWhBa0VCSVFNRklBQkJ2d0ZNQkVCQkIwRUFJQUVRL3dFaEFrRUJJUU1MQ3d3RUN5QUFRY2NCVEFSQVFRQkJBU0FCRVA4QklRSkJBU0VEQlNBQVFjOEJUQVJBUVFGQkFTQUJFUDhCSVFKQkFTRURDd3NNQXdzZ0FFSFhBVXdFUUVFQ1FRRWdBUkQvQVNFQ1FRRWhBd1VnQUVIZkFVd0VRRUVEUVFFZ0FSRC9BU0VDUVFFaEF3c0xEQUlMSUFCQjV3Rk1CRUJCQkVFQklBRVEvd0VoQWtFQklRTUZJQUJCN3dGTUJFQkJCVUVCSUFFUS93RWhBa0VCSVFNTEN3d0JDeUFBUWZjQlRBUkFRUVpCQVNBQkVQOEJJUUpCQVNFREJTQUFRZjhCVEFSQVFRZEJBU0FCRVA4QklRSkJBU0VEQ3dzTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBSElnUUVRQUpBSUFSQkFXc09Cd0lEQkFVR0J3Z0FDd3dJQ3lBQ0pEVU1Cd3NnQWlRMkRBWUxJQUlrTnd3RkN5QUNKRGdNQkFzZ0FpUTVEQU1MSUFJa09nd0NDeUFGUVFSSUlnUkZCRUFnQlVFSFNpRUVDeUFFQkVBak9TTTZFRW9nQWhESkFRc01BUXNnQWlRMEN5QURCRUJCQkNFR0N5QUdDOVFEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRY0FCUndSQUFrQWdBVUhCQVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxFTjBCRFJJTUZBc2pQQkQxQVVILy93TnhJUUVqUEVFQ2FoQThKRHdnQVJDR0FVSC9BWEVrTlNBQkVJY0JRZjhCY1NRMlFRUVBDeERkQVFSQURCSUZEQkFMQUFzTURnc1EzUUVFUUF3UUJRd05Dd0FMSXp4QkFtc1FQQ1E4SXp3ak5TTTJFRW9RMGdFTURRc1F4d0VRNkFFTUR3c2pQRUVDYXhBOEpEd2pQQ005RU5JQlFRQWtQUXdMQ3hEZEFVRUJSdzBLREF3TEl6d1E5UUZCLy84RGNTUTlJenhCQW1vUVBDUThEQWtMRU4wQlFRRkdCRUFNQ0FVTUNnc0FDeERIQVVIL0FYRVFnQUloQVNNOVFRRnFFRHdrUFNBQkR3c1EzUUZCQVVZRVFDTThRUUpyRUR3a1BDTThJejFCQW1wQi8vOERjUkRTQVF3R0JRd0lDd0FMREFNTEVNY0JFT2tCREFjTEl6eEJBbXNRUENROEl6d2pQUkRTQVVFSUpEME1Bd3RCZnc4TEl6eEJBbXNRUENROEl6d2pQVUVDYWhBOEVOSUJDeERJQVVILy93TnhKRDBMUVFnUEN5TTlRUUpxRUR3a1BVRU1Ed3NqUEJEMUFVSC8vd054SkQwalBFRUNhaEE4SkR4QkRBOExJejFCQVdvUVBDUTlRUVFMRlFBZ0FFRUJjUVJBUVFFa2lBRUZRUUFraHdFTEM3RURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVSFFBVWNFUUFKQUlBRkIwUUZyRGc4Q0F3QUVCUVlIQ0FrS0FBc0FEQTBBQ3d3TkN4RFhBUTBPREJBTEl6d1E5UUZCLy84RGNTRUJJenhCQW1vUVBDUThJQUVRaGdGQi93RnhKRGNnQVJDSEFVSC9BWEVrT0VFRUR3c1Exd0VFUUF3T0JRd01Dd0FMRU5jQkJFQU1EUVVqUEVFQ2F4QThKRHdqUENNOVFRSnFRZi8vQTNFUTBnRU1Dd3NBQ3lNOFFRSnJFRHdrUENNOEl6Y2pPQkJLRU5JQkRBb0xFTWNCRU9zQkRBd0xJenhCQW1zUVBDUThJendqUFJEU0FVRVFKRDBNQ0FzUTF3RkJBVWNOQnd3SkN5TThFUFVCUWYvL0EzRWtQVUVCRUlJQ0l6eEJBbW9RUENROERBWUxFTmNCUVFGR0JFQU1CUVVNQndzQUN4RFhBVUVCUmdSQUl6eEJBbXNRUENROEl6d2pQVUVDYWhBOEVOSUJEQVFGREFZTEFBc1F4d0VRN0FFTUJnc2pQRUVDYXhBOEpEd2pQQ005RU5JQlFSZ2tQUXdDQzBGL0R3c1F5QUZCLy84RGNTUTlDMEVJRHdzalBVRUNhaEE4SkQxQkRBOExJendROVFGQi8vOERjU1E5SXp4QkFtb1FQQ1E4UVF3UEN5TTlRUUZxRUR3a1BVRUVDK0FDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWVBQlJ3UkFBa0FnQUVIaEFXc09Ed0lEQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRU1jQlFmOEJjVUdBL2dOcUl6UVF5UUVNQ3dzalBCRDFBVUgvL3dOeElRQWpQRUVDYWhBOEpEd2dBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2UVFRUEN5TTJRWUQrQTJvak5CREpBVUVFRHdzalBFRUNheEE4SkR3alBDTTVJem9RU2hEU0FVRUlEd3NReHdFUTdnRU1Cd3NqUEVFQ2F4QThKRHdqUENNOUVOSUJRU0FrUFVFSUR3c1F4d0VRMlFFaEFDTThJQUJCR0hSQkdIVWlBRUVCRU5NQkl6d2dBR29RUENROFFRQVF6UUZCQUJET0FTTTlRUUZxRUR3a1BVRU1Ed3NqT1NNNkVFcEIvLzhEY1NROVFRUVBDeERJQVVILy93TnhJelFReVFFalBVRUNhaEE4SkQxQkJBOExFTWNCRU84QkRBSUxJenhCQW1zUVBDUThJendqUFJEU0FVRW9KRDFCQ0E4TFFYOFBDeU05UVFGcUVEd2tQVUVFQzVJREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQlJ3UkFBa0FnQUVIeEFXc09Ed0lEQkFBRkJnY0lDUW9MQUFBTURRQUxEQTBMRU1jQlFmOEJjVUdBL2dOcUVOUUJFSWNCSkRRTURRc2pQQkQxQVVILy93TnhJUUFqUEVFQ2FoQThKRHdnQUJDR0FVSC9BWEVrTkNBQUVJY0JRZjhCY1NRN0RBMExJelpCZ1A0RGFoRFVBUkNIQVNRMERBd0xRUUFRZ2dJTUN3c2pQRUVDYXhBOEpEd2pQQ00wSXpzUVNoRFNBVUVJRHdzUXh3RVE4UUVNQ0FzalBFRUNheEE4SkR3alBDTTlFTklCUVRBa1BVRUlEd3NReHdFUTJRRWhBRUVBRU0wQlFRQVF6Z0VqUENBQVFSaDBRUmgxSWdCQkFSRFRBU004SUFCcUVEd2lBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2SXoxQkFXb1FQQ1E5UVFnUEN5TTVJem9RU2tILy93TnhKRHhCQ0E4TEVNZ0JRZi8vQTNFUTFBRkIvd0Z4SkRRalBVRUNhaEE4SkQwTUJRdEJBUkNDQWd3RUN4REhBUkR5QVF3Q0N5TThRUUpyRUR3a1BDTThJejBRMGdGQk9DUTlRUWdQQzBGL0R3c2pQVUVCYWhBOEpEMExRUVFMMWdFQkFYOGpQVUVCYWhBOEpEMGpRUVJBSXoxQkFXc1FQQ1E5Q3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRTSUJCRUFnQVVFQlJnMEJBa0FnQVVFQ2F3NE5Bd1FGQmdjSUNRb0xEQTBPRHdBTERBOExJQUFRMWdFUEN5QUFFTndCRHdzZ0FCRGdBUThMSUFBUTRRRVBDeUFBRU9JQkR3c2dBQkRqQVE4TElBQVE1QUVQQ3lBQUVPWUJEd3NnQUJEcUFROExJQUFRN1FFUEN5QUFFUEFCRHdzZ0FCRHpBUThMSUFBUWdRSVBDeUFBRUlNQ0R3c2dBQkNFQWc4TElBQVFoUUlMRWdCQkFDUkFRUUFrUDBFQUpFRkJBQ1JDQ3hRQUl6OEVmeU0vQlNOQUN3UkFRUUVQQzBFQUN4MEJBWDhnQVJDR0FTRUNJQUFnQVJDSEFSQUdJQUJCQVdvZ0FoQUdDNElCQVFGL1FRQVFnZ0lnQUVHUC9nTVFBeEJFSWdFa2QwR1AvZ01nQVJBR0l6eEJBbXRCLy84RGNTUThFSWdDR2lNOEl6MFFpUUlDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdRQ0F3QUVBQXNNQkF0QkFDUnpRY0FBSkQwTUF3dEJBQ1IwUWNnQUpEME1BZ3RCQUNSMVFkQUFKRDBNQVF0QkFDUjJRZUFBSkQwTEM3OEJBUUovSTRnQkJFQkJBU1NIQVVFQUpJZ0JDeU55STNkeFFSOXhRUUJLQkVBamh3RUVmeU5BUlFVamh3RUxJZ0FFUUNOdUJIOGpjd1VqYmdzaUFBUkFRUUFRaWdKQkFTRUJCU052Qkg4amRBVWpid3NpQUFSQVFRRVFpZ0pCQVNFQkJTTndCSDhqZFFVamNBc2lBQVJBUVFJUWlnSkJBU0VCQlNOeEJIOGpkZ1VqY1FzaUFBUkFRUVFRaWdKQkFTRUJDd3NMQ3d0QkFDRUFJQUVFUUVFVUlRQVFpQUlFUUJDSEFrRVlJUUFMQ3hDSUFnUkFFSWNDQ3lBQUR3dEJBQXNvQUNPRkFTQUFhaVNGQVNPRkFTT0RBVTRFUUNPRUFVRUJhaVNFQVNPRkFTT0RBV3NraFFFTEMzRUJBbjlCQVJBVkkwRUVRQ005RUFOQi93RnhFSVlDRU1VQkVJY0NDeENMQWlJQlFRQktCRUFnQVJERkFRdEJCQ0VBRUlnQ1JTSUJCRUFqUWtVaEFRc2dBUVJBSXowUUEwSC9BWEVRaGdJaEFBc2pPMEh3QVhFa095QUFRUUJNQkVBZ0FBOExJQUFReFFGQkFSQ01BaUFBQ3hBQUl6TUVRRUdneVFnUEMwSFFwQVFMQkFBalh3dk9BUUVFZjBHQUNDRURJQUZCQUVvRVFDQUJJUU1GSUFGQkFFZ0VRRUYvSVFNTEMwRUFJUUVEUUNBR1JTSUFCRUFnQVVVaEFBc2dBQVJBSUFSRklRQUxJQUFFUUNBRlJTRUFDeUFBQkVBUWpRSkJBRWdFUUVFQklRWUZJejRRamdKT0JFQkJBU0VCQlNBRFFYOUtJZ0FFUUJDUEFpQURUaUVBQ3lBQUJFQkJBU0VFQlNBQ1FYOUtJZ0FFUUNNOUlBSkdJUUFMSUFBRVFFRUJJUVVMQ3dzTERBRUxDeUFCQkVBalBoQ09BbXNrUGtFQUR3c2dCQVJBUVFFUEN5QUZCRUJCQWc4TEl6MUJBV3NRUENROVFYOExDd0JCQVVGL1FYOFFrQUlMT0FFRGZ3TkFJQUlnQUVnaUF3UkFJQUZCQUU0aEF3c2dBd1JBRUpFQ0lRRWdBa0VCYWlFQ0RBRUxDeUFCUVFCSUJFQWdBUThMUVFBTEN3QkJBU0FBUVg4UWtBSUxHZ0VCZjBFQlFYOGdBQkNRQWlJQlFRSkdCRUJCQVE4TElBRUxCUUFqZ0FFTEJRQWpnUUVMQlFBamdnRUxYd0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQWlBVUVCUmcwQkFrQWdBVUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2oyQUVQQ3lQWkFROExJOW9CRHdzajJ3RVBDeVBjQVE4TEk5MEJEd3NqM2dFUEN5UGZBUThMUVFBTGl3RUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnSkJBVVlOQVFKQUlBSkJBbXNPQmdNRUJRWUhDQUFMREFnTElBRkJBWEVrMkFFTUJ3c2dBVUVCY1NUWkFRd0dDeUFCUVFGeEpOb0JEQVVMSUFGQkFYRWsyd0VNQkFzZ0FVRUJjU1RjQVF3REN5QUJRUUZ4Sk4wQkRBSUxJQUZCQVhFazNnRU1BUXNnQVVFQmNTVGZBUXNMQ2dCQkFTUjJRUVFRWFF0a0FRSi9RUUFrUWlBQUVKZ0NSUVJBUVFFaEFRc2dBRUVCRUprQ0lBRUVRRUVBSVFFZ0FFRURUQVJBUVFFaEFRc2pyUUVFZnlBQkJTT3RBUXNpQUFSQVFRRWhBZ3NqcmdFRWZ5QUJSUVVqcmdFTElnQUVRRUVCSVFJTElBSUVRQkNhQWdzTEN3a0FJQUJCQUJDWkFndWFBUUFnQUVFQVNnUkFRUUFRbXdJRlFRQVFuQUlMSUFGQkFFb0VRRUVCRUpzQ0JVRUJFSndDQ3lBQ1FRQktCRUJCQWhDYkFnVkJBaENjQWdzZ0EwRUFTZ1JBUVFNUW13SUZRUU1RbkFJTElBUkJBRW9FUUVFRUVKc0NCVUVFRUp3Q0N5QUZRUUJLQkVCQkJSQ2JBZ1ZCQlJDY0Fnc2dCa0VBU2dSQVFRWVFtd0lGUVFZUW5BSUxJQWRCQUVvRVFFRUhFSnNDQlVFSEVKd0NDd3NFQUNNMEN3UUFJelVMQkFBak5nc0VBQ00zQ3dRQUl6Z0xCQUFqT1FzRUFDTTZDd1FBSXpzTEJBQWpQUXNFQUNNOEN3WUFJejBRQXdzRUFDTkxDNThEQVFwL1FZQ1FBaUVKSTZjQkJFQkJnSUFDSVFrTFFZQ3dBaUVLSTZnQkJFQkJnTGdDSVFvTEFrQURRQ0FFUVlBQ1RnMEJBa0JCQUNFRkEwQWdCVUdBQWs0TkFTQUpJQW9nQkVFRGRVRUZkR29nQlVFRGRXb2lCa0VBRUQ4UVNDRUlJQVJCQ0c4aEFVRUhJQVZCQ0c5cklRZEJBQ0VDSXk4RWZ5QUFRUUJLQlNNdkN5SURCRUFnQmtFQkVEOGhBZ3RCQmlBQ0VCQUVRRUVISUFGcklRRUxRUUFoQTBFRElBSVFFQVJBUVFFaEF3c2dDQ0FCUVFGMGFpSUdJQU1RUHlFSVFRQWhBU0FISUFaQkFXb2dBeEEvRUJBRVFFRUNJUUVMSUFjZ0NCQVFCRUFnQVVFQmFpRUJDeUFFUVFoMElBVnFRUU5zSVFjakx3Ui9JQUJCQUVvRkl5OExJZ01FUUVFQUlBSkJCM0VnQVVFQUVFc2lBUkJNSVFaQkFTQUJFRXdoQTBFQ0lBRVFUQ0VCSUFkQmdKZ09haUlDSUFZNkFBQWdBa0VCYWlBRE9nQUFJQUpCQW1vZ0FUb0FBQVVnQVVISC9nTkJBQkJOSVFJQ1FFRUFJUUVEUUNBQlFRTk9EUUVnQjBHQW1BNXFJQUZxSUFJNkFBQWdBVUVCYWlFQkRBQUFDd0FMQ3lBRlFRRnFJUVVNQUFBTEFBc2dCRUVCYWlFRURBQUFDd0FMQzBjQUFrQUNRQUpBQWtBQ1FDUDJBVUVLYXc0RUFRSURCQUFMQUF0QkFDRUtDMEVBSVFzTFFYOGhEQXNnQUNBQklBSWdBeUFFSUFVZ0JpQUhJQWdnQ1NBS0lBc2dEQkJQQzlrQkFRWi9Ba0FEUUNBQ1FSZE9EUUVDUUVFQUlRQURRQ0FBUVI5T0RRRkJBQ0VFSUFCQkQwb0VRRUVCSVFRTElBSWhBU0FDUVE5S0JFQWdBVUVQYXlFQkN5QUJRUVIwSVFFZ0FFRVBTZ1IvSUFFZ0FFRVBhMm9GSUFFZ0FHb0xJUUZCZ0lBQ0lRVWdBa0VQU2dSQVFZQ1FBaUVGQ3dKQVFRQWhBd05BSUFOQkNFNE5BVUVMSlBZQklBRWdCU0FFUVFCQkJ5QURJQUJCQTNRZ0FrRURkQ0FEYWtINEFVR0FtQnBCQVVFQVFRQVFxd0lhSUFOQkFXb2hBd3dBQUFzQUN5QUFRUUZxSVFBTUFBQUxBQXNnQWtFQmFpRUNEQUFBQ3dBTEN3UUFJM2tMQkFBamVnc0VBQ043Q3hjQkFYOGpmU0VBSTN3RVFFRUNJQUFRUlNFQUN5QUFDeFFBUHdCQml3RklCRUJCaXdFL0FHdEFBQm9MQ3gwQUFrQUNRQUpBSS9ZQkRnSUJBZ0FMQUF0QkFDRUFDeUFBRUpNQ0N3Y0FJQUFrOWdFTE1RQUNRQUpBQWtBQ1FBSkFJL1lCRGdRQkFnTUVBQXNBQzBFQklRQUxRWDhoQVF0QmZ5RUNDeUFBSUFFZ0FoQ1FBZ3NkQUFKQUFrQUNRQ1AyQVE0Q0FRSUFDd0FMUVFBaEFBc2dBQkNxQWdzQXNXTUVibUZ0WlFHcFk3WUNBQ1ZqYjNKbEwyMWxiVzl5ZVM5aVlXNXJhVzVuTDJkbGRGSnZiVUpoYm10QlpHUnlaWE56QVNWamIzSmxMMjFsYlc5eWVTOWlZVzVyYVc1bkwyZGxkRkpoYlVKaGJtdEJaR1J5WlhOekFqZGpiM0psTDIxbGJXOXllUzl0WlcxdmNubE5ZWEF2WjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBeWxqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMMlZwWjJoMFFtbDBURzloWkVaeWIyMUhRazFsYlc5eWVRUWFZMjl5WlM5amNIVXZZM0IxTDJsdWFYUnBZV3hwZW1WRGNIVUZKbU52Y21VdmJXVnRiM0o1TDIxbGJXOXllUzlwYm1sMGFXRnNhWHBsUTJGeWRISnBaR2RsQml0amIzSmxMMjFsYlc5eWVTOXpkRzl5WlM5bGFXZG9kRUpwZEZOMGIzSmxTVzUwYjBkQ1RXVnRiM0o1QngxamIzSmxMMjFsYlc5eWVTOWtiV0V2YVc1cGRHbGhiR2w2WlVSdFlRZ3BZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5cGJtbDBhV0ZzYVhwbFIzSmhjR2hwWTNNSkoyTnZjbVV2WjNKaGNHaHBZM012Y0dGc1pYUjBaUzlwYm1sMGFXRnNhWHBsVUdGc1pYUjBaUW9uWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1cGJtbDBhV0ZzYVhwbEN5ZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbWx1YVhScFlXeHBlbVVNSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWFXNXBkR2xoYkdsNlpRMG5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVwYm1sMGFXRnNhWHBsRGpGamIzSmxMM052ZFc1a0wyRmpZM1Z0ZFd4aGRHOXlMMmx1YVhScFlXeHBlbVZUYjNWdVpFRmpZM1Z0ZFd4aGRHOXlEeUJqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMmx1YVhScFlXeHBlbVZUYjNWdVpCQWhZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMMk5vWldOclFtbDBUMjVDZVhSbEVUeGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OUpiblJsY25KMWNIUnpMblZ3WkdGMFpVbHVkR1Z5Y25Wd2RFVnVZV0pzWldRU1BtTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXVkWEJrWVhSbFNXNTBaWEp5ZFhCMFVtVnhkV1Z6ZEdWa0V5OWpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OXBibWwwYVdGc2FYcGxTVzUwWlhKeWRYQjBjeFFqWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDJsdWFYUnBZV3hwZW1WVWFXMWxjbk1WRzJOdmNtVXZZMjl5WlM5elpYUklZWE5EYjNKbFUzUmhjblJsWkJZWFkyOXlaUzlqZVdOc1pYTXZjbVZ6WlhSRGVXTnNaWE1YRjJOdmNtVXZaWGhsWTNWMFpTOXlaWE5sZEZOMFpYQnpHQlJqYjNKbEwyTnZjbVV2YVc1cGRHbGhiR2w2WlJrUVkyOXlaUzlqYjNKbEwyTnZibVpwWnhvWVkyOXlaUzlqYjNKbEwyaGhjME52Y21WVGRHRnlkR1ZrR3lKamIzSmxMMk52Y21VdloyVjBVMkYyWlZOMFlYUmxUV1Z0YjNKNVQyWm1jMlYwSERKamIzSmxMMjFsYlc5eWVTOXpkRzl5WlM5emRHOXlaVUp2YjJ4bFlXNUVhWEpsWTNSc2VWUnZWMkZ6YlUxbGJXOXllUjBhWTI5eVpTOWpjSFV2WTNCMUwwTndkUzV6WVhabFUzUmhkR1VlS1dOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVjMkYyWlZOMFlYUmxIeTlqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlKYm5SbGNuSjFjSFJ6TG5OaGRtVlRkR0YwWlNBalkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wwcHZlWEJoWkM1ellYWmxVM1JoZEdVaEkyTnZjbVV2YldWdGIzSjVMMjFsYlc5eWVTOU5aVzF2Y25rdWMyRjJaVk4wWVhSbElpTmpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuTmhkbVZUZEdGMFpTTWdZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1ellYWmxVM1JoZEdVa0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVjMkYyWlZOMFlYUmxKU1pqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5OaGRtVlRkR0YwWlNZbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NXpZWFpsVTNSaGRHVW5KbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1YzJGMlpWTjBZWFJsS0JOamIzSmxMMk52Y21VdmMyRjJaVk4wWVhSbEtUSmpiM0psTDIxbGJXOXllUzlzYjJGa0wyeHZZV1JDYjI5c1pXRnVSR2x5WldOMGJIbEdjbTl0VjJGemJVMWxiVzl5ZVNvYVkyOXlaUzlqY0hVdlkzQjFMME53ZFM1c2IyRmtVM1JoZEdVckptTnZjbVV2WjNKaGNHaHBZM012YkdOa0wweGpaQzUxY0dSaGRHVk1ZMlJEYjI1MGNtOXNMQ2xqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxteHZZV1JUZEdGMFpTMHZZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTVzYjJGa1UzUmhkR1V1Sm1OdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5S2IzbHdZV1F1ZFhCa1lYUmxTbTk1Y0dGa0x5TmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZTbTk1Y0dGa0xteHZZV1JUZEdGMFpUQWpZMjl5WlM5dFpXMXZjbmt2YldWdGIzSjVMMDFsYlc5eWVTNXNiMkZrVTNSaGRHVXhJMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXViRzloWkZOMFlYUmxNaUZqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMk5zWldGeVFYVmthVzlDZFdabVpYSXpJR052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWJHOWhaRk4wWVhSbE5DWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbXh2WVdSVGRHRjBaVFVtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1c2IyRmtVM1JoZEdVMkptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXViRzloWkZOMFlYUmxOeVpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG14dllXUlRkR0YwWlRnVFkyOXlaUzlqYjNKbEwyeHZZV1JUZEdGMFpUa2ZZMjl5WlM5bGVHVmpkWFJsTDJkbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZERvWVkyOXlaUzlsZUdWamRYUmxMMmRsZEZOMFpYQlRaWFJ6T3hWamIzSmxMMlY0WldOMWRHVXZaMlYwVTNSbGNITThJbU52Y21VdmNHOXlkR0ZpYkdVdmNHOXlkR0ZpYkdVdmRURTJVRzl5ZEdGaWJHVTlOMk52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVRVRllYME5aUTB4RlUxOVFSVkpmVTBOQlRreEpUa1UrTW1OdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVZbUYwWTJoUWNtOWpaWE56UTNsamJHVnpQeWRqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwyeHZZV1JHY205dFZuSmhiVUpoYm10QUoyTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012WjJWMFVtZGlVR2w0Wld4VGRHRnlkRUVtWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXpaWFJRYVhobGJFOXVSbkpoYldWQ0pHTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WjJWMFVHbDRaV3hUZEdGeWRFTXFZMjl5WlM5bmNtRndhR2xqY3k5d2NtbHZjbWwwZVM5blpYUlFjbWx2Y21sMGVXWnZjbEJwZUdWc1JDRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZjbVZ6WlhSQ2FYUlBia0o1ZEdWRkgyTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXpaWFJDYVhSUGJrSjVkR1ZHS21OdmNtVXZaM0poY0docFkzTXZjSEpwYjNKcGRIa3ZZV1JrVUhKcGIzSnBkSGxtYjNKUWFYaGxiRWM2WTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGRNYVc1bFQyWlVhV3hsUm5KdmJWUnBiR1ZEWVdOb1pVZ21ZMjl5WlM5bmNtRndhR2xqY3k5MGFXeGxjeTluWlhSVWFXeGxSR0YwWVVGa1pISmxjM05KTTJOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXNiMkZrVUdGc1pYUjBaVUo1ZEdWR2NtOXRWMkZ6YlUxbGJXOXllVW9qWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDJOdmJtTmhkR1Z1WVhSbFFubDBaWE5MTEdOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOW5aWFJTWjJKRGIyeHZja1p5YjIxUVlXeGxkSFJsVEM1amIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZaMlYwUTI5c2IzSkRiMjF3YjI1bGJuUkdjbTl0VW1kaVRUTmpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2WjJWMFRXOXViMk5vY205dFpVTnZiRzl5Um5KdmJWQmhiR1YwZEdWT0pXTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaMlYwVkdsc1pWQnBlR1ZzVTNSaGNuUlBMR052Y21VdlozSmhjR2hwWTNNdmRHbHNaWE12WkhKaGQxQnBlR1ZzYzBaeWIyMU1hVzVsVDJaVWFXeGxVRGRqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkMHhwYm1WUFpsUnBiR1ZHY205dFZHbHNaVWxrVVRkamIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDBOdmJHOXlVR2w0Wld4R2NtOXRWR2xzWlVsa1VqeGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQwMXZibTlqYUhKdmJXVlFhWGhsYkVaeWIyMVVhV3hsU1dSVE8yTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1FtRmphMmR5YjNWdVpGZHBibVJ2ZDFOallXNXNhVzVsVkM5amIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZjbVZ1WkdWeVFtRmphMmR5YjNWdVpGVXJZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDNKbGJtUmxjbGRwYm1SdmQxWWpZMjl5WlM5bmNtRndhR2xqY3k5emNISnBkR1Z6TDNKbGJtUmxjbE53Y21sMFpYTlhKR052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlgyUnlZWGRUWTJGdWJHbHVaVmdwWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OWZjbVZ1WkdWeVJXNTBhWEpsUm5KaGJXVlpKMk52Y21VdlozSmhjR2hwWTNNdmNISnBiM0pwZEhrdlkyeGxZWEpRY21sdmNtbDBlVTFoY0ZvaVkyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OXlaWE5sZEZScGJHVkRZV05vWlZzN1kyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVOU1U1ZlExbERURVZUWDFOUVVrbFVSVk5mVEVORVgwMVBSRVZjUVdOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVUVWxPWDBOWlEweEZVMTlVVWtGT1UwWkZVbDlFUVZSQlgweERSRjlOVDBSRlhTeGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OWZjbVZ4ZFdWemRFbHVkR1Z5Y25Wd2RGNHVZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRFeGpaRWx1ZEdWeWNuVndkRjhwWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlUYjNWdVpDNWlZWFJqYUZCeWIyTmxjM05EZVdOc1pYTmdMV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWJXRjRSbkpoYldWVFpYRjFaVzVqWlVONVkyeGxjMkVwWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1MWNHUmhkR1ZNWlc1bmRHaGlLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUR1Z1WjNSb1l5bGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVeGxibWQwYUdRcFkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWTVpXNW5kR2hsTEdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdloyVjBUbVYzUm5KbGNYVmxibU41Um5KdmJWTjNaV1Z3WmlsamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuTmxkRVp5WlhGMVpXNWplV2N5WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5allXeGpkV3hoZEdWVGQyVmxjRUZ1WkVOb1pXTnJUM1psY21ac2IzZG9LR052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxVM2RsWlhCcEsyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFJXNTJaV3h2Y0dWcUsyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFJXNTJaV3h2Y0dWcksyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFJXNTJaV3h2Y0dWc0pXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmRYQmtZWFJsUm5KaGJXVlRaWEYxWlc1alpYSnRMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1Z1S21OdmNtVXZjMjkxYm1RdllXTmpkVzExYkdGMGIzSXZaR2xrUTJoaGJtNWxiRVJoWTBOb1lXNW5aVzh1WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1M2FXeHNRMmhoYm01bGJGVndaR0YwWlhBdVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTNhV3hzUTJoaGJtNWxiRlZ3WkdGMFpYRXVZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzUzYVd4c1EyaGhibTVsYkZWd1pHRjBaWEluWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1eVpYTmxkRlJwYldWeWN6MWpiM0psTDNOdmRXNWtMMlIxZEhrdmFYTkVkWFI1UTNsamJHVkRiRzlqYTFCdmMybDBhWFpsVDNKT1pXZGhkR2wyWlVadmNsZGhkbVZtYjNKdGRDWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbWRsZEZOaGJYQnNaWFUyWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1blpYUlRZVzF3YkdWR2NtOXRRM2xqYkdWRGIzVnVkR1Z5ZGlkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuSmxjMlYwVkdsdFpYSjNKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1WjJWMFUyRnRjR3hsZURaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxtZGxkRk5oYlhCc1pVWnliMjFEZVdOc1pVTnZkVzUwWlhKNUoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVjbVZ6WlhSVWFXMWxjbm9pWTI5eVpTOXdiM0owWVdKc1pTOXdiM0owWVdKc1pTOXBNekpRYjNKMFlXSnNaWHNtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1blpYUlRZVzF3YkdWOE5tTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVaMlYwVTJGdGNHeGxSbkp2YlVONVkyeGxRMjkxYm5SbGNuMDdZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVuWlhST2IybHpaVU5vWVc1dVpXeEdjbVZ4ZFdWdVkzbFFaWEpwYjJSK0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVaMlYwVTJGdGNHeGxmelpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG1kbGRGTmhiWEJzWlVaeWIyMURlV05zWlVOdmRXNTBaWEtBQVJ4amIzSmxMMk53ZFM5amNIVXZRM0IxTGtOTVQwTkxYMU5RUlVWRWdRRXFZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1dFlYaEViM2R1VTJGdGNHeGxRM2xqYkdWemdnRW9ZMjl5WlM5emIzVnVaQzl6YjNWdVpDOW5aWFJUWVcxd2JHVkJjMVZ1YzJsbmJtVmtRbmwwWllNQkltTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmJXbDRRMmhoYm01bGJGTmhiWEJzWlhPRUFUTmpiM0psTDNOdmRXNWtMM052ZFc1a0wzTmxkRXhsWm5SQmJtUlNhV2RvZEU5MWRIQjFkRVp2Y2tGMVpHbHZVWFZsZFdXRkFTWmpiM0psTDNOdmRXNWtMMkZqWTNWdGRXeGhkRzl5TDJGalkzVnRkV3hoZEdWVGIzVnVaSVlCSUdOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5emNHeHBkRWhwWjJoQ2VYUmxod0VmWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNOd2JHbDBURzkzUW5sMFpZZ0JIMk52Y21VdmMyOTFibVF2YzI5MWJtUXZZMkZzWTNWc1lYUmxVMjkxYm1TSkFSeGpiM0psTDNOdmRXNWtMM052ZFc1a0wzVndaR0YwWlZOdmRXNWtpZ0VpWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlpWVhSamFGQnliMk5sYzNOQmRXUnBiNHNCSzJOdmNtVXZjMjkxYm1RdmNtVm5hWE4wWlhKekwxTnZkVzVrVW1WbmFYTjBaWEpTWldGa1ZISmhjSE9NQVNGamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdloyVjBTbTk1Y0dGa1UzUmhkR1dOQVNSamIzSmxMMjFsYlc5eWVTOXlaV0ZrVkhKaGNITXZZMmhsWTJ0U1pXRmtWSEpoY0hPT0FUSmpiM0psTDIxbGJXOXllUzlzYjJGa0wyVnBaMmgwUW1sMFRHOWhaRVp5YjIxSFFrMWxiVzl5ZVZkcGRHaFVjbUZ3YzQ4QklXTnZjbVV2YldWdGIzSjVMMkpoYm10cGJtY3ZhR0Z1Wkd4bFFtRnVhMmx1WjVBQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRsSjRNSkVCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRYQmtZWFJsVGxKNE1KSUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUbEo0TVpNQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRsSjRNWlFCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRYQmtZWFJsVGxKNE1aVUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUbEo0TVpZQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRsSjRNcGNCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRYQmtZWFJsVGxKNE1wZ0JKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TXBrQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFRsSjRNcG9CSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE01c0JKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUbEo0TTV3QkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkWEJrWVhSbFRsSjRNNTBCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVGxKNE01NEJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUbEo0Tko4QkpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkSEpwWjJkbGNxQUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUbEo0TktFQkpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkSEpwWjJkbGNxSUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TktNQkpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkSEpwWjJkbGNxUUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUbEo0TktVQkpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkSEpwWjJkbGNxWUJJV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWRYQmtZWFJsVGxJMU1LY0JJV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWRYQmtZWFJsVGxJMU1hZ0JJV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWRYQmtZWFJsVGxJMU1xa0JMR052Y21VdmMyOTFibVF2Y21WbmFYTjBaWEp6TDFOdmRXNWtVbVZuYVhOMFpYSlhjbWwwWlZSeVlYQnpxZ0VsWTI5eVpTOW5jbUZ3YUdsamN5OXNZMlF2VEdOa0xuVndaR0YwWlV4alpGTjBZWFIxYzZzQklHTnZjbVV2YldWdGIzSjVMMlJ0WVM5emRHRnlkRVJ0WVZSeVlXNXpabVZ5ckFFblkyOXlaUzl0WlcxdmNua3ZaRzFoTDJkbGRFaGtiV0ZUYjNWeVkyVkdjbTl0VFdWdGIzSjVyUUVzWTI5eVpTOXRaVzF2Y25rdlpHMWhMMmRsZEVoa2JXRkVaWE4wYVc1aGRHbHZia1p5YjIxTlpXMXZjbm11QVNGamIzSmxMMjFsYlc5eWVTOWtiV0V2YzNSaGNuUklaRzFoVkhKaGJuTm1aWEt2QVRKamIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZjM1J2Y21WUVlXeGxkSFJsUW5sMFpVbHVWMkZ6YlUxbGJXOXllYkFCTUdOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXBibU55WlcxbGJuUlFZV3hsZEhSbFNXNWtaWGhKWmxObGRMRUJMMk52Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5M2NtbDBaVU52Ykc5eVVHRnNaWFIwWlZSdlRXVnRiM0o1c2dFd1kyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmNtVnhkV1Z6ZEZScGJXVnlTVzUwWlhKeWRYQjBzd0VxWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDE5blpYUlVhVzFsY2tOdmRXNTBaWEpOWVhOclFtbDB0QUU3WTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDE5amFHVmphMFJwZG1sa1pYSlNaV2RwYzNSbGNrWmhiR3hwYm1kRlpHZGxSR1YwWldOMGIzSzFBU2xqYjNKbEwzUnBiV1Z5Y3k5MGFXMWxjbk12WDJsdVkzSmxiV1Z1ZEZScGJXVnlRMjkxYm5SbGNyWUJIMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTkxY0dSaGRHVlVhVzFsY25PM0FTVmpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZZbUYwWTJoUWNtOWpaWE56VkdsdFpYSnp1QUV2WTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTUxY0dSaGRHVkVhWFpwWkdWeVVtVm5hWE4wWlhLNUFTeGpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlZScGJXVnlRMjkxYm5SbGNyb0JLMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXVkWEJrWVhSbFZHbHRaWEpOYjJSMWJHKzdBU3hqYjNKbEwzUnBiV1Z5Y3k5MGFXMWxjbk12VkdsdFpYSnpMblZ3WkdGMFpWUnBiV1Z5UTI5dWRISnZiTHdCSm1OdmNtVXZiV1Z0YjNKNUwzZHlhWFJsVkhKaGNITXZZMmhsWTJ0WGNtbDBaVlJ5WVhCenZRRTBZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZaV2xuYUhSQ2FYUlRkRzl5WlVsdWRHOUhRazFsYlc5eWVWZHBkR2hVY21Gd2M3NEJIR052Y21VdmJXVnRiM0o1TDJSdFlTOW9aRzFoVkhKaGJuTm1aWEsvQVNCamIzSmxMMjFsYlc5eWVTOWtiV0V2ZFhCa1lYUmxTR0pzWVc1clNHUnRZY0FCTVdOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JXUW14aGJtdEpiblJsY25KMWNIVEJBUjVqYjNKbEwyZHlZWEJvYVdOekwyeGpaQzl6WlhSTVkyUlRkR0YwZFhQQ0FTVmpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDNWd1pHRjBaVWR5WVhCb2FXTnp3d0VyWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OWlZWFJqYUZCeWIyTmxjM05IY21Gd2FHbGpjOFFCR21OdmNtVXZZM2xqYkdWekwzUnlZV05yUTNsamJHVnpVbUZ1eFFFV1kyOXlaUzlqZVdOc1pYTXZjM2x1WTBONVkyeGxjOFlCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12WjJWMFJHRjBZVUo1ZEdWVWQyL0hBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmRsZEVSaGRHRkNlWFJsVDI1bHlBRW9ZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW5aWFJEYjI1allYUmxibUYwWldSRVlYUmhRbmwwWmNrQktHTnZjbVV2WTNCMUwyOXdZMjlrWlhNdlpXbG5hSFJDYVhSVGRHOXlaVk41Ym1ORGVXTnNaWFBLQVJsamIzSmxMMk53ZFM5bWJHRm5jeTl6WlhSR2JHRm5RbWwweXdFZlkyOXlaUzlqY0hVdlpteGhaM012YzJWMFNHRnNaa05oY25KNVJteGhaOHdCTDJOdmNtVXZZM0IxTDJac1lXZHpMMk5vWldOclFXNWtVMlYwUldsbmFIUkNhWFJJWVd4bVEyRnljbmxHYkdGbnpRRWFZMjl5WlM5amNIVXZabXhoWjNNdmMyVjBXbVZ5YjBac1lXZk9BUjVqYjNKbEwyTndkUzltYkdGbmN5OXpaWFJUZFdKMGNtRmpkRVpzWVdmUEFSdGpiM0psTDJOd2RTOW1iR0ZuY3k5elpYUkRZWEp5ZVVac1lXZlFBU0ZqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2Y205MFlYUmxRbmwwWlV4bFpuVFJBVFpqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzl6YVhoMFpXVnVRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbmxYYVhSb1ZISmhjSFBTQVNwamIzSmxMMk53ZFM5dmNHTnZaR1Z6TDNOcGVIUmxaVzVDYVhSVGRHOXlaVk41Ym1ORGVXTnNaWFBUQVRSamIzSmxMMk53ZFM5bWJHRm5jeTlqYUdWamEwRnVaRk5sZEZOcGVIUmxaVzVDYVhSR2JHRm5jMEZrWkU5MlpYSm1iRzkzMUFFblkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5bGFXZG9kRUpwZEV4dllXUlRlVzVqUTNsamJHVnoxUUVpWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKdmRHRjBaVUo1ZEdWU2FXZG9kTllCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE1IalhBUnRqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJEWVhKeWVVWnNZV2ZZQVMxamIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmNtOTBZWFJsUW5sMFpVeGxablJVYUhKdmRXZG9RMkZ5Y25uWkFTRmpiM0psTDNCdmNuUmhZbXhsTDNCdmNuUmhZbXhsTDJrNFVHOXlkR0ZpYkdYYUFTSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y21Wc1lYUnBkbVZLZFcxdzJ3RXVZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM0p2ZEdGMFpVSjVkR1ZTYVdkb2RGUm9jbTkxWjJoRFlYSnllZHdCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE1YamRBUnBqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJhWlhKdlJteGhaOTRCSDJOdmNtVXZZM0IxTDJac1lXZHpMMmRsZEVoaGJHWkRZWEp5ZVVac1lXZmZBUjVqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJUZFdKMGNtRmpkRVpzWVdmZ0FSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVEo0NFFFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXplT0lCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE5IampBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRWNDVBRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1UyZU9VQkcyTnZjbVV2WTNCMUwyTndkUzlEY0hVdVpXNWhZbXhsU0dGc2RPWUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTjNqbkFTdGpiM0psTDJOd2RTOW1iR0ZuY3k5amFHVmphMEZ1WkZObGRFVnBaMmgwUW1sMFEyRnljbmxHYkdGbjZBRWlZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDJGa1pFRlNaV2RwYzNSbGN1a0JMbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5aFpHUkJWR2h5YjNWbmFFTmhjbko1VW1WbmFYTjBaWExxQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUaDQ2d0VpWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzTjFZa0ZTWldkcGMzUmxjdXdCTG1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXpkV0pCVkdoeWIzVm5hRU5oY25KNVVtVm5hWE4wWlhMdEFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVGw0N2dFaVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMMkZ1WkVGU1pXZHBjM1JsY3U4QkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTk0YjNKQlVtVm5hWE4wWlhMd0FSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVUY0OFFFaFkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMMjl5UVZKbFoybHpkR1Z5OGdFaFkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMMk53UVZKbFoybHpkR1Z5OHdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkNlUFFCSzJOdmNtVXZiV1Z0YjNKNUwyeHZZV1F2YzJsNGRHVmxia0pwZEV4dllXUkdjbTl0UjBKTlpXMXZjbm4xQVNsamIzSmxMMk53ZFM5dmNHTnZaR1Z6TDNOcGVIUmxaVzVDYVhSTWIyRmtVM2x1WTBONVkyeGxjL1lCS0dOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXliM1JoZEdWU1pXZHBjM1JsY2t4bFpuVDNBU2xqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpTYVdkb2RQZ0JOR052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5eWIzUmhkR1ZTWldkcGMzUmxja3hsWm5SVWFISnZkV2RvUTJGeWNubjVBVFZqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpTYVdkb2RGUm9jbTkxWjJoRFlYSnllZm9CSjJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXphR2xtZEV4bFpuUlNaV2RwYzNSbGN2c0JNbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRkpwWjJoMFFYSnBkR2h0WlhScFkxSmxaMmx6ZEdWeS9BRXJZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNOM1lYQk9hV0ppYkdWelQyNVNaV2RwYzNSbGN2MEJMMk52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRkpwWjJoMFRHOW5hV05oYkZKbFoybHpkR1Z5L2dFblkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM1JsYzNSQ2FYUlBibEpsWjJsemRHVnkvd0VtWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzTmxkRUpwZEU5dVVtVm5hWE4wWlhLQUFpRmpiM0psTDJOd2RTOWpZazl3WTI5a1pYTXZhR0Z1Wkd4bFEySlBjR052WkdXQkFoOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVU40Z2dJb1kyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmMyVjBTVzUwWlhKeWRYQjBjNE1DSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFJIaUVBaDlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVWNGhRSWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1ZHZUlZQ0htTnZjbVV2WTNCMUwyOXdZMjlrWlhNdlpYaGxZM1YwWlU5d1kyOWtaWWNDSUdOdmNtVXZZM0IxTDJOd2RTOURjSFV1WlhocGRFaGhiSFJCYm1SVGRHOXdpQUlaWTI5eVpTOWpjSFV2WTNCMUwwTndkUzVwYzBoaGJIUmxaSWtDTFdOdmNtVXZiV1Z0YjNKNUwzTjBiM0psTDNOcGVIUmxaVzVDYVhSVGRHOXlaVWx1ZEc5SFFrMWxiVzl5ZVlvQ0syTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwxOW9ZVzVrYkdWSmJuUmxjbkoxY0hTTEFpcGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OWphR1ZqYTBsdWRHVnljblZ3ZEhPTUFocGpiM0psTDJWNFpXTjFkR1V2ZEhKaFkydFRkR1Z3YzFKaGJvMENHR052Y21VdlpYaGxZM1YwWlM5bGVHVmpkWFJsVTNSbGNJNENKV052Y21VdlkzQjFMMk53ZFM5RGNIVXVUVUZZWDBOWlEweEZVMTlRUlZKZlJsSkJUVVdQQWpCamIzSmxMM052ZFc1a0wzTnZkVzVrTDJkbGRFNTFiV0psY2s5bVUyRnRjR3hsYzBsdVFYVmthVzlDZFdabVpYS1FBaUpqYjNKbEwyVjRaV04xZEdVdlpYaGxZM1YwWlZWdWRHbHNRMjl1WkdsMGFXOXVrUUlaWTI5eVpTOWxlR1ZqZFhSbEwyVjRaV04xZEdWR2NtRnRaWklDSW1OdmNtVXZaWGhsWTNWMFpTOWxlR1ZqZFhSbFRYVnNkR2x3YkdWR2NtRnRaWE9UQWlaamIzSmxMMlY0WldOMWRHVXZaWGhsWTNWMFpVWnlZVzFsUVc1a1EyaGxZMnRCZFdScGI1UUNLR052Y21VdlpYaGxZM1YwWlM5bGVHVmpkWFJsUm5KaGJXVlZiblJwYkVKeVpXRnJjRzlwYm5TVkFpQmpiM0psTDJONVkyeGxjeTluWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEpZQ0dHTnZjbVV2WTNsamJHVnpMMmRsZEVONVkyeGxVMlYwYzVjQ0ZXTnZjbVV2WTNsamJHVnpMMmRsZEVONVkyeGxjNWdDTkdOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5ZloyVjBTbTk1Y0dGa1FuVjBkRzl1VTNSaGRHVkdjbTl0UW5WMGRHOXVTV1NaQWpSamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdlgzTmxkRXB2ZVhCaFpFSjFkSFJ2YmxOMFlYUmxSbkp2YlVKMWRIUnZia2xrbWdJeFkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmNtVnhkV1Z6ZEVwdmVYQmhaRWx1ZEdWeWNuVndkSnNDSldOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5ZmNISmxjM05LYjNsd1lXUkNkWFIwYjI2Y0FpZGpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZYM0psYkdWaGMyVktiM2x3WVdSQ2RYUjBiMjZkQWlGamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdmMyVjBTbTk1Y0dGa1UzUmhkR1dlQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja0dmQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja0tnQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja09oQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja1NpQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja1dqQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja2lrQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja3lsQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja2FtQWlaamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJRY205bmNtRnRRMjkxYm5SbGNxY0NKR052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGTjBZV05yVUc5cGJuUmxjcWdDTG1OdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRTl3WTI5a1pVRjBVSEp2WjNKaGJVTnZkVzUwWlhLcEFoOWpiM0psTDJSbFluVm5MMlJsWW5WbkxXZHlZWEJvYVdOekwyZGxkRXhacWdJM1kyOXlaUzlrWldKMVp5OWtaV0oxWnkxbmNtRndhR2xqY3k5a2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVhc0NOMk52Y21VdlozSmhjR2hwWTNNdmRHbHNaWE12WkhKaGQxQnBlR1ZzYzBaeWIyMU1hVzVsVDJaVWFXeGxmSFJ5WVcxd2IyeHBibVdzQWpKamIzSmxMMlJsWW5WbkwyUmxZblZuTFdkeVlYQm9hV056TDJSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllYTBDSFdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0ZEdsdFpYSXZaMlYwUkVsV3JnSWVZMjl5WlM5a1pXSjFaeTlrWldKMVp5MTBhVzFsY2k5blpYUlVTVTFCcndJZFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxMGFXMWxjaTluWlhSVVRVR3dBaDFqYjNKbEwyUmxZblZuTDJSbFluVm5MWFJwYldWeUwyZGxkRlJCUTdFQ0JYTjBZWEowc2dJeFkyOXlaUzlsZUdWamRYUmxMMlY0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOThkSEpoYlhCdmJHbHVaYk1DQ0g1elpYUmhjbWRqdEFJdFkyOXlaUzlsZUdWamRYUmxMMlY0WldOMWRHVlZiblJwYkVOdmJtUnBkR2x2Ym54MGNtRnRjRzlzYVc1bHRRSkNZMjl5WlM5a1pXSjFaeTlrWldKMVp5MW5jbUZ3YUdsamN5OWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllWHgwY21GdGNHOXNhVzVsQURNUWMyOTFjbU5sVFdGd2NHbHVaMVZTVENGamIzSmxMMlJwYzNRdlkyOXlaUzUxYm5SdmRXTm9aV1F1ZDJGemJTNXRZWEE9Iik6CiJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvd3x8InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZj9hd2FpdCBFKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmZoQmdDWDkvZjM5L2YzOS9md0JnQUFCZ0FYOEJmMkFDZjM4QVlBRi9BR0FDZjM4QmYyQUFBWDlnQTM5L2Z3Ri9ZQU4vZjM4QVlBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCSDkvZjM4QVlBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FBTzRBcllDQWdJQ0FnRUJBd0VCQVFFQkFRRUJBUVVFQkFFQkJBRUJBUUFHQlFNQkFRRUJBUUVCQVFFQkFRRUNBUVFCQVFRQkFRRUJBUUVCQVFFQkJnWUdBZ1lHQlFVTEJRVUZCUXNLQlFVRkJ3VUhCd3dLRFFrSkNBZ0RCQUVCQVFZR0JBRUdCZ0VCQVFFR0JBRUJBUUVCQWdJQ0FnSUNBUVVDQmdFQ0JnRUNBZ1lHQWdZR0JnVU9DQVFDQWdRRUFRSUdBZ0lEQkFRRUJBUUVCQVFFQkFRRUJBUUVBUVFCQkFFRUFRUUVCQVVFQkFZR0JBZ0RBd0VDQlFFRUFRUUVCQVFGQXdnQkFRRUVBUVFFQmdZR0F3VUVBd1FFQkFJREF3Z0NBZ0lHQWdJRUFnSUdCZ1lDQWdJQ0FnRUNBd1FFQWdRRUFnUUVBZ1FFQWdJQ0FnSUNBZ0lDQWdJRkJ3SUNCQUlDQWdJQkJnTUVCZ1FHQmdZSEJnSUNBZ1lHQmdJREFRUUVEd1lHQmdZR0JnWUdCZ1lHQmdRTUFRWUdCZ1lCQWdRSEJBVURBUUFBQnBNTGhRSi9BRUVBQzM4QVFZQ0FyQVFMZndCQml3RUxmd0JCQUF0L0FFR0FDQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVILy93TUxmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FrQVFMZndCQmdPZ2ZDMzhBUVlDUUJBdC9BRUdBQkF0L0FFR0FvQVFMZndCQmdMZ0JDMzhBUVlEWUJRdC9BRUdBMkFVTGZ3QkJnSmdPQzM4QVFZQ0FEQXQvQUVHQW1Cb0xmd0JCZ0lBSkMzOEFRWUNZSXd0L0FFR0E0QUFMZndCQmdQZ2pDMzhBUVlDQUNBdC9BRUdBK0NzTGZ3QkJnSUFJQzM4QVFZRDRNd3QvQUVHQWlQZ0RDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQnovNERDMzhCUVFBTGZ3RkI4UDREQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFmOEFDMzhCUWY4QUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVlEM0FndC9BVUdBZ0FnTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhWL2dNTGZ3RkIwZjREQzM4QlFkTCtBd3QvQVVIVC9nTUxmd0ZCMVA0REMzOEJRZWorQXd0L0FVSHIvZ01MZndGQjZmNERDMzhCUVFBTGZ3QkJnSUNzQkF0L0FFR0FDQXQvQUVHQUNBdC9BRUdBRUF0L0FFSC8vd01MZndCQmdKQUVDMzhBUVlDUUJBdC9BRUdBQkF0L0FFR0EyQVVMZndCQmdKZ09DMzhBUVlDWUdndC9BRUdBK0NNTGZ3QkJnUGdyQzM4QVFZRDRNd3NIeFE5ZEJtMWxiVzl5ZVFJQUJtTnZibVpwWndBWkRtaGhjME52Y21WVGRHRnlkR1ZrQUJvSmMyRjJaVk4wWVhSbEFDZ0piRzloWkZOMFlYUmxBRGdTWjJWMFUzUmxjSE5RWlhKVGRHVndVMlYwQURrTFoyVjBVM1JsY0ZObGRITUFPZ2huWlhSVGRHVndjd0E3RldWNFpXTjFkR1ZOZFd4MGFYQnNaVVp5WVcxbGN3Q1NBZ3hsZUdWamRYUmxSbkpoYldVQWtRSUlYM05sZEdGeVoyTUFzd0laWlhobFkzVjBaVVp5WVcxbFFXNWtRMmhsWTJ0QmRXUnBid0N5QWh0bGVHVmpkWFJsUm5KaGJXVlZiblJwYkVKeVpXRnJjRzlwYm5RQWxBSVZaWGhsWTNWMFpWVnVkR2xzUTI5dVpHbDBhVzl1QUxRQ0MyVjRaV04xZEdWVGRHVndBSTBDRkdkbGRFTjVZMnhsYzFCbGNrTjVZMnhsVTJWMEFKVUNER2RsZEVONVkyeGxVMlYwY3dDV0FnbG5aWFJEZVdOc1pYTUFsd0lPYzJWMFNtOTVjR0ZrVTNSaGRHVUFuUUlmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnQ1BBaEJqYkdWaGNrRjFaR2x2UW5WbVptVnlBRElYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERBQk5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXdFU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF3SWVRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdNYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREJCWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdVU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3WWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJ4eEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2dTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdrT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQ2hGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNTERWZFBVa3RmVWtGTlgxTkpXa1VERENaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTU5JazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVUREaGhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNEREeFJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNUUZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9BeEVRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1TR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01URkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF4UU9SbEpCVFVWZlRFOURRVlJKVDA0REZRcEdVa0ZOUlY5VFNWcEZBeFlYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERGeE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhnU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4a09WRWxNUlY5RVFWUkJYMU5KV2tVREdoSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERHdzVQUVUxZlZFbE1SVk5mVTBsYVJRTWNGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZEVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF4NFdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNZkVrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTWdGa05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0RElSSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURJaUZuWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUUFBZ3huWlhSU1pXZHBjM1JsY2tFQW5nSU1aMlYwVW1WbmFYTjBaWEpDQUo4Q0RHZGxkRkpsWjJsemRHVnlRd0NnQWd4blpYUlNaV2RwYzNSbGNrUUFvUUlNWjJWMFVtVm5hWE4wWlhKRkFLSUNER2RsZEZKbFoybHpkR1Z5U0FDakFneG5aWFJTWldkcGMzUmxja3dBcEFJTVoyVjBVbVZuYVhOMFpYSkdBS1VDRVdkbGRGQnliMmR5WVcxRGIzVnVkR1Z5QUtZQ0QyZGxkRk4wWVdOclVHOXBiblJsY2dDbkFobG5aWFJQY0dOdlpHVkJkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFLZ0NCV2RsZEV4WkFLa0NIV1J5WVhkQ1lXTnJaM0p2ZFc1a1RXRndWRzlYWVhOdFRXVnRiM0o1QUxVQ0dHUnlZWGRVYVd4bFJHRjBZVlJ2VjJGemJVMWxiVzl5ZVFDc0FnWm5aWFJFU1ZZQXJRSUhaMlYwVkVsTlFRQ3VBZ1puWlhSVVRVRUFyd0lHWjJWMFZFRkRBTEFDQm5Wd1pHRjBaUUNSQWcxbGJYVnNZWFJwYjI1VGRHVndBSTBDRW1kbGRFRjFaR2x2VVhWbGRXVkpibVJsZUFDUEFnOXlaWE5sZEVGMVpHbHZVWFZsZFdVQU1nNTNZWE50VFdWdGIzSjVVMmw2WlFQM0FSeDNZWE50UW05NVNXNTBaWEp1WVd4VGRHRjBaVXh2WTJGMGFXOXVBL2dCR0hkaGMyMUNiM2xKYm5SbGNtNWhiRk4wWVhSbFUybDZaUVA1QVIxbllXMWxRbTk1U1c1MFpYSnVZV3hOWlcxdmNubE1iMk5oZEdsdmJnUDZBUmxuWVcxbFFtOTVTVzUwWlhKdVlXeE5aVzF2Y25sVGFYcGxBL3NCRTNacFpHVnZUM1YwY0hWMFRHOWpZWFJwYjI0RC9BRWlabkpoYldWSmJsQnliMmR5WlhOelZtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnUC9BUnRuWVcxbFltOTVRMjlzYjNKUVlXeGxkSFJsVEc5allYUnBiMjREL1FFWFoyRnRaV0p2ZVVOdmJHOXlVR0ZzWlhSMFpWTnBlbVVEL2dFVlltRmphMmR5YjNWdVpFMWhjRXh2WTJGMGFXOXVBNEFDQzNScGJHVkVZWFJoVFdGd0E0RUNFM052ZFc1a1QzVjBjSFYwVEc5allYUnBiMjREZ2dJUloyRnRaVUo1ZEdWelRHOWpZWFJwYjI0RGhBSVVaMkZ0WlZKaGJVSmhibXR6VEc5allYUnBiMjREZ3dJSUFyRUNDdGpNQWJZQ0t3RUNmeU10SVFFakxrVWlBZ1JBSUFGRklRSUxJQUlFUUVFQklRRUxJQUZCRG5RZ0FFR0FnQUZyYWdzUEFDTXhRUTEwSUFCQmdNQUNhMm9MdHdFQkFuOENRQUpBQWtBQ1FBSkFBa0FDUUNBQVFReDFJZ0loQVNBQ1JRMEFBa0FnQVVFQmF3NE5BUUVCQWdJQ0FnTURCQVFGQmdBTERBWUxJQUJCZ1BnemFnOExJQUFRQUVHQStETnFEd3RCQUNFQkl5OEVRQ013RUFOQkFYRWhBUXNnQUVHQWtINXFJQUZCRFhScUR3c2dBQkFCUVlENEsyb1BDeUFBUVlDUWZtb1BDMEVBSVFFakx3UkFJeklRQTBFSGNTRUJDeUFCUVFGSUJFQkJBU0VCQ3lBQUlBRkJESFJxUVlEd2ZXb1BDeUFBUVlCUWFnc0pBQ0FBRUFJdEFBQUxtUUVBUVFBa00wRUFKRFJCQUNRMVFRQWtOa0VBSkRkQkFDUTRRUUFrT1VFQUpEcEJBQ1E3UVFBa1BFRUFKRDFCQUNRK1FRQWtQMEVBSkVCQkFDUkJRUUFrUWlNdkJFQkJFU1EwUVlBQkpEdEJBQ1ExUVFBa05rSC9BU1EzUWRZQUpEaEJBQ1E1UVEwa09nVkJBU1EwUWJBQkpEdEJBQ1ExUVJNa05rRUFKRGRCMkFFa09FRUJKRGxCelFBa09ndEJnQUlrUFVIKy93TWtQQXVrQVFFQ2YwRUFKRU5CQVNSRVFjY0NFQU1oQVVFQUpFVkJBQ1JHUVFBa1IwRUFKRWhCQUNRdUlBRUVRQ0FCUVFGT0lnQUVRQ0FCUVFOTUlRQUxJQUFFUUVFQkpFWUZJQUZCQlU0aUFBUkFJQUZCQmt3aEFBc2dBQVJBUVFFa1J3VWdBVUVQVGlJQUJFQWdBVUVUVENFQUN5QUFCRUJCQVNSSUJTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQUVRRUVCSkM0TEN3c0xCVUVCSkVVTFFRRWtMVUVBSkRFTEN3QWdBQkFDSUFFNkFBQUxMd0JCMGY0RFFmOEJFQVpCMHY0RFFmOEJFQVpCMC80RFFmOEJFQVpCMVA0RFFmOEJFQVpCMWY0RFFmOEJFQVlMbUFFQVFRQWtTVUVBSkVwQkFDUkxRUUFrVEVFQUpFMUJBQ1JPUVFBa1R5TXZCRUJCa0FFa1MwSEEvZ05Ca1FFUUJrSEIvZ05CZ1FFUUJrSEUvZ05Ca0FFUUJrSEgvZ05CL0FFUUJnVkJrQUVrUzBIQS9nTkJrUUVRQmtIQi9nTkJoUUVRQmtIRy9nTkIvd0VRQmtISC9nTkIvQUVRQmtISS9nTkIvd0VRQmtISi9nTkIvd0VRQmd0QnovNERRUUFRQmtIdy9nTkJBUkFHQzA4QUl5OEVRRUhvL2dOQndBRVFCa0hwL2dOQi93RVFCa0hxL2dOQndRRVFCa0hyL2dOQkRSQUdCVUhvL2dOQi93RVFCa0hwL2dOQi93RVFCa0hxL2dOQi93RVFCa0hyL2dOQi93RVFCZ3NMTHdCQmtQNERRWUFCRUFaQmtmNERRYjhCRUFaQmt2NERRZk1CRUFaQmsvNERRY0VCRUFaQmxQNERRYjhCRUFZTExBQkJsZjREUWY4QkVBWkJsdjREUVQ4UUJrR1gvZ05CQUJBR1FaaitBMEVBRUFaQm1mNERRYmdCRUFZTE1nQkJtdjREUWY4QUVBWkJtLzREUWY4QkVBWkJuUDREUVo4QkVBWkJuZjREUVFBUUJrR2UvZ05CdUFFUUJrRUJKR0FMTFFCQm4vNERRZjhCRUFaQm9QNERRZjhCRUFaQm9mNERRUUFRQmtHaS9nTkJBQkFHUWFQK0EwRy9BUkFHQ3pnQVFROGtZVUVQSkdKQkR5UmpRUThrWkVFQUpHVkJBQ1JtUVFBa1owRUFKR2hCL3dBa2FVSC9BQ1JxUVFFa2EwRUJKR3hCQUNSdEMyY0FRUUFrVUVFQUpGRkJBQ1JTUVFFa1UwRUJKRlJCQVNSVlFRRWtWa0VCSkZkQkFTUllRUUVrV1VFQkpGcEJBU1JiUVFBa1hFRUFKRjFCQUNSZVFRQWtYeEFLRUFzUURCQU5RYVQrQTBIM0FCQUdRYVgrQTBIekFSQUdRYWIrQTBIeEFSQUdFQTRMRFFBZ0FVRUJJQUIwY1VFQVJ3c21BRUVBSUFBUUVDUnVRUUVnQUJBUUpHOUJBaUFBRUJBa2NFRUVJQUFRRUNSeElBQWtjZ3NtQUVFQUlBQVFFQ1J6UVFFZ0FCQVFKSFJCQWlBQUVCQWtkVUVFSUFBUUVDUjJJQUFrZHdzYkFFRUFFQkZCLy84REkzSVFCa0hoQVJBU1FZLytBeU4zRUFZTFVnQkJBQ1I0UVFBa2VVRUFKSHBCQUNSN1FRQWtmRUVBSkgxQkFDUitRUUFrZnlNdkJFQkJoUDREUVI0UUJrR2dQU1I1QlVHRS9nTkJxd0VRQmtITTF3SWtlUXRCaC80RFFmZ0JFQVpCK0FFa2ZRc0pBQ0FBUVFGeEpDTUxGUUJCZ0tqV3VRY2tnQUZCQUNTQkFVRUFKSUlCQ3hVQVFZQ28xcmtISklNQlFRQWtoQUZCQUNTRkFRdlBBUUVDZjBIREFoQURJZ0ZCd0FGR0lnQkZCRUFqSlFSL0lBRkJnQUZHQlNNbEN5RUFDeUFBQkVCQkFTUXZCVUVBSkM4TEVBUVFCUkFIRUFnUUNSQVBFQk1RRkNNdkJFQkI4UDREUWZnQkVBWkJ6LzREUWY0QkVBWkJ6ZjREUWY0QUVBWkJnUDREUWM4QkVBWkJndjREUWZ3QUVBWkJqLzREUWVFQkVBWkI3UDREUWY0QkVBWkI5ZjREUVk4QkVBWUZRZkQrQTBIL0FSQUdRYy8rQTBIL0FSQUdRYzMrQTBIL0FSQUdRWUQrQTBIUEFSQUdRWUwrQTBIK0FCQUdRWS8rQTBIaEFSQUdDMEVBRUJVUUZoQVhDNTBCQUNBQVFRQktCRUJCQVNRa0JVRUFKQ1FMSUFGQkFFb0VRRUVCSkNVRlFRQWtKUXNnQWtFQVNnUkFRUUVrSmdWQkFDUW1DeUFEUVFCS0JFQkJBU1FuQlVFQUpDY0xJQVJCQUVvRVFFRUJKQ2dGUVFBa0tBc2dCVUVBU2dSQVFRRWtLUVZCQUNRcEN5QUdRUUJLQkVCQkFTUXFCVUVBSkNvTElBZEJBRW9FUUVFQkpDc0ZRUUFrS3dzZ0NFRUFTZ1JBUVFFa0xBVkJBQ1FzQ3hBWUN3d0FJeU1FUUVFQkR3dEJBQXNPQUNBQVFZQUlhaUFCUVRKc2Fnc1pBQ0FCUVFGeEJFQWdBRUVCT2dBQUJTQUFRUUE2QUFBTEM2TUJBRUVBUVFBUUd5TTBPZ0FBUVFGQkFCQWJJelU2QUFCQkFrRUFFQnNqTmpvQUFFRURRUUFRR3lNM09nQUFRUVJCQUJBYkl6ZzZBQUJCQlVFQUVCc2pPVG9BQUVFR1FRQVFHeU02T2dBQVFRZEJBQkFiSXpzNkFBQkJDRUVBRUJzalBEc0JBRUVLUVFBUUd5TTlPd0VBUVF4QkFCQWJJejQyQWdCQkVVRUFFQnNqUHhBY1FSSkJBQkFiSTBBUUhFRVRRUUFRR3lOQkVCeEJGRUVBRUJzalFoQWNDeUVBUVFCQkFSQWJJMG8yQWdCQkJFRUJFQnNqaGdFNkFBQkJ4UDRESTBzUUJnc1lBRUVBUVFJUUd5T0hBUkFjUVFGQkFoQWJJNGdCRUJ3TEF3QUJDMTRBUVFCQkJCQWJJeTA3QVFCQkFrRUVFQnNqTVRzQkFFRUVRUVFRR3lOREVCeEJCVUVFRUJzalJCQWNRUVpCQkJBYkkwVVFIRUVIUVFRUUd5TkdFQnhCQ0VFRUVCc2pSeEFjUVFsQkJCQWJJMGdRSEVFS1FRUVFHeU11RUJ3TE5BQkJBRUVGRUJzamVEWUNBRUVFUVFVUUd5TjVOZ0lBUVFoQkJSQWJJMzRRSEVFTFFRVVFHeU4vRUJ4QmhmNERJM29RQmdzakFFRUFRUVlRR3lOY05nSUFRUVJCQmhBYkkxMDZBQUJCQlVFR0VCc2pYam9BQUF0NEFFRUFRUWNRR3lPSkFSQWNRUUZCQnhBYkk0b0JOZ0lBUVFWQkJ4QWJJNHNCTmdJQVFRbEJCeEFiSTR3Qk5nSUFRUTVCQnhBYkk0MEJOZ0lBUVJOQkJ4QWJJNDRCT2dBQVFSUkJCeEFiSTQ4Qk9nQUFRUmxCQnhBYkk1QUJFQnhCR2tFSEVCc2prUUUyQWdCQkgwRUhFQnNqa2dFN0FRQUxWUUJCQUVFSUVCc2prd0VRSEVFQlFRZ1FHeU9VQVRZQ0FFRUZRUWdRR3lPVkFUWUNBRUVKUVFnUUd5T1dBVFlDQUVFT1FRZ1FHeU9YQVRZQ0FFRVRRUWdRR3lPWUFUb0FBRUVVUVFnUUd5T1pBVG9BQUFzeEFFRUFRUWtRR3lPYUFSQWNRUUZCQ1JBYkk1c0JOZ0lBUVFWQkNSQWJJNXdCTmdJQVFRbEJDUkFiSTUwQk93RUFDMGtBUVFCQkNoQWJJNTRCRUJ4QkFVRUtFQnNqbndFMkFnQkJCVUVLRUJzam9BRTJBZ0JCQ1VFS0VCc2pvUUUyQWdCQkRrRUtFQnNqb2dFMkFnQkJFMEVLRUJzam93RTdBUUFMSEFBUUhSQWVFQjhRSUJBaEVDSVFJeEFrRUNVUUpoQW5RUUFRRlFzU0FDQUFMUUFBUVFCS0JFQkJBUThMUVFBTG93RUFRUUJCQUJBYkxRQUFKRFJCQVVFQUVCc3RBQUFrTlVFQ1FRQVFHeTBBQUNRMlFRTkJBQkFiTFFBQUpEZEJCRUVBRUJzdEFBQWtPRUVGUVFBUUd5MEFBQ1E1UVFaQkFCQWJMUUFBSkRwQkIwRUFFQnN0QUFBa08wRUlRUUFRR3k4QkFDUThRUXBCQUJBYkx3RUFKRDFCREVFQUVCc29BZ0FrUGtFUlFRQVFHeEFwSkQ5QkVrRUFFQnNRS1NSQVFSTkJBQkFiRUNra1FVRVVRUUFRR3hBcEpFSUxTZ0JCQnlBQUVCQWtwQUZCQmlBQUVCQWtwUUZCQlNBQUVCQWtwZ0ZCQkNBQUVCQWtwd0ZCQXlBQUVCQWtxQUZCQWlBQUVCQWtxUUZCQVNBQUVCQWtxZ0ZCQUNBQUVCQWtxd0VMS1FCQkFFRUJFQnNvQWdBa1NrRUVRUUVRR3kwQUFDU0dBVUhFL2dNUUF5UkxRY0QrQXhBREVDc0xLQUJCQUVFQ0VCc1FLU1NIQVVFQlFRSVFHeEFwSklnQlFmLy9BeEFERUJGQmovNERFQU1RRWdzZkFDQUFRZjhCY3lTc0FVRUVJNndCRUJBa3JRRkJCU09zQVJBUUpLNEJDd29BUVlEK0F4QURFQzRMWGdCQkFFRUVFQnN2QVFBa0xVRUNRUVFRR3k4QkFDUXhRUVJCQkJBYkVDa2tRMEVGUVFRUUd4QXBKRVJCQmtFRUVCc1FLU1JGUVFkQkJCQWJFQ2trUmtFSVFRUVFHeEFwSkVkQkNVRUVFQnNRS1NSSVFRcEJCQkFiRUNra0xndEVBRUVBUVFVUUd5Z0NBQ1I0UVFSQkJSQWJLQUlBSkhsQkNFRUZFQnNRS1NSK1FRdEJCUkFiRUNra2YwR0YvZ01RQXlSNlFZYitBeEFESkh0QmgvNERFQU1rZlFzR0FFRUFKRjhMSlFCQkFFRUdFQnNvQWdBa1hFRUVRUVlRR3kwQUFDUmRRUVZCQmhBYkxRQUFKRjRRTWd0NEFFRUFRUWNRR3hBcEpJa0JRUUZCQnhBYktBSUFKSW9CUVFWQkJ4QWJLQUlBSklzQlFRbEJCeEFiS0FJQUpJd0JRUTVCQnhBYktBSUFKSTBCUVJOQkJ4QWJMUUFBSkk0QlFSUkJCeEFiTFFBQUpJOEJRUmxCQnhBYkVDa2trQUZCR2tFSEVCc29BZ0Fra1FGQkgwRUhFQnN2QVFBa2tnRUxWUUJCQUVFSUVCc1FLU1NUQVVFQlFRZ1FHeWdDQUNTVUFVRUZRUWdRR3lnQ0FDU1ZBVUVKUVFnUUd5Z0NBQ1NXQVVFT1FRZ1FHeWdDQUNTWEFVRVRRUWdRR3kwQUFDU1lBVUVVUVFnUUd5MEFBQ1NaQVFzeEFFRUFRUWtRR3hBcEpKb0JRUUZCQ1JBYktBSUFKSnNCUVFWQkNSQWJLQUlBSkp3QlFRbEJDUkFiTHdFQUpKMEJDMGtBUVFCQkNoQWJFQ2trbmdGQkFVRUtFQnNvQWdBa253RkJCVUVLRUJzb0FnQWtvQUZCQ1VFS0VCc29BZ0Frb1FGQkRrRUtFQnNvQWdBa29nRkJFMEVLRUJzdkFRQWtvd0VMSUFBUUtoQXNFQzBRTHhBd0VERVFNeEEwRURVUU5oQTNRUUFRRlJBV0VCY0xCUUFqZ3dFTEJRQWpoQUVMQlFBamhRRUxDUUFnQUVILy93TnhDeVlBSXpNRVFDTkxRWmtCUmdSQVFRZ1BDMEdRQnc4TEkwdEJtUUZHQkVCQkJBOExRY2dEQ3dRQUVEMExGUUFnQUVHQWtINXFJQUZCQVhGQkRYUnFMUUFBQ3c0QUlBRkJvQUZzSUFCcVFRTnNDeFVBSUFBZ0FSQkFRWURZQldvZ0Ftb2dBem9BQUFzTEFDQUJRYUFCYkNBQWFnc1FBQ0FBSUFFUVFrR0FvQVJxTFFBQUN3MEFJQUZCQVNBQWRFRi9jM0VMQ2dBZ0FVRUJJQUIwY2dzckFRRi9JQUpCQTNFaEJDQURRUUZ4QkVCQkFpQUVFRVVoQkFzZ0FDQUJFRUpCZ0tBRWFpQUVPZ0FBQzY0Q0FRTi9JQUZCQUVvaUF3UkFJQUJCQ0VvaEF3c2dBd1JBSUFZanNBRkdJUU1MSUFNRVFDQUFJN0VCUmlFREN5QURCRUJCQUNFRFFRQWhCa0VGSUFSQkFXc1FBeEFRQkVCQkFTRURDMEVGSUFRUUF4QVFCRUJCQVNFR0N3SkFRUUFoQkFOQUlBUkJDRTROQVNBRElBWkhCRUJCQnlBRWF5RUVDeUFBSUFScVFhQUJUQVJBSUFCQkNDQUVhMnNoQ0NBQUlBUnFJQUVRUUVHQTJBVnFJUWtDUUVFQUlRVURRQ0FGUVFOT0RRRWdBQ0FFYWlBQklBVWdDU0FGYWkwQUFCQkJJQVZCQVdvaEJRd0FBQXNBQ3lBQUlBUnFJQUZCQWlBSUlBRVFReUlGRUVSQkFpQUZFQkFRUmlBSFFRRnFJUWNMSUFSQkFXb2hCQXdBQUFzQUN3VWdCaVN3QVFzZ0FDT3hBVTRFUUNBQVFRaHFKTEVCSUFBZ0FrRUlieUlHU0FSQUk3RUJJQVpxSkxFQkN3c2dCd3M0QVFGL0lBQkJnSkFDUmdSQUlBRkJnQUZxSVFKQkJ5QUJFQkFFUUNBQlFZQUJheUVDQ3lBQUlBSkJCSFJxRHdzZ0FDQUJRUVIwYWdza0FRRi9JQUJCUDNFaEFpQUJRUUZ4QkVBZ0FrRkFheUVDQ3lBQ1FZQ1FCR290QUFBTEVnQWdBRUgvQVhGQkNIUWdBVUgvQVhGeUN5QUJBWDhnQUVFRGRDQUJRUUYwYWlJRFFRRnFJQUlRU1NBRElBSVFTUkJLQ3hVQUlBRkJIeUFBUVFWc0lnQjBjU0FBZFVFRGRBdFpBQ0FDUVFGeFJRUkFJQUVRQXlBQVFRRjBkVUVEY1NFQUMwSHlBU0VCQWtBQ1FBSkFBa0FDUUNBQVJRMEVBa0FnQUVFQmF3NERBZ01FQUFzTUJBQUxBQXRCb0FFaEFRd0NDMEhZQUNFQkRBRUxRUWdoQVFzZ0FRc05BQ0FCSUFKc0lBQnFRUU5zQzZzQ0FRWi9JQUVnQUJCSUlBVkJBWFJxSWdBZ0FoQS9JUkVnQUVFQmFpQUNFRDhoRWdKQUlBTWhBQU5BSUFBZ0JFb05BU0FHSUFBZ0EydHFJZzRnQ0VnRVFDQUFJUUVnREVFQVNDSUNSUVJBUVFVZ0RCQVFSU0VDQ3lBQ0JFQkJCeUFCYXlFQkMwRUFJUUlnQVNBU0VCQUVRRUVDSVFJTElBRWdFUkFRQkVBZ0FrRUJhaUVDQ3lBTVFRQk9CSDlCQUNBTVFRZHhJQUpCQUJCTElnVVFUQ0VQUVFFZ0JSQk1JUUZCQWlBRkVFd0ZJQXRCQUV3RVFFSEgvZ01oQ3dzZ0FpQUxJQW9RVFNJRklROGdCU0lCQ3lFRklBa2dEaUFISUFnUVRtb2lFQ0FQT2dBQUlCQkJBV29nQVRvQUFDQVFRUUpxSUFVNkFBQkJBQ0VCSUF4QkFFNEVRRUVISUF3UUVDRUJDeUFPSUFjZ0FpQUJFRVlnRFVFQmFpRU5DeUFBUVFGcUlRQU1BQUFMQUFzZ0RRdUZBUUVEZnlBRFFRaHZJUU1nQUVVRVFDQUNJQUpCQ0cxQkEzUnJJUWNMUVFjaENDQUFRUWhxUWFBQlNnUkFRYUFCSUFCcklRZ0xRWDhoQWlNdkJFQkJBeUFFUVFFUVB5SUNRZjhCY1JBUUJFQkJBU0VKQzBFR0lBSVFFQVJBUVFjZ0Eyc2hBd3NMSUFZZ0JTQUpJQWNnQ0NBRElBQWdBVUdnQVVHQTJBVkJBRUVBSUFJUVR3dmRBUUFnQlNBR0VFZ2hCaUFFUVFFUVB5RUVJQU5CQ0c4aEEwRUdJQVFRRUFSQVFRY2dBMnNoQXd0QkFDRUZRUU1nQkJBUUJFQkJBU0VGQ3lBR0lBTkJBWFJxSWdNZ0JSQS9JUVlnQTBFQmFpQUZFRDhoQlNBQ1FRaHZJUU5CQlNBRUVCQkZCRUJCQnlBRGF5RURDMEVBSVFJZ0F5QUZFQkFFUUVFQ0lRSUxJQU1nQmhBUUJFQWdBa0VCYWlFQ0MwRUFJQVJCQjNFZ0FrRUFFRXNpQXhCTUlRVkJBU0FERUV3aEJrRUNJQU1RVENFRElBQWdBVUVBSUFVUVFTQUFJQUZCQVNBR0VFRWdBQ0FCUVFJZ0F4QkJJQUFnQVNBQ1FRY2dCQkFRRUVZTGZ3QWdCQ0FGRUVnZ0EwRUliMEVCZEdvaUJFRUFFRDhoQlVFQUlRTWdCRUVCYWtFQUVEOGhCRUVISUFKQkNHOXJJZ0lnQkJBUUJFQkJBaUVEQ3lBQ0lBVVFFQVJBSUFOQkFXb2hBd3NnQUNBQlFRQWdBMEhIL2dOQkFCQk5JZ0lRUVNBQUlBRkJBU0FDRUVFZ0FDQUJRUUlnQWhCQklBQWdBU0FEUVFBUVJndmNBUUVHZnlBRFFRTjFJUXNDUUFOQUlBUkJvQUZPRFFFZ0JDQUZhaUlHUVlBQ1RnUkFJQVpCZ0FKcklRWUxJQUlnQzBFRmRHb2dCa0VEZFdvaUNVRUFFRDhoQjBFQUlRb2pMQVJBSUFRZ0FDQUdJQU1nQ1NBQklBY1FSeUlJUVFCS0JFQWdCQ0FJUVFGcmFpRUVRUUVoQ2dzTEl5c0VmeUFLUlFVakt3c2lDQVJBSUFRZ0FDQUdJQU1nQ1NBQklBY1FVQ0lJUVFCS0JFQWdCQ0FJUVFGcmFpRUVDd1VnQ2tVRVFDTXZCRUFnQkNBQUlBWWdBeUFKSUFFZ0J4QlJCU0FFSUFBZ0JpQURJQUVnQnhCU0N3c0xJQVJCQVdvaEJBd0FBQXNBQ3dzc0FRSi9JMHdoQkNBQUkwMXFJZ05CZ0FKT0JFQWdBMEdBQW1zaEF3c2dBQ0FCSUFJZ0EwRUFJQVFRVXdzd0FRTi9JMDRoQXlBQUkwOGlCRWdFUUE4TElBTkJCMnNpQTBGL2JDRUZJQUFnQVNBQ0lBQWdCR3NnQXlBRkVGTUxoZ1VCRUg4Q1FFRW5JUWtEUUNBSlFRQklEUUVnQ1VFQ2RDSURRWUQ4QTJvUUF5RUNJQU5CZ2Z3RGFoQURJUXNnQTBHQy9BTnFFQU1oQkNBQ1FSQnJJUUlnQzBFSWF5RUxRUWdoQlNBQlFRRnhCRUJCRUNFRklBUkJBbTlCQVVZRVFDQUVRUUZySVFRTEN5QUFJQUpPSWdZRVFDQUFJQUlnQldwSUlRWUxJQVlFUUVFSElBTkJnL3dEYWhBRElnWVFFQ0VNUVFZZ0JoQVFJUU5CQlNBR0VCQWhEeUFBSUFKcklRSWdBd1JBSUFJZ0JXdEJmMnhCQVdzaEFndEJnSUFDSUFRUVNDQUNRUUYwYWlFRVFRQWhBaU12Qkg5QkF5QUdFQkFGSXk4TElnTUVRRUVCSVFJTElBUWdBaEEvSVJBZ0JFRUJhaUFDRUQ4aEVRSkFRUWNoQlFOQUlBVkJBRWdOQVNBRklRSWdEd1JBSUFKQkIydEJmMndoQWd0QkFDRUlJQUlnRVJBUUJFQkJBaUVJQ3lBQ0lCQVFFQVJBSUFoQkFXb2hDQXNnQ0FSQUlBdEJCeUFGYTJvaUIwRUFUaUlDQkVBZ0IwR2dBVXdoQWdzZ0FnUkFRUUFoQWtFQUlRMUJBQ0VPSXk4RWZ5T3JBVVVGSXk4TElnUUVRRUVCSVFJTElBSkZCRUFnQnlBQUVFTWlDa0VEY1NFRElBd0VmeUFEUVFCS0JTQU1DeUlFQkVCQkFTRU5CU012Qkg5QkFpQUtFQkFGSXk4TElnUUVRQ0FEUVFCS0lRUUxJQVFFUUVFQklRNExDd3NnQWtVRVFDQU5SU0lEQkg4Z0RrVUZJQU1MSVFJTElBSUVRQ012QkVCQkFDQUdRUWR4SUFoQkFSQkxJZ01RVENFRVFRRWdBeEJNSVFKQkFpQURFRXdoQXlBSElBQkJBQ0FFRUVFZ0J5QUFRUUVnQWhCQklBY2dBRUVDSUFNUVFRVkJ5UDRESVFOQkJDQUdFQkFFUUVISi9nTWhBd3NnQnlBQVFRQWdDQ0FEUVFBUVRTSUtFRUVnQnlBQVFRRWdDaEJCSUFjZ0FFRUNJQW9RUVFzTEN3c2dCVUVCYXlFRkRBQUFDd0FMQ3lBSlFRRnJJUWtNQUFBTEFBc0xiUUVDZjBHQWtBSWhBaU9uQVFSQVFZQ0FBaUVDQ3lNdkJIOGpMd1VqcXdFTElnRUVRRUdBc0FJaEFTT29BUVJBUVlDNEFpRUJDeUFBSUFJZ0FSQlVDeU9tQVFSQVFZQ3dBaUVCSTZVQkJFQkJnTGdDSVFFTElBQWdBaUFCRUZVTEk2b0JCRUFnQUNPcEFSQldDd3NsQVFGL0FrQURRQ0FBUVpBQlN3MEJJQUJCL3dGeEVGY2dBRUVCYWlFQURBQUFDd0FMQzBvQkFuOENRQU5BSUFCQmtBRk9EUUVDUUVFQUlRRURRQ0FCUWFBQlRnMEJJQUVnQUJCQ1FZQ2dCR3BCQURvQUFDQUJRUUZxSVFFTUFBQUxBQXNnQUVFQmFpRUFEQUFBQ3dBTEN3d0FRWDhrc0FGQmZ5U3hBUXNPQUNNekJFQkI4QVVQQzBINEFnc09BQ016QkVCQjhnTVBDMEg1QVFzYUFRRi9JQUJCai80REVBTVFSU0lCSkhkQmovNERJQUVRQmdzS0FFRUJKSFJCQVJCZEN3NEFJek1FUUVHdUFROExRZGNBQ3hBQUl6TUVRRUdBZ0FFUEMwR0F3QUFMTGdFQmZ5T01BVUVBU2lJQUJFQWp0Z0VoQUFzZ0FBUkFJNHdCUVFGckpJd0JDeU9NQVVVRVFFRUFKSWtCQ3dzdUFRRi9JNVlCUVFCS0lnQUVRQ08zQVNFQUN5QUFCRUFqbGdGQkFXc2tsZ0VMSTVZQlJRUkFRUUFra3dFTEN5NEJBWDhqbkFGQkFFb2lBQVJBSTdnQklRQUxJQUFFUUNPY0FVRUJheVNjQVFzam5BRkZCRUJCQUNTYUFRc0xMZ0VCZnlPaEFVRUFTaUlBQkVBanVRRWhBQXNnQUFSQUk2RUJRUUZySktFQkN5T2hBVVVFUUVFQUpKNEJDd3NpQVFGL0k1SUJJN3NCZFNFQUk3d0JCSDhqa2dFZ0FHc0ZJNUlCSUFCcUN5SUFDMFVCQW45QmxQNERFQU5CK0FGeElRRkJrLzRESUFCQi93RnhJZ0lRQmtHVS9nTWdBU0FBUVFoMUlnQnlFQVlnQWlTOUFTQUFKTDRCSTc0QlFRaDBJNzBCY2lTL0FRczVBUUovRUdVaUFFSC9EMHdpQVFSQUk3c0JRUUJLSVFFTElBRUVRQ0FBSkpJQklBQVFaaEJsSVFBTElBQkIvdzlLQkVCQkFDU0pBUXNMTHdBamtRRkJBV3Nra1FFamtRRkJBRXdFUUNPNkFTU1JBU09RQVFSL0k3b0JRUUJLQlNPUUFRc0VRQkJuQ3dzTFlBRUJmeU9MQVVFQmF5U0xBU09MQVVFQVRBUkFJOEFCSklzQkk0c0JCRUFqd1FFRWZ5T05BVUVQU0FVandRRUxJZ0FFUUNPTkFVRUJhaVNOQVFVandRRkZJZ0FFUUNPTkFVRUFTaUVBQ3lBQUJFQWpqUUZCQVdza2pRRUxDd3NMQzJBQkFYOGpsUUZCQVdza2xRRWpsUUZCQUV3RVFDUENBU1NWQVNPVkFRUkFJOE1CQkg4amx3RkJEMGdGSThNQkN5SUFCRUFqbHdGQkFXb2tsd0VGSThNQlJTSUFCRUFqbHdGQkFFb2hBQXNnQUFSQUk1Y0JRUUZySkpjQkN3c0xDd3RnQVFGL0k2QUJRUUZySktBQkk2QUJRUUJNQkVBanhBRWtvQUVqb0FFRVFDUEZBUVIvSTZJQlFROUlCU1BGQVFzaUFBUkFJNklCUVFGcUpLSUJCU1BGQVVVaUFBUkFJNklCUVFCS0lRQUxJQUFFUUNPaUFVRUJheVNpQVFzTEN3c0xqUUVCQVg4alhDQUFhaVJjSTF3UVlFNEVRQ05jRUdCckpGd0NRQUpBQWtBQ1FBSkFJMTRpQVFSQUFrQWdBVUVDYXc0R0FnQURBQVFGQUFzTUJRc1FZUkJpRUdNUVpBd0VDeEJoRUdJUVl4QmtFR2dNQXdzUVlSQmlFR01RWkF3Q0N4QmhFR0lRWXhCa0VHZ01BUXNRYVJCcUVHc0xJMTVCQVdva1hpTmVRUWhPQkVCQkFDUmVDMEVCRHd0QkFBc2RBQ1BHQVNBQWFpVEdBU09LQVNQR0FXdEJBRW9FUUVFQUR3dEJBUXVEQVFFQmZ3SkFBa0FDUUFKQUlBQkJBVWNFUUNBQUlnRkJBa1lOQVNBQlFRTkdEUUlnQVVFRVJnMEREQVFMSTJVanh3RkhCRUFqeHdFa1pVRUJEd3RCQUE4TEkyWWp5QUZIQkVBanlBRWtaa0VCRHd0QkFBOExJMmNqeVFGSEJFQWp5UUVrWjBFQkR3dEJBQThMSTJnanlnRkhCRUFqeWdFa2FFRUJEd3RCQUE4TFFRQUxIUUFqeXdFZ0FHb2t5d0VqbEFFanl3RnJRUUJLQkVCQkFBOExRUUVMS1FBanpBRWdBR29rekFFam13RWp6QUZyUVFCS0lnQUVRQ05nUlNFQUN5QUFCRUJCQUE4TFFRRUxIUUFqelFFZ0FHb2t6UUVqbndFanpRRnJRUUJLQkVCQkFBOExRUUVMSFFCQmdCQWp2d0ZyUVFKMEpJb0JJek1FUUNPS0FVRUJkQ1NLQVFzTFJRRUJmd0pBQWtBQ1FDQUFRUUZIQkVBZ0FDSUNRUUpHRFFFZ0FrRURSZzBDREFNTElBRkJnUUVRRUE4TElBRkJod0VRRUE4TElBRkIvZ0FRRUE4TElBRkJBUkFRQzM4QkFYOGppZ0VnQUdza2lnRWppZ0ZCQUV3RVFDT0tBU0VBRUhJamlnRWdBRUVBSUFCcklBQkJBRW9iYXlTS0FTT1BBVUVCYWlTUEFTT1BBVUVJVGdSQVFRQWtqd0VMQ3lPSkFRUi9JOGNCQlNPSkFRc2lBQVIvSTQwQkJVRVBEd3NoQUVFQklRRWp6Z0VqandFUWMwVUVRRUYvSVFFTElBRWdBR3hCRDJvTEVnRUJmeVBHQVNFQVFRQWt4Z0VnQUJCMEN4MEFRWUFRSTg4QmEwRUNkQ1NVQVNNekJFQWpsQUZCQVhRa2xBRUxDMzhCQVg4amxBRWdBR3NrbEFFamxBRkJBRXdFUUNPVUFTRUFFSFlqbEFFZ0FFRUFJQUJySUFCQkFFb2JheVNVQVNPWkFVRUJhaVNaQVNPWkFVRUlUZ1JBUVFBa21RRUxDeU9UQVFSL0k4Z0JCU09UQVFzaUFBUi9JNWNCQlVFUER3c2hBRUVCSVFFajBBRWptUUVRYzBVRVFFRi9JUUVMSUFFZ0FHeEJEMm9MRWdFQmZ5UExBU0VBUVFBa3l3RWdBQkIzQ3gwQVFZQVFJOUVCYTBFQmRDU2JBU016QkVBam13RkJBWFFrbXdFTEN3UUFJQUFMaUFJQkFuOGptd0VnQUdza213RWptd0ZCQUV3RVFDT2JBU0VDRUhram13RWdBa0VBSUFKcklBSkJBRW9iYXlTYkFTT2RBVUVCYWlTZEFTT2RBVUVnVGdSQVFRQWtuUUVMQzBFQUlRSWowZ0VoQUNPYUFRUi9JOGtCQlNPYUFRc2lBUVJBSTJBRVFFR2MvZ01RQTBFRmRVRVBjU0lBSk5JQlFRQWtZQXNGUVE4UEN5T2RBVUVDYlJCNlFiRCtBMm9RQXlFQkk1MEJRUUp2Qkg4Z0FVRVBjUVVnQVVFRWRVRVBjUXNoQVFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFZ0FFRUNSZzBDREFNTElBRkJCSFVoQVF3REMwRUJJUUlNQWdzZ0FVRUJkU0VCUVFJaEFnd0JDeUFCUVFKMUlRRkJCQ0VDQ3lBQ1FRQktCSDhnQVNBQ2JRVkJBQXNpQVVFUGFnc1NBUUYvSTh3QklRQkJBQ1RNQVNBQUVIc0xHd0VCZnlQVEFTUFVBWFFoQUNNekJFQWdBRUVCZENFQUN5QUFDNjhCQVFGL0k1OEJJQUJySko4Qkk1OEJRUUJNQkVBam53RWhBQkI5Sko4Qkk1OEJJQUJCQUNBQWF5QUFRUUJLRzJza253RWpvd0ZCQVhFaEFTT2pBVUVCZFVFQmNTRUFJNk1CUVFGMUpLTUJJNk1CSUFFZ0FITWlBVUVPZEhJa293RWoxUUVFUUNPakFVRy9mM0Vrb3dFam93RWdBVUVHZEhJa293RUxDeU9lQVFSL0k4b0JCU09lQVFzaUFBUi9JNklCQlVFUER3c2hBVUVBSTZNQkVCQUVmMEYvQlVFQkN5SUFJQUZzUVE5cUN4SUJBWDhqelFFaEFFRUFKTTBCSUFBUWZnc1NBQ016QkVCQmdJQ0FCQThMUVlDQWdBSUxCUUFRZ0FFTE9nQWdBRUU4UmdSQVFmOEFEd3NnQUVFOGEwR2dqUVpzSUFGc1FRaHRFSHBCb0kwR2JSQjZRVHhxUWFDTkJteEJqUEVDRUhwdEVIb1FlZ3U2QVFFQmYwRUFKR3NqVXdSL0lBQUZRUThMSVFRalZBUi9JQVFnQVdvRklBUkJEMm9MSVFRalZRUi9JQVFnQW1vRklBUkJEMm9MSVFRalZnUi9JQVFnQTJvRklBUkJEMm9MSVFRalZ3Ui9JQUFGUVE4TElRQWpXQVIvSUFBZ0FXb0ZJQUJCRDJvTElRQWpXUVIvSUFBZ0Ftb0ZJQUJCRDJvTElRQWpXZ1IvSUFBZ0Eyb0ZJQUJCRDJvTElRQkJBQ1JzUVFBa2JTQUVJMUZCQVdvUWdnRWhBU0FBSTFKQkFXb1FnZ0VoQUNBQkpHa2dBQ1JxSUFFZ0FCQktDeVVCQVg4Z0FrRUJkRUdBK0NOcUlnTWdBRUVCYWpvQUFDQURRUUZxSUFGQkFXbzZBQUFMbWdJQkJIOGdBQkJ0SWdGRkJFQkJBUkJ1SVFFTElBQVFieUlDUlFSQVFRSVFiaUVDQ3lBQUVIQWlBMFVFUUVFREVHNGhBd3NnQUJCeElnUkZCRUJCQkJCdUlRUUxJQUZCQVhFRVFCQjFKR0VMSUFKQkFYRUVRQkI0SkdJTElBTkJBWEVFUUJCOEpHTUxJQVJCQVhFRVFCQi9KR1FMSUFGQkFYRkZCRUFnQWlFQkN5QUJRUUZ4UlFSQUlBTWhBUXNnQVVFQmNVVUVRQ0FFSVFFTElBRkJBWEVFUUVFQkpHMExJMTBnQUNQV0FXeHFKRjBqWFJDQkFVNEVRQ05kRUlFQmF5UmRJMjBFZnlOdEJTTnJDeUlCUlFSQUkyd2hBUXNnQVFSQUkyRWpZaU5qSTJRUWd3RWFDeU5wUVFGcUkycEJBV29qWHhDRUFTTmZRUUZxSkY4ajF3RkJBbTBRZWtFQmF5RUJJMThnQVU0RVFDTmZRUUZySkY4TEN3c01BQ0FBUVlEK0EzRkJDSFVMQ0FBZ0FFSC9BWEVMa3dFQkJIOGdBQkIwRUhvaEFTQUFFSGNRZWlFQ0lBQVFleEI2SVFNZ0FCQitFSG9oQkNBQkpHRWdBaVJpSUFNa1l5QUVKR1FqWFNBQUk5WUJiR29rWFNOZEVJRUJUZ1JBSTEwUWdRRnJKRjBnQVNBQ0lBTWdCQkNEQVNJQUVJWUJRUUZxSUFBUWh3RkJBV29qWHhDRUFTTmZRUUZxSkY4ajF3RkJBbTBRZWtFQmF5RUFJMThnQUU0RVFDTmZRUUZySkY4TEN3c2xBUUYvSUFBUWJDRUJJeW9FZnlBQlJRVWpLZ3NpQVFSQUlBQVFoUUVGSUFBUWlBRUxDeVFBSTFBUVgwZ0VRQThMQTBBalVCQmZUZ1JBRUY4UWlRRWpVQkJmYXlSUURBRUxDd3R6QVFGL0lBQkJwdjREUmdSQVFhYitBeEFEUVlBQmNTRUJJNGtCQkg5QkFDQUJFRVVGUVFBZ0FSQkVDeG9qa3dFRWYwRUJJQUVRUlFWQkFTQUJFRVFMR2lPYUFRUi9RUUlnQVJCRkJVRUNJQUVRUkFzYUk1NEJCSDlCQXlBQkVFVUZRUU1nQVJCRUN4b2dBVUh3QUhJUEMwRi9DOFFCQVFGL0k2d0JJUUFqclFFRVFDUFlBUVIvUVFJZ0FCQkVCVUVDSUFBUVJRc2hBQ1BaQVFSL1FRQWdBQkJFQlVFQUlBQVFSUXNoQUNQYUFRUi9RUU1nQUJCRUJVRURJQUFRUlFzaEFDUGJBUVIvUVFFZ0FCQkVCVUVCSUFBUVJRc2hBQVVqcmdFRVFDUGNBUVIvUVFBZ0FCQkVCVUVBSUFBUVJRc2hBQ1BkQVFSL1FRRWdBQkJFQlVFQklBQVFSUXNoQUNQZUFRUi9RUUlnQUJCRUJVRUNJQUFRUlFzaEFDUGZBUVIvUVFNZ0FCQkVCVUVESUFBUVJRc2hBQXNMSUFCQjhBRnlDOVFDQVFGL0lBQkJnSUFDU0FSQVFYOFBDeUFBUVlDQUFrNGlBUVJBSUFCQmdNQUNTQ0VCQ3lBQkJFQkJmdzhMSUFCQmdNQURUaUlCQkVBZ0FFR0EvQU5JSVFFTElBRUVRQ0FBUVlCQWFoQUREd3NnQUVHQS9BTk9JZ0VFUUNBQVFaLzlBMHdoQVFzZ0FRUkFJNFlCUVFKSUJFQkIvd0VQQzBGL0R3c2dBRUhOL2dOR0JFQkIvd0VoQVVFQVFjMytBeEFERUJCRkJFQkJBRUgvQVJCRUlRRUxJek5GQkVCQkJ5QUJFRVFoQVFzZ0FROExJQUJCeFA0RFJnUkFJQUFqU3hBR0kwc1BDeUFBUVpEK0EwNGlBUVJBSUFCQnB2NERUQ0VCQ3lBQkJFQVFpZ0VnQUJDTEFROExJQUJCc1A0RFRpSUJCRUFnQUVHLy9nTk1JUUVMSUFFRVFCQ0tBVUYvRHdzZ0FFR0UvZ05HQkVBZ0FDTjVFSVlCSWdFUUJpQUJEd3NnQUVHRi9nTkdCRUFnQUNONkVBWWplZzhMSUFCQmovNERSZ1JBSTNkQjRBRnlEd3NnQUVHQS9nTkdCRUFRakFFUEMwRi9DeHdCQVg4Z0FCQ05BU0lCUVg5R0JFQWdBQkFERHdzZ0FVSC9BWEVMN1FJQkFuOGpSUVJBRHdzZ0FFSC9QMHdFUUNOSEJIOUJCQ0FCUWY4QmNSQVFSUVVqUndzaUFFVUVRQ0FCUVE5eElnSUVRQ0FDUVFwR0JFQkJBU1JEQ3dWQkFDUkRDd3NGSUFCQi8vOEFUQVJBSXk1RklnSkZCRUFnQUVILzN3Qk1JUUlMSUFJRVFDTkhCRUFnQVVFUGNTUXRDeUFCSVFJalJnUkFJQUpCSDNFaEFpTXRRZUFCY1NRdEJTTklCRUFnQWtIL0FIRWhBaU10UVlBQmNTUXRCU011QkVCQkFDUXRDd3NMSXkwZ0FuSWtMUVZCQUNFQ0l5MFFod0VoQXlBQlFRQktCRUJCQVNFQ0N5QUNJQU1RU2lRdEN3VWpSMFVpQXdSQUlBQkIvNzhCVENFREN5QURCRUFqUmdSL0kwUUZJMFlMSWdBRVFDTXRRUjl4SkMwakxTQUJRZUFCY1hJa0xROExJMGdFUUNBQlFRaE9JZ01FUUNBQlFReE1JUU1MQ3lBQklRTWpMZ1IvSUFOQkQzRUZJQU5CQTNFTElnTWtNUVVqUjBVaUF3UkFJQUJCLy84QlRDRURDeUFEQkVBalJnUkFRUUFnQVVIL0FYRVFFQVJBUVFFa1JBVkJBQ1JFQ3dzTEN3c0xDeDhBSUFCQjhBQnhRUVIxSkxvQlFRTWdBQkFRSkx3QklBQkJCM0VrdXdFTEN3QkJCeUFBRUJBa3lRRUxId0FnQUVFR2RVRURjU1RPQVNBQVFUOXhKT0FCUWNBQUkrQUJheVNNQVFzZkFDQUFRUVoxUVFOeEpOQUJJQUJCUDNFazRRRkJ3QUFqNFFGckpKWUJDeEVBSUFBazRnRkJnQUlqNGdGckpKd0JDeFFBSUFCQlAzRWs0d0ZCd0FBajR3RnJKS0VCQ3lvQUlBQkJCSFZCRDNFazVBRkJBeUFBRUJBa3dRRWdBRUVIY1NUQUFTQUFRZmdCY1VFQVNpVEhBUXNxQUNBQVFRUjFRUTl4Sk9VQlFRTWdBQkFRSk1NQklBQkJCM0Vrd2dFZ0FFSDRBWEZCQUVva3lBRUxEUUFnQUVFRmRVRVBjU1RtQVFzcUFDQUFRUVIxUVE5eEpPY0JRUU1nQUJBUUpNVUJJQUJCQjNFa3hBRWdBRUg0QVhGQkFFb2t5Z0VMRkFBZ0FDUzlBU08rQVVFSWRDTzlBWElrdndFTEZBQWdBQ1RvQVNQcEFVRUlkQ1BvQVhJa3p3RUxGQUFnQUNUcUFTUHJBVUVJZENQcUFYSWswUUVMaEFFQkFYOGdBRUVFZFNUVUFVRURJQUFRRUNUVkFTQUFRUWR4Sk93QkFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNQc0FTSUJCRUFDUUNBQlFRRnJEZ2NDQXdRRkJnY0lBQXNNQ0F0QkNDVFRBUThMUVJBazB3RVBDMEVnSk5NQkR3dEJNQ1RUQVE4TFFjQUFKTk1CRHd0QjBBQWswd0VQQzBIZ0FDVFRBUThMUWZBQUpOTUJDd3NnQUVFR0lBQVFFQ1MyQVNBQVFRZHhKTDRCSTc0QlFRaDBJNzBCY2lTL0FRdHFBUUYvUVFFa2lRRWpqQUZGQkVCQndBQWtqQUVMRUhJandBRWtpd0VqNUFFa2pRRWp2d0Vra2dFanVnRWtrUUVqdWdGQkFFb2lBQVJBSTdzQlFRQktJUUFMSUFBRVFFRUJKSkFCQlVFQUpKQUJDeU83QVVFQVNnUkFFR2NMSThjQlJRUkFRUUFraVFFTEN5QUFRUVlnQUJBUUpMY0JJQUJCQjNFazZRRWo2UUZCQ0hRajZBRnlKTThCQ3k0QVFRRWtrd0VqbGdGRkJFQkJ3QUFrbGdFTEVIWWp3Z0VrbFFFajVRRWtsd0VqeUFGRkJFQkJBQ1NUQVFzTElBQkJCaUFBRUJBa3VBRWdBRUVIY1NUckFTUHJBVUVJZENQcUFYSWswUUVMSndCQkFTU2FBU09jQVVVRVFFR0FBaVNjQVFzUWVVRUFKSjBCSThrQlJRUkFRUUFrbWdFTEN3c0FRUVlnQUJBUUpMa0JDemdBUVFFa25nRWpvUUZGQkVCQndBQWtvUUVMRUgwa253RWp4QUVrb0FFajV3RWtvZ0ZCLy84QkpLTUJJOG9CUlFSQVFRQWtuZ0VMQ3hNQUlBQkJCSFZCQjNFa1VTQUFRUWR4SkZJTFFnQkJCeUFBRUJBa1ZrRUdJQUFRRUNSVlFRVWdBQkFRSkZSQkJDQUFFQkFrVTBFRElBQVFFQ1JhUVFJZ0FCQVFKRmxCQVNBQUVCQWtXRUVBSUFBUUVDUlhDd29BUVFjZ0FCQVFKRnNMbEFNQkFYOENRQ0FBUWFiK0EwY2lBZ1JBSTF0RklRSUxJQUlFUUVFQUR3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUNRWkQrQTBjRVFBSkFJQUpCa2Y0RGF3NFdBd2NMRHdBRUNBd1FBZ1VKRFJFQUJnb09FaE1VRlFBTERCVUxJQUVRa0FFTUZRc2dBUkNSQVF3VUN5QUJFSklCREJNTElBRVFrd0VNRWdzZ0FSQ1VBUXdSQ3lBQkVKVUJEQkFMSUFFUWxnRU1Ed3NnQVJDWEFRd09DMEVCSkdBZ0FSQ1lBUXdOQ3lBQkVKa0JEQXdMSUFFUW1nRU1Dd3NnQVJDYkFRd0tDeUFCRUp3QkRBa0xJQUVRblFFTUNBdEJCeUFCRUJBRVFDQUJFSjRCRUo4QkN3d0hDMEVISUFFUUVBUkFJQUVRb0FFUW9RRUxEQVlMUVFjZ0FSQVFCRUFnQVJDaUFSQ2pBUXNNQlF0QkJ5QUJFQkFFUUNBQkVLUUJFS1VCQ3d3RUN5QUJFS1lCUVFFa2F3d0RDeUFCRUtjQlFRRWtiQXdDQ3lBQkVLZ0JRUWNnQVJBUVJRUkFBa0JCa1A0RElRSURRQ0FDUWFiK0EwNE5BU0FDUVFBUUJpQUNRUUZxSVFJTUFBQUxBQXNMREFFTFFRRVBDMEVCQ3h3QVFjSCtBMEVISUFCQitBRnhRY0grQXhBRFFRZHhjaEJGRUFZTFBnRUJmeUFBUVFoMElRRUNRRUVBSVFBRFFDQUFRWjhCU2cwQklBQkJnUHdEYWlBQklBQnFFQU1RQmlBQVFRRnFJUUFNQUFBTEFBdEJoQVVrcndFTEV3QWo3d0VRQXlQd0FSQURFRXBCOFA4RGNRc1hBQ1B4QVJBREkvSUJFQU1RU2tId1AzRkJnSUFDYWd1TEFRRURmeU12UlFSQUR3c2pzZ0VFZjBFSElBQVFFRVVGSTdJQkN5SUJCRUJCQUNTeUFTUHVBUkFESVFFajdnRkJCeUFCRUVVUUJnOExFS3dCSVFFUXJRRWhBa0VISUFBUVJFRUJha0VFZENFRFFRY2dBQkFRQkVCQkFTU3lBU0FESkxNQklBRWt0QUVnQWlTMUFTUHVBVUVISUFBUVJCQUdCU0FCSUFJZ0F4QytBU1B1QVVIL0FSQUdDd3NtQVFGL0lBQkJQM0VoQXlBQ1FRRnhCRUFnQTBGQWF5RURDeUFEUVlDUUJHb2dBVG9BQUFzWUFFRUhJQUFRRUFSQUlBRkJCeUFBUVFGcUVFVVFCZ3NMU2dFQ2Z5QUFJL1VCUmlJQ1JRUkFJQUFqOUFGR0lRSUxJQUlFUUVFR0lBQkJBV3NRQXhCRUlRSWdBQ1AwQVVZRVFFRUJJUU1MSUFJZ0FTQURFSzhCSUFJZ0FFRUJheEN3QVFzTENnQkJBU1IxUVFJUVhRczhBUUYvQWtBQ1FBSkFBa0FnQUFSQUlBQWlBVUVCUmcwQklBRkJBa1lOQWlBQlFRTkdEUU1NQkF0QkNROExRUU1QQzBFRkR3dEJCdzhMUVFBTEp3RUJmeU45RUxNQklnSWdBQkFRSWdBRVFDQUNJQUVRRUVVaEFBc2dBQVJBUVFFUEMwRUFDeG9BSTNwQkFXb2tlaU42UWY4QlNnUkFRUUVrZmtFQUpIb0xDMllCQW44RFFDQUJJQUJJQkVBamVTRUNJQUZCQkdvaEFTTjVRUVJxSkhramVVSC8vd05LQkVBamVVR0FnQVJySkhrTEkzd0VRQ04rQkVBamV5UjZFTElCUVFBa2ZrRUJKSDhGSTM4RVFFRUFKSDhMQ3lBQ0kza1F0QUVFUUJDMUFRc0xEQUVMQ3dzTEFDTjRFTFlCUVFBa2VBc3BBQ041SVFCQkFDUjVRWVQrQTBFQUVBWWpmQVIvSUFBamVSQzBBUVVqZkFzaUFBUkFFTFVCQ3dzYUFDTjhCRUFqZndSQUR3c2pmZ1JBUVFBa2Znc0xJQUFrZWdzYkFDQUFKSHNqZkFSL0kzOEZJM3dMQkVBamV5UjZRUUFrZndzTFdBRUNmeU44SVFGQkFpQUFFQkFrZkNBQVFRTnhJUUlnQVVVRVFDTjlFTE1CSVFBZ0FoQ3pBU0VCSTN3RVFDQUFJM2tRRUNFQUJTQUFJM2tRRUNJQUJFQWdBU041RUJBaEFBc0xJQUFFUUJDMUFRc0xJQUlrZlF2UkJRRUJmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERJQUZCQVhFUUJnd0NDeUFBUVlDQUFrZ0VRQ0FBSUFFUWp3RU1BZ3NnQUVHQWdBSk9JZ0lFUUNBQVFZREFBa2doQWdzZ0FnMEFJQUJCZ01BRFRpSUNCRUFnQUVHQS9BTklJUUlMSUFJRVFDQUFRWUJBYWlBQkVBWU1BUXNnQUVHQS9BTk9JZ0lFUUNBQVFaLzlBMHdoQWdzZ0FnUkFJNFlCUVFKSURRSU1BUXNnQUVHZy9RTk9JZ0lFUUNBQVFmLzlBMHdoQWdzZ0FnMEJJQUJCa1A0RFRpSUNCRUFnQUVHbS9nTk1JUUlMSUFJRVFCQ0tBU0FBSUFFUXFRRVBDeUFBUWJEK0EwNGlBZ1JBSUFCQnYvNERUQ0VDQ3lBQ0JFQVFpZ0VMSUFCQndQNERUaUlDQkVBZ0FFSEwvZ05NSVFJTElBSUVRQ0FBUWNEK0EwWUVRQ0FCRUNzTUFnc2dBRUhCL2dOR0JFQWdBUkNxQVF3REN5QUFRY1QrQTBZRVFFRUFKRXNnQUVFQUVBWU1Bd3NnQUVIRi9nTkdCRUFnQVNUdEFRd0NDeUFBUWNiK0EwWUVRQ0FCRUtzQkRBSUxBa0FDUUFKQUFrQWdBQ0lDUWNQK0EwY0VRQUpBSUFKQnd2NERhdzRLQWdBQUFBQUFBQUFFQXdBTERBUUxJQUVrVEF3RkN5QUJKRTBNQkFzZ0FTUk9EQU1MSUFFa1R3d0NDd3dCQ3lBQUkrNEJSZ1JBSUFFUXJnRU1BZ3NnQUNNeVJpSUNSUVJBSUFBak1FWWhBZ3NnQWdSQUk3SUJCRUFqdEFGQmdJQUJUaUlDQkVBanRBRkIvLzhCVENFQ0N5QUNSUVJBSTdRQlFZQ2dBMDRpQWdSQUk3UUJRZisvQTB3aEFnc0xJQUlOQXdzTElBQWo4d0ZPSWdJRVFDQUFJL1FCVENFQ0N5QUNCRUFnQUNBQkVMRUJEQUVMSUFCQmhQNERUaUlDQkVBZ0FFR0gvZ05NSVFJTElBSUVRQkMzQVFKQUFrQUNRQUpBSUFBaUFrR0UvZ05IQkVBQ1FDQUNRWVgrQTJzT0F3SURCQUFMREFRTElBRVF1QUVNQmdzZ0FSQzVBUXdFQ3lBQkVMb0JEQU1MSUFFUXV3RU1BZ3NNQVFzZ0FFR0EvZ05HQkVBZ0FSQXVDeUFBUVkvK0EwWUVRQ0FCRUJJTUFRc2dBRUgvL3dOR0JFQWdBUkFSREFFTFFRRVBDMEVCRHd0QkFBc1NBQ0FBSUFFUXZBRUVRQ0FBSUFFUUJnc0xhQUVEZndKQUEwQWdBeUFDVGcwQklBQWdBMm9RamdFaEJTQUJJQU5xSVFRRFFDQUVRZisvQWtvRVFDQUVRWUJBYWlFRURBRUxDeUFFSUFVUXZRRWdBMEVCYWlFRERBQUFDd0FMUVNBaEF5TXpCRUJCd0FBaEF3c2pyd0VnQXlBQ1FSQnRiR29rcndFTGJRRUJmeU95QVVVRVFBOExRUkFoQUNPekFVRVFTQVJBSTdNQklRQUxJN1FCSTdVQklBQVF2Z0VqdEFFZ0FHb2t0QUVqdFFFZ0FHb2t0UUVqc3dFZ0FHc2tzd0Vqc3dGQkFFd0VRRUVBSkxJQkkrNEJRZjhCRUFZRkkrNEJRUWNqc3dGQkVHMUJBV3NRUkJBR0N3c0tBRUVCSkhOQkFCQmRDOU1DQVFWL0k2UUJSUVJBUVFBa1NrRUFKRXRCeFA0RFFRQVFCa0VBUVFGQndmNERFQU1RUkJCRUlRTkJBQ1NHQVVIQi9nTWdBeEFHRHdzamhnRWhBU05MSWdOQmtBRk9CRUJCQVNFQ0JTTktFRnRPQkVCQkFpRUNCU05LRUZ4T0JFQkJBeUVDQ3dzTElBRWdBa2NFUUVIQi9nTVFBeUVBSUFJa2hnRkJBQ0VCQWtBQ1FBSkFBa0FDUUNBQ0lRUWdBa1VOQUFKQUlBUkJBV3NPQXdJREJBQUxEQVFMUVFOQkFVRUFJQUFRUkJCRUlnQVFFQ0VCREFNTFFRUkJBRUVCSUFBUVJCQkZJZ0FRRUNFQkRBSUxRUVZCQVVFQUlBQVFSQkJGSWdBUUVDRUJEQUVMUVFGQkFDQUFFRVVRUlNFQUN5QUJCRUFRWGdzZ0FrVUVRQkMvQVFzZ0FrRUJSZ1JBRU1BQkN5UHRBU0VFSUFKRklnRkZCRUFnQWtFQlJpRUJDeUFCQkVBZ0F5QUVSaUVCQ3lBQkJFQkJCa0VDSUFBUVJTSUFFQkFFUUJCZUN3VkJBaUFBRUVRaEFBdEJ3ZjRESUFBUUJnc0xiQUVCZnlPa0FRUkFJMG9nQUdva1NnTkFJMG9RUFU0RVFDTktFRDFySkVvalN5SUJRWkFCUmdSQUl5a0VRQkJZQlNBQkVGY0xFRmtRV2dVZ0FVR1FBVWdFUUNNcFJRUkFJQUVRVndzTEN5QUJRWmtCU2dSL1FRQUZJQUZCQVdvTElnRWtTd3dCQ3dzTEVNRUJDeVFBSTBrUVBrZ0VRQThMQTBBalNSQStUZ1JBRUQ0UXdnRWpTUkErYXlSSkRBRUxDd3NvQUNPQ0FTQUFhaVNDQVNPQ0FTT0FBVTRFUUNPQkFVRUJhaVNCQVNPQ0FTT0FBV3NrZ2dFTEMyWUFJNjhCUVFCS0JFQWdBQ092QVdvaEFFRUFKSzhCQ3lNK0lBQnFKRDRqUWtVRVFDTW5CRUFqU1NBQWFpUkpFTU1CQlNBQUVNSUJDeU1tQkVBalVDQUFhaVJRQlNBQUVJa0JDd3NqS0FSQUkzZ2dBR29rZUJDM0FRVWdBQkMyQVFzZ0FCREVBUXNRQUVFRUVNVUJJejFCQVdvUVBCQURDd3NBUVFRUXhRRWpQUkFEQ3hJQUVNWUJRZjhCY1JESEFVSC9BWEVRU2dzT0FFRUVFTVVCSUFBZ0FSQzlBUXN2QVFGL1FRRWdBSFFRaHdFaEFpQUJRUUJLQkVBak95QUNja0gvQVhFa093VWpPeUFDUWY4QmMzRWtPd3NqT3dzS0FFRUZJQUFReWdFYUMwNEFJQUZCQUU0RVFDQUFRUTl4SUFGQkQzRnFFSWNCUVJCeEJFQkJBUkRMQVFWQkFCRExBUXNGSUFGQkFDQUJheUFCUVFCS0cwRVBjU0FBUVE5eFN3UkFRUUVReXdFRlFRQVF5d0VMQ3dzS0FFRUhJQUFReWdFYUN3b0FRUVlnQUJES0FSb0xDZ0JCQkNBQUVNb0JHZ3NVQUNBQVFRRjBJQUJCL3dGeFFRZDJjaENIQVFzM0FRSi9JQUVRaGdFaEFpQUFRUUZxSVFNZ0FDQUJFSWNCSWdFUXZBRUVRQ0FBSUFFUUJnc2dBeUFDRUx3QkJFQWdBeUFDRUFZTEN3NEFRUWdReFFFZ0FDQUJFTkVCQzRNQkFDQUNRUUZ4QkVBZ0FFSC8vd054SWdBZ0FXb2hBaUFBSUFGeklBSnpJZ0pCRUhFRVFFRUJFTXNCQlVFQUVNc0JDeUFDUVlBQ2NRUkFRUUVRendFRlFRQVF6d0VMQlNBQUlBRnFFRHdpQWlBQVFmLy9BM0ZKQkVCQkFSRFBBUVZCQUJEUEFRc2dBQ0FCY3lBQ2MwR0FJSEVRUEFSQVFRRVF5d0VGUVFBUXl3RUxDd3NNQUVFRUVNVUJJQUFRamdFTEZBQWdBRUgvQVhGQkFYWWdBRUVIZEhJUWh3RUwwd1FCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUFrQWdBRUVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc01GQXNReUFGQi8vOERjU0lBRUlZQlFmOEJjU1ExSUFBUWh3RkIvd0Z4SkRZTUVBc2pOU00yRUVvak5CREpBUXdTQ3lNMUl6WVFTa0VCYWtILy93TnhJZ0FRaGdGQi93RnhKRFVNRFFzak5VRUJFTXdCSXpWQkFXb1Fod0VrTlNNMUJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FRd1FDeU0xUVg4UXpBRWpOVUVCYXhDSEFTUTFJelVFUUVFQUVNMEJCVUVCRU0wQkMwRUJFTTRCREE4TEVNY0JRZjhCY1NRMURBd0xJelJCZ0FGeFFZQUJSZ1JBUVFFUXp3RUZRUUFRendFTEl6UVEwQUVrTkF3TUN4RElBVUgvL3dOeEl6d1EwZ0VNQ1Fzak9TTTZFRW9pQUNNMUl6WVFTaUlCUWYvL0EzRkJBQkRUQVNBQUlBRnFFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNlFRQVF6Z0ZCQ0E4TEl6VWpOaEJLRU5RQlFmOEJjU1EwREFvTEl6VWpOaEJLUVFGckVEd2lBQkNHQVVIL0FYRWtOUXdGQ3lNMlFRRVF6QUVqTmtFQmFoQ0hBU1EySXpZRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QkRBZ0xJelpCZnhETUFTTTJRUUZyRUljQkpEWWpOZ1JBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VNQndzUXh3RkIvd0Z4SkRZTUJBc2pORUVCY1VFQVN3UkFRUUVRendFRlFRQVF6d0VMSXpRUTFRRWtOQXdFQzBGL0R3c2dBQkNIQVVIL0FYRWtOa0VJRHdzalBVRUNhaEE4SkQwTUFnc2pQVUVCYWhBOEpEME1BUXRCQUJETkFVRUFFTTRCUVFBUXl3RUxRUVFMQ2dBak8wRUVka0VCY1FzT0FDQUFRUUYwRU5jQmNoQ0hBUXNvQVFGL1FRY2dBRUVZZEVFWWRTSUJFQkFFUUVHQUFpQUFRUmgwUVJoMWEwRi9iQ0VCQ3lBQkN5TUJBWDhnQUJEWkFTRUJJejBnQVVFWWRFRVlkV29RUENROUl6MUJBV29RUENROUN4VUFJQUJCL3dGeFFRRjJFTmNCUVFkMGNoQ0hBUXVsQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFUVJ3UkFBa0FnQUVFUmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTHdSQVFRQkJ6ZjRERU5RQlFmOEJjU0lBRUJBRVFFSE4vZ05CQjBFQUlBQVFSQ0lBRUJBRWYwRUFKRE5CQnlBQUVFUUZRUUVrTTBFSElBQVFSUXNpQUJESkFVSEVBQThMQzBFQkpFSU1FUXNReUFGQi8vOERjU0lBRUlZQlFmOEJjU1EzSUFBUWh3RkIvd0Z4SkRnalBVRUNhaEE4SkQwTUVnc2pOeU00RUVvak5CREpBUXdSQ3lNM0l6Z1FTa0VCYWhBOElnQVFoZ0ZCL3dGeEpEY01EUXNqTjBFQkVNd0JJemRCQVdvUWh3RWtOeU0zQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVF3UEN5TTNRWDhRekFFak4wRUJheENIQVNRM0l6Y0VRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJEQTRMRU1jQlFmOEJjU1EzREFzTFFRQWhBQ00wUVlBQmNVR0FBVVlFUUVFQklRQUxJelFRMkFFa05Bd0xDeERIQVJEYUFVRUlEd3NqT1NNNkVFb2lBQ00zSXpnUVNpSUJRZi8vQTNGQkFCRFRBU0FBSUFGcUVEd2lBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2UVFBUXpnRkJDQThMSXpjak9CQktRZi8vQTNFUTFBRkIvd0Z4SkRRTUNRc2pOeU00RUVwQkFXc1FQQ0lBRUlZQlFmOEJjU1EzREFVTEl6aEJBUkRNQVNNNFFRRnFFSWNCSkRnak9BUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRU1Cd3NqT0VGL0VNd0JJemhCQVdzUWh3RWtPQ000QkVCQkFCRE5BUVZCQVJETkFRdEJBUkRPQVF3R0N4REhBVUgvQVhFa09Bd0RDMEVBSVFBak5FRUJjVUVCUmdSQVFRRWhBQXNqTkJEYkFTUTBEQU1MUVg4UEN5QUFFSWNCUWY4QmNTUTRRUWdQQ3lNOVFRRnFFRHdrUFF3QkN5QUFCRUJCQVJEUEFRVkJBQkRQQVF0QkFCRE5BVUVBRU00QlFRQVF5d0VMUVFRTENnQWpPMEVIZGtFQmNRc0tBQ003UVFWMlFRRnhDd29BSXp0QkJuWkJBWEVMaUFZQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVnUndSQUFrQWdBRUVoYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc1EzUUVFUUNNOVFRRnFFRHdrUFFVUXh3RVEyZ0VMUVFnUEN4RElBVUgvL3dOeElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPaU05UVFKcUVEd2tQUXdRQ3lNNUl6b1FTaUlBUWYvL0EzRWpOQkRKQVNBQVFRRnFFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNkRBOExJemtqT2hCS1FRRnFFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNlFRZ1BDeU01UVFFUXpBRWpPVUVCYWhDSEFTUTVJemtFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCREEwTEl6bEJmeERNQVNNNVFRRnJFSWNCSkRrak9RUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRU1EQXNReHdGQi93RnhKRGtNQ2dzUTNnRkJBRXNFUUVFR0lRRUxFTmNCUVFCTEJFQWdBVUhnQUhJaEFRc1Ezd0ZCQUVzRWZ5TTBJQUZyRUljQkJTTTBRUTl4UVFsTEJFQWdBVUVHY2lFQkN5TTBRWmtCU3dSQUlBRkI0QUJ5SVFFTEl6UWdBV29RaHdFTElnQUVRRUVBRU0wQkJVRUJFTTBCQ3lBQlFlQUFjUVJBUVFFUXp3RUZRUUFRendFTFFRQVF5d0VnQUNRMERBb0xFTjBCUVFCTEJFQVF4d0VRMmdFRkl6MUJBV29RUENROUMwRUlEd3NqT1NNNkVFb2lBU0FCUWYvL0EzRkJBQkRUQVNBQlFRRjBFRHdpQVJDR0FVSC9BWEVrT1NBQkVJY0JRZjhCY1NRNlFRQVF6Z0ZCQ0E4TEl6a2pPaEJLSWdGQi8vOERjUkRVQVVIL0FYRWtOQ0FCUVFGcUVEd2lBUkNHQVVIL0FYRWtPU0FCRUljQlFmOEJjU1E2REFjTEl6a2pPaEJLUVFGckVEd2lBUkNHQVVIL0FYRWtPU0FCRUljQlFmOEJjU1E2UVFnUEN5TTZRUUVRekFFak9rRUJhaENIQVNRNkl6b0VRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJEQVVMSXpwQmZ4RE1BU002UVFGckVJY0JKRG9qT2dSQVFRQVF6UUVGUVFFUXpRRUxRUUVRemdFTUJBc1F4d0ZCL3dGeEpEb01BZ3NqTkVGL2MwSC9BWEVrTkVFQkVNNEJRUUVReXdFTUFndEJmdzhMSXoxQkFXb1FQQ1E5QzBFRUMvQUVBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBQ1FDQUFRVEZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN4RFhBUVJBSXoxQkFXb1FQQ1E5QlJESEFSRGFBUXRCQ0E4TEVNZ0JRZi8vQTNFa1BDTTlRUUpxRUR3a1BRd1NDeU01SXpvUVNpSUFRZi8vQTNFak5CREpBUXdQQ3lNOFFRRnFFRHdrUEVFSUR3c2pPU002RUVvaUFFSC8vd054RU5RQklnRkJBUkRNQVNBQlFRRnFFSWNCSWdFRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QkRBNExJemtqT2hCS0lnQkIvLzhEY1JEVUFTSUJRWDhRekFFZ0FVRUJheENIQVNJQkJFQkJBQkROQVFWQkFSRE5BUXRCQVJET0FRd05DeU01SXpvUVNrSC8vd054RU1jQlFmOEJjUkRKQVF3S0MwRUFFTTRCUVFBUXl3RkJBUkRQQVF3TUN4RFhBVUVCUmdSQUVNY0JFTm9CQlNNOVFRRnFFRHdrUFF0QkNBOExJemtqT2hCS0lnRWpQRUVBRU5NQklBRWpQR29RUENJQUVJWUJRZjhCY1NRNUlBQVFod0ZCL3dGeEpEcEJBQkRPQVVFSUR3c2pPU002RUVvaUFFSC8vd054RU5RQlFmOEJjU1EwREFjTEl6eEJBV3NRUENROFFRZ1BDeU0wUVFFUXpBRWpORUVCYWhDSEFTUTBJelFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCREFjTEl6UkJmeERNQVNNMFFRRnJFSWNCSkRRak5BUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRU1CZ3NReHdGQi93RnhKRFFNQWd0QkFCRE9BVUVBRU1zQkVOY0JRUUJMQkVCQkFCRFBBUVZCQVJEUEFRc01CQXRCZnc4TEl6MUJBV29RUENROURBSUxJQUJCQVdzUVBDSUFFSVlCUWY4QmNTUTVJQUFRaHdGQi93RnhKRG9NQVFzZ0FFSC8vd054SUFFUXlRRUxRUVFMMlFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUJIQkVBZ0FDSUJRY0VBUmcwQkFrQWdBVUhDQUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc01FQXNqTmlRMURBOExJemNrTlF3T0N5TTRKRFVNRFFzak9TUTFEQXdMSXpva05Rd0xDeU01SXpvUVNoRFVBVUgvQVhFa05Rd0tDeU0wSkRVTUNRc2pOU1EyREFnTERBY0xJemNrTmd3R0N5TTRKRFlNQlFzak9TUTJEQVFMSXpva05nd0RDeU01SXpvUVNoRFVBVUgvQVhFa05nd0NDeU0wSkRZTUFRdEJmdzhMUVFRTDJRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFCSEJFQWdBQ0lCUWRFQVJnMEJBa0FnQVVIU0FHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlNRM0RCQUxJellrTnd3UEN3d09DeU00SkRjTURRc2pPU1EzREF3TEl6b2tOd3dMQ3lNNUl6b1FTaERVQVVIL0FYRWtOd3dLQ3lNMEpEY01DUXNqTlNRNERBZ0xJellrT0F3SEN5TTNKRGdNQmdzTUJRc2pPU1E0REFRTEl6b2tPQXdEQ3lNNUl6b1FTaERVQVVIL0FYRWtPQXdDQ3lNMEpEZ01BUXRCZnc4TFFRUUwyUUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUNJQlFlRUFSZzBCQWtBZ0FVSGlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5TUTVEQkFMSXpZa09Rd1BDeU0zSkRrTURnc2pPQ1E1REEwTERBd0xJem9rT1F3TEN5TTVJem9RU2hEVUFVSC9BWEVrT1F3S0N5TTBKRGtNQ1Fzak5TUTZEQWdMSXpZa09nd0hDeU0zSkRvTUJnc2pPQ1E2REFVTEl6a2tPZ3dFQ3d3REN5TTVJem9RU2hEVUFVSC9BWEVrT2d3Q0N5TTBKRG9NQVF0QmZ3OExRUVFMSWdBamh3RUVRRUVCSkQ4UEN5TnlJM2R4UVI5eFJRUkFRUUVrUUE4TFFRRWtRUXVKQWdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBRWNFUUNBQUlnRkI4UUJHRFFFQ1FDQUJRZklBYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5TTVJem9RU2lNMUVNa0JEQkFMSXprak9oQktJellReVFFTUR3c2pPU002RUVvak54REpBUXdPQ3lNNUl6b1FTaU00RU1rQkRBMExJemtqT2hCS0l6a1F5UUVNREFzak9TTTZFRW9qT2hESkFRd0xDeU95QVVVRVFCRGxBUXNNQ2dzak9TTTZFRW9qTkJESkFRd0pDeU0xSkRRTUNBc2pOaVEwREFjTEl6Y2tOQXdHQ3lNNEpEUU1CUXNqT1NRMERBUUxJem9rTkF3REN5TTVJem9RU2hEVUFVSC9BWEVrTkF3Q0N3d0JDMEYvRHd0QkJBdEtBQ0FCUVFCT0JFQWdBRUgvQVhFZ0FDQUJhaENIQVVzRVFFRUJFTThCQlVFQUVNOEJDd1VnQVVFQUlBRnJJQUZCQUVvYklBQkIvd0Z4U2dSQVFRRVF6d0VGUVFBUXp3RUxDd3MzQVFGL0l6UWdBRUgvQVhFaUFSRE1BU00wSUFFUTV3RWpOQ0FBYWhDSEFTUTBJelFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCQzJzQkFYOGpOQ0FBYWhEWEFXb1Fod0VoQVNNMElBQnpJQUZ6RUljQlFSQnhCRUJCQVJETEFRVkJBQkRMQVFzak5DQUFRZjhCY1dvUTF3RnFFRHhCZ0FKeFFRQkxCRUJCQVJEUEFRVkJBQkRQQVFzZ0FTUTBJelFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCQytJQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCZ0FGSEJFQUNRQ0FCUVlFQmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlJEb0FRd1FDeU0yRU9nQkRBOExJemNRNkFFTURnc2pPQkRvQVF3TkN5TTVFT2dCREF3TEl6b1E2QUVNQ3dzak9TTTZFRW9RMUFFUTZBRU1DZ3NqTkJEb0FRd0pDeU0xRU9rQkRBZ0xJellRNlFFTUJ3c2pOeERwQVF3R0N5TTRFT2tCREFVTEl6a1E2UUVNQkFzak9oRHBBUXdEQ3lNNUl6b1FTaERVQVJEcEFRd0NDeU0wRU9rQkRBRUxRWDhQQzBFRUN6b0JBWDhqTkNBQVFmOEJjVUYvYkNJQkVNd0JJelFnQVJEbkFTTTBJQUJyRUljQkpEUWpOQVJBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VMYXdFQmZ5TTBJQUJyRU5jQmF4Q0hBU0VCSXpRZ0FITWdBWE5CRUhFUWh3RUVRRUVCRU1zQkJVRUFFTXNCQ3lNMElBQkIvd0Z4YXhEWEFXc1FQRUdBQW5GQkFFc0VRRUVCRU04QkJVRUFFTThCQ3lBQkpEUWpOQVJBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VMNGdFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdRQVVjRVFBSkFJQUZCa1FGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU0xRU9zQkRCQUxJellRNndFTUR3c2pOeERyQVF3T0N5TTRFT3NCREEwTEl6a1E2d0VNREFzak9oRHJBUXdMQ3lNNUl6b1FTaERVQVJEckFRd0tDeU0wRU9zQkRBa0xJelVRN0FFTUNBc2pOaERzQVF3SEN5TTNFT3dCREFZTEl6Z1E3QUVNQlFzak9SRHNBUXdFQ3lNNkVPd0JEQU1MSXprak9oQktFTlFCRU93QkRBSUxJelFRN0FFTUFRdEJmdzhMUVFRTEtBQWpOQ0FBY1NRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJRUUVReXdGQkFCRFBBUXNyQUNNMElBQnpFSWNCSkRRak5BUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVVFQUVNOEJDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJvQUZIQkVBQ1FDQUJRYUVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkR1QVF3UUN5TTJFTzRCREE4TEl6Y1E3Z0VNRGdzak9CRHVBUXdOQ3lNNUVPNEJEQXdMSXpvUTdnRU1Dd3NqT1NNNkVFb1ExQUVRN2dFTUNnc2pOQkR1QVF3SkN5TTFFTzhCREFnTEl6WVE3d0VNQndzak54RHZBUXdHQ3lNNEVPOEJEQVVMSXprUTd3RU1CQXNqT2hEdkFRd0RDeU01SXpvUVNoRFVBUkR2QVF3Q0N5TTBFTzhCREFFTFFYOFBDMEVFQ3l3QUl6UWdBSEpCL3dGeEpEUWpOQVJBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0ZCQUJETEFVRUFFTThCQ3pNQkFYOGpOQ0FBUWY4QmNVRi9iQ0lCRU13Qkl6UWdBUkRuQVNNMElBRnFCRUJCQUJETkFRVkJBUkROQVF0QkFSRE9BUXZpQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRYkFCUndSQUFrQWdBVUd4QVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVROFFFTUVBc2pOaER4QVF3UEN5TTNFUEVCREE0TEl6Z1E4UUVNRFFzak9SRHhBUXdNQ3lNNkVQRUJEQXNMSXprak9oQktFTlFCRVBFQkRBb0xJelFROFFFTUNRc2pOUkR5QVF3SUN5TTJFUElCREFjTEl6Y1E4Z0VNQmdzak9CRHlBUXdGQ3lNNUVQSUJEQVFMSXpvUThnRU1Bd3NqT1NNNkVFb1ExQUVROGdFTUFnc2pOQkR5QVF3QkMwRi9Ed3RCQkF0Q0FRSi9Ba0FDUUNBQUVJMEJJZ0ZCZjBjRVFBd0NDeUFBRUFNaEFRc0xBa0FDUUNBQVFRRnFJZ0lRalFFaUFFRi9SdzBCSUFJUUF5RUFDd3NnQUNBQkVFb0xEQUJCQ0JERkFTQUFFUFFCQ3pzQUlBQkJnQUZ4UVlBQlJnUkFRUUVRendFRlFRQVF6d0VMSUFBUTBBRWlBQVJBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0ZCQUJETEFTQUFDemtBSUFCQkFYRkJBRXNFUUVFQkVNOEJCVUVBRU04QkN5QUFFTlVCSWdBRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0VnQUF0SUFRRi9JQUJCZ0FGeFFZQUJSZ1JBUVFFaEFRc2dBQkRZQVNFQUlBRUVRRUVCRU04QkJVRUFFTThCQ3lBQUJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FVRUFFTXNCSUFBTFJnRUJmeUFBUVFGeFFRRkdCRUJCQVNFQkN5QUFFTnNCSVFBZ0FRUkFRUUVRendFRlFRQVF6d0VMSUFBRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0VnQUF0TEFRRi9JQUJCZ0FGeFFZQUJSZ1JBUVFFaEFRc2dBRUVCZEJDSEFTRUFJQUVFUUVFQkVNOEJCVUVBRU04QkN5QUFCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVBRU1zQklBQUxhd0VDZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFCQkFYRkJBVVlFUUVFQklRSUxJQUJCL3dGeFFRRjJFSWNCSVFBZ0FRUkFJQUJCZ0FGeUlRQUxJQUFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCUVFBUXl3RWdBZ1JBUVFFUXp3RUZRUUFRendFTElBQUxPQUFnQUVFUGNVRUVkQ0FBUWZBQmNVRUVkbklRaHdFaUFBUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVVFQUVNOEJJQUFMU3dFQmZ5QUFRUUZ4UVFGR0JFQkJBU0VCQ3lBQVFmOEJjVUVCZGhDSEFTSUFCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVBRU1zQklBRUVRRUVCRU04QkJVRUFFTThCQ3lBQUN5Z0FJQUZCQVNBQWRIRkIvd0Z4QkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVVFQkVNc0JJQUVMSUFBZ0FVRUFTZ1IvSUFKQkFTQUFkSElGSUFKQkFTQUFkRUYvYzNFTElnSUwyd2dCQjM5QmZ5RUdBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQ0c4aUJ5RUZJQWRGRFFBQ1FDQUZRUUZyRGdjQ0F3UUZCZ2NJQUFzTUNBc2pOU0VCREFjTEl6WWhBUXdHQ3lNM0lRRU1CUXNqT0NFQkRBUUxJemtoQVF3REN5TTZJUUVNQWdzak9TTTZFRW9RMUFFaEFRd0JDeU0wSVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklRUWdCVVVOQUFKQUlBUkJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTElBQkJCMHdFUUNBQkVQWUJJUUpCQVNFREJTQUFRUTlNQkVBZ0FSRDNBU0VDUVFFaEF3c0xEQThMSUFCQkYwd0VRQ0FCRVBnQklRSkJBU0VEQlNBQVFSOU1CRUFnQVJENUFTRUNRUUVoQXdzTERBNExJQUJCSjB3RVFDQUJFUG9CSVFKQkFTRURCU0FBUVM5TUJFQWdBUkQ3QVNFQ1FRRWhBd3NMREEwTElBQkJOMHdFUUNBQkVQd0JJUUpCQVNFREJTQUFRVDlNQkVBZ0FSRDlBU0VDUVFFaEF3c0xEQXdMSUFCQnh3Qk1CRUJCQUNBQkVQNEJJUUpCQVNFREJTQUFRYzhBVEFSQVFRRWdBUkQrQVNFQ1FRRWhBd3NMREFzTElBQkIxd0JNQkVCQkFpQUJFUDRCSVFKQkFTRURCU0FBUWQ4QVRBUkFRUU1nQVJEK0FTRUNRUUVoQXdzTERBb0xJQUJCNXdCTUJFQkJCQ0FCRVA0QklRSkJBU0VEQlNBQVFlOEFUQVJBUVFVZ0FSRCtBU0VDUVFFaEF3c0xEQWtMSUFCQjl3Qk1CRUJCQmlBQkVQNEJJUUpCQVNFREJTQUFRZjhBVEFSQVFRY2dBUkQrQVNFQ1FRRWhBd3NMREFnTElBQkJod0ZNQkVCQkFFRUFJQUVRL3dFaEFrRUJJUU1GSUFCQmp3Rk1CRUJCQVVFQUlBRVEvd0VoQWtFQklRTUxDd3dIQ3lBQVFaY0JUQVJBUVFKQkFDQUJFUDhCSVFKQkFTRURCU0FBUVo4QlRBUkFRUU5CQUNBQkVQOEJJUUpCQVNFREN3c01CZ3NnQUVHbkFVd0VRRUVFUVFBZ0FSRC9BU0VDUVFFaEF3VWdBRUd2QVV3RVFFRUZRUUFnQVJEL0FTRUNRUUVoQXdzTERBVUxJQUJCdHdGTUJFQkJCa0VBSUFFUS93RWhBa0VCSVFNRklBQkJ2d0ZNQkVCQkIwRUFJQUVRL3dFaEFrRUJJUU1MQ3d3RUN5QUFRY2NCVEFSQVFRQkJBU0FCRVA4QklRSkJBU0VEQlNBQVFjOEJUQVJBUVFGQkFTQUJFUDhCSVFKQkFTRURDd3NNQXdzZ0FFSFhBVXdFUUVFQ1FRRWdBUkQvQVNFQ1FRRWhBd1VnQUVIZkFVd0VRRUVEUVFFZ0FSRC9BU0VDUVFFaEF3c0xEQUlMSUFCQjV3Rk1CRUJCQkVFQklBRVEvd0VoQWtFQklRTUZJQUJCN3dGTUJFQkJCVUVCSUFFUS93RWhBa0VCSVFNTEN3d0JDeUFBUWZjQlRBUkFRUVpCQVNBQkVQOEJJUUpCQVNFREJTQUFRZjhCVEFSQVFRZEJBU0FCRVA4QklRSkJBU0VEQ3dzTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBSElnUUVRQUpBSUFSQkFXc09Cd0lEQkFVR0J3Z0FDd3dJQ3lBQ0pEVU1Cd3NnQWlRMkRBWUxJQUlrTnd3RkN5QUNKRGdNQkFzZ0FpUTVEQU1MSUFJa09nd0NDeUFGUVFSSUlnUkZCRUFnQlVFSFNpRUVDeUFFQkVBak9TTTZFRW9nQWhESkFRc01BUXNnQWlRMEN5QURCRUJCQkNFR0N5QUdDOVFEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRY0FCUndSQUFrQWdBVUhCQVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxFTjBCRFJJTUZBc2pQQkQxQVVILy93TnhJUUVqUEVFQ2FoQThKRHdnQVJDR0FVSC9BWEVrTlNBQkVJY0JRZjhCY1NRMlFRUVBDeERkQVFSQURCSUZEQkFMQUFzTURnc1EzUUVFUUF3UUJRd05Dd0FMSXp4QkFtc1FQQ1E4SXp3ak5TTTJFRW9RMGdFTURRc1F4d0VRNkFFTUR3c2pQRUVDYXhBOEpEd2pQQ005RU5JQlFRQWtQUXdMQ3hEZEFVRUJSdzBLREF3TEl6d1E5UUZCLy84RGNTUTlJenhCQW1vUVBDUThEQWtMRU4wQlFRRkdCRUFNQ0FVTUNnc0FDeERIQVVIL0FYRVFnQUloQVNNOVFRRnFFRHdrUFNBQkR3c1EzUUZCQVVZRVFDTThRUUpyRUR3a1BDTThJejFCQW1wQi8vOERjUkRTQVF3R0JRd0lDd0FMREFNTEVNY0JFT2tCREFjTEl6eEJBbXNRUENROEl6d2pQUkRTQVVFSUpEME1Bd3RCZnc4TEl6eEJBbXNRUENROEl6d2pQVUVDYWhBOEVOSUJDeERJQVVILy93TnhKRDBMUVFnUEN5TTlRUUpxRUR3a1BVRU1Ed3NqUEJEMUFVSC8vd054SkQwalBFRUNhaEE4SkR4QkRBOExJejFCQVdvUVBDUTlRUVFMRlFBZ0FFRUJjUVJBUVFFa2lBRUZRUUFraHdFTEM3RURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVSFFBVWNFUUFKQUlBRkIwUUZyRGc4Q0F3QUVCUVlIQ0FrS0FBc0FEQTBBQ3d3TkN4RFhBUTBPREJBTEl6d1E5UUZCLy84RGNTRUJJenhCQW1vUVBDUThJQUVRaGdGQi93RnhKRGNnQVJDSEFVSC9BWEVrT0VFRUR3c1Exd0VFUUF3T0JRd01Dd0FMRU5jQkJFQU1EUVVqUEVFQ2F4QThKRHdqUENNOVFRSnFRZi8vQTNFUTBnRU1Dd3NBQ3lNOFFRSnJFRHdrUENNOEl6Y2pPQkJLRU5JQkRBb0xFTWNCRU9zQkRBd0xJenhCQW1zUVBDUThJendqUFJEU0FVRVFKRDBNQ0FzUTF3RkJBVWNOQnd3SkN5TThFUFVCUWYvL0EzRWtQVUVCRUlJQ0l6eEJBbW9RUENROERBWUxFTmNCUVFGR0JFQU1CUVVNQndzQUN4RFhBVUVCUmdSQUl6eEJBbXNRUENROEl6d2pQVUVDYWhBOEVOSUJEQVFGREFZTEFBc1F4d0VRN0FFTUJnc2pQRUVDYXhBOEpEd2pQQ005RU5JQlFSZ2tQUXdDQzBGL0R3c1F5QUZCLy84RGNTUTlDMEVJRHdzalBVRUNhaEE4SkQxQkRBOExJendROVFGQi8vOERjU1E5SXp4QkFtb1FQQ1E4UVF3UEN5TTlRUUZxRUR3a1BVRUVDK0FDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWVBQlJ3UkFBa0FnQUVIaEFXc09Ed0lEQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRU1jQlFmOEJjVUdBL2dOcUl6UVF5UUVNQ3dzalBCRDFBVUgvL3dOeElRQWpQRUVDYWhBOEpEd2dBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2UVFRUEN5TTJRWUQrQTJvak5CREpBVUVFRHdzalBFRUNheEE4SkR3alBDTTVJem9RU2hEU0FVRUlEd3NReHdFUTdnRU1Cd3NqUEVFQ2F4QThKRHdqUENNOUVOSUJRU0FrUFVFSUR3c1F4d0VRMlFFaEFDTThJQUJCR0hSQkdIVWlBRUVCRU5NQkl6d2dBR29RUENROFFRQVF6UUZCQUJET0FTTTlRUUZxRUR3a1BVRU1Ed3NqT1NNNkVFcEIvLzhEY1NROVFRUVBDeERJQVVILy93TnhJelFReVFFalBVRUNhaEE4SkQxQkJBOExFTWNCRU84QkRBSUxJenhCQW1zUVBDUThJendqUFJEU0FVRW9KRDFCQ0E4TFFYOFBDeU05UVFGcUVEd2tQVUVFQzVJREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQlJ3UkFBa0FnQUVIeEFXc09Ed0lEQkFBRkJnY0lDUW9MQUFBTURRQUxEQTBMRU1jQlFmOEJjVUdBL2dOcUVOUUJFSWNCSkRRTURRc2pQQkQxQVVILy93TnhJUUFqUEVFQ2FoQThKRHdnQUJDR0FVSC9BWEVrTkNBQUVJY0JRZjhCY1NRN0RBMExJelpCZ1A0RGFoRFVBUkNIQVNRMERBd0xRUUFRZ2dJTUN3c2pQRUVDYXhBOEpEd2pQQ00wSXpzUVNoRFNBVUVJRHdzUXh3RVE4UUVNQ0FzalBFRUNheEE4SkR3alBDTTlFTklCUVRBa1BVRUlEd3NReHdFUTJRRWhBRUVBRU0wQlFRQVF6Z0VqUENBQVFSaDBRUmgxSWdCQkFSRFRBU004SUFCcUVEd2lBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2SXoxQkFXb1FQQ1E5UVFnUEN5TTVJem9RU2tILy93TnhKRHhCQ0E4TEVNZ0JRZi8vQTNFUTFBRkIvd0Z4SkRRalBVRUNhaEE4SkQwTUJRdEJBUkNDQWd3RUN4REhBUkR5QVF3Q0N5TThRUUpyRUR3a1BDTThJejBRMGdGQk9DUTlRUWdQQzBGL0R3c2pQVUVCYWhBOEpEMExRUVFMMWdFQkFYOGpQVUVCYWhBOEpEMGpRUVJBSXoxQkFXc1FQQ1E5Q3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRTSUJCRUFnQVVFQlJnMEJBa0FnQVVFQ2F3NE5Bd1FGQmdjSUNRb0xEQTBPRHdBTERBOExJQUFRMWdFUEN5QUFFTndCRHdzZ0FCRGdBUThMSUFBUTRRRVBDeUFBRU9JQkR3c2dBQkRqQVE4TElBQVE1QUVQQ3lBQUVPWUJEd3NnQUJEcUFROExJQUFRN1FFUEN5QUFFUEFCRHdzZ0FCRHpBUThMSUFBUWdRSVBDeUFBRUlNQ0R3c2dBQkNFQWc4TElBQVFoUUlMRWdCQkFDUkFRUUFrUDBFQUpFRkJBQ1JDQ3hRQUl6OEVmeU0vQlNOQUN3UkFRUUVQQzBFQUN4MEJBWDhnQVJDR0FTRUNJQUFnQVJDSEFSQUdJQUJCQVdvZ0FoQUdDNElCQVFGL1FRQVFnZ0lnQUVHUC9nTVFBeEJFSWdFa2QwR1AvZ01nQVJBR0l6eEJBbXRCLy84RGNTUThFSWdDR2lNOEl6MFFpUUlDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdRQ0F3QUVBQXNNQkF0QkFDUnpRY0FBSkQwTUF3dEJBQ1IwUWNnQUpEME1BZ3RCQUNSMVFkQUFKRDBNQVF0QkFDUjJRZUFBSkQwTEM3OEJBUUovSTRnQkJFQkJBU1NIQVVFQUpJZ0JDeU55STNkeFFSOXhRUUJLQkVBamh3RUVmeU5BUlFVamh3RUxJZ0FFUUNOdUJIOGpjd1VqYmdzaUFBUkFRUUFRaWdKQkFTRUJCU052Qkg4amRBVWpid3NpQUFSQVFRRVFpZ0pCQVNFQkJTTndCSDhqZFFVamNBc2lBQVJBUVFJUWlnSkJBU0VCQlNOeEJIOGpkZ1VqY1FzaUFBUkFRUVFRaWdKQkFTRUJDd3NMQ3d0QkFDRUFJQUVFUUVFVUlRQVFpQUlFUUJDSEFrRVlJUUFMQ3hDSUFnUkFFSWNDQ3lBQUR3dEJBQXNvQUNPRkFTQUFhaVNGQVNPRkFTT0RBVTRFUUNPRUFVRUJhaVNFQVNPRkFTT0RBV3NraFFFTEMzRUJBbjlCQVJBVkkwRUVRQ005RUFOQi93RnhFSVlDRU1VQkVJY0NDeENMQWlJQlFRQktCRUFnQVJERkFRdEJCQ0VBRUlnQ1JTSUJCRUFqUWtVaEFRc2dBUVJBSXowUUEwSC9BWEVRaGdJaEFBc2pPMEh3QVhFa095QUFRUUJNQkVBZ0FBOExJQUFReFFGQkFSQ01BaUFBQ3hBQUl6TUVRRUdneVFnUEMwSFFwQVFMQkFBalh3dk9BUUVFZjBHQUNDRURJQUZCQUVvRVFDQUJJUU1GSUFGQkFFZ0VRRUYvSVFNTEMwRUFJUUVEUUNBR1JTSUFCRUFnQVVVaEFBc2dBQVJBSUFSRklRQUxJQUFFUUNBRlJTRUFDeUFBQkVBUWpRSkJBRWdFUUVFQklRWUZJejRRamdKT0JFQkJBU0VCQlNBRFFYOUtJZ0FFUUJDUEFpQURUaUVBQ3lBQUJFQkJBU0VFQlNBQ1FYOUtJZ0FFUUNNOUlBSkdJUUFMSUFBRVFFRUJJUVVMQ3dzTERBRUxDeUFCQkVBalBoQ09BbXNrUGtFQUR3c2dCQVJBUVFFUEN5QUZCRUJCQWc4TEl6MUJBV3NRUENROVFYOExDd0JCQVVGL1FYOFFrQUlMT0FFRGZ3TkFJQUlnQUVnaUF3UkFJQUZCQUU0aEF3c2dBd1JBRUpFQ0lRRWdBa0VCYWlFQ0RBRUxDeUFCUVFCSUJFQWdBUThMUVFBTEN3QkJBU0FBUVg4UWtBSUxHZ0VCZjBFQlFYOGdBQkNRQWlJQlFRSkdCRUJCQVE4TElBRUxCUUFqZ0FFTEJRQWpnUUVMQlFBamdnRUxYd0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQWlBVUVCUmcwQkFrQWdBVUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2oyQUVQQ3lQWkFROExJOW9CRHdzajJ3RVBDeVBjQVE4TEk5MEJEd3NqM2dFUEN5UGZBUThMUVFBTGl3RUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnSkJBVVlOQVFKQUlBSkJBbXNPQmdNRUJRWUhDQUFMREFnTElBRkJBWEVrMkFFTUJ3c2dBVUVCY1NUWkFRd0dDeUFCUVFGeEpOb0JEQVVMSUFGQkFYRWsyd0VNQkFzZ0FVRUJjU1RjQVF3REN5QUJRUUZ4Sk4wQkRBSUxJQUZCQVhFazNnRU1BUXNnQVVFQmNTVGZBUXNMQ2dCQkFTUjJRUVFRWFF0a0FRSi9RUUFrUWlBQUVKZ0NSUVJBUVFFaEFRc2dBRUVCRUprQ0lBRUVRRUVBSVFFZ0FFRURUQVJBUVFFaEFRc2pyUUVFZnlBQkJTT3RBUXNpQUFSQVFRRWhBZ3NqcmdFRWZ5QUJSUVVqcmdFTElnQUVRRUVCSVFJTElBSUVRQkNhQWdzTEN3a0FJQUJCQUJDWkFndWFBUUFnQUVFQVNnUkFRUUFRbXdJRlFRQVFuQUlMSUFGQkFFb0VRRUVCRUpzQ0JVRUJFSndDQ3lBQ1FRQktCRUJCQWhDYkFnVkJBaENjQWdzZ0EwRUFTZ1JBUVFNUW13SUZRUU1RbkFJTElBUkJBRW9FUUVFRUVKc0NCVUVFRUp3Q0N5QUZRUUJLQkVCQkJSQ2JBZ1ZCQlJDY0Fnc2dCa0VBU2dSQVFRWVFtd0lGUVFZUW5BSUxJQWRCQUVvRVFFRUhFSnNDQlVFSEVKd0NDd3NFQUNNMEN3UUFJelVMQkFBak5nc0VBQ00zQ3dRQUl6Z0xCQUFqT1FzRUFDTTZDd1FBSXpzTEJBQWpQUXNFQUNNOEN3WUFJejBRQXdzRUFDTkxDNThEQVFwL1FZQ1FBaUVKSTZjQkJFQkJnSUFDSVFrTFFZQ3dBaUVLSTZnQkJFQkJnTGdDSVFvTEFrQURRQ0FFUVlBQ1RnMEJBa0JCQUNFRkEwQWdCVUdBQWs0TkFTQUpJQW9nQkVFRGRVRUZkR29nQlVFRGRXb2lCa0VBRUQ4UVNDRUlJQVJCQ0c4aEFVRUhJQVZCQ0c5cklRZEJBQ0VDSXk4RWZ5QUFRUUJLQlNNdkN5SURCRUFnQmtFQkVEOGhBZ3RCQmlBQ0VCQUVRRUVISUFGcklRRUxRUUFoQTBFRElBSVFFQVJBUVFFaEF3c2dDQ0FCUVFGMGFpSUdJQU1RUHlFSVFRQWhBU0FISUFaQkFXb2dBeEEvRUJBRVFFRUNJUUVMSUFjZ0NCQVFCRUFnQVVFQmFpRUJDeUFFUVFoMElBVnFRUU5zSVFjakx3Ui9JQUJCQUVvRkl5OExJZ01FUUVFQUlBSkJCM0VnQVVFQUVFc2lBUkJNSVFaQkFTQUJFRXdoQTBFQ0lBRVFUQ0VCSUFkQmdKZ09haUlDSUFZNkFBQWdBa0VCYWlBRE9nQUFJQUpCQW1vZ0FUb0FBQVVnQVVISC9nTkJBQkJOSVFJQ1FFRUFJUUVEUUNBQlFRTk9EUUVnQjBHQW1BNXFJQUZxSUFJNkFBQWdBVUVCYWlFQkRBQUFDd0FMQ3lBRlFRRnFJUVVNQUFBTEFBc2dCRUVCYWlFRURBQUFDd0FMQzBjQUFrQUNRQUpBQWtBQ1FDUDJBVUVLYXc0RUFRSURCQUFMQUF0QkFDRUtDMEVBSVFzTFFYOGhEQXNnQUNBQklBSWdBeUFFSUFVZ0JpQUhJQWdnQ1NBS0lBc2dEQkJQQzlrQkFRWi9Ba0FEUUNBQ1FSZE9EUUVDUUVFQUlRQURRQ0FBUVI5T0RRRkJBQ0VFSUFCQkQwb0VRRUVCSVFRTElBSWhBU0FDUVE5S0JFQWdBVUVQYXlFQkN5QUJRUVIwSVFFZ0FFRVBTZ1IvSUFFZ0FFRVBhMm9GSUFFZ0FHb0xJUUZCZ0lBQ0lRVWdBa0VQU2dSQVFZQ1FBaUVGQ3dKQVFRQWhBd05BSUFOQkNFNE5BVUVMSlBZQklBRWdCU0FFUVFCQkJ5QURJQUJCQTNRZ0FrRURkQ0FEYWtINEFVR0FtQnBCQVVFQVFRQVFxd0lhSUFOQkFXb2hBd3dBQUFzQUN5QUFRUUZxSVFBTUFBQUxBQXNnQWtFQmFpRUNEQUFBQ3dBTEN3UUFJM2tMQkFBamVnc0VBQ043Q3hjQkFYOGpmU0VBSTN3RVFFRUNJQUFRUlNFQUN5QUFDeFFBUHdCQml3RklCRUJCaXdFL0FHdEFBQm9MQ3gwQUFrQUNRQUpBSS9ZQkRnSUJBZ0FMQUF0QkFDRUFDeUFBRUpNQ0N3Y0FJQUFrOWdFTE1RQUNRQUpBQWtBQ1FBSkFJL1lCRGdRQkFnTUVBQXNBQzBFQklRQUxRWDhoQVF0QmZ5RUNDeUFBSUFFZ0FoQ1FBZ3NkQUFKQUFrQUNRQ1AyQVE0Q0FRSUFDd0FMUVFBaEFBc2dBQkNxQWdzQXNXTUVibUZ0WlFHcFk3WUNBQ1ZqYjNKbEwyMWxiVzl5ZVM5aVlXNXJhVzVuTDJkbGRGSnZiVUpoYm10QlpHUnlaWE56QVNWamIzSmxMMjFsYlc5eWVTOWlZVzVyYVc1bkwyZGxkRkpoYlVKaGJtdEJaR1J5WlhOekFqZGpiM0psTDIxbGJXOXllUzl0WlcxdmNubE5ZWEF2WjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBeWxqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMMlZwWjJoMFFtbDBURzloWkVaeWIyMUhRazFsYlc5eWVRUWFZMjl5WlM5amNIVXZZM0IxTDJsdWFYUnBZV3hwZW1WRGNIVUZKbU52Y21VdmJXVnRiM0o1TDIxbGJXOXllUzlwYm1sMGFXRnNhWHBsUTJGeWRISnBaR2RsQml0amIzSmxMMjFsYlc5eWVTOXpkRzl5WlM5bGFXZG9kRUpwZEZOMGIzSmxTVzUwYjBkQ1RXVnRiM0o1QngxamIzSmxMMjFsYlc5eWVTOWtiV0V2YVc1cGRHbGhiR2w2WlVSdFlRZ3BZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5cGJtbDBhV0ZzYVhwbFIzSmhjR2hwWTNNSkoyTnZjbVV2WjNKaGNHaHBZM012Y0dGc1pYUjBaUzlwYm1sMGFXRnNhWHBsVUdGc1pYUjBaUW9uWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1cGJtbDBhV0ZzYVhwbEN5ZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbWx1YVhScFlXeHBlbVVNSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWFXNXBkR2xoYkdsNlpRMG5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVwYm1sMGFXRnNhWHBsRGpGamIzSmxMM052ZFc1a0wyRmpZM1Z0ZFd4aGRHOXlMMmx1YVhScFlXeHBlbVZUYjNWdVpFRmpZM1Z0ZFd4aGRHOXlEeUJqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMmx1YVhScFlXeHBlbVZUYjNWdVpCQWhZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMMk5vWldOclFtbDBUMjVDZVhSbEVUeGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OUpiblJsY25KMWNIUnpMblZ3WkdGMFpVbHVkR1Z5Y25Wd2RFVnVZV0pzWldRU1BtTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXVkWEJrWVhSbFNXNTBaWEp5ZFhCMFVtVnhkV1Z6ZEdWa0V5OWpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OXBibWwwYVdGc2FYcGxTVzUwWlhKeWRYQjBjeFFqWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDJsdWFYUnBZV3hwZW1WVWFXMWxjbk1WRzJOdmNtVXZZMjl5WlM5elpYUklZWE5EYjNKbFUzUmhjblJsWkJZWFkyOXlaUzlqZVdOc1pYTXZjbVZ6WlhSRGVXTnNaWE1YRjJOdmNtVXZaWGhsWTNWMFpTOXlaWE5sZEZOMFpYQnpHQlJqYjNKbEwyTnZjbVV2YVc1cGRHbGhiR2w2WlJrUVkyOXlaUzlqYjNKbEwyTnZibVpwWnhvWVkyOXlaUzlqYjNKbEwyaGhjME52Y21WVGRHRnlkR1ZrR3lKamIzSmxMMk52Y21VdloyVjBVMkYyWlZOMFlYUmxUV1Z0YjNKNVQyWm1jMlYwSERKamIzSmxMMjFsYlc5eWVTOXpkRzl5WlM5emRHOXlaVUp2YjJ4bFlXNUVhWEpsWTNSc2VWUnZWMkZ6YlUxbGJXOXllUjBhWTI5eVpTOWpjSFV2WTNCMUwwTndkUzV6WVhabFUzUmhkR1VlS1dOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVjMkYyWlZOMFlYUmxIeTlqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlKYm5SbGNuSjFjSFJ6TG5OaGRtVlRkR0YwWlNBalkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wwcHZlWEJoWkM1ellYWmxVM1JoZEdVaEkyTnZjbVV2YldWdGIzSjVMMjFsYlc5eWVTOU5aVzF2Y25rdWMyRjJaVk4wWVhSbElpTmpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuTmhkbVZUZEdGMFpTTWdZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1ellYWmxVM1JoZEdVa0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVjMkYyWlZOMFlYUmxKU1pqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5OaGRtVlRkR0YwWlNZbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NXpZWFpsVTNSaGRHVW5KbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1YzJGMlpWTjBZWFJsS0JOamIzSmxMMk52Y21VdmMyRjJaVk4wWVhSbEtUSmpiM0psTDIxbGJXOXllUzlzYjJGa0wyeHZZV1JDYjI5c1pXRnVSR2x5WldOMGJIbEdjbTl0VjJGemJVMWxiVzl5ZVNvYVkyOXlaUzlqY0hVdlkzQjFMME53ZFM1c2IyRmtVM1JoZEdVckptTnZjbVV2WjNKaGNHaHBZM012YkdOa0wweGpaQzUxY0dSaGRHVk1ZMlJEYjI1MGNtOXNMQ2xqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxteHZZV1JUZEdGMFpTMHZZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTVzYjJGa1UzUmhkR1V1Sm1OdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5S2IzbHdZV1F1ZFhCa1lYUmxTbTk1Y0dGa0x5TmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZTbTk1Y0dGa0xteHZZV1JUZEdGMFpUQWpZMjl5WlM5dFpXMXZjbmt2YldWdGIzSjVMMDFsYlc5eWVTNXNiMkZrVTNSaGRHVXhJMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXViRzloWkZOMFlYUmxNaUZqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMk5zWldGeVFYVmthVzlDZFdabVpYSXpJR052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWJHOWhaRk4wWVhSbE5DWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbXh2WVdSVGRHRjBaVFVtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1c2IyRmtVM1JoZEdVMkptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXViRzloWkZOMFlYUmxOeVpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG14dllXUlRkR0YwWlRnVFkyOXlaUzlqYjNKbEwyeHZZV1JUZEdGMFpUa2ZZMjl5WlM5bGVHVmpkWFJsTDJkbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZERvWVkyOXlaUzlsZUdWamRYUmxMMmRsZEZOMFpYQlRaWFJ6T3hWamIzSmxMMlY0WldOMWRHVXZaMlYwVTNSbGNITThJbU52Y21VdmNHOXlkR0ZpYkdVdmNHOXlkR0ZpYkdVdmRURTJVRzl5ZEdGaWJHVTlOMk52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVRVRllYME5aUTB4RlUxOVFSVkpmVTBOQlRreEpUa1UrTW1OdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVZbUYwWTJoUWNtOWpaWE56UTNsamJHVnpQeWRqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwyeHZZV1JHY205dFZuSmhiVUpoYm10QUoyTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012WjJWMFVtZGlVR2w0Wld4VGRHRnlkRUVtWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXpaWFJRYVhobGJFOXVSbkpoYldWQ0pHTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WjJWMFVHbDRaV3hUZEdGeWRFTXFZMjl5WlM5bmNtRndhR2xqY3k5d2NtbHZjbWwwZVM5blpYUlFjbWx2Y21sMGVXWnZjbEJwZUdWc1JDRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZjbVZ6WlhSQ2FYUlBia0o1ZEdWRkgyTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXpaWFJDYVhSUGJrSjVkR1ZHS21OdmNtVXZaM0poY0docFkzTXZjSEpwYjNKcGRIa3ZZV1JrVUhKcGIzSnBkSGxtYjNKUWFYaGxiRWM2WTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGRNYVc1bFQyWlVhV3hsUm5KdmJWUnBiR1ZEWVdOb1pVZ21ZMjl5WlM5bmNtRndhR2xqY3k5MGFXeGxjeTluWlhSVWFXeGxSR0YwWVVGa1pISmxjM05KTTJOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXNiMkZrVUdGc1pYUjBaVUo1ZEdWR2NtOXRWMkZ6YlUxbGJXOXllVW9qWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDJOdmJtTmhkR1Z1WVhSbFFubDBaWE5MTEdOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOW5aWFJTWjJKRGIyeHZja1p5YjIxUVlXeGxkSFJsVEM1amIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZaMlYwUTI5c2IzSkRiMjF3YjI1bGJuUkdjbTl0VW1kaVRUTmpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2WjJWMFRXOXViMk5vY205dFpVTnZiRzl5Um5KdmJWQmhiR1YwZEdWT0pXTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaMlYwVkdsc1pWQnBlR1ZzVTNSaGNuUlBMR052Y21VdlozSmhjR2hwWTNNdmRHbHNaWE12WkhKaGQxQnBlR1ZzYzBaeWIyMU1hVzVsVDJaVWFXeGxVRGRqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkMHhwYm1WUFpsUnBiR1ZHY205dFZHbHNaVWxrVVRkamIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDBOdmJHOXlVR2w0Wld4R2NtOXRWR2xzWlVsa1VqeGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQwMXZibTlqYUhKdmJXVlFhWGhsYkVaeWIyMVVhV3hsU1dSVE8yTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1FtRmphMmR5YjNWdVpGZHBibVJ2ZDFOallXNXNhVzVsVkM5amIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZjbVZ1WkdWeVFtRmphMmR5YjNWdVpGVXJZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDNKbGJtUmxjbGRwYm1SdmQxWWpZMjl5WlM5bmNtRndhR2xqY3k5emNISnBkR1Z6TDNKbGJtUmxjbE53Y21sMFpYTlhKR052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlgyUnlZWGRUWTJGdWJHbHVaVmdwWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OWZjbVZ1WkdWeVJXNTBhWEpsUm5KaGJXVlpKMk52Y21VdlozSmhjR2hwWTNNdmNISnBiM0pwZEhrdlkyeGxZWEpRY21sdmNtbDBlVTFoY0ZvaVkyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OXlaWE5sZEZScGJHVkRZV05vWlZzN1kyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVOU1U1ZlExbERURVZUWDFOUVVrbFVSVk5mVEVORVgwMVBSRVZjUVdOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVUVWxPWDBOWlEweEZVMTlVVWtGT1UwWkZVbDlFUVZSQlgweERSRjlOVDBSRlhTeGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OWZjbVZ4ZFdWemRFbHVkR1Z5Y25Wd2RGNHVZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRFeGpaRWx1ZEdWeWNuVndkRjhwWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlUYjNWdVpDNWlZWFJqYUZCeWIyTmxjM05EZVdOc1pYTmdMV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWJXRjRSbkpoYldWVFpYRjFaVzVqWlVONVkyeGxjMkVwWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1MWNHUmhkR1ZNWlc1bmRHaGlLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUR1Z1WjNSb1l5bGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVeGxibWQwYUdRcFkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWTVpXNW5kR2hsTEdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdloyVjBUbVYzUm5KbGNYVmxibU41Um5KdmJWTjNaV1Z3WmlsamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuTmxkRVp5WlhGMVpXNWplV2N5WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5allXeGpkV3hoZEdWVGQyVmxjRUZ1WkVOb1pXTnJUM1psY21ac2IzZG9LR052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxVM2RsWlhCcEsyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFJXNTJaV3h2Y0dWcUsyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFJXNTJaV3h2Y0dWcksyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFJXNTJaV3h2Y0dWc0pXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmRYQmtZWFJsUm5KaGJXVlRaWEYxWlc1alpYSnRMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1Z1S21OdmNtVXZjMjkxYm1RdllXTmpkVzExYkdGMGIzSXZaR2xrUTJoaGJtNWxiRVJoWTBOb1lXNW5aVzh1WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1M2FXeHNRMmhoYm01bGJGVndaR0YwWlhBdVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTNhV3hzUTJoaGJtNWxiRlZ3WkdGMFpYRXVZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzUzYVd4c1EyaGhibTVsYkZWd1pHRjBaWEluWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1eVpYTmxkRlJwYldWeWN6MWpiM0psTDNOdmRXNWtMMlIxZEhrdmFYTkVkWFI1UTNsamJHVkRiRzlqYTFCdmMybDBhWFpsVDNKT1pXZGhkR2wyWlVadmNsZGhkbVZtYjNKdGRDWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbWRsZEZOaGJYQnNaWFUyWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1blpYUlRZVzF3YkdWR2NtOXRRM2xqYkdWRGIzVnVkR1Z5ZGlkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuSmxjMlYwVkdsdFpYSjNKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1WjJWMFUyRnRjR3hsZURaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxtZGxkRk5oYlhCc1pVWnliMjFEZVdOc1pVTnZkVzUwWlhKNUoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVjbVZ6WlhSVWFXMWxjbm9pWTI5eVpTOXdiM0owWVdKc1pTOXdiM0owWVdKc1pTOXBNekpRYjNKMFlXSnNaWHNtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1blpYUlRZVzF3YkdWOE5tTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVaMlYwVTJGdGNHeGxSbkp2YlVONVkyeGxRMjkxYm5SbGNuMDdZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVuWlhST2IybHpaVU5vWVc1dVpXeEdjbVZ4ZFdWdVkzbFFaWEpwYjJSK0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVaMlYwVTJGdGNHeGxmelpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG1kbGRGTmhiWEJzWlVaeWIyMURlV05zWlVOdmRXNTBaWEtBQVJ4amIzSmxMMk53ZFM5amNIVXZRM0IxTGtOTVQwTkxYMU5RUlVWRWdRRXFZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1dFlYaEViM2R1VTJGdGNHeGxRM2xqYkdWemdnRW9ZMjl5WlM5emIzVnVaQzl6YjNWdVpDOW5aWFJUWVcxd2JHVkJjMVZ1YzJsbmJtVmtRbmwwWllNQkltTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmJXbDRRMmhoYm01bGJGTmhiWEJzWlhPRUFUTmpiM0psTDNOdmRXNWtMM052ZFc1a0wzTmxkRXhsWm5SQmJtUlNhV2RvZEU5MWRIQjFkRVp2Y2tGMVpHbHZVWFZsZFdXRkFTWmpiM0psTDNOdmRXNWtMMkZqWTNWdGRXeGhkRzl5TDJGalkzVnRkV3hoZEdWVGIzVnVaSVlCSUdOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5emNHeHBkRWhwWjJoQ2VYUmxod0VmWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNOd2JHbDBURzkzUW5sMFpZZ0JIMk52Y21VdmMyOTFibVF2YzI5MWJtUXZZMkZzWTNWc1lYUmxVMjkxYm1TSkFSeGpiM0psTDNOdmRXNWtMM052ZFc1a0wzVndaR0YwWlZOdmRXNWtpZ0VpWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlpWVhSamFGQnliMk5sYzNOQmRXUnBiNHNCSzJOdmNtVXZjMjkxYm1RdmNtVm5hWE4wWlhKekwxTnZkVzVrVW1WbmFYTjBaWEpTWldGa1ZISmhjSE9NQVNGamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdloyVjBTbTk1Y0dGa1UzUmhkR1dOQVNSamIzSmxMMjFsYlc5eWVTOXlaV0ZrVkhKaGNITXZZMmhsWTJ0U1pXRmtWSEpoY0hPT0FUSmpiM0psTDIxbGJXOXllUzlzYjJGa0wyVnBaMmgwUW1sMFRHOWhaRVp5YjIxSFFrMWxiVzl5ZVZkcGRHaFVjbUZ3YzQ4QklXTnZjbVV2YldWdGIzSjVMMkpoYm10cGJtY3ZhR0Z1Wkd4bFFtRnVhMmx1WjVBQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRsSjRNSkVCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRYQmtZWFJsVGxKNE1KSUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUbEo0TVpNQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRsSjRNWlFCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRYQmtZWFJsVGxKNE1aVUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUbEo0TVpZQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRsSjRNcGNCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRYQmtZWFJsVGxKNE1wZ0JKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TXBrQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFRsSjRNcG9CSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE01c0JKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUbEo0TTV3QkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkWEJrWVhSbFRsSjRNNTBCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVGxKNE01NEJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUbEo0Tko4QkpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkSEpwWjJkbGNxQUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUbEo0TktFQkpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkSEpwWjJkbGNxSUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TktNQkpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkSEpwWjJkbGNxUUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUbEo0TktVQkpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkSEpwWjJkbGNxWUJJV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWRYQmtZWFJsVGxJMU1LY0JJV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWRYQmtZWFJsVGxJMU1hZ0JJV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWRYQmtZWFJsVGxJMU1xa0JMR052Y21VdmMyOTFibVF2Y21WbmFYTjBaWEp6TDFOdmRXNWtVbVZuYVhOMFpYSlhjbWwwWlZSeVlYQnpxZ0VsWTI5eVpTOW5jbUZ3YUdsamN5OXNZMlF2VEdOa0xuVndaR0YwWlV4alpGTjBZWFIxYzZzQklHTnZjbVV2YldWdGIzSjVMMlJ0WVM5emRHRnlkRVJ0WVZSeVlXNXpabVZ5ckFFblkyOXlaUzl0WlcxdmNua3ZaRzFoTDJkbGRFaGtiV0ZUYjNWeVkyVkdjbTl0VFdWdGIzSjVyUUVzWTI5eVpTOXRaVzF2Y25rdlpHMWhMMmRsZEVoa2JXRkVaWE4wYVc1aGRHbHZia1p5YjIxTlpXMXZjbm11QVNGamIzSmxMMjFsYlc5eWVTOWtiV0V2YzNSaGNuUklaRzFoVkhKaGJuTm1aWEt2QVRKamIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZjM1J2Y21WUVlXeGxkSFJsUW5sMFpVbHVWMkZ6YlUxbGJXOXllYkFCTUdOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXBibU55WlcxbGJuUlFZV3hsZEhSbFNXNWtaWGhKWmxObGRMRUJMMk52Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5M2NtbDBaVU52Ykc5eVVHRnNaWFIwWlZSdlRXVnRiM0o1c2dFd1kyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmNtVnhkV1Z6ZEZScGJXVnlTVzUwWlhKeWRYQjBzd0VxWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDE5blpYUlVhVzFsY2tOdmRXNTBaWEpOWVhOclFtbDB0QUU3WTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDE5amFHVmphMFJwZG1sa1pYSlNaV2RwYzNSbGNrWmhiR3hwYm1kRlpHZGxSR1YwWldOMGIzSzFBU2xqYjNKbEwzUnBiV1Z5Y3k5MGFXMWxjbk12WDJsdVkzSmxiV1Z1ZEZScGJXVnlRMjkxYm5SbGNyWUJIMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTkxY0dSaGRHVlVhVzFsY25PM0FTVmpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZZbUYwWTJoUWNtOWpaWE56VkdsdFpYSnp1QUV2WTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTUxY0dSaGRHVkVhWFpwWkdWeVVtVm5hWE4wWlhLNUFTeGpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlZScGJXVnlRMjkxYm5SbGNyb0JLMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXVkWEJrWVhSbFZHbHRaWEpOYjJSMWJHKzdBU3hqYjNKbEwzUnBiV1Z5Y3k5MGFXMWxjbk12VkdsdFpYSnpMblZ3WkdGMFpWUnBiV1Z5UTI5dWRISnZiTHdCSm1OdmNtVXZiV1Z0YjNKNUwzZHlhWFJsVkhKaGNITXZZMmhsWTJ0WGNtbDBaVlJ5WVhCenZRRTBZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZaV2xuYUhSQ2FYUlRkRzl5WlVsdWRHOUhRazFsYlc5eWVWZHBkR2hVY21Gd2M3NEJIR052Y21VdmJXVnRiM0o1TDJSdFlTOW9aRzFoVkhKaGJuTm1aWEsvQVNCamIzSmxMMjFsYlc5eWVTOWtiV0V2ZFhCa1lYUmxTR0pzWVc1clNHUnRZY0FCTVdOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JXUW14aGJtdEpiblJsY25KMWNIVEJBUjVqYjNKbEwyZHlZWEJvYVdOekwyeGpaQzl6WlhSTVkyUlRkR0YwZFhQQ0FTVmpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDNWd1pHRjBaVWR5WVhCb2FXTnp3d0VyWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OWlZWFJqYUZCeWIyTmxjM05IY21Gd2FHbGpjOFFCR21OdmNtVXZZM2xqYkdWekwzUnlZV05yUTNsamJHVnpVbUZ1eFFFV1kyOXlaUzlqZVdOc1pYTXZjM2x1WTBONVkyeGxjOFlCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12WjJWMFJHRjBZVUo1ZEdWVWQyL0hBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmRsZEVSaGRHRkNlWFJsVDI1bHlBRW9ZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW5aWFJEYjI1allYUmxibUYwWldSRVlYUmhRbmwwWmNrQktHTnZjbVV2WTNCMUwyOXdZMjlrWlhNdlpXbG5hSFJDYVhSVGRHOXlaVk41Ym1ORGVXTnNaWFBLQVJsamIzSmxMMk53ZFM5bWJHRm5jeTl6WlhSR2JHRm5RbWwweXdFZlkyOXlaUzlqY0hVdlpteGhaM012YzJWMFNHRnNaa05oY25KNVJteGhaOHdCTDJOdmNtVXZZM0IxTDJac1lXZHpMMk5vWldOclFXNWtVMlYwUldsbmFIUkNhWFJJWVd4bVEyRnljbmxHYkdGbnpRRWFZMjl5WlM5amNIVXZabXhoWjNNdmMyVjBXbVZ5YjBac1lXZk9BUjVqYjNKbEwyTndkUzltYkdGbmN5OXpaWFJUZFdKMGNtRmpkRVpzWVdmUEFSdGpiM0psTDJOd2RTOW1iR0ZuY3k5elpYUkRZWEp5ZVVac1lXZlFBU0ZqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2Y205MFlYUmxRbmwwWlV4bFpuVFJBVFpqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzl6YVhoMFpXVnVRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbmxYYVhSb1ZISmhjSFBTQVNwamIzSmxMMk53ZFM5dmNHTnZaR1Z6TDNOcGVIUmxaVzVDYVhSVGRHOXlaVk41Ym1ORGVXTnNaWFBUQVRSamIzSmxMMk53ZFM5bWJHRm5jeTlqYUdWamEwRnVaRk5sZEZOcGVIUmxaVzVDYVhSR2JHRm5jMEZrWkU5MlpYSm1iRzkzMUFFblkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5bGFXZG9kRUpwZEV4dllXUlRlVzVqUTNsamJHVnoxUUVpWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKdmRHRjBaVUo1ZEdWU2FXZG9kTllCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE1IalhBUnRqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJEWVhKeWVVWnNZV2ZZQVMxamIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmNtOTBZWFJsUW5sMFpVeGxablJVYUhKdmRXZG9RMkZ5Y25uWkFTRmpiM0psTDNCdmNuUmhZbXhsTDNCdmNuUmhZbXhsTDJrNFVHOXlkR0ZpYkdYYUFTSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y21Wc1lYUnBkbVZLZFcxdzJ3RXVZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM0p2ZEdGMFpVSjVkR1ZTYVdkb2RGUm9jbTkxWjJoRFlYSnllZHdCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE1YamRBUnBqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJhWlhKdlJteGhaOTRCSDJOdmNtVXZZM0IxTDJac1lXZHpMMmRsZEVoaGJHWkRZWEp5ZVVac1lXZmZBUjVqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJUZFdKMGNtRmpkRVpzWVdmZ0FSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVEo0NFFFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXplT0lCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE5IampBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRWNDVBRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1UyZU9VQkcyTnZjbVV2WTNCMUwyTndkUzlEY0hVdVpXNWhZbXhsU0dGc2RPWUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTjNqbkFTdGpiM0psTDJOd2RTOW1iR0ZuY3k5amFHVmphMEZ1WkZObGRFVnBaMmgwUW1sMFEyRnljbmxHYkdGbjZBRWlZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDJGa1pFRlNaV2RwYzNSbGN1a0JMbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5aFpHUkJWR2h5YjNWbmFFTmhjbko1VW1WbmFYTjBaWExxQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUaDQ2d0VpWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzTjFZa0ZTWldkcGMzUmxjdXdCTG1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXpkV0pCVkdoeWIzVm5hRU5oY25KNVVtVm5hWE4wWlhMdEFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVGw0N2dFaVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMMkZ1WkVGU1pXZHBjM1JsY3U4QkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTk0YjNKQlVtVm5hWE4wWlhMd0FSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVUY0OFFFaFkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMMjl5UVZKbFoybHpkR1Z5OGdFaFkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMMk53UVZKbFoybHpkR1Z5OHdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkNlUFFCSzJOdmNtVXZiV1Z0YjNKNUwyeHZZV1F2YzJsNGRHVmxia0pwZEV4dllXUkdjbTl0UjBKTlpXMXZjbm4xQVNsamIzSmxMMk53ZFM5dmNHTnZaR1Z6TDNOcGVIUmxaVzVDYVhSTWIyRmtVM2x1WTBONVkyeGxjL1lCS0dOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXliM1JoZEdWU1pXZHBjM1JsY2t4bFpuVDNBU2xqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpTYVdkb2RQZ0JOR052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5eWIzUmhkR1ZTWldkcGMzUmxja3hsWm5SVWFISnZkV2RvUTJGeWNubjVBVFZqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpTYVdkb2RGUm9jbTkxWjJoRFlYSnllZm9CSjJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXphR2xtZEV4bFpuUlNaV2RwYzNSbGN2c0JNbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRkpwWjJoMFFYSnBkR2h0WlhScFkxSmxaMmx6ZEdWeS9BRXJZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNOM1lYQk9hV0ppYkdWelQyNVNaV2RwYzNSbGN2MEJMMk52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRkpwWjJoMFRHOW5hV05oYkZKbFoybHpkR1Z5L2dFblkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM1JsYzNSQ2FYUlBibEpsWjJsemRHVnkvd0VtWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzTmxkRUpwZEU5dVVtVm5hWE4wWlhLQUFpRmpiM0psTDJOd2RTOWpZazl3WTI5a1pYTXZhR0Z1Wkd4bFEySlBjR052WkdXQkFoOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVU40Z2dJb1kyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmMyVjBTVzUwWlhKeWRYQjBjNE1DSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFJIaUVBaDlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVWNGhRSWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1ZHZUlZQ0htTnZjbVV2WTNCMUwyOXdZMjlrWlhNdlpYaGxZM1YwWlU5d1kyOWtaWWNDSUdOdmNtVXZZM0IxTDJOd2RTOURjSFV1WlhocGRFaGhiSFJCYm1SVGRHOXdpQUlaWTI5eVpTOWpjSFV2WTNCMUwwTndkUzVwYzBoaGJIUmxaSWtDTFdOdmNtVXZiV1Z0YjNKNUwzTjBiM0psTDNOcGVIUmxaVzVDYVhSVGRHOXlaVWx1ZEc5SFFrMWxiVzl5ZVlvQ0syTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwxOW9ZVzVrYkdWSmJuUmxjbkoxY0hTTEFpcGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OWphR1ZqYTBsdWRHVnljblZ3ZEhPTUFocGpiM0psTDJWNFpXTjFkR1V2ZEhKaFkydFRkR1Z3YzFKaGJvMENHR052Y21VdlpYaGxZM1YwWlM5bGVHVmpkWFJsVTNSbGNJNENKV052Y21VdlkzQjFMMk53ZFM5RGNIVXVUVUZZWDBOWlEweEZVMTlRUlZKZlJsSkJUVVdQQWpCamIzSmxMM052ZFc1a0wzTnZkVzVrTDJkbGRFNTFiV0psY2s5bVUyRnRjR3hsYzBsdVFYVmthVzlDZFdabVpYS1FBaUpqYjNKbEwyVjRaV04xZEdVdlpYaGxZM1YwWlZWdWRHbHNRMjl1WkdsMGFXOXVrUUlaWTI5eVpTOWxlR1ZqZFhSbEwyVjRaV04xZEdWR2NtRnRaWklDSW1OdmNtVXZaWGhsWTNWMFpTOWxlR1ZqZFhSbFRYVnNkR2x3YkdWR2NtRnRaWE9UQWlaamIzSmxMMlY0WldOMWRHVXZaWGhsWTNWMFpVWnlZVzFsUVc1a1EyaGxZMnRCZFdScGI1UUNLR052Y21VdlpYaGxZM1YwWlM5bGVHVmpkWFJsUm5KaGJXVlZiblJwYkVKeVpXRnJjRzlwYm5TVkFpQmpiM0psTDJONVkyeGxjeTluWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEpZQ0dHTnZjbVV2WTNsamJHVnpMMmRsZEVONVkyeGxVMlYwYzVjQ0ZXTnZjbVV2WTNsamJHVnpMMmRsZEVONVkyeGxjNWdDTkdOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5ZloyVjBTbTk1Y0dGa1FuVjBkRzl1VTNSaGRHVkdjbTl0UW5WMGRHOXVTV1NaQWpSamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdlgzTmxkRXB2ZVhCaFpFSjFkSFJ2YmxOMFlYUmxSbkp2YlVKMWRIUnZia2xrbWdJeFkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmNtVnhkV1Z6ZEVwdmVYQmhaRWx1ZEdWeWNuVndkSnNDSldOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5ZmNISmxjM05LYjNsd1lXUkNkWFIwYjI2Y0FpZGpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZYM0psYkdWaGMyVktiM2x3WVdSQ2RYUjBiMjZkQWlGamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdmMyVjBTbTk1Y0dGa1UzUmhkR1dlQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja0dmQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja0tnQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja09oQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja1NpQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja1dqQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja2lrQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja3lsQWlGamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJTWldkcGMzUmxja2FtQWlaamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJRY205bmNtRnRRMjkxYm5SbGNxY0NKR052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGTjBZV05yVUc5cGJuUmxjcWdDTG1OdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRTl3WTI5a1pVRjBVSEp2WjNKaGJVTnZkVzUwWlhLcEFoOWpiM0psTDJSbFluVm5MMlJsWW5WbkxXZHlZWEJvYVdOekwyZGxkRXhacWdJM1kyOXlaUzlrWldKMVp5OWtaV0oxWnkxbmNtRndhR2xqY3k5a2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVhc0NOMk52Y21VdlozSmhjR2hwWTNNdmRHbHNaWE12WkhKaGQxQnBlR1ZzYzBaeWIyMU1hVzVsVDJaVWFXeGxmSFJ5WVcxd2IyeHBibVdzQWpKamIzSmxMMlJsWW5WbkwyUmxZblZuTFdkeVlYQm9hV056TDJSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllYTBDSFdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0ZEdsdFpYSXZaMlYwUkVsV3JnSWVZMjl5WlM5a1pXSjFaeTlrWldKMVp5MTBhVzFsY2k5blpYUlVTVTFCcndJZFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxMGFXMWxjaTluWlhSVVRVR3dBaDFqYjNKbEwyUmxZblZuTDJSbFluVm5MWFJwYldWeUwyZGxkRlJCUTdFQ0JYTjBZWEowc2dJeFkyOXlaUzlsZUdWamRYUmxMMlY0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOThkSEpoYlhCdmJHbHVaYk1DQ0g1elpYUmhjbWRqdEFJdFkyOXlaUzlsZUdWamRYUmxMMlY0WldOMWRHVlZiblJwYkVOdmJtUnBkR2x2Ym54MGNtRnRjRzlzYVc1bHRRSkNZMjl5WlM5a1pXSjFaeTlrWldKMVp5MW5jbUZ3YUdsamN5OWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllWHgwY21GdGNHOXNhVzVsQURNUWMyOTFjbU5sVFdGd2NHbHVaMVZTVENGamIzSmxMMlJwYzNRdlkyOXlaUzUxYm5SdmRXTm9aV1F1ZDJGemJTNXRZWEE9Iik6CmF3YWl0IEwoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZmhCZ0NYOS9mMzkvZjM5L2Z3QmdBQUJnQVg4QmYyQUNmMzhBWUFGL0FHQUNmMzhCZjJBQUFYOWdBMzkvZndGL1lBTi9mMzhBWUFaL2YzOS9mMzhBWUFkL2YzOS9mMzkvQVg5Z0JIOS9mMzhBWUExL2YzOS9mMzkvZjM5L2YzOS9BWDlnQjM5L2YzOS9mMzhBWUFSL2YzOS9BWDlnQ0g5L2YzOS9mMzkvQUFPNEFyWUNBZ0lDQWdFQkF3RUJBUUVCQVFFQkFRVUVCQUVCQkFFQkFRQUdCUU1CQVFFQkFRRUJBUUVCQVFFQ0FRUUJBUVFCQVFFQkFRRUJBUUVCQmdZR0FnWUdCUVVMQlFVRkJRc0tCUVVGQndVSEJ3d0tEUWtKQ0FnREJBRUJBUVlHQkFFR0JnRUJBUUVHQkFFQkFRRUJBZ0lDQWdJQ0FRVUNCZ0VDQmdFQ0FnWUdBZ1lHQmdVT0NBUUNBZ1FFQVFJR0FnSURCQVFFQkFRRUJBUUVCQVFFQkFRRUFRUUJCQUVFQVFRRUJBVUVCQVlHQkFnREF3RUNCUUVFQVFRRUJBUUZBd2dCQVFFRUFRUUVCZ1lHQXdVRUF3UUVCQUlEQXdnQ0FnSUdBZ0lFQWdJR0JnWUNBZ0lDQWdFQ0F3UUVBZ1FFQWdRRUFnUUVBZ0lDQWdJQ0FnSUNBZ0lGQndJQ0JBSUNBZ0lCQmdNRUJnUUdCZ1lIQmdJQ0FnWUdCZ0lEQVFRRUR3WUdCZ1lHQmdZR0JnWUdCZ1FNQVFZR0JnWUJBZ1FIQkFVREFRQUFCcE1MaFFKL0FFRUFDMzhBUVlDQXJBUUxmd0JCaXdFTGZ3QkJBQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUVBdC9BRUgvL3dNTGZ3QkJnQkFMZndCQmdJQUJDMzhBUVlDUUFRdC9BRUdBZ0FJTGZ3QkJnSkFEQzM4QVFZQ0FBUXQvQUVHQWtBUUxmd0JCZ09nZkMzOEFRWUNRQkF0L0FFR0FCQXQvQUVHQW9BUUxmd0JCZ0xnQkMzOEFRWURZQlF0L0FFR0EyQVVMZndCQmdKZ09DMzhBUVlDQURBdC9BRUdBbUJvTGZ3QkJnSUFKQzM4QVFZQ1lJd3QvQUVHQTRBQUxmd0JCZ1BnakMzOEFRWUNBQ0F0L0FFR0ErQ3NMZndCQmdJQUlDMzhBUVlENE13dC9BRUdBaVBnREMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCei80REMzOEJRUUFMZndGQjhQNERDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWY4QUMzOEJRZjhBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVlDbzFya0hDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUQzQWd0L0FVR0FnQWdMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSFYvZ01MZndGQjBmNERDMzhCUWRMK0F3dC9BVUhUL2dNTGZ3RkIxUDREQzM4QlFlaitBd3QvQVVIci9nTUxmd0ZCNmY0REMzOEJRUUFMZndCQmdJQ3NCQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVILy93TUxmd0JCZ0pBRUMzOEFRWUNRQkF0L0FFR0FCQXQvQUVHQTJBVUxmd0JCZ0pnT0MzOEFRWUNZR2d0L0FFR0ErQ01MZndCQmdQZ3JDMzhBUVlENE13c0h4UTlkQm0xbGJXOXllUUlBQm1OdmJtWnBad0FaRG1oaGMwTnZjbVZUZEdGeWRHVmtBQm9KYzJGMlpWTjBZWFJsQUNnSmJHOWhaRk4wWVhSbEFEZ1NaMlYwVTNSbGNITlFaWEpUZEdWd1UyVjBBRGtMWjJWMFUzUmxjRk5sZEhNQU9naG5aWFJUZEdWd2N3QTdGV1Y0WldOMWRHVk5kV3gwYVhCc1pVWnlZVzFsY3dDU0FneGxlR1ZqZFhSbFJuSmhiV1VBa1FJSVgzTmxkR0Z5WjJNQXN3SVpaWGhsWTNWMFpVWnlZVzFsUVc1a1EyaGxZMnRCZFdScGJ3Q3lBaHRsZUdWamRYUmxSbkpoYldWVmJuUnBiRUp5WldGcmNHOXBiblFBbEFJVlpYaGxZM1YwWlZWdWRHbHNRMjl1WkdsMGFXOXVBTFFDQzJWNFpXTjFkR1ZUZEdWd0FJMENGR2RsZEVONVkyeGxjMUJsY2tONVkyeGxVMlYwQUpVQ0RHZGxkRU41WTJ4bFUyVjBjd0NXQWdsblpYUkRlV05zWlhNQWx3SU9jMlYwU205NWNHRmtVM1JoZEdVQW5RSWZaMlYwVG5WdFltVnlUMlpUWVcxd2JHVnpTVzVCZFdScGIwSjFabVpsY2dDUEFoQmpiR1ZoY2tGMVpHbHZRblZtWm1WeUFESVhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0REFCTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBd0VTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXdJZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd01hUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQkJaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd1VTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdZZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQnh4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3Z1NWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd2tPVmtsRVJVOWZVa0ZOWDFOSldrVURDaEZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01MRFZkUFVrdGZVa0ZOWDFOSldrVUREQ1pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNTklrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVRERoaEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0RER4UkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1RRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F4RVFSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTVNHRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTVRGRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXhRT1JsSkJUVVZmVEU5RFFWUkpUMDRERlFwR1VrRk5SVjlUU1ZwRkF4WVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REZ4TkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeGdTVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhrT1ZFbE1SVjlFUVZSQlgxTkpXa1VER2hKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REd3NVBRVTFmVkVsTVJWTmZVMGxhUlFNY0ZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01kRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXg0V1EwRlNWRkpKUkVkRlgxSkJUVjlNVDBOQlZFbFBUZ01mRWtOQlVsUlNTVVJIUlY5U1FVMWZVMGxhUlFNZ0ZrTkJVbFJTU1VSSFJWOVNUMDFmVEU5RFFWUkpUMDRESVJKRFFWSlVVa2xFUjBWZlVrOU5YMU5KV2tVRElpRm5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRQUFneG5aWFJTWldkcGMzUmxja0VBbmdJTVoyVjBVbVZuYVhOMFpYSkNBSjhDREdkbGRGSmxaMmx6ZEdWeVF3Q2dBZ3huWlhSU1pXZHBjM1JsY2tRQW9RSU1aMlYwVW1WbmFYTjBaWEpGQUtJQ0RHZGxkRkpsWjJsemRHVnlTQUNqQWd4blpYUlNaV2RwYzNSbGNrd0FwQUlNWjJWMFVtVm5hWE4wWlhKR0FLVUNFV2RsZEZCeWIyZHlZVzFEYjNWdWRHVnlBS1lDRDJkbGRGTjBZV05yVUc5cGJuUmxjZ0NuQWhsblpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5QUtnQ0JXZGxkRXhaQUtrQ0hXUnlZWGRDWVdOclozSnZkVzVrVFdGd1ZHOVhZWE50VFdWdGIzSjVBTFVDR0dSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllUUNzQWdablpYUkVTVllBclFJSFoyVjBWRWxOUVFDdUFnWm5aWFJVVFVFQXJ3SUdaMlYwVkVGREFMQUNCblZ3WkdGMFpRQ1JBZzFsYlhWc1lYUnBiMjVUZEdWd0FJMENFbWRsZEVGMVpHbHZVWFZsZFdWSmJtUmxlQUNQQWc5eVpYTmxkRUYxWkdsdlVYVmxkV1VBTWc1M1lYTnRUV1Z0YjNKNVUybDZaUVAzQVJ4M1lYTnRRbTk1U1c1MFpYSnVZV3hUZEdGMFpVeHZZMkYwYVc5dUEvZ0JHSGRoYzIxQ2IzbEpiblJsY201aGJGTjBZWFJsVTJsNlpRUDVBUjFuWVcxbFFtOTVTVzUwWlhKdVlXeE5aVzF2Y25sTWIyTmhkR2x2YmdQNkFSbG5ZVzFsUW05NVNXNTBaWEp1WVd4TlpXMXZjbmxUYVhwbEEvc0JFM1pwWkdWdlQzVjBjSFYwVEc5allYUnBiMjREL0FFaVpuSmhiV1ZKYmxCeWIyZHlaWE56Vm1sa1pXOVBkWFJ3ZFhSTWIyTmhkR2x2YmdQL0FSdG5ZVzFsWW05NVEyOXNiM0pRWVd4bGRIUmxURzlqWVhScGIyNEQvUUVYWjJGdFpXSnZlVU52Ykc5eVVHRnNaWFIwWlZOcGVtVUQvZ0VWWW1GamEyZHliM1Z1WkUxaGNFeHZZMkYwYVc5dUE0QUNDM1JwYkdWRVlYUmhUV0Z3QTRFQ0UzTnZkVzVrVDNWMGNIVjBURzlqWVhScGIyNERnZ0lSWjJGdFpVSjVkR1Z6VEc5allYUnBiMjREaEFJVVoyRnRaVkpoYlVKaGJtdHpURzlqWVhScGIyNERnd0lJQXJFQ0N0ak1BYllDS3dFQ2Z5TXRJUUVqTGtVaUFnUkFJQUZGSVFJTElBSUVRRUVCSVFFTElBRkJEblFnQUVHQWdBRnJhZ3NQQUNNeFFRMTBJQUJCZ01BQ2Eyb0x0d0VCQW44Q1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVF4MUlnSWhBU0FDUlEwQUFrQWdBVUVCYXc0TkFRRUJBZ0lDQWdNREJBUUZCZ0FMREFZTElBQkJnUGd6YWc4TElBQVFBRUdBK0ROcUR3dEJBQ0VCSXk4RVFDTXdFQU5CQVhFaEFRc2dBRUdBa0g1cUlBRkJEWFJxRHdzZ0FCQUJRWUQ0SzJvUEN5QUFRWUNRZm1vUEMwRUFJUUVqTHdSQUl6SVFBMEVIY1NFQkN5QUJRUUZJQkVCQkFTRUJDeUFBSUFGQkRIUnFRWUR3ZldvUEN5QUFRWUJRYWdzSkFDQUFFQUl0QUFBTG1RRUFRUUFrTTBFQUpEUkJBQ1ExUVFBa05rRUFKRGRCQUNRNFFRQWtPVUVBSkRwQkFDUTdRUUFrUEVFQUpEMUJBQ1ErUVFBa1AwRUFKRUJCQUNSQlFRQWtRaU12QkVCQkVTUTBRWUFCSkR0QkFDUTFRUUFrTmtIL0FTUTNRZFlBSkRoQkFDUTVRUTBrT2dWQkFTUTBRYkFCSkR0QkFDUTFRUk1rTmtFQUpEZEIyQUVrT0VFQkpEbEJ6UUFrT2d0QmdBSWtQVUgrL3dNa1BBdWtBUUVDZjBFQUpFTkJBU1JFUWNjQ0VBTWhBVUVBSkVWQkFDUkdRUUFrUjBFQUpFaEJBQ1F1SUFFRVFDQUJRUUZPSWdBRVFDQUJRUU5NSVFBTElBQUVRRUVCSkVZRklBRkJCVTRpQUFSQUlBRkJCa3doQUFzZ0FBUkFRUUVrUndVZ0FVRVBUaUlBQkVBZ0FVRVRUQ0VBQ3lBQUJFQkJBU1JJQlNBQlFSbE9JZ0FFUUNBQlFSNU1JUUFMSUFBRVFFRUJKQzRMQ3dzTEJVRUJKRVVMUVFFa0xVRUFKREVMQ3dBZ0FCQUNJQUU2QUFBTEx3QkIwZjREUWY4QkVBWkIwdjREUWY4QkVBWkIwLzREUWY4QkVBWkIxUDREUWY4QkVBWkIxZjREUWY4QkVBWUxtQUVBUVFBa1NVRUFKRXBCQUNSTFFRQWtURUVBSkUxQkFDUk9RUUFrVHlNdkJFQkJrQUVrUzBIQS9nTkJrUUVRQmtIQi9nTkJnUUVRQmtIRS9nTkJrQUVRQmtISC9nTkIvQUVRQmdWQmtBRWtTMEhBL2dOQmtRRVFCa0hCL2dOQmhRRVFCa0hHL2dOQi93RVFCa0hIL2dOQi9BRVFCa0hJL2dOQi93RVFCa0hKL2dOQi93RVFCZ3RCei80RFFRQVFCa0h3L2dOQkFSQUdDMDhBSXk4RVFFSG8vZ05Cd0FFUUJrSHAvZ05CL3dFUUJrSHEvZ05Cd1FFUUJrSHIvZ05CRFJBR0JVSG8vZ05CL3dFUUJrSHAvZ05CL3dFUUJrSHEvZ05CL3dFUUJrSHIvZ05CL3dFUUJnc0xMd0JCa1A0RFFZQUJFQVpCa2Y0RFFiOEJFQVpCa3Y0RFFmTUJFQVpCay80RFFjRUJFQVpCbFA0RFFiOEJFQVlMTEFCQmxmNERRZjhCRUFaQmx2NERRVDhRQmtHWC9nTkJBQkFHUVpqK0EwRUFFQVpCbWY0RFFiZ0JFQVlMTWdCQm12NERRZjhBRUFaQm0vNERRZjhCRUFaQm5QNERRWjhCRUFaQm5mNERRUUFRQmtHZS9nTkJ1QUVRQmtFQkpHQUxMUUJCbi80RFFmOEJFQVpCb1A0RFFmOEJFQVpCb2Y0RFFRQVFCa0dpL2dOQkFCQUdRYVArQTBHL0FSQUdDemdBUVE4a1lVRVBKR0pCRHlSalFROGtaRUVBSkdWQkFDUm1RUUFrWjBFQUpHaEIvd0FrYVVIL0FDUnFRUUVrYTBFQkpHeEJBQ1J0QzJjQVFRQWtVRUVBSkZGQkFDUlNRUUVrVTBFQkpGUkJBU1JWUVFFa1ZrRUJKRmRCQVNSWVFRRWtXVUVCSkZwQkFTUmJRUUFrWEVFQUpGMUJBQ1JlUVFBa1h4QUtFQXNRREJBTlFhVCtBMEgzQUJBR1FhWCtBMEh6QVJBR1FhYitBMEh4QVJBR0VBNExEUUFnQVVFQklBQjBjVUVBUndzbUFFRUFJQUFRRUNSdVFRRWdBQkFRSkc5QkFpQUFFQkFrY0VFRUlBQVFFQ1J4SUFBa2Nnc21BRUVBSUFBUUVDUnpRUUVnQUJBUUpIUkJBaUFBRUJBa2RVRUVJQUFRRUNSMklBQWtkd3NiQUVFQUVCRkIvLzhESTNJUUJrSGhBUkFTUVkvK0F5TjNFQVlMVWdCQkFDUjRRUUFrZVVFQUpIcEJBQ1I3UVFBa2ZFRUFKSDFCQUNSK1FRQWtmeU12QkVCQmhQNERRUjRRQmtHZ1BTUjVCVUdFL2dOQnF3RVFCa0hNMXdJa2VRdEJoLzREUWZnQkVBWkIrQUVrZlFzSkFDQUFRUUZ4SkNNTEZRQkJnS2pXdVFja2dBRkJBQ1NCQVVFQUpJSUJDeFVBUVlDbzFya0hKSU1CUVFBa2hBRkJBQ1NGQVF2UEFRRUNmMEhEQWhBRElnRkJ3QUZHSWdCRkJFQWpKUVIvSUFGQmdBRkdCU01sQ3lFQUN5QUFCRUJCQVNRdkJVRUFKQzhMRUFRUUJSQUhFQWdRQ1JBUEVCTVFGQ012QkVCQjhQNERRZmdCRUFaQnovNERRZjRCRUFaQnpmNERRZjRBRUFaQmdQNERRYzhCRUFaQmd2NERRZndBRUFaQmovNERRZUVCRUFaQjdQNERRZjRCRUFaQjlmNERRWThCRUFZRlFmRCtBMEgvQVJBR1FjLytBMEgvQVJBR1FjMytBMEgvQVJBR1FZRCtBMEhQQVJBR1FZTCtBMEgrQUJBR1FZLytBMEhoQVJBR0MwRUFFQlVRRmhBWEM1MEJBQ0FBUVFCS0JFQkJBU1FrQlVFQUpDUUxJQUZCQUVvRVFFRUJKQ1VGUVFBa0pRc2dBa0VBU2dSQVFRRWtKZ1ZCQUNRbUN5QURRUUJLQkVCQkFTUW5CVUVBSkNjTElBUkJBRW9FUUVFQkpDZ0ZRUUFrS0FzZ0JVRUFTZ1JBUVFFa0tRVkJBQ1FwQ3lBR1FRQktCRUJCQVNRcUJVRUFKQ29MSUFkQkFFb0VRRUVCSkNzRlFRQWtLd3NnQ0VFQVNnUkFRUUVrTEFWQkFDUXNDeEFZQ3d3QUl5TUVRRUVCRHd0QkFBc09BQ0FBUVlBSWFpQUJRVEpzYWdzWkFDQUJRUUZ4QkVBZ0FFRUJPZ0FBQlNBQVFRQTZBQUFMQzZNQkFFRUFRUUFRR3lNME9nQUFRUUZCQUJBYkl6VTZBQUJCQWtFQUVCc2pOam9BQUVFRFFRQVFHeU0zT2dBQVFRUkJBQkFiSXpnNkFBQkJCVUVBRUJzak9Ub0FBRUVHUVFBUUd5TTZPZ0FBUVFkQkFCQWJJenM2QUFCQkNFRUFFQnNqUERzQkFFRUtRUUFRR3lNOU93RUFRUXhCQUJBYkl6NDJBZ0JCRVVFQUVCc2pQeEFjUVJKQkFCQWJJMEFRSEVFVFFRQVFHeU5CRUJ4QkZFRUFFQnNqUWhBY0N5RUFRUUJCQVJBYkkwbzJBZ0JCQkVFQkVCc2poZ0U2QUFCQnhQNERJMHNRQmdzWUFFRUFRUUlRR3lPSEFSQWNRUUZCQWhBYkk0Z0JFQndMQXdBQkMxNEFRUUJCQkJBYkl5MDdBUUJCQWtFRUVCc2pNVHNCQUVFRVFRUVFHeU5ERUJ4QkJVRUVFQnNqUkJBY1FRWkJCQkFiSTBVUUhFRUhRUVFRR3lOR0VCeEJDRUVFRUJzalJ4QWNRUWxCQkJBYkkwZ1FIRUVLUVFRUUd5TXVFQndMTkFCQkFFRUZFQnNqZURZQ0FFRUVRUVVRR3lONU5nSUFRUWhCQlJBYkkzNFFIRUVMUVFVUUd5Ti9FQnhCaGY0REkzb1FCZ3NqQUVFQVFRWVFHeU5jTmdJQVFRUkJCaEFiSTEwNkFBQkJCVUVHRUJzalhqb0FBQXQ0QUVFQVFRY1FHeU9KQVJBY1FRRkJCeEFiSTRvQk5nSUFRUVZCQnhBYkk0c0JOZ0lBUVFsQkJ4QWJJNHdCTmdJQVFRNUJCeEFiSTQwQk5nSUFRUk5CQnhBYkk0NEJPZ0FBUVJSQkJ4QWJJNDhCT2dBQVFSbEJCeEFiSTVBQkVCeEJHa0VIRUJzamtRRTJBZ0JCSDBFSEVCc2prZ0U3QVFBTFZRQkJBRUVJRUJzamt3RVFIRUVCUVFnUUd5T1VBVFlDQUVFRlFRZ1FHeU9WQVRZQ0FFRUpRUWdRR3lPV0FUWUNBRUVPUVFnUUd5T1hBVFlDQUVFVFFRZ1FHeU9ZQVRvQUFFRVVRUWdRR3lPWkFUb0FBQXN4QUVFQVFRa1FHeU9hQVJBY1FRRkJDUkFiSTVzQk5nSUFRUVZCQ1JBYkk1d0JOZ0lBUVFsQkNSQWJJNTBCT3dFQUMwa0FRUUJCQ2hBYkk1NEJFQnhCQVVFS0VCc2pud0UyQWdCQkJVRUtFQnNqb0FFMkFnQkJDVUVLRUJzam9RRTJBZ0JCRGtFS0VCc2pvZ0UyQWdCQkUwRUtFQnNqb3dFN0FRQUxIQUFRSFJBZUVCOFFJQkFoRUNJUUl4QWtFQ1VRSmhBblFRQVFGUXNTQUNBQUxRQUFRUUJLQkVCQkFROExRUUFMb3dFQVFRQkJBQkFiTFFBQUpEUkJBVUVBRUJzdEFBQWtOVUVDUVFBUUd5MEFBQ1EyUVFOQkFCQWJMUUFBSkRkQkJFRUFFQnN0QUFBa09FRUZRUUFRR3kwQUFDUTVRUVpCQUJBYkxRQUFKRHBCQjBFQUVCc3RBQUFrTzBFSVFRQVFHeThCQUNROFFRcEJBQkFiTHdFQUpEMUJERUVBRUJzb0FnQWtQa0VSUVFBUUd4QXBKRDlCRWtFQUVCc1FLU1JBUVJOQkFCQWJFQ2trUVVFVVFRQVFHeEFwSkVJTFNnQkJCeUFBRUJBa3BBRkJCaUFBRUJBa3BRRkJCU0FBRUJBa3BnRkJCQ0FBRUJBa3B3RkJBeUFBRUJBa3FBRkJBaUFBRUJBa3FRRkJBU0FBRUJBa3FnRkJBQ0FBRUJBa3F3RUxLUUJCQUVFQkVCc29BZ0FrU2tFRVFRRVFHeTBBQUNTR0FVSEUvZ01RQXlSTFFjRCtBeEFERUNzTEtBQkJBRUVDRUJzUUtTU0hBVUVCUVFJUUd4QXBKSWdCUWYvL0F4QURFQkZCai80REVBTVFFZ3NmQUNBQVFmOEJjeVNzQVVFRUk2d0JFQkFrclFGQkJTT3NBUkFRSks0QkN3b0FRWUQrQXhBREVDNExYZ0JCQUVFRUVCc3ZBUUFrTFVFQ1FRUVFHeThCQUNReFFRUkJCQkFiRUNra1EwRUZRUVFRR3hBcEpFUkJCa0VFRUJzUUtTUkZRUWRCQkJBYkVDa2tSa0VJUVFRUUd4QXBKRWRCQ1VFRUVCc1FLU1JJUVFwQkJCQWJFQ2trTGd0RUFFRUFRUVVRR3lnQ0FDUjRRUVJCQlJBYktBSUFKSGxCQ0VFRkVCc1FLU1IrUVF0QkJSQWJFQ2trZjBHRi9nTVFBeVI2UVliK0F4QURKSHRCaC80REVBTWtmUXNHQUVFQUpGOExKUUJCQUVFR0VCc29BZ0FrWEVFRVFRWVFHeTBBQUNSZFFRVkJCaEFiTFFBQUpGNFFNZ3Q0QUVFQVFRY1FHeEFwSklrQlFRRkJCeEFiS0FJQUpJb0JRUVZCQnhBYktBSUFKSXNCUVFsQkJ4QWJLQUlBSkl3QlFRNUJCeEFiS0FJQUpJMEJRUk5CQnhBYkxRQUFKSTRCUVJSQkJ4QWJMUUFBSkk4QlFSbEJCeEFiRUNra2tBRkJHa0VIRUJzb0FnQWtrUUZCSDBFSEVCc3ZBUUFra2dFTFZRQkJBRUVJRUJzUUtTU1RBVUVCUVFnUUd5Z0NBQ1NVQVVFRlFRZ1FHeWdDQUNTVkFVRUpRUWdRR3lnQ0FDU1dBVUVPUVFnUUd5Z0NBQ1NYQVVFVFFRZ1FHeTBBQUNTWUFVRVVRUWdRR3kwQUFDU1pBUXN4QUVFQVFRa1FHeEFwSkpvQlFRRkJDUkFiS0FJQUpKc0JRUVZCQ1JBYktBSUFKSndCUVFsQkNSQWJMd0VBSkowQkMwa0FRUUJCQ2hBYkVDa2tuZ0ZCQVVFS0VCc29BZ0FrbndGQkJVRUtFQnNvQWdBa29BRkJDVUVLRUJzb0FnQWtvUUZCRGtFS0VCc29BZ0Frb2dGQkUwRUtFQnN2QVFBa293RUxJQUFRS2hBc0VDMFFMeEF3RURFUU14QTBFRFVRTmhBM1FRQVFGUkFXRUJjTEJRQWpnd0VMQlFBamhBRUxCUUFqaFFFTENRQWdBRUgvL3dOeEN5WUFJek1FUUNOTFFaa0JSZ1JBUVFnUEMwR1FCdzhMSTB0Qm1RRkdCRUJCQkE4TFFjZ0RDd1FBRUQwTEZRQWdBRUdBa0g1cUlBRkJBWEZCRFhScUxRQUFDdzRBSUFGQm9BRnNJQUJxUVFOc0N4VUFJQUFnQVJCQVFZRFlCV29nQW1vZ0F6b0FBQXNMQUNBQlFhQUJiQ0FBYWdzUUFDQUFJQUVRUWtHQW9BUnFMUUFBQ3cwQUlBRkJBU0FBZEVGL2MzRUxDZ0FnQVVFQklBQjBjZ3NyQVFGL0lBSkJBM0VoQkNBRFFRRnhCRUJCQWlBRUVFVWhCQXNnQUNBQkVFSkJnS0FFYWlBRU9nQUFDNjRDQVFOL0lBRkJBRW9pQXdSQUlBQkJDRW9oQXdzZ0F3UkFJQVlqc0FGR0lRTUxJQU1FUUNBQUk3RUJSaUVEQ3lBREJFQkJBQ0VEUVFBaEJrRUZJQVJCQVdzUUF4QVFCRUJCQVNFREMwRUZJQVFRQXhBUUJFQkJBU0VHQ3dKQVFRQWhCQU5BSUFSQkNFNE5BU0FESUFaSEJFQkJCeUFFYXlFRUN5QUFJQVJxUWFBQlRBUkFJQUJCQ0NBRWEyc2hDQ0FBSUFScUlBRVFRRUdBMkFWcUlRa0NRRUVBSVFVRFFDQUZRUU5PRFFFZ0FDQUVhaUFCSUFVZ0NTQUZhaTBBQUJCQklBVkJBV29oQlF3QUFBc0FDeUFBSUFScUlBRkJBaUFJSUFFUVF5SUZFRVJCQWlBRkVCQVFSaUFIUVFGcUlRY0xJQVJCQVdvaEJBd0FBQXNBQ3dVZ0JpU3dBUXNnQUNPeEFVNEVRQ0FBUVFocUpMRUJJQUFnQWtFSWJ5SUdTQVJBSTdFQklBWnFKTEVCQ3dzZ0J3czRBUUYvSUFCQmdKQUNSZ1JBSUFGQmdBRnFJUUpCQnlBQkVCQUVRQ0FCUVlBQmF5RUNDeUFBSUFKQkJIUnFEd3NnQUNBQlFRUjBhZ3NrQVFGL0lBQkJQM0VoQWlBQlFRRnhCRUFnQWtGQWF5RUNDeUFDUVlDUUJHb3RBQUFMRWdBZ0FFSC9BWEZCQ0hRZ0FVSC9BWEZ5Q3lBQkFYOGdBRUVEZENBQlFRRjBhaUlEUVFGcUlBSVFTU0FESUFJUVNSQktDeFVBSUFGQkh5QUFRUVZzSWdCMGNTQUFkVUVEZEF0WkFDQUNRUUZ4UlFSQUlBRVFBeUFBUVFGMGRVRURjU0VBQzBIeUFTRUJBa0FDUUFKQUFrQUNRQ0FBUlEwRUFrQWdBRUVCYXc0REFnTUVBQXNNQkFBTEFBdEJvQUVoQVF3Q0MwSFlBQ0VCREFFTFFRZ2hBUXNnQVFzTkFDQUJJQUpzSUFCcVFRTnNDNnNDQVFaL0lBRWdBQkJJSUFWQkFYUnFJZ0FnQWhBL0lSRWdBRUVCYWlBQ0VEOGhFZ0pBSUFNaEFBTkFJQUFnQkVvTkFTQUdJQUFnQTJ0cUlnNGdDRWdFUUNBQUlRRWdERUVBU0NJQ1JRUkFRUVVnREJBUVJTRUNDeUFDQkVCQkJ5QUJheUVCQzBFQUlRSWdBU0FTRUJBRVFFRUNJUUlMSUFFZ0VSQVFCRUFnQWtFQmFpRUNDeUFNUVFCT0JIOUJBQ0FNUVFkeElBSkJBQkJMSWdVUVRDRVBRUUVnQlJCTUlRRkJBaUFGRUV3RklBdEJBRXdFUUVISC9nTWhDd3NnQWlBTElBb1FUU0lGSVE4Z0JTSUJDeUVGSUFrZ0RpQUhJQWdRVG1vaUVDQVBPZ0FBSUJCQkFXb2dBVG9BQUNBUVFRSnFJQVU2QUFCQkFDRUJJQXhCQUU0RVFFRUhJQXdRRUNFQkN5QU9JQWNnQWlBQkVFWWdEVUVCYWlFTkN5QUFRUUZxSVFBTUFBQUxBQXNnRFF1RkFRRURmeUFEUVFodklRTWdBRVVFUUNBQ0lBSkJDRzFCQTNScklRY0xRUWNoQ0NBQVFRaHFRYUFCU2dSQVFhQUJJQUJySVFnTFFYOGhBaU12QkVCQkF5QUVRUUVRUHlJQ1FmOEJjUkFRQkVCQkFTRUpDMEVHSUFJUUVBUkFRUWNnQTJzaEF3c0xJQVlnQlNBSklBY2dDQ0FESUFBZ0FVR2dBVUdBMkFWQkFFRUFJQUlRVHd2ZEFRQWdCU0FHRUVnaEJpQUVRUUVRUHlFRUlBTkJDRzhoQTBFR0lBUVFFQVJBUVFjZ0Eyc2hBd3RCQUNFRlFRTWdCQkFRQkVCQkFTRUZDeUFHSUFOQkFYUnFJZ01nQlJBL0lRWWdBMEVCYWlBRkVEOGhCU0FDUVFodklRTkJCU0FFRUJCRkJFQkJCeUFEYXlFREMwRUFJUUlnQXlBRkVCQUVRRUVDSVFJTElBTWdCaEFRQkVBZ0FrRUJhaUVDQzBFQUlBUkJCM0VnQWtFQUVFc2lBeEJNSVFWQkFTQURFRXdoQmtFQ0lBTVFUQ0VESUFBZ0FVRUFJQVVRUVNBQUlBRkJBU0FHRUVFZ0FDQUJRUUlnQXhCQklBQWdBU0FDUVFjZ0JCQVFFRVlMZndBZ0JDQUZFRWdnQTBFSWIwRUJkR29pQkVFQUVEOGhCVUVBSVFNZ0JFRUJha0VBRUQ4aEJFRUhJQUpCQ0c5cklnSWdCQkFRQkVCQkFpRURDeUFDSUFVUUVBUkFJQU5CQVdvaEF3c2dBQ0FCUVFBZ0EwSEgvZ05CQUJCTklnSVFRU0FBSUFGQkFTQUNFRUVnQUNBQlFRSWdBaEJCSUFBZ0FTQURRUUFRUmd2Y0FRRUdmeUFEUVFOMUlRc0NRQU5BSUFSQm9BRk9EUUVnQkNBRmFpSUdRWUFDVGdSQUlBWkJnQUpySVFZTElBSWdDMEVGZEdvZ0JrRURkV29pQ1VFQUVEOGhCMEVBSVFvakxBUkFJQVFnQUNBR0lBTWdDU0FCSUFjUVJ5SUlRUUJLQkVBZ0JDQUlRUUZyYWlFRVFRRWhDZ3NMSXlzRWZ5QUtSUVVqS3dzaUNBUkFJQVFnQUNBR0lBTWdDU0FCSUFjUVVDSUlRUUJLQkVBZ0JDQUlRUUZyYWlFRUN3VWdDa1VFUUNNdkJFQWdCQ0FBSUFZZ0F5QUpJQUVnQnhCUkJTQUVJQUFnQmlBRElBRWdCeEJTQ3dzTElBUkJBV29oQkF3QUFBc0FDd3NzQVFKL0kwd2hCQ0FBSTAxcUlnTkJnQUpPQkVBZ0EwR0FBbXNoQXdzZ0FDQUJJQUlnQTBFQUlBUVFVd3N3QVFOL0kwNGhBeUFBSTA4aUJFZ0VRQThMSUFOQkIyc2lBMEYvYkNFRklBQWdBU0FDSUFBZ0JHc2dBeUFGRUZNTGhnVUJFSDhDUUVFbklRa0RRQ0FKUVFCSURRRWdDVUVDZENJRFFZRDhBMm9RQXlFQ0lBTkJnZndEYWhBRElRc2dBMEdDL0FOcUVBTWhCQ0FDUVJCcklRSWdDMEVJYXlFTFFRZ2hCU0FCUVFGeEJFQkJFQ0VGSUFSQkFtOUJBVVlFUUNBRVFRRnJJUVFMQ3lBQUlBSk9JZ1lFUUNBQUlBSWdCV3BJSVFZTElBWUVRRUVISUFOQmcvd0RhaEFESWdZUUVDRU1RUVlnQmhBUUlRTkJCU0FHRUJBaER5QUFJQUpySVFJZ0F3UkFJQUlnQld0QmYyeEJBV3NoQWd0QmdJQUNJQVFRU0NBQ1FRRjBhaUVFUVFBaEFpTXZCSDlCQXlBR0VCQUZJeThMSWdNRVFFRUJJUUlMSUFRZ0FoQS9JUkFnQkVFQmFpQUNFRDhoRVFKQVFRY2hCUU5BSUFWQkFFZ05BU0FGSVFJZ0R3UkFJQUpCQjJ0QmYyd2hBZ3RCQUNFSUlBSWdFUkFRQkVCQkFpRUlDeUFDSUJBUUVBUkFJQWhCQVdvaENBc2dDQVJBSUF0QkJ5QUZhMm9pQjBFQVRpSUNCRUFnQjBHZ0FVd2hBZ3NnQWdSQVFRQWhBa0VBSVExQkFDRU9JeThFZnlPckFVVUZJeThMSWdRRVFFRUJJUUlMSUFKRkJFQWdCeUFBRUVNaUNrRURjU0VESUF3RWZ5QURRUUJLQlNBTUN5SUVCRUJCQVNFTkJTTXZCSDlCQWlBS0VCQUZJeThMSWdRRVFDQURRUUJLSVFRTElBUUVRRUVCSVE0TEN3c2dBa1VFUUNBTlJTSURCSDhnRGtVRklBTUxJUUlMSUFJRVFDTXZCRUJCQUNBR1FRZHhJQWhCQVJCTElnTVFUQ0VFUVFFZ0F4Qk1JUUpCQWlBREVFd2hBeUFISUFCQkFDQUVFRUVnQnlBQVFRRWdBaEJCSUFjZ0FFRUNJQU1RUVFWQnlQNERJUU5CQkNBR0VCQUVRRUhKL2dNaEF3c2dCeUFBUVFBZ0NDQURRUUFRVFNJS0VFRWdCeUFBUVFFZ0NoQkJJQWNnQUVFQ0lBb1FRUXNMQ3dzZ0JVRUJheUVGREFBQUN3QUxDeUFKUVFGcklRa01BQUFMQUFzTGJRRUNmMEdBa0FJaEFpT25BUVJBUVlDQUFpRUNDeU12Qkg4akx3VWpxd0VMSWdFRVFFR0FzQUloQVNPb0FRUkFRWUM0QWlFQkN5QUFJQUlnQVJCVUN5T21BUVJBUVlDd0FpRUJJNlVCQkVCQmdMZ0NJUUVMSUFBZ0FpQUJFRlVMSTZvQkJFQWdBQ09wQVJCV0N3c2xBUUYvQWtBRFFDQUFRWkFCU3cwQklBQkIvd0Z4RUZjZ0FFRUJhaUVBREFBQUN3QUxDMG9CQW44Q1FBTkFJQUJCa0FGT0RRRUNRRUVBSVFFRFFDQUJRYUFCVGcwQklBRWdBQkJDUVlDZ0JHcEJBRG9BQUNBQlFRRnFJUUVNQUFBTEFBc2dBRUVCYWlFQURBQUFDd0FMQ3d3QVFYOGtzQUZCZnlTeEFRc09BQ016QkVCQjhBVVBDMEg0QWdzT0FDTXpCRUJCOGdNUEMwSDVBUXNhQVFGL0lBQkJqLzRERUFNUVJTSUJKSGRCai80RElBRVFCZ3NLQUVFQkpIUkJBUkJkQ3c0QUl6TUVRRUd1QVE4TFFkY0FDeEFBSXpNRVFFR0FnQUVQQzBHQXdBQUxMZ0VCZnlPTUFVRUFTaUlBQkVBanRnRWhBQXNnQUFSQUk0d0JRUUZySkl3QkN5T01BVVVFUUVFQUpJa0JDd3N1QVFGL0k1WUJRUUJLSWdBRVFDTzNBU0VBQ3lBQUJFQWpsZ0ZCQVdza2xnRUxJNVlCUlFSQVFRQWtrd0VMQ3k0QkFYOGpuQUZCQUVvaUFBUkFJN2dCSVFBTElBQUVRQ09jQVVFQmF5U2NBUXNqbkFGRkJFQkJBQ1NhQVFzTExnRUJmeU9oQVVFQVNpSUFCRUFqdVFFaEFBc2dBQVJBSTZFQlFRRnJKS0VCQ3lPaEFVVUVRRUVBSko0QkN3c2lBUUYvSTVJQkk3c0JkU0VBSTd3QkJIOGprZ0VnQUdzRkk1SUJJQUJxQ3lJQUMwVUJBbjlCbFA0REVBTkIrQUZ4SVFGQmsvNERJQUJCL3dGeElnSVFCa0dVL2dNZ0FTQUFRUWgxSWdCeUVBWWdBaVM5QVNBQUpMNEJJNzRCUVFoMEk3MEJjaVMvQVFzNUFRSi9FR1VpQUVIL0Qwd2lBUVJBSTdzQlFRQktJUUVMSUFFRVFDQUFKSklCSUFBUVpoQmxJUUFMSUFCQi93OUtCRUJCQUNTSkFRc0xMd0Fqa1FGQkFXc2trUUVqa1FGQkFFd0VRQ082QVNTUkFTT1FBUVIvSTdvQlFRQktCU09RQVFzRVFCQm5Dd3NMWUFFQmZ5T0xBVUVCYXlTTEFTT0xBVUVBVEFSQUk4QUJKSXNCSTRzQkJFQWp3UUVFZnlPTkFVRVBTQVVqd1FFTElnQUVRQ09OQVVFQmFpU05BUVVqd1FGRklnQUVRQ09OQVVFQVNpRUFDeUFBQkVBampRRkJBV3NralFFTEN3c0xDMkFCQVg4amxRRkJBV3NrbFFFamxRRkJBRXdFUUNQQ0FTU1ZBU09WQVFSQUk4TUJCSDhqbHdGQkQwZ0ZJOE1CQ3lJQUJFQWpsd0ZCQVdva2x3RUZJOE1CUlNJQUJFQWpsd0ZCQUVvaEFBc2dBQVJBSTVjQlFRRnJKSmNCQ3dzTEN3dGdBUUYvSTZBQlFRRnJKS0FCSTZBQlFRQk1CRUFqeEFFa29BRWpvQUVFUUNQRkFRUi9JNklCUVE5SUJTUEZBUXNpQUFSQUk2SUJRUUZxSktJQkJTUEZBVVVpQUFSQUk2SUJRUUJLSVFBTElBQUVRQ09pQVVFQmF5U2lBUXNMQ3dzTGpRRUJBWDhqWENBQWFpUmNJMXdRWUU0RVFDTmNFR0JySkZ3Q1FBSkFBa0FDUUFKQUkxNGlBUVJBQWtBZ0FVRUNhdzRHQWdBREFBUUZBQXNNQlFzUVlSQmlFR01RWkF3RUN4QmhFR0lRWXhCa0VHZ01Bd3NRWVJCaUVHTVFaQXdDQ3hCaEVHSVFZeEJrRUdnTUFRc1FhUkJxRUdzTEkxNUJBV29rWGlOZVFRaE9CRUJCQUNSZUMwRUJEd3RCQUFzZEFDUEdBU0FBYWlUR0FTT0tBU1BHQVd0QkFFb0VRRUVBRHd0QkFRdURBUUVCZndKQUFrQUNRQUpBSUFCQkFVY0VRQ0FBSWdGQkFrWU5BU0FCUVFOR0RRSWdBVUVFUmcwRERBUUxJMlVqeHdGSEJFQWp4d0VrWlVFQkR3dEJBQThMSTJZanlBRkhCRUFqeUFFa1prRUJEd3RCQUE4TEkyY2p5UUZIQkVBanlRRWtaMEVCRHd0QkFBOExJMmdqeWdGSEJFQWp5Z0VrYUVFQkR3dEJBQThMUVFBTEhRQWp5d0VnQUdva3l3RWpsQUVqeXdGclFRQktCRUJCQUE4TFFRRUxLUUFqekFFZ0FHb2t6QUVqbXdFanpBRnJRUUJLSWdBRVFDTmdSU0VBQ3lBQUJFQkJBQThMUVFFTEhRQWp6UUVnQUdva3pRRWpud0VqelFGclFRQktCRUJCQUE4TFFRRUxIUUJCZ0JBanZ3RnJRUUowSklvQkl6TUVRQ09LQVVFQmRDU0tBUXNMUlFFQmZ3SkFBa0FDUUNBQVFRRkhCRUFnQUNJQ1FRSkdEUUVnQWtFRFJnMENEQU1MSUFGQmdRRVFFQThMSUFGQmh3RVFFQThMSUFGQi9nQVFFQThMSUFGQkFSQVFDMzhCQVg4amlnRWdBR3NraWdFamlnRkJBRXdFUUNPS0FTRUFFSElqaWdFZ0FFRUFJQUJySUFCQkFFb2JheVNLQVNPUEFVRUJhaVNQQVNPUEFVRUlUZ1JBUVFBa2p3RUxDeU9KQVFSL0k4Y0JCU09KQVFzaUFBUi9JNDBCQlVFUER3c2hBRUVCSVFFanpnRWpqd0VRYzBVRVFFRi9JUUVMSUFFZ0FHeEJEMm9MRWdFQmZ5UEdBU0VBUVFBa3hnRWdBQkIwQ3gwQVFZQVFJODhCYTBFQ2RDU1VBU016QkVBamxBRkJBWFFrbEFFTEMzOEJBWDhqbEFFZ0FHc2tsQUVqbEFGQkFFd0VRQ09VQVNFQUVIWWpsQUVnQUVFQUlBQnJJQUJCQUVvYmF5U1VBU09aQVVFQmFpU1pBU09aQVVFSVRnUkFRUUFrbVFFTEN5T1RBUVIvSThnQkJTT1RBUXNpQUFSL0k1Y0JCVUVQRHdzaEFFRUJJUUVqMEFFam1RRVFjMFVFUUVGL0lRRUxJQUVnQUd4QkQyb0xFZ0VCZnlQTEFTRUFRUUFreXdFZ0FCQjNDeDBBUVlBUUk5RUJhMEVCZENTYkFTTXpCRUFqbXdGQkFYUWttd0VMQ3dRQUlBQUxpQUlCQW44am13RWdBR3NrbXdFam13RkJBRXdFUUNPYkFTRUNFSGtqbXdFZ0FrRUFJQUpySUFKQkFFb2JheVNiQVNPZEFVRUJhaVNkQVNPZEFVRWdUZ1JBUVFBa25RRUxDMEVBSVFJajBnRWhBQ09hQVFSL0k4a0JCU09hQVFzaUFRUkFJMkFFUUVHYy9nTVFBMEVGZFVFUGNTSUFKTklCUVFBa1lBc0ZRUThQQ3lPZEFVRUNiUkI2UWJEK0Eyb1FBeUVCSTUwQlFRSnZCSDhnQVVFUGNRVWdBVUVFZFVFUGNRc2hBUUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVnQUVFQ1JnMENEQU1MSUFGQkJIVWhBUXdEQzBFQklRSU1BZ3NnQVVFQmRTRUJRUUloQWd3QkN5QUJRUUoxSVFGQkJDRUNDeUFDUVFCS0JIOGdBU0FDYlFWQkFBc2lBVUVQYWdzU0FRRi9JOHdCSVFCQkFDVE1BU0FBRUhzTEd3RUJmeVBUQVNQVUFYUWhBQ016QkVBZ0FFRUJkQ0VBQ3lBQUM2OEJBUUYvSTU4QklBQnJKSjhCSTU4QlFRQk1CRUFqbndFaEFCQjlKSjhCSTU4QklBQkJBQ0FBYXlBQVFRQktHMnNrbndFam93RkJBWEVoQVNPakFVRUJkVUVCY1NFQUk2TUJRUUYxSktNQkk2TUJJQUVnQUhNaUFVRU9kSElrb3dFajFRRUVRQ09qQVVHL2YzRWtvd0Vqb3dFZ0FVRUdkSElrb3dFTEN5T2VBUVIvSThvQkJTT2VBUXNpQUFSL0k2SUJCVUVQRHdzaEFVRUFJNk1CRUJBRWYwRi9CVUVCQ3lJQUlBRnNRUTlxQ3hJQkFYOGp6UUVoQUVFQUpNMEJJQUFRZmdzU0FDTXpCRUJCZ0lDQUJBOExRWUNBZ0FJTEJRQVFnQUVMT2dBZ0FFRThSZ1JBUWY4QUR3c2dBRUU4YTBHZ2pRWnNJQUZzUVFodEVIcEJvSTBHYlJCNlFUeHFRYUNOQm14QmpQRUNFSHB0RUhvUWVndTZBUUVCZjBFQUpHc2pVd1IvSUFBRlFROExJUVFqVkFSL0lBUWdBV29GSUFSQkQyb0xJUVFqVlFSL0lBUWdBbW9GSUFSQkQyb0xJUVFqVmdSL0lBUWdBMm9GSUFSQkQyb0xJUVFqVndSL0lBQUZRUThMSVFBaldBUi9JQUFnQVdvRklBQkJEMm9MSVFBaldRUi9JQUFnQW1vRklBQkJEMm9MSVFBaldnUi9JQUFnQTJvRklBQkJEMm9MSVFCQkFDUnNRUUFrYlNBRUkxRkJBV29RZ2dFaEFTQUFJMUpCQVdvUWdnRWhBQ0FCSkdrZ0FDUnFJQUVnQUJCS0N5VUJBWDhnQWtFQmRFR0ErQ05xSWdNZ0FFRUJham9BQUNBRFFRRnFJQUZCQVdvNkFBQUxtZ0lCQkg4Z0FCQnRJZ0ZGQkVCQkFSQnVJUUVMSUFBUWJ5SUNSUVJBUVFJUWJpRUNDeUFBRUhBaUEwVUVRRUVERUc0aEF3c2dBQkJ4SWdSRkJFQkJCQkJ1SVFRTElBRkJBWEVFUUJCMUpHRUxJQUpCQVhFRVFCQjRKR0lMSUFOQkFYRUVRQkI4SkdNTElBUkJBWEVFUUJCL0pHUUxJQUZCQVhGRkJFQWdBaUVCQ3lBQlFRRnhSUVJBSUFNaEFRc2dBVUVCY1VVRVFDQUVJUUVMSUFGQkFYRUVRRUVCSkcwTEkxMGdBQ1BXQVd4cUpGMGpYUkNCQVU0RVFDTmRFSUVCYXlSZEkyMEVmeU50QlNOckN5SUJSUVJBSTJ3aEFRc2dBUVJBSTJFallpTmpJMlFRZ3dFYUN5TnBRUUZxSTJwQkFXb2pYeENFQVNOZlFRRnFKRjhqMXdGQkFtMFFla0VCYXlFQkkxOGdBVTRFUUNOZlFRRnJKRjhMQ3dzTUFDQUFRWUQrQTNGQkNIVUxDQUFnQUVIL0FYRUxrd0VCQkg4Z0FCQjBFSG9oQVNBQUVIY1FlaUVDSUFBUWV4QjZJUU1nQUJCK0VIb2hCQ0FCSkdFZ0FpUmlJQU1rWXlBRUpHUWpYU0FBSTlZQmJHb2tYU05kRUlFQlRnUkFJMTBRZ1FGckpGMGdBU0FDSUFNZ0JCQ0RBU0lBRUlZQlFRRnFJQUFRaHdGQkFXb2pYeENFQVNOZlFRRnFKRjhqMXdGQkFtMFFla0VCYXlFQUkxOGdBRTRFUUNOZlFRRnJKRjhMQ3dzbEFRRi9JQUFRYkNFQkl5b0VmeUFCUlFVaktnc2lBUVJBSUFBUWhRRUZJQUFRaUFFTEN5UUFJMUFRWDBnRVFBOExBMEFqVUJCZlRnUkFFRjhRaVFFalVCQmZheVJRREFFTEN3dHpBUUYvSUFCQnB2NERSZ1JBUWFiK0F4QURRWUFCY1NFQkk0a0JCSDlCQUNBQkVFVUZRUUFnQVJCRUN4b2prd0VFZjBFQklBRVFSUVZCQVNBQkVFUUxHaU9hQVFSL1FRSWdBUkJGQlVFQ0lBRVFSQXNhSTU0QkJIOUJBeUFCRUVVRlFRTWdBUkJFQ3hvZ0FVSHdBSElQQzBGL0M4UUJBUUYvSTZ3QklRQWpyUUVFUUNQWUFRUi9RUUlnQUJCRUJVRUNJQUFRUlFzaEFDUFpBUVIvUVFBZ0FCQkVCVUVBSUFBUVJRc2hBQ1BhQVFSL1FRTWdBQkJFQlVFRElBQVFSUXNoQUNQYkFRUi9RUUVnQUJCRUJVRUJJQUFRUlFzaEFBVWpyZ0VFUUNQY0FRUi9RUUFnQUJCRUJVRUFJQUFRUlFzaEFDUGRBUVIvUVFFZ0FCQkVCVUVCSUFBUVJRc2hBQ1BlQVFSL1FRSWdBQkJFQlVFQ0lBQVFSUXNoQUNQZkFRUi9RUU1nQUJCRUJVRURJQUFRUlFzaEFBc0xJQUJCOEFGeUM5UUNBUUYvSUFCQmdJQUNTQVJBUVg4UEN5QUFRWUNBQWs0aUFRUkFJQUJCZ01BQ1NDRUJDeUFCQkVCQmZ3OExJQUJCZ01BRFRpSUJCRUFnQUVHQS9BTklJUUVMSUFFRVFDQUFRWUJBYWhBRER3c2dBRUdBL0FOT0lnRUVRQ0FBUVovOUEwd2hBUXNnQVFSQUk0WUJRUUpJQkVCQi93RVBDMEYvRHdzZ0FFSE4vZ05HQkVCQi93RWhBVUVBUWMzK0F4QURFQkJGQkVCQkFFSC9BUkJFSVFFTEl6TkZCRUJCQnlBQkVFUWhBUXNnQVE4TElBQkJ4UDREUmdSQUlBQWpTeEFHSTBzUEN5QUFRWkQrQTA0aUFRUkFJQUJCcHY0RFRDRUJDeUFCQkVBUWlnRWdBQkNMQVE4TElBQkJzUDREVGlJQkJFQWdBRUcvL2dOTUlRRUxJQUVFUUJDS0FVRi9Ed3NnQUVHRS9nTkdCRUFnQUNONUVJWUJJZ0VRQmlBQkR3c2dBRUdGL2dOR0JFQWdBQ042RUFZamVnOExJQUJCai80RFJnUkFJM2RCNEFGeUR3c2dBRUdBL2dOR0JFQVFqQUVQQzBGL0N4d0JBWDhnQUJDTkFTSUJRWDlHQkVBZ0FCQUREd3NnQVVIL0FYRUw3UUlCQW44alJRUkFEd3NnQUVIL1Awd0VRQ05IQkg5QkJDQUJRZjhCY1JBUVJRVWpSd3NpQUVVRVFDQUJRUTl4SWdJRVFDQUNRUXBHQkVCQkFTUkRDd1ZCQUNSREN3c0ZJQUJCLy84QVRBUkFJeTVGSWdKRkJFQWdBRUgvM3dCTUlRSUxJQUlFUUNOSEJFQWdBVUVQY1NRdEN5QUJJUUlqUmdSQUlBSkJIM0VoQWlNdFFlQUJjU1F0QlNOSUJFQWdBa0gvQUhFaEFpTXRRWUFCY1NRdEJTTXVCRUJCQUNRdEN3c0xJeTBnQW5Ja0xRVkJBQ0VDSXkwUWh3RWhBeUFCUVFCS0JFQkJBU0VDQ3lBQ0lBTVFTaVF0Q3dValIwVWlBd1JBSUFCQi83OEJUQ0VEQ3lBREJFQWpSZ1IvSTBRRkkwWUxJZ0FFUUNNdFFSOXhKQzBqTFNBQlFlQUJjWElrTFE4TEkwZ0VRQ0FCUVFoT0lnTUVRQ0FCUVF4TUlRTUxDeUFCSVFNakxnUi9JQU5CRDNFRklBTkJBM0VMSWdNa01RVWpSMFVpQXdSQUlBQkIvLzhCVENFREN5QURCRUFqUmdSQVFRQWdBVUgvQVhFUUVBUkFRUUVrUkFWQkFDUkVDd3NMQ3dzTEN4OEFJQUJCOEFCeFFRUjFKTG9CUVFNZ0FCQVFKTHdCSUFCQkIzRWt1d0VMQ3dCQkJ5QUFFQkFreVFFTEh3QWdBRUVHZFVFRGNTVE9BU0FBUVQ5eEpPQUJRY0FBSStBQmF5U01BUXNmQUNBQVFRWjFRUU54Sk5BQklBQkJQM0VrNFFGQndBQWo0UUZySkpZQkN4RUFJQUFrNGdGQmdBSWo0Z0ZySkp3QkN4UUFJQUJCUDNFazR3RkJ3QUFqNHdGckpLRUJDeW9BSUFCQkJIVkJEM0VrNUFGQkF5QUFFQkFrd1FFZ0FFRUhjU1RBQVNBQVFmZ0JjVUVBU2lUSEFRc3FBQ0FBUVFSMVFROXhKT1VCUVFNZ0FCQVFKTU1CSUFCQkIzRWt3Z0VnQUVINEFYRkJBRW9reUFFTERRQWdBRUVGZFVFUGNTVG1BUXNxQUNBQVFRUjFRUTl4Sk9jQlFRTWdBQkFRSk1VQklBQkJCM0VreEFFZ0FFSDRBWEZCQUVva3lnRUxGQUFnQUNTOUFTTytBVUVJZENPOUFYSWt2d0VMRkFBZ0FDVG9BU1BwQVVFSWRDUG9BWElrendFTEZBQWdBQ1RxQVNQckFVRUlkQ1BxQVhJazBRRUxoQUVCQVg4Z0FFRUVkU1RVQVVFRElBQVFFQ1RWQVNBQVFRZHhKT3dCQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ1BzQVNJQkJFQUNRQ0FCUVFGckRnY0NBd1FGQmdjSUFBc01DQXRCQ0NUVEFROExRUkFrMHdFUEMwRWdKTk1CRHd0Qk1DVFRBUThMUWNBQUpOTUJEd3RCMEFBazB3RVBDMEhnQUNUVEFROExRZkFBSk5NQkN3c2dBRUVHSUFBUUVDUzJBU0FBUVFkeEpMNEJJNzRCUVFoMEk3MEJjaVMvQVF0cUFRRi9RUUVraVFFampBRkZCRUJCd0FBa2pBRUxFSElqd0FFa2l3RWo1QUVralFFanZ3RWtrZ0VqdWdFa2tRRWp1Z0ZCQUVvaUFBUkFJN3NCUVFCS0lRQUxJQUFFUUVFQkpKQUJCVUVBSkpBQkN5TzdBVUVBU2dSQUVHY0xJOGNCUlFSQVFRQWtpUUVMQ3lBQVFRWWdBQkFRSkxjQklBQkJCM0VrNlFFajZRRkJDSFFqNkFGeUpNOEJDeTRBUVFFa2t3RWpsZ0ZGQkVCQndBQWtsZ0VMRUhZandnRWtsUUVqNVFFa2x3RWp5QUZGQkVCQkFDU1RBUXNMSUFCQkJpQUFFQkFrdUFFZ0FFRUhjU1RyQVNQckFVRUlkQ1BxQVhJazBRRUxKd0JCQVNTYUFTT2NBVVVFUUVHQUFpU2NBUXNRZVVFQUpKMEJJOGtCUlFSQVFRQWttZ0VMQ3dzQVFRWWdBQkFRSkxrQkN6Z0FRUUVrbmdFam9RRkZCRUJCd0FBa29RRUxFSDBrbndFanhBRWtvQUVqNXdFa29nRkIvLzhCSktNQkk4b0JSUVJBUVFBa25nRUxDeE1BSUFCQkJIVkJCM0VrVVNBQVFRZHhKRklMUWdCQkJ5QUFFQkFrVmtFR0lBQVFFQ1JWUVFVZ0FCQVFKRlJCQkNBQUVCQWtVMEVESUFBUUVDUmFRUUlnQUJBUUpGbEJBU0FBRUJBa1dFRUFJQUFRRUNSWEN3b0FRUWNnQUJBUUpGc0xsQU1CQVg4Q1FDQUFRYWIrQTBjaUFnUkFJMXRGSVFJTElBSUVRRUVBRHdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQ1FaRCtBMGNFUUFKQUlBSkJrZjREYXc0V0F3Y0xEd0FFQ0F3UUFnVUpEUkVBQmdvT0VoTVVGUUFMREJVTElBRVFrQUVNRlFzZ0FSQ1JBUXdVQ3lBQkVKSUJEQk1MSUFFUWt3RU1FZ3NnQVJDVUFRd1JDeUFCRUpVQkRCQUxJQUVRbGdFTUR3c2dBUkNYQVF3T0MwRUJKR0FnQVJDWUFRd05DeUFCRUprQkRBd0xJQUVRbWdFTUN3c2dBUkNiQVF3S0N5QUJFSndCREFrTElBRVFuUUVNQ0F0QkJ5QUJFQkFFUUNBQkVKNEJFSjhCQ3d3SEMwRUhJQUVRRUFSQUlBRVFvQUVRb1FFTERBWUxRUWNnQVJBUUJFQWdBUkNpQVJDakFRc01CUXRCQnlBQkVCQUVRQ0FCRUtRQkVLVUJDd3dFQ3lBQkVLWUJRUUVrYXd3REN5QUJFS2NCUVFFa2JBd0NDeUFCRUtnQlFRY2dBUkFRUlFSQUFrQkJrUDRESVFJRFFDQUNRYWIrQTA0TkFTQUNRUUFRQmlBQ1FRRnFJUUlNQUFBTEFBc0xEQUVMUVFFUEMwRUJDeHdBUWNIK0EwRUhJQUJCK0FGeFFjSCtBeEFEUVFkeGNoQkZFQVlMUGdFQmZ5QUFRUWgwSVFFQ1FFRUFJUUFEUUNBQVFaOEJTZzBCSUFCQmdQd0RhaUFCSUFCcUVBTVFCaUFBUVFGcUlRQU1BQUFMQUF0QmhBVWtyd0VMRXdBajd3RVFBeVB3QVJBREVFcEI4UDhEY1FzWEFDUHhBUkFESS9JQkVBTVFTa0h3UDNGQmdJQUNhZ3VMQVFFRGZ5TXZSUVJBRHdzanNnRUVmMEVISUFBUUVFVUZJN0lCQ3lJQkJFQkJBQ1N5QVNQdUFSQURJUUVqN2dGQkJ5QUJFRVVRQmc4TEVLd0JJUUVRclFFaEFrRUhJQUFRUkVFQmFrRUVkQ0VEUVFjZ0FCQVFCRUJCQVNTeUFTQURKTE1CSUFFa3RBRWdBaVMxQVNQdUFVRUhJQUFRUkJBR0JTQUJJQUlnQXhDK0FTUHVBVUgvQVJBR0N3c21BUUYvSUFCQlAzRWhBeUFDUVFGeEJFQWdBMEZBYXlFREN5QURRWUNRQkdvZ0FUb0FBQXNZQUVFSElBQVFFQVJBSUFGQkJ5QUFRUUZxRUVVUUJnc0xTZ0VDZnlBQUkvVUJSaUlDUlFSQUlBQWo5QUZHSVFJTElBSUVRRUVHSUFCQkFXc1FBeEJFSVFJZ0FDUDBBVVlFUUVFQklRTUxJQUlnQVNBREVLOEJJQUlnQUVFQmF4Q3dBUXNMQ2dCQkFTUjFRUUlRWFFzOEFRRi9Ba0FDUUFKQUFrQWdBQVJBSUFBaUFVRUJSZzBCSUFGQkFrWU5BaUFCUVFOR0RRTU1CQXRCQ1E4TFFRTVBDMEVGRHd0QkJ3OExRUUFMSndFQmZ5TjlFTE1CSWdJZ0FCQVFJZ0FFUUNBQ0lBRVFFRVVoQUFzZ0FBUkFRUUVQQzBFQUN4b0FJM3BCQVdva2VpTjZRZjhCU2dSQVFRRWtma0VBSkhvTEMyWUJBbjhEUUNBQklBQklCRUFqZVNFQ0lBRkJCR29oQVNONVFRUnFKSGtqZVVILy93TktCRUFqZVVHQWdBUnJKSGtMSTN3RVFDTitCRUFqZXlSNkVMSUJRUUFrZmtFQkpIOEZJMzhFUUVFQUpIOExDeUFDSTNrUXRBRUVRQkMxQVFzTERBRUxDd3NMQUNONEVMWUJRUUFrZUFzcEFDTjVJUUJCQUNSNVFZVCtBMEVBRUFZamZBUi9JQUFqZVJDMEFRVWpmQXNpQUFSQUVMVUJDd3NhQUNOOEJFQWpmd1JBRHdzamZnUkFRUUFrZmdzTElBQWtlZ3NiQUNBQUpIc2pmQVIvSTM4Rkkzd0xCRUFqZXlSNlFRQWtmd3NMV0FFQ2Z5TjhJUUZCQWlBQUVCQWtmQ0FBUVFOeElRSWdBVVVFUUNOOUVMTUJJUUFnQWhDekFTRUJJM3dFUUNBQUkza1FFQ0VBQlNBQUkza1FFQ0lBQkVBZ0FTTjVFQkFoQUFzTElBQUVRQkMxQVFzTElBSWtmUXZSQlFFQmZ3SkFBa0FnQUVITi9nTkdCRUJCemY0RElBRkJBWEVRQmd3Q0N5QUFRWUNBQWtnRVFDQUFJQUVRandFTUFnc2dBRUdBZ0FKT0lnSUVRQ0FBUVlEQUFrZ2hBZ3NnQWcwQUlBQkJnTUFEVGlJQ0JFQWdBRUdBL0FOSUlRSUxJQUlFUUNBQVFZQkFhaUFCRUFZTUFRc2dBRUdBL0FOT0lnSUVRQ0FBUVovOUEwd2hBZ3NnQWdSQUk0WUJRUUpJRFFJTUFRc2dBRUdnL1FOT0lnSUVRQ0FBUWYvOUEwd2hBZ3NnQWcwQklBQkJrUDREVGlJQ0JFQWdBRUdtL2dOTUlRSUxJQUlFUUJDS0FTQUFJQUVRcVFFUEN5QUFRYkQrQTA0aUFnUkFJQUJCdi80RFRDRUNDeUFDQkVBUWlnRUxJQUJCd1A0RFRpSUNCRUFnQUVITC9nTk1JUUlMSUFJRVFDQUFRY0QrQTBZRVFDQUJFQ3NNQWdzZ0FFSEIvZ05HQkVBZ0FSQ3FBUXdEQ3lBQVFjVCtBMFlFUUVFQUpFc2dBRUVBRUFZTUF3c2dBRUhGL2dOR0JFQWdBU1R0QVF3Q0N5QUFRY2IrQTBZRVFDQUJFS3NCREFJTEFrQUNRQUpBQWtBZ0FDSUNRY1ArQTBjRVFBSkFJQUpCd3Y0RGF3NEtBZ0FBQUFBQUFBQUVBd0FMREFRTElBRWtUQXdGQ3lBQkpFME1CQXNnQVNST0RBTUxJQUVrVHd3Q0N3d0JDeUFBSSs0QlJnUkFJQUVRcmdFTUFnc2dBQ015UmlJQ1JRUkFJQUFqTUVZaEFnc2dBZ1JBSTdJQkJFQWp0QUZCZ0lBQlRpSUNCRUFqdEFGQi8vOEJUQ0VDQ3lBQ1JRUkFJN1FCUVlDZ0EwNGlBZ1JBSTdRQlFmKy9BMHdoQWdzTElBSU5Bd3NMSUFBajh3Rk9JZ0lFUUNBQUkvUUJUQ0VDQ3lBQ0JFQWdBQ0FCRUxFQkRBRUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQzNBUUpBQWtBQ1FBSkFJQUFpQWtHRS9nTkhCRUFDUUNBQ1FZWCtBMnNPQXdJREJBQUxEQVFMSUFFUXVBRU1CZ3NnQVJDNUFRd0VDeUFCRUxvQkRBTUxJQUVRdXdFTUFnc01BUXNnQUVHQS9nTkdCRUFnQVJBdUN5QUFRWS8rQTBZRVFDQUJFQklNQVFzZ0FFSC8vd05HQkVBZ0FSQVJEQUVMUVFFUEMwRUJEd3RCQUFzU0FDQUFJQUVRdkFFRVFDQUFJQUVRQmdzTGFBRURmd0pBQTBBZ0F5QUNUZzBCSUFBZ0Eyb1FqZ0VoQlNBQklBTnFJUVFEUUNBRVFmKy9Ba29FUUNBRVFZQkFhaUVFREFFTEN5QUVJQVVRdlFFZ0EwRUJhaUVEREFBQUN3QUxRU0FoQXlNekJFQkJ3QUFoQXdzanJ3RWdBeUFDUVJCdGJHb2tyd0VMYlFFQmZ5T3lBVVVFUUE4TFFSQWhBQ096QVVFUVNBUkFJN01CSVFBTEk3UUJJN1VCSUFBUXZnRWp0QUVnQUdva3RBRWp0UUVnQUdva3RRRWpzd0VnQUdza3N3RWpzd0ZCQUV3RVFFRUFKTElCSSs0QlFmOEJFQVlGSSs0QlFRY2pzd0ZCRUcxQkFXc1FSQkFHQ3dzS0FFRUJKSE5CQUJCZEM5TUNBUVYvSTZRQlJRUkFRUUFrU2tFQUpFdEJ4UDREUVFBUUJrRUFRUUZCd2Y0REVBTVFSQkJFSVFOQkFDU0dBVUhCL2dNZ0F4QUdEd3NqaGdFaEFTTkxJZ05Ca0FGT0JFQkJBU0VDQlNOS0VGdE9CRUJCQWlFQ0JTTktFRnhPQkVCQkF5RUNDd3NMSUFFZ0FrY0VRRUhCL2dNUUF5RUFJQUlraGdGQkFDRUJBa0FDUUFKQUFrQUNRQ0FDSVFRZ0FrVU5BQUpBSUFSQkFXc09Bd0lEQkFBTERBUUxRUU5CQVVFQUlBQVFSQkJFSWdBUUVDRUJEQU1MUVFSQkFFRUJJQUFRUkJCRklnQVFFQ0VCREFJTFFRVkJBVUVBSUFBUVJCQkZJZ0FRRUNFQkRBRUxRUUZCQUNBQUVFVVFSU0VBQ3lBQkJFQVFYZ3NnQWtVRVFCQy9BUXNnQWtFQlJnUkFFTUFCQ3lQdEFTRUVJQUpGSWdGRkJFQWdBa0VCUmlFQkN5QUJCRUFnQXlBRVJpRUJDeUFCQkVCQkJrRUNJQUFRUlNJQUVCQUVRQkJlQ3dWQkFpQUFFRVFoQUF0QndmNERJQUFRQmdzTGJBRUJmeU9rQVFSQUkwb2dBR29rU2dOQUkwb1FQVTRFUUNOS0VEMXJKRW9qU3lJQlFaQUJSZ1JBSXlrRVFCQllCU0FCRUZjTEVGa1FXZ1VnQVVHUUFVZ0VRQ01wUlFSQUlBRVFWd3NMQ3lBQlFaa0JTZ1IvUVFBRklBRkJBV29MSWdFa1N3d0JDd3NMRU1FQkN5UUFJMGtRUGtnRVFBOExBMEFqU1JBK1RnUkFFRDRRd2dFalNSQStheVJKREFFTEN3c29BQ09DQVNBQWFpU0NBU09DQVNPQUFVNEVRQ09CQVVFQmFpU0JBU09DQVNPQUFXc2tnZ0VMQzJZQUk2OEJRUUJLQkVBZ0FDT3ZBV29oQUVFQUpLOEJDeU0rSUFCcUpENGpRa1VFUUNNbkJFQWpTU0FBYWlSSkVNTUJCU0FBRU1JQkN5TW1CRUFqVUNBQWFpUlFCU0FBRUlrQkN3c2pLQVJBSTNnZ0FHb2tlQkMzQVFVZ0FCQzJBUXNnQUJERUFRc1FBRUVFRU1VQkl6MUJBV29RUEJBREN3c0FRUVFReFFFalBSQURDeElBRU1ZQlFmOEJjUkRIQVVIL0FYRVFTZ3NPQUVFRUVNVUJJQUFnQVJDOUFRc3ZBUUYvUVFFZ0FIUVFod0VoQWlBQlFRQktCRUFqT3lBQ2NrSC9BWEVrT3dVak95QUNRZjhCYzNFa093c2pPd3NLQUVFRklBQVF5Z0VhQzA0QUlBRkJBRTRFUUNBQVFROXhJQUZCRDNGcUVJY0JRUkJ4QkVCQkFSRExBUVZCQUJETEFRc0ZJQUZCQUNBQmF5QUJRUUJLRzBFUGNTQUFRUTl4U3dSQVFRRVF5d0VGUVFBUXl3RUxDd3NLQUVFSElBQVF5Z0VhQ3dvQVFRWWdBQkRLQVJvTENnQkJCQ0FBRU1vQkdnc1VBQ0FBUVFGMElBQkIvd0Z4UVFkMmNoQ0hBUXMzQVFKL0lBRVFoZ0VoQWlBQVFRRnFJUU1nQUNBQkVJY0JJZ0VRdkFFRVFDQUFJQUVRQmdzZ0F5QUNFTHdCQkVBZ0F5QUNFQVlMQ3c0QVFRZ1F4UUVnQUNBQkVORUJDNE1CQUNBQ1FRRnhCRUFnQUVILy93TnhJZ0FnQVdvaEFpQUFJQUZ6SUFKeklnSkJFSEVFUUVFQkVNc0JCVUVBRU1zQkN5QUNRWUFDY1FSQVFRRVF6d0VGUVFBUXp3RUxCU0FBSUFGcUVEd2lBaUFBUWYvL0EzRkpCRUJCQVJEUEFRVkJBQkRQQVFzZ0FDQUJjeUFDYzBHQUlIRVFQQVJBUVFFUXl3RUZRUUFReXdFTEN3c01BRUVFRU1VQklBQVFqZ0VMRkFBZ0FFSC9BWEZCQVhZZ0FFRUhkSElRaHdFTDB3UUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBQWtBZ0FFRUJhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzTUZBc1F5QUZCLy84RGNTSUFFSVlCUWY4QmNTUTFJQUFRaHdGQi93RnhKRFlNRUFzak5TTTJFRW9qTkJESkFRd1NDeU0xSXpZUVNrRUJha0gvL3dOeElnQVFoZ0ZCL3dGeEpEVU1EUXNqTlVFQkVNd0JJelZCQVdvUWh3RWtOU00xQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVF3UUN5TTFRWDhRekFFak5VRUJheENIQVNRMUl6VUVRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJEQThMRU1jQlFmOEJjU1ExREF3TEl6UkJnQUZ4UVlBQlJnUkFRUUVRendFRlFRQVF6d0VMSXpRUTBBRWtOQXdNQ3hESUFVSC8vd054SXp3UTBnRU1DUXNqT1NNNkVFb2lBQ00xSXpZUVNpSUJRZi8vQTNGQkFCRFRBU0FBSUFGcUVEd2lBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2UVFBUXpnRkJDQThMSXpVak5oQktFTlFCUWY4QmNTUTBEQW9MSXpVak5oQktRUUZyRUR3aUFCQ0dBVUgvQVhFa05Rd0ZDeU0yUVFFUXpBRWpOa0VCYWhDSEFTUTJJellFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCREFnTEl6WkJmeERNQVNNMlFRRnJFSWNCSkRZak5nUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRU1Cd3NReHdGQi93RnhKRFlNQkFzak5FRUJjVUVBU3dSQVFRRVF6d0VGUVFBUXp3RUxJelFRMVFFa05Bd0VDMEYvRHdzZ0FCQ0hBVUgvQVhFa05rRUlEd3NqUFVFQ2FoQThKRDBNQWdzalBVRUJhaEE4SkQwTUFRdEJBQkROQVVFQUVNNEJRUUFReXdFTFFRUUxDZ0FqTzBFRWRrRUJjUXNPQUNBQVFRRjBFTmNCY2hDSEFRc29BUUYvUVFjZ0FFRVlkRUVZZFNJQkVCQUVRRUdBQWlBQVFSaDBRUmgxYTBGL2JDRUJDeUFCQ3lNQkFYOGdBQkRaQVNFQkl6MGdBVUVZZEVFWWRXb1FQQ1E5SXoxQkFXb1FQQ1E5Q3hVQUlBQkIvd0Z4UVFGMkVOY0JRUWQwY2hDSEFRdWxCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVRUndSQUFrQWdBRUVSYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pMd1JBUVFCQnpmNERFTlFCUWY4QmNTSUFFQkFFUUVITi9nTkJCMEVBSUFBUVJDSUFFQkFFZjBFQUpETkJCeUFBRUVRRlFRRWtNMEVISUFBUVJRc2lBQkRKQVVIRUFBOExDMEVCSkVJTUVRc1F5QUZCLy84RGNTSUFFSVlCUWY4QmNTUTNJQUFRaHdGQi93RnhKRGdqUFVFQ2FoQThKRDBNRWdzak55TTRFRW9qTkJESkFRd1JDeU0zSXpnUVNrRUJhaEE4SWdBUWhnRkIvd0Z4SkRjTURRc2pOMEVCRU13Qkl6ZEJBV29RaHdFa055TTNCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXdQQ3lNM1FYOFF6QUVqTjBFQmF4Q0hBU1EzSXpjRVFFRUFFTTBCQlVFQkVNMEJDMEVCRU00QkRBNExFTWNCUWY4QmNTUTNEQXNMUVFBaEFDTTBRWUFCY1VHQUFVWUVRRUVCSVFBTEl6UVEyQUVrTkF3TEN4REhBUkRhQVVFSUR3c2pPU002RUVvaUFDTTNJemdRU2lJQlFmLy9BM0ZCQUJEVEFTQUFJQUZxRUR3aUFCQ0dBVUgvQVhFa09TQUFFSWNCUWY4QmNTUTZRUUFRemdGQkNBOExJemNqT0JCS1FmLy9BM0VRMUFGQi93RnhKRFFNQ1Fzak55TTRFRXBCQVdzUVBDSUFFSVlCUWY4QmNTUTNEQVVMSXpoQkFSRE1BU000UVFGcUVJY0JKRGdqT0FSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdFTUJ3c2pPRUYvRU13Qkl6aEJBV3NRaHdFa09DTTRCRUJCQUJETkFRVkJBUkROQVF0QkFSRE9BUXdHQ3hESEFVSC9BWEVrT0F3REMwRUFJUUFqTkVFQmNVRUJSZ1JBUVFFaEFBc2pOQkRiQVNRMERBTUxRWDhQQ3lBQUVJY0JRZjhCY1NRNFFRZ1BDeU05UVFGcUVEd2tQUXdCQ3lBQUJFQkJBUkRQQVFWQkFCRFBBUXRCQUJETkFVRUFFTTRCUVFBUXl3RUxRUVFMQ2dBak8wRUhka0VCY1FzS0FDTTdRUVYyUVFGeEN3b0FJenRCQm5aQkFYRUxpQVlCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRWdSd1JBQWtBZ0FFRWhhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzUTNRRUVRQ005UVFGcUVEd2tQUVVReHdFUTJnRUxRUWdQQ3hESUFVSC8vd054SWdBUWhnRkIvd0Z4SkRrZ0FCQ0hBVUgvQVhFa09pTTlRUUpxRUR3a1BRd1FDeU01SXpvUVNpSUFRZi8vQTNFak5CREpBU0FBUVFGcUVEd2lBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2REE4TEl6a2pPaEJLUVFGcUVEd2lBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2UVFnUEN5TTVRUUVRekFFak9VRUJhaENIQVNRNUl6a0VRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJEQTBMSXpsQmZ4RE1BU001UVFGckVJY0JKRGtqT1FSQVFRQVF6UUVGUVFFUXpRRUxRUUVRemdFTURBc1F4d0ZCL3dGeEpEa01DZ3NRM2dGQkFFc0VRRUVHSVFFTEVOY0JRUUJMQkVBZ0FVSGdBSEloQVFzUTN3RkJBRXNFZnlNMElBRnJFSWNCQlNNMFFROXhRUWxMQkVBZ0FVRUdjaUVCQ3lNMFFaa0JTd1JBSUFGQjRBQnlJUUVMSXpRZ0FXb1Fod0VMSWdBRVFFRUFFTTBCQlVFQkVNMEJDeUFCUWVBQWNRUkFRUUVRendFRlFRQVF6d0VMUVFBUXl3RWdBQ1EwREFvTEVOMEJRUUJMQkVBUXh3RVEyZ0VGSXoxQkFXb1FQQ1E5QzBFSUR3c2pPU002RUVvaUFTQUJRZi8vQTNGQkFCRFRBU0FCUVFGMEVEd2lBUkNHQVVIL0FYRWtPU0FCRUljQlFmOEJjU1E2UVFBUXpnRkJDQThMSXprak9oQktJZ0ZCLy84RGNSRFVBVUgvQVhFa05DQUJRUUZxRUR3aUFSQ0dBVUgvQVhFa09TQUJFSWNCUWY4QmNTUTZEQWNMSXprak9oQktRUUZyRUR3aUFSQ0dBVUgvQVhFa09TQUJFSWNCUWY4QmNTUTZRUWdQQ3lNNlFRRVF6QUVqT2tFQmFoQ0hBU1E2SXpvRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QkRBVUxJenBCZnhETUFTTTZRUUZyRUljQkpEb2pPZ1JBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VNQkFzUXh3RkIvd0Z4SkRvTUFnc2pORUYvYzBIL0FYRWtORUVCRU00QlFRRVF5d0VNQWd0QmZ3OExJejFCQVdvUVBDUTlDMEVFQy9BRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFUQkhCRUFDUUNBQVFURnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3hEWEFRUkFJejFCQVdvUVBDUTlCUkRIQVJEYUFRdEJDQThMRU1nQlFmLy9BM0VrUENNOVFRSnFFRHdrUFF3U0N5TTVJem9RU2lJQVFmLy9BM0VqTkJESkFRd1BDeU04UVFGcUVEd2tQRUVJRHdzak9TTTZFRW9pQUVILy93TnhFTlFCSWdGQkFSRE1BU0FCUVFGcUVJY0JJZ0VFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCREE0TEl6a2pPaEJLSWdCQi8vOERjUkRVQVNJQlFYOFF6QUVnQVVFQmF4Q0hBU0lCQkVCQkFCRE5BUVZCQVJETkFRdEJBUkRPQVF3TkN5TTVJem9RU2tILy93TnhFTWNCUWY4QmNSREpBUXdLQzBFQUVNNEJRUUFReXdGQkFSRFBBUXdNQ3hEWEFVRUJSZ1JBRU1jQkVOb0JCU005UVFGcUVEd2tQUXRCQ0E4TEl6a2pPaEJLSWdFalBFRUFFTk1CSUFFalBHb1FQQ0lBRUlZQlFmOEJjU1E1SUFBUWh3RkIvd0Z4SkRwQkFCRE9BVUVJRHdzak9TTTZFRW9pQUVILy93TnhFTlFCUWY4QmNTUTBEQWNMSXp4QkFXc1FQQ1E4UVFnUEN5TTBRUUVRekFFak5FRUJhaENIQVNRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJEQWNMSXpSQmZ4RE1BU00wUVFGckVJY0JKRFFqTkFSQVFRQVF6UUVGUVFFUXpRRUxRUUVRemdFTUJnc1F4d0ZCL3dGeEpEUU1BZ3RCQUJET0FVRUFFTXNCRU5jQlFRQkxCRUJCQUJEUEFRVkJBUkRQQVFzTUJBdEJmdzhMSXoxQkFXb1FQQ1E5REFJTElBQkJBV3NRUENJQUVJWUJRZjhCY1NRNUlBQVFod0ZCL3dGeEpEb01BUXNnQUVILy93TnhJQUVReVFFTFFRUUwyUUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBQkhCRUFnQUNJQlFjRUFSZzBCQWtBZ0FVSENBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzTUVBc2pOaVExREE4TEl6Y2tOUXdPQ3lNNEpEVU1EUXNqT1NRMURBd0xJem9rTlF3TEN5TTVJem9RU2hEVUFVSC9BWEVrTlF3S0N5TTBKRFVNQ1Fzak5TUTJEQWdMREFjTEl6Y2tOZ3dHQ3lNNEpEWU1CUXNqT1NRMkRBUUxJem9rTmd3REN5TTVJem9RU2hEVUFVSC9BWEVrTmd3Q0N5TTBKRFlNQVF0QmZ3OExRUVFMMlFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUJIQkVBZ0FDSUJRZEVBUmcwQkFrQWdBVUhTQUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOU1EzREJBTEl6WWtOd3dQQ3d3T0N5TTRKRGNNRFFzak9TUTNEQXdMSXpva053d0xDeU01SXpvUVNoRFVBVUgvQVhFa053d0tDeU0wSkRjTUNRc2pOU1E0REFnTEl6WWtPQXdIQ3lNM0pEZ01CZ3NNQlFzak9TUTREQVFMSXpva09Bd0RDeU01SXpvUVNoRFVBVUgvQVhFa09Bd0NDeU0wSkRnTUFRdEJmdzhMUVFRTDJRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFCSEJFQWdBQ0lCUWVFQVJnMEJBa0FnQVVIaUFHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlNRNURCQUxJellrT1F3UEN5TTNKRGtNRGdzak9DUTVEQTBMREF3TEl6b2tPUXdMQ3lNNUl6b1FTaERVQVVIL0FYRWtPUXdLQ3lNMEpEa01DUXNqTlNRNkRBZ0xJellrT2d3SEN5TTNKRG9NQmdzak9DUTZEQVVMSXpra09nd0VDd3dEQ3lNNUl6b1FTaERVQVVIL0FYRWtPZ3dDQ3lNMEpEb01BUXRCZnc4TFFRUUxJZ0FqaHdFRVFFRUJKRDhQQ3lOeUkzZHhRUjl4UlFSQVFRRWtRQThMUVFFa1FRdUpBZ0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FFY0VRQ0FBSWdGQjhRQkdEUUVDUUNBQlFmSUFhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lNNUl6b1FTaU0xRU1rQkRCQUxJemtqT2hCS0l6WVF5UUVNRHdzak9TTTZFRW9qTnhESkFRd09DeU01SXpvUVNpTTRFTWtCREEwTEl6a2pPaEJLSXprUXlRRU1EQXNqT1NNNkVFb2pPaERKQVF3TEN5T3lBVVVFUUJEbEFRc01DZ3NqT1NNNkVFb2pOQkRKQVF3SkN5TTFKRFFNQ0Fzak5pUTBEQWNMSXpja05Bd0dDeU00SkRRTUJRc2pPU1EwREFRTEl6b2tOQXdEQ3lNNUl6b1FTaERVQVVIL0FYRWtOQXdDQ3d3QkMwRi9Ed3RCQkF0S0FDQUJRUUJPQkVBZ0FFSC9BWEVnQUNBQmFoQ0hBVXNFUUVFQkVNOEJCVUVBRU04QkN3VWdBVUVBSUFGcklBRkJBRW9iSUFCQi93RnhTZ1JBUVFFUXp3RUZRUUFRendFTEN3czNBUUYvSXpRZ0FFSC9BWEVpQVJETUFTTTBJQUVRNXdFak5DQUFhaENIQVNRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJDMnNCQVg4ak5DQUFhaERYQVdvUWh3RWhBU00wSUFCeklBRnpFSWNCUVJCeEJFQkJBUkRMQVFWQkFCRExBUXNqTkNBQVFmOEJjV29RMXdGcUVEeEJnQUp4UVFCTEJFQkJBUkRQQVFWQkFCRFBBUXNnQVNRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJnQUZIQkVBQ1FDQUJRWUVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkRvQVF3UUN5TTJFT2dCREE4TEl6Y1E2QUVNRGdzak9CRG9BUXdOQ3lNNUVPZ0JEQXdMSXpvUTZBRU1Dd3NqT1NNNkVFb1ExQUVRNkFFTUNnc2pOQkRvQVF3SkN5TTFFT2tCREFnTEl6WVE2UUVNQndzak54RHBBUXdHQ3lNNEVPa0JEQVVMSXprUTZRRU1CQXNqT2hEcEFRd0RDeU01SXpvUVNoRFVBUkRwQVF3Q0N5TTBFT2tCREFFTFFYOFBDMEVFQ3pvQkFYOGpOQ0FBUWY4QmNVRi9iQ0lCRU13Qkl6UWdBUkRuQVNNMElBQnJFSWNCSkRRak5BUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRUxhd0VCZnlNMElBQnJFTmNCYXhDSEFTRUJJelFnQUhNZ0FYTkJFSEVRaHdFRVFFRUJFTXNCQlVFQUVNc0JDeU0wSUFCQi93RnhheERYQVdzUVBFR0FBbkZCQUVzRVFFRUJFTThCQlVFQUVNOEJDeUFCSkRRak5BUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRUw0Z0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR1FBVWNFUUFKQUlBRkJrUUZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5TTFFT3NCREJBTEl6WVE2d0VNRHdzak54RHJBUXdPQ3lNNEVPc0JEQTBMSXprUTZ3RU1EQXNqT2hEckFRd0xDeU01SXpvUVNoRFVBUkRyQVF3S0N5TTBFT3NCREFrTEl6VVE3QUVNQ0Fzak5oRHNBUXdIQ3lNM0VPd0JEQVlMSXpnUTdBRU1CUXNqT1JEc0FRd0VDeU02RU93QkRBTUxJemtqT2hCS0VOUUJFT3dCREFJTEl6UVE3QUVNQVF0QmZ3OExRUVFMS0FBak5DQUFjU1EwSXpRRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRRVF5d0ZCQUJEUEFRc3JBQ00wSUFCekVJY0JKRFFqTkFSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdGQkFCRExBVUVBRU04QkMrSUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQm9BRkhCRUFDUUNBQlFhRUJhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5SRHVBUXdRQ3lNMkVPNEJEQThMSXpjUTdnRU1EZ3NqT0JEdUFRd05DeU01RU80QkRBd0xJem9RN2dFTUN3c2pPU002RUVvUTFBRVE3Z0VNQ2dzak5CRHVBUXdKQ3lNMUVPOEJEQWdMSXpZUTd3RU1Cd3NqTnhEdkFRd0dDeU00RU84QkRBVUxJemtRN3dFTUJBc2pPaER2QVF3REN5TTVJem9RU2hEVUFSRHZBUXdDQ3lNMEVPOEJEQUVMUVg4UEMwRUVDeXdBSXpRZ0FISkIvd0Z4SkRRak5BUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVVFQUVNOEJDek1CQVg4ak5DQUFRZjhCY1VGL2JDSUJFTXdCSXpRZ0FSRG5BU00wSUFGcUJFQkJBQkROQVFWQkFSRE5BUXRCQVJET0FRdmlBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFiQUJSd1JBQWtBZ0FVR3hBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl6VVE4UUVNRUFzak5oRHhBUXdQQ3lNM0VQRUJEQTRMSXpnUThRRU1EUXNqT1JEeEFRd01DeU02RVBFQkRBc0xJemtqT2hCS0VOUUJFUEVCREFvTEl6UVE4UUVNQ1Fzak5SRHlBUXdJQ3lNMkVQSUJEQWNMSXpjUThnRU1CZ3NqT0JEeUFRd0ZDeU01RVBJQkRBUUxJem9ROGdFTUF3c2pPU002RUVvUTFBRVE4Z0VNQWdzak5CRHlBUXdCQzBGL0R3dEJCQXRDQVFKL0FrQUNRQ0FBRUkwQklnRkJmMGNFUUF3Q0N5QUFFQU1oQVFzTEFrQUNRQ0FBUVFGcUlnSVFqUUVpQUVGL1J3MEJJQUlRQXlFQUN3c2dBQ0FCRUVvTERBQkJDQkRGQVNBQUVQUUJDenNBSUFCQmdBRnhRWUFCUmdSQVFRRVF6d0VGUVFBUXp3RUxJQUFRMEFFaUFBUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVNBQUN6a0FJQUJCQVhGQkFFc0VRRUVCRU04QkJVRUFFTThCQ3lBQUVOVUJJZ0FFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCUVFBUXl3RWdBQXRJQVFGL0lBQkJnQUZ4UVlBQlJnUkFRUUVoQVFzZ0FCRFlBU0VBSUFFRVFFRUJFTThCQlVFQUVNOEJDeUFBQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVVFQUVNc0JJQUFMUmdFQmZ5QUFRUUZ4UVFGR0JFQkJBU0VCQ3lBQUVOc0JJUUFnQVFSQVFRRVF6d0VGUVFBUXp3RUxJQUFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCUVFBUXl3RWdBQXRMQVFGL0lBQkJnQUZ4UVlBQlJnUkFRUUVoQVFzZ0FFRUJkQkNIQVNFQUlBRUVRRUVCRU04QkJVRUFFTThCQ3lBQUJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FVRUFFTXNCSUFBTGF3RUNmeUFBUVlBQmNVR0FBVVlFUUVFQklRRUxJQUJCQVhGQkFVWUVRRUVCSVFJTElBQkIvd0Z4UVFGMkVJY0JJUUFnQVFSQUlBQkJnQUZ5SVFBTElBQUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJRUUFReXdFZ0FnUkFRUUVRendFRlFRQVF6d0VMSUFBTE9BQWdBRUVQY1VFRWRDQUFRZkFCY1VFRWRuSVFod0VpQUFSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdGQkFCRExBVUVBRU04QklBQUxTd0VCZnlBQVFRRnhRUUZHQkVCQkFTRUJDeUFBUWY4QmNVRUJkaENIQVNJQUJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FVRUFFTXNCSUFFRVFFRUJFTThCQlVFQUVNOEJDeUFBQ3lnQUlBRkJBU0FBZEhGQi93RnhCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVCRU1zQklBRUxJQUFnQVVFQVNnUi9JQUpCQVNBQWRISUZJQUpCQVNBQWRFRi9jM0VMSWdJTDJ3Z0JCMzlCZnlFR0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJDRzhpQnlFRklBZEZEUUFDUUNBRlFRRnJEZ2NDQXdRRkJnY0lBQXNNQ0Fzak5TRUJEQWNMSXpZaEFRd0dDeU0zSVFFTUJRc2pPQ0VCREFRTEl6a2hBUXdEQ3lNNklRRU1BZ3NqT1NNNkVFb1ExQUVoQVF3QkN5TTBJUUVMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lGSVFRZ0JVVU5BQUpBSUFSQkFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSUFCQkIwd0VRQ0FCRVBZQklRSkJBU0VEQlNBQVFROU1CRUFnQVJEM0FTRUNRUUVoQXdzTERBOExJQUJCRjB3RVFDQUJFUGdCSVFKQkFTRURCU0FBUVI5TUJFQWdBUkQ1QVNFQ1FRRWhBd3NMREE0TElBQkJKMHdFUUNBQkVQb0JJUUpCQVNFREJTQUFRUzlNQkVBZ0FSRDdBU0VDUVFFaEF3c0xEQTBMSUFCQk4wd0VRQ0FCRVB3QklRSkJBU0VEQlNBQVFUOU1CRUFnQVJEOUFTRUNRUUVoQXdzTERBd0xJQUJCeHdCTUJFQkJBQ0FCRVA0QklRSkJBU0VEQlNBQVFjOEFUQVJBUVFFZ0FSRCtBU0VDUVFFaEF3c0xEQXNMSUFCQjF3Qk1CRUJCQWlBQkVQNEJJUUpCQVNFREJTQUFRZDhBVEFSQVFRTWdBUkQrQVNFQ1FRRWhBd3NMREFvTElBQkI1d0JNQkVCQkJDQUJFUDRCSVFKQkFTRURCU0FBUWU4QVRBUkFRUVVnQVJEK0FTRUNRUUVoQXdzTERBa0xJQUJCOXdCTUJFQkJCaUFCRVA0QklRSkJBU0VEQlNBQVFmOEFUQVJBUVFjZ0FSRCtBU0VDUVFFaEF3c0xEQWdMSUFCQmh3Rk1CRUJCQUVFQUlBRVEvd0VoQWtFQklRTUZJQUJCandGTUJFQkJBVUVBSUFFUS93RWhBa0VCSVFNTEN3d0hDeUFBUVpjQlRBUkFRUUpCQUNBQkVQOEJJUUpCQVNFREJTQUFRWjhCVEFSQVFRTkJBQ0FCRVA4QklRSkJBU0VEQ3dzTUJnc2dBRUduQVV3RVFFRUVRUUFnQVJEL0FTRUNRUUVoQXdVZ0FFR3ZBVXdFUUVFRlFRQWdBUkQvQVNFQ1FRRWhBd3NMREFVTElBQkJ0d0ZNQkVCQkJrRUFJQUVRL3dFaEFrRUJJUU1GSUFCQnZ3Rk1CRUJCQjBFQUlBRVEvd0VoQWtFQklRTUxDd3dFQ3lBQVFjY0JUQVJBUVFCQkFTQUJFUDhCSVFKQkFTRURCU0FBUWM4QlRBUkFRUUZCQVNBQkVQOEJJUUpCQVNFREN3c01Bd3NnQUVIWEFVd0VRRUVDUVFFZ0FSRC9BU0VDUVFFaEF3VWdBRUhmQVV3RVFFRURRUUVnQVJEL0FTRUNRUUVoQXdzTERBSUxJQUJCNXdGTUJFQkJCRUVCSUFFUS93RWhBa0VCSVFNRklBQkI3d0ZNQkVCQkJVRUJJQUVRL3dFaEFrRUJJUU1MQ3d3QkN5QUFRZmNCVEFSQVFRWkJBU0FCRVA4QklRSkJBU0VEQlNBQVFmOEJUQVJBUVFkQkFTQUJFUDhCSVFKQkFTRURDd3NMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FISWdRRVFBSkFJQVJCQVdzT0J3SURCQVVHQndnQUN3d0lDeUFDSkRVTUJ3c2dBaVEyREFZTElBSWtOd3dGQ3lBQ0pEZ01CQXNnQWlRNURBTUxJQUlrT2d3Q0N5QUZRUVJJSWdSRkJFQWdCVUVIU2lFRUN5QUVCRUFqT1NNNkVFb2dBaERKQVFzTUFRc2dBaVEwQ3lBREJFQkJCQ0VHQ3lBR0M5UURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFjQUJSd1JBQWtBZ0FVSEJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEVOMEJEUklNRkFzalBCRDFBVUgvL3dOeElRRWpQRUVDYWhBOEpEd2dBUkNHQVVIL0FYRWtOU0FCRUljQlFmOEJjU1EyUVFRUEN4RGRBUVJBREJJRkRCQUxBQXNNRGdzUTNRRUVRQXdRQlF3TkN3QUxJenhCQW1zUVBDUThJendqTlNNMkVFb1EwZ0VNRFFzUXh3RVE2QUVNRHdzalBFRUNheEE4SkR3alBDTTlFTklCUVFBa1BRd0xDeERkQVVFQlJ3MEtEQXdMSXp3UTlRRkIvLzhEY1NROUl6eEJBbW9RUENROERBa0xFTjBCUVFGR0JFQU1DQVVNQ2dzQUN4REhBVUgvQVhFUWdBSWhBU005UVFGcUVEd2tQU0FCRHdzUTNRRkJBVVlFUUNNOFFRSnJFRHdrUENNOEl6MUJBbXBCLy84RGNSRFNBUXdHQlF3SUN3QUxEQU1MRU1jQkVPa0JEQWNMSXp4QkFtc1FQQ1E4SXp3alBSRFNBVUVJSkQwTUF3dEJmdzhMSXp4QkFtc1FQQ1E4SXp3alBVRUNhaEE4RU5JQkN4RElBVUgvL3dOeEpEMExRUWdQQ3lNOVFRSnFFRHdrUFVFTUR3c2pQQkQxQVVILy93TnhKRDBqUEVFQ2FoQThKRHhCREE4TEl6MUJBV29RUENROVFRUUxGUUFnQUVFQmNRUkFRUUVraUFFRlFRQWtod0VMQzdFREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVIUUFVY0VRQUpBSUFGQjBRRnJEZzhDQXdBRUJRWUhDQWtLQUFzQURBMEFDd3dOQ3hEWEFRME9EQkFMSXp3UTlRRkIvLzhEY1NFQkl6eEJBbW9RUENROElBRVFoZ0ZCL3dGeEpEY2dBUkNIQVVIL0FYRWtPRUVFRHdzUTF3RUVRQXdPQlF3TUN3QUxFTmNCQkVBTURRVWpQRUVDYXhBOEpEd2pQQ005UVFKcVFmLy9BM0VRMGdFTUN3c0FDeU04UVFKckVEd2tQQ004SXpjak9CQktFTklCREFvTEVNY0JFT3NCREF3TEl6eEJBbXNRUENROEl6d2pQUkRTQVVFUUpEME1DQXNRMXdGQkFVY05Cd3dKQ3lNOEVQVUJRZi8vQTNFa1BVRUJFSUlDSXp4QkFtb1FQQ1E4REFZTEVOY0JRUUZHQkVBTUJRVU1Cd3NBQ3hEWEFVRUJSZ1JBSXp4QkFtc1FQQ1E4SXp3alBVRUNhaEE4RU5JQkRBUUZEQVlMQUFzUXh3RVE3QUVNQmdzalBFRUNheEE4SkR3alBDTTlFTklCUVJna1BRd0NDMEYvRHdzUXlBRkIvLzhEY1NROUMwRUlEd3NqUFVFQ2FoQThKRDFCREE4TEl6d1E5UUZCLy84RGNTUTlJenhCQW1vUVBDUThRUXdQQ3lNOVFRRnFFRHdrUFVFRUMrQUNBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFCUndSQUFrQWdBRUhoQVdzT0R3SURBQUFFQlFZSENBa0FBQUFLQ3dBTERBc0xFTWNCUWY4QmNVR0EvZ05xSXpRUXlRRU1Dd3NqUEJEMUFVSC8vd054SVFBalBFRUNhaEE4SkR3Z0FCQ0dBVUgvQVhFa09TQUFFSWNCUWY4QmNTUTZRUVFQQ3lNMlFZRCtBMm9qTkJESkFVRUVEd3NqUEVFQ2F4QThKRHdqUENNNUl6b1FTaERTQVVFSUR3c1F4d0VRN2dFTUJ3c2pQRUVDYXhBOEpEd2pQQ005RU5JQlFTQWtQVUVJRHdzUXh3RVEyUUVoQUNNOElBQkJHSFJCR0hVaUFFRUJFTk1CSXp3Z0FHb1FQQ1E4UVFBUXpRRkJBQkRPQVNNOVFRRnFFRHdrUFVFTUR3c2pPU002RUVwQi8vOERjU1E5UVFRUEN4RElBVUgvL3dOeEl6UVF5UUVqUFVFQ2FoQThKRDFCQkE4TEVNY0JFTzhCREFJTEl6eEJBbXNRUENROEl6d2pQUkRTQVVFb0pEMUJDQThMUVg4UEN5TTlRUUZxRUR3a1BVRUVDNUlEQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCUndSQUFrQWdBRUh4QVdzT0R3SURCQUFGQmdjSUNRb0xBQUFNRFFBTERBMExFTWNCUWY4QmNVR0EvZ05xRU5RQkVJY0JKRFFNRFFzalBCRDFBVUgvL3dOeElRQWpQRUVDYWhBOEpEd2dBQkNHQVVIL0FYRWtOQ0FBRUljQlFmOEJjU1E3REEwTEl6WkJnUDREYWhEVUFSQ0hBU1EwREF3TFFRQVFnZ0lNQ3dzalBFRUNheEE4SkR3alBDTTBJenNRU2hEU0FVRUlEd3NReHdFUThRRU1DQXNqUEVFQ2F4QThKRHdqUENNOUVOSUJRVEFrUFVFSUR3c1F4d0VRMlFFaEFFRUFFTTBCUVFBUXpnRWpQQ0FBUVJoMFFSaDFJZ0JCQVJEVEFTTThJQUJxRUR3aUFCQ0dBVUgvQVhFa09TQUFFSWNCUWY4QmNTUTZJejFCQVdvUVBDUTlRUWdQQ3lNNUl6b1FTa0gvL3dOeEpEeEJDQThMRU1nQlFmLy9BM0VRMUFGQi93RnhKRFFqUFVFQ2FoQThKRDBNQlF0QkFSQ0NBZ3dFQ3hESEFSRHlBUXdDQ3lNOFFRSnJFRHdrUENNOEl6MFEwZ0ZCT0NROVFRZ1BDMEYvRHdzalBVRUJhaEE4SkQwTFFRUUwxZ0VCQVg4alBVRUJhaEE4SkQwalFRUkFJejFCQVdzUVBDUTlDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJQkJFQWdBVUVCUmcwQkFrQWdBVUVDYXc0TkF3UUZCZ2NJQ1FvTERBME9Ed0FMREE4TElBQVExZ0VQQ3lBQUVOd0JEd3NnQUJEZ0FROExJQUFRNFFFUEN5QUFFT0lCRHdzZ0FCRGpBUThMSUFBUTVBRVBDeUFBRU9ZQkR3c2dBQkRxQVE4TElBQVE3UUVQQ3lBQUVQQUJEd3NnQUJEekFROExJQUFRZ1FJUEN5QUFFSU1DRHdzZ0FCQ0VBZzhMSUFBUWhRSUxFZ0JCQUNSQVFRQWtQMEVBSkVGQkFDUkNDeFFBSXo4RWZ5TS9CU05BQ3dSQVFRRVBDMEVBQ3gwQkFYOGdBUkNHQVNFQ0lBQWdBUkNIQVJBR0lBQkJBV29nQWhBR0M0SUJBUUYvUVFBUWdnSWdBRUdQL2dNUUF4QkVJZ0VrZDBHUC9nTWdBUkFHSXp4QkFtdEIvLzhEY1NROEVJZ0NHaU04SXowUWlRSUNRQUpBQWtBQ1FDQUFCRUFDUUNBQVFRRnJEZ1FDQXdBRUFBc01CQXRCQUNSelFjQUFKRDBNQXd0QkFDUjBRY2dBSkQwTUFndEJBQ1IxUWRBQUpEME1BUXRCQUNSMlFlQUFKRDBMQzc4QkFRSi9JNGdCQkVCQkFTU0hBVUVBSklnQkN5TnlJM2R4UVI5eFFRQktCRUFqaHdFRWZ5TkFSUVVqaHdFTElnQUVRQ051Qkg4amN3VWpiZ3NpQUFSQVFRQVFpZ0pCQVNFQkJTTnZCSDhqZEFVamJ3c2lBQVJBUVFFUWlnSkJBU0VCQlNOd0JIOGpkUVVqY0FzaUFBUkFRUUlRaWdKQkFTRUJCU054Qkg4amRnVWpjUXNpQUFSQVFRUVFpZ0pCQVNFQkN3c0xDd3RCQUNFQUlBRUVRRUVVSVFBUWlBSUVRQkNIQWtFWUlRQUxDeENJQWdSQUVJY0NDeUFBRHd0QkFBc29BQ09GQVNBQWFpU0ZBU09GQVNPREFVNEVRQ09FQVVFQmFpU0VBU09GQVNPREFXc2toUUVMQzNFQkFuOUJBUkFWSTBFRVFDTTlFQU5CL3dGeEVJWUNFTVVCRUljQ0N4Q0xBaUlCUVFCS0JFQWdBUkRGQVF0QkJDRUFFSWdDUlNJQkJFQWpRa1VoQVFzZ0FRUkFJejBRQTBIL0FYRVFoZ0loQUFzak8wSHdBWEVrT3lBQVFRQk1CRUFnQUE4TElBQVF4UUZCQVJDTUFpQUFDeEFBSXpNRVFFR2d5UWdQQzBIUXBBUUxCQUFqWHd2T0FRRUVmMEdBQ0NFRElBRkJBRW9FUUNBQklRTUZJQUZCQUVnRVFFRi9JUU1MQzBFQUlRRURRQ0FHUlNJQUJFQWdBVVVoQUFzZ0FBUkFJQVJGSVFBTElBQUVRQ0FGUlNFQUN5QUFCRUFRalFKQkFFZ0VRRUVCSVFZRkl6NFFqZ0pPQkVCQkFTRUJCU0FEUVg5S0lnQUVRQkNQQWlBRFRpRUFDeUFBQkVCQkFTRUVCU0FDUVg5S0lnQUVRQ005SUFKR0lRQUxJQUFFUUVFQklRVUxDd3NMREFFTEN5QUJCRUFqUGhDT0Ftc2tQa0VBRHdzZ0JBUkFRUUVQQ3lBRkJFQkJBZzhMSXoxQkFXc1FQQ1E5UVg4TEN3QkJBVUYvUVg4UWtBSUxPQUVEZndOQUlBSWdBRWdpQXdSQUlBRkJBRTRoQXdzZ0F3UkFFSkVDSVFFZ0FrRUJhaUVDREFFTEN5QUJRUUJJQkVBZ0FROExRUUFMQ3dCQkFTQUFRWDhRa0FJTEdnRUJmMEVCUVg4Z0FCQ1FBaUlCUVFKR0JFQkJBUThMSUFFTEJRQWpnQUVMQlFBamdRRUxCUUFqZ2dFTFh3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFBaUFVRUJSZzBCQWtBZ0FVRUNhdzRHQXdRRkJnY0lBQXNNQ0FzajJBRVBDeVBaQVE4TEk5b0JEd3NqMndFUEN5UGNBUThMSTkwQkR3c2ozZ0VQQ3lQZkFROExRUUFMaXdFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQUVRQ0FBSWdKQkFVWU5BUUpBSUFKQkFtc09CZ01FQlFZSENBQUxEQWdMSUFGQkFYRWsyQUVNQndzZ0FVRUJjU1RaQVF3R0N5QUJRUUZ4Sk5vQkRBVUxJQUZCQVhFazJ3RU1CQXNnQVVFQmNTVGNBUXdEQ3lBQlFRRnhKTjBCREFJTElBRkJBWEVrM2dFTUFRc2dBVUVCY1NUZkFRc0xDZ0JCQVNSMlFRUVFYUXRrQVFKL1FRQWtRaUFBRUpnQ1JRUkFRUUVoQVFzZ0FFRUJFSmtDSUFFRVFFRUFJUUVnQUVFRFRBUkFRUUVoQVFzanJRRUVmeUFCQlNPdEFRc2lBQVJBUVFFaEFnc2pyZ0VFZnlBQlJRVWpyZ0VMSWdBRVFFRUJJUUlMSUFJRVFCQ2FBZ3NMQ3drQUlBQkJBQkNaQWd1YUFRQWdBRUVBU2dSQVFRQVFtd0lGUVFBUW5BSUxJQUZCQUVvRVFFRUJFSnNDQlVFQkVKd0NDeUFDUVFCS0JFQkJBaENiQWdWQkFoQ2NBZ3NnQTBFQVNnUkFRUU1RbXdJRlFRTVFuQUlMSUFSQkFFb0VRRUVFRUpzQ0JVRUVFSndDQ3lBRlFRQktCRUJCQlJDYkFnVkJCUkNjQWdzZ0JrRUFTZ1JBUVFZUW13SUZRUVlRbkFJTElBZEJBRW9FUUVFSEVKc0NCVUVIRUp3Q0N3c0VBQ00wQ3dRQUl6VUxCQUFqTmdzRUFDTTNDd1FBSXpnTEJBQWpPUXNFQUNNNkN3UUFJenNMQkFBalBRc0VBQ004Q3dZQUl6MFFBd3NFQUNOTEM1OERBUXAvUVlDUUFpRUpJNmNCQkVCQmdJQUNJUWtMUVlDd0FpRUtJNmdCQkVCQmdMZ0NJUW9MQWtBRFFDQUVRWUFDVGcwQkFrQkJBQ0VGQTBBZ0JVR0FBazROQVNBSklBb2dCRUVEZFVFRmRHb2dCVUVEZFdvaUJrRUFFRDhRU0NFSUlBUkJDRzhoQVVFSElBVkJDRzlySVFkQkFDRUNJeThFZnlBQVFRQktCU012Q3lJREJFQWdCa0VCRUQ4aEFndEJCaUFDRUJBRVFFRUhJQUZySVFFTFFRQWhBMEVESUFJUUVBUkFRUUVoQXdzZ0NDQUJRUUYwYWlJR0lBTVFQeUVJUVFBaEFTQUhJQVpCQVdvZ0F4QS9FQkFFUUVFQ0lRRUxJQWNnQ0JBUUJFQWdBVUVCYWlFQkN5QUVRUWgwSUFWcVFRTnNJUWNqTHdSL0lBQkJBRW9GSXk4TElnTUVRRUVBSUFKQkIzRWdBVUVBRUVzaUFSQk1JUVpCQVNBQkVFd2hBMEVDSUFFUVRDRUJJQWRCZ0pnT2FpSUNJQVk2QUFBZ0FrRUJhaUFET2dBQUlBSkJBbW9nQVRvQUFBVWdBVUhIL2dOQkFCQk5JUUlDUUVFQUlRRURRQ0FCUVFOT0RRRWdCMEdBbUE1cUlBRnFJQUk2QUFBZ0FVRUJhaUVCREFBQUN3QUxDeUFGUVFGcUlRVU1BQUFMQUFzZ0JFRUJhaUVFREFBQUN3QUxDMGNBQWtBQ1FBSkFBa0FDUUNQMkFVRUthdzRFQVFJREJBQUxBQXRCQUNFS0MwRUFJUXNMUVg4aERBc2dBQ0FCSUFJZ0F5QUVJQVVnQmlBSElBZ2dDU0FLSUFzZ0RCQlBDOWtCQVFaL0FrQURRQ0FDUVJkT0RRRUNRRUVBSVFBRFFDQUFRUjlPRFFGQkFDRUVJQUJCRDBvRVFFRUJJUVFMSUFJaEFTQUNRUTlLQkVBZ0FVRVBheUVCQ3lBQlFRUjBJUUVnQUVFUFNnUi9JQUVnQUVFUGEyb0ZJQUVnQUdvTElRRkJnSUFDSVFVZ0FrRVBTZ1JBUVlDUUFpRUZDd0pBUVFBaEF3TkFJQU5CQ0U0TkFVRUxKUFlCSUFFZ0JTQUVRUUJCQnlBRElBQkJBM1FnQWtFRGRDQURha0g0QVVHQW1CcEJBVUVBUVFBUXF3SWFJQU5CQVdvaEF3d0FBQXNBQ3lBQVFRRnFJUUFNQUFBTEFBc2dBa0VCYWlFQ0RBQUFDd0FMQ3dRQUkza0xCQUFqZWdzRUFDTjdDeGNCQVg4amZTRUFJM3dFUUVFQ0lBQVFSU0VBQ3lBQUN4UUFQd0JCaXdGSUJFQkJpd0UvQUd0QUFCb0xDeDBBQWtBQ1FBSkFJL1lCRGdJQkFnQUxBQXRCQUNFQUN5QUFFSk1DQ3djQUlBQWs5Z0VMTVFBQ1FBSkFBa0FDUUFKQUkvWUJEZ1FCQWdNRUFBc0FDMEVCSVFBTFFYOGhBUXRCZnlFQ0N5QUFJQUVnQWhDUUFnc2RBQUpBQWtBQ1FDUDJBUTRDQVFJQUN3QUxRUUFoQUFzZ0FCQ3FBZ3NBc1dNRWJtRnRaUUdwWTdZQ0FDVmpiM0psTDIxbGJXOXllUzlpWVc1cmFXNW5MMmRsZEZKdmJVSmhibXRCWkdSeVpYTnpBU1ZqYjNKbEwyMWxiVzl5ZVM5aVlXNXJhVzVuTDJkbGRGSmhiVUpoYm10QlpHUnlaWE56QWpkamIzSmxMMjFsYlc5eWVTOXRaVzF2Y25sTllYQXZaMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEF5bGpiM0psTDIxbGJXOXllUzlzYjJGa0wyVnBaMmgwUW1sMFRHOWhaRVp5YjIxSFFrMWxiVzl5ZVFRYVkyOXlaUzlqY0hVdlkzQjFMMmx1YVhScFlXeHBlbVZEY0hVRkptTnZjbVV2YldWdGIzSjVMMjFsYlc5eWVTOXBibWwwYVdGc2FYcGxRMkZ5ZEhKcFpHZGxCaXRqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzlsYVdkb2RFSnBkRk4wYjNKbFNXNTBiMGRDVFdWdGIzSjVCeDFqYjNKbEwyMWxiVzl5ZVM5a2JXRXZhVzVwZEdsaGJHbDZaVVJ0WVFncFkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlwYm1sMGFXRnNhWHBsUjNKaGNHaHBZM01KSjJOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXBibWwwYVdGc2FYcGxVR0ZzWlhSMFpRb25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzVwYm1sMGFXRnNhWHBsQ3lkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxtbHVhWFJwWVd4cGVtVU1KMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11YVc1cGRHbGhiR2w2WlEwblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNXBibWwwYVdGc2FYcGxEakZqYjNKbEwzTnZkVzVrTDJGalkzVnRkV3hoZEc5eUwybHVhWFJwWVd4cGVtVlRiM1Z1WkVGalkzVnRkV3hoZEc5eUR5QmpiM0psTDNOdmRXNWtMM052ZFc1a0wybHVhWFJwWVd4cGVtVlRiM1Z1WkJBaFkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwyTm9aV05yUW1sMFQyNUNlWFJsRVR4amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5SmJuUmxjbkoxY0hSekxuVndaR0YwWlVsdWRHVnljblZ3ZEVWdVlXSnNaV1FTUG1OdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDBsdWRHVnljblZ3ZEhNdWRYQmtZWFJsU1c1MFpYSnlkWEIwVW1WeGRXVnpkR1ZrRXk5amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5cGJtbDBhV0ZzYVhwbFNXNTBaWEp5ZFhCMGN4UWpZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMmx1YVhScFlXeHBlbVZVYVcxbGNuTVZHMk52Y21VdlkyOXlaUzl6WlhSSVlYTkRiM0psVTNSaGNuUmxaQllYWTI5eVpTOWplV05zWlhNdmNtVnpaWFJEZVdOc1pYTVhGMk52Y21VdlpYaGxZM1YwWlM5eVpYTmxkRk4wWlhCekdCUmpiM0psTDJOdmNtVXZhVzVwZEdsaGJHbDZaUmtRWTI5eVpTOWpiM0psTDJOdmJtWnBaeG9ZWTI5eVpTOWpiM0psTDJoaGMwTnZjbVZUZEdGeWRHVmtHeUpqYjNKbEwyTnZjbVV2WjJWMFUyRjJaVk4wWVhSbFRXVnRiM0o1VDJabWMyVjBIREpqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzl6ZEc5eVpVSnZiMnhsWVc1RWFYSmxZM1JzZVZSdlYyRnpiVTFsYlc5eWVSMGFZMjl5WlM5amNIVXZZM0IxTDBOd2RTNXpZWFpsVTNSaGRHVWVLV052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdWMyRjJaVk4wWVhSbEh5OWpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OUpiblJsY25KMWNIUnpMbk5oZG1WVGRHRjBaU0FqWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDBwdmVYQmhaQzV6WVhabFUzUmhkR1VoSTJOdmNtVXZiV1Z0YjNKNUwyMWxiVzl5ZVM5TlpXMXZjbmt1YzJGMlpWTjBZWFJsSWlOamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlZHbHRaWEp6TG5OaGRtVlRkR0YwWlNNZ1kyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5VGIzVnVaQzV6WVhabFUzUmhkR1VrSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWMyRjJaVk4wWVhSbEpTWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbk5oZG1WVGRHRjBaU1ltWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1ellYWmxVM1JoZEdVbkptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVjMkYyWlZOMFlYUmxLQk5qYjNKbEwyTnZjbVV2YzJGMlpWTjBZWFJsS1RKamIzSmxMMjFsYlc5eWVTOXNiMkZrTDJ4dllXUkNiMjlzWldGdVJHbHlaV04wYkhsR2NtOXRWMkZ6YlUxbGJXOXllU29hWTI5eVpTOWpjSFV2WTNCMUwwTndkUzVzYjJGa1UzUmhkR1VySm1OdmNtVXZaM0poY0docFkzTXZiR05rTDB4alpDNTFjR1JoZEdWTVkyUkRiMjUwY205c0xDbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TG14dllXUlRkR0YwWlMwdlkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlNXNTBaWEp5ZFhCMGN5NXNiMkZrVTNSaGRHVXVKbU52Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzlLYjNsd1lXUXVkWEJrWVhSbFNtOTVjR0ZrTHlOamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdlNtOTVjR0ZrTG14dllXUlRkR0YwWlRBalkyOXlaUzl0WlcxdmNua3ZiV1Z0YjNKNUwwMWxiVzl5ZVM1c2IyRmtVM1JoZEdVeEkyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OVVhVzFsY25NdWJHOWhaRk4wWVhSbE1pRmpiM0psTDNOdmRXNWtMM052ZFc1a0wyTnNaV0Z5UVhWa2FXOUNkV1ptWlhJeklHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1Ykc5aFpGTjBZWFJsTkNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExteHZZV1JUZEdGMFpUVW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTVzYjJGa1UzUmhkR1UySm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWJHOWhaRk4wWVhSbE55WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbXh2WVdSVGRHRjBaVGdUWTI5eVpTOWpiM0psTDJ4dllXUlRkR0YwWlRrZlkyOXlaUzlsZUdWamRYUmxMMmRsZEZOMFpYQnpVR1Z5VTNSbGNGTmxkRG9ZWTI5eVpTOWxlR1ZqZFhSbEwyZGxkRk4wWlhCVFpYUnpPeFZqYjNKbEwyVjRaV04xZEdVdloyVjBVM1JsY0hNOEltTnZjbVV2Y0c5eWRHRmliR1V2Y0c5eWRHRmliR1V2ZFRFMlVHOXlkR0ZpYkdVOU4yTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012UjNKaGNHaHBZM011VFVGWVgwTlpRMHhGVTE5UVJWSmZVME5CVGt4SlRrVStNbU52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVltRjBZMmhRY205alpYTnpRM2xqYkdWelB5ZGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDJ4dllXUkdjbTl0Vm5KaGJVSmhibXRBSjJOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZaMlYwVW1kaVVHbDRaV3hUZEdGeWRFRW1ZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5elpYUlFhWGhsYkU5dVJuSmhiV1ZDSkdOdmNtVXZaM0poY0docFkzTXZjSEpwYjNKcGRIa3ZaMlYwVUdsNFpXeFRkR0Z5ZEVNcVkyOXlaUzluY21Gd2FHbGpjeTl3Y21sdmNtbDBlUzluWlhSUWNtbHZjbWwwZVdadmNsQnBlR1ZzUkNGamIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmNtVnpaWFJDYVhSUGJrSjVkR1ZGSDJOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5elpYUkNhWFJQYmtKNWRHVkdLbU52Y21VdlozSmhjR2hwWTNNdmNISnBiM0pwZEhrdllXUmtVSEpwYjNKcGRIbG1iM0pRYVhobGJFYzZZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDJSeVlYZE1hVzVsVDJaVWFXeGxSbkp2YlZScGJHVkRZV05vWlVnbVkyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OW5aWFJVYVd4bFJHRjBZVUZrWkhKbGMzTkpNMk52Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5c2IyRmtVR0ZzWlhSMFpVSjVkR1ZHY205dFYyRnpiVTFsYlc5eWVVb2pZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMMk52Ym1OaGRHVnVZWFJsUW5sMFpYTkxMR052Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5blpYUlNaMkpEYjJ4dmNrWnliMjFRWVd4bGRIUmxUQzVqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdloyVjBRMjlzYjNKRGIyMXdiMjVsYm5SR2NtOXRVbWRpVFROamIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZaMlYwVFc5dWIyTm9jbTl0WlVOdmJHOXlSbkp2YlZCaGJHVjBkR1ZPSldOdmNtVXZaM0poY0docFkzTXZkR2xzWlhNdloyVjBWR2xzWlZCcGVHVnNVM1JoY25SUExHTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaSEpoZDFCcGVHVnNjMFp5YjIxTWFXNWxUMlpVYVd4bFVEZGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQweHBibVZQWmxScGJHVkdjbTl0Vkdsc1pVbGtVVGRqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkME52Ykc5eVVHbDRaV3hHY205dFZHbHNaVWxrVWp4amIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDAxdmJtOWphSEp2YldWUWFYaGxiRVp5YjIxVWFXeGxTV1JUTzJOdmNtVXZaM0poY0docFkzTXZZbUZqYTJkeWIzVnVaRmRwYm1SdmR5OWtjbUYzUW1GamEyZHliM1Z1WkZkcGJtUnZkMU5qWVc1c2FXNWxWQzlqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdmNtVnVaR1Z5UW1GamEyZHliM1Z1WkZVclkyOXlaUzluY21Gd2FHbGpjeTlpWVdOclozSnZkVzVrVjJsdVpHOTNMM0psYm1SbGNsZHBibVJ2ZDFZalkyOXlaUzluY21Gd2FHbGpjeTl6Y0hKcGRHVnpMM0psYm1SbGNsTndjbWwwWlhOWEpHTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012WDJSeVlYZFRZMkZ1YkdsdVpWZ3BZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5ZmNtVnVaR1Z5Ulc1MGFYSmxSbkpoYldWWkoyTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WTJ4bFlYSlFjbWx2Y21sMGVVMWhjRm9pWTI5eVpTOW5jbUZ3YUdsamN5OTBhV3hsY3k5eVpYTmxkRlJwYkdWRFlXTm9aVnM3WTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OUhjbUZ3YUdsamN5NU5TVTVmUTFsRFRFVlRYMU5RVWtsVVJWTmZURU5FWDAxUFJFVmNRV052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVRVbE9YME5aUTB4RlUxOVVVa0ZPVTBaRlVsOUVRVlJCWDB4RFJGOU5UMFJGWFN4amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5ZmNtVnhkV1Z6ZEVsdWRHVnljblZ3ZEY0dVkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmNtVnhkV1Z6ZEV4alpFbHVkR1Z5Y25Wd2RGOHBZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1aVlYUmphRkJ5YjJObGMzTkRlV05zWlhOZ0xXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1YldGNFJuSmhiV1ZUWlhGMVpXNWpaVU41WTJ4bGMyRXBZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzUxY0dSaGRHVk1aVzVuZEdoaUtXTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRHVnVaM1JvWXlsamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlV4bGJtZDBhR1FwWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTkM5RGFHRnVibVZzTkM1MWNHUmhkR1ZNWlc1bmRHaGxMR052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2WjJWMFRtVjNSbkpsY1hWbGJtTjVSbkp2YlZOM1pXVndaaWxqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5ObGRFWnlaWEYxWlc1amVXY3lZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlqWVd4amRXeGhkR1ZUZDJWbGNFRnVaRU5vWldOclQzWmxjbVpzYjNkb0tHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFUzZGxaWEJwSzJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsUlc1MlpXeHZjR1ZxSzJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRYQmtZWFJsUlc1MlpXeHZjR1ZySzJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsUlc1MlpXeHZjR1ZzSldOdmNtVXZjMjkxYm1RdmMyOTFibVF2ZFhCa1lYUmxSbkpoYldWVFpYRjFaVzVqWlhKdExtTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkMmxzYkVOb1lXNXVaV3hWY0dSaGRHVnVLbU52Y21VdmMyOTFibVF2WVdOamRXMTFiR0YwYjNJdlpHbGtRMmhoYm01bGJFUmhZME5vWVc1blpXOHVZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUzYVd4c1EyaGhibTVsYkZWd1pHRjBaWEF1WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1M2FXeHNRMmhoYm01bGJGVndaR0YwWlhFdVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTNhV3hzUTJoaGJtNWxiRlZ3WkdGMFpYSW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzV5WlhObGRGUnBiV1Z5Y3oxamIzSmxMM052ZFc1a0wyUjFkSGt2YVhORWRYUjVRM2xqYkdWRGJHOWphMUJ2YzJsMGFYWmxUM0pPWldkaGRHbDJaVVp2Y2xkaGRtVm1iM0p0ZENaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExtZGxkRk5oYlhCc1pYVTJZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzVuWlhSVFlXMXdiR1ZHY205dFEzbGpiR1ZEYjNWdWRHVnlkaWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5KbGMyVjBWR2x0WlhKM0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVaMlYwVTJGdGNHeGxlRFpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG1kbGRGTmhiWEJzWlVaeWIyMURlV05zWlVOdmRXNTBaWEo1SjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWNtVnpaWFJVYVcxbGNub2lZMjl5WlM5d2IzSjBZV0pzWlM5d2IzSjBZV0pzWlM5cE16SlFiM0owWVdKc1pYc21ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTVuWlhSVFlXMXdiR1Y4Tm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdVoyVjBVMkZ0Y0d4bFJuSnZiVU41WTJ4bFEyOTFiblJsY24wN1kyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNW5aWFJPYjJselpVTm9ZVzV1Wld4R2NtVnhkV1Z1WTNsUVpYSnBiMlIrSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdVoyVjBVMkZ0Y0d4bGZ6WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbWRsZEZOaGJYQnNaVVp5YjIxRGVXTnNaVU52ZFc1MFpYS0FBUnhqYjNKbEwyTndkUzlqY0hVdlEzQjFMa05NVDBOTFgxTlFSVVZFZ1FFcVkyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5VGIzVnVaQzV0WVhoRWIzZHVVMkZ0Y0d4bFEzbGpiR1Z6Z2dFb1kyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5blpYUlRZVzF3YkdWQmMxVnVjMmxuYm1Wa1FubDBaWU1CSW1OdmNtVXZjMjkxYm1RdmMyOTFibVF2YldsNFEyaGhibTVsYkZOaGJYQnNaWE9FQVROamIzSmxMM052ZFc1a0wzTnZkVzVrTDNObGRFeGxablJCYm1SU2FXZG9kRTkxZEhCMWRFWnZja0YxWkdsdlVYVmxkV1dGQVNaamIzSmxMM052ZFc1a0wyRmpZM1Z0ZFd4aGRHOXlMMkZqWTNWdGRXeGhkR1ZUYjNWdVpJWUJJR052Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl6Y0d4cGRFaHBaMmhDZVhSbGh3RWZZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM053YkdsMFRHOTNRbmwwWllnQkgyTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlkyRnNZM1ZzWVhSbFUyOTFibVNKQVJ4amIzSmxMM052ZFc1a0wzTnZkVzVrTDNWd1pHRjBaVk52ZFc1a2lnRWlZMjl5WlM5emIzVnVaQzl6YjNWdVpDOWlZWFJqYUZCeWIyTmxjM05CZFdScGI0c0JLMk52Y21VdmMyOTFibVF2Y21WbmFYTjBaWEp6TDFOdmRXNWtVbVZuYVhOMFpYSlNaV0ZrVkhKaGNIT01BU0ZqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2WjJWMFNtOTVjR0ZrVTNSaGRHV05BU1JqYjNKbEwyMWxiVzl5ZVM5eVpXRmtWSEpoY0hNdlkyaGxZMnRTWldGa1ZISmhjSE9PQVRKamIzSmxMMjFsYlc5eWVTOXNiMkZrTDJWcFoyaDBRbWwwVEc5aFpFWnliMjFIUWsxbGJXOXllVmRwZEdoVWNtRndjNDhCSVdOdmNtVXZiV1Z0YjNKNUwySmhibXRwYm1jdmFHRnVaR3hsUW1GdWEybHVaNUFCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE1KRUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TUpJQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRsSjRNWk1CSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRYQmtZWFJsVGxKNE1aUUJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TVpVQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFRsSjRNWllCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE1wY0JKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUbEo0TXBnQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkWEJrWVhSbFRsSjRNcGtCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVGxKNE1wb0JKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUbEo0TTVzQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRsSjRNNXdCSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRYQmtZWFJsVGxKNE01MEJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUbEo0TTU0QkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRsSjROSjhCSkdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRISnBaMmRsY3FBQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRsSjROS0VCSkdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRISnBaMmRsY3FJQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkWEJrWVhSbFRsSjROS01CSkdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRISnBaMmRsY3FRQkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFRsSjROS1VCSkdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRISnBaMmRsY3FZQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTUtjQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTWFnQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTXFrQkxHTnZjbVV2YzI5MWJtUXZjbVZuYVhOMFpYSnpMMU52ZFc1a1VtVm5hWE4wWlhKWGNtbDBaVlJ5WVhCenFnRWxZMjl5WlM5bmNtRndhR2xqY3k5c1kyUXZUR05rTG5Wd1pHRjBaVXhqWkZOMFlYUjFjNnNCSUdOdmNtVXZiV1Z0YjNKNUwyUnRZUzl6ZEdGeWRFUnRZVlJ5WVc1elptVnlyQUVuWTI5eVpTOXRaVzF2Y25rdlpHMWhMMmRsZEVoa2JXRlRiM1Z5WTJWR2NtOXRUV1Z0YjNKNXJRRXNZMjl5WlM5dFpXMXZjbmt2WkcxaEwyZGxkRWhrYldGRVpYTjBhVzVoZEdsdmJrWnliMjFOWlcxdmNubXVBU0ZqYjNKbEwyMWxiVzl5ZVM5a2JXRXZjM1JoY25SSVpHMWhWSEpoYm5ObVpYS3ZBVEpqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmMzUnZjbVZRWVd4bGRIUmxRbmwwWlVsdVYyRnpiVTFsYlc5eWViQUJNR052Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5cGJtTnlaVzFsYm5SUVlXeGxkSFJsU1c1a1pYaEpabE5sZExFQkwyTnZjbVV2WjNKaGNHaHBZM012Y0dGc1pYUjBaUzkzY21sMFpVTnZiRzl5VUdGc1pYUjBaVlJ2VFdWdGIzSjVzZ0V3WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12Y21WeGRXVnpkRlJwYldWeVNXNTBaWEp5ZFhCMHN3RXFZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMTluWlhSVWFXMWxja052ZFc1MFpYSk5ZWE5yUW1sMHRBRTdZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMTlqYUdWamEwUnBkbWxrWlhKU1pXZHBjM1JsY2taaGJHeHBibWRGWkdkbFJHVjBaV04wYjNLMUFTbGpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZYMmx1WTNKbGJXVnVkRlJwYldWeVEyOTFiblJsY3JZQkgyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OTFjR1JoZEdWVWFXMWxjbk8zQVNWamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlltRjBZMmhRY205alpYTnpWR2x0WlhKenVBRXZZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMVJwYldWeWN5NTFjR1JoZEdWRWFYWnBaR1Z5VW1WbmFYTjBaWEs1QVN4amIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlZHbHRaWEp6TG5Wd1pHRjBaVlJwYldWeVEyOTFiblJsY3JvQksyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OVVhVzFsY25NdWRYQmtZWFJsVkdsdFpYSk5iMlIxYkcrN0FTeGpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlZScGJXVnlRMjl1ZEhKdmJMd0JKbU52Y21VdmJXVnRiM0o1TDNkeWFYUmxWSEpoY0hNdlkyaGxZMnRYY21sMFpWUnlZWEJ6dlFFMFkyOXlaUzl0WlcxdmNua3ZjM1J2Y21VdlpXbG5hSFJDYVhSVGRHOXlaVWx1ZEc5SFFrMWxiVzl5ZVZkcGRHaFVjbUZ3Yzc0QkhHTnZjbVV2YldWdGIzSjVMMlJ0WVM5b1pHMWhWSEpoYm5ObVpYSy9BU0JqYjNKbEwyMWxiVzl5ZVM5a2JXRXZkWEJrWVhSbFNHSnNZVzVyU0dSdFljQUJNV052Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMM0psY1hWbGMzUldRbXhoYm10SmJuUmxjbkoxY0hUQkFSNWpiM0psTDJkeVlYQm9hV056TDJ4alpDOXpaWFJNWTJSVGRHRjBkWFBDQVNWamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMM1Z3WkdGMFpVZHlZWEJvYVdOend3RXJZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5aVlYUmphRkJ5YjJObGMzTkhjbUZ3YUdsamM4UUJHbU52Y21VdlkzbGpiR1Z6TDNSeVlXTnJRM2xqYkdWelVtRnV4UUVXWTI5eVpTOWplV05zWlhNdmMzbHVZME41WTJ4bGM4WUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZaMlYwUkdGMFlVSjVkR1ZVZDIvSEFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyZGxkRVJoZEdGQ2VYUmxUMjVseUFFb1kyOXlaUzlqY0hVdmIzQmpiMlJsY3k5blpYUkRiMjVqWVhSbGJtRjBaV1JFWVhSaFFubDBaY2tCS0dOdmNtVXZZM0IxTDI5d1kyOWtaWE12WldsbmFIUkNhWFJUZEc5eVpWTjVibU5EZVdOc1pYUEtBUmxqYjNKbEwyTndkUzltYkdGbmN5OXpaWFJHYkdGblFtbDB5d0VmWTI5eVpTOWpjSFV2Wm14aFozTXZjMlYwU0dGc1prTmhjbko1Um14aFo4d0JMMk52Y21VdlkzQjFMMlpzWVdkekwyTm9aV05yUVc1a1UyVjBSV2xuYUhSQ2FYUklZV3htUTJGeWNubEdiR0ZuelFFYVkyOXlaUzlqY0hVdlpteGhaM012YzJWMFdtVnliMFpzWVdmT0FSNWpiM0psTDJOd2RTOW1iR0ZuY3k5elpYUlRkV0owY21GamRFWnNZV2ZQQVJ0amIzSmxMMk53ZFM5bWJHRm5jeTl6WlhSRFlYSnllVVpzWVdmUUFTRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZjbTkwWVhSbFFubDBaVXhsWm5UUkFUWmpiM0psTDIxbGJXOXllUzl6ZEc5eVpTOXphWGgwWldWdVFtbDBVM1J2Y21WSmJuUnZSMEpOWlcxdmNubFhhWFJvVkhKaGNIUFNBU3BqYjNKbEwyTndkUzl2Y0dOdlpHVnpMM05wZUhSbFpXNUNhWFJUZEc5eVpWTjVibU5EZVdOc1pYUFRBVFJqYjNKbEwyTndkUzltYkdGbmN5OWphR1ZqYTBGdVpGTmxkRk5wZUhSbFpXNUNhWFJHYkdGbmMwRmtaRTkyWlhKbWJHOTMxQUVuWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlsYVdkb2RFSnBkRXh2WVdSVGVXNWpRM2xqYkdWejFRRWlZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM0p2ZEdGMFpVSjVkR1ZTYVdkb2ROWUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTUhqWEFSdGpiM0psTDJOd2RTOW1iR0ZuY3k5blpYUkRZWEp5ZVVac1lXZllBUzFqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2Y205MFlYUmxRbmwwWlV4bFpuUlVhSEp2ZFdkb1EyRnljbm5aQVNGamIzSmxMM0J2Y25SaFlteGxMM0J2Y25SaFlteGxMMms0VUc5eWRHRmliR1hhQVNKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZjbVZzWVhScGRtVktkVzF3MndFdVkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzSnZkR0YwWlVKNWRHVlNhV2RvZEZSb2NtOTFaMmhEWVhKeWVkd0JIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTVhqZEFScGpiM0psTDJOd2RTOW1iR0ZuY3k5blpYUmFaWEp2Um14aFo5NEJIMk52Y21VdlkzQjFMMlpzWVdkekwyZGxkRWhoYkdaRFlYSnllVVpzWVdmZkFSNWpiM0psTDJOd2RTOW1iR0ZuY3k5blpYUlRkV0owY21GamRFWnNZV2ZnQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUSjQ0UUVmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVemVPSUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTkhqakFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVFY0NUFFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTJlT1VCRzJOdmNtVXZZM0IxTDJOd2RTOURjSFV1Wlc1aFlteGxTR0ZzZE9ZQkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxOM2puQVN0amIzSmxMMk53ZFM5bWJHRm5jeTlqYUdWamEwRnVaRk5sZEVWcFoyaDBRbWwwUTJGeWNubEdiR0ZuNkFFaVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMMkZrWkVGU1pXZHBjM1JsY3VrQkxtTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTloWkdSQlZHaHliM1ZuYUVOaGNuSjVVbVZuYVhOMFpYTHFBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRoNDZ3RWlZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNOMVlrRlNaV2RwYzNSbGN1d0JMbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emRXSkJWR2h5YjNWbmFFTmhjbko1VW1WbmFYTjBaWEx0QVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUbDQ3Z0VpWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwyRnVaRUZTWldkcGMzUmxjdThCSW1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OTRiM0pCVW1WbmFYTjBaWEx3QVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pVRjQ4UUVoWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwyOXlRVkpsWjJsemRHVnk4Z0VoWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwyTndRVkpsWjJsemRHVnk4d0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdWQ2VQUUJLMk52Y21VdmJXVnRiM0o1TDJ4dllXUXZjMmw0ZEdWbGJrSnBkRXh2WVdSR2NtOXRSMEpOWlcxdmNubjFBU2xqYjNKbEwyTndkUzl2Y0dOdlpHVnpMM05wZUhSbFpXNUNhWFJNYjJGa1UzbHVZME41WTJ4bGMvWUJLR052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5eWIzUmhkR1ZTWldkcGMzUmxja3hsWm5UM0FTbGpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSlNhV2RvZFBnQk5HTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl5YjNSaGRHVlNaV2RwYzNSbGNreGxablJVYUhKdmRXZG9RMkZ5Y25uNUFUVmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSlNhV2RvZEZSb2NtOTFaMmhEWVhKeWVmb0JKMk52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRXhsWm5SU1pXZHBjM1JsY3ZzQk1tTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6YUdsbWRGSnBaMmgwUVhKcGRHaHRaWFJwWTFKbFoybHpkR1Z5L0FFclkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM04zWVhCT2FXSmliR1Z6VDI1U1pXZHBjM1JsY3YwQkwyTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6YUdsbWRGSnBaMmgwVEc5bmFXTmhiRkpsWjJsemRHVnkvZ0VuWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzUmxjM1JDYVhSUGJsSmxaMmx6ZEdWeS93RW1ZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNObGRFSnBkRTl1VW1WbmFYTjBaWEtBQWlGamIzSmxMMk53ZFM5allrOXdZMjlrWlhNdmFHRnVaR3hsUTJKUGNHTnZaR1dCQWg5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pVTjRnZ0lvWTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12YzJWMFNXNTBaWEp5ZFhCMGM0TUNIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsUkhpRUFoOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVVY0aFFJZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkdlSVlDSG1OdmNtVXZZM0IxTDI5d1kyOWtaWE12WlhobFkzVjBaVTl3WTI5a1pZY0NJR052Y21VdlkzQjFMMk53ZFM5RGNIVXVaWGhwZEVoaGJIUkJibVJUZEc5d2lBSVpZMjl5WlM5amNIVXZZM0IxTDBOd2RTNXBjMGhoYkhSbFpJa0NMV052Y21VdmJXVnRiM0o1TDNOMGIzSmxMM05wZUhSbFpXNUNhWFJUZEc5eVpVbHVkRzlIUWsxbGJXOXllWW9DSzJOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDE5b1lXNWtiR1ZKYm5SbGNuSjFjSFNMQWlwamIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5amFHVmphMGx1ZEdWeWNuVndkSE9NQWhwamIzSmxMMlY0WldOMWRHVXZkSEpoWTJ0VGRHVndjMUpoYm8wQ0dHTnZjbVV2WlhobFkzVjBaUzlsZUdWamRYUmxVM1JsY0k0Q0pXTnZjbVV2WTNCMUwyTndkUzlEY0hVdVRVRllYME5aUTB4RlUxOVFSVkpmUmxKQlRVV1BBakJqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMmRsZEU1MWJXSmxjazltVTJGdGNHeGxjMGx1UVhWa2FXOUNkV1ptWlhLUUFpSmpiM0psTDJWNFpXTjFkR1V2WlhobFkzVjBaVlZ1ZEdsc1EyOXVaR2wwYVc5dWtRSVpZMjl5WlM5bGVHVmpkWFJsTDJWNFpXTjFkR1ZHY21GdFpaSUNJbU52Y21VdlpYaGxZM1YwWlM5bGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYT1RBaVpqYjNKbEwyVjRaV04xZEdVdlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYjVRQ0tHTnZjbVV2WlhobFkzVjBaUzlsZUdWamRYUmxSbkpoYldWVmJuUnBiRUp5WldGcmNHOXBiblNWQWlCamIzSmxMMk41WTJ4bGN5OW5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkSllDR0dOdmNtVXZZM2xqYkdWekwyZGxkRU41WTJ4bFUyVjBjNWNDRldOdmNtVXZZM2xqYkdWekwyZGxkRU41WTJ4bGM1Z0NOR052Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzlmWjJWMFNtOTVjR0ZrUW5WMGRHOXVVM1JoZEdWR2NtOXRRblYwZEc5dVNXU1pBalJqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2WDNObGRFcHZlWEJoWkVKMWRIUnZibE4wWVhSbFJuSnZiVUoxZEhSdmJrbGttZ0l4WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12Y21WeGRXVnpkRXB2ZVhCaFpFbHVkR1Z5Y25Wd2RKc0NKV052Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzlmY0hKbGMzTktiM2x3WVdSQ2RYUjBiMjZjQWlkamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdlgzSmxiR1ZoYzJWS2IzbHdZV1JDZFhSMGIyNmRBaUZqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2YzJWMFNtOTVjR0ZrVTNSaGRHV2VBaUZqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlNaV2RwYzNSbGNrR2ZBaUZqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlNaV2RwYzNSbGNrS2dBaUZqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlNaV2RwYzNSbGNrT2hBaUZqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlNaV2RwYzNSbGNrU2lBaUZqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlNaV2RwYzNSbGNrV2pBaUZqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlNaV2RwYzNSbGNraWtBaUZqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlNaV2RwYzNSbGNreWxBaUZqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlNaV2RwYzNSbGNrYW1BaVpqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlFjbTluY21GdFEyOTFiblJsY3FjQ0pHTnZjbVV2WkdWaWRXY3ZaR1ZpZFdjdFkzQjFMMmRsZEZOMFlXTnJVRzlwYm5SbGNxZ0NMbU52Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRFOXdZMjlrWlVGMFVISnZaM0poYlVOdmRXNTBaWEtwQWg5amIzSmxMMlJsWW5WbkwyUmxZblZuTFdkeVlYQm9hV056TDJkbGRFeFpxZ0kzWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFuY21Gd2FHbGpjeTlrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZWFzQ04yTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaSEpoZDFCcGVHVnNjMFp5YjIxTWFXNWxUMlpVYVd4bGZIUnlZVzF3YjJ4cGJtV3NBakpqYjNKbEwyUmxZblZuTDJSbFluVm5MV2R5WVhCb2FXTnpMMlJ5WVhkVWFXeGxSR0YwWVZSdlYyRnpiVTFsYlc5eWVhMENIV052Y21VdlpHVmlkV2N2WkdWaWRXY3RkR2x0WlhJdloyVjBSRWxXcmdJZVkyOXlaUzlrWldKMVp5OWtaV0oxWnkxMGFXMWxjaTluWlhSVVNVMUJyd0lkWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTEwYVcxbGNpOW5aWFJVVFVHd0FoMWpiM0psTDJSbFluVm5MMlJsWW5WbkxYUnBiV1Z5TDJkbGRGUkJRN0VDQlhOMFlYSjBzZ0l4WTI5eVpTOWxlR1ZqZFhSbEwyVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVc5OGRISmhiWEJ2YkdsdVpiTUNDSDV6WlhSaGNtZGp0QUl0WTI5eVpTOWxlR1ZqZFhSbEwyVjRaV04xZEdWVmJuUnBiRU52Ym1ScGRHbHZibngwY21GdGNHOXNhVzVsdFFKQ1kyOXlaUzlrWldKMVp5OWtaV0oxWnkxbmNtRndhR2xqY3k5a2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVYeDBjbUZ0Y0c5c2FXNWxBRE1RYzI5MWNtTmxUV0Z3Y0dsdVoxVlNUQ0ZqYjNKbEwyUnBjM1F2WTI5eVpTNTFiblJ2ZFdOb1pXUXVkMkZ6YlM1dFlYQT0iKSkuaW5zdGFuY2U7CmNvbnN0IGI9bmV3IFVpbnQ4QXJyYXkoYS5leHBvcnRzLm1lbW9yeS5idWZmZXIpO3JldHVybntpbnN0YW5jZTphLGJ5dGVNZW1vcnk6Yix0eXBlOiJXZWIgQXNzZW1ibHkifX07bGV0IHIsQixkO2Q9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsCldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sZnJhbWVTa2lwQ291bnRlcjowLGN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjooYSk9Pntjb25zdCBiPW4oYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGcuQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhkLmdyYXBoaWNzV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShGLmJpbmQodm9pZCAwLGQpLGQuZ3JhcGhpY3NXb3JrZXJQb3J0KSk6Ik1FTU9SWSI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGQubWVtb3J5V29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShJLmJpbmQodm9pZCAwLGQpLGQubWVtb3J5V29ya2VyUG9ydCkpOgoiQ09OVFJPTExFUiI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGQuY29udHJvbGxlcldvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoSC5iaW5kKHZvaWQgMCxkKSxkLmNvbnRyb2xsZXJXb3JrZXJQb3J0KSk6IkFVRElPIj09PWIubWVzc2FnZS53b3JrZXJJZCYmKGQuYXVkaW9Xb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEcuYmluZCh2b2lkIDAsZCksZC5hdWRpb1dvcmtlclBvcnQpKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLklOU1RBTlRJQVRFX1dBU006KGFzeW5jKCk9PntsZXQgYTthPWF3YWl0IE0ocCk7ZC53YXNtSW5zdGFuY2U9YS5pbnN0YW5jZTtkLndhc21CeXRlTWVtb3J5PWEuYnl0ZU1lbW9yeTtrKGgoe3R5cGU6YS50eXBlfSxiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIGcuQ09ORklHOmQud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KGQsYi5tZXNzYWdlLmNvbmZpZyk7ZC5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zOwprKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLlJFU0VUX0FVRElPX1FVRVVFOmQud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZy5QTEFZOmlmKCFkLnBhdXNlZHx8IWQud2FzbUluc3RhbmNlfHwhZC53YXNtQnl0ZU1lbW9yeSl7ayhoKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTticmVha31kLnBhdXNlZD0hMTtkLmZwc1RpbWVTdGFtcHM9W107ZC5mcmFtZVNraXBDb3VudGVyPTA7ZC5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7QyhkLDFFMy9kLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7eihkKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLlBBVVNFOmQucGF1c2VkPSEwO2QudXBkYXRlSWQmJihjbGVhclRpbWVvdXQoZC51cGRhdGVJZCksZC51cGRhdGVJZD12b2lkIDApO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGcuUlVOX1dBU01fRVhQT1JUOmE9CmIubWVzc2FnZS5wYXJhbWV0ZXJzP2Qud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpkLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ayhoKHt0eXBlOmcuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPTA7bGV0IGM9ZC53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7Yi5tZXNzYWdlLnN0YXJ0JiYoYT1iLm1lc3NhZ2Uuc3RhcnQpO2IubWVzc2FnZS5lbmQmJihjPWIubWVzc2FnZS5lbmQpO2E9ZC53YXNtQnl0ZU1lbW9yeS5zbGljZShhLGMpLmJ1ZmZlcjtrKGgoe3R5cGU6Zy5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSBnLkdFVF9XQVNNX0NPTlNUQU5UOmsoaCh7dHlwZTpnLkdFVF9XQVNNX0NPTlNUQU5ULHJlc3BvbnNlOmQud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmNvbnN0YW50XS52YWx1ZU9mKCl9LApiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYil9fSxnZXRGUFM6KCk9PjA8ZC50aW1lU3RhbXBzVW50aWxSZWFkeT9kLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpkLmZwc1RpbWVTdGFtcHM/ZC5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGQubWVzc2FnZUhhbmRsZXIpfSkoKTsK";

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
  libWorkerUrl = wasmboyLibWasmWorkerUrl;
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
	"debugger:build": "npx preact build -p --src demo/debugger --no-prerender --service-worker=false",
	"benchmark:build": "npx rollup -c --environment PROD,TS,BENCHMARK",
	"benchmark:build:skiplib": "npx rollup -c --environment PROD,TS,BENCHMARK,SKIP_LIB",
	"benchmark:dev": "npm run benchmark:watch",
	"benchmark:watch": "npx rollup -c -w --environment TS,BENCHMARK,SERVE",
	"amp:build": "npx rollup -c --environment PROD,TS,AMP",
	"amp:build:skiplib": "npx rollup -c --environment PROD,TS,AMP,SKIP_LIB",
	"amp:dev": "npm run amp:watch",
	"amp:watch": "npx rollup -c -w --environment TS,AMP,SERVE",
	"demo:cname": "echo 'wasmboy.app' > build/CNAME",
	"demo:build": "npx run-s core:build lib:build demo:build:apps",
	"demo:build:apps": "npx run-s debugger:build benchmark:build:skiplib amp:build:skiplib demo:build:serviceworker",
	"demo:build:serviceworker": "rm build/sw.js && cp demo/sw.js build",
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
//# sourceMappingURL=wasmboy.wasm.cjs.js.map
