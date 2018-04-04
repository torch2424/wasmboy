// Functions to debug graphical output
import {
  backgroundMapLocation
} from '../constants/constants';
import {
  Graphics
} from '../graphics/graphics';
import {
  getTileDataAddress
} from '../graphics/renderUtils';
import {
  getMonochromeColorFromPalette,
  getRgbColorFromPalette,
  getColorComponentFromRgb
} from '../graphics/palette';
import {
  eightBitLoadFromGBMemorySkipTraps,
  Memory,
  loadFromVramBank
} from '../memory/index';
import {
  checkBitOnByte
} from '../helpers/index';

export function drawBackgroundMapToWasmMemory(): void {
  // http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
  // Bit 7 - LCD Display Enable (0=Off, 1=On)
  // Bit 6 - Window Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
  // Bit 5 - Window Display Enable (0=Off, 1=On)
  // Bit 4 - BG & Window Tile Data Select (0=8800-97FF, 1=8000-8FFF)
  // Bit 3 - BG Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
  // Bit 2 - OBJ (Sprite) Size (0=8x8, 1=8x16)
  // Bit 1 - OBJ (Sprite) Display Enable (0=Off, 1=On)
  // Bit 0 - BG Display (for CGB see below) (0=Off, 1=On)

  // Get our lcd control, see above for usage
  let lcdControl: u8 = eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationLcdControl);

  // Get our seleted tile data memory location
  let tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;
  if(checkBitOnByte(4, lcdControl)) {
    tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
  }

  let tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;
  if (checkBitOnByte(3, lcdControl)) {
    tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
  }

  for(let y: i32 = 0; y < 256; y++) {
    for (let x: i32 = 0; x < 256; x++) {

      // Get our current Y
      let pixelYPositionInMap: u16 = <u16>y;

      // Get our Current X position of our pixel on the on the 160x144 camera
      // this is done by getting the current scroll X position,
      // and adding it do what X Value the scanline is drawing on the camera.
      let pixelXPositionInMap: i32 = x;

      // Divide our pixel position by 8 to get our tile.
      // Since, there are 256x256 pixels, and 32x32 tiles.
      // 256 / 8 = 32.
      // Also, bitshifting by 3, do do a division by 8
      // Need to use u16s, as they will be used to compute an address, which will cause weird errors and overflows
      let tileXPositionInMap: i32 = pixelXPositionInMap >> 3;
      let tileYPositionInMap: i32 = pixelYPositionInMap >> 3;

      // Get our tile address on the tileMap
      // NOTE: (tileMap represents where each tile is displayed on the screen)
      // NOTE: (tile map represents the entire map, now just what is within the "camera")
      // For instance, if we have y pixel 144. 144 / 8 = 18. 18 * 32 = line address in map memory.
      // And we have x pixel 160. 160 / 8 = 20.
      // * 32, because remember, this is NOT only for the camera, the actual map is 32x32. Therefore, the next tile line of the map, is 32 byte offset.
      // Think like indexing a 2d array, as a 1d array and it make sense :)
      let tileMapAddress: u16 = tileMapMemoryLocation + <u16>(tileYPositionInMap * 32) + <u16>tileXPositionInMap;

      // Get the tile Id on the Tile Map
      let tileIdFromTileMap: u8 = loadFromVramBank(tileMapAddress, 0);

      // Now get our tileDataAddress for the corresponding tileID we found in the map
      // Read the comments in _getTileDataAddress() to see what's going on.
      // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
      // This funcitons returns the start of memory locaiton for the tile 'c'.
      let tileDataAddress: u16 = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap);

      // Now we can process the the individual bytes that represent the pixel on a tile

      // Get the y pixel of the 8 by 8 tile.
      // Simply modulo the scanline.
      // For instance, let's say we are printing the first line of pixels on our camera,
      // And the first line of pixels on our tile.
      // yPixel = 1. 1 % 8 = 1.
      // And for the last line
      // yPixel = 144. 144 % 8 = 0.
      // 0 Represents last line of pixels in a tile, 1 represents first. 1 2 3 4 5 6 7 0.
      // Because remember, we are counting lines on the display NOT including zero
      let pixelYInTile: u16 = pixelYPositionInMap % 8;

      // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
      // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
      // Again, think like you had to map a 2d array as a 1d.
      let byteOneForLineOfTilePixels: u8 = loadFromVramBank(tileDataAddress + (pixelYInTile * 2), 0)
      let byteTwoForLineOfTilePixels: u8 = loadFromVramBank(tileDataAddress + (pixelYInTile * 2) + 1, 0);

      // Same logic as pixelYInTile.
      // However, We need to reverse our byte,
      // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
      // Therefore, is pixelX was 2, then really is need to be 5
      // So 2 - 7 = -5, * 1 = 5
      // Or to simplify, 7 - 2 = 5 haha!
      let pixelXInTile: u8 = <u8>(pixelXPositionInMap) % 8;
      pixelXInTile = 7 - pixelXInTile;

      // Now we can get the color for that pixel
      // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
      // To Get the color Id.
      // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
      // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
      let paletteColorId: u8 = 0;
      if (checkBitOnByte(<u8>pixelXInTile, byteTwoForLineOfTilePixels)) {
        // Byte one represents the second bit in our color id, so bit shift
        paletteColorId += 1;
        paletteColorId = (paletteColorId << 1);
      }
      if (checkBitOnByte(<u8>pixelXInTile, byteOneForLineOfTilePixels)) {
        paletteColorId += 1;
      }

      // Now get the colorId from the pallete, to get our final color
      // Developers could change colorIds to represents different colors
      // in their palette, thus we need to grab the color from there
      //let pixelColorInTileFromPalette: u8 = getColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
      // Moved below for perofrmance

      // FINALLY, RENDER THAT PIXEL!
      // Only rendering camera for now, so coordinates are for the camera.
      // Get the rgb value for the color Id, will be repeated into R, G, B
      let monochromeColor: u8 = getMonochromeColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);

      let pixelStart: i32 = ((y * 256) + x) * 3;

      for(let i: i32 = 0; i < 3; i++) {
        let offset: i32 = backgroundMapLocation + pixelStart + i;
        store<u8>(offset, monochromeColor);
      }
    }
  }
}
