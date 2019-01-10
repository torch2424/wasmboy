// Rollup Config for our main JS Lib

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import typescript from 'rollup-plugin-typescript';
import url from 'rollup-plugin-url';
import json from 'rollup-plugin-json';
import replace from 'rollup-plugin-replace';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';
import pkg from './package.json';

// For Worker URL Loading
const path = require('path');

// Our final bundles we are generating for the lib
const libBundles = [];

const baseLibBundles = [
  {
    input: 'lib/index.js',
    output: {
      name: 'WasmBoy',
      format: 'umd',
      sourcemap: true
    },
    context: 'window'
  },
  {
    input: 'lib/index.js',
    output: {
      name: 'WasmBoy',
      format: 'iife',
      sourcemap: true
    },
    context: 'window'
  },
  {
    input: 'lib/index.js',
    output: {
      format: 'esm',
      sourcemap: true
    },
    context: 'window'
  },
  {
    input: 'lib/index.js',
    output: {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true
    },
    context: 'global'
  }
];

// Plugin Options
const filterImportsWasm = {
  '../../dist/worker/wasmboy.wasm.worker.js': ['default', '*']
};
const filterImportsTs = {
  '../../dist/worker/wasmboy.ts.worker.js': ['default', '*']
};

// Our replace Options for node workers
// https://nodejs.org/api/worker_threads.html
const replaceNodeOptions = {
  delimiters: ['', ''],
  values: {
    '/*ROLLUP_REPLACE_NODE': '',
    'ROLLUP_REPLACE_NODE*/': ''
  }
};

const replaceBrowserOptions = {
  delimiters: ['', ''],
  values: {
    '/*ROLLUP_REPLACE_BROWSER': '',
    'ROLLUP_REPLACE_BROWSER*/': ''
  }
};

const replaceProdBrowserOptions = {
  delimiters: ['', ''],
  values: {
    '/*ROLLUP_REPLACE_PROD_BROWSER': '',
    'ROLLUP_REPLACE_PROD_BROWSER*/': ''
  }
};

const replaceDevBrowserOptions = {
  delimiters: ['', ''],
  values: {
    '/*ROLLUP_REPLACE_DEV_BROWSER': '',
    'ROLLUP_REPLACE_DEV_BROWSER*/': ''
  }
};

const babelPluginConfig = {
  // so Rollup can convert unsupported es6 code to es5
  exclude: ['node_modules/**'],
  plugins: [
    ['@babel/plugin-proposal-class-properties'],
    ['@babel/plugin-proposal-object-rest-spread'],
    [
      'babel-plugin-filter-imports',
      {
        imports: {}
      }
    ]
  ]
};

baseLibBundles.forEach(baseLibBundle => {
  // Start with our plugins
  let plugins = [];

  // Determine our replacements
  if (baseLibBundle.output.format !== 'cjs') {
    plugins.push(replace(replaceBrowserOptions));

    if (process.env.PROD) {
      plugins.push(replace(replaceProdBrowserOptions));
    } else {
      plugins.push(replace(replaceDevBrowserOptions));
    }
  } else {
    plugins.push(replace(replaceNodeOptions));
  }

  // Add standard plugins
  plugins = [
    ...plugins,
    resolve(), // so Rollup can find node modules
    commonjs(),
    json()
  ];

  // For Sourcemapping, only url encode workers if we are building for PROD
  // Using fileName key, to simply point to our workers in dist
  let workerUrlLimit = 0; // Always URL
  if (process.env.PROD) {
    workerUrlLimit = 1000000 * 1024; // Always inline
  }
  plugins = [
    ...plugins,
    url({
      limit: workerUrlLimit,
      include: ['**/*.worker.js'],
      emitFiles: false,
      fileName: 'worker/[name][extname]'
    })
  ];

  // Start pushing bundles onto our lib bundles
  if (process.env.TS) {
    const tsBundle = {
      ...baseLibBundle
    };

    const tsBabelPluginConfig = {
      ...babelPluginConfig
    };
    tsBabelPluginConfig.plugins[2][1].imports = filterImportsWasm;

    tsBundle.plugins = [...plugins, babel(tsBabelPluginConfig), bundleSize()];

    tsBundle.output.file = `dist/wasmboy.ts.${baseLibBundle.output.format}.js`;
    libBundles.push(tsBundle);
  }

  if (process.env.WASM) {
    const wasmBundle = {
      ...baseLibBundle
    };

    const wasmBabelPluginConfig = {
      ...babelPluginConfig
    };
    wasmBabelPluginConfig.plugins[2][1].imports = filterImportsTs;

    wasmBundle.plugins = [...plugins, babel(wasmBabelPluginConfig)];

    if (baseLibBundle.output.format !== 'cjs' && process.env.PROD) {
      wasmBundle.plugins.push(compiler());
    }
    wasmBundle.plugins.push(bundleSize());

    wasmBundle.output.file = `dist/wasmboy.wasm.${baseLibBundle.output.format}.js`;
    libBundles.push(wasmBundle);
  }
});

export default libBundles;
