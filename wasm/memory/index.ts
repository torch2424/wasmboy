// TODO: Finish Memory!
// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing

import { consoleLog, consoleLogTwo } from '../helpers/index';

class Memory {

  // https://github.com/AntonioND/giibiiadvance/blob/master/docs/TCAGBD.pdf
  // http://gameboy.mongenel.com/dmg/asmmemmap.html
  // using Arrays, first index is start, second is end
  static cartridgeRomLocationStart: u16 = 0x0000;

  static switchableCartridgeRomLocationStart: u16 = 0x4000;

  static videoRamStart: u16 = 0x8000;

  static cartridgeRamLocationStart: u16 = 0xA000;

  static internalRamBankZeroLocationStart: u16 = 0xC000;

  // This ram bank is switchable
  static internalRamBankOneStart: u16 = 0xD000;

  static echoRamStart: u16 = 0xE000;

  static spriteInformationTableStart: u16 = 0xFE00;

  static unusableMemoryStart: u16 = 0xFEA0;
  static unusableMemoryEnd: u16 = 0xFEFF;

  // Hardware I/O, 0xFF00 -> 0xFF7F
  // Zero Page, 0xFF80 -> 0xFFFE
  // Intterupt Enable Flag, 0xFFFF

  // Rom/Ram banking
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


// also need to store current frame in memory to be read by JS
const memoryFrameDataStart = 0x10000;
export function setPixelOnFrame(x: u16, y: u16, color: u8): void {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset

  // Store our x and y to allow them to get really large
  let largeY: i32 = y;
  let largeX: i32 = x;

  let offset: i32 = memoryFrameDataStart + (largeY * 160) + largeX;
  store<u8>(offset, color);
}


// Wrapper funcstions around load/store for assemblyscript offset to gb mem offset
// NOTE: Confirmed that memory is working with both Eight and sixteenbit store :), tested in CPU initialize
export function eightBitStoreIntoGBMemory(offset: u16, value: u8): void {
  if(_checkWriteTraps(offset, <u16>value, true)) {
    store<u8>(offset, value);
  }
}

export function sixteenBitStoreIntoGBMemory(offset: u16, value: u16): void {
  if(_checkWriteTraps(offset, value, false)) {
    store<u16>(offset, value);
  }
}

export function eightBitStoreIntoGBMemorySkipTraps(offset: u16, value: u8): void {
  store<u8>(offset, value);
}

export function sixteenBitStoreIntoGBMemorySkipTraps(offset: u16, value: u16): void {
  store<u16>(offset, value);
}

export function eightBitLoadFromGBMemory(offset: u16): u8 {
  if (_checkReadTraps(offset)) {
    return load<u8>(offset);
  } else {
    // TODO: Find what read trap should return
    return 0x00;
  }
}

export function sixteenBitLoadFromGBMemory(offset: u16): u16 {
  if (_checkReadTraps(offset)) {
    return load<u16>(offset);
  } else {
    // TODO: Find what read trap should return
    return 0x00;
  }
}

// Internal function to trap any modify data trying to be written
function _checkWriteTraps(offset: u16, value: u16, isEightBitStore: boolean): boolean {

  // Do not allow writing into cartridge area.
  if(offset < Memory.videoRamStart) {
    return false;
  }

  // Be sure to copy everything in EchoRam to Work Ram
  if(offset >= Memory.echoRamStart && offset < Memory.spriteInformationTableStart) {
    // TODO: Also write to Work Ram
    if(isEightBitStore) {
      eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    } else {
      sixteenBitStoreIntoGBMemorySkipTraps(offset, value);
    }
  }

  if(offset >= Memory.unusableMemoryStart && offset <= Memory.unusableMemoryEnd) {
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
    eightBitStoreIntoGBMemorySkipTraps(Memory.spriteInformationTableStart, eightBitLoadFromGBMemory(sourceAddress + i));
  }
}

function _checkReadTraps(offset: u16): boolean {
  // TODO: Remove this joypad hack
  if(offset === 0xFF00) {
    eightBitStoreIntoGBMemorySkipTraps(0xFF00, 0xFF);
  }
  return true;
}
