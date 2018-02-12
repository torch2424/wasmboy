// TODO: Finish Memory!
// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing

import { consoleLog, consoleLogTwo } from '../helpers/index';

class Memory {

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
  static currentRomBank: u8 = 1;
  static currentRamBank: u8 = 0;
  static isMBC1: boolean = false;
  static isMBC2: boolean = false;
  static isMBC3: boolean = false;
  static isMBC4: boolean = false;
  static isMBC5: boolean = false;
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
  store<u8>(offset, color);
}

export function eightBitLoadFromGBMemory(offset: u16): u8 {
  if (_checkReadTraps(offset)) {
    return _eightBitLoadFromWasmBoyMemory(offset);
  } else {
    // TODO: Find what read trap should return
    return 0x00;
  }
}

export function sixteenBitLoadFromGBMemory(offset: u16): u16 {
  if (_checkReadTraps(offset)) {
    return _sixteenBitLoadFromWasmBoyMemory(offset);
  } else {
    // TODO: Find what read trap should return
    return 0x00;
  }
}

// Wrapper funcstions around load/store for assemblyscript offset to gb mem offset
// NOTE: Confirmed that memory is working with both Eight and sixteenbit store :), tested in CPU initialize
export function eightBitStoreIntoGBMemory(offset: u16, value: u8): void {
  if(_checkWriteTraps(offset, <u16>value, true)) {
    _eightBitStoreIntoWasmBoyMemory(offset, value);
  }
}

export function sixteenBitStoreIntoGBMemory(offset: u16, value: u16): void {
  if(_checkWriteTraps(offset, value, false)) {
    _sixteenBitStoreIntoWasmBoyMemory(offset, value);
  }
}

export function eightBitStoreIntoGBMemorySkipTraps(offset: u16, value: u8): void {
  _eightBitStoreIntoWasmBoyMemory(offset, value);
}

export function sixteenBitStoreIntoGBMemorySkipTraps(offset: u16, value: u16): void {
  _sixteenBitStoreIntoWasmBoyMemory(offset, value);
}

function _eightBitLoadFromWasmBoyMemory(gameboyOffset: u16): u8 {
  let wasmboyOffset: u32 = _getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  return load<u8>(wasmboyOffset);
}

function _sixteenBitLoadFromWasmBoyMemory(gameboyOffset: u16): u16 {
  let wasmboyOffset: u32 = _getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  return load<u16>(wasmboyOffset);
}

function _eightBitStoreIntoWasmBoyMemory(gameboyOffset: u16, value: u8): void {
  let wasmboyOffset: u32 = _getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  store<u8>(wasmboyOffset, value);
}

function _sixteenBitStoreIntoWasmBoyMemory(gameboyOffset: u16, value: u16): void {
  let wasmboyOffset: u32 = _getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  store<u16>(wasmboyOffset, value);
}

// Internal function to trap any modify data trying to be written to Gameboy memory
// Follows the Gameboy memory map
function _checkWriteTraps(offset: u16, value: u16, isEightBitStore: boolean): boolean {

  // Do not allow writing into cartridge area.
  if(offset < Memory.videoRamLocation) {
    return false;
  }

  // Be sure to copy everything in EchoRam to Work Ram
  if(offset >= Memory.echoRamLocation && offset < Memory.spriteInformationTableLocation) {
    // TODO: Also write to Work Ram
    if(isEightBitStore) {
      eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    } else {
      sixteenBitStoreIntoGBMemorySkipTraps(offset, value);
    }
  }

  if(offset >= Memory.unusableMemoryLocation && offset <= Memory.unusableMemoryEndLocation) {
    return false;
  }

  // Trap our divider register from our timers
  if(offset === 0xFF04) {
    eightBitStoreIntoGBMemorySkipTraps(offset, 0);
    return false;
  }

  // Do the direct memory access transfer for spriteInformationTable
  if (offset === 0xFF46) {
    _dmaTransfer(<u8>value) ;
  }


  return true;
}

function _dmaTransfer(sourceAddressOffset: u8): void {

  let sourceAddress: u16 = (<u16>sourceAddressOffset << 8);

  for(let i: u16 = 0; i < 0xA0; i++) {
    eightBitStoreIntoGBMemorySkipTraps(Memory.spriteInformationTableLocation, eightBitLoadFromGBMemory(sourceAddress + i));
  }
}

function _checkReadTraps(offset: u16): boolean {
  // TODO: Remove this joypad hack
  if(offset === 0xFF00) {
    eightBitStoreIntoGBMemorySkipTraps(0xFF00, 0xFF);
  }
  return true;
}

// Private function to translate a offset meant for the gameboy memory map
// To the wasmboy memory map
// Following: http://gameboy.mongenel.com/dmg/asmmemmap.html
// And https://github.com/Dooskington/GameLad/wiki/Part-11---Memory-Bank-Controllers
function _getWasmBoyOffsetFromGameBoyOffset(gameboyOffset: u32): u32 {

  // Wasmboy offset
  let wasmboyOffset: u32 = 0x000000;

  // Find the wasmboy offser
  if(gameboyOffset < Memory.switchableCartridgeRomLocation) {
    // Cartridge ROM - Bank 0 (fixed)
    // 0x0000 -> 0x018000
    wasmboyOffset = gameboyOffset + Memory.gameBytesLocation;
  } else if(gameboyOffset >= Memory.switchableCartridgeRomLocation && gameboyOffset < Memory.videoRamLocation) {
    // Cartridge ROM - Switchable Banks 1-xx
    // 0x4000 -> (0x018000 + 0x4000)
    // TODO: Rom banking
    wasmboyOffset = gameboyOffset + Memory.gameBytesLocation;
  } else if (gameboyOffset >= Memory.videoRamLocation && gameboyOffset < Memory.cartridgeRamLocation) {
    // Video RAM
    // 0x8000 -> 0x0000
    wasmboyOffset = gameboyOffset - Memory.videoRamLocation;
  } else if (gameboyOffset >= Memory.cartridgeRamLocation && gameboyOffset < Memory.internalRamBankZeroLocation) {
    // Cartridge RAM - A.K.A External RAM
    // 0xA000 -> 0x818000
    // TODO: Ram Banking
    wasmboyOffset = (gameboyOffset - Memory.cartridgeRamLocation) + Memory.gameRamBanksLocation;
  } else if(gameboyOffset >= Memory.internalRamBankZeroLocation) {
    // NOTE / TODO: Switchable Internal Ram Banks?
    // 0xC000 -> 0x0000
    wasmboyOffset = gameboyOffset - Memory.videoRamLocation;
  }

  return wasmboyOffset;
}
