// Store / Write memory access
import {
  checkWriteTraps
} from './writeTraps';
import {
  getWasmBoyOffsetFromGameBoyOffset
} from './memoryMap';
import {
  consoleLog,
  consoleLogTwo
} from '../helpers/index';

export function eightBitStoreIntoGBMemory(offset: u16, value: u8): void {
  if(checkWriteTraps(offset, <u16>value, true)) {
    _eightBitStoreIntoWasmBoyMemory(offset, value);
  }
}

export function sixteenBitStoreIntoGBMemory(offset: u16, value: u16): void {
  if(checkWriteTraps(offset, value, false)) {
    _sixteenBitStoreIntoWasmBoyMemory(offset, value);
  }
}

export function eightBitStoreIntoGBMemorySkipTraps(offset: u16, value: u8): void {
  _eightBitStoreIntoWasmBoyMemory(offset, value);
}

export function sixteenBitStoreIntoGBMemorySkipTraps(offset: u16, value: u16): void {
  _sixteenBitStoreIntoWasmBoyMemory(offset, value);
}

function _eightBitStoreIntoWasmBoyMemory(gameboyOffset: u16, value: u8): void {
  let wasmboyOffset: u32 = getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);

  store<u8>(wasmboyOffset, value);
}

function _sixteenBitStoreIntoWasmBoyMemory(gameboyOffset: u16, value: u16): void {
  let wasmboyOffset: u32 = getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  store<u16>(wasmboyOffset, value);
}
