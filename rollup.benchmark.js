// Bundle for the benchmarking app

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import url from 'rollup-plugin-url';
import json from 'rollup-plugin-json';
import serve from 'rollup-plugin-serve';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';
import postcss from 'rollup-plugin-postcss';
import pkg from './package.json';

const babelPluginConfig = {
  exclude: ['node_modules/**'],
  plugins: [
    ['@babel/plugin-proposal-class-properties'],
    ['@babel/plugin-proposal-object-rest-spread'],
    ['@babel/plugin-transform-react-jsx', { pragma: 'h' }]
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
    include: ['**/*.gb', '**/*.gbc', '**/*.png'],
    // Don't emit files, this will replace the worker build output
    emitFiles: false
  })
];

let sourcemap = false;
if (process.env.ROLLUP_WATCH) {
  plugins = [
    ...plugins,
    serve({
      contentBase: ['dist/', 'dist/benchmark/', 'benchmark/', 'debugger/'],
      port: 8080
    })
  ];
  sourcemap = 'inline';
} else {
  plugins = [
    ...plugins,
    compiler(),
    copy([
      {
        files: 'debugger/assets/**/*',
        dest: 'build/benchmark'
      },
      {
        files: 'benchmark/index.html',
        dest: 'build/benchmark'
      }
    ])
  ];
}

plugins = [...plugins, bundleSize()];

const benchmarkBundles = [
  {
    input: 'benchmark/index.js',
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
