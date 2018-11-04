import { GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT } from '../constants';

// Exporting this function, as we can use it in the benchmarker
export const getImageDataFromGraphicsFrameBuffer = wasmByteMemory => {
  // Draw the pixels
  // 160x144
  // Split off our image Data
  const imageDataArray = new Uint8ClampedArray(GAMEBOY_CAMERA_HEIGHT * GAMEBOY_CAMERA_WIDTH * 4);
  const rgbColor = new Uint8ClampedArray(3);

  for (let y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
    for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {
      // Each color has an R G B component
      let pixelStart = (y * 160 + x) * 3;

      for (let color = 0; color < 3; color++) {
        rgbColor[color] = wasmByteMemory[pixelStart + color];
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
