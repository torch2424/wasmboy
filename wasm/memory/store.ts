// Store / Write memory access
import {
  checkWriteTraps
} from './writeTraps';
import {
  getWasmBoyOffsetFromGameBoyOffset
} from './memoryMap';
import {
  splitHighByte,
  splitLowByte,
  hexLog
} from '../helpers/index';

export function eightBitStoreIntoGBMemory(gameboyOffset: u16, value: u8): void {
  store<u8>(getWasmBoyOffsetFromGameBoyOffset(gameboyOffset), value);
}

export function eightBitStoreIntoGBMemoryWithTraps(offset: u16, value: u8): void {
  if(checkWriteTraps(offset, <u16>value)) {
    eightBitStoreIntoGBMemory(offset, value);
  }
}

export function sixteenBitStoreIntoGBMemoryWithTraps(offset: u16, value: u16): void {

  // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
  // Split the value into two seperate bytes
  let highByte: u8 = splitHighByte(value);
  let lowByte: u8 = splitLowByte(value);
  let nextOffset: u16 = offset + 1;

  if(checkWriteTraps(offset, lowByte)) {
    eightBitStoreIntoGBMemory(offset, lowByte);
  }

  if(checkWriteTraps(nextOffset, highByte)) {
    eightBitStoreIntoGBMemory(nextOffset, highByte);
  }
}

export function sixteenBitStoreIntoGBMemory(offset: u16, value: u16): void {

  // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
  // Split the value into two seperate bytes
  let highByte: u8 = splitHighByte(value);
  let lowByte: u8 = splitLowByte(value);
  let nextOffset: u16 = offset + 1;

  eightBitStoreIntoGBMemory(offset, lowByte);
  eightBitStoreIntoGBMemory(nextOffset, highByte);
}

export function storeBooleanDirectlyToWasmMemory(offset: i32, value: boolean): void {
  if (value) {
    store<u8>(offset, 0x01);
  } else {
    store<u8>(offset, 0x00);
  }
}
