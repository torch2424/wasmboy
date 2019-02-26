import { GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT } from '../constants';

// Thanks MaxGraey for the optimization!

// Exporting this function, as we can use it in the benchmarker
export function getImageDataFromGraphicsFrameBuffer(wasmByteMemory) {
  // Draw the pixels
  // 160x144

  // Split off our image Data
  // Even though it is not cheap to create buffers,
  // We need to create this everytime, as it will be transferred back to the
  // main thread, thus removing this worker / access to this buffer.
  const imageDataArray = new Uint8ClampedArray(GAMEBOY_CAMERA_HEIGHT * GAMEBOY_CAMERA_WIDTH * 4);

  for (let y = 0; y < GAMEBOY_CAMERA_HEIGHT; ++y) {
    let stride1 = y * (GAMEBOY_CAMERA_WIDTH * 3);
    let stride2 = y * (GAMEBOY_CAMERA_WIDTH * 4);
    for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; ++x) {
      // Each color has an R G B component
      const pixelStart = stride1 + x * 3;

      const imageDataIndex = stride2 + (x << 2);

      imageDataArray[imageDataIndex + 0] = wasmByteMemory[pixelStart + 0];
      imageDataArray[imageDataIndex + 1] = wasmByteMemory[pixelStart + 1];
      imageDataArray[imageDataIndex + 2] = wasmByteMemory[pixelStart + 2];

      // Alpha, no transparency
      imageDataArray[imageDataIndex + 3] = 255;
    }
  }
  return imageDataArray;
}
