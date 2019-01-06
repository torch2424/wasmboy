// Compoonent that contains the canvas and the actual output
// of WasmBoy

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy, WasmBoyDefaultOptions } from '../../../wasmboy';

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
        setTimeout(() => {
          Pubx.get(PUBX_KEYS.WASMBOY).update();
        }, 50);
      };
    });

    WasmBoy.config(wasmboyOptions)
      .then(() => {
        return WasmBoy.setCanvas(getCanvasElement());
      })
      .catch(error => {
        console.error(error);
      });

    Pubx.subscribe(PUBX_KEYS.LOADING, newState => {
      if (newState.controlLoading) {
        this.base.classList.add('wasmboy-player--control-loading');
      } else {
        this.base.classList.remove('wasmboy-player--control-loading');
      }
    });
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
