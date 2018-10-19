// Tons of help from:
// https://binji.github.io/2017/02/27/binjgb-on-the-web-part-2.html
// https://github.com/binji/binjgb/blob/master/demo/demo.js
// Web Audio API is tricky!

import Promise from 'promise-polyfill';

import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';

// Define our performance constants
// Both of these make it sound off
// Latency controls how much delay audio has, larger = more delay, goal is to be as small as possible
// Time remaining controls how far ahead we can be., larger = more frames rendered before playing a new set of samples. goal is to be as small as possible. May want to adjust this number according to performance of device
// These magic numbers just come from preference, can be set as options
const DEFAULT_AUDIO_LATENCY_IN_MILLI = 100;
const WASMBOY_MIN_TIME_REMAINING_IN_MILLI = 75;
const WASMBOY_SAMPLE_RATE = 48000;

// Some canstants that use the ones above that will allow for faster performance
const DEFAULT_AUDIO_LATENCY_IN_SECONDS = DEFAULT_AUDIO_LATENCY_IN_MILLI / 1000;
const WASMBOY_MIN_TIME_REMAINING_IN_SECONDS = WASMBOY_MIN_TIME_REMAINING_IN_MILLI / 1000;

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

      this.audioSources = [];
      this.averageTimeStretchFps = [];

      // Get our Audio context
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
    };
    return initializeTask();
  }

  setWorker(worker) {
    this.worker = worker;
    this.worker.addMessageListener(event => {
      const eventData = getEventData(event);

      switch (eventData.message.type) {
        case WORKER_MESSAGE_TYPE.UPDATED: {
          // TODO: Play audio we get back from the audio worker
          // this.playAudio();
          return;
        }
      }
    });
  }

  // Function to queue up and audio buyffer to be played
  // Returns a promise so that we may "sync by audio"
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/dau8e2w/
  playAudio(currentFps, allowFastSpeedStretching) {
    const playAudioTask = async () => {
      // Find our averageFps
      let fps = currentFps || 60;
      // TODO Make this a constant
      let fpsCap = 59;

      // Find our average fps for time stretching
      this.averageTimeStretchFps.push(currentFps);
      // TODO Make the multiplier Const the timeshift speed
      if (this.averageTimeStretchFps.length > Math.floor(fpsCap * 3)) {
        this.averageTimeStretchFps.shift();
      }

      // Make sure we have a minimum number of time stretch fps timestamps to judge the average time
      if (this.averageTimeStretchFps.length >= fpsCap) {
        fps = this.averageTimeStretchFps.reduce((accumulator, currentValue) => {
          return accumulator + currentValue;
        });
        fps = Math.floor(fps / this.averageTimeStretchFps.length);
      }

      // Find if we should time stretch this sample or not from our current fps
      let playbackRate = 1.0;
      if (fps < fpsCap || allowFastSpeedStretching) {
        // Has to be 60 to get accurent playback regarless of fps cap
        playbackRate = playbackRate * (fps / 60);
        if (playbackRate <= 0) {
          playbackRate = 0.01;
        }
      }

      // Check if we need more samples yet
      let timeUntilNextSample;
      if (this.audioPlaytime) {
        timeUntilNextSample = this.audioPlaytime - this.audioContext.currentTime;
        if (timeUntilNextSample > WASMBOY_MIN_TIME_REMAINING_IN_SECONDS && this.audioContext.currentTime > 0) {
          return;
        }
      }

      // Check if we made it in time
      // Idea from: https://github.com/binji/binjgb/blob/master/demo/demo.js
      let audioContextCurrentTime = this.audioContext.currentTime;
      let audioContextCurrentTimeWithLatency = audioContextCurrentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
      this.audioPlaytime = this.audioPlaytime || audioContextCurrentTimeWithLatency;

      if (this.audioPlaytime < audioContextCurrentTime) {
        // We took too long, or something happen and hiccup'd the emulator, reset audio playback times
        this.cancelAllAudio();
        this.audioPlaytime = audioContextCurrentTimeWithLatency;
        return;
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

      // start the source playing
      source.start(this.audioPlaytime);

      // Set our new audio playtime goal
      const sourcePlaybackLength = wasmBoyNumberOfSamples / (WASMBOY_SAMPLE_RATE * playbackRate);
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
    };

    return playAudioTask();
  }

  cancelAllAudio() {
    // Cancel all audio That was queued to play
    for (let i = 0; i < this.audioSources.length; i++) {
      if (this.audioSources[i].playTime > this.audioPlaytime) {
        this.audioSources[i].source.stop();
      }
    }

    // Reset our audioPlaytime
    this.audioPlaytime = this.audioContext.currentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
  }
}

export const WasmBoyAudio = new WasmBoyAudioService();
