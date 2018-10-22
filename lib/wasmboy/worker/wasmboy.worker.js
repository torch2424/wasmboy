// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

// Using transferables: https://stackoverflow.com/questions/16071211/using-transferable-objects-from-a-web-worker

import { postMessage, onMessage } from '../../worker/workerapi';
import { WORKER_MESSAGE_TYPE, WORKER_ID } from '../../worker/constants';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';

// Post message handlers
import { graphicsWorkerOnMessage } from './graphics/onmessage';
import { audioWorkerOnMessage } from './audio/onmessage';
import { controllerWorkerOnMessage } from './controller/onmessage';
import { memoryWorkerOnMessage } from './memory/onmessage';

// Working the emalator
import { instantiateWasm } from './instantiate';
import { update } from './update';

// Timestamps
import { waitForTimeStampsForFrameRate } from './timestamp';

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
  timeStampsUntilReady: 0,
  fpsTimeStamps: [],

  // Frame Skipping
  frameSkipCounter: 0,

  // Audio latency
  currentAudioLatencyInSeconds: 0,

  // Message Handler from the main thread
  messageHandler: event => {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.CONNECT: {
        // Assign our worker ports on connect
        if (eventData.message.workerId === WORKER_ID.GRAPHICS) {
          libWorker.graphicsWorkerPort = event.ports[0];
          onMessage(graphicsWorkerOnMessage.bind(this, libWorker), libWorker.graphicsWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.MEMORY) {
          libWorker.memoryWorkerPort = event.ports[0];
          onMessage(memoryWorkerOnMessage.bind(this, libWorker), libWorker.memoryWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.CONTROLLER) {
          libWorker.controllerWorkerPort = event.ports[0];
          onMessage(controllerWorkerOnMessage.bind(this, libWorker), libWorker.controllerWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.AUDIO) {
          libWorker.audioWorkerPort = event.ports[0];
          onMessage(audioWorkerOnMessage.bind(this, libWorker), libWorker.audioWorkerPort);
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
        libWorker.frameSkipCounter = 0;
        libWorker.currentAudioLatencyInSeconds = 0;
        if (!libWorker.updateId) {
          // 1000 / 60 = 60fps
          // Add one to the framerate, as we would rather be slightly faster,
          // than slightly slower
          const intervalRate = 1000 / libWorker.options.gameboyFrameRate;
          update(libWorker, intervalRate);
        }
        waitForTimeStampsForFrameRate(libWorker);
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

  // Function to return the current FPS
  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  getFPS: () => {
    if (libWorker.timeStampsUntilReady > 0) {
      return libWorker.options.gameboyFrameRate;
    } else if (libWorker.fpsTimeStamps) {
      return libWorker.fpsTimeStamps.length;
    }

    return 0;
  }
};

// Assign the worker a message handler
onMessage(libWorker.messageHandler);
