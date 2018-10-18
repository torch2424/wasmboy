// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions

// Function to get the cartridge header
export const getCartridgeHeader = () => {
  if (!this.wasmByteMemory) {
    return false;
  }

  // Header is at 0x0134 - 0x014F
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  const headerLength = 0x014f - 0x0134;
  const headerLocation = this.WASMBOY_GAME_BYTES_LOCATION + 0x0134;
  const headerArray = this.wasmByteMemory.slice(headerLocation, headerLocation + headerLength);

  return headerArray;
};
