// Main Class and funcitons for rendering the gameboy display
import { getSaveStateMemoryOffset } from '../core';
import { Cpu } from '../cpu/index';
import {
  Memory,
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { initializeColors } from './colors';
import { initializePalette } from './palette';
import { Lcd } from './lcd';
import { Sprites } from './sprites';
import { PixelPipeline } from './pixelPipeline/pixelPipeline';

export class Graphics {
  // Current cycles
  // This will be used for batch processing
  static currentCycles: i32 = 0;

  // ScanlineRegister also known as LY
  // See: http://bgb.bircd.org/pandocs.txt , and search " LY "
  // Also keeping track how many cycles we've been on the current scanline
  static readonly memoryLocationScanlineRegister: i32 = 0xff44;
  static readonly memoryLocationDmaTransfer: i32 = 0xff46;
  static scanlineRegister: i32 = 0;
  static scanlineCycles: i32 = 0;

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

  // Save States

  static readonly saveStateSlot: i32 = 1;

  // Function to save the state of the class,
  // NOTE: We will also be handling the LCD State here,
  // 0x00 - 0x24 Graphics, 0x25 - 0x50 LCD
  static saveState(): void {
    // Graphics
    store<i32>(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot), Graphics.scanlineCycles);
    eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, Graphics.scanlineRegister);

    // LCD
    store<u8>(getSaveStateMemoryOffset(0x25, Graphics.saveStateSlot), <u8>Lcd.mode);
  }

  // Function to load the save state from memory
  // NOTE: We will also be handling the LCD State here,
  // 0x00 - 0x24 Graphics, 0x25 - 0x50 LCD
  static loadState(): void {
    // Graphics
    Graphics.scanlineCycles = load<i32>(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot));
    Graphics.scanlineRegister = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);

    // LCD
    Lcd.mode = load<u8>(getSaveStateMemoryOffset(0x25, Graphics.saveStateSlot));
    Lcd.updateLcdControl(eightBitLoadFromGBMemory(Lcd.memoryLocationLcdControl));
  }
}

// Inlined because closure compiler inlines
export function initializeGraphics(): void {
  // Reset Stateful Variables
  Graphics.currentCycles = 0;
  Graphics.scanlineCycles = 0;
  Graphics.scanlineRegister = 0;
  Graphics.scrollX = 0;
  Graphics.scrollY = 0;
  Graphics.windowX = 0;
  Graphics.windowY = 0;

  Graphics.scanlineRegister = 0x90;

  if (Cpu.GBCEnabled) {
    eightBitStoreIntoGBMemory(0xff41, 0x81);
    // 0xFF42 -> 0xFF43 = 0x00
    eightBitStoreIntoGBMemory(0xff44, 0x90);
    // 0xFF45 -> 0xFF46 = 0x00
    eightBitStoreIntoGBMemory(0xff47, 0xfc);
    // 0xFF48 -> 0xFF4B = 0x00
  } else {
    eightBitStoreIntoGBMemory(0xff41, 0x85);
    // 0xFF42 -> 0xFF45 = 0x00
    eightBitStoreIntoGBMemory(0xff46, 0xff);
    eightBitStoreIntoGBMemory(0xff47, 0xfc);
    eightBitStoreIntoGBMemory(0xff48, 0xff);
    eightBitStoreIntoGBMemory(0xff49, 0xff);
    // 0xFF4A -> 0xFF4B = 0x00
    // GBC VRAM Banks (Handled by Memory, initializeCartridge)
  }

  // Scanline
  // Bgb says LY is 90 on boot
  Graphics.scanlineRegister = 0x90;
  eightBitStoreIntoGBMemory(0xff40, 0x90);

  // GBC VRAM Banks
  eightBitStoreIntoGBMemory(0xff4f, 0x00);
  eightBitStoreIntoGBMemory(0xff70, 0x01);

  // Override/reset some variables if the boot ROM is enabled
  if (Cpu.BootROMEnabled) {
    if (Cpu.GBCEnabled) {
      // GBC
      Graphics.scanlineRegister = 0x00;
      eightBitStoreIntoGBMemory(0xff40, 0x00);
      eightBitStoreIntoGBMemory(0xff41, 0x80);
      eightBitStoreIntoGBMemory(0xff44, 0x00);
    } else {
      // GB
      Graphics.scanlineRegister = 0x00;
      eightBitStoreIntoGBMemory(0xff40, 0x00);
      eightBitStoreIntoGBMemory(0xff41, 0x84);
    }
  }

  initializeColors();
  initializePalette();
}

// Batch Process Graphics
// http://gameboy.mongenel.com/dmg/asmmemmap.html and http://gbdev.gg8.se/wiki/articles/Video_Display
// Function to batch process our graphics after we skipped so many cycles
// This is not currently checked in memory read/write
// TODO: Actually batch process after the pixel fifo rewrite
export function batchProcessGraphics(): void {
  updateGraphics(Graphics.currentCycles);
  Graphics.currentCycles = 0;
}

// Our main update function
export function updateGraphics(numberOfCycles: i32): void {
  // Do nothing if our LCD is not enabled
  if (!Lcd.enabled) {
    return;
  }

  // Update our cycles
  Graphics.scanlineCycles += numberOfCycles;

  // See if we need to go from OAM Search mode to Pixel Transfer
  let cyclesPerOamSearch = 80 << (<i32>Cpu.GBCDoubleSpeed);
  if (Lcd.mode === 2 && Graphics.scanlineCycles > cyclesPerOamSearch) {
    // Do the actual OAM Search
    Sprites.oamSearchForVisibleSprites();

    // Switch to pixel transfer mode
    Lcd.setMode(3);
  }

  // Check if we are in pixel transfer mode
  // If so, do the pixel transfer!
  if (Lcd.mode === 3) {
    PixelPipeline.update(numberOfCycles);

    // Check if we hit the end of the scanline
    if (PixelPipeline.getCurrentIndex() >= 160) {
      // Go to Hblank
      Lcd.setMode(0);

      // No longer need to fetch pixels, reset everything
      PixelPipeline.reset();
    }
  }

  // Check if we need to increment the scanline
  // 80 << (<i32>Cpu.GBCDoubleSpeed) is the number of OAM Search cycles
  let cyclesPerScanline = 456 << (<i32>Cpu.GBCDoubleSpeed);
  if (Graphics.scanlineCycles >= cyclesPerScanline) {
    // Remove the cycles, start a new scanline
    Graphics.scanlineCycles -= cyclesPerScanline;
    Graphics.scanlineRegister++;

    // Check if we need to enter a new mode
    if (Graphics.scanlineRegister === 144) {
      // Enter VBlank mode
      Lcd.setMode(1);
    } else if (Graphics.scanlineRegister === 154) {
      // Wrap the scanline, go back to OAM Search
      Graphics.scanlineRegister = 0;
      Lcd.setMode(2);
    }

    // Lastly, check the LCD Coincidence since we changed scanlines
    Lcd.checkCoincidence();
  }
}
