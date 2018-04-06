// Tons of help from:
// https://binji.github.io/2017/02/27/binjgb-on-the-web-part-2.html
// https://github.com/binji/binjgb/blob/master/demo/demo.js
// Web Audio API is tricky!

import Promise from 'promise-polyfill';

// Define our performance constants
// Both of these make it sound off
// Latency controls how much delay audio has, larger = more delay, goal is to be as small as possible
// Time remaining controls how far ahead we can be., larger = more frames rendered before playing a new set of samples. goal is to be as small as possible. May want to adjust this number according to performance of device
// These magic numbers just come from preference, can be set as options
const DEFAULT_AUDIO_LATENCY_IN_MILLI = 100;
const WASMBOY_MIN_TIME_REMAINING_IN_MILLI = 75
const WASMBOY_SAMPLE_RATE = 48000;

// Some canstants that use the ones above that will allow for faster performance
const DEFAULT_AUDIO_LATENCY_IN_SECONDS = DEFAULT_AUDIO_LATENCY_IN_MILLI / 1000;
const WASMBOY_MIN_TIME_REMAINING_IN_SECONDS = WASMBOY_MIN_TIME_REMAINING_IN_MILLI / 1000;

const getUnsignedAudioSampleAsFloat = (audioSample) => {
  // Subtract 1 as it is added so the value is not empty
  audioSample -= 1;
  // Divide by 127 to get back to our float scale
  audioSample = audioSample / 127
  // Subtract 1 to regain our sign
  audioSample -= 1;

  // Because of the innacuracy of converting an unsigned int to a signed float
  // We will have some leftovers when doing the conversion.
  // When testing with Pokemon blue, when it is supposed to be complete silence in the intro,
  // It shows 0.007874015748031482, meaning we want to cut our values lower than this
  if (Math.abs(audioSample) < 0.008) {
    audioSample = 0;
  }

  // Return, but divide by lower volume, PCM is loouuuuddd
  return audioSample / 2.5;
}

class WasmBoyAudioService {
    constructor() {
      // Wasmboy instance and memory
      this.wasmInstance = undefined;
      this.wasmByteMemory = undefined;

      this.audioContext = undefined;
      this.audioBuffer = undefined;
      // The play time for our audio samples
      this.audioPlaytime = undefined;
      this.audioSources = [];

      // Average fps for time stretching
      this.averageTimeStretchFps = [];
    }

    initialize(wasmInstance, wasmByteMemory) {
      this.wasmInstance = wasmInstance;
      this.wasmByteMemory = wasmByteMemory;

      this.audioSources = [];
      this.averageTimeStretchFps = [];

      // Get our Audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      return Promise.resolve();
    }

    // Function to queue up and audio buyffer to be played
    // Returns a promise so that we may "sync by audio"
    // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/dau8e2w/
    playAudio(currentFps, allowFastSpeedStretching) {
      return new Promise((resolve) => {

        // Find our averageFps
        let fps = (currentFps) || 60;
        // TODO Make this a constant
        let fpsCap = 59;

        // Find our average fps for time stretching
        this.averageTimeStretchFps.push(currentFps);
        // TODO Make the multiplier Const the timeshift speed
        if (this.averageTimeStretchFps.length > Math.floor(fpsCap * 3)) {
          this.averageTimeStretchFps.shift();
        }

        // Make sure we have a minimum number of time stretch fps timestamps to judge the average time
        if(this.averageTimeStretchFps.length >= fpsCap) {
          fps = this.averageTimeStretchFps.reduce((accumulator, currentValue) => {
            return accumulator + currentValue;
          });
          fps = Math.floor(fps / this.averageTimeStretchFps.length);
        }

        // Find if we should time stretch this sample or not from our current fps
        let playbackRate = 1.0;
        if (fps < fpsCap || allowFastSpeedStretching) {
          // Has to be 60 to get accurent playback regarless of fps cap
          playbackRate = (playbackRate * ((fps) / 60));
          if(playbackRate <= 0) {
            playbackRate = 0.01;
          }
        }

        // Check if we need more samples yet
        let timeUntilNextSample;
        if (this.audioPlaytime) {
          timeUntilNextSample = this.audioPlaytime - this.audioContext.currentTime;
          if (timeUntilNextSample > WASMBOY_MIN_TIME_REMAINING_IN_SECONDS) {
            resolve();
            return;
          }
        }

        // Check if we made it in time
        // Idea from: https://github.com/binji/binjgb/blob/master/demo/demo.js
        let audioContextCurrentTime = this.audioContext.currentTime;
        let audioContextCurrentTimeWithLatency = audioContextCurrentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
        this.audioPlaytime = (this.audioPlaytime || audioContextCurrentTimeWithLatency);

        if (this.audioPlaytime < audioContextCurrentTime) {
          // We took too long, or something happen and hiccup'd the emulator, reset audio playback times
          console.log(`[Wasmboy] Reseting Audio Playback time: ${this.audioPlaytime.toFixed(2)} < ${audioContextCurrentTimeWithLatency.toFixed(2)}, Audio Queue Index: ${this.wasmInstance.exports.getAudioQueueIndex()}`);
          this.cancelAllAudio();
          this.audioPlaytime = audioContextCurrentTimeWithLatency;
          resolve();
          return;
        }

        // Lastly, check if we even have any samples we can play
        if (this.wasmInstance.exports.getAudioQueueIndex() < 4) {
          resolve();
          return true;
        }

        // We made it! Go ahead and grab and play the pcm samples
        let wasmBoyNumberOfSamples = this.wasmInstance.exports.getAudioQueueIndex();

        this.audioBuffer = this.audioContext.createBuffer(2, wasmBoyNumberOfSamples, WASMBOY_SAMPLE_RATE);
        const leftChannelBuffer = this.audioBuffer.getChannelData(0);
        const rightChannelBuffer = this.audioBuffer.getChannelData(1);

        // Our index on our left/right buffers
        let bufferIndex = 0;

        // Our total number of stereo samples
        let wasmBoyNumberOfSamplesForStereo = (wasmBoyNumberOfSamples * 2);

        // Left Channel
        for (let i = 0; i < wasmBoyNumberOfSamplesForStereo; i = i + 2) {
          leftChannelBuffer[bufferIndex] = getUnsignedAudioSampleAsFloat(this.wasmByteMemory[i + this.wasmInstance.exports.soundOutputLocation]);
          bufferIndex++;
        }

        // Reset the buffer index
        bufferIndex = 0;

        // Right Channel
        for (let i = 1; i < wasmBoyNumberOfSamplesForStereo; i = i + 2) {
          rightChannelBuffer[bufferIndex] = getUnsignedAudioSampleAsFloat(this.wasmByteMemory[i + this.wasmInstance.exports.soundOutputLocation]);
          bufferIndex++;
        }

        // Reset the Audio Queue
        this.wasmInstance.exports.resetAudioQueue();

        // Get an AudioBufferSourceNode.
        // This is the AudioNode to use when we want to play an AudioBuffer
        let source = this.audioContext.createBufferSource();

        // set the buffer in the AudioBufferSourceNode
        source.buffer = this.audioBuffer;

        // Set our playback rate for time resetretching
        source.playbackRate.setValueAtTime(playbackRate, this.audioContext.currentTime);

        // connect the AudioBufferSourceNode to the
        // destination so we can hear the sound
        source.connect(this.audioContext.destination);

        // start the source playing
        source.start(this.audioPlaytime);

        // Set our new audio playtime goal
        const sourcePlaybackLength = (wasmBoyNumberOfSamples / (WASMBOY_SAMPLE_RATE * playbackRate));
        this.audioPlaytime = this.audioPlaytime + sourcePlaybackLength;

        // Cancel all audio sources on the tail that play before us
        while(this.audioSources[this.audioSources.length - 1] && this.audioSources[this.audioSources.length - 1].playtime <= this.audioPlaytime) {
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
        const timeUntilSourceEnds = (this.audioPlaytime - this.audioContext.currentTime) + 500;
        setTimeout(() => {
          this.audioSources.shift();
        }, timeUntilSourceEnds);

        resolve();
      });
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

    debugSaveCurrentAudioBufferToWav() {

      if(!this.audioBuffer) {
        return;
      }

      // https://www.npmjs.com/package/audiobuffer-to-wav
      const toWav = require('audiobuffer-to-wav');
      // https://github.com/Jam3/audiobuffer-to-wav/blob/master/demo/index.js

      const wav = toWav(this.audioBuffer);
      const blob = new window.Blob([ new DataView(wav) ], {
        type: 'audio/wav'
      });

      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      document.body.appendChild(anchor)
      anchor.style = 'display: none'
      anchor.href = url
      anchor.download = 'audio.wav'
      anchor.click()
      window.URL.revokeObjectURL(url)
    }
}

export const WasmBoyAudio = new WasmBoyAudioService();
