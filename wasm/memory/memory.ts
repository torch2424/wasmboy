// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing

import {
  eightBitLoadFromGBMemorySkipTraps,
  loadBooleanDirectlyFromWasmMemory
} from './load';
import {
  eightBitStoreIntoGBMemorySkipTraps,
  storeBooleanDirectlyToWasmMemory
} from './store';
import {
  handleBanking
} from './banking';
import {
  checkBitOnByte,
  resetBitOnByte,
  hexLog
} from '../helpers/index';

export class Memory {

  // ----------------------------------
  // Gameboy Memory Map
  // ----------------------------------
  // https://github.com/AntonioND/giibiiadvance/blob/master/docs/TCAGBD.pdf
  // http://gameboy.mongenel.com/dmg/asmmemmap.html
  // using Arrays, first index is start, second is end
  static readonly cartridgeRomLocation: u16 = 0x0000;

  static readonly switchableCartridgeRomLocation: u16 = 0x4000;

  static readonly videoRamLocation: u16 = 0x8000;

  static readonly cartridgeRamLocation: u16 = 0xA000;

  static readonly internalRamBankZeroLocation: u16 = 0xC000;

  // This ram bank is switchable
  static readonly internalRamBankOneLocation: u16 = 0xD000;

  static readonly echoRamLocation: u16 = 0xE000;

  static readonly spriteInformationTableLocation: u16 = 0xFE00;

  static readonly spriteInformationTableLocationEnd: u16 = 0xFE9F;

  static readonly unusableMemoryLocation: u16 = 0xFEA0;
  static readonly unusableMemoryEndLocation: u16 = 0xFEFF;

  // Hardware I/O, 0xFF00 -> 0xFF7F
  // Zero Page, 0xFF80 -> 0xFFFE
  // Intterupt Enable Flag, 0xFFFF

  // ----------------------------------
  // Wasmboy Memory Map
  // ----------------------------------
  static readonly gameBoyInternalMemoryLocation: u32 = 0x000400;
  static readonly videoOutputLocation: u32 = 0x030400;
  static readonly currentFrameVideoOutputLocation: u32 = Memory.videoOutputLocation;
  static readonly frameInProgressVideoOutputLocation: u32 = Memory.currentFrameVideoOutputLocation + ((160 * 144) * 3);
  // Last KB of video memory
  static readonly gameboyColorPaletteLocation: u32 = 0x0B2000;
  static readonly soundOutputLocation: u32 = 0x0B2400;

  // Passed in Game backup or ROM from the user
  static readonly gameBytesLocation: u32 = 0x0D2400;
  static readonly gameRamBanksLocation: u32 = 0x010400;

  // ----------------------------------
  // Rom/Ram Banking
  // ----------------------------------
  // http://gbdev.gg8.se/wiki/articles/Memory_Bank_Controllers#MBC3_.28max_2MByte_ROM_and.2For_32KByte_RAM_and_Timer.29
  // http://www.codeslinger.co.uk/pages/projects/gameboy/banking.html
  static currentRomBank: u16 = 0x00;
  static currentRamBank: u16 = 0x00;
  static isRamBankingEnabled: boolean = false;
  static isMBC1RomModeEnabled: boolean = true;

  // Cartridge Types
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  static isRomOnly: boolean = true;
  static isMBC1: boolean = false;
  static isMBC2: boolean = false;
  static isMBC3: boolean = false;
  static isMBC5: boolean = false;

  // DMA
  static memoryLocationHdmaSourceHigh: u16 = 0xFF51;
  static memoryLocationHdmaSourceLow: u16 = 0xFF52;
  static memoryLocationHdmaDestinationHigh: u16 = 0xFF53;
  static memoryLocationHdmaDestinationLow: u16 = 0xFF54;
  static memoryLocationHdmaTrigger: u16 = 0xFF55;
  // Cycles accumulated for DMA
  static DMACycles: i32 = 0;
  // Boolean we will mirror to indicate if Hdma is active
  static isHblankHdmaActive: boolean = false;
  static hblankHdmaIndex: u8 = 0x00;
  static hblankHdmaTotalBytes: u8 = 0x00;
  // Store the source and destination for performance, and update as needed
  static hblankHdmaSource: u16 = 0x00;
  static hblankHdmaDestination: u16 = 0x00;

  // GBC Registers
  static memoryLocationGBCWRAMBank: u16 = 0xFF70;
  static memoryLocationGBCVRAMBAnk: u16 = 0xFF4F;

  // Save States

  static readonly saveStateSlot: u16 = 4;

  // Function to save the state of the class
  static saveState(): void {
    store<u16>(getSaveStateMemoryOffset(0x00, Memory.saveStateSlot), Memory.currentRomBank);
    store<u16>(getSaveStateMemoryOffset(0x02, Memory.saveStateSlot), Memory.currentRamBank);

    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x04, Memory.saveStateSlot), Memory.isRamBankingEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x05, Memory.saveStateSlot), Memory.isMBC1RomModeEnabled);

    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x06, Memory.saveStateSlot), Memory.isRomOnly);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x07, Memory.saveStateSlot), Memory.isMBC1);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x08, Memory.saveStateSlot), Memory.isMBC2);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x09, Memory.saveStateSlot), Memory.isMBC3);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0A, Memory.saveStateSlot), Memory.isMBC5);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Memory.currentRomBank = load<u16>(getSaveStateMemoryOffset(0x00, Memory.saveStateSlot));
    Memory.currentRamBank = load<u16>(getSaveStateMemoryOffset(0x02, Memory.saveStateSlot));

    Memory.isRamBankingEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x04, Memory.saveStateSlot));
    Memory.isMBC1RomModeEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x05, Memory.saveStateSlot));

    Memory.isRomOnly = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x06, Memory.saveStateSlot));
    Memory.isMBC1 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x07, Memory.saveStateSlot));
    Memory.isMBC2 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x08, Memory.saveStateSlot));
    Memory.isMBC3 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x09, Memory.saveStateSlot));
    Memory.isMBC5 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0A, Memory.saveStateSlot));
  }
}

export function initializeCartridge(): void {
  // Get our game MBC type from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let cartridgeType: u8 = eightBitLoadFromGBMemorySkipTraps(0x0147);

  // Reset our Cartridge types
  Memory.isRomOnly = false;
  Memory.isMBC1 = false;
  Memory.isMBC2 = false;
  Memory.isMBC3 = false;
  Memory.isMBC5 = false;

  if(cartridgeType === 0x00) {
    Memory.isRomOnly = true;
  } else if (cartridgeType >= 0x01 && cartridgeType <= 0x03) {
    Memory.isMBC1 = true;
  } else if (cartridgeType >= 0x05 && cartridgeType <= 0x06) {
    Memory.isMBC2 = true;
  } else if (cartridgeType >= 0x0F && cartridgeType <= 0x13) {
    Memory.isMBC3 = true;
  } else if (cartridgeType >= 0x19 && cartridgeType <= 0x1E) {
    Memory.isMBC5 = true;
  }
}

// Also need to store current frame in memory to be read by JS
export function setPixelOnFrame(x: i32, y: i32, colorId: i32, color: u8): void {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset

  let offset: i32 = Memory.frameInProgressVideoOutputLocation + getRgbPixelStart(x, y) + colorId;

  // Add one to the color, that way you don't ge the default zero
  store<u8>(offset, color + 1);
}

// Need to also get our pixel on the frame for sprite priority
export function getPixelOnFrame(x: i32, y: i32): u8 {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset

  let offset: i32 = Memory.frameInProgressVideoOutputLocation + getRgbPixelStart(x, y);

  // Added one to the color, that way you don't ge the default zero
  return load<u8>(offset);
}

// Function to get the start of a RGB pixel (R, G, B)
function getRgbPixelStart(x: i32, y: i32): i32 {
  // Get the pixel number
  let pixelNumber: i32 = (y * 160) + x;
  // Each pixel takes 3 slots, therefore, multiply by 3!
  return pixelNumber * 3;
}

// V-Blank occured, move our frame in progress to our render frame
export function storeFrameToBeRendered(): void {

  // Cache our constant for performance
  let currentFrameVideoOutputLocation: i32 = Memory.currentFrameVideoOutputLocation;
  let frameInProgressVideoOutputLocation: i32 = Memory.frameInProgressVideoOutputLocation;

  // Not using getPixelOnFrame() for performance

  for(let y: i32 = 0; y < 144; y++) {
    for (let x: i32 = 0; x < 160; x++) {
      // Store three times for each pixel
      let pixelStart: i32 = getRgbPixelStart(x, y);
      for (let colorId: i32 = 0; colorId < 3; colorId++) {
        store<u8>(
          currentFrameVideoOutputLocation + pixelStart + colorId,
          load<u8>(frameInProgressVideoOutputLocation + pixelStart + colorId)
        )
      }
    }
  }
}

// Function to set our left and right channels at the correct queue index
export function setLeftAndRightOutputForAudioQueue(leftVolume: u8, rightVolume: u8, audioQueueIndex: u32): void {
  // Get our stereo index
  let audioQueueOffset = Memory.soundOutputLocation + (audioQueueIndex * 2);

  // Store our volumes
  // +1 that way we don't have empty data to ensure that the value is set
  store<u8>(audioQueueOffset, leftVolume + 1);
  store<u8>(audioQueueOffset + 1, rightVolume + 1);
}

// Function to shortcut the memory map, and load directly from the VRAM Bank
export function loadFromVramBank(gameboyOffset: u16, vramBankId: i32): u8 {
  let wasmBoyAddress: u32 = <u32>(gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation + (0x2000 * <u32>(vramBankId & 0x01));
  return load<u8>(wasmBoyAddress);
}

// Function to store a byte to our Gbc Palette memory
export function storePaletteByteInWasmMemory(paletteIndexByte: u8, value: u8, isSprite: boolean): void {

  // Clear the top bit to just get the bottom palette Index
  let paletteIndex: u32 = resetBitOnByte(7, paletteIndexByte);

  // Move over the palette index to not overlap the background (has 0x3F, so Zero for Sprites is 0x40)
  if(isSprite) {
    paletteIndex += 0x40;
  }

  store<u8>(Memory.gameboyColorPaletteLocation + paletteIndex, value);
}

// Function to load a byte from our Gbc Palette memory
// Function to store a byte to our Gbc Palette memory
export function loadPaletteByteFromWasmMemory(paletteIndexByte: u8, isSprite: boolean): u8 {

  // Clear the top bit to just get the bottom palette Index
  let paletteIndex: u32 = resetBitOnByte(7, paletteIndexByte);

  // Move over the palette index to not overlap the background has 0x3F, so Zero for Sprites is 0x40)
  if(isSprite) {
    paletteIndex += 0x40;
  }

  return load<u8>(Memory.gameboyColorPaletteLocation + paletteIndex);
}


// Function to return an address to store into save state memory
// this is to regulate our 20 slots
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
export function getSaveStateMemoryOffset(offset: u16, saveStateSlot: u16): u16 {
  // 50 byutes per save state memory partiton slot
  let address: u16 = offset + (50 * saveStateSlot);
  return address;
}
