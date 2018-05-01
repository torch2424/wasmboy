// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
import {
  WASMBOY_MEMORY_LOCATION,
  ASSEMBLYSCRIPT_MEMORY_LOCATION,
  WASMBOY_STATE_LOCATION,
  GAMEBOY_INTERNAL_MEMORY_LOCATION,
  VIDEO_RAM_LOCATION,
  WORK_RAM_LOCATION,
  OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION,
  GRAPHICS_OUTPUT_LOCATION,
  GBC_PALETTE_LOCATION,
  BG_PRIORITY_MAP_LOCATION,
  FRAME_LOCATION,
  BACKGROUND_MAP_LOCATION,
  TILE_DATA_LOCATION,
  OAM_TILES_LOCATION,
  AUDIO_BUFFER_LOCATION,
  CARTRIDGE_RAM_LOCATION,
  CARTRIDGE_ROM_LOCATION
} from '../constants';
import { Memory } from './memory';
import { eightBitLoadFromGBMemory } from './load';
import { getRomBankAddress, getRamBankAddress } from './banking';
import { Cpu } from '../cpu/cpu';
import { hexLog } from '../helpers/index';

// Private function to translate a offset meant for the gameboy memory map
// To the wasmboy memory map
// Following: http://gameboy.mongenel.com/dmg/asmmemmap.html
// And https://github.com/Dooskington/GameLad/wiki/Part-11---Memory-Bank-Controllers
// Performance help from @dcodeIO, and awesome-gbdev
export function getWasmBoyOffsetFromGameBoyOffset(gameboyOffset: i32): i32 {
  // Get the top byte and switch
  let gameboyOffsetHighByte: i32 = gameboyOffset >> 12;
  switch (gameboyOffsetHighByte) {
    case 0x00:
    case 0x01:
    case 0x02:
    case 0x03:
      // Cartridge ROM - Bank 0 (fixed)
      // 0x0000 -> 0x0D2400
      return gameboyOffset + CARTRIDGE_ROM_LOCATION;
    case 0x04:
    case 0x05:
    case 0x06:
    case 0x07:
      // Cartridge ROM - Switchable Banks 1-xx
      // 0x4000 -> (0x0D2400 + 0x4000)
      return getRomBankAddress(gameboyOffset) + CARTRIDGE_ROM_LOCATION;
    case 0x08:
    case 0x09:
      // Video RAM
      // 0x8000 -> 0x000400
      let vramBankId: i32 = 0;
      if (Cpu.GBCEnabled) {
        // Find our current VRAM Bank
        vramBankId = eightBitLoadFromGBMemory(Memory.memoryLocationGBCVRAMBank) & 0x01;
        // Even though We added another 0x2000, the Cartridge ram is pulled out of our Internal Memory Space
        // Therefore, we do not need to adjust for this extra 0x2000
      }

      return gameboyOffset - Memory.videoRamLocation + VIDEO_RAM_LOCATION + 0x2000 * vramBankId;
    case 0x0a:
    case 0x0b:
      // Cartridge RAM - A.K.A External RAM
      // 0xA000 -> 0x008400
      return getRamBankAddress(gameboyOffset) + CARTRIDGE_RAM_LOCATION;
    case 0x0c:
      // Gameboy Ram Bank 0
      // 0xC000 -> 0x000400
      // Don't need to add head, since we move out 0x200 from the cartridge ram
      return gameboyOffset - Memory.internalRamBankZeroLocation + WORK_RAM_LOCATION;
    case 0x0d:
      // Gameboy Ram Banks, Switchable in GBC Mode
      // 0xD000 -> 0x000400
      // In CGB Mode 32 KBytes internal RAM are available.
      // This memory is divided into 8 banks of 4 KBytes each.
      // Bank 0 is always available in memory at C000-CFFF,
      // Bank 1-7 can be selected into the address space at D000-DFFF.
      // http://gbdev.gg8.se/wiki/articles/CGB_Registers#FF70_-_SVBK_-_CGB_Mode_Only_-_WRAM_Bank
      // Get the last 3 bits to find our wram ID
      let wramBankId: i32 = 0;
      if (Cpu.GBCEnabled) {
        wramBankId = eightBitLoadFromGBMemory(Memory.memoryLocationGBCWRAMBank) & 0x07;
      }
      if (wramBankId < 1) {
        wramBankId = 1;
      }
      // (0x1000 * (wramBankId - 1)) -> To find the correct wram bank.
      // wramBankId - 1, because we alreayd have the space for wramBank 1, and are currently in it
      // So need to address space for 6 OTHER banks
      return gameboyOffset - Memory.internalRamBankZeroLocation + WORK_RAM_LOCATION + 0x1000 * (wramBankId - 1);
    default:
      // Everything Else after Gameboy Ram Banks
      // 0xE000 -> 0x000400
      // 0x6000 For the Extra WRAM Banks
      return gameboyOffset - Memory.echoRamLocation + OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION;
  }
}
