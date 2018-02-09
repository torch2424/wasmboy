import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemorySkipTraps, sixteenBitLoadFromGBMemory, setPixelOnFrame } from '../memory/index';
import { requestVBlankInterrupt, requestLcdInterrupt } from '../interrupts/index';
import { consoleLog, consoleLogLargest, checkBitOnByte, setBitOnByte, resetBitOnByte } from '../helpers/index';

class Graphics {
  // Count the number of cycles to keep synced with cpu cycles
  static scanlineCycleCounter: i16 = 0x00;
  static MAX_CYCLES_PER_SCANLINE: i16 = 456;
  static MIN_CYCLES_SPRITES_LCD_MODE: i16 = 376;
  static MIN_CYCLES_TRANSFER_DATA_LCD_MODE: i16 = 249;

  // LCD
  // scanlineRegister also known as LY
  // See: http://bgb.bircd.org/pandocs.txt , and search " LY "
  static memoryLocationScanlineRegister: u16 = 0xFF44;
  static memoryLocationCoincidenceCompare: u16 = 0xFF45;
  // Also known at STAT
  static memoryLocationLcdStatus: u16 = 0xFF41;
  // Also known as LCDC
  static memoryLocationLcdControl: u16 = 0xFF40;

  // Window
  // TODO -7 on windowX, and export to be used
  static memoryLocationScrollX: u16 = 0xFF43;
  static memoryLocationScrollY: u16 = 0xFF42;
  static memoryLocationWindowX: u16 = 0xFF4B;
  static memoryLocationWindowY: u16 = 0xFF4A;

  // Tile Maps And Data (TODO: Dont seperate Background and window :p)
  static memoryLocationTileMapSelectZeroStart: u16 = 0x9800;
  static memoryLocationTileMapSelectOneStart: u16 = 0x9C00;
  static memoryLocationTileDataSelectZeroStart: u16 = 0x8800;
  static memoryLocationTileDataSelectOneStart: u16 = 0x8000;

  // Palettes
  static memoryLocationBackgroundPalette: u16 = 0xFF47;
  static memoryLocationSpritePaletteOne: u16 = 0xFF48;
  static memoryLocationSpritePaletteTwo: u16 = 0xFF49;

  // Colors
  static colorWhite: u8 = 1;
  static colorLightGrey: u8 = 2;
  static colorDarkGrey: u8 = 3;
  static colorBlack: u8 = 4;

  // Screen data needs to be stored in wasm memory
}

function _isLcdEnabled(): boolean {
  return checkBitOnByte(7, eightBitLoadFromGBMemory(Graphics.memoryLocationLcdControl));
}

function _setLcdStatus(): void {
  // LCD Status (0xFF41) bits Explanation
  // 0                0                    000                    0             00
  //       |Coicedence Interrupt|     |Mode Interrupts|  |coincidence flag|    | Mode |
  // Modes:
  // 0 or 00: H-Blank
  // 1 or 01: V-Blank
  // 2 or 10: Searching Sprites Atts
  // 3 or 11: Transfering Data to LCD Driver

  let lcdStatus: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationLcdStatus);
  if(!_isLcdEnabled()) {
    // Reset scanline cycle counter
    Graphics.scanlineCycleCounter = 0;
    eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationScanlineRegister, 0);

    // Set to mode 1
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = setBitOnByte(0, lcdStatus);

    // Store the status in memory
    eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationLcdStatus, lcdStatus);
  }

  // Get our current scanline, and lcd mode
  let scanlineRegister: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
  let lcdMode: u8 = lcdStatus & 0x03;

  let newLcdMode: u8 = 0;
  let shouldRequestInterrupt: boolean = false;

  // Find our newLcd mode
  if(scanlineRegister >= 144) {
    // VBlank mode
    newLcdMode = 1;
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = setBitOnByte(0, lcdStatus);
    shouldRequestInterrupt = checkBitOnByte(4, lcdStatus);
  } else {
    if (Graphics.scanlineCycleCounter >= Graphics.MIN_CYCLES_SPRITES_LCD_MODE) {
      // Searching Sprites Atts
      newLcdMode = 2;
      lcdStatus = resetBitOnByte(0, lcdStatus);
      lcdStatus = setBitOnByte(1, lcdStatus);
      shouldRequestInterrupt = checkBitOnByte(5, lcdStatus);
    } else if (Graphics.scanlineCycleCounter >= Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE) {
      // Transferring data to lcd
      newLcdMode = 3;
      lcdStatus = setBitOnByte(0, lcdStatus);
      lcdStatus = setBitOnByte(1, lcdStatus);
    } else {
      // H-Blank
      newLcdMode = 2;
      lcdStatus = resetBitOnByte(0, lcdStatus);
      lcdStatus = resetBitOnByte(1, lcdStatus);
      shouldRequestInterrupt = checkBitOnByte(3, lcdStatus);
    }
  }

  // Check if we want to request an interrupt, and we JUST changed modes
  if(shouldRequestInterrupt && (lcdMode !== newLcdMode)) {
    requestLcdInterrupt();
  }

  // Check for the coincidence flag
  if(eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister) === eightBitLoadFromGBMemory(Graphics.memoryLocationCoincidenceCompare)) {
    lcdStatus = setBitOnByte(2, lcdStatus);
    if(checkBitOnByte(6, lcdStatus)) {
      requestLcdInterrupt();
    }
  } else {
    lcdStatus = resetBitOnByte(2, lcdStatus);
  }

  // Finally, save our status
  eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationLcdStatus, lcdStatus);
}

export function updateGraphics(numberOfCycles: u8): void {

  _setLcdStatus();

  if(_isLcdEnabled()) {

    Graphics.scanlineCycleCounter += numberOfCycles;

    if (Graphics.scanlineCycleCounter >= Graphics.MAX_CYCLES_PER_SCANLINE) {

      // Reset our cycle counter
      Graphics.scanlineCycleCounter = 0;

      // Move to next scanline
      let scanlineRegister: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
      scanlineRegister += 1;

      // Check if we've reached the last scanline
      if(scanlineRegister === 144) {
        // Request a VBlank interrupt
        requestVBlankInterrupt();
      } else if (scanlineRegister > 153) {
        // Check if we overflowed scanlines
        // if so, reset our scanline number
        scanlineRegister = 0;
      } else if (scanlineRegister < 144) {
        // Draw the scanline
        _drawScanline();
      }

      // Store our scanline
      eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationScanlineRegister, scanlineRegister);
    }
  }
}

function _drawScanline(): void {
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
  let lcdControl = eightBitLoadFromGBMemory(Graphics.memoryLocationLcdControl);

  // Get our scanline register
  let scanlineRegister = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);

  // Get our seleted tile data memory location
  let tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;
  if(checkBitOnByte(4, lcdControl)) {
    tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
  }


  // Check if the background is enabled
  if (checkBitOnByte(0, lcdControl)) {
    // Get our scrollX and scrollY
    let scrollX: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollX);
    let scrollY: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollY);

    // Get our map memory location
    let tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;
    if (checkBitOnByte(3, lcdControl)) {
      tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
    }

    // Finally, pass everything to draw the background
    _renderBackground(scanlineRegister, scrollX, scrollY, tileDataMemoryLocation, tileMapMemoryLocation);
  }

  // Check if the window is enabled, and we are currently
  // Drawing lines on the window
  // if(checkBitOnByte(5, lcdControl)) {
  // TODO: Draw the window
  // }

  // if (checkBitOnByte(1, lcdControl)) {
  //   //TODO: Render Sprites
  // }
}


function _getTileDataAddress(tileDataMemoryLocation: u16, tileIdFromTileMap: u16): u16 {

  // Watch this part of The ultimate gameboy talk: https://youtu.be/HyzD8pNlpwI?t=30m50s
  // A line of 8 pixels on a single tile, is represented by 2 bytes.
  // since a single tile is 8x8 pixels, 8 * 2 = 16 bytes
  let sizeOfTileInMemory: u8 = 16;
  let tileDataAddress: u16 = 0;

  // Get the tile ID's tile addess from tile data.
  // For instance, let's say our first line of tile data represents tiles for letters:
  // a b c d e f g
  // And we have tileId 0x02. That means we want the tile for the 'c' character
  // Since each tile is 16 bytes, it would be the starting tileDataAddress + (tileId * tileSize), to skip over tiles we dont want
  // The whole signed thing is weird, and has something to do how the second set of tile data is stored :p
  if(tileDataMemoryLocation === Graphics.memoryLocationTileDataSelectZeroStart) {
    // Treat the tile Id as a signed int, and add an offset of 128
    // if the tileId was 0 then the tile would be in memory region 0x9000-0x900F
    let signedTileId: i16 = <i16>tileIdFromTileMap;
    tileDataAddress = tileDataMemoryLocation + ((tileIdFromTileMap + 128) * sizeOfTileInMemory);
  } else {
    // if the background layout gave us the tileId 0, then the tile data would be between 0x8000-0x800F.
    tileDataAddress = tileDataMemoryLocation + (tileIdFromTileMap * sizeOfTileInMemory);
  }

  return tileDataAddress;
}

// TODO: Make not specifc to a single palette
function _getColorFromPalette(paletteMemoryLocation: u16, colorId: u8): u8 {
  let paletteByte: u8 = eightBitLoadFromGBMemory(paletteMemoryLocation);
  let color: u8 = 0;

  // Shift our paletteByte, 2 times for each color ID
  paletteByte = (paletteByte >> (colorId * 2));

  // And off any extra bytes
  paletteByte = paletteByte & 0x03;

  // Return our Color (00, 01, 10, or 11)
  return paletteByte;
}

function _renderBackground(scanlineRegister: u8, scrollX: u16, scrollY: u16, tileDataMemoryLocation: u16, tileMapMemoryLocation: u16): void {

  // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.

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

  // Loop through x to draw the line like a CRT
  for (let i: u16 = 0; i < 160; i++) {

    // Get our Current X position of our pixel on the on the 160x144 camera
    // this is done by getting the current scroll X position,
    // and adding it do what X Value the scanline is drawing on the camera.
    let pixelXPositionInMap: u16 = i + scrollX;

    // This is to compensate wrapping, same as above
    if(pixelXPositionInMap >= 0x100) {
      pixelXPositionInMap -= 0x100;
    }

    // Divide our pixel position by 8 to get our tile.
    // Since, there are 256x256 pixels, and 32x32 tiles.
    // 256 / 8 = 32.
    // Also, bitshifting by 3, do do a division by 8
    // Need to use u16s, as they will be used to compute an address, which will cause weird errors and overflows
    let tileXPositionInMap: u16 = pixelXPositionInMap >> 3;
    let tileYPositionInMap: u16 = pixelYPositionInMap >> 3;


    // Get our tile address on the tileMap
    // NOTE: (tileMap represents where each tile is displayed on the screen)
    // NOTE: (tile map represents the entire map, now just what is within the "camera")
    // For instance, if we have y pixel 144. 144 / 8 = 18. 18 * 32 = line address in map memory.
    // And we have x pixel 160. 160 / 8 = 20.
    // * 32, because remember, this is NOT only for the camera, the actual map is 32x32. Therefore, the next tile line of the map, is 32 byte offset.
    // Think like indexing a 2d array, as a 1d array and it make sense :)
    let tileMapAddress: u16 = tileMapMemoryLocation + (tileYPositionInMap * 32) + tileXPositionInMap;

    // Get the tile Id on the Tile Map
    let tileIdFromTileMap: u8 = eightBitLoadFromGBMemory(tileMapAddress);

    // Now get our tileDataAddress for the corresponding tileID we found in the map
    // Read the comments in _getTileDataAddress() to see what's going on.
    // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
    // This funcitons returns the start of memory locaiton for the tile 'c'.
    let tileDataAddress: u16 = _getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap);

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
    let byteOneForLineOfTilePixels: u8 = eightBitLoadFromGBMemory(tileDataAddress + (pixelYInTile * 2))
    let byteTwoForLineOfTilePixels: u8 = eightBitLoadFromGBMemory(tileDataAddress + (pixelYInTile * 2) + 1);

    // Same logic as pixelYInTile.
    // However, We need to reverse our byte,
    // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
    // Therefore, is pixelX was 2, then really is need to be 5
    // So 2 - 7 = -5, * 1 = 5
    let reversedPixelXInTile: i16 = <i16>pixelXPositionInMap % 8;
    let pixelXInTile: u8 = <u8>((reversedPixelXInTile - 7) * -1);

    // Now we can get the color for that pixel
    // Colors are represented by getting X position of Byteone, and Y positon of Byte Two
    // To Get the color Id.
    // For example, the result of the color id is 0000 00[xPixelByteOne][xPixelByteTwo]
    let paletteColorId: u8 = 0;
    if (checkBitOnByte(<u8>pixelXInTile, byteOneForLineOfTilePixels)) {
      // Byte one represents the second bit in our color id, so bit shift
      paletteColorId += 1;
      paletteColorId << 1;
    }
    if (checkBitOnByte(<u8>pixelXInTile, byteTwoForLineOfTilePixels)) {
      paletteColorId += 1;
    }

    // Now get the colorId from the pallete, to get our final color
    // Developers could change colorIds to represents different colors
    // in their palette, thus we need to grab the color from there
    let pixelColorInTileFromPalette: u8 = _getColorFromPalette(Graphics.memoryLocationBackgroundPalette, paletteColorId);

    // FINALLY, RENDER THAT PIXEL!
    // Only rendering camera for now, so coordinates are for the camera.
    setPixelOnFrame(i, scanlineRegister, pixelColorInTileFromPalette + 1);
  }
}
