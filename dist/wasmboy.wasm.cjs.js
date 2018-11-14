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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6dS5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBHKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBnLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKX19ZnVuY3Rpb24gSChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLApXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZy5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSShhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZy5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGM9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2M9MzI3Njg6CjU8PWImJjY+PWI/Yz0yMDQ4OjE1PD1iJiYxOT49Yj9jPTMyNzY4OjI1PD1iJiYzMD49YiYmKGM9MTMxMDcyKTtyZXR1cm4gYz9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04rYyk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24geihhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIEooYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGcuQ0xFQVJfTUVNT1JZOmZvcih2YXIgYz0wO2M8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2MrKylhLndhc21CeXRlTWVtb3J5W2NdPTA7Yz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApOwphLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpnLkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmMuYnVmZmVyfSxiLm1lc3NhZ2VJZCksW2MuYnVmZmVyXSk7YnJlYWs7Y2FzZSBnLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCeXRlc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpfSwKYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGcuU0VUX01FTU9SWTpjPU9iamVjdC5rZXlzKGIubWVzc2FnZSk7Yy5pbmNsdWRlcyhmLkNBUlRSSURHRV9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5DQVJUUklER0VfUk9NXSksYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2MuaW5jbHVkZXMoZi5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2YuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7Yy5pbmNsdWRlcyhmLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2YuR0FNRUJPWV9NRU1PUlldKSxhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKGYuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5QQUxFVFRFX01FTU9SWV0pLAphLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pO2MuaW5jbHVkZXMoZi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5JTlRFUk5BTF9TVEFURV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zy5TRVRfTUVNT1JZX0RPTkV9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLkdFVF9NRU1PUlk6e2M9e3R5cGU6Zy5HRVRfTUVNT1JZfTtjb25zdCBsPVtdO3ZhciBkPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihkLmluY2x1ZGVzKGYuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD0KZSYmMz49ZT9tPTIwOTcxNTI6NTw9ZSYmNj49ZT9tPTI2MjE0NDoxNTw9ZSYmMTk+PWU/bT0yMDk3MTUyOjI1PD1lJiYzMD49ZSYmKG09ODM4ODYwOCk7ZT1tP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbSk6bmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7Y1tmLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWQuaW5jbHVkZXMoZi5DQVJUUklER0VfUkFNKSYmKGU9eShhKS5idWZmZXIsY1tmLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtkLmluY2x1ZGVzKGYuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGNbZi5DQVJUUklER0VfSEVBREVSXT0KZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5HQU1FQk9ZX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLGNbZi5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGNbZi5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGQ9eihhKS5idWZmZXIsY1tmLklOVEVSTkFMX1NUQVRFXT0KZCxsLnB1c2goZCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGMsYi5tZXNzYWdlSWQpLGwpfX19ZnVuY3Rpb24gSyhhKXtjb25zdCBiPSJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGItMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTthLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiBBKGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEIoYSl7dmFyIGI9KCJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS0KYS5mcHNUaW1lU3RhbXBzW2EuZnBzVGltZVN0YW1wcy5sZW5ndGgtMV07Yj1DLWI7MD5iJiYoYj0wKTthLnVwZGF0ZUlkPXNldFRpbWVvdXQoKCk9PntEKGEpfSxNYXRoLmZsb29yKGIpKX1mdW5jdGlvbiBEKGEsYil7aWYoYS5wYXVzZWQpcmV0dXJuITA7dm9pZCAwIT09YiYmKEM9Yik7cj1hLmdldEZQUygpO2lmKHI+YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUrMSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksQihhKSwhMDtLKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZTtjP3YoYSxiKTooZT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLGIoZSkpfSkpLnRoZW4oKGIpPT57aWYoMDw9Yil7ayhoKHt0eXBlOmcuVVBEQVRFRCxmcHM6cn0pKTtiPSExO2Eub3B0aW9ucy5mcmFtZVNraXAmJjA8YS5vcHRpb25zLmZyYW1lU2tpcCYmCihhLmZyYW1lU2tpcENvdW50ZXIrKyxhLmZyYW1lU2tpcENvdW50ZXI8PWEub3B0aW9ucy5mcmFtZVNraXA/Yj0hMDphLmZyYW1lU2tpcENvdW50ZXI9MCk7Ynx8KGI9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OK2EuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkUpLmJ1ZmZlcixhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuVVBEQVRFRCxncmFwaGljc0ZyYW1lQnVmZmVyOmJ9KSxbYl0pKTtjb25zdCBjPXt0eXBlOmcuVVBEQVRFRH07Y1tmLkNBUlRSSURHRV9SQU1dPXkoYSkuYnVmZmVyO2NbZi5HQU1FQk9ZX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXI7CmNbZi5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7Y1tmLklOVEVSTkFMX1NUQVRFXT16KGEpLmJ1ZmZlcjtPYmplY3Qua2V5cyhjKS5mb3JFYWNoKChhKT0+e3ZvaWQgMD09PWNbYV0mJihjW2FdPShuZXcgVWludDhBcnJheSkuYnVmZmVyKX0pO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGMpLFtjW2YuQ0FSVFJJREdFX1JBTV0sY1tmLkdBTUVCT1lfTUVNT1JZXSxjW2YuUEFMRVRURV9NRU1PUlldLGNbZi5JTlRFUk5BTF9TVEFURV1dKTtCKGEpfWVsc2UgayhoKHt0eXBlOmcuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHYoYSxiKXt2YXIgYz1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PQpjJiZiKGMpO2lmKDE9PT1jKXtjPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0QXVkaW9RdWV1ZUluZGV4KCk7Y29uc3QgZD1yPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTsuMjU8YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzJiZkPyhFKGEsYyksc2V0VGltZW91dCgoKT0+e0EoYSk7dihhLGIpfSxNYXRoLmZsb29yKE1hdGguZmxvb3IoMUUzKihhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMtLjI1KSkvMTApKSk6KEUoYSxjKSx2KGEsYikpfX1mdW5jdGlvbiBFKGEsYil7Y29uc3QgYz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuVVBEQVRFRCxhdWRpb0J1ZmZlcjpjLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDwKYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9KSxbY10pO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCl9Y29uc3QgcD0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCB1O3B8fCh1PXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgZz17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIiwKUEFVU0U6IlBBVVNFIixVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQifSxmPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IHQ9MCx3PXt9O2NvbnN0IHg9e2Vudjp7bG9nOihhLGIsYyxkLGUsZyxmKT0+e3ZhciBoPShuZXcgVWludDMyQXJyYXkod2FzbUluc3RhbmNlLmV4cG9ydHMubWVtb3J5LmJ1ZmZlciwKYSwxKSlbMF07YT1TdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsbmV3IFVpbnQxNkFycmF5KHdhc21JbnN0YW5jZS5leHBvcnRzLm1lbW9yeS5idWZmZXIsYSs0LGgpKTstOTk5OSE9PWImJihhPWEucmVwbGFjZSgiJDAiLGIpKTstOTk5OSE9PWMmJihhPWEucmVwbGFjZSgiJDEiLGMpKTstOTk5OSE9PWQmJihhPWEucmVwbGFjZSgiJDIiLGQpKTstOTk5OSE9PWUmJihhPWEucmVwbGFjZSgiJDMiLGUpKTstOTk5OSE9PWcmJihhPWEucmVwbGFjZSgiJDQiLGcpKTstOTk5OSE9PWYmJihhPWEucmVwbGFjZSgiJDUiLGYpKTtjb25zb2xlLmxvZygiW1dhc21Cb3ldICIrYSl9LGhleExvZzooYSxiLGMsZCxlLGcpPT57aWYoIXdbYV0pe2xldCBmPSJbV2FzbUJveV0iOy05OTk5IT09YSYmKGYrPWAgMHgke2EudG9TdHJpbmcoMTYpfSBgKTstOTk5OSE9PWImJihmKz1gIDB4JHtiLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1jJiYoZis9YCAweCR7Yy50b1N0cmluZygxNil9IGApOy05OTk5IT09CmQmJihmKz1gIDB4JHtkLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1lJiYoZis9YCAweCR7ZS50b1N0cmluZygxNil9IGApOy05OTk5IT09ZyYmKGYrPWAgMHgke2cudG9TdHJpbmcoMTYpfSBgKTtjb25zb2xlLmxvZyhmKTt3W2FdPSEwO3NldFRpbWVvdXQoKCk9Pnt3W2FdPSExfSwxMDApfX19fSxGPWFzeW5jKGEpPT57bGV0IGI9dm9pZCAwO3JldHVybiBiPVdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nP2F3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nKGZldGNoKGEpLHgpOmF3YWl0IChhc3luYygpPT57Y29uc3QgYj1hd2FpdCBmZXRjaChhKS50aGVuKChhKT0+YS5hcnJheUJ1ZmZlcigpKTtyZXR1cm4gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYix4KX0pKCl9LEw9YXN5bmMoYSk9PnthPUJ1ZmZlci5mcm9tKGEuc3BsaXQoIiwiKVsxXSwiYmFzZTY0Iik7cmV0dXJuIGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGEseCl9LE09YXN5bmMoYSk9Pgp7YT0oYT9hd2FpdCBGKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmZoQmdDWDkvZjM5L2YzOS9md0JnQUFCZ0FYOEJmMkFDZjM4QVlBQUJmMkFCZndCZ0EzOS9md0JnQm45L2YzOS9md0JnQW45L0FYOWdCMzkvZjM5L2YzOEJmMkFFZjM5L2Z3QmdEWDkvZjM5L2YzOS9mMzkvZjM4QmYyQURmMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FBT2xBcU1DQWdJQ0FnRUJBd0VCQVFFQkFRRUJBUUVCQUFRQ0JBUUlDQWdLQ0FnSUNBb0pDQWdJREFnTURBc0pEUWNIQmdZREJRRUJBUVFFQlFFRUJBRUJBUUVFQlFFQkFRRUJBZ0lDQWdJQ0FRZ0NCQUVDQkFFQ0JBUUNCQVFFQWdnT0JnVUNBZ1VGQVFJRUFnSURCUVVGQlFVRkJRVUZCUVVGQlFVRkFRVUJCUUVGQVFVRkJRZ0ZCUVFFQlFZREF3RUNDQUVGQVFVRkJRVUZCUVVJQXdZQkFRRUZBUVVFQkFRRENBVURCUVVGQWdNREJnSUNBZ1FDQWdVQ0FnUUVCQUlDQWdJQ0FnTUZCUUlGQlFJRkJRSUZCUUlDQWdJQ0FnSUNBZ0lDQ0F3Q0FnVUNBZ0lDQkFNRkJBUUVCQUlDQ0FNQkFRRUJBUUVCQVFFQkFRRUNBUUVCQVFFQkFRRUJBUUVCQVFRQ0F3RUZCUThFQkFRRUJBUUVCQVFFQkFRRkN3RUVCQVFFQVFVRkJRTUJBQUFHNHdyOUFYOEFRUUFMZndCQmdJQ3NCQXQvQUVHTEFRdC9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUWYvL0F3dC9BRUdBRUF0L0FFR0FnQUVMZndCQmdKQUJDMzhBUVlDQUFndC9BRUdBa0FNTGZ3QkJnSUFCQzM4QVFZQ1FCQXQvQUVHQTZCOExmd0JCZ0pBRUMzOEFRWUFFQzM4QVFZQ2dCQXQvQUVHQXVBRUxmd0JCZ05nRkMzOEFRWURZQlF0L0FFR0FtQTRMZndCQmdJQU1DMzhBUVlDWUdndC9BRUdBZ0FrTGZ3QkJnSmdqQzM4QVFZRGdBQXQvQUVHQStDTUxmd0JCZ0lBSUMzOEFRWUQ0S3d0L0FFR0FnQWdMZndCQmdQZ3pDMzhBUVlDSStBTUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIUC9nTUxmd0ZCQUF0L0FVSHcvZ01MZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUThMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIL0FBdC9BVUgvQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmdQY0NDMzhCUVlDQUNBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZFgrQXd0L0FVSFIvZ01MZndGQjB2NERDMzhCUWRQK0F3dC9BVUhVL2dNTGZ3RkI2UDREQzM4QlFlditBd3QvQVVIcC9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVHQWdLd0VDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUWYvL0F3dC9BRUdBa0FRTGZ3QkJnSkFFQzM4QVFZQUVDMzhBUVlEWUJRdC9BRUdBbUE0TGZ3QkJnSmdhQzM4QVFZRDRJd3QvQUVHQStDc0xmd0JCZ1BnekN3ZTFEbFVHYldWdGIzSjVBZ0FHWTI5dVptbG5BQklNWlhobFkzVjBaVVp5WVcxbEFPWUJHV1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOEE2QUViWlhobFkzVjBaVVp5WVcxbFZXNTBhV3hDY21WaGEzQnZhVzUwQU9rQkMyVjRaV04xZEdWVGRHVndBT1VCQ1hOaGRtVlRkR0YwWlFEM0FRbHNiMkZrVTNSaGRHVUFoUUlPYUdGelEyOXlaVk4wWVhKMFpXUUFoZ0lPYzJWMFNtOTVjR0ZrVTNSaGRHVUFqQUlmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnRG5BUkJqYkdWaGNrRjFaR2x2UW5WbVptVnlBUDhCRjFkQlUwMUNUMWxmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd0FUVjBGVFRVSlBXVjlOUlUxUFVsbGZVMGxhUlFNQkVsZEJVMDFDVDFsZlYwRlRUVjlRUVVkRlV3TUNIa0ZUVTBWTlFreFpVME5TU1ZCVVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNREdrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlUU1ZwRkF3UVdWMEZUVFVKUFdWOVRWRUZVUlY5TVQwTkJWRWxQVGdNRkVsZEJVMDFDVDFsZlUxUkJWRVZmVTBsYVJRTUdJRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3Y2NSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1JRWxaSlJFVlBYMUpCVFY5TVQwTkJWRWxQVGdNSkRsWkpSRVZQWDFKQlRWOVRTVnBGQXdvUlYwOVNTMTlTUVUxZlRFOURRVlJKVDA0REN3MVhUMUpMWDFKQlRWOVRTVnBGQXd3bVQxUklSVkpmUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNEREU0pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBdzRZUjFKQlVFaEpRMU5mVDFWVVVGVlVYMHhQUTBGVVNVOU9BdzhVUjFKQlVFaEpRMU5mVDFWVVVGVlVYMU5KV2tVREVCUkhRa05mVUVGTVJWUlVSVjlNVDBOQlZFbFBUZ01SRUVkQ1ExOVFRVXhGVkZSRlgxTkpXa1VERWhoQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVEU5RFFWUkpUMDRERXhSQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVTBsYVJRTVVEa1pTUVUxRlgweFBRMEZVU1U5T0F4VUtSbEpCVFVWZlUwbGFSUU1XRjBKQlEwdEhVazlWVGtSZlRVRlFYMHhQUTBGVVNVOU9BeGNUUWtGRFMwZFNUMVZPUkY5TlFWQmZVMGxhUlFNWUVsUkpURVZmUkVGVVFWOU1UME5CVkVsUFRnTVpEbFJKVEVWZlJFRlVRVjlUU1ZwRkF4b1NUMEZOWDFSSlRFVlRYMHhQUTBGVVNVOU9BeHNPVDBGTlgxUkpURVZUWDFOSldrVURIQlZCVlVSSlQxOUNWVVpHUlZKZlRFOURRVlJKVDA0REhSRkJWVVJKVDE5Q1ZVWkdSVkpmVTBsYVJRTWVGa05CVWxSU1NVUkhSVjlTUVUxZlRFOURRVlJKVDA0REh4SkRRVkpVVWtsRVIwVmZVa0ZOWDFOSldrVURJQlpEUVZKVVVrbEVSMFZmVWs5TlgweFBRMEZVU1U5T0F5RVNRMEZTVkZKSlJFZEZYMUpQVFY5VFNWcEZBeUloWjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBQUlNWjJWMFVtVm5hWE4wWlhKQkFJMENER2RsZEZKbFoybHpkR1Z5UWdDT0FneG5aWFJTWldkcGMzUmxja01BandJTVoyVjBVbVZuYVhOMFpYSkVBSkFDREdkbGRGSmxaMmx6ZEdWeVJRQ1JBZ3huWlhSU1pXZHBjM1JsY2tnQWtnSU1aMlYwVW1WbmFYTjBaWEpNQUpNQ0RHZGxkRkpsWjJsemRHVnlSZ0NVQWhGblpYUlFjbTluY21GdFEyOTFiblJsY2dDVkFnOW5aWFJUZEdGamExQnZhVzUwWlhJQWxnSVpaMlYwVDNCamIyUmxRWFJRY205bmNtRnRRMjkxYm5SbGNnQ1hBZ1ZuWlhSTVdRQ1lBZ2hmYzJWMFlYSm5Zd0NpQWgxa2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVRQ2hBaGhrY21GM1ZHbHNaVVJoZEdGVWIxZGhjMjFOWlcxdmNua0Ftd0lHWjJWMFJFbFdBSndDQjJkbGRGUkpUVUVBblFJR1oyVjBWRTFCQUo0Q0JtZGxkRlJCUXdDZkFnWjFjR1JoZEdVQTVnRU5aVzExYkdGMGFXOXVVM1JsY0FEbEFSSm5aWFJCZFdScGIxRjFaWFZsU1c1a1pYZ0E1d0VQY21WelpYUkJkV1JwYjFGMVpYVmxBUDhCRG5kaGMyMU5aVzF2Y25sVGFYcGxBKzhCSEhkaGMyMUNiM2xKYm5SbGNtNWhiRk4wWVhSbFRHOWpZWFJwYjI0RDhBRVlkMkZ6YlVKdmVVbHVkR1Z5Ym1Gc1UzUmhkR1ZUYVhwbEEvRUJIV2RoYldWQ2IzbEpiblJsY201aGJFMWxiVzl5ZVV4dlkyRjBhVzl1QS9JQkdXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVk5wZW1VRDh3RVRkbWxrWlc5UGRYUndkWFJNYjJOaGRHbHZiZ1AwQVNKbWNtRnRaVWx1VUhKdlozSmxjM05XYVdSbGIwOTFkSEIxZEV4dlkyRjBhVzl1QS9jQkcyZGhiV1ZpYjNsRGIyeHZjbEJoYkdWMGRHVk1iMk5oZEdsdmJnUDFBUmRuWVcxbFltOTVRMjlzYjNKUVlXeGxkSFJsVTJsNlpRUDJBUlZpWVdOclozSnZkVzVrVFdGd1RHOWpZWFJwYjI0RCtBRUxkR2xzWlVSaGRHRk5ZWEFEK1FFVGMyOTFibVJQZFhSd2RYUk1iMk5oZEdsdmJnUDZBUkZuWVcxbFFubDBaWE5NYjJOaGRHbHZiZ1A4QVJSbllXMWxVbUZ0UW1GdWEzTk1iMk5oZEdsdmJnUDdBUWdDb0FJSzZjY0Jvd0lyQVFKL0l5MGhBU011UlNJQ0JFQWdBVVVoQWdzZ0FnUkFRUUVoQVFzZ0FVRU9kQ0FBUVlDQUFXdHFDdzhBSXpGQkRYUWdBRUdBd0FKcmFndTNBUUVDZndKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCREhVaUFpRUJJQUpGRFFBQ1FDQUJRUUZyRGcwQkFRRUNBZ0lDQXdNRUJBVUdBQXNNQmdzZ0FFR0ErRE5xRHdzZ0FCQUFRWUQ0TTJvUEMwRUFJUUVqTHdSQUl6QVFBMEVCY1NFQkN5QUFRWUNRZm1vZ0FVRU5kR29QQ3lBQUVBRkJnUGdyYWc4TElBQkJnSkIrYWc4TFFRQWhBU012QkVBak1oQURRUWR4SVFFTElBRkJBVWdFUUVFQklRRUxJQUFnQVVFTWRHcEJnUEI5YWc4TElBQkJnRkJxQ3drQUlBQVFBaTBBQUF1UkFRQkJBQ1F6UVFBa05FRUFKRFZCQUNRMlFRQWtOMEVBSkRoQkFDUTVRUUFrT2tFQUpEdEJBQ1E4UVFBa1BVRUFKRDVCQUNRL1FRQWtRQ012QkVCQkVTUTBRWUFCSkR0QkFDUTFRUUFrTmtIL0FTUTNRZFlBSkRoQkFDUTVRUTBrT2dWQkFTUTBRYkFCSkR0QkFDUTFRUk1rTmtFQUpEZEIyQUVrT0VFQkpEbEJ6UUFrT2d0QmdBSWtQVUgrL3dNa1BBdWtBUUVDZjBFQUpFRkJBU1JDUWNjQ0VBTWhBVUVBSkVOQkFDUkVRUUFrUlVFQUpFWkJBQ1F1SUFFRVFDQUJRUUZPSWdBRVFDQUJRUU5NSVFBTElBQUVRRUVCSkVRRklBRkJCVTRpQUFSQUlBRkJCa3doQUFzZ0FBUkFRUUVrUlFVZ0FVRVBUaUlBQkVBZ0FVRVRUQ0VBQ3lBQUJFQkJBU1JHQlNBQlFSbE9JZ0FFUUNBQlFSNU1JUUFMSUFBRVFFRUJKQzRMQ3dzTEJVRUJKRU1MUVFFa0xVRUFKREVMQ3dBZ0FCQUNJQUU2QUFBTEx3QkIwZjREUWY4QkVBWkIwdjREUWY4QkVBWkIwLzREUWY4QkVBWkIxUDREUWY4QkVBWkIxZjREUWY4QkVBWUxtQUVBUVFBa1IwRUFKRWhCQUNSSlFRQWtTa0VBSkV0QkFDUk1RUUFrVFNNdkJFQkJrQUVrU1VIQS9nTkJrUUVRQmtIQi9nTkJnUUVRQmtIRS9nTkJrQUVRQmtISC9nTkIvQUVRQmdWQmtBRWtTVUhBL2dOQmtRRVFCa0hCL2dOQmhRRVFCa0hHL2dOQi93RVFCa0hIL2dOQi9BRVFCa0hJL2dOQi93RVFCa0hKL2dOQi93RVFCZ3RCei80RFFRQVFCa0h3L2dOQkFSQUdDMDhBSXk4RVFFSG8vZ05Cd0FFUUJrSHAvZ05CL3dFUUJrSHEvZ05Cd1FFUUJrSHIvZ05CRFJBR0JVSG8vZ05CL3dFUUJrSHAvZ05CL3dFUUJrSHEvZ05CL3dFUUJrSHIvZ05CL3dFUUJnc0xMd0JCa1A0RFFZQUJFQVpCa2Y0RFFiOEJFQVpCa3Y0RFFmTUJFQVpCay80RFFjRUJFQVpCbFA0RFFiOEJFQVlMTEFCQmxmNERRZjhCRUFaQmx2NERRVDhRQmtHWC9nTkJBQkFHUVpqK0EwRUFFQVpCbWY0RFFiZ0JFQVlMTWdCQm12NERRZjhBRUFaQm0vNERRZjhCRUFaQm5QNERRWjhCRUFaQm5mNERRUUFRQmtHZS9nTkJ1QUVRQmtFQkpGNExMUUJCbi80RFFmOEJFQVpCb1A0RFFmOEJFQVpCb2Y0RFFRQVFCa0dpL2dOQkFCQUdRYVArQTBHL0FSQUdDemdBUVE4a1gwRVBKR0JCRHlSaFFROGtZa0VBSkdOQkFDUmtRUUFrWlVFQUpHWkIvd0FrWjBIL0FDUm9RUUVrYVVFQkpHcEJBQ1JyQzJjQVFRQWtUa0VBSkU5QkFDUlFRUUVrVVVFQkpGSkJBU1JUUVFFa1ZFRUJKRlZCQVNSV1FRRWtWMEVCSkZoQkFTUlpRUUFrV2tFQUpGdEJBQ1JjUVFBa1hSQUtFQXNRREJBTlFhVCtBMEgzQUJBR1FhWCtBMEh6QVJBR1FhYitBMEh4QVJBR0VBNExVZ0JCQUNSc1FRQWtiVUVBSkc1QkFDUnZRUUFrY0VFQUpIRkJBQ1J5UVFBa2N5TXZCRUJCaFA0RFFSNFFCa0dnUFNSdEJVR0UvZ05CcXdFUUJrSE0xd0lrYlF0QmgvNERRZmdCRUFaQitBRWtjUXZKQVFFQ2YwSERBaEFESWdGQndBRkdJZ0JGQkVBakpRUi9JQUZCZ0FGR0JTTWxDeUVBQ3lBQUJFQkJBU1F2QlVFQUpDOExFQVFRQlJBSEVBZ1FDUkFQRUJBakx3UkFRZkQrQTBINEFSQUdRYy8rQTBIK0FSQUdRYzMrQTBIK0FCQUdRWUQrQTBIUEFSQUdRWUwrQTBIOEFCQUdRWS8rQTBIaEFSQUdRZXorQTBIK0FSQUdRZlgrQTBHUEFSQUdCVUh3L2dOQi93RVFCa0hQL2dOQi93RVFCa0hOL2dOQi93RVFCa0dBL2dOQnp3RVFCa0dDL2dOQi9nQVFCa0dQL2dOQjRRRVFCZ3RCQUNRakM1MEJBQ0FBUVFCS0JFQkJBU1FrQlVFQUpDUUxJQUZCQUVvRVFFRUJKQ1VGUVFBa0pRc2dBa0VBU2dSQVFRRWtKZ1ZCQUNRbUN5QURRUUJLQkVCQkFTUW5CVUVBSkNjTElBUkJBRW9FUUVFQkpDZ0ZRUUFrS0FzZ0JVRUFTZ1JBUVFFa0tRVkJBQ1FwQ3lBR1FRQktCRUJCQVNRcUJVRUFKQ29MSUFkQkFFb0VRRUVCSkNzRlFRQWtLd3NnQ0VFQVNnUkFRUUVrTEFWQkFDUXNDeEFSQ3hBQUl6TUVRRUdneVFnUEMwSFFwQVFMQ1FBZ0FFSC8vd054Q3c0QUl6TUVRRUdRQnc4TFFjZ0RDd1FBRUJVTEZRQWdBRUdBa0g1cUlBRkJBWEZCRFhScUxRQUFDdzBBSUFGQkFTQUFkSEZCQUVjTERnQWdBVUdnQVd3Z0FHcEJBMndMRlFBZ0FDQUJFQmxCZ05nRmFpQUNhaUFET2dBQUN3c0FJQUZCb0FGc0lBQnFDeEFBSUFBZ0FSQWJRWUNnQkdvdEFBQUxEUUFnQVVFQklBQjBRWDl6Y1FzS0FDQUJRUUVnQUhSeUN5c0JBWDhnQWtFRGNTRUVJQU5CQVhFRVFFRUNJQVFRSGlFRUN5QUFJQUVRRzBHQW9BUnFJQVE2QUFBTHB3SUJBMzhnQVVFQVNpSURCRUFnQUVFSVNpRURDeUFEQkVBZ0JpTjVSaUVEQ3lBREJFQWdBQ042UmlFREN5QURCRUJCQUNFRFFRQWhCa0VGSUFSQkFXc1FBeEFZQkVCQkFTRURDMEVGSUFRUUF4QVlCRUJCQVNFR0N3SkFRUUFoQkFOQUlBUkJDRTROQVNBRElBWkhCRUJCQnlBRWF5RUVDeUFBSUFScVFhQUJUQVJBSUFCQkNDQUVhMnNoQ0NBQUlBUnFJQUVRR1VHQTJBVnFJUWtDUUVFQUlRVURRQ0FGUVFOT0RRRWdBQ0FFYWlBQklBVWdDU0FGYWkwQUFCQWFJQVZCQVdvaEJRd0FBQXNBQ3lBQUlBUnFJQUZCQWlBSUlBRVFIQ0lGRUIxQkFpQUZFQmdRSHlBSFFRRnFJUWNMSUFSQkFXb2hCQXdBQUFzQUN3VWdCaVI1Q3lBQUkzcE9CRUFnQUVFSWFpUjZJQUFnQWtFSWJ5SUdTQVJBSTNvZ0Jtb2tlZ3NMSUFjTE9BRUJmeUFBUVlDUUFrWUVRQ0FCUVlBQmFpRUNRUWNnQVJBWUJFQWdBVUdBQVdzaEFnc2dBQ0FDUVFSMGFnOExJQUFnQVVFRWRHb0xKQUVCZnlBQVFUOXhJUUlnQVVFQmNRUkFJQUpCUUdzaEFnc2dBa0dBa0FScUxRQUFDeElBSUFCQi93RnhRUWgwSUFGQi93RnhjZ3NnQVFGL0lBQkJBM1FnQVVFQmRHb2lBMEVCYWlBQ0VDSWdBeUFDRUNJUUl3c1ZBQ0FCUVI4Z0FFRUZiQ0lBZEhFZ0FIVkJBM1FMV1FBZ0FrRUJjVVVFUUNBQkVBTWdBRUVCZEhWQkEzRWhBQXRCOGdFaEFRSkFBa0FDUUFKQUFrQWdBRVVOQkFKQUlBQkJBV3NPQXdJREJBQUxEQVFBQ3dBTFFhQUJJUUVNQWd0QjJBQWhBUXdCQzBFSUlRRUxJQUVMRFFBZ0FTQUNiQ0FBYWtFRGJBdXJBZ0VHZnlBQklBQVFJU0FGUVFGMGFpSUFJQUlRRnlFUklBQkJBV29nQWhBWElSSUNRQ0FESVFBRFFDQUFJQVJLRFFFZ0JpQUFJQU5yYWlJT0lBaElCRUFnQUNFQklBeEJBRWdpQWtVRVFFRUZJQXdRR0VVaEFnc2dBZ1JBUVFjZ0FXc2hBUXRCQUNFQ0lBRWdFaEFZQkVCQkFpRUNDeUFCSUJFUUdBUkFJQUpCQVdvaEFnc2dERUVBVGdSL1FRQWdERUVIY1NBQ1FRQVFKQ0lGRUNVaEQwRUJJQVVRSlNFQlFRSWdCUkFsQlNBTFFRQk1CRUJCeC80RElRc0xJQUlnQ3lBS0VDWWlCU0VQSUFVaUFRc2hCU0FKSUE0Z0J5QUlFQ2RxSWhBZ0R6b0FBQ0FRUVFGcUlBRTZBQUFnRUVFQ2FpQUZPZ0FBUVFBaEFTQU1RUUJPQkVCQkJ5QU1FQmdoQVFzZ0RpQUhJQUlnQVJBZklBMUJBV29oRFFzZ0FFRUJhaUVBREFBQUN3QUxJQTBMaFFFQkEzOGdBMEVJYnlFRElBQkZCRUFnQWlBQ1FRaHRRUU4wYXlFSEMwRUhJUWdnQUVFSWFrR2dBVW9FUUVHZ0FTQUFheUVJQzBGL0lRSWpMd1JBUVFNZ0JFRUJFQmNpQWtIL0FYRVFHQVJBUVFFaENRdEJCaUFDRUJnRVFFRUhJQU5ySVFNTEN5QUdJQVVnQ1NBSElBZ2dBeUFBSUFGQm9BRkJnTmdGUVFCQkFDQUNFQ2dMM1FFQUlBVWdCaEFoSVFZZ0JFRUJFQmNoQkNBRFFRaHZJUU5CQmlBRUVCZ0VRRUVISUFOcklRTUxRUUFoQlVFRElBUVFHQVJBUVFFaEJRc2dCaUFEUVFGMGFpSURJQVVRRnlFR0lBTkJBV29nQlJBWElRVWdBa0VJYnlFRFFRVWdCQkFZUlFSQVFRY2dBMnNoQXd0QkFDRUNJQU1nQlJBWUJFQkJBaUVDQ3lBRElBWVFHQVJBSUFKQkFXb2hBZ3RCQUNBRVFRZHhJQUpCQUJBa0lnTVFKU0VGUVFFZ0F4QWxJUVpCQWlBREVDVWhBeUFBSUFGQkFDQUZFQm9nQUNBQlFRRWdCaEFhSUFBZ0FVRUNJQU1RR2lBQUlBRWdBa0VISUFRUUdCQWZDMzhBSUFRZ0JSQWhJQU5CQ0c5QkFYUnFJZ1JCQUJBWElRVkJBQ0VESUFSQkFXcEJBQkFYSVFSQkJ5QUNRUWh2YXlJQ0lBUVFHQVJBUVFJaEF3c2dBaUFGRUJnRVFDQURRUUZxSVFNTElBQWdBVUVBSUFOQngvNERRUUFRSmlJQ0VCb2dBQ0FCUVFFZ0FoQWFJQUFnQVVFQ0lBSVFHaUFBSUFFZ0EwRUFFQjhMM0FFQkJuOGdBMEVEZFNFTEFrQURRQ0FFUWFBQlRnMEJJQVFnQldvaUJrR0FBazRFUUNBR1FZQUNheUVHQ3lBQ0lBdEJCWFJxSUFaQkEzVnFJZ2xCQUJBWElRZEJBQ0VLSXl3RVFDQUVJQUFnQmlBRElBa2dBU0FIRUNBaUNFRUFTZ1JBSUFRZ0NFRUJhMm9oQkVFQklRb0xDeU1yQkg4Z0NrVUZJeXNMSWdnRVFDQUVJQUFnQmlBRElBa2dBU0FIRUNraUNFRUFTZ1JBSUFRZ0NFRUJhMm9oQkFzRklBcEZCRUFqTHdSQUlBUWdBQ0FHSUFNZ0NTQUJJQWNRS2dVZ0JDQUFJQVlnQXlBQklBY1FLd3NMQ3lBRVFRRnFJUVFNQUFBTEFBc0xMQUVDZnlOS0lRUWdBQ05MYWlJRFFZQUNUZ1JBSUFOQmdBSnJJUU1MSUFBZ0FTQUNJQU5CQUNBRUVDd0xNQUVEZnlOTUlRTWdBQ05OSWdSSUJFQVBDeUFEUVFkcklnTkJmMndoQlNBQUlBRWdBaUFBSUFScklBTWdCUkFzQzRVRkFSQi9Ba0JCSnlFSkEwQWdDVUVBU0EwQklBbEJBblFpQTBHQS9BTnFFQU1oQWlBRFFZSDhBMm9RQXlFTElBTkJndndEYWhBRElRUWdBa0VRYXlFQ0lBdEJDR3NoQzBFSUlRVWdBVUVCY1FSQVFSQWhCU0FFUVFKdlFRRkdCRUFnQkVFQmF5RUVDd3NnQUNBQ1RpSUdCRUFnQUNBQ0lBVnFTQ0VHQ3lBR0JFQkJCeUFEUVlQOEEyb1FBeUlHRUJnaERFRUdJQVlRR0NFRFFRVWdCaEFZSVE4Z0FDQUNheUVDSUFNRVFDQUNJQVZyUVg5c1FRRnJJUUlMUVlDQUFpQUVFQ0VnQWtFQmRHb2hCRUVBSVFJakx3Ui9RUU1nQmhBWUJTTXZDeUlEQkVCQkFTRUNDeUFFSUFJUUZ5RVFJQVJCQVdvZ0FoQVhJUkVDUUVFSElRVURRQ0FGUVFCSURRRWdCU0VDSUE4RVFDQUNRUWRyUVg5c0lRSUxRUUFoQ0NBQ0lCRVFHQVJBUVFJaENBc2dBaUFRRUJnRVFDQUlRUUZxSVFnTElBZ0VRQ0FMUVFjZ0JXdHFJZ2RCQUU0aUFnUkFJQWRCb0FGTUlRSUxJQUlFUUVFQUlRSkJBQ0VOUVFBaERpTXZCSDhqZDBVRkl5OExJZ1FFUUVFQklRSUxJQUpGQkVBZ0J5QUFFQndpQ2tFRGNTRURJQXdFZnlBRFFRQktCU0FNQ3lJRUJFQkJBU0VOQlNNdkJIOUJBaUFLRUJnRkl5OExJZ1FFUUNBRFFRQktJUVFMSUFRRVFFRUJJUTRMQ3dzZ0FrVUVRQ0FOUlNJREJIOGdEa1VGSUFNTElRSUxJQUlFUUNNdkJFQkJBQ0FHUVFkeElBaEJBUkFrSWdNUUpTRUVRUUVnQXhBbElRSkJBaUFERUNVaEF5QUhJQUJCQUNBRUVCb2dCeUFBUVFFZ0FoQWFJQWNnQUVFQ0lBTVFHZ1ZCeVA0RElRTkJCQ0FHRUJnRVFFSEovZ01oQXdzZ0J5QUFRUUFnQ0NBRFFRQVFKaUlLRUJvZ0J5QUFRUUVnQ2hBYUlBY2dBRUVDSUFvUUdnc0xDd3NnQlVFQmF5RUZEQUFBQ3dBTEN5QUpRUUZySVFrTUFBQUxBQXNMWmdFQ2YwR0FrQUloQWlOMkJFQkJnSUFDSVFJTEl5OEVmeU12QlNOM0N5SUJCRUJCZ0xBQ0lRRWplQVJBUVlDNEFpRUJDeUFBSUFJZ0FSQXRDeU43QkVCQmdMQUNJUUVqZkFSQVFZQzRBaUVCQ3lBQUlBSWdBUkF1Q3lOOUJFQWdBQ04rRUM4TEN5VUJBWDhDUUFOQUlBQkJrQUZMRFFFZ0FFSC9BWEVRTUNBQVFRRnFJUUFNQUFBTEFBc0xTZ0VDZndKQUEwQWdBRUdRQVU0TkFRSkFRUUFoQVFOQUlBRkJvQUZPRFFFZ0FTQUFFQnRCZ0tBRWFrRUFPZ0FBSUFGQkFXb2hBUXdBQUFzQUN5QUFRUUZxSVFBTUFBQUxBQXNMQ2dCQmZ5UjVRWDhrZWdzT0FDTXpCRUJCOEFVUEMwSDRBZ3NPQUNNekJFQkI4Z01QQzBINUFRc2JBUUYvSUFCQmovNERFQU1RSGlJQkpJRUJRWS8rQXlBQkVBWUxDd0JCQVNTQUFVRUJFRFlMRGdBak13UkFRYTRCRHd0QjF3QUxFQUFqTXdSQVFZQ0FBUThMUVlEQUFBc3VBUUYvSTRZQlFRQktJZ0FFUUNPSEFTRUFDeUFBQkVBamhnRkJBV3NraGdFTEk0WUJSUVJBUVFBa2lBRUxDeTRCQVg4amlRRkJBRW9pQUFSQUk0b0JJUUFMSUFBRVFDT0pBVUVCYXlTSkFRc2ppUUZGQkVCQkFDU0xBUXNMTGdFQmZ5T01BVUVBU2lJQUJFQWpqUUVoQUFzZ0FBUkFJNHdCUVFGckpJd0JDeU9NQVVVRVFFRUFKSTRCQ3dzdUFRRi9JNDhCUVFCS0lnQUVRQ09RQVNFQUN5QUFCRUFqandGQkFXc2tqd0VMSTQ4QlJRUkFRUUFra1FFTEN5SUJBWDhqbFFFamxnRjFJUUFqbHdFRWZ5T1ZBU0FBYXdVamxRRWdBR29MSWdBTFJRRUNmMEdVL2dNUUEwSDRBWEVoQVVHVC9nTWdBRUgvQVhFaUFoQUdRWlQrQXlBQklBQkJDSFVpQUhJUUJpQUNKSmdCSUFBa21RRWptUUZCQ0hRam1BRnlKSm9CQ3prQkFuOFFQaUlBUWY4UFRDSUJCRUFqbGdGQkFFb2hBUXNnQVFSQUlBQWtsUUVnQUJBL0VENGhBQXNnQUVIL0Qwb0VRRUVBSklnQkN3c3ZBQ09TQVVFQmF5U1NBU09TQVVFQVRBUkFJNU1CSkpJQkk1UUJCSDhqa3dGQkFFb0ZJNVFCQ3dSQUVFQUxDd3RnQVFGL0k1c0JRUUZySkpzQkk1c0JRUUJNQkVBam5BRWttd0VqbXdFRVFDT2RBUVIvSTU0QlFROUlCU09kQVFzaUFBUkFJNTRCUVFGcUpKNEJCU09kQVVVaUFBUkFJNTRCUVFCS0lRQUxJQUFFUUNPZUFVRUJheVNlQVFzTEN3c0xZQUVCZnlPZkFVRUJheVNmQVNPZkFVRUFUQVJBSTZBQkpKOEJJNThCQkVBam9RRUVmeU9pQVVFUFNBVWpvUUVMSWdBRVFDT2lBVUVCYWlTaUFRVWpvUUZGSWdBRVFDT2lBVUVBU2lFQUN5QUFCRUFqb2dGQkFXc2tvZ0VMQ3dzTEMyQUJBWDhqb3dGQkFXc2tvd0Vqb3dGQkFFd0VRQ09rQVNTakFTT2pBUVJBSTZVQkJIOGpwZ0ZCRDBnRkk2VUJDeUlBQkVBanBnRkJBV29rcGdFRkk2VUJSU0lBQkVBanBnRkJBRW9oQUFzZ0FBUkFJNllCUVFGckpLWUJDd3NMQ3d1TkFRRUJmeU5hSUFCcUpGb2pXaEE1VGdSQUkxb1FPV3NrV2dKQUFrQUNRQUpBQWtBalhDSUJCRUFDUUNBQlFRSnJEZ1lDQUFNQUJBVUFDd3dGQ3hBNkVEc1FQQkE5REFRTEVEb1FPeEE4RUQwUVFRd0RDeEE2RURzUVBCQTlEQUlMRURvUU94QThFRDBRUVF3QkN4QkNFRU1RUkFzalhFRUJhaVJjSTF4QkNFNEVRRUVBSkZ3TFFRRVBDMEVBQ3gwQUk2Y0JJQUJxSktjQkk2Z0JJNmNCYTBFQVNnUkFRUUFQQzBFQkM0TUJBUUYvQWtBQ1FBSkFBa0FnQUVFQlJ3UkFJQUFpQVVFQ1JnMEJJQUZCQTBZTkFpQUJRUVJHRFFNTUJBc2pZeU9wQVVjRVFDT3BBU1JqUVFFUEMwRUFEd3NqWkNPcUFVY0VRQ09xQVNSa1FRRVBDMEVBRHdzalpTT3JBVWNFUUNPckFTUmxRUUVQQzBFQUR3c2paaU9zQVVjRVFDT3NBU1JtUVFFUEMwRUFEd3RCQUFzZEFDT3RBU0FBYWlTdEFTT3VBU090QVd0QkFFb0VRRUVBRHd0QkFRc3BBQ092QVNBQWFpU3ZBU093QVNPdkFXdEJBRW9pQUFSQUkxNUZJUUFMSUFBRVFFRUFEd3RCQVFzZEFDT3hBU0FBYWlTeEFTT3lBU094QVd0QkFFb0VRRUVBRHd0QkFRc2RBRUdBRUNPYUFXdEJBblFrcUFFak13UkFJNmdCUVFGMEpLZ0JDd3RGQVFGL0FrQUNRQUpBSUFCQkFVY0VRQ0FBSWdKQkFrWU5BU0FDUVFOR0RRSU1Bd3NnQVVHQkFSQVlEd3NnQVVHSEFSQVlEd3NnQVVIK0FCQVlEd3NnQVVFQkVCZ0xmd0VCZnlPb0FTQUFheVNvQVNPb0FVRUFUQVJBSTZnQklRQVFTeU9vQVNBQVFRQWdBR3NnQUVFQVNodHJKS2dCSTdNQlFRRnFKTE1CSTdNQlFRaE9CRUJCQUNTekFRc0xJNGdCQkg4anFRRUZJNGdCQ3lJQUJIOGpuZ0VGUVE4UEN5RUFRUUVoQVNPMEFTT3pBUkJNUlFSQVFYOGhBUXNnQVNBQWJFRVBhZ3NTQVFGL0k2Y0JJUUJCQUNTbkFTQUFFRTBMSFFCQmdCQWp0UUZyUVFKMEpLNEJJek1FUUNPdUFVRUJkQ1N1QVFzTGZ3RUJmeU91QVNBQWF5U3VBU091QVVFQVRBUkFJNjRCSVFBUVR5T3VBU0FBUVFBZ0FHc2dBRUVBU2h0ckpLNEJJN1lCUVFGcUpMWUJJN1lCUVFoT0JFQkJBQ1MyQVFzTEk0c0JCSDhqcWdFRkk0c0JDeUlBQkg4am9nRUZRUThQQ3lFQVFRRWhBU08zQVNPMkFSQk1SUVJBUVg4aEFRc2dBU0FBYkVFUGFnc1NBUUYvSTYwQklRQkJBQ1N0QVNBQUVGQUxIUUJCZ0JBanVBRnJRUUYwSkxBQkl6TUVRQ093QVVFQmRDU3dBUXNMaGdJQkFuOGpzQUVnQUdza3NBRWpzQUZCQUV3RVFDT3dBU0VDRUZJanNBRWdBa0VBSUFKcklBSkJBRW9iYXlTd0FTTzVBVUVCYWlTNUFTTzVBVUVnVGdSQVFRQWt1UUVMQzBFQUlRSWp1Z0VoQUNPT0FRUi9JNnNCQlNPT0FRc2lBUVJBSTE0RVFFR2MvZ01RQTBFRmRVRVBjU0lBSkxvQlFRQWtYZ3NGUVE4UEN5TzVBVUVDYlVHdy9nTnFFQU1oQVNPNUFVRUNid1IvSUFGQkQzRUZJQUZCQkhWQkQzRUxJUUVDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCSUFCQkFrWU5BZ3dEQ3lBQlFRUjFJUUVNQXd0QkFTRUNEQUlMSUFGQkFYVWhBVUVDSVFJTUFRc2dBVUVDZFNFQlFRUWhBZ3NnQWtFQVNnUi9JQUVnQW0wRlFRQUxJZ0ZCRDJvTEVnRUJmeU92QVNFQVFRQWtyd0VnQUJCVEN4c0JBWDhqdXdFanZBRjBJUUFqTXdSQUlBQkJBWFFoQUFzZ0FBdXZBUUVCZnlPeUFTQUFheVN5QVNPeUFVRUFUQVJBSTdJQklRQVFWU1N5QVNPeUFTQUFRUUFnQUdzZ0FFRUFTaHRySkxJQkk3MEJRUUZ4SVFFanZRRkJBWFZCQVhFaEFDTzlBVUVCZFNTOUFTTzlBU0FCSUFCeklnRkJEblJ5SkwwQkk3NEJCRUFqdlFGQnYzOXhKTDBCSTcwQklBRkJCblJ5SkwwQkN3c2prUUVFZnlPc0FRVWprUUVMSWdBRWZ5T21BUVZCRHc4TElRRkJBQ085QVJBWUJIOUJmd1ZCQVFzaUFDQUJiRUVQYWdzU0FRRi9JN0VCSVFCQkFDU3hBU0FBRUZZTEVnQWpNd1JBUVlDQWdBUVBDMEdBZ0lBQ0N3UUFFRmdMQkFBZ0FBc3lBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJDRzFCb0kwR2JVRThha0dnalFac1FZenhBbTBRV2d1NEFRRUJmMEVBSkdralVRUi9JQUFGUVE4TElRUWpVZ1IvSUFRZ0FXb0ZJQVJCRDJvTElRUWpVd1IvSUFRZ0Ftb0ZJQVJCRDJvTElRUWpWQVIvSUFRZ0Eyb0ZJQVJCRDJvTElRUWpWUVIvSUFBRlFROExJUUFqVmdSL0lBQWdBV29GSUFCQkQyb0xJUUFqVndSL0lBQWdBbW9GSUFCQkQyb0xJUUFqV0FSL0lBQWdBMm9GSUFCQkQyb0xJUUJCQUNScVFRQWtheUFFSTA5QkFXb1FXeUVCSUFBalVFRUJhaEJiSVFBZ0FTUm5JQUFrYUNBQklBQVFJd3NsQVFGL0lBSkJBWFJCZ1BnamFpSURJQUJCQVdvNkFBQWdBMEVCYWlBQlFRRnFPZ0FBQzVBQ0FRUi9JQUFRUmlJQlJRUkFRUUVRUnlFQkN5QUFFRWdpQWtVRVFFRUNFRWNoQWdzZ0FCQkpJZ05GQkVCQkF4QkhJUU1MSUFBUVNpSUVSUVJBUVFRUVJ5RUVDeUFCUVFGeEJFQVFUaVJmQ3lBQ1FRRnhCRUFRVVNSZ0N5QURRUUZ4QkVBUVZDUmhDeUFFUVFGeEJFQVFWeVJpQ3lBQlFRRnhSUVJBSUFJaEFRc2dBVUVCY1VVRVFDQURJUUVMSUFGQkFYRkZCRUFnQkNFQkN5QUJRUUZ4QkVCQkFTUnJDeU5iSUFBanZ3RnNhaVJiSTFzUVdVNEVRQ05iRUZsckpGc2phd1IvSTJzRkkya0xJZ0ZGQkVBamFpRUJDeUFCQkVBalh5TmdJMkVqWWhCY0dnc2paMEVCYWlOb1FRRnFJMTBRWFNOZFFRRnFKRjBqWFNQQUFVRUNiVUVCYTA0RVFDTmRRUUZySkYwTEN3c01BQ0FBUVlEK0EzRkJDSFVMQ0FBZ0FFSC9BWEVMZndFRWZ5QUFFRTBoQVNBQUVGQWhBaUFBRUZNaEF5QUFFRlloQkNBQkpGOGdBaVJnSUFNa1lTQUVKR0lqV3lBQUk3OEJiR29rV3lOYkVGbE9CRUFqV3hCWmF5UmJJQUVnQWlBRElBUVFYQ0lBRUY5QkFXb2dBQkJnUVFGcUkxMFFYU05kUVFGcUpGMGpYU1BBQVVFQ2JVRUJhMDRFUUNOZFFRRnJKRjBMQ3dzakFRRi9JQUFRUlNFQkl5b0VmeUFCUlFVaktnc2lBUVJBSUFBUVhnVWdBQkJoQ3dzakFDTk9FRGhJQkVBUEN3TkFJMDRRT0U0RVFCQTRFR0lqVGhBNGF5Uk9EQUVMQ3d0ekFRRi9JQUJCcHY0RFJnUkFRYWIrQXhBRFFZQUJjU0VCSTRnQkJIOUJBQ0FCRUI0RlFRQWdBUkFkQ3hvaml3RUVmMEVCSUFFUUhnVkJBU0FCRUIwTEdpT09BUVIvUVFJZ0FSQWVCVUVDSUFFUUhRc2FJNUVCQkg5QkF5QUJFQjRGUVFNZ0FSQWRDeG9nQVVId0FISVBDMEYvQzhRQkFRRi9JOEVCSVFBandnRUVRQ1BEQVFSL1FRSWdBQkFkQlVFQ0lBQVFIZ3NoQUNQRUFRUi9RUUFnQUJBZEJVRUFJQUFRSGdzaEFDUEZBUVIvUVFNZ0FCQWRCVUVESUFBUUhnc2hBQ1BHQVFSL1FRRWdBQkFkQlVFQklBQVFIZ3NoQUFVanh3RUVRQ1BJQVFSL1FRQWdBQkFkQlVFQUlBQVFIZ3NoQUNQSkFRUi9RUUVnQUJBZEJVRUJJQUFRSGdzaEFDUEtBUVIvUVFJZ0FCQWRCVUVDSUFBUUhnc2hBQ1BMQVFSL1FRTWdBQkFkQlVFRElBQVFIZ3NoQUFzTElBQkI4QUZ5QzRZQ0FRRi9JQUJCZ0lBQ1NBUkFRWDhQQ3lBQVFZQ0FBazRpQVFSQUlBQkJnTUFDU0NFQkN5QUJCRUJCZnc4TElBQkJnTUFEVGlJQkJFQWdBRUdBL0FOSUlRRUxJQUVFUUNBQVFZQkFhaEFERHdzZ0FFR0EvQU5PSWdFRVFDQUFRWi85QTB3aEFRc2dBUVJBSTM5QkFrZ0VRRUgvQVE4TFFYOFBDeUFBUWNUK0EwWUVRQ0FBSTBrUUJpTkpEd3NnQUVHUS9nTk9JZ0VFUUNBQVFhYitBMHdoQVFzZ0FRUkFFR01nQUJCa0R3c2dBRUd3L2dOT0lnRUVRQ0FBUWIvK0Ewd2hBUXNnQVFSQUVHTkJmdzhMSUFCQmhQNERSZ1JBSUFBamJSQmZJZ0VRQmlBQkR3c2dBRUdGL2dOR0JFQWdBQ051RUFZamJnOExJQUJCZ1A0RFJnUkFFR1VQQzBGL0N4c0JBWDhnQUJCbUlnRkJmMFlFUUNBQUVBTVBDeUFCUWY4QmNRdnNBZ0VDZnlOREJFQVBDeUFBUWY4L1RBUkFJMFVFZjBFRUlBRkIvd0Z4RUJoRkJTTkZDeUlBUlFSQUlBRkJEM0VpQWdSQUlBSkJDa1lFUUVFQkpFRUxCVUVBSkVFTEN3VWdBRUgvL3dCTUJFQWpMa1VpQWtVRVFDQUFRZi9mQUV3aEFnc2dBZ1JBSTBVRVFDQUJRUTl4SkMwTElBRWhBaU5FQkVBZ0FrRWZjU0VDSXkxQjRBRnhKQzBGSTBZRVFDQUNRZjhBY1NFQ0l5MUJnQUZ4SkMwRkl5NEVRRUVBSkMwTEN3c2pMU0FDY2lRdEJVRUFJUUlqTFJCZ0lRTWdBVUVBU2dSQVFRRWhBZ3NnQWlBREVDTWtMUXNGSTBWRklnTUVRQ0FBUWYrL0FVd2hBd3NnQXdSQUkwUUVmeU5DQlNORUN5SUFCRUFqTFVFZmNTUXRJeTBnQVVIZ0FYRnlKQzBQQ3lOR0JFQWdBVUVJVGlJREJFQWdBVUVNVENFREN3c2dBU0VESXk0RWZ5QURRUTl4QlNBRFFRTnhDeUlESkRFRkkwVkZJZ01FUUNBQVFmLy9BVXdoQXdzZ0F3UkFJMFFFUUVFQUlBRkIvd0Z4RUJnRVFFRUJKRUlGUVFBa1Fnc0xDd3NMQ3dzZkFDQUFRZkFBY1VFRWRTU1RBVUVESUFBUUdDU1hBU0FBUVFkeEpKWUJDd3NBUVFjZ0FCQVlKS3NCQ3g4QUlBQkJCblZCQTNFa3RBRWdBRUUvY1NUTUFVSEFBQ1BNQVdza2hnRUxId0FnQUVFR2RVRURjU1MzQVNBQVFUOXhKTTBCUWNBQUk4MEJheVNKQVFzUkFDQUFKTTRCUVlBQ0k4NEJheVNNQVFzVUFDQUFRVDl4Sk04QlFjQUFJODhCYXlTUEFRc3FBQ0FBUVFSMVFROXhKTkFCUVFNZ0FCQVlKSjBCSUFCQkIzRWtuQUVnQUVINEFYRkJBRW9rcVFFTEtnQWdBRUVFZFVFUGNTVFJBVUVESUFBUUdDU2hBU0FBUVFkeEpLQUJJQUJCK0FGeFFRQktKS29CQ3cwQUlBQkJCWFZCRDNFazBnRUxLZ0FnQUVFRWRVRVBjU1RUQVVFRElBQVFHQ1NsQVNBQVFRZHhKS1FCSUFCQitBRnhRUUJLSkt3QkN4UUFJQUFrbUFFam1RRkJDSFFqbUFGeUpKb0JDeFFBSUFBazFBRWoxUUZCQ0hRajFBRnlKTFVCQ3hRQUlBQWsxZ0VqMXdGQkNIUWoxZ0Z5SkxnQkM0UUJBUUYvSUFCQkJIVWt2QUZCQXlBQUVCZ2t2Z0VnQUVFSGNTVFlBUUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWoyQUVpQVFSQUFrQWdBVUVCYXc0SEFnTUVCUVlIQ0FBTERBZ0xRUWdrdXdFUEMwRVFKTHNCRHd0QklDUzdBUThMUVRBa3V3RVBDMEhBQUNTN0FROExRZEFBSkxzQkR3dEI0QUFrdXdFUEMwSHdBQ1M3QVFzTElBQkJCaUFBRUJna2h3RWdBRUVIY1NTWkFTT1pBVUVJZENPWUFYSWttZ0VMYWdFQmYwRUJKSWdCSTRZQlJRUkFRY0FBSklZQkN4QkxJNXdCSkpzQkk5QUJKSjRCSTVvQkpKVUJJNU1CSkpJQkk1TUJRUUJLSWdBRVFDT1dBVUVBU2lFQUN5QUFCRUJCQVNTVUFRVkJBQ1NVQVFzamxnRkJBRW9FUUJCQUN5T3BBVVVFUUVFQUpJZ0JDd3NnQUVFR0lBQVFHQ1NLQVNBQVFRZHhKTlVCSTlVQlFRaDBJOVFCY2lTMUFRc3VBRUVCSklzQkk0a0JSUVJBUWNBQUpJa0JDeEJQSTZBQkpKOEJJOUVCSktJQkk2b0JSUVJBUVFBa2l3RUxDeUFBUVFZZ0FCQVlKSTBCSUFCQkIzRWsxd0VqMXdGQkNIUWoxZ0Z5SkxnQkN5Y0FRUUVramdFampBRkZCRUJCZ0FJa2pBRUxFRkpCQUNTNUFTT3JBVVVFUUVFQUpJNEJDd3NMQUVFR0lBQVFHQ1NRQVFzNEFFRUJKSkVCSTQ4QlJRUkFRY0FBSkk4QkN4QlZKTElCSTZRQkpLTUJJOU1CSktZQlFmLy9BU1M5QVNPc0FVVUVRRUVBSkpFQkN3c1RBQ0FBUVFSMVFRZHhKRThnQUVFSGNTUlFDMElBUVFjZ0FCQVlKRlJCQmlBQUVCZ2tVMEVGSUFBUUdDUlNRUVFnQUJBWUpGRkJBeUFBRUJna1dFRUNJQUFRR0NSWFFRRWdBQkFZSkZaQkFDQUFFQmdrVlFzS0FFRUhJQUFRR0NSWkMvMENBUUYvQWtBZ0FFR20vZ05ISWdJRVFDTlpSU0VDQ3lBQ0JFQkJBQThMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQWtHUS9nTkhCRUFDUUNBQ1FaSCtBMnNPRmdNSEN3OEFCQWdNRUFJRkNRMFJBQVlLRGhJVEZCVUFDd3dWQ3lBQkVHa01GUXNnQVJCcURCUUxJQUVRYXd3VEN5QUJFR3dNRWdzZ0FSQnREQkVMSUFFUWJnd1FDeUFCRUc4TUR3c2dBUkJ3REE0TFFRRWtYaUFCRUhFTURRc2dBUkJ5REF3TElBRVFjd3dMQ3lBQkVIUU1DZ3NnQVJCMURBa0xJQUVRZGd3SUMwRUhJQUVRR0FSQUlBRVFkeEI0Q3d3SEMwRUhJQUVRR0FSQUlBRVFlUkI2Q3d3R0MwRUhJQUVRR0FSQUlBRVFleEI4Q3d3RkMwRUhJQUVRR0FSQUlBRVFmUkIrQ3d3RUN5QUJFSDlCQVNScERBTUxJQUVRZ0FGQkFTUnFEQUlMSUFFUWdRRkJCeUFCRUJoRkJFQUNRRUdRL2dNaEFnTkFJQUpCcHY0RFRnMEJJQUpCQUJBR0lBSkJBV29oQWd3QUFBc0FDd3NNQVF0QkFROExRUUVMUWdCQkJ5QUFFQmdrZFVFR0lBQVFHQ1I4UVFVZ0FCQVlKSHRCQkNBQUVCZ2tka0VESUFBUUdDUjRRUUlnQUJBWUpINUJBU0FBRUJna2ZVRUFJQUFRR0NSM0N6MEJBWDhnQUVFSWRDRUJBa0JCQUNFQUEwQWdBRUdmQVVvTkFTQUFRWUQ4QTJvZ0FTQUFhaEFERUFZZ0FFRUJhaUVBREFBQUN3QUxRWVFGSkhRTEV3QWoyd0VRQXlQY0FSQURFQ05COFA4RGNRc1hBQ1BkQVJBREk5NEJFQU1RSTBId1AzRkJnSUFDYWd1TEFRRURmeU12UlFSQUR3c2pnZ0VFZjBFSElBQVFHRVVGSTRJQkN5SUJCRUJCQUNTQ0FTUGFBUkFESVFFajJnRkJCeUFCRUI0UUJnOExFSVVCSVFFUWhnRWhBa0VISUFBUUhVRUJha0VFZENFRFFRY2dBQkFZQkVCQkFTU0NBU0FESklNQklBRWtoQUVnQWlTRkFTUGFBVUVISUFBUUhSQUdCU0FCSUFJZ0F4Q2FBU1BhQVVIL0FSQUdDd3NtQVFGL0lBQkJQM0VoQXlBQ1FRRnhCRUFnQTBGQWF5RURDeUFEUVlDUUJHb2dBVG9BQUFzWUFFRUhJQUFRR0FSQUlBRkJCeUFBUVFGcUVCNFFCZ3NMU2dFQ2Z5QUFJK0VCUmlJQ1JRUkFJQUFqNEFGR0lRSUxJQUlFUUVFR0lBQkJBV3NRQXhBZElRSWdBQ1BnQVVZRVFFRUJJUU1MSUFJZ0FTQURFSWdCSUFJZ0FFRUJheENKQVFzTEN3QkJBU1RpQVVFQ0VEWUxQQUVCZndKQUFrQUNRQUpBSUFBRVFDQUFJZ0ZCQVVZTkFTQUJRUUpHRFFJZ0FVRURSZzBEREFRTFFRa1BDMEVERHd0QkJROExRUWNQQzBFQUN5Y0JBWDhqY1JDTUFTSUNJQUFRR0NJQUJFQWdBaUFCRUJoRklRQUxJQUFFUUVFQkR3dEJBQXNhQUNOdVFRRnFKRzRqYmtIL0FVb0VRRUVCSkhKQkFDUnVDd3RtQVFKL0EwQWdBU0FBU0FSQUkyMGhBaUFCUVFScUlRRWpiVUVFYWlSdEkyMUIvLzhEU2dSQUkyMUJnSUFFYXlSdEN5TndCRUFqY2dSQUkyOGtiaENMQVVFQUpISkJBU1J6QlNOekJFQkJBQ1J6Q3dzZ0FpTnRFSTBCQkVBUWpnRUxDd3dCQ3dzTEN3QWpiQkNQQVVFQUpHd0xLUUFqYlNFQVFRQWtiVUdFL2dOQkFCQUdJM0FFZnlBQUkyMFFqUUVGSTNBTElnQUVRQkNPQVFzTEdnQWpjQVJBSTNNRVFBOExJM0lFUUVFQUpISUxDeUFBSkc0TEd3QWdBQ1J2STNBRWZ5TnpCU053Q3dSQUkyOGtia0VBSkhNTEMxZ0JBbjhqY0NFQlFRSWdBQkFZSkhBZ0FFRURjU0VDSUFGRkJFQWpjUkNNQVNFQUlBSVFqQUVoQVNOd0JFQWdBQ050RUJnaEFBVWdBQ050RUJnaUFBUkFJQUVqYlJBWUlRQUxDeUFBQkVBUWpnRUxDeUFDSkhFTEh3QWdBRUgvQVhNa3dRRkJCQ1BCQVJBWUpNSUJRUVVqd1FFUUdDVEhBUXNyQUVFQUlBQVFHQ1RqQVVFQklBQVFHQ1NBQVVFQ0lBQVFHQ1RpQVVFRUlBQVFHQ1RrQVNBQUpJRUJDeXNBUVFBZ0FCQVlKT1VCUVFFZ0FCQVlKT1lCUVFJZ0FCQVlKT2NCUVFRZ0FCQVlKT2dCSUFBazZRRUxxUVVCQVg4Q1FBSkFJQUJCZ0lBQ1NBUkFJQUFnQVJCb0RBSUxJQUJCZ0lBQ1RpSUNCRUFnQUVHQXdBSklJUUlMSUFJTkFDQUFRWURBQTA0aUFnUkFJQUJCZ1B3RFNDRUNDeUFDQkVBZ0FFR0FRR29nQVJBR0RBRUxJQUJCZ1B3RFRpSUNCRUFnQUVHZi9RTk1JUUlMSUFJRVFDTi9RUUpJRFFJTUFRc2dBRUdnL1FOT0lnSUVRQ0FBUWYvOUEwd2hBZ3NnQWcwQklBQkJrUDREVGlJQ0JFQWdBRUdtL2dOTUlRSUxJQUlFUUJCaklBQWdBUkNDQVE4TElBQkJzUDREVGlJQ0JFQWdBRUcvL2dOTUlRSUxJQUlFUUJCakN5QUFRY0QrQTA0aUFnUkFJQUJCeS80RFRDRUNDeUFDQkVBZ0FFSEEvZ05HQkVBZ0FSQ0RBUXdDQ3lBQVFjVCtBMFlFUUVFQUpFa2dBRUVBRUFZTUF3c2dBRUhGL2dOR0JFQWdBU1RaQVF3Q0N5QUFRY2IrQTBZRVFDQUJFSVFCREFJTEFrQUNRQUpBQWtBZ0FDSUNRY1ArQTBjRVFBSkFJQUpCd3Y0RGF3NEtBZ0FBQUFBQUFBQUVBd0FMREFRTElBRWtTZ3dGQ3lBQkpFc01CQXNnQVNSTURBTUxJQUVrVFF3Q0N3d0JDeUFBSTlvQlJnUkFJQUVRaHdFTUFnc2dBQ015UmlJQ1JRUkFJQUFqTUVZaEFnc2dBZ1JBSTRJQkJFQWpoQUZCZ0lBQlRpSUNCRUFqaEFGQi8vOEJUQ0VDQ3lBQ1JRUkFJNFFCUVlDZ0EwNGlBZ1JBSTRRQlFmKy9BMHdoQWdzTElBSU5Bd3NMSUFBajN3Rk9JZ0lFUUNBQUkrQUJUQ0VDQ3lBQ0JFQWdBQ0FCRUlvQkRBRUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQ1FBUUpBQWtBQ1FBSkFJQUFpQWtHRS9nTkhCRUFDUUNBQ1FZWCtBMnNPQXdJREJBQUxEQVFMSUFFUWtRRU1CZ3NnQVJDU0FRd0VDeUFCRUpNQkRBTUxJQUVRbEFFTUFnc01BUXNnQUVHQS9nTkdCRUFnQVJDVkFRc2dBRUdQL2dOR0JFQWdBUkNXQVF3QkN5QUFRZi8vQTBZRVFDQUJFSmNCREFFTFFRRVBDMEVCRHd0QkFBc1NBQ0FBSUFFUW1BRUVRQ0FBSUFFUUJnc0xaUUVEZndKQUEwQWdBeUFDVGcwQklBQWdBMm9RWnlFRklBRWdBMm9oQkFOQUlBUkIvNzhDU2dSQUlBUkJnRUJxSVFRTUFRc0xJQVFnQlJDWkFTQURRUUZxSVFNTUFBQUxBQXRCSUNFREl6TUVRRUhBQUNFREN5TjBJQU1nQWtFUWJXeHFKSFFMYlFFQmZ5T0NBVVVFUUE4TFFSQWhBQ09EQVVFUVNBUkFJNE1CSVFBTEk0UUJJNFVCSUFBUW1nRWpoQUVnQUdva2hBRWpoUUVnQUdva2hRRWpnd0VnQUdza2d3RWpnd0ZCQUV3RVFFRUFKSUlCSTlvQlFmOEJFQVlGSTlvQlFRY2pnd0ZCRUcxQkFXc1FIUkFHQ3dzTEFFRUJKT01CUVFBUU5ndlBBZ0VGZnlOMVJRUkFRUUFrU0VFQUpFbEJ4UDREUVFBUUJrRUFRUUZCd2Y0REVBTVFIUkFkSVFOQkFDUi9RY0grQXlBREVBWVBDeU4vSVFFalNTSURRWkFCVGdSQVFRRWhBZ1VqU0JBMFRnUkFRUUloQWdValNCQTFUZ1JBUVFNaEFnc0xDeUFCSUFKSEJFQkJ3ZjRERUFNaEFDQUNKSDlCQUNFQkFrQUNRQUpBQWtBQ1FDQUNJUVFnQWtVTkFBSkFJQVJCQVdzT0F3SURCQUFMREFRTFFRTkJBVUVBSUFBUUhSQWRJZ0FRR0NFQkRBTUxRUVJCQUVFQklBQVFIUkFlSWdBUUdDRUJEQUlMUVFWQkFVRUFJQUFRSFJBZUlnQVFHQ0VCREFFTFFRRkJBQ0FBRUI0UUhpRUFDeUFCQkVBUU53c2dBa1VFUUJDYkFRc2dBa0VCUmdSQUVKd0JDeVBaQVNFRUlBSkZJZ0ZGQkVBZ0FrRUJSaUVCQ3lBQkJFQWdBeUFFUmlFQkN5QUJCRUJCQmtFQ0lBQVFIaUlBRUJnRVFCQTNDd1ZCQWlBQUVCMGhBQXRCd2Y0RElBQVFCZ3NMYXdFQmZ5TjFCRUFqU0NBQWFpUklBMEFqU0JBVlRnUkFJMGdRRldza1NDTkpJZ0ZCa0FGR0JFQWpLUVJBRURFRklBRVFNQXNRTWhBekJTQUJRWkFCU0FSQUl5bEZCRUFnQVJBd0N3c0xJQUZCbVFGS0JIOUJBQVVnQVVFQmFnc2lBU1JKREFFTEN3c1FuUUVMSkFBalJ4QVdTQVJBRHdzRFFDTkhFQlpPQkVBUUZoQ2VBU05IRUJackpFY01BUXNMQzEwQUkzUkJBRW9FUUNBQUkzUnFJUUJCQUNSMEN5TStJQUJxSkQ0alFFVUVRQ01uQkVBalJ5QUFhaVJIRUo4QkJTQUFFSjRCQ3lNbUJFQWpUaUFBYWlST0JTQUFFR0lMQ3lNb0JFQWpiQ0FBYWlSc0VKQUJCU0FBRUk4QkN3c1FBRUVFRUtBQkl6MUJBV29RRkJBREN3c0FRUVFRb0FFalBSQURDeElBRUtFQlFmOEJjUkNpQVVIL0FYRVFJd3NPQUVFRUVLQUJJQUFnQVJDWkFRc3VBUUYvUVFFZ0FIUVFZQ0VDSUFGQkFFb0VRQ003SUFKeVFmOEJjU1E3QlNNN0lBSkIvd0Z6Y1NRN0N5TTdDd29BUVFVZ0FCQ2xBUm9MVFFBZ0FVRUFUZ1JBSUFCQkQzRWdBVUVQY1dvUVlFRVFjUVJBUVFFUXBnRUZRUUFRcGdFTEJTQUJRUUFnQVdzZ0FVRUFTaHRCRDNFZ0FFRVBjVXNFUUVFQkVLWUJCVUVBRUtZQkN3c0xDZ0JCQnlBQUVLVUJHZ3NLQUVFR0lBQVFwUUVhQ3dvQVFRUWdBQkNsQVJvTEV3QWdBRUVCZENBQVFmOEJjVUVIZG5JUVlBczFBUUovSUFFUVh5RUNJQUJCQVdvaEF5QUFJQUVRWUNJQkVKZ0JCRUFnQUNBQkVBWUxJQU1nQWhDWUFRUkFJQU1nQWhBR0N3c09BRUVJRUtBQklBQWdBUkNzQVF1REFRQWdBa0VCY1FSQUlBQkIvLzhEY1NJQUlBRnFJUUlnQUNBQmN5QUNjeUlDUVJCeEJFQkJBUkNtQVFWQkFCQ21BUXNnQWtHQUFuRUVRRUVCRUtvQkJVRUFFS29CQ3dVZ0FDQUJhaEFVSWdJZ0FFSC8vd054U1FSQVFRRVFxZ0VGUVFBUXFnRUxJQUFnQVhNZ0FuTkJnQ0J4RUJRRVFFRUJFS1lCQlVFQUVLWUJDd3NMQ3dCQkJCQ2dBU0FBRUdjTEV3QWdBRUgvQVhGQkFYWWdBRUVIZEhJUVlBdklCQUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN3d1VDeENqQVVILy93TnhJZ0FRWDBIL0FYRWtOU0FBRUdCQi93RnhKRFlNRUFzak5TTTJFQ01qTkJDa0FRd1NDeU0xSXpZUUkwRUJha0gvL3dOeElnQVFYMEgvQVhFa05Rd05DeU0xUVFFUXB3RWpOVUVCYWhCZ0pEVWpOUVJBUVFBUXFBRUZRUUVRcUFFTFFRQVFxUUVNRUFzak5VRi9FS2NCSXpWQkFXc1FZQ1ExSXpVRVFFRUFFS2dCQlVFQkVLZ0JDMEVCRUtrQkRBOExFS0lCUWY4QmNTUTFEQXdMSXpSQmdBRnhRWUFCUmdSQVFRRVFxZ0VGUVFBUXFnRUxJelFRcXdFa05Bd01DeENqQVVILy93TnhJendRclFFTUNRc2pPU002RUNNaUFDTTFJellRSXlJQlFmLy9BM0ZCQUJDdUFTQUFJQUZxRUJRaUFCQmZRZjhCY1NRNUlBQVFZRUgvQVhFa09rRUFFS2tCUVFnUEN5TTFJellRSXhDdkFVSC9BWEVrTkF3S0N5TTFJellRSTBFQmF4QVVJZ0FRWDBIL0FYRWtOUXdGQ3lNMlFRRVFwd0VqTmtFQmFoQmdKRFlqTmdSQVFRQVFxQUVGUVFFUXFBRUxRUUFRcVFFTUNBc2pOa0YvRUtjQkl6WkJBV3NRWUNRMkl6WUVRRUVBRUtnQkJVRUJFS2dCQzBFQkVLa0JEQWNMRUtJQlFmOEJjU1EyREFRTEl6UkJBWEZCQUVzRVFFRUJFS29CQlVFQUVLb0JDeU0wRUxBQkpEUU1CQXRCZnc4TElBQVFZRUgvQVhFa05rRUlEd3NqUFVFQ2FoQVVKRDBNQWdzalBVRUJhaEFVSkQwTUFRdEJBQkNvQVVFQUVLa0JRUUFRcGdFTFFRUUxDZ0FqTzBFRWRrRUJjUXNOQUNBQVFRRjBFTElCY2hCZ0N5Z0JBWDlCQnlBQVFSaDBRUmgxSWdFUUdBUkFRWUFDSUFCQkdIUkJHSFZyUVg5c0lRRUxJQUVMSXdFQmZ5QUFFTFFCSVFFalBTQUJRUmgwUVJoMWFoQVVKRDBqUFVFQmFoQVVKRDBMRkFBZ0FFSC9BWEZCQVhZUXNnRkJCM1J5RUdBTG1nVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJFRWNFUUFKQUlBQkJFV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl5OEVRRUVBUWMzK0F4Q3ZBVUgvQVhFaUFCQVlCRUJCemY0RFFRZEJBQ0FBRUIwaUFCQVlCSDlCQUNRelFRY2dBQkFkQlVFQkpETkJCeUFBRUI0TElnQVFwQUZCeEFBUEN3dEJBU1JBREJFTEVLTUJRZi8vQTNFaUFCQmZRZjhCY1NRM0lBQVFZRUgvQVhFa09DTTlRUUpxRUJRa1BRd1NDeU0zSXpnUUl5TTBFS1FCREJFTEl6Y2pPQkFqUVFGcUVCUWlBQkJmUWY4QmNTUTNEQTBMSXpkQkFSQ25BU00zUVFGcUVHQWtOeU0zQkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVF3UEN5TTNRWDhRcHdFak4wRUJheEJnSkRjak53UkFRUUFRcUFFRlFRRVFxQUVMUVFFUXFRRU1EZ3NRb2dGQi93RnhKRGNNQ3d0QkFDRUFJelJCZ0FGeFFZQUJSZ1JBUVFFaEFBc2pOQkN6QVNRMERBc0xFS0lCRUxVQlFRZ1BDeU01SXpvUUl5SUFJemNqT0JBaklnRkIvLzhEY1VFQUVLNEJJQUFnQVdvUUZDSUFFRjlCL3dGeEpEa2dBQkJnUWY4QmNTUTZRUUFRcVFGQkNBOExJemNqT0JBalFmLy9BM0VRcndGQi93RnhKRFFNQ1Fzak55TTRFQ05CQVdzUUZDSUFFRjlCL3dGeEpEY01CUXNqT0VFQkVLY0JJemhCQVdvUVlDUTRJemdFUUVFQUVLZ0JCVUVCRUtnQkMwRUFFS2tCREFjTEl6aEJmeENuQVNNNFFRRnJFR0FrT0NNNEJFQkJBQkNvQVFWQkFSQ29BUXRCQVJDcEFRd0dDeENpQVVIL0FYRWtPQXdEQzBFQUlRQWpORUVCY1VFQlJnUkFRUUVoQUFzak5CQzJBU1EwREFNTFFYOFBDeUFBRUdCQi93RnhKRGhCQ0E4TEl6MUJBV29RRkNROURBRUxJQUFFUUVFQkVLb0JCVUVBRUtvQkMwRUFFS2dCUVFBUXFRRkJBQkNtQVF0QkJBc0tBQ003UVFkMlFRRnhDd29BSXp0QkJYWkJBWEVMQ2dBak8wRUdka0VCY1F2MkJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVNCSEJFQUNRQ0FBUVNGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeEM0QVFSQUl6MUJBV29RRkNROUJSQ2lBUkMxQVF0QkNBOExFS01CUWYvL0EzRWlBQkJmUWY4QmNTUTVJQUFRWUVIL0FYRWtPaU05UVFKcUVCUWtQUXdRQ3lNNUl6b1FJeUlBUWYvL0EzRWpOQkNrQVNBQVFRRnFFQlFpQUJCZlFmOEJjU1E1SUFBUVlFSC9BWEVrT2d3UEN5TTVJem9RSTBFQmFoQVVJZ0FRWDBIL0FYRWtPU0FBRUdCQi93RnhKRHBCQ0E4TEl6bEJBUkNuQVNNNVFRRnFFR0FrT1NNNUJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFRd05DeU01UVg4UXB3RWpPVUVCYXhCZ0pEa2pPUVJBUVFBUXFBRUZRUUVRcUFFTFFRRVFxUUVNREFzUW9nRkIvd0Z4SkRrTUNnc1F1UUZCQUVzRVFFRUdJUUVMRUxJQlFRQkxCRUFnQVVIZ0FISWhBUXNRdWdGQkFFc0VmeU0wSUFGckVHQUZJelJCRDNGQkNVc0VRQ0FCUVFaeUlRRUxJelJCbVFGTEJFQWdBVUhnQUhJaEFRc2pOQ0FCYWhCZ0N5SUFCRUJCQUJDb0FRVkJBUkNvQVFzZ0FVSGdBSEVFUUVFQkVLb0JCVUVBRUtvQkMwRUFFS1lCSUFBa05Bd0tDeEM0QVVFQVN3UkFFS0lCRUxVQkJTTTlRUUZxRUJRa1BRdEJDQThMSXprak9oQWpJZ0VnQVVILy93TnhRUUFRcmdFZ0FVRUJkQkFVSWdFUVgwSC9BWEVrT1NBQkVHQkIvd0Z4SkRwQkFCQ3BBVUVJRHdzak9TTTZFQ01pQVVILy93TnhFSzhCUWY4QmNTUTBJQUZCQVdvUUZDSUJFRjlCL3dGeEpEa2dBUkJnUWY4QmNTUTZEQWNMSXprak9oQWpRUUZyRUJRaUFSQmZRZjhCY1NRNUlBRVFZRUgvQVhFa09rRUlEd3NqT2tFQkVLY0JJenBCQVdvUVlDUTZJem9FUUVFQUVLZ0JCVUVCRUtnQkMwRUFFS2tCREFVTEl6cEJmeENuQVNNNlFRRnJFR0FrT2lNNkJFQkJBQkNvQVFWQkFSQ29BUXRCQVJDcEFRd0VDeENpQVVIL0FYRWtPZ3dDQ3lNMFFYOXpRZjhCY1NRMFFRRVFxUUZCQVJDbUFRd0NDMEYvRHdzalBVRUJhaEFVSkQwTFFRUUw2QVFCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCTUVjRVFBSkFJQUJCTVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxFTElCQkVBalBVRUJhaEFVSkQwRkVLSUJFTFVCQzBFSUR3c1Fvd0ZCLy84RGNTUThJejFCQW1vUUZDUTlEQklMSXprak9oQWpJZ0JCLy84RGNTTTBFS1FCREJBTEl6eEJBV29RRkNROFFRZ1BDeU01SXpvUUl5SUFRZi8vQTNFUXJ3RWlBVUVCRUtjQklBRkJBV29RWUNJQkJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFRd05DeU01SXpvUUl5SUFRZi8vQTNFUXJ3RWlBVUYvRUtjQklBRkJBV3NRWUNJQkJFQkJBQkNvQVFWQkFSQ29BUXRCQVJDcEFRd01DeU01SXpvUUkwSC8vd054RUtJQlFmOEJjUkNrQVF3S0MwRUFFS2tCUVFBUXBnRkJBUkNxQVF3TUN4Q3lBVUVCUmdSQUVLSUJFTFVCQlNNOVFRRnFFQlFrUFF0QkNBOExJemtqT2hBaklnRWpQRUVBRUs0QklBRWpQR29RRkNJQUVGOUIvd0Z4SkRrZ0FCQmdRZjhCY1NRNlFRQVFxUUZCQ0E4TEl6a2pPaEFqSWdCQi8vOERjUkN2QVVIL0FYRWtOQXdJQ3lNOFFRRnJFQlFrUEVFSUR3c2pORUVCRUtjQkl6UkJBV29RWUNRMEl6UUVRRUVBRUtnQkJVRUJFS2dCQzBFQUVLa0JEQWNMSXpSQmZ4Q25BU00wUVFGckVHQWtOQ00wQkVCQkFCQ29BUVZCQVJDb0FRdEJBUkNwQVF3R0N4Q2lBVUgvQVhFa05Bd0NDMEVBRUtrQlFRQVFwZ0VRc2dGQkFFc0VRRUVBRUtvQkJVRUJFS29CQ3d3RUMwRi9Ed3NqUFVFQmFoQVVKRDBNQWdzZ0FFSC8vd054SUFFUXBBRU1BUXNnQUVFQmF4QVVJZ0FRWDBIL0FYRWtPU0FBRUdCQi93RnhKRG9MUVFRTDJRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCd0FCSEJFQWdBQ0lCUWNFQVJnMEJBa0FnQVVIQ0FHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNNRUFzak5pUTFEQThMSXpja05Rd09DeU00SkRVTURRc2pPU1ExREF3TEl6b2tOUXdMQ3lNNUl6b1FJeEN2QVVIL0FYRWtOUXdLQ3lNMEpEVU1DUXNqTlNRMkRBZ0xEQWNMSXpja05nd0dDeU00SkRZTUJRc2pPU1EyREFRTEl6b2tOZ3dEQ3lNNUl6b1FJeEN2QVVIL0FYRWtOZ3dDQ3lNMEpEWU1BUXRCZnc4TFFRUUwyUUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBQkhCRUFnQUNJQlFkRUFSZzBCQWtBZ0FVSFNBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5TUTNEQkFMSXpZa053d1BDd3dPQ3lNNEpEY01EUXNqT1NRM0RBd0xJem9rTnd3TEN5TTVJem9RSXhDdkFVSC9BWEVrTnd3S0N5TTBKRGNNQ1Fzak5TUTREQWdMSXpZa09Bd0hDeU0zSkRnTUJnc01CUXNqT1NRNERBUUxJem9rT0F3REN5TTVJem9RSXhDdkFVSC9BWEVrT0F3Q0N5TTBKRGdNQVF0QmZ3OExRUVFMMlFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUJIQkVBZ0FDSUJRZUVBUmcwQkFrQWdBVUhpQUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOU1E1REJBTEl6WWtPUXdQQ3lNM0pEa01EZ3NqT0NRNURBMExEQXdMSXpva09Rd0xDeU01SXpvUUl4Q3ZBVUgvQVhFa09Rd0tDeU0wSkRrTUNRc2pOU1E2REFnTEl6WWtPZ3dIQ3lNM0pEb01CZ3NqT0NRNkRBVUxJemtrT2d3RUN3d0RDeU01SXpvUUl4Q3ZBVUgvQVhFa09nd0NDeU0wSkRvTUFRdEJmdzhMUVFRTGlnSUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCSEJFQWdBQ0lCUWZFQVJnMEJBa0FnQVVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqT1NNNkVDTWpOUkNrQVF3UUN5TTVJem9RSXlNMkVLUUJEQThMSXprak9oQWpJemNRcEFFTURnc2pPU002RUNNak9CQ2tBUXdOQ3lNNUl6b1FJeU01RUtRQkRBd0xJemtqT2hBakl6b1FwQUVNQ3dzamdnRkZCRUJCQVNRL0N3d0tDeU01SXpvUUl5TTBFS1FCREFrTEl6VWtOQXdJQ3lNMkpEUU1Cd3NqTnlRMERBWUxJemdrTkF3RkN5TTVKRFFNQkFzak9pUTBEQU1MSXprak9oQWpFSzhCUWY4QmNTUTBEQUlMREFFTFFYOFBDMEVFQzBrQUlBRkJBRTRFUUNBQVFmOEJjU0FBSUFGcUVHQkxCRUJCQVJDcUFRVkJBQkNxQVFzRklBRkJBQ0FCYXlBQlFRQktHeUFBUWY4QmNVb0VRRUVCRUtvQkJVRUFFS29CQ3dzTE5nRUJmeU0wSUFCQi93RnhJZ0VRcHdFak5DQUJFTUVCSXpRZ0FHb1FZQ1EwSXpRRVFFRUFFS2dCQlVFQkVLZ0JDMEVBRUtrQkMya0JBWDhqTkNBQWFoQ3lBV29RWUNFQkl6UWdBSE1nQVhNUVlFRVFjUVJBUVFFUXBnRUZRUUFRcGdFTEl6UWdBRUgvQVhGcUVMSUJhaEFVUVlBQ2NVRUFTd1JBUVFFUXFnRUZRUUFRcWdFTElBRWtOQ00wQkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVF2aUFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUVlBQlJ3UkFBa0FnQVVHQkFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXpVUXdnRU1FQXNqTmhEQ0FRd1BDeU0zRU1JQkRBNExJemdRd2dFTURRc2pPUkRDQVF3TUN5TTZFTUlCREFzTEl6a2pPaEFqRUs4QkVNSUJEQW9MSXpRUXdnRU1DUXNqTlJEREFRd0lDeU0yRU1NQkRBY0xJemNRd3dFTUJnc2pPQkREQVF3RkN5TTVFTU1CREFRTEl6b1F3d0VNQXdzak9TTTZFQ01RcndFUXd3RU1BZ3NqTkJEREFRd0JDMEYvRHd0QkJBczVBUUYvSXpRZ0FFSC9BWEZCZjJ3aUFSQ25BU00wSUFFUXdRRWpOQ0FBYXhCZ0pEUWpOQVJBUVFBUXFBRUZRUUVRcUFFTFFRRVFxUUVMYVFFQmZ5TTBJQUJyRUxJQmF4QmdJUUVqTkNBQWN5QUJjMEVRY1JCZ0JFQkJBUkNtQVFWQkFCQ21BUXNqTkNBQVFmOEJjV3NRc2dGckVCUkJnQUp4UVFCTEJFQkJBUkNxQVFWQkFCQ3FBUXNnQVNRMEl6UUVRRUVBRUtnQkJVRUJFS2dCQzBFQkVLa0JDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJrQUZIQkVBQ1FDQUJRWkVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkRGQVF3UUN5TTJFTVVCREE4TEl6Y1F4UUVNRGdzak9CREZBUXdOQ3lNNUVNVUJEQXdMSXpvUXhRRU1Dd3NqT1NNNkVDTVFyd0VReFFFTUNnc2pOQkRGQVF3SkN5TTFFTVlCREFnTEl6WVF4Z0VNQndzak54REdBUXdHQ3lNNEVNWUJEQVVMSXprUXhnRU1CQXNqT2hER0FRd0RDeU01SXpvUUl4Q3ZBUkRHQVF3Q0N5TTBFTVlCREFFTFFYOFBDMEVFQ3lnQUl6UWdBSEVrTkNNMEJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFVRUJFS1lCUVFBUXFnRUxLZ0FqTkNBQWN4QmdKRFFqTkFSQVFRQVFxQUVGUVFFUXFBRUxRUUFRcVFGQkFCQ21BVUVBRUtvQkMrSUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQm9BRkhCRUFDUUNBQlFhRUJhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5SRElBUXdRQ3lNMkVNZ0JEQThMSXpjUXlBRU1EZ3NqT0JESUFRd05DeU01RU1nQkRBd0xJem9ReUFFTUN3c2pPU002RUNNUXJ3RVF5QUVNQ2dzak5CRElBUXdKQ3lNMUVNa0JEQWdMSXpZUXlRRU1Cd3NqTnhESkFRd0dDeU00RU1rQkRBVUxJemtReVFFTUJBc2pPaERKQVF3REN5TTVJem9RSXhDdkFSREpBUXdDQ3lNMEVNa0JEQUVMUVg4UEMwRUVDeXdBSXpRZ0FISkIvd0Z4SkRRak5BUkFRUUFRcUFFRlFRRVFxQUVMUVFBUXFRRkJBQkNtQVVFQUVLb0JDek1CQVg4ak5DQUFRZjhCY1VGL2JDSUJFS2NCSXpRZ0FSREJBU00wSUFGcUJFQkJBQkNvQVFWQkFSQ29BUXRCQVJDcEFRdmlBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFiQUJSd1JBQWtBZ0FVR3hBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl6VVF5d0VNRUFzak5oRExBUXdQQ3lNM0VNc0JEQTRMSXpnUXl3RU1EUXNqT1JETEFRd01DeU02RU1zQkRBc0xJemtqT2hBakVLOEJFTXNCREFvTEl6UVF5d0VNQ1Fzak5SRE1BUXdJQ3lNMkVNd0JEQWNMSXpjUXpBRU1CZ3NqT0JETUFRd0ZDeU01RU13QkRBUUxJem9RekFFTUF3c2pPU002RUNNUXJ3RVF6QUVNQWdzak5CRE1BUXdCQzBGL0R3dEJCQXRBQVFKL0FrQUNRQ0FBRUdZaUFVRi9Sd1JBREFJTElBQVFBeUVCQ3dzQ1FBSkFJQUJCQVdvaUFoQm1JZ0JCZjBjTkFTQUNFQU1oQUFzTElBQWdBUkFqQ3d3QVFRZ1FvQUVnQUJET0FRczdBQ0FBUVlBQmNVR0FBVVlFUUVFQkVLb0JCVUVBRUtvQkN5QUFFS3NCSWdBRVFFRUFFS2dCQlVFQkVLZ0JDMEVBRUtrQlFRQVFwZ0VnQUFzNUFDQUFRUUZ4UVFCTEJFQkJBUkNxQVFWQkFCQ3FBUXNnQUJDd0FTSUFCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBVUVBRUtZQklBQUxTQUVCZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFBUXN3RWhBQ0FCQkVCQkFSQ3FBUVZCQUJDcUFRc2dBQVJBUVFBUXFBRUZRUUVRcUFFTFFRQVFxUUZCQUJDbUFTQUFDMFlCQVg4Z0FFRUJjVUVCUmdSQVFRRWhBUXNnQUJDMkFTRUFJQUVFUUVFQkVLb0JCVUVBRUtvQkN5QUFCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBVUVBRUtZQklBQUxTZ0VCZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFCQkFYUVFZQ0VBSUFFRVFFRUJFS29CQlVFQUVLb0JDeUFBQkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVVFQUVLWUJJQUFMYWdFQ2Z5QUFRWUFCY1VHQUFVWUVRRUVCSVFFTElBQkJBWEZCQVVZRVFFRUJJUUlMSUFCQi93RnhRUUYyRUdBaEFDQUJCRUFnQUVHQUFYSWhBQXNnQUFSQVFRQVFxQUVGUVFFUXFBRUxRUUFRcVFGQkFCQ21BU0FDQkVCQkFSQ3FBUVZCQUJDcUFRc2dBQXMzQUNBQVFROXhRUVIwSUFCQjhBRnhRUVIyY2hCZ0lnQUVRRUVBRUtnQkJVRUJFS2dCQzBFQUVLa0JRUUFRcGdGQkFCQ3FBU0FBQzBvQkFYOGdBRUVCY1VFQlJnUkFRUUVoQVFzZ0FFSC9BWEZCQVhZUVlDSUFCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBVUVBRUtZQklBRUVRRUVCRUtvQkJVRUFFS29CQ3lBQUN5Z0FJQUZCQVNBQWRIRkIvd0Z4QkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVVFQkVLWUJJQUVMSUFBZ0FVRUFTZ1IvSUFKQkFTQUFkSElGSUFKQkFTQUFkRUYvYzNFTElnSUwyd2dCQjM5QmZ5RUdBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQ0c4aUJ5RUZJQWRGRFFBQ1FDQUZRUUZyRGdjQ0F3UUZCZ2NJQUFzTUNBc2pOU0VCREFjTEl6WWhBUXdHQ3lNM0lRRU1CUXNqT0NFQkRBUUxJemtoQVF3REN5TTZJUUVNQWdzak9TTTZFQ01RcndFaEFRd0JDeU0wSVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklRUWdCVVVOQUFKQUlBUkJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTElBQkJCMHdFUUNBQkVOQUJJUUpCQVNFREJTQUFRUTlNQkVBZ0FSRFJBU0VDUVFFaEF3c0xEQThMSUFCQkYwd0VRQ0FCRU5JQklRSkJBU0VEQlNBQVFSOU1CRUFnQVJEVEFTRUNRUUVoQXdzTERBNExJQUJCSjB3RVFDQUJFTlFCSVFKQkFTRURCU0FBUVM5TUJFQWdBUkRWQVNFQ1FRRWhBd3NMREEwTElBQkJOMHdFUUNBQkVOWUJJUUpCQVNFREJTQUFRVDlNQkVBZ0FSRFhBU0VDUVFFaEF3c0xEQXdMSUFCQnh3Qk1CRUJCQUNBQkVOZ0JJUUpCQVNFREJTQUFRYzhBVEFSQVFRRWdBUkRZQVNFQ1FRRWhBd3NMREFzTElBQkIxd0JNQkVCQkFpQUJFTmdCSVFKQkFTRURCU0FBUWQ4QVRBUkFRUU1nQVJEWUFTRUNRUUVoQXdzTERBb0xJQUJCNXdCTUJFQkJCQ0FCRU5nQklRSkJBU0VEQlNBQVFlOEFUQVJBUVFVZ0FSRFlBU0VDUVFFaEF3c0xEQWtMSUFCQjl3Qk1CRUJCQmlBQkVOZ0JJUUpCQVNFREJTQUFRZjhBVEFSQVFRY2dBUkRZQVNFQ1FRRWhBd3NMREFnTElBQkJod0ZNQkVCQkFFRUFJQUVRMlFFaEFrRUJJUU1GSUFCQmp3Rk1CRUJCQVVFQUlBRVEyUUVoQWtFQklRTUxDd3dIQ3lBQVFaY0JUQVJBUVFKQkFDQUJFTmtCSVFKQkFTRURCU0FBUVo4QlRBUkFRUU5CQUNBQkVOa0JJUUpCQVNFREN3c01CZ3NnQUVHbkFVd0VRRUVFUVFBZ0FSRFpBU0VDUVFFaEF3VWdBRUd2QVV3RVFFRUZRUUFnQVJEWkFTRUNRUUVoQXdzTERBVUxJQUJCdHdGTUJFQkJCa0VBSUFFUTJRRWhBa0VCSVFNRklBQkJ2d0ZNQkVCQkIwRUFJQUVRMlFFaEFrRUJJUU1MQ3d3RUN5QUFRY2NCVEFSQVFRQkJBU0FCRU5rQklRSkJBU0VEQlNBQVFjOEJUQVJBUVFGQkFTQUJFTmtCSVFKQkFTRURDd3NNQXdzZ0FFSFhBVXdFUUVFQ1FRRWdBUkRaQVNFQ1FRRWhBd1VnQUVIZkFVd0VRRUVEUVFFZ0FSRFpBU0VDUVFFaEF3c0xEQUlMSUFCQjV3Rk1CRUJCQkVFQklBRVEyUUVoQWtFQklRTUZJQUJCN3dGTUJFQkJCVUVCSUFFUTJRRWhBa0VCSVFNTEN3d0JDeUFBUWZjQlRBUkFRUVpCQVNBQkVOa0JJUUpCQVNFREJTQUFRZjhCVEFSQVFRZEJBU0FCRU5rQklRSkJBU0VEQ3dzTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBSElnUUVRQUpBSUFSQkFXc09Cd0lEQkFVR0J3Z0FDd3dJQ3lBQ0pEVU1Cd3NnQWlRMkRBWUxJQUlrTnd3RkN5QUNKRGdNQkFzZ0FpUTVEQU1MSUFJa09nd0NDeUFGUVFSSUlnUkZCRUFnQlVFSFNpRUVDeUFFQkVBak9TTTZFQ01nQWhDa0FRc01BUXNnQWlRMEN5QURCRUJCQkNFR0N5QUdDOUlEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRY0FCUndSQUFrQWdBVUhCQVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxFTGdCRFJJTUV3c2pQQkRQQVVILy93TnhJUUVqUEVFQ2FoQVVKRHdnQVJCZlFmOEJjU1ExSUFFUVlFSC9BWEVrTmtFRUR3c1F1QUVFUUF3VEJRd1FDd0FMREE0TEVMZ0JCRUFNRVFVTURRc0FDeU04UVFKckVCUWtQQ004SXpVak5oQWpFSzBCREEwTEVLSUJFTUlCREE4TEl6eEJBbXNRRkNROEl6d2pQUkN0QVVFQUpEME1Dd3NRdUFGQkFVY05DZ3dMQ3lNOEVNOEJRZi8vQTNFa1BTTThRUUpxRUJRa1BBd0pDeEM0QVVFQlJnUkFEQWdGREFzTEFBc1FvZ0ZCL3dGeEVOb0JJUUVqUFVFQmFoQVVKRDBnQVE4TEVMZ0JRUUZHQkVBalBFRUNheEFVSkR3alBDTTlRUUpxUWYvL0EzRVFyUUVNQmdVTUNRc0FDd3dEQ3hDaUFSRERBUXdIQ3lNOFFRSnJFQlFrUENNOEl6MFFyUUZCQ0NROURBTUxRWDhQQ3lNOFFRSnJFQlFrUENNOEl6MUJBbW9RRkJDdEFRc1Fvd0ZCLy84RGNTUTlDMEVJRHdzalBCRFBBVUgvL3dOeEpEMGpQRUVDYWhBVUpEeEJEQThMSXoxQkFtb1FGQ1E5UVF3UEN5TTlRUUZxRUJRa1BVRUVDd29BSUFCQkFYRWs2Z0VMcndNQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWRBQlJ3UkFBa0FnQVVIUkFXc09Ed0lEQUFRRkJnY0lDUW9BQ3dBTURRQUxEQTBMRUxJQkRRNE1Ed3NqUEJEUEFVSC8vd054SVFFalBFRUNhaEFVSkR3Z0FSQmZRZjhCY1NRM0lBRVFZRUgvQVhFa09FRUVEd3NRc2dFRVFBd1BCUXdNQ3dBTEVMSUJCRUFNRGdValBFRUNheEFVSkR3alBDTTlRUUpxUWYvL0EzRVFyUUVNQ3dzQUN5TThRUUpyRUJRa1BDTThJemNqT0JBakVLMEJEQW9MRUtJQkVNVUJEQXdMSXp4QkFtc1FGQ1E4SXp3alBSQ3RBVUVRSkQwTUNBc1FzZ0ZCQVVjTkJ3d0lDeU04RU04QlFmLy9BM0VrUFVFQkVOd0JJenhCQW1vUUZDUThEQVlMRUxJQlFRRkdCRUFNQlFVTUNBc0FDeEN5QVVFQlJnUkFJenhCQW1zUUZDUThJendqUFVFQ2FoQVVFSzBCREFRRkRBY0xBQXNRb2dFUXhnRU1CZ3NqUEVFQ2F4QVVKRHdqUENNOUVLMEJRUmdrUFF3Q0MwRi9Ed3NRb3dGQi8vOERjU1E5QzBFSUR3c2pQQkRQQVVILy93TnhKRDBqUEVFQ2FoQVVKRHhCREE4TEl6MUJBbW9RRkNROVFRd1BDeU05UVFGcUVCUWtQVUVFQzk0Q0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFlQUJSd1JBQWtBZ0FFSGhBV3NPRHdJREFBQUVCUVlIQ0FrQUFBQUtDd0FMREFzTEVLSUJRZjhCY1VHQS9nTnFJelFRcEFFTUN3c2pQQkRQQVVILy93TnhJUUFqUEVFQ2FoQVVKRHdnQUJCZlFmOEJjU1E1SUFBUVlFSC9BWEVrT2tFRUR3c2pOa0dBL2dOcUl6UVFwQUZCQkE4TEl6eEJBbXNRRkNROEl6d2pPU002RUNNUXJRRkJDQThMRUtJQkVNZ0JEQWNMSXp4QkFtc1FGQ1E4SXp3alBSQ3RBVUVnSkQxQkNBOExFS0lCRUxRQklRQWpQQ0FBUVJoMFFSaDFJZ0JCQVJDdUFTTThJQUJxRUJRa1BFRUFFS2dCUVFBUXFRRWpQVUVCYWhBVUpEMUJEQThMSXprak9oQWpRZi8vQTNFa1BVRUVEd3NRb3dGQi8vOERjU00wRUtRQkl6MUJBbW9RRkNROVFRUVBDeENpQVJESkFRd0NDeU04UVFKckVCUWtQQ004SXowUXJRRkJLQ1E5UVFnUEMwRi9Ed3NqUFVFQmFoQVVKRDFCQkF1TUF3QUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FVY0VRQUpBSUFCQjhRRnJEZzhDQXdRQUJRWUhDQWtLQ3dBQURBMEFDd3dOQ3hDaUFVSC9BWEZCZ1A0RGFoQ3ZBUkJnSkRRTURRc2pQQkRQQVVILy93TnhJUUFqUEVFQ2FoQVVKRHdnQUJCZlFmOEJjU1EwSUFBUVlFSC9BWEVrT3d3TkN5TTJRWUQrQTJvUXJ3RVFZQ1EwREF3TFFRQVEzQUVNQ3dzalBFRUNheEFVSkR3alBDTTBJenNRSXhDdEFVRUlEd3NRb2dFUXl3RU1DQXNqUEVFQ2F4QVVKRHdqUENNOUVLMEJRVEFrUFVFSUR3c1FvZ0VRdEFFaEFFRUFFS2dCUVFBUXFRRWpQQ0FBUVJoMFFSaDFJZ0JCQVJDdUFTTThJQUJxRUJRaUFCQmZRZjhCY1NRNUlBQVFZRUgvQVhFa09pTTlRUUZxRUJRa1BVRUlEd3NqT1NNNkVDTkIvLzhEY1NROFFRZ1BDeENqQVVILy93TnhFSzhCUWY4QmNTUTBJejFCQW1vUUZDUTlEQVVMUVFFUTNBRU1CQXNRb2dFUXpBRU1BZ3NqUEVFQ2F4QVVKRHdqUENNOUVLMEJRVGdrUFVFSUR3dEJmdzhMSXoxQkFXb1FGQ1E5QzBFRUM4Z0JBUUYvSXoxQkFXb1FGQ1E5QWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGR0RRRUNRQ0FCUVFKckRnMERCQVVHQndnSkNnc01EUTRQQUFzTUR3c2dBQkN4QVE4TElBQVF0d0VQQ3lBQUVMc0JEd3NnQUJDOEFROExJQUFRdlFFUEN5QUFFTDRCRHdzZ0FCQy9BUThMSUFBUXdBRVBDeUFBRU1RQkR3c2dBQkRIQVE4TElBQVF5Z0VQQ3lBQUVNMEJEd3NnQUJEYkFROExJQUFRM1FFUEN5QUFFTjRCRHdzZ0FCRGZBUXNNQUNPQkFTUHBBWEZCQUVvTEd3RUJmeUFCRUY4aEFpQUFJQUVRWUJBR0lBQkJBV29nQWhBR0M0TUJBUUYvUVFBUTNBRWdBRUdQL2dNUUF4QWRJZ0VrZ1FGQmovNERJQUVRQmlNOFFRSnJRZi8vQTNFa1BDTThJejBRNGdFQ1FBSkFBa0FDUUNBQUJFQUNRQ0FBUVFGckRnUUNBd0FFQUFzTUJBdEJBQ1RqQVVIQUFDUTlEQU1MUVFBa2dBRkJ5QUFrUFF3Q0MwRUFKT0lCUWRBQUpEME1BUXRCQUNUa0FVSGdBQ1E5Q3d1c0FRRUJmeVBxQVFSL0kra0JRUUJLQlNQcUFRc2lBQVJBSTRFQlFRQktJUUFMSUFBRVFFRUFJUUFqNVFFRWZ5UGpBUVVqNVFFTEJFQkJBQkRqQVVFQklRQUZJK1lCQkg4amdBRUZJK1lCQ3dSQVFRRVE0d0ZCQVNFQUJTUG5BUVIvSStJQkJTUG5BUXNFUUVFQ0VPTUJRUUVoQUFVajZBRUVmeVBrQVFVajZBRUxCRUJCQkJEakFVRUJJUUFMQ3dzTElBQUVRRUVVSVFBalB3UkFRUUFrUDBFWUlRQUxJQUFQQ3d0QkFBdUZBUUVDZjBFQkpDTkJCQ0VBSXo5RklnRUVRQ05BUlNFQkN5QUJCRUFqUFJBRFFmOEJjUkRnQVNFQUJTTS9CSDhqNmdGRkJTTS9DeUlCQkVBUTRRRWhBUXNnQVFSQVFRQWtQMEVBSkVBalBSQURRZjhCY1JEZ0FTRUFJejFCQVdzUUZDUTlDd3NqTzBId0FYRWtPeUFBUVFCTUJFQWdBQThMSUFBUTVBRnFJZ0FRb0FFZ0FBdEhBUUovQTBBZ0FFVWlBUVJBSXo0UUUwZ2hBUXNnQVFSQUVPVUJRUUJJQkVCQkFTRUFDd3dCQ3dzalBoQVRUZ1JBSXo0UUUyc2tQa0VBRHdzalBVRUJheEFVSkQxQmZ3c0VBQ05kQzNrQkFuOUJnQWdoQVNBQUJIOGdBRUVBU2dVZ0FBc0VRQ0FBSVFFTEEwQWdBa1VpQUFSQUl6NFFFMGdoQUFzZ0FBUkFFT2NCSUFGSUlRQUxJQUFFUUJEbEFVRUFTQVJBUVFFaEFnc01BUXNMSXo0UUUwNEVRQ00rRUJOckpENUJBQThMRU9jQklBRk9CRUJCQVE4TEl6MUJBV3NRRkNROVFYOExYZ0VDZndOQUlBSkZJZ0VFUUNNK0VCTklJUUVMSUFFRVFDTTlJQUJISVFFTElBRUVRQkRsQVVFQVNBUkFRUUVoQWdzTUFRc0xJejRRRTA0RVFDTStFQk5ySkQ1QkFBOExJejBnQUVZRVFFRUJEd3NqUFVFQmF4QVVKRDFCZndzT0FDQUFRWUFJYWlBQlFUSnNhZ3NaQUNBQlFRRnhCRUFnQUVFQk9nQUFCU0FBUVFBNkFBQUxDNTRCQUVFQVFRQVE2Z0VqTkRvQUFFRUJRUUFRNmdFak5Ub0FBRUVDUVFBUTZnRWpOam9BQUVFRFFRQVE2Z0VqTnpvQUFFRUVRUUFRNmdFak9Eb0FBRUVGUVFBUTZnRWpPVG9BQUVFR1FRQVE2Z0VqT2pvQUFFRUhRUUFRNmdFak96b0FBRUVJUVFBUTZnRWpQRHNCQUVFS1FRQVE2Z0VqUFRzQkFFRU1RUUFRNmdFalBqWUNBRUVSUVFBUTZnRWpQeERyQVVFU1FRQVE2Z0VqUUJEckFRc2lBRUVBUVFFUTZnRWpTRFlDQUVFRVFRRVE2Z0VqZnpvQUFFSEUvZ01qU1JBR0N4d0FRUUJCQWhEcUFTUHFBUkRyQVVFQlFRSVE2Z0VqNndFUTZ3RUxBd0FCQzI0QVFRQkJCQkRxQVNNdE93RUFRUUpCQkJEcUFTTXhPd0VBUVFSQkJCRHFBU05CRU9zQlFRVkJCQkRxQVNOQ0VPc0JRUVpCQkJEcUFTTkRFT3NCUVFkQkJCRHFBU05FRU9zQlFRaEJCQkRxQVNORkVPc0JRUWxCQkJEcUFTTkdFT3NCUVFwQkJCRHFBU011RU9zQkN6b0FRUUJCQlJEcUFTTnNOZ0lBUVFSQkJSRHFBU050TmdJQVFRaEJCUkRxQVNOeUVPc0JRUXRCQlJEcUFTTnpFT3NCUVlYK0F5TnVFQVlMSmdCQkFFRUdFT29CSTFvMkFnQkJCRUVHRU9vQkkxczZBQUJCQlVFR0VPb0JJMXc2QUFBTGhBRUFRUUJCQnhEcUFTT0lBUkRyQVVFQlFRY1E2Z0VqcUFFMkFnQkJCVUVIRU9vQkk1c0JOZ0lBUVFsQkJ4RHFBU09HQVRZQ0FFRU9RUWNRNmdFam5nRTJBZ0JCRTBFSEVPb0JJK3dCT2dBQVFSUkJCeERxQVNPekFUb0FBRUVaUVFjUTZnRWpsQUVRNndGQkdrRUhFT29CSTVJQk5nSUFRUjlCQnhEcUFTT1ZBVHNCQUF0ZEFFRUFRUWdRNmdFaml3RVE2d0ZCQVVFSUVPb0JJNjRCTmdJQVFRVkJDQkRxQVNPZkFUWUNBRUVKUVFnUTZnRWppUUUyQWdCQkRrRUlFT29CSTZJQk5nSUFRUk5CQ0JEcUFTUHRBVG9BQUVFVVFRZ1E2Z0VqdGdFNkFBQUxOZ0JCQUVFSkVPb0JJNDRCRU9zQlFRRkJDUkRxQVNPd0FUWUNBRUVGUVFrUTZnRWpqQUUyQWdCQkNVRUpFT29CSTdrQk93RUFDMUFBUVFCQkNoRHFBU09SQVJEckFVRUJRUW9RNmdFanNnRTJBZ0JCQlVFS0VPb0JJNk1CTmdJQVFRbEJDaERxQVNPUEFUWUNBRUVPUVFvUTZnRWpwZ0UyQWdCQkUwRUtFT29CSTcwQk93RUFDeWNBRU93QkVPMEJFTzRCRU84QkVQQUJFUEVCRVBJQkVQTUJFUFFCRVBVQkVQWUJRUUFrSXdzU0FDQUFMUUFBUVFCS0JFQkJBUThMUVFBTG5nRUFRUUJCQUJEcUFTMEFBQ1EwUVFGQkFCRHFBUzBBQUNRMVFRSkJBQkRxQVMwQUFDUTJRUU5CQUJEcUFTMEFBQ1EzUVFSQkFCRHFBUzBBQUNRNFFRVkJBQkRxQVMwQUFDUTVRUVpCQUJEcUFTMEFBQ1E2UVFkQkFCRHFBUzBBQUNRN1FRaEJBQkRxQVM4QkFDUThRUXBCQUJEcUFTOEJBQ1E5UVF4QkFCRHFBU2dDQUNRK1FSRkJBQkRxQVJENEFTUS9RUkpCQUJEcUFSRDRBU1JBQ3lzQVFRQkJBUkRxQVNnQ0FDUklRUVJCQVJEcUFTMEFBQ1IvUWNUK0F4QURKRWxCd1A0REVBTVFnd0VMTGdCQkFFRUNFT29CRVBnQkpPb0JRUUZCQWhEcUFSRDRBU1RyQVVILy93TVFBeENYQVVHUC9nTVFBeENXQVFzTEFFR0EvZ01RQXhDVkFRdHVBRUVBUVFRUTZnRXZBUUFrTFVFQ1FRUVE2Z0V2QVFBa01VRUVRUVFRNmdFUStBRWtRVUVGUVFRUTZnRVErQUVrUWtFR1FRUVE2Z0VRK0FFa1EwRUhRUVFRNmdFUStBRWtSRUVJUVFRUTZnRVErQUVrUlVFSlFRUVE2Z0VRK0FFa1JrRUtRUVFRNmdFUStBRWtMZ3RLQUVFQVFRVVE2Z0VvQWdBa2JFRUVRUVVRNmdFb0FnQWtiVUVJUVFVUTZnRVErQUVrY2tFTFFRVVE2Z0VRK0FFa2MwR0YvZ01RQXlSdVFZYitBeEFESkc5QmgvNERFQU1rY1FzR0FFRUFKRjBMS1FCQkFFRUdFT29CS0FJQUpGcEJCRUVHRU9vQkxRQUFKRnRCQlVFR0VPb0JMUUFBSkZ3US93RUxoQUVBUVFCQkJ4RHFBUkQ0QVNTSUFVRUJRUWNRNmdFb0FnQWtxQUZCQlVFSEVPb0JLQUlBSkpzQlFRbEJCeERxQVNnQ0FDU0dBVUVPUVFjUTZnRW9BZ0FrbmdGQkUwRUhFT29CTFFBQUpPd0JRUlJCQnhEcUFTMEFBQ1N6QVVFWlFRY1E2Z0VRK0FFa2xBRkJHa0VIRU9vQktBSUFKSklCUVI5QkJ4RHFBUzhCQUNTVkFRdGRBRUVBUVFnUTZnRVErQUVraXdGQkFVRUlFT29CS0FJQUpLNEJRUVZCQ0JEcUFTZ0NBQ1NmQVVFSlFRZ1E2Z0VvQWdBa2lRRkJEa0VJRU9vQktBSUFKS0lCUVJOQkNCRHFBUzBBQUNUdEFVRVVRUWdRNmdFdEFBQWt0Z0VMTmdCQkFFRUpFT29CRVBnQkpJNEJRUUZCQ1JEcUFTZ0NBQ1N3QVVFRlFRa1E2Z0VvQWdBa2pBRkJDVUVKRU9vQkx3RUFKTGtCQzFBQVFRQkJDaERxQVJENEFTU1JBVUVCUVFvUTZnRW9BZ0Frc2dGQkJVRUtFT29CS0FJQUpLTUJRUWxCQ2hEcUFTZ0NBQ1NQQVVFT1FRb1E2Z0VvQWdBa3BnRkJFMEVLRU9vQkx3RUFKTDBCQ3ljQUVQa0JFUG9CRVBzQkVQd0JFUDBCRVA0QkVJQUNFSUVDRUlJQ0VJTUNFSVFDUVFBa0l3c01BQ01qQkVCQkFROExRUUFMWHdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUFpQVVFQlJnMEJBa0FnQVVFQ2F3NEdBd1FGQmdjSUFBc01DQXNqd3dFUEN5UEVBUThMSThVQkR3c2p4Z0VQQ3lQSUFROExJOGtCRHdzanlnRVBDeVBMQVE4TFFRQUxpd0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFJZ0pCQVVZTkFRSkFJQUpCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJQUZCQVhFa3d3RU1Cd3NnQVVFQmNTVEVBUXdHQ3lBQlFRRnhKTVVCREFVTElBRkJBWEVreGdFTUJBc2dBVUVCY1NUSUFRd0RDeUFCUVFGeEpNa0JEQUlMSUFGQkFYRWt5Z0VNQVFzZ0FVRUJjU1RMQVFzTEN3QkJBU1RrQVVFRUVEWUxaQUVDZjBFQUpFQWdBQkNIQWtVRVFFRUJJUUVMSUFCQkFSQ0lBaUFCQkVCQkFDRUJJQUJCQTB3RVFFRUJJUUVMSThJQkJIOGdBUVVqd2dFTElnQUVRRUVCSVFJTEk4Y0JCSDhnQVVVRkk4Y0JDeUlBQkVCQkFTRUNDeUFDQkVBUWlRSUxDd3NKQUNBQVFRQVFpQUlMbWdFQUlBQkJBRW9FUUVFQUVJb0NCVUVBRUlzQ0N5QUJRUUJLQkVCQkFSQ0tBZ1ZCQVJDTEFnc2dBa0VBU2dSQVFRSVFpZ0lGUVFJUWl3SUxJQU5CQUVvRVFFRURFSW9DQlVFREVJc0NDeUFFUVFCS0JFQkJCQkNLQWdWQkJCQ0xBZ3NnQlVFQVNnUkFRUVVRaWdJRlFRVVFpd0lMSUFaQkFFb0VRRUVHRUlvQ0JVRUdFSXNDQ3lBSFFRQktCRUJCQnhDS0FnVkJCeENMQWdzTEJBQWpOQXNFQUNNMUN3UUFJellMQkFBak53c0VBQ000Q3dRQUl6a0xCQUFqT2dzRUFDTTdDd1FBSXowTEJBQWpQQXNHQUNNOUVBTUxCQUFqU1F1ZEF3RUtmMEdBa0FJaENTTjJCRUJCZ0lBQ0lRa0xRWUN3QWlFS0kzZ0VRRUdBdUFJaENnc0NRQU5BSUFSQmdBSk9EUUVDUUVFQUlRVURRQ0FGUVlBQ1RnMEJJQWtnQ2lBRVFRTjFRUVYwYWlBRlFRTjFhaUlHUVFBUUZ4QWhJUWdnQkVFSWJ5RUJRUWNnQlVFSWIyc2hCMEVBSVFJakx3Ui9JQUJCQUVvRkl5OExJZ01FUUNBR1FRRVFGeUVDQzBFR0lBSVFHQVJBUVFjZ0FXc2hBUXRCQUNFRFFRTWdBaEFZQkVCQkFTRURDeUFJSUFGQkFYUnFJZ1lnQXhBWElRaEJBQ0VCSUFjZ0JrRUJhaUFERUJjUUdBUkFRUUloQVFzZ0J5QUlFQmdFUUNBQlFRRnFJUUVMSUFSQkNIUWdCV3BCQTJ3aEJ5TXZCSDhnQUVFQVNnVWpMd3NpQXdSQVFRQWdBa0VIY1NBQlFRQVFKQ0lCRUNVaEJrRUJJQUVRSlNFRFFRSWdBUkFsSVFFZ0IwR0FtQTVxSWdJZ0Jqb0FBQ0FDUVFGcUlBTTZBQUFnQWtFQ2FpQUJPZ0FBQlNBQlFjZitBMEVBRUNZaEFnSkFRUUFoQVFOQUlBRkJBMDROQVNBSFFZQ1lEbW9nQVdvZ0Fqb0FBQ0FCUVFGcUlRRU1BQUFMQUFzTElBVkJBV29oQlF3QUFBc0FDeUFFUVFGcUlRUU1BQUFMQUFzTFJ3QUNRQUpBQWtBQ1FBSkFJKzRCUVFwckRnUUJBZ01FQUFzQUMwRUFJUW9MUVFBaEN3dEJmeUVNQ3lBQUlBRWdBaUFESUFRZ0JTQUdJQWNnQ0NBSklBb2dDeUFNRUNnTDJRRUJCbjhDUUFOQUlBSkJGMDROQVFKQVFRQWhBQU5BSUFCQkgwNE5BVUVBSVFRZ0FFRVBTZ1JBUVFFaEJBc2dBaUVCSUFKQkQwb0VRQ0FCUVE5cklRRUxJQUZCQkhRaEFTQUFRUTlLQkg4Z0FTQUFRUTlyYWdVZ0FTQUFhZ3NoQVVHQWdBSWhCU0FDUVE5S0JFQkJnSkFDSVFVTEFrQkJBQ0VEQTBBZ0EwRUlUZzBCUVFzazdnRWdBU0FGSUFSQkFFRUhJQU1nQUVFRGRDQUNRUU4wSUFOcVFmZ0JRWUNZR2tFQlFRQkJBQkNhQWhvZ0EwRUJhaUVEREFBQUN3QUxJQUJCQVdvaEFBd0FBQXNBQ3lBQ1FRRnFJUUlNQUFBTEFBc0xCQUFqYlFzRUFDTnVDd1FBSTI4TEZ3RUJmeU54SVFBamNBUkFRUUlnQUJBZUlRQUxJQUFMRkFBL0FFR0xBVWdFUUVHTEFUOEFhMEFBR2dzTEhRQUNRQUpBQWtBajdnRU9BZ0VDQUFzQUMwRUFJUUFMSUFBUW1RSUxCd0FnQUNUdUFRc0F4RjRFYm1GdFpRRzhYcU1DQUNWamIzSmxMMjFsYlc5eWVTOWlZVzVyYVc1bkwyZGxkRkp2YlVKaGJtdEJaR1J5WlhOekFTVmpiM0psTDIxbGJXOXllUzlpWVc1cmFXNW5MMmRsZEZKaGJVSmhibXRCWkdSeVpYTnpBamRqYjNKbEwyMWxiVzl5ZVM5dFpXMXZjbmxOWVhBdloyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQXlsamIzSmxMMjFsYlc5eWVTOXNiMkZrTDJWcFoyaDBRbWwwVEc5aFpFWnliMjFIUWsxbGJXOXllUVFhWTI5eVpTOWpjSFV2WTNCMUwybHVhWFJwWVd4cGVtVkRjSFVGSm1OdmNtVXZiV1Z0YjNKNUwyMWxiVzl5ZVM5cGJtbDBhV0ZzYVhwbFEyRnlkSEpwWkdkbEJpdGpiM0psTDIxbGJXOXllUzl6ZEc5eVpTOWxhV2RvZEVKcGRGTjBiM0psU1c1MGIwZENUV1Z0YjNKNUJ4MWpiM0psTDIxbGJXOXllUzlrYldFdmFXNXBkR2xoYkdsNlpVUnRZUWdwWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXBibWwwYVdGc2FYcGxSM0poY0docFkzTUpKMk52Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5cGJtbDBhV0ZzYVhwbFVHRnNaWFIwWlFvblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNXBibWwwYVdGc2FYcGxDeWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG1sdWFYUnBZV3hwZW1VTUoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVhVzVwZEdsaGJHbDZaUTBuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTkM5RGFHRnVibVZzTkM1cGJtbDBhV0ZzYVhwbERqRmpiM0psTDNOdmRXNWtMMkZqWTNWdGRXeGhkRzl5TDJsdWFYUnBZV3hwZW1WVGIzVnVaRUZqWTNWdGRXeGhkRzl5RHlCamIzSmxMM052ZFc1a0wzTnZkVzVrTDJsdWFYUnBZV3hwZW1WVGIzVnVaQkFqWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDJsdWFYUnBZV3hwZW1WVWFXMWxjbk1SRkdOdmNtVXZZMjl5WlM5cGJtbDBhV0ZzYVhwbEVoQmpiM0psTDJOdmNtVXZZMjl1Wm1sbkV5VmpiM0psTDJOd2RTOWpjSFV2UTNCMUxrMUJXRjlEV1VOTVJWTmZVRVZTWDBaU1FVMUZGQ0pqYjNKbEwzQnZjblJoWW14bEwzQnZjblJoWW14bEwzVXhObEJ2Y25SaFlteGxGVGRqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxrMUJXRjlEV1VOTVJWTmZVRVZTWDFORFFVNU1TVTVGRmpKamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMGR5WVhCb2FXTnpMbUpoZEdOb1VISnZZMlZ6YzBONVkyeGxjeGNuWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXNiMkZrUm5KdmJWWnlZVzFDWVc1ckdDRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZZMmhsWTJ0Q2FYUlBia0o1ZEdVWkoyTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012WjJWMFVtZGlVR2w0Wld4VGRHRnlkQm9tWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXpaWFJRYVhobGJFOXVSbkpoYldVYkpHTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WjJWMFVHbDRaV3hUZEdGeWRCd3FZMjl5WlM5bmNtRndhR2xqY3k5d2NtbHZjbWwwZVM5blpYUlFjbWx2Y21sMGVXWnZjbEJwZUdWc0hTRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZjbVZ6WlhSQ2FYUlBia0o1ZEdVZUgyTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXpaWFJDYVhSUGJrSjVkR1VmS21OdmNtVXZaM0poY0docFkzTXZjSEpwYjNKcGRIa3ZZV1JrVUhKcGIzSnBkSGxtYjNKUWFYaGxiQ0E2WTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGRNYVc1bFQyWlVhV3hsUm5KdmJWUnBiR1ZEWVdOb1pTRW1ZMjl5WlM5bmNtRndhR2xqY3k5MGFXeGxjeTluWlhSVWFXeGxSR0YwWVVGa1pISmxjM01pTTJOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXNiMkZrVUdGc1pYUjBaVUo1ZEdWR2NtOXRWMkZ6YlUxbGJXOXllU01qWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDJOdmJtTmhkR1Z1WVhSbFFubDBaWE1rTEdOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOW5aWFJTWjJKRGIyeHZja1p5YjIxUVlXeGxkSFJsSlM1amIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZaMlYwUTI5c2IzSkRiMjF3YjI1bGJuUkdjbTl0VW1kaUpqTmpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2WjJWMFRXOXViMk5vY205dFpVTnZiRzl5Um5KdmJWQmhiR1YwZEdVbkpXTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaMlYwVkdsc1pWQnBlR1ZzVTNSaGNuUW9MR052Y21VdlozSmhjR2hwWTNNdmRHbHNaWE12WkhKaGQxQnBlR1ZzYzBaeWIyMU1hVzVsVDJaVWFXeGxLVGRqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkMHhwYm1WUFpsUnBiR1ZHY205dFZHbHNaVWxrS2pkamIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDBOdmJHOXlVR2w0Wld4R2NtOXRWR2xzWlVsa0t6eGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQwMXZibTlqYUhKdmJXVlFhWGhsYkVaeWIyMVVhV3hsU1dRc08yTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1FtRmphMmR5YjNWdVpGZHBibVJ2ZDFOallXNXNhVzVsTFM5amIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZjbVZ1WkdWeVFtRmphMmR5YjNWdVpDNHJZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDNKbGJtUmxjbGRwYm1SdmR5OGpZMjl5WlM5bmNtRndhR2xqY3k5emNISnBkR1Z6TDNKbGJtUmxjbE53Y21sMFpYTXdKR052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlgyUnlZWGRUWTJGdWJHbHVaVEVwWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OWZjbVZ1WkdWeVJXNTBhWEpsUm5KaGJXVXlKMk52Y21VdlozSmhjR2hwWTNNdmNISnBiM0pwZEhrdlkyeGxZWEpRY21sdmNtbDBlVTFoY0RNaVkyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OXlaWE5sZEZScGJHVkRZV05vWlRRN1kyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVOU1U1ZlExbERURVZUWDFOUVVrbFVSVk5mVEVORVgwMVBSRVUxUVdOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVUVWxPWDBOWlEweEZVMTlVVWtGT1UwWkZVbDlFUVZSQlgweERSRjlOVDBSRk5peGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OWZjbVZ4ZFdWemRFbHVkR1Z5Y25Wd2REY3VZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRFeGpaRWx1ZEdWeWNuVndkRGdwWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlUYjNWdVpDNWlZWFJqYUZCeWIyTmxjM05EZVdOc1pYTTVMV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWJXRjRSbkpoYldWVFpYRjFaVzVqWlVONVkyeGxjem9wWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1MWNHUmhkR1ZNWlc1bmRHZzdLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUR1Z1WjNSb1BDbGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVeGxibWQwYUQwcFkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWTVpXNW5kR2crTEdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdloyVjBUbVYzUm5KbGNYVmxibU41Um5KdmJWTjNaV1Z3UHlsamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuTmxkRVp5WlhGMVpXNWplVUF5WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5allXeGpkV3hoZEdWVGQyVmxjRUZ1WkVOb1pXTnJUM1psY21ac2IzZEJLR052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxVM2RsWlhCQ0syTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFJXNTJaV3h2Y0dWREsyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFJXNTJaV3h2Y0dWRUsyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFJXNTJaV3h2Y0dWRkpXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmRYQmtZWFJsUm5KaGJXVlRaWEYxWlc1alpYSkdMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1ZIS21OdmNtVXZjMjkxYm1RdllXTmpkVzExYkdGMGIzSXZaR2xrUTJoaGJtNWxiRVJoWTBOb1lXNW5aVWd1WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1M2FXeHNRMmhoYm01bGJGVndaR0YwWlVrdVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTNhV3hzUTJoaGJtNWxiRlZ3WkdGMFpVb3VZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzUzYVd4c1EyaGhibTVsYkZWd1pHRjBaVXNuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1eVpYTmxkRlJwYldWeVREMWpiM0psTDNOdmRXNWtMMlIxZEhrdmFYTkVkWFI1UTNsamJHVkRiRzlqYTFCdmMybDBhWFpsVDNKT1pXZGhkR2wyWlVadmNsZGhkbVZtYjNKdFRTWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbWRsZEZOaGJYQnNaVTQyWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1blpYUlRZVzF3YkdWR2NtOXRRM2xqYkdWRGIzVnVkR1Z5VHlkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuSmxjMlYwVkdsdFpYSlFKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1WjJWMFUyRnRjR3hsVVRaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxtZGxkRk5oYlhCc1pVWnliMjFEZVdOc1pVTnZkVzUwWlhKU0oyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVjbVZ6WlhSVWFXMWxjbE1tWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1blpYUlRZVzF3YkdWVU5tTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVaMlYwVTJGdGNHeGxSbkp2YlVONVkyeGxRMjkxYm5SbGNsVTdZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVuWlhST2IybHpaVU5vWVc1dVpXeEdjbVZ4ZFdWdVkzbFFaWEpwYjJSV0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVaMlYwVTJGdGNHeGxWelpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG1kbGRGTmhiWEJzWlVaeWIyMURlV05zWlVOdmRXNTBaWEpZSEdOdmNtVXZZM0IxTDJOd2RTOURjSFV1UTB4UFEwdGZVMUJGUlVSWkttTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1YldGNFJHOTNibE5oYlhCc1pVTjVZMnhsYzFvaVkyOXlaUzl3YjNKMFlXSnNaUzl3YjNKMFlXSnNaUzlwTXpKUWIzSjBZV0pzWlZzb1kyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5blpYUlRZVzF3YkdWQmMxVnVjMmxuYm1Wa1FubDBaVndpWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzl0YVhoRGFHRnVibVZzVTJGdGNHeGxjMTB6WTI5eVpTOXpiM1Z1WkM5emIzVnVaQzl6WlhSTVpXWjBRVzVrVW1sbmFIUlBkWFJ3ZFhSR2IzSkJkV1JwYjFGMVpYVmxYaVpqYjNKbEwzTnZkVzVrTDJGalkzVnRkV3hoZEc5eUwyRmpZM1Z0ZFd4aGRHVlRiM1Z1WkY4Z1kyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzTndiR2wwU0dsbmFFSjVkR1ZnSDJOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5emNHeHBkRXh2ZDBKNWRHVmhIMk52Y21VdmMyOTFibVF2YzI5MWJtUXZZMkZzWTNWc1lYUmxVMjkxYm1SaUhHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmRYQmtZWFJsVTI5MWJtUmpJbU52Y21VdmMyOTFibVF2YzI5MWJtUXZZbUYwWTJoUWNtOWpaWE56UVhWa2FXOWtLMk52Y21VdmMyOTFibVF2Y21WbmFYTjBaWEp6TDFOdmRXNWtVbVZuYVhOMFpYSlNaV0ZrVkhKaGNITmxJV052Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzluWlhSS2IzbHdZV1JUZEdGMFpXWWtZMjl5WlM5dFpXMXZjbmt2Y21WaFpGUnlZWEJ6TDJOb1pXTnJVbVZoWkZSeVlYQnpaekpqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMMlZwWjJoMFFtbDBURzloWkVaeWIyMUhRazFsYlc5eWVWZHBkR2hVY21Gd2MyZ2hZMjl5WlM5dFpXMXZjbmt2WW1GdWEybHVaeTlvWVc1a2JHVkNZVzVyYVc1bmFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlREJxSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRYQmtZWFJsVGxKNE1Hc25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzUxY0dSaGRHVk9Vbmd4YkNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlU1U2VERnRKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TVc0blkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWT1VuZ3hieWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURKd0oyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRsSjRNbkVuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1MWNHUmhkR1ZPVW5neWNpZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMblZ3WkdGMFpVNVNlREp6SjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE0zUW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUxY0dSaGRHVk9Vbmd6ZFNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlU1U2VETjJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUbEo0TTNjblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNTFjR1JoZEdWT1VuZzBlQ1JqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5SeWFXZG5aWEo1SjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRYQmtZWFJsVGxKNE5Ib2tZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUwY21sbloyVnlleWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5Wd1pHRjBaVTVTZURSOEpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkSEpwWjJkbGNuMG5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzUxY0dSaGRHVk9VbmcwZmlSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuUnlhV2RuWlhKL0lXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTUlBQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTVlFQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTW9JQkxHTnZjbVV2YzI5MWJtUXZjbVZuYVhOMFpYSnpMMU52ZFc1a1VtVm5hWE4wWlhKWGNtbDBaVlJ5WVhCemd3RW1ZMjl5WlM5bmNtRndhR2xqY3k5c1kyUXZUR05rTG5Wd1pHRjBaVXhqWkVOdmJuUnliMnlFQVNCamIzSmxMMjFsYlc5eWVTOWtiV0V2YzNSaGNuUkViV0ZVY21GdWMyWmxjb1VCSjJOdmNtVXZiV1Z0YjNKNUwyUnRZUzluWlhSSVpHMWhVMjkxY21ObFJuSnZiVTFsYlc5eWVZWUJMR052Y21VdmJXVnRiM0o1TDJSdFlTOW5aWFJJWkcxaFJHVnpkR2x1WVhScGIyNUdjbTl0VFdWdGIzSjVod0VoWTI5eVpTOXRaVzF2Y25rdlpHMWhMM04wWVhKMFNHUnRZVlJ5WVc1elptVnlpQUV5WTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwzTjBiM0psVUdGc1pYUjBaVUo1ZEdWSmJsZGhjMjFOWlcxdmNubUpBVEJqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmFXNWpjbVZ0Wlc1MFVHRnNaWFIwWlVsdVpHVjRTV1pUWlhTS0FTOWpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2ZDNKcGRHVkRiMnh2Y2xCaGJHVjBkR1ZVYjAxbGJXOXllWXNCTUdOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JVYVcxbGNrbHVkR1Z5Y25Wd2RJd0JLbU52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlmWjJWMFZHbHRaWEpEYjNWdWRHVnlUV0Z6YTBKcGRJMEJPMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlmWTJobFkydEVhWFpwWkdWeVVtVm5hWE4wWlhKR1lXeHNhVzVuUldSblpVUmxkR1ZqZEc5eWpnRXBZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMTlwYm1OeVpXMWxiblJVYVcxbGNrTnZkVzUwWlhLUEFSOWpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZkWEJrWVhSbFZHbHRaWEp6a0FFbFkyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwySmhkR05vVUhKdlkyVnpjMVJwYldWeWM1RUJMMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXVkWEJrWVhSbFJHbDJhV1JsY2xKbFoybHpkR1Z5a2dFc1kyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1MWNHUmhkR1ZVYVcxbGNrTnZkVzUwWlhLVEFTdGpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlZScGJXVnlUVzlrZFd4dmxBRXNZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMVJwYldWeWN5NTFjR1JoZEdWVWFXMWxja052Ym5SeWIyeVZBU1pqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2U205NWNHRmtMblZ3WkdGMFpVcHZlWEJoWkpZQlBtTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXVkWEJrWVhSbFNXNTBaWEp5ZFhCMFVtVnhkV1Z6ZEdWa2x3RThZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTUxY0dSaGRHVkpiblJsY25KMWNIUkZibUZpYkdWa21BRW1ZMjl5WlM5dFpXMXZjbmt2ZDNKcGRHVlVjbUZ3Y3k5amFHVmphMWR5YVhSbFZISmhjSE9aQVRSamIzSmxMMjFsYlc5eWVTOXpkRzl5WlM5bGFXZG9kRUpwZEZOMGIzSmxTVzUwYjBkQ1RXVnRiM0o1VjJsMGFGUnlZWEJ6bWdFY1kyOXlaUzl0WlcxdmNua3ZaRzFoTDJoa2JXRlVjbUZ1YzJabGNwc0JJR052Y21VdmJXVnRiM0o1TDJSdFlTOTFjR1JoZEdWSVlteGhibXRJWkcxaG5BRXhZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRGWkNiR0Z1YTBsdWRHVnljblZ3ZEowQkhtTnZjbVV2WjNKaGNHaHBZM012YkdOa0wzTmxkRXhqWkZOMFlYUjFjNTRCSldOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZkWEJrWVhSbFIzSmhjR2hwWTNPZkFTdGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDJKaGRHTm9VSEp2WTJWemMwZHlZWEJvYVdOem9BRVVZMjl5WlM5amIzSmxMM041Ym1ORGVXTnNaWE9oQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJkbGRFUmhkR0ZDZVhSbFZIZHZvZ0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTluWlhSRVlYUmhRbmwwWlU5dVphTUJLR052Y21VdlkzQjFMMjl3WTI5a1pYTXZaMlYwUTI5dVkyRjBaVzVoZEdWa1JHRjBZVUo1ZEdXa0FTaGpiM0psTDJOd2RTOXZjR052WkdWekwyVnBaMmgwUW1sMFUzUnZjbVZUZVc1alEzbGpiR1Z6cFFFWlkyOXlaUzlqY0hVdlpteGhaM012YzJWMFJteGhaMEpwZEtZQkgyTnZjbVV2WTNCMUwyWnNZV2R6TDNObGRFaGhiR1pEWVhKeWVVWnNZV2VuQVM5amIzSmxMMk53ZFM5bWJHRm5jeTlqYUdWamEwRnVaRk5sZEVWcFoyaDBRbWwwU0dGc1prTmhjbko1Um14aFo2Z0JHbU52Y21VdlkzQjFMMlpzWVdkekwzTmxkRnBsY205R2JHRm5xUUVlWTI5eVpTOWpjSFV2Wm14aFozTXZjMlYwVTNWaWRISmhZM1JHYkdGbnFnRWJZMjl5WlM5amNIVXZabXhoWjNNdmMyVjBRMkZ5Y25sR2JHRm5xd0VoWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKdmRHRjBaVUo1ZEdWTVpXWjByQUUyWTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2YzJsNGRHVmxia0pwZEZOMGIzSmxTVzUwYjBkQ1RXVnRiM0o1VjJsMGFGUnlZWEJ6clFFcVkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5emFYaDBaV1Z1UW1sMFUzUnZjbVZUZVc1alEzbGpiR1Z6cmdFMFkyOXlaUzlqY0hVdlpteGhaM012WTJobFkydEJibVJUWlhSVGFYaDBaV1Z1UW1sMFJteGhaM05CWkdSUGRtVnlabXh2ZDY4QkoyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdlpXbG5hSFJDYVhSTWIyRmtVM2x1WTBONVkyeGxjN0FCSW1OdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5eWIzUmhkR1ZDZVhSbFVtbG5hSFN4QVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUQjRzZ0ViWTI5eVpTOWpjSFV2Wm14aFozTXZaMlYwUTJGeWNubEdiR0Zuc3dFdFkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzSnZkR0YwWlVKNWRHVk1aV1owVkdoeWIzVm5hRU5oY25KNXRBRWhZMjl5WlM5d2IzSjBZV0pzWlM5d2IzSjBZV0pzWlM5cE9GQnZjblJoWW14bHRRRWlZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKbGJHRjBhWFpsU25WdGNMWUJMbU52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl5YjNSaGRHVkNlWFJsVW1sbmFIUlVhSEp2ZFdkb1EyRnljbm0zQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pURjR1QUVhWTI5eVpTOWpjSFV2Wm14aFozTXZaMlYwV21WeWIwWnNZV2U1QVI5amIzSmxMMk53ZFM5bWJHRm5jeTluWlhSSVlXeG1RMkZ5Y25sR2JHRm51Z0VlWTI5eVpTOWpjSFV2Wm14aFozTXZaMlYwVTNWaWRISmhZM1JHYkdGbnV3RWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1V5ZUx3QkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxNM2k5QVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUUjR2Z0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVMWVMOEJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTm5qQUFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVGQ0d1FFclkyOXlaUzlqY0hVdlpteGhaM012WTJobFkydEJibVJUWlhSRmFXZG9kRUpwZEVOaGNuSjVSbXhoWjhJQkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTloWkdSQlVtVm5hWE4wWlhMREFTNWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12WVdSa1FWUm9jbTkxWjJoRFlYSnllVkpsWjJsemRHVnl4QUVmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVNGVNVUJJbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emRXSkJVbVZuYVhOMFpYTEdBUzVqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMzVmlRVlJvY205MVoyaERZWEp5ZVZKbFoybHpkR1Z5eHdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTVlTWdCSW1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWhibVJCVW1WbmFYTjBaWExKQVNKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZlRzl5UVZKbFoybHpkR1Z5eWdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkJlTXNCSVdOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXZja0ZTWldkcGMzUmxjc3dCSVdOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWpjRUZTWldkcGMzUmxjczBCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFFuak9BU3RqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMM05wZUhSbFpXNUNhWFJNYjJGa1JuSnZiVWRDVFdWdGIzSjV6d0VwWTI5eVpTOWpjSFV2YjNCamIyUmxjeTl6YVhoMFpXVnVRbWwwVEc5aFpGTjVibU5EZVdOc1pYUFFBU2hqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpNWldaMDBRRXBZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKdmRHRjBaVkpsWjJsemRHVnlVbWxuYUhUU0FUUmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSk1aV1owVkdoeWIzVm5hRU5oY25KNTB3RTFZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKdmRHRjBaVkpsWjJsemRHVnlVbWxuYUhSVWFISnZkV2RvUTJGeWNublVBU2RqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMyaHBablJNWldaMFVtVm5hWE4wWlhMVkFUSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUlNhV2RvZEVGeWFYUm9iV1YwYVdOU1pXZHBjM1JsY3RZQksyTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6ZDJGd1RtbGlZbXhsYzA5dVVtVm5hWE4wWlhMWEFTOWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUlNhV2RvZEV4dloybGpZV3hTWldkcGMzUmxjdGdCSjJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OTBaWE4wUW1sMFQyNVNaV2RwYzNSbGN0a0JKbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5elpYUkNhWFJQYmxKbFoybHpkR1Z5MmdFaFkyOXlaUzlqY0hVdlkySlBjR052WkdWekwyaGhibVJzWlVOaVQzQmpiMlJsMndFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkRlTndCS0dOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNObGRFbHVkR1Z5Y25Wd2RIUGRBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVSNDNnRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1ZGZU44QkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxSbmpnQVI1amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJWNFpXTjFkR1ZQY0dOdlpHWGhBVHBqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlKYm5SbGNuSjFjSFJ6TG1GeVpVbHVkR1Z5Y25Wd2RITlFaVzVrYVc1bjRnRXRZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZjMmw0ZEdWbGJrSnBkRk4wYjNKbFNXNTBiMGRDVFdWdGIzSjU0d0VyWTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12WDJoaGJtUnNaVWx1ZEdWeWNuVndkT1FCS21OdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDJOb1pXTnJTVzUwWlhKeWRYQjBjK1VCRldOdmNtVXZZMjl5WlM5bGVHVmpkWFJsVTNSbGNPWUJGbU52Y21VdlkyOXlaUzlsZUdWamRYUmxSbkpoYldYbkFUQmpiM0psTDNOdmRXNWtMM052ZFc1a0wyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWExvQVNOamIzSmxMMk52Y21VdlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYitrQkpXTnZjbVV2WTI5eVpTOWxlR1ZqZFhSbFJuSmhiV1ZWYm5ScGJFSnlaV0ZyY0c5cGJuVHFBU0pqYjNKbEwyTnZjbVV2WjJWMFUyRjJaVk4wWVhSbFRXVnRiM0o1VDJabWMyVjA2d0V5WTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2YzNSdmNtVkNiMjlzWldGdVJHbHlaV04wYkhsVWIxZGhjMjFOWlcxdmNubnNBUnBqYjNKbEwyTndkUzlqY0hVdlEzQjFMbk5oZG1WVGRHRjBaZTBCS1dOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVjMkYyWlZOMFlYUmw3Z0V2WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12U1c1MFpYSnlkWEIwY3k1ellYWmxVM1JoZEdYdkFTTmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZTbTk1Y0dGa0xuTmhkbVZUZEdGMFpmQUJJMk52Y21VdmJXVnRiM0o1TDIxbGJXOXllUzlOWlcxdmNua3VjMkYyWlZOMFlYUmw4UUVqWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTV6WVhabFUzUmhkR1h5QVNCamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMbk5oZG1WVGRHRjBaZk1CSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWMyRjJaVk4wWVhSbDlBRW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTV6WVhabFUzUmhkR1gxQVNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuTmhkbVZUZEdGMFpmWUJKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1YzJGMlpWTjBZWFJsOXdFVFkyOXlaUzlqYjNKbEwzTmhkbVZUZEdGMFpmZ0JNbU52Y21VdmJXVnRiM0o1TDJ4dllXUXZiRzloWkVKdmIyeGxZVzVFYVhKbFkzUnNlVVp5YjIxWFlYTnRUV1Z0YjNKNStRRWFZMjl5WlM5amNIVXZZM0IxTDBOd2RTNXNiMkZrVTNSaGRHWDZBU2xqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxteHZZV1JUZEdGMFpmc0JMMk52Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMMGx1ZEdWeWNuVndkSE11Ykc5aFpGTjBZWFJsL0FFalkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wwcHZlWEJoWkM1c2IyRmtVM1JoZEdYOUFTTmpiM0psTDIxbGJXOXllUzl0WlcxdmNua3ZUV1Z0YjNKNUxteHZZV1JUZEdGMFpmNEJJMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXViRzloWkZOMFlYUmwvd0VoWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlqYkdWaGNrRjFaR2x2UW5WbVptVnlnQUlnWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlUYjNWdVpDNXNiMkZrVTNSaGRHV0JBaVpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG14dllXUlRkR0YwWllJQ0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXViRzloWkZOMFlYUmxnd0ltWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1c2IyRmtVM1JoZEdXRUFpWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbXh2WVdSVGRHRjBaWVVDRTJOdmNtVXZZMjl5WlM5c2IyRmtVM1JoZEdXR0FoaGpiM0psTDJOdmNtVXZhR0Z6UTI5eVpWTjBZWEowWldTSEFqUmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZYMmRsZEVwdmVYQmhaRUoxZEhSdmJsTjBZWFJsUm5KdmJVSjFkSFJ2Ymtsa2lBSTBZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMMTl6WlhSS2IzbHdZV1JDZFhSMGIyNVRkR0YwWlVaeWIyMUNkWFIwYjI1SlpJa0NNV052Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMM0psY1hWbGMzUktiM2x3WVdSSmJuUmxjbkoxY0hTS0FpVmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZYM0J5WlhOelNtOTVjR0ZrUW5WMGRHOXVpd0luWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5eVpXeGxZWE5sU205NWNHRmtRblYwZEc5dWpBSWhZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMM05sZEVwdmVYQmhaRk4wWVhSbGpRSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKQmpnSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKQ2p3SWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRGtBSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRWtRSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRmtnSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKSWt3SWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKTWxBSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKR2xRSW1ZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVISnZaM0poYlVOdmRXNTBaWEtXQWlSamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJUZEdGamExQnZhVzUwWlhLWEFpNWpiM0psTDJSbFluVm5MMlJsWW5WbkxXTndkUzluWlhSUGNHTnZaR1ZCZEZCeWIyZHlZVzFEYjNWdWRHVnltQUlmWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFuY21Gd2FHbGpjeTluWlhSTVdaa0NOMk52Y21VdlpHVmlkV2N2WkdWaWRXY3RaM0poY0docFkzTXZaSEpoZDBKaFkydG5jbTkxYm1STllYQlViMWRoYzIxTlpXMXZjbm1hQWpkamIzSmxMMmR5WVhCb2FXTnpMM1JwYkdWekwyUnlZWGRRYVhobGJITkdjbTl0VEdsdVpVOW1WR2xzWlh4MGNtRnRjRzlzYVc1bG13SXlZMjl5WlM5a1pXSjFaeTlrWldKMVp5MW5jbUZ3YUdsamN5OWtjbUYzVkdsc1pVUmhkR0ZVYjFkaGMyMU5aVzF2Y25tY0FoMWpiM0psTDJSbFluVm5MMlJsWW5WbkxYUnBiV1Z5TDJkbGRFUkpWcDBDSG1OdmNtVXZaR1ZpZFdjdlpHVmlkV2N0ZEdsdFpYSXZaMlYwVkVsTlFaNENIV052Y21VdlpHVmlkV2N2WkdWaWRXY3RkR2x0WlhJdloyVjBWRTFCbndJZFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxMGFXMWxjaTluWlhSVVFVT2dBZ1Z6ZEdGeWRLRUNRbU52Y21VdlpHVmlkV2N2WkdWaWRXY3RaM0poY0docFkzTXZaSEpoZDBKaFkydG5jbTkxYm1STllYQlViMWRoYzIxTlpXMXZjbmw4ZEhKaGJYQnZiR2x1WmFJQ0NINXpaWFJoY21kakFENFFjMjkxY21ObFRXRndjR2x1WjFWU1RDeGtaVzF2TDJSbFluVm5aMlZ5TDJGemMyVjBjeTlqYjNKbExuVnVkRzkxWTJobFpDNTNZWE50TG0xaGNBPT0iKToKInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93fHwidW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmP2F3YWl0IEYoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZmhCZ0NYOS9mMzkvZjM5L2Z3QmdBQUJnQVg4QmYyQUNmMzhBWUFBQmYyQUJmd0JnQTM5L2Z3QmdCbjkvZjM5L2Z3QmdBbjkvQVg5Z0IzOS9mMzkvZjM4QmYyQUVmMzkvZndCZ0RYOS9mMzkvZjM5L2YzOS9mMzhCZjJBRGYzOS9BWDlnQjM5L2YzOS9mMzhBWUFSL2YzOS9BWDlnQ0g5L2YzOS9mMzkvQUFPbEFxTUNBZ0lDQWdFQkF3RUJBUUVCQVFFQkFRRUJBQVFDQkFRSUNBZ0tDQWdJQ0FvSkNBZ0lEQWdNREFzSkRRY0hCZ1lEQlFFQkFRUUVCUUVFQkFFQkFRRUVCUUVCQVFFQkFnSUNBZ0lDQVFnQ0JBRUNCQUVDQkFRQ0JBUUVBZ2dPQmdVQ0FnVUZBUUlFQWdJREJRVUZCUVVGQlFVRkJRVUZCUVVGQVFVQkJRRUZBUVVGQlFnRkJRUUVCUVlEQXdFQ0NBRUZBUVVGQlFVRkJRVUlBd1lCQVFFRkFRVUVCQVFEQ0FVREJRVUZBZ01EQmdJQ0FnUUNBZ1VDQWdRRUJBSUNBZ0lDQWdNRkJRSUZCUUlGQlFJRkJRSUNBZ0lDQWdJQ0FnSUNDQXdDQWdVQ0FnSUNCQU1GQkFRRUJBSUNDQU1CQVFFQkFRRUJBUUVCQVFFQ0FRRUJBUUVCQVFFQkFRRUJBUVFDQXdFRkJROEVCQVFFQkFRRUJBUUVCQVFGQ3dFRUJBUUVBUVVGQlFNQkFBQUc0d3I5QVg4QVFRQUxmd0JCZ0lDc0JBdC9BRUdMQVF0L0FFRUFDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBUUMzOEFRZi8vQXd0L0FFR0FFQXQvQUVHQWdBRUxmd0JCZ0pBQkMzOEFRWUNBQWd0L0FFR0FrQU1MZndCQmdJQUJDMzhBUVlDUUJBdC9BRUdBNkI4TGZ3QkJnSkFFQzM4QVFZQUVDMzhBUVlDZ0JBdC9BRUdBdUFFTGZ3QkJnTmdGQzM4QVFZRFlCUXQvQUVHQW1BNExmd0JCZ0lBTUMzOEFRWUNZR2d0L0FFR0FnQWtMZndCQmdKZ2pDMzhBUVlEZ0FBdC9BRUdBK0NNTGZ3QkJnSUFJQzM4QVFZRDRLd3QvQUVHQWdBZ0xmd0JCZ1BnekMzOEFRWUNJK0FNTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhQL2dNTGZ3RkJBQXQvQVVIdy9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVg4TGZ3RkJmd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZ1BjQ0MzOEJRWUNBQ0F0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFkWCtBd3QvQVVIUi9nTUxmd0ZCMHY0REMzOEJRZFArQXd0L0FVSFUvZ01MZndGQjZQNERDMzhCUWV2K0F3dC9BVUhwL2dNTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BRUdBZ0t3RUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBUUMzOEFRZi8vQXd0L0FFR0FrQVFMZndCQmdKQUVDMzhBUVlBRUMzOEFRWURZQlF0L0FFR0FtQTRMZndCQmdKZ2FDMzhBUVlENEl3dC9BRUdBK0NzTGZ3QkJnUGd6Q3dlMURsVUdiV1Z0YjNKNUFnQUdZMjl1Wm1sbkFCSU1aWGhsWTNWMFpVWnlZVzFsQU9ZQkdXVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVc4QTZBRWJaWGhsWTNWMFpVWnlZVzFsVlc1MGFXeENjbVZoYTNCdmFXNTBBT2tCQzJWNFpXTjFkR1ZUZEdWd0FPVUJDWE5oZG1WVGRHRjBaUUQzQVFsc2IyRmtVM1JoZEdVQWhRSU9hR0Z6UTI5eVpWTjBZWEowWldRQWhnSU9jMlYwU205NWNHRmtVM1JoZEdVQWpBSWZaMlYwVG5WdFltVnlUMlpUWVcxd2JHVnpTVzVCZFdScGIwSjFabVpsY2dEbkFSQmpiR1ZoY2tGMVpHbHZRblZtWm1WeUFQOEJGMWRCVTAxQ1QxbGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3QVRWMEZUVFVKUFdWOU5SVTFQVWxsZlUwbGFSUU1CRWxkQlUwMUNUMWxmVjBGVFRWOVFRVWRGVXdNQ0hrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01ER2tGVFUwVk5Ra3haVTBOU1NWQlVYMDFGVFU5U1dWOVRTVnBGQXdRV1YwRlRUVUpQV1Y5VFZFRlVSVjlNVDBOQlZFbFBUZ01GRWxkQlUwMUNUMWxmVTFSQlZFVmZVMGxhUlFNR0lFZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdjY1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVTBsYVJRTUlFbFpKUkVWUFgxSkJUVjlNVDBOQlZFbFBUZ01KRGxaSlJFVlBYMUpCVFY5VFNWcEZBd29SVjA5U1MxOVNRVTFmVEU5RFFWUkpUMDREQ3cxWFQxSkxYMUpCVFY5VFNWcEZBd3dtVDFSSVJWSmZSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RERTSlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3NFlSMUpCVUVoSlExTmZUMVZVVUZWVVgweFBRMEZVU1U5T0F3OFVSMUpCVUVoSlExTmZUMVZVVUZWVVgxTkpXa1VERUJSSFFrTmZVRUZNUlZSVVJWOU1UME5CVkVsUFRnTVJFRWRDUTE5UVFVeEZWRlJGWDFOSldrVURFaGhDUjE5UVVrbFBVa2xVV1Y5TlFWQmZURTlEUVZSSlQwNERFeFJDUjE5UVVrbFBVa2xVV1Y5TlFWQmZVMGxhUlFNVURrWlNRVTFGWDB4UFEwRlVTVTlPQXhVS1JsSkJUVVZmVTBsYVJRTVdGMEpCUTB0SFVrOVZUa1JmVFVGUVgweFBRMEZVU1U5T0F4Y1RRa0ZEUzBkU1QxVk9SRjlOUVZCZlUwbGFSUU1ZRWxSSlRFVmZSRUZVUVY5TVQwTkJWRWxQVGdNWkRsUkpURVZmUkVGVVFWOVRTVnBGQXhvU1QwRk5YMVJKVEVWVFgweFBRMEZVU1U5T0F4c09UMEZOWDFSSlRFVlRYMU5KV2tVREhCVkJWVVJKVDE5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESFJGQlZVUkpUMTlDVlVaR1JWSmZVMGxhUlFNZUZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRESHhKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVRElCWkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXlFU1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5SWhaMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBSU1aMlYwVW1WbmFYTjBaWEpCQUkwQ0RHZGxkRkpsWjJsemRHVnlRZ0NPQWd4blpYUlNaV2RwYzNSbGNrTUFqd0lNWjJWMFVtVm5hWE4wWlhKRUFKQUNER2RsZEZKbFoybHpkR1Z5UlFDUkFneG5aWFJTWldkcGMzUmxja2dBa2dJTVoyVjBVbVZuYVhOMFpYSk1BSk1DREdkbGRGSmxaMmx6ZEdWeVJnQ1VBaEZuWlhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0NWQWc5blpYUlRkR0ZqYTFCdmFXNTBaWElBbGdJWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dDWEFnVm5aWFJNV1FDWUFnaGZjMlYwWVhKbll3Q2lBaDFrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZVFDaEFoaGtjbUYzVkdsc1pVUmhkR0ZVYjFkaGMyMU5aVzF2Y25rQW13SUdaMlYwUkVsV0FKd0NCMmRsZEZSSlRVRUFuUUlHWjJWMFZFMUJBSjRDQm1kbGRGUkJRd0NmQWdaMWNHUmhkR1VBNWdFTlpXMTFiR0YwYVc5dVUzUmxjQURsQVJKblpYUkJkV1JwYjFGMVpYVmxTVzVrWlhnQTV3RVBjbVZ6WlhSQmRXUnBiMUYxWlhWbEFQOEJEbmRoYzIxTlpXMXZjbmxUYVhwbEErOEJISGRoYzIxQ2IzbEpiblJsY201aGJGTjBZWFJsVEc5allYUnBiMjREOEFFWWQyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVlRhWHBsQS9FQkhXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVXh2WTJGMGFXOXVBL0lCR1dkaGJXVkNiM2xKYm5SbGNtNWhiRTFsYlc5eWVWTnBlbVVEOHdFVGRtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnUDBBU0ptY21GdFpVbHVVSEp2WjNKbGMzTldhV1JsYjA5MWRIQjFkRXh2WTJGMGFXOXVBL2NCRzJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWTWIyTmhkR2x2YmdQMUFSZG5ZVzFsWW05NVEyOXNiM0pRWVd4bGRIUmxVMmw2WlFQMkFSVmlZV05yWjNKdmRXNWtUV0Z3VEc5allYUnBiMjREK0FFTGRHbHNaVVJoZEdGTllYQUQrUUVUYzI5MWJtUlBkWFJ3ZFhSTWIyTmhkR2x2YmdQNkFSRm5ZVzFsUW5sMFpYTk1iMk5oZEdsdmJnUDhBUlJuWVcxbFVtRnRRbUZ1YTNOTWIyTmhkR2x2YmdQN0FRZ0NvQUlLNmNjQm93SXJBUUovSXkwaEFTTXVSU0lDQkVBZ0FVVWhBZ3NnQWdSQVFRRWhBUXNnQVVFT2RDQUFRWUNBQVd0cUN3OEFJekZCRFhRZ0FFR0F3QUpyYWd1M0FRRUNmd0pBQWtBQ1FBSkFBa0FDUUFKQUlBQkJESFVpQWlFQklBSkZEUUFDUUNBQlFRRnJEZzBCQVFFQ0FnSUNBd01FQkFVR0FBc01CZ3NnQUVHQStETnFEd3NnQUJBQVFZRDRNMm9QQzBFQUlRRWpMd1JBSXpBUUEwRUJjU0VCQ3lBQVFZQ1FmbW9nQVVFTmRHb1BDeUFBRUFGQmdQZ3JhZzhMSUFCQmdKQithZzhMUVFBaEFTTXZCRUFqTWhBRFFRZHhJUUVMSUFGQkFVZ0VRRUVCSVFFTElBQWdBVUVNZEdwQmdQQjlhZzhMSUFCQmdGQnFDd2tBSUFBUUFpMEFBQXVSQVFCQkFDUXpRUUFrTkVFQUpEVkJBQ1EyUVFBa04wRUFKRGhCQUNRNVFRQWtPa0VBSkR0QkFDUThRUUFrUFVFQUpENUJBQ1EvUVFBa1FDTXZCRUJCRVNRMFFZQUJKRHRCQUNRMVFRQWtOa0gvQVNRM1FkWUFKRGhCQUNRNVFRMGtPZ1ZCQVNRMFFiQUJKRHRCQUNRMVFSTWtOa0VBSkRkQjJBRWtPRUVCSkRsQnpRQWtPZ3RCZ0FJa1BVSCsvd01rUEF1a0FRRUNmMEVBSkVGQkFTUkNRY2NDRUFNaEFVRUFKRU5CQUNSRVFRQWtSVUVBSkVaQkFDUXVJQUVFUUNBQlFRRk9JZ0FFUUNBQlFRTk1JUUFMSUFBRVFFRUJKRVFGSUFGQkJVNGlBQVJBSUFGQkJrd2hBQXNnQUFSQVFRRWtSUVVnQVVFUFRpSUFCRUFnQVVFVFRDRUFDeUFBQkVCQkFTUkdCU0FCUVJsT0lnQUVRQ0FCUVI1TUlRQUxJQUFFUUVFQkpDNExDd3NMQlVFQkpFTUxRUUVrTFVFQUpERUxDd0FnQUJBQ0lBRTZBQUFMTHdCQjBmNERRZjhCRUFaQjB2NERRZjhCRUFaQjAvNERRZjhCRUFaQjFQNERRZjhCRUFaQjFmNERRZjhCRUFZTG1BRUFRUUFrUjBFQUpFaEJBQ1JKUVFBa1NrRUFKRXRCQUNSTVFRQWtUU012QkVCQmtBRWtTVUhBL2dOQmtRRVFCa0hCL2dOQmdRRVFCa0hFL2dOQmtBRVFCa0hIL2dOQi9BRVFCZ1ZCa0FFa1NVSEEvZ05Ca1FFUUJrSEIvZ05CaFFFUUJrSEcvZ05CL3dFUUJrSEgvZ05CL0FFUUJrSEkvZ05CL3dFUUJrSEovZ05CL3dFUUJndEJ6LzREUVFBUUJrSHcvZ05CQVJBR0MwOEFJeThFUUVIby9nTkJ3QUVRQmtIcC9nTkIvd0VRQmtIcS9nTkJ3UUVRQmtIci9nTkJEUkFHQlVIby9nTkIvd0VRQmtIcC9nTkIvd0VRQmtIcS9nTkIvd0VRQmtIci9nTkIvd0VRQmdzTEx3QkJrUDREUVlBQkVBWkJrZjREUWI4QkVBWkJrdjREUWZNQkVBWkJrLzREUWNFQkVBWkJsUDREUWI4QkVBWUxMQUJCbGY0RFFmOEJFQVpCbHY0RFFUOFFCa0dYL2dOQkFCQUdRWmorQTBFQUVBWkJtZjREUWJnQkVBWUxNZ0JCbXY0RFFmOEFFQVpCbS80RFFmOEJFQVpCblA0RFFaOEJFQVpCbmY0RFFRQVFCa0dlL2dOQnVBRVFCa0VCSkY0TExRQkJuLzREUWY4QkVBWkJvUDREUWY4QkVBWkJvZjREUVFBUUJrR2kvZ05CQUJBR1FhUCtBMEcvQVJBR0N6Z0FRUThrWDBFUEpHQkJEeVJoUVE4a1lrRUFKR05CQUNSa1FRQWtaVUVBSkdaQi93QWtaMEgvQUNSb1FRRWthVUVCSkdwQkFDUnJDMmNBUVFBa1RrRUFKRTlCQUNSUVFRRWtVVUVCSkZKQkFTUlRRUUVrVkVFQkpGVkJBU1JXUVFFa1YwRUJKRmhCQVNSWlFRQWtXa0VBSkZ0QkFDUmNRUUFrWFJBS0VBc1FEQkFOUWFUK0EwSDNBQkFHUWFYK0EwSHpBUkFHUWFiK0EwSHhBUkFHRUE0TFVnQkJBQ1JzUVFBa2JVRUFKRzVCQUNSdlFRQWtjRUVBSkhGQkFDUnlRUUFrY3lNdkJFQkJoUDREUVI0UUJrR2dQU1J0QlVHRS9nTkJxd0VRQmtITTF3SWtiUXRCaC80RFFmZ0JFQVpCK0FFa2NRdkpBUUVDZjBIREFoQURJZ0ZCd0FGR0lnQkZCRUFqSlFSL0lBRkJnQUZHQlNNbEN5RUFDeUFBQkVCQkFTUXZCVUVBSkM4TEVBUVFCUkFIRUFnUUNSQVBFQkFqTHdSQVFmRCtBMEg0QVJBR1FjLytBMEgrQVJBR1FjMytBMEgrQUJBR1FZRCtBMEhQQVJBR1FZTCtBMEg4QUJBR1FZLytBMEhoQVJBR1FleitBMEgrQVJBR1FmWCtBMEdQQVJBR0JVSHcvZ05CL3dFUUJrSFAvZ05CL3dFUUJrSE4vZ05CL3dFUUJrR0EvZ05CendFUUJrR0MvZ05CL2dBUUJrR1AvZ05CNFFFUUJndEJBQ1FqQzUwQkFDQUFRUUJLQkVCQkFTUWtCVUVBSkNRTElBRkJBRW9FUUVFQkpDVUZRUUFrSlFzZ0FrRUFTZ1JBUVFFa0pnVkJBQ1FtQ3lBRFFRQktCRUJCQVNRbkJVRUFKQ2NMSUFSQkFFb0VRRUVCSkNnRlFRQWtLQXNnQlVFQVNnUkFRUUVrS1FWQkFDUXBDeUFHUVFCS0JFQkJBU1FxQlVFQUpDb0xJQWRCQUVvRVFFRUJKQ3NGUVFBa0t3c2dDRUVBU2dSQVFRRWtMQVZCQUNRc0N4QVJDeEFBSXpNRVFFR2d5UWdQQzBIUXBBUUxDUUFnQUVILy93TnhDdzRBSXpNRVFFR1FCdzhMUWNnREN3UUFFQlVMRlFBZ0FFR0FrSDVxSUFGQkFYRkJEWFJxTFFBQUN3MEFJQUZCQVNBQWRIRkJBRWNMRGdBZ0FVR2dBV3dnQUdwQkEyd0xGUUFnQUNBQkVCbEJnTmdGYWlBQ2FpQURPZ0FBQ3dzQUlBRkJvQUZzSUFCcUN4QUFJQUFnQVJBYlFZQ2dCR290QUFBTERRQWdBVUVCSUFCMFFYOXpjUXNLQUNBQlFRRWdBSFJ5Q3lzQkFYOGdBa0VEY1NFRUlBTkJBWEVFUUVFQ0lBUVFIaUVFQ3lBQUlBRVFHMEdBb0FScUlBUTZBQUFMcHdJQkEzOGdBVUVBU2lJREJFQWdBRUVJU2lFREN5QURCRUFnQmlONVJpRURDeUFEQkVBZ0FDTjZSaUVEQ3lBREJFQkJBQ0VEUVFBaEJrRUZJQVJCQVdzUUF4QVlCRUJCQVNFREMwRUZJQVFRQXhBWUJFQkJBU0VHQ3dKQVFRQWhCQU5BSUFSQkNFNE5BU0FESUFaSEJFQkJCeUFFYXlFRUN5QUFJQVJxUWFBQlRBUkFJQUJCQ0NBRWEyc2hDQ0FBSUFScUlBRVFHVUdBMkFWcUlRa0NRRUVBSVFVRFFDQUZRUU5PRFFFZ0FDQUVhaUFCSUFVZ0NTQUZhaTBBQUJBYUlBVkJBV29oQlF3QUFBc0FDeUFBSUFScUlBRkJBaUFJSUFFUUhDSUZFQjFCQWlBRkVCZ1FIeUFIUVFGcUlRY0xJQVJCQVdvaEJBd0FBQXNBQ3dVZ0JpUjVDeUFBSTNwT0JFQWdBRUVJYWlSNklBQWdBa0VJYnlJR1NBUkFJM29nQm1va2Vnc0xJQWNMT0FFQmZ5QUFRWUNRQWtZRVFDQUJRWUFCYWlFQ1FRY2dBUkFZQkVBZ0FVR0FBV3NoQWdzZ0FDQUNRUVIwYWc4TElBQWdBVUVFZEdvTEpBRUJmeUFBUVQ5eElRSWdBVUVCY1FSQUlBSkJRR3NoQWdzZ0FrR0FrQVJxTFFBQUN4SUFJQUJCL3dGeFFRaDBJQUZCL3dGeGNnc2dBUUYvSUFCQkEzUWdBVUVCZEdvaUEwRUJhaUFDRUNJZ0F5QUNFQ0lRSXdzVkFDQUJRUjhnQUVFRmJDSUFkSEVnQUhWQkEzUUxXUUFnQWtFQmNVVUVRQ0FCRUFNZ0FFRUJkSFZCQTNFaEFBdEI4Z0VoQVFKQUFrQUNRQUpBQWtBZ0FFVU5CQUpBSUFCQkFXc09Bd0lEQkFBTERBUUFDd0FMUWFBQklRRU1BZ3RCMkFBaEFRd0JDMEVJSVFFTElBRUxEUUFnQVNBQ2JDQUFha0VEYkF1ckFnRUdmeUFCSUFBUUlTQUZRUUYwYWlJQUlBSVFGeUVSSUFCQkFXb2dBaEFYSVJJQ1FDQURJUUFEUUNBQUlBUktEUUVnQmlBQUlBTnJhaUlPSUFoSUJFQWdBQ0VCSUF4QkFFZ2lBa1VFUUVFRklBd1FHRVVoQWdzZ0FnUkFRUWNnQVdzaEFRdEJBQ0VDSUFFZ0VoQVlCRUJCQWlFQ0N5QUJJQkVRR0FSQUlBSkJBV29oQWdzZ0RFRUFUZ1IvUVFBZ0RFRUhjU0FDUVFBUUpDSUZFQ1VoRDBFQklBVVFKU0VCUVFJZ0JSQWxCU0FMUVFCTUJFQkJ4LzRESVFzTElBSWdDeUFLRUNZaUJTRVBJQVVpQVFzaEJTQUpJQTRnQnlBSUVDZHFJaEFnRHpvQUFDQVFRUUZxSUFFNkFBQWdFRUVDYWlBRk9nQUFRUUFoQVNBTVFRQk9CRUJCQnlBTUVCZ2hBUXNnRGlBSElBSWdBUkFmSUExQkFXb2hEUXNnQUVFQmFpRUFEQUFBQ3dBTElBMExoUUVCQTM4Z0EwRUlieUVESUFCRkJFQWdBaUFDUVFodFFRTjBheUVIQzBFSElRZ2dBRUVJYWtHZ0FVb0VRRUdnQVNBQWF5RUlDMEYvSVFJakx3UkFRUU1nQkVFQkVCY2lBa0gvQVhFUUdBUkFRUUVoQ1F0QkJpQUNFQmdFUUVFSElBTnJJUU1MQ3lBR0lBVWdDU0FISUFnZ0F5QUFJQUZCb0FGQmdOZ0ZRUUJCQUNBQ0VDZ0wzUUVBSUFVZ0JoQWhJUVlnQkVFQkVCY2hCQ0FEUVFodklRTkJCaUFFRUJnRVFFRUhJQU5ySVFNTFFRQWhCVUVESUFRUUdBUkFRUUVoQlFzZ0JpQURRUUYwYWlJRElBVVFGeUVHSUFOQkFXb2dCUkFYSVFVZ0FrRUlieUVEUVFVZ0JCQVlSUVJBUVFjZ0Eyc2hBd3RCQUNFQ0lBTWdCUkFZQkVCQkFpRUNDeUFESUFZUUdBUkFJQUpCQVdvaEFndEJBQ0FFUVFkeElBSkJBQkFrSWdNUUpTRUZRUUVnQXhBbElRWkJBaUFERUNVaEF5QUFJQUZCQUNBRkVCb2dBQ0FCUVFFZ0JoQWFJQUFnQVVFQ0lBTVFHaUFBSUFFZ0FrRUhJQVFRR0JBZkMzOEFJQVFnQlJBaElBTkJDRzlCQVhScUlnUkJBQkFYSVFWQkFDRURJQVJCQVdwQkFCQVhJUVJCQnlBQ1FRaHZheUlDSUFRUUdBUkFRUUloQXdzZ0FpQUZFQmdFUUNBRFFRRnFJUU1MSUFBZ0FVRUFJQU5CeC80RFFRQVFKaUlDRUJvZ0FDQUJRUUVnQWhBYUlBQWdBVUVDSUFJUUdpQUFJQUVnQTBFQUVCOEwzQUVCQm44Z0EwRURkU0VMQWtBRFFDQUVRYUFCVGcwQklBUWdCV29pQmtHQUFrNEVRQ0FHUVlBQ2F5RUdDeUFDSUF0QkJYUnFJQVpCQTNWcUlnbEJBQkFYSVFkQkFDRUtJeXdFUUNBRUlBQWdCaUFESUFrZ0FTQUhFQ0FpQ0VFQVNnUkFJQVFnQ0VFQmEyb2hCRUVCSVFvTEN5TXJCSDhnQ2tVRkl5c0xJZ2dFUUNBRUlBQWdCaUFESUFrZ0FTQUhFQ2tpQ0VFQVNnUkFJQVFnQ0VFQmEyb2hCQXNGSUFwRkJFQWpMd1JBSUFRZ0FDQUdJQU1nQ1NBQklBY1FLZ1VnQkNBQUlBWWdBeUFCSUFjUUt3c0xDeUFFUVFGcUlRUU1BQUFMQUFzTExBRUNmeU5LSVFRZ0FDTkxhaUlEUVlBQ1RnUkFJQU5CZ0FKcklRTUxJQUFnQVNBQ0lBTkJBQ0FFRUN3TE1BRURmeU5NSVFNZ0FDTk5JZ1JJQkVBUEN5QURRUWRySWdOQmYyd2hCU0FBSUFFZ0FpQUFJQVJySUFNZ0JSQXNDNFVGQVJCL0FrQkJKeUVKQTBBZ0NVRUFTQTBCSUFsQkFuUWlBMEdBL0FOcUVBTWhBaUFEUVlIOEEyb1FBeUVMSUFOQmd2d0RhaEFESVFRZ0FrRVFheUVDSUF0QkNHc2hDMEVJSVFVZ0FVRUJjUVJBUVJBaEJTQUVRUUp2UVFGR0JFQWdCRUVCYXlFRUN3c2dBQ0FDVGlJR0JFQWdBQ0FDSUFWcVNDRUdDeUFHQkVCQkJ5QURRWVA4QTJvUUF5SUdFQmdoREVFR0lBWVFHQ0VEUVFVZ0JoQVlJUThnQUNBQ2F5RUNJQU1FUUNBQ0lBVnJRWDlzUVFGcklRSUxRWUNBQWlBRUVDRWdBa0VCZEdvaEJFRUFJUUlqTHdSL1FRTWdCaEFZQlNNdkN5SURCRUJCQVNFQ0N5QUVJQUlRRnlFUUlBUkJBV29nQWhBWElSRUNRRUVISVFVRFFDQUZRUUJJRFFFZ0JTRUNJQThFUUNBQ1FRZHJRWDlzSVFJTFFRQWhDQ0FDSUJFUUdBUkFRUUloQ0FzZ0FpQVFFQmdFUUNBSVFRRnFJUWdMSUFnRVFDQUxRUWNnQld0cUlnZEJBRTRpQWdSQUlBZEJvQUZNSVFJTElBSUVRRUVBSVFKQkFDRU5RUUFoRGlNdkJIOGpkMFVGSXk4TElnUUVRRUVCSVFJTElBSkZCRUFnQnlBQUVCd2lDa0VEY1NFRElBd0VmeUFEUVFCS0JTQU1DeUlFQkVCQkFTRU5CU012Qkg5QkFpQUtFQmdGSXk4TElnUUVRQ0FEUVFCS0lRUUxJQVFFUUVFQklRNExDd3NnQWtVRVFDQU5SU0lEQkg4Z0RrVUZJQU1MSVFJTElBSUVRQ012QkVCQkFDQUdRUWR4SUFoQkFSQWtJZ01RSlNFRVFRRWdBeEFsSVFKQkFpQURFQ1VoQXlBSElBQkJBQ0FFRUJvZ0J5QUFRUUVnQWhBYUlBY2dBRUVDSUFNUUdnVkJ5UDRESVFOQkJDQUdFQmdFUUVISi9nTWhBd3NnQnlBQVFRQWdDQ0FEUVFBUUppSUtFQm9nQnlBQVFRRWdDaEFhSUFjZ0FFRUNJQW9RR2dzTEN3c2dCVUVCYXlFRkRBQUFDd0FMQ3lBSlFRRnJJUWtNQUFBTEFBc0xaZ0VDZjBHQWtBSWhBaU4yQkVCQmdJQUNJUUlMSXk4RWZ5TXZCU04zQ3lJQkJFQkJnTEFDSVFFamVBUkFRWUM0QWlFQkN5QUFJQUlnQVJBdEN5TjdCRUJCZ0xBQ0lRRWpmQVJBUVlDNEFpRUJDeUFBSUFJZ0FSQXVDeU45QkVBZ0FDTitFQzhMQ3lVQkFYOENRQU5BSUFCQmtBRkxEUUVnQUVIL0FYRVFNQ0FBUVFGcUlRQU1BQUFMQUFzTFNnRUNmd0pBQTBBZ0FFR1FBVTROQVFKQVFRQWhBUU5BSUFGQm9BRk9EUUVnQVNBQUVCdEJnS0FFYWtFQU9nQUFJQUZCQVdvaEFRd0FBQXNBQ3lBQVFRRnFJUUFNQUFBTEFBc0xDZ0JCZnlSNVFYOGtlZ3NPQUNNekJFQkI4QVVQQzBINEFnc09BQ016QkVCQjhnTVBDMEg1QVFzYkFRRi9JQUJCai80REVBTVFIaUlCSklFQlFZLytBeUFCRUFZTEN3QkJBU1NBQVVFQkVEWUxEZ0FqTXdSQVFhNEJEd3RCMXdBTEVBQWpNd1JBUVlDQUFROExRWURBQUFzdUFRRi9JNFlCUVFCS0lnQUVRQ09IQVNFQUN5QUFCRUFqaGdGQkFXc2toZ0VMSTRZQlJRUkFRUUFraUFFTEN5NEJBWDhqaVFGQkFFb2lBQVJBSTRvQklRQUxJQUFFUUNPSkFVRUJheVNKQVFzamlRRkZCRUJCQUNTTEFRc0xMZ0VCZnlPTUFVRUFTaUlBQkVBampRRWhBQXNnQUFSQUk0d0JRUUZySkl3QkN5T01BVVVFUUVFQUpJNEJDd3N1QVFGL0k0OEJRUUJLSWdBRVFDT1FBU0VBQ3lBQUJFQWpqd0ZCQVdza2p3RUxJNDhCUlFSQVFRQWtrUUVMQ3lJQkFYOGpsUUVqbGdGMUlRQWpsd0VFZnlPVkFTQUFhd1VqbFFFZ0FHb0xJZ0FMUlFFQ2YwR1UvZ01RQTBINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBR1FaVCtBeUFCSUFCQkNIVWlBSElRQmlBQ0pKZ0JJQUFrbVFFam1RRkJDSFFqbUFGeUpKb0JDemtCQW44UVBpSUFRZjhQVENJQkJFQWpsZ0ZCQUVvaEFRc2dBUVJBSUFBa2xRRWdBQkEvRUQ0aEFBc2dBRUgvRDBvRVFFRUFKSWdCQ3dzdkFDT1NBVUVCYXlTU0FTT1NBVUVBVEFSQUk1TUJKSklCSTVRQkJIOGprd0ZCQUVvRkk1UUJDd1JBRUVBTEN3dGdBUUYvSTVzQlFRRnJKSnNCSTVzQlFRQk1CRUFqbkFFa213RWptd0VFUUNPZEFRUi9JNTRCUVE5SUJTT2RBUXNpQUFSQUk1NEJRUUZxSko0QkJTT2RBVVVpQUFSQUk1NEJRUUJLSVFBTElBQUVRQ09lQVVFQmF5U2VBUXNMQ3dzTFlBRUJmeU9mQVVFQmF5U2ZBU09mQVVFQVRBUkFJNkFCSko4Qkk1OEJCRUFqb1FFRWZ5T2lBVUVQU0FVam9RRUxJZ0FFUUNPaUFVRUJhaVNpQVFVam9RRkZJZ0FFUUNPaUFVRUFTaUVBQ3lBQUJFQWpvZ0ZCQVdza29nRUxDd3NMQzJBQkFYOGpvd0ZCQVdza293RWpvd0ZCQUV3RVFDT2tBU1NqQVNPakFRUkFJNlVCQkg4anBnRkJEMGdGSTZVQkN5SUFCRUFqcGdGQkFXb2twZ0VGSTZVQlJTSUFCRUFqcGdGQkFFb2hBQXNnQUFSQUk2WUJRUUZySktZQkN3c0xDd3VOQVFFQmZ5TmFJQUJxSkZvaldoQTVUZ1JBSTFvUU9Xc2tXZ0pBQWtBQ1FBSkFBa0FqWENJQkJFQUNRQ0FCUVFKckRnWUNBQU1BQkFVQUN3d0ZDeEE2RURzUVBCQTlEQVFMRURvUU94QThFRDBRUVF3REN4QTZFRHNRUEJBOURBSUxFRG9RT3hBOEVEMFFRUXdCQ3hCQ0VFTVFSQXNqWEVFQmFpUmNJMXhCQ0U0RVFFRUFKRndMUVFFUEMwRUFDeDBBSTZjQklBQnFKS2NCSTZnQkk2Y0JhMEVBU2dSQVFRQVBDMEVCQzRNQkFRRi9Ba0FDUUFKQUFrQWdBRUVCUndSQUlBQWlBVUVDUmcwQklBRkJBMFlOQWlBQlFRUkdEUU1NQkFzall5T3BBVWNFUUNPcEFTUmpRUUVQQzBFQUR3c2paQ09xQVVjRVFDT3FBU1JrUVFFUEMwRUFEd3NqWlNPckFVY0VRQ09yQVNSbFFRRVBDMEVBRHdzalppT3NBVWNFUUNPc0FTUm1RUUVQQzBFQUR3dEJBQXNkQUNPdEFTQUFhaVN0QVNPdUFTT3RBV3RCQUVvRVFFRUFEd3RCQVFzcEFDT3ZBU0FBYWlTdkFTT3dBU092QVd0QkFFb2lBQVJBSTE1RklRQUxJQUFFUUVFQUR3dEJBUXNkQUNPeEFTQUFhaVN4QVNPeUFTT3hBV3RCQUVvRVFFRUFEd3RCQVFzZEFFR0FFQ09hQVd0QkFuUWtxQUVqTXdSQUk2Z0JRUUYwSktnQkN3dEZBUUYvQWtBQ1FBSkFJQUJCQVVjRVFDQUFJZ0pCQWtZTkFTQUNRUU5HRFFJTUF3c2dBVUdCQVJBWUR3c2dBVUdIQVJBWUR3c2dBVUgrQUJBWUR3c2dBVUVCRUJnTGZ3RUJmeU9vQVNBQWF5U29BU09vQVVFQVRBUkFJNmdCSVFBUVN5T29BU0FBUVFBZ0FHc2dBRUVBU2h0ckpLZ0JJN01CUVFGcUpMTUJJN01CUVFoT0JFQkJBQ1N6QVFzTEk0Z0JCSDhqcVFFRkk0Z0JDeUlBQkg4am5nRUZRUThQQ3lFQVFRRWhBU08wQVNPekFSQk1SUVJBUVg4aEFRc2dBU0FBYkVFUGFnc1NBUUYvSTZjQklRQkJBQ1NuQVNBQUVFMExIUUJCZ0JBanRRRnJRUUowSks0Qkl6TUVRQ091QVVFQmRDU3VBUXNMZndFQmZ5T3VBU0FBYXlTdUFTT3VBVUVBVEFSQUk2NEJJUUFRVHlPdUFTQUFRUUFnQUdzZ0FFRUFTaHRySks0Qkk3WUJRUUZxSkxZQkk3WUJRUWhPQkVCQkFDUzJBUXNMSTRzQkJIOGpxZ0VGSTRzQkN5SUFCSDhqb2dFRlFROFBDeUVBUVFFaEFTTzNBU08yQVJCTVJRUkFRWDhoQVFzZ0FTQUFiRUVQYWdzU0FRRi9JNjBCSVFCQkFDU3RBU0FBRUZBTEhRQkJnQkFqdUFGclFRRjBKTEFCSXpNRVFDT3dBVUVCZENTd0FRc0xoZ0lCQW44anNBRWdBR3Nrc0FFanNBRkJBRXdFUUNPd0FTRUNFRklqc0FFZ0FrRUFJQUpySUFKQkFFb2JheVN3QVNPNUFVRUJhaVM1QVNPNUFVRWdUZ1JBUVFBa3VRRUxDMEVBSVFJanVnRWhBQ09PQVFSL0k2c0JCU09PQVFzaUFRUkFJMTRFUUVHYy9nTVFBMEVGZFVFUGNTSUFKTG9CUVFBa1hnc0ZRUThQQ3lPNUFVRUNiVUd3L2dOcUVBTWhBU081QVVFQ2J3Ui9JQUZCRDNFRklBRkJCSFZCRDNFTElRRUNRQUpBQWtBQ1FDQUFCRUFnQUVFQlJnMEJJQUJCQWtZTkFnd0RDeUFCUVFSMUlRRU1Bd3RCQVNFQ0RBSUxJQUZCQVhVaEFVRUNJUUlNQVFzZ0FVRUNkU0VCUVFRaEFnc2dBa0VBU2dSL0lBRWdBbTBGUVFBTElnRkJEMm9MRWdFQmZ5T3ZBU0VBUVFBa3J3RWdBQkJUQ3hzQkFYOGp1d0VqdkFGMElRQWpNd1JBSUFCQkFYUWhBQXNnQUF1dkFRRUJmeU95QVNBQWF5U3lBU095QVVFQVRBUkFJN0lCSVFBUVZTU3lBU095QVNBQVFRQWdBR3NnQUVFQVNodHJKTElCSTcwQlFRRnhJUUVqdlFGQkFYVkJBWEVoQUNPOUFVRUJkU1M5QVNPOUFTQUJJQUJ6SWdGQkRuUnlKTDBCSTc0QkJFQWp2UUZCdjM5eEpMMEJJNzBCSUFGQkJuUnlKTDBCQ3dzamtRRUVmeU9zQVFVamtRRUxJZ0FFZnlPbUFRVkJEdzhMSVFGQkFDTzlBUkFZQkg5QmZ3VkJBUXNpQUNBQmJFRVBhZ3NTQVFGL0k3RUJJUUJCQUNTeEFTQUFFRllMRWdBak13UkFRWUNBZ0FRUEMwR0FnSUFDQ3dRQUVGZ0xCQUFnQUFzeUFDQUFRVHhHQkVCQi93QVBDeUFBUVR4clFhQ05CbXdnQVd4QkNHMUJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMFFXZ3U0QVFFQmYwRUFKR2tqVVFSL0lBQUZRUThMSVFRalVnUi9JQVFnQVdvRklBUkJEMm9MSVFRalV3Ui9JQVFnQW1vRklBUkJEMm9MSVFRalZBUi9JQVFnQTJvRklBUkJEMm9MSVFRalZRUi9JQUFGUVE4TElRQWpWZ1IvSUFBZ0FXb0ZJQUJCRDJvTElRQWpWd1IvSUFBZ0Ftb0ZJQUJCRDJvTElRQWpXQVIvSUFBZ0Eyb0ZJQUJCRDJvTElRQkJBQ1JxUVFBa2F5QUVJMDlCQVdvUVd5RUJJQUFqVUVFQmFoQmJJUUFnQVNSbklBQWthQ0FCSUFBUUl3c2xBUUYvSUFKQkFYUkJnUGdqYWlJRElBQkJBV282QUFBZ0EwRUJhaUFCUVFGcU9nQUFDNUFDQVFSL0lBQVFSaUlCUlFSQVFRRVFSeUVCQ3lBQUVFZ2lBa1VFUUVFQ0VFY2hBZ3NnQUJCSklnTkZCRUJCQXhCSElRTUxJQUFRU2lJRVJRUkFRUVFRUnlFRUN5QUJRUUZ4QkVBUVRpUmZDeUFDUVFGeEJFQVFVU1JnQ3lBRFFRRnhCRUFRVkNSaEN5QUVRUUZ4QkVBUVZ5UmlDeUFCUVFGeFJRUkFJQUloQVFzZ0FVRUJjVVVFUUNBRElRRUxJQUZCQVhGRkJFQWdCQ0VCQ3lBQlFRRnhCRUJCQVNSckN5TmJJQUFqdndGc2FpUmJJMXNRV1U0RVFDTmJFRmxySkZzamF3Ui9JMnNGSTJrTElnRkZCRUFqYWlFQkN5QUJCRUFqWHlOZ0kyRWpZaEJjR2dzalowRUJhaU5vUVFGcUkxMFFYU05kUVFGcUpGMGpYU1BBQVVFQ2JVRUJhMDRFUUNOZFFRRnJKRjBMQ3dzTUFDQUFRWUQrQTNGQkNIVUxDQUFnQUVIL0FYRUxmd0VFZnlBQUVFMGhBU0FBRUZBaEFpQUFFRk1oQXlBQUVGWWhCQ0FCSkY4Z0FpUmdJQU1rWVNBRUpHSWpXeUFBSTc4QmJHb2tXeU5iRUZsT0JFQWpXeEJaYXlSYklBRWdBaUFESUFRUVhDSUFFRjlCQVdvZ0FCQmdRUUZxSTEwUVhTTmRRUUZxSkYwalhTUEFBVUVDYlVFQmEwNEVRQ05kUVFGckpGMExDd3NqQVFGL0lBQVFSU0VCSXlvRWZ5QUJSUVVqS2dzaUFRUkFJQUFRWGdVZ0FCQmhDd3NqQUNOT0VEaElCRUFQQ3dOQUkwNFFPRTRFUUJBNEVHSWpUaEE0YXlST0RBRUxDd3R6QVFGL0lBQkJwdjREUmdSQVFhYitBeEFEUVlBQmNTRUJJNGdCQkg5QkFDQUJFQjRGUVFBZ0FSQWRDeG9qaXdFRWYwRUJJQUVRSGdWQkFTQUJFQjBMR2lPT0FRUi9RUUlnQVJBZUJVRUNJQUVRSFFzYUk1RUJCSDlCQXlBQkVCNEZRUU1nQVJBZEN4b2dBVUh3QUhJUEMwRi9DOFFCQVFGL0k4RUJJUUFqd2dFRVFDUERBUVIvUVFJZ0FCQWRCVUVDSUFBUUhnc2hBQ1BFQVFSL1FRQWdBQkFkQlVFQUlBQVFIZ3NoQUNQRkFRUi9RUU1nQUJBZEJVRURJQUFRSGdzaEFDUEdBUVIvUVFFZ0FCQWRCVUVCSUFBUUhnc2hBQVVqeHdFRVFDUElBUVIvUVFBZ0FCQWRCVUVBSUFBUUhnc2hBQ1BKQVFSL1FRRWdBQkFkQlVFQklBQVFIZ3NoQUNQS0FRUi9RUUlnQUJBZEJVRUNJQUFRSGdzaEFDUExBUVIvUVFNZ0FCQWRCVUVESUFBUUhnc2hBQXNMSUFCQjhBRnlDNFlDQVFGL0lBQkJnSUFDU0FSQVFYOFBDeUFBUVlDQUFrNGlBUVJBSUFCQmdNQUNTQ0VCQ3lBQkJFQkJmdzhMSUFCQmdNQURUaUlCQkVBZ0FFR0EvQU5JSVFFTElBRUVRQ0FBUVlCQWFoQUREd3NnQUVHQS9BTk9JZ0VFUUNBQVFaLzlBMHdoQVFzZ0FRUkFJMzlCQWtnRVFFSC9BUThMUVg4UEN5QUFRY1QrQTBZRVFDQUFJMGtRQmlOSkR3c2dBRUdRL2dOT0lnRUVRQ0FBUWFiK0Ewd2hBUXNnQVFSQUVHTWdBQkJrRHdzZ0FFR3cvZ05PSWdFRVFDQUFRYi8rQTB3aEFRc2dBUVJBRUdOQmZ3OExJQUJCaFA0RFJnUkFJQUFqYlJCZklnRVFCaUFCRHdzZ0FFR0YvZ05HQkVBZ0FDTnVFQVlqYmc4TElBQkJnUDREUmdSQUVHVVBDMEYvQ3hzQkFYOGdBQkJtSWdGQmYwWUVRQ0FBRUFNUEN5QUJRZjhCY1F2c0FnRUNmeU5EQkVBUEN5QUFRZjgvVEFSQUkwVUVmMEVFSUFGQi93RnhFQmhGQlNORkN5SUFSUVJBSUFGQkQzRWlBZ1JBSUFKQkNrWUVRRUVCSkVFTEJVRUFKRUVMQ3dVZ0FFSC8vd0JNQkVBakxrVWlBa1VFUUNBQVFmL2ZBRXdoQWdzZ0FnUkFJMFVFUUNBQlFROXhKQzBMSUFFaEFpTkVCRUFnQWtFZmNTRUNJeTFCNEFGeEpDMEZJMFlFUUNBQ1FmOEFjU0VDSXkxQmdBRnhKQzBGSXk0RVFFRUFKQzBMQ3dzakxTQUNjaVF0QlVFQUlRSWpMUkJnSVFNZ0FVRUFTZ1JBUVFFaEFnc2dBaUFERUNNa0xRc0ZJMFZGSWdNRVFDQUFRZisvQVV3aEF3c2dBd1JBSTBRRWZ5TkNCU05FQ3lJQUJFQWpMVUVmY1NRdEl5MGdBVUhnQVhGeUpDMFBDeU5HQkVBZ0FVRUlUaUlEQkVBZ0FVRU1UQ0VEQ3dzZ0FTRURJeTRFZnlBRFFROXhCU0FEUVFOeEN5SURKREVGSTBWRklnTUVRQ0FBUWYvL0FVd2hBd3NnQXdSQUkwUUVRRUVBSUFGQi93RnhFQmdFUUVFQkpFSUZRUUFrUWdzTEN3c0xDd3NmQUNBQVFmQUFjVUVFZFNTVEFVRURJQUFRR0NTWEFTQUFRUWR4SkpZQkN3c0FRUWNnQUJBWUpLc0JDeDhBSUFCQkJuVkJBM0VrdEFFZ0FFRS9jU1RNQVVIQUFDUE1BV3NraGdFTEh3QWdBRUVHZFVFRGNTUzNBU0FBUVQ5eEpNMEJRY0FBSTgwQmF5U0pBUXNSQUNBQUpNNEJRWUFDSTg0QmF5U01BUXNVQUNBQVFUOXhKTThCUWNBQUk4OEJheVNQQVFzcUFDQUFRUVIxUVE5eEpOQUJRUU1nQUJBWUpKMEJJQUJCQjNFa25BRWdBRUg0QVhGQkFFb2txUUVMS2dBZ0FFRUVkVUVQY1NUUkFVRURJQUFRR0NTaEFTQUFRUWR4SktBQklBQkIrQUZ4UVFCS0pLb0JDdzBBSUFCQkJYVkJEM0VrMGdFTEtnQWdBRUVFZFVFUGNTVFRBVUVESUFBUUdDU2xBU0FBUVFkeEpLUUJJQUJCK0FGeFFRQktKS3dCQ3hRQUlBQWttQUVqbVFGQkNIUWptQUZ5SkpvQkN4UUFJQUFrMUFFajFRRkJDSFFqMUFGeUpMVUJDeFFBSUFBazFnRWoxd0ZCQ0hRajFnRnlKTGdCQzRRQkFRRi9JQUJCQkhVa3ZBRkJBeUFBRUJna3ZnRWdBRUVIY1NUWUFRSkFBa0FDUUFKQUFrQUNRQUpBQWtBajJBRWlBUVJBQWtBZ0FVRUJhdzRIQWdNRUJRWUhDQUFMREFnTFFRZ2t1d0VQQzBFUUpMc0JEd3RCSUNTN0FROExRVEFrdXdFUEMwSEFBQ1M3QVE4TFFkQUFKTHNCRHd0QjRBQWt1d0VQQzBId0FDUzdBUXNMSUFCQkJpQUFFQmdraHdFZ0FFRUhjU1NaQVNPWkFVRUlkQ09ZQVhJa21nRUxhZ0VCZjBFQkpJZ0JJNFlCUlFSQVFjQUFKSVlCQ3hCTEk1d0JKSnNCSTlBQkpKNEJJNW9CSkpVQkk1TUJKSklCSTVNQlFRQktJZ0FFUUNPV0FVRUFTaUVBQ3lBQUJFQkJBU1NVQVFWQkFDU1VBUXNqbGdGQkFFb0VRQkJBQ3lPcEFVVUVRRUVBSklnQkN3c2dBRUVHSUFBUUdDU0tBU0FBUVFkeEpOVUJJOVVCUVFoMEk5UUJjaVMxQVFzdUFFRUJKSXNCSTRrQlJRUkFRY0FBSklrQkN4QlBJNkFCSko4Qkk5RUJKS0lCSTZvQlJRUkFRUUFraXdFTEN5QUFRUVlnQUJBWUpJMEJJQUJCQjNFazF3RWoxd0ZCQ0hRajFnRnlKTGdCQ3ljQVFRRWtqZ0VqakFGRkJFQkJnQUlrakFFTEVGSkJBQ1M1QVNPckFVVUVRRUVBSkk0QkN3c0xBRUVHSUFBUUdDU1FBUXM0QUVFQkpKRUJJNDhCUlFSQVFjQUFKSThCQ3hCVkpMSUJJNlFCSktNQkk5TUJKS1lCUWYvL0FTUzlBU09zQVVVRVFFRUFKSkVCQ3dzVEFDQUFRUVIxUVFkeEpFOGdBRUVIY1NSUUMwSUFRUWNnQUJBWUpGUkJCaUFBRUJna1UwRUZJQUFRR0NSU1FRUWdBQkFZSkZGQkF5QUFFQmdrV0VFQ0lBQVFHQ1JYUVFFZ0FCQVlKRlpCQUNBQUVCZ2tWUXNLQUVFSElBQVFHQ1JaQy8wQ0FRRi9Ba0FnQUVHbS9nTkhJZ0lFUUNOWlJTRUNDeUFDQkVCQkFBOExBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBa0dRL2dOSEJFQUNRQ0FDUVpIK0Eyc09GZ01IQ3c4QUJBZ01FQUlGQ1EwUkFBWUtEaElURkJVQUN3d1ZDeUFCRUdrTUZRc2dBUkJxREJRTElBRVFhd3dUQ3lBQkVHd01FZ3NnQVJCdERCRUxJQUVRYmd3UUN5QUJFRzhNRHdzZ0FSQndEQTRMUVFFa1hpQUJFSEVNRFFzZ0FSQnlEQXdMSUFFUWN3d0xDeUFCRUhRTUNnc2dBUkIxREFrTElBRVFkZ3dJQzBFSElBRVFHQVJBSUFFUWR4QjRDd3dIQzBFSElBRVFHQVJBSUFFUWVSQjZDd3dHQzBFSElBRVFHQVJBSUFFUWV4QjhDd3dGQzBFSElBRVFHQVJBSUFFUWZSQitDd3dFQ3lBQkVIOUJBU1JwREFNTElBRVFnQUZCQVNScURBSUxJQUVRZ1FGQkJ5QUJFQmhGQkVBQ1FFR1EvZ01oQWdOQUlBSkJwdjREVGcwQklBSkJBQkFHSUFKQkFXb2hBZ3dBQUFzQUN3c01BUXRCQVE4TFFRRUxRZ0JCQnlBQUVCZ2tkVUVHSUFBUUdDUjhRUVVnQUJBWUpIdEJCQ0FBRUJna2RrRURJQUFRR0NSNFFRSWdBQkFZSkg1QkFTQUFFQmdrZlVFQUlBQVFHQ1IzQ3owQkFYOGdBRUVJZENFQkFrQkJBQ0VBQTBBZ0FFR2ZBVW9OQVNBQVFZRDhBMm9nQVNBQWFoQURFQVlnQUVFQmFpRUFEQUFBQ3dBTFFZUUZKSFFMRXdBajJ3RVFBeVBjQVJBREVDTkI4UDhEY1FzWEFDUGRBUkFESTk0QkVBTVFJMEh3UDNGQmdJQUNhZ3VMQVFFRGZ5TXZSUVJBRHdzamdnRUVmMEVISUFBUUdFVUZJNElCQ3lJQkJFQkJBQ1NDQVNQYUFSQURJUUVqMmdGQkJ5QUJFQjRRQmc4TEVJVUJJUUVRaGdFaEFrRUhJQUFRSFVFQmFrRUVkQ0VEUVFjZ0FCQVlCRUJCQVNTQ0FTQURKSU1CSUFFa2hBRWdBaVNGQVNQYUFVRUhJQUFRSFJBR0JTQUJJQUlnQXhDYUFTUGFBVUgvQVJBR0N3c21BUUYvSUFCQlAzRWhBeUFDUVFGeEJFQWdBMEZBYXlFREN5QURRWUNRQkdvZ0FUb0FBQXNZQUVFSElBQVFHQVJBSUFGQkJ5QUFRUUZxRUI0UUJnc0xTZ0VDZnlBQUkrRUJSaUlDUlFSQUlBQWo0QUZHSVFJTElBSUVRRUVHSUFCQkFXc1FBeEFkSVFJZ0FDUGdBVVlFUUVFQklRTUxJQUlnQVNBREVJZ0JJQUlnQUVFQmF4Q0pBUXNMQ3dCQkFTVGlBVUVDRURZTFBBRUJmd0pBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVNBQlFRSkdEUUlnQVVFRFJnMEREQVFMUVFrUEMwRUREd3RCQlE4TFFRY1BDMEVBQ3ljQkFYOGpjUkNNQVNJQ0lBQVFHQ0lBQkVBZ0FpQUJFQmhGSVFBTElBQUVRRUVCRHd0QkFBc2FBQ051UVFGcUpHNGpia0gvQVVvRVFFRUJKSEpCQUNSdUN3dG1BUUovQTBBZ0FTQUFTQVJBSTIwaEFpQUJRUVJxSVFFamJVRUVhaVJ0STIxQi8vOERTZ1JBSTIxQmdJQUVheVJ0Q3lOd0JFQWpjZ1JBSTI4a2JoQ0xBVUVBSkhKQkFTUnpCU056QkVCQkFDUnpDd3NnQWlOdEVJMEJCRUFRamdFTEN3d0JDd3NMQ3dBamJCQ1BBVUVBSkd3TEtRQWpiU0VBUVFBa2JVR0UvZ05CQUJBR0kzQUVmeUFBSTIwUWpRRUZJM0FMSWdBRVFCQ09BUXNMR2dBamNBUkFJM01FUUE4TEkzSUVRRUVBSkhJTEN5QUFKRzRMR3dBZ0FDUnZJM0FFZnlOekJTTndDd1JBSTI4a2JrRUFKSE1MQzFnQkFuOGpjQ0VCUVFJZ0FCQVlKSEFnQUVFRGNTRUNJQUZGQkVBamNSQ01BU0VBSUFJUWpBRWhBU053QkVBZ0FDTnRFQmdoQUFVZ0FDTnRFQmdpQUFSQUlBRWpiUkFZSVFBTEN5QUFCRUFRamdFTEN5QUNKSEVMSHdBZ0FFSC9BWE1rd1FGQkJDUEJBUkFZSk1JQlFRVWp3UUVRR0NUSEFRc3JBRUVBSUFBUUdDVGpBVUVCSUFBUUdDU0FBVUVDSUFBUUdDVGlBVUVFSUFBUUdDVGtBU0FBSklFQkN5c0FRUUFnQUJBWUpPVUJRUUVnQUJBWUpPWUJRUUlnQUJBWUpPY0JRUVFnQUJBWUpPZ0JJQUFrNlFFTHFRVUJBWDhDUUFKQUlBQkJnSUFDU0FSQUlBQWdBUkJvREFJTElBQkJnSUFDVGlJQ0JFQWdBRUdBd0FKSUlRSUxJQUlOQUNBQVFZREFBMDRpQWdSQUlBQkJnUHdEU0NFQ0N5QUNCRUFnQUVHQVFHb2dBUkFHREFFTElBQkJnUHdEVGlJQ0JFQWdBRUdmL1FOTUlRSUxJQUlFUUNOL1FRSklEUUlNQVFzZ0FFR2cvUU5PSWdJRVFDQUFRZi85QTB3aEFnc2dBZzBCSUFCQmtQNERUaUlDQkVBZ0FFR20vZ05NSVFJTElBSUVRQkJqSUFBZ0FSQ0NBUThMSUFCQnNQNERUaUlDQkVBZ0FFRy8vZ05NSVFJTElBSUVRQkJqQ3lBQVFjRCtBMDRpQWdSQUlBQkJ5LzREVENFQ0N5QUNCRUFnQUVIQS9nTkdCRUFnQVJDREFRd0NDeUFBUWNUK0EwWUVRRUVBSkVrZ0FFRUFFQVlNQXdzZ0FFSEYvZ05HQkVBZ0FTVFpBUXdDQ3lBQVFjYitBMFlFUUNBQkVJUUJEQUlMQWtBQ1FBSkFBa0FnQUNJQ1FjUCtBMGNFUUFKQUlBSkJ3djREYXc0S0FnQUFBQUFBQUFBRUF3QUxEQVFMSUFFa1Nnd0ZDeUFCSkVzTUJBc2dBU1JNREFNTElBRWtUUXdDQ3d3QkN5QUFJOW9CUmdSQUlBRVFod0VNQWdzZ0FDTXlSaUlDUlFSQUlBQWpNRVloQWdzZ0FnUkFJNElCQkVBamhBRkJnSUFCVGlJQ0JFQWpoQUZCLy84QlRDRUNDeUFDUlFSQUk0UUJRWUNnQTA0aUFnUkFJNFFCUWYrL0Ewd2hBZ3NMSUFJTkF3c0xJQUFqM3dGT0lnSUVRQ0FBSStBQlRDRUNDeUFDQkVBZ0FDQUJFSW9CREFFTElBQkJoUDREVGlJQ0JFQWdBRUdIL2dOTUlRSUxJQUlFUUJDUUFRSkFBa0FDUUFKQUlBQWlBa0dFL2dOSEJFQUNRQ0FDUVlYK0Eyc09Bd0lEQkFBTERBUUxJQUVRa1FFTUJnc2dBUkNTQVF3RUN5QUJFSk1CREFNTElBRVFsQUVNQWdzTUFRc2dBRUdBL2dOR0JFQWdBUkNWQVFzZ0FFR1AvZ05HQkVBZ0FSQ1dBUXdCQ3lBQVFmLy9BMFlFUUNBQkVKY0JEQUVMUVFFUEMwRUJEd3RCQUFzU0FDQUFJQUVRbUFFRVFDQUFJQUVRQmdzTFpRRURmd0pBQTBBZ0F5QUNUZzBCSUFBZ0Eyb1FaeUVGSUFFZ0Eyb2hCQU5BSUFSQi83OENTZ1JBSUFSQmdFQnFJUVFNQVFzTElBUWdCUkNaQVNBRFFRRnFJUU1NQUFBTEFBdEJJQ0VESXpNRVFFSEFBQ0VEQ3lOMElBTWdBa0VRYld4cUpIUUxiUUVCZnlPQ0FVVUVRQThMUVJBaEFDT0RBVUVRU0FSQUk0TUJJUUFMSTRRQkk0VUJJQUFRbWdFamhBRWdBR29raEFFamhRRWdBR29raFFFamd3RWdBR3NrZ3dFamd3RkJBRXdFUUVFQUpJSUJJOW9CUWY4QkVBWUZJOW9CUVFjamd3RkJFRzFCQVdzUUhSQUdDd3NMQUVFQkpPTUJRUUFRTmd2UEFnRUZmeU4xUlFSQVFRQWtTRUVBSkVsQnhQNERRUUFRQmtFQVFRRkJ3ZjRERUFNUUhSQWRJUU5CQUNSL1FjSCtBeUFERUFZUEN5Ti9JUUVqU1NJRFFaQUJUZ1JBUVFFaEFnVWpTQkEwVGdSQVFRSWhBZ1VqU0JBMVRnUkFRUU1oQWdzTEN5QUJJQUpIQkVCQndmNERFQU1oQUNBQ0pIOUJBQ0VCQWtBQ1FBSkFBa0FDUUNBQ0lRUWdBa1VOQUFKQUlBUkJBV3NPQXdJREJBQUxEQVFMUVFOQkFVRUFJQUFRSFJBZElnQVFHQ0VCREFNTFFRUkJBRUVCSUFBUUhSQWVJZ0FRR0NFQkRBSUxRUVZCQVVFQUlBQVFIUkFlSWdBUUdDRUJEQUVMUVFGQkFDQUFFQjRRSGlFQUN5QUJCRUFRTndzZ0FrVUVRQkNiQVFzZ0FrRUJSZ1JBRUp3QkN5UFpBU0VFSUFKRklnRkZCRUFnQWtFQlJpRUJDeUFCQkVBZ0F5QUVSaUVCQ3lBQkJFQkJCa0VDSUFBUUhpSUFFQmdFUUJBM0N3VkJBaUFBRUIwaEFBdEJ3ZjRESUFBUUJnc0xhd0VCZnlOMUJFQWpTQ0FBYWlSSUEwQWpTQkFWVGdSQUkwZ1FGV3NrU0NOSklnRkJrQUZHQkVBaktRUkFFREVGSUFFUU1Bc1FNaEF6QlNBQlFaQUJTQVJBSXlsRkJFQWdBUkF3Q3dzTElBRkJtUUZLQkg5QkFBVWdBVUVCYWdzaUFTUkpEQUVMQ3dzUW5RRUxKQUFqUnhBV1NBUkFEd3NEUUNOSEVCWk9CRUFRRmhDZUFTTkhFQlpySkVjTUFRc0xDMTBBSTNSQkFFb0VRQ0FBSTNScUlRQkJBQ1IwQ3lNK0lBQnFKRDRqUUVVRVFDTW5CRUFqUnlBQWFpUkhFSjhCQlNBQUVKNEJDeU1tQkVBalRpQUFhaVJPQlNBQUVHSUxDeU1vQkVBamJDQUFhaVJzRUpBQkJTQUFFSThCQ3dzUUFFRUVFS0FCSXoxQkFXb1FGQkFEQ3dzQVFRUVFvQUVqUFJBREN4SUFFS0VCUWY4QmNSQ2lBVUgvQVhFUUl3c09BRUVFRUtBQklBQWdBUkNaQVFzdUFRRi9RUUVnQUhRUVlDRUNJQUZCQUVvRVFDTTdJQUp5UWY4QmNTUTdCU003SUFKQi93RnpjU1E3Q3lNN0N3b0FRUVVnQUJDbEFSb0xUUUFnQVVFQVRnUkFJQUJCRDNFZ0FVRVBjV29RWUVFUWNRUkFRUUVRcGdFRlFRQVFwZ0VMQlNBQlFRQWdBV3NnQVVFQVNodEJEM0VnQUVFUGNVc0VRRUVCRUtZQkJVRUFFS1lCQ3dzTENnQkJCeUFBRUtVQkdnc0tBRUVHSUFBUXBRRWFDd29BUVFRZ0FCQ2xBUm9MRXdBZ0FFRUJkQ0FBUWY4QmNVRUhkbklRWUFzMUFRSi9JQUVRWHlFQ0lBQkJBV29oQXlBQUlBRVFZQ0lCRUpnQkJFQWdBQ0FCRUFZTElBTWdBaENZQVFSQUlBTWdBaEFHQ3dzT0FFRUlFS0FCSUFBZ0FSQ3NBUXVEQVFBZ0FrRUJjUVJBSUFCQi8vOERjU0lBSUFGcUlRSWdBQ0FCY3lBQ2N5SUNRUkJ4QkVCQkFSQ21BUVZCQUJDbUFRc2dBa0dBQW5FRVFFRUJFS29CQlVFQUVLb0JDd1VnQUNBQmFoQVVJZ0lnQUVILy93TnhTUVJBUVFFUXFnRUZRUUFRcWdFTElBQWdBWE1nQW5OQmdDQnhFQlFFUUVFQkVLWUJCVUVBRUtZQkN3c0xDd0JCQkJDZ0FTQUFFR2NMRXdBZ0FFSC9BWEZCQVhZZ0FFRUhkSElRWUF2SUJBRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFDUUNBQVFRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3d3VUN4Q2pBVUgvL3dOeElnQVFYMEgvQVhFa05TQUFFR0JCL3dGeEpEWU1FQXNqTlNNMkVDTWpOQkNrQVF3U0N5TTFJellRSTBFQmFrSC8vd054SWdBUVgwSC9BWEVrTlF3TkN5TTFRUUVRcHdFak5VRUJhaEJnSkRVak5RUkFRUUFRcUFFRlFRRVFxQUVMUVFBUXFRRU1FQXNqTlVGL0VLY0JJelZCQVdzUVlDUTFJelVFUUVFQUVLZ0JCVUVCRUtnQkMwRUJFS2tCREE4TEVLSUJRZjhCY1NRMURBd0xJelJCZ0FGeFFZQUJSZ1JBUVFFUXFnRUZRUUFRcWdFTEl6UVFxd0VrTkF3TUN4Q2pBVUgvL3dOeEl6d1FyUUVNQ1Fzak9TTTZFQ01pQUNNMUl6WVFJeUlCUWYvL0EzRkJBQkN1QVNBQUlBRnFFQlFpQUJCZlFmOEJjU1E1SUFBUVlFSC9BWEVrT2tFQUVLa0JRUWdQQ3lNMUl6WVFJeEN2QVVIL0FYRWtOQXdLQ3lNMUl6WVFJMEVCYXhBVUlnQVFYMEgvQVhFa05Rd0ZDeU0yUVFFUXB3RWpOa0VCYWhCZ0pEWWpOZ1JBUVFBUXFBRUZRUUVRcUFFTFFRQVFxUUVNQ0Fzak5rRi9FS2NCSXpaQkFXc1FZQ1EySXpZRVFFRUFFS2dCQlVFQkVLZ0JDMEVCRUtrQkRBY0xFS0lCUWY4QmNTUTJEQVFMSXpSQkFYRkJBRXNFUUVFQkVLb0JCVUVBRUtvQkN5TTBFTEFCSkRRTUJBdEJmdzhMSUFBUVlFSC9BWEVrTmtFSUR3c2pQVUVDYWhBVUpEME1BZ3NqUFVFQmFoQVVKRDBNQVF0QkFCQ29BVUVBRUtrQlFRQVFwZ0VMUVFRTENnQWpPMEVFZGtFQmNRc05BQ0FBUVFGMEVMSUJjaEJnQ3lnQkFYOUJCeUFBUVJoMFFSaDFJZ0VRR0FSQVFZQUNJQUJCR0hSQkdIVnJRWDlzSVFFTElBRUxJd0VCZnlBQUVMUUJJUUVqUFNBQlFSaDBRUmgxYWhBVUpEMGpQVUVCYWhBVUpEMExGQUFnQUVIL0FYRkJBWFlRc2dGQkIzUnlFR0FMbWdVQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkVFY0VRQUpBSUFCQkVXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXk4RVFFRUFRYzMrQXhDdkFVSC9BWEVpQUJBWUJFQkJ6ZjREUVFkQkFDQUFFQjBpQUJBWUJIOUJBQ1F6UVFjZ0FCQWRCVUVCSkROQkJ5QUFFQjRMSWdBUXBBRkJ4QUFQQ3d0QkFTUkFEQkVMRUtNQlFmLy9BM0VpQUJCZlFmOEJjU1EzSUFBUVlFSC9BWEVrT0NNOVFRSnFFQlFrUFF3U0N5TTNJemdRSXlNMEVLUUJEQkVMSXpjak9CQWpRUUZxRUJRaUFCQmZRZjhCY1NRM0RBMExJemRCQVJDbkFTTTNRUUZxRUdBa055TTNCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBUXdQQ3lNM1FYOFFwd0VqTjBFQmF4QmdKRGNqTndSQVFRQVFxQUVGUVFFUXFBRUxRUUVRcVFFTURnc1FvZ0ZCL3dGeEpEY01Dd3RCQUNFQUl6UkJnQUZ4UVlBQlJnUkFRUUVoQUFzak5CQ3pBU1EwREFzTEVLSUJFTFVCUVFnUEN5TTVJem9RSXlJQUl6Y2pPQkFqSWdGQi8vOERjVUVBRUs0QklBQWdBV29RRkNJQUVGOUIvd0Z4SkRrZ0FCQmdRZjhCY1NRNlFRQVFxUUZCQ0E4TEl6Y2pPQkFqUWYvL0EzRVFyd0ZCL3dGeEpEUU1DUXNqTnlNNEVDTkJBV3NRRkNJQUVGOUIvd0Z4SkRjTUJRc2pPRUVCRUtjQkl6aEJBV29RWUNRNEl6Z0VRRUVBRUtnQkJVRUJFS2dCQzBFQUVLa0JEQWNMSXpoQmZ4Q25BU000UVFGckVHQWtPQ000QkVCQkFCQ29BUVZCQVJDb0FRdEJBUkNwQVF3R0N4Q2lBVUgvQVhFa09Bd0RDMEVBSVFBak5FRUJjVUVCUmdSQVFRRWhBQXNqTkJDMkFTUTBEQU1MUVg4UEN5QUFFR0JCL3dGeEpEaEJDQThMSXoxQkFXb1FGQ1E5REFFTElBQUVRRUVCRUtvQkJVRUFFS29CQzBFQUVLZ0JRUUFRcVFGQkFCQ21BUXRCQkFzS0FDTTdRUWQyUVFGeEN3b0FJenRCQlhaQkFYRUxDZ0FqTzBFR2RrRUJjUXYyQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRU0JIQkVBQ1FDQUFRU0ZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN4QzRBUVJBSXoxQkFXb1FGQ1E5QlJDaUFSQzFBUXRCQ0E4TEVLTUJRZi8vQTNFaUFCQmZRZjhCY1NRNUlBQVFZRUgvQVhFa09pTTlRUUpxRUJRa1BRd1FDeU01SXpvUUl5SUFRZi8vQTNFak5CQ2tBU0FBUVFGcUVCUWlBQkJmUWY4QmNTUTVJQUFRWUVIL0FYRWtPZ3dQQ3lNNUl6b1FJMEVCYWhBVUlnQVFYMEgvQVhFa09TQUFFR0JCL3dGeEpEcEJDQThMSXpsQkFSQ25BU001UVFGcUVHQWtPU001QkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVF3TkN5TTVRWDhRcHdFak9VRUJheEJnSkRrak9RUkFRUUFRcUFFRlFRRVFxQUVMUVFFUXFRRU1EQXNRb2dGQi93RnhKRGtNQ2dzUXVRRkJBRXNFUUVFR0lRRUxFTElCUVFCTEJFQWdBVUhnQUhJaEFRc1F1Z0ZCQUVzRWZ5TTBJQUZyRUdBRkl6UkJEM0ZCQ1VzRVFDQUJRUVp5SVFFTEl6UkJtUUZMQkVBZ0FVSGdBSEloQVFzak5DQUJhaEJnQ3lJQUJFQkJBQkNvQVFWQkFSQ29BUXNnQVVIZ0FIRUVRRUVCRUtvQkJVRUFFS29CQzBFQUVLWUJJQUFrTkF3S0N4QzRBVUVBU3dSQUVLSUJFTFVCQlNNOVFRRnFFQlFrUFF0QkNBOExJemtqT2hBaklnRWdBVUgvL3dOeFFRQVFyZ0VnQVVFQmRCQVVJZ0VRWDBIL0FYRWtPU0FCRUdCQi93RnhKRHBCQUJDcEFVRUlEd3NqT1NNNkVDTWlBVUgvL3dOeEVLOEJRZjhCY1NRMElBRkJBV29RRkNJQkVGOUIvd0Z4SkRrZ0FSQmdRZjhCY1NRNkRBY0xJemtqT2hBalFRRnJFQlFpQVJCZlFmOEJjU1E1SUFFUVlFSC9BWEVrT2tFSUR3c2pPa0VCRUtjQkl6cEJBV29RWUNRNkl6b0VRRUVBRUtnQkJVRUJFS2dCQzBFQUVLa0JEQVVMSXpwQmZ4Q25BU002UVFGckVHQWtPaU02QkVCQkFCQ29BUVZCQVJDb0FRdEJBUkNwQVF3RUN4Q2lBVUgvQVhFa09nd0NDeU0wUVg5elFmOEJjU1EwUVFFUXFRRkJBUkNtQVF3Q0MwRi9Ed3NqUFVFQmFoQVVKRDBMUVFRTDZBUUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJNRWNFUUFKQUlBQkJNV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEVMSUJCRUFqUFVFQmFoQVVKRDBGRUtJQkVMVUJDMEVJRHdzUW93RkIvLzhEY1NROEl6MUJBbW9RRkNROURCSUxJemtqT2hBaklnQkIvLzhEY1NNMEVLUUJEQkFMSXp4QkFXb1FGQ1E4UVFnUEN5TTVJem9RSXlJQVFmLy9BM0VRcndFaUFVRUJFS2NCSUFGQkFXb1FZQ0lCQkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVF3TkN5TTVJem9RSXlJQVFmLy9BM0VRcndFaUFVRi9FS2NCSUFGQkFXc1FZQ0lCQkVCQkFCQ29BUVZCQVJDb0FRdEJBUkNwQVF3TUN5TTVJem9RSTBILy93TnhFS0lCUWY4QmNSQ2tBUXdLQzBFQUVLa0JRUUFRcGdGQkFSQ3FBUXdNQ3hDeUFVRUJSZ1JBRUtJQkVMVUJCU005UVFGcUVCUWtQUXRCQ0E4TEl6a2pPaEFqSWdFalBFRUFFSzRCSUFFalBHb1FGQ0lBRUY5Qi93RnhKRGtnQUJCZ1FmOEJjU1E2UVFBUXFRRkJDQThMSXprak9oQWpJZ0JCLy84RGNSQ3ZBVUgvQVhFa05Bd0lDeU04UVFGckVCUWtQRUVJRHdzak5FRUJFS2NCSXpSQkFXb1FZQ1EwSXpRRVFFRUFFS2dCQlVFQkVLZ0JDMEVBRUtrQkRBY0xJelJCZnhDbkFTTTBRUUZyRUdBa05DTTBCRUJCQUJDb0FRVkJBUkNvQVF0QkFSQ3BBUXdHQ3hDaUFVSC9BWEVrTkF3Q0MwRUFFS2tCUVFBUXBnRVFzZ0ZCQUVzRVFFRUFFS29CQlVFQkVLb0JDd3dFQzBGL0R3c2pQVUVCYWhBVUpEME1BZ3NnQUVILy93TnhJQUVRcEFFTUFRc2dBRUVCYXhBVUlnQVFYMEgvQVhFa09TQUFFR0JCL3dGeEpEb0xRUVFMMlFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUJIQkVBZ0FDSUJRY0VBUmcwQkFrQWdBVUhDQUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc01FQXNqTmlRMURBOExJemNrTlF3T0N5TTRKRFVNRFFzak9TUTFEQXdMSXpva05Rd0xDeU01SXpvUUl4Q3ZBVUgvQVhFa05Rd0tDeU0wSkRVTUNRc2pOU1EyREFnTERBY0xJemNrTmd3R0N5TTRKRFlNQlFzak9TUTJEQVFMSXpva05nd0RDeU01SXpvUUl4Q3ZBVUgvQVhFa05nd0NDeU0wSkRZTUFRdEJmdzhMUVFRTDJRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFCSEJFQWdBQ0lCUWRFQVJnMEJBa0FnQVVIU0FHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlNRM0RCQUxJellrTnd3UEN3d09DeU00SkRjTURRc2pPU1EzREF3TEl6b2tOd3dMQ3lNNUl6b1FJeEN2QVVIL0FYRWtOd3dLQ3lNMEpEY01DUXNqTlNRNERBZ0xJellrT0F3SEN5TTNKRGdNQmdzTUJRc2pPU1E0REFRTEl6b2tPQXdEQ3lNNUl6b1FJeEN2QVVIL0FYRWtPQXdDQ3lNMEpEZ01BUXRCZnc4TFFRUUwyUUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUNJQlFlRUFSZzBCQWtBZ0FVSGlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5TUTVEQkFMSXpZa09Rd1BDeU0zSkRrTURnc2pPQ1E1REEwTERBd0xJem9rT1F3TEN5TTVJem9RSXhDdkFVSC9BWEVrT1F3S0N5TTBKRGtNQ1Fzak5TUTZEQWdMSXpZa09nd0hDeU0zSkRvTUJnc2pPQ1E2REFVTEl6a2tPZ3dFQ3d3REN5TTVJem9RSXhDdkFVSC9BWEVrT2d3Q0N5TTBKRG9NQVF0QmZ3OExRUVFMaWdJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUJIQkVBZ0FDSUJRZkVBUmcwQkFrQWdBVUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pPU002RUNNak5SQ2tBUXdRQ3lNNUl6b1FJeU0yRUtRQkRBOExJemtqT2hBakl6Y1FwQUVNRGdzak9TTTZFQ01qT0JDa0FRd05DeU01SXpvUUl5TTVFS1FCREF3TEl6a2pPaEFqSXpvUXBBRU1Dd3NqZ2dGRkJFQkJBU1EvQ3d3S0N5TTVJem9RSXlNMEVLUUJEQWtMSXpVa05Bd0lDeU0ySkRRTUJ3c2pOeVEwREFZTEl6Z2tOQXdGQ3lNNUpEUU1CQXNqT2lRMERBTUxJemtqT2hBakVLOEJRZjhCY1NRMERBSUxEQUVMUVg4UEMwRUVDMGtBSUFGQkFFNEVRQ0FBUWY4QmNTQUFJQUZxRUdCTEJFQkJBUkNxQVFWQkFCQ3FBUXNGSUFGQkFDQUJheUFCUVFCS0d5QUFRZjhCY1VvRVFFRUJFS29CQlVFQUVLb0JDd3NMTmdFQmZ5TTBJQUJCL3dGeElnRVFwd0VqTkNBQkVNRUJJelFnQUdvUVlDUTBJelFFUUVFQUVLZ0JCVUVCRUtnQkMwRUFFS2tCQzJrQkFYOGpOQ0FBYWhDeUFXb1FZQ0VCSXpRZ0FITWdBWE1RWUVFUWNRUkFRUUVRcGdFRlFRQVFwZ0VMSXpRZ0FFSC9BWEZxRUxJQmFoQVVRWUFDY1VFQVN3UkFRUUVRcWdFRlFRQVFxZ0VMSUFFa05DTTBCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBUXZpQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWUFCUndSQUFrQWdBVUdCQVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVRd2dFTUVBc2pOaERDQVF3UEN5TTNFTUlCREE0TEl6Z1F3Z0VNRFFzak9SRENBUXdNQ3lNNkVNSUJEQXNMSXprak9oQWpFSzhCRU1JQkRBb0xJelFRd2dFTUNRc2pOUkREQVF3SUN5TTJFTU1CREFjTEl6Y1F3d0VNQmdzak9CRERBUXdGQ3lNNUVNTUJEQVFMSXpvUXd3RU1Bd3NqT1NNNkVDTVFyd0VRd3dFTUFnc2pOQkREQVF3QkMwRi9Ed3RCQkFzNUFRRi9JelFnQUVIL0FYRkJmMndpQVJDbkFTTTBJQUVRd1FFak5DQUFheEJnSkRRak5BUkFRUUFRcUFFRlFRRVFxQUVMUVFFUXFRRUxhUUVCZnlNMElBQnJFTElCYXhCZ0lRRWpOQ0FBY3lBQmMwRVFjUkJnQkVCQkFSQ21BUVZCQUJDbUFRc2pOQ0FBUWY4QmNXc1FzZ0ZyRUJSQmdBSnhRUUJMQkVCQkFSQ3FBUVZCQUJDcUFRc2dBU1EwSXpRRVFFRUFFS2dCQlVFQkVLZ0JDMEVCRUtrQkMrSUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQmtBRkhCRUFDUUNBQlFaRUJhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5SREZBUXdRQ3lNMkVNVUJEQThMSXpjUXhRRU1EZ3NqT0JERkFRd05DeU01RU1VQkRBd0xJem9ReFFFTUN3c2pPU002RUNNUXJ3RVF4UUVNQ2dzak5CREZBUXdKQ3lNMUVNWUJEQWdMSXpZUXhnRU1Cd3NqTnhER0FRd0dDeU00RU1ZQkRBVUxJemtReGdFTUJBc2pPaERHQVF3REN5TTVJem9RSXhDdkFSREdBUXdDQ3lNMEVNWUJEQUVMUVg4UEMwRUVDeWdBSXpRZ0FIRWtOQ00wQkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVVFQkVLWUJRUUFRcWdFTEtnQWpOQ0FBY3hCZ0pEUWpOQVJBUVFBUXFBRUZRUUVRcUFFTFFRQVFxUUZCQUJDbUFVRUFFS29CQytJQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCb0FGSEJFQUNRQ0FCUWFFQmF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqTlJESUFRd1FDeU0yRU1nQkRBOExJemNReUFFTURnc2pPQkRJQVF3TkN5TTVFTWdCREF3TEl6b1F5QUVNQ3dzak9TTTZFQ01RcndFUXlBRU1DZ3NqTkJESUFRd0pDeU0xRU1rQkRBZ0xJellReVFFTUJ3c2pOeERKQVF3R0N5TTRFTWtCREFVTEl6a1F5UUVNQkFzak9oREpBUXdEQ3lNNUl6b1FJeEN2QVJESkFRd0NDeU0wRU1rQkRBRUxRWDhQQzBFRUN5d0FJelFnQUhKQi93RnhKRFFqTkFSQVFRQVFxQUVGUVFFUXFBRUxRUUFRcVFGQkFCQ21BVUVBRUtvQkN6TUJBWDhqTkNBQVFmOEJjVUYvYkNJQkVLY0JJelFnQVJEQkFTTTBJQUZxQkVCQkFCQ29BUVZCQVJDb0FRdEJBUkNwQVF2aUFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWJBQlJ3UkFBa0FnQVVHeEFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXpVUXl3RU1FQXNqTmhETEFRd1BDeU0zRU1zQkRBNExJemdReXdFTURRc2pPUkRMQVF3TUN5TTZFTXNCREFzTEl6a2pPaEFqRUs4QkVNc0JEQW9MSXpRUXl3RU1DUXNqTlJETUFRd0lDeU0yRU13QkRBY0xJemNRekFFTUJnc2pPQkRNQVF3RkN5TTVFTXdCREFRTEl6b1F6QUVNQXdzak9TTTZFQ01RcndFUXpBRU1BZ3NqTkJETUFRd0JDMEYvRHd0QkJBdEFBUUovQWtBQ1FDQUFFR1lpQVVGL1J3UkFEQUlMSUFBUUF5RUJDd3NDUUFKQUlBQkJBV29pQWhCbUlnQkJmMGNOQVNBQ0VBTWhBQXNMSUFBZ0FSQWpDd3dBUVFnUW9BRWdBQkRPQVFzN0FDQUFRWUFCY1VHQUFVWUVRRUVCRUtvQkJVRUFFS29CQ3lBQUVLc0JJZ0FFUUVFQUVLZ0JCVUVCRUtnQkMwRUFFS2tCUVFBUXBnRWdBQXM1QUNBQVFRRnhRUUJMQkVCQkFSQ3FBUVZCQUJDcUFRc2dBQkN3QVNJQUJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFVRUFFS1lCSUFBTFNBRUJmeUFBUVlBQmNVR0FBVVlFUUVFQklRRUxJQUFRc3dFaEFDQUJCRUJCQVJDcUFRVkJBQkNxQVFzZ0FBUkFRUUFRcUFFRlFRRVFxQUVMUVFBUXFRRkJBQkNtQVNBQUMwWUJBWDhnQUVFQmNVRUJSZ1JBUVFFaEFRc2dBQkMyQVNFQUlBRUVRRUVCRUtvQkJVRUFFS29CQ3lBQUJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFVRUFFS1lCSUFBTFNnRUJmeUFBUVlBQmNVR0FBVVlFUUVFQklRRUxJQUJCQVhRUVlDRUFJQUVFUUVFQkVLb0JCVUVBRUtvQkN5QUFCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBVUVBRUtZQklBQUxhZ0VDZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFCQkFYRkJBVVlFUUVFQklRSUxJQUJCL3dGeFFRRjJFR0FoQUNBQkJFQWdBRUdBQVhJaEFBc2dBQVJBUVFBUXFBRUZRUUVRcUFFTFFRQVFxUUZCQUJDbUFTQUNCRUJCQVJDcUFRVkJBQkNxQVFzZ0FBczNBQ0FBUVE5eFFRUjBJQUJCOEFGeFFRUjJjaEJnSWdBRVFFRUFFS2dCQlVFQkVLZ0JDMEVBRUtrQlFRQVFwZ0ZCQUJDcUFTQUFDMG9CQVg4Z0FFRUJjVUVCUmdSQVFRRWhBUXNnQUVIL0FYRkJBWFlRWUNJQUJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFVRUFFS1lCSUFFRVFFRUJFS29CQlVFQUVLb0JDeUFBQ3lnQUlBRkJBU0FBZEhGQi93RnhCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBVUVCRUtZQklBRUxJQUFnQVVFQVNnUi9JQUpCQVNBQWRISUZJQUpCQVNBQWRFRi9jM0VMSWdJTDJ3Z0JCMzlCZnlFR0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJDRzhpQnlFRklBZEZEUUFDUUNBRlFRRnJEZ2NDQXdRRkJnY0lBQXNNQ0Fzak5TRUJEQWNMSXpZaEFRd0dDeU0zSVFFTUJRc2pPQ0VCREFRTEl6a2hBUXdEQ3lNNklRRU1BZ3NqT1NNNkVDTVFyd0VoQVF3QkN5TTBJUUVMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lGSVFRZ0JVVU5BQUpBSUFSQkFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSUFCQkIwd0VRQ0FCRU5BQklRSkJBU0VEQlNBQVFROU1CRUFnQVJEUkFTRUNRUUVoQXdzTERBOExJQUJCRjB3RVFDQUJFTklCSVFKQkFTRURCU0FBUVI5TUJFQWdBUkRUQVNFQ1FRRWhBd3NMREE0TElBQkJKMHdFUUNBQkVOUUJJUUpCQVNFREJTQUFRUzlNQkVBZ0FSRFZBU0VDUVFFaEF3c0xEQTBMSUFCQk4wd0VRQ0FCRU5ZQklRSkJBU0VEQlNBQVFUOU1CRUFnQVJEWEFTRUNRUUVoQXdzTERBd0xJQUJCeHdCTUJFQkJBQ0FCRU5nQklRSkJBU0VEQlNBQVFjOEFUQVJBUVFFZ0FSRFlBU0VDUVFFaEF3c0xEQXNMSUFCQjF3Qk1CRUJCQWlBQkVOZ0JJUUpCQVNFREJTQUFRZDhBVEFSQVFRTWdBUkRZQVNFQ1FRRWhBd3NMREFvTElBQkI1d0JNQkVCQkJDQUJFTmdCSVFKQkFTRURCU0FBUWU4QVRBUkFRUVVnQVJEWUFTRUNRUUVoQXdzTERBa0xJQUJCOXdCTUJFQkJCaUFCRU5nQklRSkJBU0VEQlNBQVFmOEFUQVJBUVFjZ0FSRFlBU0VDUVFFaEF3c0xEQWdMSUFCQmh3Rk1CRUJCQUVFQUlBRVEyUUVoQWtFQklRTUZJQUJCandGTUJFQkJBVUVBSUFFUTJRRWhBa0VCSVFNTEN3d0hDeUFBUVpjQlRBUkFRUUpCQUNBQkVOa0JJUUpCQVNFREJTQUFRWjhCVEFSQVFRTkJBQ0FCRU5rQklRSkJBU0VEQ3dzTUJnc2dBRUduQVV3RVFFRUVRUUFnQVJEWkFTRUNRUUVoQXdVZ0FFR3ZBVXdFUUVFRlFRQWdBUkRaQVNFQ1FRRWhBd3NMREFVTElBQkJ0d0ZNQkVCQkJrRUFJQUVRMlFFaEFrRUJJUU1GSUFCQnZ3Rk1CRUJCQjBFQUlBRVEyUUVoQWtFQklRTUxDd3dFQ3lBQVFjY0JUQVJBUVFCQkFTQUJFTmtCSVFKQkFTRURCU0FBUWM4QlRBUkFRUUZCQVNBQkVOa0JJUUpCQVNFREN3c01Bd3NnQUVIWEFVd0VRRUVDUVFFZ0FSRFpBU0VDUVFFaEF3VWdBRUhmQVV3RVFFRURRUUVnQVJEWkFTRUNRUUVoQXdzTERBSUxJQUJCNXdGTUJFQkJCRUVCSUFFUTJRRWhBa0VCSVFNRklBQkI3d0ZNQkVCQkJVRUJJQUVRMlFFaEFrRUJJUU1MQ3d3QkN5QUFRZmNCVEFSQVFRWkJBU0FCRU5rQklRSkJBU0VEQlNBQVFmOEJUQVJBUVFkQkFTQUJFTmtCSVFKQkFTRURDd3NMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FISWdRRVFBSkFJQVJCQVdzT0J3SURCQVVHQndnQUN3d0lDeUFDSkRVTUJ3c2dBaVEyREFZTElBSWtOd3dGQ3lBQ0pEZ01CQXNnQWlRNURBTUxJQUlrT2d3Q0N5QUZRUVJJSWdSRkJFQWdCVUVIU2lFRUN5QUVCRUFqT1NNNkVDTWdBaENrQVFzTUFRc2dBaVEwQ3lBREJFQkJCQ0VHQ3lBR0M5SURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFjQUJSd1JBQWtBZ0FVSEJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEVMZ0JEUklNRXdzalBCRFBBVUgvL3dOeElRRWpQRUVDYWhBVUpEd2dBUkJmUWY4QmNTUTFJQUVRWUVIL0FYRWtOa0VFRHdzUXVBRUVRQXdUQlF3UUN3QUxEQTRMRUxnQkJFQU1FUVVNRFFzQUN5TThRUUpyRUJRa1BDTThJelVqTmhBakVLMEJEQTBMRUtJQkVNSUJEQThMSXp4QkFtc1FGQ1E4SXp3alBSQ3RBVUVBSkQwTUN3c1F1QUZCQVVjTkNnd0xDeU04RU04QlFmLy9BM0VrUFNNOFFRSnFFQlFrUEF3SkN4QzRBVUVCUmdSQURBZ0ZEQXNMQUFzUW9nRkIvd0Z4RU5vQklRRWpQVUVCYWhBVUpEMGdBUThMRUxnQlFRRkdCRUFqUEVFQ2F4QVVKRHdqUENNOVFRSnFRZi8vQTNFUXJRRU1CZ1VNQ1FzQUN3d0RDeENpQVJEREFRd0hDeU04UVFKckVCUWtQQ004SXowUXJRRkJDQ1E5REFNTFFYOFBDeU04UVFKckVCUWtQQ004SXoxQkFtb1FGQkN0QVFzUW93RkIvLzhEY1NROUMwRUlEd3NqUEJEUEFVSC8vd054SkQwalBFRUNhaEFVSkR4QkRBOExJejFCQW1vUUZDUTlRUXdQQ3lNOVFRRnFFQlFrUFVFRUN3b0FJQUJCQVhFazZnRUxyd01CQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRZEFCUndSQUFrQWdBVUhSQVdzT0R3SURBQVFGQmdjSUNRb0FDd0FNRFFBTERBMExFTElCRFE0TUR3c2pQQkRQQVVILy93TnhJUUVqUEVFQ2FoQVVKRHdnQVJCZlFmOEJjU1EzSUFFUVlFSC9BWEVrT0VFRUR3c1FzZ0VFUUF3UEJRd01Dd0FMRUxJQkJFQU1EZ1VqUEVFQ2F4QVVKRHdqUENNOVFRSnFRZi8vQTNFUXJRRU1Dd3NBQ3lNOFFRSnJFQlFrUENNOEl6Y2pPQkFqRUswQkRBb0xFS0lCRU1VQkRBd0xJenhCQW1zUUZDUThJendqUFJDdEFVRVFKRDBNQ0FzUXNnRkJBVWNOQnd3SUN5TThFTThCUWYvL0EzRWtQVUVCRU53Qkl6eEJBbW9RRkNROERBWUxFTElCUVFGR0JFQU1CUVVNQ0FzQUN4Q3lBVUVCUmdSQUl6eEJBbXNRRkNROEl6d2pQVUVDYWhBVUVLMEJEQVFGREFjTEFBc1FvZ0VReGdFTUJnc2pQRUVDYXhBVUpEd2pQQ005RUswQlFSZ2tQUXdDQzBGL0R3c1Fvd0ZCLy84RGNTUTlDMEVJRHdzalBCRFBBVUgvL3dOeEpEMGpQRUVDYWhBVUpEeEJEQThMSXoxQkFtb1FGQ1E5UVF3UEN5TTlRUUZxRUJRa1BVRUVDOTRDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWVBQlJ3UkFBa0FnQUVIaEFXc09Ed0lEQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRUtJQlFmOEJjVUdBL2dOcUl6UVFwQUVNQ3dzalBCRFBBVUgvL3dOeElRQWpQRUVDYWhBVUpEd2dBQkJmUWY4QmNTUTVJQUFRWUVIL0FYRWtPa0VFRHdzak5rR0EvZ05xSXpRUXBBRkJCQThMSXp4QkFtc1FGQ1E4SXp3ak9TTTZFQ01RclFGQkNBOExFS0lCRU1nQkRBY0xJenhCQW1zUUZDUThJendqUFJDdEFVRWdKRDFCQ0E4TEVLSUJFTFFCSVFBalBDQUFRUmgwUVJoMUlnQkJBUkN1QVNNOElBQnFFQlFrUEVFQUVLZ0JRUUFRcVFFalBVRUJhaEFVSkQxQkRBOExJemtqT2hBalFmLy9BM0VrUFVFRUR3c1Fvd0ZCLy84RGNTTTBFS1FCSXoxQkFtb1FGQ1E5UVFRUEN4Q2lBUkRKQVF3Q0N5TThRUUpyRUJRa1BDTThJejBRclFGQktDUTlRUWdQQzBGL0R3c2pQVUVCYWhBVUpEMUJCQXVNQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVVjRVFBSkFJQUJCOFFGckRnOENBd1FBQlFZSENBa0tDd0FBREEwQUN3d05DeENpQVVIL0FYRkJnUDREYWhDdkFSQmdKRFFNRFFzalBCRFBBVUgvL3dOeElRQWpQRUVDYWhBVUpEd2dBQkJmUWY4QmNTUTBJQUFRWUVIL0FYRWtPd3dOQ3lNMlFZRCtBMm9RcndFUVlDUTBEQXdMUVFBUTNBRU1Dd3NqUEVFQ2F4QVVKRHdqUENNMEl6c1FJeEN0QVVFSUR3c1FvZ0VReXdFTUNBc2pQRUVDYXhBVUpEd2pQQ005RUswQlFUQWtQVUVJRHdzUW9nRVF0QUVoQUVFQUVLZ0JRUUFRcVFFalBDQUFRUmgwUVJoMUlnQkJBUkN1QVNNOElBQnFFQlFpQUJCZlFmOEJjU1E1SUFBUVlFSC9BWEVrT2lNOVFRRnFFQlFrUFVFSUR3c2pPU002RUNOQi8vOERjU1E4UVFnUEN4Q2pBVUgvL3dOeEVLOEJRZjhCY1NRMEl6MUJBbW9RRkNROURBVUxRUUVRM0FFTUJBc1FvZ0VRekFFTUFnc2pQRUVDYXhBVUpEd2pQQ005RUswQlFUZ2tQVUVJRHd0QmZ3OExJejFCQVdvUUZDUTlDMEVFQzhnQkFRRi9JejFCQVdvUUZDUTlBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdFRVFDQUJRUUZHRFFFQ1FDQUJRUUpyRGcwREJBVUdCd2dKQ2dzTURRNFBBQXNNRHdzZ0FCQ3hBUThMSUFBUXR3RVBDeUFBRUxzQkR3c2dBQkM4QVE4TElBQVF2UUVQQ3lBQUVMNEJEd3NnQUJDL0FROExJQUFRd0FFUEN5QUFFTVFCRHdzZ0FCREhBUThMSUFBUXlnRVBDeUFBRU0wQkR3c2dBQkRiQVE4TElBQVEzUUVQQ3lBQUVONEJEd3NnQUJEZkFRc01BQ09CQVNQcEFYRkJBRW9MR3dFQmZ5QUJFRjhoQWlBQUlBRVFZQkFHSUFCQkFXb2dBaEFHQzRNQkFRRi9RUUFRM0FFZ0FFR1AvZ01RQXhBZElnRWtnUUZCai80RElBRVFCaU04UVFKclFmLy9BM0VrUENNOEl6MFE0Z0VDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdRQ0F3QUVBQXNNQkF0QkFDVGpBVUhBQUNROURBTUxRUUFrZ0FGQnlBQWtQUXdDQzBFQUpPSUJRZEFBSkQwTUFRdEJBQ1RrQVVIZ0FDUTlDd3VzQVFFQmZ5UHFBUVIvSStrQlFRQktCU1BxQVFzaUFBUkFJNEVCUVFCS0lRQUxJQUFFUUVFQUlRQWo1UUVFZnlQakFRVWo1UUVMQkVCQkFCRGpBVUVCSVFBRkkrWUJCSDhqZ0FFRkkrWUJDd1JBUVFFUTR3RkJBU0VBQlNQbkFRUi9JK0lCQlNQbkFRc0VRRUVDRU9NQlFRRWhBQVVqNkFFRWZ5UGtBUVVqNkFFTEJFQkJCQkRqQVVFQklRQUxDd3NMSUFBRVFFRVVJUUFqUHdSQVFRQWtQMEVZSVFBTElBQVBDd3RCQUF1RkFRRUNmMEVCSkNOQkJDRUFJejlGSWdFRVFDTkFSU0VCQ3lBQkJFQWpQUkFEUWY4QmNSRGdBU0VBQlNNL0JIOGo2Z0ZGQlNNL0N5SUJCRUFRNFFFaEFRc2dBUVJBUVFBa1AwRUFKRUFqUFJBRFFmOEJjUkRnQVNFQUl6MUJBV3NRRkNROUN3c2pPMEh3QVhFa095QUFRUUJNQkVBZ0FBOExJQUFRNUFGcUlnQVFvQUVnQUF0SEFRSi9BMEFnQUVVaUFRUkFJejRRRTBnaEFRc2dBUVJBRU9VQlFRQklCRUJCQVNFQUN3d0JDd3NqUGhBVFRnUkFJejRRRTJza1BrRUFEd3NqUFVFQmF4QVVKRDFCZndzRUFDTmRDM2tCQW45QmdBZ2hBU0FBQkg4Z0FFRUFTZ1VnQUFzRVFDQUFJUUVMQTBBZ0FrVWlBQVJBSXo0UUUwZ2hBQXNnQUFSQUVPY0JJQUZJSVFBTElBQUVRQkRsQVVFQVNBUkFRUUVoQWdzTUFRc0xJejRRRTA0RVFDTStFQk5ySkQ1QkFBOExFT2NCSUFGT0JFQkJBUThMSXoxQkFXc1FGQ1E5UVg4TFhnRUNmd05BSUFKRklnRUVRQ00rRUJOSUlRRUxJQUVFUUNNOUlBQkhJUUVMSUFFRVFCRGxBVUVBU0FSQVFRRWhBZ3NNQVFzTEl6NFFFMDRFUUNNK0VCTnJKRDVCQUE4TEl6MGdBRVlFUUVFQkR3c2pQVUVCYXhBVUpEMUJmd3NPQUNBQVFZQUlhaUFCUVRKc2Fnc1pBQ0FCUVFGeEJFQWdBRUVCT2dBQUJTQUFRUUE2QUFBTEM1NEJBRUVBUVFBUTZnRWpORG9BQUVFQlFRQVE2Z0VqTlRvQUFFRUNRUUFRNmdFak5qb0FBRUVEUVFBUTZnRWpOem9BQUVFRVFRQVE2Z0VqT0RvQUFFRUZRUUFRNmdFak9Ub0FBRUVHUVFBUTZnRWpPam9BQUVFSFFRQVE2Z0VqT3pvQUFFRUlRUUFRNmdFalBEc0JBRUVLUVFBUTZnRWpQVHNCQUVFTVFRQVE2Z0VqUGpZQ0FFRVJRUUFRNmdFalB4RHJBVUVTUVFBUTZnRWpRQkRyQVFzaUFFRUFRUUVRNmdFalNEWUNBRUVFUVFFUTZnRWpmem9BQUVIRS9nTWpTUkFHQ3h3QVFRQkJBaERxQVNQcUFSRHJBVUVCUVFJUTZnRWo2d0VRNndFTEF3QUJDMjRBUVFCQkJCRHFBU010T3dFQVFRSkJCQkRxQVNNeE93RUFRUVJCQkJEcUFTTkJFT3NCUVFWQkJCRHFBU05DRU9zQlFRWkJCQkRxQVNOREVPc0JRUWRCQkJEcUFTTkVFT3NCUVFoQkJCRHFBU05GRU9zQlFRbEJCQkRxQVNOR0VPc0JRUXBCQkJEcUFTTXVFT3NCQ3pvQVFRQkJCUkRxQVNOc05nSUFRUVJCQlJEcUFTTnROZ0lBUVFoQkJSRHFBU055RU9zQlFRdEJCUkRxQVNOekVPc0JRWVgrQXlOdUVBWUxKZ0JCQUVFR0VPb0JJMW8yQWdCQkJFRUdFT29CSTFzNkFBQkJCVUVHRU9vQkkxdzZBQUFMaEFFQVFRQkJCeERxQVNPSUFSRHJBVUVCUVFjUTZnRWpxQUUyQWdCQkJVRUhFT29CSTVzQk5nSUFRUWxCQnhEcUFTT0dBVFlDQUVFT1FRY1E2Z0VqbmdFMkFnQkJFMEVIRU9vQkkrd0JPZ0FBUVJSQkJ4RHFBU096QVRvQUFFRVpRUWNRNmdFamxBRVE2d0ZCR2tFSEVPb0JJNUlCTmdJQVFSOUJCeERxQVNPVkFUc0JBQXRkQUVFQVFRZ1E2Z0VqaXdFUTZ3RkJBVUVJRU9vQkk2NEJOZ0lBUVFWQkNCRHFBU09mQVRZQ0FFRUpRUWdRNmdFamlRRTJBZ0JCRGtFSUVPb0JJNklCTmdJQVFSTkJDQkRxQVNQdEFUb0FBRUVVUVFnUTZnRWp0Z0U2QUFBTE5nQkJBRUVKRU9vQkk0NEJFT3NCUVFGQkNSRHFBU093QVRZQ0FFRUZRUWtRNmdFampBRTJBZ0JCQ1VFSkVPb0JJN2tCT3dFQUMxQUFRUUJCQ2hEcUFTT1JBUkRyQVVFQlFRb1E2Z0Vqc2dFMkFnQkJCVUVLRU9vQkk2TUJOZ0lBUVFsQkNoRHFBU09QQVRZQ0FFRU9RUW9RNmdFanBnRTJBZ0JCRTBFS0VPb0JJNzBCT3dFQUN5Y0FFT3dCRU8wQkVPNEJFTzhCRVBBQkVQRUJFUElCRVBNQkVQUUJFUFVCRVBZQlFRQWtJd3NTQUNBQUxRQUFRUUJLQkVCQkFROExRUUFMbmdFQVFRQkJBQkRxQVMwQUFDUTBRUUZCQUJEcUFTMEFBQ1ExUVFKQkFCRHFBUzBBQUNRMlFRTkJBQkRxQVMwQUFDUTNRUVJCQUJEcUFTMEFBQ1E0UVFWQkFCRHFBUzBBQUNRNVFRWkJBQkRxQVMwQUFDUTZRUWRCQUJEcUFTMEFBQ1E3UVFoQkFCRHFBUzhCQUNROFFRcEJBQkRxQVM4QkFDUTlRUXhCQUJEcUFTZ0NBQ1ErUVJGQkFCRHFBUkQ0QVNRL1FSSkJBQkRxQVJENEFTUkFDeXNBUVFCQkFSRHFBU2dDQUNSSVFRUkJBUkRxQVMwQUFDUi9RY1QrQXhBREpFbEJ3UDRERUFNUWd3RUxMZ0JCQUVFQ0VPb0JFUGdCSk9vQlFRRkJBaERxQVJENEFTVHJBVUgvL3dNUUF4Q1hBVUdQL2dNUUF4Q1dBUXNMQUVHQS9nTVFBeENWQVF0dUFFRUFRUVFRNmdFdkFRQWtMVUVDUVFRUTZnRXZBUUFrTVVFRVFRUVE2Z0VRK0FFa1FVRUZRUVFRNmdFUStBRWtRa0VHUVFRUTZnRVErQUVrUTBFSFFRUVE2Z0VRK0FFa1JFRUlRUVFRNmdFUStBRWtSVUVKUVFRUTZnRVErQUVrUmtFS1FRUVE2Z0VRK0FFa0xndEtBRUVBUVFVUTZnRW9BZ0FrYkVFRVFRVVE2Z0VvQWdBa2JVRUlRUVVRNmdFUStBRWtja0VMUVFVUTZnRVErQUVrYzBHRi9nTVFBeVJ1UVliK0F4QURKRzlCaC80REVBTWtjUXNHQUVFQUpGMExLUUJCQUVFR0VPb0JLQUlBSkZwQkJFRUdFT29CTFFBQUpGdEJCVUVHRU9vQkxRQUFKRndRL3dFTGhBRUFRUUJCQnhEcUFSRDRBU1NJQVVFQlFRY1E2Z0VvQWdBa3FBRkJCVUVIRU9vQktBSUFKSnNCUVFsQkJ4RHFBU2dDQUNTR0FVRU9RUWNRNmdFb0FnQWtuZ0ZCRTBFSEVPb0JMUUFBSk93QlFSUkJCeERxQVMwQUFDU3pBVUVaUVFjUTZnRVErQUVrbEFGQkdrRUhFT29CS0FJQUpKSUJRUjlCQnhEcUFTOEJBQ1NWQVF0ZEFFRUFRUWdRNmdFUStBRWtpd0ZCQVVFSUVPb0JLQUlBSks0QlFRVkJDQkRxQVNnQ0FDU2ZBVUVKUVFnUTZnRW9BZ0FraVFGQkRrRUlFT29CS0FJQUpLSUJRUk5CQ0JEcUFTMEFBQ1R0QVVFVVFRZ1E2Z0V0QUFBa3RnRUxOZ0JCQUVFSkVPb0JFUGdCSkk0QlFRRkJDUkRxQVNnQ0FDU3dBVUVGUVFrUTZnRW9BZ0FrakFGQkNVRUpFT29CTHdFQUpMa0JDMUFBUVFCQkNoRHFBUkQ0QVNTUkFVRUJRUW9RNmdFb0FnQWtzZ0ZCQlVFS0VPb0JLQUlBSktNQlFRbEJDaERxQVNnQ0FDU1BBVUVPUVFvUTZnRW9BZ0FrcGdGQkUwRUtFT29CTHdFQUpMMEJDeWNBRVBrQkVQb0JFUHNCRVB3QkVQMEJFUDRCRUlBQ0VJRUNFSUlDRUlNQ0VJUUNRUUFrSXdzTUFDTWpCRUJCQVE4TFFRQUxYd0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQWlBVUVCUmcwQkFrQWdBVUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2p3d0VQQ3lQRUFROExJOFVCRHdzanhnRVBDeVBJQVE4TEk4a0JEd3NqeWdFUEN5UExBUThMUVFBTGl3RUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnSkJBVVlOQVFKQUlBSkJBbXNPQmdNRUJRWUhDQUFMREFnTElBRkJBWEVrd3dFTUJ3c2dBVUVCY1NURUFRd0dDeUFCUVFGeEpNVUJEQVVMSUFGQkFYRWt4Z0VNQkFzZ0FVRUJjU1RJQVF3REN5QUJRUUZ4Sk1rQkRBSUxJQUZCQVhFa3lnRU1BUXNnQVVFQmNTVExBUXNMQ3dCQkFTVGtBVUVFRURZTFpBRUNmMEVBSkVBZ0FCQ0hBa1VFUUVFQklRRUxJQUJCQVJDSUFpQUJCRUJCQUNFQklBQkJBMHdFUUVFQklRRUxJOElCQkg4Z0FRVWp3Z0VMSWdBRVFFRUJJUUlMSThjQkJIOGdBVVVGSThjQkN5SUFCRUJCQVNFQ0N5QUNCRUFRaVFJTEN3c0pBQ0FBUVFBUWlBSUxtZ0VBSUFCQkFFb0VRRUVBRUlvQ0JVRUFFSXNDQ3lBQlFRQktCRUJCQVJDS0FnVkJBUkNMQWdzZ0FrRUFTZ1JBUVFJUWlnSUZRUUlRaXdJTElBTkJBRW9FUUVFREVJb0NCVUVERUlzQ0N5QUVRUUJLQkVCQkJCQ0tBZ1ZCQkJDTEFnc2dCVUVBU2dSQVFRVVFpZ0lGUVFVUWl3SUxJQVpCQUVvRVFFRUdFSW9DQlVFR0VJc0NDeUFIUVFCS0JFQkJCeENLQWdWQkJ4Q0xBZ3NMQkFBak5Bc0VBQ00xQ3dRQUl6WUxCQUFqTndzRUFDTTRDd1FBSXprTEJBQWpPZ3NFQUNNN0N3UUFJejBMQkFBalBBc0dBQ005RUFNTEJBQWpTUXVkQXdFS2YwR0FrQUloQ1NOMkJFQkJnSUFDSVFrTFFZQ3dBaUVLSTNnRVFFR0F1QUloQ2dzQ1FBTkFJQVJCZ0FKT0RRRUNRRUVBSVFVRFFDQUZRWUFDVGcwQklBa2dDaUFFUVFOMVFRVjBhaUFGUVFOMWFpSUdRUUFRRnhBaElRZ2dCRUVJYnlFQlFRY2dCVUVJYjJzaEIwRUFJUUlqTHdSL0lBQkJBRW9GSXk4TElnTUVRQ0FHUVFFUUZ5RUNDMEVHSUFJUUdBUkFRUWNnQVdzaEFRdEJBQ0VEUVFNZ0FoQVlCRUJCQVNFREN5QUlJQUZCQVhScUlnWWdBeEFYSVFoQkFDRUJJQWNnQmtFQmFpQURFQmNRR0FSQVFRSWhBUXNnQnlBSUVCZ0VRQ0FCUVFGcUlRRUxJQVJCQ0hRZ0JXcEJBMndoQnlNdkJIOGdBRUVBU2dVakx3c2lBd1JBUVFBZ0FrRUhjU0FCUVFBUUpDSUJFQ1VoQmtFQklBRVFKU0VEUVFJZ0FSQWxJUUVnQjBHQW1BNXFJZ0lnQmpvQUFDQUNRUUZxSUFNNkFBQWdBa0VDYWlBQk9nQUFCU0FCUWNmK0EwRUFFQ1loQWdKQVFRQWhBUU5BSUFGQkEwNE5BU0FIUVlDWURtb2dBV29nQWpvQUFDQUJRUUZxSVFFTUFBQUxBQXNMSUFWQkFXb2hCUXdBQUFzQUN5QUVRUUZxSVFRTUFBQUxBQXNMUndBQ1FBSkFBa0FDUUFKQUkrNEJRUXByRGdRQkFnTUVBQXNBQzBFQUlRb0xRUUFoQ3d0QmZ5RU1DeUFBSUFFZ0FpQURJQVFnQlNBR0lBY2dDQ0FKSUFvZ0N5QU1FQ2dMMlFFQkJuOENRQU5BSUFKQkYwNE5BUUpBUVFBaEFBTkFJQUJCSDA0TkFVRUFJUVFnQUVFUFNnUkFRUUVoQkFzZ0FpRUJJQUpCRDBvRVFDQUJRUTlySVFFTElBRkJCSFFoQVNBQVFROUtCSDhnQVNBQVFROXJhZ1VnQVNBQWFnc2hBVUdBZ0FJaEJTQUNRUTlLQkVCQmdKQUNJUVVMQWtCQkFDRURBMEFnQTBFSVRnMEJRUXNrN2dFZ0FTQUZJQVJCQUVFSElBTWdBRUVEZENBQ1FRTjBJQU5xUWZnQlFZQ1lHa0VCUVFCQkFCQ2FBaG9nQTBFQmFpRUREQUFBQ3dBTElBQkJBV29oQUF3QUFBc0FDeUFDUVFGcUlRSU1BQUFMQUFzTEJBQWpiUXNFQUNOdUN3UUFJMjhMRndFQmZ5TnhJUUFqY0FSQVFRSWdBQkFlSVFBTElBQUxGQUEvQUVHTEFVZ0VRRUdMQVQ4QWEwQUFHZ3NMSFFBQ1FBSkFBa0FqN2dFT0FnRUNBQXNBQzBFQUlRQUxJQUFRbVFJTEJ3QWdBQ1R1QVFzQXhGNEVibUZ0WlFHOFhxTUNBQ1ZqYjNKbEwyMWxiVzl5ZVM5aVlXNXJhVzVuTDJkbGRGSnZiVUpoYm10QlpHUnlaWE56QVNWamIzSmxMMjFsYlc5eWVTOWlZVzVyYVc1bkwyZGxkRkpoYlVKaGJtdEJaR1J5WlhOekFqZGpiM0psTDIxbGJXOXllUzl0WlcxdmNubE5ZWEF2WjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBeWxqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMMlZwWjJoMFFtbDBURzloWkVaeWIyMUhRazFsYlc5eWVRUWFZMjl5WlM5amNIVXZZM0IxTDJsdWFYUnBZV3hwZW1WRGNIVUZKbU52Y21VdmJXVnRiM0o1TDIxbGJXOXllUzlwYm1sMGFXRnNhWHBsUTJGeWRISnBaR2RsQml0amIzSmxMMjFsYlc5eWVTOXpkRzl5WlM5bGFXZG9kRUpwZEZOMGIzSmxTVzUwYjBkQ1RXVnRiM0o1QngxamIzSmxMMjFsYlc5eWVTOWtiV0V2YVc1cGRHbGhiR2w2WlVSdFlRZ3BZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5cGJtbDBhV0ZzYVhwbFIzSmhjR2hwWTNNSkoyTnZjbVV2WjNKaGNHaHBZM012Y0dGc1pYUjBaUzlwYm1sMGFXRnNhWHBsVUdGc1pYUjBaUW9uWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1cGJtbDBhV0ZzYVhwbEN5ZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbWx1YVhScFlXeHBlbVVNSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWFXNXBkR2xoYkdsNlpRMG5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVwYm1sMGFXRnNhWHBsRGpGamIzSmxMM052ZFc1a0wyRmpZM1Z0ZFd4aGRHOXlMMmx1YVhScFlXeHBlbVZUYjNWdVpFRmpZM1Z0ZFd4aGRHOXlEeUJqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMmx1YVhScFlXeHBlbVZUYjNWdVpCQWpZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMmx1YVhScFlXeHBlbVZVYVcxbGNuTVJGR052Y21VdlkyOXlaUzlwYm1sMGFXRnNhWHBsRWhCamIzSmxMMk52Y21VdlkyOXVabWxuRXlWamIzSmxMMk53ZFM5amNIVXZRM0IxTGsxQldGOURXVU5NUlZOZlVFVlNYMFpTUVUxRkZDSmpiM0psTDNCdmNuUmhZbXhsTDNCdmNuUmhZbXhsTDNVeE5sQnZjblJoWW14bEZUZGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TGsxQldGOURXVU5NUlZOZlVFVlNYMU5EUVU1TVNVNUZGakpqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxtSmhkR05vVUhKdlkyVnpjME41WTJ4bGN4Y25ZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5c2IyRmtSbkp2YlZaeVlXMUNZVzVyR0NGamIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndlkyaGxZMnRDYVhSUGJrSjVkR1VaSjJOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZaMlYwVW1kaVVHbDRaV3hUZEdGeWRCb21ZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5elpYUlFhWGhsYkU5dVJuSmhiV1ViSkdOdmNtVXZaM0poY0docFkzTXZjSEpwYjNKcGRIa3ZaMlYwVUdsNFpXeFRkR0Z5ZEJ3cVkyOXlaUzluY21Gd2FHbGpjeTl3Y21sdmNtbDBlUzluWlhSUWNtbHZjbWwwZVdadmNsQnBlR1ZzSFNGamIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmNtVnpaWFJDYVhSUGJrSjVkR1VlSDJOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5elpYUkNhWFJQYmtKNWRHVWZLbU52Y21VdlozSmhjR2hwWTNNdmNISnBiM0pwZEhrdllXUmtVSEpwYjNKcGRIbG1iM0pRYVhobGJDQTZZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDJSeVlYZE1hVzVsVDJaVWFXeGxSbkp2YlZScGJHVkRZV05vWlNFbVkyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OW5aWFJVYVd4bFJHRjBZVUZrWkhKbGMzTWlNMk52Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5c2IyRmtVR0ZzWlhSMFpVSjVkR1ZHY205dFYyRnpiVTFsYlc5eWVTTWpZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMMk52Ym1OaGRHVnVZWFJsUW5sMFpYTWtMR052Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5blpYUlNaMkpEYjJ4dmNrWnliMjFRWVd4bGRIUmxKUzVqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdloyVjBRMjlzYjNKRGIyMXdiMjVsYm5SR2NtOXRVbWRpSmpOamIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZaMlYwVFc5dWIyTm9jbTl0WlVOdmJHOXlSbkp2YlZCaGJHVjBkR1VuSldOdmNtVXZaM0poY0docFkzTXZkR2xzWlhNdloyVjBWR2xzWlZCcGVHVnNVM1JoY25Rb0xHTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaSEpoZDFCcGVHVnNjMFp5YjIxTWFXNWxUMlpVYVd4bEtUZGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQweHBibVZQWmxScGJHVkdjbTl0Vkdsc1pVbGtLamRqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkME52Ykc5eVVHbDRaV3hHY205dFZHbHNaVWxrS3p4amIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDAxdmJtOWphSEp2YldWUWFYaGxiRVp5YjIxVWFXeGxTV1FzTzJOdmNtVXZaM0poY0docFkzTXZZbUZqYTJkeWIzVnVaRmRwYm1SdmR5OWtjbUYzUW1GamEyZHliM1Z1WkZkcGJtUnZkMU5qWVc1c2FXNWxMUzlqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdmNtVnVaR1Z5UW1GamEyZHliM1Z1WkM0clkyOXlaUzluY21Gd2FHbGpjeTlpWVdOclozSnZkVzVrVjJsdVpHOTNMM0psYm1SbGNsZHBibVJ2ZHk4alkyOXlaUzluY21Gd2FHbGpjeTl6Y0hKcGRHVnpMM0psYm1SbGNsTndjbWwwWlhNd0pHTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012WDJSeVlYZFRZMkZ1YkdsdVpURXBZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5ZmNtVnVaR1Z5Ulc1MGFYSmxSbkpoYldVeUoyTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WTJ4bFlYSlFjbWx2Y21sMGVVMWhjRE1pWTI5eVpTOW5jbUZ3YUdsamN5OTBhV3hsY3k5eVpYTmxkRlJwYkdWRFlXTm9aVFE3WTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OUhjbUZ3YUdsamN5NU5TVTVmUTFsRFRFVlRYMU5RVWtsVVJWTmZURU5FWDAxUFJFVTFRV052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVRVbE9YME5aUTB4RlUxOVVVa0ZPVTBaRlVsOUVRVlJCWDB4RFJGOU5UMFJGTml4amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5ZmNtVnhkV1Z6ZEVsdWRHVnljblZ3ZERjdVkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmNtVnhkV1Z6ZEV4alpFbHVkR1Z5Y25Wd2REZ3BZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1aVlYUmphRkJ5YjJObGMzTkRlV05zWlhNNUxXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1YldGNFJuSmhiV1ZUWlhGMVpXNWpaVU41WTJ4bGN6b3BZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzUxY0dSaGRHVk1aVzVuZEdnN0tXTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRHVnVaM1JvUENsamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlV4bGJtZDBhRDBwWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTkM5RGFHRnVibVZzTkM1MWNHUmhkR1ZNWlc1bmRHZytMR052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2WjJWMFRtVjNSbkpsY1hWbGJtTjVSbkp2YlZOM1pXVndQeWxqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5ObGRFWnlaWEYxWlc1amVVQXlZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlqWVd4amRXeGhkR1ZUZDJWbGNFRnVaRU5vWldOclQzWmxjbVpzYjNkQktHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFUzZGxaWEJDSzJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsUlc1MlpXeHZjR1ZESzJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRYQmtZWFJsUlc1MlpXeHZjR1ZFSzJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsUlc1MlpXeHZjR1ZGSldOdmNtVXZjMjkxYm1RdmMyOTFibVF2ZFhCa1lYUmxSbkpoYldWVFpYRjFaVzVqWlhKR0xtTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkMmxzYkVOb1lXNXVaV3hWY0dSaGRHVkhLbU52Y21VdmMyOTFibVF2WVdOamRXMTFiR0YwYjNJdlpHbGtRMmhoYm01bGJFUmhZME5vWVc1blpVZ3VZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUzYVd4c1EyaGhibTVsYkZWd1pHRjBaVWt1WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1M2FXeHNRMmhoYm01bGJGVndaR0YwWlVvdVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTNhV3hzUTJoaGJtNWxiRlZ3WkdGMFpVc25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzV5WlhObGRGUnBiV1Z5VEQxamIzSmxMM052ZFc1a0wyUjFkSGt2YVhORWRYUjVRM2xqYkdWRGJHOWphMUJ2YzJsMGFYWmxUM0pPWldkaGRHbDJaVVp2Y2xkaGRtVm1iM0p0VFNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExtZGxkRk5oYlhCc1pVNDJZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzVuWlhSVFlXMXdiR1ZHY205dFEzbGpiR1ZEYjNWdWRHVnlUeWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5KbGMyVjBWR2x0WlhKUUptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVaMlYwVTJGdGNHeGxVVFpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG1kbGRGTmhiWEJzWlVaeWIyMURlV05zWlVOdmRXNTBaWEpTSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWNtVnpaWFJVYVcxbGNsTW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTVuWlhSVFlXMXdiR1ZVTm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdVoyVjBVMkZ0Y0d4bFJuSnZiVU41WTJ4bFEyOTFiblJsY2xVN1kyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNW5aWFJPYjJselpVTm9ZVzV1Wld4R2NtVnhkV1Z1WTNsUVpYSnBiMlJXSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdVoyVjBVMkZ0Y0d4bFZ6WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbWRsZEZOaGJYQnNaVVp5YjIxRGVXTnNaVU52ZFc1MFpYSllIR052Y21VdlkzQjFMMk53ZFM5RGNIVXVRMHhQUTB0ZlUxQkZSVVJaS21OdmNtVXZjMjkxYm1RdmMyOTFibVF2VTI5MWJtUXViV0Y0Ukc5M2JsTmhiWEJzWlVONVkyeGxjMW9pWTI5eVpTOXdiM0owWVdKc1pTOXdiM0owWVdKc1pTOXBNekpRYjNKMFlXSnNaVnNvWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzluWlhSVFlXMXdiR1ZCYzFWdWMybG5ibVZrUW5sMFpWd2lZMjl5WlM5emIzVnVaQzl6YjNWdVpDOXRhWGhEYUdGdWJtVnNVMkZ0Y0d4bGMxMHpZMjl5WlM5emIzVnVaQzl6YjNWdVpDOXpaWFJNWldaMFFXNWtVbWxuYUhSUGRYUndkWFJHYjNKQmRXUnBiMUYxWlhWbFhpWmpiM0psTDNOdmRXNWtMMkZqWTNWdGRXeGhkRzl5TDJGalkzVnRkV3hoZEdWVGIzVnVaRjhnWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNOd2JHbDBTR2xuYUVKNWRHVmdIMk52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl6Y0d4cGRFeHZkMEo1ZEdWaEgyTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlkyRnNZM1ZzWVhSbFUyOTFibVJpSEdOdmNtVXZjMjkxYm1RdmMyOTFibVF2ZFhCa1lYUmxVMjkxYm1SakltTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlltRjBZMmhRY205alpYTnpRWFZrYVc5a0syTnZjbVV2YzI5MWJtUXZjbVZuYVhOMFpYSnpMMU52ZFc1a1VtVm5hWE4wWlhKU1pXRmtWSEpoY0hObElXTnZjbVV2YW05NWNHRmtMMnB2ZVhCaFpDOW5aWFJLYjNsd1lXUlRkR0YwWldZa1kyOXlaUzl0WlcxdmNua3ZjbVZoWkZSeVlYQnpMMk5vWldOclVtVmhaRlJ5WVhCelp6SmpiM0psTDIxbGJXOXllUzlzYjJGa0wyVnBaMmgwUW1sMFRHOWhaRVp5YjIxSFFrMWxiVzl5ZVZkcGRHaFVjbUZ3YzJnaFkyOXlaUzl0WlcxdmNua3ZZbUZ1YTJsdVp5OW9ZVzVrYkdWQ1lXNXJhVzVuYVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VEQnFKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TUdzblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNTFjR1JoZEdWT1VuZ3hiQ2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5Wd1pHRjBaVTVTZURGdEoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkWEJrWVhSbFRsSjRNVzRuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTkM5RGFHRnVibVZzTkM1MWNHUmhkR1ZPVW5neGJ5ZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlREp3SjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRYQmtZWFJsVGxKNE1uRW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTUxY0dSaGRHVk9Vbmd5Y2lkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlU1U2VESnpKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUbEo0TTNRblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01pOURhR0Z1Ym1Wc01pNTFjR1JoZEdWT1VuZ3pkU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5Wd1pHRjBaVTVTZUROMkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFRsSjRNM2NuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1MWNHUmhkR1ZPVW5nMGVDUmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblJ5YVdkblpYSjVKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUbEo0Tkhva1kyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01pOURhR0Z1Ym1Wc01pNTBjbWxuWjJWeWV5ZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlRFI4SkdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRISnBaMmRsY24wblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWT1VuZzBmaVJqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5SeWFXZG5aWEovSVdOdmNtVXZjMjkxYm1RdmMyOTFibVF2VTI5MWJtUXVkWEJrWVhSbFRsSTFNSUFCSVdOdmNtVXZjMjkxYm1RdmMyOTFibVF2VTI5MWJtUXVkWEJrWVhSbFRsSTFNWUVCSVdOdmNtVXZjMjkxYm1RdmMyOTFibVF2VTI5MWJtUXVkWEJrWVhSbFRsSTFNb0lCTEdOdmNtVXZjMjkxYm1RdmNtVm5hWE4wWlhKekwxTnZkVzVrVW1WbmFYTjBaWEpYY21sMFpWUnlZWEJ6Z3dFbVkyOXlaUzluY21Gd2FHbGpjeTlzWTJRdlRHTmtMblZ3WkdGMFpVeGpaRU52Ym5SeWIyeUVBU0JqYjNKbEwyMWxiVzl5ZVM5a2JXRXZjM1JoY25SRWJXRlVjbUZ1YzJabGNvVUJKMk52Y21VdmJXVnRiM0o1TDJSdFlTOW5aWFJJWkcxaFUyOTFjbU5sUm5KdmJVMWxiVzl5ZVlZQkxHTnZjbVV2YldWdGIzSjVMMlJ0WVM5blpYUklaRzFoUkdWemRHbHVZWFJwYjI1R2NtOXRUV1Z0YjNKNWh3RWhZMjl5WlM5dFpXMXZjbmt2WkcxaEwzTjBZWEowU0dSdFlWUnlZVzV6Wm1WeWlBRXlZMjl5WlM5bmNtRndhR2xqY3k5d1lXeGxkSFJsTDNOMGIzSmxVR0ZzWlhSMFpVSjVkR1ZKYmxkaGMyMU5aVzF2Y25tSkFUQmpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2YVc1amNtVnRaVzUwVUdGc1pYUjBaVWx1WkdWNFNXWlRaWFNLQVM5amIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZkM0pwZEdWRGIyeHZjbEJoYkdWMGRHVlViMDFsYlc5eWVZc0JNR052Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMM0psY1hWbGMzUlVhVzFsY2tsdWRHVnljblZ3ZEl3QkttTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OWZaMlYwVkdsdFpYSkRiM1Z1ZEdWeVRXRnphMEpwZEkwQk8yTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OWZZMmhsWTJ0RWFYWnBaR1Z5VW1WbmFYTjBaWEpHWVd4c2FXNW5SV1JuWlVSbGRHVmpkRzl5amdFcFkyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxOXBibU55WlcxbGJuUlVhVzFsY2tOdmRXNTBaWEtQQVI5amIzSmxMM1JwYldWeWN5OTBhVzFsY25NdmRYQmtZWFJsVkdsdFpYSnprQUVsWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDJKaGRHTm9VSEp2WTJWemMxUnBiV1Z5YzVFQkwyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OVVhVzFsY25NdWRYQmtZWFJsUkdsMmFXUmxjbEpsWjJsemRHVnlrZ0VzWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTUxY0dSaGRHVlVhVzFsY2tOdmRXNTBaWEtUQVN0amIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlZHbHRaWEp6TG5Wd1pHRjBaVlJwYldWeVRXOWtkV3h2bEFFc1kyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1MWNHUmhkR1ZVYVcxbGNrTnZiblJ5YjJ5VkFTWmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZTbTk1Y0dGa0xuVndaR0YwWlVwdmVYQmhaSllCUG1OdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDBsdWRHVnljblZ3ZEhNdWRYQmtZWFJsU1c1MFpYSnlkWEIwVW1WeGRXVnpkR1ZrbHdFOFkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlNXNTBaWEp5ZFhCMGN5NTFjR1JoZEdWSmJuUmxjbkoxY0hSRmJtRmliR1ZrbUFFbVkyOXlaUzl0WlcxdmNua3ZkM0pwZEdWVWNtRndjeTlqYUdWamExZHlhWFJsVkhKaGNIT1pBVFJqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzlsYVdkb2RFSnBkRk4wYjNKbFNXNTBiMGRDVFdWdGIzSjVWMmwwYUZSeVlYQnptZ0VjWTI5eVpTOXRaVzF2Y25rdlpHMWhMMmhrYldGVWNtRnVjMlpsY3BzQklHTnZjbVV2YldWdGIzSjVMMlJ0WVM5MWNHUmhkR1ZJWW14aGJtdElaRzFobkFFeFkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmNtVnhkV1Z6ZEZaQ2JHRnVhMGx1ZEdWeWNuVndkSjBCSG1OdmNtVXZaM0poY0docFkzTXZiR05rTDNObGRFeGpaRk4wWVhSMWM1NEJKV052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdmRYQmtZWFJsUjNKaGNHaHBZM09mQVN0amIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMkpoZEdOb1VISnZZMlZ6YzBkeVlYQm9hV056b0FFVVkyOXlaUzlqYjNKbEwzTjVibU5EZVdOc1pYT2hBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmRsZEVSaGRHRkNlWFJsVkhkdm9nRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW5aWFJFWVhSaFFubDBaVTl1WmFNQktHTnZjbVV2WTNCMUwyOXdZMjlrWlhNdloyVjBRMjl1WTJGMFpXNWhkR1ZrUkdGMFlVSjVkR1drQVNoamIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJWcFoyaDBRbWwwVTNSdmNtVlRlVzVqUTNsamJHVnpwUUVaWTI5eVpTOWpjSFV2Wm14aFozTXZjMlYwUm14aFowSnBkS1lCSDJOdmNtVXZZM0IxTDJac1lXZHpMM05sZEVoaGJHWkRZWEp5ZVVac1lXZW5BUzlqYjNKbEwyTndkUzltYkdGbmN5OWphR1ZqYTBGdVpGTmxkRVZwWjJoMFFtbDBTR0ZzWmtOaGNuSjVSbXhoWjZnQkdtTnZjbVV2WTNCMUwyWnNZV2R6TDNObGRGcGxjbTlHYkdGbnFRRWVZMjl5WlM5amNIVXZabXhoWjNNdmMyVjBVM1ZpZEhKaFkzUkdiR0ZucWdFYlkyOXlaUzlqY0hVdlpteGhaM012YzJWMFEyRnljbmxHYkdGbnF3RWhZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM0p2ZEdGMFpVSjVkR1ZNWldaMHJBRTJZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZjMmw0ZEdWbGJrSnBkRk4wYjNKbFNXNTBiMGRDVFdWdGIzSjVWMmwwYUZSeVlYQnpyUUVxWTI5eVpTOWpjSFV2YjNCamIyUmxjeTl6YVhoMFpXVnVRbWwwVTNSdmNtVlRlVzVqUTNsamJHVnpyZ0UwWTI5eVpTOWpjSFV2Wm14aFozTXZZMmhsWTJ0QmJtUlRaWFJUYVhoMFpXVnVRbWwwUm14aFozTkJaR1JQZG1WeVpteHZkNjhCSjJOdmNtVXZZM0IxTDI5d1kyOWtaWE12WldsbmFIUkNhWFJNYjJGa1UzbHVZME41WTJ4bGM3QUJJbU52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl5YjNSaGRHVkNlWFJsVW1sbmFIU3hBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRCNHNnRWJZMjl5WlM5amNIVXZabXhoWjNNdloyVjBRMkZ5Y25sR2JHRm5zd0V0WTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKdmRHRjBaVUo1ZEdWTVpXWjBWR2h5YjNWbmFFTmhjbko1dEFFaFkyOXlaUzl3YjNKMFlXSnNaUzl3YjNKMFlXSnNaUzlwT0ZCdmNuUmhZbXhsdFFFaVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM0psYkdGMGFYWmxTblZ0Y0xZQkxtTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXliM1JoZEdWQ2VYUmxVbWxuYUhSVWFISnZkV2RvUTJGeWNubTNBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRGNHVBRWFZMjl5WlM5amNIVXZabXhoWjNNdloyVjBXbVZ5YjBac1lXZTVBUjlqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJJWVd4bVEyRnljbmxHYkdGbnVnRWVZMjl5WlM5amNIVXZabXhoWjNNdloyVjBVM1ZpZEhKaFkzUkdiR0ZudXdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXllTHdCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE0zaTlBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRSNHZnRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1UxZUw4QkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxObmpBQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUZDR3UUVyWTI5eVpTOWpjSFV2Wm14aFozTXZZMmhsWTJ0QmJtUlRaWFJGYVdkb2RFSnBkRU5oY25KNVJteGhaOElCSW1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWhaR1JCVW1WbmFYTjBaWExEQVM1amIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZZV1JrUVZSb2NtOTFaMmhEWVhKeWVWSmxaMmx6ZEdWeXhBRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1U0ZU1VQkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6ZFdKQlVtVm5hWE4wWlhMR0FTNWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzNWaVFWUm9jbTkxWjJoRFlYSnllVkpsWjJsemRHVnl4d0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVNWVNZ0JJbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5aGJtUkJVbVZuYVhOMFpYTEpBU0pqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmVHOXlRVkpsWjJsemRHVnl5Z0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdWQmVNc0JJV052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5dmNrRlNaV2RwYzNSbGNzd0JJV052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5amNFRlNaV2RwYzNSbGNzMEJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsUW5qT0FTdGpiM0psTDIxbGJXOXllUzlzYjJGa0wzTnBlSFJsWlc1Q2FYUk1iMkZrUm5KdmJVZENUV1Z0YjNKNXp3RXBZMjl5WlM5amNIVXZiM0JqYjJSbGN5OXphWGgwWldWdVFtbDBURzloWkZONWJtTkRlV05zWlhQUUFTaGpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSk1aV1owMFFFcFkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM0p2ZEdGMFpWSmxaMmx6ZEdWeVVtbG5hSFRTQVRSamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZjbTkwWVhSbFVtVm5hWE4wWlhKTVpXWjBWR2h5YjNWbmFFTmhjbko1MHdFMVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM0p2ZEdGMFpWSmxaMmx6ZEdWeVVtbG5hSFJVYUhKdmRXZG9RMkZ5Y25uVUFTZGpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUk1aV1owVW1WbmFYTjBaWExWQVRKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZjMmhwWm5SU2FXZG9kRUZ5YVhSb2JXVjBhV05TWldkcGMzUmxjdFlCSzJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXpkMkZ3VG1saVlteGxjMDl1VW1WbmFYTjBaWExYQVM5amIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZjMmhwWm5SU2FXZG9kRXh2WjJsallXeFNaV2RwYzNSbGN0Z0JKMk52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5MFpYTjBRbWwwVDI1U1pXZHBjM1JsY3RrQkptTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6WlhSQ2FYUlBibEpsWjJsemRHVnkyZ0VoWTI5eVpTOWpjSFV2WTJKUGNHTnZaR1Z6TDJoaGJtUnNaVU5pVDNCamIyUmwyd0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdWRGVOd0JLR052Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMM05sZEVsdWRHVnljblZ3ZEhQZEFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVVI0M2dFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkZlTjhCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFJuamdBUjVqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMlY0WldOMWRHVlBjR052WkdYaEFUcGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OUpiblJsY25KMWNIUnpMbUZ5WlVsdWRHVnljblZ3ZEhOUVpXNWthVzVuNGdFdFkyOXlaUzl0WlcxdmNua3ZjM1J2Y21VdmMybDRkR1ZsYmtKcGRGTjBiM0psU1c1MGIwZENUV1Z0YjNKNTR3RXJZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZYMmhoYm1Sc1pVbHVkR1Z5Y25Wd2RPUUJLbU52Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMMk5vWldOclNXNTBaWEp5ZFhCMGMrVUJGV052Y21VdlkyOXlaUzlsZUdWamRYUmxVM1JsY09ZQkZtTnZjbVV2WTI5eVpTOWxlR1ZqZFhSbFJuSmhiV1huQVRCamIzSmxMM052ZFc1a0wzTnZkVzVrTDJkbGRFNTFiV0psY2s5bVUyRnRjR3hsYzBsdVFYVmthVzlDZFdabVpYTG9BU05qYjNKbEwyTnZjbVV2WlhobFkzVjBaVVp5WVcxbFFXNWtRMmhsWTJ0QmRXUnBiK2tCSldOdmNtVXZZMjl5WlM5bGVHVmpkWFJsUm5KaGJXVlZiblJwYkVKeVpXRnJjRzlwYm5UcUFTSmpiM0psTDJOdmNtVXZaMlYwVTJGMlpWTjBZWFJsVFdWdGIzSjVUMlptYzJWMDZ3RXlZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZjM1J2Y21WQ2IyOXNaV0Z1UkdseVpXTjBiSGxVYjFkaGMyMU5aVzF2Y25uc0FScGpiM0psTDJOd2RTOWpjSFV2UTNCMUxuTmhkbVZUZEdGMFplMEJLV052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdWMyRjJaVk4wWVhSbDdnRXZZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTV6WVhabFUzUmhkR1h2QVNOamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdlNtOTVjR0ZrTG5OaGRtVlRkR0YwWmZBQkkyTnZjbVV2YldWdGIzSjVMMjFsYlc5eWVTOU5aVzF2Y25rdWMyRjJaVk4wWVhSbDhRRWpZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMVJwYldWeWN5NXpZWFpsVTNSaGRHWHlBU0JqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMU52ZFc1a0xuTmhkbVZUZEdGMFpmTUJKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1YzJGMlpWTjBZWFJsOUFFbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01pOURhR0Z1Ym1Wc01pNXpZWFpsVTNSaGRHWDFBU1pqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5OaGRtVlRkR0YwWmZZQkptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVjMkYyWlZOMFlYUmw5d0VUWTI5eVpTOWpiM0psTDNOaGRtVlRkR0YwWmZnQk1tTnZjbVV2YldWdGIzSjVMMnh2WVdRdmJHOWhaRUp2YjJ4bFlXNUVhWEpsWTNSc2VVWnliMjFYWVhOdFRXVnRiM0o1K1FFYVkyOXlaUzlqY0hVdlkzQjFMME53ZFM1c2IyRmtVM1JoZEdYNkFTbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TG14dllXUlRkR0YwWmZzQkwyTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXViRzloWkZOMFlYUmwvQUVqWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDBwdmVYQmhaQzVzYjJGa1UzUmhkR1g5QVNOamIzSmxMMjFsYlc5eWVTOXRaVzF2Y25rdlRXVnRiM0o1TG14dllXUlRkR0YwWmY0QkkyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OVVhVzFsY25NdWJHOWhaRk4wWVhSbC93RWhZMjl5WlM5emIzVnVaQzl6YjNWdVpDOWpiR1ZoY2tGMVpHbHZRblZtWm1WeWdBSWdZMjl5WlM5emIzVnVaQzl6YjNWdVpDOVRiM1Z1WkM1c2IyRmtVM1JoZEdXQkFpWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbXh2WVdSVGRHRjBaWUlDSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWJHOWhaRk4wWVhSbGd3SW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNeTlEYUdGdWJtVnNNeTVzYjJGa1UzUmhkR1dFQWlaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExteHZZV1JUZEdGMFpZVUNFMk52Y21VdlkyOXlaUzlzYjJGa1UzUmhkR1dHQWhoamIzSmxMMk52Y21VdmFHRnpRMjl5WlZOMFlYSjBaV1NIQWpSamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdlgyZGxkRXB2ZVhCaFpFSjFkSFJ2YmxOMFlYUmxSbkp2YlVKMWRIUnZia2xraUFJMFkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wxOXpaWFJLYjNsd1lXUkNkWFIwYjI1VGRHRjBaVVp5YjIxQ2RYUjBiMjVKWklrQ01XTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwzSmxjWFZsYzNSS2IzbHdZV1JKYm5SbGNuSjFjSFNLQWlWamIzSmxMMnB2ZVhCaFpDOXFiM2x3WVdRdlgzQnlaWE56U205NWNHRmtRblYwZEc5dWl3SW5ZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMMTl5Wld4bFlYTmxTbTk1Y0dGa1FuVjBkRzl1akFJaFkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wzTmxkRXB2ZVhCaFpGTjBZWFJsalFJaFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVW1WbmFYTjBaWEpCamdJaFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVW1WbmFYTjBaWEpDandJaFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVW1WbmFYTjBaWEpEa0FJaFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVW1WbmFYTjBaWEpFa1FJaFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVW1WbmFYTjBaWEpGa2dJaFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVW1WbmFYTjBaWEpJa3dJaFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVW1WbmFYTjBaWEpNbEFJaFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVW1WbmFYTjBaWEpHbFFJbVkyOXlaUzlrWldKMVp5OWtaV0oxWnkxamNIVXZaMlYwVUhKdlozSmhiVU52ZFc1MFpYS1dBaVJqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlRkR0ZqYTFCdmFXNTBaWEtYQWk1amIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJQY0dOdlpHVkJkRkJ5YjJkeVlXMURiM1Z1ZEdWeW1BSWZZMjl5WlM5a1pXSjFaeTlrWldKMVp5MW5jbUZ3YUdsamN5OW5aWFJNV1prQ04yTnZjbVV2WkdWaWRXY3ZaR1ZpZFdjdFozSmhjR2hwWTNNdlpISmhkMEpoWTJ0bmNtOTFibVJOWVhCVWIxZGhjMjFOWlcxdmNubWFBamRqYjNKbEwyZHlZWEJvYVdOekwzUnBiR1Z6TDJSeVlYZFFhWGhsYkhOR2NtOXRUR2x1WlU5bVZHbHNaWHgwY21GdGNHOXNhVzVsbXdJeVkyOXlaUzlrWldKMVp5OWtaV0oxWnkxbmNtRndhR2xqY3k5a2NtRjNWR2xzWlVSaGRHRlViMWRoYzIxTlpXMXZjbm1jQWgxamIzSmxMMlJsWW5WbkwyUmxZblZuTFhScGJXVnlMMmRsZEVSSlZwMENIbU52Y21VdlpHVmlkV2N2WkdWaWRXY3RkR2x0WlhJdloyVjBWRWxOUVo0Q0hXTnZjbVV2WkdWaWRXY3ZaR1ZpZFdjdGRHbHRaWEl2WjJWMFZFMUJud0lkWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTEwYVcxbGNpOW5aWFJVUVVPZ0FnVnpkR0Z5ZEtFQ1FtTnZjbVV2WkdWaWRXY3ZaR1ZpZFdjdFozSmhjR2hwWTNNdlpISmhkMEpoWTJ0bmNtOTFibVJOWVhCVWIxZGhjMjFOWlcxdmNubDhkSEpoYlhCdmJHbHVaYUlDQ0g1elpYUmhjbWRqQUQ0UWMyOTFjbU5sVFdGd2NHbHVaMVZTVEN4a1pXMXZMMlJsWW5WbloyVnlMMkZ6YzJWMGN5OWpiM0psTG5WdWRHOTFZMmhsWkM1M1lYTnRMbTFoY0E9PSIpOgphd2FpdCBMKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmZoQmdDWDkvZjM5L2YzOS9md0JnQUFCZ0FYOEJmMkFDZjM4QVlBQUJmMkFCZndCZ0EzOS9md0JnQm45L2YzOS9md0JnQW45L0FYOWdCMzkvZjM5L2YzOEJmMkFFZjM5L2Z3QmdEWDkvZjM5L2YzOS9mMzkvZjM4QmYyQURmMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FBT2xBcU1DQWdJQ0FnRUJBd0VCQVFFQkFRRUJBUUVCQUFRQ0JBUUlDQWdLQ0FnSUNBb0pDQWdJREFnTURBc0pEUWNIQmdZREJRRUJBUVFFQlFFRUJBRUJBUUVFQlFFQkFRRUJBZ0lDQWdJQ0FRZ0NCQUVDQkFFQ0JBUUNCQVFFQWdnT0JnVUNBZ1VGQVFJRUFnSURCUVVGQlFVRkJRVUZCUVVGQlFVRkFRVUJCUUVGQVFVRkJRZ0ZCUVFFQlFZREF3RUNDQUVGQVFVRkJRVUZCUVVJQXdZQkFRRUZBUVVFQkFRRENBVURCUVVGQWdNREJnSUNBZ1FDQWdVQ0FnUUVCQUlDQWdJQ0FnTUZCUUlGQlFJRkJRSUZCUUlDQWdJQ0FnSUNBZ0lDQ0F3Q0FnVUNBZ0lDQkFNRkJBUUVCQUlDQ0FNQkFRRUJBUUVCQVFFQkFRRUNBUUVCQVFFQkFRRUJBUUVCQVFRQ0F3RUZCUThFQkFRRUJBUUVCQVFFQkFRRkN3RUVCQVFFQVFVRkJRTUJBQUFHNHdyOUFYOEFRUUFMZndCQmdJQ3NCQXQvQUVHTEFRdC9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUWYvL0F3dC9BRUdBRUF0L0FFR0FnQUVMZndCQmdKQUJDMzhBUVlDQUFndC9BRUdBa0FNTGZ3QkJnSUFCQzM4QVFZQ1FCQXQvQUVHQTZCOExmd0JCZ0pBRUMzOEFRWUFFQzM4QVFZQ2dCQXQvQUVHQXVBRUxmd0JCZ05nRkMzOEFRWURZQlF0L0FFR0FtQTRMZndCQmdJQU1DMzhBUVlDWUdndC9BRUdBZ0FrTGZ3QkJnSmdqQzM4QVFZRGdBQXQvQUVHQStDTUxmd0JCZ0lBSUMzOEFRWUQ0S3d0L0FFR0FnQWdMZndCQmdQZ3pDMzhBUVlDSStBTUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIUC9nTUxmd0ZCQUF0L0FVSHcvZ01MZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUThMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIL0FBdC9BVUgvQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmdQY0NDMzhCUVlDQUNBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZFgrQXd0L0FVSFIvZ01MZndGQjB2NERDMzhCUWRQK0F3dC9BVUhVL2dNTGZ3RkI2UDREQzM4QlFlditBd3QvQVVIcC9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVHQWdLd0VDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUWYvL0F3dC9BRUdBa0FRTGZ3QkJnSkFFQzM4QVFZQUVDMzhBUVlEWUJRdC9BRUdBbUE0TGZ3QkJnSmdhQzM4QVFZRDRJd3QvQUVHQStDc0xmd0JCZ1BnekN3ZTFEbFVHYldWdGIzSjVBZ0FHWTI5dVptbG5BQklNWlhobFkzVjBaVVp5WVcxbEFPWUJHV1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOEE2QUViWlhobFkzVjBaVVp5WVcxbFZXNTBhV3hDY21WaGEzQnZhVzUwQU9rQkMyVjRaV04xZEdWVGRHVndBT1VCQ1hOaGRtVlRkR0YwWlFEM0FRbHNiMkZrVTNSaGRHVUFoUUlPYUdGelEyOXlaVk4wWVhKMFpXUUFoZ0lPYzJWMFNtOTVjR0ZrVTNSaGRHVUFqQUlmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnRG5BUkJqYkdWaGNrRjFaR2x2UW5WbVptVnlBUDhCRjFkQlUwMUNUMWxmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd0FUVjBGVFRVSlBXVjlOUlUxUFVsbGZVMGxhUlFNQkVsZEJVMDFDVDFsZlYwRlRUVjlRUVVkRlV3TUNIa0ZUVTBWTlFreFpVME5TU1ZCVVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNREdrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlUU1ZwRkF3UVdWMEZUVFVKUFdWOVRWRUZVUlY5TVQwTkJWRWxQVGdNRkVsZEJVMDFDVDFsZlUxUkJWRVZmVTBsYVJRTUdJRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3Y2NSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1JRWxaSlJFVlBYMUpCVFY5TVQwTkJWRWxQVGdNSkRsWkpSRVZQWDFKQlRWOVRTVnBGQXdvUlYwOVNTMTlTUVUxZlRFOURRVlJKVDA0REN3MVhUMUpMWDFKQlRWOVRTVnBGQXd3bVQxUklSVkpmUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNEREU0pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBdzRZUjFKQlVFaEpRMU5mVDFWVVVGVlVYMHhQUTBGVVNVOU9BdzhVUjFKQlVFaEpRMU5mVDFWVVVGVlVYMU5KV2tVREVCUkhRa05mVUVGTVJWUlVSVjlNVDBOQlZFbFBUZ01SRUVkQ1ExOVFRVXhGVkZSRlgxTkpXa1VERWhoQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVEU5RFFWUkpUMDRERXhSQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVTBsYVJRTVVEa1pTUVUxRlgweFBRMEZVU1U5T0F4VUtSbEpCVFVWZlUwbGFSUU1XRjBKQlEwdEhVazlWVGtSZlRVRlFYMHhQUTBGVVNVOU9BeGNUUWtGRFMwZFNUMVZPUkY5TlFWQmZVMGxhUlFNWUVsUkpURVZmUkVGVVFWOU1UME5CVkVsUFRnTVpEbFJKVEVWZlJFRlVRVjlUU1ZwRkF4b1NUMEZOWDFSSlRFVlRYMHhQUTBGVVNVOU9BeHNPVDBGTlgxUkpURVZUWDFOSldrVURIQlZCVlVSSlQxOUNWVVpHUlZKZlRFOURRVlJKVDA0REhSRkJWVVJKVDE5Q1ZVWkdSVkpmVTBsYVJRTWVGa05CVWxSU1NVUkhSVjlTUVUxZlRFOURRVlJKVDA0REh4SkRRVkpVVWtsRVIwVmZVa0ZOWDFOSldrVURJQlpEUVZKVVVrbEVSMFZmVWs5TlgweFBRMEZVU1U5T0F5RVNRMEZTVkZKSlJFZEZYMUpQVFY5VFNWcEZBeUloWjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBQUlNWjJWMFVtVm5hWE4wWlhKQkFJMENER2RsZEZKbFoybHpkR1Z5UWdDT0FneG5aWFJTWldkcGMzUmxja01BandJTVoyVjBVbVZuYVhOMFpYSkVBSkFDREdkbGRGSmxaMmx6ZEdWeVJRQ1JBZ3huWlhSU1pXZHBjM1JsY2tnQWtnSU1aMlYwVW1WbmFYTjBaWEpNQUpNQ0RHZGxkRkpsWjJsemRHVnlSZ0NVQWhGblpYUlFjbTluY21GdFEyOTFiblJsY2dDVkFnOW5aWFJUZEdGamExQnZhVzUwWlhJQWxnSVpaMlYwVDNCamIyUmxRWFJRY205bmNtRnRRMjkxYm5SbGNnQ1hBZ1ZuWlhSTVdRQ1lBZ2hmYzJWMFlYSm5Zd0NpQWgxa2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVRQ2hBaGhrY21GM1ZHbHNaVVJoZEdGVWIxZGhjMjFOWlcxdmNua0Ftd0lHWjJWMFJFbFdBSndDQjJkbGRGUkpUVUVBblFJR1oyVjBWRTFCQUo0Q0JtZGxkRlJCUXdDZkFnWjFjR1JoZEdVQTVnRU5aVzExYkdGMGFXOXVVM1JsY0FEbEFSSm5aWFJCZFdScGIxRjFaWFZsU1c1a1pYZ0E1d0VQY21WelpYUkJkV1JwYjFGMVpYVmxBUDhCRG5kaGMyMU5aVzF2Y25sVGFYcGxBKzhCSEhkaGMyMUNiM2xKYm5SbGNtNWhiRk4wWVhSbFRHOWpZWFJwYjI0RDhBRVlkMkZ6YlVKdmVVbHVkR1Z5Ym1Gc1UzUmhkR1ZUYVhwbEEvRUJIV2RoYldWQ2IzbEpiblJsY201aGJFMWxiVzl5ZVV4dlkyRjBhVzl1QS9JQkdXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVk5wZW1VRDh3RVRkbWxrWlc5UGRYUndkWFJNYjJOaGRHbHZiZ1AwQVNKbWNtRnRaVWx1VUhKdlozSmxjM05XYVdSbGIwOTFkSEIxZEV4dlkyRjBhVzl1QS9jQkcyZGhiV1ZpYjNsRGIyeHZjbEJoYkdWMGRHVk1iMk5oZEdsdmJnUDFBUmRuWVcxbFltOTVRMjlzYjNKUVlXeGxkSFJsVTJsNlpRUDJBUlZpWVdOclozSnZkVzVrVFdGd1RHOWpZWFJwYjI0RCtBRUxkR2xzWlVSaGRHRk5ZWEFEK1FFVGMyOTFibVJQZFhSd2RYUk1iMk5oZEdsdmJnUDZBUkZuWVcxbFFubDBaWE5NYjJOaGRHbHZiZ1A4QVJSbllXMWxVbUZ0UW1GdWEzTk1iMk5oZEdsdmJnUDdBUWdDb0FJSzZjY0Jvd0lyQVFKL0l5MGhBU011UlNJQ0JFQWdBVVVoQWdzZ0FnUkFRUUVoQVFzZ0FVRU9kQ0FBUVlDQUFXdHFDdzhBSXpGQkRYUWdBRUdBd0FKcmFndTNBUUVDZndKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCREhVaUFpRUJJQUpGRFFBQ1FDQUJRUUZyRGcwQkFRRUNBZ0lDQXdNRUJBVUdBQXNNQmdzZ0FFR0ErRE5xRHdzZ0FCQUFRWUQ0TTJvUEMwRUFJUUVqTHdSQUl6QVFBMEVCY1NFQkN5QUFRWUNRZm1vZ0FVRU5kR29QQ3lBQUVBRkJnUGdyYWc4TElBQkJnSkIrYWc4TFFRQWhBU012QkVBak1oQURRUWR4SVFFTElBRkJBVWdFUUVFQklRRUxJQUFnQVVFTWRHcEJnUEI5YWc4TElBQkJnRkJxQ3drQUlBQVFBaTBBQUF1UkFRQkJBQ1F6UVFBa05FRUFKRFZCQUNRMlFRQWtOMEVBSkRoQkFDUTVRUUFrT2tFQUpEdEJBQ1E4UVFBa1BVRUFKRDVCQUNRL1FRQWtRQ012QkVCQkVTUTBRWUFCSkR0QkFDUTFRUUFrTmtIL0FTUTNRZFlBSkRoQkFDUTVRUTBrT2dWQkFTUTBRYkFCSkR0QkFDUTFRUk1rTmtFQUpEZEIyQUVrT0VFQkpEbEJ6UUFrT2d0QmdBSWtQVUgrL3dNa1BBdWtBUUVDZjBFQUpFRkJBU1JDUWNjQ0VBTWhBVUVBSkVOQkFDUkVRUUFrUlVFQUpFWkJBQ1F1SUFFRVFDQUJRUUZPSWdBRVFDQUJRUU5NSVFBTElBQUVRRUVCSkVRRklBRkJCVTRpQUFSQUlBRkJCa3doQUFzZ0FBUkFRUUVrUlFVZ0FVRVBUaUlBQkVBZ0FVRVRUQ0VBQ3lBQUJFQkJBU1JHQlNBQlFSbE9JZ0FFUUNBQlFSNU1JUUFMSUFBRVFFRUJKQzRMQ3dzTEJVRUJKRU1MUVFFa0xVRUFKREVMQ3dBZ0FCQUNJQUU2QUFBTEx3QkIwZjREUWY4QkVBWkIwdjREUWY4QkVBWkIwLzREUWY4QkVBWkIxUDREUWY4QkVBWkIxZjREUWY4QkVBWUxtQUVBUVFBa1IwRUFKRWhCQUNSSlFRQWtTa0VBSkV0QkFDUk1RUUFrVFNNdkJFQkJrQUVrU1VIQS9nTkJrUUVRQmtIQi9nTkJnUUVRQmtIRS9nTkJrQUVRQmtISC9nTkIvQUVRQmdWQmtBRWtTVUhBL2dOQmtRRVFCa0hCL2dOQmhRRVFCa0hHL2dOQi93RVFCa0hIL2dOQi9BRVFCa0hJL2dOQi93RVFCa0hKL2dOQi93RVFCZ3RCei80RFFRQVFCa0h3L2dOQkFSQUdDMDhBSXk4RVFFSG8vZ05Cd0FFUUJrSHAvZ05CL3dFUUJrSHEvZ05Cd1FFUUJrSHIvZ05CRFJBR0JVSG8vZ05CL3dFUUJrSHAvZ05CL3dFUUJrSHEvZ05CL3dFUUJrSHIvZ05CL3dFUUJnc0xMd0JCa1A0RFFZQUJFQVpCa2Y0RFFiOEJFQVpCa3Y0RFFmTUJFQVpCay80RFFjRUJFQVpCbFA0RFFiOEJFQVlMTEFCQmxmNERRZjhCRUFaQmx2NERRVDhRQmtHWC9nTkJBQkFHUVpqK0EwRUFFQVpCbWY0RFFiZ0JFQVlMTWdCQm12NERRZjhBRUFaQm0vNERRZjhCRUFaQm5QNERRWjhCRUFaQm5mNERRUUFRQmtHZS9nTkJ1QUVRQmtFQkpGNExMUUJCbi80RFFmOEJFQVpCb1A0RFFmOEJFQVpCb2Y0RFFRQVFCa0dpL2dOQkFCQUdRYVArQTBHL0FSQUdDemdBUVE4a1gwRVBKR0JCRHlSaFFROGtZa0VBSkdOQkFDUmtRUUFrWlVFQUpHWkIvd0FrWjBIL0FDUm9RUUVrYVVFQkpHcEJBQ1JyQzJjQVFRQWtUa0VBSkU5QkFDUlFRUUVrVVVFQkpGSkJBU1JUUVFFa1ZFRUJKRlZCQVNSV1FRRWtWMEVCSkZoQkFTUlpRUUFrV2tFQUpGdEJBQ1JjUVFBa1hSQUtFQXNRREJBTlFhVCtBMEgzQUJBR1FhWCtBMEh6QVJBR1FhYitBMEh4QVJBR0VBNExVZ0JCQUNSc1FRQWtiVUVBSkc1QkFDUnZRUUFrY0VFQUpIRkJBQ1J5UVFBa2N5TXZCRUJCaFA0RFFSNFFCa0dnUFNSdEJVR0UvZ05CcXdFUUJrSE0xd0lrYlF0QmgvNERRZmdCRUFaQitBRWtjUXZKQVFFQ2YwSERBaEFESWdGQndBRkdJZ0JGQkVBakpRUi9JQUZCZ0FGR0JTTWxDeUVBQ3lBQUJFQkJBU1F2QlVFQUpDOExFQVFRQlJBSEVBZ1FDUkFQRUJBakx3UkFRZkQrQTBINEFSQUdRYy8rQTBIK0FSQUdRYzMrQTBIK0FCQUdRWUQrQTBIUEFSQUdRWUwrQTBIOEFCQUdRWS8rQTBIaEFSQUdRZXorQTBIK0FSQUdRZlgrQTBHUEFSQUdCVUh3L2dOQi93RVFCa0hQL2dOQi93RVFCa0hOL2dOQi93RVFCa0dBL2dOQnp3RVFCa0dDL2dOQi9nQVFCa0dQL2dOQjRRRVFCZ3RCQUNRakM1MEJBQ0FBUVFCS0JFQkJBU1FrQlVFQUpDUUxJQUZCQUVvRVFFRUJKQ1VGUVFBa0pRc2dBa0VBU2dSQVFRRWtKZ1ZCQUNRbUN5QURRUUJLQkVCQkFTUW5CVUVBSkNjTElBUkJBRW9FUUVFQkpDZ0ZRUUFrS0FzZ0JVRUFTZ1JBUVFFa0tRVkJBQ1FwQ3lBR1FRQktCRUJCQVNRcUJVRUFKQ29MSUFkQkFFb0VRRUVCSkNzRlFRQWtLd3NnQ0VFQVNnUkFRUUVrTEFWQkFDUXNDeEFSQ3hBQUl6TUVRRUdneVFnUEMwSFFwQVFMQ1FBZ0FFSC8vd054Q3c0QUl6TUVRRUdRQnc4TFFjZ0RDd1FBRUJVTEZRQWdBRUdBa0g1cUlBRkJBWEZCRFhScUxRQUFDdzBBSUFGQkFTQUFkSEZCQUVjTERnQWdBVUdnQVd3Z0FHcEJBMndMRlFBZ0FDQUJFQmxCZ05nRmFpQUNhaUFET2dBQUN3c0FJQUZCb0FGc0lBQnFDeEFBSUFBZ0FSQWJRWUNnQkdvdEFBQUxEUUFnQVVFQklBQjBRWDl6Y1FzS0FDQUJRUUVnQUhSeUN5c0JBWDhnQWtFRGNTRUVJQU5CQVhFRVFFRUNJQVFRSGlFRUN5QUFJQUVRRzBHQW9BUnFJQVE2QUFBTHB3SUJBMzhnQVVFQVNpSURCRUFnQUVFSVNpRURDeUFEQkVBZ0JpTjVSaUVEQ3lBREJFQWdBQ042UmlFREN5QURCRUJCQUNFRFFRQWhCa0VGSUFSQkFXc1FBeEFZQkVCQkFTRURDMEVGSUFRUUF4QVlCRUJCQVNFR0N3SkFRUUFoQkFOQUlBUkJDRTROQVNBRElBWkhCRUJCQnlBRWF5RUVDeUFBSUFScVFhQUJUQVJBSUFCQkNDQUVhMnNoQ0NBQUlBUnFJQUVRR1VHQTJBVnFJUWtDUUVFQUlRVURRQ0FGUVFOT0RRRWdBQ0FFYWlBQklBVWdDU0FGYWkwQUFCQWFJQVZCQVdvaEJRd0FBQXNBQ3lBQUlBUnFJQUZCQWlBSUlBRVFIQ0lGRUIxQkFpQUZFQmdRSHlBSFFRRnFJUWNMSUFSQkFXb2hCQXdBQUFzQUN3VWdCaVI1Q3lBQUkzcE9CRUFnQUVFSWFpUjZJQUFnQWtFSWJ5SUdTQVJBSTNvZ0Jtb2tlZ3NMSUFjTE9BRUJmeUFBUVlDUUFrWUVRQ0FCUVlBQmFpRUNRUWNnQVJBWUJFQWdBVUdBQVdzaEFnc2dBQ0FDUVFSMGFnOExJQUFnQVVFRWRHb0xKQUVCZnlBQVFUOXhJUUlnQVVFQmNRUkFJQUpCUUdzaEFnc2dBa0dBa0FScUxRQUFDeElBSUFCQi93RnhRUWgwSUFGQi93RnhjZ3NnQVFGL0lBQkJBM1FnQVVFQmRHb2lBMEVCYWlBQ0VDSWdBeUFDRUNJUUl3c1ZBQ0FCUVI4Z0FFRUZiQ0lBZEhFZ0FIVkJBM1FMV1FBZ0FrRUJjVVVFUUNBQkVBTWdBRUVCZEhWQkEzRWhBQXRCOGdFaEFRSkFBa0FDUUFKQUFrQWdBRVVOQkFKQUlBQkJBV3NPQXdJREJBQUxEQVFBQ3dBTFFhQUJJUUVNQWd0QjJBQWhBUXdCQzBFSUlRRUxJQUVMRFFBZ0FTQUNiQ0FBYWtFRGJBdXJBZ0VHZnlBQklBQVFJU0FGUVFGMGFpSUFJQUlRRnlFUklBQkJBV29nQWhBWElSSUNRQ0FESVFBRFFDQUFJQVJLRFFFZ0JpQUFJQU5yYWlJT0lBaElCRUFnQUNFQklBeEJBRWdpQWtVRVFFRUZJQXdRR0VVaEFnc2dBZ1JBUVFjZ0FXc2hBUXRCQUNFQ0lBRWdFaEFZQkVCQkFpRUNDeUFCSUJFUUdBUkFJQUpCQVdvaEFnc2dERUVBVGdSL1FRQWdERUVIY1NBQ1FRQVFKQ0lGRUNVaEQwRUJJQVVRSlNFQlFRSWdCUkFsQlNBTFFRQk1CRUJCeC80RElRc0xJQUlnQ3lBS0VDWWlCU0VQSUFVaUFRc2hCU0FKSUE0Z0J5QUlFQ2RxSWhBZ0R6b0FBQ0FRUVFGcUlBRTZBQUFnRUVFQ2FpQUZPZ0FBUVFBaEFTQU1RUUJPQkVCQkJ5QU1FQmdoQVFzZ0RpQUhJQUlnQVJBZklBMUJBV29oRFFzZ0FFRUJhaUVBREFBQUN3QUxJQTBMaFFFQkEzOGdBMEVJYnlFRElBQkZCRUFnQWlBQ1FRaHRRUU4wYXlFSEMwRUhJUWdnQUVFSWFrR2dBVW9FUUVHZ0FTQUFheUVJQzBGL0lRSWpMd1JBUVFNZ0JFRUJFQmNpQWtIL0FYRVFHQVJBUVFFaENRdEJCaUFDRUJnRVFFRUhJQU5ySVFNTEN5QUdJQVVnQ1NBSElBZ2dBeUFBSUFGQm9BRkJnTmdGUVFCQkFDQUNFQ2dMM1FFQUlBVWdCaEFoSVFZZ0JFRUJFQmNoQkNBRFFRaHZJUU5CQmlBRUVCZ0VRRUVISUFOcklRTUxRUUFoQlVFRElBUVFHQVJBUVFFaEJRc2dCaUFEUVFGMGFpSURJQVVRRnlFR0lBTkJBV29nQlJBWElRVWdBa0VJYnlFRFFRVWdCQkFZUlFSQVFRY2dBMnNoQXd0QkFDRUNJQU1nQlJBWUJFQkJBaUVDQ3lBRElBWVFHQVJBSUFKQkFXb2hBZ3RCQUNBRVFRZHhJQUpCQUJBa0lnTVFKU0VGUVFFZ0F4QWxJUVpCQWlBREVDVWhBeUFBSUFGQkFDQUZFQm9nQUNBQlFRRWdCaEFhSUFBZ0FVRUNJQU1RR2lBQUlBRWdBa0VISUFRUUdCQWZDMzhBSUFRZ0JSQWhJQU5CQ0c5QkFYUnFJZ1JCQUJBWElRVkJBQ0VESUFSQkFXcEJBQkFYSVFSQkJ5QUNRUWh2YXlJQ0lBUVFHQVJBUVFJaEF3c2dBaUFGRUJnRVFDQURRUUZxSVFNTElBQWdBVUVBSUFOQngvNERRUUFRSmlJQ0VCb2dBQ0FCUVFFZ0FoQWFJQUFnQVVFQ0lBSVFHaUFBSUFFZ0EwRUFFQjhMM0FFQkJuOGdBMEVEZFNFTEFrQURRQ0FFUWFBQlRnMEJJQVFnQldvaUJrR0FBazRFUUNBR1FZQUNheUVHQ3lBQ0lBdEJCWFJxSUFaQkEzVnFJZ2xCQUJBWElRZEJBQ0VLSXl3RVFDQUVJQUFnQmlBRElBa2dBU0FIRUNBaUNFRUFTZ1JBSUFRZ0NFRUJhMm9oQkVFQklRb0xDeU1yQkg4Z0NrVUZJeXNMSWdnRVFDQUVJQUFnQmlBRElBa2dBU0FIRUNraUNFRUFTZ1JBSUFRZ0NFRUJhMm9oQkFzRklBcEZCRUFqTHdSQUlBUWdBQ0FHSUFNZ0NTQUJJQWNRS2dVZ0JDQUFJQVlnQXlBQklBY1FLd3NMQ3lBRVFRRnFJUVFNQUFBTEFBc0xMQUVDZnlOS0lRUWdBQ05MYWlJRFFZQUNUZ1JBSUFOQmdBSnJJUU1MSUFBZ0FTQUNJQU5CQUNBRUVDd0xNQUVEZnlOTUlRTWdBQ05OSWdSSUJFQVBDeUFEUVFkcklnTkJmMndoQlNBQUlBRWdBaUFBSUFScklBTWdCUkFzQzRVRkFSQi9Ba0JCSnlFSkEwQWdDVUVBU0EwQklBbEJBblFpQTBHQS9BTnFFQU1oQWlBRFFZSDhBMm9RQXlFTElBTkJndndEYWhBRElRUWdBa0VRYXlFQ0lBdEJDR3NoQzBFSUlRVWdBVUVCY1FSQVFSQWhCU0FFUVFKdlFRRkdCRUFnQkVFQmF5RUVDd3NnQUNBQ1RpSUdCRUFnQUNBQ0lBVnFTQ0VHQ3lBR0JFQkJCeUFEUVlQOEEyb1FBeUlHRUJnaERFRUdJQVlRR0NFRFFRVWdCaEFZSVE4Z0FDQUNheUVDSUFNRVFDQUNJQVZyUVg5c1FRRnJJUUlMUVlDQUFpQUVFQ0VnQWtFQmRHb2hCRUVBSVFJakx3Ui9RUU1nQmhBWUJTTXZDeUlEQkVCQkFTRUNDeUFFSUFJUUZ5RVFJQVJCQVdvZ0FoQVhJUkVDUUVFSElRVURRQ0FGUVFCSURRRWdCU0VDSUE4RVFDQUNRUWRyUVg5c0lRSUxRUUFoQ0NBQ0lCRVFHQVJBUVFJaENBc2dBaUFRRUJnRVFDQUlRUUZxSVFnTElBZ0VRQ0FMUVFjZ0JXdHFJZ2RCQUU0aUFnUkFJQWRCb0FGTUlRSUxJQUlFUUVFQUlRSkJBQ0VOUVFBaERpTXZCSDhqZDBVRkl5OExJZ1FFUUVFQklRSUxJQUpGQkVBZ0J5QUFFQndpQ2tFRGNTRURJQXdFZnlBRFFRQktCU0FNQ3lJRUJFQkJBU0VOQlNNdkJIOUJBaUFLRUJnRkl5OExJZ1FFUUNBRFFRQktJUVFMSUFRRVFFRUJJUTRMQ3dzZ0FrVUVRQ0FOUlNJREJIOGdEa1VGSUFNTElRSUxJQUlFUUNNdkJFQkJBQ0FHUVFkeElBaEJBUkFrSWdNUUpTRUVRUUVnQXhBbElRSkJBaUFERUNVaEF5QUhJQUJCQUNBRUVCb2dCeUFBUVFFZ0FoQWFJQWNnQUVFQ0lBTVFHZ1ZCeVA0RElRTkJCQ0FHRUJnRVFFSEovZ01oQXdzZ0J5QUFRUUFnQ0NBRFFRQVFKaUlLRUJvZ0J5QUFRUUVnQ2hBYUlBY2dBRUVDSUFvUUdnc0xDd3NnQlVFQmF5RUZEQUFBQ3dBTEN5QUpRUUZySVFrTUFBQUxBQXNMWmdFQ2YwR0FrQUloQWlOMkJFQkJnSUFDSVFJTEl5OEVmeU12QlNOM0N5SUJCRUJCZ0xBQ0lRRWplQVJBUVlDNEFpRUJDeUFBSUFJZ0FSQXRDeU43QkVCQmdMQUNJUUVqZkFSQVFZQzRBaUVCQ3lBQUlBSWdBUkF1Q3lOOUJFQWdBQ04rRUM4TEN5VUJBWDhDUUFOQUlBQkJrQUZMRFFFZ0FFSC9BWEVRTUNBQVFRRnFJUUFNQUFBTEFBc0xTZ0VDZndKQUEwQWdBRUdRQVU0TkFRSkFRUUFoQVFOQUlBRkJvQUZPRFFFZ0FTQUFFQnRCZ0tBRWFrRUFPZ0FBSUFGQkFXb2hBUXdBQUFzQUN5QUFRUUZxSVFBTUFBQUxBQXNMQ2dCQmZ5UjVRWDhrZWdzT0FDTXpCRUJCOEFVUEMwSDRBZ3NPQUNNekJFQkI4Z01QQzBINUFRc2JBUUYvSUFCQmovNERFQU1RSGlJQkpJRUJRWS8rQXlBQkVBWUxDd0JCQVNTQUFVRUJFRFlMRGdBak13UkFRYTRCRHd0QjF3QUxFQUFqTXdSQVFZQ0FBUThMUVlEQUFBc3VBUUYvSTRZQlFRQktJZ0FFUUNPSEFTRUFDeUFBQkVBamhnRkJBV3NraGdFTEk0WUJSUVJBUVFBa2lBRUxDeTRCQVg4amlRRkJBRW9pQUFSQUk0b0JJUUFMSUFBRVFDT0pBVUVCYXlTSkFRc2ppUUZGQkVCQkFDU0xBUXNMTGdFQmZ5T01BVUVBU2lJQUJFQWpqUUVoQUFzZ0FBUkFJNHdCUVFGckpJd0JDeU9NQVVVRVFFRUFKSTRCQ3dzdUFRRi9JNDhCUVFCS0lnQUVRQ09RQVNFQUN5QUFCRUFqandGQkFXc2tqd0VMSTQ4QlJRUkFRUUFra1FFTEN5SUJBWDhqbFFFamxnRjFJUUFqbHdFRWZ5T1ZBU0FBYXdVamxRRWdBR29MSWdBTFJRRUNmMEdVL2dNUUEwSDRBWEVoQVVHVC9nTWdBRUgvQVhFaUFoQUdRWlQrQXlBQklBQkJDSFVpQUhJUUJpQUNKSmdCSUFBa21RRWptUUZCQ0hRam1BRnlKSm9CQ3prQkFuOFFQaUlBUWY4UFRDSUJCRUFqbGdGQkFFb2hBUXNnQVFSQUlBQWtsUUVnQUJBL0VENGhBQXNnQUVIL0Qwb0VRRUVBSklnQkN3c3ZBQ09TQVVFQmF5U1NBU09TQVVFQVRBUkFJNU1CSkpJQkk1UUJCSDhqa3dGQkFFb0ZJNVFCQ3dSQUVFQUxDd3RnQVFGL0k1c0JRUUZySkpzQkk1c0JRUUJNQkVBam5BRWttd0VqbXdFRVFDT2RBUVIvSTU0QlFROUlCU09kQVFzaUFBUkFJNTRCUVFGcUpKNEJCU09kQVVVaUFBUkFJNTRCUVFCS0lRQUxJQUFFUUNPZUFVRUJheVNlQVFzTEN3c0xZQUVCZnlPZkFVRUJheVNmQVNPZkFVRUFUQVJBSTZBQkpKOEJJNThCQkVBam9RRUVmeU9pQVVFUFNBVWpvUUVMSWdBRVFDT2lBVUVCYWlTaUFRVWpvUUZGSWdBRVFDT2lBVUVBU2lFQUN5QUFCRUFqb2dGQkFXc2tvZ0VMQ3dzTEMyQUJBWDhqb3dGQkFXc2tvd0Vqb3dGQkFFd0VRQ09rQVNTakFTT2pBUVJBSTZVQkJIOGpwZ0ZCRDBnRkk2VUJDeUlBQkVBanBnRkJBV29rcGdFRkk2VUJSU0lBQkVBanBnRkJBRW9oQUFzZ0FBUkFJNllCUVFGckpLWUJDd3NMQ3d1TkFRRUJmeU5hSUFCcUpGb2pXaEE1VGdSQUkxb1FPV3NrV2dKQUFrQUNRQUpBQWtBalhDSUJCRUFDUUNBQlFRSnJEZ1lDQUFNQUJBVUFDd3dGQ3hBNkVEc1FQQkE5REFRTEVEb1FPeEE4RUQwUVFRd0RDeEE2RURzUVBCQTlEQUlMRURvUU94QThFRDBRUVF3QkN4QkNFRU1RUkFzalhFRUJhaVJjSTF4QkNFNEVRRUVBSkZ3TFFRRVBDMEVBQ3gwQUk2Y0JJQUJxSktjQkk2Z0JJNmNCYTBFQVNnUkFRUUFQQzBFQkM0TUJBUUYvQWtBQ1FBSkFBa0FnQUVFQlJ3UkFJQUFpQVVFQ1JnMEJJQUZCQTBZTkFpQUJRUVJHRFFNTUJBc2pZeU9wQVVjRVFDT3BBU1JqUVFFUEMwRUFEd3NqWkNPcUFVY0VRQ09xQVNSa1FRRVBDMEVBRHdzalpTT3JBVWNFUUNPckFTUmxRUUVQQzBFQUR3c2paaU9zQVVjRVFDT3NBU1JtUVFFUEMwRUFEd3RCQUFzZEFDT3RBU0FBYWlTdEFTT3VBU090QVd0QkFFb0VRRUVBRHd0QkFRc3BBQ092QVNBQWFpU3ZBU093QVNPdkFXdEJBRW9pQUFSQUkxNUZJUUFMSUFBRVFFRUFEd3RCQVFzZEFDT3hBU0FBYWlTeEFTT3lBU094QVd0QkFFb0VRRUVBRHd0QkFRc2RBRUdBRUNPYUFXdEJBblFrcUFFak13UkFJNmdCUVFGMEpLZ0JDd3RGQVFGL0FrQUNRQUpBSUFCQkFVY0VRQ0FBSWdKQkFrWU5BU0FDUVFOR0RRSU1Bd3NnQVVHQkFSQVlEd3NnQVVHSEFSQVlEd3NnQVVIK0FCQVlEd3NnQVVFQkVCZ0xmd0VCZnlPb0FTQUFheVNvQVNPb0FVRUFUQVJBSTZnQklRQVFTeU9vQVNBQVFRQWdBR3NnQUVFQVNodHJKS2dCSTdNQlFRRnFKTE1CSTdNQlFRaE9CRUJCQUNTekFRc0xJNGdCQkg4anFRRUZJNGdCQ3lJQUJIOGpuZ0VGUVE4UEN5RUFRUUVoQVNPMEFTT3pBUkJNUlFSQVFYOGhBUXNnQVNBQWJFRVBhZ3NTQVFGL0k2Y0JJUUJCQUNTbkFTQUFFRTBMSFFCQmdCQWp0UUZyUVFKMEpLNEJJek1FUUNPdUFVRUJkQ1N1QVFzTGZ3RUJmeU91QVNBQWF5U3VBU091QVVFQVRBUkFJNjRCSVFBUVR5T3VBU0FBUVFBZ0FHc2dBRUVBU2h0ckpLNEJJN1lCUVFGcUpMWUJJN1lCUVFoT0JFQkJBQ1MyQVFzTEk0c0JCSDhqcWdFRkk0c0JDeUlBQkg4am9nRUZRUThQQ3lFQVFRRWhBU08zQVNPMkFSQk1SUVJBUVg4aEFRc2dBU0FBYkVFUGFnc1NBUUYvSTYwQklRQkJBQ1N0QVNBQUVGQUxIUUJCZ0JBanVBRnJRUUYwSkxBQkl6TUVRQ093QVVFQmRDU3dBUXNMaGdJQkFuOGpzQUVnQUdza3NBRWpzQUZCQUV3RVFDT3dBU0VDRUZJanNBRWdBa0VBSUFKcklBSkJBRW9iYXlTd0FTTzVBVUVCYWlTNUFTTzVBVUVnVGdSQVFRQWt1UUVMQzBFQUlRSWp1Z0VoQUNPT0FRUi9JNnNCQlNPT0FRc2lBUVJBSTE0RVFFR2MvZ01RQTBFRmRVRVBjU0lBSkxvQlFRQWtYZ3NGUVE4UEN5TzVBVUVDYlVHdy9nTnFFQU1oQVNPNUFVRUNid1IvSUFGQkQzRUZJQUZCQkhWQkQzRUxJUUVDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCSUFCQkFrWU5BZ3dEQ3lBQlFRUjFJUUVNQXd0QkFTRUNEQUlMSUFGQkFYVWhBVUVDSVFJTUFRc2dBVUVDZFNFQlFRUWhBZ3NnQWtFQVNnUi9JQUVnQW0wRlFRQUxJZ0ZCRDJvTEVnRUJmeU92QVNFQVFRQWtyd0VnQUJCVEN4c0JBWDhqdXdFanZBRjBJUUFqTXdSQUlBQkJBWFFoQUFzZ0FBdXZBUUVCZnlPeUFTQUFheVN5QVNPeUFVRUFUQVJBSTdJQklRQVFWU1N5QVNPeUFTQUFRUUFnQUdzZ0FFRUFTaHRySkxJQkk3MEJRUUZ4SVFFanZRRkJBWFZCQVhFaEFDTzlBVUVCZFNTOUFTTzlBU0FCSUFCeklnRkJEblJ5SkwwQkk3NEJCRUFqdlFGQnYzOXhKTDBCSTcwQklBRkJCblJ5SkwwQkN3c2prUUVFZnlPc0FRVWprUUVMSWdBRWZ5T21BUVZCRHc4TElRRkJBQ085QVJBWUJIOUJmd1ZCQVFzaUFDQUJiRUVQYWdzU0FRRi9JN0VCSVFCQkFDU3hBU0FBRUZZTEVnQWpNd1JBUVlDQWdBUVBDMEdBZ0lBQ0N3UUFFRmdMQkFBZ0FBc3lBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJDRzFCb0kwR2JVRThha0dnalFac1FZenhBbTBRV2d1NEFRRUJmMEVBSkdralVRUi9JQUFGUVE4TElRUWpVZ1IvSUFRZ0FXb0ZJQVJCRDJvTElRUWpVd1IvSUFRZ0Ftb0ZJQVJCRDJvTElRUWpWQVIvSUFRZ0Eyb0ZJQVJCRDJvTElRUWpWUVIvSUFBRlFROExJUUFqVmdSL0lBQWdBV29GSUFCQkQyb0xJUUFqVndSL0lBQWdBbW9GSUFCQkQyb0xJUUFqV0FSL0lBQWdBMm9GSUFCQkQyb0xJUUJCQUNScVFRQWtheUFFSTA5QkFXb1FXeUVCSUFBalVFRUJhaEJiSVFBZ0FTUm5JQUFrYUNBQklBQVFJd3NsQVFGL0lBSkJBWFJCZ1BnamFpSURJQUJCQVdvNkFBQWdBMEVCYWlBQlFRRnFPZ0FBQzVBQ0FRUi9JQUFRUmlJQlJRUkFRUUVRUnlFQkN5QUFFRWdpQWtVRVFFRUNFRWNoQWdzZ0FCQkpJZ05GQkVCQkF4QkhJUU1MSUFBUVNpSUVSUVJBUVFRUVJ5RUVDeUFCUVFGeEJFQVFUaVJmQ3lBQ1FRRnhCRUFRVVNSZ0N5QURRUUZ4QkVBUVZDUmhDeUFFUVFGeEJFQVFWeVJpQ3lBQlFRRnhSUVJBSUFJaEFRc2dBVUVCY1VVRVFDQURJUUVMSUFGQkFYRkZCRUFnQkNFQkN5QUJRUUZ4QkVCQkFTUnJDeU5iSUFBanZ3RnNhaVJiSTFzUVdVNEVRQ05iRUZsckpGc2phd1IvSTJzRkkya0xJZ0ZGQkVBamFpRUJDeUFCQkVBalh5TmdJMkVqWWhCY0dnc2paMEVCYWlOb1FRRnFJMTBRWFNOZFFRRnFKRjBqWFNQQUFVRUNiVUVCYTA0RVFDTmRRUUZySkYwTEN3c01BQ0FBUVlEK0EzRkJDSFVMQ0FBZ0FFSC9BWEVMZndFRWZ5QUFFRTBoQVNBQUVGQWhBaUFBRUZNaEF5QUFFRlloQkNBQkpGOGdBaVJnSUFNa1lTQUVKR0lqV3lBQUk3OEJiR29rV3lOYkVGbE9CRUFqV3hCWmF5UmJJQUVnQWlBRElBUVFYQ0lBRUY5QkFXb2dBQkJnUVFGcUkxMFFYU05kUVFGcUpGMGpYU1BBQVVFQ2JVRUJhMDRFUUNOZFFRRnJKRjBMQ3dzakFRRi9JQUFRUlNFQkl5b0VmeUFCUlFVaktnc2lBUVJBSUFBUVhnVWdBQkJoQ3dzakFDTk9FRGhJQkVBUEN3TkFJMDRRT0U0RVFCQTRFR0lqVGhBNGF5Uk9EQUVMQ3d0ekFRRi9JQUJCcHY0RFJnUkFRYWIrQXhBRFFZQUJjU0VCSTRnQkJIOUJBQ0FCRUI0RlFRQWdBUkFkQ3hvaml3RUVmMEVCSUFFUUhnVkJBU0FCRUIwTEdpT09BUVIvUVFJZ0FSQWVCVUVDSUFFUUhRc2FJNUVCQkg5QkF5QUJFQjRGUVFNZ0FSQWRDeG9nQVVId0FISVBDMEYvQzhRQkFRRi9JOEVCSVFBandnRUVRQ1BEQVFSL1FRSWdBQkFkQlVFQ0lBQVFIZ3NoQUNQRUFRUi9RUUFnQUJBZEJVRUFJQUFRSGdzaEFDUEZBUVIvUVFNZ0FCQWRCVUVESUFBUUhnc2hBQ1BHQVFSL1FRRWdBQkFkQlVFQklBQVFIZ3NoQUFVanh3RUVRQ1BJQVFSL1FRQWdBQkFkQlVFQUlBQVFIZ3NoQUNQSkFRUi9RUUVnQUJBZEJVRUJJQUFRSGdzaEFDUEtBUVIvUVFJZ0FCQWRCVUVDSUFBUUhnc2hBQ1BMQVFSL1FRTWdBQkFkQlVFRElBQVFIZ3NoQUFzTElBQkI4QUZ5QzRZQ0FRRi9JQUJCZ0lBQ1NBUkFRWDhQQ3lBQVFZQ0FBazRpQVFSQUlBQkJnTUFDU0NFQkN5QUJCRUJCZnc4TElBQkJnTUFEVGlJQkJFQWdBRUdBL0FOSUlRRUxJQUVFUUNBQVFZQkFhaEFERHdzZ0FFR0EvQU5PSWdFRVFDQUFRWi85QTB3aEFRc2dBUVJBSTM5QkFrZ0VRRUgvQVE4TFFYOFBDeUFBUWNUK0EwWUVRQ0FBSTBrUUJpTkpEd3NnQUVHUS9nTk9JZ0VFUUNBQVFhYitBMHdoQVFzZ0FRUkFFR01nQUJCa0R3c2dBRUd3L2dOT0lnRUVRQ0FBUWIvK0Ewd2hBUXNnQVFSQUVHTkJmdzhMSUFCQmhQNERSZ1JBSUFBamJSQmZJZ0VRQmlBQkR3c2dBRUdGL2dOR0JFQWdBQ051RUFZamJnOExJQUJCZ1A0RFJnUkFFR1VQQzBGL0N4c0JBWDhnQUJCbUlnRkJmMFlFUUNBQUVBTVBDeUFCUWY4QmNRdnNBZ0VDZnlOREJFQVBDeUFBUWY4L1RBUkFJMFVFZjBFRUlBRkIvd0Z4RUJoRkJTTkZDeUlBUlFSQUlBRkJEM0VpQWdSQUlBSkJDa1lFUUVFQkpFRUxCVUVBSkVFTEN3VWdBRUgvL3dCTUJFQWpMa1VpQWtVRVFDQUFRZi9mQUV3aEFnc2dBZ1JBSTBVRVFDQUJRUTl4SkMwTElBRWhBaU5FQkVBZ0FrRWZjU0VDSXkxQjRBRnhKQzBGSTBZRVFDQUNRZjhBY1NFQ0l5MUJnQUZ4SkMwRkl5NEVRRUVBSkMwTEN3c2pMU0FDY2lRdEJVRUFJUUlqTFJCZ0lRTWdBVUVBU2dSQVFRRWhBZ3NnQWlBREVDTWtMUXNGSTBWRklnTUVRQ0FBUWYrL0FVd2hBd3NnQXdSQUkwUUVmeU5DQlNORUN5SUFCRUFqTFVFZmNTUXRJeTBnQVVIZ0FYRnlKQzBQQ3lOR0JFQWdBVUVJVGlJREJFQWdBVUVNVENFREN3c2dBU0VESXk0RWZ5QURRUTl4QlNBRFFRTnhDeUlESkRFRkkwVkZJZ01FUUNBQVFmLy9BVXdoQXdzZ0F3UkFJMFFFUUVFQUlBRkIvd0Z4RUJnRVFFRUJKRUlGUVFBa1Fnc0xDd3NMQ3dzZkFDQUFRZkFBY1VFRWRTU1RBVUVESUFBUUdDU1hBU0FBUVFkeEpKWUJDd3NBUVFjZ0FCQVlKS3NCQ3g4QUlBQkJCblZCQTNFa3RBRWdBRUUvY1NUTUFVSEFBQ1BNQVdza2hnRUxId0FnQUVFR2RVRURjU1MzQVNBQVFUOXhKTTBCUWNBQUk4MEJheVNKQVFzUkFDQUFKTTRCUVlBQ0k4NEJheVNNQVFzVUFDQUFRVDl4Sk04QlFjQUFJODhCYXlTUEFRc3FBQ0FBUVFSMVFROXhKTkFCUVFNZ0FCQVlKSjBCSUFCQkIzRWtuQUVnQUVINEFYRkJBRW9rcVFFTEtnQWdBRUVFZFVFUGNTVFJBVUVESUFBUUdDU2hBU0FBUVFkeEpLQUJJQUJCK0FGeFFRQktKS29CQ3cwQUlBQkJCWFZCRDNFazBnRUxLZ0FnQUVFRWRVRVBjU1RUQVVFRElBQVFHQ1NsQVNBQVFRZHhKS1FCSUFCQitBRnhRUUJLSkt3QkN4UUFJQUFrbUFFam1RRkJDSFFqbUFGeUpKb0JDeFFBSUFBazFBRWoxUUZCQ0hRajFBRnlKTFVCQ3hRQUlBQWsxZ0VqMXdGQkNIUWoxZ0Z5SkxnQkM0UUJBUUYvSUFCQkJIVWt2QUZCQXlBQUVCZ2t2Z0VnQUVFSGNTVFlBUUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWoyQUVpQVFSQUFrQWdBVUVCYXc0SEFnTUVCUVlIQ0FBTERBZ0xRUWdrdXdFUEMwRVFKTHNCRHd0QklDUzdBUThMUVRBa3V3RVBDMEhBQUNTN0FROExRZEFBSkxzQkR3dEI0QUFrdXdFUEMwSHdBQ1M3QVFzTElBQkJCaUFBRUJna2h3RWdBRUVIY1NTWkFTT1pBVUVJZENPWUFYSWttZ0VMYWdFQmYwRUJKSWdCSTRZQlJRUkFRY0FBSklZQkN4QkxJNXdCSkpzQkk5QUJKSjRCSTVvQkpKVUJJNU1CSkpJQkk1TUJRUUJLSWdBRVFDT1dBVUVBU2lFQUN5QUFCRUJCQVNTVUFRVkJBQ1NVQVFzamxnRkJBRW9FUUJCQUN5T3BBVVVFUUVFQUpJZ0JDd3NnQUVFR0lBQVFHQ1NLQVNBQVFRZHhKTlVCSTlVQlFRaDBJOVFCY2lTMUFRc3VBRUVCSklzQkk0a0JSUVJBUWNBQUpJa0JDeEJQSTZBQkpKOEJJOUVCSktJQkk2b0JSUVJBUVFBa2l3RUxDeUFBUVFZZ0FCQVlKSTBCSUFCQkIzRWsxd0VqMXdGQkNIUWoxZ0Z5SkxnQkN5Y0FRUUVramdFampBRkZCRUJCZ0FJa2pBRUxFRkpCQUNTNUFTT3JBVVVFUUVFQUpJNEJDd3NMQUVFR0lBQVFHQ1NRQVFzNEFFRUJKSkVCSTQ4QlJRUkFRY0FBSkk4QkN4QlZKTElCSTZRQkpLTUJJOU1CSktZQlFmLy9BU1M5QVNPc0FVVUVRRUVBSkpFQkN3c1RBQ0FBUVFSMVFRZHhKRThnQUVFSGNTUlFDMElBUVFjZ0FCQVlKRlJCQmlBQUVCZ2tVMEVGSUFBUUdDUlNRUVFnQUJBWUpGRkJBeUFBRUJna1dFRUNJQUFRR0NSWFFRRWdBQkFZSkZaQkFDQUFFQmdrVlFzS0FFRUhJQUFRR0NSWkMvMENBUUYvQWtBZ0FFR20vZ05ISWdJRVFDTlpSU0VDQ3lBQ0JFQkJBQThMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQWtHUS9nTkhCRUFDUUNBQ1FaSCtBMnNPRmdNSEN3OEFCQWdNRUFJRkNRMFJBQVlLRGhJVEZCVUFDd3dWQ3lBQkVHa01GUXNnQVJCcURCUUxJQUVRYXd3VEN5QUJFR3dNRWdzZ0FSQnREQkVMSUFFUWJnd1FDeUFCRUc4TUR3c2dBUkJ3REE0TFFRRWtYaUFCRUhFTURRc2dBUkJ5REF3TElBRVFjd3dMQ3lBQkVIUU1DZ3NnQVJCMURBa0xJQUVRZGd3SUMwRUhJQUVRR0FSQUlBRVFkeEI0Q3d3SEMwRUhJQUVRR0FSQUlBRVFlUkI2Q3d3R0MwRUhJQUVRR0FSQUlBRVFleEI4Q3d3RkMwRUhJQUVRR0FSQUlBRVFmUkIrQ3d3RUN5QUJFSDlCQVNScERBTUxJQUVRZ0FGQkFTUnFEQUlMSUFFUWdRRkJCeUFCRUJoRkJFQUNRRUdRL2dNaEFnTkFJQUpCcHY0RFRnMEJJQUpCQUJBR0lBSkJBV29oQWd3QUFBc0FDd3NNQVF0QkFROExRUUVMUWdCQkJ5QUFFQmdrZFVFR0lBQVFHQ1I4UVFVZ0FCQVlKSHRCQkNBQUVCZ2tka0VESUFBUUdDUjRRUUlnQUJBWUpINUJBU0FBRUJna2ZVRUFJQUFRR0NSM0N6MEJBWDhnQUVFSWRDRUJBa0JCQUNFQUEwQWdBRUdmQVVvTkFTQUFRWUQ4QTJvZ0FTQUFhaEFERUFZZ0FFRUJhaUVBREFBQUN3QUxRWVFGSkhRTEV3QWoyd0VRQXlQY0FSQURFQ05COFA4RGNRc1hBQ1BkQVJBREk5NEJFQU1RSTBId1AzRkJnSUFDYWd1TEFRRURmeU12UlFSQUR3c2pnZ0VFZjBFSElBQVFHRVVGSTRJQkN5SUJCRUJCQUNTQ0FTUGFBUkFESVFFajJnRkJCeUFCRUI0UUJnOExFSVVCSVFFUWhnRWhBa0VISUFBUUhVRUJha0VFZENFRFFRY2dBQkFZQkVCQkFTU0NBU0FESklNQklBRWtoQUVnQWlTRkFTUGFBVUVISUFBUUhSQUdCU0FCSUFJZ0F4Q2FBU1BhQVVIL0FSQUdDd3NtQVFGL0lBQkJQM0VoQXlBQ1FRRnhCRUFnQTBGQWF5RURDeUFEUVlDUUJHb2dBVG9BQUFzWUFFRUhJQUFRR0FSQUlBRkJCeUFBUVFGcUVCNFFCZ3NMU2dFQ2Z5QUFJK0VCUmlJQ1JRUkFJQUFqNEFGR0lRSUxJQUlFUUVFR0lBQkJBV3NRQXhBZElRSWdBQ1BnQVVZRVFFRUJJUU1MSUFJZ0FTQURFSWdCSUFJZ0FFRUJheENKQVFzTEN3QkJBU1RpQVVFQ0VEWUxQQUVCZndKQUFrQUNRQUpBSUFBRVFDQUFJZ0ZCQVVZTkFTQUJRUUpHRFFJZ0FVRURSZzBEREFRTFFRa1BDMEVERHd0QkJROExRUWNQQzBFQUN5Y0JBWDhqY1JDTUFTSUNJQUFRR0NJQUJFQWdBaUFCRUJoRklRQUxJQUFFUUVFQkR3dEJBQXNhQUNOdVFRRnFKRzRqYmtIL0FVb0VRRUVCSkhKQkFDUnVDd3RtQVFKL0EwQWdBU0FBU0FSQUkyMGhBaUFCUVFScUlRRWpiVUVFYWlSdEkyMUIvLzhEU2dSQUkyMUJnSUFFYXlSdEN5TndCRUFqY2dSQUkyOGtiaENMQVVFQUpISkJBU1J6QlNOekJFQkJBQ1J6Q3dzZ0FpTnRFSTBCQkVBUWpnRUxDd3dCQ3dzTEN3QWpiQkNQQVVFQUpHd0xLUUFqYlNFQVFRQWtiVUdFL2dOQkFCQUdJM0FFZnlBQUkyMFFqUUVGSTNBTElnQUVRQkNPQVFzTEdnQWpjQVJBSTNNRVFBOExJM0lFUUVFQUpISUxDeUFBSkc0TEd3QWdBQ1J2STNBRWZ5TnpCU053Q3dSQUkyOGtia0VBSkhNTEMxZ0JBbjhqY0NFQlFRSWdBQkFZSkhBZ0FFRURjU0VDSUFGRkJFQWpjUkNNQVNFQUlBSVFqQUVoQVNOd0JFQWdBQ050RUJnaEFBVWdBQ050RUJnaUFBUkFJQUVqYlJBWUlRQUxDeUFBQkVBUWpnRUxDeUFDSkhFTEh3QWdBRUgvQVhNa3dRRkJCQ1BCQVJBWUpNSUJRUVVqd1FFUUdDVEhBUXNyQUVFQUlBQVFHQ1RqQVVFQklBQVFHQ1NBQVVFQ0lBQVFHQ1RpQVVFRUlBQVFHQ1RrQVNBQUpJRUJDeXNBUVFBZ0FCQVlKT1VCUVFFZ0FCQVlKT1lCUVFJZ0FCQVlKT2NCUVFRZ0FCQVlKT2dCSUFBazZRRUxxUVVCQVg4Q1FBSkFJQUJCZ0lBQ1NBUkFJQUFnQVJCb0RBSUxJQUJCZ0lBQ1RpSUNCRUFnQUVHQXdBSklJUUlMSUFJTkFDQUFRWURBQTA0aUFnUkFJQUJCZ1B3RFNDRUNDeUFDQkVBZ0FFR0FRR29nQVJBR0RBRUxJQUJCZ1B3RFRpSUNCRUFnQUVHZi9RTk1JUUlMSUFJRVFDTi9RUUpJRFFJTUFRc2dBRUdnL1FOT0lnSUVRQ0FBUWYvOUEwd2hBZ3NnQWcwQklBQkJrUDREVGlJQ0JFQWdBRUdtL2dOTUlRSUxJQUlFUUJCaklBQWdBUkNDQVE4TElBQkJzUDREVGlJQ0JFQWdBRUcvL2dOTUlRSUxJQUlFUUJCakN5QUFRY0QrQTA0aUFnUkFJQUJCeS80RFRDRUNDeUFDQkVBZ0FFSEEvZ05HQkVBZ0FSQ0RBUXdDQ3lBQVFjVCtBMFlFUUVFQUpFa2dBRUVBRUFZTUF3c2dBRUhGL2dOR0JFQWdBU1RaQVF3Q0N5QUFRY2IrQTBZRVFDQUJFSVFCREFJTEFrQUNRQUpBQWtBZ0FDSUNRY1ArQTBjRVFBSkFJQUpCd3Y0RGF3NEtBZ0FBQUFBQUFBQUVBd0FMREFRTElBRWtTZ3dGQ3lBQkpFc01CQXNnQVNSTURBTUxJQUVrVFF3Q0N3d0JDeUFBSTlvQlJnUkFJQUVRaHdFTUFnc2dBQ015UmlJQ1JRUkFJQUFqTUVZaEFnc2dBZ1JBSTRJQkJFQWpoQUZCZ0lBQlRpSUNCRUFqaEFGQi8vOEJUQ0VDQ3lBQ1JRUkFJNFFCUVlDZ0EwNGlBZ1JBSTRRQlFmKy9BMHdoQWdzTElBSU5Bd3NMSUFBajN3Rk9JZ0lFUUNBQUkrQUJUQ0VDQ3lBQ0JFQWdBQ0FCRUlvQkRBRUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQ1FBUUpBQWtBQ1FBSkFJQUFpQWtHRS9nTkhCRUFDUUNBQ1FZWCtBMnNPQXdJREJBQUxEQVFMSUFFUWtRRU1CZ3NnQVJDU0FRd0VDeUFCRUpNQkRBTUxJQUVRbEFFTUFnc01BUXNnQUVHQS9nTkdCRUFnQVJDVkFRc2dBRUdQL2dOR0JFQWdBUkNXQVF3QkN5QUFRZi8vQTBZRVFDQUJFSmNCREFFTFFRRVBDMEVCRHd0QkFBc1NBQ0FBSUFFUW1BRUVRQ0FBSUFFUUJnc0xaUUVEZndKQUEwQWdBeUFDVGcwQklBQWdBMm9RWnlFRklBRWdBMm9oQkFOQUlBUkIvNzhDU2dSQUlBUkJnRUJxSVFRTUFRc0xJQVFnQlJDWkFTQURRUUZxSVFNTUFBQUxBQXRCSUNFREl6TUVRRUhBQUNFREN5TjBJQU1nQWtFUWJXeHFKSFFMYlFFQmZ5T0NBVVVFUUE4TFFSQWhBQ09EQVVFUVNBUkFJNE1CSVFBTEk0UUJJNFVCSUFBUW1nRWpoQUVnQUdva2hBRWpoUUVnQUdva2hRRWpnd0VnQUdza2d3RWpnd0ZCQUV3RVFFRUFKSUlCSTlvQlFmOEJFQVlGSTlvQlFRY2pnd0ZCRUcxQkFXc1FIUkFHQ3dzTEFFRUJKT01CUVFBUU5ndlBBZ0VGZnlOMVJRUkFRUUFrU0VFQUpFbEJ4UDREUVFBUUJrRUFRUUZCd2Y0REVBTVFIUkFkSVFOQkFDUi9RY0grQXlBREVBWVBDeU4vSVFFalNTSURRWkFCVGdSQVFRRWhBZ1VqU0JBMFRnUkFRUUloQWdValNCQTFUZ1JBUVFNaEFnc0xDeUFCSUFKSEJFQkJ3ZjRERUFNaEFDQUNKSDlCQUNFQkFrQUNRQUpBQWtBQ1FDQUNJUVFnQWtVTkFBSkFJQVJCQVdzT0F3SURCQUFMREFRTFFRTkJBVUVBSUFBUUhSQWRJZ0FRR0NFQkRBTUxRUVJCQUVFQklBQVFIUkFlSWdBUUdDRUJEQUlMUVFWQkFVRUFJQUFRSFJBZUlnQVFHQ0VCREFFTFFRRkJBQ0FBRUI0UUhpRUFDeUFCQkVBUU53c2dBa1VFUUJDYkFRc2dBa0VCUmdSQUVKd0JDeVBaQVNFRUlBSkZJZ0ZGQkVBZ0FrRUJSaUVCQ3lBQkJFQWdBeUFFUmlFQkN5QUJCRUJCQmtFQ0lBQVFIaUlBRUJnRVFCQTNDd1ZCQWlBQUVCMGhBQXRCd2Y0RElBQVFCZ3NMYXdFQmZ5TjFCRUFqU0NBQWFpUklBMEFqU0JBVlRnUkFJMGdRRldza1NDTkpJZ0ZCa0FGR0JFQWpLUVJBRURFRklBRVFNQXNRTWhBekJTQUJRWkFCU0FSQUl5bEZCRUFnQVJBd0N3c0xJQUZCbVFGS0JIOUJBQVVnQVVFQmFnc2lBU1JKREFFTEN3c1FuUUVMSkFBalJ4QVdTQVJBRHdzRFFDTkhFQlpPQkVBUUZoQ2VBU05IRUJackpFY01BUXNMQzEwQUkzUkJBRW9FUUNBQUkzUnFJUUJCQUNSMEN5TStJQUJxSkQ0alFFVUVRQ01uQkVBalJ5QUFhaVJIRUo4QkJTQUFFSjRCQ3lNbUJFQWpUaUFBYWlST0JTQUFFR0lMQ3lNb0JFQWpiQ0FBYWlSc0VKQUJCU0FBRUk4QkN3c1FBRUVFRUtBQkl6MUJBV29RRkJBREN3c0FRUVFRb0FFalBSQURDeElBRUtFQlFmOEJjUkNpQVVIL0FYRVFJd3NPQUVFRUVLQUJJQUFnQVJDWkFRc3VBUUYvUVFFZ0FIUVFZQ0VDSUFGQkFFb0VRQ003SUFKeVFmOEJjU1E3QlNNN0lBSkIvd0Z6Y1NRN0N5TTdDd29BUVFVZ0FCQ2xBUm9MVFFBZ0FVRUFUZ1JBSUFCQkQzRWdBVUVQY1dvUVlFRVFjUVJBUVFFUXBnRUZRUUFRcGdFTEJTQUJRUUFnQVdzZ0FVRUFTaHRCRDNFZ0FFRVBjVXNFUUVFQkVLWUJCVUVBRUtZQkN3c0xDZ0JCQnlBQUVLVUJHZ3NLQUVFR0lBQVFwUUVhQ3dvQVFRUWdBQkNsQVJvTEV3QWdBRUVCZENBQVFmOEJjVUVIZG5JUVlBczFBUUovSUFFUVh5RUNJQUJCQVdvaEF5QUFJQUVRWUNJQkVKZ0JCRUFnQUNBQkVBWUxJQU1nQWhDWUFRUkFJQU1nQWhBR0N3c09BRUVJRUtBQklBQWdBUkNzQVF1REFRQWdBa0VCY1FSQUlBQkIvLzhEY1NJQUlBRnFJUUlnQUNBQmN5QUNjeUlDUVJCeEJFQkJBUkNtQVFWQkFCQ21BUXNnQWtHQUFuRUVRRUVCRUtvQkJVRUFFS29CQ3dVZ0FDQUJhaEFVSWdJZ0FFSC8vd054U1FSQVFRRVFxZ0VGUVFBUXFnRUxJQUFnQVhNZ0FuTkJnQ0J4RUJRRVFFRUJFS1lCQlVFQUVLWUJDd3NMQ3dCQkJCQ2dBU0FBRUdjTEV3QWdBRUgvQVhGQkFYWWdBRUVIZEhJUVlBdklCQUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN3d1VDeENqQVVILy93TnhJZ0FRWDBIL0FYRWtOU0FBRUdCQi93RnhKRFlNRUFzak5TTTJFQ01qTkJDa0FRd1NDeU0xSXpZUUkwRUJha0gvL3dOeElnQVFYMEgvQVhFa05Rd05DeU0xUVFFUXB3RWpOVUVCYWhCZ0pEVWpOUVJBUVFBUXFBRUZRUUVRcUFFTFFRQVFxUUVNRUFzak5VRi9FS2NCSXpWQkFXc1FZQ1ExSXpVRVFFRUFFS2dCQlVFQkVLZ0JDMEVCRUtrQkRBOExFS0lCUWY4QmNTUTFEQXdMSXpSQmdBRnhRWUFCUmdSQVFRRVFxZ0VGUVFBUXFnRUxJelFRcXdFa05Bd01DeENqQVVILy93TnhJendRclFFTUNRc2pPU002RUNNaUFDTTFJellRSXlJQlFmLy9BM0ZCQUJDdUFTQUFJQUZxRUJRaUFCQmZRZjhCY1NRNUlBQVFZRUgvQVhFa09rRUFFS2tCUVFnUEN5TTFJellRSXhDdkFVSC9BWEVrTkF3S0N5TTFJellRSTBFQmF4QVVJZ0FRWDBIL0FYRWtOUXdGQ3lNMlFRRVFwd0VqTmtFQmFoQmdKRFlqTmdSQVFRQVFxQUVGUVFFUXFBRUxRUUFRcVFFTUNBc2pOa0YvRUtjQkl6WkJBV3NRWUNRMkl6WUVRRUVBRUtnQkJVRUJFS2dCQzBFQkVLa0JEQWNMRUtJQlFmOEJjU1EyREFRTEl6UkJBWEZCQUVzRVFFRUJFS29CQlVFQUVLb0JDeU0wRUxBQkpEUU1CQXRCZnc4TElBQVFZRUgvQVhFa05rRUlEd3NqUFVFQ2FoQVVKRDBNQWdzalBVRUJhaEFVSkQwTUFRdEJBQkNvQVVFQUVLa0JRUUFRcGdFTFFRUUxDZ0FqTzBFRWRrRUJjUXNOQUNBQVFRRjBFTElCY2hCZ0N5Z0JBWDlCQnlBQVFSaDBRUmgxSWdFUUdBUkFRWUFDSUFCQkdIUkJHSFZyUVg5c0lRRUxJQUVMSXdFQmZ5QUFFTFFCSVFFalBTQUJRUmgwUVJoMWFoQVVKRDBqUFVFQmFoQVVKRDBMRkFBZ0FFSC9BWEZCQVhZUXNnRkJCM1J5RUdBTG1nVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJFRWNFUUFKQUlBQkJFV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl5OEVRRUVBUWMzK0F4Q3ZBVUgvQVhFaUFCQVlCRUJCemY0RFFRZEJBQ0FBRUIwaUFCQVlCSDlCQUNRelFRY2dBQkFkQlVFQkpETkJCeUFBRUI0TElnQVFwQUZCeEFBUEN3dEJBU1JBREJFTEVLTUJRZi8vQTNFaUFCQmZRZjhCY1NRM0lBQVFZRUgvQVhFa09DTTlRUUpxRUJRa1BRd1NDeU0zSXpnUUl5TTBFS1FCREJFTEl6Y2pPQkFqUVFGcUVCUWlBQkJmUWY4QmNTUTNEQTBMSXpkQkFSQ25BU00zUVFGcUVHQWtOeU0zQkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVF3UEN5TTNRWDhRcHdFak4wRUJheEJnSkRjak53UkFRUUFRcUFFRlFRRVFxQUVMUVFFUXFRRU1EZ3NRb2dGQi93RnhKRGNNQ3d0QkFDRUFJelJCZ0FGeFFZQUJSZ1JBUVFFaEFBc2pOQkN6QVNRMERBc0xFS0lCRUxVQlFRZ1BDeU01SXpvUUl5SUFJemNqT0JBaklnRkIvLzhEY1VFQUVLNEJJQUFnQVdvUUZDSUFFRjlCL3dGeEpEa2dBQkJnUWY4QmNTUTZRUUFRcVFGQkNBOExJemNqT0JBalFmLy9BM0VRcndGQi93RnhKRFFNQ1Fzak55TTRFQ05CQVdzUUZDSUFFRjlCL3dGeEpEY01CUXNqT0VFQkVLY0JJemhCQVdvUVlDUTRJemdFUUVFQUVLZ0JCVUVCRUtnQkMwRUFFS2tCREFjTEl6aEJmeENuQVNNNFFRRnJFR0FrT0NNNEJFQkJBQkNvQVFWQkFSQ29BUXRCQVJDcEFRd0dDeENpQVVIL0FYRWtPQXdEQzBFQUlRQWpORUVCY1VFQlJnUkFRUUVoQUFzak5CQzJBU1EwREFNTFFYOFBDeUFBRUdCQi93RnhKRGhCQ0E4TEl6MUJBV29RRkNROURBRUxJQUFFUUVFQkVLb0JCVUVBRUtvQkMwRUFFS2dCUVFBUXFRRkJBQkNtQVF0QkJBc0tBQ003UVFkMlFRRnhDd29BSXp0QkJYWkJBWEVMQ2dBak8wRUdka0VCY1F2MkJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVNCSEJFQUNRQ0FBUVNGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeEM0QVFSQUl6MUJBV29RRkNROUJSQ2lBUkMxQVF0QkNBOExFS01CUWYvL0EzRWlBQkJmUWY4QmNTUTVJQUFRWUVIL0FYRWtPaU05UVFKcUVCUWtQUXdRQ3lNNUl6b1FJeUlBUWYvL0EzRWpOQkNrQVNBQVFRRnFFQlFpQUJCZlFmOEJjU1E1SUFBUVlFSC9BWEVrT2d3UEN5TTVJem9RSTBFQmFoQVVJZ0FRWDBIL0FYRWtPU0FBRUdCQi93RnhKRHBCQ0E4TEl6bEJBUkNuQVNNNVFRRnFFR0FrT1NNNUJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFRd05DeU01UVg4UXB3RWpPVUVCYXhCZ0pEa2pPUVJBUVFBUXFBRUZRUUVRcUFFTFFRRVFxUUVNREFzUW9nRkIvd0Z4SkRrTUNnc1F1UUZCQUVzRVFFRUdJUUVMRUxJQlFRQkxCRUFnQVVIZ0FISWhBUXNRdWdGQkFFc0VmeU0wSUFGckVHQUZJelJCRDNGQkNVc0VRQ0FCUVFaeUlRRUxJelJCbVFGTEJFQWdBVUhnQUhJaEFRc2pOQ0FCYWhCZ0N5SUFCRUJCQUJDb0FRVkJBUkNvQVFzZ0FVSGdBSEVFUUVFQkVLb0JCVUVBRUtvQkMwRUFFS1lCSUFBa05Bd0tDeEM0QVVFQVN3UkFFS0lCRUxVQkJTTTlRUUZxRUJRa1BRdEJDQThMSXprak9oQWpJZ0VnQVVILy93TnhRUUFRcmdFZ0FVRUJkQkFVSWdFUVgwSC9BWEVrT1NBQkVHQkIvd0Z4SkRwQkFCQ3BBVUVJRHdzak9TTTZFQ01pQVVILy93TnhFSzhCUWY4QmNTUTBJQUZCQVdvUUZDSUJFRjlCL3dGeEpEa2dBUkJnUWY4QmNTUTZEQWNMSXprak9oQWpRUUZyRUJRaUFSQmZRZjhCY1NRNUlBRVFZRUgvQVhFa09rRUlEd3NqT2tFQkVLY0JJenBCQVdvUVlDUTZJem9FUUVFQUVLZ0JCVUVCRUtnQkMwRUFFS2tCREFVTEl6cEJmeENuQVNNNlFRRnJFR0FrT2lNNkJFQkJBQkNvQVFWQkFSQ29BUXRCQVJDcEFRd0VDeENpQVVIL0FYRWtPZ3dDQ3lNMFFYOXpRZjhCY1NRMFFRRVFxUUZCQVJDbUFRd0NDMEYvRHdzalBVRUJhaEFVSkQwTFFRUUw2QVFCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCTUVjRVFBSkFJQUJCTVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxFTElCQkVBalBVRUJhaEFVSkQwRkVLSUJFTFVCQzBFSUR3c1Fvd0ZCLy84RGNTUThJejFCQW1vUUZDUTlEQklMSXprak9oQWpJZ0JCLy84RGNTTTBFS1FCREJBTEl6eEJBV29RRkNROFFRZ1BDeU01SXpvUUl5SUFRZi8vQTNFUXJ3RWlBVUVCRUtjQklBRkJBV29RWUNJQkJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFRd05DeU01SXpvUUl5SUFRZi8vQTNFUXJ3RWlBVUYvRUtjQklBRkJBV3NRWUNJQkJFQkJBQkNvQVFWQkFSQ29BUXRCQVJDcEFRd01DeU01SXpvUUkwSC8vd054RUtJQlFmOEJjUkNrQVF3S0MwRUFFS2tCUVFBUXBnRkJBUkNxQVF3TUN4Q3lBVUVCUmdSQUVLSUJFTFVCQlNNOVFRRnFFQlFrUFF0QkNBOExJemtqT2hBaklnRWpQRUVBRUs0QklBRWpQR29RRkNJQUVGOUIvd0Z4SkRrZ0FCQmdRZjhCY1NRNlFRQVFxUUZCQ0E4TEl6a2pPaEFqSWdCQi8vOERjUkN2QVVIL0FYRWtOQXdJQ3lNOFFRRnJFQlFrUEVFSUR3c2pORUVCRUtjQkl6UkJBV29RWUNRMEl6UUVRRUVBRUtnQkJVRUJFS2dCQzBFQUVLa0JEQWNMSXpSQmZ4Q25BU00wUVFGckVHQWtOQ00wQkVCQkFCQ29BUVZCQVJDb0FRdEJBUkNwQVF3R0N4Q2lBVUgvQVhFa05Bd0NDMEVBRUtrQlFRQVFwZ0VRc2dGQkFFc0VRRUVBRUtvQkJVRUJFS29CQ3d3RUMwRi9Ed3NqUFVFQmFoQVVKRDBNQWdzZ0FFSC8vd054SUFFUXBBRU1BUXNnQUVFQmF4QVVJZ0FRWDBIL0FYRWtPU0FBRUdCQi93RnhKRG9MUVFRTDJRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCd0FCSEJFQWdBQ0lCUWNFQVJnMEJBa0FnQVVIQ0FHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNNRUFzak5pUTFEQThMSXpja05Rd09DeU00SkRVTURRc2pPU1ExREF3TEl6b2tOUXdMQ3lNNUl6b1FJeEN2QVVIL0FYRWtOUXdLQ3lNMEpEVU1DUXNqTlNRMkRBZ0xEQWNMSXpja05nd0dDeU00SkRZTUJRc2pPU1EyREFRTEl6b2tOZ3dEQ3lNNUl6b1FJeEN2QVVIL0FYRWtOZ3dDQ3lNMEpEWU1BUXRCZnc4TFFRUUwyUUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBQkhCRUFnQUNJQlFkRUFSZzBCQWtBZ0FVSFNBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5TUTNEQkFMSXpZa053d1BDd3dPQ3lNNEpEY01EUXNqT1NRM0RBd0xJem9rTnd3TEN5TTVJem9RSXhDdkFVSC9BWEVrTnd3S0N5TTBKRGNNQ1Fzak5TUTREQWdMSXpZa09Bd0hDeU0zSkRnTUJnc01CUXNqT1NRNERBUUxJem9rT0F3REN5TTVJem9RSXhDdkFVSC9BWEVrT0F3Q0N5TTBKRGdNQVF0QmZ3OExRUVFMMlFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUJIQkVBZ0FDSUJRZUVBUmcwQkFrQWdBVUhpQUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOU1E1REJBTEl6WWtPUXdQQ3lNM0pEa01EZ3NqT0NRNURBMExEQXdMSXpva09Rd0xDeU01SXpvUUl4Q3ZBVUgvQVhFa09Rd0tDeU0wSkRrTUNRc2pOU1E2REFnTEl6WWtPZ3dIQ3lNM0pEb01CZ3NqT0NRNkRBVUxJemtrT2d3RUN3d0RDeU01SXpvUUl4Q3ZBVUgvQVhFa09nd0NDeU0wSkRvTUFRdEJmdzhMUVFRTGlnSUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCSEJFQWdBQ0lCUWZFQVJnMEJBa0FnQVVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqT1NNNkVDTWpOUkNrQVF3UUN5TTVJem9RSXlNMkVLUUJEQThMSXprak9oQWpJemNRcEFFTURnc2pPU002RUNNak9CQ2tBUXdOQ3lNNUl6b1FJeU01RUtRQkRBd0xJemtqT2hBakl6b1FwQUVNQ3dzamdnRkZCRUJCQVNRL0N3d0tDeU01SXpvUUl5TTBFS1FCREFrTEl6VWtOQXdJQ3lNMkpEUU1Cd3NqTnlRMERBWUxJemdrTkF3RkN5TTVKRFFNQkFzak9pUTBEQU1MSXprak9oQWpFSzhCUWY4QmNTUTBEQUlMREFFTFFYOFBDMEVFQzBrQUlBRkJBRTRFUUNBQVFmOEJjU0FBSUFGcUVHQkxCRUJCQVJDcUFRVkJBQkNxQVFzRklBRkJBQ0FCYXlBQlFRQktHeUFBUWY4QmNVb0VRRUVCRUtvQkJVRUFFS29CQ3dzTE5nRUJmeU0wSUFCQi93RnhJZ0VRcHdFak5DQUJFTUVCSXpRZ0FHb1FZQ1EwSXpRRVFFRUFFS2dCQlVFQkVLZ0JDMEVBRUtrQkMya0JBWDhqTkNBQWFoQ3lBV29RWUNFQkl6UWdBSE1nQVhNUVlFRVFjUVJBUVFFUXBnRUZRUUFRcGdFTEl6UWdBRUgvQVhGcUVMSUJhaEFVUVlBQ2NVRUFTd1JBUVFFUXFnRUZRUUFRcWdFTElBRWtOQ00wQkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVF2aUFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUVlBQlJ3UkFBa0FnQVVHQkFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXpVUXdnRU1FQXNqTmhEQ0FRd1BDeU0zRU1JQkRBNExJemdRd2dFTURRc2pPUkRDQVF3TUN5TTZFTUlCREFzTEl6a2pPaEFqRUs4QkVNSUJEQW9MSXpRUXdnRU1DUXNqTlJEREFRd0lDeU0yRU1NQkRBY0xJemNRd3dFTUJnc2pPQkREQVF3RkN5TTVFTU1CREFRTEl6b1F3d0VNQXdzak9TTTZFQ01RcndFUXd3RU1BZ3NqTkJEREFRd0JDMEYvRHd0QkJBczVBUUYvSXpRZ0FFSC9BWEZCZjJ3aUFSQ25BU00wSUFFUXdRRWpOQ0FBYXhCZ0pEUWpOQVJBUVFBUXFBRUZRUUVRcUFFTFFRRVFxUUVMYVFFQmZ5TTBJQUJyRUxJQmF4QmdJUUVqTkNBQWN5QUJjMEVRY1JCZ0JFQkJBUkNtQVFWQkFCQ21BUXNqTkNBQVFmOEJjV3NRc2dGckVCUkJnQUp4UVFCTEJFQkJBUkNxQVFWQkFCQ3FBUXNnQVNRMEl6UUVRRUVBRUtnQkJVRUJFS2dCQzBFQkVLa0JDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJrQUZIQkVBQ1FDQUJRWkVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkRGQVF3UUN5TTJFTVVCREE4TEl6Y1F4UUVNRGdzak9CREZBUXdOQ3lNNUVNVUJEQXdMSXpvUXhRRU1Dd3NqT1NNNkVDTVFyd0VReFFFTUNnc2pOQkRGQVF3SkN5TTFFTVlCREFnTEl6WVF4Z0VNQndzak54REdBUXdHQ3lNNEVNWUJEQVVMSXprUXhnRU1CQXNqT2hER0FRd0RDeU01SXpvUUl4Q3ZBUkRHQVF3Q0N5TTBFTVlCREFFTFFYOFBDMEVFQ3lnQUl6UWdBSEVrTkNNMEJFQkJBQkNvQVFWQkFSQ29BUXRCQUJDcEFVRUJFS1lCUVFBUXFnRUxLZ0FqTkNBQWN4QmdKRFFqTkFSQVFRQVFxQUVGUVFFUXFBRUxRUUFRcVFGQkFCQ21BVUVBRUtvQkMrSUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQm9BRkhCRUFDUUNBQlFhRUJhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5SRElBUXdRQ3lNMkVNZ0JEQThMSXpjUXlBRU1EZ3NqT0JESUFRd05DeU01RU1nQkRBd0xJem9ReUFFTUN3c2pPU002RUNNUXJ3RVF5QUVNQ2dzak5CRElBUXdKQ3lNMUVNa0JEQWdMSXpZUXlRRU1Cd3NqTnhESkFRd0dDeU00RU1rQkRBVUxJemtReVFFTUJBc2pPaERKQVF3REN5TTVJem9RSXhDdkFSREpBUXdDQ3lNMEVNa0JEQUVMUVg4UEMwRUVDeXdBSXpRZ0FISkIvd0Z4SkRRak5BUkFRUUFRcUFFRlFRRVFxQUVMUVFBUXFRRkJBQkNtQVVFQUVLb0JDek1CQVg4ak5DQUFRZjhCY1VGL2JDSUJFS2NCSXpRZ0FSREJBU00wSUFGcUJFQkJBQkNvQVFWQkFSQ29BUXRCQVJDcEFRdmlBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFiQUJSd1JBQWtBZ0FVR3hBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl6VVF5d0VNRUFzak5oRExBUXdQQ3lNM0VNc0JEQTRMSXpnUXl3RU1EUXNqT1JETEFRd01DeU02RU1zQkRBc0xJemtqT2hBakVLOEJFTXNCREFvTEl6UVF5d0VNQ1Fzak5SRE1BUXdJQ3lNMkVNd0JEQWNMSXpjUXpBRU1CZ3NqT0JETUFRd0ZDeU01RU13QkRBUUxJem9RekFFTUF3c2pPU002RUNNUXJ3RVF6QUVNQWdzak5CRE1BUXdCQzBGL0R3dEJCQXRBQVFKL0FrQUNRQ0FBRUdZaUFVRi9Sd1JBREFJTElBQVFBeUVCQ3dzQ1FBSkFJQUJCQVdvaUFoQm1JZ0JCZjBjTkFTQUNFQU1oQUFzTElBQWdBUkFqQ3d3QVFRZ1FvQUVnQUJET0FRczdBQ0FBUVlBQmNVR0FBVVlFUUVFQkVLb0JCVUVBRUtvQkN5QUFFS3NCSWdBRVFFRUFFS2dCQlVFQkVLZ0JDMEVBRUtrQlFRQVFwZ0VnQUFzNUFDQUFRUUZ4UVFCTEJFQkJBUkNxQVFWQkFCQ3FBUXNnQUJDd0FTSUFCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBVUVBRUtZQklBQUxTQUVCZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFBUXN3RWhBQ0FCQkVCQkFSQ3FBUVZCQUJDcUFRc2dBQVJBUVFBUXFBRUZRUUVRcUFFTFFRQVFxUUZCQUJDbUFTQUFDMFlCQVg4Z0FFRUJjVUVCUmdSQVFRRWhBUXNnQUJDMkFTRUFJQUVFUUVFQkVLb0JCVUVBRUtvQkN5QUFCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBVUVBRUtZQklBQUxTZ0VCZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFCQkFYUVFZQ0VBSUFFRVFFRUJFS29CQlVFQUVLb0JDeUFBQkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVVFQUVLWUJJQUFMYWdFQ2Z5QUFRWUFCY1VHQUFVWUVRRUVCSVFFTElBQkJBWEZCQVVZRVFFRUJJUUlMSUFCQi93RnhRUUYyRUdBaEFDQUJCRUFnQUVHQUFYSWhBQXNnQUFSQVFRQVFxQUVGUVFFUXFBRUxRUUFRcVFGQkFCQ21BU0FDQkVCQkFSQ3FBUVZCQUJDcUFRc2dBQXMzQUNBQVFROXhRUVIwSUFCQjhBRnhRUVIyY2hCZ0lnQUVRRUVBRUtnQkJVRUJFS2dCQzBFQUVLa0JRUUFRcGdGQkFCQ3FBU0FBQzBvQkFYOGdBRUVCY1VFQlJnUkFRUUVoQVFzZ0FFSC9BWEZCQVhZUVlDSUFCRUJCQUJDb0FRVkJBUkNvQVF0QkFCQ3BBVUVBRUtZQklBRUVRRUVCRUtvQkJVRUFFS29CQ3lBQUN5Z0FJQUZCQVNBQWRIRkIvd0Z4QkVCQkFCQ29BUVZCQVJDb0FRdEJBQkNwQVVFQkVLWUJJQUVMSUFBZ0FVRUFTZ1IvSUFKQkFTQUFkSElGSUFKQkFTQUFkRUYvYzNFTElnSUwyd2dCQjM5QmZ5RUdBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQ0c4aUJ5RUZJQWRGRFFBQ1FDQUZRUUZyRGdjQ0F3UUZCZ2NJQUFzTUNBc2pOU0VCREFjTEl6WWhBUXdHQ3lNM0lRRU1CUXNqT0NFQkRBUUxJemtoQVF3REN5TTZJUUVNQWdzak9TTTZFQ01RcndFaEFRd0JDeU0wSVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklRUWdCVVVOQUFKQUlBUkJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTElBQkJCMHdFUUNBQkVOQUJJUUpCQVNFREJTQUFRUTlNQkVBZ0FSRFJBU0VDUVFFaEF3c0xEQThMSUFCQkYwd0VRQ0FCRU5JQklRSkJBU0VEQlNBQVFSOU1CRUFnQVJEVEFTRUNRUUVoQXdzTERBNExJQUJCSjB3RVFDQUJFTlFCSVFKQkFTRURCU0FBUVM5TUJFQWdBUkRWQVNFQ1FRRWhBd3NMREEwTElBQkJOMHdFUUNBQkVOWUJJUUpCQVNFREJTQUFRVDlNQkVBZ0FSRFhBU0VDUVFFaEF3c0xEQXdMSUFCQnh3Qk1CRUJCQUNBQkVOZ0JJUUpCQVNFREJTQUFRYzhBVEFSQVFRRWdBUkRZQVNFQ1FRRWhBd3NMREFzTElBQkIxd0JNQkVCQkFpQUJFTmdCSVFKQkFTRURCU0FBUWQ4QVRBUkFRUU1nQVJEWUFTRUNRUUVoQXdzTERBb0xJQUJCNXdCTUJFQkJCQ0FCRU5nQklRSkJBU0VEQlNBQVFlOEFUQVJBUVFVZ0FSRFlBU0VDUVFFaEF3c0xEQWtMSUFCQjl3Qk1CRUJCQmlBQkVOZ0JJUUpCQVNFREJTQUFRZjhBVEFSQVFRY2dBUkRZQVNFQ1FRRWhBd3NMREFnTElBQkJod0ZNQkVCQkFFRUFJQUVRMlFFaEFrRUJJUU1GSUFCQmp3Rk1CRUJCQVVFQUlBRVEyUUVoQWtFQklRTUxDd3dIQ3lBQVFaY0JUQVJBUVFKQkFDQUJFTmtCSVFKQkFTRURCU0FBUVo4QlRBUkFRUU5CQUNBQkVOa0JJUUpCQVNFREN3c01CZ3NnQUVHbkFVd0VRRUVFUVFBZ0FSRFpBU0VDUVFFaEF3VWdBRUd2QVV3RVFFRUZRUUFnQVJEWkFTRUNRUUVoQXdzTERBVUxJQUJCdHdGTUJFQkJCa0VBSUFFUTJRRWhBa0VCSVFNRklBQkJ2d0ZNQkVCQkIwRUFJQUVRMlFFaEFrRUJJUU1MQ3d3RUN5QUFRY2NCVEFSQVFRQkJBU0FCRU5rQklRSkJBU0VEQlNBQVFjOEJUQVJBUVFGQkFTQUJFTmtCSVFKQkFTRURDd3NNQXdzZ0FFSFhBVXdFUUVFQ1FRRWdBUkRaQVNFQ1FRRWhBd1VnQUVIZkFVd0VRRUVEUVFFZ0FSRFpBU0VDUVFFaEF3c0xEQUlMSUFCQjV3Rk1CRUJCQkVFQklBRVEyUUVoQWtFQklRTUZJQUJCN3dGTUJFQkJCVUVCSUFFUTJRRWhBa0VCSVFNTEN3d0JDeUFBUWZjQlRBUkFRUVpCQVNBQkVOa0JJUUpCQVNFREJTQUFRZjhCVEFSQVFRZEJBU0FCRU5rQklRSkJBU0VEQ3dzTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBSElnUUVRQUpBSUFSQkFXc09Cd0lEQkFVR0J3Z0FDd3dJQ3lBQ0pEVU1Cd3NnQWlRMkRBWUxJQUlrTnd3RkN5QUNKRGdNQkFzZ0FpUTVEQU1MSUFJa09nd0NDeUFGUVFSSUlnUkZCRUFnQlVFSFNpRUVDeUFFQkVBak9TTTZFQ01nQWhDa0FRc01BUXNnQWlRMEN5QURCRUJCQkNFR0N5QUdDOUlEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRY0FCUndSQUFrQWdBVUhCQVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxFTGdCRFJJTUV3c2pQQkRQQVVILy93TnhJUUVqUEVFQ2FoQVVKRHdnQVJCZlFmOEJjU1ExSUFFUVlFSC9BWEVrTmtFRUR3c1F1QUVFUUF3VEJRd1FDd0FMREE0TEVMZ0JCRUFNRVFVTURRc0FDeU04UVFKckVCUWtQQ004SXpVak5oQWpFSzBCREEwTEVLSUJFTUlCREE4TEl6eEJBbXNRRkNROEl6d2pQUkN0QVVFQUpEME1Dd3NRdUFGQkFVY05DZ3dMQ3lNOEVNOEJRZi8vQTNFa1BTTThRUUpxRUJRa1BBd0pDeEM0QVVFQlJnUkFEQWdGREFzTEFBc1FvZ0ZCL3dGeEVOb0JJUUVqUFVFQmFoQVVKRDBnQVE4TEVMZ0JRUUZHQkVBalBFRUNheEFVSkR3alBDTTlRUUpxUWYvL0EzRVFyUUVNQmdVTUNRc0FDd3dEQ3hDaUFSRERBUXdIQ3lNOFFRSnJFQlFrUENNOEl6MFFyUUZCQ0NROURBTUxRWDhQQ3lNOFFRSnJFQlFrUENNOEl6MUJBbW9RRkJDdEFRc1Fvd0ZCLy84RGNTUTlDMEVJRHdzalBCRFBBVUgvL3dOeEpEMGpQRUVDYWhBVUpEeEJEQThMSXoxQkFtb1FGQ1E5UVF3UEN5TTlRUUZxRUJRa1BVRUVDd29BSUFCQkFYRWs2Z0VMcndNQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWRBQlJ3UkFBa0FnQVVIUkFXc09Ed0lEQUFRRkJnY0lDUW9BQ3dBTURRQUxEQTBMRUxJQkRRNE1Ed3NqUEJEUEFVSC8vd054SVFFalBFRUNhaEFVSkR3Z0FSQmZRZjhCY1NRM0lBRVFZRUgvQVhFa09FRUVEd3NRc2dFRVFBd1BCUXdNQ3dBTEVMSUJCRUFNRGdValBFRUNheEFVSkR3alBDTTlRUUpxUWYvL0EzRVFyUUVNQ3dzQUN5TThRUUpyRUJRa1BDTThJemNqT0JBakVLMEJEQW9MRUtJQkVNVUJEQXdMSXp4QkFtc1FGQ1E4SXp3alBSQ3RBVUVRSkQwTUNBc1FzZ0ZCQVVjTkJ3d0lDeU04RU04QlFmLy9BM0VrUFVFQkVOd0JJenhCQW1vUUZDUThEQVlMRUxJQlFRRkdCRUFNQlFVTUNBc0FDeEN5QVVFQlJnUkFJenhCQW1zUUZDUThJendqUFVFQ2FoQVVFSzBCREFRRkRBY0xBQXNRb2dFUXhnRU1CZ3NqUEVFQ2F4QVVKRHdqUENNOUVLMEJRUmdrUFF3Q0MwRi9Ed3NRb3dGQi8vOERjU1E5QzBFSUR3c2pQQkRQQVVILy93TnhKRDBqUEVFQ2FoQVVKRHhCREE4TEl6MUJBbW9RRkNROVFRd1BDeU05UVFGcUVCUWtQVUVFQzk0Q0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFlQUJSd1JBQWtBZ0FFSGhBV3NPRHdJREFBQUVCUVlIQ0FrQUFBQUtDd0FMREFzTEVLSUJRZjhCY1VHQS9nTnFJelFRcEFFTUN3c2pQQkRQQVVILy93TnhJUUFqUEVFQ2FoQVVKRHdnQUJCZlFmOEJjU1E1SUFBUVlFSC9BWEVrT2tFRUR3c2pOa0dBL2dOcUl6UVFwQUZCQkE4TEl6eEJBbXNRRkNROEl6d2pPU002RUNNUXJRRkJDQThMRUtJQkVNZ0JEQWNMSXp4QkFtc1FGQ1E4SXp3alBSQ3RBVUVnSkQxQkNBOExFS0lCRUxRQklRQWpQQ0FBUVJoMFFSaDFJZ0JCQVJDdUFTTThJQUJxRUJRa1BFRUFFS2dCUVFBUXFRRWpQVUVCYWhBVUpEMUJEQThMSXprak9oQWpRZi8vQTNFa1BVRUVEd3NRb3dGQi8vOERjU00wRUtRQkl6MUJBbW9RRkNROVFRUVBDeENpQVJESkFRd0NDeU04UVFKckVCUWtQQ004SXowUXJRRkJLQ1E5UVFnUEMwRi9Ed3NqUFVFQmFoQVVKRDFCQkF1TUF3QUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FVY0VRQUpBSUFCQjhRRnJEZzhDQXdRQUJRWUhDQWtLQ3dBQURBMEFDd3dOQ3hDaUFVSC9BWEZCZ1A0RGFoQ3ZBUkJnSkRRTURRc2pQQkRQQVVILy93TnhJUUFqUEVFQ2FoQVVKRHdnQUJCZlFmOEJjU1EwSUFBUVlFSC9BWEVrT3d3TkN5TTJRWUQrQTJvUXJ3RVFZQ1EwREF3TFFRQVEzQUVNQ3dzalBFRUNheEFVSkR3alBDTTBJenNRSXhDdEFVRUlEd3NRb2dFUXl3RU1DQXNqUEVFQ2F4QVVKRHdqUENNOUVLMEJRVEFrUFVFSUR3c1FvZ0VRdEFFaEFFRUFFS2dCUVFBUXFRRWpQQ0FBUVJoMFFSaDFJZ0JCQVJDdUFTTThJQUJxRUJRaUFCQmZRZjhCY1NRNUlBQVFZRUgvQVhFa09pTTlRUUZxRUJRa1BVRUlEd3NqT1NNNkVDTkIvLzhEY1NROFFRZ1BDeENqQVVILy93TnhFSzhCUWY4QmNTUTBJejFCQW1vUUZDUTlEQVVMUVFFUTNBRU1CQXNRb2dFUXpBRU1BZ3NqUEVFQ2F4QVVKRHdqUENNOUVLMEJRVGdrUFVFSUR3dEJmdzhMSXoxQkFXb1FGQ1E5QzBFRUM4Z0JBUUYvSXoxQkFXb1FGQ1E5QWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGR0RRRUNRQ0FCUVFKckRnMERCQVVHQndnSkNnc01EUTRQQUFzTUR3c2dBQkN4QVE4TElBQVF0d0VQQ3lBQUVMc0JEd3NnQUJDOEFROExJQUFRdlFFUEN5QUFFTDRCRHdzZ0FCQy9BUThMSUFBUXdBRVBDeUFBRU1RQkR3c2dBQkRIQVE4TElBQVF5Z0VQQ3lBQUVNMEJEd3NnQUJEYkFROExJQUFRM1FFUEN5QUFFTjRCRHdzZ0FCRGZBUXNNQUNPQkFTUHBBWEZCQUVvTEd3RUJmeUFCRUY4aEFpQUFJQUVRWUJBR0lBQkJBV29nQWhBR0M0TUJBUUYvUVFBUTNBRWdBRUdQL2dNUUF4QWRJZ0VrZ1FGQmovNERJQUVRQmlNOFFRSnJRZi8vQTNFa1BDTThJejBRNGdFQ1FBSkFBa0FDUUNBQUJFQUNRQ0FBUVFGckRnUUNBd0FFQUFzTUJBdEJBQ1RqQVVIQUFDUTlEQU1MUVFBa2dBRkJ5QUFrUFF3Q0MwRUFKT0lCUWRBQUpEME1BUXRCQUNUa0FVSGdBQ1E5Q3d1c0FRRUJmeVBxQVFSL0kra0JRUUJLQlNQcUFRc2lBQVJBSTRFQlFRQktJUUFMSUFBRVFFRUFJUUFqNVFFRWZ5UGpBUVVqNVFFTEJFQkJBQkRqQVVFQklRQUZJK1lCQkg4amdBRUZJK1lCQ3dSQVFRRVE0d0ZCQVNFQUJTUG5BUVIvSStJQkJTUG5BUXNFUUVFQ0VPTUJRUUVoQUFVajZBRUVmeVBrQVFVajZBRUxCRUJCQkJEakFVRUJJUUFMQ3dzTElBQUVRRUVVSVFBalB3UkFRUUFrUDBFWUlRQUxJQUFQQ3d0QkFBdUZBUUVDZjBFQkpDTkJCQ0VBSXo5RklnRUVRQ05BUlNFQkN5QUJCRUFqUFJBRFFmOEJjUkRnQVNFQUJTTS9CSDhqNmdGRkJTTS9DeUlCQkVBUTRRRWhBUXNnQVFSQVFRQWtQMEVBSkVBalBSQURRZjhCY1JEZ0FTRUFJejFCQVdzUUZDUTlDd3NqTzBId0FYRWtPeUFBUVFCTUJFQWdBQThMSUFBUTVBRnFJZ0FRb0FFZ0FBdEhBUUovQTBBZ0FFVWlBUVJBSXo0UUUwZ2hBUXNnQVFSQUVPVUJRUUJJQkVCQkFTRUFDd3dCQ3dzalBoQVRUZ1JBSXo0UUUyc2tQa0VBRHdzalBVRUJheEFVSkQxQmZ3c0VBQ05kQzNrQkFuOUJnQWdoQVNBQUJIOGdBRUVBU2dVZ0FBc0VRQ0FBSVFFTEEwQWdBa1VpQUFSQUl6NFFFMGdoQUFzZ0FBUkFFT2NCSUFGSUlRQUxJQUFFUUJEbEFVRUFTQVJBUVFFaEFnc01BUXNMSXo0UUUwNEVRQ00rRUJOckpENUJBQThMRU9jQklBRk9CRUJCQVE4TEl6MUJBV3NRRkNROVFYOExYZ0VDZndOQUlBSkZJZ0VFUUNNK0VCTklJUUVMSUFFRVFDTTlJQUJISVFFTElBRUVRQkRsQVVFQVNBUkFRUUVoQWdzTUFRc0xJejRRRTA0RVFDTStFQk5ySkQ1QkFBOExJejBnQUVZRVFFRUJEd3NqUFVFQmF4QVVKRDFCZndzT0FDQUFRWUFJYWlBQlFUSnNhZ3NaQUNBQlFRRnhCRUFnQUVFQk9nQUFCU0FBUVFBNkFBQUxDNTRCQUVFQVFRQVE2Z0VqTkRvQUFFRUJRUUFRNmdFak5Ub0FBRUVDUVFBUTZnRWpOam9BQUVFRFFRQVE2Z0VqTnpvQUFFRUVRUUFRNmdFak9Eb0FBRUVGUVFBUTZnRWpPVG9BQUVFR1FRQVE2Z0VqT2pvQUFFRUhRUUFRNmdFak96b0FBRUVJUVFBUTZnRWpQRHNCQUVFS1FRQVE2Z0VqUFRzQkFFRU1RUUFRNmdFalBqWUNBRUVSUVFBUTZnRWpQeERyQVVFU1FRQVE2Z0VqUUJEckFRc2lBRUVBUVFFUTZnRWpTRFlDQUVFRVFRRVE2Z0VqZnpvQUFFSEUvZ01qU1JBR0N4d0FRUUJCQWhEcUFTUHFBUkRyQVVFQlFRSVE2Z0VqNndFUTZ3RUxBd0FCQzI0QVFRQkJCQkRxQVNNdE93RUFRUUpCQkJEcUFTTXhPd0VBUVFSQkJCRHFBU05CRU9zQlFRVkJCQkRxQVNOQ0VPc0JRUVpCQkJEcUFTTkRFT3NCUVFkQkJCRHFBU05FRU9zQlFRaEJCQkRxQVNORkVPc0JRUWxCQkJEcUFTTkdFT3NCUVFwQkJCRHFBU011RU9zQkN6b0FRUUJCQlJEcUFTTnNOZ0lBUVFSQkJSRHFBU050TmdJQVFRaEJCUkRxQVNOeUVPc0JRUXRCQlJEcUFTTnpFT3NCUVlYK0F5TnVFQVlMSmdCQkFFRUdFT29CSTFvMkFnQkJCRUVHRU9vQkkxczZBQUJCQlVFR0VPb0JJMXc2QUFBTGhBRUFRUUJCQnhEcUFTT0lBUkRyQVVFQlFRY1E2Z0VqcUFFMkFnQkJCVUVIRU9vQkk1c0JOZ0lBUVFsQkJ4RHFBU09HQVRZQ0FFRU9RUWNRNmdFam5nRTJBZ0JCRTBFSEVPb0JJK3dCT2dBQVFSUkJCeERxQVNPekFUb0FBRUVaUVFjUTZnRWpsQUVRNndGQkdrRUhFT29CSTVJQk5nSUFRUjlCQnhEcUFTT1ZBVHNCQUF0ZEFFRUFRUWdRNmdFaml3RVE2d0ZCQVVFSUVPb0JJNjRCTmdJQVFRVkJDQkRxQVNPZkFUWUNBRUVKUVFnUTZnRWppUUUyQWdCQkRrRUlFT29CSTZJQk5nSUFRUk5CQ0JEcUFTUHRBVG9BQUVFVVFRZ1E2Z0VqdGdFNkFBQUxOZ0JCQUVFSkVPb0JJNDRCRU9zQlFRRkJDUkRxQVNPd0FUWUNBRUVGUVFrUTZnRWpqQUUyQWdCQkNVRUpFT29CSTdrQk93RUFDMUFBUVFCQkNoRHFBU09SQVJEckFVRUJRUW9RNmdFanNnRTJBZ0JCQlVFS0VPb0JJNk1CTmdJQVFRbEJDaERxQVNPUEFUWUNBRUVPUVFvUTZnRWpwZ0UyQWdCQkUwRUtFT29CSTcwQk93RUFDeWNBRU93QkVPMEJFTzRCRU84QkVQQUJFUEVCRVBJQkVQTUJFUFFCRVBVQkVQWUJRUUFrSXdzU0FDQUFMUUFBUVFCS0JFQkJBUThMUVFBTG5nRUFRUUJCQUJEcUFTMEFBQ1EwUVFGQkFCRHFBUzBBQUNRMVFRSkJBQkRxQVMwQUFDUTJRUU5CQUJEcUFTMEFBQ1EzUVFSQkFCRHFBUzBBQUNRNFFRVkJBQkRxQVMwQUFDUTVRUVpCQUJEcUFTMEFBQ1E2UVFkQkFCRHFBUzBBQUNRN1FRaEJBQkRxQVM4QkFDUThRUXBCQUJEcUFTOEJBQ1E5UVF4QkFCRHFBU2dDQUNRK1FSRkJBQkRxQVJENEFTUS9RUkpCQUJEcUFSRDRBU1JBQ3lzQVFRQkJBUkRxQVNnQ0FDUklRUVJCQVJEcUFTMEFBQ1IvUWNUK0F4QURKRWxCd1A0REVBTVFnd0VMTGdCQkFFRUNFT29CRVBnQkpPb0JRUUZCQWhEcUFSRDRBU1RyQVVILy93TVFBeENYQVVHUC9nTVFBeENXQVFzTEFFR0EvZ01RQXhDVkFRdHVBRUVBUVFRUTZnRXZBUUFrTFVFQ1FRUVE2Z0V2QVFBa01VRUVRUVFRNmdFUStBRWtRVUVGUVFRUTZnRVErQUVrUWtFR1FRUVE2Z0VRK0FFa1EwRUhRUVFRNmdFUStBRWtSRUVJUVFRUTZnRVErQUVrUlVFSlFRUVE2Z0VRK0FFa1JrRUtRUVFRNmdFUStBRWtMZ3RLQUVFQVFRVVE2Z0VvQWdBa2JFRUVRUVVRNmdFb0FnQWtiVUVJUVFVUTZnRVErQUVrY2tFTFFRVVE2Z0VRK0FFa2MwR0YvZ01RQXlSdVFZYitBeEFESkc5QmgvNERFQU1rY1FzR0FFRUFKRjBMS1FCQkFFRUdFT29CS0FJQUpGcEJCRUVHRU9vQkxRQUFKRnRCQlVFR0VPb0JMUUFBSkZ3US93RUxoQUVBUVFCQkJ4RHFBUkQ0QVNTSUFVRUJRUWNRNmdFb0FnQWtxQUZCQlVFSEVPb0JLQUlBSkpzQlFRbEJCeERxQVNnQ0FDU0dBVUVPUVFjUTZnRW9BZ0FrbmdGQkUwRUhFT29CTFFBQUpPd0JRUlJCQnhEcUFTMEFBQ1N6QVVFWlFRY1E2Z0VRK0FFa2xBRkJHa0VIRU9vQktBSUFKSklCUVI5QkJ4RHFBUzhCQUNTVkFRdGRBRUVBUVFnUTZnRVErQUVraXdGQkFVRUlFT29CS0FJQUpLNEJRUVZCQ0JEcUFTZ0NBQ1NmQVVFSlFRZ1E2Z0VvQWdBa2lRRkJEa0VJRU9vQktBSUFKS0lCUVJOQkNCRHFBUzBBQUNUdEFVRVVRUWdRNmdFdEFBQWt0Z0VMTmdCQkFFRUpFT29CRVBnQkpJNEJRUUZCQ1JEcUFTZ0NBQ1N3QVVFRlFRa1E2Z0VvQWdBa2pBRkJDVUVKRU9vQkx3RUFKTGtCQzFBQVFRQkJDaERxQVJENEFTU1JBVUVCUVFvUTZnRW9BZ0Frc2dGQkJVRUtFT29CS0FJQUpLTUJRUWxCQ2hEcUFTZ0NBQ1NQQVVFT1FRb1E2Z0VvQWdBa3BnRkJFMEVLRU9vQkx3RUFKTDBCQ3ljQUVQa0JFUG9CRVBzQkVQd0JFUDBCRVA0QkVJQUNFSUVDRUlJQ0VJTUNFSVFDUVFBa0l3c01BQ01qQkVCQkFROExRUUFMWHdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUFpQVVFQlJnMEJBa0FnQVVFQ2F3NEdBd1FGQmdjSUFBc01DQXNqd3dFUEN5UEVBUThMSThVQkR3c2p4Z0VQQ3lQSUFROExJOGtCRHdzanlnRVBDeVBMQVE4TFFRQUxpd0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFJZ0pCQVVZTkFRSkFJQUpCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJQUZCQVhFa3d3RU1Cd3NnQVVFQmNTVEVBUXdHQ3lBQlFRRnhKTVVCREFVTElBRkJBWEVreGdFTUJBc2dBVUVCY1NUSUFRd0RDeUFCUVFGeEpNa0JEQUlMSUFGQkFYRWt5Z0VNQVFzZ0FVRUJjU1RMQVFzTEN3QkJBU1RrQVVFRUVEWUxaQUVDZjBFQUpFQWdBQkNIQWtVRVFFRUJJUUVMSUFCQkFSQ0lBaUFCQkVCQkFDRUJJQUJCQTB3RVFFRUJJUUVMSThJQkJIOGdBUVVqd2dFTElnQUVRRUVCSVFJTEk4Y0JCSDhnQVVVRkk4Y0JDeUlBQkVCQkFTRUNDeUFDQkVBUWlRSUxDd3NKQUNBQVFRQVFpQUlMbWdFQUlBQkJBRW9FUUVFQUVJb0NCVUVBRUlzQ0N5QUJRUUJLQkVCQkFSQ0tBZ1ZCQVJDTEFnc2dBa0VBU2dSQVFRSVFpZ0lGUVFJUWl3SUxJQU5CQUVvRVFFRURFSW9DQlVFREVJc0NDeUFFUVFCS0JFQkJCQkNLQWdWQkJCQ0xBZ3NnQlVFQVNnUkFRUVVRaWdJRlFRVVFpd0lMSUFaQkFFb0VRRUVHRUlvQ0JVRUdFSXNDQ3lBSFFRQktCRUJCQnhDS0FnVkJCeENMQWdzTEJBQWpOQXNFQUNNMUN3UUFJellMQkFBak53c0VBQ000Q3dRQUl6a0xCQUFqT2dzRUFDTTdDd1FBSXowTEJBQWpQQXNHQUNNOUVBTUxCQUFqU1F1ZEF3RUtmMEdBa0FJaENTTjJCRUJCZ0lBQ0lRa0xRWUN3QWlFS0kzZ0VRRUdBdUFJaENnc0NRQU5BSUFSQmdBSk9EUUVDUUVFQUlRVURRQ0FGUVlBQ1RnMEJJQWtnQ2lBRVFRTjFRUVYwYWlBRlFRTjFhaUlHUVFBUUZ4QWhJUWdnQkVFSWJ5RUJRUWNnQlVFSWIyc2hCMEVBSVFJakx3Ui9JQUJCQUVvRkl5OExJZ01FUUNBR1FRRVFGeUVDQzBFR0lBSVFHQVJBUVFjZ0FXc2hBUXRCQUNFRFFRTWdBaEFZQkVCQkFTRURDeUFJSUFGQkFYUnFJZ1lnQXhBWElRaEJBQ0VCSUFjZ0JrRUJhaUFERUJjUUdBUkFRUUloQVFzZ0J5QUlFQmdFUUNBQlFRRnFJUUVMSUFSQkNIUWdCV3BCQTJ3aEJ5TXZCSDhnQUVFQVNnVWpMd3NpQXdSQVFRQWdBa0VIY1NBQlFRQVFKQ0lCRUNVaEJrRUJJQUVRSlNFRFFRSWdBUkFsSVFFZ0IwR0FtQTVxSWdJZ0Jqb0FBQ0FDUVFGcUlBTTZBQUFnQWtFQ2FpQUJPZ0FBQlNBQlFjZitBMEVBRUNZaEFnSkFRUUFoQVFOQUlBRkJBMDROQVNBSFFZQ1lEbW9nQVdvZ0Fqb0FBQ0FCUVFGcUlRRU1BQUFMQUFzTElBVkJBV29oQlF3QUFBc0FDeUFFUVFGcUlRUU1BQUFMQUFzTFJ3QUNRQUpBQWtBQ1FBSkFJKzRCUVFwckRnUUJBZ01FQUFzQUMwRUFJUW9MUVFBaEN3dEJmeUVNQ3lBQUlBRWdBaUFESUFRZ0JTQUdJQWNnQ0NBSklBb2dDeUFNRUNnTDJRRUJCbjhDUUFOQUlBSkJGMDROQVFKQVFRQWhBQU5BSUFCQkgwNE5BVUVBSVFRZ0FFRVBTZ1JBUVFFaEJBc2dBaUVCSUFKQkQwb0VRQ0FCUVE5cklRRUxJQUZCQkhRaEFTQUFRUTlLQkg4Z0FTQUFRUTlyYWdVZ0FTQUFhZ3NoQVVHQWdBSWhCU0FDUVE5S0JFQkJnSkFDSVFVTEFrQkJBQ0VEQTBBZ0EwRUlUZzBCUVFzazdnRWdBU0FGSUFSQkFFRUhJQU1nQUVFRGRDQUNRUU4wSUFOcVFmZ0JRWUNZR2tFQlFRQkJBQkNhQWhvZ0EwRUJhaUVEREFBQUN3QUxJQUJCQVdvaEFBd0FBQXNBQ3lBQ1FRRnFJUUlNQUFBTEFBc0xCQUFqYlFzRUFDTnVDd1FBSTI4TEZ3RUJmeU54SVFBamNBUkFRUUlnQUJBZUlRQUxJQUFMRkFBL0FFR0xBVWdFUUVHTEFUOEFhMEFBR2dzTEhRQUNRQUpBQWtBajdnRU9BZ0VDQUFzQUMwRUFJUUFMSUFBUW1RSUxCd0FnQUNUdUFRc0F4RjRFYm1GdFpRRzhYcU1DQUNWamIzSmxMMjFsYlc5eWVTOWlZVzVyYVc1bkwyZGxkRkp2YlVKaGJtdEJaR1J5WlhOekFTVmpiM0psTDIxbGJXOXllUzlpWVc1cmFXNW5MMmRsZEZKaGJVSmhibXRCWkdSeVpYTnpBamRqYjNKbEwyMWxiVzl5ZVM5dFpXMXZjbmxOWVhBdloyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQXlsamIzSmxMMjFsYlc5eWVTOXNiMkZrTDJWcFoyaDBRbWwwVEc5aFpFWnliMjFIUWsxbGJXOXllUVFhWTI5eVpTOWpjSFV2WTNCMUwybHVhWFJwWVd4cGVtVkRjSFVGSm1OdmNtVXZiV1Z0YjNKNUwyMWxiVzl5ZVM5cGJtbDBhV0ZzYVhwbFEyRnlkSEpwWkdkbEJpdGpiM0psTDIxbGJXOXllUzl6ZEc5eVpTOWxhV2RvZEVKcGRGTjBiM0psU1c1MGIwZENUV1Z0YjNKNUJ4MWpiM0psTDIxbGJXOXllUzlrYldFdmFXNXBkR2xoYkdsNlpVUnRZUWdwWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXBibWwwYVdGc2FYcGxSM0poY0docFkzTUpKMk52Y21VdlozSmhjR2hwWTNNdmNHRnNaWFIwWlM5cGJtbDBhV0ZzYVhwbFVHRnNaWFIwWlFvblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNXBibWwwYVdGc2FYcGxDeWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG1sdWFYUnBZV3hwZW1VTUoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVhVzVwZEdsaGJHbDZaUTBuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTkM5RGFHRnVibVZzTkM1cGJtbDBhV0ZzYVhwbERqRmpiM0psTDNOdmRXNWtMMkZqWTNWdGRXeGhkRzl5TDJsdWFYUnBZV3hwZW1WVGIzVnVaRUZqWTNWdGRXeGhkRzl5RHlCamIzSmxMM052ZFc1a0wzTnZkVzVrTDJsdWFYUnBZV3hwZW1WVGIzVnVaQkFqWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDJsdWFYUnBZV3hwZW1WVWFXMWxjbk1SRkdOdmNtVXZZMjl5WlM5cGJtbDBhV0ZzYVhwbEVoQmpiM0psTDJOdmNtVXZZMjl1Wm1sbkV5VmpiM0psTDJOd2RTOWpjSFV2UTNCMUxrMUJXRjlEV1VOTVJWTmZVRVZTWDBaU1FVMUZGQ0pqYjNKbEwzQnZjblJoWW14bEwzQnZjblJoWW14bEwzVXhObEJ2Y25SaFlteGxGVGRqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxrMUJXRjlEV1VOTVJWTmZVRVZTWDFORFFVNU1TVTVGRmpKamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMGR5WVhCb2FXTnpMbUpoZEdOb1VISnZZMlZ6YzBONVkyeGxjeGNuWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXNiMkZrUm5KdmJWWnlZVzFDWVc1ckdDRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZZMmhsWTJ0Q2FYUlBia0o1ZEdVWkoyTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012WjJWMFVtZGlVR2w0Wld4VGRHRnlkQm9tWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OXpaWFJRYVhobGJFOXVSbkpoYldVYkpHTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WjJWMFVHbDRaV3hUZEdGeWRCd3FZMjl5WlM5bmNtRndhR2xqY3k5d2NtbHZjbWwwZVM5blpYUlFjbWx2Y21sMGVXWnZjbEJwZUdWc0hTRmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZjbVZ6WlhSQ2FYUlBia0o1ZEdVZUgyTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXpaWFJDYVhSUGJrSjVkR1VmS21OdmNtVXZaM0poY0docFkzTXZjSEpwYjNKcGRIa3ZZV1JrVUhKcGIzSnBkSGxtYjNKUWFYaGxiQ0E2WTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGRNYVc1bFQyWlVhV3hsUm5KdmJWUnBiR1ZEWVdOb1pTRW1ZMjl5WlM5bmNtRndhR2xqY3k5MGFXeGxjeTluWlhSVWFXeGxSR0YwWVVGa1pISmxjM01pTTJOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOXNiMkZrVUdGc1pYUjBaVUo1ZEdWR2NtOXRWMkZ6YlUxbGJXOXllU01qWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDJOdmJtTmhkR1Z1WVhSbFFubDBaWE1rTEdOdmNtVXZaM0poY0docFkzTXZjR0ZzWlhSMFpTOW5aWFJTWjJKRGIyeHZja1p5YjIxUVlXeGxkSFJsSlM1amIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZaMlYwUTI5c2IzSkRiMjF3YjI1bGJuUkdjbTl0VW1kaUpqTmpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2WjJWMFRXOXViMk5vY205dFpVTnZiRzl5Um5KdmJWQmhiR1YwZEdVbkpXTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaMlYwVkdsc1pWQnBlR1ZzVTNSaGNuUW9MR052Y21VdlozSmhjR2hwWTNNdmRHbHNaWE12WkhKaGQxQnBlR1ZzYzBaeWIyMU1hVzVsVDJaVWFXeGxLVGRqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkMHhwYm1WUFpsUnBiR1ZHY205dFZHbHNaVWxrS2pkamIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDBOdmJHOXlVR2w0Wld4R2NtOXRWR2xzWlVsa0t6eGpiM0psTDJkeVlYQm9hV056TDJKaFkydG5jbTkxYm1SWGFXNWtiM2N2WkhKaGQwMXZibTlqYUhKdmJXVlFhWGhsYkVaeWIyMVVhV3hsU1dRc08yTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1FtRmphMmR5YjNWdVpGZHBibVJ2ZDFOallXNXNhVzVsTFM5amIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZjbVZ1WkdWeVFtRmphMmR5YjNWdVpDNHJZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDNKbGJtUmxjbGRwYm1SdmR5OGpZMjl5WlM5bmNtRndhR2xqY3k5emNISnBkR1Z6TDNKbGJtUmxjbE53Y21sMFpYTXdKR052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlgyUnlZWGRUWTJGdWJHbHVaVEVwWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OWZjbVZ1WkdWeVJXNTBhWEpsUm5KaGJXVXlKMk52Y21VdlozSmhjR2hwWTNNdmNISnBiM0pwZEhrdlkyeGxZWEpRY21sdmNtbDBlVTFoY0RNaVkyOXlaUzluY21Gd2FHbGpjeTkwYVd4bGN5OXlaWE5sZEZScGJHVkRZV05vWlRRN1kyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVOU1U1ZlExbERURVZUWDFOUVVrbFVSVk5mVEVORVgwMVBSRVUxUVdOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVUVWxPWDBOWlEweEZVMTlVVWtGT1UwWkZVbDlFUVZSQlgweERSRjlOVDBSRk5peGpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OWZjbVZ4ZFdWemRFbHVkR1Z5Y25Wd2REY3VZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRFeGpaRWx1ZEdWeWNuVndkRGdwWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlUYjNWdVpDNWlZWFJqYUZCeWIyTmxjM05EZVdOc1pYTTVMV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdWJXRjRSbkpoYldWVFpYRjFaVzVqWlVONVkyeGxjem9wWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1MWNHUmhkR1ZNWlc1bmRHZzdLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZFhCa1lYUmxUR1Z1WjNSb1BDbGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVeGxibWQwYUQwcFkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWTVpXNW5kR2crTEdOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdloyVjBUbVYzUm5KbGNYVmxibU41Um5KdmJWTjNaV1Z3UHlsamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuTmxkRVp5WlhGMVpXNWplVUF5WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5allXeGpkV3hoZEdWVGQyVmxjRUZ1WkVOb1pXTnJUM1psY21ac2IzZEJLR052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxVM2RsWlhCQ0syTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFJXNTJaV3h2Y0dWREsyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFJXNTJaV3h2Y0dWRUsyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkWEJrWVhSbFJXNTJaV3h2Y0dWRkpXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmRYQmtZWFJsUm5KaGJXVlRaWEYxWlc1alpYSkdMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1ZIS21OdmNtVXZjMjkxYm1RdllXTmpkVzExYkdGMGIzSXZaR2xrUTJoaGJtNWxiRVJoWTBOb1lXNW5aVWd1WTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1M2FXeHNRMmhoYm01bGJGVndaR0YwWlVrdVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTNhV3hzUTJoaGJtNWxiRlZ3WkdGMFpVb3VZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzUzYVd4c1EyaGhibTVsYkZWd1pHRjBaVXNuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1eVpYTmxkRlJwYldWeVREMWpiM0psTDNOdmRXNWtMMlIxZEhrdmFYTkVkWFI1UTNsamJHVkRiRzlqYTFCdmMybDBhWFpsVDNKT1pXZGhkR2wyWlVadmNsZGhkbVZtYjNKdFRTWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbWRsZEZOaGJYQnNaVTQyWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1blpYUlRZVzF3YkdWR2NtOXRRM2xqYkdWRGIzVnVkR1Z5VHlkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuSmxjMlYwVkdsdFpYSlFKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1WjJWMFUyRnRjR3hsVVRaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxtZGxkRk5oYlhCc1pVWnliMjFEZVdOc1pVTnZkVzUwWlhKU0oyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVjbVZ6WlhSVWFXMWxjbE1tWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1blpYUlRZVzF3YkdWVU5tTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVaMlYwVTJGdGNHeGxSbkp2YlVONVkyeGxRMjkxYm5SbGNsVTdZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVuWlhST2IybHpaVU5vWVc1dVpXeEdjbVZ4ZFdWdVkzbFFaWEpwYjJSV0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVaMlYwVTJGdGNHeGxWelpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG1kbGRGTmhiWEJzWlVaeWIyMURlV05zWlVOdmRXNTBaWEpZSEdOdmNtVXZZM0IxTDJOd2RTOURjSFV1UTB4UFEwdGZVMUJGUlVSWkttTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1YldGNFJHOTNibE5oYlhCc1pVTjVZMnhsYzFvaVkyOXlaUzl3YjNKMFlXSnNaUzl3YjNKMFlXSnNaUzlwTXpKUWIzSjBZV0pzWlZzb1kyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5blpYUlRZVzF3YkdWQmMxVnVjMmxuYm1Wa1FubDBaVndpWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzl0YVhoRGFHRnVibVZzVTJGdGNHeGxjMTB6WTI5eVpTOXpiM1Z1WkM5emIzVnVaQzl6WlhSTVpXWjBRVzVrVW1sbmFIUlBkWFJ3ZFhSR2IzSkJkV1JwYjFGMVpYVmxYaVpqYjNKbEwzTnZkVzVrTDJGalkzVnRkV3hoZEc5eUwyRmpZM1Z0ZFd4aGRHVlRiM1Z1WkY4Z1kyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzTndiR2wwU0dsbmFFSjVkR1ZnSDJOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5emNHeHBkRXh2ZDBKNWRHVmhIMk52Y21VdmMyOTFibVF2YzI5MWJtUXZZMkZzWTNWc1lYUmxVMjkxYm1SaUhHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdmRYQmtZWFJsVTI5MWJtUmpJbU52Y21VdmMyOTFibVF2YzI5MWJtUXZZbUYwWTJoUWNtOWpaWE56UVhWa2FXOWtLMk52Y21VdmMyOTFibVF2Y21WbmFYTjBaWEp6TDFOdmRXNWtVbVZuYVhOMFpYSlNaV0ZrVkhKaGNITmxJV052Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzluWlhSS2IzbHdZV1JUZEdGMFpXWWtZMjl5WlM5dFpXMXZjbmt2Y21WaFpGUnlZWEJ6TDJOb1pXTnJVbVZoWkZSeVlYQnpaekpqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMMlZwWjJoMFFtbDBURzloWkVaeWIyMUhRazFsYlc5eWVWZHBkR2hVY21Gd2MyZ2hZMjl5WlM5dFpXMXZjbmt2WW1GdWEybHVaeTlvWVc1a2JHVkNZVzVyYVc1bmFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlREJxSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWRYQmtZWFJsVGxKNE1Hc25ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzUxY0dSaGRHVk9Vbmd4YkNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlU1U2VERnRKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZFhCa1lYUmxUbEo0TVc0blkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNTFjR1JoZEdWT1VuZ3hieWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURKd0oyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkWEJrWVhSbFRsSjRNbkVuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1MWNHUmhkR1ZPVW5neWNpZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMblZ3WkdGMFpVNVNlREp6SjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWRYQmtZWFJsVGxKNE0zUW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUxY0dSaGRHVk9Vbmd6ZFNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlU1U2VETjJKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUbEo0TTNjblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNTFjR1JoZEdWT1VuZzBlQ1JqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5SeWFXZG5aWEo1SjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRJdlEyaGhibTVsYkRJdWRYQmtZWFJsVGxKNE5Ib2tZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTUwY21sbloyVnlleWRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5Wd1pHRjBaVTVTZURSOEpHTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVkSEpwWjJkbGNuMG5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzUxY0dSaGRHVk9VbmcwZmlSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuUnlhV2RuWlhKL0lXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTUlBQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTVlFQklXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1ZFhCa1lYUmxUbEkxTW9JQkxHTnZjbVV2YzI5MWJtUXZjbVZuYVhOMFpYSnpMMU52ZFc1a1VtVm5hWE4wWlhKWGNtbDBaVlJ5WVhCemd3RW1ZMjl5WlM5bmNtRndhR2xqY3k5c1kyUXZUR05rTG5Wd1pHRjBaVXhqWkVOdmJuUnliMnlFQVNCamIzSmxMMjFsYlc5eWVTOWtiV0V2YzNSaGNuUkViV0ZVY21GdWMyWmxjb1VCSjJOdmNtVXZiV1Z0YjNKNUwyUnRZUzluWlhSSVpHMWhVMjkxY21ObFJuSnZiVTFsYlc5eWVZWUJMR052Y21VdmJXVnRiM0o1TDJSdFlTOW5aWFJJWkcxaFJHVnpkR2x1WVhScGIyNUdjbTl0VFdWdGIzSjVod0VoWTI5eVpTOXRaVzF2Y25rdlpHMWhMM04wWVhKMFNHUnRZVlJ5WVc1elptVnlpQUV5WTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwzTjBiM0psVUdGc1pYUjBaVUo1ZEdWSmJsZGhjMjFOWlcxdmNubUpBVEJqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmFXNWpjbVZ0Wlc1MFVHRnNaWFIwWlVsdVpHVjRTV1pUWlhTS0FTOWpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2ZDNKcGRHVkRiMnh2Y2xCaGJHVjBkR1ZVYjAxbGJXOXllWXNCTUdOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JVYVcxbGNrbHVkR1Z5Y25Wd2RJd0JLbU52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlmWjJWMFZHbHRaWEpEYjNWdWRHVnlUV0Z6YTBKcGRJMEJPMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlmWTJobFkydEVhWFpwWkdWeVVtVm5hWE4wWlhKR1lXeHNhVzVuUldSblpVUmxkR1ZqZEc5eWpnRXBZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMTlwYm1OeVpXMWxiblJVYVcxbGNrTnZkVzUwWlhLUEFSOWpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZkWEJrWVhSbFZHbHRaWEp6a0FFbFkyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwySmhkR05vVUhKdlkyVnpjMVJwYldWeWM1RUJMMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXVkWEJrWVhSbFJHbDJhV1JsY2xKbFoybHpkR1Z5a2dFc1kyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1MWNHUmhkR1ZVYVcxbGNrTnZkVzUwWlhLVEFTdGpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlZScGJXVnlUVzlrZFd4dmxBRXNZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMVJwYldWeWN5NTFjR1JoZEdWVWFXMWxja052Ym5SeWIyeVZBU1pqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2U205NWNHRmtMblZ3WkdGMFpVcHZlWEJoWkpZQlBtTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXVkWEJrWVhSbFNXNTBaWEp5ZFhCMFVtVnhkV1Z6ZEdWa2x3RThZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTUxY0dSaGRHVkpiblJsY25KMWNIUkZibUZpYkdWa21BRW1ZMjl5WlM5dFpXMXZjbmt2ZDNKcGRHVlVjbUZ3Y3k5amFHVmphMWR5YVhSbFZISmhjSE9aQVRSamIzSmxMMjFsYlc5eWVTOXpkRzl5WlM5bGFXZG9kRUpwZEZOMGIzSmxTVzUwYjBkQ1RXVnRiM0o1VjJsMGFGUnlZWEJ6bWdFY1kyOXlaUzl0WlcxdmNua3ZaRzFoTDJoa2JXRlVjbUZ1YzJabGNwc0JJR052Y21VdmJXVnRiM0o1TDJSdFlTOTFjR1JoZEdWSVlteGhibXRJWkcxaG5BRXhZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZjbVZ4ZFdWemRGWkNiR0Z1YTBsdWRHVnljblZ3ZEowQkhtTnZjbVV2WjNKaGNHaHBZM012YkdOa0wzTmxkRXhqWkZOMFlYUjFjNTRCSldOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZkWEJrWVhSbFIzSmhjR2hwWTNPZkFTdGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDJKaGRHTm9VSEp2WTJWemMwZHlZWEJvYVdOem9BRVVZMjl5WlM5amIzSmxMM041Ym1ORGVXTnNaWE9oQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJkbGRFUmhkR0ZDZVhSbFZIZHZvZ0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTluWlhSRVlYUmhRbmwwWlU5dVphTUJLR052Y21VdlkzQjFMMjl3WTI5a1pYTXZaMlYwUTI5dVkyRjBaVzVoZEdWa1JHRjBZVUo1ZEdXa0FTaGpiM0psTDJOd2RTOXZjR052WkdWekwyVnBaMmgwUW1sMFUzUnZjbVZUZVc1alEzbGpiR1Z6cFFFWlkyOXlaUzlqY0hVdlpteGhaM012YzJWMFJteGhaMEpwZEtZQkgyTnZjbVV2WTNCMUwyWnNZV2R6TDNObGRFaGhiR1pEWVhKeWVVWnNZV2VuQVM5amIzSmxMMk53ZFM5bWJHRm5jeTlqYUdWamEwRnVaRk5sZEVWcFoyaDBRbWwwU0dGc1prTmhjbko1Um14aFo2Z0JHbU52Y21VdlkzQjFMMlpzWVdkekwzTmxkRnBsY205R2JHRm5xUUVlWTI5eVpTOWpjSFV2Wm14aFozTXZjMlYwVTNWaWRISmhZM1JHYkdGbnFnRWJZMjl5WlM5amNIVXZabXhoWjNNdmMyVjBRMkZ5Y25sR2JHRm5xd0VoWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKdmRHRjBaVUo1ZEdWTVpXWjByQUUyWTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2YzJsNGRHVmxia0pwZEZOMGIzSmxTVzUwYjBkQ1RXVnRiM0o1VjJsMGFGUnlZWEJ6clFFcVkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5emFYaDBaV1Z1UW1sMFUzUnZjbVZUZVc1alEzbGpiR1Z6cmdFMFkyOXlaUzlqY0hVdlpteGhaM012WTJobFkydEJibVJUWlhSVGFYaDBaV1Z1UW1sMFJteGhaM05CWkdSUGRtVnlabXh2ZDY4QkoyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdlpXbG5hSFJDYVhSTWIyRmtVM2x1WTBONVkyeGxjN0FCSW1OdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5eWIzUmhkR1ZDZVhSbFVtbG5hSFN4QVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUQjRzZ0ViWTI5eVpTOWpjSFV2Wm14aFozTXZaMlYwUTJGeWNubEdiR0Zuc3dFdFkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzSnZkR0YwWlVKNWRHVk1aV1owVkdoeWIzVm5hRU5oY25KNXRBRWhZMjl5WlM5d2IzSjBZV0pzWlM5d2IzSjBZV0pzWlM5cE9GQnZjblJoWW14bHRRRWlZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKbGJHRjBhWFpsU25WdGNMWUJMbU52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl5YjNSaGRHVkNlWFJsVW1sbmFIUlVhSEp2ZFdkb1EyRnljbm0zQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pURjR1QUVhWTI5eVpTOWpjSFV2Wm14aFozTXZaMlYwV21WeWIwWnNZV2U1QVI5amIzSmxMMk53ZFM5bWJHRm5jeTluWlhSSVlXeG1RMkZ5Y25sR2JHRm51Z0VlWTI5eVpTOWpjSFV2Wm14aFozTXZaMlYwVTNWaWRISmhZM1JHYkdGbnV3RWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1V5ZUx3QkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxNM2k5QVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUUjR2Z0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVMWVMOEJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTm5qQUFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVGQ0d1FFclkyOXlaUzlqY0hVdlpteGhaM012WTJobFkydEJibVJUWlhSRmFXZG9kRUpwZEVOaGNuSjVSbXhoWjhJQkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTloWkdSQlVtVm5hWE4wWlhMREFTNWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12WVdSa1FWUm9jbTkxWjJoRFlYSnllVkpsWjJsemRHVnl4QUVmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVNGVNVUJJbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emRXSkJVbVZuYVhOMFpYTEdBUzVqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMzVmlRVlJvY205MVoyaERZWEp5ZVZKbFoybHpkR1Z5eHdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTVlTWdCSW1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWhibVJCVW1WbmFYTjBaWExKQVNKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZlRzl5UVZKbFoybHpkR1Z5eWdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkJlTXNCSVdOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXZja0ZTWldkcGMzUmxjc3dCSVdOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWpjRUZTWldkcGMzUmxjczBCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFFuak9BU3RqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMM05wZUhSbFpXNUNhWFJNYjJGa1JuSnZiVWRDVFdWdGIzSjV6d0VwWTI5eVpTOWpjSFV2YjNCamIyUmxjeTl6YVhoMFpXVnVRbWwwVEc5aFpGTjVibU5EZVdOc1pYUFFBU2hqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpNWldaMDBRRXBZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKdmRHRjBaVkpsWjJsemRHVnlVbWxuYUhUU0FUUmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSk1aV1owVkdoeWIzVm5hRU5oY25KNTB3RTFZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKdmRHRjBaVkpsWjJsemRHVnlVbWxuYUhSVWFISnZkV2RvUTJGeWNublVBU2RqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMyaHBablJNWldaMFVtVm5hWE4wWlhMVkFUSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUlNhV2RvZEVGeWFYUm9iV1YwYVdOU1pXZHBjM1JsY3RZQksyTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6ZDJGd1RtbGlZbXhsYzA5dVVtVm5hWE4wWlhMWEFTOWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUlNhV2RvZEV4dloybGpZV3hTWldkcGMzUmxjdGdCSjJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OTBaWE4wUW1sMFQyNVNaV2RwYzNSbGN0a0JKbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5elpYUkNhWFJQYmxKbFoybHpkR1Z5MmdFaFkyOXlaUzlqY0hVdlkySlBjR052WkdWekwyaGhibVJzWlVOaVQzQmpiMlJsMndFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkRlTndCS0dOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNObGRFbHVkR1Z5Y25Wd2RIUGRBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVSNDNnRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1ZGZU44QkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxSbmpnQVI1amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJWNFpXTjFkR1ZQY0dOdlpHWGhBVHBqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlKYm5SbGNuSjFjSFJ6TG1GeVpVbHVkR1Z5Y25Wd2RITlFaVzVrYVc1bjRnRXRZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZjMmw0ZEdWbGJrSnBkRk4wYjNKbFNXNTBiMGRDVFdWdGIzSjU0d0VyWTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12WDJoaGJtUnNaVWx1ZEdWeWNuVndkT1FCS21OdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDJOb1pXTnJTVzUwWlhKeWRYQjBjK1VCRldOdmNtVXZZMjl5WlM5bGVHVmpkWFJsVTNSbGNPWUJGbU52Y21VdlkyOXlaUzlsZUdWamRYUmxSbkpoYldYbkFUQmpiM0psTDNOdmRXNWtMM052ZFc1a0wyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWExvQVNOamIzSmxMMk52Y21VdlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYitrQkpXTnZjbVV2WTI5eVpTOWxlR1ZqZFhSbFJuSmhiV1ZWYm5ScGJFSnlaV0ZyY0c5cGJuVHFBU0pqYjNKbEwyTnZjbVV2WjJWMFUyRjJaVk4wWVhSbFRXVnRiM0o1VDJabWMyVjA2d0V5WTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2YzNSdmNtVkNiMjlzWldGdVJHbHlaV04wYkhsVWIxZGhjMjFOWlcxdmNubnNBUnBqYjNKbEwyTndkUzlqY0hVdlEzQjFMbk5oZG1WVGRHRjBaZTBCS1dOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVjMkYyWlZOMFlYUmw3Z0V2WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12U1c1MFpYSnlkWEIwY3k1ellYWmxVM1JoZEdYdkFTTmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZTbTk1Y0dGa0xuTmhkbVZUZEdGMFpmQUJJMk52Y21VdmJXVnRiM0o1TDIxbGJXOXllUzlOWlcxdmNua3VjMkYyWlZOMFlYUmw4UUVqWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTV6WVhabFUzUmhkR1h5QVNCamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMbk5oZG1WVGRHRjBaZk1CSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRFdlEyaGhibTVsYkRFdWMyRjJaVk4wWVhSbDlBRW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTV6WVhabFUzUmhkR1gxQVNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuTmhkbVZUZEdGMFpmWUJKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1YzJGMlpWTjBZWFJsOXdFVFkyOXlaUzlqYjNKbEwzTmhkbVZUZEdGMFpmZ0JNbU52Y21VdmJXVnRiM0o1TDJ4dllXUXZiRzloWkVKdmIyeGxZVzVFYVhKbFkzUnNlVVp5YjIxWFlYTnRUV1Z0YjNKNStRRWFZMjl5WlM5amNIVXZZM0IxTDBOd2RTNXNiMkZrVTNSaGRHWDZBU2xqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxteHZZV1JUZEdGMFpmc0JMMk52Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMMGx1ZEdWeWNuVndkSE11Ykc5aFpGTjBZWFJsL0FFalkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wwcHZlWEJoWkM1c2IyRmtVM1JoZEdYOUFTTmpiM0psTDIxbGJXOXllUzl0WlcxdmNua3ZUV1Z0YjNKNUxteHZZV1JUZEdGMFpmNEJJMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXViRzloWkZOMFlYUmwvd0VoWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlqYkdWaGNrRjFaR2x2UW5WbVptVnlnQUlnWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzlUYjNWdVpDNXNiMkZrVTNSaGRHV0JBaVpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG14dllXUlRkR0YwWllJQ0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXViRzloWkZOMFlYUmxnd0ltWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1c2IyRmtVM1JoZEdXRUFpWmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbXh2WVdSVGRHRjBaWVVDRTJOdmNtVXZZMjl5WlM5c2IyRmtVM1JoZEdXR0FoaGpiM0psTDJOdmNtVXZhR0Z6UTI5eVpWTjBZWEowWldTSEFqUmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZYMmRsZEVwdmVYQmhaRUoxZEhSdmJsTjBZWFJsUm5KdmJVSjFkSFJ2Ymtsa2lBSTBZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMMTl6WlhSS2IzbHdZV1JDZFhSMGIyNVRkR0YwWlVaeWIyMUNkWFIwYjI1SlpJa0NNV052Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMM0psY1hWbGMzUktiM2x3WVdSSmJuUmxjbkoxY0hTS0FpVmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZYM0J5WlhOelNtOTVjR0ZrUW5WMGRHOXVpd0luWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5eVpXeGxZWE5sU205NWNHRmtRblYwZEc5dWpBSWhZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMM05sZEVwdmVYQmhaRk4wWVhSbGpRSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKQmpnSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKQ2p3SWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRGtBSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRWtRSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRmtnSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKSWt3SWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKTWxBSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKR2xRSW1ZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVISnZaM0poYlVOdmRXNTBaWEtXQWlSamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJUZEdGamExQnZhVzUwWlhLWEFpNWpiM0psTDJSbFluVm5MMlJsWW5WbkxXTndkUzluWlhSUGNHTnZaR1ZCZEZCeWIyZHlZVzFEYjNWdWRHVnltQUlmWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFuY21Gd2FHbGpjeTluWlhSTVdaa0NOMk52Y21VdlpHVmlkV2N2WkdWaWRXY3RaM0poY0docFkzTXZaSEpoZDBKaFkydG5jbTkxYm1STllYQlViMWRoYzIxTlpXMXZjbm1hQWpkamIzSmxMMmR5WVhCb2FXTnpMM1JwYkdWekwyUnlZWGRRYVhobGJITkdjbTl0VEdsdVpVOW1WR2xzWlh4MGNtRnRjRzlzYVc1bG13SXlZMjl5WlM5a1pXSjFaeTlrWldKMVp5MW5jbUZ3YUdsamN5OWtjbUYzVkdsc1pVUmhkR0ZVYjFkaGMyMU5aVzF2Y25tY0FoMWpiM0psTDJSbFluVm5MMlJsWW5WbkxYUnBiV1Z5TDJkbGRFUkpWcDBDSG1OdmNtVXZaR1ZpZFdjdlpHVmlkV2N0ZEdsdFpYSXZaMlYwVkVsTlFaNENIV052Y21VdlpHVmlkV2N2WkdWaWRXY3RkR2x0WlhJdloyVjBWRTFCbndJZFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxMGFXMWxjaTluWlhSVVFVT2dBZ1Z6ZEdGeWRLRUNRbU52Y21VdlpHVmlkV2N2WkdWaWRXY3RaM0poY0docFkzTXZaSEpoZDBKaFkydG5jbTkxYm1STllYQlViMWRoYzIxTlpXMXZjbmw4ZEhKaGJYQnZiR2x1WmFJQ0NINXpaWFJoY21kakFENFFjMjkxY21ObFRXRndjR2x1WjFWU1RDeGtaVzF2TDJSbFluVm5aMlZ5TDJGemMyVjBjeTlqYjNKbExuVnVkRzkxWTJobFpDNTNZWE50TG0xaGNBPT0iKSkuaW5zdGFuY2U7CmNvbnN0IGI9bmV3IFVpbnQ4QXJyYXkoYS5leHBvcnRzLm1lbW9yeS5idWZmZXIpO3JldHVybntpbnN0YW5jZTphLGJ5dGVNZW1vcnk6Yix0eXBlOiJXZWIgQXNzZW1ibHkifX07bGV0IHIsQyxkO2Q9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsCldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sZnJhbWVTa2lwQ291bnRlcjowLGN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjooYSk9Pntjb25zdCBiPW4oYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGcuQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhkLmdyYXBoaWNzV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShHLmJpbmQodm9pZCAwLGQpLGQuZ3JhcGhpY3NXb3JrZXJQb3J0KSk6Ik1FTU9SWSI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGQubWVtb3J5V29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShKLmJpbmQodm9pZCAwLGQpLGQubWVtb3J5V29ya2VyUG9ydCkpOgoiQ09OVFJPTExFUiI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGQuY29udHJvbGxlcldvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoSS5iaW5kKHZvaWQgMCxkKSxkLmNvbnRyb2xsZXJXb3JrZXJQb3J0KSk6IkFVRElPIj09PWIubWVzc2FnZS53b3JrZXJJZCYmKGQuYXVkaW9Xb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEguYmluZCh2b2lkIDAsZCksZC5hdWRpb1dvcmtlclBvcnQpKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLklOU1RBTlRJQVRFX1dBU006KGFzeW5jKCk9PntsZXQgYTthPWF3YWl0IE0ocCk7ZC53YXNtSW5zdGFuY2U9YS5pbnN0YW5jZTtkLndhc21CeXRlTWVtb3J5PWEuYnl0ZU1lbW9yeTtrKGgoe3R5cGU6YS50eXBlfSxiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIGcuQ09ORklHOmQud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KGQsYi5tZXNzYWdlLmNvbmZpZyk7ZC5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zOwprKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLlJFU0VUX0FVRElPX1FVRVVFOmQud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZy5QTEFZOmlmKCFkLnBhdXNlZHx8IWQud2FzbUluc3RhbmNlfHwhZC53YXNtQnl0ZU1lbW9yeSl7ayhoKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTticmVha31kLnBhdXNlZD0hMTtkLmZwc1RpbWVTdGFtcHM9W107ZC5mcmFtZVNraXBDb3VudGVyPTA7ZC5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7RChkLDFFMy9kLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7QShkKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLlBBVVNFOmQucGF1c2VkPSEwO2QudXBkYXRlSWQmJihjbGVhclRpbWVvdXQoZC51cGRhdGVJZCksZC51cGRhdGVJZD12b2lkIDApO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGcuUlVOX1dBU01fRVhQT1JUOmE9CmIubWVzc2FnZS5wYXJhbWV0ZXJzP2Qud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpkLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ayhoKHt0eXBlOmcuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPTA7bGV0IGM9ZC53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7Yi5tZXNzYWdlLnN0YXJ0JiYoYT1iLm1lc3NhZ2Uuc3RhcnQpO2IubWVzc2FnZS5lbmQmJihjPWIubWVzc2FnZS5lbmQpO2E9ZC53YXNtQnl0ZU1lbW9yeS5zbGljZShhLGMpLmJ1ZmZlcjtrKGgoe3R5cGU6Zy5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSBnLkdFVF9XQVNNX0NPTlNUQU5UOmsoaCh7dHlwZTpnLkdFVF9XQVNNX0NPTlNUQU5ULHJlc3BvbnNlOmQud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmNvbnN0YW50XS52YWx1ZU9mKCl9LApiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYil9fSxnZXRGUFM6KCk9PjA8ZC50aW1lU3RhbXBzVW50aWxSZWFkeT9kLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpkLmZwc1RpbWVTdGFtcHM/ZC5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGQubWVzc2FnZUhhbmRsZXIpfSkoKTsK";

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
var version = "0.3.1";
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
	"lib:build": "npx run-s lib:build:wasm lib:build:ts",
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
	"debugger:build": "preact build -p --src demo/debugger --no-prerender --service-worker false",
	"benchmark:build": "npx rollup -c --environment PROD,BENCHMARK",
	"benchmark:watch": "npx rollup -c -w --environment BENCHMARK",
	"demo:cname": "echo 'wasmboy.app' > build/CNAME",
	"demo:build": "npx run-s core:build lib:build debugger:build benchmark:build",
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
