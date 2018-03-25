import {
  eightBitStoreIntoGBMemory,
  eightBitLoadFromGBMemory,
  initializeCartridge,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';

import {
  initializeSound
} from '../sound/index'

import {
  log,
  hexLog
} from '../helpers/index';

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
  static memoryLocationSpeedSwitch: u16 = 0xFF4D;

  // Debugging properties
  static previousOpcode: u8 = 0x00;

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

    store<u16>(getSaveStateMemoryOffset(0x08, Cpu.saveStateSlot), Cpu.stackPointer);
    store<u16>(getSaveStateMemoryOffset(0x0A, Cpu.saveStateSlot), Cpu.programCounter);

    store<i32>(getSaveStateMemoryOffset(0x0C, Cpu.saveStateSlot), Cpu.currentCycles);

    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Cpu.saveStateSlot), Cpu.isHalted);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x12, Cpu.saveStateSlot), Cpu.isStopped);
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

    Cpu.stackPointer = load<u16>(getSaveStateMemoryOffset(0x08, Cpu.saveStateSlot));
    Cpu.programCounter = load<u16>(getSaveStateMemoryOffset(0x0A, Cpu.saveStateSlot));

    Cpu.currentCycles = load<i32>(getSaveStateMemoryOffset(0x0C, Cpu.saveStateSlot));

    Cpu.isHalted = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Cpu.saveStateSlot));
    Cpu.isStopped = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x12, Cpu.saveStateSlot));
  }
}

export function initialize(useGBCMode: i32 = 1, includeBootRom: i32 = 0): void {

  // First, try to switch to Gameboy Color Mode
  // Get our GBC support from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let gbcType: u8 = eightBitLoadFromGBMemory(0x0143);

  // Detecting GBC http://bgb.bircd.org/pandocs.htm#cgbregisters
  if (gbcType === 0xC0 ||
    (useGBCMode > 0 && gbcType === 0x80)) {
    Cpu.GBCEnabled = true;
  }

  // TODO: depending on the boot rom, initialization may be different
  // From: http://www.codeslinger.co.uk/pages/projects/gameboy/hardware.html
  // All values default to zero in memory, so not setting them yet
  log("initializing (includeBootRom=$0)", 1, includeBootRom);
  if(includeBootRom <= 0) {
    Cpu.programCounter = 0x100;
    if(Cpu.GBCEnabled) {
      Cpu.registerA = 0x11;
    } else {
      Cpu.registerA = 0x01;
    }
    Cpu.registerF = 0xB0;
    Cpu.registerB = 0x00;
    Cpu.registerC = 0x13;
    Cpu.registerD = 0x00;
    Cpu.registerE = 0xD8;
    Cpu.registerH = 0x01;
    Cpu.registerL = 0x4D;
    Cpu.stackPointer = 0xFFFE;

    // TODO: Get all initialization variables from something like BGB
    eightBitStoreIntoGBMemory(0xFF10, 0x80);
    eightBitStoreIntoGBMemory(0xFF11, 0xBF);
    eightBitStoreIntoGBMemory(0xFF12, 0xF3);
    eightBitStoreIntoGBMemory(0xFF14, 0xBF);
    eightBitStoreIntoGBMemory(0xFF16, 0x3F);
    eightBitStoreIntoGBMemory(0xFF17, 0x00);
    eightBitStoreIntoGBMemory(0xFF19, 0xBF);
    eightBitStoreIntoGBMemory(0xFF1A, 0x7F);
    eightBitStoreIntoGBMemory(0xFF1B, 0xFF);
    eightBitStoreIntoGBMemory(0xFF1C, 0x9F);
    eightBitStoreIntoGBMemory(0xFF1E, 0xBF);
    eightBitStoreIntoGBMemory(0xFF20, 0xFF);
    eightBitStoreIntoGBMemory(0xFF23, 0xBF);
    eightBitStoreIntoGBMemory(0xFF24, 0x77);
    eightBitStoreIntoGBMemory(0xFF25, 0xF3);
    eightBitStoreIntoGBMemory(0xFF26, 0xF1);
    eightBitStoreIntoGBMemory(0xFF40, 0x91);
    eightBitStoreIntoGBMemory(0xFF47, 0xFC);
    eightBitStoreIntoGBMemory(0xFF48, 0xFF);
    eightBitStoreIntoGBMemory(0xFF49, 0xFF);
    eightBitStoreIntoGBMemory(0xFF4D, 0x7E);

    if(Cpu.GBCEnabled) {
      // GBC Palettes
      eightBitStoreIntoGBMemory(0xFF68, 0xC0);
      eightBitStoreIntoGBMemory(0xFF69, 0xFF);
      eightBitStoreIntoGBMemory(0xFF6A, 0xC1);
      eightBitStoreIntoGBMemory(0xFF6B, 0x71);

      // Undocumented Registers
      eightBitStoreIntoGBMemory(0xFF6C, 0xFE);
      // FF74 is zero
    }

    // Call our memory to initialize our cartridge type
    initializeCartridge();

    // Initialize our sound registers
    initializeSound();
  }
}

// Private function for our relative jumps
export function relativeJump(value: u8): void {
  // Need to convert the value to i8, since in this case, u8 can be negative
  let relativeJumpOffset: i8 = <i8> value;

  Cpu.programCounter += relativeJumpOffset;
  // Realtive jump, using bgb debugger
  // and my debugger shows,
  // on JR you need to jump to the relative jump offset,
  // However, if the jump fails (such as conditional), only jump +2 in total

  Cpu.programCounter += 1;
}
