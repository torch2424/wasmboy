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
export function getWasmBoyOffsetFromGameBoyOffset(gameboyOffset: u16): i32 {

  // Find the wasmboy offset
  if(gameboyOffset < Memory.switchableCartridgeRomLocation) {
    // Cartridge ROM - Bank 0 (fixed)
    // 0x0000 -> 0x073800
    return <i32>gameboyOffset + Memory.gameBytesLocation;
  } else if(gameboyOffset < Memory.videoRamLocation) {
    // Cartridge ROM - Switchable Banks 1-xx
    // 0x4000 -> (0x073800 + 0x4000)
    return getRomBankAddress(gameboyOffset) + Memory.gameBytesLocation;
  } else if (gameboyOffset < Memory.cartridgeRamLocation) {
    // Video RAM
    // 0x8000 -> 0x000400
    return (<i32>gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation;
  } else if (gameboyOffset < Memory.internalRamBankZeroLocation) {
    // Cartridge RAM - A.K.A External RAM
    // 0xA000 -> 0x008400
    return getRamBankAddress(gameboyOffset) + Memory.gameRamBanksLocation;
  } else {
    // NOTE / TODO: Switchable Internal Ram Banks?
    // 0xC000 -> 0x000400
    return (<i32>gameboyOffset - Memory.videoRamLocation) + Memory.gameBoyInternalMemoryLocation;
  }
}
