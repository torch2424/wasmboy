import {
  getCarryFlag
} from '../cpu/flags';

// Grouped registers
// possible overload these later to performace actions
// AF, BC, DE, HL
export function concatenateBytes(highByte: u8, lowByte: u8): u16 {
  //https://stackoverflow.com/questions/38298412/convert-two-bytes-into-signed-16-bit-integer-in-javascript
  let highByteExpanded: u16 = <u16>highByte;
  return (((highByteExpanded & 0xFF) << 8) | (lowByte & 0xFF))
}

export function splitHighByte(groupedByte: u16): u8 {
  return <u8>((groupedByte & 0xFF00) >> 8);
}

export function splitLowByte(groupedByte: u16): u8 {
  return <u8>groupedByte & 0x00FF;
}

export function rotateByteLeft(value: u8): u8 {
  // Rotate left
  // https://stackoverflow.com/questions/19204750/how-do-i-perform-a-circular-rotation-of-a-byte
  // 4-bit example:
  // 1010 -> 0100 | 0001
  return (value << 1) | (value >> 7);
}

export function rotateByteLeftThroughCarry(value: u8): u8 {
  // Example: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // Through carry meaning, instead of raotating the bit that gets dropped off, but the carry there instead
  value = (value << 1) | getCarryFlag();
  return value;
}

export function rotateByteRight(value: u8): u8 {
  // Rotate right
  // 4-bit example:
  // 1010 -> 0101 | 0000
  return (value >> 1) | (value << 7);
}

export function rotateByteRightThroughCarry(value: u8): u8 {
  // Example: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // Through carry meaning, instead of raotating the bit that gets dropped off, put the carry there instead
  value = (value >> 1) | (getCarryFlag() << 7);
  return value;
}

export function setBitOnByte(bitPosition: u8, byte: u8): u8 {
  return byte | (0x01 << bitPosition);
}

export function resetBitOnByte(bitPosition: u8, byte: u8): u8 {
  return byte & ~(0x01 << bitPosition);
}

export function checkBitOnByte(bitPosition: u8, byte: u8): boolean {
  // Perforamnce improvements
  // https://github.com/AssemblyScript/assemblyscript/issues/40
  return (<u32>byte & (1 << bitPosition)) != 0;
}

namespace env {
  export declare function log(message: string, numArgs: i32, arg0: i32, arg1: i32, arg2: i32, arg3: i32, arg4: i32, arg5: i32): void;
  export declare function hexLog(numArgs: i32, arg0: i32, arg1: i32, arg2: i32, arg3: i32, arg4: i32, arg5: i32): void;
}

export function log(message: string, numArgs: i32 = 0, arg0: i32 = 0, arg1: i32 = 0, arg2: i32 = 0, arg3: i32 = 0, arg4: i32 = 0, arg5: i32 = 0): void {
  env.log(message, numArgs, arg0, arg1, arg2, arg3, arg4, arg5);
}

export function hexLog(numArgs: i32 = 0, arg0: i32 = 0, arg1: i32 = 0, arg2: i32 = 0, arg3: i32 = 0, arg4: i32 = 0, arg5: i32 = 0): void {
  env.hexLog(numArgs, arg0, arg1, arg2, arg3, arg4, arg5);
}
