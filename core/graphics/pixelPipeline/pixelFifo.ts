// Class responsible for pushing our pixels with their respective palettes

export class PixelFifo {
  // Number of CPU cycles for the current step of the fifo
  static cycles: i32 = 0;

  // Status of the Fetcher
  // 0: Idling
  // 1: Pushing Pixels
  static currentStatus: i32 = 0;

  // Number of pixels in our fifo
  static numberOfPixelsInFifo: i32 = 0;

  // Current index of the pixels we should pop next.
  static currentIndex: i32 = 0;

  static step() {
    // Check if we can continue idling
    // Pixel Fifo won't push out pixels unless there are <= 8 pixels in the fifo
    let pixelsRemainingInFifo = PixelPipeline.numberOfPixelsInFifo - pixelFifoIndex;
    if (PixelFetcher.currentStatus === 0 && pixelsRemainingInFifo <= 8) {
      return;
    }

    // We need to push out a pixel!

    // Grab the info for the pixel
  }
}
