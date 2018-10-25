import { postMessage, onMessage } from '../../../worker/workerapi';
import { WORKER_MESSAGE_TYPE } from '../../../worker/constants';
import { getEventData } from '../../../worker/util';
import { getSmartWorkerMessage } from '../../../worker/smartworker';

// Function to handler audio worker on message to the libWorker
export function audioWorkerOnMessage(libWorker, event) {
  // Handle our messages from the main thread
  const eventData = getEventData(event);

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
      libWorker.WASMBOY_SOUND_OUTPUT_LOCATION = libWorker.wasmInstance.exports.soundOutputLocation.valueOf();
      // Forward to our lib worker
      libWorker.audioWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
            WASMBOY_SOUND_OUTPUT_LOCATION: libWorker.wasmInstance.exports.soundOutputLocation.valueOf()
          },
          eventData.messageId
        )
      );
      return;
    }

    case WORKER_MESSAGE_TYPE.AUDIO_LATENCY: {
      libWorker.currentAudioLatencyInSeconds = eventData.message.latency;
      return;
    }
  }
}
