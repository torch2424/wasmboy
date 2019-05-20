// No closure, as the whole file is closure'd
import getWasmBoyTsCore from '../../dist/core/getWasmBoyTsCore.esm.js';

import dataUriToArray from './dataUriToArray.js';
import rgbaArrayBufferToSvg from './pixelToSvg.js';
import { run60fps, getFPS } from './run60fps';
import romUrl from '../../test/performance/testroms/tobutobugirl/tobutobugirl.gb';

let imageDataArray;

const runTask = async () => {
  const WasmBoy = await getWasmBoyTsCore();
  console.log('WasmBoy', WasmBoy);

  // Convert the rom Url to an array buffer
  const ROM = dataUriToArray(romUrl);
  console.log('Rom', ROM);

  // Clear Memory
  for (let i = 0; i <= WasmBoy.byteMemory.length; i++) {
    WasmBoy.byteMemory[i] = 0;
  }

  // Load the ROM into memory
  WasmBoy.byteMemory.set(ROM, WasmBoy.instance.exports.CARTRIDGE_ROM_LOCATION);

  // Config the core
  // Our config params
  const configParams = [
    0, // enableBootRom
    1, // useGbcWhenAvailable
    1, // audioBatchProcessing
    0, // graphicsBatchProcessing
    0, // timersBatchProcessing
    0, // graphicsDisableScanlineRendering
    1, // audioAccumulateSamples
    0, // tileRendering
    1, // tileCaching
    0 // enableAudioDebugging
  ];
  WasmBoy.instance.exports.config.apply(WasmBoy.instance, configParams);

  const keyMap = {
    A: {
      active: false,
      keyCodes: [90]
    },
    B: {
      active: false,
      keyCodes: [88]
    },
    UP: {
      active: false,
      keyCodes: [38, 87]
    },
    DOWN: {
      active: false,
      keyCodes: [40, 83]
    },
    LEFT: {
      active: false,
      keyCodes: [37, 65]
    },
    RIGHT: {
      active: false,
      keyCodes: [39, 68]
    },
    START: {
      active: false,
      keyCodes: [13]
    },
    SELECT: {
      active: false,
      keyCodes: [16]
    }
  };

  let isPlaying = true;
  const keyMapEventHandler = (event, shouldActivate) => {
    event.preventDefault();

    // First check for play pause
    if (event.keyCode === 32 && !shouldActivate) {
      console.log('Togling Play/Pause...');
      isPlaying = !isPlaying;
      if (isPlaying) {
        play();
      }
      return;
    }

    Object.keys(keyMap).some(key => {
      if (keyMap[key].keyCodes.includes(event.keyCode)) {
        if (shouldActivate) {
          keyMap[key].active = true;
        } else {
          keyMap[key].active = false;
        }
        return true;
      }
      return false;
    });
  };

  // Create an fps counter
  const fpsCounter = document.createElement('div');
  fpsCounter.id = 'fps';
  document.body.appendChild(fpsCounter);

  // Create an input handler
  const controlsOverlay = document.createElement('input');
  controlsOverlay.setAttribute('id', 'controls');

  controlsOverlay.addEventListener('keydown', event => keyMapEventHandler(event, true));
  controlsOverlay.addEventListener('keyup', event => keyMapEventHandler(event, false));
  document.body.appendChild(controlsOverlay);

  let frameSkip = 0;
  let maxFrameSkip = 2;

  // Start playing the rom
  const play = () => {
    if (!isPlaying) {
      return;
    }

    // Run a frame
    WasmBoy.instance.exports.executeFrame();

    // Render graphics
    if (frameSkip >= maxFrameSkip) {
      // Reset the frameskip
      frameSkip = 0;

      // Remove the old svg element
      const oldSvg = document.getElementById('wasmboy-svg-output');
      if (oldSvg) {
        oldSvg.remove();
      }

      const imageSvg = rgbaArrayBufferToSvg(160, 144, WasmBoy.byteMemory, WasmBoy.instance.exports.FRAME_LOCATION);
      imageSvg.setAttribute('id', 'wasmboy-svg-output');
      document.body.appendChild(imageSvg);
    } else {
      frameSkip++;
    }

    // Handle Input
    WasmBoy.instance.exports.setJoypadState(
      keyMap.UP.active ? 1 : 0,
      keyMap.RIGHT.active ? 1 : 0,
      keyMap.DOWN.active ? 1 : 0,
      keyMap.LEFT.active ? 1 : 0,
      keyMap.A.active ? 1 : 0,
      keyMap.B.active ? 1 : 0,
      keyMap.SELECT.active ? 1 : 0,
      keyMap.START.active ? 1 : 0
    );

    fpsCounter.textContent = `FPS: ${getFPS()}`;
  };
  run60fps(play);

  console.log('Playing ROM...');
};
runTask();
