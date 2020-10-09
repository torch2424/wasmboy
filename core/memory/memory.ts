// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
import { getSaveStateMemoryOffset } from '../core';
import { eightBitLoadFromGBMemory, loadBooleanDirectlyFromWasmMemory } from './load';
import { eightBitStoreIntoGBMemory, storeBooleanDirectlyToWasmMemory } from './store';

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

    store<i32>(getSaveStateMemoryOffset(0x0b, Memory.saveStateSlot), Memory.DMACycles);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0f, Memory.saveStateSlot), Memory.isHblankHdmaActive);
    store<i32>(getSaveStateMemoryOffset(0x10, Memory.saveStateSlot), Memory.hblankHdmaTransferLengthRemaining);
    store<i32>(getSaveStateMemoryOffset(0x14, Memory.saveStateSlot), Memory.hblankHdmaSource);
    store<i32>(getSaveStateMemoryOffset(0x18, Memory.saveStateSlot), Memory.hblankHdmaDestination);
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

    Memory.DMACycles = load<i32>(getSaveStateMemoryOffset(0x0b, Memory.saveStateSlot));
    Memory.isHblankHdmaActive = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0f, Memory.saveStateSlot));
    Memory.hblankHdmaTransferLengthRemaining = load<i32>(getSaveStateMemoryOffset(0x10, Memory.saveStateSlot));
    Memory.hblankHdmaSource = load<i32>(getSaveStateMemoryOffset(0x14, Memory.saveStateSlot));
    Memory.hblankHdmaDestination = load<i32>(getSaveStateMemoryOffset(0x18, Memory.saveStateSlot));
  }
}

// Inlined because closure compiler inlines
export function initializeCartridge(): void {
  // Reset stateful variables
  Memory.isRamBankingEnabled = false;
  Memory.isMBC1RomModeEnabled = true;

  // Get our game MBC type from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let cartridgeType = eightBitLoadFromGBMemory(0x0147);

  // Reset our Cartridge types
  Memory.isRomOnly = cartridgeType === 0x00;
  Memory.isMBC1 = cartridgeType >= 0x01 && cartridgeType <= 0x03;
  Memory.isMBC2 = cartridgeType >= 0x05 && cartridgeType <= 0x06;
  Memory.isMBC3 = cartridgeType >= 0x0f && cartridgeType <= 0x13;
  Memory.isMBC5 = cartridgeType >= 0x19 && cartridgeType <= 0x1e;

  Memory.currentRomBank = 0x01;
  Memory.currentRamBank = 0x00;

  // Set our GBC Banks
  eightBitStoreIntoGBMemory(Memory.memoryLocationGBCVRAMBank, 0x00);
  eightBitStoreIntoGBMemory(Memory.memoryLocationGBCWRAMBank, 0x01);
}
