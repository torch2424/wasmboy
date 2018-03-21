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
  log
} from '../helpers/index';

// Everything Static as class instances just aren't quite there yet
// https://github.com/AssemblyScript/assemblyscript/blob/master/tests/compiler/showcase.ts
export class Cpu {

  // Status to track if we are in Gameboy Color Mode
  static GBCEnabled: boolean = false;

  // Clock Speed to determine all kinds of other values
  static clockSpeed: i32 = 4194304;

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
  static readonly CLOCK_SPEED: i32 = 4194304;
  static readonly MAX_CYCLES_PER_FRAME : i32 = 69905;

  // HALT and STOP instructions need to stop running opcodes, but simply check timers
  // https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // Matt said is should work to, so it must work!
  static isHalted: boolean = false;
  static isStopped: boolean = false;

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

export function initialize(useGBCMode: i32, includeBootRom: i32): void {

  // First, try to switch to Gameboy Color Mode

  // TODO: depending on the boot rom, initialization may be different
  // From: http://www.codeslinger.co.uk/pages/projects/gameboy/hardware.html
  // All values default to zero in memory, so not setting them yet
  log("initializing (includeBootRom=$0)", 1, includeBootRom);
  if(includeBootRom <= 0) {
    Cpu.programCounter = 0x100;
    Cpu.registerA = 0x01;
    Cpu.registerF = 0xB0;
    Cpu.registerB = 0x00;
    Cpu.registerC = 0x13;
    Cpu.registerD = 0x00;
    Cpu.registerE = 0xD8;
    Cpu.registerH = 0x01;
    Cpu.registerL = 0x4D;
    Cpu.stackPointer = 0xFFFE;
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
