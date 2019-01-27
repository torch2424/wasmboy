// Imports
import { WASMBOY_WASM_PAGES, WASMBOY_STATE_LOCATION } from './constants';
import { Config } from './config';
import { resetCycles } from './cycles';
import { resetSteps } from './execute';
import { Cpu, initializeCpu } from './cpu/index';
import { Graphics, initializeGraphics, initializePalette } from './graphics/index';
import { Interrupts, initializeInterrupts } from './interrupts/index';
import { Joypad } from './joypad/index';
import { Memory, initializeCartridge, initializeDma, eightBitStoreIntoGBMemory, eightBitLoadFromGBMemory } from './memory/index';
import { Timers, initializeTimers } from './timers/index';
import { Sound, initializeSound, Channel1, Channel2, Channel3, Channel4 } from './sound/index';
import { initializeSerial } from './serial/serial';
import { hexLog, log } from './helpers/index';
import { u16Portable } from './portable/portable';

// Grow our memory to the specified size
if (memory.size() < WASMBOY_WASM_PAGES) {
  memory.grow(WASMBOY_WASM_PAGES - memory.size());
}

// Function to track if the core has started
let hasStarted: boolean = false;
export function setHasCoreStarted(value: boolean): void {
  hasStarted = value;
}
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
  tileCaching: i32,
  enableAudioDebugging: i32
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

  if (enableAudioDebugging > 0) {
    Config.enableAudioDebugging = true;
  } else {
    Config.enableAudioDebugging = false;
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
  initializeInterrupts();
  initializeTimers();
  initializeSerial();

  // Various Other Registers
  if (Cpu.GBCEnabled) {
    // Various other registers
    eightBitStoreIntoGBMemory(0xff70, 0xf8);
    eightBitStoreIntoGBMemory(0xff4f, 0xfe);
    eightBitStoreIntoGBMemory(0xff4d, 0x7e);
    eightBitStoreIntoGBMemory(0xff00, 0xcf);

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

    eightBitStoreIntoGBMemory(0xff0f, 0xe1);
    // 0xFFFF = 0x00
  }

  // Reset hasStarted, since we are now reset
  setHasCoreStarted(false);

  // Reset our cycles ran
  resetCycles();
  resetSteps();
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
  setHasCoreStarted(false);

  // Don't want to reset cycles here, as this does not reset the emulator
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
  setHasCoreStarted(false);

  // Reset our cycles ran
  resetCycles();
  resetSteps();
}
