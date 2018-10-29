// Portable Code for JS Wasm Benchmarking
// https://github.com/AssemblyScript/assemblyscript/wiki/Writing-portable-code

export function u8Overflow(param: u8): u8 {
  // return param & 0xFF;
  return param;
}

export function u16Overflow(param: u16): u16 {
  // return param & 0xFFFF;
  return param;
}
