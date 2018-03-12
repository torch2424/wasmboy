// Load/Read functionality for memory
import {
  checkReadTraps
} from './readTraps';
import {
  getWasmBoyOffsetFromGameBoyOffset
} from './memoryMap';
import {
  concatenateBytes
} from '../helpers/index';

export function eightBitLoadFromGBMemory(offset: u16): u8 {
  let readTrapResult: i32 = checkReadTraps(offset);
  if (readTrapResult < 0) {
    return _eightBitLoadFromWasmBoyMemory(offset);
  } else {
    return <u8>readTrapResult;
  }
}

export function eightBitLoadFromGBMemorySkipTraps(offset: u16): u8 {
  return _eightBitLoadFromWasmBoyMemory(offset);
}

export function sixteenBitLoadFromGBMemory(offset: u16): u16 {

  // Get our low byte
  let lowByte: u8 = 0;
  let lowByteReadTrapResult: i32 = checkReadTraps(offset);
  if (lowByteReadTrapResult < 0) {
    lowByte = _eightBitLoadFromWasmBoyMemory(offset);
  } else {
    lowByte = <u8>lowByteReadTrapResult;
  }

  // Get the next offset for the second byte
  let nextOffset: u16 = offset + 1;

  // Get our high byte
  let highByte: u8 = 0;
  let highByteReadTrapResult: i32 = checkReadTraps(nextOffset);
  if (highByteReadTrapResult < 0) {
    highByte = _eightBitLoadFromWasmBoyMemory(nextOffset);
  } else {
    highByte = <u8>highByteReadTrapResult;
  }

  // Concatenate the bytes and return
  let concatenatedValue: u16 = concatenateBytes(highByte, lowByte);
  return concatenatedValue;
}

function _eightBitLoadFromWasmBoyMemory(gameboyOffset: u16): u8 {
  let wasmboyOffset: u32 = getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  return load<u8>(wasmboyOffset);
}

export function loadBooleanDirectlyFromWasmMemory(offset: u32): boolean {
  let booleanAsInt: u8 = load<u8>(offset);
  if(booleanAsInt > 0) {
    return true;
  }
  return false;
}
