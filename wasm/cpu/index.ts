// https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions
// https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js


// NOTE: Code is very verbose, and will have some copy pasta'd lines.
// Reason being, I want the code to be very accessible for errors later on.
// Also, the benefit on splitting into functions is organizarion, and keeping things DRY.
// But since I highly doubt the GB CPU will be changing, DRY is no longer an issue
// And the verbosity / ease of use is more important, imo.

// NOTE: Commands like SUB B, or AND C, without a second parameter, actually refer SUB A, B or AND A, C


export { setZeroFlag, getZeroFlag } from './flags';

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
  static programCounter: u16 = 0x100;

  static interruptsEnabled: boolean = false;
}

// Private function for our relative jumps
export function relativeJump(value: u8): void {
  // Need to convert the value to i8, since in this case, u8 can be negative
  let relativeJumpOffset: i8 = <i8> value;
  Cpu.programCounter += relativeJumpOffset;
  // TODO: Increase or decrease programCounter?
  // Undo programCounter offset at end
  Cpu.programCounter -= 1;
  // programCounter += 1; ?
}

export function setInterrupts(value: boolean): void {
  Cpu.interruptsEnabled = value;
}
