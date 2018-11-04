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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6dS5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBHKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKX19ZnVuY3Rpb24gSChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLApXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSShhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4hMTtsZXQgYj1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN10sZD12b2lkIDA7aWYoMD09PWIpcmV0dXJuITE7MTw9YiYmMz49Yj9kPTMyNzY4OjU8PWImJjY+PWI/ZD0yMDQ4OjE1PD0KYiYmMTk+PWI/ZD0zMjc2ODoyNTw9YiYmMzA+PWImJihkPTEzMTA3Mik7cmV0dXJuIGQ/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2QpOiExfWZ1bmN0aW9uIHooYSl7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zYXZlU3RhdGUoKTtyZXR1cm4gYS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFKX1mdW5jdGlvbiBKKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkNMRUFSX01FTU9SWTpmb3IodmFyIGQ9MDtkPD1hLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtkKyspYS53YXNtQnl0ZU1lbW9yeVtkXT0wO2Q9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSgwKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkNMRUFSX01FTU9SWV9ET05FLAp3YXNtQnl0ZU1lbW9yeTpkLmJ1ZmZlcn0sYi5tZXNzYWdlSWQpLFtkLmJ1ZmZlcl0pO2JyZWFrO2Nhc2UgZi5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7CmEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKSwKV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlNFVF9NRU1PUlk6ZD1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2QuaW5jbHVkZXMoZy5DQVJUUklER0VfUk9NKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuQ0FSVFJJREdFX1JPTV0pLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JBTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9SQU1dKSxhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04pO2QuaW5jbHVkZXMoZy5HQU1FQk9ZX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkdBTUVCT1lfTUVNT1JZXSksYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLlBBTEVUVEVfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuUEFMRVRURV9NRU1PUlldKSwKYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuSU5URVJOQUxfU1RBVEVdKSxhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04pLGEud2FzbUluc3RhbmNlLmV4cG9ydHMubG9hZFN0YXRlKCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuU0VUX01FTU9SWV9ET05FfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5HRVRfTUVNT1JZOntkPXt0eXBlOmYuR0VUX01FTU9SWX07Y29uc3QgbD1bXTt2YXIgYz1iLm1lc3NhZ2UubWVtb3J5VHlwZXM7aWYoYy5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXt2YXIgZT1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIG09dm9pZCAwOzA9PT1lP209MzI3Njg6MTw9CmUmJjM+PWU/bT0yMDk3MTUyOjU8PWUmJjY+PWU/bT0yNjIxNDQ6MTU8PWUmJjE5Pj1lP209MjA5NzE1MjoyNTw9ZSYmMzA+PWUmJihtPTgzODg2MDgpO2U9bT9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK20pOiExfWVsc2UgZT0hMTtlPWUuYnVmZmVyO2RbZy5DQVJUUklER0VfUk9NXT1lO2wucHVzaChlKX1jLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JBTSkmJihlPXkoYSkuYnVmZmVyLGRbZy5DQVJUUklER0VfUkFNXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkNBUlRSSURHRV9IRUFERVIpJiYoYS53YXNtQnl0ZU1lbW9yeT8oZT1hLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMDgsZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGUsZSsyNykpOmU9ITEsZT1lLmJ1ZmZlcixkW2cuQ0FSVFJJREdFX0hFQURFUl09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5HQU1FQk9ZX01FTU9SWSkmJgooZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUpLmJ1ZmZlcixkW2cuR0FNRUJPWV9NRU1PUlldPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiYoZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcixkW2cuUEFMRVRURV9NRU1PUlldPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zYXZlU3RhdGUoKSxjPXooYSkuYnVmZmVyLGRbZy5JTlRFUk5BTF9TVEFURV09YyxsLnB1c2goYykpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGQsCmIubWVzc2FnZUlkKSxsKX19fWZ1bmN0aW9uIEsoYSl7Y29uc3QgYj0idW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKTtmb3IoO2EuZnBzVGltZVN0YW1wc1swXTxiLTFFMzspYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCk7YS5mcHNUaW1lU3RhbXBzLnB1c2goYik7YS50aW1lU3RhbXBzVW50aWxSZWFkeS0tOzA+YS50aW1lU3RhbXBzVW50aWxSZWFkeSYmKGEudGltZVN0YW1wc1VudGlsUmVhZHk9MCk7cmV0dXJuIGJ9ZnVuY3Rpb24gQShhKXthLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTkwPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZT8xLjI1Kk1hdGguZmxvb3IoYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpOjEyMH1mdW5jdGlvbiBCKGEpe3ZhciBiPSgidW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKSktYS5mcHNUaW1lU3RhbXBzW2EuZnBzVGltZVN0YW1wcy5sZW5ndGgtMV07Yj0KQy1iOzA+YiYmKGI9MCk7YS51cGRhdGVJZD1zZXRUaW1lb3V0KCgpPT57RChhKX0sTWF0aC5mbG9vcihiKSl9ZnVuY3Rpb24gRChhLGIpe2lmKGEucGF1c2VkKXJldHVybiEwO3ZvaWQgMCE9PWImJihDPWIpO3I9YS5nZXRGUFMoKTtpZihyPmEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKzEpcmV0dXJuIGEuZnBzVGltZVN0YW1wcy5zaGlmdCgpLEIoYSksITA7SyhhKTtjb25zdCBkPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoKGIpPT57bGV0IGM7ZD92KGEsYik6KGM9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWUoKSxiKGMpKX0pKS50aGVuKChiKT0+ezA8PWI/KGsoaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSksYj0hMSxhLm9wdGlvbnMuZnJhbWVTa2lwJiYwPGEub3B0aW9ucy5mcmFtZVNraXAmJihhLmZyYW1lU2tpcENvdW50ZXIrKyxhLmZyYW1lU2tpcENvdW50ZXI8PQphLm9wdGlvbnMuZnJhbWVTa2lwP2I9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApLGJ8fChiPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTithLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFKS5idWZmZXIsYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLlVQREFURUQsZ3JhcGhpY3NGcmFtZUJ1ZmZlcjpifSksW2JdKSksYj17dHlwZTpmLlVQREFURUR9LGJbZy5DQVJUUklER0VfUkFNXT15KGEpLmJ1ZmZlcixiW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLGJbZy5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sCmEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGJbZy5JTlRFUk5BTF9TVEFURV09eihhKS5idWZmZXIsYS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoYiksW2JbZy5DQVJUUklER0VfUkFNXSxiW2cuR0FNRUJPWV9NRU1PUlldLGJbZy5QQUxFVFRFX01FTU9SWV0sYltnLklOVEVSTkFMX1NUQVRFXV0pLEIoYSkpOihrKGgoe3R5cGU6Zi5DUkFTSEVEfSkpLGEucGF1c2VkPSEwKX0pfWZ1bmN0aW9uIHYoYSxiKXt2YXIgZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PWQmJmIoZCk7aWYoMT09PWQpe2Q9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nZXRBdWRpb1F1ZXVlSW5kZXgoKTtjb25zdCBjPXI+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlOy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmM/KEUoYSxkKSxzZXRUaW1lb3V0KCgpPT4Ke0EoYSk7dihhLGIpfSxNYXRoLmZsb29yKE1hdGguZmxvb3IoMUUzKihhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMtLjI1KSkvMTApKSk6KEUoYSxkKSx2KGEsYikpfX1mdW5jdGlvbiBFKGEsYil7Y29uc3QgYz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuVVBEQVRFRCxhdWRpb0J1ZmZlcjpjLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX0pLFtjXSk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKX1jb25zdCBwPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY7bGV0IHU7cHx8KHU9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtjb25zdCBmPQp7Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixQQVVTRToiUEFVU0UiLFVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLApHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQifSxnPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IHQ9MCx3PXZvaWQgMDtjb25zdCB4PXtlbnY6e2xvZzooYSxiLGMsZixlLGcsaCk9Pnt2YXIgZD0obmV3IFVpbnQzMkFycmF5KHdhc21JbnN0YW5jZS5leHBvcnRzLm1lbW9yeS5idWZmZXIsYSwxKSlbMF07YT1TdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsbmV3IFVpbnQxNkFycmF5KHdhc21JbnN0YW5jZS5leHBvcnRzLm1lbW9yeS5idWZmZXIsYSs0LGQpKTstOTk5OSE9PWImJihhPWEucmVwbGFjZSgiJDAiLGIpKTstOTk5OSE9PWMmJihhPWEucmVwbGFjZSgiJDEiLApjKSk7LTk5OTkhPT1mJiYoYT1hLnJlcGxhY2UoIiQyIixmKSk7LTk5OTkhPT1lJiYoYT1hLnJlcGxhY2UoIiQzIixlKSk7LTk5OTkhPT1nJiYoYT1hLnJlcGxhY2UoIiQ0IixnKSk7LTk5OTkhPT1oJiYoYT1hLnJlcGxhY2UoIiQ1IixoKSk7Y29uc29sZS5sb2coIltXYXNtQm95XSAiK2EpfSxoZXhMb2c6KGEsYixjLGYsZSxnKT0+e2lmKCF3KXtsZXQgZD0iW1dhc21Cb3ldIjstOTk5OSE9PWEmJihkKz1gIDB4JHthLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1iJiYoZCs9YCAweCR7Yi50b1N0cmluZygxNil9IGApOy05OTk5IT09YyYmKGQrPWAgMHgke2MudG9TdHJpbmcoMTYpfSBgKTstOTk5OSE9PWYmJihkKz1gIDB4JHtmLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1lJiYoZCs9YCAweCR7ZS50b1N0cmluZygxNil9IGApOy05OTk5IT09ZyYmKGQrPWAgMHgke2cudG9TdHJpbmcoMTYpfSBgKTt3PSEwO3NldFRpbWVvdXQoKCk9Pntjb25zb2xlLmxvZyhkKTt3PSExfSxNYXRoLmZsb29yKDUwMCoKTWF0aC5yYW5kb20oKSkpfX19fSxGPWFzeW5jKGEpPT57bGV0IGI9dm9pZCAwO3JldHVybiBiPVdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nP2F3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nKGZldGNoKGEpLHgpOmF3YWl0IChhc3luYygpPT57Y29uc3QgYj1hd2FpdCBmZXRjaChhKS50aGVuKChhKT0+YS5hcnJheUJ1ZmZlcigpKTtyZXR1cm4gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYix4KX0pKCl9LEw9YXN5bmMoYSk9PnthPUJ1ZmZlci5mcm9tKGEuc3BsaXQoIiwiKVsxXSwiYmFzZTY0Iik7cmV0dXJuIGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGEseCl9LE09YXN5bmMoYSk9PnthPShhP2F3YWl0IEYoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZmhCZ0NYOS9mMzkvZjM5L2Z3QmdBQUJnQVg4QmYyQUNmMzhBWUFGL0FHQUNmMzhCZjJBQUFYOWdCSDkvZjM4QmYyQURmMzkvQUdBRGYzOS9BWDlnQm45L2YzOS9md0JnQjM5L2YzOS9mMzhCZjJBRWYzOS9md0JnRFg5L2YzOS9mMzkvZjM5L2YzOEJmMkFIZjM5L2YzOS9md0JnQ0g5L2YzOS9mMzkvQUFPWkFwY0NBZ0lDQWdFQkF3RUJBUUVCQVFFQkFRVUdCQUVCQUFZQ0JnWUZCZ0lDQXdZR0FRRUJBUVlFQVFFQkFRRUNBZ0lDQWdJQkJRSUdBUUlHQVFJR0JnSUdCZ1lDQlFjSUJBUUVBUVFFQkFRRUJBUUVCQVFFQkFRRUJBRUVBUVFCQkFFRUJBUUZCQVFGQmdZRkFnWUNBZ2dFQ0FNREJnUUVBUVFCQkFRRUJBUUVCUU1GQkFNRUJBUUNBd2dDQWdZQ0FnUUNBZ1lHQmdJQ0FnSUNBZ01FQkFJRUJBSUVCQUlFQkFJQ0FnSUNBZ0lDQWdJRkNRSUNCQUlDQWdJR0F3UUdCZ1lGQlF3RkJRd0xCUVVKQlFrSkRRc09DZ29JQ0FNRUFRRUJCZ1lCQVFFQkJBRUdCZ1lDQlFNQkFRRUJBUUVCQVFFQkFRRUNBUUVCQVFFQkFRRUJBUUVCQVFZQ0F3RUVCQThHQmdZR0JnWUdCZ1lHQkEwQkFRUUVCUU1CQUFBRzZRcitBWDhBUVFBTGZ3QkJnSUNzQkF0L0FFR0xBUXQvQUVFQUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFmLy9Bd3QvQUVHQUVBdC9BRUdBZ0FFTGZ3QkJnSkFCQzM4QVFZQ0FBZ3QvQUVHQWtBTUxmd0JCZ0lBQkMzOEFRWUNRQkF0L0FFR0E2QjhMZndCQmdKQUVDMzhBUVlBRUMzOEFRWUNnQkF0L0FFR0F1QUVMZndCQmdOZ0ZDMzhBUVlEWUJRdC9BRUdBbUE0TGZ3QkJnSUFNQzM4QVFZQ1lHZ3QvQUVHQWdBa0xmd0JCZ0pnakMzOEFRWURnQUF0L0FFR0ErQ01MZndCQmdJQUlDMzhBUVlENEt3dC9BRUdBZ0FnTGZ3QkJnUGd6QzM4QVFZQ0krQU1MZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSFAvZ01MZndGQkFBdC9BVUh3L2dNTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSC9BQXQvQVVIL0FBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZ0FJTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBOXdJTGZ3RkJnSUFJQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIVi9nTUxmd0ZCQUF0L0FVSFIvZ01MZndGQjB2NERDMzhCUWRQK0F3dC9BVUhVL2dNTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFlaitBd3QvQVVIci9nTUxmd0ZCNmY0REMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVHQWdLd0VDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUWYvL0F3dC9BRUdBa0FRTGZ3QkJnSkFFQzM4QVFZQUVDMzhBUVlEWUJRdC9BRUdBbUE0TGZ3QkJnSmdhQzM4QVFZRDRJd3QvQUVHQStDc0xmd0JCZ1BnekN3ZmpEVThHYldWdGIzSjVBZ0FHWTI5dVptbG5BQlVNWlhobFkzVjBaVVp5WVcxbEFPRUJHV1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOEE0d0VMWlhobFkzVjBaVk4wWlhBQTRBRUpjMkYyWlZOMFlYUmxBUEVCQ1d4dllXUlRkR0YwWlFEL0FRNW9ZWE5EYjNKbFUzUmhjblJsWkFDQUFnNXpaWFJLYjNsd1lXUlRkR0YwWlFDR0FoOW5aWFJPZFcxaVpYSlBabE5oYlhCc1pYTkpia0YxWkdsdlFuVm1abVZ5QU9JQkVHTnNaV0Z5UVhWa2FXOUNkV1ptWlhJQStRRVhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0REFCTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBd0VTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXdJZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd01hUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQkJaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd1VTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdZZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQnh4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3Z1NWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd2tPVmtsRVJVOWZVa0ZOWDFOSldrVURDaEZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01MRFZkUFVrdGZVa0ZOWDFOSldrVUREQ1pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNTklrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVRERoaEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0RER4UkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1RRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F4RVFSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTVNHRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTVRGRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXhRT1JsSkJUVVZmVEU5RFFWUkpUMDRERlFwR1VrRk5SVjlUU1ZwRkF4WVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REZ4TkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeGdTVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhrT1ZFbE1SVjlFUVZSQlgxTkpXa1VER2hKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REd3NVBRVTFmVkVsTVJWTmZVMGxhUlFNY0ZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01kRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXg0V1EwRlNWRkpKUkVkRlgxSkJUVjlNVDBOQlZFbFBUZ01mRWtOQlVsUlNTVVJIUlY5U1FVMWZVMGxhUlFNZ0ZrTkJVbFJTU1VSSFJWOVNUMDFmVEU5RFFWUkpUMDRESVJKRFFWSlVVa2xFUjBWZlVrOU5YMU5KV2tVRElpRm5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRQUFneG5aWFJTWldkcGMzUmxja0VBaHdJTVoyVjBVbVZuYVhOMFpYSkNBSWdDREdkbGRGSmxaMmx6ZEdWeVF3Q0pBZ3huWlhSU1pXZHBjM1JsY2tRQWlnSU1aMlYwVW1WbmFYTjBaWEpGQUlzQ0RHZGxkRkpsWjJsemRHVnlTQUNNQWd4blpYUlNaV2RwYzNSbGNrd0FqUUlNWjJWMFVtVm5hWE4wWlhKR0FJNENFV2RsZEZCeWIyZHlZVzFEYjNWdWRHVnlBSThDRDJkbGRGTjBZV05yVUc5cGJuUmxjZ0NRQWhsblpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5QUJrSVgzTmxkR0Z5WjJNQWxnSWRaSEpoZDBKaFkydG5jbTkxYm1STllYQlViMWRoYzIxTlpXMXZjbmtBbFFJWVpISmhkMVJwYkdWRVlYUmhWRzlYWVhOdFRXVnRiM0o1QUpNQ0JuVndaR0YwWlFEaEFRMWxiWFZzWVhScGIyNVRkR1Z3QU9BQkVtZGxkRUYxWkdsdlVYVmxkV1ZKYm1SbGVBRGlBUTl5WlhObGRFRjFaR2x2VVhWbGRXVUErUUVPZDJGemJVMWxiVzl5ZVZOcGVtVUQ4QUVjZDJGemJVSnZlVWx1ZEdWeWJtRnNVM1JoZEdWTWIyTmhkR2x2YmdQeEFSaDNZWE50UW05NVNXNTBaWEp1WVd4VGRHRjBaVk5wZW1VRDhnRWRaMkZ0WlVKdmVVbHVkR1Z5Ym1Gc1RXVnRiM0o1VEc5allYUnBiMjREOHdFWloyRnRaVUp2ZVVsdWRHVnlibUZzVFdWdGIzSjVVMmw2WlFQMEFSTjJhV1JsYjA5MWRIQjFkRXh2WTJGMGFXOXVBL1VCSW1aeVlXMWxTVzVRY205bmNtVnpjMVpwWkdWdlQzVjBjSFYwVEc5allYUnBiMjREK0FFYloyRnRaV0p2ZVVOdmJHOXlVR0ZzWlhSMFpVeHZZMkYwYVc5dUEvWUJGMmRoYldWaWIzbERiMnh2Y2xCaGJHVjBkR1ZUYVhwbEEvY0JGV0poWTJ0bmNtOTFibVJOWVhCTWIyTmhkR2x2YmdQNUFRdDBhV3hsUkdGMFlVMWhjQVA2QVJOemIzVnVaRTkxZEhCMWRFeHZZMkYwYVc5dUEvc0JFV2RoYldWQ2VYUmxjMHh2WTJGMGFXOXVBLzBCRkdkaGJXVlNZVzFDWVc1cmMweHZZMkYwYVc5dUEvd0JDQUtVQWdyVnhRR1hBaXNCQW44akxTRUJJeTVGSWdJRVFDQUJSU0VDQ3lBQ0JFQkJBU0VCQ3lBQlFRNTBJQUJCZ0lBQmEyb0xEd0FqTVVFTmRDQUFRWURBQW10cUM3Y0JBUUovQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVNZFNJQ0lRRWdBa1VOQUFKQUlBRkJBV3NPRFFFQkFRSUNBZ0lEQXdRRUJRWUFDd3dHQ3lBQVFZRDRNMm9QQ3lBQUVBQkJnUGd6YWc4TFFRQWhBU012QkVBak1CQURRUUZ4SVFFTElBQkJnSkIrYWlBQlFRMTBhZzhMSUFBUUFVR0ErQ3RxRHdzZ0FFR0FrSDVxRHd0QkFDRUJJeThFUUNNeUVBTkJCM0VoQVFzZ0FVRUJTQVJBUVFFaEFRc2dBQ0FCUVF4MGFrR0E4SDFxRHdzZ0FFR0FVR29MQ1FBZ0FCQUNMUUFBQzVFQkFFRUFKRE5CQUNRMFFRQWtOVUVBSkRaQkFDUTNRUUFrT0VFQUpEbEJBQ1E2UVFBa08wRUFKRHhCQUNROVFRQWtQa0VBSkQ5QkFDUkFJeThFUUVFUkpEUkJnQUVrTzBFQUpEVkJBQ1EyUWY4QkpEZEIxZ0FrT0VFQUpEbEJEU1E2QlVFQkpEUkJzQUVrTzBFQUpEVkJFeVEyUVFBa04wSFlBU1E0UVFFa09VSE5BQ1E2QzBHQUFpUTlRZjcvQXlROEM2UUJBUUovUVFBa1FVRUJKRUpCeHdJUUF5RUJRUUFrUTBFQUpFUkJBQ1JGUVFBa1JrRUFKQzRnQVFSQUlBRkJBVTRpQUFSQUlBRkJBMHdoQUFzZ0FBUkFRUUVrUkFVZ0FVRUZUaUlBQkVBZ0FVRUdUQ0VBQ3lBQUJFQkJBU1JGQlNBQlFROU9JZ0FFUUNBQlFSTk1JUUFMSUFBRVFFRUJKRVlGSUFGQkdVNGlBQVJBSUFGQkhrd2hBQXNnQUFSQVFRRWtMZ3NMQ3dzRlFRRWtRd3RCQVNRdFFRQWtNUXNMQUNBQUVBSWdBVG9BQUFzdkFFSFIvZ05CL3dFUUJrSFMvZ05CL3dFUUJrSFQvZ05CL3dFUUJrSFUvZ05CL3dFUUJrSFYvZ05CL3dFUUJndVlBUUJCQUNSSFFRQWtTRUVBSkVsQkFDUktRUUFrUzBFQUpFeEJBQ1JOSXk4RVFFR1JBU1JKUWNEK0EwR1JBUkFHUWNIK0EwR0JBUkFHUWNUK0EwR1FBUkFHUWNmK0EwSDhBUkFHQlVHUkFTUkpRY0QrQTBHUkFSQUdRY0grQTBHRkFSQUdRY2IrQTBIL0FSQUdRY2YrQTBIOEFSQUdRY2orQTBIL0FSQUdRY24rQTBIL0FSQUdDMEhQL2dOQkFCQUdRZkQrQTBFQkVBWUxUd0FqTHdSQVFlaitBMEhBQVJBR1FlbitBMEgvQVJBR1FlcitBMEhCQVJBR1FlditBMEVORUFZRlFlaitBMEgvQVJBR1FlbitBMEgvQVJBR1FlcitBMEgvQVJBR1FlditBMEgvQVJBR0N3c3ZBRUdRL2dOQmdBRVFCa0dSL2dOQnZ3RVFCa0dTL2dOQjh3RVFCa0dUL2dOQndRRVFCa0dVL2dOQnZ3RVFCZ3NzQUVHVi9nTkIvd0VRQmtHVy9nTkJQeEFHUVpmK0EwRUFFQVpCbVA0RFFRQVFCa0daL2dOQnVBRVFCZ3N5QUVHYS9nTkIvd0FRQmtHYi9nTkIvd0VRQmtHYy9nTkJud0VRQmtHZC9nTkJBQkFHUVo3K0EwRzRBUkFHUVFFa1hnc3RBRUdmL2dOQi93RVFCa0dnL2dOQi93RVFCa0doL2dOQkFCQUdRYUwrQTBFQUVBWkJvLzREUWI4QkVBWUxPQUJCRHlSZlFROGtZRUVQSkdGQkR5UmlRUUFrWTBFQUpHUkJBQ1JsUVFBa1prSC9BQ1JuUWY4QUpHaEJBU1JwUVFFa2FrRUFKR3NMWndCQkFDUk9RUUFrVDBFQUpGQkJBU1JSUVFFa1VrRUJKRk5CQVNSVVFRRWtWVUVCSkZaQkFTUlhRUUVrV0VFQkpGbEJBQ1JhUVFBa1cwRUFKRnhCQUNSZEVBb1FDeEFNRUExQnBQNERRZmNBRUFaQnBmNERRZk1CRUFaQnB2NERRZkVCRUFZUURnc05BQ0FCUVFFZ0FIUnhRUUJIQzJrQkFuOUJnQUloQUNNekJFQkJnQVFoQUFzQ1FBSkFBa0FqY1NJQkJFQWdBVUVCUmcwQklBRkJBa1lOQWd3REMwR0FDQ0VBSXpNRVFFR0FFQ0VBQ3lBQUR3dEJFQ0VBSXpNRVFFRWdJUUFMSUFBUEMwSEFBQ0VBSXpNRVFFSCtBQ0VBQ3lBQUR3c2dBQXNnQUVFQ0lBQVFFQ1J3STNCRkJFQVBDeUFBUVFOeEpIRkJBQ1J5RUJFa2RBdFFBRUVBSkd4QkFDUnRRUUFrYmtFQUpHOUJBQ1J3UVFBa2NVRUFKSEpCQUNSekl5OEVRRUdFL2dOQkx4QUdRUzhrYlFWQmhQNERRYXNCRUFaQnF3RWtiUXRCaC80RFFmZ0JFQVpCK0FFUUVndkpBUUVDZjBIREFoQURJZ0ZCd0FGR0lnQkZCRUFqSlFSL0lBRkJnQUZHQlNNbEN5RUFDeUFBQkVCQkFTUXZCVUVBSkM4TEVBUVFCUkFIRUFnUUNSQVBFQk1qTHdSQVFmRCtBMEg0QVJBR1FjLytBMEgrQVJBR1FjMytBMEgrQUJBR1FZRCtBMEhQQVJBR1FZTCtBMEg4QUJBR1FZLytBMEhoQVJBR1FleitBMEgrQVJBR1FmWCtBMEdQQVJBR0JVSHcvZ05CL3dFUUJrSFAvZ05CL3dFUUJrSE4vZ05CL3dFUUJrR0EvZ05CendFUUJrR0MvZ05CL2dBUUJrR1AvZ05CNFFFUUJndEJBQ1FqQzUwQkFDQUFRUUJLQkVCQkFTUWtCVUVBSkNRTElBRkJBRW9FUUVFQkpDVUZRUUFrSlFzZ0FrRUFTZ1JBUVFFa0pnVkJBQ1FtQ3lBRFFRQktCRUJCQVNRbkJVRUFKQ2NMSUFSQkFFb0VRRUVCSkNnRlFRQWtLQXNnQlVFQVNnUkFRUUVrS1FWQkFDUXBDeUFHUVFCS0JFQkJBU1FxQlVFQUpDb0xJQWRCQUVvRVFFRUJKQ3NGUVFBa0t3c2dDRUVBU2dSQVFRRWtMQVZCQUNRc0N4QVVDeEFBSXpNRVFFR2d5UWdQQzBIUXBBUUxDUUFnQUVILy93TnhDd3NBSXoxQkFXb1FGeEFEQ3dZQUl6MFFBd3NTQUNBQVFmOEJjVUVJZENBQlFmOEJjWElMRUFBUUdFSC9BWEVRR1VIL0FYRVFHZ3NNQUNBQVFZRCtBM0ZCQ0hVTENBQWdBRUgvQVhFTDdBSUJBbjhqUXdSQUR3c2dBRUgvUDB3RVFDTkZCSDlCQkNBQlFmOEJjUkFRUlFValJRc2lBRVVFUUNBQlFROXhJZ0lFUUNBQ1FRcEdCRUJCQVNSQkN3VkJBQ1JCQ3dzRklBQkIvLzhBVEFSQUl5NUZJZ0pGQkVBZ0FFSC8zd0JNSVFJTElBSUVRQ05GQkVBZ0FVRVBjU1F0Q3lBQklRSWpSQVJBSUFKQkgzRWhBaU10UWVBQmNTUXRCU05HQkVBZ0FrSC9BSEVoQWlNdFFZQUJjU1F0QlNNdUJFQkJBQ1F0Q3dzTEl5MGdBbklrTFFWQkFDRUNJeTBRSFNFRElBRkJBRW9FUUVFQklRSUxJQUlnQXhBYUpDMExCU05GUlNJREJFQWdBRUgvdndGTUlRTUxJQU1FUUNORUJIOGpRZ1VqUkFzaUFBUkFJeTFCSDNFa0xTTXRJQUZCNEFGeGNpUXREd3NqUmdSQUlBRkJDRTRpQXdSQUlBRkJERXdoQXdzTElBRWhBeU11Qkg4Z0EwRVBjUVVnQTBFRGNRc2lBeVF4QlNORlJTSURCRUFnQUVILy93Rk1JUU1MSUFNRVFDTkVCRUJCQUNBQlFmOEJjUkFRQkVCQkFTUkNCVUVBSkVJTEN3c0xDd3NMRGdBak13UkFRYTRCRHd0QjF3QUxFQUFqTXdSQVFZQ0FBUThMUVlEQUFBc29BUUYvSTNaQkFFb2lBQVJBSTNjaEFBc2dBQVJBSTNaQkFXc2tkZ3NqZGtVRVFFRUFKSGdMQ3lnQkFYOGplVUVBU2lJQUJFQWplaUVBQ3lBQUJFQWplVUVCYXlSNUN5TjVSUVJBUVFBa2V3c0xLQUVCZnlOOFFRQktJZ0FFUUNOOUlRQUxJQUFFUUNOOFFRRnJKSHdMSTN4RkJFQkJBQ1IrQ3dzcUFRRi9JMzlCQUVvaUFBUkFJNEFCSVFBTElBQUVRQ04vUVFGckpIOExJMzlGQkVCQkFDU0JBUXNMSWdFQmZ5T0ZBU09HQVhVaEFDT0hBUVIvSTRVQklBQnJCU09GQVNBQWFnc2lBQXRGQVFKL1FaVCtBeEFEUWZnQmNTRUJRWlArQXlBQVFmOEJjU0lDRUFaQmxQNERJQUVnQUVFSWRTSUFjaEFHSUFJa2lBRWdBQ1NKQVNPSkFVRUlkQ09JQVhJa2lnRUxPQUVDZnhBbElnQkIvdzlNSWdFRVFDT0dBVUVBU2lFQkN5QUJCRUFnQUNTRkFTQUFFQ1lRSlNFQUN5QUFRZjhQU2dSQVFRQWtlQXNMTHdBamdnRkJBV3NrZ2dFamdnRkJBRXdFUUNPREFTU0NBU09FQVFSL0k0TUJRUUJLQlNPRUFRc0VRQkFuQ3dzTFlBRUJmeU9MQVVFQmF5U0xBU09MQVVFQVRBUkFJNHdCSklzQkk0c0JCRUFqalFFRWZ5T09BVUVQU0FVampRRUxJZ0FFUUNPT0FVRUJhaVNPQVFVampRRkZJZ0FFUUNPT0FVRUFTaUVBQ3lBQUJFQWpqZ0ZCQVdza2pnRUxDd3NMQzJBQkFYOGpqd0ZCQVdza2p3RWpqd0ZCQUV3RVFDT1FBU1NQQVNPUEFRUkFJNUVCQkg4amtnRkJEMGdGSTVFQkN5SUFCRUFqa2dGQkFXb2trZ0VGSTVFQlJTSUFCRUFqa2dGQkFFb2hBQXNnQUFSQUk1SUJRUUZySkpJQkN3c0xDd3RnQVFGL0k1TUJRUUZySkpNQkk1TUJRUUJNQkVBamxBRWtrd0Vqa3dFRVFDT1ZBUVIvSTVZQlFROUlCU09WQVFzaUFBUkFJNVlCUVFGcUpKWUJCU09WQVVVaUFBUkFJNVlCUVFCS0lRQUxJQUFFUUNPV0FVRUJheVNXQVFzTEN3c0xqUUVCQVg4aldpQUFhaVJhSTFvUUlFNEVRQ05hRUNCckpGb0NRQUpBQWtBQ1FBSkFJMXdpQVFSQUFrQWdBVUVDYXc0R0FnQURBQVFGQUFzTUJRc1FJUkFpRUNNUUpBd0VDeEFoRUNJUUl4QWtFQ2dNQXdzUUlSQWlFQ01RSkF3Q0N4QWhFQ0lRSXhBa0VDZ01BUXNRS1JBcUVDc0xJMXhCQVdva1hDTmNRUWhPQkVCQkFDUmNDMEVCRHd0QkFBc2RBQ09YQVNBQWFpU1hBU09ZQVNPWEFXdEJBRW9FUUVFQUR3dEJBUXVEQVFFQmZ3SkFBa0FDUUFKQUlBQkJBVWNFUUNBQUlnRkJBa1lOQVNBQlFRTkdEUUlnQVVFRVJnMEREQVFMSTJNam1RRkhCRUFqbVFFa1kwRUJEd3RCQUE4TEkyUWptZ0ZIQkVBam1nRWtaRUVCRHd0QkFBOExJMlVqbXdGSEJFQWptd0VrWlVFQkR3dEJBQThMSTJZam5BRkhCRUFqbkFFa1prRUJEd3RCQUE4TFFRQUxIUUFqblFFZ0FHb2tuUUVqbmdFam5RRnJRUUJLQkVCQkFBOExRUUVMS1FBam53RWdBR29rbndFam9BRWpud0ZyUVFCS0lnQUVRQ05lUlNFQUN5QUFCRUJCQUE4TFFRRUxIUUFqb1FFZ0FHb2tvUUVqb2dFam9RRnJRUUJLQkVCQkFBOExRUUVMSFFCQmdCQWppZ0ZyUVFKMEpKZ0JJek1FUUNPWUFVRUJkQ1NZQVFzTFJRRUJmd0pBQWtBQ1FDQUFRUUZIQkVBZ0FDSUNRUUpHRFFFZ0FrRURSZzBDREFNTElBRkJnUUVRRUE4TElBRkJod0VRRUE4TElBRkIvZ0FRRUE4TElBRkJBUkFRQzMwQkFYOGptQUVnQUdza21BRWptQUZCQUV3RVFDT1lBU0VBRURJam1BRWdBRUVBSUFCcklBQkJBRW9iYXlTWUFTT2pBVUVCYWlTakFTT2pBVUVJVGdSQVFRQWtvd0VMQ3lONEJIOGptUUVGSTNnTElnQUVmeU9PQVFWQkR3OExJUUJCQVNFQkk2UUJJNk1CRURORkJFQkJmeUVCQ3lBQklBQnNRUTlxQ3hJQkFYOGpsd0VoQUVFQUpKY0JJQUFRTkFzZEFFR0FFQ09sQVd0QkFuUWtuZ0VqTXdSQUk1NEJRUUYwSko0QkN3dDlBUUYvSTU0QklBQnJKSjRCSTU0QlFRQk1CRUFqbmdFaEFCQTJJNTRCSUFCQkFDQUFheUFBUVFCS0cyc2tuZ0VqcGdGQkFXb2twZ0VqcGdGQkNFNEVRRUVBSktZQkN3c2pld1IvSTVvQkJTTjdDeUlBQkg4amtnRUZRUThQQ3lFQVFRRWhBU09uQVNPbUFSQXpSUVJBUVg4aEFRc2dBU0FBYkVFUGFnc1NBUUYvSTUwQklRQkJBQ1NkQVNBQUVEY0xIUUJCZ0JBanFBRnJRUUYwSktBQkl6TUVRQ09nQVVFQmRDU2dBUXNMaEFJQkFuOGpvQUVnQUdza29BRWpvQUZCQUV3RVFDT2dBU0VDRURram9BRWdBa0VBSUFKcklBSkJBRW9iYXlTZ0FTT3BBVUVCYWlTcEFTT3BBVUVnVGdSQVFRQWtxUUVMQzBFQUlRSWpxZ0VoQUNOK0JIOGptd0VGSTM0TElnRUVRQ05lQkVCQm5QNERFQU5CQlhWQkQzRWlBQ1NxQVVFQUpGNExCVUVQRHdzanFRRkJBbTFCc1A0RGFoQURJUUVqcVFGQkFtOEVmeUFCUVE5eEJTQUJRUVIxUVE5eEN5RUJBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BU0FBUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEFnd0NDeUFCUVFGMUlRRkJBaUVDREFFTElBRkJBblVoQVVFRUlRSUxJQUpCQUVvRWZ5QUJJQUp0QlVFQUN5SUJRUTlxQ3hJQkFYOGpud0VoQUVFQUpKOEJJQUFRT2dzYkFRRi9JNnNCSTZ3QmRDRUFJek1FUUNBQVFRRjBJUUFMSUFBTHJ3RUJBWDhqb2dFZ0FHc2tvZ0Vqb2dGQkFFd0VRQ09pQVNFQUVEd2tvZ0Vqb2dFZ0FFRUFJQUJySUFCQkFFb2JheVNpQVNPdEFVRUJjU0VCSTYwQlFRRjFRUUZ4SVFBanJRRkJBWFVrclFFanJRRWdBU0FBY3lJQlFRNTBjaVN0QVNPdUFRUkFJNjBCUWI5L2NTU3RBU090QVNBQlFRWjBjaVN0QVFzTEk0RUJCSDhqbkFFRkk0RUJDeUlBQkg4amxnRUZRUThQQ3lFQlFRQWpyUUVRRUFSL1FYOEZRUUVMSWdBZ0FXeEJEMm9MRWdFQmZ5T2hBU0VBUVFBa29RRWdBQkE5Q3hJQUl6TUVRRUdBZ0lBRUR3dEJnSUNBQWdzRUFCQS9Dd1FBSUFBTE1nQWdBRUU4UmdSQVFmOEFEd3NnQUVFOGEwR2dqUVpzSUFGc1FRaHRRYUNOQm0xQlBHcEJvSTBHYkVHTThRSnRFRUVMdUFFQkFYOUJBQ1JwSTFFRWZ5QUFCVUVQQ3lFRUkxSUVmeUFFSUFGcUJTQUVRUTlxQ3lFRUkxTUVmeUFFSUFKcUJTQUVRUTlxQ3lFRUkxUUVmeUFFSUFOcUJTQUVRUTlxQ3lFRUkxVUVmeUFBQlVFUEN5RUFJMVlFZnlBQUlBRnFCU0FBUVE5cUN5RUFJMWNFZnlBQUlBSnFCU0FBUVE5cUN5RUFJMWdFZnlBQUlBTnFCU0FBUVE5cUN5RUFRUUFrYWtFQUpHc2dCQ05QUVFGcUVFSWhBU0FBSTFCQkFXb1FRaUVBSUFFa1p5QUFKR2dnQVNBQUVCb0xKUUVCZnlBQ1FRRjBRWUQ0STJvaUF5QUFRUUZxT2dBQUlBTkJBV29nQVVFQmFqb0FBQXVRQWdFRWZ5QUFFQzBpQVVVRVFFRUJFQzRoQVFzZ0FCQXZJZ0pGQkVCQkFoQXVJUUlMSUFBUU1DSURSUVJBUVFNUUxpRURDeUFBRURFaUJFVUVRRUVFRUM0aEJBc2dBVUVCY1FSQUVEVWtYd3NnQWtFQmNRUkFFRGdrWUFzZ0EwRUJjUVJBRURza1lRc2dCRUVCY1FSQUVENGtZZ3NnQVVFQmNVVUVRQ0FDSVFFTElBRkJBWEZGQkVBZ0F5RUJDeUFCUVFGeFJRUkFJQVFoQVFzZ0FVRUJjUVJBUVFFa2F3c2pXeUFBSTY4QmJHb2tXeU5iRUVCT0JFQWpXeEJBYXlSYkkyc0VmeU5yQlNOcEN5SUJSUVJBSTJvaEFRc2dBUVJBSTE4allDTmhJMklRUXhvTEkyZEJBV29qYUVFQmFpTmRFRVFqWFVFQmFpUmRJMTBqc0FGQkFtMUJBV3RPQkVBalhVRUJheVJkQ3dzTGZ3RUVmeUFBRURRaEFTQUFFRGNoQWlBQUVEb2hBeUFBRUQwaEJDQUJKRjhnQWlSZ0lBTWtZU0FFSkdJald5QUFJNjhCYkdva1d5TmJFRUJPQkVBald4QkFheVJiSUFFZ0FpQURJQVFRUXlJQUVCeEJBV29nQUJBZFFRRnFJMTBRUkNOZFFRRnFKRjBqWFNPd0FVRUNiVUVCYTA0RVFDTmRRUUZySkYwTEN3c2pBUUYvSUFBUUxDRUJJeW9FZnlBQlJRVWpLZ3NpQVFSQUlBQVFSUVVnQUJCR0N3c2pBQ05PRUI5SUJFQVBDd05BSTA0UUgwNEVRQkFmRUVjalRoQWZheVJPREFFTEN3c2ZBQ0FBUWZBQWNVRUVkU1NEQVVFRElBQVFFQ1NIQVNBQVFRZHhKSVlCQ3dzQVFRY2dBQkFRSkpzQkN4NEFJQUJCQm5WQkEzRWtwQUVnQUVFL2NTU3hBVUhBQUNPeEFXc2tkZ3NlQUNBQVFRWjFRUU54SktjQklBQkJQM0Vrc2dGQndBQWpzZ0ZySkhrTEVBQWdBQ1N6QVVHQUFpT3pBV3NrZkFzVEFDQUFRVDl4SkxRQlFjQUFJN1FCYXlSL0N5b0FJQUJCQkhWQkQzRWt0UUZCQXlBQUVCQWtqUUVnQUVFSGNTU01BU0FBUWZnQmNVRUFTaVNaQVFzcUFDQUFRUVIxUVE5eEpMWUJRUU1nQUJBUUpKRUJJQUJCQjNFa2tBRWdBRUg0QVhGQkFFb2ttZ0VMRFFBZ0FFRUZkVUVQY1NTM0FRc3FBQ0FBUVFSMVFROXhKTGdCUVFNZ0FCQVFKSlVCSUFCQkIzRWtsQUVnQUVINEFYRkJBRW9rbkFFTEZBQWdBQ1NJQVNPSkFVRUlkQ09JQVhJa2lnRUxGQUFnQUNTNUFTTzZBVUVJZENPNUFYSWtwUUVMRkFBZ0FDUzdBU084QVVFSWRDTzdBWElrcUFFTGhBRUJBWDhnQUVFRWRTU3NBVUVESUFBUUVDU3VBU0FBUVFkeEpMMEJBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDTzlBU0lCQkVBQ1FDQUJRUUZyRGdjQ0F3UUZCZ2NJQUFzTUNBdEJDQ1NyQVE4TFFSQWtxd0VQQzBFZ0pLc0JEd3RCTUNTckFROExRY0FBSktzQkR3dEIwQUFrcXdFUEMwSGdBQ1NyQVE4TFFmQUFKS3NCQ3dzZkFFRUdJQUFRRUNSM0lBQkJCM0VraVFFamlRRkJDSFFqaUFGeUpJb0JDMllCQVg5QkFTUjRJM1pGQkVCQndBQWtkZ3NRTWlPTUFTU0xBU08xQVNTT0FTT0tBU1NGQVNPREFTU0NBU09EQVVFQVNpSUFCRUFqaGdGQkFFb2hBQXNnQUFSQVFRRWtoQUVGUVFBa2hBRUxJNFlCUVFCS0JFQVFKd3NqbVFGRkJFQkJBQ1I0Q3dzZkFFRUdJQUFRRUNSNklBQkJCM0VrdWdFanVnRkJDSFFqdVFGeUpLVUJDeW9BUVFFa2V5TjVSUVJBUWNBQUpIa0xFRFlqa0FFa2p3RWp0Z0Vra2dFam1nRkZCRUJCQUNSN0N3c2ZBRUVHSUFBUUVDUjlJQUJCQjNFa3ZBRWp2QUZCQ0hRanV3RnlKS2dCQ3lNQVFRRWtmaU44UlFSQVFZQUNKSHdMRURsQkFDU3BBU09iQVVVRVFFRUFKSDRMQ3dzQVFRWWdBQkFRSklBQkN6WUFRUUVrZ1FFamYwVUVRRUhBQUNSL0N4QThKS0lCSTVRQkpKTUJJN2dCSkpZQlFmLy9BU1N0QVNPY0FVVUVRRUVBSklFQkN3c1RBQ0FBUVFSMVFRZHhKRThnQUVFSGNTUlFDMElBUVFjZ0FCQVFKRlJCQmlBQUVCQWtVMEVGSUFBUUVDUlNRUVFnQUJBUUpGRkJBeUFBRUJBa1dFRUNJQUFRRUNSWFFRRWdBQkFRSkZaQkFDQUFFQkFrVlFzS0FFRUhJQUFRRUNSWkMvc0NBUUYvQWtBZ0FFR20vZ05ISWdJRVFDTlpSU0VDQ3lBQ0JFQkJBQThMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQWtHUS9nTkhCRUFDUUNBQ1FaSCtBMnNPRmdNSEN3OEFCQWdNRUFJRkNRMFJBQVlLRGhJVEZCVUFDd3dWQ3lBQkVFa01GUXNnQVJCS0RCUUxJQUVRU3d3VEN5QUJFRXdNRWdzZ0FSQk5EQkVMSUFFUVRnd1FDeUFCRUU4TUR3c2dBUkJRREE0TFFRRWtYaUFCRUZFTURRc2dBUkJTREF3TElBRVFVd3dMQ3lBQkVGUU1DZ3NnQVJCVkRBa0xJQUVRVmd3SUMwRUhJQUVRRUFSQUlBRVFWeEJZQ3d3SEMwRUhJQUVRRUFSQUlBRVFXUkJhQ3d3R0MwRUhJQUVRRUFSQUlBRVFXeEJjQ3d3RkMwRUhJQUVRRUFSQUlBRVFYUkJlQ3d3RUN5QUJFRjlCQVNScERBTUxJQUVRWUVFQkpHb01BZ3NnQVJCaFFRY2dBUkFRUlFSQUFrQkJrUDRESVFJRFFDQUNRYWIrQTA0TkFTQUNRUUFRQmlBQ1FRRnFJUUlNQUFBTEFBc0xEQUVMUVFFUEMwRUJDMG9BUVFjZ0FCQVFKTDRCUVFZZ0FCQVFKTDhCUVFVZ0FCQVFKTUFCUVFRZ0FCQVFKTUVCUVFNZ0FCQVFKTUlCUVFJZ0FCQVFKTU1CUVFFZ0FCQVFKTVFCUVFBZ0FCQVFKTVVCQ3o0QkFYOGdBRUVJZENFQkFrQkJBQ0VBQTBBZ0FFR2ZBVW9OQVNBQVFZRDhBMm9nQVNBQWFoQURFQVlnQUVFQmFpRUFEQUFBQ3dBTFFZUUZKTWNCQ3dvQUlBRkJBU0FBZEhJTEV3QWp5Z0VRQXlQTEFSQURFQnBCOFA4RGNRc1hBQ1BNQVJBREk4MEJFQU1RR2tId1AzRkJnSUFDYWdzTkFDQUJRUUVnQUhSQmYzTnhDM0FCQVg4Z0FFR20vZ05HQkVCQnB2NERFQU5CZ0FGeElRRWplQVIvUVFBZ0FSQmxCVUVBSUFFUWFBc2FJM3NFZjBFQklBRVFaUVZCQVNBQkVHZ0xHaU4rQkg5QkFpQUJFR1VGUVFJZ0FSQm9DeG9qZ1FFRWYwRURJQUVRWlFWQkF5QUJFR2dMR2lBQlFmQUFjZzhMUVg4THhBRUJBWDhqMFFFaEFDUFNBUVJBSTlNQkJIOUJBaUFBRUdnRlFRSWdBQkJsQ3lFQUk5UUJCSDlCQUNBQUVHZ0ZRUUFnQUJCbEN5RUFJOVVCQkg5QkF5QUFFR2dGUVFNZ0FCQmxDeUVBSTlZQkJIOUJBU0FBRUdnRlFRRWdBQkJsQ3lFQUJTUFhBUVJBSTlnQkJIOUJBQ0FBRUdnRlFRQWdBQkJsQ3lFQUk5a0JCSDlCQVNBQUVHZ0ZRUUVnQUJCbEN5RUFJOW9CQkg5QkFpQUFFR2dGUVFJZ0FCQmxDeUVBSTlzQkJIOUJBeUFBRUdnRlFRTWdBQkJsQ3lFQUN3c2dBRUh3QVhJTGdnSUJBWDhnQUVHQWdBSklCRUJCZnc4TElBQkJnSUFDVGlJQkJFQWdBRUdBd0FKSUlRRUxJQUVFUUVGL0R3c2dBRUdBd0FOT0lnRUVRQ0FBUVlEOEEwZ2hBUXNnQVFSQUlBQkJnRUJxRUFNUEN5QUFRWUQ4QTA0aUFRUkFJQUJCbi8wRFRDRUJDeUFCQkVBamRVRUNTQVJBUWY4QkR3dEJmdzhMSUFCQnhQNERSZ1JBSUFBalNSQUdJMGtQQ3lBQVFaRCtBMDRpQVFSQUlBQkJwdjREVENFQkN5QUJCRUFRU0NBQUVHa1BDeUFBUWJEK0EwNGlBUVJBSUFCQnYvNERUQ0VCQ3lBQkJFQVFTRUYvRHdzZ0FFR0UvZ05HQkVBZ0FDTnRFQVlqYlE4TElBQkJoZjREUmdSQUlBQWpiaEFHSTI0UEN5QUFRWUQrQTBZRVFCQnFEd3RCZndzYkFRRi9JQUFRYXlJQlFYOUdCRUFnQUJBRER3c2dBVUgvQVhFTFpnRURmd0pBQTBBZ0F5QUNUZzBCSUFBZ0Eyb1FiQ0VGSUFFZ0Eyb2hCQU5BSUFSQi83OENTZ1JBSUFSQmdFQnFJUVFNQVFzTElBUWdCUkIvSUFOQkFXb2hBd3dBQUFzQUMwRWdJUU1qTXdSQVFjQUFJUU1MSThjQklBTWdBa0VRYld4cUpNY0JDNGdCQVFOL0l5OUZCRUFQQ3lQSkFRUi9RUWNnQUJBUVJRVWp5UUVMSWdFRVFFRUFKTWtCSThnQkVBTWhBU1BJQVVFSElBRVFaUkFHRHdzUVppRUJFR2NoQWtFSElBQVFhRUVCYWtFRWRDRURRUWNnQUJBUUJFQkJBU1RKQVNBREpNNEJJQUVrendFZ0FpVFFBU1BJQVVFSElBQVFhQkFHQlNBQklBSWdBeEJ0SThnQlFmOEJFQVlMQ3lZQkFYOGdBRUUvY1NFRElBSkJBWEVFUUNBRFFVQnJJUU1MSUFOQmdKQUVhaUFCT2dBQUN4Z0FRUWNnQUJBUUJFQWdBVUVISUFCQkFXb1FaUkFHQ3d0SUFRSi9JQUFqM2dGR0lnSkZCRUFnQUNQZEFVWWhBZ3NnQWdSQVFRWWdBRUVCYXhBREVHZ2hBaUFBSTkwQlJnUkFRUUVoQXdzZ0FpQUJJQU1RYnlBQ0lBQkJBV3NRY0FzTEJRQkJnQUlMTEFBamN5QUFhaVJ6STNNUWNrNEVRQ056RUhKckpITWpiVUVCYWlSdEkyMUIvd0ZLQkVCQkFDUnRDd3NMR3dFQmZ5QUFRWS8rQXhBREVHVWlBU1RnQVVHUC9nTWdBUkFHQ3dzQVFRRWszd0ZCQWhCMEN6OEFJQUFRY3lOd1JRUkFEd3NqY2lBQWFpUnlBMEFqY2lOMFRnUkFJM0lqZEdza2NpTnVRZjhCVGdSQUkyOGtiaEIxQlNOdVFRRnFKRzRMREFFTEN3czlBUUYvRUhJaEFDTndCSDhqZENBQVNBVWpjQXNFUUNOMElRQUxJMndnQUVnRVFBOExBMEFqYkNBQVRnUkFJQUFRZGlOc0lBQnJKR3dNQVFzTEN4WUFRUUFrYlVHRS9nTkJBQkFHUVFBa2NpTnZKRzRMQmdBZ0FDUnVDd1lBSUFBa2J3c2ZBQ0FBUWY4QmN5VFJBVUVFSTlFQkVCQWswZ0ZCQlNQUkFSQVFKTmNCQ3lzQVFRQWdBQkFRSk9FQlFRRWdBQkFRSk9JQlFRSWdBQkFRSk44QlFRUWdBQkFRSk9NQklBQWs0QUVMS3dCQkFDQUFFQkFrNUFGQkFTQUFFQkFrNVFGQkFpQUFFQkFrNWdGQkJDQUFFQkFrNXdFZ0FDVG9BUXVjQlFFQmZ3SkFBa0FnQUVHQWdBSklCRUFnQUNBQkVCNE1BZ3NnQUVHQWdBSk9JZ0lFUUNBQVFZREFBa2doQWdzZ0FnMEFJQUJCZ01BRFRpSUNCRUFnQUVHQS9BTklJUUlMSUFJRVFDQUFRWUJBYWlBQkVBWU1BUXNnQUVHQS9BTk9JZ0lFUUNBQVFaLzlBMHdoQWdzZ0FnUkFJM1ZCQWtnTkFnd0JDeUFBUWFEOUEwNGlBZ1JBSUFCQi8vMERUQ0VDQ3lBQ0RRRWdBRUdRL2dOT0lnSUVRQ0FBUWFiK0Ewd2hBZ3NnQWdSQUVFZ2dBQ0FCRUdJUEN5QUFRYkQrQTA0aUFnUkFJQUJCdi80RFRDRUNDeUFDQkVBUVNBc2dBRUhBL2dOT0lnSUVRQ0FBUWN2K0Ewd2hBZ3NnQWdSQUlBQkJ3UDREUmdSQUlBRVFZd3dDQ3lBQVFjVCtBMFlFUUVFQUpFa2dBRUVBRUFZTUF3c2dBRUhGL2dOR0JFQWdBU1RHQVF3Q0N5QUFRY2IrQTBZRVFDQUJFR1FNQWdzQ1FBSkFBa0FDUUNBQUlnSkJ3LzREUndSQUFrQWdBa0hDL2dOckRnb0NBQUFBQUFBQUFBUURBQXNNQkFzZ0FTUktEQVVMSUFFa1N3d0VDeUFCSkV3TUF3c2dBU1JOREFJTERBRUxJQUFqeUFGR0JFQWdBUkJ1REFJTElBQWpNa1lpQWtVRVFDQUFJekJHSVFJTElBSUVRQ1BKQVFSQUk4OEJRWUNBQVU0aUFnUkFJODhCUWYvL0FVd2hBZ3NnQWtVRVFDUFBBVUdBb0FOT0lnSUVRQ1BQQVVIL3Z3Tk1JUUlMQ3lBQ0RRTUxDeUFBSTl3QlRpSUNCRUFnQUNQZEFVd2hBZ3NnQWdSQUlBQWdBUkJ4REFFTElBQkJoUDREVGlJQ0JFQWdBRUdIL2dOTUlRSUxJQUlFUUJCM0FrQUNRQUpBQWtBZ0FDSUNRWVQrQTBjRVFBSkFJQUpCaGY0RGF3NERBZ01FQUFzTUJBc2dBUkI0REFZTElBRVFlUXdFQ3lBQkVIb01Bd3NnQVJBU0RBSUxEQUVMSUFCQmdQNERSZ1JBSUFFUWV3c2dBRUdQL2dOR0JFQWdBUkI4REFFTElBQkIvLzhEUmdSQUlBRVFmUXdCQzBFQkR3dEJBUThMUVFBTEVRQWdBQ0FCRUg0RVFDQUFJQUVRQmdzTExnRUJmMEVCSUFCMEVCMGhBaUFCUVFCS0JFQWpPeUFDY2tIL0FYRWtPd1VqT3lBQ1FmOEJjM0VrT3dzak93c0tBRUVGSUFBUWdBRWFDMDBBSUFGQkFFNEVRQ0FBUVE5eElBRkJEM0ZxRUIxQkVIRUVRRUVCRUlFQkJVRUFFSUVCQ3dVZ0FVRUFJQUZySUFGQkFFb2JRUTl4SUFCQkQzRkxCRUJCQVJDQkFRVkJBQkNCQVFzTEN3b0FRUWNnQUJDQUFSb0xDZ0JCQmlBQUVJQUJHZ3NLQUVFRUlBQVFnQUVhQ3hNQUlBQkJBWFFnQUVIL0FYRkJCM1p5RUIwTE13RUNmeUFCRUJ3aEFpQUFRUUZxSVFNZ0FDQUJFQjBpQVJCK0JFQWdBQ0FCRUFZTElBTWdBaEIrQkVBZ0F5QUNFQVlMQzRNQkFDQUNRUUZ4QkVBZ0FFSC8vd054SWdBZ0FXb2hBaUFBSUFGeklBSnpJZ0pCRUhFRVFFRUJFSUVCQlVFQUVJRUJDeUFDUVlBQ2NRUkFRUUVRaFFFRlFRQVFoUUVMQlNBQUlBRnFFQmNpQWlBQVFmLy9BM0ZKQkVCQkFSQ0ZBUVZCQUJDRkFRc2dBQ0FCY3lBQ2MwR0FJSEVRRndSQVFRRVFnUUVGUVFBUWdRRUxDd3NUQUNBQVFmOEJjVUVCZGlBQVFRZDBjaEFkQzg0RUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQUNRQ0FBUVFGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDd3dUQ3hBYlFmLy9BM0VRSEVIL0FYRWtOUkFiUWYvL0EzRVFIVUgvQVhFa05pTTlRUUpxRUJja1BVRU1Ed3NqTlNNMkVCb2pOQkIvUVFnUEN5TTFJellRR2tFQmFrSC8vd054SWdBUUhFSC9BWEVrTlF3TkN5TTFRUUVRZ2dFak5VRUJhaEFkSkRVak5RUkFRUUFRZ3dFRlFRRVFnd0VMUVFBUWhBRU1Ed3NqTlVGL0VJSUJJelZCQVdzUUhTUTFJelVFUUVFQUVJTUJCVUVCRUlNQkMwRUJFSVFCREE0TEVCbEIvd0Z4SkRVTUN3c2pORUdBQVhGQmdBRkdCRUJCQVJDRkFRVkJBQkNGQVFzak5CQ0dBU1EwREFzTEVCdEIvLzhEY1NNOEVJY0JJejFCQW1vUUZ5UTlRUlFQQ3lNNUl6b1FHaUlBSXpVak5oQWFJZ0ZCLy84RGNVRUFFSWdCSUFBZ0FXb1FGeUlBRUJ4Qi93RnhKRGtnQUJBZFFmOEJjU1E2UVFBUWhBRkJDQThMSXpVak5oQWFFR3hCL3dGeEpEUkJDQThMSXpVak5oQWFRUUZyRUJjaUFCQWNRZjhCY1NRMURBVUxJelpCQVJDQ0FTTTJRUUZxRUIwa05pTTJCRUJCQUJDREFRVkJBUkNEQVF0QkFCQ0VBUXdIQ3lNMlFYOFFnZ0VqTmtFQmF4QWRKRFlqTmdSQVFRQVFnd0VGUVFFUWd3RUxRUUVRaEFFTUJnc1FHVUgvQVhFa05nd0RDeU0wUVFGeFFRQkxCRUJCQVJDRkFRVkJBQkNGQVFzak5CQ0pBU1EwREFNTFFYOFBDeUFBRUIxQi93RnhKRFpCQ0E4TEl6MUJBV29RRnlROVFRZ1BDMEVBRUlNQlFRQVFoQUZCQUJDQkFRdEJCQXNLQUNNN1FRUjJRUUZ4Q3cwQUlBQkJBWFFRaXdGeUVCMExLQUVCZjBFSElBQkJHSFJCR0hVaUFSQVFCRUJCZ0FJZ0FFRVlkRUVZZFd0QmYyd2hBUXNnQVFzakFRRi9JQUFRalFFaEFTTTlJQUZCR0hSQkdIVnFFQmNrUFNNOVFRRnFFQmNrUFFzVUFDQUFRZjhCY1VFQmRoQ0xBVUVIZEhJUUhRdWFCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVRUndSQUFrQWdBRUVSYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pMd1JBUVFCQnpmNERFR3dpQUJBUUJFQkJ6ZjREUVFkQkFDQUFFR2dpQUJBUUJIOUJBQ1F6UVFjZ0FCQm9CVUVCSkROQkJ5QUFFR1VMSWdBUWYwSE1BQThMQ3lNOVFRRnFFQmNrUFF3VEN4QWJRZi8vQTNFUUhFSC9BWEVrTnhBYlFmLy9BM0VRSFVIL0FYRWtPQ005UVFKcUVCY2tQVUVNRHdzak55TTRFQm9qTkJCL1FRZ1BDeU0zSXpnUUdrRUJhaEFYSWdBUUhFSC9BWEVrTnd3TkN5TTNRUUVRZ2dFak4wRUJhaEFkSkRjak53UkFRUUFRZ3dFRlFRRVFnd0VMUVFBUWhBRU1Ed3NqTjBGL0VJSUJJemRCQVdzUUhTUTNJemNFUUVFQUVJTUJCVUVCRUlNQkMwRUJFSVFCREE0TEVCbEIvd0Z4SkRjTUN3dEJBQ0VBSXpSQmdBRnhRWUFCUmdSQVFRRWhBQXNqTkJDTUFTUTBEQXNMRUJrUWpnRkJEQThMSXprak9oQWFJZ0FqTnlNNEVCb2lBVUgvL3dOeFFRQVFpQUVnQUNBQmFoQVhJZ0FRSEVIL0FYRWtPU0FBRUIxQi93RnhKRHBCQUJDRUFVRUlEd3NqTnlNNEVCcEIvLzhEY1JCc1FmOEJjU1EwUVFnUEN5TTNJemdRR2tFQmF4QVhJZ0FRSEVIL0FYRWtOd3dGQ3lNNFFRRVFnZ0VqT0VFQmFoQWRKRGdqT0FSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFFTUJ3c2pPRUYvRUlJQkl6aEJBV3NRSFNRNEl6Z0VRRUVBRUlNQkJVRUJFSU1CQzBFQkVJUUJEQVlMRUJsQi93RnhKRGdNQXd0QkFDRUFJelJCQVhGQkFVWUVRRUVCSVFBTEl6UVFqd0VrTkF3REMwRi9Ed3NnQUJBZFFmOEJjU1E0UVFnUEN5TTlRUUZxRUJja1BVRUlEd3NnQUFSQVFRRVFoUUVGUVFBUWhRRUxRUUFRZ3dGQkFCQ0VBVUVBRUlFQkMwRUVDd29BSXp0QkIzWkJBWEVMQ2dBak8wRUZka0VCY1FzS0FDTTdRUVoyUVFGeEM5MEZBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRU0JIQkVBQ1FDQUFRU0ZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN4Q1JBUVJBREJNRkVCa1FqZ0ZCREE4TEFBc1FHMEgvL3dOeElnQVFIRUgvQVhFa09TQUFFQjFCL3dGeEpEb2pQVUVDYWhBWEpEMUJEQThMSXprak9oQWFJZ0JCLy84RGNTTTBFSDhnQUVFQmFoQVhJZ0FRSEVIL0FYRWtPUXdQQ3lNNUl6b1FHa0VCYWhBWElnQVFIRUgvQVhFa09Rd09DeU01UVFFUWdnRWpPVUVCYWhBZEpEa2pPUVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUVNRHdzak9VRi9FSUlCSXpsQkFXc1FIU1E1SXprRVFFRUFFSU1CQlVFQkVJTUJDMEVCRUlRQkRBNExFQmxCL3dGeEpEa01EQXNRa2dGQkFFc0VRRUVHSVFFTEVJc0JRUUJMQkVBZ0FVSGdBSEloQVFzUWt3RkJBRXNFZnlNMElBRnJFQjBGSXpSQkQzRkJDVXNFUUNBQlFRWnlJUUVMSXpSQm1RRkxCRUFnQVVIZ0FISWhBUXNqTkNBQmFoQWRDeUlBQkVCQkFCQ0RBUVZCQVJDREFRc2dBVUhnQUhFRVFFRUJFSVVCQlVFQUVJVUJDMEVBRUlFQklBQWtOQXdNQ3hDUkFVRUFTd1JBRUJrUWpnRkJEQThGREFzTEFBc2pPU002RUJvaUFTQUJRZi8vQTNGQkFCQ0lBU0FCUVFGMEVCY2lBUkFjUWY4QmNTUTVJQUVRSFVIL0FYRWtPa0VBRUlRQlFRZ1BDeU01SXpvUUdpSUJRZi8vQTNFUWJFSC9BWEVrTkNBQlFRRnFFQmNpQVJBY1FmOEJjU1E1REFZTEl6a2pPaEFhUVFGckVCY2lBUkFjUWY4QmNTUTVEQVVMSXpwQkFSQ0NBU002UVFGcUVCMGtPaU02QkVCQkFCQ0RBUVZCQVJDREFRdEJBQkNFQVF3SEN5TTZRWDhRZ2dFak9rRUJheEFkSkRvak9nUkFRUUFRZ3dFRlFRRVFnd0VMUVFFUWhBRU1CZ3NRR1VIL0FYRWtPZ3dFQ3lNMFFYOXpRZjhCY1NRMFFRRVFoQUZCQVJDQkFRd0VDMEYvRHdzZ0FSQWRRZjhCY1NRNlFRZ1BDeUFBRUIxQi93RnhKRHBCQ0E4TEl6MUJBV29RRnlROVFRZ1BDMEVFQzk4RUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFd1J3UkFBa0FnQUVFeGF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNRaXdFRVFBd1NCUkFaRUk0QlFRd1BDd0FMRUJ0Qi8vOERjU1E4SXoxQkFtb1FGeVE5UVF3UEN5TTVJem9RR2lJQVFmLy9BM0VqTkJCL0RBNExJenhCQVdvUUZ5UThRUWdQQ3lNNUl6b1FHaUlBUWYvL0EzRVFiQ0lCUVFFUWdnRWdBVUVCYWhBZElnRUVRRUVBRUlNQkJVRUJFSU1CQzBFQUVJUUJEQTRMSXprak9oQWFJZ0JCLy84RGNSQnNJZ0ZCZnhDQ0FTQUJRUUZyRUIwaUFRUkFRUUFRZ3dFRlFRRVFnd0VMUVFFUWhBRU1EUXNqT1NNNkVCcEIvLzhEY1JBWlFmOEJjUkIvSXoxQkFXb1FGeVE5UVF3UEMwRUFFSVFCUVFBUWdRRkJBUkNGQVVFRUR3c1Fpd0ZCQVVZRVFCQVpFSTRCUVF3UEJRd0tDd0FMSXprak9oQWFJZ0VqUEVFQUVJZ0JJQUVqUEdvUUZ5SUFFQnhCL3dGeEpEa2dBQkFkUWY4QmNTUTZRUUFRaEFGQkNBOExJemtqT2hBYUlnQkIvLzhEY1JCc1FmOEJjU1EwREFZTEl6eEJBV3NRRnlROFFRZ1BDeU0wUVFFUWdnRWpORUVCYWhBZEpEUWpOQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQkE4TEl6UkJmeENDQVNNMFFRRnJFQjBrTkNNMEJFQkJBQkNEQVFWQkFSQ0RBUXRCQVJDRUFVRUVEd3NRR1VIL0FYRWtOQXdEQzBFQUVJUUJRUUFRZ1FFUWl3RkJBRXNFUUVFQUVJVUJCVUVCRUlVQkMwRUVEd3RCZnc4TElBQkJBV3NRRnlJQUVCeEIvd0Z4SkRrZ0FCQWRRZjhCY1NRNlFRZ1BDeU05UVFGcUVCY2tQVUVJRHdzZ0FFSC8vd054SUFFUWYwRU1DOWtCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUFSd1JBSUFBaUFVSEJBRVlOQVFKQUlBRkJ3Z0JyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTERCQUxJellrTlF3UEN5TTNKRFVNRGdzak9DUTFEQTBMSXpra05Rd01DeU02SkRVTUN3c2pPU002RUJvUWJFSC9BWEVrTlVFSUR3c2pOQ1ExREFrTEl6VWtOZ3dJQ3d3SEN5TTNKRFlNQmdzak9DUTJEQVVMSXpra05nd0VDeU02SkRZTUF3c2pPU002RUJvUWJFSC9BWEVrTmtFSUR3c2pOQ1EyREFFTFFYOFBDMEVFQzlnQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZEFBUndSQUlBQWlBVUhSQUVZTkFRSkFJQUZCMGdCckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVrTnd3UUN5TTJKRGNNRHdzTURnc2pPQ1EzREEwTEl6a2tOd3dNQ3lNNkpEY01Dd3NqT1NNNkVCb1FiRUgvQVhFa04wRUlEd3NqTkNRM0RBa0xJelVrT0F3SUN5TTJKRGdNQndzak55UTREQVlMREFVTEl6a2tPQXdFQ3lNNkpEZ01Bd3NqT1NNNkVCb1FiRUgvQVhFa09Bd0NDeU0wSkRnTUFRdEJmdzhMUVFRTDJnRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFCSEJFQWdBQ0lCUWVFQVJnMEJBa0FnQVVIaUFHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlNRNVFRZ1BDeU0ySkRrTUR3c2pOeVE1REE0TEl6Z2tPUXdOQ3d3TUN5TTZKRGtNQ3dzak9TTTZFQm9RYkVIL0FYRWtPVUVJRHdzak5DUTVEQWtMSXpVa09nd0lDeU0ySkRvTUJ3c2pOeVE2REFZTEl6Z2tPZ3dGQ3lNNUpEb01CQXNNQXdzak9TTTZFQm9RYkVIL0FYRWtPa0VJRHdzak5DUTZEQUVMUVg4UEMwRUVDNGdDQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUJIQkVBZ0FDSUJRZkVBUmcwQkFrQWdBVUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pPU002RUJvak5SQi9EQkFMSXprak9oQWFJellRZnd3UEN5TTVJem9RR2lNM0VIOE1EZ3NqT1NNNkVCb2pPQkIvREEwTEl6a2pPaEFhSXprUWZ3d01DeU01SXpvUUdpTTZFSDhNQ3dzanlRRkZCRUJCQVNRL0N3d0xDeU01SXpvUUdpTTBFSDhNQ1Fzak5TUTBEQWtMSXpZa05Bd0lDeU0zSkRRTUJ3c2pPQ1EwREFZTEl6a2tOQXdGQ3lNNkpEUU1CQXNqT1NNNkVCb1FiRUgvQVhFa05Bd0NDd3dDQzBGL0R3dEJDQThMUVFRTFNRQWdBVUVBVGdSQUlBQkIvd0Z4SUFBZ0FXb1FIVXNFUUVFQkVJVUJCVUVBRUlVQkN3VWdBVUVBSUFGcklBRkJBRW9iSUFCQi93RnhTZ1JBUVFFUWhRRUZRUUFRaFFFTEN3czJBUUYvSXpRZ0FFSC9BWEVpQVJDQ0FTTTBJQUVRbWdFak5DQUFhaEFkSkRRak5BUkFRUUFRZ3dFRlFRRVFnd0VMUVFBUWhBRUxhUUVCZnlNMElBQnFFSXNCYWhBZElRRWpOQ0FBY3lBQmN4QWRRUkJ4QkVCQkFSQ0JBUVZCQUJDQkFRc2pOQ0FBUWY4QmNXb1Fpd0ZxRUJkQmdBSnhRUUJMQkVCQkFSQ0ZBUVZCQUJDRkFRc2dBU1EwSXpRRVFFRUFFSU1CQlVFQkVJTUJDMEVBRUlRQkMrSUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQmdBRkhCRUFDUUNBQlFZRUJhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5SQ2JBUXdRQ3lNMkVKc0JEQThMSXpjUW13RU1EZ3NqT0JDYkFRd05DeU01RUpzQkRBd0xJem9RbXdFTUN3c2pPU002RUJvUWJCQ2JBVUVJRHdzak5CQ2JBUXdKQ3lNMUVKd0JEQWdMSXpZUW5BRU1Cd3NqTnhDY0FRd0dDeU00RUp3QkRBVUxJemtRbkFFTUJBc2pPaENjQVF3REN5TTVJem9RR2hCc0VKd0JRUWdQQ3lNMEVKd0JEQUVMUVg4UEMwRUVDemtCQVg4ak5DQUFRZjhCY1VGL2JDSUJFSUlCSXpRZ0FSQ2FBU00wSUFCckVCMGtOQ00wQkVCQkFCQ0RBUVZCQVJDREFRdEJBUkNFQVF0cEFRRi9JelFnQUdzUWl3RnJFQjBoQVNNMElBQnpJQUZ6UVJCeEVCMEVRRUVCRUlFQkJVRUFFSUVCQ3lNMElBQkIvd0Z4YXhDTEFXc1FGMEdBQW5GQkFFc0VRRUVCRUlVQkJVRUFFSVVCQ3lBQkpEUWpOQVJBUVFBUWd3RUZRUUVRZ3dFTFFRRVFoQUVMNGdFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdRQVVjRVFBSkFJQUZCa1FGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU0xRUo0QkRCQUxJellRbmdFTUR3c2pOeENlQVF3T0N5TTRFSjRCREEwTEl6a1FuZ0VNREFzak9oQ2VBUXdMQ3lNNUl6b1FHaEJzRUo0QlFRZ1BDeU0wRUo0QkRBa0xJelVRbndFTUNBc2pOaENmQVF3SEN5TTNFSjhCREFZTEl6Z1Fud0VNQlFzak9SQ2ZBUXdFQ3lNNkVKOEJEQU1MSXprak9oQWFFR3dRbndGQkNBOExJelFRbndFTUFRdEJmdzhMUVFRTEtBQWpOQ0FBY1NRMEl6UUVRRUVBRUlNQkJVRUJFSU1CQzBFQUVJUUJRUUVRZ1FGQkFCQ0ZBUXNxQUNNMElBQnpFQjBrTkNNMEJFQkJBQkNEQVFWQkFSQ0RBUXRCQUJDRUFVRUFFSUVCUVFBUWhRRUw0Z0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR2dBVWNFUUFKQUlBRkJvUUZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5TTFFS0VCREJBTEl6WVFvUUVNRHdzak54Q2hBUXdPQ3lNNEVLRUJEQTBMSXprUW9RRU1EQXNqT2hDaEFRd0xDeU01SXpvUUdoQnNFS0VCUVFnUEN5TTBFS0VCREFrTEl6VVFvZ0VNQ0Fzak5oQ2lBUXdIQ3lNM0VLSUJEQVlMSXpnUW9nRU1CUXNqT1JDaUFRd0VDeU02RUtJQkRBTUxJemtqT2hBYUVHd1FvZ0ZCQ0E4TEl6UVFvZ0VNQVF0QmZ3OExRUVFMTEFBak5DQUFja0gvQVhFa05DTTBCRUJCQUJDREFRVkJBUkNEQVF0QkFCQ0VBVUVBRUlFQlFRQVFoUUVMTXdFQmZ5TTBJQUJCL3dGeFFYOXNJZ0VRZ2dFak5DQUJFSm9CSXpRZ0FXb0VRRUVBRUlNQkJVRUJFSU1CQzBFQkVJUUJDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJzQUZIQkVBQ1FDQUJRYkVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkNrQVF3UUN5TTJFS1FCREE4TEl6Y1FwQUVNRGdzak9CQ2tBUXdOQ3lNNUVLUUJEQXdMSXpvUXBBRU1Dd3NqT1NNNkVCb1FiQkNrQVVFSUR3c2pOQkNrQVF3SkN5TTFFS1VCREFnTEl6WVFwUUVNQndzak54Q2xBUXdHQ3lNNEVLVUJEQVVMSXprUXBRRU1CQXNqT2hDbEFRd0RDeU01SXpvUUdoQnNFS1VCUVFnUEN5TTBFS1VCREFFTFFYOFBDMEVFQzBBQkFuOENRQUpBSUFBUWF5SUJRWDlIQkVBTUFnc2dBQkFESVFFTEN3SkFBa0FnQUVFQmFpSUNFR3NpQUVGL1J3MEJJQUlRQXlFQUN3c2dBQ0FCRUJvTE93QWdBRUdBQVhGQmdBRkdCRUJCQVJDRkFRVkJBQkNGQVFzZ0FCQ0dBU0lBQkVCQkFCQ0RBUVZCQVJDREFRdEJBQkNFQVVFQUVJRUJJQUFMT1FBZ0FFRUJjVUVBU3dSQVFRRVFoUUVGUVFBUWhRRUxJQUFRaVFFaUFBUkFRUUFRZ3dFRlFRRVFnd0VMUVFBUWhBRkJBQkNCQVNBQUMwZ0JBWDhnQUVHQUFYRkJnQUZHQkVCQkFTRUJDeUFBRUl3QklRQWdBUVJBUVFFUWhRRUZRUUFRaFFFTElBQUVRRUVBRUlNQkJVRUJFSU1CQzBFQUVJUUJRUUFRZ1FFZ0FBdEdBUUYvSUFCQkFYRkJBVVlFUUVFQklRRUxJQUFRandFaEFDQUJCRUJCQVJDRkFRVkJBQkNGQVFzZ0FBUkFRUUFRZ3dFRlFRRVFnd0VMUVFBUWhBRkJBQkNCQVNBQUMwb0JBWDhnQUVHQUFYRkJnQUZHQkVCQkFTRUJDeUFBUVFGMEVCMGhBQ0FCQkVCQkFSQ0ZBUVZCQUJDRkFRc2dBQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQUJDQkFTQUFDMm9CQW44Z0FFR0FBWEZCZ0FGR0JFQkJBU0VCQ3lBQVFRRnhRUUZHQkVCQkFTRUNDeUFBUWY4QmNVRUJkaEFkSVFBZ0FRUkFJQUJCZ0FGeUlRQUxJQUFFUUVFQUVJTUJCVUVCRUlNQkMwRUFFSVFCUVFBUWdRRWdBZ1JBUVFFUWhRRUZRUUFRaFFFTElBQUxOd0FnQUVFUGNVRUVkQ0FBUWZBQmNVRUVkbklRSFNJQUJFQkJBQkNEQVFWQkFSQ0RBUXRCQUJDRUFVRUFFSUVCUVFBUWhRRWdBQXRLQVFGL0lBQkJBWEZCQVVZRVFFRUJJUUVMSUFCQi93RnhRUUYyRUIwaUFBUkFRUUFRZ3dFRlFRRVFnd0VMUVFBUWhBRkJBQkNCQVNBQkJFQkJBUkNGQVFWQkFCQ0ZBUXNnQUFzb0FDQUJRUUVnQUhSeFFmOEJjUVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQVJDQkFTQUJDeUFBSUFGQkFFb0VmeUFDUVFFZ0FIUnlCU0FDUVFFZ0FIUkJmM054Q3lJQ0M5Y0lBUWQvUVg4aEJRSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUWh2SWdjaEJpQUhSUTBBQWtBZ0JrRUJhdzRIQWdNRUJRWUhDQUFMREFnTEl6VWhBUXdIQ3lNMklRRU1CZ3NqTnlFQkRBVUxJemdoQVF3RUN5TTVJUUVNQXdzak9pRUJEQUlMSXprak9oQWFFR3doQVF3QkN5TTBJUUVMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lHSVFRZ0JrVU5BQUpBSUFSQkFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSUFCQkIwd0VRQ0FCRUtnQklRSkJBU0VEQlNBQVFROU1CRUFnQVJDcEFTRUNRUUVoQXdzTERBOExJQUJCRjB3RVFDQUJFS29CSVFKQkFTRURCU0FBUVI5TUJFQWdBUkNyQVNFQ1FRRWhBd3NMREE0TElBQkJKMHdFUUNBQkVLd0JJUUpCQVNFREJTQUFRUzlNQkVBZ0FSQ3RBU0VDUVFFaEF3c0xEQTBMSUFCQk4wd0VRQ0FCRUs0QklRSkJBU0VEQlNBQVFUOU1CRUFnQVJDdkFTRUNRUUVoQXdzTERBd0xJQUJCeHdCTUJFQkJBQ0FCRUxBQklRSkJBU0VEQlNBQVFjOEFUQVJBUVFFZ0FSQ3dBU0VDUVFFaEF3c0xEQXNMSUFCQjF3Qk1CRUJCQWlBQkVMQUJJUUpCQVNFREJTQUFRZDhBVEFSQVFRTWdBUkN3QVNFQ1FRRWhBd3NMREFvTElBQkI1d0JNQkVCQkJDQUJFTEFCSVFKQkFTRURCU0FBUWU4QVRBUkFRUVVnQVJDd0FTRUNRUUVoQXdzTERBa0xJQUJCOXdCTUJFQkJCaUFCRUxBQklRSkJBU0VEQlNBQVFmOEFUQVJBUVFjZ0FSQ3dBU0VDUVFFaEF3c0xEQWdMSUFCQmh3Rk1CRUJCQUVFQUlBRVFzUUVoQWtFQklRTUZJQUJCandGTUJFQkJBVUVBSUFFUXNRRWhBa0VCSVFNTEN3d0hDeUFBUVpjQlRBUkFRUUpCQUNBQkVMRUJJUUpCQVNFREJTQUFRWjhCVEFSQVFRTkJBQ0FCRUxFQklRSkJBU0VEQ3dzTUJnc2dBRUduQVV3RVFFRUVRUUFnQVJDeEFTRUNRUUVoQXdVZ0FFR3ZBVXdFUUVFRlFRQWdBUkN4QVNFQ1FRRWhBd3NMREFVTElBQkJ0d0ZNQkVCQkJrRUFJQUVRc1FFaEFrRUJJUU1GSUFCQnZ3Rk1CRUJCQjBFQUlBRVFzUUVoQWtFQklRTUxDd3dFQ3lBQVFjY0JUQVJBUVFCQkFTQUJFTEVCSVFKQkFTRURCU0FBUWM4QlRBUkFRUUZCQVNBQkVMRUJJUUpCQVNFREN3c01Bd3NnQUVIWEFVd0VRRUVDUVFFZ0FSQ3hBU0VDUVFFaEF3VWdBRUhmQVV3RVFFRURRUUVnQVJDeEFTRUNRUUVoQXdzTERBSUxJQUJCNXdGTUJFQkJCRUVCSUFFUXNRRWhBa0VCSVFNRklBQkI3d0ZNQkVCQkJVRUJJQUVRc1FFaEFrRUJJUU1MQ3d3QkN5QUFRZmNCVEFSQVFRWkJBU0FCRUxFQklRSkJBU0VEQlNBQVFmOEJUQVJBUVFkQkFTQUJFTEVCSVFKQkFTRURDd3NMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FISWdRRVFBSkFJQVJCQVdzT0J3SURCQVVHQndnQUN3d0lDeUFDSkRVTUJ3c2dBaVEyREFZTElBSWtOd3dGQ3lBQ0pEZ01CQXNnQWlRNURBTUxJQUlrT2d3Q0N5TTVJem9RR2lBQ0VIOE1BUXNnQWlRMEN5TTlRUUZxRUJja1BTQURCRUJCQ0NFRklBUkJCa1lFUUVFUUlRVUxDeUFGQytrREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWNBQlJ3UkFBa0FnQVVIQkFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMRUpFQkJFQkJDQThGREJZTEFBc2pQQkNuQVNFQkl6eEJBbW9RRnlROElBRVFIRUgvQVhFa05TQUJFQjFCL3dGeEpEWkJEQThMRUpFQkJFQU1FQVVNRXdzQUN3d1JDeENSQVFSQURBNEZEQThMQUFzalBFRUNheEFYSkR3alBDTTFJellRR2hDSEFVRVFEd3NRR1JDYkFRd0tDeU04UVFKckVCY2tQQ004SXowUWh3RkJBQ1E5UVJBUEN4Q1JBVUVCUmdSQURBNEZRUWdQQ3dBTEl6d1Fwd0ZCLy84RGNTUTlJenhCQW1vUUZ5UThRUkFQQ3hDUkFVRUJSZ1JBREFzRkRBZ0xBQXNRR1VIL0FYRVFzZ0VpQVVFQVNnUkFJQUZCQkdvaEFRc2dBUThMRUpFQlFRRkdCRUFqUEVFQ2F4QVhKRHdqUENNOVFRSnFRZi8vQTNFUWh3RU1DQVVNQmdzQUN3d0ZDeEFaRUp3QkRBSUxJenhCQW1zUUZ5UThJendqUFJDSEFVRUlKRDFCRUE4TFFYOFBDeU05UVFGcUVCY2tQVUVJRHdzalBVRUNhaEFYSkQxQkRBOExJenhCQW1zUUZ5UThJendqUFVFQ2FoQVhFSWNCQ3hBYlFmLy9BM0VrUFVFWUR3c1FHMEgvL3dOeEpEMUJFQThMSXp3UXB3RkIvLzhEY1NROUl6eEJBbW9RRnlROFFSUUxDZ0FnQUVFQmNTVHBBUXZEQXdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCMEFGSEJFQUNRQ0FCUWRFQmF3NFBBZ01BQkFVR0J3Z0pDZ0FMQUF3TkFBc01EUXNRaXdFRVFFRUlEd1VNRWdzQUN5TThFS2NCSVFFalBFRUNhaEFYSkR3Z0FSQWNRZjhCY1NRM0lBRVFIVUgvQVhFa09FRU1Ed3NRaXdFRVFBd05CUXdQQ3dBTEVJc0JCRUFNREFValBFRUNheEFYSkR3alBDTTlRUUpxUWYvL0EzRVFod0VNRFFzQUN5TThRUUpyRUJja1BDTThJemNqT0JBYUVJY0JRUkFQQ3hBWkVKNEJEQWdMSXp4QkFtc1FGeVE4SXp3alBSQ0hBVUVRSkQxQkVBOExFSXNCUVFGR0JFQU1Dd1ZCQ0E4TEFBc2pQQkNuQVVILy93TnhKRDFCQVJDMEFTTThRUUpxRUJja1BFRVFEd3NRaXdGQkFVWUVRQXdJQlF3R0N3QUxFSXNCUVFGR0JFQWpQRUVDYXhBWEpEd2pQQ005UVFKcUVCY1Fod0VNQmdVTUJRc0FDeEFaRUo4QkRBSUxJenhCQW1zUUZ5UThJendqUFJDSEFVRVlKRDFCRUE4TFFYOFBDeU05UVFGcUVCY2tQVUVJRHdzalBVRUNhaEFYSkQxQkRBOExFQnRCLy84RGNTUTlRUmdQQ3hBYlFmLy9BM0VrUFVFUUR3c2pQQkNuQVVILy93TnhKRDBqUEVFQ2FoQVhKRHhCRkF2YkFnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBVWNFUUFKQUlBQkI0UUZyRGc4Q0F3QUFCQVVHQndnSkFBQUFDZ3NBQ3d3TEN4QVpRZjhCY1VHQS9nTnFJelFRZnlNOVFRRnFFQmNrUFVFTUR3c2pQQkNuQVNFQUl6eEJBbW9RRnlROElBQVFIRUgvQVhFa09TQUFFQjFCL3dGeEpEcEJEQThMSXpaQmdQNERhaU0wRUg5QkNBOExJenhCQW1zUUZ5UThJendqT1NNNkVCb1Fod0ZCRUE4TEVCa1FvUUVNQndzalBFRUNheEFYSkR3alBDTTlFSWNCUVNBa1BVRVFEd3NRR1JDTkFTRUFJendnQUVFWWRFRVlkU0lBUVFFUWlBRWpQQ0FBYWhBWEpEeEJBQkNEQVVFQUVJUUJJejFCQVdvUUZ5UTlRUkFQQ3lNNUl6b1FHa0gvL3dOeEpEMUJCQThMRUJ0Qi8vOERjU00wRUg4alBVRUNhaEFYSkQxQkVBOExFQmtRb2dFTUFnc2pQRUVDYXhBWEpEd2pQQ005RUljQlFTZ2tQVUVRRHd0QmZ3OExJejFCQVdvUUZ5UTlRUWdMaXdNQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGSEJFQUNRQ0FBUWZFQmF3NFBBZ01FQUFVR0J3Z0pDZ3NBQUF3TkFBc01EUXNRR1VIL0FYRkJnUDREYWhCc0VCMGtOQXdPQ3lNOEVLY0JRZi8vQTNFaEFDTThRUUpxRUJja1BDQUFFQnhCL3dGeEpEUWdBQkFkUWY4QmNTUTdRUXdQQ3lNMlFZRCtBMm9RYkJBZEpEUkJDQThMUVFBUXRBRkJCQThMSXp4QkFtc1FGeVE4SXp3ak5DTTdFQm9RaHdGQkVBOExFQmtRcEFFTUNBc2pQRUVDYXhBWEpEd2pQQ005RUljQlFUQWtQVUVRRHdzUUdSQ05BU0VBUVFBUWd3RkJBQkNFQVNNOElBQkJHSFJCR0hVaUFFRUJFSWdCSXp3Z0FHb1FGeUlBRUJ4Qi93RnhKRGtnQUJBZFFmOEJjU1E2REFjTEl6a2pPaEFhUWYvL0EzRWtQRUVJRHdzUUcwSC8vd054RUd4Qi93RnhKRFFqUFVFQ2FoQVhKRDFCRUE4TFFRRVF0QUZCQkE4TEVCa1FwUUVNQWdzalBFRUNheEFYSkR3alBDTTlFSWNCUVRna1BVRVFEd3RCZnc4TEl6MUJBV29RRnlROVFRZ1BDeU05UVFGcUVCY2tQVUVNQzhnQkFRRi9JejFCQVdvUUZ5UTlBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdFRVFDQUJRUUZHRFFFQ1FDQUJRUUpyRGcwREJBVUdCd2dKQ2dzTURRNFBBQXNNRHdzZ0FCQ0tBUThMSUFBUWtBRVBDeUFBRUpRQkR3c2dBQkNWQVE4TElBQVFsZ0VQQ3lBQUVKY0JEd3NnQUJDWUFROExJQUFRbVFFUEN5QUFFSjBCRHdzZ0FCQ2dBUThMSUFBUW93RVBDeUFBRUtZQkR3c2dBQkN6QVE4TElBQVF0UUVQQ3lBQUVMWUJEd3NnQUJDM0FRc01BQ1BnQVNQb0FYRkJBRW9MR3dFQmZ5QUJFQndoQWlBQUlBRVFIUkFHSUFCQkFXb2dBaEFHQzRNQkFRRi9RUUFRdEFFZ0FFR1AvZ01RQXhCb0lnRWs0QUZCai80RElBRVFCaU04UVFKclFmLy9BM0VrUENNOEl6MFF1Z0VDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdRQ0F3QUVBQXNNQkF0QkFDVGhBVUhBQUNROURBTUxRUUFrNGdGQnlBQWtQUXdDQzBFQUpOOEJRZEFBSkQwTUFRdEJBQ1RqQVVIZ0FDUTlDd3VzQVFFQmZ5UHBBUVIvSStnQlFRQktCU1BwQVFzaUFBUkFJK0FCUVFCS0lRQUxJQUFFUUVFQUlRQWo1QUVFZnlQaEFRVWo1QUVMQkVCQkFCQzdBVUVCSVFBRkkrVUJCSDhqNGdFRkkrVUJDd1JBUVFFUXV3RkJBU0VBQlNQbUFRUi9JOThCQlNQbUFRc0VRRUVDRUxzQlFRRWhBQVVqNXdFRWZ5UGpBUVVqNXdFTEJFQkJCQkM3QVVFQklRQUxDd3NMSUFBRVFFRVVJUUFqUHdSQVFRQWtQMEVZSVFBTElBQVBDd3RCQUFzT0FDTXpCRUJCa0FjUEMwSElBd3NGQUJDOUFRc1ZBQ0FBUVlDUWZtb2dBVUVCY1VFTmRHb3RBQUFMRGdBZ0FVR2dBV3dnQUdwQkEyd0xGZ0FnQUNBQkVNQUJRWURZQldvZ0Ftb2dBem9BQUFzTEFDQUJRYUFCYkNBQWFnc1JBQ0FBSUFFUXdnRkJnS0FFYWkwQUFBc3NBUUYvSUFKQkEzRWhCQ0FEUVFGeEJFQkJBaUFFRUdVaEJBc2dBQ0FCRU1JQlFZQ2dCR29nQkRvQUFBdXlBZ0VEZnlBQlFRQktJZ01FUUNBQVFRaEtJUU1MSUFNRVFDQUdJK29CUmlFREN5QURCRUFnQUNQckFVWWhBd3NnQXdSQVFRQWhBMEVBSVFaQkJTQUVRUUZyRUFNUUVBUkFRUUVoQXd0QkJTQUVFQU1RRUFSQVFRRWhCZ3NDUUVFQUlRUURRQ0FFUVFoT0RRRWdBeUFHUndSQVFRY2dCR3NoQkFzZ0FDQUVha0dnQVV3RVFDQUFRUWdnQkd0cklRZ2dBQ0FFYWlBQkVNQUJRWURZQldvaENRSkFRUUFoQlFOQUlBVkJBMDROQVNBQUlBUnFJQUVnQlNBSklBVnFMUUFBRU1FQklBVkJBV29oQlF3QUFBc0FDeUFBSUFScUlBRkJBaUFJSUFFUXd3RWlCUkJvUVFJZ0JSQVFFTVFCSUFkQkFXb2hCd3NnQkVFQmFpRUVEQUFBQ3dBTEJTQUdKT29CQ3lBQUkrc0JUZ1JBSUFCQkNHb2s2d0VnQUNBQ1FRaHZJZ1pJQkVBajZ3RWdCbW9rNndFTEN5QUhDemdCQVg4Z0FFR0FrQUpHQkVBZ0FVR0FBV29oQWtFSElBRVFFQVJBSUFGQmdBRnJJUUlMSUFBZ0FrRUVkR29QQ3lBQUlBRkJCSFJxQ3lRQkFYOGdBRUUvY1NFQ0lBRkJBWEVFUUNBQ1FVQnJJUUlMSUFKQmdKQUVhaTBBQUFzaUFRRi9JQUJCQTNRZ0FVRUJkR29pQTBFQmFpQUNFTWNCSUFNZ0FoREhBUkFhQ3hVQUlBRkJIeUFBUVFWc0lnQjBjU0FBZFVFRGRBdFpBQ0FDUVFGeFJRUkFJQUVRQXlBQVFRRjBkVUVEY1NFQUMwSHlBU0VCQWtBQ1FBSkFBa0FDUUNBQVJRMEVBa0FnQUVFQmF3NERBZ01FQUFzTUJBQUxBQXRCb0FFaEFRd0NDMEhZQUNFQkRBRUxRUWdoQVFzZ0FRc05BQ0FCSUFKc0lBQnFRUU5zQzdVQ0FRWi9JQUVnQUJER0FTQUZRUUYwYWlJQUlBSVF2d0VoRVNBQVFRRnFJQUlRdndFaEVnSkFJQU1oQUFOQUlBQWdCRW9OQVNBR0lBQWdBMnRxSWc0Z0NFZ0VRQ0FBSVFFZ0RFRUFTQ0lDUlFSQVFRVWdEQkFRUlNFQ0N5QUNCRUJCQnlBQmF5RUJDMEVBSVFJZ0FTQVNFQkFFUUVFQ0lRSUxJQUVnRVJBUUJFQWdBa0VCYWlFQ0N5QU1RUUJPQkg5QkFDQU1RUWR4SUFKQkFCRElBU0lGRU1rQklROUJBU0FGRU1rQklRRkJBaUFGRU1rQkJTQUxRUUJNQkVCQngvNERJUXNMSUFJZ0N5QUtFTW9CSWdVaER5QUZJZ0VMSVFVZ0NTQU9JQWNnQ0JETEFXb2lFQ0FQT2dBQUlCQkJBV29nQVRvQUFDQVFRUUpxSUFVNkFBQkJBQ0VCSUF4QkFFNEVRRUVISUF3UUVDRUJDeUFPSUFjZ0FpQUJFTVFCSUExQkFXb2hEUXNnQUVFQmFpRUFEQUFBQ3dBTElBMExod0VCQTM4Z0EwRUlieUVESUFCRkJFQWdBaUFDUVFodFFRTjBheUVIQzBFSElRZ2dBRUVJYWtHZ0FVb0VRRUdnQVNBQWF5RUlDMEYvSVFJakx3UkFRUU1nQkVFQkVMOEJJZ0pCL3dGeEVCQUVRRUVCSVFrTFFRWWdBaEFRQkVCQkJ5QURheUVEQ3dzZ0JpQUZJQWtnQnlBSUlBTWdBQ0FCUWFBQlFZRFlCVUVBUVFBZ0FoRE1BUXZwQVFBZ0JTQUdFTVlCSVFZZ0JFRUJFTDhCSVFRZ0EwRUlieUVEUVFZZ0JCQVFCRUJCQnlBRGF5RURDMEVBSVFWQkF5QUVFQkFFUUVFQklRVUxJQVlnQTBFQmRHb2lBeUFGRUw4QklRWWdBMEVCYWlBRkVMOEJJUVVnQWtFSWJ5RURRUVVnQkJBUVJRUkFRUWNnQTJzaEF3dEJBQ0VDSUFNZ0JSQVFCRUJCQWlFQ0N5QURJQVlRRUFSQUlBSkJBV29oQWd0QkFDQUVRUWR4SUFKQkFCRElBU0lERU1rQklRVkJBU0FERU1rQklRWkJBaUFERU1rQklRTWdBQ0FCUVFBZ0JSREJBU0FBSUFGQkFTQUdFTUVCSUFBZ0FVRUNJQU1Rd1FFZ0FDQUJJQUpCQnlBRUVCQVF4QUVMaHdFQUlBUWdCUkRHQVNBRFFRaHZRUUYwYWlJRVFRQVF2d0VoQlVFQUlRTWdCRUVCYWtFQUVMOEJJUVJCQnlBQ1FRaHZheUlDSUFRUUVBUkFRUUloQXdzZ0FpQUZFQkFFUUNBRFFRRnFJUU1MSUFBZ0FVRUFJQU5CeC80RFFRQVF5Z0VpQWhEQkFTQUFJQUZCQVNBQ0VNRUJJQUFnQVVFQ0lBSVF3UUVnQUNBQklBTkJBQkRFQVF2aEFRRUdmeUFEUVFOMUlRc0NRQU5BSUFSQm9BRk9EUUVnQkNBRmFpSUdRWUFDVGdSQUlBWkJnQUpySVFZTElBSWdDMEVGZEdvZ0JrRURkV29pQ1VFQUVMOEJJUWRCQUNFS0l5d0VRQ0FFSUFBZ0JpQURJQWtnQVNBSEVNVUJJZ2hCQUVvRVFDQUVJQWhCQVd0cUlRUkJBU0VLQ3dzakt3Ui9JQXBGQlNNckN5SUlCRUFnQkNBQUlBWWdBeUFKSUFFZ0J4RE5BU0lJUVFCS0JFQWdCQ0FJUVFGcmFpRUVDd1VnQ2tVRVFDTXZCRUFnQkNBQUlBWWdBeUFKSUFFZ0J4RE9BUVVnQkNBQUlBWWdBeUFCSUFjUXp3RUxDd3NnQkVFQmFpRUVEQUFBQ3dBTEN5MEJBbjhqU2lFRUlBQWpTMm9pQTBHQUFrNEVRQ0FEUVlBQ2F5RURDeUFBSUFFZ0FpQURRUUFnQkJEUUFRc3hBUU4vSTB3aEF5QUFJMDBpQkVnRVFBOExJQU5CQjJzaUEwRi9iQ0VGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFTkFCQzVVRkFSQi9Ba0JCSnlFSkEwQWdDVUVBU0EwQklBbEJBblFpQTBHQS9BTnFFQU1oQWlBRFFZSDhBMm9RQXlFTElBTkJndndEYWhBRElRUWdBa0VRYXlFQ0lBdEJDR3NoQzBFSUlRVWdBVUVCY1FSQVFSQWhCU0FFUVFKdlFRRkdCRUFnQkVFQmF5RUVDd3NnQUNBQ1RpSUdCRUFnQUNBQ0lBVnFTQ0VHQ3lBR0JFQkJCeUFEUVlQOEEyb1FBeUlHRUJBaERFRUdJQVlRRUNFRFFRVWdCaEFRSVE4Z0FDQUNheUVDSUFNRVFDQUNJQVZyUVg5c1FRRnJJUUlMUVlDQUFpQUVFTVlCSUFKQkFYUnFJUVJCQUNFQ0l5OEVmMEVESUFZUUVBVWpMd3NpQXdSQVFRRWhBZ3NnQkNBQ0VMOEJJUkFnQkVFQmFpQUNFTDhCSVJFQ1FFRUhJUVVEUUNBRlFRQklEUUVnQlNFQ0lBOEVRQ0FDUVFkclFYOXNJUUlMUVFBaENDQUNJQkVRRUFSQVFRSWhDQXNnQWlBUUVCQUVRQ0FJUVFGcUlRZ0xJQWdFUUNBTFFRY2dCV3RxSWdkQkFFNGlBZ1JBSUFkQm9BRk1JUUlMSUFJRVFFRUFJUUpCQUNFTlFRQWhEaU12Qkg4anhRRkZCU012Q3lJRUJFQkJBU0VDQ3lBQ1JRUkFJQWNnQUJEREFTSUtRUU54SVFNZ0RBUi9JQU5CQUVvRklBd0xJZ1FFUUVFQklRMEZJeThFZjBFQ0lBb1FFQVVqTHdzaUJBUkFJQU5CQUVvaEJBc2dCQVJBUVFFaERnc0xDeUFDUlFSQUlBMUZJZ01FZnlBT1JRVWdBd3NoQWdzZ0FnUkFJeThFUUVFQUlBWkJCM0VnQ0VFQkVNZ0JJZ01ReVFFaEJFRUJJQU1ReVFFaEFrRUNJQU1ReVFFaEF5QUhJQUJCQUNBRUVNRUJJQWNnQUVFQklBSVF3UUVnQnlBQVFRSWdBeERCQVFWQnlQNERJUU5CQkNBR0VCQUVRRUhKL2dNaEF3c2dCeUFBUVFBZ0NDQURRUUFReWdFaUNoREJBU0FISUFCQkFTQUtFTUVCSUFjZ0FFRUNJQW9Rd1FFTEN3c0xJQVZCQVdzaEJRd0FBQXNBQ3dzZ0NVRUJheUVKREFBQUN3QUxDM0FCQW45QmdKQUNJUUlqd1FFRVFFR0FnQUloQWdzakx3Ui9JeThGSThVQkN5SUJCRUJCZ0xBQ0lRRWp3Z0VFUUVHQXVBSWhBUXNnQUNBQ0lBRVEwUUVMSThBQkJFQkJnTEFDSVFFanZ3RUVRRUdBdUFJaEFRc2dBQ0FDSUFFUTBnRUxJOFFCQkVBZ0FDUERBUkRUQVFzTEpnRUJmd0pBQTBBZ0FFR1FBVXNOQVNBQVFmOEJjUkRVQVNBQVFRRnFJUUFNQUFBTEFBc0xTd0VDZndKQUEwQWdBRUdRQVU0TkFRSkFRUUFoQVFOQUlBRkJvQUZPRFFFZ0FTQUFFTUlCUVlDZ0JHcEJBRG9BQUNBQlFRRnFJUUVNQUFBTEFBc2dBRUVCYWlFQURBQUFDd0FMQ3d3QVFYOGs2Z0ZCZnlUckFRc09BQ016QkVCQjhBVVBDMEg0QWdzT0FDTXpCRUJCOGdNUEMwSDVBUXNMQUVFQkpPSUJRUUVRZEF0c0FRRi9JOGtCUlFSQUR3dEJFQ0VBSTg0QlFSQklCRUFqemdFaEFBc2p6d0VqMEFFZ0FCQnRJODhCSUFCcUpNOEJJOUFCSUFCcUpOQUJJODRCSUFCckpNNEJJODRCUVFCTUJFQkJBQ1RKQVNQSUFVSC9BUkFHQlNQSUFVRUhJODRCUVJCdFFRRnJFR2dRQmdzTEN3QkJBU1RoQVVFQUVIUUwxQUlCQlg4anZnRkZCRUJCQUNSSVFRQWtTVUhFL2dOQkFCQUdRUUJCQVVIQi9nTVFBeEJvRUdnaEEwRUFKSFZCd2Y0RElBTVFCZzhMSTNVaEFTTkpJZ05Ca0FGT0JFQkJBU0VDQlNOSUVOZ0JUZ1JBUVFJaEFnVWpTQkRaQVU0RVFFRURJUUlMQ3dzZ0FTQUNSd1JBUWNIK0F4QURJUUFnQWlSMVFRQWhBUUpBQWtBQ1FBSkFBa0FnQWlFRUlBSkZEUUFDUUNBRVFRRnJEZ01DQXdRQUN3d0VDMEVEUVFGQkFDQUFFR2dRYUNJQUVCQWhBUXdEQzBFRVFRQkJBU0FBRUdnUVpTSUFFQkFoQVF3Q0MwRUZRUUZCQUNBQUVHZ1FaU0lBRUJBaEFRd0JDMEVCUVFBZ0FCQmxFR1VoQUFzZ0FRUkFFTm9CQ3lBQ1JRUkFFTnNCQ3lBQ1FRRkdCRUFRM0FFTEk4WUJJUVFnQWtVaUFVVUVRQ0FDUVFGR0lRRUxJQUVFUUNBRElBUkdJUUVMSUFFRVFFRUdRUUlnQUJCbElnQVFFQVJBRU5vQkN3VkJBaUFBRUdnaEFBdEJ3ZjRESUFBUUJnc0xiZ0VCZnlPK0FRUkFJMGdnQUdva1NDTklFTDBCVGdSQUkwZ1F2UUZySkVnalNTSUJRWkFCUmdSQUl5a0VRQkRWQVFVZ0FSRFVBUXNRMWdFUTF3RUZJQUZCa0FGSUJFQWpLVVVFUUNBQkVOUUJDd3NMSUFGQm1RRktCSDlCQUFVZ0FVRUJhZ3NpQVNSSkN3c1EzUUVMS0FBalJ4QytBVWdFUUE4TEEwQWpSeEMrQVU0RVFCQytBUkRlQVNOSEVMNEJheVJIREFFTEN3dmVBUUVDZjBFQkpDTkJCQ0VBSXo5RklnRUVRQ05BUlNFQkN5QUJCRUFqUFJBRFFmOEJjUkM0QVNFQUJTTS9CSDhqNlFGRkJTTS9DeUlCQkVBUXVRRWhBUXNnQVFSQVFRQWtQMEVBSkVBalBSQURRZjhCY1JDNEFTRUFJejFCQVdzUUZ5UTlDd3NqTzBId0FYRWtPeUFBUVFCTUJFQWdBQThMSThjQlFRQktCRUFnQUNQSEFXb2hBRUVBSk1jQkN5QUFFTHdCYWlFQUl6NGdBR29rUGlOQVJRUkFJeWNFUUNOSElBQnFKRWNRM3dFRklBQVEzZ0VMSXlZRVFDTk9JQUJxSkU0RklBQVFSd3NMSXlnRVFDTnNJQUJxSkd3UWR3VWdBQkIyQ3lBQUMwY0JBbjhEUUNBQVJTSUJCRUFqUGhBV1NDRUJDeUFCQkVBUTRBRkJBRWdFUUVFQklRQUxEQUVMQ3lNK0VCWk9CRUFqUGhBV2F5UStRUUFQQ3lNOVFRRnJFQmNrUFVGL0N3UUFJMTBMZVFFQ2YwR0FDQ0VCSUFBRWZ5QUFRUUJLQlNBQUN3UkFJQUFoQVFzRFFDQUNSU0lBQkVBalBoQVdTQ0VBQ3lBQUJFQVE0Z0VnQVVnaEFBc2dBQVJBRU9BQlFRQklCRUJCQVNFQ0N3d0JDd3NqUGhBV1RnUkFJejRRRm1za1BrRUFEd3NRNGdFZ0FVNEVRRUVCRHdzalBVRUJheEFYSkQxQmZ3c09BQ0FBUVlBSWFpQUJRVEpzYWdzWkFDQUJRUUZ4QkVBZ0FFRUJPZ0FBQlNBQVFRQTZBQUFMQzU0QkFFRUFRUUFRNUFFak5Eb0FBRUVCUVFBUTVBRWpOVG9BQUVFQ1FRQVE1QUVqTmpvQUFFRURRUUFRNUFFak56b0FBRUVFUVFBUTVBRWpPRG9BQUVFRlFRQVE1QUVqT1RvQUFFRUdRUUFRNUFFak9qb0FBRUVIUVFBUTVBRWpPem9BQUVFSVFRQVE1QUVqUERzQkFFRUtRUUFRNUFFalBUc0JBRUVNUVFBUTVBRWpQallDQUVFUlFRQVE1QUVqUHhEbEFVRVNRUUFRNUFFalFCRGxBUXNpQUVFQVFRRVE1QUVqU0RZQ0FFRUVRUUVRNUFFamRUb0FBRUhFL2dNalNSQUdDeHdBUVFCQkFoRGtBU1BwQVJEbEFVRUJRUUlRNUFFajdBRVE1UUVMQXdBQkMyNEFRUUJCQkJEa0FTTXRPd0VBUVFKQkJCRGtBU014T3dFQVFRUkJCQkRrQVNOQkVPVUJRUVZCQkJEa0FTTkNFT1VCUVFaQkJCRGtBU05ERU9VQlFRZEJCQkRrQVNORUVPVUJRUWhCQkJEa0FTTkZFT1VCUVFsQkJCRGtBU05HRU9VQlFRcEJCQkRrQVNNdUVPVUJDellBUVFCQkJSRGtBU055TmdJQVFRUkJCUkRrQVNOME5nSUFRUWhCQlJEa0FTTnpOZ0lBUVlUK0F5TnRFQVpCaGY0REkyNFFCZ3NtQUVFQVFRWVE1QUVqV2pZQ0FFRUVRUVlRNUFFald6b0FBRUVGUVFZUTVBRWpYRG9BQUF1Q0FRQkJBRUVIRU9RQkkzZ1E1UUZCQVVFSEVPUUJJNWdCTmdJQVFRVkJCeERrQVNPTEFUWUNBRUVKUVFjUTVBRWpkallDQUVFT1FRY1E1QUVqamdFMkFnQkJFMEVIRU9RQkkrMEJPZ0FBUVJSQkJ4RGtBU09qQVRvQUFFRVpRUWNRNUFFamhBRVE1UUZCR2tFSEVPUUJJNElCTmdJQVFSOUJCeERrQVNPRkFUc0JBQXRiQUVFQVFRZ1E1QUVqZXhEbEFVRUJRUWdRNUFFam5nRTJBZ0JCQlVFSUVPUUJJNDhCTmdJQVFRbEJDQkRrQVNONU5nSUFRUTVCQ0JEa0FTT1NBVFlDQUVFVFFRZ1E1QUVqN2dFNkFBQkJGRUVJRU9RQkk2WUJPZ0FBQ3pRQVFRQkJDUkRrQVNOK0VPVUJRUUZCQ1JEa0FTT2dBVFlDQUVFRlFRa1E1QUVqZkRZQ0FFRUpRUWtRNUFFanFRRTdBUUFMVHdCQkFFRUtFT1FCSTRFQkVPVUJRUUZCQ2hEa0FTT2lBVFlDQUVFRlFRb1E1QUVqa3dFMkFnQkJDVUVLRU9RQkkzODJBZ0JCRGtFS0VPUUJJNVlCTmdJQVFSTkJDaERrQVNPdEFUc0JBQXNuQUJEbUFSRG5BUkRvQVJEcEFSRHFBUkRyQVJEc0FSRHRBUkR1QVJEdkFSRHdBVUVBSkNNTEVnQWdBQzBBQUVFQVNnUkFRUUVQQzBFQUM1NEJBRUVBUVFBUTVBRXRBQUFrTkVFQlFRQVE1QUV0QUFBa05VRUNRUUFRNUFFdEFBQWtOa0VEUVFBUTVBRXRBQUFrTjBFRVFRQVE1QUV0QUFBa09FRUZRUUFRNUFFdEFBQWtPVUVHUVFBUTVBRXRBQUFrT2tFSFFRQVE1QUV0QUFBa08wRUlRUUFRNUFFdkFRQWtQRUVLUVFBUTVBRXZBUUFrUFVFTVFRQVE1QUVvQWdBa1BrRVJRUUFRNUFFUThnRWtQMEVTUVFBUTVBRVE4Z0VrUUFzcUFFRUFRUUVRNUFFb0FnQWtTRUVFUVFFUTVBRXRBQUFrZFVIRS9nTVFBeVJKUWNEK0F4QURFR01MTEFCQkFFRUNFT1FCRVBJQkpPa0JRUUZCQWhEa0FSRHlBU1RzQVVILy93TVFBeEI5UVkvK0F4QURFSHdMQ2dCQmdQNERFQU1RZXd0dUFFRUFRUVFRNUFFdkFRQWtMVUVDUVFRUTVBRXZBUUFrTVVFRVFRUVE1QUVROGdFa1FVRUZRUVFRNUFFUThnRWtRa0VHUVFRUTVBRVE4Z0VrUTBFSFFRUVE1QUVROGdFa1JFRUlRUVFRNUFFUThnRWtSVUVKUVFRUTVBRVE4Z0VrUmtFS1FRUVE1QUVROGdFa0xndEdBRUVBUVFVUTVBRW9BZ0FrY2tFRVFRVVE1QUVvQWdBa2RFRUlRUVVRNUFFb0FnQWtjMEdFL2dNUUF5UnRRWVgrQXhBREVIbEJodjRERUFNUWVrR0gvZ01RQXhBU0N3WUFRUUFrWFFzcEFFRUFRUVlRNUFFb0FnQWtXa0VFUVFZUTVBRXRBQUFrVzBFRlFRWVE1QUV0QUFBa1hCRDVBUXVDQVFCQkFFRUhFT1FCRVBJQkpIaEJBVUVIRU9RQktBSUFKSmdCUVFWQkJ4RGtBU2dDQUNTTEFVRUpRUWNRNUFFb0FnQWtka0VPUVFjUTVBRW9BZ0FramdGQkUwRUhFT1FCTFFBQUpPMEJRUlJCQnhEa0FTMEFBQ1NqQVVFWlFRY1E1QUVROGdFa2hBRkJHa0VIRU9RQktBSUFKSUlCUVI5QkJ4RGtBUzhCQUNTRkFRdGJBRUVBUVFnUTVBRVE4Z0VrZTBFQlFRZ1E1QUVvQWdBa25nRkJCVUVJRU9RQktBSUFKSThCUVFsQkNCRGtBU2dDQUNSNVFRNUJDQkRrQVNnQ0FDU1NBVUVUUVFnUTVBRXRBQUFrN2dGQkZFRUlFT1FCTFFBQUpLWUJDelFBUVFCQkNSRGtBUkR5QVNSK1FRRkJDUkRrQVNnQ0FDU2dBVUVGUVFrUTVBRW9BZ0FrZkVFSlFRa1E1QUV2QVFBa3FRRUxUd0JCQUVFS0VPUUJFUElCSklFQlFRRkJDaERrQVNnQ0FDU2lBVUVGUVFvUTVBRW9BZ0Fra3dGQkNVRUtFT1FCS0FJQUpIOUJEa0VLRU9RQktBSUFKSllCUVJOQkNoRGtBUzhCQUNTdEFRc25BQkR6QVJEMEFSRDFBUkQyQVJEM0FSRDRBUkQ2QVJEN0FSRDhBUkQ5QVJEK0FVRUFKQ01MREFBakl3UkFRUUVQQzBFQUMxOEJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVFKQUlBRkJBbXNPQmdNRUJRWUhDQUFMREFnTEk5TUJEd3NqMUFFUEN5UFZBUThMSTlZQkR3c2oyQUVQQ3lQWkFROExJOW9CRHdzajJ3RVBDMEVBQzRzQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQ1FRRkdEUUVDUUNBQ1FRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lBQlFRRnhKTk1CREFjTElBRkJBWEVrMUFFTUJnc2dBVUVCY1NUVkFRd0ZDeUFCUVFGeEpOWUJEQVFMSUFGQkFYRWsyQUVNQXdzZ0FVRUJjU1RaQVF3Q0N5QUJRUUZ4Sk5vQkRBRUxJQUZCQVhFazJ3RUxDd3NBUVFFazR3RkJCQkIwQzJRQkFuOUJBQ1JBSUFBUWdRSkZCRUJCQVNFQkN5QUFRUUVRZ2dJZ0FRUkFRUUFoQVNBQVFRTk1CRUJCQVNFQkN5UFNBUVIvSUFFRkk5SUJDeUlBQkVCQkFTRUNDeVBYQVFSL0lBRkZCU1BYQVFzaUFBUkFRUUVoQWdzZ0FnUkFFSU1DQ3dzTENRQWdBRUVBRUlJQ0M1b0JBQ0FBUVFCS0JFQkJBQkNFQWdWQkFCQ0ZBZ3NnQVVFQVNnUkFRUUVRaEFJRlFRRVFoUUlMSUFKQkFFb0VRRUVDRUlRQ0JVRUNFSVVDQ3lBRFFRQktCRUJCQXhDRUFnVkJBeENGQWdzZ0JFRUFTZ1JBUVFRUWhBSUZRUVFRaFFJTElBVkJBRW9FUUVFRkVJUUNCVUVGRUlVQ0N5QUdRUUJLQkVCQkJoQ0VBZ1ZCQmhDRkFnc2dCMEVBU2dSQVFRY1FoQUlGUVFjUWhRSUxDd1FBSXpRTEJBQWpOUXNFQUNNMkN3UUFJemNMQkFBak9Bc0VBQ001Q3dRQUl6b0xCQUFqT3dzRUFDTTlDd1FBSXp3THFRTUJDbjlCZ0pBQ0lRa2p3UUVFUUVHQWdBSWhDUXRCZ0xBQ0lRb2p3Z0VFUUVHQXVBSWhDZ3NDUUFOQUlBUkJnQUpPRFFFQ1FFRUFJUVVEUUNBRlFZQUNUZzBCSUFrZ0NpQUVRUU4xUVFWMGFpQUZRUU4xYWlJR1FRQVF2d0VReGdFaENDQUVRUWh2SVFGQkJ5QUZRUWh2YXlFSFFRQWhBaU12Qkg4Z0FFRUFTZ1VqTHdzaUF3UkFJQVpCQVJDL0FTRUNDMEVHSUFJUUVBUkFRUWNnQVdzaEFRdEJBQ0VEUVFNZ0FoQVFCRUJCQVNFREN5QUlJQUZCQVhScUlnWWdBeEMvQVNFSVFRQWhBU0FISUFaQkFXb2dBeEMvQVJBUUJFQkJBaUVCQ3lBSElBZ1FFQVJBSUFGQkFXb2hBUXNnQkVFSWRDQUZha0VEYkNFSEl5OEVmeUFBUVFCS0JTTXZDeUlEQkVCQkFDQUNRUWR4SUFGQkFCRElBU0lCRU1rQklRWkJBU0FCRU1rQklRTkJBaUFCRU1rQklRRWdCMEdBbUE1cUlnSWdCam9BQUNBQ1FRRnFJQU02QUFBZ0FrRUNhaUFCT2dBQUJTQUJRY2YrQTBFQUVNb0JJUUlDUUVFQUlRRURRQ0FCUVFOT0RRRWdCMEdBbUE1cUlBRnFJQUk2QUFBZ0FVRUJhaUVCREFBQUN3QUxDeUFGUVFGcUlRVU1BQUFMQUFzZ0JFRUJhaUVFREFBQUN3QUxDMGdBQWtBQ1FBSkFBa0FDUUNQdkFVRUthdzRFQVFJREJBQUxBQXRCQUNFS0MwRUFJUXNMUVg4aERBc2dBQ0FCSUFJZ0F5QUVJQVVnQmlBSElBZ2dDU0FLSUFzZ0RCRE1BUXZaQVFFR2Z3SkFBMEFnQWtFWFRnMEJBa0JCQUNFQUEwQWdBRUVmVGcwQlFRQWhCQ0FBUVE5S0JFQkJBU0VFQ3lBQ0lRRWdBa0VQU2dSQUlBRkJEMnNoQVFzZ0FVRUVkQ0VCSUFCQkQwb0VmeUFCSUFCQkQydHFCU0FCSUFCcUN5RUJRWUNBQWlFRklBSkJEMG9FUUVHQWtBSWhCUXNDUUVFQUlRTURRQ0FEUVFoT0RRRkJDeVR2QVNBQklBVWdCRUVBUVFjZ0F5QUFRUU4wSUFKQkEzUWdBMnBCK0FGQmdKZ2FRUUZCQUVFQUVKSUNHaUFEUVFGcUlRTU1BQUFMQUFzZ0FFRUJhaUVBREFBQUN3QUxJQUpCQVdvaEFnd0FBQXNBQ3dzVUFEOEFRWXNCU0FSQVFZc0JQd0JyUUFBYUN3c2RBQUpBQWtBQ1FDUHZBUTRDQVFJQUN3QUxRUUFoQUFzZ0FCQ1JBZ3NIQUNBQUpPOEJDd0Q4V2dSdVlXMWxBZlJhbHdJQUpXTnZjbVV2YldWdGIzSjVMMkpoYm10cGJtY3ZaMlYwVW05dFFtRnVhMEZrWkhKbGMzTUJKV052Y21VdmJXVnRiM0o1TDJKaGJtdHBibWN2WjJWMFVtRnRRbUZ1YTBGa1pISmxjM01DTjJOdmNtVXZiV1Z0YjNKNUwyMWxiVzl5ZVUxaGNDOW5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRREtXTnZjbVV2YldWdGIzSjVMMnh2WVdRdlpXbG5hSFJDYVhSTWIyRmtSbkp2YlVkQ1RXVnRiM0o1QkJwamIzSmxMMk53ZFM5amNIVXZhVzVwZEdsaGJHbDZaVU53ZFFVbVkyOXlaUzl0WlcxdmNua3ZiV1Z0YjNKNUwybHVhWFJwWVd4cGVtVkRZWEowY21sa1oyVUdLMk52Y21VdmJXVnRiM0o1TDNOMGIzSmxMMlZwWjJoMFFtbDBVM1J2Y21WSmJuUnZSMEpOWlcxdmNua0hIV052Y21VdmJXVnRiM0o1TDJSdFlTOXBibWwwYVdGc2FYcGxSRzFoQ0NsamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMmx1YVhScFlXeHBlbVZIY21Gd2FHbGpjd2tuWTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwybHVhWFJwWVd4cGVtVlFZV3hsZEhSbENpZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbWx1YVhScFlXeHBlbVVMSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWFXNXBkR2xoYkdsNlpRd25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTVwYm1sMGFXRnNhWHBsRFNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExtbHVhWFJwWVd4cGVtVU9NV052Y21VdmMyOTFibVF2WVdOamRXMTFiR0YwYjNJdmFXNXBkR2xoYkdsNlpWTnZkVzVrUVdOamRXMTFiR0YwYjNJUElHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmFXNXBkR2xoYkdsNlpWTnZkVzVrRUNGamIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndlkyaGxZMnRDYVhSUGJrSjVkR1VSTTJOdmNtVXZkR2x0WlhKekwzUnBiV1Z5Y3k5blpYUkdjbVZ4ZFdWdVkzbEdjbTl0U1c1d2RYUkRiRzlqYTFObGJHVmpkQklzWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTUxY0dSaGRHVlVhVzFsY2tOdmJuUnliMndUSTJOdmNtVXZkR2x0WlhKekwzUnBiV1Z5Y3k5cGJtbDBhV0ZzYVhwbFZHbHRaWEp6RkJSamIzSmxMMk52Y21VdmFXNXBkR2xoYkdsNlpSVVFZMjl5WlM5amIzSmxMMk52Ym1acFp4WWxZMjl5WlM5amNIVXZZM0IxTDBOd2RTNU5RVmhmUTFsRFRFVlRYMUJGVWw5R1VrRk5SUmNpWTI5eVpTOXdiM0owWVdKc1pTOXdiM0owWVdKc1pTOTFNVFpRYjNKMFlXSnNaUmdmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTluWlhSRVlYUmhRbmwwWlZSM2J4a2ZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW5aWFJFWVhSaFFubDBaVTl1WlJvalkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwyTnZibU5oZEdWdVlYUmxRbmwwWlhNYktHTnZjbVV2WTNCMUwyOXdZMjlrWlhNdloyVjBRMjl1WTJGMFpXNWhkR1ZrUkdGMFlVSjVkR1VjSUdOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5emNHeHBkRWhwWjJoQ2VYUmxIUjlqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2YzNCc2FYUk1iM2RDZVhSbEhpRmpiM0psTDIxbGJXOXllUzlpWVc1cmFXNW5MMmhoYm1Sc1pVSmhibXRwYm1jZktXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1WW1GMFkyaFFjbTlqWlhOelEzbGpiR1Z6SUMxamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMbTFoZUVaeVlXMWxVMlZ4ZFdWdVkyVkRlV05zWlhNaEtXTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRHVnVaM1JvSWlsamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlV4bGJtZDBhQ01wWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1MWNHUmhkR1ZNWlc1bmRHZ2tLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUR1Z1WjNSb0pTeGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMMmRsZEU1bGQwWnlaWEYxWlc1amVVWnliMjFUZDJWbGNDWXBZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzV6WlhSR2NtVnhkV1Z1WTNrbk1tTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZZMkZzWTNWc1lYUmxVM2RsWlhCQmJtUkRhR1ZqYTA5MlpYSm1iRzkzS0NoamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlZOM1pXVndLU3RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVVZ1ZG1Wc2IzQmxLaXRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5Wd1pHRjBaVVZ1ZG1Wc2IzQmxLeXRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5Wd1pHRjBaVVZ1ZG1Wc2IzQmxMQ1ZqYjNKbEwzTnZkVzVrTDNOdmRXNWtMM1Z3WkdGMFpVWnlZVzFsVTJWeGRXVnVZMlZ5TFM1amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuZHBiR3hEYUdGdWJtVnNWWEJrWVhSbExpcGpiM0psTDNOdmRXNWtMMkZqWTNWdGRXeGhkRzl5TDJScFpFTm9ZVzV1Wld4RVlXTkRhR0Z1WjJVdkxtTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkMmxzYkVOb1lXNXVaV3hWY0dSaGRHVXdMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1V4TG1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWQybHNiRU5vWVc1dVpXeFZjR1JoZEdVeUoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVjbVZ6WlhSVWFXMWxjak05WTI5eVpTOXpiM1Z1WkM5a2RYUjVMMmx6UkhWMGVVTjVZMnhsUTJ4dlkydFFiM05wZEdsMlpVOXlUbVZuWVhScGRtVkdiM0pYWVhabFptOXliVFFtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1blpYUlRZVzF3YkdVMU5tTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVaMlYwVTJGdGNHeGxSbkp2YlVONVkyeGxRMjkxYm5SbGNqWW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTV5WlhObGRGUnBiV1Z5TnlaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxtZGxkRk5oYlhCc1pUZzJZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTVuWlhSVFlXMXdiR1ZHY205dFEzbGpiR1ZEYjNWdWRHVnlPU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5KbGMyVjBWR2x0WlhJNkptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVaMlYwVTJGdGNHeGxPelpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG1kbGRGTmhiWEJzWlVaeWIyMURlV05zWlVOdmRXNTBaWEk4TzJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdVoyVjBUbTlwYzJWRGFHRnVibVZzUm5KbGNYVmxibU41VUdWeWFXOWtQU1pqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG1kbGRGTmhiWEJzWlQ0MlkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNW5aWFJUWVcxd2JHVkdjbTl0UTNsamJHVkRiM1Z1ZEdWeVB4eGpiM0psTDJOd2RTOWpjSFV2UTNCMUxrTk1UME5MWDFOUVJVVkVRQ3BqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMU52ZFc1a0xtMWhlRVJ2ZDI1VFlXMXdiR1ZEZVdOc1pYTkJJbU52Y21VdmNHOXlkR0ZpYkdVdmNHOXlkR0ZpYkdVdmFUTXlVRzl5ZEdGaWJHVkNLR052Y21VdmMyOTFibVF2YzI5MWJtUXZaMlYwVTJGdGNHeGxRWE5WYm5OcFoyNWxaRUo1ZEdWREltTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmJXbDRRMmhoYm01bGJGTmhiWEJzWlhORU0yTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmMyVjBUR1ZtZEVGdVpGSnBaMmgwVDNWMGNIVjBSbTl5UVhWa2FXOVJkV1YxWlVVbVkyOXlaUzl6YjNWdVpDOWhZMk4xYlhWc1lYUnZjaTloWTJOMWJYVnNZWFJsVTI5MWJtUkdIMk52Y21VdmMyOTFibVF2YzI5MWJtUXZZMkZzWTNWc1lYUmxVMjkxYm1SSEhHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmRYQmtZWFJsVTI5MWJtUklJbU52Y21VdmMyOTFibVF2YzI5MWJtUXZZbUYwWTJoUWNtOWpaWE56UVhWa2FXOUpKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUbEo0TUVvblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTFjR1JoZEdWT1VuZ3dTeWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURGTUoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRsSjRNVTBuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1MWNHUmhkR1ZPVW5neFRpZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMblZ3WkdGMFpVNVNlREZQSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE1sQW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUxY0dSaGRHVk9Vbmd5VVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlU1U2VESlNKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUbEo0TWxNblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNTFjR1JoZEdWT1VuZ3pWQ2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5Wd1pHRjBaVTVTZUROVkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkWEJrWVhSbFRsSjRNMVluWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTkM5RGFHRnVibVZzTkM1MWNHUmhkR1ZPVW5nelZ5ZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlRFJZSkdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRISnBaMmRsY2xrblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01pOURhR0Z1Ym1Wc01pNTFjR1JoZEdWT1VuZzBXaVJqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5SeWFXZG5aWEpiSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRYQmtZWFJsVGxKNE5Gd2tZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTUwY21sbloyVnlYU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5Wd1pHRjBaVTVTZURSZUpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkSEpwWjJkbGNsOGhZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1MWNHUmhkR1ZPVWpVd1lDRmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG5Wd1pHRjBaVTVTTlRGaElXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTW1Jc1kyOXlaUzl6YjNWdVpDOXlaV2RwYzNSbGNuTXZVMjkxYm1SU1pXZHBjM1JsY2xkeWFYUmxWSEpoY0hOakptTnZjbVV2WjNKaGNHaHBZM012YkdOa0wweGpaQzUxY0dSaGRHVk1ZMlJEYjI1MGNtOXNaQ0JqYjNKbEwyMWxiVzl5ZVM5a2JXRXZjM1JoY25SRWJXRlVjbUZ1YzJabGNtVWZZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM05sZEVKcGRFOXVRbmwwWldZblkyOXlaUzl0WlcxdmNua3ZaRzFoTDJkbGRFaGtiV0ZUYjNWeVkyVkdjbTl0VFdWdGIzSjVaeXhqYjNKbEwyMWxiVzl5ZVM5a2JXRXZaMlYwU0dSdFlVUmxjM1JwYm1GMGFXOXVSbkp2YlUxbGJXOXllV2doWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKbGMyVjBRbWwwVDI1Q2VYUmxhU3RqYjNKbEwzTnZkVzVrTDNKbFoybHpkR1Z5Y3k5VGIzVnVaRkpsWjJsemRHVnlVbVZoWkZSeVlYQnphaUZqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2WjJWMFNtOTVjR0ZrVTNSaGRHVnJKR052Y21VdmJXVnRiM0o1TDNKbFlXUlVjbUZ3Y3k5amFHVmphMUpsWVdSVWNtRndjMnd5WTI5eVpTOXRaVzF2Y25rdmJHOWhaQzlsYVdkb2RFSnBkRXh2WVdSR2NtOXRSMEpOWlcxdmNubFhhWFJvVkhKaGNITnRIR052Y21VdmJXVnRiM0o1TDJSdFlTOW9aRzFoVkhKaGJuTm1aWEp1SVdOdmNtVXZiV1Z0YjNKNUwyUnRZUzl6ZEdGeWRFaGtiV0ZVY21GdWMyWmxjbTh5WTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwzTjBiM0psVUdGc1pYUjBaVUo1ZEdWSmJsZGhjMjFOWlcxdmNubHdNR052Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5cGJtTnlaVzFsYm5SUVlXeGxkSFJsU1c1a1pYaEpabE5sZEhFdlkyOXlaUzluY21Gd2FHbGpjeTl3WVd4bGRIUmxMM2R5YVhSbFEyOXNiM0pRWVd4bGRIUmxWRzlOWlcxdmNubHlMR052Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXVZbUYwWTJoUWNtOWpaWE56UTNsamJHVnpjeWhqYjNKbEwzUnBiV1Z5Y3k5MGFXMWxjbk12WDJOb1pXTnJSR2wyYVdSbGNsSmxaMmx6ZEdWeWRDeGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OWZjbVZ4ZFdWemRFbHVkR1Z5Y25Wd2RIVXdZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRGUnBiV1Z5U1c1MFpYSnlkWEIwZGg5amIzSmxMM1JwYldWeWN5OTBhVzFsY25NdmRYQmtZWFJsVkdsdFpYSnpkeVZqYjNKbEwzUnBiV1Z5Y3k5MGFXMWxjbk12WW1GMFkyaFFjbTlqWlhOelZHbHRaWEp6ZUM5amIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlZHbHRaWEp6TG5Wd1pHRjBaVVJwZG1sa1pYSlNaV2RwYzNSbGNua3NZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMVJwYldWeWN5NTFjR1JoZEdWVWFXMWxja052ZFc1MFpYSjZLMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXVkWEJrWVhSbFZHbHRaWEpOYjJSMWJHOTdKbU52Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzlLYjNsd1lXUXVkWEJrWVhSbFNtOTVjR0ZrZkQ1amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5SmJuUmxjbkoxY0hSekxuVndaR0YwWlVsdWRHVnljblZ3ZEZKbGNYVmxjM1JsWkgwOFkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlNXNTBaWEp5ZFhCMGN5NTFjR1JoZEdWSmJuUmxjbkoxY0hSRmJtRmliR1ZrZmlaamIzSmxMMjFsYlc5eWVTOTNjbWwwWlZSeVlYQnpMMk5vWldOclYzSnBkR1ZVY21Gd2MzODBZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZaV2xuYUhSQ2FYUlRkRzl5WlVsdWRHOUhRazFsYlc5eWVWZHBkR2hVY21Gd2M0QUJHV052Y21VdlkzQjFMMlpzWVdkekwzTmxkRVpzWVdkQ2FYU0JBUjlqYjNKbEwyTndkUzltYkdGbmN5OXpaWFJJWVd4bVEyRnljbmxHYkdGbmdnRXZZMjl5WlM5amNIVXZabXhoWjNNdlkyaGxZMnRCYm1SVFpYUkZhV2RvZEVKcGRFaGhiR1pEWVhKeWVVWnNZV2VEQVJwamIzSmxMMk53ZFM5bWJHRm5jeTl6WlhSYVpYSnZSbXhoWjRRQkhtTnZjbVV2WTNCMUwyWnNZV2R6TDNObGRGTjFZblJ5WVdOMFJteGhaNFVCRzJOdmNtVXZZM0IxTDJac1lXZHpMM05sZEVOaGNuSjVSbXhoWjRZQklXTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXliM1JoZEdWQ2VYUmxUR1ZtZEljQk5tTnZjbVV2YldWdGIzSjVMM04wYjNKbEwzTnBlSFJsWlc1Q2FYUlRkRzl5WlVsdWRHOUhRazFsYlc5eWVWZHBkR2hVY21Gd2M0Z0JOR052Y21VdlkzQjFMMlpzWVdkekwyTm9aV05yUVc1a1UyVjBVMmw0ZEdWbGJrSnBkRVpzWVdkelFXUmtUM1psY21ac2IzZUpBU0pqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2Y205MFlYUmxRbmwwWlZKcFoyaDBpZ0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVd2VJc0JHMk52Y21VdlkzQjFMMlpzWVdkekwyZGxkRU5oY25KNVJteGhaNHdCTFdOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5eWIzUmhkR1ZDZVhSbFRHVm1kRlJvY205MVoyaERZWEp5ZVkwQklXTnZjbVV2Y0c5eWRHRmliR1V2Y0c5eWRHRmliR1V2YVRoUWIzSjBZV0pzWlk0QkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl5Wld4aGRHbDJaVXAxYlhDUEFTNWpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZjbTkwWVhSbFFubDBaVkpwWjJoMFZHaHliM1ZuYUVOaGNuSjVrQUVmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVeGVKRUJHbU52Y21VdlkzQjFMMlpzWVdkekwyZGxkRnBsY205R2JHRm5rZ0VmWTI5eVpTOWpjSFV2Wm14aFozTXZaMlYwU0dGc1prTmhjbko1Um14aFo1TUJIbU52Y21VdlkzQjFMMlpzWVdkekwyZGxkRk4xWW5SeVlXTjBSbXhoWjVRQkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxNbmlWQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUTjRsZ0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVMGVKY0JIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTlhpWUFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVFo0bVFFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTNlSm9CSzJOdmNtVXZZM0IxTDJac1lXZHpMMk5vWldOclFXNWtVMlYwUldsbmFIUkNhWFJEWVhKeWVVWnNZV2ViQVNKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZZV1JrUVZKbFoybHpkR1Z5bkFFdVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMMkZrWkVGVWFISnZkV2RvUTJGeWNubFNaV2RwYzNSbGNwMEJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsT0hpZUFTSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzNWaVFWSmxaMmx6ZEdWeW53RXVZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNOMVlrRlVhSEp2ZFdkb1EyRnljbmxTWldkcGMzUmxjcUFCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE9YaWhBU0pqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdllXNWtRVkpsWjJsemRHVnlvZ0VpWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzaHZja0ZTWldkcGMzUmxjcU1CSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFFYaWtBU0ZqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmIzSkJVbVZuYVhOMFpYS2xBU0ZqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdlkzQkJVbVZuYVhOMFpYS21BUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVKNHB3RXJZMjl5WlM5dFpXMXZjbmt2Ykc5aFpDOXphWGgwWldWdVFtbDBURzloWkVaeWIyMUhRazFsYlc5eWVhZ0JLR052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5eWIzUmhkR1ZTWldkcGMzUmxja3hsWm5TcEFTbGpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSlNhV2RvZEtvQk5HTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl5YjNSaGRHVlNaV2RwYzNSbGNreGxablJVYUhKdmRXZG9RMkZ5Y25tckFUVmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSlNhV2RvZEZSb2NtOTFaMmhEWVhKeWVhd0JKMk52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRXhsWm5SU1pXZHBjM1JsY3EwQk1tTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6YUdsbWRGSnBaMmgwUVhKcGRHaHRaWFJwWTFKbFoybHpkR1Z5cmdFclkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM04zWVhCT2FXSmliR1Z6VDI1U1pXZHBjM1JsY3E4QkwyTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6YUdsbWRGSnBaMmgwVEc5bmFXTmhiRkpsWjJsemRHVnlzQUVuWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzUmxjM1JDYVhSUGJsSmxaMmx6ZEdWeXNRRW1ZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNObGRFSnBkRTl1VW1WbmFYTjBaWEt5QVNGamIzSmxMMk53ZFM5allrOXdZMjlrWlhNdmFHRnVaR3hsUTJKUGNHTnZaR1d6QVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pVTjR0QUVvWTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12YzJWMFNXNTBaWEp5ZFhCMGM3VUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsUkhpMkFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVVY0dHdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkdlTGdCSG1OdmNtVXZZM0IxTDI5d1kyOWtaWE12WlhobFkzVjBaVTl3WTI5a1pia0JPbU52Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMMGx1ZEdWeWNuVndkSE11WVhKbFNXNTBaWEp5ZFhCMGMxQmxibVJwYm1lNkFTMWpiM0psTDIxbGJXOXllUzl6ZEc5eVpTOXphWGgwWldWdVFtbDBVM1J2Y21WSmJuUnZSMEpOWlcxdmNubTdBU3RqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlmYUdGdVpHeGxTVzUwWlhKeWRYQjB2QUVxWTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12WTJobFkydEpiblJsY25KMWNIUnp2UUUzWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OUhjbUZ3YUdsamN5NU5RVmhmUTFsRFRFVlRYMUJGVWw5VFEwRk9URWxPUmI0Qk1tTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012UjNKaGNHaHBZM011WW1GMFkyaFFjbTlqWlhOelEzbGpiR1Z6dndFblkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlzYjJGa1JuSnZiVlp5WVcxQ1lXNXJ3QUVuWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OW5aWFJTWjJKUWFYaGxiRk4wWVhKMHdRRW1ZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5elpYUlFhWGhsYkU5dVJuSmhiV1hDQVNSamIzSmxMMmR5WVhCb2FXTnpMM0J5YVc5eWFYUjVMMmRsZEZCcGVHVnNVM1JoY25UREFTcGpiM0psTDJkeVlYQm9hV056TDNCeWFXOXlhWFI1TDJkbGRGQnlhVzl5YVhSNVptOXlVR2w0Wld6RUFTcGpiM0psTDJkeVlYQm9hV056TDNCeWFXOXlhWFI1TDJGa1pGQnlhVzl5YVhSNVptOXlVR2w0Wld6RkFUcGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQweHBibVZQWmxScGJHVkdjbTl0Vkdsc1pVTmhZMmhseGdFbVkyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OW5aWFJVYVd4bFJHRjBZVUZrWkhKbGMzUEhBVE5qYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmJHOWhaRkJoYkdWMGRHVkNlWFJsUm5KdmJWZGhjMjFOWlcxdmNubklBU3hqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdloyVjBVbWRpUTI5c2IzSkdjbTl0VUdGc1pYUjBaY2tCTG1OdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOW5aWFJEYjJ4dmNrTnZiWEJ2Ym1WdWRFWnliMjFTWjJMS0FUTmpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2WjJWMFRXOXViMk5vY205dFpVTnZiRzl5Um5KdmJWQmhiR1YwZEdYTEFTVmpiM0psTDJkeVlYQm9hV056TDNScGJHVnpMMmRsZEZScGJHVlFhWGhsYkZOMFlYSjB6QUVzWTI5eVpTOW5jbUZ3YUdsamN5OTBhV3hsY3k5a2NtRjNVR2w0Wld4elJuSnZiVXhwYm1WUFpsUnBiR1hOQVRkamIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDB4cGJtVlBabFJwYkdWR2NtOXRWR2xzWlVsa3pnRTNZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDJSeVlYZERiMnh2Y2xCcGVHVnNSbkp2YlZScGJHVkpaTThCUEdOdmNtVXZaM0poY0docFkzTXZZbUZqYTJkeWIzVnVaRmRwYm1SdmR5OWtjbUYzVFc5dWIyTm9jbTl0WlZCcGVHVnNSbkp2YlZScGJHVkpaTkFCTzJOdmNtVXZaM0poY0docFkzTXZZbUZqYTJkeWIzVnVaRmRwYm1SdmR5OWtjbUYzUW1GamEyZHliM1Z1WkZkcGJtUnZkMU5qWVc1c2FXNWwwUUV2WTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wzSmxibVJsY2tKaFkydG5jbTkxYm1UU0FTdGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2Y21WdVpHVnlWMmx1Wkc5MzB3RWpZMjl5WlM5bmNtRndhR2xqY3k5emNISnBkR1Z6TDNKbGJtUmxjbE53Y21sMFpYUFVBU1JqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwxOWtjbUYzVTJOaGJteHBibVhWQVNsamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMTl5Wlc1a1pYSkZiblJwY21WR2NtRnRaZFlCSjJOdmNtVXZaM0poY0docFkzTXZjSEpwYjNKcGRIa3ZZMnhsWVhKUWNtbHZjbWwwZVUxaGNOY0JJbU52Y21VdlozSmhjR2hwWTNNdmRHbHNaWE12Y21WelpYUlVhV3hsUTJGamFHWFlBVHRqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxrMUpUbDlEV1VOTVJWTmZVMUJTU1ZSRlUxOU1RMFJmVFU5RVJka0JRV052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVRVbE9YME5aUTB4RlUxOVVVa0ZPVTBaRlVsOUVRVlJCWDB4RFJGOU5UMFJGMmdFdVkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmNtVnhkV1Z6ZEV4alpFbHVkR1Z5Y25Wd2ROc0JJR052Y21VdmJXVnRiM0o1TDJSdFlTOTFjR1JoZEdWSVlteGhibXRJWkcxaDNBRXhZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRGWkNiR0Z1YTBsdWRHVnljblZ3ZE4wQkhtTnZjbVV2WjNKaGNHaHBZM012YkdOa0wzTmxkRXhqWkZOMFlYUjFjOTRCSldOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZkWEJrWVhSbFIzSmhjR2hwWTNQZkFTdGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDJKaGRHTm9VSEp2WTJWemMwZHlZWEJvYVdOejRBRVZZMjl5WlM5amIzSmxMMlY0WldOMWRHVlRkR1Z3NFFFV1kyOXlaUzlqYjNKbEwyVjRaV04xZEdWR2NtRnRaZUlCTUdOdmNtVXZjMjkxYm1RdmMyOTFibVF2WjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGN1TUJJMk52Y21VdlkyOXlaUzlsZUdWamRYUmxSbkpoYldWQmJtUkRhR1ZqYTBGMVpHbHY1QUVpWTI5eVpTOWpiM0psTDJkbGRGTmhkbVZUZEdGMFpVMWxiVzl5ZVU5bVpuTmxkT1VCTW1OdmNtVXZiV1Z0YjNKNUwzTjBiM0psTDNOMGIzSmxRbTl2YkdWaGJrUnBjbVZqZEd4NVZHOVhZWE50VFdWdGIzSjU1Z0VhWTI5eVpTOWpjSFV2WTNCMUwwTndkUzV6WVhabFUzUmhkR1huQVNsamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMGR5WVhCb2FXTnpMbk5oZG1WVGRHRjBaZWdCTDJOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDBsdWRHVnljblZ3ZEhNdWMyRjJaVk4wWVhSbDZRRWpZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMMHB2ZVhCaFpDNXpZWFpsVTNSaGRHWHFBU05qYjNKbEwyMWxiVzl5ZVM5dFpXMXZjbmt2VFdWdGIzSjVMbk5oZG1WVGRHRjBaZXNCSTJOdmNtVXZkR2x0WlhKekwzUnBiV1Z5Y3k5VWFXMWxjbk11YzJGMlpWTjBZWFJsN0FFZ1kyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5VGIzVnVaQzV6WVhabFUzUmhkR1h0QVNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuTmhkbVZUZEdGMFplNEJKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1YzJGMlpWTjBZWFJsN3dFbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NXpZWFpsVTNSaGRHWHdBU1pqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5OaGRtVlRkR0YwWmZFQkUyTnZjbVV2WTI5eVpTOXpZWFpsVTNSaGRHWHlBVEpqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMMnh2WVdSQ2IyOXNaV0Z1UkdseVpXTjBiSGxHY205dFYyRnpiVTFsYlc5eWVmTUJHbU52Y21VdlkzQjFMMk53ZFM5RGNIVXViRzloWkZOMFlYUmw5QUVwWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OUhjbUZ3YUdsamN5NXNiMkZrVTNSaGRHWDFBUzlqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlKYm5SbGNuSjFjSFJ6TG14dllXUlRkR0YwWmZZQkkyTnZjbVV2YW05NWNHRmtMMnB2ZVhCaFpDOUtiM2x3WVdRdWJHOWhaRk4wWVhSbDl3RWpZMjl5WlM5dFpXMXZjbmt2YldWdGIzSjVMMDFsYlc5eWVTNXNiMkZrVTNSaGRHWDRBU05qYjNKbEwzUnBiV1Z5Y3k5MGFXMWxjbk12VkdsdFpYSnpMbXh2WVdSVGRHRjBaZmtCSVdOdmNtVXZjMjkxYm1RdmMyOTFibVF2WTJ4bFlYSkJkV1JwYjBKMVptWmxjdm9CSUdOdmNtVXZjMjkxYm1RdmMyOTFibVF2VTI5MWJtUXViRzloWkZOMFlYUmwrd0VtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1c2IyRmtVM1JoZEdYOEFTWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbXh2WVdSVGRHRjBaZjBCSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWJHOWhaRk4wWVhSbC9nRW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVzYjJGa1UzUmhkR1gvQVJOamIzSmxMMk52Y21VdmJHOWhaRk4wWVhSbGdBSVlZMjl5WlM5amIzSmxMMmhoYzBOdmNtVlRkR0Z5ZEdWa2dRSTBZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMMTluWlhSS2IzbHdZV1JDZFhSMGIyNVRkR0YwWlVaeWIyMUNkWFIwYjI1SlpJSUNOR052Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzlmYzJWMFNtOTVjR0ZrUW5WMGRHOXVVM1JoZEdWR2NtOXRRblYwZEc5dVNXU0RBakZqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTl5WlhGMVpYTjBTbTk1Y0dGa1NXNTBaWEp5ZFhCMGhBSWxZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMMTl3Y21WemMwcHZlWEJoWkVKMWRIUnZib1VDSjJOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5ZmNtVnNaV0Z6WlVwdmVYQmhaRUoxZEhSdmJvWUNJV052Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzl6WlhSS2IzbHdZV1JUZEdGMFpZY0NJV052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGSmxaMmx6ZEdWeVFZZ0NJV052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGSmxaMmx6ZEdWeVFva0NJV052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGSmxaMmx6ZEdWeVE0b0NJV052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGSmxaMmx6ZEdWeVJJc0NJV052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGSmxaMmx6ZEdWeVJZd0NJV052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGSmxaMmx6ZEdWeVNJMENJV052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGSmxaMmx6ZEdWeVRJNENJV052Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGSmxaMmx6ZEdWeVJvOENKbU52Y21VdlpHVmlkV2N2WkdWaWRXY3RZM0IxTDJkbGRGQnliMmR5WVcxRGIzVnVkR1Z5a0FJa1kyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVTNSaFkydFFiMmx1ZEdWeWtRSTNZMjl5WlM5a1pXSjFaeTlrWldKMVp5MW5jbUZ3YUdsamN5OWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllWklDTjJOdmNtVXZaM0poY0docFkzTXZkR2xzWlhNdlpISmhkMUJwZUdWc2MwWnliMjFNYVc1bFQyWlVhV3hsZkhSeVlXMXdiMnhwYm1XVEFqSmpiM0psTDJSbFluVm5MMlJsWW5WbkxXZHlZWEJvYVdOekwyUnlZWGRVYVd4bFJHRjBZVlJ2VjJGemJVMWxiVzl5ZVpRQ0JYTjBZWEowbFFKQ1kyOXlaUzlrWldKMVp5OWtaV0oxWnkxbmNtRndhR2xqY3k5a2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVYeDBjbUZ0Y0c5c2FXNWxsZ0lJZm5ObGRHRnlaMk1BUGhCemIzVnlZMlZOWVhCd2FXNW5WVkpNTEdSbGJXOHZaR1ZpZFdkblpYSXZZWE56WlhSekwyTnZjbVV1ZFc1MGIzVmphR1ZrTG5kaGMyMHViV0Z3Iik6CiJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvd3x8InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZj9hd2FpdCBGKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmZoQmdDWDkvZjM5L2YzOS9md0JnQUFCZ0FYOEJmMkFDZjM4QVlBRi9BR0FDZjM4QmYyQUFBWDlnQkg5L2YzOEJmMkFEZjM5L0FHQURmMzkvQVg5Z0JuOS9mMzkvZndCZ0IzOS9mMzkvZjM4QmYyQUVmMzkvZndCZ0RYOS9mMzkvZjM5L2YzOS9mMzhCZjJBSGYzOS9mMzkvZndCZ0NIOS9mMzkvZjM5L0FBT1pBcGNDQWdJQ0FnRUJBd0VCQVFFQkFRRUJBUVVHQkFFQkFBWUNCZ1lGQmdJQ0F3WUdBUUVCQVFZRUFRRUJBUUVDQWdJQ0FnSUJCUUlHQVFJR0FRSUdCZ0lHQmdZQ0JRY0lCQVFFQVFRRUJBUUVCQVFFQkFRRUJBUUVCQUVFQVFRQkJBRUVCQVFGQkFRRkJnWUZBZ1lDQWdnRUNBTURCZ1FFQVFRQkJBUUVCQVFFQlFNRkJBTUVCQVFDQXdnQ0FnWUNBZ1FDQWdZR0JnSUNBZ0lDQWdNRUJBSUVCQUlFQkFJRUJBSUNBZ0lDQWdJQ0FnSUZDUUlDQkFJQ0FnSUdBd1FHQmdZRkJRd0ZCUXdMQlFVSkJRa0pEUXNPQ2dvSUNBTUVBUUVCQmdZQkFRRUJCQUVHQmdZQ0JRTUJBUUVCQVFFQkFRRUJBUUVDQVFFQkFRRUJBUUVCQVFFQkFRWUNBd0VFQkE4R0JnWUdCZ1lHQmdZR0JBMEJBUVFFQlFNQkFBQUc2UXIrQVg4QVFRQUxmd0JCZ0lDc0JBdC9BRUdMQVF0L0FFRUFDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBUUMzOEFRZi8vQXd0L0FFR0FFQXQvQUVHQWdBRUxmd0JCZ0pBQkMzOEFRWUNBQWd0L0FFR0FrQU1MZndCQmdJQUJDMzhBUVlDUUJBdC9BRUdBNkI4TGZ3QkJnSkFFQzM4QVFZQUVDMzhBUVlDZ0JBdC9BRUdBdUFFTGZ3QkJnTmdGQzM4QVFZRFlCUXQvQUVHQW1BNExmd0JCZ0lBTUMzOEFRWUNZR2d0L0FFR0FnQWtMZndCQmdKZ2pDMzhBUVlEZ0FBdC9BRUdBK0NNTGZ3QkJnSUFJQzM4QVFZRDRLd3QvQUVHQWdBZ0xmd0JCZ1BnekMzOEFRWUNJK0FNTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhQL2dNTGZ3RkJBQXQvQVVIdy9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmdBSUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVHQTl3SUxmd0ZCZ0lBSUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSFYvZ01MZndGQkFBdC9BVUhSL2dNTGZ3RkIwdjREQzM4QlFkUCtBd3QvQVVIVS9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZWorQXd0L0FVSHIvZ01MZndGQjZmNERDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVGL0MzOEJRWDhMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFR0FnS3dFQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFmLy9Bd3QvQUVHQWtBUUxmd0JCZ0pBRUMzOEFRWUFFQzM4QVFZRFlCUXQvQUVHQW1BNExmd0JCZ0pnYUMzOEFRWUQ0SXd0L0FFR0ErQ3NMZndCQmdQZ3pDd2ZqRFU4R2JXVnRiM0o1QWdBR1kyOXVabWxuQUJVTVpYaGxZM1YwWlVaeVlXMWxBT0VCR1dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzhBNHdFTFpYaGxZM1YwWlZOMFpYQUE0QUVKYzJGMlpWTjBZWFJsQVBFQkNXeHZZV1JUZEdGMFpRRC9BUTVvWVhORGIzSmxVM1JoY25SbFpBQ0FBZzV6WlhSS2IzbHdZV1JUZEdGMFpRQ0dBaDluWlhST2RXMWlaWEpQWmxOaGJYQnNaWE5KYmtGMVpHbHZRblZtWm1WeUFPSUJFR05zWldGeVFYVmthVzlDZFdabVpYSUErUUVYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERBQk5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXdFU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF3SWVRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdNYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREJCWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdVU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3WWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJ4eEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2dTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdrT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQ2hGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNTERWZFBVa3RmVWtGTlgxTkpXa1VERENaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTU5JazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVUREaGhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNEREeFJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNUUZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9BeEVRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1TR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01URkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF4UU9SbEpCVFVWZlRFOURRVlJKVDA0REZRcEdVa0ZOUlY5VFNWcEZBeFlYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERGeE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhnU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4a09WRWxNUlY5RVFWUkJYMU5KV2tVREdoSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERHdzVQUVUxZlZFbE1SVk5mVTBsYVJRTWNGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZEVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF4NFdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNZkVrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTWdGa05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0RElSSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURJaUZuWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUUFBZ3huWlhSU1pXZHBjM1JsY2tFQWh3SU1aMlYwVW1WbmFYTjBaWEpDQUlnQ0RHZGxkRkpsWjJsemRHVnlRd0NKQWd4blpYUlNaV2RwYzNSbGNrUUFpZ0lNWjJWMFVtVm5hWE4wWlhKRkFJc0NER2RsZEZKbFoybHpkR1Z5U0FDTUFneG5aWFJTWldkcGMzUmxja3dBalFJTVoyVjBVbVZuYVhOMFpYSkdBSTRDRVdkbGRGQnliMmR5WVcxRGIzVnVkR1Z5QUk4Q0QyZGxkRk4wWVdOclVHOXBiblJsY2dDUUFobG5aWFJQY0dOdlpHVkJkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFCa0lYM05sZEdGeVoyTUFsZ0lkWkhKaGQwSmhZMnRuY205MWJtUk5ZWEJVYjFkaGMyMU5aVzF2Y25rQWxRSVlaSEpoZDFScGJHVkVZWFJoVkc5WFlYTnRUV1Z0YjNKNUFKTUNCblZ3WkdGMFpRRGhBUTFsYlhWc1lYUnBiMjVUZEdWd0FPQUJFbWRsZEVGMVpHbHZVWFZsZFdWSmJtUmxlQURpQVE5eVpYTmxkRUYxWkdsdlVYVmxkV1VBK1FFT2QyRnpiVTFsYlc5eWVWTnBlbVVEOEFFY2QyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVk1iMk5oZEdsdmJnUHhBUmgzWVhOdFFtOTVTVzUwWlhKdVlXeFRkR0YwWlZOcGVtVUQ4Z0VkWjJGdFpVSnZlVWx1ZEdWeWJtRnNUV1Z0YjNKNVRHOWpZWFJwYjI0RDh3RVpaMkZ0WlVKdmVVbHVkR1Z5Ym1Gc1RXVnRiM0o1VTJsNlpRUDBBUk4yYVdSbGIwOTFkSEIxZEV4dlkyRjBhVzl1QS9VQkltWnlZVzFsU1c1UWNtOW5jbVZ6YzFacFpHVnZUM1YwY0hWMFRHOWpZWFJwYjI0RCtBRWJaMkZ0WldKdmVVTnZiRzl5VUdGc1pYUjBaVXh2WTJGMGFXOXVBL1lCRjJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWVGFYcGxBL2NCRldKaFkydG5jbTkxYm1STllYQk1iMk5oZEdsdmJnUDVBUXQwYVd4bFJHRjBZVTFoY0FQNkFSTnpiM1Z1WkU5MWRIQjFkRXh2WTJGMGFXOXVBL3NCRVdkaGJXVkNlWFJsYzB4dlkyRjBhVzl1QS8wQkZHZGhiV1ZTWVcxQ1lXNXJjMHh2WTJGMGFXOXVBL3dCQ0FLVUFnclZ4UUdYQWlzQkFuOGpMU0VCSXk1RklnSUVRQ0FCUlNFQ0N5QUNCRUJCQVNFQkN5QUJRUTUwSUFCQmdJQUJhMm9MRHdBak1VRU5kQ0FBUVlEQUFtdHFDN2NCQVFKL0FrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFTWRTSUNJUUVnQWtVTkFBSkFJQUZCQVdzT0RRRUJBUUlDQWdJREF3UUVCUVlBQ3d3R0N5QUFRWUQ0TTJvUEN5QUFFQUJCZ1BnemFnOExRUUFoQVNNdkJFQWpNQkFEUVFGeElRRUxJQUJCZ0pCK2FpQUJRUTEwYWc4TElBQVFBVUdBK0N0cUR3c2dBRUdBa0g1cUR3dEJBQ0VCSXk4RVFDTXlFQU5CQjNFaEFRc2dBVUVCU0FSQVFRRWhBUXNnQUNBQlFReDBha0dBOEgxcUR3c2dBRUdBVUdvTENRQWdBQkFDTFFBQUM1RUJBRUVBSkROQkFDUTBRUUFrTlVFQUpEWkJBQ1EzUVFBa09FRUFKRGxCQUNRNlFRQWtPMEVBSkR4QkFDUTlRUUFrUGtFQUpEOUJBQ1JBSXk4RVFFRVJKRFJCZ0FFa08wRUFKRFZCQUNRMlFmOEJKRGRCMWdBa09FRUFKRGxCRFNRNkJVRUJKRFJCc0FFa08wRUFKRFZCRXlRMlFRQWtOMEhZQVNRNFFRRWtPVUhOQUNRNkMwR0FBaVE5UWY3L0F5UThDNlFCQVFKL1FRQWtRVUVCSkVKQnh3SVFBeUVCUVFBa1EwRUFKRVJCQUNSRlFRQWtSa0VBSkM0Z0FRUkFJQUZCQVU0aUFBUkFJQUZCQTB3aEFBc2dBQVJBUVFFa1JBVWdBVUVGVGlJQUJFQWdBVUVHVENFQUN5QUFCRUJCQVNSRkJTQUJRUTlPSWdBRVFDQUJRUk5NSVFBTElBQUVRRUVCSkVZRklBRkJHVTRpQUFSQUlBRkJIa3doQUFzZ0FBUkFRUUVrTGdzTEN3c0ZRUUVrUXd0QkFTUXRRUUFrTVFzTEFDQUFFQUlnQVRvQUFBc3ZBRUhSL2dOQi93RVFCa0hTL2dOQi93RVFCa0hUL2dOQi93RVFCa0hVL2dOQi93RVFCa0hWL2dOQi93RVFCZ3VZQVFCQkFDUkhRUUFrU0VFQUpFbEJBQ1JLUVFBa1MwRUFKRXhCQUNSTkl5OEVRRUdSQVNSSlFjRCtBMEdSQVJBR1FjSCtBMEdCQVJBR1FjVCtBMEdRQVJBR1FjZitBMEg4QVJBR0JVR1JBU1JKUWNEK0EwR1JBUkFHUWNIK0EwR0ZBUkFHUWNiK0EwSC9BUkFHUWNmK0EwSDhBUkFHUWNqK0EwSC9BUkFHUWNuK0EwSC9BUkFHQzBIUC9nTkJBQkFHUWZEK0EwRUJFQVlMVHdBakx3UkFRZWorQTBIQUFSQUdRZW4rQTBIL0FSQUdRZXIrQTBIQkFSQUdRZXYrQTBFTkVBWUZRZWorQTBIL0FSQUdRZW4rQTBIL0FSQUdRZXIrQTBIL0FSQUdRZXYrQTBIL0FSQUdDd3N2QUVHUS9nTkJnQUVRQmtHUi9nTkJ2d0VRQmtHUy9nTkI4d0VRQmtHVC9nTkJ3UUVRQmtHVS9nTkJ2d0VRQmdzc0FFR1YvZ05CL3dFUUJrR1cvZ05CUHhBR1FaZitBMEVBRUFaQm1QNERRUUFRQmtHWi9nTkJ1QUVRQmdzeUFFR2EvZ05CL3dBUUJrR2IvZ05CL3dFUUJrR2MvZ05CbndFUUJrR2QvZ05CQUJBR1FaNytBMEc0QVJBR1FRRWtYZ3N0QUVHZi9nTkIvd0VRQmtHZy9nTkIvd0VRQmtHaC9nTkJBQkFHUWFMK0EwRUFFQVpCby80RFFiOEJFQVlMT0FCQkR5UmZRUThrWUVFUEpHRkJEeVJpUVFBa1kwRUFKR1JCQUNSbFFRQWtaa0gvQUNSblFmOEFKR2hCQVNScFFRRWtha0VBSkdzTFp3QkJBQ1JPUVFBa1QwRUFKRkJCQVNSUlFRRWtVa0VCSkZOQkFTUlVRUUVrVlVFQkpGWkJBU1JYUVFFa1dFRUJKRmxCQUNSYVFRQWtXMEVBSkZ4QkFDUmRFQW9RQ3hBTUVBMUJwUDREUWZjQUVBWkJwZjREUWZNQkVBWkJwdjREUWZFQkVBWVFEZ3NOQUNBQlFRRWdBSFJ4UVFCSEMya0JBbjlCZ0FJaEFDTXpCRUJCZ0FRaEFBc0NRQUpBQWtBamNTSUJCRUFnQVVFQlJnMEJJQUZCQWtZTkFnd0RDMEdBQ0NFQUl6TUVRRUdBRUNFQUN5QUFEd3RCRUNFQUl6TUVRRUVnSVFBTElBQVBDMEhBQUNFQUl6TUVRRUgrQUNFQUN5QUFEd3NnQUFzZ0FFRUNJQUFRRUNSd0kzQkZCRUFQQ3lBQVFRTnhKSEZCQUNSeUVCRWtkQXRRQUVFQUpHeEJBQ1J0UVFBa2JrRUFKRzlCQUNSd1FRQWtjVUVBSkhKQkFDUnpJeThFUUVHRS9nTkJMeEFHUVM4a2JRVkJoUDREUWFzQkVBWkJxd0VrYlF0QmgvNERRZmdCRUFaQitBRVFFZ3ZKQVFFQ2YwSERBaEFESWdGQndBRkdJZ0JGQkVBakpRUi9JQUZCZ0FGR0JTTWxDeUVBQ3lBQUJFQkJBU1F2QlVFQUpDOExFQVFRQlJBSEVBZ1FDUkFQRUJNakx3UkFRZkQrQTBINEFSQUdRYy8rQTBIK0FSQUdRYzMrQTBIK0FCQUdRWUQrQTBIUEFSQUdRWUwrQTBIOEFCQUdRWS8rQTBIaEFSQUdRZXorQTBIK0FSQUdRZlgrQTBHUEFSQUdCVUh3L2dOQi93RVFCa0hQL2dOQi93RVFCa0hOL2dOQi93RVFCa0dBL2dOQnp3RVFCa0dDL2dOQi9nQVFCa0dQL2dOQjRRRVFCZ3RCQUNRakM1MEJBQ0FBUVFCS0JFQkJBU1FrQlVFQUpDUUxJQUZCQUVvRVFFRUJKQ1VGUVFBa0pRc2dBa0VBU2dSQVFRRWtKZ1ZCQUNRbUN5QURRUUJLQkVCQkFTUW5CVUVBSkNjTElBUkJBRW9FUUVFQkpDZ0ZRUUFrS0FzZ0JVRUFTZ1JBUVFFa0tRVkJBQ1FwQ3lBR1FRQktCRUJCQVNRcUJVRUFKQ29MSUFkQkFFb0VRRUVCSkNzRlFRQWtLd3NnQ0VFQVNnUkFRUUVrTEFWQkFDUXNDeEFVQ3hBQUl6TUVRRUdneVFnUEMwSFFwQVFMQ1FBZ0FFSC8vd054Q3dzQUl6MUJBV29RRnhBREN3WUFJejBRQXdzU0FDQUFRZjhCY1VFSWRDQUJRZjhCY1hJTEVBQVFHRUgvQVhFUUdVSC9BWEVRR2dzTUFDQUFRWUQrQTNGQkNIVUxDQUFnQUVIL0FYRUw3QUlCQW44alF3UkFEd3NnQUVIL1Awd0VRQ05GQkg5QkJDQUJRZjhCY1JBUVJRVWpSUXNpQUVVRVFDQUJRUTl4SWdJRVFDQUNRUXBHQkVCQkFTUkJDd1ZCQUNSQkN3c0ZJQUJCLy84QVRBUkFJeTVGSWdKRkJFQWdBRUgvM3dCTUlRSUxJQUlFUUNORkJFQWdBVUVQY1NRdEN5QUJJUUlqUkFSQUlBSkJIM0VoQWlNdFFlQUJjU1F0QlNOR0JFQWdBa0gvQUhFaEFpTXRRWUFCY1NRdEJTTXVCRUJCQUNRdEN3c0xJeTBnQW5Ja0xRVkJBQ0VDSXkwUUhTRURJQUZCQUVvRVFFRUJJUUlMSUFJZ0F4QWFKQzBMQlNORlJTSURCRUFnQUVIL3Z3Rk1JUU1MSUFNRVFDTkVCSDhqUWdValJBc2lBQVJBSXkxQkgzRWtMU010SUFGQjRBRnhjaVF0RHdzalJnUkFJQUZCQ0U0aUF3UkFJQUZCREV3aEF3c0xJQUVoQXlNdUJIOGdBMEVQY1FVZ0EwRURjUXNpQXlReEJTTkZSU0lEQkVBZ0FFSC8vd0ZNSVFNTElBTUVRQ05FQkVCQkFDQUJRZjhCY1JBUUJFQkJBU1JDQlVFQUpFSUxDd3NMQ3dzTERnQWpNd1JBUWE0QkR3dEIxd0FMRUFBak13UkFRWUNBQVE4TFFZREFBQXNvQVFGL0kzWkJBRW9pQUFSQUkzY2hBQXNnQUFSQUkzWkJBV3NrZGdzamRrVUVRRUVBSkhnTEN5Z0JBWDhqZVVFQVNpSUFCRUFqZWlFQUN5QUFCRUFqZVVFQmF5UjVDeU41UlFSQVFRQWtld3NMS0FFQmZ5TjhRUUJLSWdBRVFDTjlJUUFMSUFBRVFDTjhRUUZySkh3TEkzeEZCRUJCQUNSK0N3c3FBUUYvSTM5QkFFb2lBQVJBSTRBQklRQUxJQUFFUUNOL1FRRnJKSDhMSTM5RkJFQkJBQ1NCQVFzTElnRUJmeU9GQVNPR0FYVWhBQ09IQVFSL0k0VUJJQUJyQlNPRkFTQUFhZ3NpQUF0RkFRSi9RWlQrQXhBRFFmZ0JjU0VCUVpQK0F5QUFRZjhCY1NJQ0VBWkJsUDRESUFFZ0FFRUlkU0lBY2hBR0lBSWtpQUVnQUNTSkFTT0pBVUVJZENPSUFYSWtpZ0VMT0FFQ2Z4QWxJZ0JCL3c5TUlnRUVRQ09HQVVFQVNpRUJDeUFCQkVBZ0FDU0ZBU0FBRUNZUUpTRUFDeUFBUWY4UFNnUkFRUUFrZUFzTEx3QWpnZ0ZCQVdza2dnRWpnZ0ZCQUV3RVFDT0RBU1NDQVNPRUFRUi9JNE1CUVFCS0JTT0VBUXNFUUJBbkN3c0xZQUVCZnlPTEFVRUJheVNMQVNPTEFVRUFUQVJBSTR3QkpJc0JJNHNCQkVBampRRUVmeU9PQVVFUFNBVWpqUUVMSWdBRVFDT09BVUVCYWlTT0FRVWpqUUZGSWdBRVFDT09BVUVBU2lFQUN5QUFCRUFqamdGQkFXc2tqZ0VMQ3dzTEMyQUJBWDhqandGQkFXc2tqd0VqandGQkFFd0VRQ09RQVNTUEFTT1BBUVJBSTVFQkJIOGprZ0ZCRDBnRkk1RUJDeUlBQkVBamtnRkJBV29ra2dFRkk1RUJSU0lBQkVBamtnRkJBRW9oQUFzZ0FBUkFJNUlCUVFGckpKSUJDd3NMQ3d0Z0FRRi9JNU1CUVFGckpKTUJJNU1CUVFCTUJFQWpsQUVra3dFamt3RUVRQ09WQVFSL0k1WUJRUTlJQlNPVkFRc2lBQVJBSTVZQlFRRnFKSllCQlNPVkFVVWlBQVJBSTVZQlFRQktJUUFMSUFBRVFDT1dBVUVCYXlTV0FRc0xDd3NMalFFQkFYOGpXaUFBYWlSYUkxb1FJRTRFUUNOYUVDQnJKRm9DUUFKQUFrQUNRQUpBSTF3aUFRUkFBa0FnQVVFQ2F3NEdBZ0FEQUFRRkFBc01CUXNRSVJBaUVDTVFKQXdFQ3hBaEVDSVFJeEFrRUNnTUF3c1FJUkFpRUNNUUpBd0NDeEFoRUNJUUl4QWtFQ2dNQVFzUUtSQXFFQ3NMSTF4QkFXb2tYQ05jUVFoT0JFQkJBQ1JjQzBFQkR3dEJBQXNkQUNPWEFTQUFhaVNYQVNPWUFTT1hBV3RCQUVvRVFFRUFEd3RCQVF1REFRRUJmd0pBQWtBQ1FBSkFJQUJCQVVjRVFDQUFJZ0ZCQWtZTkFTQUJRUU5HRFFJZ0FVRUVSZzBEREFRTEkyTWptUUZIQkVBam1RRWtZMEVCRHd0QkFBOExJMlFqbWdGSEJFQWptZ0VrWkVFQkR3dEJBQThMSTJVam13RkhCRUFqbXdFa1pVRUJEd3RCQUE4TEkyWWpuQUZIQkVBam5BRWtaa0VCRHd0QkFBOExRUUFMSFFBam5RRWdBR29rblFFam5nRWpuUUZyUVFCS0JFQkJBQThMUVFFTEtRQWpud0VnQUdva253RWpvQUVqbndGclFRQktJZ0FFUUNOZVJTRUFDeUFBQkVCQkFBOExRUUVMSFFBam9RRWdBR29rb1FFam9nRWpvUUZyUVFCS0JFQkJBQThMUVFFTEhRQkJnQkFqaWdGclFRSjBKSmdCSXpNRVFDT1lBVUVCZENTWUFRc0xSUUVCZndKQUFrQUNRQ0FBUVFGSEJFQWdBQ0lDUVFKR0RRRWdBa0VEUmcwQ0RBTUxJQUZCZ1FFUUVBOExJQUZCaHdFUUVBOExJQUZCL2dBUUVBOExJQUZCQVJBUUMzMEJBWDhqbUFFZ0FHc2ttQUVqbUFGQkFFd0VRQ09ZQVNFQUVESWptQUVnQUVFQUlBQnJJQUJCQUVvYmF5U1lBU09qQVVFQmFpU2pBU09qQVVFSVRnUkFRUUFrb3dFTEN5TjRCSDhqbVFFRkkzZ0xJZ0FFZnlPT0FRVkJEdzhMSVFCQkFTRUJJNlFCSTZNQkVETkZCRUJCZnlFQkN5QUJJQUJzUVE5cUN4SUJBWDhqbHdFaEFFRUFKSmNCSUFBUU5Bc2RBRUdBRUNPbEFXdEJBblFrbmdFak13UkFJNTRCUVFGMEpKNEJDd3Q5QVFGL0k1NEJJQUJySko0Qkk1NEJRUUJNQkVBam5nRWhBQkEySTU0QklBQkJBQ0FBYXlBQVFRQktHMnNrbmdFanBnRkJBV29rcGdFanBnRkJDRTRFUUVFQUpLWUJDd3NqZXdSL0k1b0JCU043Q3lJQUJIOGprZ0VGUVE4UEN5RUFRUUVoQVNPbkFTT21BUkF6UlFSQVFYOGhBUXNnQVNBQWJFRVBhZ3NTQVFGL0k1MEJJUUJCQUNTZEFTQUFFRGNMSFFCQmdCQWpxQUZyUVFGMEpLQUJJek1FUUNPZ0FVRUJkQ1NnQVFzTGhBSUJBbjhqb0FFZ0FHc2tvQUVqb0FGQkFFd0VRQ09nQVNFQ0VEa2pvQUVnQWtFQUlBSnJJQUpCQUVvYmF5U2dBU09wQVVFQmFpU3BBU09wQVVFZ1RnUkFRUUFrcVFFTEMwRUFJUUlqcWdFaEFDTitCSDhqbXdFRkkzNExJZ0VFUUNOZUJFQkJuUDRERUFOQkJYVkJEM0VpQUNTcUFVRUFKRjRMQlVFUER3c2pxUUZCQW0xQnNQNERhaEFESVFFanFRRkJBbThFZnlBQlFROXhCU0FCUVFSMVFROXhDeUVCQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVNBQVFRSkdEUUlNQXdzZ0FVRUVkU0VCREFNTFFRRWhBZ3dDQ3lBQlFRRjFJUUZCQWlFQ0RBRUxJQUZCQW5VaEFVRUVJUUlMSUFKQkFFb0VmeUFCSUFKdEJVRUFDeUlCUVE5cUN4SUJBWDhqbndFaEFFRUFKSjhCSUFBUU9nc2JBUUYvSTZzQkk2d0JkQ0VBSXpNRVFDQUFRUUYwSVFBTElBQUxyd0VCQVg4am9nRWdBR3Nrb2dFam9nRkJBRXdFUUNPaUFTRUFFRHdrb2dFam9nRWdBRUVBSUFCcklBQkJBRW9iYXlTaUFTT3RBVUVCY1NFQkk2MEJRUUYxUVFGeElRQWpyUUZCQVhVa3JRRWpyUUVnQVNBQWN5SUJRUTUwY2lTdEFTT3VBUVJBSTYwQlFiOS9jU1N0QVNPdEFTQUJRUVowY2lTdEFRc0xJNEVCQkg4am5BRUZJNEVCQ3lJQUJIOGpsZ0VGUVE4UEN5RUJRUUFqclFFUUVBUi9RWDhGUVFFTElnQWdBV3hCRDJvTEVnRUJmeU9oQVNFQVFRQWtvUUVnQUJBOUN4SUFJek1FUUVHQWdJQUVEd3RCZ0lDQUFnc0VBQkEvQ3dRQUlBQUxNZ0FnQUVFOFJnUkFRZjhBRHdzZ0FFRThhMEdnalFac0lBRnNRUWh0UWFDTkJtMUJQR3BCb0kwR2JFR004UUp0RUVFTHVBRUJBWDlCQUNScEkxRUVmeUFBQlVFUEN5RUVJMUlFZnlBRUlBRnFCU0FFUVE5cUN5RUVJMU1FZnlBRUlBSnFCU0FFUVE5cUN5RUVJMVFFZnlBRUlBTnFCU0FFUVE5cUN5RUVJMVVFZnlBQUJVRVBDeUVBSTFZRWZ5QUFJQUZxQlNBQVFROXFDeUVBSTFjRWZ5QUFJQUpxQlNBQVFROXFDeUVBSTFnRWZ5QUFJQU5xQlNBQVFROXFDeUVBUVFBa2FrRUFKR3NnQkNOUFFRRnFFRUloQVNBQUkxQkJBV29RUWlFQUlBRWtaeUFBSkdnZ0FTQUFFQm9MSlFFQmZ5QUNRUUYwUVlENEkyb2lBeUFBUVFGcU9nQUFJQU5CQVdvZ0FVRUJham9BQUF1UUFnRUVmeUFBRUMwaUFVVUVRRUVCRUM0aEFRc2dBQkF2SWdKRkJFQkJBaEF1SVFJTElBQVFNQ0lEUlFSQVFRTVFMaUVEQ3lBQUVERWlCRVVFUUVFRUVDNGhCQXNnQVVFQmNRUkFFRFVrWHdzZ0FrRUJjUVJBRURna1lBc2dBMEVCY1FSQUVEc2tZUXNnQkVFQmNRUkFFRDRrWWdzZ0FVRUJjVVVFUUNBQ0lRRUxJQUZCQVhGRkJFQWdBeUVCQ3lBQlFRRnhSUVJBSUFRaEFRc2dBVUVCY1FSQVFRRWthd3NqV3lBQUk2OEJiR29rV3lOYkVFQk9CRUFqV3hCQWF5UmJJMnNFZnlOckJTTnBDeUlCUlFSQUkyb2hBUXNnQVFSQUkxOGpZQ05oSTJJUVF4b0xJMmRCQVdvamFFRUJhaU5kRUVRalhVRUJhaVJkSTEwanNBRkJBbTFCQVd0T0JFQWpYVUVCYXlSZEN3c0xmd0VFZnlBQUVEUWhBU0FBRURjaEFpQUFFRG9oQXlBQUVEMGhCQ0FCSkY4Z0FpUmdJQU1rWVNBRUpHSWpXeUFBSTY4QmJHb2tXeU5iRUVCT0JFQWpXeEJBYXlSYklBRWdBaUFESUFRUVF5SUFFQnhCQVdvZ0FCQWRRUUZxSTEwUVJDTmRRUUZxSkYwalhTT3dBVUVDYlVFQmEwNEVRQ05kUVFGckpGMExDd3NqQVFGL0lBQVFMQ0VCSXlvRWZ5QUJSUVVqS2dzaUFRUkFJQUFRUlFVZ0FCQkdDd3NqQUNOT0VCOUlCRUFQQ3dOQUkwNFFIMDRFUUJBZkVFY2pUaEFmYXlST0RBRUxDd3NmQUNBQVFmQUFjVUVFZFNTREFVRURJQUFRRUNTSEFTQUFRUWR4SklZQkN3c0FRUWNnQUJBUUpKc0JDeDRBSUFCQkJuVkJBM0VrcEFFZ0FFRS9jU1N4QVVIQUFDT3hBV3NrZGdzZUFDQUFRUVoxUVFOeEpLY0JJQUJCUDNFa3NnRkJ3QUFqc2dGckpIa0xFQUFnQUNTekFVR0FBaU96QVdza2ZBc1RBQ0FBUVQ5eEpMUUJRY0FBSTdRQmF5Ui9DeW9BSUFCQkJIVkJEM0VrdFFGQkF5QUFFQkFralFFZ0FFRUhjU1NNQVNBQVFmZ0JjVUVBU2lTWkFRc3FBQ0FBUVFSMVFROXhKTFlCUVFNZ0FCQVFKSkVCSUFCQkIzRWtrQUVnQUVINEFYRkJBRW9rbWdFTERRQWdBRUVGZFVFUGNTUzNBUXNxQUNBQVFRUjFRUTl4SkxnQlFRTWdBQkFRSkpVQklBQkJCM0VrbEFFZ0FFSDRBWEZCQUVva25BRUxGQUFnQUNTSUFTT0pBVUVJZENPSUFYSWtpZ0VMRkFBZ0FDUzVBU082QVVFSWRDTzVBWElrcFFFTEZBQWdBQ1M3QVNPOEFVRUlkQ083QVhJa3FBRUxoQUVCQVg4Z0FFRUVkU1NzQVVFRElBQVFFQ1N1QVNBQVFRZHhKTDBCQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ085QVNJQkJFQUNRQ0FCUVFGckRnY0NBd1FGQmdjSUFBc01DQXRCQ0NTckFROExRUkFrcXdFUEMwRWdKS3NCRHd0Qk1DU3JBUThMUWNBQUpLc0JEd3RCMEFBa3F3RVBDMEhnQUNTckFROExRZkFBSktzQkN3c2ZBRUVHSUFBUUVDUjNJQUJCQjNFa2lRRWppUUZCQ0hRamlBRnlKSW9CQzJZQkFYOUJBU1I0STNaRkJFQkJ3QUFrZGdzUU1pT01BU1NMQVNPMUFTU09BU09LQVNTRkFTT0RBU1NDQVNPREFVRUFTaUlBQkVBamhnRkJBRW9oQUFzZ0FBUkFRUUVraEFFRlFRQWtoQUVMSTRZQlFRQktCRUFRSndzam1RRkZCRUJCQUNSNEN3c2ZBRUVHSUFBUUVDUjZJQUJCQjNFa3VnRWp1Z0ZCQ0hRanVRRnlKS1VCQ3lvQVFRRWtleU41UlFSQVFjQUFKSGtMRURZamtBRWtqd0VqdGdFa2tnRWptZ0ZGQkVCQkFDUjdDd3NmQUVFR0lBQVFFQ1I5SUFCQkIzRWt2QUVqdkFGQkNIUWp1d0Z5SktnQkN5TUFRUUVrZmlOOFJRUkFRWUFDSkh3TEVEbEJBQ1NwQVNPYkFVVUVRRUVBSkg0TEN3c0FRUVlnQUJBUUpJQUJDellBUVFFa2dRRWpmMFVFUUVIQUFDUi9DeEE4SktJQkk1UUJKSk1CSTdnQkpKWUJRZi8vQVNTdEFTT2NBVVVFUUVFQUpJRUJDd3NUQUNBQVFRUjFRUWR4SkU4Z0FFRUhjU1JRQzBJQVFRY2dBQkFRSkZSQkJpQUFFQkFrVTBFRklBQVFFQ1JTUVFRZ0FCQVFKRkZCQXlBQUVCQWtXRUVDSUFBUUVDUlhRUUVnQUJBUUpGWkJBQ0FBRUJBa1ZRc0tBRUVISUFBUUVDUlpDL3NDQVFGL0FrQWdBRUdtL2dOSElnSUVRQ05aUlNFQ0N5QUNCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFrR1EvZ05IQkVBQ1FDQUNRWkgrQTJzT0ZnTUhDdzhBQkFnTUVBSUZDUTBSQUFZS0RoSVRGQlVBQ3d3VkN5QUJFRWtNRlFzZ0FSQktEQlFMSUFFUVN3d1RDeUFCRUV3TUVnc2dBUkJOREJFTElBRVFUZ3dRQ3lBQkVFOE1Ed3NnQVJCUURBNExRUUVrWGlBQkVGRU1EUXNnQVJCU0RBd0xJQUVRVXd3TEN5QUJFRlFNQ2dzZ0FSQlZEQWtMSUFFUVZnd0lDMEVISUFFUUVBUkFJQUVRVnhCWUN3d0hDMEVISUFFUUVBUkFJQUVRV1JCYUN3d0dDMEVISUFFUUVBUkFJQUVRV3hCY0N3d0ZDMEVISUFFUUVBUkFJQUVRWFJCZUN3d0VDeUFCRUY5QkFTUnBEQU1MSUFFUVlFRUJKR29NQWdzZ0FSQmhRUWNnQVJBUVJRUkFBa0JCa1A0RElRSURRQ0FDUWFiK0EwNE5BU0FDUVFBUUJpQUNRUUZxSVFJTUFBQUxBQXNMREFFTFFRRVBDMEVCQzBvQVFRY2dBQkFRSkw0QlFRWWdBQkFRSkw4QlFRVWdBQkFRSk1BQlFRUWdBQkFRSk1FQlFRTWdBQkFRSk1JQlFRSWdBQkFRSk1NQlFRRWdBQkFRSk1RQlFRQWdBQkFRSk1VQkN6NEJBWDhnQUVFSWRDRUJBa0JCQUNFQUEwQWdBRUdmQVVvTkFTQUFRWUQ4QTJvZ0FTQUFhaEFERUFZZ0FFRUJhaUVBREFBQUN3QUxRWVFGSk1jQkN3b0FJQUZCQVNBQWRISUxFd0FqeWdFUUF5UExBUkFERUJwQjhQOERjUXNYQUNQTUFSQURJODBCRUFNUUdrSHdQM0ZCZ0lBQ2Fnc05BQ0FCUVFFZ0FIUkJmM054QzNBQkFYOGdBRUdtL2dOR0JFQkJwdjRERUFOQmdBRnhJUUVqZUFSL1FRQWdBUkJsQlVFQUlBRVFhQXNhSTNzRWYwRUJJQUVRWlFWQkFTQUJFR2dMR2lOK0JIOUJBaUFCRUdVRlFRSWdBUkJvQ3hvamdRRUVmMEVESUFFUVpRVkJBeUFCRUdnTEdpQUJRZkFBY2c4TFFYOEx4QUVCQVg4ajBRRWhBQ1BTQVFSQUk5TUJCSDlCQWlBQUVHZ0ZRUUlnQUJCbEN5RUFJOVFCQkg5QkFDQUFFR2dGUVFBZ0FCQmxDeUVBSTlVQkJIOUJBeUFBRUdnRlFRTWdBQkJsQ3lFQUk5WUJCSDlCQVNBQUVHZ0ZRUUVnQUJCbEN5RUFCU1BYQVFSQUk5Z0JCSDlCQUNBQUVHZ0ZRUUFnQUJCbEN5RUFJOWtCQkg5QkFTQUFFR2dGUVFFZ0FCQmxDeUVBSTlvQkJIOUJBaUFBRUdnRlFRSWdBQkJsQ3lFQUk5c0JCSDlCQXlBQUVHZ0ZRUU1nQUJCbEN5RUFDd3NnQUVId0FYSUxnZ0lCQVg4Z0FFR0FnQUpJQkVCQmZ3OExJQUJCZ0lBQ1RpSUJCRUFnQUVHQXdBSklJUUVMSUFFRVFFRi9Ed3NnQUVHQXdBTk9JZ0VFUUNBQVFZRDhBMGdoQVFzZ0FRUkFJQUJCZ0VCcUVBTVBDeUFBUVlEOEEwNGlBUVJBSUFCQm4vMERUQ0VCQ3lBQkJFQWpkVUVDU0FSQVFmOEJEd3RCZnc4TElBQkJ4UDREUmdSQUlBQWpTUkFHSTBrUEN5QUFRWkQrQTA0aUFRUkFJQUJCcHY0RFRDRUJDeUFCQkVBUVNDQUFFR2tQQ3lBQVFiRCtBMDRpQVFSQUlBQkJ2LzREVENFQkN5QUJCRUFRU0VGL0R3c2dBRUdFL2dOR0JFQWdBQ050RUFZamJROExJQUJCaGY0RFJnUkFJQUFqYmhBR0kyNFBDeUFBUVlEK0EwWUVRQkJxRHd0QmZ3c2JBUUYvSUFBUWF5SUJRWDlHQkVBZ0FCQUREd3NnQVVIL0FYRUxaZ0VEZndKQUEwQWdBeUFDVGcwQklBQWdBMm9RYkNFRklBRWdBMm9oQkFOQUlBUkIvNzhDU2dSQUlBUkJnRUJxSVFRTUFRc0xJQVFnQlJCL0lBTkJBV29oQXd3QUFBc0FDMEVnSVFNak13UkFRY0FBSVFNTEk4Y0JJQU1nQWtFUWJXeHFKTWNCQzRnQkFRTi9JeTlGQkVBUEN5UEpBUVIvUVFjZ0FCQVFSUVVqeVFFTElnRUVRRUVBSk1rQkk4Z0JFQU1oQVNQSUFVRUhJQUVRWlJBR0R3c1FaaUVCRUdjaEFrRUhJQUFRYUVFQmFrRUVkQ0VEUVFjZ0FCQVFCRUJCQVNUSkFTQURKTTRCSUFFa3p3RWdBaVRRQVNQSUFVRUhJQUFRYUJBR0JTQUJJQUlnQXhCdEk4Z0JRZjhCRUFZTEN5WUJBWDhnQUVFL2NTRURJQUpCQVhFRVFDQURRVUJySVFNTElBTkJnSkFFYWlBQk9nQUFDeGdBUVFjZ0FCQVFCRUFnQVVFSElBQkJBV29RWlJBR0N3dElBUUovSUFBajNnRkdJZ0pGQkVBZ0FDUGRBVVloQWdzZ0FnUkFRUVlnQUVFQmF4QURFR2doQWlBQUk5MEJSZ1JBUVFFaEF3c2dBaUFCSUFNUWJ5QUNJQUJCQVdzUWNBc0xCUUJCZ0FJTExBQWpjeUFBYWlSekkzTVFjazRFUUNOekVISnJKSE1qYlVFQmFpUnRJMjFCL3dGS0JFQkJBQ1J0Q3dzTEd3RUJmeUFBUVkvK0F4QURFR1VpQVNUZ0FVR1AvZ01nQVJBR0N3c0FRUUVrM3dGQkFoQjBDejhBSUFBUWN5TndSUVJBRHdzamNpQUFhaVJ5QTBBamNpTjBUZ1JBSTNJamRHc2tjaU51UWY4QlRnUkFJMjhrYmhCMUJTTnVRUUZxSkc0TERBRUxDd3M5QVFGL0VISWhBQ053Qkg4amRDQUFTQVVqY0FzRVFDTjBJUUFMSTJ3Z0FFZ0VRQThMQTBBamJDQUFUZ1JBSUFBUWRpTnNJQUJySkd3TUFRc0xDeFlBUVFBa2JVR0UvZ05CQUJBR1FRQWtjaU52Skc0TEJnQWdBQ1J1Q3dZQUlBQWtid3NmQUNBQVFmOEJjeVRSQVVFRUk5RUJFQkFrMGdGQkJTUFJBUkFRSk5jQkN5c0FRUUFnQUJBUUpPRUJRUUVnQUJBUUpPSUJRUUlnQUJBUUpOOEJRUVFnQUJBUUpPTUJJQUFrNEFFTEt3QkJBQ0FBRUJBazVBRkJBU0FBRUJBazVRRkJBaUFBRUJBazVnRkJCQ0FBRUJBazV3RWdBQ1RvQVF1Y0JRRUJmd0pBQWtBZ0FFR0FnQUpJQkVBZ0FDQUJFQjRNQWdzZ0FFR0FnQUpPSWdJRVFDQUFRWURBQWtnaEFnc2dBZzBBSUFCQmdNQURUaUlDQkVBZ0FFR0EvQU5JSVFJTElBSUVRQ0FBUVlCQWFpQUJFQVlNQVFzZ0FFR0EvQU5PSWdJRVFDQUFRWi85QTB3aEFnc2dBZ1JBSTNWQkFrZ05BZ3dCQ3lBQVFhRDlBMDRpQWdSQUlBQkIvLzBEVENFQ0N5QUNEUUVnQUVHUS9nTk9JZ0lFUUNBQVFhYitBMHdoQWdzZ0FnUkFFRWdnQUNBQkVHSVBDeUFBUWJEK0EwNGlBZ1JBSUFCQnYvNERUQ0VDQ3lBQ0JFQVFTQXNnQUVIQS9nTk9JZ0lFUUNBQVFjditBMHdoQWdzZ0FnUkFJQUJCd1A0RFJnUkFJQUVRWXd3Q0N5QUFRY1QrQTBZRVFFRUFKRWtnQUVFQUVBWU1Bd3NnQUVIRi9nTkdCRUFnQVNUR0FRd0NDeUFBUWNiK0EwWUVRQ0FCRUdRTUFnc0NRQUpBQWtBQ1FDQUFJZ0pCdy80RFJ3UkFBa0FnQWtIQy9nTnJEZ29DQUFBQUFBQUFBQVFEQUFzTUJBc2dBU1JLREFVTElBRWtTd3dFQ3lBQkpFd01Bd3NnQVNSTkRBSUxEQUVMSUFBanlBRkdCRUFnQVJCdURBSUxJQUFqTWtZaUFrVUVRQ0FBSXpCR0lRSUxJQUlFUUNQSkFRUkFJODhCUVlDQUFVNGlBZ1JBSTg4QlFmLy9BVXdoQWdzZ0FrVUVRQ1BQQVVHQW9BTk9JZ0lFUUNQUEFVSC92d05NSVFJTEN5QUNEUU1MQ3lBQUk5d0JUaUlDQkVBZ0FDUGRBVXdoQWdzZ0FnUkFJQUFnQVJCeERBRUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQjNBa0FDUUFKQUFrQWdBQ0lDUVlUK0EwY0VRQUpBSUFKQmhmNERhdzREQWdNRUFBc01CQXNnQVJCNERBWUxJQUVRZVF3RUN5QUJFSG9NQXdzZ0FSQVNEQUlMREFFTElBQkJnUDREUmdSQUlBRVFld3NnQUVHUC9nTkdCRUFnQVJCOERBRUxJQUJCLy84RFJnUkFJQUVRZlF3QkMwRUJEd3RCQVE4TFFRQUxFUUFnQUNBQkVINEVRQ0FBSUFFUUJnc0xMZ0VCZjBFQklBQjBFQjBoQWlBQlFRQktCRUFqT3lBQ2NrSC9BWEVrT3dVak95QUNRZjhCYzNFa093c2pPd3NLQUVFRklBQVFnQUVhQzAwQUlBRkJBRTRFUUNBQVFROXhJQUZCRDNGcUVCMUJFSEVFUUVFQkVJRUJCVUVBRUlFQkN3VWdBVUVBSUFGcklBRkJBRW9iUVE5eElBQkJEM0ZMQkVCQkFSQ0JBUVZCQUJDQkFRc0xDd29BUVFjZ0FCQ0FBUm9MQ2dCQkJpQUFFSUFCR2dzS0FFRUVJQUFRZ0FFYUN4TUFJQUJCQVhRZ0FFSC9BWEZCQjNaeUVCMExNd0VDZnlBQkVCd2hBaUFBUVFGcUlRTWdBQ0FCRUIwaUFSQitCRUFnQUNBQkVBWUxJQU1nQWhCK0JFQWdBeUFDRUFZTEM0TUJBQ0FDUVFGeEJFQWdBRUgvL3dOeElnQWdBV29oQWlBQUlBRnpJQUp6SWdKQkVIRUVRRUVCRUlFQkJVRUFFSUVCQ3lBQ1FZQUNjUVJBUVFFUWhRRUZRUUFRaFFFTEJTQUFJQUZxRUJjaUFpQUFRZi8vQTNGSkJFQkJBUkNGQVFWQkFCQ0ZBUXNnQUNBQmN5QUNjMEdBSUhFUUZ3UkFRUUVRZ1FFRlFRQVFnUUVMQ3dzVEFDQUFRZjhCY1VFQmRpQUFRUWQwY2hBZEM4NEVBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFDUUNBQVFRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3d3VEN4QWJRZi8vQTNFUUhFSC9BWEVrTlJBYlFmLy9BM0VRSFVIL0FYRWtOaU05UVFKcUVCY2tQVUVNRHdzak5TTTJFQm9qTkJCL1FRZ1BDeU0xSXpZUUdrRUJha0gvL3dOeElnQVFIRUgvQVhFa05Rd05DeU0xUVFFUWdnRWpOVUVCYWhBZEpEVWpOUVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUVNRHdzak5VRi9FSUlCSXpWQkFXc1FIU1ExSXpVRVFFRUFFSU1CQlVFQkVJTUJDMEVCRUlRQkRBNExFQmxCL3dGeEpEVU1Dd3NqTkVHQUFYRkJnQUZHQkVCQkFSQ0ZBUVZCQUJDRkFRc2pOQkNHQVNRMERBc0xFQnRCLy84RGNTTThFSWNCSXoxQkFtb1FGeVE5UVJRUEN5TTVJem9RR2lJQUl6VWpOaEFhSWdGQi8vOERjVUVBRUlnQklBQWdBV29RRnlJQUVCeEIvd0Z4SkRrZ0FCQWRRZjhCY1NRNlFRQVFoQUZCQ0E4TEl6VWpOaEFhRUd4Qi93RnhKRFJCQ0E4TEl6VWpOaEFhUVFGckVCY2lBQkFjUWY4QmNTUTFEQVVMSXpaQkFSQ0NBU00yUVFGcUVCMGtOaU0yQkVCQkFCQ0RBUVZCQVJDREFRdEJBQkNFQVF3SEN5TTJRWDhRZ2dFak5rRUJheEFkSkRZak5nUkFRUUFRZ3dFRlFRRVFnd0VMUVFFUWhBRU1CZ3NRR1VIL0FYRWtOZ3dEQ3lNMFFRRnhRUUJMQkVCQkFSQ0ZBUVZCQUJDRkFRc2pOQkNKQVNRMERBTUxRWDhQQ3lBQUVCMUIvd0Z4SkRaQkNBOExJejFCQVdvUUZ5UTlRUWdQQzBFQUVJTUJRUUFRaEFGQkFCQ0JBUXRCQkFzS0FDTTdRUVIyUVFGeEN3MEFJQUJCQVhRUWl3RnlFQjBMS0FFQmYwRUhJQUJCR0hSQkdIVWlBUkFRQkVCQmdBSWdBRUVZZEVFWWRXdEJmMndoQVFzZ0FRc2pBUUYvSUFBUWpRRWhBU005SUFGQkdIUkJHSFZxRUJja1BTTTlRUUZxRUJja1BRc1VBQ0FBUWY4QmNVRUJkaENMQVVFSGRISVFIUXVhQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFUVJ3UkFBa0FnQUVFUmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTHdSQVFRQkJ6ZjRERUd3aUFCQVFCRUJCemY0RFFRZEJBQ0FBRUdnaUFCQVFCSDlCQUNRelFRY2dBQkJvQlVFQkpETkJCeUFBRUdVTElnQVFmMEhNQUE4TEN5TTlRUUZxRUJja1BRd1RDeEFiUWYvL0EzRVFIRUgvQVhFa054QWJRZi8vQTNFUUhVSC9BWEVrT0NNOVFRSnFFQmNrUFVFTUR3c2pOeU00RUJvak5CQi9RUWdQQ3lNM0l6Z1FHa0VCYWhBWElnQVFIRUgvQVhFa053d05DeU0zUVFFUWdnRWpOMEVCYWhBZEpEY2pOd1JBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUVNRHdzak4wRi9FSUlCSXpkQkFXc1FIU1EzSXpjRVFFRUFFSU1CQlVFQkVJTUJDMEVCRUlRQkRBNExFQmxCL3dGeEpEY01Dd3RCQUNFQUl6UkJnQUZ4UVlBQlJnUkFRUUVoQUFzak5CQ01BU1EwREFzTEVCa1FqZ0ZCREE4TEl6a2pPaEFhSWdBak55TTRFQm9pQVVILy93TnhRUUFRaUFFZ0FDQUJhaEFYSWdBUUhFSC9BWEVrT1NBQUVCMUIvd0Z4SkRwQkFCQ0VBVUVJRHdzak55TTRFQnBCLy84RGNSQnNRZjhCY1NRMFFRZ1BDeU0zSXpnUUdrRUJheEFYSWdBUUhFSC9BWEVrTnd3RkN5TTRRUUVRZ2dFak9FRUJhaEFkSkRnak9BUkFRUUFRZ3dFRlFRRVFnd0VMUVFBUWhBRU1Cd3NqT0VGL0VJSUJJemhCQVdzUUhTUTRJemdFUUVFQUVJTUJCVUVCRUlNQkMwRUJFSVFCREFZTEVCbEIvd0Z4SkRnTUF3dEJBQ0VBSXpSQkFYRkJBVVlFUUVFQklRQUxJelFRandFa05Bd0RDMEYvRHdzZ0FCQWRRZjhCY1NRNFFRZ1BDeU05UVFGcUVCY2tQVUVJRHdzZ0FBUkFRUUVRaFFFRlFRQVFoUUVMUVFBUWd3RkJBQkNFQVVFQUVJRUJDMEVFQ3dvQUl6dEJCM1pCQVhFTENnQWpPMEVGZGtFQmNRc0tBQ003UVFaMlFRRnhDOTBGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVNCSEJFQUNRQ0FBUVNGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeENSQVFSQURCTUZFQmtRamdGQkRBOExBQXNRRzBILy93TnhJZ0FRSEVIL0FYRWtPU0FBRUIxQi93RnhKRG9qUFVFQ2FoQVhKRDFCREE4TEl6a2pPaEFhSWdCQi8vOERjU00wRUg4Z0FFRUJhaEFYSWdBUUhFSC9BWEVrT1F3UEN5TTVJem9RR2tFQmFoQVhJZ0FRSEVIL0FYRWtPUXdPQ3lNNVFRRVFnZ0VqT1VFQmFoQWRKRGtqT1FSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFFTUR3c2pPVUYvRUlJQkl6bEJBV3NRSFNRNUl6a0VRRUVBRUlNQkJVRUJFSU1CQzBFQkVJUUJEQTRMRUJsQi93RnhKRGtNREFzUWtnRkJBRXNFUUVFR0lRRUxFSXNCUVFCTEJFQWdBVUhnQUhJaEFRc1Frd0ZCQUVzRWZ5TTBJQUZyRUIwRkl6UkJEM0ZCQ1VzRVFDQUJRUVp5SVFFTEl6UkJtUUZMQkVBZ0FVSGdBSEloQVFzak5DQUJhaEFkQ3lJQUJFQkJBQkNEQVFWQkFSQ0RBUXNnQVVIZ0FIRUVRRUVCRUlVQkJVRUFFSVVCQzBFQUVJRUJJQUFrTkF3TUN4Q1JBVUVBU3dSQUVCa1FqZ0ZCREE4RkRBc0xBQXNqT1NNNkVCb2lBU0FCUWYvL0EzRkJBQkNJQVNBQlFRRjBFQmNpQVJBY1FmOEJjU1E1SUFFUUhVSC9BWEVrT2tFQUVJUUJRUWdQQ3lNNUl6b1FHaUlCUWYvL0EzRVFiRUgvQVhFa05DQUJRUUZxRUJjaUFSQWNRZjhCY1NRNURBWUxJemtqT2hBYVFRRnJFQmNpQVJBY1FmOEJjU1E1REFVTEl6cEJBUkNDQVNNNlFRRnFFQjBrT2lNNkJFQkJBQkNEQVFWQkFSQ0RBUXRCQUJDRUFRd0hDeU02UVg4UWdnRWpPa0VCYXhBZEpEb2pPZ1JBUVFBUWd3RUZRUUVRZ3dFTFFRRVFoQUVNQmdzUUdVSC9BWEVrT2d3RUN5TTBRWDl6UWY4QmNTUTBRUUVRaEFGQkFSQ0JBUXdFQzBGL0R3c2dBUkFkUWY4QmNTUTZRUWdQQ3lBQUVCMUIvd0Z4SkRwQkNBOExJejFCQVdvUUZ5UTlRUWdQQzBFRUM5OEVBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRXdSd1JBQWtBZ0FFRXhhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzUWl3RUVRQXdTQlJBWkVJNEJRUXdQQ3dBTEVCdEIvLzhEY1NROEl6MUJBbW9RRnlROVFRd1BDeU01SXpvUUdpSUFRZi8vQTNFak5CQi9EQTRMSXp4QkFXb1FGeVE4UVFnUEN5TTVJem9RR2lJQVFmLy9BM0VRYkNJQlFRRVFnZ0VnQVVFQmFoQWRJZ0VFUUVFQUVJTUJCVUVCRUlNQkMwRUFFSVFCREE0TEl6a2pPaEFhSWdCQi8vOERjUkJzSWdGQmZ4Q0NBU0FCUVFGckVCMGlBUVJBUVFBUWd3RUZRUUVRZ3dFTFFRRVFoQUVNRFFzak9TTTZFQnBCLy84RGNSQVpRZjhCY1JCL0l6MUJBV29RRnlROVFRd1BDMEVBRUlRQlFRQVFnUUZCQVJDRkFVRUVEd3NRaXdGQkFVWUVRQkFaRUk0QlFRd1BCUXdLQ3dBTEl6a2pPaEFhSWdFalBFRUFFSWdCSUFFalBHb1FGeUlBRUJ4Qi93RnhKRGtnQUJBZFFmOEJjU1E2UVFBUWhBRkJDQThMSXprak9oQWFJZ0JCLy84RGNSQnNRZjhCY1NRMERBWUxJenhCQVdzUUZ5UThRUWdQQ3lNMFFRRVFnZ0VqTkVFQmFoQWRKRFFqTkFSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFGQkJBOExJelJCZnhDQ0FTTTBRUUZyRUIwa05DTTBCRUJCQUJDREFRVkJBUkNEQVF0QkFSQ0VBVUVFRHdzUUdVSC9BWEVrTkF3REMwRUFFSVFCUVFBUWdRRVFpd0ZCQUVzRVFFRUFFSVVCQlVFQkVJVUJDMEVFRHd0QmZ3OExJQUJCQVdzUUZ5SUFFQnhCL3dGeEpEa2dBQkFkUWY4QmNTUTZRUWdQQ3lNOVFRRnFFQmNrUFVFSUR3c2dBRUgvL3dOeElBRVFmMEVNQzlrQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FBUndSQUlBQWlBVUhCQUVZTkFRSkFJQUZCd2dCckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxEQkFMSXpZa05Rd1BDeU0zSkRVTURnc2pPQ1ExREEwTEl6a2tOUXdNQ3lNNkpEVU1Dd3NqT1NNNkVCb1FiRUgvQVhFa05VRUlEd3NqTkNRMURBa0xJelVrTmd3SUN3d0hDeU0zSkRZTUJnc2pPQ1EyREFVTEl6a2tOZ3dFQ3lNNkpEWU1Bd3NqT1NNNkVCb1FiRUgvQVhFa05rRUlEd3NqTkNRMkRBRUxRWDhQQzBFRUM5Z0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQVJ3UkFJQUFpQVVIUkFFWU5BUUpBSUFGQjBnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXpVa053d1FDeU0ySkRjTUR3c01EZ3NqT0NRM0RBMExJemtrTnd3TUN5TTZKRGNNQ3dzak9TTTZFQm9RYkVIL0FYRWtOMEVJRHdzak5DUTNEQWtMSXpVa09Bd0lDeU0ySkRnTUJ3c2pOeVE0REFZTERBVUxJemtrT0F3RUN5TTZKRGdNQXdzak9TTTZFQm9RYkVIL0FYRWtPQXdDQ3lNMEpEZ01BUXRCZnc4TFFRUUwyZ0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUNJQlFlRUFSZzBCQWtBZ0FVSGlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5TUTVRUWdQQ3lNMkpEa01Ed3NqTnlRNURBNExJemdrT1F3TkN3d01DeU02SkRrTUN3c2pPU002RUJvUWJFSC9BWEVrT1VFSUR3c2pOQ1E1REFrTEl6VWtPZ3dJQ3lNMkpEb01Cd3NqTnlRNkRBWUxJemdrT2d3RkN5TTVKRG9NQkFzTUF3c2pPU002RUJvUWJFSC9BWEVrT2tFSUR3c2pOQ1E2REFFTFFYOFBDMEVFQzRnQ0FRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCSEJFQWdBQ0lCUWZFQVJnMEJBa0FnQVVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqT1NNNkVCb2pOUkIvREJBTEl6a2pPaEFhSXpZUWZ3d1BDeU01SXpvUUdpTTNFSDhNRGdzak9TTTZFQm9qT0JCL0RBMExJemtqT2hBYUl6a1Fmd3dNQ3lNNUl6b1FHaU02RUg4TUN3c2p5UUZGQkVCQkFTUS9Dd3dMQ3lNNUl6b1FHaU0wRUg4TUNRc2pOU1EwREFrTEl6WWtOQXdJQ3lNM0pEUU1Cd3NqT0NRMERBWUxJemtrTkF3RkN5TTZKRFFNQkFzak9TTTZFQm9RYkVIL0FYRWtOQXdDQ3d3Q0MwRi9Ed3RCQ0E4TFFRUUxTUUFnQVVFQVRnUkFJQUJCL3dGeElBQWdBV29RSFVzRVFFRUJFSVVCQlVFQUVJVUJDd1VnQVVFQUlBRnJJQUZCQUVvYklBQkIvd0Z4U2dSQVFRRVFoUUVGUVFBUWhRRUxDd3MyQVFGL0l6UWdBRUgvQVhFaUFSQ0NBU00wSUFFUW1nRWpOQ0FBYWhBZEpEUWpOQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUVMYVFFQmZ5TTBJQUJxRUlzQmFoQWRJUUVqTkNBQWN5QUJjeEFkUVJCeEJFQkJBUkNCQVFWQkFCQ0JBUXNqTkNBQVFmOEJjV29RaXdGcUVCZEJnQUp4UVFCTEJFQkJBUkNGQVFWQkFCQ0ZBUXNnQVNRMEl6UUVRRUVBRUlNQkJVRUJFSU1CQzBFQUVJUUJDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJnQUZIQkVBQ1FDQUJRWUVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkNiQVF3UUN5TTJFSnNCREE4TEl6Y1Ftd0VNRGdzak9CQ2JBUXdOQ3lNNUVKc0JEQXdMSXpvUW13RU1Dd3NqT1NNNkVCb1FiQkNiQVVFSUR3c2pOQkNiQVF3SkN5TTFFSndCREFnTEl6WVFuQUVNQndzak54Q2NBUXdHQ3lNNEVKd0JEQVVMSXprUW5BRU1CQXNqT2hDY0FRd0RDeU01SXpvUUdoQnNFSndCUVFnUEN5TTBFSndCREFFTFFYOFBDMEVFQ3prQkFYOGpOQ0FBUWY4QmNVRi9iQ0lCRUlJQkl6UWdBUkNhQVNNMElBQnJFQjBrTkNNMEJFQkJBQkNEQVFWQkFSQ0RBUXRCQVJDRUFRdHBBUUYvSXpRZ0FHc1Fpd0ZyRUIwaEFTTTBJQUJ6SUFGelFSQnhFQjBFUUVFQkVJRUJCVUVBRUlFQkN5TTBJQUJCL3dGeGF4Q0xBV3NRRjBHQUFuRkJBRXNFUUVFQkVJVUJCVUVBRUlVQkN5QUJKRFFqTkFSQVFRQVFnd0VGUVFFUWd3RUxRUUVRaEFFTDRnRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHUUFVY0VRQUpBSUFGQmtRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lNMUVKNEJEQkFMSXpZUW5nRU1Ed3NqTnhDZUFRd09DeU00RUo0QkRBMExJemtRbmdFTURBc2pPaENlQVF3TEN5TTVJem9RR2hCc0VKNEJRUWdQQ3lNMEVKNEJEQWtMSXpVUW53RU1DQXNqTmhDZkFRd0hDeU0zRUo4QkRBWUxJemdRbndFTUJRc2pPUkNmQVF3RUN5TTZFSjhCREFNTEl6a2pPaEFhRUd3UW53RkJDQThMSXpRUW53RU1BUXRCZnc4TFFRUUxLQUFqTkNBQWNTUTBJelFFUUVFQUVJTUJCVUVCRUlNQkMwRUFFSVFCUVFFUWdRRkJBQkNGQVFzcUFDTTBJQUJ6RUIwa05DTTBCRUJCQUJDREFRVkJBUkNEQVF0QkFCQ0VBVUVBRUlFQlFRQVFoUUVMNGdFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdnQVVjRVFBSkFJQUZCb1FGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU0xRUtFQkRCQUxJellRb1FFTUR3c2pOeENoQVF3T0N5TTRFS0VCREEwTEl6a1FvUUVNREFzak9oQ2hBUXdMQ3lNNUl6b1FHaEJzRUtFQlFRZ1BDeU0wRUtFQkRBa0xJelVRb2dFTUNBc2pOaENpQVF3SEN5TTNFS0lCREFZTEl6Z1FvZ0VNQlFzak9SQ2lBUXdFQ3lNNkVLSUJEQU1MSXprak9oQWFFR3dRb2dGQkNBOExJelFRb2dFTUFRdEJmdzhMUVFRTExBQWpOQ0FBY2tIL0FYRWtOQ00wQkVCQkFCQ0RBUVZCQVJDREFRdEJBQkNFQVVFQUVJRUJRUUFRaFFFTE13RUJmeU0wSUFCQi93RnhRWDlzSWdFUWdnRWpOQ0FCRUpvQkl6UWdBV29FUUVFQUVJTUJCVUVCRUlNQkMwRUJFSVFCQytJQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCc0FGSEJFQUNRQ0FCUWJFQmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlJDa0FRd1FDeU0yRUtRQkRBOExJemNRcEFFTURnc2pPQkNrQVF3TkN5TTVFS1FCREF3TEl6b1FwQUVNQ3dzak9TTTZFQm9RYkJDa0FVRUlEd3NqTkJDa0FRd0pDeU0xRUtVQkRBZ0xJellRcFFFTUJ3c2pOeENsQVF3R0N5TTRFS1VCREFVTEl6a1FwUUVNQkFzak9oQ2xBUXdEQ3lNNUl6b1FHaEJzRUtVQlFRZ1BDeU0wRUtVQkRBRUxRWDhQQzBFRUMwQUJBbjhDUUFKQUlBQVFheUlCUVg5SEJFQU1BZ3NnQUJBRElRRUxDd0pBQWtBZ0FFRUJhaUlDRUdzaUFFRi9SdzBCSUFJUUF5RUFDd3NnQUNBQkVCb0xPd0FnQUVHQUFYRkJnQUZHQkVCQkFSQ0ZBUVZCQUJDRkFRc2dBQkNHQVNJQUJFQkJBQkNEQVFWQkFSQ0RBUXRCQUJDRUFVRUFFSUVCSUFBTE9RQWdBRUVCY1VFQVN3UkFRUUVRaFFFRlFRQVFoUUVMSUFBUWlRRWlBQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQUJDQkFTQUFDMGdCQVg4Z0FFR0FBWEZCZ0FGR0JFQkJBU0VCQ3lBQUVJd0JJUUFnQVFSQVFRRVFoUUVGUVFBUWhRRUxJQUFFUUVFQUVJTUJCVUVCRUlNQkMwRUFFSVFCUVFBUWdRRWdBQXRHQVFGL0lBQkJBWEZCQVVZRVFFRUJJUUVMSUFBUWp3RWhBQ0FCQkVCQkFSQ0ZBUVZCQUJDRkFRc2dBQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQUJDQkFTQUFDMG9CQVg4Z0FFR0FBWEZCZ0FGR0JFQkJBU0VCQ3lBQVFRRjBFQjBoQUNBQkJFQkJBUkNGQVFWQkFCQ0ZBUXNnQUFSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFGQkFCQ0JBU0FBQzJvQkFuOGdBRUdBQVhGQmdBRkdCRUJCQVNFQkN5QUFRUUZ4UVFGR0JFQkJBU0VDQ3lBQVFmOEJjVUVCZGhBZElRQWdBUVJBSUFCQmdBRnlJUUFMSUFBRVFFRUFFSU1CQlVFQkVJTUJDMEVBRUlRQlFRQVFnUUVnQWdSQVFRRVFoUUVGUVFBUWhRRUxJQUFMTndBZ0FFRVBjVUVFZENBQVFmQUJjVUVFZG5JUUhTSUFCRUJCQUJDREFRVkJBUkNEQVF0QkFCQ0VBVUVBRUlFQlFRQVFoUUVnQUF0S0FRRi9JQUJCQVhGQkFVWUVRRUVCSVFFTElBQkIvd0Z4UVFGMkVCMGlBQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQUJDQkFTQUJCRUJCQVJDRkFRVkJBQkNGQVFzZ0FBc29BQ0FCUVFFZ0FIUnhRZjhCY1FSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFGQkFSQ0JBU0FCQ3lBQUlBRkJBRW9FZnlBQ1FRRWdBSFJ5QlNBQ1FRRWdBSFJCZjNOeEN5SUNDOWNJQVFkL1FYOGhCUUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVFodklnY2hCaUFIUlEwQUFrQWdCa0VCYXc0SEFnTUVCUVlIQ0FBTERBZ0xJelVoQVF3SEN5TTJJUUVNQmdzak55RUJEQVVMSXpnaEFRd0VDeU01SVFFTUF3c2pPaUVCREFJTEl6a2pPaEFhRUd3aEFRd0JDeU0wSVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJR0lRUWdCa1VOQUFKQUlBUkJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTElBQkJCMHdFUUNBQkVLZ0JJUUpCQVNFREJTQUFRUTlNQkVBZ0FSQ3BBU0VDUVFFaEF3c0xEQThMSUFCQkYwd0VRQ0FCRUtvQklRSkJBU0VEQlNBQVFSOU1CRUFnQVJDckFTRUNRUUVoQXdzTERBNExJQUJCSjB3RVFDQUJFS3dCSVFKQkFTRURCU0FBUVM5TUJFQWdBUkN0QVNFQ1FRRWhBd3NMREEwTElBQkJOMHdFUUNBQkVLNEJJUUpCQVNFREJTQUFRVDlNQkVBZ0FSQ3ZBU0VDUVFFaEF3c0xEQXdMSUFCQnh3Qk1CRUJCQUNBQkVMQUJJUUpCQVNFREJTQUFRYzhBVEFSQVFRRWdBUkN3QVNFQ1FRRWhBd3NMREFzTElBQkIxd0JNQkVCQkFpQUJFTEFCSVFKQkFTRURCU0FBUWQ4QVRBUkFRUU1nQVJDd0FTRUNRUUVoQXdzTERBb0xJQUJCNXdCTUJFQkJCQ0FCRUxBQklRSkJBU0VEQlNBQVFlOEFUQVJBUVFVZ0FSQ3dBU0VDUVFFaEF3c0xEQWtMSUFCQjl3Qk1CRUJCQmlBQkVMQUJJUUpCQVNFREJTQUFRZjhBVEFSQVFRY2dBUkN3QVNFQ1FRRWhBd3NMREFnTElBQkJod0ZNQkVCQkFFRUFJQUVRc1FFaEFrRUJJUU1GSUFCQmp3Rk1CRUJCQVVFQUlBRVFzUUVoQWtFQklRTUxDd3dIQ3lBQVFaY0JUQVJBUVFKQkFDQUJFTEVCSVFKQkFTRURCU0FBUVo4QlRBUkFRUU5CQUNBQkVMRUJJUUpCQVNFREN3c01CZ3NnQUVHbkFVd0VRRUVFUVFBZ0FSQ3hBU0VDUVFFaEF3VWdBRUd2QVV3RVFFRUZRUUFnQVJDeEFTRUNRUUVoQXdzTERBVUxJQUJCdHdGTUJFQkJCa0VBSUFFUXNRRWhBa0VCSVFNRklBQkJ2d0ZNQkVCQkIwRUFJQUVRc1FFaEFrRUJJUU1MQ3d3RUN5QUFRY2NCVEFSQVFRQkJBU0FCRUxFQklRSkJBU0VEQlNBQVFjOEJUQVJBUVFGQkFTQUJFTEVCSVFKQkFTRURDd3NNQXdzZ0FFSFhBVXdFUUVFQ1FRRWdBUkN4QVNFQ1FRRWhBd1VnQUVIZkFVd0VRRUVEUVFFZ0FSQ3hBU0VDUVFFaEF3c0xEQUlMSUFCQjV3Rk1CRUJCQkVFQklBRVFzUUVoQWtFQklRTUZJQUJCN3dGTUJFQkJCVUVCSUFFUXNRRWhBa0VCSVFNTEN3d0JDeUFBUWZjQlRBUkFRUVpCQVNBQkVMRUJJUUpCQVNFREJTQUFRZjhCVEFSQVFRZEJBU0FCRUxFQklRSkJBU0VEQ3dzTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBSElnUUVRQUpBSUFSQkFXc09Cd0lEQkFVR0J3Z0FDd3dJQ3lBQ0pEVU1Cd3NnQWlRMkRBWUxJQUlrTnd3RkN5QUNKRGdNQkFzZ0FpUTVEQU1MSUFJa09nd0NDeU01SXpvUUdpQUNFSDhNQVFzZ0FpUTBDeU05UVFGcUVCY2tQU0FEQkVCQkNDRUZJQVJCQmtZRVFFRVFJUVVMQ3lBRkMra0RBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFjQUJSd1JBQWtBZ0FVSEJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEVKRUJCRUJCQ0E4RkRCWUxBQXNqUEJDbkFTRUJJenhCQW1vUUZ5UThJQUVRSEVIL0FYRWtOU0FCRUIxQi93RnhKRFpCREE4TEVKRUJCRUFNRUFVTUV3c0FDd3dSQ3hDUkFRUkFEQTRGREE4TEFBc2pQRUVDYXhBWEpEd2pQQ00xSXpZUUdoQ0hBVUVRRHdzUUdSQ2JBUXdLQ3lNOFFRSnJFQmNrUENNOEl6MFFod0ZCQUNROVFSQVBDeENSQVVFQlJnUkFEQTRGUVFnUEN3QUxJendRcHdGQi8vOERjU1E5SXp4QkFtb1FGeVE4UVJBUEN4Q1JBVUVCUmdSQURBc0ZEQWdMQUFzUUdVSC9BWEVRc2dFaUFVRUFTZ1JBSUFGQkJHb2hBUXNnQVE4TEVKRUJRUUZHQkVBalBFRUNheEFYSkR3alBDTTlRUUpxUWYvL0EzRVFod0VNQ0FVTUJnc0FDd3dGQ3hBWkVKd0JEQUlMSXp4QkFtc1FGeVE4SXp3alBSQ0hBVUVJSkQxQkVBOExRWDhQQ3lNOVFRRnFFQmNrUFVFSUR3c2pQVUVDYWhBWEpEMUJEQThMSXp4QkFtc1FGeVE4SXp3alBVRUNhaEFYRUljQkN4QWJRZi8vQTNFa1BVRVlEd3NRRzBILy93TnhKRDFCRUE4TEl6d1Fwd0ZCLy84RGNTUTlJenhCQW1vUUZ5UThRUlFMQ2dBZ0FFRUJjU1RwQVF2REF3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQjBBRkhCRUFDUUNBQlFkRUJhdzRQQWdNQUJBVUdCd2dKQ2dBTEFBd05BQXNNRFFzUWl3RUVRRUVJRHdVTUVnc0FDeU04RUtjQklRRWpQRUVDYWhBWEpEd2dBUkFjUWY4QmNTUTNJQUVRSFVIL0FYRWtPRUVNRHdzUWl3RUVRQXdOQlF3UEN3QUxFSXNCQkVBTURBVWpQRUVDYXhBWEpEd2pQQ005UVFKcVFmLy9BM0VRaHdFTURRc0FDeU04UVFKckVCY2tQQ004SXpjak9CQWFFSWNCUVJBUEN4QVpFSjRCREFnTEl6eEJBbXNRRnlROEl6d2pQUkNIQVVFUUpEMUJFQThMRUlzQlFRRkdCRUFNQ3dWQkNBOExBQXNqUEJDbkFVSC8vd054SkQxQkFSQzBBU004UVFKcUVCY2tQRUVRRHdzUWl3RkJBVVlFUUF3SUJRd0dDd0FMRUlzQlFRRkdCRUFqUEVFQ2F4QVhKRHdqUENNOVFRSnFFQmNRaHdFTUJnVU1CUXNBQ3hBWkVKOEJEQUlMSXp4QkFtc1FGeVE4SXp3alBSQ0hBVUVZSkQxQkVBOExRWDhQQ3lNOVFRRnFFQmNrUFVFSUR3c2pQVUVDYWhBWEpEMUJEQThMRUJ0Qi8vOERjU1E5UVJnUEN4QWJRZi8vQTNFa1BVRVFEd3NqUEJDbkFVSC8vd054SkQwalBFRUNhaEFYSkR4QkZBdmJBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQVVjRVFBSkFJQUJCNFFGckRnOENBd0FBQkFVR0J3Z0pBQUFBQ2dzQUN3d0xDeEFaUWY4QmNVR0EvZ05xSXpRUWZ5TTlRUUZxRUJja1BVRU1Ed3NqUEJDbkFTRUFJenhCQW1vUUZ5UThJQUFRSEVIL0FYRWtPU0FBRUIxQi93RnhKRHBCREE4TEl6WkJnUDREYWlNMEVIOUJDQThMSXp4QkFtc1FGeVE4SXp3ak9TTTZFQm9RaHdGQkVBOExFQmtRb1FFTUJ3c2pQRUVDYXhBWEpEd2pQQ005RUljQlFTQWtQVUVRRHdzUUdSQ05BU0VBSXp3Z0FFRVlkRUVZZFNJQVFRRVFpQUVqUENBQWFoQVhKRHhCQUJDREFVRUFFSVFCSXoxQkFXb1FGeVE5UVJBUEN5TTVJem9RR2tILy93TnhKRDFCQkE4TEVCdEIvLzhEY1NNMEVIOGpQVUVDYWhBWEpEMUJFQThMRUJrUW9nRU1BZ3NqUEVFQ2F4QVhKRHdqUENNOUVJY0JRU2drUFVFUUR3dEJmdzhMSXoxQkFXb1FGeVE5UVFnTGl3TUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFDUUNBQVFmRUJhdzRQQWdNRUFBVUdCd2dKQ2dzQUFBd05BQXNNRFFzUUdVSC9BWEZCZ1A0RGFoQnNFQjBrTkF3T0N5TThFS2NCUWYvL0EzRWhBQ004UVFKcUVCY2tQQ0FBRUJ4Qi93RnhKRFFnQUJBZFFmOEJjU1E3UVF3UEN5TTJRWUQrQTJvUWJCQWRKRFJCQ0E4TFFRQVF0QUZCQkE4TEl6eEJBbXNRRnlROEl6d2pOQ003RUJvUWh3RkJFQThMRUJrUXBBRU1DQXNqUEVFQ2F4QVhKRHdqUENNOUVJY0JRVEFrUFVFUUR3c1FHUkNOQVNFQVFRQVFnd0ZCQUJDRUFTTThJQUJCR0hSQkdIVWlBRUVCRUlnQkl6d2dBR29RRnlJQUVCeEIvd0Z4SkRrZ0FCQWRRZjhCY1NRNkRBY0xJemtqT2hBYVFmLy9BM0VrUEVFSUR3c1FHMEgvL3dOeEVHeEIvd0Z4SkRRalBVRUNhaEFYSkQxQkVBOExRUUVRdEFGQkJBOExFQmtRcFFFTUFnc2pQRUVDYXhBWEpEd2pQQ005RUljQlFUZ2tQVUVRRHd0QmZ3OExJejFCQVdvUUZ5UTlRUWdQQ3lNOVFRRnFFQmNrUFVFTUM4Z0JBUUYvSXoxQkFXb1FGeVE5QWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGR0RRRUNRQ0FCUVFKckRnMERCQVVHQndnSkNnc01EUTRQQUFzTUR3c2dBQkNLQVE4TElBQVFrQUVQQ3lBQUVKUUJEd3NnQUJDVkFROExJQUFRbGdFUEN5QUFFSmNCRHdzZ0FCQ1lBUThMSUFBUW1RRVBDeUFBRUowQkR3c2dBQkNnQVE4TElBQVFvd0VQQ3lBQUVLWUJEd3NnQUJDekFROExJQUFRdFFFUEN5QUFFTFlCRHdzZ0FCQzNBUXNNQUNQZ0FTUG9BWEZCQUVvTEd3RUJmeUFCRUJ3aEFpQUFJQUVRSFJBR0lBQkJBV29nQWhBR0M0TUJBUUYvUVFBUXRBRWdBRUdQL2dNUUF4Qm9JZ0VrNEFGQmovNERJQUVRQmlNOFFRSnJRZi8vQTNFa1BDTThJejBRdWdFQ1FBSkFBa0FDUUNBQUJFQUNRQ0FBUVFGckRnUUNBd0FFQUFzTUJBdEJBQ1RoQVVIQUFDUTlEQU1MUVFBazRnRkJ5QUFrUFF3Q0MwRUFKTjhCUWRBQUpEME1BUXRCQUNUakFVSGdBQ1E5Q3d1c0FRRUJmeVBwQVFSL0krZ0JRUUJLQlNQcEFRc2lBQVJBSStBQlFRQktJUUFMSUFBRVFFRUFJUUFqNUFFRWZ5UGhBUVVqNUFFTEJFQkJBQkM3QVVFQklRQUZJK1VCQkg4ajRnRUZJK1VCQ3dSQVFRRVF1d0ZCQVNFQUJTUG1BUVIvSTk4QkJTUG1BUXNFUUVFQ0VMc0JRUUVoQUFVajV3RUVmeVBqQVFVajV3RUxCRUJCQkJDN0FVRUJJUUFMQ3dzTElBQUVRRUVVSVFBalB3UkFRUUFrUDBFWUlRQUxJQUFQQ3d0QkFBc09BQ016QkVCQmtBY1BDMEhJQXdzRkFCQzlBUXNWQUNBQVFZQ1FmbW9nQVVFQmNVRU5kR290QUFBTERnQWdBVUdnQVd3Z0FHcEJBMndMRmdBZ0FDQUJFTUFCUVlEWUJXb2dBbW9nQXpvQUFBc0xBQ0FCUWFBQmJDQUFhZ3NSQUNBQUlBRVF3Z0ZCZ0tBRWFpMEFBQXNzQVFGL0lBSkJBM0VoQkNBRFFRRnhCRUJCQWlBRUVHVWhCQXNnQUNBQkVNSUJRWUNnQkdvZ0JEb0FBQXV5QWdFRGZ5QUJRUUJLSWdNRVFDQUFRUWhLSVFNTElBTUVRQ0FHSStvQlJpRURDeUFEQkVBZ0FDUHJBVVloQXdzZ0F3UkFRUUFoQTBFQUlRWkJCU0FFUVFGckVBTVFFQVJBUVFFaEF3dEJCU0FFRUFNUUVBUkFRUUVoQmdzQ1FFRUFJUVFEUUNBRVFRaE9EUUVnQXlBR1J3UkFRUWNnQkdzaEJBc2dBQ0FFYWtHZ0FVd0VRQ0FBUVFnZ0JHdHJJUWdnQUNBRWFpQUJFTUFCUVlEWUJXb2hDUUpBUVFBaEJRTkFJQVZCQTA0TkFTQUFJQVJxSUFFZ0JTQUpJQVZxTFFBQUVNRUJJQVZCQVdvaEJRd0FBQXNBQ3lBQUlBUnFJQUZCQWlBSUlBRVF3d0VpQlJCb1FRSWdCUkFRRU1RQklBZEJBV29oQndzZ0JFRUJhaUVFREFBQUN3QUxCU0FHSk9vQkN5QUFJK3NCVGdSQUlBQkJDR29rNndFZ0FDQUNRUWh2SWdaSUJFQWo2d0VnQm1vazZ3RUxDeUFIQ3pnQkFYOGdBRUdBa0FKR0JFQWdBVUdBQVdvaEFrRUhJQUVRRUFSQUlBRkJnQUZySVFJTElBQWdBa0VFZEdvUEN5QUFJQUZCQkhScUN5UUJBWDhnQUVFL2NTRUNJQUZCQVhFRVFDQUNRVUJySVFJTElBSkJnSkFFYWkwQUFBc2lBUUYvSUFCQkEzUWdBVUVCZEdvaUEwRUJhaUFDRU1jQklBTWdBaERIQVJBYUN4VUFJQUZCSHlBQVFRVnNJZ0IwY1NBQWRVRURkQXRaQUNBQ1FRRnhSUVJBSUFFUUF5QUFRUUYwZFVFRGNTRUFDMEh5QVNFQkFrQUNRQUpBQWtBQ1FDQUFSUTBFQWtBZ0FFRUJhdzREQWdNRUFBc01CQUFMQUF0Qm9BRWhBUXdDQzBIWUFDRUJEQUVMUVFnaEFRc2dBUXNOQUNBQklBSnNJQUJxUVFOc0M3VUNBUVovSUFFZ0FCREdBU0FGUVFGMGFpSUFJQUlRdndFaEVTQUFRUUZxSUFJUXZ3RWhFZ0pBSUFNaEFBTkFJQUFnQkVvTkFTQUdJQUFnQTJ0cUlnNGdDRWdFUUNBQUlRRWdERUVBU0NJQ1JRUkFRUVVnREJBUVJTRUNDeUFDQkVCQkJ5QUJheUVCQzBFQUlRSWdBU0FTRUJBRVFFRUNJUUlMSUFFZ0VSQVFCRUFnQWtFQmFpRUNDeUFNUVFCT0JIOUJBQ0FNUVFkeElBSkJBQkRJQVNJRkVNa0JJUTlCQVNBRkVNa0JJUUZCQWlBRkVNa0JCU0FMUVFCTUJFQkJ4LzRESVFzTElBSWdDeUFLRU1vQklnVWhEeUFGSWdFTElRVWdDU0FPSUFjZ0NCRExBV29pRUNBUE9nQUFJQkJCQVdvZ0FUb0FBQ0FRUVFKcUlBVTZBQUJCQUNFQklBeEJBRTRFUUVFSElBd1FFQ0VCQ3lBT0lBY2dBaUFCRU1RQklBMUJBV29oRFFzZ0FFRUJhaUVBREFBQUN3QUxJQTBMaHdFQkEzOGdBMEVJYnlFRElBQkZCRUFnQWlBQ1FRaHRRUU4wYXlFSEMwRUhJUWdnQUVFSWFrR2dBVW9FUUVHZ0FTQUFheUVJQzBGL0lRSWpMd1JBUVFNZ0JFRUJFTDhCSWdKQi93RnhFQkFFUUVFQklRa0xRUVlnQWhBUUJFQkJCeUFEYXlFREN3c2dCaUFGSUFrZ0J5QUlJQU1nQUNBQlFhQUJRWURZQlVFQVFRQWdBaERNQVF2cEFRQWdCU0FHRU1ZQklRWWdCRUVCRUw4QklRUWdBMEVJYnlFRFFRWWdCQkFRQkVCQkJ5QURheUVEQzBFQUlRVkJBeUFFRUJBRVFFRUJJUVVMSUFZZ0EwRUJkR29pQXlBRkVMOEJJUVlnQTBFQmFpQUZFTDhCSVFVZ0FrRUlieUVEUVFVZ0JCQVFSUVJBUVFjZ0Eyc2hBd3RCQUNFQ0lBTWdCUkFRQkVCQkFpRUNDeUFESUFZUUVBUkFJQUpCQVdvaEFndEJBQ0FFUVFkeElBSkJBQkRJQVNJREVNa0JJUVZCQVNBREVNa0JJUVpCQWlBREVNa0JJUU1nQUNBQlFRQWdCUkRCQVNBQUlBRkJBU0FHRU1FQklBQWdBVUVDSUFNUXdRRWdBQ0FCSUFKQkJ5QUVFQkFReEFFTGh3RUFJQVFnQlJER0FTQURRUWh2UVFGMGFpSUVRUUFRdndFaEJVRUFJUU1nQkVFQmFrRUFFTDhCSVFSQkJ5QUNRUWh2YXlJQ0lBUVFFQVJBUVFJaEF3c2dBaUFGRUJBRVFDQURRUUZxSVFNTElBQWdBVUVBSUFOQngvNERRUUFReWdFaUFoREJBU0FBSUFGQkFTQUNFTUVCSUFBZ0FVRUNJQUlRd1FFZ0FDQUJJQU5CQUJERUFRdmhBUUVHZnlBRFFRTjFJUXNDUUFOQUlBUkJvQUZPRFFFZ0JDQUZhaUlHUVlBQ1RnUkFJQVpCZ0FKcklRWUxJQUlnQzBFRmRHb2dCa0VEZFdvaUNVRUFFTDhCSVFkQkFDRUtJeXdFUUNBRUlBQWdCaUFESUFrZ0FTQUhFTVVCSWdoQkFFb0VRQ0FFSUFoQkFXdHFJUVJCQVNFS0N3c2pLd1IvSUFwRkJTTXJDeUlJQkVBZ0JDQUFJQVlnQXlBSklBRWdCeEROQVNJSVFRQktCRUFnQkNBSVFRRnJhaUVFQ3dVZ0NrVUVRQ012QkVBZ0JDQUFJQVlnQXlBSklBRWdCeERPQVFVZ0JDQUFJQVlnQXlBQklBY1F6d0VMQ3dzZ0JFRUJhaUVFREFBQUN3QUxDeTBCQW44alNpRUVJQUFqUzJvaUEwR0FBazRFUUNBRFFZQUNheUVEQ3lBQUlBRWdBaUFEUVFBZ0JCRFFBUXN4QVFOL0kwd2hBeUFBSTAwaUJFZ0VRQThMSUFOQkIyc2lBMEYvYkNFRklBQWdBU0FDSUFBZ0JHc2dBeUFGRU5BQkM1VUZBUkIvQWtCQkp5RUpBMEFnQ1VFQVNBMEJJQWxCQW5RaUEwR0EvQU5xRUFNaEFpQURRWUg4QTJvUUF5RUxJQU5CZ3Z3RGFoQURJUVFnQWtFUWF5RUNJQXRCQ0dzaEMwRUlJUVVnQVVFQmNRUkFRUkFoQlNBRVFRSnZRUUZHQkVBZ0JFRUJheUVFQ3dzZ0FDQUNUaUlHQkVBZ0FDQUNJQVZxU0NFR0N5QUdCRUJCQnlBRFFZUDhBMm9RQXlJR0VCQWhERUVHSUFZUUVDRURRUVVnQmhBUUlROGdBQ0FDYXlFQ0lBTUVRQ0FDSUFWclFYOXNRUUZySVFJTFFZQ0FBaUFFRU1ZQklBSkJBWFJxSVFSQkFDRUNJeThFZjBFRElBWVFFQVVqTHdzaUF3UkFRUUVoQWdzZ0JDQUNFTDhCSVJBZ0JFRUJhaUFDRUw4QklSRUNRRUVISVFVRFFDQUZRUUJJRFFFZ0JTRUNJQThFUUNBQ1FRZHJRWDlzSVFJTFFRQWhDQ0FDSUJFUUVBUkFRUUloQ0FzZ0FpQVFFQkFFUUNBSVFRRnFJUWdMSUFnRVFDQUxRUWNnQld0cUlnZEJBRTRpQWdSQUlBZEJvQUZNSVFJTElBSUVRRUVBSVFKQkFDRU5RUUFoRGlNdkJIOGp4UUZGQlNNdkN5SUVCRUJCQVNFQ0N5QUNSUVJBSUFjZ0FCRERBU0lLUVFOeElRTWdEQVIvSUFOQkFFb0ZJQXdMSWdRRVFFRUJJUTBGSXk4RWYwRUNJQW9RRUFVakx3c2lCQVJBSUFOQkFFb2hCQXNnQkFSQVFRRWhEZ3NMQ3lBQ1JRUkFJQTFGSWdNRWZ5QU9SUVVnQXdzaEFnc2dBZ1JBSXk4RVFFRUFJQVpCQjNFZ0NFRUJFTWdCSWdNUXlRRWhCRUVCSUFNUXlRRWhBa0VDSUFNUXlRRWhBeUFISUFCQkFDQUVFTUVCSUFjZ0FFRUJJQUlRd1FFZ0J5QUFRUUlnQXhEQkFRVkJ5UDRESVFOQkJDQUdFQkFFUUVISi9nTWhBd3NnQnlBQVFRQWdDQ0FEUVFBUXlnRWlDaERCQVNBSElBQkJBU0FLRU1FQklBY2dBRUVDSUFvUXdRRUxDd3NMSUFWQkFXc2hCUXdBQUFzQUN3c2dDVUVCYXlFSkRBQUFDd0FMQzNBQkFuOUJnSkFDSVFJandRRUVRRUdBZ0FJaEFnc2pMd1IvSXk4Rkk4VUJDeUlCQkVCQmdMQUNJUUVqd2dFRVFFR0F1QUloQVFzZ0FDQUNJQUVRMFFFTEk4QUJCRUJCZ0xBQ0lRRWp2d0VFUUVHQXVBSWhBUXNnQUNBQ0lBRVEwZ0VMSThRQkJFQWdBQ1BEQVJEVEFRc0xKZ0VCZndKQUEwQWdBRUdRQVVzTkFTQUFRZjhCY1JEVUFTQUFRUUZxSVFBTUFBQUxBQXNMU3dFQ2Z3SkFBMEFnQUVHUUFVNE5BUUpBUVFBaEFRTkFJQUZCb0FGT0RRRWdBU0FBRU1JQlFZQ2dCR3BCQURvQUFDQUJRUUZxSVFFTUFBQUxBQXNnQUVFQmFpRUFEQUFBQ3dBTEN3d0FRWDhrNmdGQmZ5VHJBUXNPQUNNekJFQkI4QVVQQzBINEFnc09BQ016QkVCQjhnTVBDMEg1QVFzTEFFRUJKT0lCUVFFUWRBdHNBUUYvSThrQlJRUkFEd3RCRUNFQUk4NEJRUkJJQkVBanpnRWhBQXNqendFajBBRWdBQkJ0STg4QklBQnFKTThCSTlBQklBQnFKTkFCSTg0QklBQnJKTTRCSTg0QlFRQk1CRUJCQUNUSkFTUElBVUgvQVJBR0JTUElBVUVISTg0QlFSQnRRUUZyRUdnUUJnc0xDd0JCQVNUaEFVRUFFSFFMMUFJQkJYOGp2Z0ZGQkVCQkFDUklRUUFrU1VIRS9nTkJBQkFHUVFCQkFVSEIvZ01RQXhCb0VHZ2hBMEVBSkhWQndmNERJQU1RQmc4TEkzVWhBU05KSWdOQmtBRk9CRUJCQVNFQ0JTTklFTmdCVGdSQVFRSWhBZ1VqU0JEWkFVNEVRRUVESVFJTEN3c2dBU0FDUndSQVFjSCtBeEFESVFBZ0FpUjFRUUFoQVFKQUFrQUNRQUpBQWtBZ0FpRUVJQUpGRFFBQ1FDQUVRUUZyRGdNQ0F3UUFDd3dFQzBFRFFRRkJBQ0FBRUdnUWFDSUFFQkFoQVF3REMwRUVRUUJCQVNBQUVHZ1FaU0lBRUJBaEFRd0NDMEVGUVFGQkFDQUFFR2dRWlNJQUVCQWhBUXdCQzBFQlFRQWdBQkJsRUdVaEFBc2dBUVJBRU5vQkN5QUNSUVJBRU5zQkN5QUNRUUZHQkVBUTNBRUxJOFlCSVFRZ0FrVWlBVVVFUUNBQ1FRRkdJUUVMSUFFRVFDQURJQVJHSVFFTElBRUVRRUVHUVFJZ0FCQmxJZ0FRRUFSQUVOb0JDd1ZCQWlBQUVHZ2hBQXRCd2Y0RElBQVFCZ3NMYmdFQmZ5TytBUVJBSTBnZ0FHb2tTQ05JRUwwQlRnUkFJMGdRdlFGckpFZ2pTU0lCUVpBQlJnUkFJeWtFUUJEVkFRVWdBUkRVQVFzUTFnRVExd0VGSUFGQmtBRklCRUFqS1VVRVFDQUJFTlFCQ3dzTElBRkJtUUZLQkg5QkFBVWdBVUVCYWdzaUFTUkpDd3NRM1FFTEtBQWpSeEMrQVVnRVFBOExBMEFqUnhDK0FVNEVRQkMrQVJEZUFTTkhFTDRCYXlSSERBRUxDd3ZlQVFFQ2YwRUJKQ05CQkNFQUl6OUZJZ0VFUUNOQVJTRUJDeUFCQkVBalBSQURRZjhCY1JDNEFTRUFCU00vQkg4ajZRRkZCU00vQ3lJQkJFQVF1UUVoQVFzZ0FRUkFRUUFrUDBFQUpFQWpQUkFEUWY4QmNSQzRBU0VBSXoxQkFXc1FGeVE5Q3dzak8wSHdBWEVrT3lBQVFRQk1CRUFnQUE4TEk4Y0JRUUJLQkVBZ0FDUEhBV29oQUVFQUpNY0JDeUFBRUx3QmFpRUFJejRnQUdva1BpTkFSUVJBSXljRVFDTkhJQUJxSkVjUTN3RUZJQUFRM2dFTEl5WUVRQ05PSUFCcUpFNEZJQUFRUndzTEl5Z0VRQ05zSUFCcUpHd1Fkd1VnQUJCMkN5QUFDMGNCQW44RFFDQUFSU0lCQkVBalBoQVdTQ0VCQ3lBQkJFQVE0QUZCQUVnRVFFRUJJUUFMREFFTEN5TStFQlpPQkVBalBoQVdheVErUVFBUEN5TTlRUUZyRUJja1BVRi9Dd1FBSTEwTGVRRUNmMEdBQ0NFQklBQUVmeUFBUVFCS0JTQUFDd1JBSUFBaEFRc0RRQ0FDUlNJQUJFQWpQaEFXU0NFQUN5QUFCRUFRNGdFZ0FVZ2hBQXNnQUFSQUVPQUJRUUJJQkVCQkFTRUNDd3dCQ3dzalBoQVdUZ1JBSXo0UUZtc2tQa0VBRHdzUTRnRWdBVTRFUUVFQkR3c2pQVUVCYXhBWEpEMUJmd3NPQUNBQVFZQUlhaUFCUVRKc2Fnc1pBQ0FCUVFGeEJFQWdBRUVCT2dBQUJTQUFRUUE2QUFBTEM1NEJBRUVBUVFBUTVBRWpORG9BQUVFQlFRQVE1QUVqTlRvQUFFRUNRUUFRNUFFak5qb0FBRUVEUVFBUTVBRWpOem9BQUVFRVFRQVE1QUVqT0RvQUFFRUZRUUFRNUFFak9Ub0FBRUVHUVFBUTVBRWpPam9BQUVFSFFRQVE1QUVqT3pvQUFFRUlRUUFRNUFFalBEc0JBRUVLUVFBUTVBRWpQVHNCQUVFTVFRQVE1QUVqUGpZQ0FFRVJRUUFRNUFFalB4RGxBVUVTUVFBUTVBRWpRQkRsQVFzaUFFRUFRUUVRNUFFalNEWUNBRUVFUVFFUTVBRWpkVG9BQUVIRS9nTWpTUkFHQ3h3QVFRQkJBaERrQVNQcEFSRGxBVUVCUVFJUTVBRWo3QUVRNVFFTEF3QUJDMjRBUVFCQkJCRGtBU010T3dFQVFRSkJCQkRrQVNNeE93RUFRUVJCQkJEa0FTTkJFT1VCUVFWQkJCRGtBU05DRU9VQlFRWkJCQkRrQVNOREVPVUJRUWRCQkJEa0FTTkVFT1VCUVFoQkJCRGtBU05GRU9VQlFRbEJCQkRrQVNOR0VPVUJRUXBCQkJEa0FTTXVFT1VCQ3pZQVFRQkJCUkRrQVNOeU5nSUFRUVJCQlJEa0FTTjBOZ0lBUVFoQkJSRGtBU056TmdJQVFZVCtBeU50RUFaQmhmNERJMjRRQmdzbUFFRUFRUVlRNUFFaldqWUNBRUVFUVFZUTVBRWpXem9BQUVFRlFRWVE1QUVqWERvQUFBdUNBUUJCQUVFSEVPUUJJM2dRNVFGQkFVRUhFT1FCSTVnQk5nSUFRUVZCQnhEa0FTT0xBVFlDQUVFSlFRY1E1QUVqZGpZQ0FFRU9RUWNRNUFFampnRTJBZ0JCRTBFSEVPUUJJKzBCT2dBQVFSUkJCeERrQVNPakFUb0FBRUVaUVFjUTVBRWpoQUVRNVFGQkdrRUhFT1FCSTRJQk5nSUFRUjlCQnhEa0FTT0ZBVHNCQUF0YkFFRUFRUWdRNUFFamV4RGxBVUVCUVFnUTVBRWpuZ0UyQWdCQkJVRUlFT1FCSTQ4Qk5nSUFRUWxCQ0JEa0FTTjVOZ0lBUVE1QkNCRGtBU09TQVRZQ0FFRVRRUWdRNUFFajdnRTZBQUJCRkVFSUVPUUJJNllCT2dBQUN6UUFRUUJCQ1JEa0FTTitFT1VCUVFGQkNSRGtBU09nQVRZQ0FFRUZRUWtRNUFFamZEWUNBRUVKUVFrUTVBRWpxUUU3QVFBTFR3QkJBRUVLRU9RQkk0RUJFT1VCUVFGQkNoRGtBU09pQVRZQ0FFRUZRUW9RNUFFamt3RTJBZ0JCQ1VFS0VPUUJJMzgyQWdCQkRrRUtFT1FCSTVZQk5nSUFRUk5CQ2hEa0FTT3RBVHNCQUFzbkFCRG1BUkRuQVJEb0FSRHBBUkRxQVJEckFSRHNBUkR0QVJEdUFSRHZBUkR3QVVFQUpDTUxFZ0FnQUMwQUFFRUFTZ1JBUVFFUEMwRUFDNTRCQUVFQVFRQVE1QUV0QUFBa05FRUJRUUFRNUFFdEFBQWtOVUVDUVFBUTVBRXRBQUFrTmtFRFFRQVE1QUV0QUFBa04wRUVRUUFRNUFFdEFBQWtPRUVGUVFBUTVBRXRBQUFrT1VFR1FRQVE1QUV0QUFBa09rRUhRUUFRNUFFdEFBQWtPMEVJUVFBUTVBRXZBUUFrUEVFS1FRQVE1QUV2QVFBa1BVRU1RUUFRNUFFb0FnQWtQa0VSUVFBUTVBRVE4Z0VrUDBFU1FRQVE1QUVROGdFa1FBc3FBRUVBUVFFUTVBRW9BZ0FrU0VFRVFRRVE1QUV0QUFBa2RVSEUvZ01RQXlSSlFjRCtBeEFERUdNTExBQkJBRUVDRU9RQkVQSUJKT2tCUVFGQkFoRGtBUkR5QVNUc0FVSC8vd01RQXhCOVFZLytBeEFERUh3TENnQkJnUDRERUFNUWV3dHVBRUVBUVFRUTVBRXZBUUFrTFVFQ1FRUVE1QUV2QVFBa01VRUVRUVFRNUFFUThnRWtRVUVGUVFRUTVBRVE4Z0VrUWtFR1FRUVE1QUVROGdFa1EwRUhRUVFRNUFFUThnRWtSRUVJUVFRUTVBRVE4Z0VrUlVFSlFRUVE1QUVROGdFa1JrRUtRUVFRNUFFUThnRWtMZ3RHQUVFQVFRVVE1QUVvQWdBa2NrRUVRUVVRNUFFb0FnQWtkRUVJUVFVUTVBRW9BZ0FrYzBHRS9nTVFBeVJ0UVlYK0F4QURFSGxCaHY0REVBTVFla0dIL2dNUUF4QVNDd1lBUVFBa1hRc3BBRUVBUVFZUTVBRW9BZ0FrV2tFRVFRWVE1QUV0QUFBa1cwRUZRUVlRNUFFdEFBQWtYQkQ1QVF1Q0FRQkJBRUVIRU9RQkVQSUJKSGhCQVVFSEVPUUJLQUlBSkpnQlFRVkJCeERrQVNnQ0FDU0xBVUVKUVFjUTVBRW9BZ0FrZGtFT1FRY1E1QUVvQWdBa2pnRkJFMEVIRU9RQkxRQUFKTzBCUVJSQkJ4RGtBUzBBQUNTakFVRVpRUWNRNUFFUThnRWtoQUZCR2tFSEVPUUJLQUlBSklJQlFSOUJCeERrQVM4QkFDU0ZBUXRiQUVFQVFRZ1E1QUVROGdFa2UwRUJRUWdRNUFFb0FnQWtuZ0ZCQlVFSUVPUUJLQUlBSkk4QlFRbEJDQkRrQVNnQ0FDUjVRUTVCQ0JEa0FTZ0NBQ1NTQVVFVFFRZ1E1QUV0QUFBazdnRkJGRUVJRU9RQkxRQUFKS1lCQ3pRQVFRQkJDUkRrQVJEeUFTUitRUUZCQ1JEa0FTZ0NBQ1NnQVVFRlFRa1E1QUVvQWdBa2ZFRUpRUWtRNUFFdkFRQWtxUUVMVHdCQkFFRUtFT1FCRVBJQkpJRUJRUUZCQ2hEa0FTZ0NBQ1NpQVVFRlFRb1E1QUVvQWdBa2t3RkJDVUVLRU9RQktBSUFKSDlCRGtFS0VPUUJLQUlBSkpZQlFSTkJDaERrQVM4QkFDU3RBUXNuQUJEekFSRDBBUkQxQVJEMkFSRDNBUkQ0QVJENkFSRDdBUkQ4QVJEOUFSRCtBVUVBSkNNTERBQWpJd1JBUVFFUEMwRUFDMThCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFJZ0ZCQVVZTkFRSkFJQUZCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJOU1CRHdzajFBRVBDeVBWQVE4TEk5WUJEd3NqMkFFUEN5UFpBUThMSTlvQkR3c2oyd0VQQzBFQUM0c0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FDSUNRUUZHRFFFQ1FDQUNRUUpyRGdZREJBVUdCd2dBQ3d3SUN5QUJRUUZ4Sk5NQkRBY0xJQUZCQVhFazFBRU1CZ3NnQVVFQmNTVFZBUXdGQ3lBQlFRRnhKTllCREFRTElBRkJBWEVrMkFFTUF3c2dBVUVCY1NUWkFRd0NDeUFCUVFGeEpOb0JEQUVMSUFGQkFYRWsyd0VMQ3dzQVFRRWs0d0ZCQkJCMEMyUUJBbjlCQUNSQUlBQVFnUUpGQkVCQkFTRUJDeUFBUVFFUWdnSWdBUVJBUVFBaEFTQUFRUU5NQkVCQkFTRUJDeVBTQVFSL0lBRUZJOUlCQ3lJQUJFQkJBU0VDQ3lQWEFRUi9JQUZGQlNQWEFRc2lBQVJBUVFFaEFnc2dBZ1JBRUlNQ0N3c0xDUUFnQUVFQUVJSUNDNW9CQUNBQVFRQktCRUJCQUJDRUFnVkJBQkNGQWdzZ0FVRUFTZ1JBUVFFUWhBSUZRUUVRaFFJTElBSkJBRW9FUUVFQ0VJUUNCVUVDRUlVQ0N5QURRUUJLQkVCQkF4Q0VBZ1ZCQXhDRkFnc2dCRUVBU2dSQVFRUVFoQUlGUVFRUWhRSUxJQVZCQUVvRVFFRUZFSVFDQlVFRkVJVUNDeUFHUVFCS0JFQkJCaENFQWdWQkJoQ0ZBZ3NnQjBFQVNnUkFRUWNRaEFJRlFRY1FoUUlMQ3dRQUl6UUxCQUFqTlFzRUFDTTJDd1FBSXpjTEJBQWpPQXNFQUNNNUN3UUFJem9MQkFBak93c0VBQ005Q3dRQUl6d0xxUU1CQ245QmdKQUNJUWtqd1FFRVFFR0FnQUloQ1F0QmdMQUNJUW9qd2dFRVFFR0F1QUloQ2dzQ1FBTkFJQVJCZ0FKT0RRRUNRRUVBSVFVRFFDQUZRWUFDVGcwQklBa2dDaUFFUVFOMVFRVjBhaUFGUVFOMWFpSUdRUUFRdndFUXhnRWhDQ0FFUVFodklRRkJCeUFGUVFodmF5RUhRUUFoQWlNdkJIOGdBRUVBU2dVakx3c2lBd1JBSUFaQkFSQy9BU0VDQzBFR0lBSVFFQVJBUVFjZ0FXc2hBUXRCQUNFRFFRTWdBaEFRQkVCQkFTRURDeUFJSUFGQkFYUnFJZ1lnQXhDL0FTRUlRUUFoQVNBSElBWkJBV29nQXhDL0FSQVFCRUJCQWlFQkN5QUhJQWdRRUFSQUlBRkJBV29oQVFzZ0JFRUlkQ0FGYWtFRGJDRUhJeThFZnlBQVFRQktCU012Q3lJREJFQkJBQ0FDUVFkeElBRkJBQkRJQVNJQkVNa0JJUVpCQVNBQkVNa0JJUU5CQWlBQkVNa0JJUUVnQjBHQW1BNXFJZ0lnQmpvQUFDQUNRUUZxSUFNNkFBQWdBa0VDYWlBQk9nQUFCU0FCUWNmK0EwRUFFTW9CSVFJQ1FFRUFJUUVEUUNBQlFRTk9EUUVnQjBHQW1BNXFJQUZxSUFJNkFBQWdBVUVCYWlFQkRBQUFDd0FMQ3lBRlFRRnFJUVVNQUFBTEFBc2dCRUVCYWlFRURBQUFDd0FMQzBnQUFrQUNRQUpBQWtBQ1FDUHZBVUVLYXc0RUFRSURCQUFMQUF0QkFDRUtDMEVBSVFzTFFYOGhEQXNnQUNBQklBSWdBeUFFSUFVZ0JpQUhJQWdnQ1NBS0lBc2dEQkRNQVF2WkFRRUdmd0pBQTBBZ0FrRVhUZzBCQWtCQkFDRUFBMEFnQUVFZlRnMEJRUUFoQkNBQVFROUtCRUJCQVNFRUN5QUNJUUVnQWtFUFNnUkFJQUZCRDJzaEFRc2dBVUVFZENFQklBQkJEMG9FZnlBQklBQkJEMnRxQlNBQklBQnFDeUVCUVlDQUFpRUZJQUpCRDBvRVFFR0FrQUloQlFzQ1FFRUFJUU1EUUNBRFFRaE9EUUZCQ3lUdkFTQUJJQVVnQkVFQVFRY2dBeUFBUVFOMElBSkJBM1FnQTJwQitBRkJnSmdhUVFGQkFFRUFFSklDR2lBRFFRRnFJUU1NQUFBTEFBc2dBRUVCYWlFQURBQUFDd0FMSUFKQkFXb2hBZ3dBQUFzQUN3c1VBRDhBUVlzQlNBUkFRWXNCUHdCclFBQWFDd3NkQUFKQUFrQUNRQ1B2QVE0Q0FRSUFDd0FMUVFBaEFBc2dBQkNSQWdzSEFDQUFKTzhCQ3dEOFdnUnVZVzFsQWZSYWx3SUFKV052Y21VdmJXVnRiM0o1TDJKaGJtdHBibWN2WjJWMFVtOXRRbUZ1YTBGa1pISmxjM01CSldOdmNtVXZiV1Z0YjNKNUwySmhibXRwYm1jdloyVjBVbUZ0UW1GdWEwRmtaSEpsYzNNQ04yTnZjbVV2YldWdGIzSjVMMjFsYlc5eWVVMWhjQzluWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUURLV052Y21VdmJXVnRiM0o1TDJ4dllXUXZaV2xuYUhSQ2FYUk1iMkZrUm5KdmJVZENUV1Z0YjNKNUJCcGpiM0psTDJOd2RTOWpjSFV2YVc1cGRHbGhiR2w2WlVOd2RRVW1ZMjl5WlM5dFpXMXZjbmt2YldWdGIzSjVMMmx1YVhScFlXeHBlbVZEWVhKMGNtbGtaMlVHSzJOdmNtVXZiV1Z0YjNKNUwzTjBiM0psTDJWcFoyaDBRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbmtISFdOdmNtVXZiV1Z0YjNKNUwyUnRZUzlwYm1sMGFXRnNhWHBsUkcxaENDbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDJsdWFYUnBZV3hwZW1WSGNtRndhR2xqY3drblkyOXlaUzluY21Gd2FHbGpjeTl3WVd4bGRIUmxMMmx1YVhScFlXeHBlbVZRWVd4bGRIUmxDaWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG1sdWFYUnBZV3hwZW1VTEoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVhVzVwZEdsaGJHbDZaUXduWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1cGJtbDBhV0ZzYVhwbERTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbWx1YVhScFlXeHBlbVVPTVdOdmNtVXZjMjkxYm1RdllXTmpkVzExYkdGMGIzSXZhVzVwZEdsaGJHbDZaVk52ZFc1a1FXTmpkVzExYkdGMGIzSVBJR052Y21VdmMyOTFibVF2YzI5MWJtUXZhVzVwZEdsaGJHbDZaVk52ZFc1a0VDRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZZMmhsWTJ0Q2FYUlBia0o1ZEdVUk0yTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OW5aWFJHY21WeGRXVnVZM2xHY205dFNXNXdkWFJEYkc5amExTmxiR1ZqZEJJc1kyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1MWNHUmhkR1ZVYVcxbGNrTnZiblJ5YjJ3VEkyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OXBibWwwYVdGc2FYcGxWR2x0WlhKekZCUmpiM0psTDJOdmNtVXZhVzVwZEdsaGJHbDZaUlVRWTI5eVpTOWpiM0psTDJOdmJtWnBaeFlsWTI5eVpTOWpjSFV2WTNCMUwwTndkUzVOUVZoZlExbERURVZUWDFCRlVsOUdVa0ZOUlJjaVkyOXlaUzl3YjNKMFlXSnNaUzl3YjNKMFlXSnNaUzkxTVRaUWIzSjBZV0pzWlJnZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5blpYUkVZWFJoUW5sMFpWUjNieGtmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTluWlhSRVlYUmhRbmwwWlU5dVpSb2pZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMMk52Ym1OaGRHVnVZWFJsUW5sMFpYTWJLR052Y21VdlkzQjFMMjl3WTI5a1pYTXZaMlYwUTI5dVkyRjBaVzVoZEdWa1JHRjBZVUo1ZEdVY0lHTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXpjR3hwZEVocFoyaENlWFJsSFI5amIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmMzQnNhWFJNYjNkQ2VYUmxIaUZqYjNKbEwyMWxiVzl5ZVM5aVlXNXJhVzVuTDJoaGJtUnNaVUpoYm10cGJtY2ZLV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdVltRjBZMmhRY205alpYTnpRM2xqYkdWeklDMWpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG0xaGVFWnlZVzFsVTJWeGRXVnVZMlZEZVdOc1pYTWhLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUR1Z1WjNSb0lpbGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVeGxibWQwYUNNcFkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTFjR1JoZEdWTVpXNW5kR2drS1dOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVEdWdVozUm9KU3hqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDJkbGRFNWxkMFp5WlhGMVpXNWplVVp5YjIxVGQyVmxjQ1lwWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1elpYUkdjbVZ4ZFdWdVkza25NbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2WTJGc1kzVnNZWFJsVTNkbFpYQkJibVJEYUdWamEwOTJaWEptYkc5M0tDaGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpWTjNaV1Z3S1N0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlVWdWRtVnNiM0JsS2l0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlVWdWRtVnNiM0JsS3l0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlVWdWRtVnNiM0JsTENWamIzSmxMM052ZFc1a0wzTnZkVzVrTDNWd1pHRjBaVVp5WVcxbFUyVnhkV1Z1WTJWeUxTNWpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbmRwYkd4RGFHRnVibVZzVlhCa1lYUmxMaXBqYjNKbEwzTnZkVzVrTDJGalkzVnRkV3hoZEc5eUwyUnBaRU5vWVc1dVpXeEVZV05EYUdGdVoyVXZMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1V3TG1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWQybHNiRU5vWVc1dVpXeFZjR1JoZEdVeExtTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkMmxzYkVOb1lXNXVaV3hWY0dSaGRHVXlKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1Y21WelpYUlVhVzFsY2pNOVkyOXlaUzl6YjNWdVpDOWtkWFI1TDJselJIVjBlVU41WTJ4bFEyeHZZMnRRYjNOcGRHbDJaVTl5VG1WbllYUnBkbVZHYjNKWFlYWmxabTl5YlRRbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNW5aWFJUWVcxd2JHVTFObU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1WjJWMFUyRnRjR3hsUm5KdmJVTjVZMnhsUTI5MWJuUmxjalluWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1eVpYTmxkRlJwYldWeU55WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbWRsZEZOaGJYQnNaVGcyWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1blpYUlRZVzF3YkdWR2NtOXRRM2xqYkdWRGIzVnVkR1Z5T1NkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuSmxjMlYwVkdsdFpYSTZKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11WjJWMFUyRnRjR3hsT3paamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxtZGxkRk5oYlhCc1pVWnliMjFEZVdOc1pVTnZkVzUwWlhJOE8yTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVaMlYwVG05cGMyVkRhR0Z1Ym1Wc1JuSmxjWFZsYm1ONVVHVnlhVzlrUFNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExtZGxkRk5oYlhCc1pUNDJZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVuWlhSVFlXMXdiR1ZHY205dFEzbGpiR1ZEYjNWdWRHVnlQeHhqYjNKbEwyTndkUzlqY0hVdlEzQjFMa05NVDBOTFgxTlFSVVZFUUNwamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMbTFoZUVSdmQyNVRZVzF3YkdWRGVXTnNaWE5CSW1OdmNtVXZjRzl5ZEdGaWJHVXZjRzl5ZEdGaWJHVXZhVE15VUc5eWRHRmliR1ZDS0dOdmNtVXZjMjkxYm1RdmMyOTFibVF2WjJWMFUyRnRjR3hsUVhOVmJuTnBaMjVsWkVKNWRHVkRJbU52Y21VdmMyOTFibVF2YzI5MWJtUXZiV2w0UTJoaGJtNWxiRk5oYlhCc1pYTkVNMk52Y21VdmMyOTFibVF2YzI5MWJtUXZjMlYwVEdWbWRFRnVaRkpwWjJoMFQzVjBjSFYwUm05eVFYVmthVzlSZFdWMVpVVW1ZMjl5WlM5emIzVnVaQzloWTJOMWJYVnNZWFJ2Y2k5aFkyTjFiWFZzWVhSbFUyOTFibVJHSDJOdmNtVXZjMjkxYm1RdmMyOTFibVF2WTJGc1kzVnNZWFJsVTI5MWJtUkhIR052Y21VdmMyOTFibVF2YzI5MWJtUXZkWEJrWVhSbFUyOTFibVJJSW1OdmNtVXZjMjkxYm1RdmMyOTFibVF2WW1GMFkyaFFjbTlqWlhOelFYVmthVzlKSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE1Fb25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTUxY0dSaGRHVk9Vbmd3U3lkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VERk1KMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUbEo0TVUwblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTFjR1JoZEdWT1VuZ3hUaWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5Wd1pHRjBaVTVTZURGUEoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRsSjRNbEFuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1MWNHUmhkR1ZPVW5neVVTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlREpTSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVGxKNE1sTW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzUxY0dSaGRHVk9Vbmd6VkNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlU1U2VETlZKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TTFZblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWT1VuZ3pWeWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURSWUpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkSEpwWjJkbGNsa25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUxY0dSaGRHVk9VbmcwV2lSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuUnlhV2RuWlhKYkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkWEJrWVhSbFRsSjRORndrWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1MGNtbG5aMlZ5WFNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlU1U2VEUmVKR052Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZEhKcFoyZGxjbDhoWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlUYjNWdVpDNTFjR1JoZEdWT1VqVXdZQ0ZqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMU52ZFc1a0xuVndaR0YwWlU1U05URmhJV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWRYQmtZWFJsVGxJMU1tSXNZMjl5WlM5emIzVnVaQzl5WldkcGMzUmxjbk12VTI5MWJtUlNaV2RwYzNSbGNsZHlhWFJsVkhKaGNITmpKbU52Y21VdlozSmhjR2hwWTNNdmJHTmtMMHhqWkM1MWNHUmhkR1ZNWTJSRGIyNTBjbTlzWkNCamIzSmxMMjFsYlc5eWVTOWtiV0V2YzNSaGNuUkViV0ZVY21GdWMyWmxjbVVmWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNObGRFSnBkRTl1UW5sMFpXWW5ZMjl5WlM5dFpXMXZjbmt2WkcxaEwyZGxkRWhrYldGVGIzVnlZMlZHY205dFRXVnRiM0o1Wnl4amIzSmxMMjFsYlc5eWVTOWtiV0V2WjJWMFNHUnRZVVJsYzNScGJtRjBhVzl1Um5KdmJVMWxiVzl5ZVdnaFkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzSmxjMlYwUW1sMFQyNUNlWFJsYVN0amIzSmxMM052ZFc1a0wzSmxaMmx6ZEdWeWN5OVRiM1Z1WkZKbFoybHpkR1Z5VW1WaFpGUnlZWEJ6YWlGamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdloyVjBTbTk1Y0dGa1UzUmhkR1ZySkdOdmNtVXZiV1Z0YjNKNUwzSmxZV1JVY21Gd2N5OWphR1ZqYTFKbFlXUlVjbUZ3YzJ3eVkyOXlaUzl0WlcxdmNua3ZiRzloWkM5bGFXZG9kRUpwZEV4dllXUkdjbTl0UjBKTlpXMXZjbmxYYVhSb1ZISmhjSE50SEdOdmNtVXZiV1Z0YjNKNUwyUnRZUzlvWkcxaFZISmhibk5tWlhKdUlXTnZjbVV2YldWdGIzSjVMMlJ0WVM5emRHRnlkRWhrYldGVWNtRnVjMlpsY204eVkyOXlaUzluY21Gd2FHbGpjeTl3WVd4bGRIUmxMM04wYjNKbFVHRnNaWFIwWlVKNWRHVkpibGRoYzIxTlpXMXZjbmx3TUdOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXBibU55WlcxbGJuUlFZV3hsZEhSbFNXNWtaWGhKWmxObGRIRXZZMjl5WlM5bmNtRndhR2xqY3k5d1lXeGxkSFJsTDNkeWFYUmxRMjlzYjNKUVlXeGxkSFJsVkc5TlpXMXZjbmx5TEdOdmNtVXZkR2x0WlhKekwzUnBiV1Z5Y3k5VWFXMWxjbk11WW1GMFkyaFFjbTlqWlhOelEzbGpiR1Z6Y3loamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlgyTm9aV05yUkdsMmFXUmxjbEpsWjJsemRHVnlkQ3hqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlmY21WeGRXVnpkRWx1ZEdWeWNuVndkSFV3WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12Y21WeGRXVnpkRlJwYldWeVNXNTBaWEp5ZFhCMGRoOWpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZkWEJrWVhSbFZHbHRaWEp6ZHlWamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlltRjBZMmhRY205alpYTnpWR2x0WlhKemVDOWpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlVScGRtbGtaWEpTWldkcGMzUmxjbmtzWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTUxY0dSaGRHVlVhVzFsY2tOdmRXNTBaWEo2SzJOdmNtVXZkR2x0WlhKekwzUnBiV1Z5Y3k5VWFXMWxjbk11ZFhCa1lYUmxWR2x0WlhKTmIyUjFiRzk3Sm1OdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5S2IzbHdZV1F1ZFhCa1lYUmxTbTk1Y0dGa2ZENWpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OUpiblJsY25KMWNIUnpMblZ3WkdGMFpVbHVkR1Z5Y25Wd2RGSmxjWFZsYzNSbFpIMDhZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTUxY0dSaGRHVkpiblJsY25KMWNIUkZibUZpYkdWa2ZpWmpiM0psTDIxbGJXOXllUzkzY21sMFpWUnlZWEJ6TDJOb1pXTnJWM0pwZEdWVWNtRndjMzgwWTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2WldsbmFIUkNhWFJUZEc5eVpVbHVkRzlIUWsxbGJXOXllVmRwZEdoVWNtRndjNEFCR1dOdmNtVXZZM0IxTDJac1lXZHpMM05sZEVac1lXZENhWFNCQVI5amIzSmxMMk53ZFM5bWJHRm5jeTl6WlhSSVlXeG1RMkZ5Y25sR2JHRm5nZ0V2WTI5eVpTOWpjSFV2Wm14aFozTXZZMmhsWTJ0QmJtUlRaWFJGYVdkb2RFSnBkRWhoYkdaRFlYSnllVVpzWVdlREFScGpiM0psTDJOd2RTOW1iR0ZuY3k5elpYUmFaWEp2Um14aFo0UUJIbU52Y21VdlkzQjFMMlpzWVdkekwzTmxkRk4xWW5SeVlXTjBSbXhoWjRVQkcyTnZjbVV2WTNCMUwyWnNZV2R6TDNObGRFTmhjbko1Um14aFo0WUJJV052Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl5YjNSaGRHVkNlWFJsVEdWbWRJY0JObU52Y21VdmJXVnRiM0o1TDNOMGIzSmxMM05wZUhSbFpXNUNhWFJUZEc5eVpVbHVkRzlIUWsxbGJXOXllVmRwZEdoVWNtRndjNGdCTkdOdmNtVXZZM0IxTDJac1lXZHpMMk5vWldOclFXNWtVMlYwVTJsNGRHVmxia0pwZEVac1lXZHpRV1JrVDNabGNtWnNiM2VKQVNKamIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmNtOTBZWFJsUW5sMFpWSnBaMmgwaWdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXdlSXNCRzJOdmNtVXZZM0IxTDJac1lXZHpMMmRsZEVOaGNuSjVSbXhoWjR3QkxXTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXliM1JoZEdWQ2VYUmxUR1ZtZEZSb2NtOTFaMmhEWVhKeWVZMEJJV052Y21VdmNHOXlkR0ZpYkdVdmNHOXlkR0ZpYkdVdmFUaFFiM0owWVdKc1pZNEJJbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5eVpXeGhkR2wyWlVwMWJYQ1BBUzVqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2Y205MFlYUmxRbmwwWlZKcFoyaDBWR2h5YjNWbmFFTmhjbko1a0FFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXhlSkVCR21OdmNtVXZZM0IxTDJac1lXZHpMMmRsZEZwbGNtOUdiR0Zua2dFZlkyOXlaUzlqY0hVdlpteGhaM012WjJWMFNHRnNaa05oY25KNVJteGhaNU1CSG1OdmNtVXZZM0IxTDJac1lXZHpMMmRsZEZOMVluUnlZV04wUm14aFo1UUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTW5pVkFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVE40bGdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTBlSmNCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE5YaVlBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRaNG1RRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1UzZUpvQksyTnZjbVV2WTNCMUwyWnNZV2R6TDJOb1pXTnJRVzVrVTJWMFJXbG5hSFJDYVhSRFlYSnllVVpzWVdlYkFTSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12WVdSa1FWSmxaMmx6ZEdWeW5BRXVZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDJGa1pFRlVhSEp2ZFdkb1EyRnljbmxTWldkcGMzUmxjcDBCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE9IaWVBU0pqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMzVmlRVkpsWjJsemRHVnlud0V1WTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzTjFZa0ZVYUhKdmRXZG9RMkZ5Y25sU1pXZHBjM1JsY3FBQkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxPWGloQVNKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZZVzVrUVZKbFoybHpkR1Z5b2dFaVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM2h2Y2tGU1pXZHBjM1JsY3FNQkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxRWGlrQVNGamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZiM0pCVW1WbmFYTjBaWEtsQVNGamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZZM0JCVW1WbmFYTjBaWEttQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pVSjRwd0VyWTI5eVpTOXRaVzF2Y25rdmJHOWhaQzl6YVhoMFpXVnVRbWwwVEc5aFpFWnliMjFIUWsxbGJXOXllYWdCS0dOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXliM1JoZEdWU1pXZHBjM1JsY2t4bFpuU3BBU2xqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpTYVdkb2RLb0JOR052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5eWIzUmhkR1ZTWldkcGMzUmxja3hsWm5SVWFISnZkV2RvUTJGeWNubXJBVFZqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpTYVdkb2RGUm9jbTkxWjJoRFlYSnllYXdCSjJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXphR2xtZEV4bFpuUlNaV2RwYzNSbGNxMEJNbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRkpwWjJoMFFYSnBkR2h0WlhScFkxSmxaMmx6ZEdWeXJnRXJZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNOM1lYQk9hV0ppYkdWelQyNVNaV2RwYzNSbGNxOEJMMk52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRkpwWjJoMFRHOW5hV05oYkZKbFoybHpkR1Z5c0FFblkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM1JsYzNSQ2FYUlBibEpsWjJsemRHVnlzUUVtWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzTmxkRUpwZEU5dVVtVm5hWE4wWlhLeUFTRmpiM0psTDJOd2RTOWpZazl3WTI5a1pYTXZhR0Z1Wkd4bFEySlBjR052WkdXekFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVU40dEFFb1kyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmMyVjBTVzUwWlhKeWRYQjBjN1VCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFJIaTJBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVWNHR3RWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1ZHZUxnQkhtTnZjbVV2WTNCMUwyOXdZMjlrWlhNdlpYaGxZM1YwWlU5d1kyOWtaYmtCT21OdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDBsdWRHVnljblZ3ZEhNdVlYSmxTVzUwWlhKeWRYQjBjMUJsYm1ScGJtZTZBUzFqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzl6YVhoMFpXVnVRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbm03QVN0amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5ZmFHRnVaR3hsU1c1MFpYSnlkWEIwdkFFcVkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlkyaGxZMnRKYm5SbGNuSjFjSFJ6dlFFM1kyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVOUVZoZlExbERURVZUWDFCRlVsOVRRMEZPVEVsT1JiNEJNbU52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVltRjBZMmhRY205alpYTnpRM2xqYkdWenZ3RW5ZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5c2IyRmtSbkp2YlZaeVlXMUNZVzVyd0FFblkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTluWlhSU1oySlFhWGhsYkZOMFlYSjB3UUVtWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXpaWFJRYVhobGJFOXVSbkpoYldYQ0FTUmpiM0psTDJkeVlYQm9hV056TDNCeWFXOXlhWFI1TDJkbGRGQnBlR1ZzVTNSaGNuVERBU3BqYjNKbEwyZHlZWEJvYVdOekwzQnlhVzl5YVhSNUwyZGxkRkJ5YVc5eWFYUjVabTl5VUdsNFpXekVBU3BqYjNKbEwyZHlZWEJvYVdOekwzQnlhVzl5YVhSNUwyRmtaRkJ5YVc5eWFYUjVabTl5VUdsNFpXekZBVHBqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkMHhwYm1WUFpsUnBiR1ZHY205dFZHbHNaVU5oWTJobHhnRW1ZMjl5WlM5bmNtRndhR2xqY3k5MGFXeGxjeTluWlhSVWFXeGxSR0YwWVVGa1pISmxjM1BIQVROamIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZiRzloWkZCaGJHVjBkR1ZDZVhSbFJuSnZiVmRoYzIxTlpXMXZjbm5JQVN4amIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZaMlYwVW1kaVEyOXNiM0pHY205dFVHRnNaWFIwWmNrQkxtTnZjbVV2WjNKaGNHaHBZM012Y0dGc1pYUjBaUzluWlhSRGIyeHZja052YlhCdmJtVnVkRVp5YjIxU1oyTEtBVE5qYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdloyVjBUVzl1YjJOb2NtOXRaVU52Ykc5eVJuSnZiVkJoYkdWMGRHWExBU1ZqYjNKbEwyZHlZWEJvYVdOekwzUnBiR1Z6TDJkbGRGUnBiR1ZRYVhobGJGTjBZWEowekFFc1kyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OWtjbUYzVUdsNFpXeHpSbkp2YlV4cGJtVlBabFJwYkdYTkFUZGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQweHBibVZQWmxScGJHVkdjbTl0Vkdsc1pVbGt6Z0UzWTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGREYjJ4dmNsQnBlR1ZzUm5KdmJWUnBiR1ZKWk04QlBHTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1RXOXViMk5vY205dFpWQnBlR1ZzUm5KdmJWUnBiR1ZKWk5BQk8yTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1FtRmphMmR5YjNWdVpGZHBibVJ2ZDFOallXNXNhVzVsMFFFdlkyOXlaUzluY21Gd2FHbGpjeTlpWVdOclozSnZkVzVrVjJsdVpHOTNMM0psYm1SbGNrSmhZMnRuY205MWJtVFNBU3RqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdmNtVnVaR1Z5VjJsdVpHOTMwd0VqWTI5eVpTOW5jbUZ3YUdsamN5OXpjSEpwZEdWekwzSmxibVJsY2xOd2NtbDBaWFBVQVNSamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMTlrY21GM1UyTmhibXhwYm1YVkFTbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDE5eVpXNWtaWEpGYm5ScGNtVkdjbUZ0WmRZQkoyTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WTJ4bFlYSlFjbWx2Y21sMGVVMWhjTmNCSW1OdmNtVXZaM0poY0docFkzTXZkR2xzWlhNdmNtVnpaWFJVYVd4bFEyRmphR1hZQVR0amIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMGR5WVhCb2FXTnpMazFKVGw5RFdVTk1SVk5mVTFCU1NWUkZVMTlNUTBSZlRVOUVSZGtCUVdOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVUVWxPWDBOWlEweEZVMTlVVWtGT1UwWkZVbDlFUVZSQlgweERSRjlOVDBSRjJnRXVZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRFeGpaRWx1ZEdWeWNuVndkTnNCSUdOdmNtVXZiV1Z0YjNKNUwyUnRZUzkxY0dSaGRHVklZbXhoYm10SVpHMWgzQUV4WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12Y21WeGRXVnpkRlpDYkdGdWEwbHVkR1Z5Y25Wd2ROMEJIbU52Y21VdlozSmhjR2hwWTNNdmJHTmtMM05sZEV4alpGTjBZWFIxYzk0QkpXTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012ZFhCa1lYUmxSM0poY0docFkzUGZBU3RqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwySmhkR05vVUhKdlkyVnpjMGR5WVhCb2FXTno0QUVWWTI5eVpTOWpiM0psTDJWNFpXTjFkR1ZUZEdWdzRRRVdZMjl5WlM5amIzSmxMMlY0WldOMWRHVkdjbUZ0WmVJQk1HTnZjbVV2YzI5MWJtUXZjMjkxYm1RdloyVjBUblZ0WW1WeVQyWlRZVzF3YkdWelNXNUJkV1JwYjBKMVptWmxjdU1CSTJOdmNtVXZZMjl5WlM5bGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2NUFFaVkyOXlaUzlqYjNKbEwyZGxkRk5oZG1WVGRHRjBaVTFsYlc5eWVVOW1abk5sZE9VQk1tTnZjbVV2YldWdGIzSjVMM04wYjNKbEwzTjBiM0psUW05dmJHVmhia1JwY21WamRHeDVWRzlYWVhOdFRXVnRiM0o1NWdFYVkyOXlaUzlqY0hVdlkzQjFMME53ZFM1ellYWmxVM1JoZEdYbkFTbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TG5OaGRtVlRkR0YwWmVnQkwyTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXVjMkYyWlZOMFlYUmw2UUVqWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDBwdmVYQmhaQzV6WVhabFUzUmhkR1hxQVNOamIzSmxMMjFsYlc5eWVTOXRaVzF2Y25rdlRXVnRiM0o1TG5OaGRtVlRkR0YwWmVzQkkyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OVVhVzFsY25NdWMyRjJaVk4wWVhSbDdBRWdZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1ellYWmxVM1JoZEdYdEFTWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbk5oZG1WVGRHRjBaZTRCSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWMyRjJaVk4wWVhSbDd3RW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTV6WVhabFUzUmhkR1h3QVNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuTmhkbVZUZEdGMFpmRUJFMk52Y21VdlkyOXlaUzl6WVhabFUzUmhkR1h5QVRKamIzSmxMMjFsYlc5eWVTOXNiMkZrTDJ4dllXUkNiMjlzWldGdVJHbHlaV04wYkhsR2NtOXRWMkZ6YlUxbGJXOXllZk1CR21OdmNtVXZZM0IxTDJOd2RTOURjSFV1Ykc5aFpGTjBZWFJsOUFFcFkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVzYjJGa1UzUmhkR1gxQVM5amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5SmJuUmxjbkoxY0hSekxteHZZV1JUZEdGMFpmWUJJMk52Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzlLYjNsd1lXUXViRzloWkZOMFlYUmw5d0VqWTI5eVpTOXRaVzF2Y25rdmJXVnRiM0o1TDAxbGJXOXllUzVzYjJGa1UzUmhkR1g0QVNOamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlZHbHRaWEp6TG14dllXUlRkR0YwWmZrQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlkyeGxZWEpCZFdScGIwSjFabVpsY3ZvQklHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1Ykc5aFpGTjBZWFJsK3dFbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNXNiMkZrVTNSaGRHWDhBU1pqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG14dllXUlRkR0YwWmYwQkptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXViRzloWkZOMFlYUmwvZ0VtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTkM5RGFHRnVibVZzTkM1c2IyRmtVM1JoZEdYL0FSTmpiM0psTDJOdmNtVXZiRzloWkZOMFlYUmxnQUlZWTI5eVpTOWpiM0psTDJoaGMwTnZjbVZUZEdGeWRHVmtnUUkwWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5blpYUktiM2x3WVdSQ2RYUjBiMjVUZEdGMFpVWnliMjFDZFhSMGIyNUpaSUlDTkdOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5ZmMyVjBTbTk1Y0dGa1FuVjBkRzl1VTNSaGRHVkdjbTl0UW5WMGRHOXVTV1NEQWpGamIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5eVpYRjFaWE4wU205NWNHRmtTVzUwWlhKeWRYQjBoQUlsWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5d2NtVnpjMHB2ZVhCaFpFSjFkSFJ2Ym9VQ0oyTnZjbVV2YW05NWNHRmtMMnB2ZVhCaFpDOWZjbVZzWldGelpVcHZlWEJoWkVKMWRIUnZib1lDSVdOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5elpYUktiM2x3WVdSVGRHRjBaWWNDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlRWWdDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlRb2tDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlRNG9DSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlSSXNDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlSWXdDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlTSTBDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlUSTRDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlSbzhDSm1OdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkJ5YjJkeVlXMURiM1Z1ZEdWeWtBSWtZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFUzUmhZMnRRYjJsdWRHVnlrUUkzWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFuY21Gd2FHbGpjeTlrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZVpJQ04yTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaSEpoZDFCcGVHVnNjMFp5YjIxTWFXNWxUMlpVYVd4bGZIUnlZVzF3YjJ4cGJtV1RBakpqYjNKbEwyUmxZblZuTDJSbFluVm5MV2R5WVhCb2FXTnpMMlJ5WVhkVWFXeGxSR0YwWVZSdlYyRnpiVTFsYlc5eWVaUUNCWE4wWVhKMGxRSkNZMjl5WlM5a1pXSjFaeTlrWldKMVp5MW5jbUZ3YUdsamN5OWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllWHgwY21GdGNHOXNhVzVsbGdJSWZuTmxkR0Z5WjJNQVBoQnpiM1Z5WTJWTllYQndhVzVuVlZKTUxHUmxiVzh2WkdWaWRXZG5aWEl2WVhOelpYUnpMMk52Y21VdWRXNTBiM1ZqYUdWa0xuZGhjMjB1YldGdyIpOgphd2FpdCBMKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmZoQmdDWDkvZjM5L2YzOS9md0JnQUFCZ0FYOEJmMkFDZjM4QVlBRi9BR0FDZjM4QmYyQUFBWDlnQkg5L2YzOEJmMkFEZjM5L0FHQURmMzkvQVg5Z0JuOS9mMzkvZndCZ0IzOS9mMzkvZjM4QmYyQUVmMzkvZndCZ0RYOS9mMzkvZjM5L2YzOS9mMzhCZjJBSGYzOS9mMzkvZndCZ0NIOS9mMzkvZjM5L0FBT1pBcGNDQWdJQ0FnRUJBd0VCQVFFQkFRRUJBUVVHQkFFQkFBWUNCZ1lGQmdJQ0F3WUdBUUVCQVFZRUFRRUJBUUVDQWdJQ0FnSUJCUUlHQVFJR0FRSUdCZ0lHQmdZQ0JRY0lCQVFFQVFRRUJBUUVCQVFFQkFRRUJBUUVCQUVFQVFRQkJBRUVCQVFGQkFRRkJnWUZBZ1lDQWdnRUNBTURCZ1FFQVFRQkJBUUVCQVFFQlFNRkJBTUVCQVFDQXdnQ0FnWUNBZ1FDQWdZR0JnSUNBZ0lDQWdNRUJBSUVCQUlFQkFJRUJBSUNBZ0lDQWdJQ0FnSUZDUUlDQkFJQ0FnSUdBd1FHQmdZRkJRd0ZCUXdMQlFVSkJRa0pEUXNPQ2dvSUNBTUVBUUVCQmdZQkFRRUJCQUVHQmdZQ0JRTUJBUUVCQVFFQkFRRUJBUUVDQVFFQkFRRUJBUUVCQVFFQkFRWUNBd0VFQkE4R0JnWUdCZ1lHQmdZR0JBMEJBUVFFQlFNQkFBQUc2UXIrQVg4QVFRQUxmd0JCZ0lDc0JBdC9BRUdMQVF0L0FFRUFDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBUUMzOEFRZi8vQXd0L0FFR0FFQXQvQUVHQWdBRUxmd0JCZ0pBQkMzOEFRWUNBQWd0L0FFR0FrQU1MZndCQmdJQUJDMzhBUVlDUUJBdC9BRUdBNkI4TGZ3QkJnSkFFQzM4QVFZQUVDMzhBUVlDZ0JBdC9BRUdBdUFFTGZ3QkJnTmdGQzM4QVFZRFlCUXQvQUVHQW1BNExmd0JCZ0lBTUMzOEFRWUNZR2d0L0FFR0FnQWtMZndCQmdKZ2pDMzhBUVlEZ0FBdC9BRUdBK0NNTGZ3QkJnSUFJQzM4QVFZRDRLd3QvQUVHQWdBZ0xmd0JCZ1BnekMzOEFRWUNJK0FNTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhQL2dNTGZ3RkJBQXQvQVVIdy9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmdBSUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVHQTl3SUxmd0ZCZ0lBSUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSFYvZ01MZndGQkFBdC9BVUhSL2dNTGZ3RkIwdjREQzM4QlFkUCtBd3QvQVVIVS9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZWorQXd0L0FVSHIvZ01MZndGQjZmNERDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVGL0MzOEJRWDhMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFR0FnS3dFQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFmLy9Bd3QvQUVHQWtBUUxmd0JCZ0pBRUMzOEFRWUFFQzM4QVFZRFlCUXQvQUVHQW1BNExmd0JCZ0pnYUMzOEFRWUQ0SXd0L0FFR0ErQ3NMZndCQmdQZ3pDd2ZqRFU4R2JXVnRiM0o1QWdBR1kyOXVabWxuQUJVTVpYaGxZM1YwWlVaeVlXMWxBT0VCR1dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzhBNHdFTFpYaGxZM1YwWlZOMFpYQUE0QUVKYzJGMlpWTjBZWFJsQVBFQkNXeHZZV1JUZEdGMFpRRC9BUTVvWVhORGIzSmxVM1JoY25SbFpBQ0FBZzV6WlhSS2IzbHdZV1JUZEdGMFpRQ0dBaDluWlhST2RXMWlaWEpQWmxOaGJYQnNaWE5KYmtGMVpHbHZRblZtWm1WeUFPSUJFR05zWldGeVFYVmthVzlDZFdabVpYSUErUUVYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERBQk5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXdFU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF3SWVRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdNYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREJCWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdVU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3WWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJ4eEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2dTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdrT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQ2hGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNTERWZFBVa3RmVWtGTlgxTkpXa1VERENaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTU5JazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVUREaGhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNEREeFJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNUUZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9BeEVRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1TR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01URkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF4UU9SbEpCVFVWZlRFOURRVlJKVDA0REZRcEdVa0ZOUlY5VFNWcEZBeFlYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERGeE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhnU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4a09WRWxNUlY5RVFWUkJYMU5KV2tVREdoSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERHdzVQUVUxZlZFbE1SVk5mVTBsYVJRTWNGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZEVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF4NFdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNZkVrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTWdGa05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0RElSSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURJaUZuWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUUFBZ3huWlhSU1pXZHBjM1JsY2tFQWh3SU1aMlYwVW1WbmFYTjBaWEpDQUlnQ0RHZGxkRkpsWjJsemRHVnlRd0NKQWd4blpYUlNaV2RwYzNSbGNrUUFpZ0lNWjJWMFVtVm5hWE4wWlhKRkFJc0NER2RsZEZKbFoybHpkR1Z5U0FDTUFneG5aWFJTWldkcGMzUmxja3dBalFJTVoyVjBVbVZuYVhOMFpYSkdBSTRDRVdkbGRGQnliMmR5WVcxRGIzVnVkR1Z5QUk4Q0QyZGxkRk4wWVdOclVHOXBiblJsY2dDUUFobG5aWFJQY0dOdlpHVkJkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFCa0lYM05sZEdGeVoyTUFsZ0lkWkhKaGQwSmhZMnRuY205MWJtUk5ZWEJVYjFkaGMyMU5aVzF2Y25rQWxRSVlaSEpoZDFScGJHVkVZWFJoVkc5WFlYTnRUV1Z0YjNKNUFKTUNCblZ3WkdGMFpRRGhBUTFsYlhWc1lYUnBiMjVUZEdWd0FPQUJFbWRsZEVGMVpHbHZVWFZsZFdWSmJtUmxlQURpQVE5eVpYTmxkRUYxWkdsdlVYVmxkV1VBK1FFT2QyRnpiVTFsYlc5eWVWTnBlbVVEOEFFY2QyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVk1iMk5oZEdsdmJnUHhBUmgzWVhOdFFtOTVTVzUwWlhKdVlXeFRkR0YwWlZOcGVtVUQ4Z0VkWjJGdFpVSnZlVWx1ZEdWeWJtRnNUV1Z0YjNKNVRHOWpZWFJwYjI0RDh3RVpaMkZ0WlVKdmVVbHVkR1Z5Ym1Gc1RXVnRiM0o1VTJsNlpRUDBBUk4yYVdSbGIwOTFkSEIxZEV4dlkyRjBhVzl1QS9VQkltWnlZVzFsU1c1UWNtOW5jbVZ6YzFacFpHVnZUM1YwY0hWMFRHOWpZWFJwYjI0RCtBRWJaMkZ0WldKdmVVTnZiRzl5VUdGc1pYUjBaVXh2WTJGMGFXOXVBL1lCRjJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWVGFYcGxBL2NCRldKaFkydG5jbTkxYm1STllYQk1iMk5oZEdsdmJnUDVBUXQwYVd4bFJHRjBZVTFoY0FQNkFSTnpiM1Z1WkU5MWRIQjFkRXh2WTJGMGFXOXVBL3NCRVdkaGJXVkNlWFJsYzB4dlkyRjBhVzl1QS8wQkZHZGhiV1ZTWVcxQ1lXNXJjMHh2WTJGMGFXOXVBL3dCQ0FLVUFnclZ4UUdYQWlzQkFuOGpMU0VCSXk1RklnSUVRQ0FCUlNFQ0N5QUNCRUJCQVNFQkN5QUJRUTUwSUFCQmdJQUJhMm9MRHdBak1VRU5kQ0FBUVlEQUFtdHFDN2NCQVFKL0FrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFTWRTSUNJUUVnQWtVTkFBSkFJQUZCQVdzT0RRRUJBUUlDQWdJREF3UUVCUVlBQ3d3R0N5QUFRWUQ0TTJvUEN5QUFFQUJCZ1BnemFnOExRUUFoQVNNdkJFQWpNQkFEUVFGeElRRUxJQUJCZ0pCK2FpQUJRUTEwYWc4TElBQVFBVUdBK0N0cUR3c2dBRUdBa0g1cUR3dEJBQ0VCSXk4RVFDTXlFQU5CQjNFaEFRc2dBVUVCU0FSQVFRRWhBUXNnQUNBQlFReDBha0dBOEgxcUR3c2dBRUdBVUdvTENRQWdBQkFDTFFBQUM1RUJBRUVBSkROQkFDUTBRUUFrTlVFQUpEWkJBQ1EzUVFBa09FRUFKRGxCQUNRNlFRQWtPMEVBSkR4QkFDUTlRUUFrUGtFQUpEOUJBQ1JBSXk4RVFFRVJKRFJCZ0FFa08wRUFKRFZCQUNRMlFmOEJKRGRCMWdBa09FRUFKRGxCRFNRNkJVRUJKRFJCc0FFa08wRUFKRFZCRXlRMlFRQWtOMEhZQVNRNFFRRWtPVUhOQUNRNkMwR0FBaVE5UWY3L0F5UThDNlFCQVFKL1FRQWtRVUVCSkVKQnh3SVFBeUVCUVFBa1EwRUFKRVJCQUNSRlFRQWtSa0VBSkM0Z0FRUkFJQUZCQVU0aUFBUkFJQUZCQTB3aEFBc2dBQVJBUVFFa1JBVWdBVUVGVGlJQUJFQWdBVUVHVENFQUN5QUFCRUJCQVNSRkJTQUJRUTlPSWdBRVFDQUJRUk5NSVFBTElBQUVRRUVCSkVZRklBRkJHVTRpQUFSQUlBRkJIa3doQUFzZ0FBUkFRUUVrTGdzTEN3c0ZRUUVrUXd0QkFTUXRRUUFrTVFzTEFDQUFFQUlnQVRvQUFBc3ZBRUhSL2dOQi93RVFCa0hTL2dOQi93RVFCa0hUL2dOQi93RVFCa0hVL2dOQi93RVFCa0hWL2dOQi93RVFCZ3VZQVFCQkFDUkhRUUFrU0VFQUpFbEJBQ1JLUVFBa1MwRUFKRXhCQUNSTkl5OEVRRUdSQVNSSlFjRCtBMEdSQVJBR1FjSCtBMEdCQVJBR1FjVCtBMEdRQVJBR1FjZitBMEg4QVJBR0JVR1JBU1JKUWNEK0EwR1JBUkFHUWNIK0EwR0ZBUkFHUWNiK0EwSC9BUkFHUWNmK0EwSDhBUkFHUWNqK0EwSC9BUkFHUWNuK0EwSC9BUkFHQzBIUC9nTkJBQkFHUWZEK0EwRUJFQVlMVHdBakx3UkFRZWorQTBIQUFSQUdRZW4rQTBIL0FSQUdRZXIrQTBIQkFSQUdRZXYrQTBFTkVBWUZRZWorQTBIL0FSQUdRZW4rQTBIL0FSQUdRZXIrQTBIL0FSQUdRZXYrQTBIL0FSQUdDd3N2QUVHUS9nTkJnQUVRQmtHUi9nTkJ2d0VRQmtHUy9nTkI4d0VRQmtHVC9nTkJ3UUVRQmtHVS9nTkJ2d0VRQmdzc0FFR1YvZ05CL3dFUUJrR1cvZ05CUHhBR1FaZitBMEVBRUFaQm1QNERRUUFRQmtHWi9nTkJ1QUVRQmdzeUFFR2EvZ05CL3dBUUJrR2IvZ05CL3dFUUJrR2MvZ05CbndFUUJrR2QvZ05CQUJBR1FaNytBMEc0QVJBR1FRRWtYZ3N0QUVHZi9nTkIvd0VRQmtHZy9nTkIvd0VRQmtHaC9nTkJBQkFHUWFMK0EwRUFFQVpCby80RFFiOEJFQVlMT0FCQkR5UmZRUThrWUVFUEpHRkJEeVJpUVFBa1kwRUFKR1JCQUNSbFFRQWtaa0gvQUNSblFmOEFKR2hCQVNScFFRRWtha0VBSkdzTFp3QkJBQ1JPUVFBa1QwRUFKRkJCQVNSUlFRRWtVa0VCSkZOQkFTUlVRUUVrVlVFQkpGWkJBU1JYUVFFa1dFRUJKRmxCQUNSYVFRQWtXMEVBSkZ4QkFDUmRFQW9RQ3hBTUVBMUJwUDREUWZjQUVBWkJwZjREUWZNQkVBWkJwdjREUWZFQkVBWVFEZ3NOQUNBQlFRRWdBSFJ4UVFCSEMya0JBbjlCZ0FJaEFDTXpCRUJCZ0FRaEFBc0NRQUpBQWtBamNTSUJCRUFnQVVFQlJnMEJJQUZCQWtZTkFnd0RDMEdBQ0NFQUl6TUVRRUdBRUNFQUN5QUFEd3RCRUNFQUl6TUVRRUVnSVFBTElBQVBDMEhBQUNFQUl6TUVRRUgrQUNFQUN5QUFEd3NnQUFzZ0FFRUNJQUFRRUNSd0kzQkZCRUFQQ3lBQVFRTnhKSEZCQUNSeUVCRWtkQXRRQUVFQUpHeEJBQ1J0UVFBa2JrRUFKRzlCQUNSd1FRQWtjVUVBSkhKQkFDUnpJeThFUUVHRS9nTkJMeEFHUVM4a2JRVkJoUDREUWFzQkVBWkJxd0VrYlF0QmgvNERRZmdCRUFaQitBRVFFZ3ZKQVFFQ2YwSERBaEFESWdGQndBRkdJZ0JGQkVBakpRUi9JQUZCZ0FGR0JTTWxDeUVBQ3lBQUJFQkJBU1F2QlVFQUpDOExFQVFRQlJBSEVBZ1FDUkFQRUJNakx3UkFRZkQrQTBINEFSQUdRYy8rQTBIK0FSQUdRYzMrQTBIK0FCQUdRWUQrQTBIUEFSQUdRWUwrQTBIOEFCQUdRWS8rQTBIaEFSQUdRZXorQTBIK0FSQUdRZlgrQTBHUEFSQUdCVUh3L2dOQi93RVFCa0hQL2dOQi93RVFCa0hOL2dOQi93RVFCa0dBL2dOQnp3RVFCa0dDL2dOQi9nQVFCa0dQL2dOQjRRRVFCZ3RCQUNRakM1MEJBQ0FBUVFCS0JFQkJBU1FrQlVFQUpDUUxJQUZCQUVvRVFFRUJKQ1VGUVFBa0pRc2dBa0VBU2dSQVFRRWtKZ1ZCQUNRbUN5QURRUUJLQkVCQkFTUW5CVUVBSkNjTElBUkJBRW9FUUVFQkpDZ0ZRUUFrS0FzZ0JVRUFTZ1JBUVFFa0tRVkJBQ1FwQ3lBR1FRQktCRUJCQVNRcUJVRUFKQ29MSUFkQkFFb0VRRUVCSkNzRlFRQWtLd3NnQ0VFQVNnUkFRUUVrTEFWQkFDUXNDeEFVQ3hBQUl6TUVRRUdneVFnUEMwSFFwQVFMQ1FBZ0FFSC8vd054Q3dzQUl6MUJBV29RRnhBREN3WUFJejBRQXdzU0FDQUFRZjhCY1VFSWRDQUJRZjhCY1hJTEVBQVFHRUgvQVhFUUdVSC9BWEVRR2dzTUFDQUFRWUQrQTNGQkNIVUxDQUFnQUVIL0FYRUw3QUlCQW44alF3UkFEd3NnQUVIL1Awd0VRQ05GQkg5QkJDQUJRZjhCY1JBUVJRVWpSUXNpQUVVRVFDQUJRUTl4SWdJRVFDQUNRUXBHQkVCQkFTUkJDd1ZCQUNSQkN3c0ZJQUJCLy84QVRBUkFJeTVGSWdKRkJFQWdBRUgvM3dCTUlRSUxJQUlFUUNORkJFQWdBVUVQY1NRdEN5QUJJUUlqUkFSQUlBSkJIM0VoQWlNdFFlQUJjU1F0QlNOR0JFQWdBa0gvQUhFaEFpTXRRWUFCY1NRdEJTTXVCRUJCQUNRdEN3c0xJeTBnQW5Ja0xRVkJBQ0VDSXkwUUhTRURJQUZCQUVvRVFFRUJJUUlMSUFJZ0F4QWFKQzBMQlNORlJTSURCRUFnQUVIL3Z3Rk1JUU1MSUFNRVFDTkVCSDhqUWdValJBc2lBQVJBSXkxQkgzRWtMU010SUFGQjRBRnhjaVF0RHdzalJnUkFJQUZCQ0U0aUF3UkFJQUZCREV3aEF3c0xJQUVoQXlNdUJIOGdBMEVQY1FVZ0EwRURjUXNpQXlReEJTTkZSU0lEQkVBZ0FFSC8vd0ZNSVFNTElBTUVRQ05FQkVCQkFDQUJRZjhCY1JBUUJFQkJBU1JDQlVFQUpFSUxDd3NMQ3dzTERnQWpNd1JBUWE0QkR3dEIxd0FMRUFBak13UkFRWUNBQVE4TFFZREFBQXNvQVFGL0kzWkJBRW9pQUFSQUkzY2hBQXNnQUFSQUkzWkJBV3NrZGdzamRrVUVRRUVBSkhnTEN5Z0JBWDhqZVVFQVNpSUFCRUFqZWlFQUN5QUFCRUFqZVVFQmF5UjVDeU41UlFSQVFRQWtld3NMS0FFQmZ5TjhRUUJLSWdBRVFDTjlJUUFMSUFBRVFDTjhRUUZySkh3TEkzeEZCRUJCQUNSK0N3c3FBUUYvSTM5QkFFb2lBQVJBSTRBQklRQUxJQUFFUUNOL1FRRnJKSDhMSTM5RkJFQkJBQ1NCQVFzTElnRUJmeU9GQVNPR0FYVWhBQ09IQVFSL0k0VUJJQUJyQlNPRkFTQUFhZ3NpQUF0RkFRSi9RWlQrQXhBRFFmZ0JjU0VCUVpQK0F5QUFRZjhCY1NJQ0VBWkJsUDRESUFFZ0FFRUlkU0lBY2hBR0lBSWtpQUVnQUNTSkFTT0pBVUVJZENPSUFYSWtpZ0VMT0FFQ2Z4QWxJZ0JCL3c5TUlnRUVRQ09HQVVFQVNpRUJDeUFCQkVBZ0FDU0ZBU0FBRUNZUUpTRUFDeUFBUWY4UFNnUkFRUUFrZUFzTEx3QWpnZ0ZCQVdza2dnRWpnZ0ZCQUV3RVFDT0RBU1NDQVNPRUFRUi9JNE1CUVFCS0JTT0VBUXNFUUJBbkN3c0xZQUVCZnlPTEFVRUJheVNMQVNPTEFVRUFUQVJBSTR3QkpJc0JJNHNCQkVBampRRUVmeU9PQVVFUFNBVWpqUUVMSWdBRVFDT09BVUVCYWlTT0FRVWpqUUZGSWdBRVFDT09BVUVBU2lFQUN5QUFCRUFqamdGQkFXc2tqZ0VMQ3dzTEMyQUJBWDhqandGQkFXc2tqd0VqandGQkFFd0VRQ09RQVNTUEFTT1BBUVJBSTVFQkJIOGprZ0ZCRDBnRkk1RUJDeUlBQkVBamtnRkJBV29ra2dFRkk1RUJSU0lBQkVBamtnRkJBRW9oQUFzZ0FBUkFJNUlCUVFGckpKSUJDd3NMQ3d0Z0FRRi9JNU1CUVFGckpKTUJJNU1CUVFCTUJFQWpsQUVra3dFamt3RUVRQ09WQVFSL0k1WUJRUTlJQlNPVkFRc2lBQVJBSTVZQlFRRnFKSllCQlNPVkFVVWlBQVJBSTVZQlFRQktJUUFMSUFBRVFDT1dBVUVCYXlTV0FRc0xDd3NMalFFQkFYOGpXaUFBYWlSYUkxb1FJRTRFUUNOYUVDQnJKRm9DUUFKQUFrQUNRQUpBSTF3aUFRUkFBa0FnQVVFQ2F3NEdBZ0FEQUFRRkFBc01CUXNRSVJBaUVDTVFKQXdFQ3hBaEVDSVFJeEFrRUNnTUF3c1FJUkFpRUNNUUpBd0NDeEFoRUNJUUl4QWtFQ2dNQVFzUUtSQXFFQ3NMSTF4QkFXb2tYQ05jUVFoT0JFQkJBQ1JjQzBFQkR3dEJBQXNkQUNPWEFTQUFhaVNYQVNPWUFTT1hBV3RCQUVvRVFFRUFEd3RCQVF1REFRRUJmd0pBQWtBQ1FBSkFJQUJCQVVjRVFDQUFJZ0ZCQWtZTkFTQUJRUU5HRFFJZ0FVRUVSZzBEREFRTEkyTWptUUZIQkVBam1RRWtZMEVCRHd0QkFBOExJMlFqbWdGSEJFQWptZ0VrWkVFQkR3dEJBQThMSTJVam13RkhCRUFqbXdFa1pVRUJEd3RCQUE4TEkyWWpuQUZIQkVBam5BRWtaa0VCRHd0QkFBOExRUUFMSFFBam5RRWdBR29rblFFam5nRWpuUUZyUVFCS0JFQkJBQThMUVFFTEtRQWpud0VnQUdva253RWpvQUVqbndGclFRQktJZ0FFUUNOZVJTRUFDeUFBQkVCQkFBOExRUUVMSFFBam9RRWdBR29rb1FFam9nRWpvUUZyUVFCS0JFQkJBQThMUVFFTEhRQkJnQkFqaWdGclFRSjBKSmdCSXpNRVFDT1lBVUVCZENTWUFRc0xSUUVCZndKQUFrQUNRQ0FBUVFGSEJFQWdBQ0lDUVFKR0RRRWdBa0VEUmcwQ0RBTUxJQUZCZ1FFUUVBOExJQUZCaHdFUUVBOExJQUZCL2dBUUVBOExJQUZCQVJBUUMzMEJBWDhqbUFFZ0FHc2ttQUVqbUFGQkFFd0VRQ09ZQVNFQUVESWptQUVnQUVFQUlBQnJJQUJCQUVvYmF5U1lBU09qQVVFQmFpU2pBU09qQVVFSVRnUkFRUUFrb3dFTEN5TjRCSDhqbVFFRkkzZ0xJZ0FFZnlPT0FRVkJEdzhMSVFCQkFTRUJJNlFCSTZNQkVETkZCRUJCZnlFQkN5QUJJQUJzUVE5cUN4SUJBWDhqbHdFaEFFRUFKSmNCSUFBUU5Bc2RBRUdBRUNPbEFXdEJBblFrbmdFak13UkFJNTRCUVFGMEpKNEJDd3Q5QVFGL0k1NEJJQUJySko0Qkk1NEJRUUJNQkVBam5nRWhBQkEySTU0QklBQkJBQ0FBYXlBQVFRQktHMnNrbmdFanBnRkJBV29rcGdFanBnRkJDRTRFUUVFQUpLWUJDd3NqZXdSL0k1b0JCU043Q3lJQUJIOGprZ0VGUVE4UEN5RUFRUUVoQVNPbkFTT21BUkF6UlFSQVFYOGhBUXNnQVNBQWJFRVBhZ3NTQVFGL0k1MEJJUUJCQUNTZEFTQUFFRGNMSFFCQmdCQWpxQUZyUVFGMEpLQUJJek1FUUNPZ0FVRUJkQ1NnQVFzTGhBSUJBbjhqb0FFZ0FHc2tvQUVqb0FGQkFFd0VRQ09nQVNFQ0VEa2pvQUVnQWtFQUlBSnJJQUpCQUVvYmF5U2dBU09wQVVFQmFpU3BBU09wQVVFZ1RnUkFRUUFrcVFFTEMwRUFJUUlqcWdFaEFDTitCSDhqbXdFRkkzNExJZ0VFUUNOZUJFQkJuUDRERUFOQkJYVkJEM0VpQUNTcUFVRUFKRjRMQlVFUER3c2pxUUZCQW0xQnNQNERhaEFESVFFanFRRkJBbThFZnlBQlFROXhCU0FCUVFSMVFROXhDeUVCQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVNBQVFRSkdEUUlNQXdzZ0FVRUVkU0VCREFNTFFRRWhBZ3dDQ3lBQlFRRjFJUUZCQWlFQ0RBRUxJQUZCQW5VaEFVRUVJUUlMSUFKQkFFb0VmeUFCSUFKdEJVRUFDeUlCUVE5cUN4SUJBWDhqbndFaEFFRUFKSjhCSUFBUU9nc2JBUUYvSTZzQkk2d0JkQ0VBSXpNRVFDQUFRUUYwSVFBTElBQUxyd0VCQVg4am9nRWdBR3Nrb2dFam9nRkJBRXdFUUNPaUFTRUFFRHdrb2dFam9nRWdBRUVBSUFCcklBQkJBRW9iYXlTaUFTT3RBVUVCY1NFQkk2MEJRUUYxUVFGeElRQWpyUUZCQVhVa3JRRWpyUUVnQVNBQWN5SUJRUTUwY2lTdEFTT3VBUVJBSTYwQlFiOS9jU1N0QVNPdEFTQUJRUVowY2lTdEFRc0xJNEVCQkg4am5BRUZJNEVCQ3lJQUJIOGpsZ0VGUVE4UEN5RUJRUUFqclFFUUVBUi9RWDhGUVFFTElnQWdBV3hCRDJvTEVnRUJmeU9oQVNFQVFRQWtvUUVnQUJBOUN4SUFJek1FUUVHQWdJQUVEd3RCZ0lDQUFnc0VBQkEvQ3dRQUlBQUxNZ0FnQUVFOFJnUkFRZjhBRHdzZ0FFRThhMEdnalFac0lBRnNRUWh0UWFDTkJtMUJQR3BCb0kwR2JFR004UUp0RUVFTHVBRUJBWDlCQUNScEkxRUVmeUFBQlVFUEN5RUVJMUlFZnlBRUlBRnFCU0FFUVE5cUN5RUVJMU1FZnlBRUlBSnFCU0FFUVE5cUN5RUVJMVFFZnlBRUlBTnFCU0FFUVE5cUN5RUVJMVVFZnlBQUJVRVBDeUVBSTFZRWZ5QUFJQUZxQlNBQVFROXFDeUVBSTFjRWZ5QUFJQUpxQlNBQVFROXFDeUVBSTFnRWZ5QUFJQU5xQlNBQVFROXFDeUVBUVFBa2FrRUFKR3NnQkNOUFFRRnFFRUloQVNBQUkxQkJBV29RUWlFQUlBRWtaeUFBSkdnZ0FTQUFFQm9MSlFFQmZ5QUNRUUYwUVlENEkyb2lBeUFBUVFGcU9nQUFJQU5CQVdvZ0FVRUJham9BQUF1UUFnRUVmeUFBRUMwaUFVVUVRRUVCRUM0aEFRc2dBQkF2SWdKRkJFQkJBaEF1SVFJTElBQVFNQ0lEUlFSQVFRTVFMaUVEQ3lBQUVERWlCRVVFUUVFRUVDNGhCQXNnQVVFQmNRUkFFRFVrWHdzZ0FrRUJjUVJBRURna1lBc2dBMEVCY1FSQUVEc2tZUXNnQkVFQmNRUkFFRDRrWWdzZ0FVRUJjVVVFUUNBQ0lRRUxJQUZCQVhGRkJFQWdBeUVCQ3lBQlFRRnhSUVJBSUFRaEFRc2dBVUVCY1FSQVFRRWthd3NqV3lBQUk2OEJiR29rV3lOYkVFQk9CRUFqV3hCQWF5UmJJMnNFZnlOckJTTnBDeUlCUlFSQUkyb2hBUXNnQVFSQUkxOGpZQ05oSTJJUVF4b0xJMmRCQVdvamFFRUJhaU5kRUVRalhVRUJhaVJkSTEwanNBRkJBbTFCQVd0T0JFQWpYVUVCYXlSZEN3c0xmd0VFZnlBQUVEUWhBU0FBRURjaEFpQUFFRG9oQXlBQUVEMGhCQ0FCSkY4Z0FpUmdJQU1rWVNBRUpHSWpXeUFBSTY4QmJHb2tXeU5iRUVCT0JFQWpXeEJBYXlSYklBRWdBaUFESUFRUVF5SUFFQnhCQVdvZ0FCQWRRUUZxSTEwUVJDTmRRUUZxSkYwalhTT3dBVUVDYlVFQmEwNEVRQ05kUVFGckpGMExDd3NqQVFGL0lBQVFMQ0VCSXlvRWZ5QUJSUVVqS2dzaUFRUkFJQUFRUlFVZ0FCQkdDd3NqQUNOT0VCOUlCRUFQQ3dOQUkwNFFIMDRFUUJBZkVFY2pUaEFmYXlST0RBRUxDd3NmQUNBQVFmQUFjVUVFZFNTREFVRURJQUFRRUNTSEFTQUFRUWR4SklZQkN3c0FRUWNnQUJBUUpKc0JDeDRBSUFCQkJuVkJBM0VrcEFFZ0FFRS9jU1N4QVVIQUFDT3hBV3NrZGdzZUFDQUFRUVoxUVFOeEpLY0JJQUJCUDNFa3NnRkJ3QUFqc2dGckpIa0xFQUFnQUNTekFVR0FBaU96QVdza2ZBc1RBQ0FBUVQ5eEpMUUJRY0FBSTdRQmF5Ui9DeW9BSUFCQkJIVkJEM0VrdFFGQkF5QUFFQkFralFFZ0FFRUhjU1NNQVNBQVFmZ0JjVUVBU2lTWkFRc3FBQ0FBUVFSMVFROXhKTFlCUVFNZ0FCQVFKSkVCSUFCQkIzRWtrQUVnQUVINEFYRkJBRW9rbWdFTERRQWdBRUVGZFVFUGNTUzNBUXNxQUNBQVFRUjFRUTl4SkxnQlFRTWdBQkFRSkpVQklBQkJCM0VrbEFFZ0FFSDRBWEZCQUVva25BRUxGQUFnQUNTSUFTT0pBVUVJZENPSUFYSWtpZ0VMRkFBZ0FDUzVBU082QVVFSWRDTzVBWElrcFFFTEZBQWdBQ1M3QVNPOEFVRUlkQ083QVhJa3FBRUxoQUVCQVg4Z0FFRUVkU1NzQVVFRElBQVFFQ1N1QVNBQVFRZHhKTDBCQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ085QVNJQkJFQUNRQ0FCUVFGckRnY0NBd1FGQmdjSUFBc01DQXRCQ0NTckFROExRUkFrcXdFUEMwRWdKS3NCRHd0Qk1DU3JBUThMUWNBQUpLc0JEd3RCMEFBa3F3RVBDMEhnQUNTckFROExRZkFBSktzQkN3c2ZBRUVHSUFBUUVDUjNJQUJCQjNFa2lRRWppUUZCQ0hRamlBRnlKSW9CQzJZQkFYOUJBU1I0STNaRkJFQkJ3QUFrZGdzUU1pT01BU1NMQVNPMUFTU09BU09LQVNTRkFTT0RBU1NDQVNPREFVRUFTaUlBQkVBamhnRkJBRW9oQUFzZ0FBUkFRUUVraEFFRlFRQWtoQUVMSTRZQlFRQktCRUFRSndzam1RRkZCRUJCQUNSNEN3c2ZBRUVHSUFBUUVDUjZJQUJCQjNFa3VnRWp1Z0ZCQ0hRanVRRnlKS1VCQ3lvQVFRRWtleU41UlFSQVFjQUFKSGtMRURZamtBRWtqd0VqdGdFa2tnRWptZ0ZGQkVCQkFDUjdDd3NmQUVFR0lBQVFFQ1I5SUFCQkIzRWt2QUVqdkFGQkNIUWp1d0Z5SktnQkN5TUFRUUVrZmlOOFJRUkFRWUFDSkh3TEVEbEJBQ1NwQVNPYkFVVUVRRUVBSkg0TEN3c0FRUVlnQUJBUUpJQUJDellBUVFFa2dRRWpmMFVFUUVIQUFDUi9DeEE4SktJQkk1UUJKSk1CSTdnQkpKWUJRZi8vQVNTdEFTT2NBVVVFUUVFQUpJRUJDd3NUQUNBQVFRUjFRUWR4SkU4Z0FFRUhjU1JRQzBJQVFRY2dBQkFRSkZSQkJpQUFFQkFrVTBFRklBQVFFQ1JTUVFRZ0FCQVFKRkZCQXlBQUVCQWtXRUVDSUFBUUVDUlhRUUVnQUJBUUpGWkJBQ0FBRUJBa1ZRc0tBRUVISUFBUUVDUlpDL3NDQVFGL0FrQWdBRUdtL2dOSElnSUVRQ05aUlNFQ0N5QUNCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFrR1EvZ05IQkVBQ1FDQUNRWkgrQTJzT0ZnTUhDdzhBQkFnTUVBSUZDUTBSQUFZS0RoSVRGQlVBQ3d3VkN5QUJFRWtNRlFzZ0FSQktEQlFMSUFFUVN3d1RDeUFCRUV3TUVnc2dBUkJOREJFTElBRVFUZ3dRQ3lBQkVFOE1Ed3NnQVJCUURBNExRUUVrWGlBQkVGRU1EUXNnQVJCU0RBd0xJQUVRVXd3TEN5QUJFRlFNQ2dzZ0FSQlZEQWtMSUFFUVZnd0lDMEVISUFFUUVBUkFJQUVRVnhCWUN3d0hDMEVISUFFUUVBUkFJQUVRV1JCYUN3d0dDMEVISUFFUUVBUkFJQUVRV3hCY0N3d0ZDMEVISUFFUUVBUkFJQUVRWFJCZUN3d0VDeUFCRUY5QkFTUnBEQU1MSUFFUVlFRUJKR29NQWdzZ0FSQmhRUWNnQVJBUVJRUkFBa0JCa1A0RElRSURRQ0FDUWFiK0EwNE5BU0FDUVFBUUJpQUNRUUZxSVFJTUFBQUxBQXNMREFFTFFRRVBDMEVCQzBvQVFRY2dBQkFRSkw0QlFRWWdBQkFRSkw4QlFRVWdBQkFRSk1BQlFRUWdBQkFRSk1FQlFRTWdBQkFRSk1JQlFRSWdBQkFRSk1NQlFRRWdBQkFRSk1RQlFRQWdBQkFRSk1VQkN6NEJBWDhnQUVFSWRDRUJBa0JCQUNFQUEwQWdBRUdmQVVvTkFTQUFRWUQ4QTJvZ0FTQUFhaEFERUFZZ0FFRUJhaUVBREFBQUN3QUxRWVFGSk1jQkN3b0FJQUZCQVNBQWRISUxFd0FqeWdFUUF5UExBUkFERUJwQjhQOERjUXNYQUNQTUFSQURJODBCRUFNUUdrSHdQM0ZCZ0lBQ2Fnc05BQ0FCUVFFZ0FIUkJmM054QzNBQkFYOGdBRUdtL2dOR0JFQkJwdjRERUFOQmdBRnhJUUVqZUFSL1FRQWdBUkJsQlVFQUlBRVFhQXNhSTNzRWYwRUJJQUVRWlFWQkFTQUJFR2dMR2lOK0JIOUJBaUFCRUdVRlFRSWdBUkJvQ3hvamdRRUVmMEVESUFFUVpRVkJBeUFCRUdnTEdpQUJRZkFBY2c4TFFYOEx4QUVCQVg4ajBRRWhBQ1BTQVFSQUk5TUJCSDlCQWlBQUVHZ0ZRUUlnQUJCbEN5RUFJOVFCQkg5QkFDQUFFR2dGUVFBZ0FCQmxDeUVBSTlVQkJIOUJBeUFBRUdnRlFRTWdBQkJsQ3lFQUk5WUJCSDlCQVNBQUVHZ0ZRUUVnQUJCbEN5RUFCU1BYQVFSQUk5Z0JCSDlCQUNBQUVHZ0ZRUUFnQUJCbEN5RUFJOWtCQkg5QkFTQUFFR2dGUVFFZ0FCQmxDeUVBSTlvQkJIOUJBaUFBRUdnRlFRSWdBQkJsQ3lFQUk5c0JCSDlCQXlBQUVHZ0ZRUU1nQUJCbEN5RUFDd3NnQUVId0FYSUxnZ0lCQVg4Z0FFR0FnQUpJQkVCQmZ3OExJQUJCZ0lBQ1RpSUJCRUFnQUVHQXdBSklJUUVMSUFFRVFFRi9Ed3NnQUVHQXdBTk9JZ0VFUUNBQVFZRDhBMGdoQVFzZ0FRUkFJQUJCZ0VCcUVBTVBDeUFBUVlEOEEwNGlBUVJBSUFCQm4vMERUQ0VCQ3lBQkJFQWpkVUVDU0FSQVFmOEJEd3RCZnc4TElBQkJ4UDREUmdSQUlBQWpTUkFHSTBrUEN5QUFRWkQrQTA0aUFRUkFJQUJCcHY0RFRDRUJDeUFCQkVBUVNDQUFFR2tQQ3lBQVFiRCtBMDRpQVFSQUlBQkJ2LzREVENFQkN5QUJCRUFRU0VGL0R3c2dBRUdFL2dOR0JFQWdBQ050RUFZamJROExJQUJCaGY0RFJnUkFJQUFqYmhBR0kyNFBDeUFBUVlEK0EwWUVRQkJxRHd0QmZ3c2JBUUYvSUFBUWF5SUJRWDlHQkVBZ0FCQUREd3NnQVVIL0FYRUxaZ0VEZndKQUEwQWdBeUFDVGcwQklBQWdBMm9RYkNFRklBRWdBMm9oQkFOQUlBUkIvNzhDU2dSQUlBUkJnRUJxSVFRTUFRc0xJQVFnQlJCL0lBTkJBV29oQXd3QUFBc0FDMEVnSVFNak13UkFRY0FBSVFNTEk4Y0JJQU1nQWtFUWJXeHFKTWNCQzRnQkFRTi9JeTlGQkVBUEN5UEpBUVIvUVFjZ0FCQVFSUVVqeVFFTElnRUVRRUVBSk1rQkk4Z0JFQU1oQVNQSUFVRUhJQUVRWlJBR0R3c1FaaUVCRUdjaEFrRUhJQUFRYUVFQmFrRUVkQ0VEUVFjZ0FCQVFCRUJCQVNUSkFTQURKTTRCSUFFa3p3RWdBaVRRQVNQSUFVRUhJQUFRYUJBR0JTQUJJQUlnQXhCdEk4Z0JRZjhCRUFZTEN5WUJBWDhnQUVFL2NTRURJQUpCQVhFRVFDQURRVUJySVFNTElBTkJnSkFFYWlBQk9nQUFDeGdBUVFjZ0FCQVFCRUFnQVVFSElBQkJBV29RWlJBR0N3dElBUUovSUFBajNnRkdJZ0pGQkVBZ0FDUGRBVVloQWdzZ0FnUkFRUVlnQUVFQmF4QURFR2doQWlBQUk5MEJSZ1JBUVFFaEF3c2dBaUFCSUFNUWJ5QUNJQUJCQVdzUWNBc0xCUUJCZ0FJTExBQWpjeUFBYWlSekkzTVFjazRFUUNOekVISnJKSE1qYlVFQmFpUnRJMjFCL3dGS0JFQkJBQ1J0Q3dzTEd3RUJmeUFBUVkvK0F4QURFR1VpQVNUZ0FVR1AvZ01nQVJBR0N3c0FRUUVrM3dGQkFoQjBDejhBSUFBUWN5TndSUVJBRHdzamNpQUFhaVJ5QTBBamNpTjBUZ1JBSTNJamRHc2tjaU51UWY4QlRnUkFJMjhrYmhCMUJTTnVRUUZxSkc0TERBRUxDd3M5QVFGL0VISWhBQ053Qkg4amRDQUFTQVVqY0FzRVFDTjBJUUFMSTJ3Z0FFZ0VRQThMQTBBamJDQUFUZ1JBSUFBUWRpTnNJQUJySkd3TUFRc0xDeFlBUVFBa2JVR0UvZ05CQUJBR1FRQWtjaU52Skc0TEJnQWdBQ1J1Q3dZQUlBQWtid3NmQUNBQVFmOEJjeVRSQVVFRUk5RUJFQkFrMGdGQkJTUFJBUkFRSk5jQkN5c0FRUUFnQUJBUUpPRUJRUUVnQUJBUUpPSUJRUUlnQUJBUUpOOEJRUVFnQUJBUUpPTUJJQUFrNEFFTEt3QkJBQ0FBRUJBazVBRkJBU0FBRUJBazVRRkJBaUFBRUJBazVnRkJCQ0FBRUJBazV3RWdBQ1RvQVF1Y0JRRUJmd0pBQWtBZ0FFR0FnQUpJQkVBZ0FDQUJFQjRNQWdzZ0FFR0FnQUpPSWdJRVFDQUFRWURBQWtnaEFnc2dBZzBBSUFCQmdNQURUaUlDQkVBZ0FFR0EvQU5JSVFJTElBSUVRQ0FBUVlCQWFpQUJFQVlNQVFzZ0FFR0EvQU5PSWdJRVFDQUFRWi85QTB3aEFnc2dBZ1JBSTNWQkFrZ05BZ3dCQ3lBQVFhRDlBMDRpQWdSQUlBQkIvLzBEVENFQ0N5QUNEUUVnQUVHUS9nTk9JZ0lFUUNBQVFhYitBMHdoQWdzZ0FnUkFFRWdnQUNBQkVHSVBDeUFBUWJEK0EwNGlBZ1JBSUFCQnYvNERUQ0VDQ3lBQ0JFQVFTQXNnQUVIQS9nTk9JZ0lFUUNBQVFjditBMHdoQWdzZ0FnUkFJQUJCd1A0RFJnUkFJQUVRWXd3Q0N5QUFRY1QrQTBZRVFFRUFKRWtnQUVFQUVBWU1Bd3NnQUVIRi9nTkdCRUFnQVNUR0FRd0NDeUFBUWNiK0EwWUVRQ0FCRUdRTUFnc0NRQUpBQWtBQ1FDQUFJZ0pCdy80RFJ3UkFBa0FnQWtIQy9nTnJEZ29DQUFBQUFBQUFBQVFEQUFzTUJBc2dBU1JLREFVTElBRWtTd3dFQ3lBQkpFd01Bd3NnQVNSTkRBSUxEQUVMSUFBanlBRkdCRUFnQVJCdURBSUxJQUFqTWtZaUFrVUVRQ0FBSXpCR0lRSUxJQUlFUUNQSkFRUkFJODhCUVlDQUFVNGlBZ1JBSTg4QlFmLy9BVXdoQWdzZ0FrVUVRQ1BQQVVHQW9BTk9JZ0lFUUNQUEFVSC92d05NSVFJTEN5QUNEUU1MQ3lBQUk5d0JUaUlDQkVBZ0FDUGRBVXdoQWdzZ0FnUkFJQUFnQVJCeERBRUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQjNBa0FDUUFKQUFrQWdBQ0lDUVlUK0EwY0VRQUpBSUFKQmhmNERhdzREQWdNRUFBc01CQXNnQVJCNERBWUxJQUVRZVF3RUN5QUJFSG9NQXdzZ0FSQVNEQUlMREFFTElBQkJnUDREUmdSQUlBRVFld3NnQUVHUC9nTkdCRUFnQVJCOERBRUxJQUJCLy84RFJnUkFJQUVRZlF3QkMwRUJEd3RCQVE4TFFRQUxFUUFnQUNBQkVINEVRQ0FBSUFFUUJnc0xMZ0VCZjBFQklBQjBFQjBoQWlBQlFRQktCRUFqT3lBQ2NrSC9BWEVrT3dVak95QUNRZjhCYzNFa093c2pPd3NLQUVFRklBQVFnQUVhQzAwQUlBRkJBRTRFUUNBQVFROXhJQUZCRDNGcUVCMUJFSEVFUUVFQkVJRUJCVUVBRUlFQkN3VWdBVUVBSUFGcklBRkJBRW9iUVE5eElBQkJEM0ZMQkVCQkFSQ0JBUVZCQUJDQkFRc0xDd29BUVFjZ0FCQ0FBUm9MQ2dCQkJpQUFFSUFCR2dzS0FFRUVJQUFRZ0FFYUN4TUFJQUJCQVhRZ0FFSC9BWEZCQjNaeUVCMExNd0VDZnlBQkVCd2hBaUFBUVFGcUlRTWdBQ0FCRUIwaUFSQitCRUFnQUNBQkVBWUxJQU1nQWhCK0JFQWdBeUFDRUFZTEM0TUJBQ0FDUVFGeEJFQWdBRUgvL3dOeElnQWdBV29oQWlBQUlBRnpJQUp6SWdKQkVIRUVRRUVCRUlFQkJVRUFFSUVCQ3lBQ1FZQUNjUVJBUVFFUWhRRUZRUUFRaFFFTEJTQUFJQUZxRUJjaUFpQUFRZi8vQTNGSkJFQkJBUkNGQVFWQkFCQ0ZBUXNnQUNBQmN5QUNjMEdBSUhFUUZ3UkFRUUVRZ1FFRlFRQVFnUUVMQ3dzVEFDQUFRZjhCY1VFQmRpQUFRUWQwY2hBZEM4NEVBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFDUUNBQVFRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3d3VEN4QWJRZi8vQTNFUUhFSC9BWEVrTlJBYlFmLy9BM0VRSFVIL0FYRWtOaU05UVFKcUVCY2tQVUVNRHdzak5TTTJFQm9qTkJCL1FRZ1BDeU0xSXpZUUdrRUJha0gvL3dOeElnQVFIRUgvQVhFa05Rd05DeU0xUVFFUWdnRWpOVUVCYWhBZEpEVWpOUVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUVNRHdzak5VRi9FSUlCSXpWQkFXc1FIU1ExSXpVRVFFRUFFSU1CQlVFQkVJTUJDMEVCRUlRQkRBNExFQmxCL3dGeEpEVU1Dd3NqTkVHQUFYRkJnQUZHQkVCQkFSQ0ZBUVZCQUJDRkFRc2pOQkNHQVNRMERBc0xFQnRCLy84RGNTTThFSWNCSXoxQkFtb1FGeVE5UVJRUEN5TTVJem9RR2lJQUl6VWpOaEFhSWdGQi8vOERjVUVBRUlnQklBQWdBV29RRnlJQUVCeEIvd0Z4SkRrZ0FCQWRRZjhCY1NRNlFRQVFoQUZCQ0E4TEl6VWpOaEFhRUd4Qi93RnhKRFJCQ0E4TEl6VWpOaEFhUVFGckVCY2lBQkFjUWY4QmNTUTFEQVVMSXpaQkFSQ0NBU00yUVFGcUVCMGtOaU0yQkVCQkFCQ0RBUVZCQVJDREFRdEJBQkNFQVF3SEN5TTJRWDhRZ2dFak5rRUJheEFkSkRZak5nUkFRUUFRZ3dFRlFRRVFnd0VMUVFFUWhBRU1CZ3NRR1VIL0FYRWtOZ3dEQ3lNMFFRRnhRUUJMQkVCQkFSQ0ZBUVZCQUJDRkFRc2pOQkNKQVNRMERBTUxRWDhQQ3lBQUVCMUIvd0Z4SkRaQkNBOExJejFCQVdvUUZ5UTlRUWdQQzBFQUVJTUJRUUFRaEFGQkFCQ0JBUXRCQkFzS0FDTTdRUVIyUVFGeEN3MEFJQUJCQVhRUWl3RnlFQjBMS0FFQmYwRUhJQUJCR0hSQkdIVWlBUkFRQkVCQmdBSWdBRUVZZEVFWWRXdEJmMndoQVFzZ0FRc2pBUUYvSUFBUWpRRWhBU005SUFGQkdIUkJHSFZxRUJja1BTTTlRUUZxRUJja1BRc1VBQ0FBUWY4QmNVRUJkaENMQVVFSGRISVFIUXVhQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFUVJ3UkFBa0FnQUVFUmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTHdSQVFRQkJ6ZjRERUd3aUFCQVFCRUJCemY0RFFRZEJBQ0FBRUdnaUFCQVFCSDlCQUNRelFRY2dBQkJvQlVFQkpETkJCeUFBRUdVTElnQVFmMEhNQUE4TEN5TTlRUUZxRUJja1BRd1RDeEFiUWYvL0EzRVFIRUgvQVhFa054QWJRZi8vQTNFUUhVSC9BWEVrT0NNOVFRSnFFQmNrUFVFTUR3c2pOeU00RUJvak5CQi9RUWdQQ3lNM0l6Z1FHa0VCYWhBWElnQVFIRUgvQVhFa053d05DeU0zUVFFUWdnRWpOMEVCYWhBZEpEY2pOd1JBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUVNRHdzak4wRi9FSUlCSXpkQkFXc1FIU1EzSXpjRVFFRUFFSU1CQlVFQkVJTUJDMEVCRUlRQkRBNExFQmxCL3dGeEpEY01Dd3RCQUNFQUl6UkJnQUZ4UVlBQlJnUkFRUUVoQUFzak5CQ01BU1EwREFzTEVCa1FqZ0ZCREE4TEl6a2pPaEFhSWdBak55TTRFQm9pQVVILy93TnhRUUFRaUFFZ0FDQUJhaEFYSWdBUUhFSC9BWEVrT1NBQUVCMUIvd0Z4SkRwQkFCQ0VBVUVJRHdzak55TTRFQnBCLy84RGNSQnNRZjhCY1NRMFFRZ1BDeU0zSXpnUUdrRUJheEFYSWdBUUhFSC9BWEVrTnd3RkN5TTRRUUVRZ2dFak9FRUJhaEFkSkRnak9BUkFRUUFRZ3dFRlFRRVFnd0VMUVFBUWhBRU1Cd3NqT0VGL0VJSUJJemhCQVdzUUhTUTRJemdFUUVFQUVJTUJCVUVCRUlNQkMwRUJFSVFCREFZTEVCbEIvd0Z4SkRnTUF3dEJBQ0VBSXpSQkFYRkJBVVlFUUVFQklRQUxJelFRandFa05Bd0RDMEYvRHdzZ0FCQWRRZjhCY1NRNFFRZ1BDeU05UVFGcUVCY2tQVUVJRHdzZ0FBUkFRUUVRaFFFRlFRQVFoUUVMUVFBUWd3RkJBQkNFQVVFQUVJRUJDMEVFQ3dvQUl6dEJCM1pCQVhFTENnQWpPMEVGZGtFQmNRc0tBQ003UVFaMlFRRnhDOTBGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVNCSEJFQUNRQ0FBUVNGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeENSQVFSQURCTUZFQmtRamdGQkRBOExBQXNRRzBILy93TnhJZ0FRSEVIL0FYRWtPU0FBRUIxQi93RnhKRG9qUFVFQ2FoQVhKRDFCREE4TEl6a2pPaEFhSWdCQi8vOERjU00wRUg4Z0FFRUJhaEFYSWdBUUhFSC9BWEVrT1F3UEN5TTVJem9RR2tFQmFoQVhJZ0FRSEVIL0FYRWtPUXdPQ3lNNVFRRVFnZ0VqT1VFQmFoQWRKRGtqT1FSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFFTUR3c2pPVUYvRUlJQkl6bEJBV3NRSFNRNUl6a0VRRUVBRUlNQkJVRUJFSU1CQzBFQkVJUUJEQTRMRUJsQi93RnhKRGtNREFzUWtnRkJBRXNFUUVFR0lRRUxFSXNCUVFCTEJFQWdBVUhnQUhJaEFRc1Frd0ZCQUVzRWZ5TTBJQUZyRUIwRkl6UkJEM0ZCQ1VzRVFDQUJRUVp5SVFFTEl6UkJtUUZMQkVBZ0FVSGdBSEloQVFzak5DQUJhaEFkQ3lJQUJFQkJBQkNEQVFWQkFSQ0RBUXNnQVVIZ0FIRUVRRUVCRUlVQkJVRUFFSVVCQzBFQUVJRUJJQUFrTkF3TUN4Q1JBVUVBU3dSQUVCa1FqZ0ZCREE4RkRBc0xBQXNqT1NNNkVCb2lBU0FCUWYvL0EzRkJBQkNJQVNBQlFRRjBFQmNpQVJBY1FmOEJjU1E1SUFFUUhVSC9BWEVrT2tFQUVJUUJRUWdQQ3lNNUl6b1FHaUlCUWYvL0EzRVFiRUgvQVhFa05DQUJRUUZxRUJjaUFSQWNRZjhCY1NRNURBWUxJemtqT2hBYVFRRnJFQmNpQVJBY1FmOEJjU1E1REFVTEl6cEJBUkNDQVNNNlFRRnFFQjBrT2lNNkJFQkJBQkNEQVFWQkFSQ0RBUXRCQUJDRUFRd0hDeU02UVg4UWdnRWpPa0VCYXhBZEpEb2pPZ1JBUVFBUWd3RUZRUUVRZ3dFTFFRRVFoQUVNQmdzUUdVSC9BWEVrT2d3RUN5TTBRWDl6UWY4QmNTUTBRUUVRaEFGQkFSQ0JBUXdFQzBGL0R3c2dBUkFkUWY4QmNTUTZRUWdQQ3lBQUVCMUIvd0Z4SkRwQkNBOExJejFCQVdvUUZ5UTlRUWdQQzBFRUM5OEVBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRXdSd1JBQWtBZ0FFRXhhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzUWl3RUVRQXdTQlJBWkVJNEJRUXdQQ3dBTEVCdEIvLzhEY1NROEl6MUJBbW9RRnlROVFRd1BDeU01SXpvUUdpSUFRZi8vQTNFak5CQi9EQTRMSXp4QkFXb1FGeVE4UVFnUEN5TTVJem9RR2lJQVFmLy9BM0VRYkNJQlFRRVFnZ0VnQVVFQmFoQWRJZ0VFUUVFQUVJTUJCVUVCRUlNQkMwRUFFSVFCREE0TEl6a2pPaEFhSWdCQi8vOERjUkJzSWdGQmZ4Q0NBU0FCUVFGckVCMGlBUVJBUVFBUWd3RUZRUUVRZ3dFTFFRRVFoQUVNRFFzak9TTTZFQnBCLy84RGNSQVpRZjhCY1JCL0l6MUJBV29RRnlROVFRd1BDMEVBRUlRQlFRQVFnUUZCQVJDRkFVRUVEd3NRaXdGQkFVWUVRQkFaRUk0QlFRd1BCUXdLQ3dBTEl6a2pPaEFhSWdFalBFRUFFSWdCSUFFalBHb1FGeUlBRUJ4Qi93RnhKRGtnQUJBZFFmOEJjU1E2UVFBUWhBRkJDQThMSXprak9oQWFJZ0JCLy84RGNSQnNRZjhCY1NRMERBWUxJenhCQVdzUUZ5UThRUWdQQ3lNMFFRRVFnZ0VqTkVFQmFoQWRKRFFqTkFSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFGQkJBOExJelJCZnhDQ0FTTTBRUUZyRUIwa05DTTBCRUJCQUJDREFRVkJBUkNEQVF0QkFSQ0VBVUVFRHdzUUdVSC9BWEVrTkF3REMwRUFFSVFCUVFBUWdRRVFpd0ZCQUVzRVFFRUFFSVVCQlVFQkVJVUJDMEVFRHd0QmZ3OExJQUJCQVdzUUZ5SUFFQnhCL3dGeEpEa2dBQkFkUWY4QmNTUTZRUWdQQ3lNOVFRRnFFQmNrUFVFSUR3c2dBRUgvL3dOeElBRVFmMEVNQzlrQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FBUndSQUlBQWlBVUhCQUVZTkFRSkFJQUZCd2dCckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxEQkFMSXpZa05Rd1BDeU0zSkRVTURnc2pPQ1ExREEwTEl6a2tOUXdNQ3lNNkpEVU1Dd3NqT1NNNkVCb1FiRUgvQVhFa05VRUlEd3NqTkNRMURBa0xJelVrTmd3SUN3d0hDeU0zSkRZTUJnc2pPQ1EyREFVTEl6a2tOZ3dFQ3lNNkpEWU1Bd3NqT1NNNkVCb1FiRUgvQVhFa05rRUlEd3NqTkNRMkRBRUxRWDhQQzBFRUM5Z0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQVJ3UkFJQUFpQVVIUkFFWU5BUUpBSUFGQjBnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXpVa053d1FDeU0ySkRjTUR3c01EZ3NqT0NRM0RBMExJemtrTnd3TUN5TTZKRGNNQ3dzak9TTTZFQm9RYkVIL0FYRWtOMEVJRHdzak5DUTNEQWtMSXpVa09Bd0lDeU0ySkRnTUJ3c2pOeVE0REFZTERBVUxJemtrT0F3RUN5TTZKRGdNQXdzak9TTTZFQm9RYkVIL0FYRWtPQXdDQ3lNMEpEZ01BUXRCZnc4TFFRUUwyZ0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUNJQlFlRUFSZzBCQWtBZ0FVSGlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5TUTVRUWdQQ3lNMkpEa01Ed3NqTnlRNURBNExJemdrT1F3TkN3d01DeU02SkRrTUN3c2pPU002RUJvUWJFSC9BWEVrT1VFSUR3c2pOQ1E1REFrTEl6VWtPZ3dJQ3lNMkpEb01Cd3NqTnlRNkRBWUxJemdrT2d3RkN5TTVKRG9NQkFzTUF3c2pPU002RUJvUWJFSC9BWEVrT2tFSUR3c2pOQ1E2REFFTFFYOFBDMEVFQzRnQ0FRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCSEJFQWdBQ0lCUWZFQVJnMEJBa0FnQVVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqT1NNNkVCb2pOUkIvREJBTEl6a2pPaEFhSXpZUWZ3d1BDeU01SXpvUUdpTTNFSDhNRGdzak9TTTZFQm9qT0JCL0RBMExJemtqT2hBYUl6a1Fmd3dNQ3lNNUl6b1FHaU02RUg4TUN3c2p5UUZGQkVCQkFTUS9Dd3dMQ3lNNUl6b1FHaU0wRUg4TUNRc2pOU1EwREFrTEl6WWtOQXdJQ3lNM0pEUU1Cd3NqT0NRMERBWUxJemtrTkF3RkN5TTZKRFFNQkFzak9TTTZFQm9RYkVIL0FYRWtOQXdDQ3d3Q0MwRi9Ed3RCQ0E4TFFRUUxTUUFnQVVFQVRnUkFJQUJCL3dGeElBQWdBV29RSFVzRVFFRUJFSVVCQlVFQUVJVUJDd1VnQVVFQUlBRnJJQUZCQUVvYklBQkIvd0Z4U2dSQVFRRVFoUUVGUVFBUWhRRUxDd3MyQVFGL0l6UWdBRUgvQVhFaUFSQ0NBU00wSUFFUW1nRWpOQ0FBYWhBZEpEUWpOQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUVMYVFFQmZ5TTBJQUJxRUlzQmFoQWRJUUVqTkNBQWN5QUJjeEFkUVJCeEJFQkJBUkNCQVFWQkFCQ0JBUXNqTkNBQVFmOEJjV29RaXdGcUVCZEJnQUp4UVFCTEJFQkJBUkNGQVFWQkFCQ0ZBUXNnQVNRMEl6UUVRRUVBRUlNQkJVRUJFSU1CQzBFQUVJUUJDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJnQUZIQkVBQ1FDQUJRWUVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkNiQVF3UUN5TTJFSnNCREE4TEl6Y1Ftd0VNRGdzak9CQ2JBUXdOQ3lNNUVKc0JEQXdMSXpvUW13RU1Dd3NqT1NNNkVCb1FiQkNiQVVFSUR3c2pOQkNiQVF3SkN5TTFFSndCREFnTEl6WVFuQUVNQndzak54Q2NBUXdHQ3lNNEVKd0JEQVVMSXprUW5BRU1CQXNqT2hDY0FRd0RDeU01SXpvUUdoQnNFSndCUVFnUEN5TTBFSndCREFFTFFYOFBDMEVFQ3prQkFYOGpOQ0FBUWY4QmNVRi9iQ0lCRUlJQkl6UWdBUkNhQVNNMElBQnJFQjBrTkNNMEJFQkJBQkNEQVFWQkFSQ0RBUXRCQVJDRUFRdHBBUUYvSXpRZ0FHc1Fpd0ZyRUIwaEFTTTBJQUJ6SUFGelFSQnhFQjBFUUVFQkVJRUJCVUVBRUlFQkN5TTBJQUJCL3dGeGF4Q0xBV3NRRjBHQUFuRkJBRXNFUUVFQkVJVUJCVUVBRUlVQkN5QUJKRFFqTkFSQVFRQVFnd0VGUVFFUWd3RUxRUUVRaEFFTDRnRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHUUFVY0VRQUpBSUFGQmtRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lNMUVKNEJEQkFMSXpZUW5nRU1Ed3NqTnhDZUFRd09DeU00RUo0QkRBMExJemtRbmdFTURBc2pPaENlQVF3TEN5TTVJem9RR2hCc0VKNEJRUWdQQ3lNMEVKNEJEQWtMSXpVUW53RU1DQXNqTmhDZkFRd0hDeU0zRUo4QkRBWUxJemdRbndFTUJRc2pPUkNmQVF3RUN5TTZFSjhCREFNTEl6a2pPaEFhRUd3UW53RkJDQThMSXpRUW53RU1BUXRCZnc4TFFRUUxLQUFqTkNBQWNTUTBJelFFUUVFQUVJTUJCVUVCRUlNQkMwRUFFSVFCUVFFUWdRRkJBQkNGQVFzcUFDTTBJQUJ6RUIwa05DTTBCRUJCQUJDREFRVkJBUkNEQVF0QkFCQ0VBVUVBRUlFQlFRQVFoUUVMNGdFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdnQVVjRVFBSkFJQUZCb1FGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU0xRUtFQkRCQUxJellRb1FFTUR3c2pOeENoQVF3T0N5TTRFS0VCREEwTEl6a1FvUUVNREFzak9oQ2hBUXdMQ3lNNUl6b1FHaEJzRUtFQlFRZ1BDeU0wRUtFQkRBa0xJelVRb2dFTUNBc2pOaENpQVF3SEN5TTNFS0lCREFZTEl6Z1FvZ0VNQlFzak9SQ2lBUXdFQ3lNNkVLSUJEQU1MSXprak9oQWFFR3dRb2dGQkNBOExJelFRb2dFTUFRdEJmdzhMUVFRTExBQWpOQ0FBY2tIL0FYRWtOQ00wQkVCQkFCQ0RBUVZCQVJDREFRdEJBQkNFQVVFQUVJRUJRUUFRaFFFTE13RUJmeU0wSUFCQi93RnhRWDlzSWdFUWdnRWpOQ0FCRUpvQkl6UWdBV29FUUVFQUVJTUJCVUVCRUlNQkMwRUJFSVFCQytJQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCc0FGSEJFQUNRQ0FCUWJFQmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlJDa0FRd1FDeU0yRUtRQkRBOExJemNRcEFFTURnc2pPQkNrQVF3TkN5TTVFS1FCREF3TEl6b1FwQUVNQ3dzak9TTTZFQm9RYkJDa0FVRUlEd3NqTkJDa0FRd0pDeU0xRUtVQkRBZ0xJellRcFFFTUJ3c2pOeENsQVF3R0N5TTRFS1VCREFVTEl6a1FwUUVNQkFzak9oQ2xBUXdEQ3lNNUl6b1FHaEJzRUtVQlFRZ1BDeU0wRUtVQkRBRUxRWDhQQzBFRUMwQUJBbjhDUUFKQUlBQVFheUlCUVg5SEJFQU1BZ3NnQUJBRElRRUxDd0pBQWtBZ0FFRUJhaUlDRUdzaUFFRi9SdzBCSUFJUUF5RUFDd3NnQUNBQkVCb0xPd0FnQUVHQUFYRkJnQUZHQkVCQkFSQ0ZBUVZCQUJDRkFRc2dBQkNHQVNJQUJFQkJBQkNEQVFWQkFSQ0RBUXRCQUJDRUFVRUFFSUVCSUFBTE9RQWdBRUVCY1VFQVN3UkFRUUVRaFFFRlFRQVFoUUVMSUFBUWlRRWlBQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQUJDQkFTQUFDMGdCQVg4Z0FFR0FBWEZCZ0FGR0JFQkJBU0VCQ3lBQUVJd0JJUUFnQVFSQVFRRVFoUUVGUVFBUWhRRUxJQUFFUUVFQUVJTUJCVUVCRUlNQkMwRUFFSVFCUVFBUWdRRWdBQXRHQVFGL0lBQkJBWEZCQVVZRVFFRUJJUUVMSUFBUWp3RWhBQ0FCQkVCQkFSQ0ZBUVZCQUJDRkFRc2dBQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQUJDQkFTQUFDMG9CQVg4Z0FFR0FBWEZCZ0FGR0JFQkJBU0VCQ3lBQVFRRjBFQjBoQUNBQkJFQkJBUkNGQVFWQkFCQ0ZBUXNnQUFSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFGQkFCQ0JBU0FBQzJvQkFuOGdBRUdBQVhGQmdBRkdCRUJCQVNFQkN5QUFRUUZ4UVFGR0JFQkJBU0VDQ3lBQVFmOEJjVUVCZGhBZElRQWdBUVJBSUFCQmdBRnlJUUFMSUFBRVFFRUFFSU1CQlVFQkVJTUJDMEVBRUlRQlFRQVFnUUVnQWdSQVFRRVFoUUVGUVFBUWhRRUxJQUFMTndBZ0FFRVBjVUVFZENBQVFmQUJjVUVFZG5JUUhTSUFCRUJCQUJDREFRVkJBUkNEQVF0QkFCQ0VBVUVBRUlFQlFRQVFoUUVnQUF0S0FRRi9JQUJCQVhGQkFVWUVRRUVCSVFFTElBQkIvd0Z4UVFGMkVCMGlBQVJBUVFBUWd3RUZRUUVRZ3dFTFFRQVFoQUZCQUJDQkFTQUJCRUJCQVJDRkFRVkJBQkNGQVFzZ0FBc29BQ0FCUVFFZ0FIUnhRZjhCY1FSQVFRQVFnd0VGUVFFUWd3RUxRUUFRaEFGQkFSQ0JBU0FCQ3lBQUlBRkJBRW9FZnlBQ1FRRWdBSFJ5QlNBQ1FRRWdBSFJCZjNOeEN5SUNDOWNJQVFkL1FYOGhCUUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVFodklnY2hCaUFIUlEwQUFrQWdCa0VCYXc0SEFnTUVCUVlIQ0FBTERBZ0xJelVoQVF3SEN5TTJJUUVNQmdzak55RUJEQVVMSXpnaEFRd0VDeU01SVFFTUF3c2pPaUVCREFJTEl6a2pPaEFhRUd3aEFRd0JDeU0wSVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJR0lRUWdCa1VOQUFKQUlBUkJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTElBQkJCMHdFUUNBQkVLZ0JJUUpCQVNFREJTQUFRUTlNQkVBZ0FSQ3BBU0VDUVFFaEF3c0xEQThMSUFCQkYwd0VRQ0FCRUtvQklRSkJBU0VEQlNBQVFSOU1CRUFnQVJDckFTRUNRUUVoQXdzTERBNExJQUJCSjB3RVFDQUJFS3dCSVFKQkFTRURCU0FBUVM5TUJFQWdBUkN0QVNFQ1FRRWhBd3NMREEwTElBQkJOMHdFUUNBQkVLNEJJUUpCQVNFREJTQUFRVDlNQkVBZ0FSQ3ZBU0VDUVFFaEF3c0xEQXdMSUFCQnh3Qk1CRUJCQUNBQkVMQUJJUUpCQVNFREJTQUFRYzhBVEFSQVFRRWdBUkN3QVNFQ1FRRWhBd3NMREFzTElBQkIxd0JNQkVCQkFpQUJFTEFCSVFKQkFTRURCU0FBUWQ4QVRBUkFRUU1nQVJDd0FTRUNRUUVoQXdzTERBb0xJQUJCNXdCTUJFQkJCQ0FCRUxBQklRSkJBU0VEQlNBQVFlOEFUQVJBUVFVZ0FSQ3dBU0VDUVFFaEF3c0xEQWtMSUFCQjl3Qk1CRUJCQmlBQkVMQUJJUUpCQVNFREJTQUFRZjhBVEFSQVFRY2dBUkN3QVNFQ1FRRWhBd3NMREFnTElBQkJod0ZNQkVCQkFFRUFJQUVRc1FFaEFrRUJJUU1GSUFCQmp3Rk1CRUJCQVVFQUlBRVFzUUVoQWtFQklRTUxDd3dIQ3lBQVFaY0JUQVJBUVFKQkFDQUJFTEVCSVFKQkFTRURCU0FBUVo4QlRBUkFRUU5CQUNBQkVMRUJJUUpCQVNFREN3c01CZ3NnQUVHbkFVd0VRRUVFUVFBZ0FSQ3hBU0VDUVFFaEF3VWdBRUd2QVV3RVFFRUZRUUFnQVJDeEFTRUNRUUVoQXdzTERBVUxJQUJCdHdGTUJFQkJCa0VBSUFFUXNRRWhBa0VCSVFNRklBQkJ2d0ZNQkVCQkIwRUFJQUVRc1FFaEFrRUJJUU1MQ3d3RUN5QUFRY2NCVEFSQVFRQkJBU0FCRUxFQklRSkJBU0VEQlNBQVFjOEJUQVJBUVFGQkFTQUJFTEVCSVFKQkFTRURDd3NNQXdzZ0FFSFhBVXdFUUVFQ1FRRWdBUkN4QVNFQ1FRRWhBd1VnQUVIZkFVd0VRRUVEUVFFZ0FSQ3hBU0VDUVFFaEF3c0xEQUlMSUFCQjV3Rk1CRUJCQkVFQklBRVFzUUVoQWtFQklRTUZJQUJCN3dGTUJFQkJCVUVCSUFFUXNRRWhBa0VCSVFNTEN3d0JDeUFBUWZjQlRBUkFRUVpCQVNBQkVMRUJJUUpCQVNFREJTQUFRZjhCVEFSQVFRZEJBU0FCRUxFQklRSkJBU0VEQ3dzTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBSElnUUVRQUpBSUFSQkFXc09Cd0lEQkFVR0J3Z0FDd3dJQ3lBQ0pEVU1Cd3NnQWlRMkRBWUxJQUlrTnd3RkN5QUNKRGdNQkFzZ0FpUTVEQU1MSUFJa09nd0NDeU01SXpvUUdpQUNFSDhNQVFzZ0FpUTBDeU05UVFGcUVCY2tQU0FEQkVCQkNDRUZJQVJCQmtZRVFFRVFJUVVMQ3lBRkMra0RBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFjQUJSd1JBQWtBZ0FVSEJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEVKRUJCRUJCQ0E4RkRCWUxBQXNqUEJDbkFTRUJJenhCQW1vUUZ5UThJQUVRSEVIL0FYRWtOU0FCRUIxQi93RnhKRFpCREE4TEVKRUJCRUFNRUFVTUV3c0FDd3dSQ3hDUkFRUkFEQTRGREE4TEFBc2pQRUVDYXhBWEpEd2pQQ00xSXpZUUdoQ0hBVUVRRHdzUUdSQ2JBUXdLQ3lNOFFRSnJFQmNrUENNOEl6MFFod0ZCQUNROVFSQVBDeENSQVVFQlJnUkFEQTRGUVFnUEN3QUxJendRcHdGQi8vOERjU1E5SXp4QkFtb1FGeVE4UVJBUEN4Q1JBVUVCUmdSQURBc0ZEQWdMQUFzUUdVSC9BWEVRc2dFaUFVRUFTZ1JBSUFGQkJHb2hBUXNnQVE4TEVKRUJRUUZHQkVBalBFRUNheEFYSkR3alBDTTlRUUpxUWYvL0EzRVFod0VNQ0FVTUJnc0FDd3dGQ3hBWkVKd0JEQUlMSXp4QkFtc1FGeVE4SXp3alBSQ0hBVUVJSkQxQkVBOExRWDhQQ3lNOVFRRnFFQmNrUFVFSUR3c2pQVUVDYWhBWEpEMUJEQThMSXp4QkFtc1FGeVE4SXp3alBVRUNhaEFYRUljQkN4QWJRZi8vQTNFa1BVRVlEd3NRRzBILy93TnhKRDFCRUE4TEl6d1Fwd0ZCLy84RGNTUTlJenhCQW1vUUZ5UThRUlFMQ2dBZ0FFRUJjU1RwQVF2REF3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQjBBRkhCRUFDUUNBQlFkRUJhdzRQQWdNQUJBVUdCd2dKQ2dBTEFBd05BQXNNRFFzUWl3RUVRRUVJRHdVTUVnc0FDeU04RUtjQklRRWpQRUVDYWhBWEpEd2dBUkFjUWY4QmNTUTNJQUVRSFVIL0FYRWtPRUVNRHdzUWl3RUVRQXdOQlF3UEN3QUxFSXNCQkVBTURBVWpQRUVDYXhBWEpEd2pQQ005UVFKcVFmLy9BM0VRaHdFTURRc0FDeU04UVFKckVCY2tQQ004SXpjak9CQWFFSWNCUVJBUEN4QVpFSjRCREFnTEl6eEJBbXNRRnlROEl6d2pQUkNIQVVFUUpEMUJFQThMRUlzQlFRRkdCRUFNQ3dWQkNBOExBQXNqUEJDbkFVSC8vd054SkQxQkFSQzBBU004UVFKcUVCY2tQRUVRRHdzUWl3RkJBVVlFUUF3SUJRd0dDd0FMRUlzQlFRRkdCRUFqUEVFQ2F4QVhKRHdqUENNOVFRSnFFQmNRaHdFTUJnVU1CUXNBQ3hBWkVKOEJEQUlMSXp4QkFtc1FGeVE4SXp3alBSQ0hBVUVZSkQxQkVBOExRWDhQQ3lNOVFRRnFFQmNrUFVFSUR3c2pQVUVDYWhBWEpEMUJEQThMRUJ0Qi8vOERjU1E5UVJnUEN4QWJRZi8vQTNFa1BVRVFEd3NqUEJDbkFVSC8vd054SkQwalBFRUNhaEFYSkR4QkZBdmJBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQVVjRVFBSkFJQUJCNFFGckRnOENBd0FBQkFVR0J3Z0pBQUFBQ2dzQUN3d0xDeEFaUWY4QmNVR0EvZ05xSXpRUWZ5TTlRUUZxRUJja1BVRU1Ed3NqUEJDbkFTRUFJenhCQW1vUUZ5UThJQUFRSEVIL0FYRWtPU0FBRUIxQi93RnhKRHBCREE4TEl6WkJnUDREYWlNMEVIOUJDQThMSXp4QkFtc1FGeVE4SXp3ak9TTTZFQm9RaHdGQkVBOExFQmtRb1FFTUJ3c2pQRUVDYXhBWEpEd2pQQ005RUljQlFTQWtQVUVRRHdzUUdSQ05BU0VBSXp3Z0FFRVlkRUVZZFNJQVFRRVFpQUVqUENBQWFoQVhKRHhCQUJDREFVRUFFSVFCSXoxQkFXb1FGeVE5UVJBUEN5TTVJem9RR2tILy93TnhKRDFCQkE4TEVCdEIvLzhEY1NNMEVIOGpQVUVDYWhBWEpEMUJFQThMRUJrUW9nRU1BZ3NqUEVFQ2F4QVhKRHdqUENNOUVJY0JRU2drUFVFUUR3dEJmdzhMSXoxQkFXb1FGeVE5UVFnTGl3TUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFDUUNBQVFmRUJhdzRQQWdNRUFBVUdCd2dKQ2dzQUFBd05BQXNNRFFzUUdVSC9BWEZCZ1A0RGFoQnNFQjBrTkF3T0N5TThFS2NCUWYvL0EzRWhBQ004UVFKcUVCY2tQQ0FBRUJ4Qi93RnhKRFFnQUJBZFFmOEJjU1E3UVF3UEN5TTJRWUQrQTJvUWJCQWRKRFJCQ0E4TFFRQVF0QUZCQkE4TEl6eEJBbXNRRnlROEl6d2pOQ003RUJvUWh3RkJFQThMRUJrUXBBRU1DQXNqUEVFQ2F4QVhKRHdqUENNOUVJY0JRVEFrUFVFUUR3c1FHUkNOQVNFQVFRQVFnd0ZCQUJDRUFTTThJQUJCR0hSQkdIVWlBRUVCRUlnQkl6d2dBR29RRnlJQUVCeEIvd0Z4SkRrZ0FCQWRRZjhCY1NRNkRBY0xJemtqT2hBYVFmLy9BM0VrUEVFSUR3c1FHMEgvL3dOeEVHeEIvd0Z4SkRRalBVRUNhaEFYSkQxQkVBOExRUUVRdEFGQkJBOExFQmtRcFFFTUFnc2pQRUVDYXhBWEpEd2pQQ005RUljQlFUZ2tQVUVRRHd0QmZ3OExJejFCQVdvUUZ5UTlRUWdQQ3lNOVFRRnFFQmNrUFVFTUM4Z0JBUUYvSXoxQkFXb1FGeVE5QWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGR0RRRUNRQ0FCUVFKckRnMERCQVVHQndnSkNnc01EUTRQQUFzTUR3c2dBQkNLQVE4TElBQVFrQUVQQ3lBQUVKUUJEd3NnQUJDVkFROExJQUFRbGdFUEN5QUFFSmNCRHdzZ0FCQ1lBUThMSUFBUW1RRVBDeUFBRUowQkR3c2dBQkNnQVE4TElBQVFvd0VQQ3lBQUVLWUJEd3NnQUJDekFROExJQUFRdFFFUEN5QUFFTFlCRHdzZ0FCQzNBUXNNQUNQZ0FTUG9BWEZCQUVvTEd3RUJmeUFCRUJ3aEFpQUFJQUVRSFJBR0lBQkJBV29nQWhBR0M0TUJBUUYvUVFBUXRBRWdBRUdQL2dNUUF4Qm9JZ0VrNEFGQmovNERJQUVRQmlNOFFRSnJRZi8vQTNFa1BDTThJejBRdWdFQ1FBSkFBa0FDUUNBQUJFQUNRQ0FBUVFGckRnUUNBd0FFQUFzTUJBdEJBQ1RoQVVIQUFDUTlEQU1MUVFBazRnRkJ5QUFrUFF3Q0MwRUFKTjhCUWRBQUpEME1BUXRCQUNUakFVSGdBQ1E5Q3d1c0FRRUJmeVBwQVFSL0krZ0JRUUJLQlNQcEFRc2lBQVJBSStBQlFRQktJUUFMSUFBRVFFRUFJUUFqNUFFRWZ5UGhBUVVqNUFFTEJFQkJBQkM3QVVFQklRQUZJK1VCQkg4ajRnRUZJK1VCQ3dSQVFRRVF1d0ZCQVNFQUJTUG1BUVIvSTk4QkJTUG1BUXNFUUVFQ0VMc0JRUUVoQUFVajV3RUVmeVBqQVFVajV3RUxCRUJCQkJDN0FVRUJJUUFMQ3dzTElBQUVRRUVVSVFBalB3UkFRUUFrUDBFWUlRQUxJQUFQQ3d0QkFBc09BQ016QkVCQmtBY1BDMEhJQXdzRkFCQzlBUXNWQUNBQVFZQ1FmbW9nQVVFQmNVRU5kR290QUFBTERnQWdBVUdnQVd3Z0FHcEJBMndMRmdBZ0FDQUJFTUFCUVlEWUJXb2dBbW9nQXpvQUFBc0xBQ0FCUWFBQmJDQUFhZ3NSQUNBQUlBRVF3Z0ZCZ0tBRWFpMEFBQXNzQVFGL0lBSkJBM0VoQkNBRFFRRnhCRUJCQWlBRUVHVWhCQXNnQUNBQkVNSUJRWUNnQkdvZ0JEb0FBQXV5QWdFRGZ5QUJRUUJLSWdNRVFDQUFRUWhLSVFNTElBTUVRQ0FHSStvQlJpRURDeUFEQkVBZ0FDUHJBVVloQXdzZ0F3UkFRUUFoQTBFQUlRWkJCU0FFUVFGckVBTVFFQVJBUVFFaEF3dEJCU0FFRUFNUUVBUkFRUUVoQmdzQ1FFRUFJUVFEUUNBRVFRaE9EUUVnQXlBR1J3UkFRUWNnQkdzaEJBc2dBQ0FFYWtHZ0FVd0VRQ0FBUVFnZ0JHdHJJUWdnQUNBRWFpQUJFTUFCUVlEWUJXb2hDUUpBUVFBaEJRTkFJQVZCQTA0TkFTQUFJQVJxSUFFZ0JTQUpJQVZxTFFBQUVNRUJJQVZCQVdvaEJRd0FBQXNBQ3lBQUlBUnFJQUZCQWlBSUlBRVF3d0VpQlJCb1FRSWdCUkFRRU1RQklBZEJBV29oQndzZ0JFRUJhaUVFREFBQUN3QUxCU0FHSk9vQkN5QUFJK3NCVGdSQUlBQkJDR29rNndFZ0FDQUNRUWh2SWdaSUJFQWo2d0VnQm1vazZ3RUxDeUFIQ3pnQkFYOGdBRUdBa0FKR0JFQWdBVUdBQVdvaEFrRUhJQUVRRUFSQUlBRkJnQUZySVFJTElBQWdBa0VFZEdvUEN5QUFJQUZCQkhScUN5UUJBWDhnQUVFL2NTRUNJQUZCQVhFRVFDQUNRVUJySVFJTElBSkJnSkFFYWkwQUFBc2lBUUYvSUFCQkEzUWdBVUVCZEdvaUEwRUJhaUFDRU1jQklBTWdBaERIQVJBYUN4VUFJQUZCSHlBQVFRVnNJZ0IwY1NBQWRVRURkQXRaQUNBQ1FRRnhSUVJBSUFFUUF5QUFRUUYwZFVFRGNTRUFDMEh5QVNFQkFrQUNRQUpBQWtBQ1FDQUFSUTBFQWtBZ0FFRUJhdzREQWdNRUFBc01CQUFMQUF0Qm9BRWhBUXdDQzBIWUFDRUJEQUVMUVFnaEFRc2dBUXNOQUNBQklBSnNJQUJxUVFOc0M3VUNBUVovSUFFZ0FCREdBU0FGUVFGMGFpSUFJQUlRdndFaEVTQUFRUUZxSUFJUXZ3RWhFZ0pBSUFNaEFBTkFJQUFnQkVvTkFTQUdJQUFnQTJ0cUlnNGdDRWdFUUNBQUlRRWdERUVBU0NJQ1JRUkFRUVVnREJBUVJTRUNDeUFDQkVCQkJ5QUJheUVCQzBFQUlRSWdBU0FTRUJBRVFFRUNJUUlMSUFFZ0VSQVFCRUFnQWtFQmFpRUNDeUFNUVFCT0JIOUJBQ0FNUVFkeElBSkJBQkRJQVNJRkVNa0JJUTlCQVNBRkVNa0JJUUZCQWlBRkVNa0JCU0FMUVFCTUJFQkJ4LzRESVFzTElBSWdDeUFLRU1vQklnVWhEeUFGSWdFTElRVWdDU0FPSUFjZ0NCRExBV29pRUNBUE9nQUFJQkJCQVdvZ0FUb0FBQ0FRUVFKcUlBVTZBQUJCQUNFQklBeEJBRTRFUUVFSElBd1FFQ0VCQ3lBT0lBY2dBaUFCRU1RQklBMUJBV29oRFFzZ0FFRUJhaUVBREFBQUN3QUxJQTBMaHdFQkEzOGdBMEVJYnlFRElBQkZCRUFnQWlBQ1FRaHRRUU4wYXlFSEMwRUhJUWdnQUVFSWFrR2dBVW9FUUVHZ0FTQUFheUVJQzBGL0lRSWpMd1JBUVFNZ0JFRUJFTDhCSWdKQi93RnhFQkFFUUVFQklRa0xRUVlnQWhBUUJFQkJCeUFEYXlFREN3c2dCaUFGSUFrZ0J5QUlJQU1nQUNBQlFhQUJRWURZQlVFQVFRQWdBaERNQVF2cEFRQWdCU0FHRU1ZQklRWWdCRUVCRUw4QklRUWdBMEVJYnlFRFFRWWdCQkFRQkVCQkJ5QURheUVEQzBFQUlRVkJBeUFFRUJBRVFFRUJJUVVMSUFZZ0EwRUJkR29pQXlBRkVMOEJJUVlnQTBFQmFpQUZFTDhCSVFVZ0FrRUlieUVEUVFVZ0JCQVFSUVJBUVFjZ0Eyc2hBd3RCQUNFQ0lBTWdCUkFRQkVCQkFpRUNDeUFESUFZUUVBUkFJQUpCQVdvaEFndEJBQ0FFUVFkeElBSkJBQkRJQVNJREVNa0JJUVZCQVNBREVNa0JJUVpCQWlBREVNa0JJUU1nQUNBQlFRQWdCUkRCQVNBQUlBRkJBU0FHRU1FQklBQWdBVUVDSUFNUXdRRWdBQ0FCSUFKQkJ5QUVFQkFReEFFTGh3RUFJQVFnQlJER0FTQURRUWh2UVFGMGFpSUVRUUFRdndFaEJVRUFJUU1nQkVFQmFrRUFFTDhCSVFSQkJ5QUNRUWh2YXlJQ0lBUVFFQVJBUVFJaEF3c2dBaUFGRUJBRVFDQURRUUZxSVFNTElBQWdBVUVBSUFOQngvNERRUUFReWdFaUFoREJBU0FBSUFGQkFTQUNFTUVCSUFBZ0FVRUNJQUlRd1FFZ0FDQUJJQU5CQUJERUFRdmhBUUVHZnlBRFFRTjFJUXNDUUFOQUlBUkJvQUZPRFFFZ0JDQUZhaUlHUVlBQ1RnUkFJQVpCZ0FKcklRWUxJQUlnQzBFRmRHb2dCa0VEZFdvaUNVRUFFTDhCSVFkQkFDRUtJeXdFUUNBRUlBQWdCaUFESUFrZ0FTQUhFTVVCSWdoQkFFb0VRQ0FFSUFoQkFXdHFJUVJCQVNFS0N3c2pLd1IvSUFwRkJTTXJDeUlJQkVBZ0JDQUFJQVlnQXlBSklBRWdCeEROQVNJSVFRQktCRUFnQkNBSVFRRnJhaUVFQ3dVZ0NrVUVRQ012QkVBZ0JDQUFJQVlnQXlBSklBRWdCeERPQVFVZ0JDQUFJQVlnQXlBQklBY1F6d0VMQ3dzZ0JFRUJhaUVFREFBQUN3QUxDeTBCQW44alNpRUVJQUFqUzJvaUEwR0FBazRFUUNBRFFZQUNheUVEQ3lBQUlBRWdBaUFEUVFBZ0JCRFFBUXN4QVFOL0kwd2hBeUFBSTAwaUJFZ0VRQThMSUFOQkIyc2lBMEYvYkNFRklBQWdBU0FDSUFBZ0JHc2dBeUFGRU5BQkM1VUZBUkIvQWtCQkp5RUpBMEFnQ1VFQVNBMEJJQWxCQW5RaUEwR0EvQU5xRUFNaEFpQURRWUg4QTJvUUF5RUxJQU5CZ3Z3RGFoQURJUVFnQWtFUWF5RUNJQXRCQ0dzaEMwRUlJUVVnQVVFQmNRUkFRUkFoQlNBRVFRSnZRUUZHQkVBZ0JFRUJheUVFQ3dzZ0FDQUNUaUlHQkVBZ0FDQUNJQVZxU0NFR0N5QUdCRUJCQnlBRFFZUDhBMm9RQXlJR0VCQWhERUVHSUFZUUVDRURRUVVnQmhBUUlROGdBQ0FDYXlFQ0lBTUVRQ0FDSUFWclFYOXNRUUZySVFJTFFZQ0FBaUFFRU1ZQklBSkJBWFJxSVFSQkFDRUNJeThFZjBFRElBWVFFQVVqTHdzaUF3UkFRUUVoQWdzZ0JDQUNFTDhCSVJBZ0JFRUJhaUFDRUw4QklSRUNRRUVISVFVRFFDQUZRUUJJRFFFZ0JTRUNJQThFUUNBQ1FRZHJRWDlzSVFJTFFRQWhDQ0FDSUJFUUVBUkFRUUloQ0FzZ0FpQVFFQkFFUUNBSVFRRnFJUWdMSUFnRVFDQUxRUWNnQld0cUlnZEJBRTRpQWdSQUlBZEJvQUZNSVFJTElBSUVRRUVBSVFKQkFDRU5RUUFoRGlNdkJIOGp4UUZGQlNNdkN5SUVCRUJCQVNFQ0N5QUNSUVJBSUFjZ0FCRERBU0lLUVFOeElRTWdEQVIvSUFOQkFFb0ZJQXdMSWdRRVFFRUJJUTBGSXk4RWYwRUNJQW9RRUFVakx3c2lCQVJBSUFOQkFFb2hCQXNnQkFSQVFRRWhEZ3NMQ3lBQ1JRUkFJQTFGSWdNRWZ5QU9SUVVnQXdzaEFnc2dBZ1JBSXk4RVFFRUFJQVpCQjNFZ0NFRUJFTWdCSWdNUXlRRWhCRUVCSUFNUXlRRWhBa0VDSUFNUXlRRWhBeUFISUFCQkFDQUVFTUVCSUFjZ0FFRUJJQUlRd1FFZ0J5QUFRUUlnQXhEQkFRVkJ5UDRESVFOQkJDQUdFQkFFUUVISi9nTWhBd3NnQnlBQVFRQWdDQ0FEUVFBUXlnRWlDaERCQVNBSElBQkJBU0FLRU1FQklBY2dBRUVDSUFvUXdRRUxDd3NMSUFWQkFXc2hCUXdBQUFzQUN3c2dDVUVCYXlFSkRBQUFDd0FMQzNBQkFuOUJnSkFDSVFJandRRUVRRUdBZ0FJaEFnc2pMd1IvSXk4Rkk4VUJDeUlCQkVCQmdMQUNJUUVqd2dFRVFFR0F1QUloQVFzZ0FDQUNJQUVRMFFFTEk4QUJCRUJCZ0xBQ0lRRWp2d0VFUUVHQXVBSWhBUXNnQUNBQ0lBRVEwZ0VMSThRQkJFQWdBQ1BEQVJEVEFRc0xKZ0VCZndKQUEwQWdBRUdRQVVzTkFTQUFRZjhCY1JEVUFTQUFRUUZxSVFBTUFBQUxBQXNMU3dFQ2Z3SkFBMEFnQUVHUUFVNE5BUUpBUVFBaEFRTkFJQUZCb0FGT0RRRWdBU0FBRU1JQlFZQ2dCR3BCQURvQUFDQUJRUUZxSVFFTUFBQUxBQXNnQUVFQmFpRUFEQUFBQ3dBTEN3d0FRWDhrNmdGQmZ5VHJBUXNPQUNNekJFQkI4QVVQQzBINEFnc09BQ016QkVCQjhnTVBDMEg1QVFzTEFFRUJKT0lCUVFFUWRBdHNBUUYvSThrQlJRUkFEd3RCRUNFQUk4NEJRUkJJQkVBanpnRWhBQXNqendFajBBRWdBQkJ0STg4QklBQnFKTThCSTlBQklBQnFKTkFCSTg0QklBQnJKTTRCSTg0QlFRQk1CRUJCQUNUSkFTUElBVUgvQVJBR0JTUElBVUVISTg0QlFSQnRRUUZyRUdnUUJnc0xDd0JCQVNUaEFVRUFFSFFMMUFJQkJYOGp2Z0ZGQkVCQkFDUklRUUFrU1VIRS9nTkJBQkFHUVFCQkFVSEIvZ01RQXhCb0VHZ2hBMEVBSkhWQndmNERJQU1RQmc4TEkzVWhBU05KSWdOQmtBRk9CRUJCQVNFQ0JTTklFTmdCVGdSQVFRSWhBZ1VqU0JEWkFVNEVRRUVESVFJTEN3c2dBU0FDUndSQVFjSCtBeEFESVFBZ0FpUjFRUUFoQVFKQUFrQUNRQUpBQWtBZ0FpRUVJQUpGRFFBQ1FDQUVRUUZyRGdNQ0F3UUFDd3dFQzBFRFFRRkJBQ0FBRUdnUWFDSUFFQkFoQVF3REMwRUVRUUJCQVNBQUVHZ1FaU0lBRUJBaEFRd0NDMEVGUVFGQkFDQUFFR2dRWlNJQUVCQWhBUXdCQzBFQlFRQWdBQkJsRUdVaEFBc2dBUVJBRU5vQkN5QUNSUVJBRU5zQkN5QUNRUUZHQkVBUTNBRUxJOFlCSVFRZ0FrVWlBVVVFUUNBQ1FRRkdJUUVMSUFFRVFDQURJQVJHSVFFTElBRUVRRUVHUVFJZ0FCQmxJZ0FRRUFSQUVOb0JDd1ZCQWlBQUVHZ2hBQXRCd2Y0RElBQVFCZ3NMYmdFQmZ5TytBUVJBSTBnZ0FHb2tTQ05JRUwwQlRnUkFJMGdRdlFGckpFZ2pTU0lCUVpBQlJnUkFJeWtFUUJEVkFRVWdBUkRVQVFzUTFnRVExd0VGSUFGQmtBRklCRUFqS1VVRVFDQUJFTlFCQ3dzTElBRkJtUUZLQkg5QkFBVWdBVUVCYWdzaUFTUkpDd3NRM1FFTEtBQWpSeEMrQVVnRVFBOExBMEFqUnhDK0FVNEVRQkMrQVJEZUFTTkhFTDRCYXlSSERBRUxDd3ZlQVFFQ2YwRUJKQ05CQkNFQUl6OUZJZ0VFUUNOQVJTRUJDeUFCQkVBalBSQURRZjhCY1JDNEFTRUFCU00vQkg4ajZRRkZCU00vQ3lJQkJFQVF1UUVoQVFzZ0FRUkFRUUFrUDBFQUpFQWpQUkFEUWY4QmNSQzRBU0VBSXoxQkFXc1FGeVE5Q3dzak8wSHdBWEVrT3lBQVFRQk1CRUFnQUE4TEk4Y0JRUUJLQkVBZ0FDUEhBV29oQUVFQUpNY0JDeUFBRUx3QmFpRUFJejRnQUdva1BpTkFSUVJBSXljRVFDTkhJQUJxSkVjUTN3RUZJQUFRM2dFTEl5WUVRQ05PSUFCcUpFNEZJQUFRUndzTEl5Z0VRQ05zSUFCcUpHd1Fkd1VnQUJCMkN5QUFDMGNCQW44RFFDQUFSU0lCQkVBalBoQVdTQ0VCQ3lBQkJFQVE0QUZCQUVnRVFFRUJJUUFMREFFTEN5TStFQlpPQkVBalBoQVdheVErUVFBUEN5TTlRUUZyRUJja1BVRi9Dd1FBSTEwTGVRRUNmMEdBQ0NFQklBQUVmeUFBUVFCS0JTQUFDd1JBSUFBaEFRc0RRQ0FDUlNJQUJFQWpQaEFXU0NFQUN5QUFCRUFRNGdFZ0FVZ2hBQXNnQUFSQUVPQUJRUUJJQkVCQkFTRUNDd3dCQ3dzalBoQVdUZ1JBSXo0UUZtc2tQa0VBRHdzUTRnRWdBVTRFUUVFQkR3c2pQVUVCYXhBWEpEMUJmd3NPQUNBQVFZQUlhaUFCUVRKc2Fnc1pBQ0FCUVFGeEJFQWdBRUVCT2dBQUJTQUFRUUE2QUFBTEM1NEJBRUVBUVFBUTVBRWpORG9BQUVFQlFRQVE1QUVqTlRvQUFFRUNRUUFRNUFFak5qb0FBRUVEUVFBUTVBRWpOem9BQUVFRVFRQVE1QUVqT0RvQUFFRUZRUUFRNUFFak9Ub0FBRUVHUVFBUTVBRWpPam9BQUVFSFFRQVE1QUVqT3pvQUFFRUlRUUFRNUFFalBEc0JBRUVLUVFBUTVBRWpQVHNCQUVFTVFRQVE1QUVqUGpZQ0FFRVJRUUFRNUFFalB4RGxBVUVTUVFBUTVBRWpRQkRsQVFzaUFFRUFRUUVRNUFFalNEWUNBRUVFUVFFUTVBRWpkVG9BQUVIRS9nTWpTUkFHQ3h3QVFRQkJBaERrQVNQcEFSRGxBVUVCUVFJUTVBRWo3QUVRNVFFTEF3QUJDMjRBUVFCQkJCRGtBU010T3dFQVFRSkJCQkRrQVNNeE93RUFRUVJCQkJEa0FTTkJFT1VCUVFWQkJCRGtBU05DRU9VQlFRWkJCQkRrQVNOREVPVUJRUWRCQkJEa0FTTkVFT1VCUVFoQkJCRGtBU05GRU9VQlFRbEJCQkRrQVNOR0VPVUJRUXBCQkJEa0FTTXVFT1VCQ3pZQVFRQkJCUkRrQVNOeU5nSUFRUVJCQlJEa0FTTjBOZ0lBUVFoQkJSRGtBU056TmdJQVFZVCtBeU50RUFaQmhmNERJMjRRQmdzbUFFRUFRUVlRNUFFaldqWUNBRUVFUVFZUTVBRWpXem9BQUVFRlFRWVE1QUVqWERvQUFBdUNBUUJCQUVFSEVPUUJJM2dRNVFGQkFVRUhFT1FCSTVnQk5nSUFRUVZCQnhEa0FTT0xBVFlDQUVFSlFRY1E1QUVqZGpZQ0FFRU9RUWNRNUFFampnRTJBZ0JCRTBFSEVPUUJJKzBCT2dBQVFSUkJCeERrQVNPakFUb0FBRUVaUVFjUTVBRWpoQUVRNVFGQkdrRUhFT1FCSTRJQk5nSUFRUjlCQnhEa0FTT0ZBVHNCQUF0YkFFRUFRUWdRNUFFamV4RGxBVUVCUVFnUTVBRWpuZ0UyQWdCQkJVRUlFT1FCSTQ4Qk5nSUFRUWxCQ0JEa0FTTjVOZ0lBUVE1QkNCRGtBU09TQVRZQ0FFRVRRUWdRNUFFajdnRTZBQUJCRkVFSUVPUUJJNllCT2dBQUN6UUFRUUJCQ1JEa0FTTitFT1VCUVFGQkNSRGtBU09nQVRZQ0FFRUZRUWtRNUFFamZEWUNBRUVKUVFrUTVBRWpxUUU3QVFBTFR3QkJBRUVLRU9RQkk0RUJFT1VCUVFGQkNoRGtBU09pQVRZQ0FFRUZRUW9RNUFFamt3RTJBZ0JCQ1VFS0VPUUJJMzgyQWdCQkRrRUtFT1FCSTVZQk5nSUFRUk5CQ2hEa0FTT3RBVHNCQUFzbkFCRG1BUkRuQVJEb0FSRHBBUkRxQVJEckFSRHNBUkR0QVJEdUFSRHZBUkR3QVVFQUpDTUxFZ0FnQUMwQUFFRUFTZ1JBUVFFUEMwRUFDNTRCQUVFQVFRQVE1QUV0QUFBa05FRUJRUUFRNUFFdEFBQWtOVUVDUVFBUTVBRXRBQUFrTmtFRFFRQVE1QUV0QUFBa04wRUVRUUFRNUFFdEFBQWtPRUVGUVFBUTVBRXRBQUFrT1VFR1FRQVE1QUV0QUFBa09rRUhRUUFRNUFFdEFBQWtPMEVJUVFBUTVBRXZBUUFrUEVFS1FRQVE1QUV2QVFBa1BVRU1RUUFRNUFFb0FnQWtQa0VSUVFBUTVBRVE4Z0VrUDBFU1FRQVE1QUVROGdFa1FBc3FBRUVBUVFFUTVBRW9BZ0FrU0VFRVFRRVE1QUV0QUFBa2RVSEUvZ01RQXlSSlFjRCtBeEFERUdNTExBQkJBRUVDRU9RQkVQSUJKT2tCUVFGQkFoRGtBUkR5QVNUc0FVSC8vd01RQXhCOVFZLytBeEFERUh3TENnQkJnUDRERUFNUWV3dHVBRUVBUVFRUTVBRXZBUUFrTFVFQ1FRUVE1QUV2QVFBa01VRUVRUVFRNUFFUThnRWtRVUVGUVFRUTVBRVE4Z0VrUWtFR1FRUVE1QUVROGdFa1EwRUhRUVFRNUFFUThnRWtSRUVJUVFRUTVBRVE4Z0VrUlVFSlFRUVE1QUVROGdFa1JrRUtRUVFRNUFFUThnRWtMZ3RHQUVFQVFRVVE1QUVvQWdBa2NrRUVRUVVRNUFFb0FnQWtkRUVJUVFVUTVBRW9BZ0FrYzBHRS9nTVFBeVJ0UVlYK0F4QURFSGxCaHY0REVBTVFla0dIL2dNUUF4QVNDd1lBUVFBa1hRc3BBRUVBUVFZUTVBRW9BZ0FrV2tFRVFRWVE1QUV0QUFBa1cwRUZRUVlRNUFFdEFBQWtYQkQ1QVF1Q0FRQkJBRUVIRU9RQkVQSUJKSGhCQVVFSEVPUUJLQUlBSkpnQlFRVkJCeERrQVNnQ0FDU0xBVUVKUVFjUTVBRW9BZ0FrZGtFT1FRY1E1QUVvQWdBa2pnRkJFMEVIRU9RQkxRQUFKTzBCUVJSQkJ4RGtBUzBBQUNTakFVRVpRUWNRNUFFUThnRWtoQUZCR2tFSEVPUUJLQUlBSklJQlFSOUJCeERrQVM4QkFDU0ZBUXRiQUVFQVFRZ1E1QUVROGdFa2UwRUJRUWdRNUFFb0FnQWtuZ0ZCQlVFSUVPUUJLQUlBSkk4QlFRbEJDQkRrQVNnQ0FDUjVRUTVCQ0JEa0FTZ0NBQ1NTQVVFVFFRZ1E1QUV0QUFBazdnRkJGRUVJRU9RQkxRQUFKS1lCQ3pRQVFRQkJDUkRrQVJEeUFTUitRUUZCQ1JEa0FTZ0NBQ1NnQVVFRlFRa1E1QUVvQWdBa2ZFRUpRUWtRNUFFdkFRQWtxUUVMVHdCQkFFRUtFT1FCRVBJQkpJRUJRUUZCQ2hEa0FTZ0NBQ1NpQVVFRlFRb1E1QUVvQWdBa2t3RkJDVUVLRU9RQktBSUFKSDlCRGtFS0VPUUJLQUlBSkpZQlFSTkJDaERrQVM4QkFDU3RBUXNuQUJEekFSRDBBUkQxQVJEMkFSRDNBUkQ0QVJENkFSRDdBUkQ4QVJEOUFSRCtBVUVBSkNNTERBQWpJd1JBUVFFUEMwRUFDMThCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFJZ0ZCQVVZTkFRSkFJQUZCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJOU1CRHdzajFBRVBDeVBWQVE4TEk5WUJEd3NqMkFFUEN5UFpBUThMSTlvQkR3c2oyd0VQQzBFQUM0c0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FDSUNRUUZHRFFFQ1FDQUNRUUpyRGdZREJBVUdCd2dBQ3d3SUN5QUJRUUZ4Sk5NQkRBY0xJQUZCQVhFazFBRU1CZ3NnQVVFQmNTVFZBUXdGQ3lBQlFRRnhKTllCREFRTElBRkJBWEVrMkFFTUF3c2dBVUVCY1NUWkFRd0NDeUFCUVFGeEpOb0JEQUVMSUFGQkFYRWsyd0VMQ3dzQVFRRWs0d0ZCQkJCMEMyUUJBbjlCQUNSQUlBQVFnUUpGQkVCQkFTRUJDeUFBUVFFUWdnSWdBUVJBUVFBaEFTQUFRUU5NQkVCQkFTRUJDeVBTQVFSL0lBRUZJOUlCQ3lJQUJFQkJBU0VDQ3lQWEFRUi9JQUZGQlNQWEFRc2lBQVJBUVFFaEFnc2dBZ1JBRUlNQ0N3c0xDUUFnQUVFQUVJSUNDNW9CQUNBQVFRQktCRUJCQUJDRUFnVkJBQkNGQWdzZ0FVRUFTZ1JBUVFFUWhBSUZRUUVRaFFJTElBSkJBRW9FUUVFQ0VJUUNCVUVDRUlVQ0N5QURRUUJLQkVCQkF4Q0VBZ1ZCQXhDRkFnc2dCRUVBU2dSQVFRUVFoQUlGUVFRUWhRSUxJQVZCQUVvRVFFRUZFSVFDQlVFRkVJVUNDeUFHUVFCS0JFQkJCaENFQWdWQkJoQ0ZBZ3NnQjBFQVNnUkFRUWNRaEFJRlFRY1FoUUlMQ3dRQUl6UUxCQUFqTlFzRUFDTTJDd1FBSXpjTEJBQWpPQXNFQUNNNUN3UUFJem9MQkFBak93c0VBQ005Q3dRQUl6d0xxUU1CQ245QmdKQUNJUWtqd1FFRVFFR0FnQUloQ1F0QmdMQUNJUW9qd2dFRVFFR0F1QUloQ2dzQ1FBTkFJQVJCZ0FKT0RRRUNRRUVBSVFVRFFDQUZRWUFDVGcwQklBa2dDaUFFUVFOMVFRVjBhaUFGUVFOMWFpSUdRUUFRdndFUXhnRWhDQ0FFUVFodklRRkJCeUFGUVFodmF5RUhRUUFoQWlNdkJIOGdBRUVBU2dVakx3c2lBd1JBSUFaQkFSQy9BU0VDQzBFR0lBSVFFQVJBUVFjZ0FXc2hBUXRCQUNFRFFRTWdBaEFRQkVCQkFTRURDeUFJSUFGQkFYUnFJZ1lnQXhDL0FTRUlRUUFoQVNBSElBWkJBV29nQXhDL0FSQVFCRUJCQWlFQkN5QUhJQWdRRUFSQUlBRkJBV29oQVFzZ0JFRUlkQ0FGYWtFRGJDRUhJeThFZnlBQVFRQktCU012Q3lJREJFQkJBQ0FDUVFkeElBRkJBQkRJQVNJQkVNa0JJUVpCQVNBQkVNa0JJUU5CQWlBQkVNa0JJUUVnQjBHQW1BNXFJZ0lnQmpvQUFDQUNRUUZxSUFNNkFBQWdBa0VDYWlBQk9nQUFCU0FCUWNmK0EwRUFFTW9CSVFJQ1FFRUFJUUVEUUNBQlFRTk9EUUVnQjBHQW1BNXFJQUZxSUFJNkFBQWdBVUVCYWlFQkRBQUFDd0FMQ3lBRlFRRnFJUVVNQUFBTEFBc2dCRUVCYWlFRURBQUFDd0FMQzBnQUFrQUNRQUpBQWtBQ1FDUHZBVUVLYXc0RUFRSURCQUFMQUF0QkFDRUtDMEVBSVFzTFFYOGhEQXNnQUNBQklBSWdBeUFFSUFVZ0JpQUhJQWdnQ1NBS0lBc2dEQkRNQVF2WkFRRUdmd0pBQTBBZ0FrRVhUZzBCQWtCQkFDRUFBMEFnQUVFZlRnMEJRUUFoQkNBQVFROUtCRUJCQVNFRUN5QUNJUUVnQWtFUFNnUkFJQUZCRDJzaEFRc2dBVUVFZENFQklBQkJEMG9FZnlBQklBQkJEMnRxQlNBQklBQnFDeUVCUVlDQUFpRUZJQUpCRDBvRVFFR0FrQUloQlFzQ1FFRUFJUU1EUUNBRFFRaE9EUUZCQ3lUdkFTQUJJQVVnQkVFQVFRY2dBeUFBUVFOMElBSkJBM1FnQTJwQitBRkJnSmdhUVFGQkFFRUFFSklDR2lBRFFRRnFJUU1NQUFBTEFBc2dBRUVCYWlFQURBQUFDd0FMSUFKQkFXb2hBZ3dBQUFzQUN3c1VBRDhBUVlzQlNBUkFRWXNCUHdCclFBQWFDd3NkQUFKQUFrQUNRQ1B2QVE0Q0FRSUFDd0FMUVFBaEFBc2dBQkNSQWdzSEFDQUFKTzhCQ3dEOFdnUnVZVzFsQWZSYWx3SUFKV052Y21VdmJXVnRiM0o1TDJKaGJtdHBibWN2WjJWMFVtOXRRbUZ1YTBGa1pISmxjM01CSldOdmNtVXZiV1Z0YjNKNUwySmhibXRwYm1jdloyVjBVbUZ0UW1GdWEwRmtaSEpsYzNNQ04yTnZjbVV2YldWdGIzSjVMMjFsYlc5eWVVMWhjQzluWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUURLV052Y21VdmJXVnRiM0o1TDJ4dllXUXZaV2xuYUhSQ2FYUk1iMkZrUm5KdmJVZENUV1Z0YjNKNUJCcGpiM0psTDJOd2RTOWpjSFV2YVc1cGRHbGhiR2w2WlVOd2RRVW1ZMjl5WlM5dFpXMXZjbmt2YldWdGIzSjVMMmx1YVhScFlXeHBlbVZEWVhKMGNtbGtaMlVHSzJOdmNtVXZiV1Z0YjNKNUwzTjBiM0psTDJWcFoyaDBRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbmtISFdOdmNtVXZiV1Z0YjNKNUwyUnRZUzlwYm1sMGFXRnNhWHBsUkcxaENDbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDJsdWFYUnBZV3hwZW1WSGNtRndhR2xqY3drblkyOXlaUzluY21Gd2FHbGpjeTl3WVd4bGRIUmxMMmx1YVhScFlXeHBlbVZRWVd4bGRIUmxDaWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG1sdWFYUnBZV3hwZW1VTEoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVhVzVwZEdsaGJHbDZaUXduWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1cGJtbDBhV0ZzYVhwbERTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbWx1YVhScFlXeHBlbVVPTVdOdmNtVXZjMjkxYm1RdllXTmpkVzExYkdGMGIzSXZhVzVwZEdsaGJHbDZaVk52ZFc1a1FXTmpkVzExYkdGMGIzSVBJR052Y21VdmMyOTFibVF2YzI5MWJtUXZhVzVwZEdsaGJHbDZaVk52ZFc1a0VDRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZZMmhsWTJ0Q2FYUlBia0o1ZEdVUk0yTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OW5aWFJHY21WeGRXVnVZM2xHY205dFNXNXdkWFJEYkc5amExTmxiR1ZqZEJJc1kyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1MWNHUmhkR1ZVYVcxbGNrTnZiblJ5YjJ3VEkyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OXBibWwwYVdGc2FYcGxWR2x0WlhKekZCUmpiM0psTDJOdmNtVXZhVzVwZEdsaGJHbDZaUlVRWTI5eVpTOWpiM0psTDJOdmJtWnBaeFlsWTI5eVpTOWpjSFV2WTNCMUwwTndkUzVOUVZoZlExbERURVZUWDFCRlVsOUdVa0ZOUlJjaVkyOXlaUzl3YjNKMFlXSnNaUzl3YjNKMFlXSnNaUzkxTVRaUWIzSjBZV0pzWlJnZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5blpYUkVZWFJoUW5sMFpWUjNieGtmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTluWlhSRVlYUmhRbmwwWlU5dVpSb2pZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMMk52Ym1OaGRHVnVZWFJsUW5sMFpYTWJLR052Y21VdlkzQjFMMjl3WTI5a1pYTXZaMlYwUTI5dVkyRjBaVzVoZEdWa1JHRjBZVUo1ZEdVY0lHTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXpjR3hwZEVocFoyaENlWFJsSFI5amIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmMzQnNhWFJNYjNkQ2VYUmxIaUZqYjNKbEwyMWxiVzl5ZVM5aVlXNXJhVzVuTDJoaGJtUnNaVUpoYm10cGJtY2ZLV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdVltRjBZMmhRY205alpYTnpRM2xqYkdWeklDMWpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG0xaGVFWnlZVzFsVTJWeGRXVnVZMlZEZVdOc1pYTWhLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUR1Z1WjNSb0lpbGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVeGxibWQwYUNNcFkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTFjR1JoZEdWTVpXNW5kR2drS1dOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVEdWdVozUm9KU3hqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDJkbGRFNWxkMFp5WlhGMVpXNWplVVp5YjIxVGQyVmxjQ1lwWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1elpYUkdjbVZ4ZFdWdVkza25NbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2WTJGc1kzVnNZWFJsVTNkbFpYQkJibVJEYUdWamEwOTJaWEptYkc5M0tDaGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpWTjNaV1Z3S1N0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlVWdWRtVnNiM0JsS2l0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlVWdWRtVnNiM0JsS3l0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlVWdWRtVnNiM0JsTENWamIzSmxMM052ZFc1a0wzTnZkVzVrTDNWd1pHRjBaVVp5WVcxbFUyVnhkV1Z1WTJWeUxTNWpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbmRwYkd4RGFHRnVibVZzVlhCa1lYUmxMaXBqYjNKbEwzTnZkVzVrTDJGalkzVnRkV3hoZEc5eUwyUnBaRU5vWVc1dVpXeEVZV05EYUdGdVoyVXZMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1V3TG1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWQybHNiRU5vWVc1dVpXeFZjR1JoZEdVeExtTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkMmxzYkVOb1lXNXVaV3hWY0dSaGRHVXlKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1Y21WelpYUlVhVzFsY2pNOVkyOXlaUzl6YjNWdVpDOWtkWFI1TDJselJIVjBlVU41WTJ4bFEyeHZZMnRRYjNOcGRHbDJaVTl5VG1WbllYUnBkbVZHYjNKWFlYWmxabTl5YlRRbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNW5aWFJUWVcxd2JHVTFObU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1WjJWMFUyRnRjR3hsUm5KdmJVTjVZMnhsUTI5MWJuUmxjalluWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1eVpYTmxkRlJwYldWeU55WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbWRsZEZOaGJYQnNaVGcyWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1blpYUlRZVzF3YkdWR2NtOXRRM2xqYkdWRGIzVnVkR1Z5T1NkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuSmxjMlYwVkdsdFpYSTZKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11WjJWMFUyRnRjR3hsT3paamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxtZGxkRk5oYlhCc1pVWnliMjFEZVdOc1pVTnZkVzUwWlhJOE8yTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVaMlYwVG05cGMyVkRhR0Z1Ym1Wc1JuSmxjWFZsYm1ONVVHVnlhVzlrUFNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExtZGxkRk5oYlhCc1pUNDJZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVuWlhSVFlXMXdiR1ZHY205dFEzbGpiR1ZEYjNWdWRHVnlQeHhqYjNKbEwyTndkUzlqY0hVdlEzQjFMa05NVDBOTFgxTlFSVVZFUUNwamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMbTFoZUVSdmQyNVRZVzF3YkdWRGVXTnNaWE5CSW1OdmNtVXZjRzl5ZEdGaWJHVXZjRzl5ZEdGaWJHVXZhVE15VUc5eWRHRmliR1ZDS0dOdmNtVXZjMjkxYm1RdmMyOTFibVF2WjJWMFUyRnRjR3hsUVhOVmJuTnBaMjVsWkVKNWRHVkRJbU52Y21VdmMyOTFibVF2YzI5MWJtUXZiV2w0UTJoaGJtNWxiRk5oYlhCc1pYTkVNMk52Y21VdmMyOTFibVF2YzI5MWJtUXZjMlYwVEdWbWRFRnVaRkpwWjJoMFQzVjBjSFYwUm05eVFYVmthVzlSZFdWMVpVVW1ZMjl5WlM5emIzVnVaQzloWTJOMWJYVnNZWFJ2Y2k5aFkyTjFiWFZzWVhSbFUyOTFibVJHSDJOdmNtVXZjMjkxYm1RdmMyOTFibVF2WTJGc1kzVnNZWFJsVTI5MWJtUkhIR052Y21VdmMyOTFibVF2YzI5MWJtUXZkWEJrWVhSbFUyOTFibVJJSW1OdmNtVXZjMjkxYm1RdmMyOTFibVF2WW1GMFkyaFFjbTlqWlhOelFYVmthVzlKSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE1Fb25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTUxY0dSaGRHVk9Vbmd3U3lkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VERk1KMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUbEo0TVUwblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTFjR1JoZEdWT1VuZ3hUaWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5Wd1pHRjBaVTVTZURGUEoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRsSjRNbEFuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1MWNHUmhkR1ZPVW5neVVTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlREpTSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVGxKNE1sTW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzUxY0dSaGRHVk9Vbmd6VkNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlU1U2VETlZKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TTFZblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWT1VuZ3pWeWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURSWUpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkSEpwWjJkbGNsa25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUxY0dSaGRHVk9VbmcwV2lSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuUnlhV2RuWlhKYkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkWEJrWVhSbFRsSjRORndrWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1MGNtbG5aMlZ5WFNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlU1U2VEUmVKR052Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZEhKcFoyZGxjbDhoWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlUYjNWdVpDNTFjR1JoZEdWT1VqVXdZQ0ZqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMU52ZFc1a0xuVndaR0YwWlU1U05URmhJV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWRYQmtZWFJsVGxJMU1tSXNZMjl5WlM5emIzVnVaQzl5WldkcGMzUmxjbk12VTI5MWJtUlNaV2RwYzNSbGNsZHlhWFJsVkhKaGNITmpKbU52Y21VdlozSmhjR2hwWTNNdmJHTmtMMHhqWkM1MWNHUmhkR1ZNWTJSRGIyNTBjbTlzWkNCamIzSmxMMjFsYlc5eWVTOWtiV0V2YzNSaGNuUkViV0ZVY21GdWMyWmxjbVVmWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNObGRFSnBkRTl1UW5sMFpXWW5ZMjl5WlM5dFpXMXZjbmt2WkcxaEwyZGxkRWhrYldGVGIzVnlZMlZHY205dFRXVnRiM0o1Wnl4amIzSmxMMjFsYlc5eWVTOWtiV0V2WjJWMFNHUnRZVVJsYzNScGJtRjBhVzl1Um5KdmJVMWxiVzl5ZVdnaFkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzSmxjMlYwUW1sMFQyNUNlWFJsYVN0amIzSmxMM052ZFc1a0wzSmxaMmx6ZEdWeWN5OVRiM1Z1WkZKbFoybHpkR1Z5VW1WaFpGUnlZWEJ6YWlGamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdloyVjBTbTk1Y0dGa1UzUmhkR1ZySkdOdmNtVXZiV1Z0YjNKNUwzSmxZV1JVY21Gd2N5OWphR1ZqYTFKbFlXUlVjbUZ3YzJ3eVkyOXlaUzl0WlcxdmNua3ZiRzloWkM5bGFXZG9kRUpwZEV4dllXUkdjbTl0UjBKTlpXMXZjbmxYYVhSb1ZISmhjSE50SEdOdmNtVXZiV1Z0YjNKNUwyUnRZUzlvWkcxaFZISmhibk5tWlhKdUlXTnZjbVV2YldWdGIzSjVMMlJ0WVM5emRHRnlkRWhrYldGVWNtRnVjMlpsY204eVkyOXlaUzluY21Gd2FHbGpjeTl3WVd4bGRIUmxMM04wYjNKbFVHRnNaWFIwWlVKNWRHVkpibGRoYzIxTlpXMXZjbmx3TUdOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXBibU55WlcxbGJuUlFZV3hsZEhSbFNXNWtaWGhKWmxObGRIRXZZMjl5WlM5bmNtRndhR2xqY3k5d1lXeGxkSFJsTDNkeWFYUmxRMjlzYjNKUVlXeGxkSFJsVkc5TlpXMXZjbmx5TEdOdmNtVXZkR2x0WlhKekwzUnBiV1Z5Y3k5VWFXMWxjbk11WW1GMFkyaFFjbTlqWlhOelEzbGpiR1Z6Y3loamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlgyTm9aV05yUkdsMmFXUmxjbEpsWjJsemRHVnlkQ3hqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlmY21WeGRXVnpkRWx1ZEdWeWNuVndkSFV3WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12Y21WeGRXVnpkRlJwYldWeVNXNTBaWEp5ZFhCMGRoOWpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZkWEJrWVhSbFZHbHRaWEp6ZHlWamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlltRjBZMmhRY205alpYTnpWR2x0WlhKemVDOWpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlVScGRtbGtaWEpTWldkcGMzUmxjbmtzWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTUxY0dSaGRHVlVhVzFsY2tOdmRXNTBaWEo2SzJOdmNtVXZkR2x0WlhKekwzUnBiV1Z5Y3k5VWFXMWxjbk11ZFhCa1lYUmxWR2x0WlhKTmIyUjFiRzk3Sm1OdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5S2IzbHdZV1F1ZFhCa1lYUmxTbTk1Y0dGa2ZENWpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OUpiblJsY25KMWNIUnpMblZ3WkdGMFpVbHVkR1Z5Y25Wd2RGSmxjWFZsYzNSbFpIMDhZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTUxY0dSaGRHVkpiblJsY25KMWNIUkZibUZpYkdWa2ZpWmpiM0psTDIxbGJXOXllUzkzY21sMFpWUnlZWEJ6TDJOb1pXTnJWM0pwZEdWVWNtRndjMzgwWTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2WldsbmFIUkNhWFJUZEc5eVpVbHVkRzlIUWsxbGJXOXllVmRwZEdoVWNtRndjNEFCR1dOdmNtVXZZM0IxTDJac1lXZHpMM05sZEVac1lXZENhWFNCQVI5amIzSmxMMk53ZFM5bWJHRm5jeTl6WlhSSVlXeG1RMkZ5Y25sR2JHRm5nZ0V2WTI5eVpTOWpjSFV2Wm14aFozTXZZMmhsWTJ0QmJtUlRaWFJGYVdkb2RFSnBkRWhoYkdaRFlYSnllVVpzWVdlREFScGpiM0psTDJOd2RTOW1iR0ZuY3k5elpYUmFaWEp2Um14aFo0UUJIbU52Y21VdlkzQjFMMlpzWVdkekwzTmxkRk4xWW5SeVlXTjBSbXhoWjRVQkcyTnZjbVV2WTNCMUwyWnNZV2R6TDNObGRFTmhjbko1Um14aFo0WUJJV052Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl5YjNSaGRHVkNlWFJsVEdWbWRJY0JObU52Y21VdmJXVnRiM0o1TDNOMGIzSmxMM05wZUhSbFpXNUNhWFJUZEc5eVpVbHVkRzlIUWsxbGJXOXllVmRwZEdoVWNtRndjNGdCTkdOdmNtVXZZM0IxTDJac1lXZHpMMk5vWldOclFXNWtVMlYwVTJsNGRHVmxia0pwZEVac1lXZHpRV1JrVDNabGNtWnNiM2VKQVNKamIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmNtOTBZWFJsUW5sMFpWSnBaMmgwaWdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXdlSXNCRzJOdmNtVXZZM0IxTDJac1lXZHpMMmRsZEVOaGNuSjVSbXhoWjR3QkxXTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXliM1JoZEdWQ2VYUmxUR1ZtZEZSb2NtOTFaMmhEWVhKeWVZMEJJV052Y21VdmNHOXlkR0ZpYkdVdmNHOXlkR0ZpYkdVdmFUaFFiM0owWVdKc1pZNEJJbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5eVpXeGhkR2wyWlVwMWJYQ1BBUzVqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2Y205MFlYUmxRbmwwWlZKcFoyaDBWR2h5YjNWbmFFTmhjbko1a0FFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXhlSkVCR21OdmNtVXZZM0IxTDJac1lXZHpMMmRsZEZwbGNtOUdiR0Zua2dFZlkyOXlaUzlqY0hVdlpteGhaM012WjJWMFNHRnNaa05oY25KNVJteGhaNU1CSG1OdmNtVXZZM0IxTDJac1lXZHpMMmRsZEZOMVluUnlZV04wUm14aFo1UUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTW5pVkFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVE40bGdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTBlSmNCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE5YaVlBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRaNG1RRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1UzZUpvQksyTnZjbVV2WTNCMUwyWnNZV2R6TDJOb1pXTnJRVzVrVTJWMFJXbG5hSFJDYVhSRFlYSnllVVpzWVdlYkFTSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12WVdSa1FWSmxaMmx6ZEdWeW5BRXVZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDJGa1pFRlVhSEp2ZFdkb1EyRnljbmxTWldkcGMzUmxjcDBCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE9IaWVBU0pqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMzVmlRVkpsWjJsemRHVnlud0V1WTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzTjFZa0ZVYUhKdmRXZG9RMkZ5Y25sU1pXZHBjM1JsY3FBQkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxPWGloQVNKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZZVzVrUVZKbFoybHpkR1Z5b2dFaVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM2h2Y2tGU1pXZHBjM1JsY3FNQkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxRWGlrQVNGamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZiM0pCVW1WbmFYTjBaWEtsQVNGamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZZM0JCVW1WbmFYTjBaWEttQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pVSjRwd0VyWTI5eVpTOXRaVzF2Y25rdmJHOWhaQzl6YVhoMFpXVnVRbWwwVEc5aFpFWnliMjFIUWsxbGJXOXllYWdCS0dOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXliM1JoZEdWU1pXZHBjM1JsY2t4bFpuU3BBU2xqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpTYVdkb2RLb0JOR052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5eWIzUmhkR1ZTWldkcGMzUmxja3hsWm5SVWFISnZkV2RvUTJGeWNubXJBVFZqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpTYVdkb2RGUm9jbTkxWjJoRFlYSnllYXdCSjJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXphR2xtZEV4bFpuUlNaV2RwYzNSbGNxMEJNbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRkpwWjJoMFFYSnBkR2h0WlhScFkxSmxaMmx6ZEdWeXJnRXJZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNOM1lYQk9hV0ppYkdWelQyNVNaV2RwYzNSbGNxOEJMMk52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emFHbG1kRkpwWjJoMFRHOW5hV05oYkZKbFoybHpkR1Z5c0FFblkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM1JsYzNSQ2FYUlBibEpsWjJsemRHVnlzUUVtWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzTmxkRUpwZEU5dVVtVm5hWE4wWlhLeUFTRmpiM0psTDJOd2RTOWpZazl3WTI5a1pYTXZhR0Z1Wkd4bFEySlBjR052WkdXekFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVU40dEFFb1kyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmMyVjBTVzUwWlhKeWRYQjBjN1VCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFJIaTJBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVWNHR3RWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1ZHZUxnQkhtTnZjbVV2WTNCMUwyOXdZMjlrWlhNdlpYaGxZM1YwWlU5d1kyOWtaYmtCT21OdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDBsdWRHVnljblZ3ZEhNdVlYSmxTVzUwWlhKeWRYQjBjMUJsYm1ScGJtZTZBUzFqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzl6YVhoMFpXVnVRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbm03QVN0amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5ZmFHRnVaR3hsU1c1MFpYSnlkWEIwdkFFcVkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlkyaGxZMnRKYm5SbGNuSjFjSFJ6dlFFM1kyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVOUVZoZlExbERURVZUWDFCRlVsOVRRMEZPVEVsT1JiNEJNbU52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVltRjBZMmhRY205alpYTnpRM2xqYkdWenZ3RW5ZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5c2IyRmtSbkp2YlZaeVlXMUNZVzVyd0FFblkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTluWlhSU1oySlFhWGhsYkZOMFlYSjB3UUVtWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXpaWFJRYVhobGJFOXVSbkpoYldYQ0FTUmpiM0psTDJkeVlYQm9hV056TDNCeWFXOXlhWFI1TDJkbGRGQnBlR1ZzVTNSaGNuVERBU3BqYjNKbEwyZHlZWEJvYVdOekwzQnlhVzl5YVhSNUwyZGxkRkJ5YVc5eWFYUjVabTl5VUdsNFpXekVBU3BqYjNKbEwyZHlZWEJvYVdOekwzQnlhVzl5YVhSNUwyRmtaRkJ5YVc5eWFYUjVabTl5VUdsNFpXekZBVHBqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkMHhwYm1WUFpsUnBiR1ZHY205dFZHbHNaVU5oWTJobHhnRW1ZMjl5WlM5bmNtRndhR2xqY3k5MGFXeGxjeTluWlhSVWFXeGxSR0YwWVVGa1pISmxjM1BIQVROamIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZiRzloWkZCaGJHVjBkR1ZDZVhSbFJuSnZiVmRoYzIxTlpXMXZjbm5JQVN4amIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZaMlYwVW1kaVEyOXNiM0pHY205dFVHRnNaWFIwWmNrQkxtTnZjbVV2WjNKaGNHaHBZM012Y0dGc1pYUjBaUzluWlhSRGIyeHZja052YlhCdmJtVnVkRVp5YjIxU1oyTEtBVE5qYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdloyVjBUVzl1YjJOb2NtOXRaVU52Ykc5eVJuSnZiVkJoYkdWMGRHWExBU1ZqYjNKbEwyZHlZWEJvYVdOekwzUnBiR1Z6TDJkbGRGUnBiR1ZRYVhobGJGTjBZWEowekFFc1kyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OWtjbUYzVUdsNFpXeHpSbkp2YlV4cGJtVlBabFJwYkdYTkFUZGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQweHBibVZQWmxScGJHVkdjbTl0Vkdsc1pVbGt6Z0UzWTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGREYjJ4dmNsQnBlR1ZzUm5KdmJWUnBiR1ZKWk04QlBHTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1RXOXViMk5vY205dFpWQnBlR1ZzUm5KdmJWUnBiR1ZKWk5BQk8yTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1FtRmphMmR5YjNWdVpGZHBibVJ2ZDFOallXNXNhVzVsMFFFdlkyOXlaUzluY21Gd2FHbGpjeTlpWVdOclozSnZkVzVrVjJsdVpHOTNMM0psYm1SbGNrSmhZMnRuY205MWJtVFNBU3RqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdmNtVnVaR1Z5VjJsdVpHOTMwd0VqWTI5eVpTOW5jbUZ3YUdsamN5OXpjSEpwZEdWekwzSmxibVJsY2xOd2NtbDBaWFBVQVNSamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMTlrY21GM1UyTmhibXhwYm1YVkFTbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDE5eVpXNWtaWEpGYm5ScGNtVkdjbUZ0WmRZQkoyTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WTJ4bFlYSlFjbWx2Y21sMGVVMWhjTmNCSW1OdmNtVXZaM0poY0docFkzTXZkR2xzWlhNdmNtVnpaWFJVYVd4bFEyRmphR1hZQVR0amIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMGR5WVhCb2FXTnpMazFKVGw5RFdVTk1SVk5mVTFCU1NWUkZVMTlNUTBSZlRVOUVSZGtCUVdOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVUVWxPWDBOWlEweEZVMTlVVWtGT1UwWkZVbDlFUVZSQlgweERSRjlOVDBSRjJnRXVZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRFeGpaRWx1ZEdWeWNuVndkTnNCSUdOdmNtVXZiV1Z0YjNKNUwyUnRZUzkxY0dSaGRHVklZbXhoYm10SVpHMWgzQUV4WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12Y21WeGRXVnpkRlpDYkdGdWEwbHVkR1Z5Y25Wd2ROMEJIbU52Y21VdlozSmhjR2hwWTNNdmJHTmtMM05sZEV4alpGTjBZWFIxYzk0QkpXTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012ZFhCa1lYUmxSM0poY0docFkzUGZBU3RqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwySmhkR05vVUhKdlkyVnpjMGR5WVhCb2FXTno0QUVWWTI5eVpTOWpiM0psTDJWNFpXTjFkR1ZUZEdWdzRRRVdZMjl5WlM5amIzSmxMMlY0WldOMWRHVkdjbUZ0WmVJQk1HTnZjbVV2YzI5MWJtUXZjMjkxYm1RdloyVjBUblZ0WW1WeVQyWlRZVzF3YkdWelNXNUJkV1JwYjBKMVptWmxjdU1CSTJOdmNtVXZZMjl5WlM5bGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2NUFFaVkyOXlaUzlqYjNKbEwyZGxkRk5oZG1WVGRHRjBaVTFsYlc5eWVVOW1abk5sZE9VQk1tTnZjbVV2YldWdGIzSjVMM04wYjNKbEwzTjBiM0psUW05dmJHVmhia1JwY21WamRHeDVWRzlYWVhOdFRXVnRiM0o1NWdFYVkyOXlaUzlqY0hVdlkzQjFMME53ZFM1ellYWmxVM1JoZEdYbkFTbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TG5OaGRtVlRkR0YwWmVnQkwyTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXVjMkYyWlZOMFlYUmw2UUVqWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDBwdmVYQmhaQzV6WVhabFUzUmhkR1hxQVNOamIzSmxMMjFsYlc5eWVTOXRaVzF2Y25rdlRXVnRiM0o1TG5OaGRtVlRkR0YwWmVzQkkyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OVVhVzFsY25NdWMyRjJaVk4wWVhSbDdBRWdZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1ellYWmxVM1JoZEdYdEFTWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbk5oZG1WVGRHRjBaZTRCSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWMyRjJaVk4wWVhSbDd3RW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTV6WVhabFUzUmhkR1h3QVNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuTmhkbVZUZEdGMFpmRUJFMk52Y21VdlkyOXlaUzl6WVhabFUzUmhkR1h5QVRKamIzSmxMMjFsYlc5eWVTOXNiMkZrTDJ4dllXUkNiMjlzWldGdVJHbHlaV04wYkhsR2NtOXRWMkZ6YlUxbGJXOXllZk1CR21OdmNtVXZZM0IxTDJOd2RTOURjSFV1Ykc5aFpGTjBZWFJsOUFFcFkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVzYjJGa1UzUmhkR1gxQVM5amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5SmJuUmxjbkoxY0hSekxteHZZV1JUZEdGMFpmWUJJMk52Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzlLYjNsd1lXUXViRzloWkZOMFlYUmw5d0VqWTI5eVpTOXRaVzF2Y25rdmJXVnRiM0o1TDAxbGJXOXllUzVzYjJGa1UzUmhkR1g0QVNOamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlZHbHRaWEp6TG14dllXUlRkR0YwWmZrQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlkyeGxZWEpCZFdScGIwSjFabVpsY3ZvQklHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1Ykc5aFpGTjBZWFJsK3dFbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNXNiMkZrVTNSaGRHWDhBU1pqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG14dllXUlRkR0YwWmYwQkptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXViRzloWkZOMFlYUmwvZ0VtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTkM5RGFHRnVibVZzTkM1c2IyRmtVM1JoZEdYL0FSTmpiM0psTDJOdmNtVXZiRzloWkZOMFlYUmxnQUlZWTI5eVpTOWpiM0psTDJoaGMwTnZjbVZUZEdGeWRHVmtnUUkwWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5blpYUktiM2x3WVdSQ2RYUjBiMjVUZEdGMFpVWnliMjFDZFhSMGIyNUpaSUlDTkdOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5ZmMyVjBTbTk1Y0dGa1FuVjBkRzl1VTNSaGRHVkdjbTl0UW5WMGRHOXVTV1NEQWpGamIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5eVpYRjFaWE4wU205NWNHRmtTVzUwWlhKeWRYQjBoQUlsWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5d2NtVnpjMHB2ZVhCaFpFSjFkSFJ2Ym9VQ0oyTnZjbVV2YW05NWNHRmtMMnB2ZVhCaFpDOWZjbVZzWldGelpVcHZlWEJoWkVKMWRIUnZib1lDSVdOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5elpYUktiM2x3WVdSVGRHRjBaWWNDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlRWWdDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlRb2tDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlRNG9DSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlSSXNDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlSWXdDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlTSTBDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlUSTRDSVdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkpsWjJsemRHVnlSbzhDSm1OdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WTNCMUwyZGxkRkJ5YjJkeVlXMURiM1Z1ZEdWeWtBSWtZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFUzUmhZMnRRYjJsdWRHVnlrUUkzWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFuY21Gd2FHbGpjeTlrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZVpJQ04yTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaSEpoZDFCcGVHVnNjMFp5YjIxTWFXNWxUMlpVYVd4bGZIUnlZVzF3YjJ4cGJtV1RBakpqYjNKbEwyUmxZblZuTDJSbFluVm5MV2R5WVhCb2FXTnpMMlJ5WVhkVWFXeGxSR0YwWVZSdlYyRnpiVTFsYlc5eWVaUUNCWE4wWVhKMGxRSkNZMjl5WlM5a1pXSjFaeTlrWldKMVp5MW5jbUZ3YUdsamN5OWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllWHgwY21GdGNHOXNhVzVsbGdJSWZuTmxkR0Z5WjJNQVBoQnpiM1Z5WTJWTllYQndhVzVuVlZKTUxHUmxiVzh2WkdWaWRXZG5aWEl2WVhOelpYUnpMMk52Y21VdWRXNTBiM1ZqYUdWa0xuZGhjMjB1YldGdyIpKS5pbnN0YW5jZTsKY29uc3QgYj1uZXcgVWludDhBcnJheShhLmV4cG9ydHMubWVtb3J5LmJ1ZmZlcik7cmV0dXJue2luc3RhbmNlOmEsYnl0ZU1lbW9yeTpiLHR5cGU6IldlYiBBc3NlbWJseSJ9fTtsZXQgcixDLGM7Yz17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCwKV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxmcmFtZVNraXBDb3VudGVyOjAsY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kczowLG1lc3NhZ2VIYW5kbGVyOihhKT0+e2NvbnN0IGI9bihhKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5DT05ORUNUOiJHUkFQSElDUyI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGMuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEcuYmluZCh2b2lkIDAsYyksYy5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEouYmluZCh2b2lkIDAsYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6CiJDT05UUk9MTEVSIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5jb250cm9sbGVyV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShJLmJpbmQodm9pZCAwLGMpLGMuY29udHJvbGxlcldvcmtlclBvcnQpKToiQVVESU8iPT09Yi5tZXNzYWdlLndvcmtlcklkJiYoYy5hdWRpb1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoSC5iaW5kKHZvaWQgMCxjKSxjLmF1ZGlvV29ya2VyUG9ydCkpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuSU5TVEFOVElBVEVfV0FTTTooYXN5bmMoKT0+e2xldCBhO2E9YXdhaXQgTShwKTtjLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2Mud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2soaCh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgZi5DT05GSUc6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkoYyxiLm1lc3NhZ2UuY29uZmlnKTtjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7CmsoaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUkVTRVRfQVVESU9fUVVFVUU6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBMQVk6aWYoIWMucGF1c2VkfHwhYy53YXNtSW5zdGFuY2V8fCFjLndhc21CeXRlTWVtb3J5KXtrKGgoe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfWMucGF1c2VkPSExO2MuZnBzVGltZVN0YW1wcz1bXTtjLmZyYW1lU2tpcENvdW50ZXI9MDtjLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtEKGMsMUUzL2Mub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKTtBKGMpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUEFVU0U6Yy5wYXVzZWQ9ITA7Yy51cGRhdGVJZCYmKGNsZWFyVGltZW91dChjLnVwZGF0ZUlkKSxjLnVwZGF0ZUlkPXZvaWQgMCk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SVU5fV0FTTV9FWFBPUlQ6YT0KYi5tZXNzYWdlLnBhcmFtZXRlcnM/Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XS5hcHBseSh2b2lkIDAsYi5tZXNzYWdlLnBhcmFtZXRlcnMpOmMud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0oKTtrKGgoe3R5cGU6Zi5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046e2E9MDtsZXQgZD1jLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiLm1lc3NhZ2Uuc3RhcnQmJihhPWIubWVzc2FnZS5zdGFydCk7Yi5tZXNzYWdlLmVuZCYmKGQ9Yi5tZXNzYWdlLmVuZCk7YT1jLndhc21CeXRlTWVtb3J5LnNsaWNlKGEsZCkuYnVmZmVyO2soaCh7dHlwZTpmLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCksW2FdKTticmVha31jYXNlIGYuR0VUX1dBU01fQ09OU1RBTlQ6ayhoKHt0eXBlOmYuR0VUX1dBU01fQ09OU1RBTlQscmVzcG9uc2U6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhiKX19LGdldEZQUzooKT0+MDxjLnRpbWVTdGFtcHNVbnRpbFJlYWR5P2Mub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlOmMuZnBzVGltZVN0YW1wcz9jLmZwc1RpbWVTdGFtcHMubGVuZ3RoOjB9O3EoYy5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

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
var version = "0.3.0";
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
	prepare: "npx run-s core:build lib:build:wasm lib:build:ts",
	start: "npx concurrently --kill-others --names \"DEBUGGER,CORE,LIB\" -c \"bgBlue.bold,bgMagenta.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run core:watch\" \"npm run lib:watch:wasm\"",
	"start:ts": "npx concurrently --kill-others --names \"DEBUGGER,LIBANDCORETS\" -c \"bgBlue.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run lib:watch:ts\"",
	dev: "npm run start",
	watch: "npm run start",
	"dev:ts": "npm run start:ts",
	"watch:ts": "npm run start:ts",
	build: "npx run-s core:build lib:build:wasm",
	deploy: "npx run-s lib:deploy demo:deploy",
	prettier: "npm run prettier:lint:fix",
	"prettier:lint": "run-s prettier:lint:message prettier:lint:list",
	"prettier:lint:message": "echo \"Listing unlinted files, will show nothing if everything is fine.\"",
	"prettier:lint:list": "npx prettier --config .prettierrc --list-different rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
	"prettier:lint:fix": "npx prettier --config .prettierrc --write rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
	precommit: "npx pretty-quick --staged",
	"core:watch": "npx watch \"npm run core:build\" core",
	"core:build": "npx run-s core:build:asc core:build:dist core:build:done",
	"core:build:asc": "npx asc core/index.ts -b dist/core/core.untouched.wasm -t dist/core/core.untouched.wat -O3 --validate --sourceMap demo/debugger/assets/core.untouched.wasm.map --memoryBase 0",
	"core:build:dist": "cp dist/core/*.untouched.* demo/debugger/assets",
	"core:build:done": "echo \"Built Core!\"",
	"lib:watch:wasm": "npx rollup -c -w --environment WASM",
	"lib:build:wasm": "npx rollup -c --environment PROD,WASM",
	"lib:watch:ts": "npx rollup -c -w --environment TS",
	"lib:build:ts": "npx rollup -c --environment PROD,TS",
	"lib:deploy": "npx run-s core:build lib:build:wasm lib:build:ts lib:deploy:np",
	"lib:deploy:np": "npx np",
	test: "npm run test:accuracy",
	"test:accuracy": "npx run-s build test:accuracy:nobuild",
	"test:accuracy:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/accuracy/accuracy-test.js --exit",
	"test:perf": "npm run test:performance",
	"test:performance": "npx run-s build test:performance:nobuild",
	"test:performance:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/performance/performance-test.js --exit",
	"debugger:watch": "preact watch --src demo/debugger",
	"debugger:serve": "npx run-s debugger:build debugger:serve:nobuild",
	"debugger:serve:nobuild": "preact serve",
	"debugger:build": "preact build --src demo/debugger --no-prerender",
	"debugger:deploy": "npx run-s debugger:build",
	"benchmark:build": "npx rollup -c --environment PROD,BENCHMARK",
	"benchmark:watch": "npx rollup -c -w --environment BENCHMARK",
	"demo:cname": "echo 'wasmboy.app' > build/CNAME",
	"demo:build": "npx run-s lib:build:wasm lib:build:ts debugger:build benchmark:build",
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
	np: "^3.0.0",
	"npm-run-all": "^4.1.3",
	"performance-now": "^2.1.0",
	"pngjs-image": "^0.11.7",
	preact: "^8.2.1",
	"preact-cli": "^2.0.0",
	"preact-compat": "^3.17.0",
	"preact-portal": "^1.1.3",
	prettier: "^1.12.1",
	"pretty-quick": "^1.6.0",
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
	watch: "^1.0.2"
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
  _getWasmConstant: getWasmConstant
};

exports.WasmBoy = WasmBoy;
//# sourceMappingURL=wasmboy.wasm.cjs.js.map
