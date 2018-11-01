// Rollup Config for our Web Workers used in the Lib

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import url from 'rollup-plugin-url';
import json from 'rollup-plugin-json';
import replace from 'rollup-plugin-replace';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';

let sourcemap = 'inline';
if (process.env.PROD) {
  sourcemap = false;
}

let filterImports;
if (process.env.TS) {
  filterImports = {
    './instantiate': ['instantiateWasm']
  };
} else {
  filterImports = {
    './instantiate': ['instantiateTs']
  };
}

const plugins = [
  url({
    limit: 1000000 * 1024, // Always inline
    include: ['**/*.wasm']
  }),
  resolve(),
  commonjs(),
  json(),
  babel({
    // so Rollup can convert unsupported es6 code to es5
    exclude: ['node_modules/**'],
    plugins: [
      ['@babel/plugin-proposal-class-properties'],
      ['@babel/plugin-proposal-object-rest-spread'],
      [
        'babel-plugin-filter-imports',
        {
          imports: filterImports
        }
      ]
    ]
  })
];

if (process.env.PROD) {
  plugins.push(compiler());
}
plugins.push(bundleSize());

// Define our worker input and output
const workerFiles = [
  {
    input: 'lib/graphics/worker/graphics.worker.js',
    output: 'dist/worker/graphics.worker.js'
  },
  {
    input: 'lib/audio/worker/audio.worker.js',
    output: 'dist/worker/audio.worker.js'
  },
  {
    input: 'lib/controller/worker/controller.worker.js',
    output: 'dist/worker/controller.worker.js'
  },
  {
    input: 'lib/memory/worker/memory.worker.js',
    output: 'dist/worker/memory.worker.js'
  }
];
if (process.env.TS) {
  workerFiles.push({
    input: 'lib/wasmboy/worker/wasmboy.worker.js',
    output: 'dist/worker/wasmboy.ts.worker.js'
  });
} else {
  workerFiles.push({
    input: 'lib/wasmboy/worker/wasmboy.worker.js',
    output: 'dist/worker/wasmboy.wasm.worker.js'
  });
}

const workerBundles = [];
workerFiles.forEach(workerFile => {
  workerBundles.push({
    input: workerFile.input,
    output: {
      file: workerFile.output,
      format: 'iife',
      name: 'WasmBoyWorker',
      sourcemap
    },
    context: 'self',
    plugins: plugins
  });
});

export default workerBundles;
