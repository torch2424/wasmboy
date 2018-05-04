
// Function to get the cartridge header
export const getCartridgeHeader = (wasmboyMemory) => {
  if (!wasmboyMemory || !wasmboyMemory.wasmByteMemory) {
    return false;
  }

  // Header is at 0x0134 - 0x014F
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  const headerLength = 0x014f - 0x0134;
  const headerArray = new Uint8Array(headerLength);
  for (let i = 0; i <= headerLength; i++) {
    // Get the CARTRIDGE_ROM + the offset to point us at the header, plus the current byte
    headerArray[i] = wasmboyMemory.wasmByteMemory[wasmboyMemory.WASMBOY_GAME_BYTES_LOCATION + 0x0134 + i];
  }

  return headerArray;
};
