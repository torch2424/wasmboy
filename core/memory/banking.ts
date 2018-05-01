// Function to handle rom/rambanking
import { Memory } from './memory';
import { concatenateBytes, checkBitOnByte, splitLowByte, hexLog } from '../helpers/index';

export function handleBanking(offset: i32, value: i32): void {
  // Is rom Only does not bank
  if (Memory.isRomOnly) {
    return;
  }

  // Enable Ram Banking
  if (offset <= 0x1fff) {
    if (Memory.isMBC2 && !checkBitOnByte(4, <u8>value)) {
      // Do Nothing
      return;
    } else {
      let romEnableByte = value & 0x0f;
      if (romEnableByte === 0x00) {
        Memory.isRamBankingEnabled = false;
      } else if (romEnableByte === 0x0a) {
        Memory.isRamBankingEnabled = true;
      }
    }
  } else if (offset <= 0x3fff) {
    if (!Memory.isMBC5 || offset <= 0x2fff) {
      // Change Low Bits on the Current Rom Bank
      if (Memory.isMBC2) {
        Memory.currentRomBank = value & 0x0f;
      }

      // Set the number of bottom bytes from the MBC type
      let romBankLowerBits = value;
      if (Memory.isMBC1) {
        // Only want the bottom 5
        romBankLowerBits = romBankLowerBits & 0x1f;
        Memory.currentRomBank = Memory.currentRomBank & 0xe0;
      } else if (Memory.isMBC3) {
        // Only Want the bottom 7
        romBankLowerBits = romBankLowerBits & 0x7f;
        Memory.currentRomBank = Memory.currentRomBank & 0x80;
      } else if (Memory.isMBC5) {
        // Going to switch the whole thing
        Memory.currentRomBank = Memory.currentRomBank & 0x00;
      }

      // Set the lower bytes
      Memory.currentRomBank = Memory.currentRomBank | romBankLowerBits;
      return;
    } else {
      // TODO: MBC5 High bits Rom bank, check if this works, not sure about the value
      let highByte: i32 = 0;
      let lowByte: i32 = splitLowByte(Memory.currentRomBank);
      if (value > 0) {
        highByte = 1;
      }
      Memory.currentRomBank = concatenateBytes(highByte, lowByte);
    }
  } else if (!Memory.isMBC2 && offset <= 0x5fff) {
    // ROM / RAM Banking, MBC2 doesn't do this
    if (Memory.isMBC1 && Memory.isMBC1RomModeEnabled) {
      // Do an upper bit rom bank for MBC 1
      // Remove upper bits of currentRomBank
      Memory.currentRomBank = Memory.currentRomBank & 0x1f;

      let romBankHigherBits = value & 0xe0;

      Memory.currentRomBank = Memory.currentRomBank | romBankHigherBits;
      return;
    }

    if (Memory.isMBC3) {
      if (value >= 0x08 && value <= 0x0c) {
        // TODO: MBC3 RTC Register Select
      }
    }

    let ramBankBits: i32 = value;

    if (!Memory.isMBC5) {
      // Get the bottom 2 bits
      ramBankBits = ramBankBits & 0x03;
    } else {
      // Get the bottom nibble
      ramBankBits = ramBankBits & 0x0f;
    }

    // Set our ram bank
    Memory.currentRamBank = ramBankBits;
    return;
  } else if (!Memory.isMBC2 && offset <= 0x7fff) {
    if (Memory.isMBC1) {
      if (checkBitOnByte(0, <u8>value)) {
        Memory.isMBC1RomModeEnabled = true;
      } else {
        Memory.isMBC1RomModeEnabled = false;
      }
    }
    // TODO: MBC3 Latch Clock Data
  }
}

export function getRomBankAddress(gameboyOffset: i32): i32 {
  let currentRomBank: i32 = Memory.currentRomBank;
  if (!Memory.isMBC5 && currentRomBank === 0) {
    currentRomBank = 1;
  }

  // Adjust our gameboy offset relative to zero for the gameboy memory map
  return <i32>(0x4000 * currentRomBank + (gameboyOffset - Memory.switchableCartridgeRomLocation));
}

export function getRamBankAddress(gameboyOffset: i32): i32 {
  // Adjust our gameboy offset relative to zero for the gameboy memory map
  return <i32>(0x2000 * Memory.currentRamBank + (gameboyOffset - Memory.cartridgeRamLocation));
}
