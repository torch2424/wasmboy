// Common test functions
const commonTest = require('../common-test');

// Wasm Boy library
const WasmBoyDebug = require('../../dist/wasmboy.debug.cjs.js').WasmBoyDebug;

// File management
const fs = require('fs');

// Assertion
const assert = require('assert');

// Some Timeouts for specified test roms
// Default is 20 seconds, as it runs cpu_instrs in that time
// on my mid-tier 2015 MBP. and cpu_instrs takes a while :)
const TEST_ROM_DEFAULT_TIMEOUT = 25000;
const TEST_ROM_TIMEOUT = {
  cpu_instrs: 17500
};

// Initialize wasmBoy headless, with a speed option
WasmBoyDebug.WasmBoy.config({
    headless: true,
    gameboySpeed: 100.0,
    isGbcEnabled: true
});

const testRomsPath = './test/accuracy/testroms';

commonTest.getDirectories(testRomsPath).forEach((directory) => {
  // Get all test roms for the directory
  const testRoms = commonTest.getAllRomsInDirectory(directory);

  // Create a describe for the directory
  describe(directory, () => {

    // Describe for each test rom
    testRoms.forEach((testRom) => {
      describe(testRom, () => {

        // Default: Wait 60 seconds for every test
        // Stop watch-ed cpu_instructs and it took about 55
        // So lets see how this goes
        let timeToWaitForTestRom = TEST_ROM_DEFAULT_TIMEOUT;

        // Define our wasmboy instance
        // Not using arrow functions, as arrow function timeouts were acting up
        beforeEach(function(done) {

          // Set a timeout of 7500, takes a while for wasm module to parse
          this.timeout(7500);

          // Get our current test rom timeout
          if (TEST_ROM_TIMEOUT[testRom.replace('.gb', '')]) {
            timeToWaitForTestRom = TEST_ROM_TIMEOUT[testRom.replace('.gb', '')];
          }

          // Read the test rom a a Uint8Array and pass to wasmBoy
          const testRomArray = new Uint8Array(fs.readFileSync(`${directory}/${testRom}`));

          commonTest.instantiateWasm().then(() => {
            WasmBoyDebug.WasmBoy.loadROM(testRomArray).then(() => {
              done();
            });
          });
        });

        it('should match the expected output in the .output file. If it does not exist, create the file.', function(done) {

          // Set our timeout
          this.timeout(timeToWaitForTestRom + 2000);

          WasmBoyDebug.WasmBoy.play();

          console.log(`Running the following test rom: ${directory}/${testRom}`)

          setTimeout(() => {

            WasmBoyDebug.WasmBoy.pause().then(() => {
              console.log(`Checking results for the following test rom: ${directory}/${testRom}`);

              const imageDataArray = commonTest.getImageDataFromFrame();

              // Output a gitignored image of the current tests
              const testImagePath = testRom.replace('.gb', '.current.png');
              commonTest.createImageFromFrame(imageDataArray, `${directory}/${testImagePath}`).then(() => {
                // Now compare with the current array if we have it
                const testDataPath = testRom.replace('.gb', '.golden.output');
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

                  const testImagePath = testRom.replace('.gb', '.golden.png');
                  commonTest.createImageFromFrame(imageDataArray, `${directory}/${testImagePath}`).then(() => {
                    done();
                  });
                }
              }).catch(() => {
                console.log('Error creating images...');
                assert.equal(true, false);
                done();
              });
            });
          }, timeToWaitForTestRom);
        });
      });
    });
  });
});
