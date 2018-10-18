// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

// Using transferables: https://stackoverflow.com/questions/16071211/using-transferable-objects-from-a-web-worker

import { postMessage, onMessage } from '../../worker/workerapi';
import { WORKER_MESSAGE_TYPE, WORKER_ID } from '../../worker/constants';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { instantiateWasm } from './instantiate';

// Wasmboy Module Ports
let graphicsWorkerPort;
let memoryWorkerPort;
let controllerWorkerPort;
let audioWorkerPort;

// Wasm Module Properties
let wasmInstance;
let wasmByteMemory;

// Some Constants from the wasm module
let WASMBOY_GAME_BYTES_LOCATION = 0;

const graphicsMessageHandler = event => {};

const memoryMessageHandler = event => {
  // Handle our messages from the main thread
  const eventData = getEventData(event);

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.CLEAR_MEMORY: {
      // Clear Wasm memory
      // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
      for (let i = 0; i <= wasmByteMemory.length; i++) {
        wasmByteMemory[i] = 0;
      }

      memoryWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY_DONE,
            wasmByteMemory: wasmByteMemory.buffer
          },
          eventData.messageId
        ),
        [wasmByteMemory.buffer]
      );
      return;
    }

    case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
      WASMBOY_GAME_BYTES_LOCATION = wasmInstance.exports.gameBytesLocation.valueOf();

      // Forward to our lib worker
      memoryWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
            WASMBOY_GAME_BYTES_LOCATION: wasmInstance.exports.gameBytesLocation.valueOf(),
            WASMBOY_GAME_RAM_BANKS_LOCATION: wasmInstance.exports.gameRamBanksLocation.valueOf(),
            WASMBOY_INTERNAL_STATE_SIZE: wasmInstance.exports.wasmBoyInternalStateSize.valueOf(),
            WASMBOY_INTERNAL_STATE_LOCATION: wasmInstance.exports.wasmBoyInternalStateLocation.valueOf(),
            WASMBOY_INTERNAL_MEMORY_SIZE: wasmInstance.exports.gameBoyInternalMemorySize.valueOf(),
            WASMBOY_INTERNAL_MEMORY_LOCATION: wasmInstance.exports.gameBoyInternalMemoryLocation.valueOf(),
            WASMBOY_PALETTE_MEMORY_SIZE: wasmInstance.exports.gameboyColorPaletteSize.valueOf(),
            WASMBOY_PALETTE_MEMORY_LOCATION: wasmInstance.exports.gameboyColorPaletteLocation.valueOf()
          },
          eventData.messageId
        )
      );
      return;
    }

    case WORKER_MESSAGE_TYPE.LOAD_ROM: {
      // Load the game data into actual memory
      wasmByteMemory.set(new Uint8Array(eventData.message.ROM), WASMBOY_GAME_BYTES_LOCATION);

      // Forward to our lib worker
      memoryWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.LOAD_ROM_DONE,
            wasmByteMemory: wasmByteMemory.buffer
          },
          eventData.messageId
        ),
        [wasmByteMemory.buffer]
      );
      return;
    }
  }
};

const controllerMessageHandler = event => {};

const audioMessageHandler = event => {
  // Handle our messages from the main thread
  const eventData = getEventData(event);

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
      // Forward to our lib worker
      memoryWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
            WASMBOY_SOUND_OUTPUT_LOCATION: wasmInstance.exports.soundOutputLocation.valueOf()
          },
          eventData.messageId
        )
      );
      return;
    }
  }
};

const messageHandler = event => {
  // Handle our messages from the main thread
  const eventData = getEventData(event);

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.CONNECT: {
      // Assign our worker ports on connect
      if (eventData.message.workerId === WORKER_ID.GRAPHICS) {
        graphicsWorkerPort = event.ports[0];
        onMessage(graphicsMessageHandler, graphicsWorkerPort);
      } else if (eventData.message.workerId === WORKER_ID.MEMORY) {
        memoryWorkerPort = event.ports[0];
        onMessage(memoryMessageHandler, memoryWorkerPort);
      } else if (eventData.message.workerId === WORKER_ID.CONTROLLER) {
        controllerWorkerPort = event.ports[0];
        onMessage(controllerMessageHandler, controllerWorkerPort);
      } else if (eventData.message.workerId === WORKER_ID.AUDIO) {
        audioWorkerPort = event.ports[0];
        onMessage(audioMessageHandler, audioWorkerPort);
      }

      // Simply post back that we are ready
      postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
      return;
    }

    case WORKER_MESSAGE_TYPE.INSTANTIATE_WASM: {
      instantiateWasm(eventData.message.wasmModuleUrl).then(response => {
        wasmInstance = response.wasmInstance;
        wasmByteMemory = response.wasmByteMemory;
        postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
      });
      return;
    }

    case WORKER_MESSAGE_TYPE.CONFIG: {
      // Config will come in as an array, pass in values using apply
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply
      const config = eventData.message.config;
      wasmInstance.exports.config.apply(this, config);
      postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
      return;
    }

    default: {
      //handle other messages from main
      console.log(eventData);
    }
  }
};

onMessage(messageHandler);
