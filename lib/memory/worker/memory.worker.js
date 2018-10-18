// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

import { postMessage, onMessage } from '../../worker/workerapi';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { WORKER_MESSAGE_TYPE } from '../../worker/constants';

// Worker port for the lib
let libWorkerPort;

const libMessageHandler = event => {
  // Handle our messages from the lib thread
  const eventData = getEventData(event);
  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.CLEAR_MEMORY_DONE: {
      postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId), [eventData.message.wasmByteMemory]);
      return;
    }
    case WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE: {
      postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId));
      return;
    }
    case WORKER_MESSAGE_TYPE.LOAD_ROM_DONE: {
      postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId), [eventData.message.wasmByteMemory]);
      return;
    }
  }
};

const messageHandler = event => {
  // Handle our messages from the main thread
  const eventData = getEventData(event);
  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.CONNECT: {
      // Set our lib port
      libWorkerPort = event.ports[0];
      onMessage(libMessageHandler, libWorkerPort);

      // Simply post back that we are ready
      postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
      return;
    }

    case WORKER_MESSAGE_TYPE.CLEAR_MEMORY: {
      // Forward to our lib worker
      libWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY
          },
          eventData.messageId
        )
      );
      return;
    }

    case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
      // Forward to our lib worker
      libWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.GET_CONSTANTS
          },
          eventData.messageId
        )
      );
      return;
    }

    case WORKER_MESSAGE_TYPE.LOAD_ROM: {
      // Forward to our lib worker
      libWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.LOAD_ROM,
            ROM: eventData.message.ROM
          },
          eventData.messageId
        ),
        [eventData.message.ROM]
      );
      return;
    }

    default: {
      //handle other messages from main
      console.log(eventData);
    }
  }
};

onMessage(messageHandler);
