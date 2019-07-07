// Utilities for general graphics stuff with the wasmboy core

// Function to get the start of a RGB pixel (R, G, B)
// Inlined because closure compiler inlines
export function getRgbPixelStart(x: i32, y: i32): i32 {
  // Get the pixel number
  // let pixelNumber: i32 = (y * 160) + x;
  // Each pixel takes 3 slots, therefore, multiply by 3!
  return (y * 160 + x) * 3;
}

// Also need to store current frame in memory to be read by JS
export function setPixelOnFrame(x: i32, y: i32, colorId: i32, color: i32): void {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset
  store<u8>(FRAME_LOCATION + getRgbPixelStart(x, y) + colorId, color);
}

// Function to shortcut the memory map, and load directly from the VRAM Bank
export function loadFromVramBank(gameboyOffset: i32, vramBankId: i32): u8 {
  let wasmBoyAddress = gameboyOffset - Memory.videoRamLocation + GAMEBOY_INTERNAL_MEMORY_LOCATION + 0x2000 * (vramBankId & 0x01);
  return load<u8>(wasmBoyAddress);
}
