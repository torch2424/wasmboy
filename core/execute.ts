// Functions involving executing/running the emulator after initializtion

import { setHasCoreStarted } from './core';
import { syncCycles } from './cycles';
import { Cpu, executeOpcode } from './cpu/index';
import { checkInterrupts } from './interrupts/index';
import { eightBitLoadFromGBMemory } from './memory/index';
import { getNumberOfSamplesInAudioBuffer } from './sound/index';
import { u16Portable } from './portable/portable';

import { Breakpoints } from './debug/breakpoints';

export class Execute {
  // An even number bewlow the max 32 bit integer
  static stepsPerStepSet: i32 = 2000000000;
  static stepSets: i32 = 0;
  static steps: i32 = 0;

  // Response Codes from Execute Conditions
  static RESPONSE_CONDITION_ERROR: i32 = -1;
  static RESPONSE_CONDITION_FRAME: i32 = 0;
  static RESPONSE_CONDITION_AUDIO: i32 = 1;
  static RESPONSE_CONDITION_BREAKPOINT: i32 = 2;
}

export function getStepsPerStepSet(): i32 {
  return Execute.stepsPerStepSet;
}

export function getStepSets(): i32 {
  return Execute.stepSets;
}

export function getSteps(): i32 {
  return Execute.steps;
}

// Inlined because closure compiler inlines
function trackStepsRan(steps: i32): void {
  let esteps = Execute.steps;
  esteps += steps;
  if (esteps >= Execute.stepsPerStepSet) {
    Execute.stepSets += 1;
    esteps -= Execute.stepsPerStepSet;
  }
  Execute.steps = esteps;
}

// Inlined because closure compiler inlines
export function resetSteps(): void {
  Execute.stepsPerStepSet = 2000000000;
  Execute.stepSets = 0;
  Execute.steps = 0;
}

// // Public funciton to run frames until,
// the specified number of frames have run or error.
// Return values:
// -1 = error
// 0 = render a frame
export function executeMultipleFrames(numberOfFrames: i32): i32 {
  let frameResponse = 0;
  let framesRun = 0;
  while (framesRun < numberOfFrames && frameResponse >= 0) {
    frameResponse = executeFrame();
    framesRun += 1;
  }

  if (frameResponse < 0) {
    return frameResponse;
  }

  return 0;
}

// Public funciton to run opcodes until,
// a frame is ready, or error.
// Return values:
// -1 = error
// 0 = render a frame
export function executeFrame(): i32 {
  return executeUntilCondition(true, -1);
}

// Public Function to run opcodes until,
// a frame is ready, audio bufer is filled, or error
export function executeFrameAndCheckAudio(maxAudioBuffer: i32 = 0): i32 {
  return executeUntilCondition(true, maxAudioBuffer);
}

// Base function that executes steps, and checks conditions
// Return values:
export function executeUntilCondition(checkMaxCyclesPerFrame: boolean = true, maxAudioBuffer: i32 = -1): i32 {
  // Common tracking variables
  let numberOfCycles = -1;
  let audioBufferSize = 1024;

  if (maxAudioBuffer > 0) {
    audioBufferSize = maxAudioBuffer;
  } else if (maxAudioBuffer < 0) {
    audioBufferSize = -1;
  }

  let errorCondition: boolean = false;
  let frameCondition: boolean = false;
  let audioBufferCondition: boolean = false;

  while (!errorCondition && !frameCondition && !audioBufferCondition && !Breakpoints.reachedBreakpoint) {
    numberOfCycles = executeStep();

    // Error Condition
    if (numberOfCycles < 0) {
      errorCondition = true;
    } else if (Cpu.currentCycles >= Cpu.MAX_CYCLES_PER_FRAME()) {
      frameCondition = true;
    } else if (audioBufferSize > -1 && getNumberOfSamplesInAudioBuffer() >= audioBufferSize) {
      audioBufferCondition = true;
    }
  }

  // Find our exit reason
  if (frameCondition) {
    // Render a frame

    // Reset our currentCycles
    Cpu.currentCycles -= Cpu.MAX_CYCLES_PER_FRAME();

    return Execute.RESPONSE_CONDITION_FRAME;
  }

  if (audioBufferCondition) {
    return Execute.RESPONSE_CONDITION_AUDIO;
  }

  if (Breakpoints.reachedBreakpoint) {
    Breakpoints.reachedBreakpoint = false;
    return Execute.RESPONSE_CONDITION_BREAKPOINT;
  }

  // TODO: Boot ROM handling

  // There was an error, return -1, and push the program counter back to grab the error opcode
  Cpu.programCounter = u16Portable(Cpu.programCounter - 1);
  return -1;
}

// Function to execute an opcode, and update other gameboy hardware.
// http://www.codeslinger.co.uk/pages/projects/gameboy/beginning.html
export function executeStep(): i32 {
  // Set has started to 1 since we ran a emulation step
  setHasCoreStarted(true);

  // Check if we are in the halt bug
  if (Cpu.isHaltBug) {
    // Need to not increment program counter,
    // thus, running the next opcode twice

    // E.g
    // 0x76 - halt
    // FA 34 12 - ld a,(1234)
    // Becomes
    // FA FA 34 ld a,(34FA)
    // 12 ld (de),a

    let haltBugOpcode: i32 = <u8>eightBitLoadFromGBMemory(Cpu.programCounter);
    // Execute opcode will handle the actual PC behavior
    let haltBugCycles: i32 = executeOpcode(haltBugOpcode);
    syncCycles(haltBugCycles);
    Cpu.exitHaltAndStop();
  }

  // Interrupts should be handled before reading an opcode
  // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
  let interruptCycles: i32 = checkInterrupts();
  if (interruptCycles > 0) {
    syncCycles(interruptCycles);
  }

  // Get the opcode, and additional bytes to be handled
  // Number of cycles defaults to 4, because while we're halted, we run 4 cycles (according to matt :))
  let numberOfCycles = 4;
  let opcode = 0;

  // If we are not halted or stopped, run instructions
  // If we are halted, this will be skipped and just sync the 4 cycles
  if (!Cpu.isHalted() && !Cpu.isStopped) {
    opcode = <u8>eightBitLoadFromGBMemory(Cpu.programCounter);
    numberOfCycles = executeOpcode(opcode);
  }

  // blarggFixes, don't allow register F to have the bottom nibble
  Cpu.registerF = Cpu.registerF & 0xf0;

  // Check if there was an error decoding the opcode
  if (numberOfCycles <= 0) {
    return numberOfCycles;
  }

  // Sync other GB Components with the number of cycles
  syncCycles(numberOfCycles);

  // Update our steps
  trackStepsRan(1);

  // Check if we reached the CPU breakpoint
  if (Cpu.programCounter === Breakpoints.programCounter) {
    Breakpoints.reachedBreakpoint = true;
  }

  return numberOfCycles;
}
