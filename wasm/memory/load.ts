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
  if (checkReadTraps(offset)) {
    return _eightBitLoadFromWasmBoyMemory(offset);
  } else {
    // TODO: Find what read trap should return
    return 0x00;
  }
}

export function sixteenBitLoadFromGBMemory(offset: u16): u16 {
  if (checkReadTraps(offset)) {
    return _sixteenBitLoadFromWasmBoyMemory(offset);
  } else {
    // TODO: Find what read trap should return
    return 0x00;
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
