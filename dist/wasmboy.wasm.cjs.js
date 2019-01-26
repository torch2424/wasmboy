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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG0oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7bj9zZWxmLnBvc3RNZXNzYWdlKGEsYik6dC5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHAoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihuKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKG4pc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHQub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHIrKyxiPWAke2J9LSR7cn1gLDFFNTxyJiYocj0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBGKGEsYil7Yj1tKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBlLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmUuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKX19ZnVuY3Rpb24gRyhhLGIpe2I9bShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZS5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmUuR0VUX0NPTlNUQU5UU19ET05FLApXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZS5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSChhLGIpe2I9bShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZS5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gdyhhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6CjU8PWImJjY+PWI/ZD0yMDQ4OjE1PD1iJiYxOT49Yj9kPTMyNzY4OjI1PD1iJiYzMD49YiYmKGQ9MTMxMDcyKTtyZXR1cm4gZD9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04rZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24geChhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIEkoYSxiKXtiPW0oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGUuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApOwphLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTplLkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmQuYnVmZmVyfSxiLm1lc3NhZ2VJZCksW2QuYnVmZmVyXSk7YnJlYWs7Y2FzZSBlLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmUuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCeXRlc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpfSwKYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGUuU0VUX01FTU9SWTpkPU9iamVjdC5rZXlzKGIubWVzc2FnZSk7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUk9NXSksYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2QuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuR0FNRUJPWV9NRU1PUlldKSxhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLAphLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pO2QuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5JTlRFUk5BTF9TVEFURV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6ZS5TRVRfTUVNT1JZX0RPTkV9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBlLkdFVF9NRU1PUlk6e2Q9e3R5cGU6ZS5HRVRfTUVNT1JZfTtjb25zdCBrPVtdO3ZhciBjPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBmPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbD12b2lkIDA7MD09PWY/bD0zMjc2ODoxPD0KZiYmMz49Zj9sPTIwOTcxNTI6NTw9ZiYmNj49Zj9sPTI2MjE0NDoxNTw9ZiYmMTk+PWY/bD0yMDk3MTUyOjI1PD1mJiYzMD49ZiYmKGw9ODM4ODYwOCk7Zj1sP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbCk6bmV3IFVpbnQ4QXJyYXl9ZWxzZSBmPW5ldyBVaW50OEFycmF5O2Y9Zi5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWY7ay5wdXNoKGYpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGY9dyhhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWYsay5wdXNoKGYpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhmPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxmPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZixmKzI3KSk6Zj1uZXcgVWludDhBcnJheSxmPWYuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT0KZixrLnB1c2goZikpO2MuaW5jbHVkZXMoZy5HQU1FQk9ZX01FTU9SWSkmJihmPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5HQU1FQk9ZX01FTU9SWV09ZixrLnB1c2goZikpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihmPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZixrLnB1c2goZikpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9eChhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT0KYyxrLnB1c2goYykpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGQsYi5tZXNzYWdlSWQpLGspfX19ZnVuY3Rpb24gSihhKXtjb25zdCBiPSJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGItMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTthLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB5KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIHooYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTiwKYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OK2EuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkUpLmJ1ZmZlcjthLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmUuVVBEQVRFRCxncmFwaGljc0ZyYW1lQnVmZmVyOmJ9KSxbYl0pfWZ1bmN0aW9uIEEoYSl7dmFyIGI9KCJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUItYjswPmImJihiPTApO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0MoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEMoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoQj1iKTtxPWEuZ2V0RlBTKCk7aWYocT5hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxKXJldHVybiBhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKSxBKGEpLCEwO0ooYSk7Y29uc3QgZD0hYS5vcHRpb25zLmhlYWRsZXNzJiYKIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgYztkP3UoYSxiKTooYz12b2lkIDAhPT1hLmJyZWFrcG9pbnQ/YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVVbnRpbEJyZWFrcG9pbnQoYS5icmVha3BvaW50KTphLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLGIoYykpfSkpLnRoZW4oKGIpPT57aWYoMDw9Yil7ayhoKHt0eXBlOmUuVVBEQVRFRCxmcHM6cX0pKTtsZXQgZD0hMTthLm9wdGlvbnMuZnJhbWVTa2lwJiYwPGEub3B0aW9ucy5mcmFtZVNraXAmJihhLmZyYW1lU2tpcENvdW50ZXIrKyxhLmZyYW1lU2tpcENvdW50ZXI8PWEub3B0aW9ucy5mcmFtZVNraXA/ZD0hMDphLmZyYW1lU2tpcENvdW50ZXI9MCk7ZHx8eihhKTtjb25zdCBjPXt0eXBlOmUuVVBEQVRFRH07Y1tnLkNBUlRSSURHRV9SQU1dPXcoYSkuYnVmZmVyO2NbZy5HQU1FQk9ZX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLAphLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2NbZy5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7Y1tnLklOVEVSTkFMX1NUQVRFXT14KGEpLmJ1ZmZlcjtPYmplY3Qua2V5cyhjKS5mb3JFYWNoKChhKT0+e3ZvaWQgMD09PWNbYV0mJihjW2FdPShuZXcgVWludDhBcnJheSkuYnVmZmVyKX0pO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGMpLFtjW2cuQ0FSVFJJREdFX1JBTV0sY1tnLkdBTUVCT1lfTUVNT1JZXSxjW2cuUEFMRVRURV9NRU1PUlldLGNbZy5JTlRFUk5BTF9TVEFURV1dKTsyPT09Yj9rKGgoe3R5cGU6ZS5CUkVBS1BPSU5UfSkpOkEoYSl9ZWxzZSBrKGgoe3R5cGU6ZS5DUkFTSEVEfSkpLAphLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHUoYSxiKXt2YXIgYz0tMTtjPXZvaWQgMCE9PWEuYnJlYWtwb2ludD9hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW9VbnRpbEJyZWFrcG9pbnQoMTAyNCxhLmJyZWFrcG9pbnQpOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbygxMDI0KTsxIT09YyYmYihjKTtpZigxPT09Yyl7Yz1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdldEF1ZGlvUXVldWVJbmRleCgpO2NvbnN0IGQ9cT49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmZD8oRChhLGMpLHNldFRpbWVvdXQoKCk9Pnt5KGEpO3UoYSxiKX0sTWF0aC5mbG9vcihNYXRoLmZsb29yKDFFMyooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOihEKGEsYyksdShhLGIpKX19ZnVuY3Rpb24gRChhLGIpe2NvbnN0IGM9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6ZS5VUERBVEVELGF1ZGlvQnVmZmVyOmMsbnVtYmVyT2ZTYW1wbGVzOmIsZnBzOnEsYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nOjYwPGEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlfSksW2NdKTthLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpfWNvbnN0IG49InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgdDtufHwodD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2NvbnN0IGU9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLEdFVF9NRU1PUlk6IkdFVF9NRU1PUlkiLFNFVF9NRU1PUlk6IlNFVF9NRU1PUlkiLFNFVF9NRU1PUllfRE9ORToiU0VUX01FTU9SWV9ET05FIiwKR0VUX0NPTlNUQU5UUzoiR0VUX0NPTlNUQU5UUyIsR0VUX0NPTlNUQU5UU19ET05FOiJHRVRfQ09OU1RBTlRTX0RPTkUiLENPTkZJRzoiQ09ORklHIixSRVNFVF9BVURJT19RVUVVRToiUkVTRVRfQVVESU9fUVVFVUUiLFBMQVk6IlBMQVkiLFBMQVlfVU5USUxfQlJFQUtQT0lOVDoiUExBWV9VTlRJTF9CUkVBS1BPSU5UIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLFVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCIsRk9SQ0VfT1VUUFVUX0ZSQU1FOiJGT1JDRV9PVVRQVVRfRlJBTUUifSxnPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIiwKQ0FSVFJJREdFX1JPTToiQ0FSVFJJREdFX1JPTSIsQ0FSVFJJREdFX0hFQURFUjoiQ0FSVFJJREdFX0hFQURFUiIsR0FNRUJPWV9NRU1PUlk6IkdBTUVCT1lfTUVNT1JZIixQQUxFVFRFX01FTU9SWToiUEFMRVRURV9NRU1PUlkiLElOVEVSTkFMX1NUQVRFOiJJTlRFUk5BTF9TVEFURSJ9O2xldCByPTAsSz17fTtjb25zdCB2PXtlbnY6e2xvZzooYSxiLGMsZSxmLGcsaCk9Pnt2YXIgZD0obmV3IFVpbnQzMkFycmF5KHdhc21JbnN0YW5jZS5leHBvcnRzLm1lbW9yeS5idWZmZXIsYSwxKSlbMF07YT1TdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsbmV3IFVpbnQxNkFycmF5KHdhc21JbnN0YW5jZS5leHBvcnRzLm1lbW9yeS5idWZmZXIsYSs0LGQpKTstOTk5OSE9PWImJihhPWEucmVwbGFjZSgiJDAiLGIpKTstOTk5OSE9PWMmJihhPWEucmVwbGFjZSgiJDEiLGMpKTstOTk5OSE9PWUmJihhPWEucmVwbGFjZSgiJDIiLGUpKTstOTk5OSE9PWYmJihhPWEucmVwbGFjZSgiJDMiLGYpKTsKLTk5OTkhPT1nJiYoYT1hLnJlcGxhY2UoIiQ0IixnKSk7LTk5OTkhPT1oJiYoYT1hLnJlcGxhY2UoIiQ1IixoKSk7Y29uc29sZS5sb2coIltXYXNtQm95XSAiK2EpfSxoZXhMb2c6KGEsYik9PntpZighS1thXSl7bGV0IGM9IltXYXNtQm95XSI7LTk5OTkhPT1hJiYoYys9YCAweCR7YS50b1N0cmluZygxNil9IGApOy05OTk5IT09YiYmKGMrPWAgMHgke2IudG9TdHJpbmcoMTYpfSBgKTtjb25zb2xlLmxvZyhjKX19fX0sRT1hc3luYyhhKT0+e2xldCBiPXZvaWQgMDtyZXR1cm4gYj1XZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZz9hd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZyhmZXRjaChhKSx2KTphd2FpdCAoYXN5bmMoKT0+e2NvbnN0IGI9YXdhaXQgZmV0Y2goYSkudGhlbigoYSk9PmEuYXJyYXlCdWZmZXIoKSk7cmV0dXJuIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGIsdil9KSgpfSxMPWFzeW5jKGEpPT57YT1CdWZmZXIuZnJvbShhLnNwbGl0KCIsIilbMV0sCiJiYXNlNjQiKTtyZXR1cm4gYXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYSx2KX0sTT1hc3luYyhhKT0+e2E9KGE/YXdhaXQgRSgiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJpQUVTWUFsL2YzOS9mMzkvZjM4QVlBQUFZQUYvQVg5Z0FuOS9BR0FCZndCZ0FuOS9BWDlnQUFGL1lBTi9mMzhCZjJBRGYzOS9BR0FHZjM5L2YzOS9BR0FIZjM5L2YzOS9md0YvWUFkL2YzOS9mMzkvQUdBRWYzOS9md0YvWUFoL2YzOS9mMzkvZndCZ0JYOS9mMzkvQVg5Z0RIOS9mMzkvZjM5L2YzOS9md0YvWUFBQVlBSi9md0YvQTlNQjBRRUNBZ0VCQXdFQkFRRUJBUUVCQVFRRUFRRUJBQVlCQVFFQkFRRUJBUVFFQVFFQkFRRUJBUUVHQmdZT0JRY0hEd29MQ1FrSUNBTUVBUUVFQVFRQkFRRUJBUUlDQlFJQ0FnSUZEQVFFQkFFQ0JnSUNBd1FFQkFRQkFRRUJCQVVFQmdZRUF3SUZCQUVRQkFVRENBRUZBUVFCQlFRRUJnWURCUVFEQkFRRUF3TUlBZ0lDQkFJQ0FnSUNBZ0lEQkFRQ0JBUUNCQVFDQkFRQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJRUJnWUdFUVlDQWdVR0JnWUNBd1FFRFFZR0JnWUdCZ1lHQmdZR0JnUUJCZ1lHQmdFQkFRSUVCd1FFQVhBQUFRVURBUUFBQnRRTGtRSi9BRUVBQzM4QVFZQ0FzQVFMZndCQmpBRUxmd0JCQUF0L0FFR0FDQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVILy93TUxmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FrQVFMZndCQmdPZ2ZDMzhBUVlDUUJBdC9BRUdBQkF0L0FFR0FvQVFMZndCQmdMZ0JDMzhBUVlEWUJRdC9BRUdBMkFVTGZ3QkJnSmdPQzM4QVFZQ0FEQXQvQUVHQW1Cb0xmd0JCZ0lBSkMzOEFRWUNZSXd0L0FFR0E0QUFMZndCQmdQZ2pDMzhBUVlDQUNBdC9BRUdBK0NzTGZ3QkJnSUFJQzM4QVFZRDRNd3QvQUVHQWlQZ0RDMzhBUVlDQXJBUUxmd0JCLy84REMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCei80REMzOEJRUUFMZndGQjhQNERDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWY4QUMzOEJRZjhBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZ0tqV3VRY0xmd0ZCQUF0L0FVRUFDMzhCUVlDbzFya0hDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRi9DMzhCUVg4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJnUGNDQzM4QlFZQ0FDQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFkWCtBd3QvQVVIUi9nTUxmd0ZCMHY0REMzOEJRZFArQXd0L0FVSFUvZ01MZndGQjZQNERDMzhCUWV2K0F3dC9BVUhwL2dNTGZ3RkJBQXQvQVVFQkMzOEJRUUlMZndCQmdJQ3dCQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVILy93TUxmd0JCZ0pBRUMzOEFRWUNRQkF0L0FFR0FCQXQvQUVHQTJBVUxmd0JCZ0pnT0MzOEFRWUNZR2d0L0FFR0ErQ01MZndCQmdQZ3JDMzhBUVlENE13dC9BVUVBQ3dmTUVHSUdiV1Z0YjNKNUFnQUZkR0ZpYkdVQkFBWmpiMjVtYVdjQUV3NW9ZWE5EYjNKbFUzUmhjblJsWkFBVUNYTmhkbVZUZEdGMFpRQWJDV3h2WVdSVGRHRjBaUUFtRW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFBbkMyZGxkRk4wWlhCVFpYUnpBQ2dJWjJWMFUzUmxjSE1BS1JWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUFyZ0VNWlhobFkzVjBaVVp5WVcxbEFLMEJDRjl6WlhSaGNtZGpBTThCR1dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzhBemdFYlpYaGxZM1YwWlVaeVlXMWxWVzUwYVd4Q2NtVmhhM0J2YVc1MEFLOEJLR1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOVZiblJwYkVKeVpXRnJjRzlwYm5RQXNBRVZaWGhsWTNWMFpWVnVkR2xzUTI5dVpHbDBhVzl1QU5BQkMyVjRaV04xZEdWVGRHVndBS29CRkdkbGRFTjVZMnhsYzFCbGNrTjVZMnhsVTJWMEFMRUJER2RsZEVONVkyeGxVMlYwY3dDeUFRbG5aWFJEZVdOc1pYTUFzd0VPYzJWMFNtOTVjR0ZrVTNSaGRHVUF1QUVmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnQ3JBUkJqYkdWaGNrRjFaR2x2UW5WbVptVnlBQ0lYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERBQk5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXdFU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF3SWVRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdNYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREJCWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdVU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3WWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJ4eEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2dTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdrT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQ2hGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNTERWZFBVa3RmVWtGTlgxTkpXa1VERENaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTU5JazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVUREaGhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNEREeFJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNUUZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9BeEVRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1TR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01URkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF4UU9SbEpCVFVWZlRFOURRVlJKVDA0REZRcEdVa0ZOUlY5VFNWcEZBeFlYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERGeE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhnU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4a09WRWxNUlY5RVFWUkJYMU5KV2tVREdoSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERHdzVQUVUxZlZFbE1SVk5mVTBsYVJRTWNGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZEVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF4NFdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNZkVrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTWdGa05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0RElSSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURJaDFFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNakdVUkZRbFZIWDBkQlRVVkNUMWxmVFVWTlQxSlpYMU5KV2tVREpDRm5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRQUFBeG5aWFJTWldkcGMzUmxja0VBdVFFTVoyVjBVbVZuYVhOMFpYSkNBTG9CREdkbGRGSmxaMmx6ZEdWeVF3QzdBUXhuWlhSU1pXZHBjM1JsY2tRQXZBRU1aMlYwVW1WbmFYTjBaWEpGQUwwQkRHZGxkRkpsWjJsemRHVnlTQUMrQVF4blpYUlNaV2RwYzNSbGNrd0F2d0VNWjJWMFVtVm5hWE4wWlhKR0FNQUJFV2RsZEZCeWIyZHlZVzFEYjNWdWRHVnlBTUVCRDJkbGRGTjBZV05yVUc5cGJuUmxjZ0RDQVJsblpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5QU1NQkJXZGxkRXhaQU1RQkhXUnlZWGRDWVdOclozSnZkVzVrVFdGd1ZHOVhZWE50VFdWdGIzSjVBTVVCR0dSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllUURHQVFablpYUkVTVllBeHdFSFoyVjBWRWxOUVFESUFRWm5aWFJVVFVFQXlRRUdaMlYwVkVGREFNb0JFM1Z3WkdGMFpVUmxZblZuUjBKTlpXMXZjbmtBeXdFR2RYQmtZWFJsQUswQkRXVnRkV3hoZEdsdmJsTjBaWEFBcWdFU1oyVjBRWFZrYVc5UmRXVjFaVWx1WkdWNEFLc0JEM0psYzJWMFFYVmthVzlSZFdWMVpRQWlEbmRoYzIxTlpXMXZjbmxUYVhwbEE0SUNISGRoYzIxQ2IzbEpiblJsY201aGJGTjBZWFJsVEc5allYUnBiMjREZ3dJWWQyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVlRhWHBsQTRRQ0hXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVXh2WTJGMGFXOXVBNFVDR1dkaGJXVkNiM2xKYm5SbGNtNWhiRTFsYlc5eWVWTnBlbVVEaGdJVGRtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnT0hBaUptY21GdFpVbHVVSEp2WjNKbGMzTldhV1JsYjA5MWRIQjFkRXh2WTJGMGFXOXVBNG9DRzJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWTWIyTmhkR2x2YmdPSUFoZG5ZVzFsWW05NVEyOXNiM0pRWVd4bGRIUmxVMmw2WlFPSkFoVmlZV05yWjNKdmRXNWtUV0Z3VEc5allYUnBiMjREaXdJTGRHbHNaVVJoZEdGTllYQURqQUlUYzI5MWJtUlBkWFJ3ZFhSTWIyTmhkR2x2YmdPTkFoRm5ZVzFsUW5sMFpYTk1iMk5oZEdsdmJnT1BBaFJuWVcxbFVtRnRRbUZ1YTNOTWIyTmhkR2x2YmdPT0FnZ0N6QUVKQ0FFQVFRQUxBYzBCQ3JMVEFkRUJ6QUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVF4MUlnRkZEUUFDUUNBQlFRRnJEZzBCQVFFQ0FnSUNBd01FQkFVR0FBc01CZ3NnQUVHQStETnFEd3NnQUVFQkl5OGlBQ013UlNJQkJIOGdBRVVGSUFFTEcwRU9kR3BCZ1BneWFnOExJQUJCZ0pCK2FpTXhCSDhqTWhBQlFRRnhCVUVBQzBFTmRHb1BDeUFBSXpOQkRYUnFRWUM0S1dvUEN5QUFRWUNRZm1vUEMwRUFJUUVDZnlNeEJFQWpOQkFCUVFkeElRRUxJQUZCQVVnTEJFQkJBU0VCQ3lBQlFReDBJQUJxUVlEd2ZXb1BDeUFBUVlCUWFnc0pBQ0FBRUFBdEFBQUxtUUVBUVFBa05VRUFKRFpCQUNRM1FRQWtPRUVBSkRsQkFDUTZRUUFrTzBFQUpEeEJBQ1E5UVFBa1BrRUFKRDlCQUNSQVFRQWtRVUVBSkVKQkFDUkRRUUFrUkNNeEJFQkJFU1EyUVlBQkpEMUJBQ1EzUVFBa09FSC9BU1E1UWRZQUpEcEJBQ1E3UVEwa1BBVkJBU1EyUWJBQkpEMUJBQ1EzUVJNa09FRUFKRGxCMkFFa09rRUJKRHRCelFBa1BBdEJnQUlrUDBIKy93TWtQZ3VrQVFFQ2YwRUFKRVZCQVNSR1FjY0NFQUVoQVVFQUpFZEJBQ1JJUVFBa1NVRUFKRXBCQUNRd0lBRUVRQ0FCUVFGT0lnQUVRQ0FCUVFOTUlRQUxJQUFFUUVFQkpFZ0ZJQUZCQlU0aUFBUkFJQUZCQmt3aEFBc2dBQVJBUVFFa1NRVWdBVUVQVGlJQUJFQWdBVUVUVENFQUN5QUFCRUJCQVNSS0JTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQUVRRUVCSkRBTEN3c0xCVUVCSkVjTFFRRWtMMEVBSkRNTEN3QWdBQkFBSUFFNkFBQUxMd0JCMGY0RFFmOEJFQVJCMHY0RFFmOEJFQVJCMC80RFFmOEJFQVJCMVA0RFFmOEJFQVJCMWY0RFFmOEJFQVFMbUFFQVFRQWtTMEVBSkV4QkFDUk5RUUFrVGtFQUpFOUJBQ1JRUVFBa1VTTXhCRUJCa0FFa1RVSEEvZ05Ca1FFUUJFSEIvZ05CZ1FFUUJFSEUvZ05Ca0FFUUJFSEgvZ05CL0FFUUJBVkJrQUVrVFVIQS9nTkJrUUVRQkVIQi9nTkJoUUVRQkVIRy9nTkIvd0VRQkVISC9nTkIvQUVRQkVISS9nTkIvd0VRQkVISi9nTkIvd0VRQkF0QnovNERRUUFRQkVIdy9nTkJBUkFFQzA4QUl6RUVRRUhvL2dOQndBRVFCRUhwL2dOQi93RVFCRUhxL2dOQndRRVFCRUhyL2dOQkRSQUVCVUhvL2dOQi93RVFCRUhwL2dOQi93RVFCRUhxL2dOQi93RVFCRUhyL2dOQi93RVFCQXNMTHdCQmtQNERRWUFCRUFSQmtmNERRYjhCRUFSQmt2NERRZk1CRUFSQmsvNERRY0VCRUFSQmxQNERRYjhCRUFRTExBQkJsZjREUWY4QkVBUkJsdjREUVQ4UUJFR1gvZ05CQUJBRVFaaitBMEVBRUFSQm1mNERRYmdCRUFRTE1nQkJtdjREUWY4QUVBUkJtLzREUWY4QkVBUkJuUDREUVo4QkVBUkJuZjREUVFBUUJFR2UvZ05CdUFFUUJFRUJKR0lMTFFCQm4vNERRZjhCRUFSQm9QNERRZjhCRUFSQm9mNERRUUFRQkVHaS9nTkJBQkFFUWFQK0EwRy9BUkFFQ3pnQVFROGtZMEVQSkdSQkR5UmxRUThrWmtFQUpHZEJBQ1JvUVFBa2FVRUFKR3BCL3dBa2EwSC9BQ1JzUVFFa2JVRUJKRzVCQUNSdkMyY0FRUUFrVWtFQUpGTkJBQ1JVUVFFa1ZVRUJKRlpCQVNSWFFRRWtXRUVCSkZsQkFTUmFRUUVrVzBFQkpGeEJBU1JkUVFBa1hrRUFKRjlCQUNSZ1FRQWtZUkFJRUFrUUNoQUxRYVQrQTBIM0FCQUVRYVgrQTBIekFSQUVRYWIrQTBIeEFSQUVFQXdMT0FBZ0FFRUJjVUVBUnlSd0lBQkJBbkZCQUVja2NTQUFRUVJ4UVFCSEpISWdBRUVJY1VFQVJ5UnpJQUJCRUhGQkFFY2tkQ0FBSkhVTE9BQWdBRUVCY1VFQVJ5UjJJQUJCQW5GQkFFY2tkeUFBUVFSeFFRQkhKSGdnQUVFSWNVRUFSeVI1SUFCQkVIRkJBRWNrZWlBQUpIc0xWd0JCQUNSOFFRQWtmVUVBSkg1QkFDUi9RUUFrZ0FGQkFDU0JBVUVBSklJQlFRQWtnd0VqTVFSQVFZVCtBMEVlRUFSQm9EMGtmUVZCaFA0RFFhc0JFQVJCek5jQ0pIMExRWWYrQTBINEFSQUVRZmdCSklFQkMwSUFRUUFraEFGQkFDU0ZBU014QkVCQmd2NERRZndBRUFSQkFDU0dBVUVBSkljQlFRQWtpQUVGUVlMK0EwSCtBQkFFUVFBa2hnRkJBU1NIQVVFQUpJZ0JDd3YxQVFFQ2YwSERBaEFCSWdGQndBRkdJZ0FFZnlBQUJTQUJRWUFCUmlNbklnQWdBQnNMQkVCQkFTUXhCVUVBSkRFTEVBSVFBeEFGRUFZUUJ4QU5RUUFRRGtILy93TWpkUkFFUWVFQkVBOUJqLzRESTNzUUJCQVFFQkVqTVFSQVFmRCtBMEg0QVJBRVFjLytBMEgrQVJBRVFjMytBMEgrQUJBRVFZRCtBMEhQQVJBRVFZLytBMEhoQVJBRVFleitBMEgrQVJBRVFmWCtBMEdQQVJBRUJVSHcvZ05CL3dFUUJFSFAvZ05CL3dFUUJFSE4vZ05CL3dFUUJFR0EvZ05CendFUUJFR1AvZ05CNFFFUUJBdEJBQ1FsUVlDbzFya0hKSWtCUVFBa2lnRkJBQ1NMQVVHQXFOYTVCeVNNQVVFQUpJMEJRUUFramdFTG5RRUFJQUJCQUVvRVFFRUJKQ1lGUVFBa0pnc2dBVUVBU2dSQVFRRWtKd1ZCQUNRbkN5QUNRUUJLQkVCQkFTUW9CVUVBSkNnTElBTkJBRW9FUUVFQkpDa0ZRUUFrS1FzZ0JFRUFTZ1JBUVFFa0tnVkJBQ1FxQ3lBRlFRQktCRUJCQVNRckJVRUFKQ3NMSUFaQkFFb0VRRUVCSkN3RlFRQWtMQXNnQjBFQVNnUkFRUUVrTFFWQkFDUXRDeUFJUVFCS0JFQkJBU1F1QlVFQUpDNExFQklMREFBakpRUkFRUUVQQzBFQUM3SUJBRUdBQ0NNMk9nQUFRWUVJSXpjNkFBQkJnZ2dqT0RvQUFFR0RDQ001T2dBQVFZUUlJem82QUFCQmhRZ2pPem9BQUVHR0NDTThPZ0FBUVljSUl6MDZBQUJCaUFnalBqc0JBRUdLQ0NNL093RUFRWXdJSTBBMkFnQWpRUVJBUVpFSVFRRTZBQUFGUVpFSVFRQTZBQUFMSTBJRVFFR1NDRUVCT2dBQUJVR1NDRUVBT2dBQUN5TkRCRUJCa3doQkFUb0FBQVZCa3doQkFEb0FBQXNqUkFSQVFaUUlRUUU2QUFBRlFaUUlRUUE2QUFBTEM2d0JBRUhJQ1NNdk93RUFRY29KSXpNN0FRQWpSUVJBUWN3SlFRRTZBQUFGUWN3SlFRQTZBQUFMSTBZRVFFSE5DVUVCT2dBQUJVSE5DVUVBT2dBQUN5TkhCRUJCemdsQkFUb0FBQVZCemdsQkFEb0FBQXNqU0FSQVFjOEpRUUU2QUFBRlFjOEpRUUE2QUFBTEkwa0VRRUhRQ1VFQk9nQUFCVUhRQ1VFQU9nQUFDeU5LQkVCQjBRbEJBVG9BQUFWQjBRbEJBRG9BQUFzak1BUkFRZElKUVFFNkFBQUZRZElKUVFBNkFBQUxDMGdBUWZvSkkzdzJBZ0JCL2dramZUWUNBQ09DQVFSQVFZSUtRUUU2QUFBRlFZSUtRUUE2QUFBTEk0TUJCRUJCaFFwQkFUb0FBQVZCaFFwQkFEb0FBQXRCaGY0REkzNFFCQXQ0QUNPU0FRUkFRZDRLUVFFNkFBQUZRZDRLUVFBNkFBQUxRZDhLSTVNQk5nSUFRZU1LSTVRQk5nSUFRZWNLSTVVQk5nSUFRZXdLSTVZQk5nSUFRZkVLSTVjQk9nQUFRZklLSTVnQk9nQUFJNWtCQkVCQjl3cEJBVG9BQUFWQjl3cEJBRG9BQUF0QitBb2ptZ0UyQWdCQi9Rb2ptd0U3QVFBTFR3QWpuQUVFUUVHUUMwRUJPZ0FBQlVHUUMwRUFPZ0FBQzBHUkN5T2RBVFlDQUVHVkN5T2VBVFlDQUVHWkN5T2ZBVFlDQUVHZUN5T2dBVFlDQUVHakN5T2hBVG9BQUVHa0N5T2lBVG9BQUF0R0FDT25BUVJBUWZRTFFRRTZBQUFGUWZRTFFRQTZBQUFMUWZVTEk2Z0JOZ0lBUWZrTEk2a0JOZ0lBUWYwTEk2b0JOZ0lBUVlJTUk2c0JOZ0lBUVljTUk2d0JPd0VBQzZNQkFCQVZRYklJSTB3MkFnQkJ0Z2dqandFNkFBQkJ4UDRESTAwUUJDT1FBUVJBUWVRSVFRRTZBQUFGUWVRSVFRQTZBQUFMSTVFQkJFQkI1UWhCQVRvQUFBVkI1UWhCQURvQUFBc1FGaEFYUWF3S0kxNDJBZ0JCc0Fvalh6b0FBRUd4Q2lOZ09nQUFFQmdRR1NPakFRUkFRY0lMUVFFNkFBQUZRY0lMUVFBNkFBQUxRY01MSTZRQk5nSUFRY2NMSTZVQk5nSUFRY3NMSTZZQk93RUFFQnBCQUNRbEM2NEJBRUdBQ0MwQUFDUTJRWUVJTFFBQUpEZEJnZ2d0QUFBa09FR0RDQzBBQUNRNVFZUUlMUUFBSkRwQmhRZ3RBQUFrTzBHR0NDMEFBQ1E4UVljSUxRQUFKRDFCaUFndkFRQWtQa0dLQ0M4QkFDUS9RWXdJS0FJQUpFQUNmMEVCUVpFSUxRQUFRUUJLRFFBYVFRQUxKRUVDZjBFQlFaSUlMUUFBUVFCS0RRQWFRUUFMSkVJQ2YwRUJRWk1JTFFBQVFRQktEUUFhUVFBTEpFTUNmMEVCUVpRSUxRQUFRUUJLRFFBYVFRQUxKRVFMWEFFQmYwRUFKRXhCQUNSTlFjVCtBMEVBRUFSQndmNERFQUZCZkhFaEFVRUFKSThCUWNIK0F5QUJFQVFnQUFSQUFrQkJBQ0VBQTBBZ0FFR0E2QjlPRFFFZ0FFR0FrQVJxUWY4Qk9nQUFJQUJCQVdvaEFBd0FBQXNBQ3dzTGlBRUJBWDhqclFFaEFTQUFRWUFCY1VFQVJ5U3RBU0FBUWNBQWNVRUFSeVN1QVNBQVFTQnhRUUJISks4QklBQkJFSEZCQUVja3NBRWdBRUVJY1VFQVJ5U3hBU0FBUVFSeFFRQkhKTElCSUFCQkFuRkJBRWNrc3dFZ0FFRUJjVUVBUnlTMEFTT3RBVVVnQVNBQkd3UkFRUUVRSFFzZ0FVVWlBQVIvSTYwQkJTQUFDd1JBUVFBUUhRc0xQZ0FDZjBFQlFlUUlMUUFBUVFCS0RRQWFRUUFMSkpBQkFuOUJBVUhsQ0MwQUFFRUFTZzBBR2tFQUN5U1JBVUgvL3dNUUFSQU9RWS8rQXhBQkVBOExwUUVBUWNnSkx3RUFKQzlCeWdrdkFRQWtNd0ovUVFGQnpBa3RBQUJCQUVvTkFCcEJBQXNrUlFKL1FRRkJ6UWt0QUFCQkFFb05BQnBCQUFza1JnSi9RUUZCemdrdEFBQkJBRW9OQUJwQkFBc2tSd0ovUVFGQnp3a3RBQUJCQUVvTkFCcEJBQXNrU0FKL1FRRkIwQWt0QUFCQkFFb05BQnBCQUFza1NRSi9RUUZCMFFrdEFBQkJBRW9OQUJwQkFBc2tTZ0ovUVFGQjBna3RBQUJCQUVvTkFCcEJBQXNrTUF0WEFFSDZDU2dDQUNSOFFmNEpLQUlBSkgwQ2YwRUJRWUlLTFFBQVFRQktEUUFhUVFBTEpJSUJBbjlCQVVHRkNpMEFBRUVBU2cwQUdrRUFDeVNEQVVHRi9nTVFBU1IrUVliK0F4QUJKSDlCaC80REVBRWtnUUVMQmdCQkFDUmhDM1lBQW45QkFVSGVDaTBBQUVFQVNnMEFHa0VBQ3lTU0FVSGZDaWdDQUNTVEFVSGpDaWdDQUNTVUFVSG5DaWdDQUNTVkFVSHNDaWdDQUNTV0FVSHhDaTBBQUNTWEFVSHlDaTBBQUNTWUFRSi9RUUZCOXdvdEFBQkJBRW9OQUJwQkFBc2ttUUZCK0Fvb0FnQWttZ0ZCL1FvdkFRQWttd0VMVGdBQ2YwRUJRWkFMTFFBQVFRQktEUUFhUVFBTEpKd0JRWkVMS0FJQUpKMEJRWlVMS0FJQUpKNEJRWmtMS0FJQUpKOEJRWjRMS0FJQUpLQUJRYU1MTFFBQUpLRUJRYVFMTFFBQUpLSUJDMFVBQW45QkFVSDBDeTBBQUVFQVNnMEFHa0VBQ3lTbkFVSDFDeWdDQUNTb0FVSDVDeWdDQUNTcEFVSDlDeWdDQUNTcUFVR0NEQ2dDQUNTckFVR0hEQzhCQUNTc0FRdlFBUUVCZnhBY1FiSUlLQUlBSkV4QnRnZ3RBQUFrandGQnhQNERFQUVrVFVIQS9nTVFBUkFlRUI5QmdQNERFQUZCL3dGekpMVUJJN1VCSWdCQkVIRkJBRWNrdGdFZ0FFRWdjVUVBUnlTM0FSQWdFQ0ZCckFvb0FnQWtYa0d3Q2kwQUFDUmZRYkVLTFFBQUpHQkJBQ1JoRUNNUUpBSi9RUUZCd2dzdEFBQkJBRW9OQUJwQkFBc2tvd0ZCd3dzb0FnQWtwQUZCeHdzb0FnQWtwUUZCeXdzdkFRQWtwZ0VRSlVFQUpDVkJnS2pXdVFja2lRRkJBQ1NLQVVFQUpJc0JRWUNvMXJrSEpJd0JRUUFralFGQkFDU09BUXNGQUNPTUFRc0ZBQ09OQVFzRkFDT09BUXZZQWdFRmZ3Si9BbjhnQVVFQVNpSUZCRUFnQUVFSVNpRUZDeUFGQ3dSQUk3a0JJQVJHSVFVTElBVUxCSDhqdWdFZ0FFWUZJQVVMQkVCQkFDRUZRUUFoQkNBRFFRRnJFQUZCSUhFRVFFRUJJUVVMSUFNUUFVRWdjUVJBUVFFaEJBdEJBQ0VEQTBBZ0EwRUlTQVJBUVFjZ0Eyc2dBeUFFSUFWSEd5SURJQUJxUWFBQlRBUkFJQUJCQ0NBRGEyc2hCeUFBSUFOcUlBRkJvQUZzYWtFRGJFR0EyQVZxSVFsQkFDRUdBMEFnQmtFRFNBUkFJQUFnQTJvZ0FVR2dBV3hxUVFOc1FZRFlCV29nQm1vZ0JpQUphaTBBQURvQUFDQUdRUUZxSVFZTUFRc0xJQUFnQTJvZ0FVR2dBV3hxUVlDZ0JHb2dBVUdnQVd3Z0IycEJnS0FFYWkwQUFDSUdRUU54SWdkQkJISWdCeUFHUVFSeEd6b0FBQ0FJUVFGcUlRZ0xJQU5CQVdvaEF3d0JDd3NGSUFRa3VRRUxJQUFqdWdGT0JFQWdBRUVJYWlTNkFTQUFJQUpCQ0c4aUJFZ0VRQ082QVNBRWFpUzZBUXNMSUFnTE9BRUJmeUFBUVlDUUFrWUVRQ0FCUVlBQmFpRUNJQUZCZ0FGeEJFQWdBVUdBQVdzaEFnc2dBa0VFZENBQWFnOExJQUZCQkhRZ0FHb0xTZ0FnQUVFRGRDQUJRUUYwYWlJQVFRRnFRVDl4SWdGQlFHc2dBU0FDRzBHQWtBUnFMUUFBSVFFZ0FFRS9jU0lBUVVCcklBQWdBaHRCZ0pBRWFpMEFBQ0FCUWY4QmNVRUlkSElMVVFBZ0FrVUVRQ0FCRUFFZ0FFRUJkSFZCQTNFaEFBdEI4Z0VoQVFKQUlBQkZEUUFDUUFKQUFrQUNRQ0FBUVFGckRnTUJBZ01BQ3d3REMwR2dBU0VCREFJTFFkZ0FJUUVNQVF0QkNDRUJDeUFCQytFQ0FRZC9JQUVnQUJBcklBVkJBWFJxSWdCQmdKQithaUFDUVFGeFFRMTBJZ0ZxTFFBQUlSRWdBRUdCa0g1cUlBRnFMUUFBSVJJZ0F5RUFBMEFnQUNBRVRBUkFJQUFnQTJzZ0Jtb2lEU0FJU0FSQVFRY2dBR3NoQlNBTFFRQklJZ0lFZnlBQ0JTQUxRU0J4UlFzaEFVRUFJUUlDZjBFQklBVWdBQ0FCR3lJQmRDQVNjUVJBUVFJaEFnc2dBa0VCYWdzZ0FrRUJJQUYwSUJGeEd5RUNJQXRCQUU0RWZ5QUxRUWR4SUFKQkFCQXNJZ1ZCSDNGQkEzUWhEaUFGUWVBSGNVRUZkVUVEZENFQklBVkJnUGdCY1VFS2RVRURkQVVnQWtISC9nTWdEeUFQUVFCTUd5SVBJQW9RTFNJRklRNGdCU0lCQ3lFRklBY2dDR3dnRFdwQkEyd2dDV29pRUNBT09nQUFJQkJCQVdvZ0FUb0FBQ0FRUVFKcUlBVTZBQUFnQjBHZ0FXd2dEV3BCZ0tBRWFpQUNRUU54SWdGQkJISWdBU0FMUVlBQmNVRUFSMEVBSUF0QkFFNGJHem9BQUNBTVFRRnFJUXdMSUFCQkFXb2hBQXdCQ3dzZ0RBdCtBUU4vSUFOQkNHOGhBeUFBUlFSQUlBSWdBa0VJYlVFRGRHc2hCd3RCb0FFZ0FHdEJCeUFBUVFocVFhQUJTaHNoQ1VGL0lRSWpNUVJBSUFSQmdOQithaTBBQUNJQ1FRaHhCRUJCQVNFSUN5QUNRY0FBY1FSQVFRY2dBMnNoQXdzTElBWWdCU0FJSUFjZ0NTQURJQUFnQVVHZ0FVR0EyQVZCQUNBQ0VDNExwZ0lBSUFVZ0JoQXJJUVlnQTBFSWJ5RURJQVJCZ05CK2FpMEFBQ0lFUWNBQWNRUi9RUWNnQTJzRklBTUxRUUYwSUFacUlnTkJnSkIrYWtFQlFRQWdCRUVJY1J0QkFYRkJEWFFpQldvdEFBQWhCaUFEUVlHUWZtb2dCV290QUFBaEJTQUNRUWh2SVFOQkFDRUNJQUZCb0FGc0lBQnFRUU5zUVlEWUJXb2dCRUVIY1FKL1FRRWdBMEVISUFOcklBUkJJSEViSWdOMElBVnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQm5FYklnSkJBQkFzSWdOQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnZGdGYWlBRFFlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQzJBVnFJQU5CZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FvQVJxSUFKQkEzRWlBRUVFY2lBQUlBUkJnQUZ4R3pvQUFBdTFBUUFnQkNBRkVDc2dBMEVJYjBFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURZQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkNHOXJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0EwRUFFQzBpQWpvQUFDQUJRYUFCYkNBQWFrRURiRUdCMkFWcUlBSTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmd0Z0ZhaUFDT2dBQUlBRkJvQUZzSUFCcVFZQ2dCR29nQTBFRGNUb0FBQXZWQVFFR2Z5QURRUU4xSVFzRFFDQUVRYUFCU0FSQUlBUWdCV29pQmtHQUFrNEVRQ0FHUVlBQ2F5RUdDeUFMUVFWMElBSnFJQVpCQTNWcUlnbEJnSkIrYWkwQUFDRUlRUUFoQ2lNdUJFQWdCQ0FBSUFZZ0NTQUlFQ29pQjBFQVNnUkFRUUVoQ2lBSFFRRnJJQVJxSVFRTEN5QUtSU010SWdjZ0J4c0VRQ0FFSUFBZ0JpQURJQWtnQVNBSUVDOGlCMEVBU2dSQUlBZEJBV3NnQkdvaEJBc0ZJQXBGQkVBak1RUkFJQVFnQUNBR0lBTWdDU0FCSUFnUU1BVWdCQ0FBSUFZZ0F5QUJJQWdRTVFzTEN5QUVRUUZxSVFRTUFRc0xDeXNCQVg4alRpRURJQUFnQVNBQ0kwOGdBR29pQUVHQUFrNEVmeUFBUVlBQ2F3VWdBQXRCQUNBREVESUxNQUVEZnlOUUlRTWdBQ05SSWdSSUJFQVBDeUFEUVFkcklnTkJmMndoQlNBQUlBRWdBaUFBSUFScklBTWdCUkF5QzhRRkFROS9Ba0JCSnlFSkEwQWdDVUVBU0EwQklBbEJBblFpQkVHQS9BTnFFQUVoQWlBRVFZSDhBMm9RQVNFS0lBUkJndndEYWhBQklRTWdBa0VRYXlFQ0lBcEJDR3NoQ2tFSUlRVWdBUVJBUVJBaEJTQURRUUp2UVFGR0JIOGdBMEVCYXdVZ0F3c2hBd3NnQUNBQ1RpSUdCRUFnQUNBQ0lBVnFTQ0VHQ3lBR0JFQWdCRUdEL0FOcUVBRWlCa0dBQVhGQkFFY2hDeUFHUVNCeFFRQkhJUTVCZ0lBQ0lBTVFLeUFBSUFKcklnSWdCV3RCZjJ4QkFXc2dBaUFHUWNBQWNSdEJBWFJxSWdOQmdKQitha0VCUVFBZ0JrRUljVUVBUnlNeElnSWdBaHNiUVFGeFFRMTBJZ0pxTFFBQUlROGdBMEdCa0g1cUlBSnFMUUFBSVJCQkJ5RUZBMEFnQlVFQVRnUkFRUUFoQ0FKL1FRRWdCU0lDUVFkclFYOXNJQUlnRGhzaUFuUWdFSEVFUUVFQ0lRZ0xJQWhCQVdvTElBaEJBU0FDZENBUGNSc2lDQVJBUVFjZ0JXc2dDbW9pQjBFQVRpSUNCRUFnQjBHZ0FVd2hBZ3NnQWdSQVFRQWhERUVBSVExQkFVRUFJN1FCUlNNeElnTWdBeHNiSWdKRkJFQWdBRUdnQVd3Z0IycEJnS0FFYWkwQUFDSURRUU54SWdSQkFFb2dDeUFMR3dSQVFRRWhEQVVnQTBFRWNVRUFSeU14SWdNZ0F4c2lBd1JBSUFSQkFFb2hBd3RCQVVFQUlBTWJJUTBMQ3lBQ1JRUkFJQXhGSWdRRWZ5QU5SUVVnQkFzaEFnc2dBZ1JBSXpFRVFDQUFRYUFCYkNBSGFrRURiRUdBMkFWcUlBWkJCM0VnQ0VFQkVDd2lCRUVmY1VFRGREb0FBQ0FBUWFBQmJDQUhha0VEYkVHQjJBVnFJQVJCNEFkeFFRVjFRUU4wT2dBQUlBQkJvQUZzSUFkcVFRTnNRWUxZQldvZ0JFR0ErQUZ4UVFwMVFRTjBPZ0FBQlNBQVFhQUJiQ0FIYWtFRGJFR0EyQVZxSUFoQnlmNERRY2orQXlBR1FSQnhHMEVBRUMwaUF6b0FBQ0FBUWFBQmJDQUhha0VEYkVHQjJBVnFJQU02QUFBZ0FFR2dBV3dnQjJwQkEyeEJndGdGYWlBRE9nQUFDd3NMQ3lBRlFRRnJJUVVNQVFzTEN5QUpRUUZySVFrTUFBQUxBQXNMWmdFQ2YwR0FrQUloQVVHQWdBSkJnSkFDSTdBQkd5RUJJekVqdEFFak1Sc0VRRUdBc0FJaEFpQUFJQUZCZ0xnQ1FZQ3dBaU94QVJzUU13c2pyd0VFUUVHQXNBSWhBaUFBSUFGQmdMZ0NRWUN3QWlPdUFSc1FOQXNqc3dFRVFDQUFJN0lCRURVTEN5VUJBWDhDUUFOQUlBQkJrQUZMRFFFZ0FFSC9BWEVRTmlBQVFRRnFJUUFNQUFBTEFBc0xSZ0VDZndOQUlBRkJrQUZPUlFSQVFRQWhBQU5BSUFCQm9BRklCRUFnQVVHZ0FXd2dBR3BCZ0tBRWFrRUFPZ0FBSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN3c2NBUUYvUVkvK0F4QUJRUUVnQUhSeUlnRWtlMEdQL2dNZ0FSQUVDd29BUVFFa2QwRUJFRGtMUlFFQ2YwR1UvZ01RQVVINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBRVFaVCtBeUFCSUFCQkNIVWlBSElRQkNBQ0pNWUJJQUFreHdFanhnRWp4d0ZCQ0hSeUpNZ0JDMllCQW44am13RWlBU1BFQVhVaEFDQUJJQUJySUFBZ0FXb2p4UUViSWdCQi93OU1JZ0VFZnlQRUFVRUFTZ1VnQVFzRVFDQUFKSnNCSUFBUU95T2JBU0lCSThRQmRTRUFJQUVnQUdzZ0FDQUJhaVBGQVJzaEFBc2dBRUgvRDBvRVFFRUFKSklCQ3dzc0FDT2FBVUVCYXlTYUFTT2FBVUVBVEFSQUk4TUJKSm9CSThNQlFRQktJNWtCSTVrQkd3UkFFRHdMQ3d0YkFRRi9JNVFCUVFGckpKUUJJNVFCUVFCTUJFQWp5UUVrbEFFamxBRUVRQ09XQVVFUFNDUEtBU1BLQVJzRVFDT1dBVUVCYWlTV0FRVWp5Z0ZGSWdBRVFDT1dBVUVBU2lFQUN5QUFCRUFqbGdGQkFXc2tsZ0VMQ3dzTEMxc0JBWDhqbmdGQkFXc2tuZ0VqbmdGQkFFd0VRQ1BMQVNTZUFTT2VBUVJBSTZBQlFROUlJOHdCSTh3Qkd3UkFJNkFCUVFGcUpLQUJCU1BNQVVVaUFBUkFJNkFCUVFCS0lRQUxJQUFFUUNPZ0FVRUJheVNnQVFzTEN3c0xXd0VCZnlPcEFVRUJheVNwQVNPcEFVRUFUQVJBSTgwQkpLa0JJNmtCQkVBanF3RkJEMGdqemdFanpnRWJCRUFqcXdGQkFXb2txd0VGSTg0QlJTSUFCRUFqcXdGQkFFb2hBQXNnQUFSQUk2c0JRUUZySktzQkN3c0xDd3VPQmdBalhpQUFhaVJlSTE0ak5RUi9RWUNBQVFWQmdNQUFDMDRFUUNOZUl6VUVmMEdBZ0FFRlFZREFBQXRySkY0Q1FBSkFBa0FDUUFKQUkyQWlBQVJBSUFCQkFtc09CZ0VGQWdVREJBVUxJNVVCUVFCS0lnQUVmeU8vQVFVZ0FBc0VRQ09WQVVFQmF5U1ZBUXNqbFFGRkJFQkJBQ1NTQVFzam53RkJBRW9pQUFSL0k4QUJCU0FBQ3dSQUk1OEJRUUZySko4QkN5T2ZBVVVFUUVFQUpKd0JDeU9sQVVFQVNpSUFCSDhqd1FFRklBQUxCRUFqcFFGQkFXc2twUUVMSTZVQlJRUkFRUUFrb3dFTEk2b0JRUUJLSWdBRWZ5UENBUVVnQUFzRVFDT3FBVUVCYXlTcUFRc2pxZ0ZGQkVCQkFDU25BUXNNQkFzamxRRkJBRW9pQUFSL0k3OEJCU0FBQ3dSQUk1VUJRUUZySkpVQkN5T1ZBVVVFUUVFQUpKSUJDeU9mQVVFQVNpSUFCSDhqd0FFRklBQUxCRUFqbndGQkFXc2tud0VMSTU4QlJRUkFRUUFrbkFFTEk2VUJRUUJLSWdBRWZ5UEJBUVVnQUFzRVFDT2xBVUVCYXlTbEFRc2pwUUZGQkVCQkFDU2pBUXNqcWdGQkFFb2lBQVIvSThJQkJTQUFDd1JBSTZvQlFRRnJKS29CQ3lPcUFVVUVRRUVBSktjQkN4QTlEQU1MSTVVQlFRQktJZ0FFZnlPL0FRVWdBQXNFUUNPVkFVRUJheVNWQVFzamxRRkZCRUJCQUNTU0FRc2pud0ZCQUVvaUFBUi9JOEFCQlNBQUN3UkFJNThCUVFGckpKOEJDeU9mQVVVRVFFRUFKSndCQ3lPbEFVRUFTaUlBQkg4andRRUZJQUFMQkVBanBRRkJBV3NrcFFFTEk2VUJSUVJBUVFBa293RUxJNm9CUVFCS0lnQUVmeVBDQVFVZ0FBc0VRQ09xQVVFQmF5U3FBUXNqcWdGRkJFQkJBQ1NuQVFzTUFnc2psUUZCQUVvaUFBUi9JNzhCQlNBQUN3UkFJNVVCUVFGckpKVUJDeU9WQVVVRVFFRUFKSklCQ3lPZkFVRUFTaUlBQkg4andBRUZJQUFMQkVBam53RkJBV3NrbndFTEk1OEJSUVJBUVFBa25BRUxJNlVCUVFCS0lnQUVmeVBCQVFVZ0FBc0VRQ09sQVVFQmF5U2xBUXNqcFFGRkJFQkJBQ1NqQVFzanFnRkJBRW9pQUFSL0k4SUJCU0FBQ3dSQUk2b0JRUUZySktvQkN5T3FBVVVFUUVFQUpLY0JDeEE5REFFTEVENFFQeEJBQ3lOZ1FRRnFKR0FqWUVFSVRnUkFRUUFrWUF0QkFROExRUUFMZ3dFQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBZ0FDSUJRUUpHRFFFZ0FVRURSZzBDSUFGQkJFWU5Bd3dFQ3lObkk5QUJSd1JBSTlBQkpHZEJBUThMUVFBUEN5Tm9JOUVCUndSQUk5RUJKR2hCQVE4TFFRQVBDeU5wSTlJQlJ3UkFJOUlCSkdsQkFROExRUUFQQ3lOcUk5TUJSd1JBSTlNQkpHcEJBUThMUVFBUEMwRUFDMVVBQWtBQ1FBSkFJQUJCQVVjRVFDQUFRUUpHRFFFZ0FFRURSZzBDREFNTFFRRWdBWFJCZ1FGeFFRQkhEd3RCQVNBQmRFR0hBWEZCQUVjUEMwRUJJQUYwUWY0QWNVRUFSdzhMUVFFZ0FYUkJBWEZCQUVjTGlnRUJBWDhqa3dFZ0FHc2trd0Vqa3dGQkFFd0VRQ09UQVNJQlFSOTFJUUJCZ0JBanlBRnJRUUowSkpNQkl6VUVRQ09UQVVFQmRDU1RBUXNqa3dFZ0FDQUJhaUFBYzJza2t3RWptQUZCQVdva21BRWptQUZCQ0U0RVFFRUFKSmdCQ3dzajBBRWprZ0VpQUNBQUd3Ui9JNVlCQlVFUER3c2oxd0VqbUFFUVF3Ui9RUUVGUVg4TGJFRVBhZ3VLQVFFQmZ5T2RBU0FBYXlTZEFTT2RBVUVBVEFSQUk1MEJJZ0ZCSDNVaEFFR0FFQ1BZQVd0QkFuUWtuUUVqTlFSQUk1MEJRUUYwSkowQkN5T2RBU0FBSUFGcUlBQnpheVNkQVNPaUFVRUJhaVNpQVNPaUFVRUlUZ1JBUVFBa29nRUxDeVBSQVNPY0FTSUFJQUFiQkg4am9BRUZRUThQQ3lQWkFTT2lBUkJEQkg5QkFRVkJmd3RzUVE5cUM1a0NBUUovSTZRQklBQnJKS1FCSTZRQlFRQk1CRUFqcEFFaUFrRWZkU0VBUVlBUUk5b0JhMEVCZENTa0FTTTFCRUFqcEFGQkFYUWtwQUVMSTZRQklBQWdBbW9nQUhOckpLUUJJNllCUVFGcUpLWUJJNllCUVNCT0JFQkJBQ1NtQVFzTFFRQWhBaVBiQVNFQUk5SUJJNk1CSWdFZ0FSc0VRQ05pQkVCQm5QNERFQUZCQlhWQkQzRWlBQ1RiQVVFQUpHSUxCVUVQRHdzanBnRkJBbTFCc1A0RGFoQUJJUUVqcGdGQkFtOEVmeUFCUVE5eEJTQUJRUVIxUVE5eEN5RUJBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BU0FBUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEFnd0NDeUFCUVFGMUlRRkJBaUVDREFFTElBRkJBblVoQVVFRUlRSUxJQUpCQUVvRWZ5QUJJQUp0QlVFQUMwRVBhZ3VyQVFFQmZ5T29BU0FBYXlTb0FTT29BVUVBVEFSQUk2Z0JJUUFqM0FFajNRRjBJZ0ZCQVhRZ0FTTTFHeVNvQVNPb0FTQUFRUjkxSWdFZ0FDQUJhbk5ySktnQkk2d0JJZ0JCQVhFaEFTQUFRUUYxSWdBa3JBRWpyQUVnQVNBQVFRRnhjeUlCUVE1MGNpU3NBU1BlQVFSQUk2d0JRYjkvY1NTc0FTT3NBU0FCUVFaMGNpU3NBUXNMSTlNQkk2Y0JJZ0FnQUJzRWZ5T3JBUVZCRHc4TFFYOUJBU09zQVVFQmNSdHNRUTlxQ3pBQUlBQkJQRVlFUUVIL0FBOExJQUJCUEd0Qm9JMEdiQ0FCYkVFSWJVR2dqUVp0UVR4cVFhQ05CbXhCalBFQ2JRdWNBUUVCZjBFQUpHMGdBRUVQSTFVYklnUWdBV29nQkVFUGFpTldHeUlFSUFKcUlBUkJEMm9qVnhzaEJDQURJQUlnQVNBQVFROGpXUnNpQUdvZ0FFRVBhaU5hR3lJQWFpQUFRUTlxSTFzYklnQnFJQUJCRDJvalhCc2hBRUVBSkc1QkFDUnZJQU1nQkdvZ0JFRVBhaU5ZR3lOVFFRRnFFRWdoQVNBQUkxUkJBV29RU0NFQUlBRWtheUFBSkd3Z0FFSC9BWEVnQVVIL0FYRkJDSFJ5QzhJREFRVi9BbjhqendFZ0FHb2t6d0ZCQUNPVEFTUFBBV3RCQUVvTkFCcEJBUXNpQVVVRVFFRUJFRUloQVFzQ2Z5UFVBU0FBYWlUVUFVRUFJNTBCSTlRQmEwRUFTZzBBR2tFQkN5SUVSUVJBUVFJUVFpRUVDd0ovSTlVQklBQnFKTlVCSTZRQkk5VUJhMEVBU2lJQ0JFQWpZa1VoQWd0QkFDQUNEUUFhUVFFTElnSkZCRUJCQXhCQ0lRSUxBbjhqMWdFZ0FHb2sxZ0ZCQUNPb0FTUFdBV3RCQUVvTkFCcEJBUXNpQlVVRVFFRUVFRUloQlFzZ0FRUkFJODhCSVFOQkFDVFBBU0FERUVRa1l3c2dCQVJBSTlRQklRTkJBQ1RVQVNBREVFVWtaQXNnQWdSQUk5VUJJUU5CQUNUVkFTQURFRVlrWlFzZ0JRUkFJOVlCSVFOQkFDVFdBU0FERUVja1pnc0NmeUFCSUFRZ0FSc2lBVVVFUUNBQ0lRRUxJQUZGQ3dSQUlBVWhBUXNnQVFSQVFRRWtid3NqWHlQZkFTQUFiR29rWHlOZlFZQ0FnQVJCZ0lDQUFpTTFHMDRFUUNOZlFZQ0FnQVJCZ0lDQUFpTTFHMnNrWHlOdklnQWpiU0FBR3lJQlJRUkFJMjRoQVFzZ0FRUkFJMk1qWkNObEkyWVFTUm9MSTJFaUFVRUJkRUdBK0NOcUlnQWphMEVDYWpvQUFDQUFRUUZxSTJ4QkFtbzZBQUFnQVVFQmFpUmhJMkVqNEFGQkFtMUJBV3RPQkVBallVRUJheVJoQ3dzTHRBRUJCSDhnQUJCRUlRRWdBQkJGSVFJZ0FCQkdJUU1nQUJCSElRUWdBU1JqSUFJa1pDQURKR1VnQkNSbUkxOGozd0VnQUd4cUpGOGpYMEdBZ0lBRVFZQ0FnQUlqTlJ0T0JFQWpYMEdBZ0lBRVFZQ0FnQUlqTlJ0ckpGOGdBU0FDSUFNZ0JCQkpJUUFqWVNJQlFRRjBRWUQ0STJvaUFpQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0FrRUJhaUFBUWY4QmNVRUNham9BQUNBQlFRRnFKR0VqWVNQZ0FVRUNiVUVCYTA0RVFDTmhRUUZySkdFTEN3c2VBUUYvSUFBUVFTRUJJQUZGSXl3akxCc0VRQ0FBRUVvRklBQVFTd3NMU3dBalVpTTFCSDlCcmdFRlFkY0FDMGdFUUE4TEEwQWpVaU0xQkg5QnJnRUZRZGNBQzA0RVFDTTFCSDlCcmdFRlFkY0FDeEJNSTFJak5RUi9RYTRCQlVIWEFBdHJKRklNQVFzTEN5RUFJQUJCcHY0RFJnUkFRYWIrQXhBQlFZQUJjU0VBSUFCQjhBQnlEd3RCZnd1Y0FRRUJmeU8xQVNFQUk3WUJCRUFnQUVGN2NTQUFRUVJ5SStFQkd5RUFJQUJCZm5FZ0FFRUJjaVBpQVJzaEFDQUFRWGR4SUFCQkNISWo0d0ViSVFBZ0FFRjljU0FBUVFKeUkrUUJHeUVBQlNPM0FRUkFJQUJCZm5FZ0FFRUJjaVBsQVJzaEFDQUFRWDF4SUFCQkFuSWo1Z0ViSVFBZ0FFRjdjU0FBUVFSeUkrY0JHeUVBSUFCQmQzRWdBRUVJY2lQb0FSc2hBQXNMSUFCQjhBRnlDOHNDQVFGL0lBQkJnSUFDU0FSQVFYOFBDeUFBUVlDQUFrNGlBUVIvSUFCQmdNQUNTQVVnQVFzRVFFRi9Ed3NnQUVHQXdBTk9JZ0VFZnlBQVFZRDhBMGdGSUFFTEJFQWdBRUdBUUdvUUFROExJQUJCZ1B3RFRpSUJCSDhnQUVHZi9RTk1CU0FCQ3dSQUk0OEJRUUpJQkVCQi93RVBDMEYvRHdzZ0FFSE4vZ05HQkVCQi93RWhBVUhOL2dNUUFVRUJjVVVFUUVIK0FTRUJDeU0xUlFSQUlBRkIvMzV4SVFFTElBRVBDeUFBUWNUK0EwWUVRQ0FBSTAwUUJDTk5Ed3NnQUVHUS9nTk9JZ0VFZnlBQVFhYitBMHdGSUFFTEJFQVFUU0FBRUU0UEN5QUFRYkQrQTA0aUFRUi9JQUJCdi80RFRBVWdBUXNFUUJCTlFYOFBDeUFBUVlUK0EwWUVRQ0FBSTMxQmdQNERjVUVJZFNJQkVBUWdBUThMSUFCQmhmNERSZ1JBSUFBamZoQUVJMzRQQ3lBQVFZLytBMFlFUUNON1FlQUJjZzhMSUFCQmdQNERSZ1JBRUU4UEMwRi9DeHNCQVg4Z0FCQlFJZ0ZCZjBZRVFDQUFFQUVQQ3lBQlFmOEJjUXUyQWdFQmZ5TkhCRUFQQ3lBQVFmOC9UQVJBSTBrRWZ5QUJRUkJ4UlFValNRdEZCRUFnQVVFUGNTSUNCRUFnQWtFS1JnUkFRUUVrUlFzRlFRQWtSUXNMQlNBQVFmLy9BRXdFUUNNd1JTSUNCSDhnQWdVZ0FFSC8zd0JNQ3dSQUkwa0VRQ0FCUVE5eEpDOExJQUVoQWlOSUJFQWdBa0VmY1NFQ0l5OUI0QUZ4SkM4Rkkwb0VRQ0FDUWY4QWNTRUNJeTlCZ0FGeEpDOEZJekFFUUVFQUpDOExDd3NqTHlBQ2NpUXZCU012UWY4QmNVRUJRUUFnQVVFQVNodEIvd0Z4UVFoMGNpUXZDd1VqU1VVaUFnUi9JQUJCLzc4QlRBVWdBZ3NFUUNOR0kwZ2lBQ0FBR3dSQUl5OUJIM0VrTHlNdklBRkI0QUZ4Y2lRdkR3c2dBVUVQY1NBQlFRTnhJekFiSkRNRkkwbEZJZ0lFZnlBQVFmLy9BVXdGSUFJTEJFQWpTQVJBSUFGQkFYRUVRRUVCSkVZRlFRQWtSZ3NMQ3dzTEN3c3NBQ0FBUVFSMVFROXhKTzBCSUFCQkNIRkJBRWNreWdFZ0FFRUhjU1RKQVNBQVFmZ0JjVUVBU2lUUUFRc3NBQ0FBUVFSMVFROXhKTzRCSUFCQkNIRkJBRWNrekFFZ0FFRUhjU1RMQVNBQVFmZ0JjVUVBU2lUUkFRc3NBQ0FBUVFSMVFROXhKUEFCSUFCQkNIRkJBRWNremdFZ0FFRUhjU1ROQVNBQVFmZ0JjVUVBU2lUVEFRdUJBUUVCZnlBQVFRUjFKTjBCSUFCQkNIRkJBRWNrM2dFZ0FFRUhjU1QxQVFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FqOVFFaUFRUkFJQUZCQVdzT0J3RUNBd1FGQmdjSUMwRUlKTndCRHd0QkVDVGNBUThMUVNBazNBRVBDMEV3Sk53QkR3dEJ3QUFrM0FFUEMwSFFBQ1RjQVE4TFFlQUFKTndCRHd0QjhBQWszQUVMQzRNQkFRRi9RUUVra2dFamxRRkZCRUJCd0FBa2xRRUxRWUFRSThnQmEwRUNkQ1NUQVNNMUJFQWprd0ZCQVhRa2t3RUxJOGtCSkpRQkkrMEJKSllCSThnQkpKc0JJOE1CSWdBa21nRWdBRUVBU2lJQUJIOGp4QUZCQUVvRklBQUxCRUJCQVNTWkFRVkJBQ1NaQVFzanhBRkJBRW9FUUJBOEN5UFFBVVVFUUVFQUpKSUJDd3RIQUVFQkpKd0JJNThCUlFSQVFjQUFKSjhCQzBHQUVDUFlBV3RCQW5Ra25RRWpOUVJBSTUwQlFRRjBKSjBCQ3lQTEFTU2VBU1B1QVNTZ0FTUFJBVVVFUUVFQUpKd0JDd3RBQUVFQkpLTUJJNlVCUlFSQVFZQUNKS1VCQzBHQUVDUGFBV3RCQVhRa3BBRWpOUVJBSTZRQlFRRjBKS1FCQzBFQUpLWUJJOUlCUlFSQVFRQWtvd0VMQzBrQkFYOUJBU1NuQVNPcUFVVUVRRUhBQUNTcUFRc2ozQUVqM1FGMElnQkJBWFFnQUNNMUd5U29BU1BOQVNTcEFTUHdBU1NyQVVILy93RWtyQUVqMHdGRkJFQkJBQ1NuQVFzTFZBQWdBRUdBQVhGQkFFY2tXQ0FBUWNBQWNVRUFSeVJYSUFCQklIRkJBRWNrVmlBQVFSQnhRUUJISkZVZ0FFRUljVUVBUnlSY0lBQkJCSEZCQUVja1d5QUFRUUp4UVFCSEpGb2dBRUVCY1VFQVJ5UlpDNGdGQVFGL0lBQkJwdjREUnlJQ0JFQWpYVVVoQWdzZ0FnUkFRUUFQQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFrR1EvZ05IQkVBZ0FrR1IvZ05yRGhZQ0Jnb09GUU1IQ3c4QkJBZ01FQlVGQ1EwUkVoTVVGUXNnQVVId0FIRkJCSFVrd3dFZ0FVRUljVUVBUnlURkFTQUJRUWR4Sk1RQkRCVUxJQUZCZ0FGeFFRQkhKTklCREJRTElBRkJCblZCQTNFazF3RWdBVUUvY1NUcEFVSEFBQ1BwQVdza2xRRU1Fd3NnQVVFR2RVRURjU1RaQVNBQlFUOXhKT29CUWNBQUkrb0JheVNmQVF3U0N5QUJKT3NCUVlBQ0krc0JheVNsQVF3UkN5QUJRVDl4Sk93QlFjQUFJK3dCYXlTcUFRd1FDeUFCRUZNTUR3c2dBUkJVREE0TFFRRWtZaUFCUVFWMVFROXhKTzhCREEwTElBRVFWUXdNQ3lBQkpNWUJJOFlCSThjQlFRaDBjaVRJQVF3TEN5QUJKUEVCSS9FQkkvSUJRUWgwY2lUWUFRd0tDeUFCSlBNQkkvTUJJL1FCUVFoMGNpVGFBUXdKQ3lBQkVGWU1DQXNnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVMvQVNBQlFRZHhKTWNCSThZQkk4Y0JRUWgwY2lUSUFSQlhDd3dIQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISk1BQklBRkJCM0VrOGdFajhRRWo4Z0ZCQ0hSeUpOZ0JFRmdMREFZTElBRkJnQUZ4QkVBZ0FVSEFBSEZCQUVja3dRRWdBVUVIY1NUMEFTUHpBU1AwQVVFSWRISWsyZ0VRV1FzTUJRc2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5VENBUkJhQ3d3RUN5QUJRUVIxUVFkeEpGTWdBVUVIY1NSVVFRRWtiUXdEQ3lBQkVGdEJBU1J1REFJTElBRkJnQUZ4UVFCSEpGMGdBVUdBQVhGRkJFQUNRRUdRL2dNaEFnTkFJQUpCcHY0RFRnMEJJQUpCQUJBRUlBSkJBV29oQWd3QUFBc0FDd3NNQVF0QkFROExRUUVMUEFFQmZ5QUFRUWgwSVFGQkFDRUFBMEFDUUNBQVFaOEJTZzBBSUFCQmdQd0RhaUFBSUFGcUVBRVFCQ0FBUVFGcUlRQU1BUXNMUVlRRkpMZ0JDeU1CQVg4aitBRVFBU0VBSS9rQkVBRkIvd0Z4SUFCQi93RnhRUWgwY2tIdy93TnhDeWNCQVg4aitnRVFBU0VBSS9zQkVBRkIvd0Z4SUFCQi93RnhRUWgwY2tId1AzRkJnSUFDYWd1REFRRURmeU14UlFSQUR3c2dBRUdBQVhGRkk3c0JJN3NCR3dSQVFRQWt1d0VqOXdFUUFVR0FBWEloQUNQM0FTQUFFQVFQQ3hCZUlRRVFYeUVDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKTHNCSUFNa3ZBRWdBU1M5QVNBQ0pMNEJJL2NCSUFCQi8zNXhFQVFGSUFFZ0FpQURFR29qOXdGQi93RVFCQXNMWWdFRGZ5UCtBU0FBUmlJQ1JRUkFJLzBCSUFCR0lRSUxJQUlFUUNBQVFRRnJJZ01RQVVHL2YzRWlBa0UvY1NJRVFVQnJJQVJCQVVFQUkvMEJJQUJHR3h0QmdKQUVhaUFCT2dBQUlBSkJnQUZ4QkVBZ0F5QUNRUUZxUVlBQmNoQUVDd3NMUEFFQmZ3SkFBa0FDUUFKQUlBQUVRQ0FBSWdGQkFVWU5BU0FCUVFKR0RRSWdBVUVEUmcwRERBUUxRUWtQQzBFRER3dEJCUThMUVFjUEMwRUFDeTBCQVg5QkFTT0JBUkJpSWdKMElBQnhRUUJISWdBRWYwRUJJQUowSUFGeFJRVWdBQXNFUUVFQkR3dEJBQXVFQVFFQ2Z3TkFJQUVnQUVnRVFDQUJRUVJxSVFFamZTSUNRUVJxSkgwamZVSC8vd05LQkVBamZVR0FnQVJySkgwTEk0QUJCRUFqZ2dFRVFDTi9KSDVCQVNSNFFRSVFPVUVBSklJQlFRRWtnd0VGSTRNQkJFQkJBQ1NEQVFzTElBSWpmUkJqQkVBamZrRUJhaVIrSTM1Qi93RktCRUJCQVNTQ0FVRUFKSDRMQ3dzTUFRc0xDd29BSTN3UVpFRUFKSHdMUUFFQmZ5TjlJUUJCQUNSOVFZVCtBMEVBRUFRamdBRUVmeUFBSTMwUVl3VWpnQUVMQkVBamZrRUJhaVIrSTM1Qi93RktCRUJCQVNTQ0FVRUFKSDRMQ3d0NUFRSi9JNEFCSVFFZ0FFRUVjVUVBUnlTQUFTQUFRUU54SVFJZ0FVVUVRQ09CQVJCaUlRQWdBaEJpSVFFamdBRUVmeU45UVFFZ0FIUnhCU045UVFFZ0FIUnhRUUJISWdBRWZ5TjlRUUVnQVhSeEJTQUFDd3NFUUNOK1FRRnFKSDRqZmtIL0FVb0VRRUVCSklJQlFRQWtmZ3NMQ3lBQ0pJRUJDODRHQVFGL0FrQUNRQ0FBUWMzK0EwWUVRRUhOL2dNZ0FVRUJjUkFFREFFTElBQkJnSUFDU0FSQUlBQWdBUkJTREFFTElBQkJnSUFDVGlJQ0JFQWdBRUdBd0FKSUlRSUxJQUlOQVNBQVFZREFBMDRpQWdSQUlBQkJnUHdEU0NFQ0N5QUNCRUFnQUVHQVFHb2dBUkFFREFJTElBQkJnUHdEVGlJQ0JFQWdBRUdmL1FOTUlRSUxJQUlFUUNPUEFVRUNTQTBCREFJTElBQkJvUDBEVGlJQ0JFQWdBRUgvL1FOTUlRSUxJQUlOQUNBQVFZTCtBMFlFUUNBQlFRRnhRUUJISklZQklBRkJBbkZCQUVja2h3RWdBVUdBQVhGQkFFY2tpQUZCQVE4TElBQkJrUDREVGlJQ0JFQWdBRUdtL2dOTUlRSUxJQUlFUUJCTklBQWdBUkJjRHdzZ0FFR3cvZ05PSWdJRVFDQUFRYi8rQTB3aEFnc2dBZ1JBRUUwTElBQkJ3UDREVGlJQ0JFQWdBRUhML2dOTUlRSUxJQUlFUUNBQVFjRCtBMFlFUUNBQkVCNE1Bd3NnQUVIQi9nTkdCRUJCd2Y0RElBRkIrQUZ4UWNIK0F4QUJRUWR4Y2tHQUFYSVFCQXdDQ3lBQVFjVCtBMFlFUUVFQUpFMGdBRUVBRUFRTUFnc2dBRUhGL2dOR0JFQWdBU1QyQVF3REN5QUFRY2IrQTBZRVFDQUJFRjBNQXdzQ1FBSkFBa0FDUUNBQUlnSkJ3LzREUndSQUlBSkJ3djREYXc0S0FRUUVCQVFFQkFRREFnUUxJQUVrVGd3R0N5QUJKRThNQlFzZ0FTUlFEQVFMSUFFa1VRd0RDd3dDQ3lQM0FTQUFSZ1JBSUFFUVlBd0JDeU0wSUFCR0lnSkZCRUFqTWlBQVJpRUNDeUFDQkVBanV3RUVRQUovSTcwQlFZQ0FBVTRpQWdSQUk3MEJRZi8vQVV3aEFnc2dBa1VMQkVBanZRRkJnS0FEVGlJQ0JFQWp2UUZCLzc4RFRDRUNDd3NnQWcwQ0N3c2dBQ1A4QVU0aUFnUkFJQUFqL1FGTUlRSUxJQUlFUUNBQUlBRVFZUXdDQ3lBQVFZVCtBMDRpQWdSQUlBQkJoLzREVENFQ0N5QUNCRUFRWlFKQUFrQUNRQUpBSUFBaUFrR0UvZ05IQkVBZ0FrR0YvZ05yRGdNQkFnTUVDeEJtREFVTEFrQWpnQUVFUUNPREFRMEJJNElCQkVCQkFDU0NBUXNMSUFFa2Znc01CUXNnQVNSL0k0TUJJNEFCSWdBZ0FCc0VRQ04vSkg1QkFDU0RBUXNNQkFzZ0FSQm5EQU1MREFJTElBQkJnUDREUmdSQUlBRkIvd0Z6SkxVQkk3VUJJZ0pCRUhGQkFFY2t0Z0VnQWtFZ2NVRUFSeVMzQVFzZ0FFR1AvZ05HQkVBZ0FSQVBEQUlMSUFCQi8vOERSZ1JBSUFFUURnd0NDMEVCRHd0QkFBOExRUUVMRVFBZ0FDQUJFR2dFUUNBQUlBRVFCQXNMWUFFRGZ3TkFBa0FnQXlBQ1RnMEFJQUFnQTJvUVVTRUZJQUVnQTJvaEJBTkFJQVJCLzc4Q1NnUkFJQVJCZ0VCcUlRUU1BUXNMSUFRZ0JSQnBJQU5CQVdvaEF3d0JDd3RCSUNFREk3Z0JJQUpCRUcxQndBQkJJQ00xRzJ4cUpMZ0JDMmNCQVg4anV3RkZCRUFQQ3lPOUFTTytBU084QVNJQVFSQWdBRUVRU0JzaUFCQnFJNzBCSUFCcUpMMEJJNzRCSUFCcUpMNEJJN3dCSUFCckpMd0JJN3dCUVFCTUJFQkJBQ1M3QVNQM0FVSC9BUkFFQlNQM0FTTzhBVUVRYlVFQmEwSC9mbkVRQkFzTFJnRUNmeVAyQVNFREFuOGdBRVVpQWtVRVFDQUFRUUZHSVFJTElBSUxCSDhqVFNBRFJnVWdBZ3NFUUNBQlFRUnlJZ0ZCd0FCeEJFQVFPZ3NGSUFGQmUzRWhBUXNnQVF1Q0FnRURmeU90QVVVRVFBOExJNDhCSVFBZ0FDTk5JZ0pCa0FGT0JIOUJBUVVqVENNMUJIOUI4QVVGUWZnQ0MwNEVmMEVDQlVFRFFRQWpUQ00xQkg5QjhnTUZRZmtCQzA0YkN3c2lBVWNFUUVIQi9nTVFBU0VBSUFFa2p3RkJBQ0VDQWtBQ1FBSkFBa0FnQVFSQUlBRkJBV3NPQXdFQ0F3UUxJQUJCZkhFaUFFRUljVUVBUnlFQ0RBTUxJQUJCZlhGQkFYSWlBRUVRY1VFQVJ5RUNEQUlMSUFCQmZuRkJBbklpQUVFZ2NVRUFSeUVDREFFTElBQkJBM0loQUFzZ0FnUkFFRG9MSUFGRkJFQVFhd3NnQVVFQlJnUkFRUUVrZGtFQUVEa0xRY0grQXlBQklBQVFiQkFFQlNBQ1Faa0JSZ1JBUWNIK0F5QUJRY0grQXhBQkVHd1FCQXNMQzdRQkFDT3RBUVJBSTB3Z0FHb2tUQU5BSTB3Q2Z5TTFCRUJCQ0NOTlFaa0JSZzBCR2tHUUJ3d0JDMEVFSTAxQm1RRkdEUUFhUWNnREMwNEVRQ05NQW44ak5RUkFRUWdqVFVHWkFVWU5BUnBCa0FjTUFRdEJCQ05OUVprQlJnMEFHa0hJQXd0ckpFd2pUU0lBUVpBQlJnUkFJeXNFUUJBM0JTQUFFRFlMRURoQmZ5UzVBVUYvSkxvQkJTQUFRWkFCU0FSQUl5dEZCRUFnQUJBMkN3c0xRUUFnQUVFQmFpQUFRWmtCU2hza1RRd0JDd3NMRUcwTHN3RUFJMHNDZnlNMUJFQkJDQ05OUVprQlJnMEJHa0dRQnd3QkMwRUVJMDFCbVFGR0RRQWFRY2dEQzBnRVFBOExBMEFqU3dKL0l6VUVRRUVJSTAxQm1RRkdEUUVhUVpBSERBRUxRUVFqVFVHWkFVWU5BQnBCeUFNTFRnUkFBbjhqTlFSQVFRZ2pUVUdaQVVZTkFScEJrQWNNQVF0QkJDTk5RWmtCUmcwQUdrSElBd3NRYmlOTEFuOGpOUVJBUVFnalRVR1pBVVlOQVJwQmtBY01BUXRCQkNOTlFaa0JSZzBBR2tISUF3dHJKRXNNQVFzTEN6TUJBWDlCQVNPSEFRUi9RUUlGUVFjTElnSjBJQUJ4UVFCSElnQUVmMEVCSUFKMElBRnhSUVVnQUFzRVFFRUJEd3RCQUF1VkFRRUNmeU9JQVVVRVFBOExBMEFnQVNBQVNBUkFJQUZCQkdvaEFTT0VBU0lDUVFScUpJUUJJNFFCUWYvL0Ewb0VRQ09FQVVHQWdBUnJKSVFCQ3lBQ0k0UUJFSEFFUUVHQi9nTkJnZjRERUFGQkFYUkJBV3BCL3dGeEVBUWpoUUZCQVdva2hRRWpoUUZCQ0VZRVFFRUFKSVVCUVFFa2VVRURFRGxCZ3Y0RFFZTCtBeEFCUWY5K2NSQUVRUUFraUFFTEN3d0JDd3NMaGdFQUk3Z0JRUUJLQkVBanVBRWdBR29oQUVFQUpMZ0JDeU5BSUFCcUpFQWpSRVVFUUNNcEJFQWpTeUFBYWlSTEVHOEZJQUFRYmdzaktBUkFJMUlnQUdva1VnVWdBQkJNQ3lBQUVIRUxJeW9FUUNOOElBQnFKSHdRWlFVZ0FCQmtDeU9MQVNBQWFpU0xBU09MQVNPSkFVNEVRQ09LQVVFQmFpU0tBU09MQVNPSkFXc2tpd0VMQ3dvQVFRUVFjaU0vRUFFTEpnRUJmMEVFRUhJalAwRUJha0gvL3dOeEVBRWhBQkJ6UWY4QmNTQUFRZjhCY1VFSWRISUxEQUJCQkJCeUlBQWdBUkJwQ3pBQkFYOUJBU0FBZEVIL0FYRWhBaUFCUVFCS0JFQWpQU0FDY2tIL0FYRWtQUVVqUFNBQ1FmOEJjM0VrUFFzalBRc0pBRUVGSUFBUWRob0xTUUVCZnlBQlFRQk9CRUFnQUVFUGNTQUJRUTl4YWtFUWNRUkFRUUVRZHdWQkFCQjNDd1VnQVVFZmRTSUNJQUVnQW1welFROXhJQUJCRDNGTEJFQkJBUkIzQlVFQUVIY0xDd3NKQUVFSElBQVFkaG9MQ1FCQkJpQUFFSFlhQ3drQVFRUWdBQkIyR2dzN0FRSi9JQUZCZ1A0RGNVRUlkU0VDSUFCQkFXb2hBeUFBSUFGQi93RnhJZ0VRYUFSQUlBQWdBUkFFQ3lBRElBSVFhQVJBSUFNZ0FoQUVDd3NNQUVFSUVISWdBQ0FCRUh3TGRRQWdBZ1JBSUFFZ0FFSC8vd054SWdCcUlBQWdBWE56SWdKQkVIRUVRRUVCRUhjRlFRQVFkd3NnQWtHQUFuRUVRRUVCRUhzRlFRQVFld3NGSUFBZ0FXcEIvLzhEY1NJQ0lBQkIvLzhEY1VrRVFFRUJFSHNGUVFBUWV3c2dBQ0FCY3lBQ2MwR0FJSEVFUUVFQkVIY0ZRUUFRZHdzTEN3b0FRUVFRY2lBQUVGRUxrQVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMREJNTEVIUkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa055QUFRZjhCY1NRNERCRUxJemhCL3dGeEl6ZEIvd0Z4UVFoMGNpTTJFSFVNRVFzak9FSC9BWEVqTjBIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkRjTUVRc2pOMEVCRUhnak4wRUJha0gvQVhFa055TTNCRUJCQUJCNUJVRUJFSGtMUVFBUWVnd1BDeU0zUVg4UWVDTTNRUUZyUWY4QmNTUTNJemNFUUVFQUVIa0ZRUUVRZVF0QkFSQjZEQTRMRUhOQi93RnhKRGNNQ3dzak5rR0FBWEZCZ0FGR0JFQkJBUkI3QlVFQUVIc0xJellpQUVFQmRDQUFRZjhCY1VFSGRuSkIvd0Z4SkRZTUNRc1FkRUgvL3dOeEl6NFFmUXdLQ3lNOFFmOEJjU003UWY4QmNVRUlkSElpQUNNNFFmOEJjU00zUWY4QmNVRUlkSElpQVVFQUVINGdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1E3SUFCQi93RnhKRHhCQUJCNlFRZ1BDeU00UWY4QmNTTTNRZjhCY1VFSWRISVFmMEgvQVhFa05nd0pDeU00UWY4QmNTTTNRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtOd3dKQ3lNNFFRRVFlQ000UVFGcVFmOEJjU1E0SXpnRVFFRUFFSGtGUVFFUWVRdEJBQkI2REFjTEl6aEJmeEI0SXpoQkFXdEIvd0Z4SkRnak9BUkFRUUFRZVFWQkFSQjVDMEVCRUhvTUJnc1FjMEgvQVhFa09Bd0RDeU0yUVFGeFFRQkxCRUJCQVJCN0JVRUFFSHNMSXpZaUFFRUhkQ0FBUWY4QmNVRUJkbkpCL3dGeEpEWU1BUXRCZnc4TFFRQVFlVUVBRUhwQkFCQjNEQUlMSXo5QkFXcEIvLzhEY1NRL0RBRUxJejlCQW1wQi8vOERjU1EvQzBFRUR3c2dBRUgvQVhFa09FRUlDeWdCQVg4Z0FFRVlkRUVZZFNJQlFZQUJjUVJBUVlBQ0lBQkJHSFJCR0hWclFYOXNJUUVMSUFFTEtRRUJmeUFBRUlFQklRRWpQeUFCUVJoMFFSaDFha0gvL3dOeEpEOGpQMEVCYWtILy93TnhKRDhMMWdVQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkVFY0VRQ0FBUVJGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TXhCRUJCemY0REVIOUIvd0Z4SWdCQkFYRUVRRUhOL2dNZ0FFRitjU0lBUVlBQmNRUi9RUUFrTlNBQVFmOStjUVZCQVNRMUlBQkJnQUZ5Q3hCMVFjUUFEd3NMUVFFa1JBd1JDeEIwUWYvL0EzRWlBRUdBL2dOeFFRaDFKRGtnQUVIL0FYRWtPaU0vUVFKcVFmLy9BM0VrUHd3UkN5TTZRZjhCY1NNNVFmOEJjVUVJZEhJak5oQjFEQkFMSXpwQi93RnhJemxCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1E1REJBTEl6bEJBUkI0SXpsQkFXcEIvd0Z4SkRrak9RUkFRUUFRZVFWQkFSQjVDMEVBRUhvTURnc2pPVUYvRUhnak9VRUJhMEgvQVhFa09TTTVCRUJCQUJCNUJVRUJFSGtMUVFFUWVnd05DeEJ6UWY4QmNTUTVEQXNMUVFGQkFDTTJJZ0ZCZ0FGeFFZQUJSaHNoQUNNOVFRUjJRUUZ4SUFGQkFYUnlRZjhCY1NRMkRBa0xFSE1RZ2dGQkNBOExJenhCL3dGeEl6dEIvd0Z4UVFoMGNpSUFJenBCL3dGeEl6bEIvd0Z4UVFoMGNpSUJRUUFRZmlBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpEc2dBRUgvQVhFa1BFRUFFSHBCQ0E4TEl6cEIvd0Z4SXpsQi93RnhRUWgwY2hCL1FmOEJjU1EyREFnTEl6cEIvd0Z4SXpsQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNRNURBZ0xJenBCQVJCNEl6cEJBV3BCL3dGeEpEb2pPZ1JBUVFBUWVRVkJBUkI1QzBFQUVIb01CZ3NqT2tGL0VIZ2pPa0VCYTBIL0FYRWtPaU02QkVCQkFCQjVCVUVCRUhrTFFRRVFlZ3dGQ3hCelFmOEJjU1E2REFNTFFRRkJBQ00ySWdGQkFYRkJBVVliSVFBalBVRUVka0VCY1VFSGRDQUJRZjhCY1VFQmRuSWtOZ3dCQzBGL0R3c2dBQVJBUVFFUWV3VkJBQkI3QzBFQUVIbEJBQkI2UVFBUWR3d0JDeU0vUVFGcVFmLy9BM0VrUHd0QkJBOExJQUJCL3dGeEpEcEJDQXUzQmdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRU0JIQkVBZ0FFRWhhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqUFVFSGRrRUJjUVJBSXo5QkFXcEIvLzhEY1NRL0JSQnpFSUlCQzBFSUR3c1FkRUgvL3dOeElnQkJnUDREY1VFSWRTUTdJQUJCL3dGeEpEd2pQMEVDYWtILy93TnhKRDhNRUFzalBFSC9BWEVqTzBIL0FYRkJDSFJ5SWdBak5oQjFJQUJCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrT3lBQVFmOEJjU1E4REE4TEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2tFQmFrSC8vd054SWdCQmdQNERjVUVJZFNRN0lBQkIvd0Z4SkR4QkNBOExJenRCQVJCNEl6dEJBV3BCL3dGeEpEc2pPd1JBUVFBUWVRVkJBUkI1QzBFQUVIb01EUXNqTzBGL0VIZ2pPMEVCYTBIL0FYRWtPeU03QkVCQkFCQjVCVUVCRUhrTFFRRVFlZ3dNQ3hCelFmOEJjU1E3REFvTFFRWkJBQ005UVFWMlFRRnhRUUJMR3lFQklBRkI0QUJ5SUFFalBVRUVka0VCY1VFQVN4c2hBU005UVFaMlFRRnhRUUJMQkg4ak5pQUJhMEgvQVhFRklBRkJCbklnQVNNMklnQkJEM0ZCQ1VzYklnRkI0QUJ5SUFFZ0FFR1pBVXNiSWdFZ0FHcEIvd0Z4Q3lJQUJFQkJBQkI1QlVFQkVIa0xJQUZCNEFCeEJFQkJBUkI3QlVFQUVIc0xRUUFRZHlBQUpEWU1DZ3NqUFVFSGRrRUJjVUVBU3dSQUVITVFnZ0VGSXo5QkFXcEIvLzhEY1NRL0MwRUlEd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlJZ0VnQVVILy93TnhRUUFRZmlBQlFRRjBRZi8vQTNFaUFVR0EvZ054UVFoMUpEc2dBVUgvQVhFa1BFRUFFSHBCQ0E4TEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2lJQkVIOUIvd0Z4SkRZZ0FVRUJha0gvL3dOeElnRkJnUDREY1VFSWRTUTdJQUZCL3dGeEpEd01Cd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlRUUZyUWYvL0EzRWlBVUdBL2dOeFFRaDFKRHNnQVVIL0FYRWtQRUVJRHdzalBFRUJFSGdqUEVFQmFrSC9BWEVrUENNOEJFQkJBQkI1QlVFQkVIa0xRUUFRZWd3RkN5TThRWDhRZUNNOFFRRnJRZjhCY1NROEl6d0VRRUVBRUhrRlFRRVFlUXRCQVJCNkRBUUxFSE5CL3dGeEpEd01BZ3NqTmtGL2MwSC9BWEVrTmtFQkVIcEJBUkIzREFJTFFYOFBDeU0vUVFGcVFmLy9BM0VrUHd0QkJBdVJCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUV3UndSQUlBQkJNV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSXoxQkJIWkJBWEVFUUNNL1FRRnFRZi8vQTNFa1B3VVFjeENDQVF0QkNBOExFSFJCLy84RGNTUStJejlCQW1wQi8vOERjU1EvREJJTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2lJQUl6WVFkUXdPQ3lNK1FRRnFRZi8vQTNFa1BrRUlEd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlJZ0FRZnlJQlFRRVFlQ0FCUVFGcVFmOEJjU0lCQkVCQkFCQjVCVUVCRUhrTFFRQVFlZ3dOQ3lNOFFmOEJjU003UWY4QmNVRUlkSElpQUJCL0lnRkJmeEI0SUFGQkFXdEIvd0Z4SWdFRVFFRUFFSGtGUVFFUWVRdEJBUkI2REF3TEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2hCelFmOEJjUkIxREF3TFFRQVFla0VBRUhkQkFSQjdEQXdMSXoxQkJIWkJBWEZCQVVZRVFCQnpFSUlCQlNNL1FRRnFRZi8vQTNFa1B3dEJDQThMSXp4Qi93RnhJenRCL3dGeFFRaDBjaUlCSXo1QkFCQitJejRnQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrT3lBQVFmOEJjU1E4UVFBUWVrRUlEd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlJZ0FRZjBIL0FYRWtOZ3dHQ3lNK1FRRnJRZi8vQTNFa1BrRUlEd3NqTmtFQkVIZ2pOa0VCYWtIL0FYRWtOaU0yQkVCQkFCQjVCVUVCRUhrTFFRQVFlZ3dIQ3lNMlFYOFFlQ00yUVFGclFmOEJjU1EySXpZRVFFRUFFSGtGUVFFUWVRdEJBUkI2REFZTEVITkIvd0Z4SkRZTUJBdEJBQkI2UVFBUWR5TTlRUVIyUVFGeFFRQkxCRUJCQUJCN0JVRUJFSHNMREFRTFFYOFBDeUFBUVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkRzZ0FFSC9BWEVrUEF3Q0N5QUFRZi8vQTNFZ0FSQjFEQUVMSXo5QkFXcEIvLzhEY1NRL0MwRUVDK0lCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCd0FCSEJFQWdBRUhCQUVZTkFRSkFJQUJCd2dCckRnNERCQVVHQndnSkVRb0xEQTBPRHdBTERBOExEQThMSXpna053d09DeU01SkRjTURRc2pPaVEzREF3TEl6c2tOd3dMQ3lNOEpEY01DZ3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlFSDlCL3dGeEpEY01DUXNqTmlRM0RBZ0xJemNrT0F3SEN5TTVKRGdNQmdzak9pUTREQVVMSXpza09Bd0VDeU04SkRnTUF3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUVIOUIvd0Z4SkRnTUFnc2pOaVE0REFFTFFYOFBDMEVFQzkwQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQVJ3UkFJQUJCMFFCR0RRRUNRQ0FBUWRJQWF3NE9FQU1FQlFZSENBa0tFQXNNRFE0QUN3d09DeU0zSkRrTURnc2pPQ1E1REEwTEl6b2tPUXdNQ3lNN0pEa01Dd3NqUENRNURBb0xJenhCL3dGeEl6dEIvd0Z4UVFoMGNoQi9RZjhCY1NRNURBa0xJellrT1F3SUN5TTNKRG9NQndzak9DUTZEQVlMSXpra09nd0ZDeU03SkRvTUJBc2pQQ1E2REFNTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2hCL1FmOEJjU1E2REFJTEl6WWtPZ3dCQzBGL0R3dEJCQXZkQVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQUVjRVFDQUFRZUVBUmcwQkFrQWdBRUhpQUdzT0RnTUVFQVVHQndnSkNnc01FQTBPQUFzTURnc2pOeVE3REE0TEl6Z2tPd3dOQ3lNNUpEc01EQXNqT2lRN0RBc0xJendrT3d3S0N5TThRZjhCY1NNN1FmOEJjVUVJZEhJUWYwSC9BWEVrT3d3SkN5TTJKRHNNQ0Fzak55UThEQWNMSXpna1BBd0dDeU01SkR3TUJRc2pPaVE4REFRTEl6c2tQQXdEQ3lNOFFmOEJjU003UWY4QmNVRUlkSElRZjBIL0FYRWtQQXdDQ3lNMkpEd01BUXRCZnc4TFFRUUw2Z0lBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUVjRVFDQUFRZkVBUmcwQkFrQWdBRUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhSQUFzTUR3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUl6Y1FkUXdQQ3lNOFFmOEJjU003UWY4QmNVRUlkSElqT0JCMURBNExJenhCL3dGeEl6dEIvd0Z4UVFoMGNpTTVFSFVNRFFzalBFSC9BWEVqTzBIL0FYRkJDSFJ5SXpvUWRRd01DeU04UWY4QmNTTTdRZjhCY1VFSWRISWpPeEIxREFzTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2lNOEVIVU1DZ3NqdXdGRkJFQUNRQ09RQVFSQVFRRWtRUXdCQ3lOMUkzdHhRUjl4UlFSQVFRRWtRZ3dCQzBFQkpFTUxDd3dKQ3lNOFFmOEJjU003UWY4QmNVRUlkSElqTmhCMURBZ0xJemNrTmd3SEN5TTRKRFlNQmdzak9TUTJEQVVMSXpva05nd0VDeU03SkRZTUF3c2pQQ1EyREFJTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2hCL1FmOEJjU1EyREFFTFFYOFBDMEVFQzBrQkFYOGdBVUVBVGdSQUlBQkIvd0Z4SUFBZ0FXcEIvd0Z4U3dSQVFRRVFld1ZCQUJCN0N3VWdBVUVmZFNJQ0lBRWdBbXB6SUFCQi93RnhTZ1JBUVFFUWV3VkJBQkI3Q3dzTE5BRUJmeU0ySUFCQi93RnhJZ0VRZUNNMklBRVFpZ0VqTmlBQWFrSC9BWEVrTmlNMkJFQkJBQkI1QlVFQkVIa0xRUUFRZWd0c0FRSi9JellnQUdvalBVRUVka0VCY1dwQi93RnhJZ0VoQWlNMklBQnpJQUZ6UVJCeEJFQkJBUkIzQlVFQUVIY0xJellnQUVIL0FYRnFJejFCQkhaQkFYRnFRWUFDY1VFQVN3UkFRUUVRZXdWQkFCQjdDeUFDSkRZak5nUkFRUUFRZVFWQkFSQjVDMEVBRUhvTDd3RUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHQUFVY0VRQ0FCUVlFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pOeENMQVF3UUN5TTRFSXNCREE4TEl6a1Fpd0VNRGdzak9oQ0xBUXdOQ3lNN0VJc0JEQXdMSXp3UWl3RU1Dd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlFSDhRaXdFTUNnc2pOaENMQVF3SkN5TTNFSXdCREFnTEl6Z1FqQUVNQndzak9SQ01BUXdHQ3lNNkVJd0JEQVVMSXpzUWpBRU1CQXNqUEJDTUFRd0RDeU04UWY4QmNTTTdRZjhCY1VFSWRISVFmeENNQVF3Q0N5TTJFSXdCREFFTFFYOFBDMEVFQ3pjQkFYOGpOaUFBUWY4QmNVRi9iQ0lCRUhnak5pQUJFSW9CSXpZZ0FHdEIvd0Z4SkRZak5nUkFRUUFRZVFWQkFSQjVDMEVCRUhvTGJBRUNmeU0ySUFCckl6MUJCSFpCQVhGclFmOEJjU0lCSVFJak5pQUFjeUFCYzBFUWNRUkFRUUVRZHdWQkFCQjNDeU0ySUFCQi93RnhheU05UVFSMlFRRnhhMEdBQW5GQkFFc0VRRUVCRUhzRlFRQVFld3NnQWlRMkl6WUVRRUVBRUhrRlFRRVFlUXRCQVJCNkMrOEJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQmtBRkhCRUFnQVVHUkFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJemNRamdFTUVBc2pPQkNPQVF3UEN5TTVFSTRCREE0TEl6b1FqZ0VNRFFzak94Q09BUXdNQ3lNOEVJNEJEQXNMSXp4Qi93RnhJenRCL3dGeFFRaDBjaEIvRUk0QkRBb0xJellRamdFTUNRc2pOeENQQVF3SUN5TTRFSThCREFjTEl6a1Fqd0VNQmdzak9oQ1BBUXdGQ3lNN0VJOEJEQVFMSXp3UWp3RU1Bd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlFSDhRandFTUFnc2pOaENQQVF3QkMwRi9Ed3RCQkFzakFDTTJJQUJ4SkRZak5nUkFRUUFRZVFWQkFSQjVDMEVBRUhwQkFSQjNRUUFRZXdzbkFDTTJJQUJ6UWY4QmNTUTJJellFUUVFQUVIa0ZRUUVRZVF0QkFCQjZRUUFRZDBFQUVIc0w3d0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR2dBVWNFUUNBQlFhRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqTnhDUkFRd1FDeU00RUpFQkRBOExJemtRa1FFTURnc2pPaENSQVF3TkN5TTdFSkVCREF3TEl6d1FrUUVNQ3dzalBFSC9BWEVqTzBIL0FYRkJDSFJ5RUg4UWtRRU1DZ3NqTmhDUkFRd0pDeU0zRUpJQkRBZ0xJemdRa2dFTUJ3c2pPUkNTQVF3R0N5TTZFSklCREFVTEl6c1FrZ0VNQkFzalBCQ1NBUXdEQ3lNOFFmOEJjU003UWY4QmNVRUlkSElRZnhDU0FRd0NDeU0yRUpJQkRBRUxRWDhQQzBFRUN5Y0FJellnQUhKQi93RnhKRFlqTmdSQVFRQVFlUVZCQVJCNUMwRUFFSHBCQUJCM1FRQVFld3N2QVFGL0l6WWdBRUgvQVhGQmYyd2lBUkI0SXpZZ0FSQ0tBU00ySUFGcUJFQkJBQkI1QlVFQkVIa0xRUUVRZWd2dkFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWJBQlJ3UkFJQUZCc1FGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TTNFSlFCREJBTEl6Z1FsQUVNRHdzak9SQ1VBUXdPQ3lNNkVKUUJEQTBMSXpzUWxBRU1EQXNqUEJDVUFRd0xDeU04UWY4QmNTTTdRZjhCY1VFSWRISVFmeENVQVF3S0N5TTJFSlFCREFrTEl6Y1FsUUVNQ0Fzak9CQ1ZBUXdIQ3lNNUVKVUJEQVlMSXpvUWxRRU1CUXNqT3hDVkFRd0VDeU04RUpVQkRBTUxJenhCL3dGeEl6dEIvd0Z4UVFoMGNoQi9FSlVCREFJTEl6WVFsUUVNQVF0QmZ3OExRUVFMT3dFQmZ5QUFFRkFpQVVGL1JnUi9JQUFRQVFVZ0FRdEIvd0Z4SUFCQkFXb2lBUkJRSWdCQmYwWUVmeUFCRUFFRklBQUxRZjhCY1VFSWRISUxDd0JCQ0JCeUlBQVFsd0VMUXdBZ0FFR0FBWEZCZ0FGR0JFQkJBUkI3QlVFQUVIc0xJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU0lBQkVCQkFCQjVCVUVCRUhrTFFRQVFla0VBRUhjZ0FBdEJBQ0FBUVFGeFFRQkxCRUJCQVJCN0JVRUFFSHNMSUFCQkIzUWdBRUgvQVhGQkFYWnlRZjhCY1NJQUJFQkJBQkI1QlVFQkVIa0xRUUFRZWtFQUVIY2dBQXRQQVFGL1FRRkJBQ0FBUVlBQmNVR0FBVVliSVFFalBVRUVka0VCY1NBQVFRRjBja0gvQVhFaEFDQUJCRUJCQVJCN0JVRUFFSHNMSUFBRVFFRUFFSGtGUVFFUWVRdEJBQkI2UVFBUWR5QUFDMUFCQVg5QkFVRUFJQUJCQVhGQkFVWWJJUUVqUFVFRWRrRUJjVUVIZENBQVFmOEJjVUVCZG5JaEFDQUJCRUJCQVJCN0JVRUFFSHNMSUFBRVFFRUFFSGtGUVFFUWVRdEJBQkI2UVFBUWR5QUFDMFlCQVg5QkFVRUFJQUJCZ0FGeFFZQUJSaHNoQVNBQVFRRjBRZjhCY1NFQUlBRUVRRUVCRUhzRlFRQVFld3NnQUFSQVFRQVFlUVZCQVJCNUMwRUFFSHBCQUJCM0lBQUxYZ0VDZjBFQlFRQWdBRUVCY1VFQlJoc2hBVUVCUVFBZ0FFR0FBWEZCZ0FGR0d5RUNJQUJCL3dGeFFRRjJJZ0JCZ0FGeUlBQWdBaHNpQUFSQVFRQVFlUVZCQVJCNUMwRUFFSHBCQUJCM0lBRUVRRUVCRUhzRlFRQVFld3NnQUFzd0FDQUFRUTl4UVFSMElBQkI4QUZ4UVFSMmNpSUFCRUJCQUJCNUJVRUJFSGtMUVFBUWVrRUFFSGRCQUJCN0lBQUxRZ0VCZjBFQlFRQWdBRUVCY1VFQlJoc2hBU0FBUWY4QmNVRUJkaUlBQkVCQkFCQjVCVUVCRUhrTFFRQVFla0VBRUhjZ0FRUkFRUUVRZXdWQkFCQjdDeUFBQ3lRQVFRRWdBSFFnQVhGQi93RnhCRUJCQUJCNUJVRUJFSGtMUVFBUWVrRUJFSGNnQVF1ZUNBRUdmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVJYnlJR0lnVUVRQ0FGUVFGckRnY0JBZ01FQlFZSENBc2pOeUVCREFjTEl6Z2hBUXdHQ3lNNUlRRU1CUXNqT2lFQkRBUUxJenNoQVF3REN5TThJUUVNQWdzalBFSC9BWEVqTzBIL0FYRkJDSFJ5RUg4aEFRd0JDeU0ySVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQlNJRUJFQWdCRUVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzZ0FFRUhUQVIvUVFFaEFpQUJFSmtCQlNBQVFROU1CSDlCQVNFQ0lBRVFtZ0VGUVFBTEN5RUREQThMSUFCQkYwd0VmMEVCSVFJZ0FSQ2JBUVVnQUVFZlRBUi9RUUVoQWlBQkVKd0JCVUVBQ3dzaEF3d09DeUFBUVNkTUJIOUJBU0VDSUFFUW5RRUZJQUJCTDB3RWYwRUJJUUlnQVJDZUFRVkJBQXNMSVFNTURRc2dBRUUzVEFSL1FRRWhBaUFCRUo4QkJTQUFRVDlNQkg5QkFTRUNJQUVRb0FFRlFRQUxDeUVEREF3TElBQkJ4d0JNQkg5QkFTRUNRUUFnQVJDaEFRVWdBRUhQQUV3RWYwRUJJUUpCQVNBQkVLRUJCVUVBQ3dzaEF3d0xDeUFBUWRjQVRBUi9RUUVoQWtFQ0lBRVFvUUVGSUFCQjN3Qk1CSDlCQVNFQ1FRTWdBUkNoQVFWQkFBc0xJUU1NQ2dzZ0FFSG5BRXdFZjBFQklRSkJCQ0FCRUtFQkJTQUFRZThBVEFSL1FRRWhBa0VGSUFFUW9RRUZRUUFMQ3lFRERBa0xJQUJCOXdCTUJIOUJBU0VDUVFZZ0FSQ2hBUVVnQUVIL0FFd0VmMEVCSVFKQkJ5QUJFS0VCQlVFQUN3c2hBd3dJQ3lBQVFZY0JUQVIvUVFFaEFpQUJRWDV4QlNBQVFZOEJUQVIvUVFFaEFpQUJRWDF4QlVFQUN3c2hBd3dIQ3lBQVFaY0JUQVIvUVFFaEFpQUJRWHR4QlNBQVFaOEJUQVIvUVFFaEFpQUJRWGR4QlVFQUN3c2hBd3dHQ3lBQVFhY0JUQVIvUVFFaEFpQUJRVzl4QlNBQVFhOEJUQVIvUVFFaEFpQUJRVjl4QlVFQUN3c2hBd3dGQ3lBQVFiY0JUQVIvUVFFaEFpQUJRYjkvY1FVZ0FFRy9BVXdFZjBFQklRSWdBVUgvZm5FRlFRQUxDeUVEREFRTElBQkJ4d0ZNQkg5QkFTRUNJQUZCQVhJRklBQkJ6d0ZNQkg5QkFTRUNJQUZCQW5JRlFRQUxDeUVEREFNTElBQkIxd0ZNQkg5QkFTRUNJQUZCQkhJRklBQkIzd0ZNQkg5QkFTRUNJQUZCQ0hJRlFRQUxDeUVEREFJTElBQkI1d0ZNQkg5QkFTRUNJQUZCRUhJRklBQkI3d0ZNQkg5QkFTRUNJQUZCSUhJRlFRQUxDeUVEREFFTElBQkI5d0ZNQkg5QkFTRUNJQUZCd0FCeUJTQUFRZjhCVEFSL1FRRWhBaUFCUVlBQmNnVkJBQXNMSVFNTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBR0lnUUVRQ0FFUVFGckRnY0JBZ01FQlFZSENBc2dBeVEzREFjTElBTWtPQXdHQ3lBREpEa01CUXNnQXlRNkRBUUxJQU1rT3d3REN5QURKRHdNQWdzZ0JVRUVTQ0lFQkg4Z0JBVWdCVUVIU2dzRVFDTThRZjhCY1NNN1FmOEJjVUVJZEhJZ0F4QjFDd3dCQ3lBREpEWUxRUVJCZnlBQ0d3dnVBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUZIQkVBZ0FFSEJBV3NPRHdFQ0V3TUVCUVlIQ0FrS0N4SU1EUTRMSXoxQkIzWkJBWEVORXd3UEN5TStFSmdCUWYvL0EzRWhBQ00rUVFKcVFmLy9BM0VrUGlBQVFZRCtBM0ZCQ0hVa055QUFRZjhCY1NRNFFRUVBDeU05UVFkMlFRRnhEUTRNRUFzalBVRUhka0VCY1EwTkRBNExJejVCQW10Qi8vOERjU1ErSXo0ak9FSC9BWEVqTjBIL0FYRkJDSFJ5RUgwTUR3c1FjeENMQVF3SkN5TStRUUpyUWYvL0EzRWtQaU0rSXo4UWZVRUFKRDhNRFFzalBVRUhka0VCY1VFQlJ3ME1EQWdMSXo0UW1BRkIvLzhEY1NRL0l6NUJBbXBCLy84RGNTUStEQXNMSXoxQkIzWkJBWEZCQVVZTkNRd0hDeEJ6UWY4QmNSQ2lBU0VBSXo5QkFXcEIvLzhEY1NRL0lBQVBDeU05UVFkMlFRRnhRUUZIRFFValBrRUNhMEgvL3dOeEpENGpQaU0vUVFKcVFmLy9BM0VRZlF3SEN4QnpFSXdCREFJTEl6NUJBbXRCLy84RGNTUStJejRqUHhCOVFRZ2tQd3dHQzBGL0R3c2pQMEVCYWtILy93TnhKRDlCQkE4TEl6NFFtQUZCLy84RGNTUS9JejVCQW1wQi8vOERjU1ErUVF3UEN5TS9RUUpxUWYvL0EzRWtQMEVNRHdzalBrRUNhMEgvL3dOeEpENGpQaU0vUVFKcVFmLy9BM0VRZlFzUWRFSC8vd054SkQ4TFFRZ0wwd01BQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBRkhCRUFnQUVIUkFXc09Ed0VDRFFNRUJRWUhDQWtOQ2cwTERBMExJejFCQkhaQkFYRU5FUXdPQ3lNK0VKZ0JRZi8vQTNFaEFDTStRUUpxUWYvL0EzRWtQaUFBUVlEK0EzRkJDSFVrT1NBQVFmOEJjU1E2UVFRUEN5TTlRUVIyUVFGeERRME1EZ3NqUFVFRWRrRUJjUTBNSXo1QkFtdEIvLzhEY1NRK0l6NGpQMEVDYWtILy93TnhFSDBNRFFzalBrRUNhMEgvL3dOeEpENGpQaU02UWY4QmNTTTVRZjhCY1VFSWRISVFmUXdOQ3hCekVJNEJEQWdMSXo1QkFtdEIvLzhEY1NRK0l6NGpQeEI5UVJBa1B3d0xDeU05UVFSMlFRRnhRUUZIRFFvTUJ3c2pQaENZQVVILy93TnhKRDlCQVNTUkFTTStRUUpxUWYvL0EzRWtQZ3dKQ3lNOVFRUjJRUUZ4UVFGR0RRY01CZ3NqUFVFRWRrRUJjVUVCUncwRkl6NUJBbXRCLy84RGNTUStJejRqUDBFQ2FrSC8vd054RUgwTUJnc1FjeENQQVF3Q0N5TStRUUpyUWYvL0EzRWtQaU0rSXo4UWZVRVlKRDhNQlF0QmZ3OExJejlCQVdwQi8vOERjU1EvUVFRUEN5TStFSmdCUWYvL0EzRWtQeU0rUVFKcVFmLy9BM0VrUGtFTUR3c2pQMEVDYWtILy93TnhKRDlCREE4TEVIUkIvLzhEY1NRL0MwRUlDL0FDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWVBQlJ3UkFJQUJCNFFGckRnOEJBZ3NMQXdRRkJnY0lDd3NMQ1FvTEN4QnpRZjhCY1VHQS9nTnFJellRZFF3TEN5TStFSmdCUWYvL0EzRWhBQ00rUVFKcVFmLy9BM0VrUGlBQVFZRCtBM0ZCQ0hVa095QUFRZjhCY1NROFFRUVBDeU00UVlEK0Eyb2pOaEIxUVFRUEN5TStRUUpyUWYvL0EzRWtQaU0rSXp4Qi93RnhJenRCL3dGeFFRaDBjaEI5UVFnUEN4QnpFSkVCREFjTEl6NUJBbXRCLy84RGNTUStJejRqUHhCOVFTQWtQMEVJRHdzUWN4Q0JBVUVZZEVFWWRTRUFJejRnQUVFQkVINGpQaUFBYWtILy93TnhKRDVCQUJCNVFRQVFlaU0vUVFGcVFmLy9BM0VrUDBFTUR3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUpEOUJCQThMRUhSQi8vOERjU00yRUhValAwRUNha0gvL3dOeEpEOUJCQThMRUhNUWtnRU1BZ3NqUGtFQ2EwSC8vd054SkQ0alBpTS9FSDFCS0NRL1FRZ1BDMEYvRHdzalAwRUJha0gvL3dOeEpEOUJCQXVrQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVVjRVFDQUFRZkVCYXc0UEFRSUREUVFGQmdjSUNRb05EUXNNRFFzUWMwSC9BWEZCZ1A0RGFoQi9RZjhCY1NRMkRBMExJejRRbUFGQi8vOERjU0VBSXo1QkFtcEIvLzhEY1NRK0lBQkJnUDREY1VFSWRTUTJJQUJCL3dGeEpEME1EUXNqT0VHQS9nTnFFSDlCL3dGeEpEWU1EQXRCQUNTUUFRd0xDeU0rUVFKclFmLy9BM0VrUGlNK0l6MUIvd0Z4SXpaQi93RnhRUWgwY2hCOVFRZ1BDeEJ6RUpRQkRBZ0xJejVCQW10Qi8vOERjU1ErSXo0alB4QjlRVEFrUDBFSUR3c1FjeENCQVNFQVFRQVFlVUVBRUhvalBpQUFRUmgwUVJoMUlnQkJBUkIrSXo0Z0FHcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa095QUFRZjhCY1NROEl6OUJBV3BCLy84RGNTUS9RUWdQQ3lNOFFmOEJjU003UWY4QmNVRUlkSElrUGtFSUR3c1FkRUgvL3dOeEVIOUIvd0Z4SkRZalAwRUNha0gvL3dOeEpEOE1CUXRCQVNTUkFRd0VDeEJ6RUpVQkRBSUxJejVCQW10Qi8vOERjU1ErSXo0alB4QjlRVGdrUDBFSUR3dEJmdzhMSXo5QkFXcEIvLzhEY1NRL0MwRUVDOXdCQVFGL0l6OUJBV3BCLy84RGNTUS9JME1FUUNNL1FRRnJRZi8vQTNFa1B3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPRFFNRUJRWUhDQWtLQ3d3TkRnOEFDd3dQQ3lBQUVJQUJEd3NnQUJDREFROExJQUFRaEFFUEN5QUFFSVVCRHdzZ0FCQ0dBUThMSUFBUWh3RVBDeUFBRUlnQkR3c2dBQkNKQVE4TElBQVFqUUVQQ3lBQUVKQUJEd3NnQUJDVEFROExJQUFRbGdFUEN5QUFFS01CRHdzZ0FCQ2tBUThMSUFBUXBRRVBDeUFBRUtZQkM3MEJBUUovUVFBa2tBRkJqLzRERUFGQkFTQUFkRUYvYzNFaUFTUjdRWS8rQXlBQkVBUWpQa0VDYTBILy93TnhKRDRDUUNOQklnRWpRaUFCR3cwQUN5TStJZ0VqUHlJQ1FmOEJjUkFFSUFGQkFXb2dBa0dBL2dOeFFRaDFFQVFDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdNREJBVUFDd3dGQzBFQUpIWkJ3QUFrUHd3RUMwRUFKSGRCeUFBa1B3d0RDMEVBSkhoQjBBQWtQd3dDQzBFQUpIbEIyQUFrUHd3QkMwRUFKSHBCNEFBa1B3c0w5QUVCQTM4amtRRUVRRUVCSkpBQlFRQWtrUUVMSTNVamUzRkJIM0ZCQUVvRVFDTkNSU09RQVNJQ0lBSWJCSDhqZGlOd0lnQWdBQnNFZjBFQUVLZ0JRUUVGSTNjamNTSUFJQUFiQkg5QkFSQ29BVUVCQlNONEkzSWlBQ0FBR3dSL1FRSVFxQUZCQVFVamVTTnpJZ0FnQUJzRWYwRURFS2dCUVFFRkkzb2pkQ0lBSUFBYkJIOUJCQkNvQVVFQkJVRUFDd3NMQ3dzRlFRQUxCRUFDZjBFQkkwRWlBQ05DSUFBYkRRQWFRUUFMQkg5QkFDUkNRUUFrUVVFQUpFTkJBQ1JFUVJnRlFSUUxJUUVMQW45QkFTTkJJZ0FqUWlBQUd3MEFHa0VBQ3dSQVFRQWtRa0VBSkVGQkFDUkRRUUFrUkFzZ0FROExRUUFMcXdFQkFuOUJBU1FsSTBNRVFDTS9FQUZCL3dGeEVLY0JFSEpCQUNSQ1FRQWtRVUVBSkVOQkFDUkVDeENwQVNJQlFRQktCRUFnQVJCeUMwRUVJUUFDZjBFQkkwRWlBU05DSUFFYkRRQWFRUUFMUlNJQkJIOGpSRVVGSUFFTEJFQWpQeEFCUWY4QmNSQ25BU0VBQ3lNOVFmQUJjU1E5SUFCQkFFd0VRQ0FBRHdzZ0FCQnlJNDRCUVFGcUpJNEJJNDRCSTR3QlRnUkFJNDBCUVFGcUpJMEJJNDRCSTR3QmF5U09BUXNnQUFzRUFDTmhDK1lCQVFWL0lBQkJmMEdBQ0NBQVFRQklHeUFBUVFCS0d5RUVRUUFoQUFOQUFuOENmeUFHUlNJQ0JFQWdBRVVoQWdzZ0Fnc0VRQ0FGUlNFQ0N5QUNDd1JBSUFORklRSUxJQUlFUUJDcUFVRUFTQVJBUVFFaEJnVWpRQ00xQkg5Qm9Na0lCVUhRcEFRTFRnUkFRUUVoQUFVZ0JFRi9TaUlDQkVBallTQUVUaUVDQ3lBQ0JFQkJBU0VGQlNBQlFYOUtJZ0lFUUNNL0lBRkdJUUlMUVFFZ0F5QUNHeUVEQ3dzTERBRUxDeUFBQkVBalFDTTFCSDlCb01rSUJVSFFwQVFMYXlSQUkvOEJEd3NnQlFSQUk0QUNEd3NnQXdSQUk0RUNEd3NqUDBFQmEwSC8vd054SkQ5QmZ3c0pBRUYvUVg4UXJBRUxPQUVEZndOQUlBSWdBRWdpQXdSQUlBRkJBRTRoQXdzZ0F3UkFFSzBCSVFFZ0FrRUJhaUVDREFFTEN5QUJRUUJJQkVBZ0FROExRUUFMQ1FCQmZ5QUFFS3dCQ3drQUlBQWdBUkNzQVFzRkFDT0pBUXNGQUNPS0FRc0ZBQ09MQVF0ZkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lQaEFROExJK0lCRHdzajR3RVBDeVBrQVE4TEkrVUJEd3NqNWdFUEN5UG5BUThMSStnQkR3dEJBQXVMQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUFpQWtFQlJnMEJBa0FnQWtFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQVVFQVJ5VGhBUXdIQ3lBQlFRQkhKT0lCREFZTElBRkJBRWNrNHdFTUJRc2dBVUVBUnlUa0FRd0VDeUFCUVFCSEpPVUJEQU1MSUFGQkFFY2s1Z0VNQWdzZ0FVRUFSeVRuQVF3QkN5QUJRUUJISk9nQkN3dFRBUUYvUVFBa1JDQUFFTFFCUlFSQVFRRWhBUXNnQUVFQkVMVUJJQUVFUUVFQlFRRkJBRUVCUVFBZ0FFRURUQnNpQVNPMkFTSUFJQUFiR3lBQlJTTzNBU0lBSUFBYkd3UkFRUUVrZWtFRUVEa0xDd3NKQUNBQVFRQVF0UUVMbWdFQUlBQkJBRW9FUUVFQUVMWUJCVUVBRUxjQkN5QUJRUUJLQkVCQkFSQzJBUVZCQVJDM0FRc2dBa0VBU2dSQVFRSVF0Z0VGUVFJUXR3RUxJQU5CQUVvRVFFRURFTFlCQlVFREVMY0JDeUFFUVFCS0JFQkJCQkMyQVFWQkJCQzNBUXNnQlVFQVNnUkFRUVVRdGdFRlFRVVF0d0VMSUFaQkFFb0VRRUVHRUxZQkJVRUdFTGNCQ3lBSFFRQktCRUJCQnhDMkFRVkJCeEMzQVFzTEJBQWpOZ3NFQUNNM0N3UUFJemdMQkFBak9Rc0VBQ002Q3dRQUl6c0xCQUFqUEFzRUFDTTlDd1FBSXo4TEJBQWpQZ3NHQUNNL0VBRUxCQUFqVFF1dkF3RUtmMEdBZ0FKQmdKQUNJN0FCR3lFSlFZQzRBa0dBc0FJanNRRWJJUW9EUUNBRlFZQUNTQVJBUVFBaEJBTkFJQVJCZ0FKSUJFQWdDU0FGUVFOMVFRVjBJQXBxSUFSQkEzVnFJZ05CZ0pCK2FpMEFBQkFySVFnZ0JVRUlieUVCUVFjZ0JFRUliMnNoQmtFQUlRSUNmeUFBUVFCS0l6RWlCeUFIR3dSQUlBTkJnTkIrYWkwQUFDRUNDeUFDUWNBQWNRc0VRRUVISUFGcklRRUxRUUFoQnlBQlFRRjBJQWhxSWdOQmdKQitha0VCUVFBZ0FrRUljUnNpQjBFQmNVRU5kR290QUFBaENFRUFJUUVnQTBHQmtINXFJQWRCQVhGQkRYUnFMUUFBUVFFZ0JuUnhCRUJCQWlFQkN5QUJRUUZxSUFGQkFTQUdkQ0FJY1JzaEFTQUZRUWgwSUFScVFRTnNJUVlnQUVFQVNpTXhJZ01nQXhzRVFDQUNRUWR4SUFGQkFCQXNJZ0ZCSDNGQkEzUWhBeUFHUVlDWURtb2lBaUFET2dBQUlBSkJBV29nQVVIZ0IzRkJCWFZCQTNRNkFBQWdBa0VDYWlBQlFZRDRBWEZCQ25WQkEzUTZBQUFGSUFGQngvNERRUUFRTFNFQ1FRQWhBUU5BSUFGQkEwZ0VRQ0FHUVlDWURtb2dBV29nQWpvQUFDQUJRUUZxSVFFTUFRc0xDeUFFUVFGcUlRUU1BUXNMSUFWQkFXb2hCUXdCQ3dzTHlBRUJCbjhDUUFOQUlBRkJGMDROQVVFQUlRQURRQUpBSUFCQkgwNE5BRUVBSVFSQkFVRUFJQUJCRDBvYklRUWdBU0VDSUFKQkQyc2dBaUFCUVE5S0cwRUVkQ0VDSUFCQkQyc2dBbW9nQUNBQ2FpQUFRUTlLR3lFQ1FZQ0FBaUVGUVlDUUFrR0FnQUlnQVVFUFNoc2hCVUVBSVFNRFFBSkFJQU5CQ0U0TkFDQUNJQVVnQkVFQVFRY2dBeUFBUVFOMElBRkJBM1FnQTJwQitBRkJnSmdhUVFGQmZ4QXVHaUFEUVFGcUlRTU1BUXNMSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFBQUN3QUxDd1FBSTMwTEJBQWpmZ3NFQUNOL0N4Z0JBWDhqZ1FFaEFDT0FBUVJBSUFCQkJISWhBQXNnQUFzdEFRRi9Ba0FEUUNBQVFmLy9BMG9OQVNBQVFZQ0FyQVJxSUFBUVVUb0FBQ0FBUVFGcUlRQU1BQUFMQUFzTEZBQS9BRUdNQVVnRVFFR01BVDhBYTBBQUdnc0xBd0FCQ3g4QUFrQUNRQUpBSTVBQ0RnSUJBZ0FMQUF0QkFDRUFDeUFBUVg4UXJBRUxCd0FnQUNTUUFnc3ZBQUpBQWtBQ1FBSkFBa0Fqa0FJT0JBRUNBd1FBQ3dBTFFRRWhBQXRCZnlFQkMwRi9JUUlMSUFFZ0FoQ3NBUXNBTXhCemIzVnlZMlZOWVhCd2FXNW5WVkpNSVdOdmNtVXZaR2x6ZEM5amIzSmxMblZ1ZEc5MVkyaGxaQzUzWVhOdExtMWhjQT09Iik6CiJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvd3x8InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZj9hd2FpdCBFKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlBRVNZQWwvZjM5L2YzOS9mMzhBWUFBQVlBRi9BWDlnQW45L0FHQUJmd0JnQW45L0FYOWdBQUYvWUFOL2YzOEJmMkFEZjM5L0FHQUdmMzkvZjM5L0FHQUhmMzkvZjM5L2Z3Ri9ZQWQvZjM5L2YzOS9BR0FFZjM5L2Z3Ri9ZQWgvZjM5L2YzOS9md0JnQlg5L2YzOS9BWDlnREg5L2YzOS9mMzkvZjM5L2Z3Ri9ZQUFBWUFKL2Z3Ri9BOU1CMFFFQ0FnRUJBd0VCQVFFQkFRRUJBUVFFQVFFQkFBWUJBUUVCQVFFQkFRUUVBUUVCQVFFQkFRRUdCZ1lPQlFjSER3b0xDUWtJQ0FNRUFRRUVBUVFCQVFFQkFRSUNCUUlDQWdJRkRBUUVCQUVDQmdJQ0F3UUVCQVFCQVFFQkJBVUVCZ1lFQXdJRkJBRVFCQVVEQ0FFRkFRUUJCUVFFQmdZREJRUURCQVFFQXdNSUFnSUNCQUlDQWdJQ0FnSURCQVFDQkFRQ0JBUUNCQVFDQWdJQ0FnSUNBZ0lDQWdVQ0FnSUNBZ0lFQmdZR0VRWUNBZ1VHQmdZQ0F3UUVEUVlHQmdZR0JnWUdCZ1lHQmdRQkJnWUdCZ0VCQVFJRUJ3UUVBWEFBQVFVREFRQUFCdFFMa1FKL0FFRUFDMzhBUVlDQXNBUUxmd0JCakFFTGZ3QkJBQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUVBdC9BRUgvL3dNTGZ3QkJnQkFMZndCQmdJQUJDMzhBUVlDUUFRdC9BRUdBZ0FJTGZ3QkJnSkFEQzM4QVFZQ0FBUXQvQUVHQWtBUUxmd0JCZ09nZkMzOEFRWUNRQkF0L0FFR0FCQXQvQUVHQW9BUUxmd0JCZ0xnQkMzOEFRWURZQlF0L0FFR0EyQVVMZndCQmdKZ09DMzhBUVlDQURBdC9BRUdBbUJvTGZ3QkJnSUFKQzM4QVFZQ1lJd3QvQUVHQTRBQUxmd0JCZ1BnakMzOEFRWUNBQ0F0L0FFR0ErQ3NMZndCQmdJQUlDMzhBUVlENE13dC9BRUdBaVBnREMzOEFRWUNBckFRTGZ3QkIvLzhEQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJ6LzREQzM4QlFRQUxmd0ZCOFA0REMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZjhBQzM4QlFmOEFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJnS2pXdVFjTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVGL0MzOEJRWDhMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmdQY0NDMzhCUVlDQUNBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWRYK0F3dC9BVUhSL2dNTGZ3RkIwdjREQzM4QlFkUCtBd3QvQVVIVS9nTUxmd0ZCNlA0REMzOEJRZXYrQXd0L0FVSHAvZ01MZndGQkFBdC9BVUVCQzM4QlFRSUxmd0JCZ0lDd0JBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUVBdC9BRUgvL3dNTGZ3QkJnSkFFQzM4QVFZQ1FCQXQvQUVHQUJBdC9BRUdBMkFVTGZ3QkJnSmdPQzM4QVFZQ1lHZ3QvQUVHQStDTUxmd0JCZ1BnckMzOEFRWUQ0TXd0L0FVRUFDd2ZNRUdJR2JXVnRiM0o1QWdBRmRHRmliR1VCQUFaamIyNW1hV2NBRXc1b1lYTkRiM0psVTNSaGNuUmxaQUFVQ1hOaGRtVlRkR0YwWlFBYkNXeHZZV1JUZEdGMFpRQW1FbWRsZEZOMFpYQnpVR1Z5VTNSbGNGTmxkQUFuQzJkbGRGTjBaWEJUWlhSekFDZ0laMlYwVTNSbGNITUFLUlZsZUdWamRYUmxUWFZzZEdsd2JHVkdjbUZ0WlhNQXJnRU1aWGhsWTNWMFpVWnlZVzFsQUswQkNGOXpaWFJoY21kakFNOEJHV1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOEF6Z0ViWlhobFkzVjBaVVp5WVcxbFZXNTBhV3hDY21WaGEzQnZhVzUwQUs4QktHVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVc5VmJuUnBiRUp5WldGcmNHOXBiblFBc0FFVlpYaGxZM1YwWlZWdWRHbHNRMjl1WkdsMGFXOXVBTkFCQzJWNFpXTjFkR1ZUZEdWd0FLb0JGR2RsZEVONVkyeGxjMUJsY2tONVkyeGxVMlYwQUxFQkRHZGxkRU41WTJ4bFUyVjBjd0N5QVFsblpYUkRlV05zWlhNQXN3RU9jMlYwU205NWNHRmtVM1JoZEdVQXVBRWZaMlYwVG5WdFltVnlUMlpUWVcxd2JHVnpTVzVCZFdScGIwSjFabVpsY2dDckFSQmpiR1ZoY2tGMVpHbHZRblZtWm1WeUFDSVhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0REFCTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBd0VTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXdJZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd01hUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQkJaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd1VTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdZZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQnh4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3Z1NWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd2tPVmtsRVJVOWZVa0ZOWDFOSldrVURDaEZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01MRFZkUFVrdGZVa0ZOWDFOSldrVUREQ1pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNTklrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVRERoaEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0RER4UkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1RRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F4RVFSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTVNHRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTVRGRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXhRT1JsSkJUVVZmVEU5RFFWUkpUMDRERlFwR1VrRk5SVjlUU1ZwRkF4WVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REZ4TkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeGdTVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhrT1ZFbE1SVjlFUVZSQlgxTkpXa1VER2hKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REd3NVBRVTFmVkVsTVJWTmZVMGxhUlFNY0ZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01kRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXg0V1EwRlNWRkpKUkVkRlgxSkJUVjlNVDBOQlZFbFBUZ01mRWtOQlVsUlNTVVJIUlY5U1FVMWZVMGxhUlFNZ0ZrTkJVbFJTU1VSSFJWOVNUMDFmVEU5RFFWUkpUMDRESVJKRFFWSlVVa2xFUjBWZlVrOU5YMU5KV2tVREloMUVSVUpWUjE5SFFVMUZRazlaWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01qR1VSRlFsVkhYMGRCVFVWQ1QxbGZUVVZOVDFKWlgxTkpXa1VESkNGblpYUlhZWE50UW05NVQyWm1jMlYwUm5KdmJVZGhiV1ZDYjNsUFptWnpaWFFBQUF4blpYUlNaV2RwYzNSbGNrRUF1UUVNWjJWMFVtVm5hWE4wWlhKQ0FMb0JER2RsZEZKbFoybHpkR1Z5UXdDN0FReG5aWFJTWldkcGMzUmxja1FBdkFFTVoyVjBVbVZuYVhOMFpYSkZBTDBCREdkbGRGSmxaMmx6ZEdWeVNBQytBUXhuWlhSU1pXZHBjM1JsY2t3QXZ3RU1aMlYwVW1WbmFYTjBaWEpHQU1BQkVXZGxkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFNRUJEMmRsZEZOMFlXTnJVRzlwYm5SbGNnRENBUmxuWlhSUGNHTnZaR1ZCZEZCeWIyZHlZVzFEYjNWdWRHVnlBTU1CQldkbGRFeFpBTVFCSFdSeVlYZENZV05yWjNKdmRXNWtUV0Z3Vkc5WFlYTnRUV1Z0YjNKNUFNVUJHR1J5WVhkVWFXeGxSR0YwWVZSdlYyRnpiVTFsYlc5eWVRREdBUVpuWlhSRVNWWUF4d0VIWjJWMFZFbE5RUURJQVFablpYUlVUVUVBeVFFR1oyVjBWRUZEQU1vQkUzVndaR0YwWlVSbFluVm5SMEpOWlcxdmNua0F5d0VHZFhCa1lYUmxBSzBCRFdWdGRXeGhkR2x2YmxOMFpYQUFxZ0VTWjJWMFFYVmthVzlSZFdWMVpVbHVaR1Y0QUtzQkQzSmxjMlYwUVhWa2FXOVJkV1YxWlFBaURuZGhjMjFOWlcxdmNubFRhWHBsQTRJQ0hIZGhjMjFDYjNsSmJuUmxjbTVoYkZOMFlYUmxURzlqWVhScGIyNERnd0lZZDJGemJVSnZlVWx1ZEdWeWJtRnNVM1JoZEdWVGFYcGxBNFFDSFdkaGJXVkNiM2xKYm5SbGNtNWhiRTFsYlc5eWVVeHZZMkYwYVc5dUE0VUNHV2RoYldWQ2IzbEpiblJsY201aGJFMWxiVzl5ZVZOcGVtVURoZ0lUZG1sa1pXOVBkWFJ3ZFhSTWIyTmhkR2x2YmdPSEFpSm1jbUZ0WlVsdVVISnZaM0psYzNOV2FXUmxiMDkxZEhCMWRFeHZZMkYwYVc5dUE0b0NHMmRoYldWaWIzbERiMnh2Y2xCaGJHVjBkR1ZNYjJOaGRHbHZiZ09JQWhkbllXMWxZbTk1UTI5c2IzSlFZV3hsZEhSbFUybDZaUU9KQWhWaVlXTnJaM0p2ZFc1a1RXRndURzlqWVhScGIyNERpd0lMZEdsc1pVUmhkR0ZOWVhBRGpBSVRjMjkxYm1SUGRYUndkWFJNYjJOaGRHbHZiZ09OQWhGbllXMWxRbmwwWlhOTWIyTmhkR2x2YmdPUEFoUm5ZVzFsVW1GdFFtRnVhM05NYjJOaGRHbHZiZ09PQWdnQ3pBRUpDQUVBUVFBTEFjMEJDckxUQWRFQnpBRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUXgxSWdGRkRRQUNRQ0FCUVFGckRnMEJBUUVDQWdJQ0F3TUVCQVVHQUFzTUJnc2dBRUdBK0ROcUR3c2dBRUVCSXk4aUFDTXdSU0lCQkg4Z0FFVUZJQUVMRzBFT2RHcEJnUGd5YWc4TElBQkJnSkIrYWlNeEJIOGpNaEFCUVFGeEJVRUFDMEVOZEdvUEN5QUFJek5CRFhScVFZQzRLV29QQ3lBQVFZQ1FmbW9QQzBFQUlRRUNmeU14QkVBak5CQUJRUWR4SVFFTElBRkJBVWdMQkVCQkFTRUJDeUFCUVF4MElBQnFRWUR3ZldvUEN5QUFRWUJRYWdzSkFDQUFFQUF0QUFBTG1RRUFRUUFrTlVFQUpEWkJBQ1EzUVFBa09FRUFKRGxCQUNRNlFRQWtPMEVBSkR4QkFDUTlRUUFrUGtFQUpEOUJBQ1JBUVFBa1FVRUFKRUpCQUNSRFFRQWtSQ014QkVCQkVTUTJRWUFCSkQxQkFDUTNRUUFrT0VIL0FTUTVRZFlBSkRwQkFDUTdRUTBrUEFWQkFTUTJRYkFCSkQxQkFDUTNRUk1rT0VFQUpEbEIyQUVrT2tFQkpEdEJ6UUFrUEF0QmdBSWtQMEgrL3dNa1BndWtBUUVDZjBFQUpFVkJBU1JHUWNjQ0VBRWhBVUVBSkVkQkFDUklRUUFrU1VFQUpFcEJBQ1F3SUFFRVFDQUJRUUZPSWdBRVFDQUJRUU5NSVFBTElBQUVRRUVCSkVnRklBRkJCVTRpQUFSQUlBRkJCa3doQUFzZ0FBUkFRUUVrU1FVZ0FVRVBUaUlBQkVBZ0FVRVRUQ0VBQ3lBQUJFQkJBU1JLQlNBQlFSbE9JZ0FFUUNBQlFSNU1JUUFMSUFBRVFFRUJKREFMQ3dzTEJVRUJKRWNMUVFFa0wwRUFKRE1MQ3dBZ0FCQUFJQUU2QUFBTEx3QkIwZjREUWY4QkVBUkIwdjREUWY4QkVBUkIwLzREUWY4QkVBUkIxUDREUWY4QkVBUkIxZjREUWY4QkVBUUxtQUVBUVFBa1MwRUFKRXhCQUNSTlFRQWtUa0VBSkU5QkFDUlFRUUFrVVNNeEJFQkJrQUVrVFVIQS9nTkJrUUVRQkVIQi9nTkJnUUVRQkVIRS9nTkJrQUVRQkVISC9nTkIvQUVRQkFWQmtBRWtUVUhBL2dOQmtRRVFCRUhCL2dOQmhRRVFCRUhHL2dOQi93RVFCRUhIL2dOQi9BRVFCRUhJL2dOQi93RVFCRUhKL2dOQi93RVFCQXRCei80RFFRQVFCRUh3L2dOQkFSQUVDMDhBSXpFRVFFSG8vZ05Cd0FFUUJFSHAvZ05CL3dFUUJFSHEvZ05Cd1FFUUJFSHIvZ05CRFJBRUJVSG8vZ05CL3dFUUJFSHAvZ05CL3dFUUJFSHEvZ05CL3dFUUJFSHIvZ05CL3dFUUJBc0xMd0JCa1A0RFFZQUJFQVJCa2Y0RFFiOEJFQVJCa3Y0RFFmTUJFQVJCay80RFFjRUJFQVJCbFA0RFFiOEJFQVFMTEFCQmxmNERRZjhCRUFSQmx2NERRVDhRQkVHWC9nTkJBQkFFUVpqK0EwRUFFQVJCbWY0RFFiZ0JFQVFMTWdCQm12NERRZjhBRUFSQm0vNERRZjhCRUFSQm5QNERRWjhCRUFSQm5mNERRUUFRQkVHZS9nTkJ1QUVRQkVFQkpHSUxMUUJCbi80RFFmOEJFQVJCb1A0RFFmOEJFQVJCb2Y0RFFRQVFCRUdpL2dOQkFCQUVRYVArQTBHL0FSQUVDemdBUVE4a1kwRVBKR1JCRHlSbFFROGtaa0VBSkdkQkFDUm9RUUFrYVVFQUpHcEIvd0FrYTBIL0FDUnNRUUVrYlVFQkpHNUJBQ1J2QzJjQVFRQWtVa0VBSkZOQkFDUlVRUUVrVlVFQkpGWkJBU1JYUVFFa1dFRUJKRmxCQVNSYVFRRWtXMEVCSkZ4QkFTUmRRUUFrWGtFQUpGOUJBQ1JnUVFBa1lSQUlFQWtRQ2hBTFFhVCtBMEgzQUJBRVFhWCtBMEh6QVJBRVFhYitBMEh4QVJBRUVBd0xPQUFnQUVFQmNVRUFSeVJ3SUFCQkFuRkJBRWNrY1NBQVFRUnhRUUJISkhJZ0FFRUljVUVBUnlSeklBQkJFSEZCQUVja2RDQUFKSFVMT0FBZ0FFRUJjVUVBUnlSMklBQkJBbkZCQUVja2R5QUFRUVJ4UVFCSEpIZ2dBRUVJY1VFQVJ5UjVJQUJCRUhGQkFFY2tlaUFBSkhzTFZ3QkJBQ1I4UVFBa2ZVRUFKSDVCQUNSL1FRQWtnQUZCQUNTQkFVRUFKSUlCUVFBa2d3RWpNUVJBUVlUK0EwRWVFQVJCb0Qwa2ZRVkJoUDREUWFzQkVBUkJ6TmNDSkgwTFFZZitBMEg0QVJBRVFmZ0JKSUVCQzBJQVFRQWtoQUZCQUNTRkFTTXhCRUJCZ3Y0RFFmd0FFQVJCQUNTR0FVRUFKSWNCUVFBa2lBRUZRWUwrQTBIK0FCQUVRUUFraGdGQkFTU0hBVUVBSklnQkN3djFBUUVDZjBIREFoQUJJZ0ZCd0FGR0lnQUVmeUFBQlNBQlFZQUJSaU1uSWdBZ0FCc0xCRUJCQVNReEJVRUFKREVMRUFJUUF4QUZFQVlRQnhBTlFRQVFEa0gvL3dNamRSQUVRZUVCRUE5QmovNERJM3NRQkJBUUVCRWpNUVJBUWZEK0EwSDRBUkFFUWMvK0EwSCtBUkFFUWMzK0EwSCtBQkFFUVlEK0EwSFBBUkFFUVkvK0EwSGhBUkFFUWV6K0EwSCtBUkFFUWZYK0EwR1BBUkFFQlVIdy9nTkIvd0VRQkVIUC9nTkIvd0VRQkVITi9nTkIvd0VRQkVHQS9nTkJ6d0VRQkVHUC9nTkI0UUVRQkF0QkFDUWxRWUNvMXJrSEpJa0JRUUFraWdGQkFDU0xBVUdBcU5hNUJ5U01BVUVBSkkwQlFRQWtqZ0VMblFFQUlBQkJBRW9FUUVFQkpDWUZRUUFrSmdzZ0FVRUFTZ1JBUVFFa0p3VkJBQ1FuQ3lBQ1FRQktCRUJCQVNRb0JVRUFKQ2dMSUFOQkFFb0VRRUVCSkNrRlFRQWtLUXNnQkVFQVNnUkFRUUVrS2dWQkFDUXFDeUFGUVFCS0JFQkJBU1FyQlVFQUpDc0xJQVpCQUVvRVFFRUJKQ3dGUVFBa0xBc2dCMEVBU2dSQVFRRWtMUVZCQUNRdEN5QUlRUUJLQkVCQkFTUXVCVUVBSkM0TEVCSUxEQUFqSlFSQVFRRVBDMEVBQzdJQkFFR0FDQ00yT2dBQVFZRUlJemM2QUFCQmdnZ2pPRG9BQUVHRENDTTVPZ0FBUVlRSUl6bzZBQUJCaFFnak96b0FBRUdHQ0NNOE9nQUFRWWNJSXowNkFBQkJpQWdqUGpzQkFFR0tDQ00vT3dFQVFZd0lJMEEyQWdBalFRUkFRWkVJUVFFNkFBQUZRWkVJUVFBNkFBQUxJMElFUUVHU0NFRUJPZ0FBQlVHU0NFRUFPZ0FBQ3lOREJFQkJrd2hCQVRvQUFBVkJrd2hCQURvQUFBc2pSQVJBUVpRSVFRRTZBQUFGUVpRSVFRQTZBQUFMQzZ3QkFFSElDU012T3dFQVFjb0pJek03QVFBalJRUkFRY3dKUVFFNkFBQUZRY3dKUVFBNkFBQUxJMFlFUUVITkNVRUJPZ0FBQlVITkNVRUFPZ0FBQ3lOSEJFQkJ6Z2xCQVRvQUFBVkJ6Z2xCQURvQUFBc2pTQVJBUWM4SlFRRTZBQUFGUWM4SlFRQTZBQUFMSTBrRVFFSFFDVUVCT2dBQUJVSFFDVUVBT2dBQUN5TktCRUJCMFFsQkFUb0FBQVZCMFFsQkFEb0FBQXNqTUFSQVFkSUpRUUU2QUFBRlFkSUpRUUE2QUFBTEMwZ0FRZm9KSTN3MkFnQkIvZ2tqZlRZQ0FDT0NBUVJBUVlJS1FRRTZBQUFGUVlJS1FRQTZBQUFMSTRNQkJFQkJoUXBCQVRvQUFBVkJoUXBCQURvQUFBdEJoZjRESTM0UUJBdDRBQ09TQVFSQVFkNEtRUUU2QUFBRlFkNEtRUUE2QUFBTFFkOEtJNU1CTmdJQVFlTUtJNVFCTmdJQVFlY0tJNVVCTmdJQVFld0tJNVlCTmdJQVFmRUtJNWNCT2dBQVFmSUtJNWdCT2dBQUk1a0JCRUJCOXdwQkFUb0FBQVZCOXdwQkFEb0FBQXRCK0Fvam1nRTJBZ0JCL1Fvam13RTdBUUFMVHdBam5BRUVRRUdRQzBFQk9nQUFCVUdRQzBFQU9nQUFDMEdSQ3lPZEFUWUNBRUdWQ3lPZUFUWUNBRUdaQ3lPZkFUWUNBRUdlQ3lPZ0FUWUNBRUdqQ3lPaEFUb0FBRUdrQ3lPaUFUb0FBQXRHQUNPbkFRUkFRZlFMUVFFNkFBQUZRZlFMUVFBNkFBQUxRZlVMSTZnQk5nSUFRZmtMSTZrQk5nSUFRZjBMSTZvQk5nSUFRWUlNSTZzQk5nSUFRWWNNSTZ3Qk93RUFDNk1CQUJBVlFiSUlJMHcyQWdCQnRnZ2pqd0U2QUFCQnhQNERJMDBRQkNPUUFRUkFRZVFJUVFFNkFBQUZRZVFJUVFBNkFBQUxJNUVCQkVCQjVRaEJBVG9BQUFWQjVRaEJBRG9BQUFzUUZoQVhRYXdLSTE0MkFnQkJzQW9qWHpvQUFFR3hDaU5nT2dBQUVCZ1FHU09qQVFSQVFjSUxRUUU2QUFBRlFjSUxRUUE2QUFBTFFjTUxJNlFCTmdJQVFjY0xJNlVCTmdJQVFjc0xJNllCT3dFQUVCcEJBQ1FsQzY0QkFFR0FDQzBBQUNRMlFZRUlMUUFBSkRkQmdnZ3RBQUFrT0VHRENDMEFBQ1E1UVlRSUxRQUFKRHBCaFFndEFBQWtPMEdHQ0MwQUFDUThRWWNJTFFBQUpEMUJpQWd2QVFBa1BrR0tDQzhCQUNRL1FZd0lLQUlBSkVBQ2YwRUJRWkVJTFFBQVFRQktEUUFhUVFBTEpFRUNmMEVCUVpJSUxRQUFRUUJLRFFBYVFRQUxKRUlDZjBFQlFaTUlMUUFBUVFCS0RRQWFRUUFMSkVNQ2YwRUJRWlFJTFFBQVFRQktEUUFhUVFBTEpFUUxYQUVCZjBFQUpFeEJBQ1JOUWNUK0EwRUFFQVJCd2Y0REVBRkJmSEVoQVVFQUpJOEJRY0grQXlBQkVBUWdBQVJBQWtCQkFDRUFBMEFnQUVHQTZCOU9EUUVnQUVHQWtBUnFRZjhCT2dBQUlBQkJBV29oQUF3QUFBc0FDd3NMaUFFQkFYOGpyUUVoQVNBQVFZQUJjVUVBUnlTdEFTQUFRY0FBY1VFQVJ5U3VBU0FBUVNCeFFRQkhKSzhCSUFCQkVIRkJBRWNrc0FFZ0FFRUljVUVBUnlTeEFTQUFRUVJ4UVFCSEpMSUJJQUJCQW5GQkFFY2tzd0VnQUVFQmNVRUFSeVMwQVNPdEFVVWdBU0FCR3dSQVFRRVFIUXNnQVVVaUFBUi9JNjBCQlNBQUN3UkFRUUFRSFFzTFBnQUNmMEVCUWVRSUxRQUFRUUJLRFFBYVFRQUxKSkFCQW45QkFVSGxDQzBBQUVFQVNnMEFHa0VBQ3lTUkFVSC8vd01RQVJBT1FZLytBeEFCRUE4THBRRUFRY2dKTHdFQUpDOUJ5Z2t2QVFBa013Si9RUUZCekFrdEFBQkJBRW9OQUJwQkFBc2tSUUovUVFGQnpRa3RBQUJCQUVvTkFCcEJBQXNrUmdKL1FRRkJ6Z2t0QUFCQkFFb05BQnBCQUFza1J3Si9RUUZCendrdEFBQkJBRW9OQUJwQkFBc2tTQUovUVFGQjBBa3RBQUJCQUVvTkFCcEJBQXNrU1FKL1FRRkIwUWt0QUFCQkFFb05BQnBCQUFza1NnSi9RUUZCMGdrdEFBQkJBRW9OQUJwQkFBc2tNQXRYQUVINkNTZ0NBQ1I4UWY0SktBSUFKSDBDZjBFQlFZSUtMUUFBUVFCS0RRQWFRUUFMSklJQkFuOUJBVUdGQ2kwQUFFRUFTZzBBR2tFQUN5U0RBVUdGL2dNUUFTUitRWWIrQXhBQkpIOUJoLzRERUFFa2dRRUxCZ0JCQUNSaEMzWUFBbjlCQVVIZUNpMEFBRUVBU2cwQUdrRUFDeVNTQVVIZkNpZ0NBQ1NUQVVIakNpZ0NBQ1NVQVVIbkNpZ0NBQ1NWQVVIc0NpZ0NBQ1NXQVVIeENpMEFBQ1NYQVVIeUNpMEFBQ1NZQVFKL1FRRkI5d290QUFCQkFFb05BQnBCQUFza21RRkIrQW9vQWdBa21nRkIvUW92QVFBa213RUxUZ0FDZjBFQlFaQUxMUUFBUVFCS0RRQWFRUUFMSkp3QlFaRUxLQUlBSkowQlFaVUxLQUlBSko0QlFaa0xLQUlBSko4QlFaNExLQUlBSktBQlFhTUxMUUFBSktFQlFhUUxMUUFBSktJQkMwVUFBbjlCQVVIMEN5MEFBRUVBU2cwQUdrRUFDeVNuQVVIMUN5Z0NBQ1NvQVVINUN5Z0NBQ1NwQVVIOUN5Z0NBQ1NxQVVHQ0RDZ0NBQ1NyQVVHSERDOEJBQ1NzQVF2UUFRRUJmeEFjUWJJSUtBSUFKRXhCdGdndEFBQWtqd0ZCeFA0REVBRWtUVUhBL2dNUUFSQWVFQjlCZ1A0REVBRkIvd0Z6SkxVQkk3VUJJZ0JCRUhGQkFFY2t0Z0VnQUVFZ2NVRUFSeVMzQVJBZ0VDRkJyQW9vQWdBa1hrR3dDaTBBQUNSZlFiRUtMUUFBSkdCQkFDUmhFQ01RSkFKL1FRRkJ3Z3N0QUFCQkFFb05BQnBCQUFza293RkJ3d3NvQWdBa3BBRkJ4d3NvQWdBa3BRRkJ5d3N2QVFBa3BnRVFKVUVBSkNWQmdLald1UWNraVFGQkFDU0tBVUVBSklzQlFZQ28xcmtISkl3QlFRQWtqUUZCQUNTT0FRc0ZBQ09NQVFzRkFDT05BUXNGQUNPT0FRdllBZ0VGZndKL0FuOGdBVUVBU2lJRkJFQWdBRUVJU2lFRkN5QUZDd1JBSTdrQklBUkdJUVVMSUFVTEJIOGp1Z0VnQUVZRklBVUxCRUJCQUNFRlFRQWhCQ0FEUVFGckVBRkJJSEVFUUVFQklRVUxJQU1RQVVFZ2NRUkFRUUVoQkF0QkFDRURBMEFnQTBFSVNBUkFRUWNnQTJzZ0F5QUVJQVZIR3lJRElBQnFRYUFCVEFSQUlBQkJDQ0FEYTJzaEJ5QUFJQU5xSUFGQm9BRnNha0VEYkVHQTJBVnFJUWxCQUNFR0EwQWdCa0VEU0FSQUlBQWdBMm9nQVVHZ0FXeHFRUU5zUVlEWUJXb2dCbW9nQmlBSmFpMEFBRG9BQUNBR1FRRnFJUVlNQVFzTElBQWdBMm9nQVVHZ0FXeHFRWUNnQkdvZ0FVR2dBV3dnQjJwQmdLQUVhaTBBQUNJR1FRTnhJZ2RCQkhJZ0J5QUdRUVJ4R3pvQUFDQUlRUUZxSVFnTElBTkJBV29oQXd3QkN3c0ZJQVFrdVFFTElBQWp1Z0ZPQkVBZ0FFRUlhaVM2QVNBQUlBSkJDRzhpQkVnRVFDTzZBU0FFYWlTNkFRc0xJQWdMT0FFQmZ5QUFRWUNRQWtZRVFDQUJRWUFCYWlFQ0lBRkJnQUZ4QkVBZ0FVR0FBV3NoQWdzZ0FrRUVkQ0FBYWc4TElBRkJCSFFnQUdvTFNnQWdBRUVEZENBQlFRRjBhaUlBUVFGcVFUOXhJZ0ZCUUdzZ0FTQUNHMEdBa0FScUxRQUFJUUVnQUVFL2NTSUFRVUJySUFBZ0FodEJnSkFFYWkwQUFDQUJRZjhCY1VFSWRISUxVUUFnQWtVRVFDQUJFQUVnQUVFQmRIVkJBM0VoQUF0QjhnRWhBUUpBSUFCRkRRQUNRQUpBQWtBQ1FDQUFRUUZyRGdNQkFnTUFDd3dEQzBHZ0FTRUJEQUlMUWRnQUlRRU1BUXRCQ0NFQkN5QUJDK0VDQVFkL0lBRWdBQkFySUFWQkFYUnFJZ0JCZ0pCK2FpQUNRUUZ4UVExMElnRnFMUUFBSVJFZ0FFR0JrSDVxSUFGcUxRQUFJUklnQXlFQUEwQWdBQ0FFVEFSQUlBQWdBMnNnQm1vaURTQUlTQVJBUVFjZ0FHc2hCU0FMUVFCSUlnSUVmeUFDQlNBTFFTQnhSUXNoQVVFQUlRSUNmMEVCSUFVZ0FDQUJHeUlCZENBU2NRUkFRUUloQWdzZ0FrRUJhZ3NnQWtFQklBRjBJQkZ4R3lFQ0lBdEJBRTRFZnlBTFFRZHhJQUpCQUJBc0lnVkJIM0ZCQTNRaERpQUZRZUFIY1VFRmRVRURkQ0VCSUFWQmdQZ0JjVUVLZFVFRGRBVWdBa0hIL2dNZ0R5QVBRUUJNR3lJUElBb1FMU0lGSVE0Z0JTSUJDeUVGSUFjZ0NHd2dEV3BCQTJ3Z0NXb2lFQ0FPT2dBQUlCQkJBV29nQVRvQUFDQVFRUUpxSUFVNkFBQWdCMEdnQVd3Z0RXcEJnS0FFYWlBQ1FRTnhJZ0ZCQkhJZ0FTQUxRWUFCY1VFQVIwRUFJQXRCQUU0Ykd6b0FBQ0FNUVFGcUlRd0xJQUJCQVdvaEFBd0JDd3NnREF0K0FRTi9JQU5CQ0c4aEF5QUFSUVJBSUFJZ0FrRUliVUVEZEdzaEJ3dEJvQUVnQUd0QkJ5QUFRUWhxUWFBQlNoc2hDVUYvSVFJak1RUkFJQVJCZ05CK2FpMEFBQ0lDUVFoeEJFQkJBU0VJQ3lBQ1FjQUFjUVJBUVFjZ0Eyc2hBd3NMSUFZZ0JTQUlJQWNnQ1NBRElBQWdBVUdnQVVHQTJBVkJBQ0FDRUM0THBnSUFJQVVnQmhBcklRWWdBMEVJYnlFRElBUkJnTkIrYWkwQUFDSUVRY0FBY1FSL1FRY2dBMnNGSUFNTFFRRjBJQVpxSWdOQmdKQitha0VCUVFBZ0JFRUljUnRCQVhGQkRYUWlCV290QUFBaEJpQURRWUdRZm1vZ0JXb3RBQUFoQlNBQ1FRaHZJUU5CQUNFQ0lBRkJvQUZzSUFCcVFRTnNRWURZQldvZ0JFRUhjUUovUVFFZ0EwRUhJQU5ySUFSQklIRWJJZ04wSUFWeEJFQkJBaUVDQ3lBQ1FRRnFDeUFDUVFFZ0EzUWdCbkViSWdKQkFCQXNJZ05CSDNGQkEzUTZBQUFnQVVHZ0FXd2dBR3BCQTJ4QmdkZ0ZhaUFEUWVBSGNVRUZkVUVEZERvQUFDQUJRYUFCYkNBQWFrRURiRUdDMkFWcUlBTkJnUGdCY1VFS2RVRURkRG9BQUNBQlFhQUJiQ0FBYWtHQW9BUnFJQUpCQTNFaUFFRUVjaUFBSUFSQmdBRnhHem9BQUF1MUFRQWdCQ0FGRUNzZ0EwRUliMEVCZEdvaUJFR0FrSDVxTFFBQUlRVkJBQ0VESUFGQm9BRnNJQUJxUVFOc1FZRFlCV29DZnlBRVFZR1FmbW90QUFCQkFVRUhJQUpCQ0c5cklnSjBjUVJBUVFJaEF3c2dBMEVCYWdzZ0EwRUJJQUowSUFWeEd5SURRY2YrQTBFQUVDMGlBam9BQUNBQlFhQUJiQ0FBYWtFRGJFR0IyQVZxSUFJNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3RnRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVlDZ0JHb2dBMEVEY1RvQUFBdlZBUUVHZnlBRFFRTjFJUXNEUUNBRVFhQUJTQVJBSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUxRUVYwSUFKcUlBWkJBM1ZxSWdsQmdKQithaTBBQUNFSVFRQWhDaU11QkVBZ0JDQUFJQVlnQ1NBSUVDb2lCMEVBU2dSQVFRRWhDaUFIUVFGcklBUnFJUVFMQ3lBS1JTTXRJZ2NnQnhzRVFDQUVJQUFnQmlBRElBa2dBU0FJRUM4aUIwRUFTZ1JBSUFkQkFXc2dCR29oQkFzRklBcEZCRUFqTVFSQUlBUWdBQ0FHSUFNZ0NTQUJJQWdRTUFVZ0JDQUFJQVlnQXlBQklBZ1FNUXNMQ3lBRVFRRnFJUVFNQVFzTEN5c0JBWDhqVGlFRElBQWdBU0FDSTA4Z0FHb2lBRUdBQWs0RWZ5QUFRWUFDYXdVZ0FBdEJBQ0FERURJTE1BRURmeU5RSVFNZ0FDTlJJZ1JJQkVBUEN5QURRUWRySWdOQmYyd2hCU0FBSUFFZ0FpQUFJQVJySUFNZ0JSQXlDOFFGQVE5L0FrQkJKeUVKQTBBZ0NVRUFTQTBCSUFsQkFuUWlCRUdBL0FOcUVBRWhBaUFFUVlIOEEyb1FBU0VLSUFSQmd2d0RhaEFCSVFNZ0FrRVFheUVDSUFwQkNHc2hDa0VJSVFVZ0FRUkFRUkFoQlNBRFFRSnZRUUZHQkg4Z0EwRUJhd1VnQXdzaEF3c2dBQ0FDVGlJR0JFQWdBQ0FDSUFWcVNDRUdDeUFHQkVBZ0JFR0QvQU5xRUFFaUJrR0FBWEZCQUVjaEN5QUdRU0J4UVFCSElRNUJnSUFDSUFNUUt5QUFJQUpySWdJZ0JXdEJmMnhCQVdzZ0FpQUdRY0FBY1J0QkFYUnFJZ05CZ0pCK2FrRUJRUUFnQmtFSWNVRUFSeU14SWdJZ0Foc2JRUUZ4UVExMElnSnFMUUFBSVE4Z0EwR0JrSDVxSUFKcUxRQUFJUkJCQnlFRkEwQWdCVUVBVGdSQVFRQWhDQUovUVFFZ0JTSUNRUWRyUVg5c0lBSWdEaHNpQW5RZ0VIRUVRRUVDSVFnTElBaEJBV29MSUFoQkFTQUNkQ0FQY1JzaUNBUkFRUWNnQldzZ0Ntb2lCMEVBVGlJQ0JFQWdCMEdnQVV3aEFnc2dBZ1JBUVFBaERFRUFJUTFCQVVFQUk3UUJSU014SWdNZ0F4c2JJZ0pGQkVBZ0FFR2dBV3dnQjJwQmdLQUVhaTBBQUNJRFFRTnhJZ1JCQUVvZ0N5QUxHd1JBUVFFaERBVWdBMEVFY1VFQVJ5TXhJZ01nQXhzaUF3UkFJQVJCQUVvaEF3dEJBVUVBSUFNYklRMExDeUFDUlFSQUlBeEZJZ1FFZnlBTlJRVWdCQXNoQWdzZ0FnUkFJekVFUUNBQVFhQUJiQ0FIYWtFRGJFR0EyQVZxSUFaQkIzRWdDRUVCRUN3aUJFRWZjVUVEZERvQUFDQUFRYUFCYkNBSGFrRURiRUdCMkFWcUlBUkI0QWR4UVFWMVFRTjBPZ0FBSUFCQm9BRnNJQWRxUVFOc1FZTFlCV29nQkVHQStBRnhRUXAxUVFOME9nQUFCU0FBUWFBQmJDQUhha0VEYkVHQTJBVnFJQWhCeWY0RFFjaitBeUFHUVJCeEcwRUFFQzBpQXpvQUFDQUFRYUFCYkNBSGFrRURiRUdCMkFWcUlBTTZBQUFnQUVHZ0FXd2dCMnBCQTJ4Qmd0Z0ZhaUFET2dBQUN3c0xDeUFGUVFGcklRVU1BUXNMQ3lBSlFRRnJJUWtNQUFBTEFBc0xaZ0VDZjBHQWtBSWhBVUdBZ0FKQmdKQUNJN0FCR3lFQkl6RWp0QUVqTVJzRVFFR0FzQUloQWlBQUlBRkJnTGdDUVlDd0FpT3hBUnNRTXdzanJ3RUVRRUdBc0FJaEFpQUFJQUZCZ0xnQ1FZQ3dBaU91QVJzUU5Bc2pzd0VFUUNBQUk3SUJFRFVMQ3lVQkFYOENRQU5BSUFCQmtBRkxEUUVnQUVIL0FYRVFOaUFBUVFGcUlRQU1BQUFMQUFzTFJnRUNmd05BSUFGQmtBRk9SUVJBUVFBaEFBTkFJQUJCb0FGSUJFQWdBVUdnQVd3Z0FHcEJnS0FFYWtFQU9nQUFJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUVMQ3dzY0FRRi9RWS8rQXhBQlFRRWdBSFJ5SWdFa2UwR1AvZ01nQVJBRUN3b0FRUUVrZDBFQkVEa0xSUUVDZjBHVS9nTVFBVUg0QVhFaEFVR1QvZ01nQUVIL0FYRWlBaEFFUVpUK0F5QUJJQUJCQ0hVaUFISVFCQ0FDSk1ZQklBQWt4d0VqeGdFanh3RkJDSFJ5Sk1nQkMyWUJBbjhqbXdFaUFTUEVBWFVoQUNBQklBQnJJQUFnQVdvanhRRWJJZ0JCL3c5TUlnRUVmeVBFQVVFQVNnVWdBUXNFUUNBQUpKc0JJQUFRT3lPYkFTSUJJOFFCZFNFQUlBRWdBR3NnQUNBQmFpUEZBUnNoQUFzZ0FFSC9EMG9FUUVFQUpKSUJDd3NzQUNPYUFVRUJheVNhQVNPYUFVRUFUQVJBSThNQkpKb0JJOE1CUVFCS0k1a0JJNWtCR3dSQUVEd0xDd3RiQVFGL0k1UUJRUUZySkpRQkk1UUJRUUJNQkVBanlRRWtsQUVqbEFFRVFDT1dBVUVQU0NQS0FTUEtBUnNFUUNPV0FVRUJhaVNXQVFVanlnRkZJZ0FFUUNPV0FVRUFTaUVBQ3lBQUJFQWpsZ0ZCQVdza2xnRUxDd3NMQzFzQkFYOGpuZ0ZCQVdza25nRWpuZ0ZCQUV3RVFDUExBU1NlQVNPZUFRUkFJNkFCUVE5SUk4d0JJOHdCR3dSQUk2QUJRUUZxSktBQkJTUE1BVVVpQUFSQUk2QUJRUUJLSVFBTElBQUVRQ09nQVVFQmF5U2dBUXNMQ3dzTFd3RUJmeU9wQVVFQmF5U3BBU09wQVVFQVRBUkFJODBCSktrQkk2a0JCRUFqcXdGQkQwZ2p6Z0VqemdFYkJFQWpxd0ZCQVdva3F3RUZJODRCUlNJQUJFQWpxd0ZCQUVvaEFBc2dBQVJBSTZzQlFRRnJKS3NCQ3dzTEN3dU9CZ0FqWGlBQWFpUmVJMTRqTlFSL1FZQ0FBUVZCZ01BQUMwNEVRQ05lSXpVRWYwR0FnQUVGUVlEQUFBdHJKRjRDUUFKQUFrQUNRQUpBSTJBaUFBUkFJQUJCQW1zT0JnRUZBZ1VEQkFVTEk1VUJRUUJLSWdBRWZ5Ty9BUVVnQUFzRVFDT1ZBVUVCYXlTVkFRc2psUUZGQkVCQkFDU1NBUXNqbndGQkFFb2lBQVIvSThBQkJTQUFDd1JBSTU4QlFRRnJKSjhCQ3lPZkFVVUVRRUVBSkp3QkN5T2xBVUVBU2lJQUJIOGp3UUVGSUFBTEJFQWpwUUZCQVdza3BRRUxJNlVCUlFSQVFRQWtvd0VMSTZvQlFRQktJZ0FFZnlQQ0FRVWdBQXNFUUNPcUFVRUJheVNxQVFzanFnRkZCRUJCQUNTbkFRc01CQXNqbFFGQkFFb2lBQVIvSTc4QkJTQUFDd1JBSTVVQlFRRnJKSlVCQ3lPVkFVVUVRRUVBSkpJQkN5T2ZBVUVBU2lJQUJIOGp3QUVGSUFBTEJFQWpud0ZCQVdza253RUxJNThCUlFSQVFRQWtuQUVMSTZVQlFRQktJZ0FFZnlQQkFRVWdBQXNFUUNPbEFVRUJheVNsQVFzanBRRkZCRUJCQUNTakFRc2pxZ0ZCQUVvaUFBUi9JOElCQlNBQUN3UkFJNm9CUVFGckpLb0JDeU9xQVVVRVFFRUFKS2NCQ3hBOURBTUxJNVVCUVFCS0lnQUVmeU8vQVFVZ0FBc0VRQ09WQVVFQmF5U1ZBUXNqbFFGRkJFQkJBQ1NTQVFzam53RkJBRW9pQUFSL0k4QUJCU0FBQ3dSQUk1OEJRUUZySko4QkN5T2ZBVVVFUUVFQUpKd0JDeU9sQVVFQVNpSUFCSDhqd1FFRklBQUxCRUFqcFFGQkFXc2twUUVMSTZVQlJRUkFRUUFrb3dFTEk2b0JRUUJLSWdBRWZ5UENBUVVnQUFzRVFDT3FBVUVCYXlTcUFRc2pxZ0ZGQkVCQkFDU25BUXNNQWdzamxRRkJBRW9pQUFSL0k3OEJCU0FBQ3dSQUk1VUJRUUZySkpVQkN5T1ZBVVVFUUVFQUpKSUJDeU9mQVVFQVNpSUFCSDhqd0FFRklBQUxCRUFqbndGQkFXc2tud0VMSTU4QlJRUkFRUUFrbkFFTEk2VUJRUUJLSWdBRWZ5UEJBUVVnQUFzRVFDT2xBVUVCYXlTbEFRc2pwUUZGQkVCQkFDU2pBUXNqcWdGQkFFb2lBQVIvSThJQkJTQUFDd1JBSTZvQlFRRnJKS29CQ3lPcUFVVUVRRUVBSktjQkN4QTlEQUVMRUQ0UVB4QkFDeU5nUVFGcUpHQWpZRUVJVGdSQVFRQWtZQXRCQVE4TFFRQUxnd0VCQVg4Q1FBSkFBa0FDUUNBQVFRRkhCRUFnQUNJQlFRSkdEUUVnQVVFRFJnMENJQUZCQkVZTkF3d0VDeU5uSTlBQlJ3UkFJOUFCSkdkQkFROExRUUFQQ3lOb0k5RUJSd1JBSTlFQkpHaEJBUThMUVFBUEN5TnBJOUlCUndSQUk5SUJKR2xCQVE4TFFRQVBDeU5xSTlNQlJ3UkFJOU1CSkdwQkFROExRUUFQQzBFQUMxVUFBa0FDUUFKQUlBQkJBVWNFUUNBQVFRSkdEUUVnQUVFRFJnMENEQU1MUVFFZ0FYUkJnUUZ4UVFCSER3dEJBU0FCZEVHSEFYRkJBRWNQQzBFQklBRjBRZjRBY1VFQVJ3OExRUUVnQVhSQkFYRkJBRWNMaWdFQkFYOGprd0VnQUdza2t3RWprd0ZCQUV3RVFDT1RBU0lCUVI5MUlRQkJnQkFqeUFGclFRSjBKSk1CSXpVRVFDT1RBVUVCZENTVEFRc2prd0VnQUNBQmFpQUFjMnNra3dFam1BRkJBV29rbUFFam1BRkJDRTRFUUVFQUpKZ0JDd3NqMEFFamtnRWlBQ0FBR3dSL0k1WUJCVUVQRHdzajF3RWptQUVRUXdSL1FRRUZRWDhMYkVFUGFndUtBUUVCZnlPZEFTQUFheVNkQVNPZEFVRUFUQVJBSTUwQklnRkJIM1VoQUVHQUVDUFlBV3RCQW5Ra25RRWpOUVJBSTUwQlFRRjBKSjBCQ3lPZEFTQUFJQUZxSUFCemF5U2RBU09pQVVFQmFpU2lBU09pQVVFSVRnUkFRUUFrb2dFTEN5UFJBU09jQVNJQUlBQWJCSDhqb0FFRlFROFBDeVBaQVNPaUFSQkRCSDlCQVFWQmZ3dHNRUTlxQzVrQ0FRSi9JNlFCSUFCckpLUUJJNlFCUVFCTUJFQWpwQUVpQWtFZmRTRUFRWUFRSTlvQmEwRUJkQ1NrQVNNMUJFQWpwQUZCQVhRa3BBRUxJNlFCSUFBZ0Ftb2dBSE5ySktRQkk2WUJRUUZxSktZQkk2WUJRU0JPQkVCQkFDU21BUXNMUVFBaEFpUGJBU0VBSTlJQkk2TUJJZ0VnQVJzRVFDTmlCRUJCblA0REVBRkJCWFZCRDNFaUFDVGJBVUVBSkdJTEJVRVBEd3NqcGdGQkFtMUJzUDREYWhBQklRRWpwZ0ZCQW04RWZ5QUJRUTl4QlNBQlFRUjFRUTl4Q3lFQkFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFTQUFRUUpHRFFJTUF3c2dBVUVFZFNFQkRBTUxRUUVoQWd3Q0N5QUJRUUYxSVFGQkFpRUNEQUVMSUFGQkFuVWhBVUVFSVFJTElBSkJBRW9FZnlBQklBSnRCVUVBQzBFUGFndXJBUUVCZnlPb0FTQUFheVNvQVNPb0FVRUFUQVJBSTZnQklRQWozQUVqM1FGMElnRkJBWFFnQVNNMUd5U29BU09vQVNBQVFSOTFJZ0VnQUNBQmFuTnJKS2dCSTZ3QklnQkJBWEVoQVNBQVFRRjFJZ0FrckFFanJBRWdBU0FBUVFGeGN5SUJRUTUwY2lTc0FTUGVBUVJBSTZ3QlFiOS9jU1NzQVNPc0FTQUJRUVowY2lTc0FRc0xJOU1CSTZjQklnQWdBQnNFZnlPckFRVkJEdzhMUVg5QkFTT3NBVUVCY1J0c1FROXFDekFBSUFCQlBFWUVRRUgvQUE4TElBQkJQR3RCb0kwR2JDQUJiRUVJYlVHZ2pRWnRRVHhxUWFDTkJteEJqUEVDYlF1Y0FRRUJmMEVBSkcwZ0FFRVBJMVViSWdRZ0FXb2dCRUVQYWlOV0d5SUVJQUpxSUFSQkQyb2pWeHNoQkNBRElBSWdBU0FBUVE4aldSc2lBR29nQUVFUGFpTmFHeUlBYWlBQVFROXFJMXNiSWdCcUlBQkJEMm9qWEJzaEFFRUFKRzVCQUNSdklBTWdCR29nQkVFUGFpTllHeU5UUVFGcUVFZ2hBU0FBSTFSQkFXb1FTQ0VBSUFFa2F5QUFKR3dnQUVIL0FYRWdBVUgvQVhGQkNIUnlDOElEQVFWL0FuOGp6d0VnQUdva3p3RkJBQ09UQVNQUEFXdEJBRW9OQUJwQkFRc2lBVVVFUUVFQkVFSWhBUXNDZnlQVUFTQUFhaVRVQVVFQUk1MEJJOVFCYTBFQVNnMEFHa0VCQ3lJRVJRUkFRUUlRUWlFRUN3Si9JOVVCSUFCcUpOVUJJNlFCSTlVQmEwRUFTaUlDQkVBallrVWhBZ3RCQUNBQ0RRQWFRUUVMSWdKRkJFQkJBeEJDSVFJTEFuOGoxZ0VnQUdvazFnRkJBQ09vQVNQV0FXdEJBRW9OQUJwQkFRc2lCVVVFUUVFRUVFSWhCUXNnQVFSQUk4OEJJUU5CQUNUUEFTQURFRVFrWXdzZ0JBUkFJOVFCSVFOQkFDVFVBU0FERUVVa1pBc2dBZ1JBSTlVQklRTkJBQ1RWQVNBREVFWWtaUXNnQlFSQUk5WUJJUU5CQUNUV0FTQURFRWNrWmdzQ2Z5QUJJQVFnQVJzaUFVVUVRQ0FDSVFFTElBRkZDd1JBSUFVaEFRc2dBUVJBUVFFa2J3c2pYeVBmQVNBQWJHb2tYeU5mUVlDQWdBUkJnSUNBQWlNMUcwNEVRQ05mUVlDQWdBUkJnSUNBQWlNMUcyc2tYeU52SWdBamJTQUFHeUlCUlFSQUkyNGhBUXNnQVFSQUkyTWpaQ05sSTJZUVNSb0xJMkVpQVVFQmRFR0ErQ05xSWdBamEwRUNham9BQUNBQVFRRnFJMnhCQW1vNkFBQWdBVUVCYWlSaEkyRWo0QUZCQW0xQkFXdE9CRUFqWVVFQmF5UmhDd3NMdEFFQkJIOGdBQkJFSVFFZ0FCQkZJUUlnQUJCR0lRTWdBQkJISVFRZ0FTUmpJQUlrWkNBREpHVWdCQ1JtSTE4ajN3RWdBR3hxSkY4algwR0FnSUFFUVlDQWdBSWpOUnRPQkVBalgwR0FnSUFFUVlDQWdBSWpOUnRySkY4Z0FTQUNJQU1nQkJCSklRQWpZU0lCUVFGMFFZRDRJMm9pQWlBQVFZRCtBM0ZCQ0hWQkFtbzZBQUFnQWtFQmFpQUFRZjhCY1VFQ2Fqb0FBQ0FCUVFGcUpHRWpZU1BnQVVFQ2JVRUJhMDRFUUNOaFFRRnJKR0VMQ3dzZUFRRi9JQUFRUVNFQklBRkZJeXdqTEJzRVFDQUFFRW9GSUFBUVN3c0xTd0FqVWlNMUJIOUJyZ0VGUWRjQUMwZ0VRQThMQTBBalVpTTFCSDlCcmdFRlFkY0FDMDRFUUNNMUJIOUJyZ0VGUWRjQUN4Qk1JMUlqTlFSL1FhNEJCVUhYQUF0ckpGSU1BUXNMQ3lFQUlBQkJwdjREUmdSQVFhYitBeEFCUVlBQmNTRUFJQUJCOEFCeUR3dEJmd3VjQVFFQmZ5TzFBU0VBSTdZQkJFQWdBRUY3Y1NBQVFRUnlJK0VCR3lFQUlBQkJmbkVnQUVFQmNpUGlBUnNoQUNBQVFYZHhJQUJCQ0hJajR3RWJJUUFnQUVGOWNTQUFRUUp5SStRQkd5RUFCU08zQVFSQUlBQkJmbkVnQUVFQmNpUGxBUnNoQUNBQVFYMXhJQUJCQW5JajVnRWJJUUFnQUVGN2NTQUFRUVJ5SStjQkd5RUFJQUJCZDNFZ0FFRUljaVBvQVJzaEFBc0xJQUJCOEFGeUM4c0NBUUYvSUFCQmdJQUNTQVJBUVg4UEN5QUFRWUNBQWs0aUFRUi9JQUJCZ01BQ1NBVWdBUXNFUUVGL0R3c2dBRUdBd0FOT0lnRUVmeUFBUVlEOEEwZ0ZJQUVMQkVBZ0FFR0FRR29RQVE4TElBQkJnUHdEVGlJQkJIOGdBRUdmL1FOTUJTQUJDd1JBSTQ4QlFRSklCRUJCL3dFUEMwRi9Ed3NnQUVITi9nTkdCRUJCL3dFaEFVSE4vZ01RQVVFQmNVVUVRRUgrQVNFQkN5TTFSUVJBSUFGQi8zNXhJUUVMSUFFUEN5QUFRY1QrQTBZRVFDQUFJMDBRQkNOTkR3c2dBRUdRL2dOT0lnRUVmeUFBUWFiK0Ewd0ZJQUVMQkVBUVRTQUFFRTRQQ3lBQVFiRCtBMDRpQVFSL0lBQkJ2LzREVEFVZ0FRc0VRQkJOUVg4UEN5QUFRWVQrQTBZRVFDQUFJMzFCZ1A0RGNVRUlkU0lCRUFRZ0FROExJQUJCaGY0RFJnUkFJQUFqZmhBRUkzNFBDeUFBUVkvK0EwWUVRQ043UWVBQmNnOExJQUJCZ1A0RFJnUkFFRThQQzBGL0N4c0JBWDhnQUJCUUlnRkJmMFlFUUNBQUVBRVBDeUFCUWY4QmNRdTJBZ0VCZnlOSEJFQVBDeUFBUWY4L1RBUkFJMGtFZnlBQlFSQnhSUVVqU1F0RkJFQWdBVUVQY1NJQ0JFQWdBa0VLUmdSQVFRRWtSUXNGUVFBa1JRc0xCU0FBUWYvL0FFd0VRQ013UlNJQ0JIOGdBZ1VnQUVILzN3Qk1Dd1JBSTBrRVFDQUJRUTl4SkM4TElBRWhBaU5JQkVBZ0FrRWZjU0VDSXk5QjRBRnhKQzhGSTBvRVFDQUNRZjhBY1NFQ0l5OUJnQUZ4SkM4Rkl6QUVRRUVBSkM4TEN3c2pMeUFDY2lRdkJTTXZRZjhCY1VFQlFRQWdBVUVBU2h0Qi93RnhRUWgwY2lRdkN3VWpTVVVpQWdSL0lBQkIvNzhCVEFVZ0Fnc0VRQ05HSTBnaUFDQUFHd1JBSXk5QkgzRWtMeU12SUFGQjRBRnhjaVF2RHdzZ0FVRVBjU0FCUVFOeEl6QWJKRE1GSTBsRklnSUVmeUFBUWYvL0FVd0ZJQUlMQkVBalNBUkFJQUZCQVhFRVFFRUJKRVlGUVFBa1Jnc0xDd3NMQ3dzc0FDQUFRUVIxUVE5eEpPMEJJQUJCQ0hGQkFFY2t5Z0VnQUVFSGNTVEpBU0FBUWZnQmNVRUFTaVRRQVFzc0FDQUFRUVIxUVE5eEpPNEJJQUJCQ0hGQkFFY2t6QUVnQUVFSGNTVExBU0FBUWZnQmNVRUFTaVRSQVFzc0FDQUFRUVIxUVE5eEpQQUJJQUJCQ0hGQkFFY2t6Z0VnQUVFSGNTVE5BU0FBUWZnQmNVRUFTaVRUQVF1QkFRRUJmeUFBUVFSMUpOMEJJQUJCQ0hGQkFFY2szZ0VnQUVFSGNTVDFBUUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWo5UUVpQVFSQUlBRkJBV3NPQndFQ0F3UUZCZ2NJQzBFSUpOd0JEd3RCRUNUY0FROExRU0FrM0FFUEMwRXdKTndCRHd0QndBQWszQUVQQzBIUUFDVGNBUThMUWVBQUpOd0JEd3RCOEFBazNBRUxDNE1CQVFGL1FRRWtrZ0VqbFFGRkJFQkJ3QUFrbFFFTFFZQVFJOGdCYTBFQ2RDU1RBU00xQkVBamt3RkJBWFFra3dFTEk4a0JKSlFCSSswQkpKWUJJOGdCSkpzQkk4TUJJZ0FrbWdFZ0FFRUFTaUlBQkg4anhBRkJBRW9GSUFBTEJFQkJBU1NaQVFWQkFDU1pBUXNqeEFGQkFFb0VRQkE4Q3lQUUFVVUVRRUVBSkpJQkN3dEhBRUVCSkp3Qkk1OEJSUVJBUWNBQUpKOEJDMEdBRUNQWUFXdEJBblFrblFFak5RUkFJNTBCUVFGMEpKMEJDeVBMQVNTZUFTUHVBU1NnQVNQUkFVVUVRRUVBSkp3QkN3dEFBRUVCSktNQkk2VUJSUVJBUVlBQ0pLVUJDMEdBRUNQYUFXdEJBWFFrcEFFak5RUkFJNlFCUVFGMEpLUUJDMEVBSktZQkk5SUJSUVJBUVFBa293RUxDMGtCQVg5QkFTU25BU09xQVVVRVFFSEFBQ1NxQVFzajNBRWozUUYwSWdCQkFYUWdBQ00xR3lTb0FTUE5BU1NwQVNQd0FTU3JBVUgvL3dFa3JBRWowd0ZGQkVCQkFDU25BUXNMVkFBZ0FFR0FBWEZCQUVja1dDQUFRY0FBY1VFQVJ5UlhJQUJCSUhGQkFFY2tWaUFBUVJCeFFRQkhKRlVnQUVFSWNVRUFSeVJjSUFCQkJIRkJBRWNrV3lBQVFRSnhRUUJISkZvZ0FFRUJjVUVBUnlSWkM0Z0ZBUUYvSUFCQnB2NERSeUlDQkVBalhVVWhBZ3NnQWdSQVFRQVBDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQWtHUS9nTkhCRUFnQWtHUi9nTnJEaFlDQmdvT0ZRTUhDdzhCQkFnTUVCVUZDUTBSRWhNVUZRc2dBVUh3QUhGQkJIVWt3d0VnQVVFSWNVRUFSeVRGQVNBQlFRZHhKTVFCREJVTElBRkJnQUZ4UVFCSEpOSUJEQlFMSUFGQkJuVkJBM0VrMXdFZ0FVRS9jU1RwQVVIQUFDUHBBV3NrbFFFTUV3c2dBVUVHZFVFRGNTVFpBU0FCUVQ5eEpPb0JRY0FBSStvQmF5U2ZBUXdTQ3lBQkpPc0JRWUFDSStzQmF5U2xBUXdSQ3lBQlFUOXhKT3dCUWNBQUkrd0JheVNxQVF3UUN5QUJFRk1NRHdzZ0FSQlVEQTRMUVFFa1lpQUJRUVYxUVE5eEpPOEJEQTBMSUFFUVZRd01DeUFCSk1ZQkk4WUJJOGNCUVFoMGNpVElBUXdMQ3lBQkpQRUJJL0VCSS9JQlFRaDBjaVRZQVF3S0N5QUJKUE1CSS9NQkkvUUJRUWgwY2lUYUFRd0pDeUFCRUZZTUNBc2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5Uy9BU0FCUVFkeEpNY0JJOFlCSThjQlFRaDBjaVRJQVJCWEN3d0hDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKTUFCSUFGQkIzRWs4Z0VqOFFFajhnRkJDSFJ5Sk5nQkVGZ0xEQVlMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNrd1FFZ0FVRUhjU1QwQVNQekFTUDBBVUVJZEhJazJnRVFXUXNNQlFzZ0FVR0FBWEVFUUNBQlFjQUFjVUVBUnlUQ0FSQmFDd3dFQ3lBQlFRUjFRUWR4SkZNZ0FVRUhjU1JVUVFFa2JRd0RDeUFCRUZ0QkFTUnVEQUlMSUFGQmdBRnhRUUJISkYwZ0FVR0FBWEZGQkVBQ1FFR1EvZ01oQWdOQUlBSkJwdjREVGcwQklBSkJBQkFFSUFKQkFXb2hBZ3dBQUFzQUN3c01BUXRCQVE4TFFRRUxQQUVCZnlBQVFRaDBJUUZCQUNFQUEwQUNRQ0FBUVo4QlNnMEFJQUJCZ1B3RGFpQUFJQUZxRUFFUUJDQUFRUUZxSVFBTUFRc0xRWVFGSkxnQkN5TUJBWDhqK0FFUUFTRUFJL2tCRUFGQi93RnhJQUJCL3dGeFFRaDBja0h3L3dOeEN5Y0JBWDhqK2dFUUFTRUFJL3NCRUFGQi93RnhJQUJCL3dGeFFRaDBja0h3UDNGQmdJQUNhZ3VEQVFFRGZ5TXhSUVJBRHdzZ0FFR0FBWEZGSTdzQkk3c0JHd1JBUVFBa3V3RWo5d0VRQVVHQUFYSWhBQ1AzQVNBQUVBUVBDeEJlSVFFUVh5RUNJQUJCLzM1eFFRRnFRUVIwSVFNZ0FFR0FBWEVFUUVFQkpMc0JJQU1rdkFFZ0FTUzlBU0FDSkw0QkkvY0JJQUJCLzM1eEVBUUZJQUVnQWlBREVHb2o5d0ZCL3dFUUJBc0xZZ0VEZnlQK0FTQUFSaUlDUlFSQUkvMEJJQUJHSVFJTElBSUVRQ0FBUVFGcklnTVFBVUcvZjNFaUFrRS9jU0lFUVVCcklBUkJBVUVBSS8wQklBQkdHeHRCZ0pBRWFpQUJPZ0FBSUFKQmdBRnhCRUFnQXlBQ1FRRnFRWUFCY2hBRUN3c0xQQUVCZndKQUFrQUNRQUpBSUFBRVFDQUFJZ0ZCQVVZTkFTQUJRUUpHRFFJZ0FVRURSZzBEREFRTFFRa1BDMEVERHd0QkJROExRUWNQQzBFQUN5MEJBWDlCQVNPQkFSQmlJZ0owSUFCeFFRQkhJZ0FFZjBFQklBSjBJQUZ4UlFVZ0FBc0VRRUVCRHd0QkFBdUVBUUVDZndOQUlBRWdBRWdFUUNBQlFRUnFJUUVqZlNJQ1FRUnFKSDBqZlVILy93TktCRUFqZlVHQWdBUnJKSDBMSTRBQkJFQWpnZ0VFUUNOL0pINUJBU1I0UVFJUU9VRUFKSUlCUVFFa2d3RUZJNE1CQkVCQkFDU0RBUXNMSUFJamZSQmpCRUFqZmtFQmFpUitJMzVCL3dGS0JFQkJBU1NDQVVFQUpINExDd3NNQVFzTEN3b0FJM3dRWkVFQUpId0xRQUVCZnlOOUlRQkJBQ1I5UVlUK0EwRUFFQVFqZ0FFRWZ5QUFJMzBRWXdVamdBRUxCRUFqZmtFQmFpUitJMzVCL3dGS0JFQkJBU1NDQVVFQUpINExDd3Q1QVFKL0k0QUJJUUVnQUVFRWNVRUFSeVNBQVNBQVFRTnhJUUlnQVVVRVFDT0JBUkJpSVFBZ0FoQmlJUUVqZ0FFRWZ5TjlRUUVnQUhSeEJTTjlRUUVnQUhSeFFRQkhJZ0FFZnlOOVFRRWdBWFJ4QlNBQUN3c0VRQ04rUVFGcUpINGpma0gvQVVvRVFFRUJKSUlCUVFBa2Znc0xDeUFDSklFQkM4NEdBUUYvQWtBQ1FDQUFRYzMrQTBZRVFFSE4vZ01nQVVFQmNSQUVEQUVMSUFCQmdJQUNTQVJBSUFBZ0FSQlNEQUVMSUFCQmdJQUNUaUlDQkVBZ0FFR0F3QUpJSVFJTElBSU5BU0FBUVlEQUEwNGlBZ1JBSUFCQmdQd0RTQ0VDQ3lBQ0JFQWdBRUdBUUdvZ0FSQUVEQUlMSUFCQmdQd0RUaUlDQkVBZ0FFR2YvUU5NSVFJTElBSUVRQ09QQVVFQ1NBMEJEQUlMSUFCQm9QMERUaUlDQkVBZ0FFSC8vUU5NSVFJTElBSU5BQ0FBUVlMK0EwWUVRQ0FCUVFGeFFRQkhKSVlCSUFGQkFuRkJBRWNraHdFZ0FVR0FBWEZCQUVja2lBRkJBUThMSUFCQmtQNERUaUlDQkVBZ0FFR20vZ05NSVFJTElBSUVRQkJOSUFBZ0FSQmNEd3NnQUVHdy9nTk9JZ0lFUUNBQVFiLytBMHdoQWdzZ0FnUkFFRTBMSUFCQndQNERUaUlDQkVBZ0FFSEwvZ05NSVFJTElBSUVRQ0FBUWNEK0EwWUVRQ0FCRUI0TUF3c2dBRUhCL2dOR0JFQkJ3ZjRESUFGQitBRnhRY0grQXhBQlFRZHhja0dBQVhJUUJBd0NDeUFBUWNUK0EwWUVRRUVBSkUwZ0FFRUFFQVFNQWdzZ0FFSEYvZ05HQkVBZ0FTVDJBUXdEQ3lBQVFjYitBMFlFUUNBQkVGME1Bd3NDUUFKQUFrQUNRQ0FBSWdKQncvNERSd1JBSUFKQnd2NERhdzRLQVFRRUJBUUVCQVFEQWdRTElBRWtUZ3dHQ3lBQkpFOE1CUXNnQVNSUURBUUxJQUVrVVF3REN3d0NDeVAzQVNBQVJnUkFJQUVRWUF3QkN5TTBJQUJHSWdKRkJFQWpNaUFBUmlFQ0N5QUNCRUFqdXdFRVFBSi9JNzBCUVlDQUFVNGlBZ1JBSTcwQlFmLy9BVXdoQWdzZ0FrVUxCRUFqdlFGQmdLQURUaUlDQkVBanZRRkIvNzhEVENFQ0N3c2dBZzBDQ3dzZ0FDUDhBVTRpQWdSQUlBQWovUUZNSVFJTElBSUVRQ0FBSUFFUVlRd0NDeUFBUVlUK0EwNGlBZ1JBSUFCQmgvNERUQ0VDQ3lBQ0JFQVFaUUpBQWtBQ1FBSkFJQUFpQWtHRS9nTkhCRUFnQWtHRi9nTnJEZ01CQWdNRUN4Qm1EQVVMQWtBamdBRUVRQ09EQVEwQkk0SUJCRUJCQUNTQ0FRc0xJQUVrZmdzTUJRc2dBU1IvSTRNQkk0QUJJZ0FnQUJzRVFDTi9KSDVCQUNTREFRc01CQXNnQVJCbkRBTUxEQUlMSUFCQmdQNERSZ1JBSUFGQi93RnpKTFVCSTdVQklnSkJFSEZCQUVja3RnRWdBa0VnY1VFQVJ5UzNBUXNnQUVHUC9nTkdCRUFnQVJBUERBSUxJQUJCLy84RFJnUkFJQUVRRGd3Q0MwRUJEd3RCQUE4TFFRRUxFUUFnQUNBQkVHZ0VRQ0FBSUFFUUJBc0xZQUVEZndOQUFrQWdBeUFDVGcwQUlBQWdBMm9RVVNFRklBRWdBMm9oQkFOQUlBUkIvNzhDU2dSQUlBUkJnRUJxSVFRTUFRc0xJQVFnQlJCcElBTkJBV29oQXd3QkN3dEJJQ0VESTdnQklBSkJFRzFCd0FCQklDTTFHMnhxSkxnQkMyY0JBWDhqdXdGRkJFQVBDeU85QVNPK0FTTzhBU0lBUVJBZ0FFRVFTQnNpQUJCcUk3MEJJQUJxSkwwQkk3NEJJQUJxSkw0Qkk3d0JJQUJySkx3Qkk3d0JRUUJNQkVCQkFDUzdBU1AzQVVIL0FSQUVCU1AzQVNPOEFVRVFiVUVCYTBIL2ZuRVFCQXNMUmdFQ2Z5UDJBU0VEQW44Z0FFVWlBa1VFUUNBQVFRRkdJUUlMSUFJTEJIOGpUU0FEUmdVZ0Fnc0VRQ0FCUVFSeUlnRkJ3QUJ4QkVBUU9nc0ZJQUZCZTNFaEFRc2dBUXVDQWdFRGZ5T3RBVVVFUUE4TEk0OEJJUUFnQUNOTklnSkJrQUZPQkg5QkFRVWpUQ00xQkg5QjhBVUZRZmdDQzA0RWYwRUNCVUVEUVFBalRDTTFCSDlCOGdNRlFma0JDMDRiQ3dzaUFVY0VRRUhCL2dNUUFTRUFJQUVrandGQkFDRUNBa0FDUUFKQUFrQWdBUVJBSUFGQkFXc09Bd0VDQXdRTElBQkJmSEVpQUVFSWNVRUFSeUVDREFNTElBQkJmWEZCQVhJaUFFRVFjVUVBUnlFQ0RBSUxJQUJCZm5GQkFuSWlBRUVnY1VFQVJ5RUNEQUVMSUFCQkEzSWhBQXNnQWdSQUVEb0xJQUZGQkVBUWF3c2dBVUVCUmdSQVFRRWtka0VBRURrTFFjSCtBeUFCSUFBUWJCQUVCU0FDUVprQlJnUkFRY0grQXlBQlFjSCtBeEFCRUd3UUJBc0xDN1FCQUNPdEFRUkFJMHdnQUdva1RBTkFJMHdDZnlNMUJFQkJDQ05OUVprQlJnMEJHa0dRQnd3QkMwRUVJMDFCbVFGR0RRQWFRY2dEQzA0RVFDTk1BbjhqTlFSQVFRZ2pUVUdaQVVZTkFScEJrQWNNQVF0QkJDTk5RWmtCUmcwQUdrSElBd3RySkV3alRTSUFRWkFCUmdSQUl5c0VRQkEzQlNBQUVEWUxFRGhCZnlTNUFVRi9KTG9CQlNBQVFaQUJTQVJBSXl0RkJFQWdBQkEyQ3dzTFFRQWdBRUVCYWlBQVFaa0JTaHNrVFF3QkN3c0xFRzBMc3dFQUkwc0NmeU0xQkVCQkNDTk5RWmtCUmcwQkdrR1FCd3dCQzBFRUkwMUJtUUZHRFFBYVFjZ0RDMGdFUUE4TEEwQWpTd0ovSXpVRVFFRUlJMDFCbVFGR0RRRWFRWkFIREFFTFFRUWpUVUdaQVVZTkFCcEJ5QU1MVGdSQUFuOGpOUVJBUVFnalRVR1pBVVlOQVJwQmtBY01BUXRCQkNOTlFaa0JSZzBBR2tISUF3c1FiaU5MQW44ak5RUkFRUWdqVFVHWkFVWU5BUnBCa0FjTUFRdEJCQ05OUVprQlJnMEFHa0hJQXd0ckpFc01BUXNMQ3pNQkFYOUJBU09IQVFSL1FRSUZRUWNMSWdKMElBQnhRUUJISWdBRWYwRUJJQUowSUFGeFJRVWdBQXNFUUVFQkR3dEJBQXVWQVFFQ2Z5T0lBVVVFUUE4TEEwQWdBU0FBU0FSQUlBRkJCR29oQVNPRUFTSUNRUVJxSklRQkk0UUJRZi8vQTBvRVFDT0VBVUdBZ0FSckpJUUJDeUFDSTRRQkVIQUVRRUdCL2dOQmdmNERFQUZCQVhSQkFXcEIvd0Z4RUFRamhRRkJBV29raFFFamhRRkJDRVlFUUVFQUpJVUJRUUVrZVVFREVEbEJndjREUVlMK0F4QUJRZjkrY1JBRVFRQWtpQUVMQ3d3QkN3c0xoZ0VBSTdnQlFRQktCRUFqdUFFZ0FHb2hBRUVBSkxnQkN5TkFJQUJxSkVBalJFVUVRQ01wQkVBalN5QUFhaVJMRUc4RklBQVFiZ3NqS0FSQUkxSWdBR29rVWdVZ0FCQk1DeUFBRUhFTEl5b0VRQ044SUFCcUpId1FaUVVnQUJCa0N5T0xBU0FBYWlTTEFTT0xBU09KQVU0RVFDT0tBVUVCYWlTS0FTT0xBU09KQVdza2l3RUxDd29BUVFRUWNpTS9FQUVMSmdFQmYwRUVFSElqUDBFQmFrSC8vd054RUFFaEFCQnpRZjhCY1NBQVFmOEJjVUVJZEhJTERBQkJCQkJ5SUFBZ0FSQnBDekFCQVg5QkFTQUFkRUgvQVhFaEFpQUJRUUJLQkVBalBTQUNja0gvQVhFa1BRVWpQU0FDUWY4QmMzRWtQUXNqUFFzSkFFRUZJQUFRZGhvTFNRRUJmeUFCUVFCT0JFQWdBRUVQY1NBQlFROXhha0VRY1FSQVFRRVFkd1ZCQUJCM0N3VWdBVUVmZFNJQ0lBRWdBbXB6UVE5eElBQkJEM0ZMQkVCQkFSQjNCVUVBRUhjTEN3c0pBRUVISUFBUWRob0xDUUJCQmlBQUVIWWFDd2tBUVFRZ0FCQjJHZ3M3QVFKL0lBRkJnUDREY1VFSWRTRUNJQUJCQVdvaEF5QUFJQUZCL3dGeElnRVFhQVJBSUFBZ0FSQUVDeUFESUFJUWFBUkFJQU1nQWhBRUN3c01BRUVJRUhJZ0FDQUJFSHdMZFFBZ0FnUkFJQUVnQUVILy93TnhJZ0JxSUFBZ0FYTnpJZ0pCRUhFRVFFRUJFSGNGUVFBUWR3c2dBa0dBQW5FRVFFRUJFSHNGUVFBUWV3c0ZJQUFnQVdwQi8vOERjU0lDSUFCQi8vOERjVWtFUUVFQkVIc0ZRUUFRZXdzZ0FDQUJjeUFDYzBHQUlIRUVRRUVCRUhjRlFRQVFkd3NMQ3dvQVFRUVFjaUFBRUZFTGtBVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxEQk1MRUhSQi8vOERjU0lBUVlEK0EzRkJDSFVrTnlBQVFmOEJjU1E0REJFTEl6aEIvd0Z4SXpkQi93RnhRUWgwY2lNMkVIVU1FUXNqT0VIL0FYRWpOMEgvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRGNNRVFzak4wRUJFSGdqTjBFQmFrSC9BWEVrTnlNM0JFQkJBQkI1QlVFQkVIa0xRUUFRZWd3UEN5TTNRWDhRZUNNM1FRRnJRZjhCY1NRM0l6Y0VRRUVBRUhrRlFRRVFlUXRCQVJCNkRBNExFSE5CL3dGeEpEY01Dd3NqTmtHQUFYRkJnQUZHQkVCQkFSQjdCVUVBRUhzTEl6WWlBRUVCZENBQVFmOEJjVUVIZG5KQi93RnhKRFlNQ1FzUWRFSC8vd054SXo0UWZRd0tDeU04UWY4QmNTTTdRZjhCY1VFSWRISWlBQ000UWY4QmNTTTNRZjhCY1VFSWRISWlBVUVBRUg0Z0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTUTdJQUJCL3dGeEpEeEJBQkI2UVFnUEN5TTRRZjhCY1NNM1FmOEJjVUVJZEhJUWYwSC9BWEVrTmd3SkN5TTRRZjhCY1NNM1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa053d0pDeU00UVFFUWVDTTRRUUZxUWY4QmNTUTRJemdFUUVFQUVIa0ZRUUVRZVF0QkFCQjZEQWNMSXpoQmZ4QjRJemhCQVd0Qi93RnhKRGdqT0FSQVFRQVFlUVZCQVJCNUMwRUJFSG9NQmdzUWMwSC9BWEVrT0F3REN5TTJRUUZ4UVFCTEJFQkJBUkI3QlVFQUVIc0xJellpQUVFSGRDQUFRZjhCY1VFQmRuSkIvd0Z4SkRZTUFRdEJmdzhMUVFBUWVVRUFFSHBCQUJCM0RBSUxJejlCQVdwQi8vOERjU1EvREFFTEl6OUJBbXBCLy84RGNTUS9DMEVFRHdzZ0FFSC9BWEVrT0VFSUN5Z0JBWDhnQUVFWWRFRVlkU0lCUVlBQmNRUkFRWUFDSUFCQkdIUkJHSFZyUVg5c0lRRUxJQUVMS1FFQmZ5QUFFSUVCSVFFalB5QUJRUmgwUVJoMWFrSC8vd054SkQ4alAwRUJha0gvL3dOeEpEOEwxZ1VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFDQUFRUkZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lNeEJFQkJ6ZjRERUg5Qi93RnhJZ0JCQVhFRVFFSE4vZ01nQUVGK2NTSUFRWUFCY1FSL1FRQWtOU0FBUWY5K2NRVkJBU1ExSUFCQmdBRnlDeEIxUWNRQUR3c0xRUUVrUkF3UkN4QjBRZi8vQTNFaUFFR0EvZ054UVFoMUpEa2dBRUgvQVhFa09pTS9RUUpxUWYvL0EzRWtQd3dSQ3lNNlFmOEJjU001UWY4QmNVRUlkSElqTmhCMURCQUxJenBCL3dGeEl6bEIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTUTVEQkFMSXpsQkFSQjRJemxCQVdwQi93RnhKRGtqT1FSQVFRQVFlUVZCQVJCNUMwRUFFSG9NRGdzak9VRi9FSGdqT1VFQmEwSC9BWEVrT1NNNUJFQkJBQkI1QlVFQkVIa0xRUUVRZWd3TkN4QnpRZjhCY1NRNURBc0xRUUZCQUNNMklnRkJnQUZ4UVlBQlJoc2hBQ005UVFSMlFRRnhJQUZCQVhSeVFmOEJjU1EyREFrTEVITVFnZ0ZCQ0E4TEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2lJQUl6cEIvd0Z4SXpsQi93RnhRUWgwY2lJQlFRQVFmaUFBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkRzZ0FFSC9BWEVrUEVFQUVIcEJDQThMSXpwQi93RnhJemxCL3dGeFFRaDBjaEIvUWY4QmNTUTJEQWdMSXpwQi93RnhJemxCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1E1REFnTEl6cEJBUkI0SXpwQkFXcEIvd0Z4SkRvak9nUkFRUUFRZVFWQkFSQjVDMEVBRUhvTUJnc2pPa0YvRUhnak9rRUJhMEgvQVhFa09pTTZCRUJCQUJCNUJVRUJFSGtMUVFFUWVnd0ZDeEJ6UWY4QmNTUTZEQU1MUVFGQkFDTTJJZ0ZCQVhGQkFVWWJJUUFqUFVFRWRrRUJjVUVIZENBQlFmOEJjVUVCZG5Ja05nd0JDMEYvRHdzZ0FBUkFRUUVRZXdWQkFCQjdDMEVBRUhsQkFCQjZRUUFRZHd3QkN5TS9RUUZxUWYvL0EzRWtQd3RCQkE4TElBQkIvd0Z4SkRwQkNBdTNCZ0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFTQkhCRUFnQUVFaGF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pQVUVIZGtFQmNRUkFJejlCQVdwQi8vOERjU1EvQlJCekVJSUJDMEVJRHdzUWRFSC8vd054SWdCQmdQNERjVUVJZFNRN0lBQkIvd0Z4SkR3alAwRUNha0gvL3dOeEpEOE1FQXNqUEVIL0FYRWpPMEgvQVhGQkNIUnlJZ0FqTmhCMUlBQkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtPeUFBUWY4QmNTUThEQThMSXp4Qi93RnhJenRCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1E3SUFCQi93RnhKRHhCQ0E4TEl6dEJBUkI0SXp0QkFXcEIvd0Z4SkRzak93UkFRUUFRZVFWQkFSQjVDMEVBRUhvTURRc2pPMEYvRUhnak8wRUJhMEgvQVhFa095TTdCRUJCQUJCNUJVRUJFSGtMUVFFUWVnd01DeEJ6UWY4QmNTUTdEQW9MUVFaQkFDTTlRUVYyUVFGeFFRQkxHeUVCSUFGQjRBQnlJQUVqUFVFRWRrRUJjVUVBU3hzaEFTTTlRUVoyUVFGeFFRQkxCSDhqTmlBQmEwSC9BWEVGSUFGQkJuSWdBU00ySWdCQkQzRkJDVXNiSWdGQjRBQnlJQUVnQUVHWkFVc2JJZ0VnQUdwQi93RnhDeUlBQkVCQkFCQjVCVUVCRUhrTElBRkI0QUJ4QkVCQkFSQjdCVUVBRUhzTFFRQVFkeUFBSkRZTUNnc2pQVUVIZGtFQmNVRUFTd1JBRUhNUWdnRUZJejlCQVdwQi8vOERjU1EvQzBFSUR3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUlnRWdBVUgvL3dOeFFRQVFmaUFCUVFGMFFmLy9BM0VpQVVHQS9nTnhRUWgxSkRzZ0FVSC9BWEVrUEVFQUVIcEJDQThMSXp4Qi93RnhJenRCL3dGeFFRaDBjaUlCRUg5Qi93RnhKRFlnQVVFQmFrSC8vd054SWdGQmdQNERjVUVJZFNRN0lBRkIvd0Z4SkR3TUJ3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeVFRRnJRZi8vQTNFaUFVR0EvZ054UVFoMUpEc2dBVUgvQVhFa1BFRUlEd3NqUEVFQkVIZ2pQRUVCYWtIL0FYRWtQQ004QkVCQkFCQjVCVUVCRUhrTFFRQVFlZ3dGQ3lNOFFYOFFlQ004UVFGclFmOEJjU1E4SXp3RVFFRUFFSGtGUVFFUWVRdEJBUkI2REFRTEVITkIvd0Z4SkR3TUFnc2pOa0YvYzBIL0FYRWtOa0VCRUhwQkFSQjNEQUlMUVg4UEN5TS9RUUZxUWYvL0EzRWtQd3RCQkF1UkJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRXdSd1JBSUFCQk1Xc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJejFCQkhaQkFYRUVRQ00vUVFGcVFmLy9BM0VrUHdVUWN4Q0NBUXRCQ0E4TEVIUkIvLzhEY1NRK0l6OUJBbXBCLy84RGNTUS9EQklMSXp4Qi93RnhJenRCL3dGeFFRaDBjaUlBSXpZUWRRd09DeU0rUVFGcVFmLy9BM0VrUGtFSUR3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUlnQVFmeUlCUVFFUWVDQUJRUUZxUWY4QmNTSUJCRUJCQUJCNUJVRUJFSGtMUVFBUWVnd05DeU04UWY4QmNTTTdRZjhCY1VFSWRISWlBQkIvSWdGQmZ4QjRJQUZCQVd0Qi93RnhJZ0VFUUVFQUVIa0ZRUUVRZVF0QkFSQjZEQXdMSXp4Qi93RnhJenRCL3dGeFFRaDBjaEJ6UWY4QmNSQjFEQXdMUVFBUWVrRUFFSGRCQVJCN0RBd0xJejFCQkhaQkFYRkJBVVlFUUJCekVJSUJCU00vUVFGcVFmLy9BM0VrUHd0QkNBOExJenhCL3dGeEl6dEIvd0Z4UVFoMGNpSUJJejVCQUJCK0l6NGdBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtPeUFBUWY4QmNTUThRUUFRZWtFSUR3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUlnQVFmMEgvQVhFa05nd0dDeU0rUVFGclFmLy9BM0VrUGtFSUR3c2pOa0VCRUhnak5rRUJha0gvQVhFa05pTTJCRUJCQUJCNUJVRUJFSGtMUVFBUWVnd0hDeU0yUVg4UWVDTTJRUUZyUWY4QmNTUTJJellFUUVFQUVIa0ZRUUVRZVF0QkFSQjZEQVlMRUhOQi93RnhKRFlNQkF0QkFCQjZRUUFRZHlNOVFRUjJRUUZ4UVFCTEJFQkJBQkI3QlVFQkVIc0xEQVFMUVg4UEN5QUFRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDFKRHNnQUVIL0FYRWtQQXdDQ3lBQVFmLy9BM0VnQVJCMURBRUxJejlCQVdwQi8vOERjU1EvQzBFRUMrSUJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUJIQkVBZ0FFSEJBRVlOQVFKQUlBQkJ3Z0JyRGc0REJBVUdCd2dKRVFvTERBME9Ed0FMREE4TERBOExJemdrTnd3T0N5TTVKRGNNRFFzak9pUTNEQXdMSXpza053d0xDeU04SkRjTUNnc2pQRUgvQVhFak8wSC9BWEZCQ0hSeUVIOUIvd0Z4SkRjTUNRc2pOaVEzREFnTEl6Y2tPQXdIQ3lNNUpEZ01CZ3NqT2lRNERBVUxJenNrT0F3RUN5TThKRGdNQXdzalBFSC9BWEVqTzBIL0FYRkJDSFJ5RUg5Qi93RnhKRGdNQWdzak5pUTREQUVMUVg4UEMwRUVDOTBCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZEFBUndSQUlBQkIwUUJHRFFFQ1FDQUFRZElBYXc0T0VBTUVCUVlIQ0FrS0VBc01EUTRBQ3d3T0N5TTNKRGtNRGdzak9DUTVEQTBMSXpva09Rd01DeU03SkRrTUN3c2pQQ1E1REFvTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2hCL1FmOEJjU1E1REFrTEl6WWtPUXdJQ3lNM0pEb01Cd3NqT0NRNkRBWUxJemtrT2d3RkN5TTdKRG9NQkFzalBDUTZEQU1MSXp4Qi93RnhJenRCL3dGeFFRaDBjaEIvUWY4QmNTUTZEQUlMSXpZa09nd0JDMEYvRHd0QkJBdmRBUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBRWNFUUNBQVFlRUFSZzBCQWtBZ0FFSGlBR3NPRGdNRUVBVUdCd2dKQ2dzTUVBME9BQXNNRGdzak55UTdEQTRMSXpna093d05DeU01SkRzTURBc2pPaVE3REFzTEl6d2tPd3dLQ3lNOFFmOEJjU003UWY4QmNVRUlkSElRZjBIL0FYRWtPd3dKQ3lNMkpEc01DQXNqTnlROERBY0xJemdrUEF3R0N5TTVKRHdNQlFzak9pUThEQVFMSXpza1BBd0RDeU04UWY4QmNTTTdRZjhCY1VFSWRISVFmMEgvQVhFa1BBd0NDeU0ySkR3TUFRdEJmdzhMUVFRTDZnSUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBRWNFUUNBQVFmRUFSZzBCQWtBZ0FFSHlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFJBQXNNRHdzalBFSC9BWEVqTzBIL0FYRkJDSFJ5SXpjUWRRd1BDeU04UWY4QmNTTTdRZjhCY1VFSWRISWpPQkIxREE0TEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2lNNUVIVU1EUXNqUEVIL0FYRWpPMEgvQVhGQkNIUnlJem9RZFF3TUN5TThRZjhCY1NNN1FmOEJjVUVJZEhJak94QjFEQXNMSXp4Qi93RnhJenRCL3dGeFFRaDBjaU04RUhVTUNnc2p1d0ZGQkVBQ1FDT1FBUVJBUVFFa1FRd0JDeU4xSTN0eFFSOXhSUVJBUVFFa1Fnd0JDMEVCSkVNTEN3d0pDeU04UWY4QmNTTTdRZjhCY1VFSWRISWpOaEIxREFnTEl6Y2tOZ3dIQ3lNNEpEWU1CZ3NqT1NRMkRBVUxJem9rTmd3RUN5TTdKRFlNQXdzalBDUTJEQUlMSXp4Qi93RnhJenRCL3dGeFFRaDBjaEIvUWY4QmNTUTJEQUVMUVg4UEMwRUVDMGtCQVg4Z0FVRUFUZ1JBSUFCQi93RnhJQUFnQVdwQi93RnhTd1JBUVFFUWV3VkJBQkI3Q3dVZ0FVRWZkU0lDSUFFZ0FtcHpJQUJCL3dGeFNnUkFRUUVRZXdWQkFCQjdDd3NMTkFFQmZ5TTJJQUJCL3dGeElnRVFlQ00ySUFFUWlnRWpOaUFBYWtIL0FYRWtOaU0yQkVCQkFCQjVCVUVCRUhrTFFRQVFlZ3RzQVFKL0l6WWdBR29qUFVFRWRrRUJjV3BCL3dGeElnRWhBaU0ySUFCeklBRnpRUkJ4QkVCQkFSQjNCVUVBRUhjTEl6WWdBRUgvQVhGcUl6MUJCSFpCQVhGcVFZQUNjVUVBU3dSQVFRRVFld1ZCQUJCN0N5QUNKRFlqTmdSQVFRQVFlUVZCQVJCNUMwRUFFSG9MN3dFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdBQVVjRVFDQUJRWUVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzak54Q0xBUXdRQ3lNNEVJc0JEQThMSXprUWl3RU1EZ3NqT2hDTEFRd05DeU03RUlzQkRBd0xJendRaXdFTUN3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUVIOFFpd0VNQ2dzak5oQ0xBUXdKQ3lNM0VJd0JEQWdMSXpnUWpBRU1Cd3NqT1JDTUFRd0dDeU02RUl3QkRBVUxJenNRakFFTUJBc2pQQkNNQVF3REN5TThRZjhCY1NNN1FmOEJjVUVJZEhJUWZ4Q01BUXdDQ3lNMkVJd0JEQUVMUVg4UEMwRUVDemNCQVg4ak5pQUFRZjhCY1VGL2JDSUJFSGdqTmlBQkVJb0JJellnQUd0Qi93RnhKRFlqTmdSQVFRQVFlUVZCQVJCNUMwRUJFSG9MYkFFQ2Z5TTJJQUJySXoxQkJIWkJBWEZyUWY4QmNTSUJJUUlqTmlBQWN5QUJjMEVRY1FSQVFRRVFkd1ZCQUJCM0N5TTJJQUJCL3dGeGF5TTlRUVIyUVFGeGEwR0FBbkZCQUVzRVFFRUJFSHNGUVFBUWV3c2dBaVEySXpZRVFFRUFFSGtGUVFFUWVRdEJBUkI2Qys4QkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCa0FGSEJFQWdBVUdSQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEl6Y1FqZ0VNRUFzak9CQ09BUXdQQ3lNNUVJNEJEQTRMSXpvUWpnRU1EUXNqT3hDT0FRd01DeU04RUk0QkRBc0xJenhCL3dGeEl6dEIvd0Z4UVFoMGNoQi9FSTRCREFvTEl6WVFqZ0VNQ1Fzak54Q1BBUXdJQ3lNNEVJOEJEQWNMSXprUWp3RU1CZ3NqT2hDUEFRd0ZDeU03RUk4QkRBUUxJendRandFTUF3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUVIOFFqd0VNQWdzak5oQ1BBUXdCQzBGL0R3dEJCQXNqQUNNMklBQnhKRFlqTmdSQVFRQVFlUVZCQVJCNUMwRUFFSHBCQVJCM1FRQVFld3NuQUNNMklBQnpRZjhCY1NRMkl6WUVRRUVBRUhrRlFRRVFlUXRCQUJCNlFRQVFkMEVBRUhzTDd3RUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHZ0FVY0VRQ0FCUWFFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pOeENSQVF3UUN5TTRFSkVCREE4TEl6a1FrUUVNRGdzak9oQ1JBUXdOQ3lNN0VKRUJEQXdMSXp3UWtRRU1Dd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlFSDhRa1FFTUNnc2pOaENSQVF3SkN5TTNFSklCREFnTEl6Z1FrZ0VNQndzak9SQ1NBUXdHQ3lNNkVKSUJEQVVMSXpzUWtnRU1CQXNqUEJDU0FRd0RDeU04UWY4QmNTTTdRZjhCY1VFSWRISVFmeENTQVF3Q0N5TTJFSklCREFFTFFYOFBDMEVFQ3ljQUl6WWdBSEpCL3dGeEpEWWpOZ1JBUVFBUWVRVkJBUkI1QzBFQUVIcEJBQkIzUVFBUWV3c3ZBUUYvSXpZZ0FFSC9BWEZCZjJ3aUFSQjRJellnQVJDS0FTTTJJQUZxQkVCQkFCQjVCVUVCRUhrTFFRRVFlZ3Z2QVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRYkFCUndSQUlBRkJzUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lNM0VKUUJEQkFMSXpnUWxBRU1Ed3NqT1JDVUFRd09DeU02RUpRQkRBMExJenNRbEFFTURBc2pQQkNVQVF3TEN5TThRZjhCY1NNN1FmOEJjVUVJZEhJUWZ4Q1VBUXdLQ3lNMkVKUUJEQWtMSXpjUWxRRU1DQXNqT0JDVkFRd0hDeU01RUpVQkRBWUxJem9RbFFFTUJRc2pPeENWQVF3RUN5TThFSlVCREFNTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2hCL0VKVUJEQUlMSXpZUWxRRU1BUXRCZnc4TFFRUUxPd0VCZnlBQUVGQWlBVUYvUmdSL0lBQVFBUVVnQVF0Qi93RnhJQUJCQVdvaUFSQlFJZ0JCZjBZRWZ5QUJFQUVGSUFBTFFmOEJjVUVJZEhJTEN3QkJDQkJ5SUFBUWx3RUxRd0FnQUVHQUFYRkJnQUZHQkVCQkFSQjdCVUVBRUhzTElBQkJBWFFnQUVIL0FYRkJCM1p5UWY4QmNTSUFCRUJCQUJCNUJVRUJFSGtMUVFBUWVrRUFFSGNnQUF0QkFDQUFRUUZ4UVFCTEJFQkJBUkI3QlVFQUVIc0xJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU0lBQkVCQkFCQjVCVUVCRUhrTFFRQVFla0VBRUhjZ0FBdFBBUUYvUVFGQkFDQUFRWUFCY1VHQUFVWWJJUUVqUFVFRWRrRUJjU0FBUVFGMGNrSC9BWEVoQUNBQkJFQkJBUkI3QlVFQUVIc0xJQUFFUUVFQUVIa0ZRUUVRZVF0QkFCQjZRUUFRZHlBQUMxQUJBWDlCQVVFQUlBQkJBWEZCQVVZYklRRWpQVUVFZGtFQmNVRUhkQ0FBUWY4QmNVRUJkbkloQUNBQkJFQkJBUkI3QlVFQUVIc0xJQUFFUUVFQUVIa0ZRUUVRZVF0QkFCQjZRUUFRZHlBQUMwWUJBWDlCQVVFQUlBQkJnQUZ4UVlBQlJoc2hBU0FBUVFGMFFmOEJjU0VBSUFFRVFFRUJFSHNGUVFBUWV3c2dBQVJBUVFBUWVRVkJBUkI1QzBFQUVIcEJBQkIzSUFBTFhnRUNmMEVCUVFBZ0FFRUJjVUVCUmhzaEFVRUJRUUFnQUVHQUFYRkJnQUZHR3lFQ0lBQkIvd0Z4UVFGMklnQkJnQUZ5SUFBZ0Foc2lBQVJBUVFBUWVRVkJBUkI1QzBFQUVIcEJBQkIzSUFFRVFFRUJFSHNGUVFBUWV3c2dBQXN3QUNBQVFROXhRUVIwSUFCQjhBRnhRUVIyY2lJQUJFQkJBQkI1QlVFQkVIa0xRUUFRZWtFQUVIZEJBQkI3SUFBTFFnRUJmMEVCUVFBZ0FFRUJjVUVCUmhzaEFTQUFRZjhCY1VFQmRpSUFCRUJCQUJCNUJVRUJFSGtMUVFBUWVrRUFFSGNnQVFSQVFRRVFld1ZCQUJCN0N5QUFDeVFBUVFFZ0FIUWdBWEZCL3dGeEJFQkJBQkI1QlVFQkVIa0xRUUFRZWtFQkVIY2dBUXVlQ0FFR2Z3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRUlieUlHSWdVRVFDQUZRUUZyRGdjQkFnTUVCUVlIQ0Fzak55RUJEQWNMSXpnaEFRd0dDeU01SVFFTUJRc2pPaUVCREFRTEl6c2hBUXdEQ3lNOElRRU1BZ3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlFSDhoQVF3QkN5TTJJUUVMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVhGQkJIVWlCU0lFQkVBZ0JFRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNnQUVFSFRBUi9RUUVoQWlBQkVKa0JCU0FBUVE5TUJIOUJBU0VDSUFFUW1nRUZRUUFMQ3lFRERBOExJQUJCRjB3RWYwRUJJUUlnQVJDYkFRVWdBRUVmVEFSL1FRRWhBaUFCRUp3QkJVRUFDd3NoQXd3T0N5QUFRU2RNQkg5QkFTRUNJQUVRblFFRklBQkJMMHdFZjBFQklRSWdBUkNlQVFWQkFBc0xJUU1NRFFzZ0FFRTNUQVIvUVFFaEFpQUJFSjhCQlNBQVFUOU1CSDlCQVNFQ0lBRVFvQUVGUVFBTEN5RUREQXdMSUFCQnh3Qk1CSDlCQVNFQ1FRQWdBUkNoQVFVZ0FFSFBBRXdFZjBFQklRSkJBU0FCRUtFQkJVRUFDd3NoQXd3TEN5QUFRZGNBVEFSL1FRRWhBa0VDSUFFUW9RRUZJQUJCM3dCTUJIOUJBU0VDUVFNZ0FSQ2hBUVZCQUFzTElRTU1DZ3NnQUVIbkFFd0VmMEVCSVFKQkJDQUJFS0VCQlNBQVFlOEFUQVIvUVFFaEFrRUZJQUVRb1FFRlFRQUxDeUVEREFrTElBQkI5d0JNQkg5QkFTRUNRUVlnQVJDaEFRVWdBRUgvQUV3RWYwRUJJUUpCQnlBQkVLRUJCVUVBQ3dzaEF3d0lDeUFBUVljQlRBUi9RUUVoQWlBQlFYNXhCU0FBUVk4QlRBUi9RUUVoQWlBQlFYMXhCVUVBQ3dzaEF3d0hDeUFBUVpjQlRBUi9RUUVoQWlBQlFYdHhCU0FBUVo4QlRBUi9RUUVoQWlBQlFYZHhCVUVBQ3dzaEF3d0dDeUFBUWFjQlRBUi9RUUVoQWlBQlFXOXhCU0FBUWE4QlRBUi9RUUVoQWlBQlFWOXhCVUVBQ3dzaEF3d0ZDeUFBUWJjQlRBUi9RUUVoQWlBQlFiOS9jUVVnQUVHL0FVd0VmMEVCSVFJZ0FVSC9mbkVGUVFBTEN5RUREQVFMSUFCQnh3Rk1CSDlCQVNFQ0lBRkJBWElGSUFCQnp3Rk1CSDlCQVNFQ0lBRkJBbklGUVFBTEN5RUREQU1MSUFCQjF3Rk1CSDlCQVNFQ0lBRkJCSElGSUFCQjN3Rk1CSDlCQVNFQ0lBRkJDSElGUVFBTEN5RUREQUlMSUFCQjV3Rk1CSDlCQVNFQ0lBRkJFSElGSUFCQjd3Rk1CSDlCQVNFQ0lBRkJJSElGUVFBTEN5RUREQUVMSUFCQjl3Rk1CSDlCQVNFQ0lBRkJ3QUJ5QlNBQVFmOEJUQVIvUVFFaEFpQUJRWUFCY2dWQkFBc0xJUU1MQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FHSWdRRVFDQUVRUUZyRGdjQkFnTUVCUVlIQ0FzZ0F5UTNEQWNMSUFNa09Bd0dDeUFESkRrTUJRc2dBeVE2REFRTElBTWtPd3dEQ3lBREpEd01BZ3NnQlVFRVNDSUVCSDhnQkFVZ0JVRUhTZ3NFUUNNOFFmOEJjU003UWY4QmNVRUlkSElnQXhCMUN3d0JDeUFESkRZTFFRUkJmeUFDR3d2dUF3QUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBRkhCRUFnQUVIQkFXc09Ed0VDRXdNRUJRWUhDQWtLQ3hJTURRNExJejFCQjNaQkFYRU5Fd3dQQ3lNK0VKZ0JRZi8vQTNFaEFDTStRUUpxUWYvL0EzRWtQaUFBUVlEK0EzRkJDSFVrTnlBQVFmOEJjU1E0UVFRUEN5TTlRUWQyUVFGeERRNE1FQXNqUFVFSGRrRUJjUTBOREE0TEl6NUJBbXRCLy84RGNTUStJejRqT0VIL0FYRWpOMEgvQVhGQkNIUnlFSDBNRHdzUWN4Q0xBUXdKQ3lNK1FRSnJRZi8vQTNFa1BpTStJejhRZlVFQUpEOE1EUXNqUFVFSGRrRUJjVUVCUncwTURBZ0xJejRRbUFGQi8vOERjU1EvSXo1QkFtcEIvLzhEY1NRK0RBc0xJejFCQjNaQkFYRkJBVVlOQ1F3SEN4QnpRZjhCY1JDaUFTRUFJejlCQVdwQi8vOERjU1EvSUFBUEN5TTlRUWQyUVFGeFFRRkhEUVVqUGtFQ2EwSC8vd054SkQ0alBpTS9RUUpxUWYvL0EzRVFmUXdIQ3hCekVJd0JEQUlMSXo1QkFtdEIvLzhEY1NRK0l6NGpQeEI5UVFna1B3d0dDMEYvRHdzalAwRUJha0gvL3dOeEpEOUJCQThMSXo0UW1BRkIvLzhEY1NRL0l6NUJBbXBCLy84RGNTUStRUXdQQ3lNL1FRSnFRZi8vQTNFa1AwRU1Ed3NqUGtFQ2EwSC8vd054SkQ0alBpTS9RUUpxUWYvL0EzRVFmUXNRZEVILy93TnhKRDhMUVFnTDB3TUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGSEJFQWdBRUhSQVdzT0R3RUNEUU1FQlFZSENBa05DZzBMREEwTEl6MUJCSFpCQVhFTkVRd09DeU0rRUpnQlFmLy9BM0VoQUNNK1FRSnFRZi8vQTNFa1BpQUFRWUQrQTNGQkNIVWtPU0FBUWY4QmNTUTZRUVFQQ3lNOVFRUjJRUUZ4RFEwTURnc2pQVUVFZGtFQmNRME1JejVCQW10Qi8vOERjU1ErSXo0alAwRUNha0gvL3dOeEVIME1EUXNqUGtFQ2EwSC8vd054SkQ0alBpTTZRZjhCY1NNNVFmOEJjVUVJZEhJUWZRd05DeEJ6RUk0QkRBZ0xJejVCQW10Qi8vOERjU1ErSXo0alB4QjlRUkFrUHd3TEN5TTlRUVIyUVFGeFFRRkhEUW9NQndzalBoQ1lBVUgvL3dOeEpEOUJBU1NSQVNNK1FRSnFRZi8vQTNFa1Bnd0pDeU05UVFSMlFRRnhRUUZHRFFjTUJnc2pQVUVFZGtFQmNVRUJSdzBGSXo1QkFtdEIvLzhEY1NRK0l6NGpQMEVDYWtILy93TnhFSDBNQmdzUWN4Q1BBUXdDQ3lNK1FRSnJRZi8vQTNFa1BpTStJejhRZlVFWUpEOE1CUXRCZnc4TEl6OUJBV3BCLy84RGNTUS9RUVFQQ3lNK0VKZ0JRZi8vQTNFa1B5TStRUUpxUWYvL0EzRWtQa0VNRHdzalAwRUNha0gvL3dOeEpEOUJEQThMRUhSQi8vOERjU1EvQzBFSUMvQUNBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFCUndSQUlBQkI0UUZyRGc4QkFnc0xBd1FGQmdjSUN3c0xDUW9MQ3hCelFmOEJjVUdBL2dOcUl6WVFkUXdMQ3lNK0VKZ0JRZi8vQTNFaEFDTStRUUpxUWYvL0EzRWtQaUFBUVlEK0EzRkJDSFVrT3lBQVFmOEJjU1E4UVFRUEN5TTRRWUQrQTJvak5oQjFRUVFQQ3lNK1FRSnJRZi8vQTNFa1BpTStJenhCL3dGeEl6dEIvd0Z4UVFoMGNoQjlRUWdQQ3hCekVKRUJEQWNMSXo1QkFtdEIvLzhEY1NRK0l6NGpQeEI5UVNBa1AwRUlEd3NRY3hDQkFVRVlkRUVZZFNFQUl6NGdBRUVCRUg0alBpQUFha0gvL3dOeEpENUJBQkI1UVFBUWVpTS9RUUZxUWYvL0EzRWtQMEVNRHdzalBFSC9BWEVqTzBIL0FYRkJDSFJ5SkQ5QkJBOExFSFJCLy84RGNTTTJFSFVqUDBFQ2FrSC8vd054SkQ5QkJBOExFSE1Ra2dFTUFnc2pQa0VDYTBILy93TnhKRDRqUGlNL0VIMUJLQ1EvUVFnUEMwRi9Ed3NqUDBFQmFrSC8vd054SkQ5QkJBdWtBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBVWNFUUNBQVFmRUJhdzRQQVFJRERRUUZCZ2NJQ1FvTkRRc01EUXNRYzBIL0FYRkJnUDREYWhCL1FmOEJjU1EyREEwTEl6NFFtQUZCLy84RGNTRUFJejVCQW1wQi8vOERjU1ErSUFCQmdQNERjVUVJZFNRMklBQkIvd0Z4SkQwTURRc2pPRUdBL2dOcUVIOUIvd0Z4SkRZTURBdEJBQ1NRQVF3TEN5TStRUUpyUWYvL0EzRWtQaU0rSXoxQi93RnhJelpCL3dGeFFRaDBjaEI5UVFnUEN4QnpFSlFCREFnTEl6NUJBbXRCLy84RGNTUStJejRqUHhCOVFUQWtQMEVJRHdzUWN4Q0JBU0VBUVFBUWVVRUFFSG9qUGlBQVFSaDBRUmgxSWdCQkFSQitJejRnQUdwQi8vOERjU0lBUVlEK0EzRkJDSFVrT3lBQVFmOEJjU1E4SXo5QkFXcEIvLzhEY1NRL1FRZ1BDeU04UWY4QmNTTTdRZjhCY1VFSWRISWtQa0VJRHdzUWRFSC8vd054RUg5Qi93RnhKRFlqUDBFQ2FrSC8vd054SkQ4TUJRdEJBU1NSQVF3RUN4QnpFSlVCREFJTEl6NUJBbXRCLy84RGNTUStJejRqUHhCOVFUZ2tQMEVJRHd0QmZ3OExJejlCQVdwQi8vOERjU1EvQzBFRUM5d0JBUUYvSXo5QkFXcEIvLzhEY1NRL0kwTUVRQ00vUVFGclFmLy9BM0VrUHdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVhGQkJIVWlBUVJBSUFGQkFVWU5BUUpBSUFGQkFtc09EUU1FQlFZSENBa0tDd3dORGc4QUN3d1BDeUFBRUlBQkR3c2dBQkNEQVE4TElBQVFoQUVQQ3lBQUVJVUJEd3NnQUJDR0FROExJQUFRaHdFUEN5QUFFSWdCRHdzZ0FCQ0pBUThMSUFBUWpRRVBDeUFBRUpBQkR3c2dBQkNUQVE4TElBQVFsZ0VQQ3lBQUVLTUJEd3NnQUJDa0FROExJQUFRcFFFUEN5QUFFS1lCQzcwQkFRSi9RUUFra0FGQmovNERFQUZCQVNBQWRFRi9jM0VpQVNSN1FZLytBeUFCRUFRalBrRUNhMEgvL3dOeEpENENRQ05CSWdFalFpQUJHdzBBQ3lNK0lnRWpQeUlDUWY4QmNSQUVJQUZCQVdvZ0FrR0EvZ054UVFoMUVBUUNRQUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVDUUNBQVFRSnJEZ01EQkFVQUN3d0ZDMEVBSkhaQndBQWtQd3dFQzBFQUpIZEJ5QUFrUHd3REMwRUFKSGhCMEFBa1B3d0NDMEVBSkhsQjJBQWtQd3dCQzBFQUpIcEI0QUFrUHdzTDlBRUJBMzhqa1FFRVFFRUJKSkFCUVFBa2tRRUxJM1VqZTNGQkgzRkJBRW9FUUNOQ1JTT1FBU0lDSUFJYkJIOGpkaU53SWdBZ0FCc0VmMEVBRUtnQlFRRUZJM2NqY1NJQUlBQWJCSDlCQVJDb0FVRUJCU040STNJaUFDQUFHd1IvUVFJUXFBRkJBUVVqZVNOeklnQWdBQnNFZjBFREVLZ0JRUUVGSTNvamRDSUFJQUFiQkg5QkJCQ29BVUVCQlVFQUN3c0xDd3NGUVFBTEJFQUNmMEVCSTBFaUFDTkNJQUFiRFFBYVFRQUxCSDlCQUNSQ1FRQWtRVUVBSkVOQkFDUkVRUmdGUVJRTElRRUxBbjlCQVNOQklnQWpRaUFBR3cwQUdrRUFDd1JBUVFBa1FrRUFKRUZCQUNSRFFRQWtSQXNnQVE4TFFRQUxxd0VCQW45QkFTUWxJME1FUUNNL0VBRkIvd0Z4RUtjQkVISkJBQ1JDUVFBa1FVRUFKRU5CQUNSRUN4Q3BBU0lCUVFCS0JFQWdBUkJ5QzBFRUlRQUNmMEVCSTBFaUFTTkNJQUViRFFBYVFRQUxSU0lCQkg4alJFVUZJQUVMQkVBalB4QUJRZjhCY1JDbkFTRUFDeU05UWZBQmNTUTlJQUJCQUV3RVFDQUFEd3NnQUJCeUk0NEJRUUZxSkk0Qkk0NEJJNHdCVGdSQUk0MEJRUUZxSkkwQkk0NEJJNHdCYXlTT0FRc2dBQXNFQUNOaEMrWUJBUVYvSUFCQmYwR0FDQ0FBUVFCSUd5QUFRUUJLR3lFRVFRQWhBQU5BQW44Q2Z5QUdSU0lDQkVBZ0FFVWhBZ3NnQWdzRVFDQUZSU0VDQ3lBQ0N3UkFJQU5GSVFJTElBSUVRQkNxQVVFQVNBUkFRUUVoQmdValFDTTFCSDlCb01rSUJVSFFwQVFMVGdSQVFRRWhBQVVnQkVGL1NpSUNCRUFqWVNBRVRpRUNDeUFDQkVCQkFTRUZCU0FCUVg5S0lnSUVRQ00vSUFGR0lRSUxRUUVnQXlBQ0d5RURDd3NMREFFTEN5QUFCRUFqUUNNMUJIOUJvTWtJQlVIUXBBUUxheVJBSS84QkR3c2dCUVJBSTRBQ0R3c2dBd1JBSTRFQ0R3c2pQMEVCYTBILy93TnhKRDlCZndzSkFFRi9RWDhRckFFTE9BRURmd05BSUFJZ0FFZ2lBd1JBSUFGQkFFNGhBd3NnQXdSQUVLMEJJUUVnQWtFQmFpRUNEQUVMQ3lBQlFRQklCRUFnQVE4TFFRQUxDUUJCZnlBQUVLd0JDd2tBSUFBZ0FSQ3NBUXNGQUNPSkFRc0ZBQ09LQVFzRkFDT0xBUXRmQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBQ0lCUVFGR0RRRUNRQ0FCUVFKckRnWURCQVVHQndnQUN3d0lDeVBoQVE4TEkrSUJEd3NqNHdFUEN5UGtBUThMSStVQkR3c2o1Z0VQQ3lQbkFROExJK2dCRHd0QkFBdUxBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQWlBa0VCUmcwQkFrQWdBa0VDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBVUVBUnlUaEFRd0hDeUFCUVFCSEpPSUJEQVlMSUFGQkFFY2s0d0VNQlFzZ0FVRUFSeVRrQVF3RUN5QUJRUUJISk9VQkRBTUxJQUZCQUVjazVnRU1BZ3NnQVVFQVJ5VG5BUXdCQ3lBQlFRQkhKT2dCQ3d0VEFRRi9RUUFrUkNBQUVMUUJSUVJBUVFFaEFRc2dBRUVCRUxVQklBRUVRRUVCUVFGQkFFRUJRUUFnQUVFRFRCc2lBU08yQVNJQUlBQWJHeUFCUlNPM0FTSUFJQUFiR3dSQVFRRWtla0VFRURrTEN3c0pBQ0FBUVFBUXRRRUxtZ0VBSUFCQkFFb0VRRUVBRUxZQkJVRUFFTGNCQ3lBQlFRQktCRUJCQVJDMkFRVkJBUkMzQVFzZ0FrRUFTZ1JBUVFJUXRnRUZRUUlRdHdFTElBTkJBRW9FUUVFREVMWUJCVUVERUxjQkN5QUVRUUJLQkVCQkJCQzJBUVZCQkJDM0FRc2dCVUVBU2dSQVFRVVF0Z0VGUVFVUXR3RUxJQVpCQUVvRVFFRUdFTFlCQlVFR0VMY0JDeUFIUVFCS0JFQkJCeEMyQVFWQkJ4QzNBUXNMQkFBak5nc0VBQ00zQ3dRQUl6Z0xCQUFqT1FzRUFDTTZDd1FBSXpzTEJBQWpQQXNFQUNNOUN3UUFJejhMQkFBalBnc0dBQ00vRUFFTEJBQWpUUXV2QXdFS2YwR0FnQUpCZ0pBQ0k3QUJHeUVKUVlDNEFrR0FzQUlqc1FFYklRb0RRQ0FGUVlBQ1NBUkFRUUFoQkFOQUlBUkJnQUpJQkVBZ0NTQUZRUU4xUVFWMElBcHFJQVJCQTNWcUlnTkJnSkIrYWkwQUFCQXJJUWdnQlVFSWJ5RUJRUWNnQkVFSWIyc2hCa0VBSVFJQ2Z5QUFRUUJLSXpFaUJ5QUhHd1JBSUFOQmdOQithaTBBQUNFQ0N5QUNRY0FBY1FzRVFFRUhJQUZySVFFTFFRQWhCeUFCUVFGMElBaHFJZ05CZ0pCK2FrRUJRUUFnQWtFSWNSc2lCMEVCY1VFTmRHb3RBQUFoQ0VFQUlRRWdBMEdCa0g1cUlBZEJBWEZCRFhScUxRQUFRUUVnQm5SeEJFQkJBaUVCQ3lBQlFRRnFJQUZCQVNBR2RDQUljUnNoQVNBRlFRaDBJQVJxUVFOc0lRWWdBRUVBU2lNeElnTWdBeHNFUUNBQ1FRZHhJQUZCQUJBc0lnRkJIM0ZCQTNRaEF5QUdRWUNZRG1vaUFpQURPZ0FBSUFKQkFXb2dBVUhnQjNGQkJYVkJBM1E2QUFBZ0FrRUNhaUFCUVlENEFYRkJDblZCQTNRNkFBQUZJQUZCeC80RFFRQVFMU0VDUVFBaEFRTkFJQUZCQTBnRVFDQUdRWUNZRG1vZ0FXb2dBam9BQUNBQlFRRnFJUUVNQVFzTEN5QUVRUUZxSVFRTUFRc0xJQVZCQVdvaEJRd0JDd3NMeUFFQkJuOENRQU5BSUFGQkYwNE5BVUVBSVFBRFFBSkFJQUJCSDA0TkFFRUFJUVJCQVVFQUlBQkJEMG9iSVFRZ0FTRUNJQUpCRDJzZ0FpQUJRUTlLRzBFRWRDRUNJQUJCRDJzZ0Ftb2dBQ0FDYWlBQVFROUtHeUVDUVlDQUFpRUZRWUNRQWtHQWdBSWdBVUVQU2hzaEJVRUFJUU1EUUFKQUlBTkJDRTROQUNBQ0lBVWdCRUVBUVFjZ0F5QUFRUU4wSUFGQkEzUWdBMnBCK0FGQmdKZ2FRUUZCZnhBdUdpQURRUUZxSVFNTUFRc0xJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUFBQ3dBTEN3UUFJMzBMQkFBamZnc0VBQ04vQ3hnQkFYOGpnUUVoQUNPQUFRUkFJQUJCQkhJaEFBc2dBQXN0QVFGL0FrQURRQ0FBUWYvL0Ewb05BU0FBUVlDQXJBUnFJQUFRVVRvQUFDQUFRUUZxSVFBTUFBQUxBQXNMRkFBL0FFR01BVWdFUUVHTUFUOEFhMEFBR2dzTEF3QUJDeDhBQWtBQ1FBSkFJNUFDRGdJQkFnQUxBQXRCQUNFQUN5QUFRWDhRckFFTEJ3QWdBQ1NRQWdzdkFBSkFBa0FDUUFKQUFrQWprQUlPQkFFQ0F3UUFDd0FMUVFFaEFBdEJmeUVCQzBGL0lRSUxJQUVnQWhDc0FRc0FNeEJ6YjNWeVkyVk5ZWEJ3YVc1blZWSk1JV052Y21VdlpHbHpkQzlqYjNKbExuVnVkRzkxWTJobFpDNTNZWE50TG0xaGNBPT0iKToKYXdhaXQgTCgiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJpQUVTWUFsL2YzOS9mMzkvZjM4QVlBQUFZQUYvQVg5Z0FuOS9BR0FCZndCZ0FuOS9BWDlnQUFGL1lBTi9mMzhCZjJBRGYzOS9BR0FHZjM5L2YzOS9BR0FIZjM5L2YzOS9md0YvWUFkL2YzOS9mMzkvQUdBRWYzOS9md0YvWUFoL2YzOS9mMzkvZndCZ0JYOS9mMzkvQVg5Z0RIOS9mMzkvZjM5L2YzOS9md0YvWUFBQVlBSi9md0YvQTlNQjBRRUNBZ0VCQXdFQkFRRUJBUUVCQVFRRUFRRUJBQVlCQVFFQkFRRUJBUVFFQVFFQkFRRUJBUUVHQmdZT0JRY0hEd29MQ1FrSUNBTUVBUUVFQVFRQkFRRUJBUUlDQlFJQ0FnSUZEQVFFQkFFQ0JnSUNBd1FFQkFRQkFRRUJCQVVFQmdZRUF3SUZCQUVRQkFVRENBRUZBUVFCQlFRRUJnWURCUVFEQkFRRUF3TUlBZ0lDQkFJQ0FnSUNBZ0lEQkFRQ0JBUUNCQVFDQkFRQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJRUJnWUdFUVlDQWdVR0JnWUNBd1FFRFFZR0JnWUdCZ1lHQmdZR0JnUUJCZ1lHQmdFQkFRSUVCd1FFQVhBQUFRVURBUUFBQnRRTGtRSi9BRUVBQzM4QVFZQ0FzQVFMZndCQmpBRUxmd0JCQUF0L0FFR0FDQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVILy93TUxmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FrQVFMZndCQmdPZ2ZDMzhBUVlDUUJBdC9BRUdBQkF0L0FFR0FvQVFMZndCQmdMZ0JDMzhBUVlEWUJRdC9BRUdBMkFVTGZ3QkJnSmdPQzM4QVFZQ0FEQXQvQUVHQW1Cb0xmd0JCZ0lBSkMzOEFRWUNZSXd0L0FFR0E0QUFMZndCQmdQZ2pDMzhBUVlDQUNBdC9BRUdBK0NzTGZ3QkJnSUFJQzM4QVFZRDRNd3QvQUVHQWlQZ0RDMzhBUVlDQXJBUUxmd0JCLy84REMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCei80REMzOEJRUUFMZndGQjhQNERDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWY4QUMzOEJRZjhBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZ0tqV3VRY0xmd0ZCQUF0L0FVRUFDMzhCUVlDbzFya0hDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRi9DMzhCUVg4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJnUGNDQzM4QlFZQ0FDQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFkWCtBd3QvQVVIUi9nTUxmd0ZCMHY0REMzOEJRZFArQXd0L0FVSFUvZ01MZndGQjZQNERDMzhCUWV2K0F3dC9BVUhwL2dNTGZ3RkJBQXQvQVVFQkMzOEJRUUlMZndCQmdJQ3dCQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVILy93TUxmd0JCZ0pBRUMzOEFRWUNRQkF0L0FFR0FCQXQvQUVHQTJBVUxmd0JCZ0pnT0MzOEFRWUNZR2d0L0FFR0ErQ01MZndCQmdQZ3JDMzhBUVlENE13dC9BVUVBQ3dmTUVHSUdiV1Z0YjNKNUFnQUZkR0ZpYkdVQkFBWmpiMjVtYVdjQUV3NW9ZWE5EYjNKbFUzUmhjblJsWkFBVUNYTmhkbVZUZEdGMFpRQWJDV3h2WVdSVGRHRjBaUUFtRW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFBbkMyZGxkRk4wWlhCVFpYUnpBQ2dJWjJWMFUzUmxjSE1BS1JWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUFyZ0VNWlhobFkzVjBaVVp5WVcxbEFLMEJDRjl6WlhSaGNtZGpBTThCR1dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzhBemdFYlpYaGxZM1YwWlVaeVlXMWxWVzUwYVd4Q2NtVmhhM0J2YVc1MEFLOEJLR1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOVZiblJwYkVKeVpXRnJjRzlwYm5RQXNBRVZaWGhsWTNWMFpWVnVkR2xzUTI5dVpHbDBhVzl1QU5BQkMyVjRaV04xZEdWVGRHVndBS29CRkdkbGRFTjVZMnhsYzFCbGNrTjVZMnhsVTJWMEFMRUJER2RsZEVONVkyeGxVMlYwY3dDeUFRbG5aWFJEZVdOc1pYTUFzd0VPYzJWMFNtOTVjR0ZrVTNSaGRHVUF1QUVmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnQ3JBUkJqYkdWaGNrRjFaR2x2UW5WbVptVnlBQ0lYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERBQk5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXdFU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF3SWVRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdNYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREJCWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdVU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3WWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJ4eEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2dTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdrT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQ2hGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNTERWZFBVa3RmVWtGTlgxTkpXa1VERENaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTU5JazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVUREaGhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNEREeFJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNUUZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9BeEVRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1TR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01URkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF4UU9SbEpCVFVWZlRFOURRVlJKVDA0REZRcEdVa0ZOUlY5VFNWcEZBeFlYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERGeE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhnU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4a09WRWxNUlY5RVFWUkJYMU5KV2tVREdoSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERHdzVQUVUxZlZFbE1SVk5mVTBsYVJRTWNGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZEVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF4NFdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNZkVrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTWdGa05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0RElSSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURJaDFFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNakdVUkZRbFZIWDBkQlRVVkNUMWxmVFVWTlQxSlpYMU5KV2tVREpDRm5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRQUFBeG5aWFJTWldkcGMzUmxja0VBdVFFTVoyVjBVbVZuYVhOMFpYSkNBTG9CREdkbGRGSmxaMmx6ZEdWeVF3QzdBUXhuWlhSU1pXZHBjM1JsY2tRQXZBRU1aMlYwVW1WbmFYTjBaWEpGQUwwQkRHZGxkRkpsWjJsemRHVnlTQUMrQVF4blpYUlNaV2RwYzNSbGNrd0F2d0VNWjJWMFVtVm5hWE4wWlhKR0FNQUJFV2RsZEZCeWIyZHlZVzFEYjNWdWRHVnlBTUVCRDJkbGRGTjBZV05yVUc5cGJuUmxjZ0RDQVJsblpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5QU1NQkJXZGxkRXhaQU1RQkhXUnlZWGRDWVdOclozSnZkVzVrVFdGd1ZHOVhZWE50VFdWdGIzSjVBTVVCR0dSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllUURHQVFablpYUkVTVllBeHdFSFoyVjBWRWxOUVFESUFRWm5aWFJVVFVFQXlRRUdaMlYwVkVGREFNb0JFM1Z3WkdGMFpVUmxZblZuUjBKTlpXMXZjbmtBeXdFR2RYQmtZWFJsQUswQkRXVnRkV3hoZEdsdmJsTjBaWEFBcWdFU1oyVjBRWFZrYVc5UmRXVjFaVWx1WkdWNEFLc0JEM0psYzJWMFFYVmthVzlSZFdWMVpRQWlEbmRoYzIxTlpXMXZjbmxUYVhwbEE0SUNISGRoYzIxQ2IzbEpiblJsY201aGJGTjBZWFJsVEc5allYUnBiMjREZ3dJWWQyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVlRhWHBsQTRRQ0hXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVXh2WTJGMGFXOXVBNFVDR1dkaGJXVkNiM2xKYm5SbGNtNWhiRTFsYlc5eWVWTnBlbVVEaGdJVGRtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnT0hBaUptY21GdFpVbHVVSEp2WjNKbGMzTldhV1JsYjA5MWRIQjFkRXh2WTJGMGFXOXVBNG9DRzJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWTWIyTmhkR2x2YmdPSUFoZG5ZVzFsWW05NVEyOXNiM0pRWVd4bGRIUmxVMmw2WlFPSkFoVmlZV05yWjNKdmRXNWtUV0Z3VEc5allYUnBiMjREaXdJTGRHbHNaVVJoZEdGTllYQURqQUlUYzI5MWJtUlBkWFJ3ZFhSTWIyTmhkR2x2YmdPTkFoRm5ZVzFsUW5sMFpYTk1iMk5oZEdsdmJnT1BBaFJuWVcxbFVtRnRRbUZ1YTNOTWIyTmhkR2x2YmdPT0FnZ0N6QUVKQ0FFQVFRQUxBYzBCQ3JMVEFkRUJ6QUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVF4MUlnRkZEUUFDUUNBQlFRRnJEZzBCQVFFQ0FnSUNBd01FQkFVR0FBc01CZ3NnQUVHQStETnFEd3NnQUVFQkl5OGlBQ013UlNJQkJIOGdBRVVGSUFFTEcwRU9kR3BCZ1BneWFnOExJQUJCZ0pCK2FpTXhCSDhqTWhBQlFRRnhCVUVBQzBFTmRHb1BDeUFBSXpOQkRYUnFRWUM0S1dvUEN5QUFRWUNRZm1vUEMwRUFJUUVDZnlNeEJFQWpOQkFCUVFkeElRRUxJQUZCQVVnTEJFQkJBU0VCQ3lBQlFReDBJQUJxUVlEd2ZXb1BDeUFBUVlCUWFnc0pBQ0FBRUFBdEFBQUxtUUVBUVFBa05VRUFKRFpCQUNRM1FRQWtPRUVBSkRsQkFDUTZRUUFrTzBFQUpEeEJBQ1E5UVFBa1BrRUFKRDlCQUNSQVFRQWtRVUVBSkVKQkFDUkRRUUFrUkNNeEJFQkJFU1EyUVlBQkpEMUJBQ1EzUVFBa09FSC9BU1E1UWRZQUpEcEJBQ1E3UVEwa1BBVkJBU1EyUWJBQkpEMUJBQ1EzUVJNa09FRUFKRGxCMkFFa09rRUJKRHRCelFBa1BBdEJnQUlrUDBIKy93TWtQZ3VrQVFFQ2YwRUFKRVZCQVNSR1FjY0NFQUVoQVVFQUpFZEJBQ1JJUVFBa1NVRUFKRXBCQUNRd0lBRUVRQ0FCUVFGT0lnQUVRQ0FCUVFOTUlRQUxJQUFFUUVFQkpFZ0ZJQUZCQlU0aUFBUkFJQUZCQmt3aEFBc2dBQVJBUVFFa1NRVWdBVUVQVGlJQUJFQWdBVUVUVENFQUN5QUFCRUJCQVNSS0JTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQUVRRUVCSkRBTEN3c0xCVUVCSkVjTFFRRWtMMEVBSkRNTEN3QWdBQkFBSUFFNkFBQUxMd0JCMGY0RFFmOEJFQVJCMHY0RFFmOEJFQVJCMC80RFFmOEJFQVJCMVA0RFFmOEJFQVJCMWY0RFFmOEJFQVFMbUFFQVFRQWtTMEVBSkV4QkFDUk5RUUFrVGtFQUpFOUJBQ1JRUVFBa1VTTXhCRUJCa0FFa1RVSEEvZ05Ca1FFUUJFSEIvZ05CZ1FFUUJFSEUvZ05Ca0FFUUJFSEgvZ05CL0FFUUJBVkJrQUVrVFVIQS9nTkJrUUVRQkVIQi9nTkJoUUVRQkVIRy9nTkIvd0VRQkVISC9nTkIvQUVRQkVISS9nTkIvd0VRQkVISi9nTkIvd0VRQkF0QnovNERRUUFRQkVIdy9nTkJBUkFFQzA4QUl6RUVRRUhvL2dOQndBRVFCRUhwL2dOQi93RVFCRUhxL2dOQndRRVFCRUhyL2dOQkRSQUVCVUhvL2dOQi93RVFCRUhwL2dOQi93RVFCRUhxL2dOQi93RVFCRUhyL2dOQi93RVFCQXNMTHdCQmtQNERRWUFCRUFSQmtmNERRYjhCRUFSQmt2NERRZk1CRUFSQmsvNERRY0VCRUFSQmxQNERRYjhCRUFRTExBQkJsZjREUWY4QkVBUkJsdjREUVQ4UUJFR1gvZ05CQUJBRVFaaitBMEVBRUFSQm1mNERRYmdCRUFRTE1nQkJtdjREUWY4QUVBUkJtLzREUWY4QkVBUkJuUDREUVo4QkVBUkJuZjREUVFBUUJFR2UvZ05CdUFFUUJFRUJKR0lMTFFCQm4vNERRZjhCRUFSQm9QNERRZjhCRUFSQm9mNERRUUFRQkVHaS9nTkJBQkFFUWFQK0EwRy9BUkFFQ3pnQVFROGtZMEVQSkdSQkR5UmxRUThrWmtFQUpHZEJBQ1JvUVFBa2FVRUFKR3BCL3dBa2EwSC9BQ1JzUVFFa2JVRUJKRzVCQUNSdkMyY0FRUUFrVWtFQUpGTkJBQ1JVUVFFa1ZVRUJKRlpCQVNSWFFRRWtXRUVCSkZsQkFTUmFRUUVrVzBFQkpGeEJBU1JkUVFBa1hrRUFKRjlCQUNSZ1FRQWtZUkFJRUFrUUNoQUxRYVQrQTBIM0FCQUVRYVgrQTBIekFSQUVRYWIrQTBIeEFSQUVFQXdMT0FBZ0FFRUJjVUVBUnlSd0lBQkJBbkZCQUVja2NTQUFRUVJ4UVFCSEpISWdBRUVJY1VFQVJ5UnpJQUJCRUhGQkFFY2tkQ0FBSkhVTE9BQWdBRUVCY1VFQVJ5UjJJQUJCQW5GQkFFY2tkeUFBUVFSeFFRQkhKSGdnQUVFSWNVRUFSeVI1SUFCQkVIRkJBRWNrZWlBQUpIc0xWd0JCQUNSOFFRQWtmVUVBSkg1QkFDUi9RUUFrZ0FGQkFDU0JBVUVBSklJQlFRQWtnd0VqTVFSQVFZVCtBMEVlRUFSQm9EMGtmUVZCaFA0RFFhc0JFQVJCek5jQ0pIMExRWWYrQTBINEFSQUVRZmdCSklFQkMwSUFRUUFraEFGQkFDU0ZBU014QkVCQmd2NERRZndBRUFSQkFDU0dBVUVBSkljQlFRQWtpQUVGUVlMK0EwSCtBQkFFUVFBa2hnRkJBU1NIQVVFQUpJZ0JDd3YxQVFFQ2YwSERBaEFCSWdGQndBRkdJZ0FFZnlBQUJTQUJRWUFCUmlNbklnQWdBQnNMQkVCQkFTUXhCVUVBSkRFTEVBSVFBeEFGRUFZUUJ4QU5RUUFRRGtILy93TWpkUkFFUWVFQkVBOUJqLzRESTNzUUJCQVFFQkVqTVFSQVFmRCtBMEg0QVJBRVFjLytBMEgrQVJBRVFjMytBMEgrQUJBRVFZRCtBMEhQQVJBRVFZLytBMEhoQVJBRVFleitBMEgrQVJBRVFmWCtBMEdQQVJBRUJVSHcvZ05CL3dFUUJFSFAvZ05CL3dFUUJFSE4vZ05CL3dFUUJFR0EvZ05CendFUUJFR1AvZ05CNFFFUUJBdEJBQ1FsUVlDbzFya0hKSWtCUVFBa2lnRkJBQ1NMQVVHQXFOYTVCeVNNQVVFQUpJMEJRUUFramdFTG5RRUFJQUJCQUVvRVFFRUJKQ1lGUVFBa0pnc2dBVUVBU2dSQVFRRWtKd1ZCQUNRbkN5QUNRUUJLQkVCQkFTUW9CVUVBSkNnTElBTkJBRW9FUUVFQkpDa0ZRUUFrS1FzZ0JFRUFTZ1JBUVFFa0tnVkJBQ1FxQ3lBRlFRQktCRUJCQVNRckJVRUFKQ3NMSUFaQkFFb0VRRUVCSkN3RlFRQWtMQXNnQjBFQVNnUkFRUUVrTFFWQkFDUXRDeUFJUVFCS0JFQkJBU1F1QlVFQUpDNExFQklMREFBakpRUkFRUUVQQzBFQUM3SUJBRUdBQ0NNMk9nQUFRWUVJSXpjNkFBQkJnZ2dqT0RvQUFFR0RDQ001T2dBQVFZUUlJem82QUFCQmhRZ2pPem9BQUVHR0NDTThPZ0FBUVljSUl6MDZBQUJCaUFnalBqc0JBRUdLQ0NNL093RUFRWXdJSTBBMkFnQWpRUVJBUVpFSVFRRTZBQUFGUVpFSVFRQTZBQUFMSTBJRVFFR1NDRUVCT2dBQUJVR1NDRUVBT2dBQUN5TkRCRUJCa3doQkFUb0FBQVZCa3doQkFEb0FBQXNqUkFSQVFaUUlRUUU2QUFBRlFaUUlRUUE2QUFBTEM2d0JBRUhJQ1NNdk93RUFRY29KSXpNN0FRQWpSUVJBUWN3SlFRRTZBQUFGUWN3SlFRQTZBQUFMSTBZRVFFSE5DVUVCT2dBQUJVSE5DVUVBT2dBQUN5TkhCRUJCemdsQkFUb0FBQVZCemdsQkFEb0FBQXNqU0FSQVFjOEpRUUU2QUFBRlFjOEpRUUE2QUFBTEkwa0VRRUhRQ1VFQk9nQUFCVUhRQ1VFQU9nQUFDeU5LQkVCQjBRbEJBVG9BQUFWQjBRbEJBRG9BQUFzak1BUkFRZElKUVFFNkFBQUZRZElKUVFBNkFBQUxDMGdBUWZvSkkzdzJBZ0JCL2dramZUWUNBQ09DQVFSQVFZSUtRUUU2QUFBRlFZSUtRUUE2QUFBTEk0TUJCRUJCaFFwQkFUb0FBQVZCaFFwQkFEb0FBQXRCaGY0REkzNFFCQXQ0QUNPU0FRUkFRZDRLUVFFNkFBQUZRZDRLUVFBNkFBQUxRZDhLSTVNQk5nSUFRZU1LSTVRQk5nSUFRZWNLSTVVQk5nSUFRZXdLSTVZQk5nSUFRZkVLSTVjQk9nQUFRZklLSTVnQk9nQUFJNWtCQkVCQjl3cEJBVG9BQUFWQjl3cEJBRG9BQUF0QitBb2ptZ0UyQWdCQi9Rb2ptd0U3QVFBTFR3QWpuQUVFUUVHUUMwRUJPZ0FBQlVHUUMwRUFPZ0FBQzBHUkN5T2RBVFlDQUVHVkN5T2VBVFlDQUVHWkN5T2ZBVFlDQUVHZUN5T2dBVFlDQUVHakN5T2hBVG9BQUVHa0N5T2lBVG9BQUF0R0FDT25BUVJBUWZRTFFRRTZBQUFGUWZRTFFRQTZBQUFMUWZVTEk2Z0JOZ0lBUWZrTEk2a0JOZ0lBUWYwTEk2b0JOZ0lBUVlJTUk2c0JOZ0lBUVljTUk2d0JPd0VBQzZNQkFCQVZRYklJSTB3MkFnQkJ0Z2dqandFNkFBQkJ4UDRESTAwUUJDT1FBUVJBUWVRSVFRRTZBQUFGUWVRSVFRQTZBQUFMSTVFQkJFQkI1UWhCQVRvQUFBVkI1UWhCQURvQUFBc1FGaEFYUWF3S0kxNDJBZ0JCc0Fvalh6b0FBRUd4Q2lOZ09nQUFFQmdRR1NPakFRUkFRY0lMUVFFNkFBQUZRY0lMUVFBNkFBQUxRY01MSTZRQk5nSUFRY2NMSTZVQk5nSUFRY3NMSTZZQk93RUFFQnBCQUNRbEM2NEJBRUdBQ0MwQUFDUTJRWUVJTFFBQUpEZEJnZ2d0QUFBa09FR0RDQzBBQUNRNVFZUUlMUUFBSkRwQmhRZ3RBQUFrTzBHR0NDMEFBQ1E4UVljSUxRQUFKRDFCaUFndkFRQWtQa0dLQ0M4QkFDUS9RWXdJS0FJQUpFQUNmMEVCUVpFSUxRQUFRUUJLRFFBYVFRQUxKRUVDZjBFQlFaSUlMUUFBUVFCS0RRQWFRUUFMSkVJQ2YwRUJRWk1JTFFBQVFRQktEUUFhUVFBTEpFTUNmMEVCUVpRSUxRQUFRUUJLRFFBYVFRQUxKRVFMWEFFQmYwRUFKRXhCQUNSTlFjVCtBMEVBRUFSQndmNERFQUZCZkhFaEFVRUFKSThCUWNIK0F5QUJFQVFnQUFSQUFrQkJBQ0VBQTBBZ0FFR0E2QjlPRFFFZ0FFR0FrQVJxUWY4Qk9nQUFJQUJCQVdvaEFBd0FBQXNBQ3dzTGlBRUJBWDhqclFFaEFTQUFRWUFCY1VFQVJ5U3RBU0FBUWNBQWNVRUFSeVN1QVNBQVFTQnhRUUJISks4QklBQkJFSEZCQUVja3NBRWdBRUVJY1VFQVJ5U3hBU0FBUVFSeFFRQkhKTElCSUFCQkFuRkJBRWNrc3dFZ0FFRUJjVUVBUnlTMEFTT3RBVVVnQVNBQkd3UkFRUUVRSFFzZ0FVVWlBQVIvSTYwQkJTQUFDd1JBUVFBUUhRc0xQZ0FDZjBFQlFlUUlMUUFBUVFCS0RRQWFRUUFMSkpBQkFuOUJBVUhsQ0MwQUFFRUFTZzBBR2tFQUN5U1JBVUgvL3dNUUFSQU9RWS8rQXhBQkVBOExwUUVBUWNnSkx3RUFKQzlCeWdrdkFRQWtNd0ovUVFGQnpBa3RBQUJCQUVvTkFCcEJBQXNrUlFKL1FRRkJ6UWt0QUFCQkFFb05BQnBCQUFza1JnSi9RUUZCemdrdEFBQkJBRW9OQUJwQkFBc2tSd0ovUVFGQnp3a3RBQUJCQUVvTkFCcEJBQXNrU0FKL1FRRkIwQWt0QUFCQkFFb05BQnBCQUFza1NRSi9RUUZCMFFrdEFBQkJBRW9OQUJwQkFBc2tTZ0ovUVFGQjBna3RBQUJCQUVvTkFCcEJBQXNrTUF0WEFFSDZDU2dDQUNSOFFmNEpLQUlBSkgwQ2YwRUJRWUlLTFFBQVFRQktEUUFhUVFBTEpJSUJBbjlCQVVHRkNpMEFBRUVBU2cwQUdrRUFDeVNEQVVHRi9nTVFBU1IrUVliK0F4QUJKSDlCaC80REVBRWtnUUVMQmdCQkFDUmhDM1lBQW45QkFVSGVDaTBBQUVFQVNnMEFHa0VBQ3lTU0FVSGZDaWdDQUNTVEFVSGpDaWdDQUNTVUFVSG5DaWdDQUNTVkFVSHNDaWdDQUNTV0FVSHhDaTBBQUNTWEFVSHlDaTBBQUNTWUFRSi9RUUZCOXdvdEFBQkJBRW9OQUJwQkFBc2ttUUZCK0Fvb0FnQWttZ0ZCL1FvdkFRQWttd0VMVGdBQ2YwRUJRWkFMTFFBQVFRQktEUUFhUVFBTEpKd0JRWkVMS0FJQUpKMEJRWlVMS0FJQUpKNEJRWmtMS0FJQUpKOEJRWjRMS0FJQUpLQUJRYU1MTFFBQUpLRUJRYVFMTFFBQUpLSUJDMFVBQW45QkFVSDBDeTBBQUVFQVNnMEFHa0VBQ3lTbkFVSDFDeWdDQUNTb0FVSDVDeWdDQUNTcEFVSDlDeWdDQUNTcUFVR0NEQ2dDQUNTckFVR0hEQzhCQUNTc0FRdlFBUUVCZnhBY1FiSUlLQUlBSkV4QnRnZ3RBQUFrandGQnhQNERFQUVrVFVIQS9nTVFBUkFlRUI5QmdQNERFQUZCL3dGekpMVUJJN1VCSWdCQkVIRkJBRWNrdGdFZ0FFRWdjVUVBUnlTM0FSQWdFQ0ZCckFvb0FnQWtYa0d3Q2kwQUFDUmZRYkVLTFFBQUpHQkJBQ1JoRUNNUUpBSi9RUUZCd2dzdEFBQkJBRW9OQUJwQkFBc2tvd0ZCd3dzb0FnQWtwQUZCeHdzb0FnQWtwUUZCeXdzdkFRQWtwZ0VRSlVFQUpDVkJnS2pXdVFja2lRRkJBQ1NLQVVFQUpJc0JRWUNvMXJrSEpJd0JRUUFralFGQkFDU09BUXNGQUNPTUFRc0ZBQ09OQVFzRkFDT09BUXZZQWdFRmZ3Si9BbjhnQVVFQVNpSUZCRUFnQUVFSVNpRUZDeUFGQ3dSQUk3a0JJQVJHSVFVTElBVUxCSDhqdWdFZ0FFWUZJQVVMQkVCQkFDRUZRUUFoQkNBRFFRRnJFQUZCSUhFRVFFRUJJUVVMSUFNUUFVRWdjUVJBUVFFaEJBdEJBQ0VEQTBBZ0EwRUlTQVJBUVFjZ0Eyc2dBeUFFSUFWSEd5SURJQUJxUWFBQlRBUkFJQUJCQ0NBRGEyc2hCeUFBSUFOcUlBRkJvQUZzYWtFRGJFR0EyQVZxSVFsQkFDRUdBMEFnQmtFRFNBUkFJQUFnQTJvZ0FVR2dBV3hxUVFOc1FZRFlCV29nQm1vZ0JpQUphaTBBQURvQUFDQUdRUUZxSVFZTUFRc0xJQUFnQTJvZ0FVR2dBV3hxUVlDZ0JHb2dBVUdnQVd3Z0IycEJnS0FFYWkwQUFDSUdRUU54SWdkQkJISWdCeUFHUVFSeEd6b0FBQ0FJUVFGcUlRZ0xJQU5CQVdvaEF3d0JDd3NGSUFRa3VRRUxJQUFqdWdGT0JFQWdBRUVJYWlTNkFTQUFJQUpCQ0c4aUJFZ0VRQ082QVNBRWFpUzZBUXNMSUFnTE9BRUJmeUFBUVlDUUFrWUVRQ0FCUVlBQmFpRUNJQUZCZ0FGeEJFQWdBVUdBQVdzaEFnc2dBa0VFZENBQWFnOExJQUZCQkhRZ0FHb0xTZ0FnQUVFRGRDQUJRUUYwYWlJQVFRRnFRVDl4SWdGQlFHc2dBU0FDRzBHQWtBUnFMUUFBSVFFZ0FFRS9jU0lBUVVCcklBQWdBaHRCZ0pBRWFpMEFBQ0FCUWY4QmNVRUlkSElMVVFBZ0FrVUVRQ0FCRUFFZ0FFRUJkSFZCQTNFaEFBdEI4Z0VoQVFKQUlBQkZEUUFDUUFKQUFrQUNRQ0FBUVFGckRnTUJBZ01BQ3d3REMwR2dBU0VCREFJTFFkZ0FJUUVNQVF0QkNDRUJDeUFCQytFQ0FRZC9JQUVnQUJBcklBVkJBWFJxSWdCQmdKQithaUFDUVFGeFFRMTBJZ0ZxTFFBQUlSRWdBRUdCa0g1cUlBRnFMUUFBSVJJZ0F5RUFBMEFnQUNBRVRBUkFJQUFnQTJzZ0Jtb2lEU0FJU0FSQVFRY2dBR3NoQlNBTFFRQklJZ0lFZnlBQ0JTQUxRU0J4UlFzaEFVRUFJUUlDZjBFQklBVWdBQ0FCR3lJQmRDQVNjUVJBUVFJaEFnc2dBa0VCYWdzZ0FrRUJJQUYwSUJGeEd5RUNJQXRCQUU0RWZ5QUxRUWR4SUFKQkFCQXNJZ1ZCSDNGQkEzUWhEaUFGUWVBSGNVRUZkVUVEZENFQklBVkJnUGdCY1VFS2RVRURkQVVnQWtISC9nTWdEeUFQUVFCTUd5SVBJQW9RTFNJRklRNGdCU0lCQ3lFRklBY2dDR3dnRFdwQkEyd2dDV29pRUNBT09nQUFJQkJCQVdvZ0FUb0FBQ0FRUVFKcUlBVTZBQUFnQjBHZ0FXd2dEV3BCZ0tBRWFpQUNRUU54SWdGQkJISWdBU0FMUVlBQmNVRUFSMEVBSUF0QkFFNGJHem9BQUNBTVFRRnFJUXdMSUFCQkFXb2hBQXdCQ3dzZ0RBdCtBUU4vSUFOQkNHOGhBeUFBUlFSQUlBSWdBa0VJYlVFRGRHc2hCd3RCb0FFZ0FHdEJCeUFBUVFocVFhQUJTaHNoQ1VGL0lRSWpNUVJBSUFSQmdOQithaTBBQUNJQ1FRaHhCRUJCQVNFSUN5QUNRY0FBY1FSQVFRY2dBMnNoQXdzTElBWWdCU0FJSUFjZ0NTQURJQUFnQVVHZ0FVR0EyQVZCQUNBQ0VDNExwZ0lBSUFVZ0JoQXJJUVlnQTBFSWJ5RURJQVJCZ05CK2FpMEFBQ0lFUWNBQWNRUi9RUWNnQTJzRklBTUxRUUYwSUFacUlnTkJnSkIrYWtFQlFRQWdCRUVJY1J0QkFYRkJEWFFpQldvdEFBQWhCaUFEUVlHUWZtb2dCV290QUFBaEJTQUNRUWh2SVFOQkFDRUNJQUZCb0FGc0lBQnFRUU5zUVlEWUJXb2dCRUVIY1FKL1FRRWdBMEVISUFOcklBUkJJSEViSWdOMElBVnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQm5FYklnSkJBQkFzSWdOQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnZGdGYWlBRFFlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQzJBVnFJQU5CZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FvQVJxSUFKQkEzRWlBRUVFY2lBQUlBUkJnQUZ4R3pvQUFBdTFBUUFnQkNBRkVDc2dBMEVJYjBFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURZQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkNHOXJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0EwRUFFQzBpQWpvQUFDQUJRYUFCYkNBQWFrRURiRUdCMkFWcUlBSTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmd0Z0ZhaUFDT2dBQUlBRkJvQUZzSUFCcVFZQ2dCR29nQTBFRGNUb0FBQXZWQVFFR2Z5QURRUU4xSVFzRFFDQUVRYUFCU0FSQUlBUWdCV29pQmtHQUFrNEVRQ0FHUVlBQ2F5RUdDeUFMUVFWMElBSnFJQVpCQTNWcUlnbEJnSkIrYWkwQUFDRUlRUUFoQ2lNdUJFQWdCQ0FBSUFZZ0NTQUlFQ29pQjBFQVNnUkFRUUVoQ2lBSFFRRnJJQVJxSVFRTEN5QUtSU010SWdjZ0J4c0VRQ0FFSUFBZ0JpQURJQWtnQVNBSUVDOGlCMEVBU2dSQUlBZEJBV3NnQkdvaEJBc0ZJQXBGQkVBak1RUkFJQVFnQUNBR0lBTWdDU0FCSUFnUU1BVWdCQ0FBSUFZZ0F5QUJJQWdRTVFzTEN5QUVRUUZxSVFRTUFRc0xDeXNCQVg4alRpRURJQUFnQVNBQ0kwOGdBR29pQUVHQUFrNEVmeUFBUVlBQ2F3VWdBQXRCQUNBREVESUxNQUVEZnlOUUlRTWdBQ05SSWdSSUJFQVBDeUFEUVFkcklnTkJmMndoQlNBQUlBRWdBaUFBSUFScklBTWdCUkF5QzhRRkFROS9Ba0JCSnlFSkEwQWdDVUVBU0EwQklBbEJBblFpQkVHQS9BTnFFQUVoQWlBRVFZSDhBMm9RQVNFS0lBUkJndndEYWhBQklRTWdBa0VRYXlFQ0lBcEJDR3NoQ2tFSUlRVWdBUVJBUVJBaEJTQURRUUp2UVFGR0JIOGdBMEVCYXdVZ0F3c2hBd3NnQUNBQ1RpSUdCRUFnQUNBQ0lBVnFTQ0VHQ3lBR0JFQWdCRUdEL0FOcUVBRWlCa0dBQVhGQkFFY2hDeUFHUVNCeFFRQkhJUTVCZ0lBQ0lBTVFLeUFBSUFKcklnSWdCV3RCZjJ4QkFXc2dBaUFHUWNBQWNSdEJBWFJxSWdOQmdKQitha0VCUVFBZ0JrRUljVUVBUnlNeElnSWdBaHNiUVFGeFFRMTBJZ0pxTFFBQUlROGdBMEdCa0g1cUlBSnFMUUFBSVJCQkJ5RUZBMEFnQlVFQVRnUkFRUUFoQ0FKL1FRRWdCU0lDUVFkclFYOXNJQUlnRGhzaUFuUWdFSEVFUUVFQ0lRZ0xJQWhCQVdvTElBaEJBU0FDZENBUGNSc2lDQVJBUVFjZ0JXc2dDbW9pQjBFQVRpSUNCRUFnQjBHZ0FVd2hBZ3NnQWdSQVFRQWhERUVBSVExQkFVRUFJN1FCUlNNeElnTWdBeHNiSWdKRkJFQWdBRUdnQVd3Z0IycEJnS0FFYWkwQUFDSURRUU54SWdSQkFFb2dDeUFMR3dSQVFRRWhEQVVnQTBFRWNVRUFSeU14SWdNZ0F4c2lBd1JBSUFSQkFFb2hBd3RCQVVFQUlBTWJJUTBMQ3lBQ1JRUkFJQXhGSWdRRWZ5QU5SUVVnQkFzaEFnc2dBZ1JBSXpFRVFDQUFRYUFCYkNBSGFrRURiRUdBMkFWcUlBWkJCM0VnQ0VFQkVDd2lCRUVmY1VFRGREb0FBQ0FBUWFBQmJDQUhha0VEYkVHQjJBVnFJQVJCNEFkeFFRVjFRUU4wT2dBQUlBQkJvQUZzSUFkcVFRTnNRWUxZQldvZ0JFR0ErQUZ4UVFwMVFRTjBPZ0FBQlNBQVFhQUJiQ0FIYWtFRGJFR0EyQVZxSUFoQnlmNERRY2orQXlBR1FSQnhHMEVBRUMwaUF6b0FBQ0FBUWFBQmJDQUhha0VEYkVHQjJBVnFJQU02QUFBZ0FFR2dBV3dnQjJwQkEyeEJndGdGYWlBRE9nQUFDd3NMQ3lBRlFRRnJJUVVNQVFzTEN5QUpRUUZySVFrTUFBQUxBQXNMWmdFQ2YwR0FrQUloQVVHQWdBSkJnSkFDSTdBQkd5RUJJekVqdEFFak1Sc0VRRUdBc0FJaEFpQUFJQUZCZ0xnQ1FZQ3dBaU94QVJzUU13c2pyd0VFUUVHQXNBSWhBaUFBSUFGQmdMZ0NRWUN3QWlPdUFSc1FOQXNqc3dFRVFDQUFJN0lCRURVTEN5VUJBWDhDUUFOQUlBQkJrQUZMRFFFZ0FFSC9BWEVRTmlBQVFRRnFJUUFNQUFBTEFBc0xSZ0VDZndOQUlBRkJrQUZPUlFSQVFRQWhBQU5BSUFCQm9BRklCRUFnQVVHZ0FXd2dBR3BCZ0tBRWFrRUFPZ0FBSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN3c2NBUUYvUVkvK0F4QUJRUUVnQUhSeUlnRWtlMEdQL2dNZ0FSQUVDd29BUVFFa2QwRUJFRGtMUlFFQ2YwR1UvZ01RQVVINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBRVFaVCtBeUFCSUFCQkNIVWlBSElRQkNBQ0pNWUJJQUFreHdFanhnRWp4d0ZCQ0hSeUpNZ0JDMllCQW44am13RWlBU1BFQVhVaEFDQUJJQUJySUFBZ0FXb2p4UUViSWdCQi93OU1JZ0VFZnlQRUFVRUFTZ1VnQVFzRVFDQUFKSnNCSUFBUU95T2JBU0lCSThRQmRTRUFJQUVnQUdzZ0FDQUJhaVBGQVJzaEFBc2dBRUgvRDBvRVFFRUFKSklCQ3dzc0FDT2FBVUVCYXlTYUFTT2FBVUVBVEFSQUk4TUJKSm9CSThNQlFRQktJNWtCSTVrQkd3UkFFRHdMQ3d0YkFRRi9JNVFCUVFGckpKUUJJNVFCUVFCTUJFQWp5UUVrbEFFamxBRUVRQ09XQVVFUFNDUEtBU1BLQVJzRVFDT1dBVUVCYWlTV0FRVWp5Z0ZGSWdBRVFDT1dBVUVBU2lFQUN5QUFCRUFqbGdGQkFXc2tsZ0VMQ3dzTEMxc0JBWDhqbmdGQkFXc2tuZ0VqbmdGQkFFd0VRQ1BMQVNTZUFTT2VBUVJBSTZBQlFROUlJOHdCSTh3Qkd3UkFJNkFCUVFGcUpLQUJCU1BNQVVVaUFBUkFJNkFCUVFCS0lRQUxJQUFFUUNPZ0FVRUJheVNnQVFzTEN3c0xXd0VCZnlPcEFVRUJheVNwQVNPcEFVRUFUQVJBSTgwQkpLa0JJNmtCQkVBanF3RkJEMGdqemdFanpnRWJCRUFqcXdGQkFXb2txd0VGSTg0QlJTSUFCRUFqcXdGQkFFb2hBQXNnQUFSQUk2c0JRUUZySktzQkN3c0xDd3VPQmdBalhpQUFhaVJlSTE0ak5RUi9RWUNBQVFWQmdNQUFDMDRFUUNOZUl6VUVmMEdBZ0FFRlFZREFBQXRySkY0Q1FBSkFBa0FDUUFKQUkyQWlBQVJBSUFCQkFtc09CZ0VGQWdVREJBVUxJNVVCUVFCS0lnQUVmeU8vQVFVZ0FBc0VRQ09WQVVFQmF5U1ZBUXNqbFFGRkJFQkJBQ1NTQVFzam53RkJBRW9pQUFSL0k4QUJCU0FBQ3dSQUk1OEJRUUZySko4QkN5T2ZBVVVFUUVFQUpKd0JDeU9sQVVFQVNpSUFCSDhqd1FFRklBQUxCRUFqcFFGQkFXc2twUUVMSTZVQlJRUkFRUUFrb3dFTEk2b0JRUUJLSWdBRWZ5UENBUVVnQUFzRVFDT3FBVUVCYXlTcUFRc2pxZ0ZGQkVCQkFDU25BUXNNQkFzamxRRkJBRW9pQUFSL0k3OEJCU0FBQ3dSQUk1VUJRUUZySkpVQkN5T1ZBVVVFUUVFQUpKSUJDeU9mQVVFQVNpSUFCSDhqd0FFRklBQUxCRUFqbndGQkFXc2tud0VMSTU4QlJRUkFRUUFrbkFFTEk2VUJRUUJLSWdBRWZ5UEJBUVVnQUFzRVFDT2xBVUVCYXlTbEFRc2pwUUZGQkVCQkFDU2pBUXNqcWdGQkFFb2lBQVIvSThJQkJTQUFDd1JBSTZvQlFRRnJKS29CQ3lPcUFVVUVRRUVBSktjQkN4QTlEQU1MSTVVQlFRQktJZ0FFZnlPL0FRVWdBQXNFUUNPVkFVRUJheVNWQVFzamxRRkZCRUJCQUNTU0FRc2pud0ZCQUVvaUFBUi9JOEFCQlNBQUN3UkFJNThCUVFGckpKOEJDeU9mQVVVRVFFRUFKSndCQ3lPbEFVRUFTaUlBQkg4andRRUZJQUFMQkVBanBRRkJBV3NrcFFFTEk2VUJSUVJBUVFBa293RUxJNm9CUVFCS0lnQUVmeVBDQVFVZ0FBc0VRQ09xQVVFQmF5U3FBUXNqcWdGRkJFQkJBQ1NuQVFzTUFnc2psUUZCQUVvaUFBUi9JNzhCQlNBQUN3UkFJNVVCUVFGckpKVUJDeU9WQVVVRVFFRUFKSklCQ3lPZkFVRUFTaUlBQkg4andBRUZJQUFMQkVBam53RkJBV3NrbndFTEk1OEJSUVJBUVFBa25BRUxJNlVCUVFCS0lnQUVmeVBCQVFVZ0FBc0VRQ09sQVVFQmF5U2xBUXNqcFFGRkJFQkJBQ1NqQVFzanFnRkJBRW9pQUFSL0k4SUJCU0FBQ3dSQUk2b0JRUUZySktvQkN5T3FBVVVFUUVFQUpLY0JDeEE5REFFTEVENFFQeEJBQ3lOZ1FRRnFKR0FqWUVFSVRnUkFRUUFrWUF0QkFROExRUUFMZ3dFQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBZ0FDSUJRUUpHRFFFZ0FVRURSZzBDSUFGQkJFWU5Bd3dFQ3lObkk5QUJSd1JBSTlBQkpHZEJBUThMUVFBUEN5Tm9JOUVCUndSQUk5RUJKR2hCQVE4TFFRQVBDeU5wSTlJQlJ3UkFJOUlCSkdsQkFROExRUUFQQ3lOcUk5TUJSd1JBSTlNQkpHcEJBUThMUVFBUEMwRUFDMVVBQWtBQ1FBSkFJQUJCQVVjRVFDQUFRUUpHRFFFZ0FFRURSZzBDREFNTFFRRWdBWFJCZ1FGeFFRQkhEd3RCQVNBQmRFR0hBWEZCQUVjUEMwRUJJQUYwUWY0QWNVRUFSdzhMUVFFZ0FYUkJBWEZCQUVjTGlnRUJBWDhqa3dFZ0FHc2trd0Vqa3dGQkFFd0VRQ09UQVNJQlFSOTFJUUJCZ0JBanlBRnJRUUowSkpNQkl6VUVRQ09UQVVFQmRDU1RBUXNqa3dFZ0FDQUJhaUFBYzJza2t3RWptQUZCQVdva21BRWptQUZCQ0U0RVFFRUFKSmdCQ3dzajBBRWprZ0VpQUNBQUd3Ui9JNVlCQlVFUER3c2oxd0VqbUFFUVF3Ui9RUUVGUVg4TGJFRVBhZ3VLQVFFQmZ5T2RBU0FBYXlTZEFTT2RBVUVBVEFSQUk1MEJJZ0ZCSDNVaEFFR0FFQ1BZQVd0QkFuUWtuUUVqTlFSQUk1MEJRUUYwSkowQkN5T2RBU0FBSUFGcUlBQnpheVNkQVNPaUFVRUJhaVNpQVNPaUFVRUlUZ1JBUVFBa29nRUxDeVBSQVNPY0FTSUFJQUFiQkg4am9BRUZRUThQQ3lQWkFTT2lBUkJEQkg5QkFRVkJmd3RzUVE5cUM1a0NBUUovSTZRQklBQnJKS1FCSTZRQlFRQk1CRUFqcEFFaUFrRWZkU0VBUVlBUUk5b0JhMEVCZENTa0FTTTFCRUFqcEFGQkFYUWtwQUVMSTZRQklBQWdBbW9nQUhOckpLUUJJNllCUVFGcUpLWUJJNllCUVNCT0JFQkJBQ1NtQVFzTFFRQWhBaVBiQVNFQUk5SUJJNk1CSWdFZ0FSc0VRQ05pQkVCQm5QNERFQUZCQlhWQkQzRWlBQ1RiQVVFQUpHSUxCVUVQRHdzanBnRkJBbTFCc1A0RGFoQUJJUUVqcGdGQkFtOEVmeUFCUVE5eEJTQUJRUVIxUVE5eEN5RUJBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BU0FBUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEFnd0NDeUFCUVFGMUlRRkJBaUVDREFFTElBRkJBblVoQVVFRUlRSUxJQUpCQUVvRWZ5QUJJQUp0QlVFQUMwRVBhZ3VyQVFFQmZ5T29BU0FBYXlTb0FTT29BVUVBVEFSQUk2Z0JJUUFqM0FFajNRRjBJZ0ZCQVhRZ0FTTTFHeVNvQVNPb0FTQUFRUjkxSWdFZ0FDQUJhbk5ySktnQkk2d0JJZ0JCQVhFaEFTQUFRUUYxSWdBa3JBRWpyQUVnQVNBQVFRRnhjeUlCUVE1MGNpU3NBU1BlQVFSQUk2d0JRYjkvY1NTc0FTT3NBU0FCUVFaMGNpU3NBUXNMSTlNQkk2Y0JJZ0FnQUJzRWZ5T3JBUVZCRHc4TFFYOUJBU09zQVVFQmNSdHNRUTlxQ3pBQUlBQkJQRVlFUUVIL0FBOExJQUJCUEd0Qm9JMEdiQ0FCYkVFSWJVR2dqUVp0UVR4cVFhQ05CbXhCalBFQ2JRdWNBUUVCZjBFQUpHMGdBRUVQSTFVYklnUWdBV29nQkVFUGFpTldHeUlFSUFKcUlBUkJEMm9qVnhzaEJDQURJQUlnQVNBQVFROGpXUnNpQUdvZ0FFRVBhaU5hR3lJQWFpQUFRUTlxSTFzYklnQnFJQUJCRDJvalhCc2hBRUVBSkc1QkFDUnZJQU1nQkdvZ0JFRVBhaU5ZR3lOVFFRRnFFRWdoQVNBQUkxUkJBV29RU0NFQUlBRWtheUFBSkd3Z0FFSC9BWEVnQVVIL0FYRkJDSFJ5QzhJREFRVi9BbjhqendFZ0FHb2t6d0ZCQUNPVEFTUFBBV3RCQUVvTkFCcEJBUXNpQVVVRVFFRUJFRUloQVFzQ2Z5UFVBU0FBYWlUVUFVRUFJNTBCSTlRQmEwRUFTZzBBR2tFQkN5SUVSUVJBUVFJUVFpRUVDd0ovSTlVQklBQnFKTlVCSTZRQkk5VUJhMEVBU2lJQ0JFQWpZa1VoQWd0QkFDQUNEUUFhUVFFTElnSkZCRUJCQXhCQ0lRSUxBbjhqMWdFZ0FHb2sxZ0ZCQUNPb0FTUFdBV3RCQUVvTkFCcEJBUXNpQlVVRVFFRUVFRUloQlFzZ0FRUkFJODhCSVFOQkFDVFBBU0FERUVRa1l3c2dCQVJBSTlRQklRTkJBQ1RVQVNBREVFVWtaQXNnQWdSQUk5VUJJUU5CQUNUVkFTQURFRVlrWlFzZ0JRUkFJOVlCSVFOQkFDVFdBU0FERUVja1pnc0NmeUFCSUFRZ0FSc2lBVVVFUUNBQ0lRRUxJQUZGQ3dSQUlBVWhBUXNnQVFSQVFRRWtid3NqWHlQZkFTQUFiR29rWHlOZlFZQ0FnQVJCZ0lDQUFpTTFHMDRFUUNOZlFZQ0FnQVJCZ0lDQUFpTTFHMnNrWHlOdklnQWpiU0FBR3lJQlJRUkFJMjRoQVFzZ0FRUkFJMk1qWkNObEkyWVFTUm9MSTJFaUFVRUJkRUdBK0NOcUlnQWphMEVDYWpvQUFDQUFRUUZxSTJ4QkFtbzZBQUFnQVVFQmFpUmhJMkVqNEFGQkFtMUJBV3RPQkVBallVRUJheVJoQ3dzTHRBRUJCSDhnQUJCRUlRRWdBQkJGSVFJZ0FCQkdJUU1nQUJCSElRUWdBU1JqSUFJa1pDQURKR1VnQkNSbUkxOGozd0VnQUd4cUpGOGpYMEdBZ0lBRVFZQ0FnQUlqTlJ0T0JFQWpYMEdBZ0lBRVFZQ0FnQUlqTlJ0ckpGOGdBU0FDSUFNZ0JCQkpJUUFqWVNJQlFRRjBRWUQ0STJvaUFpQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0FrRUJhaUFBUWY4QmNVRUNham9BQUNBQlFRRnFKR0VqWVNQZ0FVRUNiVUVCYTA0RVFDTmhRUUZySkdFTEN3c2VBUUYvSUFBUVFTRUJJQUZGSXl3akxCc0VRQ0FBRUVvRklBQVFTd3NMU3dBalVpTTFCSDlCcmdFRlFkY0FDMGdFUUE4TEEwQWpVaU0xQkg5QnJnRUZRZGNBQzA0RVFDTTFCSDlCcmdFRlFkY0FDeEJNSTFJak5RUi9RYTRCQlVIWEFBdHJKRklNQVFzTEN5RUFJQUJCcHY0RFJnUkFRYWIrQXhBQlFZQUJjU0VBSUFCQjhBQnlEd3RCZnd1Y0FRRUJmeU8xQVNFQUk3WUJCRUFnQUVGN2NTQUFRUVJ5SStFQkd5RUFJQUJCZm5FZ0FFRUJjaVBpQVJzaEFDQUFRWGR4SUFCQkNISWo0d0ViSVFBZ0FFRjljU0FBUVFKeUkrUUJHeUVBQlNPM0FRUkFJQUJCZm5FZ0FFRUJjaVBsQVJzaEFDQUFRWDF4SUFCQkFuSWo1Z0ViSVFBZ0FFRjdjU0FBUVFSeUkrY0JHeUVBSUFCQmQzRWdBRUVJY2lQb0FSc2hBQXNMSUFCQjhBRnlDOHNDQVFGL0lBQkJnSUFDU0FSQVFYOFBDeUFBUVlDQUFrNGlBUVIvSUFCQmdNQUNTQVVnQVFzRVFFRi9Ed3NnQUVHQXdBTk9JZ0VFZnlBQVFZRDhBMGdGSUFFTEJFQWdBRUdBUUdvUUFROExJQUJCZ1B3RFRpSUJCSDhnQUVHZi9RTk1CU0FCQ3dSQUk0OEJRUUpJQkVCQi93RVBDMEYvRHdzZ0FFSE4vZ05HQkVCQi93RWhBVUhOL2dNUUFVRUJjVVVFUUVIK0FTRUJDeU0xUlFSQUlBRkIvMzV4SVFFTElBRVBDeUFBUWNUK0EwWUVRQ0FBSTAwUUJDTk5Ed3NnQUVHUS9nTk9JZ0VFZnlBQVFhYitBMHdGSUFFTEJFQVFUU0FBRUU0UEN5QUFRYkQrQTA0aUFRUi9JQUJCdi80RFRBVWdBUXNFUUJCTlFYOFBDeUFBUVlUK0EwWUVRQ0FBSTMxQmdQNERjVUVJZFNJQkVBUWdBUThMSUFCQmhmNERSZ1JBSUFBamZoQUVJMzRQQ3lBQVFZLytBMFlFUUNON1FlQUJjZzhMSUFCQmdQNERSZ1JBRUU4UEMwRi9DeHNCQVg4Z0FCQlFJZ0ZCZjBZRVFDQUFFQUVQQ3lBQlFmOEJjUXUyQWdFQmZ5TkhCRUFQQ3lBQVFmOC9UQVJBSTBrRWZ5QUJRUkJ4UlFValNRdEZCRUFnQVVFUGNTSUNCRUFnQWtFS1JnUkFRUUVrUlFzRlFRQWtSUXNMQlNBQVFmLy9BRXdFUUNNd1JTSUNCSDhnQWdVZ0FFSC8zd0JNQ3dSQUkwa0VRQ0FCUVE5eEpDOExJQUVoQWlOSUJFQWdBa0VmY1NFQ0l5OUI0QUZ4SkM4Rkkwb0VRQ0FDUWY4QWNTRUNJeTlCZ0FGeEpDOEZJekFFUUVFQUpDOExDd3NqTHlBQ2NpUXZCU012UWY4QmNVRUJRUUFnQVVFQVNodEIvd0Z4UVFoMGNpUXZDd1VqU1VVaUFnUi9JQUJCLzc4QlRBVWdBZ3NFUUNOR0kwZ2lBQ0FBR3dSQUl5OUJIM0VrTHlNdklBRkI0QUZ4Y2lRdkR3c2dBVUVQY1NBQlFRTnhJekFiSkRNRkkwbEZJZ0lFZnlBQVFmLy9BVXdGSUFJTEJFQWpTQVJBSUFGQkFYRUVRRUVCSkVZRlFRQWtSZ3NMQ3dzTEN3c3NBQ0FBUVFSMVFROXhKTzBCSUFCQkNIRkJBRWNreWdFZ0FFRUhjU1RKQVNBQVFmZ0JjVUVBU2lUUUFRc3NBQ0FBUVFSMVFROXhKTzRCSUFCQkNIRkJBRWNrekFFZ0FFRUhjU1RMQVNBQVFmZ0JjVUVBU2lUUkFRc3NBQ0FBUVFSMVFROXhKUEFCSUFCQkNIRkJBRWNremdFZ0FFRUhjU1ROQVNBQVFmZ0JjVUVBU2lUVEFRdUJBUUVCZnlBQVFRUjFKTjBCSUFCQkNIRkJBRWNrM2dFZ0FFRUhjU1QxQVFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FqOVFFaUFRUkFJQUZCQVdzT0J3RUNBd1FGQmdjSUMwRUlKTndCRHd0QkVDVGNBUThMUVNBazNBRVBDMEV3Sk53QkR3dEJ3QUFrM0FFUEMwSFFBQ1RjQVE4TFFlQUFKTndCRHd0QjhBQWszQUVMQzRNQkFRRi9RUUVra2dFamxRRkZCRUJCd0FBa2xRRUxRWUFRSThnQmEwRUNkQ1NUQVNNMUJFQWprd0ZCQVhRa2t3RUxJOGtCSkpRQkkrMEJKSllCSThnQkpKc0JJOE1CSWdBa21nRWdBRUVBU2lJQUJIOGp4QUZCQUVvRklBQUxCRUJCQVNTWkFRVkJBQ1NaQVFzanhBRkJBRW9FUUJBOEN5UFFBVVVFUUVFQUpKSUJDd3RIQUVFQkpKd0JJNThCUlFSQVFjQUFKSjhCQzBHQUVDUFlBV3RCQW5Ra25RRWpOUVJBSTUwQlFRRjBKSjBCQ3lQTEFTU2VBU1B1QVNTZ0FTUFJBVVVFUUVFQUpKd0JDd3RBQUVFQkpLTUJJNlVCUlFSQVFZQUNKS1VCQzBHQUVDUGFBV3RCQVhRa3BBRWpOUVJBSTZRQlFRRjBKS1FCQzBFQUpLWUJJOUlCUlFSQVFRQWtvd0VMQzBrQkFYOUJBU1NuQVNPcUFVVUVRRUhBQUNTcUFRc2ozQUVqM1FGMElnQkJBWFFnQUNNMUd5U29BU1BOQVNTcEFTUHdBU1NyQVVILy93RWtyQUVqMHdGRkJFQkJBQ1NuQVFzTFZBQWdBRUdBQVhGQkFFY2tXQ0FBUWNBQWNVRUFSeVJYSUFCQklIRkJBRWNrVmlBQVFSQnhRUUJISkZVZ0FFRUljVUVBUnlSY0lBQkJCSEZCQUVja1d5QUFRUUp4UVFCSEpGb2dBRUVCY1VFQVJ5UlpDNGdGQVFGL0lBQkJwdjREUnlJQ0JFQWpYVVVoQWdzZ0FnUkFRUUFQQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFrR1EvZ05IQkVBZ0FrR1IvZ05yRGhZQ0Jnb09GUU1IQ3c4QkJBZ01FQlVGQ1EwUkVoTVVGUXNnQVVId0FIRkJCSFVrd3dFZ0FVRUljVUVBUnlURkFTQUJRUWR4Sk1RQkRCVUxJQUZCZ0FGeFFRQkhKTklCREJRTElBRkJCblZCQTNFazF3RWdBVUUvY1NUcEFVSEFBQ1BwQVdza2xRRU1Fd3NnQVVFR2RVRURjU1RaQVNBQlFUOXhKT29CUWNBQUkrb0JheVNmQVF3U0N5QUJKT3NCUVlBQ0krc0JheVNsQVF3UkN5QUJRVDl4Sk93QlFjQUFJK3dCYXlTcUFRd1FDeUFCRUZNTUR3c2dBUkJVREE0TFFRRWtZaUFCUVFWMVFROXhKTzhCREEwTElBRVFWUXdNQ3lBQkpNWUJJOFlCSThjQlFRaDBjaVRJQVF3TEN5QUJKUEVCSS9FQkkvSUJRUWgwY2lUWUFRd0tDeUFCSlBNQkkvTUJJL1FCUVFoMGNpVGFBUXdKQ3lBQkVGWU1DQXNnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVMvQVNBQlFRZHhKTWNCSThZQkk4Y0JRUWgwY2lUSUFSQlhDd3dIQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISk1BQklBRkJCM0VrOGdFajhRRWo4Z0ZCQ0hSeUpOZ0JFRmdMREFZTElBRkJnQUZ4QkVBZ0FVSEFBSEZCQUVja3dRRWdBVUVIY1NUMEFTUHpBU1AwQVVFSWRISWsyZ0VRV1FzTUJRc2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5VENBUkJhQ3d3RUN5QUJRUVIxUVFkeEpGTWdBVUVIY1NSVVFRRWtiUXdEQ3lBQkVGdEJBU1J1REFJTElBRkJnQUZ4UVFCSEpGMGdBVUdBQVhGRkJFQUNRRUdRL2dNaEFnTkFJQUpCcHY0RFRnMEJJQUpCQUJBRUlBSkJBV29oQWd3QUFBc0FDd3NNQVF0QkFROExRUUVMUEFFQmZ5QUFRUWgwSVFGQkFDRUFBMEFDUUNBQVFaOEJTZzBBSUFCQmdQd0RhaUFBSUFGcUVBRVFCQ0FBUVFGcUlRQU1BUXNMUVlRRkpMZ0JDeU1CQVg4aitBRVFBU0VBSS9rQkVBRkIvd0Z4SUFCQi93RnhRUWgwY2tIdy93TnhDeWNCQVg4aitnRVFBU0VBSS9zQkVBRkIvd0Z4SUFCQi93RnhRUWgwY2tId1AzRkJnSUFDYWd1REFRRURmeU14UlFSQUR3c2dBRUdBQVhGRkk3c0JJN3NCR3dSQVFRQWt1d0VqOXdFUUFVR0FBWEloQUNQM0FTQUFFQVFQQ3hCZUlRRVFYeUVDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKTHNCSUFNa3ZBRWdBU1M5QVNBQ0pMNEJJL2NCSUFCQi8zNXhFQVFGSUFFZ0FpQURFR29qOXdGQi93RVFCQXNMWWdFRGZ5UCtBU0FBUmlJQ1JRUkFJLzBCSUFCR0lRSUxJQUlFUUNBQVFRRnJJZ01RQVVHL2YzRWlBa0UvY1NJRVFVQnJJQVJCQVVFQUkvMEJJQUJHR3h0QmdKQUVhaUFCT2dBQUlBSkJnQUZ4QkVBZ0F5QUNRUUZxUVlBQmNoQUVDd3NMUEFFQmZ3SkFBa0FDUUFKQUlBQUVRQ0FBSWdGQkFVWU5BU0FCUVFKR0RRSWdBVUVEUmcwRERBUUxRUWtQQzBFRER3dEJCUThMUVFjUEMwRUFDeTBCQVg5QkFTT0JBUkJpSWdKMElBQnhRUUJISWdBRWYwRUJJQUowSUFGeFJRVWdBQXNFUUVFQkR3dEJBQXVFQVFFQ2Z3TkFJQUVnQUVnRVFDQUJRUVJxSVFFamZTSUNRUVJxSkgwamZVSC8vd05LQkVBamZVR0FnQVJySkgwTEk0QUJCRUFqZ2dFRVFDTi9KSDVCQVNSNFFRSVFPVUVBSklJQlFRRWtnd0VGSTRNQkJFQkJBQ1NEQVFzTElBSWpmUkJqQkVBamZrRUJhaVIrSTM1Qi93RktCRUJCQVNTQ0FVRUFKSDRMQ3dzTUFRc0xDd29BSTN3UVpFRUFKSHdMUUFFQmZ5TjlJUUJCQUNSOVFZVCtBMEVBRUFRamdBRUVmeUFBSTMwUVl3VWpnQUVMQkVBamZrRUJhaVIrSTM1Qi93RktCRUJCQVNTQ0FVRUFKSDRMQ3d0NUFRSi9JNEFCSVFFZ0FFRUVjVUVBUnlTQUFTQUFRUU54SVFJZ0FVVUVRQ09CQVJCaUlRQWdBaEJpSVFFamdBRUVmeU45UVFFZ0FIUnhCU045UVFFZ0FIUnhRUUJISWdBRWZ5TjlRUUVnQVhSeEJTQUFDd3NFUUNOK1FRRnFKSDRqZmtIL0FVb0VRRUVCSklJQlFRQWtmZ3NMQ3lBQ0pJRUJDODRHQVFGL0FrQUNRQ0FBUWMzK0EwWUVRRUhOL2dNZ0FVRUJjUkFFREFFTElBQkJnSUFDU0FSQUlBQWdBUkJTREFFTElBQkJnSUFDVGlJQ0JFQWdBRUdBd0FKSUlRSUxJQUlOQVNBQVFZREFBMDRpQWdSQUlBQkJnUHdEU0NFQ0N5QUNCRUFnQUVHQVFHb2dBUkFFREFJTElBQkJnUHdEVGlJQ0JFQWdBRUdmL1FOTUlRSUxJQUlFUUNPUEFVRUNTQTBCREFJTElBQkJvUDBEVGlJQ0JFQWdBRUgvL1FOTUlRSUxJQUlOQUNBQVFZTCtBMFlFUUNBQlFRRnhRUUJISklZQklBRkJBbkZCQUVja2h3RWdBVUdBQVhGQkFFY2tpQUZCQVE4TElBQkJrUDREVGlJQ0JFQWdBRUdtL2dOTUlRSUxJQUlFUUJCTklBQWdBUkJjRHdzZ0FFR3cvZ05PSWdJRVFDQUFRYi8rQTB3aEFnc2dBZ1JBRUUwTElBQkJ3UDREVGlJQ0JFQWdBRUhML2dOTUlRSUxJQUlFUUNBQVFjRCtBMFlFUUNBQkVCNE1Bd3NnQUVIQi9nTkdCRUJCd2Y0RElBRkIrQUZ4UWNIK0F4QUJRUWR4Y2tHQUFYSVFCQXdDQ3lBQVFjVCtBMFlFUUVFQUpFMGdBRUVBRUFRTUFnc2dBRUhGL2dOR0JFQWdBU1QyQVF3REN5QUFRY2IrQTBZRVFDQUJFRjBNQXdzQ1FBSkFBa0FDUUNBQUlnSkJ3LzREUndSQUlBSkJ3djREYXc0S0FRUUVCQVFFQkFRREFnUUxJQUVrVGd3R0N5QUJKRThNQlFzZ0FTUlFEQVFMSUFFa1VRd0RDd3dDQ3lQM0FTQUFSZ1JBSUFFUVlBd0JDeU0wSUFCR0lnSkZCRUFqTWlBQVJpRUNDeUFDQkVBanV3RUVRQUovSTcwQlFZQ0FBVTRpQWdSQUk3MEJRZi8vQVV3aEFnc2dBa1VMQkVBanZRRkJnS0FEVGlJQ0JFQWp2UUZCLzc4RFRDRUNDd3NnQWcwQ0N3c2dBQ1A4QVU0aUFnUkFJQUFqL1FGTUlRSUxJQUlFUUNBQUlBRVFZUXdDQ3lBQVFZVCtBMDRpQWdSQUlBQkJoLzREVENFQ0N5QUNCRUFRWlFKQUFrQUNRQUpBSUFBaUFrR0UvZ05IQkVBZ0FrR0YvZ05yRGdNQkFnTUVDeEJtREFVTEFrQWpnQUVFUUNPREFRMEJJNElCQkVCQkFDU0NBUXNMSUFFa2Znc01CUXNnQVNSL0k0TUJJNEFCSWdBZ0FCc0VRQ04vSkg1QkFDU0RBUXNNQkFzZ0FSQm5EQU1MREFJTElBQkJnUDREUmdSQUlBRkIvd0Z6SkxVQkk3VUJJZ0pCRUhGQkFFY2t0Z0VnQWtFZ2NVRUFSeVMzQVFzZ0FFR1AvZ05HQkVBZ0FSQVBEQUlMSUFCQi8vOERSZ1JBSUFFUURnd0NDMEVCRHd0QkFBOExRUUVMRVFBZ0FDQUJFR2dFUUNBQUlBRVFCQXNMWUFFRGZ3TkFBa0FnQXlBQ1RnMEFJQUFnQTJvUVVTRUZJQUVnQTJvaEJBTkFJQVJCLzc4Q1NnUkFJQVJCZ0VCcUlRUU1BUXNMSUFRZ0JSQnBJQU5CQVdvaEF3d0JDd3RCSUNFREk3Z0JJQUpCRUcxQndBQkJJQ00xRzJ4cUpMZ0JDMmNCQVg4anV3RkZCRUFQQ3lPOUFTTytBU084QVNJQVFSQWdBRUVRU0JzaUFCQnFJNzBCSUFCcUpMMEJJNzRCSUFCcUpMNEJJN3dCSUFCckpMd0JJN3dCUVFCTUJFQkJBQ1M3QVNQM0FVSC9BUkFFQlNQM0FTTzhBVUVRYlVFQmEwSC9mbkVRQkFzTFJnRUNmeVAyQVNFREFuOGdBRVVpQWtVRVFDQUFRUUZHSVFJTElBSUxCSDhqVFNBRFJnVWdBZ3NFUUNBQlFRUnlJZ0ZCd0FCeEJFQVFPZ3NGSUFGQmUzRWhBUXNnQVF1Q0FnRURmeU90QVVVRVFBOExJNDhCSVFBZ0FDTk5JZ0pCa0FGT0JIOUJBUVVqVENNMUJIOUI4QVVGUWZnQ0MwNEVmMEVDQlVFRFFRQWpUQ00xQkg5QjhnTUZRZmtCQzA0YkN3c2lBVWNFUUVIQi9nTVFBU0VBSUFFa2p3RkJBQ0VDQWtBQ1FBSkFBa0FnQVFSQUlBRkJBV3NPQXdFQ0F3UUxJQUJCZkhFaUFFRUljVUVBUnlFQ0RBTUxJQUJCZlhGQkFYSWlBRUVRY1VFQVJ5RUNEQUlMSUFCQmZuRkJBbklpQUVFZ2NVRUFSeUVDREFFTElBQkJBM0loQUFzZ0FnUkFFRG9MSUFGRkJFQVFhd3NnQVVFQlJnUkFRUUVrZGtFQUVEa0xRY0grQXlBQklBQVFiQkFFQlNBQ1Faa0JSZ1JBUWNIK0F5QUJRY0grQXhBQkVHd1FCQXNMQzdRQkFDT3RBUVJBSTB3Z0FHb2tUQU5BSTB3Q2Z5TTFCRUJCQ0NOTlFaa0JSZzBCR2tHUUJ3d0JDMEVFSTAxQm1RRkdEUUFhUWNnREMwNEVRQ05NQW44ak5RUkFRUWdqVFVHWkFVWU5BUnBCa0FjTUFRdEJCQ05OUVprQlJnMEFHa0hJQXd0ckpFd2pUU0lBUVpBQlJnUkFJeXNFUUJBM0JTQUFFRFlMRURoQmZ5UzVBVUYvSkxvQkJTQUFRWkFCU0FSQUl5dEZCRUFnQUJBMkN3c0xRUUFnQUVFQmFpQUFRWmtCU2hza1RRd0JDd3NMRUcwTHN3RUFJMHNDZnlNMUJFQkJDQ05OUVprQlJnMEJHa0dRQnd3QkMwRUVJMDFCbVFGR0RRQWFRY2dEQzBnRVFBOExBMEFqU3dKL0l6VUVRRUVJSTAxQm1RRkdEUUVhUVpBSERBRUxRUVFqVFVHWkFVWU5BQnBCeUFNTFRnUkFBbjhqTlFSQVFRZ2pUVUdaQVVZTkFScEJrQWNNQVF0QkJDTk5RWmtCUmcwQUdrSElBd3NRYmlOTEFuOGpOUVJBUVFnalRVR1pBVVlOQVJwQmtBY01BUXRCQkNOTlFaa0JSZzBBR2tISUF3dHJKRXNNQVFzTEN6TUJBWDlCQVNPSEFRUi9RUUlGUVFjTElnSjBJQUJ4UVFCSElnQUVmMEVCSUFKMElBRnhSUVVnQUFzRVFFRUJEd3RCQUF1VkFRRUNmeU9JQVVVRVFBOExBMEFnQVNBQVNBUkFJQUZCQkdvaEFTT0VBU0lDUVFScUpJUUJJNFFCUWYvL0Ewb0VRQ09FQVVHQWdBUnJKSVFCQ3lBQ0k0UUJFSEFFUUVHQi9nTkJnZjRERUFGQkFYUkJBV3BCL3dGeEVBUWpoUUZCQVdva2hRRWpoUUZCQ0VZRVFFRUFKSVVCUVFFa2VVRURFRGxCZ3Y0RFFZTCtBeEFCUWY5K2NSQUVRUUFraUFFTEN3d0JDd3NMaGdFQUk3Z0JRUUJLQkVBanVBRWdBR29oQUVFQUpMZ0JDeU5BSUFCcUpFQWpSRVVFUUNNcEJFQWpTeUFBYWlSTEVHOEZJQUFRYmdzaktBUkFJMUlnQUdva1VnVWdBQkJNQ3lBQUVIRUxJeW9FUUNOOElBQnFKSHdRWlFVZ0FCQmtDeU9MQVNBQWFpU0xBU09MQVNPSkFVNEVRQ09LQVVFQmFpU0tBU09MQVNPSkFXc2tpd0VMQ3dvQVFRUVFjaU0vRUFFTEpnRUJmMEVFRUhJalAwRUJha0gvL3dOeEVBRWhBQkJ6UWY4QmNTQUFRZjhCY1VFSWRISUxEQUJCQkJCeUlBQWdBUkJwQ3pBQkFYOUJBU0FBZEVIL0FYRWhBaUFCUVFCS0JFQWpQU0FDY2tIL0FYRWtQUVVqUFNBQ1FmOEJjM0VrUFFzalBRc0pBRUVGSUFBUWRob0xTUUVCZnlBQlFRQk9CRUFnQUVFUGNTQUJRUTl4YWtFUWNRUkFRUUVRZHdWQkFCQjNDd1VnQVVFZmRTSUNJQUVnQW1welFROXhJQUJCRDNGTEJFQkJBUkIzQlVFQUVIY0xDd3NKQUVFSElBQVFkaG9MQ1FCQkJpQUFFSFlhQ3drQVFRUWdBQkIyR2dzN0FRSi9JQUZCZ1A0RGNVRUlkU0VDSUFCQkFXb2hBeUFBSUFGQi93RnhJZ0VRYUFSQUlBQWdBUkFFQ3lBRElBSVFhQVJBSUFNZ0FoQUVDd3NNQUVFSUVISWdBQ0FCRUh3TGRRQWdBZ1JBSUFFZ0FFSC8vd054SWdCcUlBQWdBWE56SWdKQkVIRUVRRUVCRUhjRlFRQVFkd3NnQWtHQUFuRUVRRUVCRUhzRlFRQVFld3NGSUFBZ0FXcEIvLzhEY1NJQ0lBQkIvLzhEY1VrRVFFRUJFSHNGUVFBUWV3c2dBQ0FCY3lBQ2MwR0FJSEVFUUVFQkVIY0ZRUUFRZHdzTEN3b0FRUVFRY2lBQUVGRUxrQVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMREJNTEVIUkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa055QUFRZjhCY1NRNERCRUxJemhCL3dGeEl6ZEIvd0Z4UVFoMGNpTTJFSFVNRVFzak9FSC9BWEVqTjBIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkRjTUVRc2pOMEVCRUhnak4wRUJha0gvQVhFa055TTNCRUJCQUJCNUJVRUJFSGtMUVFBUWVnd1BDeU0zUVg4UWVDTTNRUUZyUWY4QmNTUTNJemNFUUVFQUVIa0ZRUUVRZVF0QkFSQjZEQTRMRUhOQi93RnhKRGNNQ3dzak5rR0FBWEZCZ0FGR0JFQkJBUkI3QlVFQUVIc0xJellpQUVFQmRDQUFRZjhCY1VFSGRuSkIvd0Z4SkRZTUNRc1FkRUgvL3dOeEl6NFFmUXdLQ3lNOFFmOEJjU003UWY4QmNVRUlkSElpQUNNNFFmOEJjU00zUWY4QmNVRUlkSElpQVVFQUVINGdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1E3SUFCQi93RnhKRHhCQUJCNlFRZ1BDeU00UWY4QmNTTTNRZjhCY1VFSWRISVFmMEgvQVhFa05nd0pDeU00UWY4QmNTTTNRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtOd3dKQ3lNNFFRRVFlQ000UVFGcVFmOEJjU1E0SXpnRVFFRUFFSGtGUVFFUWVRdEJBQkI2REFjTEl6aEJmeEI0SXpoQkFXdEIvd0Z4SkRnak9BUkFRUUFRZVFWQkFSQjVDMEVCRUhvTUJnc1FjMEgvQVhFa09Bd0RDeU0yUVFGeFFRQkxCRUJCQVJCN0JVRUFFSHNMSXpZaUFFRUhkQ0FBUWY4QmNVRUJkbkpCL3dGeEpEWU1BUXRCZnc4TFFRQVFlVUVBRUhwQkFCQjNEQUlMSXo5QkFXcEIvLzhEY1NRL0RBRUxJejlCQW1wQi8vOERjU1EvQzBFRUR3c2dBRUgvQVhFa09FRUlDeWdCQVg4Z0FFRVlkRUVZZFNJQlFZQUJjUVJBUVlBQ0lBQkJHSFJCR0hWclFYOXNJUUVMSUFFTEtRRUJmeUFBRUlFQklRRWpQeUFCUVJoMFFSaDFha0gvL3dOeEpEOGpQMEVCYWtILy93TnhKRDhMMWdVQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkVFY0VRQ0FBUVJGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TXhCRUJCemY0REVIOUIvd0Z4SWdCQkFYRUVRRUhOL2dNZ0FFRitjU0lBUVlBQmNRUi9RUUFrTlNBQVFmOStjUVZCQVNRMUlBQkJnQUZ5Q3hCMVFjUUFEd3NMUVFFa1JBd1JDeEIwUWYvL0EzRWlBRUdBL2dOeFFRaDFKRGtnQUVIL0FYRWtPaU0vUVFKcVFmLy9BM0VrUHd3UkN5TTZRZjhCY1NNNVFmOEJjVUVJZEhJak5oQjFEQkFMSXpwQi93RnhJemxCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1E1REJBTEl6bEJBUkI0SXpsQkFXcEIvd0Z4SkRrak9RUkFRUUFRZVFWQkFSQjVDMEVBRUhvTURnc2pPVUYvRUhnak9VRUJhMEgvQVhFa09TTTVCRUJCQUJCNUJVRUJFSGtMUVFFUWVnd05DeEJ6UWY4QmNTUTVEQXNMUVFGQkFDTTJJZ0ZCZ0FGeFFZQUJSaHNoQUNNOVFRUjJRUUZ4SUFGQkFYUnlRZjhCY1NRMkRBa0xFSE1RZ2dGQkNBOExJenhCL3dGeEl6dEIvd0Z4UVFoMGNpSUFJenBCL3dGeEl6bEIvd0Z4UVFoMGNpSUJRUUFRZmlBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpEc2dBRUgvQVhFa1BFRUFFSHBCQ0E4TEl6cEIvd0Z4SXpsQi93RnhRUWgwY2hCL1FmOEJjU1EyREFnTEl6cEIvd0Z4SXpsQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNRNURBZ0xJenBCQVJCNEl6cEJBV3BCL3dGeEpEb2pPZ1JBUVFBUWVRVkJBUkI1QzBFQUVIb01CZ3NqT2tGL0VIZ2pPa0VCYTBIL0FYRWtPaU02QkVCQkFCQjVCVUVCRUhrTFFRRVFlZ3dGQ3hCelFmOEJjU1E2REFNTFFRRkJBQ00ySWdGQkFYRkJBVVliSVFBalBVRUVka0VCY1VFSGRDQUJRZjhCY1VFQmRuSWtOZ3dCQzBGL0R3c2dBQVJBUVFFUWV3VkJBQkI3QzBFQUVIbEJBQkI2UVFBUWR3d0JDeU0vUVFGcVFmLy9BM0VrUHd0QkJBOExJQUJCL3dGeEpEcEJDQXUzQmdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRU0JIQkVBZ0FFRWhhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqUFVFSGRrRUJjUVJBSXo5QkFXcEIvLzhEY1NRL0JSQnpFSUlCQzBFSUR3c1FkRUgvL3dOeElnQkJnUDREY1VFSWRTUTdJQUJCL3dGeEpEd2pQMEVDYWtILy93TnhKRDhNRUFzalBFSC9BWEVqTzBIL0FYRkJDSFJ5SWdBak5oQjFJQUJCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrT3lBQVFmOEJjU1E4REE4TEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2tFQmFrSC8vd054SWdCQmdQNERjVUVJZFNRN0lBQkIvd0Z4SkR4QkNBOExJenRCQVJCNEl6dEJBV3BCL3dGeEpEc2pPd1JBUVFBUWVRVkJBUkI1QzBFQUVIb01EUXNqTzBGL0VIZ2pPMEVCYTBIL0FYRWtPeU03QkVCQkFCQjVCVUVCRUhrTFFRRVFlZ3dNQ3hCelFmOEJjU1E3REFvTFFRWkJBQ005UVFWMlFRRnhRUUJMR3lFQklBRkI0QUJ5SUFFalBVRUVka0VCY1VFQVN4c2hBU005UVFaMlFRRnhRUUJMQkg4ak5pQUJhMEgvQVhFRklBRkJCbklnQVNNMklnQkJEM0ZCQ1VzYklnRkI0QUJ5SUFFZ0FFR1pBVXNiSWdFZ0FHcEIvd0Z4Q3lJQUJFQkJBQkI1QlVFQkVIa0xJQUZCNEFCeEJFQkJBUkI3QlVFQUVIc0xRUUFRZHlBQUpEWU1DZ3NqUFVFSGRrRUJjVUVBU3dSQUVITVFnZ0VGSXo5QkFXcEIvLzhEY1NRL0MwRUlEd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlJZ0VnQVVILy93TnhRUUFRZmlBQlFRRjBRZi8vQTNFaUFVR0EvZ054UVFoMUpEc2dBVUgvQVhFa1BFRUFFSHBCQ0E4TEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2lJQkVIOUIvd0Z4SkRZZ0FVRUJha0gvL3dOeElnRkJnUDREY1VFSWRTUTdJQUZCL3dGeEpEd01Cd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlRUUZyUWYvL0EzRWlBVUdBL2dOeFFRaDFKRHNnQVVIL0FYRWtQRUVJRHdzalBFRUJFSGdqUEVFQmFrSC9BWEVrUENNOEJFQkJBQkI1QlVFQkVIa0xRUUFRZWd3RkN5TThRWDhRZUNNOFFRRnJRZjhCY1NROEl6d0VRRUVBRUhrRlFRRVFlUXRCQVJCNkRBUUxFSE5CL3dGeEpEd01BZ3NqTmtGL2MwSC9BWEVrTmtFQkVIcEJBUkIzREFJTFFYOFBDeU0vUVFGcVFmLy9BM0VrUHd0QkJBdVJCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUV3UndSQUlBQkJNV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSXoxQkJIWkJBWEVFUUNNL1FRRnFRZi8vQTNFa1B3VVFjeENDQVF0QkNBOExFSFJCLy84RGNTUStJejlCQW1wQi8vOERjU1EvREJJTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2lJQUl6WVFkUXdPQ3lNK1FRRnFRZi8vQTNFa1BrRUlEd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlJZ0FRZnlJQlFRRVFlQ0FCUVFGcVFmOEJjU0lCQkVCQkFCQjVCVUVCRUhrTFFRQVFlZ3dOQ3lNOFFmOEJjU003UWY4QmNVRUlkSElpQUJCL0lnRkJmeEI0SUFGQkFXdEIvd0Z4SWdFRVFFRUFFSGtGUVFFUWVRdEJBUkI2REF3TEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2hCelFmOEJjUkIxREF3TFFRQVFla0VBRUhkQkFSQjdEQXdMSXoxQkJIWkJBWEZCQVVZRVFCQnpFSUlCQlNNL1FRRnFRZi8vQTNFa1B3dEJDQThMSXp4Qi93RnhJenRCL3dGeFFRaDBjaUlCSXo1QkFCQitJejRnQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrT3lBQVFmOEJjU1E4UVFBUWVrRUlEd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlJZ0FRZjBIL0FYRWtOZ3dHQ3lNK1FRRnJRZi8vQTNFa1BrRUlEd3NqTmtFQkVIZ2pOa0VCYWtIL0FYRWtOaU0yQkVCQkFCQjVCVUVCRUhrTFFRQVFlZ3dIQ3lNMlFYOFFlQ00yUVFGclFmOEJjU1EySXpZRVFFRUFFSGtGUVFFUWVRdEJBUkI2REFZTEVITkIvd0Z4SkRZTUJBdEJBQkI2UVFBUWR5TTlRUVIyUVFGeFFRQkxCRUJCQUJCN0JVRUJFSHNMREFRTFFYOFBDeUFBUVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkRzZ0FFSC9BWEVrUEF3Q0N5QUFRZi8vQTNFZ0FSQjFEQUVMSXo5QkFXcEIvLzhEY1NRL0MwRUVDK0lCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCd0FCSEJFQWdBRUhCQUVZTkFRSkFJQUJCd2dCckRnNERCQVVHQndnSkVRb0xEQTBPRHdBTERBOExEQThMSXpna053d09DeU01SkRjTURRc2pPaVEzREF3TEl6c2tOd3dMQ3lNOEpEY01DZ3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlFSDlCL3dGeEpEY01DUXNqTmlRM0RBZ0xJemNrT0F3SEN5TTVKRGdNQmdzak9pUTREQVVMSXpza09Bd0VDeU04SkRnTUF3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUVIOUIvd0Z4SkRnTUFnc2pOaVE0REFFTFFYOFBDMEVFQzkwQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQVJ3UkFJQUJCMFFCR0RRRUNRQ0FBUWRJQWF3NE9FQU1FQlFZSENBa0tFQXNNRFE0QUN3d09DeU0zSkRrTURnc2pPQ1E1REEwTEl6b2tPUXdNQ3lNN0pEa01Dd3NqUENRNURBb0xJenhCL3dGeEl6dEIvd0Z4UVFoMGNoQi9RZjhCY1NRNURBa0xJellrT1F3SUN5TTNKRG9NQndzak9DUTZEQVlMSXpra09nd0ZDeU03SkRvTUJBc2pQQ1E2REFNTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2hCL1FmOEJjU1E2REFJTEl6WWtPZ3dCQzBGL0R3dEJCQXZkQVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQUVjRVFDQUFRZUVBUmcwQkFrQWdBRUhpQUdzT0RnTUVFQVVHQndnSkNnc01FQTBPQUFzTURnc2pOeVE3REE0TEl6Z2tPd3dOQ3lNNUpEc01EQXNqT2lRN0RBc0xJendrT3d3S0N5TThRZjhCY1NNN1FmOEJjVUVJZEhJUWYwSC9BWEVrT3d3SkN5TTJKRHNNQ0Fzak55UThEQWNMSXpna1BBd0dDeU01SkR3TUJRc2pPaVE4REFRTEl6c2tQQXdEQ3lNOFFmOEJjU003UWY4QmNVRUlkSElRZjBIL0FYRWtQQXdDQ3lNMkpEd01BUXRCZnc4TFFRUUw2Z0lBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUVjRVFDQUFRZkVBUmcwQkFrQWdBRUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhSQUFzTUR3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUl6Y1FkUXdQQ3lNOFFmOEJjU003UWY4QmNVRUlkSElqT0JCMURBNExJenhCL3dGeEl6dEIvd0Z4UVFoMGNpTTVFSFVNRFFzalBFSC9BWEVqTzBIL0FYRkJDSFJ5SXpvUWRRd01DeU04UWY4QmNTTTdRZjhCY1VFSWRISWpPeEIxREFzTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2lNOEVIVU1DZ3NqdXdGRkJFQUNRQ09RQVFSQVFRRWtRUXdCQ3lOMUkzdHhRUjl4UlFSQVFRRWtRZ3dCQzBFQkpFTUxDd3dKQ3lNOFFmOEJjU003UWY4QmNVRUlkSElqTmhCMURBZ0xJemNrTmd3SEN5TTRKRFlNQmdzak9TUTJEQVVMSXpva05nd0VDeU03SkRZTUF3c2pQQ1EyREFJTEl6eEIvd0Z4SXp0Qi93RnhRUWgwY2hCL1FmOEJjU1EyREFFTFFYOFBDMEVFQzBrQkFYOGdBVUVBVGdSQUlBQkIvd0Z4SUFBZ0FXcEIvd0Z4U3dSQVFRRVFld1ZCQUJCN0N3VWdBVUVmZFNJQ0lBRWdBbXB6SUFCQi93RnhTZ1JBUVFFUWV3VkJBQkI3Q3dzTE5BRUJmeU0ySUFCQi93RnhJZ0VRZUNNMklBRVFpZ0VqTmlBQWFrSC9BWEVrTmlNMkJFQkJBQkI1QlVFQkVIa0xRUUFRZWd0c0FRSi9JellnQUdvalBVRUVka0VCY1dwQi93RnhJZ0VoQWlNMklBQnpJQUZ6UVJCeEJFQkJBUkIzQlVFQUVIY0xJellnQUVIL0FYRnFJejFCQkhaQkFYRnFRWUFDY1VFQVN3UkFRUUVRZXdWQkFCQjdDeUFDSkRZak5nUkFRUUFRZVFWQkFSQjVDMEVBRUhvTDd3RUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHQUFVY0VRQ0FCUVlFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pOeENMQVF3UUN5TTRFSXNCREE4TEl6a1Fpd0VNRGdzak9oQ0xBUXdOQ3lNN0VJc0JEQXdMSXp3UWl3RU1Dd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlFSDhRaXdFTUNnc2pOaENMQVF3SkN5TTNFSXdCREFnTEl6Z1FqQUVNQndzak9SQ01BUXdHQ3lNNkVJd0JEQVVMSXpzUWpBRU1CQXNqUEJDTUFRd0RDeU04UWY4QmNTTTdRZjhCY1VFSWRISVFmeENNQVF3Q0N5TTJFSXdCREFFTFFYOFBDMEVFQ3pjQkFYOGpOaUFBUWY4QmNVRi9iQ0lCRUhnak5pQUJFSW9CSXpZZ0FHdEIvd0Z4SkRZak5nUkFRUUFRZVFWQkFSQjVDMEVCRUhvTGJBRUNmeU0ySUFCckl6MUJCSFpCQVhGclFmOEJjU0lCSVFJak5pQUFjeUFCYzBFUWNRUkFRUUVRZHdWQkFCQjNDeU0ySUFCQi93RnhheU05UVFSMlFRRnhhMEdBQW5GQkFFc0VRRUVCRUhzRlFRQVFld3NnQWlRMkl6WUVRRUVBRUhrRlFRRVFlUXRCQVJCNkMrOEJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQmtBRkhCRUFnQVVHUkFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJemNRamdFTUVBc2pPQkNPQVF3UEN5TTVFSTRCREE0TEl6b1FqZ0VNRFFzak94Q09BUXdNQ3lNOEVJNEJEQXNMSXp4Qi93RnhJenRCL3dGeFFRaDBjaEIvRUk0QkRBb0xJellRamdFTUNRc2pOeENQQVF3SUN5TTRFSThCREFjTEl6a1Fqd0VNQmdzak9oQ1BBUXdGQ3lNN0VJOEJEQVFMSXp3UWp3RU1Bd3NqUEVIL0FYRWpPMEgvQVhGQkNIUnlFSDhRandFTUFnc2pOaENQQVF3QkMwRi9Ed3RCQkFzakFDTTJJQUJ4SkRZak5nUkFRUUFRZVFWQkFSQjVDMEVBRUhwQkFSQjNRUUFRZXdzbkFDTTJJQUJ6UWY4QmNTUTJJellFUUVFQUVIa0ZRUUVRZVF0QkFCQjZRUUFRZDBFQUVIc0w3d0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR2dBVWNFUUNBQlFhRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqTnhDUkFRd1FDeU00RUpFQkRBOExJemtRa1FFTURnc2pPaENSQVF3TkN5TTdFSkVCREF3TEl6d1FrUUVNQ3dzalBFSC9BWEVqTzBIL0FYRkJDSFJ5RUg4UWtRRU1DZ3NqTmhDUkFRd0pDeU0zRUpJQkRBZ0xJemdRa2dFTUJ3c2pPUkNTQVF3R0N5TTZFSklCREFVTEl6c1FrZ0VNQkFzalBCQ1NBUXdEQ3lNOFFmOEJjU003UWY4QmNVRUlkSElRZnhDU0FRd0NDeU0yRUpJQkRBRUxRWDhQQzBFRUN5Y0FJellnQUhKQi93RnhKRFlqTmdSQVFRQVFlUVZCQVJCNUMwRUFFSHBCQUJCM1FRQVFld3N2QVFGL0l6WWdBRUgvQVhGQmYyd2lBUkI0SXpZZ0FSQ0tBU00ySUFGcUJFQkJBQkI1QlVFQkVIa0xRUUVRZWd2dkFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWJBQlJ3UkFJQUZCc1FGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TTNFSlFCREJBTEl6Z1FsQUVNRHdzak9SQ1VBUXdPQ3lNNkVKUUJEQTBMSXpzUWxBRU1EQXNqUEJDVUFRd0xDeU04UWY4QmNTTTdRZjhCY1VFSWRISVFmeENVQVF3S0N5TTJFSlFCREFrTEl6Y1FsUUVNQ0Fzak9CQ1ZBUXdIQ3lNNUVKVUJEQVlMSXpvUWxRRU1CUXNqT3hDVkFRd0VDeU04RUpVQkRBTUxJenhCL3dGeEl6dEIvd0Z4UVFoMGNoQi9FSlVCREFJTEl6WVFsUUVNQVF0QmZ3OExRUVFMT3dFQmZ5QUFFRkFpQVVGL1JnUi9JQUFRQVFVZ0FRdEIvd0Z4SUFCQkFXb2lBUkJRSWdCQmYwWUVmeUFCRUFFRklBQUxRZjhCY1VFSWRISUxDd0JCQ0JCeUlBQVFsd0VMUXdBZ0FFR0FBWEZCZ0FGR0JFQkJBUkI3QlVFQUVIc0xJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU0lBQkVCQkFCQjVCVUVCRUhrTFFRQVFla0VBRUhjZ0FBdEJBQ0FBUVFGeFFRQkxCRUJCQVJCN0JVRUFFSHNMSUFCQkIzUWdBRUgvQVhGQkFYWnlRZjhCY1NJQUJFQkJBQkI1QlVFQkVIa0xRUUFRZWtFQUVIY2dBQXRQQVFGL1FRRkJBQ0FBUVlBQmNVR0FBVVliSVFFalBVRUVka0VCY1NBQVFRRjBja0gvQVhFaEFDQUJCRUJCQVJCN0JVRUFFSHNMSUFBRVFFRUFFSGtGUVFFUWVRdEJBQkI2UVFBUWR5QUFDMUFCQVg5QkFVRUFJQUJCQVhGQkFVWWJJUUVqUFVFRWRrRUJjVUVIZENBQVFmOEJjVUVCZG5JaEFDQUJCRUJCQVJCN0JVRUFFSHNMSUFBRVFFRUFFSGtGUVFFUWVRdEJBQkI2UVFBUWR5QUFDMFlCQVg5QkFVRUFJQUJCZ0FGeFFZQUJSaHNoQVNBQVFRRjBRZjhCY1NFQUlBRUVRRUVCRUhzRlFRQVFld3NnQUFSQVFRQVFlUVZCQVJCNUMwRUFFSHBCQUJCM0lBQUxYZ0VDZjBFQlFRQWdBRUVCY1VFQlJoc2hBVUVCUVFBZ0FFR0FBWEZCZ0FGR0d5RUNJQUJCL3dGeFFRRjJJZ0JCZ0FGeUlBQWdBaHNpQUFSQVFRQVFlUVZCQVJCNUMwRUFFSHBCQUJCM0lBRUVRRUVCRUhzRlFRQVFld3NnQUFzd0FDQUFRUTl4UVFSMElBQkI4QUZ4UVFSMmNpSUFCRUJCQUJCNUJVRUJFSGtMUVFBUWVrRUFFSGRCQUJCN0lBQUxRZ0VCZjBFQlFRQWdBRUVCY1VFQlJoc2hBU0FBUWY4QmNVRUJkaUlBQkVCQkFCQjVCVUVCRUhrTFFRQVFla0VBRUhjZ0FRUkFRUUVRZXdWQkFCQjdDeUFBQ3lRQVFRRWdBSFFnQVhGQi93RnhCRUJCQUJCNUJVRUJFSGtMUVFBUWVrRUJFSGNnQVF1ZUNBRUdmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVJYnlJR0lnVUVRQ0FGUVFGckRnY0JBZ01FQlFZSENBc2pOeUVCREFjTEl6Z2hBUXdHQ3lNNUlRRU1CUXNqT2lFQkRBUUxJenNoQVF3REN5TThJUUVNQWdzalBFSC9BWEVqTzBIL0FYRkJDSFJ5RUg4aEFRd0JDeU0ySVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQlNJRUJFQWdCRUVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzZ0FFRUhUQVIvUVFFaEFpQUJFSmtCQlNBQVFROU1CSDlCQVNFQ0lBRVFtZ0VGUVFBTEN5RUREQThMSUFCQkYwd0VmMEVCSVFJZ0FSQ2JBUVVnQUVFZlRBUi9RUUVoQWlBQkVKd0JCVUVBQ3dzaEF3d09DeUFBUVNkTUJIOUJBU0VDSUFFUW5RRUZJQUJCTDB3RWYwRUJJUUlnQVJDZUFRVkJBQXNMSVFNTURRc2dBRUUzVEFSL1FRRWhBaUFCRUo4QkJTQUFRVDlNQkg5QkFTRUNJQUVRb0FFRlFRQUxDeUVEREF3TElBQkJ4d0JNQkg5QkFTRUNRUUFnQVJDaEFRVWdBRUhQQUV3RWYwRUJJUUpCQVNBQkVLRUJCVUVBQ3dzaEF3d0xDeUFBUWRjQVRBUi9RUUVoQWtFQ0lBRVFvUUVGSUFCQjN3Qk1CSDlCQVNFQ1FRTWdBUkNoQVFWQkFBc0xJUU1NQ2dzZ0FFSG5BRXdFZjBFQklRSkJCQ0FCRUtFQkJTQUFRZThBVEFSL1FRRWhBa0VGSUFFUW9RRUZRUUFMQ3lFRERBa0xJQUJCOXdCTUJIOUJBU0VDUVFZZ0FSQ2hBUVVnQUVIL0FFd0VmMEVCSVFKQkJ5QUJFS0VCQlVFQUN3c2hBd3dJQ3lBQVFZY0JUQVIvUVFFaEFpQUJRWDV4QlNBQVFZOEJUQVIvUVFFaEFpQUJRWDF4QlVFQUN3c2hBd3dIQ3lBQVFaY0JUQVIvUVFFaEFpQUJRWHR4QlNBQVFaOEJUQVIvUVFFaEFpQUJRWGR4QlVFQUN3c2hBd3dHQ3lBQVFhY0JUQVIvUVFFaEFpQUJRVzl4QlNBQVFhOEJUQVIvUVFFaEFpQUJRVjl4QlVFQUN3c2hBd3dGQ3lBQVFiY0JUQVIvUVFFaEFpQUJRYjkvY1FVZ0FFRy9BVXdFZjBFQklRSWdBVUgvZm5FRlFRQUxDeUVEREFRTElBQkJ4d0ZNQkg5QkFTRUNJQUZCQVhJRklBQkJ6d0ZNQkg5QkFTRUNJQUZCQW5JRlFRQUxDeUVEREFNTElBQkIxd0ZNQkg5QkFTRUNJQUZCQkhJRklBQkIzd0ZNQkg5QkFTRUNJQUZCQ0hJRlFRQUxDeUVEREFJTElBQkI1d0ZNQkg5QkFTRUNJQUZCRUhJRklBQkI3d0ZNQkg5QkFTRUNJQUZCSUhJRlFRQUxDeUVEREFFTElBQkI5d0ZNQkg5QkFTRUNJQUZCd0FCeUJTQUFRZjhCVEFSL1FRRWhBaUFCUVlBQmNnVkJBQXNMSVFNTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBR0lnUUVRQ0FFUVFGckRnY0JBZ01FQlFZSENBc2dBeVEzREFjTElBTWtPQXdHQ3lBREpEa01CUXNnQXlRNkRBUUxJQU1rT3d3REN5QURKRHdNQWdzZ0JVRUVTQ0lFQkg4Z0JBVWdCVUVIU2dzRVFDTThRZjhCY1NNN1FmOEJjVUVJZEhJZ0F4QjFDd3dCQ3lBREpEWUxRUVJCZnlBQ0d3dnVBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUZIQkVBZ0FFSEJBV3NPRHdFQ0V3TUVCUVlIQ0FrS0N4SU1EUTRMSXoxQkIzWkJBWEVORXd3UEN5TStFSmdCUWYvL0EzRWhBQ00rUVFKcVFmLy9BM0VrUGlBQVFZRCtBM0ZCQ0hVa055QUFRZjhCY1NRNFFRUVBDeU05UVFkMlFRRnhEUTRNRUFzalBVRUhka0VCY1EwTkRBNExJejVCQW10Qi8vOERjU1ErSXo0ak9FSC9BWEVqTjBIL0FYRkJDSFJ5RUgwTUR3c1FjeENMQVF3SkN5TStRUUpyUWYvL0EzRWtQaU0rSXo4UWZVRUFKRDhNRFFzalBVRUhka0VCY1VFQlJ3ME1EQWdMSXo0UW1BRkIvLzhEY1NRL0l6NUJBbXBCLy84RGNTUStEQXNMSXoxQkIzWkJBWEZCQVVZTkNRd0hDeEJ6UWY4QmNSQ2lBU0VBSXo5QkFXcEIvLzhEY1NRL0lBQVBDeU05UVFkMlFRRnhRUUZIRFFValBrRUNhMEgvL3dOeEpENGpQaU0vUVFKcVFmLy9BM0VRZlF3SEN4QnpFSXdCREFJTEl6NUJBbXRCLy84RGNTUStJejRqUHhCOVFRZ2tQd3dHQzBGL0R3c2pQMEVCYWtILy93TnhKRDlCQkE4TEl6NFFtQUZCLy84RGNTUS9JejVCQW1wQi8vOERjU1ErUVF3UEN5TS9RUUpxUWYvL0EzRWtQMEVNRHdzalBrRUNhMEgvL3dOeEpENGpQaU0vUVFKcVFmLy9BM0VRZlFzUWRFSC8vd054SkQ4TFFRZ0wwd01BQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBRkhCRUFnQUVIUkFXc09Ed0VDRFFNRUJRWUhDQWtOQ2cwTERBMExJejFCQkhaQkFYRU5FUXdPQ3lNK0VKZ0JRZi8vQTNFaEFDTStRUUpxUWYvL0EzRWtQaUFBUVlEK0EzRkJDSFVrT1NBQVFmOEJjU1E2UVFRUEN5TTlRUVIyUVFGeERRME1EZ3NqUFVFRWRrRUJjUTBNSXo1QkFtdEIvLzhEY1NRK0l6NGpQMEVDYWtILy93TnhFSDBNRFFzalBrRUNhMEgvL3dOeEpENGpQaU02UWY4QmNTTTVRZjhCY1VFSWRISVFmUXdOQ3hCekVJNEJEQWdMSXo1QkFtdEIvLzhEY1NRK0l6NGpQeEI5UVJBa1B3d0xDeU05UVFSMlFRRnhRUUZIRFFvTUJ3c2pQaENZQVVILy93TnhKRDlCQVNTUkFTTStRUUpxUWYvL0EzRWtQZ3dKQ3lNOVFRUjJRUUZ4UVFGR0RRY01CZ3NqUFVFRWRrRUJjVUVCUncwRkl6NUJBbXRCLy84RGNTUStJejRqUDBFQ2FrSC8vd054RUgwTUJnc1FjeENQQVF3Q0N5TStRUUpyUWYvL0EzRWtQaU0rSXo4UWZVRVlKRDhNQlF0QmZ3OExJejlCQVdwQi8vOERjU1EvUVFRUEN5TStFSmdCUWYvL0EzRWtQeU0rUVFKcVFmLy9BM0VrUGtFTUR3c2pQMEVDYWtILy93TnhKRDlCREE4TEVIUkIvLzhEY1NRL0MwRUlDL0FDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWVBQlJ3UkFJQUJCNFFGckRnOEJBZ3NMQXdRRkJnY0lDd3NMQ1FvTEN4QnpRZjhCY1VHQS9nTnFJellRZFF3TEN5TStFSmdCUWYvL0EzRWhBQ00rUVFKcVFmLy9BM0VrUGlBQVFZRCtBM0ZCQ0hVa095QUFRZjhCY1NROFFRUVBDeU00UVlEK0Eyb2pOaEIxUVFRUEN5TStRUUpyUWYvL0EzRWtQaU0rSXp4Qi93RnhJenRCL3dGeFFRaDBjaEI5UVFnUEN4QnpFSkVCREFjTEl6NUJBbXRCLy84RGNTUStJejRqUHhCOVFTQWtQMEVJRHdzUWN4Q0JBVUVZZEVFWWRTRUFJejRnQUVFQkVINGpQaUFBYWtILy93TnhKRDVCQUJCNVFRQVFlaU0vUVFGcVFmLy9BM0VrUDBFTUR3c2pQRUgvQVhFak8wSC9BWEZCQ0hSeUpEOUJCQThMRUhSQi8vOERjU00yRUhValAwRUNha0gvL3dOeEpEOUJCQThMRUhNUWtnRU1BZ3NqUGtFQ2EwSC8vd054SkQ0alBpTS9FSDFCS0NRL1FRZ1BDMEYvRHdzalAwRUJha0gvL3dOeEpEOUJCQXVrQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVVjRVFDQUFRZkVCYXc0UEFRSUREUVFGQmdjSUNRb05EUXNNRFFzUWMwSC9BWEZCZ1A0RGFoQi9RZjhCY1NRMkRBMExJejRRbUFGQi8vOERjU0VBSXo1QkFtcEIvLzhEY1NRK0lBQkJnUDREY1VFSWRTUTJJQUJCL3dGeEpEME1EUXNqT0VHQS9nTnFFSDlCL3dGeEpEWU1EQXRCQUNTUUFRd0xDeU0rUVFKclFmLy9BM0VrUGlNK0l6MUIvd0Z4SXpaQi93RnhRUWgwY2hCOVFRZ1BDeEJ6RUpRQkRBZ0xJejVCQW10Qi8vOERjU1ErSXo0alB4QjlRVEFrUDBFSUR3c1FjeENCQVNFQVFRQVFlVUVBRUhvalBpQUFRUmgwUVJoMUlnQkJBUkIrSXo0Z0FHcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa095QUFRZjhCY1NROEl6OUJBV3BCLy84RGNTUS9RUWdQQ3lNOFFmOEJjU003UWY4QmNVRUlkSElrUGtFSUR3c1FkRUgvL3dOeEVIOUIvd0Z4SkRZalAwRUNha0gvL3dOeEpEOE1CUXRCQVNTUkFRd0VDeEJ6RUpVQkRBSUxJejVCQW10Qi8vOERjU1ErSXo0alB4QjlRVGdrUDBFSUR3dEJmdzhMSXo5QkFXcEIvLzhEY1NRL0MwRUVDOXdCQVFGL0l6OUJBV3BCLy84RGNTUS9JME1FUUNNL1FRRnJRZi8vQTNFa1B3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPRFFNRUJRWUhDQWtLQ3d3TkRnOEFDd3dQQ3lBQUVJQUJEd3NnQUJDREFROExJQUFRaEFFUEN5QUFFSVVCRHdzZ0FCQ0dBUThMSUFBUWh3RVBDeUFBRUlnQkR3c2dBQkNKQVE4TElBQVFqUUVQQ3lBQUVKQUJEd3NnQUJDVEFROExJQUFRbGdFUEN5QUFFS01CRHdzZ0FCQ2tBUThMSUFBUXBRRVBDeUFBRUtZQkM3MEJBUUovUVFBa2tBRkJqLzRERUFGQkFTQUFkRUYvYzNFaUFTUjdRWS8rQXlBQkVBUWpQa0VDYTBILy93TnhKRDRDUUNOQklnRWpRaUFCR3cwQUN5TStJZ0VqUHlJQ1FmOEJjUkFFSUFGQkFXb2dBa0dBL2dOeFFRaDFFQVFDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdNREJBVUFDd3dGQzBFQUpIWkJ3QUFrUHd3RUMwRUFKSGRCeUFBa1B3d0RDMEVBSkhoQjBBQWtQd3dDQzBFQUpIbEIyQUFrUHd3QkMwRUFKSHBCNEFBa1B3c0w5QUVCQTM4amtRRUVRRUVCSkpBQlFRQWtrUUVMSTNVamUzRkJIM0ZCQUVvRVFDTkNSU09RQVNJQ0lBSWJCSDhqZGlOd0lnQWdBQnNFZjBFQUVLZ0JRUUVGSTNjamNTSUFJQUFiQkg5QkFSQ29BVUVCQlNONEkzSWlBQ0FBR3dSL1FRSVFxQUZCQVFVamVTTnpJZ0FnQUJzRWYwRURFS2dCUVFFRkkzb2pkQ0lBSUFBYkJIOUJCQkNvQVVFQkJVRUFDd3NMQ3dzRlFRQUxCRUFDZjBFQkkwRWlBQ05DSUFBYkRRQWFRUUFMQkg5QkFDUkNRUUFrUVVFQUpFTkJBQ1JFUVJnRlFSUUxJUUVMQW45QkFTTkJJZ0FqUWlBQUd3MEFHa0VBQ3dSQVFRQWtRa0VBSkVGQkFDUkRRUUFrUkFzZ0FROExRUUFMcXdFQkFuOUJBU1FsSTBNRVFDTS9FQUZCL3dGeEVLY0JFSEpCQUNSQ1FRQWtRVUVBSkVOQkFDUkVDeENwQVNJQlFRQktCRUFnQVJCeUMwRUVJUUFDZjBFQkkwRWlBU05DSUFFYkRRQWFRUUFMUlNJQkJIOGpSRVVGSUFFTEJFQWpQeEFCUWY4QmNSQ25BU0VBQ3lNOVFmQUJjU1E5SUFCQkFFd0VRQ0FBRHdzZ0FCQnlJNDRCUVFGcUpJNEJJNDRCSTR3QlRnUkFJNDBCUVFGcUpJMEJJNDRCSTR3QmF5U09BUXNnQUFzRUFDTmhDK1lCQVFWL0lBQkJmMEdBQ0NBQVFRQklHeUFBUVFCS0d5RUVRUUFoQUFOQUFuOENmeUFHUlNJQ0JFQWdBRVVoQWdzZ0Fnc0VRQ0FGUlNFQ0N5QUNDd1JBSUFORklRSUxJQUlFUUJDcUFVRUFTQVJBUVFFaEJnVWpRQ00xQkg5Qm9Na0lCVUhRcEFRTFRnUkFRUUVoQUFVZ0JFRi9TaUlDQkVBallTQUVUaUVDQ3lBQ0JFQkJBU0VGQlNBQlFYOUtJZ0lFUUNNL0lBRkdJUUlMUVFFZ0F5QUNHeUVEQ3dzTERBRUxDeUFBQkVBalFDTTFCSDlCb01rSUJVSFFwQVFMYXlSQUkvOEJEd3NnQlFSQUk0QUNEd3NnQXdSQUk0RUNEd3NqUDBFQmEwSC8vd054SkQ5QmZ3c0pBRUYvUVg4UXJBRUxPQUVEZndOQUlBSWdBRWdpQXdSQUlBRkJBRTRoQXdzZ0F3UkFFSzBCSVFFZ0FrRUJhaUVDREFFTEN5QUJRUUJJQkVBZ0FROExRUUFMQ1FCQmZ5QUFFS3dCQ3drQUlBQWdBUkNzQVFzRkFDT0pBUXNGQUNPS0FRc0ZBQ09MQVF0ZkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lQaEFROExJK0lCRHdzajR3RVBDeVBrQVE4TEkrVUJEd3NqNWdFUEN5UG5BUThMSStnQkR3dEJBQXVMQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUFpQWtFQlJnMEJBa0FnQWtFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQVVFQVJ5VGhBUXdIQ3lBQlFRQkhKT0lCREFZTElBRkJBRWNrNHdFTUJRc2dBVUVBUnlUa0FRd0VDeUFCUVFCSEpPVUJEQU1MSUFGQkFFY2s1Z0VNQWdzZ0FVRUFSeVRuQVF3QkN5QUJRUUJISk9nQkN3dFRBUUYvUVFBa1JDQUFFTFFCUlFSQVFRRWhBUXNnQUVFQkVMVUJJQUVFUUVFQlFRRkJBRUVCUVFBZ0FFRURUQnNpQVNPMkFTSUFJQUFiR3lBQlJTTzNBU0lBSUFBYkd3UkFRUUVrZWtFRUVEa0xDd3NKQUNBQVFRQVF0UUVMbWdFQUlBQkJBRW9FUUVFQUVMWUJCVUVBRUxjQkN5QUJRUUJLQkVCQkFSQzJBUVZCQVJDM0FRc2dBa0VBU2dSQVFRSVF0Z0VGUVFJUXR3RUxJQU5CQUVvRVFFRURFTFlCQlVFREVMY0JDeUFFUVFCS0JFQkJCQkMyQVFWQkJCQzNBUXNnQlVFQVNnUkFRUVVRdGdFRlFRVVF0d0VMSUFaQkFFb0VRRUVHRUxZQkJVRUdFTGNCQ3lBSFFRQktCRUJCQnhDMkFRVkJCeEMzQVFzTEJBQWpOZ3NFQUNNM0N3UUFJemdMQkFBak9Rc0VBQ002Q3dRQUl6c0xCQUFqUEFzRUFDTTlDd1FBSXo4TEJBQWpQZ3NHQUNNL0VBRUxCQUFqVFF1dkF3RUtmMEdBZ0FKQmdKQUNJN0FCR3lFSlFZQzRBa0dBc0FJanNRRWJJUW9EUUNBRlFZQUNTQVJBUVFBaEJBTkFJQVJCZ0FKSUJFQWdDU0FGUVFOMVFRVjBJQXBxSUFSQkEzVnFJZ05CZ0pCK2FpMEFBQkFySVFnZ0JVRUlieUVCUVFjZ0JFRUliMnNoQmtFQUlRSUNmeUFBUVFCS0l6RWlCeUFIR3dSQUlBTkJnTkIrYWkwQUFDRUNDeUFDUWNBQWNRc0VRRUVISUFGcklRRUxRUUFoQnlBQlFRRjBJQWhxSWdOQmdKQitha0VCUVFBZ0FrRUljUnNpQjBFQmNVRU5kR290QUFBaENFRUFJUUVnQTBHQmtINXFJQWRCQVhGQkRYUnFMUUFBUVFFZ0JuUnhCRUJCQWlFQkN5QUJRUUZxSUFGQkFTQUdkQ0FJY1JzaEFTQUZRUWgwSUFScVFRTnNJUVlnQUVFQVNpTXhJZ01nQXhzRVFDQUNRUWR4SUFGQkFCQXNJZ0ZCSDNGQkEzUWhBeUFHUVlDWURtb2lBaUFET2dBQUlBSkJBV29nQVVIZ0IzRkJCWFZCQTNRNkFBQWdBa0VDYWlBQlFZRDRBWEZCQ25WQkEzUTZBQUFGSUFGQngvNERRUUFRTFNFQ1FRQWhBUU5BSUFGQkEwZ0VRQ0FHUVlDWURtb2dBV29nQWpvQUFDQUJRUUZxSVFFTUFRc0xDeUFFUVFGcUlRUU1BUXNMSUFWQkFXb2hCUXdCQ3dzTHlBRUJCbjhDUUFOQUlBRkJGMDROQVVFQUlRQURRQUpBSUFCQkgwNE5BRUVBSVFSQkFVRUFJQUJCRDBvYklRUWdBU0VDSUFKQkQyc2dBaUFCUVE5S0cwRUVkQ0VDSUFCQkQyc2dBbW9nQUNBQ2FpQUFRUTlLR3lFQ1FZQ0FBaUVGUVlDUUFrR0FnQUlnQVVFUFNoc2hCVUVBSVFNRFFBSkFJQU5CQ0U0TkFDQUNJQVVnQkVFQVFRY2dBeUFBUVFOMElBRkJBM1FnQTJwQitBRkJnSmdhUVFGQmZ4QXVHaUFEUVFGcUlRTU1BUXNMSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFBQUN3QUxDd1FBSTMwTEJBQWpmZ3NFQUNOL0N4Z0JBWDhqZ1FFaEFDT0FBUVJBSUFCQkJISWhBQXNnQUFzdEFRRi9Ba0FEUUNBQVFmLy9BMG9OQVNBQVFZQ0FyQVJxSUFBUVVUb0FBQ0FBUVFGcUlRQU1BQUFMQUFzTEZBQS9BRUdNQVVnRVFFR01BVDhBYTBBQUdnc0xBd0FCQ3g4QUFrQUNRQUpBSTVBQ0RnSUJBZ0FMQUF0QkFDRUFDeUFBUVg4UXJBRUxCd0FnQUNTUUFnc3ZBQUpBQWtBQ1FBSkFBa0Fqa0FJT0JBRUNBd1FBQ3dBTFFRRWhBQXRCZnlFQkMwRi9JUUlMSUFFZ0FoQ3NBUXNBTXhCemIzVnlZMlZOWVhCd2FXNW5WVkpNSVdOdmNtVXZaR2x6ZEM5amIzSmxMblZ1ZEc5MVkyaGxaQzUzWVhOdExtMWhjQT09IikpLmluc3RhbmNlOwpjb25zdCBiPW5ldyBVaW50OEFycmF5KGEuZXhwb3J0cy5tZW1vcnkuYnVmZmVyKTtyZXR1cm57aW5zdGFuY2U6YSxieXRlTWVtb3J5OmIsdHlwZToiV2ViIEFzc2VtYmx5In19O2xldCBxLEIsYztjPXtncmFwaGljc1dvcmtlclBvcnQ6dm9pZCAwLG1lbW9yeVdvcmtlclBvcnQ6dm9pZCAwLGNvbnRyb2xsZXJXb3JrZXJQb3J0OnZvaWQgMCxhdWRpb1dvcmtlclBvcnQ6dm9pZCAwLHdhc21JbnN0YW5jZTp2b2lkIDAsd2FzbUJ5dGVNZW1vcnk6dm9pZCAwLG9wdGlvbnM6dm9pZCAwLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjowLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjowLApXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU6MCxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjowLHBhdXNlZDohMCx1cGRhdGVJZDp2b2lkIDAsdGltZVN0YW1wc1VudGlsUmVhZHk6MCxmcHNUaW1lU3RhbXBzOltdLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsYnJlYWtwb2ludDp2b2lkIDAsbWVzc2FnZUhhbmRsZXI6KGEpPT57Y29uc3QgYj1tKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBlLkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5ncmFwaGljc1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHAoRi5iaW5kKHZvaWQgMCxjKSxjLmdyYXBoaWNzV29ya2VyUG9ydCkpOiJNRU1PUlkiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLm1lbW9yeVdvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHAoSS5iaW5kKHZvaWQgMCwKYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxwKEguYmluZCh2b2lkIDAsYyksYy5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihjLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scChHLmJpbmQodm9pZCAwLGMpLGMuYXVkaW9Xb3JrZXJQb3J0KSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZS5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBNKG4pO2Mud2FzbUluc3RhbmNlPWEuaW5zdGFuY2U7Yy53YXNtQnl0ZU1lbW9yeT1hLmJ5dGVNZW1vcnk7ayhoKHt0eXBlOmEudHlwZX0sYi5tZXNzYWdlSWQpKX0pKCk7YnJlYWs7Y2FzZSBlLkNPTkZJRzpjLndhc21JbnN0YW5jZS5leHBvcnRzLmNvbmZpZy5hcHBseShjLGIubWVzc2FnZS5jb25maWcpOwpjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZS5SRVNFVF9BVURJT19RVUVVRTpjLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGUuUExBWTpjYXNlIGUuUExBWV9VTlRJTF9CUkVBS1BPSU5UOmlmKCFjLnBhdXNlZHx8IWMud2FzbUluc3RhbmNlfHwhYy53YXNtQnl0ZU1lbW9yeSl7ayhoKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTticmVha31jLnBhdXNlZD0hMTtjLmZwc1RpbWVTdGFtcHM9W107Yy5mcmFtZVNraXBDb3VudGVyPTA7Yy5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7Yy5icmVha3BvaW50PXZvaWQgMDtiLm1lc3NhZ2UuYnJlYWtwb2ludCYmKGMuYnJlYWtwb2ludD1iLm1lc3NhZ2UuYnJlYWtwb2ludCk7QyhjLDFFMy9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7eShjKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7CmJyZWFrO2Nhc2UgZS5QQVVTRTpjLnBhdXNlZD0hMDtjLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KGMudXBkYXRlSWQpLGMudXBkYXRlSWQ9dm9pZCAwKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBlLlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP2Mud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ayhoKHt0eXBlOmUuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBlLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPTA7bGV0IGQ9Yy53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7Yi5tZXNzYWdlLnN0YXJ0JiYoYT1iLm1lc3NhZ2Uuc3RhcnQpO2IubWVzc2FnZS5lbmQmJihkPWIubWVzc2FnZS5lbmQpO2E9Yy53YXNtQnl0ZU1lbW9yeS5zbGljZShhLApkKS5idWZmZXI7ayhoKHt0eXBlOmUuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgZS5HRVRfV0FTTV9DT05TVEFOVDprKGgoe3R5cGU6ZS5HRVRfV0FTTV9DT05TVEFOVCxyZXNwb25zZTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZS5GT1JDRV9PVVRQVVRfRlJBTUU6eihjKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKCJVbmtub3duIFdhc21Cb3kgV29ya2VyIG1lc3NhZ2U6IixiKX19LGdldEZQUzooKT0+MDxjLnRpbWVTdGFtcHNVbnRpbFJlYWR5P2Mub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlOmMuZnBzVGltZVN0YW1wcz9jLmZwc1RpbWVTdGFtcHMubGVuZ3RoOjB9O3AoYy5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

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
//# sourceMappingURL=wasmboy.wasm.cjs.js.map
