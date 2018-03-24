import {
  Cpu
} from '../cpu/cpu';
import {
  eightBitLoadFromGBMemorySkipTraps,
  eightBitStoreIntoGBMemorySkipTraps,
  storePaletteByteInWasmMemory,
  loadPaletteByteFromWasmMemory
} from '../memory/index';
import {
  checkBitOnByte,
  resetBitOnByte,
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

export function writePaletteToMemory(offset: u16, value: u16): void {
  // FF68
  //  Bit 0-5   Index (00-3F)
  if (offset === Palette.memoryLocationBackgroundPaletteData || offset === Palette.memoryLocationSpritePaletteData) {
    // Get the palette index
    let paletteIndexByte: u8 = eightBitLoadFromGBMemorySkipTraps(offset - 1);

    // Reset the top bit to remove the auto increment flag so we get the correct index
    let paletteIndex: u32 = resetBitOnByte(7, paletteIndexByte);

    // Increase to the next set of pallette memory
    if (offset === Palette.memoryLocationSpritePaletteData) {
      paletteIndex += 0x3F;
    }

    storePaletteByteInWasmMemory(paletteIndex, <u8>value);

    incrementPaletteIfSet(offset);
  }
}

// Functions to Handle Write to pallete data registers
// http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
// Function to handle incrementing the pallete index if required
function incrementPaletteIfSet(offset: u16): void {
  if (offset === Palette.memoryLocationBackgroundPaletteData || offset === Palette.memoryLocationSpritePaletteData) {
    // Get the palette index
    let paletteIndex: u8 = eightBitLoadFromGBMemorySkipTraps(offset - 1);

    // Check ther auto increment box
    if (checkBitOnByte(7, paletteIndex)) {
      // Increment the index, and return the value before the increment
      // Incrementing by adding one, and clearing the overflow bit (6)
      paletteIndex += 1;
      paletteIndex = resetBitOnByte(6, paletteIndex);



      eightBitStoreIntoGBMemorySkipTraps(offset - 1, paletteIndex);
    }
  }
}

// FF68
// Bit 0-5   Index (00-3F)
// Bit 7     Auto Increment  (0=Disabled, 1=Increment after Writing)
// Index is 00-0x3F because the means 0 - 63 (64),
// and apparently there are 8 bytes per pallete to describe Color 0-3 (4 colors),
// and 0-7 (8 palltetes). Therefore, 64!
export function getRgbColorPalette(paletteId: u8, colorId: u8, isSprite: boolean): u16 {

  // Offset Sprite palette Loads by the maximum index of Backgrounds
  if (isSprite) {
    paletteId += 0x3F;
  }

  // Each color takes 2 bytes, therefore, multiple by 2 for the correct color bytes in the palette
  let paletteIndex: u8 = paletteId + (colorId * 2);

  // Load the color that is seperated into two bytes
  let paletteHighByte: u8 = loadPaletteByteFromWasmMemory(paletteIndex);
  let paletteLowByte: u8 = loadPaletteByteFromWasmMemory(paletteIndex + 1);

  hexLog(paletteId, colorId, concatenateBytes(paletteHighByte, paletteLowByte));

  // Return the concatenated color byte
  return concatenateBytes(paletteHighByte, paletteLowByte);
}


// Simple get pallete color or monochroime GB
export function getMonochromeColorFromPalette(colorId: u8, paletteMemoryLocation: u16): u8 {
  // Shift our paletteByte, 2 times for each color ID
  // And off any extra bytes
  // Return our Color (00 - white, 01 - light grey, 10 Dark grey, or 11 - Black)
  let color: u8 = (eightBitLoadFromGBMemorySkipTraps(paletteMemoryLocation) >> (colorId * 2)) & 0x03;


  // Since our max is 254, and max is 3.
  // monochrome color palette is modified from bgb
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


// Function to return the color from a passed 16 bit color pallette
export function getColorFromRgbPalette(colorId: u8, colorPalette: u16): u8 {

  // Get our bitmask for the color ID
  // bit mask tested good :)
  let bitMask: u16 = (0x1F << (colorId * 5));
  let colorValue: u16 = ((colorPalette & bitMask) >> (colorId * 5));

  return <u8>(colorValue * 8);
}
