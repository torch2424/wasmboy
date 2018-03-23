// Functions for rendering the background
import {
  Cpu
} from '../cpu/cpu';
import {
  Graphics
} from './graphics';
import {
  getTileDataAddress,
  getMonochromeColorFromPalette
} from './renderUtils'
// Assembly script really not feeling the reexport
// using Skip Traps, because LCD has unrestricted access
// http://gbdev.gg8.se/wiki/articles/Video_Display#LCD_OAM_DMA_Transfers
import {
  eightBitLoadFromGBMemorySkipTraps
} from '../memory/load';
import {
  Memory,
  loadFromVramBank,
  setPixelOnFrameDirectlyToWasmMemory
} from '../memory/memory';
import {
  hexLog,
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte
} from '../helpers/index';

export function renderBackground(scanlineRegister: u8, tileDataMemoryLocation: u16, tileMapMemoryLocation: u16): void {

  // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.

  // Get our scrollX and scrollY (u16 to play nice with assemblyscript)
  let scrollX: u16 = <u16>eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationScrollX);
  let scrollY: u16 = <u16>eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationScrollY);

  // Get our current pixel y positon on the 160x144 camera (Row that the scanline draws across)
  // this is done by getting the current scroll Y position,
  // and adding it do what Y Value the scanline is drawing on the camera.
  let pixelYPositionInMap: u16 = <u16>scanlineRegister + scrollY;

  // Gameboy camera will "wrap" around the background map,
  // meaning that if the pixelValue is 350, then we need to subtract 256 (decimal) to get it's actual value
  // pixel values (scrollX and scrollY) range from 0x00 - 0xFF
  if(pixelYPositionInMap >= 0x100) {
    pixelYPositionInMap -= 0x100;
  }

  // Cache the beginning of our scanlineOffset in wasmboy Memory for performance
  // https://github.com/AssemblyScript/assemblyscript/issues/40#issuecomment-372479760
  let scanlineStartOffset: i32 = Memory.frameInProgressVideoOutputLocation + (<i32>scanlineRegister * 160);


  // Draw the Background scanline
  drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, 0, scrollX, scanlineStartOffset);
}

export function renderWindow(scanlineRegister: u8, tileDataMemoryLocation: u16, tileMapMemoryLocation: u16): void {

  // Get our windowX and windowY
  let windowX: u16 = <u16>eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationWindowX);
  let windowY: u16 = <u16>eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationWindowY);

  // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.

  // First ensure that the scanline is greater than our window
  if(scanlineRegister < <u8>windowY) {
    // Window is not within the current camera view
    return;
  }

  // WindowX is offset by 7
  windowX = windowX - 7;

  // Get our current pixel y positon on the 160x144 camera (Row that the scanline draws across)
  let pixelYPositionInMap: u16 = <u16>scanlineRegister - windowY;

  // Cache the beginning of our scanlineOffset in wasmboy Memory for performance
  // https://github.com/AssemblyScript/assemblyscript/issues/40#issuecomment-372479760
  let scanlineStartOffset: i32 = Memory.frameInProgressVideoOutputLocation + (<i32>scanlineRegister * 160);

  // xOffset is simply a neagat5ive window x
  let xOffset: i32 = -1 * (<i32>windowX);

  // Draw the Background scanline
  drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, windowX, xOffset, scanlineStartOffset);
}

// Function frankenstein'd together to allow background and window to share the same draw scanline function
function drawBackgroundWindowScanline(scanlineRegister: u8, tileDataMemoryLocation: u16, tileMapMemoryLocation: u16, pixelYPositionInMap: u16, iStart: i32, xOffset: i32, memoryStartOffset: i32): void {

  // Loop through x to draw the line like a CRT
  for (let i: i32 = iStart; i < 160; i++) {

    // Get our Current X position of our pixel on the on the 160x144 camera
    // this is done by getting the current scroll X position,
    // and adding it do what X Value the scanline is drawing on the camera.
    let pixelXPositionInMap: i32 = i + xOffset;

    // This is to compensate wrapping, same as pixelY
    if(pixelXPositionInMap >= 0x100) {
      pixelXPositionInMap -= 0x100;
    }

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
    let tileIdFromTileMap: u8 = eightBitLoadFromGBMemorySkipTraps(tileMapAddress);

    // Now get our tileDataAddress for the corresponding tileID we found in the map
    // Read the comments in _getTileDataAddress() to see what's going on.
    // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
    // This funcitons returns the start of memory locaiton for the tile 'c'.
    let tileDataAddress: u16 = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap);

    if (Cpu.GBCEnabled) {
      drawMonochromePixelFromTile(pixelYPositionInMap, pixelXPositionInMap, tileDataAddress, memoryStartOffset + i);
      //drawColorPixelFromTile(pixelYPositionInMap, pixelXPositionInMap, tileMapAddress, tileDataAddress, memoryStartOffset + i);
    } else {
      drawMonochromePixelFromTile(pixelYPositionInMap, pixelXPositionInMap, tileDataAddress, memoryStartOffset + i);
    }
  }
}

// Function to draw a pixel for the standard GB
function drawMonochromePixelFromTile(pixelYPositionInMap: u16, pixelXPositionInMap: i32, tileDataAddress: u16, memoryOffset: i32): void {
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
  let byteOneForLineOfTilePixels: u8 = eightBitLoadFromGBMemorySkipTraps(tileDataAddress + (pixelYInTile * 2))
  let byteTwoForLineOfTilePixels: u8 = eightBitLoadFromGBMemorySkipTraps(tileDataAddress + (pixelYInTile * 2) + 1);

  // Same logic as pixelYInTile.
  // However, We need to reverse our byte,
  // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
  // Therefore, is pixelX was 2, then really is need to be 5
  // So 2 - 7 = -5, * 1 = 5
  let reversedPixelXInTile: i16 = <i16>pixelXPositionInMap % 8;
  let pixelXInTile: u8 = <u8>((reversedPixelXInTile - 7) * -1);

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
  setPixelOnFrameDirectlyToWasmMemory(memoryOffset, getMonochromeColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette));
}

// Function to draw a pixel from a tile in C O L O R
function drawColorPixelFromTile(pixelYPositionInMap: u16, pixelXPositionInMap: i32, tileMapAddress: u16, tileDataAddress: u16, memoryOffset: i32): void {

  // Get the GB Map Attributes
  // Bit 0-2  Background Palette number  (BGP0-7)
  // Bit 3    Tile VRAM Bank number      (0=Bank 0, 1=Bank 1)
  // Bit 4    Not used
  // Bit 5    Horizontal Flip            (0=Normal, 1=Mirror horizontally)
  // Bit 6    Vertical Flip              (0=Normal, 1=Mirror vertically)
  // Bit 7    BG-to-OAM Priority         (0=Use OAM priority bit, 1=BG Priority)
  let bgMapAttributes: u8 = loadFromVramBank(tileMapAddress, 1);


}