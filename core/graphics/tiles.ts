// Functions for performance hacks, and debugging tiles

import { Cpu } from '../cpu/index';
import { Graphics, loadFromVramBank, setPixelOnFrame } from './graphics';
import { getMonochromeColorFromPalette, getRgbColorFromPalette, getColorComponentFromRgb } from './palette';
import { addPriorityforPixel } from './priority';
// Assembly script really not feeling the reexport
// using Skip Traps, because LCD has unrestricted access
// http://gbdev.gg8.se/wiki/articles/Video_Display#LCD_OAM_DMA_Transfers
import { eightBitLoadFromGBMemory } from '../memory/load';
import { Memory } from '../memory/memory';
import { hexLog, checkBitOnByte, setBitOnByte, resetBitOnByte } from '../helpers/index';

export class TileCache {
  static tileId: i32 = -1;
  static horizontalFlip: boolean = false;
  static nextXIndexToPerformCacheCheck: i32 = -1;
}

export function resetTileCache(): void {
  TileCache.tileId = -1;
  TileCache.nextXIndexToPerformCacheCheck = -1;
}

export function drawPixelsFromLineOfTile(
  tileId: i32,
  tileDataMemoryLocation: i32,
  vramBankId: i32,
  tileLineXStart: i32,
  tileLineXEnd: i32,
  tileLineY: i32,
  outputLineX: i32,
  outputLineY: i32,
  outputWidth: i32,
  wasmMemoryStart: i32,
  shouldRepresentMonochromeColorByColorId: boolean,
  paletteLocation: i32,
  bgMapAttributes: i32,
  spriteAttributes: i32
): i32 {
  // Get our number of pixels drawn
  let pixelsDrawn: i32 = 0;

  // Get our tile data address
  let tileDataAddress: i32 = getTileDataAddress(tileDataMemoryLocation, tileId);

  // Get the bytes for our tile
  let byteOneForLineOfTilePixels: i32 = loadFromVramBank(tileDataAddress + tileLineY * 2, vramBankId);
  let byteTwoForLineOfTilePixels: i32 = loadFromVramBank(tileDataAddress + tileLineY * 2 + 1, vramBankId);

  // Loop through our X values to draw
  for (let x: i32 = tileLineXStart; x <= tileLineXEnd; x++) {
    // First find where we are going to do our final output x
    // And don't allow any width overflow
    let iteratedOutputX = outputLineX + (x - tileLineXStart);
    if (iteratedOutputX < outputWidth) {
      // However, We need to reverse our byte (if not horizontally flipped),
      // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
      // Therefore, is pixelX was 2, then really is need to be 5
      // So 2 - 7 = -5, * 1 = 5
      // Or to simplify, 7 - 2 = 5 haha!
      let pixelXInTile: i32 = x;
      if (bgMapAttributes < 0 || !checkBitOnByte(5, bgMapAttributes)) {
        pixelXInTile = 7 - pixelXInTile;
      }

      // Get our pallete colors for the tile
      let paletteColorId: i32 = 0;
      if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
        // Byte one represents the second bit in our color id, so bit shift
        paletteColorId += 1;
        paletteColorId = paletteColorId << 1;
      }
      if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
        paletteColorId += 1;
      }

      // Get the pallete
      let red: i32 = 0;
      let green: i32 = 0;
      let blue: i32 = 0;

      // Check if we should draw color or not
      if (bgMapAttributes >= 0) {
        // Call the helper function to grab the correct color from the palette
        // Get the palette index byte
        let bgPalette: i32 = bgMapAttributes & 0x07;
        let rgbColorPalette: i32 = getRgbColorFromPalette(bgPalette, paletteColorId, false);

        // Split off into red green and blue
        red = getColorComponentFromRgb(0, rgbColorPalette);
        green = getColorComponentFromRgb(1, rgbColorPalette);
        blue = getColorComponentFromRgb(2, rgbColorPalette);
      } else {
        if (paletteLocation <= 0) {
          paletteLocation = Graphics.memoryLocationBackgroundPalette;
        }
        let monochromeColor: i32 = getMonochromeColorFromPalette(paletteColorId, paletteLocation, shouldRepresentMonochromeColorByColorId);
        red = monochromeColor;
        green = monochromeColor;
        blue = monochromeColor;
      }

      // Finally Lets place a pixel in memory
      // Find where our tile line would start
      let pixelStart: i32 = getTilePixelStart(iteratedOutputX, outputLineY, outputWidth);

      store<u8>(wasmMemoryStart + pixelStart, <u8>red);
      store<u8>(wasmMemoryStart + pixelStart + 1, <u8>green);
      store<u8>(wasmMemoryStart + pixelStart + 2, <u8>blue);

      let gbcBgPriority: boolean = false;
      if (bgMapAttributes >= 0) {
        gbcBgPriority = checkBitOnByte(7, bgMapAttributes);
      }

      // Lastly, add the pixel to our background priority map
      // https://github.com/torch2424/wasmBoy/issues/51
      // Bits 0 & 1 will represent the color Id drawn by the BG/Window
      // Bit 2 will represent if the Bg/Window has GBC priority.
      addPriorityforPixel(iteratedOutputX, outputLineY, paletteColorId, gbcBgPriority);

      pixelsDrawn++;
    }
  }

  return pixelsDrawn;
}

export function getTilePixelStart(outputLineX: i32, outputLineY: i32, outputWidth: i32): i32 {
  // Finally Lets place a pixel in memory
  let pixelStart: i32 = outputLineY * outputWidth + outputLineX;

  // Each pixel takes 3 slots, therefore, multiply by 3!
  return pixelStart * 3;
}

export function getTileDataAddress(tileDataMemoryLocation: i32, tileIdFromTileMap: i32): i32 {
  // Watch this part of The ultimate gameboy talk: https://youtu.be/HyzD8pNlpwI?t=30m50s
  // A line of 8 pixels on a single tile, is represented by 2 bytes.
  // since a single tile is 8x8 pixels, 8 * 2 = 16 bytes

  // Get the tile ID's tile addess from tile data.
  // For instance, let's say our first line of tile data represents tiles for letters:
  // a b c d e f g
  // And we have tileId 0x02. That means we want the tile for the 'c' character
  // Since each tile is 16 bytes, it would be the starting tileDataAddress + (tileId * tileSize), to skip over tiles we dont want
  // The whole signed thing is weird, and has something to do how the second set of tile data is stored :p
  if (tileDataMemoryLocation === Graphics.memoryLocationTileDataSelectZeroStart) {
    // Treat the tile Id as a signed int, subtract an offset of 128
    // if the tileId was 0 then the tile would be in memory region 0x9000-0x900F
    // NOTE: Assemblyscript, Can't cast to i16, need to make negative manually
    let signedTileId: i32 = tileIdFromTileMap + 128;
    if (checkBitOnByte(7, tileIdFromTileMap)) {
      signedTileId = tileIdFromTileMap - 128;
    }
    return tileDataMemoryLocation + signedTileId * 16;
  }

  // if the background layout gave us the tileId 0, then the tile data would be between 0x8000-0x800F.
  return tileDataMemoryLocation + tileIdFromTileMap * 16;
}
