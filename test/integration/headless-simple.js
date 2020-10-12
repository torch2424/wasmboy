// Test to make sure a "hello world" of the Headless WasmBoy Works

// Common test functions
const commonTest = require('../common-test');

// Golden file handling
const { goldenFileCompareOrCreate } = require('../golden-compare');

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

// Path to roms we want to test
const testRomsPath = './test/performance/testroms';

// Print our version
console.log(`WasmBoy version: ${WasmBoy.getVersion()}`);

const WasmBoyJoypadState = {
  UP: false,
  RIGHT: false,
  DOWN: false,
  LEFT: false,
  A: false,
  B: false,
  SELECT: false,
  START: false
};

const wait = time => {
  new Promise(resolve => {
    setTimeout(resolve, time);
  });
};

describe('WasmBoy Headless Simple', () => {
  it('Should be able to run a simple headless example', async () => {
    // Wait a little bit to let the wasm module to load?
    // I have this in the other tests. Though, I am sure the config would handle this? :thinking:
    await wait(7500);

    // Read the test rom a a Uint8Array and pass to wasmBoy
    const testRomArray = new Uint8Array(fs.readFileSync(`${testRomsPath}/tobutobugirl/tobutobugirl.gb`));

    // Config and load the ROM
    await WasmBoy.config(WASMBOY_INITIALIZE_OPTIONS);
    await WasmBoy.loadROM(testRomArray);

    // Set our neatural joypad state
    WasmBoy.setJoypadState({
      ...WasmBoyJoypadState
    });

    // Run the WasmBoy for 60 frames, 30 times (30 seconds)
    for (let i = 0; i < 30; i++) {
      await WasmBoy._runWasmExport('executeMultipleFrames', [60]);
    }

    // This should be the tobutobu start menu
    const startMenuImageDataArray = await commonTest.getImageDataFromFrame();
    await commonTest.createImageFromFrame(startMenuImageDataArray, `./test/integration/headless-simple.start-menu.png`);

    // Make sure the start menu can be pressed
    WasmBoy.setJoypadState({
      ...WasmBoyJoypadState,
      START: true
    });

    // Should run us into the level select
    await WasmBoy._runWasmExport('executeMultipleFrames', [1]);

    // Reset the input
    WasmBoy.setJoypadState({
      ...WasmBoyJoypadState
    });

    // Render a few more frames of the level select
    await WasmBoy._runWasmExport('executeMultipleFrames', [120]);

    //  Screenshot the level select
    const levelSelectImageDataArray = await commonTest.getImageDataFromFrame();
    await commonTest.createImageFromFrame(levelSelectImageDataArray, `./test/integration/headless-simple.level-select.png`);

    // Select the Stage
    WasmBoy.setJoypadState({
      ...WasmBoyJoypadState,
      A: true
    });

    // Should run us into the level select
    await WasmBoy._runWasmExport('executeMultipleFrames', [1]);

    // Reset the input
    WasmBoy.setJoypadState({
      ...WasmBoyJoypadState
    });

    // Render a few more frames of the main game
    for (let i = 0; i < 20; i++) {
      await WasmBoy._runWasmExport('executeMultipleFrames', [60]);
    }

    const goldenImageFile = `./test/integration/headless-simple.golden.png`;
    const goldenJSONFile = `./test/integration/headless-simple.golden.json`;

    const imageDataArray = await commonTest.getImageDataFromFrame();

    await commonTest.createImageFromFrame(imageDataArray, goldenImageFile);
    console.log(`Screenshot created at: ${goldenImageFile}`);

    // Do the golden comparison
    goldenFileCompareOrCreate(goldenJSONFile, imageDataArray);
  });
});
