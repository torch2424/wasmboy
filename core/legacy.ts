// These are legacy aliases for the original WasmBoy api

/******************

  Functions

*******************/

export { executeFrame as update, executeStep as emulationStep } from './execute';

export { getNumberOfSamplesInAudioBuffer as getAudioQueueIndex, clearAudioBuffer as resetAudioQueue } from './sound/sound';

/******************

  Memory Constants

*******************/
import {
  WASMBOY_MEMORY_LOCATION,
  WASMBOY_MEMORY_SIZE,
  WASMBOY_WASM_PAGES,
  ASSEMBLYSCRIPT_MEMORY_LOCATION,
  ASSEMBLYSCRIPT_MEMORY_SIZE,
  WASMBOY_STATE_LOCATION,
  WASMBOY_STATE_SIZE,
  GAMEBOY_INTERNAL_MEMORY_LOCATION,
  GAMEBOY_INTERNAL_MEMORY_SIZE,
  VIDEO_RAM_LOCATION,
  VIDEO_RAM_SIZE,
  WORK_RAM_LOCATION,
  WORK_RAM_SIZE,
  OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION,
  OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE,
  GRAPHICS_OUTPUT_LOCATION,
  GRAPHICS_OUTPUT_SIZE,
  GBC_PALETTE_LOCATION,
  GBC_PALETTE_SIZE,
  BG_PRIORITY_MAP_LOCATION,
  BG_PRIORITY_MAP_SIZE,
  FRAME_LOCATION,
  FRAME_SIZE,
  BACKGROUND_MAP_LOCATION,
  BACKGROUND_MAP_SIZE,
  TILE_DATA_LOCATION,
  TILE_DATA_SIZE,
  OAM_TILES_LOCATION,
  OAM_TILES_SIZE,
  AUDIO_BUFFER_LOCATION,
  AUDIO_BUFFER_SIZE,
  CARTRIDGE_RAM_LOCATION,
  CARTRIDGE_RAM_SIZE,
  CARTRIDGE_ROM_LOCATION,
  CARTRIDGE_ROM_SIZE
} from './constants';

// WasmBoy
export const wasmMemorySize: i32 = WASMBOY_MEMORY_SIZE;
export const wasmPages: i32 = WASMBOY_WASM_PAGES;
export const assemblyScriptMemoryBaseLocation: i32 = ASSEMBLYSCRIPT_MEMORY_LOCATION;
export const wasmBoyInternalStateLocation: i32 = WASMBOY_STATE_LOCATION;
export const wasmBoyInternalStateSize: i32 = WASMBOY_STATE_SIZE;

// Gameboy
export const gameBoyInternalMemoryLocation: i32 = GAMEBOY_INTERNAL_MEMORY_LOCATION;
export const gameBoyInternalMemorySize: i32 = GAMEBOY_INTERNAL_MEMORY_SIZE;
export const gameBoyVramLocation: i32 = VIDEO_RAM_LOCATION;
export const gameBoyWramLocation: i32 = WORK_RAM_LOCATION;
export const gameBoyMemoryRegistersLocation: i32 = OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION;

// Video output
export const videoOutputLocation: i32 = GRAPHICS_OUTPUT_LOCATION;
export const gameboyColorPaletteLocation: i32 = GBC_PALETTE_LOCATION;
export const gameboyColorPaletteSize: i32 = GBC_PALETTE_SIZE;
export const bgPriorityMapLocation: i32 = BG_PRIORITY_MAP_LOCATION;
export const frameInProgressVideoOutputLocation: i32 = FRAME_LOCATION;
export const backgroundMapLocation: i32 = BACKGROUND_MAP_LOCATION;
export const tileDataMap: i32 = TILE_DATA_LOCATION;
export const oamTiles: i32 = OAM_TILES_LOCATION;

// Sound output
export const soundOutputLocation: i32 = AUDIO_BUFFER_LOCATION;

// Game Cartridge
export const gameRamBanksLocation: i32 = CARTRIDGE_RAM_LOCATION;
// Passed in Game backup or ROM from the user
export const gameBytesLocation: i32 = CARTRIDGE_ROM_LOCATION;
