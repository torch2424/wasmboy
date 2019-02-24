// Portable Code for JS Wasm Benchmarking
// https://github.com/AssemblyScript/assemblyscript/wiki/Writing-portable-code
// https://github.com/AssemblyScript/assemblyscript/blob/master/std/portable/index.js

export function u8Portable(param: u8): u8 {
  return param & 0xff;
}

export function i16Portable(param: i16): i16 {
  return (param << 16) >> 16;
}

export function u16Portable(param: u16): u16 {
  return param & 0xffff;
}

export function i8Portable(param: i8): i8 {
  return (param << 24) >> 24;
}

export function i32Portable(param: i32): i32 {
  return param | 0;
}
