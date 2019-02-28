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
  BOOT_ROM: 'BOOT_ROM',
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

      if (this.audioContext) {
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
    } // Get our buffers as floats


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

    let finalNode = source;

    if (this.gainNode) {
      finalNode = this.gainNode;
      lastAdditionalNode.connect(this.gainNode);
    } // Call our callback, if we have one


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

    if (lowercaseKey.includes('.gb') || lowercaseKey.includes('.gbc') || lowercaseKey.includes('.bin')) {
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

const BOOT_ROM_KEY = 'boot-rom-';

class WasmBoyMemoryService {
  constructor() {
    this.worker = undefined;
    this.maxNumberOfAutoSaveStates = undefined;
    this.saveStateCallback = undefined;
    this.loadedCartridgeMemoryState = {
      ROM: false,
      RAM: false,
      BOOT: false
    }; // Our different types of memory

    this.bootRom = undefined;
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
    this.WASMBOY_PALETTE_MEMORY_LOCATION = 0; // Define some other constants

    this.SUPPORTED_BOOT_ROM_TYPES = {
      GB: 'GB',
      GBC: 'GBC'
    };
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

            if (memoryTypes.includes(MEMORY_TYPE.BOOT_ROM)) {
              this.bootRom = new Uint8Array(eventData.message[MEMORY_TYPE.BOOT_ROM]);
            }

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

  isValidBootROMType(type) {
    return Object.keys(this.SUPPORTED_BOOT_ROM_TYPES).some(bootROMTypeKey => {
      return this.SUPPORTED_BOOT_ROM_TYPES[bootROMTypeKey] === type;
    });
  }

  async addBootROM(type, file, fetchHeaders, additionalInfo) {
    type = type.toUpperCase();

    if (!this.isValidBootROMType(type)) {
      throw new Error('Invalid Boot ROM type');
    } // Get our fetch rom object


    const fetchROMObject = await fetchROMAsByteArray(file, fetchHeaders); // Remove any keys we don't want to allow
    // Overriding in the additionalInfo

    if (additionalInfo) {
      delete additionalInfo.name;
      delete additionalInfo.ROM;
    }

    let name = 'Game Boy';

    if (this.SUPPORTED_BOOT_ROM_TYPES.GBC === type) {
      name = 'Game Boy Color';
    }

    const bootROMObject = _objectSpread({
      ROM: fetchROMObject.ROM,
      name,
      type,
      date: Date.now()
    }, additionalInfo);

    await idbKeyval.set(BOOT_ROM_KEY + type, bootROMObject);
  }

  async getBootROMs() {
    const bootROMs = [];

    for (let bootROMType in this.SUPPORTED_BOOT_ROM_TYPES) {
      const bootROMObject = await idbKeyval.get(BOOT_ROM_KEY + bootROMType);

      if (bootROMObject) {
        bootROMs.push(bootROMObject);
      }
    }

    return bootROMs;
  }

  async loadBootROMIfAvailable(type) {
    if (!idbKeyval) {
      // TODO: Allow headless Boot ROMs
      return;
    }

    type = type.toUpperCase();

    if (!this.isValidBootROMType(type)) {
      throw new Error('Invalid Boot ROM type');
    } // Try to get the boot rom object


    const bootROMObject = await idbKeyval.get(BOOT_ROM_KEY + type);

    if (!bootROMObject) {
      // Return silently
      return;
    }

    const workerMemoryObject = {};
    workerMemoryObject[MEMORY_TYPE.BOOT_ROM] = bootROMObject.ROM.buffer; // Don't pass the rom as a transferrable, since,
    // We want to keep a copy of it for reset

    await this.worker.postMessage(_objectSpread({
      type: WORKER_MESSAGE_TYPE.SET_MEMORY
    }, workerMemoryObject)).then(event => {
      this.loadedCartridgeMemoryState.BOOT = true;
    }); // Also get our cartridge header

    await this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.GET_MEMORY,
      memoryTypes: [MEMORY_TYPE.BOOT_ROM]
    }).then(event => {
      const eventData = getEventData(event);
      this.bootRom = new Uint8Array(eventData.message[MEMORY_TYPE.BOOT_ROM]);
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

var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGViKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gZWEoYSxjKXttYj9zZWxmLnBvc3RNZXNzYWdlKGEsYyk6QmIucG9zdE1lc3NhZ2UoYSxjKX1mdW5jdGlvbiBmYihhLGMpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihjKWlmKG1iKWMub25tZXNzYWdlPWE7ZWxzZSBjLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKG1iKXNlbGYub25tZXNzYWdlPWE7ZWxzZSBCYi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gTShhLGMsYil7Y3x8KGM9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksbmIrKyxjPWAke2N9LSR7bmJ9YCwxRTU8bmImJihuYj0wKSk7cmV0dXJue3dvcmtlcklkOmIsbWVzc2FnZUlkOmMsbWVzc2FnZTphfX1mdW5jdGlvbiB4YyhhLGMpe2M9ZWIoYyk7CnN3aXRjaChjLm1lc3NhZ2UudHlwZSl7Y2FzZSB5LkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShNKHt0eXBlOnkuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9MT0NBVElPTi52YWx1ZU9mKCl9LGMubWVzc2FnZUlkKSl9fWZ1bmN0aW9uIHljKGEsYyl7Yz1lYihjKTtzd2l0Y2goYy5tZXNzYWdlLnR5cGUpe2Nhc2UgeS5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5BVURJT19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpOwphLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfMV9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF8yX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzNfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfNF9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE0oe3R5cGU6eS5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5BVURJT19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpfSwKYy5tZXNzYWdlSWQpKTticmVhaztjYXNlIHkuQVVESU9fTEFURU5DWTphLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9Yy5tZXNzYWdlLmxhdGVuY3l9fWZ1bmN0aW9uIHpjKGEsYyl7Yz1lYihjKTtzd2l0Y2goYy5tZXNzYWdlLnR5cGUpe2Nhc2UgeS5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxjLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gWGIoYSl7aWYoIWEud2FzbUJ5dGVNZW1vcnkpcmV0dXJuIG5ldyBVaW50OEFycmF5O2xldCBjPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XSxiPXZvaWQgMDtpZigwPT09YylyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7MTw9YyYmMz49Yz9iPTMyNzY4OjU8PWMmJjY+PWM/Yj0yMDQ4OjE1PD1jJiYxOT49Yz9iPTMyNzY4OjI1PD1jJiYzMD49YyYmKGI9MTMxMDcyKTtyZXR1cm4gYj9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTiwKYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2IpOm5ldyBVaW50OEFycmF5fWZ1bmN0aW9uIFliKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gQWMoYSxjKXtjPWViKGMpO3N3aXRjaChjLm1lc3NhZ2UudHlwZSl7Y2FzZSB5LkNMRUFSX01FTU9SWTpmb3IodmFyIGI9MDtiPD1hLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiKyspYS53YXNtQnl0ZU1lbW9yeVtiXT0wO2I9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSgwKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTSh7dHlwZTp5LkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmIuYnVmZmVyfSxjLm1lc3NhZ2VJZCksW2IuYnVmZmVyXSk7CmJyZWFrO2Nhc2UgeS5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9CT09UX1JPTV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuV0FTTUJPWV9TVEFURV9TSVpFLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTSh7dHlwZTp5LkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9ST01fTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DQVJUUklER0VfUkFNX0xPQ0FUSU9OLnZhbHVlT2YoKSwKV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuV0FTTUJPWV9TVEFURV9TSVpFLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuV0FTTUJPWV9TVEFURV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQkNfUEFMRVRURV9MT0NBVElPTi52YWx1ZU9mKCl9LApjLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgeS5TRVRfTUVNT1JZOmI9T2JqZWN0LmtleXMoYy5tZXNzYWdlKTtiLmluY2x1ZGVzKHouQk9PVF9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShjLm1lc3NhZ2Vbei5CT09UX1JPTV0pLGEuV0FTTUJPWV9CT09UX1JPTV9MT0NBVElPTik7Yi5pbmNsdWRlcyh6LkNBUlRSSURHRV9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShjLm1lc3NhZ2Vbei5DQVJUUklER0VfUk9NXSksYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2IuaW5jbHVkZXMoei5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYy5tZXNzYWdlW3ouQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7Yi5pbmNsdWRlcyh6LkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYy5tZXNzYWdlW3ouR0FNRUJPWV9NRU1PUlldKSwKYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTik7Yi5pbmNsdWRlcyh6LlBBTEVUVEVfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYy5tZXNzYWdlW3ouUEFMRVRURV9NRU1PUlldKSxhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pO2IuaW5jbHVkZXMoei5JTlRFUk5BTF9TVEFURSkmJihhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShjLm1lc3NhZ2Vbei5JTlRFUk5BTF9TVEFURV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE0oe3R5cGU6eS5TRVRfTUVNT1JZX0RPTkV9LGMubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB5LkdFVF9NRU1PUlk6e2I9e3R5cGU6eS5HRVRfTUVNT1JZfTtjb25zdCBOPVtdO3ZhciBkPWMubWVzc2FnZS5tZW1vcnlUeXBlcztpZihkLmluY2x1ZGVzKHouQk9PVF9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXt2YXIgZj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7Zj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGYsZithLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX1NJWkUudmFsdWVPZigpKX1lbHNlIGY9bmV3IFVpbnQ4QXJyYXk7Zj1mLmJ1ZmZlcjtiW3ouQk9PVF9ST01dPWY7Ti5wdXNoKGYpfWlmKGQuaW5jbHVkZXMoei5DQVJUUklER0VfUk9NKSl7aWYoYS53YXNtQnl0ZU1lbW9yeSl7Zj1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIGU9dm9pZCAwOzA9PT1mP2U9MzI3Njg6MTw9ZiYmMz49Zj9lPTIwOTcxNTI6NTw9ZiYmNj49Zj9lPTI2MjE0NDoxNTw9ZiYmMTk+PWY/ZT0yMDk3MTUyOjI1PD1mJiYzMD49ZiYmKGU9ODM4ODYwOCk7Zj1lP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rZSk6Cm5ldyBVaW50OEFycmF5fWVsc2UgZj1uZXcgVWludDhBcnJheTtmPWYuYnVmZmVyO2Jbei5DQVJUUklER0VfUk9NXT1mO04ucHVzaChmKX1kLmluY2x1ZGVzKHouQ0FSVFJJREdFX1JBTSkmJihmPVhiKGEpLmJ1ZmZlcixiW3ouQ0FSVFJJREdFX1JBTV09ZixOLnB1c2goZikpO2QuaW5jbHVkZXMoei5DQVJUUklER0VfSEVBREVSKSYmKGEud2FzbUJ5dGVNZW1vcnk/KGY9YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzA4LGY9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShmLGYrMjcpKTpmPW5ldyBVaW50OEFycmF5LGY9Zi5idWZmZXIsYlt6LkNBUlRSSURHRV9IRUFERVJdPWYsTi5wdXNoKGYpKTtkLmluY2x1ZGVzKHouR0FNRUJPWV9NRU1PUlkpJiYoZj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUpLmJ1ZmZlciwKYlt6LkdBTUVCT1lfTUVNT1JZXT1mLE4ucHVzaChmKSk7ZC5pbmNsdWRlcyh6LlBBTEVUVEVfTUVNT1JZKSYmKGY9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXIsYlt6LlBBTEVUVEVfTUVNT1JZXT1mLE4ucHVzaChmKSk7ZC5pbmNsdWRlcyh6LklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCksZD1ZYihhKS5idWZmZXIsYlt6LklOVEVSTkFMX1NUQVRFXT1kLE4ucHVzaChkKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE0oYixjLm1lc3NhZ2VJZCksTil9fX1mdW5jdGlvbiBvYihhLGMpe2E9MTw8YSYyNTU7Yi5yZWdpc3RlckY9MDxjP2IucmVnaXN0ZXJGfGE6Yi5yZWdpc3RlckYmKDI1NV5hKTtyZXR1cm4gYi5yZWdpc3RlckZ9ZnVuY3Rpb24gdChhKXtvYig3LAphKX1mdW5jdGlvbiB1KGEpe29iKDYsYSl9ZnVuY3Rpb24gRyhhKXtvYig1LGEpfWZ1bmN0aW9uIEsoYSl7b2IoNCxhKX1mdW5jdGlvbiBTYSgpe3JldHVybiBiLnJlZ2lzdGVyRj4+NyYxfWZ1bmN0aW9uIFUoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjQmMX1mdW5jdGlvbiBTKGEsYyl7MDw9Yz9HKDAhPT0oKGEmMTUpKyhjJjE1KSYxNikpOkcoKE1hdGguYWJzKGMpJjE1KT4oYSYxNSkpfWZ1bmN0aW9uIENiKGEsYyl7MDw9Yz9LKGE+KGErYyYyNTUpKTpLKE1hdGguYWJzKGMpPmEpfWZ1bmN0aW9uIFdhKGEsYyxiKXtiPyhhPWFeY15hK2MsRygwIT09KGEmMTYpKSxLKDAhPT0oYSYyNTYpKSk6KGI9YStjJjY1NTM1LEsoYjxhKSxHKDAhPT0oKGFeY15iKSY0MDk2KSkpfWZ1bmN0aW9uIFpiKGEpe3N3aXRjaChhKXtjYXNlIDA6ZC5iZ1doaXRlPUwuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PUwuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PUwuYmdEYXJrR3JleTtkLmJnQmxhY2s9TC5iZ0JsYWNrOwpkLm9iajBXaGl0ZT1MLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9TC5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PUwub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPUwub2JqMEJsYWNrO2Qub2JqMVdoaXRlPUwub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1MLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9TC5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9TC5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAxOmQuYmdXaGl0ZT1pYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9aWEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PWlhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPWlhLmJnQmxhY2s7ZC5vYmowV2hpdGU9aWEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1pYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PWlhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1pYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9aWEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1pYS5vYmoxTGlnaHRHcmV5OwpkLm9iajFEYXJrR3JleT1pYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9aWEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMjpkLmJnV2hpdGU9amEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PWphLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1qYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1qYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPWphLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9amEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1qYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9amEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPWphLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9amEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1qYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9amEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMzpkLmJnV2hpdGU9a2EuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PWthLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1rYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1rYS5iZ0JsYWNrOwpkLm9iajBXaGl0ZT1rYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PWthLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9a2Eub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPWthLm9iajBCbGFjaztkLm9iajFXaGl0ZT1rYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PWthLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9a2Eub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPWthLm9iajFCbGFjazticmVhaztjYXNlIDQ6ZC5iZ1doaXRlPWxhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1sYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9bGEuYmdEYXJrR3JleTtkLmJnQmxhY2s9bGEuYmdCbGFjaztkLm9iajBXaGl0ZT1sYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PWxhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9bGEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPWxhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1sYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PWxhLm9iajFMaWdodEdyZXk7CmQub2JqMURhcmtHcmV5PWxhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1sYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA1OmQuYmdXaGl0ZT1tYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9bWEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PW1hLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPW1hLmJnQmxhY2s7ZC5vYmowV2hpdGU9bWEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1tYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PW1hLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1tYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9bWEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1tYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PW1hLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1tYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA2OmQuYmdXaGl0ZT1uYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9bmEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PW5hLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPW5hLmJnQmxhY2s7CmQub2JqMFdoaXRlPW5hLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9bmEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1uYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9bmEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPW5hLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9bmEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1uYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9bmEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgNzpkLmJnV2hpdGU9b2EuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PW9hLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1vYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1vYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPW9hLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9b2Eub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1vYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9b2Eub2JqMEJsYWNrO2Qub2JqMVdoaXRlPW9hLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9b2Eub2JqMUxpZ2h0R3JleTsKZC5vYmoxRGFya0dyZXk9b2Eub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPW9hLm9iajFCbGFjazticmVhaztjYXNlIDg6ZC5iZ1doaXRlPXBhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1wYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9cGEuYmdEYXJrR3JleTtkLmJnQmxhY2s9cGEuYmdCbGFjaztkLm9iajBXaGl0ZT1wYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PXBhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9cGEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPXBhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1wYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PXBhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9cGEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPXBhLm9iajFCbGFjazticmVhaztjYXNlIDk6ZC5iZ1doaXRlPXFhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1xYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9cWEuYmdEYXJrR3JleTtkLmJnQmxhY2s9cWEuYmdCbGFjazsKZC5vYmowV2hpdGU9cWEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1xYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXFhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1xYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9cWEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1xYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXFhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1xYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAxMDpkLmJnV2hpdGU9cmEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXJhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1yYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1yYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXJhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9cmEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1yYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9cmEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXJhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9cmEub2JqMUxpZ2h0R3JleTsKZC5vYmoxRGFya0dyZXk9cmEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPXJhLm9iajFCbGFjazticmVhaztjYXNlIDExOmQuYmdXaGl0ZT1zYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9c2EuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PXNhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPXNhLmJnQmxhY2s7ZC5vYmowV2hpdGU9c2Eub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1zYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXNhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1zYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9c2Eub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1zYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXNhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1zYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAxMjpkLmJnV2hpdGU9dGEuYmdXaGl0ZSxkLmJnTGlnaHRHcmV5PXRhLmJnTGlnaHRHcmV5LGQuYmdEYXJrR3JleT10YS5iZ0RhcmtHcmV5LGQuYmdCbGFjaz10YS5iZ0JsYWNrLApkLm9iajBXaGl0ZT10YS5vYmowV2hpdGUsZC5vYmowTGlnaHRHcmV5PXRhLm9iajBMaWdodEdyZXksZC5vYmowRGFya0dyZXk9dGEub2JqMERhcmtHcmV5LGQub2JqMEJsYWNrPXRhLm9iajBCbGFjayxkLm9iajFXaGl0ZT10YS5vYmoxV2hpdGUsZC5vYmoxTGlnaHRHcmV5PXRhLm9iajFMaWdodEdyZXksZC5vYmoxRGFya0dyZXk9dGEub2JqMURhcmtHcmV5LGQub2JqMUJsYWNrPXRhLm9iajFCbGFja319ZnVuY3Rpb24gcChhLGMpe3JldHVybihhJjI1NSk8PDh8YyYyNTV9ZnVuY3Rpb24gRShhKXtyZXR1cm4oYSY2NTI4MCk+Pjh9ZnVuY3Rpb24gSChhLGMpe3JldHVybiBjJn4oMTw8YSl9ZnVuY3Rpb24gbihhLGMpe3JldHVybiAwIT0oYyYxPDxhKX1mdW5jdGlvbiBwYihhLGMpe2E9eChjKT4+MiphJjM7aWYoYz09PVhhLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZSlzd2l0Y2goYz1kLm9iajBXaGl0ZSxhKXtjYXNlIDE6Yz1kLm9iajBMaWdodEdyZXk7YnJlYWs7Y2FzZSAyOmM9CmQub2JqMERhcmtHcmV5O2JyZWFrO2Nhc2UgMzpjPWQub2JqMEJsYWNrfWVsc2UgaWYoYz09PVhhLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bylzd2l0Y2goYz1kLm9iajFXaGl0ZSxhKXtjYXNlIDE6Yz1kLm9iajFMaWdodEdyZXk7YnJlYWs7Y2FzZSAyOmM9ZC5vYmoxRGFya0dyZXk7YnJlYWs7Y2FzZSAzOmM9ZC5vYmoxQmxhY2t9ZWxzZSBzd2l0Y2goYz1kLmJnV2hpdGUsYSl7Y2FzZSAxOmM9ZC5iZ0xpZ2h0R3JleTticmVhaztjYXNlIDI6Yz1kLmJnRGFya0dyZXk7YnJlYWs7Y2FzZSAzOmM9ZC5iZ0JsYWNrfXJldHVybiBjfWZ1bmN0aW9uIHFiKGEsYyxiKXtjPTgqYSsyKmM7YT0kYihjKzEsYik7Yj0kYihjLGIpO3JldHVybiBwKGEsYil9ZnVuY3Rpb24gdWEoYSxjKXthKj01O3JldHVybiA4KigoYyYzMTw8YSk+PmEpfWZ1bmN0aW9uICRiKGEsYyl7YSY9NjM7YyYmKGErPTY0KTtyZXR1cm4gZVtZYSthXX1mdW5jdGlvbiByYihhLGMsYixkKXt2b2lkIDA9PT1iJiYoYj0KMCk7dm9pZCAwPT09ZCYmKGQ9ITEpO2ImPTM7ZCYmKGJ8PTQpO2VbWmErKDE2MCpjK2EpXT1ifWZ1bmN0aW9uIERiKGEsYyxkLEQsZixnLGgsbCxtLGsscCxxLHUsdyl7dmFyIE49MDtjPWdiKGMsYSk7YT1YKGMrMipnLGQpO2Q9WChjKzIqZysxLGQpO2ZvcihnPUQ7Zzw9ZjsrK2cpaWYoYz1oKyhnLUQpLGM8bSl7dmFyIEE9ZztpZigwPnV8fCFuKDUsdSkpQT03LUE7dmFyIFZhPTA7bihBLGQpJiYoVmErPTEsVmE8PD0xKTtuKEEsYSkmJihWYSs9MSk7aWYoYi5HQkNFbmFibGVkJiYoMDw9dXx8MDw9dykpe0E9MDw9dzt2YXIgZmE9dSY3O0EmJihmYT13JjcpO3ZhciBoYT1xYihmYSxWYSxBKTtBPXVhKDAsaGEpO2ZhPXVhKDEsaGEpO2hhPXVhKDIsaGEpfWVsc2UgaWYoMD49cSYmKHE9ci5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlKSxwKXtmYT1WYTtoYT1wO3ZvaWQgMD09PWhhJiYoaGE9ITEpO0E9ZmE7aGF8fChBPXgocSk+PihmYTw8MSkmMyk7ZmE9MjQyO3N3aXRjaChBKXtjYXNlIDE6ZmE9CjE2MDticmVhaztjYXNlIDI6ZmE9ODg7YnJlYWs7Y2FzZSAzOmZhPTh9ZmE9QT1oYT1mYX1lbHNlIGhhPXBiKFZhLHEpLEE9KGhhJjE2NzExNjgwKT4+MTYsZmE9KGhhJjY1MjgwKT4+OCxoYSY9MjU1O2srPTMqKGwqbStjKTtlW2srMF09QTtlW2srMV09ZmE7ZVtrKzJdPWhhO0E9ITE7MDw9dSYmKEE9big3LHUpKTtyYihjLGwsVmEsQSk7TisrfXJldHVybiBOfWZ1bmN0aW9uIGdiKGEsYyl7YT09PXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCYmKGM9big3LGMpP2MtMTI4OmMrMTI4KTtyZXR1cm4gYSsxNipjfWZ1bmN0aW9uIGFjKGEsYyl7c3dpdGNoKGEpe2Nhc2UgMTpyZXR1cm4gbihjLDEyOSk7Y2FzZSAyOnJldHVybiBuKGMsMTM1KTtjYXNlIDM6cmV0dXJuIG4oYywxMjYpO2RlZmF1bHQ6cmV0dXJuIG4oYywxKX19ZnVuY3Rpb24gYmMoKXt2YXIgYT1jYygpOzIwNDc+PWEmJjA8Qi5OUngwU3dlZXBTaGlmdCYmKEIuc3dlZXBTaGFkb3dGcmVxdWVuY3k9YSwKQi5zZXRGcmVxdWVuY3koYSksYT1jYygpKTsyMDQ3PGEmJihCLmlzRW5hYmxlZD0hMSl9ZnVuY3Rpb24gY2MoKXt2YXIgYT1CLnN3ZWVwU2hhZG93RnJlcXVlbmN5O3ZhciBjPWE+PkIuTlJ4MFN3ZWVwU2hpZnQ7cmV0dXJuIGM9Qi5OUngwTmVnYXRlP2EtYzphK2N9ZnVuY3Rpb24gc2IoYSl7c3dpdGNoKGEpe2Nhc2UgQi5jaGFubmVsTnVtYmVyOmE9Qi5pc0RhY0VuYWJsZWQ7dmFyIGM9dy5jaGFubmVsMURhY0VuYWJsZWQhPT1hO3cuY2hhbm5lbDFEYWNFbmFibGVkPWE7cmV0dXJuIGM7Y2FzZSBPLmNoYW5uZWxOdW1iZXI6cmV0dXJuIGE9Ty5pc0RhY0VuYWJsZWQsYz13LmNoYW5uZWwyRGFjRW5hYmxlZCE9PWEsdy5jaGFubmVsMkRhY0VuYWJsZWQ9YSxjO2Nhc2UgSi5jaGFubmVsTnVtYmVyOnJldHVybiBhPUouaXNEYWNFbmFibGVkLGM9dy5jaGFubmVsM0RhY0VuYWJsZWQhPT1hLHcuY2hhbm5lbDNEYWNFbmFibGVkPWEsYztjYXNlIFAuY2hhbm5lbE51bWJlcjpyZXR1cm4gYT1QLmlzRGFjRW5hYmxlZCwKYz13LmNoYW5uZWw0RGFjRW5hYmxlZCE9PWEsdy5jaGFubmVsNERhY0VuYWJsZWQ9YSxjfXJldHVybiExfWZ1bmN0aW9uIHRiKCl7Zm9yKHZhciBhPWwuYmF0Y2hQcm9jZXNzQ3ljbGVzKCk7bC5jdXJyZW50Q3ljbGVzPj1hOylkYyhhKSxsLmN1cnJlbnRDeWNsZXMtPWF9ZnVuY3Rpb24gZGMoYSl7dmFyIGM9bC5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzKCk7dmFyIGI9bC5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyK2E7aWYoYj49Yyl7bC5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPWItYztjPWwuZnJhbWVTZXF1ZW5jZXI7c3dpdGNoKGMpe2Nhc2UgMDpCLnVwZGF0ZUxlbmd0aCgpO08udXBkYXRlTGVuZ3RoKCk7Si51cGRhdGVMZW5ndGgoKTtQLnVwZGF0ZUxlbmd0aCgpO2JyZWFrO2Nhc2UgMjpCLnVwZGF0ZUxlbmd0aCgpO08udXBkYXRlTGVuZ3RoKCk7Si51cGRhdGVMZW5ndGgoKTtQLnVwZGF0ZUxlbmd0aCgpO0IudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDQ6Qi51cGRhdGVMZW5ndGgoKTsKTy51cGRhdGVMZW5ndGgoKTtKLnVwZGF0ZUxlbmd0aCgpO1AudXBkYXRlTGVuZ3RoKCk7YnJlYWs7Y2FzZSA2OkIudXBkYXRlTGVuZ3RoKCk7Ty51cGRhdGVMZW5ndGgoKTtKLnVwZGF0ZUxlbmd0aCgpO1AudXBkYXRlTGVuZ3RoKCk7Qi51cGRhdGVTd2VlcCgpO2JyZWFrO2Nhc2UgNzpCLnVwZGF0ZUVudmVsb3BlKCksTy51cGRhdGVFbnZlbG9wZSgpLFAudXBkYXRlRW52ZWxvcGUoKX1sLmZyYW1lU2VxdWVuY2VyPWMrMSY3O2M9ITB9ZWxzZSBsLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9YixjPSExO2lmKFIuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcyYmIWMpe2M9Qi53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8c2IoQi5jaGFubmVsTnVtYmVyKTtiPU8ud2lsbENoYW5uZWxVcGRhdGUoYSl8fHNiKE8uY2hhbm5lbE51bWJlcik7dmFyIGQ9Si53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8c2IoSi5jaGFubmVsTnVtYmVyKSxmPVAud2lsbENoYW5uZWxVcGRhdGUoYSl8fHNiKFAuY2hhbm5lbE51bWJlcik7CmMmJih3LmNoYW5uZWwxU2FtcGxlPUIuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtiJiYody5jaGFubmVsMlNhbXBsZT1PLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7ZCYmKHcuY2hhbm5lbDNTYW1wbGU9Si5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2YmJih3LmNoYW5uZWw0U2FtcGxlPVAuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtpZihjfHxifHxkfHxmKXcubmVlZFRvUmVtaXhTYW1wbGVzPSEwO2M9bC5kb3duU2FtcGxlQ3ljbGVDb3VudGVyO2MrPWEqbC5kb3duU2FtcGxlQ3ljbGVNdWx0aXBsaWVyO2E9bC5tYXhEb3duU2FtcGxlQ3ljbGVzKCk7Yz49YSYmKGMtPWEsbC5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPWMsdy5uZWVkVG9SZW1peFNhbXBsZXN8fHcubWl4ZXJWb2x1bWVDaGFuZ2VkfHx3Lm1peGVyRW5hYmxlZENoYW5nZWQ/JGEody5jaGFubmVsMVNhbXBsZSx3LmNoYW5uZWwyU2FtcGxlLHcuY2hhbm5lbDNTYW1wbGUsdy5jaGFubmVsNFNhbXBsZSk6CmwuZG93blNhbXBsZUN5Y2xlQ291bnRlcj1jLGFiKHcubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGUrMSx3LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZSsxLHViKSxhPWwuYXVkaW9RdWV1ZUluZGV4KzEsYT49KGwud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemU+PjF8MCktMSYmLS1hLGwuYXVkaW9RdWV1ZUluZGV4PWEpfWVsc2V7Yz1CLmdldFNhbXBsZShhKXwwO2I9Ty5nZXRTYW1wbGUoYSl8MDtkPUouZ2V0U2FtcGxlKGEpfDA7Zj1QLmdldFNhbXBsZShhKXwwO3cuY2hhbm5lbDFTYW1wbGU9Yzt3LmNoYW5uZWwyU2FtcGxlPWI7dy5jaGFubmVsM1NhbXBsZT1kO3cuY2hhbm5lbDRTYW1wbGU9ZjthPWwuZG93blNhbXBsZUN5Y2xlQ291bnRlcithKmwuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcjtpZihhPj1sLm1heERvd25TYW1wbGVDeWNsZXMoKSl7YS09bC5tYXhEb3duU2FtcGxlQ3ljbGVzKCk7dmFyIGU9JGEoYyxiLGQsZiksZz1FKGUpO2FiKGcrMSwoZSYyNTUpKwoxLHViKTtSLmVuYWJsZUF1ZGlvRGVidWdnaW5nJiYoZT0kYShjLDE1LDE1LDE1KSxnPUUoZSksYWIoZysxLChlJjI1NSkrMSxFYiksZT0kYSgxNSxiLDE1LDE1KSxnPUUoZSksYWIoZysxLChlJjI1NSkrMSxGYiksZT0kYSgxNSwxNSxkLDE1KSxnPUUoZSksYWIoZysxLChlJjI1NSkrMSxHYiksZT0kYSgxNSwxNSwxNSxmKSxnPUUoZSksYWIoZysxLChlJjI1NSkrMSxIYikpO2M9bC5hdWRpb1F1ZXVlSW5kZXgrMTtjPj0obC53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZT4+MXwwKS0xJiYtLWM7bC5hdWRpb1F1ZXVlSW5kZXg9Y31sLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9YX19ZnVuY3Rpb24gZWMoKXtyZXR1cm4gbC5hdWRpb1F1ZXVlSW5kZXh9ZnVuY3Rpb24gZmMoKXtsLmF1ZGlvUXVldWVJbmRleD0wfWZ1bmN0aW9uICRhKGEsYyxiLGQpe3ZvaWQgMD09PWEmJihhPTE1KTt2b2lkIDA9PT1jJiYoYz0xNSk7dm9pZCAwPT09YiYmKGI9MTUpO3ZvaWQgMD09PWQmJihkPTE1KTt3Lm1peGVyVm9sdW1lQ2hhbmdlZD0KITE7dmFyIE49MCsobC5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ/YToxNSk7Tis9bC5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ/YzoxNTtOKz1sLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD9iOjE1O04rPWwuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0P2Q6MTU7YT0wKyhsLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ/YToxNSk7YSs9bC5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0P2M6MTU7YSs9bC5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0P2I6MTU7YSs9bC5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0P2Q6MTU7dy5taXhlckVuYWJsZWRDaGFuZ2VkPSExO3cubmVlZFRvUmVtaXhTYW1wbGVzPSExO2M9Z2MoTixsLk5SNTBMZWZ0TWl4ZXJWb2x1bWUrMSk7Yj1nYyhhLGwuTlI1MFJpZ2h0TWl4ZXJWb2x1bWUrMSk7dy5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0KYzt3LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT1iO3JldHVybiBwKGMsYil9ZnVuY3Rpb24gZ2MoYSxjKXtpZig2MD09PWEpcmV0dXJuIDEyNzthPTFFNSooYS02MCkqYz4+MzthPShhLzFFNXwwKSs2MDthPTFFNSphLygxMkU2LzI1NHwwKXwwO3JldHVybiBhfD0wfWZ1bmN0aW9uIGFiKGEsYyxiKXtiKz1sLmF1ZGlvUXVldWVJbmRleDw8MTtlW2IrMF09YSsxO2VbYisxXT1jKzF9ZnVuY3Rpb24gaGIoYSl7dmIoITEpO3ZhciBjPXgobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpO2M9SChhLGMpO20uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWM7ZyhtLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCxjKTtiLnN0YWNrUG9pbnRlci09MjtiLmlzSGFsdGVkKCk7Yz1iLnN0YWNrUG9pbnRlcjt2YXIgZD1iLnByb2dyYW1Db3VudGVyLEQ9RShkKTtnKGMrMCxkJjI1NSk7ZyhjKzEsRCk7c3dpdGNoKGEpe2Nhc2UgbS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdDptLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPQohMTtiLnByb2dyYW1Db3VudGVyPTY0O2JyZWFrO2Nhc2UgbS5iaXRQb3NpdGlvbkxjZEludGVycnVwdDptLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9NzI7YnJlYWs7Y2FzZSBtLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ6bS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9ODA7YnJlYWs7Y2FzZSBtLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0Om0uaXNTZXJpYWxJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7Yi5wcm9ncmFtQ291bnRlcj04ODticmVhaztjYXNlIG0uYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQ6bS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD0hMSxiLnByb2dyYW1Db3VudGVyPTk2fX1mdW5jdGlvbiBiYihhKXt2YXIgYz14KG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KTtjfD0xPDxhO20uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWM7ZyhtLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCwKYyl9ZnVuY3Rpb24gdmIoYSl7YT9tLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PSEwOm0ubWFzdGVySW50ZXJydXB0U3dpdGNoPSExfWZ1bmN0aW9uIEliKGEpe2Zvcih2YXIgYz0wO2M8YTspe3ZhciBiPXEuZGl2aWRlclJlZ2lzdGVyLGQ9YjtjKz00O2QrPTQ7ZCY9NjU1MzU7cS5kaXZpZGVyUmVnaXN0ZXI9ZDtpZihxLnRpbWVyRW5hYmxlZCl7dmFyIGY9cS50aW1lckNvdW50ZXJXYXNSZXNldDtxLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk/KHEudGltZXJDb3VudGVyPXEudGltZXJNb2R1bG8sbS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSEwLGJiKG0uYml0UG9zaXRpb25UaW1lckludGVycnVwdCkscS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExLHEudGltZXJDb3VudGVyV2FzUmVzZXQ9ITApOmYmJihxLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExKTtoYyhiLGQpJiZKYigpfX19ZnVuY3Rpb24gSmIoKXt2YXIgYT1xLnRpbWVyQ291bnRlcjsyNTU8KythJiYocS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PQohMCxhPTApO3EudGltZXJDb3VudGVyPWF9ZnVuY3Rpb24gaGMoYSxjKXt2YXIgYj1LYihxLnRpbWVySW5wdXRDbG9jayk7cmV0dXJuIG4oYixhKSYmIW4oYixjKX1mdW5jdGlvbiBLYihhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiA5O2Nhc2UgMTpyZXR1cm4gMztjYXNlIDI6cmV0dXJuIDU7Y2FzZSAzOnJldHVybiA3fXJldHVybiAwfWZ1bmN0aW9uIFRhKGEpe3ZhciBjPWIuaXNTdG9wcGVkPSExO0JjKGEpfHwoYz0hMCk7SWEoYSwhMCk7YyYmKGM9ITEsMz49YSYmKGM9ITApLGE9ITEsQy5pc0RwYWRUeXBlJiZjJiYoYT0hMCksQy5pc0J1dHRvblR5cGUmJiFjJiYoYT0hMCksYSYmKG0uaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsYmIobS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCkpKX1mdW5jdGlvbiBCYyhhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiBDLnVwO2Nhc2UgMTpyZXR1cm4gQy5yaWdodDtjYXNlIDI6cmV0dXJuIEMuZG93bjtjYXNlIDM6cmV0dXJuIEMubGVmdDsKY2FzZSA0OnJldHVybiBDLmE7Y2FzZSA1OnJldHVybiBDLmI7Y2FzZSA2OnJldHVybiBDLnNlbGVjdDtjYXNlIDc6cmV0dXJuIEMuc3RhcnQ7ZGVmYXVsdDpyZXR1cm4hMX19ZnVuY3Rpb24gSWEoYSxjKXtzd2l0Y2goYSl7Y2FzZSAwOkMudXA9YzticmVhaztjYXNlIDE6Qy5yaWdodD1jO2JyZWFrO2Nhc2UgMjpDLmRvd249YzticmVhaztjYXNlIDM6Qy5sZWZ0PWM7YnJlYWs7Y2FzZSA0OkMuYT1jO2JyZWFrO2Nhc2UgNTpDLmI9YzticmVhaztjYXNlIDY6Qy5zZWxlY3Q9YzticmVhaztjYXNlIDc6Qy5zdGFydD1jfX1mdW5jdGlvbiBpYyhhLGMsZCl7Zm9yKHZhciBOPTA7TjxkOysrTil7Zm9yKHZhciBmPUxiKGErTiksZT1jK047NDA5NTk8ZTspZS09ODE5MjtqYyhlLGYpfWguRE1BQ3ljbGVzKz0oMzI8PGIuR0JDRG91YmxlU3BlZWQpKihkPj40KX1mdW5jdGlvbiBNYihhLGMpe2lmKGE9PT1iLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpcmV0dXJuIGcoYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoLApjJjEpLCExO2lmKGIuQm9vdFJPTUVuYWJsZWQmJmE9PT1iLm1lbW9yeUxvY2F0aW9uQm9vdFJPTVN3aXRjaClyZXR1cm4gYi5Cb290Uk9NRW5hYmxlZD0hMSxiLnByb2dyYW1Db3VudGVyPTI1NSwhMDt2YXIgZD1oLnZpZGVvUmFtTG9jYXRpb24sRD1oLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbjtpZihhPGQpe2lmKCFoLmlzUm9tT25seSl7ZD1oLmlzTUJDMTt2YXIgZj1oLmlzTUJDMjtpZig4MTkxPj1hKXtpZighZnx8big0LGMpKWMmPTE1LDA9PT1jP2guaXNSYW1CYW5raW5nRW5hYmxlZD0hMToxMD09PWMmJihoLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITApfWVsc2UgMTYzODM+PWE/KEQ9aC5pc01CQzUsIUR8fDEyMjg3Pj1hPyhhPWguY3VycmVudFJvbUJhbmssZiYmKGE9YyYxNSksZD8oYyY9MzEsYSY9MjI0KTpoLmlzTUJDMz8oYyY9MTI3LGEmPTEyOCk6RCYmKGEmPTApLGguY3VycmVudFJvbUJhbms9YXxjKTpoLmN1cnJlbnRSb21CYW5rPXAoMDxjLGguY3VycmVudFJvbUJhbmsmCjI1NSkpOiFmJiYyNDU3NT49YT9kJiZoLmlzTUJDMVJvbU1vZGVFbmFibGVkPyhhPWguY3VycmVudFJvbUJhbmsmMzEsaC5jdXJyZW50Um9tQmFuaz1hfGMmMjI0KTooYz1oLmlzTUJDNT9jJjE1OmMmMyxoLmN1cnJlbnRSYW1CYW5rPWMpOiFmJiYzMjc2Nz49YSYmZCYmKGguaXNNQkMxUm9tTW9kZUVuYWJsZWQ9bigwLGMpKX1yZXR1cm4hMX1pZihhPj1kJiZhPGguY2FydHJpZGdlUmFtTG9jYXRpb24pcmV0dXJuITA7aWYoYT49aC5lY2hvUmFtTG9jYXRpb24mJmE8RClyZXR1cm4gZyhhLTgxOTIsYyksITA7aWYoYT49RCYmYTw9aC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQpcmV0dXJuIDI8PXYuY3VycmVudExjZE1vZGU7aWYoYT49aC51bnVzYWJsZU1lbW9yeUxvY2F0aW9uJiZhPD1oLnVudXNhYmxlTWVtb3J5RW5kTG9jYXRpb24pcmV0dXJuITE7aWYoYT09PVoubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckNvbnRyb2wpcmV0dXJuIFoudXBkYXRlVHJhbnNmZXJDb250cm9sKGMpOwppZig2NTI5Njw9YSYmNjUzMTg+PWEpe3RiKCk7aWYoYT09PWwubWVtb3J5TG9jYXRpb25OUjUyfHxsLk5SNTJJc1NvdW5kRW5hYmxlZCl7c3dpdGNoKGEpe2Nhc2UgQi5tZW1vcnlMb2NhdGlvbk5SeDA6Qi51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2UgSi5tZW1vcnlMb2NhdGlvbk5SeDA6Si51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2UgQi5tZW1vcnlMb2NhdGlvbk5SeDE6Qi51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgTy5tZW1vcnlMb2NhdGlvbk5SeDE6Ty51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgSi5tZW1vcnlMb2NhdGlvbk5SeDE6Si51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgUC5tZW1vcnlMb2NhdGlvbk5SeDE6UC51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgQi5tZW1vcnlMb2NhdGlvbk5SeDI6Qi51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgTy5tZW1vcnlMb2NhdGlvbk5SeDI6Ty51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgSi5tZW1vcnlMb2NhdGlvbk5SeDI6Si52b2x1bWVDb2RlQ2hhbmdlZD0KITA7Si51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgUC5tZW1vcnlMb2NhdGlvbk5SeDI6UC51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgQi5tZW1vcnlMb2NhdGlvbk5SeDM6Qi51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgTy5tZW1vcnlMb2NhdGlvbk5SeDM6Ty51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgSi5tZW1vcnlMb2NhdGlvbk5SeDM6Si51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgUC5tZW1vcnlMb2NhdGlvbk5SeDM6UC51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgQi5tZW1vcnlMb2NhdGlvbk5SeDQ6big3LGMpJiYoQi51cGRhdGVOUng0KGMpLEIudHJpZ2dlcigpKTticmVhaztjYXNlIE8ubWVtb3J5TG9jYXRpb25OUng0Om4oNyxjKSYmKE8udXBkYXRlTlJ4NChjKSxPLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBKLm1lbW9yeUxvY2F0aW9uTlJ4NDpuKDcsYykmJihKLnVwZGF0ZU5SeDQoYyksSi50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgUC5tZW1vcnlMb2NhdGlvbk5SeDQ6big3LApjKSYmKFAudXBkYXRlTlJ4NChjKSxQLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBsLm1lbW9yeUxvY2F0aW9uTlI1MDpsLnVwZGF0ZU5SNTAoYyk7dy5taXhlclZvbHVtZUNoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBsLm1lbW9yeUxvY2F0aW9uTlI1MTpsLnVwZGF0ZU5SNTEoYyk7dy5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO2JyZWFrO2Nhc2UgbC5tZW1vcnlMb2NhdGlvbk5SNTI6aWYobC51cGRhdGVOUjUyKGMpLCFuKDcsYykpZm9yKGM9NjUyOTY7NjUzMTg+YzsrK2MpZyhjLDApfWM9ITB9ZWxzZSBjPSExO3JldHVybiBjfTY1MzI4PD1hJiY2NTM0Mz49YSYmdGIoKTtpZihhPj12Lm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbCYmYTw9ci5tZW1vcnlMb2NhdGlvbldpbmRvd1gpe2lmKGE9PT12Lm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbClyZXR1cm4gdi51cGRhdGVMY2RDb250cm9sKGMpLCEwO2lmKGE9PT12Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKXJldHVybiB2LnVwZGF0ZUxjZFN0YXR1cyhjKSwKITE7aWYoYT09PXIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyKXJldHVybiByLnNjYW5saW5lUmVnaXN0ZXI9MCxnKGEsMCksITE7aWYoYT09PXYubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmUpcmV0dXJuIHYuY29pbmNpZGVuY2VDb21wYXJlPWMsITA7aWYoYT09PXIubWVtb3J5TG9jYXRpb25EbWFUcmFuc2Zlcil7Yzw8PTg7Zm9yKGE9MDsxNTk+PWE7KythKWQ9eChjK2EpLGcoaC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24rYSxkKTtoLkRNQUN5Y2xlcz02NDQ7cmV0dXJuITB9c3dpdGNoKGEpe2Nhc2Ugci5tZW1vcnlMb2NhdGlvblNjcm9sbFg6ci5zY3JvbGxYPWM7YnJlYWs7Y2FzZSByLm1lbW9yeUxvY2F0aW9uU2Nyb2xsWTpyLnNjcm9sbFk9YzticmVhaztjYXNlIHIubWVtb3J5TG9jYXRpb25XaW5kb3dYOnIud2luZG93WD1jO2JyZWFrO2Nhc2Ugci5tZW1vcnlMb2NhdGlvbldpbmRvd1k6ci53aW5kb3dZPWN9cmV0dXJuITB9aWYoYT09PWgubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcilyZXR1cm4gYi5HQkNFbmFibGVkJiYKKGguaXNIYmxhbmtIZG1hQWN0aXZlJiYhbig3LGMpPyhoLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMSxjPXgoaC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyKSxnKGgubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcixjfDEyOCkpOihhPXgoaC5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VIaWdoKSxkPXgoaC5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VMb3cpLGE9cChhLGQpJjY1NTIwLGQ9eChoLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaCksRD14KGgubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25Mb3cpLGQ9cChkLEQpLGQ9KGQmODE3NikraC52aWRlb1JhbUxvY2F0aW9uLEQ9SCg3LGMpLEQ9RCsxPDw0LG4oNyxjKT8oaC5pc0hibGFua0hkbWFBY3RpdmU9ITAsaC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc9RCxoLmhibGFua0hkbWFTb3VyY2U9YSxoLmhibGFua0hkbWFEZXN0aW5hdGlvbj1kLGcoaC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLEgoNywKYykpKTooaWMoYSxkLEQpLGcoaC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLDI1NSkpKSksITE7aWYoKGE9PT1oLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmt8fGE9PT1oLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbmspJiZoLmlzSGJsYW5rSGRtYUFjdGl2ZSYmKGQ9aC5oYmxhbmtIZG1hU291cmNlLDE2Mzg0PD1kJiYzMjc2Nz49ZHx8NTMyNDg8PWQmJjU3MzQzPj1kKSlyZXR1cm4hMTtpZihhPj1YYS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXgmJmE8PVhhLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZURhdGEpe2Q9WGEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YTtpZihhPT09WGEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZURhdGF8fGE9PT1kKUQ9eChhLTEpLEQ9SCg2LEQpLGY9RCY2MyxhPT09ZCYmKGYrPTY0KSxlW1lhK2ZdPWMsYz1ELC0tYSxuKDcsYykmJmcoYSxjKzF8MTI4KTtyZXR1cm4hMH1pZihhPj1xLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyJiYKYTw9cS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbCl7SWIocS5jdXJyZW50Q3ljbGVzKTtxLmN1cnJlbnRDeWNsZXM9MDtzd2l0Y2goYSl7Y2FzZSBxLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyOnJldHVybiBxLnVwZGF0ZURpdmlkZXJSZWdpc3RlcigpLCExO2Nhc2UgcS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcjpxLnVwZGF0ZVRpbWVyQ291bnRlcihjKTticmVhaztjYXNlIHEubWVtb3J5TG9jYXRpb25UaW1lck1vZHVsbzpxLnVwZGF0ZVRpbWVyTW9kdWxvKGMpO2JyZWFrO2Nhc2UgcS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbDpxLnVwZGF0ZVRpbWVyQ29udHJvbChjKX1yZXR1cm4hMH1hPT09Qy5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyJiZDLnVwZGF0ZUpveXBhZChjKTtpZihhPT09bS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpcmV0dXJuIG0udXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKGMpLCEwO2E9PT1tLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZCYmCm0udXBkYXRlSW50ZXJydXB0RW5hYmxlZChjKTtyZXR1cm4hMH1mdW5jdGlvbiBOYihhKXtzd2l0Y2goYT4+MTIpe2Nhc2UgMDppZihiLkJvb3RST01FbmFibGVkKWlmKGIuR0JDRW5hYmxlZCl7aWYoMjU2PmF8fDUxMTxhJiYyMzA0PmEpcmV0dXJuIGErd2J9ZWxzZSBpZighYi5HQkNFbmFibGVkJiYyNTY+YSlyZXR1cm4gYSt3YjtjYXNlIDE6Y2FzZSAyOmNhc2UgMzpyZXR1cm4gYSt4YjtjYXNlIDQ6Y2FzZSA1OmNhc2UgNjpjYXNlIDc6dmFyIGM9aC5jdXJyZW50Um9tQmFuaztoLmlzTUJDNXx8MCE9PWN8fChjPTEpO3JldHVybiAxNjM4NCpjKyhhLWguc3dpdGNoYWJsZUNhcnRyaWRnZVJvbUxvY2F0aW9uKSt4YjtjYXNlIDg6Y2FzZSA5OnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz14KGgubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmMSksYS1oLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKmM7Y2FzZSAxMDpjYXNlIDExOnJldHVybiA4MTkyKmguY3VycmVudFJhbUJhbmsrCihhLWguY2FydHJpZGdlUmFtTG9jYXRpb24pK09iO2Nhc2UgMTI6cmV0dXJuIGEtaC5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzI7Y2FzZSAxMzpyZXR1cm4gYz0wLGIuR0JDRW5hYmxlZCYmKGM9eChoLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmspJjcpLGEtaC5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzIrNDA5NiooKDE+Yz8xOmMpLTEpO2RlZmF1bHQ6cmV0dXJuIGEtaC5lY2hvUmFtTG9jYXRpb24rNTEyMDB9fWZ1bmN0aW9uIGcoYSxjKXthPU5iKGEpO2VbYV09Y31mdW5jdGlvbiBqYyhhLGMpe2E9PT1hYS53cml0ZUdiTWVtb3J5JiYoYWEucmVhY2hlZEJyZWFrcG9pbnQ9ITApO01iKGEsYykmJmcoYSxjKX1mdW5jdGlvbiBrYyhhKXtyLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7ci5zY2FubGluZVJlZ2lzdGVyPTA7ZyhyLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlciwwKTt2YXIgYz14KHYubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO2M9SCgxLApjKTtjPUgoMCxjKTt2LmN1cnJlbnRMY2RNb2RlPTA7Zyh2Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGMpO2lmKGEpZm9yKGE9MDs5MzE4ND5hOysrYSllW2NiK2FdPTI1NX1mdW5jdGlvbiBsYyhhLGMpezAhPT1hJiYxIT09YXx8ci5zY2FubGluZVJlZ2lzdGVyIT09di5jb2luY2lkZW5jZUNvbXBhcmU/Yz1IKDIsYyk6KGN8PTQsbig2LGMpJiYobS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMCxiYihtLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSkpO3JldHVybiBjfWZ1bmN0aW9uIG1jKGEsYyxkLEQsZixnKXtmb3IodmFyIE49RD4+MzsxNjA+ZjsrK2Ype3ZhciBoPWYrZzsyNTY8PWgmJihoLT0yNTYpO3ZhciBsPWQrKE48PDUpKyhoPj4zKSxtPVgobCwwKSxrPSExO2lmKFIudGlsZUNhY2hpbmcpe3ZhciBBPWY7dmFyIHA9YSxxPWgsdT1sLHc9bSx0PTAsdj1kYi5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaztpZigwPHAmJjg8QSYmdz09PWRiLnRpbGVJZCYmQT09PXYpe3c9Cm4oNSx4KHUtMSkpO3U9big1LHgodSkpO2Zvcih2YXIgeT0wOzg+eTsrK3kpe3chPT11JiYoeT03LXkpO3ZhciB6PUEreTtpZigxNjA+PXope3ZhciBCPUEtKDgteSksQz1jYiszKigxNjAqcCt6KTtjYSh6LHAsMCxlW0NdKTtjYSh6LHAsMSxlW0NdKTtjYSh6LHAsMixlW0NdKTtCPWVbWmErKDE2MCpwK0IpXTtyYih6LHAsSCgyLEIpLG4oMixCKSk7dCsrfX19ZWxzZSBkYi50aWxlSWQ9dztBPj12JiYodj1BKzgscD1xJjd8MCxBPHAmJih2Kz1wKSk7ZGIubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9djtBPXQ7MDxBJiYoZis9QS0xLGs9ITApfVIudGlsZVJlbmRlcmluZyYmIWs/KGs9ZixBPWEscD1oLGg9Yyx0PUQmN3wwLHY9MCwwPT1rJiYodj1wLShwPj4zPDwzKSkscD03LDE2MDxrKzgmJihwPTE2MC1rKSxxPS0xLHc9MCxiLkdCQ0VuYWJsZWQmJihxPVgobCwxKSx3PW4oMyxxKXwwLG4oNixxKSYmKHQ9Ny10KSksQT1EYihtLGgsdyx2LHAsdCxrLEEsMTYwLGNiLCExLDAscSwKLTEpLDA8QSYmKGYrPUEtMSkpOmt8fChiLkdCQ0VuYWJsZWQ/KGs9ZixBPWEsdj1ELHQ9Z2IoYyxtKSxtPVgobCwxKSx2PXYmN3wwLG4oNixtKSYmKHY9Ny12KSxwPW4oMyxtKXwwLGw9WCh0KzIqdixwKSx0PVgodCsyKnYrMSxwKSx2PWgmN3wwLG4oNSxtKXx8KHY9Ny12KSxoPTAsbih2LHQpJiYoaD1oKzE8PDEpLG4odixsKSYmKGgrPTEpLHY9cWIobSY3LGgsITEpLGw9dWEoMCx2KSx0PXVhKDEsdiksdj11YSgyLHYpLGNhKGssQSwwLGwpLGNhKGssQSwxLHQpLGNhKGssQSwyLHYpLHJiKGssQSxoLG4oNyxtKSkpOihsPWYsaz1hLHQ9RCxBPWdiKGMsbSksdD10Jjd8MCxtPVgoQSsyKnQsMCksQT1YKEErMip0KzEsMCksdD1oJjd8MCx0PTctdCxoPTAsbih0LEEpJiYoaD1oKzE8PDEpLG4odCxtKSYmKGgrPTEpLG09cGIoaCxyLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLGNhKGwsaywwLChtJjE2NzExNjgwKT4+MTYpLGNhKGwsaywxLChtJjY1MjgwKT4+OCksY2EobCxrLAoyLG0mMjU1KSxyYihsLGssaCkpKX19ZnVuY3Rpb24gbmMoYSl7aWYodi5lbmFibGVkKWZvcihyLnNjYW5saW5lQ3ljbGVDb3VudGVyKz1hLGE9Ui5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZztyLnNjYW5saW5lQ3ljbGVDb3VudGVyPj1yLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCk7KXtyLnNjYW5saW5lQ3ljbGVDb3VudGVyLT1yLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCk7dmFyIGM9ci5zY2FubGluZVJlZ2lzdGVyO2lmKDE0ND09PWMpe2lmKGEpZm9yKHZhciBiPTA7MTQ0Pj1iOysrYilQYihiKTtlbHNlIFBiKGMpO2ZvcihiPTA7MTQ0PmI7KytiKWZvcih2YXIgZD0wOzE2MD5kOysrZCllW1phKygxNjAqYitkKV09MDtkYi50aWxlSWQ9LTE7ZGIubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9LTF9ZWxzZSAxNDQ+YyYmKGF8fFBiKGMpKTtjPTE1MzxjPzA6YysxO3Iuc2NhbmxpbmVSZWdpc3Rlcj1jfWlmKHYuZW5hYmxlZCl7Yz1yLnNjYW5saW5lUmVnaXN0ZXI7CmI9di5jdXJyZW50TGNkTW9kZTthPTA7aWYoMTQ0PD1jKWE9MTtlbHNle2Q9ci5zY2FubGluZUN5Y2xlQ291bnRlcjt2YXIgZj1yLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERSgpO2Q+PWY/YT0yOmQ+PWYmJihhPTMpfWlmKGIhPT1hKXtjPXgodi5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyk7di5jdXJyZW50TGNkTW9kZT1hO2I9ITE7c3dpdGNoKGEpe2Nhc2UgMDpjPUgoMCxjKTtjPUgoMSxjKTtiPW4oMyxjKTticmVhaztjYXNlIDE6Yz1IKDEsYyk7Y3w9MTtiPW4oNCxjKTticmVhaztjYXNlIDI6Yz1IKDAsYyk7Y3w9MjtiPW4oNSxjKTticmVhaztjYXNlIDM6Y3w9M31iJiYobS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMCxiYihtLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSk7MD09PWEmJmguaXNIYmxhbmtIZG1hQWN0aXZlJiYoZD0xNixiPWguaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nLGI8ZCYmKGQ9YiksaWMoaC5oYmxhbmtIZG1hU291cmNlLGguaGJsYW5rSGRtYURlc3RpbmF0aW9uLApkKSxoLmhibGFua0hkbWFTb3VyY2UrPWQsaC5oYmxhbmtIZG1hRGVzdGluYXRpb24rPWQsYi09ZCxoLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz1iLGQ9aC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLDA+PWI/KGguaXNIYmxhbmtIZG1hQWN0aXZlPSExLGcoZCwyNTUpKTpnKGQsSCg3LChiPj40KS0xKSkpOzE9PT1hJiYobS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMCxiYihtLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSk7Yz1sYyhhLGMpO2codi5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxjKX1lbHNlIDE1Mz09PWMmJihjPXgodi5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyksYz1sYyhhLGMpLGcodi5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxjKSl9fWZ1bmN0aW9uIFBiKGEpe3ZhciBjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydDt2LmJnV2luZG93VGlsZURhdGFTZWxlY3QmJihjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0KTsKaWYoYi5HQkNFbmFibGVkfHx2LmJnRGlzcGxheUVuYWJsZWQpe3ZhciBkPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0O3YuYmdUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCk7bWMoYSxjLGQsYStyLnNjcm9sbFkmMjU1LDAsci5zY3JvbGxYKX1pZih2LndpbmRvd0Rpc3BsYXlFbmFibGVkKXtkPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0O3Yud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3QmJihkPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpO3ZhciBEPXIud2luZG93WCxmPXIud2luZG93WTthPGZ8fChELT03LG1jKGEsYyxkLGEtZixELC1EfDApKX1pZih2LnNwcml0ZURpc3BsYXlFbmFibGUpZm9yKGM9di50YWxsU3ByaXRlU2l6ZSxkPTM5OzA8PWQ7LS1kKXtmPTQqZDt2YXIgZz1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlKwpmLGg9eChnKzApO0Q9eChnKzEpO3ZhciBsPXgoZysyKTtoLT0xNjtELT04O3ZhciBtPTg7YyYmKG09MTYsbC09bCYxKTtpZihhPj1oJiZhPGgrbSl7Zj14KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZiszKTtnPW4oNyxmKTt2YXIgaz1uKDYsZikscD1uKDUsZik7aD1hLWg7ayYmKGg9bS1oLC0taCk7aDw8PTE7bD1nYihyLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCxsKTtsKz1oO209Yi5HQkNFbmFibGVkJiZuKDMsZik7aD1YKGwrMCxtKTtsPVgobCsxLG0pO2ZvcihtPTc7MDw9bTstLW0pe2s9bTtwJiYoay09NyxrPS1rKTt2YXIgcT0wO24oayxsKSYmKHE9cSsxPDwxKTtuKGssaCkmJihxKz0xKTtpZigwIT09cSYmKGs9RCsoNy1tKSwwPD1rJiYxNjA+PWspKXt2YXIgdD1iLkdCQ0VuYWJsZWQmJiF2LmJnRGlzcGxheUVuYWJsZWQsdT0hMSx3PSExO2lmKCF0KXt2YXIgeT1lW1phKygxNjAqYStrKV0sej15JjM7ZyYmMDx6P3U9ITA6Yi5HQkNFbmFibGVkJiYKbigyLHkpJiYwPHomJih3PSEwKX1pZih0fHwhdSYmIXcpYi5HQkNFbmFibGVkPyh1PXFiKGYmNyxxLCEwKSxxPXVhKDAsdSksdD11YSgxLHUpLHU9dWEoMix1KSxjYShrLGEsMCxxKSxjYShrLGEsMSx0KSxjYShrLGEsMix1KSk6KHQ9ci5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVPbmUsbig0LGYpJiYodD1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bykscT1wYihxLHQpLGNhKGssYSwwLChxJjE2NzExNjgwKT4+MTYpLGNhKGssYSwxLChxJjY1MjgwKT4+OCksY2EoayxhLDIscSYyNTUpKX19fX19ZnVuY3Rpb24gY2EoYSxjLGIsZCl7ZVtjYiszKigxNjAqYythKStiXT1kfWZ1bmN0aW9uIFgoYSxjKXtyZXR1cm4gZVthLWgudmlkZW9SYW1Mb2NhdGlvbisyMDQ4KzgxOTIqKGMmMSldfWZ1bmN0aW9uIFFiKGEpe3ZhciBjPWgudmlkZW9SYW1Mb2NhdGlvbjtyZXR1cm4gYTxjfHxhPj1jJiZhPGguY2FydHJpZGdlUmFtTG9jYXRpb24/LTE6YT49aC5lY2hvUmFtTG9jYXRpb24mJgphPGguc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uP3goYS04MTkyKTphPj1oLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbiYmYTw9aC5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQ/Mj52LmN1cnJlbnRMY2RNb2RlPzI1NTotMTphPT09Yi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoPyhhPTI1NSxjPXgoYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoKSxuKDAsYyl8fChhPUgoMCxhKSksYi5HQkNEb3VibGVTcGVlZHx8KGE9SCg3LGEpKSxhKTphPT09ci5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXI/KGcoYSxyLnNjYW5saW5lUmVnaXN0ZXIpLHIuc2NhbmxpbmVSZWdpc3Rlcik6NjUyOTY8PWEmJjY1MzE4Pj1hPyh0YigpLGE9YT09PWwubWVtb3J5TG9jYXRpb25OUjUyP3gobC5tZW1vcnlMb2NhdGlvbk5SNTIpJjEyOHwxMTI6LTEsYSk6NjUzMjg8PWEmJjY1MzQzPj1hPyh0YigpLC0xKTphPT09cS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3Rlcj8KKGM9RShxLmRpdmlkZXJSZWdpc3RlciksZyhhLGMpLGMpOmE9PT1xLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyPyhnKGEscS50aW1lckNvdW50ZXIpLHEudGltZXJDb3VudGVyKTphPT09bS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3Q/MjI0fG0uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlOmE9PT1DLm1lbW9yeUxvY2F0aW9uSm95cGFkUmVnaXN0ZXI/KGE9Qy5qb3lwYWRSZWdpc3RlckZsaXBwZWQsQy5pc0RwYWRUeXBlPyhhPUMudXA/SCgyLGEpOmF8NCxhPUMucmlnaHQ/SCgwLGEpOmF8MSxhPUMuZG93bj9IKDMsYSk6YXw4LGE9Qy5sZWZ0P0goMSxhKTphfDIpOkMuaXNCdXR0b25UeXBlJiYoYT1DLmE/SCgwLGEpOmF8MSxhPUMuYj9IKDEsYSk6YXwyLGE9Qy5zZWxlY3Q/SCgyLGEpOmF8NCxhPUMuc3RhcnQ/SCgzLGEpOmF8OCksYXwyNDApOi0xfWZ1bmN0aW9uIHgoYSl7cmV0dXJuIGVbTmIoYSldfWZ1bmN0aW9uIExiKGEpe2E9PT1hYS5yZWFkR2JNZW1vcnkmJihhYS5yZWFjaGVkQnJlYWtwb2ludD0KITApO3ZhciBjPVFiKGEpO3JldHVybi0xPT09Yz94KGEpOmN9ZnVuY3Rpb24gUShhKXtyZXR1cm4gMDxlW2FdfWZ1bmN0aW9uIEphKGEpe3ZhciBjPWIucmVnaXN0ZXJBO1MoYyxhKTtDYihjLGEpO2M9YythJjI1NTtiLnJlZ2lzdGVyQT1jO3QoMD09PWMpO3UoMCl9ZnVuY3Rpb24gS2EoYSl7dmFyIGM9Yi5yZWdpc3RlckEsZD1jK2ErVSgpJjI1NTtHKDAhPSgoY15hXmQpJjE2KSk7YT1jK2ErVSgpJjY1NTM1O0soMDwoYSYyNTYpKTtiLnJlZ2lzdGVyQT1kO3QoMD09PWQpO3UoMCl9ZnVuY3Rpb24gTGEoYSl7dmFyIGM9LTEqYTt2YXIgZD1iLnJlZ2lzdGVyQTtTKGQsYyk7Q2IoZCxjKTtkPWQtYSYyNTU7Yi5yZWdpc3RlckE9ZDt0KDA9PT1kKTt1KDEpfWZ1bmN0aW9uIE1hKGEpe3ZhciBjPWIucmVnaXN0ZXJBLGQ9Yy1hLVUoKSYyNTU7RygwIT0oKGNeYV5kKSYxNikpO2E9Yy1hLVUoKSY2NTUzNTtLKDA8KGEmMjU2KSk7Yi5yZWdpc3RlckE9ZDt0KDA9PT1kKTt1KDEpfWZ1bmN0aW9uIE5hKGEpe2EmPQpiLnJlZ2lzdGVyQTtiLnJlZ2lzdGVyQT1hO3QoMD09PWEpO3UoMCk7RygxKTtLKDApfWZ1bmN0aW9uIE9hKGEpe2E9KGIucmVnaXN0ZXJBXmEpJjI1NTtiLnJlZ2lzdGVyQT1hO3QoMD09PWEpO3UoMCk7RygwKTtLKDApfWZ1bmN0aW9uIFBhKGEpe2F8PWIucmVnaXN0ZXJBO2IucmVnaXN0ZXJBPWE7dCgwPT09YSk7dSgwKTtHKDApO0soMCl9ZnVuY3Rpb24gUWEoYSl7dmFyIGM9Yi5yZWdpc3RlckE7YSo9LTE7UyhjLGEpO0NiKGMsYSk7dCgwPT09YythKTt1KDEpfWZ1bmN0aW9uIFVhKGEsYyl7dCgwPT09KGMmMTw8YSkpO3UoMCk7RygxKTtyZXR1cm4gY31mdW5jdGlvbiBiYShhLGMsYil7cmV0dXJuIDA8Yz9ifDE8PGE6YiZ+KDE8PGEpfWZ1bmN0aW9uIGliKGEpe3ZhciBjPWIucHJvZ3JhbUNvdW50ZXI7Yz0oYysoYTw8MjQ+PjI0KSY2NTUzNSkrMSY2NTUzNTtiLnByb2dyYW1Db3VudGVyPWN9ZnVuY3Rpb24gb2MoYSl7dmFyIGM9Yi5wcm9ncmFtQ291bnRlcjtjPWMrMSY2NTUzNTsKYi5pc0hhbHRCdWcmJihjPWMtMSY2NTUzNSk7Yi5wcm9ncmFtQ291bnRlcj1jO3N3aXRjaCgoYSYyNDApPj40KXtjYXNlIDA6cmV0dXJuIENjKGEpO2Nhc2UgMTpyZXR1cm4gRGMoYSk7Y2FzZSAyOnJldHVybiBFYyhhKTtjYXNlIDM6cmV0dXJuIEZjKGEpO2Nhc2UgNDpyZXR1cm4gR2MoYSk7Y2FzZSA1OnJldHVybiBIYyhhKTtjYXNlIDY6cmV0dXJuIEljKGEpO2Nhc2UgNzpyZXR1cm4gSmMoYSk7Y2FzZSA4OnJldHVybiBLYyhhKTtjYXNlIDk6cmV0dXJuIExjKGEpO2Nhc2UgMTA6cmV0dXJuIE1jKGEpO2Nhc2UgMTE6cmV0dXJuIE5jKGEpO2Nhc2UgMTI6cmV0dXJuIE9jKGEpO2Nhc2UgMTM6cmV0dXJuIFBjKGEpO2Nhc2UgMTQ6cmV0dXJuIFFjKGEpO2RlZmF1bHQ6cmV0dXJuIFJjKGEpfX1mdW5jdGlvbiBJKGEpe1JhKDQpO3JldHVybiBMYihhKX1mdW5jdGlvbiBUKGEsYyl7UmEoNCk7amMoYSxjKX1mdW5jdGlvbiBIYShhKXtSYSg4KTt2YXIgYz1RYihhKTtjPS0xPT09Yz94KGEpOgpjO2ErPTE7dmFyIGI9UWIoYSk7YT0tMT09PWI/eChhKTpiO3JldHVybiBwKGEsYyl9ZnVuY3Rpb24gVihhLGMpe1JhKDgpO3ZhciBiPUUoYyk7YyY9MjU1O01iKGEsYykmJmcoYSxjKTthKz0xO01iKGEsYikmJmcoYSxiKX1mdW5jdGlvbiBGKCl7UmEoNCk7cmV0dXJuIHgoYi5wcm9ncmFtQ291bnRlcil9ZnVuY3Rpb24gWSgpe1JhKDQpO3ZhciBhPXgoYi5wcm9ncmFtQ291bnRlcisxJjY1NTM1KTtyZXR1cm4gcChhLEYoKSl9ZnVuY3Rpb24gQ2MoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gNDtjYXNlIDE6cmV0dXJuIGE9WSgpLGIucmVnaXN0ZXJCPUUoYSksYi5yZWdpc3RlckM9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDI6cmV0dXJuIFQocChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYi5yZWdpc3RlckEpLDQ7Y2FzZSAzOnJldHVybiBhPXAoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpLGErKyxiLnJlZ2lzdGVyQj1FKGEpLApiLnJlZ2lzdGVyQz1hJjI1NSw4O2Nhc2UgNDpyZXR1cm4gYT1iLnJlZ2lzdGVyQixTKGEsMSksYT1hKzEmMjU1LGIucmVnaXN0ZXJCPWEsdCgwPT09YSksdSgwKSw0O2Nhc2UgNTpyZXR1cm4gYT1iLnJlZ2lzdGVyQixTKGEsLTEpLGE9YS0xJjI1NSxiLnJlZ2lzdGVyQj1hLHQoMD09PWEpLHUoMSksNDtjYXNlIDY6cmV0dXJuIGIucmVnaXN0ZXJCPUYoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNzpyZXR1cm4gYT1iLnJlZ2lzdGVyQSxLKDEyOD09PShhJjEyOCkpLGIucmVnaXN0ZXJBPShhPDwxfGE+PjcpJjI1NSx0KDApLHUoMCksRygwKSw0O2Nhc2UgODpyZXR1cm4gVihZKCksYi5zdGFja1BvaW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSA5OmE9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9cChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyk7V2EoYSxjLCExKTthPWErYyYKNjU1MzU7Yi5yZWdpc3Rlckg9RShhKTtiLnJlZ2lzdGVyTD1hJjI1NTt1KDApO3JldHVybiA4O2Nhc2UgMTA6cmV0dXJuIGIucmVnaXN0ZXJBPUkocChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDQ7Y2FzZSAxMTpyZXR1cm4gYT1wKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyQj1FKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSAxMjpyZXR1cm4gYT1iLnJlZ2lzdGVyQyxTKGEsMSksYT1hKzEmMjU1LGIucmVnaXN0ZXJDPWEsdCgwPT09YSksdSgwKSw0O2Nhc2UgMTM6cmV0dXJuIGE9Yi5yZWdpc3RlckMsUyhhLC0xKSxhPWEtMSYyNTUsYi5yZWdpc3RlckM9YSx0KDA9PT1hKSx1KDEpLDQ7Y2FzZSAxNDpyZXR1cm4gYi5yZWdpc3RlckM9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAxNTpyZXR1cm4gYT1iLnJlZ2lzdGVyQSxLKDA8KGEmMSkpLGIucmVnaXN0ZXJBPShhPj4xfGE8PDcpJjI1NSwKdCgwKSx1KDApLEcoMCksNH1yZXR1cm4tMX1mdW5jdGlvbiBEYyhhKXtzd2l0Y2goYSl7Y2FzZSAxNjppZihiLkdCQ0VuYWJsZWQmJihhPUkoYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoKSxuKDAsYSkpKXJldHVybiBhPUgoMCxhKSxuKDcsYSk/KGIuR0JDRG91YmxlU3BlZWQ9ITEsYT1IKDcsYSkpOihiLkdCQ0RvdWJsZVNwZWVkPSEwLGF8PTEyOCksVChiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gsYSksNjg7Yi5pc1N0b3BwZWQ9ITA7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7cmV0dXJuIDQ7Y2FzZSAxNzpyZXR1cm4gYT1ZKCksYi5yZWdpc3RlckQ9RShhKSxiLnJlZ2lzdGVyRT1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMTg6cmV0dXJuIFQocChiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSksYi5yZWdpc3RlckEpLDQ7Y2FzZSAxOTpyZXR1cm4gYT1wKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSwKYT1hKzEmNjU1MzUsYi5yZWdpc3RlckQ9RShhKSxiLnJlZ2lzdGVyRT1hJjI1NSw4O2Nhc2UgMjA6cmV0dXJuIGE9Yi5yZWdpc3RlckQsUyhhLDEpLGIucmVnaXN0ZXJEPWErMSYyNTUsdCgwPT09Yi5yZWdpc3RlckQpLHUoMCksNDtjYXNlIDIxOnJldHVybiBhPWIucmVnaXN0ZXJELFMoYSwtMSksYi5yZWdpc3RlckQ9YS0xJjI1NSx0KDA9PT1iLnJlZ2lzdGVyRCksdSgxKSw0O2Nhc2UgMjI6cmV0dXJuIGIucmVnaXN0ZXJEPUYoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjM6cmV0dXJuIGE9MTI4PT09KGIucmVnaXN0ZXJBJjEyOCksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPDwxfFUoKSkmMjU1LEsoYSksdCgwKSx1KDApLEcoMCksNDtjYXNlIDI0OnJldHVybiBpYihGKCkpLDg7Y2FzZSAyNTphPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpO3ZhciBjPXAoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpO1dhKGEsYywhMSk7YT1hK2MmCjY1NTM1O2IucmVnaXN0ZXJIPUUoYSk7Yi5yZWdpc3Rlckw9YSYyNTU7dSgwKTtyZXR1cm4gODtjYXNlIDI2OnJldHVybiBhPXAoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGIucmVnaXN0ZXJBPUkoYSksNDtjYXNlIDI3OnJldHVybiBhPXAoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJEPUUoYSksYi5yZWdpc3RlckU9YSYyNTUsODtjYXNlIDI4OnJldHVybiBhPWIucmVnaXN0ZXJFLFMoYSwxKSxhPWErMSYyNTUsYi5yZWdpc3RlckU9YSx0KDA9PT1hKSx1KDApLDQ7Y2FzZSAyOTpyZXR1cm4gYT1iLnJlZ2lzdGVyRSxTKGEsLTEpLGE9YS0xJjI1NSxiLnJlZ2lzdGVyRT1hLHQoMD09PWEpLHUoMSksNDtjYXNlIDMwOnJldHVybiBiLnJlZ2lzdGVyRT1GKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDMxOnJldHVybiBhPTE9PT0oYi5yZWdpc3RlckEmMSksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPj4KMXxVKCk8PDcpJjI1NSxLKGEpLHQoMCksdSgwKSxHKDApLDR9cmV0dXJuLTF9ZnVuY3Rpb24gRWMoYSl7c3dpdGNoKGEpe2Nhc2UgMzI6cmV0dXJuIDA9PT1TYSgpP2liKEYoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDMzOnJldHVybiBhPVkoKSxiLnJlZ2lzdGVySD1FKGEpLGIucmVnaXN0ZXJMPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAzNDpyZXR1cm4gYT1wKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxUKGEsYi5yZWdpc3RlckEpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUUoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDM1OnJldHVybiBhPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUUoYSksYi5yZWdpc3Rlckw9YSYyNTUsODtjYXNlIDM2OnJldHVybiBhPWIucmVnaXN0ZXJILFMoYSwxKSxhPWErMSYyNTUsYi5yZWdpc3Rlckg9CmEsdCgwPT09YSksdSgwKSw0O2Nhc2UgMzc6cmV0dXJuIGE9Yi5yZWdpc3RlckgsUyhhLC0xKSxhPWEtMSYyNTUsYi5yZWdpc3Rlckg9YSx0KDA9PT1hKSx1KDEpLDQ7Y2FzZSAzODpyZXR1cm4gYi5yZWdpc3Rlckg9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAzOTphPTA7MDwoYi5yZWdpc3RlckY+PjUmMSkmJihhfD02KTswPFUoKSYmKGF8PTk2KTt2YXIgYz1iLnJlZ2lzdGVyQTswPChiLnJlZ2lzdGVyRj4+NiYxKT9jPWMtYSYyNTU6KDk8KGMmMTUpJiYoYXw9NiksMTUzPGMmJihhfD05NiksYz1jK2EmMjU1KTt0KDA9PT1jKTtLKDAhPT0oYSY5NikpO0coMCk7Yi5yZWdpc3RlckE9YztyZXR1cm4gNDtjYXNlIDQwOnJldHVybiAwPFNhKCk/aWIoRigpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgNDE6cmV0dXJuIGE9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksV2EoYSxhLCExKSxhPQoyKmEmNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSx1KDApLDg7Y2FzZSA0MjpyZXR1cm4gYT1wKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQT1JKGEpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUUoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDQzOnJldHVybiBhPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJIPUUoYSksYi5yZWdpc3Rlckw9YSYyNTUsODtjYXNlIDQ0OnJldHVybiBhPWIucmVnaXN0ZXJMLFMoYSwxKSxhPWErMSYyNTUsYi5yZWdpc3Rlckw9YSx0KDA9PT1hKSx1KDApLDQ7Y2FzZSA0NTpyZXR1cm4gYT1iLnJlZ2lzdGVyTCxTKGEsLTEpLGE9YS0xJjI1NSxiLnJlZ2lzdGVyTD1hLHQoMD09PWEpLHUoMSksNDtjYXNlIDQ2OnJldHVybiBiLnJlZ2lzdGVyTD1GKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDQ3OnJldHVybiBiLnJlZ2lzdGVyQT0KfmIucmVnaXN0ZXJBLHUoMSksRygxKSw0fXJldHVybi0xfWZ1bmN0aW9uIEZjKGEpe3N3aXRjaChhKXtjYXNlIDQ4OnJldHVybiAwPT09VSgpP2liKEYoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDQ5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1ZKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDUwOnJldHVybiBhPXAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLFQoYSxiLnJlZ2lzdGVyQSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNTE6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzEmNjU1MzUsODtjYXNlIDUyOmE9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9SShhKTtTKGMsMSk7Yz1jKzEmMjU1O3QoMD09PWMpO3UoMCk7VChhLGMpO3JldHVybiA0O2Nhc2UgNTM6cmV0dXJuIGE9cChiLnJlZ2lzdGVySCwKYi5yZWdpc3RlckwpLGM9SShhKSxTKGMsLTEpLGM9Yy0xJjI1NSx0KDA9PT1jKSx1KDEpLFQoYSxjKSw0O2Nhc2UgNTQ6cmV0dXJuIFQocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNTU6cmV0dXJuIHUoMCksRygwKSxLKDEpLDQ7Y2FzZSA1NjpyZXR1cm4gMT09PVUoKT9pYihGKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSA1NzpyZXR1cm4gYT1wKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxXYShhLGIuc3RhY2tQb2ludGVyLCExKSxhPWErYi5zdGFja1BvaW50ZXImNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSx1KDApLDg7Y2FzZSA1ODpyZXR1cm4gYT1wKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQT1JKGEpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJIPUUoYSksYi5yZWdpc3Rlckw9YSYyNTUsCjQ7Y2FzZSA1OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMSY2NTUzNSw4O2Nhc2UgNjA6cmV0dXJuIGE9Yi5yZWdpc3RlckEsUyhhLDEpLGE9YSsxJjI1NSxiLnJlZ2lzdGVyQT1hLHQoMD09PWEpLHUoMCksNDtjYXNlIDYxOnJldHVybiBhPWIucmVnaXN0ZXJBLFMoYSwtMSksYT1hLTEmMjU1LGIucmVnaXN0ZXJBPWEsdCgwPT09YSksdSgxKSw0O2Nhc2UgNjI6cmV0dXJuIGIucmVnaXN0ZXJBPUYoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNjM6cmV0dXJuIHUoMCksRygwKSxLKDA+PVUoKSksNH1yZXR1cm4tMX1mdW5jdGlvbiBHYyhhKXtzd2l0Y2goYSl7Y2FzZSA2NDpyZXR1cm4gNDtjYXNlIDY1OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQyw0O2Nhc2UgNjY6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJELDQ7Y2FzZSA2NzpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckUsNDtjYXNlIDY4OnJldHVybiBiLnJlZ2lzdGVyQj0KYi5yZWdpc3RlckgsNDtjYXNlIDY5OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyTCw0O2Nhc2UgNzA6cmV0dXJuIGIucmVnaXN0ZXJCPUkocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA3MTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckEsNDtjYXNlIDcyOnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQiw0O2Nhc2UgNzM6cmV0dXJuIDQ7Y2FzZSA3NDpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckQsNDtjYXNlIDc1OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyRSw0O2Nhc2UgNzY6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJILDQ7Y2FzZSA3NzpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckwsNDtjYXNlIDc4OnJldHVybiBiLnJlZ2lzdGVyQz1JKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgNzk6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSGMoYSl7c3dpdGNoKGEpe2Nhc2UgODA6cmV0dXJuIGIucmVnaXN0ZXJEPQpiLnJlZ2lzdGVyQiw0O2Nhc2UgODE6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJDLDQ7Y2FzZSA4MjpyZXR1cm4gNDtjYXNlIDgzOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyRSw0O2Nhc2UgODQ6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJILDQ7Y2FzZSA4NTpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckwsNDtjYXNlIDg2OnJldHVybiBiLnJlZ2lzdGVyRD1JKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgODc6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJBLDQ7Y2FzZSA4ODpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckIsNDtjYXNlIDg5OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQyw0O2Nhc2UgOTA6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJELDQ7Y2FzZSA5MTpyZXR1cm4gNDtjYXNlIDkyOnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVySCw0O2Nhc2UgOTM6cmV0dXJuIGIucmVnaXN0ZXJFPQpiLnJlZ2lzdGVyTCw0O2Nhc2UgOTQ6cmV0dXJuIGIucmVnaXN0ZXJFPUkocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA5NTpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckEsNH1yZXR1cm4tMX1mdW5jdGlvbiBJYyhhKXtzd2l0Y2goYSl7Y2FzZSA5NjpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckIsNDtjYXNlIDk3OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQyw0O2Nhc2UgOTg6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJELDQ7Y2FzZSA5OTpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckUsNDtjYXNlIDEwMDpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckgsNDtjYXNlIDEwMTpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckwsNDtjYXNlIDEwMjpyZXR1cm4gYi5yZWdpc3Rlckg9SShwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDEwMzpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckEsNDtjYXNlIDEwNDpyZXR1cm4gYi5yZWdpc3Rlckw9CmIucmVnaXN0ZXJCLDQ7Y2FzZSAxMDU6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJDLDQ7Y2FzZSAxMDY6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJELDQ7Y2FzZSAxMDc6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMDg6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJILDQ7Y2FzZSAxMDk6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMTA6cmV0dXJuIGIucmVnaXN0ZXJMPUkocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSAxMTE6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSmMoYSl7c3dpdGNoKGEpe2Nhc2UgMTEyOnJldHVybiBUKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTEzOnJldHVybiBUKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTE0OnJldHVybiBUKHAoYi5yZWdpc3RlckgsCmIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyRCksNDtjYXNlIDExNTpyZXR1cm4gVChwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyRSksNDtjYXNlIDExNjpyZXR1cm4gVChwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVySCksNDtjYXNlIDExNzpyZXR1cm4gVChwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyTCksNDtjYXNlIDExODpyZXR1cm4gaC5pc0hibGFua0hkbWFBY3RpdmV8fGIuZW5hYmxlSGFsdCgpLDQ7Y2FzZSAxMTk6cmV0dXJuIFQocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckEpLDQ7Y2FzZSAxMjA6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJCLDQ7Y2FzZSAxMjE6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJDLDQ7Y2FzZSAxMjI6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJELDQ7Y2FzZSAxMjM6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMjQ6cmV0dXJuIGIucmVnaXN0ZXJBPQpiLnJlZ2lzdGVySCw0O2Nhc2UgMTI1OnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTI2OnJldHVybiBiLnJlZ2lzdGVyQT1JKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTI3OnJldHVybiA0fXJldHVybi0xfWZ1bmN0aW9uIEtjKGEpe3N3aXRjaChhKXtjYXNlIDEyODpyZXR1cm4gSmEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMjk6cmV0dXJuIEphKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTMwOnJldHVybiBKYShiLnJlZ2lzdGVyRCksNDtjYXNlIDEzMTpyZXR1cm4gSmEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxMzI6cmV0dXJuIEphKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTMzOnJldHVybiBKYShiLnJlZ2lzdGVyTCksNDtjYXNlIDEzNDpyZXR1cm4gYT1JKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxKYShhKSw0O2Nhc2UgMTM1OnJldHVybiBKYShiLnJlZ2lzdGVyQSksNDtjYXNlIDEzNjpyZXR1cm4gS2EoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMzc6cmV0dXJuIEthKGIucmVnaXN0ZXJDKSwKNDtjYXNlIDEzODpyZXR1cm4gS2EoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMzk6cmV0dXJuIEthKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTQwOnJldHVybiBLYShiLnJlZ2lzdGVySCksNDtjYXNlIDE0MTpyZXR1cm4gS2EoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNDI6cmV0dXJuIGE9SShwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksS2EoYSksNDtjYXNlIDE0MzpyZXR1cm4gS2EoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gTGMoYSl7c3dpdGNoKGEpe2Nhc2UgMTQ0OnJldHVybiBMYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE0NTpyZXR1cm4gTGEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNDY6cmV0dXJuIExhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTQ3OnJldHVybiBMYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE0ODpyZXR1cm4gTGEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNDk6cmV0dXJuIExhKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTUwOnJldHVybiBhPUkocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLApMYShhKSw0O2Nhc2UgMTUxOnJldHVybiBMYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE1MjpyZXR1cm4gTWEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNTM6cmV0dXJuIE1hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTU0OnJldHVybiBNYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE1NTpyZXR1cm4gTWEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNTY6cmV0dXJuIE1hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTU3OnJldHVybiBNYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE1ODpyZXR1cm4gYT1JKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxNYShhKSw0O2Nhc2UgMTU5OnJldHVybiBNYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBNYyhhKXtzd2l0Y2goYSl7Y2FzZSAxNjA6cmV0dXJuIE5hKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTYxOnJldHVybiBOYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE2MjpyZXR1cm4gTmEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNjM6cmV0dXJuIE5hKGIucmVnaXN0ZXJFKSwKNDtjYXNlIDE2NDpyZXR1cm4gTmEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNjU6cmV0dXJuIE5hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTY2OnJldHVybiBhPUkocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLE5hKGEpLDQ7Y2FzZSAxNjc6cmV0dXJuIE5hKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTY4OnJldHVybiBPYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE2OTpyZXR1cm4gT2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNzA6cmV0dXJuIE9hKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTcxOnJldHVybiBPYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE3MjpyZXR1cm4gT2EoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNzM6cmV0dXJuIE9hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTc0OnJldHVybiBhPUkocChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLE9hKGEpLDQ7Y2FzZSAxNzU6cmV0dXJuIE9hKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIE5jKGEpe3N3aXRjaChhKXtjYXNlIDE3NjpyZXR1cm4gUGEoYi5yZWdpc3RlckIpLAo0O2Nhc2UgMTc3OnJldHVybiBQYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE3ODpyZXR1cm4gUGEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNzk6cmV0dXJuIFBhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTgwOnJldHVybiBQYShiLnJlZ2lzdGVySCksNDtjYXNlIDE4MTpyZXR1cm4gUGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxODI6cmV0dXJuIGE9SShwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksUGEoYSksNDtjYXNlIDE4MzpyZXR1cm4gUGEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxODQ6cmV0dXJuIFFhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTg1OnJldHVybiBRYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE4NjpyZXR1cm4gUWEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxODc6cmV0dXJuIFFhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTg4OnJldHVybiBRYShiLnJlZ2lzdGVySCksNDtjYXNlIDE4OTpyZXR1cm4gUWEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxOTA6cmV0dXJuIGE9SShwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksClFhKGEpLDQ7Y2FzZSAxOTE6cmV0dXJuIFFhKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIE9jKGEpe3N3aXRjaChhKXtjYXNlIDE5MjpyZXR1cm4gMD09PVNhKCk/KGE9Yi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcj1IYShhKSxiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzUsMTIpOjg7Y2FzZSAxOTM6cmV0dXJuIGE9SGEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckI9RShhKSxiLnJlZ2lzdGVyQz1hJjI1NSw0O2Nhc2UgMTk0OmlmKDA9PT1TYSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDE5NTpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1ZKCksODtjYXNlIDE5NjppZigwPT09U2EoKSlyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLApiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMTk3OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEscChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDg7Y2FzZSAxOTg6cmV0dXJuIEphKEYoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDE5OTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MCw4O2Nhc2UgMjAwOnJldHVybiAxPT09U2EoKT8oYT1iLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyPUhhKGEpLGIuc3RhY2tQb2ludGVyPWErMiY2NTUzNSwxMik6ODtjYXNlIDIwMTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyPQpIYShhKSxiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzUsODtjYXNlIDIwMjppZigxPT09U2EoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMDM6dmFyIGM9RigpO2E9LTE7dmFyIGQ9ITEsZT0wLGY9MCxnPWMmNztzd2l0Y2goZyl7Y2FzZSAwOmU9Yi5yZWdpc3RlckI7YnJlYWs7Y2FzZSAxOmU9Yi5yZWdpc3RlckM7YnJlYWs7Y2FzZSAyOmU9Yi5yZWdpc3RlckQ7YnJlYWs7Y2FzZSAzOmU9Yi5yZWdpc3RlckU7YnJlYWs7Y2FzZSA0OmU9Yi5yZWdpc3Rlckg7YnJlYWs7Y2FzZSA1OmU9Yi5yZWdpc3Rlckw7YnJlYWs7Y2FzZSA2OmU9SShwKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSk7YnJlYWs7Y2FzZSA3OmU9Yi5yZWdpc3RlckF9dmFyIGg9KGMmMjQwKT4+NDtzd2l0Y2goaCl7Y2FzZSAwOjc+PWM/KGM9ZSxLKDEyOD09PShjJjEyOCkpLGM9KGM8PDF8Yz4+NykmMjU1LHQoMD09PQpjKSx1KDApLEcoMCksZj1jLGQ9ITApOjE1Pj1jJiYoYz1lLEsoMDwoYyYxKSksYz0oYz4+MXxjPDw3KSYyNTUsdCgwPT09YyksdSgwKSxHKDApLGY9YyxkPSEwKTticmVhaztjYXNlIDE6MjM+PWM/KGM9ZSxkPTEyOD09PShjJjEyOCksYz0oYzw8MXxVKCkpJjI1NSxLKGQpLHQoMD09PWMpLHUoMCksRygwKSxmPWMsZD0hMCk6MzE+PWMmJihjPWUsZD0xPT09KGMmMSksYz0oYz4+MXxVKCk8PDcpJjI1NSxLKGQpLHQoMD09PWMpLHUoMCksRygwKSxmPWMsZD0hMCk7YnJlYWs7Y2FzZSAyOjM5Pj1jPyhjPWUsZD0xMjg9PT0oYyYxMjgpLGM9Yzw8MSYyNTUsSyhkKSx0KDA9PT1jKSx1KDApLEcoMCksZj1jLGQ9ITApOjQ3Pj1jJiYoYz1lLGQ9MTI4PT09KGMmMTI4KSxlPTE9PT0oYyYxKSxjPWM+PjEmMjU1LGQmJihjfD0xMjgpLHQoMD09PWMpLHUoMCksRygwKSxLKGUpLGY9YyxkPSEwKTticmVhaztjYXNlIDM6NTU+PWM/KGM9ZSxjPSgoYyYxNSk8PDR8KGMmMjQwKT4+NCkmMjU1LHQoMD09PQpjKSx1KDApLEcoMCksSygwKSxmPWMsZD0hMCk6NjM+PWMmJihjPWUsZD0xPT09KGMmMSksYz1jPj4xJjI1NSx0KDA9PT1jKSx1KDApLEcoMCksSyhkKSxmPWMsZD0hMCk7YnJlYWs7Y2FzZSA0OjcxPj1jPyhmPVVhKDAsZSksZD0hMCk6Nzk+PWMmJihmPVVhKDEsZSksZD0hMCk7YnJlYWs7Y2FzZSA1Ojg3Pj1jPyhmPVVhKDIsZSksZD0hMCk6OTU+PWMmJihmPVVhKDMsZSksZD0hMCk7YnJlYWs7Y2FzZSA2OjEwMz49Yz8oZj1VYSg0LGUpLGQ9ITApOjExMT49YyYmKGY9VWEoNSxlKSxkPSEwKTticmVhaztjYXNlIDc6MTE5Pj1jPyhmPVVhKDYsZSksZD0hMCk6MTI3Pj1jJiYoZj1VYSg3LGUpLGQ9ITApO2JyZWFrO2Nhc2UgODoxMzU+PWM/KGY9YmEoMCwwLGUpLGQ9ITApOjE0Mz49YyYmKGY9YmEoMSwwLGUpLGQ9ITApO2JyZWFrO2Nhc2UgOToxNTE+PWM/KGY9YmEoMiwwLGUpLGQ9ITApOjE1OT49YyYmKGY9YmEoMywwLGUpLGQ9ITApO2JyZWFrO2Nhc2UgMTA6MTY3Pj1jPyhmPWJhKDQsCjAsZSksZD0hMCk6MTc1Pj1jJiYoZj1iYSg1LDAsZSksZD0hMCk7YnJlYWs7Y2FzZSAxMToxODM+PWM/KGY9YmEoNiwwLGUpLGQ9ITApOjE5MT49YyYmKGY9YmEoNywwLGUpLGQ9ITApO2JyZWFrO2Nhc2UgMTI6MTk5Pj1jPyhmPWJhKDAsMSxlKSxkPSEwKToyMDc+PWMmJihmPWJhKDEsMSxlKSxkPSEwKTticmVhaztjYXNlIDEzOjIxNT49Yz8oZj1iYSgyLDEsZSksZD0hMCk6MjIzPj1jJiYoZj1iYSgzLDEsZSksZD0hMCk7YnJlYWs7Y2FzZSAxNDoyMzE+PWM/KGY9YmEoNCwxLGUpLGQ9ITApOjIzOT49YyYmKGY9YmEoNSwxLGUpLGQ9ITApO2JyZWFrO2Nhc2UgMTU6MjQ3Pj1jPyhmPWJhKDYsMSxlKSxkPSEwKToyNTU+PWMmJihmPWJhKDcsMSxlKSxkPSEwKX1zd2l0Y2goZyl7Y2FzZSAwOmIucmVnaXN0ZXJCPWY7YnJlYWs7Y2FzZSAxOmIucmVnaXN0ZXJDPWY7YnJlYWs7Y2FzZSAyOmIucmVnaXN0ZXJEPWY7YnJlYWs7Y2FzZSAzOmIucmVnaXN0ZXJFPWY7YnJlYWs7Y2FzZSA0OmIucmVnaXN0ZXJIPQpmO2JyZWFrO2Nhc2UgNTpiLnJlZ2lzdGVyTD1mO2JyZWFrO2Nhc2UgNjooND5ofHw3PGgpJiZUKHAoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGYpO2JyZWFrO2Nhc2UgNzpiLnJlZ2lzdGVyQT1mfWQmJihhPTQpO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1O3JldHVybiBhO2Nhc2UgMjA0OmlmKDE9PT1TYSgpKXJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlcisyKSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIwNTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1ZKCksODtjYXNlIDIwNjpyZXR1cm4gS2EoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrCjEmNjU1MzUsNDtjYXNlIDIwNzpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9OH1yZXR1cm4tMX1mdW5jdGlvbiBQYyhhKXtzd2l0Y2goYSl7Y2FzZSAyMDg6cmV0dXJuIDA9PT1VKCk/KGE9Yi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcj1IYShhKSxiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzUsMTIpOjg7Y2FzZSAyMDk6YT1iLnN0YWNrUG9pbnRlcjt2YXIgYz1IYShhKTtiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzU7Yi5yZWdpc3RlckQ9RShjKTtiLnJlZ2lzdGVyRT1jJjI1NTtyZXR1cm4gNDtjYXNlIDIxMDppZigwPT09VSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIxMjppZigwPT09VSgpKXJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9CmEsVihhLGIucHJvZ3JhbUNvdW50ZXIrMiksYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMTM6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFYoYSxwKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSksODtjYXNlIDIxNDpyZXR1cm4gTGEoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjE1OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0xNiw4O2Nhc2UgMjE2OnJldHVybiAxPT09VSgpPyhhPWIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXI9SGEoYSksYi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1LDEyKTo4O2Nhc2UgMjE3OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXI9CkhhKGEpLHZiKCEwKSxiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzUsODtjYXNlIDIxODppZigxPT09VSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIyMDppZigxPT09VSgpKXJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIyMjpyZXR1cm4gTWEoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjIzOnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0yNCw4fXJldHVybi0xfWZ1bmN0aW9uIFFjKGEpe3N3aXRjaChhKXtjYXNlIDIyNDpyZXR1cm4gYT0KRigpLFQoNjUyODArYSxiLnJlZ2lzdGVyQSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIyNTphPWIuc3RhY2tQb2ludGVyO3ZhciBjPUhhKGEpO2Iuc3RhY2tQb2ludGVyPWErMiY2NTUzNTtiLnJlZ2lzdGVySD1FKGMpO2IucmVnaXN0ZXJMPWMmMjU1O3JldHVybiA0O2Nhc2UgMjI2OnJldHVybiBUKDY1MjgwK2IucmVnaXN0ZXJDLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMjI5OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEscChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDg7Y2FzZSAyMzA6cmV0dXJuIE5hKEYoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzMTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MzIsODtjYXNlIDIzMjpyZXR1cm4gYT0KRigpPDwyND4+MjQsV2EoYi5zdGFja1BvaW50ZXIsYSwhMCksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrYSY2NTUzNSx0KDApLHUoMCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsMTI7Y2FzZSAyMzM6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9cChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksNDtjYXNlIDIzNDpyZXR1cm4gVChZKCksYi5yZWdpc3RlckEpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAyMzg6cmV0dXJuIE9hKEYoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzOTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9NDAsOH1yZXR1cm4tMX1mdW5jdGlvbiBSYyhhKXtzd2l0Y2goYSl7Y2FzZSAyNDA6cmV0dXJuIGE9RigpLGIucmVnaXN0ZXJBPQpJKDY1MjgwK2EpJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjQxOmE9Yi5zdGFja1BvaW50ZXI7dmFyIGM9SGEoYSk7Yi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1O2IucmVnaXN0ZXJBPUUoYyk7Yi5yZWdpc3RlckY9YyYyNTU7cmV0dXJuIDQ7Y2FzZSAyNDI6cmV0dXJuIGIucmVnaXN0ZXJBPUkoNjUyODArYi5yZWdpc3RlckMpJjI1NSw0O2Nhc2UgMjQzOnJldHVybiB2YighMSksNDtjYXNlIDI0NTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLHAoYi5yZWdpc3RlckEsYi5yZWdpc3RlckYpKSw4O2Nhc2UgMjQ2OnJldHVybiBQYShGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyNDc6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFYoYSxiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPQo0OCw4O2Nhc2UgMjQ4OnJldHVybiBjPUYoKTw8MjQ+PjI0LGE9Yi5zdGFja1BvaW50ZXIsdCgwKSx1KDApLFdhKGEsYywhMCksYT1hK2MmNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMjQ5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1wKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSw4O2Nhc2UgMjUwOnJldHVybiBiLnJlZ2lzdGVyQT1JKFkoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDI1MTpyZXR1cm4gdmIoITApLDQ7Y2FzZSAyNTQ6cmV0dXJuIFFhKEYoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDI1NTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9NTYsOH1yZXR1cm4tMX0KZnVuY3Rpb24gUmEoYSl7MDxoLkRNQUN5Y2xlcyYmKGErPWguRE1BQ3ljbGVzLGguRE1BQ3ljbGVzPTApO2IuY3VycmVudEN5Y2xlcys9YTtpZighYi5pc1N0b3BwZWQpe2lmKFIuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmcpe3IuY3VycmVudEN5Y2xlcys9YTtmb3IodmFyIGM9ci5iYXRjaFByb2Nlc3NDeWNsZXMoKTtyLmN1cnJlbnRDeWNsZXM+PWM7KW5jKGMpLHIuY3VycmVudEN5Y2xlcy09Y31lbHNlIG5jKGEpO1IuYXVkaW9CYXRjaFByb2Nlc3Npbmc/bC5jdXJyZW50Q3ljbGVzKz1hOmRjKGEpO2M9YTtpZihaLnRyYW5zZmVyU3RhcnRGbGFnKWZvcih2YXIgZD0wO2Q8Yzspe3ZhciBlPVouY3VycmVudEN5Y2xlcyxmPWU7ZCs9NDtmKz00OzY1NTM1PGYmJihmLT02NTUzNik7Wi5jdXJyZW50Q3ljbGVzPWY7dmFyIGs9Wi5pc0Nsb2NrU3BlZWRGYXN0PzI6NztuKGssZSkmJiFuKGssZikmJihlPVoubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckRhdGEsZj14KGUpLGY9KGY8PDEpKwoxLGYmPTI1NSxnKGUsZiksZT1aLm51bWJlck9mQml0c1RyYW5zZmVycmVkLDg9PT0rK2U/KFoubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQ9MCxtLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSEwLGJiKG0uYml0UG9zaXRpb25TZXJpYWxJbnRlcnJ1cHQpLGU9Wi5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyQ29udHJvbCxmPXgoZSksZyhlLEgoNyxmKSksWi50cmFuc2ZlclN0YXJ0RmxhZz0hMSk6Wi5udW1iZXJPZkJpdHNUcmFuc2ZlcnJlZD1lKX19Ui50aW1lcnNCYXRjaFByb2Nlc3Npbmc/KHEuY3VycmVudEN5Y2xlcys9YSxJYihxLmN1cnJlbnRDeWNsZXMpLHEuY3VycmVudEN5Y2xlcz0wKTpJYihhKTtjPWRhLmN5Y2xlcztjKz1hO2M+PWRhLmN5Y2xlc1BlckN5Y2xlU2V0JiYoZGEuY3ljbGVTZXRzKz0xLGMtPWRhLmN5Y2xlc1BlckN5Y2xlU2V0KTtkYS5jeWNsZXM9Y31mdW5jdGlvbiBwYygpe3JldHVybiBSYighMCwtMSl9ZnVuY3Rpb24gUmIoYSxjKXt2b2lkIDA9PT0KYyYmKGM9LTEpO2E9MTAyNDswPGM/YT1jOjA+YyYmKGE9LTEpO2Zvcih2YXIgZD0hMSxlPSExLGY9ITE7IShkfHxlfHxmfHxhYS5yZWFjaGVkQnJlYWtwb2ludCk7KWM9cWMoKSwwPmM/ZD0hMDpiLmN1cnJlbnRDeWNsZXM+PWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKT9lPSEwOi0xPGEmJmVjKCk+PWEmJihmPSEwKTtpZihlKXJldHVybiBiLmN1cnJlbnRDeWNsZXMtPWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKSxXLlJFU1BPTlNFX0NPTkRJVElPTl9GUkFNRTtpZihmKXJldHVybiBXLlJFU1BPTlNFX0NPTkRJVElPTl9BVURJTztpZihhYS5yZWFjaGVkQnJlYWtwb2ludClyZXR1cm4gYWEucmVhY2hlZEJyZWFrcG9pbnQ9ITEsVy5SRVNQT05TRV9DT05ESVRJT05fQlJFQUtQT0lOVDtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXItMSY2NTUzNTtyZXR1cm4tMX1mdW5jdGlvbiBxYygpe2piPSEwO2lmKGIuaXNIYWx0QnVnKXt2YXIgYT14KGIucHJvZ3JhbUNvdW50ZXIpO2E9Cm9jKGEpO1JhKGEpO2IuZXhpdEhhbHRBbmRTdG9wKCl9bS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheSYmKG0ubWFzdGVySW50ZXJydXB0U3dpdGNoPSEwLG0ubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9ITEpO2lmKDA8KG0uaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSZtLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSYzMSkpe2E9ITE7bS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2gmJiFiLmlzSGFsdE5vSnVtcCYmKG0uaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkJiZtLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPyhoYihtLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSxhPSEwKTptLmlzTGNkSW50ZXJydXB0RW5hYmxlZCYmbS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD8oaGIobS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCksYT0hMCk6bS5pc1RpbWVySW50ZXJydXB0RW5hYmxlZCYmbS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPyhoYihtLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQpLAphPSEwKTptLmlzU2VyaWFsSW50ZXJydXB0RW5hYmxlZCYmbS5pc1NlcmlhbEludGVycnVwdFJlcXVlc3RlZD8oaGIobS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCksYT0hMCk6bS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQmJm0uaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQmJihoYihtLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0KSxhPSEwKSk7dmFyIGM9MDthJiYoYz0yMCxiLmlzSGFsdGVkKCkmJihiLmV4aXRIYWx0QW5kU3RvcCgpLGMrPTQpKTtiLmlzSGFsdGVkKCkmJmIuZXhpdEhhbHRBbmRTdG9wKCk7YT1jfWVsc2UgYT0wOzA8YSYmUmEoYSk7YT00O2IuaXNIYWx0ZWQoKXx8Yi5pc1N0b3BwZWR8fChhPXgoYi5wcm9ncmFtQ291bnRlciksYT1vYyhhKSk7Yi5yZWdpc3RlckYmPTI0MDtpZigwPj1hKXJldHVybiBhO1JhKGEpO2M9Vy5zdGVwcztjKz0xO2M+PVcuc3RlcHNQZXJTdGVwU2V0JiYoVy5zdGVwU2V0cys9MSxjLT1XLnN0ZXBzUGVyU3RlcFNldCk7Vy5zdGVwcz0KYztiLnByb2dyYW1Db3VudGVyPT09YWEucHJvZ3JhbUNvdW50ZXImJihhYS5yZWFjaGVkQnJlYWtwb2ludD0hMCk7cmV0dXJuIGF9ZnVuY3Rpb24gU2MoYSl7Y29uc3QgYz0idW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKTtmb3IoO2EuZnBzVGltZVN0YW1wc1swXTxjLTFFMzspYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCk7YS5mcHNUaW1lU3RhbXBzLnB1c2goYyk7YS50aW1lU3RhbXBzVW50aWxSZWFkeS0tOzA+YS50aW1lU3RhbXBzVW50aWxSZWFkeSYmKGEudGltZVN0YW1wc1VudGlsUmVhZHk9MCk7cmV0dXJuIGN9ZnVuY3Rpb24gU2IoYSl7YS50aW1lU3RhbXBzVW50aWxSZWFkeT05MD49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU/MS4yNSpNYXRoLmZsb29yKGEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKToxMjB9ZnVuY3Rpb24gcmMoYSl7Y29uc3QgYz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTiwKYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OK2EuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkUpLmJ1ZmZlcjthLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShNKHt0eXBlOnkuVVBEQVRFRCxncmFwaGljc0ZyYW1lQnVmZmVyOmN9KSxbY10pfWZ1bmN0aW9uIHNjKGEpe3ZhciBjPSgidW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKSktYS5mcHNUaW1lU3RhbXBzW2EuZnBzVGltZVN0YW1wcy5sZW5ndGgtMV07Yz10Yy1jOzA+YyYmKGM9MCk7YS5zcGVlZCYmMDxhLnNwZWVkJiYoYy89YS5zcGVlZCk7YS51cGRhdGVJZD1zZXRUaW1lb3V0KCgpPT57dWMoYSl9LE1hdGguZmxvb3IoYykpfWZ1bmN0aW9uIHVjKGEsYyl7aWYoYS5wYXVzZWQpcmV0dXJuITA7dm9pZCAwIT09YyYmKHRjPWMpO2tiPWEuZ2V0RlBTKCk7eWI9YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUrMTthLnNwZWVkJiYwPGEuc3BlZWQmJgooeWIqPWEuc3BlZWQpO2lmKGtiPnliKXJldHVybiBhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKSxzYyhhKSwhMDtTYyhhKTtjb25zdCBiPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoKGMpPT57bGV0IGQ7Yj9UYihhLGMpOihkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksYyhkKSl9KSkudGhlbigoYyk9PntpZigwPD1jKXtlYShNKHt0eXBlOnkuVVBEQVRFRCxmcHM6a2J9KSk7bGV0IGI9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2I9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2J8fHJjKGEpO2NvbnN0IGQ9e3R5cGU6eS5VUERBVEVEfTtkW3ouQ0FSVFJJREdFX1JBTV09WGIoYSkuYnVmZmVyO2Rbei5HQU1FQk9ZX01FTU9SWV09CmEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2Rbei5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7ZFt6LklOVEVSTkFMX1NUQVRFXT1ZYihhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTShkKSxbZFt6LkNBUlRSSURHRV9SQU1dLGRbei5HQU1FQk9ZX01FTU9SWV0sZFt6LlBBTEVUVEVfTUVNT1JZXSxkW3ouSU5URVJOQUxfU1RBVEVdXSk7CjI9PT1jP2VhKE0oe3R5cGU6eS5CUkVBS1BPSU5UfSkpOnNjKGEpfWVsc2UgZWEoTSh7dHlwZTp5LkNSQVNIRUR9KSksYS5wYXVzZWQ9ITB9KX1mdW5jdGlvbiBUYihhLGMpe3ZhciBiPS0xO2I9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvKDEwMjQpOzEhPT1iJiZjKGIpO2lmKDE9PT1iKXtiPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0TnVtYmVyT2ZTYW1wbGVzSW5BdWRpb0J1ZmZlcigpO2NvbnN0IGQ9a2I+PXliOy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmQ/KHZjKGEsYiksc2V0VGltZW91dCgoKT0+e1NiKGEpO1RiKGEsYyl9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKToodmMoYSxiKSxUYihhLGMpKX19ZnVuY3Rpb24gdmMoYSxjKXt2YXIgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04rMipjKS5idWZmZXI7Y29uc3QgZD17dHlwZTp5LlVQREFURUQsYXVkaW9CdWZmZXI6YixudW1iZXJPZlNhbXBsZXM6YyxmcHM6a2IsYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nOjYwPGEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlfTtiPVtiXTtpZihhLm9wdGlvbnMmJmEub3B0aW9ucy5lbmFibGVBdWRpb0RlYnVnZ2luZyl7dmFyIGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTisyKmMpLmJ1ZmZlcjtkLmNoYW5uZWwxQnVmZmVyPWU7Yi5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTisyKmMpLmJ1ZmZlcjtkLmNoYW5uZWwyQnVmZmVyPWU7Yi5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTiwKYS5XQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT04rMipjKS5idWZmZXI7ZC5jaGFubmVsM0J1ZmZlcj1lO2IucHVzaChlKTtjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT04rMipjKS5idWZmZXI7ZC5jaGFubmVsNEJ1ZmZlcj1jO2IucHVzaChjKX1hLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShNKGQpLGIpO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpfWNvbnN0IG1iPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY7bGV0IEJiO21ifHwoQmI9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtjb25zdCB5PXtDT05ORUNUOiJDT05ORUNUIixJTlNUQU5USUFURV9XQVNNOiJJTlNUQU5USUFURV9XQVNNIixDTEVBUl9NRU1PUlk6IkNMRUFSX01FTU9SWSIsQ0xFQVJfTUVNT1JZX0RPTkU6IkNMRUFSX01FTU9SWV9ET05FIiwKR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLFVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCIsRk9SQ0VfT1VUUFVUX0ZSQU1FOiJGT1JDRV9PVVRQVVRfRlJBTUUiLApTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSx6PXtCT09UX1JPTToiQk9PVF9ST00iLENBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTtsZXQgbmI9MDtjb25zdCBlPW5ldyBVaW50OENsYW1wZWRBcnJheSg5MTA5NTA0KSxsYj17c2l6ZTooKT0+OTEwOTUwNCxncm93OigpPT57fSx3YXNtQnl0ZU1lbW9yeTplfTt2YXIgVGM9NjU1MzYsWWE9Njc1ODQsWmE9WWErMTI4LGNiPVphKzIzNTUyLHpiPWNiKzkzMTg0LFViPXpiKzE5NjYwOCxBYj1VYisxNDc0NTYsVWM9WWEsVmM9QWItWWErMTUzNjAsRWI9QWIrMTUzNjAsRmI9RWIrMTMxMDcyLEdiPUZiKzEzMTA3MixIYj1HYisKMTMxMDcyLHViPUhiKzEzMTA3MixPYj11YisxMzEwNzIsd2I9T2IrMTMxMDcyLHhiPXdiKzI1NjAsVmI9eGIrODI1ODU2MCx3Yz1WYis2NTUzNSsxLFdiPU1hdGguY2VpbCh3Yy8xMDI0LzY0KSsxLFI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuZW5hYmxlQm9vdFJvbT0hMTthLnVzZUdiY1doZW5BdmFpbGFibGU9ITA7YS5hdWRpb0JhdGNoUHJvY2Vzc2luZz0hMTthLmdyYXBoaWNzQmF0Y2hQcm9jZXNzaW5nPSExO2EudGltZXJzQmF0Y2hQcm9jZXNzaW5nPSExO2EuZ3JhcGhpY3NEaXNhYmxlU2NhbmxpbmVSZW5kZXJpbmc9ITE7YS5hdWRpb0FjY3VtdWxhdGVTYW1wbGVzPSExO2EudGlsZVJlbmRlcmluZz0hMTthLnRpbGVDYWNoaW5nPSExO2EuZW5hYmxlQXVkaW9EZWJ1Z2dpbmc9ITE7cmV0dXJuIGF9KCksTD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE1OTIxOTA2O2EuYmdMaWdodEdyZXk9MTA1MjY4ODA7YS5iZ0RhcmtHcmV5PTU3ODk3ODQ7YS5iZ0JsYWNrPQo1MjYzNDQ7YS5vYmowV2hpdGU9MTU5MjE5MDY7YS5vYmowTGlnaHRHcmV5PTEwNTI2ODgwO2Eub2JqMERhcmtHcmV5PTU3ODk3ODQ7YS5vYmowQmxhY2s9NTI2MzQ0O2Eub2JqMVdoaXRlPTE1OTIxOTA2O2Eub2JqMUxpZ2h0R3JleT0xMDUyNjg4MDthLm9iajFEYXJrR3JleT01Nzg5Nzg0O2Eub2JqMUJsYWNrPTUyNjM0NDtyZXR1cm4gYX0oKSxsYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9NTQzOTIzMjthLmJnRGFya0dyZXk9MTY3Mjg1NzY7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTU0MzkyMzI7YS5vYmowRGFya0dyZXk9MTY3Mjg1NzY7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9NTQzOTIzMjthLm9iajFEYXJrR3JleT0xNjcyODU3NjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHBhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe30KYS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9MTY3NzY5NjA7YS5iZ0RhcmtHcmV5PTE2NzExNjgwO2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc3Njk2MDthLm9iajBEYXJrR3JleT0xNjcxMTY4MDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc3Njk2MDthLm9iajFEYXJrR3JleT0xNjcxMTY4MDthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLGlhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xNjc1NjA2NzthLmJnRGFya0dyZXk9ODY2MzI5NjthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NTYwNjc7YS5vYmowRGFya0dyZXk9ODY2MzI5NjthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc1NjA2NzthLm9iajFEYXJrR3JleT0KODY2MzI5NjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLG5hPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MDthLmJnTGlnaHRHcmV5PTMzOTI0O2EuYmdEYXJrR3JleT0xNjc2ODUxMjthLmJnQmxhY2s9MTY3NzcyMTU7YS5vYmowV2hpdGU9MDthLm9iajBMaWdodEdyZXk9MzM5MjQ7YS5vYmowRGFya0dyZXk9MTY3Njg1MTI7YS5vYmowQmxhY2s9MTY3NzcyMTU7YS5vYmoxV2hpdGU9MDthLm9iajFMaWdodEdyZXk9MzM5MjQ7YS5vYmoxRGFya0dyZXk9MTY3Njg1MTI7YS5vYmoxQmxhY2s9MTY3NzcyMTU7cmV0dXJuIGF9KCksdGE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTEwODU1ODQ1O2EuYmdEYXJrR3JleT01Mzk1MDI2O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xMDg1NTg0NTthLm9iajBEYXJrR3JleT01Mzk1MDI2O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9CjE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xMDg1NTg0NTthLm9iajFEYXJrR3JleT01Mzk1MDI2O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksb2E9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzEyNTthLmJnTGlnaHRHcmV5PTE2NzQ5NzE2O2EuYmdEYXJrR3JleT05NzM3NDcxO2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MTI1O2Eub2JqMExpZ2h0R3JleT0xNjc0OTcxNjthLm9iajBEYXJrR3JleT05NzM3NDcxO2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcxMjU7YS5vYmoxTGlnaHRHcmV5PTE2NzQ5NzE2O2Eub2JqMURhcmtHcmV5PTk3Mzc0NzE7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxrYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2NzcwNzU3O2EuYmdMaWdodEdyZXk9MTM1NDA0ODQ7YS5iZ0RhcmtHcmV5PTg2NzgxODU7YS5iZ0JsYWNrPTU5MTA3OTI7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PQoxNjc1NjA2NzthLm9iajBEYXJrR3JleT04NjYzMjk2O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTE2NzU2MDY3O2Eub2JqMURhcmtHcmV5PTg2NjMyOTY7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxtYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9ODEyNjI1NzthLmJnRGFya0dyZXk9MjU1NDE7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzQ1NjA0O2Eub2JqMERhcmtHcmV5PTk3MTQyMzQ7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9MTY3NDU2MDQ7YS5vYmoxRGFya0dyZXk9OTcxNDIzNDthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHNhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT05MjExMTAyO2EuYmdEYXJrR3JleT0KNTM5NTA4NDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NDU2MDQ7YS5vYmowRGFya0dyZXk9OTcxNDIzNDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc1NjA2NzthLm9iajFEYXJrR3JleT04NjYzMjk2O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksamE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTE2NzQ1NjA0O2EuYmdEYXJrR3JleT05NzE0MjM0O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT04MTI2MjU3O2Eub2JqMERhcmtHcmV5PTMzNzkyO2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTY1MzA1NTk7YS5vYmoxRGFya0dyZXk9MjU1O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCkscmE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0KMTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT02NTMwNTU5O2EuYmdEYXJrR3JleT0yNTU7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzQ1NjA0O2Eub2JqMERhcmtHcmV5PTk3MTQyMzQ7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9ODEyNjI1NzthLm9iajFEYXJrR3JleT0zMzc5MjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHFhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xNjc3Njk2MDthLmJnRGFya0dyZXk9ODA3OTg3MjthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9NjUzMDU1OTthLm9iajBEYXJrR3JleT0yNTU7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9ODEyNjI1NzthLm9iajFEYXJrR3JleT0zMzc5MjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLAp2YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTEwODUzNjMxO2EuYmdMaWdodEdyZXk9MTY3NzY5NjA7YS5iZ0RhcmtHcmV5PTI1MzQ0O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTEwODUzNjMxO2Eub2JqMExpZ2h0R3JleT0xNjc3Njk2MDthLm9iajBEYXJrR3JleT0yNTM0NDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTEwODUzNjMxO2Eub2JqMUxpZ2h0R3JleT0xNjc3Njk2MDthLm9iajFEYXJrR3JleT0yNTM0NDthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHdhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT02NTMwNTU5O2EuYmdEYXJrR3JleT0yNTU7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzQ1NjA0O2Eub2JqMERhcmtHcmV5PTk3MTQyMzQ7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9NjUzMDU1OTsKYS5vYmoxRGFya0dyZXk9MjU1O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCkseGE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTE2NzQ1NjA0O2EuYmdEYXJrR3JleT05NzE0MjM0O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT04MTI2MjU3O2Eub2JqMERhcmtHcmV5PTMzNzkyO2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTE2NzQ1NjA0O2Eub2JqMURhcmtHcmV5PTk3MTQyMzQ7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSx5YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTExOTA4NjA3O2EuYmdMaWdodEdyZXk9MTY3NzcxMDg7YS5iZ0RhcmtHcmV5PTExMzYwODM0O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTA7YS5vYmowTGlnaHRHcmV5PTE2Nzc3MjE1O2Eub2JqMERhcmtHcmV5PTE2NzQ1NjA0O2Eub2JqMEJsYWNrPQo5NzE0MjM0O2Eub2JqMVdoaXRlPTA7YS5vYmoxTGlnaHRHcmV5PTE2Nzc3MjE1O2Eub2JqMURhcmtHcmV5PTE2NzQ1NjA0O2Eub2JqMUJsYWNrPTk3MTQyMzQ7cmV0dXJuIGF9KCksemE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTExMzgyMTQ4O2EuYmdEYXJrR3JleT00MzU0OTM5O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc0MTEyMDthLm9iajBEYXJrR3JleT05NzE2MjI0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTU5NDY4Nzk7YS5vYmoxRGFya0dyZXk9MTY3MTE2ODA7YS5vYmoxQmxhY2s9MjU1O3JldHVybiBhfSgpLEFhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcxMTY7YS5iZ0xpZ2h0R3JleT05NzQ1OTE5O2EuYmdEYXJrR3JleT02NTI2MDY3O2EuYmdCbGFjaz0xNDkwNjthLm9iajBXaGl0ZT0KMTY3NjIxNzg7YS5vYmowTGlnaHRHcmV5PTE2NzY2NDY0O2Eub2JqMERhcmtHcmV5PTk3MTQxNzY7YS5vYmowQmxhY2s9NDg0OTY2NDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9MTY3NDU2MDQ7YS5vYmoxRGFya0dyZXk9OTcxNDIzNDthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLEJhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9NzA3NzYzMjthLmJnTGlnaHRHcmV5PTE2Nzc3MjE1O2EuYmdEYXJrR3JleT0xNjczMjc0NjthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NzcyMTU7YS5vYmowRGFya0dyZXk9NjUzMDU1OTthLm9iajBCbGFjaz0yNTU7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTE2NzU2MDY3O2Eub2JqMURhcmtHcmV5PTg2NjMyOTY7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxDYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTEwODUzNjMxOwphLmJnTGlnaHRHcmV5PTE2Nzc2OTYwO2EuYmdEYXJrR3JleT0yNTM0NDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjczNzEwNjthLm9iajBMaWdodEdyZXk9MTQwMjQ3MDQ7YS5vYmowRGFya0dyZXk9NjQ4ODA2NDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTI1NTthLm9iajFMaWdodEdyZXk9MTY3NzcyMTU7YS5vYmoxRGFya0dyZXk9MTY3NzcwODM7YS5vYmoxQmxhY2s9MzQwNDc7cmV0dXJuIGF9KCksRGE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzE2NjthLmJnTGlnaHRHcmV5PTY1NDk0ODc7YS5iZ0RhcmtHcmV5PTEwMjU3NDU3O2EuYmdCbGFjaz01OTIxMzcwO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc0MTEyMDthLm9iajBEYXJrR3JleT05NzE2MjI0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTY1MzA1NTk7YS5vYmoxRGFya0dyZXk9MjU1O2Eub2JqMUJsYWNrPTA7CnJldHVybiBhfSgpLEVhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xNjc0NTYwNDthLmJnRGFya0dyZXk9OTcxNDIzNDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9NjUyODA7YS5vYmowRGFya0dyZXk9MzI0NTA1NjthLm9iajBCbGFjaz0xODk0NDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9NjUzMDU1OTthLm9iajFEYXJrR3JleT0yNTU7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxGYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9NjUzMDU1OTthLmJnRGFya0dyZXk9MjU1O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc2OTYwO2Eub2JqMExpZ2h0R3JleT0xNjcxMTY4MDthLm9iajBEYXJrR3JleT02NDg4MDY0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PQo4MTI2MjU3O2Eub2JqMURhcmtHcmV5PTMzNzkyO2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksR2E9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTExMzgyMTQ4O2EuYmdEYXJrR3JleT00MzU0OTM5O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc1NjA2NzthLm9iajBEYXJrR3JleT0xNjc1NjA2NzthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT02NTMwNTU5O2Eub2JqMURhcmtHcmV5PTI1NTthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLGQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT1MLmJnV2hpdGU7YS5iZ0xpZ2h0R3JleT1MLmJnTGlnaHRHcmV5O2EuYmdEYXJrR3JleT1MLmJnRGFya0dyZXk7YS5iZ0JsYWNrPUwuYmdCbGFjazthLm9iajBXaGl0ZT1MLm9iajBXaGl0ZTthLm9iajBMaWdodEdyZXk9TC5vYmowTGlnaHRHcmV5OwphLm9iajBEYXJrR3JleT1MLm9iajBEYXJrR3JleTthLm9iajBCbGFjaz1MLm9iajBCbGFjazthLm9iajFXaGl0ZT1MLm9iajFXaGl0ZTthLm9iajFMaWdodEdyZXk9TC5vYmoxTGlnaHRHcmV5O2Eub2JqMURhcmtHcmV5PUwub2JqMURhcmtHcmV5O2Eub2JqMUJsYWNrPUwub2JqMUJsYWNrO3JldHVybiBhfSgpLFhhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVJbmRleD02NTM4NDthLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVEYXRhPTY1Mzg1O2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlSW5kZXg9NjUzODY7YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhPTY1Mzg3O2EubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZT02NTM1MTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZT02NTM1MjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bz02NTM1MztyZXR1cm4gYX0oKSwKZGI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudGlsZUlkPS0xO2EuaG9yaXpvbnRhbEZsaXA9ITE7YS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz0tMTtyZXR1cm4gYX0oKSxCPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYyl7YS5OUngwU3dlZXBQZXJpb2Q9KGMmMTEyKT4+NDthLk5SeDBOZWdhdGU9bigzLGMpO2EuTlJ4MFN3ZWVwU2hpZnQ9YyY3fTthLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYyl7YS5OUngxRHV0eT1jPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1jJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYyl7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yz4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGMpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWMmNzthLmlzRGFjRW5hYmxlZD0wPChjJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihjKXthLk5SeDNGcmVxdWVuY3lMU0I9CmM7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGN9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihjKXthLk5SeDRMZW5ndGhFbmFibGVkPW4oNixjKTtjJj03O2EuTlJ4NEZyZXF1ZW5jeU1TQj1jO2EuZnJlcXVlbmN5PWM8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNFbmFibGVkO2VbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2VbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2VbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZHV0eUN5Y2xlO2VbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eTtlWzEwNDkrNTAqYS5zYXZlU3RhdGVTbG90XT0KYS5pc1N3ZWVwRW5hYmxlZDtlWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwQ291bnRlcjtlWzEwNTUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwU2hhZG93RnJlcXVlbmN5fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVEoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5lbnZlbG9wZUNvdW50ZXI9ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWVbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eudm9sdW1lPWVbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZHV0eUN5Y2xlPWVbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1lWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmlzU3dlZXBFbmFibGVkPVEoMTA0OSs1MCphLnNhdmVTdGF0ZVNsb3QpO2Euc3dlZXBDb3VudGVyPWVbMTA1MCs1MCphLnNhdmVTdGF0ZVNsb3RdOwphLnN3ZWVwU2hhZG93RnJlcXVlbmN5PWVbMTA1NSs1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtnKGEubWVtb3J5TG9jYXRpb25OUngwLDEyOCk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MSwxOTEpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDIsMjQzKTtnKGEubWVtb3J5TG9jYXRpb25OUngzLDE5Myk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxOTEpO2IuQm9vdFJPTUVuYWJsZWQmJihnKGEubWVtb3J5TG9jYXRpb25OUngxLDYzKSxnKGEubWVtb3J5TG9jYXRpb25OUngyLDApLGcoYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCksZyhhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxODQpKX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGM9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYyl9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe3ZhciBjPTIwNDgtYS5mcmVxdWVuY3k8PDI7Yi5HQkNEb3VibGVTcGVlZCYmCihjPDw9Mik7YS5mcmVxdWVuY3lUaW1lcj1jfTthLmdldFNhbXBsZT1mdW5jdGlvbihjKXtjPWEuZnJlcXVlbmN5VGltZXItYztpZigwPj1jKXt2YXIgYj1NYXRoLmFicyhjKTthLmZyZXF1ZW5jeVRpbWVyPWM7YS5yZXNldFRpbWVyKCk7YS5mcmVxdWVuY3lUaW1lci09YjthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5KzEmN31lbHNlIGEuZnJlcXVlbmN5VGltZXI9YztpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYz1hLnZvbHVtZTtlbHNlIHJldHVybiAxNTtiPTE7YWMoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYj0tYik7cmV0dXJuIGIqYysxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj02NCk7YS5yZXNldFRpbWVyKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7CmEuc3dlZXBTaGFkb3dGcmVxdWVuY3k9YS5mcmVxdWVuY3k7YS5zd2VlcENvdW50ZXI9YS5OUngwU3dlZXBQZXJpb2Q7YS5pc1N3ZWVwRW5hYmxlZD0wPGEuTlJ4MFN3ZWVwUGVyaW9kJiYwPGEuTlJ4MFN3ZWVwU2hpZnQ7MDxhLk5SeDBTd2VlcFNoaWZ0JiZiYygpO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGMpe2M9YS5jeWNsZUNvdW50ZXIrYzthLmN5Y2xlQ291bnRlcj1jO3JldHVybiEoMDxhLmZyZXF1ZW5jeVRpbWVyLWMpfTthLnVwZGF0ZVN3ZWVwPWZ1bmN0aW9uKCl7dmFyIGM9YS5zd2VlcENvdW50ZXItMTswPj1jPyhhLnN3ZWVwQ291bnRlcj1hLk5SeDBTd2VlcFBlcmlvZCxhLmlzU3dlZXBFbmFibGVkJiYwPGEuTlJ4MFN3ZWVwUGVyaW9kJiZiYygpKTphLnN3ZWVwQ291bnRlcj1jfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpe3ZhciBjPWEubGVuZ3RoQ291bnRlcjswPGMmJmEuTlJ4NExlbmd0aEVuYWJsZWQmJgotLWM7MD09PWMmJihhLmlzRW5hYmxlZD0hMSk7YS5sZW5ndGhDb3VudGVyPWN9O2EudXBkYXRlRW52ZWxvcGU9ZnVuY3Rpb24oKXt2YXIgYz1hLmVudmVsb3BlQ291bnRlci0xO2lmKDA+PWMmJihjPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1jKSl7dmFyIGI9YS52b2x1bWU7YS5OUngyRW52ZWxvcGVBZGRNb2RlJiYxNT5iP2IrPTE6IWEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMDxiJiYtLWI7YS52b2x1bWU9Yn1hLmVudmVsb3BlQ291bnRlcj1jfTthLnNldEZyZXF1ZW5jeT1mdW5jdGlvbihjKXt2YXIgYj1jPj44O2MmPTI1NTt2YXIgZD14KGEubWVtb3J5TG9jYXRpb25OUng0KSYyNDh8YjtnKGEubWVtb3J5TG9jYXRpb25OUngzLGMpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDQsZCk7YS5OUngzRnJlcXVlbmN5TFNCPWM7YS5OUng0RnJlcXVlbmN5TVNCPWI7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5jeWNsZUNvdW50ZXI9MDsKYS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUyOTY7YS5OUngwU3dlZXBQZXJpb2Q9MDthLk5SeDBOZWdhdGU9ITE7YS5OUngwU3dlZXBTaGlmdD0wO2EubWVtb3J5TG9jYXRpb25OUngxPTY1Mjk3O2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUyOTg7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTI5OTthLk5SeDNGcmVxdWVuY3lMU0I9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMwMDthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EuY2hhbm5lbE51bWJlcj0xO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0KMDthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MDthLmlzU3dlZXBFbmFibGVkPSExO2Euc3dlZXBDb3VudGVyPTA7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT0wO2Euc2F2ZVN0YXRlU2xvdD03O3JldHVybiBhfSgpLE89ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MT1mdW5jdGlvbihjKXthLk5SeDFEdXR5PWM+PjYmMzthLk5SeDFMZW5ndGhMb2FkPWMmNjM7YS5sZW5ndGhDb3VudGVyPTY0LWEuTlJ4MUxlbmd0aExvYWR9O2EudXBkYXRlTlJ4Mj1mdW5jdGlvbihjKXthLk5SeDJTdGFydGluZ1ZvbHVtZT1jPj40JjE1O2EuTlJ4MkVudmVsb3BlQWRkTW9kZT1uKDMsYyk7YS5OUngyRW52ZWxvcGVQZXJpb2Q9YyY3O2EuaXNEYWNFbmFibGVkPTA8KGMmMjQ4KX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGMpe2EuTlJ4M0ZyZXF1ZW5jeUxTQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxjfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYyl7YS5OUng0TGVuZ3RoRW5hYmxlZD0Kbig2LGMpO2MmPTc7YS5OUng0RnJlcXVlbmN5TVNCPWM7YS5mcmVxdWVuY3k9Yzw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0VuYWJsZWQ7ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtlWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmVudmVsb3BlQ291bnRlcjtlWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7ZVsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS52b2x1bWU7ZVsxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kdXR5Q3ljbGU7ZVsxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVEoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5lbnZlbG9wZUNvdW50ZXI9CmVbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1lWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1lWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmR1dHlDeWNsZT1lWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9ZVsxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2coYS5tZW1vcnlMb2NhdGlvbk5SeDEtMSwyNTUpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDEsNjMpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDIsMCk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtnKGEubWVtb3J5TG9jYXRpb25OUng0LDE4NCl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBjPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGMpfTthLnJlc2V0VGltZXI9ZnVuY3Rpb24oKXthLmZyZXF1ZW5jeVRpbWVyPQoyMDQ4LWEuZnJlcXVlbmN5PDwyPDxiLkdCQ0RvdWJsZVNwZWVkfTthLmdldFNhbXBsZT1mdW5jdGlvbihjKXtjPWEuZnJlcXVlbmN5VGltZXItYzthLmZyZXF1ZW5jeVRpbWVyPWM7MD49YyYmKGM9TWF0aC5hYnMoYyksYS5yZXNldFRpbWVyKCksYS5mcmVxdWVuY3lUaW1lci09YyxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5KzEmNyk7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWM9YS52b2x1bWU7ZWxzZSByZXR1cm4gMTU7dmFyIGI9MTthYyhhLk5SeDFEdXR5LGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSl8fChiPS1iKTtyZXR1cm4gYipjKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTY0KTthLnJlc2V0VGltZXIoKTthLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTsKYS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYyl7Yz1hLmN5Y2xlQ291bnRlcitjO2EuY3ljbGVDb3VudGVyPWM7cmV0dXJuISgwPGEuZnJlcXVlbmN5VGltZXItYyl9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7dmFyIGM9YS5sZW5ndGhDb3VudGVyOzA8YyYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1jOzA9PT1jJiYoYS5pc0VuYWJsZWQ9ITEpO2EubGVuZ3RoQ291bnRlcj1jfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7dmFyIGM9YS5lbnZlbG9wZUNvdW50ZXItMTtpZigwPj1jJiYoYz1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09Yykpe3ZhciBiPWEudm9sdW1lO2EuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+Yj9iKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjA8YiYmLS1iO2Eudm9sdW1lPWJ9YS5lbnZlbG9wZUNvdW50ZXI9Y307YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYyl7dmFyIGI9Yz4+ODtjJj0KMjU1O3ZhciBkPXgoYS5tZW1vcnlMb2NhdGlvbk5SeDQpJjI0OHxiO2coYS5tZW1vcnlMb2NhdGlvbk5SeDMsYyk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4NCxkKTthLk5SeDNGcmVxdWVuY3lMU0I9YzthLk5SeDRGcmVxdWVuY3lNU0I9YjthLmZyZXF1ZW5jeT1iPDw4fGN9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMDI7YS5OUngxRHV0eT0wO2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwMzthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA0O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzA1O2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5jaGFubmVsTnVtYmVyPTI7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9CjA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wO2Euc2F2ZVN0YXRlU2xvdD04O3JldHVybiBhfSgpLEo9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MD1mdW5jdGlvbihiKXthLmlzRGFjRW5hYmxlZD1uKDcsYil9O2EudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFMZW5ndGhMb2FkPWI7YS5sZW5ndGhDb3VudGVyPTI1Ni1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyVm9sdW1lQ29kZT1iPj41JjE1fTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGJ9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPW4oNixiKTtiJj03O2EuTlJ4NEZyZXF1ZW5jeU1TQj0KYjthLmZyZXF1ZW5jeT1iPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzRW5hYmxlZDtlWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2VbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtlWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVUYWJsZVBvc2l0aW9ufTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVEoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWVbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZVRhYmxlUG9zaXRpb249ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2coYS5tZW1vcnlMb2NhdGlvbk5SeDAsMTI3KTtnKGEubWVtb3J5TG9jYXRpb25OUngxLAoyNTUpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDIsMTU5KTtnKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2coYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTg0KTthLnZvbHVtZUNvZGVDaGFuZ2VkPSEwfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYj1hLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShiKX07YS5yZXNldFRpbWVyPWZ1bmN0aW9uKCl7YS5mcmVxdWVuY3lUaW1lcj0yMDQ4LWEuZnJlcXVlbmN5PDwxPDxiLkdCQ0RvdWJsZVNwZWVkfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXt2YXIgYz1hLmZyZXF1ZW5jeVRpbWVyO2MtPWI7MD49Yz8oYj1NYXRoLmFicyhjKSxhLmZyZXF1ZW5jeVRpbWVyPWMsYS5yZXNldFRpbWVyKCksYS5mcmVxdWVuY3lUaW1lci09YixhLndhdmVUYWJsZVBvc2l0aW9uPWEud2F2ZVRhYmxlUG9zaXRpb24rMSYzMSk6YS5mcmVxdWVuY3lUaW1lcj1jO2M9YS52b2x1bWVDb2RlO2lmKGEuaXNFbmFibGVkJiYKYS5pc0RhY0VuYWJsZWQpYS52b2x1bWVDb2RlQ2hhbmdlZCYmKGM9eChhLm1lbW9yeUxvY2F0aW9uTlJ4MiksYz1jPj41JjE1LGEudm9sdW1lQ29kZT1jLGEudm9sdW1lQ29kZUNoYW5nZWQ9ITEpO2Vsc2UgcmV0dXJuIDE1O3ZhciBkPWEud2F2ZVRhYmxlUG9zaXRpb247Yj14KGEubWVtb3J5TG9jYXRpb25XYXZlVGFibGUrKGQ+PjF8MCkpO2I9Yj4+KCgwPT09KGQmMSkpPDwyKSYxNTtkPTA7c3dpdGNoKGMpe2Nhc2UgMDpiPj49NDticmVhaztjYXNlIDE6ZD0xO2JyZWFrO2Nhc2UgMjpiPj49MTtkPTI7YnJlYWs7ZGVmYXVsdDpiPj49MixkPTR9cmV0dXJuIGI9KDA8ZD9iL2Q6MCkrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9MjU2KTthLnJlc2V0VGltZXIoKTthLndhdmVUYWJsZVBvc2l0aW9uPTA7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9CmZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiEoIWEudm9sdW1lQ29kZUNoYW5nZWQmJjA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcil9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7dmFyIGI9YS5sZW5ndGhDb3VudGVyOzA8YiYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1iOzA9PT1iJiYoYS5pc0VuYWJsZWQ9ITEpO2EubGVuZ3RoQ291bnRlcj1ifTthLmN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25OUngwPTY1MzA2O2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzA3O2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwODthLk5SeDJWb2x1bWVDb2RlPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMDk7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMTA7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLm1lbW9yeUxvY2F0aW9uV2F2ZVRhYmxlPTY1MzI4OwphLmNoYW5uZWxOdW1iZXI9MzthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLndhdmVUYWJsZVBvc2l0aW9uPTA7YS52b2x1bWVDb2RlPTA7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMTthLnNhdmVTdGF0ZVNsb3Q9OTtyZXR1cm4gYX0oKSxQPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9bigzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXt2YXIgYz1iJjc7YS5OUngzQ2xvY2tTaGlmdD1iPj40O2EuTlJ4M1dpZHRoTW9kZT0KbigzLGIpO2EuTlJ4M0Rpdmlzb3JDb2RlPWM7Yzw8PTE7MT5jJiYoYz0xKTthLmRpdmlzb3I9Yzw8M307YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9big2LGIpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNFbmFibGVkO2VbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2VbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2VbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVEoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07CmEuZW52ZWxvcGVDb3VudGVyPWVbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1lWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1lWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj1lWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MS0xLDI1NSk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MSwyNTUpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDIsMCk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtnKGEubWVtb3J5TG9jYXRpb25OUng0LDE5MSl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXt2YXIgYz1hLmZyZXF1ZW5jeVRpbWVyO2MtPWI7aWYoMD49CmMpe2I9TWF0aC5hYnMoYyk7Yz1hLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZCgpO2MtPWI7Yj1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcjt2YXIgZD1iJjFeYj4+MSYxO2I9Yj4+MXxkPDwxNDthLk5SeDNXaWR0aE1vZGUmJihiPWImLTY1fGQ8PDYpO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPWJ9YS5mcmVxdWVuY3lUaW1lcj1jO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCljPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O2I9bigwLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyKT8tMToxO3JldHVybiBiKmMrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EuZnJlcXVlbmN5VGltZXI9YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2QoKTthLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTsKYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MzI3Njc7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7cmV0dXJuISgwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXIpfTthLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZD1mdW5jdGlvbigpe3JldHVybiBhLmRpdmlzb3I8PGEuTlJ4M0Nsb2NrU2hpZnQ8PGIuR0JDRG91YmxlU3BlZWR9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7dmFyIGI9YS5sZW5ndGhDb3VudGVyOzA8YiYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1iOzA9PT1iJiYoYS5pc0VuYWJsZWQ9ITEpO2EubGVuZ3RoQ291bnRlcj1ifTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7dmFyIGI9YS5lbnZlbG9wZUNvdW50ZXItMTtpZigwPj1iJiYoYj1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09Yikpe3ZhciBkPWEudm9sdW1lO2EuTlJ4MkVudmVsb3BlQWRkTW9kZSYmCjE1PmQ/ZCs9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGQmJi0tZDthLnZvbHVtZT1kfWEuZW52ZWxvcGVDb3VudGVyPWJ9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMTI7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1MzEzO2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPTA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMTQ7YS5OUngzQ2xvY2tTaGlmdD0wO2EuTlJ4M1dpZHRoTW9kZT0hMTthLk5SeDNEaXZpc29yQ29kZT0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzE1O2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5jaGFubmVsTnVtYmVyPTQ7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmRpdmlzb3I9MDsKYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MDthLnNhdmVTdGF0ZVNsb3Q9MTA7cmV0dXJuIGF9KCksdz1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5jaGFubmVsMVNhbXBsZT0xNTthLmNoYW5uZWwyU2FtcGxlPTE1O2EuY2hhbm5lbDNTYW1wbGU9MTU7YS5jaGFubmVsNFNhbXBsZT0xNTthLmNoYW5uZWwxRGFjRW5hYmxlZD0hMTthLmNoYW5uZWwyRGFjRW5hYmxlZD0hMTthLmNoYW5uZWwzRGFjRW5hYmxlZD0hMTthLmNoYW5uZWw0RGFjRW5hYmxlZD0hMTthLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzthLnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7YS5taXhlclZvbHVtZUNoYW5nZWQ9ITE7YS5taXhlckVuYWJsZWRDaGFuZ2VkPSExO2EubmVlZFRvUmVtaXhTYW1wbGVzPSExO3JldHVybiBhfSgpLGw9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIDg3PDxiLkdCQ0RvdWJsZVNwZWVkfTsKYS51cGRhdGVOUjUwPWZ1bmN0aW9uKGIpe2EuTlI1MExlZnRNaXhlclZvbHVtZT1iPj40Jjc7YS5OUjUwUmlnaHRNaXhlclZvbHVtZT1iJjd9O2EudXBkYXRlTlI1MT1mdW5jdGlvbihiKXthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD1uKDcsYik7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9big2LGIpO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PW4oNSxiKTthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD1uKDQsYik7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PW4oMyxiKTthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9bigyLGIpO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD1uKDEsYik7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PW4oMCxiKX07YS51cGRhdGVOUjUyPWZ1bmN0aW9uKGIpe2EuTlI1MklzU291bmRFbmFibGVkPQpuKDcsYil9O2EubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcz1mdW5jdGlvbigpe3JldHVybiA4MTkyPDxiLkdCQ0RvdWJsZVNwZWVkfTthLm1heERvd25TYW1wbGVDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5DTE9DS19TUEVFRCgpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcjtlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI7ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmFtZVNlcXVlbmNlcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPWVbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZnJhbWVTZXF1ZW5jZXI9ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07ZmMoKX07YS5jdXJyZW50Q3ljbGVzPQowO2EubWVtb3J5TG9jYXRpb25OUjUwPTY1MzE2O2EuTlI1MExlZnRNaXhlclZvbHVtZT0wO2EuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9MDthLm1lbW9yeUxvY2F0aW9uTlI1MT02NTMxNzthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5tZW1vcnlMb2NhdGlvbk5SNTI9NjUzMTg7YS5OUjUySXNTb3VuZEVuYWJsZWQ9ITA7YS5tZW1vcnlMb2NhdGlvbkNoYW5uZWwzTG9hZFJlZ2lzdGVyU3RhcnQ9CjY1MzI4O2EuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcj00OEUzO2EuZnJhbWVTZXF1ZW5jZXI9MDthLmF1ZGlvUXVldWVJbmRleD0wO2Eud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemU9MTMxMDcyO2Euc2F2ZVN0YXRlU2xvdD02O3JldHVybiBhfSgpLG09ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSW50ZXJydXB0RW5hYmxlZD1mdW5jdGlvbihiKXthLmlzVkJsYW5rSW50ZXJydXB0RW5hYmxlZD1uKGEuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQsYik7YS5pc0xjZEludGVycnVwdEVuYWJsZWQ9bihhLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0LGIpO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9bihhLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQsYik7YS5pc1NlcmlhbEludGVycnVwdEVuYWJsZWQ9bihhLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0LGIpOwphLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZD1uKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlPWJ9O2EudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkPWZ1bmN0aW9uKGIpe2EuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9bihhLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0LGIpO2EuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9bihhLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0LGIpO2EuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD1uKGEuYml0UG9zaXRpb25UaW1lckludGVycnVwdCxiKTthLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPW4oYS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCxiKTthLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPW4oYS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdCxiKTthLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT1ifTthLmFyZUludGVycnVwdHNQZW5kaW5nPWZ1bmN0aW9uKCl7cmV0dXJuIDA8CihhLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSZhLmludGVycnVwdHNFbmFibGVkVmFsdWUmMzEpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEubWFzdGVySW50ZXJydXB0U3dpdGNoO2VbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9USgxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT1RKDEwMjUrNTAqYS5zYXZlU3RhdGVTbG90KTthLnVwZGF0ZUludGVycnVwdEVuYWJsZWQoeChhLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZCkpO2EudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKHgoYS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpKX07YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITE7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0KITE7YS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdD0wO2EuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ9MTthLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ9MjthLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0PTM7YS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdD00O2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkPTY1NTM1O2EuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZT0wO2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9ITE7YS5pc1NlcmlhbEludGVycnVwdEVuYWJsZWQ9ITE7YS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQ9ITE7YS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3Q9NjUyOTU7YS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9MDthLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPQohMTthLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5zYXZlU3RhdGVTbG90PTI7cmV0dXJuIGF9KCkscT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gMjU2fTthLnVwZGF0ZURpdmlkZXJSZWdpc3Rlcj1mdW5jdGlvbigpe3ZhciBiPWEuZGl2aWRlclJlZ2lzdGVyO2EuZGl2aWRlclJlZ2lzdGVyPTA7ZyhhLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyLDApO2EudGltZXJFbmFibGVkJiZoYyhiLDApJiZKYigpfTthLnVwZGF0ZVRpbWVyQ291bnRlcj1mdW5jdGlvbihiKXtpZihhLnRpbWVyRW5hYmxlZCl7aWYoYS50aW1lckNvdW50ZXJXYXNSZXNldClyZXR1cm47YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5JiYoYS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExKX1hLnRpbWVyQ291bnRlcj1ifTthLnVwZGF0ZVRpbWVyTW9kdWxvPWZ1bmN0aW9uKGIpe2EudGltZXJNb2R1bG89CmI7YS50aW1lckVuYWJsZWQmJmEudGltZXJDb3VudGVyV2FzUmVzZXQmJihhLnRpbWVyQ291bnRlcj1iLGEudGltZXJDb3VudGVyV2FzUmVzZXQ9ITEpfTthLnVwZGF0ZVRpbWVyQ29udHJvbD1mdW5jdGlvbihiKXt2YXIgYz1hLnRpbWVyRW5hYmxlZDthLnRpbWVyRW5hYmxlZD1uKDIsYik7YiY9MztpZighYyl7Yz1LYihhLnRpbWVySW5wdXRDbG9jayk7dmFyIGQ9S2IoYiksZT1hLmRpdmlkZXJSZWdpc3RlcjsoYS50aW1lckVuYWJsZWQ/bihjLGUpOm4oYyxlKSYmbihkLGUpKSYmSmIoKX1hLnRpbWVySW5wdXRDbG9jaz1ifTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmRpdmlkZXJSZWdpc3RlcjtlWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk7ZVsxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS50aW1lckNvdW50ZXJXYXNSZXNldDsKZyhhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyLGEudGltZXJDb3VudGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRDeWNsZXM9ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kaXZpZGVyUmVnaXN0ZXI9ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PVEoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EudGltZXJDb3VudGVyV2FzUmVzZXQ9USgxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS50aW1lckNvdW50ZXI9eChhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyKTthLnRpbWVyTW9kdWxvPXgoYS5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvKTthLnRpbWVySW5wdXRDbG9jaz14KGEubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2wpfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPTY1Mjg0O2EuZGl2aWRlclJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcj0KNjUyODU7YS50aW1lckNvdW50ZXI9MDthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITE7YS50aW1lckNvdW50ZXJXYXNSZXNldD0hMTthLnRpbWVyQ291bnRlck1hc2s9MDthLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG89NjUyODY7YS50aW1lck1vZHVsbz0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w9NjUyODc7YS50aW1lckVuYWJsZWQ9ITE7YS50aW1lcklucHV0Q2xvY2s9MDthLnNhdmVTdGF0ZVNsb3Q9NTtyZXR1cm4gYX0oKSxaPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZVRyYW5zZmVyQ29udHJvbD1mdW5jdGlvbihiKXthLmlzU2hpZnRDbG9ja0ludGVybmFsPW4oMCxiKTthLmlzQ2xvY2tTcGVlZEZhc3Q9bigxLGIpO2EudHJhbnNmZXJTdGFydEZsYWc9big3LGIpO3JldHVybiEwfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJEYXRhPTY1MjgxO2EubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckNvbnRyb2w9CjY1MjgyO2EubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQ9MDthLmlzU2hpZnRDbG9ja0ludGVybmFsPSExO2EuaXNDbG9ja1NwZWVkRmFzdD0hMTthLnRyYW5zZmVyU3RhcnRGbGFnPSExO3JldHVybiBhfSgpLEM9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSm95cGFkPWZ1bmN0aW9uKGIpe2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPWJeMjU1O2EuaXNEcGFkVHlwZT1uKDQsYS5qb3lwYWRSZWdpc3RlckZsaXBwZWQpO2EuaXNCdXR0b25UeXBlPW4oNSxhLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EudXBkYXRlSm95cGFkKHgoYS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyKSl9O2EudXA9ITE7YS5kb3duPSExO2EubGVmdD0hMTthLnJpZ2h0PSExO2EuYT0hMTthLmI9ITE7YS5zZWxlY3Q9ITE7YS5zdGFydD0hMTthLm1lbW9yeUxvY2F0aW9uSm95cGFkUmVnaXN0ZXI9NjUyODA7YS5qb3lwYWRSZWdpc3RlckZsaXBwZWQ9CjA7YS5pc0RwYWRUeXBlPSExO2EuaXNCdXR0b25UeXBlPSExO2Euc2F2ZVN0YXRlU2xvdD0zO3JldHVybiBhfSgpLGFhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnByb2dyYW1Db3VudGVyPS0xO2EucmVhZEdiTWVtb3J5PS0xO2Eud3JpdGVHYk1lbW9yeT0tMTthLnJlYWNoZWRCcmVha3BvaW50PSExO3JldHVybiBhfSgpLHY9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTGNkU3RhdHVzPWZ1bmN0aW9uKGIpe3ZhciBjPXgoYS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyk7Yj1iJjI0OHxjJjd8MTI4O2coYS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxiKX07YS51cGRhdGVMY2RDb250cm9sPWZ1bmN0aW9uKGIpe3ZhciBjPWEuZW5hYmxlZDthLmVuYWJsZWQ9big3LGIpO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9big2LGIpO2Eud2luZG93RGlzcGxheUVuYWJsZWQ9big1LGIpO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD1uKDQsYik7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PQpuKDMsYik7YS50YWxsU3ByaXRlU2l6ZT1uKDIsYik7YS5zcHJpdGVEaXNwbGF5RW5hYmxlPW4oMSxiKTthLmJnRGlzcGxheUVuYWJsZWQ9bigwLGIpO2MmJiFhLmVuYWJsZWQmJmtjKCEwKTshYyYmYS5lbmFibGVkJiZrYyghMSl9O2EubWVtb3J5TG9jYXRpb25MY2RTdGF0dXM9NjUzNDU7YS5jdXJyZW50TGNkTW9kZT0wO2EubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmU9NjUzNDk7YS5jb2luY2lkZW5jZUNvbXBhcmU9MDthLm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbD02NTM0NDthLmVuYWJsZWQ9ITA7YS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdD0hMTthLndpbmRvd0Rpc3BsYXlFbmFibGVkPSExO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD0hMTthLmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS50YWxsU3ByaXRlU2l6ZT0hMTthLnNwcml0ZURpc3BsYXlFbmFibGU9ITE7YS5iZ0Rpc3BsYXlFbmFibGVkPSExO3JldHVybiBhfSgpLHI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBhLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCl9O2EuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkU9ZnVuY3Rpb24oKXtyZXR1cm4gMTUzPT09YS5zY2FubGluZVJlZ2lzdGVyPzQ8PGIuR0JDRG91YmxlU3BlZWQ6NDU2PDxiLkdCQ0RvdWJsZVNwZWVkfTthLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERT1mdW5jdGlvbigpe3JldHVybiAzNzY8PGIuR0JDRG91YmxlU3BlZWR9O2EuTUlOX0NZQ0xFU19UUkFOU0ZFUl9EQVRBX0xDRF9NT0RFPWZ1bmN0aW9uKCl7cmV0dXJuIDI0OTw8Yi5HQkNEb3VibGVTcGVlZH07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnNjYW5saW5lQ3ljbGVDb3VudGVyO2VbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPXYuY3VycmVudExjZE1vZGU7ZyhhLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlcixhLnNjYW5saW5lUmVnaXN0ZXIpfTsKYS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnNjYW5saW5lQ3ljbGVDb3VudGVyPWVbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO3YuY3VycmVudExjZE1vZGU9ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zY2FubGluZVJlZ2lzdGVyPXgoYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpO3YudXBkYXRlTGNkQ29udHJvbCh4KHYubWVtb3J5TG9jYXRpb25MY2RDb250cm9sKSl9O2EuY3VycmVudEN5Y2xlcz0wO2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj02NTM0ODthLnNjYW5saW5lUmVnaXN0ZXI9MDthLm1lbW9yeUxvY2F0aW9uRG1hVHJhbnNmZXI9NjUzNTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFg9NjUzNDc7YS5zY3JvbGxYPTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFk9NjUzNDY7YS5zY3JvbGxZPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1g9NjUzNTU7YS53aW5kb3dYPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1k9CjY1MzU0O2Eud2luZG93WT0wO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0PTM4OTEyO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQ9Mzk5MzY7YS5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0PTM0ODE2O2EubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0PTMyNzY4O2EubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGU9NjUwMjQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlPTY1MzUxO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lPTY1MzUyO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvPTY1MzUzO2Euc2F2ZVN0YXRlU2xvdD0xO3JldHVybiBhfSgpLGg9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50Um9tQmFuaztlWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT0KYS5jdXJyZW50UmFtQmFuaztlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzUmFtQmFua2luZ0VuYWJsZWQ7ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzFSb21Nb2RlRW5hYmxlZDtlWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzUm9tT25seTtlWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzTUJDMTtlWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzTUJDMjtlWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzTUJDMztlWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzTUJDNX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRSb21CYW5rPWVbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudFJhbUJhbms9ZVsxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1JhbUJhbmtpbmdFbmFibGVkPVEoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9USgxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7CmEuaXNSb21Pbmx5PVEoMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxPVEoMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMyPVEoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMzPVEoMTAzMys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkM1PVEoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLmNhcnRyaWRnZVJvbUxvY2F0aW9uPTA7YS5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb249MTYzODQ7YS52aWRlb1JhbUxvY2F0aW9uPTMyNzY4O2EuY2FydHJpZGdlUmFtTG9jYXRpb249NDA5NjA7YS5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb249NDkxNTI7YS5pbnRlcm5hbFJhbUJhbmtPbmVMb2NhdGlvbj01MzI0ODthLmVjaG9SYW1Mb2NhdGlvbj01NzM0NDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj02NTAyNDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD02NTE4MzthLnVudXNhYmxlTWVtb3J5TG9jYXRpb249CjY1MTg0O2EudW51c2FibGVNZW1vcnlFbmRMb2NhdGlvbj02NTI3OTthLmN1cnJlbnRSb21CYW5rPTA7YS5jdXJyZW50UmFtQmFuaz0wO2EuaXNSYW1CYW5raW5nRW5hYmxlZD0hMTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPSEwO2EuaXNSb21Pbmx5PSEwO2EuaXNNQkMxPSExO2EuaXNNQkMyPSExO2EuaXNNQkMzPSExO2EuaXNNQkM1PSExO2EubWVtb3J5TG9jYXRpb25IZG1hU291cmNlSGlnaD02NTM2MTthLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdz02NTM2MjthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaD02NTM2MzthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uTG93PTY1MzY0O2EubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcj02NTM2NTthLkRNQUN5Y2xlcz0wO2EuaXNIYmxhbmtIZG1hQWN0aXZlPSExO2EuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPTA7YS5oYmxhbmtIZG1hU291cmNlPTA7YS5oYmxhbmtIZG1hRGVzdGluYXRpb249CjA7YS5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rPTY1MzU5O2EubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaz02NTM5MjthLnNhdmVTdGF0ZVNsb3Q9NDtyZXR1cm4gYX0oKSxiPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLkNMT0NLX1NQRUVEPWZ1bmN0aW9uKCl7cmV0dXJuIDQxOTQzMDQ8PGEuR0JDRG91YmxlU3BlZWR9O2EuTUFYX0NZQ0xFU19QRVJfRlJBTUU9ZnVuY3Rpb24oKXtyZXR1cm4gNzAyMjQ8PGEuR0JDRG91YmxlU3BlZWR9O2EuZW5hYmxlSGFsdD1mdW5jdGlvbigpe20ubWFzdGVySW50ZXJydXB0U3dpdGNoP2EuaXNIYWx0Tm9ybWFsPSEwOjA9PT0obS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJm0uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlJjMxKT9hLmlzSGFsdE5vSnVtcD0hMDphLmlzSGFsdEJ1Zz0hMH07YS5leGl0SGFsdEFuZFN0b3A9ZnVuY3Rpb24oKXthLmlzSGFsdE5vSnVtcD0hMTthLmlzSGFsdE5vcm1hbD0hMTthLmlzSGFsdEJ1Zz0hMTthLmlzU3RvcHBlZD0KITF9O2EuaXNIYWx0ZWQ9ZnVuY3Rpb24oKXtyZXR1cm4gYS5pc0hhbHROb3JtYWx8fGEuaXNIYWx0Tm9KdW1wfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJBO2VbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJCO2VbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJDO2VbMTAyNys1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJEO2VbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJFO2VbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJIO2VbMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJMO2VbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJGO2VbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuc3RhY2tQb2ludGVyO2VbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucHJvZ3JhbUNvdW50ZXI7ZVsxMDM2KzUwKmEuc2F2ZVN0YXRlU2xvdF09CmEuY3VycmVudEN5Y2xlcztlWzEwNDErNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzSGFsdE5vcm1hbDtlWzEwNDIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzSGFsdE5vSnVtcDtlWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzSGFsdEJ1ZztlWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzU3RvcHBlZDtlWzEwNDUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLkJvb3RST01FbmFibGVkO2VbMTA0Nis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuR0JDRW5hYmxlZDtlWzEwNDcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLkdCQ0RvdWJsZVNwZWVkfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EucmVnaXN0ZXJBPWVbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJCPWVbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJDPWVbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJEPWVbMTAyNys1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJFPWVbMTAyOCsKNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVySD1lWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyTD1lWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyRj1lWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XTthLnN0YWNrUG9pbnRlcj1lWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XTthLnByb2dyYW1Db3VudGVyPWVbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudEN5Y2xlcz1lWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XTthLmlzSGFsdE5vcm1hbD1RKDEwNDErNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzSGFsdE5vSnVtcD1RKDEwNDIrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzSGFsdEJ1Zz1RKDEwNDMrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzU3RvcHBlZD1RKDEwNDQrNTAqYS5zYXZlU3RhdGVTbG90KTthLkJvb3RST01FbmFibGVkPVEoMTA0NSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuR0JDRW5hYmxlZD1RKDEwNDYrNTAqYS5zYXZlU3RhdGVTbG90KTsKYS5HQkNEb3VibGVTcGVlZD1RKDEwNDcrNTAqYS5zYXZlU3RhdGVTbG90KX07YS5tZW1vcnlMb2NhdGlvbkJvb3RST01Td2l0Y2g9NjUzNjA7YS5Cb290Uk9NRW5hYmxlZD0hMTthLkdCQ0VuYWJsZWQ9ITE7YS5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoPTY1MzU3O2EuR0JDRG91YmxlU3BlZWQ9ITE7YS5yZWdpc3RlckE9MDthLnJlZ2lzdGVyQj0wO2EucmVnaXN0ZXJDPTA7YS5yZWdpc3RlckQ9MDthLnJlZ2lzdGVyRT0wO2EucmVnaXN0ZXJIPTA7YS5yZWdpc3Rlckw9MDthLnJlZ2lzdGVyRj0wO2Euc3RhY2tQb2ludGVyPTA7YS5wcm9ncmFtQ291bnRlcj0wO2EuY3VycmVudEN5Y2xlcz0wO2EuaXNIYWx0Tm9ybWFsPSExO2EuaXNIYWx0Tm9KdW1wPSExO2EuaXNIYWx0QnVnPSExO2EuaXNTdG9wcGVkPSExO2Euc2F2ZVN0YXRlU2xvdD0wO3JldHVybiBhfSgpLGRhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmN5Y2xlc1BlckN5Y2xlU2V0PTJFOTthLmN5Y2xlU2V0cz0wO2EuY3ljbGVzPQowO3JldHVybiBhfSgpLFc9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuc3RlcHNQZXJTdGVwU2V0PTJFOTthLnN0ZXBTZXRzPTA7YS5zdGVwcz0wO2EuUkVTUE9OU0VfQ09ORElUSU9OX0VSUk9SPS0xO2EuUkVTUE9OU0VfQ09ORElUSU9OX0ZSQU1FPTA7YS5SRVNQT05TRV9DT05ESVRJT05fQVVESU89MTthLlJFU1BPTlNFX0NPTkRJVElPTl9CUkVBS1BPSU5UPTI7cmV0dXJuIGF9KCk7bGIuc2l6ZSgpPFdiJiZsYi5ncm93KFdiLWxiLnNpemUoKSk7dmFyIGpiPSExLFdjPU9iamVjdC5mcmVlemUoe21lbW9yeTpsYixjb25maWc6ZnVuY3Rpb24oYSxjLGUsbixmLGsscCx0LHUsdil7Ui5lbmFibGVCb290Um9tPTA8YTtSLnVzZUdiY1doZW5BdmFpbGFibGU9MDxjO1IuYXVkaW9CYXRjaFByb2Nlc3Npbmc9MDxlO1IuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmc9MDxuO1IudGltZXJzQmF0Y2hQcm9jZXNzaW5nPTA8ZjtSLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPTA8azsKUi5hdWRpb0FjY3VtdWxhdGVTYW1wbGVzPTA8cDtSLnRpbGVSZW5kZXJpbmc9MDx0O1IudGlsZUNhY2hpbmc9MDx1O1IuZW5hYmxlQXVkaW9EZWJ1Z2dpbmc9MDx2O2E9eCgzMjMpO2IuR0JDRW5hYmxlZD0xOTI9PT1hfHxSLnVzZUdiY1doZW5BdmFpbGFibGUmJjEyOD09PWE/ITA6ITE7amI9ITE7ZGEuY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O2RhLmN5Y2xlU2V0cz0wO2RhLmN5Y2xlcz0wO1cuc3RlcHNQZXJTdGVwU2V0PTJFOTtXLnN0ZXBTZXRzPTA7Vy5zdGVwcz0wO2IuQm9vdFJPTUVuYWJsZWQ9Ui5lbmFibGVCb290Um9tPyEwOiExO2IuR0JDRG91YmxlU3BlZWQ9ITE7Yi5yZWdpc3RlckE9MDtiLnJlZ2lzdGVyQj0wO2IucmVnaXN0ZXJDPTA7Yi5yZWdpc3RlckQ9MDtiLnJlZ2lzdGVyRT0wO2IucmVnaXN0ZXJIPTA7Yi5yZWdpc3Rlckw9MDtiLnJlZ2lzdGVyRj0wO2Iuc3RhY2tQb2ludGVyPTA7Yi5wcm9ncmFtQ291bnRlcj0wO2IuY3VycmVudEN5Y2xlcz0wO2IuaXNIYWx0Tm9ybWFsPQohMTtiLmlzSGFsdE5vSnVtcD0hMTtiLmlzSGFsdEJ1Zz0hMTtiLmlzU3RvcHBlZD0hMTtiLkJvb3RST01FbmFibGVkfHwoYi5HQkNFbmFibGVkPyhiLnJlZ2lzdGVyQT0xNyxiLnJlZ2lzdGVyRj0xMjgsYi5yZWdpc3RlckI9MCxiLnJlZ2lzdGVyQz0wLGIucmVnaXN0ZXJEPTI1NSxiLnJlZ2lzdGVyRT04NixiLnJlZ2lzdGVySD0wLGIucmVnaXN0ZXJMPTEzKTooYi5yZWdpc3RlckE9MSxiLnJlZ2lzdGVyRj0xNzYsYi5yZWdpc3RlckI9MCxiLnJlZ2lzdGVyQz0xOSxiLnJlZ2lzdGVyRD0wLGIucmVnaXN0ZXJFPTIxNixiLnJlZ2lzdGVySD0xLGIucmVnaXN0ZXJMPTc3KSxiLnByb2dyYW1Db3VudGVyPTI1NixiLnN0YWNrUG9pbnRlcj02NTUzNCk7aC5pc1JhbUJhbmtpbmdFbmFibGVkPSExO2guaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA7YT14KDMyNyk7aC5pc1JvbU9ubHk9MD09PWE7aC5pc01CQzE9MTw9YSYmMz49YTtoLmlzTUJDMj01PD1hJiY2Pj1hO2guaXNNQkMzPTE1PD1hJiYKMTk+PWE7aC5pc01CQzU9MjU8PWEmJjMwPj1hO2guY3VycmVudFJvbUJhbms9MTtoLmN1cnJlbnRSYW1CYW5rPTA7ZyhoLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbmssMCk7ZyhoLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmssMSk7Zyg2NTM2MSwyNTUpO2coNjUzNjIsMjU1KTtnKDY1MzYzLDI1NSk7Zyg2NTM2NCwyNTUpO2coNjUzNjUsMjU1KTtyLmN1cnJlbnRDeWNsZXM9MDtyLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7ci5zY2FubGluZVJlZ2lzdGVyPTA7ci5zY3JvbGxYPTA7ci5zY3JvbGxZPTA7ci53aW5kb3dYPTA7ci53aW5kb3dZPTA7ci5zY2FubGluZVJlZ2lzdGVyPTE0NDtiLkdCQ0VuYWJsZWQ/KGcoNjUzNDUsMTI5KSxnKDY1MzQ4LDE0NCksZyg2NTM1MSwyNTIpKTooZyg2NTM0NSwxMzMpLGcoNjUzNTAsMjU1KSxnKDY1MzUxLDI1MiksZyg2NTM1MiwyNTUpLGcoNjUzNTMsMjU1KSk7ci5zY2FubGluZVJlZ2lzdGVyPTE0NDtnKDY1MzQ0LDE0NCk7Zyg2NTM1OSwwKTtnKDY1MzkyLAoxKTtiLkJvb3RST01FbmFibGVkJiYoYi5HQkNFbmFibGVkPyhyLnNjYW5saW5lUmVnaXN0ZXI9MCxnKDY1MzQ0LDApLGcoNjUzNDUsMTI4KSxnKDY1MzQ4LDApKTooci5zY2FubGluZVJlZ2lzdGVyPTAsZyg2NTM0NCwwKSxnKDY1MzQ1LDEzMikpKTtaYigwKTtpZighYi5HQkNFbmFibGVkJiYoIWIuQm9vdFJPTUVuYWJsZWR8fGIuR0JDRW5hYmxlZCkpe2E9MDtmb3IoYz0zMDg7MzIzPj1jO2MrKylhKz14KGMpO3N3aXRjaChhJjI1NSl7Y2FzZSAxMzY6ZC5iZ1doaXRlPXZhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT12YS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9dmEuYmdEYXJrR3JleTtkLmJnQmxhY2s9dmEuYmdCbGFjaztkLm9iajBXaGl0ZT12YS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PXZhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9dmEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPXZhLm9iajBCbGFjaztkLm9iajFXaGl0ZT12YS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PQp2YS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXZhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz12YS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA5NzpkLmJnV2hpdGU9d2EuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXdhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT13YS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz13YS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXdhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9d2Eub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT13YS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9d2Eub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXdhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9d2Eub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT13YS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9d2Eub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMjA6ZC5iZ1doaXRlPXhhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT14YS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9eGEuYmdEYXJrR3JleTsKZC5iZ0JsYWNrPXhhLmJnQmxhY2s7ZC5vYmowV2hpdGU9eGEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT14YS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXhhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz14YS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9eGEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT14YS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXhhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz14YS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA3MDpkLmJnV2hpdGU9eWEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXlhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT15YS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz15YS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXlhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9eWEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT15YS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9eWEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXlhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9CnlhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9eWEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPXlhLm9iajFCbGFjazticmVhaztjYXNlIDg5OmNhc2UgMTk4OmQuYmdXaGl0ZT16YS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9emEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PXphLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPXphLmJnQmxhY2s7ZC5vYmowV2hpdGU9emEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT16YS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXphLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz16YS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9emEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT16YS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXphLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz16YS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAxMzQ6Y2FzZSAxNjg6ZC5iZ1doaXRlPUFhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1BYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9CkFhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPUFhLmJnQmxhY2s7ZC5vYmowV2hpdGU9QWEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1BYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PUFhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1BYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9QWEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1BYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PUFhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1BYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAxOTE6Y2FzZSAyMDY6Y2FzZSAyMDk6Y2FzZSAyNDA6ZC5iZ1doaXRlPUJhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1CYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9QmEuYmdEYXJrR3JleTtkLmJnQmxhY2s9QmEuYmdCbGFjaztkLm9iajBXaGl0ZT1CYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PUJhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9QmEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPQpCYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9QmEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1CYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PUJhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1CYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAzOTpjYXNlIDczOmNhc2UgOTI6Y2FzZSAxNzk6ZC5iZ1doaXRlPUNhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1DYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9Q2EuYmdEYXJrR3JleTtkLmJnQmxhY2s9Q2EuYmdCbGFjaztkLm9iajBXaGl0ZT1DYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PUNhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9Q2Eub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPUNhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1DYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PUNhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9Q2Eub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPUNhLm9iajFCbGFjazticmVhaztjYXNlIDIwMTpkLmJnV2hpdGU9CkRhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1EYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9RGEuYmdEYXJrR3JleTtkLmJnQmxhY2s9RGEuYmdCbGFjaztkLm9iajBXaGl0ZT1EYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PURhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9RGEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPURhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1EYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PURhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9RGEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPURhLm9iajFCbGFjazticmVhaztjYXNlIDExMjpkLmJnV2hpdGU9RWEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PUVhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1FYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1FYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPUVhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9RWEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT0KRWEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPUVhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1FYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PUVhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9RWEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPUVhLm9iajFCbGFjazticmVhaztjYXNlIDcwOmQuYmdXaGl0ZT1GYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9RmEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PUZhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPUZhLmJnQmxhY2s7ZC5vYmowV2hpdGU9RmEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1GYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PUZhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1GYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9RmEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1GYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PUZhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1GYS5vYmoxQmxhY2s7YnJlYWs7CmNhc2UgMjExOmQuYmdXaGl0ZT1HYS5iZ1doaXRlLGQuYmdMaWdodEdyZXk9R2EuYmdMaWdodEdyZXksZC5iZ0RhcmtHcmV5PUdhLmJnRGFya0dyZXksZC5iZ0JsYWNrPUdhLmJnQmxhY2ssZC5vYmowV2hpdGU9R2Eub2JqMFdoaXRlLGQub2JqMExpZ2h0R3JleT1HYS5vYmowTGlnaHRHcmV5LGQub2JqMERhcmtHcmV5PUdhLm9iajBEYXJrR3JleSxkLm9iajBCbGFjaz1HYS5vYmowQmxhY2ssZC5vYmoxV2hpdGU9R2Eub2JqMVdoaXRlLGQub2JqMUxpZ2h0R3JleT1HYS5vYmoxTGlnaHRHcmV5LGQub2JqMURhcmtHcmV5PUdhLm9iajFEYXJrR3JleSxkLm9iajFCbGFjaz1HYS5vYmoxQmxhY2t9fWIuR0JDRW5hYmxlZD8oZyg2NTM4NCwxOTIpLGcoNjUzODUsMjU1KSxnKDY1Mzg2LDE5MyksZyg2NTM4NywxMykpOihnKDY1Mzg0LDI1NSksZyg2NTM4NSwyNTUpLGcoNjUzODYsMjU1KSxnKDY1Mzg3LDI1NSkpO2IuQm9vdFJPTUVuYWJsZWQmJmIuR0JDRW5hYmxlZCYmKGcoNjUzODUsMzIpLApnKDY1Mzg3LDEzOCkpO2wuY3VycmVudEN5Y2xlcz0wO2wuTlI1MExlZnRNaXhlclZvbHVtZT0wO2wuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9MDtsLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD0hMDtsLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD0hMDtsLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD0hMDtsLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD0hMDtsLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7bC5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2wuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD0hMDtsLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7bC5OUjUySXNTb3VuZEVuYWJsZWQ9ITA7bC5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPTA7bC5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPTA7bC5mcmFtZVNlcXVlbmNlcj0wO2wuYXVkaW9RdWV1ZUluZGV4PQowO0IuaW5pdGlhbGl6ZSgpO08uaW5pdGlhbGl6ZSgpO0ouaW5pdGlhbGl6ZSgpO1AuaW5pdGlhbGl6ZSgpO2cobC5tZW1vcnlMb2NhdGlvbk5SNTAsMTE5KTtsLnVwZGF0ZU5SNTAoMTE5KTtnKGwubWVtb3J5TG9jYXRpb25OUjUxLDI0Myk7bC51cGRhdGVOUjUxKDI0Myk7ZyhsLm1lbW9yeUxvY2F0aW9uTlI1MiwyNDEpO2wudXBkYXRlTlI1MigyNDEpO2IuQm9vdFJPTUVuYWJsZWQmJihnKGwubWVtb3J5TG9jYXRpb25OUjUwLDApLGwudXBkYXRlTlI1MCgwKSxnKGwubWVtb3J5TG9jYXRpb25OUjUxLDApLGwudXBkYXRlTlI1MSgwKSxnKGwubWVtb3J5TG9jYXRpb25OUjUyLDExMiksbC51cGRhdGVOUjUyKDExMikpO3cuY2hhbm5lbDFTYW1wbGU9MTU7dy5jaGFubmVsMlNhbXBsZT0xNTt3LmNoYW5uZWwzU2FtcGxlPTE1O3cuY2hhbm5lbDRTYW1wbGU9MTU7dy5jaGFubmVsMURhY0VuYWJsZWQ9ITE7dy5jaGFubmVsMkRhY0VuYWJsZWQ9ITE7dy5jaGFubmVsM0RhY0VuYWJsZWQ9ITE7CncuY2hhbm5lbDREYWNFbmFibGVkPSExO3cubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O3cucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzt3Lm1peGVyVm9sdW1lQ2hhbmdlZD0hMDt3Lm1peGVyRW5hYmxlZENoYW5nZWQ9ITA7dy5uZWVkVG9SZW1peFNhbXBsZXM9ITE7bS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKDApO2cobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQsbS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlKTttLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZCgyMjUpO2cobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QsbS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUpO3EuY3VycmVudEN5Y2xlcz0wO3EuZGl2aWRlclJlZ2lzdGVyPTA7cS50aW1lckNvdW50ZXI9MDtxLnRpbWVyTW9kdWxvPTA7cS50aW1lckVuYWJsZWQ9ITE7cS50aW1lcklucHV0Q2xvY2s9MDtxLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITE7cS50aW1lckNvdW50ZXJXYXNSZXNldD0KITE7Yi5HQkNFbmFibGVkPyhnKDY1Mjg0LDMwKSxxLmRpdmlkZXJSZWdpc3Rlcj03ODQwKTooZyg2NTI4NCwxNzEpLHEuZGl2aWRlclJlZ2lzdGVyPTQzOTgwKTtnKDY1Mjg3LDI0OCk7cS50aW1lcklucHV0Q2xvY2s9MjQ4O2IuQm9vdFJPTUVuYWJsZWQmJiFiLkdCQ0VuYWJsZWQmJihnKDY1Mjg0LDApLHEuZGl2aWRlclJlZ2lzdGVyPTQpO1ouY3VycmVudEN5Y2xlcz0wO1oubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQ9MDtiLkdCQ0VuYWJsZWQ/KGcoNjUyODIsMTI0KSxaLnVwZGF0ZVRyYW5zZmVyQ29udHJvbCgxMjQpKTooZyg2NTI4MiwxMjYpLFoudXBkYXRlVHJhbnNmZXJDb250cm9sKDEyNikpO2IuR0JDRW5hYmxlZD8oZyg2NTM5MiwyNDgpLGcoNjUzNTksMjU0KSxnKDY1MzU3LDEyNiksZyg2NTI4MCwyMDcpLGcoNjUyOTUsMjI1KSxnKDY1Mzg4LDI1NCksZyg2NTM5NywxNDMpKTooZyg2NTM5MiwyNTUpLGcoNjUzNTksMjU1KSxnKDY1MzU3LDI1NSksZyg2NTI4MCwyMDcpLGcoNjUyOTUsCjIyNSkpfSxoYXNDb3JlU3RhcnRlZDpmdW5jdGlvbigpe3JldHVybiBqYn0sc2F2ZVN0YXRlOmZ1bmN0aW9uKCl7Yi5zYXZlU3RhdGUoKTtyLnNhdmVTdGF0ZSgpO20uc2F2ZVN0YXRlKCk7Qy5zYXZlU3RhdGUoKTtoLnNhdmVTdGF0ZSgpO3Euc2F2ZVN0YXRlKCk7bC5zYXZlU3RhdGUoKTtCLnNhdmVTdGF0ZSgpO08uc2F2ZVN0YXRlKCk7Si5zYXZlU3RhdGUoKTtQLnNhdmVTdGF0ZSgpO2piPSExfSxsb2FkU3RhdGU6ZnVuY3Rpb24oKXtiLmxvYWRTdGF0ZSgpO3IubG9hZFN0YXRlKCk7bS5sb2FkU3RhdGUoKTtDLmxvYWRTdGF0ZSgpO2gubG9hZFN0YXRlKCk7cS5sb2FkU3RhdGUoKTtsLmxvYWRTdGF0ZSgpO0IubG9hZFN0YXRlKCk7Ty5sb2FkU3RhdGUoKTtKLmxvYWRTdGF0ZSgpO1AubG9hZFN0YXRlKCk7amI9ITE7ZGEuY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O2RhLmN5Y2xlU2V0cz0wO2RhLmN5Y2xlcz0wO1cuc3RlcHNQZXJTdGVwU2V0PTJFOTtXLnN0ZXBTZXRzPTA7Vy5zdGVwcz0KMH0saXNHQkM6ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNFbmFibGVkfSxnZXRTdGVwc1BlclN0ZXBTZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gVy5zdGVwc1BlclN0ZXBTZXR9LGdldFN0ZXBTZXRzOmZ1bmN0aW9uKCl7cmV0dXJuIFcuc3RlcFNldHN9LGdldFN0ZXBzOmZ1bmN0aW9uKCl7cmV0dXJuIFcuc3RlcHN9LGV4ZWN1dGVNdWx0aXBsZUZyYW1lczpmdW5jdGlvbihhKXtmb3IodmFyIGI9MCxkPTA7ZDxhJiYwPD1iOyliPXBjKCksZCs9MTtyZXR1cm4gMD5iP2I6MH0sZXhlY3V0ZUZyYW1lOnBjLGV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW86ZnVuY3Rpb24oYSl7dm9pZCAwPT09YSYmKGE9MCk7cmV0dXJuIFJiKCEwLGEpfSxleGVjdXRlVW50aWxDb25kaXRpb246UmIsZXhlY3V0ZVN0ZXA6cWMsZ2V0Q3ljbGVzUGVyQ3ljbGVTZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gZGEuY3ljbGVzUGVyQ3ljbGVTZXR9LGdldEN5Y2xlU2V0czpmdW5jdGlvbigpe3JldHVybiBkYS5jeWNsZVNldHN9LGdldEN5Y2xlczpmdW5jdGlvbigpe3JldHVybiBkYS5jeWNsZXN9LApzZXRKb3lwYWRTdGF0ZTpmdW5jdGlvbihhLGIsZCxlLGYsZyxoLG4pezA8YT9UYSgwKTpJYSgwLCExKTswPGI/VGEoMSk6SWEoMSwhMSk7MDxkP1RhKDIpOklhKDIsITEpOzA8ZT9UYSgzKTpJYSgzLCExKTswPGY/VGEoNCk6SWEoNCwhMSk7MDxnP1RhKDUpOklhKDUsITEpOzA8aD9UYSg2KTpJYSg2LCExKTswPG4/VGEoNyk6SWEoNywhMSl9LGdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXI6ZWMsY2xlYXJBdWRpb0J1ZmZlcjpmYyxzZXRNYW51YWxDb2xvcml6YXRpb25QYWxldHRlOlpiLFdBU01CT1lfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9NRU1PUllfU0laRTp3YyxXQVNNQk9ZX1dBU01fUEFHRVM6V2IsQVNTRU1CTFlTQ1JJUFRfTUVNT1JZX0xPQ0FUSU9OOjAsQVNTRU1CTFlTQ1JJUFRfTUVNT1JZX1NJWkU6MTAyNCxXQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OOjEwMjQsV0FTTUJPWV9TVEFURV9TSVpFOjEwMjQsR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MjA0OCwKR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTpUYyxWSURFT19SQU1fTE9DQVRJT046MjA0OCxWSURFT19SQU1fU0laRToxNjM4NCxXT1JLX1JBTV9MT0NBVElPTjoxODQzMixXT1JLX1JBTV9TSVpFOjMyNzY4LE9USEVSX0dBTUVCT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjUxMjAwLE9USEVSX0dBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MTYzODQsR1JBUEhJQ1NfT1VUUFVUX0xPQ0FUSU9OOlVjLEdSQVBISUNTX09VVFBVVF9TSVpFOlZjLEdCQ19QQUxFVFRFX0xPQ0FUSU9OOllhLEdCQ19QQUxFVFRFX1NJWkU6MTI4LEJHX1BSSU9SSVRZX01BUF9MT0NBVElPTjpaYSxCR19QUklPUklUWV9NQVBfU0laRToyMzU1MixGUkFNRV9MT0NBVElPTjpjYixGUkFNRV9TSVpFOjkzMTg0LEJBQ0tHUk9VTkRfTUFQX0xPQ0FUSU9OOnpiLEJBQ0tHUk9VTkRfTUFQX1NJWkU6MTk2NjA4LFRJTEVfREFUQV9MT0NBVElPTjpVYixUSUxFX0RBVEFfU0laRToxNDc0NTYsT0FNX1RJTEVTX0xPQ0FUSU9OOkFiLApPQU1fVElMRVNfU0laRToxNTM2MCxBVURJT19CVUZGRVJfTE9DQVRJT046dWIsQVVESU9fQlVGRkVSX1NJWkU6MTMxMDcyLENIQU5ORUxfMV9CVUZGRVJfTE9DQVRJT046RWIsQ0hBTk5FTF8xX0JVRkZFUl9TSVpFOjEzMTA3MixDSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OOkZiLENIQU5ORUxfMl9CVUZGRVJfU0laRToxMzEwNzIsQ0hBTk5FTF8zX0JVRkZFUl9MT0NBVElPTjpHYixDSEFOTkVMXzNfQlVGRkVSX1NJWkU6MTMxMDcyLENIQU5ORUxfNF9CVUZGRVJfTE9DQVRJT046SGIsQ0hBTk5FTF80X0JVRkZFUl9TSVpFOjEzMTA3MixDQVJUUklER0VfUkFNX0xPQ0FUSU9OOk9iLENBUlRSSURHRV9SQU1fU0laRToxMzEwNzIsQk9PVF9ST01fTE9DQVRJT046d2IsQk9PVF9ST01fU0laRToyNTYwLENBUlRSSURHRV9ST01fTE9DQVRJT046eGIsQ0FSVFJJREdFX1JPTV9TSVpFOjgyNTg1NjAsREVCVUdfR0FNRUJPWV9NRU1PUllfTE9DQVRJT046VmIsREVCVUdfR0FNRUJPWV9NRU1PUllfU0laRTo2NTUzNSwKZ2V0V2FzbUJveU9mZnNldEZyb21HYW1lQm95T2Zmc2V0Ok5iLHNldFByb2dyYW1Db3VudGVyQnJlYWtwb2ludDpmdW5jdGlvbihhKXthYS5wcm9ncmFtQ291bnRlcj1hfSxyZXNldFByb2dyYW1Db3VudGVyQnJlYWtwb2ludDpmdW5jdGlvbigpe2FhLnByb2dyYW1Db3VudGVyPS0xfSxzZXRSZWFkR2JNZW1vcnlCcmVha3BvaW50OmZ1bmN0aW9uKGEpe2FhLnJlYWRHYk1lbW9yeT1hfSxyZXNldFJlYWRHYk1lbW9yeUJyZWFrcG9pbnQ6ZnVuY3Rpb24oKXthYS5yZWFkR2JNZW1vcnk9LTF9LHNldFdyaXRlR2JNZW1vcnlCcmVha3BvaW50OmZ1bmN0aW9uKGEpe2FhLndyaXRlR2JNZW1vcnk9YX0scmVzZXRXcml0ZUdiTWVtb3J5QnJlYWtwb2ludDpmdW5jdGlvbigpe2FhLndyaXRlR2JNZW1vcnk9LTF9LGdldFJlZ2lzdGVyQTpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQX0sZ2V0UmVnaXN0ZXJCOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJCfSxnZXRSZWdpc3RlckM6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckN9LApnZXRSZWdpc3RlckQ6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckR9LGdldFJlZ2lzdGVyRTpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRX0sZ2V0UmVnaXN0ZXJIOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJIfSxnZXRSZWdpc3Rlckw6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3Rlckx9LGdldFJlZ2lzdGVyRjpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRn0sZ2V0UHJvZ3JhbUNvdW50ZXI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5wcm9ncmFtQ291bnRlcn0sZ2V0U3RhY2tQb2ludGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIuc3RhY2tQb2ludGVyfSxnZXRPcGNvZGVBdFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIHgoYi5wcm9ncmFtQ291bnRlcil9LGdldExZOmZ1bmN0aW9uKCl7cmV0dXJuIHIuc2NhbmxpbmVSZWdpc3Rlcn0sZHJhd0JhY2tncm91bmRNYXBUb1dhc21NZW1vcnk6ZnVuY3Rpb24oYSl7dmFyIGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0Owp2LmJnV2luZG93VGlsZURhdGFTZWxlY3QmJihjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0KTt2YXIgZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDt2LmJnVGlsZU1hcERpc3BsYXlTZWxlY3QmJihkPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpO2Zvcih2YXIgZz0wOzI1Nj5nO2crKylmb3IodmFyIGY9MDsyNTY+ZjtmKyspe3ZhciBoPWcsbD1mLGs9ZCszMiooaD4+MykrKGw+PjMpLG09WChrLDApO209Z2IoYyxtKTt2YXIgcD1oJTg7aD1sJTg7aD03LWg7bD0wO2IuR0JDRW5hYmxlZCYmMDxhJiYobD1YKGssMSkpO24oNixsKSYmKHA9Ny1wKTt2YXIgcT0wO24oMyxsKSYmKHE9MSk7az1YKG0rMipwLHEpO209WChtKzIqcCsxLHEpO3A9MDtuKGgsbSkmJihwKz0xLHA8PD0xKTtuKGgsaykmJihwKz0xKTttPTMqKDI1NipnK2YpO2IuR0JDRW5hYmxlZCYmMDxhPyhrPXFiKGwmNyxwLCExKSxsPXVhKDAsayksaD0KdWEoMSxrKSxrPXVhKDIsayksbT16YittLGVbbV09bCxlW20rMV09aCxlW20rMl09ayk6KGw9cGIocCxyLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLG09emIrbSxlW20rMF09KGwmMTY3MTE2ODApPj4xNixlW20rMV09KGwmNjUyODApPj44LGVbbSsyXT1sJjI1NSl9fSxkcmF3VGlsZURhdGFUb1dhc21NZW1vcnk6ZnVuY3Rpb24oKXtmb3IodmFyIGE9MDsyMz5hO2ErKylmb3IodmFyIGM9MDszMT5jO2MrKyl7dmFyIGQ9MDsxNTxjJiYoZD0xKTt2YXIgZT1hOzE1PGEmJihlLT0xNSk7ZTw8PTQ7ZT0xNTxjP2UrKGMtMTUpOmUrYzt2YXIgZj1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydDsxNTxhJiYoZj1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQpO2Zvcih2YXIgZz1yLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUsaD0tMSxsPS0xLGs9MDs4Pms7aysrKWZvcih2YXIgbT0wOzU+bTttKyspe3ZhciBwPTQqKDgqCm0raykscT14KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrcCsyKTtlPT09cSYmKHA9eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK3ArMykscT0wLGIuR0JDRW5hYmxlZCYmbigzLHApJiYocT0xKSxxPT09ZCYmKGw9cCxrPTgsbT01LGc9ci5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVPbmUsbig0LGwpJiYoZz1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bykpKX1pZihiLkdCQ0VuYWJsZWQmJjA+bCl7az1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDt2LmJnVGlsZU1hcERpc3BsYXlTZWxlY3QmJihrPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpO209LTE7Zm9yKHA9MDszMj5wO3ArKylmb3IocT0wOzMyPnE7cSsrKXt2YXIgdD1rKzMyKnErcCx1PVgodCwwKTtlPT09dSYmKG09dCxxPXA9MzIpfTA8PW0mJihoPVgobSwxKSl9Zm9yKGs9MDs4Pms7aysrKURiKGUsZixkLDAsNywKayw4KmMsOCphK2ssMjQ4LFViLCExLGcsaCxsKX19LGRyYXdPYW1Ub1dhc21NZW1vcnk6ZnVuY3Rpb24oKXtmb3IodmFyIGE9MDs4PmE7YSsrKWZvcih2YXIgYz0wOzU+YztjKyspe3ZhciBkPTQqKDgqYythKTt4KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCk7eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QrMSk7dmFyIGU9eChyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QrMiksZj0xO3YudGFsbFNwcml0ZVNpemUmJigxPT09ZSUyJiYtLWUsZis9MSk7ZD14KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCszKTt2YXIgZz0wO2IuR0JDRW5hYmxlZCYmbigzLGQpJiYoZz0xKTt2YXIgaD1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZTtuKDQsZCkmJihoPXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvKTtmb3IodmFyIGs9MDtrPGY7aysrKWZvcih2YXIgbD0wOzg+Cmw7bCsrKURiKGUrayxyLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCxnLDAsNyxsLDgqYSwxNipjK2wrOCprLDY0LEFiLCExLGgsLTEsZCl9fSxnZXRESVY6ZnVuY3Rpb24oKXtyZXR1cm4gcS5kaXZpZGVyUmVnaXN0ZXJ9LGdldFRJTUE6ZnVuY3Rpb24oKXtyZXR1cm4gcS50aW1lckNvdW50ZXJ9LGdldFRNQTpmdW5jdGlvbigpe3JldHVybiBxLnRpbWVyTW9kdWxvfSxnZXRUQUM6ZnVuY3Rpb24oKXt2YXIgYT1xLnRpbWVySW5wdXRDbG9jaztxLnRpbWVyRW5hYmxlZCYmKGF8PTQpO3JldHVybiBhfSx1cGRhdGVEZWJ1Z0dCTWVtb3J5OmZ1bmN0aW9uKCl7Zm9yKHZhciBhPTA7NjU1MzU+YTthKyspe3ZhciBiPUxiKGEpO2VbVmIrYV09Yn1hYS5yZWFjaGVkQnJlYWtwb2ludD0hMX19KTtjb25zdCBYYz1hc3luYygpPT4oe2luc3RhbmNlOntleHBvcnRzOldjfSxieXRlTWVtb3J5OmxiLndhc21CeXRlTWVtb3J5LHR5cGU6IlR5cGVTY3JpcHQifSk7bGV0IGtiLHliLAp0YyxrO2s9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9CT09UX1JPTV9MT0NBVElPTjowLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjowLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLApXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTjowLHBhdXNlZDohMCx1cGRhdGVJZDp2b2lkIDAsdGltZVN0YW1wc1VudGlsUmVhZHk6MCxmcHNUaW1lU3RhbXBzOltdLHNwZWVkOjAsZnJhbWVTa2lwQ291bnRlcjowLGN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjooYSk9Pntjb25zdCBiPWViKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSB5LkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8oay5ncmFwaGljc1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLGZiKHhjLmJpbmQodm9pZCAwLGspLGsuZ3JhcGhpY3NXb3JrZXJQb3J0KSk6Ik1FTU9SWSI9PT0KYi5tZXNzYWdlLndvcmtlcklkPyhrLm1lbW9yeVdvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLGZiKEFjLmJpbmQodm9pZCAwLGspLGsubWVtb3J5V29ya2VyUG9ydCkpOiJDT05UUk9MTEVSIj09PWIubWVzc2FnZS53b3JrZXJJZD8oay5jb250cm9sbGVyV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sZmIoemMuYmluZCh2b2lkIDAsayksay5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihrLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sZmIoeWMuYmluZCh2b2lkIDAsayksay5hdWRpb1dvcmtlclBvcnQpKTtlYShNKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgeS5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBYYygpO2sud2FzbUluc3RhbmNlPWEuaW5zdGFuY2U7ay53YXNtQnl0ZU1lbW9yeT1hLmJ5dGVNZW1vcnk7ZWEoTSh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpOwpicmVhaztjYXNlIHkuQ09ORklHOmsud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KGssYi5tZXNzYWdlLmNvbmZpZyk7ay5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zO2VhKE0odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB5LlJFU0VUX0FVRElPX1FVRVVFOmsud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2VhKE0odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB5LlBMQVk6aWYoIWsucGF1c2VkfHwhay53YXNtSW5zdGFuY2V8fCFrLndhc21CeXRlTWVtb3J5KXtlYShNKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTticmVha31rLnBhdXNlZD0hMTtrLmZwc1RpbWVTdGFtcHM9W107U2Ioayk7ay5mcmFtZVNraXBDb3VudGVyPTA7ay5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7ay5vcHRpb25zLmlzR2JjQ29sb3JpemF0aW9uRW5hYmxlZD9rLm9wdGlvbnMuZ2JjQ29sb3JpemF0aW9uUGFsZXR0ZSYmay53YXNtSW5zdGFuY2UuZXhwb3J0cy5zZXRNYW51YWxDb2xvcml6YXRpb25QYWxldHRlKCJ3YXNtYm95Z2IgYnJvd24gcmVkIGRhcmticm93biBncmVlbiBkYXJrZ3JlZW4gaW52ZXJ0ZWQgcGFzdGVsbWl4IG9yYW5nZSB5ZWxsb3cgYmx1ZSBkYXJrYmx1ZSBncmF5c2NhbGUiLnNwbGl0KCIgIikuaW5kZXhPZihrLm9wdGlvbnMuZ2JjQ29sb3JpemF0aW9uUGFsZXR0ZS50b0xvd2VyQ2FzZSgpKSk6Cmsud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0TWFudWFsQ29sb3JpemF0aW9uUGFsZXR0ZSgwKTt1YyhrLDFFMy9rLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ZWEoTSh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHkuUEFVU0U6ay5wYXVzZWQ9ITA7ay51cGRhdGVJZCYmKGNsZWFyVGltZW91dChrLnVwZGF0ZUlkKSxrLnVwZGF0ZUlkPXZvaWQgMCk7ZWEoTSh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHkuUlVOX1dBU01fRVhQT1JUOmE9Yi5tZXNzYWdlLnBhcmFtZXRlcnM/ay53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XS5hcHBseSh2b2lkIDAsYi5tZXNzYWdlLnBhcmFtZXRlcnMpOmsud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0oKTtlYShNKHt0eXBlOnkuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB5LkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPTA7bGV0IGM9Cmsud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoYz1iLm1lc3NhZ2UuZW5kKTthPWsud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxjKS5idWZmZXI7ZWEoTSh7dHlwZTp5LlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCksW2FdKTticmVha31jYXNlIHkuR0VUX1dBU01fQ09OU1RBTlQ6ZWEoTSh7dHlwZTp5LkdFVF9XQVNNX0NPTlNUQU5ULHJlc3BvbnNlOmsud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmNvbnN0YW50XS52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB5LkZPUkNFX09VVFBVVF9GUkFNRTpyYyhrKTticmVhaztjYXNlIHkuU0VUX1NQRUVEOmsuc3BlZWQ9Yi5tZXNzYWdlLnNwZWVkO2suZnBzVGltZVN0YW1wcz1bXTtrLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTYwO1NiKGspO2suZnJhbWVTa2lwQ291bnRlcj0wO2suY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0KMDtrLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTticmVhaztjYXNlIHkuSVNfR0JDOmE9MDxrLndhc21JbnN0YW5jZS5leHBvcnRzLmlzR0JDKCk7ZWEoTSh7dHlwZTp5LklTX0dCQyxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coIlVua25vd24gV2FzbUJveSBXb3JrZXIgbWVzc2FnZToiLGIpfX0sZ2V0RlBTOigpPT4wPGsudGltZVN0YW1wc1VudGlsUmVhZHk/ay5zcGVlZCYmMDxrLnNwZWVkP2sub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKmsuc3BlZWQ6ay5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU6ay5mcHNUaW1lU3RhbXBzP2suZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07ZmIoay5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

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
      }, 1000); // Listen for a message with the same message id to be returned

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
  libWorkerUrl = wasmboyLibTsWorkerUrl;
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

// Functions here are depedent on WasmBoyMemory state.
// Getting started with wasm
// http://webassembly.org/getting-started/js-api/

async function initialize() {
  if (this.initialized) {
    return;
  }

  this.ready = false;
  this.loadedAndStarted = false; // Instantiate our workers

  await this._instantiateWorkers(); // Now tell the wasm module to instantiate wasm

  const response = await this.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.INSTANTIATE_WASM
  });
  this.coreType = response.message.type; // Set up Memory

  await WasmBoyMemory.initialize(this.options.headless, this.options.maxNumberOfAutoSaveStates, this.options.saveStateCallback); // Clear what is currently in memory, then load the cartridge memory

  await WasmBoyMemory.clearMemory();
  this.initialized = true;
} // Finish request for wasm module, and fetch game
// NOTE: **Should bind the wasmboy this here**


function loadROMToWasmBoy(ROM, fetchHeaders) {
  const loadROMAndConfigTask = async () => {
    // Save cartridge RAM if have it
    if (!this.options.headless && WasmBoyMemory.getLoadedCartridgeMemoryState().RAM) {
      await WasmBoyMemory.saveCartridgeRam();
    } // Get our fetch rom object


    const fetchROMObject = await fetchROMAsByteArray(ROM, fetchHeaders);
    await WasmBoyMemory.loadCartridgeRom(fetchROMObject.ROM, fetchROMObject.name); // Load a Boot ROM

    if (this.options.enableBootROMIfAvailable) {
      // Get the cartridge info
      const cartridgeInfo = await WasmBoyMemory.getCartridgeInfo();

      if (cartridgeInfo.CGBFlag) {
        await WasmBoyMemory.loadBootROMIfAvailable(WasmBoyMemory.SUPPORTED_BOOT_ROM_TYPES.GBC);
      } else {
        await WasmBoyMemory.loadBootROMIfAvailable(WasmBoyMemory.SUPPORTED_BOOT_ROM_TYPES.GB);
      }
    } // Save the game that we loaded if we need to reload the game


    this.loadedROM = ROM; // Run our initialization on the core

    await this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.CONFIG,
      config: [WasmBoyMemory.loadedCartridgeMemoryState.BOOT ? 1 : 0, // Loaded Boot Rom
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
    await this.pause();
    await initialize.bind(this)(); // Check if we are running headless

    if (this.options.headless) {
      await loadROMAndConfigTask();
      this.ready = true;

      if (this.options.onReady) {
        this.options.onReady();
      }
    } else {
      // Finally intialize all of our services
      // Initialize our services
      // Except memory, which would already be initialized
      await Promise.all([WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback), WasmBoyAudio.initialize(this.options.updateAudioCallback), WasmBoyController.initialize()]);
      await loadROMAndConfigTask(); // Load the game's cartridge ram

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
    this.initialized = false;
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
  } // Finish request for wasm module, and fetch boot ROM


  addBootROM(type, file, fetchHeaders, additionalInfo) {
    return WasmBoyMemory.addBootROM(type, file, fetchHeaders, additionalInfo);
  }

  getBootROMs() {
    return WasmBoyMemory.getBootROMs();
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
      enableBootROMIfAvailable: true,
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
var version = "0.3.6";
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
  addBootROM: WasmBoyLib.addBootROM.bind(WasmBoyLib),
  getBootROMs: WasmBoyLib.getBootROMs.bind(WasmBoyLib),
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
//# sourceMappingURL=wasmboy.ts.cjs.js.map
