// Wrapper funcstions around load/store for assemblyscript offset to gb mem offset
// TODO: Ensure store is hitting right values: https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions
function _eightBitStoreIntoGBMemory(offset: u16, value: u8): void {
  store<u8>(offset, value);
}

function _sixteenBitStoreIntoGBMemory(offset: u16, value: u16): void {
  store<u16>(offset, value);
}

function _eightBitLoadFromGBMemory(offset: u16): u8 {
  return load<u8>(offset);
}

function _sixteenBitLoadFromGBMemory(offset: u16): u16 {
  return load<u16>(offset);
}
