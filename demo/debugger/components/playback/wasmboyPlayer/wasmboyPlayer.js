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

    Pubx.subscribe(PUBX_KEYS.LOADING, newState => this.checkControlLoading(newState));
    this.checkControlLoading(Pubx.get(PUBX_KEYS.LOADING));
  }

  checkControlLoading(newState) {
    if (newState.controlLoading) {
      this.base.classList.add('wasmboy-player--control-loading');
    } else {
      this.base.classList.remove('wasmboy-player--control-loading');
    }
  }

  render() {
    return (
      <div class="wasmboy-player">
        <div class="donut" />
        <canvas class="pixel-canvas" />
      </div>
    );
  }
}
