// Store / Write memory access
import { checkWriteTraps } from './writeTraps';
import { getWasmBoyOffsetFromGameBoyOffset } from './memoryMap';
import { splitHighByte, splitLowByte } from '../helpers/index';
import { Breakpoints } from '../debug/breakpoints';

export function eightBitStoreIntoGBMemory(gameboyOffset: i32, value: i32): void {
  store<u8>(getWasmBoyOffsetFromGameBoyOffset(gameboyOffset), value);
}

export function eightBitStoreIntoGBMemoryWithTraps(offset: i32, value: i32): void {
  if (offset === Breakpoints.writeGbMemory) {
    Breakpoints.reachedBreakpoint = true;
  }

  if (checkWriteTraps(offset, value)) {
    eightBitStoreIntoGBMemory(offset, value);
  }
}

export function sixteenBitStoreIntoGBMemoryWithTraps(offset: i32, value: i32): void {
  // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
  // Split the value into two seperate bytes
  let highByte = splitHighByte(value);
  let lowByte = splitLowByte(value);

  if (checkWriteTraps(offset, lowByte)) {
    eightBitStoreIntoGBMemory(offset, lowByte);
  }

  let nextOffset = offset + 1;
  if (checkWriteTraps(nextOffset, highByte)) {
    eightBitStoreIntoGBMemory(nextOffset, highByte);
  }
}

export function sixteenBitStoreIntoGBMemory(offset: i32, value: i32): void {
  // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
  // Split the value into two seperate bytes
  let highByte = splitHighByte(value);
  let lowByte = splitLowByte(value);

  eightBitStoreIntoGBMemory(offset + 0, lowByte);
  eightBitStoreIntoGBMemory(offset + 1, highByte);
}

export function storeBooleanDirectlyToWasmMemory(offset: i32, value: boolean): void {
  store<u8>(offset, <i32>value);
}
