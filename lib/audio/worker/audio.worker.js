// Web worker for wasmboy lib
// Will be used for running wasm, and controlling child workers.

import { postMessage, onMessage } from '../../worker/workerapi';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { WORKER_MESSAGE_TYPE } from '../../worker/constants';

// Convert our uint8 into a float sample
const getUnsignedAudioSampleAsFloat = audioSample => {
  // Subtract 1 as it is added so the value is not empty
  audioSample -= 1;
  // Divide by 127 to get back to our float scale
  audioSample = audioSample / 127;
  // Subtract 1 to regain our sign
  audioSample -= 1;

  // Because of the innacuracy of converting an unsigned int to a signed float
  // We will have some leftovers when doing the conversion.
  // When testing with Pokemon blue, when it is supposed to be complete silence in the intro,
  // It shows 0.007874015748031482, meaning we want to cut our values lower than this
  if (Math.abs(audioSample) < 0.008) {
    audioSample = 0;
  }

  // Return, but divide by lower volume, PCM is loouuuuddd
  return audioSample / 2.25;
};

const getAudioChannelBuffersFromBuffer = (audioBuffer, numberOfSamples) => {
  // Create our buffers as Float 32 Array
  // https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/getChannelData
  const leftChannelBuffer = new Float32Array(numberOfSamples);
  const rightChannelBuffer = new Float32Array(numberOfSamples);

  // Our index on our left/right buffers
  let bufferIndex = 0;

  // Our total number of stereo samples
  let numberOfSamplesForStereo = numberOfSamples * 2;

  // Left Channel
  for (let i = 0; i < numberOfSamplesForStereo; i = i + 2) {
    leftChannelBuffer[bufferIndex] = getUnsignedAudioSampleAsFloat(audioBuffer[i]);
    bufferIndex++;
  }

  // Reset the buffer index
  bufferIndex = 0;

  // Right Channel
  for (let i = 1; i < numberOfSamplesForStereo; i = i + 2) {
    rightChannelBuffer[bufferIndex] = getUnsignedAudioSampleAsFloat(audioBuffer[i]);
    bufferIndex++;
  }

  return {
    left: leftChannelBuffer.buffer,
    right: rightChannelBuffer.buffer
  };
};

// Worker port for the lib
let libWorkerPort;

const libMessageHandler = event => {
  const eventData = getEventData(event);

  // Handle update method transfrables
  if (!eventData.message) {
    return;
  }

  // Handle our messages from the lib thread
  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE: {
      postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId));
      return;
    }

    case WORKER_MESSAGE_TYPE.UPDATED: {
      // Process the memory buffer and pass back to the main thread
      const audioBufferAsArray = new Uint8Array(eventData.message.audioBuffer);
      const audioChannelBuffers = getAudioChannelBuffersFromBuffer(audioBufferAsArray, eventData.message.numberOfSamples);
      postMessage(
        getSmartWorkerMessage({
          type: WORKER_MESSAGE_TYPE.UPDATED,
          leftChannel: audioChannelBuffers.left,
          rightChannel: audioChannelBuffers.right,
          numberOfSamples: eventData.message.numberOfSamples,
          fps: eventData.message.fps,
          allowFastSpeedStretching: eventData.message.allowFastSpeedStretching
        }),
        [audioChannelBuffers.left, audioChannelBuffers.right]
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
