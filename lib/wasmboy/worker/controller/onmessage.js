import { postMessage, onMessage } from '../../../worker/workerapi';
import { WORKER_MESSAGE_TYPE } from '../../../worker/constants';
import { getEventData } from '../../../worker/util';
import { getSmartWorkerMessage } from '../../../worker/smartworker';

// Handler for when the controller worker posts to the libWorker
export function controllerWorkerOnMessage(libWorker, event) {
  // Handle our messages from the main thread
  const eventData = getEventData(event);

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.SET_JOYPAD_STATE: {
      // Config will come in as an array, pass in values using apply
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply
      const setJoypadStateParamsAsArray = eventData.message.setJoypadStateParamsAsArray;
      libWorker.wasmInstance.exports.setJoypadState.apply(libWorker, setJoypadStateParamsAsArray);
      return;
    }
  }
}
