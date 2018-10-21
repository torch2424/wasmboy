import { postMessage, onMessage } from '../../worker/workerapi';
import { WORKER_MESSAGE_TYPE } from '../../worker/constants';
import { getEventData } from '../../worker/util';
import { getSmartWorkerMessage } from '../../worker/smartworker';

// On message handler for when memory worker
// posts to lib Worker
export function memoryWorkerOnMessage() {
  // Handle our messages from the main thread
  const eventData = getEventData(event);

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.CLEAR_MEMORY: {
      // Clear Wasm memory
      // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
      for (let i = 0; i <= libWorker.wasmByteMemory.length; i++) {
        libWorker.wasmByteMemory[i] = 0;
      }

      const wasmByteMemory = libWorker.wasmByteMemory.slice(0);
      libWorker.memoryWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY_DONE,
            wasmByteMemory: wasmByteMemory.buffer
          },
          eventData.messageId
        ),
        [wasmByteMemory.buffer]
      );
      return;
    }

    case WORKER_MESSAGE_TYPE.GET_CONSTANTS: {
      libWorker.WASMBOY_GAME_BYTES_LOCATION = libWorker.wasmInstance.exports.gameBytesLocation.valueOf();

      // Forward to our lib worker
      libWorker.memoryWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.GET_CONSTANTS_DONE,
            WASMBOY_GAME_BYTES_LOCATION: libWorker.wasmInstance.exports.gameBytesLocation.valueOf(),
            WASMBOY_GAME_RAM_BANKS_LOCATION: libWorker.wasmInstance.exports.gameRamBanksLocation.valueOf(),
            WASMBOY_INTERNAL_STATE_SIZE: libWorker.wasmInstance.exports.wasmBoyInternalStateSize.valueOf(),
            WASMBOY_INTERNAL_STATE_LOCATION: libWorker.wasmInstance.exports.wasmBoyInternalStateLocation.valueOf(),
            WASMBOY_INTERNAL_MEMORY_SIZE: libWorker.wasmInstance.exports.gameBoyInternalMemorySize.valueOf(),
            WASMBOY_INTERNAL_MEMORY_LOCATION: libWorker.wasmInstance.exports.gameBoyInternalMemoryLocation.valueOf(),
            WASMBOY_PALETTE_MEMORY_SIZE: libWorker.wasmInstance.exports.gameboyColorPaletteSize.valueOf(),
            WASMBOY_PALETTE_MEMORY_LOCATION: libWorker.wasmInstance.exports.gameboyColorPaletteLocation.valueOf()
          },
          eventData.messageId
        )
      );
      return;
    }
    case WORKER_MESSAGE_TYPE.LOAD_ROM: {
      // Load the game data into actual memory
      libWorker.wasmByteMemory.set(new Uint8Array(eventData.message.ROM), libWorker.WASMBOY_GAME_BYTES_LOCATION);

      // Forward to our lib worker
      const wasmByteMemory = libWorker.wasmByteMemory.slice(0);
      libWorker.memoryWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.LOAD_ROM_DONE,
            wasmByteMemory: wasmByteMemory.buffer
          },
          eventData.messageId
        ),
        [wasmByteMemory.buffer]
      );
      return;
    }
  }
}
