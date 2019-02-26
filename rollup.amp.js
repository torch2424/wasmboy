import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import url from 'rollup-plugin-url';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy-glob';
import pkg from './package.json';

let plugins = [
  resolve(),
  commonjs(),
  json(),
  url({
    limit: 1000000 * 1024,
    include: ['**/*.gb', '**/*.gbc']
  })
];

// If we are watching, also host a dev serve
if (process.env.AMP && process.env.SERVE) {
  plugins = [
    ...plugins,
    serve({
      port: 8080,
      contentBase: ['dist/', 'build/amp/', 'demo/amp/', 'demo/debugger/']
    })
  ];
} else {
  plugins = [
    ...plugins,
    copy([
      {
        files: 'demo/amp/index.html',
        dest: 'build/amp/'
      }
    ])
  ];
}

const ampBundles = [
  {
    input: 'demo/amp/index.js',
    output: {
      name: 'WasmBoyAmp',
      file: 'build/amp/wasmboy-amp.js',
      format: 'iife'
    },
    plugins,
    sourcemap: true
  }
];

export default ampBundles;
