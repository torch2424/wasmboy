// Private function to get the caretridge rom
export function getCartridgeRom(libWorker) {
  if (!libWorker.wasmByteMemory) {
    return new Uint8Array();
  }

  // Depening on the rom type, we will have different rom sizes.
  // Due memory restrictions described in:
  // https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/offline-for-pwa
  // We will make sure to only store as much as we need per ROM :)

  // Similar to `initializeCartridgeType()` in `wasm/memory/memory.ts`
  // We will determine our cartridge type
  // Get our game MBC type from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let cartridgeType = libWorker.wasmByteMemory[libWorker.WASMBOY_GAME_BYTES_LOCATION + 0x0147];

  let romSize = undefined;
  if (cartridgeType === 0x00) {
    // ROM only, 32KB
    romSize = 0x8000;
  } else if (cartridgeType >= 0x01 && cartridgeType <= 0x03) {
    // MBC1 2MB of ROM
    romSize = 0x200000;
  } else if (cartridgeType >= 0x05 && cartridgeType <= 0x06) {
    // MBC2 256KB ROM
    romSize = 0x40000;
  } else if (cartridgeType >= 0x0f && cartridgeType <= 0x13) {
    // MBC3 2MB of ROM
    romSize = 0x200000;
  } else if (cartridgeType >= 0x19 && cartridgeType <= 0x1e) {
    // MBC5 8MB of ROM
    romSize = 0x800000;
  }

  if (!romSize) {
    return new Uint8Array();
  }

  // Finally fill our cartridgeRam from the ram in memory
  const cartridgeRom = libWorker.wasmByteMemory.slice(
    libWorker.WASMBOY_GAME_BYTES_LOCATION,
    libWorker.WASMBOY_GAME_BYTES_LOCATION + romSize
  );
  return cartridgeRom;
}
