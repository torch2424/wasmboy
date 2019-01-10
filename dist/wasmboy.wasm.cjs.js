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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6dS5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBGKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBnLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKX19ZnVuY3Rpb24gRyhhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLApXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZy5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZy5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geChhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGM9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2M9MzI3Njg6CjU8PWImJjY+PWI/Yz0yMDQ4OjE1PD1iJiYxOT49Yj9jPTMyNzY4OjI1PD1iJiYzMD49YiYmKGM9MTMxMDcyKTtyZXR1cm4gYz9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04rYyk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24geShhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIEkoYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGcuQ0xFQVJfTUVNT1JZOmZvcih2YXIgYz0wO2M8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2MrKylhLndhc21CeXRlTWVtb3J5W2NdPTA7Yz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApOwphLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpnLkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmMuYnVmZmVyfSxiLm1lc3NhZ2VJZCksW2MuYnVmZmVyXSk7YnJlYWs7Y2FzZSBnLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCeXRlc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpfSwKYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGcuU0VUX01FTU9SWTpjPU9iamVjdC5rZXlzKGIubWVzc2FnZSk7Yy5pbmNsdWRlcyhmLkNBUlRSSURHRV9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5DQVJUUklER0VfUk9NXSksYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2MuaW5jbHVkZXMoZi5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2YuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7Yy5pbmNsdWRlcyhmLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2YuR0FNRUJPWV9NRU1PUlldKSxhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKGYuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5QQUxFVFRFX01FTU9SWV0pLAphLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pO2MuaW5jbHVkZXMoZi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZi5JTlRFUk5BTF9TVEFURV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zy5TRVRfTUVNT1JZX0RPTkV9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLkdFVF9NRU1PUlk6e2M9e3R5cGU6Zy5HRVRfTUVNT1JZfTtjb25zdCBsPVtdO3ZhciBkPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihkLmluY2x1ZGVzKGYuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD0KZSYmMz49ZT9tPTIwOTcxNTI6NTw9ZSYmNj49ZT9tPTI2MjE0NDoxNTw9ZSYmMTk+PWU/bT0yMDk3MTUyOjI1PD1lJiYzMD49ZSYmKG09ODM4ODYwOCk7ZT1tP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbSk6bmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7Y1tmLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWQuaW5jbHVkZXMoZi5DQVJUUklER0VfUkFNKSYmKGU9eChhKS5idWZmZXIsY1tmLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtkLmluY2x1ZGVzKGYuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGNbZi5DQVJUUklER0VfSEVBREVSXT0KZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5HQU1FQk9ZX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLGNbZi5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGNbZi5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2QuaW5jbHVkZXMoZi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGQ9eShhKS5idWZmZXIsY1tmLklOVEVSTkFMX1NUQVRFXT0KZCxsLnB1c2goZCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGMsYi5tZXNzYWdlSWQpLGwpfX19ZnVuY3Rpb24gSihhKXtjb25zdCBiPSJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGItMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTthLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB6KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEEoYSl7dmFyIGI9KCJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS0KYS5mcHNUaW1lU3RhbXBzW2EuZnBzVGltZVN0YW1wcy5sZW5ndGgtMV07Yj1CLWI7MD5iJiYoYj0wKTthLnVwZGF0ZUlkPXNldFRpbWVvdXQoKCk9PntDKGEpfSxNYXRoLmZsb29yKGIpKX1mdW5jdGlvbiBDKGEsYil7aWYoYS5wYXVzZWQpcmV0dXJuITA7dm9pZCAwIT09YiYmKEI9Yik7cj1hLmdldEZQUygpO2lmKHI+YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUrMSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksQShhKSwhMDtKKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZTtjP3YoYSxiKTooZT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLGIoZSkpfSkpLnRoZW4oKGIpPT57aWYoMDw9Yil7ayhoKHt0eXBlOmcuVVBEQVRFRCxmcHM6cn0pKTtiPSExO2Eub3B0aW9ucy5mcmFtZVNraXAmJjA8YS5vcHRpb25zLmZyYW1lU2tpcCYmCihhLmZyYW1lU2tpcENvdW50ZXIrKyxhLmZyYW1lU2tpcENvdW50ZXI8PWEub3B0aW9ucy5mcmFtZVNraXA/Yj0hMDphLmZyYW1lU2tpcENvdW50ZXI9MCk7Ynx8KGI9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OK2EuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkUpLmJ1ZmZlcixhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuVVBEQVRFRCxncmFwaGljc0ZyYW1lQnVmZmVyOmJ9KSxbYl0pKTtjb25zdCBjPXt0eXBlOmcuVVBEQVRFRH07Y1tmLkNBUlRSSURHRV9SQU1dPXgoYSkuYnVmZmVyO2NbZi5HQU1FQk9ZX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXI7CmNbZi5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7Y1tmLklOVEVSTkFMX1NUQVRFXT15KGEpLmJ1ZmZlcjtPYmplY3Qua2V5cyhjKS5mb3JFYWNoKChhKT0+e3ZvaWQgMD09PWNbYV0mJihjW2FdPShuZXcgVWludDhBcnJheSkuYnVmZmVyKX0pO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGMpLFtjW2YuQ0FSVFJJREdFX1JBTV0sY1tmLkdBTUVCT1lfTUVNT1JZXSxjW2YuUEFMRVRURV9NRU1PUlldLGNbZi5JTlRFUk5BTF9TVEFURV1dKTtBKGEpfWVsc2UgayhoKHt0eXBlOmcuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHYoYSxiKXt2YXIgYz1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PQpjJiZiKGMpO2lmKDE9PT1jKXtjPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0QXVkaW9RdWV1ZUluZGV4KCk7Y29uc3QgZD1yPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTsuMjU8YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzJiZkPyhEKGEsYyksc2V0VGltZW91dCgoKT0+e3ooYSk7dihhLGIpfSxNYXRoLmZsb29yKE1hdGguZmxvb3IoMUUzKihhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMtLjI1KSkvMTApKSk6KEQoYSxjKSx2KGEsYikpfX1mdW5jdGlvbiBEKGEsYil7Y29uc3QgYz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmcuVVBEQVRFRCxhdWRpb0J1ZmZlcjpjLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDwKYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9KSxbY10pO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCl9Y29uc3QgcD0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCB1O3B8fCh1PXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgZz17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIiwKUEFVU0U6IlBBVVNFIixVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQifSxmPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IHQ9MCxLPXt9O2NvbnN0IHc9e2Vudjp7bG9nOihhLGIsYyxkLGUsZyxmKT0+e3ZhciBoPShuZXcgVWludDMyQXJyYXkod2FzbUluc3RhbmNlLmV4cG9ydHMubWVtb3J5LmJ1ZmZlciwKYSwxKSlbMF07YT1TdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsbmV3IFVpbnQxNkFycmF5KHdhc21JbnN0YW5jZS5leHBvcnRzLm1lbW9yeS5idWZmZXIsYSs0LGgpKTstOTk5OSE9PWImJihhPWEucmVwbGFjZSgiJDAiLGIpKTstOTk5OSE9PWMmJihhPWEucmVwbGFjZSgiJDEiLGMpKTstOTk5OSE9PWQmJihhPWEucmVwbGFjZSgiJDIiLGQpKTstOTk5OSE9PWUmJihhPWEucmVwbGFjZSgiJDMiLGUpKTstOTk5OSE9PWcmJihhPWEucmVwbGFjZSgiJDQiLGcpKTstOTk5OSE9PWYmJihhPWEucmVwbGFjZSgiJDUiLGYpKTtjb25zb2xlLmxvZygiW1dhc21Cb3ldICIrYSl9LGhleExvZzooYSxiLGMsZCxlLGcpPT57aWYoIUtbYV0pe2xldCBmPSJbV2FzbUJveV0iOy05OTk5IT09YSYmKGYrPWAgMHgke2EudG9TdHJpbmcoMTYpfSBgKTstOTk5OSE9PWImJihmKz1gIDB4JHtiLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1jJiYoZis9YCAweCR7Yy50b1N0cmluZygxNil9IGApOy05OTk5IT09CmQmJihmKz1gIDB4JHtkLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1lJiYoZis9YCAweCR7ZS50b1N0cmluZygxNil9IGApOy05OTk5IT09ZyYmKGYrPWAgMHgke2cudG9TdHJpbmcoMTYpfSBgKTtjb25zb2xlLmxvZyhmKX19fX0sRT1hc3luYyhhKT0+e2xldCBiPXZvaWQgMDtyZXR1cm4gYj1XZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZz9hd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZyhmZXRjaChhKSx3KTphd2FpdCAoYXN5bmMoKT0+e2NvbnN0IGI9YXdhaXQgZmV0Y2goYSkudGhlbigoYSk9PmEuYXJyYXlCdWZmZXIoKSk7cmV0dXJuIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGIsdyl9KSgpfSxMPWFzeW5jKGEpPT57YT1CdWZmZXIuZnJvbShhLnNwbGl0KCIsIilbMV0sImJhc2U2NCIpO3JldHVybiBhd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShhLHcpfSxNPWFzeW5jKGEpPT57YT0oYT9hd2FpdCBFKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmZoQmdDWDkvZjM5L2YzOS9md0JnQUFCZ0FYOEJmMkFDZjM4QVlBRi9BR0FDZjM4QmYyQUFBWDlnQTM5L2Z3Ri9ZQU4vZjM4QVlBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCSDkvZjM4QVlBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FBTzJBclFDQWdJQ0FnRUJBd0VCQVFFQkFRRUJBUVVFQkFFQkJBRUJBUUFHQlFNQkFRRUJBUUVCQVFFQkFRRUNBUVFCQVFRQkFRRUJBUUVCQVFFQkJnWUdBZ1lHQlFVTEJRVUZCUXNLQlFVRkJ3VUhCd3dLRFFrSkNBZ0RCQUVCQVFZR0JBRUdCZ0VCQVFFR0JBRUJBUUVCQWdJQ0FnSUNBUVVDQmdFQ0JnRUNBZ1lHQWdZR0JnVU9DQVFDQWdRRUFRSUdBZ0lEQkFRRUJBUUVCQVFFQkFRRUJBUUVBUVFCQkFFRUFRUUVCQVVFQkFZR0JBZ0RBd0VDQlFFRUFRUUVCQVFGQXdnQkFRRUVBUVFFQmdZR0F3VUVBd1FFQkFJREF3Z0NBZ0lHQWdJRUFnSUdCZ1lDQWdJQ0FnRUNBd1FFQWdRRUFnUUVBZ1FFQWdJQ0FnSUNBZ0lDQWdJRkJ3SUNCQUlDQWdJQkJnTUVCZ1FHQmdZSEJnSUNBZ1lHQmdJREFRUUVEd1lHQmdZR0JnWUdCZ1lHQmdRQkJnWUdCZ0VDQkFjRkF3RUFBQWFUQzRVQ2Z3QkJBQXQvQUVHQWdLd0VDMzhBUVlzQkMzOEFRUUFMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQWdMZndCQmdCQUxmd0JCLy84REMzOEFRWUFRQzM4QVFZQ0FBUXQvQUVHQWtBRUxmd0JCZ0lBQ0MzOEFRWUNRQXd0L0FFR0FnQUVMZndCQmdKQUVDMzhBUVlEb0h3dC9BRUdBa0FRTGZ3QkJnQVFMZndCQmdLQUVDMzhBUVlDNEFRdC9BRUdBMkFVTGZ3QkJnTmdGQzM4QVFZQ1lEZ3QvQUVHQWdBd0xmd0JCZ0pnYUMzOEFRWUNBQ1F0L0FFR0FtQ01MZndCQmdPQUFDMzhBUVlENEl3dC9BRUdBZ0FnTGZ3QkJnUGdyQzM4QVFZQ0FDQXQvQUVHQStETUxmd0JCZ0lqNEF3dC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWMvK0F3dC9BVUVBQzM4QlFmRCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUThMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIL0FBdC9BVUgvQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQmdLald1UWNMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWDhMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBOXdJTGZ3RkJnSUFJQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkIxZjREQzM4QlFkSCtBd3QvQVVIUy9nTUxmd0ZCMC80REMzOEJRZFQrQXd0L0FVSG8vZ01MZndGQjYvNERDMzhCUWVuK0F3dC9BRUdBZ0t3RUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBUUMzOEFRZi8vQXd0L0FFR0FrQVFMZndCQmdKQUVDMzhBUVlBRUMzOEFRWURZQlF0L0FFR0FtQTRMZndCQmdKZ2FDMzhBUVlENEl3dC9BRUdBK0NzTGZ3QkJnUGd6QzM4QlFRQUxCOFVQWFFadFpXMXZjbmtDQUFaamIyNW1hV2NBR1E1b1lYTkRiM0psVTNSaGNuUmxaQUFhQ1hOaGRtVlRkR0YwWlFBb0NXeHZZV1JUZEdGMFpRQTRFbWRsZEZOMFpYQnpVR1Z5VTNSbGNGTmxkQUE1QzJkbGRGTjBaWEJUWlhSekFEb0laMlYwVTNSbGNITUFPeFZsZUdWamRYUmxUWFZzZEdsd2JHVkdjbUZ0WlhNQWtnSU1aWGhsWTNWMFpVWnlZVzFsQUpFQ0NGOXpaWFJoY21kakFMSUNHV1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOEFzUUliWlhobFkzVjBaVVp5WVcxbFZXNTBhV3hDY21WaGEzQnZhVzUwQUpRQ0ZXVjRaV04xZEdWVmJuUnBiRU52Ym1ScGRHbHZiZ0N6QWd0bGVHVmpkWFJsVTNSbGNBQ05BaFJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFDVkFneG5aWFJEZVdOc1pWTmxkSE1BbGdJSloyVjBRM2xqYkdWekFKY0NEbk5sZEVwdmVYQmhaRk4wWVhSbEFKMENIMmRsZEU1MWJXSmxjazltVTJGdGNHeGxjMGx1UVhWa2FXOUNkV1ptWlhJQWp3SVFZMnhsWVhKQmRXUnBiMEoxWm1abGNnQXlGMWRCVTAxQ1QxbGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3QVRWMEZUVFVKUFdWOU5SVTFQVWxsZlUwbGFSUU1CRWxkQlUwMUNUMWxmVjBGVFRWOVFRVWRGVXdNQ0hrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01ER2tGVFUwVk5Ra3haVTBOU1NWQlVYMDFGVFU5U1dWOVRTVnBGQXdRV1YwRlRUVUpQV1Y5VFZFRlVSVjlNVDBOQlZFbFBUZ01GRWxkQlUwMUNUMWxmVTFSQlZFVmZVMGxhUlFNR0lFZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdjY1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVTBsYVJRTUlFbFpKUkVWUFgxSkJUVjlNVDBOQlZFbFBUZ01KRGxaSlJFVlBYMUpCVFY5VFNWcEZBd29SVjA5U1MxOVNRVTFmVEU5RFFWUkpUMDREQ3cxWFQxSkxYMUpCVFY5VFNWcEZBd3dtVDFSSVJWSmZSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RERTSlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3NFlSMUpCVUVoSlExTmZUMVZVVUZWVVgweFBRMEZVU1U5T0F3OFVSMUpCVUVoSlExTmZUMVZVVUZWVVgxTkpXa1VERUJSSFFrTmZVRUZNUlZSVVJWOU1UME5CVkVsUFRnTVJFRWRDUTE5UVFVeEZWRlJGWDFOSldrVURFaGhDUjE5UVVrbFBVa2xVV1Y5TlFWQmZURTlEUVZSSlQwNERFeFJDUjE5UVVrbFBVa2xVV1Y5TlFWQmZVMGxhUlFNVURrWlNRVTFGWDB4UFEwRlVTVTlPQXhVS1JsSkJUVVZmVTBsYVJRTVdGMEpCUTB0SFVrOVZUa1JmVFVGUVgweFBRMEZVU1U5T0F4Y1RRa0ZEUzBkU1QxVk9SRjlOUVZCZlUwbGFSUU1ZRWxSSlRFVmZSRUZVUVY5TVQwTkJWRWxQVGdNWkRsUkpURVZmUkVGVVFWOVRTVnBGQXhvU1QwRk5YMVJKVEVWVFgweFBRMEZVU1U5T0F4c09UMEZOWDFSSlRFVlRYMU5KV2tVREhCVkJWVVJKVDE5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESFJGQlZVUkpUMTlDVlVaR1JWSmZVMGxhUlFNZUZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRESHhKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVRElCWkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXlFU1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5SWhaMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBSU1aMlYwVW1WbmFYTjBaWEpCQUo0Q0RHZGxkRkpsWjJsemRHVnlRZ0NmQWd4blpYUlNaV2RwYzNSbGNrTUFvQUlNWjJWMFVtVm5hWE4wWlhKRUFLRUNER2RsZEZKbFoybHpkR1Z5UlFDaUFneG5aWFJTWldkcGMzUmxja2dBb3dJTVoyVjBVbVZuYVhOMFpYSk1BS1FDREdkbGRGSmxaMmx6ZEdWeVJnQ2xBaEZuWlhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0NtQWc5blpYUlRkR0ZqYTFCdmFXNTBaWElBcHdJWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dDb0FnVm5aWFJNV1FDcEFoMWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllUUNxQWhoa2NtRjNWR2xzWlVSaGRHRlViMWRoYzIxTlpXMXZjbmtBcXdJR1oyVjBSRWxXQUt3Q0IyZGxkRlJKVFVFQXJRSUdaMlYwVkUxQkFLNENCbWRsZEZSQlF3Q3ZBZ1oxY0dSaGRHVUFrUUlOWlcxMWJHRjBhVzl1VTNSbGNBQ05BaEpuWlhSQmRXUnBiMUYxWlhWbFNXNWtaWGdBandJUGNtVnpaWFJCZFdScGIxRjFaWFZsQURJT2QyRnpiVTFsYlc5eWVWTnBlbVVEOWdFY2QyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVk1iMk5oZEdsdmJnUDNBUmgzWVhOdFFtOTVTVzUwWlhKdVlXeFRkR0YwWlZOcGVtVUQrQUVkWjJGdFpVSnZlVWx1ZEdWeWJtRnNUV1Z0YjNKNVRHOWpZWFJwYjI0RCtRRVpaMkZ0WlVKdmVVbHVkR1Z5Ym1Gc1RXVnRiM0o1VTJsNlpRUDZBUk4yYVdSbGIwOTFkSEIxZEV4dlkyRjBhVzl1QS9zQkltWnlZVzFsU1c1UWNtOW5jbVZ6YzFacFpHVnZUM1YwY0hWMFRHOWpZWFJwYjI0RC9nRWJaMkZ0WldKdmVVTnZiRzl5VUdGc1pYUjBaVXh2WTJGMGFXOXVBL3dCRjJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWVGFYcGxBLzBCRldKaFkydG5jbTkxYm1STllYQk1iMk5oZEdsdmJnUC9BUXQwYVd4bFJHRjBZVTFoY0FPQUFoTnpiM1Z1WkU5MWRIQjFkRXh2WTJGMGFXOXVBNEVDRVdkaGJXVkNlWFJsYzB4dlkyRjBhVzl1QTRNQ0ZHZGhiV1ZTWVcxQ1lXNXJjMHh2WTJGMGFXOXVBNElDQ0FLd0FncnN5d0cwQWlzQkFuOGpMU0VCSXk1RklnSUVRQ0FCUlNFQ0N5QUNCRUJCQVNFQkN5QUJRUTUwSUFCQmdJQUJhMm9MRHdBak1VRU5kQ0FBUVlEQUFtdHFDN2NCQVFKL0FrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFTWRTSUNJUUVnQWtVTkFBSkFJQUZCQVdzT0RRRUJBUUlDQWdJREF3UUVCUVlBQ3d3R0N5QUFRWUQ0TTJvUEN5QUFFQUJCZ1BnemFnOExRUUFoQVNNdkJFQWpNQkFEUVFGeElRRUxJQUJCZ0pCK2FpQUJRUTEwYWc4TElBQVFBVUdBK0N0cUR3c2dBRUdBa0g1cUR3dEJBQ0VCSXk4RVFDTXlFQU5CQjNFaEFRc2dBVUVCU0FSQVFRRWhBUXNnQUNBQlFReDBha0dBOEgxcUR3c2dBRUdBVUdvTENRQWdBQkFDTFFBQUM1a0JBRUVBSkROQkFDUTBRUUFrTlVFQUpEWkJBQ1EzUVFBa09FRUFKRGxCQUNRNlFRQWtPMEVBSkR4QkFDUTlRUUFrUGtFQUpEOUJBQ1JBUVFBa1FVRUFKRUlqTHdSQVFSRWtORUdBQVNRN1FRQWtOVUVBSkRaQi93RWtOMEhXQUNRNFFRQWtPVUVOSkRvRlFRRWtORUd3QVNRN1FRQWtOVUVUSkRaQkFDUTNRZGdCSkRoQkFTUTVRYzBBSkRvTFFZQUNKRDFCL3Y4REpEd0xwQUVCQW45QkFDUkRRUUVrUkVISEFoQURJUUZCQUNSRlFRQWtSa0VBSkVkQkFDUklRUUFrTGlBQkJFQWdBVUVCVGlJQUJFQWdBVUVEVENFQUN5QUFCRUJCQVNSR0JTQUJRUVZPSWdBRVFDQUJRUVpNSVFBTElBQUVRRUVCSkVjRklBRkJEMDRpQUFSQUlBRkJFMHdoQUFzZ0FBUkFRUUVrU0FVZ0FVRVpUaUlBQkVBZ0FVRWVUQ0VBQ3lBQUJFQkJBU1F1Q3dzTEN3VkJBU1JGQzBFQkpDMUJBQ1F4Q3dzQUlBQVFBaUFCT2dBQUN5OEFRZEgrQTBIL0FSQUdRZEwrQTBIL0FSQUdRZFArQTBIL0FSQUdRZFQrQTBIL0FSQUdRZFgrQTBIL0FSQUdDNWdCQUVFQUpFbEJBQ1JLUVFBa1MwRUFKRXhCQUNSTlFRQWtUa0VBSkU4akx3UkFRWkFCSkV0QndQNERRWkVCRUFaQndmNERRWUVCRUFaQnhQNERRWkFCRUFaQngvNERRZndCRUFZRlFaQUJKRXRCd1A0RFFaRUJFQVpCd2Y0RFFZVUJFQVpCeHY0RFFmOEJFQVpCeC80RFFmd0JFQVpCeVA0RFFmOEJFQVpCeWY0RFFmOEJFQVlMUWMvK0EwRUFFQVpCOFA0RFFRRVFCZ3RQQUNNdkJFQkI2UDREUWNBQkVBWkI2ZjREUWY4QkVBWkI2djREUWNFQkVBWkI2LzREUVEwUUJnVkI2UDREUWY4QkVBWkI2ZjREUWY4QkVBWkI2djREUWY4QkVBWkI2LzREUWY4QkVBWUxDeThBUVpEK0EwR0FBUkFHUVpIK0EwRy9BUkFHUVpMK0EwSHpBUkFHUVpQK0EwSEJBUkFHUVpUK0EwRy9BUkFHQ3l3QVFaWCtBMEgvQVJBR1FaYitBMEUvRUFaQmwvNERRUUFRQmtHWS9nTkJBQkFHUVpuK0EwRzRBUkFHQ3pJQVFacitBMEgvQUJBR1FaditBMEgvQVJBR1FaeitBMEdmQVJBR1FaMytBMEVBRUFaQm52NERRYmdCRUFaQkFTUmdDeTBBUVovK0EwSC9BUkFHUWFEK0EwSC9BUkFHUWFIK0EwRUFFQVpCb3Y0RFFRQVFCa0dqL2dOQnZ3RVFCZ3M0QUVFUEpHRkJEeVJpUVE4a1kwRVBKR1JCQUNSbFFRQWtaa0VBSkdkQkFDUm9RZjhBSkdsQi93QWtha0VCSkd0QkFTUnNRUUFrYlF0bkFFRUFKRkJCQUNSUlFRQWtVa0VCSkZOQkFTUlVRUUVrVlVFQkpGWkJBU1JYUVFFa1dFRUJKRmxCQVNSYVFRRWtXMEVBSkZ4QkFDUmRRUUFrWGtFQUpGOFFDaEFMRUF3UURVR2svZ05COXdBUUJrR2wvZ05COHdFUUJrR20vZ05COFFFUUJoQU9DdzBBSUFGQkFTQUFkSEZCQUVjTEpnQkJBQ0FBRUJBa2JrRUJJQUFRRUNSdlFRSWdBQkFRSkhCQkJDQUFFQkFrY1NBQUpISUxKZ0JCQUNBQUVCQWtjMEVCSUFBUUVDUjBRUUlnQUJBUUpIVkJCQ0FBRUJBa2RpQUFKSGNMR3dCQkFCQVJRZi8vQXlOeUVBWkI0UUVRRWtHUC9nTWpkeEFHQzFJQVFRQWtlRUVBSkhsQkFDUjZRUUFrZTBFQUpIeEJBQ1I5UVFBa2ZrRUFKSDhqTHdSQVFZVCtBMEVlRUFaQm9EMGtlUVZCaFA0RFFhc0JFQVpCek5jQ0pIa0xRWWYrQTBINEFSQUdRZmdCSkgwTENRQWdBRUVCY1NRakN4VUFRWUNvMXJrSEpJQUJRUUFrZ1FGQkFDU0NBUXNWQUVHQXFOYTVCeVNEQVVFQUpJUUJRUUFraFFFTHp3RUJBbjlCd3dJUUF5SUJRY0FCUmlJQVJRUkFJeVVFZnlBQlFZQUJSZ1VqSlFzaEFBc2dBQVJBUVFFa0x3VkJBQ1F2Q3hBRUVBVVFCeEFJRUFrUUR4QVRFQlFqTHdSQVFmRCtBMEg0QVJBR1FjLytBMEgrQVJBR1FjMytBMEgrQUJBR1FZRCtBMEhQQVJBR1FZTCtBMEg4QUJBR1FZLytBMEhoQVJBR1FleitBMEgrQVJBR1FmWCtBMEdQQVJBR0JVSHcvZ05CL3dFUUJrSFAvZ05CL3dFUUJrSE4vZ05CL3dFUUJrR0EvZ05CendFUUJrR0MvZ05CL2dBUUJrR1AvZ05CNFFFUUJndEJBQkFWRUJZUUZ3dWRBUUFnQUVFQVNnUkFRUUVrSkFWQkFDUWtDeUFCUVFCS0JFQkJBU1FsQlVFQUpDVUxJQUpCQUVvRVFFRUJKQ1lGUVFBa0pnc2dBMEVBU2dSQVFRRWtKd1ZCQUNRbkN5QUVRUUJLQkVCQkFTUW9CVUVBSkNnTElBVkJBRW9FUUVFQkpDa0ZRUUFrS1FzZ0JrRUFTZ1JBUVFFa0tnVkJBQ1FxQ3lBSFFRQktCRUJCQVNRckJVRUFKQ3NMSUFoQkFFb0VRRUVCSkN3RlFRQWtMQXNRR0FzTUFDTWpCRUJCQVE4TFFRQUxEZ0FnQUVHQUNHb2dBVUV5YkdvTEdRQWdBVUVCY1FSQUlBQkJBVG9BQUFVZ0FFRUFPZ0FBQ3d1akFRQkJBRUVBRUJzak5Eb0FBRUVCUVFBUUd5TTFPZ0FBUVFKQkFCQWJJelk2QUFCQkEwRUFFQnNqTnpvQUFFRUVRUUFRR3lNNE9nQUFRUVZCQUJBYkl6azZBQUJCQmtFQUVCc2pPam9BQUVFSFFRQVFHeU03T2dBQVFRaEJBQkFiSXp3N0FRQkJDa0VBRUJzalBUc0JBRUVNUVFBUUd5TStOZ0lBUVJGQkFCQWJJejhRSEVFU1FRQVFHeU5BRUJ4QkUwRUFFQnNqUVJBY1FSUkJBQkFiSTBJUUhBc2hBRUVBUVFFUUd5TktOZ0lBUVFSQkFSQWJJNFlCT2dBQVFjVCtBeU5MRUFZTEdBQkJBRUVDRUJzamh3RVFIRUVCUVFJUUd5T0lBUkFjQ3dNQUFRdGVBRUVBUVFRUUd5TXRPd0VBUVFKQkJCQWJJekU3QVFCQkJFRUVFQnNqUXhBY1FRVkJCQkFiSTBRUUhFRUdRUVFRR3lORkVCeEJCMEVFRUJzalJoQWNRUWhCQkJBYkkwY1FIRUVKUVFRUUd5TklFQnhCQ2tFRUVCc2pMaEFjQ3pRQVFRQkJCUkFiSTNnMkFnQkJCRUVGRUJzamVUWUNBRUVJUVFVUUd5TitFQnhCQzBFRkVCc2pmeEFjUVlYK0F5TjZFQVlMSXdCQkFFRUdFQnNqWERZQ0FFRUVRUVlRR3lOZE9nQUFRUVZCQmhBYkkxNDZBQUFMZUFCQkFFRUhFQnNqaVFFUUhFRUJRUWNRR3lPS0FUWUNBRUVGUVFjUUd5T0xBVFlDQUVFSlFRY1FHeU9NQVRZQ0FFRU9RUWNRR3lPTkFUWUNBRUVUUVFjUUd5T09BVG9BQUVFVVFRY1FHeU9QQVRvQUFFRVpRUWNRR3lPUUFSQWNRUnBCQnhBYkk1RUJOZ0lBUVI5QkJ4QWJJNUlCT3dFQUMxVUFRUUJCQ0JBYkk1TUJFQnhCQVVFSUVCc2psQUUyQWdCQkJVRUlFQnNqbFFFMkFnQkJDVUVJRUJzamxnRTJBZ0JCRGtFSUVCc2psd0UyQWdCQkUwRUlFQnNqbUFFNkFBQkJGRUVJRUJzam1RRTZBQUFMTVFCQkFFRUpFQnNqbWdFUUhFRUJRUWtRR3lPYkFUWUNBRUVGUVFrUUd5T2NBVFlDQUVFSlFRa1FHeU9kQVRzQkFBdEpBRUVBUVFvUUd5T2VBUkFjUVFGQkNoQWJJNThCTmdJQVFRVkJDaEFiSTZBQk5nSUFRUWxCQ2hBYkk2RUJOZ0lBUVE1QkNoQWJJNklCTmdJQVFSTkJDaEFiSTZNQk93RUFDeHdBRUIwUUhoQWZFQ0FRSVJBaUVDTVFKQkFsRUNZUUowRUFFQlVMRWdBZ0FDMEFBRUVBU2dSQVFRRVBDMEVBQzZNQkFFRUFRUUFRR3kwQUFDUTBRUUZCQUJBYkxRQUFKRFZCQWtFQUVCc3RBQUFrTmtFRFFRQVFHeTBBQUNRM1FRUkJBQkFiTFFBQUpEaEJCVUVBRUJzdEFBQWtPVUVHUVFBUUd5MEFBQ1E2UVFkQkFCQWJMUUFBSkR0QkNFRUFFQnN2QVFBa1BFRUtRUUFRR3k4QkFDUTlRUXhCQUJBYktBSUFKRDVCRVVFQUVCc1FLU1EvUVJKQkFCQWJFQ2trUUVFVFFRQVFHeEFwSkVGQkZFRUFFQnNRS1NSQ0Mwb0FRUWNnQUJBUUpLUUJRUVlnQUJBUUpLVUJRUVVnQUJBUUpLWUJRUVFnQUJBUUpLY0JRUU1nQUJBUUpLZ0JRUUlnQUJBUUpLa0JRUUVnQUJBUUpLb0JRUUFnQUJBUUpLc0JDeWtBUVFCQkFSQWJLQUlBSkVwQkJFRUJFQnN0QUFBa2hnRkJ4UDRERUFNa1MwSEEvZ01RQXhBckN5Z0FRUUJCQWhBYkVDa2tod0ZCQVVFQ0VCc1FLU1NJQVVILy93TVFBeEFSUVkvK0F4QURFQklMSHdBZ0FFSC9BWE1rckFGQkJDT3NBUkFRSkswQlFRVWpyQUVRRUNTdUFRc0tBRUdBL2dNUUF4QXVDMTRBUVFCQkJCQWJMd0VBSkMxQkFrRUVFQnN2QVFBa01VRUVRUVFRR3hBcEpFTkJCVUVFRUJzUUtTUkVRUVpCQkJBYkVDa2tSVUVIUVFRUUd4QXBKRVpCQ0VFRUVCc1FLU1JIUVFsQkJCQWJFQ2trU0VFS1FRUVFHeEFwSkM0TFJBQkJBRUVGRUJzb0FnQWtlRUVFUVFVUUd5Z0NBQ1I1UVFoQkJSQWJFQ2trZmtFTFFRVVFHeEFwSkg5QmhmNERFQU1rZWtHRy9nTVFBeVI3UVlmK0F4QURKSDBMQmdCQkFDUmZDeVVBUVFCQkJoQWJLQUlBSkZ4QkJFRUdFQnN0QUFBa1hVRUZRUVlRR3kwQUFDUmVFRElMZUFCQkFFRUhFQnNRS1NTSkFVRUJRUWNRR3lnQ0FDU0tBVUVGUVFjUUd5Z0NBQ1NMQVVFSlFRY1FHeWdDQUNTTUFVRU9RUWNRR3lnQ0FDU05BVUVUUVFjUUd5MEFBQ1NPQVVFVVFRY1FHeTBBQUNTUEFVRVpRUWNRR3hBcEpKQUJRUnBCQnhBYktBSUFKSkVCUVI5QkJ4QWJMd0VBSkpJQkMxVUFRUUJCQ0JBYkVDa2trd0ZCQVVFSUVCc29BZ0FrbEFGQkJVRUlFQnNvQWdBa2xRRkJDVUVJRUJzb0FnQWtsZ0ZCRGtFSUVCc29BZ0FrbHdGQkUwRUlFQnN0QUFBa21BRkJGRUVJRUJzdEFBQWttUUVMTVFCQkFFRUpFQnNRS1NTYUFVRUJRUWtRR3lnQ0FDU2JBVUVGUVFrUUd5Z0NBQ1NjQVVFSlFRa1FHeThCQUNTZEFRdEpBRUVBUVFvUUd4QXBKSjRCUVFGQkNoQWJLQUlBSko4QlFRVkJDaEFiS0FJQUpLQUJRUWxCQ2hBYktBSUFKS0VCUVE1QkNoQWJLQUlBSktJQlFSTkJDaEFiTHdFQUpLTUJDeUFBRUNvUUxCQXRFQzhRTUJBeEVETVFOQkExRURZUU4wRUFFQlVRRmhBWEN3VUFJNE1CQ3dVQUk0UUJDd1VBSTRVQkN3a0FJQUJCLy84RGNRc21BQ016QkVBalMwR1pBVVlFUUVFSUR3dEJrQWNQQ3lOTFFaa0JSZ1JBUVFRUEMwSElBd3NFQUJBOUN4VUFJQUJCZ0pCK2FpQUJRUUZ4UVExMGFpMEFBQXNPQUNBQlFhQUJiQ0FBYWtFRGJBc1ZBQ0FBSUFFUVFFR0EyQVZxSUFKcUlBTTZBQUFMQ3dBZ0FVR2dBV3dnQUdvTEVBQWdBQ0FCRUVKQmdLQUVhaTBBQUFzTkFDQUJRUUVnQUhSQmYzTnhDd29BSUFGQkFTQUFkSElMS3dFQmZ5QUNRUU54SVFRZ0EwRUJjUVJBUVFJZ0JCQkZJUVFMSUFBZ0FSQkNRWUNnQkdvZ0JEb0FBQXV1QWdFRGZ5QUJRUUJLSWdNRVFDQUFRUWhLSVFNTElBTUVRQ0FHSTdBQlJpRURDeUFEQkVBZ0FDT3hBVVloQXdzZ0F3UkFRUUFoQTBFQUlRWkJCU0FFUVFGckVBTVFFQVJBUVFFaEF3dEJCU0FFRUFNUUVBUkFRUUVoQmdzQ1FFRUFJUVFEUUNBRVFRaE9EUUVnQXlBR1J3UkFRUWNnQkdzaEJBc2dBQ0FFYWtHZ0FVd0VRQ0FBUVFnZ0JHdHJJUWdnQUNBRWFpQUJFRUJCZ05nRmFpRUpBa0JCQUNFRkEwQWdCVUVEVGcwQklBQWdCR29nQVNBRklBa2dCV290QUFBUVFTQUZRUUZxSVFVTUFBQUxBQXNnQUNBRWFpQUJRUUlnQ0NBQkVFTWlCUkJFUVFJZ0JSQVFFRVlnQjBFQmFpRUhDeUFFUVFGcUlRUU1BQUFMQUFzRklBWWtzQUVMSUFBanNRRk9CRUFnQUVFSWFpU3hBU0FBSUFKQkNHOGlCa2dFUUNPeEFTQUdhaVN4QVFzTElBY0xPQUVCZnlBQVFZQ1FBa1lFUUNBQlFZQUJhaUVDUVFjZ0FSQVFCRUFnQVVHQUFXc2hBZ3NnQUNBQ1FRUjBhZzhMSUFBZ0FVRUVkR29MSkFFQmZ5QUFRVDl4SVFJZ0FVRUJjUVJBSUFKQlFHc2hBZ3NnQWtHQWtBUnFMUUFBQ3hJQUlBQkIvd0Z4UVFoMElBRkIvd0Z4Y2dzZ0FRRi9JQUJCQTNRZ0FVRUJkR29pQTBFQmFpQUNFRWtnQXlBQ0VFa1FTZ3NWQUNBQlFSOGdBRUVGYkNJQWRIRWdBSFZCQTNRTFdRQWdBa0VCY1VVRVFDQUJFQU1nQUVFQmRIVkJBM0VoQUF0QjhnRWhBUUpBQWtBQ1FBSkFBa0FnQUVVTkJBSkFJQUJCQVdzT0F3SURCQUFMREFRQUN3QUxRYUFCSVFFTUFndEIyQUFoQVF3QkMwRUlJUUVMSUFFTERRQWdBU0FDYkNBQWFrRURiQXVyQWdFR2Z5QUJJQUFRU0NBRlFRRjBhaUlBSUFJUVB5RVJJQUJCQVdvZ0FoQS9JUklDUUNBRElRQURRQ0FBSUFSS0RRRWdCaUFBSUFOcmFpSU9JQWhJQkVBZ0FDRUJJQXhCQUVnaUFrVUVRRUVGSUF3UUVFVWhBZ3NnQWdSQVFRY2dBV3NoQVF0QkFDRUNJQUVnRWhBUUJFQkJBaUVDQ3lBQklCRVFFQVJBSUFKQkFXb2hBZ3NnREVFQVRnUi9RUUFnREVFSGNTQUNRUUFRU3lJRkVFd2hEMEVCSUFVUVRDRUJRUUlnQlJCTUJTQUxRUUJNQkVCQngvNERJUXNMSUFJZ0N5QUtFRTBpQlNFUElBVWlBUXNoQlNBSklBNGdCeUFJRUU1cUloQWdEem9BQUNBUVFRRnFJQUU2QUFBZ0VFRUNhaUFGT2dBQVFRQWhBU0FNUVFCT0JFQkJCeUFNRUJBaEFRc2dEaUFISUFJZ0FSQkdJQTFCQVdvaERRc2dBRUVCYWlFQURBQUFDd0FMSUEwTGhRRUJBMzhnQTBFSWJ5RURJQUJGQkVBZ0FpQUNRUWh0UVFOMGF5RUhDMEVISVFnZ0FFRUlha0dnQVVvRVFFR2dBU0FBYXlFSUMwRi9JUUlqTHdSQVFRTWdCRUVCRUQ4aUFrSC9BWEVRRUFSQVFRRWhDUXRCQmlBQ0VCQUVRRUVISUFOcklRTUxDeUFHSUFVZ0NTQUhJQWdnQXlBQUlBRkJvQUZCZ05nRlFRQkJBQ0FDRUU4TDNRRUFJQVVnQmhCSUlRWWdCRUVCRUQ4aEJDQURRUWh2SVFOQkJpQUVFQkFFUUVFSElBTnJJUU1MUVFBaEJVRURJQVFRRUFSQVFRRWhCUXNnQmlBRFFRRjBhaUlESUFVUVB5RUdJQU5CQVdvZ0JSQS9JUVVnQWtFSWJ5RURRUVVnQkJBUVJRUkFRUWNnQTJzaEF3dEJBQ0VDSUFNZ0JSQVFCRUJCQWlFQ0N5QURJQVlRRUFSQUlBSkJBV29oQWd0QkFDQUVRUWR4SUFKQkFCQkxJZ01RVENFRlFRRWdBeEJNSVFaQkFpQURFRXdoQXlBQUlBRkJBQ0FGRUVFZ0FDQUJRUUVnQmhCQklBQWdBVUVDSUFNUVFTQUFJQUVnQWtFSElBUVFFQkJHQzM4QUlBUWdCUkJJSUFOQkNHOUJBWFJxSWdSQkFCQS9JUVZCQUNFRElBUkJBV3BCQUJBL0lRUkJCeUFDUVFodmF5SUNJQVFRRUFSQVFRSWhBd3NnQWlBRkVCQUVRQ0FEUVFGcUlRTUxJQUFnQVVFQUlBTkJ4LzREUVFBUVRTSUNFRUVnQUNBQlFRRWdBaEJCSUFBZ0FVRUNJQUlRUVNBQUlBRWdBMEVBRUVZTDNBRUJCbjhnQTBFRGRTRUxBa0FEUUNBRVFhQUJUZzBCSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUNJQXRCQlhScUlBWkJBM1ZxSWdsQkFCQS9JUWRCQUNFS0l5d0VRQ0FFSUFBZ0JpQURJQWtnQVNBSEVFY2lDRUVBU2dSQUlBUWdDRUVCYTJvaEJFRUJJUW9MQ3lNckJIOGdDa1VGSXlzTElnZ0VRQ0FFSUFBZ0JpQURJQWtnQVNBSEVGQWlDRUVBU2dSQUlBUWdDRUVCYTJvaEJBc0ZJQXBGQkVBakx3UkFJQVFnQUNBR0lBTWdDU0FCSUFjUVVRVWdCQ0FBSUFZZ0F5QUJJQWNRVWdzTEN5QUVRUUZxSVFRTUFBQUxBQXNMTEFFQ2Z5Tk1JUVFnQUNOTmFpSURRWUFDVGdSQUlBTkJnQUpySVFNTElBQWdBU0FDSUFOQkFDQUVFRk1MTUFFRGZ5Tk9JUU1nQUNOUElnUklCRUFQQ3lBRFFRZHJJZ05CZjJ3aEJTQUFJQUVnQWlBQUlBUnJJQU1nQlJCVEM0WUZBUkIvQWtCQkp5RUpBMEFnQ1VFQVNBMEJJQWxCQW5RaUEwR0EvQU5xRUFNaEFpQURRWUg4QTJvUUF5RUxJQU5CZ3Z3RGFoQURJUVFnQWtFUWF5RUNJQXRCQ0dzaEMwRUlJUVVnQVVFQmNRUkFRUkFoQlNBRVFRSnZRUUZHQkVBZ0JFRUJheUVFQ3dzZ0FDQUNUaUlHQkVBZ0FDQUNJQVZxU0NFR0N5QUdCRUJCQnlBRFFZUDhBMm9RQXlJR0VCQWhERUVHSUFZUUVDRURRUVVnQmhBUUlROGdBQ0FDYXlFQ0lBTUVRQ0FDSUFWclFYOXNRUUZySVFJTFFZQ0FBaUFFRUVnZ0FrRUJkR29oQkVFQUlRSWpMd1IvUVFNZ0JoQVFCU012Q3lJREJFQkJBU0VDQ3lBRUlBSVFQeUVRSUFSQkFXb2dBaEEvSVJFQ1FFRUhJUVVEUUNBRlFRQklEUUVnQlNFQ0lBOEVRQ0FDUVFkclFYOXNJUUlMUVFBaENDQUNJQkVRRUFSQVFRSWhDQXNnQWlBUUVCQUVRQ0FJUVFGcUlRZ0xJQWdFUUNBTFFRY2dCV3RxSWdkQkFFNGlBZ1JBSUFkQm9BRk1JUUlMSUFJRVFFRUFJUUpCQUNFTlFRQWhEaU12Qkg4anF3RkZCU012Q3lJRUJFQkJBU0VDQ3lBQ1JRUkFJQWNnQUJCRElncEJBM0VoQXlBTUJIOGdBMEVBU2dVZ0RBc2lCQVJBUVFFaERRVWpMd1IvUVFJZ0NoQVFCU012Q3lJRUJFQWdBMEVBU2lFRUN5QUVCRUJCQVNFT0N3c0xJQUpGQkVBZ0RVVWlBd1IvSUE1RkJTQURDeUVDQ3lBQ0JFQWpMd1JBUVFBZ0JrRUhjU0FJUVFFUVN5SURFRXdoQkVFQklBTVFUQ0VDUVFJZ0F4Qk1JUU1nQnlBQVFRQWdCQkJCSUFjZ0FFRUJJQUlRUVNBSElBQkJBaUFERUVFRlFjaitBeUVEUVFRZ0JoQVFCRUJCeWY0RElRTUxJQWNnQUVFQUlBZ2dBMEVBRUUwaUNoQkJJQWNnQUVFQklBb1FRU0FISUFCQkFpQUtFRUVMQ3dzTElBVkJBV3NoQlF3QUFBc0FDd3NnQ1VFQmF5RUpEQUFBQ3dBTEMyMEJBbjlCZ0pBQ0lRSWpwd0VFUUVHQWdBSWhBZ3NqTHdSL0l5OEZJNnNCQ3lJQkJFQkJnTEFDSVFFanFBRUVRRUdBdUFJaEFRc2dBQ0FDSUFFUVZBc2pwZ0VFUUVHQXNBSWhBU09sQVFSQVFZQzRBaUVCQ3lBQUlBSWdBUkJWQ3lPcUFRUkFJQUFqcVFFUVZnc0xKUUVCZndKQUEwQWdBRUdRQVVzTkFTQUFRZjhCY1JCWElBQkJBV29oQUF3QUFBc0FDd3RLQVFKL0FrQURRQ0FBUVpBQlRnMEJBa0JCQUNFQkEwQWdBVUdnQVU0TkFTQUJJQUFRUWtHQW9BUnFRUUE2QUFBZ0FVRUJhaUVCREFBQUN3QUxJQUJCQVdvaEFBd0FBQXNBQ3dzTUFFRi9KTEFCUVg4a3NRRUxEZ0FqTXdSQVFmQUZEd3RCK0FJTERnQWpNd1JBUWZJRER3dEIrUUVMR2dFQmZ5QUFRWS8rQXhBREVFVWlBU1IzUVkvK0F5QUJFQVlMQ2dCQkFTUjBRUUVRWFFzT0FDTXpCRUJCcmdFUEMwSFhBQXNRQUNNekJFQkJnSUFCRHd0QmdNQUFDeTRCQVg4ampBRkJBRW9pQUFSQUk3WUJJUUFMSUFBRVFDT01BVUVCYXlTTUFRc2pqQUZGQkVCQkFDU0pBUXNMTGdFQmZ5T1dBVUVBU2lJQUJFQWp0d0VoQUFzZ0FBUkFJNVlCUVFGckpKWUJDeU9XQVVVRVFFRUFKSk1CQ3dzdUFRRi9JNXdCUVFCS0lnQUVRQ080QVNFQUN5QUFCRUFqbkFGQkFXc2tuQUVMSTV3QlJRUkFRUUFrbWdFTEN5NEJBWDhqb1FGQkFFb2lBQVJBSTdrQklRQUxJQUFFUUNPaEFVRUJheVNoQVFzam9RRkZCRUJCQUNTZUFRc0xJZ0VCZnlPU0FTTzdBWFVoQUNPOEFRUi9JNUlCSUFCckJTT1NBU0FBYWdzaUFBdEZBUUovUVpUK0F4QURRZmdCY1NFQlFaUCtBeUFBUWY4QmNTSUNFQVpCbFA0RElBRWdBRUVJZFNJQWNoQUdJQUlrdlFFZ0FDUytBU08rQVVFSWRDTzlBWElrdndFTE9RRUNmeEJsSWdCQi93OU1JZ0VFUUNPN0FVRUFTaUVCQ3lBQkJFQWdBQ1NTQVNBQUVHWVFaU0VBQ3lBQVFmOFBTZ1JBUVFBa2lRRUxDeThBSTVFQlFRRnJKSkVCSTVFQlFRQk1CRUFqdWdFa2tRRWprQUVFZnlPNkFVRUFTZ1Vqa0FFTEJFQVFad3NMQzJBQkFYOGppd0ZCQVdza2l3RWppd0ZCQUV3RVFDUEFBU1NMQVNPTEFRUkFJOEVCQkg4ampRRkJEMGdGSThFQkN5SUFCRUFqalFGQkFXb2tqUUVGSThFQlJTSUFCRUFqalFGQkFFb2hBQXNnQUFSQUk0MEJRUUZySkkwQkN3c0xDd3RnQVFGL0k1VUJRUUZySkpVQkk1VUJRUUJNQkVBandnRWtsUUVqbFFFRVFDUERBUVIvSTVjQlFROUlCU1BEQVFzaUFBUkFJNWNCUVFGcUpKY0JCU1BEQVVVaUFBUkFJNWNCUVFCS0lRQUxJQUFFUUNPWEFVRUJheVNYQVFzTEN3c0xZQUVCZnlPZ0FVRUJheVNnQVNPZ0FVRUFUQVJBSThRQkpLQUJJNkFCQkVBanhRRUVmeU9pQVVFUFNBVWp4UUVMSWdBRVFDT2lBVUVCYWlTaUFRVWp4UUZGSWdBRVFDT2lBVUVBU2lFQUN5QUFCRUFqb2dGQkFXc2tvZ0VMQ3dzTEM0MEJBUUYvSTF3Z0FHb2tYQ05jRUdCT0JFQWpYQkJnYXlSY0FrQUNRQUpBQWtBQ1FDTmVJZ0VFUUFKQUlBRkJBbXNPQmdJQUF3QUVCUUFMREFVTEVHRVFZaEJqRUdRTUJBc1FZUkJpRUdNUVpCQm9EQU1MRUdFUVloQmpFR1FNQWdzUVlSQmlFR01RWkJCb0RBRUxFR2tRYWhCckN5TmVRUUZxSkY0alhrRUlUZ1JBUVFBa1hndEJBUThMUVFBTEhRQWp4Z0VnQUdva3hnRWppZ0VqeGdGclFRQktCRUJCQUE4TFFRRUxnd0VCQVg4Q1FBSkFBa0FDUUNBQVFRRkhCRUFnQUNJQlFRSkdEUUVnQVVFRFJnMENJQUZCQkVZTkF3d0VDeU5sSThjQlJ3UkFJOGNCSkdWQkFROExRUUFQQ3lObUk4Z0JSd1JBSThnQkpHWkJBUThMUVFBUEN5Tm5JOGtCUndSQUk4a0JKR2RCQVE4TFFRQVBDeU5vSThvQlJ3UkFJOG9CSkdoQkFROExRUUFQQzBFQUN4MEFJOHNCSUFCcUpNc0JJNVFCSThzQmEwRUFTZ1JBUVFBUEMwRUJDeWtBSTh3QklBQnFKTXdCSTVzQkk4d0JhMEVBU2lJQUJFQWpZRVVoQUFzZ0FBUkFRUUFQQzBFQkN4MEFJODBCSUFCcUpNMEJJNThCSTgwQmEwRUFTZ1JBUVFBUEMwRUJDeDBBUVlBUUk3OEJhMEVDZENTS0FTTXpCRUFqaWdGQkFYUWtpZ0VMQzBVQkFYOENRQUpBQWtBZ0FFRUJSd1JBSUFBaUFrRUNSZzBCSUFKQkEwWU5BZ3dEQ3lBQlFZRUJFQkFQQ3lBQlFZY0JFQkFQQ3lBQlFmNEFFQkFQQ3lBQlFRRVFFQXQvQVFGL0k0b0JJQUJySklvQkk0b0JRUUJNQkVBamlnRWhBQkJ5STRvQklBQkJBQ0FBYXlBQVFRQktHMnNraWdFamp3RkJBV29randFamp3RkJDRTRFUUVFQUpJOEJDd3NqaVFFRWZ5UEhBUVVqaVFFTElnQUVmeU9OQVFWQkR3OExJUUJCQVNFQkk4NEJJNDhCRUhORkJFQkJmeUVCQ3lBQklBQnNRUTlxQ3hJQkFYOGp4Z0VoQUVFQUpNWUJJQUFRZEFzZEFFR0FFQ1BQQVd0QkFuUWtsQUVqTXdSQUk1UUJRUUYwSkpRQkN3dC9BUUYvSTVRQklBQnJKSlFCSTVRQlFRQk1CRUFqbEFFaEFCQjJJNVFCSUFCQkFDQUFheUFBUVFCS0cyc2tsQUVqbVFGQkFXb2ttUUVqbVFGQkNFNEVRRUVBSkprQkN3c2prd0VFZnlQSUFRVWprd0VMSWdBRWZ5T1hBUVZCRHc4TElRQkJBU0VCSTlBQkk1a0JFSE5GQkVCQmZ5RUJDeUFCSUFCc1FROXFDeElCQVg4anl3RWhBRUVBSk1zQklBQVFkd3NkQUVHQUVDUFJBV3RCQVhRa213RWpNd1JBSTVzQlFRRjBKSnNCQ3dzRUFDQUFDNGdDQVFKL0k1c0JJQUJySkpzQkk1c0JRUUJNQkVBam13RWhBaEI1STVzQklBSkJBQ0FDYXlBQ1FRQktHMnNrbXdFam5RRkJBV29rblFFam5RRkJJRTRFUUVFQUpKMEJDd3RCQUNFQ0k5SUJJUUFqbWdFRWZ5UEpBUVVqbWdFTElnRUVRQ05nQkVCQm5QNERFQU5CQlhWQkQzRWlBQ1RTQVVFQUpHQUxCVUVQRHdzam5RRkJBbTBRZWtHdy9nTnFFQU1oQVNPZEFVRUNid1IvSUFGQkQzRUZJQUZCQkhWQkQzRUxJUUVDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCSUFCQkFrWU5BZ3dEQ3lBQlFRUjFJUUVNQXd0QkFTRUNEQUlMSUFGQkFYVWhBVUVDSVFJTUFRc2dBVUVDZFNFQlFRUWhBZ3NnQWtFQVNnUi9JQUVnQW0wRlFRQUxJZ0ZCRDJvTEVnRUJmeVBNQVNFQVFRQWt6QUVnQUJCN0N4c0JBWDhqMHdFajFBRjBJUUFqTXdSQUlBQkJBWFFoQUFzZ0FBdXZBUUVCZnlPZkFTQUFheVNmQVNPZkFVRUFUQVJBSTU4QklRQVFmU1NmQVNPZkFTQUFRUUFnQUdzZ0FFRUFTaHRySko4Qkk2TUJRUUZ4SVFFam93RkJBWFZCQVhFaEFDT2pBVUVCZFNTakFTT2pBU0FCSUFCeklnRkJEblJ5SktNQkk5VUJCRUFqb3dGQnYzOXhKS01CSTZNQklBRkJCblJ5SktNQkN3c2puZ0VFZnlQS0FRVWpuZ0VMSWdBRWZ5T2lBUVZCRHc4TElRRkJBQ09qQVJBUUJIOUJmd1ZCQVFzaUFDQUJiRUVQYWdzU0FRRi9JODBCSVFCQkFDVE5BU0FBRUg0TEVnQWpNd1JBUVlDQWdBUVBDMEdBZ0lBQ0N3VUFFSUFCQ3pvQUlBQkJQRVlFUUVIL0FBOExJQUJCUEd0Qm9JMEdiQ0FCYkVFSWJSQjZRYUNOQm0wUWVrRThha0dnalFac1FZenhBaEI2YlJCNkVIb0x1Z0VCQVg5QkFDUnJJMU1FZnlBQUJVRVBDeUVFSTFRRWZ5QUVJQUZxQlNBRVFROXFDeUVFSTFVRWZ5QUVJQUpxQlNBRVFROXFDeUVFSTFZRWZ5QUVJQU5xQlNBRVFROXFDeUVFSTFjRWZ5QUFCVUVQQ3lFQUkxZ0VmeUFBSUFGcUJTQUFRUTlxQ3lFQUkxa0VmeUFBSUFKcUJTQUFRUTlxQ3lFQUkxb0VmeUFBSUFOcUJTQUFRUTlxQ3lFQVFRQWtiRUVBSkcwZ0JDTlJRUUZxRUlJQklRRWdBQ05TUVFGcUVJSUJJUUFnQVNScElBQWthaUFCSUFBUVNnc2xBUUYvSUFKQkFYUkJnUGdqYWlJRElBQkJBV282QUFBZ0EwRUJhaUFCUVFGcU9nQUFDNW9DQVFSL0lBQVFiU0lCUlFSQVFRRVFiaUVCQ3lBQUVHOGlBa1VFUUVFQ0VHNGhBZ3NnQUJCd0lnTkZCRUJCQXhCdUlRTUxJQUFRY1NJRVJRUkFRUVFRYmlFRUN5QUJRUUZ4QkVBUWRTUmhDeUFDUVFGeEJFQVFlQ1JpQ3lBRFFRRnhCRUFRZkNSakN5QUVRUUZ4QkVBUWZ5UmtDeUFCUVFGeFJRUkFJQUloQVFzZ0FVRUJjVVVFUUNBRElRRUxJQUZCQVhGRkJFQWdCQ0VCQ3lBQlFRRnhCRUJCQVNSdEN5TmRJQUFqMWdGc2FpUmRJMTBRZ1FGT0JFQWpYUkNCQVdza1hTTnRCSDhqYlFVamF3c2lBVVVFUUNOc0lRRUxJQUVFUUNOaEkySWpZeU5rRUlNQkdnc2phVUVCYWlOcVFRRnFJMThRaEFFalgwRUJhaVJmSTljQlFRSnRFSHBCQVdzaEFTTmZJQUZPQkVBalgwRUJheVJmQ3dzTERBQWdBRUdBL2dOeFFRaDFDd2dBSUFCQi93RnhDNU1CQVFSL0lBQVFkQkI2SVFFZ0FCQjNFSG9oQWlBQUVIc1FlaUVESUFBUWZoQjZJUVFnQVNSaElBSWtZaUFESkdNZ0JDUmtJMTBnQUNQV0FXeHFKRjBqWFJDQkFVNEVRQ05kRUlFQmF5UmRJQUVnQWlBRElBUVFnd0VpQUJDR0FVRUJhaUFBRUljQlFRRnFJMThRaEFFalgwRUJhaVJmSTljQlFRSnRFSHBCQVdzaEFDTmZJQUJPQkVBalgwRUJheVJmQ3dzTEpRRUJmeUFBRUd3aEFTTXFCSDhnQVVVRkl5b0xJZ0VFUUNBQUVJVUJCU0FBRUlnQkN3c2tBQ05RRUY5SUJFQVBDd05BSTFBUVgwNEVRQkJmRUlrQkkxQVFYMnNrVUF3QkN3c0xjd0VCZnlBQVFhYitBMFlFUUVHbS9nTVFBMEdBQVhFaEFTT0pBUVIvUVFBZ0FSQkZCVUVBSUFFUVJBc2FJNU1CQkg5QkFTQUJFRVVGUVFFZ0FSQkVDeG9qbWdFRWYwRUNJQUVRUlFWQkFpQUJFRVFMR2lPZUFRUi9RUU1nQVJCRkJVRURJQUVRUkFzYUlBRkI4QUJ5RHd0QmZ3dkVBUUVCZnlPc0FTRUFJNjBCQkVBajJBRUVmMEVDSUFBUVJBVkJBaUFBRUVVTElRQWoyUUVFZjBFQUlBQVFSQVZCQUNBQUVFVUxJUUFqMmdFRWYwRURJQUFRUkFWQkF5QUFFRVVMSVFBajJ3RUVmMEVCSUFBUVJBVkJBU0FBRUVVTElRQUZJNjRCQkVBajNBRUVmMEVBSUFBUVJBVkJBQ0FBRUVVTElRQWozUUVFZjBFQklBQVFSQVZCQVNBQUVFVUxJUUFqM2dFRWYwRUNJQUFRUkFWQkFpQUFFRVVMSVFBajN3RUVmMEVESUFBUVJBVkJBeUFBRUVVTElRQUxDeUFBUWZBQmNndlVBZ0VCZnlBQVFZQ0FBa2dFUUVGL0R3c2dBRUdBZ0FKT0lnRUVRQ0FBUVlEQUFrZ2hBUXNnQVFSQVFYOFBDeUFBUVlEQUEwNGlBUVJBSUFCQmdQd0RTQ0VCQ3lBQkJFQWdBRUdBUUdvUUF3OExJQUJCZ1B3RFRpSUJCRUFnQUVHZi9RTk1JUUVMSUFFRVFDT0dBVUVDU0FSQVFmOEJEd3RCZnc4TElBQkJ6ZjREUmdSQVFmOEJJUUZCQUVITi9nTVFBeEFRUlFSQVFRQkIvd0VRUkNFQkN5TXpSUVJBUVFjZ0FSQkVJUUVMSUFFUEN5QUFRY1QrQTBZRVFDQUFJMHNRQmlOTER3c2dBRUdRL2dOT0lnRUVRQ0FBUWFiK0Ewd2hBUXNnQVFSQUVJb0JJQUFRaXdFUEN5QUFRYkQrQTA0aUFRUkFJQUJCdi80RFRDRUJDeUFCQkVBUWlnRkJmdzhMSUFCQmhQNERSZ1JBSUFBamVSQ0dBU0lCRUFZZ0FROExJQUJCaGY0RFJnUkFJQUFqZWhBR0kzb1BDeUFBUVkvK0EwWUVRQ04zUWVBQmNnOExJQUJCZ1A0RFJnUkFFSXdCRHd0QmZ3c2NBUUYvSUFBUWpRRWlBVUYvUmdSQUlBQVFBdzhMSUFGQi93RnhDKzBDQVFKL0kwVUVRQThMSUFCQi96OU1CRUFqUndSL1FRUWdBVUgvQVhFUUVFVUZJMGNMSWdCRkJFQWdBVUVQY1NJQ0JFQWdBa0VLUmdSQVFRRWtRd3NGUVFBa1F3c0xCU0FBUWYvL0FFd0VRQ011UlNJQ1JRUkFJQUJCLzk4QVRDRUNDeUFDQkVBalJ3UkFJQUZCRDNFa0xRc2dBU0VDSTBZRVFDQUNRUjl4SVFJakxVSGdBWEVrTFFValNBUkFJQUpCL3dCeElRSWpMVUdBQVhFa0xRVWpMZ1JBUVFBa0xRc0xDeU10SUFKeUpDMEZRUUFoQWlNdEVJY0JJUU1nQVVFQVNnUkFRUUVoQWdzZ0FpQURFRW9rTFFzRkkwZEZJZ01FUUNBQVFmKy9BVXdoQXdzZ0F3UkFJMFlFZnlORUJTTkdDeUlBQkVBakxVRWZjU1F0SXkwZ0FVSGdBWEZ5SkMwUEN5TklCRUFnQVVFSVRpSURCRUFnQVVFTVRDRURDd3NnQVNFREl5NEVmeUFEUVE5eEJTQURRUU54Q3lJREpERUZJMGRGSWdNRVFDQUFRZi8vQVV3aEF3c2dBd1JBSTBZRVFFRUFJQUZCL3dGeEVCQUVRRUVCSkVRRlFRQWtSQXNMQ3dzTEN3c2ZBQ0FBUWZBQWNVRUVkU1M2QVVFRElBQVFFQ1M4QVNBQVFRZHhKTHNCQ3dzQVFRY2dBQkFRSk1rQkN4OEFJQUJCQm5WQkEzRWt6Z0VnQUVFL2NTVGdBVUhBQUNQZ0FXc2tqQUVMSHdBZ0FFRUdkVUVEY1NUUUFTQUFRVDl4Sk9FQlFjQUFJK0VCYXlTV0FRc1JBQ0FBSk9JQlFZQUNJK0lCYXlTY0FRc1VBQ0FBUVQ5eEpPTUJRY0FBSStNQmF5U2hBUXNxQUNBQVFRUjFRUTl4Sk9RQlFRTWdBQkFRSk1FQklBQkJCM0Vrd0FFZ0FFSDRBWEZCQUVva3h3RUxLZ0FnQUVFRWRVRVBjU1RsQVVFRElBQVFFQ1REQVNBQVFRZHhKTUlCSUFCQitBRnhRUUJLSk1nQkN3MEFJQUJCQlhWQkQzRWs1Z0VMS2dBZ0FFRUVkVUVQY1NUbkFVRURJQUFRRUNURkFTQUFRUWR4Sk1RQklBQkIrQUZ4UVFCS0pNb0JDeFFBSUFBa3ZRRWp2Z0ZCQ0hRanZRRnlKTDhCQ3hRQUlBQWs2QUVqNlFGQkNIUWo2QUZ5Sk04QkN4UUFJQUFrNmdFajZ3RkJDSFFqNmdGeUpORUJDNFFCQVFGL0lBQkJCSFVrMUFGQkF5QUFFQkFrMVFFZ0FFRUhjU1RzQVFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FqN0FFaUFRUkFBa0FnQVVFQmF3NEhBZ01FQlFZSENBQUxEQWdMUVFnazB3RVBDMEVRSk5NQkR3dEJJQ1RUQVE4TFFUQWswd0VQQzBIQUFDVFRBUThMUWRBQUpOTUJEd3RCNEFBazB3RVBDMEh3QUNUVEFRc0xJQUJCQmlBQUVCQWt0Z0VnQUVFSGNTUytBU08rQVVFSWRDTzlBWElrdndFTGFnRUJmMEVCSklrQkk0d0JSUVJBUWNBQUpJd0JDeEJ5SThBQkpJc0JJK1FCSkkwQkk3OEJKSklCSTdvQkpKRUJJN29CUVFCS0lnQUVRQ083QVVFQVNpRUFDeUFBQkVCQkFTU1FBUVZCQUNTUUFRc2p1d0ZCQUVvRVFCQm5DeVBIQVVVRVFFRUFKSWtCQ3dzZ0FFRUdJQUFRRUNTM0FTQUFRUWR4Sk9rQkkra0JRUWgwSStnQmNpVFBBUXN1QUVFQkpKTUJJNVlCUlFSQVFjQUFKSllCQ3hCMkk4SUJKSlVCSStVQkpKY0JJOGdCUlFSQVFRQWtrd0VMQ3lBQVFRWWdBQkFRSkxnQklBQkJCM0VrNndFajZ3RkJDSFFqNmdGeUpORUJDeWNBUVFFa21nRWpuQUZGQkVCQmdBSWtuQUVMRUhsQkFDU2RBU1BKQVVVRVFFRUFKSm9CQ3dzTEFFRUdJQUFRRUNTNUFRczRBRUVCSko0Qkk2RUJSUVJBUWNBQUpLRUJDeEI5Sko4Qkk4UUJKS0FCSStjQkpLSUJRZi8vQVNTakFTUEtBVVVFUUVFQUpKNEJDd3NUQUNBQVFRUjFRUWR4SkZFZ0FFRUhjU1JTQzBJQVFRY2dBQkFRSkZaQkJpQUFFQkFrVlVFRklBQVFFQ1JVUVFRZ0FCQVFKRk5CQXlBQUVCQWtXa0VDSUFBUUVDUlpRUUVnQUJBUUpGaEJBQ0FBRUJBa1Z3c0tBRUVISUFBUUVDUmJDNVFEQVFGL0FrQWdBRUdtL2dOSElnSUVRQ05iUlNFQ0N5QUNCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFrR1EvZ05IQkVBQ1FDQUNRWkgrQTJzT0ZnTUhDdzhBQkFnTUVBSUZDUTBSQUFZS0RoSVRGQlVBQ3d3VkN5QUJFSkFCREJVTElBRVFrUUVNRkFzZ0FSQ1NBUXdUQ3lBQkVKTUJEQklMSUFFUWxBRU1FUXNnQVJDVkFRd1FDeUFCRUpZQkRBOExJQUVRbHdFTURndEJBU1JnSUFFUW1BRU1EUXNnQVJDWkFRd01DeUFCRUpvQkRBc0xJQUVRbXdFTUNnc2dBUkNjQVF3SkN5QUJFSjBCREFnTFFRY2dBUkFRQkVBZ0FSQ2VBUkNmQVFzTUJ3dEJCeUFCRUJBRVFDQUJFS0FCRUtFQkN3d0dDMEVISUFFUUVBUkFJQUVRb2dFUW93RUxEQVVMUVFjZ0FSQVFCRUFnQVJDa0FSQ2xBUXNNQkFzZ0FSQ21BVUVCSkdzTUF3c2dBUkNuQVVFQkpHd01BZ3NnQVJDb0FVRUhJQUVRRUVVRVFBSkFRWkQrQXlFQ0EwQWdBa0dtL2dOT0RRRWdBa0VBRUFZZ0FrRUJhaUVDREFBQUN3QUxDd3dCQzBFQkR3dEJBUXNjQUVIQi9nTkJCeUFBUWZnQmNVSEIvZ01RQTBFSGNYSVFSUkFHQ3o0QkFYOGdBRUVJZENFQkFrQkJBQ0VBQTBBZ0FFR2ZBVW9OQVNBQVFZRDhBMm9nQVNBQWFoQURFQVlnQUVFQmFpRUFEQUFBQ3dBTFFZUUZKSzhCQ3hNQUkrOEJFQU1qOEFFUUF4QktRZkQvQTNFTEZ3QWo4UUVRQXlQeUFSQURFRXBCOEQ5eFFZQ0FBbW9MaXdFQkEzOGpMMFVFUUE4TEk3SUJCSDlCQnlBQUVCQkZCU095QVFzaUFRUkFRUUFrc2dFajdnRVFBeUVCSSs0QlFRY2dBUkJGRUFZUEN4Q3NBU0VCRUswQklRSkJCeUFBRUVSQkFXcEJCSFFoQTBFSElBQVFFQVJBUVFFa3NnRWdBeVN6QVNBQkpMUUJJQUlrdFFFajdnRkJCeUFBRUVRUUJnVWdBU0FDSUFNUXZnRWo3Z0ZCL3dFUUJnc0xKZ0VCZnlBQVFUOXhJUU1nQWtFQmNRUkFJQU5CUUdzaEF3c2dBMEdBa0FScUlBRTZBQUFMR0FCQkJ5QUFFQkFFUUNBQlFRY2dBRUVCYWhCRkVBWUxDMG9CQW44Z0FDUDFBVVlpQWtVRVFDQUFJL1FCUmlFQ0N5QUNCRUJCQmlBQVFRRnJFQU1RUkNFQ0lBQWo5QUZHQkVCQkFTRURDeUFDSUFFZ0F4Q3ZBU0FDSUFCQkFXc1FzQUVMQ3dvQVFRRWtkVUVDRUYwTFBBRUJmd0pBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVNBQlFRSkdEUUlnQVVFRFJnMEREQVFMUVFrUEMwRUREd3RCQlE4TFFRY1BDMEVBQ3ljQkFYOGpmUkN6QVNJQ0lBQVFFQ0lBQkVBZ0FpQUJFQkJGSVFBTElBQUVRRUVCRHd0QkFBc2FBQ042UVFGcUpIb2pla0gvQVVvRVFFRUJKSDVCQUNSNkN3dG1BUUovQTBBZ0FTQUFTQVJBSTNraEFpQUJRUVJxSVFFamVVRUVhaVI1STNsQi8vOERTZ1JBSTNsQmdJQUVheVI1Q3lOOEJFQWpmZ1JBSTNza2VoQ3lBVUVBSkg1QkFTUi9CU04vQkVCQkFDUi9Dd3NnQWlONUVMUUJCRUFRdFFFTEN3d0JDd3NMQ3dBamVCQzJBVUVBSkhnTEtRQWplU0VBUVFBa2VVR0UvZ05CQUJBR0kzd0VmeUFBSTNrUXRBRUZJM3dMSWdBRVFCQzFBUXNMR2dBamZBUkFJMzhFUUE4TEkzNEVRRUVBSkg0TEN5QUFKSG9MR3dBZ0FDUjdJM3dFZnlOL0JTTjhDd1JBSTNza2VrRUFKSDhMQzFnQkFuOGpmQ0VCUVFJZ0FCQVFKSHdnQUVFRGNTRUNJQUZGQkVBamZSQ3pBU0VBSUFJUXN3RWhBU044QkVBZ0FDTjVFQkFoQUFVZ0FDTjVFQkFpQUFSQUlBRWplUkFRSVFBTEN5QUFCRUFRdFFFTEN5QUNKSDBMMFFVQkFYOENRQUpBSUFCQnpmNERSZ1JBUWMzK0F5QUJRUUZ4RUFZTUFnc2dBRUdBZ0FKSUJFQWdBQ0FCRUk4QkRBSUxJQUJCZ0lBQ1RpSUNCRUFnQUVHQXdBSklJUUlMSUFJTkFDQUFRWURBQTA0aUFnUkFJQUJCZ1B3RFNDRUNDeUFDQkVBZ0FFR0FRR29nQVJBR0RBRUxJQUJCZ1B3RFRpSUNCRUFnQUVHZi9RTk1JUUlMSUFJRVFDT0dBVUVDU0EwQ0RBRUxJQUJCb1AwRFRpSUNCRUFnQUVILy9RTk1JUUlMSUFJTkFTQUFRWkQrQTA0aUFnUkFJQUJCcHY0RFRDRUNDeUFDQkVBUWlnRWdBQ0FCRUtrQkR3c2dBRUd3L2dOT0lnSUVRQ0FBUWIvK0Ewd2hBZ3NnQWdSQUVJb0JDeUFBUWNEK0EwNGlBZ1JBSUFCQnkvNERUQ0VDQ3lBQ0JFQWdBRUhBL2dOR0JFQWdBUkFyREFJTElBQkJ3ZjREUmdSQUlBRVFxZ0VNQXdzZ0FFSEUvZ05HQkVCQkFDUkxJQUJCQUJBR0RBTUxJQUJCeGY0RFJnUkFJQUVrN1FFTUFnc2dBRUhHL2dOR0JFQWdBUkNyQVF3Q0N3SkFBa0FDUUFKQUlBQWlBa0hEL2dOSEJFQUNRQ0FDUWNMK0Eyc09DZ0lBQUFBQUFBQUFCQU1BQ3d3RUN5QUJKRXdNQlFzZ0FTUk5EQVFMSUFFa1Rnd0RDeUFCSkU4TUFnc01BUXNnQUNQdUFVWUVRQ0FCRUs0QkRBSUxJQUFqTWtZaUFrVUVRQ0FBSXpCR0lRSUxJQUlFUUNPeUFRUkFJN1FCUVlDQUFVNGlBZ1JBSTdRQlFmLy9BVXdoQWdzZ0FrVUVRQ08wQVVHQW9BTk9JZ0lFUUNPMEFVSC92d05NSVFJTEN5QUNEUU1MQ3lBQUkvTUJUaUlDQkVBZ0FDUDBBVXdoQWdzZ0FnUkFJQUFnQVJDeEFRd0JDeUFBUVlUK0EwNGlBZ1JBSUFCQmgvNERUQ0VDQ3lBQ0JFQVF0d0VDUUFKQUFrQUNRQ0FBSWdKQmhQNERSd1JBQWtBZ0FrR0YvZ05yRGdNQ0F3UUFDd3dFQ3lBQkVMZ0JEQVlMSUFFUXVRRU1CQXNnQVJDNkFRd0RDeUFCRUxzQkRBSUxEQUVMSUFCQmdQNERSZ1JBSUFFUUxnc2dBRUdQL2dOR0JFQWdBUkFTREFFTElBQkIvLzhEUmdSQUlBRVFFUXdCQzBFQkR3dEJBUThMUVFBTEVnQWdBQ0FCRUx3QkJFQWdBQ0FCRUFZTEMyZ0JBMzhDUUFOQUlBTWdBazROQVNBQUlBTnFFSTRCSVFVZ0FTQURhaUVFQTBBZ0JFSC92d0pLQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUwwQklBTkJBV29oQXd3QUFBc0FDMEVnSVFNak13UkFRY0FBSVFNTEk2OEJJQU1nQWtFUWJXeHFKSzhCQzIwQkFYOGpzZ0ZGQkVBUEMwRVFJUUFqc3dGQkVFZ0VRQ096QVNFQUN5TzBBU08xQVNBQUVMNEJJN1FCSUFCcUpMUUJJN1VCSUFCcUpMVUJJN01CSUFCckpMTUJJN01CUVFCTUJFQkJBQ1N5QVNQdUFVSC9BUkFHQlNQdUFVRUhJN01CUVJCdFFRRnJFRVFRQmdzTENnQkJBU1J6UVFBUVhRdlRBZ0VGZnlPa0FVVUVRRUVBSkVwQkFDUkxRY1QrQTBFQUVBWkJBRUVCUWNIK0F4QURFRVFRUkNFRFFRQWtoZ0ZCd2Y0RElBTVFCZzhMSTRZQklRRWpTeUlEUVpBQlRnUkFRUUVoQWdValNoQmJUZ1JBUVFJaEFnVWpTaEJjVGdSQVFRTWhBZ3NMQ3lBQklBSkhCRUJCd2Y0REVBTWhBQ0FDSklZQlFRQWhBUUpBQWtBQ1FBSkFBa0FnQWlFRUlBSkZEUUFDUUNBRVFRRnJEZ01DQXdRQUN3d0VDMEVEUVFGQkFDQUFFRVFRUkNJQUVCQWhBUXdEQzBFRVFRQkJBU0FBRUVRUVJTSUFFQkFoQVF3Q0MwRUZRUUZCQUNBQUVFUVFSU0lBRUJBaEFRd0JDMEVCUVFBZ0FCQkZFRVVoQUFzZ0FRUkFFRjRMSUFKRkJFQVF2d0VMSUFKQkFVWUVRQkRBQVFzajdRRWhCQ0FDUlNJQlJRUkFJQUpCQVVZaEFRc2dBUVJBSUFNZ0JFWWhBUXNnQVFSQVFRWkJBaUFBRUVVaUFCQVFCRUFRWGdzRlFRSWdBQkJFSVFBTFFjSCtBeUFBRUFZTEMyd0JBWDhqcEFFRVFDTktJQUJxSkVvRFFDTktFRDFPQkVBalNoQTlheVJLSTBzaUFVR1FBVVlFUUNNcEJFQVFXQVVnQVJCWEN4QlpFRm9GSUFGQmtBRklCRUFqS1VVRVFDQUJFRmNMQ3dzZ0FVR1pBVW9FZjBFQUJTQUJRUUZxQ3lJQkpFc01BUXNMQ3hEQkFRc2tBQ05KRUQ1SUJFQVBDd05BSTBrUVBrNEVRQkErRU1JQkkwa1FQbXNrU1F3QkN3c0xLQUFqZ2dFZ0FHb2tnZ0VqZ2dFamdBRk9CRUFqZ1FGQkFXb2tnUUVqZ2dFamdBRnJKSUlCQ3d0bUFDT3ZBVUVBU2dSQUlBQWpyd0ZxSVFCQkFDU3ZBUXNqUGlBQWFpUStJMEpGQkVBakp3UkFJMGtnQUdva1NSRERBUVVnQUJEQ0FRc2pKZ1JBSTFBZ0FHb2tVQVVnQUJDSkFRc0xJeWdFUUNONElBQnFKSGdRdHdFRklBQVF0Z0VMSUFBUXhBRUxFQUJCQkJERkFTTTlRUUZxRUR3UUF3c0xBRUVFRU1VQkl6MFFBd3NTQUJER0FVSC9BWEVReHdGQi93RnhFRW9MRGdCQkJCREZBU0FBSUFFUXZRRUxMd0VCZjBFQklBQjBFSWNCSVFJZ0FVRUFTZ1JBSXpzZ0FuSkIvd0Z4SkRzRkl6c2dBa0gvQVhOeEpEc0xJenNMQ2dCQkJTQUFFTW9CR2d0T0FDQUJRUUJPQkVBZ0FFRVBjU0FCUVE5eGFoQ0hBVUVRY1FSQVFRRVF5d0VGUVFBUXl3RUxCU0FCUVFBZ0FXc2dBVUVBU2h0QkQzRWdBRUVQY1VzRVFFRUJFTXNCQlVFQUVNc0JDd3NMQ2dCQkJ5QUFFTW9CR2dzS0FFRUdJQUFReWdFYUN3b0FRUVFnQUJES0FSb0xGQUFnQUVFQmRDQUFRZjhCY1VFSGRuSVFod0VMTndFQ2Z5QUJFSVlCSVFJZ0FFRUJhaUVESUFBZ0FSQ0hBU0lCRUx3QkJFQWdBQ0FCRUFZTElBTWdBaEM4QVFSQUlBTWdBaEFHQ3dzT0FFRUlFTVVCSUFBZ0FSRFJBUXVEQVFBZ0FrRUJjUVJBSUFCQi8vOERjU0lBSUFGcUlRSWdBQ0FCY3lBQ2N5SUNRUkJ4QkVCQkFSRExBUVZCQUJETEFRc2dBa0dBQW5FRVFFRUJFTThCQlVFQUVNOEJDd1VnQUNBQmFoQThJZ0lnQUVILy93TnhTUVJBUVFFUXp3RUZRUUFRendFTElBQWdBWE1nQW5OQmdDQnhFRHdFUUVFQkVNc0JCVUVBRU1zQkN3c0xEQUJCQkJERkFTQUFFSTRCQ3hRQUlBQkIvd0Z4UVFGMklBQkJCM1J5RUljQkM5TUVBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUFKQUlBQkJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTERCUUxFTWdCUWYvL0EzRWlBQkNHQVVIL0FYRWtOU0FBRUljQlFmOEJjU1EyREJBTEl6VWpOaEJLSXpRUXlRRU1FZ3NqTlNNMkVFcEJBV3BCLy84RGNTSUFFSVlCUWY4QmNTUTFEQTBMSXpWQkFSRE1BU00xUVFGcUVJY0JKRFVqTlFSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdFTUVBc2pOVUYvRU13Qkl6VkJBV3NRaHdFa05TTTFCRUJCQUJETkFRVkJBUkROQVF0QkFSRE9BUXdQQ3hESEFVSC9BWEVrTlF3TUN5TTBRWUFCY1VHQUFVWUVRRUVCRU04QkJVRUFFTThCQ3lNMEVOQUJKRFFNREFzUXlBRkIvLzhEY1NNOEVOSUJEQWtMSXprak9oQktJZ0FqTlNNMkVFb2lBVUgvL3dOeFFRQVEwd0VnQUNBQmFoQThJZ0FRaGdGQi93RnhKRGtnQUJDSEFVSC9BWEVrT2tFQUVNNEJRUWdQQ3lNMUl6WVFTaERVQVVIL0FYRWtOQXdLQ3lNMUl6WVFTa0VCYXhBOElnQVFoZ0ZCL3dGeEpEVU1CUXNqTmtFQkVNd0JJelpCQVdvUWh3RWtOaU0yQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVF3SUN5TTJRWDhRekFFak5rRUJheENIQVNRMkl6WUVRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJEQWNMRU1jQlFmOEJjU1EyREFRTEl6UkJBWEZCQUVzRVFFRUJFTThCQlVFQUVNOEJDeU0wRU5VQkpEUU1CQXRCZnc4TElBQVFod0ZCL3dGeEpEWkJDQThMSXoxQkFtb1FQQ1E5REFJTEl6MUJBV29RUENROURBRUxRUUFRelFGQkFCRE9BVUVBRU1zQkMwRUVDd29BSXp0QkJIWkJBWEVMRGdBZ0FFRUJkQkRYQVhJUWh3RUxLQUVCZjBFSElBQkJHSFJCR0hVaUFSQVFCRUJCZ0FJZ0FFRVlkRUVZZFd0QmYyd2hBUXNnQVFzakFRRi9JQUFRMlFFaEFTTTlJQUZCR0hSQkdIVnFFRHdrUFNNOVFRRnFFRHdrUFFzVkFDQUFRZjhCY1VFQmRoRFhBVUVIZEhJUWh3RUxwUVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFBSkFJQUJCRVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJeThFUUVFQVFjMytBeERVQVVIL0FYRWlBQkFRQkVCQnpmNERRUWRCQUNBQUVFUWlBQkFRQkg5QkFDUXpRUWNnQUJCRUJVRUJKRE5CQnlBQUVFVUxJZ0FReVFGQnhBQVBDd3RCQVNSQ0RCRUxFTWdCUWYvL0EzRWlBQkNHQVVIL0FYRWtOeUFBRUljQlFmOEJjU1E0SXoxQkFtb1FQQ1E5REJJTEl6Y2pPQkJLSXpRUXlRRU1FUXNqTnlNNEVFcEJBV29RUENJQUVJWUJRZjhCY1NRM0RBMExJemRCQVJETUFTTTNRUUZxRUljQkpEY2pOd1JBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0VNRHdzak4wRi9FTXdCSXpkQkFXc1Fod0VrTnlNM0JFQkJBQkROQVFWQkFSRE5BUXRCQVJET0FRd09DeERIQVVIL0FYRWtOd3dMQzBFQUlRQWpORUdBQVhGQmdBRkdCRUJCQVNFQUN5TTBFTmdCSkRRTUN3c1F4d0VRMmdGQkNBOExJemtqT2hCS0lnQWpOeU00RUVvaUFVSC8vd054UVFBUTB3RWdBQ0FCYWhBOElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPa0VBRU00QlFRZ1BDeU0zSXpnUVNrSC8vd054RU5RQlFmOEJjU1EwREFrTEl6Y2pPQkJLUVFGckVEd2lBQkNHQVVIL0FYRWtOd3dGQ3lNNFFRRVF6QUVqT0VFQmFoQ0hBU1E0SXpnRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QkRBY0xJemhCZnhETUFTTTRRUUZyRUljQkpEZ2pPQVJBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VNQmdzUXh3RkIvd0Z4SkRnTUF3dEJBQ0VBSXpSQkFYRkJBVVlFUUVFQklRQUxJelFRMndFa05Bd0RDMEYvRHdzZ0FCQ0hBVUgvQVhFa09FRUlEd3NqUFVFQmFoQThKRDBNQVFzZ0FBUkFRUUVRendFRlFRQVF6d0VMUVFBUXpRRkJBQkRPQVVFQUVNc0JDMEVFQ3dvQUl6dEJCM1pCQVhFTENnQWpPMEVGZGtFQmNRc0tBQ003UVFaMlFRRnhDNGdHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJJRWNFUUFKQUlBQkJJV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEVOMEJCRUFqUFVFQmFoQThKRDBGRU1jQkVOb0JDMEVJRHdzUXlBRkIvLzhEY1NJQUVJWUJRZjhCY1NRNUlBQVFod0ZCL3dGeEpEb2pQVUVDYWhBOEpEME1FQXNqT1NNNkVFb2lBRUgvL3dOeEl6UVF5UUVnQUVFQmFoQThJZ0FRaGdGQi93RnhKRGtnQUJDSEFVSC9BWEVrT2d3UEN5TTVJem9RU2tFQmFoQThJZ0FRaGdGQi93RnhKRGtnQUJDSEFVSC9BWEVrT2tFSUR3c2pPVUVCRU13Qkl6bEJBV29RaHdFa09TTTVCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXdOQ3lNNVFYOFF6QUVqT1VFQmF4Q0hBU1E1SXprRVFFRUFFTTBCQlVFQkVNMEJDMEVCRU00QkRBd0xFTWNCUWY4QmNTUTVEQW9MRU40QlFRQkxCRUJCQmlFQkN4RFhBVUVBU3dSQUlBRkI0QUJ5SVFFTEVOOEJRUUJMQkg4ak5DQUJheENIQVFVak5FRVBjVUVKU3dSQUlBRkJCbkloQVFzak5FR1pBVXNFUUNBQlFlQUFjaUVCQ3lNMElBRnFFSWNCQ3lJQUJFQkJBQkROQVFWQkFSRE5BUXNnQVVIZ0FIRUVRRUVCRU04QkJVRUFFTThCQzBFQUVNc0JJQUFrTkF3S0N4RGRBVUVBU3dSQUVNY0JFTm9CQlNNOVFRRnFFRHdrUFF0QkNBOExJemtqT2hCS0lnRWdBVUgvL3dOeFFRQVEwd0VnQVVFQmRCQThJZ0VRaGdGQi93RnhKRGtnQVJDSEFVSC9BWEVrT2tFQUVNNEJRUWdQQ3lNNUl6b1FTaUlCUWYvL0EzRVExQUZCL3dGeEpEUWdBVUVCYWhBOElnRVFoZ0ZCL3dGeEpEa2dBUkNIQVVIL0FYRWtPZ3dIQ3lNNUl6b1FTa0VCYXhBOElnRVFoZ0ZCL3dGeEpEa2dBUkNIQVVIL0FYRWtPa0VJRHdzak9rRUJFTXdCSXpwQkFXb1Fod0VrT2lNNkJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FRd0ZDeU02UVg4UXpBRWpPa0VCYXhDSEFTUTZJem9FUUVFQUVNMEJCVUVCRU0wQkMwRUJFTTRCREFRTEVNY0JRZjhCY1NRNkRBSUxJelJCZjNOQi93RnhKRFJCQVJET0FVRUJFTXNCREFJTFFYOFBDeU05UVFGcUVEd2tQUXRCQkF2d0JBRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRXdSd1JBQWtBZ0FFRXhhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzUTF3RUVRQ005UVFGcUVEd2tQUVVReHdFUTJnRUxRUWdQQ3hESUFVSC8vd054SkR3alBVRUNhaEE4SkQwTUVnc2pPU002RUVvaUFFSC8vd054SXpRUXlRRU1Ed3NqUEVFQmFoQThKRHhCQ0E4TEl6a2pPaEJLSWdCQi8vOERjUkRVQVNJQlFRRVF6QUVnQVVFQmFoQ0hBU0lCQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVF3T0N5TTVJem9RU2lJQVFmLy9BM0VRMUFFaUFVRi9FTXdCSUFGQkFXc1Fod0VpQVFSQVFRQVF6UUVGUVFFUXpRRUxRUUVRemdFTURRc2pPU002RUVwQi8vOERjUkRIQVVIL0FYRVF5UUVNQ2d0QkFCRE9BVUVBRU1zQlFRRVF6d0VNREFzUTF3RkJBVVlFUUJESEFSRGFBUVVqUFVFQmFoQThKRDBMUVFnUEN5TTVJem9RU2lJQkl6eEJBQkRUQVNBQkl6eHFFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNlFRQVF6Z0ZCQ0E4TEl6a2pPaEJLSWdCQi8vOERjUkRVQVVIL0FYRWtOQXdIQ3lNOFFRRnJFRHdrUEVFSUR3c2pORUVCRU13Qkl6UkJBV29RaHdFa05DTTBCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXdIQ3lNMFFYOFF6QUVqTkVFQmF4Q0hBU1EwSXpRRVFFRUFFTTBCQlVFQkVNMEJDMEVCRU00QkRBWUxFTWNCUWY4QmNTUTBEQUlMUVFBUXpnRkJBQkRMQVJEWEFVRUFTd1JBUVFBUXp3RUZRUUVRendFTERBUUxRWDhQQ3lNOVFRRnFFRHdrUFF3Q0N5QUFRUUZyRUR3aUFCQ0dBVUgvQVhFa09TQUFFSWNCUWY4QmNTUTZEQUVMSUFCQi8vOERjU0FCRU1rQkMwRUVDOWtCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUFSd1JBSUFBaUFVSEJBRVlOQVFKQUlBRkJ3Z0JyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTERCQUxJellrTlF3UEN5TTNKRFVNRGdzak9DUTFEQTBMSXpra05Rd01DeU02SkRVTUN3c2pPU002RUVvUTFBRkIvd0Z4SkRVTUNnc2pOQ1ExREFrTEl6VWtOZ3dJQ3d3SEN5TTNKRFlNQmdzak9DUTJEQVVMSXpra05nd0VDeU02SkRZTUF3c2pPU002RUVvUTFBRkIvd0Z4SkRZTUFnc2pOQ1EyREFFTFFYOFBDMEVFQzlrQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZEFBUndSQUlBQWlBVUhSQUVZTkFRSkFJQUZCMGdCckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVrTnd3UUN5TTJKRGNNRHdzTURnc2pPQ1EzREEwTEl6a2tOd3dNQ3lNNkpEY01Dd3NqT1NNNkVFb1ExQUZCL3dGeEpEY01DZ3NqTkNRM0RBa0xJelVrT0F3SUN5TTJKRGdNQndzak55UTREQVlMREFVTEl6a2tPQXdFQ3lNNkpEZ01Bd3NqT1NNNkVFb1ExQUZCL3dGeEpEZ01BZ3NqTkNRNERBRUxRWDhQQzBFRUM5a0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWVBQVJ3UkFJQUFpQVVIaEFFWU5BUUpBSUFGQjRnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXpVa09Rd1FDeU0ySkRrTUR3c2pOeVE1REE0TEl6Z2tPUXdOQ3d3TUN5TTZKRGtNQ3dzak9TTTZFRW9RMUFGQi93RnhKRGtNQ2dzak5DUTVEQWtMSXpVa09nd0lDeU0ySkRvTUJ3c2pOeVE2REFZTEl6Z2tPZ3dGQ3lNNUpEb01CQXNNQXdzak9TTTZFRW9RMUFGQi93RnhKRG9NQWdzak5DUTZEQUVMUVg4UEMwRUVDeUlBSTRjQkJFQkJBU1EvRHdzamNpTjNjVUVmY1VVRVFFRUJKRUFQQzBFQkpFRUxpUUlCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQkhCRUFnQUNJQlFmRUFSZzBCQWtBZ0FVSHlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak9TTTZFRW9qTlJESkFRd1FDeU01SXpvUVNpTTJFTWtCREE4TEl6a2pPaEJLSXpjUXlRRU1EZ3NqT1NNNkVFb2pPQkRKQVF3TkN5TTVJem9RU2lNNUVNa0JEQXdMSXprak9oQktJem9ReVFFTUN3c2pzZ0ZGQkVBUTVRRUxEQW9MSXprak9oQktJelFReVFFTUNRc2pOU1EwREFnTEl6WWtOQXdIQ3lNM0pEUU1CZ3NqT0NRMERBVUxJemtrTkF3RUN5TTZKRFFNQXdzak9TTTZFRW9RMUFGQi93RnhKRFFNQWdzTUFRdEJmdzhMUVFRTFNnQWdBVUVBVGdSQUlBQkIvd0Z4SUFBZ0FXb1Fod0ZMQkVCQkFSRFBBUVZCQUJEUEFRc0ZJQUZCQUNBQmF5QUJRUUJLR3lBQVFmOEJjVW9FUUVFQkVNOEJCVUVBRU04QkN3c0xOd0VCZnlNMElBQkIvd0Z4SWdFUXpBRWpOQ0FCRU9jQkl6UWdBR29RaHdFa05DTTBCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXRyQVFGL0l6UWdBR29RMXdGcUVJY0JJUUVqTkNBQWN5QUJjeENIQVVFUWNRUkFRUUVReXdFRlFRQVF5d0VMSXpRZ0FFSC9BWEZxRU5jQmFoQThRWUFDY1VFQVN3UkFRUUVRendFRlFRQVF6d0VMSUFFa05DTTBCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXZpQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWUFCUndSQUFrQWdBVUdCQVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVRNkFFTUVBc2pOaERvQVF3UEN5TTNFT2dCREE0TEl6Z1E2QUVNRFFzak9SRG9BUXdNQ3lNNkVPZ0JEQXNMSXprak9oQktFTlFCRU9nQkRBb0xJelFRNkFFTUNRc2pOUkRwQVF3SUN5TTJFT2tCREFjTEl6Y1E2UUVNQmdzak9CRHBBUXdGQ3lNNUVPa0JEQVFMSXpvUTZRRU1Bd3NqT1NNNkVFb1ExQUVRNlFFTUFnc2pOQkRwQVF3QkMwRi9Ed3RCQkFzNkFRRi9JelFnQUVIL0FYRkJmMndpQVJETUFTTTBJQUVRNXdFak5DQUFheENIQVNRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJDMnNCQVg4ak5DQUFheERYQVdzUWh3RWhBU00wSUFCeklBRnpRUkJ4RUljQkJFQkJBUkRMQVFWQkFCRExBUXNqTkNBQVFmOEJjV3NRMXdGckVEeEJnQUp4UVFCTEJFQkJBUkRQQVFWQkFCRFBBUXNnQVNRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJrQUZIQkVBQ1FDQUJRWkVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkRyQVF3UUN5TTJFT3NCREE4TEl6Y1E2d0VNRGdzak9CRHJBUXdOQ3lNNUVPc0JEQXdMSXpvUTZ3RU1Dd3NqT1NNNkVFb1ExQUVRNndFTUNnc2pOQkRyQVF3SkN5TTFFT3dCREFnTEl6WVE3QUVNQndzak54RHNBUXdHQ3lNNEVPd0JEQVVMSXprUTdBRU1CQXNqT2hEc0FRd0RDeU01SXpvUVNoRFVBUkRzQVF3Q0N5TTBFT3dCREFFTFFYOFBDMEVFQ3lnQUl6UWdBSEVrTkNNMEJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FVRUJFTXNCUVFBUXp3RUxLd0FqTkNBQWN4Q0hBU1EwSXpRRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0ZCQUJEUEFRdmlBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFhQUJSd1JBQWtBZ0FVR2hBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl6VVE3Z0VNRUFzak5oRHVBUXdQQ3lNM0VPNEJEQTRMSXpnUTdnRU1EUXNqT1JEdUFRd01DeU02RU80QkRBc0xJemtqT2hCS0VOUUJFTzRCREFvTEl6UVE3Z0VNQ1Fzak5SRHZBUXdJQ3lNMkVPOEJEQWNMSXpjUTd3RU1CZ3NqT0JEdkFRd0ZDeU01RU84QkRBUUxJem9RN3dFTUF3c2pPU002RUVvUTFBRVE3d0VNQWdzak5CRHZBUXdCQzBGL0R3dEJCQXNzQUNNMElBQnlRZjhCY1NRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJRUUFReXdGQkFCRFBBUXN6QVFGL0l6UWdBRUgvQVhGQmYyd2lBUkRNQVNNMElBRVE1d0VqTkNBQmFnUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRUw0Z0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR3dBVWNFUUFKQUlBRkJzUUZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5TTFFUEVCREJBTEl6WVE4UUVNRHdzak54RHhBUXdPQ3lNNEVQRUJEQTBMSXprUThRRU1EQXNqT2hEeEFRd0xDeU01SXpvUVNoRFVBUkR4QVF3S0N5TTBFUEVCREFrTEl6VVE4Z0VNQ0Fzak5oRHlBUXdIQ3lNM0VQSUJEQVlMSXpnUThnRU1CUXNqT1JEeUFRd0VDeU02RVBJQkRBTUxJemtqT2hCS0VOUUJFUElCREFJTEl6UVE4Z0VNQVF0QmZ3OExRUVFMUWdFQ2Z3SkFBa0FnQUJDTkFTSUJRWDlIQkVBTUFnc2dBQkFESVFFTEN3SkFBa0FnQUVFQmFpSUNFSTBCSWdCQmYwY05BU0FDRUFNaEFBc0xJQUFnQVJCS0N3d0FRUWdReFFFZ0FCRDBBUXM3QUNBQVFZQUJjVUdBQVVZRVFFRUJFTThCQlVFQUVNOEJDeUFBRU5BQklnQUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJRUUFReXdFZ0FBczVBQ0FBUVFGeFFRQkxCRUJCQVJEUEFRVkJBQkRQQVFzZ0FCRFZBU0lBQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVVFQUVNc0JJQUFMU0FFQmZ5QUFRWUFCY1VHQUFVWUVRRUVCSVFFTElBQVEyQUVoQUNBQkJFQkJBUkRQQVFWQkFCRFBBUXNnQUFSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdGQkFCRExBU0FBQzBZQkFYOGdBRUVCY1VFQlJnUkFRUUVoQVFzZ0FCRGJBU0VBSUFFRVFFRUJFTThCQlVFQUVNOEJDeUFBQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVVFQUVNc0JJQUFMU3dFQmZ5QUFRWUFCY1VHQUFVWUVRRUVCSVFFTElBQkJBWFFRaHdFaEFDQUJCRUJCQVJEUEFRVkJBQkRQQVFzZ0FBUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVNBQUMyc0JBbjhnQUVHQUFYRkJnQUZHQkVCQkFTRUJDeUFBUVFGeFFRRkdCRUJCQVNFQ0N5QUFRZjhCY1VFQmRoQ0hBU0VBSUFFRVFDQUFRWUFCY2lFQUN5QUFCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVBRU1zQklBSUVRRUVCRU04QkJVRUFFTThCQ3lBQUN6Z0FJQUJCRDNGQkJIUWdBRUh3QVhGQkJIWnlFSWNCSWdBRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0ZCQUJEUEFTQUFDMHNCQVg4Z0FFRUJjVUVCUmdSQVFRRWhBUXNnQUVIL0FYRkJBWFlRaHdFaUFBUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVNBQkJFQkJBUkRQQVFWQkFCRFBBUXNnQUFzb0FDQUJRUUVnQUhSeFFmOEJjUVJBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0ZCQVJETEFTQUJDeUFBSUFGQkFFb0VmeUFDUVFFZ0FIUnlCU0FDUVFFZ0FIUkJmM054Q3lJQ0M5c0lBUWQvUVg4aEJnSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUWh2SWdjaEJTQUhSUTBBQWtBZ0JVRUJhdzRIQWdNRUJRWUhDQUFMREFnTEl6VWhBUXdIQ3lNMklRRU1CZ3NqTnlFQkRBVUxJemdoQVF3RUN5TTVJUUVNQXdzak9pRUJEQUlMSXprak9oQktFTlFCSVFFTUFRc2pOQ0VCQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQlNFRUlBVkZEUUFDUUNBRVFRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lBQVFRZE1CRUFnQVJEMkFTRUNRUUVoQXdVZ0FFRVBUQVJBSUFFUTl3RWhBa0VCSVFNTEN3d1BDeUFBUVJkTUJFQWdBUkQ0QVNFQ1FRRWhBd1VnQUVFZlRBUkFJQUVRK1FFaEFrRUJJUU1MQ3d3T0N5QUFRU2RNQkVBZ0FSRDZBU0VDUVFFaEF3VWdBRUV2VEFSQUlBRVErd0VoQWtFQklRTUxDd3dOQ3lBQVFUZE1CRUFnQVJEOEFTRUNRUUVoQXdVZ0FFRS9UQVJBSUFFUS9RRWhBa0VCSVFNTEN3d01DeUFBUWNjQVRBUkFRUUFnQVJEK0FTRUNRUUVoQXdVZ0FFSFBBRXdFUUVFQklBRVEvZ0VoQWtFQklRTUxDd3dMQ3lBQVFkY0FUQVJBUVFJZ0FSRCtBU0VDUVFFaEF3VWdBRUhmQUV3RVFFRURJQUVRL2dFaEFrRUJJUU1MQ3d3S0N5QUFRZWNBVEFSQVFRUWdBUkQrQVNFQ1FRRWhBd1VnQUVIdkFFd0VRRUVGSUFFUS9nRWhBa0VCSVFNTEN3d0pDeUFBUWZjQVRBUkFRUVlnQVJEK0FTRUNRUUVoQXdVZ0FFSC9BRXdFUUVFSElBRVEvZ0VoQWtFQklRTUxDd3dJQ3lBQVFZY0JUQVJBUVFCQkFDQUJFUDhCSVFKQkFTRURCU0FBUVk4QlRBUkFRUUZCQUNBQkVQOEJJUUpCQVNFREN3c01Cd3NnQUVHWEFVd0VRRUVDUVFBZ0FSRC9BU0VDUVFFaEF3VWdBRUdmQVV3RVFFRURRUUFnQVJEL0FTRUNRUUVoQXdzTERBWUxJQUJCcHdGTUJFQkJCRUVBSUFFUS93RWhBa0VCSVFNRklBQkJyd0ZNQkVCQkJVRUFJQUVRL3dFaEFrRUJJUU1MQ3d3RkN5QUFRYmNCVEFSQVFRWkJBQ0FCRVA4QklRSkJBU0VEQlNBQVFiOEJUQVJBUVFkQkFDQUJFUDhCSVFKQkFTRURDd3NNQkFzZ0FFSEhBVXdFUUVFQVFRRWdBUkQvQVNFQ1FRRWhBd1VnQUVIUEFVd0VRRUVCUVFFZ0FSRC9BU0VDUVFFaEF3c0xEQU1MSUFCQjF3Rk1CRUJCQWtFQklBRVEvd0VoQWtFQklRTUZJQUJCM3dGTUJFQkJBMEVCSUFFUS93RWhBa0VCSVFNTEN3d0NDeUFBUWVjQlRBUkFRUVJCQVNBQkVQOEJJUUpCQVNFREJTQUFRZThCVEFSQVFRVkJBU0FCRVA4QklRSkJBU0VEQ3dzTUFRc2dBRUgzQVV3RVFFRUdRUUVnQVJEL0FTRUNRUUVoQXdVZ0FFSC9BVXdFUUVFSFFRRWdBUkQvQVNFQ1FRRWhBd3NMQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQnlJRUJFQUNRQ0FFUVFGckRnY0NBd1FGQmdjSUFBc01DQXNnQWlRMURBY0xJQUlrTmd3R0N5QUNKRGNNQlFzZ0FpUTREQVFMSUFJa09Rd0RDeUFDSkRvTUFnc2dCVUVFU0NJRVJRUkFJQVZCQjBvaEJBc2dCQVJBSXprak9oQktJQUlReVFFTERBRUxJQUlrTkFzZ0F3UkFRUVFoQmdzZ0JndlVBd0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVSEFBVWNFUUFKQUlBRkJ3UUZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN4RGRBUTBTREJRTEl6d1E5UUZCLy84RGNTRUJJenhCQW1vUVBDUThJQUVRaGdGQi93RnhKRFVnQVJDSEFVSC9BWEVrTmtFRUR3c1EzUUVFUUF3U0JRd1FDd0FMREE0TEVOMEJCRUFNRUFVTURRc0FDeU04UVFKckVEd2tQQ004SXpVak5oQktFTklCREEwTEVNY0JFT2dCREE4TEl6eEJBbXNRUENROEl6d2pQUkRTQVVFQUpEME1Dd3NRM1FGQkFVY05DZ3dNQ3lNOEVQVUJRZi8vQTNFa1BTTThRUUpxRUR3a1BBd0pDeERkQVVFQlJnUkFEQWdGREFvTEFBc1F4d0ZCL3dGeEVJQUNJUUVqUFVFQmFoQThKRDBnQVE4TEVOMEJRUUZHQkVBalBFRUNheEE4SkR3alBDTTlRUUpxUWYvL0EzRVEwZ0VNQmdVTUNBc0FDd3dEQ3hESEFSRHBBUXdIQ3lNOFFRSnJFRHdrUENNOEl6MFEwZ0ZCQ0NROURBTUxRWDhQQ3lNOFFRSnJFRHdrUENNOEl6MUJBbW9RUEJEU0FRc1F5QUZCLy84RGNTUTlDMEVJRHdzalBVRUNhaEE4SkQxQkRBOExJendROVFGQi8vOERjU1E5SXp4QkFtb1FQQ1E4UVF3UEN5TTlRUUZxRUR3a1BVRUVDeFVBSUFCQkFYRUVRRUVCSklnQkJVRUFKSWNCQ3d1eEF3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQjBBRkhCRUFDUUNBQlFkRUJhdzRQQWdNQUJBVUdCd2dKQ2dBTEFBd05BQXNNRFFzUTF3RU5EZ3dRQ3lNOEVQVUJRZi8vQTNFaEFTTThRUUpxRUR3a1BDQUJFSVlCUWY4QmNTUTNJQUVRaHdGQi93RnhKRGhCQkE4TEVOY0JCRUFNRGdVTURBc0FDeERYQVFSQURBMEZJenhCQW1zUVBDUThJendqUFVFQ2FrSC8vd054RU5JQkRBc0xBQXNqUEVFQ2F4QThKRHdqUENNM0l6Z1FTaERTQVF3S0N4REhBUkRyQVF3TUN5TThRUUpyRUR3a1BDTThJejBRMGdGQkVDUTlEQWdMRU5jQlFRRkhEUWNNQ1FzalBCRDFBVUgvL3dOeEpEMUJBUkNDQWlNOFFRSnFFRHdrUEF3R0N4RFhBVUVCUmdSQURBVUZEQWNMQUFzUTF3RkJBVVlFUUNNOFFRSnJFRHdrUENNOEl6MUJBbW9RUEJEU0FRd0VCUXdHQ3dBTEVNY0JFT3dCREFZTEl6eEJBbXNRUENROEl6d2pQUkRTQVVFWUpEME1BZ3RCZnc4TEVNZ0JRZi8vQTNFa1BRdEJDQThMSXoxQkFtb1FQQ1E5UVF3UEN5TThFUFVCUWYvL0EzRWtQU004UVFKcUVEd2tQRUVNRHdzalBVRUJhaEE4SkQxQkJBdmdBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQVVjRVFBSkFJQUJCNFFGckRnOENBd0FBQkFVR0J3Z0pBQUFBQ2dzQUN3d0xDeERIQVVIL0FYRkJnUDREYWlNMEVNa0JEQXNMSXp3UTlRRkIvLzhEY1NFQUl6eEJBbW9RUENROElBQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPa0VFRHdzak5rR0EvZ05xSXpRUXlRRkJCQThMSXp4QkFtc1FQQ1E4SXp3ak9TTTZFRW9RMGdGQkNBOExFTWNCRU80QkRBY0xJenhCQW1zUVBDUThJendqUFJEU0FVRWdKRDFCQ0E4TEVNY0JFTmtCSVFBalBDQUFRUmgwUVJoMUlnQkJBUkRUQVNNOElBQnFFRHdrUEVFQUVNMEJRUUFRemdFalBVRUJhaEE4SkQxQkRBOExJemtqT2hCS1FmLy9BM0VrUFVFRUR3c1F5QUZCLy84RGNTTTBFTWtCSXoxQkFtb1FQQ1E5UVFRUEN4REhBUkR2QVF3Q0N5TThRUUpyRUR3a1BDTThJejBRMGdGQktDUTlRUWdQQzBGL0R3c2pQVUVCYWhBOEpEMUJCQXVTQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVVjRVFBSkFJQUJCOFFGckRnOENBd1FBQlFZSENBa0tDd0FBREEwQUN3d05DeERIQVVIL0FYRkJnUDREYWhEVUFSQ0hBU1EwREEwTEl6d1E5UUZCLy84RGNTRUFJenhCQW1vUVBDUThJQUFRaGdGQi93RnhKRFFnQUJDSEFVSC9BWEVrT3d3TkN5TTJRWUQrQTJvUTFBRVFod0VrTkF3TUMwRUFFSUlDREFzTEl6eEJBbXNRUENROEl6d2pOQ003RUVvUTBnRkJDQThMRU1jQkVQRUJEQWdMSXp4QkFtc1FQQ1E4SXp3alBSRFNBVUV3SkQxQkNBOExFTWNCRU5rQklRQkJBQkROQVVFQUVNNEJJendnQUVFWWRFRVlkU0lBUVFFUTB3RWpQQ0FBYWhBOElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPaU05UVFGcUVEd2tQVUVJRHdzak9TTTZFRXBCLy84RGNTUThRUWdQQ3hESUFVSC8vd054RU5RQlFmOEJjU1EwSXoxQkFtb1FQQ1E5REFVTFFRRVFnZ0lNQkFzUXh3RVE4Z0VNQWdzalBFRUNheEE4SkR3alBDTTlFTklCUVRna1BVRUlEd3RCZnc4TEl6MUJBV29RUENROUMwRUVDOVlCQVFGL0l6MUJBV29RUENROUkwRUVRQ005UVFGckVEd2tQUXNDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBWEZCQkhVaUFRUkFJQUZCQVVZTkFRSkFJQUZCQW1zT0RRTUVCUVlIQ0FrS0N3d05EZzhBQ3d3UEN5QUFFTllCRHdzZ0FCRGNBUThMSUFBUTRBRVBDeUFBRU9FQkR3c2dBQkRpQVE4TElBQVE0d0VQQ3lBQUVPUUJEd3NnQUJEbUFROExJQUFRNmdFUEN5QUFFTzBCRHdzZ0FCRHdBUThMSUFBUTh3RVBDeUFBRUlFQ0R3c2dBQkNEQWc4TElBQVFoQUlQQ3lBQUVJVUNDeElBUVFBa1FFRUFKRDlCQUNSQlFRQWtRZ3NVQUNNL0JIOGpQd1VqUUFzRVFFRUJEd3RCQUFzZEFRRi9JQUVRaGdFaEFpQUFJQUVRaHdFUUJpQUFRUUZxSUFJUUJndUNBUUVCZjBFQUVJSUNJQUJCai80REVBTVFSQ0lCSkhkQmovNERJQUVRQmlNOFFRSnJRZi8vQTNFa1BCQ0lBaG9qUENNOUVJa0NBa0FDUUFKQUFrQWdBQVJBQWtBZ0FFRUJhdzRFQWdNQUJBQUxEQVFMUVFBa2MwSEFBQ1E5REFNTFFRQWtkRUhJQUNROURBSUxRUUFrZFVIUUFDUTlEQUVMUVFBa2RrSGdBQ1E5Q3d1L0FRRUNmeU9JQVFSQVFRRWtod0ZCQUNTSUFRc2pjaU4zY1VFZmNVRUFTZ1JBSTRjQkJIOGpRRVVGSTRjQkN5SUFCRUFqYmdSL0kzTUZJMjRMSWdBRVFFRUFFSW9DUVFFaEFRVWpid1IvSTNRRkkyOExJZ0FFUUVFQkVJb0NRUUVoQVFVamNBUi9JM1VGSTNBTElnQUVRRUVDRUlvQ1FRRWhBUVVqY1FSL0kzWUZJM0VMSWdBRVFFRUVFSW9DUVFFaEFRc0xDd3NMUVFBaEFDQUJCRUJCRkNFQUVJZ0NCRUFRaHdKQkdDRUFDd3NRaUFJRVFCQ0hBZ3NnQUE4TFFRQUxLQUFqaFFFZ0FHb2toUUVqaFFFamd3Rk9CRUFqaEFGQkFXb2toQUVqaFFFamd3RnJKSVVCQ3d0eEFRSi9RUUVRRlNOQkJFQWpQUkFEUWY4QmNSQ0dBaERGQVJDSEFnc1Fpd0lpQVVFQVNnUkFJQUVReFFFTFFRUWhBQkNJQWtVaUFRUkFJMEpGSVFFTElBRUVRQ005RUFOQi93RnhFSVlDSVFBTEl6dEI4QUZ4SkRzZ0FFRUFUQVJBSUFBUEN5QUFFTVVCUVFFUWpBSWdBQXNRQUNNekJFQkJvTWtJRHd0QjBLUUVDd1FBSTE4THpnRUJCSDlCZ0FnaEF5QUJRUUJLQkVBZ0FTRURCU0FCUVFCSUJFQkJmeUVEQ3d0QkFDRUJBMEFnQmtVaUFBUkFJQUZGSVFBTElBQUVRQ0FFUlNFQUN5QUFCRUFnQlVVaEFBc2dBQVJBRUkwQ1FRQklCRUJCQVNFR0JTTStFSTRDVGdSQVFRRWhBUVVnQTBGL1NpSUFCRUFRandJZ0EwNGhBQXNnQUFSQVFRRWhCQVVnQWtGL1NpSUFCRUFqUFNBQ1JpRUFDeUFBQkVCQkFTRUZDd3NMQ3d3QkN3c2dBUVJBSXo0UWpnSnJKRDVCQUE4TElBUUVRRUVCRHdzZ0JRUkFRUUlQQ3lNOVFRRnJFRHdrUFVGL0N3c0FRUUZCZjBGL0VKQUNDemdCQTM4RFFDQUNJQUJJSWdNRVFDQUJRUUJPSVFNTElBTUVRQkNSQWlFQklBSkJBV29oQWd3QkN3c2dBVUVBU0FSQUlBRVBDMEVBQ3dzQVFRRWdBRUYvRUpBQ0N4b0JBWDlCQVVGL0lBQVFrQUlpQVVFQ1JnUkFRUUVQQ3lBQkN3VUFJNEFCQ3dVQUk0RUJDd1VBSTRJQkMxOEJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVFKQUlBRkJBbXNPQmdNRUJRWUhDQUFMREFnTEk5Z0JEd3NqMlFFUEN5UGFBUThMSTlzQkR3c2ozQUVQQ3lQZEFROExJOTRCRHdzajN3RVBDMEVBQzRzQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQ1FRRkdEUUVDUUNBQ1FRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lBQlFRRnhKTmdCREFjTElBRkJBWEVrMlFFTUJnc2dBVUVCY1NUYUFRd0ZDeUFCUVFGeEpOc0JEQVFMSUFGQkFYRWszQUVNQXdzZ0FVRUJjU1RkQVF3Q0N5QUJRUUZ4Sk40QkRBRUxJQUZCQVhFazN3RUxDd29BUVFFa2RrRUVFRjBMWkFFQ2YwRUFKRUlnQUJDWUFrVUVRRUVCSVFFTElBQkJBUkNaQWlBQkJFQkJBQ0VCSUFCQkEwd0VRRUVCSVFFTEk2MEJCSDhnQVFVanJRRUxJZ0FFUUVFQklRSUxJNjRCQkg4Z0FVVUZJNjRCQ3lJQUJFQkJBU0VDQ3lBQ0JFQVFtZ0lMQ3dzSkFDQUFRUUFRbVFJTG1nRUFJQUJCQUVvRVFFRUFFSnNDQlVFQUVKd0NDeUFCUVFCS0JFQkJBUkNiQWdWQkFSQ2NBZ3NnQWtFQVNnUkFRUUlRbXdJRlFRSVFuQUlMSUFOQkFFb0VRRUVERUpzQ0JVRURFSndDQ3lBRVFRQktCRUJCQkJDYkFnVkJCQkNjQWdzZ0JVRUFTZ1JBUVFVUW13SUZRUVVRbkFJTElBWkJBRW9FUUVFR0VKc0NCVUVHRUp3Q0N5QUhRUUJLQkVCQkJ4Q2JBZ1ZCQnhDY0Fnc0xCQUFqTkFzRUFDTTFDd1FBSXpZTEJBQWpOd3NFQUNNNEN3UUFJemtMQkFBak9nc0VBQ003Q3dRQUl6MExCQUFqUEFzR0FDTTlFQU1MQkFBalN3dWZBd0VLZjBHQWtBSWhDU09uQVFSQVFZQ0FBaUVKQzBHQXNBSWhDaU9vQVFSQVFZQzRBaUVLQ3dKQUEwQWdCRUdBQWs0TkFRSkFRUUFoQlFOQUlBVkJnQUpPRFFFZ0NTQUtJQVJCQTNWQkJYUnFJQVZCQTNWcUlnWkJBQkEvRUVnaENDQUVRUWh2SVFGQkJ5QUZRUWh2YXlFSFFRQWhBaU12Qkg4Z0FFRUFTZ1VqTHdzaUF3UkFJQVpCQVJBL0lRSUxRUVlnQWhBUUJFQkJCeUFCYXlFQkMwRUFJUU5CQXlBQ0VCQUVRRUVCSVFNTElBZ2dBVUVCZEdvaUJpQURFRDhoQ0VFQUlRRWdCeUFHUVFGcUlBTVFQeEFRQkVCQkFpRUJDeUFISUFnUUVBUkFJQUZCQVdvaEFRc2dCRUVJZENBRmFrRURiQ0VISXk4RWZ5QUFRUUJLQlNNdkN5SURCRUJCQUNBQ1FRZHhJQUZCQUJCTElnRVFUQ0VHUVFFZ0FSQk1JUU5CQWlBQkVFd2hBU0FIUVlDWURtb2lBaUFHT2dBQUlBSkJBV29nQXpvQUFDQUNRUUpxSUFFNkFBQUZJQUZCeC80RFFRQVFUU0VDQWtCQkFDRUJBMEFnQVVFRFRnMEJJQWRCZ0pnT2FpQUJhaUFDT2dBQUlBRkJBV29oQVF3QUFBc0FDd3NnQlVFQmFpRUZEQUFBQ3dBTElBUkJBV29oQkF3QUFBc0FDd3ZUQVFFR2Z3SkFBMEFnQWtFWFRnMEJBa0JCQUNFQUEwQWdBRUVmVGcwQlFRQWhCQ0FBUVE5S0JFQkJBU0VFQ3lBQ0lRRWdBa0VQU2dSQUlBRkJEMnNoQVFzZ0FVRUVkQ0VCSUFCQkQwb0VmeUFCSUFCQkQydHFCU0FCSUFCcUN5RUJRWUNBQWlFRklBSkJEMG9FUUVHQWtBSWhCUXNDUUVFQUlRTURRQ0FEUVFoT0RRRWdBU0FGSUFSQkFFRUhJQU1nQUVFRGRDQUNRUU4wSUFOcVFmZ0JRWUNZR2tFQlFRQkJmeEJQR2lBRFFRRnFJUU1NQUFBTEFBc2dBRUVCYWlFQURBQUFDd0FMSUFKQkFXb2hBZ3dBQUFzQUN3c0VBQ041Q3dRQUkzb0xCQUFqZXdzWEFRRi9JMzBoQUNOOEJFQkJBaUFBRUVVaEFBc2dBQXNVQUQ4QVFZc0JTQVJBUVlzQlB3QnJRQUFhQ3dzZEFBSkFBa0FDUUNPRUFnNENBUUlBQ3dBTFFRQWhBQXNnQUJDVEFnc0hBQ0FBSklRQ0N6RUFBa0FDUUFKQUFrQUNRQ09FQWc0RUFRSURCQUFMQUF0QkFTRUFDMEYvSVFFTFFYOGhBZ3NnQUNBQklBSVFrQUlMQUxKaUJHNWhiV1VCcW1LMEFnQWxZMjl5WlM5dFpXMXZjbmt2WW1GdWEybHVaeTluWlhSU2IyMUNZVzVyUVdSa2NtVnpjd0VsWTI5eVpTOXRaVzF2Y25rdlltRnVhMmx1Wnk5blpYUlNZVzFDWVc1clFXUmtjbVZ6Y3dJM1kyOXlaUzl0WlcxdmNua3ZiV1Z0YjNKNVRXRndMMmRsZEZkaGMyMUNiM2xQWm1aelpYUkdjbTl0UjJGdFpVSnZlVTltWm5ObGRBTXBZMjl5WlM5dFpXMXZjbmt2Ykc5aFpDOWxhV2RvZEVKcGRFeHZZV1JHY205dFIwSk5aVzF2Y25rRUdtTnZjbVV2WTNCMUwyTndkUzlwYm1sMGFXRnNhWHBsUTNCMUJTWmpiM0psTDIxbGJXOXllUzl0WlcxdmNua3ZhVzVwZEdsaGJHbDZaVU5oY25SeWFXUm5aUVlyWTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2WldsbmFIUkNhWFJUZEc5eVpVbHVkRzlIUWsxbGJXOXllUWNkWTI5eVpTOXRaVzF2Y25rdlpHMWhMMmx1YVhScFlXeHBlbVZFYldFSUtXTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012YVc1cGRHbGhiR2w2WlVkeVlYQm9hV056Q1NkamIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZhVzVwZEdsaGJHbDZaVkJoYkdWMGRHVUtKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1YVc1cGRHbGhiR2w2WlFzblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01pOURhR0Z1Ym1Wc01pNXBibWwwYVdGc2FYcGxEQ2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG1sdWFYUnBZV3hwZW1VTkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVhVzVwZEdsaGJHbDZaUTR4WTI5eVpTOXpiM1Z1WkM5aFkyTjFiWFZzWVhSdmNpOXBibWwwYVdGc2FYcGxVMjkxYm1SQlkyTjFiWFZzWVhSdmNnOGdZMjl5WlM5emIzVnVaQzl6YjNWdVpDOXBibWwwYVdGc2FYcGxVMjkxYm1RUUlXTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOWphR1ZqYTBKcGRFOXVRbmwwWlJFOFkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlNXNTBaWEp5ZFhCMGN5NTFjR1JoZEdWSmJuUmxjbkoxY0hSRmJtRmliR1ZrRWo1amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5SmJuUmxjbkoxY0hSekxuVndaR0YwWlVsdWRHVnljblZ3ZEZKbGNYVmxjM1JsWkJNdlkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmFXNXBkR2xoYkdsNlpVbHVkR1Z5Y25Wd2RITVVJMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlwYm1sMGFXRnNhWHBsVkdsdFpYSnpGUnRqYjNKbEwyTnZjbVV2YzJWMFNHRnpRMjl5WlZOMFlYSjBaV1FXRjJOdmNtVXZZM2xqYkdWekwzSmxjMlYwUTNsamJHVnpGeGRqYjNKbEwyVjRaV04xZEdVdmNtVnpaWFJUZEdWd2N4Z1VZMjl5WlM5amIzSmxMMmx1YVhScFlXeHBlbVVaRUdOdmNtVXZZMjl5WlM5amIyNW1hV2NhR0dOdmNtVXZZMjl5WlM5b1lYTkRiM0psVTNSaGNuUmxaQnNpWTI5eVpTOWpiM0psTDJkbGRGTmhkbVZUZEdGMFpVMWxiVzl5ZVU5bVpuTmxkQnd5WTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2YzNSdmNtVkNiMjlzWldGdVJHbHlaV04wYkhsVWIxZGhjMjFOWlcxdmNua2RHbU52Y21VdlkzQjFMMk53ZFM5RGNIVXVjMkYyWlZOMFlYUmxIaWxqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxuTmhkbVZUZEdGMFpSOHZZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTV6WVhabFUzUmhkR1VnSTJOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5S2IzbHdZV1F1YzJGMlpWTjBZWFJsSVNOamIzSmxMMjFsYlc5eWVTOXRaVzF2Y25rdlRXVnRiM0o1TG5OaGRtVlRkR0YwWlNJalkyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1ellYWmxVM1JoZEdVaklHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1YzJGMlpWTjBZWFJsSkNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuTmhkbVZUZEdGMFpTVW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTV6WVhabFUzUmhkR1VtSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWMyRjJaVk4wWVhSbEp5WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbk5oZG1WVGRHRjBaU2dUWTI5eVpTOWpiM0psTDNOaGRtVlRkR0YwWlNreVkyOXlaUzl0WlcxdmNua3ZiRzloWkM5c2IyRmtRbTl2YkdWaGJrUnBjbVZqZEd4NVJuSnZiVmRoYzIxTlpXMXZjbmtxR21OdmNtVXZZM0IxTDJOd2RTOURjSFV1Ykc5aFpGTjBZWFJsS3laamIzSmxMMmR5WVhCb2FXTnpMMnhqWkM5TVkyUXVkWEJrWVhSbFRHTmtRMjl1ZEhKdmJDd3BZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5SGNtRndhR2xqY3k1c2IyRmtVM1JoZEdVdEwyTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXViRzloWkZOMFlYUmxMaVpqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2U205NWNHRmtMblZ3WkdGMFpVcHZlWEJoWkM4alkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wwcHZlWEJoWkM1c2IyRmtVM1JoZEdVd0kyTnZjbVV2YldWdGIzSjVMMjFsYlc5eWVTOU5aVzF2Y25rdWJHOWhaRk4wWVhSbE1TTmpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxteHZZV1JUZEdGMFpUSWhZMjl5WlM5emIzVnVaQzl6YjNWdVpDOWpiR1ZoY2tGMVpHbHZRblZtWm1WeU15QmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG14dllXUlRkR0YwWlRRbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNXNiMkZrVTNSaGRHVTFKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1Ykc5aFpGTjBZWFJsTmlaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxteHZZV1JUZEdGMFpUY21ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVzYjJGa1UzUmhkR1U0RTJOdmNtVXZZMjl5WlM5c2IyRmtVM1JoZEdVNUgyTnZjbVV2WlhobFkzVjBaUzluWlhSVGRHVndjMUJsY2xOMFpYQlRaWFE2R0dOdmNtVXZaWGhsWTNWMFpTOW5aWFJUZEdWd1UyVjBjenNWWTI5eVpTOWxlR1ZqZFhSbEwyZGxkRk4wWlhCelBDSmpiM0psTDNCdmNuUmhZbXhsTDNCdmNuUmhZbXhsTDNVeE5sQnZjblJoWW14bFBUZGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TGsxQldGOURXVU5NUlZOZlVFVlNYMU5EUVU1TVNVNUZQakpqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxtSmhkR05vVUhKdlkyVnpjME41WTJ4bGN6OG5ZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5c2IyRmtSbkp2YlZaeVlXMUNZVzVyUUNkamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMmRsZEZKbllsQnBlR1ZzVTNSaGNuUkJKbU52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdmMyVjBVR2w0Wld4UGJrWnlZVzFsUWlSamIzSmxMMmR5WVhCb2FXTnpMM0J5YVc5eWFYUjVMMmRsZEZCcGVHVnNVM1JoY25SREttTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WjJWMFVISnBiM0pwZEhsbWIzSlFhWGhsYkVRaFkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzSmxjMlYwUW1sMFQyNUNlWFJsUlI5amIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmMyVjBRbWwwVDI1Q2VYUmxSaXBqYjNKbEwyZHlZWEJvYVdOekwzQnlhVzl5YVhSNUwyRmtaRkJ5YVc5eWFYUjVabTl5VUdsNFpXeEhPbU52Y21VdlozSmhjR2hwWTNNdlltRmphMmR5YjNWdVpGZHBibVJ2ZHk5a2NtRjNUR2x1WlU5bVZHbHNaVVp5YjIxVWFXeGxRMkZqYUdWSUptTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaMlYwVkdsc1pVUmhkR0ZCWkdSeVpYTnpTVE5qYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmJHOWhaRkJoYkdWMGRHVkNlWFJsUm5KdmJWZGhjMjFOWlcxdmNubEtJMk52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzlqYjI1allYUmxibUYwWlVKNWRHVnpTeXhqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdloyVjBVbWRpUTI5c2IzSkdjbTl0VUdGc1pYUjBaVXd1WTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwyZGxkRU52Ykc5eVEyOXRjRzl1Wlc1MFJuSnZiVkpuWWswelkyOXlaUzluY21Gd2FHbGpjeTl3WVd4bGRIUmxMMmRsZEUxdmJtOWphSEp2YldWRGIyeHZja1p5YjIxUVlXeGxkSFJsVGlWamIzSmxMMmR5WVhCb2FXTnpMM1JwYkdWekwyZGxkRlJwYkdWUWFYaGxiRk4wWVhKMFR5eGpiM0psTDJkeVlYQm9hV056TDNScGJHVnpMMlJ5WVhkUWFYaGxiSE5HY205dFRHbHVaVTltVkdsc1pWQTNZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDJSeVlYZE1hVzVsVDJaVWFXeGxSbkp2YlZScGJHVkpaRkUzWTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGREYjJ4dmNsQnBlR1ZzUm5KdmJWUnBiR1ZKWkZJOFkyOXlaUzluY21Gd2FHbGpjeTlpWVdOclozSnZkVzVrVjJsdVpHOTNMMlJ5WVhkTmIyNXZZMmh5YjIxbFVHbDRaV3hHY205dFZHbHNaVWxrVXp0amIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDBKaFkydG5jbTkxYm1SWGFXNWtiM2RUWTJGdWJHbHVaVlF2WTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wzSmxibVJsY2tKaFkydG5jbTkxYm1SVksyTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTl5Wlc1a1pYSlhhVzVrYjNkV0kyTnZjbVV2WjNKaGNHaHBZM012YzNCeWFYUmxjeTl5Wlc1a1pYSlRjSEpwZEdWelZ5UmpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDE5a2NtRjNVMk5oYm14cGJtVllLV052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlgzSmxibVJsY2tWdWRHbHlaVVp5WVcxbFdTZGpiM0psTDJkeVlYQm9hV056TDNCeWFXOXlhWFI1TDJOc1pXRnlVSEpwYjNKcGRIbE5ZWEJhSW1OdmNtVXZaM0poY0docFkzTXZkR2xzWlhNdmNtVnpaWFJVYVd4bFEyRmphR1ZiTzJOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVUVWxPWDBOWlEweEZVMTlUVUZKSlZFVlRYMHhEUkY5TlQwUkZYRUZqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxrMUpUbDlEV1VOTVJWTmZWRkpCVGxOR1JWSmZSRUZVUVY5TVEwUmZUVTlFUlYwc1kyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlgzSmxjWFZsYzNSSmJuUmxjbkoxY0hSZUxtTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwzSmxjWFZsYzNSTVkyUkpiblJsY25KMWNIUmZLV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdVltRjBZMmhRY205alpYTnpRM2xqYkdWellDMWpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG0xaGVFWnlZVzFsVTJWeGRXVnVZMlZEZVdOc1pYTmhLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUR1Z1WjNSb1lpbGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVeGxibWQwYUdNcFkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTFjR1JoZEdWTVpXNW5kR2hrS1dOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVEdWdVozUm9aU3hqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDJkbGRFNWxkMFp5WlhGMVpXNWplVVp5YjIxVGQyVmxjR1lwWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1elpYUkdjbVZ4ZFdWdVkzbG5NbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2WTJGc1kzVnNZWFJsVTNkbFpYQkJibVJEYUdWamEwOTJaWEptYkc5M2FDaGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpWTjNaV1Z3YVN0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlVWdWRtVnNiM0JsYWl0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlVWdWRtVnNiM0JsYXl0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlVWdWRtVnNiM0JsYkNWamIzSmxMM052ZFc1a0wzTnZkVzVrTDNWd1pHRjBaVVp5WVcxbFUyVnhkV1Z1WTJWeWJTNWpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbmRwYkd4RGFHRnVibVZzVlhCa1lYUmxiaXBqYjNKbEwzTnZkVzVrTDJGalkzVnRkV3hoZEc5eUwyUnBaRU5vWVc1dVpXeEVZV05EYUdGdVoyVnZMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1Z3TG1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWQybHNiRU5vWVc1dVpXeFZjR1JoZEdWeExtTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkMmxzYkVOb1lXNXVaV3hWY0dSaGRHVnlKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1Y21WelpYUlVhVzFsY25NOVkyOXlaUzl6YjNWdVpDOWtkWFI1TDJselJIVjBlVU41WTJ4bFEyeHZZMnRRYjNOcGRHbDJaVTl5VG1WbllYUnBkbVZHYjNKWFlYWmxabTl5YlhRbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNW5aWFJUWVcxd2JHVjFObU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1WjJWMFUyRnRjR3hsUm5KdmJVTjVZMnhsUTI5MWJuUmxjblluWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1eVpYTmxkRlJwYldWeWR5WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbWRsZEZOaGJYQnNaWGcyWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1blpYUlRZVzF3YkdWR2NtOXRRM2xqYkdWRGIzVnVkR1Z5ZVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuSmxjMlYwVkdsdFpYSjZJbU52Y21VdmNHOXlkR0ZpYkdVdmNHOXlkR0ZpYkdVdmFUTXlVRzl5ZEdGaWJHVjdKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11WjJWMFUyRnRjR3hsZkRaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxtZGxkRk5oYlhCc1pVWnliMjFEZVdOc1pVTnZkVzUwWlhKOU8yTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVaMlYwVG05cGMyVkRhR0Z1Ym1Wc1JuSmxjWFZsYm1ONVVHVnlhVzlrZmlaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExtZGxkRk5oYlhCc1pYODJZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVuWlhSVFlXMXdiR1ZHY205dFEzbGpiR1ZEYjNWdWRHVnlnQUVjWTI5eVpTOWpjSFV2WTNCMUwwTndkUzVEVEU5RFMxOVRVRVZGUklFQkttTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1YldGNFJHOTNibE5oYlhCc1pVTjVZMnhsYzRJQktHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdloyVjBVMkZ0Y0d4bFFYTlZibk5wWjI1bFpFSjVkR1dEQVNKamIzSmxMM052ZFc1a0wzTnZkVzVrTDIxcGVFTm9ZVzV1Wld4VFlXMXdiR1Z6aEFFelkyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5elpYUk1aV1owUVc1a1VtbG5hSFJQZFhSd2RYUkdiM0pCZFdScGIxRjFaWFZsaFFFbVkyOXlaUzl6YjNWdVpDOWhZMk4xYlhWc1lYUnZjaTloWTJOMWJYVnNZWFJsVTI5MWJtU0dBU0JqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2YzNCc2FYUklhV2RvUW5sMFpZY0JIMk52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl6Y0d4cGRFeHZkMEo1ZEdXSUFSOWpiM0psTDNOdmRXNWtMM052ZFc1a0wyTmhiR04xYkdGMFpWTnZkVzVraVFFY1kyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5MWNHUmhkR1ZUYjNWdVpJb0JJbU52Y21VdmMyOTFibVF2YzI5MWJtUXZZbUYwWTJoUWNtOWpaWE56UVhWa2FXK0xBU3RqYjNKbEwzTnZkVzVrTDNKbFoybHpkR1Z5Y3k5VGIzVnVaRkpsWjJsemRHVnlVbVZoWkZSeVlYQnpqQUVoWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDJkbGRFcHZlWEJoWkZOMFlYUmxqUUVrWTI5eVpTOXRaVzF2Y25rdmNtVmhaRlJ5WVhCekwyTm9aV05yVW1WaFpGUnlZWEJ6amdFeVkyOXlaUzl0WlcxdmNua3ZiRzloWkM5bGFXZG9kRUpwZEV4dllXUkdjbTl0UjBKTlpXMXZjbmxYYVhSb1ZISmhjSE9QQVNGamIzSmxMMjFsYlc5eWVTOWlZVzVyYVc1bkwyaGhibVJzWlVKaGJtdHBibWVRQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VEQ1JBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5Wd1pHRjBaVTVTZURDU0FTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlREdUQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlU1U2VER1VBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5Wd1pHRjBaVTVTZURHVkFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMblZ3WkdGMFpVNVNlREdXQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VES1hBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5Wd1pHRjBaVTVTZURLWUFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlREtaQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlU1U2VES2FBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURPYkFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVNVNlRE9jQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlU1U2VET2RBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5Wd1pHRjBaVTVTZURPZUFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlRFNmQVNSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuUnlhV2RuWlhLZ0FTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVNVNlRFNoQVNSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuUnlhV2RuWlhLaUFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlRFNqQVNSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuUnlhV2RuWlhLa0FTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMblZ3WkdGMFpVNVNlRFNsQVNSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuUnlhV2RuWlhLbUFTRmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG5Wd1pHRjBaVTVTTlRDbkFTRmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG5Wd1pHRjBaVTVTTlRHb0FTRmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG5Wd1pHRjBaVTVTTlRLcEFTeGpiM0psTDNOdmRXNWtMM0psWjJsemRHVnljeTlUYjNWdVpGSmxaMmx6ZEdWeVYzSnBkR1ZVY21Gd2M2b0JKV052Y21VdlozSmhjR2hwWTNNdmJHTmtMMHhqWkM1MWNHUmhkR1ZNWTJSVGRHRjBkWE9yQVNCamIzSmxMMjFsYlc5eWVTOWtiV0V2YzNSaGNuUkViV0ZVY21GdWMyWmxjcXdCSjJOdmNtVXZiV1Z0YjNKNUwyUnRZUzluWlhSSVpHMWhVMjkxY21ObFJuSnZiVTFsYlc5eWVhMEJMR052Y21VdmJXVnRiM0o1TDJSdFlTOW5aWFJJWkcxaFJHVnpkR2x1WVhScGIyNUdjbTl0VFdWdGIzSjVyZ0VoWTI5eVpTOXRaVzF2Y25rdlpHMWhMM04wWVhKMFNHUnRZVlJ5WVc1elptVnlyd0V5WTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwzTjBiM0psVUdGc1pYUjBaVUo1ZEdWSmJsZGhjMjFOWlcxdmNubXdBVEJqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmFXNWpjbVZ0Wlc1MFVHRnNaWFIwWlVsdVpHVjRTV1pUWlhTeEFTOWpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2ZDNKcGRHVkRiMnh2Y2xCaGJHVjBkR1ZVYjAxbGJXOXllYklCTUdOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JVYVcxbGNrbHVkR1Z5Y25Wd2RMTUJLbU52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlmWjJWMFZHbHRaWEpEYjNWdWRHVnlUV0Z6YTBKcGRMUUJPMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlmWTJobFkydEVhWFpwWkdWeVVtVm5hWE4wWlhKR1lXeHNhVzVuUldSblpVUmxkR1ZqZEc5eXRRRXBZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMTlwYm1OeVpXMWxiblJVYVcxbGNrTnZkVzUwWlhLMkFSOWpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZkWEJrWVhSbFZHbHRaWEp6dHdFbFkyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwySmhkR05vVUhKdlkyVnpjMVJwYldWeWM3Z0JMMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXVkWEJrWVhSbFJHbDJhV1JsY2xKbFoybHpkR1Z5dVFFc1kyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1MWNHUmhkR1ZVYVcxbGNrTnZkVzUwWlhLNkFTdGpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlZScGJXVnlUVzlrZFd4dnV3RXNZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMVJwYldWeWN5NTFjR1JoZEdWVWFXMWxja052Ym5SeWIyeThBU1pqYjNKbEwyMWxiVzl5ZVM5M2NtbDBaVlJ5WVhCekwyTm9aV05yVjNKcGRHVlVjbUZ3YzcwQk5HTnZjbVV2YldWdGIzSjVMM04wYjNKbEwyVnBaMmgwUW1sMFUzUnZjbVZKYm5SdlIwSk5aVzF2Y25sWGFYUm9WSEpoY0hPK0FSeGpiM0psTDIxbGJXOXllUzlrYldFdmFHUnRZVlJ5WVc1elptVnl2d0VnWTI5eVpTOXRaVzF2Y25rdlpHMWhMM1Z3WkdGMFpVaGliR0Z1YTBoa2JXSEFBVEZqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTl5WlhGMVpYTjBWa0pzWVc1clNXNTBaWEp5ZFhCMHdRRWVZMjl5WlM5bmNtRndhR2xqY3k5c1kyUXZjMlYwVEdOa1UzUmhkSFZ6d2dFbFkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTkxY0dSaGRHVkhjbUZ3YUdsamM4TUJLMk52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlltRjBZMmhRY205alpYTnpSM0poY0docFkzUEVBUnBqYjNKbEwyTjVZMnhsY3k5MGNtRmphME41WTJ4bGMxSmhic1VCRm1OdmNtVXZZM2xqYkdWekwzTjVibU5EZVdOc1pYUEdBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmRsZEVSaGRHRkNlWFJsVkhkdnh3RWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW5aWFJFWVhSaFFubDBaVTl1WmNnQktHTnZjbVV2WTNCMUwyOXdZMjlrWlhNdloyVjBRMjl1WTJGMFpXNWhkR1ZrUkdGMFlVSjVkR1hKQVNoamIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJWcFoyaDBRbWwwVTNSdmNtVlRlVzVqUTNsamJHVnp5Z0VaWTI5eVpTOWpjSFV2Wm14aFozTXZjMlYwUm14aFowSnBkTXNCSDJOdmNtVXZZM0IxTDJac1lXZHpMM05sZEVoaGJHWkRZWEp5ZVVac1lXZk1BUzlqYjNKbEwyTndkUzltYkdGbmN5OWphR1ZqYTBGdVpGTmxkRVZwWjJoMFFtbDBTR0ZzWmtOaGNuSjVSbXhoWjgwQkdtTnZjbVV2WTNCMUwyWnNZV2R6TDNObGRGcGxjbTlHYkdGbnpnRWVZMjl5WlM5amNIVXZabXhoWjNNdmMyVjBVM1ZpZEhKaFkzUkdiR0ZuendFYlkyOXlaUzlqY0hVdlpteGhaM012YzJWMFEyRnljbmxHYkdGbjBBRWhZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM0p2ZEdGMFpVSjVkR1ZNWldaMDBRRTJZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZjMmw0ZEdWbGJrSnBkRk4wYjNKbFNXNTBiMGRDVFdWdGIzSjVWMmwwYUZSeVlYQnowZ0VxWTI5eVpTOWpjSFV2YjNCamIyUmxjeTl6YVhoMFpXVnVRbWwwVTNSdmNtVlRlVzVqUTNsamJHVnowd0UwWTI5eVpTOWpjSFV2Wm14aFozTXZZMmhsWTJ0QmJtUlRaWFJUYVhoMFpXVnVRbWwwUm14aFozTkJaR1JQZG1WeVpteHZkOVFCSjJOdmNtVXZZM0IxTDI5d1kyOWtaWE12WldsbmFIUkNhWFJNYjJGa1UzbHVZME41WTJ4bGM5VUJJbU52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl5YjNSaGRHVkNlWFJsVW1sbmFIVFdBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRCNDF3RWJZMjl5WlM5amNIVXZabXhoWjNNdloyVjBRMkZ5Y25sR2JHRm4yQUV0WTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKdmRHRjBaVUo1ZEdWTVpXWjBWR2h5YjNWbmFFTmhjbko1MlFFaFkyOXlaUzl3YjNKMFlXSnNaUzl3YjNKMFlXSnNaUzlwT0ZCdmNuUmhZbXhsMmdFaVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM0psYkdGMGFYWmxTblZ0Y05zQkxtTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXliM1JoZEdWQ2VYUmxVbWxuYUhSVWFISnZkV2RvUTJGeWNubmNBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRGNDNRRWFZMjl5WlM5amNIVXZabXhoWjNNdloyVjBXbVZ5YjBac1lXZmVBUjlqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJJWVd4bVEyRnljbmxHYkdGbjN3RWVZMjl5WlM5amNIVXZabXhoWjNNdloyVjBVM1ZpZEhKaFkzUkdiR0ZuNEFFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXllT0VCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE0zamlBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRSNDR3RWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1UxZU9RQkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxObmpsQVJ0amIzSmxMMk53ZFM5amNIVXZRM0IxTG1WdVlXSnNaVWhoYkhUbUFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVGQ0NXdFclkyOXlaUzlqY0hVdlpteGhaM012WTJobFkydEJibVJUWlhSRmFXZG9kRUpwZEVOaGNuSjVSbXhoWitnQkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTloWkdSQlVtVm5hWE4wWlhMcEFTNWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12WVdSa1FWUm9jbTkxWjJoRFlYSnllVkpsWjJsemRHVnk2Z0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVNGVPc0JJbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emRXSkJVbVZuYVhOMFpYTHNBUzVqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMzVmlRVlJvY205MVoyaERZWEp5ZVZKbFoybHpkR1Z5N1FFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTVlTzRCSW1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWhibVJCVW1WbmFYTjBaWEx2QVNKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZlRzl5UVZKbFoybHpkR1Z5OEFFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkJlUEVCSVdOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXZja0ZTWldkcGMzUmxjdklCSVdOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWpjRUZTWldkcGMzUmxjdk1CSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFFuajBBU3RqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMM05wZUhSbFpXNUNhWFJNYjJGa1JuSnZiVWRDVFdWdGIzSjU5UUVwWTI5eVpTOWpjSFV2YjNCamIyUmxjeTl6YVhoMFpXVnVRbWwwVEc5aFpGTjVibU5EZVdOc1pYUDJBU2hqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpNWldaMDl3RXBZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKdmRHRjBaVkpsWjJsemRHVnlVbWxuYUhUNEFUUmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSk1aV1owVkdoeWIzVm5hRU5oY25KNStRRTFZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKdmRHRjBaVkpsWjJsemRHVnlVbWxuYUhSVWFISnZkV2RvUTJGeWNubjZBU2RqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMyaHBablJNWldaMFVtVm5hWE4wWlhMN0FUSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUlNhV2RvZEVGeWFYUm9iV1YwYVdOU1pXZHBjM1JsY3Z3QksyTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6ZDJGd1RtbGlZbXhsYzA5dVVtVm5hWE4wWlhMOUFTOWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUlNhV2RvZEV4dloybGpZV3hTWldkcGMzUmxjdjRCSjJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OTBaWE4wUW1sMFQyNVNaV2RwYzNSbGN2OEJKbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5elpYUkNhWFJQYmxKbFoybHpkR1Z5Z0FJaFkyOXlaUzlqY0hVdlkySlBjR052WkdWekwyaGhibVJzWlVOaVQzQmpiMlJsZ1FJZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkRlSUlDS0dOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNObGRFbHVkR1Z5Y25Wd2RIT0RBaDlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVSNGhBSWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1ZGZUlVQ0gyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxSbmlHQWg1amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJWNFpXTjFkR1ZQY0dOdlpHV0hBaUJqYjNKbEwyTndkUzlqY0hVdlEzQjFMbVY0YVhSSVlXeDBRVzVrVTNSdmNJZ0NHV052Y21VdlkzQjFMMk53ZFM5RGNIVXVhWE5JWVd4MFpXU0pBaTFqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzl6YVhoMFpXVnVRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbm1LQWl0amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5ZmFHRnVaR3hsU1c1MFpYSnlkWEIwaXdJcVkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlkyaGxZMnRKYm5SbGNuSjFjSFJ6akFJYVkyOXlaUzlsZUdWamRYUmxMM1J5WVdOclUzUmxjSE5TWVc2TkFoaGpiM0psTDJWNFpXTjFkR1V2WlhobFkzVjBaVk4wWlhDT0FpVmpiM0psTDJOd2RTOWpjSFV2UTNCMUxrMUJXRjlEV1VOTVJWTmZVRVZTWDBaU1FVMUZqd0l3WTI5eVpTOXpiM1Z1WkM5emIzVnVaQzluWlhST2RXMWlaWEpQWmxOaGJYQnNaWE5KYmtGMVpHbHZRblZtWm1WeWtBSWlZMjl5WlM5bGVHVmpkWFJsTDJWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJwRUNHV052Y21VdlpYaGxZM1YwWlM5bGVHVmpkWFJsUm5KaGJXV1NBaUpqYjNKbEwyVjRaV04xZEdVdlpYaGxZM1YwWlUxMWJIUnBjR3hsUm5KaGJXVnprd0ltWTI5eVpTOWxlR1ZqZFhSbEwyVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVcrVUFpaGpiM0psTDJWNFpXTjFkR1V2WlhobFkzVjBaVVp5WVcxbFZXNTBhV3hDY21WaGEzQnZhVzUwbFFJZ1kyOXlaUzlqZVdOc1pYTXZaMlYwUTNsamJHVnpVR1Z5UTNsamJHVlRaWFNXQWhoamIzSmxMMk41WTJ4bGN5OW5aWFJEZVdOc1pWTmxkSE9YQWhWamIzSmxMMk41WTJ4bGN5OW5aWFJEZVdOc1pYT1lBalJqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2WDJkbGRFcHZlWEJoWkVKMWRIUnZibE4wWVhSbFJuSnZiVUoxZEhSdmJrbGttUUkwWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5elpYUktiM2x3WVdSQ2RYUjBiMjVUZEdGMFpVWnliMjFDZFhSMGIyNUpaSm9DTVdOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JLYjNsd1lXUkpiblJsY25KMWNIU2JBaVZqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2WDNCeVpYTnpTbTk1Y0dGa1FuVjBkRzl1bkFJblkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wxOXlaV3hsWVhObFNtOTVjR0ZrUW5WMGRHOXVuUUloWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDNObGRFcHZlWEJoWkZOMFlYUmxuZ0loWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkJud0loWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkNvQUloWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkRvUUloWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkVvZ0loWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkZvd0loWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSklwQUloWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSk1wUUloWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkdwZ0ltWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVSEp2WjNKaGJVTnZkVzUwWlhLbkFpUmpiM0psTDJSbFluVm5MMlJsWW5WbkxXTndkUzluWlhSVGRHRmphMUJ2YVc1MFpYS29BaTVqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5cVFJZlkyOXlaUzlrWldKMVp5OWtaV0oxWnkxbmNtRndhR2xqY3k5blpYUk1XYW9DTjJOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WjNKaGNHaHBZM012WkhKaGQwSmhZMnRuY205MWJtUk5ZWEJVYjFkaGMyMU5aVzF2Y25tckFqSmpiM0psTDJSbFluVm5MMlJsWW5WbkxXZHlZWEJvYVdOekwyUnlZWGRVYVd4bFJHRjBZVlJ2VjJGemJVMWxiVzl5ZWF3Q0hXTnZjbVV2WkdWaWRXY3ZaR1ZpZFdjdGRHbHRaWEl2WjJWMFJFbFdyUUllWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTEwYVcxbGNpOW5aWFJVU1UxQnJnSWRZMjl5WlM5a1pXSjFaeTlrWldKMVp5MTBhVzFsY2k5blpYUlVUVUd2QWgxamIzSmxMMlJsWW5WbkwyUmxZblZuTFhScGJXVnlMMmRsZEZSQlE3QUNCWE4wWVhKMHNRSXhZMjl5WlM5bGVHVmpkWFJsTDJWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzk4ZEhKaGJYQnZiR2x1WmJJQ0NINXpaWFJoY21kanN3SXRZMjl5WlM5bGVHVmpkWFJsTDJWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJueDBjbUZ0Y0c5c2FXNWxBRE1RYzI5MWNtTmxUV0Z3Y0dsdVoxVlNUQ0ZqYjNKbEwyUnBjM1F2WTI5eVpTNTFiblJ2ZFdOb1pXUXVkMkZ6YlM1dFlYQT0iKToKInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93fHwidW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmP2F3YWl0IEUoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZmhCZ0NYOS9mMzkvZjM5L2Z3QmdBQUJnQVg4QmYyQUNmMzhBWUFGL0FHQUNmMzhCZjJBQUFYOWdBMzkvZndGL1lBTi9mMzhBWUFaL2YzOS9mMzhBWUFkL2YzOS9mMzkvQVg5Z0JIOS9mMzhBWUExL2YzOS9mMzkvZjM5L2YzOS9BWDlnQjM5L2YzOS9mMzhBWUFSL2YzOS9BWDlnQ0g5L2YzOS9mMzkvQUFPMkFyUUNBZ0lDQWdFQkF3RUJBUUVCQVFFQkFRVUVCQUVCQkFFQkFRQUdCUU1CQVFFQkFRRUJBUUVCQVFFQ0FRUUJBUVFCQVFFQkFRRUJBUUVCQmdZR0FnWUdCUVVMQlFVRkJRc0tCUVVGQndVSEJ3d0tEUWtKQ0FnREJBRUJBUVlHQkFFR0JnRUJBUUVHQkFFQkFRRUJBZ0lDQWdJQ0FRVUNCZ0VDQmdFQ0FnWUdBZ1lHQmdVT0NBUUNBZ1FFQVFJR0FnSURCQVFFQkFRRUJBUUVCQVFFQkFRRUFRUUJCQUVFQVFRRUJBVUVCQVlHQkFnREF3RUNCUUVFQVFRRUJBUUZBd2dCQVFFRUFRUUVCZ1lHQXdVRUF3UUVCQUlEQXdnQ0FnSUdBZ0lFQWdJR0JnWUNBZ0lDQWdFQ0F3UUVBZ1FFQWdRRUFnUUVBZ0lDQWdJQ0FnSUNBZ0lGQndJQ0JBSUNBZ0lCQmdNRUJnUUdCZ1lIQmdJQ0FnWUdCZ0lEQVFRRUR3WUdCZ1lHQmdZR0JnWUdCZ1FCQmdZR0JnRUNCQWNGQXdFQUFBYVRDNFVDZndCQkFBdC9BRUdBZ0t3RUMzOEFRWXNCQzM4QVFRQUxmd0JCZ0FnTGZ3QkJnQWdMZndCQmdBZ0xmd0JCZ0JBTGZ3QkIvLzhEQzM4QVFZQVFDMzhBUVlDQUFRdC9BRUdBa0FFTGZ3QkJnSUFDQzM4QVFZQ1FBd3QvQUVHQWdBRUxmd0JCZ0pBRUMzOEFRWURvSHd0L0FFR0FrQVFMZndCQmdBUUxmd0JCZ0tBRUMzOEFRWUM0QVF0L0FFR0EyQVVMZndCQmdOZ0ZDMzhBUVlDWURndC9BRUdBZ0F3TGZ3QkJnSmdhQzM4QVFZQ0FDUXQvQUVHQW1DTUxmd0JCZ09BQUMzOEFRWUQ0SXd0L0FFR0FnQWdMZndCQmdQZ3JDMzhBUVlDQUNBdC9BRUdBK0RNTGZ3QkJnSWo0QXd0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRYy8rQXd0L0FVRUFDMzhCUWZEK0F3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCZ0tqV3VRY0xmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVR0E5d0lMZndGQmdJQUlDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQjFmNERDMzhCUWRIK0F3dC9BVUhTL2dNTGZ3RkIwLzREQzM4QlFkVCtBd3QvQVVIby9nTUxmd0ZCNi80REMzOEJRZW4rQXd0L0FFR0FnS3dFQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFmLy9Bd3QvQUVHQWtBUUxmd0JCZ0pBRUMzOEFRWUFFQzM4QVFZRFlCUXQvQUVHQW1BNExmd0JCZ0pnYUMzOEFRWUQ0SXd0L0FFR0ErQ3NMZndCQmdQZ3pDMzhCUVFBTEI4VVBYUVp0WlcxdmNua0NBQVpqYjI1bWFXY0FHUTVvWVhORGIzSmxVM1JoY25SbFpBQWFDWE5oZG1WVGRHRjBaUUFvQ1d4dllXUlRkR0YwWlFBNEVtZGxkRk4wWlhCelVHVnlVM1JsY0ZObGRBQTVDMmRsZEZOMFpYQlRaWFJ6QURvSVoyVjBVM1JsY0hNQU94VmxlR1ZqZFhSbFRYVnNkR2x3YkdWR2NtRnRaWE1Ba2dJTVpYaGxZM1YwWlVaeVlXMWxBSkVDQ0Y5elpYUmhjbWRqQUxJQ0dXVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVc4QXNRSWJaWGhsWTNWMFpVWnlZVzFsVlc1MGFXeENjbVZoYTNCdmFXNTBBSlFDRldWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJnQ3pBZ3RsZUdWamRYUmxVM1JsY0FDTkFoUm5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkQUNWQWd4blpYUkRlV05zWlZObGRITUFsZ0lKWjJWMFEzbGpiR1Z6QUpjQ0RuTmxkRXB2ZVhCaFpGTjBZWFJsQUowQ0gyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWElBandJUVkyeGxZWEpCZFdScGIwSjFabVpsY2dBeUYxZEJVMDFDVDFsZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdBVFYwRlRUVUpQV1Y5TlJVMVBVbGxmVTBsYVJRTUJFbGRCVTAxQ1QxbGZWMEZUVFY5UVFVZEZVd01DSGtGVFUwVk5Ra3haVTBOU1NWQlVYMDFGVFU5U1dWOU1UME5CVkVsUFRnTURHa0ZUVTBWTlFreFpVME5TU1ZCVVgwMUZUVTlTV1Y5VFNWcEZBd1FXVjBGVFRVSlBXVjlUVkVGVVJWOU1UME5CVkVsUFRnTUZFbGRCVTAxQ1QxbGZVMVJCVkVWZlUwbGFSUU1HSUVkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd2NjUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZVMGxhUlFNSUVsWkpSRVZQWDFKQlRWOU1UME5CVkVsUFRnTUpEbFpKUkVWUFgxSkJUVjlUU1ZwRkF3b1JWMDlTUzE5U1FVMWZURTlEUVZSSlQwNERDdzFYVDFKTFgxSkJUVjlUU1ZwRkF3d21UMVJJUlZKZlIwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDRERFNKUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXc0WVIxSkJVRWhKUTFOZlQxVlVVRlZVWDB4UFEwRlVTVTlPQXc4VVIxSkJVRWhKUTFOZlQxVlVVRlZVWDFOSldrVURFQlJIUWtOZlVFRk1SVlJVUlY5TVQwTkJWRWxQVGdNUkVFZENRMTlRUVV4RlZGUkZYMU5KV2tVREVoaENSMTlRVWtsUFVrbFVXVjlOUVZCZlRFOURRVlJKVDA0REV4UkNSMTlRVWtsUFVrbFVXVjlOUVZCZlUwbGFSUU1VRGtaU1FVMUZYMHhQUTBGVVNVOU9BeFVLUmxKQlRVVmZVMGxhUlFNV0YwSkJRMHRIVWs5VlRrUmZUVUZRWDB4UFEwRlVTVTlPQXhjVFFrRkRTMGRTVDFWT1JGOU5RVkJmVTBsYVJRTVlFbFJKVEVWZlJFRlVRVjlNVDBOQlZFbFBUZ01aRGxSSlRFVmZSRUZVUVY5VFNWcEZBeG9TVDBGTlgxUkpURVZUWDB4UFEwRlVTVTlPQXhzT1QwRk5YMVJKVEVWVFgxTkpXa1VESEJWQlZVUkpUMTlDVlVaR1JWSmZURTlEUVZSSlQwNERIUkZCVlVSSlQxOUNWVVpHUlZKZlUwbGFSUU1lRmtOQlVsUlNTVVJIUlY5U1FVMWZURTlEUVZSSlQwNERIeEpEUVZKVVVrbEVSMFZmVWtGTlgxTkpXa1VESUJaRFFWSlVVa2xFUjBWZlVrOU5YMHhQUTBGVVNVOU9BeUVTUTBGU1ZGSkpSRWRGWDFKUFRWOVRTVnBGQXlJaFoyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQUFJTVoyVjBVbVZuYVhOMFpYSkJBSjRDREdkbGRGSmxaMmx6ZEdWeVFnQ2ZBZ3huWlhSU1pXZHBjM1JsY2tNQW9BSU1aMlYwVW1WbmFYTjBaWEpFQUtFQ0RHZGxkRkpsWjJsemRHVnlSUUNpQWd4blpYUlNaV2RwYzNSbGNrZ0Fvd0lNWjJWMFVtVm5hWE4wWlhKTUFLUUNER2RsZEZKbFoybHpkR1Z5UmdDbEFoRm5aWFJRY205bmNtRnRRMjkxYm5SbGNnQ21BZzluWlhSVGRHRmphMUJ2YVc1MFpYSUFwd0laWjJWMFQzQmpiMlJsUVhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0NvQWdWblpYUk1XUUNwQWgxa2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVRQ3FBaGhrY21GM1ZHbHNaVVJoZEdGVWIxZGhjMjFOWlcxdmNua0Fxd0lHWjJWMFJFbFdBS3dDQjJkbGRGUkpUVUVBclFJR1oyVjBWRTFCQUs0Q0JtZGxkRlJCUXdDdkFnWjFjR1JoZEdVQWtRSU5aVzExYkdGMGFXOXVVM1JsY0FDTkFoSm5aWFJCZFdScGIxRjFaWFZsU1c1a1pYZ0Fqd0lQY21WelpYUkJkV1JwYjFGMVpYVmxBRElPZDJGemJVMWxiVzl5ZVZOcGVtVUQ5Z0VjZDJGemJVSnZlVWx1ZEdWeWJtRnNVM1JoZEdWTWIyTmhkR2x2YmdQM0FSaDNZWE50UW05NVNXNTBaWEp1WVd4VGRHRjBaVk5wZW1VRCtBRWRaMkZ0WlVKdmVVbHVkR1Z5Ym1Gc1RXVnRiM0o1VEc5allYUnBiMjREK1FFWloyRnRaVUp2ZVVsdWRHVnlibUZzVFdWdGIzSjVVMmw2WlFQNkFSTjJhV1JsYjA5MWRIQjFkRXh2WTJGMGFXOXVBL3NCSW1aeVlXMWxTVzVRY205bmNtVnpjMVpwWkdWdlQzVjBjSFYwVEc5allYUnBiMjREL2dFYloyRnRaV0p2ZVVOdmJHOXlVR0ZzWlhSMFpVeHZZMkYwYVc5dUEvd0JGMmRoYldWaWIzbERiMnh2Y2xCaGJHVjBkR1ZUYVhwbEEvMEJGV0poWTJ0bmNtOTFibVJOWVhCTWIyTmhkR2x2YmdQL0FRdDBhV3hsUkdGMFlVMWhjQU9BQWhOemIzVnVaRTkxZEhCMWRFeHZZMkYwYVc5dUE0RUNFV2RoYldWQ2VYUmxjMHh2WTJGMGFXOXVBNE1DRkdkaGJXVlNZVzFDWVc1cmMweHZZMkYwYVc5dUE0SUNDQUt3QWdyc3l3RzBBaXNCQW44akxTRUJJeTVGSWdJRVFDQUJSU0VDQ3lBQ0JFQkJBU0VCQ3lBQlFRNTBJQUJCZ0lBQmEyb0xEd0FqTVVFTmRDQUFRWURBQW10cUM3Y0JBUUovQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVNZFNJQ0lRRWdBa1VOQUFKQUlBRkJBV3NPRFFFQkFRSUNBZ0lEQXdRRUJRWUFDd3dHQ3lBQVFZRDRNMm9QQ3lBQUVBQkJnUGd6YWc4TFFRQWhBU012QkVBak1CQURRUUZ4SVFFTElBQkJnSkIrYWlBQlFRMTBhZzhMSUFBUUFVR0ErQ3RxRHdzZ0FFR0FrSDVxRHd0QkFDRUJJeThFUUNNeUVBTkJCM0VoQVFzZ0FVRUJTQVJBUVFFaEFRc2dBQ0FCUVF4MGFrR0E4SDFxRHdzZ0FFR0FVR29MQ1FBZ0FCQUNMUUFBQzVrQkFFRUFKRE5CQUNRMFFRQWtOVUVBSkRaQkFDUTNRUUFrT0VFQUpEbEJBQ1E2UVFBa08wRUFKRHhCQUNROVFRQWtQa0VBSkQ5QkFDUkFRUUFrUVVFQUpFSWpMd1JBUVJFa05FR0FBU1E3UVFBa05VRUFKRFpCL3dFa04wSFdBQ1E0UVFBa09VRU5KRG9GUVFFa05FR3dBU1E3UVFBa05VRVRKRFpCQUNRM1FkZ0JKRGhCQVNRNVFjMEFKRG9MUVlBQ0pEMUIvdjhESkR3THBBRUJBbjlCQUNSRFFRRWtSRUhIQWhBRElRRkJBQ1JGUVFBa1JrRUFKRWRCQUNSSVFRQWtMaUFCQkVBZ0FVRUJUaUlBQkVBZ0FVRURUQ0VBQ3lBQUJFQkJBU1JHQlNBQlFRVk9JZ0FFUUNBQlFRWk1JUUFMSUFBRVFFRUJKRWNGSUFGQkQwNGlBQVJBSUFGQkUwd2hBQXNnQUFSQVFRRWtTQVVnQVVFWlRpSUFCRUFnQVVFZVRDRUFDeUFBQkVCQkFTUXVDd3NMQ3dWQkFTUkZDMEVCSkMxQkFDUXhDd3NBSUFBUUFpQUJPZ0FBQ3k4QVFkSCtBMEgvQVJBR1FkTCtBMEgvQVJBR1FkUCtBMEgvQVJBR1FkVCtBMEgvQVJBR1FkWCtBMEgvQVJBR0M1Z0JBRUVBSkVsQkFDUktRUUFrUzBFQUpFeEJBQ1JOUVFBa1RrRUFKRThqTHdSQVFaQUJKRXRCd1A0RFFaRUJFQVpCd2Y0RFFZRUJFQVpCeFA0RFFaQUJFQVpCeC80RFFmd0JFQVlGUVpBQkpFdEJ3UDREUVpFQkVBWkJ3ZjREUVlVQkVBWkJ4djREUWY4QkVBWkJ4LzREUWZ3QkVBWkJ5UDREUWY4QkVBWkJ5ZjREUWY4QkVBWUxRYy8rQTBFQUVBWkI4UDREUVFFUUJndFBBQ012QkVCQjZQNERRY0FCRUFaQjZmNERRZjhCRUFaQjZ2NERRY0VCRUFaQjYvNERRUTBRQmdWQjZQNERRZjhCRUFaQjZmNERRZjhCRUFaQjZ2NERRZjhCRUFaQjYvNERRZjhCRUFZTEN5OEFRWkQrQTBHQUFSQUdRWkgrQTBHL0FSQUdRWkwrQTBIekFSQUdRWlArQTBIQkFSQUdRWlQrQTBHL0FSQUdDeXdBUVpYK0EwSC9BUkFHUVpiK0EwRS9FQVpCbC80RFFRQVFCa0dZL2dOQkFCQUdRWm4rQTBHNEFSQUdDeklBUVpyK0EwSC9BQkFHUVp2K0EwSC9BUkFHUVp6K0EwR2ZBUkFHUVozK0EwRUFFQVpCbnY0RFFiZ0JFQVpCQVNSZ0N5MEFRWi8rQTBIL0FSQUdRYUQrQTBIL0FSQUdRYUgrQTBFQUVBWkJvdjREUVFBUUJrR2ovZ05CdndFUUJnczRBRUVQSkdGQkR5UmlRUThrWTBFUEpHUkJBQ1JsUVFBa1prRUFKR2RCQUNSb1FmOEFKR2xCL3dBa2FrRUJKR3RCQVNSc1FRQWtiUXRuQUVFQUpGQkJBQ1JSUVFBa1VrRUJKRk5CQVNSVVFRRWtWVUVCSkZaQkFTUlhRUUVrV0VFQkpGbEJBU1JhUVFFa1cwRUFKRnhCQUNSZFFRQWtYa0VBSkY4UUNoQUxFQXdRRFVHay9nTkI5d0FRQmtHbC9nTkI4d0VRQmtHbS9nTkI4UUVRQmhBT0N3MEFJQUZCQVNBQWRIRkJBRWNMSmdCQkFDQUFFQkFrYmtFQklBQVFFQ1J2UVFJZ0FCQVFKSEJCQkNBQUVCQWtjU0FBSkhJTEpnQkJBQ0FBRUJBa2MwRUJJQUFRRUNSMFFRSWdBQkFRSkhWQkJDQUFFQkFrZGlBQUpIY0xHd0JCQUJBUlFmLy9BeU55RUFaQjRRRVFFa0dQL2dNamR4QUdDMUlBUVFBa2VFRUFKSGxCQUNSNlFRQWtlMEVBSkh4QkFDUjlRUUFrZmtFQUpIOGpMd1JBUVlUK0EwRWVFQVpCb0Qwa2VRVkJoUDREUWFzQkVBWkJ6TmNDSkhrTFFZZitBMEg0QVJBR1FmZ0JKSDBMQ1FBZ0FFRUJjU1FqQ3hVQVFZQ28xcmtISklBQlFRQWtnUUZCQUNTQ0FRc1ZBRUdBcU5hNUJ5U0RBVUVBSklRQlFRQWtoUUVMendFQkFuOUJ3d0lRQXlJQlFjQUJSaUlBUlFSQUl5VUVmeUFCUVlBQlJnVWpKUXNoQUFzZ0FBUkFRUUVrTHdWQkFDUXZDeEFFRUFVUUJ4QUlFQWtRRHhBVEVCUWpMd1JBUWZEK0EwSDRBUkFHUWMvK0EwSCtBUkFHUWMzK0EwSCtBQkFHUVlEK0EwSFBBUkFHUVlMK0EwSDhBQkFHUVkvK0EwSGhBUkFHUWV6K0EwSCtBUkFHUWZYK0EwR1BBUkFHQlVIdy9nTkIvd0VRQmtIUC9nTkIvd0VRQmtITi9nTkIvd0VRQmtHQS9nTkJ6d0VRQmtHQy9nTkIvZ0FRQmtHUC9nTkI0UUVRQmd0QkFCQVZFQllRRnd1ZEFRQWdBRUVBU2dSQVFRRWtKQVZCQUNRa0N5QUJRUUJLQkVCQkFTUWxCVUVBSkNVTElBSkJBRW9FUUVFQkpDWUZRUUFrSmdzZ0EwRUFTZ1JBUVFFa0p3VkJBQ1FuQ3lBRVFRQktCRUJCQVNRb0JVRUFKQ2dMSUFWQkFFb0VRRUVCSkNrRlFRQWtLUXNnQmtFQVNnUkFRUUVrS2dWQkFDUXFDeUFIUVFCS0JFQkJBU1FyQlVFQUpDc0xJQWhCQUVvRVFFRUJKQ3dGUVFBa0xBc1FHQXNNQUNNakJFQkJBUThMUVFBTERnQWdBRUdBQ0dvZ0FVRXliR29MR1FBZ0FVRUJjUVJBSUFCQkFUb0FBQVVnQUVFQU9nQUFDd3VqQVFCQkFFRUFFQnNqTkRvQUFFRUJRUUFRR3lNMU9nQUFRUUpCQUJBYkl6WTZBQUJCQTBFQUVCc2pOem9BQUVFRVFRQVFHeU00T2dBQVFRVkJBQkFiSXprNkFBQkJCa0VBRUJzak9qb0FBRUVIUVFBUUd5TTdPZ0FBUVFoQkFCQWJJenc3QVFCQkNrRUFFQnNqUFRzQkFFRU1RUUFRR3lNK05nSUFRUkZCQUJBYkl6OFFIRUVTUVFBUUd5TkFFQnhCRTBFQUVCc2pRUkFjUVJSQkFCQWJJMElRSEFzaEFFRUFRUUVRR3lOS05nSUFRUVJCQVJBYkk0WUJPZ0FBUWNUK0F5TkxFQVlMR0FCQkFFRUNFQnNqaHdFUUhFRUJRUUlRR3lPSUFSQWNDd01BQVF0ZUFFRUFRUVFRR3lNdE93RUFRUUpCQkJBYkl6RTdBUUJCQkVFRUVCc2pReEFjUVFWQkJCQWJJMFFRSEVFR1FRUVFHeU5GRUJ4QkIwRUVFQnNqUmhBY1FRaEJCQkFiSTBjUUhFRUpRUVFRR3lOSUVCeEJDa0VFRUJzakxoQWNDelFBUVFCQkJSQWJJM2cyQWdCQkJFRUZFQnNqZVRZQ0FFRUlRUVVRR3lOK0VCeEJDMEVGRUJzamZ4QWNRWVgrQXlONkVBWUxJd0JCQUVFR0VCc2pYRFlDQUVFRVFRWVFHeU5kT2dBQVFRVkJCaEFiSTE0NkFBQUxlQUJCQUVFSEVCc2ppUUVRSEVFQlFRY1FHeU9LQVRZQ0FFRUZRUWNRR3lPTEFUWUNBRUVKUVFjUUd5T01BVFlDQUVFT1FRY1FHeU9OQVRZQ0FFRVRRUWNRR3lPT0FUb0FBRUVVUVFjUUd5T1BBVG9BQUVFWlFRY1FHeU9RQVJBY1FScEJCeEFiSTVFQk5nSUFRUjlCQnhBYkk1SUJPd0VBQzFVQVFRQkJDQkFiSTVNQkVCeEJBVUVJRUJzamxBRTJBZ0JCQlVFSUVCc2psUUUyQWdCQkNVRUlFQnNqbGdFMkFnQkJEa0VJRUJzamx3RTJBZ0JCRTBFSUVCc2ptQUU2QUFCQkZFRUlFQnNqbVFFNkFBQUxNUUJCQUVFSkVCc2ptZ0VRSEVFQlFRa1FHeU9iQVRZQ0FFRUZRUWtRR3lPY0FUWUNBRUVKUVFrUUd5T2RBVHNCQUF0SkFFRUFRUW9RR3lPZUFSQWNRUUZCQ2hBYkk1OEJOZ0lBUVFWQkNoQWJJNkFCTmdJQVFRbEJDaEFiSTZFQk5nSUFRUTVCQ2hBYkk2SUJOZ0lBUVJOQkNoQWJJNk1CT3dFQUN4d0FFQjBRSGhBZkVDQVFJUkFpRUNNUUpCQWxFQ1lRSjBFQUVCVUxFZ0FnQUMwQUFFRUFTZ1JBUVFFUEMwRUFDNk1CQUVFQVFRQVFHeTBBQUNRMFFRRkJBQkFiTFFBQUpEVkJBa0VBRUJzdEFBQWtOa0VEUVFBUUd5MEFBQ1EzUVFSQkFCQWJMUUFBSkRoQkJVRUFFQnN0QUFBa09VRUdRUUFRR3kwQUFDUTZRUWRCQUJBYkxRQUFKRHRCQ0VFQUVCc3ZBUUFrUEVFS1FRQVFHeThCQUNROVFReEJBQkFiS0FJQUpENUJFVUVBRUJzUUtTUS9RUkpCQUJBYkVDa2tRRUVUUVFBUUd4QXBKRUZCRkVFQUVCc1FLU1JDQzBvQVFRY2dBQkFRSktRQlFRWWdBQkFRSktVQlFRVWdBQkFRSktZQlFRUWdBQkFRSktjQlFRTWdBQkFRSktnQlFRSWdBQkFRSktrQlFRRWdBQkFRSktvQlFRQWdBQkFRSktzQkN5a0FRUUJCQVJBYktBSUFKRXBCQkVFQkVCc3RBQUFraGdGQnhQNERFQU1rUzBIQS9nTVFBeEFyQ3lnQVFRQkJBaEFiRUNra2h3RkJBVUVDRUJzUUtTU0lBVUgvL3dNUUF4QVJRWS8rQXhBREVCSUxId0FnQUVIL0FYTWtyQUZCQkNPc0FSQVFKSzBCUVFVanJBRVFFQ1N1QVFzS0FFR0EvZ01RQXhBdUMxNEFRUUJCQkJBYkx3RUFKQzFCQWtFRUVCc3ZBUUFrTVVFRVFRUVFHeEFwSkVOQkJVRUVFQnNRS1NSRVFRWkJCQkFiRUNra1JVRUhRUVFRR3hBcEpFWkJDRUVFRUJzUUtTUkhRUWxCQkJBYkVDa2tTRUVLUVFRUUd4QXBKQzRMUkFCQkFFRUZFQnNvQWdBa2VFRUVRUVVRR3lnQ0FDUjVRUWhCQlJBYkVDa2tma0VMUVFVUUd4QXBKSDlCaGY0REVBTWtla0dHL2dNUUF5UjdRWWYrQXhBREpIMExCZ0JCQUNSZkN5VUFRUUJCQmhBYktBSUFKRnhCQkVFR0VCc3RBQUFrWFVFRlFRWVFHeTBBQUNSZUVESUxlQUJCQUVFSEVCc1FLU1NKQVVFQlFRY1FHeWdDQUNTS0FVRUZRUWNRR3lnQ0FDU0xBVUVKUVFjUUd5Z0NBQ1NNQVVFT1FRY1FHeWdDQUNTTkFVRVRRUWNRR3kwQUFDU09BVUVVUVFjUUd5MEFBQ1NQQVVFWlFRY1FHeEFwSkpBQlFScEJCeEFiS0FJQUpKRUJRUjlCQnhBYkx3RUFKSklCQzFVQVFRQkJDQkFiRUNra2t3RkJBVUVJRUJzb0FnQWtsQUZCQlVFSUVCc29BZ0FrbFFGQkNVRUlFQnNvQWdBa2xnRkJEa0VJRUJzb0FnQWtsd0ZCRTBFSUVCc3RBQUFrbUFGQkZFRUlFQnN0QUFBa21RRUxNUUJCQUVFSkVCc1FLU1NhQVVFQlFRa1FHeWdDQUNTYkFVRUZRUWtRR3lnQ0FDU2NBVUVKUVFrUUd5OEJBQ1NkQVF0SkFFRUFRUW9RR3hBcEpKNEJRUUZCQ2hBYktBSUFKSjhCUVFWQkNoQWJLQUlBSktBQlFRbEJDaEFiS0FJQUpLRUJRUTVCQ2hBYktBSUFKS0lCUVJOQkNoQWJMd0VBSktNQkN5QUFFQ29RTEJBdEVDOFFNQkF4RURNUU5CQTFFRFlRTjBFQUVCVVFGaEFYQ3dVQUk0TUJDd1VBSTRRQkN3VUFJNFVCQ3drQUlBQkIvLzhEY1FzbUFDTXpCRUFqUzBHWkFVWUVRRUVJRHd0QmtBY1BDeU5MUVprQlJnUkFRUVFQQzBISUF3c0VBQkE5Q3hVQUlBQkJnSkIrYWlBQlFRRnhRUTEwYWkwQUFBc09BQ0FCUWFBQmJDQUFha0VEYkFzVkFDQUFJQUVRUUVHQTJBVnFJQUpxSUFNNkFBQUxDd0FnQVVHZ0FXd2dBR29MRUFBZ0FDQUJFRUpCZ0tBRWFpMEFBQXNOQUNBQlFRRWdBSFJCZjNOeEN3b0FJQUZCQVNBQWRISUxLd0VCZnlBQ1FRTnhJUVFnQTBFQmNRUkFRUUlnQkJCRklRUUxJQUFnQVJCQ1FZQ2dCR29nQkRvQUFBdXVBZ0VEZnlBQlFRQktJZ01FUUNBQVFRaEtJUU1MSUFNRVFDQUdJN0FCUmlFREN5QURCRUFnQUNPeEFVWWhBd3NnQXdSQVFRQWhBMEVBSVFaQkJTQUVRUUZyRUFNUUVBUkFRUUVoQXd0QkJTQUVFQU1RRUFSQVFRRWhCZ3NDUUVFQUlRUURRQ0FFUVFoT0RRRWdBeUFHUndSQVFRY2dCR3NoQkFzZ0FDQUVha0dnQVV3RVFDQUFRUWdnQkd0cklRZ2dBQ0FFYWlBQkVFQkJnTmdGYWlFSkFrQkJBQ0VGQTBBZ0JVRURUZzBCSUFBZ0JHb2dBU0FGSUFrZ0JXb3RBQUFRUVNBRlFRRnFJUVVNQUFBTEFBc2dBQ0FFYWlBQlFRSWdDQ0FCRUVNaUJSQkVRUUlnQlJBUUVFWWdCMEVCYWlFSEN5QUVRUUZxSVFRTUFBQUxBQXNGSUFZa3NBRUxJQUFqc1FGT0JFQWdBRUVJYWlTeEFTQUFJQUpCQ0c4aUJrZ0VRQ094QVNBR2FpU3hBUXNMSUFjTE9BRUJmeUFBUVlDUUFrWUVRQ0FCUVlBQmFpRUNRUWNnQVJBUUJFQWdBVUdBQVdzaEFnc2dBQ0FDUVFSMGFnOExJQUFnQVVFRWRHb0xKQUVCZnlBQVFUOXhJUUlnQVVFQmNRUkFJQUpCUUdzaEFnc2dBa0dBa0FScUxRQUFDeElBSUFCQi93RnhRUWgwSUFGQi93RnhjZ3NnQVFGL0lBQkJBM1FnQVVFQmRHb2lBMEVCYWlBQ0VFa2dBeUFDRUVrUVNnc1ZBQ0FCUVI4Z0FFRUZiQ0lBZEhFZ0FIVkJBM1FMV1FBZ0FrRUJjVVVFUUNBQkVBTWdBRUVCZEhWQkEzRWhBQXRCOGdFaEFRSkFBa0FDUUFKQUFrQWdBRVVOQkFKQUlBQkJBV3NPQXdJREJBQUxEQVFBQ3dBTFFhQUJJUUVNQWd0QjJBQWhBUXdCQzBFSUlRRUxJQUVMRFFBZ0FTQUNiQ0FBYWtFRGJBdXJBZ0VHZnlBQklBQVFTQ0FGUVFGMGFpSUFJQUlRUHlFUklBQkJBV29nQWhBL0lSSUNRQ0FESVFBRFFDQUFJQVJLRFFFZ0JpQUFJQU5yYWlJT0lBaElCRUFnQUNFQklBeEJBRWdpQWtVRVFFRUZJQXdRRUVVaEFnc2dBZ1JBUVFjZ0FXc2hBUXRCQUNFQ0lBRWdFaEFRQkVCQkFpRUNDeUFCSUJFUUVBUkFJQUpCQVdvaEFnc2dERUVBVGdSL1FRQWdERUVIY1NBQ1FRQVFTeUlGRUV3aEQwRUJJQVVRVENFQlFRSWdCUkJNQlNBTFFRQk1CRUJCeC80RElRc0xJQUlnQ3lBS0VFMGlCU0VQSUFVaUFRc2hCU0FKSUE0Z0J5QUlFRTVxSWhBZ0R6b0FBQ0FRUVFGcUlBRTZBQUFnRUVFQ2FpQUZPZ0FBUVFBaEFTQU1RUUJPQkVCQkJ5QU1FQkFoQVFzZ0RpQUhJQUlnQVJCR0lBMUJBV29oRFFzZ0FFRUJhaUVBREFBQUN3QUxJQTBMaFFFQkEzOGdBMEVJYnlFRElBQkZCRUFnQWlBQ1FRaHRRUU4wYXlFSEMwRUhJUWdnQUVFSWFrR2dBVW9FUUVHZ0FTQUFheUVJQzBGL0lRSWpMd1JBUVFNZ0JFRUJFRDhpQWtIL0FYRVFFQVJBUVFFaENRdEJCaUFDRUJBRVFFRUhJQU5ySVFNTEN5QUdJQVVnQ1NBSElBZ2dBeUFBSUFGQm9BRkJnTmdGUVFCQkFDQUNFRThMM1FFQUlBVWdCaEJJSVFZZ0JFRUJFRDhoQkNBRFFRaHZJUU5CQmlBRUVCQUVRRUVISUFOcklRTUxRUUFoQlVFRElBUVFFQVJBUVFFaEJRc2dCaUFEUVFGMGFpSURJQVVRUHlFR0lBTkJBV29nQlJBL0lRVWdBa0VJYnlFRFFRVWdCQkFRUlFSQVFRY2dBMnNoQXd0QkFDRUNJQU1nQlJBUUJFQkJBaUVDQ3lBRElBWVFFQVJBSUFKQkFXb2hBZ3RCQUNBRVFRZHhJQUpCQUJCTElnTVFUQ0VGUVFFZ0F4Qk1JUVpCQWlBREVFd2hBeUFBSUFGQkFDQUZFRUVnQUNBQlFRRWdCaEJCSUFBZ0FVRUNJQU1RUVNBQUlBRWdBa0VISUFRUUVCQkdDMzhBSUFRZ0JSQklJQU5CQ0c5QkFYUnFJZ1JCQUJBL0lRVkJBQ0VESUFSQkFXcEJBQkEvSVFSQkJ5QUNRUWh2YXlJQ0lBUVFFQVJBUVFJaEF3c2dBaUFGRUJBRVFDQURRUUZxSVFNTElBQWdBVUVBSUFOQngvNERRUUFRVFNJQ0VFRWdBQ0FCUVFFZ0FoQkJJQUFnQVVFQ0lBSVFRU0FBSUFFZ0EwRUFFRVlMM0FFQkJuOGdBMEVEZFNFTEFrQURRQ0FFUWFBQlRnMEJJQVFnQldvaUJrR0FBazRFUUNBR1FZQUNheUVHQ3lBQ0lBdEJCWFJxSUFaQkEzVnFJZ2xCQUJBL0lRZEJBQ0VLSXl3RVFDQUVJQUFnQmlBRElBa2dBU0FIRUVjaUNFRUFTZ1JBSUFRZ0NFRUJhMm9oQkVFQklRb0xDeU1yQkg4Z0NrVUZJeXNMSWdnRVFDQUVJQUFnQmlBRElBa2dBU0FIRUZBaUNFRUFTZ1JBSUFRZ0NFRUJhMm9oQkFzRklBcEZCRUFqTHdSQUlBUWdBQ0FHSUFNZ0NTQUJJQWNRVVFVZ0JDQUFJQVlnQXlBQklBY1FVZ3NMQ3lBRVFRRnFJUVFNQUFBTEFBc0xMQUVDZnlOTUlRUWdBQ05OYWlJRFFZQUNUZ1JBSUFOQmdBSnJJUU1MSUFBZ0FTQUNJQU5CQUNBRUVGTUxNQUVEZnlOT0lRTWdBQ05QSWdSSUJFQVBDeUFEUVFkcklnTkJmMndoQlNBQUlBRWdBaUFBSUFScklBTWdCUkJUQzRZRkFSQi9Ba0JCSnlFSkEwQWdDVUVBU0EwQklBbEJBblFpQTBHQS9BTnFFQU1oQWlBRFFZSDhBMm9RQXlFTElBTkJndndEYWhBRElRUWdBa0VRYXlFQ0lBdEJDR3NoQzBFSUlRVWdBVUVCY1FSQVFSQWhCU0FFUVFKdlFRRkdCRUFnQkVFQmF5RUVDd3NnQUNBQ1RpSUdCRUFnQUNBQ0lBVnFTQ0VHQ3lBR0JFQkJCeUFEUVlQOEEyb1FBeUlHRUJBaERFRUdJQVlRRUNFRFFRVWdCaEFRSVE4Z0FDQUNheUVDSUFNRVFDQUNJQVZyUVg5c1FRRnJJUUlMUVlDQUFpQUVFRWdnQWtFQmRHb2hCRUVBSVFJakx3Ui9RUU1nQmhBUUJTTXZDeUlEQkVCQkFTRUNDeUFFSUFJUVB5RVFJQVJCQVdvZ0FoQS9JUkVDUUVFSElRVURRQ0FGUVFCSURRRWdCU0VDSUE4RVFDQUNRUWRyUVg5c0lRSUxRUUFoQ0NBQ0lCRVFFQVJBUVFJaENBc2dBaUFRRUJBRVFDQUlRUUZxSVFnTElBZ0VRQ0FMUVFjZ0JXdHFJZ2RCQUU0aUFnUkFJQWRCb0FGTUlRSUxJQUlFUUVFQUlRSkJBQ0VOUVFBaERpTXZCSDhqcXdGRkJTTXZDeUlFQkVCQkFTRUNDeUFDUlFSQUlBY2dBQkJESWdwQkEzRWhBeUFNQkg4Z0EwRUFTZ1VnREFzaUJBUkFRUUVoRFFVakx3Ui9RUUlnQ2hBUUJTTXZDeUlFQkVBZ0EwRUFTaUVFQ3lBRUJFQkJBU0VPQ3dzTElBSkZCRUFnRFVVaUF3Ui9JQTVGQlNBREN5RUNDeUFDQkVBakx3UkFRUUFnQmtFSGNTQUlRUUVRU3lJREVFd2hCRUVCSUFNUVRDRUNRUUlnQXhCTUlRTWdCeUFBUVFBZ0JCQkJJQWNnQUVFQklBSVFRU0FISUFCQkFpQURFRUVGUWNqK0F5RURRUVFnQmhBUUJFQkJ5ZjRESVFNTElBY2dBRUVBSUFnZ0EwRUFFRTBpQ2hCQklBY2dBRUVCSUFvUVFTQUhJQUJCQWlBS0VFRUxDd3NMSUFWQkFXc2hCUXdBQUFzQUN3c2dDVUVCYXlFSkRBQUFDd0FMQzIwQkFuOUJnSkFDSVFJanB3RUVRRUdBZ0FJaEFnc2pMd1IvSXk4Rkk2c0JDeUlCQkVCQmdMQUNJUUVqcUFFRVFFR0F1QUloQVFzZ0FDQUNJQUVRVkFzanBnRUVRRUdBc0FJaEFTT2xBUVJBUVlDNEFpRUJDeUFBSUFJZ0FSQlZDeU9xQVFSQUlBQWpxUUVRVmdzTEpRRUJmd0pBQTBBZ0FFR1FBVXNOQVNBQVFmOEJjUkJYSUFCQkFXb2hBQXdBQUFzQUN3dEtBUUovQWtBRFFDQUFRWkFCVGcwQkFrQkJBQ0VCQTBBZ0FVR2dBVTROQVNBQklBQVFRa0dBb0FScVFRQTZBQUFnQVVFQmFpRUJEQUFBQ3dBTElBQkJBV29oQUF3QUFBc0FDd3NNQUVGL0pMQUJRWDhrc1FFTERnQWpNd1JBUWZBRkR3dEIrQUlMRGdBak13UkFRZklERHd0QitRRUxHZ0VCZnlBQVFZLytBeEFERUVVaUFTUjNRWS8rQXlBQkVBWUxDZ0JCQVNSMFFRRVFYUXNPQUNNekJFQkJyZ0VQQzBIWEFBc1FBQ016QkVCQmdJQUJEd3RCZ01BQUN5NEJBWDhqakFGQkFFb2lBQVJBSTdZQklRQUxJQUFFUUNPTUFVRUJheVNNQVFzampBRkZCRUJCQUNTSkFRc0xMZ0VCZnlPV0FVRUFTaUlBQkVBanR3RWhBQXNnQUFSQUk1WUJRUUZySkpZQkN5T1dBVVVFUUVFQUpKTUJDd3N1QVFGL0k1d0JRUUJLSWdBRVFDTzRBU0VBQ3lBQUJFQWpuQUZCQVdza25BRUxJNXdCUlFSQVFRQWttZ0VMQ3k0QkFYOGpvUUZCQUVvaUFBUkFJN2tCSVFBTElBQUVRQ09oQVVFQmF5U2hBUXNqb1FGRkJFQkJBQ1NlQVFzTElnRUJmeU9TQVNPN0FYVWhBQ084QVFSL0k1SUJJQUJyQlNPU0FTQUFhZ3NpQUF0RkFRSi9RWlQrQXhBRFFmZ0JjU0VCUVpQK0F5QUFRZjhCY1NJQ0VBWkJsUDRESUFFZ0FFRUlkU0lBY2hBR0lBSWt2UUVnQUNTK0FTTytBVUVJZENPOUFYSWt2d0VMT1FFQ2Z4QmxJZ0JCL3c5TUlnRUVRQ083QVVFQVNpRUJDeUFCQkVBZ0FDU1NBU0FBRUdZUVpTRUFDeUFBUWY4UFNnUkFRUUFraVFFTEN5OEFJNUVCUVFGckpKRUJJNUVCUVFCTUJFQWp1Z0Vra1FFamtBRUVmeU82QVVFQVNnVWprQUVMQkVBUVp3c0xDMkFCQVg4aml3RkJBV3NraXdFaml3RkJBRXdFUUNQQUFTU0xBU09MQVFSQUk4RUJCSDhqalFGQkQwZ0ZJOEVCQ3lJQUJFQWpqUUZCQVdva2pRRUZJOEVCUlNJQUJFQWpqUUZCQUVvaEFBc2dBQVJBSTQwQlFRRnJKSTBCQ3dzTEN3dGdBUUYvSTVVQlFRRnJKSlVCSTVVQlFRQk1CRUFqd2dFa2xRRWpsUUVFUUNQREFRUi9JNWNCUVE5SUJTUERBUXNpQUFSQUk1Y0JRUUZxSkpjQkJTUERBVVVpQUFSQUk1Y0JRUUJLSVFBTElBQUVRQ09YQVVFQmF5U1hBUXNMQ3dzTFlBRUJmeU9nQVVFQmF5U2dBU09nQVVFQVRBUkFJOFFCSktBQkk2QUJCRUFqeFFFRWZ5T2lBVUVQU0FVanhRRUxJZ0FFUUNPaUFVRUJhaVNpQVFVanhRRkZJZ0FFUUNPaUFVRUFTaUVBQ3lBQUJFQWpvZ0ZCQVdza29nRUxDd3NMQzQwQkFRRi9JMXdnQUdva1hDTmNFR0JPQkVBalhCQmdheVJjQWtBQ1FBSkFBa0FDUUNOZUlnRUVRQUpBSUFGQkFtc09CZ0lBQXdBRUJRQUxEQVVMRUdFUVloQmpFR1FNQkFzUVlSQmlFR01RWkJCb0RBTUxFR0VRWWhCakVHUU1BZ3NRWVJCaUVHTVFaQkJvREFFTEVHa1FhaEJyQ3lOZVFRRnFKRjRqWGtFSVRnUkFRUUFrWGd0QkFROExRUUFMSFFBanhnRWdBR29reGdFamlnRWp4Z0ZyUVFCS0JFQkJBQThMUVFFTGd3RUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQWdBQ0lCUVFKR0RRRWdBVUVEUmcwQ0lBRkJCRVlOQXd3RUN5TmxJOGNCUndSQUk4Y0JKR1ZCQVE4TFFRQVBDeU5tSThnQlJ3UkFJOGdCSkdaQkFROExRUUFQQ3lObkk4a0JSd1JBSThrQkpHZEJBUThMUVFBUEN5Tm9JOG9CUndSQUk4b0JKR2hCQVE4TFFRQVBDMEVBQ3gwQUk4c0JJQUJxSk1zQkk1UUJJOHNCYTBFQVNnUkFRUUFQQzBFQkN5a0FJOHdCSUFCcUpNd0JJNXNCSTh3QmEwRUFTaUlBQkVBallFVWhBQXNnQUFSQVFRQVBDMEVCQ3gwQUk4MEJJQUJxSk0wQkk1OEJJODBCYTBFQVNnUkFRUUFQQzBFQkN4MEFRWUFRSTc4QmEwRUNkQ1NLQVNNekJFQWppZ0ZCQVhRa2lnRUxDMFVCQVg4Q1FBSkFBa0FnQUVFQlJ3UkFJQUFpQWtFQ1JnMEJJQUpCQTBZTkFnd0RDeUFCUVlFQkVCQVBDeUFCUVljQkVCQVBDeUFCUWY0QUVCQVBDeUFCUVFFUUVBdC9BUUYvSTRvQklBQnJKSW9CSTRvQlFRQk1CRUFqaWdFaEFCQnlJNG9CSUFCQkFDQUFheUFBUVFCS0cyc2tpZ0VqandGQkFXb2tqd0VqandGQkNFNEVRRUVBSkk4QkN3c2ppUUVFZnlQSEFRVWppUUVMSWdBRWZ5T05BUVZCRHc4TElRQkJBU0VCSTg0Qkk0OEJFSE5GQkVCQmZ5RUJDeUFCSUFCc1FROXFDeElCQVg4anhnRWhBRUVBSk1ZQklBQVFkQXNkQUVHQUVDUFBBV3RCQW5Ra2xBRWpNd1JBSTVRQlFRRjBKSlFCQ3d0L0FRRi9JNVFCSUFCckpKUUJJNVFCUVFCTUJFQWpsQUVoQUJCMkk1UUJJQUJCQUNBQWF5QUFRUUJLRzJza2xBRWptUUZCQVdva21RRWptUUZCQ0U0RVFFRUFKSmtCQ3dzamt3RUVmeVBJQVFVamt3RUxJZ0FFZnlPWEFRVkJEdzhMSVFCQkFTRUJJOUFCSTVrQkVITkZCRUJCZnlFQkN5QUJJQUJzUVE5cUN4SUJBWDhqeXdFaEFFRUFKTXNCSUFBUWR3c2RBRUdBRUNQUkFXdEJBWFFrbXdFak13UkFJNXNCUVFGMEpKc0JDd3NFQUNBQUM0Z0NBUUovSTVzQklBQnJKSnNCSTVzQlFRQk1CRUFqbXdFaEFoQjVJNXNCSUFKQkFDQUNheUFDUVFCS0cyc2ttd0VqblFGQkFXb2tuUUVqblFGQklFNEVRRUVBSkowQkN3dEJBQ0VDSTlJQklRQWptZ0VFZnlQSkFRVWptZ0VMSWdFRVFDTmdCRUJCblA0REVBTkJCWFZCRDNFaUFDVFNBVUVBSkdBTEJVRVBEd3NqblFGQkFtMFFla0d3L2dOcUVBTWhBU09kQVVFQ2J3Ui9JQUZCRDNFRklBRkJCSFZCRDNFTElRRUNRQUpBQWtBQ1FDQUFCRUFnQUVFQlJnMEJJQUJCQWtZTkFnd0RDeUFCUVFSMUlRRU1Bd3RCQVNFQ0RBSUxJQUZCQVhVaEFVRUNJUUlNQVFzZ0FVRUNkU0VCUVFRaEFnc2dBa0VBU2dSL0lBRWdBbTBGUVFBTElnRkJEMm9MRWdFQmZ5UE1BU0VBUVFBa3pBRWdBQkI3Q3hzQkFYOGowd0VqMUFGMElRQWpNd1JBSUFCQkFYUWhBQXNnQUF1dkFRRUJmeU9mQVNBQWF5U2ZBU09mQVVFQVRBUkFJNThCSVFBUWZTU2ZBU09mQVNBQVFRQWdBR3NnQUVFQVNodHJKSjhCSTZNQlFRRnhJUUVqb3dGQkFYVkJBWEVoQUNPakFVRUJkU1NqQVNPakFTQUJJQUJ6SWdGQkRuUnlKS01CSTlVQkJFQWpvd0ZCdjM5eEpLTUJJNk1CSUFGQkJuUnlKS01CQ3dzam5nRUVmeVBLQVFVam5nRUxJZ0FFZnlPaUFRVkJEdzhMSVFGQkFDT2pBUkFRQkg5QmZ3VkJBUXNpQUNBQmJFRVBhZ3NTQVFGL0k4MEJJUUJCQUNUTkFTQUFFSDRMRWdBak13UkFRWUNBZ0FRUEMwR0FnSUFDQ3dVQUVJQUJDem9BSUFCQlBFWUVRRUgvQUE4TElBQkJQR3RCb0kwR2JDQUJiRUVJYlJCNlFhQ05CbTBRZWtFOGFrR2dqUVpzUVl6eEFoQjZiUkI2RUhvTHVnRUJBWDlCQUNSckkxTUVmeUFBQlVFUEN5RUVJMVFFZnlBRUlBRnFCU0FFUVE5cUN5RUVJMVVFZnlBRUlBSnFCU0FFUVE5cUN5RUVJMVlFZnlBRUlBTnFCU0FFUVE5cUN5RUVJMWNFZnlBQUJVRVBDeUVBSTFnRWZ5QUFJQUZxQlNBQVFROXFDeUVBSTFrRWZ5QUFJQUpxQlNBQVFROXFDeUVBSTFvRWZ5QUFJQU5xQlNBQVFROXFDeUVBUVFBa2JFRUFKRzBnQkNOUlFRRnFFSUlCSVFFZ0FDTlNRUUZxRUlJQklRQWdBU1JwSUFBa2FpQUJJQUFRU2dzbEFRRi9JQUpCQVhSQmdQZ2phaUlESUFCQkFXbzZBQUFnQTBFQmFpQUJRUUZxT2dBQUM1b0NBUVIvSUFBUWJTSUJSUVJBUVFFUWJpRUJDeUFBRUc4aUFrVUVRRUVDRUc0aEFnc2dBQkJ3SWdORkJFQkJBeEJ1SVFNTElBQVFjU0lFUlFSQVFRUVFiaUVFQ3lBQlFRRnhCRUFRZFNSaEN5QUNRUUZ4QkVBUWVDUmlDeUFEUVFGeEJFQVFmQ1JqQ3lBRVFRRnhCRUFRZnlSa0N5QUJRUUZ4UlFSQUlBSWhBUXNnQVVFQmNVVUVRQ0FESVFFTElBRkJBWEZGQkVBZ0JDRUJDeUFCUVFGeEJFQkJBU1J0Q3lOZElBQWoxZ0ZzYWlSZEkxMFFnUUZPQkVBalhSQ0JBV3NrWFNOdEJIOGpiUVVqYXdzaUFVVUVRQ05zSVFFTElBRUVRQ05oSTJJall5TmtFSU1CR2dzamFVRUJhaU5xUVFGcUkxOFFoQUVqWDBFQmFpUmZJOWNCUVFKdEVIcEJBV3NoQVNOZklBRk9CRUFqWDBFQmF5UmZDd3NMREFBZ0FFR0EvZ054UVFoMUN3Z0FJQUJCL3dGeEM1TUJBUVIvSUFBUWRCQjZJUUVnQUJCM0VIb2hBaUFBRUhzUWVpRURJQUFRZmhCNklRUWdBU1JoSUFJa1lpQURKR01nQkNSa0kxMGdBQ1BXQVd4cUpGMGpYUkNCQVU0RVFDTmRFSUVCYXlSZElBRWdBaUFESUFRUWd3RWlBQkNHQVVFQmFpQUFFSWNCUVFGcUkxOFFoQUVqWDBFQmFpUmZJOWNCUVFKdEVIcEJBV3NoQUNOZklBQk9CRUFqWDBFQmF5UmZDd3NMSlFFQmZ5QUFFR3doQVNNcUJIOGdBVVVGSXlvTElnRUVRQ0FBRUlVQkJTQUFFSWdCQ3dza0FDTlFFRjlJQkVBUEN3TkFJMUFRWDA0RVFCQmZFSWtCSTFBUVgyc2tVQXdCQ3dzTGN3RUJmeUFBUWFiK0EwWUVRRUdtL2dNUUEwR0FBWEVoQVNPSkFRUi9RUUFnQVJCRkJVRUFJQUVRUkFzYUk1TUJCSDlCQVNBQkVFVUZRUUVnQVJCRUN4b2ptZ0VFZjBFQ0lBRVFSUVZCQWlBQkVFUUxHaU9lQVFSL1FRTWdBUkJGQlVFRElBRVFSQXNhSUFGQjhBQnlEd3RCZnd2RUFRRUJmeU9zQVNFQUk2MEJCRUFqMkFFRWYwRUNJQUFRUkFWQkFpQUFFRVVMSVFBajJRRUVmMEVBSUFBUVJBVkJBQ0FBRUVVTElRQWoyZ0VFZjBFRElBQVFSQVZCQXlBQUVFVUxJUUFqMndFRWYwRUJJQUFRUkFWQkFTQUFFRVVMSVFBRkk2NEJCRUFqM0FFRWYwRUFJQUFRUkFWQkFDQUFFRVVMSVFBajNRRUVmMEVCSUFBUVJBVkJBU0FBRUVVTElRQWozZ0VFZjBFQ0lBQVFSQVZCQWlBQUVFVUxJUUFqM3dFRWYwRURJQUFRUkFWQkF5QUFFRVVMSVFBTEN5QUFRZkFCY2d2VUFnRUJmeUFBUVlDQUFrZ0VRRUYvRHdzZ0FFR0FnQUpPSWdFRVFDQUFRWURBQWtnaEFRc2dBUVJBUVg4UEN5QUFRWURBQTA0aUFRUkFJQUJCZ1B3RFNDRUJDeUFCQkVBZ0FFR0FRR29RQXc4TElBQkJnUHdEVGlJQkJFQWdBRUdmL1FOTUlRRUxJQUVFUUNPR0FVRUNTQVJBUWY4QkR3dEJmdzhMSUFCQnpmNERSZ1JBUWY4QklRRkJBRUhOL2dNUUF4QVFSUVJBUVFCQi93RVFSQ0VCQ3lNelJRUkFRUWNnQVJCRUlRRUxJQUVQQ3lBQVFjVCtBMFlFUUNBQUkwc1FCaU5MRHdzZ0FFR1EvZ05PSWdFRVFDQUFRYWIrQTB3aEFRc2dBUVJBRUlvQklBQVFpd0VQQ3lBQVFiRCtBMDRpQVFSQUlBQkJ2LzREVENFQkN5QUJCRUFRaWdGQmZ3OExJQUJCaFA0RFJnUkFJQUFqZVJDR0FTSUJFQVlnQVE4TElBQkJoZjREUmdSQUlBQWplaEFHSTNvUEN5QUFRWS8rQTBZRVFDTjNRZUFCY2c4TElBQkJnUDREUmdSQUVJd0JEd3RCZndzY0FRRi9JQUFRalFFaUFVRi9SZ1JBSUFBUUF3OExJQUZCL3dGeEMrMENBUUovSTBVRVFBOExJQUJCL3o5TUJFQWpSd1IvUVFRZ0FVSC9BWEVRRUVVRkkwY0xJZ0JGQkVBZ0FVRVBjU0lDQkVBZ0FrRUtSZ1JBUVFFa1F3c0ZRUUFrUXdzTEJTQUFRZi8vQUV3RVFDTXVSU0lDUlFSQUlBQkIvOThBVENFQ0N5QUNCRUFqUndSQUlBRkJEM0VrTFFzZ0FTRUNJMFlFUUNBQ1FSOXhJUUlqTFVIZ0FYRWtMUVVqU0FSQUlBSkIvd0J4SVFJakxVR0FBWEVrTFFVakxnUkFRUUFrTFFzTEN5TXRJQUp5SkMwRlFRQWhBaU10RUljQklRTWdBVUVBU2dSQVFRRWhBZ3NnQWlBREVFb2tMUXNGSTBkRklnTUVRQ0FBUWYrL0FVd2hBd3NnQXdSQUkwWUVmeU5FQlNOR0N5SUFCRUFqTFVFZmNTUXRJeTBnQVVIZ0FYRnlKQzBQQ3lOSUJFQWdBVUVJVGlJREJFQWdBVUVNVENFREN3c2dBU0VESXk0RWZ5QURRUTl4QlNBRFFRTnhDeUlESkRFRkkwZEZJZ01FUUNBQVFmLy9BVXdoQXdzZ0F3UkFJMFlFUUVFQUlBRkIvd0Z4RUJBRVFFRUJKRVFGUVFBa1JBc0xDd3NMQ3dzZkFDQUFRZkFBY1VFRWRTUzZBVUVESUFBUUVDUzhBU0FBUVFkeEpMc0JDd3NBUVFjZ0FCQVFKTWtCQ3g4QUlBQkJCblZCQTNFa3pnRWdBRUUvY1NUZ0FVSEFBQ1BnQVdza2pBRUxId0FnQUVFR2RVRURjU1RRQVNBQVFUOXhKT0VCUWNBQUkrRUJheVNXQVFzUkFDQUFKT0lCUVlBQ0krSUJheVNjQVFzVUFDQUFRVDl4Sk9NQlFjQUFJK01CYXlTaEFRc3FBQ0FBUVFSMVFROXhKT1FCUVFNZ0FCQVFKTUVCSUFCQkIzRWt3QUVnQUVINEFYRkJBRW9reHdFTEtnQWdBRUVFZFVFUGNTVGxBVUVESUFBUUVDVERBU0FBUVFkeEpNSUJJQUJCK0FGeFFRQktKTWdCQ3cwQUlBQkJCWFZCRDNFazVnRUxLZ0FnQUVFRWRVRVBjU1RuQVVFRElBQVFFQ1RGQVNBQVFRZHhKTVFCSUFCQitBRnhRUUJLSk1vQkN4UUFJQUFrdlFFanZnRkJDSFFqdlFGeUpMOEJDeFFBSUFBazZBRWo2UUZCQ0hRajZBRnlKTThCQ3hRQUlBQWs2Z0VqNndGQkNIUWo2Z0Z5Sk5FQkM0UUJBUUYvSUFCQkJIVWsxQUZCQXlBQUVCQWsxUUVnQUVFSGNTVHNBUUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWo3QUVpQVFSQUFrQWdBVUVCYXc0SEFnTUVCUVlIQ0FBTERBZ0xRUWdrMHdFUEMwRVFKTk1CRHd0QklDVFRBUThMUVRBazB3RVBDMEhBQUNUVEFROExRZEFBSk5NQkR3dEI0QUFrMHdFUEMwSHdBQ1RUQVFzTElBQkJCaUFBRUJBa3RnRWdBRUVIY1NTK0FTTytBVUVJZENPOUFYSWt2d0VMYWdFQmYwRUJKSWtCSTR3QlJRUkFRY0FBSkl3QkN4QnlJOEFCSklzQkkrUUJKSTBCSTc4QkpKSUJJN29CSkpFQkk3b0JRUUJLSWdBRVFDTzdBVUVBU2lFQUN5QUFCRUJCQVNTUUFRVkJBQ1NRQVFzanV3RkJBRW9FUUJCbkN5UEhBVVVFUUVFQUpJa0JDd3NnQUVFR0lBQVFFQ1MzQVNBQVFRZHhKT2tCSStrQlFRaDBJK2dCY2lUUEFRc3VBRUVCSkpNQkk1WUJSUVJBUWNBQUpKWUJDeEIySThJQkpKVUJJK1VCSkpjQkk4Z0JSUVJBUVFBa2t3RUxDeUFBUVFZZ0FCQVFKTGdCSUFCQkIzRWs2d0VqNndGQkNIUWo2Z0Z5Sk5FQkN5Y0FRUUVrbWdFam5BRkZCRUJCZ0FJa25BRUxFSGxCQUNTZEFTUEpBVVVFUUVFQUpKb0JDd3NMQUVFR0lBQVFFQ1M1QVFzNEFFRUJKSjRCSTZFQlJRUkFRY0FBSktFQkN4QjlKSjhCSThRQkpLQUJJK2NCSktJQlFmLy9BU1NqQVNQS0FVVUVRRUVBSko0QkN3c1RBQ0FBUVFSMVFRZHhKRkVnQUVFSGNTUlNDMElBUVFjZ0FCQVFKRlpCQmlBQUVCQWtWVUVGSUFBUUVDUlVRUVFnQUJBUUpGTkJBeUFBRUJBa1drRUNJQUFRRUNSWlFRRWdBQkFRSkZoQkFDQUFFQkFrVndzS0FFRUhJQUFRRUNSYkM1UURBUUYvQWtBZ0FFR20vZ05ISWdJRVFDTmJSU0VDQ3lBQ0JFQkJBQThMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQWtHUS9nTkhCRUFDUUNBQ1FaSCtBMnNPRmdNSEN3OEFCQWdNRUFJRkNRMFJBQVlLRGhJVEZCVUFDd3dWQ3lBQkVKQUJEQlVMSUFFUWtRRU1GQXNnQVJDU0FRd1RDeUFCRUpNQkRCSUxJQUVRbEFFTUVRc2dBUkNWQVF3UUN5QUJFSllCREE4TElBRVFsd0VNRGd0QkFTUmdJQUVRbUFFTURRc2dBUkNaQVF3TUN5QUJFSm9CREFzTElBRVFtd0VNQ2dzZ0FSQ2NBUXdKQ3lBQkVKMEJEQWdMUVFjZ0FSQVFCRUFnQVJDZUFSQ2ZBUXNNQnd0QkJ5QUJFQkFFUUNBQkVLQUJFS0VCQ3d3R0MwRUhJQUVRRUFSQUlBRVFvZ0VRb3dFTERBVUxRUWNnQVJBUUJFQWdBUkNrQVJDbEFRc01CQXNnQVJDbUFVRUJKR3NNQXdzZ0FSQ25BVUVCSkd3TUFnc2dBUkNvQVVFSElBRVFFRVVFUUFKQVFaRCtBeUVDQTBBZ0FrR20vZ05PRFFFZ0FrRUFFQVlnQWtFQmFpRUNEQUFBQ3dBTEN3d0JDMEVCRHd0QkFRc2NBRUhCL2dOQkJ5QUFRZmdCY1VIQi9nTVFBMEVIY1hJUVJSQUdDejRCQVg4Z0FFRUlkQ0VCQWtCQkFDRUFBMEFnQUVHZkFVb05BU0FBUVlEOEEyb2dBU0FBYWhBREVBWWdBRUVCYWlFQURBQUFDd0FMUVlRRkpLOEJDeE1BSSs4QkVBTWo4QUVRQXhCS1FmRC9BM0VMRndBajhRRVFBeVB5QVJBREVFcEI4RDl4UVlDQUFtb0xpd0VCQTM4akwwVUVRQThMSTdJQkJIOUJCeUFBRUJCRkJTT3lBUXNpQVFSQVFRQWtzZ0VqN2dFUUF5RUJJKzRCUVFjZ0FSQkZFQVlQQ3hDc0FTRUJFSzBCSVFKQkJ5QUFFRVJCQVdwQkJIUWhBMEVISUFBUUVBUkFRUUVrc2dFZ0F5U3pBU0FCSkxRQklBSWt0UUVqN2dGQkJ5QUFFRVFRQmdVZ0FTQUNJQU1RdmdFajdnRkIvd0VRQmdzTEpnRUJmeUFBUVQ5eElRTWdBa0VCY1FSQUlBTkJRR3NoQXdzZ0EwR0FrQVJxSUFFNkFBQUxHQUJCQnlBQUVCQUVRQ0FCUVFjZ0FFRUJhaEJGRUFZTEMwb0JBbjhnQUNQMUFVWWlBa1VFUUNBQUkvUUJSaUVDQ3lBQ0JFQkJCaUFBUVFGckVBTVFSQ0VDSUFBajlBRkdCRUJCQVNFREN5QUNJQUVnQXhDdkFTQUNJQUJCQVdzUXNBRUxDd29BUVFFa2RVRUNFRjBMUEFFQmZ3SkFBa0FDUUFKQUlBQUVRQ0FBSWdGQkFVWU5BU0FCUVFKR0RRSWdBVUVEUmcwRERBUUxRUWtQQzBFRER3dEJCUThMUVFjUEMwRUFDeWNCQVg4amZSQ3pBU0lDSUFBUUVDSUFCRUFnQWlBQkVCQkZJUUFMSUFBRVFFRUJEd3RCQUFzYUFDTjZRUUZxSkhvamVrSC9BVW9FUUVFQkpINUJBQ1I2Q3d0bUFRSi9BMEFnQVNBQVNBUkFJM2toQWlBQlFRUnFJUUVqZVVFRWFpUjVJM2xCLy84RFNnUkFJM2xCZ0lBRWF5UjVDeU44QkVBamZnUkFJM3NrZWhDeUFVRUFKSDVCQVNSL0JTTi9CRUJCQUNSL0N3c2dBaU41RUxRQkJFQVF0UUVMQ3d3QkN3c0xDd0FqZUJDMkFVRUFKSGdMS1FBamVTRUFRUUFrZVVHRS9nTkJBQkFHSTN3RWZ5QUFJM2tRdEFFRkkzd0xJZ0FFUUJDMUFRc0xHZ0FqZkFSQUkzOEVRQThMSTM0RVFFRUFKSDRMQ3lBQUpIb0xHd0FnQUNSN0kzd0VmeU4vQlNOOEN3UkFJM3NrZWtFQUpIOExDMWdCQW44amZDRUJRUUlnQUJBUUpId2dBRUVEY1NFQ0lBRkZCRUFqZlJDekFTRUFJQUlRc3dFaEFTTjhCRUFnQUNONUVCQWhBQVVnQUNONUVCQWlBQVJBSUFFamVSQVFJUUFMQ3lBQUJFQVF0UUVMQ3lBQ0pIMEwwUVVCQVg4Q1FBSkFJQUJCemY0RFJnUkFRYzMrQXlBQlFRRnhFQVlNQWdzZ0FFR0FnQUpJQkVBZ0FDQUJFSThCREFJTElBQkJnSUFDVGlJQ0JFQWdBRUdBd0FKSUlRSUxJQUlOQUNBQVFZREFBMDRpQWdSQUlBQkJnUHdEU0NFQ0N5QUNCRUFnQUVHQVFHb2dBUkFHREFFTElBQkJnUHdEVGlJQ0JFQWdBRUdmL1FOTUlRSUxJQUlFUUNPR0FVRUNTQTBDREFFTElBQkJvUDBEVGlJQ0JFQWdBRUgvL1FOTUlRSUxJQUlOQVNBQVFaRCtBMDRpQWdSQUlBQkJwdjREVENFQ0N5QUNCRUFRaWdFZ0FDQUJFS2tCRHdzZ0FFR3cvZ05PSWdJRVFDQUFRYi8rQTB3aEFnc2dBZ1JBRUlvQkN5QUFRY0QrQTA0aUFnUkFJQUJCeS80RFRDRUNDeUFDQkVBZ0FFSEEvZ05HQkVBZ0FSQXJEQUlMSUFCQndmNERSZ1JBSUFFUXFnRU1Bd3NnQUVIRS9nTkdCRUJCQUNSTElBQkJBQkFHREFNTElBQkJ4ZjREUmdSQUlBRWs3UUVNQWdzZ0FFSEcvZ05HQkVBZ0FSQ3JBUXdDQ3dKQUFrQUNRQUpBSUFBaUFrSEQvZ05IQkVBQ1FDQUNRY0wrQTJzT0NnSUFBQUFBQUFBQUJBTUFDd3dFQ3lBQkpFd01CUXNnQVNSTkRBUUxJQUVrVGd3REN5QUJKRThNQWdzTUFRc2dBQ1B1QVVZRVFDQUJFSzRCREFJTElBQWpNa1lpQWtVRVFDQUFJekJHSVFJTElBSUVRQ095QVFSQUk3UUJRWUNBQVU0aUFnUkFJN1FCUWYvL0FVd2hBZ3NnQWtVRVFDTzBBVUdBb0FOT0lnSUVRQ08wQVVIL3Z3Tk1JUUlMQ3lBQ0RRTUxDeUFBSS9NQlRpSUNCRUFnQUNQMEFVd2hBZ3NnQWdSQUlBQWdBUkN4QVF3QkN5QUFRWVQrQTA0aUFnUkFJQUJCaC80RFRDRUNDeUFDQkVBUXR3RUNRQUpBQWtBQ1FDQUFJZ0pCaFA0RFJ3UkFBa0FnQWtHRi9nTnJEZ01DQXdRQUN3d0VDeUFCRUxnQkRBWUxJQUVRdVFFTUJBc2dBUkM2QVF3REN5QUJFTHNCREFJTERBRUxJQUJCZ1A0RFJnUkFJQUVRTGdzZ0FFR1AvZ05HQkVBZ0FSQVNEQUVMSUFCQi8vOERSZ1JBSUFFUUVRd0JDMEVCRHd0QkFROExRUUFMRWdBZ0FDQUJFTHdCQkVBZ0FDQUJFQVlMQzJnQkEzOENRQU5BSUFNZ0FrNE5BU0FBSUFOcUVJNEJJUVVnQVNBRGFpRUVBMEFnQkVIL3Z3SktCRUFnQkVHQVFHb2hCQXdCQ3dzZ0JDQUZFTDBCSUFOQkFXb2hBd3dBQUFzQUMwRWdJUU1qTXdSQVFjQUFJUU1MSTY4QklBTWdBa0VRYld4cUpLOEJDMjBCQVg4anNnRkZCRUFQQzBFUUlRQWpzd0ZCRUVnRVFDT3pBU0VBQ3lPMEFTTzFBU0FBRUw0Qkk3UUJJQUJxSkxRQkk3VUJJQUJxSkxVQkk3TUJJQUJySkxNQkk3TUJRUUJNQkVCQkFDU3lBU1B1QVVIL0FSQUdCU1B1QVVFSEk3TUJRUkJ0UVFGckVFUVFCZ3NMQ2dCQkFTUnpRUUFRWFF2VEFnRUZmeU9rQVVVRVFFRUFKRXBCQUNSTFFjVCtBMEVBRUFaQkFFRUJRY0grQXhBREVFUVFSQ0VEUVFBa2hnRkJ3ZjRESUFNUUJnOExJNFlCSVFFalN5SURRWkFCVGdSQVFRRWhBZ1VqU2hCYlRnUkFRUUloQWdValNoQmNUZ1JBUVFNaEFnc0xDeUFCSUFKSEJFQkJ3ZjRERUFNaEFDQUNKSVlCUVFBaEFRSkFBa0FDUUFKQUFrQWdBaUVFSUFKRkRRQUNRQ0FFUVFGckRnTUNBd1FBQ3d3RUMwRURRUUZCQUNBQUVFUVFSQ0lBRUJBaEFRd0RDMEVFUVFCQkFTQUFFRVFRUlNJQUVCQWhBUXdDQzBFRlFRRkJBQ0FBRUVRUVJTSUFFQkFoQVF3QkMwRUJRUUFnQUJCRkVFVWhBQXNnQVFSQUVGNExJQUpGQkVBUXZ3RUxJQUpCQVVZRVFCREFBUXNqN1FFaEJDQUNSU0lCUlFSQUlBSkJBVVloQVFzZ0FRUkFJQU1nQkVZaEFRc2dBUVJBUVFaQkFpQUFFRVVpQUJBUUJFQVFYZ3NGUVFJZ0FCQkVJUUFMUWNIK0F5QUFFQVlMQzJ3QkFYOGpwQUVFUUNOS0lBQnFKRW9EUUNOS0VEMU9CRUFqU2hBOWF5UktJMHNpQVVHUUFVWUVRQ01wQkVBUVdBVWdBUkJYQ3hCWkVGb0ZJQUZCa0FGSUJFQWpLVVVFUUNBQkVGY0xDd3NnQVVHWkFVb0VmMEVBQlNBQlFRRnFDeUlCSkVzTUFRc0xDeERCQVFza0FDTkpFRDVJQkVBUEN3TkFJMGtRUGs0RVFCQStFTUlCSTBrUVBtc2tTUXdCQ3dzTEtBQWpnZ0VnQUdva2dnRWpnZ0VqZ0FGT0JFQWpnUUZCQVdva2dRRWpnZ0VqZ0FGckpJSUJDd3RtQUNPdkFVRUFTZ1JBSUFBanJ3RnFJUUJCQUNTdkFRc2pQaUFBYWlRK0kwSkZCRUFqSndSQUkwa2dBR29rU1JEREFRVWdBQkRDQVFzakpnUkFJMUFnQUdva1VBVWdBQkNKQVFzTEl5Z0VRQ040SUFCcUpIZ1F0d0VGSUFBUXRnRUxJQUFReEFFTEVBQkJCQkRGQVNNOVFRRnFFRHdRQXdzTEFFRUVFTVVCSXowUUF3c1NBQkRHQVVIL0FYRVF4d0ZCL3dGeEVFb0xEZ0JCQkJERkFTQUFJQUVRdlFFTEx3RUJmMEVCSUFCMEVJY0JJUUlnQVVFQVNnUkFJenNnQW5KQi93RnhKRHNGSXpzZ0FrSC9BWE54SkRzTEl6c0xDZ0JCQlNBQUVNb0JHZ3RPQUNBQlFRQk9CRUFnQUVFUGNTQUJRUTl4YWhDSEFVRVFjUVJBUVFFUXl3RUZRUUFReXdFTEJTQUJRUUFnQVdzZ0FVRUFTaHRCRDNFZ0FFRVBjVXNFUUVFQkVNc0JCVUVBRU1zQkN3c0xDZ0JCQnlBQUVNb0JHZ3NLQUVFR0lBQVF5Z0VhQ3dvQVFRUWdBQkRLQVJvTEZBQWdBRUVCZENBQVFmOEJjVUVIZG5JUWh3RUxOd0VDZnlBQkVJWUJJUUlnQUVFQmFpRURJQUFnQVJDSEFTSUJFTHdCQkVBZ0FDQUJFQVlMSUFNZ0FoQzhBUVJBSUFNZ0FoQUdDd3NPQUVFSUVNVUJJQUFnQVJEUkFRdURBUUFnQWtFQmNRUkFJQUJCLy84RGNTSUFJQUZxSVFJZ0FDQUJjeUFDY3lJQ1FSQnhCRUJCQVJETEFRVkJBQkRMQVFzZ0FrR0FBbkVFUUVFQkVNOEJCVUVBRU04QkN3VWdBQ0FCYWhBOElnSWdBRUgvL3dOeFNRUkFRUUVRendFRlFRQVF6d0VMSUFBZ0FYTWdBbk5CZ0NCeEVEd0VRRUVCRU1zQkJVRUFFTXNCQ3dzTERBQkJCQkRGQVNBQUVJNEJDeFFBSUFCQi93RnhRUUYySUFCQkIzUnlFSWNCQzlNRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQUVRQUpBSUFCQkFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMREJRTEVNZ0JRZi8vQTNFaUFCQ0dBVUgvQVhFa05TQUFFSWNCUWY4QmNTUTJEQkFMSXpVak5oQktJelFReVFFTUVnc2pOU00yRUVwQkFXcEIvLzhEY1NJQUVJWUJRZjhCY1NRMURBMExJelZCQVJETUFTTTFRUUZxRUljQkpEVWpOUVJBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0VNRUFzak5VRi9FTXdCSXpWQkFXc1Fod0VrTlNNMUJFQkJBQkROQVFWQkFSRE5BUXRCQVJET0FRd1BDeERIQVVIL0FYRWtOUXdNQ3lNMFFZQUJjVUdBQVVZRVFFRUJFTThCQlVFQUVNOEJDeU0wRU5BQkpEUU1EQXNReUFGQi8vOERjU004RU5JQkRBa0xJemtqT2hCS0lnQWpOU00yRUVvaUFVSC8vd054UVFBUTB3RWdBQ0FCYWhBOElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPa0VBRU00QlFRZ1BDeU0xSXpZUVNoRFVBVUgvQVhFa05Bd0tDeU0xSXpZUVNrRUJheEE4SWdBUWhnRkIvd0Z4SkRVTUJRc2pOa0VCRU13Qkl6WkJBV29RaHdFa05pTTJCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXdJQ3lNMlFYOFF6QUVqTmtFQmF4Q0hBU1EySXpZRVFFRUFFTTBCQlVFQkVNMEJDMEVCRU00QkRBY0xFTWNCUWY4QmNTUTJEQVFMSXpSQkFYRkJBRXNFUUVFQkVNOEJCVUVBRU04QkN5TTBFTlVCSkRRTUJBdEJmdzhMSUFBUWh3RkIvd0Z4SkRaQkNBOExJejFCQW1vUVBDUTlEQUlMSXoxQkFXb1FQQ1E5REFFTFFRQVF6UUZCQUJET0FVRUFFTXNCQzBFRUN3b0FJenRCQkhaQkFYRUxEZ0FnQUVFQmRCRFhBWElRaHdFTEtBRUJmMEVISUFCQkdIUkJHSFVpQVJBUUJFQkJnQUlnQUVFWWRFRVlkV3RCZjJ3aEFRc2dBUXNqQVFGL0lBQVEyUUVoQVNNOUlBRkJHSFJCR0hWcUVEd2tQU005UVFGcUVEd2tQUXNWQUNBQVFmOEJjVUVCZGhEWEFVRUhkSElRaHdFTHBRVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJFRWNFUUFKQUlBQkJFV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl5OEVRRUVBUWMzK0F4RFVBVUgvQVhFaUFCQVFCRUJCemY0RFFRZEJBQ0FBRUVRaUFCQVFCSDlCQUNRelFRY2dBQkJFQlVFQkpETkJCeUFBRUVVTElnQVF5UUZCeEFBUEN3dEJBU1JDREJFTEVNZ0JRZi8vQTNFaUFCQ0dBVUgvQVhFa055QUFFSWNCUWY4QmNTUTRJejFCQW1vUVBDUTlEQklMSXpjak9CQktJelFReVFFTUVRc2pOeU00RUVwQkFXb1FQQ0lBRUlZQlFmOEJjU1EzREEwTEl6ZEJBUkRNQVNNM1FRRnFFSWNCSkRjak53UkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRU1Ed3NqTjBGL0VNd0JJemRCQVdzUWh3RWtOeU0zQkVCQkFCRE5BUVZCQVJETkFRdEJBUkRPQVF3T0N4REhBVUgvQVhFa053d0xDMEVBSVFBak5FR0FBWEZCZ0FGR0JFQkJBU0VBQ3lNMEVOZ0JKRFFNQ3dzUXh3RVEyZ0ZCQ0E4TEl6a2pPaEJLSWdBak55TTRFRW9pQVVILy93TnhRUUFRMHdFZ0FDQUJhaEE4SWdBUWhnRkIvd0Z4SkRrZ0FCQ0hBVUgvQVhFa09rRUFFTTRCUVFnUEN5TTNJemdRU2tILy93TnhFTlFCUWY4QmNTUTBEQWtMSXpjak9CQktRUUZyRUR3aUFCQ0dBVUgvQVhFa053d0ZDeU00UVFFUXpBRWpPRUVCYWhDSEFTUTRJemdFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCREFjTEl6aEJmeERNQVNNNFFRRnJFSWNCSkRnak9BUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRU1CZ3NReHdGQi93RnhKRGdNQXd0QkFDRUFJelJCQVhGQkFVWUVRRUVCSVFBTEl6UVEyd0VrTkF3REMwRi9Ed3NnQUJDSEFVSC9BWEVrT0VFSUR3c2pQVUVCYWhBOEpEME1BUXNnQUFSQVFRRVF6d0VGUVFBUXp3RUxRUUFRelFGQkFCRE9BVUVBRU1zQkMwRUVDd29BSXp0QkIzWkJBWEVMQ2dBak8wRUZka0VCY1FzS0FDTTdRUVoyUVFGeEM0Z0dBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQklFY0VRQUpBSUFCQklXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMRU4wQkJFQWpQVUVCYWhBOEpEMEZFTWNCRU5vQkMwRUlEd3NReUFGQi8vOERjU0lBRUlZQlFmOEJjU1E1SUFBUWh3RkIvd0Z4SkRvalBVRUNhaEE4SkQwTUVBc2pPU002RUVvaUFFSC8vd054SXpRUXlRRWdBRUVCYWhBOElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPZ3dQQ3lNNUl6b1FTa0VCYWhBOElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPa0VJRHdzak9VRUJFTXdCSXpsQkFXb1Fod0VrT1NNNUJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FRd05DeU01UVg4UXpBRWpPVUVCYXhDSEFTUTVJemtFUUVFQUVNMEJCVUVCRU0wQkMwRUJFTTRCREF3TEVNY0JRZjhCY1NRNURBb0xFTjRCUVFCTEJFQkJCaUVCQ3hEWEFVRUFTd1JBSUFGQjRBQnlJUUVMRU44QlFRQkxCSDhqTkNBQmF4Q0hBUVVqTkVFUGNVRUpTd1JBSUFGQkJuSWhBUXNqTkVHWkFVc0VRQ0FCUWVBQWNpRUJDeU0wSUFGcUVJY0JDeUlBQkVCQkFCRE5BUVZCQVJETkFRc2dBVUhnQUhFRVFFRUJFTThCQlVFQUVNOEJDMEVBRU1zQklBQWtOQXdLQ3hEZEFVRUFTd1JBRU1jQkVOb0JCU005UVFGcUVEd2tQUXRCQ0E4TEl6a2pPaEJLSWdFZ0FVSC8vd054UVFBUTB3RWdBVUVCZEJBOElnRVFoZ0ZCL3dGeEpEa2dBUkNIQVVIL0FYRWtPa0VBRU00QlFRZ1BDeU01SXpvUVNpSUJRZi8vQTNFUTFBRkIvd0Z4SkRRZ0FVRUJhaEE4SWdFUWhnRkIvd0Z4SkRrZ0FSQ0hBVUgvQVhFa09nd0hDeU01SXpvUVNrRUJheEE4SWdFUWhnRkIvd0Z4SkRrZ0FSQ0hBVUgvQVhFa09rRUlEd3NqT2tFQkVNd0JJenBCQVdvUWh3RWtPaU02QkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVF3RkN5TTZRWDhRekFFak9rRUJheENIQVNRNkl6b0VRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJEQVFMRU1jQlFmOEJjU1E2REFJTEl6UkJmM05CL3dGeEpEUkJBUkRPQVVFQkVNc0JEQUlMUVg4UEN5TTlRUUZxRUR3a1BRdEJCQXZ3QkFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFd1J3UkFBa0FnQUVFeGF3NFBBZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNRMXdFRVFDTTlRUUZxRUR3a1BRVVF4d0VRMmdFTFFRZ1BDeERJQVVILy93TnhKRHdqUFVFQ2FoQThKRDBNRWdzak9TTTZFRW9pQUVILy93TnhJelFReVFFTUR3c2pQRUVCYWhBOEpEeEJDQThMSXprak9oQktJZ0JCLy84RGNSRFVBU0lCUVFFUXpBRWdBVUVCYWhDSEFTSUJCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXdPQ3lNNUl6b1FTaUlBUWYvL0EzRVExQUVpQVVGL0VNd0JJQUZCQVdzUWh3RWlBUVJBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VNRFFzak9TTTZFRXBCLy84RGNSREhBVUgvQVhFUXlRRU1DZ3RCQUJET0FVRUFFTXNCUVFFUXp3RU1EQXNRMXdGQkFVWUVRQkRIQVJEYUFRVWpQVUVCYWhBOEpEMExRUWdQQ3lNNUl6b1FTaUlCSXp4QkFCRFRBU0FCSXp4cUVEd2lBQkNHQVVIL0FYRWtPU0FBRUljQlFmOEJjU1E2UVFBUXpnRkJDQThMSXprak9oQktJZ0JCLy84RGNSRFVBVUgvQVhFa05Bd0hDeU04UVFGckVEd2tQRUVJRHdzak5FRUJFTXdCSXpSQkFXb1Fod0VrTkNNMEJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FRd0hDeU0wUVg4UXpBRWpORUVCYXhDSEFTUTBJelFFUUVFQUVNMEJCVUVCRU0wQkMwRUJFTTRCREFZTEVNY0JRZjhCY1NRMERBSUxRUUFRemdGQkFCRExBUkRYQVVFQVN3UkFRUUFRendFRlFRRVF6d0VMREFRTFFYOFBDeU05UVFGcUVEd2tQUXdDQ3lBQVFRRnJFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNkRBRUxJQUJCLy84RGNTQUJFTWtCQzBFRUM5a0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWNBQVJ3UkFJQUFpQVVIQkFFWU5BUUpBSUFGQndnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMREJBTEl6WWtOUXdQQ3lNM0pEVU1EZ3NqT0NRMURBMExJemtrTlF3TUN5TTZKRFVNQ3dzak9TTTZFRW9RMUFGQi93RnhKRFVNQ2dzak5DUTFEQWtMSXpVa05nd0lDd3dIQ3lNM0pEWU1CZ3NqT0NRMkRBVUxJemtrTmd3RUN5TTZKRFlNQXdzak9TTTZFRW9RMUFGQi93RnhKRFlNQWdzak5DUTJEQUVMUVg4UEMwRUVDOWtCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFSd1JBSUFBaUFVSFJBRVlOQVFKQUlBRkIwZ0JyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl6VWtOd3dRQ3lNMkpEY01Ed3NNRGdzak9DUTNEQTBMSXpra053d01DeU02SkRjTUN3c2pPU002RUVvUTFBRkIvd0Z4SkRjTUNnc2pOQ1EzREFrTEl6VWtPQXdJQ3lNMkpEZ01Cd3NqTnlRNERBWUxEQVVMSXpra09Bd0VDeU02SkRnTUF3c2pPU002RUVvUTFBRkIvd0Z4SkRnTUFnc2pOQ1E0REFFTFFYOFBDMEVFQzlrQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFBUndSQUlBQWlBVUhoQUVZTkFRSkFJQUZCNGdCckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVrT1F3UUN5TTJKRGtNRHdzak55UTVEQTRMSXpna09Rd05Dd3dNQ3lNNkpEa01Dd3NqT1NNNkVFb1ExQUZCL3dGeEpEa01DZ3NqTkNRNURBa0xJelVrT2d3SUN5TTJKRG9NQndzak55UTZEQVlMSXpna09nd0ZDeU01SkRvTUJBc01Bd3NqT1NNNkVFb1ExQUZCL3dGeEpEb01BZ3NqTkNRNkRBRUxRWDhQQzBFRUN5SUFJNGNCQkVCQkFTUS9Ed3NqY2lOM2NVRWZjVVVFUUVFQkpFQVBDMEVCSkVFTGlRSUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCSEJFQWdBQ0lCUWZFQVJnMEJBa0FnQVVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqT1NNNkVFb2pOUkRKQVF3UUN5TTVJem9RU2lNMkVNa0JEQThMSXprak9oQktJemNReVFFTURnc2pPU002RUVvak9CREpBUXdOQ3lNNUl6b1FTaU01RU1rQkRBd0xJemtqT2hCS0l6b1F5UUVNQ3dzanNnRkZCRUFRNVFFTERBb0xJemtqT2hCS0l6UVF5UUVNQ1Fzak5TUTBEQWdMSXpZa05Bd0hDeU0zSkRRTUJnc2pPQ1EwREFVTEl6a2tOQXdFQ3lNNkpEUU1Bd3NqT1NNNkVFb1ExQUZCL3dGeEpEUU1BZ3NNQVF0QmZ3OExRUVFMU2dBZ0FVRUFUZ1JBSUFCQi93RnhJQUFnQVdvUWh3RkxCRUJCQVJEUEFRVkJBQkRQQVFzRklBRkJBQ0FCYXlBQlFRQktHeUFBUWY4QmNVb0VRRUVCRU04QkJVRUFFTThCQ3dzTE53RUJmeU0wSUFCQi93RnhJZ0VRekFFak5DQUJFT2NCSXpRZ0FHb1Fod0VrTkNNMEJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FRdHJBUUYvSXpRZ0FHb1Exd0ZxRUljQklRRWpOQ0FBY3lBQmN4Q0hBVUVRY1FSQVFRRVF5d0VGUVFBUXl3RUxJelFnQUVIL0FYRnFFTmNCYWhBOFFZQUNjVUVBU3dSQVFRRVF6d0VGUVFBUXp3RUxJQUVrTkNNMEJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FRdmlBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFZQUJSd1JBQWtBZ0FVR0JBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl6VVE2QUVNRUFzak5oRG9BUXdQQ3lNM0VPZ0JEQTRMSXpnUTZBRU1EUXNqT1JEb0FRd01DeU02RU9nQkRBc0xJemtqT2hCS0VOUUJFT2dCREFvTEl6UVE2QUVNQ1Fzak5SRHBBUXdJQ3lNMkVPa0JEQWNMSXpjUTZRRU1CZ3NqT0JEcEFRd0ZDeU01RU9rQkRBUUxJem9RNlFFTUF3c2pPU002RUVvUTFBRVE2UUVNQWdzak5CRHBBUXdCQzBGL0R3dEJCQXM2QVFGL0l6UWdBRUgvQVhGQmYyd2lBUkRNQVNNMElBRVE1d0VqTkNBQWF4Q0hBU1EwSXpRRVFFRUFFTTBCQlVFQkVNMEJDMEVCRU00QkMyc0JBWDhqTkNBQWF4RFhBV3NRaHdFaEFTTTBJQUJ6SUFGelFSQnhFSWNCQkVCQkFSRExBUVZCQUJETEFRc2pOQ0FBUWY4QmNXc1Exd0ZyRUR4QmdBSnhRUUJMQkVCQkFSRFBBUVZCQUJEUEFRc2dBU1EwSXpRRVFFRUFFTTBCQlVFQkVNMEJDMEVCRU00QkMrSUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQmtBRkhCRUFDUUNBQlFaRUJhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak5SRHJBUXdRQ3lNMkVPc0JEQThMSXpjUTZ3RU1EZ3NqT0JEckFRd05DeU01RU9zQkRBd0xJem9RNndFTUN3c2pPU002RUVvUTFBRVE2d0VNQ2dzak5CRHJBUXdKQ3lNMUVPd0JEQWdMSXpZUTdBRU1Cd3NqTnhEc0FRd0dDeU00RU93QkRBVUxJemtRN0FFTUJBc2pPaERzQVF3REN5TTVJem9RU2hEVUFSRHNBUXdDQ3lNMEVPd0JEQUVMUVg4UEMwRUVDeWdBSXpRZ0FIRWtOQ00wQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVVFQkVNc0JRUUFRendFTEt3QWpOQ0FBY3hDSEFTUTBJelFFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCUVFBUXl3RkJBQkRQQVF2aUFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWFBQlJ3UkFBa0FnQVVHaEFXc09Ed0lEQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXpVUTdnRU1FQXNqTmhEdUFRd1BDeU0zRU80QkRBNExJemdRN2dFTURRc2pPUkR1QVF3TUN5TTZFTzRCREFzTEl6a2pPaEJLRU5RQkVPNEJEQW9MSXpRUTdnRU1DUXNqTlJEdkFRd0lDeU0yRU84QkRBY0xJemNRN3dFTUJnc2pPQkR2QVF3RkN5TTVFTzhCREFRTEl6b1E3d0VNQXdzak9TTTZFRW9RMUFFUTd3RU1BZ3NqTkJEdkFRd0JDMEYvRHd0QkJBc3NBQ00wSUFCeVFmOEJjU1EwSXpRRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0ZCQUJEUEFRc3pBUUYvSXpRZ0FFSC9BWEZCZjJ3aUFSRE1BU00wSUFFUTV3RWpOQ0FCYWdSQVFRQVF6UUVGUVFFUXpRRUxRUUVRemdFTDRnRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHd0FVY0VRQUpBSUFGQnNRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lNMUVQRUJEQkFMSXpZUThRRU1Ed3NqTnhEeEFRd09DeU00RVBFQkRBMExJemtROFFFTURBc2pPaER4QVF3TEN5TTVJem9RU2hEVUFSRHhBUXdLQ3lNMEVQRUJEQWtMSXpVUThnRU1DQXNqTmhEeUFRd0hDeU0zRVBJQkRBWUxJemdROGdFTUJRc2pPUkR5QVF3RUN5TTZFUElCREFNTEl6a2pPaEJLRU5RQkVQSUJEQUlMSXpRUThnRU1BUXRCZnc4TFFRUUxRZ0VDZndKQUFrQWdBQkNOQVNJQlFYOUhCRUFNQWdzZ0FCQURJUUVMQ3dKQUFrQWdBRUVCYWlJQ0VJMEJJZ0JCZjBjTkFTQUNFQU1oQUFzTElBQWdBUkJLQ3d3QVFRZ1F4UUVnQUJEMEFRczdBQ0FBUVlBQmNVR0FBVVlFUUVFQkVNOEJCVUVBRU04QkN5QUFFTkFCSWdBRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0VnQUFzNUFDQUFRUUZ4UVFCTEJFQkJBUkRQQVFWQkFCRFBBUXNnQUJEVkFTSUFCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVBRU1zQklBQUxTQUVCZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFBUTJBRWhBQ0FCQkVCQkFSRFBBUVZCQUJEUEFRc2dBQVJBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0ZCQUJETEFTQUFDMFlCQVg4Z0FFRUJjVUVCUmdSQVFRRWhBUXNnQUJEYkFTRUFJQUVFUUVFQkVNOEJCVUVBRU04QkN5QUFCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVBRU1zQklBQUxTd0VCZnlBQVFZQUJjVUdBQVVZRVFFRUJJUUVMSUFCQkFYUVFod0VoQUNBQkJFQkJBUkRQQVFWQkFCRFBBUXNnQUFSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdGQkFCRExBU0FBQzJzQkFuOGdBRUdBQVhGQmdBRkdCRUJCQVNFQkN5QUFRUUZ4UVFGR0JFQkJBU0VDQ3lBQVFmOEJjVUVCZGhDSEFTRUFJQUVFUUNBQVFZQUJjaUVBQ3lBQUJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FVRUFFTXNCSUFJRVFFRUJFTThCQlVFQUVNOEJDeUFBQ3pnQUlBQkJEM0ZCQkhRZ0FFSHdBWEZCQkhaeUVJY0JJZ0FFUUVFQUVNMEJCVUVCRU0wQkMwRUFFTTRCUVFBUXl3RkJBQkRQQVNBQUMwc0JBWDhnQUVFQmNVRUJSZ1JBUVFFaEFRc2dBRUgvQVhGQkFYWVFod0VpQUFSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdGQkFCRExBU0FCQkVCQkFSRFBBUVZCQUJEUEFRc2dBQXNvQUNBQlFRRWdBSFJ4UWY4QmNRUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBUkRMQVNBQkN5QUFJQUZCQUVvRWZ5QUNRUUVnQUhSeUJTQUNRUUVnQUhSQmYzTnhDeUlDQzlzSUFRZC9RWDhoQmdKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFRaHZJZ2NoQlNBSFJRMEFBa0FnQlVFQmF3NEhBZ01FQlFZSENBQUxEQWdMSXpVaEFRd0hDeU0ySVFFTUJnc2pOeUVCREFVTEl6Z2hBUXdFQ3lNNUlRRU1Bd3NqT2lFQkRBSUxJemtqT2hCS0VOUUJJUUVNQVFzak5DRUJDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVhGQkJIVWlCU0VFSUFWRkRRQUNRQ0FFUVFGckRnOENBd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeUFBUVFkTUJFQWdBUkQyQVNFQ1FRRWhBd1VnQUVFUFRBUkFJQUVROXdFaEFrRUJJUU1MQ3d3UEN5QUFRUmRNQkVBZ0FSRDRBU0VDUVFFaEF3VWdBRUVmVEFSQUlBRVErUUVoQWtFQklRTUxDd3dPQ3lBQVFTZE1CRUFnQVJENkFTRUNRUUVoQXdVZ0FFRXZUQVJBSUFFUSt3RWhBa0VCSVFNTEN3d05DeUFBUVRkTUJFQWdBUkQ4QVNFQ1FRRWhBd1VnQUVFL1RBUkFJQUVRL1FFaEFrRUJJUU1MQ3d3TUN5QUFRY2NBVEFSQVFRQWdBUkQrQVNFQ1FRRWhBd1VnQUVIUEFFd0VRRUVCSUFFUS9nRWhBa0VCSVFNTEN3d0xDeUFBUWRjQVRBUkFRUUlnQVJEK0FTRUNRUUVoQXdVZ0FFSGZBRXdFUUVFRElBRVEvZ0VoQWtFQklRTUxDd3dLQ3lBQVFlY0FUQVJBUVFRZ0FSRCtBU0VDUVFFaEF3VWdBRUh2QUV3RVFFRUZJQUVRL2dFaEFrRUJJUU1MQ3d3SkN5QUFRZmNBVEFSQVFRWWdBUkQrQVNFQ1FRRWhBd1VnQUVIL0FFd0VRRUVISUFFUS9nRWhBa0VCSVFNTEN3d0lDeUFBUVljQlRBUkFRUUJCQUNBQkVQOEJJUUpCQVNFREJTQUFRWThCVEFSQVFRRkJBQ0FCRVA4QklRSkJBU0VEQ3dzTUJ3c2dBRUdYQVV3RVFFRUNRUUFnQVJEL0FTRUNRUUVoQXdVZ0FFR2ZBVXdFUUVFRFFRQWdBUkQvQVNFQ1FRRWhBd3NMREFZTElBQkJwd0ZNQkVCQkJFRUFJQUVRL3dFaEFrRUJJUU1GSUFCQnJ3Rk1CRUJCQlVFQUlBRVEvd0VoQWtFQklRTUxDd3dGQ3lBQVFiY0JUQVJBUVFaQkFDQUJFUDhCSVFKQkFTRURCU0FBUWI4QlRBUkFRUWRCQUNBQkVQOEJJUUpCQVNFREN3c01CQXNnQUVISEFVd0VRRUVBUVFFZ0FSRC9BU0VDUVFFaEF3VWdBRUhQQVV3RVFFRUJRUUVnQVJEL0FTRUNRUUVoQXdzTERBTUxJQUJCMXdGTUJFQkJBa0VCSUFFUS93RWhBa0VCSVFNRklBQkIzd0ZNQkVCQkEwRUJJQUVRL3dFaEFrRUJJUU1MQ3d3Q0N5QUFRZWNCVEFSQVFRUkJBU0FCRVA4QklRSkJBU0VEQlNBQVFlOEJUQVJBUVFWQkFTQUJFUDhCSVFKQkFTRURDd3NNQVFzZ0FFSDNBVXdFUUVFR1FRRWdBUkQvQVNFQ1FRRWhBd1VnQUVIL0FVd0VRRUVIUVFFZ0FSRC9BU0VDUVFFaEF3c0xDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdCeUlFQkVBQ1FDQUVRUUZyRGdjQ0F3UUZCZ2NJQUFzTUNBc2dBaVExREFjTElBSWtOZ3dHQ3lBQ0pEY01CUXNnQWlRNERBUUxJQUlrT1F3REN5QUNKRG9NQWdzZ0JVRUVTQ0lFUlFSQUlBVkJCMG9oQkFzZ0JBUkFJemtqT2hCS0lBSVF5UUVMREFFTElBSWtOQXNnQXdSQVFRUWhCZ3NnQmd2VUF3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVIQUFVY0VRQUpBSUFGQndRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3hEZEFRMFNEQlFMSXp3UTlRRkIvLzhEY1NFQkl6eEJBbW9RUENROElBRVFoZ0ZCL3dGeEpEVWdBUkNIQVVIL0FYRWtOa0VFRHdzUTNRRUVRQXdTQlF3UUN3QUxEQTRMRU4wQkJFQU1FQVVNRFFzQUN5TThRUUpyRUR3a1BDTThJelVqTmhCS0VOSUJEQTBMRU1jQkVPZ0JEQThMSXp4QkFtc1FQQ1E4SXp3alBSRFNBVUVBSkQwTUN3c1EzUUZCQVVjTkNnd01DeU04RVBVQlFmLy9BM0VrUFNNOFFRSnFFRHdrUEF3SkN4RGRBVUVCUmdSQURBZ0ZEQW9MQUFzUXh3RkIvd0Z4RUlBQ0lRRWpQVUVCYWhBOEpEMGdBUThMRU4wQlFRRkdCRUFqUEVFQ2F4QThKRHdqUENNOVFRSnFRZi8vQTNFUTBnRU1CZ1VNQ0FzQUN3d0RDeERIQVJEcEFRd0hDeU04UVFKckVEd2tQQ004SXowUTBnRkJDQ1E5REFNTFFYOFBDeU04UVFKckVEd2tQQ004SXoxQkFtb1FQQkRTQVFzUXlBRkIvLzhEY1NROUMwRUlEd3NqUFVFQ2FoQThKRDFCREE4TEl6d1E5UUZCLy84RGNTUTlJenhCQW1vUVBDUThRUXdQQ3lNOVFRRnFFRHdrUFVFRUN4VUFJQUJCQVhFRVFFRUJKSWdCQlVFQUpJY0JDd3V4QXdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCMEFGSEJFQUNRQ0FCUWRFQmF3NFBBZ01BQkFVR0J3Z0pDZ0FMQUF3TkFBc01EUXNRMXdFTkRnd1FDeU04RVBVQlFmLy9BM0VoQVNNOFFRSnFFRHdrUENBQkVJWUJRZjhCY1NRM0lBRVFod0ZCL3dGeEpEaEJCQThMRU5jQkJFQU1EZ1VNREFzQUN4RFhBUVJBREEwRkl6eEJBbXNRUENROEl6d2pQVUVDYWtILy93TnhFTklCREFzTEFBc2pQRUVDYXhBOEpEd2pQQ00zSXpnUVNoRFNBUXdLQ3hESEFSRHJBUXdNQ3lNOFFRSnJFRHdrUENNOEl6MFEwZ0ZCRUNROURBZ0xFTmNCUVFGSERRY01DUXNqUEJEMUFVSC8vd054SkQxQkFSQ0NBaU04UVFKcUVEd2tQQXdHQ3hEWEFVRUJSZ1JBREFVRkRBY0xBQXNRMXdGQkFVWUVRQ004UVFKckVEd2tQQ004SXoxQkFtb1FQQkRTQVF3RUJRd0dDd0FMRU1jQkVPd0JEQVlMSXp4QkFtc1FQQ1E4SXp3alBSRFNBVUVZSkQwTUFndEJmdzhMRU1nQlFmLy9BM0VrUFF0QkNBOExJejFCQW1vUVBDUTlRUXdQQ3lNOEVQVUJRZi8vQTNFa1BTTThRUUpxRUR3a1BFRU1Ed3NqUFVFQmFoQThKRDFCQkF2Z0FnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBVWNFUUFKQUlBQkI0UUZyRGc4Q0F3QUFCQVVHQndnSkFBQUFDZ3NBQ3d3TEN4REhBVUgvQVhGQmdQNERhaU0wRU1rQkRBc0xJendROVFGQi8vOERjU0VBSXp4QkFtb1FQQ1E4SUFBUWhnRkIvd0Z4SkRrZ0FCQ0hBVUgvQVhFa09rRUVEd3NqTmtHQS9nTnFJelFReVFGQkJBOExJenhCQW1zUVBDUThJendqT1NNNkVFb1EwZ0ZCQ0E4TEVNY0JFTzRCREFjTEl6eEJBbXNRUENROEl6d2pQUkRTQVVFZ0pEMUJDQThMRU1jQkVOa0JJUUFqUENBQVFSaDBRUmgxSWdCQkFSRFRBU004SUFCcUVEd2tQRUVBRU0wQlFRQVF6Z0VqUFVFQmFoQThKRDFCREE4TEl6a2pPaEJLUWYvL0EzRWtQVUVFRHdzUXlBRkIvLzhEY1NNMEVNa0JJejFCQW1vUVBDUTlRUVFQQ3hESEFSRHZBUXdDQ3lNOFFRSnJFRHdrUENNOEl6MFEwZ0ZCS0NROVFRZ1BDMEYvRHdzalBVRUJhaEE4SkQxQkJBdVNBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBVWNFUUFKQUlBQkI4UUZyRGc4Q0F3UUFCUVlIQ0FrS0N3QUFEQTBBQ3d3TkN4REhBVUgvQVhGQmdQNERhaERVQVJDSEFTUTBEQTBMSXp3UTlRRkIvLzhEY1NFQUl6eEJBbW9RUENROElBQVFoZ0ZCL3dGeEpEUWdBQkNIQVVIL0FYRWtPd3dOQ3lNMlFZRCtBMm9RMUFFUWh3RWtOQXdNQzBFQUVJSUNEQXNMSXp4QkFtc1FQQ1E4SXp3ak5DTTdFRW9RMGdGQkNBOExFTWNCRVBFQkRBZ0xJenhCQW1zUVBDUThJendqUFJEU0FVRXdKRDFCQ0E4TEVNY0JFTmtCSVFCQkFCRE5BVUVBRU00Qkl6d2dBRUVZZEVFWWRTSUFRUUVRMHdFalBDQUFhaEE4SWdBUWhnRkIvd0Z4SkRrZ0FCQ0hBVUgvQVhFa09pTTlRUUZxRUR3a1BVRUlEd3NqT1NNNkVFcEIvLzhEY1NROFFRZ1BDeERJQVVILy93TnhFTlFCUWY4QmNTUTBJejFCQW1vUVBDUTlEQVVMUVFFUWdnSU1CQXNReHdFUThnRU1BZ3NqUEVFQ2F4QThKRHdqUENNOUVOSUJRVGdrUFVFSUR3dEJmdzhMSXoxQkFXb1FQQ1E5QzBFRUM5WUJBUUYvSXoxQkFXb1FQQ1E5STBFRVFDTTlRUUZyRUR3a1BRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPRFFNRUJRWUhDQWtLQ3d3TkRnOEFDd3dQQ3lBQUVOWUJEd3NnQUJEY0FROExJQUFRNEFFUEN5QUFFT0VCRHdzZ0FCRGlBUThMSUFBUTR3RVBDeUFBRU9RQkR3c2dBQkRtQVE4TElBQVE2Z0VQQ3lBQUVPMEJEd3NnQUJEd0FROExJQUFROHdFUEN5QUFFSUVDRHdzZ0FCQ0RBZzhMSUFBUWhBSVBDeUFBRUlVQ0N4SUFRUUFrUUVFQUpEOUJBQ1JCUVFBa1Fnc1VBQ00vQkg4alB3VWpRQXNFUUVFQkR3dEJBQXNkQVFGL0lBRVFoZ0VoQWlBQUlBRVFod0VRQmlBQVFRRnFJQUlRQmd1Q0FRRUJmMEVBRUlJQ0lBQkJqLzRERUFNUVJDSUJKSGRCai80RElBRVFCaU04UVFKclFmLy9BM0VrUEJDSUFob2pQQ005RUlrQ0FrQUNRQUpBQWtBZ0FBUkFBa0FnQUVFQmF3NEVBZ01BQkFBTERBUUxRUUFrYzBIQUFDUTlEQU1MUVFBa2RFSElBQ1E5REFJTFFRQWtkVUhRQUNROURBRUxRUUFrZGtIZ0FDUTlDd3UvQVFFQ2Z5T0lBUVJBUVFFa2h3RkJBQ1NJQVFzamNpTjNjVUVmY1VFQVNnUkFJNGNCQkg4alFFVUZJNGNCQ3lJQUJFQWpiZ1IvSTNNRkkyNExJZ0FFUUVFQUVJb0NRUUVoQVFVamJ3Ui9JM1FGSTI4TElnQUVRRUVCRUlvQ1FRRWhBUVVqY0FSL0kzVUZJM0FMSWdBRVFFRUNFSW9DUVFFaEFRVWpjUVIvSTNZRkkzRUxJZ0FFUUVFRUVJb0NRUUVoQVFzTEN3c0xRUUFoQUNBQkJFQkJGQ0VBRUlnQ0JFQVFod0pCR0NFQUN3c1FpQUlFUUJDSEFnc2dBQThMUVFBTEtBQWpoUUVnQUdva2hRRWpoUUVqZ3dGT0JFQWpoQUZCQVdva2hBRWpoUUVqZ3dGckpJVUJDd3R4QVFKL1FRRVFGU05CQkVBalBSQURRZjhCY1JDR0FoREZBUkNIQWdzUWl3SWlBVUVBU2dSQUlBRVF4UUVMUVFRaEFCQ0lBa1VpQVFSQUkwSkZJUUVMSUFFRVFDTTlFQU5CL3dGeEVJWUNJUUFMSXp0QjhBRnhKRHNnQUVFQVRBUkFJQUFQQ3lBQUVNVUJRUUVRakFJZ0FBc1FBQ016QkVCQm9Na0lEd3RCMEtRRUN3UUFJMThMemdFQkJIOUJnQWdoQXlBQlFRQktCRUFnQVNFREJTQUJRUUJJQkVCQmZ5RURDd3RCQUNFQkEwQWdCa1VpQUFSQUlBRkZJUUFMSUFBRVFDQUVSU0VBQ3lBQUJFQWdCVVVoQUFzZ0FBUkFFSTBDUVFCSUJFQkJBU0VHQlNNK0VJNENUZ1JBUVFFaEFRVWdBMEYvU2lJQUJFQVFqd0lnQTA0aEFBc2dBQVJBUVFFaEJBVWdBa0YvU2lJQUJFQWpQU0FDUmlFQUN5QUFCRUJCQVNFRkN3c0xDd3dCQ3dzZ0FRUkFJejRRamdKckpENUJBQThMSUFRRVFFRUJEd3NnQlFSQVFRSVBDeU05UVFGckVEd2tQVUYvQ3dzQVFRRkJmMEYvRUpBQ0N6Z0JBMzhEUUNBQ0lBQklJZ01FUUNBQlFRQk9JUU1MSUFNRVFCQ1JBaUVCSUFKQkFXb2hBZ3dCQ3dzZ0FVRUFTQVJBSUFFUEMwRUFDd3NBUVFFZ0FFRi9FSkFDQ3hvQkFYOUJBVUYvSUFBUWtBSWlBVUVDUmdSQVFRRVBDeUFCQ3dVQUk0QUJDd1VBSTRFQkN3VUFJNElCQzE4QkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQUVRQ0FBSWdGQkFVWU5BUUpBSUFGQkFtc09CZ01FQlFZSENBQUxEQWdMSTlnQkR3c2oyUUVQQ3lQYUFROExJOXNCRHdzajNBRVBDeVBkQVE4TEk5NEJEd3NqM3dFUEMwRUFDNHNCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBQ0lDUVFGR0RRRUNRQ0FDUVFKckRnWURCQVVHQndnQUN3d0lDeUFCUVFGeEpOZ0JEQWNMSUFGQkFYRWsyUUVNQmdzZ0FVRUJjU1RhQVF3RkN5QUJRUUZ4Sk5zQkRBUUxJQUZCQVhFazNBRU1Bd3NnQVVFQmNTVGRBUXdDQ3lBQlFRRnhKTjRCREFFTElBRkJBWEVrM3dFTEN3b0FRUUVrZGtFRUVGMExaQUVDZjBFQUpFSWdBQkNZQWtVRVFFRUJJUUVMSUFCQkFSQ1pBaUFCQkVCQkFDRUJJQUJCQTB3RVFFRUJJUUVMSTYwQkJIOGdBUVVqclFFTElnQUVRRUVCSVFJTEk2NEJCSDhnQVVVRkk2NEJDeUlBQkVCQkFTRUNDeUFDQkVBUW1nSUxDd3NKQUNBQVFRQVFtUUlMbWdFQUlBQkJBRW9FUUVFQUVKc0NCVUVBRUp3Q0N5QUJRUUJLQkVCQkFSQ2JBZ1ZCQVJDY0Fnc2dBa0VBU2dSQVFRSVFtd0lGUVFJUW5BSUxJQU5CQUVvRVFFRURFSnNDQlVFREVKd0NDeUFFUVFCS0JFQkJCQkNiQWdWQkJCQ2NBZ3NnQlVFQVNnUkFRUVVRbXdJRlFRVVFuQUlMSUFaQkFFb0VRRUVHRUpzQ0JVRUdFSndDQ3lBSFFRQktCRUJCQnhDYkFnVkJCeENjQWdzTEJBQWpOQXNFQUNNMUN3UUFJellMQkFBak53c0VBQ000Q3dRQUl6a0xCQUFqT2dzRUFDTTdDd1FBSXowTEJBQWpQQXNHQUNNOUVBTUxCQUFqU3d1ZkF3RUtmMEdBa0FJaENTT25BUVJBUVlDQUFpRUpDMEdBc0FJaENpT29BUVJBUVlDNEFpRUtDd0pBQTBBZ0JFR0FBazROQVFKQVFRQWhCUU5BSUFWQmdBSk9EUUVnQ1NBS0lBUkJBM1ZCQlhScUlBVkJBM1ZxSWdaQkFCQS9FRWdoQ0NBRVFRaHZJUUZCQnlBRlFRaHZheUVIUVFBaEFpTXZCSDhnQUVFQVNnVWpMd3NpQXdSQUlBWkJBUkEvSVFJTFFRWWdBaEFRQkVCQkJ5QUJheUVCQzBFQUlRTkJBeUFDRUJBRVFFRUJJUU1MSUFnZ0FVRUJkR29pQmlBREVEOGhDRUVBSVFFZ0J5QUdRUUZxSUFNUVB4QVFCRUJCQWlFQkN5QUhJQWdRRUFSQUlBRkJBV29oQVFzZ0JFRUlkQ0FGYWtFRGJDRUhJeThFZnlBQVFRQktCU012Q3lJREJFQkJBQ0FDUVFkeElBRkJBQkJMSWdFUVRDRUdRUUVnQVJCTUlRTkJBaUFCRUV3aEFTQUhRWUNZRG1vaUFpQUdPZ0FBSUFKQkFXb2dBem9BQUNBQ1FRSnFJQUU2QUFBRklBRkJ4LzREUVFBUVRTRUNBa0JCQUNFQkEwQWdBVUVEVGcwQklBZEJnSmdPYWlBQmFpQUNPZ0FBSUFGQkFXb2hBUXdBQUFzQUN3c2dCVUVCYWlFRkRBQUFDd0FMSUFSQkFXb2hCQXdBQUFzQUN3dlRBUUVHZndKQUEwQWdBa0VYVGcwQkFrQkJBQ0VBQTBBZ0FFRWZUZzBCUVFBaEJDQUFRUTlLQkVCQkFTRUVDeUFDSVFFZ0FrRVBTZ1JBSUFGQkQyc2hBUXNnQVVFRWRDRUJJQUJCRDBvRWZ5QUJJQUJCRDJ0cUJTQUJJQUJxQ3lFQlFZQ0FBaUVGSUFKQkQwb0VRRUdBa0FJaEJRc0NRRUVBSVFNRFFDQURRUWhPRFFFZ0FTQUZJQVJCQUVFSElBTWdBRUVEZENBQ1FRTjBJQU5xUWZnQlFZQ1lHa0VCUVFCQmZ4QlBHaUFEUVFGcUlRTU1BQUFMQUFzZ0FFRUJhaUVBREFBQUN3QUxJQUpCQVdvaEFnd0FBQXNBQ3dzRUFDTjVDd1FBSTNvTEJBQWpld3NYQVFGL0kzMGhBQ044QkVCQkFpQUFFRVVoQUFzZ0FBc1VBRDhBUVlzQlNBUkFRWXNCUHdCclFBQWFDd3NkQUFKQUFrQUNRQ09FQWc0Q0FRSUFDd0FMUVFBaEFBc2dBQkNUQWdzSEFDQUFKSVFDQ3pFQUFrQUNRQUpBQWtBQ1FDT0VBZzRFQVFJREJBQUxBQXRCQVNFQUMwRi9JUUVMUVg4aEFnc2dBQ0FCSUFJUWtBSUxBTEppQkc1aGJXVUJxbUswQWdBbFkyOXlaUzl0WlcxdmNua3ZZbUZ1YTJsdVp5OW5aWFJTYjIxQ1lXNXJRV1JrY21WemN3RWxZMjl5WlM5dFpXMXZjbmt2WW1GdWEybHVaeTluWlhSU1lXMUNZVzVyUVdSa2NtVnpjd0kzWTI5eVpTOXRaVzF2Y25rdmJXVnRiM0o1VFdGd0wyZGxkRmRoYzIxQ2IzbFBabVp6WlhSR2NtOXRSMkZ0WlVKdmVVOW1abk5sZEFNcFkyOXlaUzl0WlcxdmNua3ZiRzloWkM5bGFXZG9kRUpwZEV4dllXUkdjbTl0UjBKTlpXMXZjbmtFR21OdmNtVXZZM0IxTDJOd2RTOXBibWwwYVdGc2FYcGxRM0IxQlNaamIzSmxMMjFsYlc5eWVTOXRaVzF2Y25rdmFXNXBkR2xoYkdsNlpVTmhjblJ5YVdSblpRWXJZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZaV2xuYUhSQ2FYUlRkRzl5WlVsdWRHOUhRazFsYlc5eWVRY2RZMjl5WlM5dFpXMXZjbmt2WkcxaEwybHVhWFJwWVd4cGVtVkViV0VJS1dOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZhVzVwZEdsaGJHbDZaVWR5WVhCb2FXTnpDU2RqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmFXNXBkR2xoYkdsNlpWQmhiR1YwZEdVS0oyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVhVzVwZEdsaGJHbDZaUXNuWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1cGJtbDBhV0ZzYVhwbERDZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMbWx1YVhScFlXeHBlbVVOSjJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWFXNXBkR2xoYkdsNlpRNHhZMjl5WlM5emIzVnVaQzloWTJOMWJYVnNZWFJ2Y2k5cGJtbDBhV0ZzYVhwbFUyOTFibVJCWTJOMWJYVnNZWFJ2Y2c4Z1kyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5cGJtbDBhV0ZzYVhwbFUyOTFibVFRSVdOdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5amFHVmphMEpwZEU5dVFubDBaUkU4WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12U1c1MFpYSnlkWEIwY3k1MWNHUmhkR1ZKYm5SbGNuSjFjSFJGYm1GaWJHVmtFajVqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlKYm5SbGNuSjFjSFJ6TG5Wd1pHRjBaVWx1ZEdWeWNuVndkRkpsY1hWbGMzUmxaQk12WTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12YVc1cGRHbGhiR2w2WlVsdWRHVnljblZ3ZEhNVUkyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OXBibWwwYVdGc2FYcGxWR2x0WlhKekZSdGpiM0psTDJOdmNtVXZjMlYwU0dGelEyOXlaVk4wWVhKMFpXUVdGMk52Y21VdlkzbGpiR1Z6TDNKbGMyVjBRM2xqYkdWekZ4ZGpiM0psTDJWNFpXTjFkR1V2Y21WelpYUlRkR1Z3Y3hnVVkyOXlaUzlqYjNKbEwybHVhWFJwWVd4cGVtVVpFR052Y21VdlkyOXlaUzlqYjI1bWFXY2FHR052Y21VdlkyOXlaUzlvWVhORGIzSmxVM1JoY25SbFpCc2lZMjl5WlM5amIzSmxMMmRsZEZOaGRtVlRkR0YwWlUxbGJXOXllVTltWm5ObGRCd3lZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZjM1J2Y21WQ2IyOXNaV0Z1UkdseVpXTjBiSGxVYjFkaGMyMU5aVzF2Y25rZEdtTnZjbVV2WTNCMUwyTndkUzlEY0hVdWMyRjJaVk4wWVhSbEhpbGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TG5OaGRtVlRkR0YwWlI4dlkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlNXNTBaWEp5ZFhCMGN5NXpZWFpsVTNSaGRHVWdJMk52Y21VdmFtOTVjR0ZrTDJwdmVYQmhaQzlLYjNsd1lXUXVjMkYyWlZOMFlYUmxJU05qYjNKbEwyMWxiVzl5ZVM5dFpXMXZjbmt2VFdWdGIzSjVMbk5oZG1WVGRHRjBaU0lqWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTV6WVhabFUzUmhkR1VqSUdOdmNtVXZjMjkxYm1RdmMyOTFibVF2VTI5MWJtUXVjMkYyWlZOMFlYUmxKQ1pqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5OaGRtVlRkR0YwWlNVbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01pOURhR0Z1Ym1Wc01pNXpZWFpsVTNSaGRHVW1KbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11YzJGMlpWTjBZWFJsSnlaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuTmhkbVZUZEdGMFpTZ1RZMjl5WlM5amIzSmxMM05oZG1WVGRHRjBaU2t5WTI5eVpTOXRaVzF2Y25rdmJHOWhaQzlzYjJGa1FtOXZiR1ZoYmtScGNtVmpkR3g1Um5KdmJWZGhjMjFOWlcxdmNua3FHbU52Y21VdlkzQjFMMk53ZFM5RGNIVXViRzloWkZOMFlYUmxLeVpqYjNKbEwyZHlZWEJvYVdOekwyeGpaQzlNWTJRdWRYQmtZWFJsVEdOa1EyOXVkSEp2YkN3cFkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlIY21Gd2FHbGpjeTVzYjJGa1UzUmhkR1V0TDJOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDBsdWRHVnljblZ3ZEhNdWJHOWhaRk4wWVhSbExpWmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZTbTk1Y0dGa0xuVndaR0YwWlVwdmVYQmhaQzhqWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDBwdmVYQmhaQzVzYjJGa1UzUmhkR1V3STJOdmNtVXZiV1Z0YjNKNUwyMWxiVzl5ZVM5TlpXMXZjbmt1Ykc5aFpGTjBZWFJsTVNOamIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlZHbHRaWEp6TG14dllXUlRkR0YwWlRJaFkyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5amJHVmhja0YxWkdsdlFuVm1abVZ5TXlCamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMbXh2WVdSVGRHRjBaVFFtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1c2IyRmtVM1JoZEdVMUptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXViRzloWkZOMFlYUmxOaVpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG14dllXUlRkR0YwWlRjbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNXNiMkZrVTNSaGRHVTRFMk52Y21VdlkyOXlaUzlzYjJGa1UzUmhkR1U1SDJOdmNtVXZaWGhsWTNWMFpTOW5aWFJUZEdWd2MxQmxjbE4wWlhCVFpYUTZHR052Y21VdlpYaGxZM1YwWlM5blpYUlRkR1Z3VTJWMGN6c1ZZMjl5WlM5bGVHVmpkWFJsTDJkbGRGTjBaWEJ6UENKamIzSmxMM0J2Y25SaFlteGxMM0J2Y25SaFlteGxMM1V4TmxCdmNuUmhZbXhsUFRkamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMGR5WVhCb2FXTnpMazFCV0Y5RFdVTk1SVk5mVUVWU1gxTkRRVTVNU1U1RlBqSmpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TG1KaGRHTm9VSEp2WTJWemMwTjVZMnhsY3o4blkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTlzYjJGa1JuSnZiVlp5WVcxQ1lXNXJRQ2RqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwyZGxkRkpuWWxCcGVHVnNVM1JoY25SQkptTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012YzJWMFVHbDRaV3hQYmtaeVlXMWxRaVJqYjNKbEwyZHlZWEJvYVdOekwzQnlhVzl5YVhSNUwyZGxkRkJwZUdWc1UzUmhjblJES21OdmNtVXZaM0poY0docFkzTXZjSEpwYjNKcGRIa3ZaMlYwVUhKcGIzSnBkSGxtYjNKUWFYaGxiRVFoWTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKbGMyVjBRbWwwVDI1Q2VYUmxSUjlqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2YzJWMFFtbDBUMjVDZVhSbFJpcGpiM0psTDJkeVlYQm9hV056TDNCeWFXOXlhWFI1TDJGa1pGQnlhVzl5YVhSNVptOXlVR2w0Wld4SE9tTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTlrY21GM1RHbHVaVTltVkdsc1pVWnliMjFVYVd4bFEyRmphR1ZJSm1OdmNtVXZaM0poY0docFkzTXZkR2xzWlhNdloyVjBWR2xzWlVSaGRHRkJaR1J5WlhOelNUTmpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2Ykc5aFpGQmhiR1YwZEdWQ2VYUmxSbkp2YlZkaGMyMU5aVzF2Y25sS0kyTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOWpiMjVqWVhSbGJtRjBaVUo1ZEdWelN5eGpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2WjJWMFVtZGlRMjlzYjNKR2NtOXRVR0ZzWlhSMFpVd3VZMjl5WlM5bmNtRndhR2xqY3k5d1lXeGxkSFJsTDJkbGRFTnZiRzl5UTI5dGNHOXVaVzUwUm5KdmJWSm5ZazB6WTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwyZGxkRTF2Ym05amFISnZiV1ZEYjJ4dmNrWnliMjFRWVd4bGRIUmxUaVZqYjNKbEwyZHlZWEJvYVdOekwzUnBiR1Z6TDJkbGRGUnBiR1ZRYVhobGJGTjBZWEowVHl4amIzSmxMMmR5WVhCb2FXTnpMM1JwYkdWekwyUnlZWGRRYVhobGJITkdjbTl0VEdsdVpVOW1WR2xzWlZBM1kyOXlaUzluY21Gd2FHbGpjeTlpWVdOclozSnZkVzVrVjJsdVpHOTNMMlJ5WVhkTWFXNWxUMlpVYVd4bFJuSnZiVlJwYkdWSlpGRTNZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDJSeVlYZERiMnh2Y2xCcGVHVnNSbkp2YlZScGJHVkpaRkk4WTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGROYjI1dlkyaHliMjFsVUdsNFpXeEdjbTl0Vkdsc1pVbGtVenRqYjNKbEwyZHlZWEJvYVdOekwySmhZMnRuY205MWJtUlhhVzVrYjNjdlpISmhkMEpoWTJ0bmNtOTFibVJYYVc1a2IzZFRZMkZ1YkdsdVpWUXZZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDNKbGJtUmxja0poWTJ0bmNtOTFibVJWSzJOdmNtVXZaM0poY0docFkzTXZZbUZqYTJkeWIzVnVaRmRwYm1SdmR5OXlaVzVrWlhKWGFXNWtiM2RXSTJOdmNtVXZaM0poY0docFkzTXZjM0J5YVhSbGN5OXlaVzVrWlhKVGNISnBkR1Z6VnlSamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMTlrY21GM1UyTmhibXhwYm1WWUtXTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012WDNKbGJtUmxja1Z1ZEdseVpVWnlZVzFsV1NkamIzSmxMMmR5WVhCb2FXTnpMM0J5YVc5eWFYUjVMMk5zWldGeVVISnBiM0pwZEhsTllYQmFJbU52Y21VdlozSmhjR2hwWTNNdmRHbHNaWE12Y21WelpYUlVhV3hsUTJGamFHVmJPMk52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlIzSmhjR2hwWTNNdVRVbE9YME5aUTB4RlUxOVRVRkpKVkVWVFgweERSRjlOVDBSRlhFRmpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TGsxSlRsOURXVU5NUlZOZlZGSkJUbE5HUlZKZlJFRlVRVjlNUTBSZlRVOUVSVjBzWTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12WDNKbGNYVmxjM1JKYm5SbGNuSjFjSFJlTG1OdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JNWTJSSmJuUmxjbkoxY0hSZktXTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1WW1GMFkyaFFjbTlqWlhOelEzbGpiR1Z6WUMxamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMbTFoZUVaeVlXMWxVMlZ4ZFdWdVkyVkRlV05zWlhOaEtXTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVkWEJrWVhSbFRHVnVaM1JvWWlsamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlV4bGJtZDBhR01wWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTXk5RGFHRnVibVZzTXk1MWNHUmhkR1ZNWlc1bmRHaGtLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiRFF2UTJoaGJtNWxiRFF1ZFhCa1lYUmxUR1Z1WjNSb1pTeGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMMmRsZEU1bGQwWnlaWEYxWlc1amVVWnliMjFUZDJWbGNHWXBZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNUzlEYUdGdWJtVnNNUzV6WlhSR2NtVnhkV1Z1WTNsbk1tTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZZMkZzWTNWc1lYUmxVM2RsWlhCQmJtUkRhR1ZqYTA5MlpYSm1iRzkzYUNoamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlZOM1pXVndhU3RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVVZ1ZG1Wc2IzQmxhaXRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5Wd1pHRjBaVVZ1ZG1Wc2IzQmxheXRqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5Wd1pHRjBaVVZ1ZG1Wc2IzQmxiQ1ZqYjNKbEwzTnZkVzVrTDNOdmRXNWtMM1Z3WkdGMFpVWnlZVzFsVTJWeGRXVnVZMlZ5YlM1amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuZHBiR3hEYUdGdWJtVnNWWEJrWVhSbGJpcGpiM0psTDNOdmRXNWtMMkZqWTNWdGRXeGhkRzl5TDJScFpFTm9ZVzV1Wld4RVlXTkRhR0Z1WjJWdkxtTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJESXZRMmhoYm01bGJESXVkMmxzYkVOb1lXNXVaV3hWY0dSaGRHVndMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1Z4TG1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWQybHNiRU5vWVc1dVpXeFZjR1JoZEdWeUoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVjbVZ6WlhSVWFXMWxjbk05WTI5eVpTOXpiM1Z1WkM5a2RYUjVMMmx6UkhWMGVVTjVZMnhsUTJ4dlkydFFiM05wZEdsMlpVOXlUbVZuWVhScGRtVkdiM0pYWVhabFptOXliWFFtWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1blpYUlRZVzF3YkdWMU5tTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJERXZRMmhoYm01bGJERXVaMlYwVTJGdGNHeGxSbkp2YlVONVkyeGxRMjkxYm5SbGNuWW5ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTV5WlhObGRGUnBiV1Z5ZHlaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxtZGxkRk5oYlhCc1pYZzJZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTVuWlhSVFlXMXdiR1ZHY205dFEzbGpiR1ZEYjNWdWRHVnllU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5KbGMyVjBWR2x0WlhKNkltTnZjbVV2Y0c5eWRHRmliR1V2Y0c5eWRHRmliR1V2YVRNeVVHOXlkR0ZpYkdWN0ptTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJETXZRMmhoYm01bGJETXVaMlYwVTJGdGNHeGxmRFpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG1kbGRGTmhiWEJzWlVaeWIyMURlV05zWlVOdmRXNTBaWEo5TzJOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdVoyVjBUbTlwYzJWRGFHRnVibVZzUm5KbGNYVmxibU41VUdWeWFXOWtmaVpqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG1kbGRGTmhiWEJzWlg4MlkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc05DOURhR0Z1Ym1Wc05DNW5aWFJUWVcxd2JHVkdjbTl0UTNsamJHVkRiM1Z1ZEdWeWdBRWNZMjl5WlM5amNIVXZZM0IxTDBOd2RTNURURTlEUzE5VFVFVkZSSUVCS21OdmNtVXZjMjkxYm1RdmMyOTFibVF2VTI5MWJtUXViV0Y0Ukc5M2JsTmhiWEJzWlVONVkyeGxjNElCS0dOdmNtVXZjMjkxYm1RdmMyOTFibVF2WjJWMFUyRnRjR3hsUVhOVmJuTnBaMjVsWkVKNWRHV0RBU0pqYjNKbEwzTnZkVzVrTDNOdmRXNWtMMjFwZUVOb1lXNXVaV3hUWVcxd2JHVnpoQUV6WTI5eVpTOXpiM1Z1WkM5emIzVnVaQzl6WlhSTVpXWjBRVzVrVW1sbmFIUlBkWFJ3ZFhSR2IzSkJkV1JwYjFGMVpYVmxoUUVtWTI5eVpTOXpiM1Z1WkM5aFkyTjFiWFZzWVhSdmNpOWhZMk4xYlhWc1lYUmxVMjkxYm1TR0FTQmpiM0psTDJobGJIQmxjbk12YVc1a1pYZ3ZjM0JzYVhSSWFXZG9RbmwwWlljQkgyTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXpjR3hwZEV4dmQwSjVkR1dJQVI5amIzSmxMM052ZFc1a0wzTnZkVzVrTDJOaGJHTjFiR0YwWlZOdmRXNWtpUUVjWTI5eVpTOXpiM1Z1WkM5emIzVnVaQzkxY0dSaGRHVlRiM1Z1WklvQkltTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlltRjBZMmhRY205alpYTnpRWFZrYVcrTEFTdGpiM0psTDNOdmRXNWtMM0psWjJsemRHVnljeTlUYjNWdVpGSmxaMmx6ZEdWeVVtVmhaRlJ5WVhCempBRWhZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMMmRsZEVwdmVYQmhaRk4wWVhSbGpRRWtZMjl5WlM5dFpXMXZjbmt2Y21WaFpGUnlZWEJ6TDJOb1pXTnJVbVZoWkZSeVlYQnpqZ0V5WTI5eVpTOXRaVzF2Y25rdmJHOWhaQzlsYVdkb2RFSnBkRXh2WVdSR2NtOXRSMEpOWlcxdmNubFhhWFJvVkhKaGNIT1BBU0ZqYjNKbEwyMWxiVzl5ZVM5aVlXNXJhVzVuTDJoaGJtUnNaVUpoYm10cGJtZVFBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURDUkFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlRENTQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VER1RBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5Wd1pHRjBaVTVTZURHVUFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlREdWQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlU1U2VER1dBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURLWEFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVNVNlREtZQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlU1U2VES1pBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5Wd1pHRjBaVTVTZURLYUFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlRE9iQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlU1U2VET2NBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5Wd1pHRjBaVTVTZURPZEFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMblZ3WkdGMFpVNVNlRE9lQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VEU2ZBU1JqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5SeWFXZG5aWEtnQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlU1U2VEU2hBU1JqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5SeWFXZG5aWEtpQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlU1U2VEU2pBU1JqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5SeWFXZG5aWEtrQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlU1U2VEU2xBU1JqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5SeWFXZG5aWEttQVNGamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMblZ3WkdGMFpVNVNOVENuQVNGamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMblZ3WkdGMFpVNVNOVEdvQVNGamIzSmxMM052ZFc1a0wzTnZkVzVrTDFOdmRXNWtMblZ3WkdGMFpVNVNOVEtwQVN4amIzSmxMM052ZFc1a0wzSmxaMmx6ZEdWeWN5OVRiM1Z1WkZKbFoybHpkR1Z5VjNKcGRHVlVjbUZ3YzZvQkpXTnZjbVV2WjNKaGNHaHBZM012YkdOa0wweGpaQzUxY0dSaGRHVk1ZMlJUZEdGMGRYT3JBU0JqYjNKbEwyMWxiVzl5ZVM5a2JXRXZjM1JoY25SRWJXRlVjbUZ1YzJabGNxd0JKMk52Y21VdmJXVnRiM0o1TDJSdFlTOW5aWFJJWkcxaFUyOTFjbU5sUm5KdmJVMWxiVzl5ZWEwQkxHTnZjbVV2YldWdGIzSjVMMlJ0WVM5blpYUklaRzFoUkdWemRHbHVZWFJwYjI1R2NtOXRUV1Z0YjNKNXJnRWhZMjl5WlM5dFpXMXZjbmt2WkcxaEwzTjBZWEowU0dSdFlWUnlZVzV6Wm1WeXJ3RXlZMjl5WlM5bmNtRndhR2xqY3k5d1lXeGxkSFJsTDNOMGIzSmxVR0ZzWlhSMFpVSjVkR1ZKYmxkaGMyMU5aVzF2Y25td0FUQmpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2YVc1amNtVnRaVzUwVUdGc1pYUjBaVWx1WkdWNFNXWlRaWFN4QVM5amIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZkM0pwZEdWRGIyeHZjbEJoYkdWMGRHVlViMDFsYlc5eWViSUJNR052Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMM0psY1hWbGMzUlVhVzFsY2tsdWRHVnljblZ3ZExNQkttTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OWZaMlYwVkdsdFpYSkRiM1Z1ZEdWeVRXRnphMEpwZExRQk8yTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OWZZMmhsWTJ0RWFYWnBaR1Z5VW1WbmFYTjBaWEpHWVd4c2FXNW5SV1JuWlVSbGRHVmpkRzl5dFFFcFkyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxOXBibU55WlcxbGJuUlVhVzFsY2tOdmRXNTBaWEsyQVI5amIzSmxMM1JwYldWeWN5OTBhVzFsY25NdmRYQmtZWFJsVkdsdFpYSnp0d0VsWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDJKaGRHTm9VSEp2WTJWemMxUnBiV1Z5YzdnQkwyTnZjbVV2ZEdsdFpYSnpMM1JwYldWeWN5OVVhVzFsY25NdWRYQmtZWFJsUkdsMmFXUmxjbEpsWjJsemRHVnl1UUVzWTI5eVpTOTBhVzFsY25NdmRHbHRaWEp6TDFScGJXVnljeTUxY0dSaGRHVlVhVzFsY2tOdmRXNTBaWEs2QVN0amIzSmxMM1JwYldWeWN5OTBhVzFsY25NdlZHbHRaWEp6TG5Wd1pHRjBaVlJwYldWeVRXOWtkV3h2dXdFc1kyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1MWNHUmhkR1ZVYVcxbGNrTnZiblJ5YjJ5OEFTWmpiM0psTDIxbGJXOXllUzkzY21sMFpWUnlZWEJ6TDJOb1pXTnJWM0pwZEdWVWNtRndjNzBCTkdOdmNtVXZiV1Z0YjNKNUwzTjBiM0psTDJWcFoyaDBRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbmxYYVhSb1ZISmhjSE8rQVJ4amIzSmxMMjFsYlc5eWVTOWtiV0V2YUdSdFlWUnlZVzV6Wm1WeXZ3RWdZMjl5WlM5dFpXMXZjbmt2WkcxaEwzVndaR0YwWlVoaWJHRnVhMGhrYldIQUFURmpiM0psTDJsdWRHVnljblZ3ZEhNdmFXNTBaWEp5ZFhCMGN5OXlaWEYxWlhOMFZrSnNZVzVyU1c1MFpYSnlkWEIwd1FFZVkyOXlaUzluY21Gd2FHbGpjeTlzWTJRdmMyVjBUR05rVTNSaGRIVnp3Z0VsWTI5eVpTOW5jbUZ3YUdsamN5OW5jbUZ3YUdsamN5OTFjR1JoZEdWSGNtRndhR2xqYzhNQksyTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012WW1GMFkyaFFjbTlqWlhOelIzSmhjR2hwWTNQRUFScGpiM0psTDJONVkyeGxjeTkwY21GamEwTjVZMnhsYzFKaGJzVUJGbU52Y21VdlkzbGpiR1Z6TDNONWJtTkRlV05zWlhQR0FSOWpiM0psTDJOd2RTOXZjR052WkdWekwyZGxkRVJoZEdGQ2VYUmxWSGR2eHdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5blpYUkVZWFJoUW5sMFpVOXVaY2dCS0dOdmNtVXZZM0IxTDI5d1kyOWtaWE12WjJWMFEyOXVZMkYwWlc1aGRHVmtSR0YwWVVKNWRHWEpBU2hqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMlZwWjJoMFFtbDBVM1J2Y21WVGVXNWpRM2xqYkdWenlnRVpZMjl5WlM5amNIVXZabXhoWjNNdmMyVjBSbXhoWjBKcGRNc0JIMk52Y21VdlkzQjFMMlpzWVdkekwzTmxkRWhoYkdaRFlYSnllVVpzWVdmTUFTOWpiM0psTDJOd2RTOW1iR0ZuY3k5amFHVmphMEZ1WkZObGRFVnBaMmgwUW1sMFNHRnNaa05oY25KNVJteGhaODBCR21OdmNtVXZZM0IxTDJac1lXZHpMM05sZEZwbGNtOUdiR0ZuemdFZVkyOXlaUzlqY0hVdlpteGhaM012YzJWMFUzVmlkSEpoWTNSR2JHRm56d0ViWTI5eVpTOWpjSFV2Wm14aFozTXZjMlYwUTJGeWNubEdiR0ZuMEFFaFkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzSnZkR0YwWlVKNWRHVk1aV1owMFFFMlkyOXlaUzl0WlcxdmNua3ZjM1J2Y21VdmMybDRkR1ZsYmtKcGRGTjBiM0psU1c1MGIwZENUV1Z0YjNKNVYybDBhRlJ5WVhCejBnRXFZMjl5WlM5amNIVXZiM0JqYjJSbGN5OXphWGgwWldWdVFtbDBVM1J2Y21WVGVXNWpRM2xqYkdWejB3RTBZMjl5WlM5amNIVXZabXhoWjNNdlkyaGxZMnRCYm1SVFpYUlRhWGgwWldWdVFtbDBSbXhoWjNOQlpHUlBkbVZ5Wm14dmQ5UUJKMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZaV2xuYUhSQ2FYUk1iMkZrVTNsdVkwTjVZMnhsYzlVQkltTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXliM1JoZEdWQ2VYUmxVbWxuYUhUV0FSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVEI0MXdFYlkyOXlaUzlqY0hVdlpteGhaM012WjJWMFEyRnljbmxHYkdGbjJBRXRZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM0p2ZEdGMFpVSjVkR1ZNWldaMFZHaHliM1ZuYUVOaGNuSjUyUUVoWTI5eVpTOXdiM0owWVdKc1pTOXdiM0owWVdKc1pTOXBPRkJ2Y25SaFlteGwyZ0VpWTI5eVpTOWpjSFV2YVc1emRISjFZM1JwYjI1ekwzSmxiR0YwYVhabFNuVnRjTnNCTG1OdmNtVXZhR1ZzY0dWeWN5OXBibVJsZUM5eWIzUmhkR1ZDZVhSbFVtbG5hSFJVYUhKdmRXZG9RMkZ5Y25uY0FSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVEY0M1FFYVkyOXlaUzlqY0hVdlpteGhaM012WjJWMFdtVnliMFpzWVdmZUFSOWpiM0psTDJOd2RTOW1iR0ZuY3k5blpYUklZV3htUTJGeWNubEdiR0ZuM3dFZVkyOXlaUzlqY0hVdlpteGhaM012WjJWMFUzVmlkSEpoWTNSR2JHRm40QUVmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVeWVPRUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsTTNqaUFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVFI0NHdFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTFlT1FCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE5uamxBUnRqYjNKbEwyTndkUzlqY0hVdlEzQjFMbVZ1WVdKc1pVaGhiSFRtQVI5amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJoaGJtUnNaVTl3WTI5a1pUZDQ1d0VyWTI5eVpTOWpjSFV2Wm14aFozTXZZMmhsWTJ0QmJtUlRaWFJGYVdkb2RFSnBkRU5oY25KNVJteGhaK2dCSW1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWhaR1JCVW1WbmFYTjBaWExwQVM1amIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZZV1JrUVZSb2NtOTFaMmhEWVhKeWVWSmxaMmx6ZEdWeTZnRWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1U0ZU9zQkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6ZFdKQlVtVm5hWE4wWlhMc0FTNWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzNWaVFWUm9jbTkxWjJoRFlYSnllVkpsWjJsemRHVnk3UUVmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVNWVPNEJJbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5aGJtUkJVbVZuYVhOMFpYTHZBU0pqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmVHOXlRVkpsWjJsemRHVnk4QUVmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdWQmVQRUJJV052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5dmNrRlNaV2RwYzNSbGN2SUJJV052Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5amNFRlNaV2RwYzNSbGN2TUJIMk52Y21VdlkzQjFMMjl3WTI5a1pYTXZhR0Z1Wkd4bFQzQmpiMlJsUW5qMEFTdGpiM0psTDIxbGJXOXllUzlzYjJGa0wzTnBlSFJsWlc1Q2FYUk1iMkZrUm5KdmJVZENUV1Z0YjNKNTlRRXBZMjl5WlM5amNIVXZiM0JqYjJSbGN5OXphWGgwWldWdVFtbDBURzloWkZONWJtTkRlV05zWlhQMkFTaGpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSk1aV1owOXdFcFkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM0p2ZEdGMFpWSmxaMmx6ZEdWeVVtbG5hSFQ0QVRSamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZjbTkwWVhSbFVtVm5hWE4wWlhKTVpXWjBWR2h5YjNWbmFFTmhjbko1K1FFMVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM0p2ZEdGMFpWSmxaMmx6ZEdWeVVtbG5hSFJVYUhKdmRXZG9RMkZ5Y25uNkFTZGpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUk1aV1owVW1WbmFYTjBaWEw3QVRKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZjMmhwWm5SU2FXZG9kRUZ5YVhSb2JXVjBhV05TWldkcGMzUmxjdndCSzJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXpkMkZ3VG1saVlteGxjMDl1VW1WbmFYTjBaWEw5QVM5amIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZjMmhwWm5SU2FXZG9kRXh2WjJsallXeFNaV2RwYzNSbGN2NEJKMk52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5MFpYTjBRbWwwVDI1U1pXZHBjM1JsY3Y4QkptTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6WlhSQ2FYUlBibEpsWjJsemRHVnlnQUloWTI5eVpTOWpjSFV2WTJKUGNHTnZaR1Z6TDJoaGJtUnNaVU5pVDNCamIyUmxnUUlmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdWRGVJSUNLR052Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMM05sZEVsdWRHVnljblZ3ZEhPREFoOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVVI0aEFJZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkZlSVVDSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFJuaUdBaDVqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMlY0WldOMWRHVlBjR052WkdXSEFpQmpiM0psTDJOd2RTOWpjSFV2UTNCMUxtVjRhWFJJWVd4MFFXNWtVM1J2Y0lnQ0dXTnZjbVV2WTNCMUwyTndkUzlEY0hVdWFYTklZV3gwWldTSkFpMWpiM0psTDIxbGJXOXllUzl6ZEc5eVpTOXphWGgwWldWdVFtbDBVM1J2Y21WSmJuUnZSMEpOWlcxdmNubUtBaXRqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTlmYUdGdVpHeGxTVzUwWlhKeWRYQjBpd0lxWTI5eVpTOXBiblJsY25KMWNIUnpMMmx1ZEdWeWNuVndkSE12WTJobFkydEpiblJsY25KMWNIUnpqQUlhWTI5eVpTOWxlR1ZqZFhSbEwzUnlZV05yVTNSbGNITlNZVzZOQWhoamIzSmxMMlY0WldOMWRHVXZaWGhsWTNWMFpWTjBaWENPQWlWamIzSmxMMk53ZFM5amNIVXZRM0IxTGsxQldGOURXVU5NUlZOZlVFVlNYMFpTUVUxRmp3SXdZMjl5WlM5emIzVnVaQzl6YjNWdVpDOW5aWFJPZFcxaVpYSlBabE5oYlhCc1pYTkpia0YxWkdsdlFuVm1abVZ5a0FJaVkyOXlaUzlsZUdWamRYUmxMMlY0WldOMWRHVlZiblJwYkVOdmJtUnBkR2x2YnBFQ0dXTnZjbVV2WlhobFkzVjBaUzlsZUdWamRYUmxSbkpoYldXU0FpSmpiM0psTDJWNFpXTjFkR1V2WlhobFkzVjBaVTExYkhScGNHeGxSbkpoYldWemt3SW1ZMjl5WlM5bGVHVmpkWFJsTDJWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVytVQWloamIzSmxMMlY0WldOMWRHVXZaWGhsWTNWMFpVWnlZVzFsVlc1MGFXeENjbVZoYTNCdmFXNTBsUUlnWTI5eVpTOWplV05zWlhNdloyVjBRM2xqYkdWelVHVnlRM2xqYkdWVFpYU1dBaGhqYjNKbEwyTjVZMnhsY3k5blpYUkRlV05zWlZObGRIT1hBaFZqYjNKbEwyTjVZMnhsY3k5blpYUkRlV05zWlhPWUFqUmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZYMmRsZEVwdmVYQmhaRUoxZEhSdmJsTjBZWFJsUm5KdmJVSjFkSFJ2Ymtsa21RSTBZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMMTl6WlhSS2IzbHdZV1JDZFhSMGIyNVRkR0YwWlVaeWIyMUNkWFIwYjI1SlpKb0NNV052Y21VdmFXNTBaWEp5ZFhCMGN5OXBiblJsY25KMWNIUnpMM0psY1hWbGMzUktiM2x3WVdSSmJuUmxjbkoxY0hTYkFpVmpiM0psTDJwdmVYQmhaQzlxYjNsd1lXUXZYM0J5WlhOelNtOTVjR0ZrUW5WMGRHOXVuQUluWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5eVpXeGxZWE5sU205NWNHRmtRblYwZEc5dW5RSWhZMjl5WlM5cWIzbHdZV1F2YW05NWNHRmtMM05sZEVwdmVYQmhaRk4wWVhSbG5nSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKQm53SWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKQ29BSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRG9RSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRW9nSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKRm93SWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKSXBBSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKTXBRSWhZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVtVm5hWE4wWlhKR3BnSW1ZMjl5WlM5a1pXSjFaeTlrWldKMVp5MWpjSFV2WjJWMFVISnZaM0poYlVOdmRXNTBaWEtuQWlSamIzSmxMMlJsWW5WbkwyUmxZblZuTFdOd2RTOW5aWFJUZEdGamExQnZhVzUwWlhLb0FpNWpiM0psTDJSbFluVm5MMlJsWW5WbkxXTndkUzluWlhSUGNHTnZaR1ZCZEZCeWIyZHlZVzFEYjNWdWRHVnlxUUlmWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFuY21Gd2FHbGpjeTluWlhSTVdhb0NOMk52Y21VdlpHVmlkV2N2WkdWaWRXY3RaM0poY0docFkzTXZaSEpoZDBKaFkydG5jbTkxYm1STllYQlViMWRoYzIxTlpXMXZjbm1yQWpKamIzSmxMMlJsWW5WbkwyUmxZblZuTFdkeVlYQm9hV056TDJSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllYXdDSFdOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0ZEdsdFpYSXZaMlYwUkVsV3JRSWVZMjl5WlM5a1pXSjFaeTlrWldKMVp5MTBhVzFsY2k5blpYUlVTVTFCcmdJZFkyOXlaUzlrWldKMVp5OWtaV0oxWnkxMGFXMWxjaTluWlhSVVRVR3ZBaDFqYjNKbEwyUmxZblZuTDJSbFluVm5MWFJwYldWeUwyZGxkRlJCUTdBQ0JYTjBZWEowc1FJeFkyOXlaUzlsZUdWamRYUmxMMlY0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOThkSEpoYlhCdmJHbHVaYklDQ0g1elpYUmhjbWRqc3dJdFkyOXlaUzlsZUdWamRYUmxMMlY0WldOMWRHVlZiblJwYkVOdmJtUnBkR2x2Ym54MGNtRnRjRzlzYVc1bEFETVFjMjkxY21ObFRXRndjR2x1WjFWU1RDRmpiM0psTDJScGMzUXZZMjl5WlM1MWJuUnZkV05vWldRdWQyRnpiUzV0WVhBPSIpOgphd2FpdCBMKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmZoQmdDWDkvZjM5L2YzOS9md0JnQUFCZ0FYOEJmMkFDZjM4QVlBRi9BR0FDZjM4QmYyQUFBWDlnQTM5L2Z3Ri9ZQU4vZjM4QVlBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCSDkvZjM4QVlBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FBTzJBclFDQWdJQ0FnRUJBd0VCQVFFQkFRRUJBUVVFQkFFQkJBRUJBUUFHQlFNQkFRRUJBUUVCQVFFQkFRRUNBUVFCQVFRQkFRRUJBUUVCQVFFQkJnWUdBZ1lHQlFVTEJRVUZCUXNLQlFVRkJ3VUhCd3dLRFFrSkNBZ0RCQUVCQVFZR0JBRUdCZ0VCQVFFR0JBRUJBUUVCQWdJQ0FnSUNBUVVDQmdFQ0JnRUNBZ1lHQWdZR0JnVU9DQVFDQWdRRUFRSUdBZ0lEQkFRRUJBUUVCQVFFQkFRRUJBUUVBUVFCQkFFRUFRUUVCQVVFQkFZR0JBZ0RBd0VDQlFFRUFRUUVCQVFGQXdnQkFRRUVBUVFFQmdZR0F3VUVBd1FFQkFJREF3Z0NBZ0lHQWdJRUFnSUdCZ1lDQWdJQ0FnRUNBd1FFQWdRRUFnUUVBZ1FFQWdJQ0FnSUNBZ0lDQWdJRkJ3SUNCQUlDQWdJQkJnTUVCZ1FHQmdZSEJnSUNBZ1lHQmdJREFRUUVEd1lHQmdZR0JnWUdCZ1lHQmdRQkJnWUdCZ0VDQkFjRkF3RUFBQWFUQzRVQ2Z3QkJBQXQvQUVHQWdLd0VDMzhBUVlzQkMzOEFRUUFMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQWdMZndCQmdCQUxmd0JCLy84REMzOEFRWUFRQzM4QVFZQ0FBUXQvQUVHQWtBRUxmd0JCZ0lBQ0MzOEFRWUNRQXd0L0FFR0FnQUVMZndCQmdKQUVDMzhBUVlEb0h3dC9BRUdBa0FRTGZ3QkJnQVFMZndCQmdLQUVDMzhBUVlDNEFRdC9BRUdBMkFVTGZ3QkJnTmdGQzM4QVFZQ1lEZ3QvQUVHQWdBd0xmd0JCZ0pnYUMzOEFRWUNBQ1F0L0FFR0FtQ01MZndCQmdPQUFDMzhBUVlENEl3dC9BRUdBZ0FnTGZ3QkJnUGdyQzM4QVFZQ0FDQXQvQUVHQStETUxmd0JCZ0lqNEF3dC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWMvK0F3dC9BVUVBQzM4QlFmRCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUThMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIL0FBdC9BVUgvQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQmdLald1UWNMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWDhMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBOXdJTGZ3RkJnSUFJQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkIxZjREQzM4QlFkSCtBd3QvQVVIUy9nTUxmd0ZCMC80REMzOEJRZFQrQXd0L0FVSG8vZ01MZndGQjYvNERDMzhCUWVuK0F3dC9BRUdBZ0t3RUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBUUMzOEFRZi8vQXd0L0FFR0FrQVFMZndCQmdKQUVDMzhBUVlBRUMzOEFRWURZQlF0L0FFR0FtQTRMZndCQmdKZ2FDMzhBUVlENEl3dC9BRUdBK0NzTGZ3QkJnUGd6QzM4QlFRQUxCOFVQWFFadFpXMXZjbmtDQUFaamIyNW1hV2NBR1E1b1lYTkRiM0psVTNSaGNuUmxaQUFhQ1hOaGRtVlRkR0YwWlFBb0NXeHZZV1JUZEdGMFpRQTRFbWRsZEZOMFpYQnpVR1Z5VTNSbGNGTmxkQUE1QzJkbGRGTjBaWEJUWlhSekFEb0laMlYwVTNSbGNITUFPeFZsZUdWamRYUmxUWFZzZEdsd2JHVkdjbUZ0WlhNQWtnSU1aWGhsWTNWMFpVWnlZVzFsQUpFQ0NGOXpaWFJoY21kakFMSUNHV1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOEFzUUliWlhobFkzVjBaVVp5WVcxbFZXNTBhV3hDY21WaGEzQnZhVzUwQUpRQ0ZXVjRaV04xZEdWVmJuUnBiRU52Ym1ScGRHbHZiZ0N6QWd0bGVHVmpkWFJsVTNSbGNBQ05BaFJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFDVkFneG5aWFJEZVdOc1pWTmxkSE1BbGdJSloyVjBRM2xqYkdWekFKY0NEbk5sZEVwdmVYQmhaRk4wWVhSbEFKMENIMmRsZEU1MWJXSmxjazltVTJGdGNHeGxjMGx1UVhWa2FXOUNkV1ptWlhJQWp3SVFZMnhsWVhKQmRXUnBiMEoxWm1abGNnQXlGMWRCVTAxQ1QxbGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3QVRWMEZUVFVKUFdWOU5SVTFQVWxsZlUwbGFSUU1CRWxkQlUwMUNUMWxmVjBGVFRWOVFRVWRGVXdNQ0hrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01ER2tGVFUwVk5Ra3haVTBOU1NWQlVYMDFGVFU5U1dWOVRTVnBGQXdRV1YwRlRUVUpQV1Y5VFZFRlVSVjlNVDBOQlZFbFBUZ01GRWxkQlUwMUNUMWxmVTFSQlZFVmZVMGxhUlFNR0lFZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdjY1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVTBsYVJRTUlFbFpKUkVWUFgxSkJUVjlNVDBOQlZFbFBUZ01KRGxaSlJFVlBYMUpCVFY5VFNWcEZBd29SVjA5U1MxOVNRVTFmVEU5RFFWUkpUMDREQ3cxWFQxSkxYMUpCVFY5VFNWcEZBd3dtVDFSSVJWSmZSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RERTSlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3NFlSMUpCVUVoSlExTmZUMVZVVUZWVVgweFBRMEZVU1U5T0F3OFVSMUpCVUVoSlExTmZUMVZVVUZWVVgxTkpXa1VERUJSSFFrTmZVRUZNUlZSVVJWOU1UME5CVkVsUFRnTVJFRWRDUTE5UVFVeEZWRlJGWDFOSldrVURFaGhDUjE5UVVrbFBVa2xVV1Y5TlFWQmZURTlEUVZSSlQwNERFeFJDUjE5UVVrbFBVa2xVV1Y5TlFWQmZVMGxhUlFNVURrWlNRVTFGWDB4UFEwRlVTVTlPQXhVS1JsSkJUVVZmVTBsYVJRTVdGMEpCUTB0SFVrOVZUa1JmVFVGUVgweFBRMEZVU1U5T0F4Y1RRa0ZEUzBkU1QxVk9SRjlOUVZCZlUwbGFSUU1ZRWxSSlRFVmZSRUZVUVY5TVQwTkJWRWxQVGdNWkRsUkpURVZmUkVGVVFWOVRTVnBGQXhvU1QwRk5YMVJKVEVWVFgweFBRMEZVU1U5T0F4c09UMEZOWDFSSlRFVlRYMU5KV2tVREhCVkJWVVJKVDE5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESFJGQlZVUkpUMTlDVlVaR1JWSmZVMGxhUlFNZUZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRESHhKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVRElCWkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXlFU1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5SWhaMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBSU1aMlYwVW1WbmFYTjBaWEpCQUo0Q0RHZGxkRkpsWjJsemRHVnlRZ0NmQWd4blpYUlNaV2RwYzNSbGNrTUFvQUlNWjJWMFVtVm5hWE4wWlhKRUFLRUNER2RsZEZKbFoybHpkR1Z5UlFDaUFneG5aWFJTWldkcGMzUmxja2dBb3dJTVoyVjBVbVZuYVhOMFpYSk1BS1FDREdkbGRGSmxaMmx6ZEdWeVJnQ2xBaEZuWlhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0NtQWc5blpYUlRkR0ZqYTFCdmFXNTBaWElBcHdJWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dDb0FnVm5aWFJNV1FDcEFoMWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllUUNxQWhoa2NtRjNWR2xzWlVSaGRHRlViMWRoYzIxTlpXMXZjbmtBcXdJR1oyVjBSRWxXQUt3Q0IyZGxkRlJKVFVFQXJRSUdaMlYwVkUxQkFLNENCbWRsZEZSQlF3Q3ZBZ1oxY0dSaGRHVUFrUUlOWlcxMWJHRjBhVzl1VTNSbGNBQ05BaEpuWlhSQmRXUnBiMUYxWlhWbFNXNWtaWGdBandJUGNtVnpaWFJCZFdScGIxRjFaWFZsQURJT2QyRnpiVTFsYlc5eWVWTnBlbVVEOWdFY2QyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVk1iMk5oZEdsdmJnUDNBUmgzWVhOdFFtOTVTVzUwWlhKdVlXeFRkR0YwWlZOcGVtVUQrQUVkWjJGdFpVSnZlVWx1ZEdWeWJtRnNUV1Z0YjNKNVRHOWpZWFJwYjI0RCtRRVpaMkZ0WlVKdmVVbHVkR1Z5Ym1Gc1RXVnRiM0o1VTJsNlpRUDZBUk4yYVdSbGIwOTFkSEIxZEV4dlkyRjBhVzl1QS9zQkltWnlZVzFsU1c1UWNtOW5jbVZ6YzFacFpHVnZUM1YwY0hWMFRHOWpZWFJwYjI0RC9nRWJaMkZ0WldKdmVVTnZiRzl5VUdGc1pYUjBaVXh2WTJGMGFXOXVBL3dCRjJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWVGFYcGxBLzBCRldKaFkydG5jbTkxYm1STllYQk1iMk5oZEdsdmJnUC9BUXQwYVd4bFJHRjBZVTFoY0FPQUFoTnpiM1Z1WkU5MWRIQjFkRXh2WTJGMGFXOXVBNEVDRVdkaGJXVkNlWFJsYzB4dlkyRjBhVzl1QTRNQ0ZHZGhiV1ZTWVcxQ1lXNXJjMHh2WTJGMGFXOXVBNElDQ0FLd0FncnN5d0cwQWlzQkFuOGpMU0VCSXk1RklnSUVRQ0FCUlNFQ0N5QUNCRUJCQVNFQkN5QUJRUTUwSUFCQmdJQUJhMm9MRHdBak1VRU5kQ0FBUVlEQUFtdHFDN2NCQVFKL0FrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFTWRTSUNJUUVnQWtVTkFBSkFJQUZCQVdzT0RRRUJBUUlDQWdJREF3UUVCUVlBQ3d3R0N5QUFRWUQ0TTJvUEN5QUFFQUJCZ1BnemFnOExRUUFoQVNNdkJFQWpNQkFEUVFGeElRRUxJQUJCZ0pCK2FpQUJRUTEwYWc4TElBQVFBVUdBK0N0cUR3c2dBRUdBa0g1cUR3dEJBQ0VCSXk4RVFDTXlFQU5CQjNFaEFRc2dBVUVCU0FSQVFRRWhBUXNnQUNBQlFReDBha0dBOEgxcUR3c2dBRUdBVUdvTENRQWdBQkFDTFFBQUM1a0JBRUVBSkROQkFDUTBRUUFrTlVFQUpEWkJBQ1EzUVFBa09FRUFKRGxCQUNRNlFRQWtPMEVBSkR4QkFDUTlRUUFrUGtFQUpEOUJBQ1JBUVFBa1FVRUFKRUlqTHdSQVFSRWtORUdBQVNRN1FRQWtOVUVBSkRaQi93RWtOMEhXQUNRNFFRQWtPVUVOSkRvRlFRRWtORUd3QVNRN1FRQWtOVUVUSkRaQkFDUTNRZGdCSkRoQkFTUTVRYzBBSkRvTFFZQUNKRDFCL3Y4REpEd0xwQUVCQW45QkFDUkRRUUVrUkVISEFoQURJUUZCQUNSRlFRQWtSa0VBSkVkQkFDUklRUUFrTGlBQkJFQWdBVUVCVGlJQUJFQWdBVUVEVENFQUN5QUFCRUJCQVNSR0JTQUJRUVZPSWdBRVFDQUJRUVpNSVFBTElBQUVRRUVCSkVjRklBRkJEMDRpQUFSQUlBRkJFMHdoQUFzZ0FBUkFRUUVrU0FVZ0FVRVpUaUlBQkVBZ0FVRWVUQ0VBQ3lBQUJFQkJBU1F1Q3dzTEN3VkJBU1JGQzBFQkpDMUJBQ1F4Q3dzQUlBQVFBaUFCT2dBQUN5OEFRZEgrQTBIL0FSQUdRZEwrQTBIL0FSQUdRZFArQTBIL0FSQUdRZFQrQTBIL0FSQUdRZFgrQTBIL0FSQUdDNWdCQUVFQUpFbEJBQ1JLUVFBa1MwRUFKRXhCQUNSTlFRQWtUa0VBSkU4akx3UkFRWkFCSkV0QndQNERRWkVCRUFaQndmNERRWUVCRUFaQnhQNERRWkFCRUFaQngvNERRZndCRUFZRlFaQUJKRXRCd1A0RFFaRUJFQVpCd2Y0RFFZVUJFQVpCeHY0RFFmOEJFQVpCeC80RFFmd0JFQVpCeVA0RFFmOEJFQVpCeWY0RFFmOEJFQVlMUWMvK0EwRUFFQVpCOFA0RFFRRVFCZ3RQQUNNdkJFQkI2UDREUWNBQkVBWkI2ZjREUWY4QkVBWkI2djREUWNFQkVBWkI2LzREUVEwUUJnVkI2UDREUWY4QkVBWkI2ZjREUWY4QkVBWkI2djREUWY4QkVBWkI2LzREUWY4QkVBWUxDeThBUVpEK0EwR0FBUkFHUVpIK0EwRy9BUkFHUVpMK0EwSHpBUkFHUVpQK0EwSEJBUkFHUVpUK0EwRy9BUkFHQ3l3QVFaWCtBMEgvQVJBR1FaYitBMEUvRUFaQmwvNERRUUFRQmtHWS9nTkJBQkFHUVpuK0EwRzRBUkFHQ3pJQVFacitBMEgvQUJBR1FaditBMEgvQVJBR1FaeitBMEdmQVJBR1FaMytBMEVBRUFaQm52NERRYmdCRUFaQkFTUmdDeTBBUVovK0EwSC9BUkFHUWFEK0EwSC9BUkFHUWFIK0EwRUFFQVpCb3Y0RFFRQVFCa0dqL2dOQnZ3RVFCZ3M0QUVFUEpHRkJEeVJpUVE4a1kwRVBKR1JCQUNSbFFRQWtaa0VBSkdkQkFDUm9RZjhBSkdsQi93QWtha0VCSkd0QkFTUnNRUUFrYlF0bkFFRUFKRkJCQUNSUlFRQWtVa0VCSkZOQkFTUlVRUUVrVlVFQkpGWkJBU1JYUVFFa1dFRUJKRmxCQVNSYVFRRWtXMEVBSkZ4QkFDUmRRUUFrWGtFQUpGOFFDaEFMRUF3UURVR2svZ05COXdBUUJrR2wvZ05COHdFUUJrR20vZ05COFFFUUJoQU9DdzBBSUFGQkFTQUFkSEZCQUVjTEpnQkJBQ0FBRUJBa2JrRUJJQUFRRUNSdlFRSWdBQkFRSkhCQkJDQUFFQkFrY1NBQUpISUxKZ0JCQUNBQUVCQWtjMEVCSUFBUUVDUjBRUUlnQUJBUUpIVkJCQ0FBRUJBa2RpQUFKSGNMR3dCQkFCQVJRZi8vQXlOeUVBWkI0UUVRRWtHUC9nTWpkeEFHQzFJQVFRQWtlRUVBSkhsQkFDUjZRUUFrZTBFQUpIeEJBQ1I5UVFBa2ZrRUFKSDhqTHdSQVFZVCtBMEVlRUFaQm9EMGtlUVZCaFA0RFFhc0JFQVpCek5jQ0pIa0xRWWYrQTBINEFSQUdRZmdCSkgwTENRQWdBRUVCY1NRakN4VUFRWUNvMXJrSEpJQUJRUUFrZ1FGQkFDU0NBUXNWQUVHQXFOYTVCeVNEQVVFQUpJUUJRUUFraFFFTHp3RUJBbjlCd3dJUUF5SUJRY0FCUmlJQVJRUkFJeVVFZnlBQlFZQUJSZ1VqSlFzaEFBc2dBQVJBUVFFa0x3VkJBQ1F2Q3hBRUVBVVFCeEFJRUFrUUR4QVRFQlFqTHdSQVFmRCtBMEg0QVJBR1FjLytBMEgrQVJBR1FjMytBMEgrQUJBR1FZRCtBMEhQQVJBR1FZTCtBMEg4QUJBR1FZLytBMEhoQVJBR1FleitBMEgrQVJBR1FmWCtBMEdQQVJBR0JVSHcvZ05CL3dFUUJrSFAvZ05CL3dFUUJrSE4vZ05CL3dFUUJrR0EvZ05CendFUUJrR0MvZ05CL2dBUUJrR1AvZ05CNFFFUUJndEJBQkFWRUJZUUZ3dWRBUUFnQUVFQVNnUkFRUUVrSkFWQkFDUWtDeUFCUVFCS0JFQkJBU1FsQlVFQUpDVUxJQUpCQUVvRVFFRUJKQ1lGUVFBa0pnc2dBMEVBU2dSQVFRRWtKd1ZCQUNRbkN5QUVRUUJLQkVCQkFTUW9CVUVBSkNnTElBVkJBRW9FUUVFQkpDa0ZRUUFrS1FzZ0JrRUFTZ1JBUVFFa0tnVkJBQ1FxQ3lBSFFRQktCRUJCQVNRckJVRUFKQ3NMSUFoQkFFb0VRRUVCSkN3RlFRQWtMQXNRR0FzTUFDTWpCRUJCQVE4TFFRQUxEZ0FnQUVHQUNHb2dBVUV5YkdvTEdRQWdBVUVCY1FSQUlBQkJBVG9BQUFVZ0FFRUFPZ0FBQ3d1akFRQkJBRUVBRUJzak5Eb0FBRUVCUVFBUUd5TTFPZ0FBUVFKQkFCQWJJelk2QUFCQkEwRUFFQnNqTnpvQUFFRUVRUUFRR3lNNE9nQUFRUVZCQUJBYkl6azZBQUJCQmtFQUVCc2pPam9BQUVFSFFRQVFHeU03T2dBQVFRaEJBQkFiSXp3N0FRQkJDa0VBRUJzalBUc0JBRUVNUVFBUUd5TStOZ0lBUVJGQkFCQWJJejhRSEVFU1FRQVFHeU5BRUJ4QkUwRUFFQnNqUVJBY1FSUkJBQkFiSTBJUUhBc2hBRUVBUVFFUUd5TktOZ0lBUVFSQkFSQWJJNFlCT2dBQVFjVCtBeU5MRUFZTEdBQkJBRUVDRUJzamh3RVFIRUVCUVFJUUd5T0lBUkFjQ3dNQUFRdGVBRUVBUVFRUUd5TXRPd0VBUVFKQkJCQWJJekU3QVFCQkJFRUVFQnNqUXhBY1FRVkJCQkFiSTBRUUhFRUdRUVFRR3lORkVCeEJCMEVFRUJzalJoQWNRUWhCQkJBYkkwY1FIRUVKUVFRUUd5TklFQnhCQ2tFRUVCc2pMaEFjQ3pRQVFRQkJCUkFiSTNnMkFnQkJCRUVGRUJzamVUWUNBRUVJUVFVUUd5TitFQnhCQzBFRkVCc2pmeEFjUVlYK0F5TjZFQVlMSXdCQkFFRUdFQnNqWERZQ0FFRUVRUVlRR3lOZE9nQUFRUVZCQmhBYkkxNDZBQUFMZUFCQkFFRUhFQnNqaVFFUUhFRUJRUWNRR3lPS0FUWUNBRUVGUVFjUUd5T0xBVFlDQUVFSlFRY1FHeU9NQVRZQ0FFRU9RUWNRR3lPTkFUWUNBRUVUUVFjUUd5T09BVG9BQUVFVVFRY1FHeU9QQVRvQUFFRVpRUWNRR3lPUUFSQWNRUnBCQnhBYkk1RUJOZ0lBUVI5QkJ4QWJJNUlCT3dFQUMxVUFRUUJCQ0JBYkk1TUJFQnhCQVVFSUVCc2psQUUyQWdCQkJVRUlFQnNqbFFFMkFnQkJDVUVJRUJzamxnRTJBZ0JCRGtFSUVCc2psd0UyQWdCQkUwRUlFQnNqbUFFNkFBQkJGRUVJRUJzam1RRTZBQUFMTVFCQkFFRUpFQnNqbWdFUUhFRUJRUWtRR3lPYkFUWUNBRUVGUVFrUUd5T2NBVFlDQUVFSlFRa1FHeU9kQVRzQkFBdEpBRUVBUVFvUUd5T2VBUkFjUVFGQkNoQWJJNThCTmdJQVFRVkJDaEFiSTZBQk5nSUFRUWxCQ2hBYkk2RUJOZ0lBUVE1QkNoQWJJNklCTmdJQVFSTkJDaEFiSTZNQk93RUFDeHdBRUIwUUhoQWZFQ0FRSVJBaUVDTVFKQkFsRUNZUUowRUFFQlVMRWdBZ0FDMEFBRUVBU2dSQVFRRVBDMEVBQzZNQkFFRUFRUUFRR3kwQUFDUTBRUUZCQUJBYkxRQUFKRFZCQWtFQUVCc3RBQUFrTmtFRFFRQVFHeTBBQUNRM1FRUkJBQkFiTFFBQUpEaEJCVUVBRUJzdEFBQWtPVUVHUVFBUUd5MEFBQ1E2UVFkQkFCQWJMUUFBSkR0QkNFRUFFQnN2QVFBa1BFRUtRUUFRR3k4QkFDUTlRUXhCQUJBYktBSUFKRDVCRVVFQUVCc1FLU1EvUVJKQkFCQWJFQ2trUUVFVFFRQVFHeEFwSkVGQkZFRUFFQnNRS1NSQ0Mwb0FRUWNnQUJBUUpLUUJRUVlnQUJBUUpLVUJRUVVnQUJBUUpLWUJRUVFnQUJBUUpLY0JRUU1nQUJBUUpLZ0JRUUlnQUJBUUpLa0JRUUVnQUJBUUpLb0JRUUFnQUJBUUpLc0JDeWtBUVFCQkFSQWJLQUlBSkVwQkJFRUJFQnN0QUFBa2hnRkJ4UDRERUFNa1MwSEEvZ01RQXhBckN5Z0FRUUJCQWhBYkVDa2tod0ZCQVVFQ0VCc1FLU1NJQVVILy93TVFBeEFSUVkvK0F4QURFQklMSHdBZ0FFSC9BWE1rckFGQkJDT3NBUkFRSkswQlFRVWpyQUVRRUNTdUFRc0tBRUdBL2dNUUF4QXVDMTRBUVFCQkJCQWJMd0VBSkMxQkFrRUVFQnN2QVFBa01VRUVRUVFRR3hBcEpFTkJCVUVFRUJzUUtTUkVRUVpCQkJBYkVDa2tSVUVIUVFRUUd4QXBKRVpCQ0VFRUVCc1FLU1JIUVFsQkJCQWJFQ2trU0VFS1FRUVFHeEFwSkM0TFJBQkJBRUVGRUJzb0FnQWtlRUVFUVFVUUd5Z0NBQ1I1UVFoQkJSQWJFQ2trZmtFTFFRVVFHeEFwSkg5QmhmNERFQU1rZWtHRy9nTVFBeVI3UVlmK0F4QURKSDBMQmdCQkFDUmZDeVVBUVFCQkJoQWJLQUlBSkZ4QkJFRUdFQnN0QUFBa1hVRUZRUVlRR3kwQUFDUmVFRElMZUFCQkFFRUhFQnNRS1NTSkFVRUJRUWNRR3lnQ0FDU0tBVUVGUVFjUUd5Z0NBQ1NMQVVFSlFRY1FHeWdDQUNTTUFVRU9RUWNRR3lnQ0FDU05BVUVUUVFjUUd5MEFBQ1NPQVVFVVFRY1FHeTBBQUNTUEFVRVpRUWNRR3hBcEpKQUJRUnBCQnhBYktBSUFKSkVCUVI5QkJ4QWJMd0VBSkpJQkMxVUFRUUJCQ0JBYkVDa2trd0ZCQVVFSUVCc29BZ0FrbEFGQkJVRUlFQnNvQWdBa2xRRkJDVUVJRUJzb0FnQWtsZ0ZCRGtFSUVCc29BZ0FrbHdGQkUwRUlFQnN0QUFBa21BRkJGRUVJRUJzdEFBQWttUUVMTVFCQkFFRUpFQnNRS1NTYUFVRUJRUWtRR3lnQ0FDU2JBVUVGUVFrUUd5Z0NBQ1NjQVVFSlFRa1FHeThCQUNTZEFRdEpBRUVBUVFvUUd4QXBKSjRCUVFGQkNoQWJLQUlBSko4QlFRVkJDaEFiS0FJQUpLQUJRUWxCQ2hBYktBSUFKS0VCUVE1QkNoQWJLQUlBSktJQlFSTkJDaEFiTHdFQUpLTUJDeUFBRUNvUUxCQXRFQzhRTUJBeEVETVFOQkExRURZUU4wRUFFQlVRRmhBWEN3VUFJNE1CQ3dVQUk0UUJDd1VBSTRVQkN3a0FJQUJCLy84RGNRc21BQ016QkVBalMwR1pBVVlFUUVFSUR3dEJrQWNQQ3lOTFFaa0JSZ1JBUVFRUEMwSElBd3NFQUJBOUN4VUFJQUJCZ0pCK2FpQUJRUUZ4UVExMGFpMEFBQXNPQUNBQlFhQUJiQ0FBYWtFRGJBc1ZBQ0FBSUFFUVFFR0EyQVZxSUFKcUlBTTZBQUFMQ3dBZ0FVR2dBV3dnQUdvTEVBQWdBQ0FCRUVKQmdLQUVhaTBBQUFzTkFDQUJRUUVnQUhSQmYzTnhDd29BSUFGQkFTQUFkSElMS3dFQmZ5QUNRUU54SVFRZ0EwRUJjUVJBUVFJZ0JCQkZJUVFMSUFBZ0FSQkNRWUNnQkdvZ0JEb0FBQXV1QWdFRGZ5QUJRUUJLSWdNRVFDQUFRUWhLSVFNTElBTUVRQ0FHSTdBQlJpRURDeUFEQkVBZ0FDT3hBVVloQXdzZ0F3UkFRUUFoQTBFQUlRWkJCU0FFUVFGckVBTVFFQVJBUVFFaEF3dEJCU0FFRUFNUUVBUkFRUUVoQmdzQ1FFRUFJUVFEUUNBRVFRaE9EUUVnQXlBR1J3UkFRUWNnQkdzaEJBc2dBQ0FFYWtHZ0FVd0VRQ0FBUVFnZ0JHdHJJUWdnQUNBRWFpQUJFRUJCZ05nRmFpRUpBa0JCQUNFRkEwQWdCVUVEVGcwQklBQWdCR29nQVNBRklBa2dCV290QUFBUVFTQUZRUUZxSVFVTUFBQUxBQXNnQUNBRWFpQUJRUUlnQ0NBQkVFTWlCUkJFUVFJZ0JSQVFFRVlnQjBFQmFpRUhDeUFFUVFGcUlRUU1BQUFMQUFzRklBWWtzQUVMSUFBanNRRk9CRUFnQUVFSWFpU3hBU0FBSUFKQkNHOGlCa2dFUUNPeEFTQUdhaVN4QVFzTElBY0xPQUVCZnlBQVFZQ1FBa1lFUUNBQlFZQUJhaUVDUVFjZ0FSQVFCRUFnQVVHQUFXc2hBZ3NnQUNBQ1FRUjBhZzhMSUFBZ0FVRUVkR29MSkFFQmZ5QUFRVDl4SVFJZ0FVRUJjUVJBSUFKQlFHc2hBZ3NnQWtHQWtBUnFMUUFBQ3hJQUlBQkIvd0Z4UVFoMElBRkIvd0Z4Y2dzZ0FRRi9JQUJCQTNRZ0FVRUJkR29pQTBFQmFpQUNFRWtnQXlBQ0VFa1FTZ3NWQUNBQlFSOGdBRUVGYkNJQWRIRWdBSFZCQTNRTFdRQWdBa0VCY1VVRVFDQUJFQU1nQUVFQmRIVkJBM0VoQUF0QjhnRWhBUUpBQWtBQ1FBSkFBa0FnQUVVTkJBSkFJQUJCQVdzT0F3SURCQUFMREFRQUN3QUxRYUFCSVFFTUFndEIyQUFoQVF3QkMwRUlJUUVMSUFFTERRQWdBU0FDYkNBQWFrRURiQXVyQWdFR2Z5QUJJQUFRU0NBRlFRRjBhaUlBSUFJUVB5RVJJQUJCQVdvZ0FoQS9JUklDUUNBRElRQURRQ0FBSUFSS0RRRWdCaUFBSUFOcmFpSU9JQWhJQkVBZ0FDRUJJQXhCQUVnaUFrVUVRRUVGSUF3UUVFVWhBZ3NnQWdSQVFRY2dBV3NoQVF0QkFDRUNJQUVnRWhBUUJFQkJBaUVDQ3lBQklCRVFFQVJBSUFKQkFXb2hBZ3NnREVFQVRnUi9RUUFnREVFSGNTQUNRUUFRU3lJRkVFd2hEMEVCSUFVUVRDRUJRUUlnQlJCTUJTQUxRUUJNQkVCQngvNERJUXNMSUFJZ0N5QUtFRTBpQlNFUElBVWlBUXNoQlNBSklBNGdCeUFJRUU1cUloQWdEem9BQUNBUVFRRnFJQUU2QUFBZ0VFRUNhaUFGT2dBQVFRQWhBU0FNUVFCT0JFQkJCeUFNRUJBaEFRc2dEaUFISUFJZ0FSQkdJQTFCQVdvaERRc2dBRUVCYWlFQURBQUFDd0FMSUEwTGhRRUJBMzhnQTBFSWJ5RURJQUJGQkVBZ0FpQUNRUWh0UVFOMGF5RUhDMEVISVFnZ0FFRUlha0dnQVVvRVFFR2dBU0FBYXlFSUMwRi9JUUlqTHdSQVFRTWdCRUVCRUQ4aUFrSC9BWEVRRUFSQVFRRWhDUXRCQmlBQ0VCQUVRRUVISUFOcklRTUxDeUFHSUFVZ0NTQUhJQWdnQXlBQUlBRkJvQUZCZ05nRlFRQkJBQ0FDRUU4TDNRRUFJQVVnQmhCSUlRWWdCRUVCRUQ4aEJDQURRUWh2SVFOQkJpQUVFQkFFUUVFSElBTnJJUU1MUVFBaEJVRURJQVFRRUFSQVFRRWhCUXNnQmlBRFFRRjBhaUlESUFVUVB5RUdJQU5CQVdvZ0JSQS9JUVVnQWtFSWJ5RURRUVVnQkJBUVJRUkFRUWNnQTJzaEF3dEJBQ0VDSUFNZ0JSQVFCRUJCQWlFQ0N5QURJQVlRRUFSQUlBSkJBV29oQWd0QkFDQUVRUWR4SUFKQkFCQkxJZ01RVENFRlFRRWdBeEJNSVFaQkFpQURFRXdoQXlBQUlBRkJBQ0FGRUVFZ0FDQUJRUUVnQmhCQklBQWdBVUVDSUFNUVFTQUFJQUVnQWtFSElBUVFFQkJHQzM4QUlBUWdCUkJJSUFOQkNHOUJBWFJxSWdSQkFCQS9JUVZCQUNFRElBUkJBV3BCQUJBL0lRUkJCeUFDUVFodmF5SUNJQVFRRUFSQVFRSWhBd3NnQWlBRkVCQUVRQ0FEUVFGcUlRTUxJQUFnQVVFQUlBTkJ4LzREUVFBUVRTSUNFRUVnQUNBQlFRRWdBaEJCSUFBZ0FVRUNJQUlRUVNBQUlBRWdBMEVBRUVZTDNBRUJCbjhnQTBFRGRTRUxBa0FEUUNBRVFhQUJUZzBCSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUNJQXRCQlhScUlBWkJBM1ZxSWdsQkFCQS9JUWRCQUNFS0l5d0VRQ0FFSUFBZ0JpQURJQWtnQVNBSEVFY2lDRUVBU2dSQUlBUWdDRUVCYTJvaEJFRUJJUW9MQ3lNckJIOGdDa1VGSXlzTElnZ0VRQ0FFSUFBZ0JpQURJQWtnQVNBSEVGQWlDRUVBU2dSQUlBUWdDRUVCYTJvaEJBc0ZJQXBGQkVBakx3UkFJQVFnQUNBR0lBTWdDU0FCSUFjUVVRVWdCQ0FBSUFZZ0F5QUJJQWNRVWdzTEN5QUVRUUZxSVFRTUFBQUxBQXNMTEFFQ2Z5Tk1JUVFnQUNOTmFpSURRWUFDVGdSQUlBTkJnQUpySVFNTElBQWdBU0FDSUFOQkFDQUVFRk1MTUFFRGZ5Tk9JUU1nQUNOUElnUklCRUFQQ3lBRFFRZHJJZ05CZjJ3aEJTQUFJQUVnQWlBQUlBUnJJQU1nQlJCVEM0WUZBUkIvQWtCQkp5RUpBMEFnQ1VFQVNBMEJJQWxCQW5RaUEwR0EvQU5xRUFNaEFpQURRWUg4QTJvUUF5RUxJQU5CZ3Z3RGFoQURJUVFnQWtFUWF5RUNJQXRCQ0dzaEMwRUlJUVVnQVVFQmNRUkFRUkFoQlNBRVFRSnZRUUZHQkVBZ0JFRUJheUVFQ3dzZ0FDQUNUaUlHQkVBZ0FDQUNJQVZxU0NFR0N5QUdCRUJCQnlBRFFZUDhBMm9RQXlJR0VCQWhERUVHSUFZUUVDRURRUVVnQmhBUUlROGdBQ0FDYXlFQ0lBTUVRQ0FDSUFWclFYOXNRUUZySVFJTFFZQ0FBaUFFRUVnZ0FrRUJkR29oQkVFQUlRSWpMd1IvUVFNZ0JoQVFCU012Q3lJREJFQkJBU0VDQ3lBRUlBSVFQeUVRSUFSQkFXb2dBaEEvSVJFQ1FFRUhJUVVEUUNBRlFRQklEUUVnQlNFQ0lBOEVRQ0FDUVFkclFYOXNJUUlMUVFBaENDQUNJQkVRRUFSQVFRSWhDQXNnQWlBUUVCQUVRQ0FJUVFGcUlRZ0xJQWdFUUNBTFFRY2dCV3RxSWdkQkFFNGlBZ1JBSUFkQm9BRk1JUUlMSUFJRVFFRUFJUUpCQUNFTlFRQWhEaU12Qkg4anF3RkZCU012Q3lJRUJFQkJBU0VDQ3lBQ1JRUkFJQWNnQUJCRElncEJBM0VoQXlBTUJIOGdBMEVBU2dVZ0RBc2lCQVJBUVFFaERRVWpMd1IvUVFJZ0NoQVFCU012Q3lJRUJFQWdBMEVBU2lFRUN5QUVCRUJCQVNFT0N3c0xJQUpGQkVBZ0RVVWlBd1IvSUE1RkJTQURDeUVDQ3lBQ0JFQWpMd1JBUVFBZ0JrRUhjU0FJUVFFUVN5SURFRXdoQkVFQklBTVFUQ0VDUVFJZ0F4Qk1JUU1nQnlBQVFRQWdCQkJCSUFjZ0FFRUJJQUlRUVNBSElBQkJBaUFERUVFRlFjaitBeUVEUVFRZ0JoQVFCRUJCeWY0RElRTUxJQWNnQUVFQUlBZ2dBMEVBRUUwaUNoQkJJQWNnQUVFQklBb1FRU0FISUFCQkFpQUtFRUVMQ3dzTElBVkJBV3NoQlF3QUFBc0FDd3NnQ1VFQmF5RUpEQUFBQ3dBTEMyMEJBbjlCZ0pBQ0lRSWpwd0VFUUVHQWdBSWhBZ3NqTHdSL0l5OEZJNnNCQ3lJQkJFQkJnTEFDSVFFanFBRUVRRUdBdUFJaEFRc2dBQ0FDSUFFUVZBc2pwZ0VFUUVHQXNBSWhBU09sQVFSQVFZQzRBaUVCQ3lBQUlBSWdBUkJWQ3lPcUFRUkFJQUFqcVFFUVZnc0xKUUVCZndKQUEwQWdBRUdRQVVzTkFTQUFRZjhCY1JCWElBQkJBV29oQUF3QUFBc0FDd3RLQVFKL0FrQURRQ0FBUVpBQlRnMEJBa0JCQUNFQkEwQWdBVUdnQVU0TkFTQUJJQUFRUWtHQW9BUnFRUUE2QUFBZ0FVRUJhaUVCREFBQUN3QUxJQUJCQVdvaEFBd0FBQXNBQ3dzTUFFRi9KTEFCUVg4a3NRRUxEZ0FqTXdSQVFmQUZEd3RCK0FJTERnQWpNd1JBUWZJRER3dEIrUUVMR2dFQmZ5QUFRWS8rQXhBREVFVWlBU1IzUVkvK0F5QUJFQVlMQ2dCQkFTUjBRUUVRWFFzT0FDTXpCRUJCcmdFUEMwSFhBQXNRQUNNekJFQkJnSUFCRHd0QmdNQUFDeTRCQVg4ampBRkJBRW9pQUFSQUk3WUJJUUFMSUFBRVFDT01BVUVCYXlTTUFRc2pqQUZGQkVCQkFDU0pBUXNMTGdFQmZ5T1dBVUVBU2lJQUJFQWp0d0VoQUFzZ0FBUkFJNVlCUVFGckpKWUJDeU9XQVVVRVFFRUFKSk1CQ3dzdUFRRi9JNXdCUVFCS0lnQUVRQ080QVNFQUN5QUFCRUFqbkFGQkFXc2tuQUVMSTV3QlJRUkFRUUFrbWdFTEN5NEJBWDhqb1FGQkFFb2lBQVJBSTdrQklRQUxJQUFFUUNPaEFVRUJheVNoQVFzam9RRkZCRUJCQUNTZUFRc0xJZ0VCZnlPU0FTTzdBWFVoQUNPOEFRUi9JNUlCSUFCckJTT1NBU0FBYWdzaUFBdEZBUUovUVpUK0F4QURRZmdCY1NFQlFaUCtBeUFBUWY4QmNTSUNFQVpCbFA0RElBRWdBRUVJZFNJQWNoQUdJQUlrdlFFZ0FDUytBU08rQVVFSWRDTzlBWElrdndFTE9RRUNmeEJsSWdCQi93OU1JZ0VFUUNPN0FVRUFTaUVCQ3lBQkJFQWdBQ1NTQVNBQUVHWVFaU0VBQ3lBQVFmOFBTZ1JBUVFBa2lRRUxDeThBSTVFQlFRRnJKSkVCSTVFQlFRQk1CRUFqdWdFa2tRRWprQUVFZnlPNkFVRUFTZ1Vqa0FFTEJFQVFad3NMQzJBQkFYOGppd0ZCQVdza2l3RWppd0ZCQUV3RVFDUEFBU1NMQVNPTEFRUkFJOEVCQkg4ampRRkJEMGdGSThFQkN5SUFCRUFqalFGQkFXb2tqUUVGSThFQlJTSUFCRUFqalFGQkFFb2hBQXNnQUFSQUk0MEJRUUZySkkwQkN3c0xDd3RnQVFGL0k1VUJRUUZySkpVQkk1VUJRUUJNQkVBandnRWtsUUVqbFFFRVFDUERBUVIvSTVjQlFROUlCU1BEQVFzaUFBUkFJNWNCUVFGcUpKY0JCU1BEQVVVaUFBUkFJNWNCUVFCS0lRQUxJQUFFUUNPWEFVRUJheVNYQVFzTEN3c0xZQUVCZnlPZ0FVRUJheVNnQVNPZ0FVRUFUQVJBSThRQkpLQUJJNkFCQkVBanhRRUVmeU9pQVVFUFNBVWp4UUVMSWdBRVFDT2lBVUVCYWlTaUFRVWp4UUZGSWdBRVFDT2lBVUVBU2lFQUN5QUFCRUFqb2dGQkFXc2tvZ0VMQ3dzTEM0MEJBUUYvSTF3Z0FHb2tYQ05jRUdCT0JFQWpYQkJnYXlSY0FrQUNRQUpBQWtBQ1FDTmVJZ0VFUUFKQUlBRkJBbXNPQmdJQUF3QUVCUUFMREFVTEVHRVFZaEJqRUdRTUJBc1FZUkJpRUdNUVpCQm9EQU1MRUdFUVloQmpFR1FNQWdzUVlSQmlFR01RWkJCb0RBRUxFR2tRYWhCckN5TmVRUUZxSkY0alhrRUlUZ1JBUVFBa1hndEJBUThMUVFBTEhRQWp4Z0VnQUdva3hnRWppZ0VqeGdGclFRQktCRUJCQUE4TFFRRUxnd0VCQVg4Q1FBSkFBa0FDUUNBQVFRRkhCRUFnQUNJQlFRSkdEUUVnQVVFRFJnMENJQUZCQkVZTkF3d0VDeU5sSThjQlJ3UkFJOGNCSkdWQkFROExRUUFQQ3lObUk4Z0JSd1JBSThnQkpHWkJBUThMUVFBUEN5Tm5JOGtCUndSQUk4a0JKR2RCQVE4TFFRQVBDeU5vSThvQlJ3UkFJOG9CSkdoQkFROExRUUFQQzBFQUN4MEFJOHNCSUFCcUpNc0JJNVFCSThzQmEwRUFTZ1JBUVFBUEMwRUJDeWtBSTh3QklBQnFKTXdCSTVzQkk4d0JhMEVBU2lJQUJFQWpZRVVoQUFzZ0FBUkFRUUFQQzBFQkN4MEFJODBCSUFCcUpNMEJJNThCSTgwQmEwRUFTZ1JBUVFBUEMwRUJDeDBBUVlBUUk3OEJhMEVDZENTS0FTTXpCRUFqaWdGQkFYUWtpZ0VMQzBVQkFYOENRQUpBQWtBZ0FFRUJSd1JBSUFBaUFrRUNSZzBCSUFKQkEwWU5BZ3dEQ3lBQlFZRUJFQkFQQ3lBQlFZY0JFQkFQQ3lBQlFmNEFFQkFQQ3lBQlFRRVFFQXQvQVFGL0k0b0JJQUJySklvQkk0b0JRUUJNQkVBamlnRWhBQkJ5STRvQklBQkJBQ0FBYXlBQVFRQktHMnNraWdFamp3RkJBV29randFamp3RkJDRTRFUUVFQUpJOEJDd3NqaVFFRWZ5UEhBUVVqaVFFTElnQUVmeU9OQVFWQkR3OExJUUJCQVNFQkk4NEJJNDhCRUhORkJFQkJmeUVCQ3lBQklBQnNRUTlxQ3hJQkFYOGp4Z0VoQUVFQUpNWUJJQUFRZEFzZEFFR0FFQ1BQQVd0QkFuUWtsQUVqTXdSQUk1UUJRUUYwSkpRQkN3dC9BUUYvSTVRQklBQnJKSlFCSTVRQlFRQk1CRUFqbEFFaEFCQjJJNVFCSUFCQkFDQUFheUFBUVFCS0cyc2tsQUVqbVFGQkFXb2ttUUVqbVFGQkNFNEVRRUVBSkprQkN3c2prd0VFZnlQSUFRVWprd0VMSWdBRWZ5T1hBUVZCRHc4TElRQkJBU0VCSTlBQkk1a0JFSE5GQkVCQmZ5RUJDeUFCSUFCc1FROXFDeElCQVg4anl3RWhBRUVBSk1zQklBQVFkd3NkQUVHQUVDUFJBV3RCQVhRa213RWpNd1JBSTVzQlFRRjBKSnNCQ3dzRUFDQUFDNGdDQVFKL0k1c0JJQUJySkpzQkk1c0JRUUJNQkVBam13RWhBaEI1STVzQklBSkJBQ0FDYXlBQ1FRQktHMnNrbXdFam5RRkJBV29rblFFam5RRkJJRTRFUUVFQUpKMEJDd3RCQUNFQ0k5SUJJUUFqbWdFRWZ5UEpBUVVqbWdFTElnRUVRQ05nQkVCQm5QNERFQU5CQlhWQkQzRWlBQ1RTQVVFQUpHQUxCVUVQRHdzam5RRkJBbTBRZWtHdy9nTnFFQU1oQVNPZEFVRUNid1IvSUFGQkQzRUZJQUZCQkhWQkQzRUxJUUVDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCSUFCQkFrWU5BZ3dEQ3lBQlFRUjFJUUVNQXd0QkFTRUNEQUlMSUFGQkFYVWhBVUVDSVFJTUFRc2dBVUVDZFNFQlFRUWhBZ3NnQWtFQVNnUi9JQUVnQW0wRlFRQUxJZ0ZCRDJvTEVnRUJmeVBNQVNFQVFRQWt6QUVnQUJCN0N4c0JBWDhqMHdFajFBRjBJUUFqTXdSQUlBQkJBWFFoQUFzZ0FBdXZBUUVCZnlPZkFTQUFheVNmQVNPZkFVRUFUQVJBSTU4QklRQVFmU1NmQVNPZkFTQUFRUUFnQUdzZ0FFRUFTaHRySko4Qkk2TUJRUUZ4SVFFam93RkJBWFZCQVhFaEFDT2pBVUVCZFNTakFTT2pBU0FCSUFCeklnRkJEblJ5SktNQkk5VUJCRUFqb3dGQnYzOXhKS01CSTZNQklBRkJCblJ5SktNQkN3c2puZ0VFZnlQS0FRVWpuZ0VMSWdBRWZ5T2lBUVZCRHc4TElRRkJBQ09qQVJBUUJIOUJmd1ZCQVFzaUFDQUJiRUVQYWdzU0FRRi9JODBCSVFCQkFDVE5BU0FBRUg0TEVnQWpNd1JBUVlDQWdBUVBDMEdBZ0lBQ0N3VUFFSUFCQ3pvQUlBQkJQRVlFUUVIL0FBOExJQUJCUEd0Qm9JMEdiQ0FCYkVFSWJSQjZRYUNOQm0wUWVrRThha0dnalFac1FZenhBaEI2YlJCNkVIb0x1Z0VCQVg5QkFDUnJJMU1FZnlBQUJVRVBDeUVFSTFRRWZ5QUVJQUZxQlNBRVFROXFDeUVFSTFVRWZ5QUVJQUpxQlNBRVFROXFDeUVFSTFZRWZ5QUVJQU5xQlNBRVFROXFDeUVFSTFjRWZ5QUFCVUVQQ3lFQUkxZ0VmeUFBSUFGcUJTQUFRUTlxQ3lFQUkxa0VmeUFBSUFKcUJTQUFRUTlxQ3lFQUkxb0VmeUFBSUFOcUJTQUFRUTlxQ3lFQVFRQWtiRUVBSkcwZ0JDTlJRUUZxRUlJQklRRWdBQ05TUVFGcUVJSUJJUUFnQVNScElBQWthaUFCSUFBUVNnc2xBUUYvSUFKQkFYUkJnUGdqYWlJRElBQkJBV282QUFBZ0EwRUJhaUFCUVFGcU9nQUFDNW9DQVFSL0lBQVFiU0lCUlFSQVFRRVFiaUVCQ3lBQUVHOGlBa1VFUUVFQ0VHNGhBZ3NnQUJCd0lnTkZCRUJCQXhCdUlRTUxJQUFRY1NJRVJRUkFRUVFRYmlFRUN5QUJRUUZ4QkVBUWRTUmhDeUFDUVFGeEJFQVFlQ1JpQ3lBRFFRRnhCRUFRZkNSakN5QUVRUUZ4QkVBUWZ5UmtDeUFCUVFGeFJRUkFJQUloQVFzZ0FVRUJjVVVFUUNBRElRRUxJQUZCQVhGRkJFQWdCQ0VCQ3lBQlFRRnhCRUJCQVNSdEN5TmRJQUFqMWdGc2FpUmRJMTBRZ1FGT0JFQWpYUkNCQVdza1hTTnRCSDhqYlFVamF3c2lBVVVFUUNOc0lRRUxJQUVFUUNOaEkySWpZeU5rRUlNQkdnc2phVUVCYWlOcVFRRnFJMThRaEFFalgwRUJhaVJmSTljQlFRSnRFSHBCQVdzaEFTTmZJQUZPQkVBalgwRUJheVJmQ3dzTERBQWdBRUdBL2dOeFFRaDFDd2dBSUFCQi93RnhDNU1CQVFSL0lBQVFkQkI2SVFFZ0FCQjNFSG9oQWlBQUVIc1FlaUVESUFBUWZoQjZJUVFnQVNSaElBSWtZaUFESkdNZ0JDUmtJMTBnQUNQV0FXeHFKRjBqWFJDQkFVNEVRQ05kRUlFQmF5UmRJQUVnQWlBRElBUVFnd0VpQUJDR0FVRUJhaUFBRUljQlFRRnFJMThRaEFFalgwRUJhaVJmSTljQlFRSnRFSHBCQVdzaEFDTmZJQUJPQkVBalgwRUJheVJmQ3dzTEpRRUJmeUFBRUd3aEFTTXFCSDhnQVVVRkl5b0xJZ0VFUUNBQUVJVUJCU0FBRUlnQkN3c2tBQ05RRUY5SUJFQVBDd05BSTFBUVgwNEVRQkJmRUlrQkkxQVFYMnNrVUF3QkN3c0xjd0VCZnlBQVFhYitBMFlFUUVHbS9nTVFBMEdBQVhFaEFTT0pBUVIvUVFBZ0FSQkZCVUVBSUFFUVJBc2FJNU1CQkg5QkFTQUJFRVVGUVFFZ0FSQkVDeG9qbWdFRWYwRUNJQUVRUlFWQkFpQUJFRVFMR2lPZUFRUi9RUU1nQVJCRkJVRURJQUVRUkFzYUlBRkI4QUJ5RHd0QmZ3dkVBUUVCZnlPc0FTRUFJNjBCQkVBajJBRUVmMEVDSUFBUVJBVkJBaUFBRUVVTElRQWoyUUVFZjBFQUlBQVFSQVZCQUNBQUVFVUxJUUFqMmdFRWYwRURJQUFRUkFWQkF5QUFFRVVMSVFBajJ3RUVmMEVCSUFBUVJBVkJBU0FBRUVVTElRQUZJNjRCQkVBajNBRUVmMEVBSUFBUVJBVkJBQ0FBRUVVTElRQWozUUVFZjBFQklBQVFSQVZCQVNBQUVFVUxJUUFqM2dFRWYwRUNJQUFRUkFWQkFpQUFFRVVMSVFBajN3RUVmMEVESUFBUVJBVkJBeUFBRUVVTElRQUxDeUFBUWZBQmNndlVBZ0VCZnlBQVFZQ0FBa2dFUUVGL0R3c2dBRUdBZ0FKT0lnRUVRQ0FBUVlEQUFrZ2hBUXNnQVFSQVFYOFBDeUFBUVlEQUEwNGlBUVJBSUFCQmdQd0RTQ0VCQ3lBQkJFQWdBRUdBUUdvUUF3OExJQUJCZ1B3RFRpSUJCRUFnQUVHZi9RTk1JUUVMSUFFRVFDT0dBVUVDU0FSQVFmOEJEd3RCZnc4TElBQkJ6ZjREUmdSQVFmOEJJUUZCQUVITi9nTVFBeEFRUlFSQVFRQkIvd0VRUkNFQkN5TXpSUVJBUVFjZ0FSQkVJUUVMSUFFUEN5QUFRY1QrQTBZRVFDQUFJMHNRQmlOTER3c2dBRUdRL2dOT0lnRUVRQ0FBUWFiK0Ewd2hBUXNnQVFSQUVJb0JJQUFRaXdFUEN5QUFRYkQrQTA0aUFRUkFJQUJCdi80RFRDRUJDeUFCQkVBUWlnRkJmdzhMSUFCQmhQNERSZ1JBSUFBamVSQ0dBU0lCRUFZZ0FROExJQUJCaGY0RFJnUkFJQUFqZWhBR0kzb1BDeUFBUVkvK0EwWUVRQ04zUWVBQmNnOExJQUJCZ1A0RFJnUkFFSXdCRHd0QmZ3c2NBUUYvSUFBUWpRRWlBVUYvUmdSQUlBQVFBdzhMSUFGQi93RnhDKzBDQVFKL0kwVUVRQThMSUFCQi96OU1CRUFqUndSL1FRUWdBVUgvQVhFUUVFVUZJMGNMSWdCRkJFQWdBVUVQY1NJQ0JFQWdBa0VLUmdSQVFRRWtRd3NGUVFBa1F3c0xCU0FBUWYvL0FFd0VRQ011UlNJQ1JRUkFJQUJCLzk4QVRDRUNDeUFDQkVBalJ3UkFJQUZCRDNFa0xRc2dBU0VDSTBZRVFDQUNRUjl4SVFJakxVSGdBWEVrTFFValNBUkFJQUpCL3dCeElRSWpMVUdBQVhFa0xRVWpMZ1JBUVFBa0xRc0xDeU10SUFKeUpDMEZRUUFoQWlNdEVJY0JJUU1nQVVFQVNnUkFRUUVoQWdzZ0FpQURFRW9rTFFzRkkwZEZJZ01FUUNBQVFmKy9BVXdoQXdzZ0F3UkFJMFlFZnlORUJTTkdDeUlBQkVBakxVRWZjU1F0SXkwZ0FVSGdBWEZ5SkMwUEN5TklCRUFnQVVFSVRpSURCRUFnQVVFTVRDRURDd3NnQVNFREl5NEVmeUFEUVE5eEJTQURRUU54Q3lJREpERUZJMGRGSWdNRVFDQUFRZi8vQVV3aEF3c2dBd1JBSTBZRVFFRUFJQUZCL3dGeEVCQUVRRUVCSkVRRlFRQWtSQXNMQ3dzTEN3c2ZBQ0FBUWZBQWNVRUVkU1M2QVVFRElBQVFFQ1M4QVNBQVFRZHhKTHNCQ3dzQVFRY2dBQkFRSk1rQkN4OEFJQUJCQm5WQkEzRWt6Z0VnQUVFL2NTVGdBVUhBQUNQZ0FXc2tqQUVMSHdBZ0FFRUdkVUVEY1NUUUFTQUFRVDl4Sk9FQlFjQUFJK0VCYXlTV0FRc1JBQ0FBSk9JQlFZQUNJK0lCYXlTY0FRc1VBQ0FBUVQ5eEpPTUJRY0FBSStNQmF5U2hBUXNxQUNBQVFRUjFRUTl4Sk9RQlFRTWdBQkFRSk1FQklBQkJCM0Vrd0FFZ0FFSDRBWEZCQUVva3h3RUxLZ0FnQUVFRWRVRVBjU1RsQVVFRElBQVFFQ1REQVNBQVFRZHhKTUlCSUFCQitBRnhRUUJLSk1nQkN3MEFJQUJCQlhWQkQzRWs1Z0VMS2dBZ0FFRUVkVUVQY1NUbkFVRURJQUFRRUNURkFTQUFRUWR4Sk1RQklBQkIrQUZ4UVFCS0pNb0JDeFFBSUFBa3ZRRWp2Z0ZCQ0hRanZRRnlKTDhCQ3hRQUlBQWs2QUVqNlFGQkNIUWo2QUZ5Sk04QkN4UUFJQUFrNmdFajZ3RkJDSFFqNmdGeUpORUJDNFFCQVFGL0lBQkJCSFVrMUFGQkF5QUFFQkFrMVFFZ0FFRUhjU1RzQVFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FqN0FFaUFRUkFBa0FnQVVFQmF3NEhBZ01FQlFZSENBQUxEQWdMUVFnazB3RVBDMEVRSk5NQkR3dEJJQ1RUQVE4TFFUQWswd0VQQzBIQUFDVFRBUThMUWRBQUpOTUJEd3RCNEFBazB3RVBDMEh3QUNUVEFRc0xJQUJCQmlBQUVCQWt0Z0VnQUVFSGNTUytBU08rQVVFSWRDTzlBWElrdndFTGFnRUJmMEVCSklrQkk0d0JSUVJBUWNBQUpJd0JDeEJ5SThBQkpJc0JJK1FCSkkwQkk3OEJKSklCSTdvQkpKRUJJN29CUVFCS0lnQUVRQ083QVVFQVNpRUFDeUFBQkVCQkFTU1FBUVZCQUNTUUFRc2p1d0ZCQUVvRVFCQm5DeVBIQVVVRVFFRUFKSWtCQ3dzZ0FFRUdJQUFRRUNTM0FTQUFRUWR4Sk9rQkkra0JRUWgwSStnQmNpVFBBUXN1QUVFQkpKTUJJNVlCUlFSQVFjQUFKSllCQ3hCMkk4SUJKSlVCSStVQkpKY0JJOGdCUlFSQVFRQWtrd0VMQ3lBQVFRWWdBQkFRSkxnQklBQkJCM0VrNndFajZ3RkJDSFFqNmdGeUpORUJDeWNBUVFFa21nRWpuQUZGQkVCQmdBSWtuQUVMRUhsQkFDU2RBU1BKQVVVRVFFRUFKSm9CQ3dzTEFFRUdJQUFRRUNTNUFRczRBRUVCSko0Qkk2RUJSUVJBUWNBQUpLRUJDeEI5Sko4Qkk4UUJKS0FCSStjQkpLSUJRZi8vQVNTakFTUEtBVVVFUUVFQUpKNEJDd3NUQUNBQVFRUjFRUWR4SkZFZ0FFRUhjU1JTQzBJQVFRY2dBQkFRSkZaQkJpQUFFQkFrVlVFRklBQVFFQ1JVUVFRZ0FCQVFKRk5CQXlBQUVCQWtXa0VDSUFBUUVDUlpRUUVnQUJBUUpGaEJBQ0FBRUJBa1Z3c0tBRUVISUFBUUVDUmJDNVFEQVFGL0FrQWdBRUdtL2dOSElnSUVRQ05iUlNFQ0N5QUNCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFrR1EvZ05IQkVBQ1FDQUNRWkgrQTJzT0ZnTUhDdzhBQkFnTUVBSUZDUTBSQUFZS0RoSVRGQlVBQ3d3VkN5QUJFSkFCREJVTElBRVFrUUVNRkFzZ0FSQ1NBUXdUQ3lBQkVKTUJEQklMSUFFUWxBRU1FUXNnQVJDVkFRd1FDeUFCRUpZQkRBOExJQUVRbHdFTURndEJBU1JnSUFFUW1BRU1EUXNnQVJDWkFRd01DeUFCRUpvQkRBc0xJQUVRbXdFTUNnc2dBUkNjQVF3SkN5QUJFSjBCREFnTFFRY2dBUkFRQkVBZ0FSQ2VBUkNmQVFzTUJ3dEJCeUFCRUJBRVFDQUJFS0FCRUtFQkN3d0dDMEVISUFFUUVBUkFJQUVRb2dFUW93RUxEQVVMUVFjZ0FSQVFCRUFnQVJDa0FSQ2xBUXNNQkFzZ0FSQ21BVUVCSkdzTUF3c2dBUkNuQVVFQkpHd01BZ3NnQVJDb0FVRUhJQUVRRUVVRVFBSkFRWkQrQXlFQ0EwQWdBa0dtL2dOT0RRRWdBa0VBRUFZZ0FrRUJhaUVDREFBQUN3QUxDd3dCQzBFQkR3dEJBUXNjQUVIQi9nTkJCeUFBUWZnQmNVSEIvZ01RQTBFSGNYSVFSUkFHQ3o0QkFYOGdBRUVJZENFQkFrQkJBQ0VBQTBBZ0FFR2ZBVW9OQVNBQVFZRDhBMm9nQVNBQWFoQURFQVlnQUVFQmFpRUFEQUFBQ3dBTFFZUUZKSzhCQ3hNQUkrOEJFQU1qOEFFUUF4QktRZkQvQTNFTEZ3QWo4UUVRQXlQeUFSQURFRXBCOEQ5eFFZQ0FBbW9MaXdFQkEzOGpMMFVFUUE4TEk3SUJCSDlCQnlBQUVCQkZCU095QVFzaUFRUkFRUUFrc2dFajdnRVFBeUVCSSs0QlFRY2dBUkJGRUFZUEN4Q3NBU0VCRUswQklRSkJCeUFBRUVSQkFXcEJCSFFoQTBFSElBQVFFQVJBUVFFa3NnRWdBeVN6QVNBQkpMUUJJQUlrdFFFajdnRkJCeUFBRUVRUUJnVWdBU0FDSUFNUXZnRWo3Z0ZCL3dFUUJnc0xKZ0VCZnlBQVFUOXhJUU1nQWtFQmNRUkFJQU5CUUdzaEF3c2dBMEdBa0FScUlBRTZBQUFMR0FCQkJ5QUFFQkFFUUNBQlFRY2dBRUVCYWhCRkVBWUxDMG9CQW44Z0FDUDFBVVlpQWtVRVFDQUFJL1FCUmlFQ0N5QUNCRUJCQmlBQVFRRnJFQU1RUkNFQ0lBQWo5QUZHQkVCQkFTRURDeUFDSUFFZ0F4Q3ZBU0FDSUFCQkFXc1FzQUVMQ3dvQVFRRWtkVUVDRUYwTFBBRUJmd0pBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVNBQlFRSkdEUUlnQVVFRFJnMEREQVFMUVFrUEMwRUREd3RCQlE4TFFRY1BDMEVBQ3ljQkFYOGpmUkN6QVNJQ0lBQVFFQ0lBQkVBZ0FpQUJFQkJGSVFBTElBQUVRRUVCRHd0QkFBc2FBQ042UVFGcUpIb2pla0gvQVVvRVFFRUJKSDVCQUNSNkN3dG1BUUovQTBBZ0FTQUFTQVJBSTNraEFpQUJRUVJxSVFFamVVRUVhaVI1STNsQi8vOERTZ1JBSTNsQmdJQUVheVI1Q3lOOEJFQWpmZ1JBSTNza2VoQ3lBVUVBSkg1QkFTUi9CU04vQkVCQkFDUi9Dd3NnQWlONUVMUUJCRUFRdFFFTEN3d0JDd3NMQ3dBamVCQzJBVUVBSkhnTEtRQWplU0VBUVFBa2VVR0UvZ05CQUJBR0kzd0VmeUFBSTNrUXRBRUZJM3dMSWdBRVFCQzFBUXNMR2dBamZBUkFJMzhFUUE4TEkzNEVRRUVBSkg0TEN5QUFKSG9MR3dBZ0FDUjdJM3dFZnlOL0JTTjhDd1JBSTNza2VrRUFKSDhMQzFnQkFuOGpmQ0VCUVFJZ0FCQVFKSHdnQUVFRGNTRUNJQUZGQkVBamZSQ3pBU0VBSUFJUXN3RWhBU044QkVBZ0FDTjVFQkFoQUFVZ0FDTjVFQkFpQUFSQUlBRWplUkFRSVFBTEN5QUFCRUFRdFFFTEN5QUNKSDBMMFFVQkFYOENRQUpBSUFCQnpmNERSZ1JBUWMzK0F5QUJRUUZ4RUFZTUFnc2dBRUdBZ0FKSUJFQWdBQ0FCRUk4QkRBSUxJQUJCZ0lBQ1RpSUNCRUFnQUVHQXdBSklJUUlMSUFJTkFDQUFRWURBQTA0aUFnUkFJQUJCZ1B3RFNDRUNDeUFDQkVBZ0FFR0FRR29nQVJBR0RBRUxJQUJCZ1B3RFRpSUNCRUFnQUVHZi9RTk1JUUlMSUFJRVFDT0dBVUVDU0EwQ0RBRUxJQUJCb1AwRFRpSUNCRUFnQUVILy9RTk1JUUlMSUFJTkFTQUFRWkQrQTA0aUFnUkFJQUJCcHY0RFRDRUNDeUFDQkVBUWlnRWdBQ0FCRUtrQkR3c2dBRUd3L2dOT0lnSUVRQ0FBUWIvK0Ewd2hBZ3NnQWdSQUVJb0JDeUFBUWNEK0EwNGlBZ1JBSUFCQnkvNERUQ0VDQ3lBQ0JFQWdBRUhBL2dOR0JFQWdBUkFyREFJTElBQkJ3ZjREUmdSQUlBRVFxZ0VNQXdzZ0FFSEUvZ05HQkVCQkFDUkxJQUJCQUJBR0RBTUxJQUJCeGY0RFJnUkFJQUVrN1FFTUFnc2dBRUhHL2dOR0JFQWdBUkNyQVF3Q0N3SkFBa0FDUUFKQUlBQWlBa0hEL2dOSEJFQUNRQ0FDUWNMK0Eyc09DZ0lBQUFBQUFBQUFCQU1BQ3d3RUN5QUJKRXdNQlFzZ0FTUk5EQVFMSUFFa1Rnd0RDeUFCSkU4TUFnc01BUXNnQUNQdUFVWUVRQ0FCRUs0QkRBSUxJQUFqTWtZaUFrVUVRQ0FBSXpCR0lRSUxJQUlFUUNPeUFRUkFJN1FCUVlDQUFVNGlBZ1JBSTdRQlFmLy9BVXdoQWdzZ0FrVUVRQ08wQVVHQW9BTk9JZ0lFUUNPMEFVSC92d05NSVFJTEN5QUNEUU1MQ3lBQUkvTUJUaUlDQkVBZ0FDUDBBVXdoQWdzZ0FnUkFJQUFnQVJDeEFRd0JDeUFBUVlUK0EwNGlBZ1JBSUFCQmgvNERUQ0VDQ3lBQ0JFQVF0d0VDUUFKQUFrQUNRQ0FBSWdKQmhQNERSd1JBQWtBZ0FrR0YvZ05yRGdNQ0F3UUFDd3dFQ3lBQkVMZ0JEQVlMSUFFUXVRRU1CQXNnQVJDNkFRd0RDeUFCRUxzQkRBSUxEQUVMSUFCQmdQNERSZ1JBSUFFUUxnc2dBRUdQL2dOR0JFQWdBUkFTREFFTElBQkIvLzhEUmdSQUlBRVFFUXdCQzBFQkR3dEJBUThMUVFBTEVnQWdBQ0FCRUx3QkJFQWdBQ0FCRUFZTEMyZ0JBMzhDUUFOQUlBTWdBazROQVNBQUlBTnFFSTRCSVFVZ0FTQURhaUVFQTBBZ0JFSC92d0pLQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUwwQklBTkJBV29oQXd3QUFBc0FDMEVnSVFNak13UkFRY0FBSVFNTEk2OEJJQU1nQWtFUWJXeHFKSzhCQzIwQkFYOGpzZ0ZGQkVBUEMwRVFJUUFqc3dGQkVFZ0VRQ096QVNFQUN5TzBBU08xQVNBQUVMNEJJN1FCSUFCcUpMUUJJN1VCSUFCcUpMVUJJN01CSUFCckpMTUJJN01CUVFCTUJFQkJBQ1N5QVNQdUFVSC9BUkFHQlNQdUFVRUhJN01CUVJCdFFRRnJFRVFRQmdzTENnQkJBU1J6UVFBUVhRdlRBZ0VGZnlPa0FVVUVRRUVBSkVwQkFDUkxRY1QrQTBFQUVBWkJBRUVCUWNIK0F4QURFRVFRUkNFRFFRQWtoZ0ZCd2Y0RElBTVFCZzhMSTRZQklRRWpTeUlEUVpBQlRnUkFRUUVoQWdValNoQmJUZ1JBUVFJaEFnVWpTaEJjVGdSQVFRTWhBZ3NMQ3lBQklBSkhCRUJCd2Y0REVBTWhBQ0FDSklZQlFRQWhBUUpBQWtBQ1FBSkFBa0FnQWlFRUlBSkZEUUFDUUNBRVFRRnJEZ01DQXdRQUN3d0VDMEVEUVFGQkFDQUFFRVFRUkNJQUVCQWhBUXdEQzBFRVFRQkJBU0FBRUVRUVJTSUFFQkFoQVF3Q0MwRUZRUUZCQUNBQUVFUVFSU0lBRUJBaEFRd0JDMEVCUVFBZ0FCQkZFRVVoQUFzZ0FRUkFFRjRMSUFKRkJFQVF2d0VMSUFKQkFVWUVRQkRBQVFzajdRRWhCQ0FDUlNJQlJRUkFJQUpCQVVZaEFRc2dBUVJBSUFNZ0JFWWhBUXNnQVFSQVFRWkJBaUFBRUVVaUFCQVFCRUFRWGdzRlFRSWdBQkJFSVFBTFFjSCtBeUFBRUFZTEMyd0JBWDhqcEFFRVFDTktJQUJxSkVvRFFDTktFRDFPQkVBalNoQTlheVJLSTBzaUFVR1FBVVlFUUNNcEJFQVFXQVVnQVJCWEN4QlpFRm9GSUFGQmtBRklCRUFqS1VVRVFDQUJFRmNMQ3dzZ0FVR1pBVW9FZjBFQUJTQUJRUUZxQ3lJQkpFc01BUXNMQ3hEQkFRc2tBQ05KRUQ1SUJFQVBDd05BSTBrUVBrNEVRQkErRU1JQkkwa1FQbXNrU1F3QkN3c0xLQUFqZ2dFZ0FHb2tnZ0VqZ2dFamdBRk9CRUFqZ1FGQkFXb2tnUUVqZ2dFamdBRnJKSUlCQ3d0bUFDT3ZBVUVBU2dSQUlBQWpyd0ZxSVFCQkFDU3ZBUXNqUGlBQWFpUStJMEpGQkVBakp3UkFJMGtnQUdva1NSRERBUVVnQUJEQ0FRc2pKZ1JBSTFBZ0FHb2tVQVVnQUJDSkFRc0xJeWdFUUNONElBQnFKSGdRdHdFRklBQVF0Z0VMSUFBUXhBRUxFQUJCQkJERkFTTTlRUUZxRUR3UUF3c0xBRUVFRU1VQkl6MFFBd3NTQUJER0FVSC9BWEVReHdGQi93RnhFRW9MRGdCQkJCREZBU0FBSUFFUXZRRUxMd0VCZjBFQklBQjBFSWNCSVFJZ0FVRUFTZ1JBSXpzZ0FuSkIvd0Z4SkRzRkl6c2dBa0gvQVhOeEpEc0xJenNMQ2dCQkJTQUFFTW9CR2d0T0FDQUJRUUJPQkVBZ0FFRVBjU0FCUVE5eGFoQ0hBVUVRY1FSQVFRRVF5d0VGUVFBUXl3RUxCU0FCUVFBZ0FXc2dBVUVBU2h0QkQzRWdBRUVQY1VzRVFFRUJFTXNCQlVFQUVNc0JDd3NMQ2dCQkJ5QUFFTW9CR2dzS0FFRUdJQUFReWdFYUN3b0FRUVFnQUJES0FSb0xGQUFnQUVFQmRDQUFRZjhCY1VFSGRuSVFod0VMTndFQ2Z5QUJFSVlCSVFJZ0FFRUJhaUVESUFBZ0FSQ0hBU0lCRUx3QkJFQWdBQ0FCRUFZTElBTWdBaEM4QVFSQUlBTWdBaEFHQ3dzT0FFRUlFTVVCSUFBZ0FSRFJBUXVEQVFBZ0FrRUJjUVJBSUFCQi8vOERjU0lBSUFGcUlRSWdBQ0FCY3lBQ2N5SUNRUkJ4QkVCQkFSRExBUVZCQUJETEFRc2dBa0dBQW5FRVFFRUJFTThCQlVFQUVNOEJDd1VnQUNBQmFoQThJZ0lnQUVILy93TnhTUVJBUVFFUXp3RUZRUUFRendFTElBQWdBWE1nQW5OQmdDQnhFRHdFUUVFQkVNc0JCVUVBRU1zQkN3c0xEQUJCQkJERkFTQUFFSTRCQ3hRQUlBQkIvd0Z4UVFGMklBQkJCM1J5RUljQkM5TUVBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUFKQUlBQkJBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTERCUUxFTWdCUWYvL0EzRWlBQkNHQVVIL0FYRWtOU0FBRUljQlFmOEJjU1EyREJBTEl6VWpOaEJLSXpRUXlRRU1FZ3NqTlNNMkVFcEJBV3BCLy84RGNTSUFFSVlCUWY4QmNTUTFEQTBMSXpWQkFSRE1BU00xUVFGcUVJY0JKRFVqTlFSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdFTUVBc2pOVUYvRU13Qkl6VkJBV3NRaHdFa05TTTFCRUJCQUJETkFRVkJBUkROQVF0QkFSRE9BUXdQQ3hESEFVSC9BWEVrTlF3TUN5TTBRWUFCY1VHQUFVWUVRRUVCRU04QkJVRUFFTThCQ3lNMEVOQUJKRFFNREFzUXlBRkIvLzhEY1NNOEVOSUJEQWtMSXprak9oQktJZ0FqTlNNMkVFb2lBVUgvL3dOeFFRQVEwd0VnQUNBQmFoQThJZ0FRaGdGQi93RnhKRGtnQUJDSEFVSC9BWEVrT2tFQUVNNEJRUWdQQ3lNMUl6WVFTaERVQVVIL0FYRWtOQXdLQ3lNMUl6WVFTa0VCYXhBOElnQVFoZ0ZCL3dGeEpEVU1CUXNqTmtFQkVNd0JJelpCQVdvUWh3RWtOaU0yQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVF3SUN5TTJRWDhRekFFak5rRUJheENIQVNRMkl6WUVRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJEQWNMRU1jQlFmOEJjU1EyREFRTEl6UkJBWEZCQUVzRVFFRUJFTThCQlVFQUVNOEJDeU0wRU5VQkpEUU1CQXRCZnc4TElBQVFod0ZCL3dGeEpEWkJDQThMSXoxQkFtb1FQQ1E5REFJTEl6MUJBV29RUENROURBRUxRUUFRelFGQkFCRE9BVUVBRU1zQkMwRUVDd29BSXp0QkJIWkJBWEVMRGdBZ0FFRUJkQkRYQVhJUWh3RUxLQUVCZjBFSElBQkJHSFJCR0hVaUFSQVFCRUJCZ0FJZ0FFRVlkRUVZZFd0QmYyd2hBUXNnQVFzakFRRi9JQUFRMlFFaEFTTTlJQUZCR0hSQkdIVnFFRHdrUFNNOVFRRnFFRHdrUFFzVkFDQUFRZjhCY1VFQmRoRFhBVUVIZEhJUWh3RUxwUVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFBSkFJQUJCRVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJeThFUUVFQVFjMytBeERVQVVIL0FYRWlBQkFRQkVCQnpmNERRUWRCQUNBQUVFUWlBQkFRQkg5QkFDUXpRUWNnQUJCRUJVRUJKRE5CQnlBQUVFVUxJZ0FReVFGQnhBQVBDd3RCQVNSQ0RCRUxFTWdCUWYvL0EzRWlBQkNHQVVIL0FYRWtOeUFBRUljQlFmOEJjU1E0SXoxQkFtb1FQQ1E5REJJTEl6Y2pPQkJLSXpRUXlRRU1FUXNqTnlNNEVFcEJBV29RUENJQUVJWUJRZjhCY1NRM0RBMExJemRCQVJETUFTTTNRUUZxRUljQkpEY2pOd1JBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0VNRHdzak4wRi9FTXdCSXpkQkFXc1Fod0VrTnlNM0JFQkJBQkROQVFWQkFSRE5BUXRCQVJET0FRd09DeERIQVVIL0FYRWtOd3dMQzBFQUlRQWpORUdBQVhGQmdBRkdCRUJCQVNFQUN5TTBFTmdCSkRRTUN3c1F4d0VRMmdGQkNBOExJemtqT2hCS0lnQWpOeU00RUVvaUFVSC8vd054UVFBUTB3RWdBQ0FCYWhBOElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPa0VBRU00QlFRZ1BDeU0zSXpnUVNrSC8vd054RU5RQlFmOEJjU1EwREFrTEl6Y2pPQkJLUVFGckVEd2lBQkNHQVVIL0FYRWtOd3dGQ3lNNFFRRVF6QUVqT0VFQmFoQ0hBU1E0SXpnRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QkRBY0xJemhCZnhETUFTTTRRUUZyRUljQkpEZ2pPQVJBUVFBUXpRRUZRUUVRelFFTFFRRVF6Z0VNQmdzUXh3RkIvd0Z4SkRnTUF3dEJBQ0VBSXpSQkFYRkJBVVlFUUVFQklRQUxJelFRMndFa05Bd0RDMEYvRHdzZ0FCQ0hBVUgvQVhFa09FRUlEd3NqUFVFQmFoQThKRDBNQVFzZ0FBUkFRUUVRendFRlFRQVF6d0VMUVFBUXpRRkJBQkRPQVVFQUVNc0JDMEVFQ3dvQUl6dEJCM1pCQVhFTENnQWpPMEVGZGtFQmNRc0tBQ003UVFaMlFRRnhDNGdHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJJRWNFUUFKQUlBQkJJV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEVOMEJCRUFqUFVFQmFoQThKRDBGRU1jQkVOb0JDMEVJRHdzUXlBRkIvLzhEY1NJQUVJWUJRZjhCY1NRNUlBQVFod0ZCL3dGeEpEb2pQVUVDYWhBOEpEME1FQXNqT1NNNkVFb2lBRUgvL3dOeEl6UVF5UUVnQUVFQmFoQThJZ0FRaGdGQi93RnhKRGtnQUJDSEFVSC9BWEVrT2d3UEN5TTVJem9RU2tFQmFoQThJZ0FRaGdGQi93RnhKRGtnQUJDSEFVSC9BWEVrT2tFSUR3c2pPVUVCRU13Qkl6bEJBV29RaHdFa09TTTVCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXdOQ3lNNVFYOFF6QUVqT1VFQmF4Q0hBU1E1SXprRVFFRUFFTTBCQlVFQkVNMEJDMEVCRU00QkRBd0xFTWNCUWY4QmNTUTVEQW9MRU40QlFRQkxCRUJCQmlFQkN4RFhBVUVBU3dSQUlBRkI0QUJ5SVFFTEVOOEJRUUJMQkg4ak5DQUJheENIQVFVak5FRVBjVUVKU3dSQUlBRkJCbkloQVFzak5FR1pBVXNFUUNBQlFlQUFjaUVCQ3lNMElBRnFFSWNCQ3lJQUJFQkJBQkROQVFWQkFSRE5BUXNnQVVIZ0FIRUVRRUVCRU04QkJVRUFFTThCQzBFQUVNc0JJQUFrTkF3S0N4RGRBVUVBU3dSQUVNY0JFTm9CQlNNOVFRRnFFRHdrUFF0QkNBOExJemtqT2hCS0lnRWdBVUgvL3dOeFFRQVEwd0VnQVVFQmRCQThJZ0VRaGdGQi93RnhKRGtnQVJDSEFVSC9BWEVrT2tFQUVNNEJRUWdQQ3lNNUl6b1FTaUlCUWYvL0EzRVExQUZCL3dGeEpEUWdBVUVCYWhBOElnRVFoZ0ZCL3dGeEpEa2dBUkNIQVVIL0FYRWtPZ3dIQ3lNNUl6b1FTa0VCYXhBOElnRVFoZ0ZCL3dGeEpEa2dBUkNIQVVIL0FYRWtPa0VJRHdzak9rRUJFTXdCSXpwQkFXb1Fod0VrT2lNNkJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FRd0ZDeU02UVg4UXpBRWpPa0VCYXhDSEFTUTZJem9FUUVFQUVNMEJCVUVCRU0wQkMwRUJFTTRCREFRTEVNY0JRZjhCY1NRNkRBSUxJelJCZjNOQi93RnhKRFJCQVJET0FVRUJFTXNCREFJTFFYOFBDeU05UVFGcUVEd2tQUXRCQkF2d0JBRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRXdSd1JBQWtBZ0FFRXhhdzRQQWdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzUTF3RUVRQ005UVFGcUVEd2tQUVVReHdFUTJnRUxRUWdQQ3hESUFVSC8vd054SkR3alBVRUNhaEE4SkQwTUVnc2pPU002RUVvaUFFSC8vd054SXpRUXlRRU1Ed3NqUEVFQmFoQThKRHhCQ0E4TEl6a2pPaEJLSWdCQi8vOERjUkRVQVNJQlFRRVF6QUVnQVVFQmFoQ0hBU0lCQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVF3T0N5TTVJem9RU2lJQVFmLy9BM0VRMUFFaUFVRi9FTXdCSUFGQkFXc1Fod0VpQVFSQVFRQVF6UUVGUVFFUXpRRUxRUUVRemdFTURRc2pPU002RUVwQi8vOERjUkRIQVVIL0FYRVF5UUVNQ2d0QkFCRE9BVUVBRU1zQlFRRVF6d0VNREFzUTF3RkJBVVlFUUJESEFSRGFBUVVqUFVFQmFoQThKRDBMUVFnUEN5TTVJem9RU2lJQkl6eEJBQkRUQVNBQkl6eHFFRHdpQUJDR0FVSC9BWEVrT1NBQUVJY0JRZjhCY1NRNlFRQVF6Z0ZCQ0E4TEl6a2pPaEJLSWdCQi8vOERjUkRVQVVIL0FYRWtOQXdIQ3lNOFFRRnJFRHdrUEVFSUR3c2pORUVCRU13Qkl6UkJBV29RaHdFa05DTTBCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXdIQ3lNMFFYOFF6QUVqTkVFQmF4Q0hBU1EwSXpRRVFFRUFFTTBCQlVFQkVNMEJDMEVCRU00QkRBWUxFTWNCUWY4QmNTUTBEQUlMUVFBUXpnRkJBQkRMQVJEWEFVRUFTd1JBUVFBUXp3RUZRUUVRendFTERBUUxRWDhQQ3lNOVFRRnFFRHdrUFF3Q0N5QUFRUUZyRUR3aUFCQ0dBVUgvQVhFa09TQUFFSWNCUWY4QmNTUTZEQUVMSUFCQi8vOERjU0FCRU1rQkMwRUVDOWtCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUFSd1JBSUFBaUFVSEJBRVlOQVFKQUlBRkJ3Z0JyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTERCQUxJellrTlF3UEN5TTNKRFVNRGdzak9DUTFEQTBMSXpra05Rd01DeU02SkRVTUN3c2pPU002RUVvUTFBRkIvd0Z4SkRVTUNnc2pOQ1ExREFrTEl6VWtOZ3dJQ3d3SEN5TTNKRFlNQmdzak9DUTJEQVVMSXpra05nd0VDeU02SkRZTUF3c2pPU002RUVvUTFBRkIvd0Z4SkRZTUFnc2pOQ1EyREFFTFFYOFBDMEVFQzlrQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZEFBUndSQUlBQWlBVUhSQUVZTkFRSkFJQUZCMGdCckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVrTnd3UUN5TTJKRGNNRHdzTURnc2pPQ1EzREEwTEl6a2tOd3dNQ3lNNkpEY01Dd3NqT1NNNkVFb1ExQUZCL3dGeEpEY01DZ3NqTkNRM0RBa0xJelVrT0F3SUN5TTJKRGdNQndzak55UTREQVlMREFVTEl6a2tPQXdFQ3lNNkpEZ01Bd3NqT1NNNkVFb1ExQUZCL3dGeEpEZ01BZ3NqTkNRNERBRUxRWDhQQzBFRUM5a0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWVBQVJ3UkFJQUFpQVVIaEFFWU5BUUpBSUFGQjRnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSXpVa09Rd1FDeU0ySkRrTUR3c2pOeVE1REE0TEl6Z2tPUXdOQ3d3TUN5TTZKRGtNQ3dzak9TTTZFRW9RMUFGQi93RnhKRGtNQ2dzak5DUTVEQWtMSXpVa09nd0lDeU0ySkRvTUJ3c2pOeVE2REFZTEl6Z2tPZ3dGQ3lNNUpEb01CQXNNQXdzak9TTTZFRW9RMUFGQi93RnhKRG9NQWdzak5DUTZEQUVMUVg4UEMwRUVDeUlBSTRjQkJFQkJBU1EvRHdzamNpTjNjVUVmY1VVRVFFRUJKRUFQQzBFQkpFRUxpUUlCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQkhCRUFnQUNJQlFmRUFSZzBCQWtBZ0FVSHlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzak9TTTZFRW9qTlJESkFRd1FDeU01SXpvUVNpTTJFTWtCREE4TEl6a2pPaEJLSXpjUXlRRU1EZ3NqT1NNNkVFb2pPQkRKQVF3TkN5TTVJem9RU2lNNUVNa0JEQXdMSXprak9oQktJem9ReVFFTUN3c2pzZ0ZGQkVBUTVRRUxEQW9MSXprak9oQktJelFReVFFTUNRc2pOU1EwREFnTEl6WWtOQXdIQ3lNM0pEUU1CZ3NqT0NRMERBVUxJemtrTkF3RUN5TTZKRFFNQXdzak9TTTZFRW9RMUFGQi93RnhKRFFNQWdzTUFRdEJmdzhMUVFRTFNnQWdBVUVBVGdSQUlBQkIvd0Z4SUFBZ0FXb1Fod0ZMQkVCQkFSRFBBUVZCQUJEUEFRc0ZJQUZCQUNBQmF5QUJRUUJLR3lBQVFmOEJjVW9FUUVFQkVNOEJCVUVBRU04QkN3c0xOd0VCZnlNMElBQkIvd0Z4SWdFUXpBRWpOQ0FCRU9jQkl6UWdBR29RaHdFa05DTTBCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXRyQVFGL0l6UWdBR29RMXdGcUVJY0JJUUVqTkNBQWN5QUJjeENIQVVFUWNRUkFRUUVReXdFRlFRQVF5d0VMSXpRZ0FFSC9BWEZxRU5jQmFoQThRWUFDY1VFQVN3UkFRUUVRendFRlFRQVF6d0VMSUFFa05DTTBCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BUXZpQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWUFCUndSQUFrQWdBVUdCQVdzT0R3SURCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJelVRNkFFTUVBc2pOaERvQVF3UEN5TTNFT2dCREE0TEl6Z1E2QUVNRFFzak9SRG9BUXdNQ3lNNkVPZ0JEQXNMSXprak9oQktFTlFCRU9nQkRBb0xJelFRNkFFTUNRc2pOUkRwQVF3SUN5TTJFT2tCREFjTEl6Y1E2UUVNQmdzak9CRHBBUXdGQ3lNNUVPa0JEQVFMSXpvUTZRRU1Bd3NqT1NNNkVFb1ExQUVRNlFFTUFnc2pOQkRwQVF3QkMwRi9Ed3RCQkFzNkFRRi9JelFnQUVIL0FYRkJmMndpQVJETUFTTTBJQUVRNXdFak5DQUFheENIQVNRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJDMnNCQVg4ak5DQUFheERYQVdzUWh3RWhBU00wSUFCeklBRnpRUkJ4RUljQkJFQkJBUkRMQVFWQkFCRExBUXNqTkNBQVFmOEJjV3NRMXdGckVEeEJnQUp4UVFCTEJFQkJBUkRQQVFWQkFCRFBBUXNnQVNRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQkVNNEJDK0lCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJrQUZIQkVBQ1FDQUJRWkVCYXc0UEFnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pOUkRyQVF3UUN5TTJFT3NCREE4TEl6Y1E2d0VNRGdzak9CRHJBUXdOQ3lNNUVPc0JEQXdMSXpvUTZ3RU1Dd3NqT1NNNkVFb1ExQUVRNndFTUNnc2pOQkRyQVF3SkN5TTFFT3dCREFnTEl6WVE3QUVNQndzak54RHNBUXdHQ3lNNEVPd0JEQVVMSXprUTdBRU1CQXNqT2hEc0FRd0RDeU01SXpvUVNoRFVBUkRzQVF3Q0N5TTBFT3dCREFFTFFYOFBDMEVFQ3lnQUl6UWdBSEVrTkNNMEJFQkJBQkROQVFWQkFSRE5BUXRCQUJET0FVRUJFTXNCUVFBUXp3RUxLd0FqTkNBQWN4Q0hBU1EwSXpRRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0ZCQUJEUEFRdmlBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFhQUJSd1JBQWtBZ0FVR2hBV3NPRHdJREJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEl6VVE3Z0VNRUFzak5oRHVBUXdQQ3lNM0VPNEJEQTRMSXpnUTdnRU1EUXNqT1JEdUFRd01DeU02RU80QkRBc0xJemtqT2hCS0VOUUJFTzRCREFvTEl6UVE3Z0VNQ1Fzak5SRHZBUXdJQ3lNMkVPOEJEQWNMSXpjUTd3RU1CZ3NqT0JEdkFRd0ZDeU01RU84QkRBUUxJem9RN3dFTUF3c2pPU002RUVvUTFBRVE3d0VNQWdzak5CRHZBUXdCQzBGL0R3dEJCQXNzQUNNMElBQnlRZjhCY1NRMEl6UUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJRUUFReXdGQkFCRFBBUXN6QVFGL0l6UWdBRUgvQVhGQmYyd2lBUkRNQVNNMElBRVE1d0VqTkNBQmFnUkFRUUFRelFFRlFRRVF6UUVMUVFFUXpnRUw0Z0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR3dBVWNFUUFKQUlBRkJzUUZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5TTFFUEVCREJBTEl6WVE4UUVNRHdzak54RHhBUXdPQ3lNNEVQRUJEQTBMSXprUThRRU1EQXNqT2hEeEFRd0xDeU01SXpvUVNoRFVBUkR4QVF3S0N5TTBFUEVCREFrTEl6VVE4Z0VNQ0Fzak5oRHlBUXdIQ3lNM0VQSUJEQVlMSXpnUThnRU1CUXNqT1JEeUFRd0VDeU02RVBJQkRBTUxJemtqT2hCS0VOUUJFUElCREFJTEl6UVE4Z0VNQVF0QmZ3OExRUVFMUWdFQ2Z3SkFBa0FnQUJDTkFTSUJRWDlIQkVBTUFnc2dBQkFESVFFTEN3SkFBa0FnQUVFQmFpSUNFSTBCSWdCQmYwY05BU0FDRUFNaEFBc0xJQUFnQVJCS0N3d0FRUWdReFFFZ0FCRDBBUXM3QUNBQVFZQUJjVUdBQVVZRVFFRUJFTThCQlVFQUVNOEJDeUFBRU5BQklnQUVRRUVBRU0wQkJVRUJFTTBCQzBFQUVNNEJRUUFReXdFZ0FBczVBQ0FBUVFGeFFRQkxCRUJCQVJEUEFRVkJBQkRQQVFzZ0FCRFZBU0lBQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVVFQUVNc0JJQUFMU0FFQmZ5QUFRWUFCY1VHQUFVWUVRRUVCSVFFTElBQVEyQUVoQUNBQkJFQkJBUkRQQVFWQkFCRFBBUXNnQUFSQVFRQVF6UUVGUVFFUXpRRUxRUUFRemdGQkFCRExBU0FBQzBZQkFYOGdBRUVCY1VFQlJnUkFRUUVoQVFzZ0FCRGJBU0VBSUFFRVFFRUJFTThCQlVFQUVNOEJDeUFBQkVCQkFCRE5BUVZCQVJETkFRdEJBQkRPQVVFQUVNc0JJQUFMU3dFQmZ5QUFRWUFCY1VHQUFVWUVRRUVCSVFFTElBQkJBWFFRaHdFaEFDQUJCRUJCQVJEUEFRVkJBQkRQQVFzZ0FBUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVNBQUMyc0JBbjhnQUVHQUFYRkJnQUZHQkVCQkFTRUJDeUFBUVFGeFFRRkdCRUJCQVNFQ0N5QUFRZjhCY1VFQmRoQ0hBU0VBSUFFRVFDQUFRWUFCY2lFQUN5QUFCRUJCQUJETkFRVkJBUkROQVF0QkFCRE9BVUVBRU1zQklBSUVRRUVCRU04QkJVRUFFTThCQ3lBQUN6Z0FJQUJCRDNGQkJIUWdBRUh3QVhGQkJIWnlFSWNCSWdBRVFFRUFFTTBCQlVFQkVNMEJDMEVBRU00QlFRQVF5d0ZCQUJEUEFTQUFDMHNCQVg4Z0FFRUJjVUVCUmdSQVFRRWhBUXNnQUVIL0FYRkJBWFlRaHdFaUFBUkFRUUFRelFFRlFRRVF6UUVMUVFBUXpnRkJBQkRMQVNBQkJFQkJBUkRQQVFWQkFCRFBBUXNnQUFzb0FDQUJRUUVnQUhSeFFmOEJjUVJBUVFBUXpRRUZRUUVRelFFTFFRQVF6Z0ZCQVJETEFTQUJDeUFBSUFGQkFFb0VmeUFDUVFFZ0FIUnlCU0FDUVFFZ0FIUkJmM054Q3lJQ0M5c0lBUWQvUVg4aEJnSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUWh2SWdjaEJTQUhSUTBBQWtBZ0JVRUJhdzRIQWdNRUJRWUhDQUFMREFnTEl6VWhBUXdIQ3lNMklRRU1CZ3NqTnlFQkRBVUxJemdoQVF3RUN5TTVJUUVNQXdzak9pRUJEQUlMSXprak9oQktFTlFCSVFFTUFRc2pOQ0VCQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQlNFRUlBVkZEUUFDUUNBRVFRRnJEZzhDQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lBQVFRZE1CRUFnQVJEMkFTRUNRUUVoQXdVZ0FFRVBUQVJBSUFFUTl3RWhBa0VCSVFNTEN3d1BDeUFBUVJkTUJFQWdBUkQ0QVNFQ1FRRWhBd1VnQUVFZlRBUkFJQUVRK1FFaEFrRUJJUU1MQ3d3T0N5QUFRU2RNQkVBZ0FSRDZBU0VDUVFFaEF3VWdBRUV2VEFSQUlBRVErd0VoQWtFQklRTUxDd3dOQ3lBQVFUZE1CRUFnQVJEOEFTRUNRUUVoQXdVZ0FFRS9UQVJBSUFFUS9RRWhBa0VCSVFNTEN3d01DeUFBUWNjQVRBUkFRUUFnQVJEK0FTRUNRUUVoQXdVZ0FFSFBBRXdFUUVFQklBRVEvZ0VoQWtFQklRTUxDd3dMQ3lBQVFkY0FUQVJBUVFJZ0FSRCtBU0VDUVFFaEF3VWdBRUhmQUV3RVFFRURJQUVRL2dFaEFrRUJJUU1MQ3d3S0N5QUFRZWNBVEFSQVFRUWdBUkQrQVNFQ1FRRWhBd1VnQUVIdkFFd0VRRUVGSUFFUS9nRWhBa0VCSVFNTEN3d0pDeUFBUWZjQVRBUkFRUVlnQVJEK0FTRUNRUUVoQXdVZ0FFSC9BRXdFUUVFSElBRVEvZ0VoQWtFQklRTUxDd3dJQ3lBQVFZY0JUQVJBUVFCQkFDQUJFUDhCSVFKQkFTRURCU0FBUVk4QlRBUkFRUUZCQUNBQkVQOEJJUUpCQVNFREN3c01Cd3NnQUVHWEFVd0VRRUVDUVFBZ0FSRC9BU0VDUVFFaEF3VWdBRUdmQVV3RVFFRURRUUFnQVJEL0FTRUNRUUVoQXdzTERBWUxJQUJCcHdGTUJFQkJCRUVBSUFFUS93RWhBa0VCSVFNRklBQkJyd0ZNQkVCQkJVRUFJQUVRL3dFaEFrRUJJUU1MQ3d3RkN5QUFRYmNCVEFSQVFRWkJBQ0FCRVA4QklRSkJBU0VEQlNBQVFiOEJUQVJBUVFkQkFDQUJFUDhCSVFKQkFTRURDd3NNQkFzZ0FFSEhBVXdFUUVFQVFRRWdBUkQvQVNFQ1FRRWhBd1VnQUVIUEFVd0VRRUVCUVFFZ0FSRC9BU0VDUVFFaEF3c0xEQU1MSUFCQjF3Rk1CRUJCQWtFQklBRVEvd0VoQWtFQklRTUZJQUJCM3dGTUJFQkJBMEVCSUFFUS93RWhBa0VCSVFNTEN3d0NDeUFBUWVjQlRBUkFRUVJCQVNBQkVQOEJJUUpCQVNFREJTQUFRZThCVEFSQVFRVkJBU0FCRVA4QklRSkJBU0VEQ3dzTUFRc2dBRUgzQVV3RVFFRUdRUUVnQVJEL0FTRUNRUUVoQXdVZ0FFSC9BVXdFUUVFSFFRRWdBUkQvQVNFQ1FRRWhBd3NMQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQnlJRUJFQUNRQ0FFUVFGckRnY0NBd1FGQmdjSUFBc01DQXNnQWlRMURBY0xJQUlrTmd3R0N5QUNKRGNNQlFzZ0FpUTREQVFMSUFJa09Rd0RDeUFDSkRvTUFnc2dCVUVFU0NJRVJRUkFJQVZCQjBvaEJBc2dCQVJBSXprak9oQktJQUlReVFFTERBRUxJQUlrTkFzZ0F3UkFRUVFoQmdzZ0JndlVBd0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVSEFBVWNFUUFKQUlBRkJ3UUZyRGc4Q0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN4RGRBUTBTREJRTEl6d1E5UUZCLy84RGNTRUJJenhCQW1vUVBDUThJQUVRaGdGQi93RnhKRFVnQVJDSEFVSC9BWEVrTmtFRUR3c1EzUUVFUUF3U0JRd1FDd0FMREE0TEVOMEJCRUFNRUFVTURRc0FDeU04UVFKckVEd2tQQ004SXpVak5oQktFTklCREEwTEVNY0JFT2dCREE4TEl6eEJBbXNRUENROEl6d2pQUkRTQVVFQUpEME1Dd3NRM1FGQkFVY05DZ3dNQ3lNOEVQVUJRZi8vQTNFa1BTTThRUUpxRUR3a1BBd0pDeERkQVVFQlJnUkFEQWdGREFvTEFBc1F4d0ZCL3dGeEVJQUNJUUVqUFVFQmFoQThKRDBnQVE4TEVOMEJRUUZHQkVBalBFRUNheEE4SkR3alBDTTlRUUpxUWYvL0EzRVEwZ0VNQmdVTUNBc0FDd3dEQ3hESEFSRHBBUXdIQ3lNOFFRSnJFRHdrUENNOEl6MFEwZ0ZCQ0NROURBTUxRWDhQQ3lNOFFRSnJFRHdrUENNOEl6MUJBbW9RUEJEU0FRc1F5QUZCLy84RGNTUTlDMEVJRHdzalBVRUNhaEE4SkQxQkRBOExJendROVFGQi8vOERjU1E5SXp4QkFtb1FQQ1E4UVF3UEN5TTlRUUZxRUR3a1BVRUVDeFVBSUFCQkFYRUVRRUVCSklnQkJVRUFKSWNCQ3d1eEF3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQjBBRkhCRUFDUUNBQlFkRUJhdzRQQWdNQUJBVUdCd2dKQ2dBTEFBd05BQXNNRFFzUTF3RU5EZ3dRQ3lNOEVQVUJRZi8vQTNFaEFTTThRUUpxRUR3a1BDQUJFSVlCUWY4QmNTUTNJQUVRaHdGQi93RnhKRGhCQkE4TEVOY0JCRUFNRGdVTURBc0FDeERYQVFSQURBMEZJenhCQW1zUVBDUThJendqUFVFQ2FrSC8vd054RU5JQkRBc0xBQXNqUEVFQ2F4QThKRHdqUENNM0l6Z1FTaERTQVF3S0N4REhBUkRyQVF3TUN5TThRUUpyRUR3a1BDTThJejBRMGdGQkVDUTlEQWdMRU5jQlFRRkhEUWNNQ1FzalBCRDFBVUgvL3dOeEpEMUJBUkNDQWlNOFFRSnFFRHdrUEF3R0N4RFhBVUVCUmdSQURBVUZEQWNMQUFzUTF3RkJBVVlFUUNNOFFRSnJFRHdrUENNOEl6MUJBbW9RUEJEU0FRd0VCUXdHQ3dBTEVNY0JFT3dCREFZTEl6eEJBbXNRUENROEl6d2pQUkRTQVVFWUpEME1BZ3RCZnc4TEVNZ0JRZi8vQTNFa1BRdEJDQThMSXoxQkFtb1FQQ1E5UVF3UEN5TThFUFVCUWYvL0EzRWtQU004UVFKcUVEd2tQRUVNRHdzalBVRUJhaEE4SkQxQkJBdmdBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQVVjRVFBSkFJQUJCNFFGckRnOENBd0FBQkFVR0J3Z0pBQUFBQ2dzQUN3d0xDeERIQVVIL0FYRkJnUDREYWlNMEVNa0JEQXNMSXp3UTlRRkIvLzhEY1NFQUl6eEJBbW9RUENROElBQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPa0VFRHdzak5rR0EvZ05xSXpRUXlRRkJCQThMSXp4QkFtc1FQQ1E4SXp3ak9TTTZFRW9RMGdGQkNBOExFTWNCRU80QkRBY0xJenhCQW1zUVBDUThJendqUFJEU0FVRWdKRDFCQ0E4TEVNY0JFTmtCSVFBalBDQUFRUmgwUVJoMUlnQkJBUkRUQVNNOElBQnFFRHdrUEVFQUVNMEJRUUFRemdFalBVRUJhaEE4SkQxQkRBOExJemtqT2hCS1FmLy9BM0VrUFVFRUR3c1F5QUZCLy84RGNTTTBFTWtCSXoxQkFtb1FQQ1E5UVFRUEN4REhBUkR2QVF3Q0N5TThRUUpyRUR3a1BDTThJejBRMGdGQktDUTlRUWdQQzBGL0R3c2pQVUVCYWhBOEpEMUJCQXVTQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVVjRVFBSkFJQUJCOFFGckRnOENBd1FBQlFZSENBa0tDd0FBREEwQUN3d05DeERIQVVIL0FYRkJnUDREYWhEVUFSQ0hBU1EwREEwTEl6d1E5UUZCLy84RGNTRUFJenhCQW1vUVBDUThJQUFRaGdGQi93RnhKRFFnQUJDSEFVSC9BWEVrT3d3TkN5TTJRWUQrQTJvUTFBRVFod0VrTkF3TUMwRUFFSUlDREFzTEl6eEJBbXNRUENROEl6d2pOQ003RUVvUTBnRkJDQThMRU1jQkVQRUJEQWdMSXp4QkFtc1FQQ1E4SXp3alBSRFNBVUV3SkQxQkNBOExFTWNCRU5rQklRQkJBQkROQVVFQUVNNEJJendnQUVFWWRFRVlkU0lBUVFFUTB3RWpQQ0FBYWhBOElnQVFoZ0ZCL3dGeEpEa2dBQkNIQVVIL0FYRWtPaU05UVFGcUVEd2tQVUVJRHdzak9TTTZFRXBCLy84RGNTUThRUWdQQ3hESUFVSC8vd054RU5RQlFmOEJjU1EwSXoxQkFtb1FQQ1E5REFVTFFRRVFnZ0lNQkFzUXh3RVE4Z0VNQWdzalBFRUNheEE4SkR3alBDTTlFTklCUVRna1BVRUlEd3RCZnc4TEl6MUJBV29RUENROUMwRUVDOVlCQVFGL0l6MUJBV29RUENROUkwRUVRQ005UVFGckVEd2tQUXNDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBWEZCQkhVaUFRUkFJQUZCQVVZTkFRSkFJQUZCQW1zT0RRTUVCUVlIQ0FrS0N3d05EZzhBQ3d3UEN5QUFFTllCRHdzZ0FCRGNBUThMSUFBUTRBRVBDeUFBRU9FQkR3c2dBQkRpQVE4TElBQVE0d0VQQ3lBQUVPUUJEd3NnQUJEbUFROExJQUFRNmdFUEN5QUFFTzBCRHdzZ0FCRHdBUThMSUFBUTh3RVBDeUFBRUlFQ0R3c2dBQkNEQWc4TElBQVFoQUlQQ3lBQUVJVUNDeElBUVFBa1FFRUFKRDlCQUNSQlFRQWtRZ3NVQUNNL0JIOGpQd1VqUUFzRVFFRUJEd3RCQUFzZEFRRi9JQUVRaGdFaEFpQUFJQUVRaHdFUUJpQUFRUUZxSUFJUUJndUNBUUVCZjBFQUVJSUNJQUJCai80REVBTVFSQ0lCSkhkQmovNERJQUVRQmlNOFFRSnJRZi8vQTNFa1BCQ0lBaG9qUENNOUVJa0NBa0FDUUFKQUFrQWdBQVJBQWtBZ0FFRUJhdzRFQWdNQUJBQUxEQVFMUVFBa2MwSEFBQ1E5REFNTFFRQWtkRUhJQUNROURBSUxRUUFrZFVIUUFDUTlEQUVMUVFBa2RrSGdBQ1E5Q3d1L0FRRUNmeU9JQVFSQVFRRWtod0ZCQUNTSUFRc2pjaU4zY1VFZmNVRUFTZ1JBSTRjQkJIOGpRRVVGSTRjQkN5SUFCRUFqYmdSL0kzTUZJMjRMSWdBRVFFRUFFSW9DUVFFaEFRVWpid1IvSTNRRkkyOExJZ0FFUUVFQkVJb0NRUUVoQVFVamNBUi9JM1VGSTNBTElnQUVRRUVDRUlvQ1FRRWhBUVVqY1FSL0kzWUZJM0VMSWdBRVFFRUVFSW9DUVFFaEFRc0xDd3NMUVFBaEFDQUJCRUJCRkNFQUVJZ0NCRUFRaHdKQkdDRUFDd3NRaUFJRVFCQ0hBZ3NnQUE4TFFRQUxLQUFqaFFFZ0FHb2toUUVqaFFFamd3Rk9CRUFqaEFGQkFXb2toQUVqaFFFamd3RnJKSVVCQ3d0eEFRSi9RUUVRRlNOQkJFQWpQUkFEUWY4QmNSQ0dBaERGQVJDSEFnc1Fpd0lpQVVFQVNnUkFJQUVReFFFTFFRUWhBQkNJQWtVaUFRUkFJMEpGSVFFTElBRUVRQ005RUFOQi93RnhFSVlDSVFBTEl6dEI4QUZ4SkRzZ0FFRUFUQVJBSUFBUEN5QUFFTVVCUVFFUWpBSWdBQXNRQUNNekJFQkJvTWtJRHd0QjBLUUVDd1FBSTE4THpnRUJCSDlCZ0FnaEF5QUJRUUJLQkVBZ0FTRURCU0FCUVFCSUJFQkJmeUVEQ3d0QkFDRUJBMEFnQmtVaUFBUkFJQUZGSVFBTElBQUVRQ0FFUlNFQUN5QUFCRUFnQlVVaEFBc2dBQVJBRUkwQ1FRQklCRUJCQVNFR0JTTStFSTRDVGdSQVFRRWhBUVVnQTBGL1NpSUFCRUFRandJZ0EwNGhBQXNnQUFSQVFRRWhCQVVnQWtGL1NpSUFCRUFqUFNBQ1JpRUFDeUFBQkVCQkFTRUZDd3NMQ3d3QkN3c2dBUVJBSXo0UWpnSnJKRDVCQUE4TElBUUVRRUVCRHdzZ0JRUkFRUUlQQ3lNOVFRRnJFRHdrUFVGL0N3c0FRUUZCZjBGL0VKQUNDemdCQTM4RFFDQUNJQUJJSWdNRVFDQUJRUUJPSVFNTElBTUVRQkNSQWlFQklBSkJBV29oQWd3QkN3c2dBVUVBU0FSQUlBRVBDMEVBQ3dzQVFRRWdBRUYvRUpBQ0N4b0JBWDlCQVVGL0lBQVFrQUlpQVVFQ1JnUkFRUUVQQ3lBQkN3VUFJNEFCQ3dVQUk0RUJDd1VBSTRJQkMxOEJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVFKQUlBRkJBbXNPQmdNRUJRWUhDQUFMREFnTEk5Z0JEd3NqMlFFUEN5UGFBUThMSTlzQkR3c2ozQUVQQ3lQZEFROExJOTRCRHdzajN3RVBDMEVBQzRzQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQ1FRRkdEUUVDUUNBQ1FRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lBQlFRRnhKTmdCREFjTElBRkJBWEVrMlFFTUJnc2dBVUVCY1NUYUFRd0ZDeUFCUVFGeEpOc0JEQVFMSUFGQkFYRWszQUVNQXdzZ0FVRUJjU1RkQVF3Q0N5QUJRUUZ4Sk40QkRBRUxJQUZCQVhFazN3RUxDd29BUVFFa2RrRUVFRjBMWkFFQ2YwRUFKRUlnQUJDWUFrVUVRRUVCSVFFTElBQkJBUkNaQWlBQkJFQkJBQ0VCSUFCQkEwd0VRRUVCSVFFTEk2MEJCSDhnQVFVanJRRUxJZ0FFUUVFQklRSUxJNjRCQkg4Z0FVVUZJNjRCQ3lJQUJFQkJBU0VDQ3lBQ0JFQVFtZ0lMQ3dzSkFDQUFRUUFRbVFJTG1nRUFJQUJCQUVvRVFFRUFFSnNDQlVFQUVKd0NDeUFCUVFCS0JFQkJBUkNiQWdWQkFSQ2NBZ3NnQWtFQVNnUkFRUUlRbXdJRlFRSVFuQUlMSUFOQkFFb0VRRUVERUpzQ0JVRURFSndDQ3lBRVFRQktCRUJCQkJDYkFnVkJCQkNjQWdzZ0JVRUFTZ1JBUVFVUW13SUZRUVVRbkFJTElBWkJBRW9FUUVFR0VKc0NCVUVHRUp3Q0N5QUhRUUJLQkVCQkJ4Q2JBZ1ZCQnhDY0Fnc0xCQUFqTkFzRUFDTTFDd1FBSXpZTEJBQWpOd3NFQUNNNEN3UUFJemtMQkFBak9nc0VBQ003Q3dRQUl6MExCQUFqUEFzR0FDTTlFQU1MQkFBalN3dWZBd0VLZjBHQWtBSWhDU09uQVFSQVFZQ0FBaUVKQzBHQXNBSWhDaU9vQVFSQVFZQzRBaUVLQ3dKQUEwQWdCRUdBQWs0TkFRSkFRUUFoQlFOQUlBVkJnQUpPRFFFZ0NTQUtJQVJCQTNWQkJYUnFJQVZCQTNWcUlnWkJBQkEvRUVnaENDQUVRUWh2SVFGQkJ5QUZRUWh2YXlFSFFRQWhBaU12Qkg4Z0FFRUFTZ1VqTHdzaUF3UkFJQVpCQVJBL0lRSUxRUVlnQWhBUUJFQkJCeUFCYXlFQkMwRUFJUU5CQXlBQ0VCQUVRRUVCSVFNTElBZ2dBVUVCZEdvaUJpQURFRDhoQ0VFQUlRRWdCeUFHUVFGcUlBTVFQeEFRQkVCQkFpRUJDeUFISUFnUUVBUkFJQUZCQVdvaEFRc2dCRUVJZENBRmFrRURiQ0VISXk4RWZ5QUFRUUJLQlNNdkN5SURCRUJCQUNBQ1FRZHhJQUZCQUJCTElnRVFUQ0VHUVFFZ0FSQk1JUU5CQWlBQkVFd2hBU0FIUVlDWURtb2lBaUFHT2dBQUlBSkJBV29nQXpvQUFDQUNRUUpxSUFFNkFBQUZJQUZCeC80RFFRQVFUU0VDQWtCQkFDRUJBMEFnQVVFRFRnMEJJQWRCZ0pnT2FpQUJhaUFDT2dBQUlBRkJBV29oQVF3QUFBc0FDd3NnQlVFQmFpRUZEQUFBQ3dBTElBUkJBV29oQkF3QUFBc0FDd3ZUQVFFR2Z3SkFBMEFnQWtFWFRnMEJBa0JCQUNFQUEwQWdBRUVmVGcwQlFRQWhCQ0FBUVE5S0JFQkJBU0VFQ3lBQ0lRRWdBa0VQU2dSQUlBRkJEMnNoQVFzZ0FVRUVkQ0VCSUFCQkQwb0VmeUFCSUFCQkQydHFCU0FCSUFCcUN5RUJRWUNBQWlFRklBSkJEMG9FUUVHQWtBSWhCUXNDUUVFQUlRTURRQ0FEUVFoT0RRRWdBU0FGSUFSQkFFRUhJQU1nQUVFRGRDQUNRUU4wSUFOcVFmZ0JRWUNZR2tFQlFRQkJmeEJQR2lBRFFRRnFJUU1NQUFBTEFBc2dBRUVCYWlFQURBQUFDd0FMSUFKQkFXb2hBZ3dBQUFzQUN3c0VBQ041Q3dRQUkzb0xCQUFqZXdzWEFRRi9JMzBoQUNOOEJFQkJBaUFBRUVVaEFBc2dBQXNVQUQ4QVFZc0JTQVJBUVlzQlB3QnJRQUFhQ3dzZEFBSkFBa0FDUUNPRUFnNENBUUlBQ3dBTFFRQWhBQXNnQUJDVEFnc0hBQ0FBSklRQ0N6RUFBa0FDUUFKQUFrQUNRQ09FQWc0RUFRSURCQUFMQUF0QkFTRUFDMEYvSVFFTFFYOGhBZ3NnQUNBQklBSVFrQUlMQUxKaUJHNWhiV1VCcW1LMEFnQWxZMjl5WlM5dFpXMXZjbmt2WW1GdWEybHVaeTluWlhSU2IyMUNZVzVyUVdSa2NtVnpjd0VsWTI5eVpTOXRaVzF2Y25rdlltRnVhMmx1Wnk5blpYUlNZVzFDWVc1clFXUmtjbVZ6Y3dJM1kyOXlaUzl0WlcxdmNua3ZiV1Z0YjNKNVRXRndMMmRsZEZkaGMyMUNiM2xQWm1aelpYUkdjbTl0UjJGdFpVSnZlVTltWm5ObGRBTXBZMjl5WlM5dFpXMXZjbmt2Ykc5aFpDOWxhV2RvZEVKcGRFeHZZV1JHY205dFIwSk5aVzF2Y25rRUdtTnZjbVV2WTNCMUwyTndkUzlwYm1sMGFXRnNhWHBsUTNCMUJTWmpiM0psTDIxbGJXOXllUzl0WlcxdmNua3ZhVzVwZEdsaGJHbDZaVU5oY25SeWFXUm5aUVlyWTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2WldsbmFIUkNhWFJUZEc5eVpVbHVkRzlIUWsxbGJXOXllUWNkWTI5eVpTOXRaVzF2Y25rdlpHMWhMMmx1YVhScFlXeHBlbVZFYldFSUtXTnZjbVV2WjNKaGNHaHBZM012WjNKaGNHaHBZM012YVc1cGRHbGhiR2w2WlVkeVlYQm9hV056Q1NkamIzSmxMMmR5WVhCb2FXTnpMM0JoYkdWMGRHVXZhVzVwZEdsaGJHbDZaVkJoYkdWMGRHVUtKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1YVc1cGRHbGhiR2w2WlFzblkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01pOURhR0Z1Ym1Wc01pNXBibWwwYVdGc2FYcGxEQ2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG1sdWFYUnBZV3hwZW1VTkoyTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVhVzVwZEdsaGJHbDZaUTR4WTI5eVpTOXpiM1Z1WkM5aFkyTjFiWFZzWVhSdmNpOXBibWwwYVdGc2FYcGxVMjkxYm1SQlkyTjFiWFZzWVhSdmNnOGdZMjl5WlM5emIzVnVaQzl6YjNWdVpDOXBibWwwYVdGc2FYcGxVMjkxYm1RUUlXTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOWphR1ZqYTBKcGRFOXVRbmwwWlJFOFkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlNXNTBaWEp5ZFhCMGN5NTFjR1JoZEdWSmJuUmxjbkoxY0hSRmJtRmliR1ZrRWo1amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5SmJuUmxjbkoxY0hSekxuVndaR0YwWlVsdWRHVnljblZ3ZEZKbGNYVmxjM1JsWkJNdlkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdmFXNXBkR2xoYkdsNlpVbHVkR1Z5Y25Wd2RITVVJMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlwYm1sMGFXRnNhWHBsVkdsdFpYSnpGUnRqYjNKbEwyTnZjbVV2YzJWMFNHRnpRMjl5WlZOMFlYSjBaV1FXRjJOdmNtVXZZM2xqYkdWekwzSmxjMlYwUTNsamJHVnpGeGRqYjNKbEwyVjRaV04xZEdVdmNtVnpaWFJUZEdWd2N4Z1VZMjl5WlM5amIzSmxMMmx1YVhScFlXeHBlbVVaRUdOdmNtVXZZMjl5WlM5amIyNW1hV2NhR0dOdmNtVXZZMjl5WlM5b1lYTkRiM0psVTNSaGNuUmxaQnNpWTI5eVpTOWpiM0psTDJkbGRGTmhkbVZUZEdGMFpVMWxiVzl5ZVU5bVpuTmxkQnd5WTI5eVpTOXRaVzF2Y25rdmMzUnZjbVV2YzNSdmNtVkNiMjlzWldGdVJHbHlaV04wYkhsVWIxZGhjMjFOWlcxdmNua2RHbU52Y21VdlkzQjFMMk53ZFM5RGNIVXVjMkYyWlZOMFlYUmxIaWxqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxuTmhkbVZUZEdGMFpSOHZZMjl5WlM5cGJuUmxjbkoxY0hSekwybHVkR1Z5Y25Wd2RITXZTVzUwWlhKeWRYQjBjeTV6WVhabFUzUmhkR1VnSTJOdmNtVXZhbTk1Y0dGa0wycHZlWEJoWkM5S2IzbHdZV1F1YzJGMlpWTjBZWFJsSVNOamIzSmxMMjFsYlc5eWVTOXRaVzF2Y25rdlRXVnRiM0o1TG5OaGRtVlRkR0YwWlNJalkyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1ellYWmxVM1JoZEdVaklHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1YzJGMlpWTjBZWFJsSkNaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuTmhkbVZUZEdGMFpTVW1ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNNaTlEYUdGdWJtVnNNaTV6WVhabFUzUmhkR1VtSm1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWMyRjJaVk4wWVhSbEp5WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMbk5oZG1WVGRHRjBaU2dUWTI5eVpTOWpiM0psTDNOaGRtVlRkR0YwWlNreVkyOXlaUzl0WlcxdmNua3ZiRzloWkM5c2IyRmtRbTl2YkdWaGJrUnBjbVZqZEd4NVJuSnZiVmRoYzIxTlpXMXZjbmtxR21OdmNtVXZZM0IxTDJOd2RTOURjSFV1Ykc5aFpGTjBZWFJsS3laamIzSmxMMmR5WVhCb2FXTnpMMnhqWkM5TVkyUXVkWEJrWVhSbFRHTmtRMjl1ZEhKdmJDd3BZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5SGNtRndhR2xqY3k1c2IyRmtVM1JoZEdVdEwyTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwwbHVkR1Z5Y25Wd2RITXViRzloWkZOMFlYUmxMaVpqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2U205NWNHRmtMblZ3WkdGMFpVcHZlWEJoWkM4alkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wwcHZlWEJoWkM1c2IyRmtVM1JoZEdVd0kyTnZjbVV2YldWdGIzSjVMMjFsYlc5eWVTOU5aVzF2Y25rdWJHOWhaRk4wWVhSbE1TTmpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxteHZZV1JUZEdGMFpUSWhZMjl5WlM5emIzVnVaQzl6YjNWdVpDOWpiR1ZoY2tGMVpHbHZRblZtWm1WeU15QmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG14dllXUlRkR0YwWlRRbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNXNiMkZrVTNSaGRHVTFKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1Ykc5aFpGTjBZWFJsTmlaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxteHZZV1JUZEdGMFpUY21ZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVzYjJGa1UzUmhkR1U0RTJOdmNtVXZZMjl5WlM5c2IyRmtVM1JoZEdVNUgyTnZjbVV2WlhobFkzVjBaUzluWlhSVGRHVndjMUJsY2xOMFpYQlRaWFE2R0dOdmNtVXZaWGhsWTNWMFpTOW5aWFJUZEdWd1UyVjBjenNWWTI5eVpTOWxlR1ZqZFhSbEwyZGxkRk4wWlhCelBDSmpiM0psTDNCdmNuUmhZbXhsTDNCdmNuUmhZbXhsTDNVeE5sQnZjblJoWW14bFBUZGpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDBkeVlYQm9hV056TGsxQldGOURXVU5NUlZOZlVFVlNYMU5EUVU1TVNVNUZQakpqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxtSmhkR05vVUhKdlkyVnpjME41WTJ4bGN6OG5ZMjl5WlM5bmNtRndhR2xqY3k5bmNtRndhR2xqY3k5c2IyRmtSbkp2YlZaeVlXMUNZVzVyUUNkamIzSmxMMmR5WVhCb2FXTnpMMmR5WVhCb2FXTnpMMmRsZEZKbllsQnBlR1ZzVTNSaGNuUkJKbU52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdmMyVjBVR2w0Wld4UGJrWnlZVzFsUWlSamIzSmxMMmR5WVhCb2FXTnpMM0J5YVc5eWFYUjVMMmRsZEZCcGVHVnNVM1JoY25SREttTnZjbVV2WjNKaGNHaHBZM012Y0hKcGIzSnBkSGt2WjJWMFVISnBiM0pwZEhsbWIzSlFhWGhsYkVRaFkyOXlaUzlvWld4d1pYSnpMMmx1WkdWNEwzSmxjMlYwUW1sMFQyNUNlWFJsUlI5amIzSmxMMmhsYkhCbGNuTXZhVzVrWlhndmMyVjBRbWwwVDI1Q2VYUmxSaXBqYjNKbEwyZHlZWEJvYVdOekwzQnlhVzl5YVhSNUwyRmtaRkJ5YVc5eWFYUjVabTl5VUdsNFpXeEhPbU52Y21VdlozSmhjR2hwWTNNdlltRmphMmR5YjNWdVpGZHBibVJ2ZHk5a2NtRjNUR2x1WlU5bVZHbHNaVVp5YjIxVWFXeGxRMkZqYUdWSUptTnZjbVV2WjNKaGNHaHBZM012ZEdsc1pYTXZaMlYwVkdsc1pVUmhkR0ZCWkdSeVpYTnpTVE5qYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmJHOWhaRkJoYkdWMGRHVkNlWFJsUm5KdmJWZGhjMjFOWlcxdmNubEtJMk52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzlqYjI1allYUmxibUYwWlVKNWRHVnpTeXhqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdloyVjBVbWRpUTI5c2IzSkdjbTl0VUdGc1pYUjBaVXd1WTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwyZGxkRU52Ykc5eVEyOXRjRzl1Wlc1MFJuSnZiVkpuWWswelkyOXlaUzluY21Gd2FHbGpjeTl3WVd4bGRIUmxMMmRsZEUxdmJtOWphSEp2YldWRGIyeHZja1p5YjIxUVlXeGxkSFJsVGlWamIzSmxMMmR5WVhCb2FXTnpMM1JwYkdWekwyZGxkRlJwYkdWUWFYaGxiRk4wWVhKMFR5eGpiM0psTDJkeVlYQm9hV056TDNScGJHVnpMMlJ5WVhkUWFYaGxiSE5HY205dFRHbHVaVTltVkdsc1pWQTNZMjl5WlM5bmNtRndhR2xqY3k5aVlXTnJaM0p2ZFc1a1YybHVaRzkzTDJSeVlYZE1hVzVsVDJaVWFXeGxSbkp2YlZScGJHVkpaRkUzWTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wyUnlZWGREYjJ4dmNsQnBlR1ZzUm5KdmJWUnBiR1ZKWkZJOFkyOXlaUzluY21Gd2FHbGpjeTlpWVdOclozSnZkVzVrVjJsdVpHOTNMMlJ5WVhkTmIyNXZZMmh5YjIxbFVHbDRaV3hHY205dFZHbHNaVWxrVXp0amIzSmxMMmR5WVhCb2FXTnpMMkpoWTJ0bmNtOTFibVJYYVc1a2IzY3ZaSEpoZDBKaFkydG5jbTkxYm1SWGFXNWtiM2RUWTJGdWJHbHVaVlF2WTI5eVpTOW5jbUZ3YUdsamN5OWlZV05yWjNKdmRXNWtWMmx1Wkc5M0wzSmxibVJsY2tKaFkydG5jbTkxYm1SVksyTnZjbVV2WjNKaGNHaHBZM012WW1GamEyZHliM1Z1WkZkcGJtUnZkeTl5Wlc1a1pYSlhhVzVrYjNkV0kyTnZjbVV2WjNKaGNHaHBZM012YzNCeWFYUmxjeTl5Wlc1a1pYSlRjSEpwZEdWelZ5UmpiM0psTDJkeVlYQm9hV056TDJkeVlYQm9hV056TDE5a2NtRjNVMk5oYm14cGJtVllLV052Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlgzSmxibVJsY2tWdWRHbHlaVVp5WVcxbFdTZGpiM0psTDJkeVlYQm9hV056TDNCeWFXOXlhWFI1TDJOc1pXRnlVSEpwYjNKcGRIbE5ZWEJhSW1OdmNtVXZaM0poY0docFkzTXZkR2xzWlhNdmNtVnpaWFJVYVd4bFEyRmphR1ZiTzJOdmNtVXZaM0poY0docFkzTXZaM0poY0docFkzTXZSM0poY0docFkzTXVUVWxPWDBOWlEweEZVMTlUVUZKSlZFVlRYMHhEUkY5TlQwUkZYRUZqYjNKbEwyZHlZWEJvYVdOekwyZHlZWEJvYVdOekwwZHlZWEJvYVdOekxrMUpUbDlEV1VOTVJWTmZWRkpCVGxOR1JWSmZSRUZVUVY5TVEwUmZUVTlFUlYwc1kyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlgzSmxjWFZsYzNSSmJuUmxjbkoxY0hSZUxtTnZjbVV2YVc1MFpYSnlkWEIwY3k5cGJuUmxjbkoxY0hSekwzSmxjWFZsYzNSTVkyUkpiblJsY25KMWNIUmZLV052Y21VdmMyOTFibVF2YzI5MWJtUXZVMjkxYm1RdVltRjBZMmhRY205alpYTnpRM2xqYkdWellDMWpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG0xaGVFWnlZVzFsVTJWeGRXVnVZMlZEZVdOc1pYTmhLV052Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1ZFhCa1lYUmxUR1Z1WjNSb1lpbGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVeGxibWQwYUdNcFkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc015OURhR0Z1Ym1Wc015NTFjR1JoZEdWTVpXNW5kR2hrS1dOdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRRdlEyaGhibTVsYkRRdWRYQmtZWFJsVEdWdVozUm9aU3hqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDJkbGRFNWxkMFp5WlhGMVpXNWplVVp5YjIxVGQyVmxjR1lwWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTVM5RGFHRnVibVZzTVM1elpYUkdjbVZ4ZFdWdVkzbG5NbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2WTJGc1kzVnNZWFJsVTNkbFpYQkJibVJEYUdWamEwOTJaWEptYkc5M2FDaGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpWTjNaV1Z3YVN0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlVWdWRtVnNiM0JsYWl0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlVWdWRtVnNiM0JsYXl0amIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlVWdWRtVnNiM0JsYkNWamIzSmxMM052ZFc1a0wzTnZkVzVrTDNWd1pHRjBaVVp5WVcxbFUyVnhkV1Z1WTJWeWJTNWpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMbmRwYkd4RGFHRnVibVZzVlhCa1lYUmxiaXBqYjNKbEwzTnZkVzVrTDJGalkzVnRkV3hoZEc5eUwyUnBaRU5vWVc1dVpXeEVZV05EYUdGdVoyVnZMbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREl2UTJoaGJtNWxiREl1ZDJsc2JFTm9ZVzV1Wld4VmNHUmhkR1Z3TG1OdmNtVXZjMjkxYm1RdlkyaGhibTVsYkRNdlEyaGhibTVsYkRNdWQybHNiRU5vWVc1dVpXeFZjR1JoZEdWeExtTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVkMmxzYkVOb1lXNXVaV3hWY0dSaGRHVnlKMk52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1Y21WelpYUlVhVzFsY25NOVkyOXlaUzl6YjNWdVpDOWtkWFI1TDJselJIVjBlVU41WTJ4bFEyeHZZMnRRYjNOcGRHbDJaVTl5VG1WbllYUnBkbVZHYjNKWFlYWmxabTl5YlhRbVkyOXlaUzl6YjNWdVpDOWphR0Z1Ym1Wc01TOURhR0Z1Ym1Wc01TNW5aWFJUWVcxd2JHVjFObU52Y21VdmMyOTFibVF2WTJoaGJtNWxiREV2UTJoaGJtNWxiREV1WjJWMFUyRnRjR3hsUm5KdmJVTjVZMnhsUTI5MWJuUmxjblluWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1eVpYTmxkRlJwYldWeWR5WmpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMbWRsZEZOaGJYQnNaWGcyWTI5eVpTOXpiM1Z1WkM5amFHRnVibVZzTWk5RGFHRnVibVZzTWk1blpYUlRZVzF3YkdWR2NtOXRRM2xqYkdWRGIzVnVkR1Z5ZVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuSmxjMlYwVkdsdFpYSjZJbU52Y21VdmNHOXlkR0ZpYkdVdmNHOXlkR0ZpYkdVdmFUTXlVRzl5ZEdGaWJHVjdKbU52Y21VdmMyOTFibVF2WTJoaGJtNWxiRE12UTJoaGJtNWxiRE11WjJWMFUyRnRjR3hsZkRaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxtZGxkRk5oYlhCc1pVWnliMjFEZVdOc1pVTnZkVzUwWlhKOU8yTnZjbVV2YzI5MWJtUXZZMmhoYm01bGJEUXZRMmhoYm01bGJEUXVaMlYwVG05cGMyVkRhR0Z1Ym1Wc1JuSmxjWFZsYm1ONVVHVnlhVzlrZmlaamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExtZGxkRk5oYlhCc1pYODJZMjl5WlM5emIzVnVaQzlqYUdGdWJtVnNOQzlEYUdGdWJtVnNOQzVuWlhSVFlXMXdiR1ZHY205dFEzbGpiR1ZEYjNWdWRHVnlnQUVjWTI5eVpTOWpjSFV2WTNCMUwwTndkUzVEVEU5RFMxOVRVRVZGUklFQkttTnZjbVV2YzI5MWJtUXZjMjkxYm1RdlUyOTFibVF1YldGNFJHOTNibE5oYlhCc1pVTjVZMnhsYzRJQktHTnZjbVV2YzI5MWJtUXZjMjkxYm1RdloyVjBVMkZ0Y0d4bFFYTlZibk5wWjI1bFpFSjVkR1dEQVNKamIzSmxMM052ZFc1a0wzTnZkVzVrTDIxcGVFTm9ZVzV1Wld4VFlXMXdiR1Z6aEFFelkyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5elpYUk1aV1owUVc1a1VtbG5hSFJQZFhSd2RYUkdiM0pCZFdScGIxRjFaWFZsaFFFbVkyOXlaUzl6YjNWdVpDOWhZMk4xYlhWc1lYUnZjaTloWTJOMWJYVnNZWFJsVTI5MWJtU0dBU0JqYjNKbEwyaGxiSEJsY25NdmFXNWtaWGd2YzNCc2FYUklhV2RvUW5sMFpZY0JIMk52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl6Y0d4cGRFeHZkMEo1ZEdXSUFSOWpiM0psTDNOdmRXNWtMM052ZFc1a0wyTmhiR04xYkdGMFpWTnZkVzVraVFFY1kyOXlaUzl6YjNWdVpDOXpiM1Z1WkM5MWNHUmhkR1ZUYjNWdVpJb0JJbU52Y21VdmMyOTFibVF2YzI5MWJtUXZZbUYwWTJoUWNtOWpaWE56UVhWa2FXK0xBU3RqYjNKbEwzTnZkVzVrTDNKbFoybHpkR1Z5Y3k5VGIzVnVaRkpsWjJsemRHVnlVbVZoWkZSeVlYQnpqQUVoWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDJkbGRFcHZlWEJoWkZOMFlYUmxqUUVrWTI5eVpTOXRaVzF2Y25rdmNtVmhaRlJ5WVhCekwyTm9aV05yVW1WaFpGUnlZWEJ6amdFeVkyOXlaUzl0WlcxdmNua3ZiRzloWkM5bGFXZG9kRUpwZEV4dllXUkdjbTl0UjBKTlpXMXZjbmxYYVhSb1ZISmhjSE9QQVNGamIzSmxMMjFsYlc5eWVTOWlZVzVyYVc1bkwyaGhibVJzWlVKaGJtdHBibWVRQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VEQ1JBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5Wd1pHRjBaVTVTZURDU0FTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlREdUQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuVndaR0YwWlU1U2VER1VBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d6TDBOb1lXNXVaV3d6TG5Wd1pHRjBaVTVTZURHVkFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMblZ3WkdGMFpVNVNlREdXQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuVndaR0YwWlU1U2VES1hBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d5TDBOb1lXNXVaV3d5TG5Wd1pHRjBaVTVTZURLWUFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlREtaQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuVndaR0YwWlU1U2VES2FBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3d4TDBOb1lXNXVaV3d4TG5Wd1pHRjBaVTVTZURPYkFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVNVNlRE9jQVNkamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuVndaR0YwWlU1U2VET2RBU2RqYjNKbEwzTnZkVzVrTDJOb1lXNXVaV3cwTDBOb1lXNXVaV3cwTG5Wd1pHRjBaVTVTZURPZUFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3hMME5vWVc1dVpXd3hMblZ3WkdGMFpVNVNlRFNmQVNSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eEwwTm9ZVzV1Wld3eExuUnlhV2RuWlhLZ0FTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3lMME5vWVc1dVpXd3lMblZ3WkdGMFpVNVNlRFNoQVNSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3eUwwTm9ZVzV1Wld3eUxuUnlhV2RuWlhLaUFTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXd3pMME5vWVc1dVpXd3pMblZ3WkdGMFpVNVNlRFNqQVNSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3ekwwTm9ZVzV1Wld3ekxuUnlhV2RuWlhLa0FTZGpiM0psTDNOdmRXNWtMMk5vWVc1dVpXdzBMME5vWVc1dVpXdzBMblZ3WkdGMFpVNVNlRFNsQVNSamIzSmxMM052ZFc1a0wyTm9ZVzV1Wld3MEwwTm9ZVzV1Wld3MExuUnlhV2RuWlhLbUFTRmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG5Wd1pHRjBaVTVTTlRDbkFTRmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG5Wd1pHRjBaVTVTTlRHb0FTRmpiM0psTDNOdmRXNWtMM052ZFc1a0wxTnZkVzVrTG5Wd1pHRjBaVTVTTlRLcEFTeGpiM0psTDNOdmRXNWtMM0psWjJsemRHVnljeTlUYjNWdVpGSmxaMmx6ZEdWeVYzSnBkR1ZVY21Gd2M2b0JKV052Y21VdlozSmhjR2hwWTNNdmJHTmtMMHhqWkM1MWNHUmhkR1ZNWTJSVGRHRjBkWE9yQVNCamIzSmxMMjFsYlc5eWVTOWtiV0V2YzNSaGNuUkViV0ZVY21GdWMyWmxjcXdCSjJOdmNtVXZiV1Z0YjNKNUwyUnRZUzluWlhSSVpHMWhVMjkxY21ObFJuSnZiVTFsYlc5eWVhMEJMR052Y21VdmJXVnRiM0o1TDJSdFlTOW5aWFJJWkcxaFJHVnpkR2x1WVhScGIyNUdjbTl0VFdWdGIzSjVyZ0VoWTI5eVpTOXRaVzF2Y25rdlpHMWhMM04wWVhKMFNHUnRZVlJ5WVc1elptVnlyd0V5WTI5eVpTOW5jbUZ3YUdsamN5OXdZV3hsZEhSbEwzTjBiM0psVUdGc1pYUjBaVUo1ZEdWSmJsZGhjMjFOWlcxdmNubXdBVEJqYjNKbEwyZHlZWEJvYVdOekwzQmhiR1YwZEdVdmFXNWpjbVZ0Wlc1MFVHRnNaWFIwWlVsdVpHVjRTV1pUWlhTeEFTOWpiM0psTDJkeVlYQm9hV056TDNCaGJHVjBkR1V2ZDNKcGRHVkRiMnh2Y2xCaGJHVjBkR1ZVYjAxbGJXOXllYklCTUdOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JVYVcxbGNrbHVkR1Z5Y25Wd2RMTUJLbU52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlmWjJWMFZHbHRaWEpEYjNWdWRHVnlUV0Z6YTBKcGRMUUJPMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlmWTJobFkydEVhWFpwWkdWeVVtVm5hWE4wWlhKR1lXeHNhVzVuUldSblpVUmxkR1ZqZEc5eXRRRXBZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMTlwYm1OeVpXMWxiblJVYVcxbGNrTnZkVzUwWlhLMkFSOWpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZkWEJrWVhSbFZHbHRaWEp6dHdFbFkyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwySmhkR05vVUhKdlkyVnpjMVJwYldWeWM3Z0JMMk52Y21VdmRHbHRaWEp6TDNScGJXVnljeTlVYVcxbGNuTXVkWEJrWVhSbFJHbDJhV1JsY2xKbFoybHpkR1Z5dVFFc1kyOXlaUzkwYVcxbGNuTXZkR2x0WlhKekwxUnBiV1Z5Y3k1MWNHUmhkR1ZVYVcxbGNrTnZkVzUwWlhLNkFTdGpiM0psTDNScGJXVnljeTkwYVcxbGNuTXZWR2x0WlhKekxuVndaR0YwWlZScGJXVnlUVzlrZFd4dnV3RXNZMjl5WlM5MGFXMWxjbk12ZEdsdFpYSnpMMVJwYldWeWN5NTFjR1JoZEdWVWFXMWxja052Ym5SeWIyeThBU1pqYjNKbEwyMWxiVzl5ZVM5M2NtbDBaVlJ5WVhCekwyTm9aV05yVjNKcGRHVlVjbUZ3YzcwQk5HTnZjbVV2YldWdGIzSjVMM04wYjNKbEwyVnBaMmgwUW1sMFUzUnZjbVZKYm5SdlIwSk5aVzF2Y25sWGFYUm9WSEpoY0hPK0FSeGpiM0psTDIxbGJXOXllUzlrYldFdmFHUnRZVlJ5WVc1elptVnl2d0VnWTI5eVpTOXRaVzF2Y25rdlpHMWhMM1Z3WkdGMFpVaGliR0Z1YTBoa2JXSEFBVEZqYjNKbEwybHVkR1Z5Y25Wd2RITXZhVzUwWlhKeWRYQjBjeTl5WlhGMVpYTjBWa0pzWVc1clNXNTBaWEp5ZFhCMHdRRWVZMjl5WlM5bmNtRndhR2xqY3k5c1kyUXZjMlYwVEdOa1UzUmhkSFZ6d2dFbFkyOXlaUzluY21Gd2FHbGpjeTluY21Gd2FHbGpjeTkxY0dSaGRHVkhjbUZ3YUdsamM4TUJLMk52Y21VdlozSmhjR2hwWTNNdlozSmhjR2hwWTNNdlltRjBZMmhRY205alpYTnpSM0poY0docFkzUEVBUnBqYjNKbEwyTjVZMnhsY3k5MGNtRmphME41WTJ4bGMxSmhic1VCRm1OdmNtVXZZM2xqYkdWekwzTjVibU5EZVdOc1pYUEdBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmRsZEVSaGRHRkNlWFJsVkhkdnh3RWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW5aWFJFWVhSaFFubDBaVTl1WmNnQktHTnZjbVV2WTNCMUwyOXdZMjlrWlhNdloyVjBRMjl1WTJGMFpXNWhkR1ZrUkdGMFlVSjVkR1hKQVNoamIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJWcFoyaDBRbWwwVTNSdmNtVlRlVzVqUTNsamJHVnp5Z0VaWTI5eVpTOWpjSFV2Wm14aFozTXZjMlYwUm14aFowSnBkTXNCSDJOdmNtVXZZM0IxTDJac1lXZHpMM05sZEVoaGJHWkRZWEp5ZVVac1lXZk1BUzlqYjNKbEwyTndkUzltYkdGbmN5OWphR1ZqYTBGdVpGTmxkRVZwWjJoMFFtbDBTR0ZzWmtOaGNuSjVSbXhoWjgwQkdtTnZjbVV2WTNCMUwyWnNZV2R6TDNObGRGcGxjbTlHYkdGbnpnRWVZMjl5WlM5amNIVXZabXhoWjNNdmMyVjBVM1ZpZEhKaFkzUkdiR0ZuendFYlkyOXlaUzlqY0hVdlpteGhaM012YzJWMFEyRnljbmxHYkdGbjBBRWhZMjl5WlM5b1pXeHdaWEp6TDJsdVpHVjRMM0p2ZEdGMFpVSjVkR1ZNWldaMDBRRTJZMjl5WlM5dFpXMXZjbmt2YzNSdmNtVXZjMmw0ZEdWbGJrSnBkRk4wYjNKbFNXNTBiMGRDVFdWdGIzSjVWMmwwYUZSeVlYQnowZ0VxWTI5eVpTOWpjSFV2YjNCamIyUmxjeTl6YVhoMFpXVnVRbWwwVTNSdmNtVlRlVzVqUTNsamJHVnowd0UwWTI5eVpTOWpjSFV2Wm14aFozTXZZMmhsWTJ0QmJtUlRaWFJUYVhoMFpXVnVRbWwwUm14aFozTkJaR1JQZG1WeVpteHZkOVFCSjJOdmNtVXZZM0IxTDI5d1kyOWtaWE12WldsbmFIUkNhWFJNYjJGa1UzbHVZME41WTJ4bGM5VUJJbU52Y21VdmFHVnNjR1Z5Y3k5cGJtUmxlQzl5YjNSaGRHVkNlWFJsVW1sbmFIVFdBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRCNDF3RWJZMjl5WlM5amNIVXZabXhoWjNNdloyVjBRMkZ5Y25sR2JHRm4yQUV0WTI5eVpTOW9aV3h3WlhKekwybHVaR1Y0TDNKdmRHRjBaVUo1ZEdWTVpXWjBWR2h5YjNWbmFFTmhjbko1MlFFaFkyOXlaUzl3YjNKMFlXSnNaUzl3YjNKMFlXSnNaUzlwT0ZCdmNuUmhZbXhsMmdFaVkyOXlaUzlqY0hVdmFXNXpkSEoxWTNScGIyNXpMM0psYkdGMGFYWmxTblZ0Y05zQkxtTnZjbVV2YUdWc2NHVnljeTlwYm1SbGVDOXliM1JoZEdWQ2VYUmxVbWxuYUhSVWFISnZkV2RvUTJGeWNubmNBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRGNDNRRWFZMjl5WlM5amNIVXZabXhoWjNNdloyVjBXbVZ5YjBac1lXZmVBUjlqYjNKbEwyTndkUzltYkdGbmN5OW5aWFJJWVd4bVEyRnljbmxHYkdGbjN3RWVZMjl5WlM5amNIVXZabXhoWjNNdloyVjBVM1ZpZEhKaFkzUkdiR0ZuNEFFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVXllT0VCSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbE0zamlBUjlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlRSNDR3RWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1UxZU9RQkgyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxObmpsQVJ0amIzSmxMMk53ZFM5amNIVXZRM0IxTG1WdVlXSnNaVWhoYkhUbUFSOWpiM0psTDJOd2RTOXZjR052WkdWekwyaGhibVJzWlU5d1kyOWtaVGQ0NXdFclkyOXlaUzlqY0hVdlpteGhaM012WTJobFkydEJibVJUWlhSRmFXZG9kRUpwZEVOaGNuSjVSbXhoWitnQkltTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTloWkdSQlVtVm5hWE4wWlhMcEFTNWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12WVdSa1FWUm9jbTkxWjJoRFlYSnllVkpsWjJsemRHVnk2Z0VmWTI5eVpTOWpjSFV2YjNCamIyUmxjeTlvWVc1a2JHVlBjR052WkdVNGVPc0JJbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5emRXSkJVbVZuYVhOMFpYTHNBUzVqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMzVmlRVlJvY205MVoyaERZWEp5ZVZKbFoybHpkR1Z5N1FFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVTVlTzRCSW1OdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWhibVJCVW1WbmFYTjBaWEx2QVNKamIzSmxMMk53ZFM5cGJuTjBjblZqZEdsdmJuTXZlRzl5UVZKbFoybHpkR1Z5OEFFZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkJlUEVCSVdOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OXZja0ZTWldkcGMzUmxjdklCSVdOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OWpjRUZTWldkcGMzUmxjdk1CSDJOdmNtVXZZM0IxTDI5d1kyOWtaWE12YUdGdVpHeGxUM0JqYjJSbFFuajBBU3RqYjNKbEwyMWxiVzl5ZVM5c2IyRmtMM05wZUhSbFpXNUNhWFJNYjJGa1JuSnZiVWRDVFdWdGIzSjU5UUVwWTI5eVpTOWpjSFV2YjNCamIyUmxjeTl6YVhoMFpXVnVRbWwwVEc5aFpGTjVibU5EZVdOc1pYUDJBU2hqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmNtOTBZWFJsVW1WbmFYTjBaWEpNWldaMDl3RXBZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKdmRHRjBaVkpsWjJsemRHVnlVbWxuYUhUNEFUUmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12Y205MFlYUmxVbVZuYVhOMFpYSk1aV1owVkdoeWIzVm5hRU5oY25KNStRRTFZMjl5WlM5amNIVXZhVzV6ZEhKMVkzUnBiMjV6TDNKdmRHRjBaVkpsWjJsemRHVnlVbWxuYUhSVWFISnZkV2RvUTJGeWNubjZBU2RqYjNKbEwyTndkUzlwYm5OMGNuVmpkR2x2Ym5NdmMyaHBablJNWldaMFVtVm5hWE4wWlhMN0FUSmpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUlNhV2RvZEVGeWFYUm9iV1YwYVdOU1pXZHBjM1JsY3Z3QksyTnZjbVV2WTNCMUwybHVjM1J5ZFdOMGFXOXVjeTl6ZDJGd1RtbGlZbXhsYzA5dVVtVm5hWE4wWlhMOUFTOWpiM0psTDJOd2RTOXBibk4wY25WamRHbHZibk12YzJocFpuUlNhV2RvZEV4dloybGpZV3hTWldkcGMzUmxjdjRCSjJOdmNtVXZZM0IxTDJsdWMzUnlkV04wYVc5dWN5OTBaWE4wUW1sMFQyNVNaV2RwYzNSbGN2OEJKbU52Y21VdlkzQjFMMmx1YzNSeWRXTjBhVzl1Y3k5elpYUkNhWFJQYmxKbFoybHpkR1Z5Z0FJaFkyOXlaUzlqY0hVdlkySlBjR052WkdWekwyaGhibVJzWlVOaVQzQmpiMlJsZ1FJZlkyOXlaUzlqY0hVdmIzQmpiMlJsY3k5b1lXNWtiR1ZQY0dOdlpHVkRlSUlDS0dOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNObGRFbHVkR1Z5Y25Wd2RIT0RBaDlqYjNKbEwyTndkUzl2Y0dOdlpHVnpMMmhoYm1Sc1pVOXdZMjlrWlVSNGhBSWZZMjl5WlM5amNIVXZiM0JqYjJSbGN5OW9ZVzVrYkdWUGNHTnZaR1ZGZUlVQ0gyTnZjbVV2WTNCMUwyOXdZMjlrWlhNdmFHRnVaR3hsVDNCamIyUmxSbmlHQWg1amIzSmxMMk53ZFM5dmNHTnZaR1Z6TDJWNFpXTjFkR1ZQY0dOdlpHV0hBaUJqYjNKbEwyTndkUzlqY0hVdlEzQjFMbVY0YVhSSVlXeDBRVzVrVTNSdmNJZ0NHV052Y21VdlkzQjFMMk53ZFM5RGNIVXVhWE5JWVd4MFpXU0pBaTFqYjNKbEwyMWxiVzl5ZVM5emRHOXlaUzl6YVhoMFpXVnVRbWwwVTNSdmNtVkpiblJ2UjBKTlpXMXZjbm1LQWl0amIzSmxMMmx1ZEdWeWNuVndkSE12YVc1MFpYSnlkWEIwY3k5ZmFHRnVaR3hsU1c1MFpYSnlkWEIwaXdJcVkyOXlaUzlwYm5SbGNuSjFjSFJ6TDJsdWRHVnljblZ3ZEhNdlkyaGxZMnRKYm5SbGNuSjFjSFJ6akFJYVkyOXlaUzlsZUdWamRYUmxMM1J5WVdOclUzUmxjSE5TWVc2TkFoaGpiM0psTDJWNFpXTjFkR1V2WlhobFkzVjBaVk4wWlhDT0FpVmpiM0psTDJOd2RTOWpjSFV2UTNCMUxrMUJXRjlEV1VOTVJWTmZVRVZTWDBaU1FVMUZqd0l3WTI5eVpTOXpiM1Z1WkM5emIzVnVaQzluWlhST2RXMWlaWEpQWmxOaGJYQnNaWE5KYmtGMVpHbHZRblZtWm1WeWtBSWlZMjl5WlM5bGVHVmpkWFJsTDJWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJwRUNHV052Y21VdlpYaGxZM1YwWlM5bGVHVmpkWFJsUm5KaGJXV1NBaUpqYjNKbEwyVjRaV04xZEdVdlpYaGxZM1YwWlUxMWJIUnBjR3hsUm5KaGJXVnprd0ltWTI5eVpTOWxlR1ZqZFhSbEwyVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVcrVUFpaGpiM0psTDJWNFpXTjFkR1V2WlhobFkzVjBaVVp5WVcxbFZXNTBhV3hDY21WaGEzQnZhVzUwbFFJZ1kyOXlaUzlqZVdOc1pYTXZaMlYwUTNsamJHVnpVR1Z5UTNsamJHVlRaWFNXQWhoamIzSmxMMk41WTJ4bGN5OW5aWFJEZVdOc1pWTmxkSE9YQWhWamIzSmxMMk41WTJ4bGN5OW5aWFJEZVdOc1pYT1lBalJqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2WDJkbGRFcHZlWEJoWkVKMWRIUnZibE4wWVhSbFJuSnZiVUoxZEhSdmJrbGttUUkwWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDE5elpYUktiM2x3WVdSQ2RYUjBiMjVUZEdGMFpVWnliMjFDZFhSMGIyNUpaSm9DTVdOdmNtVXZhVzUwWlhKeWRYQjBjeTlwYm5SbGNuSjFjSFJ6TDNKbGNYVmxjM1JLYjNsd1lXUkpiblJsY25KMWNIU2JBaVZqYjNKbEwycHZlWEJoWkM5cWIzbHdZV1F2WDNCeVpYTnpTbTk1Y0dGa1FuVjBkRzl1bkFJblkyOXlaUzlxYjNsd1lXUXZhbTk1Y0dGa0wxOXlaV3hsWVhObFNtOTVjR0ZrUW5WMGRHOXVuUUloWTI5eVpTOXFiM2x3WVdRdmFtOTVjR0ZrTDNObGRFcHZlWEJoWkZOMFlYUmxuZ0loWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkJud0loWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkNvQUloWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkRvUUloWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkVvZ0loWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkZvd0loWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSklwQUloWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSk1wUUloWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVbVZuYVhOMFpYSkdwZ0ltWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTFqY0hVdloyVjBVSEp2WjNKaGJVTnZkVzUwWlhLbkFpUmpiM0psTDJSbFluVm5MMlJsWW5WbkxXTndkUzluWlhSVGRHRmphMUJ2YVc1MFpYS29BaTVqYjNKbEwyUmxZblZuTDJSbFluVm5MV053ZFM5blpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5cVFJZlkyOXlaUzlrWldKMVp5OWtaV0oxWnkxbmNtRndhR2xqY3k5blpYUk1XYW9DTjJOdmNtVXZaR1ZpZFdjdlpHVmlkV2N0WjNKaGNHaHBZM012WkhKaGQwSmhZMnRuY205MWJtUk5ZWEJVYjFkaGMyMU5aVzF2Y25tckFqSmpiM0psTDJSbFluVm5MMlJsWW5WbkxXZHlZWEJvYVdOekwyUnlZWGRVYVd4bFJHRjBZVlJ2VjJGemJVMWxiVzl5ZWF3Q0hXTnZjbVV2WkdWaWRXY3ZaR1ZpZFdjdGRHbHRaWEl2WjJWMFJFbFdyUUllWTI5eVpTOWtaV0oxWnk5a1pXSjFaeTEwYVcxbGNpOW5aWFJVU1UxQnJnSWRZMjl5WlM5a1pXSjFaeTlrWldKMVp5MTBhVzFsY2k5blpYUlVUVUd2QWgxamIzSmxMMlJsWW5WbkwyUmxZblZuTFhScGJXVnlMMmRsZEZSQlE3QUNCWE4wWVhKMHNRSXhZMjl5WlM5bGVHVmpkWFJsTDJWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzk4ZEhKaGJYQnZiR2x1WmJJQ0NINXpaWFJoY21kanN3SXRZMjl5WlM5bGVHVmpkWFJsTDJWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJueDBjbUZ0Y0c5c2FXNWxBRE1RYzI5MWNtTmxUV0Z3Y0dsdVoxVlNUQ0ZqYjNKbEwyUnBjM1F2WTI5eVpTNTFiblJ2ZFdOb1pXUXVkMkZ6YlM1dFlYQT0iKSkuaW5zdGFuY2U7CmNvbnN0IGI9bmV3IFVpbnQ4QXJyYXkoYS5leHBvcnRzLm1lbW9yeS5idWZmZXIpO3JldHVybntpbnN0YW5jZTphLGJ5dGVNZW1vcnk6Yix0eXBlOiJXZWIgQXNzZW1ibHkifX07bGV0IHIsQixkO2Q9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsCldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sZnJhbWVTa2lwQ291bnRlcjowLGN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjooYSk9Pntjb25zdCBiPW4oYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGcuQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhkLmdyYXBoaWNzV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShGLmJpbmQodm9pZCAwLGQpLGQuZ3JhcGhpY3NXb3JrZXJQb3J0KSk6Ik1FTU9SWSI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGQubWVtb3J5V29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShJLmJpbmQodm9pZCAwLGQpLGQubWVtb3J5V29ya2VyUG9ydCkpOgoiQ09OVFJPTExFUiI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGQuY29udHJvbGxlcldvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoSC5iaW5kKHZvaWQgMCxkKSxkLmNvbnRyb2xsZXJXb3JrZXJQb3J0KSk6IkFVRElPIj09PWIubWVzc2FnZS53b3JrZXJJZCYmKGQuYXVkaW9Xb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEcuYmluZCh2b2lkIDAsZCksZC5hdWRpb1dvcmtlclBvcnQpKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLklOU1RBTlRJQVRFX1dBU006KGFzeW5jKCk9PntsZXQgYTthPWF3YWl0IE0ocCk7ZC53YXNtSW5zdGFuY2U9YS5pbnN0YW5jZTtkLndhc21CeXRlTWVtb3J5PWEuYnl0ZU1lbW9yeTtrKGgoe3R5cGU6YS50eXBlfSxiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIGcuQ09ORklHOmQud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KGQsYi5tZXNzYWdlLmNvbmZpZyk7ZC5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zOwprKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLlJFU0VUX0FVRElPX1FVRVVFOmQud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZy5QTEFZOmlmKCFkLnBhdXNlZHx8IWQud2FzbUluc3RhbmNlfHwhZC53YXNtQnl0ZU1lbW9yeSl7ayhoKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTticmVha31kLnBhdXNlZD0hMTtkLmZwc1RpbWVTdGFtcHM9W107ZC5mcmFtZVNraXBDb3VudGVyPTA7ZC5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7QyhkLDFFMy9kLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7eihkKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLlBBVVNFOmQucGF1c2VkPSEwO2QudXBkYXRlSWQmJihjbGVhclRpbWVvdXQoZC51cGRhdGVJZCksZC51cGRhdGVJZD12b2lkIDApO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGcuUlVOX1dBU01fRVhQT1JUOmE9CmIubWVzc2FnZS5wYXJhbWV0ZXJzP2Qud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpkLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ayhoKHt0eXBlOmcuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBnLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPTA7bGV0IGM9ZC53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7Yi5tZXNzYWdlLnN0YXJ0JiYoYT1iLm1lc3NhZ2Uuc3RhcnQpO2IubWVzc2FnZS5lbmQmJihjPWIubWVzc2FnZS5lbmQpO2E9ZC53YXNtQnl0ZU1lbW9yeS5zbGljZShhLGMpLmJ1ZmZlcjtrKGgoe3R5cGU6Zy5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSBnLkdFVF9XQVNNX0NPTlNUQU5UOmsoaCh7dHlwZTpnLkdFVF9XQVNNX0NPTlNUQU5ULHJlc3BvbnNlOmQud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmNvbnN0YW50XS52YWx1ZU9mKCl9LApiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYil9fSxnZXRGUFM6KCk9PjA8ZC50aW1lU3RhbXBzVW50aWxSZWFkeT9kLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpkLmZwc1RpbWVTdGFtcHM/ZC5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGQubWVzc2FnZUhhbmRsZXIpfSkoKTsK";

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
	"responsive-gamepad": "0.1.3"
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
	assemblyscript: "github:AssemblyScript/assemblyscript#c769f65bacd5392e5c9efab112b33244fc0a0c8f",
	"babel-plugin-filter-imports": "^2.0.3",
	"babel-preset-env": "^1.6.1",
	"big-integer": "^1.6.38",
	"browser-detect": "^0.2.28",
	bulma: "^0.7.1",
	"chart.js": "^2.7.3",
	"chartjs-plugin-downsample": "^1.0.2",
	chota: "^0.5.2",
	concurrently: "^3.5.1",
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
