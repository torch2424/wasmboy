// Constants that will be shared by the wasm core of the emulator
// And libraries built around the wasm (such as the official JS), or @CryZe wasmboy-rs

// TODO: Make better names for these

// ----------------------------------
// Wasmboy Memory Map
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
// ----------------------------------

// WasmBoy
export const wasmMemorySize: i32 = 0x8b0000;
export const wasmPages: i32 = wasmMemorySize / 1024 / 64;
export const assemblyScriptMemoryBaseLocation: i32 = 0x000000;
export const wasmBoyInternalStateLocation: i32 = 0x000400;
export const wasmBoyInternalStateSize: i32 = 0x000400;

// Gameboy
export const gameBoyInternalMemoryLocation: i32 = 0x000800;
export const gameBoyInternalMemorySize: i32 = 0x00ffff;
export const gameBoyVramLocation: i32 = 0x000800;
export const gameBoyWramLocation: i32 = 0x004800;
export const gameBoyMemoryRegistersLocation: i32 = 0x00c800;

// Video output
export const videoOutputLocation: i32 = 0x010800;
export const gameboyColorPaletteLocation: i32 = 0x010800;
export const gameboyColorPaletteSize: i32 = 0x200;
export const bgPriorityMapLocation: i32 = 0x011000;
export const frameInProgressVideoOutputLocation: i32 = 0x016c00;
export const backgroundMapLocation: i32 = 0x038c00;
export const tileDataMap: i32 = 0x068c00;
export const oamTiles: i32 = 0x08cc00;

// Sound output
export const soundOutputLocation: i32 = 0x08fc00;

// Game Cartridge
export const gameRamBanksLocation: i32 = 0x0afc00;
// Passed in Game backup or ROM from the user
export const gameBytesLocation: i32 = 0x0cfc00;
