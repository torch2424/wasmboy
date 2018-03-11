import Promise from 'promise-polyfill';

// Declare Our Constants
const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;
const WASMBOY_MEMORY_CURRENT_RENDERED_FRAME = 0x028400;

class WasmBoyGraphicsService {
  constructor() {
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;

    this.canvasElement = undefined;
    this.canvasContext = undefined;
    this.canvasImageData = undefined;

    this.resizeThrottleTimeout = undefined;
  }

  initialize(canvasElement, wasmInstance, wasmByteMemory) {
    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;

    return new Promise((resolve, reject) => {
      try {
        // Prepare our canvas
        this.canvasElement = canvasElement;
        this.canvasContext = this.canvasElement.getContext('2d');
        this.canvasImageData = this.canvasContext.createImageData(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);

        // Fill the canvas with a blank screen
        // using client width since we are not requiring a width and height oin the canvas
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
        // TODO: Mention respopnsive canvas scaling in the docs
        this.canvasContext.clearRect(0, 0, this.canvasElement.clientWidth, this.canvasElement.clientHeight);
        this.canvasContext.fillStyle = '#000000';
        this.canvasContext.fillRect(0, 0, this.canvasElement.clientWidth, this.canvasElement.clientHeight);

        // Scale the canvas
        this.scaleCanvas();

        // Listen for window resize events for scaling
        window.addEventListener("resize", () => {
          if (this.resizeThrottleTimeout) {
            // Cancel the resize
            clearTimeout(this.resizeThrottleTimeout);
          }

          this.resizeThrottleTimeout = setTimeout(() => {
            this.scaleCanvas();
          }, 100);
        });

        resolve();
      } catch(error) {
        reject(error);
      }
    });
  }

  // Function to scale the canvas to look nice and crisp
  scaleCanvas() {

    // Reset scale
    this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);

    // Need to set the attributes to match any css
    // https://stackoverflow.com/questions/2588181/canvas-is-stretched-when-using-css-but-normal-with-width-height-properties
    this.canvasElement.width = this.canvasElement.clientWidth;
    this.canvasElement.height = this.canvasElement.clientHeight;

    // Scale the canvas to the offsetWidth
    // Which will return the calculated width from css
    this.canvasContext.scale(this.canvasElement.clientWidth / GAMEBOY_CAMERA_WIDTH, this.canvasElement.clientHeight / GAMEBOY_CAMERA_HEIGHT);

    // Stop the image blurring, this must be called after the scale
    // https://stackoverflow.com/questions/18547042/resizing-a-canvas-image-without-blurring-it
    this.canvasContext.imageSmoothingEnabled = false;
  }

  renderFrame() {
    // Draw the pixels
    // 160x144
    // Split off our image Data
    const imageDataArray = [];

    for(let y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
      for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {


        const pixelIndex = WASMBOY_MEMORY_CURRENT_RENDERED_FRAME + x + (y * GAMEBOY_CAMERA_WIDTH);
        const color = this.wasmByteMemory[pixelIndex];

        // Doing graphics using second answer on:
        // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
        // Image Data mapping
        const imageDataIndex = (x + (y * GAMEBOY_CAMERA_WIDTH)) * 4;
        let rgba = [];
        const alpha = 255;

        if (color) {
          if(color === 1) {
            rgba = [255, 255, 255, alpha];
          } else if (color === 2) {
            rgba = [211, 211, 211, alpha];
          } else if (color === 3) {
            rgba = [169, 169, 169, alpha];
          } else {
            rgba = [0, 0, 0, alpha];
          }
        } else {
          // TODO: Remove this testing code:
          rgba = [255, 0, 0, 1];
        }

        for(let i = 0; i < rgba.length; i++) {
          imageDataArray[imageDataIndex + i] = rgba[i];
        }
      }
    }

    // Add our new imageData
    for(let i = 0; i < imageDataArray.length; i++) {
      this.canvasImageData.data[i] = imageDataArray[i];
    }
    this.canvasContext.putImageData(this.canvasImageData, 0, 0);
    // drawImage to apply our canvas scale
    this.canvasContext.drawImage(this.canvasElement, 0, 0);
  }
}

export const WasmBoyGraphics = new WasmBoyGraphicsService();
