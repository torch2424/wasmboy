// Bundle for the debugger app

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import url from 'rollup-plugin-url';
import json from 'rollup-plugin-json';
import serve from 'rollup-plugin-serve';
import bundleSize from 'rollup-plugin-bundle-size';
import postcss from 'rollup-plugin-postcss';
import copy from 'rollup-plugin-copy-glob';
import hash from 'rollup-plugin-hash';
import pkg from './package.json';

const fs = require('fs');

const writeIndexHtmlToBuild = bundleName => {
  let indexHtml = fs.readFileSync('demo/debugger-rebuild/index.html', 'utf8');
  indexHtml = indexHtml.replace('<%BUNDLE%>', bundleName);
  fs.writeFileSync('build/index.html', indexHtml, 'utf8');
};

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
if (process.env.DEBUGGER && process.env.SERVE) {
  plugins = [
    ...plugins,
    serve({
      contentBase: ['dist/', 'build/', 'demo/debugger-rebuild/'],
      port: 8080
    })
  ];
  writeIndexHtmlToBuild('index.iife.js');
  sourcemap = 'inline';
} else {
  // Not running through closure to show difference between
  // Closure and non closure.
  plugins = [
    ...plugins,
    copy([
      {
        files: 'demo/debugger-rebuild/assets/**/*',
        dest: 'build/assets'
      }
    ]),
    hash({
      dest: 'build/bundle.[hash].js',
      callback: bundleName => {
        writeIndexHtmlToBuild(bundleName);
      }
    })
  ];
}

plugins = [...plugins, bundleSize()];

const debuggerBundles = [
  {
    input: 'demo/debugger-rebuild/index.js',
    output: {
      name: 'WasmBoyBenchmark',
      file: 'build/index.iife.js',
      format: 'iife',
      sourcemap: sourcemap
    },
    context: 'window',
    plugins: plugins
  }
];

export default debuggerBundles;
