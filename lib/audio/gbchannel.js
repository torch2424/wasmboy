// Gameboy Channel Output
// With outputting to Web Audio API

import { WasmBoyPlugins } from '../plugins/plugins';

import toWav from 'audiobuffer-to-wav';

// Define our performance constants
// Both of these make it sound off
// Latency controls how much delay audio has, larger = more delay, goal is to be as small as possible
// Time remaining controls how far ahead we can be., larger = more frames rendered before playing a new set of samples. goal is to be as small as possible. May want to adjust this number according to performance of device
// These magic numbers just come from preference, can be set as options
const DEFAULT_AUDIO_LATENCY_IN_MILLI = 100;
// Some constants that use the ones above that will allow for faster performance
const DEFAULT_AUDIO_LATENCY_IN_SECONDS = DEFAULT_AUDIO_LATENCY_IN_MILLI / 1000;

// Seems like the super quiet popping, and the wace form spikes in the visualizer,
// are caused by the sample rate :P
// Thus need to figure out why that is.
const WASMBOY_SAMPLE_RATE = 44100;

export default class GbChannelWebAudio {
  constructor(id) {
    this.id = id;

    this.audioContext = undefined;
    this.audioBuffer = undefined;
    // The play time for our audio samples
    this.audioPlaytime = undefined;
    this.audioSources = [];

    // Gain Node for muting
    this.gainNode = undefined;
    this.muted = false;
    this.libMuted = false;

    // Our buffer for recording PCM Samples as they come
    this.recording = false;
    this.recordingLeftBuffers = undefined;
    this.recordingRightBuffers = undefined;
    this.recordingAudioBuffer = undefined;
    this.recordingAnchor = undefined;
  }

  createAudioContextIfNone() {
    if (!this.audioContext && typeof window !== 'undefined') {
      // Get our Audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Set up our nodes
      // Seems like closure compiler will optimize this out
      // Thus, need to do a very specifc type check if statement here.
      if (!!this.audioContext === true) {
        this.gainNode = this.audioContext.createGain();
      }
    }
  }

  getCurrentTime() {
    this.createAudioContextIfNone();

    if (!this.audioContext) {
      return;
    }

    return this.audioContext.currentTime;
  }

  getPlayTime() {
    return this.audioPlaytime;
  }

  resumeAudioContext() {
    this.createAudioContextIfNone();

    if (!this.audioContext) {
      return;
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      this.audioPlaytime = this.audioContext.currentTime;
    }
  }

  playAudio(numberOfSamples, leftChannelBuffer, rightChannelBuffer, playbackRate, updateAudioCallback) {
    if (!this.audioContext) {
      return;
    }

    // Get our buffers as floats
    const leftChannelBufferAsFloat = new Float32Array(leftChannelBuffer);
    const rightChannelBufferAsFloat = new Float32Array(rightChannelBuffer);

    // Create an audio buffer, with a left and right channel
    this.audioBuffer = this.audioContext.createBuffer(2, numberOfSamples, WASMBOY_SAMPLE_RATE);
    this._setSamplesToAudioBuffer(this.audioBuffer, leftChannelBufferAsFloat, rightChannelBufferAsFloat);

    if (this.recording) {
      this.recordingLeftBuffers.push(leftChannelBufferAsFloat);
      this.recordingRightBuffers.push(rightChannelBufferAsFloat);
    }

    // Get an AudioBufferSourceNode.
    // This is the AudioNode to use when we want to play an AudioBuffer
    let source = this.audioContext.createBufferSource();

    // set the buffer in the AudioBufferSourceNode
    source.buffer = this.audioBuffer;

    // Set our playback rate for time resetretching
    source.playbackRate.setValueAtTime(playbackRate, this.audioContext.currentTime);

    // Set up our "final node", as in the one that will be connected
    // to the destination (output)
    let finalNode = source;

    // Call our callback/plugins, if we have one
    if (updateAudioCallback) {
      const responseNode = updateAudioCallback(this.audioContext, finalNode, this.id);
      if (responseNode) {
        finalNode = responseNode;
      }
    }

    // Call our plugins
    WasmBoyPlugins.runHook({
      key: 'audio',
      params: [this.audioContext, finalNode, this.id],
      callback: hookResponse => {
        if (hookResponse) {
          finalNode.connect(hookResponse);
          finalNode = hookResponse;
        }
      }
    });

    // Lastly, apply our gain node to mute/unmute
    if (this.gainNode) {
      finalNode.connect(this.gainNode);
      finalNode = this.gainNode;
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
      playTime: this.audioPlaytime
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

    this.audioSources = [];

    // Reset our audioPlaytime
    this.audioPlaytime = this.audioContext.currentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
  }

  mute() {
    if (!this.muted) {
      this._setGain(0);
      this.muted = true;
    }
  }

  unmute() {
    if (this.muted) {
      this._setGain(1);
      this.muted = false;
    }
  }

  hasRecording() {
    return !!this.recordingAudioBuffer;
  }

  startRecording() {
    if (!this.recording) {
      this.recording = true;
      this.recordingLeftBuffers = [];
      this.recordingRightBuffers = [];
      this.recordingAudioBuffer = undefined;
    }
  }

  stopRecording() {
    // Check if we were recoridng
    if (!this.recording) {
      return;
    }

    this.recording = false;

    // Create a left/right buffer from all the buffers stored
    const createBufferFromBuffers = buffers => {
      let totalLength = 0;
      buffers.forEach(buffer => {
        totalLength += buffer.length;
      });

      const totalBuffer = new Float32Array(totalLength);
      let currentLength = 0;
      buffers.forEach(buffer => {
        totalBuffer.set(buffer, currentLength);
        currentLength += buffer.length;
      });

      return totalBuffer;
    };

    const totalLeftBuffer = createBufferFromBuffers(this.recordingLeftBuffers);
    const totalRightBuffer = createBufferFromBuffers(this.recordingRightBuffers);
    this.recordingAudioBuffer = this.audioContext.createBuffer(2, totalLeftBuffer.length, WASMBOY_SAMPLE_RATE);
    this._setSamplesToAudioBuffer(this.recordingAudioBuffer, totalLeftBuffer, totalRightBuffer);

    this.recordingLeftBuffer = undefined;
    this.recordingRightBuffer = undefined;
  }

  downloadRecordingAsWav(filename) {
    if (!this.recordingAudioBuffer) {
      return;
    }

    // Check if we need to create our anchor tag
    // Which is used to download the audio
    if (!this.recordingAnchor) {
      this.recordingAnchor = document.createElement('a');
      document.body.appendChild(this.recordingAnchor);
      this.recordingAnchor.style = 'display: none';
    }

    // Create our wav as a downloadable blob
    const wav = toWav(this.recordingAudioBuffer);
    const blob = new window.Blob([new DataView(wav)], {
      type: 'audio/wav'
    });

    // Create our url / download name
    const url = window.URL.createObjectURL(blob);
    this.recordingAnchor.href = url;
    let downloadName;
    if (filename) {
      downloadName = `${filename}.wav`;
    } else {
      const shortDateWithTime = new Date().toLocaleDateString(undefined, {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      downloadName = `wasmboy-${shortDateWithTime}.wav`;
    }
    this.recordingAnchor.download = downloadName;

    // Download our wav
    this.recordingAnchor.click();
    window.URL.revokeObjectURL(url);
  }

  getRecordingAsWavBase64EncodedString() {
    if (!this.recordingAudioBuffer) {
      return;
    }

    // Create our wav as a downloadable blob
    const wav = toWav(this.recordingAudioBuffer);
    const base64String = this._arrayBufferToBase64(wav);

    return `data:audio/wav;base64,${base64String}`;
  }

  getRecordingAsAudioBuffer() {
    return this.recordingAudioBuffer;
  }

  _libMute() {
    this._setGain(0);
    this.libMuted = true;
  }

  _libUnmute() {
    if (this.libMuted) {
      this._setGain(1);
      this.libMuted = false;
    }
  }

  _setGain(gain) {
    this.createAudioContextIfNone();
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
    }
  }

  _setSamplesToAudioBuffer(audioBuffer, leftChannelSamples, rightChannelSamples) {
    if (audioBuffer.copyToChannel) {
      audioBuffer.copyToChannel(leftChannelSamples, 0, 0);
      audioBuffer.copyToChannel(rightChannelSamples, 1, 0);
    } else {
      // Safari fallback
      audioBuffer.getChannelData(0).set(leftChannelSamples);
      audioBuffer.getChannelData(1).set(rightChannelSamples);
    }
  }

  // https://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string/38858127
  _arrayBufferToBase64(buffer) {
    let binary = '';
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
