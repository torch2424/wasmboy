// Constants that will be shared by the wasm core of the emulator
// And libraries built around the wasm (such as the official JS), or @CryZe wasmboy-rs

// TODO: Make better names for these

// ----------------------------------
// Wasmboy Memory Map
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
// ----------------------------------

// WasmBoy
export const wasmMemorySize: u32 = 0x8B0000;
export const assemblyScriptMemoryBaseLocation: u32 = 0x000000;
export const wasmBoyInternalStateLocation: u32 = 0x000400;
export const wasmBoyInternalStateSize: u32 = 0x000400;

// Gameboy
export const gameBoyInternalMemoryLocation: u32 = 0x000800;
export const gameBoyInternalMemorySize: u32 = 0x00FFFF;
export const gameBoyVramLocation: u32 = 0x000800;
export const gameBoyWramLocation: u32 = 0x004800;
export const gameBoyMemoryRegistersLocation: u32 = 0x00C800;

// Video output
export const videoOutputLocation: u32 = 0x010800;
export const gameboyColorPaletteLocation: u32 = 0x010800;
export const frameInProgressVideoOutputLocation: u32 = 0x011000;
export const currentFrameVideoOutputLocation: u32 = 0x022000;
export const backgroundMapLocation: u32 = 0x033000;
export const tileDataMap: u32 = 0x063000;
export const oamTiles: u32 = 0x087000;

// Sound output
export const soundOutputLocation: u32 = 0x08A000;

// Game Cartridge
export const gameRamBanksLocation: u32 = 0x0AA000;
// Passed in Game backup or ROM from the user
export const gameBytesLocation: u32 = 0x0CA000;
