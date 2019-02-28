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
let plugins = [
  resolve(), // so Rollup can find node modules
  commonjs(),
  json(),
  url({
    limit: 1000000 * 1024, // Always inline
    include: ['**/*.wasm'],
    // Don't emit files, this will replace the worker build output
    emitFiles: false
  })
];

if (!process.env.ES_NEXT) {
  plugins = [
    ...plugins,
    babel({
      // so Rollup can convert unsupported es6 code to es5
      exclude: ['node_modules/**'],
      plugins: [['@babel/plugin-proposal-class-properties'], ['@babel/plugin-proposal-object-rest-spread']]
    })
  ];
}

if (process.env.GET_CORE_CLOSURE) {
  let closureCompilerOptions = {};

  if (process.env.CLOSURE_DEBUG) {
    closureCompilerOptions = {
      ...closureCompilerOptions,
      debug: true
    };
  }

  plugins = [...plugins, compiler(closureCompilerOptions)];
}

plugins = [...plugins, bundleSize()];

// Array of bundles to make
const bundleMap = [];

const addDotIdentifiers = output => {
  if (process.env.ES_NEXT) {
    output += '.esnext';
  }

  if (process.env.GET_CORE_CLOSURE) {
    output += '.closure';

    if (process.env.CLOSURE_DEBUG) {
      output += '.closuredebug';
    }
  }

  return output;
};

if (process.env.WASM) {
  let bundleMapObject = {
    name: 'WasmBoyWasmCore',
    input: 'core/portable/getWasmCore.js',
    output: 'dist/core/getWasmBoyWasmCore'
  };

  bundleMapObject.output = addDotIdentifiers(bundleMapObject.output);

  bundleMap.push(bundleMapObject);
}

if (process.env.TS) {
  let bundleMapObject = {
    name: 'WasmBoyTsCore',
    input: 'core/portable/getTsCore.js',
    output: 'dist/core/getWasmBoyTsCore'
  };

  bundleMapObject.output = addDotIdentifiers(bundleMapObject.output);

  bundleMap.push(bundleMapObject);
}

const getCoreBundles = [];

bundleMap.forEach(bundleObject => {
  getCoreBundles.push({
    input: bundleObject.input,
    output: {
      name: bundleObject.name,
      file: `${bundleObject.output}.umd.js`,
      format: 'umd',
      sourcemap: true
    },
    context: 'window',
    plugins: plugins
  });
  getCoreBundles.push({
    input: bundleObject.input,
    output: {
      name: bundleObject.name,
      file: `${bundleObject.output}.iife.js`,
      format: 'iife',
      sourcemap: true
    },
    context: 'window',
    plugins: plugins
  });
  getCoreBundles.push({
    input: bundleObject.input,
    output: {
      name: bundleObject.name,
      file: `${bundleObject.output}.esm.js`,
      format: 'es',
      sourcemap: true
    },
    context: 'window',
    plugins: plugins
  });
  getCoreBundles.push({
    input: bundleObject.input,
    output: {
      name: bundleObject.name,
      file: `${bundleObject.output}.cjs.js`,
      format: 'cjs',
      sourcemap: true
    },
    context: 'global',
    plugins: plugins
  });
});

export default getCoreBundles;
