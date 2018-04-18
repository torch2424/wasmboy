import {
  Cpu
} from '../cpu/cpu';
import {
  Memory,
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  storePaletteByteInWasmMemory,
  loadPaletteByteFromWasmMemory
} from '../memory/index';
import {
  checkBitOnByte,
  resetBitOnByte,
  setBitOnByte,
  concatenateBytes,
  hexLog
} from '../helpers/index';

// Class for GBC Color palletes
// http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
export class Palette {
  static memoryLocationBackgroundPaletteIndex: u16 = 0xFF68;
  static memoryLocationBackgroundPaletteData: u16 = 0xFF69;
  static memoryLocationSpritePaletteIndex: u16 = 0xFF6A;
  static memoryLocationSpritePaletteData: u16 = 0xFF6B;
}

// Simple get pallete color or monochroime GB
// shouldRepresentColorByColorId is good for debugging tile data for GBC games that don't have
// monochromePalettes
export function getMonochromeColorFromPalette(colorId: u8, paletteMemoryLocation: u16, shouldRepresentColorByColorId: boolean = false): u8 {
  // Shift our paletteByte, 2 times for each color ID
  // And off any extra bytes
  // Return our Color (00 - white, 01 - light grey, 10 Dark grey, or 11 - Black)
  let color: u8 = colorId;
  if(!shouldRepresentColorByColorId) {
    color = (eightBitLoadFromGBMemory(paletteMemoryLocation) >> (colorId * 2)) & 0x03;
  }


  // Since our max is 254, and max is 3.
  // monochrome color palette is modified from bgb
  // TODO: Make these colors into a constant
  let rgbColor: u8 = 242;

  switch (color) {
    case 0:
      break;
    case 1:
      rgbColor = 160;
      break;
    case 2:
      rgbColor = 88;
      break;
    case 3:
      rgbColor = 8;
      break;
  }

  return rgbColor;
}

export function writeColorPaletteToMemory(offset: u16, value: u16): void {
  // FF68
  //  Bit 0-5   Index (00-3F)
  if (offset === Palette.memoryLocationBackgroundPaletteData || offset === Palette.memoryLocationSpritePaletteData) {
    // Get the palette index
    let paletteIndex: u8 = eightBitLoadFromGBMemory(offset - 1);

    // Clear the 6th bit, as it does nothing
    paletteIndex = resetBitOnByte(6, paletteIndex);

    // Check if we are changing the sprite pallete data
    let isSprite: boolean = false;
    if (offset === Palette.memoryLocationSpritePaletteData) {
      isSprite = true;
    }

    storePaletteByteInWasmMemory(paletteIndex, <u8>value, isSprite);

    incrementPaletteIndexIfSet(paletteIndex, offset - 1);
  }
}

// Functions to Handle Write to pallete data registers
// http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
// Function to handle incrementing the pallete index if required
function incrementPaletteIndexIfSet(paletteIndex: u8, offset: u16): void {

  // Check ther auto increment box
  if (checkBitOnByte(7, paletteIndex)) {
    // Increment the index, and return the value before the increment
    // Ensure we don't ouverflow our auto increment bit
    paletteIndex += 1;
    paletteIndex = setBitOnByte(7, paletteIndex);

    eightBitStoreIntoGBMemory(offset, paletteIndex);
  }
}

// FF68
// Bit 0-5   Index (00-3F)
// Bit 7     Auto Increment  (0=Disabled, 1=Increment after Writing)
// Index is 00-0x3F because the means 0 - 63 (64),
// and apparently there are 8 bytes per pallete to describe Color 0-3 (4 colors),
// and 0-7 (8 palltetes). Therefore, 64!
export function getRgbColorFromPalette(paletteId: u8, colorId: u8, isSprite: boolean): u16 {

  // Each Pallete takes 8 bytes, so multiply by 8 to get the pallete
  // And Each color takes 2 bytes, therefore, multiple by 2 for the correct color bytes in the palette
  let paletteIndex: u8 = (paletteId * 8) + (colorId * 2);

  // Load the Color that is seperated into two bytes
  let paletteHighByte: u8 = loadPaletteByteFromWasmMemory(paletteIndex + 1, isSprite);
  let paletteLowByte: u8 = loadPaletteByteFromWasmMemory(paletteIndex, isSprite);

  // Return the concatenated color byte
  return concatenateBytes(paletteHighByte, paletteLowByte);
}


// Function to return the color from a passed 16 bit color pallette
export function getColorComponentFromRgb(colorId: u8, colorRgb: u16): u8 {

  // Get our bitmask for the color ID
  // bit mask tested good :)
  let bitMask: u16 = (0x1F << (colorId * 5));
  let colorValue: u16 = ((colorRgb & bitMask) >> (colorId * 5));

  // Goal is to reach 254 for each color, so 255 / 31 (0x1F) ~8 TODO: Make exact
  // Want 5 bits for each
  return <u8>(colorValue * 8);
}
