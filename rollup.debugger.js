// Bundle for the debugger app

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import { terser } from 'rollup-plugin-terser';
import url from 'rollup-plugin-url';
import json from 'rollup-plugin-json';
import serve from 'rollup-plugin-serve';
import replace from 'rollup-plugin-replace';
import bundleSize from 'rollup-plugin-bundle-size';
import postcss from 'rollup-plugin-postcss';
import postcssImport from 'postcss-import';
import copy from 'rollup-plugin-copy-glob';
import del from 'rollup-plugin-delete';
import hash from 'rollup-plugin-hash';
import pkg from './package.json';

const fs = require('fs');

const writeIndexHtmlToBuild = bundleName => {
  let indexHtml = fs.readFileSync('demo/debugger/index.html', 'utf8');
  indexHtml = indexHtml.replace('<%BUNDLE%>', bundleName.replace('build/', ''));
  fs.writeFileSync('build/index.html', indexHtml, 'utf8');
};

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
    extensions: ['.css'],
    plugins: [postcssImport()]
  }),
  resolve({
    preferBuiltins: false
  }),
  babel(babelPluginConfig),
  commonjs(),
  json(),
  url({
    limit: 0, // Always emit file
    include: ['**/*.gb', '**/*.gbc', '**/*.png', '**/*.jpg'],
    emitFiles: true
  })
];

let sourcemap = false;
if (process.env.DEBUGGER && process.env.SERVE) {
  plugins = [
    ...plugins,
    replace({
      delimiters: ['', ''],
      values: {
        '/*ROLLUP_REPLACE_DEBUGGER_DEV': '',
        'ROLLUP_REPLACE_DEBUGGER_DEV*/': ''
      }
    }),
    serve({
      contentBase: ['dist/', 'build/', 'demo/debugger/'],
      port: 8080
    })
  ];
  writeIndexHtmlToBuild('index.iife.js');
  sourcemap = 'inline';
} else {
  // Using whitespace only closure as,
  // It will mangle preact nodeNames, which is used
  // For restoring debugger layout
  plugins = [
    ...plugins,
    // TODO: Compiler gives Out of memory errors in node :(
    /*
    compiler({
      compilation_level: 'WHITESPACE_ONLY'
    }),
    */
    terser({
      mangle: false
    }),
    copy([
      {
        files: 'demo/debugger/assets/**/*',
        dest: 'build/assets'
      },
      {
        files: 'demo/debugger/manifest.json',
        dest: 'build/'
      }
    ]),
    del({
      targets: ['build/bundle.*.js']
    }),
    hash({
      dest: 'build/bundle.[hash].js',
      callback: bundleName => {
        writeIndexHtmlToBuild(bundleName);
      }
    })
  ];
}

plugins = [...plugins, bundleSize()];

// Had to hack around crypto for phosphor
// https://github.com/phosphorjs/phosphor/issues/353
const debuggerBundles = [
  {
    input: 'demo/debugger/index.js',
    output: {
      name: 'WasmBoyBenchmark',
      file: 'build/index.iife.js',
      format: 'iife',
      globals: {
        crypto: 'crypto'
      },
      sourcemap: sourcemap
    },
    external: ['crypto'],
    context: 'window',
    plugins: plugins,
    sourcemap: true
  }
];

export default debuggerBundles;
