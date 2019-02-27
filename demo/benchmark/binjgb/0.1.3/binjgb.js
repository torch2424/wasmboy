/*
 * Copyright (C) 2019 Ben Smith
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE file for details.
 */

// Modified to import wasm through rollup
// And export the binjgb object

import binjgbWasmUrl from './binjgb.wasm';

const Binjgb = async function() {
  // Must match values defined in generated binjgb.js
  const TABLE_SIZE = 34;
  const TOTAL_MEMORY = 16777216;
  const STATIC_BUMP = 17264;
  const TOTAL_STACK = 5242880;

  const pageSize = 65536;
  const totalPages = TOTAL_MEMORY / pageSize;
  const wasmFile = binjgbWasmUrl;
  const memory = new WebAssembly.Memory({ initial: totalPages, maximum: totalPages });
  const buffer = memory.buffer;
  const u8a = new Uint8Array(buffer);
  const u32a = new Uint32Array(buffer);

  const GLOBAL_BASE = 1024;
  const STATIC_BASE = GLOBAL_BASE;
  let STATICTOP = STATIC_BASE + STATIC_BUMP;
  const alignMemory = size => {
    return (size + 15) & -16;
  };
  const staticAlloc = size => {
    const ret = STATICTOP;
    STATICTOP = alignMemory(STATICTOP + size);
    return ret;
  };

  const DYNAMICTOP_PTR = staticAlloc(4);
  const STACK_BASE = alignMemory(STATICTOP);
  const STACKTOP = STACK_BASE;
  const STACK_MAX = alignMemory(STACK_BASE + TOTAL_STACK);
  const DYNAMIC_BASE = alignMemory(STACK_MAX);
  u32a[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

  const abort = what => {
    throw `abort(${what}).`;
  };
  const abortOnCannotGrowMemory = () => {
    abort('Cannot enlarge memory.');
  };
  const enlargeMemory = abortOnCannotGrowMemory;
  const getTotalMemory = () => {
    return TOTAL_MEMORY;
  };
  const ___setErrNo = v => {
    return v;
  };
  const ___syscall140 = (which, varargs) => {
    return 0;
  };
  const streams = {
    1: { buffer: [], out: console.log.bind(console) },
    2: { buffer: [], out: console.error.bind(console) }
  };
  const decoder = new TextDecoder('utf8');
  const ___syscall146 = (which, varargs) => {
    const get = () => {
      varargs += 4;
      return u32a[(varargs - 4) >> 2];
    };
    const { buffer, out } = streams[get()];
    const flush = () => {
      out(decoder.decode(new Uint8Array(buffer)));
      buffer.length = 0;
    };
    const iov = get();
    const iovcnt = get();
    const printChar = c => {
      if (c === 0 || c === 10) {
        flush();
      } else {
        buffer.push(c);
      }
    };
    let ret = 0;
    for (let i = 0; i < iovcnt; ++i) {
      const ptr = u32a[(iov + i * 8) >> 2];
      const len = u32a[(iov + (i * 8 + 4)) >> 2];
      for (let j = 0; j < len; ++j) {
        printChar(u8a[ptr + j]);
      }
      ret += len;
    }
    return ret;
  };
  const ___syscall54 = (which, varargs) => {
    return 0;
  };
  const ___syscall6 = (which, varargs) => {
    return 0;
  };
  const _emscripten_memcpy_big = (dest, src, num) => {
    u8a.set(u8a.subarray(src, src + num), dest);
    return dest;
  };
  const _exit = status => {};
  const __table_base = 0;
  const table = new WebAssembly.Table({ initial: TABLE_SIZE, maximum: TABLE_SIZE, element: 'anyfunc' });

  const importObject = {
    env: {
      abort,
      enlargeMemory,
      getTotalMemory,
      abortOnCannotGrowMemory,
      ___setErrNo,
      ___syscall140,
      ___syscall146,
      ___syscall54,
      ___syscall6,
      _emscripten_memcpy_big,
      _exit,
      __table_base,
      DYNAMICTOP_PTR,
      STACKTOP,
      STACK_MAX,
      memory,
      table
    }
  };

  const response = fetch(wasmFile);
  if (WebAssembly.instantiateStreaming) {
    try {
      var { instance } = await WebAssembly.instantiateStreaming(response, importObject);
    } catch (_) {}
  }
  if (!instance) {
    var { instance } = await WebAssembly.instantiate(await (await response).arrayBuffer(), importObject);
  }

  const ret = {};
  for (let name in instance.exports) {
    ret[name] = instance.exports[name];
  }
  ret.buffer = memory.buffer;
  return ret;
};

export default Binjgb;
