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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBIKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKX19ZnVuY3Rpb24gSShhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfMl9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF8zX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzRfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc291bmRPdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7CmJyZWFrO2Nhc2UgZi5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSihhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geihhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLAphLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04rZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQShhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIEsoYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhazsKY2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpOwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCeXRlc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5TRVRfTUVNT1JZOmQ9T2JqZWN0LmtleXMoYi5tZXNzYWdlKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSwKYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2QuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuR0FNRUJPWV9NRU1PUlldKSxhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksCmEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5TRVRfTUVNT1JZX0RPTkV9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkdFVF9NRU1PUlk6e2Q9e3R5cGU6Zi5HRVRfTUVNT1JZfTtjb25zdCBsPVtdO3ZhciBjPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD1lJiYzPj1lP209MjA5NzE1Mjo1PD1lJiY2Pj1lP209MjYyMTQ0OjE1PD1lJiYxOT49ZT9tPTIwOTcxNTI6MjU8PWUmJjMwPj1lJiYobT04Mzg4NjA4KTtlPW0/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiwKYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbSk6bmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGU9eihhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmRbZy5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9QShhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT1jLGwucHVzaChjKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCxiLm1lc3NhZ2VJZCksbCl9fX1mdW5jdGlvbiBMKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpOwphLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB3KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEIoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gQyhhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUQtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0UoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEUoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRD1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksQyhhKSwhMDtMKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZDtjP3goYSxiKTooZD12b2lkIDAhPT1hLmJyZWFrcG9pbnQ/CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lVW50aWxCcmVha3BvaW50KGEuYnJlYWtwb2ludCk6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWUoKSxiKGQpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEIoYSk7Y29uc3QgZD17dHlwZTpmLlVQREFURUR9O2RbZy5DQVJUUklER0VfUkFNXT16KGEpLmJ1ZmZlcjtkW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyOwpkW2cuUEFMRVRURV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5JTlRFUk5BTF9TVEFURV09QShhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChkKSxbZFtnLkNBUlRSSURHRV9SQU1dLGRbZy5HQU1FQk9ZX01FTU9SWV0sZFtnLlBBTEVUVEVfTUVNT1JZXSxkW2cuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/ayhoKHt0eXBlOmYuQlJFQUtQT0lOVH0pKTpDKGEpfWVsc2UgayhoKHt0eXBlOmYuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHgoYSxiKXt2YXIgZD0tMTtkPXZvaWQgMCE9PWEuYnJlYWtwb2ludD8KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvVW50aWxCcmVha3BvaW50KDEwMjQsYS5icmVha3BvaW50KTphLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PWQmJmIoZCk7aWYoMT09PWQpe2Q9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nZXRBdWRpb1F1ZXVlSW5kZXgoKTtjb25zdCBjPXI+PXU7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmYz8oRihhLGQpLHNldFRpbWVvdXQoKCk9Pnt3KGEpO3goYSxiKX0sTWF0aC5mbG9vcihNYXRoLmZsb29yKDFFMyooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOihGKGEsZCkseChhLGIpKX19ZnVuY3Rpb24gRihhLGIpe3ZhciBkPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyOwpjb25zdCBjPXt0eXBlOmYuVVBEQVRFRCxhdWRpb0J1ZmZlcjpkLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX07ZD1bZF07aWYoYS5vcHRpb25zJiZhLm9wdGlvbnMuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Yy5jaGFubmVsMUJ1ZmZlcj1lO2QucHVzaChlKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Yy5jaGFubmVsMkJ1ZmZlcj1lO2QucHVzaChlKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDNCdWZmZXI9ZTtkLnB1c2goZSk7Yj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDRCdWZmZXI9YjtkLnB1c2goYil9YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChjKSxkKTthLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpfWNvbnN0IHA9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgdjtwfHwodj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2NvbnN0IGY9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLApHRVRfTUVNT1JZOiJHRVRfTUVNT1JZIixTRVRfTUVNT1JZOiJTRVRfTUVNT1JZIixTRVRfTUVNT1JZX0RPTkU6IlNFVF9NRU1PUllfRE9ORSIsR0VUX0NPTlNUQU5UUzoiR0VUX0NPTlNUQU5UUyIsR0VUX0NPTlNUQU5UU19ET05FOiJHRVRfQ09OU1RBTlRTX0RPTkUiLENPTkZJRzoiQ09ORklHIixSRVNFVF9BVURJT19RVUVVRToiUkVTRVRfQVVESU9fUVVFVUUiLFBMQVk6IlBMQVkiLFBMQVlfVU5USUxfQlJFQUtQT0lOVDoiUExBWV9VTlRJTF9CUkVBS1BPSU5UIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLFVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCIsCkZPUkNFX09VVFBVVF9GUkFNRToiRk9SQ0VfT1VUUFVUX0ZSQU1FIixTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSxnPXtDQVJUUklER0VfUkFNOiJDQVJUUklER0VfUkFNIixDQVJUUklER0VfUk9NOiJDQVJUUklER0VfUk9NIixDQVJUUklER0VfSEVBREVSOiJDQVJUUklER0VfSEVBREVSIixHQU1FQk9ZX01FTU9SWToiR0FNRUJPWV9NRU1PUlkiLFBBTEVUVEVfTUVNT1JZOiJQQUxFVFRFX01FTU9SWSIsSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IHQ9MCxNPXt9O2NvbnN0IHk9e2Vudjp7bG9nOihhLGIsYyxmLGUsZyxoKT0+e3ZhciBkPShuZXcgVWludDMyQXJyYXkod2FzbUluc3RhbmNlLmV4cG9ydHMubWVtb3J5LmJ1ZmZlcixhLDEpKVswXTthPVN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxuZXcgVWludDE2QXJyYXkod2FzbUluc3RhbmNlLmV4cG9ydHMubWVtb3J5LmJ1ZmZlcixhKzQsZCkpOy05OTk5IT09YiYmKGE9YS5yZXBsYWNlKCIkMCIsCmIpKTstOTk5OSE9PWMmJihhPWEucmVwbGFjZSgiJDEiLGMpKTstOTk5OSE9PWYmJihhPWEucmVwbGFjZSgiJDIiLGYpKTstOTk5OSE9PWUmJihhPWEucmVwbGFjZSgiJDMiLGUpKTstOTk5OSE9PWcmJihhPWEucmVwbGFjZSgiJDQiLGcpKTstOTk5OSE9PWgmJihhPWEucmVwbGFjZSgiJDUiLGgpKTtjb25zb2xlLmxvZygiW1dhc21Cb3ldICIrYSl9LGhleExvZzooYSxiKT0+e2lmKCFNW2FdKXtsZXQgYz0iW1dhc21Cb3ldIjstOTk5OSE9PWEmJihjKz1gIDB4JHthLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1iJiYoYys9YCAweCR7Yi50b1N0cmluZygxNil9IGApO2NvbnNvbGUubG9nKGMpfX19fSxHPWFzeW5jKGEpPT57bGV0IGI9dm9pZCAwO3JldHVybiBiPVdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nP2F3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nKGZldGNoKGEpLHkpOmF3YWl0IChhc3luYygpPT57Y29uc3QgYj1hd2FpdCBmZXRjaChhKS50aGVuKChhKT0+CmEuYXJyYXlCdWZmZXIoKSk7cmV0dXJuIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGIseSl9KSgpfSxOPWFzeW5jKGEpPT57YT1CdWZmZXIuZnJvbShhLnNwbGl0KCIsIilbMV0sImJhc2U2NCIpO3JldHVybiBhd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShhLHkpfSxPPWFzeW5jKGEpPT57YT0oYT9hd2FpdCBHKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlnRVNZQXAvZjM5L2YzOS9mMzkvQUdBQUFHQUJmd0YvWUFKL2Z3QmdBWDhBWUFKL2Z3Ri9ZQUFCZjJBRGYzOS9BWDlnQTM5L2Z3QmdCbjkvZjM5L2Z3QmdCMzkvZjM5L2YzOEJmMkFIZjM5L2YzOS9md0JnQkg5L2YzOEJmMkFJZjM5L2YzOS9mMzhBWUFWL2YzOS9md0YvWUExL2YzOS9mMzkvZjM5L2YzOS9BWDlnQUFCZ0FuOS9BWDhEMVFIVEFRSUNBUUVEQVFFQkFRRUJBUUVCQkFRQkFRRUFCZ0VCQVFFQkFRRUJCQVFCQVFFQkFRRUJBUVlHQmdZT0JRY0hEd29MQ1FrSUNBTUVBUUVFQVFRQkFRRUJBUUlDQlFJQ0FnSUZEQVFFQkFFQ0JnSUNBd1FFQkFRQkFRRUJCQVVFQmdZRUF3SUZCQUVRQkFVRENBRUZBUVFCQlFRRUJnWURCUVFEQkFRRUF3TUlBZ0lDQkFJQ0FnSUNBZ0lEQkFRQ0JBUUNCQVFDQkFRQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJRUJnWUdFUVlDQWdVR0JnWUNBd1FFRFFZR0JnWUdCZ1lHQmdZR0JnUUJBUVlHQmdZQkFRRUNCQWNFQkFGd0FBRUZBd0VBQUFhWERKb0Nmd0JCQUF0L0FFR0FDQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVHQWdBRUxmd0JCZ0pBQkMzOEFRWUNBQWd0L0FFR0FrQU1MZndCQmdJQUJDMzhBUVlBUUMzOEFRWUNBQkF0L0FFR0FrQVFMZndCQmdBRUxmd0JCZ0pFRUMzOEFRWUM0QVF0L0FFR0F5UVVMZndCQmdOZ0ZDMzhBUVlDaEN3dC9BRUdBZ0F3TGZ3QkJnS0VYQzM4QVFZQ0FDUXQvQUVHQW9TQUxmd0JCZ1BnQUMzOEFRWUNRQkF0L0FFR0FpUjBMZndCQmdKa2hDMzhBUVlDQUNBdC9BRUdBbVNrTGZ3QkJnSUFJQzM4QVFZQ1pNUXQvQUVHQWdBZ0xmd0JCZ0prNUMzOEFRWUNBQ0F0L0FFR0FtY0VBQzM4QVFZQ0FDQXQvQUVHQW1ja0FDMzhBUVlDQUNBdC9BRUdBbWRFQUMzOEFRWUNJK0FNTGZ3QkJnS0hKQkF0L0FFSC8vd01MZndCQkFBdC9BRUdBb2MwRUMzOEFRWlFCQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIUC9nTUxmd0ZCQUF0L0FVSHcvZ01MZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQi93QUxmd0ZCL3dBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQmdLald1UWNMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWDhMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBOXdJTGZ3RkJnSUFJQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkIxZjREQzM4QlFkSCtBd3QvQVVIUy9nTUxmd0ZCMC80REMzOEJRZFQrQXd0L0FVSG8vZ01MZndGQjYvNERDMzhCUWVuK0F3dC9BVUVBQzM4QlFRRUxmd0ZCQWd0L0FFR0FvYzBFQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFZQ0FCQXQvQUVHQWtBUUxmd0JCZ0pBRUMzOEFRWUFCQzM4QVFZREpCUXQvQUVHQW9Rc0xmd0JCZ0tFWEMzOEFRWUNad1FBTGZ3QkJnSm5KQUF0L0FFR0FtZEVBQzM4QlFRQUxCN3NTYkFadFpXMXZjbmtDQUFWMFlXSnNaUUVBQm1OdmJtWnBad0FURG1oaGMwTnZjbVZUZEdGeWRHVmtBQlFKYzJGMlpWTjBZWFJsQUJzSmJHOWhaRk4wWVhSbEFDWUZhWE5IUWtNQUp4Sm5aWFJUZEdWd2MxQmxjbE4wWlhCVFpYUUFLQXRuWlhSVGRHVndVMlYwY3dBcENHZGxkRk4wWlhCekFDb1ZaWGhsWTNWMFpVMTFiSFJwY0d4bFJuSmhiV1Z6QUs4QkRHVjRaV04xZEdWR2NtRnRaUUN1QVFoZmMyVjBZWEpuWXdEUkFSbGxlR1ZqZFhSbFJuSmhiV1ZCYm1SRGFHVmphMEYxWkdsdkFOQUJHMlY0WldOMWRHVkdjbUZ0WlZWdWRHbHNRbkpsWVd0d2IybHVkQUN3QVNobGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2Vlc1MGFXeENjbVZoYTNCdmFXNTBBTEVCRldWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJnRFNBUXRsZUdWamRYUmxVM1JsY0FDckFSUm5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkQUN5QVF4blpYUkRlV05zWlZObGRITUFzd0VKWjJWMFEzbGpiR1Z6QUxRQkRuTmxkRXB2ZVhCaFpGTjBZWFJsQUxrQkgyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWElBckFFUVkyeGxZWEpCZFdScGIwSjFabVpsY2dBaUYxZEJVMDFDVDFsZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXlvVFYwRlRUVUpQV1Y5TlJVMVBVbGxmVTBsYVJRTXJFbGRCVTAxQ1QxbGZWMEZUVFY5UVFVZEZVd01zSGtGVFUwVk5Ra3haVTBOU1NWQlVYMDFGVFU5U1dWOU1UME5CVkVsUFRnTUFHa0ZUVTBWTlFreFpVME5TU1ZCVVgwMUZUVTlTV1Y5VFNWcEZBd0VXVjBGVFRVSlBXVjlUVkVGVVJWOU1UME5CVkVsUFRnTUNFbGRCVTAxQ1QxbGZVMVJCVkVWZlUwbGFSUU1ESUVkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd29jUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZVMGxhUlFNTEVsWkpSRVZQWDFKQlRWOU1UME5CVkVsUFRnTUVEbFpKUkVWUFgxSkJUVjlUU1ZwRkF3VVJWMDlTUzE5U1FVMWZURTlEUVZSSlQwNERCZzFYVDFKTFgxSkJUVjlUU1ZwRkF3Y21UMVJJUlZKZlIwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQ0NKUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXdrWVIxSkJVRWhKUTFOZlQxVlVVRlZVWDB4UFEwRlVTVTlPQXhnVVIxSkJVRWhKUTFOZlQxVlVVRlZVWDFOSldrVURHUlJIUWtOZlVFRk1SVlJVUlY5TVQwTkJWRWxQVGdNTUVFZENRMTlRUVV4RlZGUkZYMU5KV2tVRERSaENSMTlRVWtsUFVrbFVXVjlOUVZCZlRFOURRVlJKVDA0RERoUkNSMTlRVWtsUFVrbFVXVjlOUVZCZlUwbGFSUU1QRGtaU1FVMUZYMHhQUTBGVVNVOU9BeEFLUmxKQlRVVmZVMGxhUlFNUkYwSkJRMHRIVWs5VlRrUmZUVUZRWDB4UFEwRlVTVTlPQXhJVFFrRkRTMGRTVDFWT1JGOU5RVkJmVTBsYVJRTVRFbFJKVEVWZlJFRlVRVjlNVDBOQlZFbFBUZ01VRGxSSlRFVmZSRUZVUVY5VFNWcEZBeFVTVDBGTlgxUkpURVZUWDB4UFEwRlVTVTlPQXhZT1QwRk5YMVJKVEVWVFgxTkpXa1VERnhWQlZVUkpUMTlDVlVaR1JWSmZURTlEUVZSSlQwNERJaEZCVlVSSlQxOUNWVVpHUlZKZlUwbGFSUU1qR1VOSVFVNU9SVXhmTVY5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRER2hWRFNFRk9Ua1ZNWHpGZlFsVkdSa1ZTWDFOSldrVURHeGxEU0VGT1RrVk1YekpmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeHdWUTBoQlRrNUZURjh5WDBKVlJrWkZVbDlUU1ZwRkF4MFpRMGhCVGs1RlRGOHpYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWVGVU5JUVU1T1JVeGZNMTlDVlVaR1JWSmZVMGxhUlFNZkdVTklRVTVPUlV4Zk5GOUNWVVpHUlZKZlRFOURRVlJKVDA0RElCVkRTRUZPVGtWTVh6UmZRbFZHUmtWU1gxTkpXa1VESVJaRFFWSlVVa2xFUjBWZlVrRk5YMHhQUTBGVVNVOU9BeVFTUTBGU1ZGSkpSRWRGWDFKQlRWOVRTVnBGQXlVV1EwRlNWRkpKUkVkRlgxSlBUVjlNVDBOQlZFbFBUZ01tRWtOQlVsUlNTVVJIUlY5U1QwMWZVMGxhUlFNbkhVUkZRbFZIWDBkQlRVVkNUMWxmVFVWTlQxSlpYMHhQUTBGVVNVOU9BeWdaUkVWQ1ZVZGZSMEZOUlVKUFdWOU5SVTFQVWxsZlUwbGFSUU1wSVdkbGRGZGhjMjFDYjNsUFptWnpaWFJHY205dFIyRnRaVUp2ZVU5bVpuTmxkQUFBREdkbGRGSmxaMmx6ZEdWeVFRQzZBUXhuWlhSU1pXZHBjM1JsY2tJQXV3RU1aMlYwVW1WbmFYTjBaWEpEQUx3QkRHZGxkRkpsWjJsemRHVnlSQUM5QVF4blpYUlNaV2RwYzNSbGNrVUF2Z0VNWjJWMFVtVm5hWE4wWlhKSUFMOEJER2RsZEZKbFoybHpkR1Z5VEFEQUFReG5aWFJTWldkcGMzUmxja1lBd1FFUloyVjBVSEp2WjNKaGJVTnZkVzUwWlhJQXdnRVBaMlYwVTNSaFkydFFiMmx1ZEdWeUFNTUJHV2RsZEU5d1kyOWtaVUYwVUhKdlozSmhiVU52ZFc1MFpYSUF4QUVGWjJWMFRGa0F4UUVkWkhKaGQwSmhZMnRuY205MWJtUk5ZWEJVYjFkaGMyMU5aVzF2Y25rQXhnRVlaSEpoZDFScGJHVkVZWFJoVkc5WFlYTnRUV1Z0YjNKNUFNY0JFMlJ5WVhkUFlXMVViMWRoYzIxTlpXMXZjbmtBeUFFR1oyVjBSRWxXQU1rQkIyZGxkRlJKVFVFQXlnRUdaMlYwVkUxQkFNc0JCbWRsZEZSQlF3RE1BUk4xY0dSaGRHVkVaV0oxWjBkQ1RXVnRiM0o1QU0wQkJuVndaR0YwWlFDdUFRMWxiWFZzWVhScGIyNVRkR1Z3QUtzQkVtZGxkRUYxWkdsdlVYVmxkV1ZKYm1SbGVBQ3NBUTl5WlhObGRFRjFaR2x2VVhWbGRXVUFJZzUzWVhOdFRXVnRiM0o1VTJsNlpRT0xBaHgzWVhOdFFtOTVTVzUwWlhKdVlXeFRkR0YwWlV4dlkyRjBhVzl1QTR3Q0dIZGhjMjFDYjNsSmJuUmxjbTVoYkZOMFlYUmxVMmw2WlFPTkFoMW5ZVzFsUW05NVNXNTBaWEp1WVd4TlpXMXZjbmxNYjJOaGRHbHZiZ09PQWhsbllXMWxRbTk1U1c1MFpYSnVZV3hOWlcxdmNubFRhWHBsQTQ4Q0UzWnBaR1Z2VDNWMGNIVjBURzlqWVhScGIyNERrQUlpWm5KaGJXVkpibEJ5YjJkeVpYTnpWbWxrWlc5UGRYUndkWFJNYjJOaGRHbHZiZ09UQWh0bllXMWxZbTk1UTI5c2IzSlFZV3hsZEhSbFRHOWpZWFJwYjI0RGtRSVhaMkZ0WldKdmVVTnZiRzl5VUdGc1pYUjBaVk5wZW1VRGtnSVZZbUZqYTJkeWIzVnVaRTFoY0V4dlkyRjBhVzl1QTVRQ0MzUnBiR1ZFWVhSaFRXRndBNVVDRTNOdmRXNWtUM1YwY0hWMFRHOWpZWFJwYjI0RGxnSVJaMkZ0WlVKNWRHVnpURzlqWVhScGIyNERtQUlVWjJGdFpWSmhiVUpoYm10elRHOWpZWFJwYjI0RGx3SUlBczRCQ1FnQkFFRUFDd0hQQVFyODJnSFRBYzhCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFTWRTSUJSUTBBQWtBZ0FVRUJhdzROQVFFQkFnSUNBZ01EQkFRRkJnQUxEQVlMSUFCQmdKblJBR29QQ3lBQVFRRWpPQ0lBSXpsRklnRUVmeUFBUlFVZ0FRc2JRUTUwYWtHQW1kQUFhZzhMSUFCQmdKQithaU02Qkg4ak94QUJRUUZ4QlVFQUMwRU5kR29QQ3lBQUl6eEJEWFJxUVlEWnhnQnFEd3NnQUVHQWtINXFEd3RCQUNFQkFuOGpPZ1JBSXowUUFVRUhjU0VCQ3lBQlFRRklDd1JBUVFFaEFRc2dBVUVNZENBQWFrR0E4SDFxRHdzZ0FFR0FVR29MQ1FBZ0FCQUFMUUFBQzVrQkFFRUFKRDVCQUNRL1FRQWtRRUVBSkVGQkFDUkNRUUFrUTBFQUpFUkJBQ1JGUVFBa1JrRUFKRWRCQUNSSVFRQWtTVUVBSkVwQkFDUkxRUUFrVEVFQUpFMGpPZ1JBUVJFa1AwR0FBU1JHUVFBa1FFRUFKRUZCL3dFa1FrSFdBQ1JEUVFBa1JFRU5KRVVGUVFFa1AwR3dBU1JHUVFBa1FFRVRKRUZCQUNSQ1FkZ0JKRU5CQVNSRVFjMEFKRVVMUVlBQ0pFaEIvdjhESkVjTHBBRUJBbjlCQUNST1FRRWtUMEhIQWhBQklRRkJBQ1JRUVFBa1VVRUFKRkpCQUNSVFFRQWtPU0FCQkVBZ0FVRUJUaUlBQkVBZ0FVRURUQ0VBQ3lBQUJFQkJBU1JSQlNBQlFRVk9JZ0FFUUNBQlFRWk1JUUFMSUFBRVFFRUJKRklGSUFGQkQwNGlBQVJBSUFGQkUwd2hBQXNnQUFSQVFRRWtVd1VnQVVFWlRpSUFCRUFnQVVFZVRDRUFDeUFBQkVCQkFTUTVDd3NMQ3dWQkFTUlFDMEVCSkRoQkFDUThDd3NBSUFBUUFDQUJPZ0FBQ3k4QVFkSCtBMEgvQVJBRVFkTCtBMEgvQVJBRVFkUCtBMEgvQVJBRVFkVCtBMEgvQVJBRVFkWCtBMEgvQVJBRUM1Z0JBRUVBSkZSQkFDUlZRUUFrVmtFQUpGZEJBQ1JZUVFBa1dVRUFKRm9qT2dSQVFaQUJKRlpCd1A0RFFaRUJFQVJCd2Y0RFFZRUJFQVJCeFA0RFFaQUJFQVJCeC80RFFmd0JFQVFGUVpBQkpGWkJ3UDREUVpFQkVBUkJ3ZjREUVlVQkVBUkJ4djREUWY4QkVBUkJ4LzREUWZ3QkVBUkJ5UDREUWY4QkVBUkJ5ZjREUWY4QkVBUUxRYy8rQTBFQUVBUkI4UDREUVFFUUJBdFBBQ002QkVCQjZQNERRY0FCRUFSQjZmNERRZjhCRUFSQjZ2NERRY0VCRUFSQjYvNERRUTBRQkFWQjZQNERRZjhCRUFSQjZmNERRZjhCRUFSQjZ2NERRZjhCRUFSQjYvNERRZjhCRUFRTEN5OEFRWkQrQTBHQUFSQUVRWkgrQTBHL0FSQUVRWkwrQTBIekFSQUVRWlArQTBIQkFSQUVRWlQrQTBHL0FSQUVDeXdBUVpYK0EwSC9BUkFFUVpiK0EwRS9FQVJCbC80RFFRQVFCRUdZL2dOQkFCQUVRWm4rQTBHNEFSQUVDeklBUVpyK0EwSC9BQkFFUVp2K0EwSC9BUkFFUVp6K0EwR2ZBUkFFUVozK0EwRUFFQVJCbnY0RFFiZ0JFQVJCQVNSckN5MEFRWi8rQTBIL0FSQUVRYUQrQTBIL0FSQUVRYUgrQTBFQUVBUkJvdjREUVFBUUJFR2ovZ05CdndFUUJBczRBRUVQSkd4QkR5UnRRUThrYmtFUEpHOUJBQ1J3UVFBa2NVRUFKSEpCQUNSelFmOEFKSFJCL3dBa2RVRUJKSFpCQVNSM1FRQWtlQXRuQUVFQUpGdEJBQ1JjUVFBa1hVRUJKRjVCQVNSZlFRRWtZRUVCSkdGQkFTUmlRUUVrWTBFQkpHUkJBU1JsUVFFa1prRUFKR2RCQUNSb1FRQWthVUVBSkdvUUNCQUpFQW9RQzBHay9nTkI5d0FRQkVHbC9nTkI4d0VRQkVHbS9nTkI4UUVRQkJBTUN6Z0FJQUJCQVhGQkFFY2tlU0FBUVFKeFFRQkhKSG9nQUVFRWNVRUFSeVI3SUFCQkNIRkJBRWNrZkNBQVFSQnhRUUJISkgwZ0FDUitDejBBSUFCQkFYRkJBRWNrZnlBQVFRSnhRUUJISklBQklBQkJCSEZCQUVja2dRRWdBRUVJY1VFQVJ5U0NBU0FBUVJCeFFRQkhKSU1CSUFBa2hBRUxYUUJCQUNTRkFVRUFKSVlCUVFBa2h3RkJBQ1NJQVVFQUpJa0JRUUFraWdGQkFDU0xBVUVBSkl3Qkl6b0VRRUdFL2dOQkhoQUVRYUE5SklZQkJVR0UvZ05CcXdFUUJFSE0xd0lraGdFTFFZZitBMEg0QVJBRVFmZ0JKSW9CQzBJQVFRQWtqUUZCQUNTT0FTTTZCRUJCZ3Y0RFFmd0FFQVJCQUNTUEFVRUFKSkFCUVFBa2tRRUZRWUwrQTBIK0FCQUVRUUFrandGQkFTU1FBVUVBSkpFQkN3djJBUUVDZjBIREFoQUJJZ0ZCd0FGR0lnQUVmeUFBQlNBQlFZQUJSaU12SWdBZ0FCc0xCRUJCQVNRNkJVRUFKRG9MRUFJUUF4QUZFQVlRQnhBTlFRQVFEa0gvL3dNamZoQUVRZUVCRUE5QmovNERJNFFCRUFRUUVCQVJJem9FUUVIdy9nTkIrQUVRQkVIUC9nTkIvZ0VRQkVITi9nTkIvZ0FRQkVHQS9nTkJ6d0VRQkVHUC9nTkI0UUVRQkVIcy9nTkIvZ0VRQkVIMS9nTkJqd0VRQkFWQjhQNERRZjhCRUFSQnovNERRZjhCRUFSQnpmNERRZjhCRUFSQmdQNERRYzhCRUFSQmovNERRZUVCRUFRTFFRQWtMVUdBcU5hNUJ5U1NBVUVBSkpNQlFRQWtsQUZCZ0tqV3VRY2tsUUZCQUNTV0FVRUFKSmNCQzY0QkFDQUFRUUJLQkVCQkFTUXVCVUVBSkM0TElBRkJBRW9FUUVFQkpDOEZRUUFrTHdzZ0FrRUFTZ1JBUVFFa01BVkJBQ1F3Q3lBRFFRQktCRUJCQVNReEJVRUFKREVMSUFSQkFFb0VRRUVCSkRJRlFRQWtNZ3NnQlVFQVNnUkFRUUVrTXdWQkFDUXpDeUFHUVFCS0JFQkJBU1EwQlVFQUpEUUxJQWRCQUVvRVFFRUJKRFVGUVFBa05Rc2dDRUVBU2dSQVFRRWtOZ1ZCQUNRMkN5QUpRUUJLQkVCQkFTUTNCVUVBSkRjTEVCSUxEQUFqTFFSQVFRRVBDMEVBQzdJQkFFR0FDQ00vT2dBQVFZRUlJMEE2QUFCQmdnZ2pRVG9BQUVHRENDTkNPZ0FBUVlRSUkwTTZBQUJCaFFnalJEb0FBRUdHQ0NORk9nQUFRWWNJSTBZNkFBQkJpQWdqUnpzQkFFR0tDQ05JT3dFQVFZd0lJMGsyQWdBalNnUkFRWkVJUVFFNkFBQUZRWkVJUVFBNkFBQUxJMHNFUUVHU0NFRUJPZ0FBQlVHU0NFRUFPZ0FBQ3lOTUJFQkJrd2hCQVRvQUFBVkJrd2hCQURvQUFBc2pUUVJBUVpRSVFRRTZBQUFGUVpRSVFRQTZBQUFMQzZ3QkFFSElDU000T3dFQVFjb0pJenc3QVFBalRnUkFRY3dKUVFFNkFBQUZRY3dKUVFBNkFBQUxJMDhFUUVITkNVRUJPZ0FBQlVITkNVRUFPZ0FBQ3lOUUJFQkJ6Z2xCQVRvQUFBVkJ6Z2xCQURvQUFBc2pVUVJBUWM4SlFRRTZBQUFGUWM4SlFRQTZBQUFMSTFJRVFFSFFDVUVCT2dBQUJVSFFDVUVBT2dBQUN5TlRCRUJCMFFsQkFUb0FBQVZCMFFsQkFEb0FBQXNqT1FSQVFkSUpRUUU2QUFBRlFkSUpRUUE2QUFBTEMwc0FRZm9KSTRVQk5nSUFRZjRKSTRZQk5nSUFJNHNCQkVCQmdncEJBVG9BQUFWQmdncEJBRG9BQUFzampBRUVRRUdGQ2tFQk9nQUFCVUdGQ2tFQU9nQUFDMEdGL2dNamh3RVFCQXQ0QUNPYkFRUkFRZDRLUVFFNkFBQUZRZDRLUVFBNkFBQUxRZDhLSTV3Qk5nSUFRZU1LSTUwQk5nSUFRZWNLSTU0Qk5nSUFRZXdLSTU4Qk5nSUFRZkVLSTZBQk9nQUFRZklLSTZFQk9nQUFJNklCQkVCQjl3cEJBVG9BQUFWQjl3cEJBRG9BQUF0QitBb2pvd0UyQWdCQi9Rb2pwQUU3QVFBTFR3QWpwUUVFUUVHUUMwRUJPZ0FBQlVHUUMwRUFPZ0FBQzBHUkN5T21BVFlDQUVHVkN5T25BVFlDQUVHWkN5T29BVFlDQUVHZUN5T3BBVFlDQUVHakN5T3FBVG9BQUVHa0N5T3JBVG9BQUF0R0FDT3dBUVJBUWZRTFFRRTZBQUFGUWZRTFFRQTZBQUFMUWZVTEk3RUJOZ0lBUWZrTEk3SUJOZ0lBUWYwTEk3TUJOZ0lBUVlJTUk3UUJOZ0lBUVljTUk3VUJPd0VBQzZNQkFCQVZRYklJSTFVMkFnQkJ0Z2dqbUFFNkFBQkJ4UDRESTFZUUJDT1pBUVJBUWVRSVFRRTZBQUFGUWVRSVFRQTZBQUFMSTVvQkJFQkI1UWhCQVRvQUFBVkI1UWhCQURvQUFBc1FGaEFYUWF3S0kyYzJBZ0JCc0FvamFEb0FBRUd4Q2lOcE9nQUFFQmdRR1NPc0FRUkFRY0lMUVFFNkFBQUZRY0lMUVFBNkFBQUxRY01MSTYwQk5nSUFRY2NMSTY0Qk5nSUFRY3NMSTY4Qk93RUFFQnBCQUNRdEM2NEJBRUdBQ0MwQUFDUS9RWUVJTFFBQUpFQkJnZ2d0QUFBa1FVR0RDQzBBQUNSQ1FZUUlMUUFBSkVOQmhRZ3RBQUFrUkVHR0NDMEFBQ1JGUVljSUxRQUFKRVpCaUFndkFRQWtSMEdLQ0M4QkFDUklRWXdJS0FJQUpFa0NmMEVCUVpFSUxRQUFRUUJLRFFBYVFRQUxKRW9DZjBFQlFaSUlMUUFBUVFCS0RRQWFRUUFMSkVzQ2YwRUJRWk1JTFFBQVFRQktEUUFhUVFBTEpFd0NmMEVCUVpRSUxRQUFRUUJLRFFBYVFRQUxKRTBMWEFFQmYwRUFKRlZCQUNSV1FjVCtBMEVBRUFSQndmNERFQUZCZkhFaEFVRUFKSmdCUWNIK0F5QUJFQVFnQUFSQUFrQkJBQ0VBQTBBZ0FFR0FpUjFPRFFFZ0FFR0FrQVJxUWY4Qk9nQUFJQUJCQVdvaEFBd0FBQXNBQ3dzTGlBRUJBWDhqdGdFaEFTQUFRWUFCY1VFQVJ5UzJBU0FBUWNBQWNVRUFSeVMzQVNBQVFTQnhRUUJISkxnQklBQkJFSEZCQUVja3VRRWdBRUVJY1VFQVJ5UzZBU0FBUVFSeFFRQkhKTHNCSUFCQkFuRkJBRWNrdkFFZ0FFRUJjVUVBUnlTOUFTTzJBVVVnQVNBQkd3UkFRUUVRSFFzZ0FVVWlBQVIvSTdZQkJTQUFDd1JBUVFBUUhRc0xQZ0FDZjBFQlFlUUlMUUFBUVFCS0RRQWFRUUFMSkprQkFuOUJBVUhsQ0MwQUFFRUFTZzBBR2tFQUN5U2FBVUgvL3dNUUFSQU9RWS8rQXhBQkVBOExwUUVBUWNnSkx3RUFKRGhCeWdrdkFRQWtQQUovUVFGQnpBa3RBQUJCQUVvTkFCcEJBQXNrVGdKL1FRRkJ6UWt0QUFCQkFFb05BQnBCQUFza1R3Si9RUUZCemdrdEFBQkJBRW9OQUJwQkFBc2tVQUovUVFGQnp3a3RBQUJCQUVvTkFCcEJBQXNrVVFKL1FRRkIwQWt0QUFCQkFFb05BQnBCQUFza1VnSi9RUUZCMFFrdEFBQkJBRW9OQUJwQkFBc2tVd0ovUVFGQjBna3RBQUJCQUVvTkFCcEJBQXNrT1F0YkFFSDZDU2dDQUNTRkFVSCtDU2dDQUNTR0FRSi9RUUZCZ2dvdEFBQkJBRW9OQUJwQkFBc2tpd0VDZjBFQlFZVUtMUUFBUVFCS0RRQWFRUUFMSkl3QlFZWCtBeEFCSkljQlFZYitBeEFCSklnQlFZZitBeEFCSklvQkN3WUFRUUFrYWd0MkFBSi9RUUZCM2dvdEFBQkJBRW9OQUJwQkFBc2ttd0ZCM3dvb0FnQWtuQUZCNHdvb0FnQWtuUUZCNXdvb0FnQWtuZ0ZCN0Fvb0FnQWtud0ZCOFFvdEFBQWtvQUZCOGdvdEFBQWtvUUVDZjBFQlFmY0tMUUFBUVFCS0RRQWFRUUFMSktJQlFmZ0tLQUlBSktNQlFmMEtMd0VBSktRQkMwNEFBbjlCQVVHUUN5MEFBRUVBU2cwQUdrRUFDeVNsQVVHUkN5Z0NBQ1NtQVVHVkN5Z0NBQ1NuQVVHWkN5Z0NBQ1NvQVVHZUN5Z0NBQ1NwQVVHakN5MEFBQ1NxQVVHa0N5MEFBQ1NyQVF0RkFBSi9RUUZCOUFzdEFBQkJBRW9OQUJwQkFBc2tzQUZCOVFzb0FnQWtzUUZCK1Fzb0FnQWtzZ0ZCL1Fzb0FnQWtzd0ZCZ2d3b0FnQWt0QUZCaHd3dkFRQWt0UUVMMEFFQkFYOFFIRUd5Q0NnQ0FDUlZRYllJTFFBQUpKZ0JRY1QrQXhBQkpGWkJ3UDRERUFFUUhoQWZRWUQrQXhBQlFmOEJjeVMrQVNPK0FTSUFRUkJ4UVFCSEpMOEJJQUJCSUhGQkFFY2t3QUVRSUJBaFFhd0tLQUlBSkdkQnNBb3RBQUFrYUVHeENpMEFBQ1JwUVFBa2FoQWpFQ1FDZjBFQlFjSUxMUUFBUVFCS0RRQWFRUUFMSkt3QlFjTUxLQUlBSkswQlFjY0xLQUlBSks0QlFjc0xMd0VBSks4QkVDVkJBQ1F0UVlDbzFya0hKSklCUVFBa2t3RkJBQ1NVQVVHQXFOYTVCeVNWQVVFQUpKWUJRUUFrbHdFTERBQWpPZ1JBUVFFUEMwRUFDd1VBSTVVQkN3VUFJNVlCQ3dVQUk1Y0JDOWdDQVFWL0FuOENmeUFCUVFCS0lnVUVRQ0FBUVFoS0lRVUxJQVVMQkVBandnRWdCRVloQlFzZ0JRc0VmeVBEQVNBQVJnVWdCUXNFUUVFQUlRVkJBQ0VFSUFOQkFXc1FBVUVnY1FSQVFRRWhCUXNnQXhBQlFTQnhCRUJCQVNFRUMwRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQVFnQlVjYklnTWdBR3BCb0FGTUJFQWdBRUVJSUFOcmF5RUhJQUFnQTJvZ0FVR2dBV3hxUVFOc1FZREpCV29oQ1VFQUlRWURRQ0FHUVFOSUJFQWdBQ0FEYWlBQlFhQUJiR3BCQTJ4QmdNa0ZhaUFHYWlBR0lBbHFMUUFBT2dBQUlBWkJBV29oQmd3QkN3c2dBQ0FEYWlBQlFhQUJiR3BCZ0pFRWFpQUJRYUFCYkNBSGFrR0FrUVJxTFFBQUlnWkJBM0VpQjBFRWNpQUhJQVpCQkhFYk9nQUFJQWhCQVdvaENBc2dBMEVCYWlFRERBRUxDd1VnQkNUQ0FRc2dBQ1BEQVU0RVFDQUFRUWhxSk1NQklBQWdBa0VJYnlJRVNBUkFJOE1CSUFScUpNTUJDd3NnQ0FzNEFRRi9JQUJCZ0pBQ1JnUkFJQUZCZ0FGcUlRSWdBVUdBQVhFRVFDQUJRWUFCYXlFQ0N5QUNRUVIwSUFCcUR3c2dBVUVFZENBQWFndEtBQ0FBUVFOMElBRkJBWFJxSWdCQkFXcEJQM0VpQVVGQWF5QUJJQUliUVlDUUJHb3RBQUFoQVNBQVFUOXhJZ0JCUUdzZ0FDQUNHMEdBa0FScUxRQUFJQUZCL3dGeFFRaDBjZ3RSQUNBQ1JRUkFJQUVRQVNBQVFRRjBkVUVEY1NFQUMwSHlBU0VCQWtBZ0FFVU5BQUpBQWtBQ1FBSkFJQUJCQVdzT0F3RUNBd0FMREFNTFFhQUJJUUVNQWd0QjJBQWhBUXdCQzBFSUlRRUxJQUVMaXdNQkJuOGdBU0FBRUN3Z0JVRUJkR29pQUVHQWtINXFJQUpCQVhGQkRYUWlBV290QUFBaEVTQUFRWUdRZm1vZ0FXb3RBQUFoRWlBRElRQURRQ0FBSUFSTUJFQWdBQ0FEYXlBR2FpSU9JQWhJQkVCQkJ5QUFheUVGSUF0QkFFZ2lBZ1IvSUFJRklBdEJJSEZGQ3lFQlFRQWhBZ0ovUVFFZ0JTQUFJQUViSWdGMElCSnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBWFFnRVhFYklRSWpPZ1IvSUF0QkFFNGlBUVIvSUFFRklBeEJBRTRMQlNNNkN3Ui9JQXRCQjNFaEJTQU1RUUJPSWdFRVFDQU1RUWR4SVFVTElBVWdBaUFCRUMwaUJVRWZjVUVEZENFUElBVkI0QWR4UVFWMVFRTjBJUUVnQlVHQStBRnhRUXAxUVFOMEJTQUNRY2YrQXlBS0lBcEJBRXdiSWdwQkFCQXVJZ1VoRHlBRklnRUxJUVVnQnlBSWJDQU9ha0VEYkNBSmFpSVFJQTg2QUFBZ0VFRUJhaUFCT2dBQUlCQkJBbW9nQlRvQUFDQUhRYUFCYkNBT2FrR0FrUVJxSUFKQkEzRWlBVUVFY2lBQklBdEJnQUZ4UVFCSFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzRBQkFRTi9JQU5CQ0c4aEF5QUFSUVJBSUFJZ0FrRUliVUVEZEdzaEJ3dEJvQUVnQUd0QkJ5QUFRUWhxUWFBQlNoc2hDVUYvSVFJak9nUkFJQVJCZ05CK2FpMEFBQ0lDUVFoeEJFQkJBU0VJQ3lBQ1FjQUFjUVJBUVFjZ0Eyc2hBd3NMSUFZZ0JTQUlJQWNnQ1NBRElBQWdBVUdnQVVHQXlRVkJBQ0FDUVg4UUx3dW1BZ0FnQlNBR0VDd2hCaUFEUVFodklRTWdCRUdBMEg1cUxRQUFJZ1JCd0FCeEJIOUJCeUFEYXdVZ0F3dEJBWFFnQm1vaUEwR0FrSDVxUVFGQkFDQUVRUWh4RzBFQmNVRU5kQ0lGYWkwQUFDRUdJQU5CZ1pCK2FpQUZhaTBBQUNFRklBSkJDRzhoQTBFQUlRSWdBVUdnQVd3Z0FHcEJBMnhCZ01rRmFpQUVRUWR4QW45QkFTQURRUWNnQTJzZ0JFRWdjUnNpQTNRZ0JYRUVRRUVDSVFJTElBSkJBV29MSUFKQkFTQURkQ0FHY1JzaUFrRUFFQzBpQTBFZmNVRURkRG9BQUNBQlFhQUJiQ0FBYWtFRGJFR0J5UVZxSUFOQjRBZHhRUVYxUVFOME9nQUFJQUZCb0FGc0lBQnFRUU5zUVlMSkJXb2dBMEdBK0FGeFFRcDFRUU4wT2dBQUlBRkJvQUZzSUFCcVFZQ1JCR29nQWtFRGNTSUFRUVJ5SUFBZ0JFR0FBWEViT2dBQUM3VUJBQ0FFSUFVUUxDQURRUWh2UVFGMGFpSUVRWUNRZm1vdEFBQWhCVUVBSVFNZ0FVR2dBV3dnQUdwQkEyeEJnTWtGYWdKL0lBUkJnWkIrYWkwQUFFRUJRUWNnQWtFSWIyc2lBblJ4QkVCQkFpRURDeUFEUVFGcUN5QURRUUVnQW5RZ0JYRWJJZ05CeC80RFFRQVFMaUlDT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUhKQldvZ0Fqb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQUk2QUFBZ0FVR2dBV3dnQUdwQmdKRUVhaUFEUVFOeE9nQUFDOVVCQVFaL0lBTkJBM1VoQ3dOQUlBUkJvQUZJQkVBZ0JDQUZhaUlHUVlBQ1RnUkFJQVpCZ0FKcklRWUxJQXRCQlhRZ0Ftb2dCa0VEZFdvaUNVR0FrSDVxTFFBQUlRaEJBQ0VLSXpZRVFDQUVJQUFnQmlBSklBZ1FLeUlIUVFCS0JFQkJBU0VLSUFkQkFXc2dCR29oQkFzTElBcEZJelVpQnlBSEd3UkFJQVFnQUNBR0lBTWdDU0FCSUFnUU1DSUhRUUJLQkVBZ0IwRUJheUFFYWlFRUN3VWdDa1VFUUNNNkJFQWdCQ0FBSUFZZ0F5QUpJQUVnQ0JBeEJTQUVJQUFnQmlBRElBRWdDQkF5Q3dzTElBUkJBV29oQkF3QkN3c0xLd0VCZnlOWElRTWdBQ0FCSUFJaldDQUFhaUlBUVlBQ1RnUi9JQUJCZ0FKckJTQUFDMEVBSUFNUU13c3dBUU4vSTFraEF5QUFJMW9pQkVnRVFBOExJQU5CQjJzaUEwRi9iQ0VGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRE1MeEFVQkQzOENRRUVuSVFrRFFDQUpRUUJJRFFFZ0NVRUNkQ0lFUVlEOEEyb1FBU0VDSUFSQmdmd0RhaEFCSVFvZ0JFR0MvQU5xRUFFaEF5QUNRUkJySVFJZ0NrRUlheUVLUVFnaEJTQUJCRUJCRUNFRklBTkJBbTlCQVVZRWZ5QURRUUZyQlNBREN5RURDeUFBSUFKT0lnWUVRQ0FBSUFJZ0JXcElJUVlMSUFZRVFDQUVRWVA4QTJvUUFTSUdRWUFCY1VFQVJ5RUxJQVpCSUhGQkFFY2hEa0dBZ0FJZ0F4QXNJQUFnQW1zaUFpQUZhMEYvYkVFQmF5QUNJQVpCd0FCeEcwRUJkR29pQTBHQWtINXFRUUZCQUNBR1FRaHhRUUJISXpvaUFpQUNHeHRCQVhGQkRYUWlBbW90QUFBaER5QURRWUdRZm1vZ0Ftb3RBQUFoRUVFSElRVURRQ0FGUVFCT0JFQkJBQ0VJQW45QkFTQUZJZ0pCQjJ0QmYyd2dBaUFPR3lJQ2RDQVFjUVJBUVFJaENBc2dDRUVCYWdzZ0NFRUJJQUowSUE5eEd5SUlCRUJCQnlBRmF5QUthaUlIUVFCT0lnSUVRQ0FIUWFBQlRDRUNDeUFDQkVCQkFDRU1RUUFoRFVFQlFRQWp2UUZGSXpvaUF5QURHeHNpQWtVRVFDQUFRYUFCYkNBSGFrR0FrUVJxTFFBQUlnTkJBM0VpQkVFQVNpQUxJQXNiQkVCQkFTRU1CU0FEUVFSeFFRQkhJem9pQXlBREd5SURCRUFnQkVFQVNpRURDMEVCUVFBZ0F4c2hEUXNMSUFKRkJFQWdERVVpQkFSL0lBMUZCU0FFQ3lFQ0N5QUNCRUFqT2dSQUlBQkJvQUZzSUFkcVFRTnNRWURKQldvZ0JrRUhjU0FJUVFFUUxTSUVRUjl4UVFOME9nQUFJQUJCb0FGc0lBZHFRUU5zUVlISkJXb2dCRUhnQjNGQkJYVkJBM1E2QUFBZ0FFR2dBV3dnQjJwQkEyeEJnc2tGYWlBRVFZRDRBWEZCQ25WQkEzUTZBQUFGSUFCQm9BRnNJQWRxUVFOc1FZREpCV29nQ0VISi9nTkJ5UDRESUFaQkVIRWJRUUFRTGlJRE9nQUFJQUJCb0FGc0lBZHFRUU5zUVlISkJXb2dBem9BQUNBQVFhQUJiQ0FIYWtFRGJFR0N5UVZxSUFNNkFBQUxDd3NMSUFWQkFXc2hCUXdCQ3dzTElBbEJBV3NoQ1F3QUFBc0FDd3RtQVFKL1FZQ1FBaUVCUVlDQUFrR0FrQUlqdVFFYklRRWpPaU85QVNNNkd3UkFRWUN3QWlFQ0lBQWdBVUdBdUFKQmdMQUNJN29CR3hBMEN5TzRBUVJBUVlDd0FpRUNJQUFnQVVHQXVBSkJnTEFDSTdjQkd4QTFDeU84QVFSQUlBQWp1d0VRTmdzTEpRRUJmd0pBQTBBZ0FFR1FBVXNOQVNBQVFmOEJjUkEzSUFCQkFXb2hBQXdBQUFzQUN3dEdBUUovQTBBZ0FVR1FBVTVGQkVCQkFDRUFBMEFnQUVHZ0FVZ0VRQ0FCUWFBQmJDQUFha0dBa1FScVFRQTZBQUFnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTEN4MEJBWDlCai80REVBRkJBU0FBZEhJaUFTU0VBVUdQL2dNZ0FSQUVDd3NBUVFFa2dBRkJBUkE2QzBVQkFuOUJsUDRERUFGQitBRnhJUUZCay80RElBQkIvd0Z4SWdJUUJFR1UvZ01nQVNBQVFRaDFJZ0J5RUFRZ0FpVFBBU0FBSk5BQkk4OEJJOUFCUVFoMGNpVFJBUXRtQVFKL0k2UUJJZ0VqelFGMUlRQWdBU0FBYXlBQUlBRnFJODRCR3lJQVFmOFBUQ0lCQkg4anpRRkJBRW9GSUFFTEJFQWdBQ1NrQVNBQUVEd2pwQUVpQVNQTkFYVWhBQ0FCSUFCcklBQWdBV29qemdFYklRQUxJQUJCL3c5S0JFQkJBQ1NiQVFzTExBQWpvd0ZCQVdza293RWpvd0ZCQUV3RVFDUE1BU1NqQVNQTUFVRUFTaU9pQVNPaUFSc0VRQkE5Q3dzTFd3RUJmeU9kQVVFQmF5U2RBU09kQVVFQVRBUkFJOUlCSkowQkk1MEJCRUFqbndGQkQwZ2owd0VqMHdFYkJFQWpud0ZCQVdva253RUZJOU1CUlNJQUJFQWpud0ZCQUVvaEFBc2dBQVJBSTU4QlFRRnJKSjhCQ3dzTEN3dGJBUUYvSTZjQlFRRnJKS2NCSTZjQlFRQk1CRUFqMUFFa3B3RWpwd0VFUUNPcEFVRVBTQ1BWQVNQVkFSc0VRQ09wQVVFQmFpU3BBUVVqMVFGRklnQUVRQ09wQVVFQVNpRUFDeUFBQkVBanFRRkJBV3NrcVFFTEN3c0xDMXNCQVg4anNnRkJBV3Nrc2dFanNnRkJBRXdFUUNQV0FTU3lBU095QVFSQUk3UUJRUTlJSTljQkk5Y0JHd1JBSTdRQlFRRnFKTFFCQlNQWEFVVWlBQVJBSTdRQlFRQktJUUFMSUFBRVFDTzBBVUVCYXlTMEFRc0xDd3NMamdZQUkyY2dBR29rWnlObkl6NEVmMEdBZ0FFRlFZREFBQXRPQkVBalp5TStCSDlCZ0lBQkJVR0F3QUFMYXlSbkFrQUNRQUpBQWtBQ1FDTnBJZ0FFUUNBQVFRSnJEZ1lCQlFJRkF3UUZDeU9lQVVFQVNpSUFCSDhqeUFFRklBQUxCRUFqbmdGQkFXc2tuZ0VMSTU0QlJRUkFRUUFrbXdFTEk2Z0JRUUJLSWdBRWZ5UEpBUVVnQUFzRVFDT29BVUVCYXlTb0FRc2pxQUZGQkVCQkFDU2xBUXNqcmdGQkFFb2lBQVIvSThvQkJTQUFDd1JBSTY0QlFRRnJKSzRCQ3lPdUFVVUVRRUVBSkt3QkN5T3pBVUVBU2lJQUJIOGp5d0VGSUFBTEJFQWpzd0ZCQVdza3N3RUxJN01CUlFSQVFRQWtzQUVMREFRTEk1NEJRUUJLSWdBRWZ5UElBUVVnQUFzRVFDT2VBVUVCYXlTZUFRc2puZ0ZGQkVCQkFDU2JBUXNqcUFGQkFFb2lBQVIvSThrQkJTQUFDd1JBSTZnQlFRRnJKS2dCQ3lPb0FVVUVRRUVBSktVQkN5T3VBVUVBU2lJQUJIOGp5Z0VGSUFBTEJFQWpyZ0ZCQVdza3JnRUxJNjRCUlFSQVFRQWtyQUVMSTdNQlFRQktJZ0FFZnlQTEFRVWdBQXNFUUNPekFVRUJheVN6QVFzanN3RkZCRUJCQUNTd0FRc1FQZ3dEQ3lPZUFVRUFTaUlBQkg4anlBRUZJQUFMQkVBam5nRkJBV3NrbmdFTEk1NEJSUVJBUVFBa213RUxJNmdCUVFCS0lnQUVmeVBKQVFVZ0FBc0VRQ09vQVVFQmF5U29BUXNqcUFGRkJFQkJBQ1NsQVFzanJnRkJBRW9pQUFSL0k4b0JCU0FBQ3dSQUk2NEJRUUZySks0QkN5T3VBVVVFUUVFQUpLd0JDeU96QVVFQVNpSUFCSDhqeXdFRklBQUxCRUFqc3dGQkFXc2tzd0VMSTdNQlJRUkFRUUFrc0FFTERBSUxJNTRCUVFCS0lnQUVmeVBJQVFVZ0FBc0VRQ09lQVVFQmF5U2VBUXNqbmdGRkJFQkJBQ1NiQVFzanFBRkJBRW9pQUFSL0k4a0JCU0FBQ3dSQUk2Z0JRUUZySktnQkN5T29BVVVFUUVFQUpLVUJDeU91QVVFQVNpSUFCSDhqeWdFRklBQUxCRUFqcmdGQkFXc2tyZ0VMSTY0QlJRUkFRUUFrckFFTEk3TUJRUUJLSWdBRWZ5UExBUVVnQUFzRVFDT3pBVUVCYXlTekFRc2pzd0ZGQkVCQkFDU3dBUXNRUGd3QkN4QS9FRUFRUVFzamFVRUJhaVJwSTJsQkNFNEVRRUVBSkdrTFFRRVBDMEVBQzRNQkFRRi9Ba0FDUUFKQUFrQWdBRUVCUndSQUlBQWlBVUVDUmcwQklBRkJBMFlOQWlBQlFRUkdEUU1NQkFzamNDUFpBVWNFUUNQWkFTUndRUUVQQzBFQUR3c2pjU1BhQVVjRVFDUGFBU1J4UVFFUEMwRUFEd3NqY2lQYkFVY0VRQ1BiQVNSeVFRRVBDMEVBRHdzamN5UGNBVWNFUUNQY0FTUnpRUUVQQzBFQUR3dEJBQXRWQUFKQUFrQUNRQ0FBUVFGSEJFQWdBRUVDUmcwQklBQkJBMFlOQWd3REMwRUJJQUYwUVlFQmNVRUFSdzhMUVFFZ0FYUkJod0Z4UVFCSER3dEJBU0FCZEVIK0FIRkJBRWNQQzBFQklBRjBRUUZ4UVFCSEM0b0JBUUYvSTV3QklBQnJKSndCSTV3QlFRQk1CRUFqbkFFaUFVRWZkU0VBUVlBUUk5RUJhMEVDZENTY0FTTStCRUFqbkFGQkFYUWtuQUVMSTV3QklBQWdBV29nQUhOckpKd0JJNkVCUVFGcUpLRUJJNkVCUVFoT0JFQkJBQ1NoQVFzTEk5a0JJNXNCSWdBZ0FCc0VmeU9mQVFWQkR3OExJK0FCSTZFQkVFUUVmMEVCQlVGL0MyeEJEMm9MaWdFQkFYOGpwZ0VnQUdza3BnRWpwZ0ZCQUV3RVFDT21BU0lCUVI5MUlRQkJnQkFqNFFGclFRSjBKS1lCSXo0RVFDT21BVUVCZENTbUFRc2pwZ0VnQUNBQmFpQUFjMnNrcGdFanF3RkJBV29rcXdFanF3RkJDRTRFUUVFQUpLc0JDd3NqMmdFanBRRWlBQ0FBR3dSL0k2a0JCVUVQRHdzajRnRWpxd0VRUkFSL1FRRUZRWDhMYkVFUGFndVpBZ0VDZnlPdEFTQUFheVN0QVNPdEFVRUFUQVJBSTYwQklnSkJIM1VoQUVHQUVDUGpBV3RCQVhRa3JRRWpQZ1JBSTYwQlFRRjBKSzBCQ3lPdEFTQUFJQUpxSUFCemF5U3RBU092QVVFQmFpU3ZBU092QVVFZ1RnUkFRUUFrcndFTEMwRUFJUUlqNUFFaEFDUGJBU09zQVNJQklBRWJCRUFqYXdSQVFaeitBeEFCUVFWMVFROXhJZ0FrNUFGQkFDUnJDd1ZCRHc4TEk2OEJRUUp0UWJEK0Eyb1FBU0VCSTY4QlFRSnZCSDhnQVVFUGNRVWdBVUVFZFVFUGNRc2hBUUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVnQUVFQ1JnMENEQU1MSUFGQkJIVWhBUXdEQzBFQklRSU1BZ3NnQVVFQmRTRUJRUUloQWd3QkN5QUJRUUoxSVFGQkJDRUNDeUFDUVFCS0JIOGdBU0FDYlFWQkFBdEJEMm9McXdFQkFYOGpzUUVnQUdza3NRRWpzUUZCQUV3RVFDT3hBU0VBSStVQkkrWUJkQ0lCUVFGMElBRWpQaHNrc1FFanNRRWdBRUVmZFNJQklBQWdBV3B6YXlTeEFTTzFBU0lBUVFGeElRRWdBRUVCZFNJQUpMVUJJN1VCSUFFZ0FFRUJjWE1pQVVFT2RISWt0UUVqNXdFRVFDTzFBVUcvZjNFa3RRRWp0UUVnQVVFR2RISWt0UUVMQ3lQY0FTT3dBU0lBSUFBYkJIOGp0QUVGUVE4UEMwRi9RUUVqdFFGQkFYRWJiRUVQYWdzd0FDQUFRVHhHQkVCQi93QVBDeUFBUVR4clFhQ05CbXdnQVd4QkNHMUJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMExuQUVCQVg5QkFDUjJJQUJCRHlOZUd5SUVJQUZxSUFSQkQyb2pYeHNpQkNBQ2FpQUVRUTlxSTJBYklRUWdBeUFDSUFFZ0FFRVBJMkliSWdCcUlBQkJEMm9qWXhzaUFHb2dBRUVQYWlOa0d5SUFhaUFBUVE5cUkyVWJJUUJCQUNSM1FRQWtlQ0FESUFScUlBUkJEMm9qWVJzalhFRUJhaEJKSVFFZ0FDTmRRUUZxRUVraEFDQUJKSFFnQUNSMUlBQkIvd0Z4SUFGQi93RnhRUWgwY2d2REF3RUZmd0ovSTlnQklBQnFKTmdCUVFBam5BRWoyQUZyUVFCS0RRQWFRUUVMSWdGRkJFQkJBUkJESVFFTEFuOGozUUVnQUdvazNRRkJBQ09tQVNQZEFXdEJBRW9OQUJwQkFRc2lCRVVFUUVFQ0VFTWhCQXNDZnlQZUFTQUFhaVRlQVNPdEFTUGVBV3RCQUVvaUFnUkFJMnRGSVFJTFFRQWdBZzBBR2tFQkN5SUNSUVJBUVFNUVF5RUNDd0ovSTk4QklBQnFKTjhCUVFBanNRRWozd0ZyUVFCS0RRQWFRUUVMSWdWRkJFQkJCQkJESVFVTElBRUVRQ1BZQVNFRFFRQWsyQUVnQXhCRkpHd0xJQVFFUUNQZEFTRURRUUFrM1FFZ0F4QkdKRzBMSUFJRVFDUGVBU0VEUVFBazNnRWdBeEJISkc0TElBVUVRQ1BmQVNFRFFRQWszd0VnQXhCSUpHOExBbjhnQVNBRUlBRWJJZ0ZGQkVBZ0FpRUJDeUFCUlFzRVFDQUZJUUVMSUFFRVFFRUJKSGdMSTJnajZBRWdBR3hxSkdnamFFR0FnSUFFUVlDQWdBSWpQaHRPQkVBamFFR0FnSUFFUVlDQWdBSWpQaHRySkdnamVDSUFJM1lnQUJzaUFVVUVRQ04zSVFFTElBRUVRQ05zSTIwamJpTnZFRW9hQ3lOcUlnRkJBWFJCZ0puQkFHb2lBQ04wUVFKcU9nQUFJQUJCQVdvamRVRUNham9BQUNBQlFRRnFKR29qYWlQcEFVRUNiVUVCYTA0RVFDTnFRUUZySkdvTEN3dWNBd0VGZnlBQUVFVWhBaUFBRUVZaEFTQUFFRWNoQXlBQUVFZ2hCQ0FDSkd3Z0FTUnRJQU1rYmlBRUpHOGphQ1BvQVNBQWJHb2thQ05vUVlDQWdBUkJnSUNBQWlNK0cwNEVRQ05vUVlDQWdBUkJnSUNBQWlNK0cyc2thQ0FDSUFFZ0F5QUVFRW9oQUNOcVFRRjBRWUNad1FCcUlnVWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBVkJBV29nQUVIL0FYRkJBbW82QUFBak53UkFJQUpCRDBFUFFROFFTaUVBSTJwQkFYUkJnSmtoYWlJQ0lBQkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUJCL3dGeFFRSnFPZ0FBUVE4Z0FVRVBRUThRU2lFQUkycEJBWFJCZ0prcGFpSUJJQUJCZ1A0RGNVRUlkVUVDYWpvQUFDQUJRUUZxSUFCQi93RnhRUUpxT2dBQVFROUJEeUFEUVE4UVNpRUFJMnBCQVhSQmdKa3hhaUlCSUFCQmdQNERjVUVJZFVFQ2Fqb0FBQ0FCUVFGcUlBQkIvd0Z4UVFKcU9nQUFRUTlCRDBFUElBUVFTaUVBSTJwQkFYUkJnSms1YWlJQklBQkJnUDREY1VFSWRVRUNham9BQUNBQlFRRnFJQUJCL3dGeFFRSnFPZ0FBQ3lOcVFRRnFKR29qYWlQcEFVRUNiVUVCYTA0RVFDTnFRUUZySkdvTEN3c2VBUUYvSUFBUVFpRUJJQUZGSXpRak5Cc0VRQ0FBRUVzRklBQVFUQXNMU3dBald5TStCSDlCcmdFRlFkY0FDMGdFUUE4TEEwQWpXeU0rQkg5QnJnRUZRZGNBQzA0RVFDTStCSDlCcmdFRlFkY0FDeEJOSTFzalBnUi9RYTRCQlVIWEFBdHJKRnNNQVFzTEN5RUFJQUJCcHY0RFJnUkFRYWIrQXhBQlFZQUJjU0VBSUFCQjhBQnlEd3RCZnd1Y0FRRUJmeU8rQVNFQUk3OEJCRUFnQUVGN2NTQUFRUVJ5SStvQkd5RUFJQUJCZm5FZ0FFRUJjaVByQVJzaEFDQUFRWGR4SUFCQkNISWo3QUViSVFBZ0FFRjljU0FBUVFKeUkrMEJHeUVBQlNQQUFRUkFJQUJCZm5FZ0FFRUJjaVB1QVJzaEFDQUFRWDF4SUFCQkFuSWo3d0ViSVFBZ0FFRjdjU0FBUVFSeUkvQUJHeUVBSUFCQmQzRWdBRUVJY2lQeEFSc2hBQXNMSUFCQjhBRnlDODhDQVFGL0lBQkJnSUFDU0FSQVFYOFBDeUFBUVlDQUFrNGlBUVIvSUFCQmdNQUNTQVVnQVFzRVFFRi9Ed3NnQUVHQXdBTk9JZ0VFZnlBQVFZRDhBMGdGSUFFTEJFQWdBRUdBUUdvUUFROExJQUJCZ1B3RFRpSUJCSDhnQUVHZi9RTk1CU0FCQ3dSQUk1Z0JRUUpJQkVCQi93RVBDMEYvRHdzZ0FFSE4vZ05HQkVCQi93RWhBVUhOL2dNUUFVRUJjVVVFUUVIK0FTRUJDeU0rUlFSQUlBRkIvMzV4SVFFTElBRVBDeUFBUWNUK0EwWUVRQ0FBSTFZUUJDTldEd3NnQUVHUS9nTk9JZ0VFZnlBQVFhYitBMHdGSUFFTEJFQVFUaUFBRUU4UEN5QUFRYkQrQTA0aUFRUi9JQUJCdi80RFRBVWdBUXNFUUJCT1FYOFBDeUFBUVlUK0EwWUVRQ0FBSTRZQlFZRCtBM0ZCQ0hVaUFSQUVJQUVQQ3lBQVFZWCtBMFlFUUNBQUk0Y0JFQVFqaHdFUEN5QUFRWS8rQTBZRVFDT0VBVUhnQVhJUEN5QUFRWUQrQTBZRVFCQlFEd3RCZndzYkFRRi9JQUFRVVNJQlFYOUdCRUFnQUJBQkR3c2dBVUgvQVhFTHRnSUJBWDhqVUFSQUR3c2dBRUgvUDB3RVFDTlNCSDhnQVVFUWNVVUZJMUlMUlFSQUlBRkJEM0VpQWdSQUlBSkJDa1lFUUVFQkpFNExCVUVBSkU0TEN3VWdBRUgvL3dCTUJFQWpPVVVpQWdSL0lBSUZJQUJCLzk4QVRBc0VRQ05TQkVBZ0FVRVBjU1E0Q3lBQklRSWpVUVJBSUFKQkgzRWhBaU00UWVBQmNTUTRCU05UQkVBZ0FrSC9BSEVoQWlNNFFZQUJjU1E0QlNNNUJFQkJBQ1E0Q3dzTEl6Z2dBbklrT0FVak9FSC9BWEZCQVVFQUlBRkJBRW9iUWY4QmNVRUlkSElrT0FzRkkxSkZJZ0lFZnlBQVFmKy9BVXdGSUFJTEJFQWpUeU5SSWdBZ0FCc0VRQ000UVI5eEpEZ2pPQ0FCUWVBQmNYSWtPQThMSUFGQkQzRWdBVUVEY1NNNUd5UThCU05TUlNJQ0JIOGdBRUgvL3dGTUJTQUNDd1JBSTFFRVFDQUJRUUZ4QkVCQkFTUlBCVUVBSkU4TEN3c0xDd3NMTEFBZ0FFRUVkVUVQY1NUMkFTQUFRUWh4UVFCSEpOTUJJQUJCQjNFazBnRWdBRUg0QVhGQkFFb2syUUVMTEFBZ0FFRUVkVUVQY1NUM0FTQUFRUWh4UVFCSEpOVUJJQUJCQjNFazFBRWdBRUg0QVhGQkFFb2syZ0VMTEFBZ0FFRUVkVUVQY1NUNUFTQUFRUWh4UVFCSEpOY0JJQUJCQjNFazFnRWdBRUg0QVhGQkFFb2szQUVMZ1FFQkFYOGdBRUVFZFNUbUFTQUFRUWh4UVFCSEpPY0JJQUJCQjNFay9nRUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUkvNEJJZ0VFUUNBQlFRRnJEZ2NCQWdNRUJRWUhDQXRCQ0NUbEFROExRUkFrNVFFUEMwRWdKT1VCRHd0Qk1DVGxBUThMUWNBQUpPVUJEd3RCMEFBazVRRVBDMEhnQUNUbEFROExRZkFBSk9VQkN3dURBUUVCZjBFQkpKc0JJNTRCUlFSQVFjQUFKSjRCQzBHQUVDUFJBV3RCQW5Ra25BRWpQZ1JBSTV3QlFRRjBKSndCQ3lQU0FTU2RBU1AyQVNTZkFTUFJBU1NrQVNQTUFTSUFKS01CSUFCQkFFb2lBQVIvSTgwQlFRQktCU0FBQ3dSQVFRRWtvZ0VGUVFBa29nRUxJODBCUVFCS0JFQVFQUXNqMlFGRkJFQkJBQ1NiQVFzTFJ3QkJBU1NsQVNPb0FVVUVRRUhBQUNTb0FRdEJnQkFqNFFGclFRSjBKS1lCSXo0RVFDT21BVUVCZENTbUFRc2oxQUVrcHdFajl3RWtxUUVqMmdGRkJFQkJBQ1NsQVFzTFFBQkJBU1NzQVNPdUFVVUVRRUdBQWlTdUFRdEJnQkFqNHdGclFRRjBKSzBCSXo0RVFDT3RBVUVCZENTdEFRdEJBQ1N2QVNQYkFVVUVRRUVBSkt3QkN3dEpBUUYvUVFFa3NBRWpzd0ZGQkVCQndBQWtzd0VMSStVQkkrWUJkQ0lBUVFGMElBQWpQaHNrc1FFajFnRWtzZ0VqK1FFa3RBRkIvLzhCSkxVQkk5d0JSUVJBUVFBa3NBRUxDMVFBSUFCQmdBRnhRUUJISkdFZ0FFSEFBSEZCQUVja1lDQUFRU0J4UVFCSEpGOGdBRUVRY1VFQVJ5UmVJQUJCQ0hGQkFFY2taU0FBUVFSeFFRQkhKR1FnQUVFQ2NVRUFSeVJqSUFCQkFYRkJBRWNrWWd1SUJRRUJmeUFBUWFiK0EwY2lBZ1JBSTJaRklRSUxJQUlFUUVFQUR3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0pCa1A0RFJ3UkFJQUpCa2Y0RGF3NFdBZ1lLRGhVREJ3c1BBUVFJREJBVkJRa05FUklURkJVTElBRkI4QUJ4UVFSMUpNd0JJQUZCQ0hGQkFFY2t6Z0VnQVVFSGNTVE5BUXdWQ3lBQlFZQUJjVUVBUnlUYkFRd1VDeUFCUVFaMVFRTnhKT0FCSUFGQlAzRWs4Z0ZCd0FBajhnRnJKSjRCREJNTElBRkJCblZCQTNFazRnRWdBVUUvY1NUekFVSEFBQ1B6QVdza3FBRU1FZ3NnQVNUMEFVR0FBaVAwQVdza3JnRU1FUXNnQVVFL2NTVDFBVUhBQUNQMUFXc2tzd0VNRUFzZ0FSQlVEQThMSUFFUVZRd09DMEVCSkdzZ0FVRUZkVUVQY1NUNEFRd05DeUFCRUZZTURBc2dBU1RQQVNQUEFTUFFBVUVJZEhJazBRRU1Dd3NnQVNUNkFTUDZBU1A3QVVFSWRISWs0UUVNQ2dzZ0FTVDhBU1A4QVNQOUFVRUlkSElrNHdFTUNRc2dBUkJYREFnTElBRkJnQUZ4QkVBZ0FVSEFBSEZCQUVja3lBRWdBVUVIY1NUUUFTUFBBU1BRQVVFSWRISWswUUVRV0FzTUJ3c2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5VEpBU0FCUVFkeEpQc0JJL29CSS9zQlFRaDBjaVRoQVJCWkN3d0dDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKTW9CSUFGQkIzRWsvUUVqL0FFai9RRkJDSFJ5Sk9NQkVGb0xEQVVMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNreXdFUVd3c01CQXNnQVVFRWRVRUhjU1JjSUFGQkIzRWtYVUVCSkhZTUF3c2dBUkJjUVFFa2R3d0NDeUFCUVlBQmNVRUFSeVJtSUFGQmdBRnhSUVJBQWtCQmtQNERJUUlEUUNBQ1FhYitBMDROQVNBQ1FRQVFCQ0FDUVFGcUlRSU1BQUFMQUFzTERBRUxRUUVQQzBFQkN6d0JBWDhnQUVFSWRDRUJRUUFoQUFOQUFrQWdBRUdmQVVvTkFDQUFRWUQ4QTJvZ0FDQUJhaEFCRUFRZ0FFRUJhaUVBREFFTEMwR0VCU1RCQVFzakFRRi9JNEVDRUFFaEFDT0NBaEFCUWY4QmNTQUFRZjhCY1VFSWRISkI4UDhEY1FzbkFRRi9JNE1DRUFFaEFDT0VBaEFCUWY4QmNTQUFRZjhCY1VFSWRISkI4RDl4UVlDQUFtb0xnd0VCQTM4ak9rVUVRQThMSUFCQmdBRnhSU1BFQVNQRUFSc0VRRUVBSk1RQkk0QUNFQUZCZ0FGeUlRQWpnQUlnQUJBRUR3c1FYeUVCRUdBaEFpQUFRZjkrY1VFQmFrRUVkQ0VESUFCQmdBRnhCRUJCQVNURUFTQURKTVVCSUFFa3hnRWdBaVRIQVNPQUFpQUFRZjkrY1JBRUJTQUJJQUlnQXhCckk0QUNRZjhCRUFRTEMySUJBMzhqaHdJZ0FFWWlBa1VFUUNPR0FpQUFSaUVDQ3lBQ0JFQWdBRUVCYXlJREVBRkJ2Mzl4SWdKQlAzRWlCRUZBYXlBRVFRRkJBQ09HQWlBQVJoc2JRWUNRQkdvZ0FUb0FBQ0FDUVlBQmNRUkFJQU1nQWtFQmFrR0FBWElRQkFzTEN6d0JBWDhDUUFKQUFrQUNRQ0FBQkVBZ0FDSUJRUUZHRFFFZ0FVRUNSZzBDSUFGQkEwWU5Bd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzdEFRRi9RUUVqaWdFUVl5SUNkQ0FBY1VFQVJ5SUFCSDlCQVNBQ2RDQUJjVVVGSUFBTEJFQkJBUThMUVFBTGtRRUJBbjhEUUNBQklBQklCRUFnQVVFRWFpRUJJNFlCSWdKQkJHb2toZ0VqaGdGQi8vOERTZ1JBSTRZQlFZQ0FCR3NraGdFTEk0a0JCRUFqaXdFRVFDT0lBU1NIQVVFQkpJRUJRUUlRT2tFQUpJc0JRUUVrakFFRkk0d0JCRUJCQUNTTUFRc0xJQUlqaGdFUVpBUkFJNGNCUVFGcUpJY0JJNGNCUWY4QlNnUkFRUUVraXdGQkFDU0hBUXNMQ3d3QkN3c0xEQUFqaFFFUVpVRUFKSVVCQzBjQkFYOGpoZ0VoQUVFQUpJWUJRWVQrQTBFQUVBUWppUUVFZnlBQUk0WUJFR1FGSTRrQkN3UkFJNGNCUVFGcUpJY0JJNGNCUWY4QlNnUkFRUUVraXdGQkFDU0hBUXNMQzRBQkFRSi9JNGtCSVFFZ0FFRUVjVUVBUnlTSkFTQUFRUU54SVFJZ0FVVUVRQ09LQVJCaklRQWdBaEJqSVFFamlRRUVmeU9HQVVFQklBQjBjUVVqaGdGQkFTQUFkSEZCQUVjaUFBUi9JNFlCUVFFZ0FYUnhCU0FBQ3dzRVFDT0hBVUVCYWlTSEFTT0hBVUgvQVVvRVFFRUJKSXNCUVFBa2h3RUxDd3NnQWlTS0FRdlNCZ0VCZndKQUFrQWdBRUhOL2dOR0JFQkJ6ZjRESUFGQkFYRVFCQXdCQ3lBQVFZQ0FBa2dFUUNBQUlBRVFVd3dCQ3lBQVFZQ0FBazRpQWdSQUlBQkJnTUFDU0NFQ0N5QUNEUUVnQUVHQXdBTk9JZ0lFUUNBQVFZRDhBMGdoQWdzZ0FnUkFJQUJCZ0VCcUlBRVFCQXdDQ3lBQVFZRDhBMDRpQWdSQUlBQkJuLzBEVENFQ0N5QUNCRUFqbUFGQkFrZ05BUXdDQ3lBQVFhRDlBMDRpQWdSQUlBQkIvLzBEVENFQ0N5QUNEUUFnQUVHQy9nTkdCRUFnQVVFQmNVRUFSeVNQQVNBQlFRSnhRUUJISkpBQklBRkJnQUZ4UVFCSEpKRUJRUUVQQ3lBQVFaRCtBMDRpQWdSQUlBQkJwdjREVENFQ0N5QUNCRUFRVGlBQUlBRVFYUThMSUFCQnNQNERUaUlDQkVBZ0FFRy8vZ05NSVFJTElBSUVRQkJPQ3lBQVFjRCtBMDRpQWdSQUlBQkJ5LzREVENFQ0N5QUNCRUFnQUVIQS9nTkdCRUFnQVJBZURBTUxJQUJCd2Y0RFJnUkFRY0grQXlBQlFmZ0JjVUhCL2dNUUFVRUhjWEpCZ0FGeUVBUU1BZ3NnQUVIRS9nTkdCRUJCQUNSV0lBQkJBQkFFREFJTElBQkJ4ZjREUmdSQUlBRWsvd0VNQXdzZ0FFSEcvZ05HQkVBZ0FSQmVEQU1MQWtBQ1FBSkFBa0FnQUNJQ1FjUCtBMGNFUUNBQ1FjTCtBMnNPQ2dFRUJBUUVCQVFFQXdJRUN5QUJKRmNNQmdzZ0FTUllEQVVMSUFFa1dRd0VDeUFCSkZvTUF3c01BZ3NqZ0FJZ0FFWUVRQ0FCRUdFTUFRc2pQU0FBUmlJQ1JRUkFJenNnQUVZaEFnc2dBZ1JBSThRQkJFQUNmeVBHQVVHQWdBRk9JZ0lFUUNQR0FVSC8vd0ZNSVFJTElBSkZDd1JBSThZQlFZQ2dBMDRpQWdSQUk4WUJRZisvQTB3aEFnc0xJQUlOQWdzTElBQWpoUUpPSWdJRVFDQUFJNFlDVENFQ0N5QUNCRUFnQUNBQkVHSU1BZ3NnQUVHRS9nTk9JZ0lFUUNBQVFZZitBMHdoQWdzZ0FnUkFFR1lDUUFKQUFrQUNRQ0FBSWdKQmhQNERSd1JBSUFKQmhmNERhdzREQVFJREJBc1Fad3dGQ3dKQUk0a0JCRUFqakFFTkFTT0xBUVJBUVFBa2l3RUxDeUFCSkljQkN3d0ZDeUFCSklnQkk0d0JJNGtCSWdBZ0FCc0VRQ09JQVNTSEFVRUFKSXdCQ3d3RUN5QUJFR2dNQXdzTUFnc2dBRUdBL2dOR0JFQWdBVUgvQVhNa3ZnRWp2Z0VpQWtFUWNVRUFSeVMvQVNBQ1FTQnhRUUJISk1BQkN5QUFRWS8rQTBZRVFDQUJFQThNQWdzZ0FFSC8vd05HQkVBZ0FSQU9EQUlMUVFFUEMwRUFEd3RCQVFzUkFDQUFJQUVRYVFSQUlBQWdBUkFFQ3d0Z0FRTi9BMEFDUUNBRElBSk9EUUFnQUNBRGFoQlNJUVVnQVNBRGFpRUVBMEFnQkVIL3Z3SktCRUFnQkVHQVFHb2hCQXdCQ3dzZ0JDQUZFR29nQTBFQmFpRUREQUVMQzBFZ0lRTWp3UUVnQWtFUWJVSEFBRUVnSXo0YmJHb2t3UUVMWndFQmZ5UEVBVVVFUUE4TEk4WUJJOGNCSThVQklnQkJFQ0FBUVJCSUd5SUFFR3NqeGdFZ0FHb2t4Z0VqeHdFZ0FHb2t4d0VqeFFFZ0FHc2t4UUVqeFFGQkFFd0VRRUVBSk1RQkk0QUNRZjhCRUFRRkk0QUNJOFVCUVJCdFFRRnJRZjkrY1JBRUN3dEdBUUovSS84QklRTUNmeUFBUlNJQ1JRUkFJQUJCQVVZaEFnc2dBZ3NFZnlOV0lBTkdCU0FDQ3dSQUlBRkJCSElpQVVIQUFIRUVRQkE3Q3dVZ0FVRjdjU0VCQ3lBQkM0SUNBUU4vSTdZQlJRUkFEd3NqbUFFaEFDQUFJMVlpQWtHUUFVNEVmMEVCQlNOVkl6NEVmMEh3QlFWQitBSUxUZ1IvUVFJRlFRTkJBQ05WSXo0RWYwSHlBd1ZCK1FFTFRoc0xDeUlCUndSQVFjSCtBeEFCSVFBZ0FTU1lBVUVBSVFJQ1FBSkFBa0FDUUNBQkJFQWdBVUVCYXc0REFRSURCQXNnQUVGOGNTSUFRUWh4UVFCSElRSU1Bd3NnQUVGOWNVRUJjaUlBUVJCeFFRQkhJUUlNQWdzZ0FFRitjVUVDY2lJQVFTQnhRUUJISVFJTUFRc2dBRUVEY2lFQUN5QUNCRUFRT3dzZ0FVVUVRQkJzQ3lBQlFRRkdCRUJCQVNSL1FRQVFPZ3RCd2Y0RElBRWdBQkJ0RUFRRklBSkJtUUZHQkVCQndmNERJQUZCd2Y0REVBRVFiUkFFQ3dzTHRBRUFJN1lCQkVBalZTQUFhaVJWQTBBalZRSi9JejRFUUVFSUkxWkJtUUZHRFFFYVFaQUhEQUVMUVFRalZrR1pBVVlOQUJwQnlBTUxUZ1JBSTFVQ2Z5TStCRUJCQ0NOV1Faa0JSZzBCR2tHUUJ3d0JDMEVFSTFaQm1RRkdEUUFhUWNnREMyc2tWU05XSWdCQmtBRkdCRUFqTXdSQUVEZ0ZJQUFRTndzUU9VRi9KTUlCUVg4a3d3RUZJQUJCa0FGSUJFQWpNMFVFUUNBQUVEY0xDd3RCQUNBQVFRRnFJQUJCbVFGS0d5UldEQUVMQ3dzUWJndXpBUUFqVkFKL0l6NEVRRUVJSTFaQm1RRkdEUUVhUVpBSERBRUxRUVFqVmtHWkFVWU5BQnBCeUFNTFNBUkFEd3NEUUNOVUFuOGpQZ1JBUVFnalZrR1pBVVlOQVJwQmtBY01BUXRCQkNOV1Faa0JSZzBBR2tISUF3dE9CRUFDZnlNK0JFQkJDQ05XUVprQlJnMEJHa0dRQnd3QkMwRUVJMVpCbVFGR0RRQWFRY2dEQ3hCdkkxUUNmeU0rQkVCQkNDTldRWmtCUmcwQkdrR1FCd3dCQzBFRUkxWkJtUUZHRFFBYVFjZ0RDMnNrVkF3QkN3c0xNd0VCZjBFQkk1QUJCSDlCQWdWQkJ3c2lBblFnQUhGQkFFY2lBQVIvUVFFZ0FuUWdBWEZGQlNBQUN3UkFRUUVQQzBFQUM1WUJBUUovSTVFQlJRUkFEd3NEUUNBQklBQklCRUFnQVVFRWFpRUJJNDBCSWdKQkJHb2tqUUVqalFGQi8vOERTZ1JBSTQwQlFZQ0FCR3NralFFTElBSWpqUUVRY1FSQVFZSCtBMEdCL2dNUUFVRUJkRUVCYWtIL0FYRVFCQ09PQVVFQmFpU09BU09PQVVFSVJnUkFRUUFramdGQkFTU0NBVUVERURwQmd2NERRWUwrQXhBQlFmOStjUkFFUVFBa2tRRUxDd3dCQ3dzTGlBRUFJOEVCUVFCS0JFQWp3UUVnQUdvaEFFRUFKTUVCQ3lOSklBQnFKRWtqVFVVRVFDTXhCRUFqVkNBQWFpUlVFSEFGSUFBUWJ3c2pNQVJBSTFzZ0FHb2tXd1VnQUJCTkN5QUFFSElMSXpJRVFDT0ZBU0FBYWlTRkFSQm1CU0FBRUdVTEk1UUJJQUJxSkpRQkk1UUJJNUlCVGdSQUk1TUJRUUZxSkpNQkk1UUJJNUlCYXlTVUFRc0xDZ0JCQkJCekkwZ1FBUXNtQVFGL1FRUVFjeU5JUVFGcVFmLy9BM0VRQVNFQUVIUkIvd0Z4SUFCQi93RnhRUWgwY2dzTUFFRUVFSE1nQUNBQkVHb0xNQUVCZjBFQklBQjBRZjhCY1NFQ0lBRkJBRW9FUUNOR0lBSnlRZjhCY1NSR0JTTkdJQUpCL3dGemNTUkdDeU5HQ3drQVFRVWdBQkIzR2d0SkFRRi9JQUZCQUU0RVFDQUFRUTl4SUFGQkQzRnFRUkJ4QkVCQkFSQjRCVUVBRUhnTEJTQUJRUjkxSWdJZ0FTQUNhbk5CRDNFZ0FFRVBjVXNFUUVFQkVIZ0ZRUUFRZUFzTEN3a0FRUWNnQUJCM0dnc0pBRUVHSUFBUWR4b0xDUUJCQkNBQUVIY2FDenNCQW44Z0FVR0EvZ054UVFoMUlRSWdBRUVCYWlFRElBQWdBVUgvQVhFaUFSQnBCRUFnQUNBQkVBUUxJQU1nQWhCcEJFQWdBeUFDRUFRTEN3d0FRUWdRY3lBQUlBRVFmUXQxQUNBQ0JFQWdBU0FBUWYvL0EzRWlBR29nQUNBQmMzTWlBa0VRY1FSQVFRRVFlQVZCQUJCNEN5QUNRWUFDY1FSQVFRRVFmQVZCQUJCOEN3VWdBQ0FCYWtILy93TnhJZ0lnQUVILy93TnhTUVJBUVFFUWZBVkJBQkI4Q3lBQUlBRnpJQUp6UVlBZ2NRUkFRUUVRZUFWQkFCQjRDd3NMQ2dCQkJCQnpJQUFRVWd1UkJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc01Fd3NRZFVILy93TnhJZ0JCZ1A0RGNVRUlkU1JBSUFCQi93RnhKRUVNRHdzalFVSC9BWEVqUUVIL0FYRkJDSFJ5SXo4UWRnd1JDeU5CUWY4QmNTTkFRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtRQXdSQ3lOQVFRRVFlU05BUVFGcVFmOEJjU1JBSTBBRVFFRUFFSG9GUVFFUWVndEJBQkI3REE4TEkwQkJmeEI1STBCQkFXdEIvd0Z4SkVBalFBUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURnc1FkRUgvQVhFa1FBd0xDeU0vUVlBQmNVR0FBVVlFUUVFQkVId0ZRUUFRZkFzalB5SUFRUUYwSUFCQi93RnhRUWQyY2tIL0FYRWtQd3dMQ3hCMVFmLy9BM0VqUnhCK0RBZ0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUFJMEZCL3dGeEkwQkIvd0Z4UVFoMGNpSUJRUUFRZnlBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JVRUFFSHRCQ0E4TEkwRkIvd0Z4STBCQi93RnhRUWgwY2hDQUFVSC9BWEVrUHd3SkN5TkJRZjhCY1NOQVFmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1FBd0pDeU5CUVFFUWVTTkJRUUZxUWY4QmNTUkJJMEVFUUVFQUVIb0ZRUUVRZWd0QkFCQjdEQWNMSTBGQmZ4QjVJMEZCQVd0Qi93RnhKRUVqUVFSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNNQmdzUWRFSC9BWEVrUVF3REN5TS9RUUZ4UVFCTEJFQkJBUkI4QlVFQUVId0xJejhpQUVFSGRDQUFRZjhCY1VFQmRuSkIvd0Z4SkQ4TUF3dEJmdzhMSTBoQkFtcEIvLzhEY1NSSURBSUxJMGhCQVdwQi8vOERjU1JJREFFTFFRQVFla0VBRUh0QkFCQjRDMEVFRHdzZ0FFSC9BWEVrUVVFSUN5Z0JBWDhnQUVFWWRFRVlkU0lCUVlBQmNRUkFRWUFDSUFCQkdIUkJHSFZyUVg5c0lRRUxJQUVMS1FFQmZ5QUFFSUlCSVFFalNDQUJRUmgwUVJoMWFrSC8vd054SkVnalNFRUJha0gvL3dOeEpFZ0wyQVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFDQUFRUkZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lNNkJFQkJ6ZjRERUlBQlFmOEJjU0lBUVFGeEJFQkJ6ZjRESUFCQmZuRWlBRUdBQVhFRWYwRUFKRDRnQUVIL2ZuRUZRUUVrUGlBQVFZQUJjZ3NRZGtIRUFBOExDMEVCSkUwTUVBc1FkVUgvL3dOeElnQkJnUDREY1VFSWRTUkNJQUJCL3dGeEpFTWpTRUVDYWtILy93TnhKRWdNRVFzalEwSC9BWEVqUWtIL0FYRkJDSFJ5SXo4UWRnd1FDeU5EUWY4QmNTTkNRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtRZ3dRQ3lOQ1FRRVFlU05DUVFGcVFmOEJjU1JDSTBJRVFFRUFFSG9GUVFFUWVndEJBQkI3REE0TEkwSkJmeEI1STBKQkFXdEIvd0Z4SkVJalFnUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURRc1FkRUgvQVhFa1Fnd0tDMEVCUVFBalB5SUJRWUFCY1VHQUFVWWJJUUFqUmtFRWRrRUJjU0FCUVFGMGNrSC9BWEVrUHd3S0N4QjBFSU1CUVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFDTkRRZjhCY1NOQ1FmOEJjVUVJZEhJaUFVRUFFSDhnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVWQkFCQjdRUWdQQ3lORFFmOEJjU05DUWY4QmNVRUlkSElRZ0FGQi93RnhKRDhNQ0FzalEwSC9BWEVqUWtIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkVJTUNBc2pRMEVCRUhralEwRUJha0gvQVhFa1F5TkRCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d0dDeU5EUVg4UWVTTkRRUUZyUWY4QmNTUkRJME1FUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQVVMRUhSQi93RnhKRU1NQWd0QkFVRUFJejhpQVVFQmNVRUJSaHNoQUNOR1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpUS9EQUlMUVg4UEN5TklRUUZxUWYvL0EzRWtTQXdCQ3lBQUJFQkJBUkI4QlVFQUVId0xRUUFRZWtFQUVIdEJBQkI0QzBFRUR3c2dBRUgvQVhFa1EwRUlDN2dHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJJRWNFUUNBQVFTRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU5HUVFkMlFRRnhCRUFqU0VFQmFrSC8vd054SkVnRkVIUVFnd0VMUVFnUEN4QjFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JTTklRUUpxUWYvL0EzRWtTQXdRQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUNNL0VIWWdBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1JFSUFCQi93RnhKRVVNRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFSUR3c2pSRUVCRUhralJFRUJha0gvQVhFa1JDTkVCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d05DeU5FUVg4UWVTTkVRUUZyUWY4QmNTUkVJMFFFUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQXdMRUhSQi93RnhKRVFNQ2d0QkJrRUFJMFpCQlhaQkFYRkJBRXNiSVFFZ0FVSGdBSElnQVNOR1FRUjJRUUZ4UVFCTEd5RUJJMFpCQm5aQkFYRkJBRXNFZnlNL0lBRnJRZjhCY1FVZ0FVRUdjaUFCSXo4aUFFRVBjVUVKU3hzaUFVSGdBSElnQVNBQVFaa0JTeHNpQVNBQWFrSC9BWEVMSWdBRVFFRUFFSG9GUVFFUWVnc2dBVUhnQUhFRVFFRUJFSHdGUVFBUWZBdEJBQkI0SUFBa1B3d0tDeU5HUVFkMlFRRnhRUUJMQkVBUWRCQ0RBUVVqU0VFQmFrSC8vd054SkVnTFFRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBU0FCUWYvL0EzRkJBQkIvSUFGQkFYUkIvLzhEY1NJQlFZRCtBM0ZCQ0hVa1JDQUJRZjhCY1NSRlFRQVFlMEVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdFUWdBRkIvd0Z4SkQ4Z0FVRUJha0gvL3dOeElnRkJnUDREY1VFSWRTUkVJQUZCL3dGeEpFVU1Cd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlRUUZyUWYvL0EzRWlBVUdBL2dOeFFRaDFKRVFnQVVIL0FYRWtSVUVJRHdzalJVRUJFSGtqUlVFQmFrSC9BWEVrUlNORkJFQkJBQkI2QlVFQkVIb0xRUUFRZXd3RkN5TkZRWDhRZVNORlFRRnJRZjhCY1NSRkkwVUVRRUVBRUhvRlFRRVFlZ3RCQVJCN0RBUUxFSFJCL3dGeEpFVU1BZ3NqUDBGL2MwSC9BWEVrUDBFQkVIdEJBUkI0REFJTFFYOFBDeU5JUVFGcVFmLy9BM0VrU0F0QkJBdVVCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUV3UndSQUlBQkJNV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTBaQkJIWkJBWEVFUUNOSVFRRnFRZi8vQTNFa1NBVVFkQkNEQVF0QkNBOExFSFZCLy84RGNTUkhJMGhCQW1wQi8vOERjU1JJREJJTEkwVkIvd0Z4STBSQi93RnhRUWgwY2lJQUl6OFFkZ3dPQ3lOSFFRRnFRZi8vQTNFa1IwRUlEd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJZ0FRZ0FFaUFVRUJFSGtnQVVFQmFrSC9BWEVpQVFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHNNRFFzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdBUWdBRWlBVUYvRUhrZ0FVRUJhMEgvQVhFaUFRUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURBc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVIUkIvd0Z4RUhZTURBdEJBQkI3UVFBUWVFRUJFSHdNREFzalJrRUVka0VCY1VFQlJnUkFFSFFRZ3dFRkkwaEJBV3BCLy84RGNTUklDMEVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdFalIwRUFFSDhqUnlBQmFrSC8vd054SWdCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVWQkFCQjdRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUJDQUFVSC9BWEVrUHd3R0N5TkhRUUZyUWYvL0EzRWtSMEVJRHdzalAwRUJFSGtqUDBFQmFrSC9BWEVrUHlNL0JFQkJBQkI2QlVFQkVIb0xRUUFRZXd3SEN5TS9RWDhRZVNNL1FRRnJRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQVJCN0RBWUxFSFJCL3dGeEpEOE1CQXRCQUJCN1FRQVFlQ05HUVFSMlFRRnhRUUJMQkVCQkFCQjhCVUVCRUh3TERBUUxRWDhQQ3lBQVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JRd0NDeUFBUWYvL0EzRWdBUkIyREFFTEkwaEJBV3BCLy84RGNTUklDMEVFQytRQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBQkhCRUFnQUVIQkFFWU5BUUpBSUFCQndnQnJEZzREQkFVR0J3Z0pFUW9MREEwT0R3QUxEQThMREE4TEkwRWtRQXdPQ3lOQ0pFQU1EUXNqUXlSQURBd0xJMFFrUUF3TEN5TkZKRUFNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JBREFrTEl6OGtRQXdJQ3lOQUpFRU1Cd3NqUWlSQkRBWUxJME1rUVF3RkN5TkVKRUVNQkFzalJTUkJEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtRUXdDQ3lNL0pFRU1BUXRCZnc4TFFRUUwzd0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUJIQkVBZ0FFSFJBRVlOQVFKQUlBQkIwZ0JyRGc0UUF3UUZCZ2NJQ1FvUUN3d05EZ0FMREE0TEkwQWtRZ3dPQ3lOQkpFSU1EUXNqUXlSQ0RBd0xJMFFrUWd3TEN5TkZKRUlNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JDREFrTEl6OGtRZ3dJQ3lOQUpFTU1Cd3NqUVNSRERBWUxJMElrUXd3RkN5TkVKRU1NQkFzalJTUkREQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtRd3dDQ3lNL0pFTU1BUXRCZnc4TFFRUUwzd0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUJIQkVBZ0FFSGhBRVlOQVFKQUlBQkI0Z0JyRGc0REJCQUZCZ2NJQ1FvTERCQU5EZ0FMREE0TEkwQWtSQXdPQ3lOQkpFUU1EUXNqUWlSRURBd0xJME1rUkF3TEN5TkZKRVFNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JFREFrTEl6OGtSQXdJQ3lOQUpFVU1Cd3NqUVNSRkRBWUxJMElrUlF3RkN5TkRKRVVNQkFzalJDUkZEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtSUXdDQ3lNL0pFVU1BUXRCZnc4TFFRUUw3QUlBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUVjRVFDQUFRZkVBUmcwQkFrQWdBRUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhSQUFzTUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUkwQVFkZ3dQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUVJCMkRBNExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpTkNFSFlNRFFzalJVSC9BWEVqUkVIL0FYRkJDSFJ5STBNUWRnd01DeU5GUWY4QmNTTkVRZjhCY1VFSWRISWpSQkIyREFzTEkwVkIvd0Z4STBSQi93RnhRUWgwY2lORkVIWU1DZ3NqeEFGRkJFQUNRQ09aQVFSQVFRRWtTZ3dCQ3lOK0k0UUJjVUVmY1VVRVFFRUJKRXNNQVF0QkFTUk1Dd3NNQ1FzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SXo4UWRnd0lDeU5BSkQ4TUJ3c2pRU1EvREFZTEkwSWtQd3dGQ3lOREpEOE1CQXNqUkNRL0RBTUxJMFVrUHd3Q0N5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRkIvd0Z4SkQ4TUFRdEJmdzhMUVFRTFNRRUJmeUFCUVFCT0JFQWdBRUgvQVhFZ0FDQUJha0gvQVhGTEJFQkJBUkI4QlVFQUVId0xCU0FCUVI5MUlnSWdBU0FDYW5NZ0FFSC9BWEZLQkVCQkFSQjhCVUVBRUh3TEN3czBBUUYvSXo4Z0FFSC9BWEVpQVJCNUl6OGdBUkNMQVNNL0lBQnFRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN0Myd0JBbjhqUHlBQWFpTkdRUVIyUVFGeGFrSC9BWEVpQVNFQ0l6OGdBSE1nQVhOQkVIRUVRRUVCRUhnRlFRQVFlQXNqUHlBQVFmOEJjV29qUmtFRWRrRUJjV3BCZ0FKeFFRQkxCRUJCQVJCOEJVRUFFSHdMSUFJa1B5TS9CRUJCQUJCNkJVRUJFSG9MUVFBUWV3dnhBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFZQUJSd1JBSUFGQmdRRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU5BRUl3QkRCQUxJMEVRakFFTUR3c2pRaENNQVF3T0N5TkRFSXdCREEwTEkwUVFqQUVNREFzalJSQ01BUXdMQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FFUWpBRU1DZ3NqUHhDTUFRd0pDeU5BRUkwQkRBZ0xJMEVRalFFTUJ3c2pRaENOQVF3R0N5TkRFSTBCREFVTEkwUVFqUUVNQkFzalJSQ05BUXdEQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FFUWpRRU1BZ3NqUHhDTkFRd0JDMEYvRHd0QkJBczNBUUYvSXo4Z0FFSC9BWEZCZjJ3aUFSQjVJejhnQVJDTEFTTS9JQUJyUWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFSQjdDMndCQW44alB5QUFheU5HUVFSMlFRRnhhMEgvQVhFaUFTRUNJejhnQUhNZ0FYTkJFSEVFUUVFQkVIZ0ZRUUFRZUFzalB5QUFRZjhCY1dzalJrRUVka0VCY1d0QmdBSnhRUUJMQkVCQkFSQjhCVUVBRUh3TElBSWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRRVFld3Z4QVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWkFCUndSQUlBRkJrUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lOQUVJOEJEQkFMSTBFUWp3RU1Ed3NqUWhDUEFRd09DeU5ERUk4QkRBMExJMFFRandFTURBc2pSUkNQQVF3TEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFqd0VNQ2dzalB4Q1BBUXdKQ3lOQUVKQUJEQWdMSTBFUWtBRU1Cd3NqUWhDUUFRd0dDeU5ERUpBQkRBVUxJMFFRa0FFTUJBc2pSUkNRQVF3REN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFrQUVNQWdzalB4Q1FBUXdCQzBGL0R3dEJCQXNqQUNNL0lBQnhKRDhqUHdSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQVJCNFFRQVFmQXNuQUNNL0lBQnpRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN1FRQVFlRUVBRUh3TDhRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHZ0FVY0VRQ0FCUWFFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pRQkNTQVF3UUN5TkJFSklCREE4TEkwSVFrZ0VNRGdzalF4Q1NBUXdOQ3lORUVKSUJEQXdMSTBVUWtnRU1Dd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCRUpJQkRBb0xJejhRa2dFTUNRc2pRQkNUQVF3SUN5TkJFSk1CREFjTEkwSVFrd0VNQmdzalF4Q1RBUXdGQ3lORUVKTUJEQVFMSTBVUWt3RU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCRUpNQkRBSUxJejhRa3dFTUFRdEJmdzhMUVFRTEp3QWpQeUFBY2tIL0FYRWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhoQkFCQjhDeThCQVg4alB5QUFRZjhCY1VGL2JDSUJFSGtqUHlBQkVJc0JJejhnQVdvRVFFRUFFSG9GUVFFUWVndEJBUkI3Qy9FQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCc0FGSEJFQWdBVUd4QVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEkwQVFsUUVNRUFzalFSQ1ZBUXdQQ3lOQ0VKVUJEQTRMSTBNUWxRRU1EUXNqUkJDVkFRd01DeU5GRUpVQkRBc0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBUkNWQVF3S0N5TS9FSlVCREFrTEkwQVFsZ0VNQ0FzalFSQ1dBUXdIQ3lOQ0VKWUJEQVlMSTBNUWxnRU1CUXNqUkJDV0FRd0VDeU5GRUpZQkRBTUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBUkNXQVF3Q0N5TS9FSllCREFFTFFYOFBDMEVFQ3pzQkFYOGdBQkJSSWdGQmYwWUVmeUFBRUFFRklBRUxRZjhCY1NBQVFRRnFJZ0VRVVNJQVFYOUdCSDhnQVJBQkJTQUFDMEgvQVhGQkNIUnlDd3NBUVFnUWN5QUFFSmdCQzBNQUlBQkJnQUZ4UVlBQlJnUkFRUUVRZkFWQkFCQjhDeUFBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBQUxRUUFnQUVFQmNVRUFTd1JBUVFFUWZBVkJBQkI4Q3lBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFaUFBUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRJQUFMVHdFQmYwRUJRUUFnQUVHQUFYRkJnQUZHR3lFQkkwWkJCSFpCQVhFZ0FFRUJkSEpCL3dGeElRQWdBUVJBUVFFUWZBVkJBQkI4Q3lBQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIZ2dBQXRRQVFGL1FRRkJBQ0FBUVFGeFFRRkdHeUVCSTBaQkJIWkJBWEZCQjNRZ0FFSC9BWEZCQVhaeUlRQWdBUVJBUVFFUWZBVkJBQkI4Q3lBQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIZ2dBQXRHQVFGL1FRRkJBQ0FBUVlBQmNVR0FBVVliSVFFZ0FFRUJkRUgvQVhFaEFDQUJCRUJCQVJCOEJVRUFFSHdMSUFBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUFDMTRCQW45QkFVRUFJQUJCQVhGQkFVWWJJUUZCQVVFQUlBQkJnQUZ4UVlBQlJoc2hBaUFBUWY4QmNVRUJkaUlBUVlBQmNpQUFJQUliSWdBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUJCRUJCQVJCOEJVRUFFSHdMSUFBTE1BQWdBRUVQY1VFRWRDQUFRZkFCY1VFRWRuSWlBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0UVFBUWZDQUFDMElCQVg5QkFVRUFJQUJCQVhGQkFVWWJJUUVnQUVIL0FYRkJBWFlpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBRUVRRUVCRUh3RlFRQVFmQXNnQUFza0FFRUJJQUIwSUFGeFFmOEJjUVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBUkI0SUFFTG53Z0JCbjhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQ0c4aUJpSUZCRUFnQlVFQmF3NEhBUUlEQkFVR0J3Z0xJMEFoQVF3SEN5TkJJUUVNQmdzalFpRUJEQVVMSTBNaEFRd0VDeU5FSVFFTUF3c2pSU0VCREFJTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFTRUJEQUVMSXo4aEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklnUUVRQ0FFUVFGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5QUFRUWRNQkg5QkFTRUNJQUVRbWdFRklBQkJEMHdFZjBFQklRSWdBUkNiQVFWQkFBc0xJUU1NRHdzZ0FFRVhUQVIvUVFFaEFpQUJFSndCQlNBQVFSOU1CSDlCQVNFQ0lBRVFuUUVGUVFBTEN5RUREQTRMSUFCQkowd0VmMEVCSVFJZ0FSQ2VBUVVnQUVFdlRBUi9RUUVoQWlBQkVKOEJCVUVBQ3dzaEF3d05DeUFBUVRkTUJIOUJBU0VDSUFFUW9BRUZJQUJCUDB3RWYwRUJJUUlnQVJDaEFRVkJBQXNMSVFNTURBc2dBRUhIQUV3RWYwRUJJUUpCQUNBQkVLSUJCU0FBUWM4QVRBUi9RUUVoQWtFQklBRVFvZ0VGUVFBTEN5RUREQXNMSUFCQjF3Qk1CSDlCQVNFQ1FRSWdBUkNpQVFVZ0FFSGZBRXdFZjBFQklRSkJBeUFCRUtJQkJVRUFDd3NoQXd3S0N5QUFRZWNBVEFSL1FRRWhBa0VFSUFFUW9nRUZJQUJCN3dCTUJIOUJBU0VDUVFVZ0FSQ2lBUVZCQUFzTElRTU1DUXNnQUVIM0FFd0VmMEVCSVFKQkJpQUJFS0lCQlNBQVFmOEFUQVIvUVFFaEFrRUhJQUVRb2dFRlFRQUxDeUVEREFnTElBQkJod0ZNQkg5QkFTRUNJQUZCZm5FRklBQkJqd0ZNQkg5QkFTRUNJQUZCZlhFRlFRQUxDeUVEREFjTElBQkJsd0ZNQkg5QkFTRUNJQUZCZTNFRklBQkJud0ZNQkg5QkFTRUNJQUZCZDNFRlFRQUxDeUVEREFZTElBQkJwd0ZNQkg5QkFTRUNJQUZCYjNFRklBQkJyd0ZNQkg5QkFTRUNJQUZCWDNFRlFRQUxDeUVEREFVTElBQkJ0d0ZNQkg5QkFTRUNJQUZCdjM5eEJTQUFRYjhCVEFSL1FRRWhBaUFCUWY5K2NRVkJBQXNMSVFNTUJBc2dBRUhIQVV3RWYwRUJJUUlnQVVFQmNnVWdBRUhQQVV3RWYwRUJJUUlnQVVFQ2NnVkJBQXNMSVFNTUF3c2dBRUhYQVV3RWYwRUJJUUlnQVVFRWNnVWdBRUhmQVV3RWYwRUJJUUlnQVVFSWNnVkJBQXNMSVFNTUFnc2dBRUhuQVV3RWYwRUJJUUlnQVVFUWNnVWdBRUh2QVV3RWYwRUJJUUlnQVVFZ2NnVkJBQXNMSVFNTUFRc2dBRUgzQVV3RWYwRUJJUUlnQVVIQUFISUZJQUJCL3dGTUJIOUJBU0VDSUFGQmdBRnlCVUVBQ3dzaEF3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBWWlCQVJBSUFSQkFXc09Cd0VDQXdRRkJnY0lDeUFESkVBTUJ3c2dBeVJCREFZTElBTWtRZ3dGQ3lBREpFTU1CQXNnQXlSRURBTUxJQU1rUlF3Q0N5QUZRUVJJSWdRRWZ5QUVCU0FGUVFkS0N3UkFJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpQURFSFlMREFFTElBTWtQd3RCQkVGL0lBSWJDKzREQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhBQVVjRVFDQUFRY0VCYXc0UEFRSVJBd1FGQmdjSUNRb0xFQXdORGdzalJrRUhka0VCY1EwUkRBNExJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUkFJQUJCL3dGeEpFRkJCQThMSTBaQkIzWkJBWEVORVF3T0N5TkdRUWQyUVFGeERSQU1EQXNqUjBFQ2EwSC8vd054SkVjalJ5TkJRZjhCY1NOQVFmOEJjVUVJZEhJUWZnd05DeEIwRUl3QkRBMExJMGRCQW10Qi8vOERjU1JISTBjalNCQitRUUFrU0F3TEN5TkdRUWQyUVFGeFFRRkhEUW9NQndzalJ4Q1pBVUgvL3dOeEpFZ2pSMEVDYWtILy93TnhKRWNNQ1FzalJrRUhka0VCY1VFQlJnMEhEQW9MRUhSQi93RnhFS01CSVFBalNFRUJha0gvL3dOeEpFZ2dBQThMSTBaQkIzWkJBWEZCQVVjTkNDTkhRUUpyUWYvL0EzRWtSeU5ISTBoQkFtcEIvLzhEY1JCK0RBVUxFSFFRalFFTUJnc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJDQ1JJREFRTFFYOFBDeU5IRUprQlFmLy9BM0VrU0NOSFFRSnFRZi8vQTNFa1IwRU1Ed3NqUjBFQ2EwSC8vd054SkVjalJ5TklRUUpxUWYvL0EzRVFmZ3NRZFVILy93TnhKRWdMUVFnUEN5TklRUUZxUWYvL0EzRWtTRUVFRHdzalNFRUNha0gvL3dOeEpFaEJEQXZUQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBVWNFUUNBQVFkRUJhdzRQQVFJTkF3UUZCZ2NJQ1EwS0RRc01EUXNqUmtFRWRrRUJjUTBQREEwTEkwY1FtUUZCLy84RGNTRUFJMGRCQW1wQi8vOERjU1JISUFCQmdQNERjVUVJZFNSQ0lBQkIvd0Z4SkVOQkJBOExJMFpCQkhaQkFYRU5Ed3dNQ3lOR1FRUjJRUUZ4RFE0alIwRUNhMEgvL3dOeEpFY2pSeU5JUVFKcVFmLy9BM0VRZmd3TEN5TkhRUUpyUWYvL0EzRWtSeU5ISTBOQi93RnhJMEpCL3dGeFFRaDBjaEIrREFzTEVIUVFqd0VNQ3dzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1QkVDUklEQWtMSTBaQkJIWkJBWEZCQVVjTkNBd0dDeU5IRUprQlFmLy9BM0VrU0VFQkpKb0JJMGRCQW1wQi8vOERjU1JIREFjTEkwWkJCSFpCQVhGQkFVWU5CUXdJQ3lOR1FRUjJRUUZ4UVFGSERRY2pSMEVDYTBILy93TnhKRWNqUnlOSVFRSnFRZi8vQTNFUWZnd0VDeEIwRUpBQkRBVUxJMGRCQW10Qi8vOERjU1JISTBjalNCQitRUmdrU0F3REMwRi9Ed3NqUnhDWkFVSC8vd054SkVnalIwRUNha0gvL3dOeEpFZEJEQThMRUhWQi8vOERjU1JJQzBFSUR3c2pTRUVCYWtILy93TnhKRWhCQkE4TEkwaEJBbXBCLy84RGNTUklRUXdMOEFJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFXc09Ed0VDQ3dzREJBVUdCd2dMQ3dzSkNnc0xFSFJCL3dGeFFZRCtBMm9qUHhCMkRBc0xJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUkVJQUJCL3dGeEpFVkJCQThMSTBGQmdQNERhaU0vRUhaQkJBOExJMGRCQW10Qi8vOERjU1JISTBjalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUg1QkNBOExFSFFRa2dFTUJ3c2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJJQ1JJUVFnUEN4QjBFSUlCUVJoMFFSaDFJUUFqUnlBQVFRRVFmeU5ISUFCcVFmLy9BM0VrUjBFQUVIcEJBQkI3STBoQkFXcEIvLzhEY1NSSVFRd1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWtTRUVFRHdzUWRVSC8vd054SXo4UWRpTklRUUpxUWYvL0EzRWtTRUVFRHdzUWRCQ1RBUXdDQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFb0pFaEJDQThMUVg4UEN5TklRUUZxUWYvL0EzRWtTRUVFQzZjREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQlJ3UkFJQUJCOFFGckRnOEJBZ01OQkFVR0J3Z0pDZzBOQ3d3TkN4QjBRZjhCY1VHQS9nTnFFSUFCUWY4QmNTUS9EQTBMSTBjUW1RRkIvLzhEY1NFQUkwZEJBbXBCLy84RGNTUkhJQUJCZ1A0RGNVRUlkU1EvSUFCQi93RnhKRVlNRFFzalFVR0EvZ05xRUlBQlFmOEJjU1EvREF3TFFRQWttUUVNQ3dzalIwRUNhMEgvL3dOeEpFY2pSeU5HUWY4QmNTTS9RZjhCY1VFSWRISVFma0VJRHdzUWRCQ1ZBUXdJQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFd0pFaEJDQThMRUhRUWdnRWhBRUVBRUhwQkFCQjdJMGNnQUVFWWRFRVlkU0lBUVFFUWZ5TkhJQUJxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSU05JUVFGcVFmLy9BM0VrU0VFSUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUpFZEJDQThMRUhWQi8vOERjUkNBQVVIL0FYRWtQeU5JUVFKcVFmLy9BM0VrU0F3RkMwRUJKSm9CREFRTEVIUVFsZ0VNQWdzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1Qk9DUklRUWdQQzBGL0R3c2pTRUVCYWtILy93TnhKRWdMUVFRTDNBRUJBWDhqU0VFQmFrSC8vd054SkVnalRBUkFJMGhCQVd0Qi8vOERjU1JJQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRTSUJCRUFnQVVFQlJnMEJBa0FnQVVFQ2F3NE5Bd1FGQmdjSUNRb0xEQTBPRHdBTERBOExJQUFRZ1FFUEN5QUFFSVFCRHdzZ0FCQ0ZBUThMSUFBUWhnRVBDeUFBRUljQkR3c2dBQkNJQVE4TElBQVFpUUVQQ3lBQUVJb0JEd3NnQUJDT0FROExJQUFRa1FFUEN5QUFFSlFCRHdzZ0FCQ1hBUThMSUFBUXBBRVBDeUFBRUtVQkR3c2dBQkNtQVE4TElBQVFwd0VMd2dFQkFuOUJBQ1NaQVVHUC9nTVFBVUVCSUFCMFFYOXpjU0lCSklRQlFZLytBeUFCRUFRalIwRUNhMEgvL3dOeEpFY0NRQ05LSWdFalN5QUJHdzBBQ3lOSElnRWpTQ0lDUWY4QmNSQUVJQUZCQVdvZ0FrR0EvZ054UVFoMUVBUUNRQUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVDUUNBQVFRSnJEZ01EQkFVQUN3d0ZDMEVBSkg5QndBQWtTQXdFQzBFQUpJQUJRY2dBSkVnTUF3dEJBQ1NCQVVIUUFDUklEQUlMUVFBa2dnRkIyQUFrU0F3QkMwRUFKSU1CUWVBQUpFZ0xDL2tCQVFOL0k1b0JCRUJCQVNTWkFVRUFKSm9CQ3lOK0k0UUJjVUVmY1VFQVNnUkFJMHRGSTVrQklnSWdBaHNFZnlOL0kza2lBQ0FBR3dSL1FRQVFxUUZCQVFVamdBRWplaUlBSUFBYkJIOUJBUkNwQVVFQkJTT0JBU043SWdBZ0FCc0VmMEVDRUtrQlFRRUZJNElCSTN3aUFDQUFHd1IvUVFNUXFRRkJBUVVqZ3dFamZTSUFJQUFiQkg5QkJCQ3BBVUVCQlVFQUN3c0xDd3NGUVFBTEJFQUNmMEVCSTBvaUFDTkxJQUFiRFFBYVFRQUxCSDlCQUNSTFFRQWtTa0VBSkV4QkFDUk5RUmdGUVJRTElRRUxBbjlCQVNOS0lnQWpTeUFBR3cwQUdrRUFDd1JBUVFBa1MwRUFKRXBCQUNSTVFRQWtUUXNnQVE4TFFRQUxxd0VCQW45QkFTUXRJMHdFUUNOSUVBRkIvd0Z4RUtnQkVITkJBQ1JMUVFBa1NrRUFKRXhCQUNSTkN4Q3FBU0lCUVFCS0JFQWdBUkJ6QzBFRUlRQUNmMEVCSTBvaUFTTkxJQUViRFFBYVFRQUxSU0lCQkg4alRVVUZJQUVMQkVBalNCQUJRZjhCY1JDb0FTRUFDeU5HUWZBQmNTUkdJQUJCQUV3RVFDQUFEd3NnQUJCekk1Y0JRUUZxSkpjQkk1Y0JJNVVCVGdSQUk1WUJRUUZxSkpZQkk1Y0JJNVVCYXlTWEFRc2dBQXNFQUNOcUMrWUJBUVYvSUFCQmYwR0FDQ0FBUVFCSUd5QUFRUUJLR3lFRVFRQWhBQU5BQW44Q2Z5QUdSU0lDQkVBZ0FFVWhBZ3NnQWdzRVFDQUZSU0VDQ3lBQ0N3UkFJQU5GSVFJTElBSUVRQkNyQVVFQVNBUkFRUUVoQmdValNTTStCSDlCb01rSUJVSFFwQVFMVGdSQVFRRWhBQVVnQkVGL1NpSUNCRUFqYWlBRVRpRUNDeUFDQkVCQkFTRUZCU0FCUVg5S0lnSUVRQ05JSUFGR0lRSUxRUUVnQXlBQ0d5RURDd3NMREFFTEN5QUFCRUFqU1NNK0JIOUJvTWtJQlVIUXBBUUxheVJKSTRnQ0R3c2dCUVJBSTRrQ0R3c2dBd1JBSTRvQ0R3c2pTRUVCYTBILy93TnhKRWhCZndzSkFFRi9RWDhRclFFTE9BRURmd05BSUFJZ0FFZ2lBd1JBSUFGQkFFNGhBd3NnQXdSQUVLNEJJUUVnQWtFQmFpRUNEQUVMQ3lBQlFRQklCRUFnQVE4TFFRQUxDUUJCZnlBQUVLMEJDd2tBSUFBZ0FSQ3RBUXNGQUNPU0FRc0ZBQ09UQVFzRkFDT1VBUXRmQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBQ0lCUVFGR0RRRUNRQ0FCUVFKckRnWURCQVVHQndnQUN3d0lDeVBxQVE4TEkrc0JEd3NqN0FFUEN5UHRBUThMSSs0QkR3c2o3d0VQQ3lQd0FROExJL0VCRHd0QkFBdUxBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQWlBa0VCUmcwQkFrQWdBa0VDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBVUVBUnlUcUFRd0hDeUFCUVFCSEpPc0JEQVlMSUFGQkFFY2s3QUVNQlFzZ0FVRUFSeVR0QVF3RUN5QUJRUUJISk80QkRBTUxJQUZCQUVjazd3RU1BZ3NnQVVFQVJ5VHdBUXdCQ3lBQlFRQkhKUEVCQ3d0VUFRRi9RUUFrVFNBQUVMVUJSUVJBUVFFaEFRc2dBRUVCRUxZQklBRUVRRUVCUVFGQkFFRUJRUUFnQUVFRFRCc2lBU08vQVNJQUlBQWJHeUFCUlNQQUFTSUFJQUFiR3dSQVFRRWtnd0ZCQkJBNkN3c0xDUUFnQUVFQUVMWUJDNW9CQUNBQVFRQktCRUJCQUJDM0FRVkJBQkM0QVFzZ0FVRUFTZ1JBUVFFUXR3RUZRUUVRdUFFTElBSkJBRW9FUUVFQ0VMY0JCVUVDRUxnQkN5QURRUUJLQkVCQkF4QzNBUVZCQXhDNEFRc2dCRUVBU2dSQVFRUVF0d0VGUVFRUXVBRUxJQVZCQUVvRVFFRUZFTGNCQlVFRkVMZ0JDeUFHUVFCS0JFQkJCaEMzQVFWQkJoQzRBUXNnQjBFQVNnUkFRUWNRdHdFRlFRY1F1QUVMQ3dRQUl6OExCQUFqUUFzRUFDTkJDd1FBSTBJTEJBQWpRd3NFQUNORUN3UUFJMFVMQkFBalJnc0VBQ05JQ3dRQUkwY0xCZ0FqU0JBQkN3UUFJMVlMcndNQkNuOUJnSUFDUVlDUUFpTzVBUnNoQ1VHQXVBSkJnTEFDSTdvQkd5RUtBMEFnQlVHQUFrZ0VRRUVBSVFRRFFDQUVRWUFDU0FSQUlBa2dCVUVEZFVFRmRDQUthaUFFUVFOMWFpSURRWUNRZm1vdEFBQVFMQ0VJSUFWQkNHOGhBVUVISUFSQkNHOXJJUVpCQUNFQ0FuOGdBRUVBU2lNNklnY2dCeHNFUUNBRFFZRFFmbW90QUFBaEFnc2dBa0hBQUhFTEJFQkJCeUFCYXlFQkMwRUFJUWNnQVVFQmRDQUlhaUlEUVlDUWZtcEJBVUVBSUFKQkNIRWJJZ2RCQVhGQkRYUnFMUUFBSVFoQkFDRUJJQU5CZ1pCK2FpQUhRUUZ4UVExMGFpMEFBRUVCSUFaMGNRUkFRUUloQVFzZ0FVRUJhaUFCUVFFZ0JuUWdDSEViSVFFZ0JVRUlkQ0FFYWtFRGJDRUdJQUJCQUVvak9pSURJQU1iQkVBZ0FrRUhjU0FCUVFBUUxTSUJRUjl4UVFOMElRTWdCa0dBb1F0cUlnSWdBem9BQUNBQ1FRRnFJQUZCNEFkeFFRVjFRUU4wT2dBQUlBSkJBbW9nQVVHQStBRnhRUXAxUVFOME9nQUFCU0FCUWNmK0EwRUFFQzRoQWtFQUlRRURRQ0FCUVFOSUJFQWdCa0dBb1F0cUlBRnFJQUk2QUFBZ0FVRUJhaUVCREFFTEN3c2dCRUVCYWlFRURBRUxDeUFGUVFGcUlRVU1BUXNMQzlvREFReC9BMEFnQTBFWFRrVUVRRUVBSVFJRFFDQUNRUjlJQkVCQkFVRUFJQUpCRDBvYklRa2dBMEVQYXlBRElBTkJEMG9iUVFSMElnY2dBa0VQYTJvZ0FpQUhhaUFDUVE5S0d5RUhRWUNRQWtHQWdBSWdBMEVQU2hzaEMwSEgvZ01oQ2tGL0lRRkJmeUVJUVFBaEJBTkFJQVJCQ0VnRVFFRUFJUUFEUUNBQVFRVklCRUFnQUVFRGRDQUVha0VDZENJRlFZTDhBMm9RQVNBSFJnUkFJQVZCZy93RGFoQUJJUVpCQVVFQUlBWkJDSEZCQUVjak9pTTZHeHNnQ1VZRVFFRUlJUVJCQlNFQUlBWWlDRUVRY1FSL1FjbitBd1ZCeVA0REN5RUtDd3NnQUVFQmFpRUFEQUVMQ3lBRVFRRnFJUVFNQVFzTElBaEJBRWdqT2lJR0lBWWJCRUJCZ0xnQ1FZQ3dBaU82QVJzaEJFRi9JUUJCQUNFQkEwQWdBVUVnU0FSQVFRQWhCUU5BSUFWQklFZ0VRQ0FGUVFWMElBUnFJQUZxSWdaQmdKQithaTBBQUNBSFJnUkFRU0FoQlNBR0lRQkJJQ0VCQ3lBRlFRRnFJUVVNQVFzTElBRkJBV29oQVF3QkN3c2dBRUVBVGdSL0lBQkJnTkIrYWkwQUFBVkJmd3NoQVF0QkFDRUFBMEFnQUVFSVNBUkFJQWNnQ3lBSlFRQkJCeUFBSUFKQkEzUWdBMEVEZENBQWFrSDRBVUdBb1JjZ0NpQUJJQWdRTHhvZ0FFRUJhaUVBREFFTEN5QUNRUUZxSVFJTUFRc0xJQU5CQVdvaEF3d0JDd3NMbUFJQkNYOERRQ0FFUVFoT1JRUkFRUUFoQVFOQUlBRkJCVWdFUUNBQlFRTjBJQVJxUVFKMElnQkJnUHdEYWhBQkdpQUFRWUg4QTJvUUFSb2dBRUdDL0FOcUVBRWhBa0VCSVFVanV3RUVRQ0FDUVFKdlFRRkdCRUFnQWtFQmF5RUNDMEVDSVFVTElBQkJnL3dEYWhBQklRWkJBQ0VIUVFGQkFDQUdRUWh4UVFCSEl6b2pPaHNiSVFkQnlQNERJUWhCeWY0RFFjaitBeUFHUVJCeEd5RUlRUUFoQUFOQUlBQWdCVWdFUUVFQUlRTURRQ0FEUVFoSUJFQWdBQ0FDYWtHQWdBSWdCMEVBUVFjZ0F5QUVRUU4wSUFGQkJIUWdBMm9nQUVFRGRHcEJ3QUJCZ0tFZ0lBaEJmeUFHRUM4YUlBTkJBV29oQXd3QkN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFSQkFXb2hCQXdCQ3dzTEJRQWpoZ0VMQlFBamh3RUxCUUFqaUFFTEdBRUJmeU9LQVNFQUk0a0JCRUFnQUVFRWNpRUFDeUFBQ3kwQkFYOENRQU5BSUFCQi8vOERUZzBCSUFCQmdLSEpCR29nQUJCU09nQUFJQUJCQVdvaEFBd0FBQXNBQ3dzVUFEOEFRWlFCU0FSQVFaUUJQd0JyUUFBYUN3c0RBQUVMSHdBQ1FBSkFBa0FqbVFJT0FnRUNBQXNBQzBFQUlRQUxJQUJCZnhDdEFRc0hBQ0FBSkprQ0N5OEFBa0FDUUFKQUFrQUNRQ09aQWc0RUFRSURCQUFMQUF0QkFTRUFDMEYvSVFFTFFYOGhBZ3NnQVNBQ0VLMEJDd0F6RUhOdmRYSmpaVTFoY0hCcGJtZFZVa3doWTI5eVpTOWthWE4wTDJOdmNtVXVkVzUwYjNWamFHVmtMbmRoYzIwdWJXRnciKToKInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93fHwidW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmP2F3YWl0IEcoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCaWdFU1lBcC9mMzkvZjM5L2YzOS9BR0FBQUdBQmZ3Ri9ZQUovZndCZ0FYOEFZQUovZndGL1lBQUJmMkFEZjM5L0FYOWdBMzkvZndCZ0JuOS9mMzkvZndCZ0IzOS9mMzkvZjM4QmYyQUhmMzkvZjM5L2Z3QmdCSDkvZjM4QmYyQUlmMzkvZjM5L2YzOEFZQVYvZjM5L2Z3Ri9ZQTEvZjM5L2YzOS9mMzkvZjM5L0FYOWdBQUJnQW45L0FYOEQxUUhUQVFJQ0FRRURBUUVCQVFFQkFRRUJCQVFCQVFFQUJnRUJBUUVCQVFFQkJBUUJBUUVCQVFFQkFRWUdCZ1lPQlFjSER3b0xDUWtJQ0FNRUFRRUVBUVFCQVFFQkFRSUNCUUlDQWdJRkRBUUVCQUVDQmdJQ0F3UUVCQVFCQVFFQkJBVUVCZ1lFQXdJRkJBRVFCQVVEQ0FFRkFRUUJCUVFFQmdZREJRUURCQVFFQXdNSUFnSUNCQUlDQWdJQ0FnSURCQVFDQkFRQ0JBUUNCQVFDQWdJQ0FnSUNBZ0lDQWdVQ0FnSUNBZ0lFQmdZR0VRWUNBZ1VHQmdZQ0F3UUVEUVlHQmdZR0JnWUdCZ1lHQmdRQkFRWUdCZ1lCQVFFQ0JBY0VCQUZ3QUFFRkF3RUFBQWFYREpvQ2Z3QkJBQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUVBdC9BRUdBZ0FFTGZ3QkJnSkFCQzM4QVFZQ0FBZ3QvQUVHQWtBTUxmd0JCZ0lBQkMzOEFRWUFRQzM4QVFZQ0FCQXQvQUVHQWtBUUxmd0JCZ0FFTGZ3QkJnSkVFQzM4QVFZQzRBUXQvQUVHQXlRVUxmd0JCZ05nRkMzOEFRWUNoQ3d0L0FFR0FnQXdMZndCQmdLRVhDMzhBUVlDQUNRdC9BRUdBb1NBTGZ3QkJnUGdBQzM4QVFZQ1FCQXQvQUVHQWlSMExmd0JCZ0praEMzOEFRWUNBQ0F0L0FFR0FtU2tMZndCQmdJQUlDMzhBUVlDWk1RdC9BRUdBZ0FnTGZ3QkJnSms1QzM4QVFZQ0FDQXQvQUVHQW1jRUFDMzhBUVlDQUNBdC9BRUdBbWNrQUMzOEFRWUNBQ0F0L0FFR0FtZEVBQzM4QVFZQ0krQU1MZndCQmdLSEpCQXQvQUVILy93TUxmd0JCQUF0L0FFR0FvYzBFQzM4QVFaUUJDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhQL2dNTGZ3RkJBQXQvQVVIdy9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCL3dBTGZ3RkIvd0FMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCZ0tqV3VRY0xmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVR0E5d0lMZndGQmdJQUlDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQjFmNERDMzhCUWRIK0F3dC9BVUhTL2dNTGZ3RkIwLzREQzM4QlFkVCtBd3QvQVVIby9nTUxmd0ZCNi80REMzOEJRZW4rQXd0L0FVRUFDMzhCUVFFTGZ3RkJBZ3QvQUVHQW9jMEVDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUVlDQUJBdC9BRUdBa0FRTGZ3QkJnSkFFQzM4QVFZQUJDMzhBUVlESkJRdC9BRUdBb1FzTGZ3QkJnS0VYQzM4QVFZQ1p3UUFMZndCQmdKbkpBQXQvQUVHQW1kRUFDMzhCUVFBTEI3c1NiQVp0WlcxdmNua0NBQVYwWVdKc1pRRUFCbU52Ym1acFp3QVREbWhoYzBOdmNtVlRkR0Z5ZEdWa0FCUUpjMkYyWlZOMFlYUmxBQnNKYkc5aFpGTjBZWFJsQUNZRmFYTkhRa01BSnhKblpYUlRkR1Z3YzFCbGNsTjBaWEJUWlhRQUtBdG5aWFJUZEdWd1UyVjBjd0FwQ0dkbGRGTjBaWEJ6QUNvVlpYaGxZM1YwWlUxMWJIUnBjR3hsUm5KaGJXVnpBSzhCREdWNFpXTjFkR1ZHY21GdFpRQ3VBUWhmYzJWMFlYSm5Zd0RSQVJsbGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2QU5BQkcyVjRaV04xZEdWR2NtRnRaVlZ1ZEdsc1FuSmxZV3R3YjJsdWRBQ3dBU2hsZUdWamRYUmxSbkpoYldWQmJtUkRhR1ZqYTBGMVpHbHZWVzUwYVd4Q2NtVmhhM0J2YVc1MEFMRUJGV1Y0WldOMWRHVlZiblJwYkVOdmJtUnBkR2x2YmdEU0FRdGxlR1ZqZFhSbFUzUmxjQUNyQVJSblpYUkRlV05zWlhOUVpYSkRlV05zWlZObGRBQ3lBUXhuWlhSRGVXTnNaVk5sZEhNQXN3RUpaMlYwUTNsamJHVnpBTFFCRG5ObGRFcHZlWEJoWkZOMFlYUmxBTGtCSDJkbGRFNTFiV0psY2s5bVUyRnRjR3hsYzBsdVFYVmthVzlDZFdabVpYSUFyQUVRWTJ4bFlYSkJkV1JwYjBKMVptWmxjZ0FpRjFkQlUwMUNUMWxmVFVWTlQxSlpYMHhQUTBGVVNVOU9BeW9UVjBGVFRVSlBXVjlOUlUxUFVsbGZVMGxhUlFNckVsZEJVMDFDVDFsZlYwRlRUVjlRUVVkRlV3TXNIa0ZUVTBWTlFreFpVME5TU1ZCVVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNQUdrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlUU1ZwRkF3RVdWMEZUVFVKUFdWOVRWRUZVUlY5TVQwTkJWRWxQVGdNQ0VsZEJVMDFDVDFsZlUxUkJWRVZmVTBsYVJRTURJRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3b2NSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1MRWxaSlJFVlBYMUpCVFY5TVQwTkJWRWxQVGdNRURsWkpSRVZQWDFKQlRWOVRTVnBGQXdVUlYwOVNTMTlTUVUxZlRFOURRVlJKVDA0REJnMVhUMUpMWDFKQlRWOVRTVnBGQXdjbVQxUklSVkpmUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNERDQ0pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2tZUjFKQlVFaEpRMU5mVDFWVVVGVlVYMHhQUTBGVVNVOU9BeGdVUjFKQlVFaEpRMU5mVDFWVVVGVlVYMU5KV2tVREdSUkhRa05mVUVGTVJWUlVSVjlNVDBOQlZFbFBUZ01NRUVkQ1ExOVFRVXhGVkZSRlgxTkpXa1VERFJoQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVEU5RFFWUkpUMDRERGhSQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVTBsYVJRTVBEa1pTUVUxRlgweFBRMEZVU1U5T0F4QUtSbEpCVFVWZlUwbGFSUU1SRjBKQlEwdEhVazlWVGtSZlRVRlFYMHhQUTBGVVNVOU9BeElUUWtGRFMwZFNUMVZPUkY5TlFWQmZVMGxhUlFNVEVsUkpURVZmUkVGVVFWOU1UME5CVkVsUFRnTVVEbFJKVEVWZlJFRlVRVjlUU1ZwRkF4VVNUMEZOWDFSSlRFVlRYMHhQUTBGVVNVOU9BeFlPVDBGTlgxUkpURVZUWDFOSldrVURGeFZCVlVSSlQxOUNWVVpHUlZKZlRFOURRVlJKVDA0REloRkJWVVJKVDE5Q1ZVWkdSVkpmVTBsYVJRTWpHVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZURTlEUVZSSlQwNERHaFZEU0VGT1RrVk1YekZmUWxWR1JrVlNYMU5KV2tVREd4bERTRUZPVGtWTVh6SmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4d1ZRMGhCVGs1RlRGOHlYMEpWUmtaRlVsOVRTVnBGQXgwWlEwaEJUazVGVEY4elgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZUZVTklRVTVPUlV4Zk0xOUNWVVpHUlZKZlUwbGFSUU1mR1VOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESUJWRFNFRk9Ua1ZNWHpSZlFsVkdSa1ZTWDFOSldrVURJUlpEUVZKVVVrbEVSMFZmVWtGTlgweFBRMEZVU1U5T0F5UVNRMEZTVkZKSlJFZEZYMUpCVFY5VFNWcEZBeVVXUTBGU1ZGSkpSRWRGWDFKUFRWOU1UME5CVkVsUFRnTW1Fa05CVWxSU1NVUkhSVjlTVDAxZlUwbGFSUU1uSFVSRlFsVkhYMGRCVFVWQ1QxbGZUVVZOVDFKWlgweFBRMEZVU1U5T0F5Z1pSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVTBsYVJRTXBJV2RsZEZkaGMyMUNiM2xQWm1aelpYUkdjbTl0UjJGdFpVSnZlVTltWm5ObGRBQUFER2RsZEZKbFoybHpkR1Z5UVFDNkFReG5aWFJTWldkcGMzUmxja0lBdXdFTVoyVjBVbVZuYVhOMFpYSkRBTHdCREdkbGRGSmxaMmx6ZEdWeVJBQzlBUXhuWlhSU1pXZHBjM1JsY2tVQXZnRU1aMlYwVW1WbmFYTjBaWEpJQUw4QkRHZGxkRkpsWjJsemRHVnlUQURBQVF4blpYUlNaV2RwYzNSbGNrWUF3UUVSWjJWMFVISnZaM0poYlVOdmRXNTBaWElBd2dFUFoyVjBVM1JoWTJ0UWIybHVkR1Z5QU1NQkdXZGxkRTl3WTI5a1pVRjBVSEp2WjNKaGJVTnZkVzUwWlhJQXhBRUZaMlYwVEZrQXhRRWRaSEpoZDBKaFkydG5jbTkxYm1STllYQlViMWRoYzIxTlpXMXZjbmtBeGdFWVpISmhkMVJwYkdWRVlYUmhWRzlYWVhOdFRXVnRiM0o1QU1jQkUyUnlZWGRQWVcxVWIxZGhjMjFOWlcxdmNua0F5QUVHWjJWMFJFbFdBTWtCQjJkbGRGUkpUVUVBeWdFR1oyVjBWRTFCQU1zQkJtZGxkRlJCUXdETUFSTjFjR1JoZEdWRVpXSjFaMGRDVFdWdGIzSjVBTTBCQm5Wd1pHRjBaUUN1QVExbGJYVnNZWFJwYjI1VGRHVndBS3NCRW1kbGRFRjFaR2x2VVhWbGRXVkpibVJsZUFDc0FROXlaWE5sZEVGMVpHbHZVWFZsZFdVQUlnNTNZWE50VFdWdGIzSjVVMmw2WlFPTEFoeDNZWE50UW05NVNXNTBaWEp1WVd4VGRHRjBaVXh2WTJGMGFXOXVBNHdDR0hkaGMyMUNiM2xKYm5SbGNtNWhiRk4wWVhSbFUybDZaUU9OQWgxbllXMWxRbTk1U1c1MFpYSnVZV3hOWlcxdmNubE1iMk5oZEdsdmJnT09BaGxuWVcxbFFtOTVTVzUwWlhKdVlXeE5aVzF2Y25sVGFYcGxBNDhDRTNacFpHVnZUM1YwY0hWMFRHOWpZWFJwYjI0RGtBSWlabkpoYldWSmJsQnliMmR5WlhOelZtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnT1RBaHRuWVcxbFltOTVRMjlzYjNKUVlXeGxkSFJsVEc5allYUnBiMjREa1FJWFoyRnRaV0p2ZVVOdmJHOXlVR0ZzWlhSMFpWTnBlbVVEa2dJVlltRmphMmR5YjNWdVpFMWhjRXh2WTJGMGFXOXVBNVFDQzNScGJHVkVZWFJoVFdGd0E1VUNFM052ZFc1a1QzVjBjSFYwVEc5allYUnBiMjREbGdJUloyRnRaVUo1ZEdWelRHOWpZWFJwYjI0RG1BSVVaMkZ0WlZKaGJVSmhibXR6VEc5allYUnBiMjREbHdJSUFzNEJDUWdCQUVFQUN3SFBBUXI4MmdIVEFjOEJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVNZFNJQlJRMEFBa0FnQVVFQmF3NE5BUUVCQWdJQ0FnTURCQVFGQmdBTERBWUxJQUJCZ0puUkFHb1BDeUFBUVFFak9DSUFJemxGSWdFRWZ5QUFSUVVnQVFzYlFRNTBha0dBbWRBQWFnOExJQUJCZ0pCK2FpTTZCSDhqT3hBQlFRRnhCVUVBQzBFTmRHb1BDeUFBSXp4QkRYUnFRWURaeGdCcUR3c2dBRUdBa0g1cUR3dEJBQ0VCQW44ak9nUkFJejBRQVVFSGNTRUJDeUFCUVFGSUN3UkFRUUVoQVFzZ0FVRU1kQ0FBYWtHQThIMXFEd3NnQUVHQVVHb0xDUUFnQUJBQUxRQUFDNWtCQUVFQUpENUJBQ1EvUVFBa1FFRUFKRUZCQUNSQ1FRQWtRMEVBSkVSQkFDUkZRUUFrUmtFQUpFZEJBQ1JJUVFBa1NVRUFKRXBCQUNSTFFRQWtURUVBSkUwak9nUkFRUkVrUDBHQUFTUkdRUUFrUUVFQUpFRkIvd0VrUWtIV0FDUkRRUUFrUkVFTkpFVUZRUUVrUDBHd0FTUkdRUUFrUUVFVEpFRkJBQ1JDUWRnQkpFTkJBU1JFUWMwQUpFVUxRWUFDSkVoQi92OERKRWNMcEFFQkFuOUJBQ1JPUVFFa1QwSEhBaEFCSVFGQkFDUlFRUUFrVVVFQUpGSkJBQ1JUUVFBa09TQUJCRUFnQVVFQlRpSUFCRUFnQVVFRFRDRUFDeUFBQkVCQkFTUlJCU0FCUVFWT0lnQUVRQ0FCUVFaTUlRQUxJQUFFUUVFQkpGSUZJQUZCRDA0aUFBUkFJQUZCRTB3aEFBc2dBQVJBUVFFa1V3VWdBVUVaVGlJQUJFQWdBVUVlVENFQUN5QUFCRUJCQVNRNUN3c0xDd1ZCQVNSUUMwRUJKRGhCQUNROEN3c0FJQUFRQUNBQk9nQUFDeThBUWRIK0EwSC9BUkFFUWRMK0EwSC9BUkFFUWRQK0EwSC9BUkFFUWRUK0EwSC9BUkFFUWRYK0EwSC9BUkFFQzVnQkFFRUFKRlJCQUNSVlFRQWtWa0VBSkZkQkFDUllRUUFrV1VFQUpGb2pPZ1JBUVpBQkpGWkJ3UDREUVpFQkVBUkJ3ZjREUVlFQkVBUkJ4UDREUVpBQkVBUkJ4LzREUWZ3QkVBUUZRWkFCSkZaQndQNERRWkVCRUFSQndmNERRWVVCRUFSQnh2NERRZjhCRUFSQngvNERRZndCRUFSQnlQNERRZjhCRUFSQnlmNERRZjhCRUFRTFFjLytBMEVBRUFSQjhQNERRUUVRQkF0UEFDTTZCRUJCNlA0RFFjQUJFQVJCNmY0RFFmOEJFQVJCNnY0RFFjRUJFQVJCNi80RFFRMFFCQVZCNlA0RFFmOEJFQVJCNmY0RFFmOEJFQVJCNnY0RFFmOEJFQVJCNi80RFFmOEJFQVFMQ3k4QVFaRCtBMEdBQVJBRVFaSCtBMEcvQVJBRVFaTCtBMEh6QVJBRVFaUCtBMEhCQVJBRVFaVCtBMEcvQVJBRUN5d0FRWlgrQTBIL0FSQUVRWmIrQTBFL0VBUkJsLzREUVFBUUJFR1kvZ05CQUJBRVFabitBMEc0QVJBRUN6SUFRWnIrQTBIL0FCQUVRWnYrQTBIL0FSQUVRWnorQTBHZkFSQUVRWjMrQTBFQUVBUkJudjREUWJnQkVBUkJBU1JyQ3kwQVFaLytBMEgvQVJBRVFhRCtBMEgvQVJBRVFhSCtBMEVBRUFSQm92NERRUUFRQkVHai9nTkJ2d0VRQkFzNEFFRVBKR3hCRHlSdFFROGtia0VQSkc5QkFDUndRUUFrY1VFQUpISkJBQ1J6UWY4QUpIUkIvd0FrZFVFQkpIWkJBU1IzUVFBa2VBdG5BRUVBSkZ0QkFDUmNRUUFrWFVFQkpGNUJBU1JmUVFFa1lFRUJKR0ZCQVNSaVFRRWtZMEVCSkdSQkFTUmxRUUVrWmtFQUpHZEJBQ1JvUVFBa2FVRUFKR29RQ0JBSkVBb1FDMEdrL2dOQjl3QVFCRUdsL2dOQjh3RVFCRUdtL2dOQjhRRVFCQkFNQ3pnQUlBQkJBWEZCQUVja2VTQUFRUUp4UVFCSEpIb2dBRUVFY1VFQVJ5UjdJQUJCQ0hGQkFFY2tmQ0FBUVJCeFFRQkhKSDBnQUNSK0N6MEFJQUJCQVhGQkFFY2tmeUFBUVFKeFFRQkhKSUFCSUFCQkJIRkJBRWNrZ1FFZ0FFRUljVUVBUnlTQ0FTQUFRUkJ4UVFCSEpJTUJJQUFraEFFTFhRQkJBQ1NGQVVFQUpJWUJRUUFraHdGQkFDU0lBVUVBSklrQlFRQWtpZ0ZCQUNTTEFVRUFKSXdCSXpvRVFFR0UvZ05CSGhBRVFhQTlKSVlCQlVHRS9nTkJxd0VRQkVITTF3SWtoZ0VMUVlmK0EwSDRBUkFFUWZnQkpJb0JDMElBUVFBa2pRRkJBQ1NPQVNNNkJFQkJndjREUWZ3QUVBUkJBQ1NQQVVFQUpKQUJRUUFra1FFRlFZTCtBMEgrQUJBRVFRQWtqd0ZCQVNTUUFVRUFKSkVCQ3d2MkFRRUNmMEhEQWhBQklnRkJ3QUZHSWdBRWZ5QUFCU0FCUVlBQlJpTXZJZ0FnQUJzTEJFQkJBU1E2QlVFQUpEb0xFQUlRQXhBRkVBWVFCeEFOUVFBUURrSC8vd01qZmhBRVFlRUJFQTlCai80REk0UUJFQVFRRUJBUkl6b0VRRUh3L2dOQitBRVFCRUhQL2dOQi9nRVFCRUhOL2dOQi9nQVFCRUdBL2dOQnp3RVFCRUdQL2dOQjRRRVFCRUhzL2dOQi9nRVFCRUgxL2dOQmp3RVFCQVZCOFA0RFFmOEJFQVJCei80RFFmOEJFQVJCemY0RFFmOEJFQVJCZ1A0RFFjOEJFQVJCai80RFFlRUJFQVFMUVFBa0xVR0FxTmE1QnlTU0FVRUFKSk1CUVFBa2xBRkJnS2pXdVFja2xRRkJBQ1NXQVVFQUpKY0JDNjRCQUNBQVFRQktCRUJCQVNRdUJVRUFKQzRMSUFGQkFFb0VRRUVCSkM4RlFRQWtMd3NnQWtFQVNnUkFRUUVrTUFWQkFDUXdDeUFEUVFCS0JFQkJBU1F4QlVFQUpERUxJQVJCQUVvRVFFRUJKRElGUVFBa01nc2dCVUVBU2dSQVFRRWtNd1ZCQUNRekN5QUdRUUJLQkVCQkFTUTBCVUVBSkRRTElBZEJBRW9FUUVFQkpEVUZRUUFrTlFzZ0NFRUFTZ1JBUVFFa05nVkJBQ1EyQ3lBSlFRQktCRUJCQVNRM0JVRUFKRGNMRUJJTERBQWpMUVJBUVFFUEMwRUFDN0lCQUVHQUNDTS9PZ0FBUVlFSUkwQTZBQUJCZ2dnalFUb0FBRUdEQ0NOQ09nQUFRWVFJSTBNNkFBQkJoUWdqUkRvQUFFR0dDQ05GT2dBQVFZY0lJMFk2QUFCQmlBZ2pSenNCQUVHS0NDTklPd0VBUVl3SUkwazJBZ0FqU2dSQVFaRUlRUUU2QUFBRlFaRUlRUUE2QUFBTEkwc0VRRUdTQ0VFQk9nQUFCVUdTQ0VFQU9nQUFDeU5NQkVCQmt3aEJBVG9BQUFWQmt3aEJBRG9BQUFzalRRUkFRWlFJUVFFNkFBQUZRWlFJUVFBNkFBQUxDNndCQUVISUNTTTRPd0VBUWNvSkl6dzdBUUFqVGdSQVFjd0pRUUU2QUFBRlFjd0pRUUE2QUFBTEkwOEVRRUhOQ1VFQk9nQUFCVUhOQ1VFQU9nQUFDeU5RQkVCQnpnbEJBVG9BQUFWQnpnbEJBRG9BQUFzalVRUkFRYzhKUVFFNkFBQUZRYzhKUVFBNkFBQUxJMUlFUUVIUUNVRUJPZ0FBQlVIUUNVRUFPZ0FBQ3lOVEJFQkIwUWxCQVRvQUFBVkIwUWxCQURvQUFBc2pPUVJBUWRJSlFRRTZBQUFGUWRJSlFRQTZBQUFMQzBzQVFmb0pJNFVCTmdJQVFmNEpJNFlCTmdJQUk0c0JCRUJCZ2dwQkFUb0FBQVZCZ2dwQkFEb0FBQXNqakFFRVFFR0ZDa0VCT2dBQUJVR0ZDa0VBT2dBQUMwR0YvZ01qaHdFUUJBdDRBQ09iQVFSQVFkNEtRUUU2QUFBRlFkNEtRUUE2QUFBTFFkOEtJNXdCTmdJQVFlTUtJNTBCTmdJQVFlY0tJNTRCTmdJQVFld0tJNThCTmdJQVFmRUtJNkFCT2dBQVFmSUtJNkVCT2dBQUk2SUJCRUJCOXdwQkFUb0FBQVZCOXdwQkFEb0FBQXRCK0Fvam93RTJBZ0JCL1FvanBBRTdBUUFMVHdBanBRRUVRRUdRQzBFQk9nQUFCVUdRQzBFQU9nQUFDMEdSQ3lPbUFUWUNBRUdWQ3lPbkFUWUNBRUdaQ3lPb0FUWUNBRUdlQ3lPcEFUWUNBRUdqQ3lPcUFUb0FBRUdrQ3lPckFUb0FBQXRHQUNPd0FRUkFRZlFMUVFFNkFBQUZRZlFMUVFBNkFBQUxRZlVMSTdFQk5nSUFRZmtMSTdJQk5nSUFRZjBMSTdNQk5nSUFRWUlNSTdRQk5nSUFRWWNNSTdVQk93RUFDNk1CQUJBVlFiSUlJMVUyQWdCQnRnZ2ptQUU2QUFCQnhQNERJMVlRQkNPWkFRUkFRZVFJUVFFNkFBQUZRZVFJUVFBNkFBQUxJNW9CQkVCQjVRaEJBVG9BQUFWQjVRaEJBRG9BQUFzUUZoQVhRYXdLSTJjMkFnQkJzQW9qYURvQUFFR3hDaU5wT2dBQUVCZ1FHU09zQVFSQVFjSUxRUUU2QUFBRlFjSUxRUUE2QUFBTFFjTUxJNjBCTmdJQVFjY0xJNjRCTmdJQVFjc0xJNjhCT3dFQUVCcEJBQ1F0QzY0QkFFR0FDQzBBQUNRL1FZRUlMUUFBSkVCQmdnZ3RBQUFrUVVHRENDMEFBQ1JDUVlRSUxRQUFKRU5CaFFndEFBQWtSRUdHQ0MwQUFDUkZRWWNJTFFBQUpFWkJpQWd2QVFBa1IwR0tDQzhCQUNSSVFZd0lLQUlBSkVrQ2YwRUJRWkVJTFFBQVFRQktEUUFhUVFBTEpFb0NmMEVCUVpJSUxRQUFRUUJLRFFBYVFRQUxKRXNDZjBFQlFaTUlMUUFBUVFCS0RRQWFRUUFMSkV3Q2YwRUJRWlFJTFFBQVFRQktEUUFhUVFBTEpFMExYQUVCZjBFQUpGVkJBQ1JXUWNUK0EwRUFFQVJCd2Y0REVBRkJmSEVoQVVFQUpKZ0JRY0grQXlBQkVBUWdBQVJBQWtCQkFDRUFBMEFnQUVHQWlSMU9EUUVnQUVHQWtBUnFRZjhCT2dBQUlBQkJBV29oQUF3QUFBc0FDd3NMaUFFQkFYOGp0Z0VoQVNBQVFZQUJjVUVBUnlTMkFTQUFRY0FBY1VFQVJ5UzNBU0FBUVNCeFFRQkhKTGdCSUFCQkVIRkJBRWNrdVFFZ0FFRUljVUVBUnlTNkFTQUFRUVJ4UVFCSEpMc0JJQUJCQW5GQkFFY2t2QUVnQUVFQmNVRUFSeVM5QVNPMkFVVWdBU0FCR3dSQVFRRVFIUXNnQVVVaUFBUi9JN1lCQlNBQUN3UkFRUUFRSFFzTFBnQUNmMEVCUWVRSUxRQUFRUUJLRFFBYVFRQUxKSmtCQW45QkFVSGxDQzBBQUVFQVNnMEFHa0VBQ3lTYUFVSC8vd01RQVJBT1FZLytBeEFCRUE4THBRRUFRY2dKTHdFQUpEaEJ5Z2t2QVFBa1BBSi9RUUZCekFrdEFBQkJBRW9OQUJwQkFBc2tUZ0ovUVFGQnpRa3RBQUJCQUVvTkFCcEJBQXNrVHdKL1FRRkJ6Z2t0QUFCQkFFb05BQnBCQUFza1VBSi9RUUZCendrdEFBQkJBRW9OQUJwQkFBc2tVUUovUVFGQjBBa3RBQUJCQUVvTkFCcEJBQXNrVWdKL1FRRkIwUWt0QUFCQkFFb05BQnBCQUFza1V3Si9RUUZCMGdrdEFBQkJBRW9OQUJwQkFBc2tPUXRiQUVINkNTZ0NBQ1NGQVVIK0NTZ0NBQ1NHQVFKL1FRRkJnZ290QUFCQkFFb05BQnBCQUFza2l3RUNmMEVCUVlVS0xRQUFRUUJLRFFBYVFRQUxKSXdCUVlYK0F4QUJKSWNCUVliK0F4QUJKSWdCUVlmK0F4QUJKSW9CQ3dZQVFRQWthZ3QyQUFKL1FRRkIzZ290QUFCQkFFb05BQnBCQUFza213RkIzd29vQWdBa25BRkI0d29vQWdBa25RRkI1d29vQWdBa25nRkI3QW9vQWdBa253RkI4UW90QUFBa29BRkI4Z290QUFBa29RRUNmMEVCUWZjS0xRQUFRUUJLRFFBYVFRQUxKS0lCUWZnS0tBSUFKS01CUWYwS0x3RUFKS1FCQzA0QUFuOUJBVUdRQ3kwQUFFRUFTZzBBR2tFQUN5U2xBVUdSQ3lnQ0FDU21BVUdWQ3lnQ0FDU25BVUdaQ3lnQ0FDU29BVUdlQ3lnQ0FDU3BBVUdqQ3kwQUFDU3FBVUdrQ3kwQUFDU3JBUXRGQUFKL1FRRkI5QXN0QUFCQkFFb05BQnBCQUFza3NBRkI5UXNvQWdBa3NRRkIrUXNvQWdBa3NnRkIvUXNvQWdBa3N3RkJnZ3dvQWdBa3RBRkJod3d2QVFBa3RRRUwwQUVCQVg4UUhFR3lDQ2dDQUNSVlFiWUlMUUFBSkpnQlFjVCtBeEFCSkZaQndQNERFQUVRSGhBZlFZRCtBeEFCUWY4QmN5UytBU08rQVNJQVFSQnhRUUJISkw4QklBQkJJSEZCQUVja3dBRVFJQkFoUWF3S0tBSUFKR2RCc0FvdEFBQWthRUd4Q2kwQUFDUnBRUUFrYWhBakVDUUNmMEVCUWNJTExRQUFRUUJLRFFBYVFRQUxKS3dCUWNNTEtBSUFKSzBCUWNjTEtBSUFKSzRCUWNzTEx3RUFKSzhCRUNWQkFDUXRRWUNvMXJrSEpKSUJRUUFra3dGQkFDU1VBVUdBcU5hNUJ5U1ZBVUVBSkpZQlFRQWtsd0VMREFBak9nUkFRUUVQQzBFQUN3VUFJNVVCQ3dVQUk1WUJDd1VBSTVjQkM5Z0NBUVYvQW44Q2Z5QUJRUUJLSWdVRVFDQUFRUWhLSVFVTElBVUxCRUFqd2dFZ0JFWWhCUXNnQlFzRWZ5UERBU0FBUmdVZ0JRc0VRRUVBSVFWQkFDRUVJQU5CQVdzUUFVRWdjUVJBUVFFaEJRc2dBeEFCUVNCeEJFQkJBU0VFQzBFQUlRTURRQ0FEUVFoSUJFQkJCeUFEYXlBRElBUWdCVWNiSWdNZ0FHcEJvQUZNQkVBZ0FFRUlJQU5yYXlFSElBQWdBMm9nQVVHZ0FXeHFRUU5zUVlESkJXb2hDVUVBSVFZRFFDQUdRUU5JQkVBZ0FDQURhaUFCUWFBQmJHcEJBMnhCZ01rRmFpQUdhaUFHSUFscUxRQUFPZ0FBSUFaQkFXb2hCZ3dCQ3dzZ0FDQURhaUFCUWFBQmJHcEJnSkVFYWlBQlFhQUJiQ0FIYWtHQWtRUnFMUUFBSWdaQkEzRWlCMEVFY2lBSElBWkJCSEViT2dBQUlBaEJBV29oQ0FzZ0EwRUJhaUVEREFFTEN3VWdCQ1RDQVFzZ0FDUERBVTRFUUNBQVFRaHFKTU1CSUFBZ0FrRUlieUlFU0FSQUk4TUJJQVJxSk1NQkN3c2dDQXM0QVFGL0lBQkJnSkFDUmdSQUlBRkJnQUZxSVFJZ0FVR0FBWEVFUUNBQlFZQUJheUVDQ3lBQ1FRUjBJQUJxRHdzZ0FVRUVkQ0FBYWd0S0FDQUFRUU4wSUFGQkFYUnFJZ0JCQVdwQlAzRWlBVUZBYXlBQklBSWJRWUNRQkdvdEFBQWhBU0FBUVQ5eElnQkJRR3NnQUNBQ0cwR0FrQVJxTFFBQUlBRkIvd0Z4UVFoMGNndFJBQ0FDUlFSQUlBRVFBU0FBUVFGMGRVRURjU0VBQzBIeUFTRUJBa0FnQUVVTkFBSkFBa0FDUUFKQUlBQkJBV3NPQXdFQ0F3QUxEQU1MUWFBQklRRU1BZ3RCMkFBaEFRd0JDMEVJSVFFTElBRUxpd01CQm44Z0FTQUFFQ3dnQlVFQmRHb2lBRUdBa0g1cUlBSkJBWEZCRFhRaUFXb3RBQUFoRVNBQVFZR1FmbW9nQVdvdEFBQWhFaUFESVFBRFFDQUFJQVJNQkVBZ0FDQURheUFHYWlJT0lBaElCRUJCQnlBQWF5RUZJQXRCQUVnaUFnUi9JQUlGSUF0QklIRkZDeUVCUVFBaEFnSi9RUUVnQlNBQUlBRWJJZ0YwSUJKeEJFQkJBaUVDQ3lBQ1FRRnFDeUFDUVFFZ0FYUWdFWEViSVFJak9nUi9JQXRCQUU0aUFRUi9JQUVGSUF4QkFFNExCU002Q3dSL0lBdEJCM0VoQlNBTVFRQk9JZ0VFUUNBTVFRZHhJUVVMSUFVZ0FpQUJFQzBpQlVFZmNVRURkQ0VQSUFWQjRBZHhRUVYxUVFOMElRRWdCVUdBK0FGeFFRcDFRUU4wQlNBQ1FjZitBeUFLSUFwQkFFd2JJZ3BCQUJBdUlnVWhEeUFGSWdFTElRVWdCeUFJYkNBT2FrRURiQ0FKYWlJUUlBODZBQUFnRUVFQmFpQUJPZ0FBSUJCQkFtb2dCVG9BQUNBSFFhQUJiQ0FPYWtHQWtRUnFJQUpCQTNFaUFVRUVjaUFCSUF0QmdBRnhRUUJIUVFBZ0MwRUFUaHNiT2dBQUlBMUJBV29oRFFzZ0FFRUJhaUVBREFFTEN5QU5DNEFCQVFOL0lBTkJDRzhoQXlBQVJRUkFJQUlnQWtFSWJVRURkR3NoQnd0Qm9BRWdBR3RCQnlBQVFRaHFRYUFCU2hzaENVRi9JUUlqT2dSQUlBUkJnTkIrYWkwQUFDSUNRUWh4QkVCQkFTRUlDeUFDUWNBQWNRUkFRUWNnQTJzaEF3c0xJQVlnQlNBSUlBY2dDU0FESUFBZ0FVR2dBVUdBeVFWQkFDQUNRWDhRTHd1bUFnQWdCU0FHRUN3aEJpQURRUWh2SVFNZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUWdCbW9pQTBHQWtINXFRUUZCQUNBRVFRaHhHMEVCY1VFTmRDSUZhaTBBQUNFR0lBTkJnWkIrYWlBRmFpMEFBQ0VGSUFKQkNHOGhBMEVBSVFJZ0FVR2dBV3dnQUdwQkEyeEJnTWtGYWlBRVFRZHhBbjlCQVNBRFFRY2dBMnNnQkVFZ2NSc2lBM1FnQlhFRVFFRUNJUUlMSUFKQkFXb0xJQUpCQVNBRGRDQUdjUnNpQWtFQUVDMGlBMEVmY1VFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQnlRVnFJQU5CNEFkeFFRVjFRUU4wT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUxKQldvZ0EwR0ErQUZ4UVFwMVFRTjBPZ0FBSUFGQm9BRnNJQUJxUVlDUkJHb2dBa0VEY1NJQVFRUnlJQUFnQkVHQUFYRWJPZ0FBQzdVQkFDQUVJQVVRTENBRFFRaHZRUUYwYWlJRVFZQ1FmbW90QUFBaEJVRUFJUU1nQVVHZ0FXd2dBR3BCQTJ4QmdNa0ZhZ0ovSUFSQmdaQithaTBBQUVFQlFRY2dBa0VJYjJzaUFuUnhCRUJCQWlFREN5QURRUUZxQ3lBRFFRRWdBblFnQlhFYklnTkJ4LzREUVFBUUxpSUNPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZSEpCV29nQWpvQUFDQUJRYUFCYkNBQWFrRURiRUdDeVFWcUlBSTZBQUFnQVVHZ0FXd2dBR3BCZ0pFRWFpQURRUU54T2dBQUM5VUJBUVovSUFOQkEzVWhDd05BSUFSQm9BRklCRUFnQkNBRmFpSUdRWUFDVGdSQUlBWkJnQUpySVFZTElBdEJCWFFnQW1vZ0JrRURkV29pQ1VHQWtINXFMUUFBSVFoQkFDRUtJellFUUNBRUlBQWdCaUFKSUFnUUt5SUhRUUJLQkVCQkFTRUtJQWRCQVdzZ0JHb2hCQXNMSUFwRkl6VWlCeUFIR3dSQUlBUWdBQ0FHSUFNZ0NTQUJJQWdRTUNJSFFRQktCRUFnQjBFQmF5QUVhaUVFQ3dVZ0NrVUVRQ002QkVBZ0JDQUFJQVlnQXlBSklBRWdDQkF4QlNBRUlBQWdCaUFESUFFZ0NCQXlDd3NMSUFSQkFXb2hCQXdCQ3dzTEt3RUJmeU5YSVFNZ0FDQUJJQUlqV0NBQWFpSUFRWUFDVGdSL0lBQkJnQUpyQlNBQUMwRUFJQU1RTXdzd0FRTi9JMWtoQXlBQUkxb2lCRWdFUUE4TElBTkJCMnNpQTBGL2JDRUZJQUFnQVNBQ0lBQWdCR3NnQXlBRkVETUx4QVVCRDM4Q1FFRW5JUWtEUUNBSlFRQklEUUVnQ1VFQ2RDSUVRWUQ4QTJvUUFTRUNJQVJCZ2Z3RGFoQUJJUW9nQkVHQy9BTnFFQUVoQXlBQ1FSQnJJUUlnQ2tFSWF5RUtRUWdoQlNBQkJFQkJFQ0VGSUFOQkFtOUJBVVlFZnlBRFFRRnJCU0FEQ3lFREN5QUFJQUpPSWdZRVFDQUFJQUlnQldwSUlRWUxJQVlFUUNBRVFZUDhBMm9RQVNJR1FZQUJjVUVBUnlFTElBWkJJSEZCQUVjaERrR0FnQUlnQXhBc0lBQWdBbXNpQWlBRmEwRi9iRUVCYXlBQ0lBWkJ3QUJ4RzBFQmRHb2lBMEdBa0g1cVFRRkJBQ0FHUVFoeFFRQkhJem9pQWlBQ0d4dEJBWEZCRFhRaUFtb3RBQUFoRHlBRFFZR1FmbW9nQW1vdEFBQWhFRUVISVFVRFFDQUZRUUJPQkVCQkFDRUlBbjlCQVNBRklnSkJCMnRCZjJ3Z0FpQU9HeUlDZENBUWNRUkFRUUloQ0FzZ0NFRUJhZ3NnQ0VFQklBSjBJQTl4R3lJSUJFQkJCeUFGYXlBS2FpSUhRUUJPSWdJRVFDQUhRYUFCVENFQ0N5QUNCRUJCQUNFTVFRQWhEVUVCUVFBanZRRkZJem9pQXlBREd4c2lBa1VFUUNBQVFhQUJiQ0FIYWtHQWtRUnFMUUFBSWdOQkEzRWlCRUVBU2lBTElBc2JCRUJCQVNFTUJTQURRUVJ4UVFCSEl6b2lBeUFER3lJREJFQWdCRUVBU2lFREMwRUJRUUFnQXhzaERRc0xJQUpGQkVBZ0RFVWlCQVIvSUExRkJTQUVDeUVDQ3lBQ0JFQWpPZ1JBSUFCQm9BRnNJQWRxUVFOc1FZREpCV29nQmtFSGNTQUlRUUVRTFNJRVFSOXhRUU4wT2dBQUlBQkJvQUZzSUFkcVFRTnNRWUhKQldvZ0JFSGdCM0ZCQlhWQkEzUTZBQUFnQUVHZ0FXd2dCMnBCQTJ4Qmdza0ZhaUFFUVlENEFYRkJDblZCQTNRNkFBQUZJQUJCb0FGc0lBZHFRUU5zUVlESkJXb2dDRUhKL2dOQnlQNERJQVpCRUhFYlFRQVFMaUlET2dBQUlBQkJvQUZzSUFkcVFRTnNRWUhKQldvZ0F6b0FBQ0FBUWFBQmJDQUhha0VEYkVHQ3lRVnFJQU02QUFBTEN3c0xJQVZCQVdzaEJRd0JDd3NMSUFsQkFXc2hDUXdBQUFzQUN3dG1BUUovUVlDUUFpRUJRWUNBQWtHQWtBSWp1UUViSVFFak9pTzlBU002R3dSQVFZQ3dBaUVDSUFBZ0FVR0F1QUpCZ0xBQ0k3b0JHeEEwQ3lPNEFRUkFRWUN3QWlFQ0lBQWdBVUdBdUFKQmdMQUNJN2NCR3hBMUN5TzhBUVJBSUFBanV3RVFOZ3NMSlFFQmZ3SkFBMEFnQUVHUUFVc05BU0FBUWY4QmNSQTNJQUJCQVdvaEFBd0FBQXNBQ3d0R0FRSi9BMEFnQVVHUUFVNUZCRUJCQUNFQUEwQWdBRUdnQVVnRVFDQUJRYUFCYkNBQWFrR0FrUVJxUVFBNkFBQWdBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMQ3gwQkFYOUJqLzRERUFGQkFTQUFkSElpQVNTRUFVR1AvZ01nQVJBRUN3c0FRUUVrZ0FGQkFSQTZDMFVCQW45QmxQNERFQUZCK0FGeElRRkJrLzRESUFCQi93RnhJZ0lRQkVHVS9nTWdBU0FBUVFoMUlnQnlFQVFnQWlUUEFTQUFKTkFCSTg4Qkk5QUJRUWgwY2lUUkFRdG1BUUovSTZRQklnRWp6UUYxSVFBZ0FTQUFheUFBSUFGcUk4NEJHeUlBUWY4UFRDSUJCSDhqelFGQkFFb0ZJQUVMQkVBZ0FDU2tBU0FBRUR3anBBRWlBU1BOQVhVaEFDQUJJQUJySUFBZ0FXb2p6Z0ViSVFBTElBQkIvdzlLQkVCQkFDU2JBUXNMTEFBam93RkJBV3Nrb3dFam93RkJBRXdFUUNQTUFTU2pBU1BNQVVFQVNpT2lBU09pQVJzRVFCQTlDd3NMV3dFQmZ5T2RBVUVCYXlTZEFTT2RBVUVBVEFSQUk5SUJKSjBCSTUwQkJFQWpud0ZCRDBnajB3RWowd0ViQkVBam53RkJBV29rbndFRkk5TUJSU0lBQkVBam53RkJBRW9oQUFzZ0FBUkFJNThCUVFGckpKOEJDd3NMQ3d0YkFRRi9JNmNCUVFGckpLY0JJNmNCUVFCTUJFQWoxQUVrcHdFanB3RUVRQ09wQVVFUFNDUFZBU1BWQVJzRVFDT3BBVUVCYWlTcEFRVWoxUUZGSWdBRVFDT3BBVUVBU2lFQUN5QUFCRUFqcVFGQkFXc2txUUVMQ3dzTEMxc0JBWDhqc2dGQkFXc2tzZ0Vqc2dGQkFFd0VRQ1BXQVNTeUFTT3lBUVJBSTdRQlFROUlJOWNCSTljQkd3UkFJN1FCUVFGcUpMUUJCU1BYQVVVaUFBUkFJN1FCUVFCS0lRQUxJQUFFUUNPMEFVRUJheVMwQVFzTEN3c0xqZ1lBSTJjZ0FHb2taeU5uSXo0RWYwR0FnQUVGUVlEQUFBdE9CRUFqWnlNK0JIOUJnSUFCQlVHQXdBQUxheVJuQWtBQ1FBSkFBa0FDUUNOcElnQUVRQ0FBUVFKckRnWUJCUUlGQXdRRkN5T2VBVUVBU2lJQUJIOGp5QUVGSUFBTEJFQWpuZ0ZCQVdza25nRUxJNTRCUlFSQVFRQWttd0VMSTZnQlFRQktJZ0FFZnlQSkFRVWdBQXNFUUNPb0FVRUJheVNvQVFzanFBRkZCRUJCQUNTbEFRc2pyZ0ZCQUVvaUFBUi9JOG9CQlNBQUN3UkFJNjRCUVFGckpLNEJDeU91QVVVRVFFRUFKS3dCQ3lPekFVRUFTaUlBQkg4anl3RUZJQUFMQkVBanN3RkJBV3Nrc3dFTEk3TUJSUVJBUVFBa3NBRUxEQVFMSTU0QlFRQktJZ0FFZnlQSUFRVWdBQXNFUUNPZUFVRUJheVNlQVFzam5nRkZCRUJCQUNTYkFRc2pxQUZCQUVvaUFBUi9JOGtCQlNBQUN3UkFJNmdCUVFGckpLZ0JDeU9vQVVVRVFFRUFKS1VCQ3lPdUFVRUFTaUlBQkg4anlnRUZJQUFMQkVBanJnRkJBV3NrcmdFTEk2NEJSUVJBUVFBa3JBRUxJN01CUVFCS0lnQUVmeVBMQVFVZ0FBc0VRQ096QVVFQmF5U3pBUXNqc3dGRkJFQkJBQ1N3QVFzUVBnd0RDeU9lQVVFQVNpSUFCSDhqeUFFRklBQUxCRUFqbmdGQkFXc2tuZ0VMSTU0QlJRUkFRUUFrbXdFTEk2Z0JRUUJLSWdBRWZ5UEpBUVVnQUFzRVFDT29BVUVCYXlTb0FRc2pxQUZGQkVCQkFDU2xBUXNqcmdGQkFFb2lBQVIvSThvQkJTQUFDd1JBSTY0QlFRRnJKSzRCQ3lPdUFVVUVRRUVBSkt3QkN5T3pBVUVBU2lJQUJIOGp5d0VGSUFBTEJFQWpzd0ZCQVdza3N3RUxJN01CUlFSQVFRQWtzQUVMREFJTEk1NEJRUUJLSWdBRWZ5UElBUVVnQUFzRVFDT2VBVUVCYXlTZUFRc2puZ0ZGQkVCQkFDU2JBUXNqcUFGQkFFb2lBQVIvSThrQkJTQUFDd1JBSTZnQlFRRnJKS2dCQ3lPb0FVVUVRRUVBSktVQkN5T3VBVUVBU2lJQUJIOGp5Z0VGSUFBTEJFQWpyZ0ZCQVdza3JnRUxJNjRCUlFSQVFRQWtyQUVMSTdNQlFRQktJZ0FFZnlQTEFRVWdBQXNFUUNPekFVRUJheVN6QVFzanN3RkZCRUJCQUNTd0FRc1FQZ3dCQ3hBL0VFQVFRUXNqYVVFQmFpUnBJMmxCQ0U0RVFFRUFKR2tMUVFFUEMwRUFDNE1CQVFGL0FrQUNRQUpBQWtBZ0FFRUJSd1JBSUFBaUFVRUNSZzBCSUFGQkEwWU5BaUFCUVFSR0RRTU1CQXNqY0NQWkFVY0VRQ1BaQVNSd1FRRVBDMEVBRHdzamNTUGFBVWNFUUNQYUFTUnhRUUVQQzBFQUR3c2pjaVBiQVVjRVFDUGJBU1J5UVFFUEMwRUFEd3NqY3lQY0FVY0VRQ1BjQVNSelFRRVBDMEVBRHd0QkFBdFZBQUpBQWtBQ1FDQUFRUUZIQkVBZ0FFRUNSZzBCSUFCQkEwWU5BZ3dEQzBFQklBRjBRWUVCY1VFQVJ3OExRUUVnQVhSQmh3RnhRUUJIRHd0QkFTQUJkRUgrQUhGQkFFY1BDMEVCSUFGMFFRRnhRUUJIQzRvQkFRRi9JNXdCSUFCckpKd0JJNXdCUVFCTUJFQWpuQUVpQVVFZmRTRUFRWUFRSTlFQmEwRUNkQ1NjQVNNK0JFQWpuQUZCQVhRa25BRUxJNXdCSUFBZ0FXb2dBSE5ySkp3Qkk2RUJRUUZxSktFQkk2RUJRUWhPQkVCQkFDU2hBUXNMSTlrQkk1c0JJZ0FnQUJzRWZ5T2ZBUVZCRHc4TEkrQUJJNkVCRUVRRWYwRUJCVUYvQzJ4QkQyb0xpZ0VCQVg4anBnRWdBR3NrcGdFanBnRkJBRXdFUUNPbUFTSUJRUjkxSVFCQmdCQWo0UUZyUVFKMEpLWUJJejRFUUNPbUFVRUJkQ1NtQVFzanBnRWdBQ0FCYWlBQWMyc2twZ0VqcXdGQkFXb2txd0VqcXdGQkNFNEVRRUVBSktzQkN3c2oyZ0VqcFFFaUFDQUFHd1IvSTZrQkJVRVBEd3NqNGdFanF3RVFSQVIvUVFFRlFYOExiRUVQYWd1WkFnRUNmeU90QVNBQWF5U3RBU090QVVFQVRBUkFJNjBCSWdKQkgzVWhBRUdBRUNQakFXdEJBWFFrclFFalBnUkFJNjBCUVFGMEpLMEJDeU90QVNBQUlBSnFJQUJ6YXlTdEFTT3ZBVUVCYWlTdkFTT3ZBVUVnVGdSQVFRQWtyd0VMQzBFQUlRSWo1QUVoQUNQYkFTT3NBU0lCSUFFYkJFQWphd1JBUVp6K0F4QUJRUVYxUVE5eElnQWs1QUZCQUNSckN3VkJEdzhMSTY4QlFRSnRRYkQrQTJvUUFTRUJJNjhCUVFKdkJIOGdBVUVQY1FVZ0FVRUVkVUVQY1FzaEFRSkFBa0FDUUFKQUlBQUVRQ0FBUVFGR0RRRWdBRUVDUmcwQ0RBTUxJQUZCQkhVaEFRd0RDMEVCSVFJTUFnc2dBVUVCZFNFQlFRSWhBZ3dCQ3lBQlFRSjFJUUZCQkNFQ0N5QUNRUUJLQkg4Z0FTQUNiUVZCQUF0QkQyb0xxd0VCQVg4anNRRWdBR3Nrc1FFanNRRkJBRXdFUUNPeEFTRUFJK1VCSStZQmRDSUJRUUYwSUFFalBoc2tzUUVqc1FFZ0FFRWZkU0lCSUFBZ0FXcHpheVN4QVNPMUFTSUFRUUZ4SVFFZ0FFRUJkU0lBSkxVQkk3VUJJQUVnQUVFQmNYTWlBVUVPZEhJa3RRRWo1d0VFUUNPMUFVRy9mM0VrdFFFanRRRWdBVUVHZEhJa3RRRUxDeVBjQVNPd0FTSUFJQUFiQkg4anRBRUZRUThQQzBGL1FRRWp0UUZCQVhFYmJFRVBhZ3N3QUNBQVFUeEdCRUJCL3dBUEN5QUFRVHhyUWFDTkJtd2dBV3hCQ0cxQm9JMEdiVUU4YWtHZ2pRWnNRWXp4QW0wTG5BRUJBWDlCQUNSMklBQkJEeU5lR3lJRUlBRnFJQVJCRDJvalh4c2lCQ0FDYWlBRVFROXFJMkFiSVFRZ0F5QUNJQUVnQUVFUEkySWJJZ0JxSUFCQkQyb2pZeHNpQUdvZ0FFRVBhaU5rR3lJQWFpQUFRUTlxSTJVYklRQkJBQ1IzUVFBa2VDQURJQVJxSUFSQkQyb2pZUnNqWEVFQmFoQkpJUUVnQUNOZFFRRnFFRWtoQUNBQkpIUWdBQ1IxSUFCQi93RnhJQUZCL3dGeFFRaDBjZ3ZEQXdFRmZ3Si9JOWdCSUFCcUpOZ0JRUUFqbkFFajJBRnJRUUJLRFFBYVFRRUxJZ0ZGQkVCQkFSQkRJUUVMQW44ajNRRWdBR29rM1FGQkFDT21BU1BkQVd0QkFFb05BQnBCQVFzaUJFVUVRRUVDRUVNaEJBc0NmeVBlQVNBQWFpVGVBU090QVNQZUFXdEJBRW9pQWdSQUkydEZJUUlMUVFBZ0FnMEFHa0VCQ3lJQ1JRUkFRUU1RUXlFQ0N3Si9JOThCSUFCcUpOOEJRUUFqc1FFajN3RnJRUUJLRFFBYVFRRUxJZ1ZGQkVCQkJCQkRJUVVMSUFFRVFDUFlBU0VEUVFBazJBRWdBeEJGSkd3TElBUUVRQ1BkQVNFRFFRQWszUUVnQXhCR0pHMExJQUlFUUNQZUFTRURRUUFrM2dFZ0F4QkhKRzRMSUFVRVFDUGZBU0VEUVFBazN3RWdBeEJJSkc4TEFuOGdBU0FFSUFFYklnRkZCRUFnQWlFQkN5QUJSUXNFUUNBRklRRUxJQUVFUUVFQkpIZ0xJMmdqNkFFZ0FHeHFKR2dqYUVHQWdJQUVRWUNBZ0FJalBodE9CRUFqYUVHQWdJQUVRWUNBZ0FJalBodHJKR2dqZUNJQUkzWWdBQnNpQVVVRVFDTjNJUUVMSUFFRVFDTnNJMjBqYmlOdkVFb2FDeU5xSWdGQkFYUkJnSm5CQUdvaUFDTjBRUUpxT2dBQUlBQkJBV29qZFVFQ2Fqb0FBQ0FCUVFGcUpHb2phaVBwQVVFQ2JVRUJhMDRFUUNOcVFRRnJKR29MQ3d1Y0F3RUZmeUFBRUVVaEFpQUFFRVloQVNBQUVFY2hBeUFBRUVnaEJDQUNKR3dnQVNSdElBTWtiaUFFSkc4amFDUG9BU0FBYkdva2FDTm9RWUNBZ0FSQmdJQ0FBaU0rRzA0RVFDTm9RWUNBZ0FSQmdJQ0FBaU0rRzJza2FDQUNJQUVnQXlBRUVFb2hBQ05xUVFGMFFZQ1p3UUJxSWdVZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFWQkFXb2dBRUgvQVhGQkFtbzZBQUFqTndSQUlBSkJEMEVQUVE4UVNpRUFJMnBCQVhSQmdKa2hhaUlDSUFCQmdQNERjVUVJZFVFQ2Fqb0FBQ0FDUVFGcUlBQkIvd0Z4UVFKcU9nQUFRUThnQVVFUFFROFFTaUVBSTJwQkFYUkJnSmtwYWlJQklBQkJnUDREY1VFSWRVRUNham9BQUNBQlFRRnFJQUJCL3dGeFFRSnFPZ0FBUVE5QkR5QURRUThRU2lFQUkycEJBWFJCZ0preGFpSUJJQUJCZ1A0RGNVRUlkVUVDYWpvQUFDQUJRUUZxSUFCQi93RnhRUUpxT2dBQVFROUJEMEVQSUFRUVNpRUFJMnBCQVhSQmdKazVhaUlCSUFCQmdQNERjVUVJZFVFQ2Fqb0FBQ0FCUVFGcUlBQkIvd0Z4UVFKcU9nQUFDeU5xUVFGcUpHb2phaVBwQVVFQ2JVRUJhMDRFUUNOcVFRRnJKR29MQ3dzZUFRRi9JQUFRUWlFQklBRkZJelFqTkJzRVFDQUFFRXNGSUFBUVRBc0xTd0FqV3lNK0JIOUJyZ0VGUWRjQUMwZ0VRQThMQTBBald5TStCSDlCcmdFRlFkY0FDMDRFUUNNK0JIOUJyZ0VGUWRjQUN4Qk5JMXNqUGdSL1FhNEJCVUhYQUF0ckpGc01BUXNMQ3lFQUlBQkJwdjREUmdSQVFhYitBeEFCUVlBQmNTRUFJQUJCOEFCeUR3dEJmd3VjQVFFQmZ5TytBU0VBSTc4QkJFQWdBRUY3Y1NBQVFRUnlJK29CR3lFQUlBQkJmbkVnQUVFQmNpUHJBUnNoQUNBQVFYZHhJQUJCQ0hJajdBRWJJUUFnQUVGOWNTQUFRUUp5SSswQkd5RUFCU1BBQVFSQUlBQkJmbkVnQUVFQmNpUHVBUnNoQUNBQVFYMXhJQUJCQW5Jajd3RWJJUUFnQUVGN2NTQUFRUVJ5SS9BQkd5RUFJQUJCZDNFZ0FFRUljaVB4QVJzaEFBc0xJQUJCOEFGeUM4OENBUUYvSUFCQmdJQUNTQVJBUVg4UEN5QUFRWUNBQWs0aUFRUi9JQUJCZ01BQ1NBVWdBUXNFUUVGL0R3c2dBRUdBd0FOT0lnRUVmeUFBUVlEOEEwZ0ZJQUVMQkVBZ0FFR0FRR29RQVE4TElBQkJnUHdEVGlJQkJIOGdBRUdmL1FOTUJTQUJDd1JBSTVnQlFRSklCRUJCL3dFUEMwRi9Ed3NnQUVITi9nTkdCRUJCL3dFaEFVSE4vZ01RQVVFQmNVVUVRRUgrQVNFQkN5TStSUVJBSUFGQi8zNXhJUUVMSUFFUEN5QUFRY1QrQTBZRVFDQUFJMVlRQkNOV0R3c2dBRUdRL2dOT0lnRUVmeUFBUWFiK0Ewd0ZJQUVMQkVBUVRpQUFFRThQQ3lBQVFiRCtBMDRpQVFSL0lBQkJ2LzREVEFVZ0FRc0VRQkJPUVg4UEN5QUFRWVQrQTBZRVFDQUFJNFlCUVlEK0EzRkJDSFVpQVJBRUlBRVBDeUFBUVlYK0EwWUVRQ0FBSTRjQkVBUWpod0VQQ3lBQVFZLytBMFlFUUNPRUFVSGdBWElQQ3lBQVFZRCtBMFlFUUJCUUR3dEJmd3NiQVFGL0lBQVFVU0lCUVg5R0JFQWdBQkFCRHdzZ0FVSC9BWEVMdGdJQkFYOGpVQVJBRHdzZ0FFSC9QMHdFUUNOU0JIOGdBVUVRY1VVRkkxSUxSUVJBSUFGQkQzRWlBZ1JBSUFKQkNrWUVRRUVCSkU0TEJVRUFKRTRMQ3dVZ0FFSC8vd0JNQkVBak9VVWlBZ1IvSUFJRklBQkIvOThBVEFzRVFDTlNCRUFnQVVFUGNTUTRDeUFCSVFJalVRUkFJQUpCSDNFaEFpTTRRZUFCY1NRNEJTTlRCRUFnQWtIL0FIRWhBaU00UVlBQmNTUTRCU001QkVCQkFDUTRDd3NMSXpnZ0FuSWtPQVVqT0VIL0FYRkJBVUVBSUFGQkFFb2JRZjhCY1VFSWRISWtPQXNGSTFKRklnSUVmeUFBUWYrL0FVd0ZJQUlMQkVBalR5TlJJZ0FnQUJzRVFDTTRRUjl4SkRnak9DQUJRZUFCY1hJa09BOExJQUZCRDNFZ0FVRURjU001R3lROEJTTlNSU0lDQkg4Z0FFSC8vd0ZNQlNBQ0N3UkFJMUVFUUNBQlFRRnhCRUJCQVNSUEJVRUFKRThMQ3dzTEN3c0xMQUFnQUVFRWRVRVBjU1QyQVNBQVFRaHhRUUJISk5NQklBQkJCM0VrMGdFZ0FFSDRBWEZCQUVvazJRRUxMQUFnQUVFRWRVRVBjU1QzQVNBQVFRaHhRUUJISk5VQklBQkJCM0VrMUFFZ0FFSDRBWEZCQUVvazJnRUxMQUFnQUVFRWRVRVBjU1Q1QVNBQVFRaHhRUUJISk5jQklBQkJCM0VrMWdFZ0FFSDRBWEZCQUVvazNBRUxnUUVCQVg4Z0FFRUVkU1RtQVNBQVFRaHhRUUJISk9jQklBQkJCM0VrL2dFQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSS80QklnRUVRQ0FCUVFGckRnY0JBZ01FQlFZSENBdEJDQ1RsQVE4TFFSQWs1UUVQQzBFZ0pPVUJEd3RCTUNUbEFROExRY0FBSk9VQkR3dEIwQUFrNVFFUEMwSGdBQ1RsQVE4TFFmQUFKT1VCQ3d1REFRRUJmMEVCSkpzQkk1NEJSUVJBUWNBQUpKNEJDMEdBRUNQUkFXdEJBblFrbkFFalBnUkFJNXdCUVFGMEpKd0JDeVBTQVNTZEFTUDJBU1NmQVNQUkFTU2tBU1BNQVNJQUpLTUJJQUJCQUVvaUFBUi9JODBCUVFCS0JTQUFDd1JBUVFFa29nRUZRUUFrb2dFTEk4MEJRUUJLQkVBUVBRc2oyUUZGQkVCQkFDU2JBUXNMUndCQkFTU2xBU09vQVVVRVFFSEFBQ1NvQVF0QmdCQWo0UUZyUVFKMEpLWUJJejRFUUNPbUFVRUJkQ1NtQVFzajFBRWtwd0VqOXdFa3FRRWoyZ0ZGQkVCQkFDU2xBUXNMUUFCQkFTU3NBU091QVVVRVFFR0FBaVN1QVF0QmdCQWo0d0ZyUVFGMEpLMEJJejRFUUNPdEFVRUJkQ1N0QVF0QkFDU3ZBU1BiQVVVRVFFRUFKS3dCQ3d0SkFRRi9RUUVrc0FFanN3RkZCRUJCd0FBa3N3RUxJK1VCSStZQmRDSUFRUUYwSUFBalBoc2tzUUVqMWdFa3NnRWorUUVrdEFGQi8vOEJKTFVCSTl3QlJRUkFRUUFrc0FFTEMxUUFJQUJCZ0FGeFFRQkhKR0VnQUVIQUFIRkJBRWNrWUNBQVFTQnhRUUJISkY4Z0FFRVFjVUVBUnlSZUlBQkJDSEZCQUVja1pTQUFRUVJ4UVFCSEpHUWdBRUVDY1VFQVJ5UmpJQUJCQVhGQkFFY2tZZ3VJQlFFQmZ5QUFRYWIrQTBjaUFnUkFJMlpGSVFJTElBSUVRRUVBRHdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnSkJrUDREUndSQUlBSkJrZjREYXc0V0FnWUtEaFVEQndzUEFRUUlEQkFWQlFrTkVSSVRGQlVMSUFGQjhBQnhRUVIxSk13QklBRkJDSEZCQUVja3pnRWdBVUVIY1NUTkFRd1ZDeUFCUVlBQmNVRUFSeVRiQVF3VUN5QUJRUVoxUVFOeEpPQUJJQUZCUDNFazhnRkJ3QUFqOGdGckpKNEJEQk1MSUFGQkJuVkJBM0VrNGdFZ0FVRS9jU1R6QVVIQUFDUHpBV3NrcUFFTUVnc2dBU1QwQVVHQUFpUDBBV3NrcmdFTUVRc2dBVUUvY1NUMUFVSEFBQ1AxQVdza3N3RU1FQXNnQVJCVURBOExJQUVRVlF3T0MwRUJKR3NnQVVFRmRVRVBjU1Q0QVF3TkN5QUJFRllNREFzZ0FTVFBBU1BQQVNQUUFVRUlkSElrMFFFTUN3c2dBU1Q2QVNQNkFTUDdBVUVJZEhJazRRRU1DZ3NnQVNUOEFTUDhBU1A5QVVFSWRISWs0d0VNQ1FzZ0FSQlhEQWdMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNreUFFZ0FVRUhjU1RRQVNQUEFTUFFBVUVJZEhJazBRRVFXQXNNQndzZ0FVR0FBWEVFUUNBQlFjQUFjVUVBUnlUSkFTQUJRUWR4SlBzQkkvb0JJL3NCUVFoMGNpVGhBUkJaQ3d3R0N5QUJRWUFCY1FSQUlBRkJ3QUJ4UVFCSEpNb0JJQUZCQjNFay9RRWovQUVqL1FGQkNIUnlKT01CRUZvTERBVUxJQUZCZ0FGeEJFQWdBVUhBQUhGQkFFY2t5d0VRV3dzTUJBc2dBVUVFZFVFSGNTUmNJQUZCQjNFa1hVRUJKSFlNQXdzZ0FSQmNRUUVrZHd3Q0N5QUJRWUFCY1VFQVJ5Um1JQUZCZ0FGeFJRUkFBa0JCa1A0RElRSURRQ0FDUWFiK0EwNE5BU0FDUVFBUUJDQUNRUUZxSVFJTUFBQUxBQXNMREFFTFFRRVBDMEVCQ3p3QkFYOGdBRUVJZENFQlFRQWhBQU5BQWtBZ0FFR2ZBVW9OQUNBQVFZRDhBMm9nQUNBQmFoQUJFQVFnQUVFQmFpRUFEQUVMQzBHRUJTVEJBUXNqQVFGL0k0RUNFQUVoQUNPQ0FoQUJRZjhCY1NBQVFmOEJjVUVJZEhKQjhQOERjUXNuQVFGL0k0TUNFQUVoQUNPRUFoQUJRZjhCY1NBQVFmOEJjVUVJZEhKQjhEOXhRWUNBQW1vTGd3RUJBMzhqT2tVRVFBOExJQUJCZ0FGeFJTUEVBU1BFQVJzRVFFRUFKTVFCSTRBQ0VBRkJnQUZ5SVFBamdBSWdBQkFFRHdzUVh5RUJFR0FoQWlBQVFmOStjVUVCYWtFRWRDRURJQUJCZ0FGeEJFQkJBU1RFQVNBREpNVUJJQUVreGdFZ0FpVEhBU09BQWlBQVFmOStjUkFFQlNBQklBSWdBeEJySTRBQ1FmOEJFQVFMQzJJQkEzOGpod0lnQUVZaUFrVUVRQ09HQWlBQVJpRUNDeUFDQkVBZ0FFRUJheUlERUFGQnYzOXhJZ0pCUDNFaUJFRkFheUFFUVFGQkFDT0dBaUFBUmhzYlFZQ1FCR29nQVRvQUFDQUNRWUFCY1FSQUlBTWdBa0VCYWtHQUFYSVFCQXNMQ3p3QkFYOENRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVnQVVFQ1JnMENJQUZCQTBZTkF3d0VDMEVKRHd0QkF3OExRUVVQQzBFSER3dEJBQXN0QVFGL1FRRWppZ0VRWXlJQ2RDQUFjVUVBUnlJQUJIOUJBU0FDZENBQmNVVUZJQUFMQkVCQkFROExRUUFMa1FFQkFuOERRQ0FCSUFCSUJFQWdBVUVFYWlFQkk0WUJJZ0pCQkdva2hnRWpoZ0ZCLy84RFNnUkFJNFlCUVlDQUJHc2toZ0VMSTRrQkJFQWppd0VFUUNPSUFTU0hBVUVCSklFQlFRSVFPa0VBSklzQlFRRWtqQUVGSTR3QkJFQkJBQ1NNQVFzTElBSWpoZ0VRWkFSQUk0Y0JRUUZxSkljQkk0Y0JRZjhCU2dSQVFRRWtpd0ZCQUNTSEFRc0xDd3dCQ3dzTERBQWpoUUVRWlVFQUpJVUJDMGNCQVg4amhnRWhBRUVBSklZQlFZVCtBMEVBRUFRamlRRUVmeUFBSTRZQkVHUUZJNGtCQ3dSQUk0Y0JRUUZxSkljQkk0Y0JRZjhCU2dSQVFRRWtpd0ZCQUNTSEFRc0xDNEFCQVFKL0k0a0JJUUVnQUVFRWNVRUFSeVNKQVNBQVFRTnhJUUlnQVVVRVFDT0tBUkJqSVFBZ0FoQmpJUUVqaVFFRWZ5T0dBVUVCSUFCMGNRVWpoZ0ZCQVNBQWRIRkJBRWNpQUFSL0k0WUJRUUVnQVhSeEJTQUFDd3NFUUNPSEFVRUJhaVNIQVNPSEFVSC9BVW9FUUVFQkpJc0JRUUFraHdFTEN3c2dBaVNLQVF2U0JnRUJmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERJQUZCQVhFUUJBd0JDeUFBUVlDQUFrZ0VRQ0FBSUFFUVV3d0JDeUFBUVlDQUFrNGlBZ1JBSUFCQmdNQUNTQ0VDQ3lBQ0RRRWdBRUdBd0FOT0lnSUVRQ0FBUVlEOEEwZ2hBZ3NnQWdSQUlBQkJnRUJxSUFFUUJBd0NDeUFBUVlEOEEwNGlBZ1JBSUFCQm4vMERUQ0VDQ3lBQ0JFQWptQUZCQWtnTkFRd0NDeUFBUWFEOUEwNGlBZ1JBSUFCQi8vMERUQ0VDQ3lBQ0RRQWdBRUdDL2dOR0JFQWdBVUVCY1VFQVJ5U1BBU0FCUVFKeFFRQkhKSkFCSUFGQmdBRnhRUUJISkpFQlFRRVBDeUFBUVpEK0EwNGlBZ1JBSUFCQnB2NERUQ0VDQ3lBQ0JFQVFUaUFBSUFFUVhROExJQUJCc1A0RFRpSUNCRUFnQUVHLy9nTk1JUUlMSUFJRVFCQk9DeUFBUWNEK0EwNGlBZ1JBSUFCQnkvNERUQ0VDQ3lBQ0JFQWdBRUhBL2dOR0JFQWdBUkFlREFNTElBQkJ3ZjREUmdSQVFjSCtBeUFCUWZnQmNVSEIvZ01RQVVFSGNYSkJnQUZ5RUFRTUFnc2dBRUhFL2dOR0JFQkJBQ1JXSUFCQkFCQUVEQUlMSUFCQnhmNERSZ1JBSUFFay93RU1Bd3NnQUVIRy9nTkdCRUFnQVJCZURBTUxBa0FDUUFKQUFrQWdBQ0lDUWNQK0EwY0VRQ0FDUWNMK0Eyc09DZ0VFQkFRRUJBUUVBd0lFQ3lBQkpGY01CZ3NnQVNSWURBVUxJQUVrV1F3RUN5QUJKRm9NQXdzTUFnc2pnQUlnQUVZRVFDQUJFR0VNQVFzalBTQUFSaUlDUlFSQUl6c2dBRVloQWdzZ0FnUkFJOFFCQkVBQ2Z5UEdBVUdBZ0FGT0lnSUVRQ1BHQVVILy93Rk1JUUlMSUFKRkN3UkFJOFlCUVlDZ0EwNGlBZ1JBSThZQlFmKy9BMHdoQWdzTElBSU5BZ3NMSUFBamhRSk9JZ0lFUUNBQUk0WUNUQ0VDQ3lBQ0JFQWdBQ0FCRUdJTUFnc2dBRUdFL2dOT0lnSUVRQ0FBUVlmK0Ewd2hBZ3NnQWdSQUVHWUNRQUpBQWtBQ1FDQUFJZ0pCaFA0RFJ3UkFJQUpCaGY0RGF3NERBUUlEQkFzUVp3d0ZDd0pBSTRrQkJFQWpqQUVOQVNPTEFRUkFRUUFraXdFTEN5QUJKSWNCQ3d3RkN5QUJKSWdCSTR3Qkk0a0JJZ0FnQUJzRVFDT0lBU1NIQVVFQUpJd0JDd3dFQ3lBQkVHZ01Bd3NNQWdzZ0FFR0EvZ05HQkVBZ0FVSC9BWE1rdmdFanZnRWlBa0VRY1VFQVJ5Uy9BU0FDUVNCeFFRQkhKTUFCQ3lBQVFZLytBMFlFUUNBQkVBOE1BZ3NnQUVILy93TkdCRUFnQVJBT0RBSUxRUUVQQzBFQUR3dEJBUXNSQUNBQUlBRVFhUVJBSUFBZ0FSQUVDd3RnQVFOL0EwQUNRQ0FESUFKT0RRQWdBQ0FEYWhCU0lRVWdBU0FEYWlFRUEwQWdCRUgvdndKS0JFQWdCRUdBUUdvaEJBd0JDd3NnQkNBRkVHb2dBMEVCYWlFRERBRUxDMEVnSVFNandRRWdBa0VRYlVIQUFFRWdJejRiYkdva3dRRUxad0VCZnlQRUFVVUVRQThMSThZQkk4Y0JJOFVCSWdCQkVDQUFRUkJJR3lJQUVHc2p4Z0VnQUdva3hnRWp4d0VnQUdva3h3RWp4UUVnQUdza3hRRWp4UUZCQUV3RVFFRUFKTVFCSTRBQ1FmOEJFQVFGSTRBQ0k4VUJRUkJ0UVFGclFmOStjUkFFQ3d0R0FRSi9JLzhCSVFNQ2Z5QUFSU0lDUlFSQUlBQkJBVVloQWdzZ0Fnc0VmeU5XSUFOR0JTQUNDd1JBSUFGQkJISWlBVUhBQUhFRVFCQTdDd1VnQVVGN2NTRUJDeUFCQzRJQ0FRTi9JN1lCUlFSQUR3c2ptQUVoQUNBQUkxWWlBa0dRQVU0RWYwRUJCU05WSXo0RWYwSHdCUVZCK0FJTFRnUi9RUUlGUVFOQkFDTlZJejRFZjBIeUF3VkIrUUVMVGhzTEN5SUJSd1JBUWNIK0F4QUJJUUFnQVNTWUFVRUFJUUlDUUFKQUFrQUNRQ0FCQkVBZ0FVRUJhdzREQVFJREJBc2dBRUY4Y1NJQVFRaHhRUUJISVFJTUF3c2dBRUY5Y1VFQmNpSUFRUkJ4UVFCSElRSU1BZ3NnQUVGK2NVRUNjaUlBUVNCeFFRQkhJUUlNQVFzZ0FFRURjaUVBQ3lBQ0JFQVFPd3NnQVVVRVFCQnNDeUFCUVFGR0JFQkJBU1IvUVFBUU9ndEJ3ZjRESUFFZ0FCQnRFQVFGSUFKQm1RRkdCRUJCd2Y0RElBRkJ3ZjRERUFFUWJSQUVDd3NMdEFFQUk3WUJCRUFqVlNBQWFpUlZBMEFqVlFKL0l6NEVRRUVJSTFaQm1RRkdEUUVhUVpBSERBRUxRUVFqVmtHWkFVWU5BQnBCeUFNTFRnUkFJMVVDZnlNK0JFQkJDQ05XUVprQlJnMEJHa0dRQnd3QkMwRUVJMVpCbVFGR0RRQWFRY2dEQzJza1ZTTldJZ0JCa0FGR0JFQWpNd1JBRURnRklBQVFOd3NRT1VGL0pNSUJRWDhrd3dFRklBQkJrQUZJQkVBak0wVUVRQ0FBRURjTEN3dEJBQ0FBUVFGcUlBQkJtUUZLR3lSV0RBRUxDd3NRYmd1ekFRQWpWQUovSXo0RVFFRUlJMVpCbVFGR0RRRWFRWkFIREFFTFFRUWpWa0daQVVZTkFCcEJ5QU1MU0FSQUR3c0RRQ05VQW44alBnUkFRUWdqVmtHWkFVWU5BUnBCa0FjTUFRdEJCQ05XUVprQlJnMEFHa0hJQXd0T0JFQUNmeU0rQkVCQkNDTldRWmtCUmcwQkdrR1FCd3dCQzBFRUkxWkJtUUZHRFFBYVFjZ0RDeEJ2STFRQ2Z5TStCRUJCQ0NOV1Faa0JSZzBCR2tHUUJ3d0JDMEVFSTFaQm1RRkdEUUFhUWNnREMyc2tWQXdCQ3dzTE13RUJmMEVCSTVBQkJIOUJBZ1ZCQndzaUFuUWdBSEZCQUVjaUFBUi9RUUVnQW5RZ0FYRkZCU0FBQ3dSQVFRRVBDMEVBQzVZQkFRSi9JNUVCUlFSQUR3c0RRQ0FCSUFCSUJFQWdBVUVFYWlFQkk0MEJJZ0pCQkdva2pRRWpqUUZCLy84RFNnUkFJNDBCUVlDQUJHc2tqUUVMSUFJampRRVFjUVJBUVlIK0EwR0IvZ01RQVVFQmRFRUJha0gvQVhFUUJDT09BVUVCYWlTT0FTT09BVUVJUmdSQVFRQWtqZ0ZCQVNTQ0FVRURFRHBCZ3Y0RFFZTCtBeEFCUWY5K2NSQUVRUUFra1FFTEN3d0JDd3NMaUFFQUk4RUJRUUJLQkVBandRRWdBR29oQUVFQUpNRUJDeU5KSUFCcUpFa2pUVVVFUUNNeEJFQWpWQ0FBYWlSVUVIQUZJQUFRYndzak1BUkFJMXNnQUdva1d3VWdBQkJOQ3lBQUVISUxJeklFUUNPRkFTQUFhaVNGQVJCbUJTQUFFR1VMSTVRQklBQnFKSlFCSTVRQkk1SUJUZ1JBSTVNQlFRRnFKSk1CSTVRQkk1SUJheVNVQVFzTENnQkJCQkJ6STBnUUFRc21BUUYvUVFRUWN5TklRUUZxUWYvL0EzRVFBU0VBRUhSQi93RnhJQUJCL3dGeFFRaDBjZ3NNQUVFRUVITWdBQ0FCRUdvTE1BRUJmMEVCSUFCMFFmOEJjU0VDSUFGQkFFb0VRQ05HSUFKeVFmOEJjU1JHQlNOR0lBSkIvd0Z6Y1NSR0N5TkdDd2tBUVFVZ0FCQjNHZ3RKQVFGL0lBRkJBRTRFUUNBQVFROXhJQUZCRDNGcVFSQnhCRUJCQVJCNEJVRUFFSGdMQlNBQlFSOTFJZ0lnQVNBQ2FuTkJEM0VnQUVFUGNVc0VRRUVCRUhnRlFRQVFlQXNMQ3drQVFRY2dBQkIzR2dzSkFFRUdJQUFRZHhvTENRQkJCQ0FBRUhjYUN6c0JBbjhnQVVHQS9nTnhRUWgxSVFJZ0FFRUJhaUVESUFBZ0FVSC9BWEVpQVJCcEJFQWdBQ0FCRUFRTElBTWdBaEJwQkVBZ0F5QUNFQVFMQ3d3QVFRZ1FjeUFBSUFFUWZRdDFBQ0FDQkVBZ0FTQUFRZi8vQTNFaUFHb2dBQ0FCYzNNaUFrRVFjUVJBUVFFUWVBVkJBQkI0Q3lBQ1FZQUNjUVJBUVFFUWZBVkJBQkI4Q3dVZ0FDQUJha0gvL3dOeElnSWdBRUgvL3dOeFNRUkFRUUVRZkFWQkFCQjhDeUFBSUFGeklBSnpRWUFnY1FSQVFRRVFlQVZCQUJCNEN3c0xDZ0JCQkJCeklBQVFVZ3VSQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzTUV3c1FkVUgvL3dOeElnQkJnUDREY1VFSWRTUkFJQUJCL3dGeEpFRU1Ed3NqUVVIL0FYRWpRRUgvQVhGQkNIUnlJejhRZGd3UkN5TkJRZjhCY1NOQVFmOEJjVUVJZEhKQkFXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1FBd1JDeU5BUVFFUWVTTkFRUUZxUWY4QmNTUkFJMEFFUUVFQUVIb0ZRUUVRZWd0QkFCQjdEQThMSTBCQmZ4QjVJMEJCQVd0Qi93RnhKRUFqUUFSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNNRGdzUWRFSC9BWEVrUUF3TEN5TS9RWUFCY1VHQUFVWUVRRUVCRUh3RlFRQVFmQXNqUHlJQVFRRjBJQUJCL3dGeFFRZDJja0gvQVhFa1B3d0xDeEIxUWYvL0EzRWpSeEIrREFnTEkwVkIvd0Z4STBSQi93RnhRUWgwY2lJQUkwRkIvd0Z4STBCQi93RnhRUWgwY2lJQlFRQVFmeUFBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFQUVIdEJDQThMSTBGQi93RnhJMEJCL3dGeFFRaDBjaENBQVVIL0FYRWtQd3dKQ3lOQlFmOEJjU05BUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVrUUF3SkN5TkJRUUVRZVNOQlFRRnFRZjhCY1NSQkkwRUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBY0xJMEZCZnhCNUkwRkJBV3RCL3dGeEpFRWpRUVJBUVFBUWVnVkJBUkI2QzBFQkVIc01CZ3NRZEVIL0FYRWtRUXdEQ3lNL1FRRnhRUUJMQkVCQkFSQjhCVUVBRUh3TEl6OGlBRUVIZENBQVFmOEJjVUVCZG5KQi93RnhKRDhNQXd0QmZ3OExJMGhCQW1wQi8vOERjU1JJREFJTEkwaEJBV3BCLy84RGNTUklEQUVMUVFBUWVrRUFFSHRCQUJCNEMwRUVEd3NnQUVIL0FYRWtRVUVJQ3lnQkFYOGdBRUVZZEVFWWRTSUJRWUFCY1FSQVFZQUNJQUJCR0hSQkdIVnJRWDlzSVFFTElBRUxLUUVCZnlBQUVJSUJJUUVqU0NBQlFSaDBRUmgxYWtILy93TnhKRWdqU0VFQmFrSC8vd054SkVnTDJBVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJFRWNFUUNBQVFSRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU02QkVCQnpmNERFSUFCUWY4QmNTSUFRUUZ4QkVCQnpmNERJQUJCZm5FaUFFR0FBWEVFZjBFQUpENGdBRUgvZm5FRlFRRWtQaUFBUVlBQmNnc1Fka0hFQUE4TEMwRUJKRTBNRUFzUWRVSC8vd054SWdCQmdQNERjVUVJZFNSQ0lBQkIvd0Z4SkVNalNFRUNha0gvL3dOeEpFZ01FUXNqUTBIL0FYRWpRa0gvQVhGQkNIUnlJejhRZGd3UUN5TkRRZjhCY1NOQ1FmOEJjVUVJZEhKQkFXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1Fnd1FDeU5DUVFFUWVTTkNRUUZxUWY4QmNTUkNJMElFUUVFQUVIb0ZRUUVRZWd0QkFCQjdEQTRMSTBKQmZ4QjVJMEpCQVd0Qi93RnhKRUlqUWdSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNNRFFzUWRFSC9BWEVrUWd3S0MwRUJRUUFqUHlJQlFZQUJjVUdBQVVZYklRQWpSa0VFZGtFQmNTQUJRUUYwY2tIL0FYRWtQd3dLQ3hCMEVJTUJRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUNORFFmOEJjU05DUWY4QmNVRUlkSElpQVVFQUVIOGdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1JFSUFCQi93RnhKRVZCQUJCN1FRZ1BDeU5EUWY4QmNTTkNRZjhCY1VFSWRISVFnQUZCL3dGeEpEOE1DQXNqUTBIL0FYRWpRa0gvQVhGQkNIUnlRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDFKRUlNQ0FzalEwRUJFSGtqUTBFQmFrSC9BWEVrUXlOREJFQkJBQkI2QlVFQkVIb0xRUUFRZXd3R0N5TkRRWDhRZVNORFFRRnJRZjhCY1NSREkwTUVRRUVBRUhvRlFRRVFlZ3RCQVJCN0RBVUxFSFJCL3dGeEpFTU1BZ3RCQVVFQUl6OGlBVUVCY1VFQlJoc2hBQ05HUVFSMlFRRnhRUWQwSUFGQi93RnhRUUYyY2lRL0RBSUxRWDhQQ3lOSVFRRnFRZi8vQTNFa1NBd0JDeUFBQkVCQkFSQjhCVUVBRUh3TFFRQVFla0VBRUh0QkFCQjRDMEVFRHdzZ0FFSC9BWEVrUTBFSUM3Z0dBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQklFY0VRQ0FBUVNGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TkdRUWQyUVFGeEJFQWpTRUVCYWtILy93TnhKRWdGRUhRUWd3RUxRUWdQQ3hCMVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlNOSVFRSnFRZi8vQTNFa1NBd1FDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBQ00vRUhZZ0FFRUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkVJQUJCL3dGeEpFVU1Ed3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSVUVJRHdzalJFRUJFSGtqUkVFQmFrSC9BWEVrUkNORUJFQkJBQkI2QlVFQkVIb0xRUUFRZXd3TkN5TkVRWDhRZVNORVFRRnJRZjhCY1NSRUkwUUVRRUVBRUhvRlFRRVFlZ3RCQVJCN0RBd0xFSFJCL3dGeEpFUU1DZ3RCQmtFQUkwWkJCWFpCQVhGQkFFc2JJUUVnQVVIZ0FISWdBU05HUVFSMlFRRnhRUUJMR3lFQkkwWkJCblpCQVhGQkFFc0VmeU0vSUFGclFmOEJjUVVnQVVFR2NpQUJJejhpQUVFUGNVRUpTeHNpQVVIZ0FISWdBU0FBUVprQlN4c2lBU0FBYWtIL0FYRUxJZ0FFUUVFQUVIb0ZRUUVRZWdzZ0FVSGdBSEVFUUVFQkVId0ZRUUFRZkF0QkFCQjRJQUFrUHd3S0N5TkdRUWQyUVFGeFFRQkxCRUFRZEJDREFRVWpTRUVCYWtILy93TnhKRWdMUVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFTQUJRZi8vQTNGQkFCQi9JQUZCQVhSQi8vOERjU0lCUVlEK0EzRkJDSFVrUkNBQlFmOEJjU1JGUVFBUWUwRUlEd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJZ0VRZ0FGQi93RnhKRDhnQVVFQmFrSC8vd054SWdGQmdQNERjVUVJZFNSRUlBRkIvd0Z4SkVVTUJ3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeVFRRnJRZi8vQTNFaUFVR0EvZ054UVFoMUpFUWdBVUgvQVhFa1JVRUlEd3NqUlVFQkVIa2pSVUVCYWtIL0FYRWtSU05GQkVCQkFCQjZCVUVCRUhvTFFRQVFld3dGQ3lORlFYOFFlU05GUVFGclFmOEJjU1JGSTBVRVFFRUFFSG9GUVFFUWVndEJBUkI3REFRTEVIUkIvd0Z4SkVVTUFnc2pQMEYvYzBIL0FYRWtQMEVCRUh0QkFSQjREQUlMUVg4UEN5TklRUUZxUWYvL0EzRWtTQXRCQkF1VUJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRXdSd1JBSUFCQk1Xc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJMFpCQkhaQkFYRUVRQ05JUVFGcVFmLy9BM0VrU0FVUWRCQ0RBUXRCQ0E4TEVIVkIvLzhEY1NSSEkwaEJBbXBCLy84RGNTUklEQklMSTBWQi93RnhJMFJCL3dGeFFRaDBjaUlBSXo4UWRnd09DeU5IUVFGcVFmLy9BM0VrUjBFSUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnQVFnQUVpQVVFQkVIa2dBVUVCYWtIL0FYRWlBUVJBUVFBUWVnVkJBUkI2QzBFQUVIc01EUXNqUlVIL0FYRWpSRUgvQVhGQkNIUnlJZ0FRZ0FFaUFVRi9FSGtnQVVFQmEwSC9BWEVpQVFSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNNREFzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUhSQi93RnhFSFlNREF0QkFCQjdRUUFRZUVFQkVId01EQXNqUmtFRWRrRUJjVUVCUmdSQUVIUVFnd0VGSTBoQkFXcEIvLzhEY1NSSUMwRUlEd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJZ0VqUjBFQUVIOGpSeUFCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1JFSUFCQi93RnhKRVZCQUJCN1FRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBQkNBQVVIL0FYRWtQd3dHQ3lOSFFRRnJRZi8vQTNFa1IwRUlEd3NqUDBFQkVIa2pQMEVCYWtIL0FYRWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRQVFld3dIQ3lNL1FYOFFlU00vUVFGclFmOEJjU1EvSXo4RVFFRUFFSG9GUVFFUWVndEJBUkI3REFZTEVIUkIvd0Z4SkQ4TUJBdEJBQkI3UVFBUWVDTkdRUVIyUVFGeFFRQkxCRUJCQUJCOEJVRUJFSHdMREFRTFFYOFBDeUFBUVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlF3Q0N5QUFRZi8vQTNFZ0FSQjJEQUVMSTBoQkFXcEIvLzhEY1NSSUMwRUVDK1FCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCd0FCSEJFQWdBRUhCQUVZTkFRSkFJQUJCd2dCckRnNERCQVVHQndnSkVRb0xEQTBPRHdBTERBOExEQThMSTBFa1FBd09DeU5DSkVBTURRc2pReVJBREF3TEkwUWtRQXdMQ3lORkpFQU1DZ3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkFEQWtMSXo4a1FBd0lDeU5BSkVFTUJ3c2pRaVJCREFZTEkwTWtRUXdGQ3lORUpFRU1CQXNqUlNSQkRBTUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBVUgvQVhFa1FRd0NDeU0vSkVFTUFRdEJmdzhMUVFRTDN3RUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBQkhCRUFnQUVIUkFFWU5BUUpBSUFCQjBnQnJEZzRRQXdRRkJnY0lDUW9RQ3d3TkRnQUxEQTRMSTBBa1Fnd09DeU5CSkVJTURRc2pReVJDREF3TEkwUWtRZ3dMQ3lORkpFSU1DZ3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkNEQWtMSXo4a1Fnd0lDeU5BSkVNTUJ3c2pRU1JEREFZTEkwSWtRd3dGQ3lORUpFTU1CQXNqUlNSRERBTUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBVUgvQVhFa1F3d0NDeU0vSkVNTUFRdEJmdzhMUVFRTDN3RUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUVIaEFFWU5BUUpBSUFCQjRnQnJEZzREQkJBRkJnY0lDUW9MREJBTkRnQUxEQTRMSTBBa1JBd09DeU5CSkVRTURRc2pRaVJFREF3TEkwTWtSQXdMQ3lORkpFUU1DZ3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCUWY4QmNTUkVEQWtMSXo4a1JBd0lDeU5BSkVVTUJ3c2pRU1JGREFZTEkwSWtSUXdGQ3lOREpFVU1CQXNqUkNSRkRBTUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBVUgvQVhFa1JRd0NDeU0vSkVVTUFRdEJmdzhMUVFRTDdBSUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBRWNFUUNBQVFmRUFSZzBCQWtBZ0FFSHlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFJBQXNNRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5STBBUWRnd1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWpRUkIyREE0TEkwVkIvd0Z4STBSQi93RnhRUWgwY2lOQ0VIWU1EUXNqUlVIL0FYRWpSRUgvQVhGQkNIUnlJME1RZGd3TUN5TkZRZjhCY1NORVFmOEJjVUVJZEhJalJCQjJEQXNMSTBWQi93RnhJMFJCL3dGeFFRaDBjaU5GRUhZTUNnc2p4QUZGQkVBQ1FDT1pBUVJBUVFFa1Nnd0JDeU4rSTRRQmNVRWZjVVVFUUVFQkpFc01BUXRCQVNSTUN3c01DUXNqUlVIL0FYRWpSRUgvQVhGQkNIUnlJejhRZGd3SUN5TkFKRDhNQndzalFTUS9EQVlMSTBJa1B3d0ZDeU5ESkQ4TUJBc2pSQ1EvREFNTEkwVWtQd3dDQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FGQi93RnhKRDhNQVF0QmZ3OExRUVFMU1FFQmZ5QUJRUUJPQkVBZ0FFSC9BWEVnQUNBQmFrSC9BWEZMQkVCQkFSQjhCVUVBRUh3TEJTQUJRUjkxSWdJZ0FTQUNhbk1nQUVIL0FYRktCRUJCQVJCOEJVRUFFSHdMQ3dzMEFRRi9JejhnQUVIL0FYRWlBUkI1SXo4Z0FSQ0xBU00vSUFCcVFmOEJjU1EvSXo4RVFFRUFFSG9GUVFFUWVndEJBQkI3QzJ3QkFuOGpQeUFBYWlOR1FRUjJRUUZ4YWtIL0FYRWlBU0VDSXo4Z0FITWdBWE5CRUhFRVFFRUJFSGdGUVFBUWVBc2pQeUFBUWY4QmNXb2pSa0VFZGtFQmNXcEJnQUp4UVFCTEJFQkJBUkI4QlVFQUVId0xJQUlrUHlNL0JFQkJBQkI2QlVFQkVIb0xRUUFRZXd2eEFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUVlBQlJ3UkFJQUZCZ1FGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TkFFSXdCREJBTEkwRVFqQUVNRHdzalFoQ01BUXdPQ3lOREVJd0JEQTBMSTBRUWpBRU1EQXNqUlJDTUFRd0xDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRakFFTUNnc2pQeENNQVF3SkN5TkFFSTBCREFnTEkwRVFqUUVNQndzalFoQ05BUXdHQ3lOREVJMEJEQVVMSTBRUWpRRU1CQXNqUlJDTkFRd0RDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRalFFTUFnc2pQeENOQVF3QkMwRi9Ed3RCQkFzM0FRRi9JejhnQUVIL0FYRkJmMndpQVJCNUl6OGdBUkNMQVNNL0lBQnJRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQVJCN0Myd0JBbjhqUHlBQWF5TkdRUVIyUVFGeGEwSC9BWEVpQVNFQ0l6OGdBSE1nQVhOQkVIRUVRRUVCRUhnRlFRQVFlQXNqUHlBQVFmOEJjV3NqUmtFRWRrRUJjV3RCZ0FKeFFRQkxCRUJCQVJCOEJVRUFFSHdMSUFJa1B5TS9CRUJCQUJCNkJVRUJFSG9MUVFFUWV3dnhBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFaQUJSd1JBSUFGQmtRRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU5BRUk4QkRCQUxJMEVRandFTUR3c2pRaENQQVF3T0N5TkRFSThCREEwTEkwUVFqd0VNREFzalJSQ1BBUXdMQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FFUWp3RU1DZ3NqUHhDUEFRd0pDeU5BRUpBQkRBZ0xJMEVRa0FFTUJ3c2pRaENRQVF3R0N5TkRFSkFCREFVTEkwUVFrQUVNQkFzalJSQ1FBUXdEQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FFUWtBRU1BZ3NqUHhDUUFRd0JDMEYvRHd0QkJBc2pBQ00vSUFCeEpEOGpQd1JBUVFBUWVnVkJBUkI2QzBFQUVIdEJBUkI0UVFBUWZBc25BQ00vSUFCelFmOEJjU1EvSXo4RVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVFRUFFSHdMOFFFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUdnQVVjRVFDQUJRYUVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzalFCQ1NBUXdRQ3lOQkVKSUJEQThMSTBJUWtnRU1EZ3NqUXhDU0FRd05DeU5FRUpJQkRBd0xJMFVRa2dFTUN3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJFSklCREFvTEl6OFFrZ0VNQ1FzalFCQ1RBUXdJQ3lOQkVKTUJEQWNMSTBJUWt3RU1CZ3NqUXhDVEFRd0ZDeU5FRUpNQkRBUUxJMFVRa3dFTUF3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJFSk1CREFJTEl6OFFrd0VNQVF0QmZ3OExRUVFMSndBalB5QUFja0gvQVhFa1B5TS9CRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGhCQUJCOEN5OEJBWDhqUHlBQVFmOEJjVUYvYkNJQkVIa2pQeUFCRUlzQkl6OGdBV29FUUVFQUVIb0ZRUUVRZWd0QkFSQjdDL0VCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJzQUZIQkVBZ0FVR3hBV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTBBUWxRRU1FQXNqUVJDVkFRd1BDeU5DRUpVQkRBNExJME1RbFFFTURRc2pSQkNWQVF3TUN5TkZFSlVCREFzTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFSQ1ZBUXdLQ3lNL0VKVUJEQWtMSTBBUWxnRU1DQXNqUVJDV0FRd0hDeU5DRUpZQkRBWUxJME1RbGdFTUJRc2pSQkNXQVF3RUN5TkZFSllCREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFSQ1dBUXdDQ3lNL0VKWUJEQUVMUVg4UEMwRUVDenNCQVg4Z0FCQlJJZ0ZCZjBZRWZ5QUFFQUVGSUFFTFFmOEJjU0FBUVFGcUlnRVFVU0lBUVg5R0JIOGdBUkFCQlNBQUMwSC9BWEZCQ0hSeUN3c0FRUWdRY3lBQUVKZ0JDME1BSUFCQmdBRnhRWUFCUmdSQVFRRVFmQVZCQUJCOEN5QUFRUUYwSUFCQi93RnhRUWQyY2tIL0FYRWlBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0SUFBTFFRQWdBRUVCY1VFQVN3UkFRUUVRZkFWQkFCQjhDeUFBUVFkMElBQkIvd0Z4UVFGMmNrSC9BWEVpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBQUxUd0VCZjBFQlFRQWdBRUdBQVhGQmdBRkdHeUVCSTBaQkJIWkJBWEVnQUVFQmRISkIvd0Z4SVFBZ0FRUkFRUUVRZkFWQkFCQjhDeUFBQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhnZ0FBdFFBUUYvUVFGQkFDQUFRUUZ4UVFGR0d5RUJJMFpCQkhaQkFYRkJCM1FnQUVIL0FYRkJBWFp5SVFBZ0FRUkFRUUVRZkFWQkFCQjhDeUFBQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhnZ0FBdEdBUUYvUVFGQkFDQUFRWUFCY1VHQUFVWWJJUUVnQUVFQmRFSC9BWEVoQUNBQkJFQkJBUkI4QlVFQUVId0xJQUFFUUVFQUVIb0ZRUUVRZWd0QkFCQjdRUUFRZUNBQUMxNEJBbjlCQVVFQUlBQkJBWEZCQVVZYklRRkJBVUVBSUFCQmdBRnhRWUFCUmhzaEFpQUFRZjhCY1VFQmRpSUFRWUFCY2lBQUlBSWJJZ0FFUUVFQUVIb0ZRUUVRZWd0QkFCQjdRUUFRZUNBQkJFQkJBUkI4QlVFQUVId0xJQUFMTUFBZ0FFRVBjVUVFZENBQVFmQUJjVUVFZG5JaUFBUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRRUUFRZkNBQUMwSUJBWDlCQVVFQUlBQkJBWEZCQVVZYklRRWdBRUgvQVhGQkFYWWlBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0SUFFRVFFRUJFSHdGUVFBUWZBc2dBQXNrQUVFQklBQjBJQUZ4UWY4QmNRUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFSQjRJQUVMbndnQkJuOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJDRzhpQmlJRkJFQWdCVUVCYXc0SEFRSURCQVVHQndnTEkwQWhBUXdIQ3lOQklRRU1CZ3NqUWlFQkRBVUxJME1oQVF3RUN5TkVJUUVNQXdzalJTRUJEQUlMSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVNFQkRBRUxJejhoQVFzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lGSWdRRVFDQUVRUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lBQVFRZE1CSDlCQVNFQ0lBRVFtZ0VGSUFCQkQwd0VmMEVCSVFJZ0FSQ2JBUVZCQUFzTElRTU1Ed3NnQUVFWFRBUi9RUUVoQWlBQkVKd0JCU0FBUVI5TUJIOUJBU0VDSUFFUW5RRUZRUUFMQ3lFRERBNExJQUJCSjB3RWYwRUJJUUlnQVJDZUFRVWdBRUV2VEFSL1FRRWhBaUFCRUo4QkJVRUFDd3NoQXd3TkN5QUFRVGRNQkg5QkFTRUNJQUVRb0FFRklBQkJQMHdFZjBFQklRSWdBUkNoQVFWQkFBc0xJUU1NREFzZ0FFSEhBRXdFZjBFQklRSkJBQ0FCRUtJQkJTQUFRYzhBVEFSL1FRRWhBa0VCSUFFUW9nRUZRUUFMQ3lFRERBc0xJQUJCMXdCTUJIOUJBU0VDUVFJZ0FSQ2lBUVVnQUVIZkFFd0VmMEVCSVFKQkF5QUJFS0lCQlVFQUN3c2hBd3dLQ3lBQVFlY0FUQVIvUVFFaEFrRUVJQUVRb2dFRklBQkI3d0JNQkg5QkFTRUNRUVVnQVJDaUFRVkJBQXNMSVFNTUNRc2dBRUgzQUV3RWYwRUJJUUpCQmlBQkVLSUJCU0FBUWY4QVRBUi9RUUVoQWtFSElBRVFvZ0VGUVFBTEN5RUREQWdMSUFCQmh3Rk1CSDlCQVNFQ0lBRkJmbkVGSUFCQmp3Rk1CSDlCQVNFQ0lBRkJmWEVGUVFBTEN5RUREQWNMSUFCQmx3Rk1CSDlCQVNFQ0lBRkJlM0VGSUFCQm53Rk1CSDlCQVNFQ0lBRkJkM0VGUVFBTEN5RUREQVlMSUFCQnB3Rk1CSDlCQVNFQ0lBRkJiM0VGSUFCQnJ3Rk1CSDlCQVNFQ0lBRkJYM0VGUVFBTEN5RUREQVVMSUFCQnR3Rk1CSDlCQVNFQ0lBRkJ2Mzl4QlNBQVFiOEJUQVIvUVFFaEFpQUJRZjkrY1FWQkFBc0xJUU1NQkFzZ0FFSEhBVXdFZjBFQklRSWdBVUVCY2dVZ0FFSFBBVXdFZjBFQklRSWdBVUVDY2dWQkFBc0xJUU1NQXdzZ0FFSFhBVXdFZjBFQklRSWdBVUVFY2dVZ0FFSGZBVXdFZjBFQklRSWdBVUVJY2dWQkFBc0xJUU1NQWdzZ0FFSG5BVXdFZjBFQklRSWdBVUVRY2dVZ0FFSHZBVXdFZjBFQklRSWdBVUVnY2dWQkFBc0xJUU1NQVFzZ0FFSDNBVXdFZjBFQklRSWdBVUhBQUhJRklBQkIvd0ZNQkg5QkFTRUNJQUZCZ0FGeUJVRUFDd3NoQXdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFZaUJBUkFJQVJCQVdzT0J3RUNBd1FGQmdjSUN5QURKRUFNQndzZ0F5UkJEQVlMSUFNa1Fnd0ZDeUFESkVNTUJBc2dBeVJFREFNTElBTWtSUXdDQ3lBRlFRUklJZ1FFZnlBRUJTQUZRUWRLQ3dSQUkwVkIvd0Z4STBSQi93RnhRUWgwY2lBREVIWUxEQUVMSUFNa1B3dEJCRUYvSUFJYkMrNERBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSEFBVWNFUUNBQVFjRUJhdzRQQVFJUkF3UUZCZ2NJQ1FvTEVBd05EZ3NqUmtFSGRrRUJjUTBSREE0TEkwY1FtUUZCLy84RGNTRUFJMGRCQW1wQi8vOERjU1JISUFCQmdQNERjVUVJZFNSQUlBQkIvd0Z4SkVGQkJBOExJMFpCQjNaQkFYRU5FUXdPQ3lOR1FRZDJRUUZ4RFJBTURBc2pSMEVDYTBILy93TnhKRWNqUnlOQlFmOEJjU05BUWY4QmNVRUlkSElRZmd3TkN4QjBFSXdCREEwTEkwZEJBbXRCLy84RGNTUkhJMGNqU0JCK1FRQWtTQXdMQ3lOR1FRZDJRUUZ4UVFGSERRb01Cd3NqUnhDWkFVSC8vd054SkVnalIwRUNha0gvL3dOeEpFY01DUXNqUmtFSGRrRUJjVUVCUmcwSERBb0xFSFJCL3dGeEVLTUJJUUFqU0VFQmFrSC8vd054SkVnZ0FBOExJMFpCQjNaQkFYRkJBVWNOQ0NOSFFRSnJRZi8vQTNFa1J5TkhJMGhCQW1wQi8vOERjUkIrREFVTEVIUVFqUUVNQmdzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1QkNDUklEQVFMUVg4UEN5TkhFSmtCUWYvL0EzRWtTQ05IUVFKcVFmLy9BM0VrUjBFTUR3c2pSMEVDYTBILy93TnhKRWNqUnlOSVFRSnFRZi8vQTNFUWZnc1FkVUgvL3dOeEpFZ0xRUWdQQ3lOSVFRRnFRZi8vQTNFa1NFRUVEd3NqU0VFQ2FrSC8vd054SkVoQkRBdlRBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIUUFVY0VRQ0FBUWRFQmF3NFBBUUlOQXdRRkJnY0lDUTBLRFFzTURRc2pSa0VFZGtFQmNRMFBEQTBMSTBjUW1RRkIvLzhEY1NFQUkwZEJBbXBCLy84RGNTUkhJQUJCZ1A0RGNVRUlkU1JDSUFCQi93RnhKRU5CQkE4TEkwWkJCSFpCQVhFTkR3d01DeU5HUVFSMlFRRnhEUTRqUjBFQ2EwSC8vd054SkVjalJ5TklRUUpxUWYvL0EzRVFmZ3dMQ3lOSFFRSnJRZi8vQTNFa1J5TkhJME5CL3dGeEkwSkIvd0Z4UVFoMGNoQitEQXNMRUhRUWp3RU1Dd3NqUjBFQ2EwSC8vd054SkVjalJ5TklFSDVCRUNSSURBa0xJMFpCQkhaQkFYRkJBVWNOQ0F3R0N5TkhFSmtCUWYvL0EzRWtTRUVCSkpvQkkwZEJBbXBCLy84RGNTUkhEQWNMSTBaQkJIWkJBWEZCQVVZTkJRd0lDeU5HUVFSMlFRRnhRUUZIRFFjalIwRUNhMEgvL3dOeEpFY2pSeU5JUVFKcVFmLy9BM0VRZmd3RUN4QjBFSkFCREFVTEkwZEJBbXRCLy84RGNTUkhJMGNqU0JCK1FSZ2tTQXdEQzBGL0R3c2pSeENaQVVILy93TnhKRWdqUjBFQ2FrSC8vd054SkVkQkRBOExFSFZCLy84RGNTUklDMEVJRHdzalNFRUJha0gvL3dOeEpFaEJCQThMSTBoQkFtcEIvLzhEY1NSSVFRd0w4QUlBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFGSEJFQWdBRUhoQVdzT0R3RUNDd3NEQkFVR0J3Z0xDd3NKQ2dzTEVIUkIvd0Z4UVlEK0Eyb2pQeEIyREFzTEkwY1FtUUZCLy84RGNTRUFJMGRCQW1wQi8vOERjU1JISUFCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVWQkJBOExJMEZCZ1A0RGFpTS9FSFpCQkE4TEkwZEJBbXRCLy84RGNTUkhJMGNqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSDVCQ0E4TEVIUVFrZ0VNQndzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1QklDUklRUWdQQ3hCMEVJSUJRUmgwUVJoMUlRQWpSeUFBUVFFUWZ5TkhJQUJxUWYvL0EzRWtSMEVBRUhwQkFCQjdJMGhCQVdwQi8vOERjU1JJUVF3UEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJa1NFRUVEd3NRZFVILy93TnhJejhRZGlOSVFRSnFRZi8vQTNFa1NFRUVEd3NRZEJDVEFRd0NDeU5IUVFKclFmLy9BM0VrUnlOSEkwZ1Fma0VvSkVoQkNBOExRWDhQQ3lOSVFRRnFRZi8vQTNFa1NFRUVDNmNEQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCUndSQUlBQkI4UUZyRGc4QkFnTU5CQVVHQndnSkNnME5Dd3dOQ3hCMFFmOEJjVUdBL2dOcUVJQUJRZjhCY1NRL0RBMExJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUS9JQUJCL3dGeEpFWU1EUXNqUVVHQS9nTnFFSUFCUWY4QmNTUS9EQXdMUVFBa21RRU1Dd3NqUjBFQ2EwSC8vd054SkVjalJ5TkdRZjhCY1NNL1FmOEJjVUVJZEhJUWZrRUlEd3NRZEJDVkFRd0lDeU5IUVFKclFmLy9BM0VrUnlOSEkwZ1Fma0V3SkVoQkNBOExFSFFRZ2dFaEFFRUFFSHBCQUJCN0kwY2dBRUVZZEVFWWRTSUFRUUVRZnlOSElBQnFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JTTklRUUZxUWYvL0EzRWtTRUVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SkVkQkNBOExFSFZCLy84RGNSQ0FBVUgvQVhFa1B5TklRUUpxUWYvL0EzRWtTQXdGQzBFQkpKb0JEQVFMRUhRUWxnRU1BZ3NqUjBFQ2EwSC8vd054SkVjalJ5TklFSDVCT0NSSVFRZ1BDMEYvRHdzalNFRUJha0gvL3dOeEpFZ0xRUVFMM0FFQkFYOGpTRUVCYWtILy93TnhKRWdqVEFSQUkwaEJBV3RCLy84RGNTUklDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJQkJFQWdBVUVCUmcwQkFrQWdBVUVDYXc0TkF3UUZCZ2NJQ1FvTERBME9Ed0FMREE4TElBQVFnUUVQQ3lBQUVJUUJEd3NnQUJDRkFROExJQUFRaGdFUEN5QUFFSWNCRHdzZ0FCQ0lBUThMSUFBUWlRRVBDeUFBRUlvQkR3c2dBQkNPQVE4TElBQVFrUUVQQ3lBQUVKUUJEd3NnQUJDWEFROExJQUFRcEFFUEN5QUFFS1VCRHdzZ0FCQ21BUThMSUFBUXB3RUx3Z0VCQW45QkFDU1pBVUdQL2dNUUFVRUJJQUIwUVg5emNTSUJKSVFCUVkvK0F5QUJFQVFqUjBFQ2EwSC8vd054SkVjQ1FDTktJZ0VqU3lBQkd3MEFDeU5ISWdFalNDSUNRZjhCY1JBRUlBRkJBV29nQWtHQS9nTnhRUWgxRUFRQ1FBSkFBa0FDUUFKQUlBQUVRQ0FBUVFGR0RRRUNRQ0FBUVFKckRnTURCQVVBQ3d3RkMwRUFKSDlCd0FBa1NBd0VDMEVBSklBQlFjZ0FKRWdNQXd0QkFDU0JBVUhRQUNSSURBSUxRUUFrZ2dGQjJBQWtTQXdCQzBFQUpJTUJRZUFBSkVnTEMva0JBUU4vSTVvQkJFQkJBU1NaQVVFQUpKb0JDeU4rSTRRQmNVRWZjVUVBU2dSQUkwdEZJNWtCSWdJZ0Foc0VmeU4vSTNraUFDQUFHd1IvUVFBUXFRRkJBUVVqZ0FFamVpSUFJQUFiQkg5QkFSQ3BBVUVCQlNPQkFTTjdJZ0FnQUJzRWYwRUNFS2tCUVFFRkk0SUJJM3dpQUNBQUd3Ui9RUU1RcVFGQkFRVWpnd0VqZlNJQUlBQWJCSDlCQkJDcEFVRUJCVUVBQ3dzTEN3c0ZRUUFMQkVBQ2YwRUJJMG9pQUNOTElBQWJEUUFhUVFBTEJIOUJBQ1JMUVFBa1NrRUFKRXhCQUNSTlFSZ0ZRUlFMSVFFTEFuOUJBU05LSWdBalN5QUFHdzBBR2tFQUN3UkFRUUFrUzBFQUpFcEJBQ1JNUVFBa1RRc2dBUThMUVFBTHF3RUJBbjlCQVNRdEkwd0VRQ05JRUFGQi93RnhFS2dCRUhOQkFDUkxRUUFrU2tFQUpFeEJBQ1JOQ3hDcUFTSUJRUUJLQkVBZ0FSQnpDMEVFSVFBQ2YwRUJJMG9pQVNOTElBRWJEUUFhUVFBTFJTSUJCSDhqVFVVRklBRUxCRUFqU0JBQlFmOEJjUkNvQVNFQUN5TkdRZkFCY1NSR0lBQkJBRXdFUUNBQUR3c2dBQkJ6STVjQlFRRnFKSmNCSTVjQkk1VUJUZ1JBSTVZQlFRRnFKSllCSTVjQkk1VUJheVNYQVFzZ0FBc0VBQ05xQytZQkFRVi9JQUJCZjBHQUNDQUFRUUJJR3lBQVFRQktHeUVFUVFBaEFBTkFBbjhDZnlBR1JTSUNCRUFnQUVVaEFnc2dBZ3NFUUNBRlJTRUNDeUFDQ3dSQUlBTkZJUUlMSUFJRVFCQ3JBVUVBU0FSQVFRRWhCZ1VqU1NNK0JIOUJvTWtJQlVIUXBBUUxUZ1JBUVFFaEFBVWdCRUYvU2lJQ0JFQWphaUFFVGlFQ0N5QUNCRUJCQVNFRkJTQUJRWDlLSWdJRVFDTklJQUZHSVFJTFFRRWdBeUFDR3lFREN3c0xEQUVMQ3lBQUJFQWpTU00rQkg5Qm9Na0lCVUhRcEFRTGF5UkpJNGdDRHdzZ0JRUkFJNGtDRHdzZ0F3UkFJNG9DRHdzalNFRUJhMEgvL3dOeEpFaEJmd3NKQUVGL1FYOFFyUUVMT0FFRGZ3TkFJQUlnQUVnaUF3UkFJQUZCQUU0aEF3c2dBd1JBRUs0QklRRWdBa0VCYWlFQ0RBRUxDeUFCUVFCSUJFQWdBUThMUVFBTENRQkJmeUFBRUswQkN3a0FJQUFnQVJDdEFRc0ZBQ09TQVFzRkFDT1RBUXNGQUNPVUFRdGZBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FDSUJRUUZHRFFFQ1FDQUJRUUpyRGdZREJBVUdCd2dBQ3d3SUN5UHFBUThMSStzQkR3c2o3QUVQQ3lQdEFROExJKzRCRHdzajd3RVBDeVB3QVE4TEkvRUJEd3RCQUF1TEFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFBaUFrRUJSZzBCQWtBZ0FrRUNhdzRHQXdRRkJnY0lBQXNNQ0FzZ0FVRUFSeVRxQVF3SEN5QUJRUUJISk9zQkRBWUxJQUZCQUVjazdBRU1CUXNnQVVFQVJ5VHRBUXdFQ3lBQlFRQkhKTzRCREFNTElBRkJBRWNrN3dFTUFnc2dBVUVBUnlUd0FRd0JDeUFCUVFCSEpQRUJDd3RVQVFGL1FRQWtUU0FBRUxVQlJRUkFRUUVoQVFzZ0FFRUJFTFlCSUFFRVFFRUJRUUZCQUVFQlFRQWdBRUVEVEJzaUFTTy9BU0lBSUFBYkd5QUJSU1BBQVNJQUlBQWJHd1JBUVFFa2d3RkJCQkE2Q3dzTENRQWdBRUVBRUxZQkM1b0JBQ0FBUVFCS0JFQkJBQkMzQVFWQkFCQzRBUXNnQVVFQVNnUkFRUUVRdHdFRlFRRVF1QUVMSUFKQkFFb0VRRUVDRUxjQkJVRUNFTGdCQ3lBRFFRQktCRUJCQXhDM0FRVkJBeEM0QVFzZ0JFRUFTZ1JBUVFRUXR3RUZRUVFRdUFFTElBVkJBRW9FUUVFRkVMY0JCVUVGRUxnQkN5QUdRUUJLQkVCQkJoQzNBUVZCQmhDNEFRc2dCMEVBU2dSQVFRY1F0d0VGUVFjUXVBRUxDd1FBSXo4TEJBQWpRQXNFQUNOQkN3UUFJMElMQkFBalF3c0VBQ05FQ3dRQUkwVUxCQUFqUmdzRUFDTklDd1FBSTBjTEJnQWpTQkFCQ3dRQUkxWUxyd01CQ245QmdJQUNRWUNRQWlPNUFSc2hDVUdBdUFKQmdMQUNJN29CR3lFS0EwQWdCVUdBQWtnRVFFRUFJUVFEUUNBRVFZQUNTQVJBSUFrZ0JVRURkVUVGZENBS2FpQUVRUU4xYWlJRFFZQ1FmbW90QUFBUUxDRUlJQVZCQ0c4aEFVRUhJQVJCQ0c5cklRWkJBQ0VDQW44Z0FFRUFTaU02SWdjZ0J4c0VRQ0FEUVlEUWZtb3RBQUFoQWdzZ0FrSEFBSEVMQkVCQkJ5QUJheUVCQzBFQUlRY2dBVUVCZENBSWFpSURRWUNRZm1wQkFVRUFJQUpCQ0hFYklnZEJBWEZCRFhScUxRQUFJUWhCQUNFQklBTkJnWkIrYWlBSFFRRnhRUTEwYWkwQUFFRUJJQVowY1FSQVFRSWhBUXNnQVVFQmFpQUJRUUVnQm5RZ0NIRWJJUUVnQlVFSWRDQUVha0VEYkNFR0lBQkJBRW9qT2lJRElBTWJCRUFnQWtFSGNTQUJRUUFRTFNJQlFSOXhRUU4wSVFNZ0JrR0FvUXRxSWdJZ0F6b0FBQ0FDUVFGcUlBRkI0QWR4UVFWMVFRTjBPZ0FBSUFKQkFtb2dBVUdBK0FGeFFRcDFRUU4wT2dBQUJTQUJRY2YrQTBFQUVDNGhBa0VBSVFFRFFDQUJRUU5JQkVBZ0JrR0FvUXRxSUFGcUlBSTZBQUFnQVVFQmFpRUJEQUVMQ3dzZ0JFRUJhaUVFREFFTEN5QUZRUUZxSVFVTUFRc0xDOW9EQVF4L0EwQWdBMEVYVGtVRVFFRUFJUUlEUUNBQ1FSOUlCRUJCQVVFQUlBSkJEMG9iSVFrZ0EwRVBheUFESUFOQkQwb2JRUVIwSWdjZ0FrRVBhMm9nQWlBSGFpQUNRUTlLR3lFSFFZQ1FBa0dBZ0FJZ0EwRVBTaHNoQzBISC9nTWhDa0YvSVFGQmZ5RUlRUUFoQkFOQUlBUkJDRWdFUUVFQUlRQURRQ0FBUVFWSUJFQWdBRUVEZENBRWFrRUNkQ0lGUVlMOEEyb1FBU0FIUmdSQUlBVkJnL3dEYWhBQklRWkJBVUVBSUFaQkNIRkJBRWNqT2lNNkd4c2dDVVlFUUVFSUlRUkJCU0VBSUFZaUNFRVFjUVIvUWNuK0F3VkJ5UDREQ3lFS0N3c2dBRUVCYWlFQURBRUxDeUFFUVFGcUlRUU1BUXNMSUFoQkFFZ2pPaUlHSUFZYkJFQkJnTGdDUVlDd0FpTzZBUnNoQkVGL0lRQkJBQ0VCQTBBZ0FVRWdTQVJBUVFBaEJRTkFJQVZCSUVnRVFDQUZRUVYwSUFScUlBRnFJZ1pCZ0pCK2FpMEFBQ0FIUmdSQVFTQWhCU0FHSVFCQklDRUJDeUFGUVFGcUlRVU1BUXNMSUFGQkFXb2hBUXdCQ3dzZ0FFRUFUZ1IvSUFCQmdOQithaTBBQUFWQmZ3c2hBUXRCQUNFQUEwQWdBRUVJU0FSQUlBY2dDeUFKUVFCQkJ5QUFJQUpCQTNRZ0EwRURkQ0FBYWtINEFVR0FvUmNnQ2lBQklBZ1FMeG9nQUVFQmFpRUFEQUVMQ3lBQ1FRRnFJUUlNQVFzTElBTkJBV29oQXd3QkN3c0xtQUlCQ1g4RFFDQUVRUWhPUlFSQVFRQWhBUU5BSUFGQkJVZ0VRQ0FCUVFOMElBUnFRUUowSWdCQmdQd0RhaEFCR2lBQVFZSDhBMm9RQVJvZ0FFR0MvQU5xRUFFaEFrRUJJUVVqdXdFRVFDQUNRUUp2UVFGR0JFQWdBa0VCYXlFQ0MwRUNJUVVMSUFCQmcvd0RhaEFCSVFaQkFDRUhRUUZCQUNBR1FRaHhRUUJISXpvak9oc2JJUWRCeVA0RElRaEJ5ZjREUWNqK0F5QUdRUkJ4R3lFSVFRQWhBQU5BSUFBZ0JVZ0VRRUVBSVFNRFFDQURRUWhJQkVBZ0FDQUNha0dBZ0FJZ0IwRUFRUWNnQXlBRVFRTjBJQUZCQkhRZ0Eyb2dBRUVEZEdwQndBQkJnS0VnSUFoQmZ5QUdFQzhhSUFOQkFXb2hBd3dCQ3dzZ0FFRUJhaUVBREFFTEN5QUJRUUZxSVFFTUFRc0xJQVJCQVdvaEJBd0JDd3NMQlFBamhnRUxCUUFqaHdFTEJRQWppQUVMR0FFQmZ5T0tBU0VBSTRrQkJFQWdBRUVFY2lFQUN5QUFDeTBCQVg4Q1FBTkFJQUJCLy84RFRnMEJJQUJCZ0tISkJHb2dBQkJTT2dBQUlBQkJBV29oQUF3QUFBc0FDd3NVQUQ4QVFaUUJTQVJBUVpRQlB3QnJRQUFhQ3dzREFBRUxId0FDUUFKQUFrQWptUUlPQWdFQ0FBc0FDMEVBSVFBTElBQkJmeEN0QVFzSEFDQUFKSmtDQ3k4QUFrQUNRQUpBQWtBQ1FDT1pBZzRFQVFJREJBQUxBQXRCQVNFQUMwRi9JUUVMUVg4aEFnc2dBU0FDRUswQkN3QXpFSE52ZFhKalpVMWhjSEJwYm1kVlVrd2hZMjl5WlM5a2FYTjBMMk52Y21VdWRXNTBiM1ZqYUdWa0xuZGhjMjB1YldGdyIpOgphd2FpdCBOKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlnRVNZQXAvZjM5L2YzOS9mMzkvQUdBQUFHQUJmd0YvWUFKL2Z3QmdBWDhBWUFKL2Z3Ri9ZQUFCZjJBRGYzOS9BWDlnQTM5L2Z3QmdCbjkvZjM5L2Z3QmdCMzkvZjM5L2YzOEJmMkFIZjM5L2YzOS9md0JnQkg5L2YzOEJmMkFJZjM5L2YzOS9mMzhBWUFWL2YzOS9md0YvWUExL2YzOS9mMzkvZjM5L2YzOS9BWDlnQUFCZ0FuOS9BWDhEMVFIVEFRSUNBUUVEQVFFQkFRRUJBUUVCQkFRQkFRRUFCZ0VCQVFFQkFRRUJCQVFCQVFFQkFRRUJBUVlHQmdZT0JRY0hEd29MQ1FrSUNBTUVBUUVFQVFRQkFRRUJBUUlDQlFJQ0FnSUZEQVFFQkFFQ0JnSUNBd1FFQkFRQkFRRUJCQVVFQmdZRUF3SUZCQUVRQkFVRENBRUZBUVFCQlFRRUJnWURCUVFEQkFRRUF3TUlBZ0lDQkFJQ0FnSUNBZ0lEQkFRQ0JBUUNCQVFDQkFRQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJRUJnWUdFUVlDQWdVR0JnWUNBd1FFRFFZR0JnWUdCZ1lHQmdZR0JnUUJBUVlHQmdZQkFRRUNCQWNFQkFGd0FBRUZBd0VBQUFhWERKb0Nmd0JCQUF0L0FFR0FDQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FFQXQvQUVHQWdBRUxmd0JCZ0pBQkMzOEFRWUNBQWd0L0FFR0FrQU1MZndCQmdJQUJDMzhBUVlBUUMzOEFRWUNBQkF0L0FFR0FrQVFMZndCQmdBRUxmd0JCZ0pFRUMzOEFRWUM0QVF0L0FFR0F5UVVMZndCQmdOZ0ZDMzhBUVlDaEN3dC9BRUdBZ0F3TGZ3QkJnS0VYQzM4QVFZQ0FDUXQvQUVHQW9TQUxmd0JCZ1BnQUMzOEFRWUNRQkF0L0FFR0FpUjBMZndCQmdKa2hDMzhBUVlDQUNBdC9BRUdBbVNrTGZ3QkJnSUFJQzM4QVFZQ1pNUXQvQUVHQWdBZ0xmd0JCZ0prNUMzOEFRWUNBQ0F0L0FFR0FtY0VBQzM4QVFZQ0FDQXQvQUVHQW1ja0FDMzhBUVlDQUNBdC9BRUdBbWRFQUMzOEFRWUNJK0FNTGZ3QkJnS0hKQkF0L0FFSC8vd01MZndCQkFBdC9BRUdBb2MwRUMzOEFRWlFCQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIUC9nTUxmd0ZCQUF0L0FVSHcvZ01MZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQi93QUxmd0ZCL3dBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQmdLald1UWNMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWDhMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBOXdJTGZ3RkJnSUFJQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkIxZjREQzM4QlFkSCtBd3QvQVVIUy9nTUxmd0ZCMC80REMzOEJRZFQrQXd0L0FVSG8vZ01MZndGQjYvNERDMzhCUWVuK0F3dC9BVUVBQzM4QlFRRUxmd0ZCQWd0L0FFR0FvYzBFQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFZQ0FCQXQvQUVHQWtBUUxmd0JCZ0pBRUMzOEFRWUFCQzM4QVFZREpCUXQvQUVHQW9Rc0xmd0JCZ0tFWEMzOEFRWUNad1FBTGZ3QkJnSm5KQUF0L0FFR0FtZEVBQzM4QlFRQUxCN3NTYkFadFpXMXZjbmtDQUFWMFlXSnNaUUVBQm1OdmJtWnBad0FURG1oaGMwTnZjbVZUZEdGeWRHVmtBQlFKYzJGMlpWTjBZWFJsQUJzSmJHOWhaRk4wWVhSbEFDWUZhWE5IUWtNQUp4Sm5aWFJUZEdWd2MxQmxjbE4wWlhCVFpYUUFLQXRuWlhSVGRHVndVMlYwY3dBcENHZGxkRk4wWlhCekFDb1ZaWGhsWTNWMFpVMTFiSFJwY0d4bFJuSmhiV1Z6QUs4QkRHVjRaV04xZEdWR2NtRnRaUUN1QVFoZmMyVjBZWEpuWXdEUkFSbGxlR1ZqZFhSbFJuSmhiV1ZCYm1SRGFHVmphMEYxWkdsdkFOQUJHMlY0WldOMWRHVkdjbUZ0WlZWdWRHbHNRbkpsWVd0d2IybHVkQUN3QVNobGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2Vlc1MGFXeENjbVZoYTNCdmFXNTBBTEVCRldWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJnRFNBUXRsZUdWamRYUmxVM1JsY0FDckFSUm5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkQUN5QVF4blpYUkRlV05zWlZObGRITUFzd0VKWjJWMFEzbGpiR1Z6QUxRQkRuTmxkRXB2ZVhCaFpGTjBZWFJsQUxrQkgyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWElBckFFUVkyeGxZWEpCZFdScGIwSjFabVpsY2dBaUYxZEJVMDFDVDFsZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXlvVFYwRlRUVUpQV1Y5TlJVMVBVbGxmVTBsYVJRTXJFbGRCVTAxQ1QxbGZWMEZUVFY5UVFVZEZVd01zSGtGVFUwVk5Ra3haVTBOU1NWQlVYMDFGVFU5U1dWOU1UME5CVkVsUFRnTUFHa0ZUVTBWTlFreFpVME5TU1ZCVVgwMUZUVTlTV1Y5VFNWcEZBd0VXVjBGVFRVSlBXVjlUVkVGVVJWOU1UME5CVkVsUFRnTUNFbGRCVTAxQ1QxbGZVMVJCVkVWZlUwbGFSUU1ESUVkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd29jUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZVMGxhUlFNTEVsWkpSRVZQWDFKQlRWOU1UME5CVkVsUFRnTUVEbFpKUkVWUFgxSkJUVjlUU1ZwRkF3VVJWMDlTUzE5U1FVMWZURTlEUVZSSlQwNERCZzFYVDFKTFgxSkJUVjlUU1ZwRkF3Y21UMVJJUlZKZlIwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQ0NKUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXdrWVIxSkJVRWhKUTFOZlQxVlVVRlZVWDB4UFEwRlVTVTlPQXhnVVIxSkJVRWhKUTFOZlQxVlVVRlZVWDFOSldrVURHUlJIUWtOZlVFRk1SVlJVUlY5TVQwTkJWRWxQVGdNTUVFZENRMTlRUVV4RlZGUkZYMU5KV2tVRERSaENSMTlRVWtsUFVrbFVXVjlOUVZCZlRFOURRVlJKVDA0RERoUkNSMTlRVWtsUFVrbFVXVjlOUVZCZlUwbGFSUU1QRGtaU1FVMUZYMHhQUTBGVVNVOU9BeEFLUmxKQlRVVmZVMGxhUlFNUkYwSkJRMHRIVWs5VlRrUmZUVUZRWDB4UFEwRlVTVTlPQXhJVFFrRkRTMGRTVDFWT1JGOU5RVkJmVTBsYVJRTVRFbFJKVEVWZlJFRlVRVjlNVDBOQlZFbFBUZ01VRGxSSlRFVmZSRUZVUVY5VFNWcEZBeFVTVDBGTlgxUkpURVZUWDB4UFEwRlVTVTlPQXhZT1QwRk5YMVJKVEVWVFgxTkpXa1VERnhWQlZVUkpUMTlDVlVaR1JWSmZURTlEUVZSSlQwNERJaEZCVlVSSlQxOUNWVVpHUlZKZlUwbGFSUU1qR1VOSVFVNU9SVXhmTVY5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRER2hWRFNFRk9Ua1ZNWHpGZlFsVkdSa1ZTWDFOSldrVURHeGxEU0VGT1RrVk1YekpmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeHdWUTBoQlRrNUZURjh5WDBKVlJrWkZVbDlUU1ZwRkF4MFpRMGhCVGs1RlRGOHpYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWVGVU5JUVU1T1JVeGZNMTlDVlVaR1JWSmZVMGxhUlFNZkdVTklRVTVPUlV4Zk5GOUNWVVpHUlZKZlRFOURRVlJKVDA0RElCVkRTRUZPVGtWTVh6UmZRbFZHUmtWU1gxTkpXa1VESVJaRFFWSlVVa2xFUjBWZlVrRk5YMHhQUTBGVVNVOU9BeVFTUTBGU1ZGSkpSRWRGWDFKQlRWOVRTVnBGQXlVV1EwRlNWRkpKUkVkRlgxSlBUVjlNVDBOQlZFbFBUZ01tRWtOQlVsUlNTVVJIUlY5U1QwMWZVMGxhUlFNbkhVUkZRbFZIWDBkQlRVVkNUMWxmVFVWTlQxSlpYMHhQUTBGVVNVOU9BeWdaUkVWQ1ZVZGZSMEZOUlVKUFdWOU5SVTFQVWxsZlUwbGFSUU1wSVdkbGRGZGhjMjFDYjNsUFptWnpaWFJHY205dFIyRnRaVUp2ZVU5bVpuTmxkQUFBREdkbGRGSmxaMmx6ZEdWeVFRQzZBUXhuWlhSU1pXZHBjM1JsY2tJQXV3RU1aMlYwVW1WbmFYTjBaWEpEQUx3QkRHZGxkRkpsWjJsemRHVnlSQUM5QVF4blpYUlNaV2RwYzNSbGNrVUF2Z0VNWjJWMFVtVm5hWE4wWlhKSUFMOEJER2RsZEZKbFoybHpkR1Z5VEFEQUFReG5aWFJTWldkcGMzUmxja1lBd1FFUloyVjBVSEp2WjNKaGJVTnZkVzUwWlhJQXdnRVBaMlYwVTNSaFkydFFiMmx1ZEdWeUFNTUJHV2RsZEU5d1kyOWtaVUYwVUhKdlozSmhiVU52ZFc1MFpYSUF4QUVGWjJWMFRGa0F4UUVkWkhKaGQwSmhZMnRuY205MWJtUk5ZWEJVYjFkaGMyMU5aVzF2Y25rQXhnRVlaSEpoZDFScGJHVkVZWFJoVkc5WFlYTnRUV1Z0YjNKNUFNY0JFMlJ5WVhkUFlXMVViMWRoYzIxTlpXMXZjbmtBeUFFR1oyVjBSRWxXQU1rQkIyZGxkRlJKVFVFQXlnRUdaMlYwVkUxQkFNc0JCbWRsZEZSQlF3RE1BUk4xY0dSaGRHVkVaV0oxWjBkQ1RXVnRiM0o1QU0wQkJuVndaR0YwWlFDdUFRMWxiWFZzWVhScGIyNVRkR1Z3QUtzQkVtZGxkRUYxWkdsdlVYVmxkV1ZKYm1SbGVBQ3NBUTl5WlhObGRFRjFaR2x2VVhWbGRXVUFJZzUzWVhOdFRXVnRiM0o1VTJsNlpRT0xBaHgzWVhOdFFtOTVTVzUwWlhKdVlXeFRkR0YwWlV4dlkyRjBhVzl1QTR3Q0dIZGhjMjFDYjNsSmJuUmxjbTVoYkZOMFlYUmxVMmw2WlFPTkFoMW5ZVzFsUW05NVNXNTBaWEp1WVd4TlpXMXZjbmxNYjJOaGRHbHZiZ09PQWhsbllXMWxRbTk1U1c1MFpYSnVZV3hOWlcxdmNubFRhWHBsQTQ4Q0UzWnBaR1Z2VDNWMGNIVjBURzlqWVhScGIyNERrQUlpWm5KaGJXVkpibEJ5YjJkeVpYTnpWbWxrWlc5UGRYUndkWFJNYjJOaGRHbHZiZ09UQWh0bllXMWxZbTk1UTI5c2IzSlFZV3hsZEhSbFRHOWpZWFJwYjI0RGtRSVhaMkZ0WldKdmVVTnZiRzl5VUdGc1pYUjBaVk5wZW1VRGtnSVZZbUZqYTJkeWIzVnVaRTFoY0V4dlkyRjBhVzl1QTVRQ0MzUnBiR1ZFWVhSaFRXRndBNVVDRTNOdmRXNWtUM1YwY0hWMFRHOWpZWFJwYjI0RGxnSVJaMkZ0WlVKNWRHVnpURzlqWVhScGIyNERtQUlVWjJGdFpWSmhiVUpoYm10elRHOWpZWFJwYjI0RGx3SUlBczRCQ1FnQkFFRUFDd0hQQVFyODJnSFRBYzhCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFTWRTSUJSUTBBQWtBZ0FVRUJhdzROQVFFQkFnSUNBZ01EQkFRRkJnQUxEQVlMSUFCQmdKblJBR29QQ3lBQVFRRWpPQ0lBSXpsRklnRUVmeUFBUlFVZ0FRc2JRUTUwYWtHQW1kQUFhZzhMSUFCQmdKQithaU02Qkg4ak94QUJRUUZ4QlVFQUMwRU5kR29QQ3lBQUl6eEJEWFJxUVlEWnhnQnFEd3NnQUVHQWtINXFEd3RCQUNFQkFuOGpPZ1JBSXowUUFVRUhjU0VCQ3lBQlFRRklDd1JBUVFFaEFRc2dBVUVNZENBQWFrR0E4SDFxRHdzZ0FFR0FVR29MQ1FBZ0FCQUFMUUFBQzVrQkFFRUFKRDVCQUNRL1FRQWtRRUVBSkVGQkFDUkNRUUFrUTBFQUpFUkJBQ1JGUVFBa1JrRUFKRWRCQUNSSVFRQWtTVUVBSkVwQkFDUkxRUUFrVEVFQUpFMGpPZ1JBUVJFa1AwR0FBU1JHUVFBa1FFRUFKRUZCL3dFa1FrSFdBQ1JEUVFBa1JFRU5KRVVGUVFFa1AwR3dBU1JHUVFBa1FFRVRKRUZCQUNSQ1FkZ0JKRU5CQVNSRVFjMEFKRVVMUVlBQ0pFaEIvdjhESkVjTHBBRUJBbjlCQUNST1FRRWtUMEhIQWhBQklRRkJBQ1JRUVFBa1VVRUFKRkpCQUNSVFFRQWtPU0FCQkVBZ0FVRUJUaUlBQkVBZ0FVRURUQ0VBQ3lBQUJFQkJBU1JSQlNBQlFRVk9JZ0FFUUNBQlFRWk1JUUFMSUFBRVFFRUJKRklGSUFGQkQwNGlBQVJBSUFGQkUwd2hBQXNnQUFSQVFRRWtVd1VnQVVFWlRpSUFCRUFnQVVFZVRDRUFDeUFBQkVCQkFTUTVDd3NMQ3dWQkFTUlFDMEVCSkRoQkFDUThDd3NBSUFBUUFDQUJPZ0FBQ3k4QVFkSCtBMEgvQVJBRVFkTCtBMEgvQVJBRVFkUCtBMEgvQVJBRVFkVCtBMEgvQVJBRVFkWCtBMEgvQVJBRUM1Z0JBRUVBSkZSQkFDUlZRUUFrVmtFQUpGZEJBQ1JZUVFBa1dVRUFKRm9qT2dSQVFaQUJKRlpCd1A0RFFaRUJFQVJCd2Y0RFFZRUJFQVJCeFA0RFFaQUJFQVJCeC80RFFmd0JFQVFGUVpBQkpGWkJ3UDREUVpFQkVBUkJ3ZjREUVlVQkVBUkJ4djREUWY4QkVBUkJ4LzREUWZ3QkVBUkJ5UDREUWY4QkVBUkJ5ZjREUWY4QkVBUUxRYy8rQTBFQUVBUkI4UDREUVFFUUJBdFBBQ002QkVCQjZQNERRY0FCRUFSQjZmNERRZjhCRUFSQjZ2NERRY0VCRUFSQjYvNERRUTBRQkFWQjZQNERRZjhCRUFSQjZmNERRZjhCRUFSQjZ2NERRZjhCRUFSQjYvNERRZjhCRUFRTEN5OEFRWkQrQTBHQUFSQUVRWkgrQTBHL0FSQUVRWkwrQTBIekFSQUVRWlArQTBIQkFSQUVRWlQrQTBHL0FSQUVDeXdBUVpYK0EwSC9BUkFFUVpiK0EwRS9FQVJCbC80RFFRQVFCRUdZL2dOQkFCQUVRWm4rQTBHNEFSQUVDeklBUVpyK0EwSC9BQkFFUVp2K0EwSC9BUkFFUVp6K0EwR2ZBUkFFUVozK0EwRUFFQVJCbnY0RFFiZ0JFQVJCQVNSckN5MEFRWi8rQTBIL0FSQUVRYUQrQTBIL0FSQUVRYUgrQTBFQUVBUkJvdjREUVFBUUJFR2ovZ05CdndFUUJBczRBRUVQSkd4QkR5UnRRUThrYmtFUEpHOUJBQ1J3UVFBa2NVRUFKSEpCQUNSelFmOEFKSFJCL3dBa2RVRUJKSFpCQVNSM1FRQWtlQXRuQUVFQUpGdEJBQ1JjUVFBa1hVRUJKRjVCQVNSZlFRRWtZRUVCSkdGQkFTUmlRUUVrWTBFQkpHUkJBU1JsUVFFa1prRUFKR2RCQUNSb1FRQWthVUVBSkdvUUNCQUpFQW9RQzBHay9nTkI5d0FRQkVHbC9nTkI4d0VRQkVHbS9nTkI4UUVRQkJBTUN6Z0FJQUJCQVhGQkFFY2tlU0FBUVFKeFFRQkhKSG9nQUVFRWNVRUFSeVI3SUFCQkNIRkJBRWNrZkNBQVFSQnhRUUJISkgwZ0FDUitDejBBSUFCQkFYRkJBRWNrZnlBQVFRSnhRUUJISklBQklBQkJCSEZCQUVja2dRRWdBRUVJY1VFQVJ5U0NBU0FBUVJCeFFRQkhKSU1CSUFBa2hBRUxYUUJCQUNTRkFVRUFKSVlCUVFBa2h3RkJBQ1NJQVVFQUpJa0JRUUFraWdGQkFDU0xBVUVBSkl3Qkl6b0VRRUdFL2dOQkhoQUVRYUE5SklZQkJVR0UvZ05CcXdFUUJFSE0xd0lraGdFTFFZZitBMEg0QVJBRVFmZ0JKSW9CQzBJQVFRQWtqUUZCQUNTT0FTTTZCRUJCZ3Y0RFFmd0FFQVJCQUNTUEFVRUFKSkFCUVFBa2tRRUZRWUwrQTBIK0FCQUVRUUFrandGQkFTU1FBVUVBSkpFQkN3djJBUUVDZjBIREFoQUJJZ0ZCd0FGR0lnQUVmeUFBQlNBQlFZQUJSaU12SWdBZ0FCc0xCRUJCQVNRNkJVRUFKRG9MRUFJUUF4QUZFQVlRQnhBTlFRQVFEa0gvL3dNamZoQUVRZUVCRUE5QmovNERJNFFCRUFRUUVCQVJJem9FUUVIdy9nTkIrQUVRQkVIUC9nTkIvZ0VRQkVITi9nTkIvZ0FRQkVHQS9nTkJ6d0VRQkVHUC9nTkI0UUVRQkVIcy9nTkIvZ0VRQkVIMS9nTkJqd0VRQkFWQjhQNERRZjhCRUFSQnovNERRZjhCRUFSQnpmNERRZjhCRUFSQmdQNERRYzhCRUFSQmovNERRZUVCRUFRTFFRQWtMVUdBcU5hNUJ5U1NBVUVBSkpNQlFRQWtsQUZCZ0tqV3VRY2tsUUZCQUNTV0FVRUFKSmNCQzY0QkFDQUFRUUJLQkVCQkFTUXVCVUVBSkM0TElBRkJBRW9FUUVFQkpDOEZRUUFrTHdzZ0FrRUFTZ1JBUVFFa01BVkJBQ1F3Q3lBRFFRQktCRUJCQVNReEJVRUFKREVMSUFSQkFFb0VRRUVCSkRJRlFRQWtNZ3NnQlVFQVNnUkFRUUVrTXdWQkFDUXpDeUFHUVFCS0JFQkJBU1EwQlVFQUpEUUxJQWRCQUVvRVFFRUJKRFVGUVFBa05Rc2dDRUVBU2dSQVFRRWtOZ1ZCQUNRMkN5QUpRUUJLQkVCQkFTUTNCVUVBSkRjTEVCSUxEQUFqTFFSQVFRRVBDMEVBQzdJQkFFR0FDQ00vT2dBQVFZRUlJMEE2QUFCQmdnZ2pRVG9BQUVHRENDTkNPZ0FBUVlRSUkwTTZBQUJCaFFnalJEb0FBRUdHQ0NORk9nQUFRWWNJSTBZNkFBQkJpQWdqUnpzQkFFR0tDQ05JT3dFQVFZd0lJMGsyQWdBalNnUkFRWkVJUVFFNkFBQUZRWkVJUVFBNkFBQUxJMHNFUUVHU0NFRUJPZ0FBQlVHU0NFRUFPZ0FBQ3lOTUJFQkJrd2hCQVRvQUFBVkJrd2hCQURvQUFBc2pUUVJBUVpRSVFRRTZBQUFGUVpRSVFRQTZBQUFMQzZ3QkFFSElDU000T3dFQVFjb0pJenc3QVFBalRnUkFRY3dKUVFFNkFBQUZRY3dKUVFBNkFBQUxJMDhFUUVITkNVRUJPZ0FBQlVITkNVRUFPZ0FBQ3lOUUJFQkJ6Z2xCQVRvQUFBVkJ6Z2xCQURvQUFBc2pVUVJBUWM4SlFRRTZBQUFGUWM4SlFRQTZBQUFMSTFJRVFFSFFDVUVCT2dBQUJVSFFDVUVBT2dBQUN5TlRCRUJCMFFsQkFUb0FBQVZCMFFsQkFEb0FBQXNqT1FSQVFkSUpRUUU2QUFBRlFkSUpRUUE2QUFBTEMwc0FRZm9KSTRVQk5nSUFRZjRKSTRZQk5nSUFJNHNCQkVCQmdncEJBVG9BQUFWQmdncEJBRG9BQUFzampBRUVRRUdGQ2tFQk9nQUFCVUdGQ2tFQU9nQUFDMEdGL2dNamh3RVFCQXQ0QUNPYkFRUkFRZDRLUVFFNkFBQUZRZDRLUVFBNkFBQUxRZDhLSTV3Qk5nSUFRZU1LSTUwQk5nSUFRZWNLSTU0Qk5nSUFRZXdLSTU4Qk5nSUFRZkVLSTZBQk9nQUFRZklLSTZFQk9nQUFJNklCQkVCQjl3cEJBVG9BQUFWQjl3cEJBRG9BQUF0QitBb2pvd0UyQWdCQi9Rb2pwQUU3QVFBTFR3QWpwUUVFUUVHUUMwRUJPZ0FBQlVHUUMwRUFPZ0FBQzBHUkN5T21BVFlDQUVHVkN5T25BVFlDQUVHWkN5T29BVFlDQUVHZUN5T3BBVFlDQUVHakN5T3FBVG9BQUVHa0N5T3JBVG9BQUF0R0FDT3dBUVJBUWZRTFFRRTZBQUFGUWZRTFFRQTZBQUFMUWZVTEk3RUJOZ0lBUWZrTEk3SUJOZ0lBUWYwTEk3TUJOZ0lBUVlJTUk3UUJOZ0lBUVljTUk3VUJPd0VBQzZNQkFCQVZRYklJSTFVMkFnQkJ0Z2dqbUFFNkFBQkJ4UDRESTFZUUJDT1pBUVJBUWVRSVFRRTZBQUFGUWVRSVFRQTZBQUFMSTVvQkJFQkI1UWhCQVRvQUFBVkI1UWhCQURvQUFBc1FGaEFYUWF3S0kyYzJBZ0JCc0FvamFEb0FBRUd4Q2lOcE9nQUFFQmdRR1NPc0FRUkFRY0lMUVFFNkFBQUZRY0lMUVFBNkFBQUxRY01MSTYwQk5nSUFRY2NMSTY0Qk5nSUFRY3NMSTY4Qk93RUFFQnBCQUNRdEM2NEJBRUdBQ0MwQUFDUS9RWUVJTFFBQUpFQkJnZ2d0QUFBa1FVR0RDQzBBQUNSQ1FZUUlMUUFBSkVOQmhRZ3RBQUFrUkVHR0NDMEFBQ1JGUVljSUxRQUFKRVpCaUFndkFRQWtSMEdLQ0M4QkFDUklRWXdJS0FJQUpFa0NmMEVCUVpFSUxRQUFRUUJLRFFBYVFRQUxKRW9DZjBFQlFaSUlMUUFBUVFCS0RRQWFRUUFMSkVzQ2YwRUJRWk1JTFFBQVFRQktEUUFhUVFBTEpFd0NmMEVCUVpRSUxRQUFRUUJLRFFBYVFRQUxKRTBMWEFFQmYwRUFKRlZCQUNSV1FjVCtBMEVBRUFSQndmNERFQUZCZkhFaEFVRUFKSmdCUWNIK0F5QUJFQVFnQUFSQUFrQkJBQ0VBQTBBZ0FFR0FpUjFPRFFFZ0FFR0FrQVJxUWY4Qk9nQUFJQUJCQVdvaEFBd0FBQXNBQ3dzTGlBRUJBWDhqdGdFaEFTQUFRWUFCY1VFQVJ5UzJBU0FBUWNBQWNVRUFSeVMzQVNBQVFTQnhRUUJISkxnQklBQkJFSEZCQUVja3VRRWdBRUVJY1VFQVJ5UzZBU0FBUVFSeFFRQkhKTHNCSUFCQkFuRkJBRWNrdkFFZ0FFRUJjVUVBUnlTOUFTTzJBVVVnQVNBQkd3UkFRUUVRSFFzZ0FVVWlBQVIvSTdZQkJTQUFDd1JBUVFBUUhRc0xQZ0FDZjBFQlFlUUlMUUFBUVFCS0RRQWFRUUFMSkprQkFuOUJBVUhsQ0MwQUFFRUFTZzBBR2tFQUN5U2FBVUgvL3dNUUFSQU9RWS8rQXhBQkVBOExwUUVBUWNnSkx3RUFKRGhCeWdrdkFRQWtQQUovUVFGQnpBa3RBQUJCQUVvTkFCcEJBQXNrVGdKL1FRRkJ6UWt0QUFCQkFFb05BQnBCQUFza1R3Si9RUUZCemdrdEFBQkJBRW9OQUJwQkFBc2tVQUovUVFGQnp3a3RBQUJCQUVvTkFCcEJBQXNrVVFKL1FRRkIwQWt0QUFCQkFFb05BQnBCQUFza1VnSi9RUUZCMFFrdEFBQkJBRW9OQUJwQkFBc2tVd0ovUVFGQjBna3RBQUJCQUVvTkFCcEJBQXNrT1F0YkFFSDZDU2dDQUNTRkFVSCtDU2dDQUNTR0FRSi9RUUZCZ2dvdEFBQkJBRW9OQUJwQkFBc2tpd0VDZjBFQlFZVUtMUUFBUVFCS0RRQWFRUUFMSkl3QlFZWCtBeEFCSkljQlFZYitBeEFCSklnQlFZZitBeEFCSklvQkN3WUFRUUFrYWd0MkFBSi9RUUZCM2dvdEFBQkJBRW9OQUJwQkFBc2ttd0ZCM3dvb0FnQWtuQUZCNHdvb0FnQWtuUUZCNXdvb0FnQWtuZ0ZCN0Fvb0FnQWtud0ZCOFFvdEFBQWtvQUZCOGdvdEFBQWtvUUVDZjBFQlFmY0tMUUFBUVFCS0RRQWFRUUFMSktJQlFmZ0tLQUlBSktNQlFmMEtMd0VBSktRQkMwNEFBbjlCQVVHUUN5MEFBRUVBU2cwQUdrRUFDeVNsQVVHUkN5Z0NBQ1NtQVVHVkN5Z0NBQ1NuQVVHWkN5Z0NBQ1NvQVVHZUN5Z0NBQ1NwQVVHakN5MEFBQ1NxQVVHa0N5MEFBQ1NyQVF0RkFBSi9RUUZCOUFzdEFBQkJBRW9OQUJwQkFBc2tzQUZCOVFzb0FnQWtzUUZCK1Fzb0FnQWtzZ0ZCL1Fzb0FnQWtzd0ZCZ2d3b0FnQWt0QUZCaHd3dkFRQWt0UUVMMEFFQkFYOFFIRUd5Q0NnQ0FDUlZRYllJTFFBQUpKZ0JRY1QrQXhBQkpGWkJ3UDRERUFFUUhoQWZRWUQrQXhBQlFmOEJjeVMrQVNPK0FTSUFRUkJ4UVFCSEpMOEJJQUJCSUhGQkFFY2t3QUVRSUJBaFFhd0tLQUlBSkdkQnNBb3RBQUFrYUVHeENpMEFBQ1JwUVFBa2FoQWpFQ1FDZjBFQlFjSUxMUUFBUVFCS0RRQWFRUUFMSkt3QlFjTUxLQUlBSkswQlFjY0xLQUlBSks0QlFjc0xMd0VBSks4QkVDVkJBQ1F0UVlDbzFya0hKSklCUVFBa2t3RkJBQ1NVQVVHQXFOYTVCeVNWQVVFQUpKWUJRUUFrbHdFTERBQWpPZ1JBUVFFUEMwRUFDd1VBSTVVQkN3VUFJNVlCQ3dVQUk1Y0JDOWdDQVFWL0FuOENmeUFCUVFCS0lnVUVRQ0FBUVFoS0lRVUxJQVVMQkVBandnRWdCRVloQlFzZ0JRc0VmeVBEQVNBQVJnVWdCUXNFUUVFQUlRVkJBQ0VFSUFOQkFXc1FBVUVnY1FSQVFRRWhCUXNnQXhBQlFTQnhCRUJCQVNFRUMwRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQVFnQlVjYklnTWdBR3BCb0FGTUJFQWdBRUVJSUFOcmF5RUhJQUFnQTJvZ0FVR2dBV3hxUVFOc1FZREpCV29oQ1VFQUlRWURRQ0FHUVFOSUJFQWdBQ0FEYWlBQlFhQUJiR3BCQTJ4QmdNa0ZhaUFHYWlBR0lBbHFMUUFBT2dBQUlBWkJBV29oQmd3QkN3c2dBQ0FEYWlBQlFhQUJiR3BCZ0pFRWFpQUJRYUFCYkNBSGFrR0FrUVJxTFFBQUlnWkJBM0VpQjBFRWNpQUhJQVpCQkhFYk9nQUFJQWhCQVdvaENBc2dBMEVCYWlFRERBRUxDd1VnQkNUQ0FRc2dBQ1BEQVU0RVFDQUFRUWhxSk1NQklBQWdBa0VJYnlJRVNBUkFJOE1CSUFScUpNTUJDd3NnQ0FzNEFRRi9JQUJCZ0pBQ1JnUkFJQUZCZ0FGcUlRSWdBVUdBQVhFRVFDQUJRWUFCYXlFQ0N5QUNRUVIwSUFCcUR3c2dBVUVFZENBQWFndEtBQ0FBUVFOMElBRkJBWFJxSWdCQkFXcEJQM0VpQVVGQWF5QUJJQUliUVlDUUJHb3RBQUFoQVNBQVFUOXhJZ0JCUUdzZ0FDQUNHMEdBa0FScUxRQUFJQUZCL3dGeFFRaDBjZ3RSQUNBQ1JRUkFJQUVRQVNBQVFRRjBkVUVEY1NFQUMwSHlBU0VCQWtBZ0FFVU5BQUpBQWtBQ1FBSkFJQUJCQVdzT0F3RUNBd0FMREFNTFFhQUJJUUVNQWd0QjJBQWhBUXdCQzBFSUlRRUxJQUVMaXdNQkJuOGdBU0FBRUN3Z0JVRUJkR29pQUVHQWtINXFJQUpCQVhGQkRYUWlBV290QUFBaEVTQUFRWUdRZm1vZ0FXb3RBQUFoRWlBRElRQURRQ0FBSUFSTUJFQWdBQ0FEYXlBR2FpSU9JQWhJQkVCQkJ5QUFheUVGSUF0QkFFZ2lBZ1IvSUFJRklBdEJJSEZGQ3lFQlFRQWhBZ0ovUVFFZ0JTQUFJQUViSWdGMElCSnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBWFFnRVhFYklRSWpPZ1IvSUF0QkFFNGlBUVIvSUFFRklBeEJBRTRMQlNNNkN3Ui9JQXRCQjNFaEJTQU1RUUJPSWdFRVFDQU1RUWR4SVFVTElBVWdBaUFCRUMwaUJVRWZjVUVEZENFUElBVkI0QWR4UVFWMVFRTjBJUUVnQlVHQStBRnhRUXAxUVFOMEJTQUNRY2YrQXlBS0lBcEJBRXdiSWdwQkFCQXVJZ1VoRHlBRklnRUxJUVVnQnlBSWJDQU9ha0VEYkNBSmFpSVFJQTg2QUFBZ0VFRUJhaUFCT2dBQUlCQkJBbW9nQlRvQUFDQUhRYUFCYkNBT2FrR0FrUVJxSUFKQkEzRWlBVUVFY2lBQklBdEJnQUZ4UVFCSFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzRBQkFRTi9JQU5CQ0c4aEF5QUFSUVJBSUFJZ0FrRUliVUVEZEdzaEJ3dEJvQUVnQUd0QkJ5QUFRUWhxUWFBQlNoc2hDVUYvSVFJak9nUkFJQVJCZ05CK2FpMEFBQ0lDUVFoeEJFQkJBU0VJQ3lBQ1FjQUFjUVJBUVFjZ0Eyc2hBd3NMSUFZZ0JTQUlJQWNnQ1NBRElBQWdBVUdnQVVHQXlRVkJBQ0FDUVg4UUx3dW1BZ0FnQlNBR0VDd2hCaUFEUVFodklRTWdCRUdBMEg1cUxRQUFJZ1JCd0FCeEJIOUJCeUFEYXdVZ0F3dEJBWFFnQm1vaUEwR0FrSDVxUVFGQkFDQUVRUWh4RzBFQmNVRU5kQ0lGYWkwQUFDRUdJQU5CZ1pCK2FpQUZhaTBBQUNFRklBSkJDRzhoQTBFQUlRSWdBVUdnQVd3Z0FHcEJBMnhCZ01rRmFpQUVRUWR4QW45QkFTQURRUWNnQTJzZ0JFRWdjUnNpQTNRZ0JYRUVRRUVDSVFJTElBSkJBV29MSUFKQkFTQURkQ0FHY1JzaUFrRUFFQzBpQTBFZmNVRURkRG9BQUNBQlFhQUJiQ0FBYWtFRGJFR0J5UVZxSUFOQjRBZHhRUVYxUVFOME9nQUFJQUZCb0FGc0lBQnFRUU5zUVlMSkJXb2dBMEdBK0FGeFFRcDFRUU4wT2dBQUlBRkJvQUZzSUFCcVFZQ1JCR29nQWtFRGNTSUFRUVJ5SUFBZ0JFR0FBWEViT2dBQUM3VUJBQ0FFSUFVUUxDQURRUWh2UVFGMGFpSUVRWUNRZm1vdEFBQWhCVUVBSVFNZ0FVR2dBV3dnQUdwQkEyeEJnTWtGYWdKL0lBUkJnWkIrYWkwQUFFRUJRUWNnQWtFSWIyc2lBblJ4QkVCQkFpRURDeUFEUVFGcUN5QURRUUVnQW5RZ0JYRWJJZ05CeC80RFFRQVFMaUlDT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUhKQldvZ0Fqb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQUk2QUFBZ0FVR2dBV3dnQUdwQmdKRUVhaUFEUVFOeE9nQUFDOVVCQVFaL0lBTkJBM1VoQ3dOQUlBUkJvQUZJQkVBZ0JDQUZhaUlHUVlBQ1RnUkFJQVpCZ0FKcklRWUxJQXRCQlhRZ0Ftb2dCa0VEZFdvaUNVR0FrSDVxTFFBQUlRaEJBQ0VLSXpZRVFDQUVJQUFnQmlBSklBZ1FLeUlIUVFCS0JFQkJBU0VLSUFkQkFXc2dCR29oQkFzTElBcEZJelVpQnlBSEd3UkFJQVFnQUNBR0lBTWdDU0FCSUFnUU1DSUhRUUJLQkVBZ0IwRUJheUFFYWlFRUN3VWdDa1VFUUNNNkJFQWdCQ0FBSUFZZ0F5QUpJQUVnQ0JBeEJTQUVJQUFnQmlBRElBRWdDQkF5Q3dzTElBUkJBV29oQkF3QkN3c0xLd0VCZnlOWElRTWdBQ0FCSUFJaldDQUFhaUlBUVlBQ1RnUi9JQUJCZ0FKckJTQUFDMEVBSUFNUU13c3dBUU4vSTFraEF5QUFJMW9pQkVnRVFBOExJQU5CQjJzaUEwRi9iQ0VGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRE1MeEFVQkQzOENRRUVuSVFrRFFDQUpRUUJJRFFFZ0NVRUNkQ0lFUVlEOEEyb1FBU0VDSUFSQmdmd0RhaEFCSVFvZ0JFR0MvQU5xRUFFaEF5QUNRUkJySVFJZ0NrRUlheUVLUVFnaEJTQUJCRUJCRUNFRklBTkJBbTlCQVVZRWZ5QURRUUZyQlNBREN5RURDeUFBSUFKT0lnWUVRQ0FBSUFJZ0JXcElJUVlMSUFZRVFDQUVRWVA4QTJvUUFTSUdRWUFCY1VFQVJ5RUxJQVpCSUhGQkFFY2hEa0dBZ0FJZ0F4QXNJQUFnQW1zaUFpQUZhMEYvYkVFQmF5QUNJQVpCd0FCeEcwRUJkR29pQTBHQWtINXFRUUZCQUNBR1FRaHhRUUJISXpvaUFpQUNHeHRCQVhGQkRYUWlBbW90QUFBaER5QURRWUdRZm1vZ0Ftb3RBQUFoRUVFSElRVURRQ0FGUVFCT0JFQkJBQ0VJQW45QkFTQUZJZ0pCQjJ0QmYyd2dBaUFPR3lJQ2RDQVFjUVJBUVFJaENBc2dDRUVCYWdzZ0NFRUJJQUowSUE5eEd5SUlCRUJCQnlBRmF5QUthaUlIUVFCT0lnSUVRQ0FIUWFBQlRDRUNDeUFDQkVCQkFDRU1RUUFoRFVFQlFRQWp2UUZGSXpvaUF5QURHeHNpQWtVRVFDQUFRYUFCYkNBSGFrR0FrUVJxTFFBQUlnTkJBM0VpQkVFQVNpQUxJQXNiQkVCQkFTRU1CU0FEUVFSeFFRQkhJem9pQXlBREd5SURCRUFnQkVFQVNpRURDMEVCUVFBZ0F4c2hEUXNMSUFKRkJFQWdERVVpQkFSL0lBMUZCU0FFQ3lFQ0N5QUNCRUFqT2dSQUlBQkJvQUZzSUFkcVFRTnNRWURKQldvZ0JrRUhjU0FJUVFFUUxTSUVRUjl4UVFOME9nQUFJQUJCb0FGc0lBZHFRUU5zUVlISkJXb2dCRUhnQjNGQkJYVkJBM1E2QUFBZ0FFR2dBV3dnQjJwQkEyeEJnc2tGYWlBRVFZRDRBWEZCQ25WQkEzUTZBQUFGSUFCQm9BRnNJQWRxUVFOc1FZREpCV29nQ0VISi9nTkJ5UDRESUFaQkVIRWJRUUFRTGlJRE9nQUFJQUJCb0FGc0lBZHFRUU5zUVlISkJXb2dBem9BQUNBQVFhQUJiQ0FIYWtFRGJFR0N5UVZxSUFNNkFBQUxDd3NMSUFWQkFXc2hCUXdCQ3dzTElBbEJBV3NoQ1F3QUFBc0FDd3RtQVFKL1FZQ1FBaUVCUVlDQUFrR0FrQUlqdVFFYklRRWpPaU85QVNNNkd3UkFRWUN3QWlFQ0lBQWdBVUdBdUFKQmdMQUNJN29CR3hBMEN5TzRBUVJBUVlDd0FpRUNJQUFnQVVHQXVBSkJnTEFDSTdjQkd4QTFDeU84QVFSQUlBQWp1d0VRTmdzTEpRRUJmd0pBQTBBZ0FFR1FBVXNOQVNBQVFmOEJjUkEzSUFCQkFXb2hBQXdBQUFzQUN3dEdBUUovQTBBZ0FVR1FBVTVGQkVCQkFDRUFBMEFnQUVHZ0FVZ0VRQ0FCUWFBQmJDQUFha0dBa1FScVFRQTZBQUFnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTEN4MEJBWDlCai80REVBRkJBU0FBZEhJaUFTU0VBVUdQL2dNZ0FSQUVDd3NBUVFFa2dBRkJBUkE2QzBVQkFuOUJsUDRERUFGQitBRnhJUUZCay80RElBQkIvd0Z4SWdJUUJFR1UvZ01nQVNBQVFRaDFJZ0J5RUFRZ0FpVFBBU0FBSk5BQkk4OEJJOUFCUVFoMGNpVFJBUXRtQVFKL0k2UUJJZ0VqelFGMUlRQWdBU0FBYXlBQUlBRnFJODRCR3lJQVFmOFBUQ0lCQkg4anpRRkJBRW9GSUFFTEJFQWdBQ1NrQVNBQUVEd2pwQUVpQVNQTkFYVWhBQ0FCSUFCcklBQWdBV29qemdFYklRQUxJQUJCL3c5S0JFQkJBQ1NiQVFzTExBQWpvd0ZCQVdza293RWpvd0ZCQUV3RVFDUE1BU1NqQVNQTUFVRUFTaU9pQVNPaUFSc0VRQkE5Q3dzTFd3RUJmeU9kQVVFQmF5U2RBU09kQVVFQVRBUkFJOUlCSkowQkk1MEJCRUFqbndGQkQwZ2owd0VqMHdFYkJFQWpud0ZCQVdva253RUZJOU1CUlNJQUJFQWpud0ZCQUVvaEFBc2dBQVJBSTU4QlFRRnJKSjhCQ3dzTEN3dGJBUUYvSTZjQlFRRnJKS2NCSTZjQlFRQk1CRUFqMUFFa3B3RWpwd0VFUUNPcEFVRVBTQ1BWQVNQVkFSc0VRQ09wQVVFQmFpU3BBUVVqMVFGRklnQUVRQ09wQVVFQVNpRUFDeUFBQkVBanFRRkJBV3NrcVFFTEN3c0xDMXNCQVg4anNnRkJBV3Nrc2dFanNnRkJBRXdFUUNQV0FTU3lBU095QVFSQUk3UUJRUTlJSTljQkk5Y0JHd1JBSTdRQlFRRnFKTFFCQlNQWEFVVWlBQVJBSTdRQlFRQktJUUFMSUFBRVFDTzBBVUVCYXlTMEFRc0xDd3NMamdZQUkyY2dBR29rWnlObkl6NEVmMEdBZ0FFRlFZREFBQXRPQkVBalp5TStCSDlCZ0lBQkJVR0F3QUFMYXlSbkFrQUNRQUpBQWtBQ1FDTnBJZ0FFUUNBQVFRSnJEZ1lCQlFJRkF3UUZDeU9lQVVFQVNpSUFCSDhqeUFFRklBQUxCRUFqbmdGQkFXc2tuZ0VMSTU0QlJRUkFRUUFrbXdFTEk2Z0JRUUJLSWdBRWZ5UEpBUVVnQUFzRVFDT29BVUVCYXlTb0FRc2pxQUZGQkVCQkFDU2xBUXNqcmdGQkFFb2lBQVIvSThvQkJTQUFDd1JBSTY0QlFRRnJKSzRCQ3lPdUFVVUVRRUVBSkt3QkN5T3pBVUVBU2lJQUJIOGp5d0VGSUFBTEJFQWpzd0ZCQVdza3N3RUxJN01CUlFSQVFRQWtzQUVMREFRTEk1NEJRUUJLSWdBRWZ5UElBUVVnQUFzRVFDT2VBVUVCYXlTZUFRc2puZ0ZGQkVCQkFDU2JBUXNqcUFGQkFFb2lBQVIvSThrQkJTQUFDd1JBSTZnQlFRRnJKS2dCQ3lPb0FVVUVRRUVBSktVQkN5T3VBVUVBU2lJQUJIOGp5Z0VGSUFBTEJFQWpyZ0ZCQVdza3JnRUxJNjRCUlFSQVFRQWtyQUVMSTdNQlFRQktJZ0FFZnlQTEFRVWdBQXNFUUNPekFVRUJheVN6QVFzanN3RkZCRUJCQUNTd0FRc1FQZ3dEQ3lPZUFVRUFTaUlBQkg4anlBRUZJQUFMQkVBam5nRkJBV3NrbmdFTEk1NEJSUVJBUVFBa213RUxJNmdCUVFCS0lnQUVmeVBKQVFVZ0FBc0VRQ09vQVVFQmF5U29BUXNqcUFGRkJFQkJBQ1NsQVFzanJnRkJBRW9pQUFSL0k4b0JCU0FBQ3dSQUk2NEJRUUZySks0QkN5T3VBVVVFUUVFQUpLd0JDeU96QVVFQVNpSUFCSDhqeXdFRklBQUxCRUFqc3dGQkFXc2tzd0VMSTdNQlJRUkFRUUFrc0FFTERBSUxJNTRCUVFCS0lnQUVmeVBJQVFVZ0FBc0VRQ09lQVVFQmF5U2VBUXNqbmdGRkJFQkJBQ1NiQVFzanFBRkJBRW9pQUFSL0k4a0JCU0FBQ3dSQUk2Z0JRUUZySktnQkN5T29BVVVFUUVFQUpLVUJDeU91QVVFQVNpSUFCSDhqeWdFRklBQUxCRUFqcmdGQkFXc2tyZ0VMSTY0QlJRUkFRUUFrckFFTEk3TUJRUUJLSWdBRWZ5UExBUVVnQUFzRVFDT3pBVUVCYXlTekFRc2pzd0ZGQkVCQkFDU3dBUXNRUGd3QkN4QS9FRUFRUVFzamFVRUJhaVJwSTJsQkNFNEVRRUVBSkdrTFFRRVBDMEVBQzRNQkFRRi9Ba0FDUUFKQUFrQWdBRUVCUndSQUlBQWlBVUVDUmcwQklBRkJBMFlOQWlBQlFRUkdEUU1NQkFzamNDUFpBVWNFUUNQWkFTUndRUUVQQzBFQUR3c2pjU1BhQVVjRVFDUGFBU1J4UVFFUEMwRUFEd3NqY2lQYkFVY0VRQ1BiQVNSeVFRRVBDMEVBRHdzamN5UGNBVWNFUUNQY0FTUnpRUUVQQzBFQUR3dEJBQXRWQUFKQUFrQUNRQ0FBUVFGSEJFQWdBRUVDUmcwQklBQkJBMFlOQWd3REMwRUJJQUYwUVlFQmNVRUFSdzhMUVFFZ0FYUkJod0Z4UVFCSER3dEJBU0FCZEVIK0FIRkJBRWNQQzBFQklBRjBRUUZ4UVFCSEM0b0JBUUYvSTV3QklBQnJKSndCSTV3QlFRQk1CRUFqbkFFaUFVRWZkU0VBUVlBUUk5RUJhMEVDZENTY0FTTStCRUFqbkFGQkFYUWtuQUVMSTV3QklBQWdBV29nQUhOckpKd0JJNkVCUVFGcUpLRUJJNkVCUVFoT0JFQkJBQ1NoQVFzTEk5a0JJNXNCSWdBZ0FCc0VmeU9mQVFWQkR3OExJK0FCSTZFQkVFUUVmMEVCQlVGL0MyeEJEMm9MaWdFQkFYOGpwZ0VnQUdza3BnRWpwZ0ZCQUV3RVFDT21BU0lCUVI5MUlRQkJnQkFqNFFGclFRSjBKS1lCSXo0RVFDT21BVUVCZENTbUFRc2pwZ0VnQUNBQmFpQUFjMnNrcGdFanF3RkJBV29rcXdFanF3RkJDRTRFUUVFQUpLc0JDd3NqMmdFanBRRWlBQ0FBR3dSL0k2a0JCVUVQRHdzajRnRWpxd0VRUkFSL1FRRUZRWDhMYkVFUGFndVpBZ0VDZnlPdEFTQUFheVN0QVNPdEFVRUFUQVJBSTYwQklnSkJIM1VoQUVHQUVDUGpBV3RCQVhRa3JRRWpQZ1JBSTYwQlFRRjBKSzBCQ3lPdEFTQUFJQUpxSUFCemF5U3RBU092QVVFQmFpU3ZBU092QVVFZ1RnUkFRUUFrcndFTEMwRUFJUUlqNUFFaEFDUGJBU09zQVNJQklBRWJCRUFqYXdSQVFaeitBeEFCUVFWMVFROXhJZ0FrNUFGQkFDUnJDd1ZCRHc4TEk2OEJRUUp0UWJEK0Eyb1FBU0VCSTY4QlFRSnZCSDhnQVVFUGNRVWdBVUVFZFVFUGNRc2hBUUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVnQUVFQ1JnMENEQU1MSUFGQkJIVWhBUXdEQzBFQklRSU1BZ3NnQVVFQmRTRUJRUUloQWd3QkN5QUJRUUoxSVFGQkJDRUNDeUFDUVFCS0JIOGdBU0FDYlFWQkFBdEJEMm9McXdFQkFYOGpzUUVnQUdza3NRRWpzUUZCQUV3RVFDT3hBU0VBSStVQkkrWUJkQ0lCUVFGMElBRWpQaHNrc1FFanNRRWdBRUVmZFNJQklBQWdBV3B6YXlTeEFTTzFBU0lBUVFGeElRRWdBRUVCZFNJQUpMVUJJN1VCSUFFZ0FFRUJjWE1pQVVFT2RISWt0UUVqNXdFRVFDTzFBVUcvZjNFa3RRRWp0UUVnQVVFR2RISWt0UUVMQ3lQY0FTT3dBU0lBSUFBYkJIOGp0QUVGUVE4UEMwRi9RUUVqdFFGQkFYRWJiRUVQYWdzd0FDQUFRVHhHQkVCQi93QVBDeUFBUVR4clFhQ05CbXdnQVd4QkNHMUJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMExuQUVCQVg5QkFDUjJJQUJCRHlOZUd5SUVJQUZxSUFSQkQyb2pYeHNpQkNBQ2FpQUVRUTlxSTJBYklRUWdBeUFDSUFFZ0FFRVBJMkliSWdCcUlBQkJEMm9qWXhzaUFHb2dBRUVQYWlOa0d5SUFhaUFBUVE5cUkyVWJJUUJCQUNSM1FRQWtlQ0FESUFScUlBUkJEMm9qWVJzalhFRUJhaEJKSVFFZ0FDTmRRUUZxRUVraEFDQUJKSFFnQUNSMUlBQkIvd0Z4SUFGQi93RnhRUWgwY2d2REF3RUZmd0ovSTlnQklBQnFKTmdCUVFBam5BRWoyQUZyUVFCS0RRQWFRUUVMSWdGRkJFQkJBUkJESVFFTEFuOGozUUVnQUdvazNRRkJBQ09tQVNQZEFXdEJBRW9OQUJwQkFRc2lCRVVFUUVFQ0VFTWhCQXNDZnlQZUFTQUFhaVRlQVNPdEFTUGVBV3RCQUVvaUFnUkFJMnRGSVFJTFFRQWdBZzBBR2tFQkN5SUNSUVJBUVFNUVF5RUNDd0ovSTk4QklBQnFKTjhCUVFBanNRRWozd0ZyUVFCS0RRQWFRUUVMSWdWRkJFQkJCQkJESVFVTElBRUVRQ1BZQVNFRFFRQWsyQUVnQXhCRkpHd0xJQVFFUUNQZEFTRURRUUFrM1FFZ0F4QkdKRzBMSUFJRVFDUGVBU0VEUVFBazNnRWdBeEJISkc0TElBVUVRQ1BmQVNFRFFRQWszd0VnQXhCSUpHOExBbjhnQVNBRUlBRWJJZ0ZGQkVBZ0FpRUJDeUFCUlFzRVFDQUZJUUVMSUFFRVFFRUJKSGdMSTJnajZBRWdBR3hxSkdnamFFR0FnSUFFUVlDQWdBSWpQaHRPQkVBamFFR0FnSUFFUVlDQWdBSWpQaHRySkdnamVDSUFJM1lnQUJzaUFVVUVRQ04zSVFFTElBRUVRQ05zSTIwamJpTnZFRW9hQ3lOcUlnRkJBWFJCZ0puQkFHb2lBQ04wUVFKcU9nQUFJQUJCQVdvamRVRUNham9BQUNBQlFRRnFKR29qYWlQcEFVRUNiVUVCYTA0RVFDTnFRUUZySkdvTEN3dWNBd0VGZnlBQUVFVWhBaUFBRUVZaEFTQUFFRWNoQXlBQUVFZ2hCQ0FDSkd3Z0FTUnRJQU1rYmlBRUpHOGphQ1BvQVNBQWJHb2thQ05vUVlDQWdBUkJnSUNBQWlNK0cwNEVRQ05vUVlDQWdBUkJnSUNBQWlNK0cyc2thQ0FDSUFFZ0F5QUVFRW9oQUNOcVFRRjBRWUNad1FCcUlnVWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBVkJBV29nQUVIL0FYRkJBbW82QUFBak53UkFJQUpCRDBFUFFROFFTaUVBSTJwQkFYUkJnSmtoYWlJQ0lBQkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUJCL3dGeFFRSnFPZ0FBUVE4Z0FVRVBRUThRU2lFQUkycEJBWFJCZ0prcGFpSUJJQUJCZ1A0RGNVRUlkVUVDYWpvQUFDQUJRUUZxSUFCQi93RnhRUUpxT2dBQVFROUJEeUFEUVE4UVNpRUFJMnBCQVhSQmdKa3hhaUlCSUFCQmdQNERjVUVJZFVFQ2Fqb0FBQ0FCUVFGcUlBQkIvd0Z4UVFKcU9nQUFRUTlCRDBFUElBUVFTaUVBSTJwQkFYUkJnSms1YWlJQklBQkJnUDREY1VFSWRVRUNham9BQUNBQlFRRnFJQUJCL3dGeFFRSnFPZ0FBQ3lOcVFRRnFKR29qYWlQcEFVRUNiVUVCYTA0RVFDTnFRUUZySkdvTEN3c2VBUUYvSUFBUVFpRUJJQUZGSXpRak5Cc0VRQ0FBRUVzRklBQVFUQXNMU3dBald5TStCSDlCcmdFRlFkY0FDMGdFUUE4TEEwQWpXeU0rQkg5QnJnRUZRZGNBQzA0RVFDTStCSDlCcmdFRlFkY0FDeEJOSTFzalBnUi9RYTRCQlVIWEFBdHJKRnNNQVFzTEN5RUFJQUJCcHY0RFJnUkFRYWIrQXhBQlFZQUJjU0VBSUFCQjhBQnlEd3RCZnd1Y0FRRUJmeU8rQVNFQUk3OEJCRUFnQUVGN2NTQUFRUVJ5SStvQkd5RUFJQUJCZm5FZ0FFRUJjaVByQVJzaEFDQUFRWGR4SUFCQkNISWo3QUViSVFBZ0FFRjljU0FBUVFKeUkrMEJHeUVBQlNQQUFRUkFJQUJCZm5FZ0FFRUJjaVB1QVJzaEFDQUFRWDF4SUFCQkFuSWo3d0ViSVFBZ0FFRjdjU0FBUVFSeUkvQUJHeUVBSUFCQmQzRWdBRUVJY2lQeEFSc2hBQXNMSUFCQjhBRnlDODhDQVFGL0lBQkJnSUFDU0FSQVFYOFBDeUFBUVlDQUFrNGlBUVIvSUFCQmdNQUNTQVVnQVFzRVFFRi9Ed3NnQUVHQXdBTk9JZ0VFZnlBQVFZRDhBMGdGSUFFTEJFQWdBRUdBUUdvUUFROExJQUJCZ1B3RFRpSUJCSDhnQUVHZi9RTk1CU0FCQ3dSQUk1Z0JRUUpJQkVCQi93RVBDMEYvRHdzZ0FFSE4vZ05HQkVCQi93RWhBVUhOL2dNUUFVRUJjVVVFUUVIK0FTRUJDeU0rUlFSQUlBRkIvMzV4SVFFTElBRVBDeUFBUWNUK0EwWUVRQ0FBSTFZUUJDTldEd3NnQUVHUS9nTk9JZ0VFZnlBQVFhYitBMHdGSUFFTEJFQVFUaUFBRUU4UEN5QUFRYkQrQTA0aUFRUi9JQUJCdi80RFRBVWdBUXNFUUJCT1FYOFBDeUFBUVlUK0EwWUVRQ0FBSTRZQlFZRCtBM0ZCQ0hVaUFSQUVJQUVQQ3lBQVFZWCtBMFlFUUNBQUk0Y0JFQVFqaHdFUEN5QUFRWS8rQTBZRVFDT0VBVUhnQVhJUEN5QUFRWUQrQTBZRVFCQlFEd3RCZndzYkFRRi9JQUFRVVNJQlFYOUdCRUFnQUJBQkR3c2dBVUgvQVhFTHRnSUJBWDhqVUFSQUR3c2dBRUgvUDB3RVFDTlNCSDhnQVVFUWNVVUZJMUlMUlFSQUlBRkJEM0VpQWdSQUlBSkJDa1lFUUVFQkpFNExCVUVBSkU0TEN3VWdBRUgvL3dCTUJFQWpPVVVpQWdSL0lBSUZJQUJCLzk4QVRBc0VRQ05TQkVBZ0FVRVBjU1E0Q3lBQklRSWpVUVJBSUFKQkgzRWhBaU00UWVBQmNTUTRCU05UQkVBZ0FrSC9BSEVoQWlNNFFZQUJjU1E0QlNNNUJFQkJBQ1E0Q3dzTEl6Z2dBbklrT0FVak9FSC9BWEZCQVVFQUlBRkJBRW9iUWY4QmNVRUlkSElrT0FzRkkxSkZJZ0lFZnlBQVFmKy9BVXdGSUFJTEJFQWpUeU5SSWdBZ0FCc0VRQ000UVI5eEpEZ2pPQ0FCUWVBQmNYSWtPQThMSUFGQkQzRWdBVUVEY1NNNUd5UThCU05TUlNJQ0JIOGdBRUgvL3dGTUJTQUNDd1JBSTFFRVFDQUJRUUZ4QkVCQkFTUlBCVUVBSkU4TEN3c0xDd3NMTEFBZ0FFRUVkVUVQY1NUMkFTQUFRUWh4UVFCSEpOTUJJQUJCQjNFazBnRWdBRUg0QVhGQkFFb2syUUVMTEFBZ0FFRUVkVUVQY1NUM0FTQUFRUWh4UVFCSEpOVUJJQUJCQjNFazFBRWdBRUg0QVhGQkFFb2syZ0VMTEFBZ0FFRUVkVUVQY1NUNUFTQUFRUWh4UVFCSEpOY0JJQUJCQjNFazFnRWdBRUg0QVhGQkFFb2szQUVMZ1FFQkFYOGdBRUVFZFNUbUFTQUFRUWh4UVFCSEpPY0JJQUJCQjNFay9nRUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUkvNEJJZ0VFUUNBQlFRRnJEZ2NCQWdNRUJRWUhDQXRCQ0NUbEFROExRUkFrNVFFUEMwRWdKT1VCRHd0Qk1DVGxBUThMUWNBQUpPVUJEd3RCMEFBazVRRVBDMEhnQUNUbEFROExRZkFBSk9VQkN3dURBUUVCZjBFQkpKc0JJNTRCUlFSQVFjQUFKSjRCQzBHQUVDUFJBV3RCQW5Ra25BRWpQZ1JBSTV3QlFRRjBKSndCQ3lQU0FTU2RBU1AyQVNTZkFTUFJBU1NrQVNQTUFTSUFKS01CSUFCQkFFb2lBQVIvSTgwQlFRQktCU0FBQ3dSQVFRRWtvZ0VGUVFBa29nRUxJODBCUVFCS0JFQVFQUXNqMlFGRkJFQkJBQ1NiQVFzTFJ3QkJBU1NsQVNPb0FVVUVRRUhBQUNTb0FRdEJnQkFqNFFGclFRSjBKS1lCSXo0RVFDT21BVUVCZENTbUFRc2oxQUVrcHdFajl3RWtxUUVqMmdGRkJFQkJBQ1NsQVFzTFFBQkJBU1NzQVNPdUFVVUVRRUdBQWlTdUFRdEJnQkFqNHdGclFRRjBKSzBCSXo0RVFDT3RBVUVCZENTdEFRdEJBQ1N2QVNQYkFVVUVRRUVBSkt3QkN3dEpBUUYvUVFFa3NBRWpzd0ZGQkVCQndBQWtzd0VMSStVQkkrWUJkQ0lBUVFGMElBQWpQaHNrc1FFajFnRWtzZ0VqK1FFa3RBRkIvLzhCSkxVQkk5d0JSUVJBUVFBa3NBRUxDMVFBSUFCQmdBRnhRUUJISkdFZ0FFSEFBSEZCQUVja1lDQUFRU0J4UVFCSEpGOGdBRUVRY1VFQVJ5UmVJQUJCQ0hGQkFFY2taU0FBUVFSeFFRQkhKR1FnQUVFQ2NVRUFSeVJqSUFCQkFYRkJBRWNrWWd1SUJRRUJmeUFBUWFiK0EwY2lBZ1JBSTJaRklRSUxJQUlFUUVFQUR3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0pCa1A0RFJ3UkFJQUpCa2Y0RGF3NFdBZ1lLRGhVREJ3c1BBUVFJREJBVkJRa05FUklURkJVTElBRkI4QUJ4UVFSMUpNd0JJQUZCQ0hGQkFFY2t6Z0VnQVVFSGNTVE5BUXdWQ3lBQlFZQUJjVUVBUnlUYkFRd1VDeUFCUVFaMVFRTnhKT0FCSUFGQlAzRWs4Z0ZCd0FBajhnRnJKSjRCREJNTElBRkJCblZCQTNFazRnRWdBVUUvY1NUekFVSEFBQ1B6QVdza3FBRU1FZ3NnQVNUMEFVR0FBaVAwQVdza3JnRU1FUXNnQVVFL2NTVDFBVUhBQUNQMUFXc2tzd0VNRUFzZ0FSQlVEQThMSUFFUVZRd09DMEVCSkdzZ0FVRUZkVUVQY1NUNEFRd05DeUFCRUZZTURBc2dBU1RQQVNQUEFTUFFBVUVJZEhJazBRRU1Dd3NnQVNUNkFTUDZBU1A3QVVFSWRISWs0UUVNQ2dzZ0FTVDhBU1A4QVNQOUFVRUlkSElrNHdFTUNRc2dBUkJYREFnTElBRkJnQUZ4QkVBZ0FVSEFBSEZCQUVja3lBRWdBVUVIY1NUUUFTUFBBU1BRQVVFSWRISWswUUVRV0FzTUJ3c2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5VEpBU0FCUVFkeEpQc0JJL29CSS9zQlFRaDBjaVRoQVJCWkN3d0dDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKTW9CSUFGQkIzRWsvUUVqL0FFai9RRkJDSFJ5Sk9NQkVGb0xEQVVMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNreXdFUVd3c01CQXNnQVVFRWRVRUhjU1JjSUFGQkIzRWtYVUVCSkhZTUF3c2dBUkJjUVFFa2R3d0NDeUFCUVlBQmNVRUFSeVJtSUFGQmdBRnhSUVJBQWtCQmtQNERJUUlEUUNBQ1FhYitBMDROQVNBQ1FRQVFCQ0FDUVFGcUlRSU1BQUFMQUFzTERBRUxRUUVQQzBFQkN6d0JBWDhnQUVFSWRDRUJRUUFoQUFOQUFrQWdBRUdmQVVvTkFDQUFRWUQ4QTJvZ0FDQUJhaEFCRUFRZ0FFRUJhaUVBREFFTEMwR0VCU1RCQVFzakFRRi9JNEVDRUFFaEFDT0NBaEFCUWY4QmNTQUFRZjhCY1VFSWRISkI4UDhEY1FzbkFRRi9JNE1DRUFFaEFDT0VBaEFCUWY4QmNTQUFRZjhCY1VFSWRISkI4RDl4UVlDQUFtb0xnd0VCQTM4ak9rVUVRQThMSUFCQmdBRnhSU1BFQVNQRUFSc0VRRUVBSk1RQkk0QUNFQUZCZ0FGeUlRQWpnQUlnQUJBRUR3c1FYeUVCRUdBaEFpQUFRZjkrY1VFQmFrRUVkQ0VESUFCQmdBRnhCRUJCQVNURUFTQURKTVVCSUFFa3hnRWdBaVRIQVNPQUFpQUFRZjkrY1JBRUJTQUJJQUlnQXhCckk0QUNRZjhCRUFRTEMySUJBMzhqaHdJZ0FFWWlBa1VFUUNPR0FpQUFSaUVDQ3lBQ0JFQWdBRUVCYXlJREVBRkJ2Mzl4SWdKQlAzRWlCRUZBYXlBRVFRRkJBQ09HQWlBQVJoc2JRWUNRQkdvZ0FUb0FBQ0FDUVlBQmNRUkFJQU1nQWtFQmFrR0FBWElRQkFzTEN6d0JBWDhDUUFKQUFrQUNRQ0FBQkVBZ0FDSUJRUUZHRFFFZ0FVRUNSZzBDSUFGQkEwWU5Bd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzdEFRRi9RUUVqaWdFUVl5SUNkQ0FBY1VFQVJ5SUFCSDlCQVNBQ2RDQUJjVVVGSUFBTEJFQkJBUThMUVFBTGtRRUJBbjhEUUNBQklBQklCRUFnQVVFRWFpRUJJNFlCSWdKQkJHb2toZ0VqaGdGQi8vOERTZ1JBSTRZQlFZQ0FCR3NraGdFTEk0a0JCRUFqaXdFRVFDT0lBU1NIQVVFQkpJRUJRUUlRT2tFQUpJc0JRUUVrakFFRkk0d0JCRUJCQUNTTUFRc0xJQUlqaGdFUVpBUkFJNGNCUVFGcUpJY0JJNGNCUWY4QlNnUkFRUUVraXdGQkFDU0hBUXNMQ3d3QkN3c0xEQUFqaFFFUVpVRUFKSVVCQzBjQkFYOGpoZ0VoQUVFQUpJWUJRWVQrQTBFQUVBUWppUUVFZnlBQUk0WUJFR1FGSTRrQkN3UkFJNGNCUVFGcUpJY0JJNGNCUWY4QlNnUkFRUUVraXdGQkFDU0hBUXNMQzRBQkFRSi9JNGtCSVFFZ0FFRUVjVUVBUnlTSkFTQUFRUU54SVFJZ0FVVUVRQ09LQVJCaklRQWdBaEJqSVFFamlRRUVmeU9HQVVFQklBQjBjUVVqaGdGQkFTQUFkSEZCQUVjaUFBUi9JNFlCUVFFZ0FYUnhCU0FBQ3dzRVFDT0hBVUVCYWlTSEFTT0hBVUgvQVVvRVFFRUJKSXNCUVFBa2h3RUxDd3NnQWlTS0FRdlNCZ0VCZndKQUFrQWdBRUhOL2dOR0JFQkJ6ZjRESUFGQkFYRVFCQXdCQ3lBQVFZQ0FBa2dFUUNBQUlBRVFVd3dCQ3lBQVFZQ0FBazRpQWdSQUlBQkJnTUFDU0NFQ0N5QUNEUUVnQUVHQXdBTk9JZ0lFUUNBQVFZRDhBMGdoQWdzZ0FnUkFJQUJCZ0VCcUlBRVFCQXdDQ3lBQVFZRDhBMDRpQWdSQUlBQkJuLzBEVENFQ0N5QUNCRUFqbUFGQkFrZ05BUXdDQ3lBQVFhRDlBMDRpQWdSQUlBQkIvLzBEVENFQ0N5QUNEUUFnQUVHQy9nTkdCRUFnQVVFQmNVRUFSeVNQQVNBQlFRSnhRUUJISkpBQklBRkJnQUZ4UVFCSEpKRUJRUUVQQ3lBQVFaRCtBMDRpQWdSQUlBQkJwdjREVENFQ0N5QUNCRUFRVGlBQUlBRVFYUThMSUFCQnNQNERUaUlDQkVBZ0FFRy8vZ05NSVFJTElBSUVRQkJPQ3lBQVFjRCtBMDRpQWdSQUlBQkJ5LzREVENFQ0N5QUNCRUFnQUVIQS9nTkdCRUFnQVJBZURBTUxJQUJCd2Y0RFJnUkFRY0grQXlBQlFmZ0JjVUhCL2dNUUFVRUhjWEpCZ0FGeUVBUU1BZ3NnQUVIRS9nTkdCRUJCQUNSV0lBQkJBQkFFREFJTElBQkJ4ZjREUmdSQUlBRWsvd0VNQXdzZ0FFSEcvZ05HQkVBZ0FSQmVEQU1MQWtBQ1FBSkFBa0FnQUNJQ1FjUCtBMGNFUUNBQ1FjTCtBMnNPQ2dFRUJBUUVCQVFFQXdJRUN5QUJKRmNNQmdzZ0FTUllEQVVMSUFFa1dRd0VDeUFCSkZvTUF3c01BZ3NqZ0FJZ0FFWUVRQ0FCRUdFTUFRc2pQU0FBUmlJQ1JRUkFJenNnQUVZaEFnc2dBZ1JBSThRQkJFQUNmeVBHQVVHQWdBRk9JZ0lFUUNQR0FVSC8vd0ZNSVFJTElBSkZDd1JBSThZQlFZQ2dBMDRpQWdSQUk4WUJRZisvQTB3aEFnc0xJQUlOQWdzTElBQWpoUUpPSWdJRVFDQUFJNFlDVENFQ0N5QUNCRUFnQUNBQkVHSU1BZ3NnQUVHRS9nTk9JZ0lFUUNBQVFZZitBMHdoQWdzZ0FnUkFFR1lDUUFKQUFrQUNRQ0FBSWdKQmhQNERSd1JBSUFKQmhmNERhdzREQVFJREJBc1Fad3dGQ3dKQUk0a0JCRUFqakFFTkFTT0xBUVJBUVFBa2l3RUxDeUFCSkljQkN3d0ZDeUFCSklnQkk0d0JJNGtCSWdBZ0FCc0VRQ09JQVNTSEFVRUFKSXdCQ3d3RUN5QUJFR2dNQXdzTUFnc2dBRUdBL2dOR0JFQWdBVUgvQVhNa3ZnRWp2Z0VpQWtFUWNVRUFSeVMvQVNBQ1FTQnhRUUJISk1BQkN5QUFRWS8rQTBZRVFDQUJFQThNQWdzZ0FFSC8vd05HQkVBZ0FSQU9EQUlMUVFFUEMwRUFEd3RCQVFzUkFDQUFJQUVRYVFSQUlBQWdBUkFFQ3d0Z0FRTi9BMEFDUUNBRElBSk9EUUFnQUNBRGFoQlNJUVVnQVNBRGFpRUVBMEFnQkVIL3Z3SktCRUFnQkVHQVFHb2hCQXdCQ3dzZ0JDQUZFR29nQTBFQmFpRUREQUVMQzBFZ0lRTWp3UUVnQWtFUWJVSEFBRUVnSXo0YmJHb2t3UUVMWndFQmZ5UEVBVVVFUUE4TEk4WUJJOGNCSThVQklnQkJFQ0FBUVJCSUd5SUFFR3NqeGdFZ0FHb2t4Z0VqeHdFZ0FHb2t4d0VqeFFFZ0FHc2t4UUVqeFFGQkFFd0VRRUVBSk1RQkk0QUNRZjhCRUFRRkk0QUNJOFVCUVJCdFFRRnJRZjkrY1JBRUN3dEdBUUovSS84QklRTUNmeUFBUlNJQ1JRUkFJQUJCQVVZaEFnc2dBZ3NFZnlOV0lBTkdCU0FDQ3dSQUlBRkJCSElpQVVIQUFIRUVRQkE3Q3dVZ0FVRjdjU0VCQ3lBQkM0SUNBUU4vSTdZQlJRUkFEd3NqbUFFaEFDQUFJMVlpQWtHUUFVNEVmMEVCQlNOVkl6NEVmMEh3QlFWQitBSUxUZ1IvUVFJRlFRTkJBQ05WSXo0RWYwSHlBd1ZCK1FFTFRoc0xDeUlCUndSQVFjSCtBeEFCSVFBZ0FTU1lBVUVBSVFJQ1FBSkFBa0FDUUNBQkJFQWdBVUVCYXc0REFRSURCQXNnQUVGOGNTSUFRUWh4UVFCSElRSU1Bd3NnQUVGOWNVRUJjaUlBUVJCeFFRQkhJUUlNQWdzZ0FFRitjVUVDY2lJQVFTQnhRUUJISVFJTUFRc2dBRUVEY2lFQUN5QUNCRUFRT3dzZ0FVVUVRQkJzQ3lBQlFRRkdCRUJCQVNSL1FRQVFPZ3RCd2Y0RElBRWdBQkJ0RUFRRklBSkJtUUZHQkVCQndmNERJQUZCd2Y0REVBRVFiUkFFQ3dzTHRBRUFJN1lCQkVBalZTQUFhaVJWQTBBalZRSi9JejRFUUVFSUkxWkJtUUZHRFFFYVFaQUhEQUVMUVFRalZrR1pBVVlOQUJwQnlBTUxUZ1JBSTFVQ2Z5TStCRUJCQ0NOV1Faa0JSZzBCR2tHUUJ3d0JDMEVFSTFaQm1RRkdEUUFhUWNnREMyc2tWU05XSWdCQmtBRkdCRUFqTXdSQUVEZ0ZJQUFRTndzUU9VRi9KTUlCUVg4a3d3RUZJQUJCa0FGSUJFQWpNMFVFUUNBQUVEY0xDd3RCQUNBQVFRRnFJQUJCbVFGS0d5UldEQUVMQ3dzUWJndXpBUUFqVkFKL0l6NEVRRUVJSTFaQm1RRkdEUUVhUVpBSERBRUxRUVFqVmtHWkFVWU5BQnBCeUFNTFNBUkFEd3NEUUNOVUFuOGpQZ1JBUVFnalZrR1pBVVlOQVJwQmtBY01BUXRCQkNOV1Faa0JSZzBBR2tISUF3dE9CRUFDZnlNK0JFQkJDQ05XUVprQlJnMEJHa0dRQnd3QkMwRUVJMVpCbVFGR0RRQWFRY2dEQ3hCdkkxUUNmeU0rQkVCQkNDTldRWmtCUmcwQkdrR1FCd3dCQzBFRUkxWkJtUUZHRFFBYVFjZ0RDMnNrVkF3QkN3c0xNd0VCZjBFQkk1QUJCSDlCQWdWQkJ3c2lBblFnQUhGQkFFY2lBQVIvUVFFZ0FuUWdBWEZGQlNBQUN3UkFRUUVQQzBFQUM1WUJBUUovSTVFQlJRUkFEd3NEUUNBQklBQklCRUFnQVVFRWFpRUJJNDBCSWdKQkJHb2tqUUVqalFGQi8vOERTZ1JBSTQwQlFZQ0FCR3NralFFTElBSWpqUUVRY1FSQVFZSCtBMEdCL2dNUUFVRUJkRUVCYWtIL0FYRVFCQ09PQVVFQmFpU09BU09PQVVFSVJnUkFRUUFramdGQkFTU0NBVUVERURwQmd2NERRWUwrQXhBQlFmOStjUkFFUVFBa2tRRUxDd3dCQ3dzTGlBRUFJOEVCUVFCS0JFQWp3UUVnQUdvaEFFRUFKTUVCQ3lOSklBQnFKRWtqVFVVRVFDTXhCRUFqVkNBQWFpUlVFSEFGSUFBUWJ3c2pNQVJBSTFzZ0FHb2tXd1VnQUJCTkN5QUFFSElMSXpJRVFDT0ZBU0FBYWlTRkFSQm1CU0FBRUdVTEk1UUJJQUJxSkpRQkk1UUJJNUlCVGdSQUk1TUJRUUZxSkpNQkk1UUJJNUlCYXlTVUFRc0xDZ0JCQkJCekkwZ1FBUXNtQVFGL1FRUVFjeU5JUVFGcVFmLy9BM0VRQVNFQUVIUkIvd0Z4SUFCQi93RnhRUWgwY2dzTUFFRUVFSE1nQUNBQkVHb0xNQUVCZjBFQklBQjBRZjhCY1NFQ0lBRkJBRW9FUUNOR0lBSnlRZjhCY1NSR0JTTkdJQUpCL3dGemNTUkdDeU5HQ3drQVFRVWdBQkIzR2d0SkFRRi9JQUZCQUU0RVFDQUFRUTl4SUFGQkQzRnFRUkJ4QkVCQkFSQjRCVUVBRUhnTEJTQUJRUjkxSWdJZ0FTQUNhbk5CRDNFZ0FFRVBjVXNFUUVFQkVIZ0ZRUUFRZUFzTEN3a0FRUWNnQUJCM0dnc0pBRUVHSUFBUWR4b0xDUUJCQkNBQUVIY2FDenNCQW44Z0FVR0EvZ054UVFoMUlRSWdBRUVCYWlFRElBQWdBVUgvQVhFaUFSQnBCRUFnQUNBQkVBUUxJQU1nQWhCcEJFQWdBeUFDRUFRTEN3d0FRUWdRY3lBQUlBRVFmUXQxQUNBQ0JFQWdBU0FBUWYvL0EzRWlBR29nQUNBQmMzTWlBa0VRY1FSQVFRRVFlQVZCQUJCNEN5QUNRWUFDY1FSQVFRRVFmQVZCQUJCOEN3VWdBQ0FCYWtILy93TnhJZ0lnQUVILy93TnhTUVJBUVFFUWZBVkJBQkI4Q3lBQUlBRnpJQUp6UVlBZ2NRUkFRUUVRZUFWQkFCQjRDd3NMQ2dCQkJCQnpJQUFRVWd1UkJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc01Fd3NRZFVILy93TnhJZ0JCZ1A0RGNVRUlkU1JBSUFCQi93RnhKRUVNRHdzalFVSC9BWEVqUUVIL0FYRkJDSFJ5SXo4UWRnd1JDeU5CUWY4QmNTTkFRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtRQXdSQ3lOQVFRRVFlU05BUVFGcVFmOEJjU1JBSTBBRVFFRUFFSG9GUVFFUWVndEJBQkI3REE4TEkwQkJmeEI1STBCQkFXdEIvd0Z4SkVBalFBUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURnc1FkRUgvQVhFa1FBd0xDeU0vUVlBQmNVR0FBVVlFUUVFQkVId0ZRUUFRZkFzalB5SUFRUUYwSUFCQi93RnhRUWQyY2tIL0FYRWtQd3dMQ3hCMVFmLy9BM0VqUnhCK0RBZ0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUFJMEZCL3dGeEkwQkIvd0Z4UVFoMGNpSUJRUUFRZnlBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JVRUFFSHRCQ0E4TEkwRkIvd0Z4STBCQi93RnhRUWgwY2hDQUFVSC9BWEVrUHd3SkN5TkJRZjhCY1NOQVFmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1FBd0pDeU5CUVFFUWVTTkJRUUZxUWY4QmNTUkJJMEVFUUVFQUVIb0ZRUUVRZWd0QkFCQjdEQWNMSTBGQmZ4QjVJMEZCQVd0Qi93RnhKRUVqUVFSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNNQmdzUWRFSC9BWEVrUVF3REN5TS9RUUZ4UVFCTEJFQkJBUkI4QlVFQUVId0xJejhpQUVFSGRDQUFRZjhCY1VFQmRuSkIvd0Z4SkQ4TUF3dEJmdzhMSTBoQkFtcEIvLzhEY1NSSURBSUxJMGhCQVdwQi8vOERjU1JJREFFTFFRQVFla0VBRUh0QkFCQjRDMEVFRHdzZ0FFSC9BWEVrUVVFSUN5Z0JBWDhnQUVFWWRFRVlkU0lCUVlBQmNRUkFRWUFDSUFCQkdIUkJHSFZyUVg5c0lRRUxJQUVMS1FFQmZ5QUFFSUlCSVFFalNDQUJRUmgwUVJoMWFrSC8vd054SkVnalNFRUJha0gvL3dOeEpFZ0wyQVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFDQUFRUkZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lNNkJFQkJ6ZjRERUlBQlFmOEJjU0lBUVFGeEJFQkJ6ZjRESUFCQmZuRWlBRUdBQVhFRWYwRUFKRDRnQUVIL2ZuRUZRUUVrUGlBQVFZQUJjZ3NRZGtIRUFBOExDMEVCSkUwTUVBc1FkVUgvL3dOeElnQkJnUDREY1VFSWRTUkNJQUJCL3dGeEpFTWpTRUVDYWtILy93TnhKRWdNRVFzalEwSC9BWEVqUWtIL0FYRkJDSFJ5SXo4UWRnd1FDeU5EUWY4QmNTTkNRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtRZ3dRQ3lOQ1FRRVFlU05DUVFGcVFmOEJjU1JDSTBJRVFFRUFFSG9GUVFFUWVndEJBQkI3REE0TEkwSkJmeEI1STBKQkFXdEIvd0Z4SkVJalFnUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURRc1FkRUgvQVhFa1Fnd0tDMEVCUVFBalB5SUJRWUFCY1VHQUFVWWJJUUFqUmtFRWRrRUJjU0FCUVFGMGNrSC9BWEVrUHd3S0N4QjBFSU1CUVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFDTkRRZjhCY1NOQ1FmOEJjVUVJZEhJaUFVRUFFSDhnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVWQkFCQjdRUWdQQ3lORFFmOEJjU05DUWY4QmNVRUlkSElRZ0FGQi93RnhKRDhNQ0FzalEwSC9BWEVqUWtIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkVJTUNBc2pRMEVCRUhralEwRUJha0gvQVhFa1F5TkRCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d0dDeU5EUVg4UWVTTkRRUUZyUWY4QmNTUkRJME1FUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQVVMRUhSQi93RnhKRU1NQWd0QkFVRUFJejhpQVVFQmNVRUJSaHNoQUNOR1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpUS9EQUlMUVg4UEN5TklRUUZxUWYvL0EzRWtTQXdCQ3lBQUJFQkJBUkI4QlVFQUVId0xRUUFRZWtFQUVIdEJBQkI0QzBFRUR3c2dBRUgvQVhFa1EwRUlDN2dHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJJRWNFUUNBQVFTRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU5HUVFkMlFRRnhCRUFqU0VFQmFrSC8vd054SkVnRkVIUVFnd0VMUVFnUEN4QjFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JTTklRUUpxUWYvL0EzRWtTQXdRQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUNNL0VIWWdBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1JFSUFCQi93RnhKRVVNRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFSUR3c2pSRUVCRUhralJFRUJha0gvQVhFa1JDTkVCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d05DeU5FUVg4UWVTTkVRUUZyUWY4QmNTUkVJMFFFUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQXdMRUhSQi93RnhKRVFNQ2d0QkJrRUFJMFpCQlhaQkFYRkJBRXNiSVFFZ0FVSGdBSElnQVNOR1FRUjJRUUZ4UVFCTEd5RUJJMFpCQm5aQkFYRkJBRXNFZnlNL0lBRnJRZjhCY1FVZ0FVRUdjaUFCSXo4aUFFRVBjVUVKU3hzaUFVSGdBSElnQVNBQVFaa0JTeHNpQVNBQWFrSC9BWEVMSWdBRVFFRUFFSG9GUVFFUWVnc2dBVUhnQUhFRVFFRUJFSHdGUVFBUWZBdEJBQkI0SUFBa1B3d0tDeU5HUVFkMlFRRnhRUUJMQkVBUWRCQ0RBUVVqU0VFQmFrSC8vd054SkVnTFFRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBU0FCUWYvL0EzRkJBQkIvSUFGQkFYUkIvLzhEY1NJQlFZRCtBM0ZCQ0hVa1JDQUJRZjhCY1NSRlFRQVFlMEVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdFUWdBRkIvd0Z4SkQ4Z0FVRUJha0gvL3dOeElnRkJnUDREY1VFSWRTUkVJQUZCL3dGeEpFVU1Cd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlRUUZyUWYvL0EzRWlBVUdBL2dOeFFRaDFKRVFnQVVIL0FYRWtSVUVJRHdzalJVRUJFSGtqUlVFQmFrSC9BWEVrUlNORkJFQkJBQkI2QlVFQkVIb0xRUUFRZXd3RkN5TkZRWDhRZVNORlFRRnJRZjhCY1NSRkkwVUVRRUVBRUhvRlFRRVFlZ3RCQVJCN0RBUUxFSFJCL3dGeEpFVU1BZ3NqUDBGL2MwSC9BWEVrUDBFQkVIdEJBUkI0REFJTFFYOFBDeU5JUVFGcVFmLy9BM0VrU0F0QkJBdVVCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUV3UndSQUlBQkJNV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTBaQkJIWkJBWEVFUUNOSVFRRnFRZi8vQTNFa1NBVVFkQkNEQVF0QkNBOExFSFZCLy84RGNTUkhJMGhCQW1wQi8vOERjU1JJREJJTEkwVkIvd0Z4STBSQi93RnhRUWgwY2lJQUl6OFFkZ3dPQ3lOSFFRRnFRZi8vQTNFa1IwRUlEd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJZ0FRZ0FFaUFVRUJFSGtnQVVFQmFrSC9BWEVpQVFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHNNRFFzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdBUWdBRWlBVUYvRUhrZ0FVRUJhMEgvQVhFaUFRUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURBc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVIUkIvd0Z4RUhZTURBdEJBQkI3UVFBUWVFRUJFSHdNREFzalJrRUVka0VCY1VFQlJnUkFFSFFRZ3dFRkkwaEJBV3BCLy84RGNTUklDMEVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdFalIwRUFFSDhqUnlBQmFrSC8vd054SWdCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVWQkFCQjdRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUJDQUFVSC9BWEVrUHd3R0N5TkhRUUZyUWYvL0EzRWtSMEVJRHdzalAwRUJFSGtqUDBFQmFrSC9BWEVrUHlNL0JFQkJBQkI2QlVFQkVIb0xRUUFRZXd3SEN5TS9RWDhRZVNNL1FRRnJRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQVJCN0RBWUxFSFJCL3dGeEpEOE1CQXRCQUJCN1FRQVFlQ05HUVFSMlFRRnhRUUJMQkVCQkFCQjhCVUVCRUh3TERBUUxRWDhQQ3lBQVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JRd0NDeUFBUWYvL0EzRWdBUkIyREFFTEkwaEJBV3BCLy84RGNTUklDMEVFQytRQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBQkhCRUFnQUVIQkFFWU5BUUpBSUFCQndnQnJEZzREQkFVR0J3Z0pFUW9MREEwT0R3QUxEQThMREE4TEkwRWtRQXdPQ3lOQ0pFQU1EUXNqUXlSQURBd0xJMFFrUUF3TEN5TkZKRUFNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JBREFrTEl6OGtRQXdJQ3lOQUpFRU1Cd3NqUWlSQkRBWUxJME1rUVF3RkN5TkVKRUVNQkFzalJTUkJEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtRUXdDQ3lNL0pFRU1BUXRCZnc4TFFRUUwzd0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUJIQkVBZ0FFSFJBRVlOQVFKQUlBQkIwZ0JyRGc0UUF3UUZCZ2NJQ1FvUUN3d05EZ0FMREE0TEkwQWtRZ3dPQ3lOQkpFSU1EUXNqUXlSQ0RBd0xJMFFrUWd3TEN5TkZKRUlNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JDREFrTEl6OGtRZ3dJQ3lOQUpFTU1Cd3NqUVNSRERBWUxJMElrUXd3RkN5TkVKRU1NQkFzalJTUkREQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtRd3dDQ3lNL0pFTU1BUXRCZnc4TFFRUUwzd0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUJIQkVBZ0FFSGhBRVlOQVFKQUlBQkI0Z0JyRGc0REJCQUZCZ2NJQ1FvTERCQU5EZ0FMREE0TEkwQWtSQXdPQ3lOQkpFUU1EUXNqUWlSRURBd0xJME1rUkF3TEN5TkZKRVFNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JFREFrTEl6OGtSQXdJQ3lOQUpFVU1Cd3NqUVNSRkRBWUxJMElrUlF3RkN5TkRKRVVNQkFzalJDUkZEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtSUXdDQ3lNL0pFVU1BUXRCZnc4TFFRUUw3QUlBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUVjRVFDQUFRZkVBUmcwQkFrQWdBRUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhSQUFzTUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUkwQVFkZ3dQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUVJCMkRBNExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpTkNFSFlNRFFzalJVSC9BWEVqUkVIL0FYRkJDSFJ5STBNUWRnd01DeU5GUWY4QmNTTkVRZjhCY1VFSWRISWpSQkIyREFzTEkwVkIvd0Z4STBSQi93RnhRUWgwY2lORkVIWU1DZ3NqeEFGRkJFQUNRQ09aQVFSQVFRRWtTZ3dCQ3lOK0k0UUJjVUVmY1VVRVFFRUJKRXNNQVF0QkFTUk1Dd3NNQ1FzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SXo4UWRnd0lDeU5BSkQ4TUJ3c2pRU1EvREFZTEkwSWtQd3dGQ3lOREpEOE1CQXNqUkNRL0RBTUxJMFVrUHd3Q0N5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRkIvd0Z4SkQ4TUFRdEJmdzhMUVFRTFNRRUJmeUFCUVFCT0JFQWdBRUgvQVhFZ0FDQUJha0gvQVhGTEJFQkJBUkI4QlVFQUVId0xCU0FCUVI5MUlnSWdBU0FDYW5NZ0FFSC9BWEZLQkVCQkFSQjhCVUVBRUh3TEN3czBBUUYvSXo4Z0FFSC9BWEVpQVJCNUl6OGdBUkNMQVNNL0lBQnFRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN0Myd0JBbjhqUHlBQWFpTkdRUVIyUVFGeGFrSC9BWEVpQVNFQ0l6OGdBSE1nQVhOQkVIRUVRRUVCRUhnRlFRQVFlQXNqUHlBQVFmOEJjV29qUmtFRWRrRUJjV3BCZ0FKeFFRQkxCRUJCQVJCOEJVRUFFSHdMSUFJa1B5TS9CRUJCQUJCNkJVRUJFSG9MUVFBUWV3dnhBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFZQUJSd1JBSUFGQmdRRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU5BRUl3QkRCQUxJMEVRakFFTUR3c2pRaENNQVF3T0N5TkRFSXdCREEwTEkwUVFqQUVNREFzalJSQ01BUXdMQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FFUWpBRU1DZ3NqUHhDTUFRd0pDeU5BRUkwQkRBZ0xJMEVRalFFTUJ3c2pRaENOQVF3R0N5TkRFSTBCREFVTEkwUVFqUUVNQkFzalJSQ05BUXdEQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FFUWpRRU1BZ3NqUHhDTkFRd0JDMEYvRHd0QkJBczNBUUYvSXo4Z0FFSC9BWEZCZjJ3aUFSQjVJejhnQVJDTEFTTS9JQUJyUWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFSQjdDMndCQW44alB5QUFheU5HUVFSMlFRRnhhMEgvQVhFaUFTRUNJejhnQUhNZ0FYTkJFSEVFUUVFQkVIZ0ZRUUFRZUFzalB5QUFRZjhCY1dzalJrRUVka0VCY1d0QmdBSnhRUUJMQkVCQkFSQjhCVUVBRUh3TElBSWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRRVFld3Z4QVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWkFCUndSQUlBRkJrUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lOQUVJOEJEQkFMSTBFUWp3RU1Ed3NqUWhDUEFRd09DeU5ERUk4QkRBMExJMFFRandFTURBc2pSUkNQQVF3TEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFqd0VNQ2dzalB4Q1BBUXdKQ3lOQUVKQUJEQWdMSTBFUWtBRU1Cd3NqUWhDUUFRd0dDeU5ERUpBQkRBVUxJMFFRa0FFTUJBc2pSUkNRQVF3REN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFrQUVNQWdzalB4Q1FBUXdCQzBGL0R3dEJCQXNqQUNNL0lBQnhKRDhqUHdSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQVJCNFFRQVFmQXNuQUNNL0lBQnpRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN1FRQVFlRUVBRUh3TDhRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHZ0FVY0VRQ0FCUWFFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pRQkNTQVF3UUN5TkJFSklCREE4TEkwSVFrZ0VNRGdzalF4Q1NBUXdOQ3lORUVKSUJEQXdMSTBVUWtnRU1Dd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCRUpJQkRBb0xJejhRa2dFTUNRc2pRQkNUQVF3SUN5TkJFSk1CREFjTEkwSVFrd0VNQmdzalF4Q1RBUXdGQ3lORUVKTUJEQVFMSTBVUWt3RU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCRUpNQkRBSUxJejhRa3dFTUFRdEJmdzhMUVFRTEp3QWpQeUFBY2tIL0FYRWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhoQkFCQjhDeThCQVg4alB5QUFRZjhCY1VGL2JDSUJFSGtqUHlBQkVJc0JJejhnQVdvRVFFRUFFSG9GUVFFUWVndEJBUkI3Qy9FQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCc0FGSEJFQWdBVUd4QVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEkwQVFsUUVNRUFzalFSQ1ZBUXdQQ3lOQ0VKVUJEQTRMSTBNUWxRRU1EUXNqUkJDVkFRd01DeU5GRUpVQkRBc0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBUkNWQVF3S0N5TS9FSlVCREFrTEkwQVFsZ0VNQ0FzalFSQ1dBUXdIQ3lOQ0VKWUJEQVlMSTBNUWxnRU1CUXNqUkJDV0FRd0VDeU5GRUpZQkRBTUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBUkNXQVF3Q0N5TS9FSllCREFFTFFYOFBDMEVFQ3pzQkFYOGdBQkJSSWdGQmYwWUVmeUFBRUFFRklBRUxRZjhCY1NBQVFRRnFJZ0VRVVNJQVFYOUdCSDhnQVJBQkJTQUFDMEgvQVhGQkNIUnlDd3NBUVFnUWN5QUFFSmdCQzBNQUlBQkJnQUZ4UVlBQlJnUkFRUUVRZkFWQkFCQjhDeUFBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBQUxRUUFnQUVFQmNVRUFTd1JBUVFFUWZBVkJBQkI4Q3lBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFaUFBUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRJQUFMVHdFQmYwRUJRUUFnQUVHQUFYRkJnQUZHR3lFQkkwWkJCSFpCQVhFZ0FFRUJkSEpCL3dGeElRQWdBUVJBUVFFUWZBVkJBQkI4Q3lBQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIZ2dBQXRRQVFGL1FRRkJBQ0FBUVFGeFFRRkdHeUVCSTBaQkJIWkJBWEZCQjNRZ0FFSC9BWEZCQVhaeUlRQWdBUVJBUVFFUWZBVkJBQkI4Q3lBQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIZ2dBQXRHQVFGL1FRRkJBQ0FBUVlBQmNVR0FBVVliSVFFZ0FFRUJkRUgvQVhFaEFDQUJCRUJCQVJCOEJVRUFFSHdMSUFBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUFDMTRCQW45QkFVRUFJQUJCQVhGQkFVWWJJUUZCQVVFQUlBQkJnQUZ4UVlBQlJoc2hBaUFBUWY4QmNVRUJkaUlBUVlBQmNpQUFJQUliSWdBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUJCRUJCQVJCOEJVRUFFSHdMSUFBTE1BQWdBRUVQY1VFRWRDQUFRZkFCY1VFRWRuSWlBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0UVFBUWZDQUFDMElCQVg5QkFVRUFJQUJCQVhGQkFVWWJJUUVnQUVIL0FYRkJBWFlpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBRUVRRUVCRUh3RlFRQVFmQXNnQUFza0FFRUJJQUIwSUFGeFFmOEJjUVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBUkI0SUFFTG53Z0JCbjhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQ0c4aUJpSUZCRUFnQlVFQmF3NEhBUUlEQkFVR0J3Z0xJMEFoQVF3SEN5TkJJUUVNQmdzalFpRUJEQVVMSTBNaEFRd0VDeU5FSVFFTUF3c2pSU0VCREFJTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFTRUJEQUVMSXo4aEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklnUUVRQ0FFUVFGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5QUFRUWRNQkg5QkFTRUNJQUVRbWdFRklBQkJEMHdFZjBFQklRSWdBUkNiQVFWQkFBc0xJUU1NRHdzZ0FFRVhUQVIvUVFFaEFpQUJFSndCQlNBQVFSOU1CSDlCQVNFQ0lBRVFuUUVGUVFBTEN5RUREQTRMSUFCQkowd0VmMEVCSVFJZ0FSQ2VBUVVnQUVFdlRBUi9RUUVoQWlBQkVKOEJCVUVBQ3dzaEF3d05DeUFBUVRkTUJIOUJBU0VDSUFFUW9BRUZJQUJCUDB3RWYwRUJJUUlnQVJDaEFRVkJBQXNMSVFNTURBc2dBRUhIQUV3RWYwRUJJUUpCQUNBQkVLSUJCU0FBUWM4QVRBUi9RUUVoQWtFQklBRVFvZ0VGUVFBTEN5RUREQXNMSUFCQjF3Qk1CSDlCQVNFQ1FRSWdBUkNpQVFVZ0FFSGZBRXdFZjBFQklRSkJBeUFCRUtJQkJVRUFDd3NoQXd3S0N5QUFRZWNBVEFSL1FRRWhBa0VFSUFFUW9nRUZJQUJCN3dCTUJIOUJBU0VDUVFVZ0FSQ2lBUVZCQUFzTElRTU1DUXNnQUVIM0FFd0VmMEVCSVFKQkJpQUJFS0lCQlNBQVFmOEFUQVIvUVFFaEFrRUhJQUVRb2dFRlFRQUxDeUVEREFnTElBQkJod0ZNQkg5QkFTRUNJQUZCZm5FRklBQkJqd0ZNQkg5QkFTRUNJQUZCZlhFRlFRQUxDeUVEREFjTElBQkJsd0ZNQkg5QkFTRUNJQUZCZTNFRklBQkJud0ZNQkg5QkFTRUNJQUZCZDNFRlFRQUxDeUVEREFZTElBQkJwd0ZNQkg5QkFTRUNJQUZCYjNFRklBQkJyd0ZNQkg5QkFTRUNJQUZCWDNFRlFRQUxDeUVEREFVTElBQkJ0d0ZNQkg5QkFTRUNJQUZCdjM5eEJTQUFRYjhCVEFSL1FRRWhBaUFCUWY5K2NRVkJBQXNMSVFNTUJBc2dBRUhIQVV3RWYwRUJJUUlnQVVFQmNnVWdBRUhQQVV3RWYwRUJJUUlnQVVFQ2NnVkJBQXNMSVFNTUF3c2dBRUhYQVV3RWYwRUJJUUlnQVVFRWNnVWdBRUhmQVV3RWYwRUJJUUlnQVVFSWNnVkJBQXNMSVFNTUFnc2dBRUhuQVV3RWYwRUJJUUlnQVVFUWNnVWdBRUh2QVV3RWYwRUJJUUlnQVVFZ2NnVkJBQXNMSVFNTUFRc2dBRUgzQVV3RWYwRUJJUUlnQVVIQUFISUZJQUJCL3dGTUJIOUJBU0VDSUFGQmdBRnlCVUVBQ3dzaEF3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBWWlCQVJBSUFSQkFXc09Cd0VDQXdRRkJnY0lDeUFESkVBTUJ3c2dBeVJCREFZTElBTWtRZ3dGQ3lBREpFTU1CQXNnQXlSRURBTUxJQU1rUlF3Q0N5QUZRUVJJSWdRRWZ5QUVCU0FGUVFkS0N3UkFJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpQURFSFlMREFFTElBTWtQd3RCQkVGL0lBSWJDKzREQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhBQVVjRVFDQUFRY0VCYXc0UEFRSVJBd1FGQmdjSUNRb0xFQXdORGdzalJrRUhka0VCY1EwUkRBNExJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUkFJQUJCL3dGeEpFRkJCQThMSTBaQkIzWkJBWEVORVF3T0N5TkdRUWQyUVFGeERSQU1EQXNqUjBFQ2EwSC8vd054SkVjalJ5TkJRZjhCY1NOQVFmOEJjVUVJZEhJUWZnd05DeEIwRUl3QkRBMExJMGRCQW10Qi8vOERjU1JISTBjalNCQitRUUFrU0F3TEN5TkdRUWQyUVFGeFFRRkhEUW9NQndzalJ4Q1pBVUgvL3dOeEpFZ2pSMEVDYWtILy93TnhKRWNNQ1FzalJrRUhka0VCY1VFQlJnMEhEQW9MRUhSQi93RnhFS01CSVFBalNFRUJha0gvL3dOeEpFZ2dBQThMSTBaQkIzWkJBWEZCQVVjTkNDTkhRUUpyUWYvL0EzRWtSeU5ISTBoQkFtcEIvLzhEY1JCK0RBVUxFSFFRalFFTUJnc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJDQ1JJREFRTFFYOFBDeU5IRUprQlFmLy9BM0VrU0NOSFFRSnFRZi8vQTNFa1IwRU1Ed3NqUjBFQ2EwSC8vd054SkVjalJ5TklRUUpxUWYvL0EzRVFmZ3NRZFVILy93TnhKRWdMUVFnUEN5TklRUUZxUWYvL0EzRWtTRUVFRHdzalNFRUNha0gvL3dOeEpFaEJEQXZUQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBVWNFUUNBQVFkRUJhdzRQQVFJTkF3UUZCZ2NJQ1EwS0RRc01EUXNqUmtFRWRrRUJjUTBQREEwTEkwY1FtUUZCLy84RGNTRUFJMGRCQW1wQi8vOERjU1JISUFCQmdQNERjVUVJZFNSQ0lBQkIvd0Z4SkVOQkJBOExJMFpCQkhaQkFYRU5Ed3dNQ3lOR1FRUjJRUUZ4RFE0alIwRUNhMEgvL3dOeEpFY2pSeU5JUVFKcVFmLy9BM0VRZmd3TEN5TkhRUUpyUWYvL0EzRWtSeU5ISTBOQi93RnhJMEpCL3dGeFFRaDBjaEIrREFzTEVIUVFqd0VNQ3dzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1QkVDUklEQWtMSTBaQkJIWkJBWEZCQVVjTkNBd0dDeU5IRUprQlFmLy9BM0VrU0VFQkpKb0JJMGRCQW1wQi8vOERjU1JIREFjTEkwWkJCSFpCQVhGQkFVWU5CUXdJQ3lOR1FRUjJRUUZ4UVFGSERRY2pSMEVDYTBILy93TnhKRWNqUnlOSVFRSnFRZi8vQTNFUWZnd0VDeEIwRUpBQkRBVUxJMGRCQW10Qi8vOERjU1JISTBjalNCQitRUmdrU0F3REMwRi9Ed3NqUnhDWkFVSC8vd054SkVnalIwRUNha0gvL3dOeEpFZEJEQThMRUhWQi8vOERjU1JJQzBFSUR3c2pTRUVCYWtILy93TnhKRWhCQkE4TEkwaEJBbXBCLy84RGNTUklRUXdMOEFJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFXc09Ed0VDQ3dzREJBVUdCd2dMQ3dzSkNnc0xFSFJCL3dGeFFZRCtBMm9qUHhCMkRBc0xJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUkVJQUJCL3dGeEpFVkJCQThMSTBGQmdQNERhaU0vRUhaQkJBOExJMGRCQW10Qi8vOERjU1JISTBjalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUg1QkNBOExFSFFRa2dFTUJ3c2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJJQ1JJUVFnUEN4QjBFSUlCUVJoMFFSaDFJUUFqUnlBQVFRRVFmeU5ISUFCcVFmLy9BM0VrUjBFQUVIcEJBQkI3STBoQkFXcEIvLzhEY1NSSVFRd1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWtTRUVFRHdzUWRVSC8vd054SXo4UWRpTklRUUpxUWYvL0EzRWtTRUVFRHdzUWRCQ1RBUXdDQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFb0pFaEJDQThMUVg4UEN5TklRUUZxUWYvL0EzRWtTRUVFQzZjREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQlJ3UkFJQUJCOFFGckRnOEJBZ01OQkFVR0J3Z0pDZzBOQ3d3TkN4QjBRZjhCY1VHQS9nTnFFSUFCUWY4QmNTUS9EQTBMSTBjUW1RRkIvLzhEY1NFQUkwZEJBbXBCLy84RGNTUkhJQUJCZ1A0RGNVRUlkU1EvSUFCQi93RnhKRVlNRFFzalFVR0EvZ05xRUlBQlFmOEJjU1EvREF3TFFRQWttUUVNQ3dzalIwRUNhMEgvL3dOeEpFY2pSeU5HUWY4QmNTTS9RZjhCY1VFSWRISVFma0VJRHdzUWRCQ1ZBUXdJQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFd0pFaEJDQThMRUhRUWdnRWhBRUVBRUhwQkFCQjdJMGNnQUVFWWRFRVlkU0lBUVFFUWZ5TkhJQUJxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSU05JUVFGcVFmLy9BM0VrU0VFSUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUpFZEJDQThMRUhWQi8vOERjUkNBQVVIL0FYRWtQeU5JUVFKcVFmLy9BM0VrU0F3RkMwRUJKSm9CREFRTEVIUVFsZ0VNQWdzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1Qk9DUklRUWdQQzBGL0R3c2pTRUVCYWtILy93TnhKRWdMUVFRTDNBRUJBWDhqU0VFQmFrSC8vd054SkVnalRBUkFJMGhCQVd0Qi8vOERjU1JJQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRTSUJCRUFnQVVFQlJnMEJBa0FnQVVFQ2F3NE5Bd1FGQmdjSUNRb0xEQTBPRHdBTERBOExJQUFRZ1FFUEN5QUFFSVFCRHdzZ0FCQ0ZBUThMSUFBUWhnRVBDeUFBRUljQkR3c2dBQkNJQVE4TElBQVFpUUVQQ3lBQUVJb0JEd3NnQUJDT0FROExJQUFRa1FFUEN5QUFFSlFCRHdzZ0FCQ1hBUThMSUFBUXBBRVBDeUFBRUtVQkR3c2dBQkNtQVE4TElBQVFwd0VMd2dFQkFuOUJBQ1NaQVVHUC9nTVFBVUVCSUFCMFFYOXpjU0lCSklRQlFZLytBeUFCRUFRalIwRUNhMEgvL3dOeEpFY0NRQ05LSWdFalN5QUJHdzBBQ3lOSElnRWpTQ0lDUWY4QmNSQUVJQUZCQVdvZ0FrR0EvZ054UVFoMUVBUUNRQUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVDUUNBQVFRSnJEZ01EQkFVQUN3d0ZDMEVBSkg5QndBQWtTQXdFQzBFQUpJQUJRY2dBSkVnTUF3dEJBQ1NCQVVIUUFDUklEQUlMUVFBa2dnRkIyQUFrU0F3QkMwRUFKSU1CUWVBQUpFZ0xDL2tCQVFOL0k1b0JCRUJCQVNTWkFVRUFKSm9CQ3lOK0k0UUJjVUVmY1VFQVNnUkFJMHRGSTVrQklnSWdBaHNFZnlOL0kza2lBQ0FBR3dSL1FRQVFxUUZCQVFVamdBRWplaUlBSUFBYkJIOUJBUkNwQVVFQkJTT0JBU043SWdBZ0FCc0VmMEVDRUtrQlFRRUZJNElCSTN3aUFDQUFHd1IvUVFNUXFRRkJBUVVqZ3dFamZTSUFJQUFiQkg5QkJCQ3BBVUVCQlVFQUN3c0xDd3NGUVFBTEJFQUNmMEVCSTBvaUFDTkxJQUFiRFFBYVFRQUxCSDlCQUNSTFFRQWtTa0VBSkV4QkFDUk5RUmdGUVJRTElRRUxBbjlCQVNOS0lnQWpTeUFBR3cwQUdrRUFDd1JBUVFBa1MwRUFKRXBCQUNSTVFRQWtUUXNnQVE4TFFRQUxxd0VCQW45QkFTUXRJMHdFUUNOSUVBRkIvd0Z4RUtnQkVITkJBQ1JMUVFBa1NrRUFKRXhCQUNSTkN4Q3FBU0lCUVFCS0JFQWdBUkJ6QzBFRUlRQUNmMEVCSTBvaUFTTkxJQUViRFFBYVFRQUxSU0lCQkg4alRVVUZJQUVMQkVBalNCQUJRZjhCY1JDb0FTRUFDeU5HUWZBQmNTUkdJQUJCQUV3RVFDQUFEd3NnQUJCekk1Y0JRUUZxSkpjQkk1Y0JJNVVCVGdSQUk1WUJRUUZxSkpZQkk1Y0JJNVVCYXlTWEFRc2dBQXNFQUNOcUMrWUJBUVYvSUFCQmYwR0FDQ0FBUVFCSUd5QUFRUUJLR3lFRVFRQWhBQU5BQW44Q2Z5QUdSU0lDQkVBZ0FFVWhBZ3NnQWdzRVFDQUZSU0VDQ3lBQ0N3UkFJQU5GSVFJTElBSUVRQkNyQVVFQVNBUkFRUUVoQmdValNTTStCSDlCb01rSUJVSFFwQVFMVGdSQVFRRWhBQVVnQkVGL1NpSUNCRUFqYWlBRVRpRUNDeUFDQkVCQkFTRUZCU0FCUVg5S0lnSUVRQ05JSUFGR0lRSUxRUUVnQXlBQ0d5RURDd3NMREFFTEN5QUFCRUFqU1NNK0JIOUJvTWtJQlVIUXBBUUxheVJKSTRnQ0R3c2dCUVJBSTRrQ0R3c2dBd1JBSTRvQ0R3c2pTRUVCYTBILy93TnhKRWhCZndzSkFFRi9RWDhRclFFTE9BRURmd05BSUFJZ0FFZ2lBd1JBSUFGQkFFNGhBd3NnQXdSQUVLNEJJUUVnQWtFQmFpRUNEQUVMQ3lBQlFRQklCRUFnQVE4TFFRQUxDUUJCZnlBQUVLMEJDd2tBSUFBZ0FSQ3RBUXNGQUNPU0FRc0ZBQ09UQVFzRkFDT1VBUXRmQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBQ0lCUVFGR0RRRUNRQ0FCUVFKckRnWURCQVVHQndnQUN3d0lDeVBxQVE4TEkrc0JEd3NqN0FFUEN5UHRBUThMSSs0QkR3c2o3d0VQQ3lQd0FROExJL0VCRHd0QkFBdUxBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQWlBa0VCUmcwQkFrQWdBa0VDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBVUVBUnlUcUFRd0hDeUFCUVFCSEpPc0JEQVlMSUFGQkFFY2s3QUVNQlFzZ0FVRUFSeVR0QVF3RUN5QUJRUUJISk80QkRBTUxJQUZCQUVjazd3RU1BZ3NnQVVFQVJ5VHdBUXdCQ3lBQlFRQkhKUEVCQ3d0VUFRRi9RUUFrVFNBQUVMVUJSUVJBUVFFaEFRc2dBRUVCRUxZQklBRUVRRUVCUVFGQkFFRUJRUUFnQUVFRFRCc2lBU08vQVNJQUlBQWJHeUFCUlNQQUFTSUFJQUFiR3dSQVFRRWtnd0ZCQkJBNkN3c0xDUUFnQUVFQUVMWUJDNW9CQUNBQVFRQktCRUJCQUJDM0FRVkJBQkM0QVFzZ0FVRUFTZ1JBUVFFUXR3RUZRUUVRdUFFTElBSkJBRW9FUUVFQ0VMY0JCVUVDRUxnQkN5QURRUUJLQkVCQkF4QzNBUVZCQXhDNEFRc2dCRUVBU2dSQVFRUVF0d0VGUVFRUXVBRUxJQVZCQUVvRVFFRUZFTGNCQlVFRkVMZ0JDeUFHUVFCS0JFQkJCaEMzQVFWQkJoQzRBUXNnQjBFQVNnUkFRUWNRdHdFRlFRY1F1QUVMQ3dRQUl6OExCQUFqUUFzRUFDTkJDd1FBSTBJTEJBQWpRd3NFQUNORUN3UUFJMFVMQkFBalJnc0VBQ05JQ3dRQUkwY0xCZ0FqU0JBQkN3UUFJMVlMcndNQkNuOUJnSUFDUVlDUUFpTzVBUnNoQ1VHQXVBSkJnTEFDSTdvQkd5RUtBMEFnQlVHQUFrZ0VRRUVBSVFRRFFDQUVRWUFDU0FSQUlBa2dCVUVEZFVFRmRDQUthaUFFUVFOMWFpSURRWUNRZm1vdEFBQVFMQ0VJSUFWQkNHOGhBVUVISUFSQkNHOXJJUVpCQUNFQ0FuOGdBRUVBU2lNNklnY2dCeHNFUUNBRFFZRFFmbW90QUFBaEFnc2dBa0hBQUhFTEJFQkJCeUFCYXlFQkMwRUFJUWNnQVVFQmRDQUlhaUlEUVlDUWZtcEJBVUVBSUFKQkNIRWJJZ2RCQVhGQkRYUnFMUUFBSVFoQkFDRUJJQU5CZ1pCK2FpQUhRUUZ4UVExMGFpMEFBRUVCSUFaMGNRUkFRUUloQVFzZ0FVRUJhaUFCUVFFZ0JuUWdDSEViSVFFZ0JVRUlkQ0FFYWtFRGJDRUdJQUJCQUVvak9pSURJQU1iQkVBZ0FrRUhjU0FCUVFBUUxTSUJRUjl4UVFOMElRTWdCa0dBb1F0cUlnSWdBem9BQUNBQ1FRRnFJQUZCNEFkeFFRVjFRUU4wT2dBQUlBSkJBbW9nQVVHQStBRnhRUXAxUVFOME9nQUFCU0FCUWNmK0EwRUFFQzRoQWtFQUlRRURRQ0FCUVFOSUJFQWdCa0dBb1F0cUlBRnFJQUk2QUFBZ0FVRUJhaUVCREFFTEN3c2dCRUVCYWlFRURBRUxDeUFGUVFGcUlRVU1BUXNMQzlvREFReC9BMEFnQTBFWFRrVUVRRUVBSVFJRFFDQUNRUjlJQkVCQkFVRUFJQUpCRDBvYklRa2dBMEVQYXlBRElBTkJEMG9iUVFSMElnY2dBa0VQYTJvZ0FpQUhhaUFDUVE5S0d5RUhRWUNRQWtHQWdBSWdBMEVQU2hzaEMwSEgvZ01oQ2tGL0lRRkJmeUVJUVFBaEJBTkFJQVJCQ0VnRVFFRUFJUUFEUUNBQVFRVklCRUFnQUVFRGRDQUVha0VDZENJRlFZTDhBMm9RQVNBSFJnUkFJQVZCZy93RGFoQUJJUVpCQVVFQUlBWkJDSEZCQUVjak9pTTZHeHNnQ1VZRVFFRUlJUVJCQlNFQUlBWWlDRUVRY1FSL1FjbitBd1ZCeVA0REN5RUtDd3NnQUVFQmFpRUFEQUVMQ3lBRVFRRnFJUVFNQVFzTElBaEJBRWdqT2lJR0lBWWJCRUJCZ0xnQ1FZQ3dBaU82QVJzaEJFRi9JUUJCQUNFQkEwQWdBVUVnU0FSQVFRQWhCUU5BSUFWQklFZ0VRQ0FGUVFWMElBUnFJQUZxSWdaQmdKQithaTBBQUNBSFJnUkFRU0FoQlNBR0lRQkJJQ0VCQ3lBRlFRRnFJUVVNQVFzTElBRkJBV29oQVF3QkN3c2dBRUVBVGdSL0lBQkJnTkIrYWkwQUFBVkJmd3NoQVF0QkFDRUFBMEFnQUVFSVNBUkFJQWNnQ3lBSlFRQkJCeUFBSUFKQkEzUWdBMEVEZENBQWFrSDRBVUdBb1JjZ0NpQUJJQWdRTHhvZ0FFRUJhaUVBREFFTEN5QUNRUUZxSVFJTUFRc0xJQU5CQVdvaEF3d0JDd3NMbUFJQkNYOERRQ0FFUVFoT1JRUkFRUUFoQVFOQUlBRkJCVWdFUUNBQlFRTjBJQVJxUVFKMElnQkJnUHdEYWhBQkdpQUFRWUg4QTJvUUFSb2dBRUdDL0FOcUVBRWhBa0VCSVFVanV3RUVRQ0FDUVFKdlFRRkdCRUFnQWtFQmF5RUNDMEVDSVFVTElBQkJnL3dEYWhBQklRWkJBQ0VIUVFGQkFDQUdRUWh4UVFCSEl6b2pPaHNiSVFkQnlQNERJUWhCeWY0RFFjaitBeUFHUVJCeEd5RUlRUUFoQUFOQUlBQWdCVWdFUUVFQUlRTURRQ0FEUVFoSUJFQWdBQ0FDYWtHQWdBSWdCMEVBUVFjZ0F5QUVRUU4wSUFGQkJIUWdBMm9nQUVFRGRHcEJ3QUJCZ0tFZ0lBaEJmeUFHRUM4YUlBTkJBV29oQXd3QkN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFSQkFXb2hCQXdCQ3dzTEJRQWpoZ0VMQlFBamh3RUxCUUFqaUFFTEdBRUJmeU9LQVNFQUk0a0JCRUFnQUVFRWNpRUFDeUFBQ3kwQkFYOENRQU5BSUFCQi8vOERUZzBCSUFCQmdLSEpCR29nQUJCU09nQUFJQUJCQVdvaEFBd0FBQXNBQ3dzVUFEOEFRWlFCU0FSQVFaUUJQd0JyUUFBYUN3c0RBQUVMSHdBQ1FBSkFBa0FqbVFJT0FnRUNBQXNBQzBFQUlRQUxJQUJCZnhDdEFRc0hBQ0FBSkprQ0N5OEFBa0FDUUFKQUFrQUNRQ09aQWc0RUFRSURCQUFMQUF0QkFTRUFDMEYvSVFFTFFYOGhBZ3NnQVNBQ0VLMEJDd0F6RUhOdmRYSmpaVTFoY0hCcGJtZFZVa3doWTI5eVpTOWthWE4wTDJOdmNtVXVkVzUwYjNWamFHVmtMbmRoYzIwdWJXRnciKSkuaW5zdGFuY2U7CmNvbnN0IGI9bmV3IFVpbnQ4QXJyYXkoYS5leHBvcnRzLm1lbW9yeS5idWZmZXIpO3JldHVybntpbnN0YW5jZTphLGJ5dGVNZW1vcnk6Yix0eXBlOiJXZWIgQXNzZW1ibHkifX07bGV0IHIsdSxELGM7Yz17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCwKV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxzcGVlZDowLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsYnJlYWtwb2ludDp2b2lkIDAsbWVzc2FnZUhhbmRsZXI6KGEpPT57Y29uc3QgYj1uKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5ncmFwaGljc1dvcmtlclBvcnQ9CmIubWVzc2FnZS5wb3J0c1swXSxxKEguYmluZCh2b2lkIDAsYyksYy5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEsuYmluZCh2b2lkIDAsYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEouYmluZCh2b2lkIDAsYyksYy5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihjLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShJLmJpbmQodm9pZCAwLGMpLGMuYXVkaW9Xb3JrZXJQb3J0KSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBPKHApO2Mud2FzbUluc3RhbmNlPWEuaW5zdGFuY2U7CmMud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2soaCh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgZi5DT05GSUc6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkoYyxiLm1lc3NhZ2UuY29uZmlnKTtjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SRVNFVF9BVURJT19RVUVVRTpjLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUExBWTpjYXNlIGYuUExBWV9VTlRJTF9CUkVBS1BPSU5UOmlmKCFjLnBhdXNlZHx8IWMud2FzbUluc3RhbmNlfHwhYy53YXNtQnl0ZU1lbW9yeSl7ayhoKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTticmVha31jLnBhdXNlZD0hMTtjLmZwc1RpbWVTdGFtcHM9W107dyhjKTtjLmZyYW1lU2tpcENvdW50ZXI9MDtjLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9CjA7Yy5icmVha3BvaW50PXZvaWQgMDtiLm1lc3NhZ2UuYnJlYWtwb2ludCYmKGMuYnJlYWtwb2ludD1iLm1lc3NhZ2UuYnJlYWtwb2ludCk7RShjLDFFMy9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5QQVVTRTpjLnBhdXNlZD0hMDtjLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KGMudXBkYXRlSWQpLGMudXBkYXRlSWQ9dm9pZCAwKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP2Mud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPQowO2xldCBkPWMud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoZD1iLm1lc3NhZ2UuZW5kKTthPWMud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxkKS5idWZmZXI7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgZi5HRVRfV0FTTV9DT05TVEFOVDprKGgoe3R5cGU6Zi5HRVRfV0FTTV9DT05TVEFOVCxyZXNwb25zZTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5GT1JDRV9PVVRQVVRfRlJBTUU6QihjKTticmVhaztjYXNlIGYuU0VUX1NQRUVEOmMuc3BlZWQ9Yi5tZXNzYWdlLnNwZWVkO2MuZnBzVGltZVN0YW1wcz1bXTtjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTYwO3coYyk7Yy5mcmFtZVNraXBDb3VudGVyPTA7Yy5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQowO2Mud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCk7YnJlYWs7Y2FzZSBmLklTX0dCQzphPTA8Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5pc0dCQygpO2soaCh7dHlwZTpmLklTX0dCQyxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coIlVua25vd24gV2FzbUJveSBXb3JrZXIgbWVzc2FnZToiLGIpfX0sZ2V0RlBTOigpPT4wPGMudGltZVN0YW1wc1VudGlsUmVhZHk/Yy5zcGVlZCYmMDxjLnNwZWVkP2Mub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKmMuc3BlZWQ6Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU6Yy5mcHNUaW1lU3RhbXBzP2MuZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07cShjLm1lc3NhZ2VIYW5kbGVyKX0pKCk7Cg==";

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
