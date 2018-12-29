// Compoonent that contains the canvas and the actual output
// of WasmBoy

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../pubx.config';

import WasmBoy from '../../wasmboy';

import './wasmboyPlayer.css';

// Variables to tell if our callbacks were ever run
let saveStateCallbackCalled = false;
let graphicsCallbackCalled = false;
let audioCallbackCalled = false;

const getCanvasElement = () => {
  return document.querySelector('.wasmboy-player canvas');
};

// WasmBoy Options
const WasmBoyDefaultOptions = {
  isGbcEnabled: true,
  isAudioEnabled: true,
  frameSkip: 0,
  audioBatchProcessing: true,
  timersBatchProcessing: false,
  audioAccumulateSamples: true,
  graphicsBatchProcessing: false,
  graphicsDisableScanlineRendering: false,
  tileRendering: true,
  tileCaching: true,
  gameboyFrameRate: 60,
  updateGraphicsCallback: imageDataArray => {
    if (!graphicsCallbackCalled) {
      console.log('Graphics Callback Called! Only Logging this once... imageDataArray:', imageDataArray);
      graphicsCallbackCalled = true;
    }
  },
  updateAudioCallback: (audioContext, audioBufferSourceNode) => {
    if (!audioCallbackCalled) {
      console.log(
        'Audio Callback Called! Only Logging this once... audioContext, audioBufferSourceNode:',
        audioContext,
        audioBufferSourceNode
      );
      audioCallbackCalled = true;
    }
  },
  saveStateCallback: saveStateObject => {
    if (!saveStateCallbackCalled) {
      console.log('Save State Callback Called! Only Logging this once... saveStateObject:', saveStateObject);
      saveStateCallbackCalled = true;
    }

    // Function called everytime a savestate occurs
    // Used by the WasmBoySystemControls to show screenshots on save states
    const canvasElement = getCanvasElement();
    if (canvasElement) {
      saveStateObject.screenshotCanvasDataURL = getCanvasElement().toDataURL();
    }
  },
  onReady: () => {
    console.log('onReady Callback Called!');
    Pubx.get(PUBX_KEYS.WASMBOY).update();
  },
  onPlay: () => {
    console.log('onPlay Callback Called!');
    Pubx.get(PUBX_KEYS.WASMBOY).update();
  },
  onPause: () => {
    console.log('onPause Callback Called!');
    Pubx.get(PUBX_KEYS.WASMBOY).update();
  },
  onLoadedAndStarted: () => {
    console.log('onLoadedAndStarted Callback Called!');
    Pubx.get(PUBX_KEYS.WASMBOY).update();
  }
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
