// Load/Read functionality for memory
import {
  checkReadTraps
} from './readTraps';
import {
  getWasmBoyOffsetFromGameBoyOffset
} from './memoryMap';
import {
  concatenateBytes,
  performanceTimestamp
} from '../helpers/index';

export function eightBitLoadFromGBMemory(gameboyOffset: u16): u8 {
  return load<u8>(getWasmBoyOffsetFromGameBoyOffset(gameboyOffset));
}

export function eightBitLoadFromGBMemoryWithTraps(offset: u16): u8 {
  let readTrapResult: i32 = checkReadTraps(offset);
  switch (readTrapResult) {
    case -1:
      return eightBitLoadFromGBMemory(offset);
    default:
      return <u8>readTrapResult;
  }
}

export function sixteenBitLoadFromGBMemory(offset: u16): u16 {

  // Get our low byte
  let lowByte: u8 = 0;
  let lowByteReadTrapResult: i32 = checkReadTraps(offset);
  switch (lowByteReadTrapResult) {
    case -1:
      lowByte = eightBitLoadFromGBMemory(offset);
      break;
    default:
      lowByte = <u8>lowByteReadTrapResult;
      break;
  }

  // Get the next offset for the second byte
  let nextOffset: u16 = offset + 1;

  // Get our high byte
  let highByte: u8 = 0;
  let highByteReadTrapResult: i32 = checkReadTraps(nextOffset);
  switch (highByteReadTrapResult) {
    case -1:
      highByte = eightBitLoadFromGBMemory(nextOffset);
      break;
    default:
      highByte = <u8>highByteReadTrapResult;
      break;
  }

  // Concatenate the bytes and return
  return concatenateBytes(highByte, lowByte);
}

export function loadBooleanDirectlyFromWasmMemory(offset: u32): boolean {
  let booleanAsInt: u8 = load<u8>(offset);
  if(booleanAsInt > 0) {
    return true;
  }
  return false;
}
