// Load/Read functionality for memory
import { checkReadTraps } from "./readTraps";
import { getWasmBoyOffsetFromGameBoyOffset } from "./memoryMap";
import { concatenateBytes, performanceTimestamp } from "../helpers/index";

export function eightBitLoadFromGBMemory(gameboyOffset: i32): i32 {
  return <i32>load<u8>(getWasmBoyOffsetFromGameBoyOffset(gameboyOffset));
}

export function eightBitLoadFromGBMemoryWithTraps(offset: i32): i32 {
  let readTrapResult: i32 = checkReadTraps(offset);
  switch (readTrapResult) {
    case -1:
      return eightBitLoadFromGBMemory(offset);
    default:
      return <u8>readTrapResult;
  }
}

export function sixteenBitLoadFromGBMemory(offset: i32): i32 {
  // Get our low byte
  let lowByte: i32 = 0;
  let lowByteReadTrapResult: i32 = checkReadTraps(offset);
  switch (lowByteReadTrapResult) {
    case -1:
      lowByte = eightBitLoadFromGBMemory(offset);
      break;
    default:
      lowByte = lowByteReadTrapResult;
      break;
  }

  // Get the next offset for the second byte
  let nextOffset: i32 = offset + 1;

  // Get our high byte
  let highByte: i32 = 0;
  let highByteReadTrapResult: i32 = checkReadTraps(nextOffset);
  switch (highByteReadTrapResult) {
    case -1:
      highByte = eightBitLoadFromGBMemory(nextOffset);
      break;
    default:
      highByte = highByteReadTrapResult;
      break;
  }

  // Concatenate the bytes and return
  return concatenateBytes(highByte, lowByte);
}

export function loadBooleanDirectlyFromWasmMemory(offset: i32): boolean {
  let booleanAsInt: i32 = load<u8>(offset);
  if (booleanAsInt > 0) {
    return true;
  }
  return false;
}
