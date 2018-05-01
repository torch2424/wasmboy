import { Cpu } from '../cpu/cpu';
import {
  Memory,
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  storePaletteByteInWasmMemory,
  loadPaletteByteFromWasmMemory
} from '../memory/index';
import { checkBitOnByte, resetBitOnByte, setBitOnByte, concatenateBytes, hexLog } from '../helpers/index';

// Class for GBC Color palletes
// http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
export class Palette {
  static memoryLocationBackgroundPaletteIndex: i32 = 0xff68;
  static memoryLocationBackgroundPaletteData: i32 = 0xff69;
  static memoryLocationSpritePaletteIndex: i32 = 0xff6a;
  static memoryLocationSpritePaletteData: i32 = 0xff6b;
}

export function initializePalette(): void {
  if (Cpu.GBCEnabled) {
    // GBC Palettes
    eightBitStoreIntoGBMemory(0xff68, 0xc0);
    eightBitStoreIntoGBMemory(0xff69, 0xff);
    eightBitStoreIntoGBMemory(0xff6a, 0xc1);
    eightBitStoreIntoGBMemory(0xff6b, 0x0d);
  } else {
    // GBC Palettes
    eightBitStoreIntoGBMemory(0xff68, 0xff);
    eightBitStoreIntoGBMemory(0xff69, 0xff);
    eightBitStoreIntoGBMemory(0xff6a, 0xff);
    eightBitStoreIntoGBMemory(0xff6b, 0xff);
  }
}

// Simple get pallete color or monochroime GB
// shouldRepresentColorByColorId is good for debugging tile data for GBC games that don't have
// monochromePalettes
export function getMonochromeColorFromPalette(
  colorId: i32,
  paletteMemoryLocation: i32,
  shouldRepresentColorByColorId: boolean = false
): i32 {
  // Shift our paletteByte, 2 times for each color ID
  // And off any extra bytes
  // Return our Color (00 - white, 01 - light grey, 10 Dark grey, or 11 - Black)
  let color: i32 = colorId;
  if (!shouldRepresentColorByColorId) {
    color = ((<i32>eightBitLoadFromGBMemory(paletteMemoryLocation)) >> (colorId * 2)) & 0x03;
  }

  // Since our max is 254, and max is 3.
  // monochrome color palette is modified from bgb
  // TODO: Make these colors into a constant
  let rgbColor: i32 = 242;

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

export function writeColorPaletteToMemory(offset: i32, value: i32): void {
  // FF68
  //  Bit 0-5   Index (00-3F)
  if (offset === Palette.memoryLocationBackgroundPaletteData || offset === Palette.memoryLocationSpritePaletteData) {
    // Get the palette index
    let paletteIndex: i32 = eightBitLoadFromGBMemory(offset - 1);

    // Clear the 6th bit, as it does nothing
    paletteIndex = resetBitOnByte(6, paletteIndex);

    // Check if we are changing the sprite pallete data
    let isSprite: boolean = false;
    if (offset === Palette.memoryLocationSpritePaletteData) {
      isSprite = true;
    }

    storePaletteByteInWasmMemory(paletteIndex, value, isSprite);

    incrementPaletteIndexIfSet(paletteIndex, offset - 1);
  }
}

// Functions to Handle Write to pallete data registers
// http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
// Function to handle incrementing the pallete index if required
function incrementPaletteIndexIfSet(paletteIndex: i32, offset: i32): void {
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
export function getRgbColorFromPalette(paletteId: i32, colorId: i32, isSprite: boolean): i32 {
  // Each Pallete takes 8 bytes, so multiply by 8 to get the pallete
  // And Each color takes 2 bytes, therefore, multiple by 2 for the correct color bytes in the palette
  let paletteIndex: i32 = paletteId * 8 + colorId * 2;

  // Load the Color that is seperated into two bytes
  let paletteHighByte: i32 = loadPaletteByteFromWasmMemory(paletteIndex + 1, isSprite);
  let paletteLowByte: i32 = loadPaletteByteFromWasmMemory(paletteIndex, isSprite);

  // Return the concatenated color byte
  return <i32>concatenateBytes(paletteHighByte, paletteLowByte);
}

// Function to return the color from a passed 16 bit color pallette
export function getColorComponentFromRgb(colorId: i32, colorRgb: i32): i32 {
  // Get our bitmask for the color ID
  // bit mask tested good :)
  let bitMask: i32 = 0x1f << (colorId * 5);
  let colorValue: i32 = (colorRgb & bitMask) >> (colorId * 5);

  // Goal is to reach 254 for each color, so 255 / 31 (0x1F) ~8 TODO: Make exact
  // Want 5 bits for each
  return colorValue * 8;
}
