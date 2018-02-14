// Load/Read functionality for memory
import {
  checkReadTraps
} from './readTraps';
import {
  getWasmBoyOffsetFromGameBoyOffset
} from './memoryMap';
import {
  consoleLog,
  consoleLogTwo
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
  if (checkReadTraps(offset) < 0) {
    return _sixteenBitLoadFromWasmBoyMemory(offset);
  } else {
    return <u16>checkReadTraps(offset);
  }
}

function _eightBitLoadFromWasmBoyMemory(gameboyOffset: u16): u8 {
  let wasmboyOffset: u32 = getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  return load<u8>(wasmboyOffset);
}

function _sixteenBitLoadFromWasmBoyMemory(gameboyOffset: u16): u16 {
  let wasmboyOffset: u32 = getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  return load<u16>(wasmboyOffset);
}
