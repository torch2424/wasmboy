// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing

import {
  checkBitOnByte,
  hexLog
} from '../helpers/index';
import {
  eightBitLoadFromGBMemory,
  loadBooleanDirectlyFromWasmMemory
} from './load';
import {
  storeBooleanDirectlyToWasmMemory
} from './store';
import {
  handleBanking
} from './banking';

export class Memory {

  // ----------------------------------
  // Gameboy Memory Map
  // ----------------------------------
  // https://github.com/AntonioND/giibiiadvance/blob/master/docs/TCAGBD.pdf
  // http://gameboy.mongenel.com/dmg/asmmemmap.html
  // using Arrays, first index is start, second is end
  static cartridgeRomLocation: u16 = 0x0000;

  static switchableCartridgeRomLocation: u16 = 0x4000;

  static videoRamLocation: u16 = 0x8000;

  static cartridgeRamLocation: u16 = 0xA000;

  static internalRamBankZeroLocation: u16 = 0xC000;

  // This ram bank is switchable
  static internalRamBankOneLocation: u16 = 0xD000;

  static echoRamLocation: u16 = 0xE000;

  static spriteInformationTableLocation: u16 = 0xFE00;

  static spriteInformationTableLocationEnd: u16 = 0xFE9F;

  static unusableMemoryLocation: u16 = 0xFEA0;
  static unusableMemoryEndLocation: u16 = 0xFEFF;

  // Hardware I/O, 0xFF00 -> 0xFF7F
  // Zero Page, 0xFF80 -> 0xFFFE
  // Intterupt Enable Flag, 0xFFFF

  // ----------------------------------
  // Wasmboy Memory Map
  // ----------------------------------
  static gameBoyInternalMemoryLocation: u32 = 0x000400;
  static videoOutputLocation: u32 = 0x028400;
  static currentFrameVideoOutputLocation: u32 = Memory.videoOutputLocation;
  static frameInProgressVideoOutputLocation: u32 = Memory.currentFrameVideoOutputLocation + (160 * 144);
  static soundOutputLocation: u32 = 0x053800;

  // Passed in Game backup or ROM from the user
  static gameBytesLocation: u32 = 0x073800;
  static gameRamBanksLocation: u32 = 0x008400;

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

  // Save States

  static saveStateSlot: u16 = 4;

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
  let cartridgeType: u8 = eightBitLoadFromGBMemory(0x0147);

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
export function setPixelOnFrame(x: u16, y: u16, color: u8): void {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset

  // Store our x and y to allow them to get really large
  let largeY: i32 = y;
  let largeX: i32 = x;

  let offset: i32 = Memory.frameInProgressVideoOutputLocation + (largeY * 160) + largeX;

  // Add one to the color, that way you don't ge the default zero
  store<u8>(offset, color + 1);
}

// Need to also get our pixel on the frame for sprite priority
export function getPixelOnFrame(x: u16, y: u16): u8 {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset

  // Store our x and y to allow them to get really large
  let largeY: i32 = y;
  let largeX: i32 = x;

  let offset: i32 = Memory.frameInProgressVideoOutputLocation + (largeY * 160) + largeX;

  // Added one to the color, that way you don't ge the default zero
  return load<u8>(offset);
}

// V-Blank occured, move our frame in progress to our render frame
export function storeFrameToBeRendered(): void {
  for(let y: u32 = 0; y < 144; y++) {
    for (let x: u32 = 0; x < 160; x++) {
      store<u8>(Memory.currentFrameVideoOutputLocation + x + (y * 160), getPixelOnFrame(<u16>x, <u16>y))
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

// Function to return an address to store into save state memory
// this is to regulate our 20 slots
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
export function getSaveStateMemoryOffset(offset: u16, saveStateSlot: u16): u16 {
  // 50 byutes per save state memory partiton slot
  let address: u16 = offset + (50 * saveStateSlot);
  return address;
}
