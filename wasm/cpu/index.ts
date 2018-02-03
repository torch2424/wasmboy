// https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions
// https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js


// NOTE: Code is very verbose, and will have some copy pasta'd lines.
// Reason being, I want the code to be very accessible for errors later on.
// Also, the benefit on splitting into functions is organizarion, and keeping things DRY.
// But since I highly doubt the GB CPU will be changing, DRY is no longer an issue
// And the verbosity / ease of use is more important, imo.

// NOTE: Commands like SUB B, or AND C, without a second parameter, actually refer SUB A, B or AND A, C


export { setZeroFlag, getZeroFlag } from './flags';

import { eightBitStoreIntoGBMemory, eightBitLoadFromGBMemory } from '../memory/index';

// Everything Static as class instances just aren't quite there yet
// https://github.com/AssemblyScript/assemblyscript/blob/master/tests/compiler/showcase.ts
export class Cpu {
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
  // TODO: Export these Constants
  static CLOCK_SPEED: i32 = 4194304;
  static MAX_CYCLES_PER_FRAME : i32 = 69905;
}

export function initialize(includeBootRom: boolean): void {
  // TODO: depending on the boot rom, initialization may be different
  // From: http://www.codeslinger.co.uk/pages/projects/gameboy/hardware.html
  // All values default to zero in memory, so not setting them yet
  Cpu.programCounter = 0x100;
  Cpu.registerA = 0x01;
  Cpu.registerF = 0xB0;
  Cpu.registerB = 0x00;
  Cpu.registerC = 0x13;
  Cpu.registerD = 0x00;
  Cpu.registerE = 0xD8;
  Cpu.registerH = 0x01;
  Cpu.registerL = 0xD8;
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
}

// Private function for our relative jumps
export function relativeJump(value: u8): void {
  // Need to convert the value to i8, since in this case, u8 can be negative
  let relativeJumpOffset: i8 = <i8> value;
  Cpu.programCounter += relativeJumpOffset;
  // TODO: Increase or decrease programCounter?
  // Undo programCounter offset at end
  Cpu.programCounter += 1;
  // programCounter += 1; ?
}
