// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing

import { Memory } from './memory';
import {
  getRomBankAddress,
  getRamBankAddress
} from './banking';
import {
  hexLog
} from '../helpers/index';

// Private function to translate a offset meant for the gameboy memory map
// To the wasmboy memory map
// Following: http://gameboy.mongenel.com/dmg/asmmemmap.html
// And https://github.com/Dooskington/GameLad/wiki/Part-11---Memory-Bank-Controllers
// Performance help from @dcodeIO, and awesome-gbdev
export function getWasmBoyOffsetFromGameBoyOffset(gameboyOffset: i32): i32 {

  // Get the top byte and switch
  switch(gameboyOffset >> 12) {
    case 0x00:
    case 0x01:
    case 0x02:
    case 0x03:
      // Cartridge ROM - Bank 0 (fixed)
      // 0x0000 -> 0x073800
      return gameboyOffset + Memory.gameBytesLocation;
    case 0x04:
    case 0x05:
    case 0x06:
    case 0x07:
      // Cartridge ROM - Switchable Banks 1-xx
      // 0x4000 -> (0x073800 + 0x4000)
      return getRomBankAddress(gameboyOffset) + Memory.gameBytesLocation;
    case 0x08:
    case 0x09:
      // Video RAM
      // 0x8000 -> 0x000400
      return (gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation;
    case 0x0A:
    case 0x0B:
      // Cartridge RAM - A.K.A External RAM
      // 0xA000 -> 0x008400
      return getRamBankAddress(gameboyOffset) + Memory.gameRamBanksLocation;
    default:
      // NOTE / TODO: Switchable Internal Ram Banks?
      // 0xC000 -> 0x000400
      return (gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation;
  }

  // // Find the wasmboy offset
  // if (gameboyOffset < Memory.switchableCartridgeRomLocation) {
  //   // Cartridge ROM - Bank 0 (fixed)
  //   // 0x0000 -> 0x073800
  //   return gameboyOffset + Memory.gameBytesLocation;
  // }
  // if (gameboyOffset < Memory.videoRamLocation) {
  //   // Cartridge ROM - Switchable Banks 1-xx
  //   // 0x4000 -> (0x073800 + 0x4000)
  //   return getRomBankAddress(gameboyOffset) + Memory.gameBytesLocation;
  // }
  // if (gameboyOffset < Memory.cartridgeRamLocation) {
  //   // Video RAM
  //   // 0x8000 -> 0x000400
  //   return (gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation;
  // }
  // if (gameboyOffset < Memory.internalRamBankZeroLocation) {
  //   // Cartridge RAM - A.K.A External RAM
  //   // 0xA000 -> 0x008400
  //   return getRamBankAddress(gameboyOffset) + Memory.gameRamBanksLocation;
  // }
  // // NOTE / TODO: Switchable Internal Ram Banks?
  // // 0xC000 -> 0x000400
  // return (gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation;
}
