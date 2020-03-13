// Bundle for the iframe embed app

import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import bundleSize from 'rollup-plugin-bundle-size';
import copy from 'rollup-plugin-copy-glob';
import json from 'rollup-plugin-json';

const production = !process.env.SERVE;

const hashGenerator = require('hash-generator');
const bundleHash = hashGenerator(10);
const fs = require('fs');

let jsBundle = 'bundle.js';
let cssBundle = 'bundle.css';
if (production) {
  jsBundle = `bundle.${bundleHash}.js`;
  cssBundle = `bundle.${bundleHash}.css`;
}

const serve = () => {
  let started = false;

  return {
    generateBundle() {
      if (!started) {
        started = true;

        require('child_process').spawn('npm', ['run', 'iframe:serve'], {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true
        });

        setTimeout(() => {
          console.log(`
-------

Click this URL for all embed query params pre-filled:

http://localhost:8080/?rom-name=Tobu%20Tobu%20Girl&play-poster=https://gbhh.avivace.com/database/entries/tobutobugirl/screenshot1.bmp&rom-url=https://gbhh.avivace.com/database/entries/tobutobugirl/tobu.gb

-------
          `);
        }, 500);
      }
    }
  };
};

const writeIndexToBuild = () => {
  return {
    generateBundle() {
      let indexHtml = fs.readFileSync('demo/iframe/index.html', 'utf8');
      indexHtml = indexHtml.replace('%CSS_BUNDLE%', cssBundle);
      indexHtml = indexHtml.replace('%JS_BUNDLE%', jsBundle);
      fs.writeFileSync('build/iframe/index.html', indexHtml, 'utf8');
    }
  };
};

const plugins = [
  svelte({
    dev: !production,
    css: css => {
      css.write(`build/iframe/${cssBundle}`);
    }
  }),
  resolve({
    browser: true,
    dedupe: ['svelte']
  }),
  commonjs(),
  json(),
  !production && serve(),
  !production && livereload('build/iframe'),
  production && terser(),
  bundleSize(),
  production &&
    copy([
      {
        files: 'demo/iframe/assets/**/*',
        dest: 'build/iframe/assets/'
      }
    ]),
  writeIndexToBuild()
];

const iframeBundles = [
  {
    input: 'demo/iframe/index.js',
    output: {
      sourcemap: true,
      format: 'iife',
      name: 'WasmBoyIframe',
      file: `build/iframe/${jsBundle}`
    },
    plugins,
    watch: {
      chokidar: false,
      clearScreen: false
    }
  }
];

export default iframeBundles;
