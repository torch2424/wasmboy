// Assertion
const assert = require('assert');

// Wasm Boy library
const WasmBoy = require('../dist/wasmboy.cjs.js').WasmBoy;

// File management
const fs = require('fs');
const path = require('path');

// Image Creation
const PNGImage = require('pngjs-image');

// Define some constants
const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;

// Some Timeouts for specified test roms
const TEST_ROM_TIMEOUT = {
  cpu_instrs: 60000
};

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

        // Default: Wait 60 seconds for every test
        // Stop watch-ed cpu_instructs and it took about 55
        // So lets see how this goes
        let timeToWaitForTestRom = 60000;

        // Define our wasmboy instance
        // Not using arrow functions, as arrow function timeouts were acting up
        beforeEach(function(done) {

          // Set a timeout of 5000, takes a while for wasm module to parse
          this.timeout(5000);

          // Get our current test rom timeout
          if (TEST_ROM_TIMEOUT[testRom.replace('.gb', '')]) {
            timeToWaitForTestRom = TEST_ROM_TIMEOUT[testRom.replace('.gb', '')];
          }

          // Read the test rom a a Uint8Array and pass to wasmBoy
          const testRomArray = new Uint8Array(fs.readFileSync(`${directory}/${testRom}`));

          WasmBoy.loadGame(testRomArray).then(() => {
            done();
          });
        });

        it('should match the expected output in the .output file. If it does not exist, create the file.', function(done) {

          // Set our timeout
          this.timeout(timeToWaitForTestRom + 2000);

          WasmBoy.startGame();

          console.log(`Running the following test rom: ${directory}/${testRom}`)

          setTimeout(() => {
            WasmBoy.pauseGame();

            // Timeout again to let the game pause
            setTimeout(() => {

              console.log(`Checking results for the following test rom: ${directory}/${testRom}`);

              // Going to compare pixel values from the VRAM to confirm tests
              const imageDataArray = [];

              // Taken from: `../lib/wasmboyGraphics.js`
              // Draw the pixels
              // 160x144
              for(let y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
                for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {

                  // Wasm Memory Mapping
                  // See: https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
                  const pixelIndex = 0x008000 + x + (y * GAMEBOY_CAMERA_WIDTH);
                  const color = WasmBoy.wasmByteMemory[pixelIndex];

                  // Doing graphics using second answer on:
                  // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
                  // Image Data mapping
                  const imageDataIndex = (x + (y * GAMEBOY_CAMERA_WIDTH)) * 4;
                  let rgba = [];
                  const alpha = 255;

                  if (color) {
                    if(color === 1) {
                      rgba = [255, 255, 255, alpha];
                    } else if (color === 2) {
                      rgba = [211, 211, 211, alpha];
                    } else if (color === 3) {
                      rgba = [169, 169, 169, alpha];
                    } else {
                      rgba = [0, 0, 0, alpha];
                    }
                  } else {
                    // TODO: Remove this testing code:
                    rgba = [255, 0, 0, 1];
                  }


                  // Fill our imageDataArray
                  for(let i = 0; i < rgba.length; i++) {
                    imageDataArray[imageDataIndex + i] = rgba[i];
                  }
                }
              }

              // Now compare with the current array if we have it
              const testDataPath = testRom.replace('.gb', '.output');
              if (fs.existsSync(`${directory}/${testDataPath}`)) {
                // Compare the file
                const goldenOuput = fs.readFileSync(`${directory}/${testDataPath}`);

                const goldenImageDataArray = JSON.parse(goldenOuput);

                if(goldenImageDataArray.length !== imageDataArray.length) {
                  assert.equal(goldenImageDataArray.length === imageDataArray.length, true);
                } else {
                  // Find the differences between the two arrays
                  const arrayDiff = [];

                  for (let i = 0; i < goldenImageDataArray.length; i++) {
                    if(goldenImageDataArray[i] !== imageDataArray[i]) {
                      arrayDiff.push({
                        index: i,
                        goldenElement: goldenImageDataArray[i],
                        imageDataElement: imageDataArray[i]
                      });
                    }
                  }

                  // Check if we found differences
                  if(arrayDiff.length > 0) {
                    console.log('Differences found in expected (golden) output:')
                    console.log(arrayDiff);
                  }

                  assert.equal(arrayDiff.length, 0);
                }

                done();
              } else {
                // Either we didn't have it because this is the first time running this test rom,
                // or we wanted to update expected output, so we deleted the file
                console.warn(`No output found in: ${directory}/${testDataPath}, Creating expected (golden) output...`);

                // Create the output file
                // Stringify our image data
                const imageDataStringified = JSON.stringify(imageDataArray);
                fs.writeFileSync(`${directory}/${testDataPath}`, imageDataStringified);

                // Also create a nice little image to see what we are currently testing against
                // https://www.npmjs.com/package/pngjs-image
                const image = PNGImage.createImage(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);

                // Write our pixel values
                for (let i = 0; i < imageDataArray.length - 4; i = i + 4) {

                  // Since 4 indexes represent 1 pixels. divide i by 4
                  const pixelIndex = i / 4;

                  // Get our y value from i
                  const y = Math.floor(pixelIndex / GAMEBOY_CAMERA_WIDTH);

                  // Get our x value from i
                  const x = pixelIndex % GAMEBOY_CAMERA_WIDTH;

                  image.setAt(x, y, {
                    red: imageDataArray[i],
                    green: imageDataArray[i + 1],
                    blue: imageDataArray[i + 2],
                    alpha: imageDataArray[i + 3],
                  });
                }

                const testImagePath = testRom.replace('.gb', '.png');
                image.writeImage(`${directory}/${testImagePath}`, function (err) {
                    if (err) throw err;
                    done();
                });
              }
            }, 500);
          }, timeToWaitForTestRom);
        });
      });
    });
  });
});
