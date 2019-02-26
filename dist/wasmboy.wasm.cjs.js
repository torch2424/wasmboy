'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// Some shared constants by the graphics lib and worker
const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;

const WORKER_MESSAGE_TYPE = {
  CONNECT: 'CONNECT',
  INSTANTIATE_WASM: 'INSTANTIATE_WASM',
  CLEAR_MEMORY: 'CLEAR_MEMORY',
  CLEAR_MEMORY_DONE: 'CLEAR_MEMORY_DONE',
  GET_MEMORY: 'GET_MEMORY',
  SET_MEMORY: 'SET_MEMORY',
  SET_MEMORY_DONE: 'SET_MEMORY_DONE',
  GET_CONSTANTS: 'GET_CONSTANTS',
  GET_CONSTANTS_DONE: 'GET_CONSTANTS_DONE',
  CONFIG: 'CONFIG',
  RESET_AUDIO_QUEUE: 'RESET_AUDIO_QUEUE',
  PLAY: 'PLAY',
  BREAKPOINT: 'BREAKPOINT',
  PAUSE: 'PAUSE',
  UPDATED: 'UPDATED',
  CRASHED: 'CRASHED',
  SET_JOYPAD_STATE: 'SET_JOYPAD_STATE',
  AUDIO_LATENCY: 'AUDIO_LATENCY',
  RUN_WASM_EXPORT: 'RUN_WASM_EXPORT',
  GET_WASM_MEMORY_SECTION: 'GET_WASM_MEMORY_SECTION',
  GET_WASM_CONSTANT: 'GET_WASM_CONSTANT',
  FORCE_OUTPUT_FRAME: 'FORCE_OUTPUT_FRAME',
  SET_SPEED: 'SET_SPEED',
  IS_GBC: 'IS_GBC'
};
const WORKER_ID = {
  LIB: 'LIB',
  GRAPHICS: 'GRAPHICS',
  MEMORY: 'MEMORY',
  CONTROLLER: 'CONTROLLER',
  AUDIO: 'AUDIO'
};
const MEMORY_TYPE = {
  CARTRIDGE_RAM: 'CARTRIDGE_RAM',
  CARTRIDGE_ROM: 'CARTRIDGE_ROM',
  CARTRIDGE_HEADER: 'CARTRIDGE_HEADER',
  GAMEBOY_MEMORY: 'GAMEBOY_MEMORY',
  PALETTE_MEMORY: 'PALETTE_MEMORY',
  INTERNAL_STATE: 'INTERNAL_STATE'
};

function getEventData(event) {
  if (event.data) {
    return event.data;
  }

  return event;
}
const isInBrowser = typeof self !== 'undefined'; // Function to read a base64 string as a buffer

function readBase64String(base64String) {
  if (isInBrowser) {
    return base64String;
  } else {
    return readBase64Buffer(base64String).toString('utf8');
  }
}
function readBase64Buffer(base64String) {
  return Buffer.from(base64String.split(',')[1], 'base64');
}

// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

class WasmBoyGraphicsService {
  constructor() {
    this.worker = undefined;
    this.updateGraphicsCallback = undefined;
    this.frameQueue = undefined;
    this.frameQueueRenderPromise = undefined;
    this.canvasElement = undefined;
    this.canvasContext = undefined;
    this.canvasImageData = undefined;
    this.imageDataArray = undefined;
    this.imageDataArrayChanged = false;
  }

  initialize(canvasElement, updateGraphicsCallback) {
    this.updateGraphicsCallback = updateGraphicsCallback; // Initialiuze our cached wasm constants
    // WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = this.wasmInstance.exports.frameInProgressGRAPHICS_OUTPUT_LOCATION.valueOf();
    // Reset our frame queue and render promises

    this.frameQueue = [];

    const initializeTask = async () => {
      // Prepare our canvas
      this.canvasElement = canvasElement;
      this.canvasContext = this.canvasElement.getContext('2d');
      this.canvasElement.width = GAMEBOY_CAMERA_WIDTH;
      this.canvasElement.height = GAMEBOY_CAMERA_HEIGHT;
      this.canvasImageData = this.canvasContext.createImageData(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT); // Add some css for smooth 8-bit canvas scaling
      // https://stackoverflow.com/questions/7615009/disable-interpolation-when-scaling-a-canvas
      // https://caniuse.com/#feat=css-crisp-edges

      this.canvasElement.style = `
        image-rendering: optimizeSpeed;
        image-rendering: -moz-crisp-edges;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: -o-crisp-edges;
        image-rendering: pixelated;
        -ms-interpolation-mode: nearest-neighbor;
      `; // Fill the canvas with a blank screen
      // using client width since we are not requiring a width and height oin the canvas
      // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
      // TODO: Mention respopnsive canvas scaling in the docs

      this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height); // Finally make sure we set our constants for our worker

      if (this.worker) {
        await this.worker.postMessage({
          type: WORKER_MESSAGE_TYPE.GET_CONSTANTS
        });
      }
    };

    return initializeTask();
  } // Function to set our worker


  setWorker(worker) {
    this.worker = worker;
    this.worker.addMessageListener(event => {
      const eventData = getEventData(event);

      switch (eventData.message.type) {
        case WORKER_MESSAGE_TYPE.UPDATED:
          {
            this.imageDataArray = new Uint8ClampedArray(eventData.message.imageDataArrayBuffer);
            this.imageDataArrayChanged = true;
            return;
          }
      }
    });
  } // Function to render a frame
  // Will add the frame to the frame queue to be rendered
  // Returns the promise from this.drawFrameQueue
  // Which resolves once all frames are rendered


  renderFrame() {
    // Check if we have new graphics to show
    if (!this.imageDataArrayChanged) {
      return;
    }

    this.imageDataArrayChanged = false; // Check for a callback for accessing image data

    if (this.updateGraphicsCallback) {
      this.updateGraphicsCallback(this.imageDataArray);
    } // Add our new imageData


    this.canvasImageData.data.set(this.imageDataArray);
    this.canvasContext.clearRect(0, 0, GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);
    this.canvasContext.putImageData(this.canvasImageData, 0, 0);
  }

}

const WasmBoyGraphics = new WasmBoyGraphicsService();

function index(buffer, opt) {
  opt = opt || {};

  var numChannels = buffer.numberOfChannels;
  var sampleRate = buffer.sampleRate;
  var format = opt.float32 ? 3 : 1;
  var bitDepth = format === 3 ? 32 : 16;

  var result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  return encodeWAV(result, format, sampleRate, numChannels, bitDepth)
}

function encodeWAV (samples, format, sampleRate, numChannels, bitDepth) {
  var bytesPerSample = bitDepth / 8;
  var blockAlign = numChannels * bytesPerSample;

  var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  var view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);
  if (format === 1) { // Raw PCM
    floatTo16BitPCM(view, 44, samples);
  } else {
    writeFloat32(view, 44, samples);
  }

  return buffer
}

function interleave (inputL, inputR) {
  var length = inputL.length + inputR.length;
  var result = new Float32Array(length);

  var index = 0;
  var inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result
}

function writeFloat32 (output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true);
  }
}

function floatTo16BitPCM (output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString (view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Gameboy Channel Output
// Both of these make it sound off
// Latency controls how much delay audio has, larger = more delay, goal is to be as small as possible
// Time remaining controls how far ahead we can be., larger = more frames rendered before playing a new set of samples. goal is to be as small as possible. May want to adjust this number according to performance of device
// These magic numbers just come from preference, can be set as options

const DEFAULT_AUDIO_LATENCY_IN_MILLI = 100; // Some constants that use the ones above that will allow for faster performance

const DEFAULT_AUDIO_LATENCY_IN_SECONDS = DEFAULT_AUDIO_LATENCY_IN_MILLI / 1000;
const WASMBOY_SAMPLE_RATE = 48000;
class GbChannelWebAudio {
  constructor(id) {
    this.id = id;
    this.audioContext = undefined;
    this.audioBuffer = undefined; // The play time for our audio samples

    this.audioPlaytime = undefined;
    this.audioSources = []; // Gain Node for muting

    this.gainNode = undefined;
    this.muted = false;
    this.libMuted = false; // Our buffer for recording PCM Samples as they come

    this.recording = false;
    this.recordingLeftBuffers = undefined;
    this.recordingRightBuffers = undefined;
    this.recordingAudioBuffer = undefined;
    this.recordingAnchor = undefined; // Additional Audio Nodes for connecting

    this.additionalAudioNodes = [];
  }

  createAudioContextIfNone() {
    if (!this.audioContext && typeof window !== 'undefined') {
      // Get our Audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); // Set up our nodes

      this.gainNode = this.audioContext.createGain();
    }
  }

  getCurrentTime() {
    this.createAudioContextIfNone();
    return this.audioContext.currentTime;
  }

  getPlayTime() {
    return this.audioPlaytime;
  }

  resumeAudioContext() {
    this.createAudioContextIfNone();

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      this.audioPlaytime = this.audioContext.currentTime;
    }
  }

  playAudio(numberOfSamples, leftChannelBuffer, rightChannelBuffer, playbackRate, updateAudioCallback) {
    // Get our buffers as floats
    const leftChannelBufferAsFloat = new Float32Array(leftChannelBuffer);
    const rightChannelBufferAsFloat = new Float32Array(rightChannelBuffer); // Create an audio buffer, with a left and right channel

    this.audioBuffer = this.audioContext.createBuffer(2, numberOfSamples, WASMBOY_SAMPLE_RATE);

    this._setSamplesToAudioBuffer(this.audioBuffer, leftChannelBufferAsFloat, rightChannelBufferAsFloat);

    if (this.recording) {
      this.recordingLeftBuffers.push(leftChannelBufferAsFloat);
      this.recordingRightBuffers.push(rightChannelBufferAsFloat);
    } // Get an AudioBufferSourceNode.
    // This is the AudioNode to use when we want to play an AudioBuffer


    let source = this.audioContext.createBufferSource(); // set the buffer in the AudioBufferSourceNode

    source.buffer = this.audioBuffer; // Set our playback rate for time resetretching

    source.playbackRate.setValueAtTime(playbackRate, this.audioContext.currentTime);
    let lastAdditionalNode = source;
    this.additionalAudioNodes.forEach(node => {
      lastAdditionalNode.connect(node);
      lastAdditionalNode = node;
    }); // Connect to our gain node for volume control

    lastAdditionalNode.connect(this.gainNode); // Call our callback, if we have one

    let finalNode = this.gainNode;

    if (updateAudioCallback) {
      const responseNode = updateAudioCallback(this.audioContext, this.gainNode, this.id);

      if (responseNode) {
        finalNode = responseNode;
      }
    } // connect the AudioBufferSourceNode to the
    // destination so we can hear the sound


    finalNode.connect(this.audioContext.destination); // Check if we made it in time
    // Idea from: https://github.com/binji/binjgb/blob/master/demo/demo.js

    let audioContextCurrentTime = this.audioContext.currentTime;
    let audioContextCurrentTimeWithLatency = audioContextCurrentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
    this.audioPlaytime = this.audioPlaytime || audioContextCurrentTimeWithLatency;

    if (this.audioPlaytime < audioContextCurrentTime) {
      // We took too long, or something happen and hiccup'd the emulator, reset audio playback times
      this.cancelAllAudio();
      this.audioPlaytime = audioContextCurrentTimeWithLatency;
    } // start the source playing


    source.start(this.audioPlaytime); // Set our new audio playtime goal

    const sourcePlaybackLength = numberOfSamples / (WASMBOY_SAMPLE_RATE * playbackRate);
    this.audioPlaytime = this.audioPlaytime + sourcePlaybackLength; // Cancel all audio sources on the tail that play before us

    while (this.audioSources[this.audioSources.length - 1] && this.audioSources[this.audioSources.length - 1].playtime <= this.audioPlaytime) {
      this.audioSources[this.audioSources.length - 1].source.stop();
      this.audioSources.pop();
    } // Add the source so we can stop this if needed


    this.audioSources.push({
      source: source,
      playTime: this.audioPlaytime
    }); // Shift ourselves out when finished

    const timeUntilSourceEnds = this.audioPlaytime - this.audioContext.currentTime + 500;
    setTimeout(() => {
      this.audioSources.shift();
    }, timeUntilSourceEnds);
  }

  cancelAllAudio(stopCurrentAudio) {
    if (!this.audioContext) {
      return;
    } // Cancel all audio That was queued to play


    for (let i = 0; i < this.audioSources.length; i++) {
      if (stopCurrentAudio || this.audioSources[i].playTime > this.audioPlaytime) {
        this.audioSources[i].source.stop();
      }
    }

    this.audioSources = []; // Reset our audioPlaytime

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

    this.recording = false; // Create a left/right buffer from all the buffers stored

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
    } // Check if we need to create our anchor tag
    // Which is used to download the audio


    if (!this.recordingAnchor) {
      this.recordingAnchor = document.createElement('a');
      document.body.appendChild(this.recordingAnchor);
      this.recordingAnchor.style = 'display: none';
    } // Create our wav as a downloadable blob


    const wav = index(this.recordingAudioBuffer);
    const blob = new window.Blob([new DataView(wav)], {
      type: 'audio/wav'
    }); // Create our url / download name

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

    this.recordingAnchor.download = downloadName; // Download our wav

    this.recordingAnchor.click();
    window.URL.revokeObjectURL(url);
  }

  getRecordingAsWavBase64EncodedString() {
    if (!this.recordingAudioBuffer) {
      return;
    } // Create our wav as a downloadable blob


    const wav = index(this.recordingAudioBuffer);

    const base64String = this._arrayBufferToBase64(wav);

    return `data:audio/wav;base64,${base64String}`;
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
    this.gainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
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
  } // https://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string/38858127


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

// Tons of help from:

const SLOW_TIME_STRETCH_MIN_FPS = 57;

class WasmBoyAudioService {
  constructor() {
    // Wasmboy instance and memory
    this.worker = undefined;
    this.updateAudioCallback = undefined; // Our Channels

    this.gbChannels = {
      master: new GbChannelWebAudio('master'),
      channel1: new GbChannelWebAudio('channel1'),
      channel2: new GbChannelWebAudio('channel2'),
      channel3: new GbChannelWebAudio('channel3'),
      channel4: new GbChannelWebAudio('channel4')
    };

    this._createAudioContextIfNone(); // Mute all the child channels,
    // As we will assume all channels are enabled


    if (typeof window !== 'undefined') {
      this.gbChannels.channel1._libMute();

      this.gbChannels.channel2._libMute();

      this.gbChannels.channel3._libMute();

      this.gbChannels.channel4._libMute();
    } // Average fps for time stretching


    this.averageTimeStretchFps = [];
    this.speed = 1.0; // Our sound output Location, we will initialize this in init

    this.WASMBOY_SOUND_OUTPUT_LOCATION = 0;
    this.WASMBOY_CHANNEL_1_OUTPUT_LOCATION = 0;
    this.WASMBOY_CHANNEL_2_OUTPUT_LOCATION = 0;
    this.WASMBOY_CHANNEL_3_OUTPUT_LOCATION = 0;
    this.WASMBOY_CHANNEL_4_OUTPUT_LOCATION = 0;
  }

  initialize(updateAudioCallback) {
    const initializeTask = async () => {
      this.updateAudioCallback = updateAudioCallback;
      this.averageTimeStretchFps = [];
      this.speed = 1.0;

      this._createAudioContextIfNone();

      this.cancelAllAudio(); // Lastly get our audio constants

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
        case WORKER_MESSAGE_TYPE.UPDATED:
          {
            // Dont wait for raf.
            // Audio being shown is not dependent on the browser drawing a frame :)
            // Just send the message directly
            this.playAudio(eventData.message); // Next, send back how much forward latency
            // we have

            let latency = 0;
            let currentTime = this.gbChannels.master.getCurrentTime();
            let playtime = this.gbChannels.master.getPlayTime();

            if (currentTime && currentTime > 0) {
              latency = playtime - currentTime;
            }

            this.worker.postMessageIgnoreResponse({
              type: WORKER_MESSAGE_TYPE.AUDIO_LATENCY,
              latency
            });
            return;
          }
      }
    });
  }

  getAudioChannels() {
    return this.gbChannels;
  }

  setSpeed(speed) {
    this.speed = speed;
    this.cancelAllAudio(true);
    this.resetTimeStretch();
  }

  resetTimeStretch() {
    // Simply reset our average FPS counter array
    this.averageTimeStretchFps = [];
  } // Function to queue up and audio buyffer to be played
  // Returns a promise so that we may "sync by audio"
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/dau8e2w/


  playAudio(audioMessage) {
    let currentFps = audioMessage.fps;
    let allowFastSpeedStretching = audioMessage.allowFastSpeedStretching;
    let numberOfSamples = audioMessage.numberOfSamples; // Find our averageFps

    let fps = currentFps || 60; // Check if we got a huge fps outlier.
    // If so, let's just reset our average.
    // This will fix the slow gradual ramp down

    const fpsDifference = Math.abs(currentFps - this.averageTimeStretchFps[this.averageTimeStretchFps.length - 1]);

    if (fpsDifference && fpsDifference >= 15) {
      this.resetTimeStretch();
    } // Find our average fps for time stretching


    this.averageTimeStretchFps.push(currentFps); // TODO Make the multiplier Const the timeshift speed

    if (this.averageTimeStretchFps.length > Math.floor(SLOW_TIME_STRETCH_MIN_FPS * 3)) {
      this.averageTimeStretchFps.shift();
    } // Make sure we have a minimum number of time stretch fps timestamps to judge the average time


    if (this.averageTimeStretchFps.length >= SLOW_TIME_STRETCH_MIN_FPS) {
      fps = this.averageTimeStretchFps.reduce((accumulator, currentValue) => {
        return accumulator + currentValue;
      });
      fps = Math.floor(fps / this.averageTimeStretchFps.length);
    } // Find if we should time stretch this sample or not from our current fps


    let playbackRate = 1.0;
    let shouldTimeStretch = (fps < SLOW_TIME_STRETCH_MIN_FPS || allowFastSpeedStretching) && this.speed === 1.0;

    if (shouldTimeStretch) {
      // Has to be 60 to get accurent playback regarless of fps cap
      playbackRate = playbackRate * (fps / 60);

      if (playbackRate <= 0) {
        playbackRate = 0.01;
      }
    } // Apply our speed to the playback rate


    playbackRate = playbackRate * this.speed; // Play the master channel

    this.gbChannels.master.playAudio(numberOfSamples, audioMessage.audioBuffer.left, audioMessage.audioBuffer.right, playbackRate, this.updateAudioCallback); // Play on all of our channels if we have buffers for them

    for (let i = 0; i < 4; i++) {
      let channelNumber = i + 1;

      if (audioMessage[`channel${channelNumber}Buffer`]) {
        this.gbChannels[`channel${channelNumber}`].playAudio(numberOfSamples, audioMessage[`channel${channelNumber}Buffer`].left, audioMessage[`channel${channelNumber}Buffer`].right, playbackRate, this.updateAudioCallback);
      }
    }

    let playingAllChannels = !this.gbChannels.channel1.muted && !this.gbChannels.channel2.muted && !this.gbChannels.channel3.muted && !this.gbChannels.channel4.muted; // Mute and unmute accordingly

    if (this.gbChannels.master.muted && playingAllChannels) {
      this.gbChannels.master.unmute(); // We want to "force" mute here
      // Because master is secretly playing all the audio,
      // But we want the channels to appear not muted :)

      this.gbChannels.channel1._libMute();

      this.gbChannels.channel2._libMute();

      this.gbChannels.channel3._libMute();

      this.gbChannels.channel4._libMute();
    } else if (!this.gbChannels.master.muted && !playingAllChannels) {
      this.gbChannels.master.mute();

      this.gbChannels.channel1._libUnmute();

      this.gbChannels.channel2._libUnmute();

      this.gbChannels.channel3._libUnmute();

      this.gbChannels.channel4._libUnmute();
    }
  } // Functions to simply run on all of our channels
  // Ensure that Audio is blessed.
  // Meaning, the audioContext won't be
  // affected by any autoplay issues.
  // https://www.chromium.org/audio-video/autoplay


  resumeAudioContext() {
    this._applyOnAllChannels('resumeAudioContext');
  }

  cancelAllAudio(stopCurrentAudio) {
    this._applyOnAllChannels('cancelAllAudio', [stopCurrentAudio]);
  }

  _createAudioContextIfNone() {
    this._applyOnAllChannels('createAudioContextIfNone');
  }

  _applyOnAllChannels(functionKey, argsArray) {
    Object.keys(this.gbChannels).forEach(gbChannelKey => {
      this.gbChannels[gbChannelKey][functionKey].apply(this.gbChannels[gbChannelKey], argsArray);
    });
  }

}

const WasmBoyAudio = new WasmBoyAudioService();

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    var ownKeys = Object.keys(source);

    if (typeof Object.getOwnPropertySymbols === 'function') {
      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }

    ownKeys.forEach(function (key) {
      _defineProperty(target, key, source[key]);
    });
  }

  return target;
}

// Get our idb instance, and initialize to asn idb-keyval
// This is so we don't get the default keyval DB name. And will allow
// Parent projects to use the slimmer idb keyval
// https://www.npmjs.com/package/idb
// Need to wrap in rollup replace to stop
// node commonjs from breaking

/*ROLLUP_REPLACE_BROWSER
import idb from 'idb';
ROLLUP_REPLACE_BROWSER*/
let keyval = false; // Get our idb dPromise

if (typeof window !== 'undefined') {
  const dbPromise = idb.open('wasmboy', 1, upgradeDB => {
    upgradeDB.createObjectStore('keyval');
  }); // Get our idb-keyval instance

  keyval = {
    get(key) {
      return dbPromise.then(db => {
        return db.transaction('keyval').objectStore('keyval').get(key);
      });
    },

    set(key, val) {
      return dbPromise.then(db => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(val, key);
        return tx.complete;
      });
    },

    delete(key) {
      return dbPromise.then(db => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').delete(key);
        return tx.complete;
      });
    },

    clear() {
      return dbPromise.then(db => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').clear();
        return tx.complete;
      });
    },

    keys() {
      return dbPromise.then(db => {
        const tx = db.transaction('keyval');
        const keys = [];
        const store = tx.objectStore('keyval'); // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
        // openKeyCursor isn't supported by Safari, so we fall back

        (store.iterateKeyCursor || store.iterateCursor).call(store, cursor => {
          if (!cursor) return;
          keys.push(cursor.key);
          cursor.continue();
        });
        return tx.complete.then(() => keys);
      });
    }

  };
}

const idbKeyval = keyval;

// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions
//  Will save the state in parts, to easy memory map changes:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
const WASMBOY_SAVE_STATE_SCHEMA = {
  wasmboyMemory: {
    wasmBoyInternalState: [],
    wasmBoyPaletteMemory: [],
    gameBoyMemory: [],
    cartridgeRam: []
  },
  date: undefined,
  isAuto: undefined
}; // Function to return a save state of the current memory

function getSaveState() {
  // Save our internal wasmboy state to memory
  // Should be done whenever we send back memory
  // this.wasmInstance.exports.saveState();
  let saveState = Object.assign({}, WASMBOY_SAVE_STATE_SCHEMA);
  saveState.wasmboyMemory.wasmBoyInternalState = this.internalState;
  saveState.wasmboyMemory.wasmBoyPaletteMemory = this.paletteMemory;
  saveState.wasmboyMemory.gameBoyMemory = this.gameboyMemory;
  saveState.wasmboyMemory.cartridgeRam = this.cartridgeRam;
  saveState.date = Date.now();
  saveState.isAuto = false;

  if (this.saveStateCallback) {
    this.saveStateCallback(saveState);
  }

  return saveState;
}

// Functions here are depedent on WasmBoyMemory state.

function _prepareAndStoreAutoSave() {
  // Check if the game is currently playing
  if (!this.internalState) {
    return null;
  } // Get our cartridge ram and header
  // Use this.cartridgeHeader and this.cartridgeRam
  //const header = getCartridgeHeader.bind(this)();
  //const cartridgeRam = getCartridgeRam.bind(this)();
  // Get our save state, and un type our arrays


  const saveState = getSaveState.bind(this)();
  const saveStateMemoryKeys = Object.keys(saveState.wasmboyMemory);

  for (let i = 0; i < saveStateMemoryKeys.length; i++) {
    saveState.wasmboyMemory[saveStateMemoryKeys[i]] = Array.prototype.slice.call(saveState.wasmboyMemory[saveStateMemoryKeys[i]]);
  } // Set isAuto


  saveState.isAuto = true; // Need to conert types arrays, and back, or selse wll get indexed JSON
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays

  localStorage.setItem(this.WASMBOY_UNLOAD_STORAGE, JSON.stringify({
    header: Array.prototype.slice.call(this.cartridgeHeader),
    cartridgeRam: Array.prototype.slice.call(this.cartridgeRam),
    saveState: saveState
  }));
  return null;
} // Function to find any autosaves in localstorage, and commit them to our idb


function _findAndCommitAutoSave() {
  const findAndCommitAutoSaveTask = async () => {
    // Load any unloaded storage in our localStorage
    const unloadStorage = localStorage.getItem(this.WASMBOY_UNLOAD_STORAGE);

    if (unloadStorage) {
      const unloadStorageObject = JSON.parse(unloadStorage);
      localStorage.removeItem(this.WASMBOY_UNLOAD_STORAGE);
      const header = new Uint8Array(unloadStorageObject.header);
      const cartridgeRam = new Uint8Array(unloadStorageObject.cartridgeRam); // Get our save state, and re-type our array

      const saveState = unloadStorageObject.saveState;

      if (saveState) {
        const saveStateMemoryKeys = Object.keys(saveState.wasmboyMemory);

        for (let i = 0; i < saveStateMemoryKeys.length; i++) {
          saveState.wasmboyMemory[saveStateMemoryKeys[i]] = new Uint8Array(saveState.wasmboyMemory[saveStateMemoryKeys[i]]);
        }
      }

      await this.saveCartridgeRam(header, cartridgeRam);
      await this.saveState(header, saveState);
    }
  };

  return findAndCommitAutoSaveTask();
} // Function to set event listeners to run our unload handler


function initializeAutoSave() {
  // Set listeners to ensure we save our cartridge ram before closing
  window.addEventListener('beforeunload', () => {
    _prepareAndStoreAutoSave.bind(this)();
  }, false);
  window.addEventListener('unload', () => {
    _prepareAndStoreAutoSave.bind(this)();
  }, false);
  window.addEventListener('pagehide', () => {
    _prepareAndStoreAutoSave.bind(this)();
  }, false); // Mobile Page visibility, for pressing home, closing tabs, task switcher, etc...
  // https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/

  document.addEventListener('visibilitychange', () => {
    // fires when user switches tabs, apps, goes to homescreen, etc.
    // NOTE: This will not create a new save state in desktop browser,
    // Because the localstorage string is only picked up on refresh :)
    // Unless you force kill the browser or something, which is what we want
    // Anyways
    if (document.visibilityState === 'hidden') {
      _prepareAndStoreAutoSave.bind(this)();
    }
  }); // Restore any autosave lingering to be committed

  return _findAndCommitAutoSave.bind(this)();
}

class WasmBoyMemoryService {
  constructor() {
    this.worker = undefined;
    this.maxNumberOfAutoSaveStates = undefined;
    this.saveStateCallback = undefined;
    this.loadedCartridgeMemoryState = {
      ROM: false,
      RAM: false
    }; // Our different types of memory

    this.cartridgeRom = undefined;
    this.cartridgeRomFileName = undefined;
    this.cartridgeHeader = undefined;
    this.cartridgeRam = undefined;
    this.gameboyMemory = undefined;
    this.paletteMemory = undefined;
    this.internalState = undefined; // Going to set the key for idbKeyval as the cartridge header.
    // Then, for each cartridge, it will return an object.
    // there will be a cartridgeRam Key, settings Key, and a saveState key
    // Not going to make one giant object, as we want to keep idb transactions light and fast

    this.WASMBOY_UNLOAD_STORAGE = 'WASMBOY_UNLOAD_STORAGE'; // Define some constants since calls to wasm are expensive

    this.WASMBOY_GAME_BYTES_LOCATION = 0;
    this.WASMBOY_GAME_RAM_BANKS_LOCATION = 0;
    this.WASMBOY_INTERNAL_STATE_SIZE = 0;
    this.WASMBOY_INTERNAL_STATE_LOCATION = 0;
    this.WASMBOY_INTERNAL_MEMORY_SIZE = 0;
    this.WASMBOY_INTERNAL_MEMORY_LOCATION = 0;
    this.WASMBOY_PALETTE_MEMORY_SIZE = 0;
    this.WASMBOY_PALETTE_MEMORY_LOCATION = 0;
  }

  initialize(headless, maxNumberOfAutoSaveStates, saveStateCallback) {
    this.maxNumberOfAutoSaveStates = maxNumberOfAutoSaveStates;
    this.saveStateCallback = saveStateCallback;

    const initializeTask = async () => {
      await this._initializeConstants();

      if (!headless) {
        await initializeAutoSave.call(this);
      }
    };

    return initializeTask();
  }

  setWorker(worker) {
    this.worker = worker; // Also set our handler

    this.worker.addMessageListener(event => {
      const eventData = getEventData(event);

      switch (eventData.message.type) {
        case WORKER_MESSAGE_TYPE.UPDATED:
          {
            // Simply set our memory
            const memoryTypes = Object.keys(eventData.message);
            delete memoryTypes.type;

            if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_ROM)) {
              this.cartridgeRom = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_ROM]);
            }

            if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_RAM)) {
              this.cartridgeRam = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_RAM]);
            }

            if (memoryTypes.includes(MEMORY_TYPE.GAMEBOY_MEMORY)) {
              this.gameboyMemory = new Uint8Array(eventData.message[MEMORY_TYPE.GAMEBOY_MEMORY]);
            }

            if (memoryTypes.includes(MEMORY_TYPE.PALETTE_MEMORY)) {
              this.paletteMemory = new Uint8Array(eventData.message[MEMORY_TYPE.PALETTE_MEMORY]);
            }

            if (memoryTypes.includes(MEMORY_TYPE.INTERNAL_STATE)) {
              this.internalState = new Uint8Array(eventData.message[MEMORY_TYPE.INTERNAL_STATE]);
            }

            return;
          }
      }
    });
  } // Function to get all cartridge objects
  // Saved in our indexed db


  getSavedMemory() {
    const getSavedMemoryTask = async () => {
      const memory = [];
      const keys = await idbKeyval.keys();

      for (let i = 0; i < keys.length; i++) {
        const cartridgeObject = await idbKeyval.get(keys[i]);
        memory.push(cartridgeObject);
      }

      return memory;
    };

    return getSavedMemoryTask();
  }

  getLoadedCartridgeMemoryState() {
    return this.loadedCartridgeMemoryState;
  }

  clearMemory() {
    // Clear Wasm memory
    // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
    return this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY
    }).then(event => {
      this.loadedCartridgeMemoryState.ROM = false;
      this.loadedCartridgeMemoryState.RAM = false; // Reset everything

      this.cartridgeRom = undefined;
      this.cartridgeHeader = undefined;
      this.cartridgeRam = undefined;
      this.gameboyMemory = undefined;
      this.paletteMemory = undefined;
      this.internalState = undefined;
    });
  }

  loadCartridgeRom(ROM, fileName) {
    const loadTask = async () => {
      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_ROM] = ROM.buffer; // Don't pass the rom as a transferrable, since,
      // We want to keep a copy of it for reset

      await this.worker.postMessage(_objectSpread({
        type: WORKER_MESSAGE_TYPE.SET_MEMORY
      }, workerMemoryObject)).then(event => {
        this.loadedCartridgeMemoryState.ROM = true;
      }); // Also get our cartridge header

      await this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.GET_MEMORY,
        memoryTypes: [MEMORY_TYPE.CARTRIDGE_ROM, MEMORY_TYPE.CARTRIDGE_HEADER]
      }).then(event => {
        const eventData = getEventData(event);
        this.cartridgeRom = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_ROM]);
        this.cartridgeRomFileName = fileName;
        this.cartridgeHeader = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_HEADER]);
      });
    };

    return loadTask();
  }

  saveLoadedCartridge(additionalInfo) {
    const saveLoadedCartridgeRomTask = async () => {
      if (!this.cartridgeHeader) {
        throw new Error('Error parsing the cartridge header');
      }

      let cartridgeObject = await idbKeyval.get(this.cartridgeHeader);

      if (!cartridgeObject) {
        cartridgeObject = {};
      }

      const cartridgeInfo = await this.getCartridgeInfo(); // Remove any keys we don't want to allow
      // Overriding in the additionalInfo

      if (additionalInfo) {
        delete additionalInfo.ROM;
        delete additionalInfo.header;
      } // In the rare chance we don't know the name, set to unkown.


      let fileName = this.cartridgeRomFileName || 'Unknown';
      cartridgeObject.cartridgeRom = _objectSpread({
        ROM: this.cartridgeRom,
        header: this.cartridgeHeader,
        fileName: fileName,
        date: Date.now()
      }, additionalInfo);
      cartridgeObject.cartridgeInfo = cartridgeInfo;

      if (this.cartridgeRam) {
        await this.saveCartridgeRam();
      }

      await idbKeyval.set(this.cartridgeHeader, cartridgeObject);
      return cartridgeObject;
    };

    return saveLoadedCartridgeRomTask();
  }

  deleteSavedCartridge(cartridge) {
    const deleteLoadedCartridgeTask = async () => {
      const cartridgeHeader = cartridge.cartridgeInfo.header;

      if (!cartridgeHeader) {
        throw new Error('Error parsing the cartridge header');
      }

      let cartridgeObject = await idbKeyval.get(cartridgeHeader);

      if (!cartridgeObject) {
        throw new Error('Could not find the passed cartridge');
      }

      delete cartridgeObject.cartridgeRom;
      await idbKeyval.set(cartridgeHeader, cartridgeObject);
      return cartridgeObject;
    };

    return deleteLoadedCartridgeTask();
  } // Function to save the cartridge ram
  // This emulates the cartridge having a battery to
  // Keep things like Pokemon Save data in memory
  // Also allows passing in a a Uint8Array header and ram to be set manually


  saveCartridgeRam(passedHeader, passedCartridgeRam) {
    const saveCartridgeRamTask = async () => {
      // Get the entire header in byte memory
      // Each version of a rom can have similar title and checksums
      // Therefore comparing all of it should help with this :)
      // https://drive.google.com/file/d/0B7y-o-Uytiv9OThXWXFCM1FPbGs/view
      let header;
      let cartridgeRam;

      if (passedHeader && passedCartridgeRam) {
        header = passedHeader;
        cartridgeRam = passedCartridgeRam;
      } else {
        header = this.cartridgeHeader;
        cartridgeRam = this.cartridgeRam;
      }

      if (!header || !cartridgeRam) {
        throw new Error('Error parsing the cartridgeRam or cartridge header');
      } // Get our cartridge object


      let cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject) {
        cartridgeObject = {};
      } // Set the cartridgeRam to our cartridgeObject


      cartridgeObject.cartridgeRam = cartridgeRam;
      await idbKeyval.set(header, cartridgeObject);
    };

    return saveCartridgeRamTask();
  } // function to load the cartridge ram
  // opposite of above


  loadCartridgeRam() {
    const loadCartridgeRamTask = async () => {
      const header = this.cartridgeHeader;

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      const cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject || !cartridgeObject.cartridgeRam) {
        return;
      } // Set the cartridgeRam
      // Don't transfer, because we want to keep a reference to it


      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM] = cartridgeObject.cartridgeRam.buffer;
      await this.worker.postMessage(_objectSpread({
        type: WORKER_MESSAGE_TYPE.SET_MEMORY
      }, workerMemoryObject)).then(event => {
        this.loadedCartridgeMemoryState.RAM = true;
        this.cartridgeRam = cartridgeObject.cartridgeRam;
      });
    };

    return loadCartridgeRamTask();
  } // Function to save the state to the indexeddb


  saveState(passedHeader, passedSaveState) {
    const saveStateTask = async () => {
      // Get our save state
      let saveState;
      let header;

      if (passedHeader && passedSaveState) {
        saveState = passedSaveState;
        header = passedHeader;
      } else {
        saveState = getSaveState.call(this);
        header = this.cartridgeHeader;
      }

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      let cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject) {
        cartridgeObject = {};
      }

      if (!cartridgeObject.saveStates) {
        cartridgeObject.saveStates = [];
      } // Check if we are auto


      if (saveState.isAuto && this.maxNumberOfAutoSaveStates && this.maxNumberOfAutoSaveStates > 0) {
        // Make sure we are not exceeding the max number of auto save states
        const autoSaveStates = [];
        cartridgeObject.saveStates.forEach(savedState => {
          if (savedState.isAuto) {
            autoSaveStates.push(savedState);
          }
        }); // Sort auto save states by date

        autoSaveStates.sort((a, b) => {
          if (a.date < b.date) {
            return -1;
          }

          if (a.date > b.date) {
            return 1;
          }

          return 0;
        });

        while (autoSaveStates.length > 0 && autoSaveStates.length + 1 > this.maxNumberOfAutoSaveStates) {
          const autoSaveState = autoSaveStates.shift(); // Find the save state

          const saveStateIndex = this._indexOfSaveStateIndexInSaveStates(autoSaveState, cartridgeObject.saveStates);

          cartridgeObject.saveStates.splice(saveStateIndex, 1);
        }

        if (this.maxNumberOfAutoSaveStates > 0) {
          cartridgeObject.saveStates.push(saveState);
        }
      } else {
        cartridgeObject.saveStates.push(saveState);
      }

      await idbKeyval.set(header, cartridgeObject);
      return saveState;
    };

    return saveStateTask();
  }

  loadState(saveState) {
    const loadStateTask = async () => {
      const header = this.cartridgeHeader;

      if (!header) {
        throw new Error('Error getting the cartridge header');
      }

      if (!saveState) {
        const cartridgeObject = await idbKeyval.get(header);

        if (!cartridgeObject || !cartridgeObject.saveStates) {
          throw new Error('No Save State passed, and no cartridge object found');
          return;
        }

        saverState = cartridgeObject.saveStates[0];
      }

      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM] = saveState.wasmboyMemory.cartridgeRam.buffer;
      workerMemoryObject[MEMORY_TYPE.GAMEBOY_MEMORY] = saveState.wasmboyMemory.gameBoyMemory.buffer;
      workerMemoryObject[MEMORY_TYPE.PALETTE_MEMORY] = saveState.wasmboyMemory.wasmBoyPaletteMemory.buffer;
      workerMemoryObject[MEMORY_TYPE.INTERNAL_STATE] = saveState.wasmboyMemory.wasmBoyInternalState.buffer;
      await this.worker.postMessage(_objectSpread({
        type: WORKER_MESSAGE_TYPE.SET_MEMORY
      }, workerMemoryObject), [workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM], workerMemoryObject[MEMORY_TYPE.GAMEBOY_MEMORY], workerMemoryObject[MEMORY_TYPE.PALETTE_MEMORY], workerMemoryObject[MEMORY_TYPE.INTERNAL_STATE]]);
      await this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.GET_MEMORY,
        memoryTypes: [MEMORY_TYPE.CARTRIDGE_RAM, MEMORY_TYPE.GAMEBOY_MEMORY, MEMORY_TYPE.PALETTE_MEMORY, MEMORY_TYPE.INTERNAL_STATE]
      }).then(event => {
        const eventData = getEventData(event);
        this.cartridgeRam = eventData.message[MEMORY_TYPE.CARTRIDGE_RAM];
        this.gameboyMemory = eventData.message[MEMORY_TYPE.GAMEBOY_MEMORY];
        this.paletteMemory = eventData.message[MEMORY_TYPE.PALETTE_MEMORY];
        this.internalState = eventData.message[MEMORY_TYPE.INTERNAL_STATE];
      });
    };

    return loadStateTask();
  }

  deleteState(saveState, passedHeader) {
    const deleteStateTask = async () => {
      if (!saveState) {
        throw new Error('You must provide a save state to delete');
        return;
      }

      let header;

      if (passedHeader) {
        header = passedHeader;
      } else if (this.cartridgeHeader) {
        header = this.cartridgeHeader;
      }

      if (!header) {
        throw new Error('Please load a ROM, or pass a Cartridge header...');
        return;
      }

      let cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject || !cartridgeObject.saveStates) {
        throw new Error('No save states found for the Cartridge...');
        return;
      } // Find the save state


      const saveStateIndex = this._indexOfSaveStateIndexInSaveStates(saveState, cartridgeObject.saveStates); // If not found, throw an error


      if (saveStateIndex < 0) {
        throw new Error('Could not find the passed save state for the related cartridge...');
        return;
      }

      cartridgeObject.saveStates.splice(saveStateIndex, 1);
      await idbKeyval.set(header, cartridgeObject);
      return saveState;
    };

    return deleteStateTask();
  } // Function to return the current cartridge object


  getCartridgeObject() {
    return idbKeyval.get(this.cartridgeHeader);
  } // Function to return all informationh aboyut the currently loaded cart.
  // This will include, the ROM, the RAM, the header, and the indivudal pieces of the header
  // See: http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header


  getCartridgeInfo() {
    if (!this.loadedCartridgeMemoryState.ROM) {
      return Promise.reject('No ROM has been loaded');
    }

    let getCartridgeInfoTask = async () => {
      const cartridgeInfo = {};
      cartridgeInfo.header = this.cartridgeHeader;
      cartridgeInfo.ROM = this.cartridgeRom;
      cartridgeInfo.RAM = this.cartridgeRam; // Now parse our header for additional information

      cartridgeInfo.nintendoLogo = cartridgeInfo.ROM.slice(0x104, 0x134);
      cartridgeInfo.title = cartridgeInfo.ROM.slice(0x134, 0x144);
      cartridgeInfo.titleAsString = String.fromCharCode.apply(null, cartridgeInfo.title);
      cartridgeInfo.manufacturerCode = cartridgeInfo.ROM.slice(0x13f, 0x143);
      cartridgeInfo.CGBFlag = cartridgeInfo.ROM[0x143];
      cartridgeInfo.newLicenseeCode = cartridgeInfo.ROM.slice(0x144, 0x146);
      cartridgeInfo.SGBFlag = cartridgeInfo.ROM[0x146];
      cartridgeInfo.cartridgeType = cartridgeInfo.ROM[0x147];
      cartridgeInfo.ROMSize = cartridgeInfo.ROM[0x148];
      cartridgeInfo.RAMSize = cartridgeInfo.ROM[0x149];
      cartridgeInfo.destinationCode = cartridgeInfo.ROM[0x14a];
      cartridgeInfo.oldLicenseeCode = cartridgeInfo.ROM[0x14b];
      cartridgeInfo.maskROMVersionNumber = cartridgeInfo.ROM[0x14c];
      cartridgeInfo.headerChecksum = cartridgeInfo.ROM[0x14d];
      cartridgeInfo.globalChecksum = cartridgeInfo.ROM.slice(0x14e, 0x150);
      return cartridgeInfo;
    };

    return getCartridgeInfoTask();
  }

  _initializeConstants() {
    // Initialize our cached wasm constants
    return this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.GET_CONSTANTS
    }).then(event => {
      const eventData = getEventData(event);
      Object.keys(this).forEach(key => {
        if (eventData.message[key] !== undefined) {
          this[key] = eventData.message[key];
        }
      });
    });
  }

  _indexOfSaveStateIndexInSaveStates(saveState, saveStates) {
    // Find the save state
    let saveStateIndex = saveStates.indexOf(saveState);

    if (saveStateIndex < 0) {
      const keysCheck = (a, b) => {
        return JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b));
      };

      const dateCheck = (a, b) => {
        return a.date === b.date;
      };

      const autoCheck = (a, b) => {
        return a.isAuto === b.isAuto;
      };

      saveStates.some((savedState, index) => {
        if (keysCheck(saveState, savedState) && dateCheck(saveState, savedState) && autoCheck(saveState, savedState)) {
          saveStateIndex = index;
          return true;
        }

        return false;
      });
    }

    return saveStateIndex;
  }

} // Create a singleton to export


const WasmBoyMemory = new WasmBoyMemoryService();

function d(a){for(var b=1;b<arguments.length;b++){var c=null!=arguments[b]?arguments[b]:{},e=Object.keys(c);"function"===typeof Object.getOwnPropertySymbols&&(e=e.concat(Object.getOwnPropertySymbols(c).filter(function(a){return Object.getOwnPropertyDescriptor(c,a).enumerable})));e.forEach(function(b){var e=c[b];b in a?Object.defineProperty(a,b,{value:e,enumerable:!0,configurable:!0,writable:!0}):a[b]=e;});}return a}
let g={DPAD_UP:"DPAD_UP",DPAD_RIGHT:"DPAD_RIGHT",DPAD_DOWN:"DPAD_DOWN",DPAD_LEFT:"DPAD_LEFT",LEFT_ANALOG_HORIZONTAL_AXIS:"LEFT_ANALOG_HORIZONTAL_AXIS",LEFT_ANALOG_VERTICAL_AXIS:"LEFT_ANALOG_VERTICAL_AXIS",LEFT_ANALOG_UP:"LEFT_ANALOG_UP",LEFT_ANALOG_RIGHT:"LEFT_ANALOG_RIGHT",LEFT_ANALOG_DOWN:"LEFT_ANALOG_DOWN",LEFT_ANALOG_LEFT:"LEFT_ANALOG_LEFT",RIGHT_ANALOG_HORIZONTAL_AXIS:"RIGHT_ANALOG_HORIZONTAL_AXIS",RIGHT_ANALOG_VERTICAL_AXIS:"RIGHT_ANALOG_VERTICAL_AXIS",RIGHT_ANALOG_UP:"RIGHT_ANALOG_UP",RIGHT_ANALOG_RIGHT:"RIGHT_ANALOG_RIGHT",
RIGHT_ANALOG_DOWN:"RIGHT_ANALOG_DOWN",RIGHT_ANALOG_LEFT:"RIGHT_ANALOG_LEFT",A:"A",B:"B",X:"X",Y:"Y",LEFT_TRIGGER:"LEFT_TRIGGER",LEFT_BUMPER:"LEFT_BUMPER",RIGHT_TRIGGER:"RIGHT_TRIGGER",RIGHT_BUMPER:"RIGHT_BUMPER",SELECT:"SELECT",START:"START",SPECIAL:"SPECIAL"};class h{constructor(){}enable(){throw Error("enable() must be overridden");}disable(){throw Error("disable() must be overridden");}getState(){throw Error("getState() must be overridden");}}
let k="input textarea button select option optgroup label datalist".split(" "),l=["Alt","Control","Meta","OS"];
class m extends h{constructor(){super();this.keymap={};Object.keys(g).forEach((a)=>{this.keymap[a]={keys:[],value:void 0};});this.enableIgnoreWhenInputElementFocused();this.enableIgnoreWhenModifierState();this._boundUpdateKeymapValues=this._updateKeymapValues.bind(this);}enable(){if("undefined"===typeof window)throw Error("Keyboard can only be used with a browser environment");window.addEventListener("keyup",this._boundUpdateKeymapValues);window.addEventListener("keydown",this._boundUpdateKeymapValues);}disable(){if("undefined"===
typeof window)throw Error("Keyboard can only be used with a browser environment");window.removeEventListener("keyup",this._boundUpdateKeymapValues);window.removeEventListener("keydown",this._boundUpdateKeymapValues);}getState(){let a=d({},g);Object.keys(this.keymap).forEach((b)=>{a[b]=this.keymap[b].value;});Object.keys(a).forEach((b)=>{"string"===typeof a[b]&&delete a[b];});return a}enableIgnoreWhenInputElementFocused(){this.ignoreWhenInputElementFocused=!0;}disableIgnoreWhenInputElementFocused(){this.ignoreWhenInputElementFocused=
!1;}enableIgnoreWhenModifierState(){this.ignoreOnModifierState=!0;}disableIgnoreWhenModifierState(){this.ignoreOnModifierState=!1;}setKeysToResponsiveGamepadInput(a,b){if(!a||!b||0===a.length)throw Error("Could not set the specificed keyboard keys to input");"string"===typeof a&&(a=[a]);this.keymap[b].keys=a;}_isFocusedOnInputElement(){return k.some((a)=>document.activeElement&&document.activeElement.tagName.toLowerCase()===a.toLowerCase()?!0:!1)}_isInModifierState(a){return l.some((b)=>a.getModifierState(b)||
a.code===b)}_updateKeymapValues(a){this.ignoreWhenInputElementFocused&&this._isFocusedOnInputElement()||this.ignoreOnModifierState&&this._isInModifierState(a)||(a.preventDefault(),Object.keys(this.keymap).some((b)=>this.keymap[b].keys.some((c)=>c===a.code?(this.keymap[b].value="keydown"===a.type?!0:!1,!0):!1)));}}
class n extends h{constructor(){super();this.gamepadAnalogStickDeadZone=.25;this.keymap={};}enable(){}disable(){}getState(a){let b=this._getGamepads();a||(a=0);let c=b[a];if(!c)return !1;Object.keys(this.keymap).forEach((a)=>{if(this.keymap[a].buttons)this.keymap[a].value=this.keymap[a].buttons.some((a)=>this._isButtonPressed(c,a));else if(this.keymap[a].axis){let b=this._getAnalogStickAxis(c,this.keymap[a].axis);this.keymap[a].value=b;}});let e=d({},g);Object.keys(this.keymap).forEach((a)=>{e[a]=this.keymap[a].value;});
e[g.LEFT_ANALOG_DOWN]=e.LEFT_ANALOG_VERTICAL_AXIS>this.gamepadAnalogStickDeadZone;e[g.LEFT_ANALOG_UP]=e.LEFT_ANALOG_VERTICAL_AXIS<-1*this.gamepadAnalogStickDeadZone;e[g.LEFT_ANALOG_RIGHT]=e.LEFT_ANALOG_HORIZONTAL_AXIS>this.gamepadAnalogStickDeadZone;e[g.LEFT_ANALOG_LEFT]=e.LEFT_ANALOG_HORIZONTAL_AXIS<-1*this.gamepadAnalogStickDeadZone;e[g.RIGHT_ANALOG_DOWN]=e.RIGHT_ANALOG_VERTICAL_AXIS>this.gamepadAnalogStickDeadZone;e[g.RIGHT_ANALOG_UP]=e.RIGHT_ANALOG_VERTICAL_AXIS<-1*this.gamepadAnalogStickDeadZone;
e[g.RIGHT_ANALOG_RIGHT]=e.RIGHT_ANALOG_HORIZONTAL_AXIS>this.gamepadAnalogStickDeadZone;e[g.RIGHT_ANALOG_LEFT]=e.RIGHT_ANALOG_HORIZONTAL_AXIS<-1*this.gamepadAnalogStickDeadZone;Object.keys(e).forEach((a)=>{"string"===typeof e[a]&&delete e[a];});return e}setGamepadButtonsToResponsiveGamepadInput(a,b){if(!a||!b||0===a.length)throw Error("Could not set the specificed buttons to input");"number"===typeof a&&(a=[a]);this.keymap[b]={};this.keymap[b].buttons=a;}setGamepadAxisToResponsiveGamepadInput(a,b){if(void 0===
a||!b)throw Error("Could not set the specificed buttons to input");if("number"===typeof axes)throw Error("Must pass in an axis id");this.keymap[b]={};this.keymap[b].axis=a;}_isButtonPressed(a,b){return a.buttons[b]?a.buttons[b].pressed:!1}_getGamepads(){return navigator.getGamepads?navigator.getGamepads():[]}_getAnalogStickAxis(a,b){return a?a.axes[b]||0:0}}let q="touchstart touchmove touchend mousedown mousemove mouseup mouseleave".split(" ");
class r{constructor(a){if(!a)throw Error("Touch inputs require an element.");this.listeners=[];this.element=a;this._addTouchStyles();this.boundingClientRect=void 0;this._updateElementBoundingClientRect();this.active=!1;this.boundUpdateElementRect=this._updateElementBoundingClientRect.bind(this);this.boundTouchEvent=this._touchEvent.bind(this);}remove(){this._removeTouchStyles();this.stopListening();this.element=void 0;}listen(){if(!this.element)throw Error("You must supply an element first with add()");
window.addEventListener("resize",this.boundUpdateElementRect);q.forEach((a)=>{this.element.addEventListener(a,this.boundTouchEvent);});}stopListening(){if(!this.element)throw Error("You must supply an element first with add()");window.removeEventListener("resize",this.boundUpdateElementRect);q.forEach((a)=>{this.element.removeEventListener(a,this.boundTouchEvent);});}_touchEvent(a){if(a&&(!a.type.includes("touch")||a.touches)){a.preventDefault();var b="touchstart"===a.type||"touchmove"===a.type||"mousedown"===
a.type,c="mousemove"===a.type,e=!b&&!c;this._updateActiveStatus(b,e);this._updateTouchStyles(b,c,e);if(this.onTouchEvent)this.onTouchEvent(a,b,c,e);}}_updateElementBoundingClientRect(){this.boundingClientRect=this.element.getBoundingClientRect();}_addTouchStyles(){this.element.style.userSelect="none";}_removeTouchStyles(){this.element.style.userSelect="";}_updateTouchStyles(a,b){b||(a?this.element.classList.add("active"):this.element.classList.remove("active"));}_updateActiveStatus(a,b){this.active&&b?
this.active=!1:!this.active&&a&&(this.active=!0);}}function t(a,b){let c;a.type.includes("touch")?c=a.touches[0]:a.type.includes("mouse")&&(c=a);return {rectCenterX:(b.right-b.left)/2,rectCenterY:(b.bottom-b.top)/2,touchX:c.clientX-b.left,touchY:c.clientY-b.top}}
class u extends r{constructor(a,b){super(a);this.config=b?b:{allowMultipleDirections:!1};this._resetState();}_resetState(){this.state={DPAD_UP:!1,DPAD_RIGHT:!1,DPAD_DOWN:!1,DPAD_LEFT:!1};}onTouchEvent(a){if(this.active){var {rectCenterX:a,rectCenterY:b,touchX:c,touchY:e}=t(a,this.boundingClientRect);if(!(c>a+this.boundingClientRect.width/2+50)){this._resetState();var f=this.boundingClientRect.width/20,p=this.boundingClientRect.height/20;this.config.allowMultipleDirections?(this.setHorizontalState(c,
f),this.setVerticalState(e,p)):Math.abs(a-c)+this.boundingClientRect.width/8>Math.abs(b-e)?this.setHorizontalState(c,f):this.setVerticalState(e);}}else this._resetState();}setHorizontalState(a,b){b&&Math.abs(this.boundingClientRect.width/2-a)<=b||(a<this.boundingClientRect.width/2?this.state.DPAD_LEFT=!0:this.state.DPAD_RIGHT=!0);}setVerticalState(a,b){b&&Math.abs(this.boundingClientRect.height/2-a)<b||(a<this.boundingClientRect.height/2?this.state.DPAD_UP=!0:this.state.DPAD_DOWN=!0);}}
class v extends r{constructor(a){super(a);this._resetState();}_resetState(){this.state={HORIZONTAL_AXIS:0,VERTICAL_AXIS:0,UP:!1,RIGHT:!1,DOWN:!1,LEFT:!1};this.element.style.transform="translate(0px, 0px)";this.deadzone=.5;}onTouchEvent(a){if(this.active){var {rectCenterX:a,rectCenterY:b,touchX:c,touchY:e}=t(a,this.boundingClientRect);c=(c-a)/a;1<c?c=1:-1>c&&(c=-1);e=(e-b)/b;1<e?e=1:-1>e&&(e=-1);this.element.style.transform=`translate(${a*c/2}px, ${b*e/2}px)`;this.state.HORIZONTAL_AXIS=c;this.state.VERTICAL_AXIS=
e;this.state.UP=!1;this.state.RIGHT=!1;this.state.DOWN=!1;this.state.LEFT=!1;Math.abs(c)>this.deadzone&&(0<c?this.state.RIGHT=!0:0>c&&(this.state.LEFT=!0));Math.abs(e)>this.deadzone&&(0<e?this.state.DOWN=!0:0>e&&(this.state.UP=!0));}else this._resetState();}}class w extends r{constructor(a,b){super(a);this.input=b;}}let x={LEFT:"LEFT",RIGHT:"RIGHT"};
class y extends h{constructor(){super();this.enabled=!1;this.dpads=[];this.leftAnalogs=[];this.rightAnalogs=[];this.buttons=[];}enable(){if("undefined"===typeof window)throw Error("TouchInput can only be used with a browser environment");this.enabled=!0;this.dpads.forEach((a)=>a.listen());this.leftAnalogs.forEach((a)=>a.listen());this.rightAnalogs.forEach((a)=>a.listen());this.buttons.forEach((a)=>a.listen());}disable(){if("undefined"===typeof window)throw Error("TouchInput can only be used with a browser environment");
this.enabled=!1;this.dpads.forEach((a)=>a.stopListening());this.leftAnalogs.forEach((a)=>a.stopListening());this.rightAnalogs.forEach((a)=>a.stopListening());this.buttons.forEach((a)=>a.stopListening());}getState(){let a=d({},g);this.buttons.forEach((b)=>{a[b.input]=b.active;});this.dpads.forEach((b)=>{Object.keys(b.state).forEach((c)=>{a[c]=b.state[c]||a[c];});});0<this.leftAnalogs.length&&(a.LEFT_ANALOG_HORIZONTAL_AXIS=this.leftAnalogs[0].state.HORIZONTAL_AXIS,a.LEFT_ANALOG_VERTICAL_AXIS=this.leftAnalogs[0].state.VERTICAL_AXIS,
a.LEFT_ANALOG_UP=this.leftAnalogs[0].state.UP,a.LEFT_ANALOG_RIGHT=this.leftAnalogs[0].state.RIGHT,a.LEFT_ANALOG_DOWN=this.leftAnalogs[0].state.DOWN,a.LEFT_ANALOG_LEFT=this.leftAnalogs[0].state.LEFT);0<this.rightAnalogs.length&&(a.RIGHT_ANALOG_HORIZONTAL_AXIS=this.rightAnalogs[0].state.HORIZONTAL_AXIS,a.RIGHT_ANALOG_VERTICAL_AXIS=this.rightAnalogs[0].state.VERTICAL_AXIS,a.RIGHT_ANALOG_UP=this.rightAnalogs[0].state.UP,a.RIGHT_ANALOG_RIGHT=this.rightAnalogs[0].state.RIGHT,a.RIGHT_ANALOG_DOWN=this.rightAnalogs[0].state.DOWN,
a.RIGHT_ANALOG_LEFT=this.rightAnalogs[0].state.LEFT);Object.keys(a).forEach((b)=>{"string"===typeof a[b]&&delete a[b];});return a}addButtonInput(a,b){let c=new w(a,b);this.enabled&&c.listen();this.buttons.push(c);return ()=>{c.stopListening();this.buttons.splice(this.buttons.indexOf(c),1);}}addDpadInput(a,b){let c=new u(a,b);this.enabled&&c.listen();this.dpads.push(c);return ()=>{c.stopListening();this.dpads.splice(this.dpads.indexOf(c),1);}}addLeftAnalogInput(a){this.addAnalogInput(a,x.LEFT);}addRightAnalogInput(a){this.addAnalogInput(a,
x.RIGHT);}addAnalogInput(a,b){let c=new v(a);this.enabled&&c.listen();if(b===x.LEFT)return this.leftAnalogs.push(c),()=>{c.stopListening();this.leftAnalogs.splice(this.leftAnalogs.indexOf(c),1);};this.rightAnalogs.push(c);return ()=>{c.stopListening();this.rightAnalogs.splice(this.rightAnalogs.indexOf(c),1);}}}
class z{constructor(){this.RESPONSIVE_GAMEPAD_INPUTS=g;this._enabled=!1;this._multipleDirectionInput=!0;this.Keyboard=new m;this.Gamepad=new n;this.TouchInput=new y;this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowUp","Numpad8"],g.DPAD_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyW"],g.LEFT_ANALOG_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyI"],g.RIGHT_ANALOG_UP);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([12],g.DPAD_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowRight",
"Numpad6"],g.DPAD_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyD"],g.LEFT_ANALOG_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyL"],g.RIGHT_ANALOG_RIGHT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([15],g.DPAD_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowDown","Numpad5","Numpad2"],g.DPAD_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyS"],g.LEFT_ANALOG_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyK"],g.RIGHT_ANALOG_DOWN);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([13],
g.DPAD_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowLeft","Numpad4"],g.DPAD_LEFT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyA"],g.LEFT_ANALOG_LEFT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyJ"],g.RIGHT_ANALOG_LEFT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([14],g.DPAD_LEFT);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([0],g.LEFT_ANALOG_HORIZONTAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([1],g.LEFT_ANALOG_VERTICAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([2],
g.RIGHT_ANALOG_HORIZONTAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([3],g.RIGHT_ANALOG_VERTICAL_AXIS);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyX","Semicolon","Numpad7"],g.A);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([0],g.A);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyZ","Escape","Quote","Backspace","Numpad9"],g.B);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([1],g.B);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyC"],g.X);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([2],
g.X);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyV"],g.Y);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([3],g.Y);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyQ"],g.LEFT_TRIGGER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([6],g.LEFT_TRIGGER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyE"],g.LEFT_BUMPER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([4],g.LEFT_BUMPER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyU"],g.RIGHT_TRIGGER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([7],
g.RIGHT_TRIGGER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyO"],g.RIGHT_BUMPER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([5],g.RIGHT_BUMPER);this.Keyboard.setKeysToResponsiveGamepadInput(["Enter","Numpad3"],g.START);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([9],g.START);this.Keyboard.setKeysToResponsiveGamepadInput(["ShiftRight","ShiftLeft","Tab","Numpad1"],g.SELECT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([8],g.SELECT);this.Keyboard.setKeysToResponsiveGamepadInput(["Space",
"Backslash","Backquote"],g.SPECIAL);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([16],g.SPECIAL);this.plugins=[];this.inputChangeMap={};this.inputChangeOldState={};this.cancelInputChangeListener=void 0;}getVersion(){return "1.0.0"}enable(){this.Keyboard.enable();this.Gamepad.enable();this.TouchInput.enable();0<Object.keys(this.inputChangeMap).length&&this._startInputChangeInterval();this._enabled=!0;}disable(){this.Keyboard.disable();this.Gamepad.disable();this.TouchInput.disable();this.cancelInputChangeListener&&
(this.cancelInputChangeListener(),this.cancelInputChangeListener=void 0);this._enabled=!1;}isEnabled(){return this._enabled}addPlugin(a){this.plugins.push(a);if(a.onAddPlugin)a.onAddPlugin();return ()=>{if(a.onRemovePlugin)a.onRemovePlugin();this.plugins.splice(this.plugins.indexOf(a),1);}}getState(){if(!this._enabled)return {};let a=d({},g),b=this.Gamepad.getState(),c=this.TouchInput.getState(),e=this.Keyboard.getState();a=d({},g);Object.keys(a).forEach((f)=>{a[f]=b[f]||c[f]||e[f];});["LEFT","RIGHT"].forEach((b)=>
{[g[`${b}_ANALOG_HORIZONTAL_AXIS`],g[`${b}_ANALOG_VERTICAL_AXIS`]].forEach((c,e)=>{if("number"!==typeof a[c]){if(0===e||2===e)a[c]=a[g[`${b}_ANALOG_RIGHT`]]?1:a[g[`${b}_ANALOG_LEFT`]]?-1:0;if(1===e||3===e)a[c]=a[g[`${b}_ANALOG_UP`]]?-1:a[g[`${b}_ANALOG_DOWN`]]?1:0;}});});a.UP=a.DPAD_UP||a.LEFT_ANALOG_UP;a.RIGHT=a.DPAD_RIGHT||a.LEFT_ANALOG_RIGHT;a.DOWN=a.DPAD_DOWN||a.LEFT_ANALOG_DOWN;a.LEFT=a.DPAD_LEFT||a.LEFT_ANALOG_LEFT;Object.keys(a).forEach((b)=>{if(void 0===a[b]||"string"===typeof a[b])a[b]=!1;});
this.plugins.forEach((b)=>{b.onGetState&&(b=b.onGetState(a))&&(this.state=b);});return a}onInputsChange(a,b){"string"===typeof a&&(a=[a]);this.inputChangeMap[a]={codes:a,callback:b};this.cancelInputChangeListener||this._startInputChangeInterval();return ()=>{delete this.inputChangeMap[a];}}_startInputChangeInterval(){let a=setInterval(this._inputChangeIntervalHandler.bind(this),16);this.cancelInputChangeListener=()=>clearInterval(a);}_inputChangeIntervalHandler(){let a=this.getState(),b=[];Object.keys(a).forEach((c)=>
{a[c]!==this.inputChangeOldState[c]&&b.push(c);});Object.keys(this.inputChangeMap).forEach((c)=>{this.inputChangeMap[c].codes.some((a)=>b.includes(a))&&this.inputChangeMap[c].callback(a);});this.inputChangeOldState=a;}}let A=new z;var ResponsiveGamepad=A;

// Responsive Gamepad plugin to simulate GB Inputs
function ResponsiveGamepadPluginGB() {
  return {
    onGetState: state => {
      const gamepadA = state.A;
      const gamepadB = state.B;
      state.A = gamepadA || state.X;
      state.B = gamepadB || state.Y;
      return state;
    }
  };
}

// https://github.com/torch2424/responsive-gamepad

class WasmBoyControllerService {
  constructor() {
    // Our wasm instance
    this.worker = undefined;
    this.isEnabled = false; // Bind Repsonsive Gamepad to this

    this.ResponsiveGamepad = ResponsiveGamepad;
    ResponsiveGamepad.addPlugin(ResponsiveGamepadPluginGB());
  }

  initialize() {
    if (!this.isEnabled) {
      this.enableDefaultJoypad();
    }

    return Promise.resolve();
  }

  setWorker(worker) {
    this.worker = worker;
  }

  updateController() {
    if (!this.isEnabled) {
      return {};
    } // Create an abstracted controller state


    const controllerState = ResponsiveGamepad.getState(); // Set the new controller state on the instance

    this.setJoypadState(controllerState); // Return the controller state in case we need something from it

    return controllerState;
  }

  setJoypadState(controllerState) {
    const setJoypadStateParamsAsArray = [controllerState.UP ? 1 : 0, controllerState.RIGHT ? 1 : 0, controllerState.DOWN ? 1 : 0, controllerState.LEFT ? 1 : 0, controllerState.A ? 1 : 0, controllerState.B ? 1 : 0, controllerState.SELECT ? 1 : 0, controllerState.START ? 1 : 0];
    this.worker.postMessageIgnoreResponse({
      type: WORKER_MESSAGE_TYPE.SET_JOYPAD_STATE,
      setJoypadStateParamsAsArray
    });
  }

  enableDefaultJoypad() {
    this.isEnabled = true;
    ResponsiveGamepad.enable();
  }

  disableDefaultJoypad() {
    this.isEnabled = false;
    ResponsiveGamepad.disable();
  }

}

const WasmBoyController = new WasmBoyControllerService();

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBIKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX0xPQ0FUSU9OLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBJKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkFVRElPX0xBVEVOQ1k6YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQpiLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSihhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geihhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTisKZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQShhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIEsoYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhaztjYXNlIGYuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DQVJUUklER0VfUk9NX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DQVJUUklER0VfUkFNX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuV0FTTUJPWV9TVEFURV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQkNfUEFMRVRURV9TSVpFLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQkNfUEFMRVRURV9MT0NBVElPTi52YWx1ZU9mKCk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuU0VUX01FTU9SWTpkPU9iamVjdC5rZXlzKGIubWVzc2FnZSk7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUk9NXSksCmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JBTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9SQU1dKSxhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04pO2QuaW5jbHVkZXMoZy5HQU1FQk9ZX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkdBTUVCT1lfTUVNT1JZXSksYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLlBBTEVUVEVfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuUEFMRVRURV9NRU1PUlldKSxhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pO2QuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5JTlRFUk5BTF9TVEFURV0pLAphLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04pLGEud2FzbUluc3RhbmNlLmV4cG9ydHMubG9hZFN0YXRlKCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuU0VUX01FTU9SWV9ET05FfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5HRVRfTUVNT1JZOntkPXt0eXBlOmYuR0VUX01FTU9SWX07Y29uc3QgbD1bXTt2YXIgYz1iLm1lc3NhZ2UubWVtb3J5VHlwZXM7aWYoYy5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXt2YXIgZT1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIG09dm9pZCAwOzA9PT1lP209MzI3Njg6MTw9ZSYmMz49ZT9tPTIwOTcxNTI6NTw9ZSYmNj49ZT9tPTI2MjE0NDoxNTw9ZSYmMTk+PWU/bT0yMDk3MTUyOjI1PD1lJiYzMD49ZSYmKG09ODM4ODYwOCk7ZT1tP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sCmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK20pOm5ldyBVaW50OEFycmF5fWVsc2UgZT1uZXcgVWludDhBcnJheTtlPWUuYnVmZmVyO2RbZy5DQVJUUklER0VfUk9NXT1lO2wucHVzaChlKX1jLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JBTSkmJihlPXooYSkuYnVmZmVyLGRbZy5DQVJUUklER0VfUkFNXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkNBUlRSSURHRV9IRUFERVIpJiYoYS53YXNtQnl0ZU1lbW9yeT8oZT1hLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMDgsZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGUsZSsyNykpOmU9bmV3IFVpbnQ4QXJyYXksZT1lLmJ1ZmZlcixkW2cuQ0FSVFJJREdFX0hFQURFUl09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5HQU1FQk9ZX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLApkW2cuR0FNRUJPWV9NRU1PUlldPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiYoZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcixkW2cuUEFMRVRURV9NRU1PUlldPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zYXZlU3RhdGUoKSxjPUEoYSkuYnVmZmVyLGRbZy5JTlRFUk5BTF9TVEFURV09YyxsLnB1c2goYykpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGQsYi5tZXNzYWdlSWQpLGwpfX19ZnVuY3Rpb24gTChhKXtjb25zdCBiPSJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGItMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTsKYS5mcHNUaW1lU3RhbXBzLnB1c2goYik7YS50aW1lU3RhbXBzVW50aWxSZWFkeS0tOzA+YS50aW1lU3RhbXBzVW50aWxSZWFkeSYmKGEudGltZVN0YW1wc1VudGlsUmVhZHk9MCk7cmV0dXJuIGJ9ZnVuY3Rpb24gdyhhKXthLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTkwPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZT8xLjI1Kk1hdGguZmxvb3IoYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpOjEyMH1mdW5jdGlvbiBCKGEpe2NvbnN0IGI9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OK2EuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkUpLmJ1ZmZlcjthLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuVVBEQVRFRCxncmFwaGljc0ZyYW1lQnVmZmVyOmJ9KSxbYl0pfWZ1bmN0aW9uIEMoYSl7dmFyIGI9KCJ1bmRlZmluZWQiIT09CnR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKSktYS5mcHNUaW1lU3RhbXBzW2EuZnBzVGltZVN0YW1wcy5sZW5ndGgtMV07Yj1ELWI7MD5iJiYoYj0wKTthLnNwZWVkJiYwPGEuc3BlZWQmJihiLz1hLnNwZWVkKTthLnVwZGF0ZUlkPXNldFRpbWVvdXQoKCk9PntFKGEpfSxNYXRoLmZsb29yKGIpKX1mdW5jdGlvbiBFKGEsYil7aWYoYS5wYXVzZWQpcmV0dXJuITA7dm9pZCAwIT09YiYmKEQ9Yik7cj1hLmdldEZQUygpO3U9YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUrMTthLnNwZWVkJiYwPGEuc3BlZWQmJih1Kj1hLnNwZWVkKTtpZihyPnUpcmV0dXJuIGEuZnBzVGltZVN0YW1wcy5zaGlmdCgpLEMoYSksITA7TChhKTtjb25zdCBjPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoKGIpPT57bGV0IGQ7Yz94KGEsYik6KGQ9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWUoKSwKYihkKSl9KSkudGhlbigoYik9PntpZigwPD1iKXtrKGgoe3R5cGU6Zi5VUERBVEVELGZwczpyfSkpO2xldCBjPSExO2Eub3B0aW9ucy5mcmFtZVNraXAmJjA8YS5vcHRpb25zLmZyYW1lU2tpcCYmKGEuZnJhbWVTa2lwQ291bnRlcisrLGEuZnJhbWVTa2lwQ291bnRlcjw9YS5vcHRpb25zLmZyYW1lU2tpcD9jPSEwOmEuZnJhbWVTa2lwQ291bnRlcj0wKTtjfHxCKGEpO2NvbnN0IGQ9e3R5cGU6Zi5VUERBVEVEfTtkW2cuQ0FSVFJJREdFX1JBTV09eihhKS5idWZmZXI7ZFtnLkdBTUVCT1lfTUVNT1JZXT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtkW2cuUEFMRVRURV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTisKYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtkW2cuSU5URVJOQUxfU1RBVEVdPUEoYSkuYnVmZmVyO09iamVjdC5rZXlzKGQpLmZvckVhY2goKGEpPT57dm9pZCAwPT09ZFthXSYmKGRbYV09KG5ldyBVaW50OEFycmF5KS5idWZmZXIpfSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCksW2RbZy5DQVJUUklER0VfUkFNXSxkW2cuR0FNRUJPWV9NRU1PUlldLGRbZy5QQUxFVFRFX01FTU9SWV0sZFtnLklOVEVSTkFMX1NUQVRFXV0pOzI9PT1iP2soaCh7dHlwZTpmLkJSRUFLUE9JTlR9KSk6QyhhKX1lbHNlIGsoaCh7dHlwZTpmLkNSQVNIRUR9KSksYS5wYXVzZWQ9ITB9KX1mdW5jdGlvbiB4KGEsYil7dmFyIGQ9LTE7ZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PWQmJmIoZCk7aWYoMT09PWQpe2Q9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nZXROdW1iZXJPZlNhbXBsZXNJbkF1ZGlvQnVmZmVyKCk7CmNvbnN0IGM9cj49dTsuMjU8YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzJiZjPyhGKGEsZCksc2V0VGltZW91dCgoKT0+e3coYSk7eChhLGIpfSxNYXRoLmZsb29yKE1hdGguZmxvb3IoMUUzKihhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMtLjI1KSkvMTApKSk6KEYoYSxkKSx4KGEsYikpfX1mdW5jdGlvbiBGKGEsYil7dmFyIGQ9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Y29uc3QgYz17dHlwZTpmLlVQREFURUQsYXVkaW9CdWZmZXI6ZCxudW1iZXJPZlNhbXBsZXM6YixmcHM6cixhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6NjA8YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9O2Q9W2RdO2lmKGEub3B0aW9ucyYmYS5vcHRpb25zLmVuYWJsZUF1ZGlvRGVidWdnaW5nKXt2YXIgZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwxQnVmZmVyPWU7ZC5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwyQnVmZmVyPWU7ZC5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwzQnVmZmVyPWU7ZC5wdXNoKGUpO2I9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWw0QnVmZmVyPWI7ZC5wdXNoKGIpfWEuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoYyksCmQpO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpfWNvbnN0IHA9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgdjtwfHwodj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2NvbnN0IGY9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLEdFVF9NRU1PUlk6IkdFVF9NRU1PUlkiLFNFVF9NRU1PUlk6IlNFVF9NRU1PUlkiLFNFVF9NRU1PUllfRE9ORToiU0VUX01FTU9SWV9ET05FIixHRVRfQ09OU1RBTlRTOiJHRVRfQ09OU1RBTlRTIixHRVRfQ09OU1RBTlRTX0RPTkU6IkdFVF9DT05TVEFOVFNfRE9ORSIsQ09ORklHOiJDT05GSUciLFJFU0VUX0FVRElPX1FVRVVFOiJSRVNFVF9BVURJT19RVUVVRSIsUExBWToiUExBWSIsQlJFQUtQT0lOVDoiQlJFQUtQT0lOVCIsUEFVU0U6IlBBVVNFIiwKVVBEQVRFRDoiVVBEQVRFRCIsQ1JBU0hFRDoiQ1JBU0hFRCIsU0VUX0pPWVBBRF9TVEFURToiU0VUX0pPWVBBRF9TVEFURSIsQVVESU9fTEFURU5DWToiQVVESU9fTEFURU5DWSIsUlVOX1dBU01fRVhQT1JUOiJSVU5fV0FTTV9FWFBPUlQiLEdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOiJHRVRfV0FTTV9NRU1PUllfU0VDVElPTiIsR0VUX1dBU01fQ09OU1RBTlQ6IkdFVF9XQVNNX0NPTlNUQU5UIixGT1JDRV9PVVRQVVRfRlJBTUU6IkZPUkNFX09VVFBVVF9GUkFNRSIsU0VUX1NQRUVEOiJTRVRfU1BFRUQiLElTX0dCQzoiSVNfR0JDIn0sZz17Q0FSVFJJREdFX1JBTToiQ0FSVFJJREdFX1JBTSIsQ0FSVFJJREdFX1JPTToiQ0FSVFJJREdFX1JPTSIsQ0FSVFJJREdFX0hFQURFUjoiQ0FSVFJJREdFX0hFQURFUiIsR0FNRUJPWV9NRU1PUlk6IkdBTUVCT1lfTUVNT1JZIixQQUxFVFRFX01FTU9SWToiUEFMRVRURV9NRU1PUlkiLElOVEVSTkFMX1NUQVRFOiJJTlRFUk5BTF9TVEFURSJ9O2xldCB0PQowLE09e307Y29uc3QgeT17ZW52Ontsb2c6KGEsYixjLGYsZSxnLGgpPT57dmFyIGQ9KG5ldyBVaW50MzJBcnJheSh3YXNtSW5zdGFuY2UuZXhwb3J0cy5tZW1vcnkuYnVmZmVyLGEsMSkpWzBdO2E9U3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLG5ldyBVaW50MTZBcnJheSh3YXNtSW5zdGFuY2UuZXhwb3J0cy5tZW1vcnkuYnVmZmVyLGErNCxkKSk7LTk5OTkhPT1iJiYoYT1hLnJlcGxhY2UoIiQwIixiKSk7LTk5OTkhPT1jJiYoYT1hLnJlcGxhY2UoIiQxIixjKSk7LTk5OTkhPT1mJiYoYT1hLnJlcGxhY2UoIiQyIixmKSk7LTk5OTkhPT1lJiYoYT1hLnJlcGxhY2UoIiQzIixlKSk7LTk5OTkhPT1nJiYoYT1hLnJlcGxhY2UoIiQ0IixnKSk7LTk5OTkhPT1oJiYoYT1hLnJlcGxhY2UoIiQ1IixoKSk7Y29uc29sZS5sb2coIltXYXNtQm95XSAiK2EpfSxoZXhMb2c6KGEsYik9PntpZighTVthXSl7bGV0IGM9IltXYXNtQm95XSI7LTk5OTkhPT1hJiYoYys9YCAweCR7YS50b1N0cmluZygxNil9IGApOwotOTk5OSE9PWImJihjKz1gIDB4JHtiLnRvU3RyaW5nKDE2KX0gYCk7Y29uc29sZS5sb2coYyl9fX19LEc9YXN5bmMoYSk9PntsZXQgYj12b2lkIDA7cmV0dXJuIGI9V2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmc/YXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcoZmV0Y2goYSkseSk6YXdhaXQgKGFzeW5jKCk9Pntjb25zdCBiPWF3YWl0IGZldGNoKGEpLnRoZW4oKGEpPT5hLmFycmF5QnVmZmVyKCkpO3JldHVybiBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShiLHkpfSkoKX0sTj1hc3luYyhhKT0+e2E9QnVmZmVyLmZyb20oYS5zcGxpdCgiLCIpWzFdLCJiYXNlNjQiKTtyZXR1cm4gYXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYSx5KX0sTz1hc3luYyhhKT0+e2E9KGE/YXdhaXQgRygiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJoZ0VSWUFBQVlBcC9mMzkvZjM5L2YzOS9BR0FCZndGL1lBSi9md0JnQVg4QVlBSi9md0YvWUFBQmYyQURmMzkvQUdBR2YzOS9mMzkvQUdBSGYzOS9mMzkvZndGL1lBTi9mMzhCZjJBSGYzOS9mMzkvZndCZ0JIOS9mMzhCZjJBSWYzOS9mMzkvZjM4QVlBVi9mMzkvZndGL1lBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0FYOEJmd1BkQWRzQkFBSUNBQUFEQUFRRUFBQUFBQUFBQUFBQUJBUUFBQUFCQmdBQUFBQUFBQUFBQkFRQUFBQUFBQUFBQUFZR0JnWU9CUW9GRHdrTENBZ0hBd1FBQUFRQUFBQUFBQVFBQUFBQUFBSUNCUUlDQWdJRkRBUUVCQUFDQmdJQ0F3UUVCQVFBQUFBQUJBVUVCZ1lFQXdJRkJBQUFCQVVEQndBRkFBUUFCQVFHQmdNRkJBTUVCQVFEQXdjQ0FnSUNBZ0lDQWdJREJBUUNCQVFDQkFRQ0JBUUNBZ0lDQWdJQ0FnSUNBZ1VDQWdJQ0FnSUVCZ1lHRUFZQ0JnWUdBZ01FQkEwRUFBUUFCQUFHQmdZR0JnWUdCZ1lHQmdZRUFBQUdCZ1lHQUFBQUFnUUZCQVFCY0FBQkJRTUJBQUFHaFF5Y0FuOEFRUUFMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQWdMZndCQmdCQUxmd0JCZ0lBQkMzOEFRWUNRQVF0L0FFR0FnQUlMZndCQmdKQURDMzhBUVlDQUFRdC9BRUdBRUF0L0FFR0FnQVFMZndCQmdKQUVDMzhBUVlBQkMzOEFRWUNSQkF0L0FFR0F1QUVMZndCQmdNa0ZDMzhBUVlEWUJRdC9BRUdBb1FzTGZ3QkJnSUFNQzM4QVFZQ2hGd3QvQUVHQWdBa0xmd0JCZ0tFZ0MzOEFRWUQ0QUF0L0FFR0FrQVFMZndCQmdJa2RDMzhBUVlDWklRdC9BRUdBZ0FnTGZ3QkJnSmtwQzM4QVFZQ0FDQXQvQUVHQW1URUxmd0JCZ0lBSUMzOEFRWUNaT1F0L0FFR0FnQWdMZndCQmdKbkJBQXQvQUVHQWdBZ0xmd0JCZ0puSkFBdC9BRUdBZ0FnTGZ3QkJnSm5SQUF0L0FFR0FpUGdEQzM4QVFZQ2h5UVFMZndCQi8vOERDMzhBUVFBTGZ3QkJnS0hOQkF0L0FFR1VBUXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFlaitBd3QvQVVIcC9nTUxmd0ZCNi80REMzOEJRWDhMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJnUGNDQzM4QlFRQUxmd0ZCQUF0L0FVR0FnQWdMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWRIK0F3dC9BVUhTL2dNTGZ3RkIwLzREQzM4QlFkVCtBd3QvQVVIVi9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRYy8rQXd0L0FVSHcvZ01MZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFJTGZ3RkJBQXQvQVVFQUN3ZVhFRjhHYldWdGIzSjVBZ0FGZEdGaWJHVUJBQVpqYjI1bWFXY0FGdzVvWVhORGIzSmxVM1JoY25SbFpBQVlDWE5oZG1WVGRHRjBaUUFmQ1d4dllXUlRkR0YwWlFBcUJXbHpSMEpEQUNzU1oyVjBVM1JsY0hOUVpYSlRkR1Z3VTJWMEFDd0xaMlYwVTNSbGNGTmxkSE1BTFFoblpYUlRkR1Z3Y3dBdUZXVjRaV04xZEdWTmRXeDBhWEJzWlVaeVlXMWxjd0N6QVF4bGVHVmpkWFJsUm5KaGJXVUFzZ0VJWDNObGRHRnlaMk1BMlFFWlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYndEWUFSVmxlR1ZqZFhSbFZXNTBhV3hEYjI1a2FYUnBiMjRBMmdFTFpYaGxZM1YwWlZOMFpYQUFyd0VVWjJWMFEzbGpiR1Z6VUdWeVEzbGpiR1ZUWlhRQXRBRU1aMlYwUTNsamJHVlRaWFJ6QUxVQkNXZGxkRU41WTJ4bGN3QzJBUTV6WlhSS2IzbHdZV1JUZEdGMFpRQzdBUjluWlhST2RXMWlaWEpQWmxOaGJYQnNaWE5KYmtGMVpHbHZRblZtWm1WeUFMQUJFR05zWldGeVFYVmthVzlDZFdabVpYSUFKaHh6WlhSTllXNTFZV3hEYjJ4dmNtbDZZWFJwYjI1UVlXeGxkSFJsQUFjWFYwRlRUVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRES2hOWFFWTk5RazlaWDAxRlRVOVNXVjlUU1ZwRkF5c1NWMEZUVFVKUFdWOVhRVk5OWDFCQlIwVlRBeXdlUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgweFBRMEZVU1U5T0F3QWFRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDFOSldrVURBUlpYUVZOTlFrOVpYMU5VUVZSRlgweFBRMEZVU1U5T0F3SVNWMEZUVFVKUFdWOVRWRUZVUlY5VFNWcEZBd01nUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNERDaHhIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXdzU1ZrbEVSVTlmVWtGTlgweFBRMEZVU1U5T0F3UU9Wa2xFUlU5ZlVrRk5YMU5KV2tVREJSRlhUMUpMWDFKQlRWOU1UME5CVkVsUFRnTUdEVmRQVWt0ZlVrRk5YMU5KV2tVREJ5WlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01JSWs5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VEQ1JoSFVrRlFTRWxEVTE5UFZWUlFWVlJmVEU5RFFWUkpUMDRER0JSSFVrRlFTRWxEVTE5UFZWUlFWVlJmVTBsYVJRTVpGRWRDUTE5UVFVeEZWRlJGWDB4UFEwRlVTVTlPQXd3UVIwSkRYMUJCVEVWVVZFVmZVMGxhUlFNTkdFSkhYMUJTU1U5U1NWUlpYMDFCVUY5TVQwTkJWRWxQVGdNT0ZFSkhYMUJTU1U5U1NWUlpYMDFCVUY5VFNWcEZBdzhPUmxKQlRVVmZURTlEUVZSSlQwNERFQXBHVWtGTlJWOVRTVnBGQXhFWFFrRkRTMGRTVDFWT1JGOU5RVkJmVEU5RFFWUkpUMDRERWhOQ1FVTkxSMUpQVlU1RVgwMUJVRjlUU1ZwRkF4TVNWRWxNUlY5RVFWUkJYMHhQUTBGVVNVOU9BeFFPVkVsTVJWOUVRVlJCWDFOSldrVURGUkpQUVUxZlZFbE1SVk5mVEU5RFFWUkpUMDRERmc1UFFVMWZWRWxNUlZOZlUwbGFSUU1YRlVGVlJFbFBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWlFVUZWUkVsUFgwSlZSa1pGVWw5VFNWcEZBeU1aUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01hRlVOSVFVNU9SVXhmTVY5Q1ZVWkdSVkpmVTBsYVJRTWJHVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZURTlEUVZSSlQwNERIQlZEU0VGT1RrVk1YekpmUWxWR1JrVlNYMU5KV2tVREhSbERTRUZPVGtWTVh6TmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4NFZRMGhCVGs1RlRGOHpYMEpWUmtaRlVsOVRTVnBGQXg4WlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZ0ZVTklRVTVPUlV4Zk5GOUNWVVpHUlZKZlUwbGFSUU1oRmtOQlVsUlNTVVJIUlY5U1FVMWZURTlEUVZSSlQwNERKQkpEUVZKVVVrbEVSMFZmVWtGTlgxTkpXa1VESlJaRFFWSlVVa2xFUjBWZlVrOU5YMHhQUTBGVVNVOU9BeVlTUTBGU1ZGSkpSRWRGWDFKUFRWOVRTVnBGQXljZFJFVkNWVWRmUjBGTlJVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERLQmxFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeWtoWjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBQUViYzJWMFVISnZaM0poYlVOdmRXNTBaWEpDY21WaGEzQnZhVzUwQUx3QkhYSmxjMlYwVUhKdlozSmhiVU52ZFc1MFpYSkNjbVZoYTNCdmFXNTBBTDBCR1hObGRGSmxZV1JIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBdmdFYmNtVnpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFMOEJHbk5sZEZkeWFYUmxSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBTUFCSEhKbGMyVjBWM0pwZEdWSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQXdRRU1aMlYwVW1WbmFYTjBaWEpCQU1JQkRHZGxkRkpsWjJsemRHVnlRZ0REQVF4blpYUlNaV2RwYzNSbGNrTUF4QUVNWjJWMFVtVm5hWE4wWlhKRUFNVUJER2RsZEZKbFoybHpkR1Z5UlFER0FReG5aWFJTWldkcGMzUmxja2dBeHdFTVoyVjBVbVZuYVhOMFpYSk1BTWdCREdkbGRGSmxaMmx6ZEdWeVJnREpBUkZuWlhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0RLQVE5blpYUlRkR0ZqYTFCdmFXNTBaWElBeXdFWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dETUFRVm5aWFJNV1FETkFSMWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllUURPQVJoa2NtRjNWR2xzWlVSaGRHRlViMWRoYzIxTlpXMXZjbmtBendFVFpISmhkMDloYlZSdlYyRnpiVTFsYlc5eWVRRFFBUVpuWlhSRVNWWUEwUUVIWjJWMFZFbE5RUURTQVFablpYUlVUVUVBMHdFR1oyVjBWRUZEQU5RQkUzVndaR0YwWlVSbFluVm5SMEpOWlcxdmNua0ExUUVJQXRZQkNRZ0JBRUVBQ3dIWEFRci80d0hiQVZNQVFmTGx5d2NrTjBHZ3dZSUZKRGhCMkxEaEFpUTVRWWlRSUNRNlFmTGx5d2NrTzBHZ3dZSUZKRHhCMkxEaEFpUTlRWWlRSUNRK1FmTGx5d2NrUDBHZ3dZSUZKRUJCMkxEaEFpUkJRWWlRSUNSQ0M5VUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVNZFNJQlJRMEFBa0FnQVVFQmF3NE5BUUVCQWdJQ0FnTURCQVFGQmdBTERBWUxJQUJCZ0puUkFHb1BDeUFBUVFFajZ3RWlBU1B6QVVVaUFBUi9JQUZGQlNBQUN4dEJEblJxUVlDWjBBQnFEd3NnQUVHQWtINXFJNEFDQkg4ai9nRVFBa0VCY1FWQkFBdEJEWFJxRHdzZ0FDUHNBVUVOZEdwQmdObkdBR29QQ3lBQVFZQ1FmbW9QQzBFQUlRRUNmeU9BQWdSQUkvOEJFQUpCQjNFaEFRc2dBVUVCU0FzRWYwRUJCU0FCQzBFTWRDQUFha0dBOEgxcUR3c2dBRUdBVUdvTENRQWdBQkFCTFFBQUM3d0JBRUVBSklFQ1FRQWtnZ0pCQUNTREFrRUFKSVFDUVFBa2hRSkJBQ1NHQWtFQUpJY0NRUUFraUFKQkFDU0pBa0VBSklvQ1FRQWtpd0pCQUNTTUFrRUFKSTBDUVFBa2pnSkJBQ1NQQWtFQUpKQUNJNEFDQkVCQkVTU0NBa0dBQVNTSkFrRUFKSU1DUVFBa2hBSkIvd0VraFFKQjFnQWtoZ0pCQUNTSEFrRU5KSWdDQlVFQkpJSUNRYkFCSklrQ1FRQWtnd0pCRXlTRUFrRUFKSVVDUWRnQkpJWUNRUUVraHdKQnpRQWtpQUlMUVlBQ0pJc0NRZjcvQXlTS0FndDdBUUovUVFBazdRRkJBU1R1QVVISEFoQUNJZ0ZGSk84QklBRkJBVTRpQUFSQUlBRkJBMHdoQUFzZ0FDVHdBU0FCUVFWT0lnQUVRQ0FCUVFaTUlRQUxJQUFrOFFFZ0FVRVBUaUlBQkVBZ0FVRVRUQ0VBQ3lBQUpQSUJJQUZCR1U0aUFBUkFJQUZCSGt3aEFBc2dBQ1R6QVVFQkpPc0JRUUFrN0FFTEN3QWdBQkFCSUFFNkFBQUxMd0JCMGY0RFFmOEJFQVZCMHY0RFFmOEJFQVZCMC80RFFmOEJFQVZCMVA0RFFmOEJFQVZCMWY0RFFmOEJFQVVMdEFnQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ3NEQkFVR0J3Z0pDZ3NNRFFBTERBMExRZkxseXdja04wR2d3WUlGSkRoQjJMRGhBaVE1UVlpUUlDUTZRZkxseXdja08wR2d3WUlGSkR4QjJMRGhBaVE5UVlpUUlDUStRZkxseXdja1AwR2d3WUlGSkVCQjJMRGhBaVJCUVlpUUlDUkNEQXdMUWYvLy93Y2tOMEhqMnY0SEpEaEJnT0tRQkNRNVFRQWtPa0gvLy84SEpEdEI0OXIrQnlROFFZRGlrQVFrUFVFQUpENUIvLy8vQnlRL1FlUGEvZ2NrUUVHQTRwQUVKRUZCQUNSQ0RBc0xRZi8vL3dja04wR0VpZjRISkRoQnV2VFFCQ1E1UVFBa09rSC8vLzhISkR0QnNmN3ZBeVE4UVlDSUFpUTlRUUFrUGtILy8vOEhKRDlCLzh1T0F5UkFRZjhCSkVGQkFDUkNEQW9MUWNYTi93Y2tOMEdFdWJvR0pEaEJxZGFSQkNRNVFZamk2QUlrT2tILy8vOEhKRHRCNDlyK0J5UThRWURpa0FRa1BVRUFKRDVCLy8vL0J5US9RZVBhL2dja1FFR0E0cEFFSkVGQkFDUkNEQWtMUWYvLy93Y2tOMEdBL3NzQ0pEaEJnSVQ5QnlRNVFRQWtPa0gvLy84SEpEdEJnUDdMQWlROFFZQ0UvUWNrUFVFQUpENUIvLy8vQnlRL1FZRCt5d0lrUUVHQWhQMEhKRUZCQUNSQ0RBZ0xRZi8vL3dja04wR3gvdThESkRoQnhjY0JKRGxCQUNRNlFmLy8vd2NrTzBHRWlmNEhKRHhCdXZUUUJDUTlRUUFrUGtILy8vOEhKRDlCaEluK0J5UkFRYnIwMEFRa1FVRUFKRUlNQnd0QkFDUTNRWVNKQWlRNFFZQzgvd2NrT1VILy8vOEhKRHBCQUNRN1FZU0pBaVE4UVlDOC93Y2tQVUgvLy84SEpENUJBQ1EvUVlTSkFpUkFRWUM4L3dja1FVSC8vLzhISkVJTUJndEJwZi8vQnlRM1FaU3AvZ2NrT0VIL3FkSUVKRGxCQUNRNlFhWC8vd2NrTzBHVXFmNEhKRHhCLzZuU0JDUTlRUUFrUGtHbC8vOEhKRDlCbEtuK0J5UkFRZitwMGdRa1FVRUFKRUlNQlF0Qi8vLy9CeVEzUVlEKy93Y2tPRUdBZ1B3SEpEbEJBQ1E2UWYvLy93Y2tPMEdBL3Y4SEpEeEJnSUQ4QnlROVFRQWtQa0gvLy84SEpEOUJnUDcvQnlSQVFZQ0EvQWNrUVVFQUpFSU1CQXRCLy8vL0J5UTNRWUQrL3dja09FR0FsTzBESkRsQkFDUTZRZi8vL3dja08wSC95NDRESkR4Qi93RWtQVUVBSkQ1Qi8vLy9CeVEvUWJIKzd3TWtRRUdBaUFJa1FVRUFKRUlNQXd0Qi8vLy9CeVEzUWYvTGpnTWtPRUgvQVNRNVFRQWtPa0gvLy84SEpEdEJoSW4rQnlROFFicjAwQVFrUFVFQUpENUIvLy8vQnlRL1FiSCs3d01rUUVHQWlBSWtRVUVBSkVJTUFndEIvLy8vQnlRM1FkNlpzZ1FrT0VHTXBja0NKRGxCQUNRNlFmLy8vd2NrTzBHRWlmNEhKRHhCdXZUUUJDUTlRUUFrUGtILy8vOEhKRDlCNDlyK0J5UkFRWURpa0FRa1FVRUFKRUlNQVF0Qi8vLy9CeVEzUWFYTGxnVWtPRUhTcE1rQ0pEbEJBQ1E2UWYvLy93Y2tPMEdseTVZRkpEeEIwcVRKQWlROVFRQWtQa0gvLy84SEpEOUJwY3VXQlNSQVFkS2t5UUlrUVVFQUpFSUxDOTRJQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmlBRkhCRUFnQUNJQlFlRUFSZzBCSUFGQkZFWU5BaUFCUWNZQVJnMERJQUZCMlFCR0RRUWdBVUhHQVVZTkJDQUJRWVlCUmcwRklBRkJxQUZHRFFVZ0FVRy9BVVlOQmlBQlFjNEJSZzBHSUFGQjBRRkdEUVlnQVVId0FVWU5CaUFCUVNkR0RRY2dBVUhKQUVZTkJ5QUJRZHdBUmcwSElBRkJzd0ZHRFFjZ0FVSEpBVVlOQ0NBQlFmQUFSZzBKSUFGQnhnQkdEUW9nQVVIVEFVWU5Dd3dNQzBIL3VaWUZKRGRCZ1A3L0J5UTRRWURHQVNRNVFRQWtPa0gvdVpZRkpEdEJnUDcvQnlROFFZREdBU1E5UVFBa1BrSC91WllGSkQ5QmdQNy9CeVJBUVlER0FTUkJRUUFrUWd3TEMwSC8vLzhISkRkQi84dU9BeVE0UWY4QkpEbEJBQ1E2UWYvLy93Y2tPMEdFaWY0SEpEeEJ1dlRRQkNROVFRQWtQa0gvLy84SEpEOUIvOHVPQXlSQVFmOEJKRUZCQUNSQ0RBb0xRZi8vL3dja04wR0VpZjRISkRoQnV2VFFCQ1E1UVFBa09rSC8vLzhISkR0QnNmN3ZBeVE4UVlDSUFpUTlRUUFrUGtILy8vOEhKRDlCaEluK0J5UkFRYnIwMEFRa1FVRUFKRUlNQ1F0Qi8rdldCU1EzUVpULy93Y2tPRUhDdExVRkpEbEJBQ1E2UVFBa08wSC8vLzhISkR4QmhJbitCeVE5UWJyMDBBUWtQa0VBSkQ5Qi8vLy9CeVJBUVlTSi9nY2tRVUc2OU5BRUpFSU1DQXRCLy8vL0J5UTNRWVRidGdVa09FSDc1b2tDSkRsQkFDUTZRZi8vL3dja08wR0E1djBISkR4QmdJVFJCQ1E5UVFBa1BrSC8vLzhISkQ5Qi8vdnFBaVJBUVlDQS9BY2tRVUgvQVNSQ0RBY0xRWnovL3dja04wSC82OUlFSkRoQjg2aU9BeVE1UWJyMEFDUTZRY0tLL3dja08wR0FyUDhISkR4QmdQVFFCQ1E5UVlDQXFBSWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSU1CZ3RCZ1A2dkF5UTNRZi8vL3dja09FSEtwUDBISkRsQkFDUTZRZi8vL3dja08wSC8vLzhISkR4Qi84dU9BeVE5UWY4QkpENUIvLy8vQnlRL1FlUGEvZ2NrUUVHQTRwQUVKRUZCQUNSQ0RBVUxRZis1bGdVa04wR0EvdjhISkRoQmdNWUJKRGxCQUNRNlFkTEcvUWNrTzBHQWdOZ0dKRHhCZ0lDTUF5UTlRUUFrUGtIL0FTUS9RZi8vL3dja1FFSDcvdjhISkVGQi80a0NKRUlNQkF0Qnp2Ly9CeVEzUWUvZmp3TWtPRUd4aVBJRUpEbEIyclRwQWlRNlFmLy8vd2NrTzBHQTV2MEhKRHhCZ0lUUkJDUTlRUUFrUGtILy8vOEhKRDlCLzh1T0F5UkFRZjhCSkVGQkFDUkNEQU1MUWYvLy93Y2tOMEdFaWY0SEpEaEJ1dlRRQkNRNVFRQWtPa0gvLy84SEpEdEJnUDRESkR4QmdJakdBU1E5UVlDVUFTUStRZi8vL3dja1AwSC95NDRESkVCQi93RWtRVUVBSkVJTUFndEIvLy8vQnlRM1FmL0xqZ01rT0VIL0FTUTVRUUFrT2tHQS92OEhKRHRCZ0lEOEJ5UThRWUNBakFNa1BVRUFKRDVCLy8vL0J5US9RYkgrN3dNa1FFR0FpQUlrUVVFQUpFSU1BUXRCLy8vL0J5UTNRWVRidGdVa09FSDc1b2tDSkRsQkFDUTZRZi8vL3dja08wSGoydjRISkR4QjQ5citCeVE5UVFBa1BrSC8vLzhISkQ5Qi84dU9BeVJBUWY4QkpFRkJBQ1JDQ3dzMUFRSi9RUUFRQjBHMEFpRUFBMEFDUUNBQVFjTUNTZzBBSUFBUUFpQUJhaUVCSUFCQkFXb2hBQXdCQ3dzZ0FVSC9BWEVRQ0F1ZUFRQkJBQ1RrQVVFQUpPVUJRUUFrNWdGQkFDVG5BVUVBSk9nQlFRQWs2UUZCQUNUcUFVR1FBU1RtQVNPQUFnUkFRY0QrQTBHUkFSQUZRY0grQTBHQkFSQUZRY1QrQTBHUUFSQUZRY2YrQTBIOEFSQUZCVUhBL2dOQmtRRVFCVUhCL2dOQmhRRVFCVUhHL2dOQi93RVFCVUhIL2dOQi9BRVFCVUhJL2dOQi93RVFCVUhKL2dOQi93RVFCUXRCei80RFFRQVFCVUh3L2dOQkFSQUZFQWtMVUFBamdBSUVRRUhvL2dOQndBRVFCVUhwL2dOQi93RVFCVUhxL2dOQndRRVFCVUhyL2dOQkRSQUZCVUhvL2dOQi93RVFCVUhwL2dOQi93RVFCVUhxL2dOQi93RVFCVUhyL2dOQi93RVFCUXNMTHdCQmtQNERRWUFCRUFWQmtmNERRYjhCRUFWQmt2NERRZk1CRUFWQmsvNERRY0VCRUFWQmxQNERRYjhCRUFVTExBQkJsZjREUWY4QkVBVkJsdjREUVQ4UUJVR1gvZ05CQUJBRlFaaitBMEVBRUFWQm1mNERRYmdCRUFVTE1nQkJtdjREUWY4QUVBVkJtLzREUWY4QkVBVkJuUDREUVo4QkVBVkJuZjREUVFBUUJVR2UvZ05CdUFFUUJVRUJKSDhMTFFCQm4vNERRZjhCRUFWQm9QNERRZjhCRUFWQm9mNERRUUFRQlVHaS9nTkJBQkFGUWFQK0EwRy9BUkFGQzBVQVFROGtrUUZCRHlTU0FVRVBKSk1CUVE4a2xBRkJBQ1NWQVVFQUpKWUJRUUFrbHdGQkFDU1lBVUgvQUNTWkFVSC9BQ1NhQVVFQkpKc0JRUUVrbkFGQkFDU2RBUXQzQUVFQUpKNEJRUUFrbndGQkFDU2dBVUVCSktFQlFRRWtvZ0ZCQVNTakFVRUJKS1FCUVFFa3BRRkJBU1NtQVVFQkpLY0JRUUVrcUFGQkFTU3BBVUVBSktvQlFRQWtxd0ZCQUNTdEFVRUFKSzRCRUF3UURSQU9FQTlCcFA0RFFmY0FFQVZCcGY0RFFmTUJFQVZCcHY0RFFmRUJFQVVRRUFzK0FDQUFRUUZ4UVFCSEpMTUJJQUJCQW5GQkFFY2t0QUVnQUVFRWNVRUFSeVMxQVNBQVFRaHhRUUJISkxZQklBQkJFSEZCQUVja3R3RWdBQ1N5QVFzK0FDQUFRUUZ4UVFCSEpMa0JJQUJCQW5GQkFFY2t1Z0VnQUVFRWNVRUFSeVM3QVNBQVFRaHhRUUJISkx3QklBQkJFSEZCQUVja3ZRRWdBQ1M0QVF0ZUFFRUFKTDRCUVFBa3Z3RkJBQ1RBQVVFQUpNTUJRUUFreEFGQkFDVEZBVUVBSk1FQlFRQWt3Z0VqZ0FJRVFFR0UvZ05CSGhBRlFhQTlKTDhCQlVHRS9nTkJxd0VRQlVITTF3SWt2d0VMUVlmK0EwSDRBUkFGUWZnQkpNVUJDME1BUVFBa3hnRkJBQ1RIQVNPQUFnUkFRWUwrQTBIOEFCQUZRUUFreUFGQkFDVEpBVUVBSk1vQkJVR0MvZ05CL2dBUUJVRUFKTWdCUVFFa3lRRkJBQ1RLQVFzTCt3RUJBbjlCd3dJUUFpSUJRY0FCUmlJQUJIOGdBQVVnQVVHQUFVWWpMaUlBSUFBYkN3UkFRUUVrZ0FJRlFRQWtnQUlMRUFNUUJCQUdFQW9RQ3hBUlFRQVFFa0gvL3dNanNnRVFCVUhoQVJBVFFZLytBeU80QVJBRkVCUVFGU09BQWdSQVFmRCtBMEg0QVJBRlFjLytBMEgrQVJBRlFjMytBMEgrQUJBRlFZRCtBMEhQQVJBRlFZLytBMEhoQVJBRlFleitBMEgrQVJBRlFmWCtBMEdQQVJBRkJVSHcvZ05CL3dFUUJVSFAvZ05CL3dFUUJVSE4vZ05CL3dFUUJVR0EvZ05CendFUUJVR1AvZ05CNFFFUUJRdEJBQ1NhQWtHQXFOYTVCeVNSQWtFQUpKSUNRUUFra3dKQmdLald1UWNrbEFKQkFDU1ZBa0VBSkpZQ0Mwb0FJQUJCQUVva0xTQUJRUUJLSkM0Z0FrRUFTaVF2SUFOQkFFb2tNQ0FFUVFCS0pERWdCVUVBU2lReUlBWkJBRW9rTXlBSFFRQktKRFFnQ0VFQVNpUTFJQWxCQUVva05oQVdDd1VBSTVvQ0M1VUJBRUdBQ0NPQ0Fqb0FBRUdCQ0NPREFqb0FBRUdDQ0NPRUFqb0FBRUdEQ0NPRkFqb0FBRUdFQ0NPR0Fqb0FBRUdGQ0NPSEFqb0FBRUdHQ0NPSUFqb0FBRUdIQ0NPSkFqb0FBRUdJQ0NPS0Fqc0JBRUdLQ0NPTEFqc0JBRUdNQ0NPTUFqWUNBRUdSQ0NPTkFrRUFSem9BQUVHU0NDT09Ba0VBUnpvQUFFR1RDQ09QQWtFQVJ6b0FBRUdVQ0NPUUFrRUFSem9BQUF0b0FFSElDU1ByQVRzQkFFSEtDU1BzQVRzQkFFSE1DU1B0QVVFQVJ6b0FBRUhOQ1NQdUFVRUFSem9BQUVIT0NTUHZBVUVBUnpvQUFFSFBDU1B3QVVFQVJ6b0FBRUhRQ1NQeEFVRUFSem9BQUVIUkNTUHlBVUVBUnpvQUFFSFNDU1B6QVVFQVJ6b0FBQXMxQUVINkNTTytBVFlDQUVIK0NTTy9BVFlDQUVHQ0NpUEJBVUVBUnpvQUFFR0ZDaVBDQVVFQVJ6b0FBRUdGL2dNandBRVFCUXRZQUVIZUNpTlVRUUJIT2dBQVFkOEtJMWMyQWdCQjR3b2pXRFlDQUVIbkNpTlpOZ0lBUWV3S0kxbzJBZ0JCOFFvald6b0FBRUh5Q2lOY09nQUFRZmNLSTExQkFFYzZBQUJCK0FvalhqWUNBRUg5Q2lOZk93RUFDejBBUVpBTEkybEJBRWM2QUFCQmtRc2piRFlDQUVHVkN5TnROZ0lBUVprTEkyNDJBZ0JCbmdzamJ6WUNBRUdqQ3lOd09nQUFRYVFMSTNFNkFBQUxPd0JCOUFzamlRRkJBRWM2QUFCQjlRc2ppd0UyQWdCQitRc2pqQUUyQWdCQi9Rc2pqUUUyQWdCQmdnd2pqZ0UyQWdCQmh3d2prQUU3QVFBTGhBRUFFQmxCc2dnajVRRTJBZ0JCdGdnajJnRTZBQUJCeFA0REkrWUJFQVZCNUFnanNBRkJBRWM2QUFCQjVRZ2pzUUZCQUVjNkFBQVFHaEFiUWF3S0k2b0JOZ0lBUWJBS0k2c0JPZ0FBUWJFS0k2MEJPZ0FBRUJ3UUhVSENDeU40UVFCSE9nQUFRY01MSTNzMkFnQkJ4d3NqZkRZQ0FFSExDeU45T3dFQUVCNUJBQ1NhQWd1VkFRQkJnQWd0QUFBa2dnSkJnUWd0QUFBa2d3SkJnZ2d0QUFBa2hBSkJnd2d0QUFBa2hRSkJoQWd0QUFBa2hnSkJoUWd0QUFBa2h3SkJoZ2d0QUFBa2lBSkJod2d0QUFBa2lRSkJpQWd2QVFBa2lnSkJpZ2d2QVFBa2l3SkJqQWdvQWdBa2pBSkJrUWd0QUFCQkFFb2tqUUpCa2dndEFBQkJBRW9ramdKQmt3Z3RBQUJCQUVva2p3SkJsQWd0QUFCQkFFb2trQUlMWGdFQmYwRUFKT1VCUVFBazVnRkJ4UDREUVFBUUJVSEIvZ01RQWtGOGNTRUJRUUFrMmdGQndmNERJQUVRQlNBQUJFQUNRRUVBSVFBRFFDQUFRWURZQlU0TkFTQUFRWURKQldwQi93RTZBQUFnQUVFQmFpRUFEQUFBQ3dBTEN3dUlBUUVCZnlQY0FTRUJJQUJCZ0FGeFFRQkhKTndCSUFCQndBQnhRUUJISk4wQklBQkJJSEZCQUVjazNnRWdBRUVRY1VFQVJ5VGZBU0FBUVFoeFFRQkhKT0FCSUFCQkJIRkJBRWNrNFFFZ0FFRUNjVUVBUnlUaUFTQUFRUUZ4UVFCSEpPTUJJOXdCUlNBQklBRWJCRUJCQVJBaEN5QUJSU0lBQkg4ajNBRUZJQUFMQkVCQkFCQWhDd3NxQUVIa0NDMEFBRUVBU2lTd0FVSGxDQzBBQUVFQVNpU3hBVUgvL3dNUUFoQVNRWS8rQXhBQ0VCTUxhQUJCeUFrdkFRQWs2d0ZCeWdrdkFRQWs3QUZCekFrdEFBQkJBRW9rN1FGQnpRa3RBQUJCQUVvazdnRkJ6Z2t0QUFCQkFFb2s3d0ZCendrdEFBQkJBRW9rOEFGQjBBa3RBQUJCQUVvazhRRkIwUWt0QUFCQkFFb2s4Z0ZCMGdrdEFBQkJBRW9rOHdFTFJ3QkIrZ2tvQWdBa3ZnRkIvZ2tvQWdBa3Z3RkJnZ290QUFCQkFFb2t3UUZCaFFvdEFBQkJBRW9rd2dGQmhmNERFQUlrd0FGQmh2NERFQUlrd3dGQmgvNERFQUlreFFFTEJ3QkJBQ1N1QVF0WUFFSGVDaTBBQUVFQVNpUlVRZDhLS0FJQUpGZEI0d29vQWdBa1dFSG5DaWdDQUNSWlFld0tLQUlBSkZwQjhRb3RBQUFrVzBIeUNpMEFBQ1JjUWZjS0xRQUFRUUJLSkYxQitBb29BZ0FrWGtIOUNpOEJBQ1JmQ3owQVFaQUxMUUFBUVFCS0pHbEJrUXNvQWdBa2JFR1ZDeWdDQUNSdFFaa0xLQUlBSkc1Qm5nc29BZ0FrYjBHakN5MEFBQ1J3UWFRTExRQUFKSEVMT3dCQjlBc3RBQUJCQUVva2lRRkI5UXNvQWdBa2l3RkIrUXNvQWdBa2pBRkIvUXNvQWdBa2pRRkJnZ3dvQWdBa2pnRkJod3d2QVFBa2tBRUx5UUVCQVg4UUlFR3lDQ2dDQUNUbEFVRzJDQzBBQUNUYUFVSEUvZ01RQWlUbUFVSEEvZ01RQWhBaUVDTkJnUDRERUFKQi93RnpKTk1CSTlNQklnQkJFSEZCQUVjazFBRWdBRUVnY1VFQVJ5VFZBUkFrRUNWQnJBb29BZ0FrcWdGQnNBb3RBQUFrcXdGQnNRb3RBQUFrclFGQkFDU3VBUkFuRUNoQndnc3RBQUJCQUVva2VFSERDeWdDQUNSN1FjY0xLQUlBSkh4Qnl3c3ZBUUFrZlJBcFFRQWttZ0pCZ0tqV3VRY2trUUpCQUNTU0FrRUFKSk1DUVlDbzFya0hKSlFDUVFBa2xRSkJBQ1NXQWdzRkFDT0FBZ3NGQUNPVUFnc0ZBQ09WQWdzRkFDT1dBZ3ZGQWdFRmZ5TkhJUVlDZndKL0lBRkJBRW9pQlFSQUlBQkJDRW9oQlFzZ0JRc0VRQ05HSUFSR0lRVUxJQVVMQkg4Z0FDQUdSZ1VnQlFzRVFDQURRUUZyRUFKQklIRkJBRWNoQlNBREVBSkJJSEZCQUVjaENFRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQVVnQ0VjYklnTWdBR29pQkVHZ0FVd0VRQ0FCUWFBQmJDQUVha0VEYkVHQXlRVnFJZ2NnQnkwQUFEb0FBQ0FCUWFBQmJDQUVha0VEYkVHQnlRVnFJQWN0QUFFNkFBQWdBVUdnQVd3Z0JHcEJBMnhCZ3NrRmFpQUhMUUFDT2dBQUlBRkJvQUZzSUFScVFZQ1JCR29nQUVFQUlBTnJheUFCUWFBQmJHcEIrSkFFYWkwQUFDSUVRUU54SWdkQkJISWdCeUFFUVFSeEd6b0FBQ0FKUVFGcUlRa0xJQU5CQVdvaEF3d0JDd3NGSUFRa1Jnc2dBQ0FHVGdSQUlBQkJDR29oQmlBQUlBSkJCM0VpQ0VnRVFDQUdJQWhxSVFZTEN5QUdKRWNnQ1FzcEFDQUFRWUNRQWtZRVFDQUJRWUFCYXlBQlFZQUJhaUFCUVlBQmNSc2hBUXNnQVVFRWRDQUFhZ3RLQUNBQVFRTjBJQUZCQVhScUlnQkJBV3BCUDNFaUFVRkFheUFCSUFJYlFZQ1FCR290QUFBaEFTQUFRVDl4SWdCQlFHc2dBQ0FDRzBHQWtBUnFMUUFBSUFGQi93RnhRUWgwY2d1NUFRQWdBUkFDSUFCQkFYUjFRUU54SVFBZ0FVSEkvZ05HQkVBak95RUJBa0FnQUVVTkFBSkFBa0FDUUNBQVFRRnJEZ01BQVFJREN5TThJUUVNQWdzalBTRUJEQUVMSXo0aEFRc0ZJQUZCeWY0RFJnUkFJejhoQVFKQUlBQkZEUUFDUUFKQUFrQWdBRUVCYXc0REFBRUNBd3NqUUNFQkRBSUxJMEVoQVF3QkN5TkNJUUVMQlNNM0lRRUNRQ0FBUlEwQUFrQUNRQUpBSUFCQkFXc09Bd0FCQWdNTEl6Z2hBUXdDQ3lNNUlRRU1BUXNqT2lFQkN3c0xJQUVMb2dNQkJYOGdBU0FBRURBZ0JVRUJkR29pQUVHQWtINXFJQUpCQVhGQkRYUWlBV290QUFBaEVDQUFRWUdRZm1vZ0FXb3RBQUFoRVNBRElRQURRQ0FBSUFSTUJFQWdBQ0FEYXlBR2FpSU9JQWhJQkVCQkJ5QUFheUVGSUF0QkFFZ2lBZ1IvSUFJRklBdEJJSEZGQ3lFQlFRQWhBZ0ovUVFFZ0JTQUFJQUViSWdGMElCRnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBWFFnRUhFYklRSWpnQUlFZnlBTFFRQk9JZ0VFZnlBQkJTQU1RUUJPQ3dVamdBSUxCSDhnQzBFSGNTRUZJQXhCQUU0aUFRUkFJQXhCQjNFaEJRc2dCU0FDSUFFUU1TSUZRUjl4UVFOMElROGdCVUhnQjNGQkJYVkJBM1FoQVNBRlFZRDRBWEZCQ25WQkEzUUZJQUpCeC80RElBb2dDa0VBVEJzaUNoQXlJZ1ZCZ0lEOEIzRkJFSFVoRHlBRlFZRCtBM0ZCQ0hVaEFTQUZRZjhCY1FzaEJTQUhJQWhzSUE1cVFRTnNJQWxxSWdrZ0R6b0FBQ0FKUVFGcUlBRTZBQUFnQ1VFQ2FpQUZPZ0FBSUFkQm9BRnNJQTVxUVlDUkJHb2dBa0VEY1NJQlFRUnlJQUVnQzBHQUFYRkJBRWRCQUNBTFFRQk9HeHM2QUFBZ0RVRUJhaUVOQ3lBQVFRRnFJUUFNQVFzTElBMExmZ0VEZnlBRFFRZHhJUU5CQUNBQ0lBSkJBM1ZCQTNScklBQWJJUWRCb0FFZ0FHdEJCeUFBUVFocVFhQUJTaHNoQ0VGL0lRSWpnQUlFUUNBRVFZRFFmbW90QUFBaUFrRUljVUVBUnlFSklBSkJ3QUJ4QkVCQkJ5QURheUVEQ3dzZ0JpQUZJQWtnQnlBSUlBTWdBQ0FCUWFBQlFZREpCVUVBSUFKQmZ4QXpDNlVDQVFGL0lBTkJCM0VoQXlBRklBWVFNQ0FFUVlEUWZtb3RBQUFpQkVIQUFIRUVmMEVISUFOckJTQURDMEVCZEdvaUEwR0FrSDVxSUFSQkNIRkJBRWNpQlVFTmRHb3RBQUFoQmlBRFFZR1FmbW9nQlVFQmNVRU5kR290QUFBaEJTQUNRUWR4SVFOQkFDRUNJQUZCb0FGc0lBQnFRUU5zUVlESkJXb2dCRUVIY1FKL1FRRWdBMEVISUFOcklBUkJJSEViSWdOMElBVnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQm5FYklnSkJBQkF4SWdOQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBRFFlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQU5CZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFKQkEzRWlCMEVFY2lBSElBUkJnQUZ4R3pvQUFBdkVBUUFnQkNBRkVEQWdBMEVIY1VFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURKQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0F4QXlJZ0pCZ0lEOEIzRkJFSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FZRCtBM0ZCQ0hVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVlDUkJHb2dBMEVEY1RvQUFBdldBUUVHZnlBRFFRTjFJUXNEUUNBRVFhQUJTQVJBSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUxRUVYwSUFKcUlBWkJBM1ZxSWdsQmdKQithaTBBQUNFSVFRQWhDaU0xQkVBZ0JDQUFJQVlnQ1NBSUVDOGlCMEVBU2dSQVFRRWhDaUFIUVFGcklBUnFJUVFMQ3lBS1JTTTBJZ2NnQnhzRVFDQUVJQUFnQmlBRElBa2dBU0FJRURRaUIwRUFTZ1JBSUFkQkFXc2dCR29oQkFzRklBcEZCRUFqZ0FJRVFDQUVJQUFnQmlBRElBa2dBU0FJRURVRklBUWdBQ0FHSUFNZ0FTQUlFRFlMQ3dzZ0JFRUJhaUVFREFFTEN3c3lBUU4vSStrQklRTWdBQ1BxQVNJRVNBUkFEd3RCQUNBRFFRZHJJZ05ySVFVZ0FDQUJJQUlnQUNBRWF5QURJQVVRTnd1OUJRRVBmd0pBUVNjaENRTkFJQWxCQUVnTkFTQUpRUUowSWdkQmdQd0RhaUlERUFJaEFpQURRUUZxRUFJaENpQURRUUpxRUFJaEF5QUNRUkJySVFJZ0NrRUlheUVLUVFnaEJDQUJCRUJCRUNFRUlBTWdBMEVCY1dzaEF3c2dBQ0FDVGlJRkJFQWdBQ0FDSUFScVNDRUZDeUFGQkVBZ0IwR0QvQU5xRUFJaUJVR0FBWEZCQUVjaEN5QUZRU0J4UVFCSElRNUJnSUFDSUFNUU1DQUVJQUFnQW1zaUFtdEJBV3NnQWlBRlFjQUFjUnRCQVhScUlnTkJnSkIrYWlBRlFRaHhRUUJISTRBQ0lnSWdBaHRCQVhGQkRYUWlBbW90QUFBaER5QURRWUdRZm1vZ0Ftb3RBQUFoRUVFSElRY0RRQ0FIUVFCT0JFQkJBQ0VJQW45QkFVRUFJQWNpQWtFSGEyc2dBaUFPR3lJQ2RDQVFjUVJBUVFJaENBc2dDRUVCYWdzZ0NFRUJJQUowSUE5eEd5SUlCRUJCQnlBSGF5QUthaUlHUVFCT0lnSUVRQ0FHUWFBQlRDRUNDeUFDQkVCQkFDRU1RUUFoRFNQakFVVWpnQUlpQWlBQ0d5SUNSUVJBSUFCQm9BRnNJQVpxUVlDUkJHb3RBQUFpQTBFRGNTSUVRUUJMSUFzZ0N4c0VRRUVCSVF3RklBTkJCSEZCQUVjamdBSWlBeUFER3lJREJFQWdCRUVBU3lFREMwRUJRUUFnQXhzaERRc0xJQUpGQkVBZ0RFVWlCQVIvSUExRkJTQUVDeUVDQ3lBQ0JFQWpnQUlFUUNBQVFhQUJiQ0FHYWtFRGJFR0F5UVZxSUFWQkIzRWdDRUVCRURFaUJFRWZjVUVEZERvQUFDQUFRYUFCYkNBR2FrRURiRUdCeVFWcUlBUkI0QWR4UVFWMVFRTjBPZ0FBSUFCQm9BRnNJQVpxUVFOc1FZTEpCV29nQkVHQStBRnhRUXAxUVFOME9nQUFCU0FBUWFBQmJDQUdha0VEYkVHQXlRVnFJQWhCeWY0RFFjaitBeUFGUVJCeEd4QXlJZ05CZ0lEOEIzRkJFSFU2QUFBZ0FFR2dBV3dnQm1wQkEyeEJnY2tGYWlBRFFZRCtBM0ZCQ0hVNkFBQWdBRUdnQVd3Z0JtcEJBMnhCZ3NrRmFpQURPZ0FBQ3dzTEN5QUhRUUZySVFjTUFRc0xDeUFKUVFGcklRa01BQUFMQUFzTFpnRUNmMEdBZ0FKQmdKQUNJOThCR3lFQkk0QUNJZ0lqNHdFZ0Foc0VRQ0FBSUFGQmdMZ0NRWUN3QWlQZ0FSc2o2QUVnQUdwQi93RnhRUUFqNXdFUU53c2ozZ0VFUUNBQUlBRkJnTGdDUVlDd0FpUGRBUnNRT0FzajRnRUVRQ0FBSStFQkVEa0xDeVVCQVg4Q1FBTkFJQUJCa0FGS0RRRWdBRUgvQVhFUU9pQUFRUUZxSVFBTUFBQUxBQXNMUmdFQ2Z3TkFJQUZCa0FGT1JRUkFRUUFoQUFOQUlBQkJvQUZJQkVBZ0FVR2dBV3dnQUdwQmdKRUVha0VBT2dBQUlBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBRUxDd3NkQVFGL1FZLytBeEFDUVFFZ0FIUnlJZ0VrdUFGQmovNERJQUVRQlFzTEFFRUJKTG9CUVFFUVBRc3NBUUovSTFraUFFRUFTaUlCQkVBalVpRUJDeUFBUVFGcklBQWdBUnNpQUVVRVFFRUFKRlFMSUFBa1dRc3NBUUovSTI0aUFFRUFTaUlCQkVBalp5RUJDeUFBUVFGcklBQWdBUnNpQUVVRVFFRUFKR2tMSUFBa2Jnc3NBUUovSTN3aUFFRUFTaUlCQkVBamRpRUJDeUFBUVFGcklBQWdBUnNpQUVVRVFFRUFKSGdMSUFBa2ZBc3dBUUovSTQwQklnQkJBRW9pQVFSQUk0Z0JJUUVMSUFCQkFXc2dBQ0FCR3lJQVJRUkFRUUFraVFFTElBQWtqUUVMUUFFQ2YwR1UvZ01RQWtINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBRlFaVCtBeUFCSUFCQkNIVWlBSElRQlNBQ0pGRWdBQ1JUSTFFalUwRUlkSElrVmd0ZEFRSi9JMThpQVNOTGRTRUFJQUVnQUdzZ0FDQUJhaU5LR3lJQVFmOFBUQ0lCQkg4alMwRUFTZ1VnQVFzRVFDQUFKRjhnQUJCREkxOGlBU05MZFNFQUlBRWdBR3NnQUNBQmFpTktHeUVBQ3lBQVFmOFBTZ1JBUVFBa1ZBc0xLUUVCZnlOZVFRRnJJZ0JCQUV3RVFDTkpKRjRqU1VFQVNpTmRJMTBiQkVBUVJBc0ZJQUFrWGdzTFVRRUNmeU5ZUVFGcklnQkJBRXdFUUNOUUpGZ2dBQVJBSTFvaEFTQUJRUTlJSTA4alR4c0VmeUFCUVFGcUJTTlBSU0lBQkVBZ0FVRUFTaUVBQ3lBQlFRRnJJQUVnQUJzTEpGb0xCU0FBSkZnTEMwNEJBMzhqYlVFQmF5SUJRUUJNQkVBalpTSUJCRUFqYnlFQUlBQkJEMGdqWkNOa0d3Ui9JQUJCQVdvRkkyUkZJZ0lFUUNBQVFRQktJUUlMSUFCQkFXc2dBQ0FDR3dza2J3c0xJQUVrYlF0V0FRTi9JNHdCUVFGcklnRkJBRXdFUUNPRUFTSUJCRUFqamdFaEFDQUFRUTlJSTRNQkk0TUJHd1IvSUFCQkFXb0ZJNE1CUlNJQ0JFQWdBRUVBU2lFQ0N5QUFRUUZySUFBZ0Foc0xKSTRCQ3dzZ0FTU01BUXVkQVFFQ2YwR0F3QUFqZ1FKMElnRWhBaU9xQVNBQWFpSUFJQUZPQkVBZ0FDQUNheVNxQVFKQUFrQUNRQUpBQWtBanJRRWlBQVJBSUFCQkFrWU5BUUpBSUFCQkJHc09CQU1BQkFVQUN3d0ZDeEEvRUVBUVFSQkNEQVFMRUQ4UVFCQkJFRUlRUlF3REN4QS9FRUFRUVJCQ0RBSUxFRDhRUUJCQkVFSVFSUXdCQ3hCR0VFY1FTQXNnQUVFQmFrRUhjU1N0QVVFQkR3VWdBQ1NxQVF0QkFBdHVBUUYvQWtBQ1FBSkFBa0FnQUVFQlJ3UkFJQUJCQW1zT0F3RUNBd1FMSTFVaUFDT1ZBVWNoQVNBQUpKVUJJQUVQQ3lOcUlnRWpsZ0ZISVFBZ0FTU1dBU0FBRHdzamVTSUFJNWNCUnlFQklBQWtsd0VnQVE4TEk0b0JJZ0VqbUFGSElRQWdBU1NZQVNBQUR3dEJBQXRWQUFKQUFrQUNRQ0FBUVFGSEJFQWdBRUVDUmcwQklBQkJBMFlOQWd3REMwRUJJQUYwUVlFQmNVRUFSdzhMUVFFZ0FYUkJod0Z4UVFCSER3dEJBU0FCZEVIK0FIRkJBRWNQQzBFQklBRjBRUUZ4UVFCSEMzQUJBWDhqVnlBQWF5SUJRUUJNQkVBZ0FTUlhRWUFRSTFaclFRSjBJZ0JCQW5RZ0FDT0JBaHNrVnlOWElBRkJIM1VpQUNBQUlBRnFjMnNrVnlOY1FRRnFRUWR4SkZ3RklBRWtWd3NqVlNOVUlnQWdBQnNFZnlOYUJVRVBEd3NqVENOY0VFc0VmMEVCQlVGL0MyeEJEMm9MWkFFQmZ5TnNJQUJySWdFa2JDQUJRUUJNQkVCQmdCQWphMnRCQW5RamdRSjBKR3dqYkNBQlFSOTFJZ0FnQUNBQmFuTnJKR3dqY1VFQmFrRUhjU1J4Q3lOcUkya2lBQ0FBR3dSL0kyOEZRUThQQ3lOaEkzRVFTd1IvUVFFRlFYOExiRUVQYWd2dUFRRUNmeU43SUFCcklnRkJBRXdFUUNBQkpIdEJnQkFqZW10QkFYUWpnUUowSkhzamV5QUJRUjkxSWdBZ0FDQUJhbk5ySkhzamZVRUJha0VmY1NSOUJTQUJKSHNMSTM0aEFTTjVJM2dpQUNBQUd3UkFJMzhFUUVHYy9nTVFBa0VGZFVFUGNTSUJKSDVCQUNSL0N3VkJEdzhMSTMwaUFrRUJkVUd3L2dOcUVBSWdBa0VCY1VWQkFuUjFRUTl4SVFCQkFDRUNBa0FDUUFKQUFrQWdBUVJBSUFGQkFVWU5BU0FCUVFKR0RRSU1Bd3NnQUVFRWRTRUFEQU1MUVFFaEFnd0NDeUFBUVFGMUlRQkJBaUVDREFFTElBQkJBblVoQUVFRUlRSUxJQUpCQUVvRWZ5QUFJQUp0QlVFQUMwRVBhZ3VHQVFFQ2Z5T0xBU0FBYXlJQlFRQk1CRUFqandFamhRRjBJNEVDZENBQlFSOTFJZ0FnQUNBQmFuTnJJUUVqa0FFaUFFRUJkU0lDSUFCQkFYRWdBa0VCY1hNaUFrRU9kSElpQUVHL2YzRWdBa0VHZEhJZ0FDT0dBUnNra0FFTElBRWtpd0VqaWdFamlRRWlBQ0FBR3dSL0k0NEJCVUVQRHd0QmYwRUJJNUFCUVFGeEcyeEJEMm9MTUFBZ0FFRThSZ1JBUWY4QUR3c2dBRUU4YTBHZ2pRWnNJQUZzUVFOMVFhQ05CbTFCUEdwQm9JMEdiRUdNOFFKdEM1TUJBUUYvUVFBa213RWdBRUVQSTZFQkd5QUJRUThqb2dFYmFpQUNRUThqb3dFYmFpQURRUThqcEFFYmFpRUVJQUJCRHlPbEFSc2dBVUVQSTZZQkcyb2dBa0VQSTZjQkcyb2hBU0FEUVE4anFBRWJJUU5CQUNTY0FVRUFKSjBCSUFRam53RkJBV29RVUNFQUlBRWdBMm9qb0FGQkFXb1FVQ0VCSUFBa21RRWdBU1NhQVNBQlFmOEJjU0FBUWY4QmNVRUlkSElMbWdNQkJYOGpTQ0FBYWlJQkpFZ2pWeUFCYTBFQVRDSUJSUVJBUVFFUVNpRUJDeU5nSUFCcUlnUWtZQ05zSUFSclFRQk1JZ1JGQkVCQkFoQktJUVFMSTNJZ0FHb2tjaU4vUlNJQ0JFQWpleU55YTBFQVNpRUNDeUFDUlNJQ1JRUkFRUU1RU2lFQ0N5T0FBU0FBYWlTQUFTT0xBU09BQVd0QkFFd2lCVVVFUUVFRUVFb2hCUXNnQVFSQUkwZ2hBMEVBSkVnZ0F4Qk1KSkVCQ3lBRUJFQWpZQ0VEUVFBa1lDQURFRTBra2dFTElBSUVRQ055SVFOQkFDUnlJQU1RVGlTVEFRc2dCUVJBSTRBQklRTkJBQ1NBQVNBREVFOGtsQUVMQW44Z0FTQUVJQUViSWdGRkJFQWdBaUVCQ3lBQlJRc0VRQ0FGSVFFTElBRUVRRUVCSkowQkN5T3JBU09zQVNBQWJHb2lBVUdBZ0lBQ0k0RUNkQ0lBVGdSQUlBRWdBR3NpQVNTckFTT2RBU0lBSTVzQklBQWJJZ0JGQkVBam5BRWhBQXNnQUFSQUk1RUJJNUlCSTVNQkk1UUJFRkVhQlNBQkpLc0JDeU91QVNJQlFRRjBRWUNad1FCcUlnQWptUUZCQW1vNkFBQWdBRUVCYWlPYUFVRUNham9BQUNBQlFRRnFJZ0FqcndGQkFYVkJBV3RPQkg4Z0FFRUJhd1VnQUFza3JnRUxDNkFEQVFWL0lBQVFUQ0VDSUFBUVRTRUJJQUFRVGlFRElBQVFUeUVFSUFJa2tRRWdBU1NTQVNBREpKTUJJQVFrbEFFanF3RWpyQUVnQUd4cUlnQkJnSUNBQWlPQkFuUk9CRUFnQUVHQWdJQUNJNEVDZEdza3F3RWdBaUFCSUFNZ0JCQlJJUUFqcmdGQkFYUkJnSm5CQUdvaUJTQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0JVRUJhaUFBUWY4QmNVRUNham9BQUNNMkJFQWdBa0VQUVE5QkR4QlJJUUFqcmdGQkFYUkJnSmtoYWlJQ0lBQkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUJCL3dGeFFRSnFPZ0FBUVE4Z0FVRVBRUThRVVNFQUk2NEJRUUYwUVlDWktXb2lBU0FBUVlEK0EzRkJDSFZCQW1vNkFBQWdBVUVCYWlBQVFmOEJjVUVDYWpvQUFFRVBRUThnQTBFUEVGRWhBQ091QVVFQmRFR0FtVEZxSWdFZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFGQkFXb2dBRUgvQVhGQkFtbzZBQUJCRDBFUFFROGdCQkJSSVFBanJnRkJBWFJCZ0prNWFpSUJJQUJCZ1A0RGNVRUlkVUVDYWpvQUFDQUJRUUZxSUFCQi93RnhRUUpxT2dBQUN5T3VBVUVCYWlJQUk2OEJRUUYxUVFGclRnUi9JQUJCQVdzRklBQUxKSzRCQ3dzZUFRRi9JQUFRU1NFQklBRkZJek1qTXhzRVFDQUFFRklGSUFBUVV3c0xLQUVCZjBIWEFDT0JBblFoQUFOQUk1NEJJQUJPQkVBZ0FCQlVJNTRCSUFCckpKNEJEQUVMQ3dzaEFDQUFRYWIrQTBZRVFFR20vZ01RQWtHQUFYRWhBQ0FBUWZBQWNnOExRWDhMbkFFQkFYOGowd0VoQUNQVUFRUkFJQUJCZTNFZ0FFRUVjaVBMQVJzaEFDQUFRWDV4SUFCQkFYSWp6Z0ViSVFBZ0FFRjNjU0FBUVFoeUk4d0JHeUVBSUFCQmZYRWdBRUVDY2lQTkFSc2hBQVVqMVFFRVFDQUFRWDV4SUFCQkFYSWp6d0ViSVFBZ0FFRjljU0FBUVFKeUk5QUJHeUVBSUFCQmUzRWdBRUVFY2lQUkFSc2hBQ0FBUVhkeElBQkJDSElqMGdFYklRQUxDeUFBUWZBQmNndlBBZ0VCZnlBQVFZQ0FBa2dFUUVGL0R3c2dBRUdBZ0FKT0lnRUVmeUFBUVlEQUFrZ0ZJQUVMQkVCQmZ3OExJQUJCZ01BRFRpSUJCSDhnQUVHQS9BTklCU0FCQ3dSQUlBQkJnRUJxRUFJUEN5QUFRWUQ4QTA0aUFRUi9JQUJCbi8wRFRBVWdBUXNFUUVIL0FVRi9JOW9CUVFKSUd3OExJQUJCemY0RFJnUkFRZjhCSVFGQnpmNERFQUpCQVhGRkJFQkIvZ0VoQVFzamdRSkZCRUFnQVVIL2ZuRWhBUXNnQVE4TElBQkJ4UDREUmdSQUlBQWo1Z0VRQlNQbUFROExJQUJCa1A0RFRpSUJCSDhnQUVHbS9nTk1CU0FCQ3dSQUVGVWdBQkJXRHdzZ0FFR3cvZ05PSWdFRWZ5QUFRYi8rQTB3RklBRUxCRUFRVlVGL0R3c2dBRUdFL2dOR0JFQWdBQ08vQVVHQS9nTnhRUWgxSWdFUUJTQUJEd3NnQUVHRi9nTkdCRUFnQUNQQUFSQUZJOEFCRHdzZ0FFR1AvZ05HQkVBanVBRkI0QUZ5RHdzZ0FFR0EvZ05HQkVBUVZ3OExRWDhMS1FFQmZ5UFhBU0FBUmdSQVFRRWsyUUVMSUFBUVdDSUJRWDlHQkg4Z0FCQUNCU0FCUWY4QmNRc0xzd0lCQkg4ajd3RUVRQThMSS9BQklRVWo4UUVoQXlBQVFmOC9UQVJBSUFNRWZ5QUJRUkJ4UlFVZ0F3dEZCRUFnQVVFUGNTSUVCRUFnQkVFS1JnUkFRUUVrN1FFTEJVRUFKTzBCQ3dzRklBQkIvLzhBVEFSQUkvTUJJZ1JGSWdJRWZ5QUNCU0FBUWYvZkFFd0xCRUFnQVVFUGNTUHJBU0FER3lFQ0lBVUVmeUFCUVI5eElRRWdBa0hnQVhFRkkvSUJCSDhnQVVIL0FIRWhBU0FDUVlBQmNRVkJBQ0FDSUFRYkN3c2hBQ0FBSUFGeUpPc0JCU1ByQVVIL0FYRWdBVUVBU2tFSWRISWs2d0VMQlNBRFJTSUVCSDhnQUVIL3Z3Rk1CU0FFQ3dSQUkrNEJJQVVnQlJzRVFDUHJBVUVmY1NBQlFlQUJjWElrNndFUEN5QUJRUTl4SUFGQkEzRWo4d0ViSk93QkJTQURSU0lDQkg4Z0FFSC8vd0ZNQlNBQ0N3UkFJQVVFUUNBQlFRRnhRUUJISk80QkN3c0xDd3NMS0FBZ0FFRUVkVUVQY1NST0lBQkJDSEZCQUVja1R5QUFRUWR4SkZBZ0FFSDRBWEZCQUVva1ZRc29BQ0FBUVFSMVFROXhKR01nQUVFSWNVRUFSeVJrSUFCQkIzRWtaU0FBUWZnQmNVRUFTaVJxQ3l3QUlBQkJCSFZCRDNFa2dnRWdBRUVJY1VFQVJ5U0RBU0FBUVFkeEpJUUJJQUJCK0FGeFFRQktKSW9CQ3pnQUlBQkJCSFVraFFFZ0FFRUljVUVBUnlTR0FTQUFRUWR4SWdBa2h3RWdBRUVCZENJQVFRRklCRUJCQVNFQUN5QUFRUU4wSkk4QkMyTUJBWDlCQVNSVUkxbEZCRUJCd0FBa1dRdEJnQkFqVm10QkFuUWlBRUVDZENBQUk0RUNHeVJYSTFBa1dDTk9KRm9qVmlSZkkwa2lBQ1JlSUFCQkFFb2lBQVIvSTB0QkFFb0ZJQUFMSkYwalMwRUFTZ1JBRUVRTEkxVkZCRUJCQUNSVUN3c3lBRUVCSkdramJrVUVRRUhBQUNSdUMwR0FFQ05yYTBFQ2RDT0JBblFrYkNObEpHMGpZeVJ2STJwRkJFQkJBQ1JwQ3dzdUFFRUJKSGdqZkVVRVFFR0FBaVI4QzBHQUVDTjZhMEVCZENPQkFuUWtlMEVBSkgwamVVVUVRRUVBSkhnTEMwRUFRUUVraVFFampRRkZCRUJCd0FBa2pRRUxJNDhCSTRVQmRDT0JBblFraXdFamhBRWtqQUVqZ2dFa2pnRkIvLzhCSkpBQkk0b0JSUVJBUVFBa2lRRUxDMXdBSUFCQmdBRnhRUUJISktRQklBQkJ3QUJ4UVFCSEpLTUJJQUJCSUhGQkFFY2tvZ0VnQUVFUWNVRUFSeVNoQVNBQVFRaHhRUUJISktnQklBQkJCSEZCQUVja3B3RWdBRUVDY1VFQVJ5U21BU0FBUVFGeFFRQkhKS1VCQytrRUFRRi9JQUJCcHY0RFJ5SUNCRUFqcVFGRklRSUxJQUlFUUVFQUR3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0pCa1A0RFJ3UkFJQUpCa2Y0RGF3NFdBZ1lLRGhVREJ3c1BBUVFJREJBVkJRa05FUklURkJVTElBRkI4QUJ4UVFSMUpFa2dBVUVJY1VFQVJ5UktJQUZCQjNFa1N3d1ZDeUFCUVlBQmNVRUFSeVI1REJRTElBRkJCblZCQTNFa1RDQUJRVDl4SkUxQndBQWpUV3NrV1F3VEN5QUJRUVoxUVFOeEpHRWdBVUUvY1NSaVFjQUFJMkpySkc0TUVnc2dBU1J6UVlBQ0kzTnJKSHdNRVFzZ0FVRS9jU1NCQVVIQUFDT0JBV3NralFFTUVBc2dBUkJiREE4TElBRVFYQXdPQzBFQkpIOGdBVUVGZFVFUGNTUjBEQTBMSUFFUVhRd01DeUFCSkZFalUwRUlkQ0FCY2lSV0RBc0xJQUVrWmlOb1FRaDBJQUZ5SkdzTUNnc2dBU1IxSTNkQkNIUWdBWElrZWd3SkN5QUJFRjRNQ0FzZ0FVR0FBWEVFUUNBQlFjQUFjVUVBUnlSU0lBRkJCM0VpQUNSVEkxRWdBRUVJZEhJa1ZoQmZDd3dIQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISkdjZ0FVRUhjU0lBSkdnalppQUFRUWgwY2lSckVHQUxEQVlMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNrZGlBQlFRZHhJZ0FrZHlOMUlBQkJDSFJ5SkhvUVlRc01CUXNnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVNJQVJCaUN3d0VDeUFCUVFSMVFRZHhKSjhCSUFGQkIzRWtvQUZCQVNTYkFRd0RDeUFCRUdOQkFTU2NBUXdDQ3lBQlFZQUJjVUVBUnlTcEFTQUJRWUFCY1VVRVFBSkFRWkQrQXlFQ0EwQWdBa0dtL2dOT0RRRWdBa0VBRUFVZ0FrRUJhaUVDREFBQUN3QUxDd3dCQzBFQkR3dEJBUXM4QVFGL0lBQkJDSFFoQVVFQUlRQURRQUpBSUFCQm53RktEUUFnQUVHQS9BTnFJQUFnQVdvUUFoQUZJQUJCQVdvaEFBd0JDd3RCaEFVaytRRUxJd0VCZnlQMEFSQUNJUUFqOVFFUUFrSC9BWEVnQUVIL0FYRkJDSFJ5UWZEL0EzRUxKd0VCZnlQMkFSQUNJUUFqOXdFUUFrSC9BWEVnQUVIL0FYRkJDSFJ5UWZBL2NVR0FnQUpxQzRRQkFRTi9JNEFDUlFSQUR3c2dBRUdBQVhGRkkvb0JJL29CR3dSQVFRQWsrZ0VqK0FFUUFrR0FBWEloQUNQNEFTQUFFQVVQQ3hCbUlRRVFaeUVDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKUG9CSUFNayt3RWdBU1Q4QVNBQ0pQMEJJL2dCSUFCQi8zNXhFQVVGSUFFZ0FpQURFSElqK0FGQi93RVFCUXNMWGdFRWZ5TkZJUU1qUkNBQVJpSUNSUVJBSUFBZ0EwWWhBZ3NnQWdSQUlBQkJBV3NpQkJBQ1FiOS9jU0lDUVQ5eElnVkJRR3NnQlNBQUlBTkdHMEdBa0FScUlBRTZBQUFnQWtHQUFYRUVRQ0FFSUFKQkFXcEJnQUZ5RUFVTEN3czhBUUYvQWtBQ1FBSkFBa0FnQUFSQUlBQWlBVUVCUmcwQklBRkJBa1lOQWlBQlFRTkdEUU1NQkF0QkNROExRUU1QQzBFRkR3dEJCdzhMUVFBTEpRRUJmMEVCSThVQkVHb2lBblFnQUhGQkFFY2lBQVIvUVFFZ0FuUWdBWEZGQlNBQUN3dUZBUUVFZndOQUlBSWdBRWdFUUNBQ1FRUnFJUUlqdndFaUFVRUVha0gvL3dOeElnTWt2d0VqeEFFRVFDUENBU0VFSThFQkJFQWp3d0Vrd0FGQkFTUzdBVUVDRUQxQkFDVEJBVUVCSk1JQkJTQUVCRUJCQUNUQ0FRc0xJQUVnQXhCckJFQWp3QUZCQVdvaUFVSC9BVW9FUUVFQkpNRUJRUUFoQVFzZ0FTVEFBUXNMREFFTEN3c01BQ08rQVJCc1FRQWt2Z0VMUmdFQmZ5Ty9BU0VBUVFBa3Z3RkJoUDREUVFBUUJTUEVBUVIvSUFCQkFCQnJCU1BFQVFzRVFDUEFBVUVCYWlJQVFmOEJTZ1JBUVFFa3dRRkJBQ0VBQ3lBQUpNQUJDd3VDQVFFRGZ5UEVBU0VCSUFCQkJIRkJBRWNreEFFZ0FFRURjU0VDSUFGRkJFQWp4UUVRYWlFQUlBSVFhaUVESTc4QklRRWp4QUVFZjBFQklBQjBJQUZ4QlVFQklBQjBJQUZ4UVFCSElnQUVmMEVCSUFOMElBRnhCU0FBQ3dzRVFDUEFBVUVCYWlJQVFmOEJTZ1JBUVFFa3dRRkJBQ0VBQ3lBQUpNQUJDd3NnQWlURkFRdlNCZ0VDZndKQUFrQWdBRUhOL2dOR0JFQkJ6ZjRESUFGQkFYRVFCUXdCQ3lBQVFZQ0FBa2dFUUNBQUlBRVFXZ3dCQ3lBQVFZQ0FBazRpQWdSQUlBQkJnTUFDU0NFQ0N5QUNEUUVnQUVHQXdBTk9JZ0lFUUNBQVFZRDhBMGdoQWdzZ0FnUkFJQUJCZ0VCcUlBRVFCUXdDQ3lBQVFZRDhBMDRpQWdSQUlBQkJuLzBEVENFQ0N5QUNCRUFqMmdGQkFrNFBDeUFBUWFEOUEwNGlBZ1JBSUFCQi8vMERUQ0VDQ3lBQ0RRQWdBRUdDL2dOR0JFQWdBVUVCY1VFQVJ5VElBU0FCUVFKeFFRQkhKTWtCSUFGQmdBRnhRUUJISk1vQlFRRVBDeUFBUVpEK0EwNGlBZ1JBSUFCQnB2NERUQ0VDQ3lBQ0JFQVFWU0FBSUFFUVpBOExJQUJCc1A0RFRpSUNCRUFnQUVHLy9nTk1JUUlMSUFJRVFCQlZDeUFBUWNEK0EwNGlBZ1JBSUFCQnkvNERUQ0VDQ3lBQ0JFQWdBRUhBL2dOR0JFQWdBUkFpREFNTElBQkJ3ZjREUmdSQVFjSCtBeUFCUWZnQmNVSEIvZ01RQWtFSGNYSkJnQUZ5RUFVTUFnc2dBRUhFL2dOR0JFQkJBQ1RtQVNBQVFRQVFCUXdDQ3lBQVFjWCtBMFlFUUNBQkpOc0JEQU1MSUFCQnh2NERSZ1JBSUFFUVpRd0RDd0pBQWtBQ1FBSkFJQUFpQWtIRC9nTkhCRUFnQWtIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTVG5BUXdHQ3lBQkpPZ0JEQVVMSUFFazZRRU1CQXNnQVNUcUFRd0RDd3dDQ3lQNEFTQUFSZ1JBSUFFUWFBd0JDeVAvQVNBQVJpSUNSUVJBSS80QklBQkdJUUlMSUFJRVFDUDZBUVJBQW44ai9BRWlBa0dBZ0FGT0lnTUVRQ0FDUWYvL0FVd2hBd3NnQTBVTEJFQWdBa0dBb0FOT0lnTUVRQ0FDUWYrL0Ewd2hBd3NMSUFNTkFnc0xJQUFqUTA0aUFnUkFJQUFqUlV3aEFnc2dBZ1JBSUFBZ0FSQnBEQUlMSUFCQmhQNERUaUlDQkVBZ0FFR0gvZ05NSVFJTElBSUVRQkJ0QWtBQ1FBSkFBa0FnQUNJQ1FZVCtBMGNFUUNBQ1FZWCtBMnNPQXdFQ0F3UUxFRzRNQlFzQ1FDUEVBUVJBSThJQkRRRWp3UUVFUUVFQUpNRUJDd3NnQVNUQUFRc01CUXNnQVNUREFTUENBU1BFQVNJQUlBQWJCRUFnQVNUQUFVRUFKTUlCQ3d3RUN5QUJFRzhNQXdzTUFnc2dBRUdBL2dOR0JFQWdBVUgvQVhNazB3RWowd0VpQWtFUWNVRUFSeVRVQVNBQ1FTQnhRUUJISk5VQkN5QUFRWS8rQTBZRVFDQUJFQk1NQWdzZ0FFSC8vd05HQkVBZ0FSQVNEQUlMUVFFUEMwRUFEd3RCQVFzZkFDUFlBU0FBUmdSQVFRRWsyUUVMSUFBZ0FSQndCRUFnQUNBQkVBVUxDMW9CQTM4RFFBSkFJQU1nQWs0TkFDQUFJQU5xRUZraEJTQUJJQU5xSVFRRFFDQUVRZisvQWtvRVFDQUVRWUJBYWlFRURBRUxDeUFFSUFVUWNTQURRUUZxSVFNTUFRc0xJL2tCUVNBamdRSjBJQUpCQkhWc2FpVDVBUXR5QVFKL0kvb0JSUVJBRHd0QkVDRUFJL3dCSS8wQkFuOGord0VpQVVFUVNBUkFJQUVoQUFzZ0FBc1FjaVA4QVNBQWFpVDhBU1A5QVNBQWFpVDlBU0FCSUFCcklnRWsrd0VqK0FFaEFDQUJRUUJNQkVCQkFDVDZBU0FBUWY4QkVBVUZJQUFnQVVFRWRVRUJhMEgvZm5FUUJRc0xRd0VCZndKL0lBQkZJZ0pGQkVBZ0FFRUJSaUVDQ3lBQ0N3Ui9JK1lCSTlzQlJnVWdBZ3NFUUNBQlFRUnlJZ0ZCd0FCeEJFQVFQZ3NGSUFGQmUzRWhBUXNnQVF2NkFRRUZmeVBjQVVVRVFBOExJOW9CSVFNZ0F5UG1BU0lFUVpBQlRnUi9RUUVGSStVQklnSkIrQUlqZ1FKMElnQk9CSDlCQWdWQkEwRUFJQUlnQUU0YkN3c2lBVWNFUUVIQi9nTVFBaUVBSUFFazJnRkJBQ0VDQWtBQ1FBSkFBa0FnQVFSQUlBRkJBV3NPQXdFQ0F3UUxJQUJCZkhFaUFFRUljVUVBUnlFQ0RBTUxJQUJCZlhGQkFYSWlBRUVRY1VFQVJ5RUNEQUlMSUFCQmZuRkJBbklpQUVFZ2NVRUFSeUVDREFFTElBQkJBM0loQUFzZ0FnUkFFRDRMSUFGRkJFQVFjd3NnQVVFQlJnUkFRUUVrdVFGQkFCQTlDMEhCL2dNZ0FTQUFFSFFRQlFVZ0JFR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUFoQjBFQVVMQ3d1ZkFRRUJmeVBjQVFSQUkrVUJJQUJxSk9VQkl6SWhBUU5BSStVQlFRUWpnUUlpQUhSQnlBTWdBSFFqNWdGQm1RRkdHMDRFUUNQbEFVRUVJNEVDSWdCMFFjZ0RJQUIwSStZQlFaa0JSaHRySk9VQkkrWUJJZ0JCa0FGR0JFQWdBUVJBRURzRklBQVFPZ3NRUEVGL0pFWkJmeVJIQlNBQVFaQUJTQVJBSUFGRkJFQWdBQkE2Q3dzTFFRQWdBRUVCYWlBQVFaa0JTaHNrNWdFTUFRc0xDeEIxQ3pjQkFYOUJCQ09CQWlJQWRFSElBeUFBZENQbUFVR1pBVVliSVFBRFFDUGtBU0FBVGdSQUlBQVFkaVBrQVNBQWF5VGtBUXdCQ3dzTHVBRUJCSDhqeWdGRkJFQVBDd05BSUFNZ0FFZ0VRQ0FEUVFScUlRTUNmeVBHQVNJQ1FRUnFJZ0ZCLy84RFNnUkFJQUZCZ0lBRWF5RUJDeUFCQ3lUR0FVRUJRUUpCQnlQSkFSc2lCSFFnQW5GQkFFY2lBZ1JBUVFFZ0JIUWdBWEZGSVFJTElBSUVRRUdCL2dOQmdmNERFQUpCQVhSQkFXcEIvd0Z4RUFVanh3RkJBV29pQVVFSVJnUkFRUUFreHdGQkFTUzhBVUVERUQxQmd2NERRWUwrQXhBQ1FmOStjUkFGUVFBa3lnRUZJQUVreHdFTEN3d0JDd3NMamdFQUkva0JRUUJLQkVBaitRRWdBR29oQUVFQUpQa0JDeU9NQWlBQWFpU01BaU9RQWtVRVFDTXdCRUFqNUFFZ0FHb2s1QUVRZHdVZ0FCQjJDeU12QkVBam5nRWdBR29rbmdFRklBQVFWQXNnQUJCNEN5TXhCRUFqdmdFZ0FHb2t2Z0VRYlFVZ0FCQnNDeU9UQWlBQWFpSUFJNUVDVGdSQUk1SUNRUUZxSkpJQ0lBQWprUUpySVFBTElBQWtrd0lMQ3dCQkJCQjVJNHNDRUFJTEp3RUJmMEVFRUhraml3SkJBV3BCLy84RGNSQUNJUUFRZWtIL0FYRWdBRUgvQVhGQkNIUnlDd3dBUVFRUWVTQUFJQUVRY1FzMUFRRi9RUUVnQUhSQi93RnhJUUlnQVVFQVNnUkFJNGtDSUFKeVFmOEJjU1NKQWdVamlRSWdBa0gvQVhOeEpJa0NDeU9KQWdzSkFFRUZJQUFRZlJvTE9BRUJmeUFCUVFCT0JFQWdBRUVQY1NBQlFROXhha0VRY1VFQVJ4QitCU0FCUVI5MUlnSWdBU0FDYW5OQkQzRWdBRUVQY1VzUWZnc0xDUUJCQnlBQUVIMGFDd2tBUVFZZ0FCQjlHZ3NKQUVFRUlBQVFmUm9MT1FFQmZ5QUJRWUQrQTNGQkNIVWhBaUFBSUFGQi93RnhJZ0VRY0FSQUlBQWdBUkFGQ3lBQVFRRnFJZ0FnQWhCd0JFQWdBQ0FDRUFVTEN3MEFRUWdRZVNBQUlBRVFnd0VMV0FBZ0FnUkFJQUVnQUVILy93TnhJZ0JxSUFBZ0FYTnpJZ0pCRUhGQkFFY1FmaUFDUVlBQ2NVRUFSeENDQVFVZ0FDQUJha0gvL3dOeElnSWdBRUgvL3dOeFNSQ0NBU0FBSUFGeklBSnpRWUFnY1VFQVJ4QitDd3NLQUVFRUVIa2dBQkJaQzVRRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNNRlFzUWUwSC8vd054SWdCQmdQNERjVUVJZFNTREFpQUFRZjhCY1NTRUFnd1BDeU9FQWtIL0FYRWpnd0pCL3dGeFFRaDBjaU9DQWhCOERCTUxJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSU1DREJNTEk0TUNJZ0JCQVJCL0lBQkJBV3BCL3dGeElnQWtnd0lNRFFzamd3SWlBRUYvRUg4Z0FFRUJhMEgvQVhFaUFDU0RBZ3dOQ3hCNlFmOEJjU1NEQWd3TkN5T0NBaUlBUVlBQmNVR0FBVVlRZ2dFZ0FFRUJkQ0FBUWY4QmNVRUhkbkpCL3dGeEpJSUNEQTBMRUh0Qi8vOERjU09LQWhDRUFRd0lDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaUlBSTRRQ1FmOEJjU09EQWtIL0FYRkJDSFJ5SWdGQkFCQ0ZBU0FBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkljQ0lBQkIvd0Z4SklnQ1FRQVFnUUZCQ0E4TEk0UUNRZjhCY1NPREFrSC9BWEZCQ0hSeUVJWUJRZjhCY1NTQ0Fnd0xDeU9FQWtIL0FYRWpnd0pCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NEQWd3TEN5T0VBaUlBUVFFUWZ5QUFRUUZxUWY4QmNTSUFKSVFDREFVTEk0UUNJZ0JCZnhCL0lBQkJBV3RCL3dGeElnQWtoQUlNQlFzUWVrSC9BWEVraEFJTUJRc2pnZ0lpQUVFQmNVRUFTeENDQVNBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFa2dnSU1CUXRCZnc4TEk0c0NRUUpxUWYvL0EzRWtpd0lNQkFzZ0FFVVFnQUZCQUJDQkFRd0RDeUFBUlJDQUFVRUJFSUVCREFJTEk0c0NRUUZxUWYvL0EzRWtpd0lNQVF0QkFCQ0FBVUVBRUlFQlFRQVFmZ3RCQkE4TElBQkIvd0Z4SklRQ1FRZ0xnd1lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFDQUFRUkZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPQUFnUkFRYzMrQXhDR0FVSC9BWEVpQUVFQmNRUkFRYzMrQXlBQVFYNXhJZ0JCZ0FGeEJIOUJBQ1NCQWlBQVFmOStjUVZCQVNTQkFpQUFRWUFCY2dzUWZFSEVBQThMQzBFQkpKQUNEQkFMRUh0Qi8vOERjU0lBUVlEK0EzRkJDSFVraFFJZ0FFSC9BWEVraGdJaml3SkJBbXBCLy84RGNTU0xBZ3dSQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lPQ0FoQjhEQkFMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSklVQ0RCQUxJNFVDSWdCQkFSQi9JQUJCQVdwQi93RnhKSVVDSTRVQ1JSQ0FBVUVBRUlFQkRBNExJNFVDSWdCQmZ4Qi9JQUJCQVd0Qi93RnhKSVVDSTRVQ1JSQ0FBVUVCRUlFQkRBMExFSHBCL3dGeEpJVUNEQW9MSTRJQ0lnRkJnQUZ4UVlBQlJpRUFJNGtDUVFSMlFRRnhJQUZCQVhSeVFmOEJjU1NDQWd3S0N4QjZJUUFqaXdJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSXNDUVFnUEN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpSUFJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJZ0ZCQUJDRkFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWNDSUFCQi93RnhKSWdDUVFBUWdRRkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5RUlZQlFmOEJjU1NDQWd3SUN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0ZBZ3dJQ3lPR0FpSUFRUUVRZnlBQVFRRnFRZjhCY1NJQUpJWUNJQUJGRUlBQlFRQVFnUUVNQmdzamhnSWlBRUYvRUg4Z0FFRUJhMEgvQVhFaUFDU0dBaUFBUlJDQUFVRUJFSUVCREFVTEVIcEIvd0Z4SklZQ0RBSUxJNElDSWdGQkFYRkJBVVloQUNPSkFrRUVka0VCY1VFSGRDQUJRZjhCY1VFQmRuSWtnZ0lNQWd0QmZ3OExJNHNDUVFGcVFmLy9BM0VraXdJTUFRc2dBQkNDQVVFQUVJQUJRUUFRZ1FGQkFCQitDMEVFRHdzZ0FFSC9BWEVraGdKQkNBdmVCZ0VDZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQklFY0VRQ0FBUVNGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5T0pBa0VIZGtFQmNRUkFJNHNDUVFGcVFmLy9BM0VraXdJRkVIb2hBQ09MQWlBQVFSaDBRUmgxYWtILy93TnhRUUZxUWYvL0EzRWtpd0lMUVFnUEN4QjdRZi8vQTNFaUFFR0EvZ054UVFoMUpJY0NJQUJCL3dGeEpJZ0NJNHNDUVFKcVFmLy9BM0VraXdJTUZBc2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWlBQ09DQWhCOERBOExJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWNDREEwTEk0Y0NJZ0JCQVJCL0lBQkJBV3BCL3dGeElnQWtod0lNRGdzamh3SWlBRUYvRUg4Z0FFRUJhMEgvQVhFaUFDU0hBZ3dPQ3hCNlFmOEJjU1NIQWd3T0MwRUdRUUFqaVFJaUFrRUZka0VCY1VFQVN4c2lBVUhnQUhJZ0FTQUNRUVIyUVFGeFFRQkxHeUVCSTRJQ0lRQWdBa0VHZGtFQmNVRUFTd1IvSUFBZ0FXdEIvd0Z4QlNBQlFRWnlJQUVnQUVFUGNVRUpTeHNpQVVIZ0FISWdBU0FBUVprQlN4c2lBU0FBYWtIL0FYRUxJZ0JGRUlBQklBRkI0QUJ4UVFCSEVJSUJRUUFRZmlBQUpJSUNEQTRMSTRrQ1FRZDJRUUZ4UVFCTEJFQVFlaUVBSTRzQ0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NMQWdVaml3SkJBV3BCLy84RGNTU0xBZ3RCQ0E4TEk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUlnQWdBRUgvL3dOeFFRQVFoUUVnQUVFQmRFSC8vd054SWdCQmdQNERjVUVJZFNTSEFpQUFRZjhCY1NTSUFrRUFFSUVCUVFnUEN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpSUFFSVlCUWY4QmNTU0NBZ3dIQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNTSEFnd0ZDeU9JQWlJQVFRRVFmeUFBUVFGcVFmOEJjU0lBSklnQ0RBWUxJNGdDSWdCQmZ4Qi9JQUJCQVd0Qi93RnhJZ0FraUFJTUJnc1Fla0gvQVhFa2lBSU1CZ3NqZ2dKQmYzTkIvd0Z4SklJQ1FRRVFnUUZCQVJCK0RBWUxRWDhQQ3lBQVFmOEJjU1NJQWtFSUR3c2dBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NIQWlBQVFmOEJjU1NJQWd3REN5QUFSUkNBQVVFQUVJRUJEQUlMSUFCRkVJQUJRUUVRZ1FFTUFRc2ppd0pCQVdwQi8vOERjU1NMQWd0QkJBdlhCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJNRWNFUUNBQVFURnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9KQWtFRWRrRUJjUVJBSTRzQ1FRRnFRZi8vQTNFa2l3SUZFSG9oQUNPTEFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VraXdJTFFRZ1BDeEI3UWYvL0EzRWtpZ0lqaXdKQkFtcEIvLzhEY1NTTEFnd1JDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaUlBSTRJQ0VId01EZ3NqaWdKQkFXcEIvLzhEY1NTS0FrRUlEd3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElpQVJDR0FTSUFRUUVRZnlBQVFRRnFRZjhCY1NJQVJSQ0FBVUVBRUlFQklBRWdBQkI4REE0TEk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUlnRVFoZ0VpQUVGL0VIOGdBRUVCYTBIL0FYRWlBRVVRZ0FGQkFSQ0JBU0FCSUFBUWZBd05DeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaEI2UWY4QmNSQjhEQXNMUVFBUWdRRkJBQkIrUVFFUWdnRU1Dd3NqaVFKQkJIWkJBWEZCQVVZRVFCQjZJUUFqaXdJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSXNDQlNPTEFrRUJha0gvL3dOeEpJc0NDMEVJRHdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJaUFDT0tBa0VBRUlVQkk0b0NJQUJxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWNDSUFCQi93RnhKSWdDUVFBUWdRRkJDQThMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5SWdBUWhnRkIvd0Z4SklJQ0RBWUxJNG9DUVFGclFmLy9BM0VraWdKQkNBOExJNElDSWdCQkFSQi9JQUJCQVdwQi93RnhJZ0FrZ2dJZ0FFVVFnQUZCQUJDQkFRd0dDeU9DQWlJQVFYOFFmeUFBUVFGclFmOEJjU0lBSklJQ0lBQkZFSUFCUVFFUWdRRU1CUXNRZWtIL0FYRWtnZ0lNQXd0QkFCQ0JBVUVBRUg0amlRSkJCSFpCQVhGQkFFMFFnZ0VNQXd0QmZ3OExJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVraHdJZ0FFSC9BWEVraUFJTUFRc2ppd0pCQVdwQi8vOERjU1NMQWd0QkJBdUNBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FBUndSQUlBQkJ3UUJHRFFFQ1FDQUFRY0lBYXc0T0F3UUZCZ2NJQ1JFS0N3d05EZzhBQ3d3UEN3d1BDeU9FQWlTREFnd09DeU9GQWlTREFnd05DeU9HQWlTREFnd01DeU9IQWlTREFnd0xDeU9JQWlTREFnd0tDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaENHQVVIL0FYRWtnd0lNQ1FzamdnSWtnd0lNQ0Fzamd3SWtoQUlNQndzamhRSWtoQUlNQmdzamhnSWtoQUlNQlFzamh3SWtoQUlNQkFzamlBSWtoQUlNQXdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRkIvd0Z4SklRQ0RBSUxJNElDSklRQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFSd1JBSUFCQjBRQkdEUUVDUUNBQVFkSUFhdzRPRUFNRUJRWUhDQWtLRUFzTURRNEFDd3dPQ3lPREFpU0ZBZ3dPQ3lPRUFpU0ZBZ3dOQ3lPR0FpU0ZBZ3dNQ3lPSEFpU0ZBZ3dMQ3lPSUFpU0ZBZ3dLQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2hDR0FVSC9BWEVraFFJTUNRc2pnZ0lraFFJTUNBc2pnd0lraGdJTUJ3c2poQUlraGdJTUJnc2poUUlraGdJTUJRc2pod0lraGdJTUJBc2ppQUlraGdJTUF3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISVFoZ0ZCL3dGeEpJWUNEQUlMSTRJQ0pJWUNEQUVMUVg4UEMwRUVDLzBCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFBUndSQUlBQkI0UUJHRFFFQ1FDQUFRZUlBYXc0T0F3UVFCUVlIQ0FrS0N3d1FEUTRBQ3d3T0N5T0RBaVNIQWd3T0N5T0VBaVNIQWd3TkN5T0ZBaVNIQWd3TUN5T0dBaVNIQWd3TEN5T0lBaVNIQWd3S0N5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNoQ0dBVUgvQVhFa2h3SU1DUXNqZ2dJa2h3SU1DQXNqZ3dJa2lBSU1Cd3NqaEFJa2lBSU1CZ3NqaFFJa2lBSU1CUXNqaGdJa2lBSU1CQXNqaHdJa2lBSU1Bd3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElRaGdGQi93RnhKSWdDREFJTEk0SUNKSWdDREFFTFFYOFBDMEVFQzVRREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQkhCRUFnQUVIeEFFWU5BUUpBSUFCQjhnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVRQUxEQThMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5STRNQ0VId01Ed3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElqaEFJUWZBd09DeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaU9GQWhCOERBMExJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlJNFlDRUh3TURBc2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWpod0lRZkF3TEN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpT0lBaEI4REFvTEkvb0JSUVJBQWtBanNBRUVRRUVCSkkwQ0RBRUxJN0lCSTdnQmNVRWZjVVVFUUVFQkpJNENEQUVMUVFFa2p3SUxDd3dKQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2lPQ0FoQjhEQWdMSTRNQ0pJSUNEQWNMSTRRQ0pJSUNEQVlMSTRVQ0pJSUNEQVVMSTRZQ0pJSUNEQVFMSTRjQ0pJSUNEQU1MSTRnQ0pJSUNEQUlMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5RUlZQlFmOEJjU1NDQWd3QkMwRi9Ed3RCQkFzM0FRRi9JQUZCQUU0RVFDQUFRZjhCY1NBQUlBRnFRZjhCY1VzUWdnRUZJQUZCSDNVaUFpQUJJQUpxY3lBQVFmOEJjVW9RZ2dFTEN6TUJBbjhqZ2dJaUFTQUFRZjhCY1NJQ0VIOGdBU0FDRUk4QklBQWdBV3BCL3dGeElnRWtnZ0lnQVVVUWdBRkJBQkNCQVF0WEFRSi9JNElDSWdFZ0FHb2ppUUpCQkhaQkFYRnFRZjhCY1NJQ0lBQWdBWE56UVJCeFFRQkhFSDRnQUVIL0FYRWdBV29qaVFKQkJIWkJBWEZxUVlBQ2NVRUFTeENDQVNBQ0pJSUNJQUpGRUlBQlFRQVFnUUVMZ3dJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdBQVVjRVFDQUJRWUVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzamd3SVFrQUVNRUFzamhBSVFrQUVNRHdzamhRSVFrQUVNRGdzamhnSVFrQUVNRFFzamh3SVFrQUVNREFzamlBSVFrQUVNQ3dzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRVFrQUVNQ2dzamdnSVFrQUVNQ1Fzamd3SVFrUUVNQ0FzamhBSVFrUUVNQndzamhRSVFrUUVNQmdzamhnSVFrUUVNQlFzamh3SVFrUUVNQkFzamlBSVFrUUVNQXdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRVFrUUVNQWdzamdnSVFrUUVNQVF0QmZ3OExRUVFMTmdFQ2Z5T0NBaUlCSUFCQi93RnhRWDlzSWdJUWZ5QUJJQUlRandFZ0FTQUFhMEgvQVhFaUFTU0NBaUFCUlJDQUFVRUJFSUVCQzFjQkFuOGpnZ0lpQVNBQWF5T0pBa0VFZGtFQmNXdEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1FmaUFCSUFCQi93RnhheU9KQWtFRWRrRUJjV3RCZ0FKeFFRQkxFSUlCSUFJa2dnSWdBa1VRZ0FGQkFSQ0JBUXVEQWdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWkFCUndSQUlBRkJrUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPREFoQ1RBUXdRQ3lPRUFoQ1RBUXdQQ3lPRkFoQ1RBUXdPQ3lPR0FoQ1RBUXdOQ3lPSEFoQ1RBUXdNQ3lPSUFoQ1RBUXdMQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2hDR0FSQ1RBUXdLQ3lPQ0FoQ1RBUXdKQ3lPREFoQ1VBUXdJQ3lPRUFoQ1VBUXdIQ3lPRkFoQ1VBUXdHQ3lPR0FoQ1VBUXdGQ3lPSEFoQ1VBUXdFQ3lPSUFoQ1VBUXdEQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2hDR0FSQ1VBUXdDQ3lPQ0FoQ1VBUXdCQzBGL0R3dEJCQXNqQVFGL0k0SUNJQUJ4SWdFa2dnSWdBVVVRZ0FGQkFCQ0JBVUVCRUg1QkFCQ0NBUXNuQVFGL0k0SUNJQUJ6UWY4QmNTSUJKSUlDSUFGRkVJQUJRUUFRZ1FGQkFCQitRUUFRZ2dFTGd3SUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHZ0FVY0VRQ0FCUWFFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pnd0lRbGdFTUVBc2poQUlRbGdFTUR3c2poUUlRbGdFTURnc2poZ0lRbGdFTURRc2pod0lRbGdFTURBc2ppQUlRbGdFTUN3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISVFoZ0VRbGdFTUNnc2pnZ0lRbGdFTUNRc2pnd0lRbHdFTUNBc2poQUlRbHdFTUJ3c2poUUlRbHdFTUJnc2poZ0lRbHdFTUJRc2pod0lRbHdFTUJBc2ppQUlRbHdFTUF3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISVFoZ0VRbHdFTUFnc2pnZ0lRbHdFTUFRdEJmdzhMUVFRTEpRQWpnZ0lnQUhKQi93RnhJZ0FrZ2dJZ0FFVVFnQUZCQUJDQkFVRUFFSDVCQUJDQ0FRc3JBUUYvSTRJQ0lnRWdBRUgvQVhGQmYyd2lBQkIvSUFFZ0FCQ1BBU0FBSUFGcVJSQ0FBVUVCRUlFQkM0TUNBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQnNBRkhCRUFnQVVHeEFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJNE1DRUprQkRCQUxJNFFDRUprQkRBOExJNFVDRUprQkRBNExJNFlDRUprQkRBMExJNGNDRUprQkRBd0xJNGdDRUprQkRBc0xJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlFSVlCRUprQkRBb0xJNElDRUprQkRBa0xJNE1DRUpvQkRBZ0xJNFFDRUpvQkRBY0xJNFVDRUpvQkRBWUxJNFlDRUpvQkRBVUxJNGNDRUpvQkRBUUxJNGdDRUpvQkRBTUxJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlFSVlCRUpvQkRBSUxJNElDRUpvQkRBRUxRWDhQQzBFRUN6c0JBWDhnQUJCWUlnRkJmMFlFZnlBQUVBSUZJQUVMUWY4QmNTQUFRUUZxSWdFUVdDSUFRWDlHQkg4Z0FSQUNCU0FBQzBIL0FYRkJDSFJ5Q3dzQVFRZ1FlU0FBRUp3QkN6TUFJQUJCZ0FGeFFZQUJSaENDQVNBQVFRRjBJQUJCL3dGeFFRZDJja0gvQVhFaUFFVVFnQUZCQUJDQkFVRUFFSDRnQUFzeEFDQUFRUUZ4UVFCTEVJSUJJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU0lBUlJDQUFVRUFFSUVCUVFBUWZpQUFDemtCQVg4amlRSkJCSFpCQVhFZ0FFRUJkSEpCL3dGeElRRWdBRUdBQVhGQmdBRkdFSUlCSUFFaUFFVVFnQUZCQUJDQkFVRUFFSDRnQUFzNkFRRi9JNGtDUVFSMlFRRnhRUWQwSUFCQi93RnhRUUYyY2lFQklBQkJBWEZCQVVZUWdnRWdBU0lBUlJDQUFVRUFFSUVCUVFBUWZpQUFDeWtBSUFCQmdBRnhRWUFCUmhDQ0FTQUFRUUYwUWY4QmNTSUFSUkNBQVVFQUVJRUJRUUFRZmlBQUMwUUJBbjhnQUVFQmNVRUJSaUVCSUFCQmdBRnhRWUFCUmlFQ0lBQkIvd0Z4UVFGMklnQkJnQUZ5SUFBZ0Foc2lBRVVRZ0FGQkFCQ0JBVUVBRUg0Z0FSQ0NBU0FBQ3lvQUlBQkJEM0ZCQkhRZ0FFSHdBWEZCQkhaeUlnQkZFSUFCUVFBUWdRRkJBQkIrUVFBUWdnRWdBQXN0QVFGL0lBQkJBWEZCQVVZaEFTQUFRZjhCY1VFQmRpSUFSUkNBQVVFQUVJRUJRUUFRZmlBQkVJSUJJQUFMSFFCQkFTQUFkQ0FCY1VIL0FYRkZFSUFCUVFBUWdRRkJBUkIrSUFFTHNRZ0JCbjhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQjNFaUJpSUZCRUFnQlVFQmF3NEhBUUlEQkFVR0J3Z0xJNE1DSVFFTUJ3c2poQUloQVF3R0N5T0ZBaUVCREFVTEk0WUNJUUVNQkFzamh3SWhBUXdEQ3lPSUFpRUJEQUlMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5RUlZQklRRU1BUXNqZ2dJaEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklnUUVRQ0FFUVFGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5QUFRUWRNQkg5QkFTRUNJQUVRbmdFRklBQkJEMHdFZjBFQklRSWdBUkNmQVFWQkFBc0xJUU1NRHdzZ0FFRVhUQVIvUVFFaEFpQUJFS0FCQlNBQVFSOU1CSDlCQVNFQ0lBRVFvUUVGUVFBTEN5RUREQTRMSUFCQkowd0VmMEVCSVFJZ0FSQ2lBUVVnQUVFdlRBUi9RUUVoQWlBQkVLTUJCVUVBQ3dzaEF3d05DeUFBUVRkTUJIOUJBU0VDSUFFUXBBRUZJQUJCUDB3RWYwRUJJUUlnQVJDbEFRVkJBQXNMSVFNTURBc2dBRUhIQUV3RWYwRUJJUUpCQUNBQkVLWUJCU0FBUWM4QVRBUi9RUUVoQWtFQklBRVFwZ0VGUVFBTEN5RUREQXNMSUFCQjF3Qk1CSDlCQVNFQ1FRSWdBUkNtQVFVZ0FFSGZBRXdFZjBFQklRSkJBeUFCRUtZQkJVRUFDd3NoQXd3S0N5QUFRZWNBVEFSL1FRRWhBa0VFSUFFUXBnRUZJQUJCN3dCTUJIOUJBU0VDUVFVZ0FSQ21BUVZCQUFzTElRTU1DUXNnQUVIM0FFd0VmMEVCSVFKQkJpQUJFS1lCQlNBQVFmOEFUQVIvUVFFaEFrRUhJQUVRcGdFRlFRQUxDeUVEREFnTElBQkJod0ZNQkg5QkFTRUNJQUZCZm5FRklBQkJqd0ZNQkg5QkFTRUNJQUZCZlhFRlFRQUxDeUVEREFjTElBQkJsd0ZNQkg5QkFTRUNJQUZCZTNFRklBQkJud0ZNQkg5QkFTRUNJQUZCZDNFRlFRQUxDeUVEREFZTElBQkJwd0ZNQkg5QkFTRUNJQUZCYjNFRklBQkJyd0ZNQkg5QkFTRUNJQUZCWDNFRlFRQUxDeUVEREFVTElBQkJ0d0ZNQkg5QkFTRUNJQUZCdjM5eEJTQUFRYjhCVEFSL1FRRWhBaUFCUWY5K2NRVkJBQXNMSVFNTUJBc2dBRUhIQVV3RWYwRUJJUUlnQVVFQmNnVWdBRUhQQVV3RWYwRUJJUUlnQVVFQ2NnVkJBQXNMSVFNTUF3c2dBRUhYQVV3RWYwRUJJUUlnQVVFRWNnVWdBRUhmQVV3RWYwRUJJUUlnQVVFSWNnVkJBQXNMSVFNTUFnc2dBRUhuQVV3RWYwRUJJUUlnQVVFUWNnVWdBRUh2QVV3RWYwRUJJUUlnQVVFZ2NnVkJBQXNMSVFNTUFRc2dBRUgzQVV3RWYwRUJJUUlnQVVIQUFISUZJQUJCL3dGTUJIOUJBU0VDSUFGQmdBRnlCVUVBQ3dzaEF3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBWWlCQVJBSUFSQkFXc09Cd0VDQXdRRkJnY0lDeUFESklNQ0RBY0xJQU1raEFJTUJnc2dBeVNGQWd3RkN5QURKSVlDREFRTElBTWtod0lNQXdzZ0F5U0lBZ3dDQ3lBRlFRUklJZ1FFZnlBRUJTQUZRUWRLQ3dSQUk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUlBTVFmQXNNQVFzZ0F5U0NBZ3RCQkVGL0lBSWJDNnNFQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhBQVVjRVFDQUFRY0VCYXc0UEFRSVJBd1FGQmdjSUNRb0xFQXdORGdzamlRSkJCM1pCQVhFTkVRd09DeU9LQWhDZEFVSC8vd054SVFBamlnSkJBbXBCLy84RGNTU0tBaUFBUVlEK0EzRkJDSFVrZ3dJZ0FFSC9BWEVraEFKQkJBOExJNGtDUVFkMlFRRnhEUkVNRGdzamlRSkJCM1pCQVhFTkVBd01DeU9LQWtFQ2EwSC8vd054SWdBa2lnSWdBQ09FQWtIL0FYRWpnd0pCL3dGeFFRaDBjaENFQVF3TkN4QjZFSkFCREEwTEk0b0NRUUpyUWYvL0EzRWlBQ1NLQWlBQUk0c0NFSVFCUVFBa2l3SU1Dd3NqaVFKQkIzWkJBWEZCQVVjTkNnd0hDeU9LQWlJQUVKMEJRZi8vQTNFa2l3SWdBRUVDYWtILy93TnhKSW9DREFrTEk0a0NRUWQyUVFGeFFRRkdEUWNNQ2dzUWVrSC9BWEVRcHdFaEFDT0xBa0VCYWtILy93TnhKSXNDSUFBUEN5T0pBa0VIZGtFQmNVRUJSdzBJSTRvQ1FRSnJRZi8vQTNFaUFDU0tBaUFBSTRzQ1FRSnFRZi8vQTNFUWhBRU1CUXNRZWhDUkFRd0dDeU9LQWtFQ2EwSC8vd054SWdBa2lnSWdBQ09MQWhDRUFVRUlKSXNDREFRTFFYOFBDeU9LQWlJQUVKMEJRZi8vQTNFa2l3SWdBRUVDYWtILy93TnhKSW9DUVF3UEN5T0tBa0VDYTBILy93TnhJZ0FraWdJZ0FDT0xBa0VDYWtILy93TnhFSVFCQ3hCN1FmLy9BM0VraXdJTFFRZ1BDeU9MQWtFQmFrSC8vd054SklzQ1FRUVBDeU9MQWtFQ2FrSC8vd054SklzQ1FRd0xxZ1FCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBRkhCRUFnQUVIUkFXc09Ed0VDRFFNRUJRWUhDQWtOQ2cwTERBMExJNGtDUVFSMlFRRnhEUThqaWdJaUFCQ2RBVUgvL3dOeEpJc0NJQUJCQW1wQi8vOERjU1NLQWtFTUR3c2ppZ0lpQUJDZEFVSC8vd054SVFFZ0FFRUNha0gvL3dOeEpJb0NJQUZCZ1A0RGNVRUlkU1NGQWlBQlFmOEJjU1NHQWtFRUR3c2ppUUpCQkhaQkFYRU5Dd3dNQ3lPSkFrRUVka0VCY1EwS0k0b0NRUUpyUWYvL0EzRWlBU1NLQWlBQkk0c0NRUUpxUWYvL0EzRVFoQUVNQ3dzamlnSkJBbXRCLy84RGNTSUJKSW9DSUFFamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJUWhBRU1Dd3NRZWhDVEFRd0xDeU9LQWtFQ2EwSC8vd054SWdFa2lnSWdBU09MQWhDRUFVRVFKSXNDREFrTEk0a0NRUVIyUVFGeFFRRkhEUWdqaWdJaUFSQ2RBVUgvL3dOeEpJc0NJQUZCQW1wQi8vOERjU1NLQWtFTUR3c2ppZ0lpQVJDZEFVSC8vd054SklzQ1FRRWtzUUVnQVVFQ2FrSC8vd054SklvQ0RBY0xJNGtDUVFSMlFRRnhRUUZHRFFVTUJBc2ppUUpCQkhaQkFYRkJBVWNOQXlPS0FrRUNhMEgvL3dOeElnRWtpZ0lnQVNPTEFrRUNha0gvL3dOeEVJUUJEQVFMRUhvUWxBRU1CUXNqaWdKQkFtdEIvLzhEY1NJQkpJb0NJQUVqaXdJUWhBRkJHQ1NMQWd3REMwRi9Ed3NqaXdKQkFtcEIvLzhEY1NTTEFrRU1Ed3NRZTBILy93TnhKSXNDQzBFSUR3c2ppd0pCQVdwQi8vOERjU1NMQWtFRUM1MERBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFGSEJFQWdBRUhoQVdzT0R3RUNDd3NEQkFVR0J3Z0xDd3NKQ2dzTEVIcEIvd0Z4UVlEK0Eyb2pnZ0lRZkF3TEN5T0tBaUlBRUowQlFmLy9BM0VoQVNBQVFRSnFRZi8vQTNFa2lnSWdBVUdBL2dOeFFRaDFKSWNDSUFGQi93RnhKSWdDUVFRUEN5T0VBa0dBL2dOcUk0SUNFSHhCQkE4TEk0b0NRUUpyUWYvL0EzRWlBU1NLQWlBQkk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUVJUUJRUWdQQ3hCNkVKWUJEQWNMSTRvQ1FRSnJRZi8vQTNFaUFTU0tBaUFCSTRzQ0VJUUJRU0FraXdKQkNBOExFSHBCR0hSQkdIVWhBU09LQWlBQlFRRVFoUUVqaWdJZ0FXcEIvLzhEY1NTS0FrRUFFSUFCUVFBUWdRRWppd0pCQVdwQi8vOERjU1NMQWtFTUR3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWtpd0pCQkE4TEVIdEIvLzhEY1NPQ0FoQjhJNHNDUVFKcVFmLy9BM0VraXdKQkJBOExFSG9RbHdFTUFnc2ppZ0pCQW10Qi8vOERjU0lCSklvQ0lBRWppd0lRaEFGQktDU0xBa0VJRHd0QmZ3OExJNHNDUVFGcVFmLy9BM0VraXdKQkJBdldBd0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCUndSQUlBQkI4UUZyRGc4QkFnTU5CQVVHQndnSkNnME5Dd3dOQ3hCNlFmOEJjVUdBL2dOcUVJWUJRZjhCY1NTQ0Fnd05DeU9LQWlJQUVKMEJRZi8vQTNFaEFTQUFRUUpxUWYvL0EzRWtpZ0lnQVVHQS9nTnhRUWgxSklJQ0lBRkIvd0Z4SklrQ0RBMExJNFFDUVlEK0Eyb1FoZ0ZCL3dGeEpJSUNEQXdMUVFBa3NBRU1Dd3NqaWdKQkFtdEIvLzhEY1NJQkpJb0NJQUVqaVFKQi93RnhJNElDUWY4QmNVRUlkSElRaEFGQkNBOExFSG9RbVFFTUNBc2ppZ0pCQW10Qi8vOERjU0lCSklvQ0lBRWppd0lRaEFGQk1DU0xBa0VJRHdzUWVrRVlkRUVZZFNFQkk0b0NJUUJCQUJDQUFVRUFFSUVCSUFBZ0FVRUJFSVVCSUFBZ0FXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2h3SWdBRUgvQVhFa2lBSWppd0pCQVdwQi8vOERjU1NMQWtFSUR3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWtpZ0pCQ0E4TEVIdEIvLzhEY1JDR0FVSC9BWEVrZ2dJaml3SkJBbXBCLy84RGNTU0xBZ3dGQzBFQkpMRUJEQVFMRUhvUW1nRU1BZ3NqaWdKQkFtdEIvLzhEY1NJQUpJb0NJQUFqaXdJUWhBRkJPQ1NMQWtFSUR3dEJmdzhMSTRzQ1FRRnFRZi8vQTNFa2l3SUxRUVFMNHdFQkFYOGppd0pCQVdwQi8vOERjU0VCSTQ4Q0JFQWdBVUVCYTBILy93TnhJUUVMSUFFa2l3SUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPRFFNRUJRWUhDQWtLQ3d3TkRnOEFDd3dQQ3lBQUVJY0JEd3NnQUJDSUFROExJQUFRaVFFUEN5QUFFSW9CRHdzZ0FCQ0xBUThMSUFBUWpBRVBDeUFBRUkwQkR3c2dBQkNPQVE4TElBQVFrZ0VQQ3lBQUVKVUJEd3NnQUJDWUFROExJQUFRbXdFUEN5QUFFS2dCRHdzZ0FCQ3BBUThMSUFBUXFnRVBDeUFBRUtzQkM3NEJBUUovUVFBa3NBRkJqLzRERUFKQkFTQUFkRUYvYzNFaUFTUzRBVUdQL2dNZ0FSQUZJNG9DUVFKclFmLy9BM0VraWdJamlnSWlBU09MQWlJQ1FmOEJjUkFGSUFGQkFXb2dBa0dBL2dOeFFRaDFFQVVDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdNREJBVUFDd3dGQzBFQUpMa0JRY0FBSklzQ0RBUUxRUUFrdWdGQnlBQWtpd0lNQXd0QkFDUzdBVUhRQUNTTEFnd0NDMEVBSkx3QlFkZ0FKSXNDREFFTFFRQWt2UUZCNEFBa2l3SUxDL2tCQVFOL0k3RUJCRUJCQVNTd0FVRUFKTEVCQ3lPeUFTTzRBWEZCSDNGQkFFb0VRQ09PQWtVanNBRWlBaUFDR3dSL0k3a0JJN01CSWdBZ0FCc0VmMEVBRUswQlFRRUZJN29CSTdRQklnQWdBQnNFZjBFQkVLMEJRUUVGSTdzQkk3VUJJZ0FnQUJzRWYwRUNFSzBCUVFFRkk3d0JJN1lCSWdBZ0FCc0VmMEVERUswQlFRRUZJNzBCSTdjQklnQWdBQnNFZjBFRUVLMEJRUUVGUVFBTEN3c0xDd1ZCQUFzRVFDT05BaUlBSTQ0Q0lBQWJCSDlCQUNTT0FrRUFKSTBDUVFBa2p3SkJBQ1NRQWtFWUJVRVVDeUVCQ3lPTkFpSUFJNDRDSUFBYkJFQkJBQ1NPQWtFQUpJMENRUUFrandKQkFDU1FBZ3NnQVE4TFFRQUx1d0VCQW45QkFTU2FBaU9QQWdSQUk0c0NFQUpCL3dGeEVLd0JFSGxCQUNTT0FrRUFKSTBDUVFBa2p3SkJBQ1NRQWdzUXJnRWlBRUVBU2dSQUlBQVFlUXRCQkNFQkk0MENJZ0FqamdJZ0FCdEZJZ0FFZnlPUUFrVUZJQUFMQkVBaml3SVFBa0gvQVhFUXJBRWhBUXNqaVFKQjhBRnhKSWtDSUFGQkFFd0VRQ0FCRHdzZ0FSQjVJNVlDUVFGcUlnQWpsQUpPQkg4amxRSkJBV29rbFFJZ0FDT1VBbXNGSUFBTEpKWUNJNHNDSTlZQlJnUkFRUUVrMlFFTElBRUxCUUFqcmdFTHpBRUJCSDhnQUVGL1FZQUlJQUJCQUVnYklBQkJBRW9iSVFOQkFDRUFBMEFDZndKL0lBUkZJZ0VFUUNBQVJTRUJDeUFCQ3dSQUlBSkZJUUVMSUFFTEJFQWoyUUZGSVFFTElBRUVRQkN2QVVFQVNBUkFRUUVoQkFVampBSkIwS1FFSTRFQ2RFNEVRRUVCSVFBRklBTkJmMG9pQVFSQUk2NEJJQU5PSVFFTFFRRWdBaUFCR3lFQ0N3c01BUXNMSUFBRVFDT01Ba0hRcEFRamdRSjBheVNNQWlPWEFnOExJQUlFUUNPWUFnOExJOWtCQkVCQkFDVFpBU09aQWc4TEk0c0NRUUZyUWYvL0EzRWtpd0pCZndzSEFFRi9FTEVCQ3prQkEzOERRQ0FDSUFCSUlnTUVmeUFCUVFCT0JTQURDd1JBUVg4UXNRRWhBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0ZBQ09SQWdzRkFDT1NBZ3NGQUNPVEFndGZBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FDSUJRUUZHRFFFQ1FDQUJRUUpyRGdZREJBVUdCd2dBQ3d3SUN5UExBUThMSTg0QkR3c2p6QUVQQ3lQTkFROExJODhCRHdzajBBRVBDeVBSQVE4TEk5SUJEd3RCQUF1TEFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFBaUFrRUJSZzBCQWtBZ0FrRUNhdzRHQXdRRkJnY0lBQXNNQ0FzZ0FVRUFSeVRMQVF3SEN5QUJRUUJISk00QkRBWUxJQUZCQUVja3pBRU1CUXNnQVVFQVJ5VE5BUXdFQ3lBQlFRQkhKTThCREFNTElBRkJBRWNrMEFFTUFnc2dBVUVBUnlUUkFRd0JDeUFCUVFCSEpOSUJDd3RWQVFGL1FRQWtrQUlnQUJDM0FVVUVRRUVCSVFFTElBQkJBUkM0QVNBQkJFQkJBVUVCUVFCQkFVRUFJQUJCQTB3YklnRWoxQUVpQUNBQUd4c2dBVVVqMVFFaUFDQUFHeHNFUUVFQkpMMEJRUVFRUFFzTEN3a0FJQUJCQUJDNEFRdWFBUUFnQUVFQVNnUkFRUUFRdVFFRlFRQVF1Z0VMSUFGQkFFb0VRRUVCRUxrQkJVRUJFTG9CQ3lBQ1FRQktCRUJCQWhDNUFRVkJBaEM2QVFzZ0EwRUFTZ1JBUVFNUXVRRUZRUU1RdWdFTElBUkJBRW9FUUVFRUVMa0JCVUVFRUxvQkN5QUZRUUJLQkVCQkJSQzVBUVZCQlJDNkFRc2dCa0VBU2dSQVFRWVF1UUVGUVFZUXVnRUxJQWRCQUVvRVFFRUhFTGtCQlVFSEVMb0JDd3NIQUNBQUpOWUJDd2NBUVg4azFnRUxCd0FnQUNUWEFRc0hBRUYvSk5jQkN3Y0FJQUFrMkFFTEJ3QkJmeVRZQVFzRkFDT0NBZ3NGQUNPREFnc0ZBQ09FQWdzRkFDT0ZBZ3NGQUNPR0Fnc0ZBQ09IQWdzRkFDT0lBZ3NGQUNPSkFnc0ZBQ09MQWdzRkFDT0tBZ3NMQUNPTEFoQUNRZjhCY1FzRkFDUG1BUXZCQXdFS2YwR0FnQUpCZ0pBQ0k5OEJHeUVKUVlDNEFrR0FzQUlqNEFFYklRb0RRQ0FHUVlBQ1NBUkFRUUFoQlFOQUlBVkJnQUpJQkVBZ0NTQUdRUU4xUVFWMElBcHFJQVZCQTNWcUlnTkJnSkIrYWkwQUFCQXdJUWdnQmtFSWJ5RUJRUWNnQlVFSWIyc2hCMEVBSVFJQ2Z5QUFRUUJLSTRBQ0lnUWdCQnNFUUNBRFFZRFFmbW90QUFBaEFnc2dBa0hBQUhFTEJFQkJCeUFCYXlFQkMwRUFJUVFnQVVFQmRDQUlhaUlEUVlDUWZtcEJBVUVBSUFKQkNIRWJJZ1JCQVhGQkRYUnFMUUFBSVFoQkFDRUJJQU5CZ1pCK2FpQUVRUUZ4UVExMGFpMEFBRUVCSUFkMGNRUkFRUUloQVFzZ0FVRUJhaUFCUVFFZ0IzUWdDSEViSVFFZ0JrRUlkQ0FGYWtFRGJDRUhJQUJCQUVvamdBSWlBeUFER3dSQUlBSkJCM0VnQVVFQUVERWlBVUVmY1VFRGRDRUVJQUZCNEFkeFFRVjFRUU4wSVFNZ0FVR0ErQUZ4UVFwMVFRTjBJUUlnQjBHQW9RdHFJZ0VnQkRvQUFDQUJRUUZxSUFNNkFBQWdBVUVDYWlBQ09nQUFCU0FIUVlDaEMyb2lBaUFCUWNmK0F4QXlJZ0ZCZ0lEOEIzRkJFSFU2QUFBZ0FrRUJhaUFCUVlEK0EzRkJDSFU2QUFBZ0FrRUNhaUFCT2dBQUN5QUZRUUZxSVFVTUFRc0xJQVpCQVdvaEJnd0JDd3NMM1FNQkRIOERRQ0FEUVJkT1JRUkFRUUFoQWdOQUlBSkJIMGdFUUVFQlFRQWdBa0VQU2hzaENTQURRUTlySUFNZ0EwRVBTaHRCQkhRaUJ5QUNRUTlyYWlBQ0lBZHFJQUpCRDBvYklRZEJnSkFDUVlDQUFpQURRUTlLR3lFTFFjZitBeUVLUVg4aEFVRi9JUWhCQUNFRUEwQWdCRUVJU0FSQVFRQWhBQU5BSUFCQkJVZ0VRQ0FBUVFOMElBUnFRUUowSWdWQmd2d0RhaEFDSUFkR0JFQWdCVUdEL0FOcUVBSWhCa0VCUVFBZ0JrRUljVUVBUnlPQUFpT0FBaHNiSUFsR0JFQkJDQ0VFUVFVaEFDQUdJZ2hCRUhFRWYwSEovZ01GUWNqK0F3c2hDZ3NMSUFCQkFXb2hBQXdCQ3dzZ0JFRUJhaUVFREFFTEN5QUlRUUJJSTRBQ0lnWWdCaHNFUUVHQXVBSkJnTEFDSStBQkd5RUVRWDhoQUVFQUlRRURRQ0FCUVNCSUJFQkJBQ0VGQTBBZ0JVRWdTQVJBSUFWQkJYUWdCR29nQVdvaUJrR0FrSDVxTFFBQUlBZEdCRUJCSUNFRklBWWhBRUVnSVFFTElBVkJBV29oQlF3QkN3c2dBVUVCYWlFQkRBRUxDeUFBUVFCT0JIOGdBRUdBMEg1cUxRQUFCVUYvQ3lFQkMwRUFJUUFEUUNBQVFRaElCRUFnQnlBTElBbEJBRUVISUFBZ0FrRURkQ0FEUVFOMElBQnFRZmdCUVlDaEZ5QUtJQUVnQ0JBekdpQUFRUUZxSVFBTUFRc0xJQUpCQVdvaEFnd0JDd3NnQTBFQmFpRUREQUVMQ3d1YUFnRUpmd05BSUFSQkNFNUZCRUJCQUNFQkEwQWdBVUVGU0FSQUlBRkJBM1FnQkdwQkFuUWlBRUdBL0FOcUVBSWFJQUJCZ2Z3RGFoQUNHaUFBUVlMOEEyb1FBaUVDUVFFaEJTUGhBUVJBSUFKQkFtOUJBVVlFUUNBQ1FRRnJJUUlMUVFJaEJRc2dBRUdEL0FOcUVBSWhCa0VBSVFkQkFVRUFJQVpCQ0hGQkFFY2pnQUlqZ0FJYkd5RUhRY2orQXlFSVFjbitBMEhJL2dNZ0JrRVFjUnNoQ0VFQUlRQURRQ0FBSUFWSUJFQkJBQ0VEQTBBZ0EwRUlTQVJBSUFBZ0FtcEJnSUFDSUFkQkFFRUhJQU1nQkVFRGRDQUJRUVIwSUFOcUlBQkJBM1JxUWNBQVFZQ2hJQ0FJUVg4Z0JoQXpHaUFEUVFGcUlRTU1BUXNMSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN5QUVRUUZxSVFRTUFRc0xDd1VBSTc4QkN3VUFJOEFCQ3dVQUk4TUJDeGdCQVg4anhRRWhBQ1BFQVFSQUlBQkJCSEloQUFzZ0FBc3dBUUYvQTBBQ1FDQUFRZi8vQTA0TkFDQUFRWUNoeVFScUlBQVFXVG9BQUNBQVFRRnFJUUFNQVFzTFFRQWsyUUVMRmdBUUFEOEFRWlFCU0FSQVFaUUJQd0JyUUFBYUN3c0RBQUVMSFFBQ1FBSkFBa0FqbXdJT0FnRUNBQXNBQzBFQUlRQUxJQUFRc1FFTEJ3QWdBQ1NiQWdzbEFBSkFBa0FDUUFKQUk1c0NEZ01CQWdNQUN3QUxRUUVoQUF0QmZ5RUJDeUFCRUxFQkN3QXpFSE52ZFhKalpVMWhjSEJwYm1kVlVrd2hZMjl5WlM5a2FYTjBMMk52Y21VdWRXNTBiM1ZqYUdWa0xuZGhjMjB1YldGdyIpOgoidW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3d8fCJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY/YXdhaXQgRygiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJoZ0VSWUFBQVlBcC9mMzkvZjM5L2YzOS9BR0FCZndGL1lBSi9md0JnQVg4QVlBSi9md0YvWUFBQmYyQURmMzkvQUdBR2YzOS9mMzkvQUdBSGYzOS9mMzkvZndGL1lBTi9mMzhCZjJBSGYzOS9mMzkvZndCZ0JIOS9mMzhCZjJBSWYzOS9mMzkvZjM4QVlBVi9mMzkvZndGL1lBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0FYOEJmd1BkQWRzQkFBSUNBQUFEQUFRRUFBQUFBQUFBQUFBQUJBUUFBQUFCQmdBQUFBQUFBQUFBQkFRQUFBQUFBQUFBQUFZR0JnWU9CUW9GRHdrTENBZ0hBd1FBQUFRQUFBQUFBQVFBQUFBQUFBSUNCUUlDQWdJRkRBUUVCQUFDQmdJQ0F3UUVCQVFBQUFBQUJBVUVCZ1lFQXdJRkJBQUFCQVVEQndBRkFBUUFCQVFHQmdNRkJBTUVCQVFEQXdjQ0FnSUNBZ0lDQWdJREJBUUNCQVFDQkFRQ0JBUUNBZ0lDQWdJQ0FnSUNBZ1VDQWdJQ0FnSUVCZ1lHRUFZQ0JnWUdBZ01FQkEwRUFBUUFCQUFHQmdZR0JnWUdCZ1lHQmdZRUFBQUdCZ1lHQUFBQUFnUUZCQVFCY0FBQkJRTUJBQUFHaFF5Y0FuOEFRUUFMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQWdMZndCQmdCQUxmd0JCZ0lBQkMzOEFRWUNRQVF0L0FFR0FnQUlMZndCQmdKQURDMzhBUVlDQUFRdC9BRUdBRUF0L0FFR0FnQVFMZndCQmdKQUVDMzhBUVlBQkMzOEFRWUNSQkF0L0FFR0F1QUVMZndCQmdNa0ZDMzhBUVlEWUJRdC9BRUdBb1FzTGZ3QkJnSUFNQzM4QVFZQ2hGd3QvQUVHQWdBa0xmd0JCZ0tFZ0MzOEFRWUQ0QUF0L0FFR0FrQVFMZndCQmdJa2RDMzhBUVlDWklRdC9BRUdBZ0FnTGZ3QkJnSmtwQzM4QVFZQ0FDQXQvQUVHQW1URUxmd0JCZ0lBSUMzOEFRWUNaT1F0L0FFR0FnQWdMZndCQmdKbkJBQXQvQUVHQWdBZ0xmd0JCZ0puSkFBdC9BRUdBZ0FnTGZ3QkJnSm5SQUF0L0FFR0FpUGdEQzM4QVFZQ2h5UVFMZndCQi8vOERDMzhBUVFBTGZ3QkJnS0hOQkF0L0FFR1VBUXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFlaitBd3QvQVVIcC9nTUxmd0ZCNi80REMzOEJRWDhMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJnUGNDQzM4QlFRQUxmd0ZCQUF0L0FVR0FnQWdMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWRIK0F3dC9BVUhTL2dNTGZ3RkIwLzREQzM4QlFkVCtBd3QvQVVIVi9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRYy8rQXd0L0FVSHcvZ01MZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFJTGZ3RkJBQXQvQVVFQUN3ZVhFRjhHYldWdGIzSjVBZ0FGZEdGaWJHVUJBQVpqYjI1bWFXY0FGdzVvWVhORGIzSmxVM1JoY25SbFpBQVlDWE5oZG1WVGRHRjBaUUFmQ1d4dllXUlRkR0YwWlFBcUJXbHpSMEpEQUNzU1oyVjBVM1JsY0hOUVpYSlRkR1Z3VTJWMEFDd0xaMlYwVTNSbGNGTmxkSE1BTFFoblpYUlRkR1Z3Y3dBdUZXVjRaV04xZEdWTmRXeDBhWEJzWlVaeVlXMWxjd0N6QVF4bGVHVmpkWFJsUm5KaGJXVUFzZ0VJWDNObGRHRnlaMk1BMlFFWlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYndEWUFSVmxlR1ZqZFhSbFZXNTBhV3hEYjI1a2FYUnBiMjRBMmdFTFpYaGxZM1YwWlZOMFpYQUFyd0VVWjJWMFEzbGpiR1Z6VUdWeVEzbGpiR1ZUWlhRQXRBRU1aMlYwUTNsamJHVlRaWFJ6QUxVQkNXZGxkRU41WTJ4bGN3QzJBUTV6WlhSS2IzbHdZV1JUZEdGMFpRQzdBUjluWlhST2RXMWlaWEpQWmxOaGJYQnNaWE5KYmtGMVpHbHZRblZtWm1WeUFMQUJFR05zWldGeVFYVmthVzlDZFdabVpYSUFKaHh6WlhSTllXNTFZV3hEYjJ4dmNtbDZZWFJwYjI1UVlXeGxkSFJsQUFjWFYwRlRUVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRES2hOWFFWTk5RazlaWDAxRlRVOVNXVjlUU1ZwRkF5c1NWMEZUVFVKUFdWOVhRVk5OWDFCQlIwVlRBeXdlUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgweFBRMEZVU1U5T0F3QWFRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDFOSldrVURBUlpYUVZOTlFrOVpYMU5VUVZSRlgweFBRMEZVU1U5T0F3SVNWMEZUVFVKUFdWOVRWRUZVUlY5VFNWcEZBd01nUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNERDaHhIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXdzU1ZrbEVSVTlmVWtGTlgweFBRMEZVU1U5T0F3UU9Wa2xFUlU5ZlVrRk5YMU5KV2tVREJSRlhUMUpMWDFKQlRWOU1UME5CVkVsUFRnTUdEVmRQVWt0ZlVrRk5YMU5KV2tVREJ5WlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01JSWs5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VEQ1JoSFVrRlFTRWxEVTE5UFZWUlFWVlJmVEU5RFFWUkpUMDRER0JSSFVrRlFTRWxEVTE5UFZWUlFWVlJmVTBsYVJRTVpGRWRDUTE5UVFVeEZWRlJGWDB4UFEwRlVTVTlPQXd3UVIwSkRYMUJCVEVWVVZFVmZVMGxhUlFNTkdFSkhYMUJTU1U5U1NWUlpYMDFCVUY5TVQwTkJWRWxQVGdNT0ZFSkhYMUJTU1U5U1NWUlpYMDFCVUY5VFNWcEZBdzhPUmxKQlRVVmZURTlEUVZSSlQwNERFQXBHVWtGTlJWOVRTVnBGQXhFWFFrRkRTMGRTVDFWT1JGOU5RVkJmVEU5RFFWUkpUMDRERWhOQ1FVTkxSMUpQVlU1RVgwMUJVRjlUU1ZwRkF4TVNWRWxNUlY5RVFWUkJYMHhQUTBGVVNVOU9BeFFPVkVsTVJWOUVRVlJCWDFOSldrVURGUkpQUVUxZlZFbE1SVk5mVEU5RFFWUkpUMDRERmc1UFFVMWZWRWxNUlZOZlUwbGFSUU1YRlVGVlJFbFBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWlFVUZWUkVsUFgwSlZSa1pGVWw5VFNWcEZBeU1aUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01hRlVOSVFVNU9SVXhmTVY5Q1ZVWkdSVkpmVTBsYVJRTWJHVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZURTlEUVZSSlQwNERIQlZEU0VGT1RrVk1YekpmUWxWR1JrVlNYMU5KV2tVREhSbERTRUZPVGtWTVh6TmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4NFZRMGhCVGs1RlRGOHpYMEpWUmtaRlVsOVRTVnBGQXg4WlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZ0ZVTklRVTVPUlV4Zk5GOUNWVVpHUlZKZlUwbGFSUU1oRmtOQlVsUlNTVVJIUlY5U1FVMWZURTlEUVZSSlQwNERKQkpEUVZKVVVrbEVSMFZmVWtGTlgxTkpXa1VESlJaRFFWSlVVa2xFUjBWZlVrOU5YMHhQUTBGVVNVOU9BeVlTUTBGU1ZGSkpSRWRGWDFKUFRWOVRTVnBGQXljZFJFVkNWVWRmUjBGTlJVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERLQmxFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeWtoWjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBQUViYzJWMFVISnZaM0poYlVOdmRXNTBaWEpDY21WaGEzQnZhVzUwQUx3QkhYSmxjMlYwVUhKdlozSmhiVU52ZFc1MFpYSkNjbVZoYTNCdmFXNTBBTDBCR1hObGRGSmxZV1JIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBdmdFYmNtVnpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFMOEJHbk5sZEZkeWFYUmxSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBTUFCSEhKbGMyVjBWM0pwZEdWSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQXdRRU1aMlYwVW1WbmFYTjBaWEpCQU1JQkRHZGxkRkpsWjJsemRHVnlRZ0REQVF4blpYUlNaV2RwYzNSbGNrTUF4QUVNWjJWMFVtVm5hWE4wWlhKRUFNVUJER2RsZEZKbFoybHpkR1Z5UlFER0FReG5aWFJTWldkcGMzUmxja2dBeHdFTVoyVjBVbVZuYVhOMFpYSk1BTWdCREdkbGRGSmxaMmx6ZEdWeVJnREpBUkZuWlhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0RLQVE5blpYUlRkR0ZqYTFCdmFXNTBaWElBeXdFWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dETUFRVm5aWFJNV1FETkFSMWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllUURPQVJoa2NtRjNWR2xzWlVSaGRHRlViMWRoYzIxTlpXMXZjbmtBendFVFpISmhkMDloYlZSdlYyRnpiVTFsYlc5eWVRRFFBUVpuWlhSRVNWWUEwUUVIWjJWMFZFbE5RUURTQVFablpYUlVUVUVBMHdFR1oyVjBWRUZEQU5RQkUzVndaR0YwWlVSbFluVm5SMEpOWlcxdmNua0ExUUVJQXRZQkNRZ0JBRUVBQ3dIWEFRci80d0hiQVZNQVFmTGx5d2NrTjBHZ3dZSUZKRGhCMkxEaEFpUTVRWWlRSUNRNlFmTGx5d2NrTzBHZ3dZSUZKRHhCMkxEaEFpUTlRWWlRSUNRK1FmTGx5d2NrUDBHZ3dZSUZKRUJCMkxEaEFpUkJRWWlRSUNSQ0M5VUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVNZFNJQlJRMEFBa0FnQVVFQmF3NE5BUUVCQWdJQ0FnTURCQVFGQmdBTERBWUxJQUJCZ0puUkFHb1BDeUFBUVFFajZ3RWlBU1B6QVVVaUFBUi9JQUZGQlNBQUN4dEJEblJxUVlDWjBBQnFEd3NnQUVHQWtINXFJNEFDQkg4ai9nRVFBa0VCY1FWQkFBdEJEWFJxRHdzZ0FDUHNBVUVOZEdwQmdObkdBR29QQ3lBQVFZQ1FmbW9QQzBFQUlRRUNmeU9BQWdSQUkvOEJFQUpCQjNFaEFRc2dBVUVCU0FzRWYwRUJCU0FCQzBFTWRDQUFha0dBOEgxcUR3c2dBRUdBVUdvTENRQWdBQkFCTFFBQUM3d0JBRUVBSklFQ1FRQWtnZ0pCQUNTREFrRUFKSVFDUVFBa2hRSkJBQ1NHQWtFQUpJY0NRUUFraUFKQkFDU0pBa0VBSklvQ1FRQWtpd0pCQUNTTUFrRUFKSTBDUVFBa2pnSkJBQ1NQQWtFQUpKQUNJNEFDQkVCQkVTU0NBa0dBQVNTSkFrRUFKSU1DUVFBa2hBSkIvd0VraFFKQjFnQWtoZ0pCQUNTSEFrRU5KSWdDQlVFQkpJSUNRYkFCSklrQ1FRQWtnd0pCRXlTRUFrRUFKSVVDUWRnQkpJWUNRUUVraHdKQnpRQWtpQUlMUVlBQ0pJc0NRZjcvQXlTS0FndDdBUUovUVFBazdRRkJBU1R1QVVISEFoQUNJZ0ZGSk84QklBRkJBVTRpQUFSQUlBRkJBMHdoQUFzZ0FDVHdBU0FCUVFWT0lnQUVRQ0FCUVFaTUlRQUxJQUFrOFFFZ0FVRVBUaUlBQkVBZ0FVRVRUQ0VBQ3lBQUpQSUJJQUZCR1U0aUFBUkFJQUZCSGt3aEFBc2dBQ1R6QVVFQkpPc0JRUUFrN0FFTEN3QWdBQkFCSUFFNkFBQUxMd0JCMGY0RFFmOEJFQVZCMHY0RFFmOEJFQVZCMC80RFFmOEJFQVZCMVA0RFFmOEJFQVZCMWY0RFFmOEJFQVVMdEFnQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ3NEQkFVR0J3Z0pDZ3NNRFFBTERBMExRZkxseXdja04wR2d3WUlGSkRoQjJMRGhBaVE1UVlpUUlDUTZRZkxseXdja08wR2d3WUlGSkR4QjJMRGhBaVE5UVlpUUlDUStRZkxseXdja1AwR2d3WUlGSkVCQjJMRGhBaVJCUVlpUUlDUkNEQXdMUWYvLy93Y2tOMEhqMnY0SEpEaEJnT0tRQkNRNVFRQWtPa0gvLy84SEpEdEI0OXIrQnlROFFZRGlrQVFrUFVFQUpENUIvLy8vQnlRL1FlUGEvZ2NrUUVHQTRwQUVKRUZCQUNSQ0RBc0xRZi8vL3dja04wR0VpZjRISkRoQnV2VFFCQ1E1UVFBa09rSC8vLzhISkR0QnNmN3ZBeVE4UVlDSUFpUTlRUUFrUGtILy8vOEhKRDlCLzh1T0F5UkFRZjhCSkVGQkFDUkNEQW9MUWNYTi93Y2tOMEdFdWJvR0pEaEJxZGFSQkNRNVFZamk2QUlrT2tILy8vOEhKRHRCNDlyK0J5UThRWURpa0FRa1BVRUFKRDVCLy8vL0J5US9RZVBhL2dja1FFR0E0cEFFSkVGQkFDUkNEQWtMUWYvLy93Y2tOMEdBL3NzQ0pEaEJnSVQ5QnlRNVFRQWtPa0gvLy84SEpEdEJnUDdMQWlROFFZQ0UvUWNrUFVFQUpENUIvLy8vQnlRL1FZRCt5d0lrUUVHQWhQMEhKRUZCQUNSQ0RBZ0xRZi8vL3dja04wR3gvdThESkRoQnhjY0JKRGxCQUNRNlFmLy8vd2NrTzBHRWlmNEhKRHhCdXZUUUJDUTlRUUFrUGtILy8vOEhKRDlCaEluK0J5UkFRYnIwMEFRa1FVRUFKRUlNQnd0QkFDUTNRWVNKQWlRNFFZQzgvd2NrT1VILy8vOEhKRHBCQUNRN1FZU0pBaVE4UVlDOC93Y2tQVUgvLy84SEpENUJBQ1EvUVlTSkFpUkFRWUM4L3dja1FVSC8vLzhISkVJTUJndEJwZi8vQnlRM1FaU3AvZ2NrT0VIL3FkSUVKRGxCQUNRNlFhWC8vd2NrTzBHVXFmNEhKRHhCLzZuU0JDUTlRUUFrUGtHbC8vOEhKRDlCbEtuK0J5UkFRZitwMGdRa1FVRUFKRUlNQlF0Qi8vLy9CeVEzUVlEKy93Y2tPRUdBZ1B3SEpEbEJBQ1E2UWYvLy93Y2tPMEdBL3Y4SEpEeEJnSUQ4QnlROVFRQWtQa0gvLy84SEpEOUJnUDcvQnlSQVFZQ0EvQWNrUVVFQUpFSU1CQXRCLy8vL0J5UTNRWUQrL3dja09FR0FsTzBESkRsQkFDUTZRZi8vL3dja08wSC95NDRESkR4Qi93RWtQVUVBSkQ1Qi8vLy9CeVEvUWJIKzd3TWtRRUdBaUFJa1FVRUFKRUlNQXd0Qi8vLy9CeVEzUWYvTGpnTWtPRUgvQVNRNVFRQWtPa0gvLy84SEpEdEJoSW4rQnlROFFicjAwQVFrUFVFQUpENUIvLy8vQnlRL1FiSCs3d01rUUVHQWlBSWtRVUVBSkVJTUFndEIvLy8vQnlRM1FkNlpzZ1FrT0VHTXBja0NKRGxCQUNRNlFmLy8vd2NrTzBHRWlmNEhKRHhCdXZUUUJDUTlRUUFrUGtILy8vOEhKRDlCNDlyK0J5UkFRWURpa0FRa1FVRUFKRUlNQVF0Qi8vLy9CeVEzUWFYTGxnVWtPRUhTcE1rQ0pEbEJBQ1E2UWYvLy93Y2tPMEdseTVZRkpEeEIwcVRKQWlROVFRQWtQa0gvLy84SEpEOUJwY3VXQlNSQVFkS2t5UUlrUVVFQUpFSUxDOTRJQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmlBRkhCRUFnQUNJQlFlRUFSZzBCSUFGQkZFWU5BaUFCUWNZQVJnMERJQUZCMlFCR0RRUWdBVUhHQVVZTkJDQUJRWVlCUmcwRklBRkJxQUZHRFFVZ0FVRy9BVVlOQmlBQlFjNEJSZzBHSUFGQjBRRkdEUVlnQVVId0FVWU5CaUFCUVNkR0RRY2dBVUhKQUVZTkJ5QUJRZHdBUmcwSElBRkJzd0ZHRFFjZ0FVSEpBVVlOQ0NBQlFmQUFSZzBKSUFGQnhnQkdEUW9nQVVIVEFVWU5Dd3dNQzBIL3VaWUZKRGRCZ1A3L0J5UTRRWURHQVNRNVFRQWtPa0gvdVpZRkpEdEJnUDcvQnlROFFZREdBU1E5UVFBa1BrSC91WllGSkQ5QmdQNy9CeVJBUVlER0FTUkJRUUFrUWd3TEMwSC8vLzhISkRkQi84dU9BeVE0UWY4QkpEbEJBQ1E2UWYvLy93Y2tPMEdFaWY0SEpEeEJ1dlRRQkNROVFRQWtQa0gvLy84SEpEOUIvOHVPQXlSQVFmOEJKRUZCQUNSQ0RBb0xRZi8vL3dja04wR0VpZjRISkRoQnV2VFFCQ1E1UVFBa09rSC8vLzhISkR0QnNmN3ZBeVE4UVlDSUFpUTlRUUFrUGtILy8vOEhKRDlCaEluK0J5UkFRYnIwMEFRa1FVRUFKRUlNQ1F0Qi8rdldCU1EzUVpULy93Y2tPRUhDdExVRkpEbEJBQ1E2UVFBa08wSC8vLzhISkR4QmhJbitCeVE5UWJyMDBBUWtQa0VBSkQ5Qi8vLy9CeVJBUVlTSi9nY2tRVUc2OU5BRUpFSU1DQXRCLy8vL0J5UTNRWVRidGdVa09FSDc1b2tDSkRsQkFDUTZRZi8vL3dja08wR0E1djBISkR4QmdJVFJCQ1E5UVFBa1BrSC8vLzhISkQ5Qi8vdnFBaVJBUVlDQS9BY2tRVUgvQVNSQ0RBY0xRWnovL3dja04wSC82OUlFSkRoQjg2aU9BeVE1UWJyMEFDUTZRY0tLL3dja08wR0FyUDhISkR4QmdQVFFCQ1E5UVlDQXFBSWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSU1CZ3RCZ1A2dkF5UTNRZi8vL3dja09FSEtwUDBISkRsQkFDUTZRZi8vL3dja08wSC8vLzhISkR4Qi84dU9BeVE5UWY4QkpENUIvLy8vQnlRL1FlUGEvZ2NrUUVHQTRwQUVKRUZCQUNSQ0RBVUxRZis1bGdVa04wR0EvdjhISkRoQmdNWUJKRGxCQUNRNlFkTEcvUWNrTzBHQWdOZ0dKRHhCZ0lDTUF5UTlRUUFrUGtIL0FTUS9RZi8vL3dja1FFSDcvdjhISkVGQi80a0NKRUlNQkF0Qnp2Ly9CeVEzUWUvZmp3TWtPRUd4aVBJRUpEbEIyclRwQWlRNlFmLy8vd2NrTzBHQTV2MEhKRHhCZ0lUUkJDUTlRUUFrUGtILy8vOEhKRDlCLzh1T0F5UkFRZjhCSkVGQkFDUkNEQU1MUWYvLy93Y2tOMEdFaWY0SEpEaEJ1dlRRQkNRNVFRQWtPa0gvLy84SEpEdEJnUDRESkR4QmdJakdBU1E5UVlDVUFTUStRZi8vL3dja1AwSC95NDRESkVCQi93RWtRVUVBSkVJTUFndEIvLy8vQnlRM1FmL0xqZ01rT0VIL0FTUTVRUUFrT2tHQS92OEhKRHRCZ0lEOEJ5UThRWUNBakFNa1BVRUFKRDVCLy8vL0J5US9RYkgrN3dNa1FFR0FpQUlrUVVFQUpFSU1BUXRCLy8vL0J5UTNRWVRidGdVa09FSDc1b2tDSkRsQkFDUTZRZi8vL3dja08wSGoydjRISkR4QjQ5citCeVE5UVFBa1BrSC8vLzhISkQ5Qi84dU9BeVJBUWY4QkpFRkJBQ1JDQ3dzMUFRSi9RUUFRQjBHMEFpRUFBMEFDUUNBQVFjTUNTZzBBSUFBUUFpQUJhaUVCSUFCQkFXb2hBQXdCQ3dzZ0FVSC9BWEVRQ0F1ZUFRQkJBQ1RrQVVFQUpPVUJRUUFrNWdGQkFDVG5BVUVBSk9nQlFRQWs2UUZCQUNUcUFVR1FBU1RtQVNPQUFnUkFRY0QrQTBHUkFSQUZRY0grQTBHQkFSQUZRY1QrQTBHUUFSQUZRY2YrQTBIOEFSQUZCVUhBL2dOQmtRRVFCVUhCL2dOQmhRRVFCVUhHL2dOQi93RVFCVUhIL2dOQi9BRVFCVUhJL2dOQi93RVFCVUhKL2dOQi93RVFCUXRCei80RFFRQVFCVUh3L2dOQkFSQUZFQWtMVUFBamdBSUVRRUhvL2dOQndBRVFCVUhwL2dOQi93RVFCVUhxL2dOQndRRVFCVUhyL2dOQkRSQUZCVUhvL2dOQi93RVFCVUhwL2dOQi93RVFCVUhxL2dOQi93RVFCVUhyL2dOQi93RVFCUXNMTHdCQmtQNERRWUFCRUFWQmtmNERRYjhCRUFWQmt2NERRZk1CRUFWQmsvNERRY0VCRUFWQmxQNERRYjhCRUFVTExBQkJsZjREUWY4QkVBVkJsdjREUVQ4UUJVR1gvZ05CQUJBRlFaaitBMEVBRUFWQm1mNERRYmdCRUFVTE1nQkJtdjREUWY4QUVBVkJtLzREUWY4QkVBVkJuUDREUVo4QkVBVkJuZjREUVFBUUJVR2UvZ05CdUFFUUJVRUJKSDhMTFFCQm4vNERRZjhCRUFWQm9QNERRZjhCRUFWQm9mNERRUUFRQlVHaS9nTkJBQkFGUWFQK0EwRy9BUkFGQzBVQVFROGtrUUZCRHlTU0FVRVBKSk1CUVE4a2xBRkJBQ1NWQVVFQUpKWUJRUUFrbHdGQkFDU1lBVUgvQUNTWkFVSC9BQ1NhQVVFQkpKc0JRUUVrbkFGQkFDU2RBUXQzQUVFQUpKNEJRUUFrbndGQkFDU2dBVUVCSktFQlFRRWtvZ0ZCQVNTakFVRUJKS1FCUVFFa3BRRkJBU1NtQVVFQkpLY0JRUUVrcUFGQkFTU3BBVUVBSktvQlFRQWtxd0ZCQUNTdEFVRUFKSzRCRUF3UURSQU9FQTlCcFA0RFFmY0FFQVZCcGY0RFFmTUJFQVZCcHY0RFFmRUJFQVVRRUFzK0FDQUFRUUZ4UVFCSEpMTUJJQUJCQW5GQkFFY2t0QUVnQUVFRWNVRUFSeVMxQVNBQVFRaHhRUUJISkxZQklBQkJFSEZCQUVja3R3RWdBQ1N5QVFzK0FDQUFRUUZ4UVFCSEpMa0JJQUJCQW5GQkFFY2t1Z0VnQUVFRWNVRUFSeVM3QVNBQVFRaHhRUUJISkx3QklBQkJFSEZCQUVja3ZRRWdBQ1M0QVF0ZUFFRUFKTDRCUVFBa3Z3RkJBQ1RBQVVFQUpNTUJRUUFreEFGQkFDVEZBVUVBSk1FQlFRQWt3Z0VqZ0FJRVFFR0UvZ05CSGhBRlFhQTlKTDhCQlVHRS9nTkJxd0VRQlVITTF3SWt2d0VMUVlmK0EwSDRBUkFGUWZnQkpNVUJDME1BUVFBa3hnRkJBQ1RIQVNPQUFnUkFRWUwrQTBIOEFCQUZRUUFreUFGQkFDVEpBVUVBSk1vQkJVR0MvZ05CL2dBUUJVRUFKTWdCUVFFa3lRRkJBQ1RLQVFzTCt3RUJBbjlCd3dJUUFpSUJRY0FCUmlJQUJIOGdBQVVnQVVHQUFVWWpMaUlBSUFBYkN3UkFRUUVrZ0FJRlFRQWtnQUlMRUFNUUJCQUdFQW9RQ3hBUlFRQVFFa0gvL3dNanNnRVFCVUhoQVJBVFFZLytBeU80QVJBRkVCUVFGU09BQWdSQVFmRCtBMEg0QVJBRlFjLytBMEgrQVJBRlFjMytBMEgrQUJBRlFZRCtBMEhQQVJBRlFZLytBMEhoQVJBRlFleitBMEgrQVJBRlFmWCtBMEdQQVJBRkJVSHcvZ05CL3dFUUJVSFAvZ05CL3dFUUJVSE4vZ05CL3dFUUJVR0EvZ05CendFUUJVR1AvZ05CNFFFUUJRdEJBQ1NhQWtHQXFOYTVCeVNSQWtFQUpKSUNRUUFra3dKQmdLald1UWNrbEFKQkFDU1ZBa0VBSkpZQ0Mwb0FJQUJCQUVva0xTQUJRUUJLSkM0Z0FrRUFTaVF2SUFOQkFFb2tNQ0FFUVFCS0pERWdCVUVBU2lReUlBWkJBRW9rTXlBSFFRQktKRFFnQ0VFQVNpUTFJQWxCQUVva05oQVdDd1VBSTVvQ0M1VUJBRUdBQ0NPQ0Fqb0FBRUdCQ0NPREFqb0FBRUdDQ0NPRUFqb0FBRUdEQ0NPRkFqb0FBRUdFQ0NPR0Fqb0FBRUdGQ0NPSEFqb0FBRUdHQ0NPSUFqb0FBRUdIQ0NPSkFqb0FBRUdJQ0NPS0Fqc0JBRUdLQ0NPTEFqc0JBRUdNQ0NPTUFqWUNBRUdSQ0NPTkFrRUFSem9BQUVHU0NDT09Ba0VBUnpvQUFFR1RDQ09QQWtFQVJ6b0FBRUdVQ0NPUUFrRUFSem9BQUF0b0FFSElDU1ByQVRzQkFFSEtDU1BzQVRzQkFFSE1DU1B0QVVFQVJ6b0FBRUhOQ1NQdUFVRUFSem9BQUVIT0NTUHZBVUVBUnpvQUFFSFBDU1B3QVVFQVJ6b0FBRUhRQ1NQeEFVRUFSem9BQUVIUkNTUHlBVUVBUnpvQUFFSFNDU1B6QVVFQVJ6b0FBQXMxQUVINkNTTytBVFlDQUVIK0NTTy9BVFlDQUVHQ0NpUEJBVUVBUnpvQUFFR0ZDaVBDQVVFQVJ6b0FBRUdGL2dNandBRVFCUXRZQUVIZUNpTlVRUUJIT2dBQVFkOEtJMWMyQWdCQjR3b2pXRFlDQUVIbkNpTlpOZ0lBUWV3S0kxbzJBZ0JCOFFvald6b0FBRUh5Q2lOY09nQUFRZmNLSTExQkFFYzZBQUJCK0FvalhqWUNBRUg5Q2lOZk93RUFDejBBUVpBTEkybEJBRWM2QUFCQmtRc2piRFlDQUVHVkN5TnROZ0lBUVprTEkyNDJBZ0JCbmdzamJ6WUNBRUdqQ3lOd09nQUFRYVFMSTNFNkFBQUxPd0JCOUFzamlRRkJBRWM2QUFCQjlRc2ppd0UyQWdCQitRc2pqQUUyQWdCQi9Rc2pqUUUyQWdCQmdnd2pqZ0UyQWdCQmh3d2prQUU3QVFBTGhBRUFFQmxCc2dnajVRRTJBZ0JCdGdnajJnRTZBQUJCeFA0REkrWUJFQVZCNUFnanNBRkJBRWM2QUFCQjVRZ2pzUUZCQUVjNkFBQVFHaEFiUWF3S0k2b0JOZ0lBUWJBS0k2c0JPZ0FBUWJFS0k2MEJPZ0FBRUJ3UUhVSENDeU40UVFCSE9nQUFRY01MSTNzMkFnQkJ4d3NqZkRZQ0FFSExDeU45T3dFQUVCNUJBQ1NhQWd1VkFRQkJnQWd0QUFBa2dnSkJnUWd0QUFBa2d3SkJnZ2d0QUFBa2hBSkJnd2d0QUFBa2hRSkJoQWd0QUFBa2hnSkJoUWd0QUFBa2h3SkJoZ2d0QUFBa2lBSkJod2d0QUFBa2lRSkJpQWd2QVFBa2lnSkJpZ2d2QVFBa2l3SkJqQWdvQWdBa2pBSkJrUWd0QUFCQkFFb2tqUUpCa2dndEFBQkJBRW9ramdKQmt3Z3RBQUJCQUVva2p3SkJsQWd0QUFCQkFFb2trQUlMWGdFQmYwRUFKT1VCUVFBazVnRkJ4UDREUVFBUUJVSEIvZ01RQWtGOGNTRUJRUUFrMmdGQndmNERJQUVRQlNBQUJFQUNRRUVBSVFBRFFDQUFRWURZQlU0TkFTQUFRWURKQldwQi93RTZBQUFnQUVFQmFpRUFEQUFBQ3dBTEN3dUlBUUVCZnlQY0FTRUJJQUJCZ0FGeFFRQkhKTndCSUFCQndBQnhRUUJISk4wQklBQkJJSEZCQUVjazNnRWdBRUVRY1VFQVJ5VGZBU0FBUVFoeFFRQkhKT0FCSUFCQkJIRkJBRWNrNFFFZ0FFRUNjVUVBUnlUaUFTQUFRUUZ4UVFCSEpPTUJJOXdCUlNBQklBRWJCRUJCQVJBaEN5QUJSU0lBQkg4ajNBRUZJQUFMQkVCQkFCQWhDd3NxQUVIa0NDMEFBRUVBU2lTd0FVSGxDQzBBQUVFQVNpU3hBVUgvL3dNUUFoQVNRWS8rQXhBQ0VCTUxhQUJCeUFrdkFRQWs2d0ZCeWdrdkFRQWs3QUZCekFrdEFBQkJBRW9rN1FGQnpRa3RBQUJCQUVvazdnRkJ6Z2t0QUFCQkFFb2s3d0ZCendrdEFBQkJBRW9rOEFGQjBBa3RBQUJCQUVvazhRRkIwUWt0QUFCQkFFb2s4Z0ZCMGdrdEFBQkJBRW9rOHdFTFJ3QkIrZ2tvQWdBa3ZnRkIvZ2tvQWdBa3Z3RkJnZ290QUFCQkFFb2t3UUZCaFFvdEFBQkJBRW9rd2dGQmhmNERFQUlrd0FGQmh2NERFQUlrd3dGQmgvNERFQUlreFFFTEJ3QkJBQ1N1QVF0WUFFSGVDaTBBQUVFQVNpUlVRZDhLS0FJQUpGZEI0d29vQWdBa1dFSG5DaWdDQUNSWlFld0tLQUlBSkZwQjhRb3RBQUFrVzBIeUNpMEFBQ1JjUWZjS0xRQUFRUUJLSkYxQitBb29BZ0FrWGtIOUNpOEJBQ1JmQ3owQVFaQUxMUUFBUVFCS0pHbEJrUXNvQWdBa2JFR1ZDeWdDQUNSdFFaa0xLQUlBSkc1Qm5nc29BZ0FrYjBHakN5MEFBQ1J3UWFRTExRQUFKSEVMT3dCQjlBc3RBQUJCQUVva2lRRkI5UXNvQWdBa2l3RkIrUXNvQWdBa2pBRkIvUXNvQWdBa2pRRkJnZ3dvQWdBa2pnRkJod3d2QVFBa2tBRUx5UUVCQVg4UUlFR3lDQ2dDQUNUbEFVRzJDQzBBQUNUYUFVSEUvZ01RQWlUbUFVSEEvZ01RQWhBaUVDTkJnUDRERUFKQi93RnpKTk1CSTlNQklnQkJFSEZCQUVjazFBRWdBRUVnY1VFQVJ5VFZBUkFrRUNWQnJBb29BZ0FrcWdGQnNBb3RBQUFrcXdGQnNRb3RBQUFrclFGQkFDU3VBUkFuRUNoQndnc3RBQUJCQUVva2VFSERDeWdDQUNSN1FjY0xLQUlBSkh4Qnl3c3ZBUUFrZlJBcFFRQWttZ0pCZ0tqV3VRY2trUUpCQUNTU0FrRUFKSk1DUVlDbzFya0hKSlFDUVFBa2xRSkJBQ1NXQWdzRkFDT0FBZ3NGQUNPVUFnc0ZBQ09WQWdzRkFDT1dBZ3ZGQWdFRmZ5TkhJUVlDZndKL0lBRkJBRW9pQlFSQUlBQkJDRW9oQlFzZ0JRc0VRQ05HSUFSR0lRVUxJQVVMQkg4Z0FDQUdSZ1VnQlFzRVFDQURRUUZyRUFKQklIRkJBRWNoQlNBREVBSkJJSEZCQUVjaENFRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQVVnQ0VjYklnTWdBR29pQkVHZ0FVd0VRQ0FCUWFBQmJDQUVha0VEYkVHQXlRVnFJZ2NnQnkwQUFEb0FBQ0FCUWFBQmJDQUVha0VEYkVHQnlRVnFJQWN0QUFFNkFBQWdBVUdnQVd3Z0JHcEJBMnhCZ3NrRmFpQUhMUUFDT2dBQUlBRkJvQUZzSUFScVFZQ1JCR29nQUVFQUlBTnJheUFCUWFBQmJHcEIrSkFFYWkwQUFDSUVRUU54SWdkQkJISWdCeUFFUVFSeEd6b0FBQ0FKUVFGcUlRa0xJQU5CQVdvaEF3d0JDd3NGSUFRa1Jnc2dBQ0FHVGdSQUlBQkJDR29oQmlBQUlBSkJCM0VpQ0VnRVFDQUdJQWhxSVFZTEN5QUdKRWNnQ1FzcEFDQUFRWUNRQWtZRVFDQUJRWUFCYXlBQlFZQUJhaUFCUVlBQmNSc2hBUXNnQVVFRWRDQUFhZ3RLQUNBQVFRTjBJQUZCQVhScUlnQkJBV3BCUDNFaUFVRkFheUFCSUFJYlFZQ1FCR290QUFBaEFTQUFRVDl4SWdCQlFHc2dBQ0FDRzBHQWtBUnFMUUFBSUFGQi93RnhRUWgwY2d1NUFRQWdBUkFDSUFCQkFYUjFRUU54SVFBZ0FVSEkvZ05HQkVBak95RUJBa0FnQUVVTkFBSkFBa0FDUUNBQVFRRnJEZ01BQVFJREN5TThJUUVNQWdzalBTRUJEQUVMSXo0aEFRc0ZJQUZCeWY0RFJnUkFJejhoQVFKQUlBQkZEUUFDUUFKQUFrQWdBRUVCYXc0REFBRUNBd3NqUUNFQkRBSUxJMEVoQVF3QkN5TkNJUUVMQlNNM0lRRUNRQ0FBUlEwQUFrQUNRQUpBSUFCQkFXc09Bd0FCQWdNTEl6Z2hBUXdDQ3lNNUlRRU1BUXNqT2lFQkN3c0xJQUVMb2dNQkJYOGdBU0FBRURBZ0JVRUJkR29pQUVHQWtINXFJQUpCQVhGQkRYUWlBV290QUFBaEVDQUFRWUdRZm1vZ0FXb3RBQUFoRVNBRElRQURRQ0FBSUFSTUJFQWdBQ0FEYXlBR2FpSU9JQWhJQkVCQkJ5QUFheUVGSUF0QkFFZ2lBZ1IvSUFJRklBdEJJSEZGQ3lFQlFRQWhBZ0ovUVFFZ0JTQUFJQUViSWdGMElCRnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBWFFnRUhFYklRSWpnQUlFZnlBTFFRQk9JZ0VFZnlBQkJTQU1RUUJPQ3dVamdBSUxCSDhnQzBFSGNTRUZJQXhCQUU0aUFRUkFJQXhCQjNFaEJRc2dCU0FDSUFFUU1TSUZRUjl4UVFOMElROGdCVUhnQjNGQkJYVkJBM1FoQVNBRlFZRDRBWEZCQ25WQkEzUUZJQUpCeC80RElBb2dDa0VBVEJzaUNoQXlJZ1ZCZ0lEOEIzRkJFSFVoRHlBRlFZRCtBM0ZCQ0hVaEFTQUZRZjhCY1FzaEJTQUhJQWhzSUE1cVFRTnNJQWxxSWdrZ0R6b0FBQ0FKUVFGcUlBRTZBQUFnQ1VFQ2FpQUZPZ0FBSUFkQm9BRnNJQTVxUVlDUkJHb2dBa0VEY1NJQlFRUnlJQUVnQzBHQUFYRkJBRWRCQUNBTFFRQk9HeHM2QUFBZ0RVRUJhaUVOQ3lBQVFRRnFJUUFNQVFzTElBMExmZ0VEZnlBRFFRZHhJUU5CQUNBQ0lBSkJBM1ZCQTNScklBQWJJUWRCb0FFZ0FHdEJCeUFBUVFocVFhQUJTaHNoQ0VGL0lRSWpnQUlFUUNBRVFZRFFmbW90QUFBaUFrRUljVUVBUnlFSklBSkJ3QUJ4QkVCQkJ5QURheUVEQ3dzZ0JpQUZJQWtnQnlBSUlBTWdBQ0FCUWFBQlFZREpCVUVBSUFKQmZ4QXpDNlVDQVFGL0lBTkJCM0VoQXlBRklBWVFNQ0FFUVlEUWZtb3RBQUFpQkVIQUFIRUVmMEVISUFOckJTQURDMEVCZEdvaUEwR0FrSDVxSUFSQkNIRkJBRWNpQlVFTmRHb3RBQUFoQmlBRFFZR1FmbW9nQlVFQmNVRU5kR290QUFBaEJTQUNRUWR4SVFOQkFDRUNJQUZCb0FGc0lBQnFRUU5zUVlESkJXb2dCRUVIY1FKL1FRRWdBMEVISUFOcklBUkJJSEViSWdOMElBVnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQm5FYklnSkJBQkF4SWdOQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBRFFlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQU5CZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFKQkEzRWlCMEVFY2lBSElBUkJnQUZ4R3pvQUFBdkVBUUFnQkNBRkVEQWdBMEVIY1VFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURKQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0F4QXlJZ0pCZ0lEOEIzRkJFSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FZRCtBM0ZCQ0hVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVlDUkJHb2dBMEVEY1RvQUFBdldBUUVHZnlBRFFRTjFJUXNEUUNBRVFhQUJTQVJBSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUxRUVYwSUFKcUlBWkJBM1ZxSWdsQmdKQithaTBBQUNFSVFRQWhDaU0xQkVBZ0JDQUFJQVlnQ1NBSUVDOGlCMEVBU2dSQVFRRWhDaUFIUVFGcklBUnFJUVFMQ3lBS1JTTTBJZ2NnQnhzRVFDQUVJQUFnQmlBRElBa2dBU0FJRURRaUIwRUFTZ1JBSUFkQkFXc2dCR29oQkFzRklBcEZCRUFqZ0FJRVFDQUVJQUFnQmlBRElBa2dBU0FJRURVRklBUWdBQ0FHSUFNZ0FTQUlFRFlMQ3dzZ0JFRUJhaUVFREFFTEN3c3lBUU4vSStrQklRTWdBQ1BxQVNJRVNBUkFEd3RCQUNBRFFRZHJJZ05ySVFVZ0FDQUJJQUlnQUNBRWF5QURJQVVRTnd1OUJRRVBmd0pBUVNjaENRTkFJQWxCQUVnTkFTQUpRUUowSWdkQmdQd0RhaUlERUFJaEFpQURRUUZxRUFJaENpQURRUUpxRUFJaEF5QUNRUkJySVFJZ0NrRUlheUVLUVFnaEJDQUJCRUJCRUNFRUlBTWdBMEVCY1dzaEF3c2dBQ0FDVGlJRkJFQWdBQ0FDSUFScVNDRUZDeUFGQkVBZ0IwR0QvQU5xRUFJaUJVR0FBWEZCQUVjaEN5QUZRU0J4UVFCSElRNUJnSUFDSUFNUU1DQUVJQUFnQW1zaUFtdEJBV3NnQWlBRlFjQUFjUnRCQVhScUlnTkJnSkIrYWlBRlFRaHhRUUJISTRBQ0lnSWdBaHRCQVhGQkRYUWlBbW90QUFBaER5QURRWUdRZm1vZ0Ftb3RBQUFoRUVFSElRY0RRQ0FIUVFCT0JFQkJBQ0VJQW45QkFVRUFJQWNpQWtFSGEyc2dBaUFPR3lJQ2RDQVFjUVJBUVFJaENBc2dDRUVCYWdzZ0NFRUJJQUowSUE5eEd5SUlCRUJCQnlBSGF5QUthaUlHUVFCT0lnSUVRQ0FHUWFBQlRDRUNDeUFDQkVCQkFDRU1RUUFoRFNQakFVVWpnQUlpQWlBQ0d5SUNSUVJBSUFCQm9BRnNJQVpxUVlDUkJHb3RBQUFpQTBFRGNTSUVRUUJMSUFzZ0N4c0VRRUVCSVF3RklBTkJCSEZCQUVjamdBSWlBeUFER3lJREJFQWdCRUVBU3lFREMwRUJRUUFnQXhzaERRc0xJQUpGQkVBZ0RFVWlCQVIvSUExRkJTQUVDeUVDQ3lBQ0JFQWpnQUlFUUNBQVFhQUJiQ0FHYWtFRGJFR0F5UVZxSUFWQkIzRWdDRUVCRURFaUJFRWZjVUVEZERvQUFDQUFRYUFCYkNBR2FrRURiRUdCeVFWcUlBUkI0QWR4UVFWMVFRTjBPZ0FBSUFCQm9BRnNJQVpxUVFOc1FZTEpCV29nQkVHQStBRnhRUXAxUVFOME9nQUFCU0FBUWFBQmJDQUdha0VEYkVHQXlRVnFJQWhCeWY0RFFjaitBeUFGUVJCeEd4QXlJZ05CZ0lEOEIzRkJFSFU2QUFBZ0FFR2dBV3dnQm1wQkEyeEJnY2tGYWlBRFFZRCtBM0ZCQ0hVNkFBQWdBRUdnQVd3Z0JtcEJBMnhCZ3NrRmFpQURPZ0FBQ3dzTEN5QUhRUUZySVFjTUFRc0xDeUFKUVFGcklRa01BQUFMQUFzTFpnRUNmMEdBZ0FKQmdKQUNJOThCR3lFQkk0QUNJZ0lqNHdFZ0Foc0VRQ0FBSUFGQmdMZ0NRWUN3QWlQZ0FSc2o2QUVnQUdwQi93RnhRUUFqNXdFUU53c2ozZ0VFUUNBQUlBRkJnTGdDUVlDd0FpUGRBUnNRT0FzajRnRUVRQ0FBSStFQkVEa0xDeVVCQVg4Q1FBTkFJQUJCa0FGS0RRRWdBRUgvQVhFUU9pQUFRUUZxSVFBTUFBQUxBQXNMUmdFQ2Z3TkFJQUZCa0FGT1JRUkFRUUFoQUFOQUlBQkJvQUZJQkVBZ0FVR2dBV3dnQUdwQmdKRUVha0VBT2dBQUlBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBRUxDd3NkQVFGL1FZLytBeEFDUVFFZ0FIUnlJZ0VrdUFGQmovNERJQUVRQlFzTEFFRUJKTG9CUVFFUVBRc3NBUUovSTFraUFFRUFTaUlCQkVBalVpRUJDeUFBUVFGcklBQWdBUnNpQUVVRVFFRUFKRlFMSUFBa1dRc3NBUUovSTI0aUFFRUFTaUlCQkVBalp5RUJDeUFBUVFGcklBQWdBUnNpQUVVRVFFRUFKR2tMSUFBa2Jnc3NBUUovSTN3aUFFRUFTaUlCQkVBamRpRUJDeUFBUVFGcklBQWdBUnNpQUVVRVFFRUFKSGdMSUFBa2ZBc3dBUUovSTQwQklnQkJBRW9pQVFSQUk0Z0JJUUVMSUFCQkFXc2dBQ0FCR3lJQVJRUkFRUUFraVFFTElBQWtqUUVMUUFFQ2YwR1UvZ01RQWtINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBRlFaVCtBeUFCSUFCQkNIVWlBSElRQlNBQ0pGRWdBQ1JUSTFFalUwRUlkSElrVmd0ZEFRSi9JMThpQVNOTGRTRUFJQUVnQUdzZ0FDQUJhaU5LR3lJQVFmOFBUQ0lCQkg4alMwRUFTZ1VnQVFzRVFDQUFKRjhnQUJCREkxOGlBU05MZFNFQUlBRWdBR3NnQUNBQmFpTktHeUVBQ3lBQVFmOFBTZ1JBUVFBa1ZBc0xLUUVCZnlOZVFRRnJJZ0JCQUV3RVFDTkpKRjRqU1VFQVNpTmRJMTBiQkVBUVJBc0ZJQUFrWGdzTFVRRUNmeU5ZUVFGcklnQkJBRXdFUUNOUUpGZ2dBQVJBSTFvaEFTQUJRUTlJSTA4alR4c0VmeUFCUVFGcUJTTlBSU0lBQkVBZ0FVRUFTaUVBQ3lBQlFRRnJJQUVnQUJzTEpGb0xCU0FBSkZnTEMwNEJBMzhqYlVFQmF5SUJRUUJNQkVBalpTSUJCRUFqYnlFQUlBQkJEMGdqWkNOa0d3Ui9JQUJCQVdvRkkyUkZJZ0lFUUNBQVFRQktJUUlMSUFCQkFXc2dBQ0FDR3dza2J3c0xJQUVrYlF0V0FRTi9JNHdCUVFGcklnRkJBRXdFUUNPRUFTSUJCRUFqamdFaEFDQUFRUTlJSTRNQkk0TUJHd1IvSUFCQkFXb0ZJNE1CUlNJQ0JFQWdBRUVBU2lFQ0N5QUFRUUZySUFBZ0Foc0xKSTRCQ3dzZ0FTU01BUXVkQVFFQ2YwR0F3QUFqZ1FKMElnRWhBaU9xQVNBQWFpSUFJQUZPQkVBZ0FDQUNheVNxQVFKQUFrQUNRQUpBQWtBanJRRWlBQVJBSUFCQkFrWU5BUUpBSUFCQkJHc09CQU1BQkFVQUN3d0ZDeEEvRUVBUVFSQkNEQVFMRUQ4UVFCQkJFRUlRUlF3REN4QS9FRUFRUVJCQ0RBSUxFRDhRUUJCQkVFSVFSUXdCQ3hCR0VFY1FTQXNnQUVFQmFrRUhjU1N0QVVFQkR3VWdBQ1NxQVF0QkFBdHVBUUYvQWtBQ1FBSkFBa0FnQUVFQlJ3UkFJQUJCQW1zT0F3RUNBd1FMSTFVaUFDT1ZBVWNoQVNBQUpKVUJJQUVQQ3lOcUlnRWpsZ0ZISVFBZ0FTU1dBU0FBRHdzamVTSUFJNWNCUnlFQklBQWtsd0VnQVE4TEk0b0JJZ0VqbUFGSElRQWdBU1NZQVNBQUR3dEJBQXRWQUFKQUFrQUNRQ0FBUVFGSEJFQWdBRUVDUmcwQklBQkJBMFlOQWd3REMwRUJJQUYwUVlFQmNVRUFSdzhMUVFFZ0FYUkJod0Z4UVFCSER3dEJBU0FCZEVIK0FIRkJBRWNQQzBFQklBRjBRUUZ4UVFCSEMzQUJBWDhqVnlBQWF5SUJRUUJNQkVBZ0FTUlhRWUFRSTFaclFRSjBJZ0JCQW5RZ0FDT0JBaHNrVnlOWElBRkJIM1VpQUNBQUlBRnFjMnNrVnlOY1FRRnFRUWR4SkZ3RklBRWtWd3NqVlNOVUlnQWdBQnNFZnlOYUJVRVBEd3NqVENOY0VFc0VmMEVCQlVGL0MyeEJEMm9MWkFFQmZ5TnNJQUJySWdFa2JDQUJRUUJNQkVCQmdCQWphMnRCQW5RamdRSjBKR3dqYkNBQlFSOTFJZ0FnQUNBQmFuTnJKR3dqY1VFQmFrRUhjU1J4Q3lOcUkya2lBQ0FBR3dSL0kyOEZRUThQQ3lOaEkzRVFTd1IvUVFFRlFYOExiRUVQYWd2dUFRRUNmeU43SUFCcklnRkJBRXdFUUNBQkpIdEJnQkFqZW10QkFYUWpnUUowSkhzamV5QUJRUjkxSWdBZ0FDQUJhbk5ySkhzamZVRUJha0VmY1NSOUJTQUJKSHNMSTM0aEFTTjVJM2dpQUNBQUd3UkFJMzhFUUVHYy9nTVFBa0VGZFVFUGNTSUJKSDVCQUNSL0N3VkJEdzhMSTMwaUFrRUJkVUd3L2dOcUVBSWdBa0VCY1VWQkFuUjFRUTl4SVFCQkFDRUNBa0FDUUFKQUFrQWdBUVJBSUFGQkFVWU5BU0FCUVFKR0RRSU1Bd3NnQUVFRWRTRUFEQU1MUVFFaEFnd0NDeUFBUVFGMUlRQkJBaUVDREFFTElBQkJBblVoQUVFRUlRSUxJQUpCQUVvRWZ5QUFJQUp0QlVFQUMwRVBhZ3VHQVFFQ2Z5T0xBU0FBYXlJQlFRQk1CRUFqandFamhRRjBJNEVDZENBQlFSOTFJZ0FnQUNBQmFuTnJJUUVqa0FFaUFFRUJkU0lDSUFCQkFYRWdBa0VCY1hNaUFrRU9kSElpQUVHL2YzRWdBa0VHZEhJZ0FDT0dBUnNra0FFTElBRWtpd0VqaWdFamlRRWlBQ0FBR3dSL0k0NEJCVUVQRHd0QmYwRUJJNUFCUVFGeEcyeEJEMm9MTUFBZ0FFRThSZ1JBUWY4QUR3c2dBRUU4YTBHZ2pRWnNJQUZzUVFOMVFhQ05CbTFCUEdwQm9JMEdiRUdNOFFKdEM1TUJBUUYvUVFBa213RWdBRUVQSTZFQkd5QUJRUThqb2dFYmFpQUNRUThqb3dFYmFpQURRUThqcEFFYmFpRUVJQUJCRHlPbEFSc2dBVUVQSTZZQkcyb2dBa0VQSTZjQkcyb2hBU0FEUVE4anFBRWJJUU5CQUNTY0FVRUFKSjBCSUFRam53RkJBV29RVUNFQUlBRWdBMm9qb0FGQkFXb1FVQ0VCSUFBa21RRWdBU1NhQVNBQlFmOEJjU0FBUWY4QmNVRUlkSElMbWdNQkJYOGpTQ0FBYWlJQkpFZ2pWeUFCYTBFQVRDSUJSUVJBUVFFUVNpRUJDeU5nSUFCcUlnUWtZQ05zSUFSclFRQk1JZ1JGQkVCQkFoQktJUVFMSTNJZ0FHb2tjaU4vUlNJQ0JFQWpleU55YTBFQVNpRUNDeUFDUlNJQ1JRUkFRUU1RU2lFQ0N5T0FBU0FBYWlTQUFTT0xBU09BQVd0QkFFd2lCVVVFUUVFRUVFb2hCUXNnQVFSQUkwZ2hBMEVBSkVnZ0F4Qk1KSkVCQ3lBRUJFQWpZQ0VEUVFBa1lDQURFRTBra2dFTElBSUVRQ055SVFOQkFDUnlJQU1RVGlTVEFRc2dCUVJBSTRBQklRTkJBQ1NBQVNBREVFOGtsQUVMQW44Z0FTQUVJQUViSWdGRkJFQWdBaUVCQ3lBQlJRc0VRQ0FGSVFFTElBRUVRRUVCSkowQkN5T3JBU09zQVNBQWJHb2lBVUdBZ0lBQ0k0RUNkQ0lBVGdSQUlBRWdBR3NpQVNTckFTT2RBU0lBSTVzQklBQWJJZ0JGQkVBam5BRWhBQXNnQUFSQUk1RUJJNUlCSTVNQkk1UUJFRkVhQlNBQkpLc0JDeU91QVNJQlFRRjBRWUNad1FCcUlnQWptUUZCQW1vNkFBQWdBRUVCYWlPYUFVRUNham9BQUNBQlFRRnFJZ0FqcndGQkFYVkJBV3RPQkg4Z0FFRUJhd1VnQUFza3JnRUxDNkFEQVFWL0lBQVFUQ0VDSUFBUVRTRUJJQUFRVGlFRElBQVFUeUVFSUFJa2tRRWdBU1NTQVNBREpKTUJJQVFrbEFFanF3RWpyQUVnQUd4cUlnQkJnSUNBQWlPQkFuUk9CRUFnQUVHQWdJQUNJNEVDZEdza3F3RWdBaUFCSUFNZ0JCQlJJUUFqcmdGQkFYUkJnSm5CQUdvaUJTQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0JVRUJhaUFBUWY4QmNVRUNham9BQUNNMkJFQWdBa0VQUVE5QkR4QlJJUUFqcmdGQkFYUkJnSmtoYWlJQ0lBQkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUJCL3dGeFFRSnFPZ0FBUVE4Z0FVRVBRUThRVVNFQUk2NEJRUUYwUVlDWktXb2lBU0FBUVlEK0EzRkJDSFZCQW1vNkFBQWdBVUVCYWlBQVFmOEJjVUVDYWpvQUFFRVBRUThnQTBFUEVGRWhBQ091QVVFQmRFR0FtVEZxSWdFZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFGQkFXb2dBRUgvQVhGQkFtbzZBQUJCRDBFUFFROGdCQkJSSVFBanJnRkJBWFJCZ0prNWFpSUJJQUJCZ1A0RGNVRUlkVUVDYWpvQUFDQUJRUUZxSUFCQi93RnhRUUpxT2dBQUN5T3VBVUVCYWlJQUk2OEJRUUYxUVFGclRnUi9JQUJCQVdzRklBQUxKSzRCQ3dzZUFRRi9JQUFRU1NFQklBRkZJek1qTXhzRVFDQUFFRklGSUFBUVV3c0xLQUVCZjBIWEFDT0JBblFoQUFOQUk1NEJJQUJPQkVBZ0FCQlVJNTRCSUFCckpKNEJEQUVMQ3dzaEFDQUFRYWIrQTBZRVFFR20vZ01RQWtHQUFYRWhBQ0FBUWZBQWNnOExRWDhMbkFFQkFYOGowd0VoQUNQVUFRUkFJQUJCZTNFZ0FFRUVjaVBMQVJzaEFDQUFRWDV4SUFCQkFYSWp6Z0ViSVFBZ0FFRjNjU0FBUVFoeUk4d0JHeUVBSUFCQmZYRWdBRUVDY2lQTkFSc2hBQVVqMVFFRVFDQUFRWDV4SUFCQkFYSWp6d0ViSVFBZ0FFRjljU0FBUVFKeUk5QUJHeUVBSUFCQmUzRWdBRUVFY2lQUkFSc2hBQ0FBUVhkeElBQkJDSElqMGdFYklRQUxDeUFBUWZBQmNndlBBZ0VCZnlBQVFZQ0FBa2dFUUVGL0R3c2dBRUdBZ0FKT0lnRUVmeUFBUVlEQUFrZ0ZJQUVMQkVCQmZ3OExJQUJCZ01BRFRpSUJCSDhnQUVHQS9BTklCU0FCQ3dSQUlBQkJnRUJxRUFJUEN5QUFRWUQ4QTA0aUFRUi9JQUJCbi8wRFRBVWdBUXNFUUVIL0FVRi9JOW9CUVFKSUd3OExJQUJCemY0RFJnUkFRZjhCSVFGQnpmNERFQUpCQVhGRkJFQkIvZ0VoQVFzamdRSkZCRUFnQVVIL2ZuRWhBUXNnQVE4TElBQkJ4UDREUmdSQUlBQWo1Z0VRQlNQbUFROExJQUJCa1A0RFRpSUJCSDhnQUVHbS9nTk1CU0FCQ3dSQUVGVWdBQkJXRHdzZ0FFR3cvZ05PSWdFRWZ5QUFRYi8rQTB3RklBRUxCRUFRVlVGL0R3c2dBRUdFL2dOR0JFQWdBQ08vQVVHQS9nTnhRUWgxSWdFUUJTQUJEd3NnQUVHRi9nTkdCRUFnQUNQQUFSQUZJOEFCRHdzZ0FFR1AvZ05HQkVBanVBRkI0QUZ5RHdzZ0FFR0EvZ05HQkVBUVZ3OExRWDhMS1FFQmZ5UFhBU0FBUmdSQVFRRWsyUUVMSUFBUVdDSUJRWDlHQkg4Z0FCQUNCU0FCUWY4QmNRc0xzd0lCQkg4ajd3RUVRQThMSS9BQklRVWo4UUVoQXlBQVFmOC9UQVJBSUFNRWZ5QUJRUkJ4UlFVZ0F3dEZCRUFnQVVFUGNTSUVCRUFnQkVFS1JnUkFRUUVrN1FFTEJVRUFKTzBCQ3dzRklBQkIvLzhBVEFSQUkvTUJJZ1JGSWdJRWZ5QUNCU0FBUWYvZkFFd0xCRUFnQVVFUGNTUHJBU0FER3lFQ0lBVUVmeUFCUVI5eElRRWdBa0hnQVhFRkkvSUJCSDhnQVVIL0FIRWhBU0FDUVlBQmNRVkJBQ0FDSUFRYkN3c2hBQ0FBSUFGeUpPc0JCU1ByQVVIL0FYRWdBVUVBU2tFSWRISWs2d0VMQlNBRFJTSUVCSDhnQUVIL3Z3Rk1CU0FFQ3dSQUkrNEJJQVVnQlJzRVFDUHJBVUVmY1NBQlFlQUJjWElrNndFUEN5QUJRUTl4SUFGQkEzRWo4d0ViSk93QkJTQURSU0lDQkg4Z0FFSC8vd0ZNQlNBQ0N3UkFJQVVFUUNBQlFRRnhRUUJISk80QkN3c0xDd3NMS0FBZ0FFRUVkVUVQY1NST0lBQkJDSEZCQUVja1R5QUFRUWR4SkZBZ0FFSDRBWEZCQUVva1ZRc29BQ0FBUVFSMVFROXhKR01nQUVFSWNVRUFSeVJrSUFCQkIzRWtaU0FBUWZnQmNVRUFTaVJxQ3l3QUlBQkJCSFZCRDNFa2dnRWdBRUVJY1VFQVJ5U0RBU0FBUVFkeEpJUUJJQUJCK0FGeFFRQktKSW9CQ3pnQUlBQkJCSFVraFFFZ0FFRUljVUVBUnlTR0FTQUFRUWR4SWdBa2h3RWdBRUVCZENJQVFRRklCRUJCQVNFQUN5QUFRUU4wSkk4QkMyTUJBWDlCQVNSVUkxbEZCRUJCd0FBa1dRdEJnQkFqVm10QkFuUWlBRUVDZENBQUk0RUNHeVJYSTFBa1dDTk9KRm9qVmlSZkkwa2lBQ1JlSUFCQkFFb2lBQVIvSTB0QkFFb0ZJQUFMSkYwalMwRUFTZ1JBRUVRTEkxVkZCRUJCQUNSVUN3c3lBRUVCSkdramJrVUVRRUhBQUNSdUMwR0FFQ05yYTBFQ2RDT0JBblFrYkNObEpHMGpZeVJ2STJwRkJFQkJBQ1JwQ3dzdUFFRUJKSGdqZkVVRVFFR0FBaVI4QzBHQUVDTjZhMEVCZENPQkFuUWtlMEVBSkgwamVVVUVRRUVBSkhnTEMwRUFRUUVraVFFampRRkZCRUJCd0FBa2pRRUxJNDhCSTRVQmRDT0JBblFraXdFamhBRWtqQUVqZ2dFa2pnRkIvLzhCSkpBQkk0b0JSUVJBUVFBa2lRRUxDMXdBSUFCQmdBRnhRUUJISktRQklBQkJ3QUJ4UVFCSEpLTUJJQUJCSUhGQkFFY2tvZ0VnQUVFUWNVRUFSeVNoQVNBQVFRaHhRUUJISktnQklBQkJCSEZCQUVja3B3RWdBRUVDY1VFQVJ5U21BU0FBUVFGeFFRQkhKS1VCQytrRUFRRi9JQUJCcHY0RFJ5SUNCRUFqcVFGRklRSUxJQUlFUUVFQUR3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0pCa1A0RFJ3UkFJQUpCa2Y0RGF3NFdBZ1lLRGhVREJ3c1BBUVFJREJBVkJRa05FUklURkJVTElBRkI4QUJ4UVFSMUpFa2dBVUVJY1VFQVJ5UktJQUZCQjNFa1N3d1ZDeUFCUVlBQmNVRUFSeVI1REJRTElBRkJCblZCQTNFa1RDQUJRVDl4SkUxQndBQWpUV3NrV1F3VEN5QUJRUVoxUVFOeEpHRWdBVUUvY1NSaVFjQUFJMkpySkc0TUVnc2dBU1J6UVlBQ0kzTnJKSHdNRVFzZ0FVRS9jU1NCQVVIQUFDT0JBV3NralFFTUVBc2dBUkJiREE4TElBRVFYQXdPQzBFQkpIOGdBVUVGZFVFUGNTUjBEQTBMSUFFUVhRd01DeUFCSkZFalUwRUlkQ0FCY2lSV0RBc0xJQUVrWmlOb1FRaDBJQUZ5SkdzTUNnc2dBU1IxSTNkQkNIUWdBWElrZWd3SkN5QUJFRjRNQ0FzZ0FVR0FBWEVFUUNBQlFjQUFjVUVBUnlSU0lBRkJCM0VpQUNSVEkxRWdBRUVJZEhJa1ZoQmZDd3dIQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISkdjZ0FVRUhjU0lBSkdnalppQUFRUWgwY2lSckVHQUxEQVlMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNrZGlBQlFRZHhJZ0FrZHlOMUlBQkJDSFJ5SkhvUVlRc01CUXNnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVNJQVJCaUN3d0VDeUFCUVFSMVFRZHhKSjhCSUFGQkIzRWtvQUZCQVNTYkFRd0RDeUFCRUdOQkFTU2NBUXdDQ3lBQlFZQUJjVUVBUnlTcEFTQUJRWUFCY1VVRVFBSkFRWkQrQXlFQ0EwQWdBa0dtL2dOT0RRRWdBa0VBRUFVZ0FrRUJhaUVDREFBQUN3QUxDd3dCQzBFQkR3dEJBUXM4QVFGL0lBQkJDSFFoQVVFQUlRQURRQUpBSUFCQm53RktEUUFnQUVHQS9BTnFJQUFnQVdvUUFoQUZJQUJCQVdvaEFBd0JDd3RCaEFVaytRRUxJd0VCZnlQMEFSQUNJUUFqOVFFUUFrSC9BWEVnQUVIL0FYRkJDSFJ5UWZEL0EzRUxKd0VCZnlQMkFSQUNJUUFqOXdFUUFrSC9BWEVnQUVIL0FYRkJDSFJ5UWZBL2NVR0FnQUpxQzRRQkFRTi9JNEFDUlFSQUR3c2dBRUdBQVhGRkkvb0JJL29CR3dSQVFRQWsrZ0VqK0FFUUFrR0FBWEloQUNQNEFTQUFFQVVQQ3hCbUlRRVFaeUVDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKUG9CSUFNayt3RWdBU1Q4QVNBQ0pQMEJJL2dCSUFCQi8zNXhFQVVGSUFFZ0FpQURFSElqK0FGQi93RVFCUXNMWGdFRWZ5TkZJUU1qUkNBQVJpSUNSUVJBSUFBZ0EwWWhBZ3NnQWdSQUlBQkJBV3NpQkJBQ1FiOS9jU0lDUVQ5eElnVkJRR3NnQlNBQUlBTkdHMEdBa0FScUlBRTZBQUFnQWtHQUFYRUVRQ0FFSUFKQkFXcEJnQUZ5RUFVTEN3czhBUUYvQWtBQ1FBSkFBa0FnQUFSQUlBQWlBVUVCUmcwQklBRkJBa1lOQWlBQlFRTkdEUU1NQkF0QkNROExRUU1QQzBFRkR3dEJCdzhMUVFBTEpRRUJmMEVCSThVQkVHb2lBblFnQUhGQkFFY2lBQVIvUVFFZ0FuUWdBWEZGQlNBQUN3dUZBUUVFZndOQUlBSWdBRWdFUUNBQ1FRUnFJUUlqdndFaUFVRUVha0gvL3dOeElnTWt2d0VqeEFFRVFDUENBU0VFSThFQkJFQWp3d0Vrd0FGQkFTUzdBVUVDRUQxQkFDVEJBVUVCSk1JQkJTQUVCRUJCQUNUQ0FRc0xJQUVnQXhCckJFQWp3QUZCQVdvaUFVSC9BVW9FUUVFQkpNRUJRUUFoQVFzZ0FTVEFBUXNMREFFTEN3c01BQ08rQVJCc1FRQWt2Z0VMUmdFQmZ5Ty9BU0VBUVFBa3Z3RkJoUDREUVFBUUJTUEVBUVIvSUFCQkFCQnJCU1BFQVFzRVFDUEFBVUVCYWlJQVFmOEJTZ1JBUVFFa3dRRkJBQ0VBQ3lBQUpNQUJDd3VDQVFFRGZ5UEVBU0VCSUFCQkJIRkJBRWNreEFFZ0FFRURjU0VDSUFGRkJFQWp4UUVRYWlFQUlBSVFhaUVESTc4QklRRWp4QUVFZjBFQklBQjBJQUZ4QlVFQklBQjBJQUZ4UVFCSElnQUVmMEVCSUFOMElBRnhCU0FBQ3dzRVFDUEFBVUVCYWlJQVFmOEJTZ1JBUVFFa3dRRkJBQ0VBQ3lBQUpNQUJDd3NnQWlURkFRdlNCZ0VDZndKQUFrQWdBRUhOL2dOR0JFQkJ6ZjRESUFGQkFYRVFCUXdCQ3lBQVFZQ0FBa2dFUUNBQUlBRVFXZ3dCQ3lBQVFZQ0FBazRpQWdSQUlBQkJnTUFDU0NFQ0N5QUNEUUVnQUVHQXdBTk9JZ0lFUUNBQVFZRDhBMGdoQWdzZ0FnUkFJQUJCZ0VCcUlBRVFCUXdDQ3lBQVFZRDhBMDRpQWdSQUlBQkJuLzBEVENFQ0N5QUNCRUFqMmdGQkFrNFBDeUFBUWFEOUEwNGlBZ1JBSUFCQi8vMERUQ0VDQ3lBQ0RRQWdBRUdDL2dOR0JFQWdBVUVCY1VFQVJ5VElBU0FCUVFKeFFRQkhKTWtCSUFGQmdBRnhRUUJISk1vQlFRRVBDeUFBUVpEK0EwNGlBZ1JBSUFCQnB2NERUQ0VDQ3lBQ0JFQVFWU0FBSUFFUVpBOExJQUJCc1A0RFRpSUNCRUFnQUVHLy9nTk1JUUlMSUFJRVFCQlZDeUFBUWNEK0EwNGlBZ1JBSUFCQnkvNERUQ0VDQ3lBQ0JFQWdBRUhBL2dOR0JFQWdBUkFpREFNTElBQkJ3ZjREUmdSQVFjSCtBeUFCUWZnQmNVSEIvZ01RQWtFSGNYSkJnQUZ5RUFVTUFnc2dBRUhFL2dOR0JFQkJBQ1RtQVNBQVFRQVFCUXdDQ3lBQVFjWCtBMFlFUUNBQkpOc0JEQU1MSUFCQnh2NERSZ1JBSUFFUVpRd0RDd0pBQWtBQ1FBSkFJQUFpQWtIRC9nTkhCRUFnQWtIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTVG5BUXdHQ3lBQkpPZ0JEQVVMSUFFazZRRU1CQXNnQVNUcUFRd0RDd3dDQ3lQNEFTQUFSZ1JBSUFFUWFBd0JDeVAvQVNBQVJpSUNSUVJBSS80QklBQkdJUUlMSUFJRVFDUDZBUVJBQW44ai9BRWlBa0dBZ0FGT0lnTUVRQ0FDUWYvL0FVd2hBd3NnQTBVTEJFQWdBa0dBb0FOT0lnTUVRQ0FDUWYrL0Ewd2hBd3NMSUFNTkFnc0xJQUFqUTA0aUFnUkFJQUFqUlV3aEFnc2dBZ1JBSUFBZ0FSQnBEQUlMSUFCQmhQNERUaUlDQkVBZ0FFR0gvZ05NSVFJTElBSUVRQkJ0QWtBQ1FBSkFBa0FnQUNJQ1FZVCtBMGNFUUNBQ1FZWCtBMnNPQXdFQ0F3UUxFRzRNQlFzQ1FDUEVBUVJBSThJQkRRRWp3UUVFUUVFQUpNRUJDd3NnQVNUQUFRc01CUXNnQVNUREFTUENBU1BFQVNJQUlBQWJCRUFnQVNUQUFVRUFKTUlCQ3d3RUN5QUJFRzhNQXdzTUFnc2dBRUdBL2dOR0JFQWdBVUgvQVhNazB3RWowd0VpQWtFUWNVRUFSeVRVQVNBQ1FTQnhRUUJISk5VQkN5QUFRWS8rQTBZRVFDQUJFQk1NQWdzZ0FFSC8vd05HQkVBZ0FSQVNEQUlMUVFFUEMwRUFEd3RCQVFzZkFDUFlBU0FBUmdSQVFRRWsyUUVMSUFBZ0FSQndCRUFnQUNBQkVBVUxDMW9CQTM4RFFBSkFJQU1nQWs0TkFDQUFJQU5xRUZraEJTQUJJQU5xSVFRRFFDQUVRZisvQWtvRVFDQUVRWUJBYWlFRURBRUxDeUFFSUFVUWNTQURRUUZxSVFNTUFRc0xJL2tCUVNBamdRSjBJQUpCQkhWc2FpVDVBUXR5QVFKL0kvb0JSUVJBRHd0QkVDRUFJL3dCSS8wQkFuOGord0VpQVVFUVNBUkFJQUVoQUFzZ0FBc1FjaVA4QVNBQWFpVDhBU1A5QVNBQWFpVDlBU0FCSUFCcklnRWsrd0VqK0FFaEFDQUJRUUJNQkVCQkFDVDZBU0FBUWY4QkVBVUZJQUFnQVVFRWRVRUJhMEgvZm5FUUJRc0xRd0VCZndKL0lBQkZJZ0pGQkVBZ0FFRUJSaUVDQ3lBQ0N3Ui9JK1lCSTlzQlJnVWdBZ3NFUUNBQlFRUnlJZ0ZCd0FCeEJFQVFQZ3NGSUFGQmUzRWhBUXNnQVF2NkFRRUZmeVBjQVVVRVFBOExJOW9CSVFNZ0F5UG1BU0lFUVpBQlRnUi9RUUVGSStVQklnSkIrQUlqZ1FKMElnQk9CSDlCQWdWQkEwRUFJQUlnQUU0YkN3c2lBVWNFUUVIQi9nTVFBaUVBSUFFazJnRkJBQ0VDQWtBQ1FBSkFBa0FnQVFSQUlBRkJBV3NPQXdFQ0F3UUxJQUJCZkhFaUFFRUljVUVBUnlFQ0RBTUxJQUJCZlhGQkFYSWlBRUVRY1VFQVJ5RUNEQUlMSUFCQmZuRkJBbklpQUVFZ2NVRUFSeUVDREFFTElBQkJBM0loQUFzZ0FnUkFFRDRMSUFGRkJFQVFjd3NnQVVFQlJnUkFRUUVrdVFGQkFCQTlDMEhCL2dNZ0FTQUFFSFFRQlFVZ0JFR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUFoQjBFQVVMQ3d1ZkFRRUJmeVBjQVFSQUkrVUJJQUJxSk9VQkl6SWhBUU5BSStVQlFRUWpnUUlpQUhSQnlBTWdBSFFqNWdGQm1RRkdHMDRFUUNQbEFVRUVJNEVDSWdCMFFjZ0RJQUIwSStZQlFaa0JSaHRySk9VQkkrWUJJZ0JCa0FGR0JFQWdBUVJBRURzRklBQVFPZ3NRUEVGL0pFWkJmeVJIQlNBQVFaQUJTQVJBSUFGRkJFQWdBQkE2Q3dzTFFRQWdBRUVCYWlBQVFaa0JTaHNrNWdFTUFRc0xDeEIxQ3pjQkFYOUJCQ09CQWlJQWRFSElBeUFBZENQbUFVR1pBVVliSVFBRFFDUGtBU0FBVGdSQUlBQVFkaVBrQVNBQWF5VGtBUXdCQ3dzTHVBRUJCSDhqeWdGRkJFQVBDd05BSUFNZ0FFZ0VRQ0FEUVFScUlRTUNmeVBHQVNJQ1FRUnFJZ0ZCLy84RFNnUkFJQUZCZ0lBRWF5RUJDeUFCQ3lUR0FVRUJRUUpCQnlQSkFSc2lCSFFnQW5GQkFFY2lBZ1JBUVFFZ0JIUWdBWEZGSVFJTElBSUVRRUdCL2dOQmdmNERFQUpCQVhSQkFXcEIvd0Z4RUFVanh3RkJBV29pQVVFSVJnUkFRUUFreHdGQkFTUzhBVUVERUQxQmd2NERRWUwrQXhBQ1FmOStjUkFGUVFBa3lnRUZJQUVreHdFTEN3d0JDd3NMamdFQUkva0JRUUJLQkVBaitRRWdBR29oQUVFQUpQa0JDeU9NQWlBQWFpU01BaU9RQWtVRVFDTXdCRUFqNUFFZ0FHb2s1QUVRZHdVZ0FCQjJDeU12QkVBam5nRWdBR29rbmdFRklBQVFWQXNnQUJCNEN5TXhCRUFqdmdFZ0FHb2t2Z0VRYlFVZ0FCQnNDeU9UQWlBQWFpSUFJNUVDVGdSQUk1SUNRUUZxSkpJQ0lBQWprUUpySVFBTElBQWtrd0lMQ3dCQkJCQjVJNHNDRUFJTEp3RUJmMEVFRUhraml3SkJBV3BCLy84RGNSQUNJUUFRZWtIL0FYRWdBRUgvQVhGQkNIUnlDd3dBUVFRUWVTQUFJQUVRY1FzMUFRRi9RUUVnQUhSQi93RnhJUUlnQVVFQVNnUkFJNGtDSUFKeVFmOEJjU1NKQWdVamlRSWdBa0gvQVhOeEpJa0NDeU9KQWdzSkFFRUZJQUFRZlJvTE9BRUJmeUFCUVFCT0JFQWdBRUVQY1NBQlFROXhha0VRY1VFQVJ4QitCU0FCUVI5MUlnSWdBU0FDYW5OQkQzRWdBRUVQY1VzUWZnc0xDUUJCQnlBQUVIMGFDd2tBUVFZZ0FCQjlHZ3NKQUVFRUlBQVFmUm9MT1FFQmZ5QUJRWUQrQTNGQkNIVWhBaUFBSUFGQi93RnhJZ0VRY0FSQUlBQWdBUkFGQ3lBQVFRRnFJZ0FnQWhCd0JFQWdBQ0FDRUFVTEN3MEFRUWdRZVNBQUlBRVFnd0VMV0FBZ0FnUkFJQUVnQUVILy93TnhJZ0JxSUFBZ0FYTnpJZ0pCRUhGQkFFY1FmaUFDUVlBQ2NVRUFSeENDQVFVZ0FDQUJha0gvL3dOeElnSWdBRUgvL3dOeFNSQ0NBU0FBSUFGeklBSnpRWUFnY1VFQVJ4QitDd3NLQUVFRUVIa2dBQkJaQzVRRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNNRlFzUWUwSC8vd054SWdCQmdQNERjVUVJZFNTREFpQUFRZjhCY1NTRUFnd1BDeU9FQWtIL0FYRWpnd0pCL3dGeFFRaDBjaU9DQWhCOERCTUxJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSU1DREJNTEk0TUNJZ0JCQVJCL0lBQkJBV3BCL3dGeElnQWtnd0lNRFFzamd3SWlBRUYvRUg4Z0FFRUJhMEgvQVhFaUFDU0RBZ3dOQ3hCNlFmOEJjU1NEQWd3TkN5T0NBaUlBUVlBQmNVR0FBVVlRZ2dFZ0FFRUJkQ0FBUWY4QmNVRUhkbkpCL3dGeEpJSUNEQTBMRUh0Qi8vOERjU09LQWhDRUFRd0lDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaUlBSTRRQ1FmOEJjU09EQWtIL0FYRkJDSFJ5SWdGQkFCQ0ZBU0FBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkljQ0lBQkIvd0Z4SklnQ1FRQVFnUUZCQ0E4TEk0UUNRZjhCY1NPREFrSC9BWEZCQ0hSeUVJWUJRZjhCY1NTQ0Fnd0xDeU9FQWtIL0FYRWpnd0pCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NEQWd3TEN5T0VBaUlBUVFFUWZ5QUFRUUZxUWY4QmNTSUFKSVFDREFVTEk0UUNJZ0JCZnhCL0lBQkJBV3RCL3dGeElnQWtoQUlNQlFzUWVrSC9BWEVraEFJTUJRc2pnZ0lpQUVFQmNVRUFTeENDQVNBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFa2dnSU1CUXRCZnc4TEk0c0NRUUpxUWYvL0EzRWtpd0lNQkFzZ0FFVVFnQUZCQUJDQkFRd0RDeUFBUlJDQUFVRUJFSUVCREFJTEk0c0NRUUZxUWYvL0EzRWtpd0lNQVF0QkFCQ0FBVUVBRUlFQlFRQVFmZ3RCQkE4TElBQkIvd0Z4SklRQ1FRZ0xnd1lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFDQUFRUkZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPQUFnUkFRYzMrQXhDR0FVSC9BWEVpQUVFQmNRUkFRYzMrQXlBQVFYNXhJZ0JCZ0FGeEJIOUJBQ1NCQWlBQVFmOStjUVZCQVNTQkFpQUFRWUFCY2dzUWZFSEVBQThMQzBFQkpKQUNEQkFMRUh0Qi8vOERjU0lBUVlEK0EzRkJDSFVraFFJZ0FFSC9BWEVraGdJaml3SkJBbXBCLy84RGNTU0xBZ3dSQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lPQ0FoQjhEQkFMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSklVQ0RCQUxJNFVDSWdCQkFSQi9JQUJCQVdwQi93RnhKSVVDSTRVQ1JSQ0FBVUVBRUlFQkRBNExJNFVDSWdCQmZ4Qi9JQUJCQVd0Qi93RnhKSVVDSTRVQ1JSQ0FBVUVCRUlFQkRBMExFSHBCL3dGeEpJVUNEQW9MSTRJQ0lnRkJnQUZ4UVlBQlJpRUFJNGtDUVFSMlFRRnhJQUZCQVhSeVFmOEJjU1NDQWd3S0N4QjZJUUFqaXdJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSXNDUVFnUEN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpSUFJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJZ0ZCQUJDRkFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWNDSUFCQi93RnhKSWdDUVFBUWdRRkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5RUlZQlFmOEJjU1NDQWd3SUN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0ZBZ3dJQ3lPR0FpSUFRUUVRZnlBQVFRRnFRZjhCY1NJQUpJWUNJQUJGRUlBQlFRQVFnUUVNQmdzamhnSWlBRUYvRUg4Z0FFRUJhMEgvQVhFaUFDU0dBaUFBUlJDQUFVRUJFSUVCREFVTEVIcEIvd0Z4SklZQ0RBSUxJNElDSWdGQkFYRkJBVVloQUNPSkFrRUVka0VCY1VFSGRDQUJRZjhCY1VFQmRuSWtnZ0lNQWd0QmZ3OExJNHNDUVFGcVFmLy9BM0VraXdJTUFRc2dBQkNDQVVFQUVJQUJRUUFRZ1FGQkFCQitDMEVFRHdzZ0FFSC9BWEVraGdKQkNBdmVCZ0VDZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQklFY0VRQ0FBUVNGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5T0pBa0VIZGtFQmNRUkFJNHNDUVFGcVFmLy9BM0VraXdJRkVIb2hBQ09MQWlBQVFSaDBRUmgxYWtILy93TnhRUUZxUWYvL0EzRWtpd0lMUVFnUEN4QjdRZi8vQTNFaUFFR0EvZ054UVFoMUpJY0NJQUJCL3dGeEpJZ0NJNHNDUVFKcVFmLy9BM0VraXdJTUZBc2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWlBQ09DQWhCOERBOExJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWNDREEwTEk0Y0NJZ0JCQVJCL0lBQkJBV3BCL3dGeElnQWtod0lNRGdzamh3SWlBRUYvRUg4Z0FFRUJhMEgvQVhFaUFDU0hBZ3dPQ3hCNlFmOEJjU1NIQWd3T0MwRUdRUUFqaVFJaUFrRUZka0VCY1VFQVN4c2lBVUhnQUhJZ0FTQUNRUVIyUVFGeFFRQkxHeUVCSTRJQ0lRQWdBa0VHZGtFQmNVRUFTd1IvSUFBZ0FXdEIvd0Z4QlNBQlFRWnlJQUVnQUVFUGNVRUpTeHNpQVVIZ0FISWdBU0FBUVprQlN4c2lBU0FBYWtIL0FYRUxJZ0JGRUlBQklBRkI0QUJ4UVFCSEVJSUJRUUFRZmlBQUpJSUNEQTRMSTRrQ1FRZDJRUUZ4UVFCTEJFQVFlaUVBSTRzQ0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NMQWdVaml3SkJBV3BCLy84RGNTU0xBZ3RCQ0E4TEk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUlnQWdBRUgvL3dOeFFRQVFoUUVnQUVFQmRFSC8vd054SWdCQmdQNERjVUVJZFNTSEFpQUFRZjhCY1NTSUFrRUFFSUVCUVFnUEN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpSUFFSVlCUWY4QmNTU0NBZ3dIQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNTSEFnd0ZDeU9JQWlJQVFRRVFmeUFBUVFGcVFmOEJjU0lBSklnQ0RBWUxJNGdDSWdCQmZ4Qi9JQUJCQVd0Qi93RnhJZ0FraUFJTUJnc1Fla0gvQVhFa2lBSU1CZ3NqZ2dKQmYzTkIvd0Z4SklJQ1FRRVFnUUZCQVJCK0RBWUxRWDhQQ3lBQVFmOEJjU1NJQWtFSUR3c2dBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NIQWlBQVFmOEJjU1NJQWd3REN5QUFSUkNBQVVFQUVJRUJEQUlMSUFCRkVJQUJRUUVRZ1FFTUFRc2ppd0pCQVdwQi8vOERjU1NMQWd0QkJBdlhCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJNRWNFUUNBQVFURnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9KQWtFRWRrRUJjUVJBSTRzQ1FRRnFRZi8vQTNFa2l3SUZFSG9oQUNPTEFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VraXdJTFFRZ1BDeEI3UWYvL0EzRWtpZ0lqaXdKQkFtcEIvLzhEY1NTTEFnd1JDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaUlBSTRJQ0VId01EZ3NqaWdKQkFXcEIvLzhEY1NTS0FrRUlEd3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElpQVJDR0FTSUFRUUVRZnlBQVFRRnFRZjhCY1NJQVJSQ0FBVUVBRUlFQklBRWdBQkI4REE0TEk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUlnRVFoZ0VpQUVGL0VIOGdBRUVCYTBIL0FYRWlBRVVRZ0FGQkFSQ0JBU0FCSUFBUWZBd05DeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaEI2UWY4QmNSQjhEQXNMUVFBUWdRRkJBQkIrUVFFUWdnRU1Dd3NqaVFKQkJIWkJBWEZCQVVZRVFCQjZJUUFqaXdJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSXNDQlNPTEFrRUJha0gvL3dOeEpJc0NDMEVJRHdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJaUFDT0tBa0VBRUlVQkk0b0NJQUJxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWNDSUFCQi93RnhKSWdDUVFBUWdRRkJDQThMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5SWdBUWhnRkIvd0Z4SklJQ0RBWUxJNG9DUVFGclFmLy9BM0VraWdKQkNBOExJNElDSWdCQkFSQi9JQUJCQVdwQi93RnhJZ0FrZ2dJZ0FFVVFnQUZCQUJDQkFRd0dDeU9DQWlJQVFYOFFmeUFBUVFGclFmOEJjU0lBSklJQ0lBQkZFSUFCUVFFUWdRRU1CUXNRZWtIL0FYRWtnZ0lNQXd0QkFCQ0JBVUVBRUg0amlRSkJCSFpCQVhGQkFFMFFnZ0VNQXd0QmZ3OExJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVraHdJZ0FFSC9BWEVraUFJTUFRc2ppd0pCQVdwQi8vOERjU1NMQWd0QkJBdUNBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FBUndSQUlBQkJ3UUJHRFFFQ1FDQUFRY0lBYXc0T0F3UUZCZ2NJQ1JFS0N3d05EZzhBQ3d3UEN3d1BDeU9FQWlTREFnd09DeU9GQWlTREFnd05DeU9HQWlTREFnd01DeU9IQWlTREFnd0xDeU9JQWlTREFnd0tDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaENHQVVIL0FYRWtnd0lNQ1FzamdnSWtnd0lNQ0Fzamd3SWtoQUlNQndzamhRSWtoQUlNQmdzamhnSWtoQUlNQlFzamh3SWtoQUlNQkFzamlBSWtoQUlNQXdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRkIvd0Z4SklRQ0RBSUxJNElDSklRQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFSd1JBSUFCQjBRQkdEUUVDUUNBQVFkSUFhdzRPRUFNRUJRWUhDQWtLRUFzTURRNEFDd3dPQ3lPREFpU0ZBZ3dPQ3lPRUFpU0ZBZ3dOQ3lPR0FpU0ZBZ3dNQ3lPSEFpU0ZBZ3dMQ3lPSUFpU0ZBZ3dLQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2hDR0FVSC9BWEVraFFJTUNRc2pnZ0lraFFJTUNBc2pnd0lraGdJTUJ3c2poQUlraGdJTUJnc2poUUlraGdJTUJRc2pod0lraGdJTUJBc2ppQUlraGdJTUF3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISVFoZ0ZCL3dGeEpJWUNEQUlMSTRJQ0pJWUNEQUVMUVg4UEMwRUVDLzBCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFBUndSQUlBQkI0UUJHRFFFQ1FDQUFRZUlBYXc0T0F3UVFCUVlIQ0FrS0N3d1FEUTRBQ3d3T0N5T0RBaVNIQWd3T0N5T0VBaVNIQWd3TkN5T0ZBaVNIQWd3TUN5T0dBaVNIQWd3TEN5T0lBaVNIQWd3S0N5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNoQ0dBVUgvQVhFa2h3SU1DUXNqZ2dJa2h3SU1DQXNqZ3dJa2lBSU1Cd3NqaEFJa2lBSU1CZ3NqaFFJa2lBSU1CUXNqaGdJa2lBSU1CQXNqaHdJa2lBSU1Bd3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElRaGdGQi93RnhKSWdDREFJTEk0SUNKSWdDREFFTFFYOFBDMEVFQzVRREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQkhCRUFnQUVIeEFFWU5BUUpBSUFCQjhnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVRQUxEQThMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5STRNQ0VId01Ed3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElqaEFJUWZBd09DeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaU9GQWhCOERBMExJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlJNFlDRUh3TURBc2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWpod0lRZkF3TEN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpT0lBaEI4REFvTEkvb0JSUVJBQWtBanNBRUVRRUVCSkkwQ0RBRUxJN0lCSTdnQmNVRWZjVVVFUUVFQkpJNENEQUVMUVFFa2p3SUxDd3dKQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2lPQ0FoQjhEQWdMSTRNQ0pJSUNEQWNMSTRRQ0pJSUNEQVlMSTRVQ0pJSUNEQVVMSTRZQ0pJSUNEQVFMSTRjQ0pJSUNEQU1MSTRnQ0pJSUNEQUlMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5RUlZQlFmOEJjU1NDQWd3QkMwRi9Ed3RCQkFzM0FRRi9JQUZCQUU0RVFDQUFRZjhCY1NBQUlBRnFRZjhCY1VzUWdnRUZJQUZCSDNVaUFpQUJJQUpxY3lBQVFmOEJjVW9RZ2dFTEN6TUJBbjhqZ2dJaUFTQUFRZjhCY1NJQ0VIOGdBU0FDRUk4QklBQWdBV3BCL3dGeElnRWtnZ0lnQVVVUWdBRkJBQkNCQVF0WEFRSi9JNElDSWdFZ0FHb2ppUUpCQkhaQkFYRnFRZjhCY1NJQ0lBQWdBWE56UVJCeFFRQkhFSDRnQUVIL0FYRWdBV29qaVFKQkJIWkJBWEZxUVlBQ2NVRUFTeENDQVNBQ0pJSUNJQUpGRUlBQlFRQVFnUUVMZ3dJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdBQVVjRVFDQUJRWUVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzamd3SVFrQUVNRUFzamhBSVFrQUVNRHdzamhRSVFrQUVNRGdzamhnSVFrQUVNRFFzamh3SVFrQUVNREFzamlBSVFrQUVNQ3dzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRVFrQUVNQ2dzamdnSVFrQUVNQ1Fzamd3SVFrUUVNQ0FzamhBSVFrUUVNQndzamhRSVFrUUVNQmdzamhnSVFrUUVNQlFzamh3SVFrUUVNQkFzamlBSVFrUUVNQXdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRVFrUUVNQWdzamdnSVFrUUVNQVF0QmZ3OExRUVFMTmdFQ2Z5T0NBaUlCSUFCQi93RnhRWDlzSWdJUWZ5QUJJQUlRandFZ0FTQUFhMEgvQVhFaUFTU0NBaUFCUlJDQUFVRUJFSUVCQzFjQkFuOGpnZ0lpQVNBQWF5T0pBa0VFZGtFQmNXdEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1FmaUFCSUFCQi93RnhheU9KQWtFRWRrRUJjV3RCZ0FKeFFRQkxFSUlCSUFJa2dnSWdBa1VRZ0FGQkFSQ0JBUXVEQWdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWkFCUndSQUlBRkJrUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPREFoQ1RBUXdRQ3lPRUFoQ1RBUXdQQ3lPRkFoQ1RBUXdPQ3lPR0FoQ1RBUXdOQ3lPSEFoQ1RBUXdNQ3lPSUFoQ1RBUXdMQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2hDR0FSQ1RBUXdLQ3lPQ0FoQ1RBUXdKQ3lPREFoQ1VBUXdJQ3lPRUFoQ1VBUXdIQ3lPRkFoQ1VBUXdHQ3lPR0FoQ1VBUXdGQ3lPSEFoQ1VBUXdFQ3lPSUFoQ1VBUXdEQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2hDR0FSQ1VBUXdDQ3lPQ0FoQ1VBUXdCQzBGL0R3dEJCQXNqQVFGL0k0SUNJQUJ4SWdFa2dnSWdBVVVRZ0FGQkFCQ0JBVUVCRUg1QkFCQ0NBUXNuQVFGL0k0SUNJQUJ6UWY4QmNTSUJKSUlDSUFGRkVJQUJRUUFRZ1FGQkFCQitRUUFRZ2dFTGd3SUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHZ0FVY0VRQ0FCUWFFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pnd0lRbGdFTUVBc2poQUlRbGdFTUR3c2poUUlRbGdFTURnc2poZ0lRbGdFTURRc2pod0lRbGdFTURBc2ppQUlRbGdFTUN3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISVFoZ0VRbGdFTUNnc2pnZ0lRbGdFTUNRc2pnd0lRbHdFTUNBc2poQUlRbHdFTUJ3c2poUUlRbHdFTUJnc2poZ0lRbHdFTUJRc2pod0lRbHdFTUJBc2ppQUlRbHdFTUF3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISVFoZ0VRbHdFTUFnc2pnZ0lRbHdFTUFRdEJmdzhMUVFRTEpRQWpnZ0lnQUhKQi93RnhJZ0FrZ2dJZ0FFVVFnQUZCQUJDQkFVRUFFSDVCQUJDQ0FRc3JBUUYvSTRJQ0lnRWdBRUgvQVhGQmYyd2lBQkIvSUFFZ0FCQ1BBU0FBSUFGcVJSQ0FBVUVCRUlFQkM0TUNBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQnNBRkhCRUFnQVVHeEFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJNE1DRUprQkRCQUxJNFFDRUprQkRBOExJNFVDRUprQkRBNExJNFlDRUprQkRBMExJNGNDRUprQkRBd0xJNGdDRUprQkRBc0xJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlFSVlCRUprQkRBb0xJNElDRUprQkRBa0xJNE1DRUpvQkRBZ0xJNFFDRUpvQkRBY0xJNFVDRUpvQkRBWUxJNFlDRUpvQkRBVUxJNGNDRUpvQkRBUUxJNGdDRUpvQkRBTUxJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlFSVlCRUpvQkRBSUxJNElDRUpvQkRBRUxRWDhQQzBFRUN6c0JBWDhnQUJCWUlnRkJmMFlFZnlBQUVBSUZJQUVMUWY4QmNTQUFRUUZxSWdFUVdDSUFRWDlHQkg4Z0FSQUNCU0FBQzBIL0FYRkJDSFJ5Q3dzQVFRZ1FlU0FBRUp3QkN6TUFJQUJCZ0FGeFFZQUJSaENDQVNBQVFRRjBJQUJCL3dGeFFRZDJja0gvQVhFaUFFVVFnQUZCQUJDQkFVRUFFSDRnQUFzeEFDQUFRUUZ4UVFCTEVJSUJJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU0lBUlJDQUFVRUFFSUVCUVFBUWZpQUFDemtCQVg4amlRSkJCSFpCQVhFZ0FFRUJkSEpCL3dGeElRRWdBRUdBQVhGQmdBRkdFSUlCSUFFaUFFVVFnQUZCQUJDQkFVRUFFSDRnQUFzNkFRRi9JNGtDUVFSMlFRRnhRUWQwSUFCQi93RnhRUUYyY2lFQklBQkJBWEZCQVVZUWdnRWdBU0lBUlJDQUFVRUFFSUVCUVFBUWZpQUFDeWtBSUFCQmdBRnhRWUFCUmhDQ0FTQUFRUUYwUWY4QmNTSUFSUkNBQVVFQUVJRUJRUUFRZmlBQUMwUUJBbjhnQUVFQmNVRUJSaUVCSUFCQmdBRnhRWUFCUmlFQ0lBQkIvd0Z4UVFGMklnQkJnQUZ5SUFBZ0Foc2lBRVVRZ0FGQkFCQ0JBVUVBRUg0Z0FSQ0NBU0FBQ3lvQUlBQkJEM0ZCQkhRZ0FFSHdBWEZCQkhaeUlnQkZFSUFCUVFBUWdRRkJBQkIrUVFBUWdnRWdBQXN0QVFGL0lBQkJBWEZCQVVZaEFTQUFRZjhCY1VFQmRpSUFSUkNBQVVFQUVJRUJRUUFRZmlBQkVJSUJJQUFMSFFCQkFTQUFkQ0FCY1VIL0FYRkZFSUFCUVFBUWdRRkJBUkIrSUFFTHNRZ0JCbjhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQjNFaUJpSUZCRUFnQlVFQmF3NEhBUUlEQkFVR0J3Z0xJNE1DSVFFTUJ3c2poQUloQVF3R0N5T0ZBaUVCREFVTEk0WUNJUUVNQkFzamh3SWhBUXdEQ3lPSUFpRUJEQUlMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5RUlZQklRRU1BUXNqZ2dJaEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklnUUVRQ0FFUVFGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5QUFRUWRNQkg5QkFTRUNJQUVRbmdFRklBQkJEMHdFZjBFQklRSWdBUkNmQVFWQkFBc0xJUU1NRHdzZ0FFRVhUQVIvUVFFaEFpQUJFS0FCQlNBQVFSOU1CSDlCQVNFQ0lBRVFvUUVGUVFBTEN5RUREQTRMSUFCQkowd0VmMEVCSVFJZ0FSQ2lBUVVnQUVFdlRBUi9RUUVoQWlBQkVLTUJCVUVBQ3dzaEF3d05DeUFBUVRkTUJIOUJBU0VDSUFFUXBBRUZJQUJCUDB3RWYwRUJJUUlnQVJDbEFRVkJBQXNMSVFNTURBc2dBRUhIQUV3RWYwRUJJUUpCQUNBQkVLWUJCU0FBUWM4QVRBUi9RUUVoQWtFQklBRVFwZ0VGUVFBTEN5RUREQXNMSUFCQjF3Qk1CSDlCQVNFQ1FRSWdBUkNtQVFVZ0FFSGZBRXdFZjBFQklRSkJBeUFCRUtZQkJVRUFDd3NoQXd3S0N5QUFRZWNBVEFSL1FRRWhBa0VFSUFFUXBnRUZJQUJCN3dCTUJIOUJBU0VDUVFVZ0FSQ21BUVZCQUFzTElRTU1DUXNnQUVIM0FFd0VmMEVCSVFKQkJpQUJFS1lCQlNBQVFmOEFUQVIvUVFFaEFrRUhJQUVRcGdFRlFRQUxDeUVEREFnTElBQkJod0ZNQkg5QkFTRUNJQUZCZm5FRklBQkJqd0ZNQkg5QkFTRUNJQUZCZlhFRlFRQUxDeUVEREFjTElBQkJsd0ZNQkg5QkFTRUNJQUZCZTNFRklBQkJud0ZNQkg5QkFTRUNJQUZCZDNFRlFRQUxDeUVEREFZTElBQkJwd0ZNQkg5QkFTRUNJQUZCYjNFRklBQkJyd0ZNQkg5QkFTRUNJQUZCWDNFRlFRQUxDeUVEREFVTElBQkJ0d0ZNQkg5QkFTRUNJQUZCdjM5eEJTQUFRYjhCVEFSL1FRRWhBaUFCUWY5K2NRVkJBQXNMSVFNTUJBc2dBRUhIQVV3RWYwRUJJUUlnQVVFQmNnVWdBRUhQQVV3RWYwRUJJUUlnQVVFQ2NnVkJBQXNMSVFNTUF3c2dBRUhYQVV3RWYwRUJJUUlnQVVFRWNnVWdBRUhmQVV3RWYwRUJJUUlnQVVFSWNnVkJBQXNMSVFNTUFnc2dBRUhuQVV3RWYwRUJJUUlnQVVFUWNnVWdBRUh2QVV3RWYwRUJJUUlnQVVFZ2NnVkJBQXNMSVFNTUFRc2dBRUgzQVV3RWYwRUJJUUlnQVVIQUFISUZJQUJCL3dGTUJIOUJBU0VDSUFGQmdBRnlCVUVBQ3dzaEF3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBWWlCQVJBSUFSQkFXc09Cd0VDQXdRRkJnY0lDeUFESklNQ0RBY0xJQU1raEFJTUJnc2dBeVNGQWd3RkN5QURKSVlDREFRTElBTWtod0lNQXdzZ0F5U0lBZ3dDQ3lBRlFRUklJZ1FFZnlBRUJTQUZRUWRLQ3dSQUk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUlBTVFmQXNNQVFzZ0F5U0NBZ3RCQkVGL0lBSWJDNnNFQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhBQVVjRVFDQUFRY0VCYXc0UEFRSVJBd1FGQmdjSUNRb0xFQXdORGdzamlRSkJCM1pCQVhFTkVRd09DeU9LQWhDZEFVSC8vd054SVFBamlnSkJBbXBCLy84RGNTU0tBaUFBUVlEK0EzRkJDSFVrZ3dJZ0FFSC9BWEVraEFKQkJBOExJNGtDUVFkMlFRRnhEUkVNRGdzamlRSkJCM1pCQVhFTkVBd01DeU9LQWtFQ2EwSC8vd054SWdBa2lnSWdBQ09FQWtIL0FYRWpnd0pCL3dGeFFRaDBjaENFQVF3TkN4QjZFSkFCREEwTEk0b0NRUUpyUWYvL0EzRWlBQ1NLQWlBQUk0c0NFSVFCUVFBa2l3SU1Dd3NqaVFKQkIzWkJBWEZCQVVjTkNnd0hDeU9LQWlJQUVKMEJRZi8vQTNFa2l3SWdBRUVDYWtILy93TnhKSW9DREFrTEk0a0NRUWQyUVFGeFFRRkdEUWNNQ2dzUWVrSC9BWEVRcHdFaEFDT0xBa0VCYWtILy93TnhKSXNDSUFBUEN5T0pBa0VIZGtFQmNVRUJSdzBJSTRvQ1FRSnJRZi8vQTNFaUFDU0tBaUFBSTRzQ1FRSnFRZi8vQTNFUWhBRU1CUXNRZWhDUkFRd0dDeU9LQWtFQ2EwSC8vd054SWdBa2lnSWdBQ09MQWhDRUFVRUlKSXNDREFRTFFYOFBDeU9LQWlJQUVKMEJRZi8vQTNFa2l3SWdBRUVDYWtILy93TnhKSW9DUVF3UEN5T0tBa0VDYTBILy93TnhJZ0FraWdJZ0FDT0xBa0VDYWtILy93TnhFSVFCQ3hCN1FmLy9BM0VraXdJTFFRZ1BDeU9MQWtFQmFrSC8vd054SklzQ1FRUVBDeU9MQWtFQ2FrSC8vd054SklzQ1FRd0xxZ1FCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBRkhCRUFnQUVIUkFXc09Ed0VDRFFNRUJRWUhDQWtOQ2cwTERBMExJNGtDUVFSMlFRRnhEUThqaWdJaUFCQ2RBVUgvL3dOeEpJc0NJQUJCQW1wQi8vOERjU1NLQWtFTUR3c2ppZ0lpQUJDZEFVSC8vd054SVFFZ0FFRUNha0gvL3dOeEpJb0NJQUZCZ1A0RGNVRUlkU1NGQWlBQlFmOEJjU1NHQWtFRUR3c2ppUUpCQkhaQkFYRU5Dd3dNQ3lPSkFrRUVka0VCY1EwS0k0b0NRUUpyUWYvL0EzRWlBU1NLQWlBQkk0c0NRUUpxUWYvL0EzRVFoQUVNQ3dzamlnSkJBbXRCLy84RGNTSUJKSW9DSUFFamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJUWhBRU1Dd3NRZWhDVEFRd0xDeU9LQWtFQ2EwSC8vd054SWdFa2lnSWdBU09MQWhDRUFVRVFKSXNDREFrTEk0a0NRUVIyUVFGeFFRRkhEUWdqaWdJaUFSQ2RBVUgvL3dOeEpJc0NJQUZCQW1wQi8vOERjU1NLQWtFTUR3c2ppZ0lpQVJDZEFVSC8vd054SklzQ1FRRWtzUUVnQVVFQ2FrSC8vd054SklvQ0RBY0xJNGtDUVFSMlFRRnhRUUZHRFFVTUJBc2ppUUpCQkhaQkFYRkJBVWNOQXlPS0FrRUNhMEgvL3dOeElnRWtpZ0lnQVNPTEFrRUNha0gvL3dOeEVJUUJEQVFMRUhvUWxBRU1CUXNqaWdKQkFtdEIvLzhEY1NJQkpJb0NJQUVqaXdJUWhBRkJHQ1NMQWd3REMwRi9Ed3NqaXdKQkFtcEIvLzhEY1NTTEFrRU1Ed3NRZTBILy93TnhKSXNDQzBFSUR3c2ppd0pCQVdwQi8vOERjU1NMQWtFRUM1MERBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFGSEJFQWdBRUhoQVdzT0R3RUNDd3NEQkFVR0J3Z0xDd3NKQ2dzTEVIcEIvd0Z4UVlEK0Eyb2pnZ0lRZkF3TEN5T0tBaUlBRUowQlFmLy9BM0VoQVNBQVFRSnFRZi8vQTNFa2lnSWdBVUdBL2dOeFFRaDFKSWNDSUFGQi93RnhKSWdDUVFRUEN5T0VBa0dBL2dOcUk0SUNFSHhCQkE4TEk0b0NRUUpyUWYvL0EzRWlBU1NLQWlBQkk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUVJUUJRUWdQQ3hCNkVKWUJEQWNMSTRvQ1FRSnJRZi8vQTNFaUFTU0tBaUFCSTRzQ0VJUUJRU0FraXdKQkNBOExFSHBCR0hSQkdIVWhBU09LQWlBQlFRRVFoUUVqaWdJZ0FXcEIvLzhEY1NTS0FrRUFFSUFCUVFBUWdRRWppd0pCQVdwQi8vOERjU1NMQWtFTUR3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWtpd0pCQkE4TEVIdEIvLzhEY1NPQ0FoQjhJNHNDUVFKcVFmLy9BM0VraXdKQkJBOExFSG9RbHdFTUFnc2ppZ0pCQW10Qi8vOERjU0lCSklvQ0lBRWppd0lRaEFGQktDU0xBa0VJRHd0QmZ3OExJNHNDUVFGcVFmLy9BM0VraXdKQkJBdldBd0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCUndSQUlBQkI4UUZyRGc4QkFnTU5CQVVHQndnSkNnME5Dd3dOQ3hCNlFmOEJjVUdBL2dOcUVJWUJRZjhCY1NTQ0Fnd05DeU9LQWlJQUVKMEJRZi8vQTNFaEFTQUFRUUpxUWYvL0EzRWtpZ0lnQVVHQS9nTnhRUWgxSklJQ0lBRkIvd0Z4SklrQ0RBMExJNFFDUVlEK0Eyb1FoZ0ZCL3dGeEpJSUNEQXdMUVFBa3NBRU1Dd3NqaWdKQkFtdEIvLzhEY1NJQkpJb0NJQUVqaVFKQi93RnhJNElDUWY4QmNVRUlkSElRaEFGQkNBOExFSG9RbVFFTUNBc2ppZ0pCQW10Qi8vOERjU0lCSklvQ0lBRWppd0lRaEFGQk1DU0xBa0VJRHdzUWVrRVlkRUVZZFNFQkk0b0NJUUJCQUJDQUFVRUFFSUVCSUFBZ0FVRUJFSVVCSUFBZ0FXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2h3SWdBRUgvQVhFa2lBSWppd0pCQVdwQi8vOERjU1NMQWtFSUR3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWtpZ0pCQ0E4TEVIdEIvLzhEY1JDR0FVSC9BWEVrZ2dJaml3SkJBbXBCLy84RGNTU0xBZ3dGQzBFQkpMRUJEQVFMRUhvUW1nRU1BZ3NqaWdKQkFtdEIvLzhEY1NJQUpJb0NJQUFqaXdJUWhBRkJPQ1NMQWtFSUR3dEJmdzhMSTRzQ1FRRnFRZi8vQTNFa2l3SUxRUVFMNHdFQkFYOGppd0pCQVdwQi8vOERjU0VCSTQ4Q0JFQWdBVUVCYTBILy93TnhJUUVMSUFFa2l3SUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPRFFNRUJRWUhDQWtLQ3d3TkRnOEFDd3dQQ3lBQUVJY0JEd3NnQUJDSUFROExJQUFRaVFFUEN5QUFFSW9CRHdzZ0FCQ0xBUThMSUFBUWpBRVBDeUFBRUkwQkR3c2dBQkNPQVE4TElBQVFrZ0VQQ3lBQUVKVUJEd3NnQUJDWUFROExJQUFRbXdFUEN5QUFFS2dCRHdzZ0FCQ3BBUThMSUFBUXFnRVBDeUFBRUtzQkM3NEJBUUovUVFBa3NBRkJqLzRERUFKQkFTQUFkRUYvYzNFaUFTUzRBVUdQL2dNZ0FSQUZJNG9DUVFKclFmLy9BM0VraWdJamlnSWlBU09MQWlJQ1FmOEJjUkFGSUFGQkFXb2dBa0dBL2dOeFFRaDFFQVVDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdNREJBVUFDd3dGQzBFQUpMa0JRY0FBSklzQ0RBUUxRUUFrdWdGQnlBQWtpd0lNQXd0QkFDUzdBVUhRQUNTTEFnd0NDMEVBSkx3QlFkZ0FKSXNDREFFTFFRQWt2UUZCNEFBa2l3SUxDL2tCQVFOL0k3RUJCRUJCQVNTd0FVRUFKTEVCQ3lPeUFTTzRBWEZCSDNGQkFFb0VRQ09PQWtVanNBRWlBaUFDR3dSL0k3a0JJN01CSWdBZ0FCc0VmMEVBRUswQlFRRUZJN29CSTdRQklnQWdBQnNFZjBFQkVLMEJRUUVGSTdzQkk3VUJJZ0FnQUJzRWYwRUNFSzBCUVFFRkk3d0JJN1lCSWdBZ0FCc0VmMEVERUswQlFRRUZJNzBCSTdjQklnQWdBQnNFZjBFRUVLMEJRUUVGUVFBTEN3c0xDd1ZCQUFzRVFDT05BaUlBSTQ0Q0lBQWJCSDlCQUNTT0FrRUFKSTBDUVFBa2p3SkJBQ1NRQWtFWUJVRVVDeUVCQ3lPTkFpSUFJNDRDSUFBYkJFQkJBQ1NPQWtFQUpJMENRUUFrandKQkFDU1FBZ3NnQVE4TFFRQUx1d0VCQW45QkFTU2FBaU9QQWdSQUk0c0NFQUpCL3dGeEVLd0JFSGxCQUNTT0FrRUFKSTBDUVFBa2p3SkJBQ1NRQWdzUXJnRWlBRUVBU2dSQUlBQVFlUXRCQkNFQkk0MENJZ0FqamdJZ0FCdEZJZ0FFZnlPUUFrVUZJQUFMQkVBaml3SVFBa0gvQVhFUXJBRWhBUXNqaVFKQjhBRnhKSWtDSUFGQkFFd0VRQ0FCRHdzZ0FSQjVJNVlDUVFGcUlnQWpsQUpPQkg4amxRSkJBV29rbFFJZ0FDT1VBbXNGSUFBTEpKWUNJNHNDSTlZQlJnUkFRUUVrMlFFTElBRUxCUUFqcmdFTHpBRUJCSDhnQUVGL1FZQUlJQUJCQUVnYklBQkJBRW9iSVFOQkFDRUFBMEFDZndKL0lBUkZJZ0VFUUNBQVJTRUJDeUFCQ3dSQUlBSkZJUUVMSUFFTEJFQWoyUUZGSVFFTElBRUVRQkN2QVVFQVNBUkFRUUVoQkFVampBSkIwS1FFSTRFQ2RFNEVRRUVCSVFBRklBTkJmMG9pQVFSQUk2NEJJQU5PSVFFTFFRRWdBaUFCR3lFQ0N3c01BUXNMSUFBRVFDT01Ba0hRcEFRamdRSjBheVNNQWlPWEFnOExJQUlFUUNPWUFnOExJOWtCQkVCQkFDVFpBU09aQWc4TEk0c0NRUUZyUWYvL0EzRWtpd0pCZndzSEFFRi9FTEVCQ3prQkEzOERRQ0FDSUFCSUlnTUVmeUFCUVFCT0JTQURDd1JBUVg4UXNRRWhBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0ZBQ09SQWdzRkFDT1NBZ3NGQUNPVEFndGZBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FDSUJRUUZHRFFFQ1FDQUJRUUpyRGdZREJBVUdCd2dBQ3d3SUN5UExBUThMSTg0QkR3c2p6QUVQQ3lQTkFROExJODhCRHdzajBBRVBDeVBSQVE4TEk5SUJEd3RCQUF1TEFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFBaUFrRUJSZzBCQWtBZ0FrRUNhdzRHQXdRRkJnY0lBQXNNQ0FzZ0FVRUFSeVRMQVF3SEN5QUJRUUJISk00QkRBWUxJQUZCQUVja3pBRU1CUXNnQVVFQVJ5VE5BUXdFQ3lBQlFRQkhKTThCREFNTElBRkJBRWNrMEFFTUFnc2dBVUVBUnlUUkFRd0JDeUFCUVFCSEpOSUJDd3RWQVFGL1FRQWtrQUlnQUJDM0FVVUVRRUVCSVFFTElBQkJBUkM0QVNBQkJFQkJBVUVCUVFCQkFVRUFJQUJCQTB3YklnRWoxQUVpQUNBQUd4c2dBVVVqMVFFaUFDQUFHeHNFUUVFQkpMMEJRUVFRUFFzTEN3a0FJQUJCQUJDNEFRdWFBUUFnQUVFQVNnUkFRUUFRdVFFRlFRQVF1Z0VMSUFGQkFFb0VRRUVCRUxrQkJVRUJFTG9CQ3lBQ1FRQktCRUJCQWhDNUFRVkJBaEM2QVFzZ0EwRUFTZ1JBUVFNUXVRRUZRUU1RdWdFTElBUkJBRW9FUUVFRUVMa0JCVUVFRUxvQkN5QUZRUUJLQkVCQkJSQzVBUVZCQlJDNkFRc2dCa0VBU2dSQVFRWVF1UUVGUVFZUXVnRUxJQWRCQUVvRVFFRUhFTGtCQlVFSEVMb0JDd3NIQUNBQUpOWUJDd2NBUVg4azFnRUxCd0FnQUNUWEFRc0hBRUYvSk5jQkN3Y0FJQUFrMkFFTEJ3QkJmeVRZQVFzRkFDT0NBZ3NGQUNPREFnc0ZBQ09FQWdzRkFDT0ZBZ3NGQUNPR0Fnc0ZBQ09IQWdzRkFDT0lBZ3NGQUNPSkFnc0ZBQ09MQWdzRkFDT0tBZ3NMQUNPTEFoQUNRZjhCY1FzRkFDUG1BUXZCQXdFS2YwR0FnQUpCZ0pBQ0k5OEJHeUVKUVlDNEFrR0FzQUlqNEFFYklRb0RRQ0FHUVlBQ1NBUkFRUUFoQlFOQUlBVkJnQUpJQkVBZ0NTQUdRUU4xUVFWMElBcHFJQVZCQTNWcUlnTkJnSkIrYWkwQUFCQXdJUWdnQmtFSWJ5RUJRUWNnQlVFSWIyc2hCMEVBSVFJQ2Z5QUFRUUJLSTRBQ0lnUWdCQnNFUUNBRFFZRFFmbW90QUFBaEFnc2dBa0hBQUhFTEJFQkJCeUFCYXlFQkMwRUFJUVFnQVVFQmRDQUlhaUlEUVlDUWZtcEJBVUVBSUFKQkNIRWJJZ1JCQVhGQkRYUnFMUUFBSVFoQkFDRUJJQU5CZ1pCK2FpQUVRUUZ4UVExMGFpMEFBRUVCSUFkMGNRUkFRUUloQVFzZ0FVRUJhaUFCUVFFZ0IzUWdDSEViSVFFZ0JrRUlkQ0FGYWtFRGJDRUhJQUJCQUVvamdBSWlBeUFER3dSQUlBSkJCM0VnQVVFQUVERWlBVUVmY1VFRGRDRUVJQUZCNEFkeFFRVjFRUU4wSVFNZ0FVR0ErQUZ4UVFwMVFRTjBJUUlnQjBHQW9RdHFJZ0VnQkRvQUFDQUJRUUZxSUFNNkFBQWdBVUVDYWlBQ09nQUFCU0FIUVlDaEMyb2lBaUFCUWNmK0F4QXlJZ0ZCZ0lEOEIzRkJFSFU2QUFBZ0FrRUJhaUFCUVlEK0EzRkJDSFU2QUFBZ0FrRUNhaUFCT2dBQUN5QUZRUUZxSVFVTUFRc0xJQVpCQVdvaEJnd0JDd3NMM1FNQkRIOERRQ0FEUVJkT1JRUkFRUUFoQWdOQUlBSkJIMGdFUUVFQlFRQWdBa0VQU2hzaENTQURRUTlySUFNZ0EwRVBTaHRCQkhRaUJ5QUNRUTlyYWlBQ0lBZHFJQUpCRDBvYklRZEJnSkFDUVlDQUFpQURRUTlLR3lFTFFjZitBeUVLUVg4aEFVRi9JUWhCQUNFRUEwQWdCRUVJU0FSQVFRQWhBQU5BSUFCQkJVZ0VRQ0FBUVFOMElBUnFRUUowSWdWQmd2d0RhaEFDSUFkR0JFQWdCVUdEL0FOcUVBSWhCa0VCUVFBZ0JrRUljVUVBUnlPQUFpT0FBaHNiSUFsR0JFQkJDQ0VFUVFVaEFDQUdJZ2hCRUhFRWYwSEovZ01GUWNqK0F3c2hDZ3NMSUFCQkFXb2hBQXdCQ3dzZ0JFRUJhaUVFREFFTEN5QUlRUUJJSTRBQ0lnWWdCaHNFUUVHQXVBSkJnTEFDSStBQkd5RUVRWDhoQUVFQUlRRURRQ0FCUVNCSUJFQkJBQ0VGQTBBZ0JVRWdTQVJBSUFWQkJYUWdCR29nQVdvaUJrR0FrSDVxTFFBQUlBZEdCRUJCSUNFRklBWWhBRUVnSVFFTElBVkJBV29oQlF3QkN3c2dBVUVCYWlFQkRBRUxDeUFBUVFCT0JIOGdBRUdBMEg1cUxRQUFCVUYvQ3lFQkMwRUFJUUFEUUNBQVFRaElCRUFnQnlBTElBbEJBRUVISUFBZ0FrRURkQ0FEUVFOMElBQnFRZmdCUVlDaEZ5QUtJQUVnQ0JBekdpQUFRUUZxSVFBTUFRc0xJQUpCQVdvaEFnd0JDd3NnQTBFQmFpRUREQUVMQ3d1YUFnRUpmd05BSUFSQkNFNUZCRUJCQUNFQkEwQWdBVUVGU0FSQUlBRkJBM1FnQkdwQkFuUWlBRUdBL0FOcUVBSWFJQUJCZ2Z3RGFoQUNHaUFBUVlMOEEyb1FBaUVDUVFFaEJTUGhBUVJBSUFKQkFtOUJBVVlFUUNBQ1FRRnJJUUlMUVFJaEJRc2dBRUdEL0FOcUVBSWhCa0VBSVFkQkFVRUFJQVpCQ0hGQkFFY2pnQUlqZ0FJYkd5RUhRY2orQXlFSVFjbitBMEhJL2dNZ0JrRVFjUnNoQ0VFQUlRQURRQ0FBSUFWSUJFQkJBQ0VEQTBBZ0EwRUlTQVJBSUFBZ0FtcEJnSUFDSUFkQkFFRUhJQU1nQkVFRGRDQUJRUVIwSUFOcUlBQkJBM1JxUWNBQVFZQ2hJQ0FJUVg4Z0JoQXpHaUFEUVFGcUlRTU1BUXNMSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN5QUVRUUZxSVFRTUFRc0xDd1VBSTc4QkN3VUFJOEFCQ3dVQUk4TUJDeGdCQVg4anhRRWhBQ1BFQVFSQUlBQkJCSEloQUFzZ0FBc3dBUUYvQTBBQ1FDQUFRZi8vQTA0TkFDQUFRWUNoeVFScUlBQVFXVG9BQUNBQVFRRnFJUUFNQVFzTFFRQWsyUUVMRmdBUUFEOEFRWlFCU0FSQVFaUUJQd0JyUUFBYUN3c0RBQUVMSFFBQ1FBSkFBa0FqbXdJT0FnRUNBQXNBQzBFQUlRQUxJQUFRc1FFTEJ3QWdBQ1NiQWdzbEFBSkFBa0FDUUFKQUk1c0NEZ01CQWdNQUN3QUxRUUVoQUF0QmZ5RUJDeUFCRUxFQkN3QXpFSE52ZFhKalpVMWhjSEJwYm1kVlVrd2hZMjl5WlM5a2FYTjBMMk52Y21VdWRXNTBiM1ZqYUdWa0xuZGhjMjB1YldGdyIpOgphd2FpdCBOKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmhnRVJZQUFBWUFwL2YzOS9mMzkvZjM5L0FHQUJmd0YvWUFKL2Z3QmdBWDhBWUFKL2Z3Ri9ZQUFCZjJBRGYzOS9BR0FHZjM5L2YzOS9BR0FIZjM5L2YzOS9md0YvWUFOL2YzOEJmMkFIZjM5L2YzOS9md0JnQkg5L2YzOEJmMkFJZjM5L2YzOS9mMzhBWUFWL2YzOS9md0YvWUExL2YzOS9mMzkvZjM5L2YzOS9BWDlnQVg4QmZ3UGRBZHNCQUFJQ0FBQURBQVFFQUFBQUFBQUFBQUFBQkFRQUFBQUJCZ0FBQUFBQUFBQUFCQVFBQUFBQUFBQUFBQVlHQmdZT0JRb0ZEd2tMQ0FnSEF3UUFBQVFBQUFBQUFBUUFBQUFBQUFJQ0JRSUNBZ0lGREFRRUJBQUNCZ0lDQXdRRUJBUUFBQUFBQkFVRUJnWUVBd0lGQkFBQUJBVURCd0FGQUFRQUJBUUdCZ01GQkFNRUJBUURBd2NDQWdJQ0FnSUNBZ0lEQkFRQ0JBUUNCQVFDQkFRQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJRUJnWUdFQVlDQmdZR0FnTUVCQTBFQUFRQUJBQUdCZ1lHQmdZR0JnWUdCZ1lFQUFBR0JnWUdBQUFBQWdRRkJBUUJjQUFCQlFNQkFBQUdoUXljQW44QVFRQUxmd0JCZ0FnTGZ3QkJnQWdMZndCQmdBZ0xmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FFQXQvQUVHQWdBUUxmd0JCZ0pBRUMzOEFRWUFCQzM4QVFZQ1JCQXQvQUVHQXVBRUxmd0JCZ01rRkMzOEFRWURZQlF0L0FFR0FvUXNMZndCQmdJQU1DMzhBUVlDaEZ3dC9BRUdBZ0FrTGZ3QkJnS0VnQzM4QVFZRDRBQXQvQUVHQWtBUUxmd0JCZ0lrZEMzOEFRWUNaSVF0L0FFR0FnQWdMZndCQmdKa3BDMzhBUVlDQUNBdC9BRUdBbVRFTGZ3QkJnSUFJQzM4QVFZQ1pPUXQvQUVHQWdBZ0xmd0JCZ0puQkFBdC9BRUdBZ0FnTGZ3QkJnSm5KQUF0L0FFR0FnQWdMZndCQmdKblJBQXQvQUVHQWlQZ0RDMzhBUVlDaHlRUUxmd0JCLy84REMzOEFRUUFMZndCQmdLSE5CQXQvQUVHVUFRdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWVqK0F3dC9BVUhwL2dNTGZ3RkI2LzREQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSC9BQXQvQVVIL0FBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQmdQY0NDMzhCUVFBTGZ3RkJBQXQvQVVHQWdBZ0xmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVg4TGZ3RkJmd3QvQVVGL0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZEgrQXd0L0FVSFMvZ01MZndGQjAvNERDMzhCUWRUK0F3dC9BVUhWL2dNTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFjLytBd3QvQVVIdy9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUlMZndGQkFBdC9BVUVBQ3dlWEVGOEdiV1Z0YjNKNUFnQUZkR0ZpYkdVQkFBWmpiMjVtYVdjQUZ3NW9ZWE5EYjNKbFUzUmhjblJsWkFBWUNYTmhkbVZUZEdGMFpRQWZDV3h2WVdSVGRHRjBaUUFxQldselIwSkRBQ3NTWjJWMFUzUmxjSE5RWlhKVGRHVndVMlYwQUN3TFoyVjBVM1JsY0ZObGRITUFMUWhuWlhSVGRHVndjd0F1RldWNFpXTjFkR1ZOZFd4MGFYQnNaVVp5WVcxbGN3Q3pBUXhsZUdWamRYUmxSbkpoYldVQXNnRUlYM05sZEdGeVoyTUEyUUVaWlhobFkzVjBaVVp5WVcxbFFXNWtRMmhsWTJ0QmRXUnBid0RZQVJWbGVHVmpkWFJsVlc1MGFXeERiMjVrYVhScGIyNEEyZ0VMWlhobFkzVjBaVk4wWlhBQXJ3RVVaMlYwUTNsamJHVnpVR1Z5UTNsamJHVlRaWFFBdEFFTVoyVjBRM2xqYkdWVFpYUnpBTFVCQ1dkbGRFTjVZMnhsY3dDMkFRNXpaWFJLYjNsd1lXUlRkR0YwWlFDN0FSOW5aWFJPZFcxaVpYSlBabE5oYlhCc1pYTkpia0YxWkdsdlFuVm1abVZ5QUxBQkVHTnNaV0Z5UVhWa2FXOUNkV1ptWlhJQUpoeHpaWFJOWVc1MVlXeERiMnh2Y21sNllYUnBiMjVRWVd4bGRIUmxBQWNYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERLaE5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXlzU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF5d2VRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdBYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREFSWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdJU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3TWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RENoeEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd3NTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdRT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQlJGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNR0RWZFBVa3RmVWtGTlgxTkpXa1VEQnlaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTUlJazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURDUmhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNERHQlJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNWkZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9Bd3dRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1OR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01PRkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF3OE9SbEpCVFVWZlRFOURRVlJKVDA0REVBcEdVa0ZOUlY5VFNWcEZBeEVYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERFaE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhNU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4UU9WRWxNUlY5RVFWUkJYMU5KV2tVREZSSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERGZzVQUVUxZlZFbE1SVk5mVTBsYVJRTVhGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNaUVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF5TVpRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWFGVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZVMGxhUlFNYkdVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlRFOURRVlJKVDA0REhCVkRTRUZPVGtWTVh6SmZRbFZHUmtWU1gxTkpXa1VESFJsRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXg0VlEwaEJUazVGVEY4elgwSlZSa1pGVWw5VFNWcEZBeDhaUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01nRlVOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVTBsYVJRTWhGa05CVWxSU1NVUkhSVjlTUVUxZlRFOURRVlJKVDA0REpCSkRRVkpVVWtsRVIwVmZVa0ZOWDFOSldrVURKUlpEUVZKVVVrbEVSMFZmVWs5TlgweFBRMEZVU1U5T0F5WVNRMEZTVkZKSlJFZEZYMUpQVFY5VFNWcEZBeWNkUkVWQ1ZVZGZSMEZOUlVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0REtCbEVSVUpWUjE5SFFVMUZRazlaWDAxRlRVOVNXVjlUU1ZwRkF5a2haMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBRWJjMlYwVUhKdlozSmhiVU52ZFc1MFpYSkNjbVZoYTNCdmFXNTBBTHdCSFhKbGMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFMMEJHWE5sZEZKbFlXUkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUF2Z0ViY21WelpYUlNaV0ZrUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUw4QkduTmxkRmR5YVhSbFIySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFNQUJISEpsYzJWMFYzSnBkR1ZIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBd1FFTVoyVjBVbVZuYVhOMFpYSkJBTUlCREdkbGRGSmxaMmx6ZEdWeVFnRERBUXhuWlhSU1pXZHBjM1JsY2tNQXhBRU1aMlYwVW1WbmFYTjBaWEpFQU1VQkRHZGxkRkpsWjJsemRHVnlSUURHQVF4blpYUlNaV2RwYzNSbGNrZ0F4d0VNWjJWMFVtVm5hWE4wWlhKTUFNZ0JER2RsZEZKbFoybHpkR1Z5UmdESkFSRm5aWFJRY205bmNtRnRRMjkxYm5SbGNnREtBUTluWlhSVGRHRmphMUJ2YVc1MFpYSUF5d0VaWjJWMFQzQmpiMlJsUVhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0RNQVFWblpYUk1XUUROQVIxa2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVRRE9BUmhrY21GM1ZHbHNaVVJoZEdGVWIxZGhjMjFOWlcxdmNua0F6d0VUWkhKaGQwOWhiVlJ2VjJGemJVMWxiVzl5ZVFEUUFRWm5aWFJFU1ZZQTBRRUhaMlYwVkVsTlFRRFNBUVpuWlhSVVRVRUEwd0VHWjJWMFZFRkRBTlFCRTNWd1pHRjBaVVJsWW5WblIwSk5aVzF2Y25rQTFRRUlBdFlCQ1FnQkFFRUFDd0hYQVFyLzR3SGJBVk1BUWZMbHl3Y2tOMEdnd1lJRkpEaEIyTERoQWlRNVFZaVFJQ1E2UWZMbHl3Y2tPMEdnd1lJRkpEeEIyTERoQWlROVFZaVFJQ1ErUWZMbHl3Y2tQMEdnd1lJRkpFQkIyTERoQWlSQlFZaVFJQ1JDQzlVQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBZ0FFRU1kU0lCUlEwQUFrQWdBVUVCYXc0TkFRRUJBZ0lDQWdNREJBUUZCZ0FMREFZTElBQkJnSm5SQUdvUEN5QUFRUUVqNndFaUFTUHpBVVVpQUFSL0lBRkZCU0FBQ3h0QkRuUnFRWUNaMEFCcUR3c2dBRUdBa0g1cUk0QUNCSDhqL2dFUUFrRUJjUVZCQUF0QkRYUnFEd3NnQUNQc0FVRU5kR3BCZ05uR0FHb1BDeUFBUVlDUWZtb1BDMEVBSVFFQ2Z5T0FBZ1JBSS84QkVBSkJCM0VoQVFzZ0FVRUJTQXNFZjBFQkJTQUJDMEVNZENBQWFrR0E4SDFxRHdzZ0FFR0FVR29MQ1FBZ0FCQUJMUUFBQzd3QkFFRUFKSUVDUVFBa2dnSkJBQ1NEQWtFQUpJUUNRUUFraFFKQkFDU0dBa0VBSkljQ1FRQWtpQUpCQUNTSkFrRUFKSW9DUVFBa2l3SkJBQ1NNQWtFQUpJMENRUUFramdKQkFDU1BBa0VBSkpBQ0k0QUNCRUJCRVNTQ0FrR0FBU1NKQWtFQUpJTUNRUUFraEFKQi93RWtoUUpCMWdBa2hnSkJBQ1NIQWtFTkpJZ0NCVUVCSklJQ1FiQUJKSWtDUVFBa2d3SkJFeVNFQWtFQUpJVUNRZGdCSklZQ1FRRWtod0pCelFBa2lBSUxRWUFDSklzQ1FmNy9BeVNLQWd0N0FRSi9RUUFrN1FGQkFTVHVBVUhIQWhBQ0lnRkZKTzhCSUFGQkFVNGlBQVJBSUFGQkEwd2hBQXNnQUNUd0FTQUJRUVZPSWdBRVFDQUJRUVpNSVFBTElBQWs4UUVnQVVFUFRpSUFCRUFnQVVFVFRDRUFDeUFBSlBJQklBRkJHVTRpQUFSQUlBRkJIa3doQUFzZ0FDVHpBVUVCSk9zQlFRQWs3QUVMQ3dBZ0FCQUJJQUU2QUFBTEx3QkIwZjREUWY4QkVBVkIwdjREUWY4QkVBVkIwLzREUWY4QkVBVkIxUDREUWY4QkVBVkIxZjREUWY4QkVBVUx0QWdCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBQ0lCUVFGR0RRRUNRQ0FCUVFKckRnc0RCQVVHQndnSkNnc01EUUFMREEwTFFmTGx5d2NrTjBHZ3dZSUZKRGhCMkxEaEFpUTVRWWlRSUNRNlFmTGx5d2NrTzBHZ3dZSUZKRHhCMkxEaEFpUTlRWWlRSUNRK1FmTGx5d2NrUDBHZ3dZSUZKRUJCMkxEaEFpUkJRWWlRSUNSQ0RBd0xRZi8vL3dja04wSGoydjRISkRoQmdPS1FCQ1E1UVFBa09rSC8vLzhISkR0QjQ5citCeVE4UVlEaWtBUWtQVUVBSkQ1Qi8vLy9CeVEvUWVQYS9nY2tRRUdBNHBBRUpFRkJBQ1JDREFzTFFmLy8vd2NrTjBHRWlmNEhKRGhCdXZUUUJDUTVRUUFrT2tILy8vOEhKRHRCc2Y3dkF5UThRWUNJQWlROVFRQWtQa0gvLy84SEpEOUIvOHVPQXlSQVFmOEJKRUZCQUNSQ0RBb0xRY1hOL3dja04wR0V1Ym9HSkRoQnFkYVJCQ1E1UVlqaTZBSWtPa0gvLy84SEpEdEI0OXIrQnlROFFZRGlrQVFrUFVFQUpENUIvLy8vQnlRL1FlUGEvZ2NrUUVHQTRwQUVKRUZCQUNSQ0RBa0xRZi8vL3dja04wR0Evc3NDSkRoQmdJVDlCeVE1UVFBa09rSC8vLzhISkR0QmdQN0xBaVE4UVlDRS9RY2tQVUVBSkQ1Qi8vLy9CeVEvUVlEK3l3SWtRRUdBaFAwSEpFRkJBQ1JDREFnTFFmLy8vd2NrTjBHeC91OERKRGhCeGNjQkpEbEJBQ1E2UWYvLy93Y2tPMEdFaWY0SEpEeEJ1dlRRQkNROVFRQWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSU1Cd3RCQUNRM1FZU0pBaVE0UVlDOC93Y2tPVUgvLy84SEpEcEJBQ1E3UVlTSkFpUThRWUM4L3dja1BVSC8vLzhISkQ1QkFDUS9RWVNKQWlSQVFZQzgvd2NrUVVILy8vOEhKRUlNQmd0QnBmLy9CeVEzUVpTcC9nY2tPRUgvcWRJRUpEbEJBQ1E2UWFYLy93Y2tPMEdVcWY0SEpEeEIvNm5TQkNROVFRQWtQa0dsLy84SEpEOUJsS24rQnlSQVFmK3AwZ1FrUVVFQUpFSU1CUXRCLy8vL0J5UTNRWUQrL3dja09FR0FnUHdISkRsQkFDUTZRZi8vL3dja08wR0EvdjhISkR4QmdJRDhCeVE5UVFBa1BrSC8vLzhISkQ5QmdQNy9CeVJBUVlDQS9BY2tRVUVBSkVJTUJBdEIvLy8vQnlRM1FZRCsvd2NrT0VHQWxPMERKRGxCQUNRNlFmLy8vd2NrTzBIL3k0NERKRHhCL3dFa1BVRUFKRDVCLy8vL0J5US9RYkgrN3dNa1FFR0FpQUlrUVVFQUpFSU1Bd3RCLy8vL0J5UTNRZi9MamdNa09FSC9BU1E1UVFBa09rSC8vLzhISkR0QmhJbitCeVE4UWJyMDBBUWtQVUVBSkQ1Qi8vLy9CeVEvUWJIKzd3TWtRRUdBaUFJa1FVRUFKRUlNQWd0Qi8vLy9CeVEzUWQ2WnNnUWtPRUdNcGNrQ0pEbEJBQ1E2UWYvLy93Y2tPMEdFaWY0SEpEeEJ1dlRRQkNROVFRQWtQa0gvLy84SEpEOUI0OXIrQnlSQVFZRGlrQVFrUVVFQUpFSU1BUXRCLy8vL0J5UTNRYVhMbGdVa09FSFNwTWtDSkRsQkFDUTZRZi8vL3dja08wR2x5NVlGSkR4QjBxVEpBaVE5UVFBa1BrSC8vLzhISkQ5QnBjdVdCU1JBUWRLa3lRSWtRVUVBSkVJTEM5NElBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCaUFGSEJFQWdBQ0lCUWVFQVJnMEJJQUZCRkVZTkFpQUJRY1lBUmcwRElBRkIyUUJHRFFRZ0FVSEdBVVlOQkNBQlFZWUJSZzBGSUFGQnFBRkdEUVVnQVVHL0FVWU5CaUFCUWM0QlJnMEdJQUZCMFFGR0RRWWdBVUh3QVVZTkJpQUJRU2RHRFFjZ0FVSEpBRVlOQnlBQlFkd0FSZzBISUFGQnN3RkdEUWNnQVVISkFVWU5DQ0FCUWZBQVJnMEpJQUZCeGdCR0RRb2dBVUhUQVVZTkN3d01DMEgvdVpZRkpEZEJnUDcvQnlRNFFZREdBU1E1UVFBa09rSC91WllGSkR0QmdQNy9CeVE4UVlER0FTUTlRUUFrUGtIL3VaWUZKRDlCZ1A3L0J5UkFRWURHQVNSQlFRQWtRZ3dMQzBILy8vOEhKRGRCLzh1T0F5UTRRZjhCSkRsQkFDUTZRZi8vL3dja08wR0VpZjRISkR4QnV2VFFCQ1E5UVFBa1BrSC8vLzhISkQ5Qi84dU9BeVJBUWY4QkpFRkJBQ1JDREFvTFFmLy8vd2NrTjBHRWlmNEhKRGhCdXZUUUJDUTVRUUFrT2tILy8vOEhKRHRCc2Y3dkF5UThRWUNJQWlROVFRQWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSU1DUXRCLyt2V0JTUTNRWlQvL3dja09FSEN0TFVGSkRsQkFDUTZRUUFrTzBILy8vOEhKRHhCaEluK0J5UTlRYnIwMEFRa1BrRUFKRDlCLy8vL0J5UkFRWVNKL2dja1FVRzY5TkFFSkVJTUNBdEIvLy8vQnlRM1FZVGJ0Z1VrT0VINzVva0NKRGxCQUNRNlFmLy8vd2NrTzBHQTV2MEhKRHhCZ0lUUkJDUTlRUUFrUGtILy8vOEhKRDlCLy92cUFpUkFRWUNBL0Fja1FVSC9BU1JDREFjTFFaei8vd2NrTjBILzY5SUVKRGhCODZpT0F5UTVRYnIwQUNRNlFjS0svd2NrTzBHQXJQOEhKRHhCZ1BUUUJDUTlRWUNBcUFJa1BrSC8vLzhISkQ5QmhJbitCeVJBUWJyMDBBUWtRVUVBSkVJTUJndEJnUDZ2QXlRM1FmLy8vd2NrT0VIS3BQMEhKRGxCQUNRNlFmLy8vd2NrTzBILy8vOEhKRHhCLzh1T0F5UTlRZjhCSkQ1Qi8vLy9CeVEvUWVQYS9nY2tRRUdBNHBBRUpFRkJBQ1JDREFVTFFmKzVsZ1VrTjBHQS92OEhKRGhCZ01ZQkpEbEJBQ1E2UWRMRy9RY2tPMEdBZ05nR0pEeEJnSUNNQXlROVFRQWtQa0gvQVNRL1FmLy8vd2NrUUVINy92OEhKRUZCLzRrQ0pFSU1CQXRCenYvL0J5UTNRZS9mandNa09FR3hpUElFSkRsQjJyVHBBaVE2UWYvLy93Y2tPMEdBNXYwSEpEeEJnSVRSQkNROVFRQWtQa0gvLy84SEpEOUIvOHVPQXlSQVFmOEJKRUZCQUNSQ0RBTUxRZi8vL3dja04wR0VpZjRISkRoQnV2VFFCQ1E1UVFBa09rSC8vLzhISkR0QmdQNERKRHhCZ0lqR0FTUTlRWUNVQVNRK1FmLy8vd2NrUDBIL3k0NERKRUJCL3dFa1FVRUFKRUlNQWd0Qi8vLy9CeVEzUWYvTGpnTWtPRUgvQVNRNVFRQWtPa0dBL3Y4SEpEdEJnSUQ4QnlROFFZQ0FqQU1rUFVFQUpENUIvLy8vQnlRL1FiSCs3d01rUUVHQWlBSWtRVUVBSkVJTUFRdEIvLy8vQnlRM1FZVGJ0Z1VrT0VINzVva0NKRGxCQUNRNlFmLy8vd2NrTzBIajJ2NEhKRHhCNDlyK0J5UTlRUUFrUGtILy8vOEhKRDlCLzh1T0F5UkFRZjhCSkVGQkFDUkNDd3MxQVFKL1FRQVFCMEcwQWlFQUEwQUNRQ0FBUWNNQ1NnMEFJQUFRQWlBQmFpRUJJQUJCQVdvaEFBd0JDd3NnQVVIL0FYRVFDQXVlQVFCQkFDVGtBVUVBSk9VQlFRQWs1Z0ZCQUNUbkFVRUFKT2dCUVFBazZRRkJBQ1RxQVVHUUFTVG1BU09BQWdSQVFjRCtBMEdSQVJBRlFjSCtBMEdCQVJBRlFjVCtBMEdRQVJBRlFjZitBMEg4QVJBRkJVSEEvZ05Ca1FFUUJVSEIvZ05CaFFFUUJVSEcvZ05CL3dFUUJVSEgvZ05CL0FFUUJVSEkvZ05CL3dFUUJVSEovZ05CL3dFUUJRdEJ6LzREUVFBUUJVSHcvZ05CQVJBRkVBa0xVQUFqZ0FJRVFFSG8vZ05Cd0FFUUJVSHAvZ05CL3dFUUJVSHEvZ05Cd1FFUUJVSHIvZ05CRFJBRkJVSG8vZ05CL3dFUUJVSHAvZ05CL3dFUUJVSHEvZ05CL3dFUUJVSHIvZ05CL3dFUUJRc0xMd0JCa1A0RFFZQUJFQVZCa2Y0RFFiOEJFQVZCa3Y0RFFmTUJFQVZCay80RFFjRUJFQVZCbFA0RFFiOEJFQVVMTEFCQmxmNERRZjhCRUFWQmx2NERRVDhRQlVHWC9nTkJBQkFGUVpqK0EwRUFFQVZCbWY0RFFiZ0JFQVVMTWdCQm12NERRZjhBRUFWQm0vNERRZjhCRUFWQm5QNERRWjhCRUFWQm5mNERRUUFRQlVHZS9nTkJ1QUVRQlVFQkpIOExMUUJCbi80RFFmOEJFQVZCb1A0RFFmOEJFQVZCb2Y0RFFRQVFCVUdpL2dOQkFCQUZRYVArQTBHL0FSQUZDMFVBUVE4a2tRRkJEeVNTQVVFUEpKTUJRUThrbEFGQkFDU1ZBVUVBSkpZQlFRQWtsd0ZCQUNTWUFVSC9BQ1NaQVVIL0FDU2FBVUVCSkpzQlFRRWtuQUZCQUNTZEFRdDNBRUVBSko0QlFRQWtud0ZCQUNTZ0FVRUJKS0VCUVFFa29nRkJBU1NqQVVFQkpLUUJRUUVrcFFGQkFTU21BVUVCSktjQlFRRWtxQUZCQVNTcEFVRUFKS29CUVFBa3F3RkJBQ1N0QVVFQUpLNEJFQXdRRFJBT0VBOUJwUDREUWZjQUVBVkJwZjREUWZNQkVBVkJwdjREUWZFQkVBVVFFQXMrQUNBQVFRRnhRUUJISkxNQklBQkJBbkZCQUVja3RBRWdBRUVFY1VFQVJ5UzFBU0FBUVFoeFFRQkhKTFlCSUFCQkVIRkJBRWNrdHdFZ0FDU3lBUXMrQUNBQVFRRnhRUUJISkxrQklBQkJBbkZCQUVja3VnRWdBRUVFY1VFQVJ5UzdBU0FBUVFoeFFRQkhKTHdCSUFCQkVIRkJBRWNrdlFFZ0FDUzRBUXRlQUVFQUpMNEJRUUFrdndGQkFDVEFBVUVBSk1NQlFRQWt4QUZCQUNURkFVRUFKTUVCUVFBa3dnRWpnQUlFUUVHRS9nTkJIaEFGUWFBOUpMOEJCVUdFL2dOQnF3RVFCVUhNMXdJa3Z3RUxRWWYrQTBINEFSQUZRZmdCSk1VQkMwTUFRUUFreGdGQkFDVEhBU09BQWdSQVFZTCtBMEg4QUJBRlFRQWt5QUZCQUNUSkFVRUFKTW9CQlVHQy9nTkIvZ0FRQlVFQUpNZ0JRUUVreVFGQkFDVEtBUXNMK3dFQkFuOUJ3d0lRQWlJQlFjQUJSaUlBQkg4Z0FBVWdBVUdBQVVZakxpSUFJQUFiQ3dSQVFRRWtnQUlGUVFBa2dBSUxFQU1RQkJBR0VBb1FDeEFSUVFBUUVrSC8vd01qc2dFUUJVSGhBUkFUUVkvK0F5TzRBUkFGRUJRUUZTT0FBZ1JBUWZEK0EwSDRBUkFGUWMvK0EwSCtBUkFGUWMzK0EwSCtBQkFGUVlEK0EwSFBBUkFGUVkvK0EwSGhBUkFGUWV6K0EwSCtBUkFGUWZYK0EwR1BBUkFGQlVIdy9nTkIvd0VRQlVIUC9nTkIvd0VRQlVITi9nTkIvd0VRQlVHQS9nTkJ6d0VRQlVHUC9nTkI0UUVRQlF0QkFDU2FBa0dBcU5hNUJ5U1JBa0VBSkpJQ1FRQWtrd0pCZ0tqV3VRY2tsQUpCQUNTVkFrRUFKSllDQzBvQUlBQkJBRW9rTFNBQlFRQktKQzRnQWtFQVNpUXZJQU5CQUVva01DQUVRUUJLSkRFZ0JVRUFTaVF5SUFaQkFFb2tNeUFIUVFCS0pEUWdDRUVBU2lRMUlBbEJBRW9rTmhBV0N3VUFJNW9DQzVVQkFFR0FDQ09DQWpvQUFFR0JDQ09EQWpvQUFFR0NDQ09FQWpvQUFFR0RDQ09GQWpvQUFFR0VDQ09HQWpvQUFFR0ZDQ09IQWpvQUFFR0dDQ09JQWpvQUFFR0hDQ09KQWpvQUFFR0lDQ09LQWpzQkFFR0tDQ09MQWpzQkFFR01DQ09NQWpZQ0FFR1JDQ09OQWtFQVJ6b0FBRUdTQ0NPT0FrRUFSem9BQUVHVENDT1BBa0VBUnpvQUFFR1VDQ09RQWtFQVJ6b0FBQXRvQUVISUNTUHJBVHNCQUVIS0NTUHNBVHNCQUVITUNTUHRBVUVBUnpvQUFFSE5DU1B1QVVFQVJ6b0FBRUhPQ1NQdkFVRUFSem9BQUVIUENTUHdBVUVBUnpvQUFFSFFDU1B4QVVFQVJ6b0FBRUhSQ1NQeUFVRUFSem9BQUVIU0NTUHpBVUVBUnpvQUFBczFBRUg2Q1NPK0FUWUNBRUgrQ1NPL0FUWUNBRUdDQ2lQQkFVRUFSem9BQUVHRkNpUENBVUVBUnpvQUFFR0YvZ01qd0FFUUJRdFlBRUhlQ2lOVVFRQkhPZ0FBUWQ4S0kxYzJBZ0JCNHdvaldEWUNBRUhuQ2lOWk5nSUFRZXdLSTFvMkFnQkI4UW9qV3pvQUFFSHlDaU5jT2dBQVFmY0tJMTFCQUVjNkFBQkIrQW9qWGpZQ0FFSDlDaU5mT3dFQUN6MEFRWkFMSTJsQkFFYzZBQUJCa1FzamJEWUNBRUdWQ3lOdE5nSUFRWmtMSTI0MkFnQkJuZ3NqYnpZQ0FFR2pDeU53T2dBQVFhUUxJM0U2QUFBTE93QkI5QXNqaVFGQkFFYzZBQUJCOVFzaml3RTJBZ0JCK1FzampBRTJBZ0JCL1FzampRRTJBZ0JCZ2d3ampnRTJBZ0JCaHd3amtBRTdBUUFMaEFFQUVCbEJzZ2dqNVFFMkFnQkJ0Z2dqMmdFNkFBQkJ4UDRESStZQkVBVkI1QWdqc0FGQkFFYzZBQUJCNVFnanNRRkJBRWM2QUFBUUdoQWJRYXdLSTZvQk5nSUFRYkFLSTZzQk9nQUFRYkVLSTYwQk9nQUFFQndRSFVIQ0N5TjRRUUJIT2dBQVFjTUxJM3MyQWdCQnh3c2pmRFlDQUVITEN5TjlPd0VBRUI1QkFDU2FBZ3VWQVFCQmdBZ3RBQUFrZ2dKQmdRZ3RBQUFrZ3dKQmdnZ3RBQUFraEFKQmd3Z3RBQUFraFFKQmhBZ3RBQUFraGdKQmhRZ3RBQUFraHdKQmhnZ3RBQUFraUFKQmh3Z3RBQUFraVFKQmlBZ3ZBUUFraWdKQmlnZ3ZBUUFraXdKQmpBZ29BZ0FrakFKQmtRZ3RBQUJCQUVva2pRSkJrZ2d0QUFCQkFFb2tqZ0pCa3dndEFBQkJBRW9randKQmxBZ3RBQUJCQUVva2tBSUxYZ0VCZjBFQUpPVUJRUUFrNWdGQnhQNERRUUFRQlVIQi9nTVFBa0Y4Y1NFQlFRQWsyZ0ZCd2Y0RElBRVFCU0FBQkVBQ1FFRUFJUUFEUUNBQVFZRFlCVTROQVNBQVFZREpCV3BCL3dFNkFBQWdBRUVCYWlFQURBQUFDd0FMQ3d1SUFRRUJmeVBjQVNFQklBQkJnQUZ4UVFCSEpOd0JJQUJCd0FCeFFRQkhKTjBCSUFCQklIRkJBRWNrM2dFZ0FFRVFjVUVBUnlUZkFTQUFRUWh4UVFCSEpPQUJJQUJCQkhGQkFFY2s0UUVnQUVFQ2NVRUFSeVRpQVNBQVFRRnhRUUJISk9NQkk5d0JSU0FCSUFFYkJFQkJBUkFoQ3lBQlJTSUFCSDhqM0FFRklBQUxCRUJCQUJBaEN3c3FBRUhrQ0MwQUFFRUFTaVN3QVVIbENDMEFBRUVBU2lTeEFVSC8vd01RQWhBU1FZLytBeEFDRUJNTGFBQkJ5QWt2QVFBazZ3RkJ5Z2t2QVFBazdBRkJ6QWt0QUFCQkFFb2s3UUZCelFrdEFBQkJBRW9rN2dGQnpna3RBQUJCQUVvazd3RkJ6d2t0QUFCQkFFb2s4QUZCMEFrdEFBQkJBRW9rOFFGQjBRa3RBQUJCQUVvazhnRkIwZ2t0QUFCQkFFb2s4d0VMUndCQitna29BZ0FrdmdGQi9na29BZ0FrdndGQmdnb3RBQUJCQUVva3dRRkJoUW90QUFCQkFFb2t3Z0ZCaGY0REVBSWt3QUZCaHY0REVBSWt3d0ZCaC80REVBSWt4UUVMQndCQkFDU3VBUXRZQUVIZUNpMEFBRUVBU2lSVVFkOEtLQUlBSkZkQjR3b29BZ0FrV0VIbkNpZ0NBQ1JaUWV3S0tBSUFKRnBCOFFvdEFBQWtXMEh5Q2kwQUFDUmNRZmNLTFFBQVFRQktKRjFCK0Fvb0FnQWtYa0g5Q2k4QkFDUmZDejBBUVpBTExRQUFRUUJLSkdsQmtRc29BZ0FrYkVHVkN5Z0NBQ1J0UVprTEtBSUFKRzVCbmdzb0FnQWtiMEdqQ3kwQUFDUndRYVFMTFFBQUpIRUxPd0JCOUFzdEFBQkJBRW9raVFGQjlRc29BZ0FraXdGQitRc29BZ0FrakFGQi9Rc29BZ0FralFGQmdnd29BZ0FramdGQmh3d3ZBUUFra0FFTHlRRUJBWDhRSUVHeUNDZ0NBQ1RsQVVHMkNDMEFBQ1RhQVVIRS9nTVFBaVRtQVVIQS9nTVFBaEFpRUNOQmdQNERFQUpCL3dGekpOTUJJOU1CSWdCQkVIRkJBRWNrMUFFZ0FFRWdjVUVBUnlUVkFSQWtFQ1ZCckFvb0FnQWtxZ0ZCc0FvdEFBQWtxd0ZCc1FvdEFBQWtyUUZCQUNTdUFSQW5FQ2hCd2dzdEFBQkJBRW9rZUVIREN5Z0NBQ1I3UWNjTEtBSUFKSHhCeXdzdkFRQWtmUkFwUVFBa21nSkJnS2pXdVFja2tRSkJBQ1NTQWtFQUpKTUNRWUNvMXJrSEpKUUNRUUFrbFFKQkFDU1dBZ3NGQUNPQUFnc0ZBQ09VQWdzRkFDT1ZBZ3NGQUNPV0FndkZBZ0VGZnlOSElRWUNmd0ovSUFGQkFFb2lCUVJBSUFCQkNFb2hCUXNnQlFzRVFDTkdJQVJHSVFVTElBVUxCSDhnQUNBR1JnVWdCUXNFUUNBRFFRRnJFQUpCSUhGQkFFY2hCU0FERUFKQklIRkJBRWNoQ0VFQUlRTURRQ0FEUVFoSUJFQkJCeUFEYXlBRElBVWdDRWNiSWdNZ0FHb2lCRUdnQVV3RVFDQUJRYUFCYkNBRWFrRURiRUdBeVFWcUlnY2dCeTBBQURvQUFDQUJRYUFCYkNBRWFrRURiRUdCeVFWcUlBY3RBQUU2QUFBZ0FVR2dBV3dnQkdwQkEyeEJnc2tGYWlBSExRQUNPZ0FBSUFGQm9BRnNJQVJxUVlDUkJHb2dBRUVBSUFOcmF5QUJRYUFCYkdwQitKQUVhaTBBQUNJRVFRTnhJZ2RCQkhJZ0J5QUVRUVJ4R3pvQUFDQUpRUUZxSVFrTElBTkJBV29oQXd3QkN3c0ZJQVFrUmdzZ0FDQUdUZ1JBSUFCQkNHb2hCaUFBSUFKQkIzRWlDRWdFUUNBR0lBaHFJUVlMQ3lBR0pFY2dDUXNwQUNBQVFZQ1FBa1lFUUNBQlFZQUJheUFCUVlBQmFpQUJRWUFCY1JzaEFRc2dBVUVFZENBQWFndEtBQ0FBUVFOMElBRkJBWFJxSWdCQkFXcEJQM0VpQVVGQWF5QUJJQUliUVlDUUJHb3RBQUFoQVNBQVFUOXhJZ0JCUUdzZ0FDQUNHMEdBa0FScUxRQUFJQUZCL3dGeFFRaDBjZ3U1QVFBZ0FSQUNJQUJCQVhSMVFRTnhJUUFnQVVISS9nTkdCRUFqT3lFQkFrQWdBRVVOQUFKQUFrQUNRQ0FBUVFGckRnTUFBUUlEQ3lNOElRRU1BZ3NqUFNFQkRBRUxJejRoQVFzRklBRkJ5ZjREUmdSQUl6OGhBUUpBSUFCRkRRQUNRQUpBQWtBZ0FFRUJhdzREQUFFQ0F3c2pRQ0VCREFJTEkwRWhBUXdCQ3lOQ0lRRUxCU00zSVFFQ1FDQUFSUTBBQWtBQ1FBSkFJQUJCQVdzT0F3QUJBZ01MSXpnaEFRd0NDeU01SVFFTUFRc2pPaUVCQ3dzTElBRUxvZ01CQlg4Z0FTQUFFREFnQlVFQmRHb2lBRUdBa0g1cUlBSkJBWEZCRFhRaUFXb3RBQUFoRUNBQVFZR1FmbW9nQVdvdEFBQWhFU0FESVFBRFFDQUFJQVJNQkVBZ0FDQURheUFHYWlJT0lBaElCRUJCQnlBQWF5RUZJQXRCQUVnaUFnUi9JQUlGSUF0QklIRkZDeUVCUVFBaEFnSi9RUUVnQlNBQUlBRWJJZ0YwSUJGeEJFQkJBaUVDQ3lBQ1FRRnFDeUFDUVFFZ0FYUWdFSEViSVFJamdBSUVmeUFMUVFCT0lnRUVmeUFCQlNBTVFRQk9Dd1VqZ0FJTEJIOGdDMEVIY1NFRklBeEJBRTRpQVFSQUlBeEJCM0VoQlFzZ0JTQUNJQUVRTVNJRlFSOXhRUU4wSVE4Z0JVSGdCM0ZCQlhWQkEzUWhBU0FGUVlENEFYRkJDblZCQTNRRklBSkJ4LzRESUFvZ0NrRUFUQnNpQ2hBeUlnVkJnSUQ4QjNGQkVIVWhEeUFGUVlEK0EzRkJDSFVoQVNBRlFmOEJjUXNoQlNBSElBaHNJQTVxUVFOc0lBbHFJZ2tnRHpvQUFDQUpRUUZxSUFFNkFBQWdDVUVDYWlBRk9nQUFJQWRCb0FGc0lBNXFRWUNSQkdvZ0FrRURjU0lCUVFSeUlBRWdDMEdBQVhGQkFFZEJBQ0FMUVFCT0d4czZBQUFnRFVFQmFpRU5DeUFBUVFGcUlRQU1BUXNMSUEwTGZnRURmeUFEUVFkeElRTkJBQ0FDSUFKQkEzVkJBM1JySUFBYklRZEJvQUVnQUd0QkJ5QUFRUWhxUWFBQlNoc2hDRUYvSVFJamdBSUVRQ0FFUVlEUWZtb3RBQUFpQWtFSWNVRUFSeUVKSUFKQndBQnhCRUJCQnlBRGF5RURDd3NnQmlBRklBa2dCeUFJSUFNZ0FDQUJRYUFCUVlESkJVRUFJQUpCZnhBekM2VUNBUUYvSUFOQkIzRWhBeUFGSUFZUU1DQUVRWURRZm1vdEFBQWlCRUhBQUhFRWYwRUhJQU5yQlNBREMwRUJkR29pQTBHQWtINXFJQVJCQ0hGQkFFY2lCVUVOZEdvdEFBQWhCaUFEUVlHUWZtb2dCVUVCY1VFTmRHb3RBQUFoQlNBQ1FRZHhJUU5CQUNFQ0lBRkJvQUZzSUFCcVFRTnNRWURKQldvZ0JFRUhjUUovUVFFZ0EwRUhJQU5ySUFSQklIRWJJZ04wSUFWeEJFQkJBaUVDQ3lBQ1FRRnFDeUFDUVFFZ0EzUWdCbkViSWdKQkFCQXhJZ05CSDNGQkEzUTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdja0ZhaUFEUWVBSGNVRUZkVUVEZERvQUFDQUJRYUFCYkNBQWFrRURiRUdDeVFWcUlBTkJnUGdCY1VFS2RVRURkRG9BQUNBQlFhQUJiQ0FBYWtHQWtRUnFJQUpCQTNFaUIwRUVjaUFISUFSQmdBRnhHem9BQUF2RUFRQWdCQ0FGRURBZ0EwRUhjVUVCZEdvaUJFR0FrSDVxTFFBQUlRVkJBQ0VESUFGQm9BRnNJQUJxUVFOc1FZREpCV29DZnlBRVFZR1FmbW90QUFCQkFVRUhJQUpCQjNGcklnSjBjUVJBUVFJaEF3c2dBMEVCYWdzZ0EwRUJJQUowSUFWeEd5SURRY2YrQXhBeUlnSkJnSUQ4QjNGQkVIVTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdja0ZhaUFDUVlEK0EzRkJDSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnc2tGYWlBQ09nQUFJQUZCb0FGc0lBQnFRWUNSQkdvZ0EwRURjVG9BQUF2V0FRRUdmeUFEUVFOMUlRc0RRQ0FFUWFBQlNBUkFJQVFnQldvaUJrR0FBazRFUUNBR1FZQUNheUVHQ3lBTFFRVjBJQUpxSUFaQkEzVnFJZ2xCZ0pCK2FpMEFBQ0VJUVFBaENpTTFCRUFnQkNBQUlBWWdDU0FJRUM4aUIwRUFTZ1JBUVFFaENpQUhRUUZySUFScUlRUUxDeUFLUlNNMElnY2dCeHNFUUNBRUlBQWdCaUFESUFrZ0FTQUlFRFFpQjBFQVNnUkFJQWRCQVdzZ0JHb2hCQXNGSUFwRkJFQWpnQUlFUUNBRUlBQWdCaUFESUFrZ0FTQUlFRFVGSUFRZ0FDQUdJQU1nQVNBSUVEWUxDd3NnQkVFQmFpRUVEQUVMQ3dzeUFRTi9JK2tCSVFNZ0FDUHFBU0lFU0FSQUR3dEJBQ0FEUVFkcklnTnJJUVVnQUNBQklBSWdBQ0FFYXlBRElBVVFOd3U5QlFFUGZ3SkFRU2NoQ1FOQUlBbEJBRWdOQVNBSlFRSjBJZ2RCZ1B3RGFpSURFQUloQWlBRFFRRnFFQUloQ2lBRFFRSnFFQUloQXlBQ1FSQnJJUUlnQ2tFSWF5RUtRUWdoQkNBQkJFQkJFQ0VFSUFNZ0EwRUJjV3NoQXdzZ0FDQUNUaUlGQkVBZ0FDQUNJQVJxU0NFRkN5QUZCRUFnQjBHRC9BTnFFQUlpQlVHQUFYRkJBRWNoQ3lBRlFTQnhRUUJISVE1QmdJQUNJQU1RTUNBRUlBQWdBbXNpQW10QkFXc2dBaUFGUWNBQWNSdEJBWFJxSWdOQmdKQithaUFGUVFoeFFRQkhJNEFDSWdJZ0FodEJBWEZCRFhRaUFtb3RBQUFoRHlBRFFZR1FmbW9nQW1vdEFBQWhFRUVISVFjRFFDQUhRUUJPQkVCQkFDRUlBbjlCQVVFQUlBY2lBa0VIYTJzZ0FpQU9HeUlDZENBUWNRUkFRUUloQ0FzZ0NFRUJhZ3NnQ0VFQklBSjBJQTl4R3lJSUJFQkJCeUFIYXlBS2FpSUdRUUJPSWdJRVFDQUdRYUFCVENFQ0N5QUNCRUJCQUNFTVFRQWhEU1BqQVVVamdBSWlBaUFDR3lJQ1JRUkFJQUJCb0FGc0lBWnFRWUNSQkdvdEFBQWlBMEVEY1NJRVFRQkxJQXNnQ3hzRVFFRUJJUXdGSUFOQkJIRkJBRWNqZ0FJaUF5QURHeUlEQkVBZ0JFRUFTeUVEQzBFQlFRQWdBeHNoRFFzTElBSkZCRUFnREVVaUJBUi9JQTFGQlNBRUN5RUNDeUFDQkVBamdBSUVRQ0FBUWFBQmJDQUdha0VEYkVHQXlRVnFJQVZCQjNFZ0NFRUJFREVpQkVFZmNVRURkRG9BQUNBQVFhQUJiQ0FHYWtFRGJFR0J5UVZxSUFSQjRBZHhRUVYxUVFOME9nQUFJQUJCb0FGc0lBWnFRUU5zUVlMSkJXb2dCRUdBK0FGeFFRcDFRUU4wT2dBQUJTQUFRYUFCYkNBR2FrRURiRUdBeVFWcUlBaEJ5ZjREUWNqK0F5QUZRUkJ4R3hBeUlnTkJnSUQ4QjNGQkVIVTZBQUFnQUVHZ0FXd2dCbXBCQTJ4Qmdja0ZhaUFEUVlEK0EzRkJDSFU2QUFBZ0FFR2dBV3dnQm1wQkEyeEJnc2tGYWlBRE9nQUFDd3NMQ3lBSFFRRnJJUWNNQVFzTEN5QUpRUUZySVFrTUFBQUxBQXNMWmdFQ2YwR0FnQUpCZ0pBQ0k5OEJHeUVCSTRBQ0lnSWo0d0VnQWhzRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBnQVJzajZBRWdBR3BCL3dGeFFRQWo1d0VRTndzajNnRUVRQ0FBSUFGQmdMZ0NRWUN3QWlQZEFSc1FPQXNqNGdFRVFDQUFJK0VCRURrTEN5VUJBWDhDUUFOQUlBQkJrQUZLRFFFZ0FFSC9BWEVRT2lBQVFRRnFJUUFNQUFBTEFBc0xSZ0VDZndOQUlBRkJrQUZPUlFSQVFRQWhBQU5BSUFCQm9BRklCRUFnQVVHZ0FXd2dBR3BCZ0pFRWFrRUFPZ0FBSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN3c2RBUUYvUVkvK0F4QUNRUUVnQUhSeUlnRWt1QUZCai80RElBRVFCUXNMQUVFQkpMb0JRUUVRUFFzc0FRSi9JMWtpQUVFQVNpSUJCRUFqVWlFQkN5QUFRUUZySUFBZ0FSc2lBRVVFUUVFQUpGUUxJQUFrV1Fzc0FRSi9JMjRpQUVFQVNpSUJCRUFqWnlFQkN5QUFRUUZySUFBZ0FSc2lBRVVFUUVFQUpHa0xJQUFrYmdzc0FRSi9JM3dpQUVFQVNpSUJCRUFqZGlFQkN5QUFRUUZySUFBZ0FSc2lBRVVFUUVFQUpIZ0xJQUFrZkFzd0FRSi9JNDBCSWdCQkFFb2lBUVJBSTRnQklRRUxJQUJCQVdzZ0FDQUJHeUlBUlFSQVFRQWtpUUVMSUFBa2pRRUxRQUVDZjBHVS9nTVFBa0g0QVhFaEFVR1QvZ01nQUVIL0FYRWlBaEFGUVpUK0F5QUJJQUJCQ0hVaUFISVFCU0FDSkZFZ0FDUlRJMUVqVTBFSWRISWtWZ3RkQVFKL0kxOGlBU05MZFNFQUlBRWdBR3NnQUNBQmFpTktHeUlBUWY4UFRDSUJCSDhqUzBFQVNnVWdBUXNFUUNBQUpGOGdBQkJESTE4aUFTTkxkU0VBSUFFZ0FHc2dBQ0FCYWlOS0d5RUFDeUFBUWY4UFNnUkFRUUFrVkFzTEtRRUJmeU5lUVFGcklnQkJBRXdFUUNOSkpGNGpTVUVBU2lOZEkxMGJCRUFRUkFzRklBQWtYZ3NMVVFFQ2Z5TllRUUZySWdCQkFFd0VRQ05RSkZnZ0FBUkFJMW9oQVNBQlFROUlJMDhqVHhzRWZ5QUJRUUZxQlNOUFJTSUFCRUFnQVVFQVNpRUFDeUFCUVFGcklBRWdBQnNMSkZvTEJTQUFKRmdMQzA0QkEzOGpiVUVCYXlJQlFRQk1CRUFqWlNJQkJFQWpieUVBSUFCQkQwZ2paQ05rR3dSL0lBQkJBV29GSTJSRklnSUVRQ0FBUVFCS0lRSUxJQUJCQVdzZ0FDQUNHd3NrYndzTElBRWtiUXRXQVFOL0k0d0JRUUZySWdGQkFFd0VRQ09FQVNJQkJFQWpqZ0VoQUNBQVFROUlJNE1CSTRNQkd3Ui9JQUJCQVdvRkk0TUJSU0lDQkVBZ0FFRUFTaUVDQ3lBQVFRRnJJQUFnQWhzTEpJNEJDd3NnQVNTTUFRdWRBUUVDZjBHQXdBQWpnUUowSWdFaEFpT3FBU0FBYWlJQUlBRk9CRUFnQUNBQ2F5U3FBUUpBQWtBQ1FBSkFBa0FqclFFaUFBUkFJQUJCQWtZTkFRSkFJQUJCQkdzT0JBTUFCQVVBQ3d3RkN4QS9FRUFRUVJCQ0RBUUxFRDhRUUJCQkVFSVFSUXdEQ3hBL0VFQVFRUkJDREFJTEVEOFFRQkJCRUVJUVJRd0JDeEJHRUVjUVNBc2dBRUVCYWtFSGNTU3RBVUVCRHdVZ0FDU3FBUXRCQUF0dUFRRi9Ba0FDUUFKQUFrQWdBRUVCUndSQUlBQkJBbXNPQXdFQ0F3UUxJMVVpQUNPVkFVY2hBU0FBSkpVQklBRVBDeU5xSWdFamxnRkhJUUFnQVNTV0FTQUFEd3NqZVNJQUk1Y0JSeUVCSUFBa2x3RWdBUThMSTRvQklnRWptQUZISVFBZ0FTU1lBU0FBRHd0QkFBdFZBQUpBQWtBQ1FDQUFRUUZIQkVBZ0FFRUNSZzBCSUFCQkEwWU5BZ3dEQzBFQklBRjBRWUVCY1VFQVJ3OExRUUVnQVhSQmh3RnhRUUJIRHd0QkFTQUJkRUgrQUhGQkFFY1BDMEVCSUFGMFFRRnhRUUJIQzNBQkFYOGpWeUFBYXlJQlFRQk1CRUFnQVNSWFFZQVFJMVpyUVFKMElnQkJBblFnQUNPQkFoc2tWeU5YSUFGQkgzVWlBQ0FBSUFGcWMyc2tWeU5jUVFGcVFRZHhKRndGSUFFa1Z3c2pWU05VSWdBZ0FCc0VmeU5hQlVFUER3c2pUQ05jRUVzRWYwRUJCVUYvQzJ4QkQyb0xaQUVCZnlOc0lBQnJJZ0VrYkNBQlFRQk1CRUJCZ0JBamEydEJBblFqZ1FKMEpHd2piQ0FCUVI5MUlnQWdBQ0FCYW5OckpHd2pjVUVCYWtFSGNTUnhDeU5xSTJraUFDQUFHd1IvSTI4RlFROFBDeU5oSTNFUVN3Ui9RUUVGUVg4TGJFRVBhZ3Z1QVFFQ2Z5TjdJQUJySWdGQkFFd0VRQ0FCSkh0QmdCQWplbXRCQVhRamdRSjBKSHNqZXlBQlFSOTFJZ0FnQUNBQmFuTnJKSHNqZlVFQmFrRWZjU1I5QlNBQkpIc0xJMzRoQVNONUkzZ2lBQ0FBR3dSQUkzOEVRRUdjL2dNUUFrRUZkVUVQY1NJQkpINUJBQ1IvQ3dWQkR3OExJMzBpQWtFQmRVR3cvZ05xRUFJZ0FrRUJjVVZCQW5SMVFROXhJUUJCQUNFQ0FrQUNRQUpBQWtBZ0FRUkFJQUZCQVVZTkFTQUJRUUpHRFFJTUF3c2dBRUVFZFNFQURBTUxRUUVoQWd3Q0N5QUFRUUYxSVFCQkFpRUNEQUVMSUFCQkFuVWhBRUVFSVFJTElBSkJBRW9FZnlBQUlBSnRCVUVBQzBFUGFndUdBUUVDZnlPTEFTQUFheUlCUVFCTUJFQWpqd0VqaFFGMEk0RUNkQ0FCUVI5MUlnQWdBQ0FCYW5OcklRRWprQUVpQUVFQmRTSUNJQUJCQVhFZ0FrRUJjWE1pQWtFT2RISWlBRUcvZjNFZ0FrRUdkSElnQUNPR0FSc2trQUVMSUFFa2l3RWppZ0VqaVFFaUFDQUFHd1IvSTQ0QkJVRVBEd3RCZjBFQkk1QUJRUUZ4RzJ4QkQyb0xNQUFnQUVFOFJnUkFRZjhBRHdzZ0FFRThhMEdnalFac0lBRnNRUU4xUWFDTkJtMUJQR3BCb0kwR2JFR004UUp0QzVNQkFRRi9RUUFrbXdFZ0FFRVBJNkVCR3lBQlFROGpvZ0ViYWlBQ1FROGpvd0ViYWlBRFFROGpwQUViYWlFRUlBQkJEeU9sQVJzZ0FVRVBJNllCRzJvZ0FrRVBJNmNCRzJvaEFTQURRUThqcUFFYklRTkJBQ1NjQVVFQUpKMEJJQVFqbndGQkFXb1FVQ0VBSUFFZ0Eyb2pvQUZCQVdvUVVDRUJJQUFrbVFFZ0FTU2FBU0FCUWY4QmNTQUFRZjhCY1VFSWRISUxtZ01CQlg4alNDQUFhaUlCSkVnalZ5QUJhMEVBVENJQlJRUkFRUUVRU2lFQkN5TmdJQUJxSWdRa1lDTnNJQVJyUVFCTUlnUkZCRUJCQWhCS0lRUUxJM0lnQUdva2NpTi9SU0lDQkVBamV5TnlhMEVBU2lFQ0N5QUNSU0lDUlFSQVFRTVFTaUVDQ3lPQUFTQUFhaVNBQVNPTEFTT0FBV3RCQUV3aUJVVUVRRUVFRUVvaEJRc2dBUVJBSTBnaEEwRUFKRWdnQXhCTUpKRUJDeUFFQkVBallDRURRUUFrWUNBREVFMGtrZ0VMSUFJRVFDTnlJUU5CQUNSeUlBTVFUaVNUQVFzZ0JRUkFJNEFCSVFOQkFDU0FBU0FERUU4a2xBRUxBbjhnQVNBRUlBRWJJZ0ZGQkVBZ0FpRUJDeUFCUlFzRVFDQUZJUUVMSUFFRVFFRUJKSjBCQ3lPckFTT3NBU0FBYkdvaUFVR0FnSUFDSTRFQ2RDSUFUZ1JBSUFFZ0FHc2lBU1NyQVNPZEFTSUFJNXNCSUFBYklnQkZCRUFqbkFFaEFBc2dBQVJBSTVFQkk1SUJJNU1CSTVRQkVGRWFCU0FCSktzQkN5T3VBU0lCUVFGMFFZQ1p3UUJxSWdBam1RRkJBbW82QUFBZ0FFRUJhaU9hQVVFQ2Fqb0FBQ0FCUVFGcUlnQWpyd0ZCQVhWQkFXdE9CSDhnQUVFQmF3VWdBQXNrcmdFTEM2QURBUVYvSUFBUVRDRUNJQUFRVFNFQklBQVFUaUVESUFBUVR5RUVJQUlra1FFZ0FTU1NBU0FESkpNQklBUWtsQUVqcXdFanJBRWdBR3hxSWdCQmdJQ0FBaU9CQW5ST0JFQWdBRUdBZ0lBQ0k0RUNkR3NrcXdFZ0FpQUJJQU1nQkJCUklRQWpyZ0ZCQVhSQmdKbkJBR29pQlNBQVFZRCtBM0ZCQ0hWQkFtbzZBQUFnQlVFQmFpQUFRZjhCY1VFQ2Fqb0FBQ00yQkVBZ0FrRVBRUTlCRHhCUklRQWpyZ0ZCQVhSQmdKa2hhaUlDSUFCQmdQNERjVUVJZFVFQ2Fqb0FBQ0FDUVFGcUlBQkIvd0Z4UVFKcU9nQUFRUThnQVVFUFFROFFVU0VBSTY0QlFRRjBRWUNaS1dvaUFTQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0FVRUJhaUFBUWY4QmNVRUNham9BQUVFUFFROGdBMEVQRUZFaEFDT3VBVUVCZEVHQW1URnFJZ0VnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQUZCQVdvZ0FFSC9BWEZCQW1vNkFBQkJEMEVQUVE4Z0JCQlJJUUFqcmdGQkFYUkJnSms1YWlJQklBQkJnUDREY1VFSWRVRUNham9BQUNBQlFRRnFJQUJCL3dGeFFRSnFPZ0FBQ3lPdUFVRUJhaUlBSTY4QlFRRjFRUUZyVGdSL0lBQkJBV3NGSUFBTEpLNEJDd3NlQVFGL0lBQVFTU0VCSUFGRkl6TWpNeHNFUUNBQUVGSUZJQUFRVXdzTEtBRUJmMEhYQUNPQkFuUWhBQU5BSTU0QklBQk9CRUFnQUJCVUk1NEJJQUJySko0QkRBRUxDd3NoQUNBQVFhYitBMFlFUUVHbS9nTVFBa0dBQVhFaEFDQUFRZkFBY2c4TFFYOExuQUVCQVg4ajB3RWhBQ1BVQVFSQUlBQkJlM0VnQUVFRWNpUExBUnNoQUNBQVFYNXhJQUJCQVhJanpnRWJJUUFnQUVGM2NTQUFRUWh5STh3Qkd5RUFJQUJCZlhFZ0FFRUNjaVBOQVJzaEFBVWoxUUVFUUNBQVFYNXhJQUJCQVhJanp3RWJJUUFnQUVGOWNTQUFRUUp5STlBQkd5RUFJQUJCZTNFZ0FFRUVjaVBSQVJzaEFDQUFRWGR4SUFCQkNISWowZ0ViSVFBTEN5QUFRZkFCY2d2UEFnRUJmeUFBUVlDQUFrZ0VRRUYvRHdzZ0FFR0FnQUpPSWdFRWZ5QUFRWURBQWtnRklBRUxCRUJCZnc4TElBQkJnTUFEVGlJQkJIOGdBRUdBL0FOSUJTQUJDd1JBSUFCQmdFQnFFQUlQQ3lBQVFZRDhBMDRpQVFSL0lBQkJuLzBEVEFVZ0FRc0VRRUgvQVVGL0k5b0JRUUpJR3c4TElBQkJ6ZjREUmdSQVFmOEJJUUZCemY0REVBSkJBWEZGQkVCQi9nRWhBUXNqZ1FKRkJFQWdBVUgvZm5FaEFRc2dBUThMSUFCQnhQNERSZ1JBSUFBajVnRVFCU1BtQVE4TElBQkJrUDREVGlJQkJIOGdBRUdtL2dOTUJTQUJDd1JBRUZVZ0FCQldEd3NnQUVHdy9nTk9JZ0VFZnlBQVFiLytBMHdGSUFFTEJFQVFWVUYvRHdzZ0FFR0UvZ05HQkVBZ0FDTy9BVUdBL2dOeFFRaDFJZ0VRQlNBQkR3c2dBRUdGL2dOR0JFQWdBQ1BBQVJBRkk4QUJEd3NnQUVHUC9nTkdCRUFqdUFGQjRBRnlEd3NnQUVHQS9nTkdCRUFRVnc4TFFYOExLUUVCZnlQWEFTQUFSZ1JBUVFFazJRRUxJQUFRV0NJQlFYOUdCSDhnQUJBQ0JTQUJRZjhCY1FzTHN3SUJCSDhqN3dFRVFBOExJL0FCSVFVajhRRWhBeUFBUWY4L1RBUkFJQU1FZnlBQlFSQnhSUVVnQXd0RkJFQWdBVUVQY1NJRUJFQWdCRUVLUmdSQVFRRWs3UUVMQlVFQUpPMEJDd3NGSUFCQi8vOEFUQVJBSS9NQklnUkZJZ0lFZnlBQ0JTQUFRZi9mQUV3TEJFQWdBVUVQY1NQckFTQURHeUVDSUFVRWZ5QUJRUjl4SVFFZ0FrSGdBWEVGSS9JQkJIOGdBVUgvQUhFaEFTQUNRWUFCY1FWQkFDQUNJQVFiQ3dzaEFDQUFJQUZ5Sk9zQkJTUHJBVUgvQVhFZ0FVRUFTa0VJZEhJazZ3RUxCU0FEUlNJRUJIOGdBRUgvdndGTUJTQUVDd1JBSSs0QklBVWdCUnNFUUNQckFVRWZjU0FCUWVBQmNYSWs2d0VQQ3lBQlFROXhJQUZCQTNFajh3RWJKT3dCQlNBRFJTSUNCSDhnQUVILy93Rk1CU0FDQ3dSQUlBVUVRQ0FCUVFGeFFRQkhKTzRCQ3dzTEN3c0xLQUFnQUVFRWRVRVBjU1JPSUFCQkNIRkJBRWNrVHlBQVFRZHhKRkFnQUVINEFYRkJBRW9rVlFzb0FDQUFRUVIxUVE5eEpHTWdBRUVJY1VFQVJ5UmtJQUJCQjNFa1pTQUFRZmdCY1VFQVNpUnFDeXdBSUFCQkJIVkJEM0VrZ2dFZ0FFRUljVUVBUnlTREFTQUFRUWR4SklRQklBQkIrQUZ4UVFCS0pJb0JDemdBSUFCQkJIVWtoUUVnQUVFSWNVRUFSeVNHQVNBQVFRZHhJZ0FraHdFZ0FFRUJkQ0lBUVFGSUJFQkJBU0VBQ3lBQVFRTjBKSThCQzJNQkFYOUJBU1JVSTFsRkJFQkJ3QUFrV1F0QmdCQWpWbXRCQW5RaUFFRUNkQ0FBSTRFQ0d5UlhJMUFrV0NOT0pGb2pWaVJmSTBraUFDUmVJQUJCQUVvaUFBUi9JMHRCQUVvRklBQUxKRjBqUzBFQVNnUkFFRVFMSTFWRkJFQkJBQ1JVQ3dzeUFFRUJKR2tqYmtVRVFFSEFBQ1J1QzBHQUVDTnJhMEVDZENPQkFuUWtiQ05sSkcwall5UnZJMnBGQkVCQkFDUnBDd3N1QUVFQkpIZ2pmRVVFUUVHQUFpUjhDMEdBRUNONmEwRUJkQ09CQW5Ra2UwRUFKSDBqZVVVRVFFRUFKSGdMQzBFQVFRRWtpUUVqalFGRkJFQkJ3QUFralFFTEk0OEJJNFVCZENPQkFuUWtpd0VqaEFFa2pBRWpnZ0VramdGQi8vOEJKSkFCSTRvQlJRUkFRUUFraVFFTEMxd0FJQUJCZ0FGeFFRQkhKS1FCSUFCQndBQnhRUUJISktNQklBQkJJSEZCQUVja29nRWdBRUVRY1VFQVJ5U2hBU0FBUVFoeFFRQkhKS2dCSUFCQkJIRkJBRWNrcHdFZ0FFRUNjVUVBUnlTbUFTQUFRUUZ4UVFCSEpLVUJDK2tFQVFGL0lBQkJwdjREUnlJQ0JFQWpxUUZGSVFJTElBSUVRRUVBRHdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnSkJrUDREUndSQUlBSkJrZjREYXc0V0FnWUtEaFVEQndzUEFRUUlEQkFWQlFrTkVSSVRGQlVMSUFGQjhBQnhRUVIxSkVrZ0FVRUljVUVBUnlSS0lBRkJCM0VrU3d3VkN5QUJRWUFCY1VFQVJ5UjVEQlFMSUFGQkJuVkJBM0VrVENBQlFUOXhKRTFCd0FBalRXc2tXUXdUQ3lBQlFRWjFRUU54SkdFZ0FVRS9jU1JpUWNBQUkySnJKRzRNRWdzZ0FTUnpRWUFDSTNOckpId01FUXNnQVVFL2NTU0JBVUhBQUNPQkFXc2tqUUVNRUFzZ0FSQmJEQThMSUFFUVhBd09DMEVCSkg4Z0FVRUZkVUVQY1NSMERBMExJQUVRWFF3TUN5QUJKRkVqVTBFSWRDQUJjaVJXREFzTElBRWtaaU5vUVFoMElBRnlKR3NNQ2dzZ0FTUjFJM2RCQ0hRZ0FYSWtlZ3dKQ3lBQkVGNE1DQXNnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVJTSUFGQkIzRWlBQ1JUSTFFZ0FFRUlkSElrVmhCZkN3d0hDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKR2NnQVVFSGNTSUFKR2dqWmlBQVFRaDBjaVJyRUdBTERBWUxJQUZCZ0FGeEJFQWdBVUhBQUhGQkFFY2tkaUFCUVFkeElnQWtkeU4xSUFCQkNIUnlKSG9RWVFzTUJRc2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5U0lBUkJpQ3d3RUN5QUJRUVIxUVFkeEpKOEJJQUZCQjNFa29BRkJBU1NiQVF3REN5QUJFR05CQVNTY0FRd0NDeUFCUVlBQmNVRUFSeVNwQVNBQlFZQUJjVVVFUUFKQVFaRCtBeUVDQTBBZ0FrR20vZ05PRFFFZ0FrRUFFQVVnQWtFQmFpRUNEQUFBQ3dBTEN3d0JDMEVCRHd0QkFRczhBUUYvSUFCQkNIUWhBVUVBSVFBRFFBSkFJQUJCbndGS0RRQWdBRUdBL0FOcUlBQWdBV29RQWhBRklBQkJBV29oQUF3QkN3dEJoQVVrK1FFTEl3RUJmeVAwQVJBQ0lRQWo5UUVRQWtIL0FYRWdBRUgvQVhGQkNIUnlRZkQvQTNFTEp3RUJmeVAyQVJBQ0lRQWo5d0VRQWtIL0FYRWdBRUgvQVhGQkNIUnlRZkEvY1VHQWdBSnFDNFFCQVFOL0k0QUNSUVJBRHdzZ0FFR0FBWEZGSS9vQkkvb0JHd1JBUVFBaytnRWorQUVRQWtHQUFYSWhBQ1A0QVNBQUVBVVBDeEJtSVFFUVp5RUNJQUJCLzM1eFFRRnFRUVIwSVFNZ0FFR0FBWEVFUUVFQkpQb0JJQU1rK3dFZ0FTVDhBU0FDSlAwQkkvZ0JJQUJCLzM1eEVBVUZJQUVnQWlBREVISWorQUZCL3dFUUJRc0xYZ0VFZnlORklRTWpSQ0FBUmlJQ1JRUkFJQUFnQTBZaEFnc2dBZ1JBSUFCQkFXc2lCQkFDUWI5L2NTSUNRVDl4SWdWQlFHc2dCU0FBSUFOR0cwR0FrQVJxSUFFNkFBQWdBa0dBQVhFRVFDQUVJQUpCQVdwQmdBRnlFQVVMQ3dzOEFRRi9Ba0FDUUFKQUFrQWdBQVJBSUFBaUFVRUJSZzBCSUFGQkFrWU5BaUFCUVFOR0RRTU1CQXRCQ1E4TFFRTVBDMEVGRHd0QkJ3OExRUUFMSlFFQmYwRUJJOFVCRUdvaUFuUWdBSEZCQUVjaUFBUi9RUUVnQW5RZ0FYRkZCU0FBQ3d1RkFRRUVmd05BSUFJZ0FFZ0VRQ0FDUVFScUlRSWp2d0VpQVVFRWFrSC8vd054SWdNa3Z3RWp4QUVFUUNQQ0FTRUVJOEVCQkVBand3RWt3QUZCQVNTN0FVRUNFRDFCQUNUQkFVRUJKTUlCQlNBRUJFQkJBQ1RDQVFzTElBRWdBeEJyQkVBandBRkJBV29pQVVIL0FVb0VRRUVCSk1FQlFRQWhBUXNnQVNUQUFRc0xEQUVMQ3dzTUFDTytBUkJzUVFBa3ZnRUxSZ0VCZnlPL0FTRUFRUUFrdndGQmhQNERRUUFRQlNQRUFRUi9JQUJCQUJCckJTUEVBUXNFUUNQQUFVRUJhaUlBUWY4QlNnUkFRUUVrd1FGQkFDRUFDeUFBSk1BQkN3dUNBUUVEZnlQRUFTRUJJQUJCQkhGQkFFY2t4QUVnQUVFRGNTRUNJQUZGQkVBanhRRVFhaUVBSUFJUWFpRURJNzhCSVFFanhBRUVmMEVCSUFCMElBRnhCVUVCSUFCMElBRnhRUUJISWdBRWYwRUJJQU4wSUFGeEJTQUFDd3NFUUNQQUFVRUJhaUlBUWY4QlNnUkFRUUVrd1FGQkFDRUFDeUFBSk1BQkN3c2dBaVRGQVF2U0JnRUNmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERJQUZCQVhFUUJRd0JDeUFBUVlDQUFrZ0VRQ0FBSUFFUVdnd0JDeUFBUVlDQUFrNGlBZ1JBSUFCQmdNQUNTQ0VDQ3lBQ0RRRWdBRUdBd0FOT0lnSUVRQ0FBUVlEOEEwZ2hBZ3NnQWdSQUlBQkJnRUJxSUFFUUJRd0NDeUFBUVlEOEEwNGlBZ1JBSUFCQm4vMERUQ0VDQ3lBQ0JFQWoyZ0ZCQWs0UEN5QUFRYUQ5QTA0aUFnUkFJQUJCLy8wRFRDRUNDeUFDRFFBZ0FFR0MvZ05HQkVBZ0FVRUJjVUVBUnlUSUFTQUJRUUp4UVFCSEpNa0JJQUZCZ0FGeFFRQkhKTW9CUVFFUEN5QUFRWkQrQTA0aUFnUkFJQUJCcHY0RFRDRUNDeUFDQkVBUVZTQUFJQUVRWkE4TElBQkJzUDREVGlJQ0JFQWdBRUcvL2dOTUlRSUxJQUlFUUJCVkN5QUFRY0QrQTA0aUFnUkFJQUJCeS80RFRDRUNDeUFDQkVBZ0FFSEEvZ05HQkVBZ0FSQWlEQU1MSUFCQndmNERSZ1JBUWNIK0F5QUJRZmdCY1VIQi9nTVFBa0VIY1hKQmdBRnlFQVVNQWdzZ0FFSEUvZ05HQkVCQkFDVG1BU0FBUVFBUUJRd0NDeUFBUWNYK0EwWUVRQ0FCSk5zQkRBTUxJQUJCeHY0RFJnUkFJQUVRWlF3REN3SkFBa0FDUUFKQUlBQWlBa0hEL2dOSEJFQWdBa0hDL2dOckRnb0JCQVFFQkFRRUJBTUNCQXNnQVNUbkFRd0dDeUFCSk9nQkRBVUxJQUVrNlFFTUJBc2dBU1RxQVF3REN3d0NDeVA0QVNBQVJnUkFJQUVRYUF3QkN5UC9BU0FBUmlJQ1JRUkFJLzRCSUFCR0lRSUxJQUlFUUNQNkFRUkFBbjhqL0FFaUFrR0FnQUZPSWdNRVFDQUNRZi8vQVV3aEF3c2dBMFVMQkVBZ0FrR0FvQU5PSWdNRVFDQUNRZisvQTB3aEF3c0xJQU1OQWdzTElBQWpRMDRpQWdSQUlBQWpSVXdoQWdzZ0FnUkFJQUFnQVJCcERBSUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQnRBa0FDUUFKQUFrQWdBQ0lDUVlUK0EwY0VRQ0FDUVlYK0Eyc09Bd0VDQXdRTEVHNE1CUXNDUUNQRUFRUkFJOElCRFFFandRRUVRRUVBSk1FQkN3c2dBU1RBQVFzTUJRc2dBU1REQVNQQ0FTUEVBU0lBSUFBYkJFQWdBU1RBQVVFQUpNSUJDd3dFQ3lBQkVHOE1Bd3NNQWdzZ0FFR0EvZ05HQkVBZ0FVSC9BWE1rMHdFajB3RWlBa0VRY1VFQVJ5VFVBU0FDUVNCeFFRQkhKTlVCQ3lBQVFZLytBMFlFUUNBQkVCTU1BZ3NnQUVILy93TkdCRUFnQVJBU0RBSUxRUUVQQzBFQUR3dEJBUXNmQUNQWUFTQUFSZ1JBUVFFazJRRUxJQUFnQVJCd0JFQWdBQ0FCRUFVTEMxb0JBMzhEUUFKQUlBTWdBazROQUNBQUlBTnFFRmtoQlNBQklBTnFJUVFEUUNBRVFmKy9Ba29FUUNBRVFZQkFhaUVFREFFTEN5QUVJQVVRY1NBRFFRRnFJUU1NQVFzTEkva0JRU0FqZ1FKMElBSkJCSFZzYWlUNUFRdHlBUUovSS9vQlJRUkFEd3RCRUNFQUkvd0JJLzBCQW44ait3RWlBVUVRU0FSQUlBRWhBQXNnQUFzUWNpUDhBU0FBYWlUOEFTUDlBU0FBYWlUOUFTQUJJQUJySWdFayt3RWorQUVoQUNBQlFRQk1CRUJCQUNUNkFTQUFRZjhCRUFVRklBQWdBVUVFZFVFQmEwSC9mbkVRQlFzTFF3RUJmd0ovSUFCRklnSkZCRUFnQUVFQlJpRUNDeUFDQ3dSL0krWUJJOXNCUmdVZ0Fnc0VRQ0FCUVFSeUlnRkJ3QUJ4QkVBUVBnc0ZJQUZCZTNFaEFRc2dBUXY2QVFFRmZ5UGNBVVVFUUE4TEk5b0JJUU1nQXlQbUFTSUVRWkFCVGdSL1FRRUZJK1VCSWdKQitBSWpnUUowSWdCT0JIOUJBZ1ZCQTBFQUlBSWdBRTRiQ3dzaUFVY0VRRUhCL2dNUUFpRUFJQUVrMmdGQkFDRUNBa0FDUUFKQUFrQWdBUVJBSUFGQkFXc09Bd0VDQXdRTElBQkJmSEVpQUVFSWNVRUFSeUVDREFNTElBQkJmWEZCQVhJaUFFRVFjVUVBUnlFQ0RBSUxJQUJCZm5GQkFuSWlBRUVnY1VFQVJ5RUNEQUVMSUFCQkEzSWhBQXNnQWdSQUVENExJQUZGQkVBUWN3c2dBVUVCUmdSQVFRRWt1UUZCQUJBOUMwSEIvZ01nQVNBQUVIUVFCUVVnQkVHWkFVWUVRRUhCL2dNZ0FVSEIvZ01RQWhCMEVBVUxDd3VmQVFFQmZ5UGNBUVJBSStVQklBQnFKT1VCSXpJaEFRTkFJK1VCUVFRamdRSWlBSFJCeUFNZ0FIUWo1Z0ZCbVFGR0cwNEVRQ1BsQVVFRUk0RUNJZ0IwUWNnRElBQjBJK1lCUVprQlJodHJKT1VCSStZQklnQkJrQUZHQkVBZ0FRUkFFRHNGSUFBUU9nc1FQRUYvSkVaQmZ5UkhCU0FBUVpBQlNBUkFJQUZGQkVBZ0FCQTZDd3NMUVFBZ0FFRUJhaUFBUVprQlNoc2s1Z0VNQVFzTEN4QjFDemNCQVg5QkJDT0JBaUlBZEVISUF5QUFkQ1BtQVVHWkFVWWJJUUFEUUNQa0FTQUFUZ1JBSUFBUWRpUGtBU0FBYXlUa0FRd0JDd3NMdUFFQkJIOGp5Z0ZGQkVBUEN3TkFJQU1nQUVnRVFDQURRUVJxSVFNQ2Z5UEdBU0lDUVFScUlnRkIvLzhEU2dSQUlBRkJnSUFFYXlFQkN5QUJDeVRHQVVFQlFRSkJCeVBKQVJzaUJIUWdBbkZCQUVjaUFnUkFRUUVnQkhRZ0FYRkZJUUlMSUFJRVFFR0IvZ05CZ2Y0REVBSkJBWFJCQVdwQi93RnhFQVVqeHdGQkFXb2lBVUVJUmdSQVFRQWt4d0ZCQVNTOEFVRURFRDFCZ3Y0RFFZTCtBeEFDUWY5K2NSQUZRUUFreWdFRklBRWt4d0VMQ3d3QkN3c0xqZ0VBSS9rQlFRQktCRUFqK1FFZ0FHb2hBRUVBSlBrQkN5T01BaUFBYWlTTUFpT1FBa1VFUUNNd0JFQWo1QUVnQUdvazVBRVFkd1VnQUJCMkN5TXZCRUFqbmdFZ0FHb2tuZ0VGSUFBUVZBc2dBQkI0Q3lNeEJFQWp2Z0VnQUdva3ZnRVFiUVVnQUJCc0N5T1RBaUFBYWlJQUk1RUNUZ1JBSTVJQ1FRRnFKSklDSUFBamtRSnJJUUFMSUFBa2t3SUxDd0JCQkJCNUk0c0NFQUlMSndFQmYwRUVFSGtqaXdKQkFXcEIvLzhEY1JBQ0lRQVFla0gvQVhFZ0FFSC9BWEZCQ0hSeUN3d0FRUVFRZVNBQUlBRVFjUXMxQVFGL1FRRWdBSFJCL3dGeElRSWdBVUVBU2dSQUk0a0NJQUp5UWY4QmNTU0pBZ1VqaVFJZ0FrSC9BWE54SklrQ0N5T0pBZ3NKQUVFRklBQVFmUm9MT0FFQmZ5QUJRUUJPQkVBZ0FFRVBjU0FCUVE5eGFrRVFjVUVBUnhCK0JTQUJRUjkxSWdJZ0FTQUNhbk5CRDNFZ0FFRVBjVXNRZmdzTENRQkJCeUFBRUgwYUN3a0FRUVlnQUJCOUdnc0pBRUVFSUFBUWZSb0xPUUVCZnlBQlFZRCtBM0ZCQ0hVaEFpQUFJQUZCL3dGeElnRVFjQVJBSUFBZ0FSQUZDeUFBUVFGcUlnQWdBaEJ3QkVBZ0FDQUNFQVVMQ3cwQVFRZ1FlU0FBSUFFUWd3RUxXQUFnQWdSQUlBRWdBRUgvL3dOeElnQnFJQUFnQVhOeklnSkJFSEZCQUVjUWZpQUNRWUFDY1VFQVJ4Q0NBUVVnQUNBQmFrSC8vd054SWdJZ0FFSC8vd054U1JDQ0FTQUFJQUZ6SUFKelFZQWdjVUVBUnhCK0N3c0tBRUVFRUhrZ0FCQlpDNVFGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc01GUXNRZTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NEQWlBQVFmOEJjU1NFQWd3UEN5T0VBa0gvQVhFamd3SkIvd0Z4UVFoMGNpT0NBaEI4REJNTEk0UUNRZjhCY1NPREFrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJTUNEQk1MSTRNQ0lnQkJBUkIvSUFCQkFXcEIvd0Z4SWdBa2d3SU1EUXNqZ3dJaUFFRi9FSDhnQUVFQmEwSC9BWEVpQUNTREFnd05DeEI2UWY4QmNTU0RBZ3dOQ3lPQ0FpSUFRWUFCY1VHQUFVWVFnZ0VnQUVFQmRDQUFRZjhCY1VFSGRuSkIvd0Z4SklJQ0RBMExFSHRCLy84RGNTT0tBaENFQVF3SUN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpSUFJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlJZ0ZCQUJDRkFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWNDSUFCQi93RnhKSWdDUVFBUWdRRkJDQThMSTRRQ1FmOEJjU09EQWtIL0FYRkJDSFJ5RUlZQlFmOEJjU1NDQWd3TEN5T0VBa0gvQVhFamd3SkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0RBZ3dMQ3lPRUFpSUFRUUVRZnlBQVFRRnFRZjhCY1NJQUpJUUNEQVVMSTRRQ0lnQkJmeEIvSUFCQkFXdEIvd0Z4SWdBa2hBSU1CUXNRZWtIL0FYRWtoQUlNQlFzamdnSWlBRUVCY1VFQVN4Q0NBU0FBUVFkMElBQkIvd0Z4UVFGMmNrSC9BWEVrZ2dJTUJRdEJmdzhMSTRzQ1FRSnFRZi8vQTNFa2l3SU1CQXNnQUVVUWdBRkJBQkNCQVF3REN5QUFSUkNBQVVFQkVJRUJEQUlMSTRzQ1FRRnFRZi8vQTNFa2l3SU1BUXRCQUJDQUFVRUFFSUVCUVFBUWZndEJCQThMSUFCQi93RnhKSVFDUVFnTGd3WUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJFRWNFUUNBQVFSRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9BQWdSQVFjMytBeENHQVVIL0FYRWlBRUVCY1FSQVFjMytBeUFBUVg1eElnQkJnQUZ4Qkg5QkFDU0JBaUFBUWY5K2NRVkJBU1NCQWlBQVFZQUJjZ3NRZkVIRUFBOExDMEVCSkpBQ0RCQUxFSHRCLy84RGNTSUFRWUQrQTNGQkNIVWtoUUlnQUVIL0FYRWtoZ0lqaXdKQkFtcEIvLzhEY1NTTEFnd1JDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaU9DQWhCOERCQUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSVVDREJBTEk0VUNJZ0JCQVJCL0lBQkJBV3BCL3dGeEpJVUNJNFVDUlJDQUFVRUFFSUVCREE0TEk0VUNJZ0JCZnhCL0lBQkJBV3RCL3dGeEpJVUNJNFVDUlJDQUFVRUJFSUVCREEwTEVIcEIvd0Z4SklVQ0RBb0xJNElDSWdGQmdBRnhRWUFCUmlFQUk0a0NRUVIyUVFGeElBRkJBWFJ5UWY4QmNTU0NBZ3dLQ3hCNklRQWppd0lnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJc0NRUWdQQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2lJQUk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlnRkJBQkNGQVNBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJY0NJQUJCL3dGeEpJZ0NRUUFRZ1FGQkNBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlFSVlCUWY4QmNTU0NBZ3dJQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNTRkFnd0lDeU9HQWlJQVFRRVFmeUFBUVFGcVFmOEJjU0lBSklZQ0lBQkZFSUFCUVFBUWdRRU1CZ3NqaGdJaUFFRi9FSDhnQUVFQmEwSC9BWEVpQUNTR0FpQUFSUkNBQVVFQkVJRUJEQVVMRUhwQi93RnhKSVlDREFJTEk0SUNJZ0ZCQVhGQkFVWWhBQ09KQWtFRWRrRUJjVUVIZENBQlFmOEJjVUVCZG5Ja2dnSU1BZ3RCZnc4TEk0c0NRUUZxUWYvL0EzRWtpd0lNQVFzZ0FCQ0NBVUVBRUlBQlFRQVFnUUZCQUJCK0MwRUVEd3NnQUVIL0FYRWtoZ0pCQ0F2ZUJnRUNmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCSUVjRVFDQUFRU0ZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPSkFrRUhka0VCY1FSQUk0c0NRUUZxUWYvL0EzRWtpd0lGRUhvaEFDT0xBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2l3SUxRUWdQQ3hCN1FmLy9BM0VpQUVHQS9nTnhRUWgxSkljQ0lBQkIvd0Z4SklnQ0k0c0NRUUpxUWYvL0EzRWtpd0lNRkFzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJaUFDT0NBaEI4REE4TEk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJY0NEQTBMSTRjQ0lnQkJBUkIvSUFCQkFXcEIvd0Z4SWdBa2h3SU1EZ3NqaHdJaUFFRi9FSDhnQUVFQmEwSC9BWEVpQUNTSEFnd09DeEI2UWY4QmNTU0hBZ3dPQzBFR1FRQWppUUlpQWtFRmRrRUJjVUVBU3hzaUFVSGdBSElnQVNBQ1FRUjJRUUZ4UVFCTEd5RUJJNElDSVFBZ0FrRUdka0VCY1VFQVN3Ui9JQUFnQVd0Qi93RnhCU0FCUVFaeUlBRWdBRUVQY1VFSlN4c2lBVUhnQUhJZ0FTQUFRWmtCU3hzaUFTQUFha0gvQVhFTElnQkZFSUFCSUFGQjRBQnhRUUJIRUlJQlFRQVFmaUFBSklJQ0RBNExJNGtDUVFkMlFRRnhRUUJMQkVBUWVpRUFJNHNDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU0xBZ1VqaXdKQkFXcEIvLzhEY1NTTEFndEJDQThMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5SWdBZ0FFSC8vd054UVFBUWhRRWdBRUVCZEVILy93TnhJZ0JCZ1A0RGNVRUlkU1NIQWlBQVFmOEJjU1NJQWtFQUVJRUJRUWdQQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2lJQUVJWUJRZjhCY1NTQ0Fnd0hDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NIQWd3RkN5T0lBaUlBUVFFUWZ5QUFRUUZxUWY4QmNTSUFKSWdDREFZTEk0Z0NJZ0JCZnhCL0lBQkJBV3RCL3dGeElnQWtpQUlNQmdzUWVrSC9BWEVraUFJTUJnc2pnZ0pCZjNOQi93RnhKSUlDUVFFUWdRRkJBUkIrREFZTFFYOFBDeUFBUWY4QmNTU0lBa0VJRHdzZ0FFRUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0hBaUFBUWY4QmNTU0lBZ3dEQ3lBQVJSQ0FBVUVBRUlFQkRBSUxJQUJGRUlBQlFRRVFnUUVNQVFzaml3SkJBV3BCLy84RGNTU0xBZ3RCQkF2WEJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQk1FY0VRQ0FBUVRGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5T0pBa0VFZGtFQmNRUkFJNHNDUVFGcVFmLy9BM0VraXdJRkVIb2hBQ09MQWlBQVFSaDBRUmgxYWtILy93TnhRUUZxUWYvL0EzRWtpd0lMUVFnUEN4QjdRZi8vQTNFa2lnSWppd0pCQW1wQi8vOERjU1NMQWd3UkN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpSUFJNElDRUh3TURnc2ppZ0pCQVdwQi8vOERjU1NLQWtFSUR3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWlBUkNHQVNJQVFRRVFmeUFBUVFGcVFmOEJjU0lBUlJDQUFVRUFFSUVCSUFFZ0FCQjhEQTRMSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5SWdFUWhnRWlBRUYvRUg4Z0FFRUJhMEgvQVhFaUFFVVFnQUZCQVJDQkFTQUJJQUFRZkF3TkN5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNoQjZRZjhCY1JCOERBc0xRUUFRZ1FGQkFCQitRUUVRZ2dFTUN3c2ppUUpCQkhaQkFYRkJBVVlFUUJCNklRQWppd0lnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJc0NCU09MQWtFQmFrSC8vd054SklzQ0MwRUlEd3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElpQUNPS0FrRUFFSVVCSTRvQ0lBQnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJY0NJQUJCL3dGeEpJZ0NRUUFRZ1FGQkNBOExJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlJZ0FRaGdGQi93RnhKSUlDREFZTEk0b0NRUUZyUWYvL0EzRWtpZ0pCQ0E4TEk0SUNJZ0JCQVJCL0lBQkJBV3BCL3dGeElnQWtnZ0lnQUVVUWdBRkJBQkNCQVF3R0N5T0NBaUlBUVg4UWZ5QUFRUUZyUWY4QmNTSUFKSUlDSUFCRkVJQUJRUUVRZ1FFTUJRc1Fla0gvQVhFa2dnSU1Bd3RCQUJDQkFVRUFFSDRqaVFKQkJIWkJBWEZCQUUwUWdnRU1Bd3RCZnc4TElBQkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtod0lnQUVIL0FYRWtpQUlNQVFzaml3SkJBV3BCLy84RGNTU0xBZ3RCQkF1Q0FnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUFSd1JBSUFCQndRQkdEUUVDUUNBQVFjSUFhdzRPQXdRRkJnY0lDUkVLQ3d3TkRnOEFDd3dQQ3d3UEN5T0VBaVNEQWd3T0N5T0ZBaVNEQWd3TkN5T0dBaVNEQWd3TUN5T0hBaVNEQWd3TEN5T0lBaVNEQWd3S0N5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNoQ0dBVUgvQVhFa2d3SU1DUXNqZ2dJa2d3SU1DQXNqZ3dJa2hBSU1Cd3NqaFFJa2hBSU1CZ3NqaGdJa2hBSU1CUXNqaHdJa2hBSU1CQXNqaUFJa2hBSU1Bd3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElRaGdGQi93RnhKSVFDREFJTEk0SUNKSVFDREFFTFFYOFBDMEVFQy8wQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQVJ3UkFJQUJCMFFCR0RRRUNRQ0FBUWRJQWF3NE9FQU1FQlFZSENBa0tFQXNNRFE0QUN3d09DeU9EQWlTRkFnd09DeU9FQWlTRkFnd05DeU9HQWlTRkFnd01DeU9IQWlTRkFnd0xDeU9JQWlTRkFnd0tDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaENHQVVIL0FYRWtoUUlNQ1FzamdnSWtoUUlNQ0Fzamd3SWtoZ0lNQndzamhBSWtoZ0lNQmdzamhRSWtoZ0lNQlFzamh3SWtoZ0lNQkFzamlBSWtoZ0lNQXdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRkIvd0Z4SklZQ0RBSUxJNElDSklZQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFlQUFSd1JBSUFCQjRRQkdEUUVDUUNBQVFlSUFhdzRPQXdRUUJRWUhDQWtLQ3d3UURRNEFDd3dPQ3lPREFpU0hBZ3dPQ3lPRUFpU0hBZ3dOQ3lPRkFpU0hBZ3dNQ3lPR0FpU0hBZ3dMQ3lPSUFpU0hBZ3dLQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2hDR0FVSC9BWEVraHdJTUNRc2pnZ0lraHdJTUNBc2pnd0lraUFJTUJ3c2poQUlraUFJTUJnc2poUUlraUFJTUJRc2poZ0lraUFJTUJBc2pod0lraUFJTUF3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISVFoZ0ZCL3dGeEpJZ0NEQUlMSTRJQ0pJZ0NEQUVMUVg4UEMwRUVDNVFEQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCSEJFQWdBRUh4QUVZTkFRSkFJQUJCOGdCckRnNERCQVVHQndnSkNnc01EUTRQRVFBTERBOExJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlJNE1DRUh3TUR3c2ppQUpCL3dGeEk0Y0NRZjhCY1VFSWRISWpoQUlRZkF3T0N5T0lBa0gvQVhFamh3SkIvd0Z4UVFoMGNpT0ZBaEI4REEwTEk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUk0WUNFSHdNREFzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJamh3SVFmQXdMQ3lPSUFrSC9BWEVqaHdKQi93RnhRUWgwY2lPSUFoQjhEQW9MSS9vQlJRUkFBa0Fqc0FFRVFFRUJKSTBDREFFTEk3SUJJN2dCY1VFZmNVVUVRRUVCSkk0Q0RBRUxRUUVrandJTEN3d0pDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaU9DQWhCOERBZ0xJNE1DSklJQ0RBY0xJNFFDSklJQ0RBWUxJNFVDSklJQ0RBVUxJNFlDSklJQ0RBUUxJNGNDSklJQ0RBTUxJNGdDSklJQ0RBSUxJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlFSVlCUWY4QmNTU0NBZ3dCQzBGL0R3dEJCQXMzQVFGL0lBRkJBRTRFUUNBQVFmOEJjU0FBSUFGcVFmOEJjVXNRZ2dFRklBRkJIM1VpQWlBQklBSnFjeUFBUWY4QmNVb1FnZ0VMQ3pNQkFuOGpnZ0lpQVNBQVFmOEJjU0lDRUg4Z0FTQUNFSThCSUFBZ0FXcEIvd0Z4SWdFa2dnSWdBVVVRZ0FGQkFCQ0JBUXRYQVFKL0k0SUNJZ0VnQUdvamlRSkJCSFpCQVhGcVFmOEJjU0lDSUFBZ0FYTnpRUkJ4UVFCSEVINGdBRUgvQVhFZ0FXb2ppUUpCQkhaQkFYRnFRWUFDY1VFQVN4Q0NBU0FDSklJQ0lBSkZFSUFCUVFBUWdRRUxnd0lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR0FBVWNFUUNBQlFZRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqZ3dJUWtBRU1FQXNqaEFJUWtBRU1Ed3NqaFFJUWtBRU1EZ3NqaGdJUWtBRU1EUXNqaHdJUWtBRU1EQXNqaUFJUWtBRU1Dd3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElRaGdFUWtBRU1DZ3NqZ2dJUWtBRU1DUXNqZ3dJUWtRRU1DQXNqaEFJUWtRRU1Cd3NqaFFJUWtRRU1CZ3NqaGdJUWtRRU1CUXNqaHdJUWtRRU1CQXNqaUFJUWtRRU1Bd3NqaUFKQi93RnhJNGNDUWY4QmNVRUlkSElRaGdFUWtRRU1BZ3NqZ2dJUWtRRU1BUXRCZnc4TFFRUUxOZ0VDZnlPQ0FpSUJJQUJCL3dGeFFYOXNJZ0lRZnlBQklBSVFqd0VnQVNBQWEwSC9BWEVpQVNTQ0FpQUJSUkNBQVVFQkVJRUJDMWNCQW44amdnSWlBU0FBYXlPSkFrRUVka0VCY1d0Qi93RnhJZ0lnQUNBQmMzTkJFSEZCQUVjUWZpQUJJQUJCL3dGeGF5T0pBa0VFZGtFQmNXdEJnQUp4UVFCTEVJSUJJQUlrZ2dJZ0FrVVFnQUZCQVJDQkFRdURBZ0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFaQUJSd1JBSUFGQmtRRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9EQWhDVEFRd1FDeU9FQWhDVEFRd1BDeU9GQWhDVEFRd09DeU9HQWhDVEFRd05DeU9IQWhDVEFRd01DeU9JQWhDVEFRd0xDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaENHQVJDVEFRd0tDeU9DQWhDVEFRd0pDeU9EQWhDVUFRd0lDeU9FQWhDVUFRd0hDeU9GQWhDVUFRd0dDeU9HQWhDVUFRd0ZDeU9IQWhDVUFRd0VDeU9JQWhDVUFRd0RDeU9JQWtIL0FYRWpod0pCL3dGeFFRaDBjaENHQVJDVUFRd0NDeU9DQWhDVUFRd0JDMEYvRHd0QkJBc2pBUUYvSTRJQ0lBQnhJZ0VrZ2dJZ0FVVVFnQUZCQUJDQkFVRUJFSDVCQUJDQ0FRc25BUUYvSTRJQ0lBQnpRZjhCY1NJQkpJSUNJQUZGRUlBQlFRQVFnUUZCQUJCK1FRQVFnZ0VMZ3dJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdnQVVjRVFDQUJRYUVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzamd3SVFsZ0VNRUFzamhBSVFsZ0VNRHdzamhRSVFsZ0VNRGdzamhnSVFsZ0VNRFFzamh3SVFsZ0VNREFzamlBSVFsZ0VNQ3dzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRVFsZ0VNQ2dzamdnSVFsZ0VNQ1Fzamd3SVFsd0VNQ0FzamhBSVFsd0VNQndzamhRSVFsd0VNQmdzamhnSVFsd0VNQlFzamh3SVFsd0VNQkFzamlBSVFsd0VNQXdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJUWhnRVFsd0VNQWdzamdnSVFsd0VNQVF0QmZ3OExRUVFMSlFBamdnSWdBSEpCL3dGeElnQWtnZ0lnQUVVUWdBRkJBQkNCQVVFQUVINUJBQkNDQVFzckFRRi9JNElDSWdFZ0FFSC9BWEZCZjJ3aUFCQi9JQUVnQUJDUEFTQUFJQUZxUlJDQUFVRUJFSUVCQzRNQ0FRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCc0FGSEJFQWdBVUd4QVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEk0TUNFSmtCREJBTEk0UUNFSmtCREE4TEk0VUNFSmtCREE0TEk0WUNFSmtCREEwTEk0Y0NFSmtCREF3TEk0Z0NFSmtCREFzTEk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUVJWUJFSmtCREFvTEk0SUNFSmtCREFrTEk0TUNFSm9CREFnTEk0UUNFSm9CREFjTEk0VUNFSm9CREFZTEk0WUNFSm9CREFVTEk0Y0NFSm9CREFRTEk0Z0NFSm9CREFNTEk0Z0NRZjhCY1NPSEFrSC9BWEZCQ0hSeUVJWUJFSm9CREFJTEk0SUNFSm9CREFFTFFYOFBDMEVFQ3pzQkFYOGdBQkJZSWdGQmYwWUVmeUFBRUFJRklBRUxRZjhCY1NBQVFRRnFJZ0VRV0NJQVFYOUdCSDhnQVJBQ0JTQUFDMEgvQVhGQkNIUnlDd3NBUVFnUWVTQUFFSndCQ3pNQUlBQkJnQUZ4UVlBQlJoQ0NBU0FBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVpQUVVUWdBRkJBQkNCQVVFQUVINGdBQXN4QUNBQVFRRnhRUUJMRUlJQklBQkJCM1FnQUVIL0FYRkJBWFp5UWY4QmNTSUFSUkNBQVVFQUVJRUJRUUFRZmlBQUN6a0JBWDhqaVFKQkJIWkJBWEVnQUVFQmRISkIvd0Z4SVFFZ0FFR0FBWEZCZ0FGR0VJSUJJQUVpQUVVUWdBRkJBQkNCQVVFQUVINGdBQXM2QVFGL0k0a0NRUVIyUVFGeFFRZDBJQUJCL3dGeFFRRjJjaUVCSUFCQkFYRkJBVVlRZ2dFZ0FTSUFSUkNBQVVFQUVJRUJRUUFRZmlBQUN5a0FJQUJCZ0FGeFFZQUJSaENDQVNBQVFRRjBRZjhCY1NJQVJSQ0FBVUVBRUlFQlFRQVFmaUFBQzBRQkFuOGdBRUVCY1VFQlJpRUJJQUJCZ0FGeFFZQUJSaUVDSUFCQi93RnhRUUYySWdCQmdBRnlJQUFnQWhzaUFFVVFnQUZCQUJDQkFVRUFFSDRnQVJDQ0FTQUFDeW9BSUFCQkQzRkJCSFFnQUVId0FYRkJCSFp5SWdCRkVJQUJRUUFRZ1FGQkFCQitRUUFRZ2dFZ0FBc3RBUUYvSUFCQkFYRkJBVVloQVNBQVFmOEJjVUVCZGlJQVJSQ0FBVUVBRUlFQlFRQVFmaUFCRUlJQklBQUxIUUJCQVNBQWRDQUJjVUgvQVhGRkVJQUJRUUFRZ1FGQkFSQitJQUVMc1FnQkJuOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJCM0VpQmlJRkJFQWdCVUVCYXc0SEFRSURCQVVHQndnTEk0TUNJUUVNQndzamhBSWhBUXdHQ3lPRkFpRUJEQVVMSTRZQ0lRRU1CQXNqaHdJaEFRd0RDeU9JQWlFQkRBSUxJNGdDUWY4QmNTT0hBa0gvQVhGQkNIUnlFSVlCSVFFTUFRc2pnZ0loQVFzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lGSWdRRVFDQUVRUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lBQVFRZE1CSDlCQVNFQ0lBRVFuZ0VGSUFCQkQwd0VmMEVCSVFJZ0FSQ2ZBUVZCQUFzTElRTU1Ed3NnQUVFWFRBUi9RUUVoQWlBQkVLQUJCU0FBUVI5TUJIOUJBU0VDSUFFUW9RRUZRUUFMQ3lFRERBNExJQUJCSjB3RWYwRUJJUUlnQVJDaUFRVWdBRUV2VEFSL1FRRWhBaUFCRUtNQkJVRUFDd3NoQXd3TkN5QUFRVGRNQkg5QkFTRUNJQUVRcEFFRklBQkJQMHdFZjBFQklRSWdBUkNsQVFWQkFBc0xJUU1NREFzZ0FFSEhBRXdFZjBFQklRSkJBQ0FCRUtZQkJTQUFRYzhBVEFSL1FRRWhBa0VCSUFFUXBnRUZRUUFMQ3lFRERBc0xJQUJCMXdCTUJIOUJBU0VDUVFJZ0FSQ21BUVVnQUVIZkFFd0VmMEVCSVFKQkF5QUJFS1lCQlVFQUN3c2hBd3dLQ3lBQVFlY0FUQVIvUVFFaEFrRUVJQUVRcGdFRklBQkI3d0JNQkg5QkFTRUNRUVVnQVJDbUFRVkJBQXNMSVFNTUNRc2dBRUgzQUV3RWYwRUJJUUpCQmlBQkVLWUJCU0FBUWY4QVRBUi9RUUVoQWtFSElBRVFwZ0VGUVFBTEN5RUREQWdMSUFCQmh3Rk1CSDlCQVNFQ0lBRkJmbkVGSUFCQmp3Rk1CSDlCQVNFQ0lBRkJmWEVGUVFBTEN5RUREQWNMSUFCQmx3Rk1CSDlCQVNFQ0lBRkJlM0VGSUFCQm53Rk1CSDlCQVNFQ0lBRkJkM0VGUVFBTEN5RUREQVlMSUFCQnB3Rk1CSDlCQVNFQ0lBRkJiM0VGSUFCQnJ3Rk1CSDlCQVNFQ0lBRkJYM0VGUVFBTEN5RUREQVVMSUFCQnR3Rk1CSDlCQVNFQ0lBRkJ2Mzl4QlNBQVFiOEJUQVIvUVFFaEFpQUJRZjkrY1FWQkFBc0xJUU1NQkFzZ0FFSEhBVXdFZjBFQklRSWdBVUVCY2dVZ0FFSFBBVXdFZjBFQklRSWdBVUVDY2dWQkFBc0xJUU1NQXdzZ0FFSFhBVXdFZjBFQklRSWdBVUVFY2dVZ0FFSGZBVXdFZjBFQklRSWdBVUVJY2dWQkFBc0xJUU1NQWdzZ0FFSG5BVXdFZjBFQklRSWdBVUVRY2dVZ0FFSHZBVXdFZjBFQklRSWdBVUVnY2dWQkFBc0xJUU1NQVFzZ0FFSDNBVXdFZjBFQklRSWdBVUhBQUhJRklBQkIvd0ZNQkg5QkFTRUNJQUZCZ0FGeUJVRUFDd3NoQXdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFZaUJBUkFJQVJCQVdzT0J3RUNBd1FGQmdjSUN5QURKSU1DREFjTElBTWtoQUlNQmdzZ0F5U0ZBZ3dGQ3lBREpJWUNEQVFMSUFNa2h3SU1Bd3NnQXlTSUFnd0NDeUFGUVFSSUlnUUVmeUFFQlNBRlFRZEtDd1JBSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5SUFNUWZBc01BUXNnQXlTQ0FndEJCRUYvSUFJYkM2c0VBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSEFBVWNFUUNBQVFjRUJhdzRQQVFJUkF3UUZCZ2NJQ1FvTEVBd05EZ3NqaVFKQkIzWkJBWEVORVF3T0N5T0tBaENkQVVILy93TnhJUUFqaWdKQkFtcEIvLzhEY1NTS0FpQUFRWUQrQTNGQkNIVWtnd0lnQUVIL0FYRWtoQUpCQkE4TEk0a0NRUWQyUVFGeERSRU1EZ3NqaVFKQkIzWkJBWEVORUF3TUN5T0tBa0VDYTBILy93TnhJZ0FraWdJZ0FDT0VBa0gvQVhFamd3SkIvd0Z4UVFoMGNoQ0VBUXdOQ3hCNkVKQUJEQTBMSTRvQ1FRSnJRZi8vQTNFaUFDU0tBaUFBSTRzQ0VJUUJRUUFraXdJTUN3c2ppUUpCQjNaQkFYRkJBVWNOQ2d3SEN5T0tBaUlBRUowQlFmLy9BM0VraXdJZ0FFRUNha0gvL3dOeEpJb0NEQWtMSTRrQ1FRZDJRUUZ4UVFGR0RRY01DZ3NRZWtIL0FYRVFwd0VoQUNPTEFrRUJha0gvL3dOeEpJc0NJQUFQQ3lPSkFrRUhka0VCY1VFQlJ3MElJNG9DUVFKclFmLy9BM0VpQUNTS0FpQUFJNHNDUVFKcVFmLy9BM0VRaEFFTUJRc1FlaENSQVF3R0N5T0tBa0VDYTBILy93TnhJZ0FraWdJZ0FDT0xBaENFQVVFSUpJc0NEQVFMUVg4UEN5T0tBaUlBRUowQlFmLy9BM0VraXdJZ0FFRUNha0gvL3dOeEpJb0NRUXdQQ3lPS0FrRUNhMEgvL3dOeElnQWtpZ0lnQUNPTEFrRUNha0gvL3dOeEVJUUJDeEI3UWYvL0EzRWtpd0lMUVFnUEN5T0xBa0VCYWtILy93TnhKSXNDUVFRUEN5T0xBa0VDYWtILy93TnhKSXNDUVF3THFnUUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGSEJFQWdBRUhSQVdzT0R3RUNEUU1FQlFZSENBa05DZzBMREEwTEk0a0NRUVIyUVFGeERROGppZ0lpQUJDZEFVSC8vd054SklzQ0lBQkJBbXBCLy84RGNTU0tBa0VNRHdzamlnSWlBQkNkQVVILy93TnhJUUVnQUVFQ2FrSC8vd054SklvQ0lBRkJnUDREY1VFSWRTU0ZBaUFCUWY4QmNTU0dBa0VFRHdzamlRSkJCSFpCQVhFTkN3d01DeU9KQWtFRWRrRUJjUTBLSTRvQ1FRSnJRZi8vQTNFaUFTU0tBaUFCSTRzQ1FRSnFRZi8vQTNFUWhBRU1Dd3NqaWdKQkFtdEIvLzhEY1NJQkpJb0NJQUVqaGdKQi93RnhJNFVDUWY4QmNVRUlkSElRaEFFTUN3c1FlaENUQVF3TEN5T0tBa0VDYTBILy93TnhJZ0VraWdJZ0FTT0xBaENFQVVFUUpJc0NEQWtMSTRrQ1FRUjJRUUZ4UVFGSERRZ2ppZ0lpQVJDZEFVSC8vd054SklzQ0lBRkJBbXBCLy84RGNTU0tBa0VNRHdzamlnSWlBUkNkQVVILy93TnhKSXNDUVFFa3NRRWdBVUVDYWtILy93TnhKSW9DREFjTEk0a0NRUVIyUVFGeFFRRkdEUVVNQkFzamlRSkJCSFpCQVhGQkFVY05BeU9LQWtFQ2EwSC8vd054SWdFa2lnSWdBU09MQWtFQ2FrSC8vd054RUlRQkRBUUxFSG9RbEFFTUJRc2ppZ0pCQW10Qi8vOERjU0lCSklvQ0lBRWppd0lRaEFGQkdDU0xBZ3dEQzBGL0R3c2ppd0pCQW1wQi8vOERjU1NMQWtFTUR3c1FlMEgvL3dOeEpJc0NDMEVJRHdzaml3SkJBV3BCLy84RGNTU0xBa0VFQzUwREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUZIQkVBZ0FFSGhBV3NPRHdFQ0N3c0RCQVVHQndnTEN3c0pDZ3NMRUhwQi93RnhRWUQrQTJvamdnSVFmQXdMQ3lPS0FpSUFFSjBCUWYvL0EzRWhBU0FBUVFKcVFmLy9BM0VraWdJZ0FVR0EvZ054UVFoMUpJY0NJQUZCL3dGeEpJZ0NRUVFQQ3lPRUFrR0EvZ05xSTRJQ0VIeEJCQThMSTRvQ1FRSnJRZi8vQTNFaUFTU0tBaUFCSTRnQ1FmOEJjU09IQWtIL0FYRkJDSFJ5RUlRQlFRZ1BDeEI2RUpZQkRBY0xJNG9DUVFKclFmLy9BM0VpQVNTS0FpQUJJNHNDRUlRQlFTQWtpd0pCQ0E4TEVIcEJHSFJCR0hVaEFTT0tBaUFCUVFFUWhRRWppZ0lnQVdwQi8vOERjU1NLQWtFQUVJQUJRUUFRZ1FFaml3SkJBV3BCLy84RGNTU0xBa0VNRHdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJa2l3SkJCQThMRUh0Qi8vOERjU09DQWhCOEk0c0NRUUpxUWYvL0EzRWtpd0pCQkE4TEVIb1Fsd0VNQWdzamlnSkJBbXRCLy84RGNTSUJKSW9DSUFFaml3SVFoQUZCS0NTTEFrRUlEd3RCZnc4TEk0c0NRUUZxUWYvL0EzRWtpd0pCQkF2V0F3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJSd1JBSUFCQjhRRnJEZzhCQWdNTkJBVUdCd2dKQ2cwTkN3d05DeEI2UWY4QmNVR0EvZ05xRUlZQlFmOEJjU1NDQWd3TkN5T0tBaUlBRUowQlFmLy9BM0VoQVNBQVFRSnFRZi8vQTNFa2lnSWdBVUdBL2dOeFFRaDFKSUlDSUFGQi93RnhKSWtDREEwTEk0UUNRWUQrQTJvUWhnRkIvd0Z4SklJQ0RBd0xRUUFrc0FFTUN3c2ppZ0pCQW10Qi8vOERjU0lCSklvQ0lBRWppUUpCL3dGeEk0SUNRZjhCY1VFSWRISVFoQUZCQ0E4TEVIb1FtUUVNQ0FzamlnSkJBbXRCLy84RGNTSUJKSW9DSUFFaml3SVFoQUZCTUNTTEFrRUlEd3NRZWtFWWRFRVlkU0VCSTRvQ0lRQkJBQkNBQVVFQUVJRUJJQUFnQVVFQkVJVUJJQUFnQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraHdJZ0FFSC9BWEVraUFJaml3SkJBV3BCLy84RGNTU0xBa0VJRHdzamlBSkIvd0Z4STRjQ1FmOEJjVUVJZEhJa2lnSkJDQThMRUh0Qi8vOERjUkNHQVVIL0FYRWtnZ0lqaXdKQkFtcEIvLzhEY1NTTEFnd0ZDMEVCSkxFQkRBUUxFSG9RbWdFTUFnc2ppZ0pCQW10Qi8vOERjU0lBSklvQ0lBQWppd0lRaEFGQk9DU0xBa0VJRHd0QmZ3OExJNHNDUVFGcVFmLy9BM0VraXdJTFFRUUw0d0VCQVg4aml3SkJBV3BCLy84RGNTRUJJNDhDQkVBZ0FVRUJhMEgvL3dOeElRRUxJQUVraXdJQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVhGQkJIVWlBUVJBSUFGQkFVWU5BUUpBSUFGQkFtc09EUU1FQlFZSENBa0tDd3dORGc4QUN3d1BDeUFBRUljQkR3c2dBQkNJQVE4TElBQVFpUUVQQ3lBQUVJb0JEd3NnQUJDTEFROExJQUFRakFFUEN5QUFFSTBCRHdzZ0FCQ09BUThMSUFBUWtnRVBDeUFBRUpVQkR3c2dBQkNZQVE4TElBQVFtd0VQQ3lBQUVLZ0JEd3NnQUJDcEFROExJQUFRcWdFUEN5QUFFS3NCQzc0QkFRSi9RUUFrc0FGQmovNERFQUpCQVNBQWRFRi9jM0VpQVNTNEFVR1AvZ01nQVJBRkk0b0NRUUpyUWYvL0EzRWtpZ0lqaWdJaUFTT0xBaUlDUWY4QmNSQUZJQUZCQVdvZ0FrR0EvZ054UVFoMUVBVUNRQUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVDUUNBQVFRSnJEZ01EQkFVQUN3d0ZDMEVBSkxrQlFjQUFKSXNDREFRTFFRQWt1Z0ZCeUFBa2l3SU1Bd3RCQUNTN0FVSFFBQ1NMQWd3Q0MwRUFKTHdCUWRnQUpJc0NEQUVMUVFBa3ZRRkI0QUFraXdJTEMva0JBUU4vSTdFQkJFQkJBU1N3QVVFQUpMRUJDeU95QVNPNEFYRkJIM0ZCQUVvRVFDT09Ba1Vqc0FFaUFpQUNHd1IvSTdrQkk3TUJJZ0FnQUJzRWYwRUFFSzBCUVFFRkk3b0JJN1FCSWdBZ0FCc0VmMEVCRUswQlFRRUZJN3NCSTdVQklnQWdBQnNFZjBFQ0VLMEJRUUVGSTd3Qkk3WUJJZ0FnQUJzRWYwRURFSzBCUVFFRkk3MEJJN2NCSWdBZ0FCc0VmMEVFRUswQlFRRUZRUUFMQ3dzTEN3VkJBQXNFUUNPTkFpSUFJNDRDSUFBYkJIOUJBQ1NPQWtFQUpJMENRUUFrandKQkFDU1FBa0VZQlVFVUN5RUJDeU9OQWlJQUk0NENJQUFiQkVCQkFDU09Ba0VBSkkwQ1FRQWtqd0pCQUNTUUFnc2dBUThMUVFBTHV3RUJBbjlCQVNTYUFpT1BBZ1JBSTRzQ0VBSkIvd0Z4RUt3QkVIbEJBQ1NPQWtFQUpJMENRUUFrandKQkFDU1FBZ3NRcmdFaUFFRUFTZ1JBSUFBUWVRdEJCQ0VCSTQwQ0lnQWpqZ0lnQUJ0RklnQUVmeU9RQWtVRklBQUxCRUFqaXdJUUFrSC9BWEVRckFFaEFRc2ppUUpCOEFGeEpJa0NJQUZCQUV3RVFDQUJEd3NnQVJCNUk1WUNRUUZxSWdBamxBSk9CSDhqbFFKQkFXb2tsUUlnQUNPVUFtc0ZJQUFMSkpZQ0k0c0NJOVlCUmdSQVFRRWsyUUVMSUFFTEJRQWpyZ0VMekFFQkJIOGdBRUYvUVlBSUlBQkJBRWdiSUFCQkFFb2JJUU5CQUNFQUEwQUNmd0ovSUFSRklnRUVRQ0FBUlNFQkN5QUJDd1JBSUFKRklRRUxJQUVMQkVBajJRRkZJUUVMSUFFRVFCQ3ZBVUVBU0FSQVFRRWhCQVVqakFKQjBLUUVJNEVDZEU0RVFFRUJJUUFGSUFOQmYwb2lBUVJBSTY0QklBTk9JUUVMUVFFZ0FpQUJHeUVDQ3dzTUFRc0xJQUFFUUNPTUFrSFFwQVFqZ1FKMGF5U01BaU9YQWc4TElBSUVRQ09ZQWc4TEk5a0JCRUJCQUNUWkFTT1pBZzhMSTRzQ1FRRnJRZi8vQTNFa2l3SkJmd3NIQUVGL0VMRUJDemtCQTM4RFFDQUNJQUJJSWdNRWZ5QUJRUUJPQlNBREN3UkFRWDhRc1FFaEFTQUNRUUZxSVFJTUFRc0xJQUZCQUVnRVFDQUJEd3RCQUFzRkFDT1JBZ3NGQUNPU0Fnc0ZBQ09UQWd0ZkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lQTEFROExJODRCRHdzanpBRVBDeVBOQVE4TEk4OEJEd3NqMEFFUEN5UFJBUThMSTlJQkR3dEJBQXVMQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUFpQWtFQlJnMEJBa0FnQWtFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQVVFQVJ5VExBUXdIQ3lBQlFRQkhKTTRCREFZTElBRkJBRWNrekFFTUJRc2dBVUVBUnlUTkFRd0VDeUFCUVFCSEpNOEJEQU1MSUFGQkFFY2swQUVNQWdzZ0FVRUFSeVRSQVF3QkN5QUJRUUJISk5JQkN3dFZBUUYvUVFBa2tBSWdBQkMzQVVVRVFFRUJJUUVMSUFCQkFSQzRBU0FCQkVCQkFVRUJRUUJCQVVFQUlBQkJBMHdiSWdFajFBRWlBQ0FBR3hzZ0FVVWoxUUVpQUNBQUd4c0VRRUVCSkwwQlFRUVFQUXNMQ3drQUlBQkJBQkM0QVF1YUFRQWdBRUVBU2dSQVFRQVF1UUVGUVFBUXVnRUxJQUZCQUVvRVFFRUJFTGtCQlVFQkVMb0JDeUFDUVFCS0JFQkJBaEM1QVFWQkFoQzZBUXNnQTBFQVNnUkFRUU1RdVFFRlFRTVF1Z0VMSUFSQkFFb0VRRUVFRUxrQkJVRUVFTG9CQ3lBRlFRQktCRUJCQlJDNUFRVkJCUkM2QVFzZ0JrRUFTZ1JBUVFZUXVRRUZRUVlRdWdFTElBZEJBRW9FUUVFSEVMa0JCVUVIRUxvQkN3c0hBQ0FBSk5ZQkN3Y0FRWDhrMWdFTEJ3QWdBQ1RYQVFzSEFFRi9KTmNCQ3djQUlBQWsyQUVMQndCQmZ5VFlBUXNGQUNPQ0Fnc0ZBQ09EQWdzRkFDT0VBZ3NGQUNPRkFnc0ZBQ09HQWdzRkFDT0hBZ3NGQUNPSUFnc0ZBQ09KQWdzRkFDT0xBZ3NGQUNPS0Fnc0xBQ09MQWhBQ1FmOEJjUXNGQUNQbUFRdkJBd0VLZjBHQWdBSkJnSkFDSTk4Qkd5RUpRWUM0QWtHQXNBSWo0QUViSVFvRFFDQUdRWUFDU0FSQVFRQWhCUU5BSUFWQmdBSklCRUFnQ1NBR1FRTjFRUVYwSUFwcUlBVkJBM1ZxSWdOQmdKQithaTBBQUJBd0lRZ2dCa0VJYnlFQlFRY2dCVUVJYjJzaEIwRUFJUUlDZnlBQVFRQktJNEFDSWdRZ0JCc0VRQ0FEUVlEUWZtb3RBQUFoQWdzZ0FrSEFBSEVMQkVCQkJ5QUJheUVCQzBFQUlRUWdBVUVCZENBSWFpSURRWUNRZm1wQkFVRUFJQUpCQ0hFYklnUkJBWEZCRFhScUxRQUFJUWhCQUNFQklBTkJnWkIrYWlBRVFRRnhRUTEwYWkwQUFFRUJJQWQwY1FSQVFRSWhBUXNnQVVFQmFpQUJRUUVnQjNRZ0NIRWJJUUVnQmtFSWRDQUZha0VEYkNFSElBQkJBRW9qZ0FJaUF5QURHd1JBSUFKQkIzRWdBVUVBRURFaUFVRWZjVUVEZENFRUlBRkI0QWR4UVFWMVFRTjBJUU1nQVVHQStBRnhRUXAxUVFOMElRSWdCMEdBb1F0cUlnRWdCRG9BQUNBQlFRRnFJQU02QUFBZ0FVRUNhaUFDT2dBQUJTQUhRWUNoQzJvaUFpQUJRY2YrQXhBeUlnRkJnSUQ4QjNGQkVIVTZBQUFnQWtFQmFpQUJRWUQrQTNGQkNIVTZBQUFnQWtFQ2FpQUJPZ0FBQ3lBRlFRRnFJUVVNQVFzTElBWkJBV29oQmd3QkN3c0wzUU1CREg4RFFDQURRUmRPUlFSQVFRQWhBZ05BSUFKQkgwZ0VRRUVCUVFBZ0FrRVBTaHNoQ1NBRFFROXJJQU1nQTBFUFNodEJCSFFpQnlBQ1FROXJhaUFDSUFkcUlBSkJEMG9iSVFkQmdKQUNRWUNBQWlBRFFROUtHeUVMUWNmK0F5RUtRWDhoQVVGL0lRaEJBQ0VFQTBBZ0JFRUlTQVJBUVFBaEFBTkFJQUJCQlVnRVFDQUFRUU4wSUFScVFRSjBJZ1ZCZ3Z3RGFoQUNJQWRHQkVBZ0JVR0QvQU5xRUFJaEJrRUJRUUFnQmtFSWNVRUFSeU9BQWlPQUFoc2JJQWxHQkVCQkNDRUVRUVVoQUNBR0lnaEJFSEVFZjBISi9nTUZRY2orQXdzaENnc0xJQUJCQVdvaEFBd0JDd3NnQkVFQmFpRUVEQUVMQ3lBSVFRQklJNEFDSWdZZ0Joc0VRRUdBdUFKQmdMQUNJK0FCR3lFRVFYOGhBRUVBSVFFRFFDQUJRU0JJQkVCQkFDRUZBMEFnQlVFZ1NBUkFJQVZCQlhRZ0JHb2dBV29pQmtHQWtINXFMUUFBSUFkR0JFQkJJQ0VGSUFZaEFFRWdJUUVMSUFWQkFXb2hCUXdCQ3dzZ0FVRUJhaUVCREFFTEN5QUFRUUJPQkg4Z0FFR0EwSDVxTFFBQUJVRi9DeUVCQzBFQUlRQURRQ0FBUVFoSUJFQWdCeUFMSUFsQkFFRUhJQUFnQWtFRGRDQURRUU4wSUFCcVFmZ0JRWUNoRnlBS0lBRWdDQkF6R2lBQVFRRnFJUUFNQVFzTElBSkJBV29oQWd3QkN3c2dBMEVCYWlFRERBRUxDd3VhQWdFSmZ3TkFJQVJCQ0U1RkJFQkJBQ0VCQTBBZ0FVRUZTQVJBSUFGQkEzUWdCR3BCQW5RaUFFR0EvQU5xRUFJYUlBQkJnZndEYWhBQ0dpQUFRWUw4QTJvUUFpRUNRUUVoQlNQaEFRUkFJQUpCQW05QkFVWUVRQ0FDUVFGcklRSUxRUUloQlFzZ0FFR0QvQU5xRUFJaEJrRUFJUWRCQVVFQUlBWkJDSEZCQUVjamdBSWpnQUliR3lFSFFjaitBeUVJUWNuK0EwSEkvZ01nQmtFUWNSc2hDRUVBSVFBRFFDQUFJQVZJQkVCQkFDRURBMEFnQTBFSVNBUkFJQUFnQW1wQmdJQUNJQWRCQUVFSElBTWdCRUVEZENBQlFRUjBJQU5xSUFCQkEzUnFRY0FBUVlDaElDQUlRWDhnQmhBekdpQURRUUZxSVFNTUFRc0xJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUVMQ3lBRVFRRnFJUVFNQVFzTEN3VUFJNzhCQ3dVQUk4QUJDd1VBSThNQkN4Z0JBWDhqeFFFaEFDUEVBUVJBSUFCQkJISWhBQXNnQUFzd0FRRi9BMEFDUUNBQVFmLy9BMDROQUNBQVFZQ2h5UVJxSUFBUVdUb0FBQ0FBUVFGcUlRQU1BUXNMUVFBazJRRUxGZ0FRQUQ4QVFaUUJTQVJBUVpRQlB3QnJRQUFhQ3dzREFBRUxIUUFDUUFKQUFrQWptd0lPQWdFQ0FBc0FDMEVBSVFBTElBQVFzUUVMQndBZ0FDU2JBZ3NsQUFKQUFrQUNRQUpBSTVzQ0RnTUJBZ01BQ3dBTFFRRWhBQXRCZnlFQkN5QUJFTEVCQ3dBekVITnZkWEpqWlUxaGNIQnBibWRWVWt3aFkyOXlaUzlrYVhOMEwyTnZjbVV1ZFc1MGIzVmphR1ZrTG5kaGMyMHViV0Z3IikpLmluc3RhbmNlOwpjb25zdCBiPW5ldyBVaW50OEFycmF5KGEuZXhwb3J0cy5tZW1vcnkuYnVmZmVyKTtyZXR1cm57aW5zdGFuY2U6YSxieXRlTWVtb3J5OmIsdHlwZToiV2ViIEFzc2VtYmx5In19O2xldCByLHUsRCxjO2M9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsCldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sc3BlZWQ6MCxmcmFtZVNraXBDb3VudGVyOjAsY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kczowLG1lc3NhZ2VIYW5kbGVyOihhKT0+e2NvbnN0IGI9bihhKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5DT05ORUNUOiJHUkFQSElDUyI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGMuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSwKcShILmJpbmQodm9pZCAwLGMpLGMuZ3JhcGhpY3NXb3JrZXJQb3J0KSk6Ik1FTU9SWSI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGMubWVtb3J5V29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShLLmJpbmQodm9pZCAwLGMpLGMubWVtb3J5V29ya2VyUG9ydCkpOiJDT05UUk9MTEVSIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5jb250cm9sbGVyV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShKLmJpbmQodm9pZCAwLGMpLGMuY29udHJvbGxlcldvcmtlclBvcnQpKToiQVVESU8iPT09Yi5tZXNzYWdlLndvcmtlcklkJiYoYy5hdWRpb1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoSS5iaW5kKHZvaWQgMCxjKSxjLmF1ZGlvV29ya2VyUG9ydCkpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuSU5TVEFOVElBVEVfV0FTTTooYXN5bmMoKT0+e2xldCBhO2E9YXdhaXQgTyhwKTtjLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2Mud2FzbUJ5dGVNZW1vcnk9CmEuYnl0ZU1lbW9yeTtrKGgoe3R5cGU6YS50eXBlfSxiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIGYuQ09ORklHOmMud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KGMsYi5tZXNzYWdlLmNvbmZpZyk7Yy5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUkVTRVRfQVVESU9fUVVFVUU6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5QTEFZOmlmKCFjLnBhdXNlZHx8IWMud2FzbUluc3RhbmNlfHwhYy53YXNtQnl0ZU1lbW9yeSl7ayhoKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTticmVha31jLnBhdXNlZD0hMTtjLmZwc1RpbWVTdGFtcHM9W107dyhjKTtjLmZyYW1lU2tpcENvdW50ZXI9MDtjLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtjLm9wdGlvbnMuaXNHYmNDb2xvcml6YXRpb25FbmFibGVkPwpjLm9wdGlvbnMuZ2JjQ29sb3JpemF0aW9uUGFsZXR0ZSYmYy53YXNtSW5zdGFuY2UuZXhwb3J0cy5zZXRNYW51YWxDb2xvcml6YXRpb25QYWxldHRlKCJ3YXNtYm95Z2IgYnJvd24gcmVkIGRhcmticm93biBncmVlbiBkYXJrZ3JlZW4gaW52ZXJ0ZWQgcGFzdGVsbWl4IG9yYW5nZSB5ZWxsb3cgYmx1ZSBkYXJrYmx1ZSBncmF5c2NhbGUiLnNwbGl0KCIgIikuaW5kZXhPZihjLm9wdGlvbnMuZ2JjQ29sb3JpemF0aW9uUGFsZXR0ZS50b0xvd2VyQ2FzZSgpKSk6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5zZXRNYW51YWxDb2xvcml6YXRpb25QYWxldHRlKDApO0UoYywxRTMvYy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUEFVU0U6Yy5wYXVzZWQ9ITA7Yy51cGRhdGVJZCYmKGNsZWFyVGltZW91dChjLnVwZGF0ZUlkKSxjLnVwZGF0ZUlkPXZvaWQgMCk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SVU5fV0FTTV9FWFBPUlQ6YT0KYi5tZXNzYWdlLnBhcmFtZXRlcnM/Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XS5hcHBseSh2b2lkIDAsYi5tZXNzYWdlLnBhcmFtZXRlcnMpOmMud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0oKTtrKGgoe3R5cGU6Zi5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046e2E9MDtsZXQgZD1jLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiLm1lc3NhZ2Uuc3RhcnQmJihhPWIubWVzc2FnZS5zdGFydCk7Yi5tZXNzYWdlLmVuZCYmKGQ9Yi5tZXNzYWdlLmVuZCk7YT1jLndhc21CeXRlTWVtb3J5LnNsaWNlKGEsZCkuYnVmZmVyO2soaCh7dHlwZTpmLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCksW2FdKTticmVha31jYXNlIGYuR0VUX1dBU01fQ09OU1RBTlQ6ayhoKHt0eXBlOmYuR0VUX1dBU01fQ09OU1RBTlQscmVzcG9uc2U6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkZPUkNFX09VVFBVVF9GUkFNRTpCKGMpO2JyZWFrO2Nhc2UgZi5TRVRfU1BFRUQ6Yy5zcGVlZD1iLm1lc3NhZ2Uuc3BlZWQ7Yy5mcHNUaW1lU3RhbXBzPVtdO2MudGltZVN0YW1wc1VudGlsUmVhZHk9NjA7dyhjKTtjLmZyYW1lU2tpcENvdW50ZXI9MDtjLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtjLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTticmVhaztjYXNlIGYuSVNfR0JDOmE9MDxjLndhc21JbnN0YW5jZS5leHBvcnRzLmlzR0JDKCk7ayhoKHt0eXBlOmYuSVNfR0JDLHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZygiVW5rbm93biBXYXNtQm95IFdvcmtlciBtZXNzYWdlOiIsYil9fSxnZXRGUFM6KCk9PjA8Yy50aW1lU3RhbXBzVW50aWxSZWFkeT9jLnNwZWVkJiYwPGMuc3BlZWQ/Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUqYy5zcGVlZDpjLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZToKYy5mcHNUaW1lU3RhbXBzP2MuZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07cShjLm1lc3NhZ2VIYW5kbGVyKX0pKCk7Cg==";

var wasmboyGraphicsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGgoYSxiKXtlP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTprLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGUpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZSlzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugay5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZihhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZCsrLGI9YCR7Yn0tJHtkfWAsMUU1PGQmJihkPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGU9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaztlfHwoaz1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZD0wLGw7Y29uc3Qgbj0oYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6aChmKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOnthPW5ldyBVaW50OENsYW1wZWRBcnJheShhLm1lc3NhZ2UuZ3JhcGhpY3NGcmFtZUJ1ZmZlcik7Y29uc3QgYj1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTIxNjApO2ZvcihsZXQgYz0wOzE0ND5jOysrYyl7bGV0IGU9NDgwKmMsZj02NDAqYztmb3IobGV0IGM9MDsxNjA+YzsrK2Mpe2NvbnN0IGQ9ZSszKmMsZz1mKyhjPDwyKTtiW2crMF09YVtkKzBdO2JbZysxXT1hW2QrMV07YltnKzJdPWFbZCsyXTtiW2crM109MjU1fX1hPWJ9aChmKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bSgoYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNPTk5FQ1QiOmw9CmEubWVzc2FnZS5wb3J0c1swXTttKG4sbCk7aChmKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmwucG9zdE1lc3NhZ2UoZih7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

var wasmboyAudioWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG0oYSxiKXtjP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpuLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gcChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGMpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoYylzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugbi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZChhLGIscil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksaysrLGI9YCR7Yn0tJHtrfWAsMUU1PGsmJihrPTApKTtyZXR1cm57d29ya2VySWQ6cixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGM9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgbjtjfHwobj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgaz0wO2NvbnN0IHE9KGEpPT57YT0oYS0xKS8xMjctMTsuMDA4Pk1hdGguYWJzKGEpJiYoYT0wKTtyZXR1cm4gYS8yLjV9O2xldCBsO2NvbnN0IHQ9KGEpPT57Y29uc3QgYj1hLmRhdGE/YS5kYXRhOmE7aWYoYi5tZXNzYWdlKXN3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjptKGQoYi5tZXNzYWdlLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiVVBEQVRFRCI6e2NvbnN0IGE9e3R5cGU6IlVQREFURUQiLG51bWJlck9mU2FtcGxlczpiLm1lc3NhZ2UubnVtYmVyT2ZTYW1wbGVzLGZwczpiLm1lc3NhZ2UuZnBzLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzpiLm1lc3NhZ2UuYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nfSxjPVtdO1siYXVkaW9CdWZmZXIiLCJjaGFubmVsMUJ1ZmZlciIsImNoYW5uZWwyQnVmZmVyIiwiY2hhbm5lbDNCdWZmZXIiLCJjaGFubmVsNEJ1ZmZlciJdLmZvckVhY2goKGQpPT57aWYoYi5tZXNzYWdlW2RdKXt7dmFyIGY9Cm5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtkXSk7dmFyIGc9Yi5tZXNzYWdlLm51bWJlck9mU2FtcGxlcztjb25zdCBhPW5ldyBGbG9hdDMyQXJyYXkoZyk7dmFyIGg9bmV3IEZsb2F0MzJBcnJheShnKTtsZXQgYz0wO2cqPTI7Zm9yKHZhciBlPTA7ZTxnO2UrPTIpYVtjXT1xKGZbZV0pLGMrKztjPTA7Zm9yKGU9MTtlPGc7ZSs9MiloW2NdPXEoZltlXSksYysrO2Y9YS5idWZmZXI7aD1oLmJ1ZmZlcn1hW2RdPXt9O2FbZF0ubGVmdD1mO2FbZF0ucmlnaHQ9aDtjLnB1c2goZik7Yy5wdXNoKGgpfX0pO20oZChhKSxjKX19fTtwKChhKT0+e2E9YS5kYXRhP2EuZGF0YTphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6bD1hLm1lc3NhZ2UucG9ydHNbMF07cCh0LGwpO20oZCh2b2lkIDAsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTIjpsLnBvc3RNZXNzYWdlKGQoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiQVVESU9fTEFURU5DWSI6bC5wb3N0TWVzc2FnZShkKGEubWVzc2FnZSwKYS5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGEpfX0pfSkoKTsK";

var wasmboyControllerWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihjKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKGMpc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIGUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLGQrKyxiPWAke2J9LSR7ZH1gLDFFNTxkJiYoZD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1jb25zdCBjPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY7bGV0IGU7Y3x8KGU9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtsZXQgZD0wLGY7Y29uc3Qgaz0oYSk9Pnt9O2coKGEpPT57YT1hLmRhdGE/YS5kYXRhOgphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6Zj1hLm1lc3NhZ2UucG9ydHNbMF07ZyhrLGYpO2E9aCh2b2lkIDAsYS5tZXNzYWdlSWQpO2M/c2VsZi5wb3N0TWVzc2FnZShhLHZvaWQgMCk6ZS5wb3N0TWVzc2FnZShhLHZvaWQgMCk7YnJlYWs7Y2FzZSAiU0VUX0pPWVBBRF9TVEFURSI6Zi5wb3N0TWVzc2FnZShoKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYSl9fSl9KSgpOwo=";

var wasmboyMemoryWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGY7Y29uc3Qgaz0oYSxiKT0+e2NvbnN0IGQ9W107T2JqZWN0LmtleXMoYi5tZXNzYWdlKS5mb3JFYWNoKChhKT0+eyJ0eXBlIiE9PWEmJmQucHVzaChiLm1lc3NhZ2VbYV0pfSk7Y29uc3QgZT1jKGIubWVzc2FnZSxiLm1lc3NhZ2VJZCk7YT9mLnBvc3RNZXNzYWdlKGUsZCk6ZyhlLGQpfSxtPShhKT0+e2E9YS5kYXRhP2EuZGF0YTphO2lmKGEubWVzc2FnZSlzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNMRUFSX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSxbYS5tZXNzYWdlLndhc21CeXRlTWVtb3J5XSk7YnJlYWs7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiU0VUX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6ayghMSxhKTticmVhaztjYXNlICJVUERBVEVEIjprKCExLGEpfX07bCgoYSk9PnthPQphLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpmPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sZik7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkNMRUFSX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKHt0eXBlOiJDTEVBUl9NRU1PUlkifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmYucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlNFVF9NRU1PUlkiOmsoITAsYSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

// Smarter workers.
// Workers with ids, pub sub, etc...
// https://medium.com/dailyjs/threads-in-node-10-5-0-a-practical-intro-3b85a0a3c953
const {
  Worker
} = require('worker_threads');

let idCounter = 0;

const generateId = () => {
  const randomId = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(2, 10);
  idCounter++;
  const id = `${randomId}-${idCounter}`;

  if (idCounter > 100000) {
    idCounter = 0;
  }

  return id;
};

function getSmartWorkerMessage(message, messageId, workerId) {
  if (!messageId) {
    messageId = generateId();
  }

  return {
    workerId,
    messageId,
    message
  };
}
class SmartWorker {
  constructor(workerUrl, id) {
    this.id = generateId();

    if (id) {
      this.id = id;
    }

    this.messageListeners = [];
    /*ROLLUP_REPLACE_PROD_BROWSER
    
    // Can't load base63 data string directly because safari
    // https://stackoverflow.com/questions/10343913/how-to-create-a-web-worker-from-a-string
     let workerJs = atob(workerUrl.split(',')[1]);
    let blob;
    try {
      blob = new Blob([workerJs], {type: 'application/javascript'});
    } catch (e) {
      // Legacy
      window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
      blob = new BlobBuilder();
      blob.append(workerJs);
      blob = blob.getBlob();
    }
    this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = this._onMessageHandler.bind(this);
    
    ROLLUP_REPLACE_PROD_BROWSER*/

    /*ROLLUP_REPLACE_DEV_BROWSER
     this.worker = new Worker(workerUrl);
    this.worker.onmessage = this._onMessageHandler.bind(this);
     ROLLUP_REPLACE_DEV_BROWSER*/
    // Split by Comma, to remove the file header from the base 64 string

    const workerAsString = readBase64String(workerUrl);
    this.worker = new Worker(workerAsString, {
      eval: true
    });
    this.worker.on('message', this._onMessageHandler.bind(this));
  }

  postMessageIgnoreResponse(message, transfer) {
    const messageObject = getSmartWorkerMessage(message, undefined, this.id);
    this.worker.postMessage(messageObject, transfer);
  }

  postMessage(message, transfer) {
    const messageObject = getSmartWorkerMessage(message, undefined, this.id);
    const messageId = messageObject.messageId;
    const messageIdListener = new Promise((resolve, reject) => {
      // Set a timeout before killing the message listener
      let messageDroppedTimeout = setTimeout(() => {
        console.warn('Message dropped', message);
        this.removeMessageListener(messageId);
        reject();
      }, 500); // Listen for a message with the same message id to be returned

      this.addMessageListener((responseMessage, messageListener) => {
        const eventData = getEventData(responseMessage);

        if (eventData.messageId === messageId) {
          clearTimeout(messageDroppedTimeout);
          messageDroppedTimeout = undefined;
          this.removeMessageListener(messageListener.id);
          resolve(eventData);
        }
      });
    });
    this.worker.postMessage(messageObject, transfer);
    return messageIdListener;
  }

  addMessageListener(callback) {
    this.messageListeners.push({
      id: generateId(),
      callback: callback
    });
  }

  removeMessageListener(id) {
    let messageListenerIndex;
    this.messageListeners.some((messageListener, index) => {
      if (messageListener.id === id) {
        messageListenerIndex = index;
        return true;
      }

      return false;
    });

    if (messageListenerIndex !== undefined) {
      this.messageListeners.splice(messageListenerIndex, 1);
    }
  }

  _onMessageHandler(message) {
    this.messageListeners.forEach(messageListener => {
      messageListener.callback(message, messageListener);
    });
  }

}

// WasmBoy Modules

const {
  MessageChannel
} = require('worker_threads');

const instantiateWorkers = async () => {
  // Create our workers
  let libWorkerUrl;
  libWorkerUrl = wasmboyLibWasmWorkerUrl;
  const libWorker = new SmartWorker(libWorkerUrl, WORKER_ID.LIB);
  const graphicsWorker = new SmartWorker(wasmboyGraphicsWorkerUrl, WORKER_ID.GRAPHICS);
  const audioWorker = new SmartWorker(wasmboyAudioWorkerUrl, WORKER_ID.AUDIO);
  const controllerWorker = new SmartWorker(wasmboyControllerWorkerUrl, WORKER_ID.CONTROLLER);
  const memoryWorker = new SmartWorker(wasmboyMemoryWorkerUrl, WORKER_ID.MEMORY); // Create an array of promises for when each worker is ready

  const workerReadyPromises = []; // Add our workers to an array,

  const childWorkers = [graphicsWorker, audioWorker, controllerWorker, memoryWorker]; // Create a messaging channel between our main lib worker,
  // And all of the children workers

  childWorkers.forEach(childWorker => {
    // Create our message channel
    // https://stackoverflow.com/questions/14191394/web-workers-communication-using-messagechannel-html5
    const messageChannel = new MessageChannel();
    const workerReadyPromise = new Promise(resolve => {
      // Our resolve function
      let messagesReceived = 0;

      const tryResolveWorkerReady = () => {
        messagesReceived++;

        if (messagesReceived >= 2) {
          resolve();
        }
      }; // Post our connect messages


      libWorker.postMessage({
        type: WORKER_MESSAGE_TYPE.CONNECT,
        workerId: childWorker.id,
        ports: [messageChannel.port1]
      }, [messageChannel.port1]).then(() => {
        tryResolveWorkerReady();
      });
      childWorker.postMessage({
        type: WORKER_MESSAGE_TYPE.CONNECT,
        workerId: libWorker.id,
        ports: [messageChannel.port2]
      }, [messageChannel.port2]).then(() => {
        tryResolveWorkerReady();
      });
    });
    workerReadyPromises.push(workerReadyPromise);
  }); // Wait for all workers to be ready

  await Promise.all(workerReadyPromises); // Finally, pass the ready workers to all of our children lib

  WasmBoyGraphics.setWorker(graphicsWorker);
  WasmBoyAudio.setWorker(audioWorker);
  WasmBoyController.setWorker(controllerWorker);
  WasmBoyMemory.setWorker(memoryWorker); // Return the main worker for the main lib

  return libWorker;
};

// Taken/Modified From: https://github.com/photopea/UZIP.js
let UZIP = {}; // Make it a hacky es module

const uzip = UZIP;

UZIP['parse'] = function (buf // ArrayBuffer
) {
  let rUs = UZIP.bin.readUshort,
      rUi = UZIP.bin.readUint,
      o = 0,
      out = {};
  let data = new Uint8Array(buf);
  let eocd = data.length - 4;

  while (rUi(data, eocd) != 0x06054b50) eocd--;

  o = eocd;
  o += 4; // sign  = 0x06054b50

  o += 4; // disks = 0;

  let cnu = rUs(data, o);
  o += 2;
  let cnt = rUs(data, o);
  o += 2;
  let csize = rUi(data, o);
  o += 4;
  let coffs = rUi(data, o);
  o += 4;
  o = coffs;

  for (let i = 0; i < cnu; i++) {
    let sign = rUi(data, o);
    o += 4;
    o += 4; // versions;

    o += 4; // flag + compr

    o += 4; // time

    let crc32 = rUi(data, o);
    o += 4;
    let csize = rUi(data, o);
    o += 4;
    let usize = rUi(data, o);
    o += 4;
    let nl = rUs(data, o),
        el = rUs(data, o + 2),
        cl = rUs(data, o + 4);
    o += 6; // name, extra, comment

    o += 8; // disk, attribs

    let roff = rUi(data, o);
    o += 4;
    o += nl + el + cl;

    UZIP._readLocal(data, roff, out, csize, usize);
  } //console.log(out);


  return out;
};

UZIP._readLocal = function (data, o, out, csize, usize) {
  let rUs = UZIP.bin.readUshort,
      rUi = UZIP.bin.readUint;
  let sign = rUi(data, o);
  o += 4;
  let ver = rUs(data, o);
  o += 2;
  let gpflg = rUs(data, o);
  o += 2; //if((gpflg&8)!=0) throw "unknown sizes";

  let cmpr = rUs(data, o);
  o += 2;
  let time = rUi(data, o);
  o += 4;
  let crc32 = rUi(data, o);
  o += 4; //let csize = rUi(data, o);  o+=4;
  //let usize = rUi(data, o);  o+=4;

  o += 8;
  let nlen = rUs(data, o);
  o += 2;
  let elen = rUs(data, o);
  o += 2;
  let name = UZIP.bin.readUTF8(data, o, nlen);
  o += nlen;
  o += elen; //console.log(sign.toString(16), ver, gpflg, cmpr, crc32.toString(16), "csize, usize", csize, usize, nlen, elen, name, o);

  let file = new Uint8Array(data.buffer, o);

  if (cmpr == 0) out[name] = new Uint8Array(file.buffer.slice(o, o + csize));else if (cmpr == 8) {
    let buf = new Uint8Array(usize);
    UZIP.inflateRaw(file, buf); //let nbuf = pako["inflateRaw"](file);
    //for(let i=0; i<buf.length; i++) if(buf[i]!=nbuf[i]) {  console.log(buf.length, nbuf.length, usize, i);  throw "e";  }

    out[name] = buf;
  } else throw 'unknown compression method: ' + cmpr;
};

UZIP.inflateRaw = function (file, buf) {
  return UZIP.F.inflate(file, buf);
};

UZIP.inflate = function (file, buf) {
  let CMF = file[0],
      FLG = file[1];

  return UZIP.inflateRaw(new Uint8Array(file.buffer, file.byteOffset + 2, file.length - 6), buf);
};

UZIP.deflate = function (data, opts
/*, buf, off*/
) {
  if (opts == null) opts = {
    level: 6
  };
  let off = 0,
      buf = new Uint8Array(50 + Math.floor(data.length * 1.1));
  buf[off] = 120;
  buf[off + 1] = 156;
  off += 2;
  off = UZIP.F.deflateRaw(data, buf, off, opts.level);
  let crc = UZIP.adler(data, 0, data.length);
  buf[off + 0] = crc >>> 24 & 255;
  buf[off + 1] = crc >>> 16 & 255;
  buf[off + 2] = crc >>> 8 & 255;
  buf[off + 3] = crc >>> 0 & 255;
  return new Uint8Array(buf.buffer, 0, off + 4);
};

UZIP.deflateRaw = function (data, opts) {
  if (opts == null) opts = {
    level: 6
  };
  let buf = new Uint8Array(50 + Math.floor(data.length * 1.1));
  let off;
  off = UZIP.F.deflateRaw(data, buf, off, opts.level);
  return new Uint8Array(buf.buffer, 0, off);
};

UZIP.encode = function (obj) {
  let tot = 0,
      wUi = UZIP.bin.writeUint,
      wUs = UZIP.bin.writeUshort;
  let zpd = {};

  for (let p in obj) {
    let cpr = !UZIP._noNeed(p),
        buf = obj[p],
        crc = UZIP.crc.crc(buf, 0, buf.length);
    zpd[p] = {
      cpr: cpr,
      usize: buf.length,
      crc: crc,
      file: cpr ? UZIP.deflateRaw(buf) : buf
    };
  }

  for (let p in zpd) tot += zpd[p].file.length + 30 + 46 + 2 * UZIP.bin.sizeUTF8(p);

  tot += 22;
  let data = new Uint8Array(tot),
      o = 0;
  let fof = [];

  for (let p in zpd) {
    let file = zpd[p];
    fof.push(o);
    o = UZIP._writeHeader(data, o, p, file, 0);
  }

  let i = 0,
      ioff = o;

  for (let p in zpd) {
    let file = zpd[p];
    fof.push(o);
    o = UZIP._writeHeader(data, o, p, file, 1, fof[i++]);
  }

  let csize = o - ioff;
  wUi(data, o, 0x06054b50);
  o += 4;
  o += 4; // disks

  wUs(data, o, i);
  o += 2;
  wUs(data, o, i);
  o += 2; // number of c d records

  wUi(data, o, csize);
  o += 4;
  wUi(data, o, ioff);
  o += 4;
  o += 2;
  return data.buffer;
}; // no need to compress .PNG, .ZIP, .JPEG ....


UZIP._noNeed = function (fn) {
  let ext = fn.split('.').pop().toLowerCase();
  return 'png,jpg,jpeg,zip'.indexOf(ext) != -1;
};

UZIP._writeHeader = function (data, o, p, obj, t, roff) {
  let wUi = UZIP.bin.writeUint,
      wUs = UZIP.bin.writeUshort;
  let file = obj.file;
  wUi(data, o, t == 0 ? 0x04034b50 : 0x02014b50);
  o += 4; // sign

  if (t == 1) o += 2; // ver made by

  wUs(data, o, 20);
  o += 2; // ver

  wUs(data, o, 0);
  o += 2; // gflip

  wUs(data, o, obj.cpr ? 8 : 0);
  o += 2; // cmpr

  wUi(data, o, 0);
  o += 4; // time

  wUi(data, o, obj.crc);
  o += 4; // crc32

  wUi(data, o, file.length);
  o += 4; // csize

  wUi(data, o, obj.usize);
  o += 4; // usize

  wUs(data, o, UZIP.bin.sizeUTF8(p));
  o += 2; // nlen

  wUs(data, o, 0);
  o += 2; // elen

  if (t == 1) {
    o += 2; // comment length

    o += 2; // disk number

    o += 6; // attributes

    wUi(data, o, roff);
    o += 4; // usize
  }

  let nlen = UZIP.bin.writeUTF8(data, o, p);
  o += nlen;

  if (t == 0) {
    data.set(file, o);
    o += file.length;
  }

  return o;
};

UZIP.crc = {
  table: function () {
    let tab = new Uint32Array(256);

    for (let n = 0; n < 256; n++) {
      let c = n;

      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ c >>> 1;else c = c >>> 1;
      }

      tab[n] = c;
    }

    return tab;
  }(),
  update: function (c, buf, off, len) {
    for (let i = 0; i < len; i++) c = UZIP.crc.table[(c ^ buf[off + i]) & 0xff] ^ c >>> 8;

    return c;
  },
  crc: function (b, o, l) {
    return UZIP.crc.update(0xffffffff, b, o, l) ^ 0xffffffff;
  }
};

UZIP.adler = function (data, o, len) {
  let a = 1,
      b = 0;
  let off = o,
      end = o + len;

  while (off < end) {
    let eend = Math.min(off + 5552, end);

    while (off < eend) {
      a += data[off++];
      b += a;
    }

    a = a % 65521;
    b = b % 65521;
  }

  return b << 16 | a;
};

UZIP.bin = {
  readUshort: function (buff, p) {
    return buff[p] | buff[p + 1] << 8;
  },
  writeUshort: function (buff, p, n) {
    buff[p] = n & 255;
    buff[p + 1] = n >> 8 & 255;
  },
  readUint: function (buff, p) {
    return buff[p + 3] * (256 * 256 * 256) + (buff[p + 2] << 16 | buff[p + 1] << 8 | buff[p]);
  },
  writeUint: function (buff, p, n) {
    buff[p] = n & 255;
    buff[p + 1] = n >> 8 & 255;
    buff[p + 2] = n >> 16 & 255;
    buff[p + 3] = n >> 24 & 255;
  },
  readASCII: function (buff, p, l) {
    let s = '';

    for (let i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]);

    return s;
  },
  writeASCII: function (data, p, s) {
    for (let i = 0; i < s.length; i++) data[p + i] = s.charCodeAt(i);
  },
  pad: function (n) {
    return n.length < 2 ? '0' + n : n;
  },
  readUTF8: function (buff, p, l) {
    let s = '',
        ns;

    for (let i = 0; i < l; i++) s += '%' + UZIP.bin.pad(buff[p + i].toString(16));

    try {
      ns = decodeURIComponent(s);
    } catch (e) {
      return UZIP.bin.readASCII(buff, p, l);
    }

    return ns;
  },
  writeUTF8: function (buff, p, str) {
    let strl = str.length,
        i = 0;

    for (let ci = 0; ci < strl; ci++) {
      let code = str.charCodeAt(ci);

      if ((code & 0xffffffff - (1 << 7) + 1) == 0) {
        buff[p + i] = code;
        i++;
      } else if ((code & 0xffffffff - (1 << 11) + 1) == 0) {
        buff[p + i] = 192 | code >> 6;
        buff[p + i + 1] = 128 | code >> 0 & 63;
        i += 2;
      } else if ((code & 0xffffffff - (1 << 16) + 1) == 0) {
        buff[p + i] = 224 | code >> 12;
        buff[p + i + 1] = 128 | code >> 6 & 63;
        buff[p + i + 2] = 128 | code >> 0 & 63;
        i += 3;
      } else if ((code & 0xffffffff - (1 << 21) + 1) == 0) {
        buff[p + i] = 240 | code >> 18;
        buff[p + i + 1] = 128 | code >> 12 & 63;
        buff[p + i + 2] = 128 | code >> 6 & 63;
        buff[p + i + 3] = 128 | code >> 0 & 63;
        i += 4;
      } else throw 'e';
    }

    return i;
  },
  sizeUTF8: function (str) {
    let strl = str.length,
        i = 0;

    for (let ci = 0; ci < strl; ci++) {
      let code = str.charCodeAt(ci);

      if ((code & 0xffffffff - (1 << 7) + 1) == 0) {
        i++;
      } else if ((code & 0xffffffff - (1 << 11) + 1) == 0) {
        i += 2;
      } else if ((code & 0xffffffff - (1 << 16) + 1) == 0) {
        i += 3;
      } else if ((code & 0xffffffff - (1 << 21) + 1) == 0) {
        i += 4;
      } else throw 'e';
    }

    return i;
  }
};
UZIP.F = {};

UZIP.F.deflateRaw = function (data, out, opos, lvl) {
  let opts = [
  /*
  ush good_length; /* reduce lazy search above this match length 
  ush max_lazy;    /* do not perform lazy search above this match length 
       ush nice_length; /* quit search above this match length 
  */

  /*      good lazy nice chain */

  /* 0 */
  [0, 0, 0, 0, 0]
  /* store only */
  ,
  /* 1 */
  [4, 4, 8, 4, 0]
  /* max speed, no lazy matches */
  ,
  /* 2 */
  [4, 5, 16, 8, 0],
  /* 3 */
  [4, 6, 16, 16, 0],
  /* 4 */
  [4, 10, 16, 32, 0]
  /* lazy matches */
  ,
  /* 5 */
  [8, 16, 32, 32, 0],
  /* 6 */
  [8, 16, 128, 128, 0],
  /* 7 */
  [8, 32, 128, 256, 0],
  /* 8 */
  [32, 128, 258, 1024, 1],
  /* 9 */
  [32, 258, 258, 4096, 1]];
  /* max compression */

  let opt = opts[lvl];
  let U = UZIP.F.U,
      goodIndex = UZIP.F._goodIndex,
      hash = UZIP.F._hash,
      putsE = UZIP.F._putsE;
  let i = 0,
      pos = opos << 3,
      cvrd = 0,
      dlen = data.length;

  if (lvl == 0) {
    while (i < dlen) {
      let len = Math.min(0xffff, dlen - i);
      putsE(out, pos, i + len == dlen ? 1 : 0);
      pos = UZIP.F._copyExact(data, i, len, out, pos + 8);
      i += len;
    }

    return pos >>> 3;
  }

  let lits = U.lits,
      strt = U.strt,
      prev = U.prev,
      li = 0,
      lc = 0,
      bs = 0,
      ebits = 0,
      c = 0,
      nc = 0; // last_item, literal_count, block_start

  if (dlen > 2) {
    nc = UZIP.F._hash(data, 0);
    strt[nc] = 0;
  }

  for (i = 0; i < dlen; i++) {
    c = nc; //*

    if (i + 1 < dlen - 2) {
      nc = UZIP.F._hash(data, i + 1);
      let ii = i + 1 & 0x7fff;
      prev[ii] = strt[nc];
      strt[nc] = ii;
    } //*/


    if (cvrd <= i) {
      if (li > 14000 || lc > 26697) {
        if (cvrd < i) {
          lits[li] = i - cvrd;
          li += 2;
          cvrd = i;
        }

        pos = UZIP.F._writeBlock(i == dlen - 1 || cvrd == dlen ? 1 : 0, lits, li, ebits, data, bs, i - bs, out, pos);
        li = lc = ebits = 0;
        bs = i;
      }

      let mch = 0; //if(nmci==i) mch= nmch;  else

      if (i < dlen - 2) mch = UZIP.F._bestMatch(data, i, prev, c, Math.min(opt[2], dlen - i), opt[3]);

      if (mch != 0) {
        let len = mch >>> 16,
            dst = mch & 0xffff; //if(i-dst<0) throw "e";

        let lgi = goodIndex(len, U.of0);
        U.lhst[257 + lgi]++;
        let dgi = goodIndex(dst, U.df0);
        U.dhst[dgi]++;
        ebits += U.exb[lgi] + U.dxb[dgi];
        lits[li] = len << 23 | i - cvrd;
        lits[li + 1] = dst << 16 | lgi << 8 | dgi;
        li += 2;
        cvrd = i + len;
      } else {
        U.lhst[data[i]]++;
      }

      lc++;
    }
  }

  if (bs != i || data.length == 0) {
    if (cvrd < i) {
      lits[li] = i - cvrd;
      li += 2;
      cvrd = i;
    }

    pos = UZIP.F._writeBlock(1, lits, li, ebits, data, bs, i - bs, out, pos);
    li = 0;
    lc = 0;
    li = lc = ebits = 0;
    bs = i;
  }

  while ((pos & 7) != 0) pos++;

  return pos >>> 3;
};

UZIP.F._bestMatch = function (data, i, prev, c, nice, chain) {
  let ci = i & 0x7fff,
      pi = prev[ci]; //console.log("----", i);

  let dif = ci - pi + (1 << 15) & 0x7fff;
  if (pi == ci || c != UZIP.F._hash(data, i - dif)) return 0;
  let tl = 0,
      td = 0; // top length, top distance

  let dlim = Math.min(0x7fff, i);

  while (dif <= dlim && --chain != 0 && pi != ci
  /*&& c==UZIP.F._hash(data,i-dif)*/
  ) {
    if (tl == 0 || data[i + tl] == data[i + tl - dif]) {
      let cl = UZIP.F._howLong(data, i, dif);

      if (cl > tl) {
        tl = cl;
        td = dif;
        if (tl >= nice) break; //*

        if (dif + 2 < cl) cl = dif + 2;
        let maxd = 0; // pi does not point to the start of the word

        for (let j = 0; j < cl - 2; j++) {
          let ei = i - dif + j + (1 << 15) & 0x7fff;
          let li = prev[ei];
          let curd = ei - li + (1 << 15) & 0x7fff;

          if (curd > maxd) {
            maxd = curd;
            pi = ei;
          }
        } //*/

      }
    }

    ci = pi;
    pi = prev[ci];
    dif += ci - pi + (1 << 15) & 0x7fff;
  }

  return tl << 16 | td;
};

UZIP.F._howLong = function (data, i, dif) {
  if (data[i] != data[i - dif] || data[i + 1] != data[i + 1 - dif] || data[i + 2] != data[i + 2 - dif]) return 0;
  let oi = i,
      l = Math.min(data.length, i + 258);
  i += 3; //while(i+4<l && data[i]==data[i-dif] && data[i+1]==data[i+1-dif] && data[i+2]==data[i+2-dif] && data[i+3]==data[i+3-dif]) i+=4;

  while (i < l && data[i] == data[i - dif]) i++;

  return i - oi;
};

UZIP.F._hash = function (data, i) {
  return (data[i] << 8 | data[i + 1]) + (data[i + 2] << 4) & 0xffff; //let hash_shift = 0, hash_mask = 255;
  //let h = data[i+1] % 251;
  //h = (((h << 8) + data[i+2]) % 251);
  //h = (((h << 8) + data[i+2]) % 251);
  //h = ((h<<hash_shift) ^ (c) ) & hash_mask;
  //return h | (data[i]<<8);
  //return (data[i] | (data[i+1]<<8));
}; //UZIP.___toth = 0;


UZIP.saved = 0;

UZIP.F._writeBlock = function (BFINAL, lits, li, ebits, data, o0, l0, out, pos) {
  let U = UZIP.F.U,
      putsF = UZIP.F._putsF,
      putsE = UZIP.F._putsE; //*

  let T, ML, MD, MH, numl, numd, numh, lset, dset;
  U.lhst[256]++;
  T = UZIP.F.getTrees();
  ML = T[0];
  MD = T[1];
  MH = T[2];
  numl = T[3];
  numd = T[4];
  numh = T[5];
  lset = T[6];
  dset = T[7];
  let cstSize = ((pos + 3 & 7) == 0 ? 0 : 8 - (pos + 3 & 7)) + 32 + (l0 << 3);
  let fxdSize = ebits + UZIP.F.contSize(U.fltree, U.lhst) + UZIP.F.contSize(U.fdtree, U.dhst);
  let dynSize = ebits + UZIP.F.contSize(U.ltree, U.lhst) + UZIP.F.contSize(U.dtree, U.dhst);
  dynSize += 14 + 3 * numh + UZIP.F.contSize(U.itree, U.ihst) + (U.ihst[16] * 2 + U.ihst[17] * 3 + U.ihst[18] * 7);

  for (let j = 0; j < 286; j++) U.lhst[j] = 0;

  for (let j = 0; j < 30; j++) U.dhst[j] = 0;

  for (let j = 0; j < 19; j++) U.ihst[j] = 0; //*/


  let BTYPE = cstSize < fxdSize && cstSize < dynSize ? 0 : fxdSize < dynSize ? 1 : 2;
  putsF(out, pos, BFINAL);
  putsF(out, pos + 1, BTYPE);
  pos += 3;

  if (BTYPE == 0) {
    while ((pos & 7) != 0) pos++;

    pos = UZIP.F._copyExact(data, o0, l0, out, pos);
  } else {
    let ltree, dtree;

    if (BTYPE == 1) {
      ltree = U.fltree;
      dtree = U.fdtree;
    }

    if (BTYPE == 2) {
      UZIP.F.makeCodes(U.ltree, ML);
      UZIP.F.revCodes(U.ltree, ML);
      UZIP.F.makeCodes(U.dtree, MD);
      UZIP.F.revCodes(U.dtree, MD);
      UZIP.F.makeCodes(U.itree, MH);
      UZIP.F.revCodes(U.itree, MH);
      ltree = U.ltree;
      dtree = U.dtree;
      putsE(out, pos, numl - 257);
      pos += 5; // 286

      putsE(out, pos, numd - 1);
      pos += 5; // 30

      putsE(out, pos, numh - 4);
      pos += 4; // 19

      for (let i = 0; i < numh; i++) putsE(out, pos + i * 3, U.itree[(U.ordr[i] << 1) + 1]);

      pos += 3 * numh;
      pos = UZIP.F._codeTiny(lset, U.itree, out, pos);
      pos = UZIP.F._codeTiny(dset, U.itree, out, pos);
    }

    let off = o0;

    for (let si = 0; si < li; si += 2) {
      let qb = lits[si],
          len = qb >>> 23,
          end = off + (qb & (1 << 23) - 1);

      while (off < end) pos = UZIP.F._writeLit(data[off++], ltree, out, pos);

      if (len != 0) {
        let qc = lits[si + 1],
            dst = qc >> 16,
            lgi = qc >> 8 & 255,
            dgi = qc & 255;
        pos = UZIP.F._writeLit(257 + lgi, ltree, out, pos);
        putsE(out, pos, len - U.of0[lgi]);
        pos += U.exb[lgi];
        pos = UZIP.F._writeLit(dgi, dtree, out, pos);
        putsF(out, pos, dst - U.df0[dgi]);
        pos += U.dxb[dgi];
        off += len;
      }
    }

    pos = UZIP.F._writeLit(256, ltree, out, pos);
  } //console.log(pos-opos, fxdSize, dynSize, cstSize);


  return pos;
};

UZIP.F._copyExact = function (data, off, len, out, pos) {
  let p8 = pos >>> 3;
  out[p8] = len;
  out[p8 + 1] = len >>> 8;
  out[p8 + 2] = 255 - out[p8];
  out[p8 + 3] = 255 - out[p8 + 1];
  p8 += 4;
  out.set(new Uint8Array(data.buffer, off, len), p8); //for(let i=0; i<len; i++) out[p8+i]=data[off+i];

  return pos + (len + 4 << 3);
};
/*
	Interesting facts:
	- decompressed block can have bytes, which do not occur in a Huffman tree (copied from the previous block by reference)
*/


UZIP.F.getTrees = function () {
  let U = UZIP.F.U;

  let ML = UZIP.F._hufTree(U.lhst, U.ltree, 15);

  let MD = UZIP.F._hufTree(U.dhst, U.dtree, 15);

  let lset = [],
      numl = UZIP.F._lenCodes(U.ltree, lset);

  let dset = [],
      numd = UZIP.F._lenCodes(U.dtree, dset);

  for (let i = 0; i < lset.length; i += 2) U.ihst[lset[i]]++;

  for (let i = 0; i < dset.length; i += 2) U.ihst[dset[i]]++;

  let MH = UZIP.F._hufTree(U.ihst, U.itree, 7);

  let numh = 19;

  while (numh > 4 && U.itree[(U.ordr[numh - 1] << 1) + 1] == 0) numh--;

  return [ML, MD, MH, numl, numd, numh, lset, dset];
};

UZIP.F.getSecond = function (a) {
  let b = [];

  for (let i = 0; i < a.length; i += 2) b.push(a[i + 1]);

  return b;
};

UZIP.F.nonZero = function (a) {
  let b = '';

  for (let i = 0; i < a.length; i += 2) if (a[i + 1] != 0) b += (i >> 1) + ',';

  return b;
};

UZIP.F.contSize = function (tree, hst) {
  let s = 0;

  for (let i = 0; i < hst.length; i++) s += hst[i] * tree[(i << 1) + 1];

  return s;
};

UZIP.F._codeTiny = function (set, tree, out, pos) {
  for (let i = 0; i < set.length; i += 2) {
    let l = set[i],
        rst = set[i + 1]; //console.log(l, pos, tree[(l<<1)+1]);

    pos = UZIP.F._writeLit(l, tree, out, pos);
    let rsl = l == 16 ? 2 : l == 17 ? 3 : 7;

    if (l > 15) {
      UZIP.F._putsE(out, pos, rst, rsl);

      pos += rsl;
    }
  }

  return pos;
};

UZIP.F._lenCodes = function (tree, set) {
  let len = tree.length;

  while (len != 2 && tree[len - 1] == 0) len -= 2; // when no distances, keep one code with length 0


  for (let i = 0; i < len; i += 2) {
    let l = tree[i + 1],
        nxt = i + 3 < len ? tree[i + 3] : -1,
        nnxt = i + 5 < len ? tree[i + 5] : -1,
        prv = i == 0 ? -1 : tree[i - 1];

    if (l == 0 && nxt == l && nnxt == l) {
      let lz = i + 5;

      while (lz + 2 < len && tree[lz + 2] == l) lz += 2;

      let zc = Math.min(lz + 1 - i >>> 1, 138);
      if (zc < 11) set.push(17, zc - 3);else set.push(18, zc - 11);
      i += zc * 2 - 2;
    } else if (l == prv && nxt == l && nnxt == l) {
      let lz = i + 5;

      while (lz + 2 < len && tree[lz + 2] == l) lz += 2;

      let zc = Math.min(lz + 1 - i >>> 1, 6);
      set.push(16, zc - 3);
      i += zc * 2 - 2;
    } else set.push(l, 0);
  }

  return len >>> 1;
};

UZIP.F._hufTree = function (hst, tree, MAXL) {
  let list = [],
      hl = hst.length,
      tl = tree.length,
      i = 0;

  for (i = 0; i < tl; i += 2) {
    tree[i] = 0;
    tree[i + 1] = 0;
  }

  for (i = 0; i < hl; i++) if (hst[i] != 0) list.push({
    lit: i,
    f: hst[i]
  });

  let end = list.length,
      l2 = list.slice(0);
  if (end == 0) return 0; // empty histogram (usually for dist)

  if (end == 1) {
    let lit = list[0].lit,
        l2 = lit == 0 ? 1 : 0;
    tree[(lit << 1) + 1] = 1;
    tree[(l2 << 1) + 1] = 1;
    return 1;
  }

  list.sort(function (a, b) {
    return a.f - b.f;
  });
  let a = list[0],
      b = list[1],
      i0 = 0,
      i1 = 1,
      i2 = 2;
  list[0] = {
    lit: -1,
    f: a.f + b.f,
    l: a,
    r: b,
    d: 0
  };

  while (i1 != end - 1) {
    if (i0 != i1 && (i2 == end || list[i0].f < list[i2].f)) {
      a = list[i0++];
    } else {
      a = list[i2++];
    }

    if (i0 != i1 && (i2 == end || list[i0].f < list[i2].f)) {
      b = list[i0++];
    } else {
      b = list[i2++];
    }

    list[i1++] = {
      lit: -1,
      f: a.f + b.f,
      l: a,
      r: b
    };
  }

  let maxl = UZIP.F.setDepth(list[i1 - 1], 0);

  if (maxl > MAXL) {
    UZIP.F.restrictDepth(l2, MAXL, maxl);
    maxl = MAXL;
  }

  for (i = 0; i < end; i++) tree[(l2[i].lit << 1) + 1] = l2[i].d;

  return maxl;
};

UZIP.F.setDepth = function (t, d) {
  if (t.lit != -1) {
    t.d = d;
    return d;
  }

  return Math.max(UZIP.F.setDepth(t.l, d + 1), UZIP.F.setDepth(t.r, d + 1));
};

UZIP.F.restrictDepth = function (dps, MD, maxl) {
  let i = 0,
      bCost = 1 << maxl - MD,
      dbt = 0;
  dps.sort(function (a, b) {
    return b.d == a.d ? a.f - b.f : b.d - a.d;
  });

  for (i = 0; i < dps.length; i++) if (dps[i].d > MD) {
    let od = dps[i].d;
    dps[i].d = MD;
    dbt += bCost - (1 << maxl - od);
  } else break;

  dbt = dbt >>> maxl - MD;

  while (dbt > 0) {
    let od = dps[i].d;

    if (od < MD) {
      dps[i].d++;
      dbt -= 1 << MD - od - 1;
    } else i++;
  }

  for (; i >= 0; i--) if (dps[i].d == MD && dbt < 0) {
    dps[i].d--;
    dbt++;
  }

  if (dbt != 0) console.log('debt left');
};

UZIP.F._goodIndex = function (v, arr) {
  let i = 0;
  if (arr[i | 16] <= v) i |= 16;
  if (arr[i | 8] <= v) i |= 8;
  if (arr[i | 4] <= v) i |= 4;
  if (arr[i | 2] <= v) i |= 2;
  if (arr[i | 1] <= v) i |= 1;
  return i;
};

UZIP.F._writeLit = function (ch, ltree, out, pos) {
  UZIP.F._putsF(out, pos, ltree[ch << 1]);

  return pos + ltree[(ch << 1) + 1];
};

UZIP.F.inflate = function (data, buf) {
  if (data[0] == 3 && data[1] == 0) return buf ? buf : new Uint8Array(0);
  let F = UZIP.F,
      bitsF = F._bitsF,
      bitsE = F._bitsE,
      decodeTiny = F._decodeTiny,
      makeCodes = F.makeCodes,
      codes2map = F.codes2map,
      get17 = F._get17;
  let U = F.U;
  let noBuf = buf == null;
  if (noBuf) buf = new Uint8Array(data.length >> 2 << 3);
  let BFINAL = 0,
      BTYPE = 0,
      HLIT = 0,
      HDIST = 0,
      HCLEN = 0,
      ML = 0,
      MD = 0;
  let off = 0,
      pos = 0;
  let lmap, dmap;

  while (BFINAL == 0) {
    BFINAL = bitsF(data, pos, 1);
    BTYPE = bitsF(data, pos + 1, 2);
    pos += 3; //console.log(BFINAL, BTYPE);

    if (BTYPE == 0) {
      if ((pos & 7) != 0) pos += 8 - (pos & 7);
      let p8 = (pos >>> 3) + 4,
          len = data[p8 - 4] | data[p8 - 3] << 8; //console.log(len);//bitsF(data, pos, 16),

      if (noBuf) buf = UZIP.F._check(buf, off + len);
      buf.set(new Uint8Array(data.buffer, data.byteOffset + p8, len), off); //for(let i=0; i<len; i++) buf[off+i] = data[p8+i];
      //for(let i=0; i<len; i++) if(buf[off+i] != data[p8+i]) throw "e";

      pos = p8 + len << 3;
      off += len;
      continue;
    }

    if (noBuf) buf = UZIP.F._check(buf, off + (1 << 17));

    if (BTYPE == 1) {
      lmap = U.flmap;
      dmap = U.fdmap;
      ML = (1 << 9) - 1;
      MD = (1 << 5) - 1;
    }

    if (BTYPE == 2) {
      HLIT = bitsE(data, pos, 5) + 257;
      HDIST = bitsE(data, pos + 5, 5) + 1;
      HCLEN = bitsE(data, pos + 10, 4) + 4;
      pos += 14;

      for (let i = 0; i < 38; i += 2) {
        U.itree[i] = 0;
        U.itree[i + 1] = 0;
      }

      let tl = 1;

      for (let i = 0; i < HCLEN; i++) {
        let l = bitsE(data, pos + i * 3, 3);
        U.itree[(U.ordr[i] << 1) + 1] = l;
        if (l > tl) tl = l;
      }

      pos += 3 * HCLEN; //console.log(itree);

      makeCodes(U.itree, tl);
      codes2map(U.itree, tl, U.imap);
      lmap = U.lmap;
      dmap = U.dmap;
      let ml = decodeTiny(U.imap, (1 << tl) - 1, HLIT, data, pos, U.ltree);
      ML = (1 << (ml >>> 24)) - 1;
      pos += ml & 0xffffff;
      makeCodes(U.ltree, ml >>> 24);
      codes2map(U.ltree, ml >>> 24, lmap);
      let md = decodeTiny(U.imap, (1 << tl) - 1, HDIST, data, pos, U.dtree);
      MD = (1 << (md >>> 24)) - 1;
      pos += md & 0xffffff;
      makeCodes(U.dtree, md >>> 24);
      codes2map(U.dtree, md >>> 24, dmap);
    } //let ooff=off, opos=pos;


    while (true) {
      let code = lmap[get17(data, pos) & ML];
      pos += code & 15;
      let lit = code >>> 4; //U.lhst[lit]++;

      if (lit >>> 8 == 0) {
        buf[off++] = lit;
      } else if (lit == 256) {
        break;
      } else {
        let end = off + lit - 254;

        if (lit > 264) {
          let ebs = U.ldef[lit - 257];
          end = off + (ebs >>> 3) + bitsE(data, pos, ebs & 7);
          pos += ebs & 7;
        } //UZIP.F.dst[end-off]++;


        let dcode = dmap[get17(data, pos) & MD];
        pos += dcode & 15;
        let dlit = dcode >>> 4;
        let dbs = U.ddef[dlit],
            dst = (dbs >>> 4) + bitsF(data, pos, dbs & 15);
        pos += dbs & 15; //let o0 = off-dst, stp = Math.min(end-off, dst);
        //if(stp>20) while(off<end) {  buf.copyWithin(off, o0, o0+stp);  off+=stp;  }  else
        //if(end-dst<=off) buf.copyWithin(off, off-dst, end-dst);  else
        //if(dst==1) buf.fill(buf[off-1], off, end);  else

        while (off < end) {
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
        }

        off = end; //while(off!=end) {  buf[off]=buf[off++-dst];  }
      }
    } //console.log(off-ooff, (pos-opos)>>>3);

  } //console.log(UZIP.F.dst);
  //console.log(tlen, dlen, off-tlen+tcnt);


  return buf.length == off ? buf : buf.slice(0, off);
};

UZIP.F._check = function (buf, len) {
  let bl = buf.length;
  if (len <= bl) return buf;
  let nbuf = new Uint8Array(bl << 1);

  for (let i = 0; i < bl; i += 4) {
    nbuf[i] = buf[i];
    nbuf[i + 1] = buf[i + 1];
    nbuf[i + 2] = buf[i + 2];
    nbuf[i + 3] = buf[i + 3];
  }

  return nbuf;
};

UZIP.F._decodeTiny = function (lmap, LL, len, data, pos, tree) {
  let opos = pos;
  let bitsE = UZIP.F._bitsE,
      get17 = UZIP.F._get17;
  let dlen = len << 1,
      i = 0,
      mx = 0; //if(pos<1000) console.log("--------");
  //console.log("----", pos, ":",  data[7],data[8], data[9], data[10], data[11]);

  while (i < dlen) {
    let code = lmap[get17(data, pos) & LL];
    pos += code & 15;
    let lit = code >>> 4; //if(pos<1000) console.log(lit, i>>>1);
    //if(i<20)console.log(lit, code>>>9, pos);

    if (lit <= 15) {
      tree[i] = 0;
      tree[i + 1] = lit;
      if (lit > mx) mx = lit;
      i += 2;
    } else {
      let ll = 0,
          n = 0;

      if (lit == 16) {
        n = 3 + bitsE(data, pos, 2) << 1;
        pos += 2;
        ll = tree[i - 1];
      } else if (lit == 17) {
        n = 3 + bitsE(data, pos, 3) << 1;
        pos += 3;
      } else if (lit == 18) {
        n = 11 + bitsE(data, pos, 7) << 1;
        pos += 7;
      }

      let ni = i + n;

      while (i < ni) {
        tree[i] = 0;
        tree[i + 1] = ll;
        i += 2;
      }
    }
  }

  let tl = tree.length;

  while (i < tl) {
    tree[i + 1] = 0;
    i += 2;
  }

  return mx << 24 | pos - opos;
};

UZIP.F.makeCodes = function (tree, MAX_BITS) {
  // code, length
  let U = UZIP.F.U;
  let max_code = tree.length;
  let code, bits, n, i, len;
  let bl_count = U.bl_count;

  for (let i = 0; i <= MAX_BITS; i++) bl_count[i] = 0;

  for (i = 1; i < max_code; i += 2) bl_count[tree[i]]++;

  let next_code = U.next_code; // smallest code for each length

  code = 0;
  bl_count[0] = 0;

  for (bits = 1; bits <= MAX_BITS; bits++) {
    code = code + bl_count[bits - 1] << 1;
    next_code[bits] = code;
  }

  for (n = 0; n < max_code; n += 2) {
    len = tree[n + 1];

    if (len != 0) {
      tree[n] = next_code[len];
      next_code[len]++;
    }
  }
};

UZIP.F.codes2map = function (tree, MAX_BITS, map) {
  let max_code = tree.length;
  let U = UZIP.F.U,
      r15 = U.rev15;

  for (let i = 0; i < max_code; i += 2) if (tree[i + 1] != 0) {
    let lit = i >> 1;
    let cl = tree[i + 1],
        val = lit << 4 | cl; // :  (0x8000 | (U.of0[lit-257]<<7) | (U.exb[lit-257]<<4) | cl);

    let rest = MAX_BITS - cl,
        i0 = tree[i] << rest,
        i1 = i0 + (1 << rest); //tree[i]=r15[i0]>>>(15-MAX_BITS);

    while (i0 != i1) {
      let p0 = r15[i0] >>> 15 - MAX_BITS;
      map[p0] = val;
      i0++;
    }
  }
};

UZIP.F.revCodes = function (tree, MAX_BITS) {
  let r15 = UZIP.F.U.rev15,
      imb = 15 - MAX_BITS;

  for (let i = 0; i < tree.length; i += 2) {
    let i0 = tree[i] << MAX_BITS - tree[i + 1];
    tree[i] = r15[i0] >>> imb;
  }
};

UZIP.F._putsE = function (dt, pos, val) {
  val = val << (pos & 7);
  let o = pos >>> 3;
  dt[o] |= val;
  dt[o + 1] |= val >>> 8;
};

UZIP.F._putsF = function (dt, pos, val) {
  val = val << (pos & 7);
  let o = pos >>> 3;
  dt[o] |= val;
  dt[o + 1] |= val >>> 8;
  dt[o + 2] |= val >>> 16;
};

UZIP.F._bitsE = function (dt, pos, length) {
  return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8) >>> (pos & 7) & (1 << length) - 1;
};

UZIP.F._bitsF = function (dt, pos, length) {
  return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16) >>> (pos & 7) & (1 << length) - 1;
};
/*
UZIP.F._get9 = function(dt, pos) {
	return ((dt[pos>>>3] | (dt[(pos>>>3)+1]<<8))>>>(pos&7))&511;
} */


UZIP.F._get17 = function (dt, pos) {
  // return at least 17 meaningful bytes
  return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16) >>> (pos & 7);
};

UZIP.F._get25 = function (dt, pos) {
  // return at least 17 meaningful bytes
  return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16 | dt[(pos >>> 3) + 3] << 24) >>> (pos & 7);
};

UZIP.F.U = {
  next_code: new Uint16Array(16),
  bl_count: new Uint16Array(16),
  ordr: [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
  of0: [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 999, 999, 999],
  exb: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0],
  ldef: new Uint16Array(32),
  df0: [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 65535, 65535],
  dxb: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0],
  ddef: new Uint32Array(32),
  flmap: new Uint16Array(512),
  fltree: [],
  fdmap: new Uint16Array(32),
  fdtree: [],
  lmap: new Uint16Array(32768),
  ltree: [],
  dmap: new Uint16Array(32768),
  dtree: [],
  imap: new Uint16Array(512),
  itree: [],
  //rev9 : new Uint16Array(  512)
  rev15: new Uint16Array(1 << 15),
  lhst: new Uint32Array(286),
  dhst: new Uint32Array(30),
  ihst: new Uint32Array(19),
  lits: new Uint32Array(15000),
  strt: new Uint16Array(1 << 16),
  prev: new Uint16Array(1 << 15)
};

(function () {
  let U = UZIP.F.U;
  let len = 1 << 15;

  for (let i = 0; i < len; i++) {
    let x = i;
    x = (x & 0xaaaaaaaa) >>> 1 | (x & 0x55555555) << 1;
    x = (x & 0xcccccccc) >>> 2 | (x & 0x33333333) << 2;
    x = (x & 0xf0f0f0f0) >>> 4 | (x & 0x0f0f0f0f) << 4;
    x = (x & 0xff00ff00) >>> 8 | (x & 0x00ff00ff) << 8;
    U.rev15[i] = (x >>> 16 | x << 16) >>> 17;
  }

  for (let i = 0; i < 32; i++) {
    U.ldef[i] = U.of0[i] << 3 | U.exb[i];
    U.ddef[i] = U.df0[i] << 4 | U.dxb[i];
  }

  let i = 0;

  for (; i <= 143; i++) U.fltree.push(0, 8);

  for (; i <= 255; i++) U.fltree.push(0, 9);

  for (; i <= 279; i++) U.fltree.push(0, 7);

  for (; i <= 287; i++) U.fltree.push(0, 8);

  UZIP.F.makeCodes(U.fltree, 9);
  UZIP.F.codes2map(U.fltree, 9, U.flmap);
  UZIP.F.revCodes(U.fltree, 9);

  for (i = 0; i < 32; i++) U.fdtree.push(0, 5);

  UZIP.F.makeCodes(U.fdtree, 5);
  UZIP.F.codes2map(U.fdtree, 5, U.fdmap);
  UZIP.F.revCodes(U.fdtree, 5);

  for (let i = 0; i < 19; i++) U.itree.push(0, 0);

  for (let i = 0; i < 286; i++) U.ltree.push(0, 0);

  for (let i = 0; i < 30; i++) U.dtree.push(0, 0);
})();

// Modules
// Private function to fetch a game

const fetchROMAsByteArray = (ROM, loadOptions) => {
  const fetchROMAsByteArrayTask = async () => {
    // Check if we were passed straight bytes
    if (ArrayBuffer.isView(ROM) && ROM.constructor === Uint8Array) {
      return {
        ROM: ROM
      };
    } else if (typeof ROM === 'object' && ROM.size) {
      // We were passed a file from HTML file input
      // Read the file as a Uint8Array
      let byteArray = await getROMFromFileReaderAsByteArray(ROM);

      if (ROM.name.toLowerCase().endsWith('.zip')) {
        byteArray = await parseByteArrayAsZip(byteArray);
      }

      return {
        ROM: byteArray,
        name: ROM.name
      };
    } else {
      // We were passed a URL
      // Fetch the file
      // First check if we have headers
      const fetchHeaders = {};

      if (loadOptions && loadOptions.headers) {
        fetchHeaders.headers = loadOptions.headers;
      }

      let bytes = await fetch(ROM, fetchHeaders).then(blob => {
        if (!blob.ok) {
          return Promise.reject(blob);
        }

        return blob.arrayBuffer();
      });
      let fileName = ROM;

      if (loadOptions && loadOptions.fileName) {
        fileName = loadOptions.fileName;
      } // Get our byteArray


      let byteArray = new Uint8Array(bytes);

      if (fileName.toLowerCase().endsWith('.zip')) {
        byteArray = await parseByteArrayAsZip(byteArray);
      }

      return {
        ROM: byteArray,
        name: fileName
      };
    }
  };

  return fetchROMAsByteArrayTask();
};

const getROMFromFileReaderAsByteArray = async ROM => {
  const fileReaderByteArray = await new Promise((resolve, reject) => {
    // Read the file object
    // https://www.javascripture.com/FileReader#readAsArrayBuffer_Blob
    const fileReader = new FileReader();

    fileReader.onload = () => {
      const byteArray = new Uint8Array(fileReader.result);
      resolve(byteArray);
    };

    fileReader.readAsArrayBuffer(ROM);
  });
  return fileReaderByteArray;
}; // Function to parse and find the gb files within an archive


const parseByteArrayAsZip = async byteArray => {
  // Parse the zip using UZIP
  const unzipObject = await uzip.parse(byteArray); // Find the ROM in the output

  let foundROM = false;
  const unzipObjectKeys = Object.keys(unzipObject);
  unzipObjectKeys.some(key => {
    const lowercaseKey = key.toLowerCase();

    if (lowercaseKey.includes('.gb') || lowercaseKey.includes('.gbc')) {
      foundROM = unzipObject[key];
      return true;
    }

    return false;
  });

  if (!foundROM) {
    throw new Error('Could not find a ROM in zip...');
  }

  return foundROM;
};

// Functions here are depedent on WasmBoyMemory state.
// NOTE: **Should bind the wasmboy this here**

function loadROMToWasmBoy(ROM, fetchHeaders) {
  // Getting started with wasm
  // http://webassembly.org/getting-started/js-api/
  this.ready = false;
  this.loadedAndStarted = false;

  const initializeTask = async () => {
    // Get our promises
    const initPromises = [fetchROMAsByteArray(ROM, fetchHeaders), this._instantiateWorkers()];

    if (!this.options.headless && WasmBoyMemory.getLoadedCartridgeMemoryState().RAM) {
      initPromises.push(WasmBoyMemory.saveCartridgeRam());
    }

    let fetchROMObject;
    await Promise.all(initPromises).then(responses => {
      fetchROMObject = responses[0];
    }); // Now tell the wasm module to instantiate wasm

    const response = await this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.INSTANTIATE_WASM
    });
    this.coreType = response.message.type;
    return fetchROMObject;
  };

  const loadROMAndConfigTask = async fetchROMObject => {
    // Clear what is currently in memory, then load the cartridge memory
    await WasmBoyMemory.clearMemory(); // TODO: Handle passing a boot rom

    await WasmBoyMemory.loadCartridgeRom(fetchROMObject.ROM, fetchROMObject.name); // Save the game that we loaded if we need to reload the game

    this.loadedROM = ROM; // Run our initialization on the core

    await this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.CONFIG,
      config: [0, // TODO: Include Boot Rom
      this.options.isGbcEnabled ? 1 : 0, this.options.audioBatchProcessing ? 1 : 0, this.options.graphicsBatchProcessing ? 1 : 0, this.options.timersBatchProcessing ? 1 : 0, this.options.graphicsDisableScanlineRendering ? 1 : 0, this.options.audioAccumulateSamples ? 1 : 0, this.options.tileRendering ? 1 : 0, this.options.tileCaching ? 1 : 0, this.options.enableAudioDebugging ? 1 : 0],
      options: {
        gameboyFrameRate: this.options.gameboyFrameRate,
        headless: this.options.headless,
        isAudioEnabled: this.options.isAudioEnabled,
        isGbcColorizationEnabled: this.options.isGbcColorizationEnabled,
        gbcColorizationPalette: this.options.gbcColorizationPalette,
        enableAudioDebugging: this.options.enableAudioDebugging,
        frameSkip: this.options.frameSkip
      }
    });
  };

  const loadROMTask = async () => {
    // Pause wasmBoy
    await this.pause(); // Initialize any needed parts of wasmboy

    let fetchROMObject = await initializeTask(); // Check if we are running headless

    if (this.options.headless) {
      await WasmBoyMemory.initialize(this.options.headless, this.options.maxNumberOfAutoSaveStates, this.options.saveStateCallback);
      await loadROMAndConfigTask(fetchROMObject);
      this.ready = true;

      if (this.options.onReady) {
        this.options.onReady();
      }
    } else {
      // Finally intialize all of our services
      // Initialize our services
      await Promise.all([WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback), WasmBoyAudio.initialize(this.options.updateAudioCallback), WasmBoyController.initialize(), WasmBoyMemory.initialize(this.options.headless, this.options.maxNumberOfAutoSaveStates, this.options.saveStateCallback)]);
      await loadROMAndConfigTask(fetchROMObject); // Load the game's cartridge ram

      await WasmBoyMemory.loadCartridgeRam();
      this.ready = true;

      if (this.options.onReady) {
        this.options.onReady();
      }
    }
  };

  return loadROMTask();
}

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var performanceNow = createCommonjsModule(function (module) {
// Generated by CoffeeScript 1.12.2
(function() {
  var getNanoSeconds, hrtime, loadTime, moduleLoadTime, nodeLoadTime, upTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - nodeLoadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    moduleLoadTime = getNanoSeconds();
    upTime = process.uptime() * 1e9;
    nodeLoadTime = moduleLoadTime - upTime;
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(commonjsGlobal);


});

var root = typeof window === 'undefined' ? commonjsGlobal : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix];

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix];
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix];
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id$1 = 0
    , queue = []
    , frameDuration = 1000 / 60;

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = performanceNow()
        , next = Math.max(0, frameDuration - (_now - last));
      last = next + _now;
      setTimeout(function() {
        var cp = queue.slice(0);
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0;
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last);
            } catch(e) {
              setTimeout(function() { throw e }, 0);
            }
          }
        }
      }, Math.round(next));
    }
    queue.push({
      handle: ++id$1,
      callback: callback,
      cancelled: false
    });
    return id$1
  };

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true;
      }
    }
  };
}

var raf_1 = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
};
var cancel = function() {
  caf.apply(root, arguments);
};
var polyfill = function(object) {
  if (!object) {
    object = root;
  }
  object.requestAnimationFrame = raf;
  object.cancelAnimationFrame = caf;
};
raf_1.cancel = cancel;
raf_1.polyfill = polyfill;

// Functions here are depedent on WasmBoyMemory state.

function render() {
  // Don't run if paused
  if (this.paused) {
    return true;
  } // Check if we have frameskip


  let shouldSkipRenderingFrame = false;

  if (this.frameSkip && this.frameSkip > 0) {
    this.frameSkipCounter++;

    if (this.frameSkipCounter < this.frameSkip) {
      shouldSkipRenderingFrame = true;
    } else {
      this.frameSkipCounter = 0;
    }
  } // Render the display


  if (!shouldSkipRenderingFrame) {
    WasmBoyGraphics.renderFrame();
  } // Update our controller


  WasmBoyController.updateController();
  this.renderId = raf_1(() => {
    render.call(this);
  });
}

var BigInteger = createCommonjsModule(function (module) {
var bigInt = (function (undefined) {

    var BASE = 1e7,
        LOG_BASE = 7,
        MAX_INT = 9007199254740992,
        MAX_INT_ARR = smallToArray(MAX_INT),
        DEFAULT_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

    var supportsNativeBigInt = typeof BigInt === "function";

    function Integer(v, radix, alphabet, caseSensitive) {
        if (typeof v === "undefined") return Integer[0];
        if (typeof radix !== "undefined") return +radix === 10 && !alphabet ? parseValue(v) : parseBase(v, radix, alphabet, caseSensitive);
        return parseValue(v);
    }

    function BigInteger(value, sign) {
        this.value = value;
        this.sign = sign;
        this.isSmall = false;
    }
    BigInteger.prototype = Object.create(Integer.prototype);

    function SmallInteger(value) {
        this.value = value;
        this.sign = value < 0;
        this.isSmall = true;
    }
    SmallInteger.prototype = Object.create(Integer.prototype);

    function NativeBigInt(value) {
        this.value = value;
    }
    NativeBigInt.prototype = Object.create(Integer.prototype);

    function isPrecise(n) {
        return -MAX_INT < n && n < MAX_INT;
    }

    function smallToArray(n) { // For performance reasons doesn't reference BASE, need to change this function if BASE changes
        if (n < 1e7)
            return [n];
        if (n < 1e14)
            return [n % 1e7, Math.floor(n / 1e7)];
        return [n % 1e7, Math.floor(n / 1e7) % 1e7, Math.floor(n / 1e14)];
    }

    function arrayToSmall(arr) { // If BASE changes this function may need to change
        trim(arr);
        var length = arr.length;
        if (length < 4 && compareAbs(arr, MAX_INT_ARR) < 0) {
            switch (length) {
                case 0: return 0;
                case 1: return arr[0];
                case 2: return arr[0] + arr[1] * BASE;
                default: return arr[0] + (arr[1] + arr[2] * BASE) * BASE;
            }
        }
        return arr;
    }

    function trim(v) {
        var i = v.length;
        while (v[--i] === 0);
        v.length = i + 1;
    }

    function createArray(length) { // function shamelessly stolen from Yaffle's library https://github.com/Yaffle/BigInteger
        var x = new Array(length);
        var i = -1;
        while (++i < length) {
            x[i] = 0;
        }
        return x;
    }

    function truncate(n) {
        if (n > 0) return Math.floor(n);
        return Math.ceil(n);
    }

    function add(a, b) { // assumes a and b are arrays with a.length >= b.length
        var l_a = a.length,
            l_b = b.length,
            r = new Array(l_a),
            carry = 0,
            base = BASE,
            sum, i;
        for (i = 0; i < l_b; i++) {
            sum = a[i] + b[i] + carry;
            carry = sum >= base ? 1 : 0;
            r[i] = sum - carry * base;
        }
        while (i < l_a) {
            sum = a[i] + carry;
            carry = sum === base ? 1 : 0;
            r[i++] = sum - carry * base;
        }
        if (carry > 0) r.push(carry);
        return r;
    }

    function addAny(a, b) {
        if (a.length >= b.length) return add(a, b);
        return add(b, a);
    }

    function addSmall(a, carry) { // assumes a is array, carry is number with 0 <= carry < MAX_INT
        var l = a.length,
            r = new Array(l),
            base = BASE,
            sum, i;
        for (i = 0; i < l; i++) {
            sum = a[i] - base + carry;
            carry = Math.floor(sum / base);
            r[i] = sum - carry * base;
            carry += 1;
        }
        while (carry > 0) {
            r[i++] = carry % base;
            carry = Math.floor(carry / base);
        }
        return r;
    }

    BigInteger.prototype.add = function (v) {
        var n = parseValue(v);
        if (this.sign !== n.sign) {
            return this.subtract(n.negate());
        }
        var a = this.value, b = n.value;
        if (n.isSmall) {
            return new BigInteger(addSmall(a, Math.abs(b)), this.sign);
        }
        return new BigInteger(addAny(a, b), this.sign);
    };
    BigInteger.prototype.plus = BigInteger.prototype.add;

    SmallInteger.prototype.add = function (v) {
        var n = parseValue(v);
        var a = this.value;
        if (a < 0 !== n.sign) {
            return this.subtract(n.negate());
        }
        var b = n.value;
        if (n.isSmall) {
            if (isPrecise(a + b)) return new SmallInteger(a + b);
            b = smallToArray(Math.abs(b));
        }
        return new BigInteger(addSmall(b, Math.abs(a)), a < 0);
    };
    SmallInteger.prototype.plus = SmallInteger.prototype.add;

    NativeBigInt.prototype.add = function (v) {
        return new NativeBigInt(this.value + parseValue(v).value);
    };
    NativeBigInt.prototype.plus = NativeBigInt.prototype.add;

    function subtract(a, b) { // assumes a and b are arrays with a >= b
        var a_l = a.length,
            b_l = b.length,
            r = new Array(a_l),
            borrow = 0,
            base = BASE,
            i, difference;
        for (i = 0; i < b_l; i++) {
            difference = a[i] - borrow - b[i];
            if (difference < 0) {
                difference += base;
                borrow = 1;
            } else borrow = 0;
            r[i] = difference;
        }
        for (i = b_l; i < a_l; i++) {
            difference = a[i] - borrow;
            if (difference < 0) difference += base;
            else {
                r[i++] = difference;
                break;
            }
            r[i] = difference;
        }
        for (; i < a_l; i++) {
            r[i] = a[i];
        }
        trim(r);
        return r;
    }

    function subtractAny(a, b, sign) {
        var value;
        if (compareAbs(a, b) >= 0) {
            value = subtract(a, b);
        } else {
            value = subtract(b, a);
            sign = !sign;
        }
        value = arrayToSmall(value);
        if (typeof value === "number") {
            if (sign) value = -value;
            return new SmallInteger(value);
        }
        return new BigInteger(value, sign);
    }

    function subtractSmall(a, b, sign) { // assumes a is array, b is number with 0 <= b < MAX_INT
        var l = a.length,
            r = new Array(l),
            carry = -b,
            base = BASE,
            i, difference;
        for (i = 0; i < l; i++) {
            difference = a[i] + carry;
            carry = Math.floor(difference / base);
            difference %= base;
            r[i] = difference < 0 ? difference + base : difference;
        }
        r = arrayToSmall(r);
        if (typeof r === "number") {
            if (sign) r = -r;
            return new SmallInteger(r);
        } return new BigInteger(r, sign);
    }

    BigInteger.prototype.subtract = function (v) {
        var n = parseValue(v);
        if (this.sign !== n.sign) {
            return this.add(n.negate());
        }
        var a = this.value, b = n.value;
        if (n.isSmall)
            return subtractSmall(a, Math.abs(b), this.sign);
        return subtractAny(a, b, this.sign);
    };
    BigInteger.prototype.minus = BigInteger.prototype.subtract;

    SmallInteger.prototype.subtract = function (v) {
        var n = parseValue(v);
        var a = this.value;
        if (a < 0 !== n.sign) {
            return this.add(n.negate());
        }
        var b = n.value;
        if (n.isSmall) {
            return new SmallInteger(a - b);
        }
        return subtractSmall(b, Math.abs(a), a >= 0);
    };
    SmallInteger.prototype.minus = SmallInteger.prototype.subtract;

    NativeBigInt.prototype.subtract = function (v) {
        return new NativeBigInt(this.value - parseValue(v).value);
    };
    NativeBigInt.prototype.minus = NativeBigInt.prototype.subtract;

    BigInteger.prototype.negate = function () {
        return new BigInteger(this.value, !this.sign);
    };
    SmallInteger.prototype.negate = function () {
        var sign = this.sign;
        var small = new SmallInteger(-this.value);
        small.sign = !sign;
        return small;
    };
    NativeBigInt.prototype.negate = function () {
        return new NativeBigInt(-this.value);
    };

    BigInteger.prototype.abs = function () {
        return new BigInteger(this.value, false);
    };
    SmallInteger.prototype.abs = function () {
        return new SmallInteger(Math.abs(this.value));
    };
    NativeBigInt.prototype.abs = function () {
        return new NativeBigInt(this.value >= 0 ? this.value : -this.value);
    };


    function multiplyLong(a, b) {
        var a_l = a.length,
            b_l = b.length,
            l = a_l + b_l,
            r = createArray(l),
            base = BASE,
            product, carry, i, a_i, b_j;
        for (i = 0; i < a_l; ++i) {
            a_i = a[i];
            for (var j = 0; j < b_l; ++j) {
                b_j = b[j];
                product = a_i * b_j + r[i + j];
                carry = Math.floor(product / base);
                r[i + j] = product - carry * base;
                r[i + j + 1] += carry;
            }
        }
        trim(r);
        return r;
    }

    function multiplySmall(a, b) { // assumes a is array, b is number with |b| < BASE
        var l = a.length,
            r = new Array(l),
            base = BASE,
            carry = 0,
            product, i;
        for (i = 0; i < l; i++) {
            product = a[i] * b + carry;
            carry = Math.floor(product / base);
            r[i] = product - carry * base;
        }
        while (carry > 0) {
            r[i++] = carry % base;
            carry = Math.floor(carry / base);
        }
        return r;
    }

    function shiftLeft(x, n) {
        var r = [];
        while (n-- > 0) r.push(0);
        return r.concat(x);
    }

    function multiplyKaratsuba(x, y) {
        var n = Math.max(x.length, y.length);

        if (n <= 30) return multiplyLong(x, y);
        n = Math.ceil(n / 2);

        var b = x.slice(n),
            a = x.slice(0, n),
            d = y.slice(n),
            c = y.slice(0, n);

        var ac = multiplyKaratsuba(a, c),
            bd = multiplyKaratsuba(b, d),
            abcd = multiplyKaratsuba(addAny(a, b), addAny(c, d));

        var product = addAny(addAny(ac, shiftLeft(subtract(subtract(abcd, ac), bd), n)), shiftLeft(bd, 2 * n));
        trim(product);
        return product;
    }

    // The following function is derived from a surface fit of a graph plotting the performance difference
    // between long multiplication and karatsuba multiplication versus the lengths of the two arrays.
    function useKaratsuba(l1, l2) {
        return -0.012 * l1 - 0.012 * l2 + 0.000015 * l1 * l2 > 0;
    }

    BigInteger.prototype.multiply = function (v) {
        var n = parseValue(v),
            a = this.value, b = n.value,
            sign = this.sign !== n.sign,
            abs;
        if (n.isSmall) {
            if (b === 0) return Integer[0];
            if (b === 1) return this;
            if (b === -1) return this.negate();
            abs = Math.abs(b);
            if (abs < BASE) {
                return new BigInteger(multiplySmall(a, abs), sign);
            }
            b = smallToArray(abs);
        }
        if (useKaratsuba(a.length, b.length)) // Karatsuba is only faster for certain array sizes
            return new BigInteger(multiplyKaratsuba(a, b), sign);
        return new BigInteger(multiplyLong(a, b), sign);
    };

    BigInteger.prototype.times = BigInteger.prototype.multiply;

    function multiplySmallAndArray(a, b, sign) { // a >= 0
        if (a < BASE) {
            return new BigInteger(multiplySmall(b, a), sign);
        }
        return new BigInteger(multiplyLong(b, smallToArray(a)), sign);
    }
    SmallInteger.prototype._multiplyBySmall = function (a) {
        if (isPrecise(a.value * this.value)) {
            return new SmallInteger(a.value * this.value);
        }
        return multiplySmallAndArray(Math.abs(a.value), smallToArray(Math.abs(this.value)), this.sign !== a.sign);
    };
    BigInteger.prototype._multiplyBySmall = function (a) {
        if (a.value === 0) return Integer[0];
        if (a.value === 1) return this;
        if (a.value === -1) return this.negate();
        return multiplySmallAndArray(Math.abs(a.value), this.value, this.sign !== a.sign);
    };
    SmallInteger.prototype.multiply = function (v) {
        return parseValue(v)._multiplyBySmall(this);
    };
    SmallInteger.prototype.times = SmallInteger.prototype.multiply;

    NativeBigInt.prototype.multiply = function (v) {
        return new NativeBigInt(this.value * parseValue(v).value);
    };
    NativeBigInt.prototype.times = NativeBigInt.prototype.multiply;

    function square(a) {
        //console.assert(2 * BASE * BASE < MAX_INT);
        var l = a.length,
            r = createArray(l + l),
            base = BASE,
            product, carry, i, a_i, a_j;
        for (i = 0; i < l; i++) {
            a_i = a[i];
            carry = 0 - a_i * a_i;
            for (var j = i; j < l; j++) {
                a_j = a[j];
                product = 2 * (a_i * a_j) + r[i + j] + carry;
                carry = Math.floor(product / base);
                r[i + j] = product - carry * base;
            }
            r[i + l] = carry;
        }
        trim(r);
        return r;
    }

    BigInteger.prototype.square = function () {
        return new BigInteger(square(this.value), false);
    };

    SmallInteger.prototype.square = function () {
        var value = this.value * this.value;
        if (isPrecise(value)) return new SmallInteger(value);
        return new BigInteger(square(smallToArray(Math.abs(this.value))), false);
    };

    NativeBigInt.prototype.square = function (v) {
        return new NativeBigInt(this.value * this.value);
    };

    function divMod1(a, b) { // Left over from previous version. Performs faster than divMod2 on smaller input sizes.
        var a_l = a.length,
            b_l = b.length,
            base = BASE,
            result = createArray(b.length),
            divisorMostSignificantDigit = b[b_l - 1],
            // normalization
            lambda = Math.ceil(base / (2 * divisorMostSignificantDigit)),
            remainder = multiplySmall(a, lambda),
            divisor = multiplySmall(b, lambda),
            quotientDigit, shift, carry, borrow, i, l, q;
        if (remainder.length <= a_l) remainder.push(0);
        divisor.push(0);
        divisorMostSignificantDigit = divisor[b_l - 1];
        for (shift = a_l - b_l; shift >= 0; shift--) {
            quotientDigit = base - 1;
            if (remainder[shift + b_l] !== divisorMostSignificantDigit) {
                quotientDigit = Math.floor((remainder[shift + b_l] * base + remainder[shift + b_l - 1]) / divisorMostSignificantDigit);
            }
            // quotientDigit <= base - 1
            carry = 0;
            borrow = 0;
            l = divisor.length;
            for (i = 0; i < l; i++) {
                carry += quotientDigit * divisor[i];
                q = Math.floor(carry / base);
                borrow += remainder[shift + i] - (carry - q * base);
                carry = q;
                if (borrow < 0) {
                    remainder[shift + i] = borrow + base;
                    borrow = -1;
                } else {
                    remainder[shift + i] = borrow;
                    borrow = 0;
                }
            }
            while (borrow !== 0) {
                quotientDigit -= 1;
                carry = 0;
                for (i = 0; i < l; i++) {
                    carry += remainder[shift + i] - base + divisor[i];
                    if (carry < 0) {
                        remainder[shift + i] = carry + base;
                        carry = 0;
                    } else {
                        remainder[shift + i] = carry;
                        carry = 1;
                    }
                }
                borrow += carry;
            }
            result[shift] = quotientDigit;
        }
        // denormalization
        remainder = divModSmall(remainder, lambda)[0];
        return [arrayToSmall(result), arrayToSmall(remainder)];
    }

    function divMod2(a, b) { // Implementation idea shamelessly stolen from Silent Matt's library http://silentmatt.com/biginteger/
        // Performs faster than divMod1 on larger input sizes.
        var a_l = a.length,
            b_l = b.length,
            result = [],
            part = [],
            base = BASE,
            guess, xlen, highx, highy, check;
        while (a_l) {
            part.unshift(a[--a_l]);
            trim(part);
            if (compareAbs(part, b) < 0) {
                result.push(0);
                continue;
            }
            xlen = part.length;
            highx = part[xlen - 1] * base + part[xlen - 2];
            highy = b[b_l - 1] * base + b[b_l - 2];
            if (xlen > b_l) {
                highx = (highx + 1) * base;
            }
            guess = Math.ceil(highx / highy);
            do {
                check = multiplySmall(b, guess);
                if (compareAbs(check, part) <= 0) break;
                guess--;
            } while (guess);
            result.push(guess);
            part = subtract(part, check);
        }
        result.reverse();
        return [arrayToSmall(result), arrayToSmall(part)];
    }

    function divModSmall(value, lambda) {
        var length = value.length,
            quotient = createArray(length),
            base = BASE,
            i, q, remainder, divisor;
        remainder = 0;
        for (i = length - 1; i >= 0; --i) {
            divisor = remainder * base + value[i];
            q = truncate(divisor / lambda);
            remainder = divisor - q * lambda;
            quotient[i] = q | 0;
        }
        return [quotient, remainder | 0];
    }

    function divModAny(self, v) {
        var value, n = parseValue(v);
        if (supportsNativeBigInt) {
            return [new NativeBigInt(self.value / n.value), new NativeBigInt(self.value % n.value)];
        }
        var a = self.value, b = n.value;
        var quotient;
        if (b === 0) throw new Error("Cannot divide by zero");
        if (self.isSmall) {
            if (n.isSmall) {
                return [new SmallInteger(truncate(a / b)), new SmallInteger(a % b)];
            }
            return [Integer[0], self];
        }
        if (n.isSmall) {
            if (b === 1) return [self, Integer[0]];
            if (b == -1) return [self.negate(), Integer[0]];
            var abs = Math.abs(b);
            if (abs < BASE) {
                value = divModSmall(a, abs);
                quotient = arrayToSmall(value[0]);
                var remainder = value[1];
                if (self.sign) remainder = -remainder;
                if (typeof quotient === "number") {
                    if (self.sign !== n.sign) quotient = -quotient;
                    return [new SmallInteger(quotient), new SmallInteger(remainder)];
                }
                return [new BigInteger(quotient, self.sign !== n.sign), new SmallInteger(remainder)];
            }
            b = smallToArray(abs);
        }
        var comparison = compareAbs(a, b);
        if (comparison === -1) return [Integer[0], self];
        if (comparison === 0) return [Integer[self.sign === n.sign ? 1 : -1], Integer[0]];

        // divMod1 is faster on smaller input sizes
        if (a.length + b.length <= 200)
            value = divMod1(a, b);
        else value = divMod2(a, b);

        quotient = value[0];
        var qSign = self.sign !== n.sign,
            mod = value[1],
            mSign = self.sign;
        if (typeof quotient === "number") {
            if (qSign) quotient = -quotient;
            quotient = new SmallInteger(quotient);
        } else quotient = new BigInteger(quotient, qSign);
        if (typeof mod === "number") {
            if (mSign) mod = -mod;
            mod = new SmallInteger(mod);
        } else mod = new BigInteger(mod, mSign);
        return [quotient, mod];
    }

    BigInteger.prototype.divmod = function (v) {
        var result = divModAny(this, v);
        return {
            quotient: result[0],
            remainder: result[1]
        };
    };
    NativeBigInt.prototype.divmod = SmallInteger.prototype.divmod = BigInteger.prototype.divmod;


    BigInteger.prototype.divide = function (v) {
        return divModAny(this, v)[0];
    };
    NativeBigInt.prototype.over = NativeBigInt.prototype.divide = function (v) {
        return new NativeBigInt(this.value / parseValue(v).value);
    };
    SmallInteger.prototype.over = SmallInteger.prototype.divide = BigInteger.prototype.over = BigInteger.prototype.divide;

    BigInteger.prototype.mod = function (v) {
        return divModAny(this, v)[1];
    };
    NativeBigInt.prototype.mod = NativeBigInt.prototype.remainder = function (v) {
        return new NativeBigInt(this.value % parseValue(v).value);
    };
    SmallInteger.prototype.remainder = SmallInteger.prototype.mod = BigInteger.prototype.remainder = BigInteger.prototype.mod;

    BigInteger.prototype.pow = function (v) {
        var n = parseValue(v),
            a = this.value,
            b = n.value,
            value, x, y;
        if (b === 0) return Integer[1];
        if (a === 0) return Integer[0];
        if (a === 1) return Integer[1];
        if (a === -1) return n.isEven() ? Integer[1] : Integer[-1];
        if (n.sign) {
            return Integer[0];
        }
        if (!n.isSmall) throw new Error("The exponent " + n.toString() + " is too large.");
        if (this.isSmall) {
            if (isPrecise(value = Math.pow(a, b)))
                return new SmallInteger(truncate(value));
        }
        x = this;
        y = Integer[1];
        while (true) {
            if (b & 1 === 1) {
                y = y.times(x);
                --b;
            }
            if (b === 0) break;
            b /= 2;
            x = x.square();
        }
        return y;
    };
    SmallInteger.prototype.pow = BigInteger.prototype.pow;

    NativeBigInt.prototype.pow = function (v) {
        var n = parseValue(v);
        var a = this.value, b = n.value;
        var _0 = BigInt(0), _1 = BigInt(1), _2 = BigInt(2);
        if (b === _0) return Integer[1];
        if (a === _0) return Integer[0];
        if (a === _1) return Integer[1];
        if (a === BigInt(-1)) return n.isEven() ? Integer[1] : Integer[-1];
        if (n.isNegative()) return new NativeBigInt(_0);
        var x = this;
        var y = Integer[1];
        while (true) {
            if ((b & _1) === _1) {
                y = y.times(x);
                --b;
            }
            if (b === _0) break;
            b /= _2;
            x = x.square();
        }
        return y;
    };

    BigInteger.prototype.modPow = function (exp, mod) {
        exp = parseValue(exp);
        mod = parseValue(mod);
        if (mod.isZero()) throw new Error("Cannot take modPow with modulus 0");
        var r = Integer[1],
            base = this.mod(mod);
        while (exp.isPositive()) {
            if (base.isZero()) return Integer[0];
            if (exp.isOdd()) r = r.multiply(base).mod(mod);
            exp = exp.divide(2);
            base = base.square().mod(mod);
        }
        return r;
    };
    NativeBigInt.prototype.modPow = SmallInteger.prototype.modPow = BigInteger.prototype.modPow;

    function compareAbs(a, b) {
        if (a.length !== b.length) {
            return a.length > b.length ? 1 : -1;
        }
        for (var i = a.length - 1; i >= 0; i--) {
            if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
        }
        return 0;
    }

    BigInteger.prototype.compareAbs = function (v) {
        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (n.isSmall) return 1;
        return compareAbs(a, b);
    };
    SmallInteger.prototype.compareAbs = function (v) {
        var n = parseValue(v),
            a = Math.abs(this.value),
            b = n.value;
        if (n.isSmall) {
            b = Math.abs(b);
            return a === b ? 0 : a > b ? 1 : -1;
        }
        return -1;
    };
    NativeBigInt.prototype.compareAbs = function (v) {
        var a = this.value;
        var b = parseValue(v).value;
        a = a >= 0 ? a : -a;
        b = b >= 0 ? b : -b;
        return a === b ? 0 : a > b ? 1 : -1;
    };

    BigInteger.prototype.compare = function (v) {
        // See discussion about comparison with Infinity:
        // https://github.com/peterolson/BigInteger.js/issues/61
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }

        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (this.sign !== n.sign) {
            return n.sign ? 1 : -1;
        }
        if (n.isSmall) {
            return this.sign ? -1 : 1;
        }
        return compareAbs(a, b) * (this.sign ? -1 : 1);
    };
    BigInteger.prototype.compareTo = BigInteger.prototype.compare;

    SmallInteger.prototype.compare = function (v) {
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }

        var n = parseValue(v),
            a = this.value,
            b = n.value;
        if (n.isSmall) {
            return a == b ? 0 : a > b ? 1 : -1;
        }
        if (a < 0 !== n.sign) {
            return a < 0 ? -1 : 1;
        }
        return a < 0 ? 1 : -1;
    };
    SmallInteger.prototype.compareTo = SmallInteger.prototype.compare;

    NativeBigInt.prototype.compare = function (v) {
        if (v === Infinity) {
            return -1;
        }
        if (v === -Infinity) {
            return 1;
        }
        var a = this.value;
        var b = parseValue(v).value;
        return a === b ? 0 : a > b ? 1 : -1;
    };
    NativeBigInt.prototype.compareTo = NativeBigInt.prototype.compare;

    BigInteger.prototype.equals = function (v) {
        return this.compare(v) === 0;
    };
    NativeBigInt.prototype.eq = NativeBigInt.prototype.equals = SmallInteger.prototype.eq = SmallInteger.prototype.equals = BigInteger.prototype.eq = BigInteger.prototype.equals;

    BigInteger.prototype.notEquals = function (v) {
        return this.compare(v) !== 0;
    };
    NativeBigInt.prototype.neq = NativeBigInt.prototype.notEquals = SmallInteger.prototype.neq = SmallInteger.prototype.notEquals = BigInteger.prototype.neq = BigInteger.prototype.notEquals;

    BigInteger.prototype.greater = function (v) {
        return this.compare(v) > 0;
    };
    NativeBigInt.prototype.gt = NativeBigInt.prototype.greater = SmallInteger.prototype.gt = SmallInteger.prototype.greater = BigInteger.prototype.gt = BigInteger.prototype.greater;

    BigInteger.prototype.lesser = function (v) {
        return this.compare(v) < 0;
    };
    NativeBigInt.prototype.lt = NativeBigInt.prototype.lesser = SmallInteger.prototype.lt = SmallInteger.prototype.lesser = BigInteger.prototype.lt = BigInteger.prototype.lesser;

    BigInteger.prototype.greaterOrEquals = function (v) {
        return this.compare(v) >= 0;
    };
    NativeBigInt.prototype.geq = NativeBigInt.prototype.greaterOrEquals = SmallInteger.prototype.geq = SmallInteger.prototype.greaterOrEquals = BigInteger.prototype.geq = BigInteger.prototype.greaterOrEquals;

    BigInteger.prototype.lesserOrEquals = function (v) {
        return this.compare(v) <= 0;
    };
    NativeBigInt.prototype.leq = NativeBigInt.prototype.lesserOrEquals = SmallInteger.prototype.leq = SmallInteger.prototype.lesserOrEquals = BigInteger.prototype.leq = BigInteger.prototype.lesserOrEquals;

    BigInteger.prototype.isEven = function () {
        return (this.value[0] & 1) === 0;
    };
    SmallInteger.prototype.isEven = function () {
        return (this.value & 1) === 0;
    };
    NativeBigInt.prototype.isEven = function () {
        return (this.value & BigInt(1)) === BigInt(0);
    };

    BigInteger.prototype.isOdd = function () {
        return (this.value[0] & 1) === 1;
    };
    SmallInteger.prototype.isOdd = function () {
        return (this.value & 1) === 1;
    };
    NativeBigInt.prototype.isOdd = function () {
        return (this.value & BigInt(1)) === BigInt(1);
    };

    BigInteger.prototype.isPositive = function () {
        return !this.sign;
    };
    SmallInteger.prototype.isPositive = function () {
        return this.value > 0;
    };
    NativeBigInt.prototype.isPositive = SmallInteger.prototype.isPositive;

    BigInteger.prototype.isNegative = function () {
        return this.sign;
    };
    SmallInteger.prototype.isNegative = function () {
        return this.value < 0;
    };
    NativeBigInt.prototype.isNegative = SmallInteger.prototype.isNegative;

    BigInteger.prototype.isUnit = function () {
        return false;
    };
    SmallInteger.prototype.isUnit = function () {
        return Math.abs(this.value) === 1;
    };
    NativeBigInt.prototype.isUnit = function () {
        return this.abs().value === BigInt(1);
    };

    BigInteger.prototype.isZero = function () {
        return false;
    };
    SmallInteger.prototype.isZero = function () {
        return this.value === 0;
    };
    NativeBigInt.prototype.isZero = function () {
        return this.value === BigInt(0);
    };

    BigInteger.prototype.isDivisibleBy = function (v) {
        var n = parseValue(v);
        if (n.isZero()) return false;
        if (n.isUnit()) return true;
        if (n.compareAbs(2) === 0) return this.isEven();
        return this.mod(n).isZero();
    };
    NativeBigInt.prototype.isDivisibleBy = SmallInteger.prototype.isDivisibleBy = BigInteger.prototype.isDivisibleBy;

    function isBasicPrime(v) {
        var n = v.abs();
        if (n.isUnit()) return false;
        if (n.equals(2) || n.equals(3) || n.equals(5)) return true;
        if (n.isEven() || n.isDivisibleBy(3) || n.isDivisibleBy(5)) return false;
        if (n.lesser(49)) return true;
        // we don't know if it's prime: let the other functions figure it out
    }

    function millerRabinTest(n, a) {
        var nPrev = n.prev(),
            b = nPrev,
            r = 0,
            d, i, x;
        while (b.isEven()) b = b.divide(2), r++;
        next: for (i = 0; i < a.length; i++) {
            if (n.lesser(a[i])) continue;
            x = bigInt(a[i]).modPow(b, n);
            if (x.isUnit() || x.equals(nPrev)) continue;
            for (d = r - 1; d != 0; d--) {
                x = x.square().mod(n);
                if (x.isUnit()) return false;
                if (x.equals(nPrev)) continue next;
            }
            return false;
        }
        return true;
    }

    // Set "strict" to true to force GRH-supported lower bound of 2*log(N)^2
    BigInteger.prototype.isPrime = function (strict) {
        var isPrime = isBasicPrime(this);
        if (isPrime !== undefined) return isPrime;
        var n = this.abs();
        var bits = n.bitLength();
        if (bits <= 64)
            return millerRabinTest(n, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]);
        var logN = Math.log(2) * bits.toJSNumber();
        var t = Math.ceil((strict === true) ? (2 * Math.pow(logN, 2)) : logN);
        for (var a = [], i = 0; i < t; i++) {
            a.push(bigInt(i + 2));
        }
        return millerRabinTest(n, a);
    };
    NativeBigInt.prototype.isPrime = SmallInteger.prototype.isPrime = BigInteger.prototype.isPrime;

    BigInteger.prototype.isProbablePrime = function (iterations) {
        var isPrime = isBasicPrime(this);
        if (isPrime !== undefined) return isPrime;
        var n = this.abs();
        var t = iterations === undefined ? 5 : iterations;
        for (var a = [], i = 0; i < t; i++) {
            a.push(bigInt.randBetween(2, n.minus(2)));
        }
        return millerRabinTest(n, a);
    };
    NativeBigInt.prototype.isProbablePrime = SmallInteger.prototype.isProbablePrime = BigInteger.prototype.isProbablePrime;

    BigInteger.prototype.modInv = function (n) {
        var t = bigInt.zero, newT = bigInt.one, r = parseValue(n), newR = this.abs(), q, lastT, lastR;
        while (!newR.isZero()) {
            q = r.divide(newR);
            lastT = t;
            lastR = r;
            t = newT;
            r = newR;
            newT = lastT.subtract(q.multiply(newT));
            newR = lastR.subtract(q.multiply(newR));
        }
        if (!r.isUnit()) throw new Error(this.toString() + " and " + n.toString() + " are not co-prime");
        if (t.compare(0) === -1) {
            t = t.add(n);
        }
        if (this.isNegative()) {
            return t.negate();
        }
        return t;
    };

    NativeBigInt.prototype.modInv = SmallInteger.prototype.modInv = BigInteger.prototype.modInv;

    BigInteger.prototype.next = function () {
        var value = this.value;
        if (this.sign) {
            return subtractSmall(value, 1, this.sign);
        }
        return new BigInteger(addSmall(value, 1), this.sign);
    };
    SmallInteger.prototype.next = function () {
        var value = this.value;
        if (value + 1 < MAX_INT) return new SmallInteger(value + 1);
        return new BigInteger(MAX_INT_ARR, false);
    };
    NativeBigInt.prototype.next = function () {
        return new NativeBigInt(this.value + BigInt(1));
    };

    BigInteger.prototype.prev = function () {
        var value = this.value;
        if (this.sign) {
            return new BigInteger(addSmall(value, 1), true);
        }
        return subtractSmall(value, 1, this.sign);
    };
    SmallInteger.prototype.prev = function () {
        var value = this.value;
        if (value - 1 > -MAX_INT) return new SmallInteger(value - 1);
        return new BigInteger(MAX_INT_ARR, true);
    };
    NativeBigInt.prototype.prev = function () {
        return new NativeBigInt(this.value - BigInt(1));
    };

    var powersOfTwo = [1];
    while (2 * powersOfTwo[powersOfTwo.length - 1] <= BASE) powersOfTwo.push(2 * powersOfTwo[powersOfTwo.length - 1]);
    var powers2Length = powersOfTwo.length, highestPower2 = powersOfTwo[powers2Length - 1];

    function shift_isSmall(n) {
        return Math.abs(n) <= BASE;
    }

    BigInteger.prototype.shiftLeft = function (v) {
        var n = parseValue(v).toJSNumber();
        if (!shift_isSmall(n)) {
            throw new Error(String(n) + " is too large for shifting.");
        }
        if (n < 0) return this.shiftRight(-n);
        var result = this;
        if (result.isZero()) return result;
        while (n >= powers2Length) {
            result = result.multiply(highestPower2);
            n -= powers2Length - 1;
        }
        return result.multiply(powersOfTwo[n]);
    };
    NativeBigInt.prototype.shiftLeft = SmallInteger.prototype.shiftLeft = BigInteger.prototype.shiftLeft;

    BigInteger.prototype.shiftRight = function (v) {
        var remQuo;
        var n = parseValue(v).toJSNumber();
        if (!shift_isSmall(n)) {
            throw new Error(String(n) + " is too large for shifting.");
        }
        if (n < 0) return this.shiftLeft(-n);
        var result = this;
        while (n >= powers2Length) {
            if (result.isZero() || (result.isNegative() && result.isUnit())) return result;
            remQuo = divModAny(result, highestPower2);
            result = remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
            n -= powers2Length - 1;
        }
        remQuo = divModAny(result, powersOfTwo[n]);
        return remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
    };
    NativeBigInt.prototype.shiftRight = SmallInteger.prototype.shiftRight = BigInteger.prototype.shiftRight;

    function bitwise(x, y, fn) {
        y = parseValue(y);
        var xSign = x.isNegative(), ySign = y.isNegative();
        var xRem = xSign ? x.not() : x,
            yRem = ySign ? y.not() : y;
        var xDigit = 0, yDigit = 0;
        var xDivMod = null, yDivMod = null;
        var result = [];
        while (!xRem.isZero() || !yRem.isZero()) {
            xDivMod = divModAny(xRem, highestPower2);
            xDigit = xDivMod[1].toJSNumber();
            if (xSign) {
                xDigit = highestPower2 - 1 - xDigit; // two's complement for negative numbers
            }

            yDivMod = divModAny(yRem, highestPower2);
            yDigit = yDivMod[1].toJSNumber();
            if (ySign) {
                yDigit = highestPower2 - 1 - yDigit; // two's complement for negative numbers
            }

            xRem = xDivMod[0];
            yRem = yDivMod[0];
            result.push(fn(xDigit, yDigit));
        }
        var sum = fn(xSign ? 1 : 0, ySign ? 1 : 0) !== 0 ? bigInt(-1) : bigInt(0);
        for (var i = result.length - 1; i >= 0; i -= 1) {
            sum = sum.multiply(highestPower2).add(bigInt(result[i]));
        }
        return sum;
    }

    BigInteger.prototype.not = function () {
        return this.negate().prev();
    };
    NativeBigInt.prototype.not = SmallInteger.prototype.not = BigInteger.prototype.not;

    BigInteger.prototype.and = function (n) {
        return bitwise(this, n, function (a, b) { return a & b; });
    };
    NativeBigInt.prototype.and = SmallInteger.prototype.and = BigInteger.prototype.and;

    BigInteger.prototype.or = function (n) {
        return bitwise(this, n, function (a, b) { return a | b; });
    };
    NativeBigInt.prototype.or = SmallInteger.prototype.or = BigInteger.prototype.or;

    BigInteger.prototype.xor = function (n) {
        return bitwise(this, n, function (a, b) { return a ^ b; });
    };
    NativeBigInt.prototype.xor = SmallInteger.prototype.xor = BigInteger.prototype.xor;

    var LOBMASK_I = 1 << 30, LOBMASK_BI = (BASE & -BASE) * (BASE & -BASE) | LOBMASK_I;
    function roughLOB(n) { // get lowestOneBit (rough)
        // SmallInteger: return Min(lowestOneBit(n), 1 << 30)
        // BigInteger: return Min(lowestOneBit(n), 1 << 14) [BASE=1e7]
        var v = n.value,
            x = typeof v === "number" ? v | LOBMASK_I :
                typeof v === "bigint" ? v | BigInt(LOBMASK_I) :
                    v[0] + v[1] * BASE | LOBMASK_BI;
        return x & -x;
    }

    function integerLogarithm(value, base) {
        if (base.compareTo(value) <= 0) {
            var tmp = integerLogarithm(value, base.square(base));
            var p = tmp.p;
            var e = tmp.e;
            var t = p.multiply(base);
            return t.compareTo(value) <= 0 ? { p: t, e: e * 2 + 1 } : { p: p, e: e * 2 };
        }
        return { p: bigInt(1), e: 0 };
    }

    BigInteger.prototype.bitLength = function () {
        var n = this;
        if (n.compareTo(bigInt(0)) < 0) {
            n = n.negate().subtract(bigInt(1));
        }
        if (n.compareTo(bigInt(0)) === 0) {
            return bigInt(0);
        }
        return bigInt(integerLogarithm(n, bigInt(2)).e).add(bigInt(1));
    };
    NativeBigInt.prototype.bitLength = SmallInteger.prototype.bitLength = BigInteger.prototype.bitLength;

    function max(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        return a.greater(b) ? a : b;
    }
    function min(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        return a.lesser(b) ? a : b;
    }
    function gcd(a, b) {
        a = parseValue(a).abs();
        b = parseValue(b).abs();
        if (a.equals(b)) return a;
        if (a.isZero()) return b;
        if (b.isZero()) return a;
        var c = Integer[1], d, t;
        while (a.isEven() && b.isEven()) {
            d = min(roughLOB(a), roughLOB(b));
            a = a.divide(d);
            b = b.divide(d);
            c = c.multiply(d);
        }
        while (a.isEven()) {
            a = a.divide(roughLOB(a));
        }
        do {
            while (b.isEven()) {
                b = b.divide(roughLOB(b));
            }
            if (a.greater(b)) {
                t = b; b = a; a = t;
            }
            b = b.subtract(a);
        } while (!b.isZero());
        return c.isUnit() ? a : a.multiply(c);
    }
    function lcm(a, b) {
        a = parseValue(a).abs();
        b = parseValue(b).abs();
        return a.divide(gcd(a, b)).multiply(b);
    }
    function randBetween(a, b) {
        a = parseValue(a);
        b = parseValue(b);
        var low = min(a, b), high = max(a, b);
        var range = high.subtract(low).add(1);
        if (range.isSmall) return low.add(Math.floor(Math.random() * range));
        var digits = toBase(range, BASE).value;
        var result = [], restricted = true;
        for (var i = 0; i < digits.length; i++) {
            var top = restricted ? digits[i] : BASE;
            var digit = truncate(Math.random() * top);
            result.push(digit);
            if (digit < top) restricted = false;
        }
        return low.add(Integer.fromArray(result, BASE, false));
    }

    var parseBase = function (text, base, alphabet, caseSensitive) {
        alphabet = alphabet || DEFAULT_ALPHABET;
        text = String(text);
        if (!caseSensitive) {
            text = text.toLowerCase();
            alphabet = alphabet.toLowerCase();
        }
        var length = text.length;
        var i;
        var absBase = Math.abs(base);
        var alphabetValues = {};
        for (i = 0; i < alphabet.length; i++) {
            alphabetValues[alphabet[i]] = i;
        }
        for (i = 0; i < length; i++) {
            var c = text[i];
            if (c === "-") continue;
            if (c in alphabetValues) {
                if (alphabetValues[c] >= absBase) {
                    if (c === "1" && absBase === 1) continue;
                    throw new Error(c + " is not a valid digit in base " + base + ".");
                }
            }
        }
        base = parseValue(base);
        var digits = [];
        var isNegative = text[0] === "-";
        for (i = isNegative ? 1 : 0; i < text.length; i++) {
            var c = text[i];
            if (c in alphabetValues) digits.push(parseValue(alphabetValues[c]));
            else if (c === "<") {
                var start = i;
                do { i++; } while (text[i] !== ">" && i < text.length);
                digits.push(parseValue(text.slice(start + 1, i)));
            }
            else throw new Error(c + " is not a valid character");
        }
        return parseBaseFromArray(digits, base, isNegative);
    };

    function parseBaseFromArray(digits, base, isNegative) {
        var val = Integer[0], pow = Integer[1], i;
        for (i = digits.length - 1; i >= 0; i--) {
            val = val.add(digits[i].times(pow));
            pow = pow.times(base);
        }
        return isNegative ? val.negate() : val;
    }

    function stringify(digit, alphabet) {
        alphabet = alphabet || DEFAULT_ALPHABET;
        if (digit < alphabet.length) {
            return alphabet[digit];
        }
        return "<" + digit + ">";
    }

    function toBase(n, base) {
        base = bigInt(base);
        if (base.isZero()) {
            if (n.isZero()) return { value: [0], isNegative: false };
            throw new Error("Cannot convert nonzero numbers to base 0.");
        }
        if (base.equals(-1)) {
            if (n.isZero()) return { value: [0], isNegative: false };
            if (n.isNegative())
                return {
                    value: [].concat.apply([], Array.apply(null, Array(-n.toJSNumber()))
                        .map(Array.prototype.valueOf, [1, 0])
                    ),
                    isNegative: false
                };

            var arr = Array.apply(null, Array(n.toJSNumber() - 1))
                .map(Array.prototype.valueOf, [0, 1]);
            arr.unshift([1]);
            return {
                value: [].concat.apply([], arr),
                isNegative: false
            };
        }

        var neg = false;
        if (n.isNegative() && base.isPositive()) {
            neg = true;
            n = n.abs();
        }
        if (base.isUnit()) {
            if (n.isZero()) return { value: [0], isNegative: false };

            return {
                value: Array.apply(null, Array(n.toJSNumber()))
                    .map(Number.prototype.valueOf, 1),
                isNegative: neg
            };
        }
        var out = [];
        var left = n, divmod;
        while (left.isNegative() || left.compareAbs(base) >= 0) {
            divmod = left.divmod(base);
            left = divmod.quotient;
            var digit = divmod.remainder;
            if (digit.isNegative()) {
                digit = base.minus(digit).abs();
                left = left.next();
            }
            out.push(digit.toJSNumber());
        }
        out.push(left.toJSNumber());
        return { value: out.reverse(), isNegative: neg };
    }

    function toBaseString(n, base, alphabet) {
        var arr = toBase(n, base);
        return (arr.isNegative ? "-" : "") + arr.value.map(function (x) {
            return stringify(x, alphabet);
        }).join('');
    }

    BigInteger.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    SmallInteger.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    NativeBigInt.prototype.toArray = function (radix) {
        return toBase(this, radix);
    };

    BigInteger.prototype.toString = function (radix, alphabet) {
        if (radix === undefined) radix = 10;
        if (radix !== 10) return toBaseString(this, radix, alphabet);
        var v = this.value, l = v.length, str = String(v[--l]), zeros = "0000000", digit;
        while (--l >= 0) {
            digit = String(v[l]);
            str += zeros.slice(digit.length) + digit;
        }
        var sign = this.sign ? "-" : "";
        return sign + str;
    };

    SmallInteger.prototype.toString = function (radix, alphabet) {
        if (radix === undefined) radix = 10;
        if (radix != 10) return toBaseString(this, radix, alphabet);
        return String(this.value);
    };

    NativeBigInt.prototype.toString = SmallInteger.prototype.toString;

    NativeBigInt.prototype.toJSON = BigInteger.prototype.toJSON = SmallInteger.prototype.toJSON = function () { return this.toString(); };

    BigInteger.prototype.valueOf = function () {
        return parseInt(this.toString(), 10);
    };
    BigInteger.prototype.toJSNumber = BigInteger.prototype.valueOf;

    SmallInteger.prototype.valueOf = function () {
        return this.value;
    };
    SmallInteger.prototype.toJSNumber = SmallInteger.prototype.valueOf;
    NativeBigInt.prototype.valueOf = NativeBigInt.prototype.toJSNumber = function () {
        return parseInt(this.toString(), 10);
    };

    function parseStringValue(v) {
        if (isPrecise(+v)) {
            var x = +v;
            if (x === truncate(x))
                return supportsNativeBigInt ? new NativeBigInt(BigInt(x)) : new SmallInteger(x);
            throw new Error("Invalid integer: " + v);
        }
        var sign = v[0] === "-";
        if (sign) v = v.slice(1);
        var split = v.split(/e/i);
        if (split.length > 2) throw new Error("Invalid integer: " + split.join("e"));
        if (split.length === 2) {
            var exp = split[1];
            if (exp[0] === "+") exp = exp.slice(1);
            exp = +exp;
            if (exp !== truncate(exp) || !isPrecise(exp)) throw new Error("Invalid integer: " + exp + " is not a valid exponent.");
            var text = split[0];
            var decimalPlace = text.indexOf(".");
            if (decimalPlace >= 0) {
                exp -= text.length - decimalPlace - 1;
                text = text.slice(0, decimalPlace) + text.slice(decimalPlace + 1);
            }
            if (exp < 0) throw new Error("Cannot include negative exponent part for integers");
            text += (new Array(exp + 1)).join("0");
            v = text;
        }
        var isValid = /^([0-9][0-9]*)$/.test(v);
        if (!isValid) throw new Error("Invalid integer: " + v);
        if (supportsNativeBigInt) {
            return new NativeBigInt(BigInt(sign ? "-" + v : v));
        }
        var r = [], max = v.length, l = LOG_BASE, min = max - l;
        while (max > 0) {
            r.push(+v.slice(min, max));
            min -= l;
            if (min < 0) min = 0;
            max -= l;
        }
        trim(r);
        return new BigInteger(r, sign);
    }

    function parseNumberValue(v) {
        if (supportsNativeBigInt) {
            return new NativeBigInt(BigInt(v));
        }
        if (isPrecise(v)) {
            if (v !== truncate(v)) throw new Error(v + " is not an integer.");
            return new SmallInteger(v);
        }
        return parseStringValue(v.toString());
    }

    function parseValue(v) {
        if (typeof v === "number") {
            return parseNumberValue(v);
        }
        if (typeof v === "string") {
            return parseStringValue(v);
        }
        if (typeof v === "bigint") {
            return new NativeBigInt(v);
        }
        return v;
    }
    // Pre-define numbers in range [-999,999]
    for (var i = 0; i < 1000; i++) {
        Integer[i] = parseValue(i);
        if (i > 0) Integer[-i] = parseValue(-i);
    }
    // Backwards compatibility
    Integer.one = Integer[1];
    Integer.zero = Integer[0];
    Integer.minusOne = Integer[-1];
    Integer.max = max;
    Integer.min = min;
    Integer.gcd = gcd;
    Integer.lcm = lcm;
    Integer.isInstance = function (x) { return x instanceof BigInteger || x instanceof SmallInteger || x instanceof NativeBigInt; };
    Integer.randBetween = randBetween;

    Integer.fromArray = function (digits, base, isNegative) {
        return parseBaseFromArray(digits.map(parseValue), parseValue(base || 10), isNegative);
    };

    return Integer;
})();

// Node.js check
if (module.hasOwnProperty("exports")) {
    module.exports = bigInt;
}
});

let currentRaf = undefined;

const forceOutputFrame = () => {
  WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.FORCE_OUTPUT_FRAME
  });
  WasmBoyGraphics.renderFrame();
};

const runNumberOfFrames = async frames => {
  await WasmBoyLib.pause(); // Set up a raf function to continually update the canvas

  const rafUpdateCanvas = () => {
    currentRaf = raf_1(() => {
      if (currentRaf) {
        forceOutputFrame();
        rafUpdateCanvas();
      }
    });
  };

  rafUpdateCanvas();

  for (let i = 0; i < frames; i++) {
    await runWasmExport('executeFrame', []);
  }

  currentRaf = undefined;
  forceOutputFrame();
};
const runWasmExport = async (exportKey, parameters) => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.RUN_WASM_EXPORT,
    export: exportKey,
    parameters
  });
  const eventData = getEventData(event);
  return eventData.message.response;
};
const getWasmMemorySection = async (start, end) => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.GET_WASM_MEMORY_SECTION,
    start,
    end
  });
  const eventData = getEventData(event);
  return new Uint8Array(eventData.message.response);
};
const getWasmConstant = async constantKey => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.GET_WASM_CONSTANT,
    constant: constantKey
  });
  const eventData = getEventData(event);
  return eventData.message.response;
};
const getStepsAsString = async radix => {
  const stepsPerStepSet = await runWasmExport('getStepsPerStepSet');
  const stepSets = await runWasmExport('getStepSets');
  const steps = await runWasmExport('getSteps');
  const bigSteps = BigInteger(stepsPerStepSet).multiply(stepSets).add(steps);

  if (radix) {
    return bigSteps.toString(radix);
  }

  return bigSteps.toString(10);
};
const getCyclesAsString = async radix => {
  const cyclesPerCycleSet = await runWasmExport('getCyclesPerCycleSet');
  const cycleSets = await runWasmExport('getCycleSets');
  const cycles = await runWasmExport('getCycles');
  const bigCycles = BigInteger(cyclesPerCycleSet).multiply(cycleSets).add(cycles);

  if (radix) {
    return bigCycles.toString(radix);
  }

  return bigCycles.toString(10);
};

// Functions here are depedent on WasmBoyMemory state.
const messageRequests = {};

function libWorkerOnMessage(event) {
  const eventData = getEventData(event);

  if (!eventData.message) {
    return;
  }

  if (messageRequests[eventData.message.type]) {
    messageRequests[eventData.message.type].forEach(request => request(eventData.message));
  }

  switch (eventData.message.type) {
    case WORKER_MESSAGE_TYPE.UPDATED:
      {
        this.fps = eventData.message.fps;
        return;
      }

    case WORKER_MESSAGE_TYPE.BREAKPOINT:
      {
        const breakpointTask = async () => {
          await this.pause();

          if (this.options.breakpointCallback) {
            this.options.breakpointCallback();
          }
        };

        breakpointTask();
        return;
      }

    case WORKER_MESSAGE_TYPE.CRASHED:
      {
        const crashedTask = async () => {
          await this.pause();
          console.log('Wasmboy Crashed!');
          let programCounter = await runWasmExport('getProgramCounter');
          let gameboyMemoryConstant = await getWasmConstant('GAMEBOY_INTERNAL_MEMORY_LOCATION');
          let opcode = await getWasmMemorySection(gameboyMemoryConstant + programCounter, gameboyMemoryConstant + programCounter + 1);
          console.log(`Program Counter: 0x${programCounter.toString(16)}`);
          console.log(`Opcode: 0x${opcode[0].toString(16)}`);
        };

        crashedTask();
        return;
      }

    default:

  }
}

// WasmBoy Modules
let isWindowUnloading = false; // Our Main Orchestrator of the WasmBoy lib

class WasmBoyLibService {
  // Start the request to our wasm module
  constructor() {
    this.worker = undefined;
    this.coreType = undefined;
    this.canvasElement = undefined;
    this.paused = false;
    this.ready = false;
    this.loadedAndStarted = false;
    this.renderId = false;
    this.loadedROM = false;
    this.fps = 0;
    this.speed = 1.0; // Reset our config and stateful elements that depend on it
    // this.options is set here

    this._resetConfig(); // Add some listeners for when we are put into the background


    if (typeof window !== 'undefined') {
      // Calling promises in the hidden visibility change
      // On page reload, leaks memory
      // https://bugs.chromium.org/p/chromium/issues/detail?id=932885&can=1&q=torchh2424%40gmail.com&colspec=ID%20Pri%20M%20Stars%20ReleaseBlock%20Component%20Status%20Owner%20Summary%20OS%20Modified
      // Thus we need this hack, to get around this
      window.addEventListener('beforeunload', function (event) {
        isWindowUnloading = true;
      });
      window.document.addEventListener('visibilitychange', () => {
        // fires when user switches tabs, apps, goes to homescreen, etc.
        if (document.visibilityState === 'hidden') {
          if (this.options && this.options.disablePauseOnHidden) {
            return;
          }

          setTimeout(() => {
            if (!isWindowUnloading) {
              // See the comment above about the memory leak
              // This fires off a bunch of promises, thus a leak
              this.pause();
            }
          }, 0);
        }
      });
    }
  } // Function to initialize/configure Wasmboy


  config(wasmBoyOptions, canvasElement) {
    const configTask = async () => {
      // Pause any currently running game
      await this.pause(); // Get our canvas elements

      await this.setCanvas(canvasElement); // Reset our config and stateful elements that depend on it
      // If we have a new config to take its place

      if (wasmBoyOptions || !this.options) {
        this._resetConfig();
      } // set our options


      if (wasmBoyOptions) {
        // Set all options
        Object.keys(wasmBoyOptions).forEach(key => {
          if (this.options[key] !== undefined) {
            this.options[key] = wasmBoyOptions[key];
          }
        }); // Aliases
        // Gameboy Speed / Framerate

        if (wasmBoyOptions.gameboySpeed) {
          let gameboyFrameRate = Math.floor(wasmBoyOptions.gameboySpeed * 60);

          if (gameboyFrameRate <= 0) {
            gameboyFrameRate = 1;
          }

          this.options.gameboyFrameRate = gameboyFrameRate;
        }
      }
    };

    return configTask();
  } // Function to return our current configuration as an object


  getConfig() {
    return this.options;
  } // Function to get/set our canvas element
  // Useful for vaporboy


  setCanvas(canvasElement) {
    if (!canvasElement) {
      return Promise.resolve();
    }

    const setCanvasTask = async () => {
      await this.pause(); // Set our new canvas element, and re-run init on graphics to apply styles and things

      this.canvasElement = canvasElement;
      await WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback);
    };

    return setCanvasTask();
  }

  getCanvas() {
    return this.canvasElement;
  } // Finish request for wasm module, and fetch game


  loadROM(ROM, fetchHeaders) {
    const boundLoadROM = loadROMToWasmBoy.bind(this);
    return boundLoadROM(ROM, fetchHeaders);
  } // Function to start/resume


  play() {
    const playTask = async () => {
      if (!this.ready) {
        return;
      }

      if (!this.loadedAndStarted) {
        this.loadedAndStarted = true;

        if (this.options.onLoadedAndStarted) {
          this.options.onLoadedAndStarted();
        }
      }

      if (this.options.onPlay) {
        this.options.onPlay();
      } // Bless the audio, this is to fix any autoplay issues


      if (!this.options.headless) {
        WasmBoyAudio.resumeAudioContext();
        WasmBoyAudio.resetTimeStretch();
      } // Reset the audio queue index to stop weird pauses when trying to load a game


      await this.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.RESET_AUDIO_QUEUE
      }); // Undo any pause

      this.paused = false;

      if (!this.updateId) {
        await this.worker.postMessage({
          type: WORKER_MESSAGE_TYPE.PLAY
        });
      }

      if (!this.renderId && !this.options.headless) {
        this.renderId = raf_1(() => {
          render.call(this);
        });
      }
    };

    return playTask();
  } // Function to pause the game, returns a promise
  // Will try to wait until the emulation sync is returned, and then will
  // Allow any actions


  pause() {
    const pauseTask = async () => {
      this.paused = true;

      if (this.ready && this.options.onPause) {
        this.options.onPause();
      } // Cancel our update and render loop


      raf_1.cancel(this.renderId);
      this.renderId = false; // Cancel any playing audio
      // Audio played with latency may be still going on here

      if (!this.options.headless) {
        WasmBoyAudio.cancelAllAudio(true);
      }

      if (this.worker) {
        await this.worker.postMessage({
          type: WORKER_MESSAGE_TYPE.PAUSE
        });
      } // Wait a raf to ensure everything is done


      await new Promise(resolve => {
        raf_1(() => {
          resolve();
        });
      });
    };

    return pauseTask();
  } // Function to reset wasmBoy, with an optional set of options


  reset(wasmBoyOptions) {
    const resetTask = async () => {
      this.config(wasmBoyOptions, this.canvasElement); // Reload the game if one was already loaded

      if (this.loadedROM) {
        return this.loadROM(this.loadedROM);
      }
    };

    return resetTask();
  }

  getSavedMemory() {
    return WasmBoyMemory.getSavedMemory();
  }

  saveLoadedCartridge(additionalInfo) {
    return WasmBoyMemory.saveLoadedCartridge(additionalInfo);
  }

  deleteSavedCartridge(cartridge) {
    return WasmBoyMemory.deleteSavedCartridge(cartridge);
  }

  saveState() {
    const saveStateTask = async () => {
      await this.pause();
      const saveState = await WasmBoyMemory.saveState();
      return saveState;
    };

    return saveStateTask();
  } // Function to return the save states for the game


  getSaveStates() {
    const getSaveStatesTask = async () => {
      let cartridgeObject = await WasmBoyMemory.getCartridgeObject();

      if (!cartridgeObject) {
        return [];
      } else {
        return cartridgeObject.saveStates;
      }
    };

    return getSaveStatesTask();
  }

  loadState(saveState) {
    const loadStateTask = async () => {
      await this.pause();
      await WasmBoyMemory.loadState(saveState);
    };

    return loadStateTask();
  }

  deleteState(saveState) {
    const deleteStateTask = async () => {
      await WasmBoyMemory.deleteState(saveState);
    };

    return deleteStateTask();
  } // Simply returns the FPS we get back from the lib worker


  getFPS() {
    return this.fps;
  } // Simply returns our current Core Type


  getCoreType() {
    return this.coreType;
  }

  getSpeed() {
    return this.speed;
  } // Set the speed of the emulator
  // Should be a float. And by X times as fast


  setSpeed(speed) {
    if (speed <= 0) {
      speed = 0.1;
    }

    const setSpeedTask = async () => {
      if (this.worker) {
        this.speed = speed;
        WasmBoyAudio.setSpeed(speed);
        await this.worker.postMessageIgnoreResponse({
          type: WORKER_MESSAGE_TYPE.SET_SPEED,
          speed
        });
      } // Wait a raf to ensure everything is done


      await new Promise(resolve => {
        raf_1(() => {
          resolve();
        });
      });
    };

    setSpeedTask();
  } // Function to return if we currently are playing as a gbc console


  isGBC() {
    const isGBCTask = async () => {
      const event = await WasmBoyLib.worker.postMessage({
        type: WORKER_MESSAGE_TYPE.IS_GBC
      });
      const eventData = getEventData(event);
      return eventData.message.response;
    };

    return isGBCTask();
  } // Private Function to reset options to default


  _resetConfig() {
    // Reset Fps Metering
    this.fpsTimeStamps = [];
    this.frameSkipCounter = 0; // Configurable Options
    // Set callbacks to null and not undefined,
    // For when configs are passed, we will be sure to
    // add them as keys

    this.options = {
      headless: false,
      disablePauseOnHidden: false,
      isAudioEnabled: true,
      enableAudioDebugging: false,
      gameboyFrameRate: 60,
      frameSkip: 0,
      includeBootROM: false,
      isGbcEnabled: true,
      isGbcColorizationEnabled: true,
      gbcColorizationPalette: null,
      audioBatchProcessing: false,
      graphicsBatchProcessing: false,
      timersBatchProcessing: false,
      graphicsDisableScanlineRendering: false,
      audioAccumulateSamples: false,
      tileRendering: false,
      tileCaching: false,
      maxNumberOfAutoSaveStates: 10,
      updateGraphicsCallback: null,
      updateAudioCallback: null,
      saveStateCallback: null,
      breakpointCallback: null,
      onReady: null,
      onPlay: null,
      onPause: null,
      onLoadedAndStarted: null
    };
  } // Function to instantiate and set up our workers
  // This ensures we don't create workers twice


  _instantiateWorkers() {
    const instantiateWorkersTask = async () => {
      if (this.worker) {
        return;
      } else {
        this.worker = await instantiateWorkers();
        this.worker.addMessageListener(libWorkerOnMessage.bind(this));
      }
    };

    return instantiateWorkersTask();
  }

}

const WasmBoyLib = new WasmBoyLibService();

var name = "wasmboy";
var description = "Gameboy / Gameboy Color Emulator written for Web Assembly using AssemblyScript. Shell/Debugger in Preact";
var keywords = [
	"web-assembly",
	"webassembly",
	"gameboy",
	"emulator",
	"emulation",
	"assemblyscript",
	"gameboy-color"
];
var author = "Aaron Turner";
var version = "0.3.5";
var license = "GPL-3.0-or-later";
var homepage = "https://wasmboy.app";
var repository = {
	type: "git",
	url: "git+https://github.com/torch2424/wasmBoy.git"
};
var bugs = {
	url: "https://github.com/torch2424/wasmBoy/issues"
};
var main = "dist/wasmboy.wasm.cjs.js";
var module$1 = "dist/wasmboy.wasm.esm.js";
var browser = "dist/wasmboy.wasm.umd.js";
var iife = "dist/wasmboy.wasm.iife.js";
var scripts = {
	prepare: "npx run-s core:build lib:build",
	start: "npx concurrently --kill-others --names \"DEBUGGER,CORE,LIB\" -c \"bgBlue.bold,bgMagenta.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run core:watch\" \"npm run lib:watch:wasm\"",
	"start:ts": "npx concurrently --kill-others --names \"DEBUGGER,LIBANDCORETS\" -c \"bgBlue.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run lib:watch:ts\"",
	dev: "npm run start",
	watch: "npm run start",
	"dev:ts": "npm run start:ts",
	"watch:ts": "npm run start:ts",
	build: "npx run-s core:build lib:build:wasm",
	deploy: "npx run-s lib:deploy demo:deploy",
	prettier: "npm run prettier:lint:fix",
	"prettier:lint": "npx run-s prettier:lint:message prettier:lint:list",
	"prettier:lint:message": "echo \"Listing unlinted files, will show nothing if everything is fine.\"",
	"prettier:lint:list": "npx prettier --config .prettierrc --list-different rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
	"prettier:lint:fix": "npx prettier --config .prettierrc --write rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
	precommit: "npx pretty-quick --staged",
	"core:watch": "npx watch \"npm run core:build\" core",
	"core:build": "npx run-s core:build:asc core:build:dist core:build:done",
	"core:build:asc": "npx asc core/index.ts -b dist/core/core.untouched.wasm -t dist/core/core.untouched.wast -O3 --validate --sourceMap core/dist/core.untouched.wasm.map --memoryBase 0",
	"core:build:ts": "npx rollup -c --environment TS",
	"core:build:asc:measure": "npm run core:build:asc -- --measure --noEmit",
	"core:build:ts:measure": "npx tsc --project core/tsconfig.json --noEmit --extendedDiagnostics",
	"core:build:dist": "npx run-s core:build:dist:mkdir core:build:dist:cp",
	"core:build:dist:mkdir": "mkdir -p build/assets",
	"core:build:dist:cp": "cp dist/core/*.untouched.* build/assets",
	"core:build:done": "echo \"Built Core!\"",
	"lib:build": "npx run-s lib:build:wasm lib:build:ts lib:build:ts:getcoreclosure",
	"lib:watch:wasm": "npx rollup -c -w --environment WASM",
	"lib:build:wasm": "npx rollup -c --environment PROD,WASM",
	"lib:watch:ts": "npx rollup -c -w --environment TS",
	"lib:build:ts": "npx rollup -c --environment PROD,TS",
	"lib:build:ts:esnext": "npx rollup -c --environment PROD,TS,ES_NEXT",
	"lib:build:ts:getcoreclosure": "npx rollup -c --environment PROD,TS,GET_CORE_CLOSURE",
	"lib:build:ts:getcoreclosure:closuredebug": "npx rollup -c --environment PROD,TS,GET_CORE_CLOSURE,CLOSURE_DEBUG",
	"lib:deploy": "npx run-s core:build lib:build:wasm lib:build:ts lib:deploy:np",
	"lib:deploy:np": "npx np",
	test: "npm run test:accuracy",
	"test:accuracy": "npx run-s build test:accuracy:nobuild",
	"test:accuracy:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/accuracy/accuracy-test.js --exit",
	"test:perf": "npm run test:performance",
	"test:performance": "npx run-s build test:performance:nobuild",
	"test:performance:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/performance/performance-test.js --exit",
	"debugger:dev": "npm run debugger:watch",
	"debugger:watch": "npx rollup -c -w --environment DEBUGGER,SERVE",
	"debugger:build": "npx rollup -c --environment DEBUGGER",
	"benchmark:build": "npx rollup -c --environment PROD,TS,BENCHMARK",
	"benchmark:build:skiplib": "npx rollup -c --environment PROD,TS,BENCHMARK,SKIP_LIB",
	"benchmark:dev": "npm run benchmark:watch",
	"benchmark:watch": "npx rollup -c -w --environment BENCHMARK,SERVE",
	"amp:build": "npx rollup -c --environment PROD,TS,AMP",
	"amp:build:skiplib": "npx rollup -c --environment PROD,TS,AMP,SKIP_LIB",
	"amp:dev": "npm run amp:watch",
	"amp:watch": "npx rollup -c -w --environment AMP,SERVE",
	"demo:build": "npx run-s core:build lib:build demo:build:apps",
	"demo:build:apps": "npx run-s debugger:build benchmark:build:skiplib amp:build:skiplib",
	"demo:cname": "echo 'wasmboy.app' > build/CNAME",
	"demo:dist": "cp -r dist/ build/dist",
	"demo:gh-pages": "npx gh-pages -d build",
	"demo:deploy": "npx run-s demo:build demo:dist demo:cname demo:gh-pages"
};
var files = [
	"dist",
	"README.md",
	"LICENSE"
];
var dependencies = {
	"audiobuffer-to-wav": "git+https://github.com/torch2424/audiobuffer-to-wav.git#es-module-rollup",
	idb: "^2.1.3",
	raf: "^3.4.0",
	"responsive-gamepad": "1.1.0"
};
var devDependencies = {
	"@ampproject/rollup-plugin-closure-compiler": "^0.7.2",
	"@babel/core": "^7.1.2",
	"@babel/plugin-proposal-class-properties": "^7.1.0",
	"@babel/plugin-proposal-export-default-from": "^7.2.0",
	"@babel/plugin-proposal-object-rest-spread": "^7.0.0",
	"@babel/plugin-transform-react-jsx": "^7.0.0",
	"@phosphor/commands": "^1.6.1",
	"@phosphor/default-theme": "^0.1.0",
	"@phosphor/messaging": "^1.2.2",
	"@phosphor/widgets": "^1.6.0",
	assemblyscript: "github:AssemblyScript/assemblyscript",
	"babel-plugin-filter-imports": "^2.0.3",
	"babel-preset-env": "^1.6.1",
	"big-integer": "^1.6.38",
	"browser-detect": "^0.2.28",
	bulma: "^0.7.1",
	"chart.js": "^2.7.3",
	"chartjs-plugin-downsample": "^1.0.2",
	chota: "^0.5.2",
	concurrently: "^3.5.1",
	"devtools-detect": "^2.2.0",
	"gb-instructions-opcodes": "0.0.4",
	"gh-pages": "^1.1.0",
	husky: "^1.0.0-rc.8",
	"load-script": "^1.0.0",
	"markdown-table": "^1.1.1",
	microseconds: "^0.1.0",
	mocha: "^5.0.1",
	"normalize.css": "^8.0.1",
	np: "^3.1.0",
	"npm-run-all": "^4.1.5",
	"performance-now": "^2.1.0",
	"pngjs-image": "^0.11.7",
	"postcss-import": "^12.0.1",
	preact: "^8.2.1",
	"preact-compat": "^3.17.0",
	"preact-portal": "^1.1.3",
	"preact-virtual-list": "^0.3.1",
	prettier: "^1.12.1",
	"pretty-quick": "^1.6.0",
	pubx: "0.0.3",
	"recursive-readdir-sync": "^1.0.6",
	rollup: "^0.66.1",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-bundle-size": "^1.0.2",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-copy-glob": "^0.2.2",
	"rollup-plugin-delete": "^0.1.2",
	"rollup-plugin-hash": "^1.3.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-postcss": "^1.6.2",
	"rollup-plugin-replace": "^2.1.0",
	"rollup-plugin-serve": "^0.6.0",
	"rollup-plugin-typescript": "^1.0.0",
	"rollup-plugin-url": "^2.1.0",
	"shared-gb": "git+https://github.com/torch2424/shared-gb-js.git",
	"source-map-loader": "^0.2.4",
	"stats-lite": "^2.2.0",
	traverse: "^0.6.6",
	tslib: "^1.9.3",
	typescript: "^3.1.3",
	"uglifyjs-webpack-plugin": "^1.2.3",
	"url-loader": "^1.0.1",
	valoo: "^2.1.0",
	watch: "^1.0.2",
	"webpack-dev-server": "^3.1.10"
};
var packageJson = {
	name: name,
	description: description,
	keywords: keywords,
	author: author,
	version: version,
	license: license,
	homepage: homepage,
	repository: repository,
	bugs: bugs,
	main: main,
	module: module$1,
	browser: browser,
	iife: iife,
	scripts: scripts,
	files: files,
	dependencies: dependencies,
	devDependencies: devDependencies
};

// Build our public lib api
// export an object that public exposes parts of the singleton
// Need to bind to preserve this
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_objects/Function/bind

const WasmBoy = {
  config: WasmBoyLib.config.bind(WasmBoyLib),
  getCoreType: WasmBoyLib.getCoreType.bind(WasmBoyLib),
  getConfig: WasmBoyLib.getConfig.bind(WasmBoyLib),
  setCanvas: WasmBoyLib.setCanvas.bind(WasmBoyLib),
  getCanvas: WasmBoyLib.getCanvas.bind(WasmBoyLib),
  loadROM: WasmBoyLib.loadROM.bind(WasmBoyLib),
  play: WasmBoyLib.play.bind(WasmBoyLib),
  pause: WasmBoyLib.pause.bind(WasmBoyLib),
  reset: WasmBoyLib.reset.bind(WasmBoyLib),
  isPlaying: () => {
    return !WasmBoyLib.paused;
  },
  isPaused: () => {
    return WasmBoyLib.paused;
  },
  isReady: () => {
    return WasmBoyLib.ready;
  },
  isLoadedAndStarted: () => {
    return WasmBoyLib.loadedAndStarted;
  },
  getVersion: () => {
    return packageJson.version;
  },
  getSavedMemory: WasmBoyLib.getSavedMemory.bind(WasmBoyLib),
  saveLoadedCartridge: WasmBoyLib.saveLoadedCartridge.bind(WasmBoyLib),
  deleteSavedCartridge: WasmBoyLib.deleteSavedCartridge.bind(WasmBoyLib),
  saveState: WasmBoyLib.saveState.bind(WasmBoyLib),
  getSaveStates: WasmBoyLib.getSaveStates.bind(WasmBoyLib),
  loadState: WasmBoyLib.loadState.bind(WasmBoyLib),
  deleteState: WasmBoyLib.deleteState.bind(WasmBoyLib),
  getFPS: WasmBoyLib.getFPS.bind(WasmBoyLib),
  setSpeed: WasmBoyLib.setSpeed.bind(WasmBoyLib),
  isGBC: WasmBoyLib.isGBC.bind(WasmBoyLib),
  ResponsiveGamepad: WasmBoyController.ResponsiveGamepad,
  enableDefaultJoypad: WasmBoyController.enableDefaultJoypad.bind(WasmBoyController),
  disableDefaultJoypad: WasmBoyController.disableDefaultJoypad.bind(WasmBoyController),
  setJoypadState: WasmBoyController.setJoypadState.bind(WasmBoyController),
  resumeAudioContext: WasmBoyAudio.resumeAudioContext.bind(WasmBoyAudio),
  _getAudioChannels: WasmBoyAudio.getAudioChannels.bind(WasmBoyAudio),
  _getCartridgeInfo: WasmBoyMemory.getCartridgeInfo.bind(WasmBoyMemory),
  _runNumberOfFrames: runNumberOfFrames,
  _runWasmExport: runWasmExport,
  _getWasmMemorySection: getWasmMemorySection,
  _getWasmConstant: getWasmConstant,
  _getStepsAsString: getStepsAsString,
  _getCyclesAsString: getCyclesAsString
};

exports.WasmBoy = WasmBoy;
//# sourceMappingURL=wasmboy.wasm.cjs.js.map
