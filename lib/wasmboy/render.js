// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions

// Imports
// requestAnimationFrame() for headless mode
import raf from 'raf';

// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyController } from '../controller/controller';

// Function to render our emulator output
export function render() {
  // Don't run if paused
  if (this.paused) {
    return true;
  }

  // Check if we have frameskip
  let shouldSkipRenderingFrame = false;
  if (this.frameSkip && this.frameSkip > 0) {
    this.frameSkipCounter++;

    if (this.frameSkipCounter < this.frameSkip) {
      shouldSkipRenderingFrame = true;
    } else {
      this.frameSkipCounter = 0;
    }
  }

  // Render the display
  if (!shouldSkipRenderingFrame) {
    WasmBoyGraphics.renderFrame();
  }

  // Update our controller
  WasmBoyController.updateController();

  this.renderId = raf(() => {
    render.call(this);
  });
}
