// Bundle for the iframe embed app

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
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
  let indexHtml = fs.readFileSync('demo/iframe/index.html', 'utf8');
  indexHtml = indexHtml.replace('<%BUNDLE%>', bundleName.replace('build/iframe/', ''));
  fs.writeFileSync('build/iframe/index.html', indexHtml, 'utf8');
};

const babelPluginConfig = {
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
    include: ['**/*.png'],
    // Don't emit files, this will replace the worker build output
    emitFiles: false
  })
];

let sourcemap = false;
if (process.env.IFRAME && process.env.SERVE) {
  plugins = [
    ...plugins,
    serve({
      contentBase: ['dist/', 'build/iframe/', 'demo/iframe/', 'demo/iframe/'],
      port: 8080
    })
  ];
  writeIndexHtmlToBuild('index.iife.js');
  sourcemap = 'inline';
} else if (process.env.IFRAME) {
  // Not running through closure to show difference between
  // Closure and non closure.
  plugins = [
    ...plugins,
    copy([
      {
        files: 'demo/iframe/assets/**/*',
        dest: 'build/iframe/assets'
      }
    ]),
    compiler(),
    hash({
      dest: 'build/iframe/bundle.[hash].js',
      callback: bundleName => {
        writeIndexHtmlToBuild(bundleName);
      }
    })
  ];
}

plugins = [...plugins, bundleSize()];

const iframeBundles = [
  {
    input: 'demo/iframe/index.js',
    output: {
      name: 'WasmBoyIframe',
      file: 'build/iframe/index.iife.js',
      format: 'iife',
      sourcemap: sourcemap
    },
    context: 'window',
    plugins: plugins,
    sourcemap: true
  }
];

export default iframeBundles;
