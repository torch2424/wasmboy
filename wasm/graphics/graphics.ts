// Main Class and funcitons for rendering the gameboy display
import {
  setLcdStatus,
  isLcdEnabled
} from './lcd';
import {
  renderBackground,
  renderWindow
} from './backgroundWindow';
import {
  renderSprites
} from './sprites';
import {
  Cpu
} from '../cpu/cpu'
import {
  Config
} from '../config';
import {
  eightBitLoadFromGBMemorySkipTraps,
  eightBitStoreIntoGBMemorySkipTraps,
  updateHblankHdma,
  storeFrameToBeRendered,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import {
  requestVBlankInterrupt
} from '../interrupts/index';
import {
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte,
  performanceTimestamp,
  hexLog
} from '../helpers/index';

export class Graphics {

  // Current cycles
  // This will be used for batch processing
  static currentCycles: i32 = 0;

  // Number of cycles to run in each batch process
  // This number should be in sync so that graphics doesn't run too many cyles at once
  // and does not exceed the minimum number of cyles for either scanlines, or
  // How often we change the frame, or a channel's update process
  static batchProcessCycles(): i32 {
      return Graphics.MAX_CYCLES_PER_SCANLINE();
  }

  // Count the number of cycles to keep synced with cpu cycles
  // Found GBC cycles by finding clock speed from Gb Cycles
  // See TCAGBD For cycles
  static scanlineCycleCounter: i32 = 0x00;

  static MAX_CYCLES_PER_SCANLINE(): i32 {
    if (Cpu.GBCDoubleSpeed) {
      return 912;
    }

    return 456;
  }

  static MIN_CYCLES_SPRITES_LCD_MODE(): i32 {
    if (Cpu.GBCDoubleSpeed) {
      // TODO: Confirm these clock cyles, double similar to scanline, which TCAGBD did
      return 752;
    }

    return 376;
  }
  static MIN_CYCLES_TRANSFER_DATA_LCD_MODE(): i32 {
    if (Cpu.GBCDoubleSpeed) {
      // TODO: Confirm these clock cyles, double similar to scanline, which TCAGBD did
      return 498;
    }

    return 249;
  }

  // LCD
  // scanlineRegister also known as LY
  // See: http://bgb.bircd.org/pandocs.txt , and search " LY "
  static readonly memoryLocationScanlineRegister: u16 = 0xFF44;
  static readonly memoryLocationCoincidenceCompare: u16 = 0xFF45;
  static readonly memoryLocationDmaTransfer: u16 = 0xFF46;

  // Also known at STAT
  static readonly memoryLocationLcdStatus: u16 = 0xFF41;
  // Also known as LCDC
  static readonly memoryLocationLcdControl: u16 = 0xFF40;
  static currentLcdMode: u8 = 0;

  // Scroll and Window
  static readonly memoryLocationScrollX: u16 = 0xFF43;
  static readonly memoryLocationScrollY: u16 = 0xFF42;
  static readonly memoryLocationWindowX: u16 = 0xFF4B;
  static readonly memoryLocationWindowY: u16 = 0xFF4A;

  // Tile Maps And Data
  static readonly memoryLocationTileMapSelectZeroStart: u16 = 0x9800;
  static readonly memoryLocationTileMapSelectOneStart: u16 = 0x9C00;
  static readonly memoryLocationTileDataSelectZeroStart: u16 = 0x8800;
  static readonly memoryLocationTileDataSelectOneStart: u16 = 0x8000;

  // Sprites
  static readonly memoryLocationSpriteAttributesTable: u16 = 0xFE00;

  // Palettes
  static readonly memoryLocationBackgroundPalette: u16 = 0xFF47;
  static readonly memoryLocationSpritePaletteOne: u16 = 0xFF48;
  static readonly memoryLocationSpritePaletteTwo: u16 = 0xFF49;

  // Screen data needs to be stored in wasm memory

  // Save States

  static readonly saveStateSlot: u16 = 1;

  // Function to save the state of the class
  static saveState(): void {
    store<i32>(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot), Graphics.scanlineCycleCounter);
    store<u8>(getSaveStateMemoryOffset(0x04, Graphics.saveStateSlot), Graphics.currentLcdMode);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Graphics.scanlineCycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot));
    Graphics.currentLcdMode = load<u8>(getSaveStateMemoryOffset(0x04, Graphics.saveStateSlot));
  }
}

// Batch Process Graphics
// http://gameboy.mongenel.com/dmg/asmmemmap.html and http://gbdev.gg8.se/wiki/articles/Video_Display
// Function to batch process our graphics after we skipped so many cycles
// This is not currently checked in memory read/write
export function batchProcessGraphics(): void {

  if (Graphics.currentCycles < Graphics.batchProcessCycles()) {
    return;
  }

  while (Graphics.currentCycles >= Graphics.batchProcessCycles()) {
    updateGraphics(Graphics.batchProcessCycles());
    Graphics.currentCycles = Graphics.currentCycles - Graphics.batchProcessCycles();
  }
}

export function updateGraphics(numberOfCycles: i32): void {

  // Get if the LCD is currently enabled
  // Doing this for performance
  let lcdEnabledStatus: boolean = isLcdEnabled();

  setLcdStatus(lcdEnabledStatus);

  if(lcdEnabledStatus) {

    Graphics.scanlineCycleCounter += numberOfCycles;

    if (Graphics.scanlineCycleCounter >= Graphics.MAX_CYCLES_PER_SCANLINE()) {

      // Reset the scanlineCycleCounter
      // Don't set to zero to catch extra cycles
      Graphics.scanlineCycleCounter -= Graphics.MAX_CYCLES_PER_SCANLINE();

      // Move to next scanline
      let scanlineRegister: u8 = eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationScanlineRegister);

      // Check if we've reached the last scanline
      if(scanlineRegister === 144) {
        // Draw the scanline
        if (!Config.graphicsDisableScanlineRendering) {
          _drawScanline(scanlineRegister);
        } else {
          _renderEntireFrame();
        }
        // Store the frame to be rendered
        storeFrameToBeRendered();
        // Update the Hblank DMA, will return if not active
        updateHblankHdma();
        // Request a VBlank interrupt
        requestVBlankInterrupt();
      } else if (scanlineRegister < 144) {
        // Draw the scanline
        if (!Config.graphicsDisableScanlineRendering) {
          _drawScanline(scanlineRegister);
        }
        // Update the Hblank DMA, will return if not active
        updateHblankHdma();
      }

      // Store our scanline
      if (scanlineRegister > 153) {
        // Check if we overflowed scanlines
        // if so, reset our scanline number
        scanlineRegister = 0;
      } else {
        scanlineRegister += 1;
      }
      eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationScanlineRegister, scanlineRegister);
    }
  }
}

// TODO: Make this a _drawPixelOnScanline, as values can be updated while drawing a scanline
function _drawScanline(scanlineRegister: u8): void {
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

  if (checkBitOnByte(1, lcdControl)) {
    // Sprites are enabled, render them!
    renderSprites(scanlineRegister, checkBitOnByte(2, lcdControl));
  }
}

// Function to render everything for a frame at once
// This is to improve performance
// See above for comments on how things are donw
function _renderEntireFrame(): void {
  // Scanline needs to be in sync while we draw, thus, we can't shortcut anymore than here
  for(let i: u8 = 0; i <= 144; i++) {
    _drawScanline(i);
  }
}
