// Start our update and render process
// Can't time by raf, as raf is not garunteed to be 60fps
// Need to run like a web game, where updates to the state of the core are done a 60 fps
// but we can render whenever the user would actually see the changes browser side in a raf
// https://developer.mozilla.org/en-US/docs/Games/Anatomy

// Imports
import { postMessage } from '../../worker/workerapi';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { WORKER_MESSAGE_TYPE } from '../../worker/constants';
import { getPerformanceTimestamp } from '../../common/common';

// Some variables to help with Audio Latency
// 0.25 (quarter of a second), just felt right from testing :)
const MAX_AUDIO_LATENCY = 0.25;
// Pass over samples once we have enough worth playing:
// https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/
const MINIMUM_AUDIO_QUEUE = 1024;
let audioSkips = 0;

function scheduleNextUpdate(libWorker, intervalRate) {
  // Get our high res time
  const highResTime = getPerformanceTimestamp();

  // Find how long it has been since the last timestamp
  const timeSinceLastTimestamp = highResTime - libWorker.fpsTimeStamps[libWorker.fpsTimeStamps.length - 1];

  // Get the next time we should update using our interval rate
  let nextUpdateTime = intervalRate - timeSinceLastTimestamp;
  if (nextUpdateTime < 0) {
    nextUpdateTime = 0;
  }

  libWorker.updateId = setTimeout(() => {
    update(libWorker, intervalRate);
  }, Math.floor(nextUpdateTime));
}

// Function to run an update on the emulator itself
export function update(libWorker, intervalRate) {
  // Don't run if paused
  if (libWorker.paused) {
    return true;
  }

  // Track our Fps
  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  let currentHighResTime = getPerformanceTimestamp();
  while (libWorker.fpsTimeStamps[0] < currentHighResTime - 1000) {
    libWorker.fpsTimeStamps.shift();
  }

  // Framecap at 60fps
  const currentFps = libWorker.getFPS();
  if (currentFps > libWorker.options.gameboyFrameRate + 1) {
    scheduleNextUpdate(libWorker, intervalRate);
    return true;
  } else {
    libWorker.fpsTimeStamps.push(currentHighResTime);
  }

  // If audio is enabled, sync by audio
  // Audio will pass us its forward latency, and if it is too far ahead,
  // Then we can wait a little bit to let audio catch up
  // 0.25 (quarter of a second), just felt right from testing :)
  const audioQueueIndex = libWorker.wasmInstance.exports.getAudioQueueIndex();
  const shouldCheckAudio = !libWorker.options.headless && !libWorker.pauseFpsThrottle && libWorker.options.isAudioEnabled;

  if (shouldCheckAudio) {
    const hasMinimumAudioQueue = audioQueueIndex >= MINIMUM_AUDIO_QUEUE;
    const isTooMuchLatency = libWorker.currentAudioLatencyInSeconds > MAX_AUDIO_LATENCY;
    // So for long notes, most games will just dedicate a frame to making that note.
    // Thus we get a huge buffer, and tons of latency out of nowhere. Thus, we do want to wait for audio
    // But never just completely stop while the whole note plays, just allow our selves to slowly
    // Catch back up.
    const latencyRatio = Math.floor(libWorker.currentAudioLatencyInSeconds / MAX_AUDIO_LATENCY);
    // TODO: May be skipping too little
    const isAudioSkipsLessThanLatencyRatio = audioSkips < latencyRatio;

    if (hasMinimumAudioQueue && isTooMuchLatency && isAudioSkipsLessThanLatencyRatio) {
      // Since we wont be getting another message from the audio worker,
      // We need to decrease our audio latency our self :)
      const intervalRateInSeconds = intervalRate / 1000;
      libWorker.currentAudioLatencyInSeconds -= intervalRateInSeconds;
      audioSkips++;

      // Schedule our update
      scheduleNextUpdate(libWorker, intervalRate);
      return true;
    } else {
      audioSkips = 0;
    }
  }

  // Update (Execute a frame)
  let response = libWorker.wasmInstance.exports.update();

  // Handle our update() response
  if (response >= 0) {
    // See: wasm/cpu/opcodes update() function
    // 0 = render a frame
    switch (response) {
      case 0:
        break;
    }

    // Pass messages to everyone
    postMessage(
      getSmartWorkerMessage({
        type: WORKER_MESSAGE_TYPE.UPDATED,
        fps: currentFps
      })
    );

    // Check if we have frameskip
    let shouldSkipRenderingFrame = false;
    if (libWorker.options.frameSkip && libWorker.options.frameSkip > 0) {
      libWorker.frameSkipCounter++;

      if (libWorker.frameSkipCounter <= libWorker.options.frameSkip) {
        shouldSkipRenderingFrame = true;
      } else {
        libWorker.frameSkipCounter = 0;
      }
    }

    // Transfer Graphics
    if (!shouldSkipRenderingFrame) {
      const graphicsFrameEndIndex = libWorker.WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION + libWorker.WASMBOY_CURRENT_FRAME_SIZE;
      const graphicsFrameBuffer = libWorker.wasmByteMemory.slice(libWorker.WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION, graphicsFrameEndIndex)
        .buffer;
      //libWorker.graphicsWorkerPort.postMessage(graphicsFrameBuffer, [graphicsFrameBuffer]);
      libWorker.graphicsWorkerPort.postMessage(
        getSmartWorkerMessage({
          type: WORKER_MESSAGE_TYPE.UPDATED,
          graphicsFrameBuffer
        }),
        [graphicsFrameBuffer]
      );
    }

    // Transfer Audio
    // Minimum number of samples
    if (libWorker.options.isAudioEnabled && audioQueueIndex >= MINIMUM_AUDIO_QUEUE) {
      // audioQueueIndex * 2, because audio Queue index represents 1 sample,
      // for left AND right channel. Therefore the end index is, twice
      // of the audioQueueIndex
      const audioBuffer = libWorker.wasmByteMemory.slice(
        libWorker.WASMBOY_SOUND_OUTPUT_LOCATION,
        libWorker.WASMBOY_SOUND_OUTPUT_LOCATION + audioQueueIndex * 2
      ).buffer;
      libWorker.audioWorkerPort.postMessage(
        getSmartWorkerMessage({
          type: WORKER_MESSAGE_TYPE.UPDATED,
          audioBuffer,
          numberOfSamples: audioQueueIndex,
          fps: currentFps,
          allowFastSpeedStretching: libWorker.options.gameboyFrameRate > 60
        }),
        [audioBuffer]
      );
      libWorker.wasmInstance.exports.resetAudioQueue();
    }

    // TODO: Transfer Memory periodically

    scheduleNextUpdate(libWorker, intervalRate);
  } else {
    postMessage({
      type: WORKER_MESSAGE_TYPE.CRASHED
    });
    libWorker.paused = true;
  }
}
