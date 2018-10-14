import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import url from 'rollup-plugin-url';
import regenerator from 'rollup-plugin-regenerator';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';
import pkg from './package.json';

const plugins = [
  resolve(), // so Rollup can find node modules
  url({
    limit: 100 * 1024, // 100Kb
    include: ['**/*.wasm', '**/*.worker.js']
  }),
  babel({
    // so Rollup can convert unsupported es6 code to es5
    exclude: ['node_modules/**']
  }),
  commonjs(), // so Rollup can convert node module to an ES module
  // compiler(),
  bundleSize()
];

// Plugins specific to running in a node runtime
const nodePlugins = [...plugins, regenerator()];

// Define our worker outputs
const workerEntryPoints = [
  'wasmboy/worker/wasmboy.worker.js',
  'graphics/worker/graphics.worker.js',
  'audio/worker/audio.worker.js',
  'controller/worker/controller.worker.js',
  'memory/worker/memory.worker.js'
];

const workerBundles = [];
workerEntryPoints.forEach(workerEntryPoint => {
  workerBundles.push({
    input: `lib/${workerEntryPoint}`,
    output: {
      file: `dist/${workerEntryPoint}`,
      format: 'esm',
      sourcemap: true
    },
    plugins: plugins
  });
});

// Create our lib bundles
const libBundles = [
  // browser-friendly UMD build
  {
    input: 'lib/index.js',
    output: {
      name: 'WasmBoy',
      file: pkg.browser,
      format: 'umd',
      sourcemap: true
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
    output: [
      {
        file: pkg.module,
        format: 'es',
        sourcemap: true
      }
    ],
    context: 'window',
    plugins: plugins
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

export default [...workerBundles, ...libBundles];
