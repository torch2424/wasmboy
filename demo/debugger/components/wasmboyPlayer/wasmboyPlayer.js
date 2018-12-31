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
    // Add some pubx hooks by default
    const wasmboyOptions = {
      ...WasmBoyDefaultOptions
    };

    const wasmboyStateCallbackKeys = ['onReady', 'onPlay', 'onPause', 'onLoadedAndStarted'];

    wasmboyStateCallbackKeys.forEach(callbackKey => {
      const callback = wasmboyOptions[callbackKey];
      wasmboyOptions[callbackKey] = () => {
        callback();
        Pubx.get(PUBX_KEYS.WASMBOY).update();
      };
    });

    WasmBoy.config(wasmboyOptions)
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
