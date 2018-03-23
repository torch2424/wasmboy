import {
  eightBitLoadFromGBMemorySkipTraps,
  eightBitStoreIntoGBMemorySkipTraps,
  storePaletteByteInWasmMemory,
  loadPaletteByteFromWasmMemory
} from '../memory/index';
import {
  checkBitOnByte,
  resetBitOnByte,
  concatenateBytes
} from '../helpers/index';

// Class for GBC Color palletes
// http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
export class Palette {
  static memoryLocationBackgroundPaletteIndex: u16 = 0xFF68;
  static memoryLocationBackgroundPaletteData: u16 = 0xFF69;
  static memoryLocationSpritePaletteIndex: u16 = 0xFF68;
  static memoryLocationSpritePaletteData: u16 = 0xFF69;
}

// Functions to Handle Read/Write to pallete registers
// http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
// Function to handle incrementing the pallete index if required
export function incrementPaletteIfSet(offset: u16): void {
  if (offset === Palette.memoryLocationBackgroundPaletteData || offset === Palette.memoryLocationSpritePaletteData) {
    // Get the palette index
    let paletteIndex: u8 = eightBitLoadFromGBMemorySkipTraps(offset - 1);

    // Check ther auto increment box
    if (checkBitOnByte(7, paletteIndex)) {
      // Increment the index, and return the value before the increment
      // Incrementing by adding one, and clearing the overflow bit (6)
      eightBitStoreIntoGBMemorySkipTraps(offset, resetBitOnByte(6, paletteIndex + 1));
    }
  }
}

export function writePaletteToMemory(offset: u16, value: u16): void {
  // FF68
  //  Bit 0-5   Index (00-3F)
  if (offset === Palette.memoryLocationBackgroundPaletteData || offset === Palette.memoryLocationSpritePaletteData) {
    // Get the palette index
    let paletteIndex: u32 = eightBitLoadFromGBMemorySkipTraps(offset - 1);

    // Increase by the maximum index the background palette can be
    if (offset === Palette.memoryLocationSpritePaletteData) {
      paletteIndex += 0x3F;
    }

    storePaletteByteInWasmMemory(paletteIndex, <u8>value);

    // Incrementing handled by function above
  }
}


// Simple get pallete color or monochroime GB
export function getMonochromeColorFromPalette(colorId: u8, paletteMemoryLocation: u16): u8 {
  // Shift our paletteByte, 2 times for each color ID
  // And off any extra bytes
  // Return our Color (00, 01, 10, or 11)
  return (eightBitLoadFromGBMemorySkipTraps(paletteMemoryLocation) >> (colorId * 2)) & 0x03;
}

// FF68
// Bit 0-5   Index (00-3F)
// Bit 7     Auto Increment  (0=Disabled, 1=Increment after Writing)
// Index is 00-0x3F because the means 0 - 63 (64),
// and apparently there are 8 bytes per pallete to describe Color 0-3 (4 colors),
// and 0-7 (8 palltetes). Therefroe, 64!
export function getRgbColorFromPalette(paletteId: u8, colorId: u8, isSprite: boolean): u16 {

  // Offset Sprite palette Loads by the maximum index of Backgrounds
  if (isSprite) {
    paletteId += 0x3F;
  }

  // Each color takes 2 bytes, therefore, multiple by 2 for the correct color bytes in the palette
  let paletteIndex: u8 = paletteId + (colorId * 2);

  // Load the color that is seperated into two bytes
  let colorHighByte: u8 = loadPaletteByteFromWasmMemory(paletteIndex);
  let colorLowByte: u8 = loadPaletteByteFromWasmMemory(paletteIndex);

  // Return the concatenated color byte
  return concatenateBytes(colorHighByte, colorLowByte);
}
