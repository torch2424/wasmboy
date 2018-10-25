// Returns the internal savestate of the wasmboy core,
// To save all soft values held in memory
export function getInternalState(libWorker) {
  libWorker.wasmInstance.exports.saveState();
  return libWorker.wasmByteMemory.slice(
    libWorker.WASMBOY_INTERNAL_STATE_LOCATION,
    libWorker.WASMBOY_INTERNAL_STATE_LOCATION + libWorker.WASMBOY_INTERNAL_STATE_SIZE
  );
}
