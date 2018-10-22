// Start our update and render process
// Can't time by raf, as raf is not garunteed to be 60fps
// Need to run like a web game, where updates to the state of the core are done a 60 fps
// but we can render whenever the user would actually see the changes browser side in a raf
// https://developer.mozilla.org/en-US/docs/Games/Anatomy

// Imports
import { postMessage } from '../../worker/workerapi';
import { getSmartWorkerMessage } from '../../worker/smartworker';
import { WORKER_MESSAGE_TYPE, MEMORY_TYPE } from '../../worker/constants';

// Memory
import { getCartridgeRam } from './memory/ram.js';
import { getGameBoyMemory } from './memory/gameboymemory.js';
import { getPaletteMemory } from './memory/palettememory.js';
import { getInternalState } from './memory/internalstate.js';

// Timestamps
import { getPerformanceTimestamp } from '../../common/common';
import { addTimeStamp, waitForTimeStampsForFrameRate } from './timestamp';

// Some variables to help with Audio Latency
// 0.25 (quarter of a second), just felt right from testing :)
const MAX_AUDIO_LATENCY = 0.25;
// Pass over samples once we have enough worth playing:
// https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/
const AUDIO_BUFFER_SIZE = 1024;

// FPS measuring
let currentHighResTime;
let currentFps;

// interval to set timeout
let intervalRate;

function scheduleNextUpdate(libWorker) {
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
    update(libWorker);
  }, Math.floor(nextUpdateTime));
}

// Function to run an update on the emulator itself
export function update(libWorker, passedIntervalRate) {
  // Don't run if paused
  if (libWorker.paused) {
    return true;
  }

  // Set the intervalRate if it was passed
  if (passedIntervalRate !== undefined) {
    intervalRate = passedIntervalRate;
  }

  // Set a timestamp for this moment
  // And make sure we are on track for FPS
  currentHighResTime = addTimeStamp(libWorker);
  currentFps = libWorker.getFPS();
  if (currentFps > libWorker.options.gameboyFrameRate + 1) {
    scheduleNextUpdate(libWorker);
    return true;
  }

  // Check if we are outputting audio
  const shouldCheckAudio = !libWorker.options.headless && !libWorker.pauseFpsThrottle && libWorker.options.isAudioEnabled;

  // Execute
  // Wrapped in promise to better handle audio slowdowns and things of that sort
  const executePromise = new Promise(resolve => {
    // Update (Execute a frame)
    let response;
    if (shouldCheckAudio) {
      executeAndCheckAudio(libWorker, resolve);
    } else {
      response = libWorker.wasmInstance.exports.executeFrame();
      resolve(response);
    }
  });

  executePromise.then(response => {
    // Handle our update() response
    if (response >= 0) {
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

      // Transfer Memory for things like save states
      const memoryObject = {
        type: WORKER_MESSAGE_TYPE.UPDATED
      };
      memoryObject[MEMORY_TYPE.CARTRIDGE_RAM] = getCartridgeRam(libWorker).buffer;
      memoryObject[MEMORY_TYPE.GAMEBOY_MEMORY] = getGameBoyMemory(libWorker).buffer;
      memoryObject[MEMORY_TYPE.PALETTE_MEMORY] = getPaletteMemory(libWorker).buffer;
      memoryObject[MEMORY_TYPE.INTERNAL_STATE] = getInternalState(libWorker).buffer;
      libWorker.memoryWorkerPort.postMessage(getSmartWorkerMessage(memoryObject), [
        memoryObject[MEMORY_TYPE.CARTRIDGE_RAM],
        memoryObject[MEMORY_TYPE.GAMEBOY_MEMORY],
        memoryObject[MEMORY_TYPE.PALETTE_MEMORY],
        memoryObject[MEMORY_TYPE.INTERNAL_STATE]
      ]);

      scheduleNextUpdate(libWorker);
    } else {
      postMessage({
        type: WORKER_MESSAGE_TYPE.CRASHED
      });
      libWorker.paused = true;
    }
  });
}

// If audio is enabled, sync by audio
// Audio will pass us its forward latency, and if it is too far ahead,
// Then we can wait a little bit to let audio catch up
// 0.25 (quarter of a second), just felt right from testing :)
function executeAndCheckAudio(libWorker, resolve) {
  // Get our response
  const response = libWorker.wasmInstance.exports.executeFrameAndCheckAudio(AUDIO_BUFFER_SIZE);

  // If our response is not 1, simply resolve
  if (response !== 1) {
    resolve(response);
  }

  // Do some audio magic
  if (response === 1) {
    // Get our audioQueueIndex
    const audioQueueIndex = libWorker.wasmInstance.exports.getAudioQueueIndex();

    // Check if we are sending too much audio
    const isTooMuchLatency = libWorker.currentAudioLatencyInSeconds > MAX_AUDIO_LATENCY;
    const isRunningFullSpeed = currentFps >= libWorker.options.gameboyFrameRate;

    if (isTooMuchLatency && isRunningFullSpeed) {
      sendAudio(libWorker, audioQueueIndex);
      // Wait, Set a timeout for when we would like to
      // Continue executing. * 1000 for seconds -> milli
      // Wait for half the difference, since it may take time to execute, and things
      const latencyDifferenceInSeconds = libWorker.currentAudioLatencyInSeconds - MAX_AUDIO_LATENCY;
      const latencyDifferenceInMilli = Math.floor(latencyDifferenceInSeconds * 1000);
      setTimeout(() => {
        waitForTimeStampsForFrameRate(libWorker);
        executeAndCheckAudio(libWorker, resolve);
      }, Math.floor(latencyDifferenceInMilli / 10));
    } else {
      sendAudio(libWorker, audioQueueIndex);
      executeAndCheckAudio(libWorker, resolve);
    }
  }
}

function sendAudio(libWorker, audioQueueIndex) {
  // Send out our audio
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
