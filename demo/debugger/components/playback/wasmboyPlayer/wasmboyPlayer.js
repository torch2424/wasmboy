// Compoonent that contains the canvas and the actual output
// of WasmBoy

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import './wasmboyPlayer.css';

const getCanvasElement = () => {
  return document.querySelector('.wasmboy-player canvas');
};

export default class WasmBoyPlayer extends Component {
  constructor() {
    super();
  }

  componentDidMount() {
    // Update our state of mobile
    // This will assign our canvas
    Pubx.get(PUBX_KEYS.MOBILE).update();
  }

  render() {
    return (
      <div class="wasmboy-player">
        <canvas class="pixel-canvas" />
      </div>
    );
  }
}
