// File to do per-opcode operations

import { WasmBoy } from '../../wasmboy';

// Function to run a  single opcode
export function stepOpcode() {
  const stepOpcodeTask = async () => {
    // We should pause wasmboy
    if (WasmBoy.isPlaying()) {
      await WasmBoy.pause();
    }

    const numberOfCycles = await WasmBoy._runWasmExport('emulationStep');

    if (numberOfCycles <= 0) {
      console.error('Opcode not recognized! Check wasm logs.');
      this.updateDebugInfo();
      throw new Error();
    }
  };
  return stepOpcodeTask();
}

// Function to run a specifed number of opcodes for faster stepping
export function runNumberOfOpcodes(numberOfOpcodes, breakPoint) {
  // Keep stepping until highest opcode increases
  let opcodesToRun = numberOfOpcodes;

  const runNumberOfOpcodesTask = async () => {
    let opcodesRan = 0;

    const runOpcode = async () => {
      await stepOpcode(true);
      const programCounter = await WasmBoy._runWasmExport('getProgramCounter');
      if (breakPoint && breakPoint === programCounter) {
        return;
      }

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

// Function to keep running opcodes until a breakpoint is reached
export function runUntilBreakPoint(passedBreakPoint) {
  // Set our opcode breakpoint
  const breakPoint = parseInt(passedBreakPoint, 16);

  stepOpcode();

  const breakPointTask = async breakPoint => {
    const response = await WasmBoy._runWasmExport('executeFrameUntilBreakpoint', [breakPoint]);

    if (response === 0) {
      const continueSearchingForBreakPointTask = async () => {
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            resolve();
          });
        });

        return breakPointTask(breakPoint);
      };

      return continueSearchingForBreakPointTask();
    } else if (response === -1) {
      throw new Error('WasmBoy Crashed while trying to reach the breakpoint');
    }

    // We Reached the breakpoint!
    return true;
  };
  return breakPointTask(breakPoint);
}
