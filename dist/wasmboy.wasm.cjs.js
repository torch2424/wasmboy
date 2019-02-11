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
  PLAY_UNTIL_BREAKPOINT: 'PLAY_UNTIL_BREAKPOINT',
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
    // WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = this.wasmInstance.exports.frameInProgressVideoOutputLocation.valueOf();
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


    for (let i = 0; i < this.imageDataArray.length; i++) {
      this.canvasImageData.data[i] = this.imageDataArray[i];
    }

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

            this.worker.postMessage({
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

  initialize(headless, saveStateCallback) {
    const initializeTask = async () => {
      if (headless) {
        this.saveStateCallback = saveStateCallback;
        await this._initializeConstants();
      } else {
        this.saveStateCallback = saveStateCallback;
        await this._initializeConstants(); // initialize the autosave feature

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
      }

      cartridgeObject.saveStates.push(saveState);
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
    this.worker.postMessage({
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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBIKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKX19ZnVuY3Rpb24gSShhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfMl9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF8zX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzRfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc291bmRPdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7CmJyZWFrO2Nhc2UgZi5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSihhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geihhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLAphLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04rZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQShhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIEsoYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhazsKY2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpOwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCeXRlc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5TRVRfTUVNT1JZOmQ9T2JqZWN0LmtleXMoYi5tZXNzYWdlKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSwKYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2QuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuR0FNRUJPWV9NRU1PUlldKSxhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksCmEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5TRVRfTUVNT1JZX0RPTkV9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkdFVF9NRU1PUlk6e2Q9e3R5cGU6Zi5HRVRfTUVNT1JZfTtjb25zdCBsPVtdO3ZhciBjPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD1lJiYzPj1lP209MjA5NzE1Mjo1PD1lJiY2Pj1lP209MjYyMTQ0OjE1PD1lJiYxOT49ZT9tPTIwOTcxNTI6MjU8PWUmJjMwPj1lJiYobT04Mzg4NjA4KTtlPW0/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiwKYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbSk6bmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGU9eihhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmRbZy5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9QShhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT1jLGwucHVzaChjKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCxiLm1lc3NhZ2VJZCksbCl9fX1mdW5jdGlvbiBMKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpOwphLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB3KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEIoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gQyhhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUQtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0UoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEUoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRD1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksQyhhKSwhMDtMKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZDtjP3goYSxiKTooZD12b2lkIDAhPT1hLmJyZWFrcG9pbnQ/CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lVW50aWxCcmVha3BvaW50KGEuYnJlYWtwb2ludCk6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWUoKSxiKGQpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEIoYSk7Y29uc3QgZD17dHlwZTpmLlVQREFURUR9O2RbZy5DQVJUUklER0VfUkFNXT16KGEpLmJ1ZmZlcjtkW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyOwpkW2cuUEFMRVRURV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5JTlRFUk5BTF9TVEFURV09QShhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChkKSxbZFtnLkNBUlRSSURHRV9SQU1dLGRbZy5HQU1FQk9ZX01FTU9SWV0sZFtnLlBBTEVUVEVfTUVNT1JZXSxkW2cuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/ayhoKHt0eXBlOmYuQlJFQUtQT0lOVH0pKTpDKGEpfWVsc2UgayhoKHt0eXBlOmYuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHgoYSxiKXt2YXIgZD0tMTtkPXZvaWQgMCE9PWEuYnJlYWtwb2ludD8KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvVW50aWxCcmVha3BvaW50KDEwMjQsYS5icmVha3BvaW50KTphLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PWQmJmIoZCk7aWYoMT09PWQpe2Q9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nZXRBdWRpb1F1ZXVlSW5kZXgoKTtjb25zdCBjPXI+PXU7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmYz8oRihhLGQpLHNldFRpbWVvdXQoKCk9Pnt3KGEpO3goYSxiKX0sTWF0aC5mbG9vcihNYXRoLmZsb29yKDFFMyooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOihGKGEsZCkseChhLGIpKX19ZnVuY3Rpb24gRihhLGIpe3ZhciBkPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyOwpjb25zdCBjPXt0eXBlOmYuVVBEQVRFRCxhdWRpb0J1ZmZlcjpkLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX07ZD1bZF07aWYoYS5vcHRpb25zJiZhLm9wdGlvbnMuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Yy5jaGFubmVsMUJ1ZmZlcj1lO2QucHVzaChlKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Yy5jaGFubmVsMkJ1ZmZlcj1lO2QucHVzaChlKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDNCdWZmZXI9ZTtkLnB1c2goZSk7Yj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDRCdWZmZXI9YjtkLnB1c2goYil9YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChjKSxkKTthLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpfWNvbnN0IHA9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgdjtwfHwodj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2NvbnN0IGY9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLApHRVRfTUVNT1JZOiJHRVRfTUVNT1JZIixTRVRfTUVNT1JZOiJTRVRfTUVNT1JZIixTRVRfTUVNT1JZX0RPTkU6IlNFVF9NRU1PUllfRE9ORSIsR0VUX0NPTlNUQU5UUzoiR0VUX0NPTlNUQU5UUyIsR0VUX0NPTlNUQU5UU19ET05FOiJHRVRfQ09OU1RBTlRTX0RPTkUiLENPTkZJRzoiQ09ORklHIixSRVNFVF9BVURJT19RVUVVRToiUkVTRVRfQVVESU9fUVVFVUUiLFBMQVk6IlBMQVkiLFBMQVlfVU5USUxfQlJFQUtQT0lOVDoiUExBWV9VTlRJTF9CUkVBS1BPSU5UIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLFVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCIsCkZPUkNFX09VVFBVVF9GUkFNRToiRk9SQ0VfT1VUUFVUX0ZSQU1FIixTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSxnPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IHQ9MCxNPXt9O2NvbnN0IHk9e2Vudjp7bG9nOihhLGIsYyxmLGUsZyxoKT0+e3ZhciBkPShuZXcgVWludDMyQXJyYXkod2FzbUluc3RhbmNlLmV4cG9ydHMubWVtb3J5LmJ1ZmZlcixhLDEpKVswXTthPVN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxuZXcgVWludDE2QXJyYXkod2FzbUluc3RhbmNlLmV4cG9ydHMubWVtb3J5LmJ1ZmZlcixhKzQsZCkpOy05OTk5IT09YiYmKGE9YS5yZXBsYWNlKCIkMCIsCmIpKTstOTk5OSE9PWMmJihhPWEucmVwbGFjZSgiJDEiLGMpKTstOTk5OSE9PWYmJihhPWEucmVwbGFjZSgiJDIiLGYpKTstOTk5OSE9PWUmJihhPWEucmVwbGFjZSgiJDMiLGUpKTstOTk5OSE9PWcmJihhPWEucmVwbGFjZSgiJDQiLGcpKTstOTk5OSE9PWgmJihhPWEucmVwbGFjZSgiJDUiLGgpKTtjb25zb2xlLmxvZygiW1dhc21Cb3ldICIrYSl9LGhleExvZzooYSxiKT0+e2lmKCFNW2FdKXtsZXQgYz0iW1dhc21Cb3ldIjstOTk5OSE9PWEmJihjKz1gIDB4JHthLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1iJiYoYys9YCAweCR7Yi50b1N0cmluZygxNil9IGApO2NvbnNvbGUubG9nKGMpfX19fSxHPWFzeW5jKGEpPT57bGV0IGI9dm9pZCAwO3JldHVybiBiPVdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nP2F3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nKGZldGNoKGEpLHkpOmF3YWl0IChhc3luYygpPT57Y29uc3QgYj1hd2FpdCBmZXRjaChhKS50aGVuKChhKT0+CmEuYXJyYXlCdWZmZXIoKSk7cmV0dXJuIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGIseSl9KSgpfSxOPWFzeW5jKGEpPT57YT1CdWZmZXIuZnJvbShhLnNwbGl0KCIsIilbMV0sImJhc2U2NCIpO3JldHVybiBhd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShhLHkpfSxPPWFzeW5jKGEpPT57YT0oYT9hd2FpdCBHKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlRRVNZQXAvZjM5L2YzOS9mMzkvQUdBQUFHQUJmd0YvWUFKL2Z3QmdBWDhBWUFKL2Z3Ri9ZQUFCZjJBRGYzOS9BWDlnQTM5L2Z3QmdCbjkvZjM5L2Z3QmdCMzkvZjM5L2YzOEJmMkFIZjM5L2YzOS9md0JnQkg5L2YzOEJmMkFJZjM5L2YzOS9mMzhBWUFWL2YzOS9md0YvWUF4L2YzOS9mMzkvZjM5L2YzOEJmMkFBQUdBQ2YzOEJmd1BWQWRNQkFnSUJBUU1CQVFFQkFRRUJBUUVFQkFFQkFRQUdBUUVCQVFFQkFRRUVCQUVCQVFFQkFRRUJCZ1lHQmc0RkJ3Y1BDZ3NKQ1FnSUF3UUJBUVFCQkFFQkFRRUJBZ0lGQWdJQ0FnVU1CQVFFQVFJR0FnSURCQVFFQkFFQkFRRUVCUVFHQmdRREFnVUVBUkFFQlFNSUFRVUJCQUVGQkFRR0JnTUZCQU1FQkFRREF3Z0NBZ0lFQWdJQ0FnSUNBZ01FQkFJRUJBSUVCQUlFQkFJQ0FnSUNBZ0lDQWdJQ0JRSUNBZ0lDQWdRR0JnWVJCZ0lDQlFZR0JnSURCQVFOQmdZR0JnWUdCZ1lHQmdZR0JBRUJCZ1lHQmdFQkFRSUVCd1FFQVhBQUFRVURBUUFBQnBjTW1nSi9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUVlDQUFRdC9BRUdBa0FFTGZ3QkJnSUFDQzM4QVFZQ1FBd3QvQUVHQWdBRUxmd0JCZ0JBTGZ3QkJnSUFFQzM4QVFZQ1FCQXQvQUVHQUFRdC9BRUdBa1FRTGZ3QkJnTGdCQzM4QVFZREpCUXQvQUVHQTJBVUxmd0JCZ0tFTEMzOEFRWUNBREF0L0FFR0FvUmNMZndCQmdJQUpDMzhBUVlDaElBdC9BRUdBK0FBTGZ3QkJnSkFFQzM4QVFZQ0pIUXQvQUVHQW1TRUxmd0JCZ0lBSUMzOEFRWUNaS1F0L0FFR0FnQWdMZndCQmdKa3hDMzhBUVlDQUNBdC9BRUdBbVRrTGZ3QkJnSUFJQzM4QVFZQ1p3UUFMZndCQmdJQUlDMzhBUVlDWnlRQUxmd0JCZ0lBSUMzOEFRWUNaMFFBTGZ3QkJnSWo0QXd0L0FFR0FvY2tFQzM4QVFmLy9Bd3QvQUVFQUMzOEFRWUNoelFRTGZ3QkJsQUVMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWMvK0F3dC9BVUVBQzM4QlFmRCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUThMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIL0FBdC9BVUgvQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVlDbzFya0hDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUQzQWd0L0FVR0FnQWdMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSFYvZ01MZndGQjBmNERDMzhCUWRMK0F3dC9BVUhUL2dNTGZ3RkIxUDREQzM4QlFlaitBd3QvQVVIci9nTUxmd0ZCNmY0REMzOEJRUUFMZndGQkFRdC9BVUVDQzM4QVFZQ2h6UVFMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQkFMZndCQmdJQUVDMzhBUVlDUUJBdC9BRUdBa0FRTGZ3QkJnQUVMZndCQmdNa0ZDMzhBUVlDaEN3dC9BRUdBb1JjTGZ3QkJnSm5CQUF0L0FFR0FtY2tBQzM4QVFZQ1owUUFMZndGQkFBc0h1eEpzQm0xbGJXOXllUUlBQlhSaFlteGxBUUFHWTI5dVptbG5BQk1PYUdGelEyOXlaVk4wWVhKMFpXUUFGQWx6WVhabFUzUmhkR1VBR3dsc2IyRmtVM1JoZEdVQUpnVnBjMGRDUXdBbkVtZGxkRk4wWlhCelVHVnlVM1JsY0ZObGRBQW9DMmRsZEZOMFpYQlRaWFJ6QUNrSVoyVjBVM1JsY0hNQUtoVmxlR1ZqZFhSbFRYVnNkR2x3YkdWR2NtRnRaWE1BcndFTVpYaGxZM1YwWlVaeVlXMWxBSzRCQ0Y5elpYUmhjbWRqQU5FQkdXVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVc4QTBBRWJaWGhsWTNWMFpVWnlZVzFsVlc1MGFXeENjbVZoYTNCdmFXNTBBTEFCS0dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzlWYm5ScGJFSnlaV0ZyY0c5cGJuUUFzUUVWWlhobFkzVjBaVlZ1ZEdsc1EyOXVaR2wwYVc5dUFOSUJDMlY0WldOMWRHVlRkR1Z3QUtzQkZHZGxkRU41WTJ4bGMxQmxja041WTJ4bFUyVjBBTElCREdkbGRFTjVZMnhsVTJWMGN3Q3pBUWxuWlhSRGVXTnNaWE1BdEFFT2MyVjBTbTk1Y0dGa1UzUmhkR1VBdVFFZloyVjBUblZ0WW1WeVQyWlRZVzF3YkdWelNXNUJkV1JwYjBKMVptWmxjZ0NzQVJCamJHVmhja0YxWkdsdlFuVm1abVZ5QUNJWFYwRlRUVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRES2hOWFFWTk5RazlaWDAxRlRVOVNXVjlUU1ZwRkF5c1NWMEZUVFVKUFdWOVhRVk5OWDFCQlIwVlRBeXdlUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgweFBRMEZVU1U5T0F3QWFRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDFOSldrVURBUlpYUVZOTlFrOVpYMU5VUVZSRlgweFBRMEZVU1U5T0F3SVNWMEZUVFVKUFdWOVRWRUZVUlY5VFNWcEZBd01nUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNERDaHhIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXdzU1ZrbEVSVTlmVWtGTlgweFBRMEZVU1U5T0F3UU9Wa2xFUlU5ZlVrRk5YMU5KV2tVREJSRlhUMUpMWDFKQlRWOU1UME5CVkVsUFRnTUdEVmRQVWt0ZlVrRk5YMU5KV2tVREJ5WlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01JSWs5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VEQ1JoSFVrRlFTRWxEVTE5UFZWUlFWVlJmVEU5RFFWUkpUMDRER0JSSFVrRlFTRWxEVTE5UFZWUlFWVlJmVTBsYVJRTVpGRWRDUTE5UVFVeEZWRlJGWDB4UFEwRlVTVTlPQXd3UVIwSkRYMUJCVEVWVVZFVmZVMGxhUlFNTkdFSkhYMUJTU1U5U1NWUlpYMDFCVUY5TVQwTkJWRWxQVGdNT0ZFSkhYMUJTU1U5U1NWUlpYMDFCVUY5VFNWcEZBdzhPUmxKQlRVVmZURTlEUVZSSlQwNERFQXBHVWtGTlJWOVRTVnBGQXhFWFFrRkRTMGRTVDFWT1JGOU5RVkJmVEU5RFFWUkpUMDRERWhOQ1FVTkxSMUpQVlU1RVgwMUJVRjlUU1ZwRkF4TVNWRWxNUlY5RVFWUkJYMHhQUTBGVVNVOU9BeFFPVkVsTVJWOUVRVlJCWDFOSldrVURGUkpQUVUxZlZFbE1SVk5mVEU5RFFWUkpUMDRERmc1UFFVMWZWRWxNUlZOZlUwbGFSUU1YRlVGVlJFbFBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWlFVUZWUkVsUFgwSlZSa1pGVWw5VFNWcEZBeU1aUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01hRlVOSVFVNU9SVXhmTVY5Q1ZVWkdSVkpmVTBsYVJRTWJHVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZURTlEUVZSSlQwNERIQlZEU0VGT1RrVk1YekpmUWxWR1JrVlNYMU5KV2tVREhSbERTRUZPVGtWTVh6TmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4NFZRMGhCVGs1RlRGOHpYMEpWUmtaRlVsOVRTVnBGQXg4WlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZ0ZVTklRVTVPUlV4Zk5GOUNWVVpHUlZKZlUwbGFSUU1oRmtOQlVsUlNTVVJIUlY5U1FVMWZURTlEUVZSSlQwNERKQkpEUVZKVVVrbEVSMFZmVWtGTlgxTkpXa1VESlJaRFFWSlVVa2xFUjBWZlVrOU5YMHhQUTBGVVNVOU9BeVlTUTBGU1ZGSkpSRWRGWDFKUFRWOVRTVnBGQXljZFJFVkNWVWRmUjBGTlJVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERLQmxFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeWtoWjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBQUFNWjJWMFVtVm5hWE4wWlhKQkFMb0JER2RsZEZKbFoybHpkR1Z5UWdDN0FReG5aWFJTWldkcGMzUmxja01BdkFFTVoyVjBVbVZuYVhOMFpYSkVBTDBCREdkbGRGSmxaMmx6ZEdWeVJRQytBUXhuWlhSU1pXZHBjM1JsY2tnQXZ3RU1aMlYwVW1WbmFYTjBaWEpNQU1BQkRHZGxkRkpsWjJsemRHVnlSZ0RCQVJGblpYUlFjbTluY21GdFEyOTFiblJsY2dEQ0FROW5aWFJUZEdGamExQnZhVzUwWlhJQXd3RVpaMlYwVDNCamIyUmxRWFJRY205bmNtRnRRMjkxYm5SbGNnREVBUVZuWlhSTVdRREZBUjFrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZVFER0FSaGtjbUYzVkdsc1pVUmhkR0ZVYjFkaGMyMU5aVzF2Y25rQXh3RVRaSEpoZDA5aGJWUnZWMkZ6YlUxbGJXOXllUURJQVFablpYUkVTVllBeVFFSFoyVjBWRWxOUVFES0FRWm5aWFJVVFVFQXl3RUdaMlYwVkVGREFNd0JFM1Z3WkdGMFpVUmxZblZuUjBKTlpXMXZjbmtBelFFR2RYQmtZWFJsQUs0QkRXVnRkV3hoZEdsdmJsTjBaWEFBcXdFU1oyVjBRWFZrYVc5UmRXVjFaVWx1WkdWNEFLd0JEM0psYzJWMFFYVmthVzlSZFdWMVpRQWlEbmRoYzIxTlpXMXZjbmxUYVhwbEE0c0NISGRoYzIxQ2IzbEpiblJsY201aGJGTjBZWFJsVEc5allYUnBiMjREakFJWWQyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVlRhWHBsQTQwQ0hXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVXh2WTJGMGFXOXVBNDRDR1dkaGJXVkNiM2xKYm5SbGNtNWhiRTFsYlc5eWVWTnBlbVVEandJVGRtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnT1FBaUptY21GdFpVbHVVSEp2WjNKbGMzTldhV1JsYjA5MWRIQjFkRXh2WTJGMGFXOXVBNU1DRzJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWTWIyTmhkR2x2YmdPUkFoZG5ZVzFsWW05NVEyOXNiM0pRWVd4bGRIUmxVMmw2WlFPU0FoVmlZV05yWjNKdmRXNWtUV0Z3VEc5allYUnBiMjREbEFJTGRHbHNaVVJoZEdGTllYQURsUUlUYzI5MWJtUlBkWFJ3ZFhSTWIyTmhkR2x2YmdPV0FoRm5ZVzFsUW5sMFpYTk1iMk5oZEdsdmJnT1lBaFJuWVcxbFVtRnRRbUZ1YTNOTWIyTmhkR2x2YmdPWEFnZ0N6Z0VKQ0FFQVFRQUxBYzhCQ3FYWUFkTUJ6d0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVF4MUlnRkZEUUFDUUNBQlFRRnJEZzBCQVFFQ0FnSUNBd01FQkFVR0FBc01CZ3NnQUVHQW1kRUFhZzhMSUFCQkFTTTRJZ0FqT1VVaUFRUi9JQUJGQlNBQkN4dEJEblJxUVlDWjBBQnFEd3NnQUVHQWtINXFJem9FZnlNN0VBRkJBWEVGUVFBTFFRMTBhZzhMSUFBalBFRU5kR3BCZ05uR0FHb1BDeUFBUVlDUWZtb1BDMEVBSVFFQ2Z5TTZCRUFqUFJBQlFRZHhJUUVMSUFGQkFVZ0xCRUJCQVNFQkN5QUJRUXgwSUFCcVFZRHdmV29QQ3lBQVFZQlFhZ3NKQUNBQUVBQXRBQUFMbVFFQVFRQWtQa0VBSkQ5QkFDUkFRUUFrUVVFQUpFSkJBQ1JEUVFBa1JFRUFKRVZCQUNSR1FRQWtSMEVBSkVoQkFDUkpRUUFrU2tFQUpFdEJBQ1JNUVFBa1RTTTZCRUJCRVNRL1FZQUJKRVpCQUNSQVFRQWtRVUgvQVNSQ1FkWUFKRU5CQUNSRVFRMGtSUVZCQVNRL1FiQUJKRVpCQUNSQVFSTWtRVUVBSkVKQjJBRWtRMEVCSkVSQnpRQWtSUXRCZ0FJa1NFSCsvd01rUnd1a0FRRUNmMEVBSkU1QkFTUlBRY2NDRUFFaEFVRUFKRkJCQUNSUlFRQWtVa0VBSkZOQkFDUTVJQUVFUUNBQlFRRk9JZ0FFUUNBQlFRTk1JUUFMSUFBRVFFRUJKRkVGSUFGQkJVNGlBQVJBSUFGQkJrd2hBQXNnQUFSQVFRRWtVZ1VnQVVFUFRpSUFCRUFnQVVFVFRDRUFDeUFBQkVCQkFTUlRCU0FCUVJsT0lnQUVRQ0FCUVI1TUlRQUxJQUFFUUVFQkpEa0xDd3NMQlVFQkpGQUxRUUVrT0VFQUpEd0xDd0FnQUJBQUlBRTZBQUFMTHdCQjBmNERRZjhCRUFSQjB2NERRZjhCRUFSQjAvNERRZjhCRUFSQjFQNERRZjhCRUFSQjFmNERRZjhCRUFRTG1BRUFRUUFrVkVFQUpGVkJBQ1JXUVFBa1YwRUFKRmhCQUNSWlFRQWtXaU02QkVCQmtBRWtWa0hBL2dOQmtRRVFCRUhCL2dOQmdRRVFCRUhFL2dOQmtBRVFCRUhIL2dOQi9BRVFCQVZCa0FFa1ZrSEEvZ05Ca1FFUUJFSEIvZ05CaFFFUUJFSEcvZ05CL3dFUUJFSEgvZ05CL0FFUUJFSEkvZ05CL3dFUUJFSEovZ05CL3dFUUJBdEJ6LzREUVFBUUJFSHcvZ05CQVJBRUMwOEFJem9FUUVIby9nTkJ3QUVRQkVIcC9nTkIvd0VRQkVIcS9nTkJ3UUVRQkVIci9nTkJEUkFFQlVIby9nTkIvd0VRQkVIcC9nTkIvd0VRQkVIcS9nTkIvd0VRQkVIci9nTkIvd0VRQkFzTEx3QkJrUDREUVlBQkVBUkJrZjREUWI4QkVBUkJrdjREUWZNQkVBUkJrLzREUWNFQkVBUkJsUDREUWI4QkVBUUxMQUJCbGY0RFFmOEJFQVJCbHY0RFFUOFFCRUdYL2dOQkFCQUVRWmorQTBFQUVBUkJtZjREUWJnQkVBUUxNZ0JCbXY0RFFmOEFFQVJCbS80RFFmOEJFQVJCblA0RFFaOEJFQVJCbmY0RFFRQVFCRUdlL2dOQnVBRVFCRUVCSkdzTExRQkJuLzREUWY4QkVBUkJvUDREUWY4QkVBUkJvZjREUVFBUUJFR2kvZ05CQUJBRVFhUCtBMEcvQVJBRUN6Z0FRUThrYkVFUEpHMUJEeVJ1UVE4a2IwRUFKSEJCQUNSeFFRQWtja0VBSkhOQi93QWtkRUgvQUNSMVFRRWtka0VCSkhkQkFDUjRDMmNBUVFBa1cwRUFKRnhCQUNSZFFRRWtYa0VCSkY5QkFTUmdRUUVrWVVFQkpHSkJBU1JqUVFFa1pFRUJKR1ZCQVNSbVFRQWtaMEVBSkdoQkFDUnBRUUFrYWhBSUVBa1FDaEFMUWFUK0EwSDNBQkFFUWFYK0EwSHpBUkFFUWFiK0EwSHhBUkFFRUF3TE9BQWdBRUVCY1VFQVJ5UjVJQUJCQW5GQkFFY2tlaUFBUVFSeFFRQkhKSHNnQUVFSWNVRUFSeVI4SUFCQkVIRkJBRWNrZlNBQUpINExQUUFnQUVFQmNVRUFSeVIvSUFCQkFuRkJBRWNrZ0FFZ0FFRUVjVUVBUnlTQkFTQUFRUWh4UVFCSEpJSUJJQUJCRUhGQkFFY2tnd0VnQUNTRUFRdGRBRUVBSklVQlFRQWtoZ0ZCQUNTSEFVRUFKSWdCUVFBa2lRRkJBQ1NLQVVFQUpJc0JRUUFrakFFak9nUkFRWVQrQTBFZUVBUkJvRDBraGdFRlFZVCtBMEdyQVJBRVFjelhBaVNHQVF0QmgvNERRZmdCRUFSQitBRWtpZ0VMUWdCQkFDU05BVUVBSkk0Qkl6b0VRRUdDL2dOQi9BQVFCRUVBSkk4QlFRQWtrQUZCQUNTUkFRVkJndjREUWY0QUVBUkJBQ1NQQVVFQkpKQUJRUUFra1FFTEMvWUJBUUovUWNNQ0VBRWlBVUhBQVVZaUFBUi9JQUFGSUFGQmdBRkdJeThpQUNBQUd3c0VRRUVCSkRvRlFRQWtPZ3NRQWhBREVBVVFCaEFIRUExQkFCQU9RZi8vQXlOK0VBUkI0UUVRRDBHUC9nTWpoQUVRQkJBUUVCRWpPZ1JBUWZEK0EwSDRBUkFFUWMvK0EwSCtBUkFFUWMzK0EwSCtBQkFFUVlEK0EwSFBBUkFFUVkvK0EwSGhBUkFFUWV6K0EwSCtBUkFFUWZYK0EwR1BBUkFFQlVIdy9nTkIvd0VRQkVIUC9nTkIvd0VRQkVITi9nTkIvd0VRQkVHQS9nTkJ6d0VRQkVHUC9nTkI0UUVRQkF0QkFDUXRRWUNvMXJrSEpKSUJRUUFra3dGQkFDU1VBVUdBcU5hNUJ5U1ZBVUVBSkpZQlFRQWtsd0VMcmdFQUlBQkJBRW9FUUVFQkpDNEZRUUFrTGdzZ0FVRUFTZ1JBUVFFa0x3VkJBQ1F2Q3lBQ1FRQktCRUJCQVNRd0JVRUFKREFMSUFOQkFFb0VRRUVCSkRFRlFRQWtNUXNnQkVFQVNnUkFRUUVrTWdWQkFDUXlDeUFGUVFCS0JFQkJBU1F6QlVFQUpETUxJQVpCQUVvRVFFRUJKRFFGUVFBa05Bc2dCMEVBU2dSQVFRRWtOUVZCQUNRMUN5QUlRUUJLQkVCQkFTUTJCVUVBSkRZTElBbEJBRW9FUUVFQkpEY0ZRUUFrTndzUUVnc01BQ010QkVCQkFROExRUUFMc2dFQVFZQUlJejg2QUFCQmdRZ2pRRG9BQUVHQ0NDTkJPZ0FBUVlNSUkwSTZBQUJCaEFnalF6b0FBRUdGQ0NORU9nQUFRWVlJSTBVNkFBQkJod2dqUmpvQUFFR0lDQ05IT3dFQVFZb0lJMGc3QVFCQmpBZ2pTVFlDQUNOS0JFQkJrUWhCQVRvQUFBVkJrUWhCQURvQUFBc2pTd1JBUVpJSVFRRTZBQUFGUVpJSVFRQTZBQUFMSTB3RVFFR1RDRUVCT2dBQUJVR1RDRUVBT2dBQUN5Tk5CRUJCbEFoQkFUb0FBQVZCbEFoQkFEb0FBQXNMckFFQVFjZ0pJemc3QVFCQnlna2pQRHNCQUNOT0JFQkJ6QWxCQVRvQUFBVkJ6QWxCQURvQUFBc2pUd1JBUWMwSlFRRTZBQUFGUWMwSlFRQTZBQUFMSTFBRVFFSE9DVUVCT2dBQUJVSE9DVUVBT2dBQUN5TlJCRUJCendsQkFUb0FBQVZCendsQkFEb0FBQXNqVWdSQVFkQUpRUUU2QUFBRlFkQUpRUUE2QUFBTEkxTUVRRUhSQ1VFQk9nQUFCVUhSQ1VFQU9nQUFDeU01QkVCQjBnbEJBVG9BQUFWQjBnbEJBRG9BQUFzTFN3QkIrZ2tqaFFFMkFnQkIvZ2tqaGdFMkFnQWppd0VFUUVHQ0NrRUJPZ0FBQlVHQ0NrRUFPZ0FBQ3lPTUFRUkFRWVVLUVFFNkFBQUZRWVVLUVFBNkFBQUxRWVgrQXlPSEFSQUVDM2dBSTVzQkJFQkIzZ3BCQVRvQUFBVkIzZ3BCQURvQUFBdEIzd29qbkFFMkFnQkI0d29qblFFMkFnQkI1d29qbmdFMkFnQkI3QW9qbndFMkFnQkI4UW9qb0FFNkFBQkI4Z29qb1FFNkFBQWpvZ0VFUUVIM0NrRUJPZ0FBQlVIM0NrRUFPZ0FBQzBINENpT2pBVFlDQUVIOUNpT2tBVHNCQUF0UEFDT2xBUVJBUVpBTFFRRTZBQUFGUVpBTFFRQTZBQUFMUVpFTEk2WUJOZ0lBUVpVTEk2Y0JOZ0lBUVprTEk2Z0JOZ0lBUVo0TEk2a0JOZ0lBUWFNTEk2b0JPZ0FBUWFRTEk2c0JPZ0FBQzBZQUk3QUJCRUJCOUF0QkFUb0FBQVZCOUF0QkFEb0FBQXRCOVFzanNRRTJBZ0JCK1FzanNnRTJBZ0JCL1FzanN3RTJBZ0JCZ2d3anRBRTJBZ0JCaHd3anRRRTdBUUFMb3dFQUVCVkJzZ2dqVlRZQ0FFRzJDQ09ZQVRvQUFFSEUvZ01qVmhBRUk1a0JCRUJCNUFoQkFUb0FBQVZCNUFoQkFEb0FBQXNqbWdFRVFFSGxDRUVCT2dBQUJVSGxDRUVBT2dBQUN4QVdFQmRCckFvalp6WUNBRUd3Q2lOb09nQUFRYkVLSTJrNkFBQVFHQkFaSTZ3QkJFQkJ3Z3RCQVRvQUFBVkJ3Z3RCQURvQUFBdEJ3d3NqclFFMkFnQkJ4d3NqcmdFMkFnQkJ5d3NqcndFN0FRQVFHa0VBSkMwTHJnRUFRWUFJTFFBQUpEOUJnUWd0QUFBa1FFR0NDQzBBQUNSQlFZTUlMUUFBSkVKQmhBZ3RBQUFrUTBHRkNDMEFBQ1JFUVlZSUxRQUFKRVZCaHdndEFBQWtSa0dJQ0M4QkFDUkhRWW9JTHdFQUpFaEJqQWdvQWdBa1NRSi9RUUZCa1FndEFBQkJBRW9OQUJwQkFBc2tTZ0ovUVFGQmtnZ3RBQUJCQUVvTkFCcEJBQXNrU3dKL1FRRkJrd2d0QUFCQkFFb05BQnBCQUFza1RBSi9RUUZCbEFndEFBQkJBRW9OQUJwQkFBc2tUUXRjQVFGL1FRQWtWVUVBSkZaQnhQNERRUUFRQkVIQi9nTVFBVUY4Y1NFQlFRQWttQUZCd2Y0RElBRVFCQ0FBQkVBQ1FFRUFJUUFEUUNBQVFZQ0pIVTROQVNBQVFZQ1FCR3BCL3dFNkFBQWdBRUVCYWlFQURBQUFDd0FMQ3d1SUFRRUJmeU8yQVNFQklBQkJnQUZ4UVFCSEpMWUJJQUJCd0FCeFFRQkhKTGNCSUFCQklIRkJBRWNrdUFFZ0FFRVFjVUVBUnlTNUFTQUFRUWh4UVFCSEpMb0JJQUJCQkhGQkFFY2t1d0VnQUVFQ2NVRUFSeVM4QVNBQVFRRnhRUUJISkwwQkk3WUJSU0FCSUFFYkJFQkJBUkFkQ3lBQlJTSUFCSDhqdGdFRklBQUxCRUJCQUJBZEN3cytBQUovUVFGQjVBZ3RBQUJCQUVvTkFCcEJBQXNrbVFFQ2YwRUJRZVVJTFFBQVFRQktEUUFhUVFBTEpKb0JRZi8vQXhBQkVBNUJqLzRERUFFUUR3dWxBUUJCeUFrdkFRQWtPRUhLQ1M4QkFDUThBbjlCQVVITUNTMEFBRUVBU2cwQUdrRUFDeVJPQW45QkFVSE5DUzBBQUVFQVNnMEFHa0VBQ3lSUEFuOUJBVUhPQ1MwQUFFRUFTZzBBR2tFQUN5UlFBbjlCQVVIUENTMEFBRUVBU2cwQUdrRUFDeVJSQW45QkFVSFFDUzBBQUVFQVNnMEFHa0VBQ3lSU0FuOUJBVUhSQ1MwQUFFRUFTZzBBR2tFQUN5UlRBbjlCQVVIU0NTMEFBRUVBU2cwQUdrRUFDeVE1QzFzQVFmb0pLQUlBSklVQlFmNEpLQUlBSklZQkFuOUJBVUdDQ2kwQUFFRUFTZzBBR2tFQUN5U0xBUUovUVFGQmhRb3RBQUJCQUVvTkFCcEJBQXNrakFGQmhmNERFQUVraHdGQmh2NERFQUVraUFGQmgvNERFQUVraWdFTEJnQkJBQ1JxQzNZQUFuOUJBVUhlQ2kwQUFFRUFTZzBBR2tFQUN5U2JBVUhmQ2lnQ0FDU2NBVUhqQ2lnQ0FDU2RBVUhuQ2lnQ0FDU2VBVUhzQ2lnQ0FDU2ZBVUh4Q2kwQUFDU2dBVUh5Q2kwQUFDU2hBUUovUVFGQjl3b3RBQUJCQUVvTkFCcEJBQXNrb2dGQitBb29BZ0Frb3dGQi9Rb3ZBUUFrcEFFTFRnQUNmMEVCUVpBTExRQUFRUUJLRFFBYVFRQUxKS1VCUVpFTEtBSUFKS1lCUVpVTEtBSUFKS2NCUVprTEtBSUFKS2dCUVo0TEtBSUFKS2tCUWFNTExRQUFKS29CUWFRTExRQUFKS3NCQzBVQUFuOUJBVUgwQ3kwQUFFRUFTZzBBR2tFQUN5U3dBVUgxQ3lnQ0FDU3hBVUg1Q3lnQ0FDU3lBVUg5Q3lnQ0FDU3pBVUdDRENnQ0FDUzBBVUdIREM4QkFDUzFBUXZRQVFFQmZ4QWNRYklJS0FJQUpGVkJ0Z2d0QUFBa21BRkJ4UDRERUFFa1ZrSEEvZ01RQVJBZUVCOUJnUDRERUFGQi93RnpKTDRCSTc0QklnQkJFSEZCQUVja3Z3RWdBRUVnY1VFQVJ5VEFBUkFnRUNGQnJBb29BZ0FrWjBHd0NpMEFBQ1JvUWJFS0xRQUFKR2xCQUNScUVDTVFKQUovUVFGQndnc3RBQUJCQUVvTkFCcEJBQXNrckFGQnd3c29BZ0FrclFGQnh3c29BZ0FrcmdGQnl3c3ZBUUFrcndFUUpVRUFKQzFCZ0tqV3VRY2trZ0ZCQUNTVEFVRUFKSlFCUVlDbzFya0hKSlVCUVFBa2xnRkJBQ1NYQVFzTUFDTTZCRUJCQVE4TFFRQUxCUUFqbFFFTEJRQWpsZ0VMQlFBamx3RUwyQUlCQlg4Q2Z3Si9JQUZCQUVvaUJRUkFJQUJCQ0VvaEJRc2dCUXNFUUNQQ0FTQUVSaUVGQ3lBRkN3Ui9JOE1CSUFCR0JTQUZDd1JBUVFBaEJVRUFJUVFnQTBFQmF4QUJRU0J4QkVCQkFTRUZDeUFERUFGQklIRUVRRUVCSVFRTFFRQWhBd05BSUFOQkNFZ0VRRUVISUFOcklBTWdCQ0FGUnhzaUF5QUFha0dnQVV3RVFDQUFRUWdnQTJ0cklRY2dBQ0FEYWlBQlFhQUJiR3BCQTJ4QmdNa0ZhaUVKUVFBaEJnTkFJQVpCQTBnRVFDQUFJQU5xSUFGQm9BRnNha0VEYkVHQXlRVnFJQVpxSUFZZ0NXb3RBQUE2QUFBZ0JrRUJhaUVHREFFTEN5QUFJQU5xSUFGQm9BRnNha0dBa1FScUlBRkJvQUZzSUFkcVFZQ1JCR290QUFBaUJrRURjU0lIUVFSeUlBY2dCa0VFY1JzNkFBQWdDRUVCYWlFSUN5QURRUUZxSVFNTUFRc0xCU0FFSk1JQkN5QUFJOE1CVGdSQUlBQkJDR29rd3dFZ0FDQUNRUWh2SWdSSUJFQWp3d0VnQkdva3d3RUxDeUFJQ3pnQkFYOGdBRUdBa0FKR0JFQWdBVUdBQVdvaEFpQUJRWUFCY1FSQUlBRkJnQUZySVFJTElBSkJCSFFnQUdvUEN5QUJRUVIwSUFCcUMwb0FJQUJCQTNRZ0FVRUJkR29pQUVFQmFrRS9jU0lCUVVCcklBRWdBaHRCZ0pBRWFpMEFBQ0VCSUFCQlAzRWlBRUZBYXlBQUlBSWJRWUNRQkdvdEFBQWdBVUgvQVhGQkNIUnlDMUVBSUFKRkJFQWdBUkFCSUFCQkFYUjFRUU54SVFBTFFmSUJJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXd0Qm9BRWhBUXdDQzBIWUFDRUJEQUVMUVFnaEFRc2dBUXZoQWdFSGZ5QUJJQUFRTENBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnMGdDRWdFUUVFSElBQnJJUVVnQzBFQVNDSUNCSDhnQWdVZ0MwRWdjVVVMSVFGQkFDRUNBbjlCQVNBRklBQWdBUnNpQVhRZ0VuRUVRRUVDSVFJTElBSkJBV29MSUFKQkFTQUJkQ0FSY1JzaEFpQUxRUUJPQkg4Z0MwRUhjU0FDUVFBUUxTSUZRUjl4UVFOMElRNGdCVUhnQjNGQkJYVkJBM1FoQVNBRlFZRDRBWEZCQ25WQkEzUUZJQUpCeC80RElBOGdEMEVBVEJzaUR5QUtFQzRpQlNFT0lBVWlBUXNoQlNBSElBaHNJQTFxUVFOc0lBbHFJaEFnRGpvQUFDQVFRUUZxSUFFNkFBQWdFRUVDYWlBRk9nQUFJQWRCb0FGc0lBMXFRWUNSQkdvZ0FrRURjU0lCUVFSeUlBRWdDMEdBQVhGQkFFZEJBQ0FMUVFCT0d4czZBQUFnREVFQmFpRU1DeUFBUVFGcUlRQU1BUXNMSUF3TGZnRURmeUFEUVFodklRTWdBRVVFUUNBQ0lBSkJDRzFCQTNScklRY0xRYUFCSUFCclFRY2dBRUVJYWtHZ0FVb2JJUWxCZnlFQ0l6b0VRQ0FFUVlEUWZtb3RBQUFpQWtFSWNRUkFRUUVoQ0FzZ0FrSEFBSEVFUUVFSElBTnJJUU1MQ3lBR0lBVWdDQ0FISUFrZ0F5QUFJQUZCb0FGQmdNa0ZRUUFnQWhBdkM2WUNBQ0FGSUFZUUxDRUdJQU5CQ0c4aEF5QUVRWURRZm1vdEFBQWlCRUhBQUhFRWYwRUhJQU5yQlNBREMwRUJkQ0FHYWlJRFFZQ1FmbXBCQVVFQUlBUkJDSEViUVFGeFFRMTBJZ1ZxTFFBQUlRWWdBMEdCa0g1cUlBVnFMUUFBSVFVZ0FrRUlieUVEUVFBaEFpQUJRYUFCYkNBQWFrRURiRUdBeVFWcUlBUkJCM0VDZjBFQklBTkJCeUFEYXlBRVFTQnhHeUlEZENBRmNRUkFRUUloQWdzZ0FrRUJhZ3NnQWtFQklBTjBJQVp4R3lJQ1FRQVFMU0lEUVI5eFFRTjBPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZSEpCV29nQTBIZ0IzRkJCWFZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQURRWUQ0QVhGQkNuVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQmdKRUVhaUFDUVFOeElnQkJCSElnQUNBRVFZQUJjUnM2QUFBTHRRRUFJQVFnQlJBc0lBTkJDRzlCQVhScUlnUkJnSkIrYWkwQUFDRUZRUUFoQXlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxQW44Z0JFR0JrSDVxTFFBQVFRRkJCeUFDUVFodmF5SUNkSEVFUUVFQ0lRTUxJQU5CQVdvTElBTkJBU0FDZENBRmNSc2lBMEhIL2dOQkFCQXVJZ0k2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ09nQUFJQUZCb0FGc0lBQnFRUU5zUVlMSkJXb2dBam9BQUNBQlFhQUJiQ0FBYWtHQWtRUnFJQU5CQTNFNkFBQUwxUUVCQm44Z0EwRURkU0VMQTBBZ0JFR2dBVWdFUUNBRUlBVnFJZ1pCZ0FKT0JFQWdCa0dBQW1zaEJnc2dDMEVGZENBQ2FpQUdRUU4xYWlJSlFZQ1FmbW90QUFBaENFRUFJUW9qTmdSQUlBUWdBQ0FHSUFrZ0NCQXJJZ2RCQUVvRVFFRUJJUW9nQjBFQmF5QUVhaUVFQ3dzZ0NrVWpOU0lISUFjYkJFQWdCQ0FBSUFZZ0F5QUpJQUVnQ0JBd0lnZEJBRW9FUUNBSFFRRnJJQVJxSVFRTEJTQUtSUVJBSXpvRVFDQUVJQUFnQmlBRElBa2dBU0FJRURFRklBUWdBQ0FHSUFNZ0FTQUlFRElMQ3dzZ0JFRUJhaUVFREFFTEN3c3JBUUYvSTFjaEF5QUFJQUVnQWlOWUlBQnFJZ0JCZ0FKT0JIOGdBRUdBQW1zRklBQUxRUUFnQXhBekN6QUJBMzhqV1NFRElBQWpXaUlFU0FSQUR3c2dBMEVIYXlJRFFYOXNJUVVnQUNBQklBSWdBQ0FFYXlBRElBVVFNd3ZFQlFFUGZ3SkFRU2NoQ1FOQUlBbEJBRWdOQVNBSlFRSjBJZ1JCZ1B3RGFoQUJJUUlnQkVHQi9BTnFFQUVoQ2lBRVFZTDhBMm9RQVNFRElBSkJFR3NoQWlBS1FRaHJJUXBCQ0NFRklBRUVRRUVRSVFVZ0EwRUNiMEVCUmdSL0lBTkJBV3NGSUFNTElRTUxJQUFnQWs0aUJnUkFJQUFnQWlBRmFrZ2hCZ3NnQmdSQUlBUkJnL3dEYWhBQklnWkJnQUZ4UVFCSElRc2dCa0VnY1VFQVJ5RU9RWUNBQWlBREVDd2dBQ0FDYXlJQ0lBVnJRWDlzUVFGcklBSWdCa0hBQUhFYlFRRjBhaUlEUVlDUWZtcEJBVUVBSUFaQkNIRkJBRWNqT2lJQ0lBSWJHMEVCY1VFTmRDSUNhaTBBQUNFUElBTkJnWkIrYWlBQ2FpMEFBQ0VRUVFjaEJRTkFJQVZCQUU0RVFFRUFJUWdDZjBFQklBVWlBa0VIYTBGL2JDQUNJQTRiSWdKMElCQnhCRUJCQWlFSUN5QUlRUUZxQ3lBSVFRRWdBblFnRDNFYklnZ0VRRUVISUFWcklBcHFJZ2RCQUU0aUFnUkFJQWRCb0FGTUlRSUxJQUlFUUVFQUlReEJBQ0VOUVFGQkFDTzlBVVVqT2lJRElBTWJHeUlDUlFSQUlBQkJvQUZzSUFkcVFZQ1JCR290QUFBaUEwRURjU0lFUVFCS0lBc2dDeHNFUUVFQklRd0ZJQU5CQkhGQkFFY2pPaUlESUFNYklnTUVRQ0FFUVFCS0lRTUxRUUZCQUNBREd5RU5Dd3NnQWtVRVFDQU1SU0lFQkg4Z0RVVUZJQVFMSVFJTElBSUVRQ002QkVBZ0FFR2dBV3dnQjJwQkEyeEJnTWtGYWlBR1FRZHhJQWhCQVJBdElnUkJIM0ZCQTNRNkFBQWdBRUdnQVd3Z0IycEJBMnhCZ2NrRmFpQUVRZUFIY1VFRmRVRURkRG9BQUNBQVFhQUJiQ0FIYWtFRGJFR0N5UVZxSUFSQmdQZ0JjVUVLZFVFRGREb0FBQVVnQUVHZ0FXd2dCMnBCQTJ4QmdNa0ZhaUFJUWNuK0EwSEkvZ01nQmtFUWNSdEJBQkF1SWdNNkFBQWdBRUdnQVd3Z0IycEJBMnhCZ2NrRmFpQURPZ0FBSUFCQm9BRnNJQWRxUVFOc1FZTEpCV29nQXpvQUFBc0xDd3NnQlVFQmF5RUZEQUVMQ3dzZ0NVRUJheUVKREFBQUN3QUxDMllCQW45QmdKQUNJUUZCZ0lBQ1FZQ1FBaU81QVJzaEFTTTZJNzBCSXpvYkJFQkJnTEFDSVFJZ0FDQUJRWUM0QWtHQXNBSWp1Z0ViRURRTEk3Z0JCRUJCZ0xBQ0lRSWdBQ0FCUVlDNEFrR0FzQUlqdHdFYkVEVUxJN3dCQkVBZ0FDTzdBUkEyQ3dzbEFRRi9Ba0FEUUNBQVFaQUJTdzBCSUFCQi93RnhFRGNnQUVFQmFpRUFEQUFBQ3dBTEMwWUJBbjhEUUNBQlFaQUJUa1VFUUVFQUlRQURRQ0FBUWFBQlNBUkFJQUZCb0FGc0lBQnFRWUNSQkdwQkFEb0FBQ0FBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3dzTEhRRUJmMEdQL2dNUUFVRUJJQUIwY2lJQkpJUUJRWS8rQXlBQkVBUUxDd0JCQVNTQUFVRUJFRG9MUlFFQ2YwR1UvZ01RQVVINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBRVFaVCtBeUFCSUFCQkNIVWlBSElRQkNBQ0pNOEJJQUFrMEFFanp3RWowQUZCQ0hSeUpORUJDMllCQW44anBBRWlBU1BOQVhVaEFDQUJJQUJySUFBZ0FXb2p6Z0ViSWdCQi93OU1JZ0VFZnlQTkFVRUFTZ1VnQVFzRVFDQUFKS1FCSUFBUVBDT2tBU0lCSTgwQmRTRUFJQUVnQUdzZ0FDQUJhaVBPQVJzaEFBc2dBRUgvRDBvRVFFRUFKSnNCQ3dzc0FDT2pBVUVCYXlTakFTT2pBVUVBVEFSQUk4d0JKS01CSTh3QlFRQktJNklCSTZJQkd3UkFFRDBMQ3d0YkFRRi9JNTBCUVFGckpKMEJJNTBCUVFCTUJFQWowZ0VrblFFam5RRUVRQ09mQVVFUFNDUFRBU1BUQVJzRVFDT2ZBVUVCYWlTZkFRVWowd0ZGSWdBRVFDT2ZBVUVBU2lFQUN5QUFCRUFqbndGQkFXc2tud0VMQ3dzTEMxc0JBWDhqcHdGQkFXc2twd0VqcHdGQkFFd0VRQ1BVQVNTbkFTT25BUVJBSTZrQlFROUlJOVVCSTlVQkd3UkFJNmtCUVFGcUpLa0JCU1BWQVVVaUFBUkFJNmtCUVFCS0lRQUxJQUFFUUNPcEFVRUJheVNwQVFzTEN3c0xXd0VCZnlPeUFVRUJheVN5QVNPeUFVRUFUQVJBSTlZQkpMSUJJN0lCQkVBanRBRkJEMGdqMXdFajF3RWJCRUFqdEFGQkFXb2t0QUVGSTljQlJTSUFCRUFqdEFGQkFFb2hBQXNnQUFSQUk3UUJRUUZySkxRQkN3c0xDd3VPQmdBalp5QUFhaVJuSTJjalBnUi9RWUNBQVFWQmdNQUFDMDRFUUNObkl6NEVmMEdBZ0FFRlFZREFBQXRySkdjQ1FBSkFBa0FDUUFKQUkya2lBQVJBSUFCQkFtc09CZ0VGQWdVREJBVUxJNTRCUVFCS0lnQUVmeVBJQVFVZ0FBc0VRQ09lQVVFQmF5U2VBUXNqbmdGRkJFQkJBQ1NiQVFzanFBRkJBRW9pQUFSL0k4a0JCU0FBQ3dSQUk2Z0JRUUZySktnQkN5T29BVVVFUUVFQUpLVUJDeU91QVVFQVNpSUFCSDhqeWdFRklBQUxCRUFqcmdGQkFXc2tyZ0VMSTY0QlJRUkFRUUFrckFFTEk3TUJRUUJLSWdBRWZ5UExBUVVnQUFzRVFDT3pBVUVCYXlTekFRc2pzd0ZGQkVCQkFDU3dBUXNNQkFzam5nRkJBRW9pQUFSL0k4Z0JCU0FBQ3dSQUk1NEJRUUZySko0QkN5T2VBVVVFUUVFQUpKc0JDeU9vQVVFQVNpSUFCSDhqeVFFRklBQUxCRUFqcUFGQkFXc2txQUVMSTZnQlJRUkFRUUFrcFFFTEk2NEJRUUJLSWdBRWZ5UEtBUVVnQUFzRVFDT3VBVUVCYXlTdUFRc2pyZ0ZGQkVCQkFDU3NBUXNqc3dGQkFFb2lBQVIvSThzQkJTQUFDd1JBSTdNQlFRRnJKTE1CQ3lPekFVVUVRRUVBSkxBQkN4QStEQU1MSTU0QlFRQktJZ0FFZnlQSUFRVWdBQXNFUUNPZUFVRUJheVNlQVFzam5nRkZCRUJCQUNTYkFRc2pxQUZCQUVvaUFBUi9JOGtCQlNBQUN3UkFJNmdCUVFGckpLZ0JDeU9vQVVVRVFFRUFKS1VCQ3lPdUFVRUFTaUlBQkg4anlnRUZJQUFMQkVBanJnRkJBV3NrcmdFTEk2NEJSUVJBUVFBa3JBRUxJN01CUVFCS0lnQUVmeVBMQVFVZ0FBc0VRQ096QVVFQmF5U3pBUXNqc3dGRkJFQkJBQ1N3QVFzTUFnc2puZ0ZCQUVvaUFBUi9JOGdCQlNBQUN3UkFJNTRCUVFGckpKNEJDeU9lQVVVRVFFRUFKSnNCQ3lPb0FVRUFTaUlBQkg4anlRRUZJQUFMQkVBanFBRkJBV3NrcUFFTEk2Z0JSUVJBUVFBa3BRRUxJNjRCUVFCS0lnQUVmeVBLQVFVZ0FBc0VRQ091QVVFQmF5U3VBUXNqcmdGRkJFQkJBQ1NzQVFzanN3RkJBRW9pQUFSL0k4c0JCU0FBQ3dSQUk3TUJRUUZySkxNQkN5T3pBVVVFUUVFQUpMQUJDeEErREFFTEVEOFFRQkJCQ3lOcFFRRnFKR2tqYVVFSVRnUkFRUUFrYVF0QkFROExRUUFMZ3dFQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBZ0FDSUJRUUpHRFFFZ0FVRURSZzBDSUFGQkJFWU5Bd3dFQ3lOd0k5a0JSd1JBSTlrQkpIQkJBUThMUVFBUEN5TnhJOW9CUndSQUk5b0JKSEZCQVE4TFFRQVBDeU55STlzQlJ3UkFJOXNCSkhKQkFROExRUUFQQ3lOekk5d0JSd1JBSTl3QkpITkJBUThMUVFBUEMwRUFDMVVBQWtBQ1FBSkFJQUJCQVVjRVFDQUFRUUpHRFFFZ0FFRURSZzBDREFNTFFRRWdBWFJCZ1FGeFFRQkhEd3RCQVNBQmRFR0hBWEZCQUVjUEMwRUJJQUYwUWY0QWNVRUFSdzhMUVFFZ0FYUkJBWEZCQUVjTGlnRUJBWDhqbkFFZ0FHc2tuQUVqbkFGQkFFd0VRQ09jQVNJQlFSOTFJUUJCZ0JBajBRRnJRUUowSkp3Qkl6NEVRQ09jQVVFQmRDU2NBUXNqbkFFZ0FDQUJhaUFBYzJza25BRWpvUUZCQVdva29RRWpvUUZCQ0U0RVFFRUFKS0VCQ3dzajJRRWptd0VpQUNBQUd3Ui9JNThCQlVFUER3c2o0QUVqb1FFUVJBUi9RUUVGUVg4TGJFRVBhZ3VLQVFFQmZ5T21BU0FBYXlTbUFTT21BVUVBVEFSQUk2WUJJZ0ZCSDNVaEFFR0FFQ1BoQVd0QkFuUWtwZ0VqUGdSQUk2WUJRUUYwSktZQkN5T21BU0FBSUFGcUlBQnpheVNtQVNPckFVRUJhaVNyQVNPckFVRUlUZ1JBUVFBa3F3RUxDeVBhQVNPbEFTSUFJQUFiQkg4anFRRUZRUThQQ3lQaUFTT3JBUkJFQkg5QkFRVkJmd3RzUVE5cUM1a0NBUUovSTYwQklBQnJKSzBCSTYwQlFRQk1CRUFqclFFaUFrRWZkU0VBUVlBUUkrTUJhMEVCZENTdEFTTStCRUFqclFGQkFYUWtyUUVMSTYwQklBQWdBbW9nQUhOckpLMEJJNjhCUVFGcUpLOEJJNjhCUVNCT0JFQkJBQ1N2QVFzTFFRQWhBaVBrQVNFQUk5c0JJNndCSWdFZ0FSc0VRQ05yQkVCQm5QNERFQUZCQlhWQkQzRWlBQ1RrQVVFQUpHc0xCVUVQRHdzanJ3RkJBbTFCc1A0RGFoQUJJUUVqcndGQkFtOEVmeUFCUVE5eEJTQUJRUVIxUVE5eEN5RUJBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BU0FBUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEFnd0NDeUFCUVFGMUlRRkJBaUVDREFFTElBRkJBblVoQVVFRUlRSUxJQUpCQUVvRWZ5QUJJQUp0QlVFQUMwRVBhZ3VyQVFFQmZ5T3hBU0FBYXlTeEFTT3hBVUVBVEFSQUk3RUJJUUFqNVFFajVnRjBJZ0ZCQVhRZ0FTTStHeVN4QVNPeEFTQUFRUjkxSWdFZ0FDQUJhbk5ySkxFQkk3VUJJZ0JCQVhFaEFTQUFRUUYxSWdBa3RRRWp0UUVnQVNBQVFRRnhjeUlCUVE1MGNpUzFBU1BuQVFSQUk3VUJRYjkvY1NTMUFTTzFBU0FCUVFaMGNpUzFBUXNMSTl3Qkk3QUJJZ0FnQUJzRWZ5TzBBUVZCRHc4TFFYOUJBU08xQVVFQmNSdHNRUTlxQ3pBQUlBQkJQRVlFUUVIL0FBOExJQUJCUEd0Qm9JMEdiQ0FCYkVFSWJVR2dqUVp0UVR4cVFhQ05CbXhCalBFQ2JRdWNBUUVCZjBFQUpIWWdBRUVQSTE0YklnUWdBV29nQkVFUGFpTmZHeUlFSUFKcUlBUkJEMm9qWUJzaEJDQURJQUlnQVNBQVFROGpZaHNpQUdvZ0FFRVBhaU5qR3lJQWFpQUFRUTlxSTJRYklnQnFJQUJCRDJvalpSc2hBRUVBSkhkQkFDUjRJQU1nQkdvZ0JFRVBhaU5oR3lOY1FRRnFFRWtoQVNBQUkxMUJBV29RU1NFQUlBRWtkQ0FBSkhVZ0FFSC9BWEVnQVVIL0FYRkJDSFJ5QzhNREFRVi9BbjhqMkFFZ0FHb2syQUZCQUNPY0FTUFlBV3RCQUVvTkFCcEJBUXNpQVVVRVFFRUJFRU1oQVFzQ2Z5UGRBU0FBYWlUZEFVRUFJNllCSTkwQmEwRUFTZzBBR2tFQkN5SUVSUVJBUVFJUVF5RUVDd0ovSTk0QklBQnFKTjRCSTYwQkk5NEJhMEVBU2lJQ0JFQWphMFVoQWd0QkFDQUNEUUFhUVFFTElnSkZCRUJCQXhCRElRSUxBbjhqM3dFZ0FHb2szd0ZCQUNPeEFTUGZBV3RCQUVvTkFCcEJBUXNpQlVVRVFFRUVFRU1oQlFzZ0FRUkFJOWdCSVFOQkFDVFlBU0FERUVVa2JBc2dCQVJBSTkwQklRTkJBQ1RkQVNBREVFWWtiUXNnQWdSQUk5NEJJUU5CQUNUZUFTQURFRWNrYmdzZ0JRUkFJOThCSVFOQkFDVGZBU0FERUVna2J3c0NmeUFCSUFRZ0FSc2lBVVVFUUNBQ0lRRUxJQUZGQ3dSQUlBVWhBUXNnQVFSQVFRRWtlQXNqYUNQb0FTQUFiR29rYUNOb1FZQ0FnQVJCZ0lDQUFpTStHMDRFUUNOb1FZQ0FnQVJCZ0lDQUFpTStHMnNrYUNONElnQWpkaUFBR3lJQlJRUkFJM2NoQVFzZ0FRUkFJMndqYlNOdUkyOFFTaG9MSTJvaUFVRUJkRUdBbWNFQWFpSUFJM1JCQW1vNkFBQWdBRUVCYWlOMVFRSnFPZ0FBSUFGQkFXb2thaU5xSStrQlFRSnRRUUZyVGdSQUkycEJBV3NrYWdzTEM1d0RBUVYvSUFBUVJTRUNJQUFRUmlFQklBQVFSeUVESUFBUVNDRUVJQUlrYkNBQkpHMGdBeVJ1SUFRa2J5Tm9JK2dCSUFCc2FpUm9JMmhCZ0lDQUJFR0FnSUFDSXo0YlRnUkFJMmhCZ0lDQUJFR0FnSUFDSXo0YmF5Um9JQUlnQVNBRElBUVFTaUVBSTJwQkFYUkJnSm5CQUdvaUJTQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0JVRUJhaUFBUWY4QmNVRUNham9BQUNNM0JFQWdBa0VQUVE5QkR4QktJUUFqYWtFQmRFR0FtU0ZxSWdJZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBRUgvQVhGQkFtbzZBQUJCRHlBQlFROUJEeEJLSVFBamFrRUJkRUdBbVNscUlnRWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBRkJBV29nQUVIL0FYRkJBbW82QUFCQkQwRVBJQU5CRHhCS0lRQWpha0VCZEVHQW1URnFJZ0VnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQUZCQVdvZ0FFSC9BWEZCQW1vNkFBQkJEMEVQUVE4Z0JCQktJUUFqYWtFQmRFR0FtVGxxSWdFZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFGQkFXb2dBRUgvQVhGQkFtbzZBQUFMSTJwQkFXb2thaU5xSStrQlFRSnRRUUZyVGdSQUkycEJBV3NrYWdzTEN4NEJBWDhnQUJCQ0lRRWdBVVVqTkNNMEd3UkFJQUFRU3dVZ0FCQk1Dd3RMQUNOYkl6NEVmMEd1QVFWQjF3QUxTQVJBRHdzRFFDTmJJejRFZjBHdUFRVkIxd0FMVGdSQUl6NEVmMEd1QVFWQjF3QUxFRTBqV3lNK0JIOUJyZ0VGUWRjQUMyc2tXd3dCQ3dzTElRQWdBRUdtL2dOR0JFQkJwdjRERUFGQmdBRnhJUUFnQUVId0FISVBDMEYvQzV3QkFRRi9JNzRCSVFBanZ3RUVRQ0FBUVh0eElBQkJCSElqNmdFYklRQWdBRUYrY1NBQVFRRnlJK3NCR3lFQUlBQkJkM0VnQUVFSWNpUHNBUnNoQUNBQVFYMXhJQUJCQW5JajdRRWJJUUFGSThBQkJFQWdBRUYrY1NBQVFRRnlJKzRCR3lFQUlBQkJmWEVnQUVFQ2NpUHZBUnNoQUNBQVFYdHhJQUJCQkhJajhBRWJJUUFnQUVGM2NTQUFRUWh5SS9FQkd5RUFDd3NnQUVId0FYSUx6d0lCQVg4Z0FFR0FnQUpJQkVCQmZ3OExJQUJCZ0lBQ1RpSUJCSDhnQUVHQXdBSklCU0FCQ3dSQVFYOFBDeUFBUVlEQUEwNGlBUVIvSUFCQmdQd0RTQVVnQVFzRVFDQUFRWUJBYWhBQkR3c2dBRUdBL0FOT0lnRUVmeUFBUVovOUEwd0ZJQUVMQkVBam1BRkJBa2dFUUVIL0FROExRWDhQQ3lBQVFjMytBMFlFUUVIL0FTRUJRYzMrQXhBQlFRRnhSUVJBUWY0QklRRUxJejVGQkVBZ0FVSC9mbkVoQVFzZ0FROExJQUJCeFA0RFJnUkFJQUFqVmhBRUkxWVBDeUFBUVpEK0EwNGlBUVIvSUFCQnB2NERUQVVnQVFzRVFCQk9JQUFRVHc4TElBQkJzUDREVGlJQkJIOGdBRUcvL2dOTUJTQUJDd1JBRUU1QmZ3OExJQUJCaFA0RFJnUkFJQUFqaGdGQmdQNERjVUVJZFNJQkVBUWdBUThMSUFCQmhmNERSZ1JBSUFBamh3RVFCQ09IQVE4TElBQkJqLzREUmdSQUk0UUJRZUFCY2c4TElBQkJnUDREUmdSQUVGQVBDMEYvQ3hzQkFYOGdBQkJSSWdGQmYwWUVRQ0FBRUFFUEN5QUJRZjhCY1F1MkFnRUJmeU5RQkVBUEN5QUFRZjgvVEFSQUkxSUVmeUFCUVJCeFJRVWpVZ3RGQkVBZ0FVRVBjU0lDQkVBZ0FrRUtSZ1JBUVFFa1Rnc0ZRUUFrVGdzTEJTQUFRZi8vQUV3RVFDTTVSU0lDQkg4Z0FnVWdBRUgvM3dCTUN3UkFJMUlFUUNBQlFROXhKRGdMSUFFaEFpTlJCRUFnQWtFZmNTRUNJemhCNEFGeEpEZ0ZJMU1FUUNBQ1FmOEFjU0VDSXpoQmdBRnhKRGdGSXprRVFFRUFKRGdMQ3dzak9DQUNjaVE0QlNNNFFmOEJjVUVCUVFBZ0FVRUFTaHRCL3dGeFFRaDBjaVE0Q3dValVrVWlBZ1IvSUFCQi83OEJUQVVnQWdzRVFDTlBJMUVpQUNBQUd3UkFJemhCSDNFa09DTTRJQUZCNEFGeGNpUTREd3NnQVVFUGNTQUJRUU54SXprYkpEd0ZJMUpGSWdJRWZ5QUFRZi8vQVV3RklBSUxCRUFqVVFSQUlBRkJBWEVFUUVFQkpFOEZRUUFrVHdzTEN3c0xDd3NzQUNBQVFRUjFRUTl4SlBZQklBQkJDSEZCQUVjazB3RWdBRUVIY1NUU0FTQUFRZmdCY1VFQVNpVFpBUXNzQUNBQVFRUjFRUTl4SlBjQklBQkJDSEZCQUVjazFRRWdBRUVIY1NUVUFTQUFRZmdCY1VFQVNpVGFBUXNzQUNBQVFRUjFRUTl4SlBrQklBQkJDSEZCQUVjazF3RWdBRUVIY1NUV0FTQUFRZmdCY1VFQVNpVGNBUXVCQVFFQmZ5QUFRUVIxSk9ZQklBQkJDSEZCQUVjazV3RWdBRUVIY1NUK0FRSkFBa0FDUUFKQUFrQUNRQUpBQWtBai9nRWlBUVJBSUFGQkFXc09Cd0VDQXdRRkJnY0lDMEVJSk9VQkR3dEJFQ1RsQVE4TFFTQWs1UUVQQzBFd0pPVUJEd3RCd0FBazVRRVBDMEhRQUNUbEFROExRZUFBSk9VQkR3dEI4QUFrNVFFTEM0TUJBUUYvUVFFa213RWpuZ0ZGQkVCQndBQWtuZ0VMUVlBUUk5RUJhMEVDZENTY0FTTStCRUFqbkFGQkFYUWtuQUVMSTlJQkpKMEJJL1lCSko4Qkk5RUJKS1FCSTh3QklnQWtvd0VnQUVFQVNpSUFCSDhqelFGQkFFb0ZJQUFMQkVCQkFTU2lBUVZCQUNTaUFRc2p6UUZCQUVvRVFCQTlDeVBaQVVVRVFFRUFKSnNCQ3d0SEFFRUJKS1VCSTZnQlJRUkFRY0FBSktnQkMwR0FFQ1BoQVd0QkFuUWtwZ0VqUGdSQUk2WUJRUUYwSktZQkN5UFVBU1NuQVNQM0FTU3BBU1BhQVVVRVFFRUFKS1VCQ3d0QUFFRUJKS3dCSTY0QlJRUkFRWUFDSks0QkMwR0FFQ1BqQVd0QkFYUWtyUUVqUGdSQUk2MEJRUUYwSkswQkMwRUFKSzhCSTlzQlJRUkFRUUFrckFFTEMwa0JBWDlCQVNTd0FTT3pBVVVFUUVIQUFDU3pBUXNqNVFFajVnRjBJZ0JCQVhRZ0FDTStHeVN4QVNQV0FTU3lBU1A1QVNTMEFVSC8vd0VrdFFFajNBRkZCRUJCQUNTd0FRc0xWQUFnQUVHQUFYRkJBRWNrWVNBQVFjQUFjVUVBUnlSZ0lBQkJJSEZCQUVja1h5QUFRUkJ4UVFCSEpGNGdBRUVJY1VFQVJ5UmxJQUJCQkhGQkFFY2taQ0FBUVFKeFFRQkhKR01nQUVFQmNVRUFSeVJpQzRnRkFRRi9JQUJCcHY0RFJ5SUNCRUFqWmtVaEFnc2dBZ1JBUVFBUEN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBa0dRL2dOSEJFQWdBa0dSL2dOckRoWUNCZ29PRlFNSEN3OEJCQWdNRUJVRkNRMFJFaE1VRlFzZ0FVSHdBSEZCQkhVa3pBRWdBVUVJY1VFQVJ5VE9BU0FCUVFkeEpNMEJEQlVMSUFGQmdBRnhRUUJISk5zQkRCUUxJQUZCQm5WQkEzRWs0QUVnQVVFL2NTVHlBVUhBQUNQeUFXc2tuZ0VNRXdzZ0FVRUdkVUVEY1NUaUFTQUJRVDl4SlBNQlFjQUFJL01CYXlTb0FRd1NDeUFCSlBRQlFZQUNJL1FCYXlTdUFRd1JDeUFCUVQ5eEpQVUJRY0FBSS9VQmF5U3pBUXdRQ3lBQkVGUU1Ed3NnQVJCVkRBNExRUUVrYXlBQlFRVjFRUTl4SlBnQkRBMExJQUVRVmd3TUN5QUJKTThCSTg4Qkk5QUJRUWgwY2lUUkFRd0xDeUFCSlBvQkkvb0JJL3NCUVFoMGNpVGhBUXdLQ3lBQkpQd0JJL3dCSS8wQlFRaDBjaVRqQVF3SkN5QUJFRmNNQ0FzZ0FVR0FBWEVFUUNBQlFjQUFjVUVBUnlUSUFTQUJRUWR4Sk5BQkk4OEJJOUFCUVFoMGNpVFJBUkJZQ3d3SEN5QUJRWUFCY1FSQUlBRkJ3QUJ4UVFCSEpNa0JJQUZCQjNFayt3RWorZ0VqK3dGQkNIUnlKT0VCRUZrTERBWUxJQUZCZ0FGeEJFQWdBVUhBQUhGQkFFY2t5Z0VnQVVFSGNTVDlBU1A4QVNQOUFVRUlkSElrNHdFUVdnc01CUXNnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVRMQVJCYkN3d0VDeUFCUVFSMVFRZHhKRndnQVVFSGNTUmRRUUVrZGd3REN5QUJFRnhCQVNSM0RBSUxJQUZCZ0FGeFFRQkhKR1lnQVVHQUFYRkZCRUFDUUVHUS9nTWhBZ05BSUFKQnB2NERUZzBCSUFKQkFCQUVJQUpCQVdvaEFnd0FBQXNBQ3dzTUFRdEJBUThMUVFFTFBBRUJmeUFBUVFoMElRRkJBQ0VBQTBBQ1FDQUFRWjhCU2cwQUlBQkJnUHdEYWlBQUlBRnFFQUVRQkNBQVFRRnFJUUFNQVFzTFFZUUZKTUVCQ3lNQkFYOGpnUUlRQVNFQUk0SUNFQUZCL3dGeElBQkIvd0Z4UVFoMGNrSHcvd054Q3ljQkFYOGpnd0lRQVNFQUk0UUNFQUZCL3dGeElBQkIvd0Z4UVFoMGNrSHdQM0ZCZ0lBQ2FndURBUUVEZnlNNlJRUkFEd3NnQUVHQUFYRkZJOFFCSThRQkd3UkFRUUFreEFFamdBSVFBVUdBQVhJaEFDT0FBaUFBRUFRUEN4QmZJUUVRWUNFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSk1RQklBTWt4UUVnQVNUR0FTQUNKTWNCSTRBQ0lBQkIvMzV4RUFRRklBRWdBaUFERUdzamdBSkIvd0VRQkFzTFlnRURmeU9IQWlBQVJpSUNSUVJBSTRZQ0lBQkdJUUlMSUFJRVFDQUFRUUZySWdNUUFVRy9mM0VpQWtFL2NTSUVRVUJySUFSQkFVRUFJNFlDSUFCR0d4dEJnSkFFYWlBQk9nQUFJQUpCZ0FGeEJFQWdBeUFDUVFGcVFZQUJjaEFFQ3dzTFBBRUJmd0pBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVNBQlFRSkdEUUlnQVVFRFJnMEREQVFMUVFrUEMwRUREd3RCQlE4TFFRY1BDMEVBQ3kwQkFYOUJBU09LQVJCaklnSjBJQUJ4UVFCSElnQUVmMEVCSUFKMElBRnhSUVVnQUFzRVFFRUJEd3RCQUF1UkFRRUNmd05BSUFFZ0FFZ0VRQ0FCUVFScUlRRWpoZ0VpQWtFRWFpU0dBU09HQVVILy93TktCRUFqaGdGQmdJQUVheVNHQVFzamlRRUVRQ09MQVFSQUk0Z0JKSWNCUVFFa2dRRkJBaEE2UVFBa2l3RkJBU1NNQVFVampBRUVRRUVBSkl3QkN3c2dBaU9HQVJCa0JFQWpod0ZCQVdva2h3RWpod0ZCL3dGS0JFQkJBU1NMQVVFQUpJY0JDd3NMREFFTEN3c01BQ09GQVJCbFFRQWtoUUVMUndFQmZ5T0dBU0VBUVFBa2hnRkJoUDREUVFBUUJDT0pBUVIvSUFBamhnRVFaQVVqaVFFTEJFQWpod0ZCQVdva2h3RWpod0ZCL3dGS0JFQkJBU1NMQVVFQUpJY0JDd3NMZ0FFQkFuOGppUUVoQVNBQVFRUnhRUUJISklrQklBQkJBM0VoQWlBQlJRUkFJNG9CRUdNaEFDQUNFR01oQVNPSkFRUi9JNFlCUVFFZ0FIUnhCU09HQVVFQklBQjBjVUVBUnlJQUJIOGpoZ0ZCQVNBQmRIRUZJQUFMQ3dSQUk0Y0JRUUZxSkljQkk0Y0JRZjhCU2dSQVFRRWtpd0ZCQUNTSEFRc0xDeUFDSklvQkM5SUdBUUYvQWtBQ1FDQUFRYzMrQTBZRVFFSE4vZ01nQVVFQmNSQUVEQUVMSUFCQmdJQUNTQVJBSUFBZ0FSQlREQUVMSUFCQmdJQUNUaUlDQkVBZ0FFR0F3QUpJSVFJTElBSU5BU0FBUVlEQUEwNGlBZ1JBSUFCQmdQd0RTQ0VDQ3lBQ0JFQWdBRUdBUUdvZ0FSQUVEQUlMSUFCQmdQd0RUaUlDQkVBZ0FFR2YvUU5NSVFJTElBSUVRQ09ZQVVFQ1NBMEJEQUlMSUFCQm9QMERUaUlDQkVBZ0FFSC8vUU5NSVFJTElBSU5BQ0FBUVlMK0EwWUVRQ0FCUVFGeFFRQkhKSThCSUFGQkFuRkJBRWNra0FFZ0FVR0FBWEZCQUVja2tRRkJBUThMSUFCQmtQNERUaUlDQkVBZ0FFR20vZ05NSVFJTElBSUVRQkJPSUFBZ0FSQmREd3NnQUVHdy9nTk9JZ0lFUUNBQVFiLytBMHdoQWdzZ0FnUkFFRTRMSUFCQndQNERUaUlDQkVBZ0FFSEwvZ05NSVFJTElBSUVRQ0FBUWNEK0EwWUVRQ0FCRUI0TUF3c2dBRUhCL2dOR0JFQkJ3ZjRESUFGQitBRnhRY0grQXhBQlFRZHhja0dBQVhJUUJBd0NDeUFBUWNUK0EwWUVRRUVBSkZZZ0FFRUFFQVFNQWdzZ0FFSEYvZ05HQkVBZ0FTVC9BUXdEQ3lBQVFjYitBMFlFUUNBQkVGNE1Bd3NDUUFKQUFrQUNRQ0FBSWdKQncvNERSd1JBSUFKQnd2NERhdzRLQVFRRUJBUUVCQVFEQWdRTElBRWtWd3dHQ3lBQkpGZ01CUXNnQVNSWkRBUUxJQUVrV2d3REN3d0NDeU9BQWlBQVJnUkFJQUVRWVF3QkN5TTlJQUJHSWdKRkJFQWpPeUFBUmlFQ0N5QUNCRUFqeEFFRVFBSi9JOFlCUVlDQUFVNGlBZ1JBSThZQlFmLy9BVXdoQWdzZ0FrVUxCRUFqeGdGQmdLQURUaUlDQkVBanhnRkIvNzhEVENFQ0N3c2dBZzBDQ3dzZ0FDT0ZBazRpQWdSQUlBQWpoZ0pNSVFJTElBSUVRQ0FBSUFFUVlnd0NDeUFBUVlUK0EwNGlBZ1JBSUFCQmgvNERUQ0VDQ3lBQ0JFQVFaZ0pBQWtBQ1FBSkFJQUFpQWtHRS9nTkhCRUFnQWtHRi9nTnJEZ01CQWdNRUN4Qm5EQVVMQWtBamlRRUVRQ09NQVEwQkk0c0JCRUJCQUNTTEFRc0xJQUVraHdFTERBVUxJQUVraUFFampBRWppUUVpQUNBQUd3UkFJNGdCSkljQlFRQWtqQUVMREFRTElBRVFhQXdEQ3d3Q0N5QUFRWUQrQTBZRVFDQUJRZjhCY3lTK0FTTytBU0lDUVJCeFFRQkhKTDhCSUFKQklIRkJBRWNrd0FFTElBQkJqLzREUmdSQUlBRVFEd3dDQ3lBQVFmLy9BMFlFUUNBQkVBNE1BZ3RCQVE4TFFRQVBDMEVCQ3hFQUlBQWdBUkJwQkVBZ0FDQUJFQVFMQzJBQkEzOERRQUpBSUFNZ0FrNE5BQ0FBSUFOcUVGSWhCU0FCSUFOcUlRUURRQ0FFUWYrL0Frb0VRQ0FFUVlCQWFpRUVEQUVMQ3lBRUlBVVFhaUFEUVFGcUlRTU1BUXNMUVNBaEF5UEJBU0FDUVJCdFFjQUFRU0FqUGh0c2FpVEJBUXRuQVFGL0k4UUJSUVJBRHdzanhnRWp4d0VqeFFFaUFFRVFJQUJCRUVnYklnQVFheVBHQVNBQWFpVEdBU1BIQVNBQWFpVEhBU1BGQVNBQWF5VEZBU1BGQVVFQVRBUkFRUUFreEFFamdBSkIvd0VRQkFVamdBSWp4UUZCRUcxQkFXdEIvMzV4RUFRTEMwWUJBbjhqL3dFaEF3Si9JQUJGSWdKRkJFQWdBRUVCUmlFQ0N5QUNDd1IvSTFZZ0EwWUZJQUlMQkVBZ0FVRUVjaUlCUWNBQWNRUkFFRHNMQlNBQlFYdHhJUUVMSUFFTGdnSUJBMzhqdGdGRkJFQVBDeU9ZQVNFQUlBQWpWaUlDUVpBQlRnUi9RUUVGSTFValBnUi9RZkFGQlVINEFndE9CSDlCQWdWQkEwRUFJMVVqUGdSL1FmSURCVUg1QVF0T0d3c0xJZ0ZIQkVCQndmNERFQUVoQUNBQkpKZ0JRUUFoQWdKQUFrQUNRQUpBSUFFRVFDQUJRUUZyRGdNQkFnTUVDeUFBUVh4eElnQkJDSEZCQUVjaEFnd0RDeUFBUVgxeFFRRnlJZ0JCRUhGQkFFY2hBZ3dDQ3lBQVFYNXhRUUp5SWdCQklIRkJBRWNoQWd3QkN5QUFRUU55SVFBTElBSUVRQkE3Q3lBQlJRUkFFR3dMSUFGQkFVWUVRRUVCSkg5QkFCQTZDMEhCL2dNZ0FTQUFFRzBRQkFVZ0FrR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUFSQnRFQVFMQ3d1MEFRQWp0Z0VFUUNOVklBQnFKRlVEUUNOVkFuOGpQZ1JBUVFnalZrR1pBVVlOQVJwQmtBY01BUXRCQkNOV1Faa0JSZzBBR2tISUF3dE9CRUFqVlFKL0l6NEVRRUVJSTFaQm1RRkdEUUVhUVpBSERBRUxRUVFqVmtHWkFVWU5BQnBCeUFNTGF5UlZJMVlpQUVHUUFVWUVRQ016QkVBUU9BVWdBQkEzQ3hBNVFYOGt3Z0ZCZnlUREFRVWdBRUdRQVVnRVFDTXpSUVJBSUFBUU53c0xDMEVBSUFCQkFXb2dBRUdaQVVvYkpGWU1BUXNMQ3hCdUM3TUJBQ05VQW44alBnUkFRUWdqVmtHWkFVWU5BUnBCa0FjTUFRdEJCQ05XUVprQlJnMEFHa0hJQXd0SUJFQVBDd05BSTFRQ2Z5TStCRUJCQ0NOV1Faa0JSZzBCR2tHUUJ3d0JDMEVFSTFaQm1RRkdEUUFhUWNnREMwNEVRQUovSXo0RVFFRUlJMVpCbVFGR0RRRWFRWkFIREFFTFFRUWpWa0daQVVZTkFCcEJ5QU1MRUc4alZBSi9JejRFUUVFSUkxWkJtUUZHRFFFYVFaQUhEQUVMUVFRalZrR1pBVVlOQUJwQnlBTUxheVJVREFFTEN3c3pBUUYvUVFFamtBRUVmMEVDQlVFSEN5SUNkQ0FBY1VFQVJ5SUFCSDlCQVNBQ2RDQUJjVVVGSUFBTEJFQkJBUThMUVFBTGxnRUJBbjhqa1FGRkJFQVBDd05BSUFFZ0FFZ0VRQ0FCUVFScUlRRWpqUUVpQWtFRWFpU05BU09OQVVILy93TktCRUFqalFGQmdJQUVheVNOQVFzZ0FpT05BUkJ4QkVCQmdmNERRWUgrQXhBQlFRRjBRUUZxUWY4QmNSQUVJNDRCUVFGcUpJNEJJNDRCUVFoR0JFQkJBQ1NPQVVFQkpJSUJRUU1RT2tHQy9nTkJndjRERUFGQi8zNXhFQVJCQUNTUkFRc0xEQUVMQ3d1SUFRQWp3UUZCQUVvRVFDUEJBU0FBYWlFQVFRQWt3UUVMSTBrZ0FHb2tTU05OUlFSQUl6RUVRQ05VSUFCcUpGUVFjQVVnQUJCdkN5TXdCRUFqV3lBQWFpUmJCU0FBRUUwTElBQVFjZ3NqTWdSQUk0VUJJQUJxSklVQkVHWUZJQUFRWlFzamxBRWdBR29rbEFFamxBRWprZ0ZPQkVBamt3RkJBV29ra3dFamxBRWprZ0ZySkpRQkN3c0tBRUVFRUhNalNCQUJDeVlCQVg5QkJCQnpJMGhCQVdwQi8vOERjUkFCSVFBUWRFSC9BWEVnQUVIL0FYRkJDSFJ5Q3d3QVFRUVFjeUFBSUFFUWFnc3dBUUYvUVFFZ0FIUkIvd0Z4SVFJZ0FVRUFTZ1JBSTBZZ0FuSkIvd0Z4SkVZRkkwWWdBa0gvQVhOeEpFWUxJMFlMQ1FCQkJTQUFFSGNhQzBrQkFYOGdBVUVBVGdSQUlBQkJEM0VnQVVFUGNXcEJFSEVFUUVFQkVIZ0ZRUUFRZUFzRklBRkJIM1VpQWlBQklBSnFjMEVQY1NBQVFROXhTd1JBUVFFUWVBVkJBQkI0Q3dzTENRQkJCeUFBRUhjYUN3a0FRUVlnQUJCM0dnc0pBRUVFSUFBUWR4b0xPd0VDZnlBQlFZRCtBM0ZCQ0hVaEFpQUFRUUZxSVFNZ0FDQUJRZjhCY1NJQkVHa0VRQ0FBSUFFUUJBc2dBeUFDRUdrRVFDQURJQUlRQkFzTERBQkJDQkJ6SUFBZ0FSQjlDM1VBSUFJRVFDQUJJQUJCLy84RGNTSUFhaUFBSUFGemN5SUNRUkJ4QkVCQkFSQjRCVUVBRUhnTElBSkJnQUp4QkVCQkFSQjhCVUVBRUh3TEJTQUFJQUZxUWYvL0EzRWlBaUFBUWYvL0EzRkpCRUJCQVJCOEJVRUFFSHdMSUFBZ0FYTWdBbk5CZ0NCeEJFQkJBUkI0QlVFQUVIZ0xDd3NLQUVFRUVITWdBQkJTQzVFRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQUVRQ0FBUVFGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN3d1RDeEIxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRUFnQUVIL0FYRWtRUXdQQ3lOQlFmOEJjU05BUWY4QmNVRUlkSElqUHhCMkRCRUxJMEZCL3dGeEkwQkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkFEQkVMSTBCQkFSQjVJMEJCQVdwQi93RnhKRUFqUUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHNNRHdzalFFRi9FSGtqUUVFQmEwSC9BWEVrUUNOQUJFQkJBQkI2QlVFQkVIb0xRUUVRZXd3T0N4QjBRZjhCY1NSQURBc0xJejlCZ0FGeFFZQUJSZ1JBUVFFUWZBVkJBQkI4Q3lNL0lnQkJBWFFnQUVIL0FYRkJCM1p5UWY4QmNTUS9EQXNMRUhWQi8vOERjU05IRUg0TUNBc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnQWpRVUgvQVhFalFFSC9BWEZCQ0hSeUlnRkJBQkIvSUFBZ0FXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1JDQUFRZjhCY1NSRlFRQVFlMEVJRHdzalFVSC9BWEVqUUVIL0FYRkJDSFJ5RUlBQlFmOEJjU1EvREFrTEkwRkIvd0Z4STBCQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNSQURBa0xJMEZCQVJCNUkwRkJBV3BCL3dGeEpFRWpRUVJBUVFBUWVnVkJBUkI2QzBFQUVIc01Cd3NqUVVGL0VIa2pRVUVCYTBIL0FYRWtRU05CQkVCQkFCQjZCVUVCRUhvTFFRRVFld3dHQ3hCMFFmOEJjU1JCREFNTEl6OUJBWEZCQUVzRVFFRUJFSHdGUVFBUWZBc2pQeUlBUVFkMElBQkIvd0Z4UVFGMmNrSC9BWEVrUHd3REMwRi9Ed3NqU0VFQ2FrSC8vd054SkVnTUFnc2pTRUVCYWtILy93TnhKRWdNQVF0QkFCQjZRUUFRZTBFQUVIZ0xRUVFQQ3lBQVFmOEJjU1JCUVFnTEtBRUJmeUFBUVJoMFFSaDFJZ0ZCZ0FGeEJFQkJnQUlnQUVFWWRFRVlkV3RCZjJ3aEFRc2dBUXNwQVFGL0lBQVFnZ0VoQVNOSUlBRkJHSFJCR0hWcVFmLy9BM0VrU0NOSVFRRnFRZi8vQTNFa1NBdllCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVRUndSQUlBQkJFV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSXpvRVFFSE4vZ01RZ0FGQi93RnhJZ0JCQVhFRVFFSE4vZ01nQUVGK2NTSUFRWUFCY1FSL1FRQWtQaUFBUWY5K2NRVkJBU1ErSUFCQmdBRnlDeEIyUWNRQUR3c0xRUUVrVFF3UUN4QjFRZi8vQTNFaUFFR0EvZ054UVFoMUpFSWdBRUgvQVhFa1F5TklRUUpxUWYvL0EzRWtTQXdSQ3lORFFmOEJjU05DUWY4QmNVRUlkSElqUHhCMkRCQUxJME5CL3dGeEkwSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkNEQkFMSTBKQkFSQjVJMEpCQVdwQi93RnhKRUlqUWdSQVFRQVFlZ1ZCQVJCNkMwRUFFSHNNRGdzalFrRi9FSGtqUWtFQmEwSC9BWEVrUWlOQ0JFQkJBQkI2QlVFQkVIb0xRUUVRZXd3TkN4QjBRZjhCY1NSQ0RBb0xRUUZCQUNNL0lnRkJnQUZ4UVlBQlJoc2hBQ05HUVFSMlFRRnhJQUZCQVhSeVFmOEJjU1EvREFvTEVIUVFnd0ZCQ0E4TEkwVkIvd0Z4STBSQi93RnhRUWgwY2lJQUkwTkIvd0Z4STBKQi93RnhRUWgwY2lJQlFRQVFmeUFBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFQUVIdEJDQThMSTBOQi93RnhJMEpCL3dGeFFRaDBjaENBQVVIL0FYRWtQd3dJQ3lORFFmOEJjU05DUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVrUWd3SUN5TkRRUUVRZVNORFFRRnFRZjhCY1NSREkwTUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBWUxJME5CZnhCNUkwTkJBV3RCL3dGeEpFTWpRd1JBUVFBUWVnVkJBUkI2QzBFQkVIc01CUXNRZEVIL0FYRWtRd3dDQzBFQlFRQWpQeUlCUVFGeFFRRkdHeUVBSTBaQkJIWkJBWEZCQjNRZ0FVSC9BWEZCQVhaeUpEOE1BZ3RCZnc4TEkwaEJBV3BCLy84RGNTUklEQUVMSUFBRVFFRUJFSHdGUVFBUWZBdEJBQkI2UVFBUWUwRUFFSGdMUVFRUEN5QUFRZjhCY1NSRFFRZ0x1QVlCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRWdSd1JBSUFCQklXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJMFpCQjNaQkFYRUVRQ05JUVFGcVFmLy9BM0VrU0FVUWRCQ0RBUXRCQ0E4TEVIVkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1JDQUFRZjhCY1NSRkkwaEJBbXBCLy84RGNTUklEQkFMSTBWQi93RnhJMFJCL3dGeFFRaDBjaUlBSXo4UWRpQUFRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSUXdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrUkNBQVFmOEJjU1JGUVFnUEN5TkVRUUVRZVNORVFRRnFRZjhCY1NSRUkwUUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBMExJMFJCZnhCNUkwUkJBV3RCL3dGeEpFUWpSQVJBUVFBUWVnVkJBUkI2QzBFQkVIc01EQXNRZEVIL0FYRWtSQXdLQzBFR1FRQWpSa0VGZGtFQmNVRUFTeHNoQVNBQlFlQUFjaUFCSTBaQkJIWkJBWEZCQUVzYklRRWpSa0VHZGtFQmNVRUFTd1IvSXo4Z0FXdEIvd0Z4QlNBQlFRWnlJQUVqUHlJQVFROXhRUWxMR3lJQlFlQUFjaUFCSUFCQm1RRkxHeUlCSUFCcVFmOEJjUXNpQUFSQVFRQVFlZ1ZCQVJCNkN5QUJRZUFBY1FSQVFRRVFmQVZCQUJCOEMwRUFFSGdnQUNRL0RBb0xJMFpCQjNaQkFYRkJBRXNFUUJCMEVJTUJCU05JUVFGcVFmLy9BM0VrU0F0QkNBOExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUJJQUZCLy84RGNVRUFFSDhnQVVFQmRFSC8vd054SWdGQmdQNERjVUVJZFNSRUlBRkIvd0Z4SkVWQkFCQjdRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQVJDQUFVSC9BWEVrUHlBQlFRRnFRZi8vQTNFaUFVR0EvZ054UVFoMUpFUWdBVUgvQVhFa1JRd0hDeU5GUWY4QmNTTkVRZjhCY1VFSWRISkJBV3RCLy84RGNTSUJRWUQrQTNGQkNIVWtSQ0FCUWY4QmNTUkZRUWdQQ3lORlFRRVFlU05GUVFGcVFmOEJjU1JGSTBVRVFFRUFFSG9GUVFFUWVndEJBQkI3REFVTEkwVkJmeEI1STBWQkFXdEIvd0Z4SkVValJRUkFRUUFRZWdWQkFSQjZDMEVCRUhzTUJBc1FkRUgvQVhFa1JRd0NDeU0vUVg5elFmOEJjU1EvUVFFUWUwRUJFSGdNQWd0QmZ3OExJMGhCQVdwQi8vOERjU1JJQzBFRUM1UUZBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBZ0FFRXhhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqUmtFRWRrRUJjUVJBSTBoQkFXcEIvLzhEY1NSSUJSQjBFSU1CQzBFSUR3c1FkVUgvL3dOeEpFY2pTRUVDYWtILy93TnhKRWdNRWdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdBalB4QjJEQTRMSTBkQkFXcEIvLzhEY1NSSFFRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBQkNBQVNJQlFRRVFlU0FCUVFGcVFmOEJjU0lCQkVCQkFCQjZCVUVCRUhvTFFRQVFld3dOQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUJDQUFTSUJRWDhRZVNBQlFRRnJRZjhCY1NJQkJFQkJBQkI2QlVFQkVIb0xRUUVRZXd3TUN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWRFSC9BWEVRZGd3TUMwRUFFSHRCQUJCNFFRRVFmQXdNQ3lOR1FRUjJRUUZ4UVFGR0JFQVFkQkNEQVFValNFRUJha0gvL3dOeEpFZ0xRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQVNOSFFRQVFmeU5ISUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFQUVIdEJDQThMSTBWQi93RnhJMFJCL3dGeFFRaDBjaUlBRUlBQlFmOEJjU1EvREFZTEkwZEJBV3RCLy84RGNTUkhRUWdQQ3lNL1FRRVFlU00vUVFGcVFmOEJjU1EvSXo4RVFFRUFFSG9GUVFFUWVndEJBQkI3REFjTEl6OUJmeEI1SXo5QkFXdEIvd0Z4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVCRUhzTUJnc1FkRUgvQVhFa1B3d0VDMEVBRUh0QkFCQjRJMFpCQkhaQkFYRkJBRXNFUUVFQUVId0ZRUUVRZkFzTUJBdEJmdzhMSUFCQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1JDQUFRZjhCY1NSRkRBSUxJQUJCLy84RGNTQUJFSFlNQVFzalNFRUJha0gvL3dOeEpFZ0xRUVFMNUFFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFFY0VRQ0FBUWNFQVJnMEJBa0FnQUVIQ0FHc09EZ01FQlFZSENBa1JDZ3NNRFE0UEFBc01Ed3NNRHdzalFTUkFEQTRMSTBJa1FBd05DeU5ESkVBTURBc2pSQ1JBREFzTEkwVWtRQXdLQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FGQi93RnhKRUFNQ1FzalB5UkFEQWdMSTBBa1FRd0hDeU5DSkVFTUJnc2pReVJCREFVTEkwUWtRUXdFQ3lORkpFRU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkJEQUlMSXo4a1FRd0JDMEYvRHd0QkJBdmZBUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBRWNFUUNBQVFkRUFSZzBCQWtBZ0FFSFNBR3NPRGhBREJBVUdCd2dKQ2hBTERBME9BQXNNRGdzalFDUkNEQTRMSTBFa1Fnd05DeU5ESkVJTURBc2pSQ1JDREFzTEkwVWtRZ3dLQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FGQi93RnhKRUlNQ1FzalB5UkNEQWdMSTBBa1F3d0hDeU5CSkVNTUJnc2pRaVJEREFVTEkwUWtRd3dFQ3lORkpFTU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkREQUlMSXo4a1F3d0JDMEYvRHd0QkJBdmZBUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBRWNFUUNBQVFlRUFSZzBCQWtBZ0FFSGlBR3NPRGdNRUVBVUdCd2dKQ2dzTUVBME9BQXNNRGdzalFDUkVEQTRMSTBFa1JBd05DeU5DSkVRTURBc2pReVJFREFzTEkwVWtSQXdLQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FGQi93RnhKRVFNQ1FzalB5UkVEQWdMSTBBa1JRd0hDeU5CSkVVTUJnc2pRaVJGREFVTEkwTWtSUXdFQ3lORUpFVU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkZEQUlMSXo4a1JRd0JDMEYvRHd0QkJBdnNBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFBUndSQUlBQkI4UUJHRFFFQ1FDQUFRZklBYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEVBQ3d3UEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJalFCQjJEQThMSTBWQi93RnhJMFJCL3dGeFFRaDBjaU5CRUhZTURnc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUkwSVFkZ3dOQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUXhCMkRBd0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpTkVFSFlNQ3dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5STBVUWRnd0tDeVBFQVVVRVFBSkFJNWtCQkVCQkFTUktEQUVMSTM0amhBRnhRUjl4UlFSQVFRRWtTd3dCQzBFQkpFd0xDd3dKQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUHhCMkRBZ0xJMEFrUHd3SEN5TkJKRDhNQmdzalFpUS9EQVVMSTBNa1B3d0VDeU5FSkQ4TUF3c2pSU1EvREFJTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFVSC9BWEVrUHd3QkMwRi9Ed3RCQkF0SkFRRi9JQUZCQUU0RVFDQUFRZjhCY1NBQUlBRnFRZjhCY1VzRVFFRUJFSHdGUVFBUWZBc0ZJQUZCSDNVaUFpQUJJQUpxY3lBQVFmOEJjVW9FUUVFQkVId0ZRUUFRZkFzTEN6UUJBWDhqUHlBQVFmOEJjU0lCRUhralB5QUJFSXNCSXo4Z0FHcEIvd0Z4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVBRUhzTGJBRUNmeU0vSUFCcUkwWkJCSFpCQVhGcVFmOEJjU0lCSVFJalB5QUFjeUFCYzBFUWNRUkFRUUVRZUFWQkFCQjRDeU0vSUFCQi93RnhhaU5HUVFSMlFRRnhha0dBQW5GQkFFc0VRRUVCRUh3RlFRQVFmQXNnQWlRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN0MvRUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQmdBRkhCRUFnQVVHQkFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJMEFRakFFTUVBc2pRUkNNQVF3UEN5TkNFSXdCREE0TEkwTVFqQUVNRFFzalJCQ01BUXdNQ3lORkVJd0JEQXNMSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDTUFRd0tDeU0vRUl3QkRBa0xJMEFRalFFTUNBc2pRUkNOQVF3SEN5TkNFSTBCREFZTEkwTVFqUUVNQlFzalJCQ05BUXdFQ3lORkVJMEJEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDTkFRd0NDeU0vRUkwQkRBRUxRWDhQQzBFRUN6Y0JBWDhqUHlBQVFmOEJjVUYvYkNJQkVIa2pQeUFCRUlzQkl6OGdBR3RCL3dGeEpEOGpQd1JBUVFBUWVnVkJBUkI2QzBFQkVIc0xiQUVDZnlNL0lBQnJJMFpCQkhaQkFYRnJRZjhCY1NJQklRSWpQeUFBY3lBQmMwRVFjUVJBUVFFUWVBVkJBQkI0Q3lNL0lBQkIvd0Z4YXlOR1FRUjJRUUZ4YTBHQUFuRkJBRXNFUUVFQkVId0ZRUUFRZkFzZ0FpUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFSQjdDL0VCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJrQUZIQkVBZ0FVR1JBV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTBBUWp3RU1FQXNqUVJDUEFRd1BDeU5DRUk4QkRBNExJME1RandFTURRc2pSQkNQQVF3TUN5TkZFSThCREFzTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFSQ1BBUXdLQ3lNL0VJOEJEQWtMSTBBUWtBRU1DQXNqUVJDUUFRd0hDeU5DRUpBQkRBWUxJME1Ra0FFTUJRc2pSQkNRQVF3RUN5TkZFSkFCREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFSQ1FBUXdDQ3lNL0VKQUJEQUVMUVg4UEMwRUVDeU1BSXo4Z0FIRWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVCRUhoQkFCQjhDeWNBSXo4Z0FITkIvd0Z4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRRUUFRZkF2eEFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWFBQlJ3UkFJQUZCb1FGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TkFFSklCREJBTEkwRVFrZ0VNRHdzalFoQ1NBUXdPQ3lOREVKSUJEQTBMSTBRUWtnRU1EQXNqUlJDU0FRd0xDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRa2dFTUNnc2pQeENTQVF3SkN5TkFFSk1CREFnTEkwRVFrd0VNQndzalFoQ1RBUXdHQ3lOREVKTUJEQVVMSTBRUWt3RU1CQXNqUlJDVEFRd0RDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRa3dFTUFnc2pQeENUQVF3QkMwRi9Ed3RCQkFzbkFDTS9JQUJ5UWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFCQjdRUUFRZUVFQUVId0xMd0VCZnlNL0lBQkIvd0Z4UVg5c0lnRVFlU00vSUFFUWl3RWpQeUFCYWdSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNMOFFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUd3QVVjRVFDQUJRYkVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzalFCQ1ZBUXdRQ3lOQkVKVUJEQThMSTBJUWxRRU1EZ3NqUXhDVkFRd05DeU5FRUpVQkRBd0xJMFVRbFFFTUN3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJFSlVCREFvTEl6OFFsUUVNQ1FzalFCQ1dBUXdJQ3lOQkVKWUJEQWNMSTBJUWxnRU1CZ3NqUXhDV0FRd0ZDeU5FRUpZQkRBUUxJMFVRbGdFTUF3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJFSllCREFJTEl6OFFsZ0VNQVF0QmZ3OExRUVFMT3dFQmZ5QUFFRkVpQVVGL1JnUi9JQUFRQVFVZ0FRdEIvd0Z4SUFCQkFXb2lBUkJSSWdCQmYwWUVmeUFCRUFFRklBQUxRZjhCY1VFSWRISUxDd0JCQ0JCeklBQVFtQUVMUXdBZ0FFR0FBWEZCZ0FGR0JFQkJBUkI4QlVFQUVId0xJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU0lBQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhnZ0FBdEJBQ0FBUVFGeFFRQkxCRUJCQVJCOEJVRUFFSHdMSUFCQkIzUWdBRUgvQVhGQkFYWnlRZjhCY1NJQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIZ2dBQXRQQVFGL1FRRkJBQ0FBUVlBQmNVR0FBVVliSVFFalJrRUVka0VCY1NBQVFRRjBja0gvQVhFaEFDQUJCRUJCQVJCOEJVRUFFSHdMSUFBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUFDMUFCQVg5QkFVRUFJQUJCQVhGQkFVWWJJUUVqUmtFRWRrRUJjVUVIZENBQVFmOEJjVUVCZG5JaEFDQUJCRUJCQVJCOEJVRUFFSHdMSUFBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUFDMFlCQVg5QkFVRUFJQUJCZ0FGeFFZQUJSaHNoQVNBQVFRRjBRZjhCY1NFQUlBRUVRRUVCRUh3RlFRQVFmQXNnQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBQUxYZ0VDZjBFQlFRQWdBRUVCY1VFQlJoc2hBVUVCUVFBZ0FFR0FBWEZCZ0FGR0d5RUNJQUJCL3dGeFFRRjJJZ0JCZ0FGeUlBQWdBaHNpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBRUVRRUVCRUh3RlFRQVFmQXNnQUFzd0FDQUFRUTl4UVFSMElBQkI4QUZ4UVFSMmNpSUFCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGhCQUJCOElBQUxRZ0VCZjBFQlFRQWdBRUVCY1VFQlJoc2hBU0FBUWY4QmNVRUJkaUlBQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhnZ0FRUkFRUUVRZkFWQkFCQjhDeUFBQ3lRQVFRRWdBSFFnQVhGQi93RnhCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUJFSGdnQVF1ZkNBRUdmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVJYnlJR0lnVUVRQ0FGUVFGckRnY0JBZ01FQlFZSENBc2pRQ0VCREFjTEkwRWhBUXdHQ3lOQ0lRRU1CUXNqUXlFQkRBUUxJMFFoQVF3REN5TkZJUUVNQWdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQklRRU1BUXNqUHlFQkN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdVaUJBUkFJQVJCQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTElBQkJCMHdFZjBFQklRSWdBUkNhQVFVZ0FFRVBUQVIvUVFFaEFpQUJFSnNCQlVFQUN3c2hBd3dQQ3lBQVFSZE1CSDlCQVNFQ0lBRVFuQUVGSUFCQkgwd0VmMEVCSVFJZ0FSQ2RBUVZCQUFzTElRTU1EZ3NnQUVFblRBUi9RUUVoQWlBQkVKNEJCU0FBUVM5TUJIOUJBU0VDSUFFUW53RUZRUUFMQ3lFRERBMExJQUJCTjB3RWYwRUJJUUlnQVJDZ0FRVWdBRUUvVEFSL1FRRWhBaUFCRUtFQkJVRUFDd3NoQXd3TUN5QUFRY2NBVEFSL1FRRWhBa0VBSUFFUW9nRUZJQUJCendCTUJIOUJBU0VDUVFFZ0FSQ2lBUVZCQUFzTElRTU1Dd3NnQUVIWEFFd0VmMEVCSVFKQkFpQUJFS0lCQlNBQVFkOEFUQVIvUVFFaEFrRURJQUVRb2dFRlFRQUxDeUVEREFvTElBQkI1d0JNQkg5QkFTRUNRUVFnQVJDaUFRVWdBRUh2QUV3RWYwRUJJUUpCQlNBQkVLSUJCVUVBQ3dzaEF3d0pDeUFBUWZjQVRBUi9RUUVoQWtFR0lBRVFvZ0VGSUFCQi93Qk1CSDlCQVNFQ1FRY2dBUkNpQVFWQkFBc0xJUU1NQ0FzZ0FFR0hBVXdFZjBFQklRSWdBVUYrY1FVZ0FFR1BBVXdFZjBFQklRSWdBVUY5Y1FWQkFBc0xJUU1NQndzZ0FFR1hBVXdFZjBFQklRSWdBVUY3Y1FVZ0FFR2ZBVXdFZjBFQklRSWdBVUYzY1FWQkFBc0xJUU1NQmdzZ0FFR25BVXdFZjBFQklRSWdBVUZ2Y1FVZ0FFR3ZBVXdFZjBFQklRSWdBVUZmY1FWQkFBc0xJUU1NQlFzZ0FFRzNBVXdFZjBFQklRSWdBVUcvZjNFRklBQkJ2d0ZNQkg5QkFTRUNJQUZCLzM1eEJVRUFDd3NoQXd3RUN5QUFRY2NCVEFSL1FRRWhBaUFCUVFGeUJTQUFRYzhCVEFSL1FRRWhBaUFCUVFKeUJVRUFDd3NoQXd3REN5QUFRZGNCVEFSL1FRRWhBaUFCUVFSeUJTQUFRZDhCVEFSL1FRRWhBaUFCUVFoeUJVRUFDd3NoQXd3Q0N5QUFRZWNCVEFSL1FRRWhBaUFCUVJCeUJTQUFRZThCVEFSL1FRRWhBaUFCUVNCeUJVRUFDd3NoQXd3QkN5QUFRZmNCVEFSL1FRRWhBaUFCUWNBQWNnVWdBRUgvQVV3RWYwRUJJUUlnQVVHQUFYSUZRUUFMQ3lFREN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0JpSUVCRUFnQkVFQmF3NEhBUUlEQkFVR0J3Z0xJQU1rUUF3SEN5QURKRUVNQmdzZ0F5UkNEQVVMSUFNa1F3d0VDeUFESkVRTUF3c2dBeVJGREFJTElBVkJCRWdpQkFSL0lBUUZJQVZCQjBvTEJFQWpSVUgvQVhFalJFSC9BWEZCQ0hSeUlBTVFkZ3NNQVFzZ0F5US9DMEVFUVg4Z0Foc0w3Z01BQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FCUndSQUlBQkJ3UUZyRGc4QkFoRURCQVVHQndnSkNnc1FEQTBPQ3lOR1FRZDJRUUZ4RFJFTURnc2pSeENaQVVILy93TnhJUUFqUjBFQ2FrSC8vd054SkVjZ0FFR0EvZ054UVFoMUpFQWdBRUgvQVhFa1FVRUVEd3NqUmtFSGRrRUJjUTBSREE0TEkwWkJCM1pCQVhFTkVBd01DeU5IUVFKclFmLy9BM0VrUnlOSEkwRkIvd0Z4STBCQi93RnhRUWgwY2hCK0RBMExFSFFRakFFTURRc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJBQ1JJREFzTEkwWkJCM1pCQVhGQkFVY05DZ3dIQ3lOSEVKa0JRZi8vQTNFa1NDTkhRUUpxUWYvL0EzRWtSd3dKQ3lOR1FRZDJRUUZ4UVFGR0RRY01DZ3NRZEVIL0FYRVFvd0VoQUNOSVFRRnFRZi8vQTNFa1NDQUFEd3NqUmtFSGRrRUJjVUVCUncwSUkwZEJBbXRCLy84RGNTUkhJMGNqU0VFQ2FrSC8vd054RUg0TUJRc1FkQkNOQVF3R0N5TkhRUUpyUWYvL0EzRWtSeU5ISTBnUWZrRUlKRWdNQkF0QmZ3OExJMGNRbVFGQi8vOERjU1JJSTBkQkFtcEIvLzhEY1NSSFFRd1BDeU5IUVFKclFmLy9BM0VrUnlOSEkwaEJBbXBCLy84RGNSQitDeEIxUWYvL0EzRWtTQXRCQ0E4TEkwaEJBV3BCLy84RGNTUklRUVFQQ3lOSVFRSnFRZi8vQTNFa1NFRU1DOU1EQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUJSd1JBSUFCQjBRRnJEZzhCQWcwREJBVUdCd2dKRFFvTkN3d05DeU5HUVFSMlFRRnhEUThNRFFzalJ4Q1pBVUgvL3dOeElRQWpSMEVDYWtILy93TnhKRWNnQUVHQS9nTnhRUWgxSkVJZ0FFSC9BWEVrUTBFRUR3c2pSa0VFZGtFQmNRMFBEQXdMSTBaQkJIWkJBWEVORGlOSFFRSnJRZi8vQTNFa1J5TkhJMGhCQW1wQi8vOERjUkIrREFzTEkwZEJBbXRCLy84RGNTUkhJMGNqUTBIL0FYRWpRa0gvQVhGQkNIUnlFSDRNQ3dzUWRCQ1BBUXdMQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFUUpFZ01DUXNqUmtFRWRrRUJjVUVCUncwSURBWUxJMGNRbVFGQi8vOERjU1JJUVFFa21nRWpSMEVDYWtILy93TnhKRWNNQndzalJrRUVka0VCY1VFQlJnMEZEQWdMSTBaQkJIWkJBWEZCQVVjTkJ5TkhRUUpyUWYvL0EzRWtSeU5ISTBoQkFtcEIvLzhEY1JCK0RBUUxFSFFRa0FFTUJRc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJHQ1JJREFNTFFYOFBDeU5IRUprQlFmLy9BM0VrU0NOSFFRSnFRZi8vQTNFa1IwRU1Ed3NRZFVILy93TnhKRWdMUVFnUEN5TklRUUZxUWYvL0EzRWtTRUVFRHdzalNFRUNha0gvL3dOeEpFaEJEQXZ3QWdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIZ0FVY0VRQ0FBUWVFQmF3NFBBUUlMQ3dNRUJRWUhDQXNMQ3drS0N3c1FkRUgvQVhGQmdQNERhaU0vRUhZTUN3c2pSeENaQVVILy93TnhJUUFqUjBFQ2FrSC8vd054SkVjZ0FFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JVRUVEd3NqUVVHQS9nTnFJejhRZGtFRUR3c2pSMEVDYTBILy93TnhKRWNqUnlORlFmOEJjU05FUWY4QmNVRUlkSElRZmtFSUR3c1FkQkNTQVF3SEN5TkhRUUpyUWYvL0EzRWtSeU5ISTBnUWZrRWdKRWhCQ0E4TEVIUVFnZ0ZCR0hSQkdIVWhBQ05ISUFCQkFSQi9JMGNnQUdwQi8vOERjU1JIUVFBUWVrRUFFSHNqU0VFQmFrSC8vd054SkVoQkRBOExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpUklRUVFQQ3hCMVFmLy9BM0VqUHhCMkkwaEJBbXBCLy84RGNTUklRUVFQQ3hCMEVKTUJEQUlMSTBkQkFtdEIvLzhEY1NSSEkwY2pTQkIrUVNna1NFRUlEd3RCZnc4TEkwaEJBV3BCLy84RGNTUklRUVFMcHdNQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGSEJFQWdBRUh4QVdzT0R3RUNBdzBFQlFZSENBa0tEUTBMREEwTEVIUkIvd0Z4UVlEK0Eyb1FnQUZCL3dGeEpEOE1EUXNqUnhDWkFVSC8vd054SVFBalIwRUNha0gvL3dOeEpFY2dBRUdBL2dOeFFRaDFKRDhnQUVIL0FYRWtSZ3dOQ3lOQlFZRCtBMm9RZ0FGQi93RnhKRDhNREF0QkFDU1pBUXdMQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMFpCL3dGeEl6OUIvd0Z4UVFoMGNoQitRUWdQQ3hCMEVKVUJEQWdMSTBkQkFtdEIvLzhEY1NSSEkwY2pTQkIrUVRBa1NFRUlEd3NRZEJDQ0FTRUFRUUFRZWtFQUVIc2pSeUFBUVJoMFFSaDFJZ0JCQVJCL0kwY2dBR3BCLy84RGNTSUFRWUQrQTNGQkNIVWtSQ0FBUWY4QmNTUkZJMGhCQVdwQi8vOERjU1JJUVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJa1IwRUlEd3NRZFVILy93TnhFSUFCUWY4QmNTUS9JMGhCQW1wQi8vOERjU1JJREFVTFFRRWttZ0VNQkFzUWRCQ1dBUXdDQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFNEpFaEJDQThMUVg4UEN5TklRUUZxUWYvL0EzRWtTQXRCQkF2Y0FRRUJmeU5JUVFGcVFmLy9BM0VrU0NOTUJFQWpTRUVCYTBILy93TnhKRWdMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGR0RRRUNRQ0FCUVFKckRnMERCQVVHQndnSkNnc01EUTRQQUFzTUR3c2dBQkNCQVE4TElBQVFoQUVQQ3lBQUVJVUJEd3NnQUJDR0FROExJQUFRaHdFUEN5QUFFSWdCRHdzZ0FCQ0pBUThMSUFBUWlnRVBDeUFBRUk0QkR3c2dBQkNSQVE4TElBQVFsQUVQQ3lBQUVKY0JEd3NnQUJDa0FROExJQUFRcFFFUEN5QUFFS1lCRHdzZ0FCQ25BUXZDQVFFQ2YwRUFKSmtCUVkvK0F4QUJRUUVnQUhSQmYzTnhJZ0VraEFGQmovNERJQUVRQkNOSFFRSnJRZi8vQTNFa1J3SkFJMG9pQVNOTElBRWJEUUFMSTBjaUFTTklJZ0pCL3dGeEVBUWdBVUVCYWlBQ1FZRCtBM0ZCQ0hVUUJBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09Bd01FQlFBTERBVUxRUUFrZjBIQUFDUklEQVFMUVFBa2dBRkJ5QUFrU0F3REMwRUFKSUVCUWRBQUpFZ01BZ3RCQUNTQ0FVSFlBQ1JJREFFTFFRQWtnd0ZCNEFBa1NBc0wrUUVCQTM4am1nRUVRRUVCSkprQlFRQWttZ0VMSTM0amhBRnhRUjl4UVFCS0JFQWpTMFVqbVFFaUFpQUNHd1IvSTM4amVTSUFJQUFiQkg5QkFCQ3BBVUVCQlNPQUFTTjZJZ0FnQUJzRWYwRUJFS2tCUVFFRkk0RUJJM3NpQUNBQUd3Ui9RUUlRcVFGQkFRVWpnZ0VqZkNJQUlBQWJCSDlCQXhDcEFVRUJCU09EQVNOOUlnQWdBQnNFZjBFRUVLa0JRUUVGUVFBTEN3c0xDd1ZCQUFzRVFBSi9RUUVqU2lJQUkwc2dBQnNOQUJwQkFBc0VmMEVBSkV0QkFDUktRUUFrVEVFQUpFMUJHQVZCRkFzaEFRc0NmMEVCSTBvaUFDTkxJQUFiRFFBYVFRQUxCRUJCQUNSTFFRQWtTa0VBSkV4QkFDUk5DeUFCRHd0QkFBdXJBUUVDZjBFQkpDMGpUQVJBSTBnUUFVSC9BWEVRcUFFUWMwRUFKRXRCQUNSS1FRQWtURUVBSkUwTEVLb0JJZ0ZCQUVvRVFDQUJFSE1MUVFRaEFBSi9RUUVqU2lJQkkwc2dBUnNOQUJwQkFBdEZJZ0VFZnlOTlJRVWdBUXNFUUNOSUVBRkIvd0Z4RUtnQklRQUxJMFpCOEFGeEpFWWdBRUVBVEFSQUlBQVBDeUFBRUhNamx3RkJBV29rbHdFamx3RWpsUUZPQkVBamxnRkJBV29rbGdFamx3RWpsUUZySkpjQkN5QUFDd1FBSTJvTDVnRUJCWDhnQUVGL1FZQUlJQUJCQUVnYklBQkJBRW9iSVFSQkFDRUFBMEFDZndKL0lBWkZJZ0lFUUNBQVJTRUNDeUFDQ3dSQUlBVkZJUUlMSUFJTEJFQWdBMFVoQWdzZ0FnUkFFS3NCUVFCSUJFQkJBU0VHQlNOSkl6NEVmMEdneVFnRlFkQ2tCQXRPQkVCQkFTRUFCU0FFUVg5S0lnSUVRQ05xSUFST0lRSUxJQUlFUUVFQklRVUZJQUZCZjBvaUFnUkFJMGdnQVVZaEFndEJBU0FESUFJYklRTUxDd3NNQVFzTElBQUVRQ05KSXo0RWYwR2d5UWdGUWRDa0JBdHJKRWtqaUFJUEN5QUZCRUFqaVFJUEN5QURCRUFqaWdJUEN5TklRUUZyUWYvL0EzRWtTRUYvQ3drQVFYOUJmeEN0QVFzNEFRTi9BMEFnQWlBQVNDSURCRUFnQVVFQVRpRURDeUFEQkVBUXJnRWhBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0pBRUYvSUFBUXJRRUxDUUFnQUNBQkVLMEJDd1VBSTVJQkN3VUFJNU1CQ3dVQUk1UUJDMThCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFJZ0ZCQVVZTkFRSkFJQUZCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJK29CRHdzajZ3RVBDeVBzQVE4TEkrMEJEd3NqN2dFUEN5UHZBUThMSS9BQkR3c2o4UUVQQzBFQUM0c0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FDSUNRUUZHRFFFQ1FDQUNRUUpyRGdZREJBVUdCd2dBQ3d3SUN5QUJRUUJISk9vQkRBY0xJQUZCQUVjazZ3RU1CZ3NnQVVFQVJ5VHNBUXdGQ3lBQlFRQkhKTzBCREFRTElBRkJBRWNrN2dFTUF3c2dBVUVBUnlUdkFRd0NDeUFCUVFCSEpQQUJEQUVMSUFGQkFFY2s4UUVMQzFRQkFYOUJBQ1JOSUFBUXRRRkZCRUJCQVNFQkN5QUFRUUVRdGdFZ0FRUkFRUUZCQVVFQVFRRkJBQ0FBUVFOTUd5SUJJNzhCSWdBZ0FCc2JJQUZGSThBQklnQWdBQnNiQkVCQkFTU0RBVUVFRURvTEN3c0pBQ0FBUVFBUXRnRUxtZ0VBSUFCQkFFb0VRRUVBRUxjQkJVRUFFTGdCQ3lBQlFRQktCRUJCQVJDM0FRVkJBUkM0QVFzZ0FrRUFTZ1JBUVFJUXR3RUZRUUlRdUFFTElBTkJBRW9FUUVFREVMY0JCVUVERUxnQkN5QUVRUUJLQkVCQkJCQzNBUVZCQkJDNEFRc2dCVUVBU2dSQVFRVVF0d0VGUVFVUXVBRUxJQVpCQUVvRVFFRUdFTGNCQlVFR0VMZ0JDeUFIUVFCS0JFQkJCeEMzQVFWQkJ4QzRBUXNMQkFBalB3c0VBQ05BQ3dRQUkwRUxCQUFqUWdzRUFDTkRDd1FBSTBRTEJBQWpSUXNFQUNOR0N3UUFJMGdMQkFBalJ3c0dBQ05JRUFFTEJBQWpWZ3V2QXdFS2YwR0FnQUpCZ0pBQ0k3a0JHeUVKUVlDNEFrR0FzQUlqdWdFYklRb0RRQ0FGUVlBQ1NBUkFRUUFoQkFOQUlBUkJnQUpJQkVBZ0NTQUZRUU4xUVFWMElBcHFJQVJCQTNWcUlnTkJnSkIrYWkwQUFCQXNJUWdnQlVFSWJ5RUJRUWNnQkVFSWIyc2hCa0VBSVFJQ2Z5QUFRUUJLSXpvaUJ5QUhHd1JBSUFOQmdOQithaTBBQUNFQ0N5QUNRY0FBY1FzRVFFRUhJQUZySVFFTFFRQWhCeUFCUVFGMElBaHFJZ05CZ0pCK2FrRUJRUUFnQWtFSWNSc2lCMEVCY1VFTmRHb3RBQUFoQ0VFQUlRRWdBMEdCa0g1cUlBZEJBWEZCRFhScUxRQUFRUUVnQm5SeEJFQkJBaUVCQ3lBQlFRRnFJQUZCQVNBR2RDQUljUnNoQVNBRlFRaDBJQVJxUVFOc0lRWWdBRUVBU2lNNklnTWdBeHNFUUNBQ1FRZHhJQUZCQUJBdElnRkJIM0ZCQTNRaEF5QUdRWUNoQzJvaUFpQURPZ0FBSUFKQkFXb2dBVUhnQjNGQkJYVkJBM1E2QUFBZ0FrRUNhaUFCUVlENEFYRkJDblZCQTNRNkFBQUZJQUZCeC80RFFRQVFMaUVDUVFBaEFRTkFJQUZCQTBnRVFDQUdRWUNoQzJvZ0FXb2dBam9BQUNBQlFRRnFJUUVNQVFzTEN5QUVRUUZxSVFRTUFRc0xJQVZCQVdvaEJRd0JDd3NMeUFFQkJuOENRQU5BSUFGQkYwNE5BVUVBSVFBRFFBSkFJQUJCSDA0TkFFRUFJUVJCQVVFQUlBQkJEMG9iSVFRZ0FTRUNJQUpCRDJzZ0FpQUJRUTlLRzBFRWRDRUNJQUJCRDJzZ0Ftb2dBQ0FDYWlBQVFROUtHeUVDUVlDQUFpRUZRWUNRQWtHQWdBSWdBVUVQU2hzaEJVRUFJUU1EUUFKQUlBTkJDRTROQUNBQ0lBVWdCRUVBUVFjZ0F5QUFRUU4wSUFGQkEzUWdBMnBCK0FGQmdLRVhRUUZCZnhBdkdpQURRUUZxSVFNTUFRc0xJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUFBQ3dBTEM0QUNBUWQvQTBBZ0JFRUlUa1VFUUVFQUlRRURRQ0FCUVFWSUJFQWdBVUVEZENBRWFrRUNkQ0lBUVlEOEEyb1FBUm9nQUVHQi9BTnFFQUVhSUFCQmd2d0RhaEFCSVFKQkFTRUZJN3NCQkVBZ0FrRUNiMEVCUmdSQUlBSkJBV3NoQWd0QkFpRUZDeUFBUVlQOEEyb1FBU0VBUVFBaEJrRUJRUUFnQUVFSWNVRUFSeU02SXpvYkd5RUdRUUFoQUFOQUlBQWdCVWdFUUVFQUlRTURRQ0FEUVFoSUJFQWdBQ0FDYWtHQWdBSWdCa0VBUVFjZ0F5QUVRUU4wSUFGQkJIUWdBMm9nQUVFRGRHcEJ3QUJCZ0tFZ1FRRkJmeEF2R2lBRFFRRnFJUU1NQVFzTElBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBRUxDeUFFUVFGcUlRUU1BUXNMQ3dVQUk0WUJDd1VBSTRjQkN3VUFJNGdCQ3hnQkFYOGppZ0VoQUNPSkFRUkFJQUJCQkhJaEFBc2dBQXN0QVFGL0FrQURRQ0FBUWYvL0EwNE5BU0FBUVlDaHlRUnFJQUFRVWpvQUFDQUFRUUZxSVFBTUFBQUxBQXNMRkFBL0FFR1VBVWdFUUVHVUFUOEFhMEFBR2dzTEF3QUJDeDhBQWtBQ1FBSkFJNWtDRGdJQkFnQUxBQXRCQUNFQUN5QUFRWDhRclFFTEJ3QWdBQ1NaQWdzdkFBSkFBa0FDUUFKQUFrQWptUUlPQkFFQ0F3UUFDd0FMUVFFaEFBdEJmeUVCQzBGL0lRSUxJQUVnQWhDdEFRc0FNeEJ6YjNWeVkyVk5ZWEJ3YVc1blZWSk1JV052Y21VdlpHbHpkQzlqYjNKbExuVnVkRzkxWTJobFpDNTNZWE50TG0xaGNBPT0iKToKInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93fHwidW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmP2F3YWl0IEcoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCaVFFU1lBcC9mMzkvZjM5L2YzOS9BR0FBQUdBQmZ3Ri9ZQUovZndCZ0FYOEFZQUovZndGL1lBQUJmMkFEZjM5L0FYOWdBMzkvZndCZ0JuOS9mMzkvZndCZ0IzOS9mMzkvZjM4QmYyQUhmMzkvZjM5L2Z3QmdCSDkvZjM4QmYyQUlmMzkvZjM5L2YzOEFZQVYvZjM5L2Z3Ri9ZQXgvZjM5L2YzOS9mMzkvZjM4QmYyQUFBR0FDZjM4QmZ3UFZBZE1CQWdJQkFRTUJBUUVCQVFFQkFRRUVCQUVCQVFBR0FRRUJBUUVCQVFFRUJBRUJBUUVCQVFFQkJnWUdCZzRGQndjUENnc0pDUWdJQXdRQkFRUUJCQUVCQVFFQkFnSUZBZ0lDQWdVTUJBUUVBUUlHQWdJREJBUUVCQUVCQVFFRUJRUUdCZ1FEQWdVRUFSQUVCUU1JQVFVQkJBRUZCQVFHQmdNRkJBTUVCQVFEQXdnQ0FnSUVBZ0lDQWdJQ0FnTUVCQUlFQkFJRUJBSUVCQUlDQWdJQ0FnSUNBZ0lDQlFJQ0FnSUNBZ1FHQmdZUkJnSUNCUVlHQmdJREJBUU5CZ1lHQmdZR0JnWUdCZ1lHQkFFQkJnWUdCZ0VCQVFJRUJ3UUVBWEFBQVFVREFRQUFCcGNNbWdKL0FFRUFDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBUUMzOEFRWUNBQVF0L0FFR0FrQUVMZndCQmdJQUNDMzhBUVlDUUF3dC9BRUdBZ0FFTGZ3QkJnQkFMZndCQmdJQUVDMzhBUVlDUUJBdC9BRUdBQVF0L0FFR0FrUVFMZndCQmdMZ0JDMzhBUVlESkJRdC9BRUdBMkFVTGZ3QkJnS0VMQzM4QVFZQ0FEQXQvQUVHQW9SY0xmd0JCZ0lBSkMzOEFRWUNoSUF0L0FFR0ErQUFMZndCQmdKQUVDMzhBUVlDSkhRdC9BRUdBbVNFTGZ3QkJnSUFJQzM4QVFZQ1pLUXQvQUVHQWdBZ0xmd0JCZ0preEMzOEFRWUNBQ0F0L0FFR0FtVGtMZndCQmdJQUlDMzhBUVlDWndRQUxmd0JCZ0lBSUMzOEFRWUNaeVFBTGZ3QkJnSUFJQzM4QVFZQ1owUUFMZndCQmdJajRBd3QvQUVHQW9ja0VDMzhBUWYvL0F3dC9BRUVBQzM4QVFZQ2h6UVFMZndCQmxBRUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRYy8rQXd0L0FVRUFDMzhCUWZEK0F3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZRDNBZ3QvQVVHQWdBZ0xmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIVi9nTUxmd0ZCMGY0REMzOEJRZEwrQXd0L0FVSFQvZ01MZndGQjFQNERDMzhCUWVqK0F3dC9BVUhyL2dNTGZ3RkI2ZjREQzM4QlFRQUxmd0ZCQVF0L0FVRUNDMzhBUVlDaHpRUUxmd0JCZ0FnTGZ3QkJnQWdMZndCQmdCQUxmd0JCZ0lBRUMzOEFRWUNRQkF0L0FFR0FrQVFMZndCQmdBRUxmd0JCZ01rRkMzOEFRWUNoQ3d0L0FFR0FvUmNMZndCQmdKbkJBQXQvQUVHQW1ja0FDMzhBUVlDWjBRQUxmd0ZCQUFzSHV4SnNCbTFsYlc5eWVRSUFCWFJoWW14bEFRQUdZMjl1Wm1sbkFCTU9hR0Z6UTI5eVpWTjBZWEowWldRQUZBbHpZWFpsVTNSaGRHVUFHd2xzYjJGa1UzUmhkR1VBSmdWcGMwZENRd0FuRW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFBb0MyZGxkRk4wWlhCVFpYUnpBQ2tJWjJWMFUzUmxjSE1BS2hWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUFyd0VNWlhobFkzVjBaVVp5WVcxbEFLNEJDRjl6WlhSaGNtZGpBTkVCR1dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzhBMEFFYlpYaGxZM1YwWlVaeVlXMWxWVzUwYVd4Q2NtVmhhM0J2YVc1MEFMQUJLR1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOVZiblJwYkVKeVpXRnJjRzlwYm5RQXNRRVZaWGhsWTNWMFpWVnVkR2xzUTI5dVpHbDBhVzl1QU5JQkMyVjRaV04xZEdWVGRHVndBS3NCRkdkbGRFTjVZMnhsYzFCbGNrTjVZMnhsVTJWMEFMSUJER2RsZEVONVkyeGxVMlYwY3dDekFRbG5aWFJEZVdOc1pYTUF0QUVPYzJWMFNtOTVjR0ZrVTNSaGRHVUF1UUVmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnQ3NBUkJqYkdWaGNrRjFaR2x2UW5WbVptVnlBQ0lYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERLaE5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXlzU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF5d2VRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdBYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREFSWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdJU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3TWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RENoeEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd3NTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdRT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQlJGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNR0RWZFBVa3RmVWtGTlgxTkpXa1VEQnlaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTUlJazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURDUmhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNERHQlJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNWkZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9Bd3dRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1OR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01PRkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF3OE9SbEpCVFVWZlRFOURRVlJKVDA0REVBcEdVa0ZOUlY5VFNWcEZBeEVYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERFaE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhNU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4UU9WRWxNUlY5RVFWUkJYMU5KV2tVREZSSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERGZzVQUVUxZlZFbE1SVk5mVTBsYVJRTVhGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNaUVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF5TVpRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWFGVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZVMGxhUlFNYkdVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlRFOURRVlJKVDA0REhCVkRTRUZPVGtWTVh6SmZRbFZHUmtWU1gxTkpXa1VESFJsRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXg0VlEwaEJUazVGVEY4elgwSlZSa1pGVWw5VFNWcEZBeDhaUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01nRlVOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVTBsYVJRTWhGa05CVWxSU1NVUkhSVjlTUVUxZlRFOURRVlJKVDA0REpCSkRRVkpVVWtsRVIwVmZVa0ZOWDFOSldrVURKUlpEUVZKVVVrbEVSMFZmVWs5TlgweFBRMEZVU1U5T0F5WVNRMEZTVkZKSlJFZEZYMUpQVFY5VFNWcEZBeWNkUkVWQ1ZVZGZSMEZOUlVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0REtCbEVSVUpWUjE5SFFVMUZRazlaWDAxRlRVOVNXVjlUU1ZwRkF5a2haMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBQU1aMlYwVW1WbmFYTjBaWEpCQUxvQkRHZGxkRkpsWjJsemRHVnlRZ0M3QVF4blpYUlNaV2RwYzNSbGNrTUF2QUVNWjJWMFVtVm5hWE4wWlhKRUFMMEJER2RsZEZKbFoybHpkR1Z5UlFDK0FReG5aWFJTWldkcGMzUmxja2dBdndFTVoyVjBVbVZuYVhOMFpYSk1BTUFCREdkbGRGSmxaMmx6ZEdWeVJnREJBUkZuWlhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0RDQVE5blpYUlRkR0ZqYTFCdmFXNTBaWElBd3dFWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dERUFRVm5aWFJNV1FERkFSMWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllUURHQVJoa2NtRjNWR2xzWlVSaGRHRlViMWRoYzIxTlpXMXZjbmtBeHdFVFpISmhkMDloYlZSdlYyRnpiVTFsYlc5eWVRRElBUVpuWlhSRVNWWUF5UUVIWjJWMFZFbE5RUURLQVFablpYUlVUVUVBeXdFR1oyVjBWRUZEQU13QkUzVndaR0YwWlVSbFluVm5SMEpOWlcxdmNua0F6UUVHZFhCa1lYUmxBSzRCRFdWdGRXeGhkR2x2YmxOMFpYQUFxd0VTWjJWMFFYVmthVzlSZFdWMVpVbHVaR1Y0QUt3QkQzSmxjMlYwUVhWa2FXOVJkV1YxWlFBaURuZGhjMjFOWlcxdmNubFRhWHBsQTRzQ0hIZGhjMjFDYjNsSmJuUmxjbTVoYkZOMFlYUmxURzlqWVhScGIyNERqQUlZZDJGemJVSnZlVWx1ZEdWeWJtRnNVM1JoZEdWVGFYcGxBNDBDSFdkaGJXVkNiM2xKYm5SbGNtNWhiRTFsYlc5eWVVeHZZMkYwYVc5dUE0NENHV2RoYldWQ2IzbEpiblJsY201aGJFMWxiVzl5ZVZOcGVtVURqd0lUZG1sa1pXOVBkWFJ3ZFhSTWIyTmhkR2x2YmdPUUFpSm1jbUZ0WlVsdVVISnZaM0psYzNOV2FXUmxiMDkxZEhCMWRFeHZZMkYwYVc5dUE1TUNHMmRoYldWaWIzbERiMnh2Y2xCaGJHVjBkR1ZNYjJOaGRHbHZiZ09SQWhkbllXMWxZbTk1UTI5c2IzSlFZV3hsZEhSbFUybDZaUU9TQWhWaVlXTnJaM0p2ZFc1a1RXRndURzlqWVhScGIyNERsQUlMZEdsc1pVUmhkR0ZOWVhBRGxRSVRjMjkxYm1SUGRYUndkWFJNYjJOaGRHbHZiZ09XQWhGbllXMWxRbmwwWlhOTWIyTmhkR2x2YmdPWUFoUm5ZVzFsVW1GdFFtRnVhM05NYjJOaGRHbHZiZ09YQWdnQ3pnRUpDQUVBUVFBTEFjOEJDcVhZQWRNQnp3RUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUXgxSWdGRkRRQUNRQ0FCUVFGckRnMEJBUUVDQWdJQ0F3TUVCQVVHQUFzTUJnc2dBRUdBbWRFQWFnOExJQUJCQVNNNElnQWpPVVVpQVFSL0lBQkZCU0FCQ3h0QkRuUnFRWUNaMEFCcUR3c2dBRUdBa0g1cUl6b0VmeU03RUFGQkFYRUZRUUFMUVExMGFnOExJQUFqUEVFTmRHcEJnTm5HQUdvUEN5QUFRWUNRZm1vUEMwRUFJUUVDZnlNNkJFQWpQUkFCUVFkeElRRUxJQUZCQVVnTEJFQkJBU0VCQ3lBQlFReDBJQUJxUVlEd2ZXb1BDeUFBUVlCUWFnc0pBQ0FBRUFBdEFBQUxtUUVBUVFBa1BrRUFKRDlCQUNSQVFRQWtRVUVBSkVKQkFDUkRRUUFrUkVFQUpFVkJBQ1JHUVFBa1IwRUFKRWhCQUNSSlFRQWtTa0VBSkV0QkFDUk1RUUFrVFNNNkJFQkJFU1EvUVlBQkpFWkJBQ1JBUVFBa1FVSC9BU1JDUWRZQUpFTkJBQ1JFUVEwa1JRVkJBU1EvUWJBQkpFWkJBQ1JBUVJNa1FVRUFKRUpCMkFFa1EwRUJKRVJCelFBa1JRdEJnQUlrU0VIKy93TWtSd3VrQVFFQ2YwRUFKRTVCQVNSUFFjY0NFQUVoQVVFQUpGQkJBQ1JSUVFBa1VrRUFKRk5CQUNRNUlBRUVRQ0FCUVFGT0lnQUVRQ0FCUVFOTUlRQUxJQUFFUUVFQkpGRUZJQUZCQlU0aUFBUkFJQUZCQmt3aEFBc2dBQVJBUVFFa1VnVWdBVUVQVGlJQUJFQWdBVUVUVENFQUN5QUFCRUJCQVNSVEJTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQUVRRUVCSkRrTEN3c0xCVUVCSkZBTFFRRWtPRUVBSkR3TEN3QWdBQkFBSUFFNkFBQUxMd0JCMGY0RFFmOEJFQVJCMHY0RFFmOEJFQVJCMC80RFFmOEJFQVJCMVA0RFFmOEJFQVJCMWY0RFFmOEJFQVFMbUFFQVFRQWtWRUVBSkZWQkFDUldRUUFrVjBFQUpGaEJBQ1JaUVFBa1dpTTZCRUJCa0FFa1ZrSEEvZ05Ca1FFUUJFSEIvZ05CZ1FFUUJFSEUvZ05Ca0FFUUJFSEgvZ05CL0FFUUJBVkJrQUVrVmtIQS9nTkJrUUVRQkVIQi9nTkJoUUVRQkVIRy9nTkIvd0VRQkVISC9nTkIvQUVRQkVISS9nTkIvd0VRQkVISi9nTkIvd0VRQkF0QnovNERRUUFRQkVIdy9nTkJBUkFFQzA4QUl6b0VRRUhvL2dOQndBRVFCRUhwL2dOQi93RVFCRUhxL2dOQndRRVFCRUhyL2dOQkRSQUVCVUhvL2dOQi93RVFCRUhwL2dOQi93RVFCRUhxL2dOQi93RVFCRUhyL2dOQi93RVFCQXNMTHdCQmtQNERRWUFCRUFSQmtmNERRYjhCRUFSQmt2NERRZk1CRUFSQmsvNERRY0VCRUFSQmxQNERRYjhCRUFRTExBQkJsZjREUWY4QkVBUkJsdjREUVQ4UUJFR1gvZ05CQUJBRVFaaitBMEVBRUFSQm1mNERRYmdCRUFRTE1nQkJtdjREUWY4QUVBUkJtLzREUWY4QkVBUkJuUDREUVo4QkVBUkJuZjREUVFBUUJFR2UvZ05CdUFFUUJFRUJKR3NMTFFCQm4vNERRZjhCRUFSQm9QNERRZjhCRUFSQm9mNERRUUFRQkVHaS9nTkJBQkFFUWFQK0EwRy9BUkFFQ3pnQVFROGtiRUVQSkcxQkR5UnVRUThrYjBFQUpIQkJBQ1J4UVFBa2NrRUFKSE5CL3dBa2RFSC9BQ1IxUVFFa2RrRUJKSGRCQUNSNEMyY0FRUUFrVzBFQUpGeEJBQ1JkUVFFa1hrRUJKRjlCQVNSZ1FRRWtZVUVCSkdKQkFTUmpRUUVrWkVFQkpHVkJBU1JtUVFBa1owRUFKR2hCQUNScFFRQWthaEFJRUFrUUNoQUxRYVQrQTBIM0FCQUVRYVgrQTBIekFSQUVRYWIrQTBIeEFSQUVFQXdMT0FBZ0FFRUJjVUVBUnlSNUlBQkJBbkZCQUVja2VpQUFRUVJ4UVFCSEpIc2dBRUVJY1VFQVJ5UjhJQUJCRUhGQkFFY2tmU0FBSkg0TFBRQWdBRUVCY1VFQVJ5Ui9JQUJCQW5GQkFFY2tnQUVnQUVFRWNVRUFSeVNCQVNBQVFRaHhRUUJISklJQklBQkJFSEZCQUVja2d3RWdBQ1NFQVF0ZEFFRUFKSVVCUVFBa2hnRkJBQ1NIQVVFQUpJZ0JRUUFraVFGQkFDU0tBVUVBSklzQlFRQWtqQUVqT2dSQVFZVCtBMEVlRUFSQm9EMGtoZ0VGUVlUK0EwR3JBUkFFUWN6WEFpU0dBUXRCaC80RFFmZ0JFQVJCK0FFa2lnRUxRZ0JCQUNTTkFVRUFKSTRCSXpvRVFFR0MvZ05CL0FBUUJFRUFKSThCUVFBa2tBRkJBQ1NSQVFWQmd2NERRZjRBRUFSQkFDU1BBVUVCSkpBQlFRQWtrUUVMQy9ZQkFRSi9RY01DRUFFaUFVSEFBVVlpQUFSL0lBQUZJQUZCZ0FGR0l5OGlBQ0FBR3dzRVFFRUJKRG9GUVFBa09nc1FBaEFERUFVUUJoQUhFQTFCQUJBT1FmLy9BeU4rRUFSQjRRRVFEMEdQL2dNamhBRVFCQkFRRUJFak9nUkFRZkQrQTBINEFSQUVRYy8rQTBIK0FSQUVRYzMrQTBIK0FCQUVRWUQrQTBIUEFSQUVRWS8rQTBIaEFSQUVRZXorQTBIK0FSQUVRZlgrQTBHUEFSQUVCVUh3L2dOQi93RVFCRUhQL2dOQi93RVFCRUhOL2dOQi93RVFCRUdBL2dOQnp3RVFCRUdQL2dOQjRRRVFCQXRCQUNRdFFZQ28xcmtISkpJQlFRQWtrd0ZCQUNTVUFVR0FxTmE1QnlTVkFVRUFKSllCUVFBa2x3RUxyZ0VBSUFCQkFFb0VRRUVCSkM0RlFRQWtMZ3NnQVVFQVNnUkFRUUVrTHdWQkFDUXZDeUFDUVFCS0JFQkJBU1F3QlVFQUpEQUxJQU5CQUVvRVFFRUJKREVGUVFBa01Rc2dCRUVBU2dSQVFRRWtNZ1ZCQUNReUN5QUZRUUJLQkVCQkFTUXpCVUVBSkRNTElBWkJBRW9FUUVFQkpEUUZRUUFrTkFzZ0IwRUFTZ1JBUVFFa05RVkJBQ1ExQ3lBSVFRQktCRUJCQVNRMkJVRUFKRFlMSUFsQkFFb0VRRUVCSkRjRlFRQWtOd3NRRWdzTUFDTXRCRUJCQVE4TFFRQUxzZ0VBUVlBSUl6ODZBQUJCZ1FnalFEb0FBRUdDQ0NOQk9nQUFRWU1JSTBJNkFBQkJoQWdqUXpvQUFFR0ZDQ05FT2dBQVFZWUlJMFU2QUFCQmh3Z2pSam9BQUVHSUNDTkhPd0VBUVlvSUkwZzdBUUJCakFnalNUWUNBQ05LQkVCQmtRaEJBVG9BQUFWQmtRaEJBRG9BQUFzalN3UkFRWklJUVFFNkFBQUZRWklJUVFBNkFBQUxJMHdFUUVHVENFRUJPZ0FBQlVHVENFRUFPZ0FBQ3lOTkJFQkJsQWhCQVRvQUFBVkJsQWhCQURvQUFBc0xyQUVBUWNnSkl6ZzdBUUJCeWdralBEc0JBQ05PQkVCQnpBbEJBVG9BQUFWQnpBbEJBRG9BQUFzalR3UkFRYzBKUVFFNkFBQUZRYzBKUVFBNkFBQUxJMUFFUUVIT0NVRUJPZ0FBQlVIT0NVRUFPZ0FBQ3lOUkJFQkJ6d2xCQVRvQUFBVkJ6d2xCQURvQUFBc2pVZ1JBUWRBSlFRRTZBQUFGUWRBSlFRQTZBQUFMSTFNRVFFSFJDVUVCT2dBQUJVSFJDVUVBT2dBQUN5TTVCRUJCMGdsQkFUb0FBQVZCMGdsQkFEb0FBQXNMU3dCQitna2poUUUyQWdCQi9na2poZ0UyQWdBaml3RUVRRUdDQ2tFQk9nQUFCVUdDQ2tFQU9nQUFDeU9NQVFSQVFZVUtRUUU2QUFBRlFZVUtRUUE2QUFBTFFZWCtBeU9IQVJBRUMzZ0FJNXNCQkVCQjNncEJBVG9BQUFWQjNncEJBRG9BQUF0QjN3b2puQUUyQWdCQjR3b2puUUUyQWdCQjV3b2puZ0UyQWdCQjdBb2pud0UyQWdCQjhRb2pvQUU2QUFCQjhnb2pvUUU2QUFBam9nRUVRRUgzQ2tFQk9nQUFCVUgzQ2tFQU9nQUFDMEg0Q2lPakFUWUNBRUg5Q2lPa0FUc0JBQXRQQUNPbEFRUkFRWkFMUVFFNkFBQUZRWkFMUVFBNkFBQUxRWkVMSTZZQk5nSUFRWlVMSTZjQk5nSUFRWmtMSTZnQk5nSUFRWjRMSTZrQk5nSUFRYU1MSTZvQk9nQUFRYVFMSTZzQk9nQUFDMFlBSTdBQkJFQkI5QXRCQVRvQUFBVkI5QXRCQURvQUFBdEI5UXNqc1FFMkFnQkIrUXNqc2dFMkFnQkIvUXNqc3dFMkFnQkJnZ3dqdEFFMkFnQkJod3dqdFFFN0FRQUxvd0VBRUJWQnNnZ2pWVFlDQUVHMkNDT1lBVG9BQUVIRS9nTWpWaEFFSTVrQkJFQkI1QWhCQVRvQUFBVkI1QWhCQURvQUFBc2ptZ0VFUUVIbENFRUJPZ0FBQlVIbENFRUFPZ0FBQ3hBV0VCZEJyQW9qWnpZQ0FFR3dDaU5vT2dBQVFiRUtJMms2QUFBUUdCQVpJNndCQkVCQndndEJBVG9BQUFWQndndEJBRG9BQUF0Qnd3c2pyUUUyQWdCQnh3c2pyZ0UyQWdCQnl3c2pyd0U3QVFBUUdrRUFKQzBMcmdFQVFZQUlMUUFBSkQ5QmdRZ3RBQUFrUUVHQ0NDMEFBQ1JCUVlNSUxRQUFKRUpCaEFndEFBQWtRMEdGQ0MwQUFDUkVRWVlJTFFBQUpFVkJod2d0QUFBa1JrR0lDQzhCQUNSSFFZb0lMd0VBSkVoQmpBZ29BZ0FrU1FKL1FRRkJrUWd0QUFCQkFFb05BQnBCQUFza1NnSi9RUUZCa2dndEFBQkJBRW9OQUJwQkFBc2tTd0ovUVFGQmt3Z3RBQUJCQUVvTkFCcEJBQXNrVEFKL1FRRkJsQWd0QUFCQkFFb05BQnBCQUFza1RRdGNBUUYvUVFBa1ZVRUFKRlpCeFA0RFFRQVFCRUhCL2dNUUFVRjhjU0VCUVFBa21BRkJ3ZjRESUFFUUJDQUFCRUFDUUVFQUlRQURRQ0FBUVlDSkhVNE5BU0FBUVlDUUJHcEIvd0U2QUFBZ0FFRUJhaUVBREFBQUN3QUxDd3VJQVFFQmZ5TzJBU0VCSUFCQmdBRnhRUUJISkxZQklBQkJ3QUJ4UVFCSEpMY0JJQUJCSUhGQkFFY2t1QUVnQUVFUWNVRUFSeVM1QVNBQVFRaHhRUUJISkxvQklBQkJCSEZCQUVja3V3RWdBRUVDY1VFQVJ5UzhBU0FBUVFGeFFRQkhKTDBCSTdZQlJTQUJJQUViQkVCQkFSQWRDeUFCUlNJQUJIOGp0Z0VGSUFBTEJFQkJBQkFkQ3dzK0FBSi9RUUZCNUFndEFBQkJBRW9OQUJwQkFBc2ttUUVDZjBFQlFlVUlMUUFBUVFCS0RRQWFRUUFMSkpvQlFmLy9BeEFCRUE1QmovNERFQUVRRHd1bEFRQkJ5QWt2QVFBa09FSEtDUzhCQUNROEFuOUJBVUhNQ1MwQUFFRUFTZzBBR2tFQUN5Uk9BbjlCQVVITkNTMEFBRUVBU2cwQUdrRUFDeVJQQW45QkFVSE9DUzBBQUVFQVNnMEFHa0VBQ3lSUUFuOUJBVUhQQ1MwQUFFRUFTZzBBR2tFQUN5UlJBbjlCQVVIUUNTMEFBRUVBU2cwQUdrRUFDeVJTQW45QkFVSFJDUzBBQUVFQVNnMEFHa0VBQ3lSVEFuOUJBVUhTQ1MwQUFFRUFTZzBBR2tFQUN5UTVDMXNBUWZvSktBSUFKSVVCUWY0SktBSUFKSVlCQW45QkFVR0NDaTBBQUVFQVNnMEFHa0VBQ3lTTEFRSi9RUUZCaFFvdEFBQkJBRW9OQUJwQkFBc2tqQUZCaGY0REVBRWtod0ZCaHY0REVBRWtpQUZCaC80REVBRWtpZ0VMQmdCQkFDUnFDM1lBQW45QkFVSGVDaTBBQUVFQVNnMEFHa0VBQ3lTYkFVSGZDaWdDQUNTY0FVSGpDaWdDQUNTZEFVSG5DaWdDQUNTZUFVSHNDaWdDQUNTZkFVSHhDaTBBQUNTZ0FVSHlDaTBBQUNTaEFRSi9RUUZCOXdvdEFBQkJBRW9OQUJwQkFBc2tvZ0ZCK0Fvb0FnQWtvd0ZCL1FvdkFRQWtwQUVMVGdBQ2YwRUJRWkFMTFFBQVFRQktEUUFhUVFBTEpLVUJRWkVMS0FJQUpLWUJRWlVMS0FJQUpLY0JRWmtMS0FJQUpLZ0JRWjRMS0FJQUpLa0JRYU1MTFFBQUpLb0JRYVFMTFFBQUpLc0JDMFVBQW45QkFVSDBDeTBBQUVFQVNnMEFHa0VBQ3lTd0FVSDFDeWdDQUNTeEFVSDVDeWdDQUNTeUFVSDlDeWdDQUNTekFVR0NEQ2dDQUNTMEFVR0hEQzhCQUNTMUFRdlFBUUVCZnhBY1FiSUlLQUlBSkZWQnRnZ3RBQUFrbUFGQnhQNERFQUVrVmtIQS9nTVFBUkFlRUI5QmdQNERFQUZCL3dGekpMNEJJNzRCSWdCQkVIRkJBRWNrdndFZ0FFRWdjVUVBUnlUQUFSQWdFQ0ZCckFvb0FnQWtaMEd3Q2kwQUFDUm9RYkVLTFFBQUpHbEJBQ1JxRUNNUUpBSi9RUUZCd2dzdEFBQkJBRW9OQUJwQkFBc2tyQUZCd3dzb0FnQWtyUUZCeHdzb0FnQWtyZ0ZCeXdzdkFRQWtyd0VRSlVFQUpDMUJnS2pXdVFja2tnRkJBQ1NUQVVFQUpKUUJRWUNvMXJrSEpKVUJRUUFrbGdGQkFDU1hBUXNNQUNNNkJFQkJBUThMUVFBTEJRQWpsUUVMQlFBamxnRUxCUUFqbHdFTDJBSUJCWDhDZndKL0lBRkJBRW9pQlFSQUlBQkJDRW9oQlFzZ0JRc0VRQ1BDQVNBRVJpRUZDeUFGQ3dSL0k4TUJJQUJHQlNBRkN3UkFRUUFoQlVFQUlRUWdBMEVCYXhBQlFTQnhCRUJCQVNFRkN5QURFQUZCSUhFRVFFRUJJUVFMUVFBaEF3TkFJQU5CQ0VnRVFFRUhJQU5ySUFNZ0JDQUZSeHNpQXlBQWFrR2dBVXdFUUNBQVFRZ2dBMnRySVFjZ0FDQURhaUFCUWFBQmJHcEJBMnhCZ01rRmFpRUpRUUFoQmdOQUlBWkJBMGdFUUNBQUlBTnFJQUZCb0FGc2FrRURiRUdBeVFWcUlBWnFJQVlnQ1dvdEFBQTZBQUFnQmtFQmFpRUdEQUVMQ3lBQUlBTnFJQUZCb0FGc2FrR0FrUVJxSUFGQm9BRnNJQWRxUVlDUkJHb3RBQUFpQmtFRGNTSUhRUVJ5SUFjZ0JrRUVjUnM2QUFBZ0NFRUJhaUVJQ3lBRFFRRnFJUU1NQVFzTEJTQUVKTUlCQ3lBQUk4TUJUZ1JBSUFCQkNHb2t3d0VnQUNBQ1FRaHZJZ1JJQkVBand3RWdCR29rd3dFTEN5QUlDemdCQVg4Z0FFR0FrQUpHQkVBZ0FVR0FBV29oQWlBQlFZQUJjUVJBSUFGQmdBRnJJUUlMSUFKQkJIUWdBR29QQ3lBQlFRUjBJQUJxQzBvQUlBQkJBM1FnQVVFQmRHb2lBRUVCYWtFL2NTSUJRVUJySUFFZ0FodEJnSkFFYWkwQUFDRUJJQUJCUDNFaUFFRkFheUFBSUFJYlFZQ1FCR290QUFBZ0FVSC9BWEZCQ0hSeUMxRUFJQUpGQkVBZ0FSQUJJQUJCQVhSMVFRTnhJUUFMUWZJQklRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3RCb0FFaEFRd0NDMEhZQUNFQkRBRUxRUWdoQVFzZ0FRdmhBZ0VIZnlBQklBQVFMQ0FGUVFGMGFpSUFRWUNRZm1vZ0FrRUJjVUVOZENJQmFpMEFBQ0VSSUFCQmdaQithaUFCYWkwQUFDRVNJQU1oQUFOQUlBQWdCRXdFUUNBQUlBTnJJQVpxSWcwZ0NFZ0VRRUVISUFCcklRVWdDMEVBU0NJQ0JIOGdBZ1VnQzBFZ2NVVUxJUUZCQUNFQ0FuOUJBU0FGSUFBZ0FSc2lBWFFnRW5FRVFFRUNJUUlMSUFKQkFXb0xJQUpCQVNBQmRDQVJjUnNoQWlBTFFRQk9CSDhnQzBFSGNTQUNRUUFRTFNJRlFSOXhRUU4wSVE0Z0JVSGdCM0ZCQlhWQkEzUWhBU0FGUVlENEFYRkJDblZCQTNRRklBSkJ4LzRESUE4Z0QwRUFUQnNpRHlBS0VDNGlCU0VPSUFVaUFRc2hCU0FISUFoc0lBMXFRUU5zSUFscUloQWdEam9BQUNBUVFRRnFJQUU2QUFBZ0VFRUNhaUFGT2dBQUlBZEJvQUZzSUExcVFZQ1JCR29nQWtFRGNTSUJRUVJ5SUFFZ0MwR0FBWEZCQUVkQkFDQUxRUUJPR3hzNkFBQWdERUVCYWlFTUN5QUFRUUZxSVFBTUFRc0xJQXdMZmdFRGZ5QURRUWh2SVFNZ0FFVUVRQ0FDSUFKQkNHMUJBM1JySVFjTFFhQUJJQUJyUVFjZ0FFRUlha0dnQVVvYklRbEJmeUVDSXpvRVFDQUVRWURRZm1vdEFBQWlBa0VJY1FSQVFRRWhDQXNnQWtIQUFIRUVRRUVISUFOcklRTUxDeUFHSUFVZ0NDQUhJQWtnQXlBQUlBRkJvQUZCZ01rRlFRQWdBaEF2QzZZQ0FDQUZJQVlRTENFR0lBTkJDRzhoQXlBRVFZRFFmbW90QUFBaUJFSEFBSEVFZjBFSElBTnJCU0FEQzBFQmRDQUdhaUlEUVlDUWZtcEJBVUVBSUFSQkNIRWJRUUZ4UVExMElnVnFMUUFBSVFZZ0EwR0JrSDVxSUFWcUxRQUFJUVVnQWtFSWJ5RURRUUFoQWlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxSUFSQkIzRUNmMEVCSUFOQkJ5QURheUFFUVNCeEd5SURkQ0FGY1FSQVFRSWhBZ3NnQWtFQmFnc2dBa0VCSUFOMElBWnhHeUlDUVFBUUxTSURRUjl4UVFOME9nQUFJQUZCb0FGc0lBQnFRUU5zUVlISkJXb2dBMEhnQjNGQkJYVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnc2tGYWlBRFFZRDRBWEZCQ25WQkEzUTZBQUFnQVVHZ0FXd2dBR3BCZ0pFRWFpQUNRUU54SWdCQkJISWdBQ0FFUVlBQmNSczZBQUFMdFFFQUlBUWdCUkFzSUFOQkNHOUJBWFJxSWdSQmdKQithaTBBQUNFRlFRQWhBeUFCUWFBQmJDQUFha0VEYkVHQXlRVnFBbjhnQkVHQmtINXFMUUFBUVFGQkJ5QUNRUWh2YXlJQ2RIRUVRRUVDSVFNTElBTkJBV29MSUFOQkFTQUNkQ0FGY1JzaUEwSEgvZ05CQUJBdUlnSTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdja0ZhaUFDT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUxKQldvZ0Fqb0FBQ0FCUWFBQmJDQUFha0dBa1FScUlBTkJBM0U2QUFBTDFRRUJCbjhnQTBFRGRTRUxBMEFnQkVHZ0FVZ0VRQ0FFSUFWcUlnWkJnQUpPQkVBZ0JrR0FBbXNoQmdzZ0MwRUZkQ0FDYWlBR1FRTjFhaUlKUVlDUWZtb3RBQUFoQ0VFQUlRb2pOZ1JBSUFRZ0FDQUdJQWtnQ0JBcklnZEJBRW9FUUVFQklRb2dCMEVCYXlBRWFpRUVDd3NnQ2tVak5TSUhJQWNiQkVBZ0JDQUFJQVlnQXlBSklBRWdDQkF3SWdkQkFFb0VRQ0FIUVFGcklBUnFJUVFMQlNBS1JRUkFJem9FUUNBRUlBQWdCaUFESUFrZ0FTQUlFREVGSUFRZ0FDQUdJQU1nQVNBSUVESUxDd3NnQkVFQmFpRUVEQUVMQ3dzckFRRi9JMWNoQXlBQUlBRWdBaU5ZSUFCcUlnQkJnQUpPQkg4Z0FFR0FBbXNGSUFBTFFRQWdBeEF6Q3pBQkEzOGpXU0VESUFBaldpSUVTQVJBRHdzZ0EwRUhheUlEUVg5c0lRVWdBQ0FCSUFJZ0FDQUVheUFESUFVUU13dkVCUUVQZndKQVFTY2hDUU5BSUFsQkFFZ05BU0FKUVFKMElnUkJnUHdEYWhBQklRSWdCRUdCL0FOcUVBRWhDaUFFUVlMOEEyb1FBU0VESUFKQkVHc2hBaUFLUVFocklRcEJDQ0VGSUFFRVFFRVFJUVVnQTBFQ2IwRUJSZ1IvSUFOQkFXc0ZJQU1MSVFNTElBQWdBazRpQmdSQUlBQWdBaUFGYWtnaEJnc2dCZ1JBSUFSQmcvd0RhaEFCSWdaQmdBRnhRUUJISVFzZ0JrRWdjVUVBUnlFT1FZQ0FBaUFERUN3Z0FDQUNheUlDSUFWclFYOXNRUUZySUFJZ0JrSEFBSEViUVFGMGFpSURRWUNRZm1wQkFVRUFJQVpCQ0hGQkFFY2pPaUlDSUFJYkcwRUJjVUVOZENJQ2FpMEFBQ0VQSUFOQmdaQithaUFDYWkwQUFDRVFRUWNoQlFOQUlBVkJBRTRFUUVFQUlRZ0NmMEVCSUFVaUFrRUhhMEYvYkNBQ0lBNGJJZ0owSUJCeEJFQkJBaUVJQ3lBSVFRRnFDeUFJUVFFZ0FuUWdEM0ViSWdnRVFFRUhJQVZySUFwcUlnZEJBRTRpQWdSQUlBZEJvQUZNSVFJTElBSUVRRUVBSVF4QkFDRU5RUUZCQUNPOUFVVWpPaUlESUFNYkd5SUNSUVJBSUFCQm9BRnNJQWRxUVlDUkJHb3RBQUFpQTBFRGNTSUVRUUJLSUFzZ0N4c0VRRUVCSVF3RklBTkJCSEZCQUVjak9pSURJQU1iSWdNRVFDQUVRUUJLSVFNTFFRRkJBQ0FER3lFTkN3c2dBa1VFUUNBTVJTSUVCSDhnRFVVRklBUUxJUUlMSUFJRVFDTTZCRUFnQUVHZ0FXd2dCMnBCQTJ4QmdNa0ZhaUFHUVFkeElBaEJBUkF0SWdSQkgzRkJBM1E2QUFBZ0FFR2dBV3dnQjJwQkEyeEJnY2tGYWlBRVFlQUhjVUVGZFVFRGREb0FBQ0FBUWFBQmJDQUhha0VEYkVHQ3lRVnFJQVJCZ1BnQmNVRUtkVUVEZERvQUFBVWdBRUdnQVd3Z0IycEJBMnhCZ01rRmFpQUlRY24rQTBISS9nTWdCa0VRY1J0QkFCQXVJZ002QUFBZ0FFR2dBV3dnQjJwQkEyeEJnY2tGYWlBRE9nQUFJQUJCb0FGc0lBZHFRUU5zUVlMSkJXb2dBem9BQUFzTEN3c2dCVUVCYXlFRkRBRUxDd3NnQ1VFQmF5RUpEQUFBQ3dBTEMyWUJBbjlCZ0pBQ0lRRkJnSUFDUVlDUUFpTzVBUnNoQVNNNkk3MEJJem9iQkVCQmdMQUNJUUlnQUNBQlFZQzRBa0dBc0FJanVnRWJFRFFMSTdnQkJFQkJnTEFDSVFJZ0FDQUJRWUM0QWtHQXNBSWp0d0ViRURVTEk3d0JCRUFnQUNPN0FSQTJDd3NsQVFGL0FrQURRQ0FBUVpBQlN3MEJJQUJCL3dGeEVEY2dBRUVCYWlFQURBQUFDd0FMQzBZQkFuOERRQ0FCUVpBQlRrVUVRRUVBSVFBRFFDQUFRYUFCU0FSQUlBRkJvQUZzSUFCcVFZQ1JCR3BCQURvQUFDQUFRUUZxSVFBTUFRc0xJQUZCQVdvaEFRd0JDd3NMSFFFQmYwR1AvZ01RQVVFQklBQjBjaUlCSklRQlFZLytBeUFCRUFRTEN3QkJBU1NBQVVFQkVEb0xSUUVDZjBHVS9nTVFBVUg0QVhFaEFVR1QvZ01nQUVIL0FYRWlBaEFFUVpUK0F5QUJJQUJCQ0hVaUFISVFCQ0FDSk04QklBQWswQUVqendFajBBRkJDSFJ5Sk5FQkMyWUJBbjhqcEFFaUFTUE5BWFVoQUNBQklBQnJJQUFnQVdvanpnRWJJZ0JCL3c5TUlnRUVmeVBOQVVFQVNnVWdBUXNFUUNBQUpLUUJJQUFRUENPa0FTSUJJODBCZFNFQUlBRWdBR3NnQUNBQmFpUE9BUnNoQUFzZ0FFSC9EMG9FUUVFQUpKc0JDd3NzQUNPakFVRUJheVNqQVNPakFVRUFUQVJBSTh3QkpLTUJJOHdCUVFCS0k2SUJJNklCR3dSQUVEMExDd3RiQVFGL0k1MEJRUUZySkowQkk1MEJRUUJNQkVBajBnRWtuUUVqblFFRVFDT2ZBVUVQU0NQVEFTUFRBUnNFUUNPZkFVRUJhaVNmQVFVajB3RkZJZ0FFUUNPZkFVRUFTaUVBQ3lBQUJFQWpud0ZCQVdza253RUxDd3NMQzFzQkFYOGpwd0ZCQVdza3B3RWpwd0ZCQUV3RVFDUFVBU1NuQVNPbkFRUkFJNmtCUVE5SUk5VUJJOVVCR3dSQUk2a0JRUUZxSktrQkJTUFZBVVVpQUFSQUk2a0JRUUJLSVFBTElBQUVRQ09wQVVFQmF5U3BBUXNMQ3dzTFd3RUJmeU95QVVFQmF5U3lBU095QVVFQVRBUkFJOVlCSkxJQkk3SUJCRUFqdEFGQkQwZ2oxd0VqMXdFYkJFQWp0QUZCQVdva3RBRUZJOWNCUlNJQUJFQWp0QUZCQUVvaEFBc2dBQVJBSTdRQlFRRnJKTFFCQ3dzTEN3dU9CZ0FqWnlBQWFpUm5JMmNqUGdSL1FZQ0FBUVZCZ01BQUMwNEVRQ05uSXo0RWYwR0FnQUVGUVlEQUFBdHJKR2NDUUFKQUFrQUNRQUpBSTJraUFBUkFJQUJCQW1zT0JnRUZBZ1VEQkFVTEk1NEJRUUJLSWdBRWZ5UElBUVVnQUFzRVFDT2VBVUVCYXlTZUFRc2puZ0ZGQkVCQkFDU2JBUXNqcUFGQkFFb2lBQVIvSThrQkJTQUFDd1JBSTZnQlFRRnJKS2dCQ3lPb0FVVUVRRUVBSktVQkN5T3VBVUVBU2lJQUJIOGp5Z0VGSUFBTEJFQWpyZ0ZCQVdza3JnRUxJNjRCUlFSQVFRQWtyQUVMSTdNQlFRQktJZ0FFZnlQTEFRVWdBQXNFUUNPekFVRUJheVN6QVFzanN3RkZCRUJCQUNTd0FRc01CQXNqbmdGQkFFb2lBQVIvSThnQkJTQUFDd1JBSTU0QlFRRnJKSjRCQ3lPZUFVVUVRRUVBSkpzQkN5T29BVUVBU2lJQUJIOGp5UUVGSUFBTEJFQWpxQUZCQVdza3FBRUxJNmdCUlFSQVFRQWtwUUVMSTY0QlFRQktJZ0FFZnlQS0FRVWdBQXNFUUNPdUFVRUJheVN1QVFzanJnRkZCRUJCQUNTc0FRc2pzd0ZCQUVvaUFBUi9JOHNCQlNBQUN3UkFJN01CUVFGckpMTUJDeU96QVVVRVFFRUFKTEFCQ3hBK0RBTUxJNTRCUVFCS0lnQUVmeVBJQVFVZ0FBc0VRQ09lQVVFQmF5U2VBUXNqbmdGRkJFQkJBQ1NiQVFzanFBRkJBRW9pQUFSL0k4a0JCU0FBQ3dSQUk2Z0JRUUZySktnQkN5T29BVVVFUUVFQUpLVUJDeU91QVVFQVNpSUFCSDhqeWdFRklBQUxCRUFqcmdGQkFXc2tyZ0VMSTY0QlJRUkFRUUFrckFFTEk3TUJRUUJLSWdBRWZ5UExBUVVnQUFzRVFDT3pBVUVCYXlTekFRc2pzd0ZGQkVCQkFDU3dBUXNNQWdzam5nRkJBRW9pQUFSL0k4Z0JCU0FBQ3dSQUk1NEJRUUZySko0QkN5T2VBVVVFUUVFQUpKc0JDeU9vQVVFQVNpSUFCSDhqeVFFRklBQUxCRUFqcUFGQkFXc2txQUVMSTZnQlJRUkFRUUFrcFFFTEk2NEJRUUJLSWdBRWZ5UEtBUVVnQUFzRVFDT3VBVUVCYXlTdUFRc2pyZ0ZGQkVCQkFDU3NBUXNqc3dGQkFFb2lBQVIvSThzQkJTQUFDd1JBSTdNQlFRRnJKTE1CQ3lPekFVVUVRRUVBSkxBQkN4QStEQUVMRUQ4UVFCQkJDeU5wUVFGcUpHa2phVUVJVGdSQVFRQWthUXRCQVE4TFFRQUxnd0VCQVg4Q1FBSkFBa0FDUUNBQVFRRkhCRUFnQUNJQlFRSkdEUUVnQVVFRFJnMENJQUZCQkVZTkF3d0VDeU53STlrQlJ3UkFJOWtCSkhCQkFROExRUUFQQ3lOeEk5b0JSd1JBSTlvQkpIRkJBUThMUVFBUEN5TnlJOXNCUndSQUk5c0JKSEpCQVE4TFFRQVBDeU56STl3QlJ3UkFJOXdCSkhOQkFROExRUUFQQzBFQUMxVUFBa0FDUUFKQUlBQkJBVWNFUUNBQVFRSkdEUUVnQUVFRFJnMENEQU1MUVFFZ0FYUkJnUUZ4UVFCSER3dEJBU0FCZEVHSEFYRkJBRWNQQzBFQklBRjBRZjRBY1VFQVJ3OExRUUVnQVhSQkFYRkJBRWNMaWdFQkFYOGpuQUVnQUdza25BRWpuQUZCQUV3RVFDT2NBU0lCUVI5MUlRQkJnQkFqMFFGclFRSjBKSndCSXo0RVFDT2NBVUVCZENTY0FRc2puQUVnQUNBQmFpQUFjMnNrbkFFam9RRkJBV29rb1FFam9RRkJDRTRFUUVFQUpLRUJDd3NqMlFFam13RWlBQ0FBR3dSL0k1OEJCVUVQRHdzajRBRWpvUUVRUkFSL1FRRUZRWDhMYkVFUGFndUtBUUVCZnlPbUFTQUFheVNtQVNPbUFVRUFUQVJBSTZZQklnRkJIM1VoQUVHQUVDUGhBV3RCQW5Ra3BnRWpQZ1JBSTZZQlFRRjBKS1lCQ3lPbUFTQUFJQUZxSUFCemF5U21BU09yQVVFQmFpU3JBU09yQVVFSVRnUkFRUUFrcXdFTEN5UGFBU09sQVNJQUlBQWJCSDhqcVFFRlFROFBDeVBpQVNPckFSQkVCSDlCQVFWQmZ3dHNRUTlxQzVrQ0FRSi9JNjBCSUFCckpLMEJJNjBCUVFCTUJFQWpyUUVpQWtFZmRTRUFRWUFRSStNQmEwRUJkQ1N0QVNNK0JFQWpyUUZCQVhRa3JRRUxJNjBCSUFBZ0Ftb2dBSE5ySkswQkk2OEJRUUZxSks4Qkk2OEJRU0JPQkVCQkFDU3ZBUXNMUVFBaEFpUGtBU0VBSTlzQkk2d0JJZ0VnQVJzRVFDTnJCRUJCblA0REVBRkJCWFZCRDNFaUFDVGtBVUVBSkdzTEJVRVBEd3NqcndGQkFtMUJzUDREYWhBQklRRWpyd0ZCQW04RWZ5QUJRUTl4QlNBQlFRUjFRUTl4Q3lFQkFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFTQUFRUUpHRFFJTUF3c2dBVUVFZFNFQkRBTUxRUUVoQWd3Q0N5QUJRUUYxSVFGQkFpRUNEQUVMSUFGQkFuVWhBVUVFSVFJTElBSkJBRW9FZnlBQklBSnRCVUVBQzBFUGFndXJBUUVCZnlPeEFTQUFheVN4QVNPeEFVRUFUQVJBSTdFQklRQWo1UUVqNWdGMElnRkJBWFFnQVNNK0d5U3hBU094QVNBQVFSOTFJZ0VnQUNBQmFuTnJKTEVCSTdVQklnQkJBWEVoQVNBQVFRRjFJZ0FrdFFFanRRRWdBU0FBUVFGeGN5SUJRUTUwY2lTMUFTUG5BUVJBSTdVQlFiOS9jU1MxQVNPMUFTQUJRUVowY2lTMUFRc0xJOXdCSTdBQklnQWdBQnNFZnlPMEFRVkJEdzhMUVg5QkFTTzFBVUVCY1J0c1FROXFDekFBSUFCQlBFWUVRRUgvQUE4TElBQkJQR3RCb0kwR2JDQUJiRUVJYlVHZ2pRWnRRVHhxUWFDTkJteEJqUEVDYlF1Y0FRRUJmMEVBSkhZZ0FFRVBJMTRiSWdRZ0FXb2dCRUVQYWlOZkd5SUVJQUpxSUFSQkQyb2pZQnNoQkNBRElBSWdBU0FBUVE4alloc2lBR29nQUVFUGFpTmpHeUlBYWlBQVFROXFJMlFiSWdCcUlBQkJEMm9qWlJzaEFFRUFKSGRCQUNSNElBTWdCR29nQkVFUGFpTmhHeU5jUVFGcUVFa2hBU0FBSTExQkFXb1FTU0VBSUFFa2RDQUFKSFVnQUVIL0FYRWdBVUgvQVhGQkNIUnlDOE1EQVFWL0FuOGoyQUVnQUdvazJBRkJBQ09jQVNQWUFXdEJBRW9OQUJwQkFRc2lBVVVFUUVFQkVFTWhBUXNDZnlQZEFTQUFhaVRkQVVFQUk2WUJJOTBCYTBFQVNnMEFHa0VCQ3lJRVJRUkFRUUlRUXlFRUN3Si9JOTRCSUFCcUpONEJJNjBCSTk0QmEwRUFTaUlDQkVBamEwVWhBZ3RCQUNBQ0RRQWFRUUVMSWdKRkJFQkJBeEJESVFJTEFuOGozd0VnQUdvazN3RkJBQ094QVNQZkFXdEJBRW9OQUJwQkFRc2lCVVVFUUVFRUVFTWhCUXNnQVFSQUk5Z0JJUU5CQUNUWUFTQURFRVVrYkFzZ0JBUkFJOTBCSVFOQkFDVGRBU0FERUVZa2JRc2dBZ1JBSTk0QklRTkJBQ1RlQVNBREVFY2tiZ3NnQlFSQUk5OEJJUU5CQUNUZkFTQURFRWdrYndzQ2Z5QUJJQVFnQVJzaUFVVUVRQ0FDSVFFTElBRkZDd1JBSUFVaEFRc2dBUVJBUVFFa2VBc2phQ1BvQVNBQWJHb2thQ05vUVlDQWdBUkJnSUNBQWlNK0cwNEVRQ05vUVlDQWdBUkJnSUNBQWlNK0cyc2thQ040SWdBamRpQUFHeUlCUlFSQUkzY2hBUXNnQVFSQUkyd2piU051STI4UVNob0xJMm9pQVVFQmRFR0FtY0VBYWlJQUkzUkJBbW82QUFBZ0FFRUJhaU4xUVFKcU9nQUFJQUZCQVdva2FpTnFJK2tCUVFKdFFRRnJUZ1JBSTJwQkFXc2thZ3NMQzV3REFRVi9JQUFRUlNFQ0lBQVFSaUVCSUFBUVJ5RURJQUFRU0NFRUlBSWtiQ0FCSkcwZ0F5UnVJQVFrYnlOb0krZ0JJQUJzYWlSb0kyaEJnSUNBQkVHQWdJQUNJejRiVGdSQUkyaEJnSUNBQkVHQWdJQUNJejRiYXlSb0lBSWdBU0FESUFRUVNpRUFJMnBCQVhSQmdKbkJBR29pQlNBQVFZRCtBM0ZCQ0hWQkFtbzZBQUFnQlVFQmFpQUFRZjhCY1VFQ2Fqb0FBQ00zQkVBZ0FrRVBRUTlCRHhCS0lRQWpha0VCZEVHQW1TRnFJZ0lnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQUpCQVdvZ0FFSC9BWEZCQW1vNkFBQkJEeUFCUVE5QkR4QktJUUFqYWtFQmRFR0FtU2xxSWdFZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFGQkFXb2dBRUgvQVhGQkFtbzZBQUJCRDBFUElBTkJEeEJLSVFBamFrRUJkRUdBbVRGcUlnRWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBRkJBV29nQUVIL0FYRkJBbW82QUFCQkQwRVBRUThnQkJCS0lRQWpha0VCZEVHQW1UbHFJZ0VnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQUZCQVdvZ0FFSC9BWEZCQW1vNkFBQUxJMnBCQVdva2FpTnFJK2tCUVFKdFFRRnJUZ1JBSTJwQkFXc2thZ3NMQ3g0QkFYOGdBQkJDSVFFZ0FVVWpOQ00wR3dSQUlBQVFTd1VnQUJCTUN3dExBQ05iSXo0RWYwR3VBUVZCMXdBTFNBUkFEd3NEUUNOYkl6NEVmMEd1QVFWQjF3QUxUZ1JBSXo0RWYwR3VBUVZCMXdBTEVFMGpXeU0rQkg5QnJnRUZRZGNBQzJza1d3d0JDd3NMSVFBZ0FFR20vZ05HQkVCQnB2NERFQUZCZ0FGeElRQWdBRUh3QUhJUEMwRi9DNXdCQVFGL0k3NEJJUUFqdndFRVFDQUFRWHR4SUFCQkJISWo2Z0ViSVFBZ0FFRitjU0FBUVFGeUkrc0JHeUVBSUFCQmQzRWdBRUVJY2lQc0FSc2hBQ0FBUVgxeElBQkJBbklqN1FFYklRQUZJOEFCQkVBZ0FFRitjU0FBUVFGeUkrNEJHeUVBSUFCQmZYRWdBRUVDY2lQdkFSc2hBQ0FBUVh0eElBQkJCSElqOEFFYklRQWdBRUYzY1NBQVFRaHlJL0VCR3lFQUN3c2dBRUh3QVhJTHp3SUJBWDhnQUVHQWdBSklCRUJCZnc4TElBQkJnSUFDVGlJQkJIOGdBRUdBd0FKSUJTQUJDd1JBUVg4UEN5QUFRWURBQTA0aUFRUi9JQUJCZ1B3RFNBVWdBUXNFUUNBQVFZQkFhaEFCRHdzZ0FFR0EvQU5PSWdFRWZ5QUFRWi85QTB3RklBRUxCRUFqbUFGQkFrZ0VRRUgvQVE4TFFYOFBDeUFBUWMzK0EwWUVRRUgvQVNFQlFjMytBeEFCUVFGeFJRUkFRZjRCSVFFTEl6NUZCRUFnQVVIL2ZuRWhBUXNnQVE4TElBQkJ4UDREUmdSQUlBQWpWaEFFSTFZUEN5QUFRWkQrQTA0aUFRUi9JQUJCcHY0RFRBVWdBUXNFUUJCT0lBQVFUdzhMSUFCQnNQNERUaUlCQkg4Z0FFRy8vZ05NQlNBQkN3UkFFRTVCZnc4TElBQkJoUDREUmdSQUlBQWpoZ0ZCZ1A0RGNVRUlkU0lCRUFRZ0FROExJQUJCaGY0RFJnUkFJQUFqaHdFUUJDT0hBUThMSUFCQmovNERSZ1JBSTRRQlFlQUJjZzhMSUFCQmdQNERSZ1JBRUZBUEMwRi9DeHNCQVg4Z0FCQlJJZ0ZCZjBZRVFDQUFFQUVQQ3lBQlFmOEJjUXUyQWdFQmZ5TlFCRUFQQ3lBQVFmOC9UQVJBSTFJRWZ5QUJRUkJ4UlFValVndEZCRUFnQVVFUGNTSUNCRUFnQWtFS1JnUkFRUUVrVGdzRlFRQWtUZ3NMQlNBQVFmLy9BRXdFUUNNNVJTSUNCSDhnQWdVZ0FFSC8zd0JNQ3dSQUkxSUVRQ0FCUVE5eEpEZ0xJQUVoQWlOUkJFQWdBa0VmY1NFQ0l6aEI0QUZ4SkRnRkkxTUVRQ0FDUWY4QWNTRUNJemhCZ0FGeEpEZ0ZJemtFUUVFQUpEZ0xDd3NqT0NBQ2NpUTRCU000UWY4QmNVRUJRUUFnQVVFQVNodEIvd0Z4UVFoMGNpUTRDd1VqVWtVaUFnUi9JQUJCLzc4QlRBVWdBZ3NFUUNOUEkxRWlBQ0FBR3dSQUl6aEJIM0VrT0NNNElBRkI0QUZ4Y2lRNER3c2dBVUVQY1NBQlFRTnhJemtiSkR3RkkxSkZJZ0lFZnlBQVFmLy9BVXdGSUFJTEJFQWpVUVJBSUFGQkFYRUVRRUVCSkU4RlFRQWtUd3NMQ3dzTEN3c3NBQ0FBUVFSMVFROXhKUFlCSUFCQkNIRkJBRWNrMHdFZ0FFRUhjU1RTQVNBQVFmZ0JjVUVBU2lUWkFRc3NBQ0FBUVFSMVFROXhKUGNCSUFCQkNIRkJBRWNrMVFFZ0FFRUhjU1RVQVNBQVFmZ0JjVUVBU2lUYUFRc3NBQ0FBUVFSMVFROXhKUGtCSUFCQkNIRkJBRWNrMXdFZ0FFRUhjU1RXQVNBQVFmZ0JjVUVBU2lUY0FRdUJBUUVCZnlBQVFRUjFKT1lCSUFCQkNIRkJBRWNrNXdFZ0FFRUhjU1QrQVFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FqL2dFaUFRUkFJQUZCQVdzT0J3RUNBd1FGQmdjSUMwRUlKT1VCRHd0QkVDVGxBUThMUVNBazVRRVBDMEV3Sk9VQkR3dEJ3QUFrNVFFUEMwSFFBQ1RsQVE4TFFlQUFKT1VCRHd0QjhBQWs1UUVMQzRNQkFRRi9RUUVrbXdFam5nRkZCRUJCd0FBa25nRUxRWUFRSTlFQmEwRUNkQ1NjQVNNK0JFQWpuQUZCQVhRa25BRUxJOUlCSkowQkkvWUJKSjhCSTlFQkpLUUJJOHdCSWdBa293RWdBRUVBU2lJQUJIOGp6UUZCQUVvRklBQUxCRUJCQVNTaUFRVkJBQ1NpQVFzanpRRkJBRW9FUUJBOUN5UFpBVVVFUUVFQUpKc0JDd3RIQUVFQkpLVUJJNmdCUlFSQVFjQUFKS2dCQzBHQUVDUGhBV3RCQW5Ra3BnRWpQZ1JBSTZZQlFRRjBKS1lCQ3lQVUFTU25BU1AzQVNTcEFTUGFBVVVFUUVFQUpLVUJDd3RBQUVFQkpLd0JJNjRCUlFSQVFZQUNKSzRCQzBHQUVDUGpBV3RCQVhRa3JRRWpQZ1JBSTYwQlFRRjBKSzBCQzBFQUpLOEJJOXNCUlFSQVFRQWtyQUVMQzBrQkFYOUJBU1N3QVNPekFVVUVRRUhBQUNTekFRc2o1UUVqNWdGMElnQkJBWFFnQUNNK0d5U3hBU1BXQVNTeUFTUDVBU1MwQVVILy93RWt0UUVqM0FGRkJFQkJBQ1N3QVFzTFZBQWdBRUdBQVhGQkFFY2tZU0FBUWNBQWNVRUFSeVJnSUFCQklIRkJBRWNrWHlBQVFSQnhRUUJISkY0Z0FFRUljVUVBUnlSbElBQkJCSEZCQUVja1pDQUFRUUp4UVFCSEpHTWdBRUVCY1VFQVJ5UmlDNGdGQVFGL0lBQkJwdjREUnlJQ0JFQWpaa1VoQWdzZ0FnUkFRUUFQQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFrR1EvZ05IQkVBZ0FrR1IvZ05yRGhZQ0Jnb09GUU1IQ3c4QkJBZ01FQlVGQ1EwUkVoTVVGUXNnQVVId0FIRkJCSFVrekFFZ0FVRUljVUVBUnlUT0FTQUJRUWR4Sk0wQkRCVUxJQUZCZ0FGeFFRQkhKTnNCREJRTElBRkJCblZCQTNFazRBRWdBVUUvY1NUeUFVSEFBQ1B5QVdza25nRU1Fd3NnQVVFR2RVRURjU1RpQVNBQlFUOXhKUE1CUWNBQUkvTUJheVNvQVF3U0N5QUJKUFFCUVlBQ0kvUUJheVN1QVF3UkN5QUJRVDl4SlBVQlFjQUFJL1VCYXlTekFRd1FDeUFCRUZRTUR3c2dBUkJWREE0TFFRRWtheUFCUVFWMVFROXhKUGdCREEwTElBRVFWZ3dNQ3lBQkpNOEJJODhCSTlBQlFRaDBjaVRSQVF3TEN5QUJKUG9CSS9vQkkvc0JRUWgwY2lUaEFRd0tDeUFCSlB3Qkkvd0JJLzBCUVFoMGNpVGpBUXdKQ3lBQkVGY01DQXNnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVRJQVNBQlFRZHhKTkFCSTg4Qkk5QUJRUWgwY2lUUkFSQllDd3dIQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISk1rQklBRkJCM0VrK3dFaitnRWord0ZCQ0hSeUpPRUJFRmtMREFZTElBRkJnQUZ4QkVBZ0FVSEFBSEZCQUVja3lnRWdBVUVIY1NUOUFTUDhBU1A5QVVFSWRISWs0d0VRV2dzTUJRc2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5VExBUkJiQ3d3RUN5QUJRUVIxUVFkeEpGd2dBVUVIY1NSZFFRRWtkZ3dEQ3lBQkVGeEJBU1IzREFJTElBRkJnQUZ4UVFCSEpHWWdBVUdBQVhGRkJFQUNRRUdRL2dNaEFnTkFJQUpCcHY0RFRnMEJJQUpCQUJBRUlBSkJBV29oQWd3QUFBc0FDd3NNQVF0QkFROExRUUVMUEFFQmZ5QUFRUWgwSVFGQkFDRUFBMEFDUUNBQVFaOEJTZzBBSUFCQmdQd0RhaUFBSUFGcUVBRVFCQ0FBUVFGcUlRQU1BUXNMUVlRRkpNRUJDeU1CQVg4amdRSVFBU0VBSTRJQ0VBRkIvd0Z4SUFCQi93RnhRUWgwY2tIdy93TnhDeWNCQVg4amd3SVFBU0VBSTRRQ0VBRkIvd0Z4SUFCQi93RnhRUWgwY2tId1AzRkJnSUFDYWd1REFRRURmeU02UlFSQUR3c2dBRUdBQVhGRkk4UUJJOFFCR3dSQVFRQWt4QUVqZ0FJUUFVR0FBWEloQUNPQUFpQUFFQVFQQ3hCZklRRVFZQ0VDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKTVFCSUFNa3hRRWdBU1RHQVNBQ0pNY0JJNEFDSUFCQi8zNXhFQVFGSUFFZ0FpQURFR3NqZ0FKQi93RVFCQXNMWWdFRGZ5T0hBaUFBUmlJQ1JRUkFJNFlDSUFCR0lRSUxJQUlFUUNBQVFRRnJJZ01RQVVHL2YzRWlBa0UvY1NJRVFVQnJJQVJCQVVFQUk0WUNJQUJHR3h0QmdKQUVhaUFCT2dBQUlBSkJnQUZ4QkVBZ0F5QUNRUUZxUVlBQmNoQUVDd3NMUEFFQmZ3SkFBa0FDUUFKQUlBQUVRQ0FBSWdGQkFVWU5BU0FCUVFKR0RRSWdBVUVEUmcwRERBUUxRUWtQQzBFRER3dEJCUThMUVFjUEMwRUFDeTBCQVg5QkFTT0tBUkJqSWdKMElBQnhRUUJISWdBRWYwRUJJQUowSUFGeFJRVWdBQXNFUUVFQkR3dEJBQXVSQVFFQ2Z3TkFJQUVnQUVnRVFDQUJRUVJxSVFFamhnRWlBa0VFYWlTR0FTT0dBVUgvL3dOS0JFQWpoZ0ZCZ0lBRWF5U0dBUXNqaVFFRVFDT0xBUVJBSTRnQkpJY0JRUUVrZ1FGQkFoQTZRUUFraXdGQkFTU01BUVVqakFFRVFFRUFKSXdCQ3dzZ0FpT0dBUkJrQkVBamh3RkJBV29raHdFamh3RkIvd0ZLQkVCQkFTU0xBVUVBSkljQkN3c0xEQUVMQ3dzTUFDT0ZBUkJsUVFBa2hRRUxSd0VCZnlPR0FTRUFRUUFraGdGQmhQNERRUUFRQkNPSkFRUi9JQUFqaGdFUVpBVWppUUVMQkVBamh3RkJBV29raHdFamh3RkIvd0ZLQkVCQkFTU0xBVUVBSkljQkN3c0xnQUVCQW44amlRRWhBU0FBUVFSeFFRQkhKSWtCSUFCQkEzRWhBaUFCUlFSQUk0b0JFR01oQUNBQ0VHTWhBU09KQVFSL0k0WUJRUUVnQUhSeEJTT0dBVUVCSUFCMGNVRUFSeUlBQkg4amhnRkJBU0FCZEhFRklBQUxDd1JBSTRjQlFRRnFKSWNCSTRjQlFmOEJTZ1JBUVFFa2l3RkJBQ1NIQVFzTEN5QUNKSW9CQzlJR0FRRi9Ba0FDUUNBQVFjMytBMFlFUUVITi9nTWdBVUVCY1JBRURBRUxJQUJCZ0lBQ1NBUkFJQUFnQVJCVERBRUxJQUJCZ0lBQ1RpSUNCRUFnQUVHQXdBSklJUUlMSUFJTkFTQUFRWURBQTA0aUFnUkFJQUJCZ1B3RFNDRUNDeUFDQkVBZ0FFR0FRR29nQVJBRURBSUxJQUJCZ1B3RFRpSUNCRUFnQUVHZi9RTk1JUUlMSUFJRVFDT1lBVUVDU0EwQkRBSUxJQUJCb1AwRFRpSUNCRUFnQUVILy9RTk1JUUlMSUFJTkFDQUFRWUwrQTBZRVFDQUJRUUZ4UVFCSEpJOEJJQUZCQW5GQkFFY2trQUVnQVVHQUFYRkJBRWNra1FGQkFROExJQUJCa1A0RFRpSUNCRUFnQUVHbS9nTk1JUUlMSUFJRVFCQk9JQUFnQVJCZER3c2dBRUd3L2dOT0lnSUVRQ0FBUWIvK0Ewd2hBZ3NnQWdSQUVFNExJQUJCd1A0RFRpSUNCRUFnQUVITC9nTk1JUUlMSUFJRVFDQUFRY0QrQTBZRVFDQUJFQjRNQXdzZ0FFSEIvZ05HQkVCQndmNERJQUZCK0FGeFFjSCtBeEFCUVFkeGNrR0FBWElRQkF3Q0N5QUFRY1QrQTBZRVFFRUFKRllnQUVFQUVBUU1BZ3NnQUVIRi9nTkdCRUFnQVNUL0FRd0RDeUFBUWNiK0EwWUVRQ0FCRUY0TUF3c0NRQUpBQWtBQ1FDQUFJZ0pCdy80RFJ3UkFJQUpCd3Y0RGF3NEtBUVFFQkFRRUJBUURBZ1FMSUFFa1Z3d0dDeUFCSkZnTUJRc2dBU1JaREFRTElBRWtXZ3dEQ3d3Q0N5T0FBaUFBUmdSQUlBRVFZUXdCQ3lNOUlBQkdJZ0pGQkVBak95QUFSaUVDQ3lBQ0JFQWp4QUVFUUFKL0k4WUJRWUNBQVU0aUFnUkFJOFlCUWYvL0FVd2hBZ3NnQWtVTEJFQWp4Z0ZCZ0tBRFRpSUNCRUFqeGdGQi83OERUQ0VDQ3dzZ0FnMENDd3NnQUNPRkFrNGlBZ1JBSUFBamhnSk1JUUlMSUFJRVFDQUFJQUVRWWd3Q0N5QUFRWVQrQTA0aUFnUkFJQUJCaC80RFRDRUNDeUFDQkVBUVpnSkFBa0FDUUFKQUlBQWlBa0dFL2dOSEJFQWdBa0dGL2dOckRnTUJBZ01FQ3hCbkRBVUxBa0FqaVFFRVFDT01BUTBCSTRzQkJFQkJBQ1NMQVFzTElBRWtod0VMREFVTElBRWtpQUVqakFFamlRRWlBQ0FBR3dSQUk0Z0JKSWNCUVFBa2pBRUxEQVFMSUFFUWFBd0RDd3dDQ3lBQVFZRCtBMFlFUUNBQlFmOEJjeVMrQVNPK0FTSUNRUkJ4UVFCSEpMOEJJQUpCSUhGQkFFY2t3QUVMSUFCQmovNERSZ1JBSUFFUUR3d0NDeUFBUWYvL0EwWUVRQ0FCRUE0TUFndEJBUThMUVFBUEMwRUJDeEVBSUFBZ0FSQnBCRUFnQUNBQkVBUUxDMkFCQTM4RFFBSkFJQU1nQWs0TkFDQUFJQU5xRUZJaEJTQUJJQU5xSVFRRFFDQUVRZisvQWtvRVFDQUVRWUJBYWlFRURBRUxDeUFFSUFVUWFpQURRUUZxSVFNTUFRc0xRU0FoQXlQQkFTQUNRUkJ0UWNBQVFTQWpQaHRzYWlUQkFRdG5BUUYvSThRQlJRUkFEd3NqeGdFanh3RWp4UUVpQUVFUUlBQkJFRWdiSWdBUWF5UEdBU0FBYWlUR0FTUEhBU0FBYWlUSEFTUEZBU0FBYXlURkFTUEZBVUVBVEFSQVFRQWt4QUVqZ0FKQi93RVFCQVVqZ0FJanhRRkJFRzFCQVd0Qi8zNXhFQVFMQzBZQkFuOGovd0VoQXdKL0lBQkZJZ0pGQkVBZ0FFRUJSaUVDQ3lBQ0N3Ui9JMVlnQTBZRklBSUxCRUFnQVVFRWNpSUJRY0FBY1FSQUVEc0xCU0FCUVh0eElRRUxJQUVMZ2dJQkEzOGp0Z0ZGQkVBUEN5T1lBU0VBSUFBalZpSUNRWkFCVGdSL1FRRUZJMVVqUGdSL1FmQUZCVUg0QWd0T0JIOUJBZ1ZCQTBFQUkxVWpQZ1IvUWZJREJVSDVBUXRPR3dzTElnRkhCRUJCd2Y0REVBRWhBQ0FCSkpnQlFRQWhBZ0pBQWtBQ1FBSkFJQUVFUUNBQlFRRnJEZ01CQWdNRUN5QUFRWHh4SWdCQkNIRkJBRWNoQWd3REN5QUFRWDF4UVFGeUlnQkJFSEZCQUVjaEFnd0NDeUFBUVg1eFFRSnlJZ0JCSUhGQkFFY2hBZ3dCQ3lBQVFRTnlJUUFMSUFJRVFCQTdDeUFCUlFSQUVHd0xJQUZCQVVZRVFFRUJKSDlCQUJBNkMwSEIvZ01nQVNBQUVHMFFCQVVnQWtHWkFVWUVRRUhCL2dNZ0FVSEIvZ01RQVJCdEVBUUxDd3UwQVFBanRnRUVRQ05WSUFCcUpGVURRQ05WQW44alBnUkFRUWdqVmtHWkFVWU5BUnBCa0FjTUFRdEJCQ05XUVprQlJnMEFHa0hJQXd0T0JFQWpWUUovSXo0RVFFRUlJMVpCbVFGR0RRRWFRWkFIREFFTFFRUWpWa0daQVVZTkFCcEJ5QU1MYXlSVkkxWWlBRUdRQVVZRVFDTXpCRUFRT0FVZ0FCQTNDeEE1UVg4a3dnRkJmeVREQVFVZ0FFR1FBVWdFUUNNelJRUkFJQUFRTndzTEMwRUFJQUJCQVdvZ0FFR1pBVW9iSkZZTUFRc0xDeEJ1QzdNQkFDTlVBbjhqUGdSQVFRZ2pWa0daQVVZTkFScEJrQWNNQVF0QkJDTldRWmtCUmcwQUdrSElBd3RJQkVBUEN3TkFJMVFDZnlNK0JFQkJDQ05XUVprQlJnMEJHa0dRQnd3QkMwRUVJMVpCbVFGR0RRQWFRY2dEQzA0RVFBSi9JejRFUUVFSUkxWkJtUUZHRFFFYVFaQUhEQUVMUVFRalZrR1pBVVlOQUJwQnlBTUxFRzhqVkFKL0l6NEVRRUVJSTFaQm1RRkdEUUVhUVpBSERBRUxRUVFqVmtHWkFVWU5BQnBCeUFNTGF5UlVEQUVMQ3dzekFRRi9RUUVqa0FFRWYwRUNCVUVIQ3lJQ2RDQUFjVUVBUnlJQUJIOUJBU0FDZENBQmNVVUZJQUFMQkVCQkFROExRUUFMbGdFQkFuOGprUUZGQkVBUEN3TkFJQUVnQUVnRVFDQUJRUVJxSVFFampRRWlBa0VFYWlTTkFTT05BVUgvL3dOS0JFQWpqUUZCZ0lBRWF5U05BUXNnQWlPTkFSQnhCRUJCZ2Y0RFFZSCtBeEFCUVFGMFFRRnFRZjhCY1JBRUk0NEJRUUZxSkk0Qkk0NEJRUWhHQkVCQkFDU09BVUVCSklJQlFRTVFPa0dDL2dOQmd2NERFQUZCLzM1eEVBUkJBQ1NSQVFzTERBRUxDd3VJQVFBandRRkJBRW9FUUNQQkFTQUFhaUVBUVFBa3dRRUxJMGtnQUdva1NTTk5SUVJBSXpFRVFDTlVJQUJxSkZRUWNBVWdBQkJ2Q3lNd0JFQWpXeUFBYWlSYkJTQUFFRTBMSUFBUWNnc2pNZ1JBSTRVQklBQnFKSVVCRUdZRklBQVFaUXNqbEFFZ0FHb2tsQUVqbEFFamtnRk9CRUFqa3dGQkFXb2trd0VqbEFFamtnRnJKSlFCQ3dzS0FFRUVFSE1qU0JBQkN5WUJBWDlCQkJCekkwaEJBV3BCLy84RGNSQUJJUUFRZEVIL0FYRWdBRUgvQVhGQkNIUnlDd3dBUVFRUWN5QUFJQUVRYWdzd0FRRi9RUUVnQUhSQi93RnhJUUlnQVVFQVNnUkFJMFlnQW5KQi93RnhKRVlGSTBZZ0FrSC9BWE54SkVZTEkwWUxDUUJCQlNBQUVIY2FDMGtCQVg4Z0FVRUFUZ1JBSUFCQkQzRWdBVUVQY1dwQkVIRUVRRUVCRUhnRlFRQVFlQXNGSUFGQkgzVWlBaUFCSUFKcWMwRVBjU0FBUVE5eFN3UkFRUUVRZUFWQkFCQjRDd3NMQ1FCQkJ5QUFFSGNhQ3drQVFRWWdBQkIzR2dzSkFFRUVJQUFRZHhvTE93RUNmeUFCUVlEK0EzRkJDSFVoQWlBQVFRRnFJUU1nQUNBQlFmOEJjU0lCRUdrRVFDQUFJQUVRQkFzZ0F5QUNFR2tFUUNBRElBSVFCQXNMREFCQkNCQnpJQUFnQVJCOUMzVUFJQUlFUUNBQklBQkIvLzhEY1NJQWFpQUFJQUZ6Y3lJQ1FSQnhCRUJCQVJCNEJVRUFFSGdMSUFKQmdBSnhCRUJCQVJCOEJVRUFFSHdMQlNBQUlBRnFRZi8vQTNFaUFpQUFRZi8vQTNGSkJFQkJBUkI4QlVFQUVId0xJQUFnQVhNZ0FuTkJnQ0J4QkVCQkFSQjRCVUVBRUhnTEN3c0tBRUVFRUhNZ0FCQlNDNUVGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3d3VEN4QjFRZi8vQTNFaUFFR0EvZ054UVFoMUpFQWdBRUgvQVhFa1FRd1BDeU5CUWY4QmNTTkFRZjhCY1VFSWRISWpQeEIyREJFTEkwRkIvd0Z4STBCQi93RnhRUWgwY2tFQmFrSC8vd054SWdCQmdQNERjVUVJZFNSQURCRUxJMEJCQVJCNUkwQkJBV3BCL3dGeEpFQWpRQVJBUVFBUWVnVkJBUkI2QzBFQUVIc01Ed3NqUUVGL0VIa2pRRUVCYTBIL0FYRWtRQ05BQkVCQkFCQjZCVUVCRUhvTFFRRVFld3dPQ3hCMFFmOEJjU1JBREFzTEl6OUJnQUZ4UVlBQlJnUkFRUUVRZkFWQkFCQjhDeU0vSWdCQkFYUWdBRUgvQVhGQkIzWnlRZjhCY1NRL0RBc0xFSFZCLy84RGNTTkhFSDRNQ0FzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdBalFVSC9BWEVqUUVIL0FYRkJDSFJ5SWdGQkFCQi9JQUFnQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrUkNBQVFmOEJjU1JGUVFBUWUwRUlEd3NqUVVIL0FYRWpRRUgvQVhGQkNIUnlFSUFCUWY4QmNTUS9EQWtMSTBGQi93RnhJMEJCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1JBREFrTEkwRkJBUkI1STBGQkFXcEIvd0Z4SkVFalFRUkFRUUFRZWdWQkFSQjZDMEVBRUhzTUJ3c2pRVUYvRUhralFVRUJhMEgvQVhFa1FTTkJCRUJCQUJCNkJVRUJFSG9MUVFFUWV3d0dDeEIwUWY4QmNTUkJEQU1MSXo5QkFYRkJBRXNFUUVFQkVId0ZRUUFRZkFzalB5SUFRUWQwSUFCQi93RnhRUUYyY2tIL0FYRWtQd3dEQzBGL0R3c2pTRUVDYWtILy93TnhKRWdNQWdzalNFRUJha0gvL3dOeEpFZ01BUXRCQUJCNlFRQVFlMEVBRUhnTFFRUVBDeUFBUWY4QmNTUkJRUWdMS0FFQmZ5QUFRUmgwUVJoMUlnRkJnQUZ4QkVCQmdBSWdBRUVZZEVFWWRXdEJmMndoQVFzZ0FRc3BBUUYvSUFBUWdnRWhBU05JSUFGQkdIUkJHSFZxUWYvL0EzRWtTQ05JUVFGcVFmLy9BM0VrU0F2WUJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRVFSd1JBSUFCQkVXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJem9FUUVITi9nTVFnQUZCL3dGeElnQkJBWEVFUUVITi9nTWdBRUYrY1NJQVFZQUJjUVIvUVFBa1BpQUFRZjkrY1FWQkFTUStJQUJCZ0FGeUN4QjJRY1FBRHdzTFFRRWtUUXdRQ3hCMVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVJZ0FFSC9BWEVrUXlOSVFRSnFRZi8vQTNFa1NBd1JDeU5EUWY4QmNTTkNRZjhCY1VFSWRISWpQeEIyREJBTEkwTkIvd0Z4STBKQi93RnhRUWgwY2tFQmFrSC8vd054SWdCQmdQNERjVUVJZFNSQ0RCQUxJMEpCQVJCNUkwSkJBV3BCL3dGeEpFSWpRZ1JBUVFBUWVnVkJBUkI2QzBFQUVIc01EZ3NqUWtGL0VIa2pRa0VCYTBIL0FYRWtRaU5DQkVCQkFCQjZCVUVCRUhvTFFRRVFld3dOQ3hCMFFmOEJjU1JDREFvTFFRRkJBQ00vSWdGQmdBRnhRWUFCUmhzaEFDTkdRUVIyUVFGeElBRkJBWFJ5UWY4QmNTUS9EQW9MRUhRUWd3RkJDQThMSTBWQi93RnhJMFJCL3dGeFFRaDBjaUlBSTBOQi93RnhJMEpCL3dGeFFRaDBjaUlCUVFBUWZ5QUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSVUVBRUh0QkNBOExJME5CL3dGeEkwSkIvd0Z4UVFoMGNoQ0FBVUgvQVhFa1B3d0lDeU5EUWY4QmNTTkNRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtRZ3dJQ3lORFFRRVFlU05EUVFGcVFmOEJjU1JESTBNRVFFRUFFSG9GUVFFUWVndEJBQkI3REFZTEkwTkJmeEI1STBOQkFXdEIvd0Z4SkVNalF3UkFRUUFRZWdWQkFSQjZDMEVCRUhzTUJRc1FkRUgvQVhFa1F3d0NDMEVCUVFBalB5SUJRUUZ4UVFGR0d5RUFJMFpCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SkQ4TUFndEJmdzhMSTBoQkFXcEIvLzhEY1NSSURBRUxJQUFFUUVFQkVId0ZRUUFRZkF0QkFCQjZRUUFRZTBFQUVIZ0xRUVFQQ3lBQVFmOEJjU1JEUVFnTHVBWUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFZ1J3UkFJQUJCSVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEkwWkJCM1pCQVhFRVFDTklRUUZxUWYvL0EzRWtTQVVRZEJDREFRdEJDQThMRUhWQi8vOERjU0lBUVlEK0EzRkJDSFVrUkNBQVFmOEJjU1JGSTBoQkFtcEIvLzhEY1NSSURCQUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUFJejhRZGlBQVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JRd1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtSQ0FBUWY4QmNTUkZRUWdQQ3lORVFRRVFlU05FUVFGcVFmOEJjU1JFSTBRRVFFRUFFSG9GUVFFUWVndEJBQkI3REEwTEkwUkJmeEI1STBSQkFXdEIvd0Z4SkVRalJBUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURBc1FkRUgvQVhFa1JBd0tDMEVHUVFBalJrRUZka0VCY1VFQVN4c2hBU0FCUWVBQWNpQUJJMFpCQkhaQkFYRkJBRXNiSVFFalJrRUdka0VCY1VFQVN3Ui9JejhnQVd0Qi93RnhCU0FCUVFaeUlBRWpQeUlBUVE5eFFRbExHeUlCUWVBQWNpQUJJQUJCbVFGTEd5SUJJQUJxUWY4QmNRc2lBQVJBUVFBUWVnVkJBUkI2Q3lBQlFlQUFjUVJBUVFFUWZBVkJBQkI4QzBFQUVIZ2dBQ1EvREFvTEkwWkJCM1pCQVhGQkFFc0VRQkIwRUlNQkJTTklRUUZxUWYvL0EzRWtTQXRCQ0E4TEkwVkIvd0Z4STBSQi93RnhRUWgwY2lJQklBRkIvLzhEY1VFQUVIOGdBVUVCZEVILy93TnhJZ0ZCZ1A0RGNVRUlkU1JFSUFGQi93RnhKRVZCQUJCN1FRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBUkNBQVVIL0FYRWtQeUFCUVFGcVFmLy9BM0VpQVVHQS9nTnhRUWgxSkVRZ0FVSC9BWEVrUlF3SEN5TkZRZjhCY1NORVFmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQlFZRCtBM0ZCQ0hVa1JDQUJRZjhCY1NSRlFRZ1BDeU5GUVFFUWVTTkZRUUZxUWY4QmNTUkZJMFVFUUVFQUVIb0ZRUUVRZWd0QkFCQjdEQVVMSTBWQmZ4QjVJMFZCQVd0Qi93RnhKRVVqUlFSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNNQkFzUWRFSC9BWEVrUlF3Q0N5TS9RWDl6UWY4QmNTUS9RUUVRZTBFQkVIZ01BZ3RCZnc4TEkwaEJBV3BCLy84RGNTUklDMEVFQzVRRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFUQkhCRUFnQUVFeGF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pSa0VFZGtFQmNRUkFJMGhCQVdwQi8vOERjU1JJQlJCMEVJTUJDMEVJRHdzUWRVSC8vd054SkVjalNFRUNha0gvL3dOeEpFZ01FZ3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJZ0FqUHhCMkRBNExJMGRCQVdwQi8vOERjU1JIUVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFCQ0FBU0lCUVFFUWVTQUJRUUZxUWY4QmNTSUJCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d05DeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBQkNBQVNJQlFYOFFlU0FCUVFGclFmOEJjU0lCQkVCQkFCQjZCVUVCRUhvTFFRRVFld3dNQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZEVIL0FYRVFkZ3dNQzBFQUVIdEJBQkI0UVFFUWZBd01DeU5HUVFSMlFRRnhRUUZHQkVBUWRCQ0RBUVVqU0VFQmFrSC8vd054SkVnTFFRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBU05IUVFBUWZ5TkhJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSVUVBRUh0QkNBOExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUFFSUFCUWY4QmNTUS9EQVlMSTBkQkFXdEIvLzhEY1NSSFFRZ1BDeU0vUVFFUWVTTS9RUUZxUWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFCQjdEQWNMSXo5QmZ4QjVJejlCQVd0Qi93RnhKRDhqUHdSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNNQmdzUWRFSC9BWEVrUHd3RUMwRUFFSHRCQUJCNEkwWkJCSFpCQVhGQkFFc0VRRUVBRUh3RlFRRVFmQXNNQkF0QmZ3OExJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVrUkNBQVFmOEJjU1JGREFJTElBQkIvLzhEY1NBQkVIWU1BUXNqU0VFQmFrSC8vd054SkVnTFFRUUw1QUVBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhBQUVjRVFDQUFRY0VBUmcwQkFrQWdBRUhDQUdzT0RnTUVCUVlIQ0FrUkNnc01EUTRQQUFzTUR3c01Ed3NqUVNSQURBNExJMElrUUF3TkN5TkRKRUFNREFzalJDUkFEQXNMSTBVa1FBd0tDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUZCL3dGeEpFQU1DUXNqUHlSQURBZ0xJMEFrUVF3SEN5TkNKRUVNQmdzalF5UkJEQVVMSTBRa1FRd0VDeU5GSkVFTUF3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSQkRBSUxJejhrUVF3QkMwRi9Ed3RCQkF2ZkFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIUUFFY0VRQ0FBUWRFQVJnMEJBa0FnQUVIU0FHc09EaEFEQkFVR0J3Z0pDaEFMREEwT0FBc01EZ3NqUUNSQ0RBNExJMEVrUWd3TkN5TkRKRUlNREFzalJDUkNEQXNMSTBVa1Fnd0tDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUZCL3dGeEpFSU1DUXNqUHlSQ0RBZ0xJMEFrUXd3SEN5TkJKRU1NQmdzalFpUkREQVVMSTBRa1F3d0VDeU5GSkVNTUF3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSRERBSUxJejhrUXd3QkMwRi9Ed3RCQkF2ZkFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIZ0FFY0VRQ0FBUWVFQVJnMEJBa0FnQUVIaUFHc09EZ01FRUFVR0J3Z0pDZ3NNRUEwT0FBc01EZ3NqUUNSRURBNExJMEVrUkF3TkN5TkNKRVFNREFzalF5UkVEQXNMSTBVa1JBd0tDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUZCL3dGeEpFUU1DUXNqUHlSRURBZ0xJMEFrUlF3SEN5TkJKRVVNQmdzalFpUkZEQVVMSTBNa1JRd0VDeU5FSkVVTUF3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSRkRBSUxJejhrUlF3QkMwRi9Ed3RCQkF2c0FnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUFSd1JBSUFCQjhRQkdEUUVDUUNBQVFmSUFhdzRPQXdRRkJnY0lDUW9MREEwT0R4RUFDd3dQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUUJCMkRBOExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpTkJFSFlNRGdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5STBJUWRnd05DeU5GUWY4QmNTTkVRZjhCY1VFSWRISWpReEIyREF3TEkwVkIvd0Z4STBSQi93RnhRUWgwY2lORUVIWU1Dd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJMFVRZGd3S0N5UEVBVVVFUUFKQUk1a0JCRUJCQVNSS0RBRUxJMzRqaEFGeFFSOXhSUVJBUVFFa1N3d0JDMEVCSkV3TEN3d0pDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWpQeEIyREFnTEkwQWtQd3dIQ3lOQkpEOE1CZ3NqUWlRL0RBVUxJME1rUHd3RUN5TkVKRDhNQXdzalJTUS9EQUlMSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtQd3dCQzBGL0R3dEJCQXRKQVFGL0lBRkJBRTRFUUNBQVFmOEJjU0FBSUFGcVFmOEJjVXNFUUVFQkVId0ZRUUFRZkFzRklBRkJIM1VpQWlBQklBSnFjeUFBUWY4QmNVb0VRRUVCRUh3RlFRQVFmQXNMQ3pRQkFYOGpQeUFBUWY4QmNTSUJFSGtqUHlBQkVJc0JJejhnQUdwQi93RnhKRDhqUHdSQVFRQVFlZ1ZCQVJCNkMwRUFFSHNMYkFFQ2Z5TS9JQUJxSTBaQkJIWkJBWEZxUWY4QmNTSUJJUUlqUHlBQWN5QUJjMEVRY1FSQVFRRVFlQVZCQUJCNEN5TS9JQUJCL3dGeGFpTkdRUVIyUVFGeGFrR0FBbkZCQUVzRVFFRUJFSHdGUVFBUWZBc2dBaVEvSXo4RVFFRUFFSG9GUVFFUWVndEJBQkI3Qy9FQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCZ0FGSEJFQWdBVUdCQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEkwQVFqQUVNRUFzalFSQ01BUXdQQ3lOQ0VJd0JEQTRMSTBNUWpBRU1EUXNqUkJDTUFRd01DeU5GRUl3QkRBc0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBUkNNQVF3S0N5TS9FSXdCREFrTEkwQVFqUUVNQ0FzalFSQ05BUXdIQ3lOQ0VJMEJEQVlMSTBNUWpRRU1CUXNqUkJDTkFRd0VDeU5GRUkwQkRBTUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBUkNOQVF3Q0N5TS9FSTBCREFFTFFYOFBDMEVFQ3pjQkFYOGpQeUFBUWY4QmNVRi9iQ0lCRUhralB5QUJFSXNCSXo4Z0FHdEIvd0Z4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVCRUhzTGJBRUNmeU0vSUFCckkwWkJCSFpCQVhGclFmOEJjU0lCSVFJalB5QUFjeUFCYzBFUWNRUkFRUUVRZUFWQkFCQjRDeU0vSUFCQi93RnhheU5HUVFSMlFRRnhhMEdBQW5GQkFFc0VRRUVCRUh3RlFRQVFmQXNnQWlRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQVJCN0MvRUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQmtBRkhCRUFnQVVHUkFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJMEFRandFTUVBc2pRUkNQQVF3UEN5TkNFSThCREE0TEkwTVFqd0VNRFFzalJCQ1BBUXdNQ3lORkVJOEJEQXNMSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDUEFRd0tDeU0vRUk4QkRBa0xJMEFRa0FFTUNBc2pRUkNRQVF3SEN5TkNFSkFCREFZTEkwTVFrQUVNQlFzalJCQ1FBUXdFQ3lORkVKQUJEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDUUFRd0NDeU0vRUpBQkRBRUxRWDhQQzBFRUN5TUFJejhnQUhFa1B5TS9CRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUJFSGhCQUJCOEN5Y0FJejhnQUhOQi93RnhKRDhqUHdSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNFFRQVFmQXZ4QVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRYUFCUndSQUlBRkJvUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lOQUVKSUJEQkFMSTBFUWtnRU1Ed3NqUWhDU0FRd09DeU5ERUpJQkRBMExJMFFRa2dFTURBc2pSUkNTQVF3TEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFrZ0VNQ2dzalB4Q1NBUXdKQ3lOQUVKTUJEQWdMSTBFUWt3RU1Cd3NqUWhDVEFRd0dDeU5ERUpNQkRBVUxJMFFRa3dFTUJBc2pSUkNUQVF3REN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFrd0VNQWdzalB4Q1RBUXdCQzBGL0R3dEJCQXNuQUNNL0lBQnlRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN1FRQVFlRUVBRUh3TEx3RUJmeU0vSUFCQi93RnhRWDlzSWdFUWVTTS9JQUVRaXdFalB5QUJhZ1JBUVFBUWVnVkJBUkI2QzBFQkVIc0w4UUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR3dBVWNFUUNBQlFiRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqUUJDVkFRd1FDeU5CRUpVQkRBOExJMElRbFFFTURnc2pReENWQVF3TkN5TkVFSlVCREF3TEkwVVFsUUVNQ3dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQkVKVUJEQW9MSXo4UWxRRU1DUXNqUUJDV0FRd0lDeU5CRUpZQkRBY0xJMElRbGdFTUJnc2pReENXQVF3RkN5TkVFSllCREFRTEkwVVFsZ0VNQXdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQkVKWUJEQUlMSXo4UWxnRU1BUXRCZnc4TFFRUUxPd0VCZnlBQUVGRWlBVUYvUmdSL0lBQVFBUVVnQVF0Qi93RnhJQUJCQVdvaUFSQlJJZ0JCZjBZRWZ5QUJFQUVGSUFBTFFmOEJjVUVJZEhJTEN3QkJDQkJ6SUFBUW1BRUxRd0FnQUVHQUFYRkJnQUZHQkVCQkFSQjhCVUVBRUh3TElBQkJBWFFnQUVIL0FYRkJCM1p5UWY4QmNTSUFCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGdnQUF0QkFDQUFRUUZ4UVFCTEJFQkJBUkI4QlVFQUVId0xJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU0lBQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhnZ0FBdFBBUUYvUVFGQkFDQUFRWUFCY1VHQUFVWWJJUUVqUmtFRWRrRUJjU0FBUVFGMGNrSC9BWEVoQUNBQkJFQkJBUkI4QlVFQUVId0xJQUFFUUVFQUVIb0ZRUUVRZWd0QkFCQjdRUUFRZUNBQUMxQUJBWDlCQVVFQUlBQkJBWEZCQVVZYklRRWpSa0VFZGtFQmNVRUhkQ0FBUWY4QmNVRUJkbkloQUNBQkJFQkJBUkI4QlVFQUVId0xJQUFFUUVFQUVIb0ZRUUVRZWd0QkFCQjdRUUFRZUNBQUMwWUJBWDlCQVVFQUlBQkJnQUZ4UVlBQlJoc2hBU0FBUVFGMFFmOEJjU0VBSUFFRVFFRUJFSHdGUVFBUWZBc2dBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0SUFBTFhnRUNmMEVCUVFBZ0FFRUJjVUVCUmhzaEFVRUJRUUFnQUVHQUFYRkJnQUZHR3lFQ0lBQkIvd0Z4UVFGMklnQkJnQUZ5SUFBZ0Foc2lBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0SUFFRVFFRUJFSHdGUVFBUWZBc2dBQXN3QUNBQVFROXhRUVIwSUFCQjhBRnhRUVIyY2lJQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIaEJBQkI4SUFBTFFnRUJmMEVCUVFBZ0FFRUJjVUVCUmhzaEFTQUFRZjhCY1VFQmRpSUFCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGdnQVFSQVFRRVFmQVZCQUJCOEN5QUFDeVFBUVFFZ0FIUWdBWEZCL3dGeEJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQkVIZ2dBUXVmQ0FFR2Z3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRUlieUlHSWdVRVFDQUZRUUZyRGdjQkFnTUVCUVlIQ0FzalFDRUJEQWNMSTBFaEFRd0dDeU5DSVFFTUJRc2pReUVCREFRTEkwUWhBUXdEQ3lORklRRU1BZ3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCSVFFTUFRc2pQeUVCQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGeFFRUjFJZ1VpQkFSQUlBUkJBV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSUFCQkIwd0VmMEVCSVFJZ0FSQ2FBUVVnQUVFUFRBUi9RUUVoQWlBQkVKc0JCVUVBQ3dzaEF3d1BDeUFBUVJkTUJIOUJBU0VDSUFFUW5BRUZJQUJCSDB3RWYwRUJJUUlnQVJDZEFRVkJBQXNMSVFNTURnc2dBRUVuVEFSL1FRRWhBaUFCRUo0QkJTQUFRUzlNQkg5QkFTRUNJQUVRbndFRlFRQUxDeUVEREEwTElBQkJOMHdFZjBFQklRSWdBUkNnQVFVZ0FFRS9UQVIvUVFFaEFpQUJFS0VCQlVFQUN3c2hBd3dNQ3lBQVFjY0FUQVIvUVFFaEFrRUFJQUVRb2dFRklBQkJ6d0JNQkg5QkFTRUNRUUVnQVJDaUFRVkJBQXNMSVFNTUN3c2dBRUhYQUV3RWYwRUJJUUpCQWlBQkVLSUJCU0FBUWQ4QVRBUi9RUUVoQWtFRElBRVFvZ0VGUVFBTEN5RUREQW9MSUFCQjV3Qk1CSDlCQVNFQ1FRUWdBUkNpQVFVZ0FFSHZBRXdFZjBFQklRSkJCU0FCRUtJQkJVRUFDd3NoQXd3SkN5QUFRZmNBVEFSL1FRRWhBa0VHSUFFUW9nRUZJQUJCL3dCTUJIOUJBU0VDUVFjZ0FSQ2lBUVZCQUFzTElRTU1DQXNnQUVHSEFVd0VmMEVCSVFJZ0FVRitjUVVnQUVHUEFVd0VmMEVCSVFJZ0FVRjljUVZCQUFzTElRTU1Cd3NnQUVHWEFVd0VmMEVCSVFJZ0FVRjdjUVVnQUVHZkFVd0VmMEVCSVFJZ0FVRjNjUVZCQUFzTElRTU1CZ3NnQUVHbkFVd0VmMEVCSVFJZ0FVRnZjUVVnQUVHdkFVd0VmMEVCSVFJZ0FVRmZjUVZCQUFzTElRTU1CUXNnQUVHM0FVd0VmMEVCSVFJZ0FVRy9mM0VGSUFCQnZ3Rk1CSDlCQVNFQ0lBRkIvMzV4QlVFQUN3c2hBd3dFQ3lBQVFjY0JUQVIvUVFFaEFpQUJRUUZ5QlNBQVFjOEJUQVIvUVFFaEFpQUJRUUp5QlVFQUN3c2hBd3dEQ3lBQVFkY0JUQVIvUVFFaEFpQUJRUVJ5QlNBQVFkOEJUQVIvUVFFaEFpQUJRUWh5QlVFQUN3c2hBd3dDQ3lBQVFlY0JUQVIvUVFFaEFpQUJRUkJ5QlNBQVFlOEJUQVIvUVFFaEFpQUJRU0J5QlVFQUN3c2hBd3dCQ3lBQVFmY0JUQVIvUVFFaEFpQUJRY0FBY2dVZ0FFSC9BVXdFZjBFQklRSWdBVUdBQVhJRlFRQUxDeUVEQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQmlJRUJFQWdCRUVCYXc0SEFRSURCQVVHQndnTElBTWtRQXdIQ3lBREpFRU1CZ3NnQXlSQ0RBVUxJQU1rUXd3RUN5QURKRVFNQXdzZ0F5UkZEQUlMSUFWQkJFZ2lCQVIvSUFRRklBVkJCMG9MQkVBalJVSC9BWEVqUkVIL0FYRkJDSFJ5SUFNUWRnc01BUXNnQXlRL0MwRUVRWDhnQWhzTDdnTUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUJSd1JBSUFCQndRRnJEZzhCQWhFREJBVUdCd2dKQ2dzUURBME9DeU5HUVFkMlFRRnhEUkVNRGdzalJ4Q1pBVUgvL3dOeElRQWpSMEVDYWtILy93TnhKRWNnQUVHQS9nTnhRUWgxSkVBZ0FFSC9BWEVrUVVFRUR3c2pSa0VIZGtFQmNRMFJEQTRMSTBaQkIzWkJBWEVORUF3TUN5TkhRUUpyUWYvL0EzRWtSeU5ISTBGQi93RnhJMEJCL3dGeFFRaDBjaEIrREEwTEVIUVFqQUVNRFFzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1QkFDUklEQXNMSTBaQkIzWkJBWEZCQVVjTkNnd0hDeU5IRUprQlFmLy9BM0VrU0NOSFFRSnFRZi8vQTNFa1J3d0pDeU5HUVFkMlFRRnhRUUZHRFFjTUNnc1FkRUgvQVhFUW93RWhBQ05JUVFGcVFmLy9BM0VrU0NBQUR3c2pSa0VIZGtFQmNVRUJSdzBJSTBkQkFtdEIvLzhEY1NSSEkwY2pTRUVDYWtILy93TnhFSDRNQlFzUWRCQ05BUXdHQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFSUpFZ01CQXRCZnc4TEkwY1FtUUZCLy84RGNTUklJMGRCQW1wQi8vOERjU1JIUVF3UEN5TkhRUUpyUWYvL0EzRWtSeU5ISTBoQkFtcEIvLzhEY1JCK0N4QjFRZi8vQTNFa1NBdEJDQThMSTBoQkFXcEIvLzhEY1NSSVFRUVBDeU5JUVFKcVFmLy9BM0VrU0VFTUM5TURBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQlJ3UkFJQUJCMFFGckRnOEJBZzBEQkFVR0J3Z0pEUW9OQ3d3TkN5TkdRUVIyUVFGeERROE1EUXNqUnhDWkFVSC8vd054SVFBalIwRUNha0gvL3dOeEpFY2dBRUdBL2dOeFFRaDFKRUlnQUVIL0FYRWtRMEVFRHdzalJrRUVka0VCY1EwUERBd0xJMFpCQkhaQkFYRU5EaU5IUVFKclFmLy9BM0VrUnlOSEkwaEJBbXBCLy84RGNSQitEQXNMSTBkQkFtdEIvLzhEY1NSSEkwY2pRMEgvQVhFalFrSC9BWEZCQ0hSeUVINE1Dd3NRZEJDUEFRd0xDeU5IUVFKclFmLy9BM0VrUnlOSEkwZ1Fma0VRSkVnTUNRc2pSa0VFZGtFQmNVRUJSdzBJREFZTEkwY1FtUUZCLy84RGNTUklRUUVrbWdFalIwRUNha0gvL3dOeEpFY01Cd3NqUmtFRWRrRUJjVUVCUmcwRkRBZ0xJMFpCQkhaQkFYRkJBVWNOQnlOSFFRSnJRZi8vQTNFa1J5TkhJMGhCQW1wQi8vOERjUkIrREFRTEVIUVFrQUVNQlFzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1QkdDUklEQU1MUVg4UEN5TkhFSmtCUWYvL0EzRWtTQ05IUVFKcVFmLy9BM0VrUjBFTUR3c1FkVUgvL3dOeEpFZ0xRUWdQQ3lOSVFRRnFRZi8vQTNFa1NFRUVEd3NqU0VFQ2FrSC8vd054SkVoQkRBdndBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQVVjRVFDQUFRZUVCYXc0UEFRSUxDd01FQlFZSENBc0xDd2tLQ3dzUWRFSC9BWEZCZ1A0RGFpTS9FSFlNQ3dzalJ4Q1pBVUgvL3dOeElRQWpSMEVDYWtILy93TnhKRWNnQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFRUR3c2pRVUdBL2dOcUl6OFFka0VFRHdzalIwRUNhMEgvL3dOeEpFY2pSeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFma0VJRHdzUWRCQ1NBUXdIQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFZ0pFaEJDQThMRUhRUWdnRkJHSFJCR0hVaEFDTkhJQUJCQVJCL0kwY2dBR3BCLy84RGNTUkhRUUFRZWtFQUVIc2pTRUVCYWtILy93TnhKRWhCREE4TEkwVkIvd0Z4STBSQi93RnhRUWgwY2lSSVFRUVBDeEIxUWYvL0EzRWpQeEIySTBoQkFtcEIvLzhEY1NSSVFRUVBDeEIwRUpNQkRBSUxJMGRCQW10Qi8vOERjU1JISTBjalNCQitRU2drU0VFSUR3dEJmdzhMSTBoQkFXcEIvLzhEY1NSSVFRUUxwd01BQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZIQkVBZ0FFSHhBV3NPRHdFQ0F3MEVCUVlIQ0FrS0RRMExEQTBMRUhSQi93RnhRWUQrQTJvUWdBRkIvd0Z4SkQ4TURRc2pSeENaQVVILy93TnhJUUFqUjBFQ2FrSC8vd054SkVjZ0FFR0EvZ054UVFoMUpEOGdBRUgvQVhFa1Jnd05DeU5CUVlEK0Eyb1FnQUZCL3dGeEpEOE1EQXRCQUNTWkFRd0xDeU5IUVFKclFmLy9BM0VrUnlOSEkwWkIvd0Z4SXo5Qi93RnhRUWgwY2hCK1FRZ1BDeEIwRUpVQkRBZ0xJMGRCQW10Qi8vOERjU1JISTBjalNCQitRVEFrU0VFSUR3c1FkQkNDQVNFQVFRQVFla0VBRUhzalJ5QUFRUmgwUVJoMUlnQkJBUkIvSTBjZ0FHcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1JDQUFRZjhCY1NSRkkwaEJBV3BCLy84RGNTUklRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElrUjBFSUR3c1FkVUgvL3dOeEVJQUJRZjhCY1NRL0kwaEJBbXBCLy84RGNTUklEQVVMUVFFa21nRU1CQXNRZEJDV0FRd0NDeU5IUVFKclFmLy9BM0VrUnlOSEkwZ1Fma0U0SkVoQkNBOExRWDhQQ3lOSVFRRnFRZi8vQTNFa1NBdEJCQXZjQVFFQmZ5TklRUUZxUWYvL0EzRWtTQ05NQkVBalNFRUJhMEgvL3dOeEpFZ0xBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdFRVFDQUJRUUZHRFFFQ1FDQUJRUUpyRGcwREJBVUdCd2dKQ2dzTURRNFBBQXNNRHdzZ0FCQ0JBUThMSUFBUWhBRVBDeUFBRUlVQkR3c2dBQkNHQVE4TElBQVFod0VQQ3lBQUVJZ0JEd3NnQUJDSkFROExJQUFRaWdFUEN5QUFFSTRCRHdzZ0FCQ1JBUThMSUFBUWxBRVBDeUFBRUpjQkR3c2dBQkNrQVE4TElBQVFwUUVQQ3lBQUVLWUJEd3NnQUJDbkFRdkNBUUVDZjBFQUpKa0JRWS8rQXhBQlFRRWdBSFJCZjNOeElnRWtoQUZCai80RElBRVFCQ05IUVFKclFmLy9BM0VrUndKQUkwb2lBU05MSUFFYkRRQUxJMGNpQVNOSUlnSkIvd0Z4RUFRZ0FVRUJhaUFDUVlEK0EzRkJDSFVRQkFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0F3TUVCUUFMREFVTFFRQWtmMEhBQUNSSURBUUxRUUFrZ0FGQnlBQWtTQXdEQzBFQUpJRUJRZEFBSkVnTUFndEJBQ1NDQVVIWUFDUklEQUVMUVFBa2d3RkI0QUFrU0FzTCtRRUJBMzhqbWdFRVFFRUJKSmtCUVFBa21nRUxJMzRqaEFGeFFSOXhRUUJLQkVBalMwVWptUUVpQWlBQ0d3Ui9JMzhqZVNJQUlBQWJCSDlCQUJDcEFVRUJCU09BQVNONklnQWdBQnNFZjBFQkVLa0JRUUVGSTRFQkkzc2lBQ0FBR3dSL1FRSVFxUUZCQVFVamdnRWpmQ0lBSUFBYkJIOUJBeENwQVVFQkJTT0RBU045SWdBZ0FCc0VmMEVFRUtrQlFRRUZRUUFMQ3dzTEN3VkJBQXNFUUFKL1FRRWpTaUlBSTBzZ0FCc05BQnBCQUFzRWYwRUFKRXRCQUNSS1FRQWtURUVBSkUxQkdBVkJGQXNoQVFzQ2YwRUJJMG9pQUNOTElBQWJEUUFhUVFBTEJFQkJBQ1JMUVFBa1NrRUFKRXhCQUNSTkN5QUJEd3RCQUF1ckFRRUNmMEVCSkMwalRBUkFJMGdRQVVIL0FYRVFxQUVRYzBFQUpFdEJBQ1JLUVFBa1RFRUFKRTBMRUtvQklnRkJBRW9FUUNBQkVITUxRUVFoQUFKL1FRRWpTaUlCSTBzZ0FSc05BQnBCQUF0RklnRUVmeU5OUlFVZ0FRc0VRQ05JRUFGQi93RnhFS2dCSVFBTEkwWkI4QUZ4SkVZZ0FFRUFUQVJBSUFBUEN5QUFFSE1qbHdGQkFXb2tsd0VqbHdFamxRRk9CRUFqbGdGQkFXb2tsZ0VqbHdFamxRRnJKSmNCQ3lBQUN3UUFJMm9MNWdFQkJYOGdBRUYvUVlBSUlBQkJBRWdiSUFCQkFFb2JJUVJCQUNFQUEwQUNmd0ovSUFaRklnSUVRQ0FBUlNFQ0N5QUNDd1JBSUFWRklRSUxJQUlMQkVBZ0EwVWhBZ3NnQWdSQUVLc0JRUUJJQkVCQkFTRUdCU05KSXo0RWYwR2d5UWdGUWRDa0JBdE9CRUJCQVNFQUJTQUVRWDlLSWdJRVFDTnFJQVJPSVFJTElBSUVRRUVCSVFVRklBRkJmMG9pQWdSQUkwZ2dBVVloQWd0QkFTQURJQUliSVFNTEN3c01BUXNMSUFBRVFDTkpJejRFZjBHZ3lRZ0ZRZENrQkF0ckpFa2ppQUlQQ3lBRkJFQWppUUlQQ3lBREJFQWppZ0lQQ3lOSVFRRnJRZi8vQTNFa1NFRi9Dd2tBUVg5QmZ4Q3RBUXM0QVFOL0EwQWdBaUFBU0NJREJFQWdBVUVBVGlFREN5QURCRUFRcmdFaEFTQUNRUUZxSVFJTUFRc0xJQUZCQUVnRVFDQUJEd3RCQUFzSkFFRi9JQUFRclFFTENRQWdBQ0FCRUswQkN3VUFJNUlCQ3dVQUk1TUJDd1VBSTVRQkMxOEJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVFKQUlBRkJBbXNPQmdNRUJRWUhDQUFMREFnTEkrb0JEd3NqNndFUEN5UHNBUThMSSswQkR3c2o3Z0VQQ3lQdkFROExJL0FCRHdzajhRRVBDMEVBQzRzQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQ1FRRkdEUUVDUUNBQ1FRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lBQlFRQkhKT29CREFjTElBRkJBRWNrNndFTUJnc2dBVUVBUnlUc0FRd0ZDeUFCUVFCSEpPMEJEQVFMSUFGQkFFY2s3Z0VNQXdzZ0FVRUFSeVR2QVF3Q0N5QUJRUUJISlBBQkRBRUxJQUZCQUVjazhRRUxDMVFCQVg5QkFDUk5JQUFRdFFGRkJFQkJBU0VCQ3lBQVFRRVF0Z0VnQVFSQVFRRkJBVUVBUVFGQkFDQUFRUU5NR3lJQkk3OEJJZ0FnQUJzYklBRkZJOEFCSWdBZ0FCc2JCRUJCQVNTREFVRUVFRG9MQ3dzSkFDQUFRUUFRdGdFTG1nRUFJQUJCQUVvRVFFRUFFTGNCQlVFQUVMZ0JDeUFCUVFCS0JFQkJBUkMzQVFWQkFSQzRBUXNnQWtFQVNnUkFRUUlRdHdFRlFRSVF1QUVMSUFOQkFFb0VRRUVERUxjQkJVRURFTGdCQ3lBRVFRQktCRUJCQkJDM0FRVkJCQkM0QVFzZ0JVRUFTZ1JBUVFVUXR3RUZRUVVRdUFFTElBWkJBRW9FUUVFR0VMY0JCVUVHRUxnQkN5QUhRUUJLQkVCQkJ4QzNBUVZCQnhDNEFRc0xCQUFqUHdzRUFDTkFDd1FBSTBFTEJBQWpRZ3NFQUNOREN3UUFJMFFMQkFBalJRc0VBQ05HQ3dRQUkwZ0xCQUFqUndzR0FDTklFQUVMQkFBalZndXZBd0VLZjBHQWdBSkJnSkFDSTdrQkd5RUpRWUM0QWtHQXNBSWp1Z0ViSVFvRFFDQUZRWUFDU0FSQVFRQWhCQU5BSUFSQmdBSklCRUFnQ1NBRlFRTjFRUVYwSUFwcUlBUkJBM1ZxSWdOQmdKQithaTBBQUJBc0lRZ2dCVUVJYnlFQlFRY2dCRUVJYjJzaEJrRUFJUUlDZnlBQVFRQktJem9pQnlBSEd3UkFJQU5CZ05CK2FpMEFBQ0VDQ3lBQ1FjQUFjUXNFUUVFSElBRnJJUUVMUVFBaEJ5QUJRUUYwSUFocUlnTkJnSkIrYWtFQlFRQWdBa0VJY1JzaUIwRUJjVUVOZEdvdEFBQWhDRUVBSVFFZ0EwR0JrSDVxSUFkQkFYRkJEWFJxTFFBQVFRRWdCblJ4QkVCQkFpRUJDeUFCUVFGcUlBRkJBU0FHZENBSWNSc2hBU0FGUVFoMElBUnFRUU5zSVFZZ0FFRUFTaU02SWdNZ0F4c0VRQ0FDUVFkeElBRkJBQkF0SWdGQkgzRkJBM1FoQXlBR1FZQ2hDMm9pQWlBRE9nQUFJQUpCQVdvZ0FVSGdCM0ZCQlhWQkEzUTZBQUFnQWtFQ2FpQUJRWUQ0QVhGQkNuVkJBM1E2QUFBRklBRkJ4LzREUVFBUUxpRUNRUUFoQVFOQUlBRkJBMGdFUUNBR1FZQ2hDMm9nQVdvZ0Fqb0FBQ0FCUVFGcUlRRU1BUXNMQ3lBRVFRRnFJUVFNQVFzTElBVkJBV29oQlF3QkN3c0x5QUVCQm44Q1FBTkFJQUZCRjA0TkFVRUFJUUFEUUFKQUlBQkJIMDROQUVFQUlRUkJBVUVBSUFCQkQwb2JJUVFnQVNFQ0lBSkJEMnNnQWlBQlFROUtHMEVFZENFQ0lBQkJEMnNnQW1vZ0FDQUNhaUFBUVE5S0d5RUNRWUNBQWlFRlFZQ1FBa0dBZ0FJZ0FVRVBTaHNoQlVFQUlRTURRQUpBSUFOQkNFNE5BQ0FDSUFVZ0JFRUFRUWNnQXlBQVFRTjBJQUZCQTNRZ0EycEIrQUZCZ0tFWFFRRkJmeEF2R2lBRFFRRnFJUU1NQVFzTElBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBQUFDd0FMQzRBQ0FRZC9BMEFnQkVFSVRrVUVRRUVBSVFFRFFDQUJRUVZJQkVBZ0FVRURkQ0FFYWtFQ2RDSUFRWUQ4QTJvUUFSb2dBRUdCL0FOcUVBRWFJQUJCZ3Z3RGFoQUJJUUpCQVNFRkk3c0JCRUFnQWtFQ2IwRUJSZ1JBSUFKQkFXc2hBZ3RCQWlFRkN5QUFRWVA4QTJvUUFTRUFRUUFoQmtFQlFRQWdBRUVJY1VFQVJ5TTZJem9iR3lFR1FRQWhBQU5BSUFBZ0JVZ0VRRUVBSVFNRFFDQURRUWhJQkVBZ0FDQUNha0dBZ0FJZ0JrRUFRUWNnQXlBRVFRTjBJQUZCQkhRZ0Eyb2dBRUVEZEdwQndBQkJnS0VnUVFGQmZ4QXZHaUFEUVFGcUlRTU1BUXNMSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN5QUVRUUZxSVFRTUFRc0xDd1VBSTRZQkN3VUFJNGNCQ3dVQUk0Z0JDeGdCQVg4amlnRWhBQ09KQVFSQUlBQkJCSEloQUFzZ0FBc3RBUUYvQWtBRFFDQUFRZi8vQTA0TkFTQUFRWUNoeVFScUlBQVFVam9BQUNBQVFRRnFJUUFNQUFBTEFBc0xGQUEvQUVHVUFVZ0VRRUdVQVQ4QWEwQUFHZ3NMQXdBQkN4OEFBa0FDUUFKQUk1a0NEZ0lCQWdBTEFBdEJBQ0VBQ3lBQVFYOFFyUUVMQndBZ0FDU1pBZ3N2QUFKQUFrQUNRQUpBQWtBam1RSU9CQUVDQXdRQUN3QUxRUUVoQUF0QmZ5RUJDMEYvSVFJTElBRWdBaEN0QVFzQU14QnpiM1Z5WTJWTllYQndhVzVuVlZKTUlXTnZjbVV2WkdsemRDOWpiM0psTG5WdWRHOTFZMmhsWkM1M1lYTnRMbTFoY0E9PSIpOgphd2FpdCBOKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlRRVNZQXAvZjM5L2YzOS9mMzkvQUdBQUFHQUJmd0YvWUFKL2Z3QmdBWDhBWUFKL2Z3Ri9ZQUFCZjJBRGYzOS9BWDlnQTM5L2Z3QmdCbjkvZjM5L2Z3QmdCMzkvZjM5L2YzOEJmMkFIZjM5L2YzOS9md0JnQkg5L2YzOEJmMkFJZjM5L2YzOS9mMzhBWUFWL2YzOS9md0YvWUF4L2YzOS9mMzkvZjM5L2YzOEJmMkFBQUdBQ2YzOEJmd1BWQWRNQkFnSUJBUU1CQVFFQkFRRUJBUUVFQkFFQkFRQUdBUUVCQVFFQkFRRUVCQUVCQVFFQkFRRUJCZ1lHQmc0RkJ3Y1BDZ3NKQ1FnSUF3UUJBUVFCQkFFQkFRRUJBZ0lGQWdJQ0FnVU1CQVFFQVFJR0FnSURCQVFFQkFFQkFRRUVCUVFHQmdRREFnVUVBUkFFQlFNSUFRVUJCQUVGQkFRR0JnTUZCQU1FQkFRREF3Z0NBZ0lFQWdJQ0FnSUNBZ01FQkFJRUJBSUVCQUlFQkFJQ0FnSUNBZ0lDQWdJQ0JRSUNBZ0lDQWdRR0JnWVJCZ0lDQlFZR0JnSURCQVFOQmdZR0JnWUdCZ1lHQmdZR0JBRUJCZ1lHQmdFQkFRSUVCd1FFQVhBQUFRVURBUUFBQnBjTW1nSi9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUVlDQUFRdC9BRUdBa0FFTGZ3QkJnSUFDQzM4QVFZQ1FBd3QvQUVHQWdBRUxmd0JCZ0JBTGZ3QkJnSUFFQzM4QVFZQ1FCQXQvQUVHQUFRdC9BRUdBa1FRTGZ3QkJnTGdCQzM4QVFZREpCUXQvQUVHQTJBVUxmd0JCZ0tFTEMzOEFRWUNBREF0L0FFR0FvUmNMZndCQmdJQUpDMzhBUVlDaElBdC9BRUdBK0FBTGZ3QkJnSkFFQzM4QVFZQ0pIUXQvQUVHQW1TRUxmd0JCZ0lBSUMzOEFRWUNaS1F0L0FFR0FnQWdMZndCQmdKa3hDMzhBUVlDQUNBdC9BRUdBbVRrTGZ3QkJnSUFJQzM4QVFZQ1p3UUFMZndCQmdJQUlDMzhBUVlDWnlRQUxmd0JCZ0lBSUMzOEFRWUNaMFFBTGZ3QkJnSWo0QXd0L0FFR0FvY2tFQzM4QVFmLy9Bd3QvQUVFQUMzOEFRWUNoelFRTGZ3QkJsQUVMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWMvK0F3dC9BVUVBQzM4QlFmRCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUThMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIL0FBdC9BVUgvQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVlDbzFya0hDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUQzQWd0L0FVR0FnQWdMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSFYvZ01MZndGQjBmNERDMzhCUWRMK0F3dC9BVUhUL2dNTGZ3RkIxUDREQzM4QlFlaitBd3QvQVVIci9nTUxmd0ZCNmY0REMzOEJRUUFMZndGQkFRdC9BVUVDQzM4QVFZQ2h6UVFMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQkFMZndCQmdJQUVDMzhBUVlDUUJBdC9BRUdBa0FRTGZ3QkJnQUVMZndCQmdNa0ZDMzhBUVlDaEN3dC9BRUdBb1JjTGZ3QkJnSm5CQUF0L0FFR0FtY2tBQzM4QVFZQ1owUUFMZndGQkFBc0h1eEpzQm0xbGJXOXllUUlBQlhSaFlteGxBUUFHWTI5dVptbG5BQk1PYUdGelEyOXlaVk4wWVhKMFpXUUFGQWx6WVhabFUzUmhkR1VBR3dsc2IyRmtVM1JoZEdVQUpnVnBjMGRDUXdBbkVtZGxkRk4wWlhCelVHVnlVM1JsY0ZObGRBQW9DMmRsZEZOMFpYQlRaWFJ6QUNrSVoyVjBVM1JsY0hNQUtoVmxlR1ZqZFhSbFRYVnNkR2x3YkdWR2NtRnRaWE1BcndFTVpYaGxZM1YwWlVaeVlXMWxBSzRCQ0Y5elpYUmhjbWRqQU5FQkdXVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVc4QTBBRWJaWGhsWTNWMFpVWnlZVzFsVlc1MGFXeENjbVZoYTNCdmFXNTBBTEFCS0dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzlWYm5ScGJFSnlaV0ZyY0c5cGJuUUFzUUVWWlhobFkzVjBaVlZ1ZEdsc1EyOXVaR2wwYVc5dUFOSUJDMlY0WldOMWRHVlRkR1Z3QUtzQkZHZGxkRU41WTJ4bGMxQmxja041WTJ4bFUyVjBBTElCREdkbGRFTjVZMnhsVTJWMGN3Q3pBUWxuWlhSRGVXTnNaWE1BdEFFT2MyVjBTbTk1Y0dGa1UzUmhkR1VBdVFFZloyVjBUblZ0WW1WeVQyWlRZVzF3YkdWelNXNUJkV1JwYjBKMVptWmxjZ0NzQVJCamJHVmhja0YxWkdsdlFuVm1abVZ5QUNJWFYwRlRUVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRES2hOWFFWTk5RazlaWDAxRlRVOVNXVjlUU1ZwRkF5c1NWMEZUVFVKUFdWOVhRVk5OWDFCQlIwVlRBeXdlUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgweFBRMEZVU1U5T0F3QWFRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDFOSldrVURBUlpYUVZOTlFrOVpYMU5VUVZSRlgweFBRMEZVU1U5T0F3SVNWMEZUVFVKUFdWOVRWRUZVUlY5VFNWcEZBd01nUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNERDaHhIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXdzU1ZrbEVSVTlmVWtGTlgweFBRMEZVU1U5T0F3UU9Wa2xFUlU5ZlVrRk5YMU5KV2tVREJSRlhUMUpMWDFKQlRWOU1UME5CVkVsUFRnTUdEVmRQVWt0ZlVrRk5YMU5KV2tVREJ5WlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01JSWs5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VEQ1JoSFVrRlFTRWxEVTE5UFZWUlFWVlJmVEU5RFFWUkpUMDRER0JSSFVrRlFTRWxEVTE5UFZWUlFWVlJmVTBsYVJRTVpGRWRDUTE5UVFVeEZWRlJGWDB4UFEwRlVTVTlPQXd3UVIwSkRYMUJCVEVWVVZFVmZVMGxhUlFNTkdFSkhYMUJTU1U5U1NWUlpYMDFCVUY5TVQwTkJWRWxQVGdNT0ZFSkhYMUJTU1U5U1NWUlpYMDFCVUY5VFNWcEZBdzhPUmxKQlRVVmZURTlEUVZSSlQwNERFQXBHVWtGTlJWOVRTVnBGQXhFWFFrRkRTMGRTVDFWT1JGOU5RVkJmVEU5RFFWUkpUMDRERWhOQ1FVTkxSMUpQVlU1RVgwMUJVRjlUU1ZwRkF4TVNWRWxNUlY5RVFWUkJYMHhQUTBGVVNVOU9BeFFPVkVsTVJWOUVRVlJCWDFOSldrVURGUkpQUVUxZlZFbE1SVk5mVEU5RFFWUkpUMDRERmc1UFFVMWZWRWxNUlZOZlUwbGFSUU1YRlVGVlJFbFBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWlFVUZWUkVsUFgwSlZSa1pGVWw5VFNWcEZBeU1aUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01hRlVOSVFVNU9SVXhmTVY5Q1ZVWkdSVkpmVTBsYVJRTWJHVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZURTlEUVZSSlQwNERIQlZEU0VGT1RrVk1YekpmUWxWR1JrVlNYMU5KV2tVREhSbERTRUZPVGtWTVh6TmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4NFZRMGhCVGs1RlRGOHpYMEpWUmtaRlVsOVRTVnBGQXg4WlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZ0ZVTklRVTVPUlV4Zk5GOUNWVVpHUlZKZlUwbGFSUU1oRmtOQlVsUlNTVVJIUlY5U1FVMWZURTlEUVZSSlQwNERKQkpEUVZKVVVrbEVSMFZmVWtGTlgxTkpXa1VESlJaRFFWSlVVa2xFUjBWZlVrOU5YMHhQUTBGVVNVOU9BeVlTUTBGU1ZGSkpSRWRGWDFKUFRWOVRTVnBGQXljZFJFVkNWVWRmUjBGTlJVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERLQmxFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeWtoWjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBQUFNWjJWMFVtVm5hWE4wWlhKQkFMb0JER2RsZEZKbFoybHpkR1Z5UWdDN0FReG5aWFJTWldkcGMzUmxja01BdkFFTVoyVjBVbVZuYVhOMFpYSkVBTDBCREdkbGRGSmxaMmx6ZEdWeVJRQytBUXhuWlhSU1pXZHBjM1JsY2tnQXZ3RU1aMlYwVW1WbmFYTjBaWEpNQU1BQkRHZGxkRkpsWjJsemRHVnlSZ0RCQVJGblpYUlFjbTluY21GdFEyOTFiblJsY2dEQ0FROW5aWFJUZEdGamExQnZhVzUwWlhJQXd3RVpaMlYwVDNCamIyUmxRWFJRY205bmNtRnRRMjkxYm5SbGNnREVBUVZuWlhSTVdRREZBUjFrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZVFER0FSaGtjbUYzVkdsc1pVUmhkR0ZVYjFkaGMyMU5aVzF2Y25rQXh3RVRaSEpoZDA5aGJWUnZWMkZ6YlUxbGJXOXllUURJQVFablpYUkVTVllBeVFFSFoyVjBWRWxOUVFES0FRWm5aWFJVVFVFQXl3RUdaMlYwVkVGREFNd0JFM1Z3WkdGMFpVUmxZblZuUjBKTlpXMXZjbmtBelFFR2RYQmtZWFJsQUs0QkRXVnRkV3hoZEdsdmJsTjBaWEFBcXdFU1oyVjBRWFZrYVc5UmRXVjFaVWx1WkdWNEFLd0JEM0psYzJWMFFYVmthVzlSZFdWMVpRQWlEbmRoYzIxTlpXMXZjbmxUYVhwbEE0c0NISGRoYzIxQ2IzbEpiblJsY201aGJGTjBZWFJsVEc5allYUnBiMjREakFJWWQyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVlRhWHBsQTQwQ0hXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVXh2WTJGMGFXOXVBNDRDR1dkaGJXVkNiM2xKYm5SbGNtNWhiRTFsYlc5eWVWTnBlbVVEandJVGRtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnT1FBaUptY21GdFpVbHVVSEp2WjNKbGMzTldhV1JsYjA5MWRIQjFkRXh2WTJGMGFXOXVBNU1DRzJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWTWIyTmhkR2x2YmdPUkFoZG5ZVzFsWW05NVEyOXNiM0pRWVd4bGRIUmxVMmw2WlFPU0FoVmlZV05yWjNKdmRXNWtUV0Z3VEc5allYUnBiMjREbEFJTGRHbHNaVVJoZEdGTllYQURsUUlUYzI5MWJtUlBkWFJ3ZFhSTWIyTmhkR2x2YmdPV0FoRm5ZVzFsUW5sMFpYTk1iMk5oZEdsdmJnT1lBaFJuWVcxbFVtRnRRbUZ1YTNOTWIyTmhkR2x2YmdPWEFnZ0N6Z0VKQ0FFQVFRQUxBYzhCQ3FYWUFkTUJ6d0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVF4MUlnRkZEUUFDUUNBQlFRRnJEZzBCQVFFQ0FnSUNBd01FQkFVR0FBc01CZ3NnQUVHQW1kRUFhZzhMSUFCQkFTTTRJZ0FqT1VVaUFRUi9JQUJGQlNBQkN4dEJEblJxUVlDWjBBQnFEd3NnQUVHQWtINXFJem9FZnlNN0VBRkJBWEVGUVFBTFFRMTBhZzhMSUFBalBFRU5kR3BCZ05uR0FHb1BDeUFBUVlDUWZtb1BDMEVBSVFFQ2Z5TTZCRUFqUFJBQlFRZHhJUUVMSUFGQkFVZ0xCRUJCQVNFQkN5QUJRUXgwSUFCcVFZRHdmV29QQ3lBQVFZQlFhZ3NKQUNBQUVBQXRBQUFMbVFFQVFRQWtQa0VBSkQ5QkFDUkFRUUFrUVVFQUpFSkJBQ1JEUVFBa1JFRUFKRVZCQUNSR1FRQWtSMEVBSkVoQkFDUkpRUUFrU2tFQUpFdEJBQ1JNUVFBa1RTTTZCRUJCRVNRL1FZQUJKRVpCQUNSQVFRQWtRVUgvQVNSQ1FkWUFKRU5CQUNSRVFRMGtSUVZCQVNRL1FiQUJKRVpCQUNSQVFSTWtRVUVBSkVKQjJBRWtRMEVCSkVSQnpRQWtSUXRCZ0FJa1NFSCsvd01rUnd1a0FRRUNmMEVBSkU1QkFTUlBRY2NDRUFFaEFVRUFKRkJCQUNSUlFRQWtVa0VBSkZOQkFDUTVJQUVFUUNBQlFRRk9JZ0FFUUNBQlFRTk1JUUFMSUFBRVFFRUJKRkVGSUFGQkJVNGlBQVJBSUFGQkJrd2hBQXNnQUFSQVFRRWtVZ1VnQVVFUFRpSUFCRUFnQVVFVFRDRUFDeUFBQkVCQkFTUlRCU0FCUVJsT0lnQUVRQ0FCUVI1TUlRQUxJQUFFUUVFQkpEa0xDd3NMQlVFQkpGQUxRUUVrT0VFQUpEd0xDd0FnQUJBQUlBRTZBQUFMTHdCQjBmNERRZjhCRUFSQjB2NERRZjhCRUFSQjAvNERRZjhCRUFSQjFQNERRZjhCRUFSQjFmNERRZjhCRUFRTG1BRUFRUUFrVkVFQUpGVkJBQ1JXUVFBa1YwRUFKRmhCQUNSWlFRQWtXaU02QkVCQmtBRWtWa0hBL2dOQmtRRVFCRUhCL2dOQmdRRVFCRUhFL2dOQmtBRVFCRUhIL2dOQi9BRVFCQVZCa0FFa1ZrSEEvZ05Ca1FFUUJFSEIvZ05CaFFFUUJFSEcvZ05CL3dFUUJFSEgvZ05CL0FFUUJFSEkvZ05CL3dFUUJFSEovZ05CL3dFUUJBdEJ6LzREUVFBUUJFSHcvZ05CQVJBRUMwOEFJem9FUUVIby9nTkJ3QUVRQkVIcC9nTkIvd0VRQkVIcS9nTkJ3UUVRQkVIci9nTkJEUkFFQlVIby9nTkIvd0VRQkVIcC9nTkIvd0VRQkVIcS9nTkIvd0VRQkVIci9nTkIvd0VRQkFzTEx3QkJrUDREUVlBQkVBUkJrZjREUWI4QkVBUkJrdjREUWZNQkVBUkJrLzREUWNFQkVBUkJsUDREUWI4QkVBUUxMQUJCbGY0RFFmOEJFQVJCbHY0RFFUOFFCRUdYL2dOQkFCQUVRWmorQTBFQUVBUkJtZjREUWJnQkVBUUxNZ0JCbXY0RFFmOEFFQVJCbS80RFFmOEJFQVJCblA0RFFaOEJFQVJCbmY0RFFRQVFCRUdlL2dOQnVBRVFCRUVCSkdzTExRQkJuLzREUWY4QkVBUkJvUDREUWY4QkVBUkJvZjREUVFBUUJFR2kvZ05CQUJBRVFhUCtBMEcvQVJBRUN6Z0FRUThrYkVFUEpHMUJEeVJ1UVE4a2IwRUFKSEJCQUNSeFFRQWtja0VBSkhOQi93QWtkRUgvQUNSMVFRRWtka0VCSkhkQkFDUjRDMmNBUVFBa1cwRUFKRnhCQUNSZFFRRWtYa0VCSkY5QkFTUmdRUUVrWVVFQkpHSkJBU1JqUVFFa1pFRUJKR1ZCQVNSbVFRQWtaMEVBSkdoQkFDUnBRUUFrYWhBSUVBa1FDaEFMUWFUK0EwSDNBQkFFUWFYK0EwSHpBUkFFUWFiK0EwSHhBUkFFRUF3TE9BQWdBRUVCY1VFQVJ5UjVJQUJCQW5GQkFFY2tlaUFBUVFSeFFRQkhKSHNnQUVFSWNVRUFSeVI4SUFCQkVIRkJBRWNrZlNBQUpINExQUUFnQUVFQmNVRUFSeVIvSUFCQkFuRkJBRWNrZ0FFZ0FFRUVjVUVBUnlTQkFTQUFRUWh4UVFCSEpJSUJJQUJCRUhGQkFFY2tnd0VnQUNTRUFRdGRBRUVBSklVQlFRQWtoZ0ZCQUNTSEFVRUFKSWdCUVFBa2lRRkJBQ1NLQVVFQUpJc0JRUUFrakFFak9nUkFRWVQrQTBFZUVBUkJvRDBraGdFRlFZVCtBMEdyQVJBRVFjelhBaVNHQVF0QmgvNERRZmdCRUFSQitBRWtpZ0VMUWdCQkFDU05BVUVBSkk0Qkl6b0VRRUdDL2dOQi9BQVFCRUVBSkk4QlFRQWtrQUZCQUNTUkFRVkJndjREUWY0QUVBUkJBQ1NQQVVFQkpKQUJRUUFra1FFTEMvWUJBUUovUWNNQ0VBRWlBVUhBQVVZaUFBUi9JQUFGSUFGQmdBRkdJeThpQUNBQUd3c0VRRUVCSkRvRlFRQWtPZ3NRQWhBREVBVVFCaEFIRUExQkFCQU9RZi8vQXlOK0VBUkI0UUVRRDBHUC9nTWpoQUVRQkJBUUVCRWpPZ1JBUWZEK0EwSDRBUkFFUWMvK0EwSCtBUkFFUWMzK0EwSCtBQkFFUVlEK0EwSFBBUkFFUVkvK0EwSGhBUkFFUWV6K0EwSCtBUkFFUWZYK0EwR1BBUkFFQlVIdy9nTkIvd0VRQkVIUC9nTkIvd0VRQkVITi9nTkIvd0VRQkVHQS9nTkJ6d0VRQkVHUC9nTkI0UUVRQkF0QkFDUXRRWUNvMXJrSEpKSUJRUUFra3dGQkFDU1VBVUdBcU5hNUJ5U1ZBVUVBSkpZQlFRQWtsd0VMcmdFQUlBQkJBRW9FUUVFQkpDNEZRUUFrTGdzZ0FVRUFTZ1JBUVFFa0x3VkJBQ1F2Q3lBQ1FRQktCRUJCQVNRd0JVRUFKREFMSUFOQkFFb0VRRUVCSkRFRlFRQWtNUXNnQkVFQVNnUkFRUUVrTWdWQkFDUXlDeUFGUVFCS0JFQkJBU1F6QlVFQUpETUxJQVpCQUVvRVFFRUJKRFFGUVFBa05Bc2dCMEVBU2dSQVFRRWtOUVZCQUNRMUN5QUlRUUJLQkVCQkFTUTJCVUVBSkRZTElBbEJBRW9FUUVFQkpEY0ZRUUFrTndzUUVnc01BQ010QkVCQkFROExRUUFMc2dFQVFZQUlJejg2QUFCQmdRZ2pRRG9BQUVHQ0NDTkJPZ0FBUVlNSUkwSTZBQUJCaEFnalF6b0FBRUdGQ0NORU9nQUFRWVlJSTBVNkFBQkJod2dqUmpvQUFFR0lDQ05IT3dFQVFZb0lJMGc3QVFCQmpBZ2pTVFlDQUNOS0JFQkJrUWhCQVRvQUFBVkJrUWhCQURvQUFBc2pTd1JBUVpJSVFRRTZBQUFGUVpJSVFRQTZBQUFMSTB3RVFFR1RDRUVCT2dBQUJVR1RDRUVBT2dBQUN5Tk5CRUJCbEFoQkFUb0FBQVZCbEFoQkFEb0FBQXNMckFFQVFjZ0pJemc3QVFCQnlna2pQRHNCQUNOT0JFQkJ6QWxCQVRvQUFBVkJ6QWxCQURvQUFBc2pUd1JBUWMwSlFRRTZBQUFGUWMwSlFRQTZBQUFMSTFBRVFFSE9DVUVCT2dBQUJVSE9DVUVBT2dBQUN5TlJCRUJCendsQkFUb0FBQVZCendsQkFEb0FBQXNqVWdSQVFkQUpRUUU2QUFBRlFkQUpRUUE2QUFBTEkxTUVRRUhSQ1VFQk9nQUFCVUhSQ1VFQU9nQUFDeU01QkVCQjBnbEJBVG9BQUFWQjBnbEJBRG9BQUFzTFN3QkIrZ2tqaFFFMkFnQkIvZ2tqaGdFMkFnQWppd0VFUUVHQ0NrRUJPZ0FBQlVHQ0NrRUFPZ0FBQ3lPTUFRUkFRWVVLUVFFNkFBQUZRWVVLUVFBNkFBQUxRWVgrQXlPSEFSQUVDM2dBSTVzQkJFQkIzZ3BCQVRvQUFBVkIzZ3BCQURvQUFBdEIzd29qbkFFMkFnQkI0d29qblFFMkFnQkI1d29qbmdFMkFnQkI3QW9qbndFMkFnQkI4UW9qb0FFNkFBQkI4Z29qb1FFNkFBQWpvZ0VFUUVIM0NrRUJPZ0FBQlVIM0NrRUFPZ0FBQzBINENpT2pBVFlDQUVIOUNpT2tBVHNCQUF0UEFDT2xBUVJBUVpBTFFRRTZBQUFGUVpBTFFRQTZBQUFMUVpFTEk2WUJOZ0lBUVpVTEk2Y0JOZ0lBUVprTEk2Z0JOZ0lBUVo0TEk2a0JOZ0lBUWFNTEk2b0JPZ0FBUWFRTEk2c0JPZ0FBQzBZQUk3QUJCRUJCOUF0QkFUb0FBQVZCOUF0QkFEb0FBQXRCOVFzanNRRTJBZ0JCK1FzanNnRTJBZ0JCL1FzanN3RTJBZ0JCZ2d3anRBRTJBZ0JCaHd3anRRRTdBUUFMb3dFQUVCVkJzZ2dqVlRZQ0FFRzJDQ09ZQVRvQUFFSEUvZ01qVmhBRUk1a0JCRUJCNUFoQkFUb0FBQVZCNUFoQkFEb0FBQXNqbWdFRVFFSGxDRUVCT2dBQUJVSGxDRUVBT2dBQUN4QVdFQmRCckFvalp6WUNBRUd3Q2lOb09nQUFRYkVLSTJrNkFBQVFHQkFaSTZ3QkJFQkJ3Z3RCQVRvQUFBVkJ3Z3RCQURvQUFBdEJ3d3NqclFFMkFnQkJ4d3NqcmdFMkFnQkJ5d3NqcndFN0FRQVFHa0VBSkMwTHJnRUFRWUFJTFFBQUpEOUJnUWd0QUFBa1FFR0NDQzBBQUNSQlFZTUlMUUFBSkVKQmhBZ3RBQUFrUTBHRkNDMEFBQ1JFUVlZSUxRQUFKRVZCaHdndEFBQWtSa0dJQ0M4QkFDUkhRWW9JTHdFQUpFaEJqQWdvQWdBa1NRSi9RUUZCa1FndEFBQkJBRW9OQUJwQkFBc2tTZ0ovUVFGQmtnZ3RBQUJCQUVvTkFCcEJBQXNrU3dKL1FRRkJrd2d0QUFCQkFFb05BQnBCQUFza1RBSi9RUUZCbEFndEFBQkJBRW9OQUJwQkFBc2tUUXRjQVFGL1FRQWtWVUVBSkZaQnhQNERRUUFRQkVIQi9nTVFBVUY4Y1NFQlFRQWttQUZCd2Y0RElBRVFCQ0FBQkVBQ1FFRUFJUUFEUUNBQVFZQ0pIVTROQVNBQVFZQ1FCR3BCL3dFNkFBQWdBRUVCYWlFQURBQUFDd0FMQ3d1SUFRRUJmeU8yQVNFQklBQkJnQUZ4UVFCSEpMWUJJQUJCd0FCeFFRQkhKTGNCSUFCQklIRkJBRWNrdUFFZ0FFRVFjVUVBUnlTNUFTQUFRUWh4UVFCSEpMb0JJQUJCQkhGQkFFY2t1d0VnQUVFQ2NVRUFSeVM4QVNBQVFRRnhRUUJISkwwQkk3WUJSU0FCSUFFYkJFQkJBUkFkQ3lBQlJTSUFCSDhqdGdFRklBQUxCRUJCQUJBZEN3cytBQUovUVFGQjVBZ3RBQUJCQUVvTkFCcEJBQXNrbVFFQ2YwRUJRZVVJTFFBQVFRQktEUUFhUVFBTEpKb0JRZi8vQXhBQkVBNUJqLzRERUFFUUR3dWxBUUJCeUFrdkFRQWtPRUhLQ1M4QkFDUThBbjlCQVVITUNTMEFBRUVBU2cwQUdrRUFDeVJPQW45QkFVSE5DUzBBQUVFQVNnMEFHa0VBQ3lSUEFuOUJBVUhPQ1MwQUFFRUFTZzBBR2tFQUN5UlFBbjlCQVVIUENTMEFBRUVBU2cwQUdrRUFDeVJSQW45QkFVSFFDUzBBQUVFQVNnMEFHa0VBQ3lSU0FuOUJBVUhSQ1MwQUFFRUFTZzBBR2tFQUN5UlRBbjlCQVVIU0NTMEFBRUVBU2cwQUdrRUFDeVE1QzFzQVFmb0pLQUlBSklVQlFmNEpLQUlBSklZQkFuOUJBVUdDQ2kwQUFFRUFTZzBBR2tFQUN5U0xBUUovUVFGQmhRb3RBQUJCQUVvTkFCcEJBQXNrakFGQmhmNERFQUVraHdGQmh2NERFQUVraUFGQmgvNERFQUVraWdFTEJnQkJBQ1JxQzNZQUFuOUJBVUhlQ2kwQUFFRUFTZzBBR2tFQUN5U2JBVUhmQ2lnQ0FDU2NBVUhqQ2lnQ0FDU2RBVUhuQ2lnQ0FDU2VBVUhzQ2lnQ0FDU2ZBVUh4Q2kwQUFDU2dBVUh5Q2kwQUFDU2hBUUovUVFGQjl3b3RBQUJCQUVvTkFCcEJBQXNrb2dGQitBb29BZ0Frb3dGQi9Rb3ZBUUFrcEFFTFRnQUNmMEVCUVpBTExRQUFRUUJLRFFBYVFRQUxKS1VCUVpFTEtBSUFKS1lCUVpVTEtBSUFKS2NCUVprTEtBSUFKS2dCUVo0TEtBSUFKS2tCUWFNTExRQUFKS29CUWFRTExRQUFKS3NCQzBVQUFuOUJBVUgwQ3kwQUFFRUFTZzBBR2tFQUN5U3dBVUgxQ3lnQ0FDU3hBVUg1Q3lnQ0FDU3lBVUg5Q3lnQ0FDU3pBVUdDRENnQ0FDUzBBVUdIREM4QkFDUzFBUXZRQVFFQmZ4QWNRYklJS0FJQUpGVkJ0Z2d0QUFBa21BRkJ4UDRERUFFa1ZrSEEvZ01RQVJBZUVCOUJnUDRERUFGQi93RnpKTDRCSTc0QklnQkJFSEZCQUVja3Z3RWdBRUVnY1VFQVJ5VEFBUkFnRUNGQnJBb29BZ0FrWjBHd0NpMEFBQ1JvUWJFS0xRQUFKR2xCQUNScUVDTVFKQUovUVFGQndnc3RBQUJCQUVvTkFCcEJBQXNrckFGQnd3c29BZ0FrclFGQnh3c29BZ0FrcmdGQnl3c3ZBUUFrcndFUUpVRUFKQzFCZ0tqV3VRY2trZ0ZCQUNTVEFVRUFKSlFCUVlDbzFya0hKSlVCUVFBa2xnRkJBQ1NYQVFzTUFDTTZCRUJCQVE4TFFRQUxCUUFqbFFFTEJRQWpsZ0VMQlFBamx3RUwyQUlCQlg4Q2Z3Si9JQUZCQUVvaUJRUkFJQUJCQ0VvaEJRc2dCUXNFUUNQQ0FTQUVSaUVGQ3lBRkN3Ui9JOE1CSUFCR0JTQUZDd1JBUVFBaEJVRUFJUVFnQTBFQmF4QUJRU0J4QkVCQkFTRUZDeUFERUFGQklIRUVRRUVCSVFRTFFRQWhBd05BSUFOQkNFZ0VRRUVISUFOcklBTWdCQ0FGUnhzaUF5QUFha0dnQVV3RVFDQUFRUWdnQTJ0cklRY2dBQ0FEYWlBQlFhQUJiR3BCQTJ4QmdNa0ZhaUVKUVFBaEJnTkFJQVpCQTBnRVFDQUFJQU5xSUFGQm9BRnNha0VEYkVHQXlRVnFJQVpxSUFZZ0NXb3RBQUE2QUFBZ0JrRUJhaUVHREFFTEN5QUFJQU5xSUFGQm9BRnNha0dBa1FScUlBRkJvQUZzSUFkcVFZQ1JCR290QUFBaUJrRURjU0lIUVFSeUlBY2dCa0VFY1JzNkFBQWdDRUVCYWlFSUN5QURRUUZxSVFNTUFRc0xCU0FFSk1JQkN5QUFJOE1CVGdSQUlBQkJDR29rd3dFZ0FDQUNRUWh2SWdSSUJFQWp3d0VnQkdva3d3RUxDeUFJQ3pnQkFYOGdBRUdBa0FKR0JFQWdBVUdBQVdvaEFpQUJRWUFCY1FSQUlBRkJnQUZySVFJTElBSkJCSFFnQUdvUEN5QUJRUVIwSUFCcUMwb0FJQUJCQTNRZ0FVRUJkR29pQUVFQmFrRS9jU0lCUVVCcklBRWdBaHRCZ0pBRWFpMEFBQ0VCSUFCQlAzRWlBRUZBYXlBQUlBSWJRWUNRQkdvdEFBQWdBVUgvQVhGQkNIUnlDMUVBSUFKRkJFQWdBUkFCSUFCQkFYUjFRUU54SVFBTFFmSUJJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXd0Qm9BRWhBUXdDQzBIWUFDRUJEQUVMUVFnaEFRc2dBUXZoQWdFSGZ5QUJJQUFRTENBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnMGdDRWdFUUVFSElBQnJJUVVnQzBFQVNDSUNCSDhnQWdVZ0MwRWdjVVVMSVFGQkFDRUNBbjlCQVNBRklBQWdBUnNpQVhRZ0VuRUVRRUVDSVFJTElBSkJBV29MSUFKQkFTQUJkQ0FSY1JzaEFpQUxRUUJPQkg4Z0MwRUhjU0FDUVFBUUxTSUZRUjl4UVFOMElRNGdCVUhnQjNGQkJYVkJBM1FoQVNBRlFZRDRBWEZCQ25WQkEzUUZJQUpCeC80RElBOGdEMEVBVEJzaUR5QUtFQzRpQlNFT0lBVWlBUXNoQlNBSElBaHNJQTFxUVFOc0lBbHFJaEFnRGpvQUFDQVFRUUZxSUFFNkFBQWdFRUVDYWlBRk9nQUFJQWRCb0FGc0lBMXFRWUNSQkdvZ0FrRURjU0lCUVFSeUlBRWdDMEdBQVhGQkFFZEJBQ0FMUVFCT0d4czZBQUFnREVFQmFpRU1DeUFBUVFGcUlRQU1BUXNMSUF3TGZnRURmeUFEUVFodklRTWdBRVVFUUNBQ0lBSkJDRzFCQTNScklRY0xRYUFCSUFCclFRY2dBRUVJYWtHZ0FVb2JJUWxCZnlFQ0l6b0VRQ0FFUVlEUWZtb3RBQUFpQWtFSWNRUkFRUUVoQ0FzZ0FrSEFBSEVFUUVFSElBTnJJUU1MQ3lBR0lBVWdDQ0FISUFrZ0F5QUFJQUZCb0FGQmdNa0ZRUUFnQWhBdkM2WUNBQ0FGSUFZUUxDRUdJQU5CQ0c4aEF5QUVRWURRZm1vdEFBQWlCRUhBQUhFRWYwRUhJQU5yQlNBREMwRUJkQ0FHYWlJRFFZQ1FmbXBCQVVFQUlBUkJDSEViUVFGeFFRMTBJZ1ZxTFFBQUlRWWdBMEdCa0g1cUlBVnFMUUFBSVFVZ0FrRUlieUVEUVFBaEFpQUJRYUFCYkNBQWFrRURiRUdBeVFWcUlBUkJCM0VDZjBFQklBTkJCeUFEYXlBRVFTQnhHeUlEZENBRmNRUkFRUUloQWdzZ0FrRUJhZ3NnQWtFQklBTjBJQVp4R3lJQ1FRQVFMU0lEUVI5eFFRTjBPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZSEpCV29nQTBIZ0IzRkJCWFZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQURRWUQ0QVhGQkNuVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQmdKRUVhaUFDUVFOeElnQkJCSElnQUNBRVFZQUJjUnM2QUFBTHRRRUFJQVFnQlJBc0lBTkJDRzlCQVhScUlnUkJnSkIrYWkwQUFDRUZRUUFoQXlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxQW44Z0JFR0JrSDVxTFFBQVFRRkJCeUFDUVFodmF5SUNkSEVFUUVFQ0lRTUxJQU5CQVdvTElBTkJBU0FDZENBRmNSc2lBMEhIL2dOQkFCQXVJZ0k2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ09nQUFJQUZCb0FGc0lBQnFRUU5zUVlMSkJXb2dBam9BQUNBQlFhQUJiQ0FBYWtHQWtRUnFJQU5CQTNFNkFBQUwxUUVCQm44Z0EwRURkU0VMQTBBZ0JFR2dBVWdFUUNBRUlBVnFJZ1pCZ0FKT0JFQWdCa0dBQW1zaEJnc2dDMEVGZENBQ2FpQUdRUU4xYWlJSlFZQ1FmbW90QUFBaENFRUFJUW9qTmdSQUlBUWdBQ0FHSUFrZ0NCQXJJZ2RCQUVvRVFFRUJJUW9nQjBFQmF5QUVhaUVFQ3dzZ0NrVWpOU0lISUFjYkJFQWdCQ0FBSUFZZ0F5QUpJQUVnQ0JBd0lnZEJBRW9FUUNBSFFRRnJJQVJxSVFRTEJTQUtSUVJBSXpvRVFDQUVJQUFnQmlBRElBa2dBU0FJRURFRklBUWdBQ0FHSUFNZ0FTQUlFRElMQ3dzZ0JFRUJhaUVFREFFTEN3c3JBUUYvSTFjaEF5QUFJQUVnQWlOWUlBQnFJZ0JCZ0FKT0JIOGdBRUdBQW1zRklBQUxRUUFnQXhBekN6QUJBMzhqV1NFRElBQWpXaUlFU0FSQUR3c2dBMEVIYXlJRFFYOXNJUVVnQUNBQklBSWdBQ0FFYXlBRElBVVFNd3ZFQlFFUGZ3SkFRU2NoQ1FOQUlBbEJBRWdOQVNBSlFRSjBJZ1JCZ1B3RGFoQUJJUUlnQkVHQi9BTnFFQUVoQ2lBRVFZTDhBMm9RQVNFRElBSkJFR3NoQWlBS1FRaHJJUXBCQ0NFRklBRUVRRUVRSVFVZ0EwRUNiMEVCUmdSL0lBTkJBV3NGSUFNTElRTUxJQUFnQWs0aUJnUkFJQUFnQWlBRmFrZ2hCZ3NnQmdSQUlBUkJnL3dEYWhBQklnWkJnQUZ4UVFCSElRc2dCa0VnY1VFQVJ5RU9RWUNBQWlBREVDd2dBQ0FDYXlJQ0lBVnJRWDlzUVFGcklBSWdCa0hBQUhFYlFRRjBhaUlEUVlDUWZtcEJBVUVBSUFaQkNIRkJBRWNqT2lJQ0lBSWJHMEVCY1VFTmRDSUNhaTBBQUNFUElBTkJnWkIrYWlBQ2FpMEFBQ0VRUVFjaEJRTkFJQVZCQUU0RVFFRUFJUWdDZjBFQklBVWlBa0VIYTBGL2JDQUNJQTRiSWdKMElCQnhCRUJCQWlFSUN5QUlRUUZxQ3lBSVFRRWdBblFnRDNFYklnZ0VRRUVISUFWcklBcHFJZ2RCQUU0aUFnUkFJQWRCb0FGTUlRSUxJQUlFUUVFQUlReEJBQ0VOUVFGQkFDTzlBVVVqT2lJRElBTWJHeUlDUlFSQUlBQkJvQUZzSUFkcVFZQ1JCR290QUFBaUEwRURjU0lFUVFCS0lBc2dDeHNFUUVFQklRd0ZJQU5CQkhGQkFFY2pPaUlESUFNYklnTUVRQ0FFUVFCS0lRTUxRUUZCQUNBREd5RU5Dd3NnQWtVRVFDQU1SU0lFQkg4Z0RVVUZJQVFMSVFJTElBSUVRQ002QkVBZ0FFR2dBV3dnQjJwQkEyeEJnTWtGYWlBR1FRZHhJQWhCQVJBdElnUkJIM0ZCQTNRNkFBQWdBRUdnQVd3Z0IycEJBMnhCZ2NrRmFpQUVRZUFIY1VFRmRVRURkRG9BQUNBQVFhQUJiQ0FIYWtFRGJFR0N5UVZxSUFSQmdQZ0JjVUVLZFVFRGREb0FBQVVnQUVHZ0FXd2dCMnBCQTJ4QmdNa0ZhaUFJUWNuK0EwSEkvZ01nQmtFUWNSdEJBQkF1SWdNNkFBQWdBRUdnQVd3Z0IycEJBMnhCZ2NrRmFpQURPZ0FBSUFCQm9BRnNJQWRxUVFOc1FZTEpCV29nQXpvQUFBc0xDd3NnQlVFQmF5RUZEQUVMQ3dzZ0NVRUJheUVKREFBQUN3QUxDMllCQW45QmdKQUNJUUZCZ0lBQ1FZQ1FBaU81QVJzaEFTTTZJNzBCSXpvYkJFQkJnTEFDSVFJZ0FDQUJRWUM0QWtHQXNBSWp1Z0ViRURRTEk3Z0JCRUJCZ0xBQ0lRSWdBQ0FCUVlDNEFrR0FzQUlqdHdFYkVEVUxJN3dCQkVBZ0FDTzdBUkEyQ3dzbEFRRi9Ba0FEUUNBQVFaQUJTdzBCSUFCQi93RnhFRGNnQUVFQmFpRUFEQUFBQ3dBTEMwWUJBbjhEUUNBQlFaQUJUa1VFUUVFQUlRQURRQ0FBUWFBQlNBUkFJQUZCb0FGc0lBQnFRWUNSQkdwQkFEb0FBQ0FBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3dzTEhRRUJmMEdQL2dNUUFVRUJJQUIwY2lJQkpJUUJRWS8rQXlBQkVBUUxDd0JCQVNTQUFVRUJFRG9MUlFFQ2YwR1UvZ01RQVVINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBRVFaVCtBeUFCSUFCQkNIVWlBSElRQkNBQ0pNOEJJQUFrMEFFanp3RWowQUZCQ0hSeUpORUJDMllCQW44anBBRWlBU1BOQVhVaEFDQUJJQUJySUFBZ0FXb2p6Z0ViSWdCQi93OU1JZ0VFZnlQTkFVRUFTZ1VnQVFzRVFDQUFKS1FCSUFBUVBDT2tBU0lCSTgwQmRTRUFJQUVnQUdzZ0FDQUJhaVBPQVJzaEFBc2dBRUgvRDBvRVFFRUFKSnNCQ3dzc0FDT2pBVUVCYXlTakFTT2pBVUVBVEFSQUk4d0JKS01CSTh3QlFRQktJNklCSTZJQkd3UkFFRDBMQ3d0YkFRRi9JNTBCUVFGckpKMEJJNTBCUVFCTUJFQWowZ0VrblFFam5RRUVRQ09mQVVFUFNDUFRBU1BUQVJzRVFDT2ZBVUVCYWlTZkFRVWowd0ZGSWdBRVFDT2ZBVUVBU2lFQUN5QUFCRUFqbndGQkFXc2tud0VMQ3dzTEMxc0JBWDhqcHdGQkFXc2twd0VqcHdGQkFFd0VRQ1BVQVNTbkFTT25BUVJBSTZrQlFROUlJOVVCSTlVQkd3UkFJNmtCUVFGcUpLa0JCU1BWQVVVaUFBUkFJNmtCUVFCS0lRQUxJQUFFUUNPcEFVRUJheVNwQVFzTEN3c0xXd0VCZnlPeUFVRUJheVN5QVNPeUFVRUFUQVJBSTlZQkpMSUJJN0lCQkVBanRBRkJEMGdqMXdFajF3RWJCRUFqdEFGQkFXb2t0QUVGSTljQlJTSUFCRUFqdEFGQkFFb2hBQXNnQUFSQUk3UUJRUUZySkxRQkN3c0xDd3VPQmdBalp5QUFhaVJuSTJjalBnUi9RWUNBQVFWQmdNQUFDMDRFUUNObkl6NEVmMEdBZ0FFRlFZREFBQXRySkdjQ1FBSkFBa0FDUUFKQUkya2lBQVJBSUFCQkFtc09CZ0VGQWdVREJBVUxJNTRCUVFCS0lnQUVmeVBJQVFVZ0FBc0VRQ09lQVVFQmF5U2VBUXNqbmdGRkJFQkJBQ1NiQVFzanFBRkJBRW9pQUFSL0k4a0JCU0FBQ3dSQUk2Z0JRUUZySktnQkN5T29BVVVFUUVFQUpLVUJDeU91QVVFQVNpSUFCSDhqeWdFRklBQUxCRUFqcmdGQkFXc2tyZ0VMSTY0QlJRUkFRUUFrckFFTEk3TUJRUUJLSWdBRWZ5UExBUVVnQUFzRVFDT3pBVUVCYXlTekFRc2pzd0ZGQkVCQkFDU3dBUXNNQkFzam5nRkJBRW9pQUFSL0k4Z0JCU0FBQ3dSQUk1NEJRUUZySko0QkN5T2VBVVVFUUVFQUpKc0JDeU9vQVVFQVNpSUFCSDhqeVFFRklBQUxCRUFqcUFGQkFXc2txQUVMSTZnQlJRUkFRUUFrcFFFTEk2NEJRUUJLSWdBRWZ5UEtBUVVnQUFzRVFDT3VBVUVCYXlTdUFRc2pyZ0ZGQkVCQkFDU3NBUXNqc3dGQkFFb2lBQVIvSThzQkJTQUFDd1JBSTdNQlFRRnJKTE1CQ3lPekFVVUVRRUVBSkxBQkN4QStEQU1MSTU0QlFRQktJZ0FFZnlQSUFRVWdBQXNFUUNPZUFVRUJheVNlQVFzam5nRkZCRUJCQUNTYkFRc2pxQUZCQUVvaUFBUi9JOGtCQlNBQUN3UkFJNmdCUVFGckpLZ0JDeU9vQVVVRVFFRUFKS1VCQ3lPdUFVRUFTaUlBQkg4anlnRUZJQUFMQkVBanJnRkJBV3NrcmdFTEk2NEJSUVJBUVFBa3JBRUxJN01CUVFCS0lnQUVmeVBMQVFVZ0FBc0VRQ096QVVFQmF5U3pBUXNqc3dGRkJFQkJBQ1N3QVFzTUFnc2puZ0ZCQUVvaUFBUi9JOGdCQlNBQUN3UkFJNTRCUVFGckpKNEJDeU9lQVVVRVFFRUFKSnNCQ3lPb0FVRUFTaUlBQkg4anlRRUZJQUFMQkVBanFBRkJBV3NrcUFFTEk2Z0JSUVJBUVFBa3BRRUxJNjRCUVFCS0lnQUVmeVBLQVFVZ0FBc0VRQ091QVVFQmF5U3VBUXNqcmdGRkJFQkJBQ1NzQVFzanN3RkJBRW9pQUFSL0k4c0JCU0FBQ3dSQUk3TUJRUUZySkxNQkN5T3pBVVVFUUVFQUpMQUJDeEErREFFTEVEOFFRQkJCQ3lOcFFRRnFKR2tqYVVFSVRnUkFRUUFrYVF0QkFROExRUUFMZ3dFQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBZ0FDSUJRUUpHRFFFZ0FVRURSZzBDSUFGQkJFWU5Bd3dFQ3lOd0k5a0JSd1JBSTlrQkpIQkJBUThMUVFBUEN5TnhJOW9CUndSQUk5b0JKSEZCQVE4TFFRQVBDeU55STlzQlJ3UkFJOXNCSkhKQkFROExRUUFQQ3lOekk5d0JSd1JBSTl3QkpITkJBUThMUVFBUEMwRUFDMVVBQWtBQ1FBSkFJQUJCQVVjRVFDQUFRUUpHRFFFZ0FFRURSZzBDREFNTFFRRWdBWFJCZ1FGeFFRQkhEd3RCQVNBQmRFR0hBWEZCQUVjUEMwRUJJQUYwUWY0QWNVRUFSdzhMUVFFZ0FYUkJBWEZCQUVjTGlnRUJBWDhqbkFFZ0FHc2tuQUVqbkFGQkFFd0VRQ09jQVNJQlFSOTFJUUJCZ0JBajBRRnJRUUowSkp3Qkl6NEVRQ09jQVVFQmRDU2NBUXNqbkFFZ0FDQUJhaUFBYzJza25BRWpvUUZCQVdva29RRWpvUUZCQ0U0RVFFRUFKS0VCQ3dzajJRRWptd0VpQUNBQUd3Ui9JNThCQlVFUER3c2o0QUVqb1FFUVJBUi9RUUVGUVg4TGJFRVBhZ3VLQVFFQmZ5T21BU0FBYXlTbUFTT21BVUVBVEFSQUk2WUJJZ0ZCSDNVaEFFR0FFQ1BoQVd0QkFuUWtwZ0VqUGdSQUk2WUJRUUYwSktZQkN5T21BU0FBSUFGcUlBQnpheVNtQVNPckFVRUJhaVNyQVNPckFVRUlUZ1JBUVFBa3F3RUxDeVBhQVNPbEFTSUFJQUFiQkg4anFRRUZRUThQQ3lQaUFTT3JBUkJFQkg5QkFRVkJmd3RzUVE5cUM1a0NBUUovSTYwQklBQnJKSzBCSTYwQlFRQk1CRUFqclFFaUFrRWZkU0VBUVlBUUkrTUJhMEVCZENTdEFTTStCRUFqclFGQkFYUWtyUUVMSTYwQklBQWdBbW9nQUhOckpLMEJJNjhCUVFGcUpLOEJJNjhCUVNCT0JFQkJBQ1N2QVFzTFFRQWhBaVBrQVNFQUk5c0JJNndCSWdFZ0FSc0VRQ05yQkVCQm5QNERFQUZCQlhWQkQzRWlBQ1RrQVVFQUpHc0xCVUVQRHdzanJ3RkJBbTFCc1A0RGFoQUJJUUVqcndGQkFtOEVmeUFCUVE5eEJTQUJRUVIxUVE5eEN5RUJBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BU0FBUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEFnd0NDeUFCUVFGMUlRRkJBaUVDREFFTElBRkJBblVoQVVFRUlRSUxJQUpCQUVvRWZ5QUJJQUp0QlVFQUMwRVBhZ3VyQVFFQmZ5T3hBU0FBYXlTeEFTT3hBVUVBVEFSQUk3RUJJUUFqNVFFajVnRjBJZ0ZCQVhRZ0FTTStHeVN4QVNPeEFTQUFRUjkxSWdFZ0FDQUJhbk5ySkxFQkk3VUJJZ0JCQVhFaEFTQUFRUUYxSWdBa3RRRWp0UUVnQVNBQVFRRnhjeUlCUVE1MGNpUzFBU1BuQVFSQUk3VUJRYjkvY1NTMUFTTzFBU0FCUVFaMGNpUzFBUXNMSTl3Qkk3QUJJZ0FnQUJzRWZ5TzBBUVZCRHc4TFFYOUJBU08xQVVFQmNSdHNRUTlxQ3pBQUlBQkJQRVlFUUVIL0FBOExJQUJCUEd0Qm9JMEdiQ0FCYkVFSWJVR2dqUVp0UVR4cVFhQ05CbXhCalBFQ2JRdWNBUUVCZjBFQUpIWWdBRUVQSTE0YklnUWdBV29nQkVFUGFpTmZHeUlFSUFKcUlBUkJEMm9qWUJzaEJDQURJQUlnQVNBQVFROGpZaHNpQUdvZ0FFRVBhaU5qR3lJQWFpQUFRUTlxSTJRYklnQnFJQUJCRDJvalpSc2hBRUVBSkhkQkFDUjRJQU1nQkdvZ0JFRVBhaU5oR3lOY1FRRnFFRWtoQVNBQUkxMUJBV29RU1NFQUlBRWtkQ0FBSkhVZ0FFSC9BWEVnQVVIL0FYRkJDSFJ5QzhNREFRVi9BbjhqMkFFZ0FHb2syQUZCQUNPY0FTUFlBV3RCQUVvTkFCcEJBUXNpQVVVRVFFRUJFRU1oQVFzQ2Z5UGRBU0FBYWlUZEFVRUFJNllCSTkwQmEwRUFTZzBBR2tFQkN5SUVSUVJBUVFJUVF5RUVDd0ovSTk0QklBQnFKTjRCSTYwQkk5NEJhMEVBU2lJQ0JFQWphMFVoQWd0QkFDQUNEUUFhUVFFTElnSkZCRUJCQXhCRElRSUxBbjhqM3dFZ0FHb2szd0ZCQUNPeEFTUGZBV3RCQUVvTkFCcEJBUXNpQlVVRVFFRUVFRU1oQlFzZ0FRUkFJOWdCSVFOQkFDVFlBU0FERUVVa2JBc2dCQVJBSTkwQklRTkJBQ1RkQVNBREVFWWtiUXNnQWdSQUk5NEJJUU5CQUNUZUFTQURFRWNrYmdzZ0JRUkFJOThCSVFOQkFDVGZBU0FERUVna2J3c0NmeUFCSUFRZ0FSc2lBVVVFUUNBQ0lRRUxJQUZGQ3dSQUlBVWhBUXNnQVFSQVFRRWtlQXNqYUNQb0FTQUFiR29rYUNOb1FZQ0FnQVJCZ0lDQUFpTStHMDRFUUNOb1FZQ0FnQVJCZ0lDQUFpTStHMnNrYUNONElnQWpkaUFBR3lJQlJRUkFJM2NoQVFzZ0FRUkFJMndqYlNOdUkyOFFTaG9MSTJvaUFVRUJkRUdBbWNFQWFpSUFJM1JCQW1vNkFBQWdBRUVCYWlOMVFRSnFPZ0FBSUFGQkFXb2thaU5xSStrQlFRSnRRUUZyVGdSQUkycEJBV3NrYWdzTEM1d0RBUVYvSUFBUVJTRUNJQUFRUmlFQklBQVFSeUVESUFBUVNDRUVJQUlrYkNBQkpHMGdBeVJ1SUFRa2J5Tm9JK2dCSUFCc2FpUm9JMmhCZ0lDQUJFR0FnSUFDSXo0YlRnUkFJMmhCZ0lDQUJFR0FnSUFDSXo0YmF5Um9JQUlnQVNBRElBUVFTaUVBSTJwQkFYUkJnSm5CQUdvaUJTQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0JVRUJhaUFBUWY4QmNVRUNham9BQUNNM0JFQWdBa0VQUVE5QkR4QktJUUFqYWtFQmRFR0FtU0ZxSWdJZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBRUgvQVhGQkFtbzZBQUJCRHlBQlFROUJEeEJLSVFBamFrRUJkRUdBbVNscUlnRWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBRkJBV29nQUVIL0FYRkJBbW82QUFCQkQwRVBJQU5CRHhCS0lRQWpha0VCZEVHQW1URnFJZ0VnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQUZCQVdvZ0FFSC9BWEZCQW1vNkFBQkJEMEVQUVE4Z0JCQktJUUFqYWtFQmRFR0FtVGxxSWdFZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFGQkFXb2dBRUgvQVhGQkFtbzZBQUFMSTJwQkFXb2thaU5xSStrQlFRSnRRUUZyVGdSQUkycEJBV3NrYWdzTEN4NEJBWDhnQUJCQ0lRRWdBVVVqTkNNMEd3UkFJQUFRU3dVZ0FCQk1Dd3RMQUNOYkl6NEVmMEd1QVFWQjF3QUxTQVJBRHdzRFFDTmJJejRFZjBHdUFRVkIxd0FMVGdSQUl6NEVmMEd1QVFWQjF3QUxFRTBqV3lNK0JIOUJyZ0VGUWRjQUMyc2tXd3dCQ3dzTElRQWdBRUdtL2dOR0JFQkJwdjRERUFGQmdBRnhJUUFnQUVId0FISVBDMEYvQzV3QkFRRi9JNzRCSVFBanZ3RUVRQ0FBUVh0eElBQkJCSElqNmdFYklRQWdBRUYrY1NBQVFRRnlJK3NCR3lFQUlBQkJkM0VnQUVFSWNpUHNBUnNoQUNBQVFYMXhJQUJCQW5JajdRRWJJUUFGSThBQkJFQWdBRUYrY1NBQVFRRnlJKzRCR3lFQUlBQkJmWEVnQUVFQ2NpUHZBUnNoQUNBQVFYdHhJQUJCQkhJajhBRWJJUUFnQUVGM2NTQUFRUWh5SS9FQkd5RUFDd3NnQUVId0FYSUx6d0lCQVg4Z0FFR0FnQUpJQkVCQmZ3OExJQUJCZ0lBQ1RpSUJCSDhnQUVHQXdBSklCU0FCQ3dSQVFYOFBDeUFBUVlEQUEwNGlBUVIvSUFCQmdQd0RTQVVnQVFzRVFDQUFRWUJBYWhBQkR3c2dBRUdBL0FOT0lnRUVmeUFBUVovOUEwd0ZJQUVMQkVBam1BRkJBa2dFUUVIL0FROExRWDhQQ3lBQVFjMytBMFlFUUVIL0FTRUJRYzMrQXhBQlFRRnhSUVJBUWY0QklRRUxJejVGQkVBZ0FVSC9mbkVoQVFzZ0FROExJQUJCeFA0RFJnUkFJQUFqVmhBRUkxWVBDeUFBUVpEK0EwNGlBUVIvSUFCQnB2NERUQVVnQVFzRVFCQk9JQUFRVHc4TElBQkJzUDREVGlJQkJIOGdBRUcvL2dOTUJTQUJDd1JBRUU1QmZ3OExJQUJCaFA0RFJnUkFJQUFqaGdGQmdQNERjVUVJZFNJQkVBUWdBUThMSUFCQmhmNERSZ1JBSUFBamh3RVFCQ09IQVE4TElBQkJqLzREUmdSQUk0UUJRZUFCY2c4TElBQkJnUDREUmdSQUVGQVBDMEYvQ3hzQkFYOGdBQkJSSWdGQmYwWUVRQ0FBRUFFUEN5QUJRZjhCY1F1MkFnRUJmeU5RQkVBUEN5QUFRZjgvVEFSQUkxSUVmeUFCUVJCeFJRVWpVZ3RGQkVBZ0FVRVBjU0lDQkVBZ0FrRUtSZ1JBUVFFa1Rnc0ZRUUFrVGdzTEJTQUFRZi8vQUV3RVFDTTVSU0lDQkg4Z0FnVWdBRUgvM3dCTUN3UkFJMUlFUUNBQlFROXhKRGdMSUFFaEFpTlJCRUFnQWtFZmNTRUNJemhCNEFGeEpEZ0ZJMU1FUUNBQ1FmOEFjU0VDSXpoQmdBRnhKRGdGSXprRVFFRUFKRGdMQ3dzak9DQUNjaVE0QlNNNFFmOEJjVUVCUVFBZ0FVRUFTaHRCL3dGeFFRaDBjaVE0Q3dValVrVWlBZ1IvSUFCQi83OEJUQVVnQWdzRVFDTlBJMUVpQUNBQUd3UkFJemhCSDNFa09DTTRJQUZCNEFGeGNpUTREd3NnQVVFUGNTQUJRUU54SXprYkpEd0ZJMUpGSWdJRWZ5QUFRZi8vQVV3RklBSUxCRUFqVVFSQUlBRkJBWEVFUUVFQkpFOEZRUUFrVHdzTEN3c0xDd3NzQUNBQVFRUjFRUTl4SlBZQklBQkJDSEZCQUVjazB3RWdBRUVIY1NUU0FTQUFRZmdCY1VFQVNpVFpBUXNzQUNBQVFRUjFRUTl4SlBjQklBQkJDSEZCQUVjazFRRWdBRUVIY1NUVUFTQUFRZmdCY1VFQVNpVGFBUXNzQUNBQVFRUjFRUTl4SlBrQklBQkJDSEZCQUVjazF3RWdBRUVIY1NUV0FTQUFRZmdCY1VFQVNpVGNBUXVCQVFFQmZ5QUFRUVIxSk9ZQklBQkJDSEZCQUVjazV3RWdBRUVIY1NUK0FRSkFBa0FDUUFKQUFrQUNRQUpBQWtBai9nRWlBUVJBSUFGQkFXc09Cd0VDQXdRRkJnY0lDMEVJSk9VQkR3dEJFQ1RsQVE4TFFTQWs1UUVQQzBFd0pPVUJEd3RCd0FBazVRRVBDMEhRQUNUbEFROExRZUFBSk9VQkR3dEI4QUFrNVFFTEM0TUJBUUYvUVFFa213RWpuZ0ZGQkVCQndBQWtuZ0VMUVlBUUk5RUJhMEVDZENTY0FTTStCRUFqbkFGQkFYUWtuQUVMSTlJQkpKMEJJL1lCSko4Qkk5RUJKS1FCSTh3QklnQWtvd0VnQUVFQVNpSUFCSDhqelFGQkFFb0ZJQUFMQkVCQkFTU2lBUVZCQUNTaUFRc2p6UUZCQUVvRVFCQTlDeVBaQVVVRVFFRUFKSnNCQ3d0SEFFRUJKS1VCSTZnQlJRUkFRY0FBSktnQkMwR0FFQ1BoQVd0QkFuUWtwZ0VqUGdSQUk2WUJRUUYwSktZQkN5UFVBU1NuQVNQM0FTU3BBU1BhQVVVRVFFRUFKS1VCQ3d0QUFFRUJKS3dCSTY0QlJRUkFRWUFDSks0QkMwR0FFQ1BqQVd0QkFYUWtyUUVqUGdSQUk2MEJRUUYwSkswQkMwRUFKSzhCSTlzQlJRUkFRUUFrckFFTEMwa0JBWDlCQVNTd0FTT3pBVVVFUUVIQUFDU3pBUXNqNVFFajVnRjBJZ0JCQVhRZ0FDTStHeVN4QVNQV0FTU3lBU1A1QVNTMEFVSC8vd0VrdFFFajNBRkZCRUJCQUNTd0FRc0xWQUFnQUVHQUFYRkJBRWNrWVNBQVFjQUFjVUVBUnlSZ0lBQkJJSEZCQUVja1h5QUFRUkJ4UVFCSEpGNGdBRUVJY1VFQVJ5UmxJQUJCQkhGQkFFY2taQ0FBUVFKeFFRQkhKR01nQUVFQmNVRUFSeVJpQzRnRkFRRi9JQUJCcHY0RFJ5SUNCRUFqWmtVaEFnc2dBZ1JBUVFBUEN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBa0dRL2dOSEJFQWdBa0dSL2dOckRoWUNCZ29PRlFNSEN3OEJCQWdNRUJVRkNRMFJFaE1VRlFzZ0FVSHdBSEZCQkhVa3pBRWdBVUVJY1VFQVJ5VE9BU0FCUVFkeEpNMEJEQlVMSUFGQmdBRnhRUUJISk5zQkRCUUxJQUZCQm5WQkEzRWs0QUVnQVVFL2NTVHlBVUhBQUNQeUFXc2tuZ0VNRXdzZ0FVRUdkVUVEY1NUaUFTQUJRVDl4SlBNQlFjQUFJL01CYXlTb0FRd1NDeUFCSlBRQlFZQUNJL1FCYXlTdUFRd1JDeUFCUVQ5eEpQVUJRY0FBSS9VQmF5U3pBUXdRQ3lBQkVGUU1Ed3NnQVJCVkRBNExRUUVrYXlBQlFRVjFRUTl4SlBnQkRBMExJQUVRVmd3TUN5QUJKTThCSTg4Qkk5QUJRUWgwY2lUUkFRd0xDeUFCSlBvQkkvb0JJL3NCUVFoMGNpVGhBUXdLQ3lBQkpQd0JJL3dCSS8wQlFRaDBjaVRqQVF3SkN5QUJFRmNNQ0FzZ0FVR0FBWEVFUUNBQlFjQUFjVUVBUnlUSUFTQUJRUWR4Sk5BQkk4OEJJOUFCUVFoMGNpVFJBUkJZQ3d3SEN5QUJRWUFCY1FSQUlBRkJ3QUJ4UVFCSEpNa0JJQUZCQjNFayt3RWorZ0VqK3dGQkNIUnlKT0VCRUZrTERBWUxJQUZCZ0FGeEJFQWdBVUhBQUhGQkFFY2t5Z0VnQVVFSGNTVDlBU1A4QVNQOUFVRUlkSElrNHdFUVdnc01CUXNnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVRMQVJCYkN3d0VDeUFCUVFSMVFRZHhKRndnQVVFSGNTUmRRUUVrZGd3REN5QUJFRnhCQVNSM0RBSUxJQUZCZ0FGeFFRQkhKR1lnQVVHQUFYRkZCRUFDUUVHUS9nTWhBZ05BSUFKQnB2NERUZzBCSUFKQkFCQUVJQUpCQVdvaEFnd0FBQXNBQ3dzTUFRdEJBUThMUVFFTFBBRUJmeUFBUVFoMElRRkJBQ0VBQTBBQ1FDQUFRWjhCU2cwQUlBQkJnUHdEYWlBQUlBRnFFQUVRQkNBQVFRRnFJUUFNQVFzTFFZUUZKTUVCQ3lNQkFYOGpnUUlRQVNFQUk0SUNFQUZCL3dGeElBQkIvd0Z4UVFoMGNrSHcvd054Q3ljQkFYOGpnd0lRQVNFQUk0UUNFQUZCL3dGeElBQkIvd0Z4UVFoMGNrSHdQM0ZCZ0lBQ2FndURBUUVEZnlNNlJRUkFEd3NnQUVHQUFYRkZJOFFCSThRQkd3UkFRUUFreEFFamdBSVFBVUdBQVhJaEFDT0FBaUFBRUFRUEN4QmZJUUVRWUNFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSk1RQklBTWt4UUVnQVNUR0FTQUNKTWNCSTRBQ0lBQkIvMzV4RUFRRklBRWdBaUFERUdzamdBSkIvd0VRQkFzTFlnRURmeU9IQWlBQVJpSUNSUVJBSTRZQ0lBQkdJUUlMSUFJRVFDQUFRUUZySWdNUUFVRy9mM0VpQWtFL2NTSUVRVUJySUFSQkFVRUFJNFlDSUFCR0d4dEJnSkFFYWlBQk9nQUFJQUpCZ0FGeEJFQWdBeUFDUVFGcVFZQUJjaEFFQ3dzTFBBRUJmd0pBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVNBQlFRSkdEUUlnQVVFRFJnMEREQVFMUVFrUEMwRUREd3RCQlE4TFFRY1BDMEVBQ3kwQkFYOUJBU09LQVJCaklnSjBJQUJ4UVFCSElnQUVmMEVCSUFKMElBRnhSUVVnQUFzRVFFRUJEd3RCQUF1UkFRRUNmd05BSUFFZ0FFZ0VRQ0FCUVFScUlRRWpoZ0VpQWtFRWFpU0dBU09HQVVILy93TktCRUFqaGdGQmdJQUVheVNHQVFzamlRRUVRQ09MQVFSQUk0Z0JKSWNCUVFFa2dRRkJBaEE2UVFBa2l3RkJBU1NNQVFVampBRUVRRUVBSkl3QkN3c2dBaU9HQVJCa0JFQWpod0ZCQVdva2h3RWpod0ZCL3dGS0JFQkJBU1NMQVVFQUpJY0JDd3NMREFFTEN3c01BQ09GQVJCbFFRQWtoUUVMUndFQmZ5T0dBU0VBUVFBa2hnRkJoUDREUVFBUUJDT0pBUVIvSUFBamhnRVFaQVVqaVFFTEJFQWpod0ZCQVdva2h3RWpod0ZCL3dGS0JFQkJBU1NMQVVFQUpJY0JDd3NMZ0FFQkFuOGppUUVoQVNBQVFRUnhRUUJISklrQklBQkJBM0VoQWlBQlJRUkFJNG9CRUdNaEFDQUNFR01oQVNPSkFRUi9JNFlCUVFFZ0FIUnhCU09HQVVFQklBQjBjVUVBUnlJQUJIOGpoZ0ZCQVNBQmRIRUZJQUFMQ3dSQUk0Y0JRUUZxSkljQkk0Y0JRZjhCU2dSQVFRRWtpd0ZCQUNTSEFRc0xDeUFDSklvQkM5SUdBUUYvQWtBQ1FDQUFRYzMrQTBZRVFFSE4vZ01nQVVFQmNSQUVEQUVMSUFCQmdJQUNTQVJBSUFBZ0FSQlREQUVMSUFCQmdJQUNUaUlDQkVBZ0FFR0F3QUpJSVFJTElBSU5BU0FBUVlEQUEwNGlBZ1JBSUFCQmdQd0RTQ0VDQ3lBQ0JFQWdBRUdBUUdvZ0FSQUVEQUlMSUFCQmdQd0RUaUlDQkVBZ0FFR2YvUU5NSVFJTElBSUVRQ09ZQVVFQ1NBMEJEQUlMSUFCQm9QMERUaUlDQkVBZ0FFSC8vUU5NSVFJTElBSU5BQ0FBUVlMK0EwWUVRQ0FCUVFGeFFRQkhKSThCSUFGQkFuRkJBRWNra0FFZ0FVR0FBWEZCQUVja2tRRkJBUThMSUFCQmtQNERUaUlDQkVBZ0FFR20vZ05NSVFJTElBSUVRQkJPSUFBZ0FSQmREd3NnQUVHdy9nTk9JZ0lFUUNBQVFiLytBMHdoQWdzZ0FnUkFFRTRMSUFCQndQNERUaUlDQkVBZ0FFSEwvZ05NSVFJTElBSUVRQ0FBUWNEK0EwWUVRQ0FCRUI0TUF3c2dBRUhCL2dOR0JFQkJ3ZjRESUFGQitBRnhRY0grQXhBQlFRZHhja0dBQVhJUUJBd0NDeUFBUWNUK0EwWUVRRUVBSkZZZ0FFRUFFQVFNQWdzZ0FFSEYvZ05HQkVBZ0FTVC9BUXdEQ3lBQVFjYitBMFlFUUNBQkVGNE1Bd3NDUUFKQUFrQUNRQ0FBSWdKQncvNERSd1JBSUFKQnd2NERhdzRLQVFRRUJBUUVCQVFEQWdRTElBRWtWd3dHQ3lBQkpGZ01CUXNnQVNSWkRBUUxJQUVrV2d3REN3d0NDeU9BQWlBQVJnUkFJQUVRWVF3QkN5TTlJQUJHSWdKRkJFQWpPeUFBUmlFQ0N5QUNCRUFqeEFFRVFBSi9JOFlCUVlDQUFVNGlBZ1JBSThZQlFmLy9BVXdoQWdzZ0FrVUxCRUFqeGdGQmdLQURUaUlDQkVBanhnRkIvNzhEVENFQ0N3c2dBZzBDQ3dzZ0FDT0ZBazRpQWdSQUlBQWpoZ0pNSVFJTElBSUVRQ0FBSUFFUVlnd0NDeUFBUVlUK0EwNGlBZ1JBSUFCQmgvNERUQ0VDQ3lBQ0JFQVFaZ0pBQWtBQ1FBSkFJQUFpQWtHRS9nTkhCRUFnQWtHRi9nTnJEZ01CQWdNRUN4Qm5EQVVMQWtBamlRRUVRQ09NQVEwQkk0c0JCRUJCQUNTTEFRc0xJQUVraHdFTERBVUxJQUVraUFFampBRWppUUVpQUNBQUd3UkFJNGdCSkljQlFRQWtqQUVMREFRTElBRVFhQXdEQ3d3Q0N5QUFRWUQrQTBZRVFDQUJRZjhCY3lTK0FTTytBU0lDUVJCeFFRQkhKTDhCSUFKQklIRkJBRWNrd0FFTElBQkJqLzREUmdSQUlBRVFEd3dDQ3lBQVFmLy9BMFlFUUNBQkVBNE1BZ3RCQVE4TFFRQVBDMEVCQ3hFQUlBQWdBUkJwQkVBZ0FDQUJFQVFMQzJBQkEzOERRQUpBSUFNZ0FrNE5BQ0FBSUFOcUVGSWhCU0FCSUFOcUlRUURRQ0FFUWYrL0Frb0VRQ0FFUVlCQWFpRUVEQUVMQ3lBRUlBVVFhaUFEUVFGcUlRTU1BUXNMUVNBaEF5UEJBU0FDUVJCdFFjQUFRU0FqUGh0c2FpVEJBUXRuQVFGL0k4UUJSUVJBRHdzanhnRWp4d0VqeFFFaUFFRVFJQUJCRUVnYklnQVFheVBHQVNBQWFpVEdBU1BIQVNBQWFpVEhBU1BGQVNBQWF5VEZBU1BGQVVFQVRBUkFRUUFreEFFamdBSkIvd0VRQkFVamdBSWp4UUZCRUcxQkFXdEIvMzV4RUFRTEMwWUJBbjhqL3dFaEF3Si9JQUJGSWdKRkJFQWdBRUVCUmlFQ0N5QUNDd1IvSTFZZ0EwWUZJQUlMQkVBZ0FVRUVjaUlCUWNBQWNRUkFFRHNMQlNBQlFYdHhJUUVMSUFFTGdnSUJBMzhqdGdGRkJFQVBDeU9ZQVNFQUlBQWpWaUlDUVpBQlRnUi9RUUVGSTFValBnUi9RZkFGQlVINEFndE9CSDlCQWdWQkEwRUFJMVVqUGdSL1FmSURCVUg1QVF0T0d3c0xJZ0ZIQkVCQndmNERFQUVoQUNBQkpKZ0JRUUFoQWdKQUFrQUNRQUpBSUFFRVFDQUJRUUZyRGdNQkFnTUVDeUFBUVh4eElnQkJDSEZCQUVjaEFnd0RDeUFBUVgxeFFRRnlJZ0JCRUhGQkFFY2hBZ3dDQ3lBQVFYNXhRUUp5SWdCQklIRkJBRWNoQWd3QkN5QUFRUU55SVFBTElBSUVRQkE3Q3lBQlJRUkFFR3dMSUFGQkFVWUVRRUVCSkg5QkFCQTZDMEhCL2dNZ0FTQUFFRzBRQkFVZ0FrR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUFSQnRFQVFMQ3d1MEFRQWp0Z0VFUUNOVklBQnFKRlVEUUNOVkFuOGpQZ1JBUVFnalZrR1pBVVlOQVJwQmtBY01BUXRCQkNOV1Faa0JSZzBBR2tISUF3dE9CRUFqVlFKL0l6NEVRRUVJSTFaQm1RRkdEUUVhUVpBSERBRUxRUVFqVmtHWkFVWU5BQnBCeUFNTGF5UlZJMVlpQUVHUUFVWUVRQ016QkVBUU9BVWdBQkEzQ3hBNVFYOGt3Z0ZCZnlUREFRVWdBRUdRQVVnRVFDTXpSUVJBSUFBUU53c0xDMEVBSUFCQkFXb2dBRUdaQVVvYkpGWU1BUXNMQ3hCdUM3TUJBQ05VQW44alBnUkFRUWdqVmtHWkFVWU5BUnBCa0FjTUFRdEJCQ05XUVprQlJnMEFHa0hJQXd0SUJFQVBDd05BSTFRQ2Z5TStCRUJCQ0NOV1Faa0JSZzBCR2tHUUJ3d0JDMEVFSTFaQm1RRkdEUUFhUWNnREMwNEVRQUovSXo0RVFFRUlJMVpCbVFGR0RRRWFRWkFIREFFTFFRUWpWa0daQVVZTkFCcEJ5QU1MRUc4alZBSi9JejRFUUVFSUkxWkJtUUZHRFFFYVFaQUhEQUVMUVFRalZrR1pBVVlOQUJwQnlBTUxheVJVREFFTEN3c3pBUUYvUVFFamtBRUVmMEVDQlVFSEN5SUNkQ0FBY1VFQVJ5SUFCSDlCQVNBQ2RDQUJjVVVGSUFBTEJFQkJBUThMUVFBTGxnRUJBbjhqa1FGRkJFQVBDd05BSUFFZ0FFZ0VRQ0FCUVFScUlRRWpqUUVpQWtFRWFpU05BU09OQVVILy93TktCRUFqalFGQmdJQUVheVNOQVFzZ0FpT05BUkJ4QkVCQmdmNERRWUgrQXhBQlFRRjBRUUZxUWY4QmNSQUVJNDRCUVFGcUpJNEJJNDRCUVFoR0JFQkJBQ1NPQVVFQkpJSUJRUU1RT2tHQy9nTkJndjRERUFGQi8zNXhFQVJCQUNTUkFRc0xEQUVMQ3d1SUFRQWp3UUZCQUVvRVFDUEJBU0FBYWlFQVFRQWt3UUVMSTBrZ0FHb2tTU05OUlFSQUl6RUVRQ05VSUFCcUpGUVFjQVVnQUJCdkN5TXdCRUFqV3lBQWFpUmJCU0FBRUUwTElBQVFjZ3NqTWdSQUk0VUJJQUJxSklVQkVHWUZJQUFRWlFzamxBRWdBR29rbEFFamxBRWprZ0ZPQkVBamt3RkJBV29ra3dFamxBRWprZ0ZySkpRQkN3c0tBRUVFRUhNalNCQUJDeVlCQVg5QkJCQnpJMGhCQVdwQi8vOERjUkFCSVFBUWRFSC9BWEVnQUVIL0FYRkJDSFJ5Q3d3QVFRUVFjeUFBSUFFUWFnc3dBUUYvUVFFZ0FIUkIvd0Z4SVFJZ0FVRUFTZ1JBSTBZZ0FuSkIvd0Z4SkVZRkkwWWdBa0gvQVhOeEpFWUxJMFlMQ1FCQkJTQUFFSGNhQzBrQkFYOGdBVUVBVGdSQUlBQkJEM0VnQVVFUGNXcEJFSEVFUUVFQkVIZ0ZRUUFRZUFzRklBRkJIM1VpQWlBQklBSnFjMEVQY1NBQVFROXhTd1JBUVFFUWVBVkJBQkI0Q3dzTENRQkJCeUFBRUhjYUN3a0FRUVlnQUJCM0dnc0pBRUVFSUFBUWR4b0xPd0VDZnlBQlFZRCtBM0ZCQ0hVaEFpQUFRUUZxSVFNZ0FDQUJRZjhCY1NJQkVHa0VRQ0FBSUFFUUJBc2dBeUFDRUdrRVFDQURJQUlRQkFzTERBQkJDQkJ6SUFBZ0FSQjlDM1VBSUFJRVFDQUJJQUJCLy84RGNTSUFhaUFBSUFGemN5SUNRUkJ4QkVCQkFSQjRCVUVBRUhnTElBSkJnQUp4QkVCQkFSQjhCVUVBRUh3TEJTQUFJQUZxUWYvL0EzRWlBaUFBUWYvL0EzRkpCRUJCQVJCOEJVRUFFSHdMSUFBZ0FYTWdBbk5CZ0NCeEJFQkJBUkI0QlVFQUVIZ0xDd3NLQUVFRUVITWdBQkJTQzVFRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQUVRQ0FBUVFGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN3d1RDeEIxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRUFnQUVIL0FYRWtRUXdQQ3lOQlFmOEJjU05BUWY4QmNVRUlkSElqUHhCMkRCRUxJMEZCL3dGeEkwQkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkFEQkVMSTBCQkFSQjVJMEJCQVdwQi93RnhKRUFqUUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHNNRHdzalFFRi9FSGtqUUVFQmEwSC9BWEVrUUNOQUJFQkJBQkI2QlVFQkVIb0xRUUVRZXd3T0N4QjBRZjhCY1NSQURBc0xJejlCZ0FGeFFZQUJSZ1JBUVFFUWZBVkJBQkI4Q3lNL0lnQkJBWFFnQUVIL0FYRkJCM1p5UWY4QmNTUS9EQXNMRUhWQi8vOERjU05IRUg0TUNBc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnQWpRVUgvQVhFalFFSC9BWEZCQ0hSeUlnRkJBQkIvSUFBZ0FXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1JDQUFRZjhCY1NSRlFRQVFlMEVJRHdzalFVSC9BWEVqUUVIL0FYRkJDSFJ5RUlBQlFmOEJjU1EvREFrTEkwRkIvd0Z4STBCQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNSQURBa0xJMEZCQVJCNUkwRkJBV3BCL3dGeEpFRWpRUVJBUVFBUWVnVkJBUkI2QzBFQUVIc01Cd3NqUVVGL0VIa2pRVUVCYTBIL0FYRWtRU05CQkVCQkFCQjZCVUVCRUhvTFFRRVFld3dHQ3hCMFFmOEJjU1JCREFNTEl6OUJBWEZCQUVzRVFFRUJFSHdGUVFBUWZBc2pQeUlBUVFkMElBQkIvd0Z4UVFGMmNrSC9BWEVrUHd3REMwRi9Ed3NqU0VFQ2FrSC8vd054SkVnTUFnc2pTRUVCYWtILy93TnhKRWdNQVF0QkFCQjZRUUFRZTBFQUVIZ0xRUVFQQ3lBQVFmOEJjU1JCUVFnTEtBRUJmeUFBUVJoMFFSaDFJZ0ZCZ0FGeEJFQkJnQUlnQUVFWWRFRVlkV3RCZjJ3aEFRc2dBUXNwQVFGL0lBQVFnZ0VoQVNOSUlBRkJHSFJCR0hWcVFmLy9BM0VrU0NOSVFRRnFRZi8vQTNFa1NBdllCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVRUndSQUlBQkJFV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSXpvRVFFSE4vZ01RZ0FGQi93RnhJZ0JCQVhFRVFFSE4vZ01nQUVGK2NTSUFRWUFCY1FSL1FRQWtQaUFBUWY5K2NRVkJBU1ErSUFCQmdBRnlDeEIyUWNRQUR3c0xRUUVrVFF3UUN4QjFRZi8vQTNFaUFFR0EvZ054UVFoMUpFSWdBRUgvQVhFa1F5TklRUUpxUWYvL0EzRWtTQXdSQ3lORFFmOEJjU05DUWY4QmNVRUlkSElqUHhCMkRCQUxJME5CL3dGeEkwSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkNEQkFMSTBKQkFSQjVJMEpCQVdwQi93RnhKRUlqUWdSQVFRQVFlZ1ZCQVJCNkMwRUFFSHNNRGdzalFrRi9FSGtqUWtFQmEwSC9BWEVrUWlOQ0JFQkJBQkI2QlVFQkVIb0xRUUVRZXd3TkN4QjBRZjhCY1NSQ0RBb0xRUUZCQUNNL0lnRkJnQUZ4UVlBQlJoc2hBQ05HUVFSMlFRRnhJQUZCQVhSeVFmOEJjU1EvREFvTEVIUVFnd0ZCQ0E4TEkwVkIvd0Z4STBSQi93RnhRUWgwY2lJQUkwTkIvd0Z4STBKQi93RnhRUWgwY2lJQlFRQVFmeUFBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFQUVIdEJDQThMSTBOQi93RnhJMEpCL3dGeFFRaDBjaENBQVVIL0FYRWtQd3dJQ3lORFFmOEJjU05DUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVrUWd3SUN5TkRRUUVRZVNORFFRRnFRZjhCY1NSREkwTUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBWUxJME5CZnhCNUkwTkJBV3RCL3dGeEpFTWpRd1JBUVFBUWVnVkJBUkI2QzBFQkVIc01CUXNRZEVIL0FYRWtRd3dDQzBFQlFRQWpQeUlCUVFGeFFRRkdHeUVBSTBaQkJIWkJBWEZCQjNRZ0FVSC9BWEZCQVhaeUpEOE1BZ3RCZnc4TEkwaEJBV3BCLy84RGNTUklEQUVMSUFBRVFFRUJFSHdGUVFBUWZBdEJBQkI2UVFBUWUwRUFFSGdMUVFRUEN5QUFRZjhCY1NSRFFRZ0x1QVlCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRWdSd1JBSUFCQklXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJMFpCQjNaQkFYRUVRQ05JUVFGcVFmLy9BM0VrU0FVUWRCQ0RBUXRCQ0E4TEVIVkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1JDQUFRZjhCY1NSRkkwaEJBbXBCLy84RGNTUklEQkFMSTBWQi93RnhJMFJCL3dGeFFRaDBjaUlBSXo4UWRpQUFRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSUXdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrUkNBQVFmOEJjU1JGUVFnUEN5TkVRUUVRZVNORVFRRnFRZjhCY1NSRUkwUUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBMExJMFJCZnhCNUkwUkJBV3RCL3dGeEpFUWpSQVJBUVFBUWVnVkJBUkI2QzBFQkVIc01EQXNRZEVIL0FYRWtSQXdLQzBFR1FRQWpSa0VGZGtFQmNVRUFTeHNoQVNBQlFlQUFjaUFCSTBaQkJIWkJBWEZCQUVzYklRRWpSa0VHZGtFQmNVRUFTd1IvSXo4Z0FXdEIvd0Z4QlNBQlFRWnlJQUVqUHlJQVFROXhRUWxMR3lJQlFlQUFjaUFCSUFCQm1RRkxHeUlCSUFCcVFmOEJjUXNpQUFSQVFRQVFlZ1ZCQVJCNkN5QUJRZUFBY1FSQVFRRVFmQVZCQUJCOEMwRUFFSGdnQUNRL0RBb0xJMFpCQjNaQkFYRkJBRXNFUUJCMEVJTUJCU05JUVFGcVFmLy9BM0VrU0F0QkNBOExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUJJQUZCLy84RGNVRUFFSDhnQVVFQmRFSC8vd054SWdGQmdQNERjVUVJZFNSRUlBRkIvd0Z4SkVWQkFCQjdRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQVJDQUFVSC9BWEVrUHlBQlFRRnFRZi8vQTNFaUFVR0EvZ054UVFoMUpFUWdBVUgvQVhFa1JRd0hDeU5GUWY4QmNTTkVRZjhCY1VFSWRISkJBV3RCLy84RGNTSUJRWUQrQTNGQkNIVWtSQ0FCUWY4QmNTUkZRUWdQQ3lORlFRRVFlU05GUVFGcVFmOEJjU1JGSTBVRVFFRUFFSG9GUVFFUWVndEJBQkI3REFVTEkwVkJmeEI1STBWQkFXdEIvd0Z4SkVValJRUkFRUUFRZWdWQkFSQjZDMEVCRUhzTUJBc1FkRUgvQVhFa1JRd0NDeU0vUVg5elFmOEJjU1EvUVFFUWUwRUJFSGdNQWd0QmZ3OExJMGhCQVdwQi8vOERjU1JJQzBFRUM1UUZBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBZ0FFRXhhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqUmtFRWRrRUJjUVJBSTBoQkFXcEIvLzhEY1NSSUJSQjBFSU1CQzBFSUR3c1FkVUgvL3dOeEpFY2pTRUVDYWtILy93TnhKRWdNRWdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdBalB4QjJEQTRMSTBkQkFXcEIvLzhEY1NSSFFRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBQkNBQVNJQlFRRVFlU0FCUVFGcVFmOEJjU0lCQkVCQkFCQjZCVUVCRUhvTFFRQVFld3dOQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUJDQUFTSUJRWDhRZVNBQlFRRnJRZjhCY1NJQkJFQkJBQkI2QlVFQkVIb0xRUUVRZXd3TUN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWRFSC9BWEVRZGd3TUMwRUFFSHRCQUJCNFFRRVFmQXdNQ3lOR1FRUjJRUUZ4UVFGR0JFQVFkQkNEQVFValNFRUJha0gvL3dOeEpFZ0xRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQVNOSFFRQVFmeU5ISUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFQUVIdEJDQThMSTBWQi93RnhJMFJCL3dGeFFRaDBjaUlBRUlBQlFmOEJjU1EvREFZTEkwZEJBV3RCLy84RGNTUkhRUWdQQ3lNL1FRRVFlU00vUVFGcVFmOEJjU1EvSXo4RVFFRUFFSG9GUVFFUWVndEJBQkI3REFjTEl6OUJmeEI1SXo5QkFXdEIvd0Z4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVCRUhzTUJnc1FkRUgvQVhFa1B3d0VDMEVBRUh0QkFCQjRJMFpCQkhaQkFYRkJBRXNFUUVFQUVId0ZRUUVRZkFzTUJBdEJmdzhMSUFCQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1JDQUFRZjhCY1NSRkRBSUxJQUJCLy84RGNTQUJFSFlNQVFzalNFRUJha0gvL3dOeEpFZ0xRUVFMNUFFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFFY0VRQ0FBUWNFQVJnMEJBa0FnQUVIQ0FHc09EZ01FQlFZSENBa1JDZ3NNRFE0UEFBc01Ed3NNRHdzalFTUkFEQTRMSTBJa1FBd05DeU5ESkVBTURBc2pSQ1JBREFzTEkwVWtRQXdLQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FGQi93RnhKRUFNQ1FzalB5UkFEQWdMSTBBa1FRd0hDeU5DSkVFTUJnc2pReVJCREFVTEkwUWtRUXdFQ3lORkpFRU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkJEQUlMSXo4a1FRd0JDMEYvRHd0QkJBdmZBUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBRWNFUUNBQVFkRUFSZzBCQWtBZ0FFSFNBR3NPRGhBREJBVUdCd2dKQ2hBTERBME9BQXNNRGdzalFDUkNEQTRMSTBFa1Fnd05DeU5ESkVJTURBc2pSQ1JDREFzTEkwVWtRZ3dLQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FGQi93RnhKRUlNQ1FzalB5UkNEQWdMSTBBa1F3d0hDeU5CSkVNTUJnc2pRaVJEREFVTEkwUWtRd3dFQ3lORkpFTU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkREQUlMSXo4a1F3d0JDMEYvRHd0QkJBdmZBUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBRWNFUUNBQVFlRUFSZzBCQWtBZ0FFSGlBR3NPRGdNRUVBVUdCd2dKQ2dzTUVBME9BQXNNRGdzalFDUkVEQTRMSTBFa1JBd05DeU5DSkVRTURBc2pReVJFREFzTEkwVWtSQXdLQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FGQi93RnhKRVFNQ1FzalB5UkVEQWdMSTBBa1JRd0hDeU5CSkVVTUJnc2pRaVJGREFVTEkwTWtSUXdFQ3lORUpFVU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkZEQUlMSXo4a1JRd0JDMEYvRHd0QkJBdnNBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFBUndSQUlBQkI4UUJHRFFFQ1FDQUFRZklBYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEVBQ3d3UEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJalFCQjJEQThMSTBWQi93RnhJMFJCL3dGeFFRaDBjaU5CRUhZTURnc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUkwSVFkZ3dOQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUXhCMkRBd0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpTkVFSFlNQ3dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5STBVUWRnd0tDeVBFQVVVRVFBSkFJNWtCQkVCQkFTUktEQUVMSTM0amhBRnhRUjl4UlFSQVFRRWtTd3dCQzBFQkpFd0xDd3dKQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUHhCMkRBZ0xJMEFrUHd3SEN5TkJKRDhNQmdzalFpUS9EQVVMSTBNa1B3d0VDeU5FSkQ4TUF3c2pSU1EvREFJTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFVSC9BWEVrUHd3QkMwRi9Ed3RCQkF0SkFRRi9JQUZCQUU0RVFDQUFRZjhCY1NBQUlBRnFRZjhCY1VzRVFFRUJFSHdGUVFBUWZBc0ZJQUZCSDNVaUFpQUJJQUpxY3lBQVFmOEJjVW9FUUVFQkVId0ZRUUFRZkFzTEN6UUJBWDhqUHlBQVFmOEJjU0lCRUhralB5QUJFSXNCSXo4Z0FHcEIvd0Z4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVBRUhzTGJBRUNmeU0vSUFCcUkwWkJCSFpCQVhGcVFmOEJjU0lCSVFJalB5QUFjeUFCYzBFUWNRUkFRUUVRZUFWQkFCQjRDeU0vSUFCQi93RnhhaU5HUVFSMlFRRnhha0dBQW5GQkFFc0VRRUVCRUh3RlFRQVFmQXNnQWlRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN0MvRUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQmdBRkhCRUFnQVVHQkFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJMEFRakFFTUVBc2pRUkNNQVF3UEN5TkNFSXdCREE0TEkwTVFqQUVNRFFzalJCQ01BUXdNQ3lORkVJd0JEQXNMSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDTUFRd0tDeU0vRUl3QkRBa0xJMEFRalFFTUNBc2pRUkNOQVF3SEN5TkNFSTBCREFZTEkwTVFqUUVNQlFzalJCQ05BUXdFQ3lORkVJMEJEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDTkFRd0NDeU0vRUkwQkRBRUxRWDhQQzBFRUN6Y0JBWDhqUHlBQVFmOEJjVUYvYkNJQkVIa2pQeUFCRUlzQkl6OGdBR3RCL3dGeEpEOGpQd1JBUVFBUWVnVkJBUkI2QzBFQkVIc0xiQUVDZnlNL0lBQnJJMFpCQkhaQkFYRnJRZjhCY1NJQklRSWpQeUFBY3lBQmMwRVFjUVJBUVFFUWVBVkJBQkI0Q3lNL0lBQkIvd0Z4YXlOR1FRUjJRUUZ4YTBHQUFuRkJBRXNFUUVFQkVId0ZRUUFRZkFzZ0FpUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFSQjdDL0VCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJrQUZIQkVBZ0FVR1JBV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTBBUWp3RU1FQXNqUVJDUEFRd1BDeU5DRUk4QkRBNExJME1RandFTURRc2pSQkNQQVF3TUN5TkZFSThCREFzTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFSQ1BBUXdLQ3lNL0VJOEJEQWtMSTBBUWtBRU1DQXNqUVJDUUFRd0hDeU5DRUpBQkRBWUxJME1Ra0FFTUJRc2pSQkNRQVF3RUN5TkZFSkFCREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFSQ1FBUXdDQ3lNL0VKQUJEQUVMUVg4UEMwRUVDeU1BSXo4Z0FIRWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVCRUhoQkFCQjhDeWNBSXo4Z0FITkIvd0Z4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRRUUFRZkF2eEFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUWFBQlJ3UkFJQUZCb1FGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TkFFSklCREJBTEkwRVFrZ0VNRHdzalFoQ1NBUXdPQ3lOREVKSUJEQTBMSTBRUWtnRU1EQXNqUlJDU0FRd0xDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRa2dFTUNnc2pQeENTQVF3SkN5TkFFSk1CREFnTEkwRVFrd0VNQndzalFoQ1RBUXdHQ3lOREVKTUJEQVVMSTBRUWt3RU1CQXNqUlJDVEFRd0RDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRa3dFTUFnc2pQeENUQVF3QkMwRi9Ed3RCQkFzbkFDTS9JQUJ5UWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFCQjdRUUFRZUVFQUVId0xMd0VCZnlNL0lBQkIvd0Z4UVg5c0lnRVFlU00vSUFFUWl3RWpQeUFCYWdSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNMOFFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUd3QVVjRVFDQUJRYkVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzalFCQ1ZBUXdRQ3lOQkVKVUJEQThMSTBJUWxRRU1EZ3NqUXhDVkFRd05DeU5FRUpVQkRBd0xJMFVRbFFFTUN3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJFSlVCREFvTEl6OFFsUUVNQ1FzalFCQ1dBUXdJQ3lOQkVKWUJEQWNMSTBJUWxnRU1CZ3NqUXhDV0FRd0ZDeU5FRUpZQkRBUUxJMFVRbGdFTUF3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJFSllCREFJTEl6OFFsZ0VNQVF0QmZ3OExRUVFMT3dFQmZ5QUFFRkVpQVVGL1JnUi9JQUFRQVFVZ0FRdEIvd0Z4SUFCQkFXb2lBUkJSSWdCQmYwWUVmeUFCRUFFRklBQUxRZjhCY1VFSWRISUxDd0JCQ0JCeklBQVFtQUVMUXdBZ0FFR0FBWEZCZ0FGR0JFQkJBUkI4QlVFQUVId0xJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU0lBQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhnZ0FBdEJBQ0FBUVFGeFFRQkxCRUJCQVJCOEJVRUFFSHdMSUFCQkIzUWdBRUgvQVhGQkFYWnlRZjhCY1NJQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIZ2dBQXRQQVFGL1FRRkJBQ0FBUVlBQmNVR0FBVVliSVFFalJrRUVka0VCY1NBQVFRRjBja0gvQVhFaEFDQUJCRUJCQVJCOEJVRUFFSHdMSUFBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUFDMUFCQVg5QkFVRUFJQUJCQVhGQkFVWWJJUUVqUmtFRWRrRUJjVUVIZENBQVFmOEJjVUVCZG5JaEFDQUJCRUJCQVJCOEJVRUFFSHdMSUFBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUFDMFlCQVg5QkFVRUFJQUJCZ0FGeFFZQUJSaHNoQVNBQVFRRjBRZjhCY1NFQUlBRUVRRUVCRUh3RlFRQVFmQXNnQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBQUxYZ0VDZjBFQlFRQWdBRUVCY1VFQlJoc2hBVUVCUVFBZ0FFR0FBWEZCZ0FGR0d5RUNJQUJCL3dGeFFRRjJJZ0JCZ0FGeUlBQWdBaHNpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBRUVRRUVCRUh3RlFRQVFmQXNnQUFzd0FDQUFRUTl4UVFSMElBQkI4QUZ4UVFSMmNpSUFCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGhCQUJCOElBQUxRZ0VCZjBFQlFRQWdBRUVCY1VFQlJoc2hBU0FBUWY4QmNVRUJkaUlBQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhnZ0FRUkFRUUVRZkFWQkFCQjhDeUFBQ3lRQVFRRWdBSFFnQVhGQi93RnhCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUJFSGdnQVF1ZkNBRUdmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVJYnlJR0lnVUVRQ0FGUVFGckRnY0JBZ01FQlFZSENBc2pRQ0VCREFjTEkwRWhBUXdHQ3lOQ0lRRU1CUXNqUXlFQkRBUUxJMFFoQVF3REN5TkZJUUVNQWdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQklRRU1BUXNqUHlFQkN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdVaUJBUkFJQVJCQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTElBQkJCMHdFZjBFQklRSWdBUkNhQVFVZ0FFRVBUQVIvUVFFaEFpQUJFSnNCQlVFQUN3c2hBd3dQQ3lBQVFSZE1CSDlCQVNFQ0lBRVFuQUVGSUFCQkgwd0VmMEVCSVFJZ0FSQ2RBUVZCQUFzTElRTU1EZ3NnQUVFblRBUi9RUUVoQWlBQkVKNEJCU0FBUVM5TUJIOUJBU0VDSUFFUW53RUZRUUFMQ3lFRERBMExJQUJCTjB3RWYwRUJJUUlnQVJDZ0FRVWdBRUUvVEFSL1FRRWhBaUFCRUtFQkJVRUFDd3NoQXd3TUN5QUFRY2NBVEFSL1FRRWhBa0VBSUFFUW9nRUZJQUJCendCTUJIOUJBU0VDUVFFZ0FSQ2lBUVZCQUFzTElRTU1Dd3NnQUVIWEFFd0VmMEVCSVFKQkFpQUJFS0lCQlNBQVFkOEFUQVIvUVFFaEFrRURJQUVRb2dFRlFRQUxDeUVEREFvTElBQkI1d0JNQkg5QkFTRUNRUVFnQVJDaUFRVWdBRUh2QUV3RWYwRUJJUUpCQlNBQkVLSUJCVUVBQ3dzaEF3d0pDeUFBUWZjQVRBUi9RUUVoQWtFR0lBRVFvZ0VGSUFCQi93Qk1CSDlCQVNFQ1FRY2dBUkNpQVFWQkFBc0xJUU1NQ0FzZ0FFR0hBVXdFZjBFQklRSWdBVUYrY1FVZ0FFR1BBVXdFZjBFQklRSWdBVUY5Y1FWQkFBc0xJUU1NQndzZ0FFR1hBVXdFZjBFQklRSWdBVUY3Y1FVZ0FFR2ZBVXdFZjBFQklRSWdBVUYzY1FWQkFBc0xJUU1NQmdzZ0FFR25BVXdFZjBFQklRSWdBVUZ2Y1FVZ0FFR3ZBVXdFZjBFQklRSWdBVUZmY1FWQkFBc0xJUU1NQlFzZ0FFRzNBVXdFZjBFQklRSWdBVUcvZjNFRklBQkJ2d0ZNQkg5QkFTRUNJQUZCLzM1eEJVRUFDd3NoQXd3RUN5QUFRY2NCVEFSL1FRRWhBaUFCUVFGeUJTQUFRYzhCVEFSL1FRRWhBaUFCUVFKeUJVRUFDd3NoQXd3REN5QUFRZGNCVEFSL1FRRWhBaUFCUVFSeUJTQUFRZDhCVEFSL1FRRWhBaUFCUVFoeUJVRUFDd3NoQXd3Q0N5QUFRZWNCVEFSL1FRRWhBaUFCUVJCeUJTQUFRZThCVEFSL1FRRWhBaUFCUVNCeUJVRUFDd3NoQXd3QkN5QUFRZmNCVEFSL1FRRWhBaUFCUWNBQWNnVWdBRUgvQVV3RWYwRUJJUUlnQVVHQUFYSUZRUUFMQ3lFREN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0JpSUVCRUFnQkVFQmF3NEhBUUlEQkFVR0J3Z0xJQU1rUUF3SEN5QURKRUVNQmdzZ0F5UkNEQVVMSUFNa1F3d0VDeUFESkVRTUF3c2dBeVJGREFJTElBVkJCRWdpQkFSL0lBUUZJQVZCQjBvTEJFQWpSVUgvQVhFalJFSC9BWEZCQ0hSeUlBTVFkZ3NNQVFzZ0F5US9DMEVFUVg4Z0Foc0w3Z01BQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FCUndSQUlBQkJ3UUZyRGc4QkFoRURCQVVHQndnSkNnc1FEQTBPQ3lOR1FRZDJRUUZ4RFJFTURnc2pSeENaQVVILy93TnhJUUFqUjBFQ2FrSC8vd054SkVjZ0FFR0EvZ054UVFoMUpFQWdBRUgvQVhFa1FVRUVEd3NqUmtFSGRrRUJjUTBSREE0TEkwWkJCM1pCQVhFTkVBd01DeU5IUVFKclFmLy9BM0VrUnlOSEkwRkIvd0Z4STBCQi93RnhRUWgwY2hCK0RBMExFSFFRakFFTURRc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJBQ1JJREFzTEkwWkJCM1pCQVhGQkFVY05DZ3dIQ3lOSEVKa0JRZi8vQTNFa1NDTkhRUUpxUWYvL0EzRWtSd3dKQ3lOR1FRZDJRUUZ4UVFGR0RRY01DZ3NRZEVIL0FYRVFvd0VoQUNOSVFRRnFRZi8vQTNFa1NDQUFEd3NqUmtFSGRrRUJjVUVCUncwSUkwZEJBbXRCLy84RGNTUkhJMGNqU0VFQ2FrSC8vd054RUg0TUJRc1FkQkNOQVF3R0N5TkhRUUpyUWYvL0EzRWtSeU5ISTBnUWZrRUlKRWdNQkF0QmZ3OExJMGNRbVFGQi8vOERjU1JJSTBkQkFtcEIvLzhEY1NSSFFRd1BDeU5IUVFKclFmLy9BM0VrUnlOSEkwaEJBbXBCLy84RGNSQitDeEIxUWYvL0EzRWtTQXRCQ0E4TEkwaEJBV3BCLy84RGNTUklRUVFQQ3lOSVFRSnFRZi8vQTNFa1NFRU1DOU1EQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUJSd1JBSUFCQjBRRnJEZzhCQWcwREJBVUdCd2dKRFFvTkN3d05DeU5HUVFSMlFRRnhEUThNRFFzalJ4Q1pBVUgvL3dOeElRQWpSMEVDYWtILy93TnhKRWNnQUVHQS9nTnhRUWgxSkVJZ0FFSC9BWEVrUTBFRUR3c2pSa0VFZGtFQmNRMFBEQXdMSTBaQkJIWkJBWEVORGlOSFFRSnJRZi8vQTNFa1J5TkhJMGhCQW1wQi8vOERjUkIrREFzTEkwZEJBbXRCLy84RGNTUkhJMGNqUTBIL0FYRWpRa0gvQVhGQkNIUnlFSDRNQ3dzUWRCQ1BBUXdMQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFUUpFZ01DUXNqUmtFRWRrRUJjVUVCUncwSURBWUxJMGNRbVFGQi8vOERjU1JJUVFFa21nRWpSMEVDYWtILy93TnhKRWNNQndzalJrRUVka0VCY1VFQlJnMEZEQWdMSTBaQkJIWkJBWEZCQVVjTkJ5TkhRUUpyUWYvL0EzRWtSeU5ISTBoQkFtcEIvLzhEY1JCK0RBUUxFSFFRa0FFTUJRc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJHQ1JJREFNTFFYOFBDeU5IRUprQlFmLy9BM0VrU0NOSFFRSnFRZi8vQTNFa1IwRU1Ed3NRZFVILy93TnhKRWdMUVFnUEN5TklRUUZxUWYvL0EzRWtTRUVFRHdzalNFRUNha0gvL3dOeEpFaEJEQXZ3QWdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIZ0FVY0VRQ0FBUWVFQmF3NFBBUUlMQ3dNRUJRWUhDQXNMQ3drS0N3c1FkRUgvQVhGQmdQNERhaU0vRUhZTUN3c2pSeENaQVVILy93TnhJUUFqUjBFQ2FrSC8vd054SkVjZ0FFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JVRUVEd3NqUVVHQS9nTnFJejhRZGtFRUR3c2pSMEVDYTBILy93TnhKRWNqUnlORlFmOEJjU05FUWY4QmNVRUlkSElRZmtFSUR3c1FkQkNTQVF3SEN5TkhRUUpyUWYvL0EzRWtSeU5ISTBnUWZrRWdKRWhCQ0E4TEVIUVFnZ0ZCR0hSQkdIVWhBQ05ISUFCQkFSQi9JMGNnQUdwQi8vOERjU1JIUVFBUWVrRUFFSHNqU0VFQmFrSC8vd054SkVoQkRBOExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpUklRUVFQQ3hCMVFmLy9BM0VqUHhCMkkwaEJBbXBCLy84RGNTUklRUVFQQ3hCMEVKTUJEQUlMSTBkQkFtdEIvLzhEY1NSSEkwY2pTQkIrUVNna1NFRUlEd3RCZnc4TEkwaEJBV3BCLy84RGNTUklRUVFMcHdNQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGSEJFQWdBRUh4QVdzT0R3RUNBdzBFQlFZSENBa0tEUTBMREEwTEVIUkIvd0Z4UVlEK0Eyb1FnQUZCL3dGeEpEOE1EUXNqUnhDWkFVSC8vd054SVFBalIwRUNha0gvL3dOeEpFY2dBRUdBL2dOeFFRaDFKRDhnQUVIL0FYRWtSZ3dOQ3lOQlFZRCtBMm9RZ0FGQi93RnhKRDhNREF0QkFDU1pBUXdMQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMFpCL3dGeEl6OUIvd0Z4UVFoMGNoQitRUWdQQ3hCMEVKVUJEQWdMSTBkQkFtdEIvLzhEY1NSSEkwY2pTQkIrUVRBa1NFRUlEd3NRZEJDQ0FTRUFRUUFRZWtFQUVIc2pSeUFBUVJoMFFSaDFJZ0JCQVJCL0kwY2dBR3BCLy84RGNTSUFRWUQrQTNGQkNIVWtSQ0FBUWY4QmNTUkZJMGhCQVdwQi8vOERjU1JJUVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJa1IwRUlEd3NRZFVILy93TnhFSUFCUWY4QmNTUS9JMGhCQW1wQi8vOERjU1JJREFVTFFRRWttZ0VNQkFzUWRCQ1dBUXdDQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFNEpFaEJDQThMUVg4UEN5TklRUUZxUWYvL0EzRWtTQXRCQkF2Y0FRRUJmeU5JUVFGcVFmLy9BM0VrU0NOTUJFQWpTRUVCYTBILy93TnhKRWdMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGR0RRRUNRQ0FCUVFKckRnMERCQVVHQndnSkNnc01EUTRQQUFzTUR3c2dBQkNCQVE4TElBQVFoQUVQQ3lBQUVJVUJEd3NnQUJDR0FROExJQUFRaHdFUEN5QUFFSWdCRHdzZ0FCQ0pBUThMSUFBUWlnRVBDeUFBRUk0QkR3c2dBQkNSQVE4TElBQVFsQUVQQ3lBQUVKY0JEd3NnQUJDa0FROExJQUFRcFFFUEN5QUFFS1lCRHdzZ0FCQ25BUXZDQVFFQ2YwRUFKSmtCUVkvK0F4QUJRUUVnQUhSQmYzTnhJZ0VraEFGQmovNERJQUVRQkNOSFFRSnJRZi8vQTNFa1J3SkFJMG9pQVNOTElBRWJEUUFMSTBjaUFTTklJZ0pCL3dGeEVBUWdBVUVCYWlBQ1FZRCtBM0ZCQ0hVUUJBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09Bd01FQlFBTERBVUxRUUFrZjBIQUFDUklEQVFMUVFBa2dBRkJ5QUFrU0F3REMwRUFKSUVCUWRBQUpFZ01BZ3RCQUNTQ0FVSFlBQ1JJREFFTFFRQWtnd0ZCNEFBa1NBc0wrUUVCQTM4am1nRUVRRUVCSkprQlFRQWttZ0VMSTM0amhBRnhRUjl4UVFCS0JFQWpTMFVqbVFFaUFpQUNHd1IvSTM4amVTSUFJQUFiQkg5QkFCQ3BBVUVCQlNPQUFTTjZJZ0FnQUJzRWYwRUJFS2tCUVFFRkk0RUJJM3NpQUNBQUd3Ui9RUUlRcVFGQkFRVWpnZ0VqZkNJQUlBQWJCSDlCQXhDcEFVRUJCU09EQVNOOUlnQWdBQnNFZjBFRUVLa0JRUUVGUVFBTEN3c0xDd1ZCQUFzRVFBSi9RUUVqU2lJQUkwc2dBQnNOQUJwQkFBc0VmMEVBSkV0QkFDUktRUUFrVEVFQUpFMUJHQVZCRkFzaEFRc0NmMEVCSTBvaUFDTkxJQUFiRFFBYVFRQUxCRUJCQUNSTFFRQWtTa0VBSkV4QkFDUk5DeUFCRHd0QkFBdXJBUUVDZjBFQkpDMGpUQVJBSTBnUUFVSC9BWEVRcUFFUWMwRUFKRXRCQUNSS1FRQWtURUVBSkUwTEVLb0JJZ0ZCQUVvRVFDQUJFSE1MUVFRaEFBSi9RUUVqU2lJQkkwc2dBUnNOQUJwQkFBdEZJZ0VFZnlOTlJRVWdBUXNFUUNOSUVBRkIvd0Z4RUtnQklRQUxJMFpCOEFGeEpFWWdBRUVBVEFSQUlBQVBDeUFBRUhNamx3RkJBV29rbHdFamx3RWpsUUZPQkVBamxnRkJBV29rbGdFamx3RWpsUUZySkpjQkN5QUFDd1FBSTJvTDVnRUJCWDhnQUVGL1FZQUlJQUJCQUVnYklBQkJBRW9iSVFSQkFDRUFBMEFDZndKL0lBWkZJZ0lFUUNBQVJTRUNDeUFDQ3dSQUlBVkZJUUlMSUFJTEJFQWdBMFVoQWdzZ0FnUkFFS3NCUVFCSUJFQkJBU0VHQlNOSkl6NEVmMEdneVFnRlFkQ2tCQXRPQkVCQkFTRUFCU0FFUVg5S0lnSUVRQ05xSUFST0lRSUxJQUlFUUVFQklRVUZJQUZCZjBvaUFnUkFJMGdnQVVZaEFndEJBU0FESUFJYklRTUxDd3NNQVFzTElBQUVRQ05KSXo0RWYwR2d5UWdGUWRDa0JBdHJKRWtqaUFJUEN5QUZCRUFqaVFJUEN5QURCRUFqaWdJUEN5TklRUUZyUWYvL0EzRWtTRUYvQ3drQVFYOUJmeEN0QVFzNEFRTi9BMEFnQWlBQVNDSURCRUFnQVVFQVRpRURDeUFEQkVBUXJnRWhBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0pBRUYvSUFBUXJRRUxDUUFnQUNBQkVLMEJDd1VBSTVJQkN3VUFJNU1CQ3dVQUk1UUJDMThCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFJZ0ZCQVVZTkFRSkFJQUZCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJK29CRHdzajZ3RVBDeVBzQVE4TEkrMEJEd3NqN2dFUEN5UHZBUThMSS9BQkR3c2o4UUVQQzBFQUM0c0JBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FDSUNRUUZHRFFFQ1FDQUNRUUpyRGdZREJBVUdCd2dBQ3d3SUN5QUJRUUJISk9vQkRBY0xJQUZCQUVjazZ3RU1CZ3NnQVVFQVJ5VHNBUXdGQ3lBQlFRQkhKTzBCREFRTElBRkJBRWNrN2dFTUF3c2dBVUVBUnlUdkFRd0NDeUFCUVFCSEpQQUJEQUVMSUFGQkFFY2s4UUVMQzFRQkFYOUJBQ1JOSUFBUXRRRkZCRUJCQVNFQkN5QUFRUUVRdGdFZ0FRUkFRUUZCQVVFQVFRRkJBQ0FBUVFOTUd5SUJJNzhCSWdBZ0FCc2JJQUZGSThBQklnQWdBQnNiQkVCQkFTU0RBVUVFRURvTEN3c0pBQ0FBUVFBUXRnRUxtZ0VBSUFCQkFFb0VRRUVBRUxjQkJVRUFFTGdCQ3lBQlFRQktCRUJCQVJDM0FRVkJBUkM0QVFzZ0FrRUFTZ1JBUVFJUXR3RUZRUUlRdUFFTElBTkJBRW9FUUVFREVMY0JCVUVERUxnQkN5QUVRUUJLQkVCQkJCQzNBUVZCQkJDNEFRc2dCVUVBU2dSQVFRVVF0d0VGUVFVUXVBRUxJQVpCQUVvRVFFRUdFTGNCQlVFR0VMZ0JDeUFIUVFCS0JFQkJCeEMzQVFWQkJ4QzRBUXNMQkFBalB3c0VBQ05BQ3dRQUkwRUxCQUFqUWdzRUFDTkRDd1FBSTBRTEJBQWpSUXNFQUNOR0N3UUFJMGdMQkFBalJ3c0dBQ05JRUFFTEJBQWpWZ3V2QXdFS2YwR0FnQUpCZ0pBQ0k3a0JHeUVKUVlDNEFrR0FzQUlqdWdFYklRb0RRQ0FGUVlBQ1NBUkFRUUFoQkFOQUlBUkJnQUpJQkVBZ0NTQUZRUU4xUVFWMElBcHFJQVJCQTNWcUlnTkJnSkIrYWkwQUFCQXNJUWdnQlVFSWJ5RUJRUWNnQkVFSWIyc2hCa0VBSVFJQ2Z5QUFRUUJLSXpvaUJ5QUhHd1JBSUFOQmdOQithaTBBQUNFQ0N5QUNRY0FBY1FzRVFFRUhJQUZySVFFTFFRQWhCeUFCUVFGMElBaHFJZ05CZ0pCK2FrRUJRUUFnQWtFSWNSc2lCMEVCY1VFTmRHb3RBQUFoQ0VFQUlRRWdBMEdCa0g1cUlBZEJBWEZCRFhScUxRQUFRUUVnQm5SeEJFQkJBaUVCQ3lBQlFRRnFJQUZCQVNBR2RDQUljUnNoQVNBRlFRaDBJQVJxUVFOc0lRWWdBRUVBU2lNNklnTWdBeHNFUUNBQ1FRZHhJQUZCQUJBdElnRkJIM0ZCQTNRaEF5QUdRWUNoQzJvaUFpQURPZ0FBSUFKQkFXb2dBVUhnQjNGQkJYVkJBM1E2QUFBZ0FrRUNhaUFCUVlENEFYRkJDblZCQTNRNkFBQUZJQUZCeC80RFFRQVFMaUVDUVFBaEFRTkFJQUZCQTBnRVFDQUdRWUNoQzJvZ0FXb2dBam9BQUNBQlFRRnFJUUVNQVFzTEN5QUVRUUZxSVFRTUFRc0xJQVZCQVdvaEJRd0JDd3NMeUFFQkJuOENRQU5BSUFGQkYwNE5BVUVBSVFBRFFBSkFJQUJCSDA0TkFFRUFJUVJCQVVFQUlBQkJEMG9iSVFRZ0FTRUNJQUpCRDJzZ0FpQUJRUTlLRzBFRWRDRUNJQUJCRDJzZ0Ftb2dBQ0FDYWlBQVFROUtHeUVDUVlDQUFpRUZRWUNRQWtHQWdBSWdBVUVQU2hzaEJVRUFJUU1EUUFKQUlBTkJDRTROQUNBQ0lBVWdCRUVBUVFjZ0F5QUFRUU4wSUFGQkEzUWdBMnBCK0FGQmdLRVhRUUZCZnhBdkdpQURRUUZxSVFNTUFRc0xJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUFBQ3dBTEM0QUNBUWQvQTBBZ0JFRUlUa1VFUUVFQUlRRURRQ0FCUVFWSUJFQWdBVUVEZENBRWFrRUNkQ0lBUVlEOEEyb1FBUm9nQUVHQi9BTnFFQUVhSUFCQmd2d0RhaEFCSVFKQkFTRUZJN3NCQkVBZ0FrRUNiMEVCUmdSQUlBSkJBV3NoQWd0QkFpRUZDeUFBUVlQOEEyb1FBU0VBUVFBaEJrRUJRUUFnQUVFSWNVRUFSeU02SXpvYkd5RUdRUUFoQUFOQUlBQWdCVWdFUUVFQUlRTURRQ0FEUVFoSUJFQWdBQ0FDYWtHQWdBSWdCa0VBUVFjZ0F5QUVRUU4wSUFGQkJIUWdBMm9nQUVFRGRHcEJ3QUJCZ0tFZ1FRRkJmeEF2R2lBRFFRRnFJUU1NQVFzTElBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBRUxDeUFFUVFGcUlRUU1BUXNMQ3dVQUk0WUJDd1VBSTRjQkN3VUFJNGdCQ3hnQkFYOGppZ0VoQUNPSkFRUkFJQUJCQkhJaEFBc2dBQXN0QVFGL0FrQURRQ0FBUWYvL0EwNE5BU0FBUVlDaHlRUnFJQUFRVWpvQUFDQUFRUUZxSVFBTUFBQUxBQXNMRkFBL0FFR1VBVWdFUUVHVUFUOEFhMEFBR2dzTEF3QUJDeDhBQWtBQ1FBSkFJNWtDRGdJQkFnQUxBQXRCQUNFQUN5QUFRWDhRclFFTEJ3QWdBQ1NaQWdzdkFBSkFBa0FDUUFKQUFrQWptUUlPQkFFQ0F3UUFDd0FMUVFFaEFBdEJmeUVCQzBGL0lRSUxJQUVnQWhDdEFRc0FNeEJ6YjNWeVkyVk5ZWEJ3YVc1blZWSk1JV052Y21VdlpHbHpkQzlqYjNKbExuVnVkRzkxWTJobFpDNTNZWE50TG0xaGNBPT0iKSkuaW5zdGFuY2U7CmNvbnN0IGI9bmV3IFVpbnQ4QXJyYXkoYS5leHBvcnRzLm1lbW9yeS5idWZmZXIpO3JldHVybntpbnN0YW5jZTphLGJ5dGVNZW1vcnk6Yix0eXBlOiJXZWIgQXNzZW1ibHkifX07bGV0IHIsdSxELGM7Yz17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCwKV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxzcGVlZDowLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsYnJlYWtwb2ludDp2b2lkIDAsbWVzc2FnZUhhbmRsZXI6KGEpPT57Y29uc3QgYj1uKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5ncmFwaGljc1dvcmtlclBvcnQ9CmIubWVzc2FnZS5wb3J0c1swXSxxKEguYmluZCh2b2lkIDAsYyksYy5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEsuYmluZCh2b2lkIDAsYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEouYmluZCh2b2lkIDAsYyksYy5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihjLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShJLmJpbmQodm9pZCAwLGMpLGMuYXVkaW9Xb3JrZXJQb3J0KSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBPKHApO2Mud2FzbUluc3RhbmNlPWEuaW5zdGFuY2U7CmMud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2soaCh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgZi5DT05GSUc6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkoYyxiLm1lc3NhZ2UuY29uZmlnKTtjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SRVNFVF9BVURJT19RVUVVRTpjLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUExBWTpjYXNlIGYuUExBWV9VTlRJTF9CUkVBS1BPSU5UOmlmKCFjLnBhdXNlZHx8IWMud2FzbUluc3RhbmNlfHwhYy53YXNtQnl0ZU1lbW9yeSl7ayhoKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTticmVha31jLnBhdXNlZD0hMTtjLmZwc1RpbWVTdGFtcHM9W107dyhjKTtjLmZyYW1lU2tpcENvdW50ZXI9MDtjLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9CjA7Yy5icmVha3BvaW50PXZvaWQgMDtiLm1lc3NhZ2UuYnJlYWtwb2ludCYmKGMuYnJlYWtwb2ludD1iLm1lc3NhZ2UuYnJlYWtwb2ludCk7RShjLDFFMy9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5QQVVTRTpjLnBhdXNlZD0hMDtjLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KGMudXBkYXRlSWQpLGMudXBkYXRlSWQ9dm9pZCAwKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP2Mud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPQowO2xldCBkPWMud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoZD1iLm1lc3NhZ2UuZW5kKTthPWMud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxkKS5idWZmZXI7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgZi5HRVRfV0FTTV9DT05TVEFOVDprKGgoe3R5cGU6Zi5HRVRfV0FTTV9DT05TVEFOVCxyZXNwb25zZTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5GT1JDRV9PVVRQVVRfRlJBTUU6QihjKTticmVhaztjYXNlIGYuU0VUX1NQRUVEOmMuc3BlZWQ9Yi5tZXNzYWdlLnNwZWVkO2MuZnBzVGltZVN0YW1wcz1bXTtjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTYwO3coYyk7Yy5mcmFtZVNraXBDb3VudGVyPTA7Yy5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQowO2Mud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCk7YnJlYWs7Y2FzZSBmLklTX0dCQzphPTA8Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5pc0dCQygpO2soaCh7dHlwZTpmLklTX0dCQyxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coIlVua25vd24gV2FzbUJveSBXb3JrZXIgbWVzc2FnZToiLGIpfX0sZ2V0RlBTOigpPT4wPGMudGltZVN0YW1wc1VudGlsUmVhZHk/Yy5zcGVlZCYmMDxjLnNwZWVkP2Mub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKmMuc3BlZWQ6Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU6Yy5mcHNUaW1lU3RhbXBzP2MuZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07cShjLm1lc3NhZ2VIYW5kbGVyKX0pKCk7Cg==";

var wasmboyGraphicsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsZil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6ZixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGs7Y29uc3QgbT0oYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6ZyhjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOnthPW5ldyBVaW50OENsYW1wZWRBcnJheShhLm1lc3NhZ2UuZ3JhcGhpY3NGcmFtZUJ1ZmZlcik7Y29uc3QgZj1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTIxNjApLGQ9bmV3IFVpbnQ4Q2xhbXBlZEFycmF5KDMpO2ZvcihsZXQgYz0wOzE0ND5jO2MrKylmb3IobGV0IGU9MDsxNjA+ZTtlKyspe3ZhciBiPTMqKDE2MCpjK2UpO2ZvcihsZXQgYz0wOzM+YztjKyspZFtjXT1hW2IrY107Yj00KihlKzE2MCpjKTtmW2JdPWRbMF07ZltiKzFdPWRbMV07ZltiKzJdPWRbMl07ZltiKzNdPTI1NX1hPWZ9ZyhjKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bCgoYSk9PnthPWEuZGF0YT8KYS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjprPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sayk7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmsucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

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

  postMessage(message, transfer) {
    const messageObject = getSmartWorkerMessage(message, undefined, this.id);
    const messageId = messageObject.messageId;
    const messageIdListener = new Promise(resolve => {
      // Listen for a message with the same message id to be returned
      this.addMessageListener((responseMessage, messageListener) => {
        const eventData = getEventData(responseMessage);

        if (eventData.messageId === messageId) {
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
      await WasmBoyMemory.initialize(this.options.headless, this.options.saveStateCallback);
      await loadROMAndConfigTask(fetchROMObject);
      this.ready = true;

      if (this.options.onReady) {
        this.options.onReady();
      }
    } else {
      // Finally intialize all of our services
      // Initialize our services
      await Promise.all([WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback), WasmBoyAudio.initialize(this.options.updateAudioCallback), WasmBoyController.initialize(), WasmBoyMemory.initialize(this.options.headless, this.options.saveStateCallback)]);
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
    NativeBigInt.prototype.over = NativeBigInt.prototype.divide = SmallInteger.prototype.over = SmallInteger.prototype.divide = BigInteger.prototype.over = BigInteger.prototype.divide;

    BigInteger.prototype.mod = function (v) {
        return divModAny(this, v)[1];
    };
    NativeBigInt.prototype.mod = NativeBigInt.prototype.remainder = SmallInteger.prototype.remainder = SmallInteger.prototype.mod = BigInteger.prototype.remainder = BigInteger.prototype.mod;

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

    var pow;
    if (supportsNativeBigInt) {
        // forced to use eval because ** is a syntax error on pre-ECMAScript2017 environments.
        pow = eval("(a,b)=>a**b");
    }

    NativeBigInt.prototype.pow = function (v) {
        var n = parseValue(v);
        var a = this.value, b = n.value;
        if (b === BigInt(0)) return Integer[1];
        if (a === BigInt(0)) return Integer[0];
        if (a === BigInt(1)) return Integer[1];
        if (a === BigInt(-1)) return n.isEven() ? Integer[1] : Integer[-1];
        if (n.isNegative()) return new NativeBigInt(BigInt(0));
        return new NativeBigInt(pow(a, b));
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
const playUntilBreakpoint = async breakpoint => {
  await WasmBoyLib.play(breakpoint);
  const message = await waitForLibWorkerMessageType(WORKER_MESSAGE_TYPE.BREAKPOINT);
  await WasmBoyLib.pause();
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
function waitForLibWorkerMessageType(messageType) {
  if (!messageRequests[messageType]) {
    messageRequests[messageType] = [];
  }

  const promise = new Promise(resolve => {
    messageRequests[messageType].push(resolve);
  });
  return promise;
} // Functions to handle the lib worker messages

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
      window.document.addEventListener('visibilitychange', () => {
        // fires when user switches tabs, apps, goes to homescreen, etc.
        if (document.visibilityState === 'hidden') {
          if (this.options && this.options.disablePauseOnHidden) {
            return;
          }

          this.pause();
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


  play(optionalBreakpoint) {
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
        if (optionalBreakpoint) {
          await this.worker.postMessage({
            type: WORKER_MESSAGE_TYPE.PLAY_UNTIL_BREAKPOINT,
            breakpoint: optionalBreakpoint
          });
        } else {
          await this.worker.postMessage({
            type: WORKER_MESSAGE_TYPE.PLAY
          });
        }
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
        await this.worker.postMessage({
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
      audioBatchProcessing: false,
      graphicsBatchProcessing: false,
      timersBatchProcessing: false,
      graphicsDisableScanlineRendering: false,
      audioAccumulateSamples: false,
      tileRendering: false,
      tileCaching: false,
      updateGraphicsCallback: null,
      updateAudioCallback: null,
      saveStateCallback: null,
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
var version = "0.3.4";
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
	"benchmark:watch": "npx rollup -c -w --environment TS,BENCHMARK,SERVE",
	"amp:build": "npx rollup -c --environment PROD,TS,AMP",
	"amp:build:skiplib": "npx rollup -c --environment PROD,TS,AMP,SKIP_LIB",
	"amp:dev": "npm run amp:watch",
	"amp:watch": "npx rollup -c -w --environment TS,AMP,SERVE",
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
  saveState: WasmBoyLib.saveState.bind(WasmBoyLib),
  getSaveStates: WasmBoyLib.getSaveStates.bind(WasmBoyLib),
  loadState: WasmBoyLib.loadState.bind(WasmBoyLib),
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
  _playUntilBreakpoint: playUntilBreakpoint,
  _runNumberOfFrames: runNumberOfFrames,
  _runWasmExport: runWasmExport,
  _getWasmMemorySection: getWasmMemorySection,
  _getWasmConstant: getWasmConstant,
  _getStepsAsString: getStepsAsString,
  _getCyclesAsString: getCyclesAsString
};

exports.WasmBoy = WasmBoy;
//# sourceMappingURL=wasmboy.wasm.cjs.js.map
