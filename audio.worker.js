(function () {
  'use strict';

  function getEventData(event) {
    if (event.data) {
      return event.data;
    }

    return event;
  }
  const isInBrowser = typeof self !== 'undefined'; // Function to read a base64 string as a buffer

  // Isomorphic worker api to be imported by web workers
  let parentPort;

  if (!isInBrowser) {
    parentPort = require('worker_threads').parentPort;
  } // https://nodejs.org/api/worker_threads.html#worker_threads_worker_postmessage_value_transferlist
  // https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage


  function postMessage(message, transferArray) {
    // Can't bind parentPort.postMessage, so we need to kinda copy code here :p
    if (isInBrowser) {
      self.postMessage(message, transferArray);
    } else {
      parentPort.postMessage(message, transferArray);
    }
  } // https://nodejs.org/api/worker_threads.html#worker_threads_worker_parentport
  // https://developer.mozilla.org/en-US/docs/Web/API/Worker/onmessage

  function onMessage(callback, port) {
    if (!callback) {
      console.error('workerapi: No callback was provided to onMessage!');
    } // If we passed a port, use that


    if (port) {
      if (isInBrowser) {
        // We are in the browser
        port.onmessage = callback;
      } else {
        // We are in Node
        port.on('message', callback);
      }

      return;
    }

    if (isInBrowser) {
      // We are in the browser
      self.onmessage = callback;
    } else {
      // We are in Node
      parentPort.on('message', callback);
    }
  }

  // Smarter workers.

  let idCounter = 0;

  const generateId = () => {
    const randomId = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(2, 10);
    idCounter++;
    const id = `${randomId}-${idCounter}`;

    if (idCounter > 100000) {
      idCounter = 0;
    }

    return id;
  };

  function getSmartWorkerMessage(message, messageId, workerId) {
    if (!messageId) {
      messageId = generateId();
    }

    return {
      workerId,
      messageId,
      message
    };
  }

  const WORKER_MESSAGE_TYPE = {
    CONNECT: 'CONNECT',
    INSTANTIATE_WASM: 'INSTANTIATE_WASM',
    CLEAR_MEMORY: 'CLEAR_MEMORY',
    CLEAR_MEMORY_DONE: 'CLEAR_MEMORY_DONE',
    GET_MEMORY: 'GET_MEMORY',
    SET_MEMORY: 'SET_MEMORY',
    SET_MEMORY_DONE: 'SET_MEMORY_DONE',
    GET_CONSTANTS: 'GET_CONSTANTS',
    GET_CONSTANTS_DONE: 'GET_CONSTANTS_DONE',
    CONFIG: 'CONFIG',
    RESET_AUDIO_QUEUE: 'RESET_AUDIO_QUEUE',
    PLAY: 'PLAY',
    PAUSE: 'PAUSE',
    UPDATED: 'UPDATED',
    CRASHED: 'CRASHED',
    SET_JOYPAD_STATE: 'SET_JOYPAD_STATE',
    AUDIO_LATENCY: 'AUDIO_LATENCY',
    RUN_WASM_EXPORT: 'RUN_WASM_EXPORT',
    GET_WASM_MEMORY_SECTION: 'GET_WASM_MEMORY_SECTION',
    GET_WASM_CONSTANT: 'GET_WASM_CONSTANT'
  };

  // Web worker for wasmboy lib

  const getUnsignedAudioSampleAsFloat = audioSample => {
    // Subtract 1 as it is added so the value is not empty
    audioSample -= 1; // Divide by 127 to get back to our float scale

    audioSample = audioSample / 127; // Subtract 1 to regain our sign

    audioSample -= 1; // Because of the innacuracy of converting an unsigned int to a signed float
    // We will have some leftovers when doing the conversion.
    // When testing with Pokemon blue, when it is supposed to be complete silence in the intro,
    // It shows 0.007874015748031482, meaning we want to cut our values lower than this

    if (Math.abs(audioSample) < 0.008) {
      audioSample = 0;
    } // Return, but divide by lower volume, PCM is loouuuuddd


    return audioSample / 2.5;
  };

  const getAudioChannelBuffersFromBuffer = (audioBuffer, numberOfSamples) => {
    // Create our buffers as Float 32 Array
    // https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/getChannelData
    // Number of samples divided by two, since we split into each channel
    const leftChannelBuffer = new Float32Array(numberOfSamples);
    const rightChannelBuffer = new Float32Array(numberOfSamples); // Our index on our left/right buffers

    let bufferIndex = 0; // Our total number of stereo samples

    let numberOfSamplesForStereo = numberOfSamples * 2; // Left Channel

    for (let i = 0; i < numberOfSamplesForStereo; i = i + 2) {
      leftChannelBuffer[bufferIndex] = getUnsignedAudioSampleAsFloat(audioBuffer[i]);
      bufferIndex++;
    } // Reset the buffer index


    bufferIndex = 0; // Right Channel

    for (let i = 1; i < numberOfSamplesForStereo; i = i + 2) {
      rightChannelBuffer[bufferIndex] = getUnsignedAudioSampleAsFloat(audioBuffer[i]);
      bufferIndex++;
    }

    return {
      left: leftChannelBuffer.buffer,
      right: rightChannelBuffer.buffer
    };
  }; // Worker port for the lib


  let libWorkerPort;

  const libMessageHandler = event => {
    const eventData = getEventData(event); // Handle update method transfrables

    if (!eventData.message) {
      return;
    } // Handle our messages from the lib thread


    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE:
        {
          postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId));
          return;
        }

      case WORKER_MESSAGE_TYPE.UPDATED:
        {
          // Process the memory buffer and pass back to the main thread
          const audioBufferAsArray = new Uint8Array(eventData.message.audioBuffer);
          const audioChannelBuffers = getAudioChannelBuffersFromBuffer(audioBufferAsArray, eventData.message.numberOfSamples);
          postMessage(getSmartWorkerMessage({
            type: WORKER_MESSAGE_TYPE.UPDATED,
            leftChannel: audioChannelBuffers.left,
            rightChannel: audioChannelBuffers.right,
            numberOfSamples: eventData.message.numberOfSamples,
            fps: eventData.message.fps,
            allowFastSpeedStretching: eventData.message.allowFastSpeedStretching
          }), [audioChannelBuffers.left, audioChannelBuffers.right]);
          return;
        }
    }
  };

  const messageHandler = event => {
    // Handle our messages from the main thread
    const eventData = getEventData(event);

    switch (eventData.message.type) {
      case WORKER_MESSAGE_TYPE.CONNECT:
        {
          // Set our lib port
          libWorkerPort = eventData.message.ports[0];
          onMessage(libMessageHandler, libWorkerPort); // Simply post back that we are ready

          postMessage(getSmartWorkerMessage(undefined, eventData.messageId));
          return;
        }

      case WORKER_MESSAGE_TYPE.GET_CONSTANTS:
        {
          // Forward to our lib worker
          libWorkerPort.postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId));
          return;
        }

      case WORKER_MESSAGE_TYPE.AUDIO_LATENCY:
        {
          // Forward to our lib worker
          libWorkerPort.postMessage(getSmartWorkerMessage(eventData.message, eventData.messageId));
          return;
        }

      default:
        {
          //handle other messages from main
          console.log(eventData);
        }
    }
  };

  onMessage(messageHandler);

}());
//# sourceMappingURL=audio.worker.js.map
