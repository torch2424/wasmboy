import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import url from 'rollup-plugin-url';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy-glob';
import pkg from './package.json';

const plugins = [
  resolve(),
  commonjs(),
  json(),
  url({
    limit: 1000000 * 1024,
    include: ['**/*.gb', '**/*.gbc']
  })
];

// If we are watching, also host a dev serve
if (process.env.SERVE) {
  plugins.push(
    serve({
      port: 8080,
      contentBase: ['src', 'dist']
    })
  );
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
    plugins
  }
];

export default ampBundles;
