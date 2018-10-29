import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import typescript from 'rollup-plugin-typescript';
import url from 'rollup-plugin-url';
import replace from 'rollup-plugin-replace';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import bundleSize from 'rollup-plugin-bundle-size';
import pkg from './package.json';

// Fs for some extra needed files
const fs = require('fs');

// Our base plugins needed by every bundle type
const plugins = [
  resolve(), // so Rollup can find node modules
  babel({
    // so Rollup can convert unsupported es6 code to es5
    exclude: ['node_modules/**'],
    plugins: ['@babel/plugin-proposal-class-properties', '@babel/plugin-proposal-object-rest-spread']
  }),
  commonjs() // so Rollup can convert node module to an ES module
];

// Url inline replacements
const urlPlugins = [
  url({
    limit: 1000000 * 1024, // Always inline
    include: ['**/*.wasm']
  }),
  url({
    limit: 1000000 * 1024, // Always inline
    include: ['**/*.worker.js'],
    // Don't emit files, this will replace the worker build output
    emitFiles: false
  })
];

// Our replace Options for node workers
// https://nodejs.org/api/worker_threads.html
const replaceNodeOptions = {
  delimiters: ['', ''],
  values: {
    '/*ROLLUP_REPLACE_NODE': '',
    'ROLLUP_REPLACE_NODE*/': ''
  }
};
// Plugins specific to running in a node runtime
const nodePlugins = [replace(replaceNodeOptions), ...urlPlugins, ...plugins, bundleSize()];

const replaceBrowserOptions = {
  delimiters: ['', ''],
  values: {
    '/*ROLLUP_REPLACE_BROWSER': '',
    'ROLLUP_REPLACE_BROWSER*/': ''
  }
};
// Plugins specific to running in a node runtime
const browserPlugins = [replace(replaceBrowserOptions), ...urlPlugins, ...plugins];
if (process.env.PROD) {
  browserPlugins.push(compiler());
}
browserPlugins.push(bundleSize());

// Define our worker outputs
const workerEntryPoints = [
  'wasmboy/worker/wasmboy.worker.js',
  'graphics/worker/graphics.worker.js',
  'audio/worker/audio.worker.js',
  'controller/worker/controller.worker.js',
  'memory/worker/memory.worker.js'
];

const workerPlugins = [resolve()];
if (process.env.TS) {
  workerPlugins.push(
    babel({
      // so Rollup can convert unsupported es6 code to es5
      exclude: ['node_modules/**'],
      plugins: [
        ['@babel/plugin-proposal-class-properties'],
        ['@babel/plugin-proposal-object-rest-spread'],
        [
          'babel-plugin-filter-imports',
          {
            imports: {
              './instantiate': ['instantiateWasm']
            }
          }
        ]
      ]
    })
  );
} else {
  workerPlugins.push(
    babel({
      // so Rollup can convert unsupported es6 code to es5
      exclude: ['node_modules/**'],
      plugins: [
        ['@babel/plugin-proposal-class-properties'],
        ['@babel/plugin-proposal-object-rest-spread'],
        [
          'babel-plugin-filter-imports',
          {
            imports: {
              './instantiate': ['instantiateTs']
            }
          }
        ]
      ]
    })
  );
}
workerPlugins.push(commonjs());
workerPlugins.push(bundleSize());

let workerSourceMaps = 'inline';
if (process.env.PROD) {
  workerSourceMaps = false;
}

const coreTsBundles = [
  {
    input: './core/index.ts',
    output: {
      banner: () => {
        return fs.readFileSync('./core/portable/wasmMock.js', 'utf8');
      },
      file: `dist/core.esm.js`,
      format: 'esm',
      name: 'WasmBoyCore',
      sourcemap: 'inline'
    },
    plugins: [
      typescript({
        tsconfig: './core/tsconfig.json'
      }),
      bundleSize()
    ]
  }
];

const workerBundles = [];
workerEntryPoints.forEach(workerEntryPoint => {
  workerBundles.push({
    input: `lib/${workerEntryPoint}`,
    output: {
      file: `dist/${workerEntryPoint}`,
      format: 'iife',
      name: 'WasmBoyWorker',
      sourcemap: workerSourceMaps
    },
    context: 'self',
    plugins: workerPlugins
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
    plugins: browserPlugins
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
    plugins: browserPlugins
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

let exports;
if (process.env.TS) {
  exports = [...coreTsBundles, ...workerBundles, ...libBundles];
} else {
  exports = [...workerBundles, ...libBundles];
}

export default exports;
