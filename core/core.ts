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
  return <i32>hasStarted;
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

  Config.enableBootRom = enableBootRom > 0;
  Config.useGbcWhenAvailable = useGbcWhenAvailable > 0;
  Config.audioBatchProcessing = audioBatchProcessing > 0;
  Config.graphicsBatchProcessing = graphicsBatchProcessing > 0;
  Config.timersBatchProcessing = timersBatchProcessing > 0;
  Config.graphicsDisableScanlineRendering = graphicsDisableScanlineRendering > 0;
  Config.audioAccumulateSamples = audioAccumulateSamples > 0;
  Config.tileRendering = tileRendering > 0;
  Config.tileCaching = tileCaching > 0;
  Config.enableAudioDebugging = enableAudioDebugging > 0;

  initialize();
}

// Function to initiialize the core
function initialize(): void {
  // Initialization variables from BGB

  // First, try to switch to Gameboy Color Mode
  // Get our GBC support from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let gbcType = eightBitLoadFromGBMemory(0x0143);

  // Detecting GBC http://bgb.bircd.org/pandocs.htm#cgbregisters
  if (gbcType === 0xc0 || (Config.useGbcWhenAvailable && gbcType === 0x80)) {
    Cpu.GBCEnabled = true;
  } else {
    Cpu.GBCEnabled = false;
  }

  // Reset hasStarted, since we are now reset
  setHasCoreStarted(false);

  // Reset our cycles ran
  resetCycles();
  resetSteps();

  if (Config.enableBootRom) {
    Cpu.BootROMEnabled = true;
  } else {
    Cpu.BootROMEnabled = false;
  }

  // Call our respective classes intialization
  // NOTE: Boot ROM Only handles some initialization, thus we need to check in each one
  // respecitvely :p
  initializeCpu();
  initializeCartridge();
  initializeDma();
  initializeGraphics();
  initializePalette();
  initializeSound();
  initializeInterrupts();
  initializeTimers();
  initializeSerial();
  initializeVarious();
}

function initializeVarious(): void {
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
}

// Function to return if we are currently playing a GBC ROM
export function isGBC(): i32 {
  return <i32>Cpu.GBCEnabled;
}

// Function to return an address to store into save state memory
// this is to regulate our 20 slots
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
// Inlined because closure compiler inlines
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
