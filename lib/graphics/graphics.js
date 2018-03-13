import Promise from 'promise-polyfill';

// Performance tips with canvas:
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

// Declare Our Constants
const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;
const WASMBOY_MEMORY_CURRENT_RENDERED_FRAME = 0x028400;
// Must be greater than 4, or else will have really weird performance
// noticed you get about 4 frames for every 4096 samples
const WASMBOY_MAX_FRAMES_IN_QUEUE = 6;

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
    // Reset our frame queue and render promises
    this.frameQueue = [];

    return new Promise((resolve, reject) => {
      try {
        // Prepare our canvas
        this.canvasElement = canvasElement;
        // Disable alpha from performance tips, may want for gameboy colors
        this.canvasContext = this.canvasElement.getContext('2d', {alpha: false});
        this.canvasElement.width = GAMEBOY_CAMERA_WIDTH;
        this.canvasElement.height = GAMEBOY_CAMERA_HEIGHT;
        this.canvasImageData = this.canvasContext.createImageData(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);

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
        this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

        resolve();
      } catch(error) {
        reject(error);
      }
    });
  }

  // Function to render a frame
  // Will add the frame to the frame queue to be rendered
  // Returns the promise from this.drawFrameQueue
  // Which resolves once all frames are rendered
  renderFrame() {
    this.addFrameToFrameQueue();
    return this.drawFrameQueue();
  }

  // Function to grtab the frame from memory and add to our frame queue
  // performing here to avoid some weird parantheses in renderFrame()
  // and to allow it to be passed freely
  addFrameToFrameQueue() {
    // Draw the pixels
    // 160x144
    // Split off our image Data
    const imageDataArray = new Uint8ClampedArray(GAMEBOY_CAMERA_HEIGHT * GAMEBOY_CAMERA_WIDTH * 4);

    for(let y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
      for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {

        const color = this.wasmByteMemory[
          WASMBOY_MEMORY_CURRENT_RENDERED_FRAME + x + (y * GAMEBOY_CAMERA_WIDTH)
        ];

        // Doing graphics using second answer on:
        // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
        // Image Data mapping
        const imageDataIndex = (x + (y * GAMEBOY_CAMERA_WIDTH)) * 4;

        // TODO: Allow other colors

        // The original gameboy had 4 colors going to use alpha to represent each
        let alpha = 0;

        if(color === 1) {
          // Alpha already set
        } else if (color === 2) {
          // 85 33% transparent
          alpha = 85;
        } else if (color === 3) {
          // 169 66% transparent
          alpha = 169;
        } else {
          // 255 no transparency
          alpha = 255;
        }

        imageDataArray[imageDataIndex] = 0;
        imageDataArray[imageDataIndex + 1] = 0;
        imageDataArray[imageDataIndex + 2] = 0;
        imageDataArray[imageDataIndex + 3] = alpha;
      }
    }

    // Add to our frame queue
    this.frameQueue.push(imageDataArray);

    // Check if we need to do any frame skipping from frames being rendered too slow
    if (this.frameQueue.length > WASMBOY_MAX_FRAMES_IN_QUEUE) {
      // Push out extra frames
      const difference = this.frameQueue.length - WASMBOY_MAX_FRAMES_IN_QUEUE;
      this.frameQueue.splice(0, this.frameQueue.length - difference);
    }
  }

  // Function to shift a frame from the frame queue
  // And draw to the canvas. Will keep drawing while
  // there are frames in the queue
  // Returns a promise once all frames are drawn
  drawFrameQueue() {

    if (this.frameQueueRenderPromise) {
      return this.frameQueueRenderPromise;
    }

    // Define a loop to continously render frames
    let renderFrameLoop;
    renderFrameLoop = (resolve) => {
      requestAnimationFrame(() => {

        // Get the first frame from the quque
        const imageDataArray = this.frameQueue.shift();

        if (imageDataArray) {
          // Add our new imageData
          for(let i = 0; i < imageDataArray.length; i++) {
            this.canvasImageData.data[i] = imageDataArray[i];
          }

          // TODO: Allow changing gameboy background color
          // https://designpieces.com/palette/game-boy-original-color-palette-hex-and-rgb/
          //this.canvasContext.fillStyle = "#9bbc0f";
          //this.canvasContext.fillRect(0, 0, this.canvasElement.clientWidth, this.canvasElement.clientHeight);

          this.canvasContext.clearRect(0, 0, GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);
          this.canvasContext.putImageData(this.canvasImageData, 0, 0);
        }

        // Check if there are more frames to be drawn
        if (this.frameQueue.length < 1) {
          if (resolve) {
            resolve();
          }
          this.frameQueueRenderPromise = false;
          return;
        }

        // Keep rendering frames
        renderFrameLoop(resolve);
      });
    }

    this.frameQueueRenderPromise = new Promise((resolve) => {
      renderFrameLoop(resolve);
    });

    return this.frameQueueRenderPromise;
  }
}

export const WasmBoyGraphics = new WasmBoyGraphicsService();
