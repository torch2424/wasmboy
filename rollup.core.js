// Rollup Config for our Core TS Builds

import typescript from 'rollup-plugin-typescript';
import babel from 'rollup-plugin-babel';
import bundleSize from 'rollup-plugin-bundle-size';

// TODO(torch2424), write a file in core/portable/instantiateWasm.js
// That simply gives back our wasmInstance and WasmByte Memory already instantiated
// That way it will be as if we got the Core directly from JS like the TS build.
// Rename core.*.js to core.ts.*.js, and follow same for wasm

// Fs for some extra needed files
const fs = require('fs');

let typescriptPluginOptions = {
  tsconfig: './core/tsconfig.json'
};

if (process.env.ES_NEXT) {
  typescriptPluginOptions = {
    ...typescriptPluginOptions,
    target: 'ESNext'
  };
}

let plugins = [typescript(typescriptPluginOptions)];

let sourcemap = 'inline';
if (process.env.PROD) {
  sourcemap = false;
}

if (!process.env.ES_NEXT) {
  plugins = [...plugins, babel()];
}

plugins = [...plugins, bundleSize()];

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
