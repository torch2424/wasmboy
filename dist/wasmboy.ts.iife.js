var WasmBoy = (function (exports) {
  'use strict';

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

  var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var idb = createCommonjsModule(function (module) {

  (function() {
    function toArray(arr) {
      return Array.prototype.slice.call(arr);
    }

    function promisifyRequest(request) {
      return new Promise(function(resolve, reject) {
        request.onsuccess = function() {
          resolve(request.result);
        };

        request.onerror = function() {
          reject(request.error);
        };
      });
    }

    function promisifyRequestCall(obj, method, args) {
      var request;
      var p = new Promise(function(resolve, reject) {
        request = obj[method].apply(obj, args);
        promisifyRequest(request).then(resolve, reject);
      });

      p.request = request;
      return p;
    }

    function promisifyCursorRequestCall(obj, method, args) {
      var p = promisifyRequestCall(obj, method, args);
      return p.then(function(value) {
        if (!value) return;
        return new Cursor(value, p.request);
      });
    }

    function proxyProperties(ProxyClass, targetProp, properties) {
      properties.forEach(function(prop) {
        Object.defineProperty(ProxyClass.prototype, prop, {
          get: function() {
            return this[targetProp][prop];
          },
          set: function(val) {
            this[targetProp][prop] = val;
          }
        });
      });
    }

    function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
      properties.forEach(function(prop) {
        if (!(prop in Constructor.prototype)) return;
        ProxyClass.prototype[prop] = function() {
          return promisifyRequestCall(this[targetProp], prop, arguments);
        };
      });
    }

    function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
      properties.forEach(function(prop) {
        if (!(prop in Constructor.prototype)) return;
        ProxyClass.prototype[prop] = function() {
          return this[targetProp][prop].apply(this[targetProp], arguments);
        };
      });
    }

    function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
      properties.forEach(function(prop) {
        if (!(prop in Constructor.prototype)) return;
        ProxyClass.prototype[prop] = function() {
          return promisifyCursorRequestCall(this[targetProp], prop, arguments);
        };
      });
    }

    function Index(index) {
      this._index = index;
    }

    proxyProperties(Index, '_index', [
      'name',
      'keyPath',
      'multiEntry',
      'unique'
    ]);

    proxyRequestMethods(Index, '_index', IDBIndex, [
      'get',
      'getKey',
      'getAll',
      'getAllKeys',
      'count'
    ]);

    proxyCursorRequestMethods(Index, '_index', IDBIndex, [
      'openCursor',
      'openKeyCursor'
    ]);

    function Cursor(cursor, request) {
      this._cursor = cursor;
      this._request = request;
    }

    proxyProperties(Cursor, '_cursor', [
      'direction',
      'key',
      'primaryKey',
      'value'
    ]);

    proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
      'update',
      'delete'
    ]);

    // proxy 'next' methods
    ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
      if (!(methodName in IDBCursor.prototype)) return;
      Cursor.prototype[methodName] = function() {
        var cursor = this;
        var args = arguments;
        return Promise.resolve().then(function() {
          cursor._cursor[methodName].apply(cursor._cursor, args);
          return promisifyRequest(cursor._request).then(function(value) {
            if (!value) return;
            return new Cursor(value, cursor._request);
          });
        });
      };
    });

    function ObjectStore(store) {
      this._store = store;
    }

    ObjectStore.prototype.createIndex = function() {
      return new Index(this._store.createIndex.apply(this._store, arguments));
    };

    ObjectStore.prototype.index = function() {
      return new Index(this._store.index.apply(this._store, arguments));
    };

    proxyProperties(ObjectStore, '_store', [
      'name',
      'keyPath',
      'indexNames',
      'autoIncrement'
    ]);

    proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
      'put',
      'add',
      'delete',
      'clear',
      'get',
      'getAll',
      'getKey',
      'getAllKeys',
      'count'
    ]);

    proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
      'openCursor',
      'openKeyCursor'
    ]);

    proxyMethods(ObjectStore, '_store', IDBObjectStore, [
      'deleteIndex'
    ]);

    function Transaction(idbTransaction) {
      this._tx = idbTransaction;
      this.complete = new Promise(function(resolve, reject) {
        idbTransaction.oncomplete = function() {
          resolve();
        };
        idbTransaction.onerror = function() {
          reject(idbTransaction.error);
        };
        idbTransaction.onabort = function() {
          reject(idbTransaction.error);
        };
      });
    }

    Transaction.prototype.objectStore = function() {
      return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
    };

    proxyProperties(Transaction, '_tx', [
      'objectStoreNames',
      'mode'
    ]);

    proxyMethods(Transaction, '_tx', IDBTransaction, [
      'abort'
    ]);

    function UpgradeDB(db, oldVersion, transaction) {
      this._db = db;
      this.oldVersion = oldVersion;
      this.transaction = new Transaction(transaction);
    }

    UpgradeDB.prototype.createObjectStore = function() {
      return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
    };

    proxyProperties(UpgradeDB, '_db', [
      'name',
      'version',
      'objectStoreNames'
    ]);

    proxyMethods(UpgradeDB, '_db', IDBDatabase, [
      'deleteObjectStore',
      'close'
    ]);

    function DB(db) {
      this._db = db;
    }

    DB.prototype.transaction = function() {
      return new Transaction(this._db.transaction.apply(this._db, arguments));
    };

    proxyProperties(DB, '_db', [
      'name',
      'version',
      'objectStoreNames'
    ]);

    proxyMethods(DB, '_db', IDBDatabase, [
      'close'
    ]);

    // Add cursor iterators
    // TODO: remove this once browsers do the right thing with promises
    ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
      [ObjectStore, Index].forEach(function(Constructor) {
        // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
        if (!(funcName in Constructor.prototype)) return;

        Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
          var args = toArray(arguments);
          var callback = args[args.length - 1];
          var nativeObject = this._store || this._index;
          var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
          request.onsuccess = function() {
            callback(request.result);
          };
        };
      });
    });

    // polyfill getAll
    [Index, ObjectStore].forEach(function(Constructor) {
      if (Constructor.prototype.getAll) return;
      Constructor.prototype.getAll = function(query, count) {
        var instance = this;
        var items = [];

        return new Promise(function(resolve) {
          instance.iterateCursor(query, function(cursor) {
            if (!cursor) {
              resolve(items);
              return;
            }
            items.push(cursor.value);

            if (count !== undefined && items.length == count) {
              resolve(items);
              return;
            }
            cursor.continue();
          });
        });
      };
    });

    var exp = {
      open: function(name, version, upgradeCallback) {
        var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
        var request = p.request;

        if (request) {
          request.onupgradeneeded = function(event) {
            if (upgradeCallback) {
              upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
            }
          };
        }

        return p.then(function(db) {
          return new DB(db);
        });
      },
      delete: function(name) {
        return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
      }
    };

    {
      module.exports = exp;
      module.exports.default = module.exports;
    }
  }());
  });

  var node = createCommonjsModule(function (module) {
  if (typeof indexedDB != 'undefined') {
    module.exports = idb;
  }
  else {
    module.exports = {
      open: function () {
        return Promise.reject('IDB requires a browser environment');
      },
      delete: function () {
        return Promise.reject('IDB requires a browser environment');
      }
    };
  }
  });
  var node_1 = node.open;

  // Get our idb instance, and initialize to asn idb-keyval
  let keyval = false; // Get our idb dPromise

  if (typeof window !== 'undefined') {
    const dbPromise = node.open('wasmboy', 1, upgradeDB => {
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

  var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIHZhKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gYmEoYSxiKXtFYT9zZWxmLnBvc3RNZXNzYWdlKGEsYik6UWEucG9zdE1lc3NhZ2UoYSxiKX1mdW5jdGlvbiB3YShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKEVhKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKEVhKXNlbGYub25tZXNzYWdlPWE7ZWxzZSBRYS5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gTihhLGIsZil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksRmErKyxiPWAke2J9LSR7RmF9YCwxRTU8RmEmJihGYT0wKSk7cmV0dXJue3dvcmtlcklkOmYsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiB6YihhLGIpe2I9dmEoYik7CnN3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBFLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZnJhbWVJblByb2dyZXNzVmlkZW9PdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCksYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX1NJWkUudmFsdWVPZigpLGEuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6RS5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBBYihhLGIpe2I9dmEoYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIEUuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6RS5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEUuQVVESU9fTEFURU5DWTphLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9Yi5tZXNzYWdlLmxhdGVuY3l9fWZ1bmN0aW9uIEJiKGEsYil7Yj12YShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgRS5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gZWIoYSl7aWYoIWEud2FzbUJ5dGVNZW1vcnkpcmV0dXJuIG5ldyBVaW50OEFycmF5OwpsZXQgYj1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN10sZj12b2lkIDA7aWYoMD09PWIpcmV0dXJuIG5ldyBVaW50OEFycmF5OzE8PWImJjM+PWI/Zj0zMjc2ODo1PD1iJiY2Pj1iP2Y9MjA0ODoxNTw9YiYmMTk+PWI/Zj0zMjc2ODoyNTw9YiYmMzA+PWImJihmPTEzMTA3Mik7cmV0dXJuIGY/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2YpOm5ldyBVaW50OEFycmF5fWZ1bmN0aW9uIGZiKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gQ2IoYSxiKXtiPXZhKGIpOwpzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgRS5DTEVBUl9NRU1PUlk6Zm9yKHZhciBjPTA7Yzw9YS53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7YysrKWEud2FzbUJ5dGVNZW1vcnlbY109MDtjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoMCk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6RS5DTEVBUl9NRU1PUllfRE9ORSx3YXNtQnl0ZU1lbW9yeTpjLmJ1ZmZlcn0sYi5tZXNzYWdlSWQpLFtjLmJ1ZmZlcl0pO2JyZWFrO2Nhc2UgRS5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCk7CmEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpFLkdFVF9DT05TVEFOVFNfRE9ORSwKV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lUmFtQmFua3NMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVMb2NhdGlvbi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBFLlNFVF9NRU1PUlk6Yz1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2MuaW5jbHVkZXMoRi5DQVJUUklER0VfUk9NKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuQ0FSVFJJREdFX1JPTV0pLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEYuQ0FSVFJJREdFX1JBTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtGLkNBUlRSSURHRV9SQU1dKSxhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04pO2MuaW5jbHVkZXMoRi5HQU1FQk9ZX01FTU9SWSkmJgphLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbRi5HQU1FQk9ZX01FTU9SWV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04pO2MuaW5jbHVkZXMoRi5QQUxFVFRFX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtGLlBBTEVUVEVfTUVNT1JZXSksYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEYuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuSU5URVJOQUxfU1RBVEVdKSxhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04pLGEud2FzbUluc3RhbmNlLmV4cG9ydHMubG9hZFN0YXRlKCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOkUuU0VUX01FTU9SWV9ET05FfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgRS5HRVRfTUVNT1JZOntjPXt0eXBlOkUuR0VUX01FTU9SWX07CmNvbnN0IGY9W107dmFyIHU9Yi5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKHUuaW5jbHVkZXMoRi5DQVJUUklER0VfUk9NKSl7aWYoYS53YXNtQnl0ZU1lbW9yeSl7dmFyIHk9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddO3ZhciBkPXZvaWQgMDswPT09eT9kPTMyNzY4OjE8PXkmJjM+PXk/ZD0yMDk3MTUyOjU8PXkmJjY+PXk/ZD0yNjIxNDQ6MTU8PXkmJjE5Pj15P2Q9MjA5NzE1MjoyNTw9eSYmMzA+PXkmJihkPTgzODg2MDgpO3k9ZD9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK2QpOm5ldyBVaW50OEFycmF5fWVsc2UgeT1uZXcgVWludDhBcnJheTt5PXkuYnVmZmVyO2NbRi5DQVJUUklER0VfUk9NXT15O2YucHVzaCh5KX11LmluY2x1ZGVzKEYuQ0FSVFJJREdFX1JBTSkmJih5PWViKGEpLmJ1ZmZlcixjW0YuQ0FSVFJJREdFX1JBTV09eSwKZi5wdXNoKHkpKTt1LmluY2x1ZGVzKEYuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5Pyh5PWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCx5PWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoeSx5KzI3KSk6eT1uZXcgVWludDhBcnJheSx5PXkuYnVmZmVyLGNbRi5DQVJUUklER0VfSEVBREVSXT15LGYucHVzaCh5KSk7dS5pbmNsdWRlcyhGLkdBTUVCT1lfTUVNT1JZKSYmKHk9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsY1tGLkdBTUVCT1lfTUVNT1JZXT15LGYucHVzaCh5KSk7dS5pbmNsdWRlcyhGLlBBTEVUVEVfTUVNT1JZKSYmKHk9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGNbRi5QQUxFVFRFX01FTU9SWV09eSxmLnB1c2goeSkpO3UuaW5jbHVkZXMoRi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLHU9ZmIoYSkuYnVmZmVyLGNbRi5JTlRFUk5BTF9TVEFURV09dSxmLnB1c2godSkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKGMsYi5tZXNzYWdlSWQpLGYpfX19ZnVuY3Rpb24gbShhLGIpe3JldHVybihhJjI1NSk8PDh8YiYyNTV9ZnVuY3Rpb24gSChhKXtyZXR1cm4oYSY2NTI4MCk+Pjh9ZnVuY3Rpb24gSyhhLGIpe3JldHVybiBiJn4oMTw8YSl9ZnVuY3Rpb24gbihhLGIpe3JldHVybiAwIT0oYiYxPDxhKX1mdW5jdGlvbiBSYShhKXt2YXIgYj1hO24oNyxiKSYmKGI9LTEqKDI1Ni1hKSk7cmV0dXJuIGJ9ZnVuY3Rpb24gR2EoYSxjKXthPTE8PGEmMjU1O2IucmVnaXN0ZXJGPTA8Yz9iLnJlZ2lzdGVyRnxhOmIucmVnaXN0ZXJGJgooMjU1XmEpO3JldHVybiBiLnJlZ2lzdGVyRn1mdW5jdGlvbiBsKGEpe0dhKDcsYSl9ZnVuY3Rpb24gcShhKXtHYSg2LGEpfWZ1bmN0aW9uIEMoYSl7R2EoNSxhKX1mdW5jdGlvbiB3KGEpe0dhKDQsYSl9ZnVuY3Rpb24gcWEoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjcmMX1mdW5jdGlvbiBTKCl7cmV0dXJuIGIucmVnaXN0ZXJGPj40JjF9ZnVuY3Rpb24gUShhLGIpezA8PWI/MCE9PSgoYSYxNSkrKGImMTUpJjE2KT9DKDEpOkMoMCk6KE1hdGguYWJzKGIpJjE1KT4oYSYxNSk/QygxKTpDKDApfWZ1bmN0aW9uIFNhKGEsYil7MDw9Yj9hPihhK2ImMjU1KT93KDEpOncoMCk6TWF0aC5hYnMoYik+YT93KDEpOncoMCl9ZnVuY3Rpb24gdGEoYSxiLGYpe2Y/KGE9YV5iXmErYiwwIT09KGEmMTYpP0MoMSk6QygwKSwwIT09KGEmMjU2KT93KDEpOncoMCkpOihmPWErYiY2NTUzNSxmPGE/dygxKTp3KDApLDAhPT0oKGFeYl5mKSY0MDk2KT9DKDEpOkMoMCkpfWZ1bmN0aW9uIEhhKGEsYixmKXt2b2lkIDA9PT0KZiYmKGY9ITEpO3ZhciBjPWE7Znx8KGM9eChiKT4+MiphJjMpO2E9MjQyO3N3aXRjaChjKXtjYXNlIDE6YT0xNjA7YnJlYWs7Y2FzZSAyOmE9ODg7YnJlYWs7Y2FzZSAzOmE9OH1yZXR1cm4gYX1mdW5jdGlvbiBJYShhLGIsZil7Yj04KmErMipiO2E9Z2IoYisxLGYpO2Y9Z2IoYixmKTtyZXR1cm4gbShhLGYpfWZ1bmN0aW9uIGNhKGEsYil7cmV0dXJuIDgqKChiJjMxPDw1KmEpPj41KmEpfWZ1bmN0aW9uIGdiKGEsYil7YSY9NjM7YiYmKGErPTY0KTtyZXR1cm4gZ1s2NzU4NCthXX1mdW5jdGlvbiBKYShhLGIsZix1KXt2b2lkIDA9PT1mJiYoZj0wKTt2b2lkIDA9PT11JiYodT0hMSk7ZiY9Mzt1JiYoZnw9NCk7Z1s2OTYzMisoMTYwKmIrYSldPWZ9ZnVuY3Rpb24gaGIoYSxiLGYsdSx5LGQsaCxlLGwscCxtLGsscSl7dmFyIGM9MDtiPXhhKGIsYSk7YT1aKGIrMipkLGYpO2Y9WihiKzIqZCsxLGYpO2ZvcihkPXU7ZDw9eTtkKyspaWYoYj1oKyhkLXUpLGI8bCl7dmFyIEI9ZDtpZigwPnF8fAohbig1LHEpKUI9Ny1CO3ZhciB1YT0wO24oQixmKSYmKHVhKz0xLHVhPDw9MSk7bihCLGEpJiYodWErPTEpO2lmKDA8PXEpe3ZhciB4PUlhKHEmNyx1YSwhMSk7Qj1jYSgwLHgpO3ZhciB2PWNhKDEseCk7eD1jYSgyLHgpfWVsc2UgMD49ayYmKGs9ci5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlKSx2PUI9eD1IYSh1YSxrLG0pO3ZhciBUYT0zKihlKmwrYik7Z1twK1RhXT1CO2dbcCtUYSsxXT12O2dbcCtUYSsyXT14O0I9ITE7MDw9cSYmKEI9big3LHEpKTtKYShiLGUsdWEsQik7YysrfXJldHVybiBjfWZ1bmN0aW9uIHhhKGEsYil7aWYoYT09PXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCl7dmFyIGM9YisxMjg7big3LGIpJiYoYz1iLTEyOCk7cmV0dXJuIGErMTYqY31yZXR1cm4gYSsxNipifWZ1bmN0aW9uIGliKGEsYil7c3dpdGNoKGEpe2Nhc2UgMTpyZXR1cm4gbihiLDEyOSk7Y2FzZSAyOnJldHVybiBuKGIsMTM1KTtjYXNlIDM6cmV0dXJuIG4oYiwKMTI2KTtkZWZhdWx0OnJldHVybiBuKGIsMSl9fWZ1bmN0aW9uIGpiKCl7dmFyIGE9a2IoKTsyMDQ3Pj1hJiYwPHouTlJ4MFN3ZWVwU2hpZnQmJih6LnN3ZWVwU2hhZG93RnJlcXVlbmN5PWEsei5zZXRGcmVxdWVuY3koYSksYT1rYigpKTsyMDQ3PGEmJih6LmlzRW5hYmxlZD0hMSl9ZnVuY3Rpb24ga2IoKXt2YXIgYT16LnN3ZWVwU2hhZG93RnJlcXVlbmN5O2E+Pj16Lk5SeDBTd2VlcFNoaWZ0O3JldHVybiBhPXouTlJ4ME5lZ2F0ZT96LnN3ZWVwU2hhZG93RnJlcXVlbmN5LWE6ei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeSthfWZ1bmN0aW9uIEthKGEpe3N3aXRjaChhKXtjYXNlIHouY2hhbm5lbE51bWJlcjppZih2LmNoYW5uZWwxRGFjRW5hYmxlZCE9PXouaXNEYWNFbmFibGVkKXJldHVybiB2LmNoYW5uZWwxRGFjRW5hYmxlZD16LmlzRGFjRW5hYmxlZCwhMDticmVhaztjYXNlIEwuY2hhbm5lbE51bWJlcjppZih2LmNoYW5uZWwyRGFjRW5hYmxlZCE9PUwuaXNEYWNFbmFibGVkKXJldHVybiB2LmNoYW5uZWwyRGFjRW5hYmxlZD0KTC5pc0RhY0VuYWJsZWQsITA7YnJlYWs7Y2FzZSBJLmNoYW5uZWxOdW1iZXI6aWYodi5jaGFubmVsM0RhY0VuYWJsZWQhPT1JLmlzRGFjRW5hYmxlZClyZXR1cm4gdi5jaGFubmVsM0RhY0VuYWJsZWQ9SS5pc0RhY0VuYWJsZWQsITA7YnJlYWs7Y2FzZSBNLmNoYW5uZWxOdW1iZXI6aWYodi5jaGFubmVsNERhY0VuYWJsZWQhPT1NLmlzRGFjRW5hYmxlZClyZXR1cm4gdi5jaGFubmVsNERhY0VuYWJsZWQ9TS5pc0RhY0VuYWJsZWQsITB9cmV0dXJuITF9ZnVuY3Rpb24gTGEoKXtpZighKGUuY3VycmVudEN5Y2xlczxlLmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSlmb3IoO2UuY3VycmVudEN5Y2xlcz49ZS5iYXRjaFByb2Nlc3NDeWNsZXMoKTspbGIoZS5iYXRjaFByb2Nlc3NDeWNsZXMoKSksZS5jdXJyZW50Q3ljbGVzLT1lLmJhdGNoUHJvY2Vzc0N5Y2xlcygpfWZ1bmN0aW9uIGxiKGEpe2UuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcis9YTtpZihlLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI+PQplLm1heEZyYW1lU2VxdWVuY2VDeWNsZXMoKSl7ZS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyLT1lLm1heEZyYW1lU2VxdWVuY2VDeWNsZXMoKTtzd2l0Y2goZS5mcmFtZVNlcXVlbmNlcil7Y2FzZSAwOnoudXBkYXRlTGVuZ3RoKCk7TC51cGRhdGVMZW5ndGgoKTtJLnVwZGF0ZUxlbmd0aCgpO00udXBkYXRlTGVuZ3RoKCk7YnJlYWs7Y2FzZSAyOnoudXBkYXRlTGVuZ3RoKCk7TC51cGRhdGVMZW5ndGgoKTtJLnVwZGF0ZUxlbmd0aCgpO00udXBkYXRlTGVuZ3RoKCk7ei51cGRhdGVTd2VlcCgpO2JyZWFrO2Nhc2UgNDp6LnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtNLnVwZGF0ZUxlbmd0aCgpO2JyZWFrO2Nhc2UgNjp6LnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtNLnVwZGF0ZUxlbmd0aCgpO3oudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDc6ei51cGRhdGVFbnZlbG9wZSgpLEwudXBkYXRlRW52ZWxvcGUoKSwKTS51cGRhdGVFbnZlbG9wZSgpfWUuZnJhbWVTZXF1ZW5jZXIrPTE7ODw9ZS5mcmFtZVNlcXVlbmNlciYmKGUuZnJhbWVTZXF1ZW5jZXI9MCk7dmFyIGI9ITB9ZWxzZSBiPSExO2lmKFQuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcyYmIWIpe2I9ei53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8S2Eoei5jaGFubmVsTnVtYmVyKTt2YXIgZj1MLndpbGxDaGFubmVsVXBkYXRlKGEpfHxLYShMLmNoYW5uZWxOdW1iZXIpLHU9SS53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8S2EoSS5jaGFubmVsTnVtYmVyKSx5PU0ud2lsbENoYW5uZWxVcGRhdGUoYSl8fEthKE0uY2hhbm5lbE51bWJlcik7YiYmKHYuY2hhbm5lbDFTYW1wbGU9ei5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2YmJih2LmNoYW5uZWwyU2FtcGxlPUwuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTt1JiYodi5jaGFubmVsM1NhbXBsZT1JLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7eSYmKHYuY2hhbm5lbDRTYW1wbGU9TS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpOwppZihifHxmfHx1fHx5KXYubmVlZFRvUmVtaXhTYW1wbGVzPSEwO2UuZG93blNhbXBsZUN5Y2xlQ291bnRlcis9YSplLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXI7ZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPj1lLm1heERvd25TYW1wbGVDeWNsZXMoKSYmKGUuZG93blNhbXBsZUN5Y2xlQ291bnRlci09ZS5tYXhEb3duU2FtcGxlQ3ljbGVzKCksKHYubmVlZFRvUmVtaXhTYW1wbGVzfHx2Lm1peGVyVm9sdW1lQ2hhbmdlZHx8di5taXhlckVuYWJsZWRDaGFuZ2VkKSYmbWIodi5jaGFubmVsMVNhbXBsZSx2LmNoYW5uZWwyU2FtcGxlLHYuY2hhbm5lbDNTYW1wbGUsdi5jaGFubmVsNFNhbXBsZSksYT12LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZSsxLGI9NTg4ODAwKzIqZS5hdWRpb1F1ZXVlSW5kZXgsZ1tiXT12LmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlKzErMSxnW2IrMV09YSsxLGUuYXVkaW9RdWV1ZUluZGV4Kz0xLGUuYXVkaW9RdWV1ZUluZGV4Pj0oZS53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZS8KMnwwKS0xJiYtLWUuYXVkaW9RdWV1ZUluZGV4KX1lbHNlIGI9ei5nZXRTYW1wbGUoYSl8MCxmPUwuZ2V0U2FtcGxlKGEpfDAsdT1JLmdldFNhbXBsZShhKXwwLHk9TS5nZXRTYW1wbGUoYSl8MCx2LmNoYW5uZWwxU2FtcGxlPWIsdi5jaGFubmVsMlNhbXBsZT1mLHYuY2hhbm5lbDNTYW1wbGU9dSx2LmNoYW5uZWw0U2FtcGxlPXksZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyKz1hKmUuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcixlLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI+PWUubWF4RG93blNhbXBsZUN5Y2xlcygpJiYoZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyLT1lLm1heERvd25TYW1wbGVDeWNsZXMoKSxhPW1iKGIsZix1LHkpLGI9SChhKSxmPTU4ODgwMCsyKmUuYXVkaW9RdWV1ZUluZGV4LGdbZl09YisxKzEsZ1tmKzFdPShhJjI1NSkrMixlLmF1ZGlvUXVldWVJbmRleCs9MSxlLmF1ZGlvUXVldWVJbmRleD49KGUud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemUvMnwwKS0xJiYtLWUuYXVkaW9RdWV1ZUluZGV4KX0KZnVuY3Rpb24gVWEoKXtyZXR1cm4gZS5hdWRpb1F1ZXVlSW5kZXh9ZnVuY3Rpb24gVmEoKXtlLmF1ZGlvUXVldWVJbmRleD0wfWZ1bmN0aW9uIG1iKGEsYixmLHUpe3ZvaWQgMD09PWEmJihhPTE1KTt2b2lkIDA9PT1iJiYoYj0xNSk7dm9pZCAwPT09ZiYmKGY9MTUpO3ZvaWQgMD09PXUmJih1PTE1KTt2Lm1peGVyVm9sdW1lQ2hhbmdlZD0hMTt2YXIgYz0wLGQ9MDtjPWUuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0P2MrYTpjKzE1O2M9ZS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ/YytiOmMrMTU7Yz1lLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD9jK2Y6YysxNTtjPWUuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0P2MrdTpjKzE1O2Q9ZS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0P2QrYTpkKzE1O2Q9ZS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0P2QrYjpkKzE1O2Q9ZS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PwpkK2Y6ZCsxNTtkPWUuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD9kK3U6ZCsxNTt2Lm1peGVyRW5hYmxlZENoYW5nZWQ9ITE7di5uZWVkVG9SZW1peFNhbXBsZXM9ITE7YT1uYihjLGUuTlI1MExlZnRNaXhlclZvbHVtZSsxKTtkPW5iKGQsZS5OUjUwUmlnaHRNaXhlclZvbHVtZSsxKTt2LmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPWE7di5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9ZDtyZXR1cm4gbShhLGQpfWZ1bmN0aW9uIG5iKGEsYil7aWYoNjA9PT1hKXJldHVybiAxMjc7YT0xRTUqKGEtNjApKmIvOHwwO2E9YS8xRTV8MDthKz02MDthPTFFNSphLygxMkU2LzI1NHwwKXwwO3JldHVybiBhfD0wfWZ1bmN0aW9uIE1hKGEpe05hKCExKTt2YXIgYz14KHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KTtjPUsoYSxjKTtwLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT1jO2gocC5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QsYyk7CmIuc3RhY2tQb2ludGVyLT0yO2IuaXNIYWx0ZWQoKTtjPWIuc3RhY2tQb2ludGVyO3ZhciBmPWIucHJvZ3JhbUNvdW50ZXIsdT1IKGYpLGQ9YysxO2goYyxmJjI1NSk7aChkLHUpO3N3aXRjaChhKXtjYXNlIHAuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ6cC5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTY0O2JyZWFrO2Nhc2UgcC5iaXRQb3NpdGlvbkxjZEludGVycnVwdDpwLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9NzI7YnJlYWs7Y2FzZSBwLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ6cC5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9ODA7YnJlYWs7Y2FzZSBwLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0OnAuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITEsYi5wcm9ncmFtQ291bnRlcj05Nn19ZnVuY3Rpb24geWEoYSl7dmFyIGI9eChwLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCk7CmJ8PTE8PGE7cC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9YjtoKHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LGIpfWZ1bmN0aW9uIE5hKGEpe2E/cC5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMDpwLm1hc3RlckludGVycnVwdFN3aXRjaD0hMX1mdW5jdGlvbiBXYShhKXtmb3IodmFyIGI9MDtiPGE7KXt2YXIgZj1rLmRpdmlkZXJSZWdpc3RlcjtiKz00O2suZGl2aWRlclJlZ2lzdGVyKz00OzY1NTM1PGsuZGl2aWRlclJlZ2lzdGVyJiYoay5kaXZpZGVyUmVnaXN0ZXItPTY1NTM2KTtrLnRpbWVyRW5hYmxlZCYmKGsudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT8oay50aW1lckNvdW50ZXI9ay50aW1lck1vZHVsbyxwLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAseWEocC5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0KSxrLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITEsay50aW1lckNvdW50ZXJXYXNSZXNldD0hMCk6ay50aW1lckNvdW50ZXJXYXNSZXNldCYmCihrLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExKSxvYihmLGsuZGl2aWRlclJlZ2lzdGVyKSYmWGEoKSl9fWZ1bmN0aW9uIFhhKCl7ay50aW1lckNvdW50ZXIrPTE7MjU1PGsudGltZXJDb3VudGVyJiYoay50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSEwLGsudGltZXJDb3VudGVyPTApfWZ1bmN0aW9uIG9iKGEsYil7dmFyIGM9WWEoay50aW1lcklucHV0Q2xvY2spO3JldHVybiBuKGMsYSkmJiFuKGMsYik/ITA6ITF9ZnVuY3Rpb24gWWEoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gOTtjYXNlIDE6cmV0dXJuIDM7Y2FzZSAyOnJldHVybiA1O2Nhc2UgMzpyZXR1cm4gN31yZXR1cm4gMH1mdW5jdGlvbiByYShhKXt2YXIgYz1iLmlzU3RvcHBlZD0hMTtEYihhKXx8KGM9ITApO2VhKGEsITApO2MmJihjPSExLDM+PWEmJihjPSEwKSxhPSExLEEuaXNEcGFkVHlwZSYmYyYmKGE9ITApLEEuaXNCdXR0b25UeXBlJiYhYyYmKGE9ITApLGEmJihwLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPQohMCx5YShwLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0KSkpfWZ1bmN0aW9uIERiKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIEEudXA7Y2FzZSAxOnJldHVybiBBLnJpZ2h0O2Nhc2UgMjpyZXR1cm4gQS5kb3duO2Nhc2UgMzpyZXR1cm4gQS5sZWZ0O2Nhc2UgNDpyZXR1cm4gQS5hO2Nhc2UgNTpyZXR1cm4gQS5iO2Nhc2UgNjpyZXR1cm4gQS5zZWxlY3Q7Y2FzZSA3OnJldHVybiBBLnN0YXJ0O2RlZmF1bHQ6cmV0dXJuITF9fWZ1bmN0aW9uIGVhKGEsYil7c3dpdGNoKGEpe2Nhc2UgMDpBLnVwPWI7YnJlYWs7Y2FzZSAxOkEucmlnaHQ9YjticmVhaztjYXNlIDI6QS5kb3duPWI7YnJlYWs7Y2FzZSAzOkEubGVmdD1iO2JyZWFrO2Nhc2UgNDpBLmE9YjticmVhaztjYXNlIDU6QS5iPWI7YnJlYWs7Y2FzZSA2OkEuc2VsZWN0PWI7YnJlYWs7Y2FzZSA3OkEuc3RhcnQ9Yn19ZnVuY3Rpb24gcGIoYSxjLGYpe2Zvcih2YXIgdT0wO3U8Zjt1Kyspe2Zvcih2YXIgeT1xYihhK3UpLGc9YysKdTs0MDk1OTxnOylnLT04MTkyO09hKGcseSkmJmgoZyx5KX1hPTMyO2IuR0JDRG91YmxlU3BlZWQmJihhPTY0KTtkLkRNQUN5Y2xlcys9Zi8xNiphfWZ1bmN0aW9uIE9hKGEsYyl7aWYoYT09PWIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaClyZXR1cm4gaChiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gsYyYxKSwhMTt2YXIgZj1kLnZpZGVvUmFtTG9jYXRpb24sdT1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbjtpZihhPGYpe2lmKCFkLmlzUm9tT25seSlpZig4MTkxPj1hKXtpZighZC5pc01CQzJ8fG4oNCxjKSljJj0xNSwwPT09Yz9kLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE6MTA9PT1jJiYoZC5pc1JhbUJhbmtpbmdFbmFibGVkPSEwKX1lbHNlIDE2MzgzPj1hPyFkLmlzTUJDNXx8MTIyODc+PWE/KGQuaXNNQkMyJiYoZC5jdXJyZW50Um9tQmFuaz1jJjE1KSxkLmlzTUJDMT8oYyY9MzEsZC5jdXJyZW50Um9tQmFuayY9MjI0KTpkLmlzTUJDMz8oYyY9MTI3LGQuY3VycmVudFJvbUJhbmsmPQoxMjgpOmQuaXNNQkM1JiYoZC5jdXJyZW50Um9tQmFuayY9MCksZC5jdXJyZW50Um9tQmFua3w9Yyk6KGE9MCxmPWQuY3VycmVudFJvbUJhbmsmMjU1LDA8YyYmKGE9MSksZC5jdXJyZW50Um9tQmFuaz1tKGEsZikpOiFkLmlzTUJDMiYmMjQ1NzU+PWE/ZC5pc01CQzEmJmQuaXNNQkMxUm9tTW9kZUVuYWJsZWQ/KGQuY3VycmVudFJvbUJhbmsmPTMxLGQuY3VycmVudFJvbUJhbmt8PWMmMjI0KTooYz1kLmlzTUJDNT9jJjE1OmMmMyxkLmN1cnJlbnRSYW1CYW5rPWMpOiFkLmlzTUJDMiYmMzI3Njc+PWEmJmQuaXNNQkMxJiYobigwLGMpP2QuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA6ZC5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMSk7cmV0dXJuITF9aWYoYT49ZiYmYTxkLmNhcnRyaWRnZVJhbUxvY2F0aW9uKXJldHVybiEwO2lmKGE+PWQuZWNob1JhbUxvY2F0aW9uJiZhPHUpcmV0dXJuIGgoYS04MTkyLGMpLCEwO2lmKGE+PXUmJmE8PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uRW5kKXJldHVybiAyPgpELmN1cnJlbnRMY2RNb2RlPyExOiEwO2lmKGE+PWQudW51c2FibGVNZW1vcnlMb2NhdGlvbiYmYTw9ZC51bnVzYWJsZU1lbW9yeUVuZExvY2F0aW9uKXJldHVybiExO2lmKDY1Mjk2PD1hJiY2NTMxOD49YSl7TGEoKTtpZihhPT09ZS5tZW1vcnlMb2NhdGlvbk5SNTJ8fGUuTlI1MklzU291bmRFbmFibGVkKXtzd2l0Y2goYSl7Y2FzZSB6Lm1lbW9yeUxvY2F0aW9uTlJ4MDp6LnVwZGF0ZU5SeDAoYyk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MDpJLnVwZGF0ZU5SeDAoYyk7YnJlYWs7Y2FzZSB6Lm1lbW9yeUxvY2F0aW9uTlJ4MTp6LnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4MTpMLnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MTpJLnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSBNLm1lbW9yeUxvY2F0aW9uTlJ4MTpNLnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSB6Lm1lbW9yeUxvY2F0aW9uTlJ4Mjp6LnVwZGF0ZU5SeDIoYyk7CmJyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDI6TC51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDI6SS52b2x1bWVDb2RlQ2hhbmdlZD0hMDtJLnVwZGF0ZU5SeDIoYyk7YnJlYWs7Y2FzZSBNLm1lbW9yeUxvY2F0aW9uTlJ4MjpNLnVwZGF0ZU5SeDIoYyk7YnJlYWs7Y2FzZSB6Lm1lbW9yeUxvY2F0aW9uTlJ4Mzp6LnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4MzpMLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MzpJLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSBNLm1lbW9yeUxvY2F0aW9uTlJ4MzpNLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSB6Lm1lbW9yeUxvY2F0aW9uTlJ4NDpuKDcsYykmJih6LnVwZGF0ZU5SeDQoYyksei50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDQ6big3LGMpJiYoTC51cGRhdGVOUng0KGMpLEwudHJpZ2dlcigpKTticmVhazsKY2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4NDpuKDcsYykmJihJLnVwZGF0ZU5SeDQoYyksSS50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgTS5tZW1vcnlMb2NhdGlvbk5SeDQ6big3LGMpJiYoTS51cGRhdGVOUng0KGMpLE0udHJpZ2dlcigpKTticmVhaztjYXNlIGUubWVtb3J5TG9jYXRpb25OUjUwOmUudXBkYXRlTlI1MChjKTt2Lm1peGVyVm9sdW1lQ2hhbmdlZD0hMDticmVhaztjYXNlIGUubWVtb3J5TG9jYXRpb25OUjUxOmUudXBkYXRlTlI1MShjKTt2Lm1peGVyRW5hYmxlZENoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBlLm1lbW9yeUxvY2F0aW9uTlI1MjppZihlLnVwZGF0ZU5SNTIoYyksIW4oNyxjKSlmb3IoYz02NTI5Njs2NTMxOD5jO2MrKyloKGMsMCl9Yz0hMH1lbHNlIGM9ITE7cmV0dXJuIGN9NjUzMjg8PWEmJjY1MzQzPj1hJiZMYSgpO2lmKGE+PUQubWVtb3J5TG9jYXRpb25MY2RDb250cm9sJiZhPD1yLm1lbW9yeUxvY2F0aW9uV2luZG93WCl7aWYoYT09PUQubWVtb3J5TG9jYXRpb25MY2RDb250cm9sKXJldHVybiBELnVwZGF0ZUxjZENvbnRyb2woYyksCiEwO2lmKGE9PT1ELm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKXJldHVybiBELnVwZGF0ZUxjZFN0YXR1cyhjKSwhMTtpZihhPT09ci5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpcmV0dXJuIHIuc2NhbmxpbmVSZWdpc3Rlcj0wLGgoYSwwKSwhMTtpZihhPT09RC5tZW1vcnlMb2NhdGlvbkNvaW5jaWRlbmNlQ29tcGFyZSlyZXR1cm4gRC5jb2luY2lkZW5jZUNvbXBhcmU9YywhMDtpZihhPT09ci5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyKXtjPDw9ODtmb3IoYT0wOzE1OT49YTthKyspZj14KGMrYSksaChkLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbithLGYpO2QuRE1BQ3ljbGVzPTY0NDtyZXR1cm4hMH1zd2l0Y2goYSl7Y2FzZSByLm1lbW9yeUxvY2F0aW9uU2Nyb2xsWDpyLnNjcm9sbFg9YzticmVhaztjYXNlIHIubWVtb3J5TG9jYXRpb25TY3JvbGxZOnIuc2Nyb2xsWT1jO2JyZWFrO2Nhc2Ugci5tZW1vcnlMb2NhdGlvbldpbmRvd1g6ci53aW5kb3dYPWM7YnJlYWs7CmNhc2Ugci5tZW1vcnlMb2NhdGlvbldpbmRvd1k6ci53aW5kb3dZPWN9cmV0dXJuITB9aWYoYT09PWQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcilyZXR1cm4gYi5HQkNFbmFibGVkJiYoZC5pc0hibGFua0hkbWFBY3RpdmUmJiFuKDcsYyk/KGQuaXNIYmxhbmtIZG1hQWN0aXZlPSExLGM9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpLGgoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLGN8MTI4KSk6KGE9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUhpZ2gpLGY9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdyksYT1tKGEsZikmNjU1MjAsZj14KGQubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25IaWdoKSx1PXgoZC5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkxvdyksZj1tKGYsdSksZj0oZiY4MTc2KStkLnZpZGVvUmFtTG9jYXRpb24sdT1LKDcsYyksdT0xNioodSsxKSxuKDcsYyk/KGQuaXNIYmxhbmtIZG1hQWN0aXZlPSEwLGQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPQp1LGQuaGJsYW5rSGRtYVNvdXJjZT1hLGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uPWYsaChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsSyg3LGMpKSk6KHBiKGEsZix1KSxoKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlciwyNTUpKSkpLCExO2lmKChhPT09ZC5tZW1vcnlMb2NhdGlvbkdCQ1dSQU1CYW5rfHxhPT09ZC5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rKSYmZC5pc0hibGFua0hkbWFBY3RpdmUmJigxNjM4NDw9ZC5oYmxhbmtIZG1hU291cmNlJiYzMjc2Nz49ZC5oYmxhbmtIZG1hU291cmNlfHw1MzI0ODw9ZC5oYmxhbmtIZG1hU291cmNlJiY1NzM0Mz49ZC5oYmxhbmtIZG1hU291cmNlKSlyZXR1cm4hMTtpZihhPj16YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXgmJmE8PXphLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZURhdGEpe2lmKGE9PT16YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlRGF0YXx8YT09PXphLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZURhdGEpe2Y9CngoYS0xKTtmPUsoNixmKTt1PSExO2E9PT16YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhJiYodT0hMCk7dmFyIHk9ZiY2Mzt1JiYoeSs9NjQpO2dbNjc1ODQreV09YztjPWY7LS1hO24oNyxjKSYmaChhLGMrMXwxMjgpfXJldHVybiEwfWlmKGE+PWsubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXImJmE8PWsubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2wpe1dhKGsuY3VycmVudEN5Y2xlcyk7ay5jdXJyZW50Q3ljbGVzPTA7c3dpdGNoKGEpe2Nhc2Ugay5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlcjpyZXR1cm4gay51cGRhdGVEaXZpZGVyUmVnaXN0ZXIoYyksITE7Y2FzZSBrLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyOmsudXBkYXRlVGltZXJDb3VudGVyKGMpO2JyZWFrO2Nhc2Ugay5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvOmsudXBkYXRlVGltZXJNb2R1bG8oYyk7YnJlYWs7Y2FzZSBrLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sOmsudXBkYXRlVGltZXJDb250cm9sKGMpfXJldHVybiEwfWE9PT0KQS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyJiZBLnVwZGF0ZUpveXBhZChjKTtpZihhPT09cC5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpcmV0dXJuIHAudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKGMpLCEwO2E9PT1wLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZCYmcC51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKGMpO3JldHVybiEwfWZ1bmN0aW9uIFphKGEpe3N3aXRjaChhPj4xMil7Y2FzZSAwOmNhc2UgMTpjYXNlIDI6Y2FzZSAzOnJldHVybiBhKzg1MDk0NDtjYXNlIDQ6Y2FzZSA1OmNhc2UgNjpjYXNlIDc6dmFyIGM9ZC5jdXJyZW50Um9tQmFuaztkLmlzTUJDNXx8MCE9PWN8fChjPTEpO3JldHVybiAxNjM4NCpjKyhhLWQuc3dpdGNoYWJsZUNhcnRyaWRnZVJvbUxvY2F0aW9uKSs4NTA5NDQ7Y2FzZSA4OmNhc2UgOTpyZXR1cm4gYz0wLGIuR0JDRW5hYmxlZCYmKGM9eChkLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbmspJjEpLGEtZC52aWRlb1JhbUxvY2F0aW9uKwoyMDQ4KzgxOTIqYztjYXNlIDEwOmNhc2UgMTE6cmV0dXJuIDgxOTIqZC5jdXJyZW50UmFtQmFuaysoYS1kLmNhcnRyaWRnZVJhbUxvY2F0aW9uKSs3MTk4NzI7Y2FzZSAxMjpyZXR1cm4gYS1kLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbisxODQzMjtjYXNlIDEzOnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz14KGQubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaykmNyksMT5jJiYoYz0xKSxhLWQuaW50ZXJuYWxSYW1CYW5rWmVyb0xvY2F0aW9uKzE4NDMyKzQwOTYqKGMtMSk7ZGVmYXVsdDpyZXR1cm4gYS1kLmVjaG9SYW1Mb2NhdGlvbis1MTIwMH19ZnVuY3Rpb24gaChhLGIpe2E9WmEoYSk7Z1thXT1ifWZ1bmN0aW9uIE8oYSxiKXtnW2FdPWI/MTowfWZ1bmN0aW9uIHJiKGEsYyxmLHUsZCxoKXtmb3IodmFyIHk9dT4+MzsxNjA+ZDtkKyspe3ZhciBlPWQraDsyNTY8PWUmJihlLT0yNTYpO3ZhciBsPWYrMzIqeSsoZT4+MykscD1aKGwsMCksaz0hMTtpZihULnRpbGVDYWNoaW5nKXt2YXIgbT0KZDt2YXIgQj1hLHE9ZSx2PWwsdz1wLHQ9MDtpZigwPEImJjg8bSYmdz09PWZhLnRpbGVJZCYmbT09PWZhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrKXt2YXIgej13PSExO24oNSx4KHYtMSkpJiYodz0hMCk7big1LHgodikpJiYoej0hMCk7Zm9yKHY9MDs4PnY7disrKWlmKHchPT16JiYodj03LXYpLDE2MD49bSt2KXtmb3IodmFyIEE9bS0oOC12KSxEPTkzMTg0KzMqKDE2MCpCKyhtK3YpKSxDPTA7Mz5DO0MrKylhYShtK3YsQixDLGdbRCtDXSk7QT1nWzY5NjMyKygxNjAqQitBKV07SmEobSt2LEIsSygyLEEpLG4oMixBKSk7dCsrfX1lbHNlIGZhLnRpbGVJZD13O20+PWZhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrJiYoZmEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9bSs4LEI9cSU4LG08QiYmKGZhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrKz1CKSk7bT10OzA8bSYmKGQrPW0tMSxrPSEwKX1ULnRpbGVSZW5kZXJpbmcmJiFrPyhrPWQsbT1hLAp0PWMsQj11JTgscT0wLDA9PWsmJihxPWUtZS84KjgpLGU9NywxNjA8ays4JiYoZT0xNjAtayksdz0tMSx6PTAsYi5HQkNFbmFibGVkJiYodz1aKGwsMSksbigzLHcpJiYoej0xKSxuKDYsdykmJihCPTctQikpLG09aGIocCx0LHoscSxlLEIsayxtLDE2MCw5MzE4NCwhMSwwLHcpLDA8bSYmKGQrPW0tMSkpOmt8fChiLkdCQ0VuYWJsZWQ/KGs9ZCxtPWEsQj11LHQ9eGEoYyxwKSxsPVoobCwxKSxCJT04LG4oNixsKSYmKEI9Ny1CKSxxPTAsbigzLGwpJiYocT0xKSxwPVoodCsyKkIscSksdD1aKHQrMipCKzEscSksQj1lJTgsbig1LGwpfHwoQj03LUIpLGU9MCxuKEIsdCkmJihlPWUrMTw8MSksbihCLHApJiYoZSs9MSksQj1JYShsJjcsZSwhMSkscD1jYSgwLEIpLHQ9Y2EoMSxCKSxCPWNhKDIsQiksYWEoayxtLDAscCksYWEoayxtLDEsdCksYWEoayxtLDIsQiksSmEoayxtLGUsbig3LGwpKSk6KGw9ZCxrPWEsdD11LG09eGEoYyxwKSx0JT04LHA9WihtKzIqdCwwKSxtPVoobSsyKnQrMSwKMCksdD03LWUlOCxlPTAsbih0LG0pJiYoZT1lKzE8PDEpLG4odCxwKSYmKGUrPTEpLHA9SGEoZSxyLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLGFhKGwsaywwLHApLGFhKGwsaywxLHApLGFhKGwsaywyLHApLEphKGwsayxlKSkpfX1mdW5jdGlvbiBzYihhKXtpZihELmVuYWJsZWQpZm9yKHIuc2NhbmxpbmVDeWNsZUNvdW50ZXIrPWE7ci5zY2FubGluZUN5Y2xlQ291bnRlcj49ci5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORSgpOyl7ci5zY2FubGluZUN5Y2xlQ291bnRlci09ci5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORSgpO2E9ci5zY2FubGluZVJlZ2lzdGVyO2lmKDE0ND09PWEpe2lmKFQuZ3JhcGhpY3NEaXNhYmxlU2NhbmxpbmVSZW5kZXJpbmcpZm9yKHZhciBiPTA7MTQ0Pj1iO2IrKykkYShiKTtlbHNlICRhKGEpO2ZvcihiPTA7MTQ0PmI7YisrKWZvcih2YXIgZj0wOzE2MD5mO2YrKylnWzY5NjMyKygxNjAqYitmKV09MDtmYS50aWxlSWQ9LTE7ZmEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9Ci0xfWVsc2UgMTQ0PmEmJihULmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nfHwkYShhKSk7YT0xNTM8YT8wOmErMTtyLnNjYW5saW5lUmVnaXN0ZXI9YX1pZihELmVuYWJsZWQpe2lmKGE9ci5zY2FubGluZVJlZ2lzdGVyLGY9RC5jdXJyZW50TGNkTW9kZSxiPTAsMTQ0PD1hP2I9MTpyLnNjYW5saW5lQ3ljbGVDb3VudGVyPj1yLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERSgpP2I9MjpyLnNjYW5saW5lQ3ljbGVDb3VudGVyPj1yLk1JTl9DWUNMRVNfVFJBTlNGRVJfREFUQV9MQ0RfTU9ERSgpJiYoYj0zKSxmIT09Yil7Zj14KEQubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO0QuY3VycmVudExjZE1vZGU9Yjt2YXIgdT0hMTtzd2l0Y2goYil7Y2FzZSAwOmY9SygwLGYpO2Y9SygxLGYpO3U9bigzLGYpO2JyZWFrO2Nhc2UgMTpmPUsoMSxmKTtmfD0xO3U9big0LGYpO2JyZWFrO2Nhc2UgMjpmPUsoMCxmKTtmfD0yO3U9big1LGYpO2JyZWFrO2Nhc2UgMzpmfD0zfXUmJihwLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPQohMCx5YShwLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSk7MD09PWImJmQuaXNIYmxhbmtIZG1hQWN0aXZlJiYodT0xNixkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZzx1JiYodT1kLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZykscGIoZC5oYmxhbmtIZG1hU291cmNlLGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uLHUpLGQuaGJsYW5rSGRtYVNvdXJjZSs9dSxkLmhibGFua0hkbWFEZXN0aW5hdGlvbis9dSxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZy09dSwwPj1kLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz8oZC5pc0hibGFua0hkbWFBY3RpdmU9ITEsaChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMjU1KSk6aChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsSyg3LGQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nLzE2LTEpKSk7MT09PWImJihwLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPSEwLAp5YShwLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSk7dT1ELmNvaW5jaWRlbmNlQ29tcGFyZTswIT09YiYmMSE9PWJ8fGEhPT11P2Y9SygyLGYpOihmfD00LG4oNixmKSYmKHAuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAseWEocC5iaXRQb3NpdGlvbkxjZEludGVycnVwdCkpKTtoKEQubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsZil9fWVsc2Ugci5zY2FubGluZUN5Y2xlQ291bnRlcj0wLHIuc2NhbmxpbmVSZWdpc3Rlcj0wLGgoci5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIsMCksZj14KEQubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpLGY9SygxLGYpLGY9SygwLGYpLEQuY3VycmVudExjZE1vZGU9MCxoKEQubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsZil9ZnVuY3Rpb24gJGEoYSl7dmFyIGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0O0QuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdCYmKGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQpOwppZihiLkdCQ0VuYWJsZWR8fEQuYmdEaXNwbGF5RW5hYmxlZCl7dmFyIGY9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7RC5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZj1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTt2YXIgdT1yLnNjcm9sbFgsZD1hK3Iuc2Nyb2xsWTsyNTY8PWQmJihkLT0yNTYpO3JiKGEsYyxmLGQsMCx1KX1ELndpbmRvd0Rpc3BsYXlFbmFibGVkJiYoZj1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydCxELndpbmRvd1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZj1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KSx1PXIud2luZG93WCxkPXIud2luZG93WSxhPGR8fCh1LT03LHJiKGEsYyxmLGEtZCx1LC0xKnUpKSk7aWYoRC5zcHJpdGVEaXNwbGF5RW5hYmxlKWZvcihjPUQudGFsbFNwcml0ZVNpemUsZj0zOTswPD1mO2YtLSl7ZD00KmY7dmFyIGU9eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlKwpkKTt1PXgoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzEpO3ZhciBoPXgoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzIpO2UtPTE2O3UtPTg7dmFyIGw9ODtjJiYobD0xNiwxPT09aCUyJiYtLWgpO2lmKGE+PWUmJmE8ZStsKXtkPXgoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzMpO3ZhciBtPW4oNyxkKSxrPW4oNixkKSxwPW4oNSxkKTtlPWEtZTtrJiYoZS09bCxlKj0tMSwtLWUpO2UqPTI7aD14YShyLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCxoKTtsPWgrPWU7ZT0wO2IuR0JDRW5hYmxlZCYmbigzLGQpJiYoZT0xKTtoPVoobCxlKTtsPVoobCsxLGUpO2ZvcihlPTc7MDw9ZTtlLS0pe2s9ZTtwJiYoay09NyxrKj0tMSk7dmFyIHE9MDtuKGssbCkmJihxKz0xLHE8PD0xKTtuKGssaCkmJihxKz0xKTtpZigwIT09cSYmKGs9dSsoNy1lKSwwPD1rJiYxNjA+PWspKXt2YXIgdj0hMSwKdD0hMSx3PSExO2IuR0JDRW5hYmxlZCYmIUQuYmdEaXNwbGF5RW5hYmxlZCYmKHY9ITApO2lmKCF2KXt2YXIgej1nWzY5NjMyKygxNjAqYStrKV0sQT16JjM7bSYmMDxBP3Q9ITA6Yi5HQkNFbmFibGVkJiZuKDIseikmJjA8QSYmKHc9ITApfWlmKHZ8fCF0JiYhdyliLkdCQ0VuYWJsZWQ/KHQ9SWEoZCY3LHEsITApLHE9Y2EoMCx0KSx2PWNhKDEsdCksdD1jYSgyLHQpLGFhKGssYSwwLHEpLGFhKGssYSwxLHYpLGFhKGssYSwyLHQpKToodj1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZSxuKDQsZCkmJih2PXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvKSxxPUhhKHEsdiksYWEoayxhLDAscSksYWEoayxhLDEscSksYWEoayxhLDIscSkpfX19fX1mdW5jdGlvbiBhYShhLGIsZixkKXtnWzkzMTg0KzMqKDE2MCpiK2EpK2ZdPWR9ZnVuY3Rpb24gWihhLGIpe3JldHVybiBnW2EtZC52aWRlb1JhbUxvY2F0aW9uKzIwNDgrODE5MiooYiYxKV19ZnVuY3Rpb24gYWIoYSl7dmFyIGM9CmQudmlkZW9SYW1Mb2NhdGlvbjtyZXR1cm4gYTxjfHxhPj1jJiZhPGQuY2FydHJpZGdlUmFtTG9jYXRpb24/LTE6YT49ZC5lY2hvUmFtTG9jYXRpb24mJmE8ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24/eChhLTgxOTIpOmE+PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uJiZhPD1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD8yPkQuY3VycmVudExjZE1vZGU/MjU1Oi0xOmE9PT1iLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2g/KGE9MjU1LGM9eChiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLG4oMCxjKXx8KGE9SygwLGEpKSxiLkdCQ0RvdWJsZVNwZWVkfHwoYT1LKDcsYSkpLGEpOmE9PT1yLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj8oaChhLHIuc2NhbmxpbmVSZWdpc3Rlciksci5zY2FubGluZVJlZ2lzdGVyKTo2NTI5Njw9YSYmNjUzMTg+PWE/KExhKCksYT1hPT09ZS5tZW1vcnlMb2NhdGlvbk5SNTI/eChlLm1lbW9yeUxvY2F0aW9uTlI1MikmCjEyOHwxMTI6LTEsYSk6NjUzMjg8PWEmJjY1MzQzPj1hPyhMYSgpLC0xKTphPT09ay5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3Rlcj8oYz1IKGsuZGl2aWRlclJlZ2lzdGVyKSxoKGEsYyksYyk6YT09PWsubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI/KGgoYSxrLnRpbWVyQ291bnRlciksay50aW1lckNvdW50ZXIpOmE9PT1wLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdD8yMjR8cC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU6YT09PUEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3Rlcj8oYT1BLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCxBLmlzRHBhZFR5cGU/KGE9QS51cD9LKDIsYSk6YXw0LGE9QS5yaWdodD9LKDAsYSk6YXwxLGE9QS5kb3duP0soMyxhKTphfDgsYT1BLmxlZnQ/SygxLGEpOmF8Mik6QS5pc0J1dHRvblR5cGUmJihhPUEuYT9LKDAsYSk6YXwxLGE9QS5iP0soMSxhKTphfDIsYT1BLnNlbGVjdD9LKDIsYSk6YXw0LGE9QS5zdGFydD9LKDMsYSk6YXw4KSwKYXwyNDApOi0xfWZ1bmN0aW9uIHgoYSl7cmV0dXJuIGdbWmEoYSldfWZ1bmN0aW9uIHFiKGEpe3ZhciBiPWFiKGEpO3N3aXRjaChiKXtjYXNlIC0xOnJldHVybiB4KGEpO2RlZmF1bHQ6cmV0dXJuIGJ9fWZ1bmN0aW9uIFAoYSl7cmV0dXJuIDA8Z1thXT8hMDohMX1mdW5jdGlvbiBoYShhKXtRKGIucmVnaXN0ZXJBLGEpO1NhKGIucmVnaXN0ZXJBLGEpO2IucmVnaXN0ZXJBPWIucmVnaXN0ZXJBK2EmMjU1OzA9PT1iLnJlZ2lzdGVyQT9sKDEpOmwoMCk7cSgwKX1mdW5jdGlvbiBpYShhKXt2YXIgYz1iLnJlZ2lzdGVyQSthK1MoKSYyNTU7MCE9KChiLnJlZ2lzdGVyQV5hXmMpJjE2KT9DKDEpOkMoMCk7MDwoYi5yZWdpc3RlckErYStTKCkmMjU2KT93KDEpOncoMCk7Yi5yZWdpc3RlckE9YzswPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApO3EoMCl9ZnVuY3Rpb24gamEoYSl7dmFyIGM9LTEqYTtRKGIucmVnaXN0ZXJBLGMpO1NhKGIucmVnaXN0ZXJBLGMpO2IucmVnaXN0ZXJBPWIucmVnaXN0ZXJBLQphJjI1NTswPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApO3EoMSl9ZnVuY3Rpb24ga2EoYSl7dmFyIGM9Yi5yZWdpc3RlckEtYS1TKCkmMjU1OzAhPSgoYi5yZWdpc3RlckFeYV5jKSYxNik/QygxKTpDKDApOzA8KGIucmVnaXN0ZXJBLWEtUygpJjI1Nik/dygxKTp3KDApO2IucmVnaXN0ZXJBPWM7MD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKTtxKDEpfWZ1bmN0aW9uIGxhKGEpe2IucmVnaXN0ZXJBJj1hOzA9PT1iLnJlZ2lzdGVyQT9sKDEpOmwoMCk7cSgwKTtDKDEpO3coMCl9ZnVuY3Rpb24gbWEoYSl7Yi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBXmEpJjI1NTswPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApO3EoMCk7QygwKTt3KDApfWZ1bmN0aW9uIG5hKGEpe2IucmVnaXN0ZXJBfD1hOzA9PT1iLnJlZ2lzdGVyQT9sKDEpOmwoMCk7cSgwKTtDKDApO3coMCl9ZnVuY3Rpb24gb2EoYSl7YSo9LTE7UShiLnJlZ2lzdGVyQSxhKTtTYShiLnJlZ2lzdGVyQSxhKTswPT09Yi5yZWdpc3RlckErYT8KbCgxKTpsKDApO3EoMSl9ZnVuY3Rpb24gc2EoYSxiKXswPT09KGImMTw8YSk/bCgxKTpsKDApO3EoMCk7QygxKTtyZXR1cm4gYn1mdW5jdGlvbiBZKGEsYixmKXtyZXR1cm4gMDxiP2Z8MTw8YTpmJn4oMTw8YSl9ZnVuY3Rpb24gQWEoYSl7YT1SYShhKTtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrYSY2NTUzNTtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNX1mdW5jdGlvbiB0YihhKXtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtiLmlzSGFsdEJ1ZyYmKGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlci0xJjY1NTM1KTtzd2l0Y2goKGEmMjQwKT4+NCl7Y2FzZSAwOnJldHVybiBFYihhKTtjYXNlIDE6cmV0dXJuIEZiKGEpO2Nhc2UgMjpyZXR1cm4gR2IoYSk7Y2FzZSAzOnJldHVybiBIYihhKTtjYXNlIDQ6cmV0dXJuIEliKGEpO2Nhc2UgNTpyZXR1cm4gSmIoYSk7Y2FzZSA2OnJldHVybiBLYihhKTtjYXNlIDc6cmV0dXJuIExiKGEpOwpjYXNlIDg6cmV0dXJuIE1iKGEpO2Nhc2UgOTpyZXR1cm4gTmIoYSk7Y2FzZSAxMDpyZXR1cm4gT2IoYSk7Y2FzZSAxMTpyZXR1cm4gUGIoYSk7Y2FzZSAxMjpyZXR1cm4gUWIoYSk7Y2FzZSAxMzpyZXR1cm4gUmIoYSk7Y2FzZSAxNDpyZXR1cm4gU2IoYSk7ZGVmYXVsdDpyZXR1cm4gVGIoYSl9fWZ1bmN0aW9uIEooYSl7cGEoNCk7cmV0dXJuIHFiKGEpfWZ1bmN0aW9uIFIoYSxiKXtwYSg0KTtPYShhLGIpJiZoKGEsYil9ZnVuY3Rpb24gZGEoYSl7cGEoOCk7dmFyIGI9YWIoYSk7c3dpdGNoKGIpe2Nhc2UgLTE6Yj14KGEpfWErPTE7dmFyIGY9YWIoYSk7c3dpdGNoKGYpe2Nhc2UgLTE6YT14KGEpO2JyZWFrO2RlZmF1bHQ6YT1mfXJldHVybiBtKGEsYil9ZnVuY3Rpb24gVShhLGIpe3BhKDgpO3ZhciBjPUgoYik7YiY9MjU1O3ZhciBkPWErMTtPYShhLGIpJiZoKGEsYik7T2EoZCxjKSYmaChkLGMpfWZ1bmN0aW9uIEcoKXtwYSg0KTtyZXR1cm4geChiLnByb2dyYW1Db3VudGVyKX1mdW5jdGlvbiBYKCl7cGEoNCk7CnZhciBhPXgoYi5wcm9ncmFtQ291bnRlcisxJjY1NTM1KTtyZXR1cm4gbShhLEcoKSl9ZnVuY3Rpb24gRWIoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gNDtjYXNlIDE6cmV0dXJuIGE9WCgpLGIucmVnaXN0ZXJCPUgoYSksYi5yZWdpc3RlckM9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDI6cmV0dXJuIFIobShiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYi5yZWdpc3RlckEpLDQ7Y2FzZSAzOnJldHVybiBhPW0oYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpLGErKyxiLnJlZ2lzdGVyQj1IKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSA0OnJldHVybiBRKGIucmVnaXN0ZXJCLDEpLGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJCKzEmMjU1LDA9PT1iLnJlZ2lzdGVyQj9sKDEpOmwoMCkscSgwKSw0O2Nhc2UgNTpyZXR1cm4gUShiLnJlZ2lzdGVyQiwtMSksYi5yZWdpc3RlckI9Yi5yZWdpc3RlckItMSYyNTUsMD09PWIucmVnaXN0ZXJCPwpsKDEpOmwoMCkscSgxKSw0O2Nhc2UgNjpyZXR1cm4gYi5yZWdpc3RlckI9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA3OjEyOD09PShiLnJlZ2lzdGVyQSYxMjgpP3coMSk6dygwKTthPWI7dmFyIGM9Yi5yZWdpc3RlckE7YS5yZWdpc3RlckE9KGM8PDF8Yz4+NykmMjU1O2woMCk7cSgwKTtDKDApO3JldHVybiA0O2Nhc2UgODpyZXR1cm4gVShYKCksYi5zdGFja1BvaW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSA5OnJldHVybiBhPW0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGM9bShiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksdGEoYSxjLCExKSxhPWErYyY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHEoMCksODtjYXNlIDEwOnJldHVybiBiLnJlZ2lzdGVyQT1KKG0oYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpKSw0O2Nhc2UgMTE6cmV0dXJuIGE9bShiLnJlZ2lzdGVyQiwKYi5yZWdpc3RlckMpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJCPUgoYSksYi5yZWdpc3RlckM9YSYyNTUsODtjYXNlIDEyOnJldHVybiBRKGIucmVnaXN0ZXJDLDEpLGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJDKzEmMjU1LDA9PT1iLnJlZ2lzdGVyQz9sKDEpOmwoMCkscSgwKSw0O2Nhc2UgMTM6cmV0dXJuIFEoYi5yZWdpc3RlckMsLTEpLGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJDLTEmMjU1LDA9PT1iLnJlZ2lzdGVyQz9sKDEpOmwoMCkscSgxKSw0O2Nhc2UgMTQ6cmV0dXJuIGIucmVnaXN0ZXJDPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMTU6cmV0dXJuIDA8KGIucmVnaXN0ZXJBJjEpP3coMSk6dygwKSxhPWIsYz1iLnJlZ2lzdGVyQSxhLnJlZ2lzdGVyQT0oYz4+MXxjPDw3KSYyNTUsbCgwKSxxKDApLEMoMCksNH1yZXR1cm4tMX1mdW5jdGlvbiBGYihhKXtzd2l0Y2goYSl7Y2FzZSAxNjppZihiLkdCQ0VuYWJsZWQmJihhPUooYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoKSwKbigwLGEpKSlyZXR1cm4gYT1LKDAsYSksbig3LGEpPyhiLkdCQ0RvdWJsZVNwZWVkPSExLGE9Syg3LGEpKTooYi5HQkNEb3VibGVTcGVlZD0hMCxhfD0xMjgpLFIoYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoLGEpLDY4O2IuaXNTdG9wcGVkPSEwO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1O3JldHVybiA0O2Nhc2UgMTc6cmV0dXJuIGE9WCgpLGIucmVnaXN0ZXJEPUgoYSksYi5yZWdpc3RlckU9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDE4OnJldHVybiBSKG0oYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTk6cmV0dXJuIGE9bShiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSksYT1hKzEmNjU1MzUsYi5yZWdpc3RlckQ9SChhKSxiLnJlZ2lzdGVyRT1hJjI1NSw4O2Nhc2UgMjA6cmV0dXJuIFEoYi5yZWdpc3RlckQsMSksYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckQrCjEmMjU1LDA9PT1iLnJlZ2lzdGVyRD9sKDEpOmwoMCkscSgwKSw0O2Nhc2UgMjE6cmV0dXJuIFEoYi5yZWdpc3RlckQsLTEpLGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJELTEmMjU1LDA9PT1iLnJlZ2lzdGVyRD9sKDEpOmwoMCkscSgxKSw0O2Nhc2UgMjI6cmV0dXJuIGIucmVnaXN0ZXJEPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjM6cmV0dXJuIGE9ITEsMTI4PT09KGIucmVnaXN0ZXJBJjEyOCkmJihhPSEwKSxiLnJlZ2lzdGVyQT0oYi5yZWdpc3RlckE8PDF8UygpKSYyNTUsYT93KDEpOncoMCksbCgwKSxxKDApLEMoMCksNDtjYXNlIDI0OnJldHVybiBBYShHKCkpLDg7Y2FzZSAyNTphPW0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpO3ZhciBjPW0oYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpO3RhKGEsYywhMSk7YT1hK2MmNjU1MzU7Yi5yZWdpc3Rlckg9SChhKTtiLnJlZ2lzdGVyTD1hJjI1NTtxKDApO3JldHVybiA4O2Nhc2UgMjY6cmV0dXJuIGE9Cm0oYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGIucmVnaXN0ZXJBPUooYSksNDtjYXNlIDI3OnJldHVybiBhPW0oYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJEPUgoYSksYi5yZWdpc3RlckU9YSYyNTUsODtjYXNlIDI4OnJldHVybiBRKGIucmVnaXN0ZXJFLDEpLGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJFKzEmMjU1LDA9PT1iLnJlZ2lzdGVyRT9sKDEpOmwoMCkscSgwKSw0O2Nhc2UgMjk6cmV0dXJuIFEoYi5yZWdpc3RlckUsLTEpLGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJFLTEmMjU1LDA9PT1iLnJlZ2lzdGVyRT9sKDEpOmwoMCkscSgxKSw0O2Nhc2UgMzA6cmV0dXJuIGIucmVnaXN0ZXJFPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMzE6cmV0dXJuIGE9ITEsMT09PShiLnJlZ2lzdGVyQSYxKSYmKGE9ITApLGIucmVnaXN0ZXJBPShiLnJlZ2lzdGVyQT4+MXxTKCk8PDcpJjI1NSxhP3coMSk6dygwKSwKbCgwKSxxKDApLEMoMCksNH1yZXR1cm4tMX1mdW5jdGlvbiBHYihhKXtzd2l0Y2goYSl7Y2FzZSAzMjpyZXR1cm4gMD09PXFhKCk/QWEoRygpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMzM6cmV0dXJuIGE9WCgpLGIucmVnaXN0ZXJIPUgoYSksYi5yZWdpc3Rlckw9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDM0OnJldHVybiBhPW0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLFIoYSxiLnJlZ2lzdGVyQSksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgMzU6cmV0dXJuIGE9bShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw4O2Nhc2UgMzY6cmV0dXJuIFEoYi5yZWdpc3RlckgsMSksYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckgrMSYyNTUsMD09PWIucmVnaXN0ZXJIPwpsKDEpOmwoMCkscSgwKSw0O2Nhc2UgMzc6cmV0dXJuIFEoYi5yZWdpc3RlckgsLTEpLGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILTEmMjU1LDA9PT1iLnJlZ2lzdGVySD9sKDEpOmwoMCkscSgxKSw0O2Nhc2UgMzg6cmV0dXJuIGIucmVnaXN0ZXJIPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMzk6dmFyIGM9MDswPChiLnJlZ2lzdGVyRj4+NSYxKSYmKGN8PTYpOzA8UygpJiYoY3w9OTYpOzA8KGIucmVnaXN0ZXJGPj42JjEpP2E9Yi5yZWdpc3RlckEtYyYyNTU6KDk8KGIucmVnaXN0ZXJBJjE1KSYmKGN8PTYpLDE1MzxiLnJlZ2lzdGVyQSYmKGN8PTk2KSxhPWIucmVnaXN0ZXJBK2MmMjU1KTswPT09YT9sKDEpOmwoMCk7MCE9PShjJjk2KT93KDEpOncoMCk7QygwKTtiLnJlZ2lzdGVyQT1hO3JldHVybiA0O2Nhc2UgNDA6cmV0dXJuIDA8cWEoKT9BYShHKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7CmNhc2UgNDE6cmV0dXJuIGE9bShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksdGEoYSxhLCExKSxhPTIqYSY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHEoMCksODtjYXNlIDQyOnJldHVybiBhPW0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBPUooYSksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNDM6cmV0dXJuIGE9bShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw4O2Nhc2UgNDQ6cmV0dXJuIFEoYi5yZWdpc3RlckwsMSksYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckwrMSYyNTUsMD09PWIucmVnaXN0ZXJMP2woMSk6bCgwKSxxKDApLDQ7Y2FzZSA0NTpyZXR1cm4gUShiLnJlZ2lzdGVyTCwtMSksYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckwtMSYyNTUsMD09PWIucmVnaXN0ZXJMP2woMSk6bCgwKSxxKDEpLAo0O2Nhc2UgNDY6cmV0dXJuIGIucmVnaXN0ZXJMPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNDc6cmV0dXJuIGIucmVnaXN0ZXJBPX5iLnJlZ2lzdGVyQSxxKDEpLEMoMSksNH1yZXR1cm4tMX1mdW5jdGlvbiBIYihhKXtzd2l0Y2goYSl7Y2FzZSA0ODpyZXR1cm4gMD09PVMoKT9BYShHKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSA0OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9WCgpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSA1MDpyZXR1cm4gYT1tKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxSKGEsYi5yZWdpc3RlckEpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJIPUgoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDUxOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisxJjY1NTM1LDg7Y2FzZSA1MjphPW0oYi5yZWdpc3RlckgsCmIucmVnaXN0ZXJMKTt2YXIgYz1KKGEpO1EoYywxKTtjPWMrMSYyNTU7MD09PWM/bCgxKTpsKDApO3EoMCk7UihhLGMpO3JldHVybiA0O2Nhc2UgNTM6cmV0dXJuIGE9bShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYz1KKGEpLFEoYywtMSksYz1jLTEmMjU1LDA9PT1jP2woMSk6bCgwKSxxKDEpLFIoYSxjKSw0O2Nhc2UgNTQ6cmV0dXJuIFIobShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNTU6cmV0dXJuIHEoMCksQygwKSx3KDEpLDQ7Y2FzZSA1NjpyZXR1cm4gMT09PVMoKT9BYShHKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSA1NzpyZXR1cm4gYT1tKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSx0YShhLGIuc3RhY2tQb2ludGVyLCExKSxhPWErYi5zdGFja1BvaW50ZXImNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJgoyNTUscSgwKSw4O2Nhc2UgNTg6cmV0dXJuIGE9bShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckE9SihhKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSA1OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMSY2NTUzNSw4O2Nhc2UgNjA6cmV0dXJuIFEoYi5yZWdpc3RlckEsMSksYi5yZWdpc3RlckE9Yi5yZWdpc3RlckErMSYyNTUsMD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKSxxKDApLDQ7Y2FzZSA2MTpyZXR1cm4gUShiLnJlZ2lzdGVyQSwtMSksYi5yZWdpc3RlckE9Yi5yZWdpc3RlckEtMSYyNTUsMD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKSxxKDEpLDQ7Y2FzZSA2MjpyZXR1cm4gYi5yZWdpc3RlckE9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA2MzpyZXR1cm4gcSgwKSxDKDApLDA8UygpP3coMCk6dygxKSw0fXJldHVybi0xfWZ1bmN0aW9uIEliKGEpe3N3aXRjaChhKXtjYXNlIDY0OnJldHVybiA0OwpjYXNlIDY1OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQyw0O2Nhc2UgNjY6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJELDQ7Y2FzZSA2NzpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckUsNDtjYXNlIDY4OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVySCw0O2Nhc2UgNjk6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJMLDQ7Y2FzZSA3MDpyZXR1cm4gYi5yZWdpc3RlckI9SihtKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDcxOnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQSw0O2Nhc2UgNzI6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJCLDQ7Y2FzZSA3MzpyZXR1cm4gNDtjYXNlIDc0OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyRCw0O2Nhc2UgNzU6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJFLDQ7Y2FzZSA3NjpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckgsNDtjYXNlIDc3OnJldHVybiBiLnJlZ2lzdGVyQz0KYi5yZWdpc3RlckwsNDtjYXNlIDc4OnJldHVybiBiLnJlZ2lzdGVyQz1KKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgNzk6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSmIoYSl7c3dpdGNoKGEpe2Nhc2UgODA6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJCLDQ7Y2FzZSA4MTpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckMsNDtjYXNlIDgyOnJldHVybiA0O2Nhc2UgODM6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJFLDQ7Y2FzZSA4NDpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckgsNDtjYXNlIDg1OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyTCw0O2Nhc2UgODY6cmV0dXJuIGIucmVnaXN0ZXJEPUoobShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA4NzpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckEsNDtjYXNlIDg4OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQiwKNDtjYXNlIDg5OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQyw0O2Nhc2UgOTA6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJELDQ7Y2FzZSA5MTpyZXR1cm4gNDtjYXNlIDkyOnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVySCw0O2Nhc2UgOTM6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJMLDQ7Y2FzZSA5NDpyZXR1cm4gYi5yZWdpc3RlckU9SihtKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDk1OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIEtiKGEpe3N3aXRjaChhKXtjYXNlIDk2OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQiw0O2Nhc2UgOTc6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJDLDQ7Y2FzZSA5ODpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckQsNDtjYXNlIDk5OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTAwOnJldHVybiBiLnJlZ2lzdGVySD0KYi5yZWdpc3RlckgsNDtjYXNlIDEwMTpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckwsNDtjYXNlIDEwMjpyZXR1cm4gYi5yZWdpc3Rlckg9SihtKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDEwMzpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckEsNDtjYXNlIDEwNDpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckIsNDtjYXNlIDEwNTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckMsNDtjYXNlIDEwNjpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckQsNDtjYXNlIDEwNzpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckUsNDtjYXNlIDEwODpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckgsNDtjYXNlIDEwOTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckwsNDtjYXNlIDExMDpyZXR1cm4gYi5yZWdpc3Rlckw9SihtKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDExMTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckEsCjR9cmV0dXJuLTF9ZnVuY3Rpb24gTGIoYSl7c3dpdGNoKGEpe2Nhc2UgMTEyOnJldHVybiBSKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTEzOnJldHVybiBSKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTE0OnJldHVybiBSKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTE1OnJldHVybiBSKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTE2OnJldHVybiBSKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTE3OnJldHVybiBSKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTE4OnJldHVybiBkLmlzSGJsYW5rSGRtYUFjdGl2ZXx8Yi5lbmFibGVIYWx0KCksNDtjYXNlIDExOTpyZXR1cm4gUihtKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQSksCjQ7Y2FzZSAxMjA6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJCLDQ7Y2FzZSAxMjE6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJDLDQ7Y2FzZSAxMjI6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJELDQ7Y2FzZSAxMjM6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMjQ6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJILDQ7Y2FzZSAxMjU6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMjY6cmV0dXJuIGIucmVnaXN0ZXJBPUoobShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSAxMjc6cmV0dXJuIDR9cmV0dXJuLTF9ZnVuY3Rpb24gTWIoYSl7c3dpdGNoKGEpe2Nhc2UgMTI4OnJldHVybiBoYShiLnJlZ2lzdGVyQiksNDtjYXNlIDEyOTpyZXR1cm4gaGEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMzA6cmV0dXJuIGhhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTMxOnJldHVybiBoYShiLnJlZ2lzdGVyRSksNDsKY2FzZSAxMzI6cmV0dXJuIGhhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTMzOnJldHVybiBoYShiLnJlZ2lzdGVyTCksNDtjYXNlIDEzNDpyZXR1cm4gYT1KKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxoYShhKSw0O2Nhc2UgMTM1OnJldHVybiBoYShiLnJlZ2lzdGVyQSksNDtjYXNlIDEzNjpyZXR1cm4gaWEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMzc6cmV0dXJuIGlhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTM4OnJldHVybiBpYShiLnJlZ2lzdGVyRCksNDtjYXNlIDEzOTpyZXR1cm4gaWEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNDA6cmV0dXJuIGlhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTQxOnJldHVybiBpYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE0MjpyZXR1cm4gYT1KKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxpYShhKSw0O2Nhc2UgMTQzOnJldHVybiBpYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBOYihhKXtzd2l0Y2goYSl7Y2FzZSAxNDQ6cmV0dXJuIGphKGIucmVnaXN0ZXJCKSwKNDtjYXNlIDE0NTpyZXR1cm4gamEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNDY6cmV0dXJuIGphKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTQ3OnJldHVybiBqYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE0ODpyZXR1cm4gamEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNDk6cmV0dXJuIGphKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTUwOnJldHVybiBhPUoobShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGphKGEpLDQ7Y2FzZSAxNTE6cmV0dXJuIGphKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTUyOnJldHVybiBrYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE1MzpyZXR1cm4ga2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNTQ6cmV0dXJuIGthKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTU1OnJldHVybiBrYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE1NjpyZXR1cm4ga2EoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNTc6cmV0dXJuIGthKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTU4OnJldHVybiBhPUoobShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLAprYShhKSw0O2Nhc2UgMTU5OnJldHVybiBrYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBPYihhKXtzd2l0Y2goYSl7Y2FzZSAxNjA6cmV0dXJuIGxhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTYxOnJldHVybiBsYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE2MjpyZXR1cm4gbGEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNjM6cmV0dXJuIGxhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTY0OnJldHVybiBsYShiLnJlZ2lzdGVySCksNDtjYXNlIDE2NTpyZXR1cm4gbGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNjY6cmV0dXJuIGE9SihtKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksbGEoYSksNDtjYXNlIDE2NzpyZXR1cm4gbGEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxNjg6cmV0dXJuIG1hKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTY5OnJldHVybiBtYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE3MDpyZXR1cm4gbWEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNzE6cmV0dXJuIG1hKGIucmVnaXN0ZXJFKSwKNDtjYXNlIDE3MjpyZXR1cm4gbWEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNzM6cmV0dXJuIG1hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTc0OnJldHVybiBhPUoobShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLG1hKGEpLDQ7Y2FzZSAxNzU6cmV0dXJuIG1hKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIFBiKGEpe3N3aXRjaChhKXtjYXNlIDE3NjpyZXR1cm4gbmEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNzc6cmV0dXJuIG5hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTc4OnJldHVybiBuYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE3OTpyZXR1cm4gbmEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxODA6cmV0dXJuIG5hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTgxOnJldHVybiBuYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE4MjpyZXR1cm4gYT1KKG0oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxuYShhKSw0O2Nhc2UgMTgzOnJldHVybiBuYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE4NDpyZXR1cm4gb2EoYi5yZWdpc3RlckIpLAo0O2Nhc2UgMTg1OnJldHVybiBvYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE4NjpyZXR1cm4gb2EoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxODc6cmV0dXJuIG9hKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTg4OnJldHVybiBvYShiLnJlZ2lzdGVySCksNDtjYXNlIDE4OTpyZXR1cm4gb2EoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxOTA6cmV0dXJuIGE9SihtKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksb2EoYSksNDtjYXNlIDE5MTpyZXR1cm4gb2EoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gUWIoYSl7c3dpdGNoKGEpe2Nhc2UgMTkyOnJldHVybiAwPT09cWEoKT8oYi5wcm9ncmFtQ291bnRlcj1kYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwxMik6ODtjYXNlIDE5MzpyZXR1cm4gYT1kYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSxiLnJlZ2lzdGVyQj1IKGEpLGIucmVnaXN0ZXJDPQphJjI1NSw0O2Nhc2UgMTk0OmlmKDA9PT1xYSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVgoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDE5NTpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1YKCksODtjYXNlIDE5NjppZigwPT09cWEoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1YKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAxOTc6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixtKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSksODtjYXNlIDE5ODpyZXR1cm4gaGEoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSwKNDtjYXNlIDE5OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MCw4O2Nhc2UgMjAwOnJldHVybiAxPT09cWEoKT8oYi5wcm9ncmFtQ291bnRlcj1kYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwxMik6ODtjYXNlIDIwMTpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1kYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSw4O2Nhc2UgMjAyOmlmKDE9PT1xYSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVgoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIwMzp2YXIgYz1HKCk7YT0tMTt2YXIgZj0hMSxkPTAsZT0wLGc9YyU4O3N3aXRjaChnKXtjYXNlIDA6ZD1iLnJlZ2lzdGVyQjticmVhaztjYXNlIDE6ZD0KYi5yZWdpc3RlckM7YnJlYWs7Y2FzZSAyOmQ9Yi5yZWdpc3RlckQ7YnJlYWs7Y2FzZSAzOmQ9Yi5yZWdpc3RlckU7YnJlYWs7Y2FzZSA0OmQ9Yi5yZWdpc3Rlckg7YnJlYWs7Y2FzZSA1OmQ9Yi5yZWdpc3Rlckw7YnJlYWs7Y2FzZSA2OmQ9SihtKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSk7YnJlYWs7Y2FzZSA3OmQ9Yi5yZWdpc3RlckF9dmFyIGg9KGMmMjQwKT4+NDtzd2l0Y2goaCl7Y2FzZSAwOjc+PWM/KGM9ZCwxMjg9PT0oYyYxMjgpP3coMSk6dygwKSxjPShjPDwxfGM+PjcpJjI1NSwwPT09Yz9sKDEpOmwoMCkscSgwKSxDKDApLGU9YyxmPSEwKToxNT49YyYmKGM9ZCwwPChjJjEpP3coMSk6dygwKSxjPShjPj4xfGM8PDcpJjI1NSwwPT09Yz9sKDEpOmwoMCkscSgwKSxDKDApLGU9YyxmPSEwKTticmVhaztjYXNlIDE6MjM+PWM/KGM9ZCxmPSExLDEyOD09PShjJjEyOCkmJihmPSEwKSxjPShjPDwxfFMoKSkmMjU1LGY/dygxKTp3KDApLDA9PT1jP2woMSk6bCgwKSxxKDApLEMoMCksCmU9YyxmPSEwKTozMT49YyYmKGM9ZCxmPSExLDE9PT0oYyYxKSYmKGY9ITApLGM9KGM+PjF8UygpPDw3KSYyNTUsZj93KDEpOncoMCksMD09PWM/bCgxKTpsKDApLHEoMCksQygwKSxlPWMsZj0hMCk7YnJlYWs7Y2FzZSAyOjM5Pj1jPyhjPWQsZj0hMSwxMjg9PT0oYyYxMjgpJiYoZj0hMCksYz1jPDwxJjI1NSxmP3coMSk6dygwKSwwPT09Yz9sKDEpOmwoMCkscSgwKSxDKDApLGU9YyxmPSEwKTo0Nz49YyYmKGM9ZCxmPSExLDEyOD09PShjJjEyOCkmJihmPSEwKSxkPSExLDE9PT0oYyYxKSYmKGQ9ITApLGM9Yz4+MSYyNTUsZiYmKGN8PTEyOCksMD09PWM/bCgxKTpsKDApLHEoMCksQygwKSxkP3coMSk6dygwKSxlPWMsZj0hMCk7YnJlYWs7Y2FzZSAzOjU1Pj1jPyhjPWQsYz0oKGMmMTUpPDw0fChjJjI0MCk+PjQpJjI1NSwwPT09Yz9sKDEpOmwoMCkscSgwKSxDKDApLHcoMCksZT1jLGY9ITApOjYzPj1jJiYoYz1kLGY9ITEsMT09PShjJjEpJiYoZj0hMCksYz1jPj4xJjI1NSwwPT09Yz8KbCgxKTpsKDApLHEoMCksQygwKSxmP3coMSk6dygwKSxlPWMsZj0hMCk7YnJlYWs7Y2FzZSA0OjcxPj1jPyhlPXNhKDAsZCksZj0hMCk6Nzk+PWMmJihlPXNhKDEsZCksZj0hMCk7YnJlYWs7Y2FzZSA1Ojg3Pj1jPyhlPXNhKDIsZCksZj0hMCk6OTU+PWMmJihlPXNhKDMsZCksZj0hMCk7YnJlYWs7Y2FzZSA2OjEwMz49Yz8oZT1zYSg0LGQpLGY9ITApOjExMT49YyYmKGU9c2EoNSxkKSxmPSEwKTticmVhaztjYXNlIDc6MTE5Pj1jPyhlPXNhKDYsZCksZj0hMCk6MTI3Pj1jJiYoZT1zYSg3LGQpLGY9ITApO2JyZWFrO2Nhc2UgODoxMzU+PWM/KGU9WSgwLDAsZCksZj0hMCk6MTQzPj1jJiYoZT1ZKDEsMCxkKSxmPSEwKTticmVhaztjYXNlIDk6MTUxPj1jPyhlPVkoMiwwLGQpLGY9ITApOjE1OT49YyYmKGU9WSgzLDAsZCksZj0hMCk7YnJlYWs7Y2FzZSAxMDoxNjc+PWM/KGU9WSg0LDAsZCksZj0hMCk6MTc1Pj1jJiYoZT1ZKDUsMCxkKSxmPSEwKTticmVhaztjYXNlIDExOjE4Mz49Yz8oZT0KWSg2LDAsZCksZj0hMCk6MTkxPj1jJiYoZT1ZKDcsMCxkKSxmPSEwKTticmVhaztjYXNlIDEyOjE5OT49Yz8oZT1ZKDAsMSxkKSxmPSEwKToyMDc+PWMmJihlPVkoMSwxLGQpLGY9ITApO2JyZWFrO2Nhc2UgMTM6MjE1Pj1jPyhlPVkoMiwxLGQpLGY9ITApOjIyMz49YyYmKGU9WSgzLDEsZCksZj0hMCk7YnJlYWs7Y2FzZSAxNDoyMzE+PWM/KGU9WSg0LDEsZCksZj0hMCk6MjM5Pj1jJiYoZT1ZKDUsMSxkKSxmPSEwKTticmVhaztjYXNlIDE1OjI0Nz49Yz8oZT1ZKDYsMSxkKSxmPSEwKToyNTU+PWMmJihlPVkoNywxLGQpLGY9ITApfXN3aXRjaChnKXtjYXNlIDA6Yi5yZWdpc3RlckI9ZTticmVhaztjYXNlIDE6Yi5yZWdpc3RlckM9ZTticmVhaztjYXNlIDI6Yi5yZWdpc3RlckQ9ZTticmVhaztjYXNlIDM6Yi5yZWdpc3RlckU9ZTticmVhaztjYXNlIDQ6Yi5yZWdpc3Rlckg9ZTticmVhaztjYXNlIDU6Yi5yZWdpc3Rlckw9ZTticmVhaztjYXNlIDY6KDQ+aHx8NzxoKSYmUihtKGIucmVnaXN0ZXJILApiLnJlZ2lzdGVyTCksZSk7YnJlYWs7Y2FzZSA3OmIucmVnaXN0ZXJBPWV9ZiYmKGE9NCk7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7cmV0dXJuIGE7Y2FzZSAyMDQ6aWYoMT09PXFhKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzIpLGIucHJvZ3JhbUNvdW50ZXI9WCgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjA1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVgoKSw4O2Nhc2UgMjA2OnJldHVybiBpYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMDc6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLQoyJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj04fXJldHVybi0xfWZ1bmN0aW9uIFJiKGEpe3N3aXRjaChhKXtjYXNlIDIwODpyZXR1cm4gMD09PVMoKT8oYi5wcm9ncmFtQ291bnRlcj1kYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwxMik6ODtjYXNlIDIwOTpyZXR1cm4gYT1kYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSxiLnJlZ2lzdGVyRD1IKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDQ7Y2FzZSAyMTA6aWYoMD09PVMoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1YKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMTI6aWYoMD09PVMoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrCjIpLGIucHJvZ3JhbUNvdW50ZXI9WCgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjEzOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsbShiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSkpLDg7Y2FzZSAyMTQ6cmV0dXJuIGphKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIxNTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MTYsODtjYXNlIDIxNjpyZXR1cm4gMT09PVMoKT8oYi5wcm9ncmFtQ291bnRlcj1kYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwxMik6ODtjYXNlIDIxNzpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1kYShiLnN0YWNrUG9pbnRlciksCk5hKCEwKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDg7Y2FzZSAyMTg6aWYoMT09PVMoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1YKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjA6aWYoMT09PVMoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1YKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjI6cmV0dXJuIGthKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIyMzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9CjI0LDh9cmV0dXJuLTF9ZnVuY3Rpb24gU2IoYSl7c3dpdGNoKGEpe2Nhc2UgMjI0OnJldHVybiBhPUcoKSxSKDY1MjgwK2EsYi5yZWdpc3RlckEpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMjU6cmV0dXJuIGE9ZGEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgMjI2OnJldHVybiBSKDY1MjgwK2IucmVnaXN0ZXJDLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMjI5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsbShiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDg7Y2FzZSAyMzA6cmV0dXJuIGxhKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzMTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItCjImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTMyLDg7Y2FzZSAyMzI6cmV0dXJuIGE9UmEoRygpKSx0YShiLnN0YWNrUG9pbnRlcixhLCEwKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcithJjY1NTM1LGwoMCkscSgwKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSwxMjtjYXNlIDIzMzpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1tKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSw0O2Nhc2UgMjM0OnJldHVybiBSKFgoKSxiLnJlZ2lzdGVyQSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDIzODpyZXR1cm4gbWEoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjM5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksCmIucHJvZ3JhbUNvdW50ZXI9NDAsOH1yZXR1cm4tMX1mdW5jdGlvbiBUYihhKXtzd2l0Y2goYSl7Y2FzZSAyNDA6cmV0dXJuIGE9RygpLGIucmVnaXN0ZXJBPUooNjUyODArYSkmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyNDE6cmV0dXJuIGE9ZGEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckE9SChhKSxiLnJlZ2lzdGVyRj1hJjI1NSw0O2Nhc2UgMjQyOnJldHVybiBiLnJlZ2lzdGVyQT1KKDY1MjgwK2IucmVnaXN0ZXJDKSYyNTUsNDtjYXNlIDI0MzpyZXR1cm4gTmEoITEpLDQ7Y2FzZSAyNDU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixtKGIucmVnaXN0ZXJBLGIucmVnaXN0ZXJGKSksODtjYXNlIDI0NjpyZXR1cm4gbmEoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSYKNjU1MzUsNDtjYXNlIDI0NzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9NDgsODtjYXNlIDI0ODpyZXR1cm4gYT1SYShHKCkpLGwoMCkscSgwKSx0YShiLnN0YWNrUG9pbnRlcixhLCEwKSxhPWIuc3RhY2tQb2ludGVyK2EmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMjQ5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1tKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSw4O2Nhc2UgMjUwOnJldHVybiBiLnJlZ2lzdGVyQT1KKFgoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDI1MTpyZXR1cm4gTmEoITApLDQ7Y2FzZSAyNTQ6cmV0dXJuIG9hKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKwoxJjY1NTM1LDQ7Y2FzZSAyNTU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTU2LDh9cmV0dXJuLTF9ZnVuY3Rpb24gcGEoYSl7MDxkLkRNQUN5Y2xlcyYmKGErPWQuRE1BQ3ljbGVzLGQuRE1BQ3ljbGVzPTApO2IuY3VycmVudEN5Y2xlcys9YTtpZighYi5pc1N0b3BwZWQpe2lmKFQuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmcpe2lmKHIuY3VycmVudEN5Y2xlcys9YSwhKHIuY3VycmVudEN5Y2xlczxyLmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSlmb3IoO3IuY3VycmVudEN5Y2xlcz49ci5iYXRjaFByb2Nlc3NDeWNsZXMoKTspc2Ioci5iYXRjaFByb2Nlc3NDeWNsZXMoKSksci5jdXJyZW50Q3ljbGVzLT1yLmJhdGNoUHJvY2Vzc0N5Y2xlcygpfWVsc2Ugc2IoYSk7VC5hdWRpb0JhdGNoUHJvY2Vzc2luZz9lLmN1cnJlbnRDeWNsZXMrPWE6bGIoYSl9VC50aW1lcnNCYXRjaFByb2Nlc3Npbmc/CihrLmN1cnJlbnRDeWNsZXMrPWEsV2Eoay5jdXJyZW50Q3ljbGVzKSxrLmN1cnJlbnRDeWNsZXM9MCk6V2EoYSk7Vi5jeWNsZXMrPWE7Vi5jeWNsZXM+PVYuY3ljbGVzUGVyQ3ljbGVTZXQmJihWLmN5Y2xlU2V0cys9MSxWLmN5Y2xlcy09Vi5jeWNsZXNQZXJDeWNsZVNldCl9ZnVuY3Rpb24gYmIoKXtyZXR1cm4gUGEoITAsLTEsLTEpfWZ1bmN0aW9uIFBhKGEsYyxmKXt2b2lkIDA9PT1jJiYoYz0tMSk7dm9pZCAwPT09ZiYmKGY9LTEpO2E9MTAyNDswPGM/YT1jOjA+YyYmKGE9LTEpO2Zvcih2YXIgZD0hMSxlPSExLGc9ITEsaD0hMTshKGR8fGV8fGd8fGgpOyljPWNiKCksMD5jP2Q9ITA6Yi5jdXJyZW50Q3ljbGVzPj1iLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCk/ZT0hMDotMTxhJiZVYSgpPj1hP2c9ITA6LTE8ZiYmYi5wcm9ncmFtQ291bnRlcj09PWYmJihoPSEwKTtpZihlKXJldHVybiBiLmN1cnJlbnRDeWNsZXMtPWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKSwwO2lmKGcpcmV0dXJuIDE7CmlmKGgpcmV0dXJuIDI7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyLTEmNjU1MzU7cmV0dXJuLTF9ZnVuY3Rpb24gY2IoKXtCYT0hMDtpZihiLmlzSGFsdEJ1Zyl7dmFyIGE9eChiLnByb2dyYW1Db3VudGVyKTthPXRiKGEpO3BhKGEpO2IuZXhpdEhhbHRBbmRTdG9wKCl9cC5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheSYmKHAubWFzdGVySW50ZXJydXB0U3dpdGNoPSEwLHAubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9ITEpO2lmKDA8KHAuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSZwLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSYzMSkpe2E9ITE7cC5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2gmJiFiLmlzSGFsdE5vSnVtcCYmKHAuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkJiZwLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPyhNYShwLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSxhPSEwKTpwLmlzTGNkSW50ZXJydXB0RW5hYmxlZCYmcC5pc0xjZEludGVycnVwdFJlcXVlc3RlZD8KKE1hKHAuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpLGE9ITApOnAuaXNUaW1lckludGVycnVwdEVuYWJsZWQmJnAuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD8oTWEocC5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0KSxhPSEwKTpwLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZCYmcC5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZCYmKE1hKHAuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQpLGE9ITApKTt2YXIgYz0wO2EmJihjPTIwLGIuaXNIYWx0ZWQoKSYmKGIuZXhpdEhhbHRBbmRTdG9wKCksYys9NCkpO2IuaXNIYWx0ZWQoKSYmYi5leGl0SGFsdEFuZFN0b3AoKTthPWN9ZWxzZSBhPTA7MDxhJiZwYShhKTthPTQ7Yi5pc0hhbHRlZCgpfHxiLmlzU3RvcHBlZHx8KGE9eChiLnByb2dyYW1Db3VudGVyKSxhPXRiKGEpKTtiLnJlZ2lzdGVyRiY9MjQwO2lmKDA+PWEpcmV0dXJuIGE7cGEoYSk7Vy5zdGVwcys9MTtXLnN0ZXBzPj1XLnN0ZXBzUGVyU3RlcFNldCYmKFcuc3RlcFNldHMrPQoxLFcuc3RlcHMtPVcuc3RlcHNQZXJTdGVwU2V0KTtyZXR1cm4gYX1mdW5jdGlvbiBVYihhKXtjb25zdCBiPSJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGItMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTthLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB1YihhKXthLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTkwPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZT8xLjI1Kk1hdGguZmxvb3IoYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpOjEyMH1mdW5jdGlvbiB2YihhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCkpLWEuZnBzVGltZVN0YW1wc1thLmZwc1RpbWVTdGFtcHMubGVuZ3RoLQoxXTtiPXdiLWI7MD5iJiYoYj0wKTthLnVwZGF0ZUlkPXNldFRpbWVvdXQoKCk9Pnt4YihhKX0sTWF0aC5mbG9vcihiKSl9ZnVuY3Rpb24geGIoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYod2I9Yik7Q2E9YS5nZXRGUFMoKTtpZihDYT5hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxKXJldHVybiBhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKSx2YihhKSwhMDtVYihhKTtjb25zdCBjPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoKGIpPT57bGV0IGY7Yz9kYihhLGIpOihmPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksYihmKSl9KSkudGhlbigoYik9PntpZigwPD1iKXtiYShOKHt0eXBlOkUuVVBEQVRFRCxmcHM6Q2F9KSk7Yj0hMTthLm9wdGlvbnMuZnJhbWVTa2lwJiYwPGEub3B0aW9ucy5mcmFtZVNraXAmJihhLmZyYW1lU2tpcENvdW50ZXIrKywKYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2I9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2J8fChiPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTithLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFKS5idWZmZXIsYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpFLlVQREFURUQsZ3JhcGhpY3NGcmFtZUJ1ZmZlcjpifSksW2JdKSk7Y29uc3QgYz17dHlwZTpFLlVQREFURUR9O2NbRi5DQVJUUklER0VfUkFNXT1lYihhKS5idWZmZXI7Y1tGLkdBTUVCT1lfTUVNT1JZXT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUpLmJ1ZmZlcjsKY1tGLlBBTEVUVEVfTUVNT1JZXT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtjW0YuSU5URVJOQUxfU1RBVEVdPWZiKGEpLmJ1ZmZlcjtPYmplY3Qua2V5cyhjKS5mb3JFYWNoKChhKT0+e3ZvaWQgMD09PWNbYV0mJihjW2FdPShuZXcgVWludDhBcnJheSkuYnVmZmVyKX0pO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKGMpLFtjW0YuQ0FSVFJJREdFX1JBTV0sY1tGLkdBTUVCT1lfTUVNT1JZXSxjW0YuUEFMRVRURV9NRU1PUlldLGNbRi5JTlRFUk5BTF9TVEFURV1dKTt2YihhKX1lbHNlIGJhKE4oe3R5cGU6RS5DUkFTSEVEfSkpLGEucGF1c2VkPSEwfSl9ZnVuY3Rpb24gZGIoYSxiKXt2YXIgYz1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7CjEhPT1jJiZiKGMpO2lmKDE9PT1jKXtjPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0QXVkaW9RdWV1ZUluZGV4KCk7Y29uc3QgZj1DYT49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmZj8oeWIoYSxjKSxzZXRUaW1lb3V0KCgpPT57dWIoYSk7ZGIoYSxiKX0sTWF0aC5mbG9vcihNYXRoLmZsb29yKDFFMyooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOih5YihhLGMpLGRiKGEsYikpfX1mdW5jdGlvbiB5YihhLGIpe2NvbnN0IGM9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpFLlVQREFURUQsYXVkaW9CdWZmZXI6YyxudW1iZXJPZlNhbXBsZXM6YixmcHM6Q2EsYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nOjYwPAphLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX0pLFtjXSk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKX1jb25zdCBFYT0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCBRYTtFYXx8KFFhPXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgRT17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIiwKUEFVU0U6IlBBVVNFIixVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQifSxGPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IEZhPTA7Y29uc3QgZz1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTEwOTUwNCksRGE9e3NpemU6KCk9PjkxMDk1MDQsCmdyb3c6KCk9Pnt9LHdhc21CeXRlTWVtb3J5Omd9O3ZhciBUPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmVuYWJsZUJvb3RSb209ITE7YS51c2VHYmNXaGVuQXZhaWxhYmxlPSEwO2EuYXVkaW9CYXRjaFByb2Nlc3Npbmc9ITE7YS5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0hMTthLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz0hMTthLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPSExO2EuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0hMTthLnRpbGVSZW5kZXJpbmc9ITE7YS50aWxlQ2FjaGluZz0hMTtyZXR1cm4gYX0oKSx6YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXg9NjUzODQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlRGF0YT02NTM4NTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZUluZGV4PTY1Mzg2O2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YT02NTM4NztyZXR1cm4gYX0oKSwKZmE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudGlsZUlkPS0xO2EuaG9yaXpvbnRhbEZsaXA9ITE7YS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz0tMTtyZXR1cm4gYX0oKSx6PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYil7YS5OUngwU3dlZXBQZXJpb2Q9KGImMTEyKT4+NDthLk5SeDBOZWdhdGU9bigzLGIpO2EuTlJ4MFN3ZWVwU2hpZnQ9YiY3fTthLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxRHV0eT1iPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9CmI7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9big2LGIpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtPKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtnWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2dbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2dbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtnWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtnWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtnWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHk7Ck8oMTA0OSs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1N3ZWVwRW5hYmxlZCk7Z1sxMDUwKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zd2VlcENvdW50ZXI7Z1sxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1QKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWdbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1nWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1nWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmR1dHlDeWNsZT1nWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9Z1sxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1N3ZWVwRW5hYmxlZD1QKDEwNDkrNTAqYS5zYXZlU3RhdGVTbG90KTsKYS5zd2VlcENvdW50ZXI9Z1sxMDUwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1nWzEwNTUrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjgpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsMTkxKTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDI0Myk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MywxOTMpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTkxKX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9NCooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT0KYjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLnJlc2V0VGltZXIoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSs9MSw4PD1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkmJihhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MCkpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPTE7aWIoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYyo9LTEpO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EucmVzZXRUaW1lcigpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9YS5mcmVxdWVuY3k7CmEuc3dlZXBDb3VudGVyPWEuTlJ4MFN3ZWVwUGVyaW9kO2EuaXNTd2VlcEVuYWJsZWQ9MDxhLk5SeDBTd2VlcFBlcmlvZCYmMDxhLk5SeDBTd2VlcFNoaWZ0PyEwOiExOzA8YS5OUngwU3dlZXBTaGlmdCYmamIoKTthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLnVwZGF0ZVN3ZWVwPWZ1bmN0aW9uKCl7LS1hLnN3ZWVwQ291bnRlcjswPj1hLnN3ZWVwQ291bnRlciYmKGEuc3dlZXBDb3VudGVyPWEuTlJ4MFN3ZWVwUGVyaW9kLGEuaXNTd2VlcEVuYWJsZWQmJjA8YS5OUngwU3dlZXBQZXJpb2QmJmpiKCkpfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9CiExKX07YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpey0tYS5lbnZlbG9wZUNvdW50ZXI7MD49YS5lbnZlbG9wZUNvdW50ZXImJihhLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09YS5lbnZlbG9wZUNvdW50ZXImJihhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmEudm9sdW1lP2Eudm9sdW1lKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYil7dmFyIGM9Yj4+ODtiJj0yNTU7dmFyIGQ9eChhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGM7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MyxiKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuTlJ4NEZyZXF1ZW5jeU1TQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDA9CjY1Mjk2O2EuTlJ4MFN3ZWVwUGVyaW9kPTA7YS5OUngwTmVnYXRlPSExO2EuTlJ4MFN3ZWVwU2hpZnQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTI5NzthLk5SeDFEdXR5PTA7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1Mjk4O2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPTA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUyOTk7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMDA7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLmNoYW5uZWxOdW1iZXI9MTthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kdXR5Q3ljbGU9MDthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9CjA7YS5pc1N3ZWVwRW5hYmxlZD0hMTthLnN3ZWVwQ291bnRlcj0wO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9MDthLnNhdmVTdGF0ZVNsb3Q9NztyZXR1cm4gYX0oKSxMPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxRHV0eT1iPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD0Kbig2LGIpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtPKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtnWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2dbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2dbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtnWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtnWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtnWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9UCgxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1nWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTsKYS5lbnZlbG9wZUNvdW50ZXI9Z1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWdbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eudm9sdW1lPWdbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZHV0eUN5Y2xlPWdbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1nWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MS0xLDI1NSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MSw2Myk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MiwwKTtoKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTg0KX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9CjQqKDIwNDgtYS5mcmVxdWVuY3kpO2IuR0JDRG91YmxlU3BlZWQmJihhLmZyZXF1ZW5jeVRpbWVyKj0yKX07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYil7YS5mcmVxdWVuY3lUaW1lci09YjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLnJlc2V0VGltZXIoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSs9MSw4PD1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkmJihhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MCkpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPTE7aWIoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYyo9LTEpO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EucmVzZXRUaW1lcigpOwphLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+YS52b2x1bWU/YS52b2x1bWUrPQoxOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYil7dmFyIGM9Yj4+ODtiJj0yNTU7dmFyIGQ9eChhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGM7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MyxiKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuTlJ4NEZyZXF1ZW5jeU1TQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMDI7YS5OUngxRHV0eT0wO2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwMzthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA0O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0KMDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMwNTthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EuY2hhbm5lbE51bWJlcj0yO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wO2Euc2F2ZVN0YXRlU2xvdD04O3JldHVybiBhfSgpLEk9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MD1mdW5jdGlvbihiKXthLmlzRGFjRW5hYmxlZD1uKDcsYil9O2EudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFMZW5ndGhMb2FkPWI7YS5sZW5ndGhDb3VudGVyPTI1Ni1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyVm9sdW1lQ29kZT1iPj41JjE1fTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzRnJlcXVlbmN5TFNCPQpiO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPW4oNixiKTthLk5SeDRGcmVxdWVuY3lNU0I9YiY3O2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7TygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtnWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7Z1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlVGFibGVQb3NpdGlvbn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1QKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWdbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj0KZ1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS53YXZlVGFibGVQb3NpdGlvbj1nWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjcpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsMjU1KTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDE1OSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LDE4NCk7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMH07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9MiooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT0KYjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLnJlc2V0VGltZXIoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZVRhYmxlUG9zaXRpb24rPTEsMzI8PWEud2F2ZVRhYmxlUG9zaXRpb24mJihhLndhdmVUYWJsZVBvc2l0aW9uPTApKTtiPTA7dmFyIGM9YS52b2x1bWVDb2RlO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZClhLnZvbHVtZUNvZGVDaGFuZ2VkJiYoYz14KGEubWVtb3J5TG9jYXRpb25OUngyKSxjPWM+PjUmMTUsYS52b2x1bWVDb2RlPWMsYS52b2x1bWVDb2RlQ2hhbmdlZD0hMSk7ZWxzZSByZXR1cm4gMTU7dmFyIGQ9eChhLm1lbW9yeUxvY2F0aW9uV2F2ZVRhYmxlKyhhLndhdmVUYWJsZVBvc2l0aW9uLzJ8MCkpO2Q9MD09PWEud2F2ZVRhYmxlUG9zaXRpb24lMj9kPj40JjE1OmQmMTU7c3dpdGNoKGMpe2Nhc2UgMDpkPj49NDticmVhaztjYXNlIDE6Yj0xO2JyZWFrO2Nhc2UgMjpkPj49MTtiPTI7YnJlYWs7ZGVmYXVsdDpkPj49CjIsYj00fXJldHVybigwPGI/ZC9iOjApKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTI1Nik7YS5yZXNldFRpbWVyKCk7YS53YXZlVGFibGVQb3NpdGlvbj0wO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXImJiFhLnZvbHVtZUNvZGVDaGFuZ2VkPyExOiEwfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLmN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25OUngwPTY1MzA2O2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzA3O2EuTlJ4MUxlbmd0aExvYWQ9CjA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMDg7YS5OUngyVm9sdW1lQ29kZT0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA5O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzEwO2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5tZW1vcnlMb2NhdGlvbldhdmVUYWJsZT02NTMyODthLmNoYW5uZWxOdW1iZXI9MzthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLndhdmVUYWJsZVBvc2l0aW9uPTA7YS52b2x1bWVDb2RlPTA7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMTthLnNhdmVTdGF0ZVNsb3Q9OTtyZXR1cm4gYX0oKSxNPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTsKYS51cGRhdGVOUngyPWZ1bmN0aW9uKGIpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPWI+PjQmMTU7YS5OUngyRW52ZWxvcGVBZGRNb2RlPW4oMyxiKTthLk5SeDJFbnZlbG9wZVBlcmlvZD1iJjc7YS5pc0RhY0VuYWJsZWQ9MDwoYiYyNDgpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzQ2xvY2tTaGlmdD1iPj40O2EuTlJ4M1dpZHRoTW9kZT1uKDMsYik7YS5OUngzRGl2aXNvckNvZGU9YiY3O3N3aXRjaChhLk5SeDNEaXZpc29yQ29kZSl7Y2FzZSAwOmEuZGl2aXNvcj04O2JyZWFrO2Nhc2UgMTphLmRpdmlzb3I9MTY7YnJlYWs7Y2FzZSAyOmEuZGl2aXNvcj0zMjticmVhaztjYXNlIDM6YS5kaXZpc29yPTQ4O2JyZWFrO2Nhc2UgNDphLmRpdmlzb3I9NjQ7YnJlYWs7Y2FzZSA1OmEuZGl2aXNvcj04MDticmVhaztjYXNlIDY6YS5kaXZpc29yPTk2O2JyZWFrO2Nhc2UgNzphLmRpdmlzb3I9MTEyfX07YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9Cm4oNixiKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtPKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtnWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2dbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2dbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtnWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtnWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1QKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWdbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWdbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1nWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1nWzEwMzgrCjUwKmEuc2F2ZVN0YXRlU2xvdF07YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9Z1sxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2goYS5tZW1vcnlMb2NhdGlvbk5SeDEtMSwyNTUpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsMjU1KTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxOTEpfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYj1hLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShiKX07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYil7YS5mcmVxdWVuY3lUaW1lci09YjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLmZyZXF1ZW5jeVRpbWVyPWEuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kKCksYS5mcmVxdWVuY3lUaW1lci09CmIsYj1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3RlciYxXmEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPj4xJjEsYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI+Pj0xLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfD1iPDwxNCxhLk5SeDNXaWR0aE1vZGUmJihhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3RlciY9LTY1LGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfD1iPDw2KSk7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWI9YS52b2x1bWU7ZWxzZSByZXR1cm4gMTU7dmFyIGM9bigwLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyKT8tMToxO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EuZnJlcXVlbmN5VGltZXI9YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2QoKTthLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZDsKYS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MzI3Njc7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7cmV0dXJuIDA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcj8hMTohMH07YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2Q9ZnVuY3Rpb24oKXt2YXIgYz1hLmRpdmlzb3I8PGEuTlJ4M0Nsb2NrU2hpZnQ7Yi5HQkNEb3VibGVTcGVlZCYmKGMqPTIpO3JldHVybiBjfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmCihhLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09YS5lbnZlbG9wZUNvdW50ZXImJihhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmEudm9sdW1lP2Eudm9sdW1lKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTMxMjthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMTM7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTMxNDthLk5SeDNDbG9ja1NoaWZ0PTA7YS5OUngzV2lkdGhNb2RlPSExO2EuTlJ4M0Rpdmlzb3JDb2RlPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMTU7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLmNoYW5uZWxOdW1iZXI9NDthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0KITE7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmRpdmlzb3I9MDthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj0wO2Euc2F2ZVN0YXRlU2xvdD0xMDtyZXR1cm4gYX0oKSx2PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmNoYW5uZWwxU2FtcGxlPTE1O2EuY2hhbm5lbDJTYW1wbGU9MTU7YS5jaGFubmVsM1NhbXBsZT0xNTthLmNoYW5uZWw0U2FtcGxlPTE1O2EuY2hhbm5lbDFEYWNFbmFibGVkPSExO2EuY2hhbm5lbDJEYWNFbmFibGVkPSExO2EuY2hhbm5lbDNEYWNFbmFibGVkPSExO2EuY2hhbm5lbDREYWNFbmFibGVkPSExO2EubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O2EucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzthLm1peGVyVm9sdW1lQ2hhbmdlZD0hMTthLm1peGVyRW5hYmxlZENoYW5nZWQ9ITE7YS5uZWVkVG9SZW1peFNhbXBsZXM9ITE7cmV0dXJuIGF9KCksCmU9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/MTc0Ojg3fTthLnVwZGF0ZU5SNTA9ZnVuY3Rpb24oYil7YS5OUjUwTGVmdE1peGVyVm9sdW1lPWI+PjQmNzthLk5SNTBSaWdodE1peGVyVm9sdW1lPWImN307YS51cGRhdGVOUjUxPWZ1bmN0aW9uKGIpe2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PW4oNyxiKTthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD1uKDYsYik7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9big1LGIpO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PW4oNCxiKTthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9bigzLGIpO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD1uKDIsYik7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PW4oMSxiKTsKYS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PW4oMCxiKX07YS51cGRhdGVOUjUyPWZ1bmN0aW9uKGIpe2EuTlI1MklzU291bmRFbmFibGVkPW4oNyxiKX07YS5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/MTYzODQ6ODE5Mn07YS5tYXhEb3duU2FtcGxlQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGIuQ0xPQ0tfU1BFRUQoKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtnWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI7Z1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyO2dbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJhbWVTZXF1ZW5jZXJ9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPWdbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj0KZ1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5mcmFtZVNlcXVlbmNlcj1nWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTtWYSgpfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uTlI1MD02NTMxNjthLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9MDthLk5SNTBSaWdodE1peGVyVm9sdW1lPTA7YS5tZW1vcnlMb2NhdGlvbk5SNTE9NjUzMTc7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PQohMDthLm1lbW9yeUxvY2F0aW9uTlI1Mj02NTMxODthLk5SNTJJc1NvdW5kRW5hYmxlZD0hMDthLm1lbW9yeUxvY2F0aW9uQ2hhbm5lbDNMb2FkUmVnaXN0ZXJTdGFydD02NTMyODthLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9MDthLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9MDthLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXI9NDhFMzthLmZyYW1lU2VxdWVuY2VyPTA7YS5hdWRpb1F1ZXVlSW5kZXg9MDthLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplPTEzMTA3MjthLnNhdmVTdGF0ZVNsb3Q9NjtyZXR1cm4gYX0oKSxwPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZUludGVycnVwdEVuYWJsZWQ9ZnVuY3Rpb24oYil7YS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQ9bihhLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0LGIpO2EuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPW4oYS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCxiKTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPQpuKGEuYml0UG9zaXRpb25UaW1lckludGVycnVwdCxiKTthLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZD1uKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlPWJ9O2EudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkPWZ1bmN0aW9uKGIpe2EuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9bihhLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0LGIpO2EuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9bihhLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0LGIpO2EuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD1uKGEuYml0UG9zaXRpb25UaW1lckludGVycnVwdCxiKTthLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPW4oYS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCxiKTthLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT1ifTthLmFyZUludGVycnVwdHNQZW5kaW5nPWZ1bmN0aW9uKCl7cmV0dXJuIDA8KGEuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlJgphLmludGVycnVwdHNFbmFibGVkVmFsdWUmMzEpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe08oMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2gpO08oMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3QsYS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheSl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9UCgxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT1QKDEwMjUrNTAqYS5zYXZlU3RhdGVTbG90KTthLnVwZGF0ZUludGVycnVwdEVuYWJsZWQoeChhLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZCkpO2EudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKHgoYS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpKX07YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITE7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMTthLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0PQowO2EuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ9MTthLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ9MjthLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0PTQ7YS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQ9NjU1MzU7YS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlPTA7YS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQ9ITE7YS5pc0xjZEludGVycnVwdEVuYWJsZWQ9ITE7YS5pc1RpbWVySW50ZXJydXB0RW5hYmxlZD0hMTthLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZD0hMTthLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdD02NTI5NTthLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT0wO2EuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD0hMTthLnNhdmVTdGF0ZVNsb3Q9MjtyZXR1cm4gYX0oKSxrPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe30KYS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gMjU2fTthLnVwZGF0ZURpdmlkZXJSZWdpc3Rlcj1mdW5jdGlvbihiKXtiPWEuZGl2aWRlclJlZ2lzdGVyO2EuZGl2aWRlclJlZ2lzdGVyPTA7aChhLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyLDApO2EudGltZXJFbmFibGVkJiZvYihiLGEuZGl2aWRlclJlZ2lzdGVyKSYmWGEoKX07YS51cGRhdGVUaW1lckNvdW50ZXI9ZnVuY3Rpb24oYil7aWYoYS50aW1lckVuYWJsZWQpe2lmKGEudGltZXJDb3VudGVyV2FzUmVzZXQpcmV0dXJuO2EudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheSYmKGEudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMSl9YS50aW1lckNvdW50ZXI9Yn07YS51cGRhdGVUaW1lck1vZHVsbz1mdW5jdGlvbihiKXthLnRpbWVyTW9kdWxvPWI7YS50aW1lckVuYWJsZWQmJmEudGltZXJDb3VudGVyV2FzUmVzZXQmJihhLnRpbWVyQ291bnRlcj1hLnRpbWVyTW9kdWxvLGEudGltZXJDb3VudGVyV2FzUmVzZXQ9CiExKX07YS51cGRhdGVUaW1lckNvbnRyb2w9ZnVuY3Rpb24oYil7dmFyIGM9YS50aW1lckVuYWJsZWQ7YS50aW1lckVuYWJsZWQ9bigyLGIpO2ImPTM7aWYoIWMpe2M9WWEoYS50aW1lcklucHV0Q2xvY2spO3ZhciBkPVlhKGIpOyhhLnRpbWVyRW5hYmxlZD9uKGMsYS5kaXZpZGVyUmVnaXN0ZXIpOm4oYyxhLmRpdmlkZXJSZWdpc3RlcikmJm4oZCxhLmRpdmlkZXJSZWdpc3RlcikpJiZYYSgpfWEudGltZXJJbnB1dENsb2NrPWJ9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50Q3ljbGVzO2dbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZGl2aWRlclJlZ2lzdGVyO08oMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QsYS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5KTtPKDEwMzUrNTAqYS5zYXZlU3RhdGVTbG90LGEudGltZXJDb3VudGVyV2FzUmVzZXQpO2goYS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcixhLnRpbWVyQ291bnRlcil9OwphLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuY3VycmVudEN5Y2xlcz1nWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmRpdmlkZXJSZWdpc3Rlcj1nWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9UCgxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS50aW1lckNvdW50ZXJXYXNSZXNldD1QKDEwMzUrNTAqYS5zYXZlU3RhdGVTbG90KTthLnRpbWVyQ291bnRlcj14KGEubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXIpO2EudGltZXJNb2R1bG89eChhLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG8pO2EudGltZXJJbnB1dENsb2NrPXgoYS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbCl9O2EuY3VycmVudEN5Y2xlcz0wO2EubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXI9NjUyODQ7YS5kaXZpZGVyUmVnaXN0ZXI9MDthLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyPTY1Mjg1O2EudGltZXJDb3VudGVyPTA7YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PQohMTthLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExO2EudGltZXJDb3VudGVyTWFzaz0wO2EubWVtb3J5TG9jYXRpb25UaW1lck1vZHVsbz02NTI4NjthLnRpbWVyTW9kdWxvPTA7YS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbD02NTI4NzthLnRpbWVyRW5hYmxlZD0hMTthLnRpbWVySW5wdXRDbG9jaz0wO2Euc2F2ZVN0YXRlU2xvdD01O3JldHVybiBhfSgpLEE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSm95cGFkPWZ1bmN0aW9uKGIpe2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPWJeMjU1O2EuaXNEcGFkVHlwZT1uKDQsYS5qb3lwYWRSZWdpc3RlckZsaXBwZWQpO2EuaXNCdXR0b25UeXBlPW4oNSxhLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EudXBkYXRlSm95cGFkKHgoYS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyKSl9O2EudXA9ITE7YS5kb3duPSExO2EubGVmdD0hMTsKYS5yaWdodD0hMTthLmE9ITE7YS5iPSExO2Euc2VsZWN0PSExO2Euc3RhcnQ9ITE7YS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyPTY1MjgwO2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPTA7YS5pc0RwYWRUeXBlPSExO2EuaXNCdXR0b25UeXBlPSExO2Euc2F2ZVN0YXRlU2xvdD0zO3JldHVybiBhfSgpLEQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTGNkU3RhdHVzPWZ1bmN0aW9uKGIpe3ZhciBjPXgoYS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyk7Yj1iJjI0OHxjJjd8MTI4O2goYS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxiKX07YS51cGRhdGVMY2RDb250cm9sPWZ1bmN0aW9uKGIpe2EuZW5hYmxlZD1uKDcsYik7YS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdD1uKDYsYik7YS53aW5kb3dEaXNwbGF5RW5hYmxlZD1uKDUsYik7YS5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0PW4oNCxiKTthLmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9bigzLGIpO2EudGFsbFNwcml0ZVNpemU9Cm4oMixiKTthLnNwcml0ZURpc3BsYXlFbmFibGU9bigxLGIpO2EuYmdEaXNwbGF5RW5hYmxlZD1uKDAsYil9O2EubWVtb3J5TG9jYXRpb25MY2RTdGF0dXM9NjUzNDU7YS5jdXJyZW50TGNkTW9kZT0wO2EubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmU9NjUzNDk7YS5jb2luY2lkZW5jZUNvbXBhcmU9MDthLm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbD02NTM0NDthLmVuYWJsZWQ9ITA7YS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdD0hMTthLndpbmRvd0Rpc3BsYXlFbmFibGVkPSExO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD0hMTthLmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS50YWxsU3ByaXRlU2l6ZT0hMTthLnNwcml0ZURpc3BsYXlFbmFibGU9ITE7YS5iZ0Rpc3BsYXlFbmFibGVkPSExO3JldHVybiBhfSgpLHI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGEuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKX07CmEuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkU9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD8xNTM9PT1hLnNjYW5saW5lUmVnaXN0ZXI/ODo5MTI6MTUzPT09YS5zY2FubGluZVJlZ2lzdGVyPzQ6NDU2fTthLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERT1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzc1MjozNzZ9O2EuTUlOX0NZQ0xFU19UUkFOU0ZFUl9EQVRBX0xDRF9NT0RFPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/NDk4OjI0OX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtnWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnNjYW5saW5lQ3ljbGVDb3VudGVyO2dbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPUQuY3VycmVudExjZE1vZGU7aChhLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlcixhLnNjYW5saW5lUmVnaXN0ZXIpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9Z1sxMDI0Kwo1MCphLnNhdmVTdGF0ZVNsb3RdO0QuY3VycmVudExjZE1vZGU9Z1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zY2FubGluZVJlZ2lzdGVyPXgoYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpO0QudXBkYXRlTGNkQ29udHJvbCh4KEQubWVtb3J5TG9jYXRpb25MY2RDb250cm9sKSl9O2EuY3VycmVudEN5Y2xlcz0wO2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj02NTM0ODthLnNjYW5saW5lUmVnaXN0ZXI9MDthLm1lbW9yeUxvY2F0aW9uRG1hVHJhbnNmZXI9NjUzNTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFg9NjUzNDc7YS5zY3JvbGxYPTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFk9NjUzNDY7YS5zY3JvbGxZPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1g9NjUzNTU7YS53aW5kb3dYPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1k9NjUzNTQ7YS53aW5kb3dZPTA7YS5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ9CjM4OTEyO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQ9Mzk5MzY7YS5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0PTM0ODE2O2EubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0PTMyNzY4O2EubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGU9NjUwMjQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlPTY1MzUxO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lPTY1MzUyO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvPTY1MzUzO2Euc2F2ZVN0YXRlU2xvdD0xO3JldHVybiBhfSgpLGQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50Um9tQmFuaztnWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRSYW1CYW5rO08oMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1JhbUJhbmtpbmdFbmFibGVkKTsKTygxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDMVJvbU1vZGVFbmFibGVkKTtPKDEwMzArNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNSb21Pbmx5KTtPKDEwMzErNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMxKTtPKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMyKTtPKDEwMzMrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMzKTtPKDEwMzQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkM1KX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRSb21CYW5rPWdbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudFJhbUJhbms9Z1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1JhbUJhbmtpbmdFbmFibGVkPVAoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9UCgxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc1JvbU9ubHk9UCgxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzE9UCgxMDMxKzUwKgphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMyPVAoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMzPVAoMTAzMys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkM1PVAoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLmNhcnRyaWRnZVJvbUxvY2F0aW9uPTA7YS5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb249MTYzODQ7YS52aWRlb1JhbUxvY2F0aW9uPTMyNzY4O2EuY2FydHJpZGdlUmFtTG9jYXRpb249NDA5NjA7YS5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb249NDkxNTI7YS5pbnRlcm5hbFJhbUJhbmtPbmVMb2NhdGlvbj01MzI0ODthLmVjaG9SYW1Mb2NhdGlvbj01NzM0NDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj02NTAyNDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD02NTE4MzthLnVudXNhYmxlTWVtb3J5TG9jYXRpb249NjUxODQ7YS51bnVzYWJsZU1lbW9yeUVuZExvY2F0aW9uPTY1Mjc5O2EuY3VycmVudFJvbUJhbms9CjA7YS5jdXJyZW50UmFtQmFuaz0wO2EuaXNSYW1CYW5raW5nRW5hYmxlZD0hMTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPSEwO2EuaXNSb21Pbmx5PSEwO2EuaXNNQkMxPSExO2EuaXNNQkMyPSExO2EuaXNNQkMzPSExO2EuaXNNQkM1PSExO2EubWVtb3J5TG9jYXRpb25IZG1hU291cmNlSGlnaD02NTM2MTthLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdz02NTM2MjthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaD02NTM2MzthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uTG93PTY1MzY0O2EubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcj02NTM2NTthLkRNQUN5Y2xlcz0wO2EuaXNIYmxhbmtIZG1hQWN0aXZlPSExO2EuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPTA7YS5oYmxhbmtIZG1hU291cmNlPTA7YS5oYmxhbmtIZG1hRGVzdGluYXRpb249MDthLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbms9NjUzNTk7YS5tZW1vcnlMb2NhdGlvbkdCQ1dSQU1CYW5rPQo2NTM5MjthLnNhdmVTdGF0ZVNsb3Q9NDtyZXR1cm4gYX0oKSxiPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLkNMT0NLX1NQRUVEPWZ1bmN0aW9uKCl7cmV0dXJuIGEuR0JDRG91YmxlU3BlZWQ/ODM4ODYwODo0MTk0MzA0fTthLk1BWF9DWUNMRVNfUEVSX0ZSQU1FPWZ1bmN0aW9uKCl7cmV0dXJuIGEuR0JDRG91YmxlU3BlZWQ/MTQwNDQ4OjcwMjI0fTthLmVuYWJsZUhhbHQ9ZnVuY3Rpb24oKXtwLm1hc3RlckludGVycnVwdFN3aXRjaD9hLmlzSGFsdE5vcm1hbD0hMDowPT09KHAuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSZwLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSYzMSk/YS5pc0hhbHROb0p1bXA9ITA6YS5pc0hhbHRCdWc9ITB9O2EuZXhpdEhhbHRBbmRTdG9wPWZ1bmN0aW9uKCl7YS5pc0hhbHROb0p1bXA9ITE7YS5pc0hhbHROb3JtYWw9ITE7YS5pc0hhbHRCdWc9ITE7YS5pc1N0b3BwZWQ9ITF9O2EuaXNIYWx0ZWQ9ZnVuY3Rpb24oKXtyZXR1cm4gYS5pc0hhbHROb3JtYWx8fAphLmlzSGFsdE5vSnVtcD8hMDohMX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtnWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQTtnWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQjtnWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQztnWzEwMjcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRDtnWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRTtnWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVySDtnWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyTDtnWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRjtnWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN0YWNrUG9pbnRlcjtnWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnByb2dyYW1Db3VudGVyO2dbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztPKDEwNDErNTAqYS5zYXZlU3RhdGVTbG90LAphLmlzSGFsdE5vcm1hbCk7TygxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzSGFsdE5vSnVtcCk7TygxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzSGFsdEJ1Zyk7TygxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzU3RvcHBlZCl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5yZWdpc3RlckE9Z1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckI9Z1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckM9Z1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckQ9Z1sxMDI3KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckU9Z1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckg9Z1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckw9Z1sxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckY9Z1sxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zdGFja1BvaW50ZXI9Z1sxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF07CmEucHJvZ3JhbUNvdW50ZXI9Z1sxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5jdXJyZW50Q3ljbGVzPWdbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNIYWx0Tm9ybWFsPVAoMTA0MSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNIYWx0Tm9KdW1wPVAoMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNIYWx0QnVnPVAoMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNTdG9wcGVkPVAoMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLkdCQ0VuYWJsZWQ9ITE7YS5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoPTY1MzU3O2EuR0JDRG91YmxlU3BlZWQ9ITE7YS5yZWdpc3RlckE9MDthLnJlZ2lzdGVyQj0wO2EucmVnaXN0ZXJDPTA7YS5yZWdpc3RlckQ9MDthLnJlZ2lzdGVyRT0wO2EucmVnaXN0ZXJIPTA7YS5yZWdpc3Rlckw9MDthLnJlZ2lzdGVyRj0wO2Euc3RhY2tQb2ludGVyPTA7YS5wcm9ncmFtQ291bnRlcj0wO2EuY3VycmVudEN5Y2xlcz0wO2EuaXNIYWx0Tm9ybWFsPQohMTthLmlzSGFsdE5vSnVtcD0hMTthLmlzSGFsdEJ1Zz0hMTthLmlzU3RvcHBlZD0hMTthLnNhdmVTdGF0ZVNsb3Q9MDtyZXR1cm4gYX0oKSxWPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmN5Y2xlc1BlckN5Y2xlU2V0PTJFOTthLmN5Y2xlU2V0cz0wO2EuY3ljbGVzPTA7cmV0dXJuIGF9KCksVz1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5zdGVwc1BlclN0ZXBTZXQ9MkU5O2Euc3RlcFNldHM9MDthLnN0ZXBzPTA7cmV0dXJuIGF9KCk7MTM5PkRhLnNpemUoKSYmRGEuZ3JvdygxMzktRGEuc2l6ZSgpKTt2YXIgQmE9ITEsVmI9T2JqZWN0LmZyZWV6ZSh7bWVtb3J5OkRhLGNvbmZpZzpmdW5jdGlvbihhLGMsZixnLGwsbixtLHEsdCl7VC5lbmFibGVCb290Um9tPTA8YT8hMDohMTtULnVzZUdiY1doZW5BdmFpbGFibGU9MDxjPyEwOiExO1QuYXVkaW9CYXRjaFByb2Nlc3Npbmc9MDxmPyEwOiExO1QuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmc9MDxnPyEwOiExO1QudGltZXJzQmF0Y2hQcm9jZXNzaW5nPQowPGw/ITA6ITE7VC5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZz0wPG4/ITA6ITE7VC5hdWRpb0FjY3VtdWxhdGVTYW1wbGVzPTA8bT8hMDohMTtULnRpbGVSZW5kZXJpbmc9MDxxPyEwOiExO1QudGlsZUNhY2hpbmc9MDx0PyEwOiExO2E9eCgzMjMpO2IuR0JDRW5hYmxlZD0xOTI9PT1hfHxULnVzZUdiY1doZW5BdmFpbGFibGUmJjEyOD09PWE/ITA6ITE7Yi5HQkNEb3VibGVTcGVlZD0hMTtiLnJlZ2lzdGVyQT0wO2IucmVnaXN0ZXJCPTA7Yi5yZWdpc3RlckM9MDtiLnJlZ2lzdGVyRD0wO2IucmVnaXN0ZXJFPTA7Yi5yZWdpc3Rlckg9MDtiLnJlZ2lzdGVyTD0wO2IucmVnaXN0ZXJGPTA7Yi5zdGFja1BvaW50ZXI9MDtiLnByb2dyYW1Db3VudGVyPTA7Yi5jdXJyZW50Q3ljbGVzPTA7Yi5pc0hhbHROb3JtYWw9ITE7Yi5pc0hhbHROb0p1bXA9ITE7Yi5pc0hhbHRCdWc9ITE7Yi5pc1N0b3BwZWQ9ITE7Yi5HQkNFbmFibGVkPyhiLnJlZ2lzdGVyQT0xNyxiLnJlZ2lzdGVyRj0KMTI4LGIucmVnaXN0ZXJCPTAsYi5yZWdpc3RlckM9MCxiLnJlZ2lzdGVyRD0yNTUsYi5yZWdpc3RlckU9ODYsYi5yZWdpc3Rlckg9MCxiLnJlZ2lzdGVyTD0xMyk6KGIucmVnaXN0ZXJBPTEsYi5yZWdpc3RlckY9MTc2LGIucmVnaXN0ZXJCPTAsYi5yZWdpc3RlckM9MTksYi5yZWdpc3RlckQ9MCxiLnJlZ2lzdGVyRT0yMTYsYi5yZWdpc3Rlckg9MSxiLnJlZ2lzdGVyTD03Nyk7Yi5wcm9ncmFtQ291bnRlcj0yNTY7Yi5zdGFja1BvaW50ZXI9NjU1MzQ7ZC5pc1JhbUJhbmtpbmdFbmFibGVkPSExO2QuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA7YT14KDMyNyk7ZC5pc1JvbU9ubHk9ITE7ZC5pc01CQzE9ITE7ZC5pc01CQzI9ITE7ZC5pc01CQzM9ITE7ZC5pc01CQzU9ITE7MD09PWE/ZC5pc1JvbU9ubHk9ITA6MTw9YSYmMz49YT9kLmlzTUJDMT0hMDo1PD1hJiY2Pj1hP2QuaXNNQkMyPSEwOjE1PD1hJiYxOT49YT9kLmlzTUJDMz0hMDoyNTw9YSYmMzA+PWEmJihkLmlzTUJDNT0hMCk7ZC5jdXJyZW50Um9tQmFuaz0KMTtkLmN1cnJlbnRSYW1CYW5rPTA7aCg2NTM2MSwyNTUpO2goNjUzNjIsMjU1KTtoKDY1MzYzLDI1NSk7aCg2NTM2NCwyNTUpO2goNjUzNjUsMjU1KTtyLmN1cnJlbnRDeWNsZXM9MDtyLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7ci5zY2FubGluZVJlZ2lzdGVyPTA7ci5zY3JvbGxYPTA7ci5zY3JvbGxZPTA7ci53aW5kb3dYPTA7ci53aW5kb3dZPTA7Yi5HQkNFbmFibGVkPyhyLnNjYW5saW5lUmVnaXN0ZXI9MTQ0LGgoNjUzNDQsMTQ1KSxoKDY1MzQ1LDEyOSksaCg2NTM0OCwxNDQpLGgoNjUzNTEsMjUyKSk6KHIuc2NhbmxpbmVSZWdpc3Rlcj0xNDQsaCg2NTM0NCwxNDUpLGgoNjUzNDUsMTMzKSxoKDY1MzUwLDI1NSksaCg2NTM1MSwyNTIpLGgoNjUzNTIsMjU1KSxoKDY1MzUzLDI1NSkpO2goNjUzNTksMCk7aCg2NTM5MiwxKTtiLkdCQ0VuYWJsZWQ/KGgoNjUzODQsMTkyKSxoKDY1Mzg1LDI1NSksaCg2NTM4NiwxOTMpLGgoNjUzODcsMTMpKTooaCg2NTM4NCwyNTUpLGgoNjUzODUsCjI1NSksaCg2NTM4NiwyNTUpLGgoNjUzODcsMjU1KSk7ZS5jdXJyZW50Q3ljbGVzPTA7ZS5OUjUwTGVmdE1peGVyVm9sdW1lPTA7ZS5OUjUwUmlnaHRNaXhlclZvbHVtZT0wO2UuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD0hMDtlLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7ZS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD0hMDtlLk5SNTJJc1NvdW5kRW5hYmxlZD0hMDtlLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9MDtlLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9MDtlLmZyYW1lU2VxdWVuY2VyPQowO2UuYXVkaW9RdWV1ZUluZGV4PTA7ei5pbml0aWFsaXplKCk7TC5pbml0aWFsaXplKCk7SS5pbml0aWFsaXplKCk7TS5pbml0aWFsaXplKCk7aChlLm1lbW9yeUxvY2F0aW9uTlI1MCwxMTkpO2goZS5tZW1vcnlMb2NhdGlvbk5SNTEsMjQzKTtoKGUubWVtb3J5TG9jYXRpb25OUjUyLDI0MSk7di5jaGFubmVsMVNhbXBsZT0xNTt2LmNoYW5uZWwyU2FtcGxlPTE1O3YuY2hhbm5lbDNTYW1wbGU9MTU7di5jaGFubmVsNFNhbXBsZT0xNTt2LmNoYW5uZWwxRGFjRW5hYmxlZD0hMTt2LmNoYW5uZWwyRGFjRW5hYmxlZD0hMTt2LmNoYW5uZWwzRGFjRW5hYmxlZD0hMTt2LmNoYW5uZWw0RGFjRW5hYmxlZD0hMTt2LmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzt2LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7di5taXhlclZvbHVtZUNoYW5nZWQ9ITA7di5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO3YubmVlZFRvUmVtaXhTYW1wbGVzPSExO3AudXBkYXRlSW50ZXJydXB0RW5hYmxlZCgwKTsKaChwLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZCxwLmludGVycnVwdHNFbmFibGVkVmFsdWUpO3AudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKDIyNSk7aChwLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCxwLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSk7ay5jdXJyZW50Q3ljbGVzPTA7ay5kaXZpZGVyUmVnaXN0ZXI9MDtrLnRpbWVyQ291bnRlcj0wO2sudGltZXJNb2R1bG89MDtrLnRpbWVyRW5hYmxlZD0hMTtrLnRpbWVySW5wdXRDbG9jaz0wO2sudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMTtrLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExO2IuR0JDRW5hYmxlZD8oaCg2NTI4NCwzMCksay5kaXZpZGVyUmVnaXN0ZXI9Nzg0MCk6KGgoNjUyODQsMTcxKSxrLmRpdmlkZXJSZWdpc3Rlcj00Mzk4MCk7aCg2NTI4NywyNDgpO2sudGltZXJJbnB1dENsb2NrPTI0ODtiLkdCQ0VuYWJsZWQ/KGgoNjUzOTIsMjQ4KSxoKDY1MzU5LDI1NCksaCg2NTM1NywxMjYpLGgoNjUyODAsCjIwNyksaCg2NTI4MiwxMjQpLGgoNjUyOTUsMjI1KSxoKDY1Mzg4LDI1NCksaCg2NTM5NywxNDMpKTooaCg2NTM5MiwyNTUpLGgoNjUzNTksMjU1KSxoKDY1MzU3LDI1NSksaCg2NTI4MCwyMDcpLGgoNjUyODIsMTI2KSxoKDY1Mjk1LDIyNSkpO0JhPSExO1YuY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O1YuY3ljbGVTZXRzPTA7Vi5jeWNsZXM9MDtXLnN0ZXBzUGVyU3RlcFNldD0yRTk7Vy5zdGVwU2V0cz0wO1cuc3RlcHM9MH0saGFzQ29yZVN0YXJ0ZWQ6ZnVuY3Rpb24oKXtyZXR1cm4gQmE/MTowfSxzYXZlU3RhdGU6ZnVuY3Rpb24oKXtiLnNhdmVTdGF0ZSgpO3Iuc2F2ZVN0YXRlKCk7cC5zYXZlU3RhdGUoKTtBLnNhdmVTdGF0ZSgpO2Quc2F2ZVN0YXRlKCk7ay5zYXZlU3RhdGUoKTtlLnNhdmVTdGF0ZSgpO3ouc2F2ZVN0YXRlKCk7TC5zYXZlU3RhdGUoKTtJLnNhdmVTdGF0ZSgpO00uc2F2ZVN0YXRlKCk7QmE9ITF9LGxvYWRTdGF0ZTpmdW5jdGlvbigpe2IubG9hZFN0YXRlKCk7ci5sb2FkU3RhdGUoKTsKcC5sb2FkU3RhdGUoKTtBLmxvYWRTdGF0ZSgpO2QubG9hZFN0YXRlKCk7ay5sb2FkU3RhdGUoKTtlLmxvYWRTdGF0ZSgpO3oubG9hZFN0YXRlKCk7TC5sb2FkU3RhdGUoKTtJLmxvYWRTdGF0ZSgpO00ubG9hZFN0YXRlKCk7QmE9ITE7Vi5jeWNsZXNQZXJDeWNsZVNldD0yRTk7Vi5jeWNsZVNldHM9MDtWLmN5Y2xlcz0wO1cuc3RlcHNQZXJTdGVwU2V0PTJFOTtXLnN0ZXBTZXRzPTA7Vy5zdGVwcz0wfSxnZXRTdGVwc1BlclN0ZXBTZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gVy5zdGVwc1BlclN0ZXBTZXR9LGdldFN0ZXBTZXRzOmZ1bmN0aW9uKCl7cmV0dXJuIFcuc3RlcFNldHN9LGdldFN0ZXBzOmZ1bmN0aW9uKCl7cmV0dXJuIFcuc3RlcHN9LGV4ZWN1dGVNdWx0aXBsZUZyYW1lczpmdW5jdGlvbihhKXtmb3IodmFyIGI9MCxkPTA7ZDxhJiYwPD1iOyliPWJiKCksZCs9MTtyZXR1cm4gMD5iP2I6MH0sZXhlY3V0ZUZyYW1lOmJiLGV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW86ZnVuY3Rpb24oYSl7dm9pZCAwPT09CmEmJihhPTApO3JldHVybiBQYSghMCxhLC0xKX0sZXhlY3V0ZUZyYW1lVW50aWxCcmVha3BvaW50OmZ1bmN0aW9uKGEpe2E9UGEoITAsLTEsYSk7cmV0dXJuIDI9PT1hPzE6YX0sZXhlY3V0ZVVudGlsQ29uZGl0aW9uOlBhLGV4ZWN1dGVTdGVwOmNiLGdldEN5Y2xlc1BlckN5Y2xlU2V0OmZ1bmN0aW9uKCl7cmV0dXJuIFYuY3ljbGVzUGVyQ3ljbGVTZXR9LGdldEN5Y2xlU2V0czpmdW5jdGlvbigpe3JldHVybiBWLmN5Y2xlU2V0c30sZ2V0Q3ljbGVzOmZ1bmN0aW9uKCl7cmV0dXJuIFYuY3ljbGVzfSxzZXRKb3lwYWRTdGF0ZTpmdW5jdGlvbihhLGIsZCxlLGcsaCxsLGspezA8YT9yYSgwKTplYSgwLCExKTswPGI/cmEoMSk6ZWEoMSwhMSk7MDxkP3JhKDIpOmVhKDIsITEpOzA8ZT9yYSgzKTplYSgzLCExKTswPGc/cmEoNCk6ZWEoNCwhMSk7MDxoP3JhKDUpOmVhKDUsITEpOzA8bD9yYSg2KTplYSg2LCExKTswPGs/cmEoNyk6ZWEoNywhMSl9LGdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXI6VWEsCmNsZWFyQXVkaW9CdWZmZXI6VmEsV0FTTUJPWV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX01FTU9SWV9TSVpFOjkxMDk1MDQsV0FTTUJPWV9XQVNNX1BBR0VTOjEzOSxBU1NFTUJMWVNDUklQVF9NRU1PUllfTE9DQVRJT046MCxBU1NFTUJMWVNDUklQVF9NRU1PUllfU0laRToxMDI0LFdBU01CT1lfU1RBVEVfTE9DQVRJT046MTAyNCxXQVNNQk9ZX1NUQVRFX1NJWkU6MTAyNCxHQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjoyMDQ4LEdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6NjU1MzUsVklERU9fUkFNX0xPQ0FUSU9OOjIwNDgsVklERU9fUkFNX1NJWkU6MTYzODQsV09SS19SQU1fTE9DQVRJT046MTg0MzIsV09SS19SQU1fU0laRTozMjc2OCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjo1MTIwMCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjE2Mzg0LEdSQVBISUNTX09VVFBVVF9MT0NBVElPTjo2NzU4NCxHUkFQSElDU19PVVRQVVRfU0laRTo1MjEyMTYsCkdCQ19QQUxFVFRFX0xPQ0FUSU9OOjY3NTg0LEdCQ19QQUxFVFRFX1NJWkU6NTEyLEJHX1BSSU9SSVRZX01BUF9MT0NBVElPTjo2OTYzMixCR19QUklPUklUWV9NQVBfU0laRToyMzU1MixGUkFNRV9MT0NBVElPTjo5MzE4NCxGUkFNRV9TSVpFOjkzMTg0LEJBQ0tHUk9VTkRfTUFQX0xPQ0FUSU9OOjIzMjQ0OCxCQUNLR1JPVU5EX01BUF9TSVpFOjE5NjYwOCxUSUxFX0RBVEFfTE9DQVRJT046NDI5MDU2LFRJTEVfREFUQV9TSVpFOjE0NzQ1NixPQU1fVElMRVNfTE9DQVRJT046NTc2NTEyLE9BTV9USUxFU19TSVpFOjEyMjg4LEFVRElPX0JVRkZFUl9MT0NBVElPTjo1ODg4MDAsQVVESU9fQlVGRkVSX1NJWkU6MTMxMDcyLENBUlRSSURHRV9SQU1fTE9DQVRJT046NzE5ODcyLENBUlRSSURHRV9SQU1fU0laRToxMzEwNzIsQ0FSVFJJREdFX1JPTV9MT0NBVElPTjo4NTA5NDQsQ0FSVFJJREdFX1JPTV9TSVpFOjgyNTg1NjAsZ2V0V2FzbUJveU9mZnNldEZyb21HYW1lQm95T2Zmc2V0OlphLApnZXRSZWdpc3RlckE6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckF9LGdldFJlZ2lzdGVyQjpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQn0sZ2V0UmVnaXN0ZXJDOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJDfSxnZXRSZWdpc3RlckQ6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckR9LGdldFJlZ2lzdGVyRTpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRX0sZ2V0UmVnaXN0ZXJIOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJIfSxnZXRSZWdpc3Rlckw6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3Rlckx9LGdldFJlZ2lzdGVyRjpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRn0sZ2V0UHJvZ3JhbUNvdW50ZXI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5wcm9ncmFtQ291bnRlcn0sZ2V0U3RhY2tQb2ludGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIuc3RhY2tQb2ludGVyfSxnZXRPcGNvZGVBdFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIHgoYi5wcm9ncmFtQ291bnRlcil9LApnZXRMWTpmdW5jdGlvbigpe3JldHVybiByLnNjYW5saW5lUmVnaXN0ZXJ9LGRyYXdCYWNrZ3JvdW5kTWFwVG9XYXNtTWVtb3J5OmZ1bmN0aW9uKGEpe3ZhciBjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydDtELmJnV2luZG93VGlsZURhdGFTZWxlY3QmJihjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0KTt2YXIgZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDtELmJnVGlsZU1hcERpc3BsYXlTZWxlY3QmJihkPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpO2Zvcih2YXIgZT0wOzI1Nj5lO2UrKylmb3IodmFyIGg9MDsyNTY+aDtoKyspe3ZhciBsPWUsaz1oLG09ZCszMioobD4+MykrKGs+PjMpLHA9WihtLDApO3A9eGEoYyxwKTt2YXIgcT1sJTg7bD1rJTg7bD03LWw7az0wO2IuR0JDRW5hYmxlZCYmMDxhJiYoaz1aKG0sMSkpO24oNixrKSYmKHE9Ny1xKTt2YXIgdD0wO24oMyxrKSYmKHQ9CjEpO209WihwKzIqcSx0KTtwPVoocCsyKnErMSx0KTtxPTA7bihsLHApJiYocSs9MSxxPDw9MSk7bihsLG0pJiYocSs9MSk7cD0zKigyNTYqZStoKTtpZihiLkdCQ0VuYWJsZWQmJjA8YSlrPUlhKGsmNyxxLCExKSxsPWNhKDAsayksbT1jYSgxLGspLHE9Y2EoMixrKSxrPTIzMjQ0OCtwLGdba109bCxnW2srMV09bSxnW2srMl09cTtlbHNlIGZvcihsPUhhKHEsci5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlKSxtPTA7Mz5tO20rKylrPTIzMjQ0OCtwK20sZ1trXT1sfX0sZHJhd1RpbGVEYXRhVG9XYXNtTWVtb3J5OmZ1bmN0aW9uKCl7Zm9yKHZhciBhPTA7MjM+YTthKyspZm9yKHZhciBiPTA7MzE+YjtiKyspe3ZhciBkPTA7MTU8YiYmKGQ9MSk7dmFyIGU9YTsxNTxhJiYoZS09MTUpO2U8PD00O2U9MTU8Yj9lKyhiLTE1KTplK2I7dmFyIGg9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQ7MTU8YSYmKGg9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0KTsKZm9yKHZhciBnPTA7OD5nO2crKyloYihlLGgsZCwwLDcsZyw4KmIsOCphK2csMjQ4LDQyOTA1NiwhMCwwLC0xKX19LGdldERJVjpmdW5jdGlvbigpe3JldHVybiBrLmRpdmlkZXJSZWdpc3Rlcn0sZ2V0VElNQTpmdW5jdGlvbigpe3JldHVybiBrLnRpbWVyQ291bnRlcn0sZ2V0VE1BOmZ1bmN0aW9uKCl7cmV0dXJuIGsudGltZXJNb2R1bG99LGdldFRBQzpmdW5jdGlvbigpe3ZhciBhPWsudGltZXJJbnB1dENsb2NrO2sudGltZXJFbmFibGVkJiYoYXw9NCk7cmV0dXJuIGF9LHVwZGF0ZTpiYixlbXVsYXRpb25TdGVwOmNiLGdldEF1ZGlvUXVldWVJbmRleDpVYSxyZXNldEF1ZGlvUXVldWU6VmEsd2FzbU1lbW9yeVNpemU6OTEwOTUwNCx3YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uOjEwMjQsd2FzbUJveUludGVybmFsU3RhdGVTaXplOjEwMjQsZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb246MjA0OCxnYW1lQm95SW50ZXJuYWxNZW1vcnlTaXplOjY1NTM1LHZpZGVvT3V0cHV0TG9jYXRpb246Njc1ODQsCmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb246OTMxODQsZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uOjY3NTg0LGdhbWVib3lDb2xvclBhbGV0dGVTaXplOjUxMixiYWNrZ3JvdW5kTWFwTG9jYXRpb246MjMyNDQ4LHRpbGVEYXRhTWFwOjQyOTA1Nixzb3VuZE91dHB1dExvY2F0aW9uOjU4ODgwMCxnYW1lQnl0ZXNMb2NhdGlvbjo4NTA5NDQsZ2FtZVJhbUJhbmtzTG9jYXRpb246NzE5ODcyfSk7Y29uc3QgV2I9YXN5bmMoKT0+KHtpbnN0YW5jZTp7ZXhwb3J0czpWYn0sYnl0ZU1lbW9yeTpEYS53YXNtQnl0ZU1lbW9yeSx0eXBlOiJUeXBlU2NyaXB0In0pO2xldCBDYSx3Yix0O3Q9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsCldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sZnJhbWVTa2lwQ291bnRlcjowLGN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjooYSk9Pntjb25zdCBiPXZhKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBFLkNPTk5FQ1Q6IkdSQVBISUNTIj09PQpiLm1lc3NhZ2Uud29ya2VySWQ/KHQuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx3YSh6Yi5iaW5kKHZvaWQgMCx0KSx0LmdyYXBoaWNzV29ya2VyUG9ydCkpOiJNRU1PUlkiPT09Yi5tZXNzYWdlLndvcmtlcklkPyh0Lm1lbW9yeVdvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHdhKENiLmJpbmQodm9pZCAwLHQpLHQubWVtb3J5V29ya2VyUG9ydCkpOiJDT05UUk9MTEVSIj09PWIubWVzc2FnZS53b3JrZXJJZD8odC5jb250cm9sbGVyV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sd2EoQmIuYmluZCh2b2lkIDAsdCksdC5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJih0LmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sd2EoQWIuYmluZCh2b2lkIDAsdCksdC5hdWRpb1dvcmtlclBvcnQpKTtiYShOKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgRS5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT4Ke2xldCBhO2E9YXdhaXQgV2IoKTt0Lndhc21JbnN0YW5jZT1hLmluc3RhbmNlO3Qud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2JhKE4oe3R5cGU6YS50eXBlfSxiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIEUuQ09ORklHOnQud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KHQsYi5tZXNzYWdlLmNvbmZpZyk7dC5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zO2JhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBFLlJFU0VUX0FVRElPX1FVRVVFOnQud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCk7YmEoTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEUuUExBWTppZighdC5wYXVzZWR8fCF0Lndhc21JbnN0YW5jZXx8IXQud2FzbUJ5dGVNZW1vcnkpe2JhKE4oe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfXQucGF1c2VkPSExO3QuZnBzVGltZVN0YW1wcz1bXTt0LmZyYW1lU2tpcENvdW50ZXI9MDt0LmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9CjA7eGIodCwxRTMvdC5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpO3ViKHQpO2JhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBFLlBBVVNFOnQucGF1c2VkPSEwO3QudXBkYXRlSWQmJihjbGVhclRpbWVvdXQodC51cGRhdGVJZCksdC51cGRhdGVJZD12b2lkIDApO2JhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBFLlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP3Qud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTp0Lndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7YmEoTih7dHlwZTpFLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgRS5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBjPXQud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9CmIubWVzc2FnZS5zdGFydCk7Yi5tZXNzYWdlLmVuZCYmKGM9Yi5tZXNzYWdlLmVuZCk7YT10Lndhc21CeXRlTWVtb3J5LnNsaWNlKGEsYykuYnVmZmVyO2JhKE4oe3R5cGU6RS5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSBFLkdFVF9XQVNNX0NPTlNUQU5UOmJhKE4oe3R5cGU6RS5HRVRfV0FTTV9DT05TVEFOVCxyZXNwb25zZTp0Lndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYil9fSxnZXRGUFM6KCk9PjA8dC50aW1lU3RhbXBzVW50aWxSZWFkeT90Lm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTp0LmZwc1RpbWVTdGFtcHM/dC5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTt3YSh0Lm1lc3NhZ2VIYW5kbGVyKX0pKCk7Cg==";

  var wasmboyGraphicsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsZil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6ZixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGs7Y29uc3QgbT0oYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6ZyhjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOnthPW5ldyBVaW50OENsYW1wZWRBcnJheShhLm1lc3NhZ2UuZ3JhcGhpY3NGcmFtZUJ1ZmZlcik7Y29uc3QgZj1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTIxNjApLGQ9bmV3IFVpbnQ4Q2xhbXBlZEFycmF5KDMpO2ZvcihsZXQgYz0wOzE0ND5jO2MrKylmb3IobGV0IGU9MDsxNjA+ZTtlKyspe3ZhciBiPTMqKDE2MCpjK2UpO2ZvcihsZXQgYz0wOzM+YztjKyspZFtjXT1hW2IrY107Yj00KihlKzE2MCpjKTtmW2JdPWRbMF07ZltiKzFdPWRbMV07ZltiKzJdPWRbMl07ZltiKzNdPTI1NX1hPWZ9ZyhjKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bCgoYSk9PnthPWEuZGF0YT8KYS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjprPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sayk7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmsucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

  var wasmboyAudioWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG0oYSxiKXtoP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpuLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gcChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGgpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoaClzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugbi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsZCl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksaysrLGI9YCR7Yn0tJHtrfWAsMUU1PGsmJihrPTApKTtyZXR1cm57d29ya2VySWQ6ZCxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGg9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgbjtofHwobj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgaz0wO2NvbnN0IHE9KGEpPT57YT0oYS0xKS8xMjctMTsuMDA4Pk1hdGguYWJzKGEpJiYoYT0wKTtyZXR1cm4gYS8yLjV9O2xldCBsO2NvbnN0IHI9KGEpPT57YT1hLmRhdGE/YS5kYXRhOmE7aWYoYS5tZXNzYWdlKXN3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjptKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiVVBEQVRFRCI6e3ZhciBiPW5ldyBVaW50OEFycmF5KGEubWVzc2FnZS5hdWRpb0J1ZmZlcik7dmFyIGQ9YS5tZXNzYWdlLm51bWJlck9mU2FtcGxlcztjb25zdCBjPW5ldyBGbG9hdDMyQXJyYXkoZCk7dmFyIGY9bmV3IEZsb2F0MzJBcnJheShkKTtsZXQgZz0wO2QqPTI7Zm9yKHZhciBlPTA7ZTxkO2UrPTIpY1tnXT1xKGJbZV0pLGcrKztnPTA7Zm9yKGU9MTtlPGQ7ZSs9MilmW2ddPXEoYltlXSksZysrO2I9Yy5idWZmZXI7Zj1mLmJ1ZmZlcn1tKGMoe3R5cGU6IlVQREFURUQiLGxlZnRDaGFubmVsOmIscmlnaHRDaGFubmVsOmYsCm51bWJlck9mU2FtcGxlczphLm1lc3NhZ2UubnVtYmVyT2ZTYW1wbGVzLGZwczphLm1lc3NhZ2UuZnBzLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzphLm1lc3NhZ2UuYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nfSksW2IsZl0pfX07cCgoYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNPTk5FQ1QiOmw9YS5tZXNzYWdlLnBvcnRzWzBdO3AocixsKTttKGModm9pZCAwLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX0NPTlNUQU5UUyI6bC5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkFVRElPX0xBVEVOQ1kiOmwucG9zdE1lc3NhZ2UoYyhhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGEpfX0pfSkoKTsK";

  var wasmboyControllerWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihjKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKGMpc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIGUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLGQrKyxiPWAke2J9LSR7ZH1gLDFFNTxkJiYoZD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1jb25zdCBjPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY7bGV0IGU7Y3x8KGU9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtsZXQgZD0wLGY7Y29uc3Qgaz0oYSk9Pnt9O2coKGEpPT57YT1hLmRhdGE/YS5kYXRhOgphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6Zj1hLm1lc3NhZ2UucG9ydHNbMF07ZyhrLGYpO2E9aCh2b2lkIDAsYS5tZXNzYWdlSWQpO2M/c2VsZi5wb3N0TWVzc2FnZShhLHZvaWQgMCk6ZS5wb3N0TWVzc2FnZShhLHZvaWQgMCk7YnJlYWs7Y2FzZSAiU0VUX0pPWVBBRF9TVEFURSI6Zi5wb3N0TWVzc2FnZShoKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYSl9fSl9KSgpOwo=";

  var wasmboyMemoryWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGY7Y29uc3Qgaz0oYSxiKT0+e2NvbnN0IGQ9W107T2JqZWN0LmtleXMoYi5tZXNzYWdlKS5mb3JFYWNoKChhKT0+eyJ0eXBlIiE9PWEmJmQucHVzaChiLm1lc3NhZ2VbYV0pfSk7Y29uc3QgZT1jKGIubWVzc2FnZSxiLm1lc3NhZ2VJZCk7YT9mLnBvc3RNZXNzYWdlKGUsZCk6ZyhlLGQpfSxtPShhKT0+e2E9YS5kYXRhP2EuZGF0YTphO2lmKGEubWVzc2FnZSlzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNMRUFSX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSxbYS5tZXNzYWdlLndhc21CeXRlTWVtb3J5XSk7YnJlYWs7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiU0VUX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6ayghMSxhKTticmVhaztjYXNlICJVUERBVEVEIjprKCExLGEpfX07bCgoYSk9PnthPQphLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpmPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sZik7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkNMRUFSX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKHt0eXBlOiJDTEVBUl9NRU1PUlkifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmYucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlNFVF9NRU1PUlkiOmsoITAsYSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

  // Smarter workers.

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

      this.messageListeners = []; // Can't load base63 data string directly because safari
      // https://stackoverflow.com/questions/10343913/how-to-create-a-web-worker-from-a-string

      let workerJs = atob(workerUrl.split(',')[1]);
      let blob;

      try {
        blob = new Blob([workerJs], {
          type: 'application/javascript'
        });
      } catch (e) {
        // Legacy
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(workerJs);
        blob = blob.getBlob();
      }

      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = this._onMessageHandler.bind(this);
      /*ROLLUP_REPLACE_DEV_BROWSER
       this.worker = new Worker(workerUrl);
      this.worker.onmessage = this._onMessageHandler.bind(this);
       ROLLUP_REPLACE_DEV_BROWSER*/

      /*ROLLUP_REPLACE_NODE
       // Split by Comma, to remove the file header from the base 64 string
      const workerAsString = readBase64String(workerUrl);
      this.worker = new Worker(workerAsString, {
        eval: true
      });
      this.worker.on('message', this._onMessageHandler.bind(this))
       ROLLUP_REPLACE_NODE*/
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
  /*ROLLUP_REPLACE_NODE
  const { MessageChannel } = require('worker_threads');
  ROLLUP_REPLACE_NODE*/

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

  return exports;

}({}));
//# sourceMappingURL=wasmboy.ts.iife.js.map
