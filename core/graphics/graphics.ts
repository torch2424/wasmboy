// Main Class and funcitons for rendering the gameboy display
import { Lcd, setLcdStatus } from './lcd';
import { renderBackground, renderWindow } from './backgroundWindow';
import { renderSprites } from './sprites';
import { clearPriorityMap } from './priority';
import { resetTileCache } from './tiles';
import { Cpu } from '../cpu/index';
import { Config } from '../config';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { checkBitOnByte, setBitOnByte, resetBitOnByte, performanceTimestamp, hexLog } from '../helpers/index';

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
  static readonly memoryLocationScanlineRegister: i32 = 0xff44;
  static scanlineRegister: i32 = 0;
  static readonly memoryLocationDmaTransfer: i32 = 0xff46;

  // Scroll and Window
  static readonly memoryLocationScrollX: i32 = 0xff43;
  static scrollX: i32 = 0;
  static readonly memoryLocationScrollY: i32 = 0xff42;
  static scrollY: i32 = 0;
  static readonly memoryLocationWindowX: i32 = 0xff4b;
  static windowX: i32 = 0;
  static readonly memoryLocationWindowY: i32 = 0xff4a;
  static windowY: i32 = 0;

  // Tile Maps And Data
  static readonly memoryLocationTileMapSelectZeroStart: i32 = 0x9800;
  static readonly memoryLocationTileMapSelectOneStart: i32 = 0x9c00;
  static readonly memoryLocationTileDataSelectZeroStart: i32 = 0x8800;
  static readonly memoryLocationTileDataSelectOneStart: i32 = 0x8000;

  // Sprites
  static readonly memoryLocationSpriteAttributesTable: i32 = 0xfe00;

  // Palettes
  static readonly memoryLocationBackgroundPalette: i32 = 0xff47;
  static readonly memoryLocationSpritePaletteOne: i32 = 0xff48;
  static readonly memoryLocationSpritePaletteTwo: i32 = 0xff49;

  // Screen data needs to be stored in wasm memory

  // Save States

  static readonly saveStateSlot: i32 = 1;

  // Function to save the state of the class
  static saveState(): void {
    store<i32>(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot), Graphics.scanlineCycleCounter);
    store<u8>(getSaveStateMemoryOffset(0x04, Graphics.saveStateSlot), <u8>Lcd.currentLcdMode);

    eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, Graphics.scanlineRegister);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Graphics.scanlineCycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot));
    Lcd.currentLcdMode = load<u8>(getSaveStateMemoryOffset(0x04, Graphics.saveStateSlot));

    Graphics.scanlineRegister = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
    Lcd.updateLcdControl(eightBitLoadFromGBMemory(Lcd.memoryLocationLcdControl));
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

export function initializeGraphics(): void {
  if (Cpu.GBCEnabled) {
    Graphics.scanlineRegister = 0x91;
    eightBitStoreIntoGBMemory(0xff40, 0x91);
    eightBitStoreIntoGBMemory(0xff41, 0x81);
    // 0xFF42 -> 0xFF43 = 0x00
    eightBitStoreIntoGBMemory(0xff44, 0x90);
    // 0xFF45 -> 0xFF46 = 0x00
    eightBitStoreIntoGBMemory(0xff47, 0xfc);
    // 0xFF48 -> 0xFF4B = 0x00

    // GBC VRAM Banks
    eightBitStoreIntoGBMemory(0xff4f, 0x00);
    eightBitStoreIntoGBMemory(0xff70, 0x01);
  } else {
    Graphics.scanlineRegister = 0x91;
    eightBitStoreIntoGBMemory(0xff40, 0x91);
    eightBitStoreIntoGBMemory(0xff41, 0x85);
    // 0xFF42 -> 0xFF45 = 0x00
    eightBitStoreIntoGBMemory(0xff46, 0xff);
    eightBitStoreIntoGBMemory(0xff47, 0xfc);
    eightBitStoreIntoGBMemory(0xff48, 0xff);
    eightBitStoreIntoGBMemory(0xff49, 0xff);
    // 0xFF4A -> 0xFF4B = 0x00

    // GBC VRAM Banks
    eightBitStoreIntoGBMemory(0xff4f, 0x00);
    eightBitStoreIntoGBMemory(0xff70, 0x01);
  }
}

export function updateGraphics(numberOfCycles: i32): void {
  if (Lcd.enabled) {
    Graphics.scanlineCycleCounter += numberOfCycles;

    if (Graphics.scanlineCycleCounter >= Graphics.MAX_CYCLES_PER_SCANLINE()) {
      // Reset the scanlineCycleCounter
      // Don't set to zero to catch extra cycles
      Graphics.scanlineCycleCounter -= Graphics.MAX_CYCLES_PER_SCANLINE();

      // Move to next scanline
      // let scanlineRegister: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
      let scanlineRegister: i32 = Graphics.scanlineRegister;

      // Check if we've reached the last scanline
      if (scanlineRegister === 144) {
        // Draw the scanline
        if (!Config.graphicsDisableScanlineRendering) {
          _drawScanline(scanlineRegister);
        } else {
          _renderEntireFrame();
        }

        // Clear the priority map
        clearPriorityMap();

        // Reset the tile cache
        resetTileCache();
      } else if (scanlineRegister < 144) {
        // Draw the scanline
        if (!Config.graphicsDisableScanlineRendering) {
          _drawScanline(scanlineRegister);
        }
      }

      // Post increment the scanline register after drawing
      if (scanlineRegister > 153) {
        // Check if we overflowed scanlines
        // if so, reset our scanline number
        scanlineRegister = 0;
      } else {
        scanlineRegister += 1;
      }

      // Store our new scanline value
      Graphics.scanlineRegister = scanlineRegister;
      // eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, scanlineRegister);
    }
  }

  // Games like Pokemon crystal want the vblank right as it turns to the value, and not have it increment after
  // It will break and lead to an infinite loop in crystal
  // Therefore, we want to be checking/Setting our LCD status after the scanline updates
  setLcdStatus();
}

// TODO: Make this a _drawPixelOnScanline, as values can be updated while drawing a scanline
function _drawScanline(scanlineRegister: i32): void {
  // Get our seleted tile data memory location
  let tileDataMemoryLocation: i32 = Graphics.memoryLocationTileDataSelectZeroStart;
  if (Lcd.bgWindowTileDataSelect) {
    tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
  }

  // Check if the background is enabled
  // NOTE: On Gameboy color, Pandocs says this does something completely different
  // LCDC.0 - 2) CGB in CGB Mode: BG and Window Master Priority
  // When Bit 0 is cleared, the background and window lose their priority -
  // the sprites will be always displayed on top of background and window,
  // independently of the priority flags in OAM and BG Map attributes.
  // TODO: Enable this different feature for GBC
  if (Cpu.GBCEnabled || Lcd.bgDisplayEnabled) {
    // Get our map memory location
    let tileMapMemoryLocation: i32 = Graphics.memoryLocationTileMapSelectZeroStart;
    if (Lcd.bgTileMapDisplaySelect) {
      tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
    }

    // Finally, pass everything to draw the background
    renderBackground(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation);
  }

  // Check if the window is enabled, and we are currently
  // Drawing lines on the window
  if (Lcd.windowDisplayEnabled) {
    // Get our map memory location
    let tileMapMemoryLocation: i32 = Graphics.memoryLocationTileMapSelectZeroStart;
    if (Lcd.windowTileMapDisplaySelect) {
      tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
    }

    // Finally, pass everything to draw the background
    renderWindow(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation);
  }

  if (Lcd.spriteDisplayEnable) {
    // Sprites are enabled, render them!
    renderSprites(scanlineRegister, Lcd.tallSpriteSize);
  }
}

// Function to render everything for a frame at once
// This is to improve performance
// See above for comments on how things are donw
function _renderEntireFrame(): void {
  // Scanline needs to be in sync while we draw, thus, we can't shortcut anymore than here
  for (let i: u8 = 0; i <= 144; i++) {
    _drawScanline(i);
  }
}
