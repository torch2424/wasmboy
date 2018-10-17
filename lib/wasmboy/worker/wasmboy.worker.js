// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

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
            type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY_DONE
          },
          eventData.messageId
        )
      );
      return;
    }
  }
};

const controllerMessageHandler = event => {};

const audioMessageHandler = event => {};

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

    default: {
      //handle other messages from main
      console.log(eventData);
    }
  }
};

onMessage(messageHandler);
