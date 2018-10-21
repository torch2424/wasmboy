// Returns the standard 0xFFFF gameboy memory
// You will normally see in gameboy docs.
// This is returned from the core, and represents
// This wasmboy gameboy state
export function getGameBoyMemory(libWorker) {
  return libWorker.wasmByteMemory.slice(
    libWorker.WASMBOY_INTERNAL_MEMORY_LOCATION,
    libWorker.WASMBOY_INTERNAL_MEMORY_LOCATION + libWorker.WASMBOY_INTERNAL_MEMORY_SIZE
  );
}
