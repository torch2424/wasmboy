// Functions for rendering the background
import { FRAME_LOCATION } from '../constants';
import { Cpu } from '../cpu/index';
import { Config } from '../config';
import { Graphics, loadFromVramBank, setPixelOnFrame, getRgbPixelStart } from './graphics';
import { getColorizedGbHexColorFromPalette, getRgbColorFromPalette, getColorComponentFromRgb } from './palette';
import { getRedFromHexColor, getGreenFromHexColor, getBlueFromHexColor } from './colors';
import { addPriorityforPixel, getPriorityforPixel } from './priority';
import { TileCache, drawPixelsFromLineOfTile, getTileDataAddress } from './tiles';
// Assembly script really not feeling the reexport
// using Skip Traps, because LCD has unrestricted access
// http://gbdev.gg8.se/wiki/articles/Video_Display#LCD_OAM_DMA_Transfers
import { eightBitLoadFromGBMemory } from '../memory/load';
import { checkBitOnByte, resetBitOnByte } from '../helpers/index';
import { i32Portable } from '../portable/portable';

// NOTE: i32Portable wraps modulo here as somehow it gets converted to a double:
// https://github.com/torch2424/wasmboy/issues/216

// Inlined because closure compiler inlines
export function renderBackground(scanlineRegister: i32, tileDataMemoryLocation: i32, tileMapMemoryLocation: i32): void {
  // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.

  // Get our scrollX and scrollY (u16 to play nice with assemblyscript)
  // let scrollX: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollX);
  // let scrollY: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollY);
  let scrollX: i32 = Graphics.scrollX;
  let scrollY: i32 = Graphics.scrollY;

  // Get our current pixel y positon on the 160x144 camera (Row that the scanline draws across)
  // this is done by getting the current scroll Y position,
  // and adding it do what Y Value the scanline is drawing on the camera.
  let pixelYPositionInMap: i32 = scanlineRegister + scrollY;

  // Gameboy camera will "wrap" around the background map,
  // meaning that if the pixelValue is 350, then we need to subtract 256 (decimal) to get it's actual value
  // pixel values (scrollX and scrollY) range from 0x00 - 0xFF
  pixelYPositionInMap &= 0x100 - 1;

  // Draw the Background scanline
  drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, 0, scrollX);
}

// Inlined because closure compiler inlines
export function renderWindow(scanlineRegister: i32, tileDataMemoryLocation: i32, tileMapMemoryLocation: i32): void {
  // Get our windowX and windowY
  // let windowX: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationWindowX);
  // let windowY: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationWindowY);
  let windowX: i32 = Graphics.windowX;
  let windowY: i32 = Graphics.windowY;

  // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.

  // First ensure that the scanline is greater than our window
  if (scanlineRegister < windowY) {
    // Window is not within the current camera view
    return;
  }

  // WindowX is offset by 7
  windowX -= 7;

  // Get our current pixel y positon on the 160x144 camera (Row that the scanline draws across)
  let pixelYPositionInMap = scanlineRegister - windowY;

  // xOffset is simply a neagative window x
  // NOTE: This can become negative zero?
  // https://github.com/torch2424/wasmboy/issues/216
  let xOffset = i32Portable(-windowX);

  // Draw the Background scanline
  drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, windowX, xOffset);
}

// Function frankenstein'd together to allow background and window to share the same draw scanline function
function drawBackgroundWindowScanline(
  scanlineRegister: i32,
  tileDataMemoryLocation: i32,
  tileMapMemoryLocation: i32,
  pixelYPositionInMap: i32,
  iStart: i32,
  xOffset: i32
): void {
  // Get our tile Y position in the map
  let tileYPositionInMap = pixelYPositionInMap >> 3;

  // Loop through x to draw the line like a CRT
  for (let i = iStart; i < 160; ++i) {
    // Get our Current X position of our pixel on the on the 160x144 camera
    // this is done by getting the current scroll X position,
    // and adding it do what X Value the scanline is drawing on the camera.
    let pixelXPositionInMap = i + xOffset;

    // This is to compensate wrapping, same as pixelY
    if (pixelXPositionInMap >= 0x100) {
      pixelXPositionInMap -= 0x100;
    }

    // Divide our pixel position by 8 to get our tile.
    // Since, there are 256x256 pixels, and 32x32 tiles.
    // 256 / 8 = 32.
    // Also, bitshifting by 3, do do a division by 8
    // Need to use u16s, as they will be used to compute an address, which will cause weird errors and overflows
    let tileXPositionInMap = pixelXPositionInMap >> 3;

    // Get our tile address on the tileMap
    // NOTE: (tileMap represents where each tile is displayed on the screen)
    // NOTE: (tile map represents the entire map, now just what is within the "camera")
    // For instance, if we have y pixel 144. 144 / 8 = 18. 18 * 32 = line address in map memory.
    // And we have x pixel 160. 160 / 8 = 20.
    // * 32, because remember, this is NOT only for the camera, the actual map is 32x32. Therefore, the next tile line of the map, is 32 byte offset.
    // Think like indexing a 2d array, as a 1d array and it make sense :)
    let tileMapAddress = tileMapMemoryLocation + (tileYPositionInMap << 5) + tileXPositionInMap;

    // Get the tile Id on the Tile Map
    let tileIdFromTileMap: i32 = loadFromVramBank(tileMapAddress, 0);

    // Now that we have our Tile Id, let's check our Tile Cache
    let usedTileCache = false;
    if (Config.tileCaching) {
      let pixelsDrawn: i32 = drawLineOfTileFromTileCache(
        i,
        scanlineRegister,
        pixelXPositionInMap,
        pixelYPositionInMap,
        tileMapAddress,
        tileDataMemoryLocation,
        tileIdFromTileMap
      );
      // Increment i by 7, not 8 because i will be incremented at end of for loop
      if (pixelsDrawn > 0) {
        i += pixelsDrawn - 1;
        usedTileCache = true;
      }
    }

    if (Config.tileRendering && !usedTileCache) {
      let pixelsDrawn: i32 = drawLineOfTileFromTileId(
        i,
        scanlineRegister,
        pixelXPositionInMap,
        pixelYPositionInMap,
        tileMapAddress,
        tileDataMemoryLocation,
        tileIdFromTileMap
      );
      // A line of a tile is 8 pixels wide, therefore increase i by (pixelsDrawn - 1), and then the for loop will increment by 1
      // For a net increment for 8
      if (pixelsDrawn > 0) {
        i += pixelsDrawn - 1;
      }
    } else if (!usedTileCache) {
      if (Cpu.GBCEnabled) {
        // Draw the individual pixel
        drawColorPixelFromTileId(
          i,
          scanlineRegister,
          pixelXPositionInMap,
          pixelYPositionInMap,
          tileMapAddress,
          tileDataMemoryLocation,
          tileIdFromTileMap
        );
      } else {
        // Draw the individual pixel
        drawMonochromePixelFromTileId(
          i,
          scanlineRegister,
          pixelXPositionInMap,
          pixelYPositionInMap,
          tileDataMemoryLocation,
          tileIdFromTileMap
        );
      }
    }
  }
}

// Function to draw a pixel for the standard GB
// Inlined because closure compiler inlines
function drawMonochromePixelFromTileId(
  xPixel: i32,
  yPixel: i32,
  pixelXPositionInMap: i32,
  pixelYPositionInMap: i32,
  tileDataMemoryLocation: i32,
  tileIdFromTileMap: i32
): void {
  // Now we can process the the individual bytes that represent the pixel on a tile

  // Now get our tileDataAddress for the corresponding tileID we found in the map
  // Read the comments in _getTileDataAddress() to see what's going on.
  // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
  // This funcitons returns the start of memory locaiton for the tile 'c'.
  let tileDataAddress: i32 = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap);

  // Get the y pixel of the 8 by 8 tile.
  // Simply modulo the scanline.
  // For instance, let's say we are printing the first line of pixels on our camera,
  // And the first line of pixels on our tile.
  // yPixel = 1. 1 % 8 = 1.
  // And for the last line
  // yPixel = 144. 144 % 8 = 0.
  // 0 Represents last line of pixels in a tile, 1 represents first. 1 2 3 4 5 6 7 0.
  // Because remember, we are counting lines on the display NOT including zero
  let pixelYInTile = i32Portable(pixelYPositionInMap & 7);

  // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
  // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
  // Again, think like you had to map a 2d array as a 1d.
  let byteOneForLineOfTilePixels: i32 = loadFromVramBank(tileDataAddress + pixelYInTile * 2, 0);
  let byteTwoForLineOfTilePixels: i32 = loadFromVramBank(tileDataAddress + pixelYInTile * 2 + 1, 0);

  // Same logic as pixelYInTile.
  // However, We need to reverse our byte,
  // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
  // Therefore, is pixelX was 2, then really is need to be 5
  // So 2 - 7 = -5, * 1 = 5
  // Or to simplify, 7 - 2 = 5 haha!
  let pixelXInTile = i32Portable(pixelXPositionInMap & 7);
  pixelXInTile = 7 - pixelXInTile;

  // Now we can get the color for that pixel
  // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
  // To Get the color Id.
  // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
  // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
  let paletteColorId: u8 = 0;
  if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
    // Byte one represents the second bit in our color id, so bit shift
    paletteColorId += 1;
    paletteColorId = paletteColorId << 1;
  }
  if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
    paletteColorId += 1;
  }
  // Not checking u8 Portability overflow here, since it can't be greater than i32 over :p

  // Now get the colorId from the pallete, to get our final color
  // Developers could change colorIds to represents different colors
  // in their palette, thus we need to grab the color from there
  //let pixelColorInTileFromPalette: u8 = getColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
  // Moved below for perofrmance

  // FINALLY, RENDER THAT PIXEL!
  // Only rendering camera for now, so coordinates are for the camera.
  // Get the rgb value for the color Id, will be repeated into R, G, B. if not colorized
  let hexColor: i32 = getColorizedGbHexColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
  setPixelOnFrame(xPixel, yPixel, 0, getRedFromHexColor(hexColor));
  setPixelOnFrame(xPixel, yPixel, 1, getGreenFromHexColor(hexColor));
  setPixelOnFrame(xPixel, yPixel, 2, getBlueFromHexColor(hexColor));

  // Lastly, add the pixel to our background priority map
  // https://github.com/torch2424/wasmBoy/issues/51
  // Bits 0 & 1 will represent the color Id drawn by the BG/Window
  // Bit 2 will represent if the Bg/Window has GBC priority.
  addPriorityforPixel(xPixel, yPixel, paletteColorId);
}

// Function to draw a pixel from a tile in C O L O R
// See above for more context on some variables
// Inlined because closure compiler inlines
function drawColorPixelFromTileId(
  xPixel: i32,
  yPixel: i32,
  pixelXPositionInMap: i32,
  pixelYPositionInMap: i32,
  tileMapAddress: i32,
  tileDataMemoryLocation: i32,
  tileIdFromTileMap: i32
): void {
  // Now get our tileDataAddress for the corresponding tileID we found in the map
  // Read the comments in _getTileDataAddress() to see what's going on.
  // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
  // This funcitons returns the start of memory locaiton for the tile 'c'.
  let tileDataAddress: i32 = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap);

  // Get the GB Map Attributes
  // Bit 0-2  Background Palette number  (BGP0-7)
  // Bit 3    Tile VRAM Bank number      (0=Bank 0, 1=Bank 1)
  // Bit 4    Not used
  // Bit 5    Horizontal Flip            (0=Normal, 1=Mirror horizontally)
  // Bit 6    Vertical Flip              (0=Normal, 1=Mirror vertically)
  // Bit 7    BG-to-OAM Priority         (0=Use OAM priority bit, 1=BG Priority)
  let bgMapAttributes: i32 = loadFromVramBank(tileMapAddress, 1);

  // See above for explanation
  let pixelYInTile = i32Portable(pixelYPositionInMap & 7);
  if (checkBitOnByte(6, bgMapAttributes)) {
    // We are mirroring the tile, therefore, we need to opposite byte
    // So if our pixel was 0 our of 8, it wild become 7 :)
    pixelYInTile = 7 - pixelYInTile;
  }

  // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
  // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
  // But we need to load the time from a specific Vram bank
  let vramBankId = i32Portable(<i32>checkBitOnByte(3, bgMapAttributes));
  let byteOneForLineOfTilePixels: i32 = loadFromVramBank(tileDataAddress + pixelYInTile * 2, vramBankId);
  let byteTwoForLineOfTilePixels: i32 = loadFromVramBank(tileDataAddress + pixelYInTile * 2 + 1, vramBankId);

  // Get our X pixel. Need to NOT reverse it if it was flipped.
  // See above, you have to reverse this normally
  let pixelXInTile = i32Portable(pixelXPositionInMap & 7);
  if (!checkBitOnByte(5, bgMapAttributes)) {
    pixelXInTile = 7 - pixelXInTile;
  }

  // Now we can get the color for that pixel
  // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
  // To Get the color Id.
  // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
  // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
  let paletteColorId = 0;
  if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
    // Byte one represents the second bit in our color id, so bit shift
    paletteColorId += 1;
    paletteColorId = paletteColorId << 1;
  }
  if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
    paletteColorId += 1;
  }

  // Finally lets add some, C O L O R
  // Want the botom 3 bits
  let bgPalette = bgMapAttributes & 0x07;

  // Call the helper function to grab the correct color from the palette
  let rgbColorPalette = getRgbColorFromPalette(bgPalette, paletteColorId, false);

  // Split off into red green and blue
  let red = getColorComponentFromRgb(0, rgbColorPalette);
  let green = getColorComponentFromRgb(1, rgbColorPalette);
  let blue = getColorComponentFromRgb(2, rgbColorPalette);

  // Finally Place our colors on the things
  setPixelOnFrame(xPixel, yPixel, 0, red);
  setPixelOnFrame(xPixel, yPixel, 1, green);
  setPixelOnFrame(xPixel, yPixel, 2, blue);

  // Lastly, add the pixel to our background priority map
  // https://github.com/torch2424/wasmBoy/issues/51
  // Bits 0 & 1 will represent the color Id drawn by the BG/Window
  // Bit 2 will represent if the Bg/Window has GBC priority.
  addPriorityforPixel(xPixel, yPixel, paletteColorId, checkBitOnByte(7, bgMapAttributes));
}

// Function to attempt to draw the tile from the tile cache
// Inlined because closure compiler inlines
function drawLineOfTileFromTileCache(
  xPixel: i32,
  yPixel: i32,
  pixelXPositionInMap: i32,
  pixelYPositionInMap: i32,
  tileMapAddress: i32,
  tileDataMemoryLocation: i32,
  tileIdFromTileMap: i32
): i32 {
  // First, initialize how many pixels we have drawn
  let pixelsDrawn: i32 = 0;

  // Check if the current tile matches our tileId
  // TODO: Allow the first line to use the tile cache, for some odd reason it doesn't work when scanline is 0
  let nextXIndexToPerformCacheCheck = TileCache.nextXIndexToPerformCacheCheck;
  if (yPixel > 0 && xPixel > 8 && <i32>tileIdFromTileMap === TileCache.tileId && xPixel === nextXIndexToPerformCacheCheck) {
    // Was last tile flipped
    let wasLastTileHorizontallyFlipped = checkBitOnByte(5, eightBitLoadFromGBMemory(tileMapAddress - 1));
    let isCurrentTileHorizontallyFlipped = checkBitOnByte(5, eightBitLoadFromGBMemory(tileMapAddress));

    // Simply copy the last 8 pixels from memory to copy the line from the tile
    for (let tileCacheIndex = 0; tileCacheIndex < 8; ++tileCacheIndex) {
      // Check if we need to render backwards for flipping
      if (wasLastTileHorizontallyFlipped !== isCurrentTileHorizontallyFlipped) {
        tileCacheIndex = 7 - tileCacheIndex;
      }

      let xPos = xPixel + tileCacheIndex;
      // First check for overflow
      if (xPos <= 160) {
        // Get the pixel location in memory of the tile
        let previousXPixel = xPixel - (8 - tileCacheIndex);
        let previousTilePixelLocation = FRAME_LOCATION + getRgbPixelStart(xPos, yPixel);

        // Cycle through the RGB
        // for (let tileCacheRgb = 0; tileCacheRgb < 3; ++tileCacheRgb) {
        //  setPixelOnFrame(xPixel + tileCacheIndex, yPixel, tileCacheRgb, load<u8>(previousTilePixelLocation + tileCacheRgb));
        // }
        // unroll
        setPixelOnFrame(xPos, yPixel, 0, load<u8>(previousTilePixelLocation, 0));
        setPixelOnFrame(xPos, yPixel, 1, load<u8>(previousTilePixelLocation, 1));
        setPixelOnFrame(xPos, yPixel, 2, load<u8>(previousTilePixelLocation, 2));

        // Copy the priority for the pixel
        let pixelPriority: i32 = getPriorityforPixel(previousXPixel, yPixel);
        addPriorityforPixel(xPos, yPixel, resetBitOnByte(2, pixelPriority), checkBitOnByte(2, pixelPriority));

        pixelsDrawn++;
      }
    }
  } else {
    // Save our current tile Id, and the next x value we should check the x index
    TileCache.tileId = tileIdFromTileMap;
  }

  // Calculate when we should do the tileCache calculation again
  if (xPixel >= nextXIndexToPerformCacheCheck) {
    nextXIndexToPerformCacheCheck = xPixel + 8;
    let xOffsetTileWidthRemainder = i32Portable(pixelXPositionInMap & 7);
    if (xPixel < xOffsetTileWidthRemainder) {
      nextXIndexToPerformCacheCheck += xOffsetTileWidthRemainder;
    }
  }
  TileCache.nextXIndexToPerformCacheCheck = nextXIndexToPerformCacheCheck;

  return pixelsDrawn;
}

// Function to draw a line of a tile in Color
// This is for tile rendering shortcuts
// Inlined because closure compiler inlines
function drawLineOfTileFromTileId(
  xPixel: i32,
  yPixel: i32,
  pixelXPositionInMap: i32,
  pixelYPositionInMap: i32,
  tileMapAddress: i32,
  tileDataMemoryLocation: i32,
  tileIdFromTileMap: i32
): i32 {
  // Get the which line of the tile we are rendering
  let tileLineY: i32 = i32Portable(pixelYPositionInMap & 7);

  // Now lets find our tileX start and end
  // This is for the case where i = 0, but scroll X was 3.
  // Or i is 157, and our camera is only 160 pixels wide
  let tileXStart = 0;
  if (xPixel == 0) {
    tileXStart = pixelXPositionInMap - ((pixelXPositionInMap >> 3) << 3);
  }
  let tileXEnd = 7;
  if (xPixel + 8 > 160) {
    tileXEnd = 160 - xPixel;
  }

  // initialize some variables for GBC
  let bgMapAttributes = -1;
  let vramBankId = 0;
  if (Cpu.GBCEnabled) {
    // Get Our GBC properties
    bgMapAttributes = loadFromVramBank(tileMapAddress, 1);
    vramBankId = i32Portable(<i32>checkBitOnByte(3, <u8>bgMapAttributes));

    if (checkBitOnByte(6, bgMapAttributes)) {
      // We are mirroring the tile, therefore, we need to opposite byte
      // So if our pixel was 0 our of 8, it wild become 7 :)
      tileLineY = 7 - tileLineY;
    }
  }

  // Return the number of pixels drawn
  return drawPixelsFromLineOfTile(
    tileIdFromTileMap,
    tileDataMemoryLocation,
    vramBankId,
    tileXStart,
    tileXEnd,
    tileLineY,
    xPixel,
    yPixel,
    160,
    FRAME_LOCATION,
    false,
    0,
    bgMapAttributes,
    -1
  );
}
