import Promise from 'promise-polyfill';

// Polyfill for raf for testing in node, defaults to builtin window.requestAnimationFrame
const raf = require('raf');

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

    this.resizeThrottleTimeout = undefined;
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

    // Add to our frame queue
    this.frameQueue.push(imageDataArray);
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
      raf(() => {

        // Get the first frame from the quque
        const imageDataArray = this.frameQueue.shift();

        if (imageDataArray) {
          // Add our new imageData
          for(let i = 0; i < imageDataArray.length; i++) {
            this.canvasImageData.data[i] = imageDataArray[i];
          }
          this.canvasContext.putImageData(this.canvasImageData, 0, 0);
          // drawImage to apply our canvas scale
          this.canvasContext.drawImage(this.canvasElement, 0, 0);
        }

        // Check if there are more frames to be drawn
        if (this.frameQueue.length < 1) {
          if (resolve) {
            resolve();
          }
          this.frameQueueRenderPromise = false;
          return;
        }

        // Check if we need to do any frame skipping from frames being rendered too slow
        if (this.frameQueue.length > WASMBOY_MAX_FRAMES_IN_QUEUE) {
          // Push out extra frames
          const difference = this.frameQueue.length - WASMBOY_MAX_FRAMES_IN_QUEUE;
          this.frameQueue.splice(0, this.frameQueue.length - difference);
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
