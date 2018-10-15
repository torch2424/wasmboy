// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

import { postMessage, onMessage, getEventData } from '../../worker/workerapi';
import { WORKER_MESSAGE_TYPE } from '../../worker/constants';

const messageHandler = event => {
  // Handle our messages from the main thread
  const eventData = getEventData(event);
  switch (eventData.type) {
    case WORKER_MESSAGE_TYPE.CONNECT: {
      // Simply post back that we are ready
      postMessage('Connected!');
      return;
    }

    default: {
      //handle other messages from main
      console.log(eventData);
    }
  }
};

onMessage(messageHandler);
