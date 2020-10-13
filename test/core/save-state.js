// Save state tests on the core

// File management
const fs = require('fs');

// Assertion
const assert = require('assert');

// WasmBoy get Core
const getWasmBoyCore = require('../../dist/core/getWasmBoyWasmCore.cjs.js');

// Common test functions
const commonTest = require('../common-test');

// Golden file handling
const { goldenFileCompareOrCreate } = require('../golden-compare');

// Path to roms we want to test
const testRomsPath = './test/performance/testroms';
// Read the test rom a a Uint8Array and pass to wasmBoy
const getTestRomArray = () => new Uint8Array(fs.readFileSync(`${testRomsPath}/tobutobugirl/tobutobugirl.gb`));

// Define some constants
const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;

describe('WasmBoy Core Save State', () => {
  it('Should be able to repeatedly save and load states', function(done) {
    // Our Save State Memory
    let cartridgeRam = undefined;
    let gameboyMemory = undefined;
    let paletteMemory = undefined;
    let wasmboyState = undefined;

    const asyncTask = async () => {
      // Save Load State loop
      for (let i = 0; i < 400; i++) {
        // Load the Wasm module
        const wasmboyCore = await getWasmBoyCore();
        const wasmboy = wasmboyCore.instance.exports;
        const wasmByteMemoryArray = new Uint8Array(wasmboy.memory.buffer);

        // Load the rom
        wasmByteMemoryArray.set(getTestRomArray(), wasmboy.CARTRIDGE_ROM_LOCATION);

        // Configure the core
        wasmboy.config(
          0, // enableBootRom: i32,
          1, // useGbcWhenAvailable: i32,
          1, // audioBatchProcessing: i32,
          0, // graphicsBatchProcessing: i32,
          0, // timersBatchProcessing: i32,
          0, // graphicsDisableScanlineRendering: i32,
          1, // audioAccumulateSamples: i32,
          0, // tileRendering: i32,
          0, // tileCaching: i32,
          0 // enableAudioDebugging: i32
        );

        if (i > 0) {
          // Load the save state
          wasmByteMemoryArray.set(cartridgeRam, wasmboy.CARTRIDGE_RAM_LOCATION);
          wasmByteMemoryArray.set(gameboyMemory, wasmboy.GAMEBOY_INTERNAL_MEMORY_LOCATION);
          wasmByteMemoryArray.set(paletteMemory, wasmboy.GBC_PALETTE_LOCATION);
          wasmByteMemoryArray.set(wasmboyState, wasmboy.WASMBOY_STATE_LOCATION);

          wasmboy.loadState();
        }

        // Testing input
        if (i === 160) {
          wasmboy.setJoypadState(
            0, // up: i32,
            0, // right: i32,
            0, // down: i32,
            0, // left: i32,
            0, // a: i32,
            0, // b: i32,
            0, // select: i32,
            1 // start: i32
          );
        } else if (i === 220) {
          wasmboy.setJoypadState(
            0, // up: i32,
            0, // right: i32,
            0, // down: i32,
            0, // left: i32,
            0, // a: i32,
            0, // b: i32,
            0, // select: i32,
            1 // start: i32
          );
        } else if (i === 260) {
          wasmboy.setJoypadState(
            0, // up: i32,
            0, // right: i32,
            0, // down: i32,
            0, // left: i32,
            1, // a: i32,
            0, // b: i32,
            0, // select: i32,
            0 // start: i32
          );
        }

        // Run some frames
        wasmboy.executeMultipleFrames(5);
        wasmboy.clearAudioBuffer();

        wasmboy.saveState();

        // Save the state
        cartridgeRam = wasmByteMemoryArray.slice(
          wasmboy.CARTRIDGE_RAM_LOCATION,
          wasmboy.CARTRIDGE_RAM_LOCATION + wasmboy.CARTRIDGE_RAM_SIZE
        );
        gameboyMemory = wasmByteMemoryArray.slice(
          wasmboy.GAMEBOY_INTERNAL_MEMORY_LOCATION,
          wasmboy.GAMEBOY_INTERNAL_MEMORY_LOCATION + wasmboy.GAMEBOY_INTERNAL_MEMORY_SIZE
        );
        paletteMemory = wasmByteMemoryArray.slice(wasmboy.GBC_PALETTE_LOCATION, wasmboy.GBC_PALETTE_LOCATION + wasmboy.GBC_PALETTE_SIZE);
        wasmboyState = wasmByteMemoryArray.slice(
          wasmboy.WASMBOY_STATE_LOCATION,
          wasmboy.WASMBOY_STATE_LOCATION + wasmboy.WASMBOY_STATE_SIZE
        );

        // Output some frames
        if (i % 20 === 0) {
          // Get the frame inspired by common-test.js
          const frameInProgressMemory = wasmByteMemoryArray.slice(wasmboy.FRAME_LOCATION, wasmboy.FRAME_LOCATION + wasmboy.FRAME_SIZE);

          const imageDataArray = [];
          const rgbColor = [];

          for (let y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
            for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {
              // Each color has an R G B component
              let pixelStart = (y * GAMEBOY_CAMERA_WIDTH + x) * 3;

              for (let color = 0; color < 3; color++) {
                rgbColor[color] = frameInProgressMemory[pixelStart + color];
              }

              // Doing graphics using second answer on:
              // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
              // Image Data mapping
              const imageDataIndex = (x + y * GAMEBOY_CAMERA_WIDTH) * 4;

              imageDataArray[imageDataIndex] = rgbColor[0];
              imageDataArray[imageDataIndex + 1] = rgbColor[1];
              imageDataArray[imageDataIndex + 2] = rgbColor[2];
              // Alpha, no transparency
              imageDataArray[imageDataIndex + 3] = 255;
            }
          }

          // Output to a file
          const imageFile = `./test/core/save-state/save-state.${i}.png`;
          await commonTest.createImageFromFrame(imageDataArray, imageFile);
          console.log(`Screenshot created at: ${imageFile}`);

          // Golden Compare Screenshots as we make them
          // Make sure Golden Compare function is parsing JSON correctly as well
          const goldenJSONFile = `./test/core/save-state/save-state.${i}.golden.json`;
          goldenFileCompareOrCreate(goldenJSONFile, imageDataArray);
        }
      }
    };
    asyncTask()
      .then(done)
      .catch(err => {
        throw err;
      });
  });
});
