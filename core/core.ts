// Imports
import { WASMBOY_STATE_LOCATION } from './constants';
import { Cpu, initializeCpu, executeOpcode } from './cpu/index';
import { Graphics, initializeGraphics, initializePalette, updateGraphics, batchProcessGraphics } from './graphics/index';
import { Interrupts, checkInterrupts } from './interrupts/index';
import { Joypad } from './joypad/index';
import { Memory, initializeCartridge, initializeDma, eightBitStoreIntoGBMemory, eightBitLoadFromGBMemory } from './memory/index';
import { Timers, initializeTimers, updateTimers, batchProcessTimers } from './timers/index';
import {
  Sound,
  initializeSound,
  Channel1,
  Channel2,
  Channel3,
  Channel4,
  updateSound,
  getNumberOfSamplesInAudioBuffer
} from './sound/index';
import { WASMBOY_WASM_PAGES } from './constants';
import { Config } from './config';
import { hexLog, log } from './helpers/index';
import { u16Portable } from './portable/portable';

// Grow our memory to the specified size
if (memory.size() < WASMBOY_WASM_PAGES) {
  memory.grow(WASMBOY_WASM_PAGES - memory.size());
}

// Function to track if the core has started
let hasStarted: boolean = false;
export function hasCoreStarted(): i32 {
  if (hasStarted) {
    return 1;
  }

  return 0;
}

// Function to configure & initialize wasmboy
export function config(
  enableBootRom: i32,
  useGbcWhenAvailable: i32,
  audioBatchProcessing: i32,
  graphicsBatchProcessing: i32,
  timersBatchProcessing: i32,
  graphicsDisableScanlineRendering: i32,
  audioAccumulateSamples: i32,
  tileRendering: i32,
  tileCaching: i32
): void {
  // TODO: depending on the boot rom, initialization may be different
  // From: http://www.codeslinger.co.uk/pages/projects/gameboy/hardware.html
  // All values default to zero in memory, so not setting them yet
  // log('initializing (includeBootRom=$0)', 1, enableBootRom);

  if (enableBootRom > 0) {
    Config.enableBootRom = true;
  } else {
    Config.enableBootRom = false;
  }

  if (useGbcWhenAvailable > 0) {
    Config.useGbcWhenAvailable = true;
  } else {
    Config.useGbcWhenAvailable = false;
  }

  if (audioBatchProcessing > 0) {
    Config.audioBatchProcessing = true;
  } else {
    Config.audioBatchProcessing = false;
  }

  if (graphicsBatchProcessing > 0) {
    Config.graphicsBatchProcessing = true;
  } else {
    Config.graphicsBatchProcessing = false;
  }

  if (timersBatchProcessing > 0) {
    Config.timersBatchProcessing = true;
  } else {
    Config.timersBatchProcessing = false;
  }

  if (graphicsDisableScanlineRendering > 0) {
    Config.graphicsDisableScanlineRendering = true;
  } else {
    Config.graphicsDisableScanlineRendering = false;
  }

  if (audioAccumulateSamples > 0) {
    Config.audioAccumulateSamples = true;
  } else {
    Config.audioAccumulateSamples = false;
  }

  if (tileRendering > 0) {
    Config.tileRendering = true;
  } else {
    Config.tileRendering = false;
  }

  if (tileCaching > 0) {
    Config.tileCaching = true;
  } else {
    Config.tileCaching = false;
  }

  initialize();
}

// Function to initiialize the core
function initialize(): void {
  // Initialization variables from BGB

  // First, try to switch to Gameboy Color Mode
  // Get our GBC support from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let gbcType: i32 = eightBitLoadFromGBMemory(0x0143);

  // Detecting GBC http://bgb.bircd.org/pandocs.htm#cgbregisters
  if (gbcType === 0xc0 || (Config.useGbcWhenAvailable && gbcType === 0x80)) {
    Cpu.GBCEnabled = true;
  } else {
    Cpu.GBCEnabled = false;
  }

  // Call our respective classes intialization
  initializeCpu();
  initializeCartridge();
  initializeDma();
  initializeGraphics();
  initializePalette();
  initializeSound();
  initializeTimers();

  // Various Other Registers
  if (Cpu.GBCEnabled) {
    // Various other registers
    eightBitStoreIntoGBMemory(0xff70, 0xf8);
    eightBitStoreIntoGBMemory(0xff4f, 0xfe);
    eightBitStoreIntoGBMemory(0xff4d, 0x7e);
    eightBitStoreIntoGBMemory(0xff00, 0xcf);
    // FF01 = 0x00
    eightBitStoreIntoGBMemory(0xff02, 0x7c);

    eightBitStoreIntoGBMemory(0xff0f, 0xe1);
    // 0xFFFF = 0x00

    // Undocumented from Pandocs
    eightBitStoreIntoGBMemory(0xff6c, 0xfe);
    eightBitStoreIntoGBMemory(0xff75, 0x8f);
  } else {
    eightBitStoreIntoGBMemory(0xff70, 0xff);
    eightBitStoreIntoGBMemory(0xff4f, 0xff);
    eightBitStoreIntoGBMemory(0xff4d, 0xff);
    eightBitStoreIntoGBMemory(0xff00, 0xcf);
    // FF01 = 0x00
    eightBitStoreIntoGBMemory(0xff02, 0x7e);

    eightBitStoreIntoGBMemory(0xff0f, 0xe1);
    // 0xFFFF = 0x00
  }

  // Reset hasStarted, since we are now reset
  hasStarted = false;
}

// Public funciton to run opcodes until,
// a frame is ready, or error.
// Return values:
// -1 = error
// 0 = render a frame
export function executeFrame(): i32 {
  let error: boolean = false;
  let numberOfCycles: i32 = -1;

  while (!error && Cpu.currentCycles < Cpu.MAX_CYCLES_PER_FRAME()) {
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
  // TODO: Boot ROM handling

  // There was an error, return -1, and push the program counter back to grab the error opcode
  Cpu.programCounter = u16Portable(Cpu.programCounter - 1);
  return -1;
}

// Public Function to run opcodes until,
// a frame is ready, audio bufer is filled, or error
// -1 = error
// 0 = render a frame
// 1 = output audio
export function executeFrameAndCheckAudio(maxAudioBuffer: i32): i32 {
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
  hasStarted = true;

  // Get the opcode, and additional bytes to be handled
  // Number of cycles defaults to 4, because while we're halted, we run 4 cycles (according to matt :))
  let numberOfCycles: i32 = 4;
  let opcode: i32 = 0;

  // Cpu Halting best explained: https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/db7xnbe/
  if (!Cpu.isHalted && !Cpu.isStopped) {
    opcode = <u8>eightBitLoadFromGBMemory(Cpu.programCounter);
    numberOfCycles = executeOpcode(opcode);
  } else {
    // if we were halted, and interrupts were disabled but interrupts are pending, stop waiting
    if (Cpu.isHalted && !Interrupts.masterInterruptSwitch && Interrupts.areInterruptsPending()) {
      Cpu.isHalted = false;
      Cpu.isStopped = false;

      // Need to run the next opcode twice, it's a bug menitoned in
      // The reddit comment mentioned above

      // CTRL+F "low-power" on gameboy cpu manual
      // http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf
      // E.g
      // 0x76 - halt
      // FA 34 12 - ld a,(1234)
      // Becomes
      // FA FA 34 ld a,(34FA)
      // 12 ld (de),a
      opcode = <u8>eightBitLoadFromGBMemory(Cpu.programCounter);
      numberOfCycles = executeOpcode(opcode);
      Cpu.programCounter = u16Portable(Cpu.programCounter - 1);
    }
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

// Sync other GB Components with the number of cycles
export function syncCycles(numberOfCycles: i32): void {
  // Check if we did a DMA TRansfer, if we did add the cycles
  if (Memory.DMACycles > 0) {
    numberOfCycles += Memory.DMACycles;
    Memory.DMACycles = 0;
  }

  // Interrupt Handling requires 20 cycles
  // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
  numberOfCycles += checkInterrupts();

  // Finally, Add our number of cycles to the CPU Cycles
  Cpu.currentCycles += numberOfCycles;

  // Check other Gameboy components
  if (!Cpu.isStopped) {
    if (Config.graphicsBatchProcessing) {
      // Need to do this, since a lot of things depend on the scanline
      // Batch processing will simply return if the number of cycles is too low
      Graphics.currentCycles += numberOfCycles;
      batchProcessGraphics();
    } else {
      updateGraphics(numberOfCycles);
    }

    if (Config.audioBatchProcessing) {
      Sound.currentCycles += numberOfCycles;
    } else {
      updateSound(numberOfCycles);
    }
  }

  if (Config.timersBatchProcessing) {
    // Batch processing will simply return if the number of cycles is too low
    Timers.currentCycles += numberOfCycles;
    batchProcessTimers();
  } else {
    updateTimers(numberOfCycles);
  }
}

// Function to return an address to store into save state memory
// this is to regulate our 20 slots
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
export function getSaveStateMemoryOffset(offset: i32, saveStateSlot: i32): i32 {
  // 50 bytes per save state memory partiton sli32
  return WASMBOY_STATE_LOCATION + offset + 50 * saveStateSlot;
}

// Function to save state to memory for all of our classes
export function saveState(): void {
  Cpu.saveState();
  Graphics.saveState();
  Interrupts.saveState();
  Joypad.saveState();
  Memory.saveState();
  Timers.saveState();
  Sound.saveState();
  Channel1.saveState();
  Channel2.saveState();
  Channel3.saveState();
  Channel4.saveState();

  // Reset hasStarted, since we are now reset
  hasStarted = false;
}

// Function to load state from memory for all of our classes
export function loadState(): void {
  Cpu.loadState();
  Graphics.loadState();
  Interrupts.loadState();
  Joypad.loadState();
  Memory.loadState();
  Timers.loadState();
  Sound.loadState();
  Channel1.loadState();
  Channel2.loadState();
  Channel3.loadState();
  Channel4.loadState();

  // Reset hasStarted, since we are now reset
  hasStarted = false;
}
