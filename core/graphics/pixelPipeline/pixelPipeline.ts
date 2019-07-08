// Implementation of the pixel pipeline
// https://youtu.be/HyzD8pNlpwI?t=2957

export class PixelPipeline {
  // Function to update/run the pixel pipeline
  static update(numberOfCycles: i32): void {
    // NOTE: In the case of scroll,
    // Do the manual memory movement of the current Pixel Pieline Fifo memory.
    // And simply decrease the number of pixels in the fifo.
  }

  // Function to completely reset the PixelPipeline
  // Probably should only do this at the end of a scanline
  static reset(): void {}
}
