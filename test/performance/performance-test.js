// Common test functions
const commonTest = require('../common-test');

// Wasm Boy library
const WasmBoy = require('../../dist/wasmboy.wasm.cjs.js').WasmBoy;

// File management
const fs = require('fs');

// Performance.now npm package for ease of use
const now = require('performance-now');

// Markdown table for some coolness and a referencable table by users for which options are best
const markdownTable = require('markdown-table');

// Assertion
const assert = require('assert');

// Number of frames to run per test
const NUMBER_OF_FRAMES = 1250;
const PERFORMANCE_OPTION_TIMEOUT = 35000;

// Iterations of Performance time options
// Please note, we do not re-initialize between iterations.
// So for example, with NUMBER_OF_FRAMES = 1250 and PERFORMANCE_OPTION_ITERATIONS = 2,
// Would be the same as: NUMBER_OF_FRAMES = 2500 and PERFORMANCE_OPTION_ITERATIONS = 1,
// Except this makes an average of all iterations, but the frames aren't the same,
// Which may be better or worse?
const PERFORMANCE_OPTION_ITERATIONS = 2;

// Initialize wasmBoy headless, with a speed option
const WASMBOY_INITIALIZE_OPTIONS = {
  headless: true,
  gameboySpeed: 100.0,
  isGbcEnabled: true
};

// Doing an initialize intialization here, that way we can load roms
WasmBoy.config(WASMBOY_INITIALIZE_OPTIONS);

// optional performance keys we will be testing
// "Dummy" option will do nothing
const WASMBOY_PERFORMANCE_TESTS = [
  ['noPerformanceOptions'],
  ['tileRendering'],
  ['tileCaching'],
  ['tileRendering', 'tileCaching'],
  ['audioBatchProcessing'],
  ['audioAccumulateSamples'],
  ['audioBatchProcessing', 'audioAccumulateSamples'],
  ['timersBatchProcessing'],
  ['graphicsBatchProcessing'],
  ['graphicsDisableScanlineRendering']
];

const PERFORMANCE_TABLE_HEADER = `
# WasmBoy Performance Options Table

This is a Auto-generated file to give users some understanding of expected performance gains of each performance option.

**NOTE:** this is not a representation of emulator speed, but rather an easy way to determine for users and developers how much speed a performance option offers.

'noPerformanceOptions' represents what the emulator runs as when no options are toggled on while running the emulator.

This currently runs ${NUMBER_OF_FRAMES} frames of each rom, and averages the results of ${PERFORMANCE_OPTION_ITERATIONS} iterations of running the number of frames.

The Options passed into the emulator on each run are:

\`\`\`
${JSON.stringify(WASMBOY_INITIALIZE_OPTIONS, null, 4)}
\`\`\`

`;

const performanceTablePath = './test/performance/results.md';

const testRomsPath = './test/performance/testroms';

// Start Main tests
let performanceTableString = PERFORMANCE_TABLE_HEADER;

const writePerformanceTable = () => {
  // Finally write to our markdown table file
  fs.writeFileSync(performanceTablePath, performanceTableString);
  console.log(' ');
  console.log(`Created a Markdown table with these results at: ${performanceTablePath}`);
  console.log(' ');
};

// Print our version
console.log(`WasmBoy version: ${WasmBoy.getVersion()}`);

// Create our callback insanity
const directories = commonTest.getDirectories(testRomsPath);
directories.forEach((directory, directoryIndex) => {
  // Get all test roms for the directory
  const testRoms = commonTest.getAllRomsInDirectory(directory);

  // Create a describe for the directory
  describe(directory, () => {
    // Check if we should write the performance table
    if (directoryIndex >= directories.length - 1 && (!testRoms || testRoms.length <= 0)) {
      writePerformanceTable();
    }

    // Describe for each test rom
    testRoms.forEach((testRom, testRomIndex) => {
      const testRomTableObject = {};

      describe(testRom, () => {
        // Define our wasmboy instance
        // Not using arrow functions, as arrow function timeouts were acting up
        beforeEach(function(done) {
          // Set a timeout of 5000, takes a while for wasm module to parse
          this.timeout(5000);

          // Read the test rom a a Uint8Array and pass to wasmBoy
          const testRomArray = new Uint8Array(fs.readFileSync(`${directory}/${testRom}`));

          WasmBoy.loadROM(testRomArray).then(() => {
            done();
          });
        });

        // Finally create a describe for each performance option
        WASMBOY_PERFORMANCE_TESTS.forEach((performanceOptionKeys, performanceOptionIndex) => {
          describe(performanceOptionKeys.join(', '), () => {
            // Re initilize for each option
            beforeEach(function(done) {
              // Set a timeout of 2000, takes a while for wasm module to parse
              this.timeout(2000);

              // Get a copy our our initialize options
              const clonedInitializeOptions = Object.assign({}, WASMBOY_INITIALIZE_OPTIONS);
              performanceOptionKeys.forEach(optionKey => {
                clonedInitializeOptions[optionKey] = true;
              });

              WasmBoy.reset(clonedInitializeOptions).then(() => {
                done();
              });
            });

            // Descibe what the tesrt should do for the option
            it(`should be able to run ${NUMBER_OF_FRAMES} frames in a timely manner`, function(done) {
              const runFramesTask = async () => {
                // Add some timeout in case the option takes much longer
                this.timeout(PERFORMANCE_OPTION_TIMEOUT * PERFORMANCE_OPTION_ITERATIONS);

                const iterationTimes = [];

                for (let iterations = 0; iterations < PERFORMANCE_OPTION_ITERATIONS; iterations++) {
                  const start = now();

                  await WasmBoy._runWasmExport('executeMultipleFrames', [NUMBER_OF_FRAMES], 20000);

                  const end = now();

                  const iterationTimeElapsed = (end - start).toFixed(3);
                  iterationTimes.push(iterationTimeElapsed);

                  console.log(`Finished Iteration #${iterations}`);
                }

                let totalTime = 0;
                iterationTimes.forEach(time => {
                  totalTime += parseFloat(time);
                });
                let timeElapsed = 0;
                if (iterationTimes.length > 0) {
                  timeElapsed = totalTime / iterationTimes.length;
                }

                // Some Spacing
                console.log(' ');
                console.log(
                  `WasmBoy with the option(s): ${performanceOptionKeys.join(', ')} enabled, ` + `took ${timeElapsed} milliseconds to run`
                );
                console.log(' ');

                // Store into our tableObject
                testRomTableObject[performanceOptionKeys.join(', ')] = timeElapsed;

                // Draw a screenshot of the frame reached
                const imageDataArray = await commonTest.getImageDataFromFrame();
                // Output a gitignored image of the current tests
                let testImagePath = testRom + `.${performanceOptionKeys.join('.')}.png`;

                await commonTest.createImageFromFrame(imageDataArray, `${directory}/${testImagePath}`);
                console.log(`Screenshot created at: ${testImagePath}`);

                // Check if we should finalize the test rom
                if (performanceOptionIndex >= WASMBOY_PERFORMANCE_TESTS.length - 1) {
                  // Finally convert our test rom table object into a markdown table object
                  const markdownTableArray = [['Performance Option(s)', 'Time (milliseconds)']];
                  Object.keys(testRomTableObject).forEach(tableKey => {
                    markdownTableArray.push([tableKey, testRomTableObject[tableKey]]);
                  });

                  performanceTableString += `\n ## ${testRom} \n\n ${markdownTable(markdownTableArray)} \n`;

                  // Check if this is the last everything
                  if (testRomIndex >= testRoms.length - 1 && directoryIndex >= directories.length - 1) {
                    writePerformanceTable();
                  }
                }

                // Simple asset to signify the test passed
                assert.equal(true, true);

                // Some Spacing
                console.log(' ');

                done();
              };
              runFramesTask();
            });
          });
        });
      });
    });
  });
});
