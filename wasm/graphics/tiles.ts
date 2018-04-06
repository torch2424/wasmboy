// Functions for performance hacks, and debugging tiles

import {
  Cpu
} from '../cpu/cpu';
import {
  Graphics
} from './graphics';
import {
  getTileDataAddress
} from './renderUtils';
import {
  getMonochromeColorFromPalette,
  getRgbColorFromPalette,
  getColorComponentFromRgb
} from './palette';
// Assembly script really not feeling the reexport
// using Skip Traps, because LCD has unrestricted access
// http://gbdev.gg8.se/wiki/articles/Video_Display#LCD_OAM_DMA_Transfers
import {
  eightBitLoadFromGBMemorySkipTraps
} from '../memory/load';
import {
  Memory,
  loadFromVramBank,
  setPixelOnFrame
} from '../memory/memory';
import {
  hexLog,
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte
} from '../helpers/index';


export function drawLineOfTile(tileId: u8, tileLineY: i32, tileDataMemoryLocation: u16, vramBankId: i32, tileGridX: u32, tileGridY: u32, maxXTilesInGrid: u32, wasmMemoryStart: u32, paletteLocation: u16 = 0, paletteByte: u8 = 0) {
  // Get our tile data address
  let tileDataAddress: u16 = getTileDataAddress(tileDataMemoryLocation, tileId);

  // Get the bytes for our tile
  let byteOneForLineOfTilePixels: u8 = loadFromVramBank(tileDataAddress + (tileLineY * 2), vramBankId)
  let byteTwoForLineOfTilePixels: u8 = loadFromVramBank(tileDataAddress + (tileLineY * 2) + 1, vramBankId);

  //Loop through for every x value
  for(let x: i32 = 0; x < 8; x++) {
    // Get our pallete colors for the tile
    let paletteColorId: u8 = 0;
    if (checkBitOnByte(<u8>x, byteTwoForLineOfTilePixels)) {
      // Byte one represents the second bit in our color id, so bit shift
      paletteColorId += 1;
      paletteColorId = (paletteColorId << 1);
    }
    if (checkBitOnByte(<u8>x, byteOneForLineOfTilePixels)) {
      paletteColorId += 1;
    }

    // Get the pallete
    let red: u8 = 0;
    let green: u8 = 0;
    let blue: u8 = 0;
    if(paletteByte <= 0) {
      if (paletteLocation <= 0) {
        paletteLocation = Graphics.memoryLocationBackgroundPalette;
      }
      let monochromeColor: u8 = getMonochromeColorFromPalette(paletteColorId, paletteLocation);
      red = monochromeColor;
      green = monochromeColor;
      blue = monochromeColor;
    } else {
      // Call the helper function to grab the correct color from the palette
      let rgbColorPalette: u16 = getRgbColorFromPalette(paletteByte, paletteColorId, false);

      // Split off into red green and blue
      red = getColorComponentFromRgb(0, rgbColorPalette);
      green = getColorComponentFromRgb(1, rgbColorPalette);
      blue = getColorComponentFromRgb(2, rgbColorPalette);
    }

    // Finally Lets place a pixel in memory
    // Find where our tile line would start
    let pixelStart: u32 = getTilePixelStart(x, tileLineY, tileGridX, tileGridY, maxXTilesInGrid);

    store<u8>(wasmMemoryStart + pixelStart, red);
    store<u8>(wasmMemoryStart + pixelStart + 1, green);
    store<u8>(wasmMemoryStart + pixelStart + 2, blue);
  }
}

export function getTilePixelStart(xPixel: i32, tileLineY: i32, tileGridX: u32, tileGridY: u32, maxXTilesInGrid: u32): u32 {
  // Finally Lets place a pixel in memory

  let yLineInMemory: u32 = ((8 * tileGridY) + tileLineY);

  let maxXPixelInMemory: u32 = (8 * maxXTilesInGrid);

  let pixelStart: u32 = (yLineInMemory * maxXPixelInMemory) + (tileGridX * 8) + xPixel;

  // Each pixel takes 3 slots, therefore, multiply by 3!
  return pixelStart * 3;
}
