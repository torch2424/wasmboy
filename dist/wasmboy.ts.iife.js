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

  var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIHVhKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gWihhLGIpe0VhP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpQYS5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHZhKGEsYil7YXx8Y29uc29sZS5lcnJvcigid29ya2VyYXBpOiBObyBjYWxsYmFjayB3YXMgcHJvdmlkZWQgdG8gb25NZXNzYWdlISIpO2lmKGIpaWYoRWEpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoRWEpc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIFBhLm9uKCJtZXNzYWdlIixhKX1mdW5jdGlvbiBOKGEsYixmKXtifHwoYj1NYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5yZXBsYWNlKC9bXmEtel0rL2csIiIpLnN1YnN0cigyLDEwKSxGYSsrLGI9YCR7Yn0tJHtGYX1gLDFFNTxGYSYmKEZhPTApKTtyZXR1cm57d29ya2VySWQ6ZixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWZ1bmN0aW9uIHZiKGEsYil7Yj11YShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgQy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpDLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZnJhbWVJblByb2dyZXNzVmlkZW9PdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSl9fWZ1bmN0aW9uIHdiKGEsYil7Yj11YShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgQy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOkMuR0VUX0NPTlNUQU5UU19ET05FLApXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24geGIoYSxiKXtiPXVhKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBDLlNFVF9KT1lQQURfU1RBVEU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zZXRKb3lwYWRTdGF0ZS5hcHBseShhLGIubWVzc2FnZS5zZXRKb3lwYWRTdGF0ZVBhcmFtc0FzQXJyYXkpfX1mdW5jdGlvbiAkYShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGY9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Y9CjMyNzY4OjU8PWImJjY+PWI/Zj0yMDQ4OjE1PD1iJiYxOT49Yj9mPTMyNzY4OjI1PD1iJiYzMD49YiYmKGY9MTMxMDcyKTtyZXR1cm4gZj9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04rZik6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gYWIoYSl7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zYXZlU3RhdGUoKTtyZXR1cm4gYS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFKX1mdW5jdGlvbiB5YihhLGIpe2I9dWEoYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIEMuQ0xFQVJfTUVNT1JZOmZvcih2YXIgYz0wO2M8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2MrKylhLndhc21CeXRlTWVtb3J5W2NdPTA7Yz0KYS53YXNtQnl0ZU1lbW9yeS5zbGljZSgwKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpDLkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmMuYnVmZmVyfSxiLm1lc3NhZ2VJZCksW2MuYnVmZmVyXSk7YnJlYWs7Y2FzZSBDLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOkMuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCeXRlc0xvY2F0aW9uLnZhbHVlT2YoKSwKV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemUudmFsdWVPZigpLApXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEMuU0VUX01FTU9SWTpjPU9iamVjdC5rZXlzKGIubWVzc2FnZSk7Yy5pbmNsdWRlcyhGLkNBUlRSSURHRV9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbRi5DQVJUUklER0VfUk9NXSksYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2MuaW5jbHVkZXMoRi5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7Yy5pbmNsdWRlcyhGLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuR0FNRUJPWV9NRU1PUlldKSwKYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTik7Yy5pbmNsdWRlcyhGLlBBTEVUVEVfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuUEFMRVRURV9NRU1PUlldKSxhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pO2MuaW5jbHVkZXMoRi5JTlRFUk5BTF9TVEFURSkmJihhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbRi5JTlRFUk5BTF9TVEFURV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6Qy5TRVRfTUVNT1JZX0RPTkV9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLkdFVF9NRU1PUlk6e2M9e3R5cGU6Qy5HRVRfTUVNT1JZfTtjb25zdCBmPVtdO3ZhciB0PWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZih0LmluY2x1ZGVzKEYuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciB4PQphLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIGQ9dm9pZCAwOzA9PT14P2Q9MzI3Njg6MTw9eCYmMz49eD9kPTIwOTcxNTI6NTw9eCYmNj49eD9kPTI2MjE0NDoxNTw9eCYmMTk+PXg/ZD0yMDk3MTUyOjI1PD14JiYzMD49eCYmKGQ9ODM4ODYwOCk7eD1kP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rZCk6bmV3IFVpbnQ4QXJyYXl9ZWxzZSB4PW5ldyBVaW50OEFycmF5O3g9eC5idWZmZXI7Y1tGLkNBUlRSSURHRV9ST01dPXg7Zi5wdXNoKHgpfXQuaW5jbHVkZXMoRi5DQVJUUklER0VfUkFNKSYmKHg9JGEoYSkuYnVmZmVyLGNbRi5DQVJUUklER0VfUkFNXT14LGYucHVzaCh4KSk7dC5pbmNsdWRlcyhGLkNBUlRSSURHRV9IRUFERVIpJiYoYS53YXNtQnl0ZU1lbW9yeT8oeD1hLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMDgsCng9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSh4LHgrMjcpKTp4PW5ldyBVaW50OEFycmF5LHg9eC5idWZmZXIsY1tGLkNBUlRSSURHRV9IRUFERVJdPXgsZi5wdXNoKHgpKTt0LmluY2x1ZGVzKEYuR0FNRUJPWV9NRU1PUlkpJiYoeD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUpLmJ1ZmZlcixjW0YuR0FNRUJPWV9NRU1PUlldPXgsZi5wdXNoKHgpKTt0LmluY2x1ZGVzKEYuUEFMRVRURV9NRU1PUlkpJiYoeD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcixjW0YuUEFMRVRURV9NRU1PUlldPXgsZi5wdXNoKHgpKTt0LmluY2x1ZGVzKEYuSU5URVJOQUxfU1RBVEUpJiYKKGEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCksdD1hYihhKS5idWZmZXIsY1tGLklOVEVSTkFMX1NUQVRFXT10LGYucHVzaCh0KSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oYyxiLm1lc3NhZ2VJZCksZil9fX1mdW5jdGlvbiBwKGEsYil7cmV0dXJuKGEmMjU1KTw8OHxiJjI1NX1mdW5jdGlvbiBIKGEpe3JldHVybihhJjY1MjgwKT4+OH1mdW5jdGlvbiBNKGEsYil7cmV0dXJuIGImfigxPDxhKX1mdW5jdGlvbiBuKGEsYil7cmV0dXJuIDAhPShiJjE8PGEpfWZ1bmN0aW9uIFFhKGEpe3ZhciBiPWE7big3LGIpJiYoYj0tMSooMjU2LWEpKTtyZXR1cm4gYn1mdW5jdGlvbiBHYShhLGMpe2E9MTw8YSYyNTU7Yi5yZWdpc3RlckY9MDxjP2IucmVnaXN0ZXJGfGE6Yi5yZWdpc3RlckYmKDI1NV5hKTtyZXR1cm4gYi5yZWdpc3RlckZ9ZnVuY3Rpb24gbChhKXtHYSg3LGEpfWZ1bmN0aW9uIHEoYSl7R2EoNixhKX1mdW5jdGlvbiBEKGEpe0dhKDUsYSl9ZnVuY3Rpb24gdyhhKXtHYSg0LAphKX1mdW5jdGlvbiBuYSgpe3JldHVybiBiLnJlZ2lzdGVyRj4+NyYxfWZ1bmN0aW9uIFEoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjQmMX1mdW5jdGlvbiBPKGEsYil7MDw9Yj8wIT09KChhJjE1KSsoYiYxNSkmMTYpP0QoMSk6RCgwKTooTWF0aC5hYnMoYikmMTUpPihhJjE1KT9EKDEpOkQoMCl9ZnVuY3Rpb24gUmEoYSxiKXswPD1iP2E+KGErYiYyNTUpP3coMSk6dygwKTpNYXRoLmFicyhiKT5hP3coMSk6dygwKX1mdW5jdGlvbiBzYShhLGIsZil7Zj8oYT1hXmJeYStiLDAhPT0oYSYxNik/RCgxKTpEKDApLDAhPT0oYSYyNTYpP3coMSk6dygwKSk6KGY9YStiJjY1NTM1LGY8YT93KDEpOncoMCksMCE9PSgoYV5iXmYpJjQwOTYpP0QoMSk6RCgwKSl9ZnVuY3Rpb24gSGEoYSxiLGYpe3ZvaWQgMD09PWYmJihmPSExKTt2YXIgYz1hO2Z8fChjPXkoYik+PjIqYSYzKTthPTI0Mjtzd2l0Y2goYyl7Y2FzZSAxOmE9MTYwO2JyZWFrO2Nhc2UgMjphPTg4O2JyZWFrO2Nhc2UgMzphPTh9cmV0dXJuIGF9CmZ1bmN0aW9uIElhKGEsYixmKXtiPTgqYSsyKmI7YT1iYihiKzEsZik7Zj1iYihiLGYpO3JldHVybiBwKGEsZil9ZnVuY3Rpb24gYWEoYSxiKXtyZXR1cm4gOCooKGImMzE8PDUqYSk+PjUqYSl9ZnVuY3Rpb24gYmIoYSxiKXthJj02MztiJiYoYSs9NjQpO3JldHVybiBoWzY3NTg0K2FdfWZ1bmN0aW9uIEphKGEsYixmLHQpe3ZvaWQgMD09PWYmJihmPTApO3ZvaWQgMD09PXQmJih0PSExKTtmJj0zO3QmJihmfD00KTtoWzY5NjMyKygxNjAqYithKV09Zn1mdW5jdGlvbiBjYihhLGIsZix0LHgsZCxrLGUsbCxwLGcsbSxvYSl7dm9pZCAwPT09ZyYmKGc9ITEpO3ZvaWQgMD09PW0mJihtPTApO3ZvaWQgMD09PW9hJiYob2E9LTEpO3ZhciBjPTA7Yj13YShiLGEpO2E9WChiKzIqZCxmKTtmPVgoYisyKmQrMSxmKTtmb3IoZD10O2Q8PXg7ZCsrKWlmKGI9aysoZC10KSxiPGwpe3ZhciBCPWQ7aWYoMD5vYXx8IW4oNSxvYSkpQj03LUI7dmFyIHRhPTA7bihCLGYpJiYodGErPTEsdGE8PD0xKTtuKEIsCmEpJiYodGErPTEpO2lmKDA8PW9hKXt2YXIgcT1JYShvYSY3LHRhLCExKTtCPWFhKDAscSk7dmFyIHU9YWEoMSxxKTtxPWFhKDIscSl9ZWxzZSAwPj1tJiYobT1yLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLHU9Qj1xPUhhKHRhLG0sZyk7dmFyIHk9MyooZSpsK2IpO2hbcCt5XT1CO2hbcCt5KzFdPXU7aFtwK3krMl09cTtCPSExOzA8PW9hJiYoQj1uKDcsb2EpKTtKYShiLGUsdGEsQik7YysrfXJldHVybiBjfWZ1bmN0aW9uIHdhKGEsYil7aWYoYT09PXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCl7dmFyIGM9YisxMjg7big3LGIpJiYoYz1iLTEyOCk7cmV0dXJuIGErMTYqY31yZXR1cm4gYSsxNipifWZ1bmN0aW9uIGRiKGEsYil7c3dpdGNoKGEpe2Nhc2UgMTpyZXR1cm4gbihiLDEyOSk7Y2FzZSAyOnJldHVybiBuKGIsMTM1KTtjYXNlIDM6cmV0dXJuIG4oYiwxMjYpO2RlZmF1bHQ6cmV0dXJuIG4oYiwxKX19ZnVuY3Rpb24gZWIoKXt2YXIgYT0KZmIoKTsyMDQ3Pj1hJiYwPHouTlJ4MFN3ZWVwU2hpZnQmJih6LnN3ZWVwU2hhZG93RnJlcXVlbmN5PWEsei5zZXRGcmVxdWVuY3koYSksYT1mYigpKTsyMDQ3PGEmJih6LmlzRW5hYmxlZD0hMSl9ZnVuY3Rpb24gZmIoKXt2YXIgYT16LnN3ZWVwU2hhZG93RnJlcXVlbmN5O2E+Pj16Lk5SeDBTd2VlcFNoaWZ0O3JldHVybiBhPXouTlJ4ME5lZ2F0ZT96LnN3ZWVwU2hhZG93RnJlcXVlbmN5LWE6ei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeSthfWZ1bmN0aW9uIEthKGEpe3N3aXRjaChhKXtjYXNlIHouY2hhbm5lbE51bWJlcjppZih1LmNoYW5uZWwxRGFjRW5hYmxlZCE9PXouaXNEYWNFbmFibGVkKXJldHVybiB1LmNoYW5uZWwxRGFjRW5hYmxlZD16LmlzRGFjRW5hYmxlZCwhMDticmVhaztjYXNlIEsuY2hhbm5lbE51bWJlcjppZih1LmNoYW5uZWwyRGFjRW5hYmxlZCE9PUsuaXNEYWNFbmFibGVkKXJldHVybiB1LmNoYW5uZWwyRGFjRW5hYmxlZD1LLmlzRGFjRW5hYmxlZCwhMDticmVhaztjYXNlIEkuY2hhbm5lbE51bWJlcjppZih1LmNoYW5uZWwzRGFjRW5hYmxlZCE9PQpJLmlzRGFjRW5hYmxlZClyZXR1cm4gdS5jaGFubmVsM0RhY0VuYWJsZWQ9SS5pc0RhY0VuYWJsZWQsITA7YnJlYWs7Y2FzZSBMLmNoYW5uZWxOdW1iZXI6aWYodS5jaGFubmVsNERhY0VuYWJsZWQhPT1MLmlzRGFjRW5hYmxlZClyZXR1cm4gdS5jaGFubmVsNERhY0VuYWJsZWQ9TC5pc0RhY0VuYWJsZWQsITB9cmV0dXJuITF9ZnVuY3Rpb24gTGEoKXtpZighKGUuY3VycmVudEN5Y2xlczxlLmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSlmb3IoO2UuY3VycmVudEN5Y2xlcz49ZS5iYXRjaFByb2Nlc3NDeWNsZXMoKTspZ2IoZS5iYXRjaFByb2Nlc3NDeWNsZXMoKSksZS5jdXJyZW50Q3ljbGVzLT1lLmJhdGNoUHJvY2Vzc0N5Y2xlcygpfWZ1bmN0aW9uIGdiKGEpe2UuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcis9YTtpZihlLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI+PWUubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcygpKXtlLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXItPWUubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcygpOwpzd2l0Y2goZS5mcmFtZVNlcXVlbmNlcil7Y2FzZSAwOnoudXBkYXRlTGVuZ3RoKCk7Sy51cGRhdGVMZW5ndGgoKTtJLnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7YnJlYWs7Y2FzZSAyOnoudXBkYXRlTGVuZ3RoKCk7Sy51cGRhdGVMZW5ndGgoKTtJLnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7ei51cGRhdGVTd2VlcCgpO2JyZWFrO2Nhc2UgNDp6LnVwZGF0ZUxlbmd0aCgpO0sudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO2JyZWFrO2Nhc2UgNjp6LnVwZGF0ZUxlbmd0aCgpO0sudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO3oudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDc6ei51cGRhdGVFbnZlbG9wZSgpLEsudXBkYXRlRW52ZWxvcGUoKSxMLnVwZGF0ZUVudmVsb3BlKCl9ZS5mcmFtZVNlcXVlbmNlcis9MTs4PD1lLmZyYW1lU2VxdWVuY2VyJiYoZS5mcmFtZVNlcXVlbmNlcj0KMCk7dmFyIGI9ITB9ZWxzZSBiPSExO2lmKFIuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcyYmIWIpe2I9ei53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8S2Eoei5jaGFubmVsTnVtYmVyKTt2YXIgZj1LLndpbGxDaGFubmVsVXBkYXRlKGEpfHxLYShLLmNoYW5uZWxOdW1iZXIpLHQ9SS53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8S2EoSS5jaGFubmVsTnVtYmVyKSx4PUwud2lsbENoYW5uZWxVcGRhdGUoYSl8fEthKEwuY2hhbm5lbE51bWJlcik7YiYmKHUuY2hhbm5lbDFTYW1wbGU9ei5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2YmJih1LmNoYW5uZWwyU2FtcGxlPUsuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTt0JiYodS5jaGFubmVsM1NhbXBsZT1JLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7eCYmKHUuY2hhbm5lbDRTYW1wbGU9TC5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2lmKGJ8fGZ8fHR8fHgpdS5uZWVkVG9SZW1peFNhbXBsZXM9ITA7ZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyKz0KYSplLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXI7ZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPj1lLm1heERvd25TYW1wbGVDeWNsZXMoKSYmKGUuZG93blNhbXBsZUN5Y2xlQ291bnRlci09ZS5tYXhEb3duU2FtcGxlQ3ljbGVzKCksKHUubmVlZFRvUmVtaXhTYW1wbGVzfHx1Lm1peGVyVm9sdW1lQ2hhbmdlZHx8dS5taXhlckVuYWJsZWRDaGFuZ2VkKSYmaGIodS5jaGFubmVsMVNhbXBsZSx1LmNoYW5uZWwyU2FtcGxlLHUuY2hhbm5lbDNTYW1wbGUsdS5jaGFubmVsNFNhbXBsZSksYT11LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZSsxLGI9NTg4ODAwKzIqZS5hdWRpb1F1ZXVlSW5kZXgsaFtiXT11LmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlKzErMSxoW2IrMV09YSsxLGUuYXVkaW9RdWV1ZUluZGV4Kz0xLGUuYXVkaW9RdWV1ZUluZGV4Pj1lLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplLzItMSYmLS1lLmF1ZGlvUXVldWVJbmRleCl9ZWxzZSBiPXouZ2V0U2FtcGxlKGEpLApmPUsuZ2V0U2FtcGxlKGEpLHQ9SS5nZXRTYW1wbGUoYSkseD1MLmdldFNhbXBsZShhKSx1LmNoYW5uZWwxU2FtcGxlPWIsdS5jaGFubmVsMlNhbXBsZT1mLHUuY2hhbm5lbDNTYW1wbGU9dCx1LmNoYW5uZWw0U2FtcGxlPXgsZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyKz1hKmUuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcixlLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI+PWUubWF4RG93blNhbXBsZUN5Y2xlcygpJiYoZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyLT1lLm1heERvd25TYW1wbGVDeWNsZXMoKSxhPWhiKGIsZix0LHgpLGI9SChhKSxmPTU4ODgwMCsyKmUuYXVkaW9RdWV1ZUluZGV4LGhbZl09YisxKzEsaFtmKzFdPShhJjI1NSkrMixlLmF1ZGlvUXVldWVJbmRleCs9MSxlLmF1ZGlvUXVldWVJbmRleD49ZS53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZS8yLTEmJi0tZS5hdWRpb1F1ZXVlSW5kZXgpfWZ1bmN0aW9uIE1hKCl7cmV0dXJuIGUuYXVkaW9RdWV1ZUluZGV4fWZ1bmN0aW9uIFNhKCl7ZS5hdWRpb1F1ZXVlSW5kZXg9CjB9ZnVuY3Rpb24gaGIoYSxiLGYsdCl7dm9pZCAwPT09YSYmKGE9MTUpO3ZvaWQgMD09PWImJihiPTE1KTt2b2lkIDA9PT1mJiYoZj0xNSk7dm9pZCAwPT09dCYmKHQ9MTUpO3UubWl4ZXJWb2x1bWVDaGFuZ2VkPSExO3ZhciBjPTAsZD0wO2M9ZS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ/YythOmMrMTU7Yz1lLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD9jK2I6YysxNTtjPWUuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0P2MrZjpjKzE1O2M9ZS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ/Yyt0OmMrMTU7ZD1lLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCthOmQrMTU7ZD1lLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCtiOmQrMTU7ZD1lLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCtmOmQrMTU7ZD1lLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ/CmQrdDpkKzE1O3UubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMTt1Lm5lZWRUb1JlbWl4U2FtcGxlcz0hMTthPWliKGMsZS5OUjUwTGVmdE1peGVyVm9sdW1lKzEpO2Q9aWIoZCxlLk5SNTBSaWdodE1peGVyVm9sdW1lKzEpO3UubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9YTt1LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT1kO3JldHVybiBwKGEsZCl9ZnVuY3Rpb24gaWIoYSxiKXtpZig2MD09PWEpcmV0dXJuIDEyNzthPTFFNSooYS02MCkqYi84O2EvPTFFNTthKz02MDthPTFFNSphLygxMkU2LzI1NCk7cmV0dXJuIGF8PTB9ZnVuY3Rpb24gTmEoYSl7bS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITE7dmFyIGM9eShtLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCk7Yz1NKGEsYyk7bS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9YztrKG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LGMpO2Iuc3RhY2tQb2ludGVyLT0yO2M9Yi5zdGFja1BvaW50ZXI7dmFyIGY9CmIucHJvZ3JhbUNvdW50ZXIsdD1IKGYpLGQ9YysxO2soYyxmJjI1NSk7ayhkLHQpO3N3aXRjaChhKXtjYXNlIG0uYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ6bS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTY0O2JyZWFrO2Nhc2UgbS5iaXRQb3NpdGlvbkxjZEludGVycnVwdDptLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9NzI7YnJlYWs7Y2FzZSBtLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ6bS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9ODA7YnJlYWs7Y2FzZSBtLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0Om0uaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITEsYi5wcm9ncmFtQ291bnRlcj05Nn19ZnVuY3Rpb24geGEoYSl7dmFyIGI9eShtLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCk7Ynw9MTw8YTttLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT0KYjtrKG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LGIpfWZ1bmN0aW9uIFRhKGEpe2Zvcih2YXIgYj0wO2I8YTspe3ZhciBmPWcuZGl2aWRlclJlZ2lzdGVyO2IrPTQ7Zy5kaXZpZGVyUmVnaXN0ZXIrPTQ7NjU1MzU8Zy5kaXZpZGVyUmVnaXN0ZXImJihnLmRpdmlkZXJSZWdpc3Rlci09NjU1MzYpO2cudGltZXJFbmFibGVkJiYoZy50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PyhnLnRpbWVyQ291bnRlcj1nLnRpbWVyTW9kdWxvLG0uaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMCx4YShtLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQpLGcudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMSxnLnRpbWVyQ291bnRlcldhc1Jlc2V0PSEwKTpnLnRpbWVyQ291bnRlcldhc1Jlc2V0JiYoZy50aW1lckNvdW50ZXJXYXNSZXNldD0hMSksamIoZixnLmRpdmlkZXJSZWdpc3RlcikmJlVhKCkpfX1mdW5jdGlvbiBVYSgpe2cudGltZXJDb3VudGVyKz0xOzI1NTxnLnRpbWVyQ291bnRlciYmCihnLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITAsZy50aW1lckNvdW50ZXI9MCl9ZnVuY3Rpb24gamIoYSxiKXt2YXIgYz1WYShnLnRpbWVySW5wdXRDbG9jayk7cmV0dXJuIG4oYyxhKSYmIW4oYyxiKT8hMDohMX1mdW5jdGlvbiBWYShhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiA5O2Nhc2UgMTpyZXR1cm4gMztjYXNlIDI6cmV0dXJuIDU7Y2FzZSAzOnJldHVybiA3fXJldHVybiAwfWZ1bmN0aW9uIHBhKGEpe3ZhciBjPWIuaXNTdG9wcGVkPSExO3piKGEpfHwoYz0hMCk7Y2EoYSwhMCk7YyYmKGM9ITEsMz49YSYmKGM9ITApLGE9ITEsQS5pc0RwYWRUeXBlJiZjJiYoYT0hMCksQS5pc0J1dHRvblR5cGUmJiFjJiYoYT0hMCksYSYmKG0uaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAseGEobS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCkpKX1mdW5jdGlvbiB6YihhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiBBLnVwO2Nhc2UgMTpyZXR1cm4gQS5yaWdodDtjYXNlIDI6cmV0dXJuIEEuZG93bjsKY2FzZSAzOnJldHVybiBBLmxlZnQ7Y2FzZSA0OnJldHVybiBBLmE7Y2FzZSA1OnJldHVybiBBLmI7Y2FzZSA2OnJldHVybiBBLnNlbGVjdDtjYXNlIDc6cmV0dXJuIEEuc3RhcnQ7ZGVmYXVsdDpyZXR1cm4hMX19ZnVuY3Rpb24gY2EoYSxiKXtzd2l0Y2goYSl7Y2FzZSAwOkEudXA9YjticmVhaztjYXNlIDE6QS5yaWdodD1iO2JyZWFrO2Nhc2UgMjpBLmRvd249YjticmVhaztjYXNlIDM6QS5sZWZ0PWI7YnJlYWs7Y2FzZSA0OkEuYT1iO2JyZWFrO2Nhc2UgNTpBLmI9YjticmVhaztjYXNlIDY6QS5zZWxlY3Q9YjticmVhaztjYXNlIDc6QS5zdGFydD1ifX1mdW5jdGlvbiBrYihhLGMsZil7Zm9yKHZhciB0PTA7dDxmO3QrKyl7Zm9yKHZhciB4PWxiKGErdCksaD1jK3Q7NDA5NTk8aDspaC09ODE5MjtPYShoLHgpJiZrKGgseCl9YT0zMjtiLkdCQ0RvdWJsZVNwZWVkJiYoYT02NCk7ZC5ETUFDeWNsZXMrPWYvMTYqYX1mdW5jdGlvbiBPYShhLGMpe3ZhciBmPWQudmlkZW9SYW1Mb2NhdGlvbiwKdD1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbjtpZihhPGYpe2lmKCFkLmlzUm9tT25seSlpZig4MTkxPj1hKXtpZighZC5pc01CQzJ8fG4oNCxjKSljJj0xNSwwPT09Yz9kLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE6MTA9PT1jJiYoZC5pc1JhbUJhbmtpbmdFbmFibGVkPSEwKX1lbHNlIDE2MzgzPj1hPyFkLmlzTUJDNXx8MTIyODc+PWE/KGQuaXNNQkMyJiYoZC5jdXJyZW50Um9tQmFuaz1jJjE1KSxkLmlzTUJDMT8oYyY9MzEsZC5jdXJyZW50Um9tQmFuayY9MjI0KTpkLmlzTUJDMz8oYyY9MTI3LGQuY3VycmVudFJvbUJhbmsmPTEyOCk6ZC5pc01CQzUmJihkLmN1cnJlbnRSb21CYW5rJj0wKSxkLmN1cnJlbnRSb21CYW5rfD1jKTooYT0wLGY9ZC5jdXJyZW50Um9tQmFuayYyNTUsMDxjJiYoYT0xKSxkLmN1cnJlbnRSb21CYW5rPXAoYSxmKSk6IWQuaXNNQkMyJiYyNDU3NT49YT9kLmlzTUJDMSYmZC5pc01CQzFSb21Nb2RlRW5hYmxlZD8oZC5jdXJyZW50Um9tQmFuayY9CjMxLGQuY3VycmVudFJvbUJhbmt8PWMmMjI0KTooYz1kLmlzTUJDNT9jJjE1OmMmMyxkLmN1cnJlbnRSYW1CYW5rPWMpOiFkLmlzTUJDMiYmMzI3Njc+PWEmJmQuaXNNQkMxJiYobigwLGMpP2QuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA6ZC5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMSk7cmV0dXJuITF9aWYoYT49ZiYmYTxkLmNhcnRyaWRnZVJhbUxvY2F0aW9uKXJldHVybiEwO2lmKGE+PWQuZWNob1JhbUxvY2F0aW9uJiZhPHQpcmV0dXJuIGsoYS04MTkyLGMpLCEwO2lmKGE+PXQmJmE8PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uRW5kKXJldHVybiAyPkUuY3VycmVudExjZE1vZGU/ITE6ITA7aWYoYT49ZC51bnVzYWJsZU1lbW9yeUxvY2F0aW9uJiZhPD1kLnVudXNhYmxlTWVtb3J5RW5kTG9jYXRpb24pcmV0dXJuITE7aWYoNjUyOTY8PWEmJjY1MzE4Pj1hKXtMYSgpO2lmKGE9PT1lLm1lbW9yeUxvY2F0aW9uTlI1Mnx8ZS5OUjUySXNTb3VuZEVuYWJsZWQpe3N3aXRjaChhKXtjYXNlIHoubWVtb3J5TG9jYXRpb25OUngwOnoudXBkYXRlTlJ4MChjKTsKYnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MDpJLnVwZGF0ZU5SeDAoYyk7YnJlYWs7Y2FzZSB6Lm1lbW9yeUxvY2F0aW9uTlJ4MTp6LnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSBLLm1lbW9yeUxvY2F0aW9uTlJ4MTpLLnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MTpJLnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4MTpMLnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSB6Lm1lbW9yeUxvY2F0aW9uTlJ4Mjp6LnVwZGF0ZU5SeDIoYyk7YnJlYWs7Y2FzZSBLLm1lbW9yeUxvY2F0aW9uTlJ4MjpLLnVwZGF0ZU5SeDIoYyk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MjpJLnZvbHVtZUNvZGVDaGFuZ2VkPSEwO0kudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUngyOkwudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIHoubWVtb3J5TG9jYXRpb25OUngzOnoudXBkYXRlTlJ4MyhjKTsKYnJlYWs7Y2FzZSBLLm1lbW9yeUxvY2F0aW9uTlJ4MzpLLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MzpJLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4MzpMLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSB6Lm1lbW9yeUxvY2F0aW9uTlJ4NDpuKDcsYykmJih6LnVwZGF0ZU5SeDQoYyksei50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgSy5tZW1vcnlMb2NhdGlvbk5SeDQ6big3LGMpJiYoSy51cGRhdGVOUng0KGMpLEsudHJpZ2dlcigpKTticmVhaztjYXNlIEkubWVtb3J5TG9jYXRpb25OUng0Om4oNyxjKSYmKEkudXBkYXRlTlJ4NChjKSxJLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4NDpuKDcsYykmJihMLnVwZGF0ZU5SeDQoYyksTC50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgZS5tZW1vcnlMb2NhdGlvbk5SNTA6ZS51cGRhdGVOUjUwKGMpO3UubWl4ZXJWb2x1bWVDaGFuZ2VkPSEwO2JyZWFrOwpjYXNlIGUubWVtb3J5TG9jYXRpb25OUjUxOmUudXBkYXRlTlI1MShjKTt1Lm1peGVyRW5hYmxlZENoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBlLm1lbW9yeUxvY2F0aW9uTlI1MjppZihlLnVwZGF0ZU5SNTIoYyksIW4oNyxjKSlmb3IoYz02NTI5Njs2NTMxOD5jO2MrKylrKGMsMCl9Yz0hMH1lbHNlIGM9ITE7cmV0dXJuIGN9NjUzMjg8PWEmJjY1MzQzPj1hJiZMYSgpO2lmKGE+PUUubWVtb3J5TG9jYXRpb25MY2RDb250cm9sJiZhPD1yLm1lbW9yeUxvY2F0aW9uV2luZG93WCl7aWYoYT09PUUubWVtb3J5TG9jYXRpb25MY2RDb250cm9sKXJldHVybiBFLnVwZGF0ZUxjZENvbnRyb2woYyksITA7aWYoYT09PXIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyKXJldHVybiByLnNjYW5saW5lUmVnaXN0ZXI9MCxrKGEsMCksITE7aWYoYT09PUUubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmUpcmV0dXJuIEUuY29pbmNpZGVuY2VDb21wYXJlPWMsITA7aWYoYT09PXIubWVtb3J5TG9jYXRpb25EbWFUcmFuc2Zlcil7Yzw8PQo4O2ZvcihhPTA7MTU5Pj1hO2ErKylmPXkoYythKSxrKGQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uK2EsZik7ZC5ETUFDeWNsZXM9NjQ0O3JldHVybiEwfXN3aXRjaChhKXtjYXNlIHIubWVtb3J5TG9jYXRpb25TY3JvbGxYOnIuc2Nyb2xsWD1jO2JyZWFrO2Nhc2Ugci5tZW1vcnlMb2NhdGlvblNjcm9sbFk6ci5zY3JvbGxZPWM7YnJlYWs7Y2FzZSByLm1lbW9yeUxvY2F0aW9uV2luZG93WDpyLndpbmRvd1g9YzticmVhaztjYXNlIHIubWVtb3J5TG9jYXRpb25XaW5kb3dZOnIud2luZG93WT1jfXJldHVybiEwfWlmKGE9PT1kLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpcmV0dXJuIGIuR0JDRW5hYmxlZCYmKGQuaXNIYmxhbmtIZG1hQWN0aXZlJiYhbig3LGMpPyhkLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMSxjPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyKSxrKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcixjfDEyOCkpOihhPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VIaWdoKSwKZj15KGQubWVtb3J5TG9jYXRpb25IZG1hU291cmNlTG93KSxhPXAoYSxmKSY2NTUyMCxmPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkhpZ2gpLHQ9eShkLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uTG93KSxmPXAoZix0KSxmPShmJjgxNzYpK2QudmlkZW9SYW1Mb2NhdGlvbix0PU0oNyxjKSx0PTE2Kih0KzEpLG4oNyxjKT8oZC5pc0hibGFua0hkbWFBY3RpdmU9ITAsZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc9dCxkLmhibGFua0hkbWFTb3VyY2U9YSxkLmhibGFua0hkbWFEZXN0aW5hdGlvbj1mLGsoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLE0oNyxjKSkpOihrYihhLGYsdCksayhkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMjU1KSkpKSwhMTtpZigoYT09PWQubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFua3x8YT09PWQubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmJmQuaXNIYmxhbmtIZG1hQWN0aXZlJiYoMTYzODQ8PWQuaGJsYW5rSGRtYVNvdXJjZSYmCjMyNzY3Pj1kLmhibGFua0hkbWFTb3VyY2V8fDUzMjQ4PD1kLmhibGFua0hkbWFTb3VyY2UmJjU3MzQzPj1kLmhibGFua0hkbWFTb3VyY2UpKXJldHVybiExO2lmKGE+PXlhLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVJbmRleCYmYTw9eWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7aWYoYT09PXlhLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVEYXRhfHxhPT09eWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7Zj15KGEtMSk7Zj1NKDYsZik7dD0hMTthPT09eWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSYmKHQ9ITApO3ZhciB4PWYmNjM7dCYmKHgrPTY0KTtoWzY3NTg0K3hdPWM7Yz1mOy0tYTtuKDcsYykmJmsoYSxjKzF8MTI4KX1yZXR1cm4hMH1pZihhPj1nLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyJiZhPD1nLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sKXtUYShnLmN1cnJlbnRDeWNsZXMpO2cuY3VycmVudEN5Y2xlcz0KMDtzd2l0Y2goYSl7Y2FzZSBnLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyOnJldHVybiBnLnVwZGF0ZURpdmlkZXJSZWdpc3RlcihjKSwhMTtjYXNlIGcubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI6Zy51cGRhdGVUaW1lckNvdW50ZXIoYyk7YnJlYWs7Y2FzZSBnLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG86Zy51cGRhdGVUaW1lck1vZHVsbyhjKTticmVhaztjYXNlIGcubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w6Zy51cGRhdGVUaW1lckNvbnRyb2woYyl9cmV0dXJuITB9YT09PUEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3RlciYmQS51cGRhdGVKb3lwYWQoYyk7aWYoYT09PW0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KXJldHVybiBtLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZChjKSwhMDthPT09bS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQmJm0udXBkYXRlSW50ZXJydXB0RW5hYmxlZChjKTtyZXR1cm4hMH1mdW5jdGlvbiBXYShhKXtzd2l0Y2goYT4+CjEyKXtjYXNlIDA6Y2FzZSAxOmNhc2UgMjpjYXNlIDM6cmV0dXJuIGErODUwOTQ0O2Nhc2UgNDpjYXNlIDU6Y2FzZSA2OmNhc2UgNzp2YXIgYz1kLmN1cnJlbnRSb21CYW5rO2QuaXNNQkM1fHwwIT09Y3x8KGM9MSk7cmV0dXJuIDE2Mzg0KmMrKGEtZC5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb24pKzg1MDk0NDtjYXNlIDg6Y2FzZSA5OnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz15KGQubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmMSksYS1kLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKmM7Y2FzZSAxMDpjYXNlIDExOnJldHVybiA4MTkyKmQuY3VycmVudFJhbUJhbmsrKGEtZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbikrNzE5ODcyO2Nhc2UgMTI6cmV0dXJuIGEtZC5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzI7Y2FzZSAxMzpyZXR1cm4gYz0wLGIuR0JDRW5hYmxlZCYmKGM9eShkLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmspJjcpLDE+YyYmKGM9MSksCmEtZC5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzIrNDA5NiooYy0xKTtkZWZhdWx0OnJldHVybiBhLWQuZWNob1JhbUxvY2F0aW9uKzUxMjAwfX1mdW5jdGlvbiBrKGEsYil7YT1XYShhKTtoW2FdPWJ9ZnVuY3Rpb24gUyhhLGIpe2hbYV09Yj8xOjB9ZnVuY3Rpb24gbWIoYSxjLGYsdCxkLGspe2Zvcih2YXIgeD10Pj4zOzE2MD5kO2QrKyl7dmFyIGU9ZCtrOzI1Njw9ZSYmKGUtPTI1Nik7dmFyIGw9ZiszMip4KyhlPj4zKSxwPVgobCwwKSxnPSExO2lmKFIudGlsZUNhY2hpbmcpe3ZhciBCPWQ7dmFyIG09YSxxPWUsdT1sLHc9cCx2PTA7aWYoMDxtJiY4PEImJnc9PT1kYS50aWxlSWQmJkI9PT1kYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjayl7dmFyIHo9dz0hMTtuKDUseSh1LTEpKSYmKHc9ITApO24oNSx5KHUpKSYmKHo9ITApO2Zvcih1PTA7OD51O3UrKylpZih3IT09eiYmKHU9Ny11KSwxNjA+PUIrdSl7Zm9yKHZhciBBPUItKDgtdSksRD05MzE4NCszKigxNjAqCm0rKEIrdSkpLEM9MDszPkM7QysrKVkoQit1LG0sQyxoW0QrQ10pO0E9aFs2OTYzMisoMTYwKm0rQSldO0phKEIrdSxtLE0oMixBKSxuKDIsQSkpO3YrK319ZWxzZSBkYS50aWxlSWQ9dztCPj1kYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjayYmKGRhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrPUIrOCxtPXElOCxCPG0mJihkYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjays9bSkpO0I9djswPEImJihkKz1CLTEsZz0hMCl9Ui50aWxlUmVuZGVyaW5nJiYhZz8oZz1kLEI9YSx2PWMsbT10JTgscT0wLDA9PWcmJihxPWUtZS84KjgpLGU9NywxNjA8Zys4JiYoZT0xNjAtZyksdz0tMSx6PTAsYi5HQkNFbmFibGVkJiYodz1YKGwsMSksbigzLHcpJiYoej0xKSxuKDYsdykmJihtPTctbSkpLEI9Y2IocCx2LHoscSxlLG0sZyxCLDE2MCw5MzE4NCwhMSwwLHcpLDA8QiYmKGQrPUItMSkpOmd8fChiLkdCQ0VuYWJsZWQ/KGc9ZCxCPWEsbT10LHY9d2EoYyxwKSxsPVgobCwKMSksbSU9OCxuKDYsbCkmJihtPTctbSkscT0wLG4oMyxsKSYmKHE9MSkscD1YKHYrMiptLHEpLHY9WCh2KzIqbSsxLHEpLG09ZSU4LG4oNSxsKXx8KG09Ny1tKSxlPTAsbihtLHYpJiYoZT1lKzE8PDEpLG4obSxwKSYmKGUrPTEpLG09SWEobCY3LGUsITEpLHA9YWEoMCxtKSx2PWFhKDEsbSksbT1hYSgyLG0pLFkoZyxCLDAscCksWShnLEIsMSx2KSxZKGcsQiwyLG0pLEphKGcsQixlLG4oNyxsKSkpOihsPWQsZz1hLHY9dCxCPXdhKGMscCksdiU9OCxwPVgoQisyKnYsMCksQj1YKEIrMip2KzEsMCksdj03LWUlOCxlPTAsbih2LEIpJiYoZT1lKzE8PDEpLG4odixwKSYmKGUrPTEpLHA9SGEoZSxyLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLFkobCxnLDAscCksWShsLGcsMSxwKSxZKGwsZywyLHApLEphKGwsZyxlKSkpfX1mdW5jdGlvbiBuYihhKXtpZihFLmVuYWJsZWQpZm9yKHIuc2NhbmxpbmVDeWNsZUNvdW50ZXIrPWE7ci5zY2FubGluZUN5Y2xlQ291bnRlcj49ci5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORSgpOyl7ci5zY2FubGluZUN5Y2xlQ291bnRlci09CnIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTthPXIuc2NhbmxpbmVSZWdpc3RlcjtpZigxNDQ9PT1hKXtpZihSLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nKWZvcih2YXIgYj0wOzE0ND49YjtiKyspWGEoYik7ZWxzZSBYYShhKTtmb3IoYj0wOzE0ND5iO2IrKylmb3IodmFyIGY9MDsxNjA+ZjtmKyspaFs2OTYzMisoMTYwKmIrZildPTA7ZGEudGlsZUlkPS0xO2RhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrPS0xfWVsc2UgMTQ0PmEmJihSLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nfHxYYShhKSk7YT0xNTM8YT8wOmErMTtyLnNjYW5saW5lUmVnaXN0ZXI9YX1pZihFLmVuYWJsZWQpe2lmKGE9ci5zY2FubGluZVJlZ2lzdGVyLGY9RS5jdXJyZW50TGNkTW9kZSxiPTAsMTQ0PD1hP2I9MTpyLnNjYW5saW5lQ3ljbGVDb3VudGVyPj1yLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERSgpP2I9MjpyLnNjYW5saW5lQ3ljbGVDb3VudGVyPj1yLk1JTl9DWUNMRVNfVFJBTlNGRVJfREFUQV9MQ0RfTU9ERSgpJiYKKGI9MyksZiE9PWIpe2Y9eShFLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTtFLmN1cnJlbnRMY2RNb2RlPWI7dmFyIHQ9ITE7c3dpdGNoKGIpe2Nhc2UgMDpmPU0oMCxmKTtmPU0oMSxmKTt0PW4oMyxmKTticmVhaztjYXNlIDE6Zj1NKDEsZik7Znw9MTt0PW4oNCxmKTticmVhaztjYXNlIDI6Zj1NKDAsZik7Znw9Mjt0PW4oNSxmKTticmVhaztjYXNlIDM6Znw9M310JiYobS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMCx4YShtLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSk7MD09PWImJmQuaXNIYmxhbmtIZG1hQWN0aXZlJiYodD0xNixkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZzx0JiYodD1kLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZyksa2IoZC5oYmxhbmtIZG1hU291cmNlLGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uLHQpLGQuaGJsYW5rSGRtYVNvdXJjZSs9dCxkLmhibGFua0hkbWFEZXN0aW5hdGlvbis9dCxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZy09CnQsMD49ZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc/KGQuaXNIYmxhbmtIZG1hQWN0aXZlPSExLGsoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLDI1NSkpOmsoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLE0oNyxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZy8xNi0xKSkpOzE9PT1iJiYobS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMCx4YShtLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSk7dD1FLmNvaW5jaWRlbmNlQ29tcGFyZTswIT09YiYmMSE9PWJ8fGEhPT10P2Y9TSgyLGYpOihmfD00LG4oNixmKSYmKG0uaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAseGEobS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCkpKTtrKEUubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsZil9fWVsc2Ugci5zY2FubGluZUN5Y2xlQ291bnRlcj0wLHIuc2NhbmxpbmVSZWdpc3Rlcj0wLGsoci5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIsMCksCmY9eShFLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKSxmPU0oMSxmKSxmPU0oMCxmKSxFLmN1cnJlbnRMY2RNb2RlPTAsayhFLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGYpfWZ1bmN0aW9uIFhhKGEpe3ZhciBjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydDtFLmJnV2luZG93VGlsZURhdGFTZWxlY3QmJihjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0KTtpZihiLkdCQ0VuYWJsZWR8fEUuYmdEaXNwbGF5RW5hYmxlZCl7dmFyIGY9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7RS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZj1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTt2YXIgdD1yLnNjcm9sbFgsZD1hK3Iuc2Nyb2xsWTsyNTY8PWQmJihkLT0yNTYpO21iKGEsYyxmLGQsMCx0KX1FLndpbmRvd0Rpc3BsYXlFbmFibGVkJiYoZj1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydCwKRS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGY9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCksdD1yLndpbmRvd1gsZD1yLndpbmRvd1ksYTxkfHwodC09NyxtYihhLGMsZixhLWQsdCwtMSp0KSkpO2lmKEUuc3ByaXRlRGlzcGxheUVuYWJsZSlmb3IoYz1FLnRhbGxTcHJpdGVTaXplLGY9Mzk7MDw9ZjtmLS0pe2Q9NCpmO3ZhciBlPXkoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKTt0PXkoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzEpO3ZhciBrPXkoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzIpO2UtPTE2O3QtPTg7dmFyIGw9ODtjJiYobD0xNiwxPT09ayUyJiYtLWspO2lmKGE+PWUmJmE8ZStsKXtkPXkoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzMpO3ZhciBtPW4oNyxkKSxnPW4oNixkKSxwPW4oNSxkKTtlPWEtZTtnJiYoZS09bCxlKj0tMSwKLS1lKTtlKj0yO2s9d2Eoci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQsayk7bD1rKz1lO2U9MDtiLkdCQ0VuYWJsZWQmJm4oMyxkKSYmKGU9MSk7az1YKGwsZSk7bD1YKGwrMSxlKTtmb3IoZT03OzA8PWU7ZS0tKXtnPWU7cCYmKGctPTcsZyo9LTEpO3ZhciBxPTA7bihnLGwpJiYocSs9MSxxPDw9MSk7bihnLGspJiYocSs9MSk7aWYoMCE9PXEmJihnPXQrKDctZSksMDw9ZyYmMTYwPj1nKSl7dmFyIHU9ITEsdj0hMSx3PSExO2IuR0JDRW5hYmxlZCYmIUUuYmdEaXNwbGF5RW5hYmxlZCYmKHU9ITApO2lmKCF1KXt2YXIgej1oWzY5NjMyKygxNjAqYStnKV0sQT16JjM7bSYmMDxBP3Y9ITA6Yi5HQkNFbmFibGVkJiZuKDIseikmJjA8QSYmKHc9ITApfWlmKHV8fCF2JiYhdyliLkdCQ0VuYWJsZWQ/KHY9SWEoZCY3LHEsITApLHE9YWEoMCx2KSx1PWFhKDEsdiksdj1hYSgyLHYpLFkoZyxhLDAscSksWShnLGEsMSx1KSxZKGcsYSwyLHYpKToodT1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZSwKbig0LGQpJiYodT1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bykscT1IYShxLHUpLFkoZyxhLDAscSksWShnLGEsMSxxKSxZKGcsYSwyLHEpKX19fX19ZnVuY3Rpb24gWShhLGIsZixkKXtoWzkzMTg0KzMqKDE2MCpiK2EpK2ZdPWR9ZnVuY3Rpb24gWChhLGIpe3JldHVybiBoW2EtZC52aWRlb1JhbUxvY2F0aW9uKzIwNDgrODE5MiooYiYxKV19ZnVuY3Rpb24gWWEoYSl7dmFyIGI9ZC52aWRlb1JhbUxvY2F0aW9uO3JldHVybiBhPGJ8fGE+PWImJmE8ZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbj8tMTphPj1kLmVjaG9SYW1Mb2NhdGlvbiYmYTxkLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj95KGEtODE5Mik6YT49ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24mJmE8PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uRW5kPzI+RS5jdXJyZW50TGNkTW9kZT8yNTU6LTE6YT09PXIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyPyhrKGEsci5zY2FubGluZVJlZ2lzdGVyKSwKci5zY2FubGluZVJlZ2lzdGVyKTo2NTI5Njw9YSYmNjUzMTg+PWE/KExhKCksYT1hPT09ZS5tZW1vcnlMb2NhdGlvbk5SNTI/eShlLm1lbW9yeUxvY2F0aW9uTlI1MikmMTI4fDExMjotMSxhKTo2NTMyODw9YSYmNjUzNDM+PWE/KExhKCksLTEpOmE9PT1nLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPyhiPUgoZy5kaXZpZGVyUmVnaXN0ZXIpLGsoYSxiKSxiKTphPT09Zy5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcj8oayhhLGcudGltZXJDb3VudGVyKSxnLnRpbWVyQ291bnRlcik6YT09PUEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3Rlcj8oYT1BLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCxBLmlzRHBhZFR5cGU/KGE9QS51cD9NKDIsYSk6YXw0LGE9QS5yaWdodD9NKDAsYSk6YXwxLGE9QS5kb3duP00oMyxhKTphfDgsYT1BLmxlZnQ/TSgxLGEpOmF8Mik6QS5pc0J1dHRvblR5cGUmJihhPUEuYT9NKDAsYSk6YXwxLGE9QS5iP00oMSxhKTphfDIsYT1BLnNlbGVjdD9NKDIsCmEpOmF8NCxhPUEuc3RhcnQ/TSgzLGEpOmF8OCksYXwyNDApOi0xfWZ1bmN0aW9uIHkoYSl7cmV0dXJuIGhbV2EoYSldfWZ1bmN0aW9uIGxiKGEpe3ZhciBiPVlhKGEpO3N3aXRjaChiKXtjYXNlIC0xOnJldHVybiB5KGEpO2RlZmF1bHQ6cmV0dXJuIGJ9fWZ1bmN0aW9uIFQoYSl7cmV0dXJuIDA8aFthXT8hMDohMX1mdW5jdGlvbiBlYShhKXtPKGIucmVnaXN0ZXJBLGEpO1JhKGIucmVnaXN0ZXJBLGEpO2IucmVnaXN0ZXJBPWIucmVnaXN0ZXJBK2EmMjU1OzA9PT1iLnJlZ2lzdGVyQT9sKDEpOmwoMCk7cSgwKX1mdW5jdGlvbiBmYShhKXt2YXIgYz1iLnJlZ2lzdGVyQSthK1EoKSYyNTU7MCE9KChiLnJlZ2lzdGVyQV5hXmMpJjE2KT9EKDEpOkQoMCk7MDwoYi5yZWdpc3RlckErYStRKCkmMjU2KT93KDEpOncoMCk7Yi5yZWdpc3RlckE9YzswPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApO3EoMCl9ZnVuY3Rpb24gaGEoYSl7dmFyIGM9LTEqYTtPKGIucmVnaXN0ZXJBLGMpO1JhKGIucmVnaXN0ZXJBLApjKTtiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQS1hJjI1NTswPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApO3EoMSl9ZnVuY3Rpb24gaWEoYSl7dmFyIGM9Yi5yZWdpc3RlckEtYS1RKCkmMjU1OzAhPSgoYi5yZWdpc3RlckFeYV5jKSYxNik/RCgxKTpEKDApOzA8KGIucmVnaXN0ZXJBLWEtUSgpJjI1Nik/dygxKTp3KDApO2IucmVnaXN0ZXJBPWM7MD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKTtxKDEpfWZ1bmN0aW9uIGphKGEpe2IucmVnaXN0ZXJBJj1hOzA9PT1iLnJlZ2lzdGVyQT9sKDEpOmwoMCk7cSgwKTtEKDEpO3coMCl9ZnVuY3Rpb24ga2EoYSl7Yi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBXmEpJjI1NTswPT09Yi5yZWdpc3RlckE/bCgxKTpsKDApO3EoMCk7RCgwKTt3KDApfWZ1bmN0aW9uIGxhKGEpe2IucmVnaXN0ZXJBfD1hOzA9PT1iLnJlZ2lzdGVyQT9sKDEpOmwoMCk7cSgwKTtEKDApO3coMCl9ZnVuY3Rpb24gbWEoYSl7YSo9LTE7TyhiLnJlZ2lzdGVyQSxhKTtSYShiLnJlZ2lzdGVyQSwKYSk7MD09PWIucmVnaXN0ZXJBK2E/bCgxKTpsKDApO3EoMSl9ZnVuY3Rpb24gcWEoYSxiKXswPT09KGImMTw8YSk/bCgxKTpsKDApO3EoMCk7RCgxKTtyZXR1cm4gYn1mdW5jdGlvbiBXKGEsYixmKXtyZXR1cm4gMDxiP2Z8MTw8YTpmJn4oMTw8YSl9ZnVuY3Rpb24gemEoYSl7YT1RYShhKTtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrYSY2NTUzNTtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNX1mdW5jdGlvbiBvYihhKXtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtzd2l0Y2goKGEmMjQwKT4+NCl7Y2FzZSAwOnJldHVybiBBYihhKTtjYXNlIDE6cmV0dXJuIEJiKGEpO2Nhc2UgMjpyZXR1cm4gQ2IoYSk7Y2FzZSAzOnJldHVybiBEYihhKTtjYXNlIDQ6cmV0dXJuIEViKGEpO2Nhc2UgNTpyZXR1cm4gRmIoYSk7Y2FzZSA2OnJldHVybiBHYihhKTtjYXNlIDc6cmV0dXJuIEhiKGEpO2Nhc2UgODpyZXR1cm4gSWIoYSk7CmNhc2UgOTpyZXR1cm4gSmIoYSk7Y2FzZSAxMDpyZXR1cm4gS2IoYSk7Y2FzZSAxMTpyZXR1cm4gTGIoYSk7Y2FzZSAxMjpyZXR1cm4gTWIoYSk7Y2FzZSAxMzpyZXR1cm4gTmIoYSk7Y2FzZSAxNDpyZXR1cm4gT2IoYSk7ZGVmYXVsdDpyZXR1cm4gUGIoYSl9fWZ1bmN0aW9uIEooYSl7cmEoNCk7cmV0dXJuIGxiKGEpfWZ1bmN0aW9uIFAoYSxiKXtyYSg0KTtPYShhLGIpJiZrKGEsYil9ZnVuY3Rpb24gYmEoYSl7cmEoOCk7dmFyIGI9WWEoYSk7c3dpdGNoKGIpe2Nhc2UgLTE6Yj15KGEpfWErPTE7dmFyIGY9WWEoYSk7c3dpdGNoKGYpe2Nhc2UgLTE6YT15KGEpO2JyZWFrO2RlZmF1bHQ6YT1mfXJldHVybiBwKGEsYil9ZnVuY3Rpb24gVShhLGIpe3JhKDgpO3ZhciBjPUgoYik7YiY9MjU1O3ZhciBkPWErMTtPYShhLGIpJiZrKGEsYik7T2EoZCxjKSYmayhkLGMpfWZ1bmN0aW9uIEcoKXtyYSg0KTtyZXR1cm4geShiLnByb2dyYW1Db3VudGVyKX1mdW5jdGlvbiBWKCl7cmEoNCk7dmFyIGE9CnkoYi5wcm9ncmFtQ291bnRlcisxJjY1NTM1KTtyZXR1cm4gcChhLEcoKSl9ZnVuY3Rpb24gQWIoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gNDtjYXNlIDE6cmV0dXJuIGE9VigpLGIucmVnaXN0ZXJCPUgoYSksYi5yZWdpc3RlckM9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDI6cmV0dXJuIFAocChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYi5yZWdpc3RlckEpLDQ7Y2FzZSAzOnJldHVybiBhPXAoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpLGErKyxiLnJlZ2lzdGVyQj1IKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSA0OnJldHVybiBPKGIucmVnaXN0ZXJCLDEpLGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJCKzEmMjU1LDA9PT1iLnJlZ2lzdGVyQj9sKDEpOmwoMCkscSgwKSw0O2Nhc2UgNTpyZXR1cm4gTyhiLnJlZ2lzdGVyQiwtMSksYi5yZWdpc3RlckI9Yi5yZWdpc3RlckItMSYyNTUsMD09PWIucmVnaXN0ZXJCP2woMSk6CmwoMCkscSgxKSw0O2Nhc2UgNjpyZXR1cm4gYi5yZWdpc3RlckI9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA3OjEyOD09PShiLnJlZ2lzdGVyQSYxMjgpP3coMSk6dygwKTthPWI7dmFyIGM9Yi5yZWdpc3RlckE7YS5yZWdpc3RlckE9KGM8PDF8Yz4+NykmMjU1O2woMCk7cSgwKTtEKDApO3JldHVybiA0O2Nhc2UgODpyZXR1cm4gVShWKCksYi5zdGFja1BvaW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSA5OnJldHVybiBhPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGM9cChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksc2EoYSxjLCExKSxhPWErYyY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHEoMCksODtjYXNlIDEwOnJldHVybiBiLnJlZ2lzdGVyQT1KKHAoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpKSw0O2Nhc2UgMTE6cmV0dXJuIGE9cChiLnJlZ2lzdGVyQiwKYi5yZWdpc3RlckMpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJCPUgoYSksYi5yZWdpc3RlckM9YSYyNTUsODtjYXNlIDEyOnJldHVybiBPKGIucmVnaXN0ZXJDLDEpLGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJDKzEmMjU1LDA9PT1iLnJlZ2lzdGVyQz9sKDEpOmwoMCkscSgwKSw0O2Nhc2UgMTM6cmV0dXJuIE8oYi5yZWdpc3RlckMsLTEpLGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJDLTEmMjU1LDA9PT1iLnJlZ2lzdGVyQz9sKDEpOmwoMCkscSgxKSw0O2Nhc2UgMTQ6cmV0dXJuIGIucmVnaXN0ZXJDPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMTU6cmV0dXJuIDA8KGIucmVnaXN0ZXJBJjEpP3coMSk6dygwKSxhPWIsYz1iLnJlZ2lzdGVyQSxhLnJlZ2lzdGVyQT0oYz4+MXxjPDw3KSYyNTUsbCgwKSxxKDApLEQoMCksNH1yZXR1cm4tMX1mdW5jdGlvbiBCYihhKXtzd2l0Y2goYSl7Y2FzZSAxNjppZihiLkdCQ0VuYWJsZWQmJihhPUooYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoKSwKbigwLGEpKSlyZXR1cm4gYT1NKDAsYSksbig3LGEpPyhiLkdCQ0RvdWJsZVNwZWVkPSExLGE9TSg3LGEpKTooYi5HQkNEb3VibGVTcGVlZD0hMCxhfD0xMjgpLFAoYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoLGEpLDY4O2IuaXNTdG9wcGVkPSEwO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1O3JldHVybiA0O2Nhc2UgMTc6cmV0dXJuIGE9VigpLGIucmVnaXN0ZXJEPUgoYSksYi5yZWdpc3RlckU9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDE4OnJldHVybiBQKHAoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTk6cmV0dXJuIGE9cChiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSksYT1hKzEmNjU1MzUsYi5yZWdpc3RlckQ9SChhKSxiLnJlZ2lzdGVyRT1hJjI1NSw4O2Nhc2UgMjA6cmV0dXJuIE8oYi5yZWdpc3RlckQsMSksYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckQrCjEmMjU1LDA9PT1iLnJlZ2lzdGVyRD9sKDEpOmwoMCkscSgwKSw0O2Nhc2UgMjE6cmV0dXJuIE8oYi5yZWdpc3RlckQsLTEpLGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJELTEmMjU1LDA9PT1iLnJlZ2lzdGVyRD9sKDEpOmwoMCkscSgxKSw0O2Nhc2UgMjI6cmV0dXJuIGIucmVnaXN0ZXJEPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjM6cmV0dXJuIGE9ITEsMTI4PT09KGIucmVnaXN0ZXJBJjEyOCkmJihhPSEwKSxiLnJlZ2lzdGVyQT0oYi5yZWdpc3RlckE8PDF8USgpKSYyNTUsYT93KDEpOncoMCksbCgwKSxxKDApLEQoMCksNDtjYXNlIDI0OnJldHVybiB6YShHKCkpLDg7Y2FzZSAyNTphPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpO3ZhciBjPXAoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpO3NhKGEsYywhMSk7YT1hK2MmNjU1MzU7Yi5yZWdpc3Rlckg9SChhKTtiLnJlZ2lzdGVyTD1hJjI1NTtxKDApO3JldHVybiA4O2Nhc2UgMjY6cmV0dXJuIGE9CnAoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGIucmVnaXN0ZXJBPUooYSksNDtjYXNlIDI3OnJldHVybiBhPXAoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJEPUgoYSksYi5yZWdpc3RlckU9YSYyNTUsODtjYXNlIDI4OnJldHVybiBPKGIucmVnaXN0ZXJFLDEpLGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJFKzEmMjU1LDA9PT1iLnJlZ2lzdGVyRT9sKDEpOmwoMCkscSgwKSw0O2Nhc2UgMjk6cmV0dXJuIE8oYi5yZWdpc3RlckUsLTEpLGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJFLTEmMjU1LDA9PT1iLnJlZ2lzdGVyRT9sKDEpOmwoMCkscSgxKSw0O2Nhc2UgMzA6cmV0dXJuIGIucmVnaXN0ZXJFPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMzE6cmV0dXJuIGE9ITEsMT09PShiLnJlZ2lzdGVyQSYxKSYmKGE9ITApLGIucmVnaXN0ZXJBPShiLnJlZ2lzdGVyQT4+MXxRKCk8PDcpJjI1NSxhP3coMSk6dygwKSwKbCgwKSxxKDApLEQoMCksNH1yZXR1cm4tMX1mdW5jdGlvbiBDYihhKXtzd2l0Y2goYSl7Y2FzZSAzMjpyZXR1cm4gMD09PW5hKCk/emEoRygpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMzM6cmV0dXJuIGE9VigpLGIucmVnaXN0ZXJIPUgoYSksYi5yZWdpc3Rlckw9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDM0OnJldHVybiBhPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLFAoYSxiLnJlZ2lzdGVyQSksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgMzU6cmV0dXJuIGE9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw4O2Nhc2UgMzY6cmV0dXJuIE8oYi5yZWdpc3RlckgsMSksYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckgrMSYyNTUsMD09PWIucmVnaXN0ZXJIPwpsKDEpOmwoMCkscSgwKSw0O2Nhc2UgMzc6cmV0dXJuIE8oYi5yZWdpc3RlckgsLTEpLGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILTEmMjU1LDA9PT1iLnJlZ2lzdGVySD9sKDEpOmwoMCkscSgxKSw0O2Nhc2UgMzg6cmV0dXJuIGIucmVnaXN0ZXJIPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMzk6dmFyIGM9MDswPChiLnJlZ2lzdGVyRj4+NSYxKSYmKGN8PTYpOzA8USgpJiYoY3w9OTYpOzA8KGIucmVnaXN0ZXJGPj42JjEpP2E9Yi5yZWdpc3RlckEtYyYyNTU6KDk8KGIucmVnaXN0ZXJBJjE1KSYmKGN8PTYpLDE1MzxiLnJlZ2lzdGVyQSYmKGN8PTk2KSxhPWIucmVnaXN0ZXJBK2MmMjU1KTswPT09YT9sKDEpOmwoMCk7MCE9PShjJjk2KT93KDEpOncoMCk7RCgwKTtiLnJlZ2lzdGVyQT1hO3JldHVybiA0O2Nhc2UgNDA6cmV0dXJuIDA8bmEoKT96YShHKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7CmNhc2UgNDE6cmV0dXJuIGE9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksc2EoYSxhLCExKSxhPTIqYSY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHEoMCksODtjYXNlIDQyOnJldHVybiBhPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBPUooYSksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNDM6cmV0dXJuIGE9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw4O2Nhc2UgNDQ6cmV0dXJuIE8oYi5yZWdpc3RlckwsMSksYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckwrMSYyNTUsMD09PWIucmVnaXN0ZXJMP2woMSk6bCgwKSxxKDApLDQ7Y2FzZSA0NTpyZXR1cm4gTyhiLnJlZ2lzdGVyTCwtMSksYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckwtMSYyNTUsMD09PWIucmVnaXN0ZXJMP2woMSk6bCgwKSxxKDEpLAo0O2Nhc2UgNDY6cmV0dXJuIGIucmVnaXN0ZXJMPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNDc6cmV0dXJuIGIucmVnaXN0ZXJBPX5iLnJlZ2lzdGVyQSxxKDEpLEQoMSksNH1yZXR1cm4tMX1mdW5jdGlvbiBEYihhKXtzd2l0Y2goYSl7Y2FzZSA0ODpyZXR1cm4gMD09PVEoKT96YShHKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSA0OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9VigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSA1MDpyZXR1cm4gYT1wKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxQKGEsYi5yZWdpc3RlckEpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJIPUgoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDUxOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisxJjY1NTM1LDg7Y2FzZSA1MjphPXAoYi5yZWdpc3RlckgsCmIucmVnaXN0ZXJMKTt2YXIgYz1KKGEpO08oYywxKTtjPWMrMSYyNTU7MD09PWM/bCgxKTpsKDApO3EoMCk7UChhLGMpO3JldHVybiA0O2Nhc2UgNTM6cmV0dXJuIGE9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYz1KKGEpLE8oYywtMSksYz1jLTEmMjU1LDA9PT1jP2woMSk6bCgwKSxxKDEpLFAoYSxjKSw0O2Nhc2UgNTQ6cmV0dXJuIFAocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNTU6cmV0dXJuIHEoMCksRCgwKSx3KDEpLDQ7Y2FzZSA1NjpyZXR1cm4gMT09PVEoKT96YShHKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSA1NzpyZXR1cm4gYT1wKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxzYShhLGIuc3RhY2tQb2ludGVyLCExKSxhPWErYi5zdGFja1BvaW50ZXImNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJgoyNTUscSgwKSw4O2Nhc2UgNTg6cmV0dXJuIGE9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckE9SihhKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSA1OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMSY2NTUzNSw4O2Nhc2UgNjA6cmV0dXJuIE8oYi5yZWdpc3RlckEsMSksYi5yZWdpc3RlckE9Yi5yZWdpc3RlckErMSYyNTUsMD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKSxxKDApLDQ7Y2FzZSA2MTpyZXR1cm4gTyhiLnJlZ2lzdGVyQSwtMSksYi5yZWdpc3RlckE9Yi5yZWdpc3RlckEtMSYyNTUsMD09PWIucmVnaXN0ZXJBP2woMSk6bCgwKSxxKDEpLDQ7Y2FzZSA2MjpyZXR1cm4gYi5yZWdpc3RlckE9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA2MzpyZXR1cm4gcSgwKSxEKDApLDA8USgpP3coMCk6dygxKSw0fXJldHVybi0xfWZ1bmN0aW9uIEViKGEpe3N3aXRjaChhKXtjYXNlIDY0OnJldHVybiA0OwpjYXNlIDY1OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQyw0O2Nhc2UgNjY6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJELDQ7Y2FzZSA2NzpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckUsNDtjYXNlIDY4OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVySCw0O2Nhc2UgNjk6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJMLDQ7Y2FzZSA3MDpyZXR1cm4gYi5yZWdpc3RlckI9SihwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDcxOnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQSw0O2Nhc2UgNzI6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJCLDQ7Y2FzZSA3MzpyZXR1cm4gNDtjYXNlIDc0OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyRCw0O2Nhc2UgNzU6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJFLDQ7Y2FzZSA3NjpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckgsNDtjYXNlIDc3OnJldHVybiBiLnJlZ2lzdGVyQz0KYi5yZWdpc3RlckwsNDtjYXNlIDc4OnJldHVybiBiLnJlZ2lzdGVyQz1KKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgNzk6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gRmIoYSl7c3dpdGNoKGEpe2Nhc2UgODA6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJCLDQ7Y2FzZSA4MTpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckMsNDtjYXNlIDgyOnJldHVybiA0O2Nhc2UgODM6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJFLDQ7Y2FzZSA4NDpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckgsNDtjYXNlIDg1OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyTCw0O2Nhc2UgODY6cmV0dXJuIGIucmVnaXN0ZXJEPUoocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA4NzpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckEsNDtjYXNlIDg4OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQiwKNDtjYXNlIDg5OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQyw0O2Nhc2UgOTA6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJELDQ7Y2FzZSA5MTpyZXR1cm4gNDtjYXNlIDkyOnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVySCw0O2Nhc2UgOTM6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJMLDQ7Y2FzZSA5NDpyZXR1cm4gYi5yZWdpc3RlckU9SihwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDk1OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIEdiKGEpe3N3aXRjaChhKXtjYXNlIDk2OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQiw0O2Nhc2UgOTc6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJDLDQ7Y2FzZSA5ODpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckQsNDtjYXNlIDk5OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTAwOnJldHVybiBiLnJlZ2lzdGVySD0KYi5yZWdpc3RlckgsNDtjYXNlIDEwMTpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckwsNDtjYXNlIDEwMjpyZXR1cm4gYi5yZWdpc3Rlckg9SihwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDEwMzpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckEsNDtjYXNlIDEwNDpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckIsNDtjYXNlIDEwNTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckMsNDtjYXNlIDEwNjpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckQsNDtjYXNlIDEwNzpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckUsNDtjYXNlIDEwODpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckgsNDtjYXNlIDEwOTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckwsNDtjYXNlIDExMDpyZXR1cm4gYi5yZWdpc3Rlckw9SihwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDExMTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckEsCjR9cmV0dXJuLTF9ZnVuY3Rpb24gSGIoYSl7c3dpdGNoKGEpe2Nhc2UgMTEyOnJldHVybiBQKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTEzOnJldHVybiBQKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTE0OnJldHVybiBQKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTE1OnJldHVybiBQKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTE2OnJldHVybiBQKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTE3OnJldHVybiBQKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTE4OnJldHVybiBkLmlzSGJsYW5rSGRtYUFjdGl2ZXx8KGIuaXNIYWx0ZWQ9ITApLDQ7Y2FzZSAxMTk6cmV0dXJuIFAocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckEpLAo0O2Nhc2UgMTIwOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQiw0O2Nhc2UgMTIxOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQyw0O2Nhc2UgMTIyOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyRCw0O2Nhc2UgMTIzOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTI0OnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVySCw0O2Nhc2UgMTI1OnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTI2OnJldHVybiBiLnJlZ2lzdGVyQT1KKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTI3OnJldHVybiA0fXJldHVybi0xfWZ1bmN0aW9uIEliKGEpe3N3aXRjaChhKXtjYXNlIDEyODpyZXR1cm4gZWEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMjk6cmV0dXJuIGVhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTMwOnJldHVybiBlYShiLnJlZ2lzdGVyRCksNDtjYXNlIDEzMTpyZXR1cm4gZWEoYi5yZWdpc3RlckUpLDQ7CmNhc2UgMTMyOnJldHVybiBlYShiLnJlZ2lzdGVySCksNDtjYXNlIDEzMzpyZXR1cm4gZWEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMzQ6cmV0dXJuIGE9SihwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksZWEoYSksNDtjYXNlIDEzNTpyZXR1cm4gZWEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxMzY6cmV0dXJuIGZhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTM3OnJldHVybiBmYShiLnJlZ2lzdGVyQyksNDtjYXNlIDEzODpyZXR1cm4gZmEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMzk6cmV0dXJuIGZhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTQwOnJldHVybiBmYShiLnJlZ2lzdGVySCksNDtjYXNlIDE0MTpyZXR1cm4gZmEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNDI6cmV0dXJuIGE9SihwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksZmEoYSksNDtjYXNlIDE0MzpyZXR1cm4gZmEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSmIoYSl7c3dpdGNoKGEpe2Nhc2UgMTQ0OnJldHVybiBoYShiLnJlZ2lzdGVyQiksCjQ7Y2FzZSAxNDU6cmV0dXJuIGhhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTQ2OnJldHVybiBoYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE0NzpyZXR1cm4gaGEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNDg6cmV0dXJuIGhhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTQ5OnJldHVybiBoYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE1MDpyZXR1cm4gYT1KKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxoYShhKSw0O2Nhc2UgMTUxOnJldHVybiBoYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE1MjpyZXR1cm4gaWEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNTM6cmV0dXJuIGlhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTU0OnJldHVybiBpYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE1NTpyZXR1cm4gaWEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNTY6cmV0dXJuIGlhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTU3OnJldHVybiBpYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE1ODpyZXR1cm4gYT1KKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSwKaWEoYSksNDtjYXNlIDE1OTpyZXR1cm4gaWEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gS2IoYSl7c3dpdGNoKGEpe2Nhc2UgMTYwOnJldHVybiBqYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE2MTpyZXR1cm4gamEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNjI6cmV0dXJuIGphKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTYzOnJldHVybiBqYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE2NDpyZXR1cm4gamEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNjU6cmV0dXJuIGphKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTY2OnJldHVybiBhPUoocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGphKGEpLDQ7Y2FzZSAxNjc6cmV0dXJuIGphKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTY4OnJldHVybiBrYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE2OTpyZXR1cm4ga2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNzA6cmV0dXJuIGthKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTcxOnJldHVybiBrYShiLnJlZ2lzdGVyRSksCjQ7Y2FzZSAxNzI6cmV0dXJuIGthKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTczOnJldHVybiBrYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE3NDpyZXR1cm4gYT1KKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxrYShhKSw0O2Nhc2UgMTc1OnJldHVybiBrYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBMYihhKXtzd2l0Y2goYSl7Y2FzZSAxNzY6cmV0dXJuIGxhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTc3OnJldHVybiBsYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE3ODpyZXR1cm4gbGEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNzk6cmV0dXJuIGxhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTgwOnJldHVybiBsYShiLnJlZ2lzdGVySCksNDtjYXNlIDE4MTpyZXR1cm4gbGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxODI6cmV0dXJuIGE9SihwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksbGEoYSksNDtjYXNlIDE4MzpyZXR1cm4gbGEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxODQ6cmV0dXJuIG1hKGIucmVnaXN0ZXJCKSwKNDtjYXNlIDE4NTpyZXR1cm4gbWEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxODY6cmV0dXJuIG1hKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTg3OnJldHVybiBtYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE4ODpyZXR1cm4gbWEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxODk6cmV0dXJuIG1hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTkwOnJldHVybiBhPUoocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLG1hKGEpLDQ7Y2FzZSAxOTE6cmV0dXJuIG1hKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIE1iKGEpe3N3aXRjaChhKXtjYXNlIDE5MjpyZXR1cm4gMD09PW5hKCk/KGIucHJvZ3JhbUNvdW50ZXI9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAxOTM6cmV0dXJuIGE9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckI9SChhKSxiLnJlZ2lzdGVyQz0KYSYyNTUsNDtjYXNlIDE5NDppZigwPT09bmEoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1WKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAxOTU6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9VigpLDg7Y2FzZSAxOTY6aWYoMD09PW5hKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9VigpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMTk3OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIscChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDg7Y2FzZSAxOTg6cmV0dXJuIGVhKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsCjQ7Y2FzZSAxOTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTAsODtjYXNlIDIwMDpyZXR1cm4gMT09PW5hKCk/KGIucHJvZ3JhbUNvdW50ZXI9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAyMDE6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsODtjYXNlIDIwMjppZigxPT09bmEoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1WKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMDM6dmFyIGM9RygpO2E9LTE7dmFyIGY9ITEsZD0wLGU9MCxoPWMlODtzd2l0Y2goaCl7Y2FzZSAwOmQ9Yi5yZWdpc3RlckI7YnJlYWs7Y2FzZSAxOmQ9CmIucmVnaXN0ZXJDO2JyZWFrO2Nhc2UgMjpkPWIucmVnaXN0ZXJEO2JyZWFrO2Nhc2UgMzpkPWIucmVnaXN0ZXJFO2JyZWFrO2Nhc2UgNDpkPWIucmVnaXN0ZXJIO2JyZWFrO2Nhc2UgNTpkPWIucmVnaXN0ZXJMO2JyZWFrO2Nhc2UgNjpkPUoocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpO2JyZWFrO2Nhc2UgNzpkPWIucmVnaXN0ZXJBfXZhciBrPShjJjI0MCk+PjQ7c3dpdGNoKGspe2Nhc2UgMDo3Pj1jPyhjPWQsMTI4PT09KGMmMTI4KT93KDEpOncoMCksYz0oYzw8MXxjPj43KSYyNTUsMD09PWM/bCgxKTpsKDApLHEoMCksRCgwKSxlPWMsZj0hMCk6MTU+PWMmJihjPWQsMDwoYyYxKT93KDEpOncoMCksYz0oYz4+MXxjPDw3KSYyNTUsMD09PWM/bCgxKTpsKDApLHEoMCksRCgwKSxlPWMsZj0hMCk7YnJlYWs7Y2FzZSAxOjIzPj1jPyhjPWQsZj0hMSwxMjg9PT0oYyYxMjgpJiYoZj0hMCksYz0oYzw8MXxRKCkpJjI1NSxmP3coMSk6dygwKSwwPT09Yz9sKDEpOmwoMCkscSgwKSxEKDApLAplPWMsZj0hMCk6MzE+PWMmJihjPWQsZj0hMSwxPT09KGMmMSkmJihmPSEwKSxjPShjPj4xfFEoKTw8NykmMjU1LGY/dygxKTp3KDApLDA9PT1jP2woMSk6bCgwKSxxKDApLEQoMCksZT1jLGY9ITApO2JyZWFrO2Nhc2UgMjozOT49Yz8oYz1kLGY9ITEsMTI4PT09KGMmMTI4KSYmKGY9ITApLGM9Yzw8MSYyNTUsZj93KDEpOncoMCksMD09PWM/bCgxKTpsKDApLHEoMCksRCgwKSxlPWMsZj0hMCk6NDc+PWMmJihjPWQsZj0hMSwxMjg9PT0oYyYxMjgpJiYoZj0hMCksZD0hMSwxPT09KGMmMSkmJihkPSEwKSxjPWM+PjEmMjU1LGYmJihjfD0xMjgpLDA9PT1jP2woMSk6bCgwKSxxKDApLEQoMCksZD93KDEpOncoMCksZT1jLGY9ITApO2JyZWFrO2Nhc2UgMzo1NT49Yz8oYz1kLGM9KChjJjE1KTw8NHwoYyYyNDApPj40KSYyNTUsMD09PWM/bCgxKTpsKDApLHEoMCksRCgwKSx3KDApLGU9YyxmPSEwKTo2Mz49YyYmKGM9ZCxmPSExLDE9PT0oYyYxKSYmKGY9ITApLGM9Yz4+MSYyNTUsMD09PWM/CmwoMSk6bCgwKSxxKDApLEQoMCksZj93KDEpOncoMCksZT1jLGY9ITApO2JyZWFrO2Nhc2UgNDo3MT49Yz8oZT1xYSgwLGQpLGY9ITApOjc5Pj1jJiYoZT1xYSgxLGQpLGY9ITApO2JyZWFrO2Nhc2UgNTo4Nz49Yz8oZT1xYSgyLGQpLGY9ITApOjk1Pj1jJiYoZT1xYSgzLGQpLGY9ITApO2JyZWFrO2Nhc2UgNjoxMDM+PWM/KGU9cWEoNCxkKSxmPSEwKToxMTE+PWMmJihlPXFhKDUsZCksZj0hMCk7YnJlYWs7Y2FzZSA3OjExOT49Yz8oZT1xYSg2LGQpLGY9ITApOjEyNz49YyYmKGU9cWEoNyxkKSxmPSEwKTticmVhaztjYXNlIDg6MTM1Pj1jPyhlPVcoMCwwLGQpLGY9ITApOjE0Mz49YyYmKGU9VygxLDAsZCksZj0hMCk7YnJlYWs7Y2FzZSA5OjE1MT49Yz8oZT1XKDIsMCxkKSxmPSEwKToxNTk+PWMmJihlPVcoMywwLGQpLGY9ITApO2JyZWFrO2Nhc2UgMTA6MTY3Pj1jPyhlPVcoNCwwLGQpLGY9ITApOjE3NT49YyYmKGU9Vyg1LDAsZCksZj0hMCk7YnJlYWs7Y2FzZSAxMToxODM+PWM/KGU9ClcoNiwwLGQpLGY9ITApOjE5MT49YyYmKGU9Vyg3LDAsZCksZj0hMCk7YnJlYWs7Y2FzZSAxMjoxOTk+PWM/KGU9VygwLDEsZCksZj0hMCk6MjA3Pj1jJiYoZT1XKDEsMSxkKSxmPSEwKTticmVhaztjYXNlIDEzOjIxNT49Yz8oZT1XKDIsMSxkKSxmPSEwKToyMjM+PWMmJihlPVcoMywxLGQpLGY9ITApO2JyZWFrO2Nhc2UgMTQ6MjMxPj1jPyhlPVcoNCwxLGQpLGY9ITApOjIzOT49YyYmKGU9Vyg1LDEsZCksZj0hMCk7YnJlYWs7Y2FzZSAxNToyNDc+PWM/KGU9Vyg2LDEsZCksZj0hMCk6MjU1Pj1jJiYoZT1XKDcsMSxkKSxmPSEwKX1zd2l0Y2goaCl7Y2FzZSAwOmIucmVnaXN0ZXJCPWU7YnJlYWs7Y2FzZSAxOmIucmVnaXN0ZXJDPWU7YnJlYWs7Y2FzZSAyOmIucmVnaXN0ZXJEPWU7YnJlYWs7Y2FzZSAzOmIucmVnaXN0ZXJFPWU7YnJlYWs7Y2FzZSA0OmIucmVnaXN0ZXJIPWU7YnJlYWs7Y2FzZSA1OmIucmVnaXN0ZXJMPWU7YnJlYWs7Y2FzZSA2Oig0Pmt8fDc8aykmJlAocChiLnJlZ2lzdGVySCwKYi5yZWdpc3RlckwpLGUpO2JyZWFrO2Nhc2UgNzpiLnJlZ2lzdGVyQT1lfWYmJihhPTQpO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1O3JldHVybiBhO2Nhc2UgMjA0OmlmKDE9PT1uYSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyKSxiLnByb2dyYW1Db3VudGVyPVYoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIwNTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1WKCksODtjYXNlIDIwNjpyZXR1cm4gZmEoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjA3OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0KMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9OH1yZXR1cm4tMX1mdW5jdGlvbiBOYihhKXtzd2l0Y2goYSl7Y2FzZSAyMDg6cmV0dXJuIDA9PT1RKCk/KGIucHJvZ3JhbUNvdW50ZXI9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAyMDk6cmV0dXJuIGE9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckQ9SChhKSxiLnJlZ2lzdGVyRT1hJjI1NSw0O2Nhc2UgMjEwOmlmKDA9PT1RKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9VigpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjEyOmlmKDA9PT1RKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKwoyKSxiLnByb2dyYW1Db3VudGVyPVYoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIxMzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLHAoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpKSw4O2Nhc2UgMjE0OnJldHVybiBoYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMTU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTE2LDg7Y2FzZSAyMTY6cmV0dXJuIDE9PT1RKCk/KGIucHJvZ3JhbUNvdW50ZXI9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAyMTc6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9YmEoYi5zdGFja1BvaW50ZXIpLAptLm1hc3RlckludGVycnVwdFN3aXRjaD0hMCxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDg7Y2FzZSAyMTg6aWYoMT09PVEoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1WKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjA6aWYoMT09PVEoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1WKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjI6cmV0dXJuIGlhKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIyMzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLApiLnByb2dyYW1Db3VudGVyPTI0LDh9cmV0dXJuLTF9ZnVuY3Rpb24gT2IoYSl7c3dpdGNoKGEpe2Nhc2UgMjI0OnJldHVybiBhPUcoKSxQKDY1MjgwK2EsYi5yZWdpc3RlckEpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMjU6cmV0dXJuIGE9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3Rlckg9SChhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgMjI2OnJldHVybiBQKDY1MjgwK2IucmVnaXN0ZXJDLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMjI5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIscChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDg7Y2FzZSAyMzA6cmV0dXJuIGphKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzMTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9CmIuc3RhY2tQb2ludGVyLTImNjU1MzUsVShiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTMyLDg7Y2FzZSAyMzI6cmV0dXJuIGE9UWEoRygpKSxzYShiLnN0YWNrUG9pbnRlcixhLCEwKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcithJjY1NTM1LGwoMCkscSgwKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSwxMjtjYXNlIDIzMzpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1wKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSw0O2Nhc2UgMjM0OnJldHVybiBQKFYoKSxiLnJlZ2lzdGVyQSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDIzODpyZXR1cm4ga2EoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjM5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsCmIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9NDAsOH1yZXR1cm4tMX1mdW5jdGlvbiBQYihhKXtzd2l0Y2goYSl7Y2FzZSAyNDA6cmV0dXJuIGE9RygpLGIucmVnaXN0ZXJBPUooNjUyODArYSkmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyNDE6cmV0dXJuIGE9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckE9SChhKSxiLnJlZ2lzdGVyRj1hJjI1NSw0O2Nhc2UgMjQyOnJldHVybiBiLnJlZ2lzdGVyQT1KKDY1MjgwK2IucmVnaXN0ZXJDKSYyNTUsNDtjYXNlIDI0MzpyZXR1cm4gbS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITEsNDtjYXNlIDI0NTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxVKGIuc3RhY2tQb2ludGVyLHAoYi5yZWdpc3RlckEsYi5yZWdpc3RlckYpKSw4O2Nhc2UgMjQ2OnJldHVybiBsYShHKCkpLApiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjQ3OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj00OCw4O2Nhc2UgMjQ4OnJldHVybiBhPVFhKEcoKSksbCgwKSxxKDApLHNhKGIuc3RhY2tQb2ludGVyLGEsITApLGE9Yi5zdGFja1BvaW50ZXIrYSY2NTUzNSxiLnJlZ2lzdGVySD1IKGEpLGIucmVnaXN0ZXJMPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAyNDk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLDg7Y2FzZSAyNTA6cmV0dXJuIGIucmVnaXN0ZXJBPUooVigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjUxOnJldHVybiBtLm1hc3RlckludGVycnVwdFN3aXRjaD0hMCwKNDtjYXNlIDI1NDpyZXR1cm4gbWEoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjU1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFUoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj01Niw4fXJldHVybi0xfWZ1bmN0aW9uIHBiKCl7Zm9yKHZhciBhPSExLGM7IWEmJmIuY3VycmVudEN5Y2xlczxiLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCk7KWM9QWEoKSwwPmMmJihhPSEwKTtpZihiLmN1cnJlbnRDeWNsZXM+PWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKSlyZXR1cm4gYi5jdXJyZW50Q3ljbGVzLT1iLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCksMDtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXItMSY2NTUzNTtyZXR1cm4tMX1mdW5jdGlvbiBBYSgpe0JhPSEwO3ZhciBhPTQ7Yi5pc0hhbHRlZHx8Yi5pc1N0b3BwZWQ/Yi5pc0hhbHRlZCYmIW0ubWFzdGVySW50ZXJydXB0U3dpdGNoJiYKbS5hcmVJbnRlcnJ1cHRzUGVuZGluZygpJiYoYi5pc0hhbHRlZD0hMSxiLmlzU3RvcHBlZD0hMSxhPXkoYi5wcm9ncmFtQ291bnRlciksYT1vYihhKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXItMSY2NTUzNSk6KGE9eShiLnByb2dyYW1Db3VudGVyKSxhPW9iKGEpKTtiLnJlZ2lzdGVyRiY9MjQwO2lmKDA+PWEpcmV0dXJuIGE7YTp7aWYobS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2gmJjA8bS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJiYwPG0uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlKXt2YXIgYz0hMTttLmlzVkJsYW5rSW50ZXJydXB0RW5hYmxlZCYmbS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD8oTmEobS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCksYz0hMCk6bS5pc0xjZEludGVycnVwdEVuYWJsZWQmJm0uaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KE5hKG0uYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpLGM9ITApOm0uaXNUaW1lckludGVycnVwdEVuYWJsZWQmJgptLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KE5hKG0uYml0UG9zaXRpb25UaW1lckludGVycnVwdCksYz0hMCk6bS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQmJm0uaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQmJihOYShtLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0KSxjPSEwKTtpZihjKXtjPTIwO2IuaXNIYWx0ZWQmJihiLmlzSGFsdGVkPSExLGMrPTQpO2JyZWFrIGF9fWM9MH1hKz1jO3JhKGEpO3JldHVybiBhfWZ1bmN0aW9uIHJhKGEpezA8ZC5ETUFDeWNsZXMmJihhKz1kLkRNQUN5Y2xlcyxkLkRNQUN5Y2xlcz0wKTtiLmN1cnJlbnRDeWNsZXMrPWE7aWYoIWIuaXNTdG9wcGVkKXtpZihSLmdyYXBoaWNzQmF0Y2hQcm9jZXNzaW5nKXtpZihyLmN1cnJlbnRDeWNsZXMrPWEsIShyLmN1cnJlbnRDeWNsZXM8ci5iYXRjaFByb2Nlc3NDeWNsZXMoKSkpZm9yKDtyLmN1cnJlbnRDeWNsZXM+PXIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCk7KW5iKHIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCkpLApyLmN1cnJlbnRDeWNsZXMtPXIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCl9ZWxzZSBuYihhKTtSLmF1ZGlvQmF0Y2hQcm9jZXNzaW5nP2UuY3VycmVudEN5Y2xlcys9YTpnYihhKX1SLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz8oZy5jdXJyZW50Q3ljbGVzKz1hLFRhKGcuY3VycmVudEN5Y2xlcyksZy5jdXJyZW50Q3ljbGVzPTApOlRhKGEpfWZ1bmN0aW9uIFFiKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpO2EuZnBzVGltZVN0YW1wcy5wdXNoKGIpO2EudGltZVN0YW1wc1VudGlsUmVhZHktLTswPmEudGltZVN0YW1wc1VudGlsUmVhZHkmJihhLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTApO3JldHVybiBifWZ1bmN0aW9uIHFiKGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPwoxLjI1Kk1hdGguZmxvb3IoYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpOjEyMH1mdW5jdGlvbiByYihhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCkpLWEuZnBzVGltZVN0YW1wc1thLmZwc1RpbWVTdGFtcHMubGVuZ3RoLTFdO2I9c2ItYjswPmImJihiPTApO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e3RiKGEpfSxNYXRoLmZsb29yKGIpKX1mdW5jdGlvbiB0YihhLGIpe2lmKGEucGF1c2VkKXJldHVybiEwO3ZvaWQgMCE9PWImJihzYj1iKTtDYT1hLmdldEZQUygpO2lmKENhPmEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKzEpcmV0dXJuIGEuZnBzVGltZVN0YW1wcy5zaGlmdCgpLHJiKGEpLCEwO1FiKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZjtjP1phKGEsYik6KGY9CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksYihmKSl9KSkudGhlbigoYik9PntpZigwPD1iKXtaKE4oe3R5cGU6Qy5VUERBVEVELGZwczpDYX0pKTtiPSExO2Eub3B0aW9ucy5mcmFtZVNraXAmJjA8YS5vcHRpb25zLmZyYW1lU2tpcCYmKGEuZnJhbWVTa2lwQ291bnRlcisrLGEuZnJhbWVTa2lwQ291bnRlcjw9YS5vcHRpb25zLmZyYW1lU2tpcD9iPSEwOmEuZnJhbWVTa2lwQ291bnRlcj0wKTtifHwoYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyLGEuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6Qy5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSkpO2NvbnN0IGM9e3R5cGU6Qy5VUERBVEVEfTtjW0YuQ0FSVFJJREdFX1JBTV09CiRhKGEpLmJ1ZmZlcjtjW0YuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2NbRi5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7Y1tGLklOVEVSTkFMX1NUQVRFXT1hYihhKS5idWZmZXI7T2JqZWN0LmtleXMoYykuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1jW2FdJiYoY1thXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTihjKSxbY1tGLkNBUlRSSURHRV9SQU1dLGNbRi5HQU1FQk9ZX01FTU9SWV0sY1tGLlBBTEVUVEVfTUVNT1JZXSwKY1tGLklOVEVSTkFMX1NUQVRFXV0pO3JiKGEpfWVsc2UgWihOKHt0eXBlOkMuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIFphKGEsYil7dmFyIGM9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvKDEwMjQpOzEhPT1jJiZiKGMpO2lmKDE9PT1jKXtjPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0QXVkaW9RdWV1ZUluZGV4KCk7Y29uc3QgZj1DYT49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmZj8odWIoYSxjKSxzZXRUaW1lb3V0KCgpPT57cWIoYSk7WmEoYSxiKX0sTWF0aC5mbG9vcihNYXRoLmZsb29yKDFFMyooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOih1YihhLGMpLFphKGEsYikpfX1mdW5jdGlvbiB1YihhLGIpe2NvbnN0IGM9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6Qy5VUERBVEVELGF1ZGlvQnVmZmVyOmMsbnVtYmVyT2ZTYW1wbGVzOmIsZnBzOkNhLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX0pLFtjXSk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKX1jb25zdCBFYT0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCBQYTtFYXx8KFBhPXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgQz17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLApHRVRfQ09OU1RBTlRTOiJHRVRfQ09OU1RBTlRTIixHRVRfQ09OU1RBTlRTX0RPTkU6IkdFVF9DT05TVEFOVFNfRE9ORSIsQ09ORklHOiJDT05GSUciLFJFU0VUX0FVRElPX1FVRVVFOiJSRVNFVF9BVURJT19RVUVVRSIsUExBWToiUExBWSIsUEFVU0U6IlBBVVNFIixVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQifSxGPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLApQQUxFVFRFX01FTU9SWToiUEFMRVRURV9NRU1PUlkiLElOVEVSTkFMX1NUQVRFOiJJTlRFUk5BTF9TVEFURSJ9O2xldCBGYT0wO2NvbnN0IGg9bmV3IFVpbnQ4Q2xhbXBlZEFycmF5KDkxMDk1MDQpLERhPXtzaXplOigpPT45MTA5NTA0LGdyb3c6KCk9Pnt9LHdhc21CeXRlTWVtb3J5Omh9O3ZhciB5YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXg9NjUzODQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlRGF0YT02NTM4NTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZUluZGV4PTY1Mzg2O2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YT02NTM4NztyZXR1cm4gYX0oKSxkYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS50aWxlSWQ9LTE7YS5ob3Jpem9udGFsRmxpcD0hMTthLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrPS0xO3JldHVybiBhfSgpLHo9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYil7YS5OUngwU3dlZXBQZXJpb2Q9KGImMTEyKT4+NDthLk5SeDBOZWdhdGU9bigzLGIpO2EuTlJ4MFN3ZWVwU2hpZnQ9YiY3fTthLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxRHV0eT1iPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1uKDYsYik7YS5OUng0RnJlcXVlbmN5TVNCPQpiJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtTKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtoWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2hbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2hbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtoWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtoWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtoWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHk7UygxMDQ5KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzU3dlZXBFbmFibGVkKTtoWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwQ291bnRlcjtoWzEwNTUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwU2hhZG93RnJlcXVlbmN5fTsKYS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1UKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWhbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWhbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1oWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1oWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmR1dHlDeWNsZT1oWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9aFsxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1N3ZWVwRW5hYmxlZD1UKDEwNDkrNTAqYS5zYXZlU3RhdGVTbG90KTthLnN3ZWVwQ291bnRlcj1oWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XTthLnN3ZWVwU2hhZG93RnJlcXVlbmN5PWhbMTA1NSs1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtrKGEubWVtb3J5TG9jYXRpb25OUngwLAoxMjgpO2soYS5tZW1vcnlMb2NhdGlvbk5SeDEsMTkxKTtrKGEubWVtb3J5TG9jYXRpb25OUngyLDI0Myk7ayhhLm1lbW9yeUxvY2F0aW9uTlJ4MywxOTMpO2soYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTkxKX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9NCooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEucmVzZXRUaW1lcigpLGEuZnJlcXVlbmN5VGltZXItPWIsYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5Kz0xLDg8PWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSYmCihhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MCkpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPTE7ZGIoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYyo9LTEpO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EucmVzZXRUaW1lcigpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9YS5mcmVxdWVuY3k7YS5zd2VlcENvdW50ZXI9YS5OUngwU3dlZXBQZXJpb2Q7YS5pc1N3ZWVwRW5hYmxlZD0wPGEuTlJ4MFN3ZWVwUGVyaW9kJiYwPGEuTlJ4MFN3ZWVwU2hpZnQ/ITA6ITE7MDxhLk5SeDBTd2VlcFNoaWZ0JiZlYigpO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9CiExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLnVwZGF0ZVN3ZWVwPWZ1bmN0aW9uKCl7LS1hLnN3ZWVwQ291bnRlcjswPj1hLnN3ZWVwQ291bnRlciYmKGEuc3dlZXBDb3VudGVyPWEuTlJ4MFN3ZWVwUGVyaW9kLGEuaXNTd2VlcEVuYWJsZWQmJjA8YS5OUngwU3dlZXBQZXJpb2QmJmViKCkpfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmCjE1PmEudm9sdW1lP2Eudm9sdW1lKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYil7dmFyIGM9Yj4+ODtiJj0yNTU7dmFyIGQ9eShhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGM7ayhhLm1lbW9yeUxvY2F0aW9uTlJ4MyxiKTtrKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuTlJ4NEZyZXF1ZW5jeU1TQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUyOTY7YS5OUngwU3dlZXBQZXJpb2Q9MDthLk5SeDBOZWdhdGU9ITE7YS5OUngwU3dlZXBTaGlmdD0wO2EubWVtb3J5TG9jYXRpb25OUngxPTY1Mjk3O2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUyOTg7YS5OUngyU3RhcnRpbmdWb2x1bWU9CjA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUyOTk7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMDA7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLmNoYW5uZWxOdW1iZXI9MTthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kdXR5Q3ljbGU9MDthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MDthLmlzU3dlZXBFbmFibGVkPSExO2Euc3dlZXBDb3VudGVyPTA7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT0wO2Euc2F2ZVN0YXRlU2xvdD03O3JldHVybiBhfSgpLEs9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFEdXR5PWI+Pgo2JjM7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1uKDYsYik7YS5OUng0RnJlcXVlbmN5TVNCPWImNzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe1MoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0VuYWJsZWQpO2hbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPQphLmZyZXF1ZW5jeVRpbWVyO2hbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2hbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtoWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtoWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtoWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9VCgxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1oWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1oWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxlbmd0aENvdW50ZXI9aFsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWU9aFsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kdXR5Q3ljbGU9aFsxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF07CmEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1oWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7ayhhLm1lbW9yeUxvY2F0aW9uTlJ4MS0xLDI1NSk7ayhhLm1lbW9yeUxvY2F0aW9uTlJ4MSw2Myk7ayhhLm1lbW9yeUxvY2F0aW9uTlJ4MiwwKTtrKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2soYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTg0KX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9NCooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLAphLnJlc2V0VGltZXIoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSs9MSw4PD1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkmJihhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MCkpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPTE7ZGIoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYyo9LTEpO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EucmVzZXRUaW1lcigpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPAphLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+YS52b2x1bWU/YS52b2x1bWUrPTE6IWEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMDxhLnZvbHVtZSYmLS1hLnZvbHVtZSkpfTthLnNldEZyZXF1ZW5jeT1mdW5jdGlvbihiKXt2YXIgYz1iPj44O2ImPTI1NTt2YXIgZD15KGEubWVtb3J5TG9jYXRpb25OUng0KSYyNDh8YztrKGEubWVtb3J5TG9jYXRpb25OUngzLGIpO2soYS5tZW1vcnlMb2NhdGlvbk5SeDQsCmQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuTlJ4NEZyZXF1ZW5jeU1TQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMDI7YS5OUngxRHV0eT0wO2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwMzthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA0O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzA1O2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5jaGFubmVsTnVtYmVyPTI7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9MDthLmZyZXF1ZW5jeVRpbWVyPTA7YS5lbnZlbG9wZUNvdW50ZXI9MDthLmxlbmd0aENvdW50ZXI9CjA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wO2Euc2F2ZVN0YXRlU2xvdD04O3JldHVybiBhfSgpLEk9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MD1mdW5jdGlvbihiKXthLmlzRGFjRW5hYmxlZD1uKDcsYil9O2EudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFMZW5ndGhMb2FkPWI7YS5sZW5ndGhDb3VudGVyPTI1Ni1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyVm9sdW1lQ29kZT1iPj41JjE1fTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9big2LGIpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fAphLk5SeDNGcmVxdWVuY3lMU0J9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7UygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7aFsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtoWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7aFsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlVGFibGVQb3NpdGlvbn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1UKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWhbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1oWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVUYWJsZVBvc2l0aW9uPWhbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtrKGEubWVtb3J5TG9jYXRpb25OUngwLDEyNyk7ayhhLm1lbW9yeUxvY2F0aW9uTlJ4MSwyNTUpO2soYS5tZW1vcnlMb2NhdGlvbk5SeDIsCjE1OSk7ayhhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtrKGEubWVtb3J5TG9jYXRpb25OUng0LDE4NCk7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMH07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9MiooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEucmVzZXRUaW1lcigpLGEuZnJlcXVlbmN5VGltZXItPWIsYS53YXZlVGFibGVQb3NpdGlvbis9MSwzMjw9YS53YXZlVGFibGVQb3NpdGlvbiYmKGEud2F2ZVRhYmxlUG9zaXRpb249MCkpO2I9MDt2YXIgYz1hLnZvbHVtZUNvZGU7CmlmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZClhLnZvbHVtZUNvZGVDaGFuZ2VkJiYoYz15KGEubWVtb3J5TG9jYXRpb25OUngyKSxjPWM+PjUmMTUsYS52b2x1bWVDb2RlPWMsYS52b2x1bWVDb2RlQ2hhbmdlZD0hMSk7ZWxzZSByZXR1cm4gMTU7dmFyIGQ9eShhLm1lbW9yeUxvY2F0aW9uV2F2ZVRhYmxlK2Eud2F2ZVRhYmxlUG9zaXRpb24vMik7ZD0wPT09YS53YXZlVGFibGVQb3NpdGlvbiUyP2Q+PjQmMTU6ZCYxNTtzd2l0Y2goYyl7Y2FzZSAwOmQ+Pj00O2JyZWFrO2Nhc2UgMTpiPTE7YnJlYWs7Y2FzZSAyOmQ+Pj0xO2I9MjticmVhaztkZWZhdWx0OmQ+Pj0yLGI9NH1yZXR1cm4oMDxiP2QvYjowKSsxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj0yNTYpO2EucmVzZXRUaW1lcigpO2Eud2F2ZVRhYmxlUG9zaXRpb249MDthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT0KZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7cmV0dXJuIDA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlciYmIWEudm9sdW1lQ29kZUNoYW5nZWQ/ITE6ITB9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7MDxhLmxlbmd0aENvdW50ZXImJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYS5sZW5ndGhDb3VudGVyOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmlzRW5hYmxlZD0hMSl9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUzMDY7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMDc7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1MzA4O2EuTlJ4MlZvbHVtZUNvZGU9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTMwOTthLk5SeDNGcmVxdWVuY3lMU0I9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMxMDthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EubWVtb3J5TG9jYXRpb25XYXZlVGFibGU9CjY1MzI4O2EuY2hhbm5lbE51bWJlcj0zO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eud2F2ZVRhYmxlUG9zaXRpb249MDthLnZvbHVtZUNvZGU9MDthLnZvbHVtZUNvZGVDaGFuZ2VkPSExO2Euc2F2ZVN0YXRlU2xvdD05O3JldHVybiBhfSgpLEw9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFMZW5ndGhMb2FkPWImNjM7YS5sZW5ndGhDb3VudGVyPTY0LWEuTlJ4MUxlbmd0aExvYWR9O2EudXBkYXRlTlJ4Mj1mdW5jdGlvbihiKXthLk5SeDJTdGFydGluZ1ZvbHVtZT1iPj40JjE1O2EuTlJ4MkVudmVsb3BlQWRkTW9kZT1uKDMsYik7YS5OUngyRW52ZWxvcGVQZXJpb2Q9YiY3O2EuaXNEYWNFbmFibGVkPTA8KGImMjQ4KX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGIpe2EuTlJ4M0Nsb2NrU2hpZnQ9Yj4+NDthLk5SeDNXaWR0aE1vZGU9Cm4oMyxiKTthLk5SeDNEaXZpc29yQ29kZT1iJjc7c3dpdGNoKGEuTlJ4M0Rpdmlzb3JDb2RlKXtjYXNlIDA6YS5kaXZpc29yPTg7YnJlYWs7Y2FzZSAxOmEuZGl2aXNvcj0xNjticmVhaztjYXNlIDI6YS5kaXZpc29yPTMyO2JyZWFrO2Nhc2UgMzphLmRpdmlzb3I9NDg7YnJlYWs7Y2FzZSA0OmEuZGl2aXNvcj02NDticmVhaztjYXNlIDU6YS5kaXZpc29yPTgwO2JyZWFrO2Nhc2UgNjphLmRpdmlzb3I9OTY7YnJlYWs7Y2FzZSA3OmEuZGl2aXNvcj0xMTJ9fTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1uKDYsYil9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7UygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7aFsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtoWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmVudmVsb3BlQ291bnRlcjtoWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7CmhbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2hbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVQoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9aFsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5lbnZlbG9wZUNvdW50ZXI9aFsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWhbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eudm9sdW1lPWhbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPWhbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtrKGEubWVtb3J5TG9jYXRpb25OUngxLTEsMjU1KTtrKGEubWVtb3J5TG9jYXRpb25OUngxLDI1NSk7ayhhLm1lbW9yeUxvY2F0aW9uTlJ4MiwwKTtrKGEubWVtb3J5TG9jYXRpb25OUngzLAowKTtrKGEubWVtb3J5TG9jYXRpb25OUng0LDE5MSl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEuZnJlcXVlbmN5VGltZXI9YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2QoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGI9YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXImMV5hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj4+MSYxLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPj49MSxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcnw9Yjw8MTQsYS5OUngzV2lkdGhNb2RlJiYoYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXImPS02NSxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcnw9CmI8PDYpKTtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYj1hLnZvbHVtZTtlbHNlIHJldHVybiAxNTt2YXIgYz1uKDAsYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXIpPy0xOjE7cmV0dXJuIGMqYisxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj02NCk7YS5mcmVxdWVuY3lUaW1lcj1hLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZCgpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPTMyNzY3O2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXI/ITE6ITB9O2EuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kPQpmdW5jdGlvbigpe3ZhciBjPWEuZGl2aXNvcjw8YS5OUngzQ2xvY2tTaGlmdDtiLkdCQ0RvdWJsZVNwZWVkJiYoYyo9Mik7cmV0dXJuIGN9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7MDxhLmxlbmd0aENvdW50ZXImJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYS5sZW5ndGhDb3VudGVyOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmlzRW5hYmxlZD0hMSl9O2EudXBkYXRlRW52ZWxvcGU9ZnVuY3Rpb24oKXstLWEuZW52ZWxvcGVDb3VudGVyOzA+PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2QsMCE9PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYxNT5hLnZvbHVtZT9hLnZvbHVtZSs9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGEudm9sdW1lJiYtLWEudm9sdW1lKSl9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMTI7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPQo2NTMxMzthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzE0O2EuTlJ4M0Nsb2NrU2hpZnQ9MDthLk5SeDNXaWR0aE1vZGU9ITE7YS5OUngzRGl2aXNvckNvZGU9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMxNTthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuY2hhbm5lbE51bWJlcj00O2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kaXZpc29yPTA7YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MDthLnNhdmVTdGF0ZVNsb3Q9MTA7cmV0dXJuIGF9KCksdT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5jaGFubmVsMVNhbXBsZT0xNTthLmNoYW5uZWwyU2FtcGxlPTE1O2EuY2hhbm5lbDNTYW1wbGU9MTU7YS5jaGFubmVsNFNhbXBsZT0KMTU7YS5jaGFubmVsMURhY0VuYWJsZWQ9ITE7YS5jaGFubmVsMkRhY0VuYWJsZWQ9ITE7YS5jaGFubmVsM0RhY0VuYWJsZWQ9ITE7YS5jaGFubmVsNERhY0VuYWJsZWQ9ITE7YS5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7YS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O2EubWl4ZXJWb2x1bWVDaGFuZ2VkPSExO2EubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMTthLm5lZWRUb1JlbWl4U2FtcGxlcz0hMTtyZXR1cm4gYX0oKSxSPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmVuYWJsZUJvb3RSb209ITE7YS51c2VHYmNXaGVuQXZhaWxhYmxlPSEwO2EuYXVkaW9CYXRjaFByb2Nlc3Npbmc9ITE7YS5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0hMTthLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz0hMTthLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPSExO2EuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0hMTthLnRpbGVSZW5kZXJpbmc9ITE7YS50aWxlQ2FjaGluZz0KITE7cmV0dXJuIGF9KCksZT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD8xNzQ6ODd9O2EudXBkYXRlTlI1MD1mdW5jdGlvbihiKXthLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9Yj4+NCY3O2EuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9YiY3fTthLnVwZGF0ZU5SNTE9ZnVuY3Rpb24oYil7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9big3LGIpO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PW4oNixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD1uKDUsYik7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9big0LGIpO2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD1uKDMsYik7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PW4oMixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9Cm4oMSxiKTthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ9bigwLGIpfTthLnVwZGF0ZU5SNTI9ZnVuY3Rpb24oYil7YS5OUjUySXNTb3VuZEVuYWJsZWQ9big3LGIpfTthLm1heEZyYW1lU2VxdWVuY2VDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD8xNjM4NDo4MTkyfTthLm1heERvd25TYW1wbGVDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5DTE9DS19TUEVFRCgpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2hbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcjtoWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI7aFsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmFtZVNlcXVlbmNlcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9aFsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPQpoWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmZyYW1lU2VxdWVuY2VyPWhbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO1NhKCl9O2EuY3VycmVudEN5Y2xlcz0wO2EubWVtb3J5TG9jYXRpb25OUjUwPTY1MzE2O2EuTlI1MExlZnRNaXhlclZvbHVtZT0wO2EuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9MDthLm1lbW9yeUxvY2F0aW9uTlI1MT02NTMxNzthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9CiEwO2EubWVtb3J5TG9jYXRpb25OUjUyPTY1MzE4O2EuTlI1MklzU291bmRFbmFibGVkPSEwO2EubWVtb3J5TG9jYXRpb25DaGFubmVsM0xvYWRSZWdpc3RlclN0YXJ0PTY1MzI4O2EuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcj00OEUzO2EuZnJhbWVTZXF1ZW5jZXI9MDthLmF1ZGlvUXVldWVJbmRleD0wO2Eud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemU9MTMxMDcyO2Euc2F2ZVN0YXRlU2xvdD02O3JldHVybiBhfSgpLG09ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSW50ZXJydXB0RW5hYmxlZD1mdW5jdGlvbihiKXthLmlzVkJsYW5rSW50ZXJydXB0RW5hYmxlZD1uKGEuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQsYik7YS5pc0xjZEludGVycnVwdEVuYWJsZWQ9bihhLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0LGIpO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9Cm4oYS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0LGIpO2EuaXNKb3lwYWRJbnRlcnJ1cHRFbmFibGVkPW4oYS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCxiKTthLmludGVycnVwdHNFbmFibGVkVmFsdWU9Yn07YS51cGRhdGVJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ZnVuY3Rpb24oYil7YS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD1uKGEuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQsYik7YS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD1uKGEuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQsYik7YS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPW4oYS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0LGIpO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9bihhLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0LGIpO2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWJ9O2EuYXJlSW50ZXJydXB0c1BlbmRpbmc9ZnVuY3Rpb24oKXtyZXR1cm4gMDwoYS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmCmEuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7UygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLm1hc3RlckludGVycnVwdFN3aXRjaCk7UygxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5KX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLm1hc3RlckludGVycnVwdFN3aXRjaD1UKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PVQoMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EudXBkYXRlSW50ZXJydXB0RW5hYmxlZCh5KGEubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkKSk7YS51cGRhdGVJbnRlcnJ1cHRSZXF1ZXN0ZWQoeShhLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCkpfTthLm1hc3RlckludGVycnVwdFN3aXRjaD0hMTthLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PSExO2EuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ9CjA7YS5iaXRQb3NpdGlvbkxjZEludGVycnVwdD0xO2EuYml0UG9zaXRpb25UaW1lckludGVycnVwdD0yO2EuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQ9NDthLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZD02NTUzNTthLmludGVycnVwdHNFbmFibGVkVmFsdWU9MDthLmlzVkJsYW5rSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzTGNkSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRFbmFibGVkPSExO2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0PTY1Mjk1O2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPTA7YS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPSExO2Euc2F2ZVN0YXRlU2xvdD0yO3JldHVybiBhfSgpLGc9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiAyNTZ9O2EudXBkYXRlRGl2aWRlclJlZ2lzdGVyPWZ1bmN0aW9uKGIpe2I9YS5kaXZpZGVyUmVnaXN0ZXI7YS5kaXZpZGVyUmVnaXN0ZXI9MDtrKGEubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXIsMCk7YS50aW1lckVuYWJsZWQmJmpiKGIsYS5kaXZpZGVyUmVnaXN0ZXIpJiZVYSgpfTthLnVwZGF0ZVRpbWVyQ291bnRlcj1mdW5jdGlvbihiKXtpZihhLnRpbWVyRW5hYmxlZCl7aWYoYS50aW1lckNvdW50ZXJXYXNSZXNldClyZXR1cm47YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5JiYoYS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExKX1hLnRpbWVyQ291bnRlcj1ifTthLnVwZGF0ZVRpbWVyTW9kdWxvPWZ1bmN0aW9uKGIpe2EudGltZXJNb2R1bG89YjthLnRpbWVyRW5hYmxlZCYmYS50aW1lckNvdW50ZXJXYXNSZXNldCYmKGEudGltZXJDb3VudGVyPWEudGltZXJNb2R1bG8sYS50aW1lckNvdW50ZXJXYXNSZXNldD0KITEpfTthLnVwZGF0ZVRpbWVyQ29udHJvbD1mdW5jdGlvbihiKXt2YXIgYz1hLnRpbWVyRW5hYmxlZDthLnRpbWVyRW5hYmxlZD1uKDIsYik7YiY9MztpZighYyl7Yz1WYShhLnRpbWVySW5wdXRDbG9jayk7dmFyIGQ9VmEoYik7KGEudGltZXJFbmFibGVkP24oYyxhLmRpdmlkZXJSZWdpc3Rlcik6bihjLGEuZGl2aWRlclJlZ2lzdGVyKSYmbihkLGEuZGl2aWRlclJlZ2lzdGVyKSkmJlVhKCl9YS50aW1lcklucHV0Q2xvY2s9Yn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtoWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRDeWNsZXM7aFsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kaXZpZGVyUmVnaXN0ZXI7UygxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXkpO1MoMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3QsYS50aW1lckNvdW50ZXJXYXNSZXNldCk7ayhhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyLGEudGltZXJDb3VudGVyKX07CmEubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5jdXJyZW50Q3ljbGVzPWhbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZGl2aWRlclJlZ2lzdGVyPWhbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT1UKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90KTthLnRpbWVyQ291bnRlcldhc1Jlc2V0PVQoMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EudGltZXJDb3VudGVyPXkoYS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcik7YS50aW1lck1vZHVsbz15KGEubWVtb3J5TG9jYXRpb25UaW1lck1vZHVsbyk7YS50aW1lcklucHV0Q2xvY2s9eShhLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sKX07YS5jdXJyZW50Q3ljbGVzPTA7YS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3Rlcj02NTI4NDthLmRpdmlkZXJSZWdpc3Rlcj0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI9NjUyODU7YS50aW1lckNvdW50ZXI9MDthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9CiExO2EudGltZXJDb3VudGVyV2FzUmVzZXQ9ITE7YS50aW1lckNvdW50ZXJNYXNrPTA7YS5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvPTY1Mjg2O2EudGltZXJNb2R1bG89MDthLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sPTY1Mjg3O2EudGltZXJFbmFibGVkPSExO2EudGltZXJJbnB1dENsb2NrPTA7YS5zYXZlU3RhdGVTbG90PTU7cmV0dXJuIGF9KCksQT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVKb3lwYWQ9ZnVuY3Rpb24oYil7YS5qb3lwYWRSZWdpc3RlckZsaXBwZWQ9Yl4yNTU7YS5pc0RwYWRUeXBlPW4oNCxhLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCk7YS5pc0J1dHRvblR5cGU9big1LGEuam95cGFkUmVnaXN0ZXJGbGlwcGVkKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXt9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS51cGRhdGVKb3lwYWQoeShhLm1lbW9yeUxvY2F0aW9uSm95cGFkUmVnaXN0ZXIpKX07YS51cD0hMTthLmRvd249ITE7YS5sZWZ0PSExOwphLnJpZ2h0PSExO2EuYT0hMTthLmI9ITE7YS5zZWxlY3Q9ITE7YS5zdGFydD0hMTthLm1lbW9yeUxvY2F0aW9uSm95cGFkUmVnaXN0ZXI9NjUyODA7YS5qb3lwYWRSZWdpc3RlckZsaXBwZWQ9MDthLmlzRHBhZFR5cGU9ITE7YS5pc0J1dHRvblR5cGU9ITE7YS5zYXZlU3RhdGVTbG90PTM7cmV0dXJuIGF9KCksRT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVMY2RDb250cm9sPWZ1bmN0aW9uKGIpe2EuZW5hYmxlZD1uKDcsYik7YS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdD1uKDYsYik7YS53aW5kb3dEaXNwbGF5RW5hYmxlZD1uKDUsYik7YS5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0PW4oNCxiKTthLmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9bigzLGIpO2EudGFsbFNwcml0ZVNpemU9bigyLGIpO2Euc3ByaXRlRGlzcGxheUVuYWJsZT1uKDEsYik7YS5iZ0Rpc3BsYXlFbmFibGVkPW4oMCxiKX07YS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cz02NTM0NTthLmN1cnJlbnRMY2RNb2RlPQowO2EubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmU9NjUzNDk7YS5jb2luY2lkZW5jZUNvbXBhcmU9MDthLm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbD02NTM0NDthLmVuYWJsZWQ9ITA7YS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdD0hMTthLndpbmRvd0Rpc3BsYXlFbmFibGVkPSExO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD0hMTthLmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS50YWxsU3ByaXRlU2l6ZT0hMTthLnNwcml0ZURpc3BsYXlFbmFibGU9ITE7YS5iZ0Rpc3BsYXlFbmFibGVkPSExO3JldHVybiBhfSgpLHI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGEuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKX07YS5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORT1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzkxMjo0NTZ9O2EuTUlOX0NZQ0xFU19TUFJJVEVTX0xDRF9NT0RFPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/Cjc1MjozNzZ9O2EuTUlOX0NZQ0xFU19UUkFOU0ZFUl9EQVRBX0xDRF9NT0RFPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/NDk4OjI0OX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtoWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnNjYW5saW5lQ3ljbGVDb3VudGVyO2hbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPUUuY3VycmVudExjZE1vZGU7ayhhLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlcixhLnNjYW5saW5lUmVnaXN0ZXIpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9aFsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07RS5jdXJyZW50TGNkTW9kZT1oWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLnNjYW5saW5lUmVnaXN0ZXI9eShhLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcik7RS51cGRhdGVMY2RDb250cm9sKHkoRS5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wpKX07YS5jdXJyZW50Q3ljbGVzPQowO2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj02NTM0ODthLnNjYW5saW5lUmVnaXN0ZXI9MDthLm1lbW9yeUxvY2F0aW9uRG1hVHJhbnNmZXI9NjUzNTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFg9NjUzNDc7YS5zY3JvbGxYPTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFk9NjUzNDY7YS5zY3JvbGxZPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1g9NjUzNTU7YS53aW5kb3dYPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1k9NjUzNTQ7YS53aW5kb3dZPTA7YS5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ9Mzg5MTI7YS5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydD0zOTkzNjthLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ9MzQ4MTY7YS5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQ9MzI3Njg7YS5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZT0KNjUwMjQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlPTY1MzUxO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lPTY1MzUyO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvPTY1MzUzO2Euc2F2ZVN0YXRlU2xvdD0xO3JldHVybiBhfSgpLGQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7aFsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50Um9tQmFuaztoWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRSYW1CYW5rO1MoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1JhbUJhbmtpbmdFbmFibGVkKTtTKDEwMjkrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMxUm9tTW9kZUVuYWJsZWQpO1MoMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1JvbU9ubHkpO1MoMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc01CQzEpO1MoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc01CQzIpOwpTKDEwMzMrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMzKTtTKDEwMzQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkM1KX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRSb21CYW5rPWhbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudFJhbUJhbms9aFsxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1JhbUJhbmtpbmdFbmFibGVkPVQoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9VCgxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc1JvbU9ubHk9VCgxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzE9VCgxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzI9VCgxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzM9VCgxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzU9VCgxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdCl9O2EuY2FydHJpZGdlUm9tTG9jYXRpb249MDthLnN3aXRjaGFibGVDYXJ0cmlkZ2VSb21Mb2NhdGlvbj0KMTYzODQ7YS52aWRlb1JhbUxvY2F0aW9uPTMyNzY4O2EuY2FydHJpZGdlUmFtTG9jYXRpb249NDA5NjA7YS5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb249NDkxNTI7YS5pbnRlcm5hbFJhbUJhbmtPbmVMb2NhdGlvbj01MzI0ODthLmVjaG9SYW1Mb2NhdGlvbj01NzM0NDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj02NTAyNDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD02NTE4MzthLnVudXNhYmxlTWVtb3J5TG9jYXRpb249NjUxODQ7YS51bnVzYWJsZU1lbW9yeUVuZExvY2F0aW9uPTY1Mjc5O2EuY3VycmVudFJvbUJhbms9MDthLmN1cnJlbnRSYW1CYW5rPTA7YS5pc1JhbUJhbmtpbmdFbmFibGVkPSExO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA7YS5pc1JvbU9ubHk9ITA7YS5pc01CQzE9ITE7YS5pc01CQzI9ITE7YS5pc01CQzM9ITE7YS5pc01CQzU9ITE7YS5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VIaWdoPTY1MzYxO2EubWVtb3J5TG9jYXRpb25IZG1hU291cmNlTG93PQo2NTM2MjthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaD02NTM2MzthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uTG93PTY1MzY0O2EubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcj02NTM2NTthLkRNQUN5Y2xlcz0wO2EuaXNIYmxhbmtIZG1hQWN0aXZlPSExO2EuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPTA7YS5oYmxhbmtIZG1hU291cmNlPTA7YS5oYmxhbmtIZG1hRGVzdGluYXRpb249MDthLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbms9NjUzNTk7YS5tZW1vcnlMb2NhdGlvbkdCQ1dSQU1CYW5rPTY1MzkyO2Euc2F2ZVN0YXRlU2xvdD00O3JldHVybiBhfSgpLGI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuQ0xPQ0tfU1BFRUQ9ZnVuY3Rpb24oKXtyZXR1cm4gYS5HQkNEb3VibGVTcGVlZD84Mzg4NjA4OjQxOTQzMDR9O2EuTUFYX0NZQ0xFU19QRVJfRlJBTUU9ZnVuY3Rpb24oKXtyZXR1cm4gYS5HQkNEb3VibGVTcGVlZD8xNDA0NDg6CjcwMjI0fTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2hbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJBO2hbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJCO2hbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJDO2hbMTAyNys1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJEO2hbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJFO2hbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJIO2hbMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJMO2hbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJGO2hbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuc3RhY2tQb2ludGVyO2hbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucHJvZ3JhbUNvdW50ZXI7aFsxMDM2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50Q3ljbGVzO1MoMTA0MSs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0hhbHRlZCk7ClMoMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1N0b3BwZWQpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EucmVnaXN0ZXJBPWhbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJCPWhbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJDPWhbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJEPWhbMTAyNys1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJFPWhbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJIPWhbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJMPWhbMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJGPWhbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Euc3RhY2tQb2ludGVyPWhbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdO2EucHJvZ3JhbUNvdW50ZXI9aFsxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5jdXJyZW50Q3ljbGVzPWhbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdOwphLmlzSGFsdGVkPVQoMTA0MSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNTdG9wcGVkPVQoMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3QpfTthLkdCQ0VuYWJsZWQ9ITE7YS5HQkNEb3VibGVTcGVlZD0hMTthLnJlZ2lzdGVyQT0wO2EucmVnaXN0ZXJCPTA7YS5yZWdpc3RlckM9MDthLnJlZ2lzdGVyRD0wO2EucmVnaXN0ZXJFPTA7YS5yZWdpc3Rlckg9MDthLnJlZ2lzdGVyTD0wO2EucmVnaXN0ZXJGPTA7YS5zdGFja1BvaW50ZXI9MDthLnByb2dyYW1Db3VudGVyPTA7YS5jdXJyZW50Q3ljbGVzPTA7YS5pc0hhbHRlZD0hMTthLmlzU3RvcHBlZD0hMTthLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2g9NjUzNTc7YS5zYXZlU3RhdGVTbG90PTA7cmV0dXJuIGF9KCk7MTM5PkRhLnNpemUoKSYmRGEuZ3JvdygxMzktRGEuc2l6ZSgpKTt2YXIgQmE9ITEsUmI9T2JqZWN0LmZyZWV6ZSh7bWVtb3J5OkRhLGNvbmZpZzpmdW5jdGlvbihhLGMsZixoLGwsbixtLHAscSl7Ui5lbmFibGVCb290Um9tPTA8CmE/ITA6ITE7Ui51c2VHYmNXaGVuQXZhaWxhYmxlPTA8Yz8hMDohMTtSLmF1ZGlvQmF0Y2hQcm9jZXNzaW5nPTA8Zj8hMDohMTtSLmdyYXBoaWNzQmF0Y2hQcm9jZXNzaW5nPTA8aD8hMDohMTtSLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz0wPGw/ITA6ITE7Ui5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZz0wPG4/ITA6ITE7Ui5hdWRpb0FjY3VtdWxhdGVTYW1wbGVzPTA8bT8hMDohMTtSLnRpbGVSZW5kZXJpbmc9MDxwPyEwOiExO1IudGlsZUNhY2hpbmc9MDxxPyEwOiExO2E9eSgzMjMpO2IuR0JDRW5hYmxlZD0xOTI9PT1hfHxSLnVzZUdiY1doZW5BdmFpbGFibGUmJjEyOD09PWE/ITA6ITE7Yi5HQkNEb3VibGVTcGVlZD0hMTtiLnJlZ2lzdGVyQT0wO2IucmVnaXN0ZXJCPTA7Yi5yZWdpc3RlckM9MDtiLnJlZ2lzdGVyRD0wO2IucmVnaXN0ZXJFPTA7Yi5yZWdpc3Rlckg9MDtiLnJlZ2lzdGVyTD0wO2IucmVnaXN0ZXJGPTA7Yi5zdGFja1BvaW50ZXI9MDtiLnByb2dyYW1Db3VudGVyPQowO2IuY3VycmVudEN5Y2xlcz0wO2IuaXNIYWx0ZWQ9ITE7Yi5pc1N0b3BwZWQ9ITE7Yi5HQkNFbmFibGVkPyhiLnJlZ2lzdGVyQT0xNyxiLnJlZ2lzdGVyRj0xMjgsYi5yZWdpc3RlckI9MCxiLnJlZ2lzdGVyQz0wLGIucmVnaXN0ZXJEPTI1NSxiLnJlZ2lzdGVyRT04NixiLnJlZ2lzdGVySD0wLGIucmVnaXN0ZXJMPTEzKTooYi5yZWdpc3RlckE9MSxiLnJlZ2lzdGVyRj0xNzYsYi5yZWdpc3RlckI9MCxiLnJlZ2lzdGVyQz0xOSxiLnJlZ2lzdGVyRD0wLGIucmVnaXN0ZXJFPTIxNixiLnJlZ2lzdGVySD0xLGIucmVnaXN0ZXJMPTc3KTtiLnByb2dyYW1Db3VudGVyPTI1NjtiLnN0YWNrUG9pbnRlcj02NTUzNDtkLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE7ZC5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMDthPXkoMzI3KTtkLmlzUm9tT25seT0hMTtkLmlzTUJDMT0hMTtkLmlzTUJDMj0hMTtkLmlzTUJDMz0hMTtkLmlzTUJDNT0hMTswPT09YT9kLmlzUm9tT25seT0hMDoxPD1hJiYzPj1hP2QuaXNNQkMxPQohMDo1PD1hJiY2Pj1hP2QuaXNNQkMyPSEwOjE1PD1hJiYxOT49YT9kLmlzTUJDMz0hMDoyNTw9YSYmMzA+PWEmJihkLmlzTUJDNT0hMCk7ZC5jdXJyZW50Um9tQmFuaz0xO2QuY3VycmVudFJhbUJhbms9MDtrKDY1MzYxLDI1NSk7ayg2NTM2MiwyNTUpO2soNjUzNjMsMjU1KTtrKDY1MzY0LDI1NSk7ayg2NTM2NSwyNTUpO3IuY3VycmVudEN5Y2xlcz0wO3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXI9MDtyLnNjYW5saW5lUmVnaXN0ZXI9MDtyLnNjcm9sbFg9MDtyLnNjcm9sbFk9MDtyLndpbmRvd1g9MDtyLndpbmRvd1k9MDtiLkdCQ0VuYWJsZWQ/KHIuc2NhbmxpbmVSZWdpc3Rlcj0xNDQsayg2NTM0NCwxNDUpLGsoNjUzNDUsMTI5KSxrKDY1MzQ4LDE0NCksayg2NTM1MSwyNTIpKTooci5zY2FubGluZVJlZ2lzdGVyPTE0NCxrKDY1MzQ0LDE0NSksayg2NTM0NSwxMzMpLGsoNjUzNTAsMjU1KSxrKDY1MzUxLDI1Miksayg2NTM1MiwyNTUpLGsoNjUzNTMsMjU1KSk7ayg2NTM1OSwwKTtrKDY1MzkyLAoxKTtiLkdCQ0VuYWJsZWQ/KGsoNjUzODQsMTkyKSxrKDY1Mzg1LDI1NSksayg2NTM4NiwxOTMpLGsoNjUzODcsMTMpKTooayg2NTM4NCwyNTUpLGsoNjUzODUsMjU1KSxrKDY1Mzg2LDI1NSksayg2NTM4NywyNTUpKTtlLmN1cnJlbnRDeWNsZXM9MDtlLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9MDtlLk5SNTBSaWdodE1peGVyVm9sdW1lPTA7ZS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7ZS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7ZS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7ZS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7ZS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDtlLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7ZS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PQohMDtlLk5SNTJJc1NvdW5kRW5hYmxlZD0hMDtlLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9MDtlLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9MDtlLmZyYW1lU2VxdWVuY2VyPTA7ZS5hdWRpb1F1ZXVlSW5kZXg9MDt6LmluaXRpYWxpemUoKTtLLmluaXRpYWxpemUoKTtJLmluaXRpYWxpemUoKTtMLmluaXRpYWxpemUoKTtrKGUubWVtb3J5TG9jYXRpb25OUjUwLDExOSk7ayhlLm1lbW9yeUxvY2F0aW9uTlI1MSwyNDMpO2soZS5tZW1vcnlMb2NhdGlvbk5SNTIsMjQxKTt1LmNoYW5uZWwxU2FtcGxlPTE1O3UuY2hhbm5lbDJTYW1wbGU9MTU7dS5jaGFubmVsM1NhbXBsZT0xNTt1LmNoYW5uZWw0U2FtcGxlPTE1O3UuY2hhbm5lbDFEYWNFbmFibGVkPSExO3UuY2hhbm5lbDJEYWNFbmFibGVkPSExO3UuY2hhbm5lbDNEYWNFbmFibGVkPSExO3UuY2hhbm5lbDREYWNFbmFibGVkPSExO3UubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O3UucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPQoxMjc7dS5taXhlclZvbHVtZUNoYW5nZWQ9ITA7dS5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO3UubmVlZFRvUmVtaXhTYW1wbGVzPSExO2cuY3VycmVudEN5Y2xlcz0wO2cuZGl2aWRlclJlZ2lzdGVyPTA7Zy50aW1lckNvdW50ZXI9MDtnLnRpbWVyTW9kdWxvPTA7Zy50aW1lckVuYWJsZWQ9ITE7Zy50aW1lcklucHV0Q2xvY2s9MDtnLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITE7Zy50aW1lckNvdW50ZXJXYXNSZXNldD0hMTtiLkdCQ0VuYWJsZWQ/KGsoNjUyODQsMzApLGcuZGl2aWRlclJlZ2lzdGVyPTc4NDApOihrKDY1Mjg0LDE3MSksZy5kaXZpZGVyUmVnaXN0ZXI9NDM5ODApO2soNjUyODcsMjQ4KTtnLnRpbWVySW5wdXRDbG9jaz0yNDg7Yi5HQkNFbmFibGVkPyhrKDY1MzkyLDI0OCksayg2NTM1OSwyNTQpLGsoNjUzNTcsMTI2KSxrKDY1MjgwLDIwNyksayg2NTI4MiwxMjQpLGsoNjUyOTUsMjI1KSxrKDY1Mzg4LDI1NCksayg2NTM5NywxNDMpKTooayg2NTM5MiwyNTUpLGsoNjUzNTksCjI1NSksayg2NTM1NywyNTUpLGsoNjUyODAsMjA3KSxrKDY1MjgyLDEyNiksayg2NTI5NSwyMjUpKTtCYT0hMX0sZXhlY3V0ZUZyYW1lOnBiLGV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW86ZnVuY3Rpb24oYSl7dmFyIGM9ITEsZD0xMDI0O2ZvcihhJiYwPGEmJihkPWEpOyFjJiZiLmN1cnJlbnRDeWNsZXM8Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpJiZNYSgpPGQ7KWE9QWEoKSwwPmEmJihjPSEwKTtpZihiLmN1cnJlbnRDeWNsZXM+PWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKSlyZXR1cm4gYi5jdXJyZW50Q3ljbGVzLT1iLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCksMDtpZihNYSgpPj1kKXJldHVybiAxO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlci0xJjY1NTM1O3JldHVybi0xfSxleGVjdXRlRnJhbWVVbnRpbEJyZWFrcG9pbnQ6ZnVuY3Rpb24oYSl7Zm9yKHZhciBjPSExLGQ7IWMmJmIuY3VycmVudEN5Y2xlczxiLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCkmJmIucHJvZ3JhbUNvdW50ZXIhPT0KYTspZD1BYSgpLDA+ZCYmKGM9ITApO2lmKGIuY3VycmVudEN5Y2xlcz49Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpKXJldHVybiBiLmN1cnJlbnRDeWNsZXMtPWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKSwwO2lmKGIucHJvZ3JhbUNvdW50ZXI9PT1hKXJldHVybiAxO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlci0xJjY1NTM1O3JldHVybi0xfSxleGVjdXRlU3RlcDpBYSxzYXZlU3RhdGU6ZnVuY3Rpb24oKXtiLnNhdmVTdGF0ZSgpO3Iuc2F2ZVN0YXRlKCk7bS5zYXZlU3RhdGUoKTtBLnNhdmVTdGF0ZSgpO2Quc2F2ZVN0YXRlKCk7Zy5zYXZlU3RhdGUoKTtlLnNhdmVTdGF0ZSgpO3ouc2F2ZVN0YXRlKCk7Sy5zYXZlU3RhdGUoKTtJLnNhdmVTdGF0ZSgpO0wuc2F2ZVN0YXRlKCk7QmE9ITF9LGxvYWRTdGF0ZTpmdW5jdGlvbigpe2IubG9hZFN0YXRlKCk7ci5sb2FkU3RhdGUoKTttLmxvYWRTdGF0ZSgpO0EubG9hZFN0YXRlKCk7ZC5sb2FkU3RhdGUoKTtnLmxvYWRTdGF0ZSgpOwplLmxvYWRTdGF0ZSgpO3oubG9hZFN0YXRlKCk7Sy5sb2FkU3RhdGUoKTtJLmxvYWRTdGF0ZSgpO0wubG9hZFN0YXRlKCk7QmE9ITF9LGhhc0NvcmVTdGFydGVkOmZ1bmN0aW9uKCl7cmV0dXJuIEJhPzE6MH0sc2V0Sm95cGFkU3RhdGU6ZnVuY3Rpb24oYSxiLGQsZSxoLGssbCxnKXswPGE/cGEoMCk6Y2EoMCwhMSk7MDxiP3BhKDEpOmNhKDEsITEpOzA8ZD9wYSgyKTpjYSgyLCExKTswPGU/cGEoMyk6Y2EoMywhMSk7MDxoP3BhKDQpOmNhKDQsITEpOzA8az9wYSg1KTpjYSg1LCExKTswPGw/cGEoNik6Y2EoNiwhMSk7MDxnP3BhKDcpOmNhKDcsITEpfSxnZXROdW1iZXJPZlNhbXBsZXNJbkF1ZGlvQnVmZmVyOk1hLGNsZWFyQXVkaW9CdWZmZXI6U2EsV0FTTUJPWV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX01FTU9SWV9TSVpFOjkxMDk1MDQsV0FTTUJPWV9XQVNNX1BBR0VTOjEzOSxBU1NFTUJMWVNDUklQVF9NRU1PUllfTE9DQVRJT046MCxBU1NFTUJMWVNDUklQVF9NRU1PUllfU0laRToxMDI0LApXQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OOjEwMjQsV0FTTUJPWV9TVEFURV9TSVpFOjEwMjQsR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MjA0OCxHQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjY1NTM1LFZJREVPX1JBTV9MT0NBVElPTjoyMDQ4LFZJREVPX1JBTV9TSVpFOjE2Mzg0LFdPUktfUkFNX0xPQ0FUSU9OOjE4NDMyLFdPUktfUkFNX1NJWkU6MzI3NjgsT1RIRVJfR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046NTEyMDAsT1RIRVJfR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRToxNjM4NCxHUkFQSElDU19PVVRQVVRfTE9DQVRJT046Njc1ODQsR1JBUEhJQ1NfT1VUUFVUX1NJWkU6NTIxMjE2LEdCQ19QQUxFVFRFX0xPQ0FUSU9OOjY3NTg0LEdCQ19QQUxFVFRFX1NJWkU6NTEyLEJHX1BSSU9SSVRZX01BUF9MT0NBVElPTjo2OTYzMixCR19QUklPUklUWV9NQVBfU0laRToyMzU1MixGUkFNRV9MT0NBVElPTjo5MzE4NCxGUkFNRV9TSVpFOjkzMTg0LApCQUNLR1JPVU5EX01BUF9MT0NBVElPTjoyMzI0NDgsQkFDS0dST1VORF9NQVBfU0laRToxOTY2MDgsVElMRV9EQVRBX0xPQ0FUSU9OOjQyOTA1NixUSUxFX0RBVEFfU0laRToxNDc0NTYsT0FNX1RJTEVTX0xPQ0FUSU9OOjU3NjUxMixPQU1fVElMRVNfU0laRToxMjI4OCxBVURJT19CVUZGRVJfTE9DQVRJT046NTg4ODAwLEFVRElPX0JVRkZFUl9TSVpFOjEzMTA3MixDQVJUUklER0VfUkFNX0xPQ0FUSU9OOjcxOTg3MixDQVJUUklER0VfUkFNX1NJWkU6MTMxMDcyLENBUlRSSURHRV9ST01fTE9DQVRJT046ODUwOTQ0LENBUlRSSURHRV9ST01fU0laRTo4MjU4NTYwLGdldFdhc21Cb3lPZmZzZXRGcm9tR2FtZUJveU9mZnNldDpXYSxnZXRSZWdpc3RlckE6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckF9LGdldFJlZ2lzdGVyQjpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQn0sZ2V0UmVnaXN0ZXJDOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJDfSxnZXRSZWdpc3RlckQ6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckR9LApnZXRSZWdpc3RlckU6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckV9LGdldFJlZ2lzdGVySDpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVySH0sZ2V0UmVnaXN0ZXJMOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJMfSxnZXRSZWdpc3RlckY6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckZ9LGdldFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXJ9LGdldFN0YWNrUG9pbnRlcjpmdW5jdGlvbigpe3JldHVybiBiLnN0YWNrUG9pbnRlcn0sZ2V0T3Bjb2RlQXRQcm9ncmFtQ291bnRlcjpmdW5jdGlvbigpe3JldHVybiB5KGIucHJvZ3JhbUNvdW50ZXIpfSxnZXRMWTpmdW5jdGlvbigpe3JldHVybiByLnNjYW5saW5lUmVnaXN0ZXJ9LGRyYXdCYWNrZ3JvdW5kTWFwVG9XYXNtTWVtb3J5OmZ1bmN0aW9uKGEpe3ZvaWQgMD09PWEmJihhPTApO3ZhciBjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydDtFLmJnV2luZG93VGlsZURhdGFTZWxlY3QmJgooYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCk7dmFyIGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7RS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTtmb3IodmFyIGU9MDsyNTY+ZTtlKyspZm9yKHZhciBrPTA7MjU2Pms7aysrKXt2YXIgbD1lLGc9ayxtPWQrMzIqKGw+PjMpKyhnPj4zKSxwPVgobSwwKTtwPXdhKGMscCk7dmFyIHE9bCU4O2w9ZyU4O2w9Ny1sO2c9MDtiLkdCQ0VuYWJsZWQmJjA8YSYmKGc9WChtLDEpKTtuKDYsZykmJihxPTctcSk7dmFyIHU9MDtuKDMsZykmJih1PTEpO209WChwKzIqcSx1KTtwPVgocCsyKnErMSx1KTtxPTA7bihsLHApJiYocSs9MSxxPDw9MSk7bihsLG0pJiYocSs9MSk7cD0zKigyNTYqZStrKTtpZihiLkdCQ0VuYWJsZWQmJjA8YSlnPUlhKGcmNyxxLCExKSxsPWFhKDAsZyksbT1hYSgxLGcpLHE9YWEoMixnKSxnPTIzMjQ0OCsKcCxoW2ddPWwsaFtnKzFdPW0saFtnKzJdPXE7ZWxzZSBmb3IobD1IYShxLHIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksbT0wOzM+bTttKyspZz0yMzI0NDgrcCttLGhbZ109bH19LGRyYXdUaWxlRGF0YVRvV2FzbU1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzIzPmE7YSsrKWZvcih2YXIgYj0wOzMxPmI7YisrKXt2YXIgZD0wOzE1PGImJihkPTEpO3ZhciBlPWE7MTU8YSYmKGUtPTE1KTtlPDw9NDtlPTE1PGI/ZSsoYi0xNSk6ZStiO3ZhciBoPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0OzE1PGEmJihoPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCk7Zm9yKHZhciBnPTA7OD5nO2crKyljYihlLGgsZCwwLDcsZyw4KmIsOCphK2csMjQ4LDQyOTA1NiwhMCl9fSxnZXRESVY6ZnVuY3Rpb24oKXtyZXR1cm4gZy5kaXZpZGVyUmVnaXN0ZXJ9LGdldFRJTUE6ZnVuY3Rpb24oKXtyZXR1cm4gZy50aW1lckNvdW50ZXJ9LApnZXRUTUE6ZnVuY3Rpb24oKXtyZXR1cm4gZy50aW1lck1vZHVsb30sZ2V0VEFDOmZ1bmN0aW9uKCl7dmFyIGE9Zy50aW1lcklucHV0Q2xvY2s7Zy50aW1lckVuYWJsZWQmJihhfD00KTtyZXR1cm4gYX0sdXBkYXRlOnBiLGVtdWxhdGlvblN0ZXA6QWEsZ2V0QXVkaW9RdWV1ZUluZGV4Ok1hLHJlc2V0QXVkaW9RdWV1ZTpTYSx3YXNtTWVtb3J5U2l6ZTo5MTA5NTA0LHdhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb246MTAyNCx3YXNtQm95SW50ZXJuYWxTdGF0ZVNpemU6MTAyNCxnYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbjoyMDQ4LGdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemU6NjU1MzUsdmlkZW9PdXRwdXRMb2NhdGlvbjo2NzU4NCxmcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uOjkzMTg0LGdhbWVib3lDb2xvclBhbGV0dGVMb2NhdGlvbjo2NzU4NCxnYW1lYm95Q29sb3JQYWxldHRlU2l6ZTo1MTIsYmFja2dyb3VuZE1hcExvY2F0aW9uOjIzMjQ0OCx0aWxlRGF0YU1hcDo0MjkwNTYsCnNvdW5kT3V0cHV0TG9jYXRpb246NTg4ODAwLGdhbWVCeXRlc0xvY2F0aW9uOjg1MDk0NCxnYW1lUmFtQmFua3NMb2NhdGlvbjo3MTk4NzJ9KTtjb25zdCBTYj1hc3luYygpPT4oe2luc3RhbmNlOntleHBvcnRzOlJifSxieXRlTWVtb3J5OkRhLndhc21CeXRlTWVtb3J5LHR5cGU6IlR5cGVTY3JpcHQifSk7bGV0IENhLHNiLHY7dj17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCwKV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxmcmFtZVNraXBDb3VudGVyOjAsY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kczowLG1lc3NhZ2VIYW5kbGVyOihhKT0+e2NvbnN0IGI9dWEoYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIEMuQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPyh2LmdyYXBoaWNzV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sdmEodmIuYmluZCh2b2lkIDAsdiksdi5ncmFwaGljc1dvcmtlclBvcnQpKToKIk1FTU9SWSI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KHYubWVtb3J5V29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sdmEoeWIuYmluZCh2b2lkIDAsdiksdi5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyh2LmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx2YSh4Yi5iaW5kKHZvaWQgMCx2KSx2LmNvbnRyb2xsZXJXb3JrZXJQb3J0KSk6IkFVRElPIj09PWIubWVzc2FnZS53b3JrZXJJZCYmKHYuYXVkaW9Xb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx2YSh3Yi5iaW5kKHZvaWQgMCx2KSx2LmF1ZGlvV29ya2VyUG9ydCkpO1ooTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEMuSU5TVEFOVElBVEVfV0FTTTooYXN5bmMoKT0+e2xldCBhO2E9YXdhaXQgU2IoKTt2Lndhc21JbnN0YW5jZT1hLmluc3RhbmNlO3Yud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O1ooTih7dHlwZTphLnR5cGV9LApiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIEMuQ09ORklHOnYud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KHYsYi5tZXNzYWdlLmNvbmZpZyk7di5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zO1ooTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEMuUkVTRVRfQVVESU9fUVVFVUU6di53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKTtaKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLlBMQVk6aWYoIXYucGF1c2VkfHwhdi53YXNtSW5zdGFuY2V8fCF2Lndhc21CeXRlTWVtb3J5KXtaKE4oe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfXYucGF1c2VkPSExO3YuZnBzVGltZVN0YW1wcz1bXTt2LmZyYW1lU2tpcENvdW50ZXI9MDt2LmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDt0Yih2LDFFMy92Lm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7cWIodik7WihOKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrOwpjYXNlIEMuUEFVU0U6di5wYXVzZWQ9ITA7di51cGRhdGVJZCYmKGNsZWFyVGltZW91dCh2LnVwZGF0ZUlkKSx2LnVwZGF0ZUlkPXZvaWQgMCk7WihOKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5SVU5fV0FTTV9FWFBPUlQ6YT1iLm1lc3NhZ2UucGFyYW1ldGVycz92Lndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdLmFwcGx5KHZvaWQgMCxiLm1lc3NhZ2UucGFyYW1ldGVycyk6di53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XSgpO1ooTih7dHlwZTpDLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBjPXYud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoYz1iLm1lc3NhZ2UuZW5kKTthPXYud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSwKYykuYnVmZmVyO1ooTih7dHlwZTpDLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCksW2FdKTticmVha31jYXNlIEMuR0VUX1dBU01fQ09OU1RBTlQ6WihOKHt0eXBlOkMuR0VUX1dBU01fQ09OU1RBTlQscmVzcG9uc2U6di53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGIpfX0sZ2V0RlBTOigpPT4wPHYudGltZVN0YW1wc1VudGlsUmVhZHk/di5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU6di5mcHNUaW1lU3RhbXBzP3YuZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07dmEodi5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

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

  return exports;

}({}));
//# sourceMappingURL=wasmboy.ts.iife.js.map
