import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory, sixteenBitLoadFromGBMemory, setPixelOnFrame } from '../memory/index';
import { requestVBlankInterrupt, requestLcdInterrupt } from '../interrupts/index';
import { checkBitOnByte, setBitOnByte, resetBitOnByte } from '../helpers/index';

class Graphics {
  // Count the number of cycles to keep synced with cpu cycles
  static scanlineCycleCounter: i16 = 0x00;
  static MAX_CYCLES_PER_SCANLINE: i16 = 456;
  static MIN_CYCLES_SPRITES_LCD_MODE: i16 = 376;
  static MIN_CYCLES_TRANSFER_DATA_LCD_MODE: i16 = 376;

  // LCD
  static memoryLocationScanlineRegister: u16 = 0xFF44;
  static memoryLocationCoincidenceCompare: u16 = 0xFF45;
  static memoryLocationLcdStatus: u16 = 0xFF41;
  static memoryLocationLcdControl: u16 = 0xFF40;

  // Window
  // TODO -7 on windowX, and export to be used
  static memoryLocationScrollX: u16 = 0xFF43;
  static memoryLocationScrollY: u16 = 0xFF42;
  static memoryLocationWindowX: u16 = 0xFF4B;
  static memoryLocationWindowY: u16 = 0xFF4A;

  // Tile Maps (TODO: Dont seperate Background and window :p)
  static memoryLocationWindowTileMapDisplaySelectZeroStart: u16 = 0x9800;
  static memoryLocationWindowTileMapDisplaySelectOneStart: u16 = 0x9C00;
  static memoryLocationBackgroundAndWindowTileDataSelectZeroStart: u16 = 0x8800;
  static memoryLocationBackgroundAndWindowTileDataSelectOneStart: u16 = 0x8000;
  static memoryLocationBackgroundTileMapDisplaySelectZeroStart: u16 = 0x9800;
  static memoryLocationBackgroundTileMapDisplaySelectOneStart: u16 = 0x9C00;

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
  // LCD bits Explanation
  // 0                0                    000                    0             00
  //      |Coicedence Interrupt|     |Mode Interrupts|  |coincidence flag|    | Mode |
  // Modes:
  // 0 or 00: H-Blank
  // 1 or 01: V-Blank
  // 2 or 10: Searching Sprites Atts
  // 3 or 11: Transfering Data to LCD Driver

  let lcdStatus: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationLcdStatus);
  if(!_isLcdEnabled()) {
    // Reset scanline cycle counter
    Graphics.scanlineCycleCounter = 0;
    eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, 0);

    // Set to mode 1
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = setBitOnByte(0, lcdStatus);

    // Store the status in memory
    eightBitStoreIntoGBMemory(Graphics.memoryLocationLcdStatus, lcdStatus);
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
    lcdStatus = resetBitOnByte(3, lcdStatus);
  }

  // Finally, save our status
  eightBitStoreIntoGBMemory(Graphics.memoryLocationLcdStatus, lcdStatus);
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
      eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, scanlineRegister);
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
  let lcdControl = eightBitLoadFromGBMemory(Graphics.memoryLocationLcdControl);
  if (checkBitOnByte(0, lcdControl)) {
    _renderTiles(lcdControl);
  }

  // if (checkBitOnByte(1, lcdControl)) {
  //   //TODO: Render Sprites
  // }
}


function _getTileAddress(memoryLocation: u16, tileId: u8): u16 {

  let sizeOfTileInMemory: u8 = 16;
  let tileDataAddress: u16 = 0;

  // Check if data location zero
  if(memoryLocation === Graphics.memoryLocationBackgroundAndWindowTileDataSelectZeroStart) {
    // Treat the tile Id as a signed int, and add an offset of 128
    // if the tileId was 0 then the tile would be in memory region 0x9000-0x900F
    let signedTileId: i8 = <i8>tileId;
    tileDataAddress = memoryLocation + ((tileId + 128) * sizeOfTileInMemory);
  } else {
    // if the background layout gave us the tileId 0, then the tile data would be between 0x8000-0x800F.
    tileDataAddress = memoryLocation + (tileId * sizeOfTileInMemory);
  }

  return tileDataAddress;
}

// TODO: Make not specifc to a single palette
function _getColorFromPalette(memoryLocation: u16, colorId: u8): u8 {
  let paletteByte: u8 = eightBitLoadFromGBMemory(memoryLocation);
  let color: u8 = 0;

  // Shift our paletteByte, 2 times for each color ID
  paletteByte = (paletteByte >> (colorId * 2))

  // And off any extra bytes
  paletteByte = paletteByte & 0x03;

  // Return our Color (00, 01, 10, or 11)
  return paletteByte;
}

function _isUsingWindow(lcdControl: u8): boolean {
  if(checkBitOnByte(5, lcdControl)) {
    return true;
  } else {
    return false;
  }
}

// Currently rendering 160x144, instead of the full 256x256 in memory
function _renderTiles(lcdControl: u8): void {

  // Get our Scroll and Window
  let scrollX: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollX);
  let scrollY: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollY);
  let windowX: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationWindowX);
  let windowY: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationWindowY);

  // First determine what tile data we are using
  let tileDataLocation: u16 = Graphics.memoryLocationBackgroundAndWindowTileDataSelectZeroStart;
  if(checkBitOnByte(4, lcdControl)) {
    tileDataLocation = Graphics.memoryLocationBackgroundAndWindowTileDataSelectOneStart;
  }

  // Check which window or background memory map we are using
  let backgroundAndWindowMemory: u16 = 0;
  if(_isUsingWindow(lcdControl)) {
    if(checkBitOnByte(6, lcdControl)) {
      backgroundAndWindowMemory = Graphics.memoryLocationWindowTileMapDisplaySelectOneStart;
    } else {
      backgroundAndWindowMemory = Graphics.memoryLocationWindowTileMapDisplaySelectZeroStart;
    }
  } else {
    if(checkBitOnByte(3, lcdControl)) {
      backgroundAndWindowMemory = Graphics.memoryLocationBackgroundTileMapDisplaySelectOneStart;
    } else {
      backgroundAndWindowMemory = Graphics.memoryLocationBackgroundTileMapDisplaySelectZeroStart;
    }
  }

  // Get our scanline, adjusted for scroll and window
  let pixelRow: u8 = 0;

  if(_isUsingWindow(lcdControl)) {
    pixelRow = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister) - windowY;
  } else {
    pixelRow = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister) + scrollY;
  }

  // Find the scanline we are currently processing on the tile
  // (from the 8x8)
  let tileRow: u16 = ((pixelRow / 8) * 32);

  for (let i: u8 = 0; i < 160; i++) {

    // Get our adjusted X (Column) position
    let pixelColumn: u8 = i + scrollX;

    // Compensate for the window as needed;
    if(_isUsingWindow(lcdControl) && i >= windowX) {
      pixelColumn - windowX;
    }

    // Get our tile Column (from the 8x8)
    let tileColumn: u16 = pixelColumn / 8;

    // Get the tileId from the Memory Map
    let tileIdInMemoryMap: u8 = eightBitLoadFromGBMemory(backgroundAndWindowMemory + tileRow + tileColumn);
    let tileAddress = _getTileAddress(tileDataLocation, tileIdInMemoryMap);

    // Get the y position in the actual tile in memory
    let tilePixelY: u8 = pixelRow % 8;
    tilePixelY = tilePixelY * 2;

    // Finally get both bytes of data for the pixels and their colors
    let pixelColorByteOne: u8 = eightBitLoadFromGBMemory(tileAddress + tilePixelY);
    let pixelColorByteTwo: u8 = eightBitLoadFromGBMemory(tileAddress + tilePixelY + 1);

    // Get the bit that represents our current singular pixel
    // Module represents what exact pixel of the 8
    // Then subtracting 7 to reverse the byte, and then -1 to get the full reverse
    let colorBit: i8 = <i8>(pixelColumn % 8);
    colorBit -= 7;
    colorBit = colorBit * -1;

    // Get both bits at bit position to find the value of the color
    let paletteColorId: u8 = 0;
    if (checkBitOnByte(<u8>colorBit, pixelColorByteOne)) {
      paletteColorId += 1;
      paletteColorId << 1;
    }
    if (checkBitOnByte(<u8>colorBit, pixelColorByteTwo)) {
      paletteColorId += 1;
    }

    // Get our color from our palette
    let pixelWithColor = _getColorFromPalette(Graphics.memoryLocationBackgroundPalette, paletteColorId);

    // Finally save to memory
    setPixelOnFrame(pixelColumn, pixelRow, pixelWithColor + 1);
  }

}
