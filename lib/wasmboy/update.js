// Imports
import { getPerformanceTimestamp } from '../common/common';

// Function to run an update on the emulator itself
export const update = (wasmboy) => {
  // Don't run if paused
  if (wasmboy.paused) {
    return true;
  }

  // Track our Fps
  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  let currentHighResTime = getPerformanceTimestamp();
  while (wasmboy.fpsTimeStamps[0] < currentHighResTime - 1000) {
    wasmboy.fpsTimeStamps.shift();
  }

  // Framecap at 60fps
  const currentFps = wasmboy.getFPS();
  if (currentFps > wasmboy.options.gameboyFrameRate) {
    return true;
  } else {
    wasmboy.fpsTimeStamps.push(currentHighResTime);
  }

  // If audio is enabled, sync by audio
  // Check how many samples we have, and if we are getting too ahead, need to skip the update
  // Magic number is from experimenting and wasmboy seems to go good
  // TODO: Make wasmboy a preference, or calculate from performance.now()
  // TODO Make audio queue constant in wasmboy audio, and make it a function to be called in wasmboy audio
  if (
    !wasmboy.options.headless &&
    !wasmboy.pauseFpsThrottle &&
    wasmboy.options.isAudioEnabled &&
    wasmboy.wasmInstance.exports.getAudioQueueIndex() > 7000 * (wasmboy.options.gameboyFrameRate / 120) &&
    wasmboy.options.gameboyFrameRate <= 60
  ) {
    // TODO: Waiting for time stretching to resolve may be causing wasmboy
    console.log('Waiting for audio...');
    return true;
  }

  // Update (Execute a frame)
  let response = wasmboy.wasmInstance.exports.update();

  // Handle our update() response
  if (response >= 0) {
    // See: wasm/cpu/opcodes update() function
    // 0 = render a frame
    switch (response) {
      case 0:
        break;
    }

    return true;
  } else {
    console.log('Wasmboy Crashed!');
    console.log(`Program Counter: 0x${wasmboy.wasmInstance.exports.getProgramCounter().toString(16)}`);
    console.log(`Opcode: 0x${wasmboy.wasmByteMemory[wasmboy.wasmInstance.exports.getProgramCounter()].toString(16)}`);
    wasmboy.pause();
    return false;
  }
}
