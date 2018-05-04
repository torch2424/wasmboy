// Constants that will be shared by the wasm core of the emulator
// And libraries built around the wasm (such as the official JS), or @CryZe wasmboy-rs

// ----------------------------------
// Wasmboy Memory Map
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
// ----------------------------------

// WasmBoy
export const WASMBOY_MEMORY_LOCATION: i32 = 0x000000;
export const WASMBOY_MEMORY_SIZE: i32 = 0x8b0000;
export const WASMBOY_WASM_PAGES: i32 = WASMBOY_MEMORY_SIZE / 1024 / 64;

// AssemblyScript
export const ASSEMBLYSCRIPT_MEMORY_LOCATION: i32 = 0x000000;
export const ASSEMBLYSCRIPT_MEMORY_SIZE: i32 = 0x000400;

// WasmBoy States
export const WASMBOY_STATE_LOCATION: i32 = 0x000400;
export const WASMBOY_STATE_SIZE: i32 = 0x000400;

// Gameboy Internal Memory
export const GAMEBOY_INTERNAL_MEMORY_LOCATION: i32 = 0x000800;
export const GAMEBOY_INTERNAL_MEMORY_SIZE: i32 = 0x00ffff;
export const VIDEO_RAM_LOCATION: i32 = 0x000800;
export const VIDEO_RAM_SIZE: i32 = 0x004000;
export const WORK_RAM_LOCATION: i32 = 0x004800;
export const WORK_RAM_SIZE: i32 = 0x008000;
export const OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION: i32 = 0x00c800;
export const OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE: i32 = 0x004000;

// Graphics Output
export const GRAPHICS_OUTPUT_LOCATION: i32 = 0x010800;
export const GRAPHICS_OUTPUT_SIZE: i32 = 0x07f400;
export const GBC_PALETTE_LOCATION: i32 = 0x010800;
export const GBC_PALETTE_SIZE: i32 = 0x000200;
export const BG_PRIORITY_MAP_LOCATION: i32 = 0x011000;
export const BG_PRIORITY_MAP_SIZE: i32 = 0x005c00;
export const FRAME_LOCATION: i32 = 0x016c00;
export const FRAME_SIZE: i32 = 0x016c00;
export const BACKGROUND_MAP_LOCATION: i32 = 0x038c00;
export const BACKGROUND_MAP_SIZE: i32 = 0x030000;
export const TILE_DATA_LOCATION: i32 = 0x068c00;
export const TILE_DATA_SIZE: i32 = 0x024000;
export const OAM_TILES_LOCATION: i32 = 0x08cc00;
export const OAM_TILES_SIZE: i32 = 0x003000;

// Audio Output
export const AUDIO_BUFFER_LOCATION: i32 = 0x08fc00;
export const AUDIO_BUFFER_SIZE: i32 = 0x020000;

// Catridge Memory
export const CARTRIDGE_RAM_LOCATION: i32 = 0x0afc00;
export const CARTRIDGE_RAM_SIZE: i32 = 0x020000;
export const CARTRIDGE_ROM_LOCATION: i32 = 0x0cfc00;
export const CARTRIDGE_ROM_SIZE: i32 = 0x7e0400;
