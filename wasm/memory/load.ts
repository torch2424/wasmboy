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
  if (checkReadTraps(offset) < 0) {
    return _eightBitLoadFromWasmBoyMemory(offset);
  } else {
    return <u8>checkReadTraps(offset);
  }
}

export function eightBitLoadFromGBMemorySkipTraps(offset: u16): u8 {
  return _eightBitLoadFromWasmBoyMemory(offset);
}

export function sixteenBitLoadFromGBMemory(offset: u16): u16 {

  // Get our low byte
  let lowByte: u8 = 0;
  if (checkReadTraps(offset) < 0) {
    lowByte = _eightBitLoadFromWasmBoyMemory(offset);
  } else {
    lowByte = <u8>checkReadTraps(offset);
  }

  // Get the next offset for the second byte
  let nextOffset: u16 = offset + 1;

  // Get our high byte
  let highByte: u8 = 0;
  if (checkReadTraps(nextOffset) < 0) {
    highByte = _eightBitLoadFromWasmBoyMemory(nextOffset);
  } else {
    highByte = <u8>checkReadTraps(nextOffset);
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
  let booleanAsInt: i8 = load<i8>(offset);
  if(booleanAsInt <= 0) {
    return false;
  }
  return true;
}
