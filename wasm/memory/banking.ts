// Function to handle rom/rambanking
import {
Memory
} from './memory';
import {
  concatenateBytes,
  checkBitOnByte,
  splitLowByte,
  hexLog
} from '../helpers/index';

export function handleBanking(offset: u16, value: u16): void {
      // Is rom Only does not bank
      if(Memory.isRomOnly) {
        return;
      }

      // Enable Ram Banking
      if(offset <= 0x1FFF) {

        if(Memory.isMBC2 && !checkBitOnByte(4, <u8>value)) {
          // Do Nothing
          return;
        } else {
          let romEnableByte = value & 0x0F;
          if(romEnableByte === 0x00) {
            Memory.isRamBankingEnabled = false;
          } else if (romEnableByte === 0x0A) {
            Memory.isRamBankingEnabled = true;
          }
        }
      } else if(offset <= 0x3FFF) {
        if(!Memory.isMBC5 || offset <= 0x2FFF) {
          // Change Low Bits on the Current Rom Bank
          if (Memory.isMBC2) {

            Memory.currentRomBank = value & 0x0F;
          }

          // Set the number of bottom bytes from the MBC type
          let romBankLowerBits = value;
          if (Memory.isMBC1) {
            // Only want the bottom 5
            romBankLowerBits = romBankLowerBits & 0x1F;
            Memory.currentRomBank = Memory.currentRomBank & 0xE0;
          } else if (Memory.isMBC3) {
            // Only Want the bottom 7
            romBankLowerBits = romBankLowerBits & 0x7F;
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
          let highByte: u8 = 0;
          let lowByte: u8 = splitLowByte(Memory.currentRomBank);
          if(value > 0) {
            highByte = 1;
          }
          Memory.currentRomBank = concatenateBytes(highByte, lowByte);
        }
      } else if(!Memory.isMBC2 &&
      offset <= 0x5FFF) {
        // ROM / RAM Banking, MBC2 doesn't do this
        if (Memory.isMBC1 && Memory.isMBC1RomModeEnabled) {
          // Do an upper bit rom bank for MBC 1
          // Remove upper bits of currentRomBank
          Memory.currentRomBank = Memory.currentRomBank & 0x1F;

          let romBankHigherBits = value & 0xE0;

          Memory.currentRomBank = Memory.currentRomBank | romBankHigherBits;
          return;
        }

        if (Memory.isMBC3) {
          if(value >= 0x08 && value <= 0x0C) {
            // TODO: MBC3 RTC Register Select
          }
        }

        let ramBankBits = value;

        if(!Memory.isMBC5) {
          // Get the bottom 2 bits
          ramBankBits = ramBankBits & 0x03;
        } else {
          // Get the bottom nibble
          ramBankBits = ramBankBits & 0x0F;
        }

        // Set our ram bank
        Memory.currentRamBank = ramBankBits;
        return;
      } else if(!Memory.isMBC2 &&
      offset <= 0x7FFF) {
        if(Memory.isMBC1) {
          if(checkBitOnByte(0, <u8>value)) {
            Memory.isMBC1RomModeEnabled = true;
          } else {
            Memory.isMBC1RomModeEnabled = false;
          }
        }
        // TODO: MBC3 Latch Clock Data
      }
}

export function getRomBankAddress(gameboyOffset: i32): i32 {
  let currentRomBank: u16 = Memory.currentRomBank;
  if(!Memory.isMBC5 && currentRomBank === 0) {
    currentRomBank = 1;
  }

  // Adjust our gameboy offset relative to zero for the gameboy memory map
  return <i32>((0x4000 * currentRomBank) + (gameboyOffset - Memory.switchableCartridgeRomLocation));
}

export function getRamBankAddress(gameboyOffset: i32): i32 {
  // Adjust our gameboy offset relative to zero for the gameboy memory map
  return <i32>((0x2000 * Memory.currentRamBank) + (gameboyOffset - Memory.cartridgeRamLocation));
}
