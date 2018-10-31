// Portable Code for JS Wasm Benchmarking
// https://github.com/AssemblyScript/assemblyscript/wiki/Writing-portable-code

import { checkBitOnByte, resetBitOnByte, setBitOnByte } from '../helpers/index';

export function u8Portable(param: u8): u8 {
  return param & 0xff;
}

export function u16Portable(param: u16): u16 {
  return param & 0xffff;
}

export function i8Portable(param: i8): i8 {
  // JS ints are all i32, therefore, get the sign bit, and then convert accordingly
  // Example: https://blog.michaelyin.info/convert-8bit-byte-to-signed-int/
  let response: i32 = param;
  if (checkBitOnByte(7, response)) {
    response = (256 - <i32>param) * -1;
  }

  return <i8>response;
}
