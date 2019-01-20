import { WasmBoyLib } from '../wasmboy/wasmboy';
import { waitForLibWorkerMessageType } from '../wasmboy/onmessage';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyGraphics } from '../graphics/graphics';

import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';

// https://www.npmjs.com/package/audiobuffer-to-wav
// https://github.com/Jam3/audiobuffer-to-wav/blob/master/demo/index.js
import toWav from 'audiobuffer-to-wav';

// requestAnimationFrame() for headless mode
import raf from 'raf';

// https://www.npmjs.com/package/big-integer
import bigInt from 'big-integer';

let currentRaf = undefined;
const forceOutputFrame = () => {
  WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.FORCE_OUTPUT_FRAME
  });
  WasmBoyGraphics.renderFrame();
};

export const saveCurrentAudioBufferToWav = () => {
  if (!WasmBoyAudio.audioBuffer) {
    return;
  }

  const wav = toWav(WasmBoyAudio.audioBuffer);
  const blob = new window.Blob([new DataView(wav)], {
    type: 'audio/wav'
  });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  document.body.appendChild(anchor);
  anchor.style = 'display: none';
  anchor.href = url;
  anchor.download = 'audio.wav';
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const runNumberOfFrames = async frames => {
  await WasmBoyLib.pause();

  // Set up a raf function to continually update the canvas
  const rafUpdateCanvas = () => {
    currentRaf = raf(() => {
      if (currentRaf) {
        forceOutputFrame();
        rafUpdateCanvas();
      }
    });
  };
  rafUpdateCanvas();

  for (let i = 0; i < frames; i++) {
    await runWasmExport('executeFrame', []);
  }

  currentRaf = undefined;
  forceOutputFrame();
};

export const playUntilBreakpoint = async breakpoint => {
  await WasmBoyLib.play(breakpoint);
  const message = await waitForLibWorkerMessageType(WORKER_MESSAGE_TYPE.BREAKPOINT);
  await WasmBoyLib.pause();
};

export const runWasmExport = async (exportKey, parameters) => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.RUN_WASM_EXPORT,
    export: exportKey,
    parameters
  });

  const eventData = getEventData(event);
  return eventData.message.response;
};

export const getWasmMemorySection = async (start, end) => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.GET_WASM_MEMORY_SECTION,
    start,
    end
  });

  const eventData = getEventData(event);
  return new Uint8Array(eventData.message.response);
};

export const getWasmConstant = async constantKey => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.GET_WASM_CONSTANT,
    constant: constantKey
  });

  const eventData = getEventData(event);
  return eventData.message.response;
};

export const getStepsAsString = async radix => {
  const stepsPerStepSet = await runWasmExport('getStepsPerStepSet');
  const stepSets = await runWasmExport('getStepSets');
  const steps = await runWasmExport('getSteps');

  const bigSteps = bigInt(stepsPerStepSet)
    .multiply(stepSets)
    .add(steps);

  if (radix) {
    return bigSteps.toString(radix);
  }
  return bigSteps.toString(10);
};

export const getCyclesAsString = async radix => {
  const cyclesPerCycleSet = await runWasmExport('getCyclesPerCycleSet');
  const cycleSets = await runWasmExport('getCycleSets');
  const cycles = await runWasmExport('getCycles');

  const bigCycles = bigInt(cyclesPerCycleSet)
    .multiply(cycleSets)
    .add(cycles);

  if (radix) {
    return bigCycles.toString(radix);
  }
  return bigCycles.toString(10);
};
