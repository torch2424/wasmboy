// Compoonent that contains the canvas and the actual output
// of WasmBoy

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy, WasmBoyUpdateCanvas } from '../../../wasmboy';

import './wasmboyPlayer.css';

const getCanvasElement = () => {
  return document.querySelector('.wasmboy-player canvas');
};

export default class WasmBoyPlayer extends Component {
  constructor() {
    super();
  }

  componentDidMount() {
    // Set our canvas
    WasmBoyUpdateCanvas(false, Pubx.get(PUBX_KEYS.WASMBOY).update);
  }

  render() {
    return (
      <div class="wasmboy-player">
        <canvas class="pixel-canvas" />
      </div>
    );
  }
}
