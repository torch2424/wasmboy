// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions

import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';
import { runWasmExport, getWasmMemorySection, getWasmConstant } from '../debug/debug';

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
