// Rollup Config for our Core TS Builds

import typescript from 'rollup-plugin-typescript';
import babel from 'rollup-plugin-babel';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';

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
      sourcemap
    },
    plugins
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
      sourcemap
    },
    plugins
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
      sourcemap
    },
    plugins
  }
];

export default coreTsBundles;
