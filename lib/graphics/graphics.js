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
  }

  initialize(canvasElement, wasmInstance, wasmByteMemory) {
    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;

    return new Promise((resolve, reject) => {
      try {
        this.canvasElement = canvasElement;
        this.canvasContext = this.canvasElement.getContext('2d');
        this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        this.canvasContext.fillStyle = '#000000';
        this.canvasContext.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        this.canvasImageData = this.canvasContext.createImageData(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);

        this.scaleCanvas();

        resolve();
      } catch(error) {
        reject(error);
      }
    });
  }

  // Function to scale the canvas to look nice and crisp
  scaleCanvas() {

    // Scale the canvas
    // https://stackoverflow.com/questions/18547042/resizing-a-canvas-image-without-blurring-it
    this.canvasContext.imageSmoothingEnabled = false;

    // Reset scale
    this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);

    console.log(this.canvasElement.clientWidth);
    console.log(this.canvasElement.clientHeight);

    // Scale the canvas to the offsetWidth
    // Which will return the calculated width from css
    this.canvasContext.scale(this.canvasElement.width / GAMEBOY_CAMERA_WIDTH, this.canvasElement.height / GAMEBOY_CAMERA_HEIGHT);
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
