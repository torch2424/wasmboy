import {
  eightBitStoreIntoGBMemoryWithTraps,
  eightBitStoreIntoGBMemory,
  eightBitLoadFromGBMemoryWithTraps,
  eightBitLoadFromGBMemory,
  initializeCartridge,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from "../memory/index";

import { initializeGraphics } from "../graphics/index";

import { initializeSound } from "../sound/index";

import { initializeTimers } from "../timers/index";

import { log, hexLog } from "../helpers/index";

// Everything Static as class instances just aren't quite there yet
// https://github.com/AssemblyScript/assemblyscript/blob/master/tests/compiler/showcase.ts
export class Cpu {
  // Status to track if we are in Gameboy Color Mode, and GBC State
  static GBCEnabled: boolean = false;
  static GBCDoubleSpeed: boolean = false;

  // 8-bit Cpu.registers
  static registerA: u8 = 0;
  static registerB: u8 = 0;
  static registerC: u8 = 0;
  static registerD: u8 = 0;
  static registerE: u8 = 0;
  static registerH: u8 = 0;
  static registerL: u8 = 0;
  static registerF: u8 = 0;

  // 16-bit Cpu.registers
  static stackPointer: u16 = 0;
  // Boot rom from 0x00 to 0x99, all games start at 0x100
  static programCounter: u16 = 0x00;

  // Current number of cycles, shouldn't execeed max number of cycles
  static currentCycles: i32 = 0;
  static CLOCK_SPEED(): i32 {
    if (Cpu.GBCDoubleSpeed) {
      // 2^23, thanks binji!
      return 8388608;
    }

    return 4194304;
  }

  // cycles = 154 scanlines, 456 cycles per line
  static MAX_CYCLES_PER_FRAME(): i32 {
    if (Cpu.GBCDoubleSpeed) {
      return 140448;
    }

    return 70224;
  }

  // HALT and STOP instructions need to stop running opcodes, but simply check timers
  // https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // Matt said is should work to, so it must work!
  static isHalted: boolean = false;
  static isStopped: boolean = false;

  // Memory Location for the GBC Speed switch
  static readonly memoryLocationSpeedSwitch: u16 = 0xff4d;

  // Save States
  static readonly saveStateSlot: u16 = 0;

  // Function to save the state of the class
  static saveState(): void {
    // Registers
    store<u8>(getSaveStateMemoryOffset(0x00, Cpu.saveStateSlot), Cpu.registerA);
    store<u8>(getSaveStateMemoryOffset(0x01, Cpu.saveStateSlot), Cpu.registerB);
    store<u8>(getSaveStateMemoryOffset(0x02, Cpu.saveStateSlot), Cpu.registerC);
    store<u8>(getSaveStateMemoryOffset(0x03, Cpu.saveStateSlot), Cpu.registerD);
    store<u8>(getSaveStateMemoryOffset(0x04, Cpu.saveStateSlot), Cpu.registerE);
    store<u8>(getSaveStateMemoryOffset(0x05, Cpu.saveStateSlot), Cpu.registerH);
    store<u8>(getSaveStateMemoryOffset(0x06, Cpu.saveStateSlot), Cpu.registerL);
    store<u8>(getSaveStateMemoryOffset(0x07, Cpu.saveStateSlot), Cpu.registerF);

    store<u16>(
      getSaveStateMemoryOffset(0x08, Cpu.saveStateSlot),
      Cpu.stackPointer
    );
    store<u16>(
      getSaveStateMemoryOffset(0x0a, Cpu.saveStateSlot),
      Cpu.programCounter
    );

    store<i32>(
      getSaveStateMemoryOffset(0x0c, Cpu.saveStateSlot),
      Cpu.currentCycles
    );

    storeBooleanDirectlyToWasmMemory(
      getSaveStateMemoryOffset(0x11, Cpu.saveStateSlot),
      Cpu.isHalted
    );
    storeBooleanDirectlyToWasmMemory(
      getSaveStateMemoryOffset(0x12, Cpu.saveStateSlot),
      Cpu.isStopped
    );
  }

  // Function to load the save state from memory
  static loadState(): void {
    // Registers
    Cpu.registerA = load<u8>(getSaveStateMemoryOffset(0x00, Cpu.saveStateSlot));
    Cpu.registerB = load<u8>(getSaveStateMemoryOffset(0x01, Cpu.saveStateSlot));
    Cpu.registerC = load<u8>(getSaveStateMemoryOffset(0x02, Cpu.saveStateSlot));
    Cpu.registerD = load<u8>(getSaveStateMemoryOffset(0x03, Cpu.saveStateSlot));
    Cpu.registerE = load<u8>(getSaveStateMemoryOffset(0x04, Cpu.saveStateSlot));
    Cpu.registerH = load<u8>(getSaveStateMemoryOffset(0x05, Cpu.saveStateSlot));
    Cpu.registerL = load<u8>(getSaveStateMemoryOffset(0x06, Cpu.saveStateSlot));
    Cpu.registerF = load<u8>(getSaveStateMemoryOffset(0x07, Cpu.saveStateSlot));

    Cpu.stackPointer = load<u16>(
      getSaveStateMemoryOffset(0x08, Cpu.saveStateSlot)
    );
    Cpu.programCounter = load<u16>(
      getSaveStateMemoryOffset(0x0a, Cpu.saveStateSlot)
    );

    Cpu.currentCycles = load<i32>(
      getSaveStateMemoryOffset(0x0c, Cpu.saveStateSlot)
    );

    Cpu.isHalted = loadBooleanDirectlyFromWasmMemory(
      getSaveStateMemoryOffset(0x11, Cpu.saveStateSlot)
    );
    Cpu.isStopped = loadBooleanDirectlyFromWasmMemory(
      getSaveStateMemoryOffset(0x12, Cpu.saveStateSlot)
    );
  }
}

export function initializeCpu(
  useGBCMode: i32 = 1,
  includeBootRom: i32 = 0
): void {
  // First, try to switch to Gameboy Color Mode
  // Get our GBC support from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let gbcType: i32 = eightBitLoadFromGBMemory(0x0143);

  // Detecting GBC http://bgb.bircd.org/pandocs.htm#cgbregisters
  if (gbcType === 0xc0 || (useGBCMode > 0 && gbcType === 0x80)) {
    Cpu.GBCEnabled = true;
  }

  // TODO: depending on the boot rom, initialization may be different
  // From: http://www.codeslinger.co.uk/pages/projects/gameboy/hardware.html
  // All values default to zero in memory, so not setting them yet
  log("initializing (includeBootRom=$0)", 1, includeBootRom);
  if (includeBootRom <= 0) {
    // Initialization variables from BGB

    if (Cpu.GBCEnabled) {
      // CPU Registers
      Cpu.registerA = 0x11;
      Cpu.registerF = 0x80;
      Cpu.registerB = 0x00;
      Cpu.registerC = 0x00;
      Cpu.registerD = 0xff;
      Cpu.registerE = 0x56;
      Cpu.registerH = 0x00;
      Cpu.registerL = 0x0d;

      // Cpu Control Flow
      Cpu.programCounter = 0x100;
      Cpu.stackPointer = 0xfffe;

      // LCD / Graphics
      // In initializeGraphics()

      // Various other registers
      eightBitStoreIntoGBMemory(0xff70, 0xf8);
      eightBitStoreIntoGBMemory(0xff4f, 0xfe);
      eightBitStoreIntoGBMemory(0xff4d, 0x7e);
      eightBitStoreIntoGBMemory(0xff00, 0xcf);
      // FF01 = 0x00
      eightBitStoreIntoGBMemory(0xff02, 0x7c);

      // Handled by Updatye timers

      eightBitStoreIntoGBMemory(0xff0f, 0xe1);
      // 0xFFFF = 0x00

      // GBC Palettes
      eightBitStoreIntoGBMemory(0xff68, 0xc0);
      eightBitStoreIntoGBMemory(0xff69, 0xff);
      eightBitStoreIntoGBMemory(0xff6a, 0xc1);
      eightBitStoreIntoGBMemory(0xff6b, 0x0d);

      // GBC Banks
      eightBitStoreIntoGBMemory(0xff4f, 0x00);
      eightBitStoreIntoGBMemory(0xff70, 0x01);

      // GBC DMA
      eightBitStoreIntoGBMemory(0xff51, 0xff);
      eightBitStoreIntoGBMemory(0xff52, 0xff);
      eightBitStoreIntoGBMemory(0xff53, 0xff);
      eightBitStoreIntoGBMemory(0xff54, 0xff);
      eightBitStoreIntoGBMemory(0xff55, 0xff);

      // Undocumented from Pandocs
      eightBitStoreIntoGBMemory(0xff6c, 0xfe);
      eightBitStoreIntoGBMemory(0xff75, 0x8f);
    } else {
      // Cpu Registers
      Cpu.registerA = 0x01;
      Cpu.registerF = 0xb0;
      Cpu.registerB = 0x00;
      Cpu.registerC = 0x13;
      Cpu.registerD = 0x00;
      Cpu.registerE = 0xd8;
      Cpu.registerH = 0x01;
      Cpu.registerL = 0x4d;

      // Cpu Control Flow
      Cpu.programCounter = 0x100;
      Cpu.stackPointer = 0xfffe;

      // LCD / Graphics
      // In initializeGraphics

      // Various other registers
      eightBitStoreIntoGBMemory(0xff70, 0xff);
      eightBitStoreIntoGBMemory(0xff4f, 0xff);
      eightBitStoreIntoGBMemory(0xff4d, 0xff);
      eightBitStoreIntoGBMemory(0xff00, 0xcf);
      // FF01 = 0x00
      eightBitStoreIntoGBMemory(0xff02, 0x7e);

      // handled by initializxeTimers

      eightBitStoreIntoGBMemory(0xff0f, 0xe1);
      // 0xFFFF = 0x00

      // GBC Palettes
      eightBitStoreIntoGBMemory(0xff68, 0xff);
      eightBitStoreIntoGBMemory(0xff69, 0xff);
      eightBitStoreIntoGBMemory(0xff6a, 0xff);
      eightBitStoreIntoGBMemory(0xff6b, 0xff);

      // GBC Banks
      eightBitStoreIntoGBMemory(0xff4f, 0x00);
      eightBitStoreIntoGBMemory(0xff70, 0x01);

      // GBC DMA
      eightBitStoreIntoGBMemory(0xff51, 0xff);
      eightBitStoreIntoGBMemory(0xff52, 0xff);
      eightBitStoreIntoGBMemory(0xff53, 0xff);
      eightBitStoreIntoGBMemory(0xff54, 0xff);
      eightBitStoreIntoGBMemory(0xff55, 0xff);
    }

    // Call our memory to initialize our cartridge type
    initializeCartridge();

    // Initialize our graphics registers
    initializeGraphics();

    // Initialize our sound registers
    initializeSound();

    initializeTimers();
  }
}
