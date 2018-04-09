// Common test functions
const commonTest = require('../common-test');

// Wasm Boy library
const WasmBoy = require('../../dist/wasmboy.cjs.js').WasmBoy;

// File management
const fs = require('fs');

// Performance.now npm package for ease of use
const now = require("performance-now");

// Markdown table for some coolness and a referencable table by users for which options are best
const markdownTable = require('markdown-table');

// Assertion
const assert = require('assert');

// Number of frames to run per test
const NUMBER_OF_FRAMES = 2000;

// Initialize wasmBoy headless, with a speed option
const WASMBOY_INITIALIZE_OPTIONS = {
    headless: true,
    gameboySpeed: 2.0,
    isGbcEnabled: true
};

// Doing an initialize intialization here, that way we can load roms
WasmBoy.initialize(false, WASMBOY_INITIALIZE_OPTIONS);

// optional performance keys we will be testing
// "Dummy" option will do nothing
const WASMBOY_PERFORMANCE_TESTS = [
  "noPerformanceOptions",
  "audioBatchProcessing",
  "timersBatchProcessing",
  "audioAccumulateSamples",
  "graphicsBatchProcessing",
  "graphicsDisableScanlineRendering"
];

const performanceTablePath = './test/performance/results.md';

const testRomsPath = './test/performance/testroms';

// Create our callback insanity
commonTest.getDirectories(testRomsPath).forEach((directory) => {
  // Get all test roms for the directory
  const testRoms = commonTest.getAllRomsInDirectory(directory);

  let performanceTableString = '';

  // Create a describe for the directory
  describe(directory, () => {

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

          WasmBoy.loadGame(testRomArray).then(() => {
            done();
          });
        });

         // FInally create a describe for each performance option
         WASMBOY_PERFORMANCE_TESTS.forEach((performanceOptionKey, performanceOptionIndex) => {
           describe(performanceOptionKey, () => {

             // Re initilize for each option
             beforeEach(() => {
               // Get a copy our our initializa options
               const clonedInitializeOptions = Object.assign({}, WASMBOY_INITIALIZE_OPTIONS);
               clonedInitializeOptions[performanceOptionKey] = true;

               WasmBoy.initialize(false, clonedInitializeOptions);
             });

             // Descibe what the tesrt should do for the option
             it(`should be able to run ${NUMBER_OF_FRAMES} frames in a timely manner`, function(done) {

               // Add some timeout in case the option takes much longer
               this.timeout(30000);

               const start = now();

               for(let i = 0; i < NUMBER_OF_FRAMES; i++) {
                 WasmBoy.wasmInstance.exports.update();
               }

               const end = now();

               const timeElapsed = (end - start).toFixed(3);

               // Some Spacing
               console.log(' ');
               console.log(`WasmBoy with the option: ${performanceOptionKey} enabled, took ${timeElapsed} milliseconds to run`);

               // Store into our tableObject
               testRomTableObject[performanceOptionKey] = timeElapsed;

               // Draw a screenshot of the frame reached
               const imageDataArray = commonTest.getImageDataFromFrame();

               // Output a gitignored image of the current tests
               let testImagePath = testRom + `.${performanceOptionKey}.png`;
               commonTest.createImageFromFrame(imageDataArray, `${directory}/${testImagePath}`).then(() => {

                 console.log(`Screenshot created at: ${testImagePath}`);

                 // Check if we should finalize the test rom
                 if(performanceOptionIndex >= WASMBOY_PERFORMANCE_TESTS.length - 1) {
                   // Finally convert our test rom table object into a markdown table object
                   const markdownTableArray = [
                     ['Performance Option', 'Time (milliseconds)']
                   ];
                   Object.keys(testRomTableObject).forEach((tableKey) => {
                     markdownTableArray.push([tableKey, testRomTableObject[tableKey]])
                   });

                   performanceTableString += `\n # ${testRom} \n\n ${markdownTable(markdownTableArray)} \n`;

                   // Check if this is the last everything
                   if(testRomIndex >= testRoms.length - 1) {
                     // Finally write to our markdown table file
                     fs.writeFileSync(performanceTablePath, performanceTableString);
                     console.log(`Created a Markdwon table with these results at: ${performanceTablePath}`);
                   }
                 }

                 // Simple asset to signify the test passed
                 assert.equal(true, true);

                 // Some Spacing
                 console.log(' ');

                 done();
               });
             });
           });
         });
      });
    });
  });
});