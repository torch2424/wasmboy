// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions

import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';

// Functions to handle the lib worker messages
export function libWorkerOnMessage(event) {
  const eventData = getEventData(event);

  if (!eventData.message) {
    return;
  }

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.UPDATED: {
      this.fps = eventData.message.fps;
      return;
    }

    case WORKER_MESSAGE_TYPE.CRASHED: {
      console.log('Wasmboy Crashed!');
      console.log(`Program Counter: 0x${this.wasmInstance.exports.getProgramCounter().toString(16)}`);
      console.log(`Opcode: 0x${this.wasmByteMemory[wasmboy.wasmInstance.exports.getProgramCounter()].toString(16)}`);
      this.pause();
      return;
    }

    default: {
      // Do nothing. This catches all messages so yeah
    }
  }
}
