// File to do per-opcode operations

import { WasmBoy } from '../../wasmboy';

// Function to run a  single opcode
export function stepOpcode() {
  const stepOpcodeTask = async () => {
    // We should pause wasmboy
    await WasmBoy.pause();
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
  let opcodesToRun = this.state.opcodesToRun;
  if (numberOfOpcodes) {
    opcodesToRun = numberOfOpcodes;
  }

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
export function breakPoint(skipInitialStep) {
  // Set our opcode breakpoint
  const breakPoint = parseInt(this.state.breakPoint, 16);

  const breakPointTask = async () => {
    if (!skipInitialStep) {
      await this.runNumberOfOpcodes(1, breakPoint);
    }

    const response = await WasmBoy._runWasmExport('executeFrameUntilBreakpoint', [breakPoint]);
    if (response === 0) {
      requestAnimationFrame(() => {
        this.updateExecutionProgress();
        this.updateValueTable();
        this.breakPoint(true);
      });
    } else if (response === -1) {
      throw new Error('WasmBoy Crashed while trying to reach the breakpoint');
    } else {
      console.log('Reached Breakpoint, that satisfies test inside runNumberOfOpcodes');
      this.updateExecutionProgress();
      this.updateValueTable();
    }
  };
  breakPointTask();
}
