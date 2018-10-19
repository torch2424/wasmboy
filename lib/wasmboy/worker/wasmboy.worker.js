// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

// Using transferables: https://stackoverflow.com/questions/16071211/using-transferable-objects-from-a-web-worker

import { postMessage, onMessage } from '../../worker/workerapi';
import { WORKER_MESSAGE_TYPE, WORKER_ID } from '../../worker/constants';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { instantiateWasm } from './instantiate';
import { update } from './update';

// Our stateful object
// Representing our lib worker as a singleton
// Not using normal classes because:
// Class functions weren't working for some odd reason, and 'this' was getting wonky
let libWorker;
libWorker = {
  // Wasmboy Module Ports
  graphicsWorkerPort: undefined,
  memoryWorkerPort: undefined,
  controllerWorkerPort: undefined,
  audioWorkerPort: undefined,

  // Wasm Module Properties
  wasmInstance: undefined,
  wasmByteMemory: undefined,

  // Lib options
  options: undefined,

  // Some Constants from the wasm module
  WASMBOY_GAME_BYTES_LOCATION: 0,
  WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION: 0,
  WASMBOY_CURRENT_FRAME_SIZE: 0,
  WASMBOY_SOUND_OUTPUT_LOCATION: 0,

  // Playing state
  paused: true,

  // Our update setTimeout ref
  updateId: undefined,

  // Our fps timestamps
  pauseFpsThrottle: false,
  fpsTimeStamps: [],

  // Message Handler from the main thread
  messageHandler: event => {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.CONNECT: {
        // Assign our worker ports on connect
        if (eventData.message.workerId === WORKER_ID.GRAPHICS) {
          libWorker.graphicsWorkerPort = event.ports[0];
          onMessage(libWorker._graphicsMessageHandler, libWorker.graphicsWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.MEMORY) {
          libWorker.memoryWorkerPort = event.ports[0];
          onMessage(libWorker._memoryMessageHandler, libWorker.memoryWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.CONTROLLER) {
          libWorker.controllerWorkerPort = event.ports[0];
          onMessage(libWorker._controllerMessageHandler, libWorker.controllerWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.AUDIO) {
          libWorker.audioWorkerPort = event.ports[0];
          onMessage(libWorker._audioMessageHandler, libWorker.audioWorkerPort);
        }

        // Simply post back that we are ready
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      case WORKER_MESSAGE_TYPE.INSTANTIATE_WASM: {
        instantiateWasm(eventData.message.wasmModuleUrl).then(response => {
          libWorker.wasmInstance = response.wasmInstance;
          libWorker.wasmByteMemory = response.wasmByteMemory;
          postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        });
        return;
      }
      case WORKER_MESSAGE_TYPE.CONFIG: {
        // Config will come in as an array, pass in values using apply
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply
        const config = eventData.message.config;
        libWorker.wasmInstance.exports.config.apply(libWorker, config);
        libWorker.options = eventData.message.options;
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      case WORKER_MESSAGE_TYPE.RESET_AUDIO_QUEUE: {
        // Reset the audio queue index to stop weird pauses when trying to load a game
        libWorker.wasmInstance.exports.resetAudioQueue();
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      case WORKER_MESSAGE_TYPE.PLAY: {
        // Call our update
        libWorker.paused = false;
        libWorker.fpsTimeStamps = [];
        if (!libWorker.updateId) {
          update(libWorker, eventData.message.intervalRate);
        }
        libWorker.startPauseFpsThrottle();
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      case WORKER_MESSAGE_TYPE.PAUSE: {
        // Call our update
        libWorker.paused = true;
        if (libWorker.updateId) {
          clearTimeout(libWorker.updateId);
          libWorker.updateId = undefined;
        }
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      default: {
        //handle other messages from main
        console.log(eventData);
      }
    }
  },

  startPauseFpsThrottle: () => {
    // This will allow us to know if we just un paused
    libWorker.pauseFpsThrottle = true;
    setTimeout(() => {
      libWorker.pauseFpsThrottle = false;
    }, 1000);
  },

  // Function to return the current FPS
  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  getFPS: () => {
    if (libWorker.pauseFpsThrottle) {
      return libWorker.options.gameboyFrameRate;
    } else if (libWorker.fpsTimeStamps) {
      return libWorker.fpsTimeStamps.length;
    }

    return 0;
  },

  _graphicsMessageHandler: event => {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
        libWorker.WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = libWorker.wasmInstance.exports.frameInProgressVideoOutputLocation.valueOf();
        libWorker.WASMBOY_CURRENT_FRAME_SIZE = libWorker.wasmInstance.exports.FRAME_SIZE.valueOf();
        // Forward to our lib worker
        libWorker.graphicsWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
              WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION: libWorker.wasmInstance.exports.frameInProgressVideoOutputLocation.valueOf()
            },
            eventData.messageId
          )
        );
        return;
      }
    }
  },

  _memoryMessageHandler: event => {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.CLEAR_MEMORY: {
        // Clear Wasm memory
        // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
        for (let i = 0; i <= libWorker.wasmByteMemory.length; i++) {
          libWorker.wasmByteMemory[i] = 0;
        }

        libWorker.memoryWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY_DONE,
              wasmByteMemory: libWorker.wasmByteMemory.buffer
            },
            eventData.messageId
          ),
          [libWorker.wasmByteMemory.buffer]
        );
        return;
      }

      case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
        libWorker.WASMBOY_GAME_BYTES_LOCATION = libWorker.wasmInstance.exports.gameBytesLocation.valueOf();

        // Forward to our lib worker
        libWorker.memoryWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
              WASMBOY_GAME_BYTES_LOCATION: libWorker.wasmInstance.exports.gameBytesLocation.valueOf(),
              WASMBOY_GAME_RAM_BANKS_LOCATION: libWorker.wasmInstance.exports.gameRamBanksLocation.valueOf(),
              WASMBOY_INTERNAL_STATE_SIZE: libWorker.wasmInstance.exports.wasmBoyInternalStateSize.valueOf(),
              WASMBOY_INTERNAL_STATE_LOCATION: libWorker.wasmInstance.exports.wasmBoyInternalStateLocation.valueOf(),
              WASMBOY_INTERNAL_MEMORY_SIZE: libWorker.wasmInstance.exports.gameBoyInternalMemorySize.valueOf(),
              WASMBOY_INTERNAL_MEMORY_LOCATION: libWorker.wasmInstance.exports.gameBoyInternalMemoryLocation.valueOf(),
              WASMBOY_PALETTE_MEMORY_SIZE: libWorker.wasmInstance.exports.gameboyColorPaletteSize.valueOf(),
              WASMBOY_PALETTE_MEMORY_LOCATION: libWorker.wasmInstance.exports.gameboyColorPaletteLocation.valueOf()
            },
            eventData.messageId
          )
        );
        return;
      }
      case WORKER_MESSAGE_TYPE.LOAD_ROM: {
        // Load the game data into actual memory
        libWorker.wasmByteMemory.set(new Uint8Array(eventData.message.ROM), libWorker.WASMBOY_GAME_BYTES_LOCATION);

        // Forward to our lib worker
        libWorker.memoryWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.LOAD_ROM_DONE,
              wasmByteMemory: libWorker.wasmByteMemory.buffer
            },
            eventData.messageId
          ),
          [libWorker.wasmByteMemory.buffer]
        );
        return;
      }
    }
  },

  _controllerMessageHandler: event => {},

  _audioMessageHandler: event => {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
        libWorker.WASMBOY_SOUND_OUTPUT_LOCATION = libWorker.wasmInstance.exports.soundOutputLocation.valueOf();
        // Forward to our lib worker
        libWorker.audioWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
              WASMBOY_SOUND_OUTPUT_LOCATION: libWorker.wasmInstance.exports.soundOutputLocation.valueOf()
            },
            eventData.messageId
          )
        );
        return;
      }
    }
  }
};

// Assign the worker a message handler
onMessage(libWorker.messageHandler);
