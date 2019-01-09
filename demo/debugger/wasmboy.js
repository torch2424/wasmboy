// Single place to import WasmBoy
// This is so we can swap between Different Lib outputs Easily
import { WasmBoy as WasmBoyImport } from '../../dist/wasmboy.wasm.esm';
export const WasmBoy = WasmBoyImport;

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
  isAudioEnabled: true,
  frameSkip: 0,
  audioBatchProcessing: false,
  timersBatchProcessing: false,
  audioAccumulateSamples: false,
  graphicsBatchProcessing: false,
  graphicsDisableScanlineRendering: false,
  tileRendering: false,
  tileCaching: false,
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
  ...WasmBoyDefaultOptions
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

  const updateTask = async () => {
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
      setTimeout(updateTask, 500);
      return;
    }
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
      if (window !== undefined && window.gtag) {
        gtag('event', 'rom_loaded_and_started');
      }
    };

    await WasmBoy.config(wasmboyOptions);
    await WasmBoy.setCanvas(canvasElement);
    await WasmBoy.play();
  };
  updateTask();
};
