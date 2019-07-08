// Utility functions involving pixels
import { checkBitOnByte } from '../../helpers/index';
import { PIXEL_PIPELINE_ENTIRE_SCANLINE_FIFO_LOCATION } from '../../constants';
import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory } from '../../memory/index';

export function getPaletteColorIdForPixelFromTileData(xIndex: i32, tileDataByteZero: i32, tileDataByteOne: i32): i32 {
  // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
  // To Get the color Id.
  // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
  // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
  let paletteColorId = 0;
  if (checkBitOnByte(xIndex, tileDataByteOne)) {
    // Byte one represents the second bit in our color id, so bit shift
    paletteColorId += 1;
    paletteColorId = paletteColorId << 1;
  }
  if (checkBitOnByte(xIndex, tileDataByteZero)) {
    paletteColorId += 1;
  }

  return paletteColorId;
}

export function loadPixelFifoByteForPixelIndexFromWasmBoyMemory(byteNumber: i32, pixelIndex: i32): i32 {
  let pixelFifoPixelIndexLocation = _getLocationOfTileIndexFromPixelIndexInPixelFifoFromWasmBoyMemory(pixelIndex);
  return eightBitLoadFromGBMemory(pixelFifoPixelIndexLocation + byteNumber);
}

export function storePixelFifoByteForPixelIndexIntoWasmBoyMemory(byteNumber: i32, pixelIndex: i32, value: i32): void {
  let pixelFifoPixelIndexLocation = _getLocationOfTileIndexFromPixelIndexInPixelFifoFromWasmBoyMemory(pixelIndex);
  eightBitStoreIntoGBMemory(pixelFifoPixelIndexLocation + byteNumber, value);
}

// This function takes in a pixel index,
// and finds the tile in the viewport that is associated with that pixel
// And then returns where the start of that tile for the passed pixel would be
// In our WasmBoy Memory
function _getLocationOfTileIndexFromPixelIndexInPixelFifoFromWasmBoyMemory(pixelIndex: i32): i32 {
  // Get the index of the tile from the specified pixel
  // Divide by 8 to find the correct index
  let tileIndex = pixelIndex >> 3;

  // * 11, because Fifo has the 2 data tile bytes (as shown in ultimate gameboy talk),
  // and for WasmBoy Specifically:
  // A 3rd byte representing the type of pixel for each pixel in the tile (0 = BG/Window, 1 = Sprite)
  // Bytes 4-11 represent the attributes for that tile's pixel
  let pixelFifoIndex = tileIndex * 11;
  return PIXEL_PIPELINE_ENTIRE_SCANLINE_FIFO_LOCATION + pixelFifoIndex;
}
