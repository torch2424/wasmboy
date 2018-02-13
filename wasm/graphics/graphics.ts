// Main Class and funcitons for rendering the gameboy display
import {
  setLcdStatus,
  isLcdEnabled
} from './lcd';
import {
  renderBackground
} from './background';
import {
  renderWindow
} from './window';
// Assembly script really not feeling the reexport
import {
  eightBitLoadFromGBMemory
} from '../memory/load';
import {
  eightBitStoreIntoGBMemorySkipTraps
} from '../memory/store';
import {
  requestVBlankInterrupt
} from '../interrupts/index';
import {
  consoleLog,
  consoleLogTwo,
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte
} from '../helpers/index';

export class Graphics {
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

export function updateGraphics(numberOfCycles: u8): void {

  setLcdStatus();

  if(isLcdEnabled()) {

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
  let lcdControl: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationLcdControl);

  // Get our scanline register
  let scanlineRegister: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);

  // Get our seleted tile data memory location
  let tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;
  if(checkBitOnByte(4, lcdControl)) {
    tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
  }


  // Check if the background is enabled
  if (checkBitOnByte(0, lcdControl)) {

    // Get our map memory location
    let tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;
    if (checkBitOnByte(3, lcdControl)) {
      tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
    }

    // Finally, pass everything to draw the background
    renderBackground(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation);
  }

  // Check if the window is enabled, and we are currently
  // Drawing lines on the window
  if(checkBitOnByte(5, lcdControl)) {

    // Get our map memory location
    let tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;
    if (checkBitOnByte(6, lcdControl)) {
      tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
    }

    // Finally, pass everything to draw the background
    renderWindow(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation);
  }

  // if (checkBitOnByte(1, lcdControl)) {
  //   //TODO: Render Sprites
  // }
}
