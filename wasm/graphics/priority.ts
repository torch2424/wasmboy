// https://github.com/torch2424/wasmBoy/issues/51
// Bits 0 & 1 will represent the color Id drawn by the BG/Window
// Bit 2 will represent if the Bg/Window has GBC priority.

import {
  bgPriorityMapLocation
} from '../constants/constants';
import {
  setBitOnByte
} from '../helpers/index';

export function addPriorityforPixel(x: i32, y: i32, colorId: u8 = 0, hasGbcBgPriority: boolean = false): void {

  let bgPriorityByte: u8 = (colorId & 0x03);
  if(hasGbcBgPriority) {
    bgPriorityByte = setBitOnByte(2, bgPriorityByte);
  }

  store<u8>(bgPriorityMapLocation + getPixelStart(x, y), bgPriorityByte);
}

export function getPriorityforPixel(x: i32, y: i32): u8 {
  return load<u8>(bgPriorityMapLocation + getPixelStart(x, y));
}

export function clearPriorityMap(): void {
  for(let y: i32 = 0; y < 144; y++) {
    for(let x: i32 = 0; x < 160; x++) {
      store<u8>(bgPriorityMapLocation + getPixelStart(x, y), 0);
    }
  }
}

function getPixelStart(x: i32, y: i32): i32 {
  // Get the pixel number
  return (y * 160) + x;
}
