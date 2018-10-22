import { postMessage, onMessage } from '../../../worker/workerapi';
import { WORKER_MESSAGE_TYPE, MEMORY_TYPE } from '../../../worker/constants';
import { getEventData } from '../../../worker/util';
import { getSmartWorkerMessage } from '../../../worker/smartworker';

// Our memory getters
import { getCartridgeRom } from './rom';
import { getCartridgeRam } from './ram';
import { getCartridgeHeader } from './header';
import { getGameBoyMemory } from './gameboymemory';
import { getPaletteMemory } from './palettememory';
import { getInternalState } from './internalstate';

// On message handler for when memory worker
// posts to lib Worker
export function memoryWorkerOnMessage(libWorker, event) {
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
      (libWorker.WASMBOY_GAME_RAM_BANKS_LOCATION = libWorker.wasmInstance.exports.gameRamBanksLocation.valueOf()),
        (libWorker.WASMBOY_INTERNAL_STATE_SIZE = libWorker.wasmInstance.exports.wasmBoyInternalStateSize.valueOf()),
        (libWorker.WASMBOY_INTERNAL_STATE_LOCATION = libWorker.wasmInstance.exports.wasmBoyInternalStateLocation.valueOf()),
        (libWorker.WASMBOY_INTERNAL_MEMORY_SIZE = libWorker.wasmInstance.exports.gameBoyInternalMemorySize.valueOf()),
        (libWorker.WASMBOY_INTERNAL_MEMORY_LOCATION = libWorker.wasmInstance.exports.gameBoyInternalMemoryLocation.valueOf()),
        (libWorker.WASMBOY_PALETTE_MEMORY_SIZE = libWorker.wasmInstance.exports.gameboyColorPaletteSize.valueOf()),
        (libWorker.WASMBOY_PALETTE_MEMORY_LOCATION = libWorker.wasmInstance.exports.gameboyColorPaletteLocation.valueOf());

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

    case WORKER_MESSAGE_TYPE.SET_MEMORY: {
      const memoryKeys = Object.keys(eventData.message);

      if (memoryKeys.includes(MEMORY_TYPE.CARTRIDGE_ROM)) {
        libWorker.wasmByteMemory.set(new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_ROM]), libWorker.WASMBOY_GAME_BYTES_LOCATION);
      }
      if (memoryKeys.includes(MEMORY_TYPE.CARTRIDGE_RAM)) {
        libWorker.wasmByteMemory.set(
          new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_RAM]),
          libWorker.WASMBOY_GAME_RAM_BANKS_LOCATION
        );
      }
      if (memoryKeys.includes(MEMORY_TYPE.GAMEBOY_MEMORY)) {
        libWorker.wasmByteMemory.set(
          new Uint8Array(eventData.message[MEMORY_TYPE.GAMEBOY_MEMORY]),
          libWorker.WASMBOY_INTERNAL_MEMORY_LOCATION
        );
      }
      if (memoryKeys.includes(MEMORY_TYPE.PALETTE_MEMORY)) {
        libWorker.wasmByteMemory.set(
          new Uint8Array(eventData.message[MEMORY_TYPE.PALETTE_MEMORY]),
          libWorker.WASMBOY_PALETTE_MEMORY_LOCATION
        );
      }
      if (memoryKeys.includes(MEMORY_TYPE.INTERNAL_STATE)) {
        libWorker.wasmByteMemory.set(
          new Uint8Array(eventData.message[MEMORY_TYPE.INTERNAL_STATE]),
          libWorker.WASMBOY_INTERNAL_STATE_LOCATION
        );
        libWorker.wasmInstance.exports.loadState();
      }

      libWorker.memoryWorkerPort.postMessage(
        getSmartWorkerMessage(
          {
            type: WORKER_MESSAGE_TYPE.SET_MEMORY_DONE
          },
          eventData.messageId
        )
      );

      return;
    }

    case WORKER_MESSAGE_TYPE.GET_MEMORY: {
      // Construct our data object
      const responseMemory = {};
      const responseTransferrables = [];

      const memoryTypes = eventData.message.memoryTypes;

      if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_ROM)) {
        const cartridgeRom = getCartridgeRom(libWorker);
        responseMemory[MEMORY_TYPE.CARTRIDGE_ROM] = cartridgeRom;
        responseTransferrables.push(cartridgeRom);
      }
      if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_RAM)) {
        const cartridgeRam = getCartridgeRam(libWorker);
        responseMemory[MEMORY_TYPE.CARTRIDGE_RAM] = cartridgeRam;
        responseTransferrables.push(cartridgeRam);
      }
      if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_HEADER)) {
        const cartridgeHeader = getCartridgeHeader(libWorker);
        responseMemory[MEMORY_TYPE.CARTRIDGE_HEADER] = cartridgeHeader;
        responseTransferrables.push(cartridgeHeader);
      }
      if (memoryTypes.includes(MEMORY_TYPE.GAMEBOY_MEMORY)) {
        const gameboyMemory = getGameBoyMemory(libWorker);
        responseMemory[MEMORY_TYPE.GAMEBOY_MEMORY] = gameboyMemory;
        responseTransferrables.push(gameboyMemory);
      }
      if (memoryTypes.includes(MEMORY_TYPE.PALETTE_MEMORY)) {
        const paletteMemory = getPaletteMemory(libWorker);
        responseMemory[MEMORY_TYPE.PALETTE_MEMORY] = paletteMemory;
        responseTransferrables.push(paletteMemory);
      }
      if (memoryTypes.includes(MEMORY_TYPE.INTERNAL_STATE)) {
        libWorker.wasmInstance.exports.saveState();
        const internalState = getGameBoyMemory(libWorker);
        responseMemory[MEMORY_TYPE.INTERNAL_STATE] = internalState;
        responseTransferrables.push(internalState);
      }

      libWorker.memoryWorkerPort.postMessage(getSmartWorkerMessage(responseMemory, eventData.messageId), responseTransferrables);

      return;
    }
  }
}
