// Test the general WasmBoy Library

// Common test functions
const commonTest = require('../common-test');

// Wasm Boy library
const WasmBoy = require('../../dist/wasmboy.wasm.cjs.js').WasmBoy;

// File management
const fs = require('fs');

// Assertion
const assert = require('assert');

// Initialize wasmBoy headless, with a speed option
const WASMBOY_INITIALIZE_OPTIONS = {
  headless: true,
  gameboySpeed: 100.0,
  isGbcEnabled: true
};

// Function for playing WasmBoy for a short amount of time
const playWasmBoy = () => {
  let playResolve = undefined;
  const playPromise = new Promise(resolve => {
    playResolve = resolve;
  });

  WasmBoy.play().then(() => {
    setTimeout(() => {
      WasmBoy.pause().then(() => {
        playResolve();
      });
    }, 100);
  });

  return playPromise;
};

// Path to roms we want to test
const testRomsPath = './test/performance/testroms';
// Read the test rom a a Uint8Array and pass to wasmBoy
const getTestRomArray = () => new Uint8Array(fs.readFileSync(`${testRomsPath}/back-to-color/back-to-color.gbc`));

// Print our version
console.log(`WasmBoy version: ${WasmBoy.getVersion()}`);

describe('WasmBoy Lib', () => {
  // Define our wasmboy instance
  // Not using arrow functions, as arrow function timeouts were acting up
  beforeEach(function(done) {
    // Set a timeout of 5000, takes a while for wasm module to parse
    this.timeout(7500);

    // Reset WasmBoy, and then load the rom
    WasmBoy.config(WASMBOY_INITIALIZE_OPTIONS)
      .then(() => {
        return WasmBoy.loadROM(getTestRomArray());
      })
      .then(() => {
        done();
      });
  });

  it('should be able to save/load state', async () => {
    // Play a snippet of WasmBoy
    await playWasmBoy();

    // Save State
    const saveState = await WasmBoy.saveState();

    // Play a snippet of WasmBoy
    await playWasmBoy();

    // Load State
    await WasmBoy.loadState(saveState);

    // Save State
    const saveStateTwo = await WasmBoy.saveState();

    // Save State should be the same
    const saveStateInternalState = new Uint8Array(saveState.wasmboyMemory.wasmBoyInternalState);
    const saveStateTwoInternalState = new Uint8Array(saveState.wasmboyMemory.wasmBoyInternalState);
    for (let i = 0; i < saveStateInternalState.length; i++) {
      assert(saveStateInternalState[i] === saveStateTwoInternalState[i], true);
    }
  });
});
