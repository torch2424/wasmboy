import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import url from 'rollup-plugin-url';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy-glob';
import babel from 'rollup-plugin-babel';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';
import pkg from './package.json';

const fs = require('fs');

const writeIndexHtmlToBuild = bundleName => {
  let indexHtml = fs.readFileSync('demo/amp/index.html', 'utf8');
  indexHtml = indexHtml.replace('<%BUNDLE%>', bundleName);
  if (!fs.existsSync('build/amp')) {
    fs.mkdirSync('build/amp');
  }
  fs.writeFileSync('build/amp/index.html', indexHtml, 'utf8');
};

const babelPluginConfig = {
  exclude: ['node_modules/**'],
  plugins: [
    ['@babel/plugin-proposal-class-properties'],
    ['@babel/plugin-proposal-object-rest-spread'],
    ['@babel/plugin-transform-react-jsx', { pragma: 'h' }],
    ['@babel/plugin-proposal-export-default-from']
  ]
};

let plugins = [
  resolve(),
  babel(babelPluginConfig),
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
      contentBase: ['dist/', 'build/amp'],
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:8080',
        'AMP-Access-Control-Allow-Source-Origin': 'http://localhost:8080',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Expose-Headers': 'Access-Control-Expose-Headers'
      }
    }),
    writeIndexHtmlToBuild('wasmboy-amp.js')
  ];
} else {
  plugins = [
    ...plugins,
    copy([
      {
        files: 'demo/amp/index.html',
        dest: 'build/amp/'
      }
    ]),
    {
      name: 'callback-plugin',
      generateBundle: () => {
        writeIndexHtmlToBuild('https://torch2424-amp-glitch-express.glitch.me/wasmboy-amp.min.js');
      }
    }
  ];
}

// Plugins for the minified wasmboy-amp
// To fit in amp-script size restriction
let minPlugins = [...plugins, bundleSize()];

const ampBundles = [
  {
    input: 'demo/amp/index.js',
    output: {
      name: 'WasmBoyAmp',
      file: 'build/amp/wasmboy-amp.js',
      format: 'iife'
    },
    plugins
  },
  {
    input: 'demo/amp/index.js',
    output: {
      name: 'WasmBoyAmp',
      file: 'build/amp/wasmboy-amp.min.js',
      format: 'iife'
    },
    plugins: minPlugins
  }
];

export default ampBundles;
