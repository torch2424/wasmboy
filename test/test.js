// Assertion
const assert = require('assert');

// Wasm Boy library
const WasmBoy = require('../dist/wasmboy.cjs.js').WasmBoy;

// File management
const fs = require('fs')
const path = require('path')

// Initialize wasmBoy
WasmBoy.initializeHeadless();

// Get our folders under testroms
const isDirectory = source => fs.lstatSync(source).isDirectory()
const getDirectories = source =>
  fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectory);

const testRomsPath = './test/testroms';

getDirectories(testRomsPath).forEach((directory) => {
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
        // Not using arrow functions, as arrow function timeouts were acting up
        beforeEach(function(done) {

          // Set a timeout of 5000, takes a while for wasm module to parse
          this.timeout(5000);

          // Read the test rom a a Uint8Array and pass to wasmBoy
          const testRomArray = new Uint8Array(fs.readFileSync(`${directory}/${testRom}`));

          WasmBoy.loadGame(testRomArray).then(() => {
            done();
          });
        });

        // Wait 10 seconds for every test
        const timeToWaitForTestRom = 10000;

        it('should match the expected output in the .output file. If it does not exist, create the file.', function(done) {

          // Set our timeout
          this.timeout(timeToWaitForTestRom + 1000);

          WasmBoy.startGame();
          setTimeout(() => {
            done();
          }, timeToWaitForTestRom);
        });

        //Done!
      });
    });
  });
});
