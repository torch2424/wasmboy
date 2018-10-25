import { getPerformanceTimestamp } from '../../common/common';

// Function to add a timestamp to keep track
// of how fast we are running
export function addTimeStamp(libWorker) {
  // Track our Fps
  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  const currentHighResTime = getPerformanceTimestamp();
  while (libWorker.fpsTimeStamps[0] < currentHighResTime - 1000) {
    libWorker.fpsTimeStamps.shift();
  }
  libWorker.fpsTimeStamps.push(currentHighResTime);

  libWorker.timeStampsUntilReady--;
  if (libWorker.timeStampsUntilReady < 0) {
    libWorker.timeStampsUntilReady = 0;
  }

  return currentHighResTime;
}

// Function to wait for a specified number,
// of timestamps before setting the framerate
export function waitForTimeStampsForFrameRate(libWorker) {
  if (libWorker.options.gameboyFrameRate <= 90) {
    libWorker.timeStampsUntilReady = Math.floor(libWorker.options.gameboyFrameRate) * 1.25;
  } else {
    // Fast stretching should be hardcoded, that way it doesn't just say a large number for a long time
    libWorker.timeStampsUntilReady = 120;
  }
}
