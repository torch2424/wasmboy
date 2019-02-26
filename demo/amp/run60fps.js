import { getPerformanceTimestamp } from '../../lib/common/common';

// Create some timestamps
const fpsTimeStamps = [];

// Our interval rate (60fps)
const intervalRate = 1000 / 60;

let framesRan = 0;
const framesToRun = 0;

// Function to add a timestamp to keep track
// of how fast we are running
function addTimeStamp() {
  // Track our Fps
  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  const currentHighResTime = getPerformanceTimestamp();
  while (fpsTimeStamps && fpsTimeStamps[0] < currentHighResTime - 1000) {
    fpsTimeStamps.shift();
  }
  fpsTimeStamps.push(currentHighResTime);

  return currentHighResTime;
}

export function run60fps(callback) {
  // Some Hack-y test code
  if (framesToRun > 0) {
    framesRan++;

    if (framesRan > framesToRun) {
      return;
    }
  }

  // Get our high res time
  const highResTime = getPerformanceTimestamp();

  // Find how long it has been since the last timestamp
  const timeSinceLastTimestamp = highResTime - fpsTimeStamps[fpsTimeStamps.length - 1];

  // Get the next time we should update using our interval rate
  let nextUpdateTime = intervalRate - timeSinceLastTimestamp;
  if (getFPS() < 58 || nextUpdateTime < 0) {
    nextUpdateTime = 0;
  }

  setTimeout(() => {
    addTimeStamp();
    if (getFPS() <= 60) {
      callback();
    }
    run60fps(callback);
  }, Math.floor(nextUpdateTime));
}

export function getFPS() {
  if (!fpsTimeStamps || fpsTimeStamps.length === 0) {
    return 60;
  }
  return fpsTimeStamps.length;
}
