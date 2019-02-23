// Wasm Boy library
const WasmBoy = require('../dist/wasmboy.wasm.cjs.js').WasmBoy;

// Image Creation
const PNGImage = require('pngjs-image');

// File management
const fs = require('fs');
const path = require('path');
const recursive = require('recursive-readdir-sync');

// Define some constants
const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;

// Function to get our RGB image data array from our frame
const getImageDataFromFrame = async () => {
  // Get our output frame
  const frameInProgressVideoOutputLocation = await WasmBoy._getWasmConstant('FRAME_LOCATION');
  const frameInProgressMemory = await WasmBoy._getWasmMemorySection(
    frameInProgressVideoOutputLocation,
    frameInProgressVideoOutputLocation + GAMEBOY_CAMERA_HEIGHT * GAMEBOY_CAMERA_WIDTH * 3 + 1
  );

  // Going to compare pixel values from the VRAM to confirm tests
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

  return imageDataArray;
};

// Function to create an image from output
const createImageFromFrame = (imageDataArray, outputPath) => {
  return new Promise((resolve, reject) => {
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
        alpha: imageDataArray[i + 3]
      });
    }

    image.writeImage(outputPath, function(err) {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
};

// Get our folders under testroms
const isDirectory = source => fs.lstatSync(source).isDirectory();
const getDirectories = source =>
  fs
    .readdirSync(source)
    .map(name => path.join(source, name))
    .filter(isDirectory);

const getAllRomsInDirectory = directory => {
  // Get all test roms for the directory
  const files = recursive(directory);
  const testRoms = files
    .filter(function(file) {
      const fileExt = path.extname(file).toLowerCase();
      return fileExt === '.gb' || fileExt === '.gbc';
    })
    .map(file => {
      return file.replace(directory + '/', '');
    });

  return testRoms;
};

module.exports = {
  getImageDataFromFrame: getImageDataFromFrame,
  createImageFromFrame: createImageFromFrame,
  isDirectory: isDirectory,
  getDirectories: getDirectories,
  getAllRomsInDirectory: getAllRomsInDirectory
};
