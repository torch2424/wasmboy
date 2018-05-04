// Imports
// requestAnimationFrame() for headless mode
const raf = require('raf');

// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyController } from '../controller/controller';

// Function to render our emulator output
export const render = (wasmboy) => {
  // Don't run if paused
  if (wasmboy.paused) {
    return true;
  }

  // Check if we have frameskip
  let shouldSkipRenderingFrame = false;
  if (wasmboy.frameSkip && wasmboy.frameSkip > 0) {
    wasmboy.frameSkipCounter++;

    if (wasmboy.frameSkipCounter < wasmboy.frameSkip) {
      shouldSkipRenderingFrame = true;
    } else {
      wasmboy.frameSkipCounter = 0;
    }
  }

  // Render the display
  if (!shouldSkipRenderingFrame) {
    WasmBoyGraphics.renderFrame();
  }

  // Play the audio
  if (wasmboy.options.isAudioEnabled) {
    WasmBoyAudio.playAudio(wasmboy.getFPS(), wasmboy.options.gameboyFrameRate > 60);
  }

  // Update our controller
  WasmBoyController.updateController();

  wasmboy.renderId = raf(() => {
    render(wasmboy);
  });
}
