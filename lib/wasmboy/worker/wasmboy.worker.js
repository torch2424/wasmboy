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
// https://stackoverflow.com/questions/37490040/why-does-my-es6-using-babel-class-say-this-is-undefined-in-an-instance-metho
class LibWorkerService {
  constructor() {
    // Wasmboy Module Ports
    this.graphicsWorkerPort = undefined;
    this.memoryWorkerPort = undefined;
    this.controllerWorkerPort = undefined;
    this.audioWorkerPort = undefined;

    // Wasm Module Properties
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;

    // Lib options
    this.options = undefined;

    // Some Constants from the wasm module
    this.WASMBOY_GAME_BYTES_LOCATION = 0;

    // Playing state
    this.paused = true;

    // Our update setTimeout ref
    this.updateId = false;

    // Our fps timestamps
    this.pauseFpsThrottle = false;
    this.fpsTimestamps = [];
  }

  // Message Handler from the main thread
  messageHandler(event) {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    console.log(eventData, this);
    console.log('yo', this.getFps());

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.CONNECT: {
        // Assign our worker ports on connect
        if (eventData.message.workerId === WORKER_ID.GRAPHICS) {
          this.graphicsWorkerPort = event.ports[0];
          onMessage(this._graphicsMessageHandler, this.graphicsWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.MEMORY) {
          this.memoryWorkerPort = event.ports[0];
          onMessage(this._memoryMessageHandler, this.memoryWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.CONTROLLER) {
          this.controllerWorkerPort = event.ports[0];
          onMessage(this._controllerMessageHandler, this.controllerWorkerPort);
        } else if (eventData.message.workerId === WORKER_ID.AUDIO) {
          this.audioWorkerPort = event.ports[0];
          onMessage(this._audioMessageHandler, this.audioWorkerPort);
        }

        // Simply post back that we are ready
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      case WORKER_MESSAGE_TYPE.INSTANTIATE_WASM: {
        instantiateWasm(eventData.message.wasmModuleUrl).then(response => {
          this.wasmInstance = response.wasmInstance;
          this.wasmByteMemory = response.wasmByteMemory;
          postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        });
        return;
      }
      case WORKER_MESSAGE_TYPE.CONFIG: {
        // Config will come in as an array, pass in values using apply
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply
        const config = eventData.message.config;
        this.wasmInstance.exports.config.apply(this, config);
        this.options = eventData.message.options;
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      case WORKER_MESSAGE_TYPE.RESET_AUDIO_QUEUE: {
        // Reset the audio queue index to stop weird pauses when trying to load a game
        this.wasmInstance.exports.resetAudioQueue();
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      case WORKER_MESSAGE_TYPE.PLAY: {
        // Call our update
        this.paused = false;
        this.fpsTimestamps = [];
        if (!this.updateId) {
          update.call(this, eventData.message.intervalRate);
        }
        this.startPauseFpsThrottle();
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      case WORKER_MESSAGE_TYPE.PAUSE: {
        // Call our update
        this.paused = true;
        if (this.updateId) {
          clearTimeout(this.updateId);
        }
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
        return;
      }

      default: {
        //handle other messages from main
        console.log(eventData);
      }
    }
  }

  startPauseFpsThrottle() {
    // This will allow us to know if we just un paused
    this.pauseFpsThrottle = true;
    setTimeout(() => {
      this.pauseFpsThrottle = false;
    }, 1000);
  }

  // Function to return the current FPS
  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  getFPS() {
    if (this.pauseFpsThrottle) {
      return this.options.gameboyFrameRate;
    } else if (this.fpsTimeStamps) {
      return this.fpsTimeStamps.length;
    }

    return 0;
  }

  _graphicsMessageHandler(event) {}

  _memoryMessageHandler(event) {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    console.log(eventData);

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.CLEAR_MEMORY: {
        // Clear Wasm memory
        // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
        for (let i = 0; i <= this.wasmByteMemory.length; i++) {
          this.wasmByteMemory[i] = 0;
        }

        this.memoryWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY_DONE,
              wasmByteMemory: this.wasmByteMemory.buffer
            },
            eventData.messageId
          ),
          [this.wasmByteMemory.buffer]
        );
        return;
      }

      case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
        this.WASMBOY_GAME_BYTES_LOCATION = this.wasmInstance.exports.gameBytesLocation.valueOf();

        console.log('asdasd');

        // Forward to our lib worker
        this.memoryWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
              WASMBOY_GAME_BYTES_LOCATION: this.wasmInstance.exports.gameBytesLocation.valueOf(),
              WASMBOY_GAME_RAM_BANKS_LOCATION: this.wasmInstance.exports.gameRamBanksLocation.valueOf(),
              WASMBOY_INTERNAL_STATE_SIZE: this.wasmInstance.exports.wasmBoyInternalStateSize.valueOf(),
              WASMBOY_INTERNAL_STATE_LOCATION: this.wasmInstance.exports.wasmBoyInternalStateLocation.valueOf(),
              WASMBOY_INTERNAL_MEMORY_SIZE: this.wasmInstance.exports.gameBoyInternalMemorySize.valueOf(),
              WASMBOY_INTERNAL_MEMORY_LOCATION: this.wasmInstance.exports.gameBoyInternalMemoryLocation.valueOf(),
              WASMBOY_PALETTE_MEMORY_SIZE: this.wasmInstance.exports.gameboyColorPaletteSize.valueOf(),
              WASMBOY_PALETTE_MEMORY_LOCATION: this.wasmInstance.exports.gameboyColorPaletteLocation.valueOf()
            },
            eventData.messageId
          )
        );
        return;
      }
      case WORKER_MESSAGE_TYPE.LOAD_ROM: {
        // Load the game data into actual memory
        this.wasmByteMemory.set(new Uint8Array(eventData.message.ROM), WASMBOY_GAME_BYTES_LOCATION);

        // Forward to our lib worker
        this.memoryWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.LOAD_ROM_DONE,
              wasmByteMemory: this.wasmByteMemory.buffer
            },
            eventData.messageId
          ),
          [this.wasmByteMemory.buffer]
        );
        return;
      }
    }
  }

  _controllerMessageHandler(event) {}

  _audioMessageHandler(event) {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
        // Forward to our lib worker
        this.audioWorkerPort.postMessage(
          getSmartWorkerMessage(
            {
              type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
              WASMBOY_SOUND_OUTPUT_LOCATION: this.wasmInstance.exports.soundOutputLocation.valueOf()
            },
            eventData.messageId
          )
        );
        return;
      }
    }
  }
}

// Assign the worker a message handler
const libWorker = new LibWorkerService();
console.log(libWorker, libWorker.messageHandler);
console.log('ayyeee', libWorker._memoryMessageHandler);
onMessage(libWorker.messageHandler);
