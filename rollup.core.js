// Rollup Config for our Core TS Builds

import typescript from 'rollup-plugin-typescript';
import babel from 'rollup-plugin-babel';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';

// TODO(torch2424), write a file in core/portable/instantiateWasm.js
// That simply gives back our wasmInstance and WasmByte Memory already instantiated
// That way it will be as if we got the Core directly from JS like the TS build.
// Rename core.*.js to core.ts.*.js, and follow same for wasm

// Fs for some extra needed files
const fs = require('fs');

const plugins = [
  typescript({
    tsconfig: './core/tsconfig.json'
  }),
  babel()
];

if (process.env.PROD) {
  plugins.push(compiler());
}
plugins.push(bundleSize());

let sourcemap = 'inline';
if (process.env.PROD) {
  sourcemap = false;
}

const coreTsBundles = [
  {
    input: './core/index.ts',
    output: {
      banner: () => {
        return fs.readFileSync('./core/portable/wasmMock.js', 'utf8');
      },
      file: `dist/core/core.esm.js`,
      format: 'esm',
      name: 'WasmBoyCore',
      sourcemap: sourcemap
    },
    plugins: plugins
  },
  {
    input: './core/index.ts',
    output: {
      banner: () => {
        return fs.readFileSync('./core/portable/wasmMock.js', 'utf8');
      },
      file: `dist/core/core.umd.js`,
      format: 'umd',
      name: 'WasmBoyCore',
      sourcemap: sourcemap
    },
    plugins: plugins
  },
  {
    input: './core/index.ts',
    output: {
      banner: () => {
        return fs.readFileSync('./core/portable/wasmMock.js', 'utf8');
      },
      file: `dist/core/core.cjs.js`,
      format: 'cjs',
      name: 'WasmBoyCore',
      sourcemap: sourcemap
    },
    plugins: plugins
  }
];

export default coreTsBundles;
