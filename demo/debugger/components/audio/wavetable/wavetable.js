import { Component, h } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import './wavetable.css';

let updateInterval = undefined;

export default class AudioWavetable extends Component {
  componentDidMount() {
    // Set up our background canvas
    const bgCanvas = this.base.querySelector('.wavetable__bg');
    const bgCanvasContext = bgCanvas.getContext('2d');
    bgCanvasContext.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    // Fill background canvas with stripes
    // Even
    bgCanvasContext.fillStyle = '#d5d5d5';
    for (let i = 0; i < bgCanvas.height; i += 2) {
      bgCanvasContext.fillRect(0, i, bgCanvas.width, 1);
    }
    // Odd
    bgCanvasContext.fillStyle = '#979797';
    for (let i = 1; i < bgCanvas.height; i += 2) {
      bgCanvasContext.fillRect(0, i, bgCanvas.width, 1);
    }

    // Set our sprites canvas
    this.spritesCanvas = this.base.querySelector('.wavetable__sprites');
    this.spritesCanvasContext = this.spritesCanvas.getContext('2d');
    this.spritesCanvasContext.fillStyle = '#6547f4';

    this.wavetableValuesList = this.base.querySelector('.wavetable__values ul');

    // Update at ~30fps
    updateInterval = setInterval(() => this.update(), 32);
  }

  componentWillUnmount() {
    clearInterval(updateInterval);
  }

  update() {
    if (!WasmBoy.isPlaying()) {
      return;
    }

    const updateTask = async () => {
      // Get the wavetable memory
      // http://gbdev.gg8.se/wiki/articles/Sound_Controller#FF30-FF3F_-_Wave_Pattern_RAM
      const memoryStart = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff30]);
      const memoryEnd = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff3f]);
      const memory = await WasmBoy._getWasmMemorySection(memoryStart, memoryEnd + 1);

      // Get the individual values from the nibbles
      const wavetableValues = [];

      memory.forEach(value => {
        const highNibble = (value & 0xf0) >> 4;
        const lowNibble = value & 0x0f;
        wavetableValues.push(highNibble);
        wavetableValues.push(lowNibble);
      });

      // Plot onto the sprites wavetable
      // The sprites table is flipped in CSS
      // Thus, 0,0 is the bottom left
      this.spritesCanvasContext.clearRect(0, 0, this.spritesCanvas.width, this.spritesCanvas.height);
      this.wavetableValuesList.innerHTML = '';
      wavetableValues.forEach((value, index) => {
        this.spritesCanvasContext.fillRect(index, value, 1, 1);

        const element = document.createElement('li');
        element.textContent = `${index}: ${value}`;

        this.wavetableValuesList.appendChild(element);
      });
    };
    updateTask();
  }

  render() {
    return (
      <div class="wavetable">
        <h1>WaveTable</h1>

        <div class="wavetable__view">
          <canvas class="wavetable__bg wavetable__layer" width="32" height="16" />
          <canvas class="wavetable__sprites wavetable__layer" width="32" height="16" />
        </div>

        <div class="wavetable__values">
          <ul />
        </div>
      </div>
    );
  }
}
