import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import './backgroundMap.css';

// To Stop memory leaks, see disassembler
const updateBackgroundMapTask = async (canvasElement, canvasContext, canvasImageData) => {
  // Draw our background map
  await WasmBoy._runWasmExport('drawBackgroundMapToWasmMemory', [1]);

  // Get our background map location constant
  const backgroundMapLocation = await WasmBoy._getWasmConstant('BACKGROUND_MAP_LOCATION');
  const backgroundMapMemory = await WasmBoy._getWasmMemorySection(backgroundMapLocation, backgroundMapLocation + 256 * 256 * 3);

  const imageDataArray = new Uint8ClampedArray(256 * 256 * 4);
  const rgbColor = new Uint8ClampedArray(3);

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      // Each color has an R G B component
      let pixelStart = (y * 256 + x) * 3;

      for (let color = 0; color < 3; color++) {
        rgbColor[color] = backgroundMapMemory[pixelStart + color];
      }

      // Doing graphics using second answer on:
      // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
      // Image Data mapping
      const imageDataIndex = (x + y * 256) * 4;

      imageDataArray[imageDataIndex] = rgbColor[0];
      imageDataArray[imageDataIndex + 1] = rgbColor[1];
      imageDataArray[imageDataIndex + 2] = rgbColor[2];
      // Alpha, no transparency
      imageDataArray[imageDataIndex + 3] = 255;
    }
  }

  // Add our new imageData
  for (let i = 0; i < imageDataArray.length; i++) {
    canvasImageData.data[i] = imageDataArray[i];
  }

  canvasContext.beginPath();
  canvasContext.clearRect(0, 0, 256, 256);
  canvasContext.putImageData(canvasImageData, 0, 0);

  // Draw a semi Transparent camera thing over the imagedata
  // https://www.html5canvastutorials.com/tutorials/html5-canvas-rectangles/
  // Get the scroll X and Y
  const scrollMemoryRegistersStart = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff42]);
  const scrollMemoryRegistersEnd = (await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff43])) + 1;

  const scrollMemoryRegisters = await WasmBoy._getWasmMemorySection(scrollMemoryRegistersStart, scrollMemoryRegistersEnd);

  const scrollX = scrollMemoryRegisters[1];
  const scrollY = scrollMemoryRegisters[0];

  const lineWidth = 2;
  const strokeStyle = 'rgba(173, 140, 255, 200)';

  // Need to wrap by the four corners, not the 4 edges

  // Upper left corner
  canvasContext.rect(scrollX, scrollY, 160, 144);
  canvasContext.lineWidth = lineWidth;
  canvasContext.strokeStyle = strokeStyle;
  canvasContext.stroke();

  // Upper right corner
  if (scrollX + 160 > 256) {
    canvasContext.rect(0, scrollY, scrollX + 160 - 256, 144);
    canvasContext.lineWidth = lineWidth;
    canvasContext.strokeStyle = strokeStyle;
    canvasContext.stroke();
  }

  // Bottom left corner
  if (scrollY + 144 > 256) {
    canvasContext.rect(scrollX, 0, 160, scrollY + 144 - 256);
    canvasContext.lineWidth = lineWidth;
    canvasContext.strokeStyle = strokeStyle;
    canvasContext.stroke();
  }

  // Bottom right corner
  if (scrollX + 160 > 256 && scrollY + 144 > 256) {
    canvasContext.rect(0, 0, scrollX + 160 - 256, scrollY + 144 - 256);
    canvasContext.lineWidth = lineWidth;
    canvasContext.strokeStyle = strokeStyle;
    canvasContext.stroke();
  }
};

export default class BackgroundMap extends Component {
  constructor() {
    super();

    this.shouldUpdate = true;
    this.updateTimeout = false;
  }

  componentDidMount() {
    const canvasElement = this.base.querySelector('#background-map__canvas');
    const canvasContext = canvasElement.getContext('2d');
    const canvasImageData = canvasContext.createImageData(256, 256);

    // Add some css for smooth 8-bit canvas scaling
    // https://stackoverflow.com/questions/7615009/disable-interpolation-when-scaling-a-canvas
    // https://caniuse.com/#feat=css-crisp-edges
    canvasElement.style = `
      image-rendering: optimizeSpeed;
      image-rendering: -moz-crisp-edges;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: -o-crisp-edges;
      image-rendering: pixelated;
      -ms-interpolation-mode: nearest-neighbor;
    `;

    // Fill the canvas with a blank screen
    // using client width since we are not requiring a width and height on the canvas
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);

    this.shouldUpdate = true;

    const updateBackgroundMap = () => {
      this.updateBackgroundMap(canvasElement, canvasContext, canvasImageData).then(() => {
        if (this.shouldUpdate) {
          this.updateTimeout = setTimeout(() => {
            updateBackgroundMap();
          }, 100);
        }
      });
    };
    updateBackgroundMap();
  }

  componentWillUnmount() {
    this.shouldUpdate = false;
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = false;
    }
  }

  updateBackgroundMap(canvasElement, canvasContext, canvasImageData) {
    // Dont update for the following
    if (!WasmBoy.isReady() || WasmBoy.isPaused()) {
      return Promise.resolve();
    }
    return updateBackgroundMapTask(canvasElement, canvasContext, canvasImageData);
  }

  render() {
    return (
      <div id="background-map">
        <h1>Background Map</h1>
        <canvas id="background-map__canvas" class="pixel-canvas" width="256" height="256" />
      </div>
    );
  }
}
