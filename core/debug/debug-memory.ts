// Functions to debug internal gameboy memory
// Great for disassembelr
import { DEBUG_GAMEBOY_MEMORY_LOCATION, DEBUG_GAMEBOY_MEMORY_SIZE } from '../constants';
import { eightBitLoadFromGBMemoryWithTraps } from '../memory/index';

export function updateDebugGBMemory(): void {
  for (let i: i32 = 0; i <= DEBUG_GAMEBOY_MEMORY_SIZE; i++) {
    store<u8>(DEBUG_GAMEBOY_MEMORY_LOCATION + i, eightBitLoadFromGBMemoryWithTraps(i));
  }
}
