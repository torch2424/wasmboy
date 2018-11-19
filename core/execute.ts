// Functions involving executing/running the emulator after initializtion

import { setHasCoreStarted } from './core';
import { syncCycles } from './cycles';
import { Cpu, executeOpcode } from './cpu/index';
import { Interrupts, checkInterrupts } from './interrupts/index';
import { eightBitStoreIntoGBMemory, eightBitLoadFromGBMemory } from './memory/index';
import { Sound, getNumberOfSamplesInAudioBuffer } from './sound/index';
import { hexLog, log } from './helpers/index';
import { u16Portable } from './portable/portable';

// Public funciton to run opcodes until,
// a frame is ready, or error.
// Return values:
// -1 = error
// 0 = render a frame
export function executeFrame(): i32 {
  let response: i32 = executeFrameAndCheckAudio();

  // Find our exit reason
  if (response === -1) {
    return -1;
  } else if (response === 0) {
    return 0;
  }

  // We left because of audio, simply keep running
  return executeFrame();
}

// Public Function to run opcodes until,
// a frame is ready, audio bufer is filled, or error
// -1 = error
// 0 = render a frame
// 1 = output audio
export function executeFrameAndCheckAudio(maxAudioBuffer: i32 = 0): i32 {
  let error: boolean = false;
  let numberOfCycles: i32 = -1;
  let audioBufferSize: i32 = 1024;

  if (maxAudioBuffer && maxAudioBuffer > 0) {
    audioBufferSize = maxAudioBuffer;
  }

  while (!error && Cpu.currentCycles < Cpu.MAX_CYCLES_PER_FRAME() && getNumberOfSamplesInAudioBuffer() < audioBufferSize) {
    numberOfCycles = executeStep();
    if (numberOfCycles < 0) {
      error = true;
    }
  }

  // Find our exit reason
  if (Cpu.currentCycles >= Cpu.MAX_CYCLES_PER_FRAME()) {
    // Render a frame

    // Reset our currentCycles
    Cpu.currentCycles -= Cpu.MAX_CYCLES_PER_FRAME();

    return 0;
  }
  if (getNumberOfSamplesInAudioBuffer() >= audioBufferSize) {
    // Output Audio
    return 1;
  }

  // TODO: Boot ROM handling

  // There was an error, return -1, and push the program counter back to grab the error opcode
  Cpu.programCounter = u16Portable(Cpu.programCounter - 1);
  return -1;
}

// Public function to run opcodes until,
// a breakpoint is reached
// -1 = error
// 0 = frame executed
// 1 = reached breakpoint
export function executeFrameUntilBreakpoint(breakpoint: i32): i32 {
  let error: boolean = false;
  let numberOfCycles: i32 = -1;

  while (!error && Cpu.currentCycles < Cpu.MAX_CYCLES_PER_FRAME() && Cpu.programCounter !== breakpoint) {
    numberOfCycles = executeStep();
    if (numberOfCycles < 0) {
      error = true;
    }
  }

  // Find our exit reason
  if (Cpu.currentCycles >= Cpu.MAX_CYCLES_PER_FRAME()) {
    // Render a frame

    // Reset our currentCycles
    Cpu.currentCycles -= Cpu.MAX_CYCLES_PER_FRAME();

    return 0;
  }
  if (Cpu.programCounter === breakpoint) {
    // breakpoint
    return 1;
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
  let numberOfCycles: i32 = 4;
  let opcode: i32 = 0;

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

  return numberOfCycles;
}
