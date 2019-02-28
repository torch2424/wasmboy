// Function to get the boot ROM
export function getBootRom(libWorker) {
  if (!libWorker.wasmByteMemory) {
    return new Uint8Array();
  }

  // Header is at 0x0134 - 0x014F
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  const bootRomLocation = libWorker.wasmInstance.exports.BOOT_ROM_LOCATION.valueOf();
  const bootRomSize = libWorker.wasmInstance.exports.BOOT_ROM_SIZE.valueOf();
  const bootRom = libWorker.wasmByteMemory.slice(bootRomLocation, bootRomLocation + bootRomSize);

  return bootRom;
}
