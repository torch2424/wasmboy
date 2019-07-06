// Main Class and funcitons for rendering the gameboy display
import { FRAME_LOCATION, GAMEBOY_INTERNAL_MEMORY_LOCATION } from '../constants';
import { getSaveStateMemoryOffset } from '../core';
import { Lcd, setLcdStatus } from './lcd';
import { renderBackground, renderWindow } from './backgroundWindow';
import { renderSprites } from './sprites';
import { clearPriorityMap } from './priority';
import { resetTileCache } from './tiles';
import { initializeColors } from './colors';
import { Cpu } from '../cpu/index';
import { Config } from '../config';
import { Memory, eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory } from '../memory/index';

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

  // Palettes
  static readonly memoryLocationBackgroundPalette: i32 = 0xff47;
  static readonly memoryLocationSpritePaletteOne: i32 = 0xff48;
  static readonly memoryLocationSpritePaletteTwo: i32 = 0xff49;

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
}

// Batch Process Graphics
// http://gameboy.mongenel.com/dmg/asmmemmap.html and http://gbdev.gg8.se/wiki/articles/Video_Display
// Function to batch process our graphics after we skipped so many cycles
// This is not currently checked in memory read/write
// TODO: Actually batch process after the pixel fifo rewrite
export function batchProcessGraphics(): void {
  updateGraphics(Graphics.currentCycles);
  Graphics.currentCycles -= batchProcessCycles;
}

// Our main update function
export function updateGraphics(numberOfCycles: i32): void {
  // Do nothing if our LCD is not enabled
  if (!Lcd.enabled) {
    return;
  }

  // Update our cycles
  Graphics.scanlineCycles += numberOfCycles;

  // Update our LCD
  updateLcd();
}

// Function to get the start of a RGB pixel (R, G, B)
// Inlined because closure compiler inlines
export function getRgbPixelStart(x: i32, y: i32): i32 {
  // Get the pixel number
  // let pixelNumber: i32 = (y * 160) + x;
  // Each pixel takes 3 slots, therefore, multiply by 3!
  return (y * 160 + x) * 3;
}

// Also need to store current frame in memory to be read by JS
export function setPixelOnFrame(x: i32, y: i32, colorId: i32, color: i32): void {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset
  store<u8>(FRAME_LOCATION + getRgbPixelStart(x, y) + colorId, color);
}

// Function to shortcut the memory map, and load directly from the VRAM Bank
export function loadFromVramBank(gameboyOffset: i32, vramBankId: i32): u8 {
  let wasmBoyAddress = gameboyOffset - Memory.videoRamLocation + GAMEBOY_INTERNAL_MEMORY_LOCATION + 0x2000 * (vramBankId & 0x01);
  return load<u8>(wasmBoyAddress);
}
