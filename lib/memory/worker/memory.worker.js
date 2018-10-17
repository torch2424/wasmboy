// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

import { postMessage, onMessage } from '../../worker/workerapi';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { WORKER_MESSAGE_TYPE } from '../../worker/constants';

let libWorkerPort;

const libMessageHandler = event => {
  // Handle our messages from the lib thread
  const eventData = getEventData(event);
  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.CLEAR_MEMORY_DONE: {
      postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
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

    default: {
      //handle other messages from main
      console.log(eventData);
    }
  }
};

onMessage(messageHandler);
