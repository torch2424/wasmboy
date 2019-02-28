import { getCarryFlag } from '../cpu/index';
import { u8Portable } from '../portable/portable';

// Grouped registers
// possible overload these later to performace actions
// AF, BC, DE, HL
export function concatenateBytes(highByte: i32, lowByte: i32): i32 {
  //https://stackoverflow.com/questions/38298412/convert-two-bytes-into-signed-16-bit-integer-in-javascript
  return ((highByte & 0xff) << 8) | (lowByte & 0xff);
}

export function splitHighByte(groupedByte: i32): i32 {
  return (groupedByte & 0xff00) >> 8;
}

export function splitLowByte(groupedByte: i32): i32 {
  return groupedByte & 0x00ff;
}

export function rotateByteLeft(value: u8): u8 {
  // Rotate left
  // https://stackoverflow.com/questions/19204750/how-do-i-perform-a-circular-rotation-of-a-byte
  // 4-bit example:
  // 1010 -> 0100 | 0001
  return u8Portable((value << 1) | (value >> 7));
}

export function rotateByteLeftThroughCarry(value: u8): u8 {
  // Example: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // Through carry meaning, instead of raotating the bit that gets dropped off, but the carry there instead
  return u8Portable((value << 1) | getCarryFlag());
}

export function rotateByteRight(value: u8): u8 {
  // Rotate right
  // 4-bit example:
  // 1010 -> 0101 | 0000
  return u8Portable((value >> 1) | (value << 7));
}

export function rotateByteRightThroughCarry(value: u8): u8 {
  // Example: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // Through carry meaning, instead of raotating the bit that gets dropped off, put the carry there instead
  return u8Portable((value >> 1) | (getCarryFlag() << 7));
}

export function setBitOnByte(bitPosition: i32, byte: i32): i32 {
  return byte | (0x01 << bitPosition);
}

export function resetBitOnByte(bitPosition: i32, byte: i32): i32 {
  return byte & ~(0x01 << bitPosition);
}

export function checkBitOnByte(bitPosition: i32, byte: i32): boolean {
  // Perforamnce improvements
  // https://github.com/AssemblyScript/assemblyscript/issues/40
  return (byte & (1 << bitPosition)) != 0;
}

// Declared importObject functions
declare function consoleLog(arg0: i32, arg1: i32): void;
declare function consoleLogTimeout(arg0: i32, arg1: i32, timeout: i32): void;

export function log(arg0: i32, arg1: i32): void {
  consoleLog(arg0, arg1);
}

export function logTimeout(arg0: i32, arg1: i32, timeout: i32): void {
  consoleLogTimeout(arg0, arg1, timeout);
}
