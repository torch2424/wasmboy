// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

import { postMessage, onMessage } from '../../worker/workerapi';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { WORKER_MESSAGE_TYPE } from '../../worker/constants';

import { getImageDataFromGraphicsFrameBuffer } from './imageData';

// Worker port for the lib
let libWorkerPort;

const libMessageHandler = event => {
  const eventData = getEventData(event);

  // Handle our messages from the lib thread
  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE: {
      postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId));
      return;
    }

    case WORKER_MESSAGE_TYPE.UPDATED: {
      // Process the memory buffer and pass back to the main thread
      const imageDataArray = getImageDataFromGraphicsFrameBuffer(new Uint8ClampedArray(eventData.message.graphicsFrameBuffer));
      postMessage(
        getSmartWorkerMessage({
          type: WORKER_MESSAGE_TYPE.UPDATED,
          imageDataArrayBuffer: imageDataArray.buffer
        }),
        [imageDataArray.buffer]
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
      // Set our lib port
      libWorkerPort = eventData.message.ports[0];
      onMessage(libMessageHandler, libWorkerPort);

      // Simply post back that we are ready
      postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
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

    default: {
      //handle other messages from main
      console.log(eventData);
    }
  }
};

onMessage(messageHandler);
