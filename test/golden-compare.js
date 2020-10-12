// File management
const fs = require('fs');

// Assertion
const assert = require('assert');

// Common test functions
const commonTest = require('./common-test');

const goldenArrayCompare = (goldenArray, currentArray) => {
  if (goldenArray.length !== currentArray.length) {
    assert.equal(goldenArray.length === currentArray.length, true);
  } else {
    // Find the differences between the two arrays
    const arrayDiff = [];

    for (let i = 0; i < goldenArray.length; i++) {
      if (goldenArray[i] !== currentArray[i]) {
        arrayDiff.push({
          index: i,
          goldenData: goldenArray[i],
          currentData: currentArray[i]
        });
      }
    }

    // Check if we found differences
    if (arrayDiff.length > 0) {
      console.log('Differences found in expected (golden) output:');
      console.log(arrayDiff);
    }
    assert.equal(arrayDiff.length, 0);
  }
};

const goldenFileCompareOrCreate = (goldenFile, currentArray) => {
  if (fs.existsSync(goldenFile)) {
    // Compare the file
    const goldenOuput = fs.readFileSync(goldenFile);

    const goldenArray = JSON.parse(goldenOuput);

    goldenArrayCompare(goldenArray, currentArray);

    // Return so we don't re-create the file
    return;
  }

  // Either we didn't have it because this is the first time running this test rom,
  // or we wanted to update expected output, so we deleted the file
  console.warn(`No output found in: ${goldenFile}, Creating expected (golden) output...`);

  // Create the output file
  // Stringify our image data
  const arrayStringified = JSON.stringify(currentArray);
  fs.writeFileSync(goldenFile, arrayStringified);
};

const goldenImageDataArrayCompare = async (goldenFile, imageDataArray, directory, testRom) => {
  const didCreateGoldenArray = goldenFileCompareOrCreate(goldenFile, imageDataArray);

  if (didCreateGoldenArray) {
    const testImagePath = testRom.replace('.gb', '.golden.png');
    await commonTest.createImageFromFrame(imageDataArray, `${directory}/${testImagePath}`);
  }
};

module.exports = {
  goldenFileCompareOrCreate,
  goldenImageDataArrayCompare
};
