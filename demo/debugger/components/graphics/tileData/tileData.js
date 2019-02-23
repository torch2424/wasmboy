import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import './tileData.css';

// To Stop memory leaks, see disassembler
const updateCanvasTask = async (canvasElement, canvasContext, canvasImageData) => {
  // Draw our tile Data
  await WasmBoy._runWasmExport('drawTileDataToWasmMemory');

  const imageDataArray = new Uint8ClampedArray(tileDataYPixels * tileDataXPixels * 4);
  const rgbColor = new Uint8ClampedArray(3);

  // Get our background map location constant
  const tileDataMapLocation = await WasmBoy._getWasmConstant('TILE_DATA_LOCATION');
  const tileDataMapMemory = await WasmBoy._getWasmMemorySection(
    tileDataMapLocation,
    tileDataMapLocation + tileDataYPixels * tileDataXPixels * 3
  );

  for (let y = 0; y < tileDataYPixels; y++) {
    for (let x = 0; x < tileDataXPixels; x++) {
      // Each color has an R G B component
      let pixelStart = (y * tileDataXPixels + x) * 3;

      for (let color = 0; color < 3; color++) {
        rgbColor[color] = tileDataMapMemory[pixelStart + color];
      }

      // Doing graphics using second answer on:
      // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
      // Image Data mapping
      const imageDataIndex = (x + y * tileDataXPixels) * 4;

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
  canvasContext.clearRect(0, 0, tileDataXPixels, tileDataYPixels);
  canvasContext.putImageData(canvasImageData, 0, 0);
};

const tileDataXPixels = 0x1f * 8;
const tileDataYPixels = 0x17 * 8;

export default class TileData extends Component {
  constructor() {
    super();

    this.shouldUpdate = true;
    this.updateTimeout = false;
  }

  componentDidMount() {
    const canvasElement = this.base.querySelector('#tile-data__canvas');
    const canvasContext = canvasElement.getContext('2d');
    const canvasImageData = canvasContext.createImageData(tileDataXPixels, tileDataYPixels);

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
    // using client width since we are not requiring a width and height oin the canvas
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);

    this.shouldUpdate = true;

    const updateCallback = () => {
      this.updateCallback(canvasElement, canvasContext, canvasImageData).then(() => {
        if (this.shouldUpdate) {
          this.updateTimeout = setTimeout(() => {
            updateCallback();
          }, 100);
        }
      });
    };
    updateCallback();
  }

  componentWillUnmount() {
    this.shouldUpdate = false;
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = false;
    }
  }

  updateCallback(canvasElement, canvasContext, canvasImageData) {
    // Dont update for the following
    if (!WasmBoy.isReady() || WasmBoy.isPaused()) {
      return Promise.resolve();
    }
    return updateCanvasTask(canvasElement, canvasContext, canvasImageData);
  }

  render() {
    return (
      <div id="tile-data">
        <h1>Tile Data</h1>
        <canvas id="tile-data__canvas" class="pixel-canvas" width={tileDataXPixels} height={tileDataYPixels} />
      </div>
    );
  }
}
