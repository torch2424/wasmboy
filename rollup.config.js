import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import url from 'rollup-plugin-url';
import nodent from 'rollup-plugin-nodent';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';
import pkg from './package.json';

const plugins = [
  resolve(), // so Rollup can find node modules
  url({
    limit: 100 * 1024, // 100Kb
    include: ['**/*.wasm']
  }),
  commonjs(), // so Rollup can convert node module to an ES module
  babel({
    // so Rollup can convert unsupported es6 code to es5
    exclude: ['node_modules/**']
  }),
  nodent(),
  compiler(),
  bundleSize()
];

export default [
  // browser-friendly UMD build
  {
    input: 'lib/index.js',
    output: {
      name: 'WasmBoy',
      file: pkg.browser,
      format: 'umd'
    },
    context: 'window',
    plugins: plugins
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: 'lib/index.js',
    output: [{ file: pkg.module, format: 'es' }],
    context: 'window',
    plugins: plugins
  },
  {
    input: 'lib/index.js',
    output: [{ file: pkg.main, format: 'cjs' }],
    context: 'global',
    plugins: plugins
  }
];
