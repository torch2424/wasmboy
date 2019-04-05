// File to do per-opcode operations

import { WasmBoy } from '../../wasmboy';

// Function to run a  single opcode
export function stepOpcode() {
  const stepOpcodeTask = async () => {
    // We should pause wasmboy
    if (WasmBoy.isPlaying()) {
      await WasmBoy.pause();
    }

    const numberOfCycles = await WasmBoy._runWasmExport('executeStep');

    if (numberOfCycles <= 0) {
      console.error('Opcode not recognized! Check wasm logs.');
      this.updateDebugInfo();
      throw new Error();
    }
  };
  return stepOpcodeTask();
}

// Function to run a specifed number of opcodes for faster stepping
export function runNumberOfOpcodes(numberOfOpcodes) {
  // Keep stepping until highest opcode increases
  let opcodesToRun = numberOfOpcodes;

  const runNumberOfOpcodesTask = async () => {
    let opcodesRan = 0;

    const runOpcode = async () => {
      await stepOpcode(true);
      const programCounter = await WasmBoy._runWasmExport('getProgramCounter');

      if (opcodesRan < opcodesToRun) {
        opcodesRan++;
        await runOpcode();
        return;
      }
    };
    await runOpcode();
  };
  return runNumberOfOpcodesTask();
}
