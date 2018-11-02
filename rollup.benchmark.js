// Rollup Config for compiling IIFE Benchmark Setup

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import bundleSize from 'rollup-plugin-bundle-size';
import url from 'rollup-plugin-url';

// Our base plugins needed by every bundle type
const plugins = [
  resolve(), // so Rollup can find node modules
  commonjs(),
  url({
    limit: 1000000 * 1024, // Always inline
    include: ['**/*.gb', '**/*.gbc'],
    // Don't emit files, this will replace the worker build output
    emitFiles: false
  }),
  bundleSize()
];

const benchmarkBundles = [
  {
    input: 'test/esbench/wasmVsTsBenchmarkSetup.js',
    output: {
      name: 'WasmBoyWasmVsTsSetup',
      file: `dist/wasmVsTsBenchmarkSetup.iife.js`,
      format: 'iife',
      sourcemap: false
    },
    context: 'window',
    plugins: plugins
  }
];

export default benchmarkBundles;
