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

  var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIHRhKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gWihhLGIpe0NhP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpOYS5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHVhKGEsYil7YXx8Y29uc29sZS5lcnJvcigid29ya2VyYXBpOiBObyBjYWxsYmFjayB3YXMgcHJvdmlkZWQgdG8gb25NZXNzYWdlISIpO2lmKGIpaWYoQ2EpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoQ2Epc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIE5hLm9uKCJtZXNzYWdlIixhKX1mdW5jdGlvbiBOKGEsYixmKXtifHwoYj1NYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5yZXBsYWNlKC9bXmEtel0rL2csIiIpLnN1YnN0cigyLDEwKSxEYSsrLGI9YCR7Yn0tJHtEYX1gLDFFNTxEYSYmKERhPTApKTtyZXR1cm57d29ya2VySWQ6ZixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWZ1bmN0aW9uIHJiKGEsYil7Yj10YShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgQy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpDLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZnJhbWVJblByb2dyZXNzVmlkZW9PdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSl9fWZ1bmN0aW9uIHNiKGEsYil7Yj10YShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgQy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOkMuR0VUX0NPTlNUQU5UU19ET05FLApXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gdGIoYSxiKXtiPXRhKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBDLlNFVF9KT1lQQURfU1RBVEU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zZXRKb3lwYWRTdGF0ZS5hcHBseShhLGIubWVzc2FnZS5zZXRKb3lwYWRTdGF0ZVBhcmFtc0FzQXJyYXkpfX1mdW5jdGlvbiBXYShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4hMTtsZXQgYj1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN10sZj12b2lkIDA7aWYoMD09PWIpcmV0dXJuITE7MTw9YiYmMz49Yj9mPTMyNzY4OjU8PWImJjY+PWI/Zj0yMDQ4OjE1PD0KYiYmMTk+PWI/Zj0zMjc2ODoyNTw9YiYmMzA+PWImJihmPTEzMTA3Mik7cmV0dXJuIGY/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2YpOiExfWZ1bmN0aW9uIFhhKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gdWIoYSxiKXtiPXRhKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBDLkNMRUFSX01FTU9SWTpmb3IodmFyIGM9MDtjPD1hLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtjKyspYS53YXNtQnl0ZU1lbW9yeVtjXT0wO2M9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSgwKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpDLkNMRUFSX01FTU9SWV9ET05FLAp3YXNtQnl0ZU1lbW9yeTpjLmJ1ZmZlcn0sYi5tZXNzYWdlSWQpLFtjLmJ1ZmZlcl0pO2JyZWFrO2Nhc2UgQy5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7CmEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpDLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKSwKV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLlNFVF9NRU1PUlk6Yz1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2MuaW5jbHVkZXMoRi5DQVJUUklER0VfUk9NKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuQ0FSVFJJREdFX1JPTV0pLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEYuQ0FSVFJJREdFX1JBTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtGLkNBUlRSSURHRV9SQU1dKSxhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04pO2MuaW5jbHVkZXMoRi5HQU1FQk9ZX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtGLkdBTUVCT1lfTUVNT1JZXSksYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTik7Yy5pbmNsdWRlcyhGLlBBTEVUVEVfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuUEFMRVRURV9NRU1PUlldKSwKYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEYuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0YuSU5URVJOQUxfU1RBVEVdKSxhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04pLGEud2FzbUluc3RhbmNlLmV4cG9ydHMubG9hZFN0YXRlKCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOkMuU0VUX01FTU9SWV9ET05FfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5HRVRfTUVNT1JZOntjPXt0eXBlOkMuR0VUX01FTU9SWX07Y29uc3QgZj1bXTt2YXIgdD1iLm1lc3NhZ2UubWVtb3J5VHlwZXM7aWYodC5pbmNsdWRlcyhGLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXt2YXIgeT1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIGQ9dm9pZCAwOzA9PT15P2Q9MzI3Njg6MTw9CnkmJjM+PXk/ZD0yMDk3MTUyOjU8PXkmJjY+PXk/ZD0yNjIxNDQ6MTU8PXkmJjE5Pj15P2Q9MjA5NzE1MjoyNTw9eSYmMzA+PXkmJihkPTgzODg2MDgpO3k9ZD9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK2QpOiExfWVsc2UgeT0hMTt5PXkuYnVmZmVyO2NbRi5DQVJUUklER0VfUk9NXT15O2YucHVzaCh5KX10LmluY2x1ZGVzKEYuQ0FSVFJJREdFX1JBTSkmJih5PVdhKGEpLmJ1ZmZlcixjW0YuQ0FSVFJJREdFX1JBTV09eSxmLnB1c2goeSkpO3QuaW5jbHVkZXMoRi5DQVJUUklER0VfSEVBREVSKSYmKGEud2FzbUJ5dGVNZW1vcnk/KHk9YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzA4LHk9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSh5LHkrMjcpKTp5PSExLHk9eS5idWZmZXIsY1tGLkNBUlRSSURHRV9IRUFERVJdPXksZi5wdXNoKHkpKTt0LmluY2x1ZGVzKEYuR0FNRUJPWV9NRU1PUlkpJiYKKHk9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsY1tGLkdBTUVCT1lfTUVNT1JZXT15LGYucHVzaCh5KSk7dC5pbmNsdWRlcyhGLlBBTEVUVEVfTUVNT1JZKSYmKHk9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXIsY1tGLlBBTEVUVEVfTUVNT1JZXT15LGYucHVzaCh5KSk7dC5pbmNsdWRlcyhGLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCksdD1YYShhKS5idWZmZXIsY1tGLklOVEVSTkFMX1NUQVRFXT10LGYucHVzaCh0KSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oYywKYi5tZXNzYWdlSWQpLGYpfX19ZnVuY3Rpb24gZyhhLGIpe3JldHVybihhJjI1NSk8PDh8YiYyNTV9ZnVuY3Rpb24gSihhKXtyZXR1cm4oYSY2NTI4MCk+Pjh9ZnVuY3Rpb24gTShhLGIpe3JldHVybiBiJn4oMTw8YSl9ZnVuY3Rpb24gcChhLGIpe3JldHVybiAwIT0oYiYxPDxhKX1mdW5jdGlvbiBPYShhKXt2YXIgYj1hO3AoNyxiKSYmKGI9LTEqKDI1Ni1hKSk7cmV0dXJuIGJ9ZnVuY3Rpb24gRWEoYSxjKXthPTE8PGEmMjU1O2IucmVnaXN0ZXJGPTA8Yz9iLnJlZ2lzdGVyRnxhOmIucmVnaXN0ZXJGJigyNTVeYSk7cmV0dXJuIGIucmVnaXN0ZXJGfWZ1bmN0aW9uIGsoYSl7RWEoNyxhKX1mdW5jdGlvbiBxKGEpe0VhKDYsYSl9ZnVuY3Rpb24gRChhKXtFYSg1LGEpfWZ1bmN0aW9uIHcoYSl7RWEoNCxhKX1mdW5jdGlvbiBuYSgpe3JldHVybiBiLnJlZ2lzdGVyRj4+NyYxfWZ1bmN0aW9uIFIoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjQmMX1mdW5jdGlvbiBQKGEsYil7MDw9Yj8wIT09KChhJgoxNSkrKGImMTUpJjE2KT9EKDEpOkQoMCk6KE1hdGguYWJzKGIpJjE1KT4oYSYxNSk/RCgxKTpEKDApfWZ1bmN0aW9uIFBhKGEsYil7MDw9Yj9hPihhK2ImMjU1KT93KDEpOncoMCk6TWF0aC5hYnMoYik+YT93KDEpOncoMCl9ZnVuY3Rpb24gcmEoYSxiLGYpe2Y/KGE9YV5iXmErYiwwIT09KGEmMTYpP0QoMSk6RCgwKSwwIT09KGEmMjU2KT93KDEpOncoMCkpOihmPWErYiY2NTUzNSxmPGE/dygxKTp3KDApLDAhPT0oKGFeYl5mKSY0MDk2KT9EKDEpOkQoMCkpfWZ1bmN0aW9uIEZhKGEsYixmKXt2b2lkIDA9PT1mJiYoZj0hMSk7dmFyIGM9YTtmfHwoYz14KGIpPj4yKmEmMyk7YT0yNDI7c3dpdGNoKGMpe2Nhc2UgMTphPTE2MDticmVhaztjYXNlIDI6YT04ODticmVhaztjYXNlIDM6YT04fXJldHVybiBhfWZ1bmN0aW9uIEdhKGEsYixmKXtiPTgqYSsyKmI7YT1ZYShiKzEsZik7Zj1ZYShiLGYpO3JldHVybiBnKGEsZil9ZnVuY3Rpb24gYWEoYSxiKXtyZXR1cm4gOCooKGImMzE8PDUqYSk+Pgo1KmEpfWZ1bmN0aW9uIFlhKGEsYil7YSY9NjM7YiYmKGErPTY0KTtyZXR1cm4gaFs2NzU4NCthXX1mdW5jdGlvbiBIYShhLGIsZix0KXt2b2lkIDA9PT1mJiYoZj0wKTt2b2lkIDA9PT10JiYodD0hMSk7ZiY9Mzt0JiYoZnw9NCk7aFs2OTYzMisoMTYwKmIrYSldPWZ9ZnVuY3Rpb24gWmEoYSxiLGYsdCx5LGQsbCxlLGssbixnLG0sb2Epe3ZvaWQgMD09PWcmJihnPSExKTt2b2lkIDA9PT1tJiYobT0wKTt2b2lkIDA9PT1vYSYmKG9hPS0xKTt2YXIgYz0wO2I9dmEoYixhKTthPVgoYisyKmQsZik7Zj1YKGIrMipkKzEsZik7Zm9yKGQ9dDtkPD15O2QrKylpZihiPWwrKGQtdCksYjxrKXt2YXIgQj1kO2lmKDA+b2F8fCFwKDUsb2EpKUI9Ny1CO3ZhciBzYT0wO3AoQixmKSYmKHNhKz0xLHNhPDw9MSk7cChCLGEpJiYoc2ErPTEpO2lmKDA8PW9hKXt2YXIgcT1HYShvYSY3LHNhLCExKTtCPWFhKDAscSk7dmFyIHU9YWEoMSxxKTtxPWFhKDIscSl9ZWxzZSAwPj1tJiYobT1yLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLAp1PUI9cT1GYShzYSxtLGcpO3ZhciB4PTMqKGUqaytiKTtoW24reF09QjtoW24reCsxXT11O2hbbit4KzJdPXE7Qj0hMTswPD1vYSYmKEI9cCg3LG9hKSk7SGEoYixlLHNhLEIpO2MrK31yZXR1cm4gY31mdW5jdGlvbiB2YShhLGIpe2lmKGE9PT1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQpe3ZhciBjPWIrMTI4O3AoNyxiKSYmKGM9Yi0xMjgpO3JldHVybiBhKzE2KmN9cmV0dXJuIGErMTYqYn1mdW5jdGlvbiAkYShhLGIpe3N3aXRjaChhKXtjYXNlIDE6cmV0dXJuIHAoYiwxMjkpO2Nhc2UgMjpyZXR1cm4gcChiLDEzNSk7Y2FzZSAzOnJldHVybiBwKGIsMTI2KTtkZWZhdWx0OnJldHVybiBwKGIsMSl9fWZ1bmN0aW9uIGFiKCl7dmFyIGE9YmIoKTsyMDQ3Pj1hJiYwPHouTlJ4MFN3ZWVwU2hpZnQmJih6LnN3ZWVwU2hhZG93RnJlcXVlbmN5PWEsei5zZXRGcmVxdWVuY3koYSksYT1iYigpKTsyMDQ3PGEmJih6LmlzRW5hYmxlZD0hMSl9ZnVuY3Rpb24gYmIoKXt2YXIgYT0Kei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeTthPj49ei5OUngwU3dlZXBTaGlmdDtyZXR1cm4gYT16Lk5SeDBOZWdhdGU/ei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeS1hOnouc3dlZXBTaGFkb3dGcmVxdWVuY3krYX1mdW5jdGlvbiBJYShhKXtzd2l0Y2goYSl7Y2FzZSB6LmNoYW5uZWxOdW1iZXI6aWYodS5jaGFubmVsMURhY0VuYWJsZWQhPT16LmlzRGFjRW5hYmxlZClyZXR1cm4gdS5jaGFubmVsMURhY0VuYWJsZWQ9ei5pc0RhY0VuYWJsZWQsITA7YnJlYWs7Y2FzZSBLLmNoYW5uZWxOdW1iZXI6aWYodS5jaGFubmVsMkRhY0VuYWJsZWQhPT1LLmlzRGFjRW5hYmxlZClyZXR1cm4gdS5jaGFubmVsMkRhY0VuYWJsZWQ9Sy5pc0RhY0VuYWJsZWQsITA7YnJlYWs7Y2FzZSBJLmNoYW5uZWxOdW1iZXI6aWYodS5jaGFubmVsM0RhY0VuYWJsZWQhPT1JLmlzRGFjRW5hYmxlZClyZXR1cm4gdS5jaGFubmVsM0RhY0VuYWJsZWQ9SS5pc0RhY0VuYWJsZWQsITA7YnJlYWs7Y2FzZSBMLmNoYW5uZWxOdW1iZXI6aWYodS5jaGFubmVsNERhY0VuYWJsZWQhPT0KTC5pc0RhY0VuYWJsZWQpcmV0dXJuIHUuY2hhbm5lbDREYWNFbmFibGVkPUwuaXNEYWNFbmFibGVkLCEwfXJldHVybiExfWZ1bmN0aW9uIEphKCl7aWYoIShlLmN1cnJlbnRDeWNsZXM8ZS5iYXRjaFByb2Nlc3NDeWNsZXMoKSkpZm9yKDtlLmN1cnJlbnRDeWNsZXM+PWUuYmF0Y2hQcm9jZXNzQ3ljbGVzKCk7KWNiKGUuYmF0Y2hQcm9jZXNzQ3ljbGVzKCkpLGUuY3VycmVudEN5Y2xlcy09ZS5iYXRjaFByb2Nlc3NDeWNsZXMoKX1mdW5jdGlvbiBjYihhKXtlLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXIrPWE7aWYoZS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPj1lLm1heEZyYW1lU2VxdWVuY2VDeWNsZXMoKSl7ZS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyLT1lLm1heEZyYW1lU2VxdWVuY2VDeWNsZXMoKTtzd2l0Y2goZS5mcmFtZVNlcXVlbmNlcil7Y2FzZSAwOnoudXBkYXRlTGVuZ3RoKCk7Sy51cGRhdGVMZW5ndGgoKTtJLnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7CmJyZWFrO2Nhc2UgMjp6LnVwZGF0ZUxlbmd0aCgpO0sudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO3oudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDQ6ei51cGRhdGVMZW5ndGgoKTtLLnVwZGF0ZUxlbmd0aCgpO0kudXBkYXRlTGVuZ3RoKCk7TC51cGRhdGVMZW5ndGgoKTticmVhaztjYXNlIDY6ei51cGRhdGVMZW5ndGgoKTtLLnVwZGF0ZUxlbmd0aCgpO0kudXBkYXRlTGVuZ3RoKCk7TC51cGRhdGVMZW5ndGgoKTt6LnVwZGF0ZVN3ZWVwKCk7YnJlYWs7Y2FzZSA3OnoudXBkYXRlRW52ZWxvcGUoKSxLLnVwZGF0ZUVudmVsb3BlKCksTC51cGRhdGVFbnZlbG9wZSgpfWUuZnJhbWVTZXF1ZW5jZXIrPTE7ODw9ZS5mcmFtZVNlcXVlbmNlciYmKGUuZnJhbWVTZXF1ZW5jZXI9MCk7dmFyIGI9ITB9ZWxzZSBiPSExO2lmKFMuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcyYmIWIpe2I9ei53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8SWEoei5jaGFubmVsTnVtYmVyKTsKdmFyIGY9Sy53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8SWEoSy5jaGFubmVsTnVtYmVyKSx0PUkud2lsbENoYW5uZWxVcGRhdGUoYSl8fElhKEkuY2hhbm5lbE51bWJlcikseT1MLndpbGxDaGFubmVsVXBkYXRlKGEpfHxJYShMLmNoYW5uZWxOdW1iZXIpO2ImJih1LmNoYW5uZWwxU2FtcGxlPXouZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtmJiYodS5jaGFubmVsMlNhbXBsZT1LLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7dCYmKHUuY2hhbm5lbDNTYW1wbGU9SS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO3kmJih1LmNoYW5uZWw0U2FtcGxlPUwuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtpZihifHxmfHx0fHx5KXUubmVlZFRvUmVtaXhTYW1wbGVzPSEwO2UuZG93blNhbXBsZUN5Y2xlQ291bnRlcis9YSplLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXI7ZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPj1lLm1heERvd25TYW1wbGVDeWNsZXMoKSYmKGUuZG93blNhbXBsZUN5Y2xlQ291bnRlci09CmUubWF4RG93blNhbXBsZUN5Y2xlcygpLCh1Lm5lZWRUb1JlbWl4U2FtcGxlc3x8dS5taXhlclZvbHVtZUNoYW5nZWR8fHUubWl4ZXJFbmFibGVkQ2hhbmdlZCkmJmRiKHUuY2hhbm5lbDFTYW1wbGUsdS5jaGFubmVsMlNhbXBsZSx1LmNoYW5uZWwzU2FtcGxlLHUuY2hhbm5lbDRTYW1wbGUpLGE9dS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGUrMSxiPTU4ODgwMCsyKmUuYXVkaW9RdWV1ZUluZGV4LGhbYl09dS5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZSsxKzEsaFtiKzFdPWErMSxlLmF1ZGlvUXVldWVJbmRleCs9MSxlLmF1ZGlvUXVldWVJbmRleD49ZS53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZS8yLTEmJi0tZS5hdWRpb1F1ZXVlSW5kZXgpfWVsc2UgYj16LmdldFNhbXBsZShhKSxmPUsuZ2V0U2FtcGxlKGEpLHQ9SS5nZXRTYW1wbGUoYSkseT1MLmdldFNhbXBsZShhKSx1LmNoYW5uZWwxU2FtcGxlPWIsdS5jaGFubmVsMlNhbXBsZT1mLHUuY2hhbm5lbDNTYW1wbGU9CnQsdS5jaGFubmVsNFNhbXBsZT15LGUuZG93blNhbXBsZUN5Y2xlQ291bnRlcis9YSplLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXIsZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPj1lLm1heERvd25TYW1wbGVDeWNsZXMoKSYmKGUuZG93blNhbXBsZUN5Y2xlQ291bnRlci09ZS5tYXhEb3duU2FtcGxlQ3ljbGVzKCksYT1kYihiLGYsdCx5KSxiPUooYSksZj01ODg4MDArMiplLmF1ZGlvUXVldWVJbmRleCxoW2ZdPWIrMSsxLGhbZisxXT0oYSYyNTUpKzIsZS5hdWRpb1F1ZXVlSW5kZXgrPTEsZS5hdWRpb1F1ZXVlSW5kZXg+PWUud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemUvMi0xJiYtLWUuYXVkaW9RdWV1ZUluZGV4KX1mdW5jdGlvbiBLYSgpe3JldHVybiBlLmF1ZGlvUXVldWVJbmRleH1mdW5jdGlvbiBRYSgpe2UuYXVkaW9RdWV1ZUluZGV4PTB9ZnVuY3Rpb24gZGIoYSxiLGYsdCl7dm9pZCAwPT09YSYmKGE9MTUpO3ZvaWQgMD09PWImJihiPTE1KTt2b2lkIDA9PT1mJiYoZj0xNSk7CnZvaWQgMD09PXQmJih0PTE1KTt1Lm1peGVyVm9sdW1lQ2hhbmdlZD0hMTt2YXIgYz0wLGQ9MDtjPWUuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0P2MrYTpjKzE1O2M9ZS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ/YytiOmMrMTU7Yz1lLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD9jK2Y6YysxNTtjPWUuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0P2MrdDpjKzE1O2Q9ZS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0P2QrYTpkKzE1O2Q9ZS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0P2QrYjpkKzE1O2Q9ZS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0P2QrZjpkKzE1O2Q9ZS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0P2QrdDpkKzE1O3UubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMTt1Lm5lZWRUb1JlbWl4U2FtcGxlcz0hMTthPWViKGMsZS5OUjUwTGVmdE1peGVyVm9sdW1lKwoxKTtkPWViKGQsZS5OUjUwUmlnaHRNaXhlclZvbHVtZSsxKTt1LmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPWE7dS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9ZDtyZXR1cm4gZyhhLGQpfWZ1bmN0aW9uIGViKGEsYil7aWYoNjA9PT1hKXJldHVybiAxMjc7YT0xRTUqKGEtNjApKmIvODthLz0xRTU7YSs9NjA7YT0xRTUqYS8oMTJFNi8yNTQpO3JldHVybiBhfD0wfWZ1bmN0aW9uIExhKGEpe20ubWFzdGVySW50ZXJydXB0U3dpdGNoPSExO3ZhciBjPXgobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpO2M9TShhLGMpO20uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWM7bChtLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCxjKTtiLnN0YWNrUG9pbnRlci09MjtjPWIuc3RhY2tQb2ludGVyO3ZhciBmPWIucHJvZ3JhbUNvdW50ZXIsdD1KKGYpLGQ9YysxO2woYyxmJjI1NSk7bChkLHQpO3N3aXRjaChhKXtjYXNlIG0uYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ6bS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0KITE7Yi5wcm9ncmFtQ291bnRlcj02NDticmVhaztjYXNlIG0uYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ6bS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTcyO2JyZWFrO2Nhc2UgbS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0Om0uaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTgwO2JyZWFrO2Nhc2UgbS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdDptLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPSExLGIucHJvZ3JhbUNvdW50ZXI9OTZ9fWZ1bmN0aW9uIHdhKGEpe3ZhciBiPXgobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpO2J8PTE8PGE7bS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9YjtsKG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LGIpfWZ1bmN0aW9uIGZiKCl7dmFyIGE9bi5iYXRjaFByb2Nlc3NDeWNsZXMoKTtuLnRpbWVyRW5hYmxlZCYmbi5jdXJyZW50TWF4Q3ljbGVDb3VudDwKYSYmKGE9bi5jdXJyZW50TWF4Q3ljbGVDb3VudCk7aWYoIShuLmN1cnJlbnRDeWNsZXM8YSkpZm9yKDtuLmN1cnJlbnRDeWNsZXM+PWE7KWdiKGEpLG4uY3VycmVudEN5Y2xlcy09YX1mdW5jdGlvbiBnYihhKXtuLmRpdmlkZXJSZWdpc3RlckN5Y2xlQ291bnRlcis9YTtuLmRpdmlkZXJSZWdpc3RlckN5Y2xlQ291bnRlcj49bi5kaXZpZGVyUmVnaXN0ZXJNYXhDeWNsZUNvdW50KCkmJihuLmRpdmlkZXJSZWdpc3RlckN5Y2xlQ291bnRlci09bi5kaXZpZGVyUmVnaXN0ZXJNYXhDeWNsZUNvdW50KCksbi5kaXZpZGVyUmVnaXN0ZXIrPTEsMjU1PG4uZGl2aWRlclJlZ2lzdGVyJiYobi5kaXZpZGVyUmVnaXN0ZXI9MCkpO2lmKG4udGltZXJFbmFibGVkKWZvcihuLmN5Y2xlQ291bnRlcis9YTtuLmN5Y2xlQ291bnRlcj49bi5jdXJyZW50TWF4Q3ljbGVDb3VudDspbi5jeWNsZUNvdW50ZXItPW4uY3VycmVudE1heEN5Y2xlQ291bnQsMjU1PD1uLnRpbWVyQ291bnRlcj8obi50aW1lckNvdW50ZXI9Cm4udGltZXJNb2R1bG8sbS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSEwLHdhKG0uYml0UG9zaXRpb25UaW1lckludGVycnVwdCkpOm4udGltZXJDb3VudGVyKz0xfWZ1bmN0aW9uIHBhKGEpe3ZhciBjPWIuaXNTdG9wcGVkPSExO3ZiKGEpfHwoYz0hMCk7Y2EoYSwhMCk7YyYmKGM9ITEsMz49YSYmKGM9ITApLGE9ITEsQS5pc0RwYWRUeXBlJiZjJiYoYT0hMCksQS5pc0J1dHRvblR5cGUmJiFjJiYoYT0hMCksYSYmKG0uaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsd2EobS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCkpKX1mdW5jdGlvbiB2YihhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiBBLnVwO2Nhc2UgMTpyZXR1cm4gQS5yaWdodDtjYXNlIDI6cmV0dXJuIEEuZG93bjtjYXNlIDM6cmV0dXJuIEEubGVmdDtjYXNlIDQ6cmV0dXJuIEEuYTtjYXNlIDU6cmV0dXJuIEEuYjtjYXNlIDY6cmV0dXJuIEEuc2VsZWN0O2Nhc2UgNzpyZXR1cm4gQS5zdGFydDtkZWZhdWx0OnJldHVybiExfX0KZnVuY3Rpb24gY2EoYSxiKXtzd2l0Y2goYSl7Y2FzZSAwOkEudXA9YjticmVhaztjYXNlIDE6QS5yaWdodD1iO2JyZWFrO2Nhc2UgMjpBLmRvd249YjticmVhaztjYXNlIDM6QS5sZWZ0PWI7YnJlYWs7Y2FzZSA0OkEuYT1iO2JyZWFrO2Nhc2UgNTpBLmI9YjticmVhaztjYXNlIDY6QS5zZWxlY3Q9YjticmVhaztjYXNlIDc6QS5zdGFydD1ifX1mdW5jdGlvbiBoYihhLGMsZil7Zm9yKHZhciB0PTA7dDxmO3QrKyl7Zm9yKHZhciB5PUcoYSt0KSxoPWMrdDs0MDk1OTxoOyloLT04MTkyO08oaCx5KX1hPTMyO2IuR0JDRG91YmxlU3BlZWQmJihhPTY0KTtkLkRNQUN5Y2xlcys9Zi8xNiphfWZ1bmN0aW9uIFJhKGEsYyl7dmFyIGY9ZC52aWRlb1JhbUxvY2F0aW9uLHQ9ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb247aWYoYTxmKXtpZighZC5pc1JvbU9ubHkpaWYoODE5MT49YSl7aWYoIWQuaXNNQkMyfHxwKDQsYykpYyY9MTUsMD09PWM/ZC5pc1JhbUJhbmtpbmdFbmFibGVkPSExOgoxMD09PWMmJihkLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITApfWVsc2UgMTYzODM+PWE/IWQuaXNNQkM1fHwxMjI4Nz49YT8oZC5pc01CQzImJihkLmN1cnJlbnRSb21CYW5rPWMmMTUpLGQuaXNNQkMxPyhjJj0zMSxkLmN1cnJlbnRSb21CYW5rJj0yMjQpOmQuaXNNQkMzPyhjJj0xMjcsZC5jdXJyZW50Um9tQmFuayY9MTI4KTpkLmlzTUJDNSYmKGQuY3VycmVudFJvbUJhbmsmPTApLGQuY3VycmVudFJvbUJhbmt8PWMpOihhPTAsZj1kLmN1cnJlbnRSb21CYW5rJjI1NSwwPGMmJihhPTEpLGQuY3VycmVudFJvbUJhbms9ZyhhLGYpKTohZC5pc01CQzImJjI0NTc1Pj1hP2QuaXNNQkMxJiZkLmlzTUJDMVJvbU1vZGVFbmFibGVkPyhkLmN1cnJlbnRSb21CYW5rJj0zMSxkLmN1cnJlbnRSb21CYW5rfD1jJjIyNCk6KGM9ZC5pc01CQzU/YyYxNTpjJjMsZC5jdXJyZW50UmFtQmFuaz1jKTohZC5pc01CQzImJjMyNzY3Pj1hJiZkLmlzTUJDMSYmKHAoMCxjKT9kLmlzTUJDMVJvbU1vZGVFbmFibGVkPQohMDpkLmlzTUJDMVJvbU1vZGVFbmFibGVkPSExKTtyZXR1cm4hMX1pZihhPj1mJiZhPGQuY2FydHJpZGdlUmFtTG9jYXRpb24pcmV0dXJuITA7aWYoYT49ZC5lY2hvUmFtTG9jYXRpb24mJmE8dClyZXR1cm4gbChhLTgxOTIsYyksITA7aWYoYT49dCYmYTw9ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQpcmV0dXJuIDI+RS5jdXJyZW50TGNkTW9kZT8hMTohMDtpZihhPj1kLnVudXNhYmxlTWVtb3J5TG9jYXRpb24mJmE8PWQudW51c2FibGVNZW1vcnlFbmRMb2NhdGlvbilyZXR1cm4hMTtpZig2NTI5Njw9YSYmNjUzMTg+PWEpe0phKCk7aWYoYT09PWUubWVtb3J5TG9jYXRpb25OUjUyfHxlLk5SNTJJc1NvdW5kRW5hYmxlZCl7c3dpdGNoKGEpe2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDA6ei51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDA6SS51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDE6ei51cGRhdGVOUngxKGMpOwpicmVhaztjYXNlIEsubWVtb3J5TG9jYXRpb25OUngxOksudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIEkubWVtb3J5TG9jYXRpb25OUngxOkkudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUngxOkwudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIHoubWVtb3J5TG9jYXRpb25OUngyOnoudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEsubWVtb3J5TG9jYXRpb25OUngyOksudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEkubWVtb3J5TG9jYXRpb25OUngyOkkudm9sdW1lQ29kZUNoYW5nZWQ9ITA7SS51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDI6TC51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDM6ei51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgSy5tZW1vcnlMb2NhdGlvbk5SeDM6Sy51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDM6SS51cGRhdGVOUngzKGMpOwpicmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUngzOkwudXBkYXRlTlJ4MyhjKTticmVhaztjYXNlIHoubWVtb3J5TG9jYXRpb25OUng0OnAoNyxjKSYmKHoudXBkYXRlTlJ4NChjKSx6LnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBLLm1lbW9yeUxvY2F0aW9uTlJ4NDpwKDcsYykmJihLLnVwZGF0ZU5SeDQoYyksSy50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDQ6cCg3LGMpJiYoSS51cGRhdGVOUng0KGMpLEkudHJpZ2dlcigpKTticmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUng0OnAoNyxjKSYmKEwudXBkYXRlTlJ4NChjKSxMLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBlLm1lbW9yeUxvY2F0aW9uTlI1MDplLnVwZGF0ZU5SNTAoYyk7dS5taXhlclZvbHVtZUNoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBlLm1lbW9yeUxvY2F0aW9uTlI1MTplLnVwZGF0ZU5SNTEoYyk7dS5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO2JyZWFrO2Nhc2UgZS5tZW1vcnlMb2NhdGlvbk5SNTI6aWYoZS51cGRhdGVOUjUyKGMpLAohcCg3LGMpKWZvcihjPTY1Mjk2OzY1MzE4PmM7YysrKWwoYywwKX1jPSEwfWVsc2UgYz0hMTtyZXR1cm4gY302NTMyODw9YSYmNjUzNDM+PWEmJkphKCk7aWYoYT49RS5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wmJmE8PXIubWVtb3J5TG9jYXRpb25XaW5kb3dYKXtpZihhPT09RS5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wpcmV0dXJuIEUudXBkYXRlTGNkQ29udHJvbChjKSwhMDtpZihhPT09ci5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpcmV0dXJuIHIuc2NhbmxpbmVSZWdpc3Rlcj0wLGwoYSwwKSwhMTtpZihhPT09RS5tZW1vcnlMb2NhdGlvbkNvaW5jaWRlbmNlQ29tcGFyZSlyZXR1cm4gRS5jb2luY2lkZW5jZUNvbXBhcmU9YywhMDtpZihhPT09ci5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyKXtjPDw9ODtmb3IoYT0wOzE1OT49YTthKyspZj14KGMrYSksbChkLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbithLGYpO2QuRE1BQ3ljbGVzPTY0NDtyZXR1cm4hMH1zd2l0Y2goYSl7Y2FzZSByLm1lbW9yeUxvY2F0aW9uU2Nyb2xsWDpyLnNjcm9sbFg9CmM7YnJlYWs7Y2FzZSByLm1lbW9yeUxvY2F0aW9uU2Nyb2xsWTpyLnNjcm9sbFk9YzticmVhaztjYXNlIHIubWVtb3J5TG9jYXRpb25XaW5kb3dYOnIud2luZG93WD1jO2JyZWFrO2Nhc2Ugci5tZW1vcnlMb2NhdGlvbldpbmRvd1k6ci53aW5kb3dZPWN9cmV0dXJuITB9aWYoYT09PWQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcilyZXR1cm4gYi5HQkNFbmFibGVkJiYoZC5pc0hibGFua0hkbWFBY3RpdmUmJiFwKDcsYyk/KGQuaXNIYmxhbmtIZG1hQWN0aXZlPSExLGM9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpLGwoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLGN8MTI4KSk6KGE9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUhpZ2gpLGY9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdyksYT1nKGEsZikmNjU1MjAsZj14KGQubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25IaWdoKSx0PXgoZC5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkxvdyksCmY9ZyhmLHQpLGY9KGYmODE3NikrZC52aWRlb1JhbUxvY2F0aW9uLHQ9TSg3LGMpLHQ9MTYqKHQrMSkscCg3LGMpPyhkLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMCxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz10LGQuaGJsYW5rSGRtYVNvdXJjZT1hLGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uPWYsbChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsTSg3LGMpKSk6KGhiKGEsZix0KSxsKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlciwyNTUpKSkpLCExO2lmKChhPT09ZC5tZW1vcnlMb2NhdGlvbkdCQ1dSQU1CYW5rfHxhPT09ZC5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rKSYmZC5pc0hibGFua0hkbWFBY3RpdmUmJigxNjM4NDw9ZC5oYmxhbmtIZG1hU291cmNlJiYzMjc2Nz49ZC5oYmxhbmtIZG1hU291cmNlfHw1MzI0ODw9ZC5oYmxhbmtIZG1hU291cmNlJiY1NzM0Mz49ZC5oYmxhbmtIZG1hU291cmNlKSlyZXR1cm4hMTtpZihhPj14YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXgmJgphPD14YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhKXtpZihhPT09eGEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZURhdGF8fGE9PT14YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhKXtmPXgoYS0xKTtmPU0oNixmKTt0PSExO2E9PT14YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhJiYodD0hMCk7dmFyIHk9ZiY2Mzt0JiYoeSs9NjQpO2hbNjc1ODQreV09YztjPWY7LS1hO3AoNyxjKSYmbChhLGMrMXwxMjgpfXJldHVybiEwfWlmKGE+PW4ubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXImJmE8PW4ubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2wpe2ZiKCk7c3dpdGNoKGEpe2Nhc2Ugbi5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlcjpyZXR1cm4gbi51cGRhdGVEaXZpZGVyUmVnaXN0ZXIoYyksITE7Y2FzZSBuLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyOm4udXBkYXRlVGltZXJDb3VudGVyKGMpO2JyZWFrO2Nhc2Ugbi5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvOm4udXBkYXRlVGltZXJNb2R1bG8oYyk7CmJyZWFrO2Nhc2Ugbi5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbDpuLnVwZGF0ZVRpbWVyQ29udHJvbChjKX1yZXR1cm4hMH1hPT09QS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyJiZBLnVwZGF0ZUpveXBhZChjKTtpZihhPT09bS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpcmV0dXJuIG0udXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKGMpLCEwO2E9PT1tLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZCYmbS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKGMpO3JldHVybiEwfWZ1bmN0aW9uIFNhKGEpe3N3aXRjaChhPj4xMil7Y2FzZSAwOmNhc2UgMTpjYXNlIDI6Y2FzZSAzOnJldHVybiBhKzg1MDk0NDtjYXNlIDQ6Y2FzZSA1OmNhc2UgNjpjYXNlIDc6dmFyIGM9ZC5jdXJyZW50Um9tQmFuaztkLmlzTUJDNXx8MCE9PWN8fChjPTEpO3JldHVybiAxNjM4NCpjKyhhLWQuc3dpdGNoYWJsZUNhcnRyaWRnZVJvbUxvY2F0aW9uKSs4NTA5NDQ7Y2FzZSA4OmNhc2UgOTpyZXR1cm4gYz0KMCxiLkdCQ0VuYWJsZWQmJihjPXgoZC5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rKSYxKSxhLWQudmlkZW9SYW1Mb2NhdGlvbisyMDQ4KzgxOTIqYztjYXNlIDEwOmNhc2UgMTE6cmV0dXJuIDgxOTIqZC5jdXJyZW50UmFtQmFuaysoYS1kLmNhcnRyaWRnZVJhbUxvY2F0aW9uKSs3MTk4NzI7Y2FzZSAxMjpyZXR1cm4gYS1kLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbisxODQzMjtjYXNlIDEzOnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz14KGQubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaykmNyksMT5jJiYoYz0xKSxhLWQuaW50ZXJuYWxSYW1CYW5rWmVyb0xvY2F0aW9uKzE4NDMyKzQwOTYqKGMtMSk7ZGVmYXVsdDpyZXR1cm4gYS1kLmVjaG9SYW1Mb2NhdGlvbis1MTIwMH19ZnVuY3Rpb24gbChhLGIpe2E9U2EoYSk7aFthXT1ifWZ1bmN0aW9uIE8oYSxiKXtSYShhLGIpJiZsKGEsYil9ZnVuY3Rpb24gVChhLGIpe3ZhciBjPUooYik7YiY9MjU1O3ZhciB0PWErMTtSYShhLApiKSYmbChhLGIpO1JhKHQsYykmJmwodCxjKX1mdW5jdGlvbiBVKGEsYil7aFthXT1iPzE6MH1mdW5jdGlvbiBpYihhLGMsZix0LGQsbCl7Zm9yKHZhciB5PXQ+PjM7MTYwPmQ7ZCsrKXt2YXIgZT1kK2w7MjU2PD1lJiYoZS09MjU2KTt2YXIgaz1mKzMyKnkrKGU+PjMpLG49WChrLDApLGc9ITE7aWYoUy50aWxlQ2FjaGluZyl7dmFyIG09ZDt2YXIgQj1hLHE9ZSx1PWssdz1uLHY9MDtpZigwPEImJjg8bSYmdz09PWRhLnRpbGVJZCYmbT09PWRhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrKXt2YXIgej13PSExO3AoNSx4KHUtMSkpJiYodz0hMCk7cCg1LHgodSkpJiYoej0hMCk7Zm9yKHU9MDs4PnU7dSsrKWlmKHchPT16JiYodT03LXUpLDE2MD49bSt1KXtmb3IodmFyIEE9bS0oOC11KSxEPTkzMTg0KzMqKDE2MCpCKyhtK3UpKSxDPTA7Mz5DO0MrKylZKG0rdSxCLEMsaFtEK0NdKTtBPWhbNjk2MzIrKDE2MCpCK0EpXTtIYShtK3UsQixNKDIsQSkscCgyLEEpKTt2Kyt9fWVsc2UgZGEudGlsZUlkPQp3O20+PWRhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrJiYoZGEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9bSs4LEI9cSU4LG08QiYmKGRhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrKz1CKSk7bT12OzA8bSYmKGQrPW0tMSxnPSEwKX1TLnRpbGVSZW5kZXJpbmcmJiFnPyhnPWQsbT1hLHY9YyxCPXQlOCxxPTAsMD09ZyYmKHE9ZS1lLzgqOCksZT03LDE2MDxnKzgmJihlPTE2MC1nKSx3PS0xLHo9MCxiLkdCQ0VuYWJsZWQmJih3PVgoaywxKSxwKDMsdykmJih6PTEpLHAoNix3KSYmKEI9Ny1CKSksbT1aYShuLHYseixxLGUsQixnLG0sMTYwLDkzMTg0LCExLDAsdyksMDxtJiYoZCs9bS0xKSk6Z3x8KGIuR0JDRW5hYmxlZD8oZz1kLG09YSxCPXQsdj12YShjLG4pLGs9WChrLDEpLEIlPTgscCg2LGspJiYoQj03LUIpLHE9MCxwKDMsaykmJihxPTEpLG49WCh2KzIqQixxKSx2PVgodisyKkIrMSxxKSxCPWUlOCxwKDUsayl8fChCPTctQiksZT0wLHAoQix2KSYmCihlPWUrMTw8MSkscChCLG4pJiYoZSs9MSksQj1HYShrJjcsZSwhMSksbj1hYSgwLEIpLHY9YWEoMSxCKSxCPWFhKDIsQiksWShnLG0sMCxuKSxZKGcsbSwxLHYpLFkoZyxtLDIsQiksSGEoZyxtLGUscCg3LGspKSk6KGs9ZCxnPWEsdj10LG09dmEoYyxuKSx2JT04LG49WChtKzIqdiwwKSxtPVgobSsyKnYrMSwwKSx2PTctZSU4LGU9MCxwKHYsbSkmJihlPWUrMTw8MSkscCh2LG4pJiYoZSs9MSksbj1GYShlLHIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksWShrLGcsMCxuKSxZKGssZywxLG4pLFkoayxnLDIsbiksSGEoayxnLGUpKSl9fWZ1bmN0aW9uIGpiKGEpe2lmKEUuZW5hYmxlZCYmKHIuc2NhbmxpbmVDeWNsZUNvdW50ZXIrPWEsci5zY2FubGluZUN5Y2xlQ291bnRlcj49ci5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORSgpKSl7ci5zY2FubGluZUN5Y2xlQ291bnRlci09ci5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORSgpO2E9ci5zY2FubGluZVJlZ2lzdGVyO2lmKDE0ND09PQphKXtpZihTLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nKWZvcih2YXIgYj0wOzE0ND49YjtiKyspVGEoYik7ZWxzZSBUYShhKTtmb3IoYj0wOzE0ND5iO2IrKylmb3IodmFyIGY9MDsxNjA+ZjtmKyspaFs2OTYzMisoMTYwKmIrZildPTA7ZGEudGlsZUlkPS0xO2RhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrPS0xfWVsc2UgMTQ0PmEmJihTLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nfHxUYShhKSk7ci5zY2FubGluZVJlZ2lzdGVyPTE1MzxhPzA6YSsxfWlmKEUuZW5hYmxlZCl7aWYoYT1yLnNjYW5saW5lUmVnaXN0ZXIsZj1FLmN1cnJlbnRMY2RNb2RlLGI9MCwxNDQ8PWE/Yj0xOnIuc2NhbmxpbmVDeWNsZUNvdW50ZXI+PXIuTUlOX0NZQ0xFU19TUFJJVEVTX0xDRF9NT0RFKCk/Yj0yOnIuc2NhbmxpbmVDeWNsZUNvdW50ZXI+PXIuTUlOX0NZQ0xFU19UUkFOU0ZFUl9EQVRBX0xDRF9NT0RFKCkmJihiPTMpLGYhPT1iKXtmPXgoRS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyk7CkUuY3VycmVudExjZE1vZGU9Yjt2YXIgdD0hMTtzd2l0Y2goYil7Y2FzZSAwOmY9TSgwLGYpO2Y9TSgxLGYpO3Q9cCgzLGYpO2JyZWFrO2Nhc2UgMTpmPU0oMSxmKTtmfD0xO3Q9cCg0LGYpO2JyZWFrO2Nhc2UgMjpmPU0oMCxmKTtmfD0yO3Q9cCg1LGYpO2JyZWFrO2Nhc2UgMzpmfD0zfXQmJihtLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSEwLHdhKG0uYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpKTswPT09YiYmZC5pc0hibGFua0hkbWFBY3RpdmUmJih0PTE2LGQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPHQmJih0PWQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nKSxoYihkLmhibGFua0hkbWFTb3VyY2UsZC5oYmxhbmtIZG1hRGVzdGluYXRpb24sdCksZC5oYmxhbmtIZG1hU291cmNlKz10LGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uKz10LGQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nLT10LDA+PWQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPwooZC5pc0hibGFua0hkbWFBY3RpdmU9ITEsbChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMjU1KSk6bChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsTSg3LGQuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nLzE2LTEpKSk7MT09PWImJihtLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPSEwLHdhKG0uYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQpKTt0PUUuY29pbmNpZGVuY2VDb21wYXJlOzAhPT1iJiYxIT09Ynx8YSE9PXQ/Zj1NKDIsZik6KGZ8PTQscCg2LGYpJiYobS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMCx3YShtLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSkpO2woRS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxmKX19ZWxzZSByLnNjYW5saW5lQ3ljbGVDb3VudGVyPTAsci5zY2FubGluZVJlZ2lzdGVyPTAsbChyLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlciwwKSxmPXgoRS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyksZj1NKDEsZiksCmY9TSgwLGYpLEUuY3VycmVudExjZE1vZGU9MCxsKEUubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsZil9ZnVuY3Rpb24gVGEoYSl7dmFyIGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0O0UuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdCYmKGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQpO2lmKGIuR0JDRW5hYmxlZHx8RS5iZ0Rpc3BsYXlFbmFibGVkKXt2YXIgZj1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDtFLmJnVGlsZU1hcERpc3BsYXlTZWxlY3QmJihmPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpO3ZhciB0PXIuc2Nyb2xsWCxkPWErci5zY3JvbGxZOzI1Njw9ZCYmKGQtPTI1Nik7aWIoYSxjLGYsZCwwLHQpfUUud2luZG93RGlzcGxheUVuYWJsZWQmJihmPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0LEUud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3QmJihmPQpyLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KSx0PXIud2luZG93WCxkPXIud2luZG93WSxhPGR8fCh0LT03LGliKGEsYyxmLGEtZCx0LC0xKnQpKSk7aWYoRS5zcHJpdGVEaXNwbGF5RW5hYmxlKWZvcihjPUUudGFsbFNwcml0ZVNpemUsZj0zOTswPD1mO2YtLSl7ZD00KmY7dmFyIGU9eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QpO3Q9eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QrMSk7dmFyIGw9eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QrMik7ZS09MTY7dC09ODt2YXIgaz04O2MmJihrPTE2LDE9PT1sJTImJi0tbCk7aWYoYT49ZSYmYTxlK2spe2Q9eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QrMyk7dmFyIG09cCg3LGQpLGc9cCg2LGQpLG49cCg1LGQpO2U9YS1lO2cmJihlLT1rLGUqPS0xLC0tZSk7ZSo9MjtsPXZhKHIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0LApsKTtrPWwrPWU7ZT0wO2IuR0JDRW5hYmxlZCYmcCgzLGQpJiYoZT0xKTtsPVgoayxlKTtrPVgoaysxLGUpO2ZvcihlPTc7MDw9ZTtlLS0pe2c9ZTtuJiYoZy09NyxnKj0tMSk7dmFyIHE9MDtwKGcsaykmJihxKz0xLHE8PD0xKTtwKGcsbCkmJihxKz0xKTtpZigwIT09cSYmKGc9dCsoNy1lKSwwPD1nJiYxNjA+PWcpKXt2YXIgdT0hMSx2PSExLHc9ITE7Yi5HQkNFbmFibGVkJiYhRS5iZ0Rpc3BsYXlFbmFibGVkJiYodT0hMCk7aWYoIXUpe3ZhciB6PWhbNjk2MzIrKDE2MCphK2cpXSxBPXomMzttJiYwPEE/dj0hMDpiLkdCQ0VuYWJsZWQmJnAoMix6KSYmMDxBJiYodz0hMCl9aWYodXx8IXYmJiF3KWIuR0JDRW5hYmxlZD8odj1HYShkJjcscSwhMCkscT1hYSgwLHYpLHU9YWEoMSx2KSx2PWFhKDIsdiksWShnLGEsMCxxKSxZKGcsYSwxLHUpLFkoZyxhLDIsdikpOih1PXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lLHAoNCxkKSYmKHU9ci5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVUd28pLApxPUZhKHEsdSksWShnLGEsMCxxKSxZKGcsYSwxLHEpLFkoZyxhLDIscSkpfX19fX1mdW5jdGlvbiBZKGEsYixmLGQpe2hbOTMxODQrMyooMTYwKmIrYSkrZl09ZH1mdW5jdGlvbiBYKGEsYil7cmV0dXJuIGhbYS1kLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKihiJjEpXX1mdW5jdGlvbiBVYShhKXt2YXIgYj1kLnZpZGVvUmFtTG9jYXRpb247cmV0dXJuIGE8Ynx8YT49YiYmYTxkLmNhcnRyaWRnZVJhbUxvY2F0aW9uPy0xOmE+PWQuZWNob1JhbUxvY2F0aW9uJiZhPGQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uP3goYS04MTkyKTphPj1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbiYmYTw9ZC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQ/Mj5FLmN1cnJlbnRMY2RNb2RlPzI1NTotMTphPT09ci5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXI/KGwoYSxyLnNjYW5saW5lUmVnaXN0ZXIpLHIuc2NhbmxpbmVSZWdpc3Rlcik6NjUyOTY8PWEmJgo2NTMxOD49YT8oSmEoKSxhPWE9PT1lLm1lbW9yeUxvY2F0aW9uTlI1Mj94KGUubWVtb3J5TG9jYXRpb25OUjUyKSYxMjh8MTEyOi0xLGEpOjY1MzI4PD1hJiY2NTM0Mz49YT8oSmEoKSwtMSk6YT09PW4ubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXI/KGwoYSxuLmRpdmlkZXJSZWdpc3Rlciksbi5kaXZpZGVyUmVnaXN0ZXIpOmE9PT1uLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyPyhsKGEsbi50aW1lckNvdW50ZXIpLG4udGltZXJDb3VudGVyKTphPT09QS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyPyhhPUEuam95cGFkUmVnaXN0ZXJGbGlwcGVkLEEuaXNEcGFkVHlwZT8oYT1BLnVwP00oMixhKTphfDQsYT1BLnJpZ2h0P00oMCxhKTphfDEsYT1BLmRvd24/TSgzLGEpOmF8OCxhPUEubGVmdD9NKDEsYSk6YXwyKTpBLmlzQnV0dG9uVHlwZSYmKGE9QS5hP00oMCxhKTphfDEsYT1BLmI/TSgxLGEpOmF8MixhPUEuc2VsZWN0P00oMixhKTphfDQsYT1BLnN0YXJ0P00oMywKYSk6YXw4KSxhfDI0MCk6LTF9ZnVuY3Rpb24geChhKXtyZXR1cm4gaFtTYShhKV19ZnVuY3Rpb24gRyhhKXt2YXIgYj1VYShhKTtzd2l0Y2goYil7Y2FzZSAtMTpyZXR1cm4geChhKTtkZWZhdWx0OnJldHVybiBifX1mdW5jdGlvbiBiYShhKXt2YXIgYj1VYShhKTtzd2l0Y2goYil7Y2FzZSAtMTpiPXgoYSl9YSs9MTt2YXIgZj1VYShhKTtzd2l0Y2goZil7Y2FzZSAtMTphPXgoYSk7YnJlYWs7ZGVmYXVsdDphPWZ9cmV0dXJuIGcoYSxiKX1mdW5jdGlvbiBWKGEpe3JldHVybiAwPGhbYV0/ITA6ITF9ZnVuY3Rpb24gZWEoYSl7UChiLnJlZ2lzdGVyQSxhKTtQYShiLnJlZ2lzdGVyQSxhKTtiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQSthJjI1NTswPT09Yi5yZWdpc3RlckE/aygxKTprKDApO3EoMCl9ZnVuY3Rpb24gZmEoYSl7dmFyIGM9Yi5yZWdpc3RlckErYStSKCkmMjU1OzAhPSgoYi5yZWdpc3RlckFeYV5jKSYxNik/RCgxKTpEKDApOzA8KGIucmVnaXN0ZXJBK2ErUigpJjI1Nik/dygxKToKdygwKTtiLnJlZ2lzdGVyQT1jOzA9PT1iLnJlZ2lzdGVyQT9rKDEpOmsoMCk7cSgwKX1mdW5jdGlvbiBoYShhKXt2YXIgYz0tMSphO1AoYi5yZWdpc3RlckEsYyk7UGEoYi5yZWdpc3RlckEsYyk7Yi5yZWdpc3RlckE9Yi5yZWdpc3RlckEtYSYyNTU7MD09PWIucmVnaXN0ZXJBP2soMSk6aygwKTtxKDEpfWZ1bmN0aW9uIGlhKGEpe3ZhciBjPWIucmVnaXN0ZXJBLWEtUigpJjI1NTswIT0oKGIucmVnaXN0ZXJBXmFeYykmMTYpP0QoMSk6RCgwKTswPChiLnJlZ2lzdGVyQS1hLVIoKSYyNTYpP3coMSk6dygwKTtiLnJlZ2lzdGVyQT1jOzA9PT1iLnJlZ2lzdGVyQT9rKDEpOmsoMCk7cSgxKX1mdW5jdGlvbiBqYShhKXtiLnJlZ2lzdGVyQSY9YTswPT09Yi5yZWdpc3RlckE/aygxKTprKDApO3EoMCk7RCgxKTt3KDApfWZ1bmN0aW9uIGthKGEpe2IucmVnaXN0ZXJBPShiLnJlZ2lzdGVyQV5hKSYyNTU7MD09PWIucmVnaXN0ZXJBP2soMSk6aygwKTtxKDApO0QoMCk7dygwKX1mdW5jdGlvbiBsYShhKXtiLnJlZ2lzdGVyQXw9CmE7MD09PWIucmVnaXN0ZXJBP2soMSk6aygwKTtxKDApO0QoMCk7dygwKX1mdW5jdGlvbiBtYShhKXthKj0tMTtQKGIucmVnaXN0ZXJBLGEpO1BhKGIucmVnaXN0ZXJBLGEpOzA9PT1iLnJlZ2lzdGVyQSthP2soMSk6aygwKTtxKDEpfWZ1bmN0aW9uIHFhKGEsYil7MD09PShiJjE8PGEpP2soMSk6aygwKTtxKDApO0QoMSk7cmV0dXJuIGJ9ZnVuY3Rpb24gVyhhLGIsZil7cmV0dXJuIDA8Yj9mfDE8PGE6ZiZ+KDE8PGEpfWZ1bmN0aW9uIHlhKGEpe2E9T2EoYSk7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyK2EmNjU1MzU7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzV9ZnVuY3Rpb24ga2IoYSl7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7c3dpdGNoKChhJjI0MCk+PjQpe2Nhc2UgMDpyZXR1cm4gd2IoYSk7Y2FzZSAxOnJldHVybiB4YihhKTtjYXNlIDI6cmV0dXJuIHliKGEpO2Nhc2UgMzpyZXR1cm4gemIoYSk7Y2FzZSA0OnJldHVybiBBYihhKTsKY2FzZSA1OnJldHVybiBCYihhKTtjYXNlIDY6cmV0dXJuIENiKGEpO2Nhc2UgNzpyZXR1cm4gRGIoYSk7Y2FzZSA4OnJldHVybiBFYihhKTtjYXNlIDk6cmV0dXJuIEZiKGEpO2Nhc2UgMTA6cmV0dXJuIEdiKGEpO2Nhc2UgMTE6cmV0dXJuIEhiKGEpO2Nhc2UgMTI6cmV0dXJuIEliKGEpO2Nhc2UgMTM6cmV0dXJuIEpiKGEpO2Nhc2UgMTQ6cmV0dXJuIEtiKGEpO2RlZmF1bHQ6cmV0dXJuIExiKGEpfX1mdW5jdGlvbiBIKCl7cmV0dXJuIHgoYi5wcm9ncmFtQ291bnRlcil9ZnVuY3Rpb24gUSgpe3JldHVybiBnKHgoYi5wcm9ncmFtQ291bnRlcisxJjY1NTM1KSxIKCkpfWZ1bmN0aW9uIHdiKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIDQ7Y2FzZSAxOnJldHVybiBiLnJlZ2lzdGVyQj1KKFEoKSksYi5yZWdpc3RlckM9USgpJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSwxMjtjYXNlIDI6cmV0dXJuIE8oZyhiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksCmIucmVnaXN0ZXJBKSw4O2Nhc2UgMzpyZXR1cm4gYT1nKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxhKyssYi5yZWdpc3RlckI9SihhKSxiLnJlZ2lzdGVyQz1hJjI1NSw4O2Nhc2UgNDpyZXR1cm4gUChiLnJlZ2lzdGVyQiwxKSxiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQisxJjI1NSwwPT09Yi5yZWdpc3RlckI/aygxKTprKDApLHEoMCksNDtjYXNlIDU6cmV0dXJuIFAoYi5yZWdpc3RlckIsLTEpLGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJCLTEmMjU1LDA9PT1iLnJlZ2lzdGVyQj9rKDEpOmsoMCkscSgxKSw0O2Nhc2UgNjpyZXR1cm4gYi5yZWdpc3RlckI9SCgpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSA3OjEyOD09PShiLnJlZ2lzdGVyQSYxMjgpP3coMSk6dygwKTthPWI7dmFyIGM9Yi5yZWdpc3RlckE7YS5yZWdpc3RlckE9KGM8PDF8Yz4+NykmMjU1O2soMCk7cSgwKTtEKDApO3JldHVybiA0O2Nhc2UgODpyZXR1cm4gVChRKCksYi5zdGFja1BvaW50ZXIpLApiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSwyMDtjYXNlIDk6cmV0dXJuIGE9ZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYz1nKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxyYShhLGMsITEpLGE9YStjJjY1NTM1LGIucmVnaXN0ZXJIPUooYSksYi5yZWdpc3Rlckw9YSYyNTUscSgwKSw4O2Nhc2UgMTA6cmV0dXJuIGIucmVnaXN0ZXJBPUcoZyhiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDg7Y2FzZSAxMTpyZXR1cm4gYT1nKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyQj1KKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSAxMjpyZXR1cm4gUChiLnJlZ2lzdGVyQywxKSxiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQysxJjI1NSwwPT09Yi5yZWdpc3RlckM/aygxKTprKDApLHEoMCksNDtjYXNlIDEzOnJldHVybiBQKGIucmVnaXN0ZXJDLC0xKSxiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQy0xJjI1NSwwPT09Yi5yZWdpc3RlckM/CmsoMSk6aygwKSxxKDEpLDQ7Y2FzZSAxNDpyZXR1cm4gYi5yZWdpc3RlckM9SCgpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAxNTpyZXR1cm4gMDwoYi5yZWdpc3RlckEmMSk/dygxKTp3KDApLGE9YixjPWIucmVnaXN0ZXJBLGEucmVnaXN0ZXJBPShjPj4xfGM8PDcpJjI1NSxrKDApLHEoMCksRCgwKSw0fXJldHVybi0xfWZ1bmN0aW9uIHhiKGEpe3N3aXRjaChhKXtjYXNlIDE2OmlmKGIuR0JDRW5hYmxlZCYmKGE9RyhiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLHAoMCxhKSkpcmV0dXJuIGE9TSgwLGEpLHAoNyxhKT8oYi5HQkNEb3VibGVTcGVlZD0hMSxhPU0oNyxhKSk6KGIuR0JDRG91YmxlU3BlZWQ9ITAsYXw9MTI4KSxPKGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCxhKSw3NjtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtyZXR1cm4gNDtjYXNlIDE3OnJldHVybiBiLnJlZ2lzdGVyRD1KKFEoKSksCmIucmVnaXN0ZXJFPVEoKSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsMTI7Y2FzZSAxODpyZXR1cm4gTyhnKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQSksODtjYXNlIDE5OnJldHVybiBhPWcoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJEPUooYSksYi5yZWdpc3RlckU9YSYyNTUsODtjYXNlIDIwOnJldHVybiBQKGIucmVnaXN0ZXJELDEpLGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJEKzEmMjU1LDA9PT1iLnJlZ2lzdGVyRD9rKDEpOmsoMCkscSgwKSw0O2Nhc2UgMjE6cmV0dXJuIFAoYi5yZWdpc3RlckQsLTEpLGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJELTEmMjU1LDA9PT1iLnJlZ2lzdGVyRD9rKDEpOmsoMCkscSgxKSw0O2Nhc2UgMjI6cmV0dXJuIGIucmVnaXN0ZXJEPUgoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMjM6cmV0dXJuIGE9ITEsCjEyOD09PShiLnJlZ2lzdGVyQSYxMjgpJiYoYT0hMCksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPDwxfFIoKSkmMjU1LGE/dygxKTp3KDApLGsoMCkscSgwKSxEKDApLDQ7Y2FzZSAyNDpyZXR1cm4geWEoSCgpKSwxMjtjYXNlIDI1OmE9ZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9ZyhiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSk7cmEoYSxjLCExKTthPWErYyY2NTUzNTtiLnJlZ2lzdGVySD1KKGEpO2IucmVnaXN0ZXJMPWEmMjU1O3EoMCk7cmV0dXJuIDg7Y2FzZSAyNjpyZXR1cm4gYT1nKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQT1HKGEpLDg7Y2FzZSAyNzpyZXR1cm4gYT1nKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyRD1KKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDg7Y2FzZSAyODpyZXR1cm4gUChiLnJlZ2lzdGVyRSwxKSxiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyRSsxJjI1NSwwPT09Yi5yZWdpc3RlckU/aygxKToKaygwKSxxKDApLDQ7Y2FzZSAyOTpyZXR1cm4gUChiLnJlZ2lzdGVyRSwtMSksYi5yZWdpc3RlckU9Yi5yZWdpc3RlckUtMSYyNTUsMD09PWIucmVnaXN0ZXJFP2soMSk6aygwKSxxKDEpLDQ7Y2FzZSAzMDpyZXR1cm4gYi5yZWdpc3RlckU9SCgpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAzMTpyZXR1cm4gYT0hMSwxPT09KGIucmVnaXN0ZXJBJjEpJiYoYT0hMCksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPj4xfFIoKTw8NykmMjU1LGE/dygxKTp3KDApLGsoMCkscSgwKSxEKDApLDR9cmV0dXJuLTF9ZnVuY3Rpb24geWIoYSl7c3dpdGNoKGEpe2Nhc2UgMzI6aWYoMD09PW5hKCkpcmV0dXJuIHlhKEgoKSksMTI7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7cmV0dXJuIDg7Y2FzZSAzMzpyZXR1cm4gYT1RKCksYi5yZWdpc3Rlckg9SihhKSxiLnJlZ2lzdGVyTD1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrCjImNjU1MzUsMTI7Y2FzZSAzNDpyZXR1cm4gYT1nKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxPKGEsYi5yZWdpc3RlckEpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUooYSksYi5yZWdpc3Rlckw9YSYyNTUsODtjYXNlIDM1OnJldHVybiBhPWcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUooYSksYi5yZWdpc3Rlckw9YSYyNTUsODtjYXNlIDM2OnJldHVybiBQKGIucmVnaXN0ZXJILDEpLGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJIKzEmMjU1LDA9PT1iLnJlZ2lzdGVySD9rKDEpOmsoMCkscSgwKSw0O2Nhc2UgMzc6cmV0dXJuIFAoYi5yZWdpc3RlckgsLTEpLGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILTEmMjU1LDA9PT1iLnJlZ2lzdGVySD9rKDEpOmsoMCkscSgxKSw0O2Nhc2UgMzg6cmV0dXJuIGIucmVnaXN0ZXJIPUgoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMzk6dmFyIGM9MDswPChiLnJlZ2lzdGVyRj4+CjUmMSkmJihjfD02KTswPFIoKSYmKGN8PTk2KTswPChiLnJlZ2lzdGVyRj4+NiYxKT9hPWIucmVnaXN0ZXJBLWMmMjU1Oig5PChiLnJlZ2lzdGVyQSYxNSkmJihjfD02KSwxNTM8Yi5yZWdpc3RlckEmJihjfD05NiksYT1iLnJlZ2lzdGVyQStjJjI1NSk7MD09PWE/aygxKTprKDApOzAhPT0oYyY5Nik/dygxKTp3KDApO0QoMCk7Yi5yZWdpc3RlckE9YTtyZXR1cm4gNDtjYXNlIDQwOmlmKDA8bmEoKSlyZXR1cm4geWEoSCgpKSwxMjtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtyZXR1cm4gODtjYXNlIDQxOnJldHVybiBhPWcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLHJhKGEsYSwhMSksYT0yKmEmNjU1MzUsYi5yZWdpc3Rlckg9SihhKSxiLnJlZ2lzdGVyTD1hJjI1NSxxKDApLDg7Y2FzZSA0MjpyZXR1cm4gYT1nKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQT1HKGEpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUooYSksYi5yZWdpc3Rlckw9CmEmMjU1LDg7Y2FzZSA0MzpyZXR1cm4gYT1nKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1KKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSA0NDpyZXR1cm4gUChiLnJlZ2lzdGVyTCwxKSxiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCsxJjI1NSwwPT09Yi5yZWdpc3Rlckw/aygxKTprKDApLHEoMCksNDtjYXNlIDQ1OnJldHVybiBQKGIucmVnaXN0ZXJMLC0xKSxiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTC0xJjI1NSwwPT09Yi5yZWdpc3Rlckw/aygxKTprKDApLHEoMSksNDtjYXNlIDQ2OnJldHVybiBiLnJlZ2lzdGVyTD1IKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDQ3OnJldHVybiBiLnJlZ2lzdGVyQT1+Yi5yZWdpc3RlckEscSgxKSxEKDEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gemIoYSl7c3dpdGNoKGEpe2Nhc2UgNDg6aWYoMD09PVIoKSlyZXR1cm4geWEoSCgpKSwxMjtiLnByb2dyYW1Db3VudGVyPQpiLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7cmV0dXJuIDg7Y2FzZSA0OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9USgpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDEyO2Nhc2UgNTA6cmV0dXJuIGE9ZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksTyhhLGIucmVnaXN0ZXJBKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1KKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSA1MTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMSY2NTUzNSw4O2Nhc2UgNTI6YT1nKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKTt2YXIgYz1HKGEpO1AoYywxKTtjPWMrMSYyNTU7MD09PWM/aygxKTprKDApO3EoMCk7TyhhLGMpO3JldHVybiAxMjtjYXNlIDUzOnJldHVybiBhPWcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGM9RyhhKSxQKGMsLTEpLGM9Yy0xJjI1NSwwPT09Yz9rKDEpOmsoMCkscSgxKSxPKGEsYyksMTI7Y2FzZSA1NDpyZXR1cm4gTyhnKGIucmVnaXN0ZXJILApiLnJlZ2lzdGVyTCksSCgpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSwxMjtjYXNlIDU1OnJldHVybiBxKDApLEQoMCksdygxKSw0O2Nhc2UgNTY6aWYoMT09PVIoKSlyZXR1cm4geWEoSCgpKSwxMjtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtyZXR1cm4gODtjYXNlIDU3OnJldHVybiBhPWcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLHJhKGEsYi5zdGFja1BvaW50ZXIsITEpLGE9YStiLnN0YWNrUG9pbnRlciY2NTUzNSxiLnJlZ2lzdGVySD1KKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHEoMCksODtjYXNlIDU4OnJldHVybiBhPWcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBPUcoYSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9SihhKSxiLnJlZ2lzdGVyTD1hJjI1NSw4O2Nhc2UgNTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTEmNjU1MzUsODtjYXNlIDYwOnJldHVybiBQKGIucmVnaXN0ZXJBLAoxKSxiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQSsxJjI1NSwwPT09Yi5yZWdpc3RlckE/aygxKTprKDApLHEoMCksNDtjYXNlIDYxOnJldHVybiBQKGIucmVnaXN0ZXJBLC0xKSxiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQS0xJjI1NSwwPT09Yi5yZWdpc3RlckE/aygxKTprKDApLHEoMSksNDtjYXNlIDYyOnJldHVybiBiLnJlZ2lzdGVyQT1IKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDYzOnJldHVybiBxKDApLEQoMCksMDxSKCk/dygwKTp3KDEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gQWIoYSl7c3dpdGNoKGEpe2Nhc2UgNjQ6cmV0dXJuIDQ7Y2FzZSA2NTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckMsNDtjYXNlIDY2OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyRCw0O2Nhc2UgNjc6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJFLDQ7Y2FzZSA2ODpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckgsNDtjYXNlIDY5OnJldHVybiBiLnJlZ2lzdGVyQj0KYi5yZWdpc3RlckwsNDtjYXNlIDcwOnJldHVybiBiLnJlZ2lzdGVyQj1HKGcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw4O2Nhc2UgNzE6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJBLDQ7Y2FzZSA3MjpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckIsNDtjYXNlIDczOnJldHVybiA0O2Nhc2UgNzQ6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJELDQ7Y2FzZSA3NTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckUsNDtjYXNlIDc2OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVySCw0O2Nhc2UgNzc6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJMLDQ7Y2FzZSA3ODpyZXR1cm4gYi5yZWdpc3RlckM9RyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksODtjYXNlIDc5OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIEJiKGEpe3N3aXRjaChhKXtjYXNlIDgwOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQiwKNDtjYXNlIDgxOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQyw0O2Nhc2UgODI6cmV0dXJuIDQ7Y2FzZSA4MzpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckUsNDtjYXNlIDg0OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVySCw0O2Nhc2UgODU6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJMLDQ7Y2FzZSA4NjpyZXR1cm4gYi5yZWdpc3RlckQ9RyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksODtjYXNlIDg3OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQSw0O2Nhc2UgODg6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJCLDQ7Y2FzZSA4OTpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckMsNDtjYXNlIDkwOnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyRCw0O2Nhc2UgOTE6cmV0dXJuIDQ7Y2FzZSA5MjpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckgsNDtjYXNlIDkzOnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyTCwKNDtjYXNlIDk0OnJldHVybiBiLnJlZ2lzdGVyRT1HKGcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgOTU6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gQ2IoYSl7c3dpdGNoKGEpe2Nhc2UgOTY6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJCLDg7Y2FzZSA5NzpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckMsNDtjYXNlIDk4OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyRCw0O2Nhc2UgOTk6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMDA6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILDQ7Y2FzZSAxMDE6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMDI6cmV0dXJuIGIucmVnaXN0ZXJIPUcoZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDg7Y2FzZSAxMDM6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJBLDQ7Y2FzZSAxMDQ6cmV0dXJuIGIucmVnaXN0ZXJMPQpiLnJlZ2lzdGVyQiw0O2Nhc2UgMTA1OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQyw0O2Nhc2UgMTA2OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRCw0O2Nhc2UgMTA3OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTA4OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVySCw0O2Nhc2UgMTA5OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTEwOnJldHVybiBiLnJlZ2lzdGVyTD1HKGcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw4O2Nhc2UgMTExOnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIERiKGEpe3N3aXRjaChhKXtjYXNlIDExMjpyZXR1cm4gTyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQiksODtjYXNlIDExMzpyZXR1cm4gTyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQyksODtjYXNlIDExNDpyZXR1cm4gTyhnKGIucmVnaXN0ZXJILApiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckQpLDg7Y2FzZSAxMTU6cmV0dXJuIE8oZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckUpLDg7Y2FzZSAxMTY6cmV0dXJuIE8oZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckgpLDg7Y2FzZSAxMTc6cmV0dXJuIE8oZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckwpLDg7Y2FzZSAxMTg6cmV0dXJuIGQuaXNIYmxhbmtIZG1hQWN0aXZlfHwoYi5pc0hhbHRlZD0hMCksNDtjYXNlIDExOTpyZXR1cm4gTyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQSksODtjYXNlIDEyMDpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckIsNDtjYXNlIDEyMTpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckMsNDtjYXNlIDEyMjpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckQsNDtjYXNlIDEyMzpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckUsNDtjYXNlIDEyNDpyZXR1cm4gYi5yZWdpc3RlckE9CmIucmVnaXN0ZXJILDQ7Y2FzZSAxMjU6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMjY6cmV0dXJuIGIucmVnaXN0ZXJBPUcoZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDg7Y2FzZSAxMjc6cmV0dXJuIDR9cmV0dXJuLTF9ZnVuY3Rpb24gRWIoYSl7c3dpdGNoKGEpe2Nhc2UgMTI4OnJldHVybiBlYShiLnJlZ2lzdGVyQiksNDtjYXNlIDEyOTpyZXR1cm4gZWEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMzA6cmV0dXJuIGVhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTMxOnJldHVybiBlYShiLnJlZ2lzdGVyRSksNDtjYXNlIDEzMjpyZXR1cm4gZWEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxMzM6cmV0dXJuIGVhKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTM0OnJldHVybiBhPUcoZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGVhKGEpLDg7Y2FzZSAxMzU6cmV0dXJuIGVhKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTM2OnJldHVybiBmYShiLnJlZ2lzdGVyQiksNDtjYXNlIDEzNzpyZXR1cm4gZmEoYi5yZWdpc3RlckMpLAo0O2Nhc2UgMTM4OnJldHVybiBmYShiLnJlZ2lzdGVyRCksNDtjYXNlIDEzOTpyZXR1cm4gZmEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNDA6cmV0dXJuIGZhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTQxOnJldHVybiBmYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE0MjpyZXR1cm4gYT1HKGcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxmYShhKSw4O2Nhc2UgMTQzOnJldHVybiBmYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBGYihhKXtzd2l0Y2goYSl7Y2FzZSAxNDQ6cmV0dXJuIGhhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTQ1OnJldHVybiBoYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE0NjpyZXR1cm4gaGEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNDc6cmV0dXJuIGhhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTQ4OnJldHVybiBoYShiLnJlZ2lzdGVySCksNDtjYXNlIDE0OTpyZXR1cm4gaGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTA6cmV0dXJuIGE9RyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksCmhhKGEpLDg7Y2FzZSAxNTE6cmV0dXJuIGhhKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTUyOnJldHVybiBpYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE1MzpyZXR1cm4gaWEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNTQ6cmV0dXJuIGlhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTU1OnJldHVybiBpYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE1NjpyZXR1cm4gaWEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNTc6cmV0dXJuIGlhKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTU4OnJldHVybiBhPUcoZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGlhKGEpLDg7Y2FzZSAxNTk6cmV0dXJuIGlhKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIEdiKGEpe3N3aXRjaChhKXtjYXNlIDE2MDpyZXR1cm4gamEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNjE6cmV0dXJuIGphKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTYyOnJldHVybiBqYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE2MzpyZXR1cm4gamEoYi5yZWdpc3RlckUpLAo0O2Nhc2UgMTY0OnJldHVybiBqYShiLnJlZ2lzdGVySCksNDtjYXNlIDE2NTpyZXR1cm4gamEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNjY6cmV0dXJuIGE9RyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksamEoYSksODtjYXNlIDE2NzpyZXR1cm4gamEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxNjg6cmV0dXJuIGthKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTY5OnJldHVybiBrYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE3MDpyZXR1cm4ga2EoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNzE6cmV0dXJuIGthKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTcyOnJldHVybiBrYShiLnJlZ2lzdGVySCksNDtjYXNlIDE3MzpyZXR1cm4ga2EoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNzQ6cmV0dXJuIGE9RyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksa2EoYSksODtjYXNlIDE3NTpyZXR1cm4ga2EoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSGIoYSl7c3dpdGNoKGEpe2Nhc2UgMTc2OnJldHVybiBsYShiLnJlZ2lzdGVyQiksCjQ7Y2FzZSAxNzc6cmV0dXJuIGxhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTc4OnJldHVybiBsYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE3OTpyZXR1cm4gbGEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxODA6cmV0dXJuIGxhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTgxOnJldHVybiBsYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE4MjpyZXR1cm4gYT1HKGcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxsYShhKSw4O2Nhc2UgMTgzOnJldHVybiBsYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE4NDpyZXR1cm4gbWEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxODU6cmV0dXJuIG1hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTg2OnJldHVybiBtYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE4NzpyZXR1cm4gbWEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxODg6cmV0dXJuIG1hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTg5OnJldHVybiBtYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE5MDpyZXR1cm4gYT1HKGcoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSwKbWEoYSksODtjYXNlIDE5MTpyZXR1cm4gbWEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSWIoYSl7c3dpdGNoKGEpe2Nhc2UgMTkyOnJldHVybiAwPT09bmEoKT8oYi5wcm9ncmFtQ291bnRlcj1iYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwyMCk6ODtjYXNlIDE5MzpyZXR1cm4gYT1iYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSxiLnJlZ2lzdGVyQj1KKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDEyO2Nhc2UgMTk0OmlmKDA9PT1uYSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVEoKSwxNjtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAxOTU6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9USgpLDE2O2Nhc2UgMTk2OmlmKDA9PT1uYSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LApUKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1RKCksMjQ7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMTk3OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFQoYi5zdGFja1BvaW50ZXIsZyhiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDE2O2Nhc2UgMTk4OnJldHVybiBlYShIKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAxOTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVChiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTAsMTY7Y2FzZSAyMDA6cmV0dXJuIDE9PT1uYSgpPyhiLnByb2dyYW1Db3VudGVyPWJhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDIwKToKODtjYXNlIDIwMTpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1iYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwxNjtjYXNlIDIwMjppZigxPT09bmEoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1RKCksMTY7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjAzOnZhciBjPUgoKTthPS0xO3ZhciBmPSExLGQ9MCxlPTAsaD1jJTg7c3dpdGNoKGgpe2Nhc2UgMDpkPWIucmVnaXN0ZXJCO2JyZWFrO2Nhc2UgMTpkPWIucmVnaXN0ZXJDO2JyZWFrO2Nhc2UgMjpkPWIucmVnaXN0ZXJEO2JyZWFrO2Nhc2UgMzpkPWIucmVnaXN0ZXJFO2JyZWFrO2Nhc2UgNDpkPWIucmVnaXN0ZXJIO2JyZWFrO2Nhc2UgNTpkPWIucmVnaXN0ZXJMO2JyZWFrO2Nhc2UgNjpkPUcoZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpO2JyZWFrO2Nhc2UgNzpkPWIucmVnaXN0ZXJBfXN3aXRjaCgoYyYyNDApPj40KXtjYXNlIDA6Nz49CmM/KGM9ZCwxMjg9PT0oYyYxMjgpP3coMSk6dygwKSxjPShjPDwxfGM+PjcpJjI1NSwwPT09Yz9rKDEpOmsoMCkscSgwKSxEKDApLGU9YyxmPSEwKToxNT49YyYmKGM9ZCwwPChjJjEpP3coMSk6dygwKSxjPShjPj4xfGM8PDcpJjI1NSwwPT09Yz9rKDEpOmsoMCkscSgwKSxEKDApLGU9YyxmPSEwKTticmVhaztjYXNlIDE6MjM+PWM/KGM9ZCxmPSExLDEyOD09PShjJjEyOCkmJihmPSEwKSxjPShjPDwxfFIoKSkmMjU1LGY/dygxKTp3KDApLDA9PT1jP2soMSk6aygwKSxxKDApLEQoMCksZT1jLGY9ITApOjMxPj1jJiYoYz1kLGY9ITEsMT09PShjJjEpJiYoZj0hMCksYz0oYz4+MXxSKCk8PDcpJjI1NSxmP3coMSk6dygwKSwwPT09Yz9rKDEpOmsoMCkscSgwKSxEKDApLGU9YyxmPSEwKTticmVhaztjYXNlIDI6Mzk+PWM/KGM9ZCxmPSExLDEyOD09PShjJjEyOCkmJihmPSEwKSxjPWM8PDEmMjU1LGY/dygxKTp3KDApLDA9PT1jP2soMSk6aygwKSxxKDApLEQoMCksZT1jLGY9ITApOjQ3Pj0KYyYmKGM9ZCxmPSExLDEyOD09PShjJjEyOCkmJihmPSEwKSxkPSExLDE9PT0oYyYxKSYmKGQ9ITApLGM9Yz4+MSYyNTUsZiYmKGN8PTEyOCksMD09PWM/aygxKTprKDApLHEoMCksRCgwKSxkP3coMSk6dygwKSxlPWMsZj0hMCk7YnJlYWs7Y2FzZSAzOjU1Pj1jPyhjPWQsYz0oKGMmMTUpPDw0fChjJjI0MCk+PjQpJjI1NSwwPT09Yz9rKDEpOmsoMCkscSgwKSxEKDApLHcoMCksZT1jLGY9ITApOjYzPj1jJiYoYz1kLGY9ITEsMT09PShjJjEpJiYoZj0hMCksYz1jPj4xJjI1NSwwPT09Yz9rKDEpOmsoMCkscSgwKSxEKDApLGY/dygxKTp3KDApLGU9YyxmPSEwKTticmVhaztjYXNlIDQ6NzE+PWM/KGU9cWEoMCxkKSxmPSEwKTo3OT49YyYmKGU9cWEoMSxkKSxmPSEwKTticmVhaztjYXNlIDU6ODc+PWM/KGU9cWEoMixkKSxmPSEwKTo5NT49YyYmKGU9cWEoMyxkKSxmPSEwKTticmVhaztjYXNlIDY6MTAzPj1jPyhlPXFhKDQsZCksZj0hMCk6MTExPj1jJiYoZT1xYSg1LGQpLGY9ITApO2JyZWFrOwpjYXNlIDc6MTE5Pj1jPyhlPXFhKDYsZCksZj0hMCk6MTI3Pj1jJiYoZT1xYSg3LGQpLGY9ITApO2JyZWFrO2Nhc2UgODoxMzU+PWM/KGU9VygwLDAsZCksZj0hMCk6MTQzPj1jJiYoZT1XKDEsMCxkKSxmPSEwKTticmVhaztjYXNlIDk6MTUxPj1jPyhlPVcoMiwwLGQpLGY9ITApOjE1OT49YyYmKGU9VygzLDAsZCksZj0hMCk7YnJlYWs7Y2FzZSAxMDoxNjc+PWM/KGU9Vyg0LDAsZCksZj0hMCk6MTc1Pj1jJiYoZT1XKDUsMCxkKSxmPSEwKTticmVhaztjYXNlIDExOjE4Mz49Yz8oZT1XKDYsMCxkKSxmPSEwKToxOTE+PWMmJihlPVcoNywwLGQpLGY9ITApO2JyZWFrO2Nhc2UgMTI6MTk5Pj1jPyhlPVcoMCwxLGQpLGY9ITApOjIwNz49YyYmKGU9VygxLDEsZCksZj0hMCk7YnJlYWs7Y2FzZSAxMzoyMTU+PWM/KGU9VygyLDEsZCksZj0hMCk6MjIzPj1jJiYoZT1XKDMsMSxkKSxmPSEwKTticmVhaztjYXNlIDE0OjIzMT49Yz8oZT1XKDQsMSxkKSxmPSEwKToyMzk+PWMmJihlPVcoNSwxLGQpLApmPSEwKTticmVhaztjYXNlIDE1OjI0Nz49Yz8oZT1XKDYsMSxkKSxmPSEwKToyNTU+PWMmJihlPVcoNywxLGQpLGY9ITApfXN3aXRjaChoKXtjYXNlIDA6Yi5yZWdpc3RlckI9ZTticmVhaztjYXNlIDE6Yi5yZWdpc3RlckM9ZTticmVhaztjYXNlIDI6Yi5yZWdpc3RlckQ9ZTticmVhaztjYXNlIDM6Yi5yZWdpc3RlckU9ZTticmVhaztjYXNlIDQ6Yi5yZWdpc3Rlckg9ZTticmVhaztjYXNlIDU6Yi5yZWdpc3Rlckw9ZTticmVhaztjYXNlIDY6TyhnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxlKTticmVhaztjYXNlIDc6Yi5yZWdpc3RlckE9ZX1iLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtmJiYoYT04LDY9PT1oJiYoYT0xNikpOzA8YSYmKGErPTQpO3JldHVybiBhO2Nhc2UgMjA0OmlmKDE9PT1uYSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFQoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyKSxiLnByb2dyYW1Db3VudGVyPQpRKCksMjQ7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjA1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFQoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVEoKSwyNDtjYXNlIDIwNjpyZXR1cm4gZmEoSCgpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMjA3OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFQoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj04LDE2fXJldHVybi0xfWZ1bmN0aW9uIEpiKGEpe3N3aXRjaChhKXtjYXNlIDIwODpyZXR1cm4gMD09PVIoKT8oYi5wcm9ncmFtQ291bnRlcj1iYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwyMCk6ODtjYXNlIDIwOTpyZXR1cm4gYT0KYmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckQ9SihhKSxiLnJlZ2lzdGVyRT1hJjI1NSwxMjtjYXNlIDIxMDppZigwPT09UigpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVEoKSwxNjtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMTI6aWYoMD09PVIoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxUKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiksYi5wcm9ncmFtQ291bnRlcj1RKCksMjQ7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjEzOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFQoYi5zdGFja1BvaW50ZXIsZyhiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSkpLDE2O2Nhc2UgMjE0OnJldHVybiBoYShIKCkpLApiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMjE1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFQoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0xNjtjYXNlIDIxNjpyZXR1cm4gMT09PVIoKT8oYi5wcm9ncmFtQ291bnRlcj1iYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwyMCk6ODtjYXNlIDIxNzpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1iYShiLnN0YWNrUG9pbnRlciksbS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITAsYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwxNjtjYXNlIDIxODppZigxPT09UigpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVEoKSwxNjtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjA6aWYoMT09PVIoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9CmIuc3RhY2tQb2ludGVyLTImNjU1MzUsVChiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9USgpLDI0O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIyMjpyZXR1cm4gaWEoSCgpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMjIzOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFQoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0yNCwxNn1yZXR1cm4tMX1mdW5jdGlvbiBLYihhKXtzd2l0Y2goYSl7Y2FzZSAyMjQ6cmV0dXJuIGE9SCgpLE8oNjUyODArYSxiLnJlZ2lzdGVyQSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsMTI7Y2FzZSAyMjU6cmV0dXJuIGE9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKwoyJjY1NTM1LGIucmVnaXN0ZXJIPUooYSksYi5yZWdpc3Rlckw9YSYyNTUsMTI7Y2FzZSAyMjY6cmV0dXJuIE8oNjUyODArYi5yZWdpc3RlckMsYi5yZWdpc3RlckEpLDg7Y2FzZSAyMjk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVChiLnN0YWNrUG9pbnRlcixnKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksMTY7Y2FzZSAyMzA6cmV0dXJuIGphKEgoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDIzMTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxUKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MzIsMTY7Y2FzZSAyMzI6cmV0dXJuIGE9T2EoSCgpKSxyYShiLnN0YWNrUG9pbnRlcixhLCEwKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcithJjY1NTM1LGsoMCkscSgwKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrCjEmNjU1MzUsMTY7Y2FzZSAyMzM6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9ZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksNDtjYXNlIDIzNDpyZXR1cm4gTyhRKCksYi5yZWdpc3RlckEpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDE2O2Nhc2UgMjM4OnJldHVybiBrYShIKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAyMzk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVChiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTQwLDE2fXJldHVybi0xfWZ1bmN0aW9uIExiKGEpe3N3aXRjaChhKXtjYXNlIDI0MDpyZXR1cm4gYT1IKCksYi5yZWdpc3RlckE9Ryg2NTI4MCthKSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsMTI7Y2FzZSAyNDE6cmV0dXJuIGE9YmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPQpiLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJBPUooYSksYi5yZWdpc3RlckY9YSYyNTUsMTI7Y2FzZSAyNDI6cmV0dXJuIGIucmVnaXN0ZXJBPUcoNjUyODArYi5yZWdpc3RlckMpJjI1NSw4O2Nhc2UgMjQzOnJldHVybiBtLm1hc3RlckludGVycnVwdFN3aXRjaD0hMSw0O2Nhc2UgMjQ1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFQoYi5zdGFja1BvaW50ZXIsZyhiLnJlZ2lzdGVyQSxiLnJlZ2lzdGVyRikpLDE2O2Nhc2UgMjQ2OnJldHVybiBsYShIKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAyNDc6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVChiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTQ4LDE2O2Nhc2UgMjQ4OnJldHVybiBhPU9hKEgoKSksaygwKSxxKDApLHJhKGIuc3RhY2tQb2ludGVyLGEsITApLAphPWIuc3RhY2tQb2ludGVyK2EmNjU1MzUsYi5yZWdpc3Rlckg9SihhKSxiLnJlZ2lzdGVyTD1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSwxMjtjYXNlIDI0OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9ZyhiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksODtjYXNlIDI1MDpyZXR1cm4gYi5yZWdpc3RlckE9RyhRKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDE2O2Nhc2UgMjUxOnJldHVybiBtLm1hc3RlckludGVycnVwdFN3aXRjaD0hMCw0O2Nhc2UgMjU0OnJldHVybiBtYShIKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAyNTU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVChiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTU2LDE2fXJldHVybi0xfWZ1bmN0aW9uIGxiKCl7Zm9yKHZhciBhPQohMSxjOyFhJiZiLmN1cnJlbnRDeWNsZXM8Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpOyljPU1hKCksMD5jJiYoYT0hMCk7aWYoYi5jdXJyZW50Q3ljbGVzPj1iLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCkpcmV0dXJuIGIuY3VycmVudEN5Y2xlcy09Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpLDA7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyLTEmNjU1MzU7cmV0dXJuLTF9ZnVuY3Rpb24gTWEoKXt6YT0hMDt2YXIgYT00O2IuaXNIYWx0ZWR8fGIuaXNTdG9wcGVkP2IuaXNIYWx0ZWQmJiFtLm1hc3RlckludGVycnVwdFN3aXRjaCYmbS5hcmVJbnRlcnJ1cHRzUGVuZGluZygpJiYoYi5pc0hhbHRlZD0hMSxiLmlzU3RvcHBlZD0hMSxhPXgoYi5wcm9ncmFtQ291bnRlciksYT1rYihhKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXItMSY2NTUzNSk6KGE9eChiLnByb2dyYW1Db3VudGVyKSxhPWtiKGEpKTtiLnJlZ2lzdGVyRiY9MjQwO2lmKDA+PWEpcmV0dXJuIGE7CjA8ZC5ETUFDeWNsZXMmJihhKz1kLkRNQUN5Y2xlcyxkLkRNQUN5Y2xlcz0wKTthOntpZihtLm1hc3RlckludGVycnVwdFN3aXRjaCYmMDxtLmludGVycnVwdHNFbmFibGVkVmFsdWUmJjA8bS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUpe3ZhciBjPSExO20uaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkJiZtLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPyhMYShtLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSxjPSEwKTptLmlzTGNkSW50ZXJydXB0RW5hYmxlZCYmbS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD8oTGEobS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCksYz0hMCk6bS5pc1RpbWVySW50ZXJydXB0RW5hYmxlZCYmbS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPyhMYShtLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQpLGM9ITApOm0uaXNKb3lwYWRJbnRlcnJ1cHRFbmFibGVkJiZtLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkJiYoTGEobS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCksCmM9ITApO2lmKGMpe2M9MjA7Yi5pc0hhbHRlZCYmKGIuaXNIYWx0ZWQ9ITEsYys9NCk7YnJlYWsgYX19Yz0wfWErPWM7Yi5jdXJyZW50Q3ljbGVzKz1hO2lmKCFiLmlzU3RvcHBlZCl7aWYoUy5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZyl7aWYoci5jdXJyZW50Q3ljbGVzKz1hLCEoci5jdXJyZW50Q3ljbGVzPHIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCkpKWZvcig7ci5jdXJyZW50Q3ljbGVzPj1yLmJhdGNoUHJvY2Vzc0N5Y2xlcygpOylqYihyLmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSxyLmN1cnJlbnRDeWNsZXMtPXIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCl9ZWxzZSBqYihhKTtTLmF1ZGlvQmF0Y2hQcm9jZXNzaW5nP2UuY3VycmVudEN5Y2xlcys9YTpjYihhKX1TLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz8obi5jdXJyZW50Q3ljbGVzKz1hLGZiKCkpOmdiKGEpO3JldHVybiBhfWZ1bmN0aW9uIE1iKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOgpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGItMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTthLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiBtYihhKXthLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTkwPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZT8xLjI1Kk1hdGguZmxvb3IoYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpOjEyMH1mdW5jdGlvbiBuYihhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCkpLWEuZnBzVGltZVN0YW1wc1thLmZwc1RpbWVTdGFtcHMubGVuZ3RoLTFdO2I9b2ItYjswPmImJihiPTApO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e3BiKGEpfSxNYXRoLmZsb29yKGIpKX1mdW5jdGlvbiBwYihhLGIpe2lmKGEucGF1c2VkKXJldHVybiEwOwp2b2lkIDAhPT1iJiYob2I9Yik7QWE9YS5nZXRGUFMoKTtpZihBYT5hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxKXJldHVybiBhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKSxuYihhKSwhMDtNYihhKTtjb25zdCBjPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoKGIpPT57bGV0IGY7Yz9WYShhLGIpOihmPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksYihmKSl9KSkudGhlbigoYik9PnswPD1iPyhaKE4oe3R5cGU6Qy5VUERBVEVELGZwczpBYX0pKSxiPSExLGEub3B0aW9ucy5mcmFtZVNraXAmJjA8YS5vcHRpb25zLmZyYW1lU2tpcCYmKGEuZnJhbWVTa2lwQ291bnRlcisrLGEuZnJhbWVTa2lwQ291bnRlcjw9YS5vcHRpb25zLmZyYW1lU2tpcD9iPSEwOmEuZnJhbWVTa2lwQ291bnRlcj0wKSxifHwoYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTiwKYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OK2EuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkUpLmJ1ZmZlcixhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOkMuVVBEQVRFRCxncmFwaGljc0ZyYW1lQnVmZmVyOmJ9KSxbYl0pKSxiPXt0eXBlOkMuVVBEQVRFRH0sYltGLkNBUlRSSURHRV9SQU1dPVdhKGEpLmJ1ZmZlcixiW0YuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLGJbRi5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXIsCmJbRi5JTlRFUk5BTF9TVEFURV09WGEoYSkuYnVmZmVyLGEubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKGIpLFtiW0YuQ0FSVFJJREdFX1JBTV0sYltGLkdBTUVCT1lfTUVNT1JZXSxiW0YuUEFMRVRURV9NRU1PUlldLGJbRi5JTlRFUk5BTF9TVEFURV1dKSxuYihhKSk6KFooTih7dHlwZTpDLkNSQVNIRUR9KSksYS5wYXVzZWQ9ITApfSl9ZnVuY3Rpb24gVmEoYSxiKXt2YXIgYz1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PWMmJmIoYyk7aWYoMT09PWMpe2M9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nZXRBdWRpb1F1ZXVlSW5kZXgoKTtjb25zdCBmPUFhPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTsuMjU8YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzJiZmPyhxYihhLGMpLHNldFRpbWVvdXQoKCk9PnttYihhKTtWYShhLGIpfSxNYXRoLmZsb29yKE1hdGguZmxvb3IoMUUzKihhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMtCi4yNSkpLzEwKSkpOihxYihhLGMpLFZhKGEsYikpfX1mdW5jdGlvbiBxYihhLGIpe2NvbnN0IGM9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTpDLlVQREFURUQsYXVkaW9CdWZmZXI6YyxudW1iZXJPZlNhbXBsZXM6YixmcHM6QWEsYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nOjYwPGEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlfSksW2NdKTthLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpfWNvbnN0IENhPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY7bGV0IE5hO0NhfHwoTmE9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtjb25zdCBDPXtDT05ORUNUOiJDT05ORUNUIixJTlNUQU5USUFURV9XQVNNOiJJTlNUQU5USUFURV9XQVNNIixDTEVBUl9NRU1PUlk6IkNMRUFSX01FTU9SWSIsCkNMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixQQVVTRToiUEFVU0UiLFVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCJ9LEY9e0NBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLApDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IERhPTA7Y29uc3QgaD1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTEwOTUwNCksQmE9e3NpemU6KCk9PjkxMDk1MDQsZ3JvdzooKT0+e30sd2FzbUJ5dGVNZW1vcnk6aH07dmFyIHhhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVJbmRleD02NTM4NDthLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVEYXRhPTY1Mzg1O2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlSW5kZXg9NjUzODY7YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhPTY1Mzg3O3JldHVybiBhfSgpLGRhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe30KYS50aWxlSWQ9LTE7YS5ob3Jpem9udGFsRmxpcD0hMTthLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrPS0xO3JldHVybiBhfSgpLHo9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MD1mdW5jdGlvbihiKXthLk5SeDBTd2VlcFBlcmlvZD0oYiYxMTIpPj40O2EuTlJ4ME5lZ2F0ZT1wKDMsYik7YS5OUngwU3dlZXBTaGlmdD1iJjd9O2EudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFEdXR5PWI+PjYmMzthLk5SeDFMZW5ndGhMb2FkPWImNjM7YS5sZW5ndGhDb3VudGVyPTY0LWEuTlJ4MUxlbmd0aExvYWR9O2EudXBkYXRlTlJ4Mj1mdW5jdGlvbihiKXthLk5SeDJTdGFydGluZ1ZvbHVtZT1iPj40JjE1O2EuTlJ4MkVudmVsb3BlQWRkTW9kZT1wKDMsYik7YS5OUngyRW52ZWxvcGVQZXJpb2Q9YiY3O2EuaXNEYWNFbmFibGVkPTA8KGImMjQ4KX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGIpe2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8Cjh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1wKDYsYik7YS5OUng0RnJlcXVlbmN5TVNCPWImNzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe1UoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0VuYWJsZWQpO2hbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7aFsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7aFsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2hbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2hbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZHV0eUN5Y2xlO2hbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eTtVKDEwNDkrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNTd2VlcEVuYWJsZWQpOwpoWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwQ291bnRlcjtoWzEwNTUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwU2hhZG93RnJlcXVlbmN5fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVYoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9aFsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5lbnZlbG9wZUNvdW50ZXI9aFsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWhbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eudm9sdW1lPWhbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZHV0eUN5Y2xlPWhbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1oWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmlzU3dlZXBFbmFibGVkPVYoMTA0OSs1MCphLnNhdmVTdGF0ZVNsb3QpO2Euc3dlZXBDb3VudGVyPWhbMTA1MCs1MCphLnNhdmVTdGF0ZVNsb3RdO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9CmhbMTA1NSs1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtsKGEubWVtb3J5TG9jYXRpb25OUngwLDEyOCk7bChhLm1lbW9yeUxvY2F0aW9uTlJ4MSwxOTEpO2woYS5tZW1vcnlMb2NhdGlvbk5SeDIsMjQzKTtsKGEubWVtb3J5TG9jYXRpb25OUngzLDE5Myk7bChhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxOTEpfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYj1hLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShiKX07YS5yZXNldFRpbWVyPWZ1bmN0aW9uKCl7YS5mcmVxdWVuY3lUaW1lcj00KigyMDQ4LWEuZnJlcXVlbmN5KTtiLkdCQ0RvdWJsZVNwZWVkJiYoYS5mcmVxdWVuY3lUaW1lcio9Mil9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGIpe2EuZnJlcXVlbmN5VGltZXItPWI7MD49YS5mcmVxdWVuY3lUaW1lciYmKGI9TWF0aC5hYnMoYS5mcmVxdWVuY3lUaW1lciksYS5yZXNldFRpbWVyKCksCmEuZnJlcXVlbmN5VGltZXItPWIsYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5Kz0xLDg8PWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSYmKGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wKSk7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWI9YS52b2x1bWU7ZWxzZSByZXR1cm4gMTU7dmFyIGM9MTskYShhLk5SeDFEdXR5LGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSl8fChjKj0tMSk7cmV0dXJuIGMqYisxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj02NCk7YS5yZXNldFRpbWVyKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1hLmZyZXF1ZW5jeTthLnN3ZWVwQ291bnRlcj1hLk5SeDBTd2VlcFBlcmlvZDthLmlzU3dlZXBFbmFibGVkPTA8YS5OUngwU3dlZXBQZXJpb2QmJgowPGEuTlJ4MFN3ZWVwU2hpZnQ/ITA6ITE7MDxhLk5SeDBTd2VlcFNoaWZ0JiZhYigpO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXI/ITE6ITB9O2EudXBkYXRlU3dlZXA9ZnVuY3Rpb24oKXstLWEuc3dlZXBDb3VudGVyOzA+PWEuc3dlZXBDb3VudGVyJiYoYS5zd2VlcENvdW50ZXI9YS5OUngwU3dlZXBQZXJpb2QsYS5pc1N3ZWVwRW5hYmxlZCYmMDxhLk5SeDBTd2VlcFBlcmlvZCYmYWIoKSl9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7MDxhLmxlbmd0aENvdW50ZXImJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYS5sZW5ndGhDb3VudGVyOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmlzRW5hYmxlZD0hMSl9O2EudXBkYXRlRW52ZWxvcGU9ZnVuY3Rpb24oKXstLWEuZW52ZWxvcGVDb3VudGVyOzA+PWEuZW52ZWxvcGVDb3VudGVyJiYKKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+YS52b2x1bWU/YS52b2x1bWUrPTE6IWEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMDxhLnZvbHVtZSYmLS1hLnZvbHVtZSkpfTthLnNldEZyZXF1ZW5jeT1mdW5jdGlvbihiKXt2YXIgYz1iPj44O2ImPTI1NTt2YXIgZD14KGEubWVtb3J5TG9jYXRpb25OUng0KSYyNDh8YztsKGEubWVtb3J5TG9jYXRpb25OUngzLGIpO2woYS5tZW1vcnlMb2NhdGlvbk5SeDQsZCk7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5OUng0RnJlcXVlbmN5TVNCPWM7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MD02NTI5NjthLk5SeDBTd2VlcFBlcmlvZD0wO2EuTlJ4ME5lZ2F0ZT0hMTthLk5SeDBTd2VlcFNoaWZ0PTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9CjY1Mjk3O2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUyOTg7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTI5OTthLk5SeDNGcmVxdWVuY3lMU0I9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMwMDthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EuY2hhbm5lbE51bWJlcj0xO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wO2EuaXNTd2VlcEVuYWJsZWQ9ITE7YS5zd2VlcENvdW50ZXI9MDthLnN3ZWVwU2hhZG93RnJlcXVlbmN5PTA7YS5zYXZlU3RhdGVTbG90PQo3O3JldHVybiBhfSgpLEs9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFEdXR5PWI+PjYmMzthLk5SeDFMZW5ndGhMb2FkPWImNjM7YS5sZW5ndGhDb3VudGVyPTY0LWEuTlJ4MUxlbmd0aExvYWR9O2EudXBkYXRlTlJ4Mj1mdW5jdGlvbihiKXthLk5SeDJTdGFydGluZ1ZvbHVtZT1iPj40JjE1O2EuTlJ4MkVudmVsb3BlQWRkTW9kZT1wKDMsYik7YS5OUngyRW52ZWxvcGVQZXJpb2Q9YiY3O2EuaXNEYWNFbmFibGVkPTA8KGImMjQ4KX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGIpe2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPXAoNixiKTthLk5SeDRGcmVxdWVuY3lNU0I9YiY3O2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9OwphLnNhdmVTdGF0ZT1mdW5jdGlvbigpe1UoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0VuYWJsZWQpO2hbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7aFsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7aFsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2hbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2hbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZHV0eUN5Y2xlO2hbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1WKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWhbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWhbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1oWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTsKYS52b2x1bWU9aFsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kdXR5Q3ljbGU9aFsxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PWhbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtsKGEubWVtb3J5TG9jYXRpb25OUngxLTEsMjU1KTtsKGEubWVtb3J5TG9jYXRpb25OUngxLDYzKTtsKGEubWVtb3J5TG9jYXRpb25OUngyLDApO2woYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCk7bChhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxODQpfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYj1hLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShiKX07YS5yZXNldFRpbWVyPWZ1bmN0aW9uKCl7YS5mcmVxdWVuY3lUaW1lcj00KigyMDQ4LWEuZnJlcXVlbmN5KTtiLkdCQ0RvdWJsZVNwZWVkJiYoYS5mcmVxdWVuY3lUaW1lcio9Mil9O2EuZ2V0U2FtcGxlPQpmdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEucmVzZXRUaW1lcigpLGEuZnJlcXVlbmN5VGltZXItPWIsYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5Kz0xLDg8PWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSYmKGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wKSk7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWI9YS52b2x1bWU7ZWxzZSByZXR1cm4gMTU7dmFyIGM9MTskYShhLk5SeDFEdXR5LGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSl8fChjKj0tMSk7cmV0dXJuIGMqYisxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj02NCk7YS5yZXNldFRpbWVyKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5pc0RhY0VuYWJsZWR8fAooYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXI/ITE6ITB9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7MDxhLmxlbmd0aENvdW50ZXImJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYS5sZW5ndGhDb3VudGVyOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmlzRW5hYmxlZD0hMSl9O2EudXBkYXRlRW52ZWxvcGU9ZnVuY3Rpb24oKXstLWEuZW52ZWxvcGVDb3VudGVyOzA+PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2QsMCE9PWEuZW52ZWxvcGVDb3VudGVyJiYoYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYxNT5hLnZvbHVtZT9hLnZvbHVtZSs9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGEudm9sdW1lJiYtLWEudm9sdW1lKSl9O2Euc2V0RnJlcXVlbmN5PWZ1bmN0aW9uKGIpe3ZhciBjPQpiPj44O2ImPTI1NTt2YXIgZD14KGEubWVtb3J5TG9jYXRpb25OUng0KSYyNDh8YztsKGEubWVtb3J5TG9jYXRpb25OUngzLGIpO2woYS5tZW1vcnlMb2NhdGlvbk5SeDQsZCk7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5OUng0RnJlcXVlbmN5TVNCPWM7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTMwMjthLk5SeDFEdXR5PTA7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1MzAzO2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPTA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMDQ7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMDU7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLmNoYW5uZWxOdW1iZXI9CjI7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9MDthLmZyZXF1ZW5jeVRpbWVyPTA7YS5lbnZlbG9wZUNvdW50ZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLnZvbHVtZT0wO2EuZHV0eUN5Y2xlPTA7YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PTA7YS5zYXZlU3RhdGVTbG90PTg7cmV0dXJuIGF9KCksST1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVOUngwPWZ1bmN0aW9uKGIpe2EuaXNEYWNFbmFibGVkPXAoNyxiKX07YS51cGRhdGVOUngxPWZ1bmN0aW9uKGIpe2EuTlJ4MUxlbmd0aExvYWQ9YjthLmxlbmd0aENvdW50ZXI9MjU2LWEuTlJ4MUxlbmd0aExvYWR9O2EudXBkYXRlTlJ4Mj1mdW5jdGlvbihiKXthLk5SeDJWb2x1bWVDb2RlPWI+PjUmMTV9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9CmZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9cCg2LGIpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtVKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtoWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2hbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtoWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVUYWJsZVBvc2l0aW9ufTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVYoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9aFsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWhbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZVRhYmxlUG9zaXRpb249aFsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF19OwphLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtsKGEubWVtb3J5TG9jYXRpb25OUngwLDEyNyk7bChhLm1lbW9yeUxvY2F0aW9uTlJ4MSwyNTUpO2woYS5tZW1vcnlMb2NhdGlvbk5SeDIsMTU5KTtsKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2woYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTg0KTthLnZvbHVtZUNvZGVDaGFuZ2VkPSEwfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYj1hLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShiKX07YS5yZXNldFRpbWVyPWZ1bmN0aW9uKCl7YS5mcmVxdWVuY3lUaW1lcj0yKigyMDQ4LWEuZnJlcXVlbmN5KTtiLkdCQ0RvdWJsZVNwZWVkJiYoYS5mcmVxdWVuY3lUaW1lcio9Mil9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGIpe2EuZnJlcXVlbmN5VGltZXItPWI7MD49YS5mcmVxdWVuY3lUaW1lciYmKGI9TWF0aC5hYnMoYS5mcmVxdWVuY3lUaW1lciksYS5yZXNldFRpbWVyKCksYS5mcmVxdWVuY3lUaW1lci09CmIsYS53YXZlVGFibGVQb3NpdGlvbis9MSwzMjw9YS53YXZlVGFibGVQb3NpdGlvbiYmKGEud2F2ZVRhYmxlUG9zaXRpb249MCkpO2I9MDt2YXIgYz1hLnZvbHVtZUNvZGU7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWEudm9sdW1lQ29kZUNoYW5nZWQmJihjPXgoYS5tZW1vcnlMb2NhdGlvbk5SeDIpLGM9Yz4+NSYxNSxhLnZvbHVtZUNvZGU9YyxhLnZvbHVtZUNvZGVDaGFuZ2VkPSExKTtlbHNlIHJldHVybiAxNTt2YXIgZD14KGEubWVtb3J5TG9jYXRpb25XYXZlVGFibGUrYS53YXZlVGFibGVQb3NpdGlvbi8yKTtkPTA9PT1hLndhdmVUYWJsZVBvc2l0aW9uJTI/ZD4+NCYxNTpkJjE1O3N3aXRjaChjKXtjYXNlIDA6ZD4+PTQ7YnJlYWs7Y2FzZSAxOmI9MTticmVhaztjYXNlIDI6ZD4+PTE7Yj0yO2JyZWFrO2RlZmF1bHQ6ZD4+PTIsYj00fXJldHVybigwPGI/ZC9iOjApKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYKKGEubGVuZ3RoQ291bnRlcj0yNTYpO2EucmVzZXRUaW1lcigpO2Eud2F2ZVRhYmxlUG9zaXRpb249MDthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyJiYhYS52b2x1bWVDb2RlQ2hhbmdlZD8hMTohMH07YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXswPGEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPSExKX07YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MD02NTMwNjthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTMwNzthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMDg7YS5OUngyVm9sdW1lQ29kZT0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA5O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0KMDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMxMDthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EubWVtb3J5TG9jYXRpb25XYXZlVGFibGU9NjUzMjg7YS5jaGFubmVsTnVtYmVyPTM7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9MDthLmZyZXF1ZW5jeVRpbWVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS53YXZlVGFibGVQb3NpdGlvbj0wO2Eudm9sdW1lQ29kZT0wO2Eudm9sdW1lQ29kZUNoYW5nZWQ9ITE7YS5zYXZlU3RhdGVTbG90PTk7cmV0dXJuIGF9KCksTD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVOUngxPWZ1bmN0aW9uKGIpe2EuTlJ4MUxlbmd0aExvYWQ9YiY2MzthLmxlbmd0aENvdW50ZXI9NjQtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGIpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPWI+PjQmMTU7YS5OUngyRW52ZWxvcGVBZGRNb2RlPXAoMyxiKTthLk5SeDJFbnZlbG9wZVBlcmlvZD0KYiY3O2EuaXNEYWNFbmFibGVkPTA8KGImMjQ4KX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGIpe2EuTlJ4M0Nsb2NrU2hpZnQ9Yj4+NDthLk5SeDNXaWR0aE1vZGU9cCgzLGIpO2EuTlJ4M0Rpdmlzb3JDb2RlPWImNztzd2l0Y2goYS5OUngzRGl2aXNvckNvZGUpe2Nhc2UgMDphLmRpdmlzb3I9ODticmVhaztjYXNlIDE6YS5kaXZpc29yPTE2O2JyZWFrO2Nhc2UgMjphLmRpdmlzb3I9MzI7YnJlYWs7Y2FzZSAzOmEuZGl2aXNvcj00ODticmVhaztjYXNlIDQ6YS5kaXZpc29yPTY0O2JyZWFrO2Nhc2UgNTphLmRpdmlzb3I9ODA7YnJlYWs7Y2FzZSA2OmEuZGl2aXNvcj05NjticmVhaztjYXNlIDc6YS5kaXZpc29yPTExMn19O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPXAoNixiKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtVKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtoWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyOwpoWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmVudmVsb3BlQ291bnRlcjtoWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7aFsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS52b2x1bWU7aFsxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXJ9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9VigxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1oWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1oWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxlbmd0aENvdW50ZXI9aFsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWU9aFsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9aFsxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2woYS5tZW1vcnlMb2NhdGlvbk5SeDEtCjEsMjU1KTtsKGEubWVtb3J5TG9jYXRpb25OUngxLDI1NSk7bChhLm1lbW9yeUxvY2F0aW9uTlJ4MiwwKTtsKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2woYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTkxKX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGIpe2EuZnJlcXVlbmN5VGltZXItPWI7MD49YS5mcmVxdWVuY3lUaW1lciYmKGI9TWF0aC5hYnMoYS5mcmVxdWVuY3lUaW1lciksYS5mcmVxdWVuY3lUaW1lcj1hLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZCgpLGEuZnJlcXVlbmN5VGltZXItPWIsYj1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3RlciYxXmEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPj4xJjEsYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI+Pj0xLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfD0KYjw8MTQsYS5OUngzV2lkdGhNb2RlJiYoYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXImPS02NSxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcnw9Yjw8NikpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPXAoMCxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcik/LTE6MTtyZXR1cm4gYypiKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTY0KTthLmZyZXF1ZW5jeVRpbWVyPWEuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MzI3Njc7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9CmZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXI/ITE6ITB9O2EuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kPWZ1bmN0aW9uKCl7dmFyIGM9YS5kaXZpc29yPDxhLk5SeDNDbG9ja1NoaWZ0O2IuR0JDRG91YmxlU3BlZWQmJihjKj0yKTtyZXR1cm4gY307YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXswPGEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPSExKX07YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpey0tYS5lbnZlbG9wZUNvdW50ZXI7MD49YS5lbnZlbG9wZUNvdW50ZXImJihhLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09YS5lbnZlbG9wZUNvdW50ZXImJihhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmEudm9sdW1lP2Eudm9sdW1lKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJgowPGEudm9sdW1lJiYtLWEudm9sdW1lKSl9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMTI7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1MzEzO2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPTA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMTQ7YS5OUngzQ2xvY2tTaGlmdD0wO2EuTlJ4M1dpZHRoTW9kZT0hMTthLk5SeDNEaXZpc29yQ29kZT0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzE1O2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5jaGFubmVsTnVtYmVyPTQ7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmRpdmlzb3I9MDthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj0wO2Euc2F2ZVN0YXRlU2xvdD0KMTA7cmV0dXJuIGF9KCksdT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5jaGFubmVsMVNhbXBsZT0xNTthLmNoYW5uZWwyU2FtcGxlPTE1O2EuY2hhbm5lbDNTYW1wbGU9MTU7YS5jaGFubmVsNFNhbXBsZT0xNTthLmNoYW5uZWwxRGFjRW5hYmxlZD0hMTthLmNoYW5uZWwyRGFjRW5hYmxlZD0hMTthLmNoYW5uZWwzRGFjRW5hYmxlZD0hMTthLmNoYW5uZWw0RGFjRW5hYmxlZD0hMTthLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzthLnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7YS5taXhlclZvbHVtZUNoYW5nZWQ9ITE7YS5taXhlckVuYWJsZWRDaGFuZ2VkPSExO2EubmVlZFRvUmVtaXhTYW1wbGVzPSExO3JldHVybiBhfSgpLFM9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuZW5hYmxlQm9vdFJvbT0hMTthLnVzZUdiY1doZW5BdmFpbGFibGU9ITA7YS5hdWRpb0JhdGNoUHJvY2Vzc2luZz0hMTthLmdyYXBoaWNzQmF0Y2hQcm9jZXNzaW5nPSExOwphLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz0hMTthLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPSExO2EuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0hMTthLnRpbGVSZW5kZXJpbmc9ITE7YS50aWxlQ2FjaGluZz0hMTtyZXR1cm4gYX0oKSxlPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzE3NDo4N307YS51cGRhdGVOUjUwPWZ1bmN0aW9uKGIpe2EuTlI1MExlZnRNaXhlclZvbHVtZT1iPj40Jjc7YS5OUjUwUmlnaHRNaXhlclZvbHVtZT1iJjd9O2EudXBkYXRlTlI1MT1mdW5jdGlvbihiKXthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD1wKDcsYik7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9cCg2LGIpO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PXAoNSxiKTthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD0KcCg0LGIpO2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD1wKDMsYik7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PXAoMixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9cCgxLGIpO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD1wKDAsYil9O2EudXBkYXRlTlI1Mj1mdW5jdGlvbihiKXthLk5SNTJJc1NvdW5kRW5hYmxlZD1wKDcsYil9O2EubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzE2Mzg0OjgxOTJ9O2EubWF4RG93blNhbXBsZUN5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBiLkNMT0NLX1NQRUVEKCl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7aFsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyO2hbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZG93blNhbXBsZUN5Y2xlQ291bnRlcjtoWzEwMjkrCjUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmFtZVNlcXVlbmNlcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9aFsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPWhbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZnJhbWVTZXF1ZW5jZXI9aFsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07UWEoKX07YS5jdXJyZW50Q3ljbGVzPTA7YS5tZW1vcnlMb2NhdGlvbk5SNTA9NjUzMTY7YS5OUjUwTGVmdE1peGVyVm9sdW1lPTA7YS5OUjUwUmlnaHRNaXhlclZvbHVtZT0wO2EubWVtb3J5TG9jYXRpb25OUjUxPTY1MzE3O2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD0KITA7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5tZW1vcnlMb2NhdGlvbk5SNTI9NjUzMTg7YS5OUjUySXNTb3VuZEVuYWJsZWQ9ITA7YS5tZW1vcnlMb2NhdGlvbkNoYW5uZWwzTG9hZFJlZ2lzdGVyU3RhcnQ9NjUzMjg7YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPTA7YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPTA7YS5kb3duU2FtcGxlQ3ljbGVNdWx0aXBsaWVyPTQ4RTM7YS5mcmFtZVNlcXVlbmNlcj0wO2EuYXVkaW9RdWV1ZUluZGV4PTA7YS53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZT0xMzEwNzI7YS5zYXZlU3RhdGVTbG90PTY7cmV0dXJuIGF9KCksbT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkPWZ1bmN0aW9uKGIpe2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPQpwKGEuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQsYik7YS5pc0xjZEludGVycnVwdEVuYWJsZWQ9cChhLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0LGIpO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9cChhLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQ9cChhLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0LGIpO2EuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZT1ifTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZD1mdW5jdGlvbihiKXthLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPXAoYS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCxiKTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPXAoYS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCxiKTthLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9cChhLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD1wKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsCmIpO2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWJ9O2EuYXJlSW50ZXJydXB0c1BlbmRpbmc9ZnVuY3Rpb24oKXtyZXR1cm4gMDwoYS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmYS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtVKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEubWFzdGVySW50ZXJydXB0U3dpdGNoKTtVKDEwMjUrNTAqYS5zYXZlU3RhdGVTbG90LGEubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXkpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EubWFzdGVySW50ZXJydXB0U3dpdGNoPVYoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9VigxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKHgoYS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQpKTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZCh4KGEubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KSl9OwphLm1hc3RlckludGVycnVwdFN3aXRjaD0hMTthLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PSExO2EuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ9MDthLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0PTE7YS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0PTI7YS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdD00O2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkPTY1NTM1O2EuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZT0wO2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9ITE7YS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQ9ITE7YS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3Q9NjUyOTU7YS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9MDthLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPQohMTthLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPSExO2Euc2F2ZVN0YXRlU2xvdD0yO3JldHVybiBhfSgpLG49ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIDI1Nn07YS51cGRhdGVEaXZpZGVyUmVnaXN0ZXI9ZnVuY3Rpb24oYil7YS5kaXZpZGVyUmVnaXN0ZXI9MDtsKGEubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXIsMCk7YS5jeWNsZUNvdW50ZXI9MDthLnRpbWVyQ291bnRlcj1hLnRpbWVyTW9kdWxvfTthLnVwZGF0ZVRpbWVyQ291bnRlcj1mdW5jdGlvbihiKXthLnRpbWVyQ291bnRlcj1ifTthLnVwZGF0ZVRpbWVyTW9kdWxvPWZ1bmN0aW9uKGIpe2EudGltZXJNb2R1bG89Yn07YS51cGRhdGVUaW1lckNvbnRyb2w9ZnVuY3Rpb24oYyl7YS50aW1lckVuYWJsZWQ9cCgyLGMpO2lmKGEudGltZXJFbmFibGVkKXthLnRpbWVySW5wdXRDbG9jaz1jJjM7YS5jeWNsZUNvdW50ZXI9MDtjPTI1NjtiLkdCQ0RvdWJsZVNwZWVkJiYKKGM9NTEyKTtzd2l0Y2gobi50aW1lcklucHV0Q2xvY2spe2Nhc2UgMDpjPTEwMjQ7Yi5HQkNEb3VibGVTcGVlZCYmKGM9MjA0OCk7YnJlYWs7Y2FzZSAxOmM9MTY7Yi5HQkNEb3VibGVTcGVlZCYmKGM9MzIpO2JyZWFrO2Nhc2UgMjpjPTY0LGIuR0JDRG91YmxlU3BlZWQmJihjPTEyNil9YS5jdXJyZW50TWF4Q3ljbGVDb3VudD1jfX07YS5kaXZpZGVyUmVnaXN0ZXJNYXhDeWNsZUNvdW50PWZ1bmN0aW9uKCl7cmV0dXJuIDI1Nn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtoWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN5Y2xlQ291bnRlcjtoWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRNYXhDeWNsZUNvdW50O2hbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZGl2aWRlclJlZ2lzdGVyQ3ljbGVDb3VudGVyO2woYS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlcixhLmRpdmlkZXJSZWdpc3Rlcik7bChhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyLGEudGltZXJDb3VudGVyKX07CmEubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5jeWNsZUNvdW50ZXI9aFsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5jdXJyZW50TWF4Q3ljbGVDb3VudD1oWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmRpdmlkZXJSZWdpc3RlckN5Y2xlQ291bnRlcj1oWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XTthLmRpdmlkZXJSZWdpc3Rlcj14KGEubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXIpO2EudXBkYXRlVGltZXJDb3VudGVyKHgoYS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcikpO2EudXBkYXRlVGltZXJNb2R1bG8oeChhLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG8pKTthLnVwZGF0ZVRpbWVyQ29udHJvbCh4KGEubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2wpKX07YS5jdXJyZW50Q3ljbGVzPTA7YS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3Rlcj02NTI4NDthLmRpdmlkZXJSZWdpc3Rlcj0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI9NjUyODU7YS50aW1lckNvdW50ZXI9CjA7YS5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvPTY1Mjg2O2EudGltZXJNb2R1bG89MDthLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sPTY1Mjg3O2EudGltZXJFbmFibGVkPSExO2EudGltZXJJbnB1dENsb2NrPTA7YS5jeWNsZUNvdW50ZXI9MDthLmN1cnJlbnRNYXhDeWNsZUNvdW50PTI1NjthLmRpdmlkZXJSZWdpc3RlckN5Y2xlQ291bnRlcj0wO2Euc2F2ZVN0YXRlU2xvdD01O3JldHVybiBhfSgpLEE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSm95cGFkPWZ1bmN0aW9uKGIpe2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPWJeMjU1O2EuaXNEcGFkVHlwZT1wKDQsYS5qb3lwYWRSZWdpc3RlckZsaXBwZWQpO2EuaXNCdXR0b25UeXBlPXAoNSxhLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EudXBkYXRlSm95cGFkKHgoYS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyKSl9OwphLnVwPSExO2EuZG93bj0hMTthLmxlZnQ9ITE7YS5yaWdodD0hMTthLmE9ITE7YS5iPSExO2Euc2VsZWN0PSExO2Euc3RhcnQ9ITE7YS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyPTY1MjgwO2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPTA7YS5pc0RwYWRUeXBlPSExO2EuaXNCdXR0b25UeXBlPSExO2Euc2F2ZVN0YXRlU2xvdD0zO3JldHVybiBhfSgpLEU9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTGNkQ29udHJvbD1mdW5jdGlvbihiKXthLmVuYWJsZWQ9cCg3LGIpO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9cCg2LGIpO2Eud2luZG93RGlzcGxheUVuYWJsZWQ9cCg1LGIpO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD1wKDQsYik7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PXAoMyxiKTthLnRhbGxTcHJpdGVTaXplPXAoMixiKTthLnNwcml0ZURpc3BsYXlFbmFibGU9cCgxLGIpO2EuYmdEaXNwbGF5RW5hYmxlZD1wKDAsYil9O2EubWVtb3J5TG9jYXRpb25MY2RTdGF0dXM9CjY1MzQ1O2EuY3VycmVudExjZE1vZGU9MDthLm1lbW9yeUxvY2F0aW9uQ29pbmNpZGVuY2VDb21wYXJlPTY1MzQ5O2EuY29pbmNpZGVuY2VDb21wYXJlPTA7YS5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2w9NjUzNDQ7YS5lbmFibGVkPSEwO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS53aW5kb3dEaXNwbGF5RW5hYmxlZD0hMTthLmJnV2luZG93VGlsZURhdGFTZWxlY3Q9ITE7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PSExO2EudGFsbFNwcml0ZVNpemU9ITE7YS5zcHJpdGVEaXNwbGF5RW5hYmxlPSExO2EuYmdEaXNwbGF5RW5hYmxlZD0hMTtyZXR1cm4gYX0oKSxyPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBhLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCl9O2EuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkU9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD85MTI6NDU2fTthLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERT0KZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD83NTI6Mzc2fTthLk1JTl9DWUNMRVNfVFJBTlNGRVJfREFUQV9MQ0RfTU9ERT1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzQ5ODoyNDl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7aFsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zY2FubGluZUN5Y2xlQ291bnRlcjtoWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1FLmN1cnJlbnRMY2RNb2RlO2woYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIsYS5zY2FubGluZVJlZ2lzdGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnNjYW5saW5lQ3ljbGVDb3VudGVyPWhbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO0UuY3VycmVudExjZE1vZGU9aFsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zY2FubGluZVJlZ2lzdGVyPXgoYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpO0UudXBkYXRlTGNkQ29udHJvbCh4KEUubWVtb3J5TG9jYXRpb25MY2RDb250cm9sKSl9OwphLmN1cnJlbnRDeWNsZXM9MDthLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXI9NjUzNDg7YS5zY2FubGluZVJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyPTY1MzUwO2EubWVtb3J5TG9jYXRpb25TY3JvbGxYPTY1MzQ3O2Euc2Nyb2xsWD0wO2EubWVtb3J5TG9jYXRpb25TY3JvbGxZPTY1MzQ2O2Euc2Nyb2xsWT0wO2EubWVtb3J5TG9jYXRpb25XaW5kb3dYPTY1MzU1O2Eud2luZG93WD0wO2EubWVtb3J5TG9jYXRpb25XaW5kb3dZPTY1MzU0O2Eud2luZG93WT0wO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0PTM4OTEyO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQ9Mzk5MzY7YS5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0PTM0ODE2O2EubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0PTMyNzY4O2EubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGU9CjY1MDI0O2EubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZT02NTM1MTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZT02NTM1MjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bz02NTM1MzthLnNhdmVTdGF0ZVNsb3Q9MTtyZXR1cm4gYX0oKSxkPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2hbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudFJvbUJhbms7aFsxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50UmFtQmFuaztVKDEwMjgrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNSYW1CYW5raW5nRW5hYmxlZCk7VSgxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDMVJvbU1vZGVFbmFibGVkKTtVKDEwMzArNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNSb21Pbmx5KTtVKDEwMzErNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMxKTtVKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMyKTsKVSgxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDMyk7VSgxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDNSl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5jdXJyZW50Um9tQmFuaz1oWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmN1cnJlbnRSYW1CYW5rPWhbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNSYW1CYW5raW5nRW5hYmxlZD1WKDEwMjgrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPVYoMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNSb21Pbmx5PVYoMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxPVYoMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMyPVYoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMzPVYoMTAzMys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkM1PVYoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLmNhcnRyaWRnZVJvbUxvY2F0aW9uPTA7YS5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb249CjE2Mzg0O2EudmlkZW9SYW1Mb2NhdGlvbj0zMjc2ODthLmNhcnRyaWRnZVJhbUxvY2F0aW9uPTQwOTYwO2EuaW50ZXJuYWxSYW1CYW5rWmVyb0xvY2F0aW9uPTQ5MTUyO2EuaW50ZXJuYWxSYW1CYW5rT25lTG9jYXRpb249NTMyNDg7YS5lY2hvUmFtTG9jYXRpb249NTczNDQ7YS5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb249NjUwMjQ7YS5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQ9NjUxODM7YS51bnVzYWJsZU1lbW9yeUxvY2F0aW9uPTY1MTg0O2EudW51c2FibGVNZW1vcnlFbmRMb2NhdGlvbj02NTI3OTthLmN1cnJlbnRSb21CYW5rPTA7YS5jdXJyZW50UmFtQmFuaz0wO2EuaXNSYW1CYW5raW5nRW5hYmxlZD0hMTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPSEwO2EuaXNSb21Pbmx5PSEwO2EuaXNNQkMxPSExO2EuaXNNQkMyPSExO2EuaXNNQkMzPSExO2EuaXNNQkM1PSExO2EubWVtb3J5TG9jYXRpb25IZG1hU291cmNlSGlnaD02NTM2MTthLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdz0KNjUzNjI7YS5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkhpZ2g9NjUzNjM7YS5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkxvdz02NTM2NDthLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXI9NjUzNjU7YS5ETUFDeWNsZXM9MDthLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMTthLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz0wO2EuaGJsYW5rSGRtYVNvdXJjZT0wO2EuaGJsYW5rSGRtYURlc3RpbmF0aW9uPTA7YS5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rPTY1MzU5O2EubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaz02NTM5MjthLnNhdmVTdGF0ZVNsb3Q9NDtyZXR1cm4gYX0oKSxiPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLkNMT0NLX1NQRUVEPWZ1bmN0aW9uKCl7cmV0dXJuIGEuR0JDRG91YmxlU3BlZWQ/ODM4ODYwODo0MTk0MzA0fTthLk1BWF9DWUNMRVNfUEVSX0ZSQU1FPWZ1bmN0aW9uKCl7cmV0dXJuIGEuR0JDRG91YmxlU3BlZWQ/MTQwNDQ4Ogo3MDIyNH07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtoWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQTtoWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQjtoWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQztoWzEwMjcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRDtoWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRTtoWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVySDtoWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyTDtoWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRjtoWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN0YWNrUG9pbnRlcjtoWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnByb2dyYW1Db3VudGVyO2hbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztVKDEwNDErNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNIYWx0ZWQpOwpVKDEwNDIrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNTdG9wcGVkKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnJlZ2lzdGVyQT1oWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyQj1oWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyQz1oWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyRD1oWzEwMjcrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyRT1oWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVySD1oWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyTD1oWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyRj1oWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XTthLnN0YWNrUG9pbnRlcj1oWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XTthLnByb2dyYW1Db3VudGVyPWhbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudEN5Y2xlcz1oWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XTsKYS5pc0hhbHRlZD1WKDEwNDErNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzU3RvcHBlZD1WKDEwNDIrNTAqYS5zYXZlU3RhdGVTbG90KX07YS5HQkNFbmFibGVkPSExO2EuR0JDRG91YmxlU3BlZWQ9ITE7YS5yZWdpc3RlckE9MDthLnJlZ2lzdGVyQj0wO2EucmVnaXN0ZXJDPTA7YS5yZWdpc3RlckQ9MDthLnJlZ2lzdGVyRT0wO2EucmVnaXN0ZXJIPTA7YS5yZWdpc3Rlckw9MDthLnJlZ2lzdGVyRj0wO2Euc3RhY2tQb2ludGVyPTA7YS5wcm9ncmFtQ291bnRlcj0wO2EuY3VycmVudEN5Y2xlcz0wO2EuaXNIYWx0ZWQ9ITE7YS5pc1N0b3BwZWQ9ITE7YS5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoPTY1MzU3O2Euc2F2ZVN0YXRlU2xvdD0wO3JldHVybiBhfSgpOzEzOT5CYS5zaXplKCkmJkJhLmdyb3coMTM5LUJhLnNpemUoKSk7dmFyIHphPSExLE5iPU9iamVjdC5mcmVlemUoe21lbW9yeTpCYSxjb25maWc6ZnVuY3Rpb24oYSxjLGYsaCxrLGcscCxtLHEpe1MuZW5hYmxlQm9vdFJvbT0wPAphPyEwOiExO1MudXNlR2JjV2hlbkF2YWlsYWJsZT0wPGM/ITA6ITE7Uy5hdWRpb0JhdGNoUHJvY2Vzc2luZz0wPGY/ITA6ITE7Uy5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0wPGg/ITA6ITE7Uy50aW1lcnNCYXRjaFByb2Nlc3Npbmc9MDxrPyEwOiExO1MuZ3JhcGhpY3NEaXNhYmxlU2NhbmxpbmVSZW5kZXJpbmc9MDxnPyEwOiExO1MuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0wPHA/ITA6ITE7Uy50aWxlUmVuZGVyaW5nPTA8bT8hMDohMTtTLnRpbGVDYWNoaW5nPTA8cT8hMDohMTthPXgoMzIzKTtiLkdCQ0VuYWJsZWQ9MTkyPT09YXx8Uy51c2VHYmNXaGVuQXZhaWxhYmxlJiYxMjg9PT1hPyEwOiExO2IuR0JDRG91YmxlU3BlZWQ9ITE7Yi5yZWdpc3RlckE9MDtiLnJlZ2lzdGVyQj0wO2IucmVnaXN0ZXJDPTA7Yi5yZWdpc3RlckQ9MDtiLnJlZ2lzdGVyRT0wO2IucmVnaXN0ZXJIPTA7Yi5yZWdpc3Rlckw9MDtiLnJlZ2lzdGVyRj0wO2Iuc3RhY2tQb2ludGVyPTA7Yi5wcm9ncmFtQ291bnRlcj0KMDtiLmN1cnJlbnRDeWNsZXM9MDtiLmlzSGFsdGVkPSExO2IuaXNTdG9wcGVkPSExO2IuR0JDRW5hYmxlZD8oYi5yZWdpc3RlckE9MTcsYi5yZWdpc3RlckY9MTI4LGIucmVnaXN0ZXJCPTAsYi5yZWdpc3RlckM9MCxiLnJlZ2lzdGVyRD0yNTUsYi5yZWdpc3RlckU9ODYsYi5yZWdpc3Rlckg9MCxiLnJlZ2lzdGVyTD0xMyk6KGIucmVnaXN0ZXJBPTEsYi5yZWdpc3RlckY9MTc2LGIucmVnaXN0ZXJCPTAsYi5yZWdpc3RlckM9MTksYi5yZWdpc3RlckQ9MCxiLnJlZ2lzdGVyRT0yMTYsYi5yZWdpc3Rlckg9MSxiLnJlZ2lzdGVyTD03Nyk7Yi5wcm9ncmFtQ291bnRlcj0yNTY7Yi5zdGFja1BvaW50ZXI9NjU1MzQ7ZC5pc1JhbUJhbmtpbmdFbmFibGVkPSExO2QuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA7YT14KDMyNyk7ZC5pc1JvbU9ubHk9ITE7ZC5pc01CQzE9ITE7ZC5pc01CQzI9ITE7ZC5pc01CQzM9ITE7ZC5pc01CQzU9ITE7MD09PWE/ZC5pc1JvbU9ubHk9ITA6MTw9YSYmMz49YT9kLmlzTUJDMT0KITA6NTw9YSYmNj49YT9kLmlzTUJDMj0hMDoxNTw9YSYmMTk+PWE/ZC5pc01CQzM9ITA6MjU8PWEmJjMwPj1hJiYoZC5pc01CQzU9ITApO2QuY3VycmVudFJvbUJhbms9MTtkLmN1cnJlbnRSYW1CYW5rPTA7bCg2NTM2MSwyNTUpO2woNjUzNjIsMjU1KTtsKDY1MzYzLDI1NSk7bCg2NTM2NCwyNTUpO2woNjUzNjUsMjU1KTtyLmN1cnJlbnRDeWNsZXM9MDtyLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7ci5zY2FubGluZVJlZ2lzdGVyPTA7ci5zY3JvbGxYPTA7ci5zY3JvbGxZPTA7ci53aW5kb3dYPTA7ci53aW5kb3dZPTA7Yi5HQkNFbmFibGVkPyhyLnNjYW5saW5lUmVnaXN0ZXI9MTQ1LGwoNjUzNDQsMTQ1KSxsKDY1MzQ1LDEyOSksbCg2NTM0OCwxNDQpLGwoNjUzNTEsMjUyKSk6KHIuc2NhbmxpbmVSZWdpc3Rlcj0xNDUsbCg2NTM0NCwxNDUpLGwoNjUzNDUsMTMzKSxsKDY1MzUwLDI1NSksbCg2NTM1MSwyNTIpLGwoNjUzNTIsMjU1KSxsKDY1MzUzLDI1NSkpO2woNjUzNTksMCk7bCg2NTM5MiwKMSk7Yi5HQkNFbmFibGVkPyhsKDY1Mzg0LDE5MiksbCg2NTM4NSwyNTUpLGwoNjUzODYsMTkzKSxsKDY1Mzg3LDEzKSk6KGwoNjUzODQsMjU1KSxsKDY1Mzg1LDI1NSksbCg2NTM4NiwyNTUpLGwoNjUzODcsMjU1KSk7ZS5jdXJyZW50Q3ljbGVzPTA7ZS5OUjUwTGVmdE1peGVyVm9sdW1lPTA7ZS5OUjUwUmlnaHRNaXhlclZvbHVtZT0wO2UuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD0hMDtlLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7ZS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2UuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD0KITA7ZS5OUjUySXNTb3VuZEVuYWJsZWQ9ITA7ZS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPTA7ZS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPTA7ZS5mcmFtZVNlcXVlbmNlcj0wO2UuYXVkaW9RdWV1ZUluZGV4PTA7ei5pbml0aWFsaXplKCk7Sy5pbml0aWFsaXplKCk7SS5pbml0aWFsaXplKCk7TC5pbml0aWFsaXplKCk7bChlLm1lbW9yeUxvY2F0aW9uTlI1MCwxMTkpO2woZS5tZW1vcnlMb2NhdGlvbk5SNTEsMjQzKTtsKGUubWVtb3J5TG9jYXRpb25OUjUyLDI0MSk7dS5jaGFubmVsMVNhbXBsZT0xNTt1LmNoYW5uZWwyU2FtcGxlPTE1O3UuY2hhbm5lbDNTYW1wbGU9MTU7dS5jaGFubmVsNFNhbXBsZT0xNTt1LmNoYW5uZWwxRGFjRW5hYmxlZD0hMTt1LmNoYW5uZWwyRGFjRW5hYmxlZD0hMTt1LmNoYW5uZWwzRGFjRW5hYmxlZD0hMTt1LmNoYW5uZWw0RGFjRW5hYmxlZD0hMTt1LmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzt1LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0KMTI3O3UubWl4ZXJWb2x1bWVDaGFuZ2VkPSEwO3UubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMDt1Lm5lZWRUb1JlbWl4U2FtcGxlcz0hMTtuLmN1cnJlbnRDeWNsZXM9MDtuLmRpdmlkZXJSZWdpc3Rlcj0wO24udGltZXJDb3VudGVyPTA7bi50aW1lck1vZHVsbz0wO24udGltZXJFbmFibGVkPSExO24udGltZXJJbnB1dENsb2NrPTA7bi5jeWNsZUNvdW50ZXI9MDtuLmRpdmlkZXJSZWdpc3RlckN5Y2xlQ291bnRlcj0wO2IuR0JDRW5hYmxlZD8obCg2NTI4NCw0Nyksbi5kaXZpZGVyUmVnaXN0ZXI9NDcpOihsKDY1Mjg0LDE3MSksbi5kaXZpZGVyUmVnaXN0ZXI9MTcxKTtsKDY1Mjg3LDI0OCk7bi51cGRhdGVUaW1lckNvbnRyb2woMjQ4KTtiLkdCQ0VuYWJsZWQ/KGwoNjUzOTIsMjQ4KSxsKDY1MzU5LDI1NCksbCg2NTM1NywxMjYpLGwoNjUyODAsMjA3KSxsKDY1MjgyLDEyNCksbCg2NTI5NSwyMjUpLGwoNjUzODgsMjU0KSxsKDY1Mzk3LDE0MykpOihsKDY1MzkyLDI1NSksbCg2NTM1OSwyNTUpLApsKDY1MzU3LDI1NSksbCg2NTI4MCwyMDcpLGwoNjUyODIsMTI2KSxsKDY1Mjk1LDIyNSkpO3phPSExfSxleGVjdXRlRnJhbWU6bGIsZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbzpmdW5jdGlvbihhKXt2YXIgYz0hMSxkPTEwMjQ7Zm9yKGEmJjA8YSYmKGQ9YSk7IWMmJmIuY3VycmVudEN5Y2xlczxiLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCkmJkthKCk8ZDspYT1NYSgpLDA+YSYmKGM9ITApO2lmKGIuY3VycmVudEN5Y2xlcz49Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpKXJldHVybiBiLmN1cnJlbnRDeWNsZXMtPWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKSwwO2lmKEthKCk+PWQpcmV0dXJuIDE7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyLTEmNjU1MzU7cmV0dXJuLTF9LGV4ZWN1dGVTdGVwOk1hLHNhdmVTdGF0ZTpmdW5jdGlvbigpe2Iuc2F2ZVN0YXRlKCk7ci5zYXZlU3RhdGUoKTttLnNhdmVTdGF0ZSgpO0Euc2F2ZVN0YXRlKCk7ZC5zYXZlU3RhdGUoKTtuLnNhdmVTdGF0ZSgpOwplLnNhdmVTdGF0ZSgpO3ouc2F2ZVN0YXRlKCk7Sy5zYXZlU3RhdGUoKTtJLnNhdmVTdGF0ZSgpO0wuc2F2ZVN0YXRlKCk7emE9ITF9LGxvYWRTdGF0ZTpmdW5jdGlvbigpe2IubG9hZFN0YXRlKCk7ci5sb2FkU3RhdGUoKTttLmxvYWRTdGF0ZSgpO0EubG9hZFN0YXRlKCk7ZC5sb2FkU3RhdGUoKTtuLmxvYWRTdGF0ZSgpO2UubG9hZFN0YXRlKCk7ei5sb2FkU3RhdGUoKTtLLmxvYWRTdGF0ZSgpO0kubG9hZFN0YXRlKCk7TC5sb2FkU3RhdGUoKTt6YT0hMX0saGFzQ29yZVN0YXJ0ZWQ6ZnVuY3Rpb24oKXtyZXR1cm4gemE/MTowfSxzZXRKb3lwYWRTdGF0ZTpmdW5jdGlvbihhLGIsZCxlLGgsbCxrLGcpezA8YT9wYSgwKTpjYSgwLCExKTswPGI/cGEoMSk6Y2EoMSwhMSk7MDxkP3BhKDIpOmNhKDIsITEpOzA8ZT9wYSgzKTpjYSgzLCExKTswPGg/cGEoNCk6Y2EoNCwhMSk7MDxsP3BhKDUpOmNhKDUsITEpOzA8az9wYSg2KTpjYSg2LCExKTswPGc/cGEoNyk6Y2EoNywhMSl9LGdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXI6S2EsCmNsZWFyQXVkaW9CdWZmZXI6UWEsV0FTTUJPWV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX01FTU9SWV9TSVpFOjkxMDk1MDQsV0FTTUJPWV9XQVNNX1BBR0VTOjEzOSxBU1NFTUJMWVNDUklQVF9NRU1PUllfTE9DQVRJT046MCxBU1NFTUJMWVNDUklQVF9NRU1PUllfU0laRToxMDI0LFdBU01CT1lfU1RBVEVfTE9DQVRJT046MTAyNCxXQVNNQk9ZX1NUQVRFX1NJWkU6MTAyNCxHQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjoyMDQ4LEdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6NjU1MzUsVklERU9fUkFNX0xPQ0FUSU9OOjIwNDgsVklERU9fUkFNX1NJWkU6MTYzODQsV09SS19SQU1fTE9DQVRJT046MTg0MzIsV09SS19SQU1fU0laRTozMjc2OCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjo1MTIwMCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjE2Mzg0LEdSQVBISUNTX09VVFBVVF9MT0NBVElPTjo2NzU4NCxHUkFQSElDU19PVVRQVVRfU0laRTo1MjEyMTYsCkdCQ19QQUxFVFRFX0xPQ0FUSU9OOjY3NTg0LEdCQ19QQUxFVFRFX1NJWkU6NTEyLEJHX1BSSU9SSVRZX01BUF9MT0NBVElPTjo2OTYzMixCR19QUklPUklUWV9NQVBfU0laRToyMzU1MixGUkFNRV9MT0NBVElPTjo5MzE4NCxGUkFNRV9TSVpFOjkzMTg0LEJBQ0tHUk9VTkRfTUFQX0xPQ0FUSU9OOjIzMjQ0OCxCQUNLR1JPVU5EX01BUF9TSVpFOjE5NjYwOCxUSUxFX0RBVEFfTE9DQVRJT046NDI5MDU2LFRJTEVfREFUQV9TSVpFOjE0NzQ1NixPQU1fVElMRVNfTE9DQVRJT046NTc2NTEyLE9BTV9USUxFU19TSVpFOjEyMjg4LEFVRElPX0JVRkZFUl9MT0NBVElPTjo1ODg4MDAsQVVESU9fQlVGRkVSX1NJWkU6MTMxMDcyLENBUlRSSURHRV9SQU1fTE9DQVRJT046NzE5ODcyLENBUlRSSURHRV9SQU1fU0laRToxMzEwNzIsQ0FSVFJJREdFX1JPTV9MT0NBVElPTjo4NTA5NDQsQ0FSVFJJREdFX1JPTV9TSVpFOjgyNTg1NjAsZ2V0V2FzbUJveU9mZnNldEZyb21HYW1lQm95T2Zmc2V0OlNhLApnZXRSZWdpc3RlckE6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckF9LGdldFJlZ2lzdGVyQjpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQn0sZ2V0UmVnaXN0ZXJDOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJDfSxnZXRSZWdpc3RlckQ6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckR9LGdldFJlZ2lzdGVyRTpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRX0sZ2V0UmVnaXN0ZXJIOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJIfSxnZXRSZWdpc3Rlckw6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3Rlckx9LGdldFJlZ2lzdGVyRjpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRn0sZ2V0UHJvZ3JhbUNvdW50ZXI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5wcm9ncmFtQ291bnRlcn0sZ2V0U3RhY2tQb2ludGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIuc3RhY2tQb2ludGVyfSxnZXRPcGNvZGVBdFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIHgoYi5wcm9ncmFtQ291bnRlcil9LApkcmF3QmFja2dyb3VuZE1hcFRvV2FzbU1lbW9yeTpmdW5jdGlvbihhKXt2b2lkIDA9PT1hJiYoYT0wKTt2YXIgYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ7RS5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0JiYoYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCk7dmFyIGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7RS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTtmb3IodmFyIGU9MDsyNTY+ZTtlKyspZm9yKHZhciBsPTA7MjU2Pmw7bCsrKXt2YXIgaz1lLGc9bCxtPWQrMzIqKGs+PjMpKyhnPj4zKSxuPVgobSwwKTtuPXZhKGMsbik7dmFyIHE9ayU4O2s9ZyU4O2s9Ny1rO2c9MDtiLkdCQ0VuYWJsZWQmJjA8YSYmKGc9WChtLDEpKTtwKDYsZykmJihxPTctcSk7dmFyIHU9MDtwKDMsZykmJih1PTEpO209WChuKzIqcSx1KTtuPVgobisyKnErCjEsdSk7cT0wO3AoayxuKSYmKHErPTEscTw8PTEpO3AoayxtKSYmKHErPTEpO249MyooMjU2KmUrbCk7aWYoYi5HQkNFbmFibGVkJiYwPGEpZz1HYShnJjcscSwhMSksaz1hYSgwLGcpLG09YWEoMSxnKSxxPWFhKDIsZyksZz0yMzI0NDgrbixoW2ddPWssaFtnKzFdPW0saFtnKzJdPXE7ZWxzZSBmb3Ioaz1GYShxLHIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksbT0wOzM+bTttKyspZz0yMzI0NDgrbittLGhbZ109a319LGRyYXdUaWxlRGF0YVRvV2FzbU1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzIzPmE7YSsrKWZvcih2YXIgYj0wOzMxPmI7YisrKXt2YXIgZD0wOzE1PGImJihkPTEpO3ZhciBlPWE7MTU8YSYmKGUtPTE1KTtlPDw9NDtlPTE1PGI/ZSsoYi0xNSk6ZStiO3ZhciBoPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0OzE1PGEmJihoPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCk7Zm9yKHZhciBnPTA7OD4KZztnKyspWmEoZSxoLGQsMCw3LGcsOCpiLDgqYStnLDI0OCw0MjkwNTYsITApfX0sdXBkYXRlOmxiLGVtdWxhdGlvblN0ZXA6TWEsZ2V0QXVkaW9RdWV1ZUluZGV4OkthLHJlc2V0QXVkaW9RdWV1ZTpRYSx3YXNtTWVtb3J5U2l6ZTo5MTA5NTA0LHdhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb246MTAyNCx3YXNtQm95SW50ZXJuYWxTdGF0ZVNpemU6MTAyNCxnYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbjoyMDQ4LGdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemU6NjU1MzUsdmlkZW9PdXRwdXRMb2NhdGlvbjo2NzU4NCxmcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uOjkzMTg0LGdhbWVib3lDb2xvclBhbGV0dGVMb2NhdGlvbjo2NzU4NCxnYW1lYm95Q29sb3JQYWxldHRlU2l6ZTo1MTIsYmFja2dyb3VuZE1hcExvY2F0aW9uOjIzMjQ0OCx0aWxlRGF0YU1hcDo0MjkwNTYsc291bmRPdXRwdXRMb2NhdGlvbjo1ODg4MDAsZ2FtZUJ5dGVzTG9jYXRpb246ODUwOTQ0LGdhbWVSYW1CYW5rc0xvY2F0aW9uOjcxOTg3Mn0pOwpjb25zdCBPYj1hc3luYygpPT4oe2luc3RhbmNlOntleHBvcnRzOk5ifSxieXRlTWVtb3J5OkJhLndhc21CeXRlTWVtb3J5LHR5cGU6IlR5cGVTY3JpcHQifSk7bGV0IEFhLG9iLHY7dj17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCwKV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxmcmFtZVNraXBDb3VudGVyOjAsY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kczowLG1lc3NhZ2VIYW5kbGVyOihhKT0+e2NvbnN0IGI9dGEoYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIEMuQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPyh2LmdyYXBoaWNzV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sdWEocmIuYmluZCh2b2lkIDAsdiksdi5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8odi5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx1YSh1Yi5iaW5kKHZvaWQgMCx2KSx2Lm1lbW9yeVdvcmtlclBvcnQpKToKIkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyh2LmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx1YSh0Yi5iaW5kKHZvaWQgMCx2KSx2LmNvbnRyb2xsZXJXb3JrZXJQb3J0KSk6IkFVRElPIj09PWIubWVzc2FnZS53b3JrZXJJZCYmKHYuYXVkaW9Xb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSx1YShzYi5iaW5kKHZvaWQgMCx2KSx2LmF1ZGlvV29ya2VyUG9ydCkpO1ooTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEMuSU5TVEFOVElBVEVfV0FTTTooYXN5bmMoKT0+e2xldCBhO2E9YXdhaXQgT2IoKTt2Lndhc21JbnN0YW5jZT1hLmluc3RhbmNlO3Yud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O1ooTih7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgQy5DT05GSUc6di53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkodixiLm1lc3NhZ2UuY29uZmlnKTt2Lm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ClooTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEMuUkVTRVRfQVVESU9fUVVFVUU6di53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKTtaKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLlBMQVk6aWYoIXYucGF1c2VkfHwhdi53YXNtSW5zdGFuY2V8fCF2Lndhc21CeXRlTWVtb3J5KXtaKE4oe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfXYucGF1c2VkPSExO3YuZnBzVGltZVN0YW1wcz1bXTt2LmZyYW1lU2tpcENvdW50ZXI9MDt2LmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtwYih2LDFFMy92Lm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7bWIodik7WihOKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5QQVVTRTp2LnBhdXNlZD0hMDt2LnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KHYudXBkYXRlSWQpLHYudXBkYXRlSWQ9dm9pZCAwKTtaKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBDLlJVTl9XQVNNX0VYUE9SVDphPQpiLm1lc3NhZ2UucGFyYW1ldGVycz92Lndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdLmFwcGx5KHZvaWQgMCxiLm1lc3NhZ2UucGFyYW1ldGVycyk6di53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XSgpO1ooTih7dHlwZTpDLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQy5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBjPXYud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoYz1iLm1lc3NhZ2UuZW5kKTthPXYud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxjKS5idWZmZXI7WihOKHt0eXBlOkMuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgQy5HRVRfV0FTTV9DT05TVEFOVDpaKE4oe3R5cGU6Qy5HRVRfV0FTTV9DT05TVEFOVCxyZXNwb25zZTp2Lndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSwKYi5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGIpfX0sZ2V0RlBTOigpPT4wPHYudGltZVN0YW1wc1VudGlsUmVhZHk/di5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU6di5mcHNUaW1lU3RhbXBzP3YuZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07dWEodi5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

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

  return exports;

}({}));
//# sourceMappingURL=wasmboy.ts.iife.js.map
