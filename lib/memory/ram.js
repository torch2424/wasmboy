// Private function to get the caretridge ram
export const getCartridgeRam = wasmboyMemory => {
  if (!wasmboyMemory || !wasmboyMemory.wasmByteMemory) {
    return false;
  }

  // Depening on the rom type, we will have different ram sizes.
  // Due memory restrictions described in:
  // https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/offline-for-pwa
  // We will make sure to only store as much as we need per ROM :)

  // Similar to `initializeCartridgeType()` in `wasm/memory/memory.ts`
  // We will determine our cartridge type
  // Get our game MBC type from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let cartridgeType = wasmboyMemory.wasmByteMemory[wasmboyMemory.WASMBOY_GAME_BYTES_LOCATION + 0x0147];

  let ramSize = undefined;
  if (cartridgeType === 0x00) {
    // No memory for this rom type
    return false;
  } else if (cartridgeType >= 0x01 && cartridgeType <= 0x03) {
    // MBC1 32KB of Ram
    ramSize = 0x8000;
  } else if (cartridgeType >= 0x05 && cartridgeType <= 0x06) {
    // MBC2 512X4 Bytes, 2KB
    ramSize = 0x800;
  } else if (cartridgeType >= 0x0f && cartridgeType <= 0x13) {
    // MBC3 32KB of Ram
    ramSize = 0x8000;
  } else if (cartridgeType >= 0x19 && cartridgeType <= 0x1e) {
    // MBC5 128KB of Ram
    ramSize = 0x20000;
  }

  if (!ramSize) {
    return false;
  }

  // Finally fill our cartridgeRam from the ram in memory
  const cartridgeRam = new Uint8Array(ramSize);

  for (let i = 0; i < ramSize; i++) {
    cartridgeRam[i] = wasmboyMemory.wasmByteMemory[wasmboyMemory.WASMBOY_GAME_RAM_BANKS_LOCATION + i];
  }

  return cartridgeRam;
};
