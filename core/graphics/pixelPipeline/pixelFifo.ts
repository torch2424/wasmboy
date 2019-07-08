// Class responsible for pushing our pixels with their respective palettes
import { checkBitOnByte, log } from '../../helpers/index';
import { Cpu } from '../../cpu/index';
import { Graphics } from '../graphics';
import { Palette, getColorizedGbHexColorFromPalette, getRgbColorFromPalette, getColorComponentFromRgb } from '../palette';
import { getRedFromHexColor, getGreenFromHexColor, getBlueFromHexColor } from '../colors';
import { setPixelOnFrame } from '../util';
import { getPaletteColorIdForPixelFromTileData, loadPixelFifoByteForPixelIndexFromWasmBoyMemory } from './util';

export class PixelFifo {
  // Status of the Fetcher
  // 0: Idling
  // 1: Pushing Pixels
  static currentStatus: i32 = 0;

  // Number of pixels in our fifo
  static numberOfPixelsInFifo: i32 = 0;

  // Current index of the pixels we should pop next.
  static currentIndex: i32 = 0;

  static step(): void {
    // Check if we can continue idling
    // Pixel Fifo won't push out pixels unless there are <= 8 pixels in the fifo
    let pixelsRemainingInFifo = PixelFifo.numberOfPixelsInFifo - PixelFifo.currentIndex;
    if (pixelsRemainingInFifo <= 8) {
      PixelFifo.currentStatus = 0;
      return;
    }

    // We are pushing pixels
    PixelFifo.currentStatus = 1;

    // Find which pixel from the tile we want to push
    // By modulo 8 (doing & 7 since it is faster)
    let pixelIndex = PixelFifo.currentIndex & 7;

    // Grab the info for the pixel
    let fifoTileDataByteZero = loadPixelFifoByteForPixelIndexFromWasmBoyMemory(0, PixelFifo.currentIndex);
    let fifoTileDataByteOne = loadPixelFifoByteForPixelIndexFromWasmBoyMemory(1, PixelFifo.currentIndex);
    let fifoTypePerPixel = loadPixelFifoByteForPixelIndexFromWasmBoyMemory(2, PixelFifo.currentIndex);
    let fifoPixelAttributes = loadPixelFifoByteForPixelIndexFromWasmBoyMemory(3 + pixelIndex, PixelFifo.currentIndex);

    // Find if our pixel is a sprite or note
    let pixelIsSprite: boolean = checkBitOnByte(pixelIndex, fifoTypePerPixel);

    // Get the color id of our pixel
    let fifoPaletteColorId: i32 = getPaletteColorIdForPixelFromTileData(pixelIndex, fifoTileDataByteZero, fifoTileDataByteOne);

    // Get the actual RGB Color of our pixel
    let red: i32 = 0;
    let green: i32 = 0;
    let blue: i32 = 0;
    if (Cpu.GBCEnabled) {
      // C O L O R

      // Get our Palette Index (Bits 0-2 for both BG and Sprites)
      let paletteIndex = fifoPixelAttributes & 7;

      // Call the helper function to grab the correct color from the palette
      let rgbColorPalette = getRgbColorFromPalette(paletteIndex, fifoPaletteColorId, pixelIsSprite);

      // Split off into red green and blue
      let red = getColorComponentFromRgb(0, rgbColorPalette);
      let green = getColorComponentFromRgb(1, rgbColorPalette);
      let blue = getColorComponentFromRgb(2, rgbColorPalette);
    } else {
      // Monochrome

      let paletteMemoryLocation = Palette.memoryLocationBackgroundPalette;
      if (pixelIsSprite) {
        if (checkBitOnByte(4, fifoPixelAttributes)) {
          paletteMemoryLocation = Palette.memoryLocationSpritePaletteTwo;
        } else {
          paletteMemoryLocation = Palette.memoryLocationSpritePaletteOne;
        }
      }

      // Get the rgb value for the color Id, will be repeated into R, G, B. if not colorized
      let hexColor: i32 = getColorizedGbHexColorFromPalette(fifoPaletteColorId, paletteMemoryLocation);
      red = getRedFromHexColor(hexColor);
      green = getGreenFromHexColor(hexColor);
      blue = getBlueFromHexColor(hexColor);
    }

    // Finally write to our frame for the pixel
    // Finally Place our colors on the things
    setPixelOnFrame(PixelFifo.currentIndex, Graphics.scanlineRegister, 0, red);
    setPixelOnFrame(PixelFifo.currentIndex, Graphics.scanlineRegister, 1, green);
    setPixelOnFrame(PixelFifo.currentIndex, Graphics.scanlineRegister, 2, blue);

    // Increase our pixel index
    PixelFifo.currentIndex++;
  }

  static reset(): void {
    PixelFifo.currentStatus = 0;
    PixelFifo.currentIndex = 0;
    PixelFifo.numberOfPixelsInFifo = 0;
  }
}
