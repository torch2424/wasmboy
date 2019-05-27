// Single place to import WasmBoy
// This is so we can swap between Different Lib outputs Easily
import { WasmBoy as WasmBoyImport } from '../../dist/wasmboy.wasm.esm';
export const WasmBoy = WasmBoyImport;

import { Pubx } from 'pubx';
import PUBX_KEYS from './pubx.keys';

import DebuggerAnalytics from './analytics';

// Variables to tell if our callbacks were ever run
let saveStateCallbackCalled = false;
let graphicsCallbackCalled = false;
let audioCallbackCalled = false;

let isMobileCanvas = false;

const getDesktopCanvasElement = () => {
  return document.querySelector('.wasmboy-player canvas');
};

const getMobileCanvasElement = () => {
  return document.querySelector('.mobile-container #mobile-container__wasmboy-canvas');
};

// WasmBoy Options
const WasmBoyDefaultOptions = {
  isGbcEnabled: true,
  isGbcColorizationEnabled: true,
  gbcColorizationPalette: undefined,
  enableBootROMIfAvailable: false,
  isAudioEnabled: true,
  enableAudioDebugging: false,
  frameSkip: 0,
  audioBatchProcessing: false,
  timersBatchProcessing: false,
  audioAccumulateSamples: false,
  graphicsBatchProcessing: false,
  graphicsDisableScanlineRendering: false,
  tileRendering: false,
  tileCaching: false,
  gameboyFrameRate: 60,
  maxNumberOfAutoSaveStates: 3,
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
  },
  breakpointCallback: () => {
    console.log('breakpoint Callback Called!');
  },
  onReady: () => {
    console.log('onReady Callback Called!');
  },
  onPlay: () => {
    console.log('onPlay Callback Called!');
  },
  onPause: () => {
    console.log('onPause Callback Called!');
  },
  onLoadedAndStarted: () => {
    console.log('onLoadedAndStarted Callback Called!');
  }
};

export const WasmBoyDefaultDesktopOptions = {
  ...WasmBoyDefaultOptions,
  enableAudioDebugging: true
};

export const WasmBoyDefaultMobileOptions = {
  ...WasmBoyDefaultOptions,
  frameSkip: 1,
  audioBatchProcessing: true,
  audioAccumulateSamples: true,
  tileRendering: true,
  tileCaching: true
};

export const WasmBoyUpdateCanvas = (isMobile, stateUpdateCallback) => {
  isMobileCanvas = isMobile;

  let canvasElement;
  let defaultOptions;

  if (isMobile) {
    canvasElement = getMobileCanvasElement();
    defaultOptions = WasmBoyDefaultMobileOptions;
  } else {
    canvasElement = getDesktopCanvasElement();
    defaultOptions = WasmBoyDefaultDesktopOptions;
  }

  if (!canvasElement) {
    return;
  }

  const updateTask = async () => {
    const wasmboyOptions = {
      ...defaultOptions
    };

    if (stateUpdateCallback) {
      const wasmboyStateCallbackKeys = ['onReady', 'onPlay', 'onPause', 'onLoadedAndStarted'];

      wasmboyStateCallbackKeys.forEach(callbackKey => {
        const callback = wasmboyOptions[callbackKey];
        wasmboyOptions[callbackKey] = () => {
          callback();
          setTimeout(() => {
            stateUpdateCallback();
          }, 50);
        };
      });
    }

    // Add an analytics event for when a rom is played from onLoadedAndStarted
    const currentLoadedAndStarted = wasmboyOptions.onLoadedAndStarted;
    wasmboyOptions.onLoadedAndStarted = () => {
      currentLoadedAndStarted();
      DebuggerAnalytics.ROMLoadedAndStarted();
    };

    await WasmBoy.config(wasmboyOptions);
    await WasmBoy.setCanvas(canvasElement);
    await WasmBoy.play();
  };
  updateTask();

  return true;
};

// WasmBoy Plugin
const pluginCalled = {};
const DebuggerPlugin = {
  name: 'WasmBoy Debugger',
  graphics: imageDataArray => {
    if (!pluginCalled.graphics) {
      console.log('Plugin "graphics" called! Only Logging this once...', imageDataArray);
      pluginCalled.graphics = true;
    }
  },
  audio: (audioContext, masterAudioNode, channelId) => {
    if (!pluginCalled.audio) {
      console.log('Plugin "audio" called! Only Logging this once...', audioContext, masterAudioNode, channelId);
      pluginCalled.audio = true;
    }
  },
  saveState: saveStateObject => {
    if (!pluginCalled.saveState) {
      console.log('Plugin "saveState" called! Only Logging this once...', saveStateObject);
      pluginCalled.saveState = true;
    }

    // Function called everytime a savestate occurs
    // Used by the WasmBoySystemControls to show screenshots on save states
    let canvasElement;
    if (isMobileCanvas) {
      canvasElement = getMobileCanvasElement();
    } else {
      canvasElement = getDesktopCanvasElement();
    }

    if (canvasElement) {
      saveStateObject.screenshotCanvasDataURL = canvasElement.toDataURL();
    }
  },
  canvas: (canvasElement, canvasContext, canvasImageData) => {
    console.log('Plugin "canvas" called!', canvasElement, canvasContext, canvasImageData);
  },
  breakpoint: () => {
    console.log('Plugin "breakpoint" called!');
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Reach Breakpoint! 🛑');
  },
  ready: () => console.log('Plugin "ready" called!'),
  play: () => console.log('Plugin "play" called!'),
  pause: () => console.log('Plugin "pause" called!'),
  loadedAndStarted: () => console.log('Plugin "loadedAndStarted" called!')
};

WasmBoy.addPlugin(DebuggerPlugin);
