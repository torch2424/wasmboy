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
  consoleLog,
  consoleLogTwo
} from '../helpers/index';

export function eightBitStoreIntoGBMemory(offset: u16, value: u8): void {
  if(checkWriteTraps(offset, <u16>value, true)) {
    _eightBitStoreIntoWasmBoyMemory(offset, value);
  }
}

export function sixteenBitStoreIntoGBMemory(offset: u16, value: u16): void {

  // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
  // Split the value into two seperate bytes
  let highByte: u8 = splitHighByte(value);
  let lowByte: u8 = splitLowByte(value);
  let nextOffset: u16 = offset + 1;

  if(checkWriteTraps(offset, lowByte, false)) {
    _eightBitStoreIntoWasmBoyMemory(offset, lowByte);
  }

  if(checkWriteTraps(nextOffset, highByte, false)) {
    _eightBitStoreIntoWasmBoyMemory(nextOffset, highByte);
  }
}

export function eightBitStoreIntoGBMemorySkipTraps(offset: u16, value: u8): void {
  _eightBitStoreIntoWasmBoyMemory(offset, value);
}

export function sixteenBitStoreIntoGBMemorySkipTraps(offset: u16, value: u16): void {

  // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
  // Split the value into two seperate bytes
  let highByte: u8 = splitHighByte(value);
  let lowByte: u8 = splitLowByte(value);
  let nextOffset: u16 = offset + 1;

  _eightBitStoreIntoWasmBoyMemory(offset, lowByte);
  _eightBitStoreIntoWasmBoyMemory(nextOffset, highByte);
}

function _eightBitStoreIntoWasmBoyMemory(gameboyOffset: u16, value: u8): void {
  let wasmboyOffset: u32 = getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);

  store<u8>(wasmboyOffset, value);
}
