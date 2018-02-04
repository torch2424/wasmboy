import { getCarryFlag } from '../cpu/flags';

class Log {
  static logValue: i32 = 0;
  static logId: i32 = 0;
}

// Set the current log
export function consoleLog(valueToSet: i32, logId: i32): void {
  Log.logValue = valueToSet;
  Log.logId = logId;
}

// General console.log function, can poll from js
export function getCurrentLogValue(): i32 {
  return Log.logValue;
}

export function getCurrentLogId(): i32 {
  return Log.logId;
}

// Grouped registers
// possible overload these later to performace actions
// AF, BC, DE, HL
export function concatenateBytes(highByte: u8, lowByte: u8): u16 {
  //https://stackoverflow.com/questions/38298412/convert-two-bytes-into-signed-16-bit-integer-in-javascript
  let highByteExpanded: u16 = highByte;
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
  let byteOfBitToSet: u8 = (0x01 << bitPosition);
  byte = byte | byteOfBitToSet;
  return byte;
}

export function resetBitOnByte(bitPosition: u8, byte: u8): u8 {
  let byteOfBitToSet: u8 = (0x01 << bitPosition);
  byte = byte & ~(byteOfBitToSet);
  return byte;
}

export function checkBitOnByte(bitPosition: u8, byte: u8): boolean {
  let byteOfBitToCheck: u8 = (0x01 << bitPosition);
  byte = byte & byteOfBitToCheck;
  if(byte > 0) {
    return true;
  } else {
    return false;
  }
}
