// Constants that will be shared by the wasm core of the emulator
// And libraries built around the wasm (such as the official JS), or @CryZe wasmboy-rs

// TODO: Make better names for these

export class Constants {

  // ----------------------------------
  // Wasmboy Memory Map
  // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
  // ----------------------------------
  static readonly wasmMemorySize: u32 = 0x8D3FFF;
  static readonly gameBoyInternalMemoryLocation: u32 = 0x000400;
  static readonly videoOutputLocation: u32 = 0x030400;
  static readonly currentFrameVideoOutputLocation: u32 = Constants.videoOutputLocation;
  static readonly frameInProgressVideoOutputLocation: u32 = Constants.currentFrameVideoOutputLocation + ((160 * 144) * 3);
  static readonly gameboyColorPaletteLocation: u32 = 0x0B2000;
  static readonly soundOutputLocation: u32 = 0x0B2400;
  // Passed in Game backup or ROM from the user
  static readonly gameBytesLocation: u32 = 0x0D2400;
  static readonly gameRamBanksLocation: u32 = 0x010400;
}

// Exported functions to get specific constants
export function wasmMemorySize(): u32 {
  return Constants.wasmMemorySize;
}

export function gameBoyInternalMemoryLocation(): u32 {
  return Constants.gameBoyInternalMemoryLocation;
}

export function videoOutputLocation(): u32 {
  return Constants.videoOutputLocation;
}

export function currentFrameVideoOutputLocation(): u32 {
  return Constants.currentFrameVideoOutputLocation;
}

export function frameInProgressVideoOutputLocation(): u32 {
  return Constants.frameInProgressVideoOutputLocation;
}

export function gameboyColorPaletteLocation(): u32 {
  return Constants.gameboyColorPaletteLocation;
}

export function soundOutputLocation(): u32 {
  return Constants.soundOutputLocation;
}

export function gameBytesLocation(): u32 {
  return Constants.gameBytesLocation;
}

export function gameRamBanksLocation(): u32 {
  return Constants.gameRamBanksLocation;
}
