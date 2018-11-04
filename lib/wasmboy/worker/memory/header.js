// Function to get the cartridge header
export function getCartridgeHeader(libWorker) {
  if (!libWorker.wasmByteMemory) {
    return new Uint8Array();
  }

  // Header is at 0x0134 - 0x014F
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  const headerLength = 0x014f - 0x0134;
  const headerLocation = libWorker.WASMBOY_GAME_BYTES_LOCATION + 0x0134;
  const headerArray = libWorker.wasmByteMemory.slice(headerLocation, headerLocation + headerLength);

  return headerArray;
}
