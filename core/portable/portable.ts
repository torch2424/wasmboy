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
  // JS ints are all i32, therefore, get the sign bit, remove it, then convert accordingly
  let response = param;
  if (checkBitOnByte(7, response)) {
    response = resetBitOnByte(7, response);
    response = response * -1;
  }
  return response;
}
