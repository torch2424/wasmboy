// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
import {
  wasmBoyInternalStateLocation,
  wasmMemorySize,
  gameBoyInternalMemoryLocation,
  videoOutputLocation,
  frameInProgressVideoOutputLocation,
  gameboyColorPaletteLocation,
  soundOutputLocation,
  gameBytesLocation,
  gameRamBanksLocation,
  gameBoyVramLocation,
  gameBoyWramLocation,
  gameBoyMemoryRegistersLocation
} from '../constants/constants';
import { eightBitLoadFromGBMemory, loadBooleanDirectlyFromWasmMemory } from './load';
import { eightBitStoreIntoGBMemory, storeBooleanDirectlyToWasmMemory } from './store';
import { handleBanking } from './banking';
import { checkBitOnByte, resetBitOnByte, hexLog } from '../helpers/index';

export class Memory {
  // ----------------------------------
  // Gameboy Memory Map
  // ----------------------------------
  // https://github.com/AntonioND/giibiiadvance/blob/master/docs/TCAGBD.pdf
  // http://gameboy.mongenel.com/dmg/asmmemmap.html
  // using Arrays, first index is start, second is end
  static readonly cartridgeRomLocation: i32 = 0x0000;

  static readonly switchableCartridgeRomLocation: i32 = 0x4000;

  static readonly videoRamLocation: i32 = 0x8000;

  static readonly cartridgeRamLocation: i32 = 0xa000;

  static readonly internalRamBankZeroLocation: i32 = 0xc000;

  // This ram bank is switchable
  static readonly internalRamBankOneLocation: i32 = 0xd000;

  static readonly echoRamLocation: i32 = 0xe000;

  static readonly spriteInformationTableLocation: i32 = 0xfe00;

  static readonly spriteInformationTableLocationEnd: i32 = 0xfe9f;

  static readonly unusableMemoryLocation: i32 = 0xfea0;
  static readonly unusableMemoryEndLocation: i32 = 0xfeff;

  // Hardware I/O, 0xFF00 -> 0xFF7F
  // Zero Page, 0xFF80 -> 0xFFFE
  // Intterupt Enable Flag, 0xFFFF

  // ----------------------------------
  // Wasmboy Memory Map
  // ----------------------------------
  static readonly gameBoyInternalMemoryLocation: i32 = gameBoyInternalMemoryLocation;
  static readonly gameBoyVramLocation: i32 = gameBoyVramLocation;
  static readonly gameBoyWramLocation: i32 = gameBoyWramLocation;
  static readonly gameBoyMemoryRegistersLocation: i32 = gameBoyMemoryRegistersLocation;
  static readonly videoOutputLocation: i32 = videoOutputLocation;
  static readonly frameInProgressVideoOutputLocation: i32 = frameInProgressVideoOutputLocation;
  static readonly gameboyColorPaletteLocation: i32 = gameboyColorPaletteLocation;
  static readonly soundOutputLocation: i32 = soundOutputLocation;

  // Passed in Game backup or ROM from the user
  static readonly gameRamBanksLocation: i32 = gameRamBanksLocation;
  static readonly gameBytesLocation: i32 = gameBytesLocation;

  // ----------------------------------
  // Rom/Ram Banking
  // ----------------------------------
  // http://gbdev.gg8.se/wiki/articles/Memory_Bank_Controllers#MBC3_.28max_2MByte_ROM_and.2For_32KByte_RAM_and_Timer.29
  // http://www.codeslinger.co.uk/pages/projects/gameboy/banking.html
  static currentRomBank: i32 = 0x00;
  static currentRamBank: i32 = 0x00;
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
  static memoryLocationHdmaSourceHigh: i32 = 0xff51;
  static memoryLocationHdmaSourceLow: i32 = 0xff52;
  static memoryLocationHdmaDestinationHigh: i32 = 0xff53;
  static memoryLocationHdmaDestinationLow: i32 = 0xff54;
  static memoryLocationHdmaTrigger: i32 = 0xff55;
  // Cycles accumulated for DMA
  static DMACycles: i32 = 0;
  // Boolean we will mirror to indicate if Hdma is active
  static isHblankHdmaActive: boolean = false;
  static hblankHdmaTransferLengthRemaining: i32 = 0x00;
  // Store the source and destination for performance, and update as needed
  static hblankHdmaSource: i32 = 0x00;
  static hblankHdmaDestination: i32 = 0x00;

  // GBC Registers
  static memoryLocationGBCVRAMBank: i32 = 0xff4f;
  static memoryLocationGBCWRAMBank: i32 = 0xff70;

  // Save States

  static readonly saveStateSlot: i32 = 4;

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
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0a, Memory.saveStateSlot), Memory.isMBC5);
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
    Memory.isMBC5 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0a, Memory.saveStateSlot));
  }
}

export function initializeCartridge(): void {
  // Get our game MBC type from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let cartridgeType: i32 = eightBitLoadFromGBMemory(0x0147);

  // Reset our Cartridge types
  Memory.isRomOnly = false;
  Memory.isMBC1 = false;
  Memory.isMBC2 = false;
  Memory.isMBC3 = false;
  Memory.isMBC5 = false;

  if (cartridgeType === 0x00) {
    Memory.isRomOnly = true;
  } else if (cartridgeType >= 0x01 && cartridgeType <= 0x03) {
    Memory.isMBC1 = true;
  } else if (cartridgeType >= 0x05 && cartridgeType <= 0x06) {
    Memory.isMBC2 = true;
  } else if (cartridgeType >= 0x0f && cartridgeType <= 0x13) {
    Memory.isMBC3 = true;
  } else if (cartridgeType >= 0x19 && cartridgeType <= 0x1e) {
    Memory.isMBC5 = true;
  }

  Memory.currentRomBank = 0x01;
  Memory.currentRamBank = 0x00;
}

// Also need to store current frame in memory to be read by JS
export function setPixelOnFrame(x: i32, y: i32, colorId: i32, color: i32): void {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset
  store<u8>(Memory.frameInProgressVideoOutputLocation + getRgbPixelStart(x, y) + colorId, color);
}

// Function to get the start of a RGB pixel (R, G, B)
export function getRgbPixelStart(x: i32, y: i32): i32 {
  // Get the pixel number
  // let pixelNumber: i32 = (y * 160) + x;
  // Each pixel takes 3 slots, therefore, multiply by 3!
  return (y * 160 + x) * 3;
}

// Function to set our left and right channels at the correct queue index
export function setLeftAndRightOutputForAudioQueue(leftVolume: i32, rightVolume: i32, audioQueueIndex: i32): void {
  // Get our stereo index
  let audioQueueOffset = Memory.soundOutputLocation + audioQueueIndex * 2;

  // Store our volumes
  // +1 that way we don't have empty data to ensure that the value is set
  store<u8>(audioQueueOffset, <u8>(leftVolume + 1));
  store<u8>(audioQueueOffset + 1, <u8>(rightVolume + 1));
}

// Function to shortcut the memory map, and load directly from the VRAM Bank
export function loadFromVramBank(gameboyOffset: i32, vramBankId: i32): u8 {
  let wasmBoyAddress: i32 = gameboyOffset - Memory.videoRamLocation + Memory.gameBoyInternalMemoryLocation + 0x2000 * (vramBankId & 0x01);
  return load<u8>(wasmBoyAddress);
}

// Function to store a byte to our Gbc Palette memory
export function storePaletteByteInWasmMemory(paletteIndexByte: i32, value: i32, isSprite: boolean): void {
  // Clear the top two bits to just get the bottom palette Index
  let paletteIndex: i32 = paletteIndexByte & 0x3f;

  // Move over the palette index to not overlap the background (has 0x3F, so Zero for Sprites is 0x40)
  if (isSprite) {
    paletteIndex += 0x40;
  }

  store<u8>(Memory.gameboyColorPaletteLocation + paletteIndex, <u8>value);
}

// Function to load a byte from our Gbc Palette memory
// Function to store a byte to our Gbc Palette memory
export function loadPaletteByteFromWasmMemory(paletteIndexByte: i32, isSprite: boolean): u8 {
  // Clear the top two bits to just get the bottom palette Index
  let paletteIndex: i32 = paletteIndexByte & 0x3f;

  // Move over the palette index to not overlap the background has 0x3F, so Zero for Sprites is 0x40)
  if (isSprite) {
    paletteIndex += 0x40;
  }

  return load<u8>(Memory.gameboyColorPaletteLocation + paletteIndex);
}

// Function to return an address to store into save state memory
// this is to regulate our 20 slots
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
export function getSaveStateMemoryOffset(offset: i32, saveStateSlot: i32): i32 {
  // 50 byutes per save state memory partiton sli32
  return wasmBoyInternalStateLocation + offset + 50 * saveStateSlot;
}
