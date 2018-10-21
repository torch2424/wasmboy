// Function to get the current palette data for
// GBC in memory. This is needed to load state with
// The correct colors
export function getPaletteMemory(libWorker) {
  return libWorker.wasmByteMemory.slice(
    libWorker.WASMBOY_PALETTE_MEMORY_LOCATION,
    libWorker.WASMBOY_PALETTE_MEMORY_LOCATION + libWorker.WASMBOY_PALETTE_MEMORY_SIZE
  );
}
