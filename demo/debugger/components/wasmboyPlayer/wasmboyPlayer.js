// Compoonent that contains the canvas and the actual output
// of WasmBoy

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../pubx.config';

import { WasmBoy, WasmBoyDefaultOptions } from '../../wasmboy';

import './wasmboyPlayer.css';

const getCanvasElement = () => {
  return document.querySelector('.wasmboy-player canvas');
};

export default class WasmBoyPlayer extends Component {
  constructor() {
    super();
  }

  componentDidMount() {
    WasmBoy.config(WasmBoyDefaultOptions)
      .then(() => {
        return WasmBoy.setCanvas(getCanvasElement());
      })
      .catch(error => {
        console.error(error);
      });
  }

  render() {
    return (
      <div class="wasmboy-player">
        <canvas />
      </div>
    );
  }
}
