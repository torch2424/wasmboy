import Promise from "promise-polyfill";

// Performance tips with canvas:
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

// Declare Our Constants
const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;

// Must be greater than 4, or else will have really weird performance
// noticed you get about 4 frames for every 4096 samples
const WASMBOY_MAX_FRAMES_IN_QUEUE = 6;

// Cached Current Frame output location, since call to wasm is expensive
let WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = 0;

class WasmBoyGraphicsService {
  constructor() {
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;

    this.frameQueue = undefined;
    this.frameQueueRenderPromise = undefined;

    this.canvasElement = undefined;
    this.canvasContext = undefined;
    this.canvasImageData = undefined;
  }

  initialize(canvasElement, wasmInstance, wasmByteMemory) {
    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;

    // Initialiuze our cached wasm constants
    WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = this.wasmInstance.exports
      .frameInProgressVideoOutputLocation;

    // Reset our frame queue and render promises
    this.frameQueue = [];

    return new Promise((resolve, reject) => {
      try {
        // Prepare our canvas
        this.canvasElement = canvasElement;
        this.canvasContext = this.canvasElement.getContext("2d");
        this.canvasElement.width = GAMEBOY_CAMERA_WIDTH;
        this.canvasElement.height = GAMEBOY_CAMERA_HEIGHT;
        this.canvasImageData = this.canvasContext.createImageData(
          GAMEBOY_CAMERA_WIDTH,
          GAMEBOY_CAMERA_HEIGHT
        );

        // Add some css for smooth 8-bit canvas scaling
        // https://stackoverflow.com/questions/7615009/disable-interpolation-when-scaling-a-canvas
        // https://caniuse.com/#feat=css-crisp-edges
        this.canvasElement.style = `
          image-rendering: optimizeSpeed;
          image-rendering: -moz-crisp-edges;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: -o-crisp-edges;
          image-rendering: pixelated;
          -ms-interpolation-mode: nearest-neighbor;
        `;

        // Fill the canvas with a blank screen
        // using client width since we are not requiring a width and height oin the canvas
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
        // TODO: Mention respopnsive canvas scaling in the docs
        this.canvasContext.clearRect(
          0,
          0,
          this.canvasElement.width,
          this.canvasElement.height
        );

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Function to render a frame
  // Will add the frame to the frame queue to be rendered
  // Returns the promise from this.drawFrameQueue
  // Which resolves once all frames are rendered
  renderFrame() {
    return new Promise(resolve => {
      // Draw the pixels
      // 160x144
      // Split off our image Data
      const imageDataArray = new Uint8ClampedArray(
        GAMEBOY_CAMERA_HEIGHT * GAMEBOY_CAMERA_WIDTH * 4
      );
      const rgbColor = new Uint8ClampedArray(3);

      for (let y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
        for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {
          // Each color has an R G B component
          let pixelStart = (y * 160 + x) * 3;

          for (let color = 0; color < 3; color++) {
            rgbColor[color] = this.wasmByteMemory[
              WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION + pixelStart + color
            ];
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

      // Add our new imageData
      for (let i = 0; i < imageDataArray.length; i++) {
        this.canvasImageData.data[i] = imageDataArray[i];
      }

      // TODO: Allow changing gameboy background color
      // https://designpieces.com/palette/game-boy-original-color-palette-hex-and-rgb/
      //this.canvasContext.fillStyle = "#9bbc0f";
      //this.canvasContext.fillRect(0, 0, this.canvasElement.clientWidth, this.canvasElement.clientHeight);

      this.canvasContext.clearRect(
        0,
        0,
        GAMEBOY_CAMERA_WIDTH,
        GAMEBOY_CAMERA_HEIGHT
      );
      this.canvasContext.putImageData(this.canvasImageData, 0, 0);

      resolve();
    });
  }
}

export const WasmBoyGraphics = new WasmBoyGraphicsService();
