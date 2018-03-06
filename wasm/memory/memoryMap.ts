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
export function getWasmBoyOffsetFromGameBoyOffset(gameboyOffset: u32): u32 {

  // Wasmboy offset
  let wasmboyOffset: u32 = Memory.gameBoyInternalMemoryLocation;

  // Find the wasmboy offser
  if(gameboyOffset < Memory.switchableCartridgeRomLocation) {
    // Cartridge ROM - Bank 0 (fixed)
    // 0x0000 -> 0x073800
    wasmboyOffset = gameboyOffset + Memory.gameBytesLocation;
  } else if(gameboyOffset >= Memory.switchableCartridgeRomLocation && gameboyOffset < Memory.videoRamLocation) {
    // Cartridge ROM - Switchable Banks 1-xx
    // 0x4000 -> (0x073800 + 0x4000)
    wasmboyOffset = getRomBankAddress(gameboyOffset) + Memory.gameBytesLocation;
  } else if (gameboyOffset >= Memory.videoRamLocation && gameboyOffset < Memory.cartridgeRamLocation) {
    // Video RAM
    // 0x8000 -> 0x000400
    wasmboyOffset = (gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation;
  } else if (gameboyOffset >= Memory.cartridgeRamLocation && gameboyOffset < Memory.internalRamBankZeroLocation) {
    // Cartridge RAM - A.K.A External RAM
    // 0xA000 -> 0x008400
    wasmboyOffset = getRamBankAddress(gameboyOffset) + Memory.gameRamBanksLocation;
  } else if(gameboyOffset >= Memory.internalRamBankZeroLocation) {
    // NOTE / TODO: Switchable Internal Ram Banks?
    // 0xC000 -> 0x000400
    wasmboyOffset = (gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation;
  }

  return wasmboyOffset;
}
