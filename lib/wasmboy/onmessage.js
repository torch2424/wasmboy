// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions

import { WasmBoyPlugins } from '../plugins/plugins';

import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';
import { runWasmExport, getWasmMemorySection, getWasmConstant } from '../debug/debug';

const messageRequests = {};

export function waitForLibWorkerMessageType(messageType) {
  if (!messageRequests[messageType]) {
    messageRequests[messageType] = [];
  }
  const promise = new Promise(resolve => {
    messageRequests[messageType].push(resolve);
  });

  return promise;
}

// Functions to handle the lib worker messages
export function libWorkerOnMessage(event) {
  const eventData = getEventData(event);

  if (!eventData.message) {
    return;
  }

  if (messageRequests[eventData.message.type]) {
    messageRequests[eventData.message.type].forEach(request => request(eventData.message));
  }

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.UPDATED: {
      this.fps = eventData.message.fps;
      return;
    }

    case WORKER_MESSAGE_TYPE.BREAKPOINT: {
      const breakpointTask = async () => {
        await this.pause();
        if (this.options.breakpointCallback) {
          this.options.breakpointCallback();
        }

        WasmBoyPlugins.runHook({
          key: 'breakpoint'
        });
      };
      breakpointTask();
      return;
    }

    case WORKER_MESSAGE_TYPE.CRASHED: {
      const crashedTask = async () => {
        await this.pause();

        console.log('Wasmboy Crashed!');

        let programCounter = await runWasmExport('getProgramCounter');
        let gameboyMemoryConstant = await getWasmConstant('GAMEBOY_INTERNAL_MEMORY_LOCATION');
        let opcode = await getWasmMemorySection(gameboyMemoryConstant + programCounter, gameboyMemoryConstant + programCounter + 1);

        console.log(`Program Counter: 0x${programCounter.toString(16)}`);
        console.log(`Opcode: 0x${opcode[0].toString(16)}`);
      };
      crashedTask();
      return;
    }

    default: {
      // Do nothing. This catches all messages so yeah
    }
  }
}
