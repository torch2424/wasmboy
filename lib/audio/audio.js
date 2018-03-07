// Tons of help from:
// https://binji.github.io/2017/02/27/binjgb-on-the-web-part-2.html
// https://github.com/binji/binjgb/blob/master/demo/demo.js
// Web Audio API is tricky!

import Promise from 'promise-polyfill';

// Define our constants
const DEFAULT_AUDIO_LATENCY = 0.1;
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
const WASMBOY_MEMORY_SOUND_INDEX = 0x053800;
const WASMBOY_SAMPLE_RATE = 48000;
// NOTE: Giving a really large sample rate gives more latency, but less pops!
const WASMBOY_MIN_NUMBER_OF_SAMPLES = 4096;

class WasmBoyAudioService {
    constructor() {
      // Wasmboy instance and memory
      this.wasmInstance = undefined;
      this.wasmByteMemory = undefined;

      this.audioContext = undefined;
      this.audioBuffer = undefined;
      // The play time for our audio samples
      this.audioPlaytime = 0;
    }

    initialize(wasmInstance, wasmByteMemory) {
      this.wasmInstance = wasmInstance;
      this.wasmByteMemory = wasmByteMemory;

      // Get our Audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      return Promise.resolve();
    }

    playAudio() {

      // Wait until we fill the queue
      if(this.wasmInstance.exports.getAudioQueueIndex() < WASMBOY_MIN_NUMBER_OF_SAMPLES) {
        return;
      }

      // Check if we made it in time
      // Idea from: https://github.com/binji/binjgb/blob/master/demo/demo.js
      let audioContextCurrentTime = this.audioContext.currentTime;
      let audioContextCurrentTimeWithLatency = audioContextCurrentTime + DEFAULT_AUDIO_LATENCY;
      this.audioPlaytime = (this.audioPlaytime || audioContextCurrentTimeWithLatency);

      if (this.audioPlaytime < audioContextCurrentTime) {
        // We took too long, or something happen and hiccup'd the emulator, reset audio playback times
        console.log(`[Wasmboy] Reseting Audio Playback time: ${this.audioPlaytime.toFixed(2)} < ${audioContextCurrentTimeWithLatency.toFixed(2)}`);
        this.audioPlaytime = audioContextCurrentTimeWithLatency;
      } else {
        // We made it! Go ahead and grab and play the pcm samples

        let wasmBoyNumberOfSamples = this.wasmInstance.exports.getAudioQueueIndex();

        this.audioBuffer = this.audioContext.createBuffer(2, wasmBoyNumberOfSamples, WASMBOY_SAMPLE_RATE);
        const leftChannelBuffer = this.audioBuffer.getChannelData(0);
        const rightChannelBuffer = this.audioBuffer.getChannelData(1);

        // Our index on our left/right buffers
        let bufferIndex = 0;

        // Iterate through our samples
        // * 2 For Left and right
        for (let i =  WASMBOY_MEMORY_SOUND_INDEX; (i -  WASMBOY_MEMORY_SOUND_INDEX) < (wasmBoyNumberOfSamples * 2); i++) {

          // Get our audio sample
          let audioSample = this.wasmByteMemory[i];

          // Subtract 1 as it is added so the value is not empty
          audioSample -= 1;
          // Divide by 127 to get back to our float scale
          audioSample = audioSample / 127
          // Subtract 1 to regain our sign
          audioSample -= 1;


          // Find which channel the sample is going to
          // Always Left / right, increase index
          if((i - WASMBOY_MEMORY_SOUND_INDEX) % 2 == 0) {
            leftChannelBuffer[bufferIndex] = audioSample;
          } else {
            rightChannelBuffer[bufferIndex] = audioSample;
            // Increase the buffer index, since there are two samples (left and right) per index of a sample
            bufferIndex += 1;
          }

          // Clear the value
          this.wasmByteMemory[i] = 0;
        }

        // Reset the Audio Queue
        this.wasmInstance.exports.resetAudioQueue();

        // Get an AudioBufferSourceNode.
        // This is the AudioNode to use when we want to play an AudioBuffer
        let source = this.audioContext.createBufferSource();

        // set the buffer in the AudioBufferSourceNode
        source.buffer = this.audioBuffer;

        // connect the AudioBufferSourceNode to the
        // destination so we can hear the sound
        source.connect(this.audioContext.destination);

        // start the source playing
        source.start(this.audioPlaytime);

        // Set our new audio playtime goal
        this.audioPlaytime = this.audioPlaytime + (wasmBoyNumberOfSamples / WASMBOY_SAMPLE_RATE);
      }
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