// Tons of help from:
// https://binji.github.io/2017/02/27/binjgb-on-the-web-part-2.html
// https://github.com/binji/binjgb/blob/master/demo/demo.js
// Web Audio API is tricky!

import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';

// Define our performance constants
// Both of these make it sound off
// Latency controls how much delay audio has, larger = more delay, goal is to be as small as possible
// Time remaining controls how far ahead we can be., larger = more frames rendered before playing a new set of samples. goal is to be as small as possible. May want to adjust this number according to performance of device
// These magic numbers just come from preference, can be set as options
const DEFAULT_AUDIO_LATENCY_IN_MILLI = 100;
const WASMBOY_SAMPLE_RATE = 48000;

// Some canstants that use the ones above that will allow for faster performance
const DEFAULT_AUDIO_LATENCY_IN_SECONDS = DEFAULT_AUDIO_LATENCY_IN_MILLI / 1000;

// The minimum fps we can have, before we start time stretching for slowness
const SLOW_TIME_STRETCH_MIN_FPS = 57;

class WasmBoyAudioService {
  constructor() {
    // Wasmboy instance and memory
    this.worker = undefined;
    this.updateAudioCallback = undefined;

    this.audioContext = undefined;
    this.audioBuffer = undefined;
    // The play time for our audio samples
    this.audioPlaytime = undefined;
    this.audioSources = [];

    // Average fps for time stretching
    this.averageTimeStretchFps = [];

    // Our sound output Location, we will initialize this in init
    this.WASMBOY_SOUND_OUTPUT_LOCATION = 0;
  }

  initialize(updateAudioCallback) {
    const initializeTask = async () => {
      this.updateAudioCallback = updateAudioCallback;

      this.averageTimeStretchFps = [];
      if (this.audioSources.length > 0) {
        this.cancelAllAudio();
      }
      this.audioSources = [];

      // Get our Audio context
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Lastly get our audio constants
      return this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.GET_CONSTANTS
      });
    };
    return initializeTask();
  }

  setWorker(worker) {
    this.worker = worker;
    this.worker.addMessageListener(event => {
      const eventData = getEventData(event);

      switch (eventData.message.type) {
        case WORKER_MESSAGE_TYPE.UPDATED: {
          // Dont wait for raf.
          // Audio being shown is not dependent on the browser drawing a frame :)
          this.playAudio(
            eventData.message.fps,
            eventData.message.allowFastSpeedStretching,
            eventData.message.numberOfSamples,
            eventData.message.leftChannel,
            eventData.message.rightChannel
          );

          // Next, send back how much forward latency
          // we have
          const latency = this.audioPlaytime - this.audioContext.currentTime;
          this.worker.postMessage({
            type: WORKER_MESSAGE_TYPE.AUDIO_LATENCY,
            latency
          });
          return;
        }
      }
    });
  }

  // Function to queue up and audio buyffer to be played
  // Returns a promise so that we may "sync by audio"
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/dau8e2w/
  playAudio(currentFps, allowFastSpeedStretching, numberOfSamples, leftChannelBuffer, rightChannelBuffer) {
    // Find our averageFps
    let fps = currentFps || 60;

    // Check if we got a huge fps outlier.
    // If so, let's just reset our average.
    // This will fix the slow gradual ramp down
    if (currentFps < this.averageTimeStretchFps[this.averageTimeStretchFps.length - 1] / 1.5) {
      this.averageTimeStretchFps = [];
    }

    // Find our average fps for time stretching
    this.averageTimeStretchFps.push(currentFps);
    // TODO Make the multiplier Const the timeshift speed
    if (this.averageTimeStretchFps.length > Math.floor(SLOW_TIME_STRETCH_MIN_FPS * 3)) {
      this.averageTimeStretchFps.shift();
    }

    // Make sure we have a minimum number of time stretch fps timestamps to judge the average time
    if (this.averageTimeStretchFps.length >= SLOW_TIME_STRETCH_MIN_FPS) {
      fps = this.averageTimeStretchFps.reduce((accumulator, currentValue) => {
        return accumulator + currentValue;
      });
      fps = Math.floor(fps / this.averageTimeStretchFps.length);
    }

    // Find if we should time stretch this sample or not from our current fps
    let playbackRate = 1.0;
    if (fps < SLOW_TIME_STRETCH_MIN_FPS || allowFastSpeedStretching) {
      // Has to be 60 to get accurent playback regarless of fps cap
      playbackRate = playbackRate * (fps / 60);
      if (playbackRate <= 0) {
        playbackRate = 0.01;
      }
    }

    // Create an audio buffer, with a left and right channel
    this.audioBuffer = this.audioContext.createBuffer(2, numberOfSamples, WASMBOY_SAMPLE_RATE);
    if (this.audioBuffer.copyToChannel) {
      this.audioBuffer.copyToChannel(new Float32Array(leftChannelBuffer), 0, 0);
      this.audioBuffer.copyToChannel(new Float32Array(rightChannelBuffer), 1, 0);
    } else {
      // Safari fallback
      this.audioBuffer.getChannelData(0).set(new Float32Array(leftChannelBuffer));
      this.audioBuffer.getChannelData(1).set(new Float32Array(rightChannelBuffer));
    }

    // Get an AudioBufferSourceNode.
    // This is the AudioNode to use when we want to play an AudioBuffer
    let source = this.audioContext.createBufferSource();

    // set the buffer in the AudioBufferSourceNode
    source.buffer = this.audioBuffer;

    // Set our playback rate for time resetretching
    source.playbackRate.setValueAtTime(playbackRate, this.audioContext.currentTime);

    // Call our callback, if we have one
    let finalNode = source;
    if (this.updateAudioCallback) {
      const responseNode = this.updateAudioCallback(this.audioContext, source);
      if (responseNode) {
        finalNode = responseNode;
      }
    }

    // connect the AudioBufferSourceNode to the
    // destination so we can hear the sound
    finalNode.connect(this.audioContext.destination);

    // Check if we made it in time
    // Idea from: https://github.com/binji/binjgb/blob/master/demo/demo.js
    let audioContextCurrentTime = this.audioContext.currentTime;
    let audioContextCurrentTimeWithLatency = audioContextCurrentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
    this.audioPlaytime = this.audioPlaytime || audioContextCurrentTimeWithLatency;
    if (this.audioPlaytime < audioContextCurrentTime) {
      // We took too long, or something happen and hiccup'd the emulator, reset audio playback times
      this.cancelAllAudio();
      this.audioPlaytime = audioContextCurrentTimeWithLatency;
    }

    // start the source playing
    source.start(this.audioPlaytime);

    // Set our new audio playtime goal
    const sourcePlaybackLength = numberOfSamples / (WASMBOY_SAMPLE_RATE * playbackRate);
    this.audioPlaytime = this.audioPlaytime + sourcePlaybackLength;

    // Cancel all audio sources on the tail that play before us
    while (
      this.audioSources[this.audioSources.length - 1] &&
      this.audioSources[this.audioSources.length - 1].playtime <= this.audioPlaytime
    ) {
      this.audioSources[this.audioSources.length - 1].source.stop();
      this.audioSources.pop();
    }

    // Add the source so we can stop this if needed
    this.audioSources.push({
      source: source,
      playTime: this.audioPlaytime,
      fps: fps
    });

    // Shift ourselves out when finished
    const timeUntilSourceEnds = this.audioPlaytime - this.audioContext.currentTime + 500;
    setTimeout(() => {
      this.audioSources.shift();
    }, timeUntilSourceEnds);
  }

  cancelAllAudio(stopCurrentAudio) {
    if (!this.audioContext) {
      return;
    }

    // Cancel all audio That was queued to play
    for (let i = 0; i < this.audioSources.length; i++) {
      if (stopCurrentAudio || this.audioSources[i].playTime > this.audioPlaytime) {
        this.audioSources[i].source.stop();
      }
    }

    // Reset our audioPlaytime
    this.audioPlaytime = this.audioContext.currentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
  }
}

export const WasmBoyAudio = new WasmBoyAudioService();
