// Rollup Config for our main JS Lib

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import typescript from 'rollup-plugin-typescript';
import url from 'rollup-plugin-url';
import json from 'rollup-plugin-json';
import replace from 'rollup-plugin-replace';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';
import pkg from './package.json';

let filterImports;
if (process.env.TS && !process.env.WASM) {
  filterImports = {
    '../../dist/worker/wasmboy.wasm.worker.js': ['default', '*']
  };
} else if (process.env.WASM && !process.env.TS) {
  filterImports = {
    '../../dist/worker/wasmboy.ts.worker.js': ['default', '*']
  };
}

// Our base plugins needed by every bundle type
const plugins = [
  resolve(), // so Rollup can find node modules
  commonjs(),
  json(),
  url({
    limit: 1000000 * 1024, // Always inline
    include: ['**/*.worker.js', '**/*.wasm'],
    // Don't emit files, this will replace the worker build output
    emitFiles: false
  }),
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

// Our replace Options for node workers
// https://nodejs.org/api/worker_threads.html
const replaceNodeOptions = {
  delimiters: ['', ''],
  values: {
    '/*ROLLUP_REPLACE_NODE': '',
    'ROLLUP_REPLACE_NODE*/': ''
  }
};
// Plugins specific to running in a node runtime
const nodePlugins = [replace(replaceNodeOptions), ...plugins, bundleSize()];

const replaceBrowserOptions = {
  delimiters: ['', ''],
  values: {
    '/*ROLLUP_REPLACE_BROWSER': '',
    'ROLLUP_REPLACE_BROWSER*/': ''
  }
};
// Plugins specific to running in a node runtime
const browserPlugins = [replace(replaceBrowserOptions), ...plugins];
if (process.env.PROD) {
  browserPlugins.push(compiler());
}
browserPlugins.push(bundleSize());

// Create our lib bundles
const libBundles = [
  {
    input: 'lib/index.js',
    output: {
      name: 'WasmBoy',
      file: pkg.browser,
      format: 'umd',
      sourcemap: true
    },
    context: 'window',
    plugins: browserPlugins
  },

  {
    input: 'lib/index.js',
    output: [
      {
        file: pkg.module,
        format: 'es',
        sourcemap: true
      }
    ],
    context: 'window',
    plugins: browserPlugins
  },
  {
    input: 'lib/index.js',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true
      }
    ],
    context: 'global',
    plugins: nodePlugins
  }
];

export default libBundles;
