// Banner placed by rollup to mock out some items on our esm build
// This is useful for things like wasmmemory

const wasmboyMemorySize = 0x8b0000;

// Simply initialized to the size we need
const wasmByteMemory = new Uint8ClampedArray(wasmboyMemorySize);

// Memory mock
export const memory = {
  size: () => {
    return wasmboyMemorySize;
  },
  grow: () => {},
  wasmByteMemory: wasmByteMemory
};

const load = offset => {
  return wasmByteMemory[offset];
};

const store = (offset, value) => {
  wasmByteMemory[offset] = value;
};

const abs = value => {
  return Math.abs(value);
};

const ceil = value => {
  return Math.ceil(value);
};
