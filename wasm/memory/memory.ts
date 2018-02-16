// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing

import {
  consoleLog,
  consoleLogTwo,
  checkBitOnByte
} from '../helpers/index';
import {
  eightBitLoadFromGBMemory
} from './load';
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

  static unusableMemoryLocation: u16 = 0xFEA0;
  static unusableMemoryEndLocation: u16 = 0xFEFF;

  // Hardware I/O, 0xFF00 -> 0xFF7F
  // Zero Page, 0xFF80 -> 0xFFFE
  // Intterupt Enable Flag, 0xFFFF

  // ----------------------------------
  // Wasmboy Memory Map
  // ----------------------------------
  static gameBoyInternalMemoryLocation: u32 = 0x000000;
  static pixelMapOutputLocation: u32 = 0x008000;
  // Passed in Game backup or ROM from the user
  static gameBytesLocation: u32 = 0x018000;
  static gameRamBanksLocation: u32 = 0x818000;

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

  let offset: i32 = Memory.pixelMapOutputLocation + (largeY * 160) + largeX;

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

  let offset: i32 = Memory.pixelMapOutputLocation + (largeY * 160) + largeX;

  // Added one to the color, that way you don't ge the default zero
  return load<u8>(offset);
}
