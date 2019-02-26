import { postMessage, onMessage } from '../../../worker/workerapi';
import { WORKER_MESSAGE_TYPE } from '../../../worker/constants';
import { getEventData } from '../../../worker/util';
import { getSmartWorkerMessage } from '../../../worker/smartworker';

// Function to handle on message from graphics worker
// to the lib worker
export function graphicsWorkerOnMessage(libWorker, event) {
  // Handle our messages from the main thread
  const eventData = getEventData(event);

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
      libWorker.WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = libWorker.wasmInstance.exports.FRAME_LOCATION.valueOf();
      libWorker.WASMBOY_CURRENT_FRAME_SIZE = libWorker.wasmInstance.exports.FRAME_SIZE.valueOf();
      // Forward to our lib worker
      libWorker.graphicsWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
            WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION: libWorker.wasmInstance.exports.FRAME_LOCATION.valueOf()
          },
          eventData.messageId
        )
      );
      return;
    }
  }
}
