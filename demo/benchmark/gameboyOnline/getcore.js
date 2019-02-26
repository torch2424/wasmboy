// Wrapper get core to match the wasmboy api for the benchmark

// A lot of logic from: https://github.com/taisel/GameBoy-Online/blob/master/js/GameBoyIO.js

import GetGameBoy from './GameBoyCore';

const SCREEN_WIDTH = 160;
const SCREEN_HEIGHT = 144;

export default async function getGameBoyOnlineCore() {
  // Create an array for our RGB buffer, that wasmboy will convert to rgba
  const ROMMemory = new Uint8ClampedArray(0x7e0400);

  // Create an array for our RGB buffer, that wasmboy will convert to rgba
  const rgbMemory = new Uint8ClampedArray(SCREEN_HEIGHT * SCREEN_WIDTH * 3);

  let gameboy;

  const core = {
    byteMemory: ROMMemory,
    instance: {
      exports: {
        CARTRIDGE_ROM_LOCATION: 0,
        FRAME_LOCATION: 0,
        FRAME_SIZE: 0x016c00,
        config: () => {
          // Create a hidden canvas for gameboy online
          const canvas = document.createElement('canvas');

          gameboy = GetGameBoy(canvas, core.byteMemory);

          // Now that we have our rom loaded, simply swap the byte memory for our purposes ;)
          core.byteMemory = rgbMemory;
        },
        executeFrame: () => {
          gameboy.stopEmulator &= 1;

          // GB Online runs twice, for every frame it seems?
          gameboy.run();
          gameboy.run();

          // Get the cancas image data, and put into our byte memory
          // Output Graphics (normally here, but doing later for perf)
          // Convert the graphics memory to our rgb Memory
          for (let i = 0; i < SCREEN_HEIGHT * SCREEN_WIDTH; i++) {
            let rgbIndex = i * 3;
            let rgbaIndex = i * 4;

            rgbMemory[rgbIndex + 0] = gameboy.canvasBuffer.data[rgbaIndex + 0];
            rgbMemory[rgbIndex + 1] = gameboy.canvasBuffer.data[rgbaIndex + 1];
            rgbMemory[rgbIndex + 2] = gameboy.canvasBuffer.data[rgbaIndex + 2];
          }
        }
      }
    }
  };

  return core;
}
