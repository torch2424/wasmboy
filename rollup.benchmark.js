// Bundle for the benchmarking app

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import { terser } from 'rollup-plugin-terser';
import url from 'rollup-plugin-url';
import json from 'rollup-plugin-json';
import serve from 'rollup-plugin-serve';
import bundleSize from 'rollup-plugin-bundle-size';
import postcss from 'rollup-plugin-postcss';
import copy from 'rollup-plugin-copy-glob';
import pkg from './package.json';

const babelPluginConfig = {
  // https://github.com/webpack/webpack/issues/2031#issuecomment-219040479
  exclude: [/node_modules\/(?!(shared-gb)\/).*/],
  plugins: [
    ['@babel/plugin-proposal-class-properties'],
    ['@babel/plugin-proposal-object-rest-spread'],
    ['@babel/plugin-transform-react-jsx', { pragma: 'h' }],
    ['@babel/plugin-proposal-export-default-from']
  ]
};

let plugins = [
  postcss({
    extensions: ['.css']
  }),
  resolve({
    preferBuiltins: false
  }),
  babel(babelPluginConfig),
  commonjs(),
  json(),
  url({
    limit: 1000000 * 1024, // Always inline
    include: ['**/*.gb', '**/*.gbc', '**/*.png', '**/*.wasm'],
    // Don't emit files, this will replace the worker build output
    emitFiles: false
  })
];

let sourcemap = false;
if (process.env.BENCHMARK && process.env.SERVE) {
  plugins = [
    ...plugins,
    serve({
      contentBase: ['dist/', 'build/benchmark/', 'demo/benchmark/', 'demo/debugger/'],
      port: 8080
    })
  ];
  sourcemap = 'inline';
} else {
  // Not running through closure to show difference between
  // Closure and non closure.
  plugins = [
    ...plugins,
    copy([
      {
        files: 'demo/debugger/assets/**/*',
        dest: 'build/benchmark/assets'
      },
      {
        files: 'demo/benchmark/index.html',
        dest: 'build/benchmark/'
      }
    ]),
    // TODO: Compiler gives Out of memory errors in node :(
    // compiler()
    terser()
  ];
}

plugins = [...plugins, bundleSize()];

const benchmarkBundles = [
  {
    input: 'demo/benchmark/index.js',
    output: {
      name: 'WasmBoyBenchmark',
      file: 'build/benchmark/index.iife.js',
      format: 'iife',
      sourcemap: sourcemap
    },
    context: 'window',
    plugins: plugins
  }
];

export default benchmarkBundles;
