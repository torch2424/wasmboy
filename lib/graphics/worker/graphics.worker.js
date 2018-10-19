// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

import { postMessage, onMessage } from '../../worker/workerapi';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { WORKER_MESSAGE_TYPE } from '../../worker/constants';

import { GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT } from '../constants';

// Cached Current Frame output location, since call to wasm is expensive
let WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = 0;

// Worker port for the lib
let libWorkerPort;

const getImageDataFromWasmMemory = wasmByteMemory => {
  // Draw the pixels
  // 160x144
  // Split off our image Data
  const imageDataArray = new Uint8ClampedArray(GAMEBOY_CAMERA_HEIGHT * GAMEBOY_CAMERA_WIDTH * 4);
  const rgbColor = new Uint8ClampedArray(3);

  for (let y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
    for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {
      // Each color has an R G B component
      let pixelStart = (y * 160 + x) * 3;

      for (let color = 0; color < 3; color++) {
        rgbColor[color] = wasmByteMemory[pixelStart + color];
      }

      // Doing graphics using second answer on:
      // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
      // Image Data mapping
      const imageDataIndex = (x + y * GAMEBOY_CAMERA_WIDTH) * 4;

      imageDataArray[imageDataIndex] = rgbColor[0];
      imageDataArray[imageDataIndex + 1] = rgbColor[1];
      imageDataArray[imageDataIndex + 2] = rgbColor[2];
      // Alpha, no transparency
      imageDataArray[imageDataIndex + 3] = 255;
    }
  }

  return imageDataArray;
};

const libMessageHandler = event => {
  const eventData = getEventData(event);

  // Handle update method transferables
  if (!eventData.message) {
    // Process the memory buffer and pass back to the main thread
    const imageDataArray = getImageDataFromWasmMemory(new Uint8ClampedArray(eventData));
    postMessage(imageDataArray.buffer, [imageDataArray.buffer]);
    return;
  }

  // Handle our messages from the lib thread
  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE: {
      WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = eventData.message.WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION;
      postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId));
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
