// https://github.com/torch2424/wasmBoy/issues/51
// Bits 0 & 1 will represent the color Id drawn by the BG/Window
// Bit 2 will represent if the Bg/Window has GBC priority.

import { BG_PRIORITY_MAP_LOCATION } from '../constants';
import { setBitOnByte } from '../helpers/index';

export function addPriorityforPixel(x: i32, y: i32, colorId: i32 = 0, hasGbcBgPriority: boolean = false): void {
  let bgPriorityByte = colorId & 0x03;
  if (hasGbcBgPriority) {
    bgPriorityByte = setBitOnByte(2, bgPriorityByte);
  }

  store<u8>(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y), <u8>bgPriorityByte);
}

// Inlined because closure compiler inlines
export function getPriorityforPixel(x: i32, y: i32): u8 {
  return load<u8>(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y));
}

// Inlined because closure compiler inlines
export function clearPriorityMap(): void {
  for (let y = 0; y < 144; ++y) {
    for (let x = 0; x < 160; ++x) {
      store<u8>(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y), 0);
    }
  }
}

// Inlined because closure compiler inlines
function getPixelStart(x: i32, y: i32): i32 {
  // Get the pixel number
  return y * 160 + x;
}
