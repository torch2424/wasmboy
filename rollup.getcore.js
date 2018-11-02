// Rollup Config to bundle our "Get Core" exports
// Convinient JS Exports to instantiate and import the
// WasmBoy Core

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

// Our base plugins needed by every bundle type
const plugins = [
  resolve(), // so Rollup can find node modules
  commonjs(),
  json(),
  url({
    limit: 1000000 * 1024, // Always inline
    include: ['**/*.wasm'],
    // Don't emit files, this will replace the worker build output
    emitFiles: false
  }),
  babel({
    // so Rollup can convert unsupported es6 code to es5
    exclude: ['node_modules/**'],
    plugins: [['@babel/plugin-proposal-class-properties'], ['@babel/plugin-proposal-object-rest-spread']]
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
const browserPlugins = [replace(replaceBrowserOptions), ...plugins, bundleSize()];

// Array of bundles to make
const bundleMap = [];

if (process.env.WASM) {
  bundleMap.push({
    name: 'WasmBoyWasmCore',
    input: 'core/portable/getWasmCore.js',
    output: 'dist/core/getWasmBoyWasmCore'
  });
}

if (process.env.TS) {
  bundleMap.push({
    name: 'WasmBoyTsCore',
    input: 'core/portable/getTsCore.js',
    output: 'dist/core/getWasmBoyTsCore'
  });
}

const getCoreBundles = [];

bundleMap.forEach(bundleObject => {
  getCoreBundles.push({
    input: bundleObject.input,
    output: {
      name: bundleObject.name,
      file: `${bundleObject.output}.umd.js`,
      format: 'umd',
      sourcemap: false
    },
    context: 'window',
    plugins: browserPlugins
  });
  getCoreBundles.push({
    input: bundleObject.input,
    output: {
      name: bundleObject.name,
      file: `${bundleObject.output}.iife.js`,
      format: 'iife',
      sourcemap: false
    },
    context: 'window',
    plugins: browserPlugins
  });
  getCoreBundles.push({
    input: bundleObject.input,
    output: {
      name: bundleObject.name,
      file: `${bundleObject.output}.esm.js`,
      format: 'es',
      sourcemap: false
    },
    context: 'window',
    plugins: browserPlugins
  });
  getCoreBundles.push({
    input: bundleObject.input,
    output: {
      name: bundleObject.name,
      file: `${bundleObject.output}.cjs.js`,
      format: 'cjs',
      sourcemap: false
    },
    context: 'global',
    plugins: nodePlugins
  });
});

export default getCoreBundles;
