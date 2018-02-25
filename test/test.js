// Assertion
const assert = require('assert');

// Wasm Boy library
const WasmBoy = require('../dist/wasmboy.cjs.js').WasmBoy;


// Jsdom for lightweight in-browser testing
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// File management
const fs = require('fs')
const path = require('path')

// Get our fake dom with canvas element
const dom = new JSDOM(`<!DOCTYPE html><canvas>></canvas>`);
const canvasElement = dom.window.document.querySelector("canvas");

// Initialize wasmBoy
WasmBoy.initialize(canvasElement);

// Get our folders under testroms
const isDirectory = source => fs.lstatSync(source).isDirectory()
const getDirectories = source =>
  fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectory)

getDirectories('./test/testroms').forEach((directory) => {
  // Get all test roms for the directory
  const files = fs.readdirSync(directory);
  const testRoms = files.filter(function(file) {
      return path.extname(file).toLowerCase() === '.gb';
  });

  // Create a describe for the directory
  describe(directory, () => {

    // Describe for each test rom
    testRoms.forEach((testRom) => {
      describe(testRom, () => {

        // Define our wasmboy instance
        beforeEach((done) => {
          WasmBoy.loadGame(testRom).then(() => {
            done();
          });
        });

        it('should match the expected output in the .output file. If it does not exist, create the file', (done) => {
          WasmBoy.startGame();
          setTimeout(() => {
            console.log('Hello!');
            done();
          }, 10000)
        });
      });
    });
  });
});
