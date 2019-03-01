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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBKKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX0xPQ0FUSU9OLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBLKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkFVRElPX0xBVEVOQ1k6YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQpiLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gTChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gQShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTisKZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQihhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIE0oYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhaztjYXNlIGYuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfQk9PVF9ST01fTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JBTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfTE9DQVRJT04udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlNFVF9NRU1PUlk6ZD1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2QuaW5jbHVkZXMoZy5CT09UX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkJPT1RfUk9NXSksYS5XQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSxhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9SQU0pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUkFNXSksYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuR0FNRUJPWV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5HQU1FQk9ZX01FTU9SWV0pLAphLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OKSxhLndhc21JbnN0YW5jZS5leHBvcnRzLmxvYWRTdGF0ZSgpKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLlNFVF9NRU1PUllfRE9ORX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX01FTU9SWTp7ZD17dHlwZTpmLkdFVF9NRU1PUll9O2NvbnN0IGw9W107dmFyIGM9Yi5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKGMuaW5jbHVkZXMoZy5CT09UX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX0xPQ0FUSU9OLnZhbHVlT2YoKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlK2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fU0laRS52YWx1ZU9mKCkpfWVsc2UgZT1uZXcgVWludDhBcnJheTtlPWUuYnVmZmVyO2RbZy5CT09UX1JPTV09ZTtsLnB1c2goZSl9aWYoYy5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXtlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD1lJiYzPj1lP209MjA5NzE1Mjo1PD1lJiY2Pj1lP209MjYyMTQ0OjE1PD1lJiYxOT49ZT9tPTIwOTcxNTI6MjU8PWUmJjMwPj1lJiYobT04Mzg4NjA4KTtlPW0/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTittKToKbmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGU9QShhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmRbZy5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9QihhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT1jLGwucHVzaChjKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCxiLm1lc3NhZ2VJZCksbCl9fX1mdW5jdGlvbiBOKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpOwphLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB3KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEMoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gRChhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUUtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0YoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEYoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRT1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksRChhKSwhMDtOKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZDtjP3goYSxiKTooZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLApiKGQpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEMoYSk7Y29uc3QgZD17dHlwZTpmLlVQREFURUR9O2RbZy5DQVJUUklER0VfUkFNXT1BKGEpLmJ1ZmZlcjtkW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5JTlRFUk5BTF9TVEFURV09QihhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChkKSxbZFtnLkNBUlRSSURHRV9SQU1dLGRbZy5HQU1FQk9ZX01FTU9SWV0sZFtnLlBBTEVUVEVfTUVNT1JZXSxkW2cuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/ayhoKHt0eXBlOmYuQlJFQUtQT0lOVH0pKTpEKGEpfWVsc2UgayhoKHt0eXBlOmYuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHgoYSxiKXt2YXIgZD0tMTtkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbygxMDI0KTsxIT09ZCYmYihkKTtpZigxPT09ZCl7ZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXIoKTsKY29uc3QgYz1yPj11Oy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmM/KEcoYSxkKSxzZXRUaW1lb3V0KCgpPT57dyhhKTt4KGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooRyhhLGQpLHgoYSxiKSl9fWZ1bmN0aW9uIEcoYSxiKXt2YXIgZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjb25zdCBjPXt0eXBlOmYuVVBEQVRFRCxhdWRpb0J1ZmZlcjpkLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX07ZD1bZF07aWYoYS5vcHRpb25zJiZhLm9wdGlvbnMuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDFCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDJCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDNCdWZmZXI9ZTtkLnB1c2goZSk7Yj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDRCdWZmZXI9YjtkLnB1c2goYil9YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChjKSwKZCk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCl9Y29uc3QgcD0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCB2O3B8fCh2PXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgZj17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLApVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQiLEZPUkNFX09VVFBVVF9GUkFNRToiRk9SQ0VfT1VUUFVUX0ZSQU1FIixTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSxnPXtCT09UX1JPTToiQk9PVF9ST00iLENBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTsKbGV0IHQ9MCx5PXt9O2NvbnN0IEg9KGEsYik9PntsZXQgYz0iW1dhc21Cb3ldIjstOTk5OSE9PWEmJihjKz1gIDB4JHthLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1iJiYoYys9YCAweCR7Yi50b1N0cmluZygxNil9IGApO2NvbnNvbGUubG9nKGMpfSx6PXtpbmRleDp7Y29uc29sZUxvZzpILGNvbnNvbGVMb2dUaW1lb3V0OihhLGIsYyk9Pnt5W2FdfHwoeVthXT0hMCxIKGEsYiksc2V0VGltZW91dCgoKT0+e2RlbGV0ZSB5W2FdfSxjKSl9fX0sST1hc3luYyhhKT0+e2xldCBiPXZvaWQgMDtyZXR1cm4gYj1XZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZz9hd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZyhmZXRjaChhKSx6KTphd2FpdCAoYXN5bmMoKT0+e2NvbnN0IGI9YXdhaXQgZmV0Y2goYSkudGhlbigoYSk9PmEuYXJyYXlCdWZmZXIoKSk7cmV0dXJuIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGIseil9KSgpfSxPPWFzeW5jKGEpPT57YT1CdWZmZXIuZnJvbShhLnNwbGl0KCIsIilbMV0sCiJiYXNlNjQiKTtyZXR1cm4gYXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYSx6KX0sUD1hc3luYyhhKT0+e2E9KGE/YXdhaXQgSSgiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJpd0VTWUFBQVlBcC9mMzkvZjM5L2YzOS9BR0FCZndGL1lBRi9BR0FDZjM4QVlBSi9md0YvWUFBQmYyQURmMzkvQUdBR2YzOS9mMzkvQUdBSGYzOS9mMzkvZndGL1lBTi9mMzhCZjJBSGYzOS9mMzkvZndCZ0JIOS9mMzhCZjJBSWYzOS9mMzkvZjM4QVlBVi9mMzkvZndGL1lBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0FuOS9BR0FCZndGL0E5NEIzQUVBQWdJQUJBQUFBd01BQUFBQUFBQUFBd0FBQXdNQUFBQUFBUVlBQUFBQUFBQUFBQU1EQUFBQUFBQUFBQUFHQmdZR0RnVUtCUThKQ3dnSUJ3UURBQUFEQUFBQUFBQURBQUFBQUFBQ0FnVUNBZ0lDQlF3REF3TUFBZ1lDQWdRREF3TURBQUFBQUFVREJnWURCQUlGQXdBQUF3VUVCd0FGQUFNQUF3TUdCZ1FRQXdRREF3TUVCQWNDQWdJQ0FnSUNBZ0lFQXdNQ0F3TUNBd01DQXdNQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJREJnWUdFUVlDQmdZR0FnUURBdzBEQUFNQUF3QUdCZ1lHQmdZR0JnWUdCZ1lEQUFBR0JnWUdBQUFBQWdNRkJBUUJjQUFCQlFNQkFBQUdtQXlmQW44QVFRQUxmd0JCZ0FnTGZ3QkJnQWdMZndCQmdBZ0xmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FFQXQvQUVHQWdBUUxmd0JCZ0pBRUMzOEFRWUFCQzM4QVFZQ1JCQXQvQUVHQXVBRUxmd0JCZ01rRkMzOEFRWURZQlF0L0FFR0FvUXNMZndCQmdJQU1DMzhBUVlDaEZ3dC9BRUdBZ0FrTGZ3QkJnS0VnQzM4QVFZRDRBQXQvQUVHQWtBUUxmd0JCZ0lrZEMzOEFRWUNaSVF0L0FFR0FnQWdMZndCQmdKa3BDMzhBUVlDQUNBdC9BRUdBbVRFTGZ3QkJnSUFJQzM4QVFZQ1pPUXQvQUVHQWdBZ0xmd0JCZ0puQkFBdC9BRUdBZ0FnTGZ3QkJnSm5KQUF0L0FFR0FnQWdMZndCQmdKblJBQXQvQUVHQUZBdC9BRUdBcmRFQUMzOEFRWUNJK0FNTGZ3QkJnTFhKQkF0L0FFSC8vd01MZndCQkFBdC9BRUdBdGMwRUMzOEFRWlFCQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkI2UDREQzM4QlFlbitBd3QvQVVIci9nTUxmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWY4QUMzOEJRZjhBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUdBOXdJTGZ3RkJBQXQvQVVFQUMzOEJRWUNBQ0F0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRWDhMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQjBmNERDMzhCUWRMK0F3dC9BVUhUL2dNTGZ3RkIxUDREQzM4QlFkWCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCei80REMzOEJRZkQrQXd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJnS2pXdVFjTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVDQzM4QlFRQUxmd0ZCQUFzSHV4QmhCbTFsYlc5eWVRSUFCWFJoWW14bEFRQUdZMjl1Wm1sbkFCa09hR0Z6UTI5eVpWTjBZWEowWldRQUdnbHpZWFpsVTNSaGRHVUFJUWxzYjJGa1UzUmhkR1VBTEFWcGMwZENRd0F0RW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFBdUMyZGxkRk4wWlhCVFpYUnpBQzhJWjJWMFUzUmxjSE1BTUJWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUF0QUVNWlhobFkzVjBaVVp5WVcxbEFMTUJDRjl6WlhSaGNtZGpBTm9CR1dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzhBMlFFVlpYaGxZM1YwWlZWdWRHbHNRMjl1WkdsMGFXOXVBTnNCQzJWNFpXTjFkR1ZUZEdWd0FMQUJGR2RsZEVONVkyeGxjMUJsY2tONVkyeGxVMlYwQUxVQkRHZGxkRU41WTJ4bFUyVjBjd0MyQVFsblpYUkRlV05zWlhNQXR3RU9jMlYwU205NWNHRmtVM1JoZEdVQXZBRWZaMlYwVG5WdFltVnlUMlpUWVcxd2JHVnpTVzVCZFdScGIwSjFabVpsY2dDeEFSQmpiR1ZoY2tGMVpHbHZRblZtWm1WeUFDZ2NjMlYwVFdGdWRXRnNRMjlzYjNKcGVtRjBhVzl1VUdGc1pYUjBaUUFIRjFkQlUwMUNUMWxmVFVWTlQxSlpYMHhQUTBGVVNVOU9BeXdUVjBGVFRVSlBXVjlOUlUxUFVsbGZVMGxhUlFNdEVsZEJVMDFDVDFsZlYwRlRUVjlRUVVkRlV3TXVIa0ZUVTBWTlFreFpVME5TU1ZCVVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNQUdrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlUU1ZwRkF3RVdWMEZUVFVKUFdWOVRWRUZVUlY5TVQwTkJWRWxQVGdNQ0VsZEJVMDFDVDFsZlUxUkJWRVZmVTBsYVJRTURJRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3b2NSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1MRWxaSlJFVlBYMUpCVFY5TVQwTkJWRWxQVGdNRURsWkpSRVZQWDFKQlRWOVRTVnBGQXdVUlYwOVNTMTlTUVUxZlRFOURRVlJKVDA0REJnMVhUMUpMWDFKQlRWOVRTVnBGQXdjbVQxUklSVkpmUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNERDQ0pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2tZUjFKQlVFaEpRMU5mVDFWVVVGVlVYMHhQUTBGVVNVOU9BeGdVUjFKQlVFaEpRMU5mVDFWVVVGVlVYMU5KV2tVREdSUkhRa05mVUVGTVJWUlVSVjlNVDBOQlZFbFBUZ01NRUVkQ1ExOVFRVXhGVkZSRlgxTkpXa1VERFJoQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVEU5RFFWUkpUMDRERGhSQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVTBsYVJRTVBEa1pTUVUxRlgweFBRMEZVU1U5T0F4QUtSbEpCVFVWZlUwbGFSUU1SRjBKQlEwdEhVazlWVGtSZlRVRlFYMHhQUTBGVVNVOU9BeElUUWtGRFMwZFNUMVZPUkY5TlFWQmZVMGxhUlFNVEVsUkpURVZmUkVGVVFWOU1UME5CVkVsUFRnTVVEbFJKVEVWZlJFRlVRVjlUU1ZwRkF4VVNUMEZOWDFSSlRFVlRYMHhQUTBGVVNVOU9BeFlPVDBGTlgxUkpURVZUWDFOSldrVURGeFZCVlVSSlQxOUNWVVpHUlZKZlRFOURRVlJKVDA0REloRkJWVVJKVDE5Q1ZVWkdSVkpmVTBsYVJRTWpHVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZURTlEUVZSSlQwNERHaFZEU0VGT1RrVk1YekZmUWxWR1JrVlNYMU5KV2tVREd4bERTRUZPVGtWTVh6SmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4d1ZRMGhCVGs1RlRGOHlYMEpWUmtaRlVsOVRTVnBGQXgwWlEwaEJUazVGVEY4elgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZUZVTklRVTVPUlV4Zk0xOUNWVVpHUlZKZlUwbGFSUU1mR1VOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESUJWRFNFRk9Ua1ZNWHpSZlFsVkdSa1ZTWDFOSldrVURJUlpEUVZKVVVrbEVSMFZmVWtGTlgweFBRMEZVU1U5T0F5UVNRMEZTVkZKSlJFZEZYMUpCVFY5VFNWcEZBeVVSUWs5UFZGOVNUMDFmVEU5RFFWUkpUMDRESmcxQ1QwOVVYMUpQVFY5VFNWcEZBeWNXUTBGU1ZGSkpSRWRGWDFKUFRWOU1UME5CVkVsUFRnTW9Fa05CVWxSU1NVUkhSVjlTVDAxZlUwbGFSUU1wSFVSRlFsVkhYMGRCVFVWQ1QxbGZUVVZOVDFKWlgweFBRMEZVU1U5T0F5b1pSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVTBsYVJRTXJJV2RsZEZkaGMyMUNiM2xQWm1aelpYUkdjbTl0UjJGdFpVSnZlVTltWm5ObGRBQUJHM05sZEZCeWIyZHlZVzFEYjNWdWRHVnlRbkpsWVd0d2IybHVkQUM5QVIxeVpYTmxkRkJ5YjJkeVlXMURiM1Z1ZEdWeVFuSmxZV3R3YjJsdWRBQytBUmx6WlhSU1pXRmtSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBTDhCRzNKbGMyVjBVbVZoWkVkaVRXVnRiM0o1UW5KbFlXdHdiMmx1ZEFEQUFScHpaWFJYY21sMFpVZGlUV1Z0YjNKNVFuSmxZV3R3YjJsdWRBREJBUnh5WlhObGRGZHlhWFJsUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQU1JQkRHZGxkRkpsWjJsemRHVnlRUUREQVF4blpYUlNaV2RwYzNSbGNrSUF4QUVNWjJWMFVtVm5hWE4wWlhKREFNVUJER2RsZEZKbFoybHpkR1Z5UkFER0FReG5aWFJTWldkcGMzUmxja1VBeHdFTVoyVjBVbVZuYVhOMFpYSklBTWdCREdkbGRGSmxaMmx6ZEdWeVRBREpBUXhuWlhSU1pXZHBjM1JsY2tZQXlnRVJaMlYwVUhKdlozSmhiVU52ZFc1MFpYSUF5d0VQWjJWMFUzUmhZMnRRYjJsdWRHVnlBTXdCR1dkbGRFOXdZMjlrWlVGMFVISnZaM0poYlVOdmRXNTBaWElBelFFRloyVjBURmtBemdFZFpISmhkMEpoWTJ0bmNtOTFibVJOWVhCVWIxZGhjMjFOWlcxdmNua0F6d0VZWkhKaGQxUnBiR1ZFWVhSaFZHOVhZWE50VFdWdGIzSjVBTkFCRTJSeVlYZFBZVzFVYjFkaGMyMU5aVzF2Y25rQTBRRUdaMlYwUkVsV0FOSUJCMmRsZEZSSlRVRUEwd0VHWjJWMFZFMUJBTlFCQm1kbGRGUkJRd0RWQVJOMWNHUmhkR1ZFWldKMVowZENUV1Z0YjNKNUFOWUJDQUxYQVFrSUFRQkJBQXNCMkFFSzcrY0IzQUZUQUVIeTVjc0hKRGxCb01HQ0JTUTZRZGl3NFFJa08wR0lrQ0FrUEVIeTVjc0hKRDFCb01HQ0JTUStRZGl3NFFJa1AwR0lrQ0FrUUVIeTVjc0hKRUZCb01HQ0JTUkNRZGl3NFFJa1EwR0lrQ0FrUkF1YkFnRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVNZFNJQkJFQWdBVUVCYXc0TkFRRUJBZ0lDQWdNREJBUUZCZ2NMSTRJQ0JFQWpnd0lFUUNBQVFZQUNTQTBKSUFCQi93TktJZ0VFZnlBQVFZQVNTQVVnQVFzTkNRVWpnd0pGSWdFRWZ5QUFRWUFDU0FVZ0FRc05DUXNMQ3lBQVFZQ3QwUUJxRHdzZ0FFRUJJKzBCSWdFajlRRkZJZ0FFZnlBQlJRVWdBQXNiUVE1MGFrR0FyZEFBYWc4TElBQkJnSkIrYWlPREFnUi9JNEFDRUFKQkFYRUZRUUFMUVExMGFnOExJQUFqN2dGQkRYUnFRWURaeGdCcUR3c2dBRUdBa0g1cUR3dEJBQ0VCQW44amd3SUVRQ09CQWhBQ1FRZHhJUUVMSUFGQkFVZ0xCSDlCQVFVZ0FRdEJESFFnQUdwQmdQQjlhZzhMSUFCQmdGQnFEd3NnQUVHQW1kRUFhZ3NKQUNBQUVBRXRBQUFMd3dFQVFRQWtoQUpCQUNTRkFrRUFKSVlDUVFBa2h3SkJBQ1NJQWtFQUpJa0NRUUFraWdKQkFDU0xBa0VBSkl3Q1FRQWtqUUpCQUNTT0FrRUFKSThDUVFBa2tBSkJBQ1NSQWtFQUpKSUNRUUFra3dJamdnSUVRQThMSTRNQ0JFQkJFU1NGQWtHQUFTU01Ba0VBSklZQ1FRQWtod0pCL3dFa2lBSkIxZ0FraVFKQkFDU0tBa0VOSklzQ0JVRUJKSVVDUWJBQkpJd0NRUUFraGdKQkV5U0hBa0VBSklnQ1FkZ0JKSWtDUVFFa2lnSkJ6UUFraXdJTFFZQUNKSTRDUWY3L0F5U05BZ3NMQUNBQUVBRWdBVG9BQUF1SkFRRUNmMEVBSk84QlFRRWs4QUZCeHdJUUFpSUJSU1R4QVNBQlFRRk9JZ0FFUUNBQlFRTk1JUUFMSUFBazhnRWdBVUVGVGlJQUJFQWdBVUVHVENFQUN5QUFKUE1CSUFGQkQwNGlBQVJBSUFGQkUwd2hBQXNnQUNUMEFTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQWs5UUZCQVNUdEFVRUFKTzRCSTRBQ1FRQVFCQ09CQWtFQkVBUUxMd0JCMGY0RFFmOEJFQVJCMHY0RFFmOEJFQVJCMC80RFFmOEJFQVJCMVA0RFFmOEJFQVJCMWY0RFFmOEJFQVFMdEFnQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ3NEQkFVR0J3Z0pDZ3NNRFFBTERBMExRZkxseXdja09VR2d3WUlGSkRwQjJMRGhBaVE3UVlpUUlDUThRZkxseXdja1BVR2d3WUlGSkQ1QjJMRGhBaVEvUVlpUUlDUkFRZkxseXdja1FVR2d3WUlGSkVKQjJMRGhBaVJEUVlpUUlDUkVEQXdMUWYvLy93Y2tPVUhqMnY0SEpEcEJnT0tRQkNRN1FRQWtQRUgvLy84SEpEMUI0OXIrQnlRK1FZRGlrQVFrUDBFQUpFQkIvLy8vQnlSQlFlUGEvZ2NrUWtHQTRwQUVKRU5CQUNSRURBc0xRZi8vL3dja09VR0VpZjRISkRwQnV2VFFCQ1E3UVFBa1BFSC8vLzhISkQxQnNmN3ZBeVErUVlDSUFpUS9RUUFrUUVILy8vOEhKRUZCLzh1T0F5UkNRZjhCSkVOQkFDUkVEQW9MUWNYTi93Y2tPVUdFdWJvR0pEcEJxZGFSQkNRN1FZamk2QUlrUEVILy8vOEhKRDFCNDlyK0J5UStRWURpa0FRa1AwRUFKRUJCLy8vL0J5UkJRZVBhL2dja1FrR0E0cEFFSkVOQkFDUkVEQWtMUWYvLy93Y2tPVUdBL3NzQ0pEcEJnSVQ5QnlRN1FRQWtQRUgvLy84SEpEMUJnUDdMQWlRK1FZQ0UvUWNrUDBFQUpFQkIvLy8vQnlSQlFZRCt5d0lrUWtHQWhQMEhKRU5CQUNSRURBZ0xRZi8vL3dja09VR3gvdThESkRwQnhjY0JKRHRCQUNROFFmLy8vd2NrUFVHRWlmNEhKRDVCdXZUUUJDUS9RUUFrUUVILy8vOEhKRUZCaEluK0J5UkNRYnIwMEFRa1EwRUFKRVFNQnd0QkFDUTVRWVNKQWlRNlFZQzgvd2NrTzBILy8vOEhKRHhCQUNROVFZU0pBaVErUVlDOC93Y2tQMEgvLy84SEpFQkJBQ1JCUVlTSkFpUkNRWUM4L3dja1EwSC8vLzhISkVRTUJndEJwZi8vQnlRNVFaU3AvZ2NrT2tIL3FkSUVKRHRCQUNROFFhWC8vd2NrUFVHVXFmNEhKRDVCLzZuU0JDUS9RUUFrUUVHbC8vOEhKRUZCbEtuK0J5UkNRZitwMGdRa1EwRUFKRVFNQlF0Qi8vLy9CeVE1UVlEKy93Y2tPa0dBZ1B3SEpEdEJBQ1E4UWYvLy93Y2tQVUdBL3Y4SEpENUJnSUQ4QnlRL1FRQWtRRUgvLy84SEpFRkJnUDcvQnlSQ1FZQ0EvQWNrUTBFQUpFUU1CQXRCLy8vL0J5UTVRWUQrL3dja09rR0FsTzBESkR0QkFDUThRZi8vL3dja1BVSC95NDRESkQ1Qi93RWtQMEVBSkVCQi8vLy9CeVJCUWJIKzd3TWtRa0dBaUFJa1EwRUFKRVFNQXd0Qi8vLy9CeVE1UWYvTGpnTWtPa0gvQVNRN1FRQWtQRUgvLy84SEpEMUJoSW4rQnlRK1FicjAwQVFrUDBFQUpFQkIvLy8vQnlSQlFiSCs3d01rUWtHQWlBSWtRMEVBSkVRTUFndEIvLy8vQnlRNVFkNlpzZ1FrT2tHTXBja0NKRHRCQUNROFFmLy8vd2NrUFVHRWlmNEhKRDVCdXZUUUJDUS9RUUFrUUVILy8vOEhKRUZCNDlyK0J5UkNRWURpa0FRa1EwRUFKRVFNQVF0Qi8vLy9CeVE1UWFYTGxnVWtPa0hTcE1rQ0pEdEJBQ1E4UWYvLy93Y2tQVUdseTVZRkpENUIwcVRKQWlRL1FRQWtRRUgvLy84SEpFRkJwY3VXQlNSQ1FkS2t5UUlrUTBFQUpFUUxDOTRJQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmlBRkhCRUFnQUNJQlFlRUFSZzBCSUFGQkZFWU5BaUFCUWNZQVJnMERJQUZCMlFCR0RRUWdBVUhHQVVZTkJDQUJRWVlCUmcwRklBRkJxQUZHRFFVZ0FVRy9BVVlOQmlBQlFjNEJSZzBHSUFGQjBRRkdEUVlnQVVId0FVWU5CaUFCUVNkR0RRY2dBVUhKQUVZTkJ5QUJRZHdBUmcwSElBRkJzd0ZHRFFjZ0FVSEpBVVlOQ0NBQlFmQUFSZzBKSUFGQnhnQkdEUW9nQVVIVEFVWU5Dd3dNQzBIL3VaWUZKRGxCZ1A3L0J5UTZRWURHQVNRN1FRQWtQRUgvdVpZRkpEMUJnUDcvQnlRK1FZREdBU1EvUVFBa1FFSC91WllGSkVGQmdQNy9CeVJDUVlER0FTUkRRUUFrUkF3TEMwSC8vLzhISkRsQi84dU9BeVE2UWY4QkpEdEJBQ1E4UWYvLy93Y2tQVUdFaWY0SEpENUJ1dlRRQkNRL1FRQWtRRUgvLy84SEpFRkIvOHVPQXlSQ1FmOEJKRU5CQUNSRURBb0xRZi8vL3dja09VR0VpZjRISkRwQnV2VFFCQ1E3UVFBa1BFSC8vLzhISkQxQnNmN3ZBeVErUVlDSUFpUS9RUUFrUUVILy8vOEhKRUZCaEluK0J5UkNRYnIwMEFRa1EwRUFKRVFNQ1F0Qi8rdldCU1E1UVpULy93Y2tPa0hDdExVRkpEdEJBQ1E4UVFBa1BVSC8vLzhISkQ1QmhJbitCeVEvUWJyMDBBUWtRRUVBSkVGQi8vLy9CeVJDUVlTSi9nY2tRMEc2OU5BRUpFUU1DQXRCLy8vL0J5UTVRWVRidGdVa09rSDc1b2tDSkR0QkFDUThRZi8vL3dja1BVR0E1djBISkQ1QmdJVFJCQ1EvUVFBa1FFSC8vLzhISkVGQi8vdnFBaVJDUVlDQS9BY2tRMEgvQVNSRURBY0xRWnovL3dja09VSC82OUlFSkRwQjg2aU9BeVE3UWJyMEFDUThRY0tLL3dja1BVR0FyUDhISkQ1QmdQVFFCQ1EvUVlDQXFBSWtRRUgvLy84SEpFRkJoSW4rQnlSQ1FicjAwQVFrUTBFQUpFUU1CZ3RCZ1A2dkF5UTVRZi8vL3dja09rSEtwUDBISkR0QkFDUThRZi8vL3dja1BVSC8vLzhISkQ1Qi84dU9BeVEvUWY4QkpFQkIvLy8vQnlSQlFlUGEvZ2NrUWtHQTRwQUVKRU5CQUNSRURBVUxRZis1bGdVa09VR0EvdjhISkRwQmdNWUJKRHRCQUNROFFkTEcvUWNrUFVHQWdOZ0dKRDVCZ0lDTUF5US9RUUFrUUVIL0FTUkJRZi8vL3dja1FrSDcvdjhISkVOQi80a0NKRVFNQkF0Qnp2Ly9CeVE1UWUvZmp3TWtPa0d4aVBJRUpEdEIyclRwQWlROFFmLy8vd2NrUFVHQTV2MEhKRDVCZ0lUUkJDUS9RUUFrUUVILy8vOEhKRUZCLzh1T0F5UkNRZjhCSkVOQkFDUkVEQU1MUWYvLy93Y2tPVUdFaWY0SEpEcEJ1dlRRQkNRN1FRQWtQRUgvLy84SEpEMUJnUDRESkQ1QmdJakdBU1EvUVlDVUFTUkFRZi8vL3dja1FVSC95NDRESkVKQi93RWtRMEVBSkVRTUFndEIvLy8vQnlRNVFmL0xqZ01rT2tIL0FTUTdRUUFrUEVHQS92OEhKRDFCZ0lEOEJ5UStRWUNBakFNa1AwRUFKRUJCLy8vL0J5UkJRYkgrN3dNa1FrR0FpQUlrUTBFQUpFUU1BUXRCLy8vL0J5UTVRWVRidGdVa09rSDc1b2tDSkR0QkFDUThRZi8vL3dja1BVSGoydjRISkQ1QjQ5citCeVEvUVFBa1FFSC8vLzhISkVGQi84dU9BeVJDUWY4QkpFTkJBQ1JFQ3d0S0FRSi9RUUFRQnlPREFnUkFEd3NqZ2dJRVFDT0RBa1VFUUE4TEMwRzBBaUVBQTBBQ1FDQUFRY01DU2cwQUlBQVFBaUFCYWlFQklBQkJBV29oQUF3QkN3c2dBVUgvQVhFUUNBdmNBUUJCQUNUbUFVRUFKT2NCUVFBazZBRkJBQ1RwQVVFQUpPb0JRUUFrNndGQkFDVHNBVUdRQVNUb0FTT0RBZ1JBUWNIK0EwR0JBUkFFUWNUK0EwR1FBUkFFUWNmK0EwSDhBUkFFQlVIQi9nTkJoUUVRQkVIRy9nTkIvd0VRQkVISC9nTkIvQUVRQkVISS9nTkIvd0VRQkVISi9nTkIvd0VRQkF0QmtBRWs2QUZCd1A0RFFaQUJFQVJCei80RFFRQVFCRUh3L2dOQkFSQUVJNElDQkVBamd3SUVRRUVBSk9nQlFjRCtBMEVBRUFSQndmNERRWUFCRUFSQnhQNERRUUFRQkFWQkFDVG9BVUhBL2dOQkFCQUVRY0grQTBHRUFSQUVDd3NRQ1F0dUFDT0RBZ1JBUWVqK0EwSEFBUkFFUWVuK0EwSC9BUkFFUWVyK0EwSEJBUkFFUWV2K0EwRU5FQVFGUWVqK0EwSC9BUkFFUWVuK0EwSC9BUkFFUWVyK0EwSC9BUkFFUWV2K0EwSC9BUkFFQ3lPREFpT0NBaU9DQWhzRVFFSHAvZ05CSUJBRVFlditBMEdLQVJBRUN3dFdBRUdRL2dOQmdBRVFCRUdSL2dOQnZ3RVFCRUdTL2dOQjh3RVFCRUdUL2dOQndRRVFCRUdVL2dOQnZ3RVFCQ09DQWdSQVFaSCtBMEUvRUFSQmt2NERRUUFRQkVHVC9nTkJBQkFFUVpUK0EwRzRBUkFFQ3dzc0FFR1YvZ05CL3dFUUJFR1cvZ05CUHhBRVFaZitBMEVBRUFSQm1QNERRUUFRQkVHWi9nTkJ1QUVRQkFzekFFR2EvZ05CL3dBUUJFR2IvZ05CL3dFUUJFR2MvZ05CbndFUUJFR2QvZ05CQUJBRVFaNytBMEc0QVJBRVFRRWtnUUVMTFFCQm4vNERRZjhCRUFSQm9QNERRZjhCRUFSQm9mNERRUUFRQkVHaS9nTkJBQkFFUWFQK0EwRy9BUkFFQzF3QUlBQkJnQUZ4UVFCSEpLWUJJQUJCd0FCeFFRQkhKS1VCSUFCQklIRkJBRWNrcEFFZ0FFRVFjVUVBUnlTakFTQUFRUWh4UVFCSEpLb0JJQUJCQkhGQkFFY2txUUVnQUVFQ2NVRUFSeVNvQVNBQVFRRnhRUUJISktjQkMwVUFRUThra3dGQkR5U1VBVUVQSkpVQlFROGtsZ0ZCQUNTWEFVRUFKSmdCUVFBa21RRkJBQ1NhQVVIL0FDU2JBVUgvQUNTY0FVRUJKSjBCUVFFa25nRkJBQ1NmQVF1OUFRQkJBQ1NnQVVFQUpLRUJRUUFrb2dGQkFTU2pBVUVCSktRQlFRRWtwUUZCQVNTbUFVRUJKS2NCUVFFa3FBRkJBU1NwQVVFQkpLb0JRUUVrcXdGQkFDU3NBVUVBSkswQlFRQWtyd0ZCQUNTd0FSQU1FQTBRRGhBUFFhVCtBMEgzQUJBRVFRY2tvUUZCQnlTaUFVR2wvZ05COHdFUUJFSHpBUkFRUWFiK0EwSHhBUkFFUVFFa3F3RWpnZ0lFUUVHay9nTkJBQkFFUVFBa29RRkJBQ1NpQVVHbC9nTkJBQkFFUVFBUUVFR20vZ05COEFBUUJFRUFKS3NCQ3hBUkN6NEFJQUJCQVhGQkFFY2t0UUVnQUVFQ2NVRUFSeVMyQVNBQVFRUnhRUUJISkxjQklBQkJDSEZCQUVja3VBRWdBRUVRY1VFQVJ5UzVBU0FBSkxRQkN6NEFJQUJCQVhGQkFFY2t1d0VnQUVFQ2NVRUFSeVM4QVNBQVFRUnhRUUJISkwwQklBQkJDSEZCQUVja3ZnRWdBRUVRY1VFQVJ5Uy9BU0FBSkxvQkMzZ0FRUUFrd0FGQkFDVEJBVUVBSk1JQlFRQWt4UUZCQUNUR0FVRUFKTWNCUVFBa3d3RkJBQ1RFQVNPREFnUkFRWVQrQTBFZUVBUkJvRDBrd1FFRlFZVCtBMEdyQVJBRVFjelhBaVRCQVF0QmgvNERRZmdCRUFSQitBRWt4d0VqZ2dJRVFDT0RBa1VFUUVHRS9nTkJBQkFFUVFRa3dRRUxDd3REQUVFQUpNZ0JRUUFreVFFamd3SUVRRUdDL2dOQi9BQVFCRUVBSk1vQlFRQWt5d0ZCQUNUTUFRVkJndjREUWY0QUVBUkJBQ1RLQVVFQkpNc0JRUUFrekFFTEMzVUFJNE1DQkVCQjhQNERRZmdCRUFSQnovNERRZjRCRUFSQnpmNERRZjRBRUFSQmdQNERRYzhCRUFSQmovNERRZUVCRUFSQjdQNERRZjRCRUFSQjlmNERRWThCRUFRRlFmRCtBMEgvQVJBRVFjLytBMEgvQVJBRVFjMytBMEgvQVJBRVFZRCtBMEhQQVJBRVFZLytBMEhoQVJBRUN3dWFBUUVDZjBIREFoQUNJZ0ZCd0FGR0lnQUVmeUFBQlNBQlFZQUJSaU13SWdBZ0FCc0xCRUJCQVNTREFnVkJBQ1NEQWd0QkFDU2RBa0dBcU5hNUJ5U1VBa0VBSkpVQ1FRQWtsZ0pCZ0tqV3VRY2tsd0pCQUNTWUFrRUFKSmtDSXk4RVFFRUJKSUlDQlVFQUpJSUNDeEFERUFVUUJoQUtFQXNRRWtFQUVCTkIvLzhESTdRQkVBUkI0UUVRRkVHUC9nTWp1Z0VRQkJBVkVCWVFGd3RLQUNBQVFRQktKQzhnQVVFQVNpUXdJQUpCQUVva01TQURRUUJLSkRJZ0JFRUFTaVF6SUFWQkFFb2tOQ0FHUVFCS0pEVWdCMEVBU2lRMklBaEJBRW9rTnlBSlFRQktKRGdRR0FzRkFDT2RBZ3U1QVFCQmdBZ2poUUk2QUFCQmdRZ2poZ0k2QUFCQmdnZ2pod0k2QUFCQmd3Z2ppQUk2QUFCQmhBZ2ppUUk2QUFCQmhRZ2ppZ0k2QUFCQmhnZ2ppd0k2QUFCQmh3Z2pqQUk2QUFCQmlBZ2pqUUk3QVFCQmlnZ2pqZ0k3QVFCQmpBZ2pqd0kyQWdCQmtRZ2prQUpCQUVjNkFBQkJrZ2dqa1FKQkFFYzZBQUJCa3dnamtnSkJBRWM2QUFCQmxBZ2prd0pCQUVjNkFBQkJsUWdqZ2dKQkFFYzZBQUJCbGdnamd3SkJBRWM2QUFCQmx3Z2poQUpCQUVjNkFBQUxhQUJCeUFrajdRRTdBUUJCeWdrajdnRTdBUUJCekFrajd3RkJBRWM2QUFCQnpRa2o4QUZCQUVjNkFBQkJ6Z2tqOFFGQkFFYzZBQUJCendrajhnRkJBRWM2QUFCQjBBa2o4d0ZCQUVjNkFBQkIwUWtqOUFGQkFFYzZBQUJCMGdrajlRRkJBRWM2QUFBTE5RQkIrZ2tqd0FFMkFnQkIvZ2tqd1FFMkFnQkJnZ29qd3dGQkFFYzZBQUJCaFFvanhBRkJBRWM2QUFCQmhmNERJOElCRUFRTFdBQkIzZ29qVmtFQVJ6b0FBRUhmQ2lOWk5nSUFRZU1LSTFvMkFnQkI1d29qV3pZQ0FFSHNDaU5jTmdJQVFmRUtJMTA2QUFCQjhnb2pYam9BQUVIM0NpTmZRUUJIT2dBQVFmZ0tJMkEyQWdCQi9Rb2pZVHNCQUFzOUFFR1FDeU5yUVFCSE9nQUFRWkVMSTI0MkFnQkJsUXNqYnpZQ0FFR1pDeU53TmdJQVFaNExJM0UyQWdCQm93c2pjam9BQUVHa0N5TnpPZ0FBQ3pzQVFmUUxJNHNCUVFCSE9nQUFRZlVMSTQwQk5nSUFRZmtMSTQ0Qk5nSUFRZjBMSTQ4Qk5nSUFRWUlNSTVBQk5nSUFRWWNNSTVJQk93RUFDNFFCQUJBYlFiSUlJK2NCTmdJQVFiWUlJOXdCT2dBQVFjVCtBeVBvQVJBRVFlUUlJN0lCUVFCSE9nQUFRZVVJSTdNQlFRQkhPZ0FBRUJ3UUhVR3NDaU9zQVRZQ0FFR3dDaU90QVRvQUFFR3hDaU92QVRvQUFCQWVFQjlCd2dzamVrRUFSem9BQUVIREN5TjlOZ0lBUWNjTEkzNDJBZ0JCeXdzamZ6c0JBQkFnUVFBa25RSUx1UUVBUVlBSUxRQUFKSVVDUVlFSUxRQUFKSVlDUVlJSUxRQUFKSWNDUVlNSUxRQUFKSWdDUVlRSUxRQUFKSWtDUVlVSUxRQUFKSW9DUVlZSUxRQUFKSXNDUVljSUxRQUFKSXdDUVlnSUx3RUFKSTBDUVlvSUx3RUFKSTRDUVl3SUtBSUFKSThDUVpFSUxRQUFRUUJLSkpBQ1FaSUlMUUFBUVFCS0pKRUNRWk1JTFFBQVFRQktKSklDUVpRSUxRQUFRUUJLSkpNQ1FaVUlMUUFBUVFCS0pJSUNRWllJTFFBQVFRQktKSU1DUVpjSUxRQUFRUUJLSklRQ0MxNEJBWDlCQUNUbkFVRUFKT2dCUWNUK0EwRUFFQVJCd2Y0REVBSkJmSEVoQVVFQUpOd0JRY0grQXlBQkVBUWdBQVJBQWtCQkFDRUFBMEFnQUVHQTJBVk9EUUVnQUVHQXlRVnFRZjhCT2dBQUlBQkJBV29oQUF3QUFBc0FDd3NMaUFFQkFYOGozZ0VoQVNBQVFZQUJjVUVBUnlUZUFTQUFRY0FBY1VFQVJ5VGZBU0FBUVNCeFFRQkhKT0FCSUFCQkVIRkJBRWNrNFFFZ0FFRUljVUVBUnlUaUFTQUFRUVJ4UVFCSEpPTUJJQUJCQW5GQkFFY2s1QUVnQUVFQmNVRUFSeVRsQVNQZUFVVWdBU0FCR3dSQVFRRVFJd3NnQVVVaUFBUi9JOTRCQlNBQUN3UkFRUUFRSXdzTEtnQkI1QWd0QUFCQkFFb2tzZ0ZCNVFndEFBQkJBRW9rc3dGQi8vOERFQUlRRTBHUC9nTVFBaEFVQzJnQVFjZ0pMd0VBSk8wQlFjb0pMd0VBSk80QlFjd0pMUUFBUVFCS0pPOEJRYzBKTFFBQVFRQktKUEFCUWM0SkxRQUFRUUJLSlBFQlFjOEpMUUFBUVFCS0pQSUJRZEFKTFFBQVFRQktKUE1CUWRFSkxRQUFRUUJLSlBRQlFkSUpMUUFBUVFCS0pQVUJDMGNBUWZvSktBSUFKTUFCUWY0SktBSUFKTUVCUVlJS0xRQUFRUUJLSk1NQlFZVUtMUUFBUVFCS0pNUUJRWVgrQXhBQ0pNSUJRWWIrQXhBQ0pNVUJRWWYrQXhBQ0pNY0JDd2NBUVFBa3NBRUxXQUJCM2dvdEFBQkJBRW9rVmtIZkNpZ0NBQ1JaUWVNS0tBSUFKRnBCNXdvb0FnQWtXMEhzQ2lnQ0FDUmNRZkVLTFFBQUpGMUI4Z290QUFBa1hrSDNDaTBBQUVFQVNpUmZRZmdLS0FJQUpHQkIvUW92QVFBa1lRczlBRUdRQ3kwQUFFRUFTaVJyUVpFTEtBSUFKRzVCbFFzb0FnQWtiMEdaQ3lnQ0FDUndRWjRMS0FJQUpIRkJvd3N0QUFBa2NrR2tDeTBBQUNSekN6c0FRZlFMTFFBQVFRQktKSXNCUWZVTEtBSUFKSTBCUWZrTEtBSUFKSTRCUWYwTEtBSUFKSThCUVlJTUtBSUFKSkFCUVljTUx3RUFKSklCQzhrQkFRRi9FQ0pCc2dnb0FnQWs1d0ZCdGdndEFBQWszQUZCeFA0REVBSWs2QUZCd1A0REVBSVFKQkFsUVlEK0F4QUNRZjhCY3lUVkFTUFZBU0lBUVJCeFFRQkhKTllCSUFCQklIRkJBRWNrMXdFUUpoQW5RYXdLS0FJQUpLd0JRYkFLTFFBQUpLMEJRYkVLTFFBQUpLOEJRUUFrc0FFUUtSQXFRY0lMTFFBQVFRQktKSHBCd3dzb0FnQWtmVUhIQ3lnQ0FDUitRY3NMTHdFQUpIOFFLMEVBSkowQ1FZQ28xcmtISkpRQ1FRQWtsUUpCQUNTV0FrR0FxTmE1QnlTWEFrRUFKSmdDUVFBa21RSUxCUUFqZ3dJTEJRQWpsd0lMQlFBam1BSUxCUUFqbVFJTHhRSUJCWDhqU1NFR0FuOENmeUFCUVFCS0lnVUVRQ0FBUVFoS0lRVUxJQVVMQkVBalNDQUVSaUVGQ3lBRkN3Ui9JQUFnQmtZRklBVUxCRUFnQTBFQmF4QUNRU0J4UVFCSElRVWdBeEFDUVNCeFFRQkhJUWhCQUNFREEwQWdBMEVJU0FSQVFRY2dBMnNnQXlBRklBaEhHeUlESUFCcUlnUkJvQUZNQkVBZ0FVR2dBV3dnQkdwQkEyeEJnTWtGYWlJSElBY3RBQUE2QUFBZ0FVR2dBV3dnQkdwQkEyeEJnY2tGYWlBSExRQUJPZ0FBSUFGQm9BRnNJQVJxUVFOc1FZTEpCV29nQnkwQUFqb0FBQ0FCUWFBQmJDQUVha0dBa1FScUlBQkJBQ0FEYTJzZ0FVR2dBV3hxUWZpUUJHb3RBQUFpQkVFRGNTSUhRUVJ5SUFjZ0JFRUVjUnM2QUFBZ0NVRUJhaUVKQ3lBRFFRRnFJUU1NQVFzTEJTQUVKRWdMSUFBZ0JrNEVRQ0FBUVFocUlRWWdBQ0FDUVFkeElnaElCRUFnQmlBSWFpRUdDd3NnQmlSSklBa0xLUUFnQUVHQWtBSkdCRUFnQVVHQUFXc2dBVUdBQVdvZ0FVR0FBWEViSVFFTElBRkJCSFFnQUdvTFNnQWdBRUVEZENBQlFRRjBhaUlBUVFGcVFUOXhJZ0ZCUUdzZ0FTQUNHMEdBa0FScUxRQUFJUUVnQUVFL2NTSUFRVUJySUFBZ0FodEJnSkFFYWkwQUFDQUJRZjhCY1VFSWRISUx1UUVBSUFFUUFpQUFRUUYwZFVFRGNTRUFJQUZCeVA0RFJnUkFJejBoQVFKQUlBQkZEUUFDUUFKQUFrQWdBRUVCYXc0REFBRUNBd3NqUGlFQkRBSUxJejhoQVF3QkN5TkFJUUVMQlNBQlFjbitBMFlFUUNOQklRRUNRQ0FBUlEwQUFrQUNRQUpBSUFCQkFXc09Bd0FCQWdNTEkwSWhBUXdDQ3lORElRRU1BUXNqUkNFQkN3VWpPU0VCQWtBZ0FFVU5BQUpBQWtBQ1FDQUFRUUZyRGdNQUFRSURDeU02SVFFTUFnc2pPeUVCREFFTEl6d2hBUXNMQ3lBQkM2SURBUVovSUFFZ0FCQXlJQVZCQVhScUlnQkJnSkIrYWlBQ1FRRnhRUTEwSWdGcUxRQUFJUkVnQUVHQmtINXFJQUZxTFFBQUlSSWdBeUVBQTBBZ0FDQUVUQVJBSUFBZ0Eyc2dCbW9pRGlBSVNBUkFRUWNnQUdzaEJTQUxRUUJJSWdJRWZ5QUNCU0FMUVNCeFJRc2hBVUVBSVFJQ2YwRUJJQVVnQUNBQkd5SUJkQ0FTY1FSQVFRSWhBZ3NnQWtFQmFnc2dBa0VCSUFGMElCRnhHeUVDSTRNQ0JIOGdDMEVBVGlJQkJIOGdBUVVnREVFQVRnc0ZJNE1DQ3dSL0lBdEJCM0VoQlNBTVFRQk9JZ0VFUUNBTVFRZHhJUVVMSUFVZ0FpQUJFRE1pQlVFZmNVRURkQ0VQSUFWQjRBZHhRUVYxUVFOMElRRWdCVUdBK0FGeFFRcDFRUU4wQlNBQ1FjZitBeUFLSUFwQkFFd2JJZ29RTkNJRlFZQ0EvQWR4UVJCMUlROGdCVUdBL2dOeFFRaDFJUUVnQlVIL0FYRUxJUVVnQnlBSWJDQU9ha0VEYkNBSmFpSVFJQTg2QUFBZ0VFRUJhaUFCT2dBQUlCQkJBbW9nQlRvQUFDQUhRYUFCYkNBT2FrR0FrUVJxSUFKQkEzRWlBVUVFY2lBQklBdEJnQUZ4UVFCSFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzM0QkEzOGdBMEVIY1NFRFFRQWdBaUFDUVFOMVFRTjBheUFBR3lFSFFhQUJJQUJyUVFjZ0FFRUlha0dnQVVvYklRaEJmeUVDSTRNQ0JFQWdCRUdBMEg1cUxRQUFJZ0pCQ0hGQkFFY2hDU0FDUWNBQWNRUkFRUWNnQTJzaEF3c0xJQVlnQlNBSklBY2dDQ0FESUFBZ0FVR2dBVUdBeVFWQkFDQUNRWDhRTlF1bEFnRUJmeUFEUVFkeElRTWdCU0FHRURJZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ05CZ0pCK2FpQUVRUWh4UVFCSElnVkJEWFJxTFFBQUlRWWdBMEdCa0g1cUlBVkJBWEZCRFhScUxRQUFJUVVnQWtFSGNTRURRUUFoQWlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxSUFSQkIzRUNmMEVCSUFOQkJ5QURheUFFUVNCeEd5SURkQ0FGY1FSQVFRSWhBZ3NnQWtFQmFnc2dBa0VCSUFOMElBWnhHeUlDUVFBUU15SURRUjl4UVFOME9nQUFJQUZCb0FGc0lBQnFRUU5zUVlISkJXb2dBMEhnQjNGQkJYVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnc2tGYWlBRFFZRDRBWEZCQ25WQkEzUTZBQUFnQVVHZ0FXd2dBR3BCZ0pFRWFpQUNRUU54SWdkQkJISWdCeUFFUVlBQmNSczZBQUFMeEFFQUlBUWdCUkF5SUFOQkIzRkJBWFJxSWdSQmdKQithaTBBQUNFRlFRQWhBeUFCUWFBQmJDQUFha0VEYkVHQXlRVnFBbjhnQkVHQmtINXFMUUFBUVFGQkJ5QUNRUWR4YXlJQ2RIRUVRRUVDSVFNTElBTkJBV29MSUFOQkFTQUNkQ0FGY1JzaUEwSEgvZ01RTkNJQ1FZQ0EvQWR4UVJCMU9nQUFJQUZCb0FGc0lBQnFRUU5zUVlISkJXb2dBa0dBL2dOeFFRaDFPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZTEpCV29nQWpvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRTZBQUFMMWdFQkJuOGdBMEVEZFNFTEEwQWdCRUdnQVVnRVFDQUVJQVZxSWdaQmdBSk9CRUFnQmtHQUFtc2hCZ3NnQzBFRmRDQUNhaUFHUVFOMWFpSUpRWUNRZm1vdEFBQWhDRUVBSVFvak53UkFJQVFnQUNBR0lBa2dDQkF4SWdkQkFFb0VRRUVCSVFvZ0IwRUJheUFFYWlFRUN3c2dDa1VqTmlJSElBY2JCRUFnQkNBQUlBWWdBeUFKSUFFZ0NCQTJJZ2RCQUVvRVFDQUhRUUZySUFScUlRUUxCU0FLUlFSQUk0TUNCRUFnQkNBQUlBWWdBeUFKSUFFZ0NCQTNCU0FFSUFBZ0JpQURJQUVnQ0JBNEN3c0xJQVJCQVdvaEJBd0JDd3NMTWdFRGZ5UHJBU0VESUFBajdBRWlCRWdFUUE4TFFRQWdBMEVIYXlJRGF5RUZJQUFnQVNBQ0lBQWdCR3NnQXlBRkVEa0x2UVVCRDM4Q1FFRW5JUWtEUUNBSlFRQklEUUVnQ1VFQ2RDSUhRWUQ4QTJvaUF4QUNJUUlnQTBFQmFoQUNJUW9nQTBFQ2FoQUNJUU1nQWtFUWF5RUNJQXBCQ0dzaENrRUlJUVFnQVFSQVFSQWhCQ0FESUFOQkFYRnJJUU1MSUFBZ0FrNGlCUVJBSUFBZ0FpQUVha2doQlFzZ0JRUkFJQWRCZy93RGFoQUNJZ1ZCZ0FGeFFRQkhJUXNnQlVFZ2NVRUFSeUVPUVlDQUFpQURFRElnQkNBQUlBSnJJZ0pyUVFGcklBSWdCVUhBQUhFYlFRRjBhaUlEUVlDUWZtb2dCVUVJY1VFQVJ5T0RBaUlDSUFJYlFRRnhRUTEwSWdKcUxRQUFJUThnQTBHQmtINXFJQUpxTFFBQUlSQkJCeUVIQTBBZ0IwRUFUZ1JBUVFBaENBSi9RUUZCQUNBSElnSkJCMnRySUFJZ0Roc2lBblFnRUhFRVFFRUNJUWdMSUFoQkFXb0xJQWhCQVNBQ2RDQVBjUnNpQ0FSQVFRY2dCMnNnQ21vaUJrRUFUaUlDQkVBZ0JrR2dBVXdoQWdzZ0FnUkFRUUFoREVFQUlRMGo1UUZGSTRNQ0lnSWdBaHNpQWtVRVFDQUFRYUFCYkNBR2FrR0FrUVJxTFFBQUlnTkJBM0VpQkVFQVN5QUxJQXNiQkVCQkFTRU1CU0FEUVFSeFFRQkhJNE1DSWdNZ0F4c2lBd1JBSUFSQkFFc2hBd3RCQVVFQUlBTWJJUTBMQ3lBQ1JRUkFJQXhGSWdRRWZ5QU5SUVVnQkFzaEFnc2dBZ1JBSTRNQ0JFQWdBRUdnQVd3Z0JtcEJBMnhCZ01rRmFpQUZRUWR4SUFoQkFSQXpJZ1JCSDNGQkEzUTZBQUFnQUVHZ0FXd2dCbXBCQTJ4Qmdja0ZhaUFFUWVBSGNVRUZkVUVEZERvQUFDQUFRYUFCYkNBR2FrRURiRUdDeVFWcUlBUkJnUGdCY1VFS2RVRURkRG9BQUFVZ0FFR2dBV3dnQm1wQkEyeEJnTWtGYWlBSVFjbitBMEhJL2dNZ0JVRVFjUnNRTkNJRFFZQ0EvQWR4UVJCMU9nQUFJQUJCb0FGc0lBWnFRUU5zUVlISkJXb2dBMEdBL2dOeFFRaDFPZ0FBSUFCQm9BRnNJQVpxUVFOc1FZTEpCV29nQXpvQUFBc0xDd3NnQjBFQmF5RUhEQUVMQ3dzZ0NVRUJheUVKREFBQUN3QUxDMllCQW45QmdJQUNRWUNRQWlQaEFSc2hBU09EQWlJQ0krVUJJQUliQkVBZ0FDQUJRWUM0QWtHQXNBSWo0Z0ViSStvQklBQnFRZjhCY1VFQUkra0JFRGtMSStBQkJFQWdBQ0FCUVlDNEFrR0FzQUlqM3dFYkVEb0xJK1FCQkVBZ0FDUGpBUkE3Q3dzbEFRRi9Ba0FEUUNBQVFaQUJTZzBCSUFCQi93RnhFRHdnQUVFQmFpRUFEQUFBQ3dBTEMwWUJBbjhEUUNBQlFaQUJUa1VFUUVFQUlRQURRQ0FBUWFBQlNBUkFJQUZCb0FGc0lBQnFRWUNSQkdwQkFEb0FBQ0FBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3dzTEhRRUJmMEdQL2dNUUFrRUJJQUIwY2lJQkpMb0JRWS8rQXlBQkVBUUxDd0JCQVNTOEFVRUJFRDhMTEFFQ2Z5TmJJZ0JCQUVvaUFRUkFJMVFoQVFzZ0FFRUJheUFBSUFFYklnQkZCRUJCQUNSV0N5QUFKRnNMTEFFQ2Z5TndJZ0JCQUVvaUFRUkFJMmtoQVFzZ0FFRUJheUFBSUFFYklnQkZCRUJCQUNSckN5QUFKSEFMTEFFQ2Z5TitJZ0JCQUVvaUFRUkFJM2doQVFzZ0FFRUJheUFBSUFFYklnQkZCRUJCQUNSNkN5QUFKSDRMTUFFQ2Z5T1BBU0lBUVFCS0lnRUVRQ09LQVNFQkN5QUFRUUZySUFBZ0FSc2lBRVVFUUVFQUpJc0JDeUFBSkk4QkMwQUJBbjlCbFA0REVBSkIrQUZ4SVFGQmsvNERJQUJCL3dGeElnSVFCRUdVL2dNZ0FTQUFRUWgxSWdCeUVBUWdBaVJUSUFBa1ZTTlRJMVZCQ0hSeUpGZ0xYUUVDZnlOaElnRWpUWFVoQUNBQklBQnJJQUFnQVdvalRCc2lBRUgvRDB3aUFRUi9JMDFCQUVvRklBRUxCRUFnQUNSaElBQVFSU05oSWdFalRYVWhBQ0FCSUFCcklBQWdBV29qVEJzaEFBc2dBRUgvRDBvRVFFRUFKRllMQ3lrQkFYOGpZRUVCYXlJQVFRQk1CRUFqU3lSZ0kwdEJBRW9qWHlOZkd3UkFFRVlMQlNBQUpHQUxDMDRCQTM4aldrRUJheUlCUVFCTUJFQWpVaUlCQkVBalhDRUFJQUJCRDBnalVTTlJHd1IvSUFCQkFXb0ZJMUZGSWdJRVFDQUFRUUJLSVFJTElBQkJBV3NnQUNBQ0d3c2tYQXNMSUFFa1dndE9BUU4vSTI5QkFXc2lBVUVBVEFSQUkyY2lBUVJBSTNFaEFDQUFRUTlJSTJZalpoc0VmeUFBUVFGcUJTTm1SU0lDQkVBZ0FFRUFTaUVDQ3lBQVFRRnJJQUFnQWhzTEpIRUxDeUFCSkc4TFZnRURmeU9PQVVFQmF5SUJRUUJNQkVBamhnRWlBUVJBSTVBQklRQWdBRUVQU0NPRkFTT0ZBUnNFZnlBQVFRRnFCU09GQVVVaUFnUkFJQUJCQUVvaEFnc2dBRUVCYXlBQUlBSWJDeVNRQVFzTElBRWtqZ0VMblFFQkFuOUJnTUFBSTRRQ2RDSUJJUUlqckFFZ0FHb2lBQ0FCVGdSQUlBQWdBbXNrckFFQ1FBSkFBa0FDUUFKQUk2OEJJZ0FFUUNBQVFRSkdEUUVDUUNBQVFRUnJEZ1FEQUFRRkFBc01CUXNRUVJCQ0VFTVFSQXdFQ3hCQkVFSVFReEJFRUVjTUF3c1FRUkJDRUVNUVJBd0NDeEJCRUVJUVF4QkVFRWNNQVFzUVNCQkpFRW9MSUFCQkFXcEJCM0VrcndGQkFROEZJQUFrckFFTFFRQUxiZ0VCZndKQUFrQUNRQUpBSUFCQkFVY0VRQ0FBUVFKckRnTUJBZ01FQ3lOWElnQWpsd0ZISVFFZ0FDU1hBU0FCRHdzamJDSUJJNWdCUnlFQUlBRWttQUVnQUE4TEkzc2lBQ09aQVVjaEFTQUFKSmtCSUFFUEN5T01BU0lCSTVvQlJ5RUFJQUVrbWdFZ0FBOExRUUFMVlFBQ1FBSkFBa0FnQUVFQlJ3UkFJQUJCQWtZTkFTQUFRUU5HRFFJTUF3dEJBU0FCZEVHQkFYRkJBRWNQQzBFQklBRjBRWWNCY1VFQVJ3OExRUUVnQVhSQi9nQnhRUUJIRHd0QkFTQUJkRUVCY1VFQVJ3dHdBUUYvSTFrZ0FHc2lBVUVBVEFSQUlBRWtXVUdBRUNOWWEwRUNkQ0lBUVFKMElBQWpoQUliSkZraldTQUJRUjkxSWdBZ0FDQUJhbk5ySkZralhrRUJha0VIY1NSZUJTQUJKRmtMSTFjalZpSUFJQUFiQkg4alhBVkJEdzhMSTA0alhoQk5CSDlCQVFWQmZ3dHNRUTlxQzJRQkFYOGpiaUFBYXlJQkpHNGdBVUVBVEFSQVFZQVFJMjFyUVFKMEk0UUNkQ1J1STI0Z0FVRWZkU0lBSUFBZ0FXcHpheVJ1STNOQkFXcEJCM0VrY3dzamJDTnJJZ0FnQUJzRWZ5TnhCVUVQRHdzall5TnpFRTBFZjBFQkJVRi9DMnhCRDJvTDhnRUJBbjhqZlNBQWF5SUJRUUJNQkVBZ0FTUjlRWUFRSTN4clFRRjBJNFFDZENSOUkzMGdBVUVmZFNJQUlBQWdBV3B6YXlSOUkzOUJBV3BCSDNFa2Z3VWdBU1I5Q3lPQUFTRUJJM3NqZWlJQUlBQWJCRUFqZ1FFRVFFR2MvZ01RQWtFRmRVRVBjU0lCSklBQlFRQWtnUUVMQlVFUER3c2pmeUlDUVFGMVFiRCtBMm9RQWlBQ1FRRnhSVUVDZEhWQkQzRWhBRUVBSVFJQ1FBSkFBa0FDUUNBQkJFQWdBVUVCUmcwQklBRkJBa1lOQWd3REN5QUFRUVIxSVFBTUF3dEJBU0VDREFJTElBQkJBWFVoQUVFQ0lRSU1BUXNnQUVFQ2RTRUFRUVFoQWdzZ0FrRUFTZ1IvSUFBZ0FtMEZRUUFMUVE5cUM0WUJBUUovSTQwQklBQnJJZ0ZCQUV3RVFDT1JBU09IQVhRamhBSjBJQUZCSDNVaUFDQUFJQUZxYzJzaEFTT1NBU0lBUVFGMUlnSWdBRUVCY1NBQ1FRRnhjeUlDUVE1MGNpSUFRYjkvY1NBQ1FRWjBjaUFBSTRnQkd5U1NBUXNnQVNTTkFTT01BU09MQVNJQUlBQWJCSDhqa0FFRlFROFBDMEYvUVFFamtnRkJBWEViYkVFUGFnc3dBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMa3dFQkFYOUJBQ1NkQVNBQVFROGpvd0ViSUFGQkR5T2tBUnRxSUFKQkR5T2xBUnRxSUFOQkR5T21BUnRxSVFRZ0FFRVBJNmNCR3lBQlFROGpxQUViYWlBQ1FROGpxUUViYWlFQklBTkJEeU9xQVJzaEEwRUFKSjRCUVFBa253RWdCQ09oQVVFQmFoQlNJUUFnQVNBRGFpT2lBVUVCYWhCU0lRRWdBQ1NiQVNBQkpKd0JJQUZCL3dGeElBQkIvd0Z4UVFoMGNndWRBd0VGZnlOS0lBQnFJZ0VrU2lOWklBRnJRUUJNSWdGRkJFQkJBUkJNSVFFTEkySWdBR29pQkNSaUkyNGdCR3RCQUV3aUJFVUVRRUVDRUV3aEJBc2pkQ0FBYWlSMEk0RUJSU0lDQkVBamZTTjBhMEVBU2lFQ0N5QUNSU0lDUlFSQVFRTVFUQ0VDQ3lPQ0FTQUFhaVNDQVNPTkFTT0NBV3RCQUV3aUJVVUVRRUVFRUV3aEJRc2dBUVJBSTBvaEEwRUFKRW9nQXhCT0pKTUJDeUFFQkVBallpRURRUUFrWWlBREVFOGtsQUVMSUFJRVFDTjBJUU5CQUNSMElBTVFVQ1NWQVFzZ0JRUkFJNElCSVFOQkFDU0NBU0FERUZFa2xnRUxBbjhnQVNBRUlBRWJJZ0ZGQkVBZ0FpRUJDeUFCUlFzRVFDQUZJUUVMSUFFRVFFRUJKSjhCQ3lPdEFTT3VBU0FBYkdvaUFVR0FnSUFDSTRRQ2RDSUFUZ1JBSUFFZ0FHc2hBU09mQVNJQUk1MEJJQUFiSWdCRkJFQWpuZ0VoQUFzZ0FBUkFJNU1CSTVRQkk1VUJJNVlCRUZNYUJTQUJKSzBCQ3lPd0FTSUNRUUYwUVlDWndRQnFJZ0FqbXdGQkFtbzZBQUFnQUVFQmFpT2NBVUVDYWpvQUFDQUNRUUZxSWdBanNRRkJBWFZCQVd0T0JIOGdBRUVCYXdVZ0FBc2tzQUVMSUFFa3JRRUxwQU1CQm44Z0FCQk9JUUVnQUJCUElRSWdBQkJRSVFNZ0FCQlJJUVFnQVNTVEFTQUNKSlFCSUFNa2xRRWdCQ1NXQVNPdEFTT3VBU0FBYkdvaUJVR0FnSUFDSTRRQ2RFNEVRQ0FGUVlDQWdBSWpoQUowYXlFRklBRWdBaUFESUFRUVV5RUFJN0FCUVFGMFFZQ1p3UUJxSWdZZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFaQkFXb2dBRUgvQVhGQkFtbzZBQUFqT0FSQUlBRkJEMEVQUVE4UVV5RUFJN0FCUVFGMFFZQ1pJV29pQVNBQVFZRCtBM0ZCQ0hWQkFtbzZBQUFnQVVFQmFpQUFRZjhCY1VFQ2Fqb0FBRUVQSUFKQkQwRVBFRk1oQUNPd0FVRUJkRUdBbVNscUlnSWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBSkJBV29nQUVIL0FYRkJBbW82QUFCQkQwRVBJQU5CRHhCVElRQWpzQUZCQVhSQmdKa3hhaUlESUFCQmdQNERjVUVJZFVFQ2Fqb0FBQ0FEUVFGcUlBQkIvd0Z4UVFKcU9nQUFRUTlCRDBFUElBUVFVeUVBSTdBQlFRRjBRWUNaT1dvaUJDQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0JFRUJhaUFBUWY4QmNVRUNham9BQUFzanNBRkJBV29pQUNPeEFVRUJkVUVCYTA0RWZ5QUFRUUZyQlNBQUN5U3dBUXNnQlNTdEFRc2VBUUYvSUFBUVN5RUJJQUZGSXpVak5Sc0VRQ0FBRUZRRklBQVFWUXNMTHdFQ2YwSFhBQ09FQW5RaEFTT2dBU0VBQTBBZ0FDQUJUZ1JBSUFFUVZpQUFJQUZySVFBTUFRc0xJQUFrb0FFTElRQWdBRUdtL2dOR0JFQkJwdjRERUFKQmdBRnhJUUFnQUVId0FISVBDMEYvQzV3QkFRRi9JOVVCSVFBajFnRUVRQ0FBUVh0eElBQkJCSElqelFFYklRQWdBRUYrY1NBQVFRRnlJOUFCR3lFQUlBQkJkM0VnQUVFSWNpUE9BUnNoQUNBQVFYMXhJQUJCQW5Janp3RWJJUUFGSTljQkJFQWdBRUYrY1NBQVFRRnlJOUVCR3lFQUlBQkJmWEVnQUVFQ2NpUFNBUnNoQUNBQVFYdHhJQUJCQkhJajB3RWJJUUFnQUVGM2NTQUFRUWh5STlRQkd5RUFDd3NnQUVId0FYSUx6d0lCQVg4Z0FFR0FnQUpJQkVCQmZ3OExJQUJCZ0lBQ1RpSUJCSDhnQUVHQXdBSklCU0FCQ3dSQVFYOFBDeUFBUVlEQUEwNGlBUVIvSUFCQmdQd0RTQVVnQVFzRVFDQUFRWUJBYWhBQ0R3c2dBRUdBL0FOT0lnRUVmeUFBUVovOUEwd0ZJQUVMQkVCQi93RkJmeVBjQVVFQ1NCc1BDeUFBUWMzK0EwWUVRRUgvQVNFQlFjMytBeEFDUVFGeFJRUkFRZjRCSVFFTEk0UUNSUVJBSUFGQi8zNXhJUUVMSUFFUEN5QUFRY1QrQTBZRVFDQUFJK2dCRUFRajZBRVBDeUFBUVpEK0EwNGlBUVIvSUFCQnB2NERUQVVnQVFzRVFCQlhJQUFRV0E4TElBQkJzUDREVGlJQkJIOGdBRUcvL2dOTUJTQUJDd1JBRUZkQmZ3OExJQUJCaFA0RFJnUkFJQUFqd1FGQmdQNERjVUVJZFNJQkVBUWdBUThMSUFCQmhmNERSZ1JBSUFBandnRVFCQ1BDQVE4TElBQkJqLzREUmdSQUk3b0JRZUFCY2c4TElBQkJnUDREUmdSQUVGa1BDMEYvQ3lrQkFYOGoyUUVnQUVZRVFFRUJKTnNCQ3lBQUVGb2lBVUYvUmdSL0lBQVFBZ1VnQVVIL0FYRUxDN01DQVFSL0kvRUJCRUFQQ3lQeUFTRUZJL01CSVFNZ0FFSC9QMHdFUUNBREJIOGdBVUVRY1VVRklBTUxSUVJBSUFGQkQzRWlCQVJBSUFSQkNrWUVRRUVCSk84QkN3VkJBQ1R2QVFzTEJTQUFRZi8vQUV3RVFDUDFBU0lFUlNJQ0JIOGdBZ1VnQUVILzN3Qk1Dd1JBSUFGQkQzRWo3UUVnQXhzaEFpQUZCSDhnQVVFZmNTRUJJQUpCNEFGeEJTUDBBUVIvSUFGQi93QnhJUUVnQWtHQUFYRUZRUUFnQWlBRUd3c0xJUUFnQUNBQmNpVHRBUVVqN1FGQi93RnhJQUZCQUVwQkNIUnlKTzBCQ3dVZ0EwVWlCQVIvSUFCQi83OEJUQVVnQkFzRVFDUHdBU0FGSUFVYkJFQWo3UUZCSDNFZ0FVSGdBWEZ5Sk8wQkR3c2dBVUVQY1NBQlFRTnhJL1VCR3lUdUFRVWdBMFVpQWdSL0lBQkIvLzhCVEFVZ0Fnc0VRQ0FGQkVBZ0FVRUJjVUVBUnlUd0FRc0xDd3NMQ3lnQUlBQkJCSFZCRDNFa1VDQUFRUWh4UVFCSEpGRWdBRUVIY1NSU0lBQkIrQUZ4UVFCS0pGY0xLQUFnQUVFRWRVRVBjU1JsSUFCQkNIRkJBRWNrWmlBQVFRZHhKR2NnQUVINEFYRkJBRW9rYkFzc0FDQUFRUVIxUVE5eEpJUUJJQUJCQ0hGQkFFY2toUUVnQUVFSGNTU0dBU0FBUWZnQmNVRUFTaVNNQVFzNEFDQUFRUVIxSkljQklBQkJDSEZCQUVja2lBRWdBRUVIY1NJQUpJa0JJQUJCQVhRaUFFRUJTQVJBUVFFaEFBc2dBRUVEZENTUkFRdGpBUUYvUVFFa1ZpTmJSUVJBUWNBQUpGc0xRWUFRSTFoclFRSjBJZ0JCQW5RZ0FDT0VBaHNrV1NOU0pGb2pVQ1JjSTFna1lTTkxJZ0FrWUNBQVFRQktJZ0FFZnlOTlFRQktCU0FBQ3lSZkkwMUJBRW9FUUJCR0N5TlhSUVJBUVFBa1Znc0xNZ0JCQVNSckkzQkZCRUJCd0FBa2NBdEJnQkFqYld0QkFuUWpoQUowSkc0alp5UnZJMlVrY1NOc1JRUkFRUUFrYXdzTExnQkJBU1I2STM1RkJFQkJnQUlrZmd0QmdCQWpmR3RCQVhRamhBSjBKSDFCQUNSL0kzdEZCRUJCQUNSNkN3dEJBRUVCSklzQkk0OEJSUVJBUWNBQUpJOEJDeU9SQVNPSEFYUWpoQUowSkkwQkk0WUJKSTRCSTRRQkpKQUJRZi8vQVNTU0FTT01BVVVFUUVFQUpJc0JDd3ZxQkFFQmZ5QUFRYWIrQTBjaUFnUkFJNnNCUlNFQ0N5QUNCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUNRWkQrQTBjRVFDQUNRWkgrQTJzT0ZnSUdDZzRWQXdjTER3RUVDQXdRRlFVSkRSRVNFeFFWQ3lBQlFmQUFjVUVFZFNSTElBRkJDSEZCQUVja1RDQUJRUWR4SkUwTUZRc2dBVUdBQVhGQkFFY2tld3dVQ3lBQlFRWjFRUU54SkU0Z0FVRS9jU1JQUWNBQUkwOXJKRnNNRXdzZ0FVRUdkVUVEY1NSaklBRkJQM0VrWkVIQUFDTmtheVJ3REJJTElBRWtkVUdBQWlOMWF5UitEQkVMSUFGQlAzRWtnd0ZCd0FBamd3RnJKSThCREJBTElBRVFYUXdQQ3lBQkVGNE1EZ3RCQVNTQkFTQUJRUVYxUVE5eEpIWU1EUXNnQVJCZkRBd0xJQUVrVXlOVlFRaDBJQUZ5SkZnTUN3c2dBU1JvSTJwQkNIUWdBWElrYlF3S0N5QUJKSGNqZVVFSWRDQUJjaVI4REFrTElBRVFZQXdJQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISkZRZ0FVRUhjU0lBSkZValV5QUFRUWgwY2lSWUVHRUxEQWNMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNrYVNBQlFRZHhJZ0FrYWlOb0lBQkJDSFJ5SkcwUVlnc01CZ3NnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVI0SUFGQkIzRWlBQ1I1STNjZ0FFRUlkSElrZkJCakN3d0ZDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKSW9CRUdRTERBUUxJQUZCQkhWQkIzRWtvUUVnQVVFSGNTU2lBVUVCSkowQkRBTUxJQUVRRUVFQkpKNEJEQUlMSUFGQmdBRnhRUUJISktzQklBRkJnQUZ4UlFSQUFrQkJrUDRESVFJRFFDQUNRYWIrQTA0TkFTQUNRUUFRQkNBQ1FRRnFJUUlNQUFBTEFBc0xEQUVMUVFFUEMwRUJDendCQVg4Z0FFRUlkQ0VCUVFBaEFBTkFBa0FnQUVHZkFVb05BQ0FBUVlEOEEyb2dBQ0FCYWhBQ0VBUWdBRUVCYWlFQURBRUxDMEdFQlNUN0FRc2pBUUYvSS9ZQkVBSWhBQ1AzQVJBQ1FmOEJjU0FBUWY4QmNVRUlkSEpCOFA4RGNRc25BUUYvSS9nQkVBSWhBQ1A1QVJBQ1FmOEJjU0FBUWY4QmNVRUlkSEpCOEQ5eFFZQ0FBbW9MaEFFQkEzOGpnd0pGQkVBUEN5QUFRWUFCY1VVai9BRWovQUViQkVCQkFDVDhBU1A2QVJBQ1FZQUJjaUVBSS9vQklBQVFCQThMRUdjaEFSQm9JUUlnQUVIL2ZuRkJBV3BCQkhRaEF5QUFRWUFCY1FSQVFRRWsvQUVnQXlUOUFTQUJKUDRCSUFJay93RWorZ0VnQUVIL2ZuRVFCQVVnQVNBQ0lBTVFjeVA2QVVIL0FSQUVDd3RlQVFSL0kwY2hBeU5HSUFCR0lnSkZCRUFnQUNBRFJpRUNDeUFDQkVBZ0FFRUJheUlFRUFKQnYzOXhJZ0pCUDNFaUJVRkFheUFGSUFBZ0EwWWJRWUNRQkdvZ0FUb0FBQ0FDUVlBQmNRUkFJQVFnQWtFQmFrR0FBWElRQkFzTEN6d0JBWDhDUUFKQUFrQUNRQ0FBQkVBZ0FDSUJRUUZHRFFFZ0FVRUNSZzBDSUFGQkEwWU5Bd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzbEFRRi9RUUVqeHdFUWF5SUNkQ0FBY1VFQVJ5SUFCSDlCQVNBQ2RDQUJjVVVGSUFBTEM0VUJBUVIvQTBBZ0FpQUFTQVJBSUFKQkJHb2hBaVBCQVNJQlFRUnFRZi8vQTNFaUF5VEJBU1BHQVFSQUk4UUJJUVFqd3dFRVFDUEZBU1RDQVVFQkpMMEJRUUlRUDBFQUpNTUJRUUVreEFFRklBUUVRRUVBSk1RQkN3c2dBU0FERUd3RVFDUENBVUVCYWlJQlFmOEJTZ1JBUVFFa3d3RkJBQ0VCQ3lBQkpNSUJDd3NNQVFzTEN3d0FJOEFCRUcxQkFDVEFBUXRHQVFGL0k4RUJJUUJCQUNUQkFVR0UvZ05CQUJBRUk4WUJCSDhnQUVFQUVHd0ZJOFlCQ3dSQUk4SUJRUUZxSWdCQi93RktCRUJCQVNUREFVRUFJUUFMSUFBa3dnRUxDNElCQVFOL0k4WUJJUUVnQUVFRWNVRUFSeVRHQVNBQVFRTnhJUUlnQVVVRVFDUEhBUkJySVFBZ0FoQnJJUU1qd1FFaEFTUEdBUVIvUVFFZ0FIUWdBWEVGUVFFZ0FIUWdBWEZCQUVjaUFBUi9RUUVnQTNRZ0FYRUZJQUFMQ3dSQUk4SUJRUUZxSWdCQi93RktCRUJCQVNUREFVRUFJUUFMSUFBa3dnRUxDeUFDSk1jQkMvRUdBUUovQWtBQ1FDQUFRYzMrQTBZRVFFSE4vZ01nQVVFQmNSQUVEQUVMSUFCQjBQNERSaU9DQWlJQ0lBSWJCRUJCQUNTQ0FrSC9BU1NPQWd3Q0N5QUFRWUNBQWtnRVFDQUFJQUVRWEF3QkN5QUFRWUNBQWs0aUFnUkFJQUJCZ01BQ1NDRUNDeUFDRFFFZ0FFR0F3QU5PSWdJRVFDQUFRWUQ4QTBnaEFnc2dBZ1JBSUFCQmdFQnFJQUVRQkF3Q0N5QUFRWUQ4QTA0aUFnUkFJQUJCbi8wRFRDRUNDeUFDQkVBajNBRkJBazRQQ3lBQVFhRDlBMDRpQWdSQUlBQkIvLzBEVENFQ0N5QUNEUUFnQUVHQy9nTkdCRUFnQVVFQmNVRUFSeVRLQVNBQlFRSnhRUUJISk1zQklBRkJnQUZ4UVFCSEpNd0JRUUVQQ3lBQVFaRCtBMDRpQWdSQUlBQkJwdjREVENFQ0N5QUNCRUFRVnlBQUlBRVFaUThMSUFCQnNQNERUaUlDQkVBZ0FFRy8vZ05NSVFJTElBSUVRQkJYQ3lBQVFjRCtBMDRpQWdSQUlBQkJ5LzREVENFQ0N5QUNCRUFnQUVIQS9nTkdCRUFnQVJBa0RBTUxJQUJCd2Y0RFJnUkFRY0grQXlBQlFmZ0JjVUhCL2dNUUFrRUhjWEpCZ0FGeUVBUU1BZ3NnQUVIRS9nTkdCRUJCQUNUb0FTQUFRUUFRQkF3Q0N5QUFRY1grQTBZRVFDQUJKTjBCREFNTElBQkJ4djREUmdSQUlBRVFaZ3dEQ3dKQUFrQUNRQUpBSUFBaUFrSEQvZ05IQkVBZ0FrSEMvZ05yRGdvQkJBUUVCQVFFQkFNQ0JBc2dBU1RwQVF3R0N5QUJKT29CREFVTElBRWs2d0VNQkFzZ0FTVHNBUXdEQ3d3Q0N5UDZBU0FBUmdSQUlBRVFhUXdCQ3lPQkFpQUFSaUlDUlFSQUk0QUNJQUJHSVFJTElBSUVRQ1A4QVFSQUFuOGovZ0VpQWtHQWdBRk9JZ01FUUNBQ1FmLy9BVXdoQXdzZ0EwVUxCRUFnQWtHQW9BTk9JZ01FUUNBQ1FmKy9BMHdoQXdzTElBTU5BZ3NMSUFBalJVNGlBZ1JBSUFBalIwd2hBZ3NnQWdSQUlBQWdBUkJxREFJTElBQkJoUDREVGlJQ0JFQWdBRUdIL2dOTUlRSUxJQUlFUUJCdUFrQUNRQUpBQWtBZ0FDSUNRWVQrQTBjRVFDQUNRWVgrQTJzT0F3RUNBd1FMRUc4TUJRc0NRQ1BHQVFSQUk4UUJEUUVqd3dFRVFFRUFKTU1CQ3dzZ0FTVENBUXNNQlFzZ0FTVEZBU1BFQVNQR0FTSUFJQUFiQkVBZ0FTVENBVUVBSk1RQkN3d0VDeUFCRUhBTUF3c01BZ3NnQUVHQS9nTkdCRUFnQVVIL0FYTWsxUUVqMVFFaUFrRVFjVUVBUnlUV0FTQUNRU0J4UVFCSEpOY0JDeUFBUVkvK0EwWUVRQ0FCRUJRTUFnc2dBRUgvL3dOR0JFQWdBUkFUREFJTFFRRVBDMEVBRHd0QkFRc2ZBQ1BhQVNBQVJnUkFRUUVrMndFTElBQWdBUkJ4QkVBZ0FDQUJFQVFMQzFvQkEzOERRQUpBSUFNZ0FrNE5BQ0FBSUFOcUVGc2hCU0FCSUFOcUlRUURRQ0FFUWYrL0Frb0VRQ0FFUVlCQWFpRUVEQUVMQ3lBRUlBVVFjaUFEUVFGcUlRTU1BUXNMSS9zQlFTQWpoQUowSUFKQkJIVnNhaVQ3QVF0eUFRSi9JL3dCUlFSQUR3dEJFQ0VBSS80QkkvOEJBbjhqL1FFaUFVRVFTQVJBSUFFaEFBc2dBQXNRY3lQK0FTQUFhaVQrQVNQL0FTQUFhaVQvQVNBQklBQnJJZ0VrL1FFaitnRWhBQ0FCUVFCTUJFQkJBQ1Q4QVNBQVFmOEJFQVFGSUFBZ0FVRUVkVUVCYTBIL2ZuRVFCQXNMUXdFQmZ3Si9JQUJGSWdKRkJFQWdBRUVCUmlFQ0N5QUNDd1IvSStnQkk5MEJSZ1VnQWdzRVFDQUJRUVJ5SWdGQndBQnhCRUFRUUFzRklBRkJlM0VoQVFzZ0FRdjZBUUVGZnlQZUFVVUVRQThMSTl3QklRTWdBeVBvQVNJRVFaQUJUZ1IvUVFFRkkrY0JJZ0pCK0FJamhBSjBJZ0JPQkg5QkFnVkJBMEVBSUFJZ0FFNGJDd3NpQVVjRVFFSEIvZ01RQWlFQUlBRWszQUZCQUNFQ0FrQUNRQUpBQWtBZ0FRUkFJQUZCQVdzT0F3RUNBd1FMSUFCQmZIRWlBRUVJY1VFQVJ5RUNEQU1MSUFCQmZYRkJBWElpQUVFUWNVRUFSeUVDREFJTElBQkJmbkZCQW5JaUFFRWdjVUVBUnlFQ0RBRUxJQUJCQTNJaEFBc2dBZ1JBRUVBTElBRkZCRUFRZEFzZ0FVRUJSZ1JBUVFFa3V3RkJBQkEvQzBIQi9nTWdBU0FBRUhVUUJBVWdCRUdaQVVZRVFFSEIvZ01nQVVIQi9nTVFBaEIxRUFRTEN3dWZBUUVCZnlQZUFRUkFJK2NCSUFCcUpPY0JJelFoQVFOQUkrY0JRUVFqaEFJaUFIUkJ5QU1nQUhRajZBRkJtUUZHRzA0RVFDUG5BVUVFSTRRQ0lnQjBRY2dESUFCMEkrZ0JRWmtCUmh0ckpPY0JJK2dCSWdCQmtBRkdCRUFnQVFSQUVEMEZJQUFRUEFzUVBrRi9KRWhCZnlSSkJTQUFRWkFCU0FSQUlBRkZCRUFnQUJBOEN3c0xRUUFnQUVFQmFpQUFRWmtCU2hzazZBRU1BUXNMQ3hCMkN6Y0JBWDlCQkNPRUFpSUFkRUhJQXlBQWRDUG9BVUdaQVVZYklRQURRQ1BtQVNBQVRnUkFJQUFRZHlQbUFTQUFheVRtQVF3QkN3c0x1QUVCQkg4anpBRkZCRUFQQ3dOQUlBTWdBRWdFUUNBRFFRUnFJUU1DZnlQSUFTSUNRUVJxSWdGQi8vOERTZ1JBSUFGQmdJQUVheUVCQ3lBQkN5VElBVUVCUVFKQkJ5UExBUnNpQkhRZ0FuRkJBRWNpQWdSQVFRRWdCSFFnQVhGRklRSUxJQUlFUUVHQi9nTkJnZjRERUFKQkFYUkJBV3BCL3dGeEVBUWp5UUZCQVdvaUFVRUlSZ1JBUVFBa3lRRkJBU1MrQVVFREVEOUJndjREUVlMK0F4QUNRZjkrY1JBRVFRQWt6QUVGSUFFa3lRRUxDd3dCQ3dzTGtBRUFJL3NCUVFCS0JFQWord0VnQUdvaEFFRUFKUHNCQ3lPUEFpQUFhaVNQQWlPVEFrVUVRQ015QkVBajVnRWdBR29rNWdFUWVBVWdBQkIzQ3lNeEJFQWpvQUVnQUdva29BRVFWd1VnQUJCV0N5QUFFSGtMSXpNRVFDUEFBU0FBYWlUQUFSQnVCU0FBRUcwTEk1WUNJQUJxSWdBamxBSk9CRUFqbFFKQkFXb2tsUUlnQUNPVUFtc2hBQXNnQUNTV0Fnc0xBRUVFRUhvampnSVFBZ3NuQVFGL1FRUVFlaU9PQWtFQmFrSC8vd054RUFJaEFCQjdRZjhCY1NBQVFmOEJjVUVJZEhJTERBQkJCQkI2SUFBZ0FSQnlDeklCQVg5QkFTQUFkRUgvQVhFaEFpQUJRUUJLQkVBampBSWdBbkpCL3dGeEpJd0NCU09NQWlBQ1FmOEJjM0VrakFJTEN3Z0FRUVVnQUJCK0N6Z0JBWDhnQVVFQVRnUkFJQUJCRDNFZ0FVRVBjV3BCRUhGQkFFY1Fmd1VnQVVFZmRTSUNJQUVnQW1welFROXhJQUJCRDNGTEVIOExDd2dBUVFjZ0FCQitDd2dBUVFZZ0FCQitDd2dBUVFRZ0FCQitDemtCQVg4Z0FVR0EvZ054UVFoMUlRSWdBQ0FCUWY4QmNTSUJFSEVFUUNBQUlBRVFCQXNnQUVFQmFpSUFJQUlRY1FSQUlBQWdBaEFFQ3dzTkFFRUlFSG9nQUNBQkVJUUJDMWdBSUFJRVFDQUJJQUJCLy84RGNTSUFhaUFBSUFGemN5SUNRUkJ4UVFCSEVIOGdBa0dBQW5GQkFFY1Fnd0VGSUFBZ0FXcEIvLzhEY1NJQ0lBQkIvLzhEY1VrUWd3RWdBQ0FCY3lBQ2MwR0FJSEZCQUVjUWZ3c0xDZ0JCQkJCNklBQVFXd3VZQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxEQlVMRUh4Qi8vOERjU0lBUVlEK0EzRkJDSFVraGdJZ0FFSC9BWEVraHdJTUR3c2pod0pCL3dGeEk0WUNRZjhCY1VFSWRISWpoUUlRZlF3VEN5T0hBa0gvQVhFamhnSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0dBZ3dUQ3lPR0FpSUFRUUVRZ0FFZ0FFRUJha0gvQVhFaUFDU0dBZ3dOQ3lPR0FpSUFRWDhRZ0FFZ0FFRUJhMEgvQVhFaUFDU0dBZ3dOQ3hCN1FmOEJjU1NHQWd3TkN5T0ZBaUlBUVlBQmNVR0FBVVlRZ3dFZ0FFRUJkQ0FBUWY4QmNVRUhkbkpCL3dGeEpJVUNEQTBMRUh4Qi8vOERjU09OQWhDRkFRd0lDeU9MQWtIL0FYRWppZ0pCL3dGeFFRaDBjaUlBSTRjQ1FmOEJjU09HQWtIL0FYRkJDSFJ5SWdGQkFCQ0dBU0FBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0lBQkIvd0Z4SklzQ1FRQVFnZ0ZCQ0E4TEk0Y0NRZjhCY1NPR0FrSC9BWEZCQ0hSeUVJY0JRZjhCY1NTRkFnd0xDeU9IQWtIL0FYRWpoZ0pCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NHQWd3TEN5T0hBaUlBUVFFUWdBRWdBRUVCYWtIL0FYRWlBQ1NIQWd3RkN5T0hBaUlBUVg4UWdBRWdBRUVCYTBIL0FYRWlBQ1NIQWd3RkN4QjdRZjhCY1NTSEFnd0ZDeU9GQWlJQVFRRnhRUUJMRUlNQklBQkJCM1FnQUVIL0FYRkJBWFp5UWY4QmNTU0ZBZ3dGQzBGL0R3c2pqZ0pCQW1wQi8vOERjU1NPQWd3RUN5QUFSUkNCQVVFQUVJSUJEQU1MSUFCRkVJRUJRUUVRZ2dFTUFnc2pqZ0pCQVdwQi8vOERjU1NPQWd3QkMwRUFFSUVCUVFBUWdnRkJBQkIvQzBFRUR3c2dBRUgvQVhFa2h3SkJDQXVIQmdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFUVJ3UkFJQUJCRVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEk0TUNCRUJCemY0REVJY0JRZjhCY1NJQVFRRnhCRUJCemY0RElBQkJmbkVpQUVHQUFYRUVmMEVBSklRQ0lBQkIvMzV4QlVFQkpJUUNJQUJCZ0FGeUN4QjlRY1FBRHdzTFFRRWtrd0lNRUFzUWZFSC8vd054SWdCQmdQNERjVUVJZFNTSUFpQUFRZjhCY1NTSkFpT09Ba0VDYWtILy93TnhKSTRDREJFTEk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUk0VUNFSDBNRUFzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhKQkFXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2lBSU1FQXNqaUFJaUFFRUJFSUFCSUFCQkFXcEIvd0Z4SklnQ0k0Z0NSUkNCQVVFQUVJSUJEQTRMSTRnQ0lnQkJmeENBQVNBQVFRRnJRZjhCY1NTSUFpT0lBa1VRZ1FGQkFSQ0NBUXdOQ3hCN1FmOEJjU1NJQWd3S0N5T0ZBaUlCUVlBQmNVR0FBVVloQUNPTUFrRUVka0VCY1NBQlFRRjBja0gvQVhFa2hRSU1DZ3NRZXlFQUk0NENJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTT0FrRUlEd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElpQUNPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2lJQlFRQVFoZ0VnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTS0FpQUFRZjhCY1NTTEFrRUFFSUlCUVFnUEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ0hBVUgvQVhFa2hRSU1DQXNqaVFKQi93RnhJNGdDUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVraUFJTUNBc2ppUUlpQUVFQkVJQUJJQUJCQVdwQi93RnhJZ0FraVFJZ0FFVVFnUUZCQUJDQ0FRd0dDeU9KQWlJQVFYOFFnQUVnQUVFQmEwSC9BWEVpQUNTSkFpQUFSUkNCQVVFQkVJSUJEQVVMRUh0Qi93RnhKSWtDREFJTEk0VUNJZ0ZCQVhGQkFVWWhBQ09NQWtFRWRrRUJjVUVIZENBQlFmOEJjVUVCZG5Ja2hRSU1BZ3RCZnc4TEk0NENRUUZxUWYvL0EzRWtqZ0lNQVFzZ0FCQ0RBVUVBRUlFQlFRQVFnZ0ZCQUJCL0MwRUVEd3NnQUVIL0FYRWtpUUpCQ0F2aUJnRUNmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCSUVjRVFDQUFRU0ZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPTUFrRUhka0VCY1FSQUk0NENRUUZxUWYvL0EzRWtqZ0lGRUhzaEFDT09BaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2pnSUxRUWdQQ3hCOFFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0lBQkIvd0Z4SklzQ0k0NENRUUpxUWYvL0EzRWtqZ0lNRkFzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJaUFDT0ZBaEI5REE4TEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJb0NEQTBMSTRvQ0lnQkJBUkNBQVNBQVFRRnFRZjhCY1NJQUpJb0NEQTRMSTRvQ0lnQkJmeENBQVNBQVFRRnJRZjhCY1NJQUpJb0NEQTRMRUh0Qi93RnhKSW9DREE0TFFRWkJBQ09NQWlJQ1FRVjJRUUZ4UVFCTEd5SUJRZUFBY2lBQklBSkJCSFpCQVhGQkFFc2JJUUVqaFFJaEFDQUNRUVoyUVFGeFFRQkxCSDhnQUNBQmEwSC9BWEVGSUFGQkJuSWdBU0FBUVE5eFFRbExHeUlCUWVBQWNpQUJJQUJCbVFGTEd5SUJJQUJxUWY4QmNRc2lBRVVRZ1FFZ0FVSGdBSEZCQUVjUWd3RkJBQkIvSUFBa2hRSU1EZ3NqakFKQkIzWkJBWEZCQUVzRVFCQjdJUUFqamdJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSTRDQlNPT0FrRUJha0gvL3dOeEpJNENDMEVJRHdzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJaUFDQUFRZi8vQTNGQkFCQ0dBU0FBUVFGMFFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0lBQkIvd0Z4SklzQ1FRQVFnZ0ZCQ0E4TEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUlnQVFod0ZCL3dGeEpJVUNEQWNMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0RBVUxJNHNDSWdCQkFSQ0FBU0FBUVFGcVFmOEJjU0lBSklzQ0RBWUxJNHNDSWdCQmZ4Q0FBU0FBUVFGclFmOEJjU0lBSklzQ0RBWUxFSHRCL3dGeEpJc0NEQVlMSTRVQ1FYOXpRZjhCY1NTRkFrRUJFSUlCUVFFUWZ3d0dDMEYvRHdzZ0FFSC9BWEVraXdKQkNBOExJQUJCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraWdJZ0FFSC9BWEVraXdJTUF3c2dBRVVRZ1FGQkFCQ0NBUXdDQ3lBQVJSQ0JBVUVCRUlJQkRBRUxJNDRDUVFGcVFmLy9BM0VramdJTFFRUUwyd1VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBZ0FFRXhhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqakFKQkJIWkJBWEVFUUNPT0FrRUJha0gvL3dOeEpJNENCUkI3SVFBampnSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054Skk0Q0MwRUlEd3NRZkVILy93TnhKSTBDSTQ0Q1FRSnFRZi8vQTNFa2pnSU1FUXNqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElpQUNPRkFoQjlEQTRMSTQwQ1FRRnFRZi8vQTNFa2pRSkJDQThMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5SWdFUWh3RWlBRUVCRUlBQklBQkJBV3BCL3dGeElnQkZFSUVCUVFBUWdnRWdBU0FBRUgwTURnc2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISWlBUkNIQVNJQVFYOFFnQUVnQUVFQmEwSC9BWEVpQUVVUWdRRkJBUkNDQVNBQklBQVFmUXdOQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2hCN1FmOEJjUkI5REFzTFFRQVFnZ0ZCQUJCL1FRRVFnd0VNQ3dzampBSkJCSFpCQVhGQkFVWUVRQkI3SVFBampnSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054Skk0Q0JTT09Ba0VCYWtILy93TnhKSTRDQzBFSUR3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISWlBQ09OQWtFQUVJWUJJNDBDSUFCcVFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0lBQkIvd0Z4SklzQ1FRQVFnZ0ZCQ0E4TEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUlnQVFod0ZCL3dGeEpJVUNEQVlMSTQwQ1FRRnJRZi8vQTNFa2pRSkJDQThMSTRVQ0lnQkJBUkNBQVNBQVFRRnFRZjhCY1NJQUpJVUNJQUJGRUlFQlFRQVFnZ0VNQmdzamhRSWlBRUYvRUlBQklBQkJBV3RCL3dGeElnQWtoUUlnQUVVUWdRRkJBUkNDQVF3RkN4QjdRZjhCY1NTRkFnd0RDMEVBRUlJQlFRQVFmeU9NQWtFRWRrRUJjVUVBVFJDREFRd0RDMEYvRHdzZ0FFRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0tBaUFBUWY4QmNTU0xBZ3dCQ3lPT0FrRUJha0gvL3dOeEpJNENDMEVFQzRJQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBQkhCRUFnQUVIQkFFWU5BUUpBSUFCQndnQnJEZzREQkFVR0J3Z0pFUW9MREEwT0R3QUxEQThMREE4TEk0Y0NKSVlDREE0TEk0Z0NKSVlDREEwTEk0a0NKSVlDREF3TEk0b0NKSVlDREFzTEk0c0NKSVlDREFvTEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUVJY0JRZjhCY1NTR0Fnd0pDeU9GQWlTR0Fnd0lDeU9HQWlTSEFnd0hDeU9JQWlTSEFnd0dDeU9KQWlTSEFnd0ZDeU9LQWlTSEFnd0VDeU9MQWlTSEFnd0RDeU9MQWtIL0FYRWppZ0pCL3dGeFFRaDBjaENIQVVIL0FYRWtod0lNQWdzamhRSWtod0lNQVF0QmZ3OExRUVFML1FFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFCSEJFQWdBRUhSQUVZTkFRSkFJQUJCMGdCckRnNFFBd1FGQmdjSUNRb1FDd3dORGdBTERBNExJNFlDSklnQ0RBNExJNGNDSklnQ0RBMExJNGtDSklnQ0RBd0xJNG9DSklnQ0RBc0xJNHNDSklnQ0RBb0xJNHNDUWY4QmNTT0tBa0gvQVhGQkNIUnlFSWNCUWY4QmNTU0lBZ3dKQ3lPRkFpU0lBZ3dJQ3lPR0FpU0pBZ3dIQ3lPSEFpU0pBZ3dHQ3lPSUFpU0pBZ3dGQ3lPS0FpU0pBZ3dFQ3lPTEFpU0pBZ3dEQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2hDSEFVSC9BWEVraVFJTUFnc2poUUlraVFJTUFRdEJmdzhMUVFRTC9RRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUVIaEFFWU5BUUpBSUFCQjRnQnJEZzREQkJBRkJnY0lDUW9MREJBTkRnQUxEQTRMSTRZQ0pJb0NEQTRMSTRjQ0pJb0NEQTBMSTRnQ0pJb0NEQXdMSTRrQ0pJb0NEQXNMSTRzQ0pJb0NEQW9MSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5RUljQlFmOEJjU1NLQWd3SkN5T0ZBaVNLQWd3SUN5T0dBaVNMQWd3SEN5T0hBaVNMQWd3R0N5T0lBaVNMQWd3RkN5T0pBaVNMQWd3RUN5T0tBaVNMQWd3REN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNoQ0hBVUgvQVhFa2l3SU1BZ3NqaFFJa2l3SU1BUXRCZnc4TFFRUUxsQU1BQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUVjRVFDQUFRZkVBUmcwQkFrQWdBRUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhSQUFzTUR3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISWpoZ0lRZlF3UEN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNpT0hBaEI5REE0TEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUk0Z0NFSDBNRFFzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJamlRSVFmUXdNQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2lPS0FoQjlEQXNMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5STRzQ0VIME1DZ3NqL0FGRkJFQUNRQ095QVFSQVFRRWtrQUlNQVFzanRBRWp1Z0Z4UVI5eFJRUkFRUUVra1FJTUFRdEJBU1NTQWdzTERBa0xJNHNDUWY4QmNTT0tBa0gvQVhGQkNIUnlJNFVDRUgwTUNBc2poZ0lraFFJTUJ3c2pod0lraFFJTUJnc2ppQUlraFFJTUJRc2ppUUlraFFJTUJBc2ppZ0lraFFJTUF3c2ppd0lraFFJTUFnc2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0ZCL3dGeEpJVUNEQUVMUVg4UEMwRUVDemNCQVg4Z0FVRUFUZ1JBSUFCQi93RnhJQUFnQVdwQi93RnhTeENEQVFVZ0FVRWZkU0lDSUFFZ0FtcHpJQUJCL3dGeFNoQ0RBUXNMTkFFQ2Z5T0ZBaUlCSUFCQi93RnhJZ0lRZ0FFZ0FTQUNFSkFCSUFBZ0FXcEIvd0Z4SWdFa2hRSWdBVVVRZ1FGQkFCQ0NBUXRYQVFKL0k0VUNJZ0VnQUdvampBSkJCSFpCQVhGcVFmOEJjU0lDSUFBZ0FYTnpRUkJ4UVFCSEVIOGdBRUgvQVhFZ0FXb2pqQUpCQkhaQkFYRnFRWUFDY1VFQVN4Q0RBU0FDSklVQ0lBSkZFSUVCUVFBUWdnRUxnd0lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR0FBVWNFUUNBQlFZRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqaGdJUWtRRU1FQXNqaHdJUWtRRU1Ed3NqaUFJUWtRRU1EZ3NqaVFJUWtRRU1EUXNqaWdJUWtRRU1EQXNqaXdJUWtRRU1Dd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFUWtRRU1DZ3NqaFFJUWtRRU1DUXNqaGdJUWtnRU1DQXNqaHdJUWtnRU1Cd3NqaUFJUWtnRU1CZ3NqaVFJUWtnRU1CUXNqaWdJUWtnRU1CQXNqaXdJUWtnRU1Bd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFUWtnRU1BZ3NqaFFJUWtnRU1BUXRCZnc4TFFRUUxOd0VDZnlPRkFpSUJJQUJCL3dGeFFYOXNJZ0lRZ0FFZ0FTQUNFSkFCSUFFZ0FHdEIvd0Z4SWdFa2hRSWdBVVVRZ1FGQkFSQ0NBUXRYQVFKL0k0VUNJZ0VnQUdzampBSkJCSFpCQVhGclFmOEJjU0lDSUFBZ0FYTnpRUkJ4UVFCSEVIOGdBU0FBUWY4QmNXc2pqQUpCQkhaQkFYRnJRWUFDY1VFQVN4Q0RBU0FDSklVQ0lBSkZFSUVCUVFFUWdnRUxnd0lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR1FBVWNFUUNBQlFaRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqaGdJUWxBRU1FQXNqaHdJUWxBRU1Ed3NqaUFJUWxBRU1EZ3NqaVFJUWxBRU1EUXNqaWdJUWxBRU1EQXNqaXdJUWxBRU1Dd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFUWxBRU1DZ3NqaFFJUWxBRU1DUXNqaGdJUWxRRU1DQXNqaHdJUWxRRU1Cd3NqaUFJUWxRRU1CZ3NqaVFJUWxRRU1CUXNqaWdJUWxRRU1CQXNqaXdJUWxRRU1Bd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFUWxRRU1BZ3NqaFFJUWxRRU1BUXRCZnc4TFFRUUxJd0VCZnlPRkFpQUFjU0lCSklVQ0lBRkZFSUVCUVFBUWdnRkJBUkIvUVFBUWd3RUxKd0VCZnlPRkFpQUFjMEgvQVhFaUFTU0ZBaUFCUlJDQkFVRUFFSUlCUVFBUWYwRUFFSU1CQzRNQ0FRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCb0FGSEJFQWdBVUdoQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEk0WUNFSmNCREJBTEk0Y0NFSmNCREE4TEk0Z0NFSmNCREE0TEk0a0NFSmNCREEwTEk0b0NFSmNCREF3TEk0c0NFSmNCREFzTEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUVJY0JFSmNCREFvTEk0VUNFSmNCREFrTEk0WUNFSmdCREFnTEk0Y0NFSmdCREFjTEk0Z0NFSmdCREFZTEk0a0NFSmdCREFVTEk0b0NFSmdCREFRTEk0c0NFSmdCREFNTEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUVJY0JFSmdCREFJTEk0VUNFSmdCREFFTFFYOFBDMEVFQ3lVQUk0VUNJQUJ5UWY4QmNTSUFKSVVDSUFCRkVJRUJRUUFRZ2dGQkFCQi9RUUFRZ3dFTExBRUJmeU9GQWlJQklBQkIvd0Z4UVg5c0lnQVFnQUVnQVNBQUVKQUJJQUFnQVdwRkVJRUJRUUVRZ2dFTGd3SUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHd0FVY0VRQ0FCUWJFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2poZ0lRbWdFTUVBc2pod0lRbWdFTUR3c2ppQUlRbWdFTURnc2ppUUlRbWdFTURRc2ppZ0lRbWdFTURBc2ppd0lRbWdFTUN3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VRbWdFTUNnc2poUUlRbWdFTUNRc2poZ0lRbXdFTUNBc2pod0lRbXdFTUJ3c2ppQUlRbXdFTUJnc2ppUUlRbXdFTUJRc2ppZ0lRbXdFTUJBc2ppd0lRbXdFTUF3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VRbXdFTUFnc2poUUlRbXdFTUFRdEJmdzhMUVFRTE93RUJmeUFBRUZvaUFVRi9SZ1IvSUFBUUFnVWdBUXRCL3dGeElBQkJBV29pQVJCYUlnQkJmMFlFZnlBQkVBSUZJQUFMUWY4QmNVRUlkSElMQ3dCQkNCQjZJQUFRblFFTE13QWdBRUdBQVhGQmdBRkdFSU1CSUFCQkFYUWdBRUgvQVhGQkIzWnlRZjhCY1NJQVJSQ0JBVUVBRUlJQlFRQVFmeUFBQ3pFQUlBQkJBWEZCQUVzUWd3RWdBRUVIZENBQVFmOEJjVUVCZG5KQi93RnhJZ0JGRUlFQlFRQVFnZ0ZCQUJCL0lBQUxPUUVCZnlPTUFrRUVka0VCY1NBQVFRRjBja0gvQVhFaEFTQUFRWUFCY1VHQUFVWVFnd0VnQVNJQVJSQ0JBVUVBRUlJQlFRQVFmeUFBQ3pvQkFYOGpqQUpCQkhaQkFYRkJCM1FnQUVIL0FYRkJBWFp5SVFFZ0FFRUJjVUVCUmhDREFTQUJJZ0JGRUlFQlFRQVFnZ0ZCQUJCL0lBQUxLUUFnQUVHQUFYRkJnQUZHRUlNQklBQkJBWFJCL3dGeElnQkZFSUVCUVFBUWdnRkJBQkIvSUFBTFJBRUNmeUFBUVFGeFFRRkdJUUVnQUVHQUFYRkJnQUZHSVFJZ0FFSC9BWEZCQVhZaUFFR0FBWElnQUNBQ0d5SUFSUkNCQVVFQUVJSUJRUUFRZnlBQkVJTUJJQUFMS2dBZ0FFRVBjVUVFZENBQVFmQUJjVUVFZG5JaUFFVVFnUUZCQUJDQ0FVRUFFSDlCQUJDREFTQUFDeTBCQVg4Z0FFRUJjVUVCUmlFQklBQkIvd0Z4UVFGMklnQkZFSUVCUVFBUWdnRkJBQkIvSUFFUWd3RWdBQXNkQUVFQklBQjBJQUZ4UWY4QmNVVVFnUUZCQUJDQ0FVRUJFSDhnQVF1eENBRUdmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVIY1NJR0lnVUVRQ0FGUVFGckRnY0JBZ01FQlFZSENBc2poZ0loQVF3SEN5T0hBaUVCREFZTEk0Z0NJUUVNQlFzamlRSWhBUXdFQ3lPS0FpRUJEQU1MSTRzQ0lRRU1BZ3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFaEFRd0JDeU9GQWlFQkN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdVaUJBUkFJQVJCQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTElBQkJCMHdFZjBFQklRSWdBUkNmQVFVZ0FFRVBUQVIvUVFFaEFpQUJFS0FCQlVFQUN3c2hBd3dQQ3lBQVFSZE1CSDlCQVNFQ0lBRVFvUUVGSUFCQkgwd0VmMEVCSVFJZ0FSQ2lBUVZCQUFzTElRTU1EZ3NnQUVFblRBUi9RUUVoQWlBQkVLTUJCU0FBUVM5TUJIOUJBU0VDSUFFUXBBRUZRUUFMQ3lFRERBMExJQUJCTjB3RWYwRUJJUUlnQVJDbEFRVWdBRUUvVEFSL1FRRWhBaUFCRUtZQkJVRUFDd3NoQXd3TUN5QUFRY2NBVEFSL1FRRWhBa0VBSUFFUXB3RUZJQUJCendCTUJIOUJBU0VDUVFFZ0FSQ25BUVZCQUFzTElRTU1Dd3NnQUVIWEFFd0VmMEVCSVFKQkFpQUJFS2NCQlNBQVFkOEFUQVIvUVFFaEFrRURJQUVRcHdFRlFRQUxDeUVEREFvTElBQkI1d0JNQkg5QkFTRUNRUVFnQVJDbkFRVWdBRUh2QUV3RWYwRUJJUUpCQlNBQkVLY0JCVUVBQ3dzaEF3d0pDeUFBUWZjQVRBUi9RUUVoQWtFR0lBRVFwd0VGSUFCQi93Qk1CSDlCQVNFQ1FRY2dBUkNuQVFWQkFBc0xJUU1NQ0FzZ0FFR0hBVXdFZjBFQklRSWdBVUYrY1FVZ0FFR1BBVXdFZjBFQklRSWdBVUY5Y1FWQkFBc0xJUU1NQndzZ0FFR1hBVXdFZjBFQklRSWdBVUY3Y1FVZ0FFR2ZBVXdFZjBFQklRSWdBVUYzY1FWQkFBc0xJUU1NQmdzZ0FFR25BVXdFZjBFQklRSWdBVUZ2Y1FVZ0FFR3ZBVXdFZjBFQklRSWdBVUZmY1FWQkFBc0xJUU1NQlFzZ0FFRzNBVXdFZjBFQklRSWdBVUcvZjNFRklBQkJ2d0ZNQkg5QkFTRUNJQUZCLzM1eEJVRUFDd3NoQXd3RUN5QUFRY2NCVEFSL1FRRWhBaUFCUVFGeUJTQUFRYzhCVEFSL1FRRWhBaUFCUVFKeUJVRUFDd3NoQXd3REN5QUFRZGNCVEFSL1FRRWhBaUFCUVFSeUJTQUFRZDhCVEFSL1FRRWhBaUFCUVFoeUJVRUFDd3NoQXd3Q0N5QUFRZWNCVEFSL1FRRWhBaUFCUVJCeUJTQUFRZThCVEFSL1FRRWhBaUFCUVNCeUJVRUFDd3NoQXd3QkN5QUFRZmNCVEFSL1FRRWhBaUFCUWNBQWNnVWdBRUgvQVV3RWYwRUJJUUlnQVVHQUFYSUZRUUFMQ3lFREN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0JpSUVCRUFnQkVFQmF3NEhBUUlEQkFVR0J3Z0xJQU1raGdJTUJ3c2dBeVNIQWd3R0N5QURKSWdDREFVTElBTWtpUUlNQkFzZ0F5U0tBZ3dEQ3lBREpJc0NEQUlMSUFWQkJFZ2lCQVIvSUFRRklBVkJCMG9MQkVBaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJZ0F4QjlDd3dCQ3lBREpJVUNDMEVFUVg4Z0Foc0xxd1FBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FCUndSQUlBQkJ3UUZyRGc4QkFoRURCQVVHQndnSkNnc1FEQTBPQ3lPTUFrRUhka0VCY1EwUkRBNExJNDBDRUo0QlFmLy9BM0VoQUNPTkFrRUNha0gvL3dOeEpJMENJQUJCZ1A0RGNVRUlkU1NHQWlBQVFmOEJjU1NIQWtFRUR3c2pqQUpCQjNaQkFYRU5FUXdPQ3lPTUFrRUhka0VCY1EwUURBd0xJNDBDUVFKclFmLy9BM0VpQUNTTkFpQUFJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlFSVVCREEwTEVIc1FrUUVNRFFzampRSkJBbXRCLy84RGNTSUFKSTBDSUFBampnSVFoUUZCQUNTT0Fnd0xDeU9NQWtFSGRrRUJjVUVCUncwS0RBY0xJNDBDSWdBUW5nRkIvLzhEY1NTT0FpQUFRUUpxUWYvL0EzRWtqUUlNQ1FzampBSkJCM1pCQVhGQkFVWU5Cd3dLQ3hCN1FmOEJjUkNvQVNFQUk0NENRUUZxUWYvL0EzRWtqZ0lnQUE4TEk0d0NRUWQyUVFGeFFRRkhEUWdqalFKQkFtdEIvLzhEY1NJQUpJMENJQUFqamdKQkFtcEIvLzhEY1JDRkFRd0ZDeEI3RUpJQkRBWUxJNDBDUVFKclFmLy9BM0VpQUNTTkFpQUFJNDRDRUlVQlFRZ2tqZ0lNQkF0QmZ3OExJNDBDSWdBUW5nRkIvLzhEY1NTT0FpQUFRUUpxUWYvL0EzRWtqUUpCREE4TEk0MENRUUpyUWYvL0EzRWlBQ1NOQWlBQUk0NENRUUpxUWYvL0EzRVFoUUVMRUh4Qi8vOERjU1NPQWd0QkNBOExJNDRDUVFGcVFmLy9BM0VramdKQkJBOExJNDRDUVFKcVFmLy9BM0VramdKQkRBdXFCQUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIUUFVY0VRQ0FBUWRFQmF3NFBBUUlOQXdRRkJnY0lDUTBLRFFzTURRc2pqQUpCQkhaQkFYRU5EeU9OQWlJQUVKNEJRZi8vQTNFa2pnSWdBRUVDYWtILy93TnhKSTBDUVF3UEN5T05BaUlBRUo0QlFmLy9BM0VoQVNBQVFRSnFRZi8vQTNFa2pRSWdBVUdBL2dOeFFRaDFKSWdDSUFGQi93RnhKSWtDUVFRUEN5T01Ba0VFZGtFQmNRMExEQXdMSTR3Q1FRUjJRUUZ4RFFvampRSkJBbXRCLy84RGNTSUJKSTBDSUFFampnSkJBbXBCLy84RGNSQ0ZBUXdMQ3lPTkFrRUNhMEgvL3dOeElnRWtqUUlnQVNPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDRkFRd0xDeEI3RUpRQkRBc0xJNDBDUVFKclFmLy9BM0VpQVNTTkFpQUJJNDRDRUlVQlFSQWtqZ0lNQ1FzampBSkJCSFpCQVhGQkFVY05DQ09OQWlJQkVKNEJRZi8vQTNFa2pnSWdBVUVDYWtILy93TnhKSTBDUVF3UEN5T05BaUlCRUo0QlFmLy9BM0VramdKQkFTU3pBU0FCUVFKcVFmLy9BM0VralFJTUJ3c2pqQUpCQkhaQkFYRkJBVVlOQlF3RUN5T01Ba0VFZGtFQmNVRUJSdzBESTQwQ1FRSnJRZi8vQTNFaUFTU05BaUFCSTQ0Q1FRSnFRZi8vQTNFUWhRRU1CQXNRZXhDVkFRd0ZDeU9OQWtFQ2EwSC8vd054SWdFa2pRSWdBU09PQWhDRkFVRVlKSTRDREFNTFFYOFBDeU9PQWtFQ2FrSC8vd054Skk0Q1FRd1BDeEI4UWYvL0EzRWtqZ0lMUVFnUEN5T09Ba0VCYWtILy93TnhKSTRDUVFRTG5RTUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQVVjRVFDQUFRZUVCYXc0UEFRSUxDd01FQlFZSENBc0xDd2tLQ3dzUWUwSC9BWEZCZ1A0RGFpT0ZBaEI5REFzTEk0MENJZ0FRbmdGQi8vOERjU0VCSUFCQkFtcEIvLzhEY1NTTkFpQUJRWUQrQTNGQkNIVWtpZ0lnQVVIL0FYRWtpd0pCQkE4TEk0Y0NRWUQrQTJvamhRSVFmVUVFRHdzampRSkJBbXRCLy84RGNTSUJKSTBDSUFFaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJUWhRRkJDQThMRUhzUWx3RU1Cd3NqalFKQkFtdEIvLzhEY1NJQkpJMENJQUVqamdJUWhRRkJJQ1NPQWtFSUR3c1FlMEVZZEVFWWRTRUJJNDBDSUFGQkFSQ0dBU09OQWlBQmFrSC8vd054SkkwQ1FRQVFnUUZCQUJDQ0FTT09Ba0VCYWtILy93TnhKSTRDUVF3UEN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNpU09Ba0VFRHdzUWZFSC8vd054STRVQ0VIMGpqZ0pCQW1wQi8vOERjU1NPQWtFRUR3c1FleENZQVF3Q0N5T05Ba0VDYTBILy93TnhJZ0VralFJZ0FTT09BaENGQVVFb0pJNENRUWdQQzBGL0R3c2pqZ0pCQVdwQi8vOERjU1NPQWtFRUM5WURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZIQkVBZ0FFSHhBV3NPRHdFQ0F3MEVCUVlIQ0FrS0RRMExEQTBMRUh0Qi93RnhRWUQrQTJvUWh3RkIvd0Z4SklVQ0RBMExJNDBDSWdBUW5nRkIvLzhEY1NFQklBQkJBbXBCLy84RGNTU05BaUFCUVlEK0EzRkJDSFVraFFJZ0FVSC9BWEVrakFJTURRc2pod0pCZ1A0RGFoQ0hBVUgvQVhFa2hRSU1EQXRCQUNTeUFRd0xDeU9OQWtFQ2EwSC8vd054SWdFa2pRSWdBU09NQWtIL0FYRWpoUUpCL3dGeFFRaDBjaENGQVVFSUR3c1FleENhQVF3SUN5T05Ba0VDYTBILy93TnhJZ0VralFJZ0FTT09BaENGQVVFd0pJNENRUWdQQ3hCN1FSaDBRUmgxSVFFampRSWhBRUVBRUlFQlFRQVFnZ0VnQUNBQlFRRVFoZ0VnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTS0FpQUFRZjhCY1NTTEFpT09Ba0VCYWtILy93TnhKSTRDUVFnUEN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNpU05Ba0VJRHdzUWZFSC8vd054RUljQlFmOEJjU1NGQWlPT0FrRUNha0gvL3dOeEpJNENEQVVMUVFFa3N3RU1CQXNRZXhDYkFRd0NDeU9OQWtFQ2EwSC8vd054SWdBa2pRSWdBQ09PQWhDRkFVRTRKSTRDUVFnUEMwRi9Ed3NqamdKQkFXcEIvLzhEY1NTT0FndEJCQXZqQVFFQmZ5T09Ba0VCYWtILy93TnhJUUVqa2dJRVFDQUJRUUZyUWYvL0EzRWhBUXNnQVNTT0FnSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lCQkVBZ0FVRUJSZzBCQWtBZ0FVRUNhdzROQXdRRkJnY0lDUW9MREEwT0R3QUxEQThMSUFBUWlBRVBDeUFBRUlrQkR3c2dBQkNLQVE4TElBQVFpd0VQQ3lBQUVJd0JEd3NnQUJDTkFROExJQUFRamdFUEN5QUFFSThCRHdzZ0FCQ1RBUThMSUFBUWxnRVBDeUFBRUprQkR3c2dBQkNjQVE4TElBQVFxUUVQQ3lBQUVLb0JEd3NnQUJDckFROExJQUFRckFFTHZnRUJBbjlCQUNTeUFVR1AvZ01RQWtFQklBQjBRWDl6Y1NJQkpMb0JRWS8rQXlBQkVBUWpqUUpCQW10Qi8vOERjU1NOQWlPTkFpSUJJNDRDSWdKQi93RnhFQVFnQVVFQmFpQUNRWUQrQTNGQkNIVVFCQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQXdNRUJRQUxEQVVMUVFBa3V3RkJ3QUFramdJTUJBdEJBQ1M4QVVISUFDU09BZ3dEQzBFQUpMMEJRZEFBSkk0Q0RBSUxRUUFrdmdGQjJBQWtqZ0lNQVF0QkFDUy9BVUhnQUNTT0Fnc0wrUUVCQTM4anN3RUVRRUVCSkxJQlFRQWtzd0VMSTdRQkk3b0JjVUVmY1VFQVNnUkFJNUVDUlNPeUFTSUNJQUliQkg4anV3RWp0UUVpQUNBQUd3Ui9RUUFRcmdGQkFRVWp2QUVqdGdFaUFDQUFHd1IvUVFFUXJnRkJBUVVqdlFFanR3RWlBQ0FBR3dSL1FRSVFyZ0ZCQVFVanZnRWp1QUVpQUNBQUd3Ui9RUU1RcmdGQkFRVWp2d0VqdVFFaUFDQUFHd1IvUVFRUXJnRkJBUVZCQUFzTEN3c0xCVUVBQ3dSQUk1QUNJZ0Fqa1FJZ0FCc0VmMEVBSkpFQ1FRQWtrQUpCQUNTU0FrRUFKSk1DUVJnRlFSUUxJUUVMSTVBQ0lnQWprUUlnQUJzRVFFRUFKSkVDUVFBa2tBSkJBQ1NTQWtFQUpKTUNDeUFCRHd0QkFBdTdBUUVDZjBFQkpKMENJNUlDQkVBampnSVFBa0gvQVhFUXJRRVFla0VBSkpFQ1FRQWtrQUpCQUNTU0FrRUFKSk1DQ3hDdkFTSUFRUUJLQkVBZ0FCQjZDMEVFSVFFamtBSWlBQ09SQWlBQUcwVWlBQVIvSTVNQ1JRVWdBQXNFUUNPT0FoQUNRZjhCY1JDdEFTRUJDeU9NQWtId0FYRWtqQUlnQVVFQVRBUkFJQUVQQ3lBQkVIb2ptUUpCQVdvaUFDT1hBazRFZnlPWUFrRUJhaVNZQWlBQUk1Y0Nhd1VnQUFza21RSWpqZ0lqMkFGR0JFQkJBU1RiQVFzZ0FRc0ZBQ093QVF2TUFRRUVmeUFBUVg5QmdBZ2dBRUVBU0JzZ0FFRUFTaHNoQTBFQUlRQURRQUovQW44Z0JFVWlBUVJBSUFCRklRRUxJQUVMQkVBZ0FrVWhBUXNnQVFzRVFDUGJBVVVoQVFzZ0FRUkFFTEFCUVFCSUJFQkJBU0VFQlNPUEFrSFFwQVFqaEFKMFRnUkFRUUVoQUFVZ0EwRi9TaUlCQkVBanNBRWdBMDRoQVF0QkFTQUNJQUViSVFJTEN3d0JDd3NnQUFSQUk0OENRZENrQkNPRUFuUnJKSThDSTVvQ0R3c2dBZ1JBSTVzQ0R3c2oyd0VFUUVFQUpOc0JJNXdDRHdzampnSkJBV3RCLy84RGNTU09Ba0YvQ3djQVFYOFFzZ0VMT1FFRGZ3TkFJQUlnQUVnaUF3Ui9JQUZCQUU0RklBTUxCRUJCZnhDeUFTRUJJQUpCQVdvaEFnd0JDd3NnQVVFQVNBUkFJQUVQQzBFQUN3VUFJNVFDQ3dVQUk1VUNDd1VBSTVZQ0MxOEJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVFKQUlBRkJBbXNPQmdNRUJRWUhDQUFMREFnTEk4MEJEd3NqMEFFUEN5UE9BUThMSTg4QkR3c2owUUVQQ3lQU0FROExJOU1CRHdzajFBRVBDMEVBQzRzQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQ1FRRkdEUUVDUUNBQ1FRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lBQlFRQkhKTTBCREFjTElBRkJBRWNrMEFFTUJnc2dBVUVBUnlUT0FRd0ZDeUFCUVFCSEpNOEJEQVFMSUFGQkFFY2swUUVNQXdzZ0FVRUFSeVRTQVF3Q0N5QUJRUUJISk5NQkRBRUxJQUZCQUVjazFBRUxDMVVCQVg5QkFDU1RBaUFBRUxnQlJRUkFRUUVoQVFzZ0FFRUJFTGtCSUFFRVFFRUJRUUZCQUVFQlFRQWdBRUVEVEJzaUFTUFdBU0lBSUFBYkd5QUJSU1BYQVNJQUlBQWJHd1JBUVFFa3Z3RkJCQkEvQ3dzTENRQWdBRUVBRUxrQkM1b0JBQ0FBUVFCS0JFQkJBQkM2QVFWQkFCQzdBUXNnQVVFQVNnUkFRUUVRdWdFRlFRRVF1d0VMSUFKQkFFb0VRRUVDRUxvQkJVRUNFTHNCQ3lBRFFRQktCRUJCQXhDNkFRVkJBeEM3QVFzZ0JFRUFTZ1JBUVFRUXVnRUZRUVFRdXdFTElBVkJBRW9FUUVFRkVMb0JCVUVGRUxzQkN5QUdRUUJLQkVCQkJoQzZBUVZCQmhDN0FRc2dCMEVBU2dSQVFRY1F1Z0VGUVFjUXV3RUxDd2NBSUFBazJBRUxCd0JCZnlUWUFRc0hBQ0FBSk5rQkN3Y0FRWDhrMlFFTEJ3QWdBQ1RhQVFzSEFFRi9KTm9CQ3dVQUk0VUNDd1VBSTRZQ0N3VUFJNGNDQ3dVQUk0Z0NDd1VBSTRrQ0N3VUFJNG9DQ3dVQUk0c0NDd1VBSTR3Q0N3VUFJNDRDQ3dVQUk0MENDd3NBSTQ0Q0VBSkIvd0Z4Q3dVQUkrZ0JDOEVEQVFwL1FZQ0FBa0dBa0FJajRRRWJJUWxCZ0xnQ1FZQ3dBaVBpQVJzaENnTkFJQVpCZ0FKSUJFQkJBQ0VGQTBBZ0JVR0FBa2dFUUNBSklBWkJBM1ZCQlhRZ0Ntb2dCVUVEZFdvaUEwR0FrSDVxTFFBQUVESWhDQ0FHUVFodklRRkJCeUFGUVFodmF5RUhRUUFoQWdKL0lBQkJBRW9qZ3dJaUJDQUVHd1JBSUFOQmdOQithaTBBQUNFQ0N5QUNRY0FBY1FzRVFFRUhJQUZySVFFTFFRQWhCQ0FCUVFGMElBaHFJZ05CZ0pCK2FrRUJRUUFnQWtFSWNSc2lCRUVCY1VFTmRHb3RBQUFoQ0VFQUlRRWdBMEdCa0g1cUlBUkJBWEZCRFhScUxRQUFRUUVnQjNSeEJFQkJBaUVCQ3lBQlFRRnFJQUZCQVNBSGRDQUljUnNoQVNBR1FRaDBJQVZxUVFOc0lRY2dBRUVBU2lPREFpSURJQU1iQkVBZ0FrRUhjU0FCUVFBUU15SUJRUjl4UVFOMElRUWdBVUhnQjNGQkJYVkJBM1FoQXlBQlFZRDRBWEZCQ25WQkEzUWhBaUFIUVlDaEMyb2lBU0FFT2dBQUlBRkJBV29nQXpvQUFDQUJRUUpxSUFJNkFBQUZJQWRCZ0tFTGFpSUNJQUZCeC80REVEUWlBVUdBZ1B3SGNVRVFkVG9BQUNBQ1FRRnFJQUZCZ1A0RGNVRUlkVG9BQUNBQ1FRSnFJQUU2QUFBTElBVkJBV29oQlF3QkN3c2dCa0VCYWlFR0RBRUxDd3ZkQXdFTWZ3TkFJQU5CRjA1RkJFQkJBQ0VDQTBBZ0FrRWZTQVJBUVFGQkFDQUNRUTlLR3lFSklBTkJEMnNnQXlBRFFROUtHMEVFZENJSElBSkJEMnRxSUFJZ0Iyb2dBa0VQU2hzaEIwR0FrQUpCZ0lBQ0lBTkJEMG9iSVF0QngvNERJUXBCZnlFQlFYOGhDRUVBSVFRRFFDQUVRUWhJQkVCQkFDRUFBMEFnQUVFRlNBUkFJQUJCQTNRZ0JHcEJBblFpQlVHQy9BTnFFQUlnQjBZRVFDQUZRWVA4QTJvUUFpRUdRUUZCQUNBR1FRaHhRUUJISTRNQ0k0TUNHeHNnQ1VZRVFFRUlJUVJCQlNFQUlBWWlDRUVRY1FSL1FjbitBd1ZCeVA0REN5RUtDd3NnQUVFQmFpRUFEQUVMQ3lBRVFRRnFJUVFNQVFzTElBaEJBRWdqZ3dJaUJpQUdHd1JBUVlDNEFrR0FzQUlqNGdFYklRUkJmeUVBUVFBaEFRTkFJQUZCSUVnRVFFRUFJUVVEUUNBRlFTQklCRUFnQlVFRmRDQUVhaUFCYWlJR1FZQ1FmbW90QUFBZ0IwWUVRRUVnSVFVZ0JpRUFRU0FoQVFzZ0JVRUJhaUVGREFFTEN5QUJRUUZxSVFFTUFRc0xJQUJCQUU0RWZ5QUFRWURRZm1vdEFBQUZRWDhMSVFFTFFRQWhBQU5BSUFCQkNFZ0VRQ0FISUFzZ0NVRUFRUWNnQUNBQ1FRTjBJQU5CQTNRZ0FHcEIrQUZCZ0tFWElBb2dBU0FJRURVYUlBQkJBV29oQUF3QkN3c2dBa0VCYWlFQ0RBRUxDeUFEUVFGcUlRTU1BUXNMQzVvQ0FRbC9BMEFnQkVFSVRrVUVRRUVBSVFFRFFDQUJRUVZJQkVBZ0FVRURkQ0FFYWtFQ2RDSUFRWUQ4QTJvUUFob2dBRUdCL0FOcUVBSWFJQUJCZ3Z3RGFoQUNJUUpCQVNFRkkrTUJCRUFnQWtFQ2IwRUJSZ1JBSUFKQkFXc2hBZ3RCQWlFRkN5QUFRWVA4QTJvUUFpRUdRUUFoQjBFQlFRQWdCa0VJY1VFQVJ5T0RBaU9EQWhzYklRZEJ5UDRESVFoQnlmNERRY2orQXlBR1FSQnhHeUVJUVFBaEFBTkFJQUFnQlVnRVFFRUFJUU1EUUNBRFFRaElCRUFnQUNBQ2FrR0FnQUlnQjBFQVFRY2dBeUFFUVFOMElBRkJCSFFnQTJvZ0FFRURkR3BCd0FCQmdLRWdJQWhCZnlBR0VEVWFJQU5CQVdvaEF3d0JDd3NnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTElBUkJBV29oQkF3QkN3c0xCUUFqd1FFTEJRQWp3Z0VMQlFBanhRRUxHQUVCZnlQSEFTRUFJOFlCQkVBZ0FFRUVjaUVBQ3lBQUN6QUJBWDhEUUFKQUlBQkIvLzhEVGcwQUlBQkJnTFhKQkdvZ0FCQmJPZ0FBSUFCQkFXb2hBQXdCQ3d0QkFDVGJBUXNXQUJBQVB3QkJsQUZJQkVCQmxBRS9BR3RBQUJvTEN3TUFBUXNkQUFKQUFrQUNRQ09lQWc0Q0FRSUFDd0FMUVFBaEFBc2dBQkN5QVFzSEFDQUFKSjRDQ3lVQUFrQUNRQUpBQWtBam5nSU9Bd0VDQXdBTEFBdEJBU0VBQzBGL0lRRUxJQUVRc2dFTEFETVFjMjkxY21ObFRXRndjR2x1WjFWU1RDRmpiM0psTDJScGMzUXZZMjl5WlM1MWJuUnZkV05vWldRdWQyRnpiUzV0WVhBPSIpOgoidW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3d8fCJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY/YXdhaXQgSSgiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJpd0VTWUFBQVlBcC9mMzkvZjM5L2YzOS9BR0FCZndGL1lBRi9BR0FDZjM4QVlBSi9md0YvWUFBQmYyQURmMzkvQUdBR2YzOS9mMzkvQUdBSGYzOS9mMzkvZndGL1lBTi9mMzhCZjJBSGYzOS9mMzkvZndCZ0JIOS9mMzhCZjJBSWYzOS9mMzkvZjM4QVlBVi9mMzkvZndGL1lBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0FuOS9BR0FCZndGL0E5NEIzQUVBQWdJQUJBQUFBd01BQUFBQUFBQUFBd0FBQXdNQUFBQUFBUVlBQUFBQUFBQUFBQU1EQUFBQUFBQUFBQUFHQmdZR0RnVUtCUThKQ3dnSUJ3UURBQUFEQUFBQUFBQURBQUFBQUFBQ0FnVUNBZ0lDQlF3REF3TUFBZ1lDQWdRREF3TURBQUFBQUFVREJnWURCQUlGQXdBQUF3VUVCd0FGQUFNQUF3TUdCZ1FRQXdRREF3TUVCQWNDQWdJQ0FnSUNBZ0lFQXdNQ0F3TUNBd01DQXdNQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJREJnWUdFUVlDQmdZR0FnUURBdzBEQUFNQUF3QUdCZ1lHQmdZR0JnWUdCZ1lEQUFBR0JnWUdBQUFBQWdNRkJBUUJjQUFCQlFNQkFBQUdtQXlmQW44QVFRQUxmd0JCZ0FnTGZ3QkJnQWdMZndCQmdBZ0xmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FFQXQvQUVHQWdBUUxmd0JCZ0pBRUMzOEFRWUFCQzM4QVFZQ1JCQXQvQUVHQXVBRUxmd0JCZ01rRkMzOEFRWURZQlF0L0FFR0FvUXNMZndCQmdJQU1DMzhBUVlDaEZ3dC9BRUdBZ0FrTGZ3QkJnS0VnQzM4QVFZRDRBQXQvQUVHQWtBUUxmd0JCZ0lrZEMzOEFRWUNaSVF0L0FFR0FnQWdMZndCQmdKa3BDMzhBUVlDQUNBdC9BRUdBbVRFTGZ3QkJnSUFJQzM4QVFZQ1pPUXQvQUVHQWdBZ0xmd0JCZ0puQkFBdC9BRUdBZ0FnTGZ3QkJnSm5KQUF0L0FFR0FnQWdMZndCQmdKblJBQXQvQUVHQUZBdC9BRUdBcmRFQUMzOEFRWUNJK0FNTGZ3QkJnTFhKQkF0L0FFSC8vd01MZndCQkFBdC9BRUdBdGMwRUMzOEFRWlFCQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkI2UDREQzM4QlFlbitBd3QvQVVIci9nTUxmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWY4QUMzOEJRZjhBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUdBOXdJTGZ3RkJBQXQvQVVFQUMzOEJRWUNBQ0F0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRWDhMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQjBmNERDMzhCUWRMK0F3dC9BVUhUL2dNTGZ3RkIxUDREQzM4QlFkWCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCei80REMzOEJRZkQrQXd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJnS2pXdVFjTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVDQzM4QlFRQUxmd0ZCQUFzSHV4QmhCbTFsYlc5eWVRSUFCWFJoWW14bEFRQUdZMjl1Wm1sbkFCa09hR0Z6UTI5eVpWTjBZWEowWldRQUdnbHpZWFpsVTNSaGRHVUFJUWxzYjJGa1UzUmhkR1VBTEFWcGMwZENRd0F0RW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFBdUMyZGxkRk4wWlhCVFpYUnpBQzhJWjJWMFUzUmxjSE1BTUJWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUF0QUVNWlhobFkzVjBaVVp5WVcxbEFMTUJDRjl6WlhSaGNtZGpBTm9CR1dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzhBMlFFVlpYaGxZM1YwWlZWdWRHbHNRMjl1WkdsMGFXOXVBTnNCQzJWNFpXTjFkR1ZUZEdWd0FMQUJGR2RsZEVONVkyeGxjMUJsY2tONVkyeGxVMlYwQUxVQkRHZGxkRU41WTJ4bFUyVjBjd0MyQVFsblpYUkRlV05zWlhNQXR3RU9jMlYwU205NWNHRmtVM1JoZEdVQXZBRWZaMlYwVG5WdFltVnlUMlpUWVcxd2JHVnpTVzVCZFdScGIwSjFabVpsY2dDeEFSQmpiR1ZoY2tGMVpHbHZRblZtWm1WeUFDZ2NjMlYwVFdGdWRXRnNRMjlzYjNKcGVtRjBhVzl1VUdGc1pYUjBaUUFIRjFkQlUwMUNUMWxmVFVWTlQxSlpYMHhQUTBGVVNVOU9BeXdUVjBGVFRVSlBXVjlOUlUxUFVsbGZVMGxhUlFNdEVsZEJVMDFDVDFsZlYwRlRUVjlRUVVkRlV3TXVIa0ZUVTBWTlFreFpVME5TU1ZCVVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNQUdrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlUU1ZwRkF3RVdWMEZUVFVKUFdWOVRWRUZVUlY5TVQwTkJWRWxQVGdNQ0VsZEJVMDFDVDFsZlUxUkJWRVZmVTBsYVJRTURJRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3b2NSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1MRWxaSlJFVlBYMUpCVFY5TVQwTkJWRWxQVGdNRURsWkpSRVZQWDFKQlRWOVRTVnBGQXdVUlYwOVNTMTlTUVUxZlRFOURRVlJKVDA0REJnMVhUMUpMWDFKQlRWOVRTVnBGQXdjbVQxUklSVkpmUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNERDQ0pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd2tZUjFKQlVFaEpRMU5mVDFWVVVGVlVYMHhQUTBGVVNVOU9BeGdVUjFKQlVFaEpRMU5mVDFWVVVGVlVYMU5KV2tVREdSUkhRa05mVUVGTVJWUlVSVjlNVDBOQlZFbFBUZ01NRUVkQ1ExOVFRVXhGVkZSRlgxTkpXa1VERFJoQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVEU5RFFWUkpUMDRERGhSQ1IxOVFVa2xQVWtsVVdWOU5RVkJmVTBsYVJRTVBEa1pTUVUxRlgweFBRMEZVU1U5T0F4QUtSbEpCVFVWZlUwbGFSUU1SRjBKQlEwdEhVazlWVGtSZlRVRlFYMHhQUTBGVVNVOU9BeElUUWtGRFMwZFNUMVZPUkY5TlFWQmZVMGxhUlFNVEVsUkpURVZmUkVGVVFWOU1UME5CVkVsUFRnTVVEbFJKVEVWZlJFRlVRVjlUU1ZwRkF4VVNUMEZOWDFSSlRFVlRYMHhQUTBGVVNVOU9BeFlPVDBGTlgxUkpURVZUWDFOSldrVURGeFZCVlVSSlQxOUNWVVpHUlZKZlRFOURRVlJKVDA0REloRkJWVVJKVDE5Q1ZVWkdSVkpmVTBsYVJRTWpHVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZURTlEUVZSSlQwNERHaFZEU0VGT1RrVk1YekZmUWxWR1JrVlNYMU5KV2tVREd4bERTRUZPVGtWTVh6SmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4d1ZRMGhCVGs1RlRGOHlYMEpWUmtaRlVsOVRTVnBGQXgwWlEwaEJUazVGVEY4elgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZUZVTklRVTVPUlV4Zk0xOUNWVVpHUlZKZlUwbGFSUU1mR1VOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESUJWRFNFRk9Ua1ZNWHpSZlFsVkdSa1ZTWDFOSldrVURJUlpEUVZKVVVrbEVSMFZmVWtGTlgweFBRMEZVU1U5T0F5UVNRMEZTVkZKSlJFZEZYMUpCVFY5VFNWcEZBeVVSUWs5UFZGOVNUMDFmVEU5RFFWUkpUMDRESmcxQ1QwOVVYMUpQVFY5VFNWcEZBeWNXUTBGU1ZGSkpSRWRGWDFKUFRWOU1UME5CVkVsUFRnTW9Fa05CVWxSU1NVUkhSVjlTVDAxZlUwbGFSUU1wSFVSRlFsVkhYMGRCVFVWQ1QxbGZUVVZOVDFKWlgweFBRMEZVU1U5T0F5b1pSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVTBsYVJRTXJJV2RsZEZkaGMyMUNiM2xQWm1aelpYUkdjbTl0UjJGdFpVSnZlVTltWm5ObGRBQUJHM05sZEZCeWIyZHlZVzFEYjNWdWRHVnlRbkpsWVd0d2IybHVkQUM5QVIxeVpYTmxkRkJ5YjJkeVlXMURiM1Z1ZEdWeVFuSmxZV3R3YjJsdWRBQytBUmx6WlhSU1pXRmtSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBTDhCRzNKbGMyVjBVbVZoWkVkaVRXVnRiM0o1UW5KbFlXdHdiMmx1ZEFEQUFScHpaWFJYY21sMFpVZGlUV1Z0YjNKNVFuSmxZV3R3YjJsdWRBREJBUnh5WlhObGRGZHlhWFJsUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQU1JQkRHZGxkRkpsWjJsemRHVnlRUUREQVF4blpYUlNaV2RwYzNSbGNrSUF4QUVNWjJWMFVtVm5hWE4wWlhKREFNVUJER2RsZEZKbFoybHpkR1Z5UkFER0FReG5aWFJTWldkcGMzUmxja1VBeHdFTVoyVjBVbVZuYVhOMFpYSklBTWdCREdkbGRGSmxaMmx6ZEdWeVRBREpBUXhuWlhSU1pXZHBjM1JsY2tZQXlnRVJaMlYwVUhKdlozSmhiVU52ZFc1MFpYSUF5d0VQWjJWMFUzUmhZMnRRYjJsdWRHVnlBTXdCR1dkbGRFOXdZMjlrWlVGMFVISnZaM0poYlVOdmRXNTBaWElBelFFRloyVjBURmtBemdFZFpISmhkMEpoWTJ0bmNtOTFibVJOWVhCVWIxZGhjMjFOWlcxdmNua0F6d0VZWkhKaGQxUnBiR1ZFWVhSaFZHOVhZWE50VFdWdGIzSjVBTkFCRTJSeVlYZFBZVzFVYjFkaGMyMU5aVzF2Y25rQTBRRUdaMlYwUkVsV0FOSUJCMmRsZEZSSlRVRUEwd0VHWjJWMFZFMUJBTlFCQm1kbGRGUkJRd0RWQVJOMWNHUmhkR1ZFWldKMVowZENUV1Z0YjNKNUFOWUJDQUxYQVFrSUFRQkJBQXNCMkFFSzcrY0IzQUZUQUVIeTVjc0hKRGxCb01HQ0JTUTZRZGl3NFFJa08wR0lrQ0FrUEVIeTVjc0hKRDFCb01HQ0JTUStRZGl3NFFJa1AwR0lrQ0FrUUVIeTVjc0hKRUZCb01HQ0JTUkNRZGl3NFFJa1EwR0lrQ0FrUkF1YkFnRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVNZFNJQkJFQWdBVUVCYXc0TkFRRUJBZ0lDQWdNREJBUUZCZ2NMSTRJQ0JFQWpnd0lFUUNBQVFZQUNTQTBKSUFCQi93TktJZ0VFZnlBQVFZQVNTQVVnQVFzTkNRVWpnd0pGSWdFRWZ5QUFRWUFDU0FVZ0FRc05DUXNMQ3lBQVFZQ3QwUUJxRHdzZ0FFRUJJKzBCSWdFajlRRkZJZ0FFZnlBQlJRVWdBQXNiUVE1MGFrR0FyZEFBYWc4TElBQkJnSkIrYWlPREFnUi9JNEFDRUFKQkFYRUZRUUFMUVExMGFnOExJQUFqN2dGQkRYUnFRWURaeGdCcUR3c2dBRUdBa0g1cUR3dEJBQ0VCQW44amd3SUVRQ09CQWhBQ1FRZHhJUUVMSUFGQkFVZ0xCSDlCQVFVZ0FRdEJESFFnQUdwQmdQQjlhZzhMSUFCQmdGQnFEd3NnQUVHQW1kRUFhZ3NKQUNBQUVBRXRBQUFMd3dFQVFRQWtoQUpCQUNTRkFrRUFKSVlDUVFBa2h3SkJBQ1NJQWtFQUpJa0NRUUFraWdKQkFDU0xBa0VBSkl3Q1FRQWtqUUpCQUNTT0FrRUFKSThDUVFBa2tBSkJBQ1NSQWtFQUpKSUNRUUFra3dJamdnSUVRQThMSTRNQ0JFQkJFU1NGQWtHQUFTU01Ba0VBSklZQ1FRQWtod0pCL3dFa2lBSkIxZ0FraVFKQkFDU0tBa0VOSklzQ0JVRUJKSVVDUWJBQkpJd0NRUUFraGdKQkV5U0hBa0VBSklnQ1FkZ0JKSWtDUVFFa2lnSkJ6UUFraXdJTFFZQUNKSTRDUWY3L0F5U05BZ3NMQUNBQUVBRWdBVG9BQUF1SkFRRUNmMEVBSk84QlFRRWs4QUZCeHdJUUFpSUJSU1R4QVNBQlFRRk9JZ0FFUUNBQlFRTk1JUUFMSUFBazhnRWdBVUVGVGlJQUJFQWdBVUVHVENFQUN5QUFKUE1CSUFGQkQwNGlBQVJBSUFGQkUwd2hBQXNnQUNUMEFTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQWs5UUZCQVNUdEFVRUFKTzRCSTRBQ1FRQVFCQ09CQWtFQkVBUUxMd0JCMGY0RFFmOEJFQVJCMHY0RFFmOEJFQVJCMC80RFFmOEJFQVJCMVA0RFFmOEJFQVJCMWY0RFFmOEJFQVFMdEFnQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ3NEQkFVR0J3Z0pDZ3NNRFFBTERBMExRZkxseXdja09VR2d3WUlGSkRwQjJMRGhBaVE3UVlpUUlDUThRZkxseXdja1BVR2d3WUlGSkQ1QjJMRGhBaVEvUVlpUUlDUkFRZkxseXdja1FVR2d3WUlGSkVKQjJMRGhBaVJEUVlpUUlDUkVEQXdMUWYvLy93Y2tPVUhqMnY0SEpEcEJnT0tRQkNRN1FRQWtQRUgvLy84SEpEMUI0OXIrQnlRK1FZRGlrQVFrUDBFQUpFQkIvLy8vQnlSQlFlUGEvZ2NrUWtHQTRwQUVKRU5CQUNSRURBc0xRZi8vL3dja09VR0VpZjRISkRwQnV2VFFCQ1E3UVFBa1BFSC8vLzhISkQxQnNmN3ZBeVErUVlDSUFpUS9RUUFrUUVILy8vOEhKRUZCLzh1T0F5UkNRZjhCSkVOQkFDUkVEQW9MUWNYTi93Y2tPVUdFdWJvR0pEcEJxZGFSQkNRN1FZamk2QUlrUEVILy8vOEhKRDFCNDlyK0J5UStRWURpa0FRa1AwRUFKRUJCLy8vL0J5UkJRZVBhL2dja1FrR0E0cEFFSkVOQkFDUkVEQWtMUWYvLy93Y2tPVUdBL3NzQ0pEcEJnSVQ5QnlRN1FRQWtQRUgvLy84SEpEMUJnUDdMQWlRK1FZQ0UvUWNrUDBFQUpFQkIvLy8vQnlSQlFZRCt5d0lrUWtHQWhQMEhKRU5CQUNSRURBZ0xRZi8vL3dja09VR3gvdThESkRwQnhjY0JKRHRCQUNROFFmLy8vd2NrUFVHRWlmNEhKRDVCdXZUUUJDUS9RUUFrUUVILy8vOEhKRUZCaEluK0J5UkNRYnIwMEFRa1EwRUFKRVFNQnd0QkFDUTVRWVNKQWlRNlFZQzgvd2NrTzBILy8vOEhKRHhCQUNROVFZU0pBaVErUVlDOC93Y2tQMEgvLy84SEpFQkJBQ1JCUVlTSkFpUkNRWUM4L3dja1EwSC8vLzhISkVRTUJndEJwZi8vQnlRNVFaU3AvZ2NrT2tIL3FkSUVKRHRCQUNROFFhWC8vd2NrUFVHVXFmNEhKRDVCLzZuU0JDUS9RUUFrUUVHbC8vOEhKRUZCbEtuK0J5UkNRZitwMGdRa1EwRUFKRVFNQlF0Qi8vLy9CeVE1UVlEKy93Y2tPa0dBZ1B3SEpEdEJBQ1E4UWYvLy93Y2tQVUdBL3Y4SEpENUJnSUQ4QnlRL1FRQWtRRUgvLy84SEpFRkJnUDcvQnlSQ1FZQ0EvQWNrUTBFQUpFUU1CQXRCLy8vL0J5UTVRWUQrL3dja09rR0FsTzBESkR0QkFDUThRZi8vL3dja1BVSC95NDRESkQ1Qi93RWtQMEVBSkVCQi8vLy9CeVJCUWJIKzd3TWtRa0dBaUFJa1EwRUFKRVFNQXd0Qi8vLy9CeVE1UWYvTGpnTWtPa0gvQVNRN1FRQWtQRUgvLy84SEpEMUJoSW4rQnlRK1FicjAwQVFrUDBFQUpFQkIvLy8vQnlSQlFiSCs3d01rUWtHQWlBSWtRMEVBSkVRTUFndEIvLy8vQnlRNVFkNlpzZ1FrT2tHTXBja0NKRHRCQUNROFFmLy8vd2NrUFVHRWlmNEhKRDVCdXZUUUJDUS9RUUFrUUVILy8vOEhKRUZCNDlyK0J5UkNRWURpa0FRa1EwRUFKRVFNQVF0Qi8vLy9CeVE1UWFYTGxnVWtPa0hTcE1rQ0pEdEJBQ1E4UWYvLy93Y2tQVUdseTVZRkpENUIwcVRKQWlRL1FRQWtRRUgvLy84SEpFRkJwY3VXQlNSQ1FkS2t5UUlrUTBFQUpFUUxDOTRJQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmlBRkhCRUFnQUNJQlFlRUFSZzBCSUFGQkZFWU5BaUFCUWNZQVJnMERJQUZCMlFCR0RRUWdBVUhHQVVZTkJDQUJRWVlCUmcwRklBRkJxQUZHRFFVZ0FVRy9BVVlOQmlBQlFjNEJSZzBHSUFGQjBRRkdEUVlnQVVId0FVWU5CaUFCUVNkR0RRY2dBVUhKQUVZTkJ5QUJRZHdBUmcwSElBRkJzd0ZHRFFjZ0FVSEpBVVlOQ0NBQlFmQUFSZzBKSUFGQnhnQkdEUW9nQVVIVEFVWU5Dd3dNQzBIL3VaWUZKRGxCZ1A3L0J5UTZRWURHQVNRN1FRQWtQRUgvdVpZRkpEMUJnUDcvQnlRK1FZREdBU1EvUVFBa1FFSC91WllGSkVGQmdQNy9CeVJDUVlER0FTUkRRUUFrUkF3TEMwSC8vLzhISkRsQi84dU9BeVE2UWY4QkpEdEJBQ1E4UWYvLy93Y2tQVUdFaWY0SEpENUJ1dlRRQkNRL1FRQWtRRUgvLy84SEpFRkIvOHVPQXlSQ1FmOEJKRU5CQUNSRURBb0xRZi8vL3dja09VR0VpZjRISkRwQnV2VFFCQ1E3UVFBa1BFSC8vLzhISkQxQnNmN3ZBeVErUVlDSUFpUS9RUUFrUUVILy8vOEhKRUZCaEluK0J5UkNRYnIwMEFRa1EwRUFKRVFNQ1F0Qi8rdldCU1E1UVpULy93Y2tPa0hDdExVRkpEdEJBQ1E4UVFBa1BVSC8vLzhISkQ1QmhJbitCeVEvUWJyMDBBUWtRRUVBSkVGQi8vLy9CeVJDUVlTSi9nY2tRMEc2OU5BRUpFUU1DQXRCLy8vL0J5UTVRWVRidGdVa09rSDc1b2tDSkR0QkFDUThRZi8vL3dja1BVR0E1djBISkQ1QmdJVFJCQ1EvUVFBa1FFSC8vLzhISkVGQi8vdnFBaVJDUVlDQS9BY2tRMEgvQVNSRURBY0xRWnovL3dja09VSC82OUlFSkRwQjg2aU9BeVE3UWJyMEFDUThRY0tLL3dja1BVR0FyUDhISkQ1QmdQVFFCQ1EvUVlDQXFBSWtRRUgvLy84SEpFRkJoSW4rQnlSQ1FicjAwQVFrUTBFQUpFUU1CZ3RCZ1A2dkF5UTVRZi8vL3dja09rSEtwUDBISkR0QkFDUThRZi8vL3dja1BVSC8vLzhISkQ1Qi84dU9BeVEvUWY4QkpFQkIvLy8vQnlSQlFlUGEvZ2NrUWtHQTRwQUVKRU5CQUNSRURBVUxRZis1bGdVa09VR0EvdjhISkRwQmdNWUJKRHRCQUNROFFkTEcvUWNrUFVHQWdOZ0dKRDVCZ0lDTUF5US9RUUFrUUVIL0FTUkJRZi8vL3dja1FrSDcvdjhISkVOQi80a0NKRVFNQkF0Qnp2Ly9CeVE1UWUvZmp3TWtPa0d4aVBJRUpEdEIyclRwQWlROFFmLy8vd2NrUFVHQTV2MEhKRDVCZ0lUUkJDUS9RUUFrUUVILy8vOEhKRUZCLzh1T0F5UkNRZjhCSkVOQkFDUkVEQU1MUWYvLy93Y2tPVUdFaWY0SEpEcEJ1dlRRQkNRN1FRQWtQRUgvLy84SEpEMUJnUDRESkQ1QmdJakdBU1EvUVlDVUFTUkFRZi8vL3dja1FVSC95NDRESkVKQi93RWtRMEVBSkVRTUFndEIvLy8vQnlRNVFmL0xqZ01rT2tIL0FTUTdRUUFrUEVHQS92OEhKRDFCZ0lEOEJ5UStRWUNBakFNa1AwRUFKRUJCLy8vL0J5UkJRYkgrN3dNa1FrR0FpQUlrUTBFQUpFUU1BUXRCLy8vL0J5UTVRWVRidGdVa09rSDc1b2tDSkR0QkFDUThRZi8vL3dja1BVSGoydjRISkQ1QjQ5citCeVEvUVFBa1FFSC8vLzhISkVGQi84dU9BeVJDUWY4QkpFTkJBQ1JFQ3d0S0FRSi9RUUFRQnlPREFnUkFEd3NqZ2dJRVFDT0RBa1VFUUE4TEMwRzBBaUVBQTBBQ1FDQUFRY01DU2cwQUlBQVFBaUFCYWlFQklBQkJBV29oQUF3QkN3c2dBVUgvQVhFUUNBdmNBUUJCQUNUbUFVRUFKT2NCUVFBazZBRkJBQ1RwQVVFQUpPb0JRUUFrNndGQkFDVHNBVUdRQVNUb0FTT0RBZ1JBUWNIK0EwR0JBUkFFUWNUK0EwR1FBUkFFUWNmK0EwSDhBUkFFQlVIQi9nTkJoUUVRQkVIRy9nTkIvd0VRQkVISC9nTkIvQUVRQkVISS9nTkIvd0VRQkVISi9nTkIvd0VRQkF0QmtBRWs2QUZCd1A0RFFaQUJFQVJCei80RFFRQVFCRUh3L2dOQkFSQUVJNElDQkVBamd3SUVRRUVBSk9nQlFjRCtBMEVBRUFSQndmNERRWUFCRUFSQnhQNERRUUFRQkFWQkFDVG9BVUhBL2dOQkFCQUVRY0grQTBHRUFSQUVDd3NRQ1F0dUFDT0RBZ1JBUWVqK0EwSEFBUkFFUWVuK0EwSC9BUkFFUWVyK0EwSEJBUkFFUWV2K0EwRU5FQVFGUWVqK0EwSC9BUkFFUWVuK0EwSC9BUkFFUWVyK0EwSC9BUkFFUWV2K0EwSC9BUkFFQ3lPREFpT0NBaU9DQWhzRVFFSHAvZ05CSUJBRVFlditBMEdLQVJBRUN3dFdBRUdRL2dOQmdBRVFCRUdSL2dOQnZ3RVFCRUdTL2dOQjh3RVFCRUdUL2dOQndRRVFCRUdVL2dOQnZ3RVFCQ09DQWdSQVFaSCtBMEUvRUFSQmt2NERRUUFRQkVHVC9nTkJBQkFFUVpUK0EwRzRBUkFFQ3dzc0FFR1YvZ05CL3dFUUJFR1cvZ05CUHhBRVFaZitBMEVBRUFSQm1QNERRUUFRQkVHWi9nTkJ1QUVRQkFzekFFR2EvZ05CL3dBUUJFR2IvZ05CL3dFUUJFR2MvZ05CbndFUUJFR2QvZ05CQUJBRVFaNytBMEc0QVJBRVFRRWtnUUVMTFFCQm4vNERRZjhCRUFSQm9QNERRZjhCRUFSQm9mNERRUUFRQkVHaS9nTkJBQkFFUWFQK0EwRy9BUkFFQzF3QUlBQkJnQUZ4UVFCSEpLWUJJQUJCd0FCeFFRQkhKS1VCSUFCQklIRkJBRWNrcEFFZ0FFRVFjVUVBUnlTakFTQUFRUWh4UVFCSEpLb0JJQUJCQkhGQkFFY2txUUVnQUVFQ2NVRUFSeVNvQVNBQVFRRnhRUUJISktjQkMwVUFRUThra3dGQkR5U1VBVUVQSkpVQlFROGtsZ0ZCQUNTWEFVRUFKSmdCUVFBa21RRkJBQ1NhQVVIL0FDU2JBVUgvQUNTY0FVRUJKSjBCUVFFa25nRkJBQ1NmQVF1OUFRQkJBQ1NnQVVFQUpLRUJRUUFrb2dGQkFTU2pBVUVCSktRQlFRRWtwUUZCQVNTbUFVRUJKS2NCUVFFa3FBRkJBU1NwQVVFQkpLb0JRUUVrcXdGQkFDU3NBVUVBSkswQlFRQWtyd0ZCQUNTd0FSQU1FQTBRRGhBUFFhVCtBMEgzQUJBRVFRY2tvUUZCQnlTaUFVR2wvZ05COHdFUUJFSHpBUkFRUWFiK0EwSHhBUkFFUVFFa3F3RWpnZ0lFUUVHay9nTkJBQkFFUVFBa29RRkJBQ1NpQVVHbC9nTkJBQkFFUVFBUUVFR20vZ05COEFBUUJFRUFKS3NCQ3hBUkN6NEFJQUJCQVhGQkFFY2t0UUVnQUVFQ2NVRUFSeVMyQVNBQVFRUnhRUUJISkxjQklBQkJDSEZCQUVja3VBRWdBRUVRY1VFQVJ5UzVBU0FBSkxRQkN6NEFJQUJCQVhGQkFFY2t1d0VnQUVFQ2NVRUFSeVM4QVNBQVFRUnhRUUJISkwwQklBQkJDSEZCQUVja3ZnRWdBRUVRY1VFQVJ5Uy9BU0FBSkxvQkMzZ0FRUUFrd0FGQkFDVEJBVUVBSk1JQlFRQWt4UUZCQUNUR0FVRUFKTWNCUVFBa3d3RkJBQ1RFQVNPREFnUkFRWVQrQTBFZUVBUkJvRDBrd1FFRlFZVCtBMEdyQVJBRVFjelhBaVRCQVF0QmgvNERRZmdCRUFSQitBRWt4d0VqZ2dJRVFDT0RBa1VFUUVHRS9nTkJBQkFFUVFRa3dRRUxDd3REQUVFQUpNZ0JRUUFreVFFamd3SUVRRUdDL2dOQi9BQVFCRUVBSk1vQlFRQWt5d0ZCQUNUTUFRVkJndjREUWY0QUVBUkJBQ1RLQVVFQkpNc0JRUUFrekFFTEMzVUFJNE1DQkVCQjhQNERRZmdCRUFSQnovNERRZjRCRUFSQnpmNERRZjRBRUFSQmdQNERRYzhCRUFSQmovNERRZUVCRUFSQjdQNERRZjRCRUFSQjlmNERRWThCRUFRRlFmRCtBMEgvQVJBRVFjLytBMEgvQVJBRVFjMytBMEgvQVJBRVFZRCtBMEhQQVJBRVFZLytBMEhoQVJBRUN3dWFBUUVDZjBIREFoQUNJZ0ZCd0FGR0lnQUVmeUFBQlNBQlFZQUJSaU13SWdBZ0FCc0xCRUJCQVNTREFnVkJBQ1NEQWd0QkFDU2RBa0dBcU5hNUJ5U1VBa0VBSkpVQ1FRQWtsZ0pCZ0tqV3VRY2tsd0pCQUNTWUFrRUFKSmtDSXk4RVFFRUJKSUlDQlVFQUpJSUNDeEFERUFVUUJoQUtFQXNRRWtFQUVCTkIvLzhESTdRQkVBUkI0UUVRRkVHUC9nTWp1Z0VRQkJBVkVCWVFGd3RLQUNBQVFRQktKQzhnQVVFQVNpUXdJQUpCQUVva01TQURRUUJLSkRJZ0JFRUFTaVF6SUFWQkFFb2tOQ0FHUVFCS0pEVWdCMEVBU2lRMklBaEJBRW9rTnlBSlFRQktKRGdRR0FzRkFDT2RBZ3U1QVFCQmdBZ2poUUk2QUFCQmdRZ2poZ0k2QUFCQmdnZ2pod0k2QUFCQmd3Z2ppQUk2QUFCQmhBZ2ppUUk2QUFCQmhRZ2ppZ0k2QUFCQmhnZ2ppd0k2QUFCQmh3Z2pqQUk2QUFCQmlBZ2pqUUk3QVFCQmlnZ2pqZ0k3QVFCQmpBZ2pqd0kyQWdCQmtRZ2prQUpCQUVjNkFBQkJrZ2dqa1FKQkFFYzZBQUJCa3dnamtnSkJBRWM2QUFCQmxBZ2prd0pCQUVjNkFBQkJsUWdqZ2dKQkFFYzZBQUJCbGdnamd3SkJBRWM2QUFCQmx3Z2poQUpCQUVjNkFBQUxhQUJCeUFrajdRRTdBUUJCeWdrajdnRTdBUUJCekFrajd3RkJBRWM2QUFCQnpRa2o4QUZCQUVjNkFBQkJ6Z2tqOFFGQkFFYzZBQUJCendrajhnRkJBRWM2QUFCQjBBa2o4d0ZCQUVjNkFBQkIwUWtqOUFGQkFFYzZBQUJCMGdrajlRRkJBRWM2QUFBTE5RQkIrZ2tqd0FFMkFnQkIvZ2tqd1FFMkFnQkJnZ29qd3dGQkFFYzZBQUJCaFFvanhBRkJBRWM2QUFCQmhmNERJOElCRUFRTFdBQkIzZ29qVmtFQVJ6b0FBRUhmQ2lOWk5nSUFRZU1LSTFvMkFnQkI1d29qV3pZQ0FFSHNDaU5jTmdJQVFmRUtJMTA2QUFCQjhnb2pYam9BQUVIM0NpTmZRUUJIT2dBQVFmZ0tJMkEyQWdCQi9Rb2pZVHNCQUFzOUFFR1FDeU5yUVFCSE9nQUFRWkVMSTI0MkFnQkJsUXNqYnpZQ0FFR1pDeU53TmdJQVFaNExJM0UyQWdCQm93c2pjam9BQUVHa0N5TnpPZ0FBQ3pzQVFmUUxJNHNCUVFCSE9nQUFRZlVMSTQwQk5nSUFRZmtMSTQ0Qk5nSUFRZjBMSTQ4Qk5nSUFRWUlNSTVBQk5nSUFRWWNNSTVJQk93RUFDNFFCQUJBYlFiSUlJK2NCTmdJQVFiWUlJOXdCT2dBQVFjVCtBeVBvQVJBRVFlUUlJN0lCUVFCSE9nQUFRZVVJSTdNQlFRQkhPZ0FBRUJ3UUhVR3NDaU9zQVRZQ0FFR3dDaU90QVRvQUFFR3hDaU92QVRvQUFCQWVFQjlCd2dzamVrRUFSem9BQUVIREN5TjlOZ0lBUWNjTEkzNDJBZ0JCeXdzamZ6c0JBQkFnUVFBa25RSUx1UUVBUVlBSUxRQUFKSVVDUVlFSUxRQUFKSVlDUVlJSUxRQUFKSWNDUVlNSUxRQUFKSWdDUVlRSUxRQUFKSWtDUVlVSUxRQUFKSW9DUVlZSUxRQUFKSXNDUVljSUxRQUFKSXdDUVlnSUx3RUFKSTBDUVlvSUx3RUFKSTRDUVl3SUtBSUFKSThDUVpFSUxRQUFRUUJLSkpBQ1FaSUlMUUFBUVFCS0pKRUNRWk1JTFFBQVFRQktKSklDUVpRSUxRQUFRUUJLSkpNQ1FaVUlMUUFBUVFCS0pJSUNRWllJTFFBQVFRQktKSU1DUVpjSUxRQUFRUUJLSklRQ0MxNEJBWDlCQUNUbkFVRUFKT2dCUWNUK0EwRUFFQVJCd2Y0REVBSkJmSEVoQVVFQUpOd0JRY0grQXlBQkVBUWdBQVJBQWtCQkFDRUFBMEFnQUVHQTJBVk9EUUVnQUVHQXlRVnFRZjhCT2dBQUlBQkJBV29oQUF3QUFBc0FDd3NMaUFFQkFYOGozZ0VoQVNBQVFZQUJjVUVBUnlUZUFTQUFRY0FBY1VFQVJ5VGZBU0FBUVNCeFFRQkhKT0FCSUFCQkVIRkJBRWNrNFFFZ0FFRUljVUVBUnlUaUFTQUFRUVJ4UVFCSEpPTUJJQUJCQW5GQkFFY2s1QUVnQUVFQmNVRUFSeVRsQVNQZUFVVWdBU0FCR3dSQVFRRVFJd3NnQVVVaUFBUi9JOTRCQlNBQUN3UkFRUUFRSXdzTEtnQkI1QWd0QUFCQkFFb2tzZ0ZCNVFndEFBQkJBRW9rc3dGQi8vOERFQUlRRTBHUC9nTVFBaEFVQzJnQVFjZ0pMd0VBSk8wQlFjb0pMd0VBSk80QlFjd0pMUUFBUVFCS0pPOEJRYzBKTFFBQVFRQktKUEFCUWM0SkxRQUFRUUJLSlBFQlFjOEpMUUFBUVFCS0pQSUJRZEFKTFFBQVFRQktKUE1CUWRFSkxRQUFRUUJLSlBRQlFkSUpMUUFBUVFCS0pQVUJDMGNBUWZvSktBSUFKTUFCUWY0SktBSUFKTUVCUVlJS0xRQUFRUUJLSk1NQlFZVUtMUUFBUVFCS0pNUUJRWVgrQXhBQ0pNSUJRWWIrQXhBQ0pNVUJRWWYrQXhBQ0pNY0JDd2NBUVFBa3NBRUxXQUJCM2dvdEFBQkJBRW9rVmtIZkNpZ0NBQ1JaUWVNS0tBSUFKRnBCNXdvb0FnQWtXMEhzQ2lnQ0FDUmNRZkVLTFFBQUpGMUI4Z290QUFBa1hrSDNDaTBBQUVFQVNpUmZRZmdLS0FJQUpHQkIvUW92QVFBa1lRczlBRUdRQ3kwQUFFRUFTaVJyUVpFTEtBSUFKRzVCbFFzb0FnQWtiMEdaQ3lnQ0FDUndRWjRMS0FJQUpIRkJvd3N0QUFBa2NrR2tDeTBBQUNSekN6c0FRZlFMTFFBQVFRQktKSXNCUWZVTEtBSUFKSTBCUWZrTEtBSUFKSTRCUWYwTEtBSUFKSThCUVlJTUtBSUFKSkFCUVljTUx3RUFKSklCQzhrQkFRRi9FQ0pCc2dnb0FnQWs1d0ZCdGdndEFBQWszQUZCeFA0REVBSWs2QUZCd1A0REVBSVFKQkFsUVlEK0F4QUNRZjhCY3lUVkFTUFZBU0lBUVJCeFFRQkhKTllCSUFCQklIRkJBRWNrMXdFUUpoQW5RYXdLS0FJQUpLd0JRYkFLTFFBQUpLMEJRYkVLTFFBQUpLOEJRUUFrc0FFUUtSQXFRY0lMTFFBQVFRQktKSHBCd3dzb0FnQWtmVUhIQ3lnQ0FDUitRY3NMTHdFQUpIOFFLMEVBSkowQ1FZQ28xcmtISkpRQ1FRQWtsUUpCQUNTV0FrR0FxTmE1QnlTWEFrRUFKSmdDUVFBa21RSUxCUUFqZ3dJTEJRQWpsd0lMQlFBam1BSUxCUUFqbVFJTHhRSUJCWDhqU1NFR0FuOENmeUFCUVFCS0lnVUVRQ0FBUVFoS0lRVUxJQVVMQkVBalNDQUVSaUVGQ3lBRkN3Ui9JQUFnQmtZRklBVUxCRUFnQTBFQmF4QUNRU0J4UVFCSElRVWdBeEFDUVNCeFFRQkhJUWhCQUNFREEwQWdBMEVJU0FSQVFRY2dBMnNnQXlBRklBaEhHeUlESUFCcUlnUkJvQUZNQkVBZ0FVR2dBV3dnQkdwQkEyeEJnTWtGYWlJSElBY3RBQUE2QUFBZ0FVR2dBV3dnQkdwQkEyeEJnY2tGYWlBSExRQUJPZ0FBSUFGQm9BRnNJQVJxUVFOc1FZTEpCV29nQnkwQUFqb0FBQ0FCUWFBQmJDQUVha0dBa1FScUlBQkJBQ0FEYTJzZ0FVR2dBV3hxUWZpUUJHb3RBQUFpQkVFRGNTSUhRUVJ5SUFjZ0JFRUVjUnM2QUFBZ0NVRUJhaUVKQ3lBRFFRRnFJUU1NQVFzTEJTQUVKRWdMSUFBZ0JrNEVRQ0FBUVFocUlRWWdBQ0FDUVFkeElnaElCRUFnQmlBSWFpRUdDd3NnQmlSSklBa0xLUUFnQUVHQWtBSkdCRUFnQVVHQUFXc2dBVUdBQVdvZ0FVR0FBWEViSVFFTElBRkJCSFFnQUdvTFNnQWdBRUVEZENBQlFRRjBhaUlBUVFGcVFUOXhJZ0ZCUUdzZ0FTQUNHMEdBa0FScUxRQUFJUUVnQUVFL2NTSUFRVUJySUFBZ0FodEJnSkFFYWkwQUFDQUJRZjhCY1VFSWRISUx1UUVBSUFFUUFpQUFRUUYwZFVFRGNTRUFJQUZCeVA0RFJnUkFJejBoQVFKQUlBQkZEUUFDUUFKQUFrQWdBRUVCYXc0REFBRUNBd3NqUGlFQkRBSUxJejhoQVF3QkN5TkFJUUVMQlNBQlFjbitBMFlFUUNOQklRRUNRQ0FBUlEwQUFrQUNRQUpBSUFCQkFXc09Bd0FCQWdNTEkwSWhBUXdDQ3lORElRRU1BUXNqUkNFQkN3VWpPU0VCQWtBZ0FFVU5BQUpBQWtBQ1FDQUFRUUZyRGdNQUFRSURDeU02SVFFTUFnc2pPeUVCREFFTEl6d2hBUXNMQ3lBQkM2SURBUVovSUFFZ0FCQXlJQVZCQVhScUlnQkJnSkIrYWlBQ1FRRnhRUTEwSWdGcUxRQUFJUkVnQUVHQmtINXFJQUZxTFFBQUlSSWdBeUVBQTBBZ0FDQUVUQVJBSUFBZ0Eyc2dCbW9pRGlBSVNBUkFRUWNnQUdzaEJTQUxRUUJJSWdJRWZ5QUNCU0FMUVNCeFJRc2hBVUVBSVFJQ2YwRUJJQVVnQUNBQkd5SUJkQ0FTY1FSQVFRSWhBZ3NnQWtFQmFnc2dBa0VCSUFGMElCRnhHeUVDSTRNQ0JIOGdDMEVBVGlJQkJIOGdBUVVnREVFQVRnc0ZJNE1DQ3dSL0lBdEJCM0VoQlNBTVFRQk9JZ0VFUUNBTVFRZHhJUVVMSUFVZ0FpQUJFRE1pQlVFZmNVRURkQ0VQSUFWQjRBZHhRUVYxUVFOMElRRWdCVUdBK0FGeFFRcDFRUU4wQlNBQ1FjZitBeUFLSUFwQkFFd2JJZ29RTkNJRlFZQ0EvQWR4UVJCMUlROGdCVUdBL2dOeFFRaDFJUUVnQlVIL0FYRUxJUVVnQnlBSWJDQU9ha0VEYkNBSmFpSVFJQTg2QUFBZ0VFRUJhaUFCT2dBQUlCQkJBbW9nQlRvQUFDQUhRYUFCYkNBT2FrR0FrUVJxSUFKQkEzRWlBVUVFY2lBQklBdEJnQUZ4UVFCSFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzM0QkEzOGdBMEVIY1NFRFFRQWdBaUFDUVFOMVFRTjBheUFBR3lFSFFhQUJJQUJyUVFjZ0FFRUlha0dnQVVvYklRaEJmeUVDSTRNQ0JFQWdCRUdBMEg1cUxRQUFJZ0pCQ0hGQkFFY2hDU0FDUWNBQWNRUkFRUWNnQTJzaEF3c0xJQVlnQlNBSklBY2dDQ0FESUFBZ0FVR2dBVUdBeVFWQkFDQUNRWDhRTlF1bEFnRUJmeUFEUVFkeElRTWdCU0FHRURJZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ05CZ0pCK2FpQUVRUWh4UVFCSElnVkJEWFJxTFFBQUlRWWdBMEdCa0g1cUlBVkJBWEZCRFhScUxRQUFJUVVnQWtFSGNTRURRUUFoQWlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxSUFSQkIzRUNmMEVCSUFOQkJ5QURheUFFUVNCeEd5SURkQ0FGY1FSQVFRSWhBZ3NnQWtFQmFnc2dBa0VCSUFOMElBWnhHeUlDUVFBUU15SURRUjl4UVFOME9nQUFJQUZCb0FGc0lBQnFRUU5zUVlISkJXb2dBMEhnQjNGQkJYVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnc2tGYWlBRFFZRDRBWEZCQ25WQkEzUTZBQUFnQVVHZ0FXd2dBR3BCZ0pFRWFpQUNRUU54SWdkQkJISWdCeUFFUVlBQmNSczZBQUFMeEFFQUlBUWdCUkF5SUFOQkIzRkJBWFJxSWdSQmdKQithaTBBQUNFRlFRQWhBeUFCUWFBQmJDQUFha0VEYkVHQXlRVnFBbjhnQkVHQmtINXFMUUFBUVFGQkJ5QUNRUWR4YXlJQ2RIRUVRRUVDSVFNTElBTkJBV29MSUFOQkFTQUNkQ0FGY1JzaUEwSEgvZ01RTkNJQ1FZQ0EvQWR4UVJCMU9nQUFJQUZCb0FGc0lBQnFRUU5zUVlISkJXb2dBa0dBL2dOeFFRaDFPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZTEpCV29nQWpvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRTZBQUFMMWdFQkJuOGdBMEVEZFNFTEEwQWdCRUdnQVVnRVFDQUVJQVZxSWdaQmdBSk9CRUFnQmtHQUFtc2hCZ3NnQzBFRmRDQUNhaUFHUVFOMWFpSUpRWUNRZm1vdEFBQWhDRUVBSVFvak53UkFJQVFnQUNBR0lBa2dDQkF4SWdkQkFFb0VRRUVCSVFvZ0IwRUJheUFFYWlFRUN3c2dDa1VqTmlJSElBY2JCRUFnQkNBQUlBWWdBeUFKSUFFZ0NCQTJJZ2RCQUVvRVFDQUhRUUZySUFScUlRUUxCU0FLUlFSQUk0TUNCRUFnQkNBQUlBWWdBeUFKSUFFZ0NCQTNCU0FFSUFBZ0JpQURJQUVnQ0JBNEN3c0xJQVJCQVdvaEJBd0JDd3NMTWdFRGZ5UHJBU0VESUFBajdBRWlCRWdFUUE4TFFRQWdBMEVIYXlJRGF5RUZJQUFnQVNBQ0lBQWdCR3NnQXlBRkVEa0x2UVVCRDM4Q1FFRW5JUWtEUUNBSlFRQklEUUVnQ1VFQ2RDSUhRWUQ4QTJvaUF4QUNJUUlnQTBFQmFoQUNJUW9nQTBFQ2FoQUNJUU1nQWtFUWF5RUNJQXBCQ0dzaENrRUlJUVFnQVFSQVFSQWhCQ0FESUFOQkFYRnJJUU1MSUFBZ0FrNGlCUVJBSUFBZ0FpQUVha2doQlFzZ0JRUkFJQWRCZy93RGFoQUNJZ1ZCZ0FGeFFRQkhJUXNnQlVFZ2NVRUFSeUVPUVlDQUFpQURFRElnQkNBQUlBSnJJZ0pyUVFGcklBSWdCVUhBQUhFYlFRRjBhaUlEUVlDUWZtb2dCVUVJY1VFQVJ5T0RBaUlDSUFJYlFRRnhRUTEwSWdKcUxRQUFJUThnQTBHQmtINXFJQUpxTFFBQUlSQkJCeUVIQTBBZ0IwRUFUZ1JBUVFBaENBSi9RUUZCQUNBSElnSkJCMnRySUFJZ0Roc2lBblFnRUhFRVFFRUNJUWdMSUFoQkFXb0xJQWhCQVNBQ2RDQVBjUnNpQ0FSQVFRY2dCMnNnQ21vaUJrRUFUaUlDQkVBZ0JrR2dBVXdoQWdzZ0FnUkFRUUFoREVFQUlRMGo1UUZGSTRNQ0lnSWdBaHNpQWtVRVFDQUFRYUFCYkNBR2FrR0FrUVJxTFFBQUlnTkJBM0VpQkVFQVN5QUxJQXNiQkVCQkFTRU1CU0FEUVFSeFFRQkhJNE1DSWdNZ0F4c2lBd1JBSUFSQkFFc2hBd3RCQVVFQUlBTWJJUTBMQ3lBQ1JRUkFJQXhGSWdRRWZ5QU5SUVVnQkFzaEFnc2dBZ1JBSTRNQ0JFQWdBRUdnQVd3Z0JtcEJBMnhCZ01rRmFpQUZRUWR4SUFoQkFSQXpJZ1JCSDNGQkEzUTZBQUFnQUVHZ0FXd2dCbXBCQTJ4Qmdja0ZhaUFFUWVBSGNVRUZkVUVEZERvQUFDQUFRYUFCYkNBR2FrRURiRUdDeVFWcUlBUkJnUGdCY1VFS2RVRURkRG9BQUFVZ0FFR2dBV3dnQm1wQkEyeEJnTWtGYWlBSVFjbitBMEhJL2dNZ0JVRVFjUnNRTkNJRFFZQ0EvQWR4UVJCMU9nQUFJQUJCb0FGc0lBWnFRUU5zUVlISkJXb2dBMEdBL2dOeFFRaDFPZ0FBSUFCQm9BRnNJQVpxUVFOc1FZTEpCV29nQXpvQUFBc0xDd3NnQjBFQmF5RUhEQUVMQ3dzZ0NVRUJheUVKREFBQUN3QUxDMllCQW45QmdJQUNRWUNRQWlQaEFSc2hBU09EQWlJQ0krVUJJQUliQkVBZ0FDQUJRWUM0QWtHQXNBSWo0Z0ViSStvQklBQnFRZjhCY1VFQUkra0JFRGtMSStBQkJFQWdBQ0FCUVlDNEFrR0FzQUlqM3dFYkVEb0xJK1FCQkVBZ0FDUGpBUkE3Q3dzbEFRRi9Ba0FEUUNBQVFaQUJTZzBCSUFCQi93RnhFRHdnQUVFQmFpRUFEQUFBQ3dBTEMwWUJBbjhEUUNBQlFaQUJUa1VFUUVFQUlRQURRQ0FBUWFBQlNBUkFJQUZCb0FGc0lBQnFRWUNSQkdwQkFEb0FBQ0FBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3dzTEhRRUJmMEdQL2dNUUFrRUJJQUIwY2lJQkpMb0JRWS8rQXlBQkVBUUxDd0JCQVNTOEFVRUJFRDhMTEFFQ2Z5TmJJZ0JCQUVvaUFRUkFJMVFoQVFzZ0FFRUJheUFBSUFFYklnQkZCRUJCQUNSV0N5QUFKRnNMTEFFQ2Z5TndJZ0JCQUVvaUFRUkFJMmtoQVFzZ0FFRUJheUFBSUFFYklnQkZCRUJCQUNSckN5QUFKSEFMTEFFQ2Z5TitJZ0JCQUVvaUFRUkFJM2doQVFzZ0FFRUJheUFBSUFFYklnQkZCRUJCQUNSNkN5QUFKSDRMTUFFQ2Z5T1BBU0lBUVFCS0lnRUVRQ09LQVNFQkN5QUFRUUZySUFBZ0FSc2lBRVVFUUVFQUpJc0JDeUFBSkk4QkMwQUJBbjlCbFA0REVBSkIrQUZ4SVFGQmsvNERJQUJCL3dGeElnSVFCRUdVL2dNZ0FTQUFRUWgxSWdCeUVBUWdBaVJUSUFBa1ZTTlRJMVZCQ0hSeUpGZ0xYUUVDZnlOaElnRWpUWFVoQUNBQklBQnJJQUFnQVdvalRCc2lBRUgvRDB3aUFRUi9JMDFCQUVvRklBRUxCRUFnQUNSaElBQVFSU05oSWdFalRYVWhBQ0FCSUFCcklBQWdBV29qVEJzaEFBc2dBRUgvRDBvRVFFRUFKRllMQ3lrQkFYOGpZRUVCYXlJQVFRQk1CRUFqU3lSZ0kwdEJBRW9qWHlOZkd3UkFFRVlMQlNBQUpHQUxDMDRCQTM4aldrRUJheUlCUVFCTUJFQWpVaUlCQkVBalhDRUFJQUJCRDBnalVTTlJHd1IvSUFCQkFXb0ZJMUZGSWdJRVFDQUFRUUJLSVFJTElBQkJBV3NnQUNBQ0d3c2tYQXNMSUFFa1dndE9BUU4vSTI5QkFXc2lBVUVBVEFSQUkyY2lBUVJBSTNFaEFDQUFRUTlJSTJZalpoc0VmeUFBUVFGcUJTTm1SU0lDQkVBZ0FFRUFTaUVDQ3lBQVFRRnJJQUFnQWhzTEpIRUxDeUFCSkc4TFZnRURmeU9PQVVFQmF5SUJRUUJNQkVBamhnRWlBUVJBSTVBQklRQWdBRUVQU0NPRkFTT0ZBUnNFZnlBQVFRRnFCU09GQVVVaUFnUkFJQUJCQUVvaEFnc2dBRUVCYXlBQUlBSWJDeVNRQVFzTElBRWtqZ0VMblFFQkFuOUJnTUFBSTRRQ2RDSUJJUUlqckFFZ0FHb2lBQ0FCVGdSQUlBQWdBbXNrckFFQ1FBSkFBa0FDUUFKQUk2OEJJZ0FFUUNBQVFRSkdEUUVDUUNBQVFRUnJEZ1FEQUFRRkFBc01CUXNRUVJCQ0VFTVFSQXdFQ3hCQkVFSVFReEJFRUVjTUF3c1FRUkJDRUVNUVJBd0NDeEJCRUVJUVF4QkVFRWNNQVFzUVNCQkpFRW9MSUFCQkFXcEJCM0VrcndGQkFROEZJQUFrckFFTFFRQUxiZ0VCZndKQUFrQUNRQUpBSUFCQkFVY0VRQ0FBUVFKckRnTUJBZ01FQ3lOWElnQWpsd0ZISVFFZ0FDU1hBU0FCRHdzamJDSUJJNWdCUnlFQUlBRWttQUVnQUE4TEkzc2lBQ09aQVVjaEFTQUFKSmtCSUFFUEN5T01BU0lCSTVvQlJ5RUFJQUVrbWdFZ0FBOExRUUFMVlFBQ1FBSkFBa0FnQUVFQlJ3UkFJQUJCQWtZTkFTQUFRUU5HRFFJTUF3dEJBU0FCZEVHQkFYRkJBRWNQQzBFQklBRjBRWWNCY1VFQVJ3OExRUUVnQVhSQi9nQnhRUUJIRHd0QkFTQUJkRUVCY1VFQVJ3dHdBUUYvSTFrZ0FHc2lBVUVBVEFSQUlBRWtXVUdBRUNOWWEwRUNkQ0lBUVFKMElBQWpoQUliSkZraldTQUJRUjkxSWdBZ0FDQUJhbk5ySkZralhrRUJha0VIY1NSZUJTQUJKRmtMSTFjalZpSUFJQUFiQkg4alhBVkJEdzhMSTA0alhoQk5CSDlCQVFWQmZ3dHNRUTlxQzJRQkFYOGpiaUFBYXlJQkpHNGdBVUVBVEFSQVFZQVFJMjFyUVFKMEk0UUNkQ1J1STI0Z0FVRWZkU0lBSUFBZ0FXcHpheVJ1STNOQkFXcEJCM0VrY3dzamJDTnJJZ0FnQUJzRWZ5TnhCVUVQRHdzall5TnpFRTBFZjBFQkJVRi9DMnhCRDJvTDhnRUJBbjhqZlNBQWF5SUJRUUJNQkVBZ0FTUjlRWUFRSTN4clFRRjBJNFFDZENSOUkzMGdBVUVmZFNJQUlBQWdBV3B6YXlSOUkzOUJBV3BCSDNFa2Z3VWdBU1I5Q3lPQUFTRUJJM3NqZWlJQUlBQWJCRUFqZ1FFRVFFR2MvZ01RQWtFRmRVRVBjU0lCSklBQlFRQWtnUUVMQlVFUER3c2pmeUlDUVFGMVFiRCtBMm9RQWlBQ1FRRnhSVUVDZEhWQkQzRWhBRUVBSVFJQ1FBSkFBa0FDUUNBQkJFQWdBVUVCUmcwQklBRkJBa1lOQWd3REN5QUFRUVIxSVFBTUF3dEJBU0VDREFJTElBQkJBWFVoQUVFQ0lRSU1BUXNnQUVFQ2RTRUFRUVFoQWdzZ0FrRUFTZ1IvSUFBZ0FtMEZRUUFMUVE5cUM0WUJBUUovSTQwQklBQnJJZ0ZCQUV3RVFDT1JBU09IQVhRamhBSjBJQUZCSDNVaUFDQUFJQUZxYzJzaEFTT1NBU0lBUVFGMUlnSWdBRUVCY1NBQ1FRRnhjeUlDUVE1MGNpSUFRYjkvY1NBQ1FRWjBjaUFBSTRnQkd5U1NBUXNnQVNTTkFTT01BU09MQVNJQUlBQWJCSDhqa0FFRlFROFBDMEYvUVFFamtnRkJBWEViYkVFUGFnc3dBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMa3dFQkFYOUJBQ1NkQVNBQVFROGpvd0ViSUFGQkR5T2tBUnRxSUFKQkR5T2xBUnRxSUFOQkR5T21BUnRxSVFRZ0FFRVBJNmNCR3lBQlFROGpxQUViYWlBQ1FROGpxUUViYWlFQklBTkJEeU9xQVJzaEEwRUFKSjRCUVFBa253RWdCQ09oQVVFQmFoQlNJUUFnQVNBRGFpT2lBVUVCYWhCU0lRRWdBQ1NiQVNBQkpKd0JJQUZCL3dGeElBQkIvd0Z4UVFoMGNndWRBd0VGZnlOS0lBQnFJZ0VrU2lOWklBRnJRUUJNSWdGRkJFQkJBUkJNSVFFTEkySWdBR29pQkNSaUkyNGdCR3RCQUV3aUJFVUVRRUVDRUV3aEJBc2pkQ0FBYWlSMEk0RUJSU0lDQkVBamZTTjBhMEVBU2lFQ0N5QUNSU0lDUlFSQVFRTVFUQ0VDQ3lPQ0FTQUFhaVNDQVNPTkFTT0NBV3RCQUV3aUJVVUVRRUVFRUV3aEJRc2dBUVJBSTBvaEEwRUFKRW9nQXhCT0pKTUJDeUFFQkVBallpRURRUUFrWWlBREVFOGtsQUVMSUFJRVFDTjBJUU5CQUNSMElBTVFVQ1NWQVFzZ0JRUkFJNElCSVFOQkFDU0NBU0FERUZFa2xnRUxBbjhnQVNBRUlBRWJJZ0ZGQkVBZ0FpRUJDeUFCUlFzRVFDQUZJUUVMSUFFRVFFRUJKSjhCQ3lPdEFTT3VBU0FBYkdvaUFVR0FnSUFDSTRRQ2RDSUFUZ1JBSUFFZ0FHc2hBU09mQVNJQUk1MEJJQUFiSWdCRkJFQWpuZ0VoQUFzZ0FBUkFJNU1CSTVRQkk1VUJJNVlCRUZNYUJTQUJKSzBCQ3lPd0FTSUNRUUYwUVlDWndRQnFJZ0FqbXdGQkFtbzZBQUFnQUVFQmFpT2NBVUVDYWpvQUFDQUNRUUZxSWdBanNRRkJBWFZCQVd0T0JIOGdBRUVCYXdVZ0FBc2tzQUVMSUFFa3JRRUxwQU1CQm44Z0FCQk9JUUVnQUJCUElRSWdBQkJRSVFNZ0FCQlJJUVFnQVNTVEFTQUNKSlFCSUFNa2xRRWdCQ1NXQVNPdEFTT3VBU0FBYkdvaUJVR0FnSUFDSTRRQ2RFNEVRQ0FGUVlDQWdBSWpoQUowYXlFRklBRWdBaUFESUFRUVV5RUFJN0FCUVFGMFFZQ1p3UUJxSWdZZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFaQkFXb2dBRUgvQVhGQkFtbzZBQUFqT0FSQUlBRkJEMEVQUVE4UVV5RUFJN0FCUVFGMFFZQ1pJV29pQVNBQVFZRCtBM0ZCQ0hWQkFtbzZBQUFnQVVFQmFpQUFRZjhCY1VFQ2Fqb0FBRUVQSUFKQkQwRVBFRk1oQUNPd0FVRUJkRUdBbVNscUlnSWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBSkJBV29nQUVIL0FYRkJBbW82QUFCQkQwRVBJQU5CRHhCVElRQWpzQUZCQVhSQmdKa3hhaUlESUFCQmdQNERjVUVJZFVFQ2Fqb0FBQ0FEUVFGcUlBQkIvd0Z4UVFKcU9nQUFRUTlCRDBFUElBUVFVeUVBSTdBQlFRRjBRWUNaT1dvaUJDQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0JFRUJhaUFBUWY4QmNVRUNham9BQUFzanNBRkJBV29pQUNPeEFVRUJkVUVCYTA0RWZ5QUFRUUZyQlNBQUN5U3dBUXNnQlNTdEFRc2VBUUYvSUFBUVN5RUJJQUZGSXpVak5Sc0VRQ0FBRUZRRklBQVFWUXNMTHdFQ2YwSFhBQ09FQW5RaEFTT2dBU0VBQTBBZ0FDQUJUZ1JBSUFFUVZpQUFJQUZySVFBTUFRc0xJQUFrb0FFTElRQWdBRUdtL2dOR0JFQkJwdjRERUFKQmdBRnhJUUFnQUVId0FISVBDMEYvQzV3QkFRRi9JOVVCSVFBajFnRUVRQ0FBUVh0eElBQkJCSElqelFFYklRQWdBRUYrY1NBQVFRRnlJOUFCR3lFQUlBQkJkM0VnQUVFSWNpUE9BUnNoQUNBQVFYMXhJQUJCQW5Janp3RWJJUUFGSTljQkJFQWdBRUYrY1NBQVFRRnlJOUVCR3lFQUlBQkJmWEVnQUVFQ2NpUFNBUnNoQUNBQVFYdHhJQUJCQkhJajB3RWJJUUFnQUVGM2NTQUFRUWh5STlRQkd5RUFDd3NnQUVId0FYSUx6d0lCQVg4Z0FFR0FnQUpJQkVCQmZ3OExJQUJCZ0lBQ1RpSUJCSDhnQUVHQXdBSklCU0FCQ3dSQVFYOFBDeUFBUVlEQUEwNGlBUVIvSUFCQmdQd0RTQVVnQVFzRVFDQUFRWUJBYWhBQ0R3c2dBRUdBL0FOT0lnRUVmeUFBUVovOUEwd0ZJQUVMQkVCQi93RkJmeVBjQVVFQ1NCc1BDeUFBUWMzK0EwWUVRRUgvQVNFQlFjMytBeEFDUVFGeFJRUkFRZjRCSVFFTEk0UUNSUVJBSUFGQi8zNXhJUUVMSUFFUEN5QUFRY1QrQTBZRVFDQUFJK2dCRUFRajZBRVBDeUFBUVpEK0EwNGlBUVIvSUFCQnB2NERUQVVnQVFzRVFCQlhJQUFRV0E4TElBQkJzUDREVGlJQkJIOGdBRUcvL2dOTUJTQUJDd1JBRUZkQmZ3OExJQUJCaFA0RFJnUkFJQUFqd1FGQmdQNERjVUVJZFNJQkVBUWdBUThMSUFCQmhmNERSZ1JBSUFBandnRVFCQ1BDQVE4TElBQkJqLzREUmdSQUk3b0JRZUFCY2c4TElBQkJnUDREUmdSQUVGa1BDMEYvQ3lrQkFYOGoyUUVnQUVZRVFFRUJKTnNCQ3lBQUVGb2lBVUYvUmdSL0lBQVFBZ1VnQVVIL0FYRUxDN01DQVFSL0kvRUJCRUFQQ3lQeUFTRUZJL01CSVFNZ0FFSC9QMHdFUUNBREJIOGdBVUVRY1VVRklBTUxSUVJBSUFGQkQzRWlCQVJBSUFSQkNrWUVRRUVCSk84QkN3VkJBQ1R2QVFzTEJTQUFRZi8vQUV3RVFDUDFBU0lFUlNJQ0JIOGdBZ1VnQUVILzN3Qk1Dd1JBSUFGQkQzRWo3UUVnQXhzaEFpQUZCSDhnQVVFZmNTRUJJQUpCNEFGeEJTUDBBUVIvSUFGQi93QnhJUUVnQWtHQUFYRUZRUUFnQWlBRUd3c0xJUUFnQUNBQmNpVHRBUVVqN1FGQi93RnhJQUZCQUVwQkNIUnlKTzBCQ3dVZ0EwVWlCQVIvSUFCQi83OEJUQVVnQkFzRVFDUHdBU0FGSUFVYkJFQWo3UUZCSDNFZ0FVSGdBWEZ5Sk8wQkR3c2dBVUVQY1NBQlFRTnhJL1VCR3lUdUFRVWdBMFVpQWdSL0lBQkIvLzhCVEFVZ0Fnc0VRQ0FGQkVBZ0FVRUJjVUVBUnlUd0FRc0xDd3NMQ3lnQUlBQkJCSFZCRDNFa1VDQUFRUWh4UVFCSEpGRWdBRUVIY1NSU0lBQkIrQUZ4UVFCS0pGY0xLQUFnQUVFRWRVRVBjU1JsSUFCQkNIRkJBRWNrWmlBQVFRZHhKR2NnQUVINEFYRkJBRW9rYkFzc0FDQUFRUVIxUVE5eEpJUUJJQUJCQ0hGQkFFY2toUUVnQUVFSGNTU0dBU0FBUWZnQmNVRUFTaVNNQVFzNEFDQUFRUVIxSkljQklBQkJDSEZCQUVja2lBRWdBRUVIY1NJQUpJa0JJQUJCQVhRaUFFRUJTQVJBUVFFaEFBc2dBRUVEZENTUkFRdGpBUUYvUVFFa1ZpTmJSUVJBUWNBQUpGc0xRWUFRSTFoclFRSjBJZ0JCQW5RZ0FDT0VBaHNrV1NOU0pGb2pVQ1JjSTFna1lTTkxJZ0FrWUNBQVFRQktJZ0FFZnlOTlFRQktCU0FBQ3lSZkkwMUJBRW9FUUJCR0N5TlhSUVJBUVFBa1Znc0xNZ0JCQVNSckkzQkZCRUJCd0FBa2NBdEJnQkFqYld0QkFuUWpoQUowSkc0alp5UnZJMlVrY1NOc1JRUkFRUUFrYXdzTExnQkJBU1I2STM1RkJFQkJnQUlrZmd0QmdCQWpmR3RCQVhRamhBSjBKSDFCQUNSL0kzdEZCRUJCQUNSNkN3dEJBRUVCSklzQkk0OEJSUVJBUWNBQUpJOEJDeU9SQVNPSEFYUWpoQUowSkkwQkk0WUJKSTRCSTRRQkpKQUJRZi8vQVNTU0FTT01BVVVFUUVFQUpJc0JDd3ZxQkFFQmZ5QUFRYWIrQTBjaUFnUkFJNnNCUlNFQ0N5QUNCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUNRWkQrQTBjRVFDQUNRWkgrQTJzT0ZnSUdDZzRWQXdjTER3RUVDQXdRRlFVSkRSRVNFeFFWQ3lBQlFmQUFjVUVFZFNSTElBRkJDSEZCQUVja1RDQUJRUWR4SkUwTUZRc2dBVUdBQVhGQkFFY2tld3dVQ3lBQlFRWjFRUU54SkU0Z0FVRS9jU1JQUWNBQUkwOXJKRnNNRXdzZ0FVRUdkVUVEY1NSaklBRkJQM0VrWkVIQUFDTmtheVJ3REJJTElBRWtkVUdBQWlOMWF5UitEQkVMSUFGQlAzRWtnd0ZCd0FBamd3RnJKSThCREJBTElBRVFYUXdQQ3lBQkVGNE1EZ3RCQVNTQkFTQUJRUVYxUVE5eEpIWU1EUXNnQVJCZkRBd0xJQUVrVXlOVlFRaDBJQUZ5SkZnTUN3c2dBU1JvSTJwQkNIUWdBWElrYlF3S0N5QUJKSGNqZVVFSWRDQUJjaVI4REFrTElBRVFZQXdJQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISkZRZ0FVRUhjU0lBSkZValV5QUFRUWgwY2lSWUVHRUxEQWNMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNrYVNBQlFRZHhJZ0FrYWlOb0lBQkJDSFJ5SkcwUVlnc01CZ3NnQVVHQUFYRUVRQ0FCUWNBQWNVRUFSeVI0SUFGQkIzRWlBQ1I1STNjZ0FFRUlkSElrZkJCakN3d0ZDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKSW9CRUdRTERBUUxJQUZCQkhWQkIzRWtvUUVnQVVFSGNTU2lBVUVCSkowQkRBTUxJQUVRRUVFQkpKNEJEQUlMSUFGQmdBRnhRUUJISktzQklBRkJnQUZ4UlFSQUFrQkJrUDRESVFJRFFDQUNRYWIrQTA0TkFTQUNRUUFRQkNBQ1FRRnFJUUlNQUFBTEFBc0xEQUVMUVFFUEMwRUJDendCQVg4Z0FFRUlkQ0VCUVFBaEFBTkFBa0FnQUVHZkFVb05BQ0FBUVlEOEEyb2dBQ0FCYWhBQ0VBUWdBRUVCYWlFQURBRUxDMEdFQlNUN0FRc2pBUUYvSS9ZQkVBSWhBQ1AzQVJBQ1FmOEJjU0FBUWY4QmNVRUlkSEpCOFA4RGNRc25BUUYvSS9nQkVBSWhBQ1A1QVJBQ1FmOEJjU0FBUWY4QmNVRUlkSEpCOEQ5eFFZQ0FBbW9MaEFFQkEzOGpnd0pGQkVBUEN5QUFRWUFCY1VVai9BRWovQUViQkVCQkFDVDhBU1A2QVJBQ1FZQUJjaUVBSS9vQklBQVFCQThMRUdjaEFSQm9JUUlnQUVIL2ZuRkJBV3BCQkhRaEF5QUFRWUFCY1FSQVFRRWsvQUVnQXlUOUFTQUJKUDRCSUFJay93RWorZ0VnQUVIL2ZuRVFCQVVnQVNBQ0lBTVFjeVA2QVVIL0FSQUVDd3RlQVFSL0kwY2hBeU5HSUFCR0lnSkZCRUFnQUNBRFJpRUNDeUFDQkVBZ0FFRUJheUlFRUFKQnYzOXhJZ0pCUDNFaUJVRkFheUFGSUFBZ0EwWWJRWUNRQkdvZ0FUb0FBQ0FDUVlBQmNRUkFJQVFnQWtFQmFrR0FBWElRQkFzTEN6d0JBWDhDUUFKQUFrQUNRQ0FBQkVBZ0FDSUJRUUZHRFFFZ0FVRUNSZzBDSUFGQkEwWU5Bd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzbEFRRi9RUUVqeHdFUWF5SUNkQ0FBY1VFQVJ5SUFCSDlCQVNBQ2RDQUJjVVVGSUFBTEM0VUJBUVIvQTBBZ0FpQUFTQVJBSUFKQkJHb2hBaVBCQVNJQlFRUnFRZi8vQTNFaUF5VEJBU1BHQVFSQUk4UUJJUVFqd3dFRVFDUEZBU1RDQVVFQkpMMEJRUUlRUDBFQUpNTUJRUUVreEFFRklBUUVRRUVBSk1RQkN3c2dBU0FERUd3RVFDUENBVUVCYWlJQlFmOEJTZ1JBUVFFa3d3RkJBQ0VCQ3lBQkpNSUJDd3NNQVFzTEN3d0FJOEFCRUcxQkFDVEFBUXRHQVFGL0k4RUJJUUJCQUNUQkFVR0UvZ05CQUJBRUk4WUJCSDhnQUVFQUVHd0ZJOFlCQ3dSQUk4SUJRUUZxSWdCQi93RktCRUJCQVNUREFVRUFJUUFMSUFBa3dnRUxDNElCQVFOL0k4WUJJUUVnQUVFRWNVRUFSeVRHQVNBQVFRTnhJUUlnQVVVRVFDUEhBUkJySVFBZ0FoQnJJUU1qd1FFaEFTUEdBUVIvUVFFZ0FIUWdBWEVGUVFFZ0FIUWdBWEZCQUVjaUFBUi9RUUVnQTNRZ0FYRUZJQUFMQ3dSQUk4SUJRUUZxSWdCQi93RktCRUJCQVNUREFVRUFJUUFMSUFBa3dnRUxDeUFDSk1jQkMvRUdBUUovQWtBQ1FDQUFRYzMrQTBZRVFFSE4vZ01nQVVFQmNSQUVEQUVMSUFCQjBQNERSaU9DQWlJQ0lBSWJCRUJCQUNTQ0FrSC9BU1NPQWd3Q0N5QUFRWUNBQWtnRVFDQUFJQUVRWEF3QkN5QUFRWUNBQWs0aUFnUkFJQUJCZ01BQ1NDRUNDeUFDRFFFZ0FFR0F3QU5PSWdJRVFDQUFRWUQ4QTBnaEFnc2dBZ1JBSUFCQmdFQnFJQUVRQkF3Q0N5QUFRWUQ4QTA0aUFnUkFJQUJCbi8wRFRDRUNDeUFDQkVBajNBRkJBazRQQ3lBQVFhRDlBMDRpQWdSQUlBQkIvLzBEVENFQ0N5QUNEUUFnQUVHQy9nTkdCRUFnQVVFQmNVRUFSeVRLQVNBQlFRSnhRUUJISk1zQklBRkJnQUZ4UVFCSEpNd0JRUUVQQ3lBQVFaRCtBMDRpQWdSQUlBQkJwdjREVENFQ0N5QUNCRUFRVnlBQUlBRVFaUThMSUFCQnNQNERUaUlDQkVBZ0FFRy8vZ05NSVFJTElBSUVRQkJYQ3lBQVFjRCtBMDRpQWdSQUlBQkJ5LzREVENFQ0N5QUNCRUFnQUVIQS9nTkdCRUFnQVJBa0RBTUxJQUJCd2Y0RFJnUkFRY0grQXlBQlFmZ0JjVUhCL2dNUUFrRUhjWEpCZ0FGeUVBUU1BZ3NnQUVIRS9nTkdCRUJCQUNUb0FTQUFRUUFRQkF3Q0N5QUFRY1grQTBZRVFDQUJKTjBCREFNTElBQkJ4djREUmdSQUlBRVFaZ3dEQ3dKQUFrQUNRQUpBSUFBaUFrSEQvZ05IQkVBZ0FrSEMvZ05yRGdvQkJBUUVCQVFFQkFNQ0JBc2dBU1RwQVF3R0N5QUJKT29CREFVTElBRWs2d0VNQkFzZ0FTVHNBUXdEQ3d3Q0N5UDZBU0FBUmdSQUlBRVFhUXdCQ3lPQkFpQUFSaUlDUlFSQUk0QUNJQUJHSVFJTElBSUVRQ1A4QVFSQUFuOGovZ0VpQWtHQWdBRk9JZ01FUUNBQ1FmLy9BVXdoQXdzZ0EwVUxCRUFnQWtHQW9BTk9JZ01FUUNBQ1FmKy9BMHdoQXdzTElBTU5BZ3NMSUFBalJVNGlBZ1JBSUFBalIwd2hBZ3NnQWdSQUlBQWdBUkJxREFJTElBQkJoUDREVGlJQ0JFQWdBRUdIL2dOTUlRSUxJQUlFUUJCdUFrQUNRQUpBQWtBZ0FDSUNRWVQrQTBjRVFDQUNRWVgrQTJzT0F3RUNBd1FMRUc4TUJRc0NRQ1BHQVFSQUk4UUJEUUVqd3dFRVFFRUFKTU1CQ3dzZ0FTVENBUXNNQlFzZ0FTVEZBU1BFQVNQR0FTSUFJQUFiQkVBZ0FTVENBVUVBSk1RQkN3d0VDeUFCRUhBTUF3c01BZ3NnQUVHQS9nTkdCRUFnQVVIL0FYTWsxUUVqMVFFaUFrRVFjVUVBUnlUV0FTQUNRU0J4UVFCSEpOY0JDeUFBUVkvK0EwWUVRQ0FCRUJRTUFnc2dBRUgvL3dOR0JFQWdBUkFUREFJTFFRRVBDMEVBRHd0QkFRc2ZBQ1BhQVNBQVJnUkFRUUVrMndFTElBQWdBUkJ4QkVBZ0FDQUJFQVFMQzFvQkEzOERRQUpBSUFNZ0FrNE5BQ0FBSUFOcUVGc2hCU0FCSUFOcUlRUURRQ0FFUWYrL0Frb0VRQ0FFUVlCQWFpRUVEQUVMQ3lBRUlBVVFjaUFEUVFGcUlRTU1BUXNMSS9zQlFTQWpoQUowSUFKQkJIVnNhaVQ3QVF0eUFRSi9JL3dCUlFSQUR3dEJFQ0VBSS80QkkvOEJBbjhqL1FFaUFVRVFTQVJBSUFFaEFBc2dBQXNRY3lQK0FTQUFhaVQrQVNQL0FTQUFhaVQvQVNBQklBQnJJZ0VrL1FFaitnRWhBQ0FCUVFCTUJFQkJBQ1Q4QVNBQVFmOEJFQVFGSUFBZ0FVRUVkVUVCYTBIL2ZuRVFCQXNMUXdFQmZ3Si9JQUJGSWdKRkJFQWdBRUVCUmlFQ0N5QUNDd1IvSStnQkk5MEJSZ1VnQWdzRVFDQUJRUVJ5SWdGQndBQnhCRUFRUUFzRklBRkJlM0VoQVFzZ0FRdjZBUUVGZnlQZUFVVUVRQThMSTl3QklRTWdBeVBvQVNJRVFaQUJUZ1IvUVFFRkkrY0JJZ0pCK0FJamhBSjBJZ0JPQkg5QkFnVkJBMEVBSUFJZ0FFNGJDd3NpQVVjRVFFSEIvZ01RQWlFQUlBRWszQUZCQUNFQ0FrQUNRQUpBQWtBZ0FRUkFJQUZCQVdzT0F3RUNBd1FMSUFCQmZIRWlBRUVJY1VFQVJ5RUNEQU1MSUFCQmZYRkJBWElpQUVFUWNVRUFSeUVDREFJTElBQkJmbkZCQW5JaUFFRWdjVUVBUnlFQ0RBRUxJQUJCQTNJaEFBc2dBZ1JBRUVBTElBRkZCRUFRZEFzZ0FVRUJSZ1JBUVFFa3V3RkJBQkEvQzBIQi9nTWdBU0FBRUhVUUJBVWdCRUdaQVVZRVFFSEIvZ01nQVVIQi9nTVFBaEIxRUFRTEN3dWZBUUVCZnlQZUFRUkFJK2NCSUFCcUpPY0JJelFoQVFOQUkrY0JRUVFqaEFJaUFIUkJ5QU1nQUhRajZBRkJtUUZHRzA0RVFDUG5BVUVFSTRRQ0lnQjBRY2dESUFCMEkrZ0JRWmtCUmh0ckpPY0JJK2dCSWdCQmtBRkdCRUFnQVFSQUVEMEZJQUFRUEFzUVBrRi9KRWhCZnlSSkJTQUFRWkFCU0FSQUlBRkZCRUFnQUJBOEN3c0xRUUFnQUVFQmFpQUFRWmtCU2hzazZBRU1BUXNMQ3hCMkN6Y0JBWDlCQkNPRUFpSUFkRUhJQXlBQWRDUG9BVUdaQVVZYklRQURRQ1BtQVNBQVRnUkFJQUFRZHlQbUFTQUFheVRtQVF3QkN3c0x1QUVCQkg4anpBRkZCRUFQQ3dOQUlBTWdBRWdFUUNBRFFRUnFJUU1DZnlQSUFTSUNRUVJxSWdGQi8vOERTZ1JBSUFGQmdJQUVheUVCQ3lBQkN5VElBVUVCUVFKQkJ5UExBUnNpQkhRZ0FuRkJBRWNpQWdSQVFRRWdCSFFnQVhGRklRSUxJQUlFUUVHQi9nTkJnZjRERUFKQkFYUkJBV3BCL3dGeEVBUWp5UUZCQVdvaUFVRUlSZ1JBUVFBa3lRRkJBU1MrQVVFREVEOUJndjREUVlMK0F4QUNRZjkrY1JBRVFRQWt6QUVGSUFFa3lRRUxDd3dCQ3dzTGtBRUFJL3NCUVFCS0JFQWord0VnQUdvaEFFRUFKUHNCQ3lPUEFpQUFhaVNQQWlPVEFrVUVRQ015QkVBajVnRWdBR29rNWdFUWVBVWdBQkIzQ3lNeEJFQWpvQUVnQUdva29BRVFWd1VnQUJCV0N5QUFFSGtMSXpNRVFDUEFBU0FBYWlUQUFSQnVCU0FBRUcwTEk1WUNJQUJxSWdBamxBSk9CRUFqbFFKQkFXb2tsUUlnQUNPVUFtc2hBQXNnQUNTV0Fnc0xBRUVFRUhvampnSVFBZ3NuQVFGL1FRUVFlaU9PQWtFQmFrSC8vd054RUFJaEFCQjdRZjhCY1NBQVFmOEJjVUVJZEhJTERBQkJCQkI2SUFBZ0FSQnlDeklCQVg5QkFTQUFkRUgvQVhFaEFpQUJRUUJLQkVBampBSWdBbkpCL3dGeEpJd0NCU09NQWlBQ1FmOEJjM0VrakFJTEN3Z0FRUVVnQUJCK0N6Z0JBWDhnQVVFQVRnUkFJQUJCRDNFZ0FVRVBjV3BCRUhGQkFFY1Fmd1VnQVVFZmRTSUNJQUVnQW1welFROXhJQUJCRDNGTEVIOExDd2dBUVFjZ0FCQitDd2dBUVFZZ0FCQitDd2dBUVFRZ0FCQitDemtCQVg4Z0FVR0EvZ054UVFoMUlRSWdBQ0FCUWY4QmNTSUJFSEVFUUNBQUlBRVFCQXNnQUVFQmFpSUFJQUlRY1FSQUlBQWdBaEFFQ3dzTkFFRUlFSG9nQUNBQkVJUUJDMWdBSUFJRVFDQUJJQUJCLy84RGNTSUFhaUFBSUFGemN5SUNRUkJ4UVFCSEVIOGdBa0dBQW5GQkFFY1Fnd0VGSUFBZ0FXcEIvLzhEY1NJQ0lBQkIvLzhEY1VrUWd3RWdBQ0FCY3lBQ2MwR0FJSEZCQUVjUWZ3c0xDZ0JCQkJCNklBQVFXd3VZQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxEQlVMRUh4Qi8vOERjU0lBUVlEK0EzRkJDSFVraGdJZ0FFSC9BWEVraHdJTUR3c2pod0pCL3dGeEk0WUNRZjhCY1VFSWRISWpoUUlRZlF3VEN5T0hBa0gvQVhFamhnSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0dBZ3dUQ3lPR0FpSUFRUUVRZ0FFZ0FFRUJha0gvQVhFaUFDU0dBZ3dOQ3lPR0FpSUFRWDhRZ0FFZ0FFRUJhMEgvQVhFaUFDU0dBZ3dOQ3hCN1FmOEJjU1NHQWd3TkN5T0ZBaUlBUVlBQmNVR0FBVVlRZ3dFZ0FFRUJkQ0FBUWY4QmNVRUhkbkpCL3dGeEpJVUNEQTBMRUh4Qi8vOERjU09OQWhDRkFRd0lDeU9MQWtIL0FYRWppZ0pCL3dGeFFRaDBjaUlBSTRjQ1FmOEJjU09HQWtIL0FYRkJDSFJ5SWdGQkFCQ0dBU0FBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0lBQkIvd0Z4SklzQ1FRQVFnZ0ZCQ0E4TEk0Y0NRZjhCY1NPR0FrSC9BWEZCQ0hSeUVJY0JRZjhCY1NTRkFnd0xDeU9IQWtIL0FYRWpoZ0pCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NHQWd3TEN5T0hBaUlBUVFFUWdBRWdBRUVCYWtIL0FYRWlBQ1NIQWd3RkN5T0hBaUlBUVg4UWdBRWdBRUVCYTBIL0FYRWlBQ1NIQWd3RkN4QjdRZjhCY1NTSEFnd0ZDeU9GQWlJQVFRRnhRUUJMRUlNQklBQkJCM1FnQUVIL0FYRkJBWFp5UWY4QmNTU0ZBZ3dGQzBGL0R3c2pqZ0pCQW1wQi8vOERjU1NPQWd3RUN5QUFSUkNCQVVFQUVJSUJEQU1MSUFCRkVJRUJRUUVRZ2dFTUFnc2pqZ0pCQVdwQi8vOERjU1NPQWd3QkMwRUFFSUVCUVFBUWdnRkJBQkIvQzBFRUR3c2dBRUgvQVhFa2h3SkJDQXVIQmdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFUVJ3UkFJQUJCRVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEk0TUNCRUJCemY0REVJY0JRZjhCY1NJQVFRRnhCRUJCemY0RElBQkJmbkVpQUVHQUFYRUVmMEVBSklRQ0lBQkIvMzV4QlVFQkpJUUNJQUJCZ0FGeUN4QjlRY1FBRHdzTFFRRWtrd0lNRUFzUWZFSC8vd054SWdCQmdQNERjVUVJZFNTSUFpQUFRZjhCY1NTSkFpT09Ba0VDYWtILy93TnhKSTRDREJFTEk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUk0VUNFSDBNRUFzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhKQkFXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2lBSU1FQXNqaUFJaUFFRUJFSUFCSUFCQkFXcEIvd0Z4SklnQ0k0Z0NSUkNCQVVFQUVJSUJEQTRMSTRnQ0lnQkJmeENBQVNBQVFRRnJRZjhCY1NTSUFpT0lBa1VRZ1FGQkFSQ0NBUXdOQ3hCN1FmOEJjU1NJQWd3S0N5T0ZBaUlCUVlBQmNVR0FBVVloQUNPTUFrRUVka0VCY1NBQlFRRjBja0gvQVhFa2hRSU1DZ3NRZXlFQUk0NENJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTT0FrRUlEd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElpQUNPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2lJQlFRQVFoZ0VnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTS0FpQUFRZjhCY1NTTEFrRUFFSUlCUVFnUEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ0hBVUgvQVhFa2hRSU1DQXNqaVFKQi93RnhJNGdDUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVraUFJTUNBc2ppUUlpQUVFQkVJQUJJQUJCQVdwQi93RnhJZ0FraVFJZ0FFVVFnUUZCQUJDQ0FRd0dDeU9KQWlJQVFYOFFnQUVnQUVFQmEwSC9BWEVpQUNTSkFpQUFSUkNCQVVFQkVJSUJEQVVMRUh0Qi93RnhKSWtDREFJTEk0VUNJZ0ZCQVhGQkFVWWhBQ09NQWtFRWRrRUJjVUVIZENBQlFmOEJjVUVCZG5Ja2hRSU1BZ3RCZnc4TEk0NENRUUZxUWYvL0EzRWtqZ0lNQVFzZ0FCQ0RBVUVBRUlFQlFRQVFnZ0ZCQUJCL0MwRUVEd3NnQUVIL0FYRWtpUUpCQ0F2aUJnRUNmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCSUVjRVFDQUFRU0ZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPTUFrRUhka0VCY1FSQUk0NENRUUZxUWYvL0EzRWtqZ0lGRUhzaEFDT09BaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2pnSUxRUWdQQ3hCOFFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0lBQkIvd0Z4SklzQ0k0NENRUUpxUWYvL0EzRWtqZ0lNRkFzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJaUFDT0ZBaEI5REE4TEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJb0NEQTBMSTRvQ0lnQkJBUkNBQVNBQVFRRnFRZjhCY1NJQUpJb0NEQTRMSTRvQ0lnQkJmeENBQVNBQVFRRnJRZjhCY1NJQUpJb0NEQTRMRUh0Qi93RnhKSW9DREE0TFFRWkJBQ09NQWlJQ1FRVjJRUUZ4UVFCTEd5SUJRZUFBY2lBQklBSkJCSFpCQVhGQkFFc2JJUUVqaFFJaEFDQUNRUVoyUVFGeFFRQkxCSDhnQUNBQmEwSC9BWEVGSUFGQkJuSWdBU0FBUVE5eFFRbExHeUlCUWVBQWNpQUJJQUJCbVFGTEd5SUJJQUJxUWY4QmNRc2lBRVVRZ1FFZ0FVSGdBSEZCQUVjUWd3RkJBQkIvSUFBa2hRSU1EZ3NqakFKQkIzWkJBWEZCQUVzRVFCQjdJUUFqamdJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSTRDQlNPT0FrRUJha0gvL3dOeEpJNENDMEVJRHdzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJaUFDQUFRZi8vQTNGQkFCQ0dBU0FBUVFGMFFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0lBQkIvd0Z4SklzQ1FRQVFnZ0ZCQ0E4TEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUlnQVFod0ZCL3dGeEpJVUNEQWNMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0RBVUxJNHNDSWdCQkFSQ0FBU0FBUVFGcVFmOEJjU0lBSklzQ0RBWUxJNHNDSWdCQmZ4Q0FBU0FBUVFGclFmOEJjU0lBSklzQ0RBWUxFSHRCL3dGeEpJc0NEQVlMSTRVQ1FYOXpRZjhCY1NTRkFrRUJFSUlCUVFFUWZ3d0dDMEYvRHdzZ0FFSC9BWEVraXdKQkNBOExJQUJCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraWdJZ0FFSC9BWEVraXdJTUF3c2dBRVVRZ1FGQkFCQ0NBUXdDQ3lBQVJSQ0JBVUVCRUlJQkRBRUxJNDRDUVFGcVFmLy9BM0VramdJTFFRUUwyd1VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBZ0FFRXhhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqakFKQkJIWkJBWEVFUUNPT0FrRUJha0gvL3dOeEpJNENCUkI3SVFBampnSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054Skk0Q0MwRUlEd3NRZkVILy93TnhKSTBDSTQ0Q1FRSnFRZi8vQTNFa2pnSU1FUXNqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElpQUNPRkFoQjlEQTRMSTQwQ1FRRnFRZi8vQTNFa2pRSkJDQThMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5SWdFUWh3RWlBRUVCRUlBQklBQkJBV3BCL3dGeElnQkZFSUVCUVFBUWdnRWdBU0FBRUgwTURnc2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISWlBUkNIQVNJQVFYOFFnQUVnQUVFQmEwSC9BWEVpQUVVUWdRRkJBUkNDQVNBQklBQVFmUXdOQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2hCN1FmOEJjUkI5REFzTFFRQVFnZ0ZCQUJCL1FRRVFnd0VNQ3dzampBSkJCSFpCQVhGQkFVWUVRQkI3SVFBampnSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054Skk0Q0JTT09Ba0VCYWtILy93TnhKSTRDQzBFSUR3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISWlBQ09OQWtFQUVJWUJJNDBDSUFCcVFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0lBQkIvd0Z4SklzQ1FRQVFnZ0ZCQ0E4TEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUlnQVFod0ZCL3dGeEpJVUNEQVlMSTQwQ1FRRnJRZi8vQTNFa2pRSkJDQThMSTRVQ0lnQkJBUkNBQVNBQVFRRnFRZjhCY1NJQUpJVUNJQUJGRUlFQlFRQVFnZ0VNQmdzamhRSWlBRUYvRUlBQklBQkJBV3RCL3dGeElnQWtoUUlnQUVVUWdRRkJBUkNDQVF3RkN4QjdRZjhCY1NTRkFnd0RDMEVBRUlJQlFRQVFmeU9NQWtFRWRrRUJjVUVBVFJDREFRd0RDMEYvRHdzZ0FFRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0tBaUFBUWY4QmNTU0xBZ3dCQ3lPT0FrRUJha0gvL3dOeEpJNENDMEVFQzRJQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBQkhCRUFnQUVIQkFFWU5BUUpBSUFCQndnQnJEZzREQkFVR0J3Z0pFUW9MREEwT0R3QUxEQThMREE4TEk0Y0NKSVlDREE0TEk0Z0NKSVlDREEwTEk0a0NKSVlDREF3TEk0b0NKSVlDREFzTEk0c0NKSVlDREFvTEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUVJY0JRZjhCY1NTR0Fnd0pDeU9GQWlTR0Fnd0lDeU9HQWlTSEFnd0hDeU9JQWlTSEFnd0dDeU9KQWlTSEFnd0ZDeU9LQWlTSEFnd0VDeU9MQWlTSEFnd0RDeU9MQWtIL0FYRWppZ0pCL3dGeFFRaDBjaENIQVVIL0FYRWtod0lNQWdzamhRSWtod0lNQVF0QmZ3OExRUVFML1FFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFCSEJFQWdBRUhSQUVZTkFRSkFJQUJCMGdCckRnNFFBd1FGQmdjSUNRb1FDd3dORGdBTERBNExJNFlDSklnQ0RBNExJNGNDSklnQ0RBMExJNGtDSklnQ0RBd0xJNG9DSklnQ0RBc0xJNHNDSklnQ0RBb0xJNHNDUWY4QmNTT0tBa0gvQVhGQkNIUnlFSWNCUWY4QmNTU0lBZ3dKQ3lPRkFpU0lBZ3dJQ3lPR0FpU0pBZ3dIQ3lPSEFpU0pBZ3dHQ3lPSUFpU0pBZ3dGQ3lPS0FpU0pBZ3dFQ3lPTEFpU0pBZ3dEQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2hDSEFVSC9BWEVraVFJTUFnc2poUUlraVFJTUFRdEJmdzhMUVFRTC9RRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUVIaEFFWU5BUUpBSUFCQjRnQnJEZzREQkJBRkJnY0lDUW9MREJBTkRnQUxEQTRMSTRZQ0pJb0NEQTRMSTRjQ0pJb0NEQTBMSTRnQ0pJb0NEQXdMSTRrQ0pJb0NEQXNMSTRzQ0pJb0NEQW9MSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5RUljQlFmOEJjU1NLQWd3SkN5T0ZBaVNLQWd3SUN5T0dBaVNMQWd3SEN5T0hBaVNMQWd3R0N5T0lBaVNMQWd3RkN5T0pBaVNMQWd3RUN5T0tBaVNMQWd3REN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNoQ0hBVUgvQVhFa2l3SU1BZ3NqaFFJa2l3SU1BUXRCZnc4TFFRUUxsQU1BQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUVjRVFDQUFRZkVBUmcwQkFrQWdBRUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhSQUFzTUR3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISWpoZ0lRZlF3UEN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNpT0hBaEI5REE0TEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUk0Z0NFSDBNRFFzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJamlRSVFmUXdNQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2lPS0FoQjlEQXNMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5STRzQ0VIME1DZ3NqL0FGRkJFQUNRQ095QVFSQVFRRWtrQUlNQVFzanRBRWp1Z0Z4UVI5eFJRUkFRUUVra1FJTUFRdEJBU1NTQWdzTERBa0xJNHNDUWY4QmNTT0tBa0gvQVhGQkNIUnlJNFVDRUgwTUNBc2poZ0lraFFJTUJ3c2pod0lraFFJTUJnc2ppQUlraFFJTUJRc2ppUUlraFFJTUJBc2ppZ0lraFFJTUF3c2ppd0lraFFJTUFnc2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0ZCL3dGeEpJVUNEQUVMUVg4UEMwRUVDemNCQVg4Z0FVRUFUZ1JBSUFCQi93RnhJQUFnQVdwQi93RnhTeENEQVFVZ0FVRWZkU0lDSUFFZ0FtcHpJQUJCL3dGeFNoQ0RBUXNMTkFFQ2Z5T0ZBaUlCSUFCQi93RnhJZ0lRZ0FFZ0FTQUNFSkFCSUFBZ0FXcEIvd0Z4SWdFa2hRSWdBVVVRZ1FGQkFCQ0NBUXRYQVFKL0k0VUNJZ0VnQUdvampBSkJCSFpCQVhGcVFmOEJjU0lDSUFBZ0FYTnpRUkJ4UVFCSEVIOGdBRUgvQVhFZ0FXb2pqQUpCQkhaQkFYRnFRWUFDY1VFQVN4Q0RBU0FDSklVQ0lBSkZFSUVCUVFBUWdnRUxnd0lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR0FBVWNFUUNBQlFZRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqaGdJUWtRRU1FQXNqaHdJUWtRRU1Ed3NqaUFJUWtRRU1EZ3NqaVFJUWtRRU1EUXNqaWdJUWtRRU1EQXNqaXdJUWtRRU1Dd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFUWtRRU1DZ3NqaFFJUWtRRU1DUXNqaGdJUWtnRU1DQXNqaHdJUWtnRU1Cd3NqaUFJUWtnRU1CZ3NqaVFJUWtnRU1CUXNqaWdJUWtnRU1CQXNqaXdJUWtnRU1Bd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFUWtnRU1BZ3NqaFFJUWtnRU1BUXRCZnc4TFFRUUxOd0VDZnlPRkFpSUJJQUJCL3dGeFFYOXNJZ0lRZ0FFZ0FTQUNFSkFCSUFFZ0FHdEIvd0Z4SWdFa2hRSWdBVVVRZ1FGQkFSQ0NBUXRYQVFKL0k0VUNJZ0VnQUdzampBSkJCSFpCQVhGclFmOEJjU0lDSUFBZ0FYTnpRUkJ4UVFCSEVIOGdBU0FBUWY4QmNXc2pqQUpCQkhaQkFYRnJRWUFDY1VFQVN4Q0RBU0FDSklVQ0lBSkZFSUVCUVFFUWdnRUxnd0lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR1FBVWNFUUNBQlFaRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqaGdJUWxBRU1FQXNqaHdJUWxBRU1Ed3NqaUFJUWxBRU1EZ3NqaVFJUWxBRU1EUXNqaWdJUWxBRU1EQXNqaXdJUWxBRU1Dd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFUWxBRU1DZ3NqaFFJUWxBRU1DUXNqaGdJUWxRRU1DQXNqaHdJUWxRRU1Cd3NqaUFJUWxRRU1CZ3NqaVFJUWxRRU1CUXNqaWdJUWxRRU1CQXNqaXdJUWxRRU1Bd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFUWxRRU1BZ3NqaFFJUWxRRU1BUXRCZnc4TFFRUUxJd0VCZnlPRkFpQUFjU0lCSklVQ0lBRkZFSUVCUVFBUWdnRkJBUkIvUVFBUWd3RUxKd0VCZnlPRkFpQUFjMEgvQVhFaUFTU0ZBaUFCUlJDQkFVRUFFSUlCUVFBUWYwRUFFSU1CQzRNQ0FRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCb0FGSEJFQWdBVUdoQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEk0WUNFSmNCREJBTEk0Y0NFSmNCREE4TEk0Z0NFSmNCREE0TEk0a0NFSmNCREEwTEk0b0NFSmNCREF3TEk0c0NFSmNCREFzTEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUVJY0JFSmNCREFvTEk0VUNFSmNCREFrTEk0WUNFSmdCREFnTEk0Y0NFSmdCREFjTEk0Z0NFSmdCREFZTEk0a0NFSmdCREFVTEk0b0NFSmdCREFRTEk0c0NFSmdCREFNTEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUVJY0JFSmdCREFJTEk0VUNFSmdCREFFTFFYOFBDMEVFQ3lVQUk0VUNJQUJ5UWY4QmNTSUFKSVVDSUFCRkVJRUJRUUFRZ2dGQkFCQi9RUUFRZ3dFTExBRUJmeU9GQWlJQklBQkIvd0Z4UVg5c0lnQVFnQUVnQVNBQUVKQUJJQUFnQVdwRkVJRUJRUUVRZ2dFTGd3SUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHd0FVY0VRQ0FCUWJFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2poZ0lRbWdFTUVBc2pod0lRbWdFTUR3c2ppQUlRbWdFTURnc2ppUUlRbWdFTURRc2ppZ0lRbWdFTURBc2ppd0lRbWdFTUN3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VRbWdFTUNnc2poUUlRbWdFTUNRc2poZ0lRbXdFTUNBc2pod0lRbXdFTUJ3c2ppQUlRbXdFTUJnc2ppUUlRbXdFTUJRc2ppZ0lRbXdFTUJBc2ppd0lRbXdFTUF3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VRbXdFTUFnc2poUUlRbXdFTUFRdEJmdzhMUVFRTE93RUJmeUFBRUZvaUFVRi9SZ1IvSUFBUUFnVWdBUXRCL3dGeElBQkJBV29pQVJCYUlnQkJmMFlFZnlBQkVBSUZJQUFMUWY4QmNVRUlkSElMQ3dCQkNCQjZJQUFRblFFTE13QWdBRUdBQVhGQmdBRkdFSU1CSUFCQkFYUWdBRUgvQVhGQkIzWnlRZjhCY1NJQVJSQ0JBVUVBRUlJQlFRQVFmeUFBQ3pFQUlBQkJBWEZCQUVzUWd3RWdBRUVIZENBQVFmOEJjVUVCZG5KQi93RnhJZ0JGRUlFQlFRQVFnZ0ZCQUJCL0lBQUxPUUVCZnlPTUFrRUVka0VCY1NBQVFRRjBja0gvQVhFaEFTQUFRWUFCY1VHQUFVWVFnd0VnQVNJQVJSQ0JBVUVBRUlJQlFRQVFmeUFBQ3pvQkFYOGpqQUpCQkhaQkFYRkJCM1FnQUVIL0FYRkJBWFp5SVFFZ0FFRUJjVUVCUmhDREFTQUJJZ0JGRUlFQlFRQVFnZ0ZCQUJCL0lBQUxLUUFnQUVHQUFYRkJnQUZHRUlNQklBQkJBWFJCL3dGeElnQkZFSUVCUVFBUWdnRkJBQkIvSUFBTFJBRUNmeUFBUVFGeFFRRkdJUUVnQUVHQUFYRkJnQUZHSVFJZ0FFSC9BWEZCQVhZaUFFR0FBWElnQUNBQ0d5SUFSUkNCQVVFQUVJSUJRUUFRZnlBQkVJTUJJQUFMS2dBZ0FFRVBjVUVFZENBQVFmQUJjVUVFZG5JaUFFVVFnUUZCQUJDQ0FVRUFFSDlCQUJDREFTQUFDeTBCQVg4Z0FFRUJjVUVCUmlFQklBQkIvd0Z4UVFGMklnQkZFSUVCUVFBUWdnRkJBQkIvSUFFUWd3RWdBQXNkQUVFQklBQjBJQUZ4UWY4QmNVVVFnUUZCQUJDQ0FVRUJFSDhnQVF1eENBRUdmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVIY1NJR0lnVUVRQ0FGUVFGckRnY0JBZ01FQlFZSENBc2poZ0loQVF3SEN5T0hBaUVCREFZTEk0Z0NJUUVNQlFzamlRSWhBUXdFQ3lPS0FpRUJEQU1MSTRzQ0lRRU1BZ3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaHdFaEFRd0JDeU9GQWlFQkN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdVaUJBUkFJQVJCQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTElBQkJCMHdFZjBFQklRSWdBUkNmQVFVZ0FFRVBUQVIvUVFFaEFpQUJFS0FCQlVFQUN3c2hBd3dQQ3lBQVFSZE1CSDlCQVNFQ0lBRVFvUUVGSUFCQkgwd0VmMEVCSVFJZ0FSQ2lBUVZCQUFzTElRTU1EZ3NnQUVFblRBUi9RUUVoQWlBQkVLTUJCU0FBUVM5TUJIOUJBU0VDSUFFUXBBRUZRUUFMQ3lFRERBMExJQUJCTjB3RWYwRUJJUUlnQVJDbEFRVWdBRUUvVEFSL1FRRWhBaUFCRUtZQkJVRUFDd3NoQXd3TUN5QUFRY2NBVEFSL1FRRWhBa0VBSUFFUXB3RUZJQUJCendCTUJIOUJBU0VDUVFFZ0FSQ25BUVZCQUFzTElRTU1Dd3NnQUVIWEFFd0VmMEVCSVFKQkFpQUJFS2NCQlNBQVFkOEFUQVIvUVFFaEFrRURJQUVRcHdFRlFRQUxDeUVEREFvTElBQkI1d0JNQkg5QkFTRUNRUVFnQVJDbkFRVWdBRUh2QUV3RWYwRUJJUUpCQlNBQkVLY0JCVUVBQ3dzaEF3d0pDeUFBUWZjQVRBUi9RUUVoQWtFR0lBRVFwd0VGSUFCQi93Qk1CSDlCQVNFQ1FRY2dBUkNuQVFWQkFBc0xJUU1NQ0FzZ0FFR0hBVXdFZjBFQklRSWdBVUYrY1FVZ0FFR1BBVXdFZjBFQklRSWdBVUY5Y1FWQkFBc0xJUU1NQndzZ0FFR1hBVXdFZjBFQklRSWdBVUY3Y1FVZ0FFR2ZBVXdFZjBFQklRSWdBVUYzY1FWQkFBc0xJUU1NQmdzZ0FFR25BVXdFZjBFQklRSWdBVUZ2Y1FVZ0FFR3ZBVXdFZjBFQklRSWdBVUZmY1FWQkFBc0xJUU1NQlFzZ0FFRzNBVXdFZjBFQklRSWdBVUcvZjNFRklBQkJ2d0ZNQkg5QkFTRUNJQUZCLzM1eEJVRUFDd3NoQXd3RUN5QUFRY2NCVEFSL1FRRWhBaUFCUVFGeUJTQUFRYzhCVEFSL1FRRWhBaUFCUVFKeUJVRUFDd3NoQXd3REN5QUFRZGNCVEFSL1FRRWhBaUFCUVFSeUJTQUFRZDhCVEFSL1FRRWhBaUFCUVFoeUJVRUFDd3NoQXd3Q0N5QUFRZWNCVEFSL1FRRWhBaUFCUVJCeUJTQUFRZThCVEFSL1FRRWhBaUFCUVNCeUJVRUFDd3NoQXd3QkN5QUFRZmNCVEFSL1FRRWhBaUFCUWNBQWNnVWdBRUgvQVV3RWYwRUJJUUlnQVVHQUFYSUZRUUFMQ3lFREN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0JpSUVCRUFnQkVFQmF3NEhBUUlEQkFVR0J3Z0xJQU1raGdJTUJ3c2dBeVNIQWd3R0N5QURKSWdDREFVTElBTWtpUUlNQkFzZ0F5U0tBZ3dEQ3lBREpJc0NEQUlMSUFWQkJFZ2lCQVIvSUFRRklBVkJCMG9MQkVBaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJZ0F4QjlDd3dCQ3lBREpJVUNDMEVFUVg4Z0Foc0xxd1FBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FCUndSQUlBQkJ3UUZyRGc4QkFoRURCQVVHQndnSkNnc1FEQTBPQ3lPTUFrRUhka0VCY1EwUkRBNExJNDBDRUo0QlFmLy9BM0VoQUNPTkFrRUNha0gvL3dOeEpJMENJQUJCZ1A0RGNVRUlkU1NHQWlBQVFmOEJjU1NIQWtFRUR3c2pqQUpCQjNaQkFYRU5FUXdPQ3lPTUFrRUhka0VCY1EwUURBd0xJNDBDUVFKclFmLy9BM0VpQUNTTkFpQUFJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlFSVVCREEwTEVIc1FrUUVNRFFzampRSkJBbXRCLy84RGNTSUFKSTBDSUFBampnSVFoUUZCQUNTT0Fnd0xDeU9NQWtFSGRrRUJjVUVCUncwS0RBY0xJNDBDSWdBUW5nRkIvLzhEY1NTT0FpQUFRUUpxUWYvL0EzRWtqUUlNQ1FzampBSkJCM1pCQVhGQkFVWU5Cd3dLQ3hCN1FmOEJjUkNvQVNFQUk0NENRUUZxUWYvL0EzRWtqZ0lnQUE4TEk0d0NRUWQyUVFGeFFRRkhEUWdqalFKQkFtdEIvLzhEY1NJQUpJMENJQUFqamdKQkFtcEIvLzhEY1JDRkFRd0ZDeEI3RUpJQkRBWUxJNDBDUVFKclFmLy9BM0VpQUNTTkFpQUFJNDRDRUlVQlFRZ2tqZ0lNQkF0QmZ3OExJNDBDSWdBUW5nRkIvLzhEY1NTT0FpQUFRUUpxUWYvL0EzRWtqUUpCREE4TEk0MENRUUpyUWYvL0EzRWlBQ1NOQWlBQUk0NENRUUpxUWYvL0EzRVFoUUVMRUh4Qi8vOERjU1NPQWd0QkNBOExJNDRDUVFGcVFmLy9BM0VramdKQkJBOExJNDRDUVFKcVFmLy9BM0VramdKQkRBdXFCQUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIUUFVY0VRQ0FBUWRFQmF3NFBBUUlOQXdRRkJnY0lDUTBLRFFzTURRc2pqQUpCQkhaQkFYRU5EeU9OQWlJQUVKNEJRZi8vQTNFa2pnSWdBRUVDYWtILy93TnhKSTBDUVF3UEN5T05BaUlBRUo0QlFmLy9BM0VoQVNBQVFRSnFRZi8vQTNFa2pRSWdBVUdBL2dOeFFRaDFKSWdDSUFGQi93RnhKSWtDUVFRUEN5T01Ba0VFZGtFQmNRMExEQXdMSTR3Q1FRUjJRUUZ4RFFvampRSkJBbXRCLy84RGNTSUJKSTBDSUFFampnSkJBbXBCLy84RGNSQ0ZBUXdMQ3lPTkFrRUNhMEgvL3dOeElnRWtqUUlnQVNPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDRkFRd0xDeEI3RUpRQkRBc0xJNDBDUVFKclFmLy9BM0VpQVNTTkFpQUJJNDRDRUlVQlFSQWtqZ0lNQ1FzampBSkJCSFpCQVhGQkFVY05DQ09OQWlJQkVKNEJRZi8vQTNFa2pnSWdBVUVDYWtILy93TnhKSTBDUVF3UEN5T05BaUlCRUo0QlFmLy9BM0VramdKQkFTU3pBU0FCUVFKcVFmLy9BM0VralFJTUJ3c2pqQUpCQkhaQkFYRkJBVVlOQlF3RUN5T01Ba0VFZGtFQmNVRUJSdzBESTQwQ1FRSnJRZi8vQTNFaUFTU05BaUFCSTQ0Q1FRSnFRZi8vQTNFUWhRRU1CQXNRZXhDVkFRd0ZDeU9OQWtFQ2EwSC8vd054SWdFa2pRSWdBU09PQWhDRkFVRVlKSTRDREFNTFFYOFBDeU9PQWtFQ2FrSC8vd054Skk0Q1FRd1BDeEI4UWYvL0EzRWtqZ0lMUVFnUEN5T09Ba0VCYWtILy93TnhKSTRDUVFRTG5RTUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQVVjRVFDQUFRZUVCYXc0UEFRSUxDd01FQlFZSENBc0xDd2tLQ3dzUWUwSC9BWEZCZ1A0RGFpT0ZBaEI5REFzTEk0MENJZ0FRbmdGQi8vOERjU0VCSUFCQkFtcEIvLzhEY1NTTkFpQUJRWUQrQTNGQkNIVWtpZ0lnQVVIL0FYRWtpd0pCQkE4TEk0Y0NRWUQrQTJvamhRSVFmVUVFRHdzampRSkJBbXRCLy84RGNTSUJKSTBDSUFFaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJUWhRRkJDQThMRUhzUWx3RU1Cd3NqalFKQkFtdEIvLzhEY1NJQkpJMENJQUVqamdJUWhRRkJJQ1NPQWtFSUR3c1FlMEVZZEVFWWRTRUJJNDBDSUFGQkFSQ0dBU09OQWlBQmFrSC8vd054SkkwQ1FRQVFnUUZCQUJDQ0FTT09Ba0VCYWtILy93TnhKSTRDUVF3UEN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNpU09Ba0VFRHdzUWZFSC8vd054STRVQ0VIMGpqZ0pCQW1wQi8vOERjU1NPQWtFRUR3c1FleENZQVF3Q0N5T05Ba0VDYTBILy93TnhJZ0VralFJZ0FTT09BaENGQVVFb0pJNENRUWdQQzBGL0R3c2pqZ0pCQVdwQi8vOERjU1NPQWtFRUM5WURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZIQkVBZ0FFSHhBV3NPRHdFQ0F3MEVCUVlIQ0FrS0RRMExEQTBMRUh0Qi93RnhRWUQrQTJvUWh3RkIvd0Z4SklVQ0RBMExJNDBDSWdBUW5nRkIvLzhEY1NFQklBQkJBbXBCLy84RGNTU05BaUFCUVlEK0EzRkJDSFVraFFJZ0FVSC9BWEVrakFJTURRc2pod0pCZ1A0RGFoQ0hBVUgvQVhFa2hRSU1EQXRCQUNTeUFRd0xDeU9OQWtFQ2EwSC8vd054SWdFa2pRSWdBU09NQWtIL0FYRWpoUUpCL3dGeFFRaDBjaENGQVVFSUR3c1FleENhQVF3SUN5T05Ba0VDYTBILy93TnhJZ0VralFJZ0FTT09BaENGQVVFd0pJNENRUWdQQ3hCN1FSaDBRUmgxSVFFampRSWhBRUVBRUlFQlFRQVFnZ0VnQUNBQlFRRVFoZ0VnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTS0FpQUFRZjhCY1NTTEFpT09Ba0VCYWtILy93TnhKSTRDUVFnUEN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNpU05Ba0VJRHdzUWZFSC8vd054RUljQlFmOEJjU1NGQWlPT0FrRUNha0gvL3dOeEpJNENEQVVMUVFFa3N3RU1CQXNRZXhDYkFRd0NDeU9OQWtFQ2EwSC8vd054SWdBa2pRSWdBQ09PQWhDRkFVRTRKSTRDUVFnUEMwRi9Ed3NqamdKQkFXcEIvLzhEY1NTT0FndEJCQXZqQVFFQmZ5T09Ba0VCYWtILy93TnhJUUVqa2dJRVFDQUJRUUZyUWYvL0EzRWhBUXNnQVNTT0FnSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lCQkVBZ0FVRUJSZzBCQWtBZ0FVRUNhdzROQXdRRkJnY0lDUW9MREEwT0R3QUxEQThMSUFBUWlBRVBDeUFBRUlrQkR3c2dBQkNLQVE4TElBQVFpd0VQQ3lBQUVJd0JEd3NnQUJDTkFROExJQUFRamdFUEN5QUFFSThCRHdzZ0FCQ1RBUThMSUFBUWxnRVBDeUFBRUprQkR3c2dBQkNjQVE4TElBQVFxUUVQQ3lBQUVLb0JEd3NnQUJDckFROExJQUFRckFFTHZnRUJBbjlCQUNTeUFVR1AvZ01RQWtFQklBQjBRWDl6Y1NJQkpMb0JRWS8rQXlBQkVBUWpqUUpCQW10Qi8vOERjU1NOQWlPTkFpSUJJNDRDSWdKQi93RnhFQVFnQVVFQmFpQUNRWUQrQTNGQkNIVVFCQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQXdNRUJRQUxEQVVMUVFBa3V3RkJ3QUFramdJTUJBdEJBQ1M4QVVISUFDU09BZ3dEQzBFQUpMMEJRZEFBSkk0Q0RBSUxRUUFrdmdGQjJBQWtqZ0lNQVF0QkFDUy9BVUhnQUNTT0Fnc0wrUUVCQTM4anN3RUVRRUVCSkxJQlFRQWtzd0VMSTdRQkk3b0JjVUVmY1VFQVNnUkFJNUVDUlNPeUFTSUNJQUliQkg4anV3RWp0UUVpQUNBQUd3Ui9RUUFRcmdGQkFRVWp2QUVqdGdFaUFDQUFHd1IvUVFFUXJnRkJBUVVqdlFFanR3RWlBQ0FBR3dSL1FRSVFyZ0ZCQVFVanZnRWp1QUVpQUNBQUd3Ui9RUU1RcmdGQkFRVWp2d0VqdVFFaUFDQUFHd1IvUVFRUXJnRkJBUVZCQUFzTEN3c0xCVUVBQ3dSQUk1QUNJZ0Fqa1FJZ0FCc0VmMEVBSkpFQ1FRQWtrQUpCQUNTU0FrRUFKSk1DUVJnRlFSUUxJUUVMSTVBQ0lnQWprUUlnQUJzRVFFRUFKSkVDUVFBa2tBSkJBQ1NTQWtFQUpKTUNDeUFCRHd0QkFBdTdBUUVDZjBFQkpKMENJNUlDQkVBampnSVFBa0gvQVhFUXJRRVFla0VBSkpFQ1FRQWtrQUpCQUNTU0FrRUFKSk1DQ3hDdkFTSUFRUUJLQkVBZ0FCQjZDMEVFSVFFamtBSWlBQ09SQWlBQUcwVWlBQVIvSTVNQ1JRVWdBQXNFUUNPT0FoQUNRZjhCY1JDdEFTRUJDeU9NQWtId0FYRWtqQUlnQVVFQVRBUkFJQUVQQ3lBQkVIb2ptUUpCQVdvaUFDT1hBazRFZnlPWUFrRUJhaVNZQWlBQUk1Y0Nhd1VnQUFza21RSWpqZ0lqMkFGR0JFQkJBU1RiQVFzZ0FRc0ZBQ093QVF2TUFRRUVmeUFBUVg5QmdBZ2dBRUVBU0JzZ0FFRUFTaHNoQTBFQUlRQURRQUovQW44Z0JFVWlBUVJBSUFCRklRRUxJQUVMQkVBZ0FrVWhBUXNnQVFzRVFDUGJBVVVoQVFzZ0FRUkFFTEFCUVFCSUJFQkJBU0VFQlNPUEFrSFFwQVFqaEFKMFRnUkFRUUVoQUFVZ0EwRi9TaUlCQkVBanNBRWdBMDRoQVF0QkFTQUNJQUViSVFJTEN3d0JDd3NnQUFSQUk0OENRZENrQkNPRUFuUnJKSThDSTVvQ0R3c2dBZ1JBSTVzQ0R3c2oyd0VFUUVFQUpOc0JJNXdDRHdzampnSkJBV3RCLy84RGNTU09Ba0YvQ3djQVFYOFFzZ0VMT1FFRGZ3TkFJQUlnQUVnaUF3Ui9JQUZCQUU0RklBTUxCRUJCZnhDeUFTRUJJQUpCQVdvaEFnd0JDd3NnQVVFQVNBUkFJQUVQQzBFQUN3VUFJNVFDQ3dVQUk1VUNDd1VBSTVZQ0MxOEJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQUlnRkJBVVlOQVFKQUlBRkJBbXNPQmdNRUJRWUhDQUFMREFnTEk4MEJEd3NqMEFFUEN5UE9BUThMSTg4QkR3c2owUUVQQ3lQU0FROExJOU1CRHdzajFBRVBDMEVBQzRzQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQ1FRRkdEUUVDUUNBQ1FRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lBQlFRQkhKTTBCREFjTElBRkJBRWNrMEFFTUJnc2dBVUVBUnlUT0FRd0ZDeUFCUVFCSEpNOEJEQVFMSUFGQkFFY2swUUVNQXdzZ0FVRUFSeVRTQVF3Q0N5QUJRUUJISk5NQkRBRUxJQUZCQUVjazFBRUxDMVVCQVg5QkFDU1RBaUFBRUxnQlJRUkFRUUVoQVFzZ0FFRUJFTGtCSUFFRVFFRUJRUUZCQUVFQlFRQWdBRUVEVEJzaUFTUFdBU0lBSUFBYkd5QUJSU1BYQVNJQUlBQWJHd1JBUVFFa3Z3RkJCQkEvQ3dzTENRQWdBRUVBRUxrQkM1b0JBQ0FBUVFCS0JFQkJBQkM2QVFWQkFCQzdBUXNnQVVFQVNnUkFRUUVRdWdFRlFRRVF1d0VMSUFKQkFFb0VRRUVDRUxvQkJVRUNFTHNCQ3lBRFFRQktCRUJCQXhDNkFRVkJBeEM3QVFzZ0JFRUFTZ1JBUVFRUXVnRUZRUVFRdXdFTElBVkJBRW9FUUVFRkVMb0JCVUVGRUxzQkN5QUdRUUJLQkVCQkJoQzZBUVZCQmhDN0FRc2dCMEVBU2dSQVFRY1F1Z0VGUVFjUXV3RUxDd2NBSUFBazJBRUxCd0JCZnlUWUFRc0hBQ0FBSk5rQkN3Y0FRWDhrMlFFTEJ3QWdBQ1RhQVFzSEFFRi9KTm9CQ3dVQUk0VUNDd1VBSTRZQ0N3VUFJNGNDQ3dVQUk0Z0NDd1VBSTRrQ0N3VUFJNG9DQ3dVQUk0c0NDd1VBSTR3Q0N3VUFJNDRDQ3dVQUk0MENDd3NBSTQ0Q0VBSkIvd0Z4Q3dVQUkrZ0JDOEVEQVFwL1FZQ0FBa0dBa0FJajRRRWJJUWxCZ0xnQ1FZQ3dBaVBpQVJzaENnTkFJQVpCZ0FKSUJFQkJBQ0VGQTBBZ0JVR0FBa2dFUUNBSklBWkJBM1ZCQlhRZ0Ntb2dCVUVEZFdvaUEwR0FrSDVxTFFBQUVESWhDQ0FHUVFodklRRkJCeUFGUVFodmF5RUhRUUFoQWdKL0lBQkJBRW9qZ3dJaUJDQUVHd1JBSUFOQmdOQithaTBBQUNFQ0N5QUNRY0FBY1FzRVFFRUhJQUZySVFFTFFRQWhCQ0FCUVFGMElBaHFJZ05CZ0pCK2FrRUJRUUFnQWtFSWNSc2lCRUVCY1VFTmRHb3RBQUFoQ0VFQUlRRWdBMEdCa0g1cUlBUkJBWEZCRFhScUxRQUFRUUVnQjNSeEJFQkJBaUVCQ3lBQlFRRnFJQUZCQVNBSGRDQUljUnNoQVNBR1FRaDBJQVZxUVFOc0lRY2dBRUVBU2lPREFpSURJQU1iQkVBZ0FrRUhjU0FCUVFBUU15SUJRUjl4UVFOMElRUWdBVUhnQjNGQkJYVkJBM1FoQXlBQlFZRDRBWEZCQ25WQkEzUWhBaUFIUVlDaEMyb2lBU0FFT2dBQUlBRkJBV29nQXpvQUFDQUJRUUpxSUFJNkFBQUZJQWRCZ0tFTGFpSUNJQUZCeC80REVEUWlBVUdBZ1B3SGNVRVFkVG9BQUNBQ1FRRnFJQUZCZ1A0RGNVRUlkVG9BQUNBQ1FRSnFJQUU2QUFBTElBVkJBV29oQlF3QkN3c2dCa0VCYWlFR0RBRUxDd3ZkQXdFTWZ3TkFJQU5CRjA1RkJFQkJBQ0VDQTBBZ0FrRWZTQVJBUVFGQkFDQUNRUTlLR3lFSklBTkJEMnNnQXlBRFFROUtHMEVFZENJSElBSkJEMnRxSUFJZ0Iyb2dBa0VQU2hzaEIwR0FrQUpCZ0lBQ0lBTkJEMG9iSVF0QngvNERJUXBCZnlFQlFYOGhDRUVBSVFRRFFDQUVRUWhJQkVCQkFDRUFBMEFnQUVFRlNBUkFJQUJCQTNRZ0JHcEJBblFpQlVHQy9BTnFFQUlnQjBZRVFDQUZRWVA4QTJvUUFpRUdRUUZCQUNBR1FRaHhRUUJISTRNQ0k0TUNHeHNnQ1VZRVFFRUlJUVJCQlNFQUlBWWlDRUVRY1FSL1FjbitBd1ZCeVA0REN5RUtDd3NnQUVFQmFpRUFEQUVMQ3lBRVFRRnFJUVFNQVFzTElBaEJBRWdqZ3dJaUJpQUdHd1JBUVlDNEFrR0FzQUlqNGdFYklRUkJmeUVBUVFBaEFRTkFJQUZCSUVnRVFFRUFJUVVEUUNBRlFTQklCRUFnQlVFRmRDQUVhaUFCYWlJR1FZQ1FmbW90QUFBZ0IwWUVRRUVnSVFVZ0JpRUFRU0FoQVFzZ0JVRUJhaUVGREFFTEN5QUJRUUZxSVFFTUFRc0xJQUJCQUU0RWZ5QUFRWURRZm1vdEFBQUZRWDhMSVFFTFFRQWhBQU5BSUFCQkNFZ0VRQ0FISUFzZ0NVRUFRUWNnQUNBQ1FRTjBJQU5CQTNRZ0FHcEIrQUZCZ0tFWElBb2dBU0FJRURVYUlBQkJBV29oQUF3QkN3c2dBa0VCYWlFQ0RBRUxDeUFEUVFGcUlRTU1BUXNMQzVvQ0FRbC9BMEFnQkVFSVRrVUVRRUVBSVFFRFFDQUJRUVZJQkVBZ0FVRURkQ0FFYWtFQ2RDSUFRWUQ4QTJvUUFob2dBRUdCL0FOcUVBSWFJQUJCZ3Z3RGFoQUNJUUpCQVNFRkkrTUJCRUFnQWtFQ2IwRUJSZ1JBSUFKQkFXc2hBZ3RCQWlFRkN5QUFRWVA4QTJvUUFpRUdRUUFoQjBFQlFRQWdCa0VJY1VFQVJ5T0RBaU9EQWhzYklRZEJ5UDRESVFoQnlmNERRY2orQXlBR1FSQnhHeUVJUVFBaEFBTkFJQUFnQlVnRVFFRUFJUU1EUUNBRFFRaElCRUFnQUNBQ2FrR0FnQUlnQjBFQVFRY2dBeUFFUVFOMElBRkJCSFFnQTJvZ0FFRURkR3BCd0FCQmdLRWdJQWhCZnlBR0VEVWFJQU5CQVdvaEF3d0JDd3NnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTElBUkJBV29oQkF3QkN3c0xCUUFqd1FFTEJRQWp3Z0VMQlFBanhRRUxHQUVCZnlQSEFTRUFJOFlCQkVBZ0FFRUVjaUVBQ3lBQUN6QUJBWDhEUUFKQUlBQkIvLzhEVGcwQUlBQkJnTFhKQkdvZ0FCQmJPZ0FBSUFCQkFXb2hBQXdCQ3d0QkFDVGJBUXNXQUJBQVB3QkJsQUZJQkVCQmxBRS9BR3RBQUJvTEN3TUFBUXNkQUFKQUFrQUNRQ09lQWc0Q0FRSUFDd0FMUVFBaEFBc2dBQkN5QVFzSEFDQUFKSjRDQ3lVQUFrQUNRQUpBQWtBam5nSU9Bd0VDQXdBTEFBdEJBU0VBQzBGL0lRRUxJQUVRc2dFTEFETVFjMjkxY21ObFRXRndjR2x1WjFWU1RDRmpiM0psTDJScGMzUXZZMjl5WlM1MWJuUnZkV05vWldRdWQyRnpiUzV0WVhBPSIpOgphd2FpdCBPKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQml3RVNZQUFBWUFwL2YzOS9mMzkvZjM5L0FHQUJmd0YvWUFGL0FHQUNmMzhBWUFKL2Z3Ri9ZQUFCZjJBRGYzOS9BR0FHZjM5L2YzOS9BR0FIZjM5L2YzOS9md0YvWUFOL2YzOEJmMkFIZjM5L2YzOS9md0JnQkg5L2YzOEJmMkFJZjM5L2YzOS9mMzhBWUFWL2YzOS9md0YvWUExL2YzOS9mMzkvZjM5L2YzOS9BWDlnQW45L0FHQUJmd0YvQTk0QjNBRUFBZ0lBQkFBQUF3TUFBQUFBQUFBQUF3QUFBd01BQUFBQUFRWUFBQUFBQUFBQUFBTURBQUFBQUFBQUFBQUdCZ1lHRGdVS0JROEpDd2dJQndRREFBQURBQUFBQUFBREFBQUFBQUFDQWdVQ0FnSUNCUXdEQXdNQUFnWUNBZ1FEQXdNREFBQUFBQVVEQmdZREJBSUZBd0FBQXdVRUJ3QUZBQU1BQXdNR0JnUVFBd1FEQXdNRUJBY0NBZ0lDQWdJQ0FnSUVBd01DQXdNQ0F3TUNBd01DQWdJQ0FnSUNBZ0lDQWdVQ0FnSUNBZ0lEQmdZR0VRWUNCZ1lHQWdRREF3MERBQU1BQXdBR0JnWUdCZ1lHQmdZR0JnWURBQUFHQmdZR0FBQUFBZ01GQkFRQmNBQUJCUU1CQUFBR21BeWZBbjhBUVFBTGZ3QkJnQWdMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQkFMZndCQmdJQUJDMzhBUVlDUUFRdC9BRUdBZ0FJTGZ3QkJnSkFEQzM4QVFZQ0FBUXQvQUVHQUVBdC9BRUdBZ0FRTGZ3QkJnSkFFQzM4QVFZQUJDMzhBUVlDUkJBdC9BRUdBdUFFTGZ3QkJnTWtGQzM4QVFZRFlCUXQvQUVHQW9Rc0xmd0JCZ0lBTUMzOEFRWUNoRnd0L0FFR0FnQWtMZndCQmdLRWdDMzhBUVlENEFBdC9BRUdBa0FRTGZ3QkJnSWtkQzM4QVFZQ1pJUXQvQUVHQWdBZ0xmd0JCZ0prcEMzOEFRWUNBQ0F0L0FFR0FtVEVMZndCQmdJQUlDMzhBUVlDWk9RdC9BRUdBZ0FnTGZ3QkJnSm5CQUF0L0FFR0FnQWdMZndCQmdKbkpBQXQvQUVHQWdBZ0xmd0JCZ0puUkFBdC9BRUdBRkF0L0FFR0FyZEVBQzM4QVFZQ0krQU1MZndCQmdMWEpCQXQvQUVILy93TUxmd0JCQUF0L0FFR0F0YzBFQzM4QVFaUUJDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQjZQNERDMzhCUWVuK0F3dC9BVUhyL2dNTGZ3RkJmd3QvQVVGL0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZjhBQzM4QlFmOEFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVR0E5d0lMZndGQkFBdC9BVUVBQzM4QlFZQ0FDQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCMGY0REMzOEJRZEwrQXd0L0FVSFQvZ01MZndGQjFQNERDMzhCUWRYK0F3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJ6LzREQzM4QlFmRCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQmdLald1UWNMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUNDMzhCUVFBTGZ3RkJBQXNIdXhCaEJtMWxiVzl5ZVFJQUJYUmhZbXhsQVFBR1kyOXVabWxuQUJrT2FHRnpRMjl5WlZOMFlYSjBaV1FBR2dsellYWmxVM1JoZEdVQUlRbHNiMkZrVTNSaGRHVUFMQVZwYzBkQ1F3QXRFbWRsZEZOMFpYQnpVR1Z5VTNSbGNGTmxkQUF1QzJkbGRGTjBaWEJUWlhSekFDOElaMlYwVTNSbGNITUFNQlZsZUdWamRYUmxUWFZzZEdsd2JHVkdjbUZ0WlhNQXRBRU1aWGhsWTNWMFpVWnlZVzFsQUxNQkNGOXpaWFJoY21kakFOb0JHV1Y0WldOMWRHVkdjbUZ0WlVGdVpFTm9aV05yUVhWa2FXOEEyUUVWWlhobFkzVjBaVlZ1ZEdsc1EyOXVaR2wwYVc5dUFOc0JDMlY0WldOMWRHVlRkR1Z3QUxBQkZHZGxkRU41WTJ4bGMxQmxja041WTJ4bFUyVjBBTFVCREdkbGRFTjVZMnhsVTJWMGN3QzJBUWxuWlhSRGVXTnNaWE1BdHdFT2MyVjBTbTk1Y0dGa1UzUmhkR1VBdkFFZloyVjBUblZ0WW1WeVQyWlRZVzF3YkdWelNXNUJkV1JwYjBKMVptWmxjZ0N4QVJCamJHVmhja0YxWkdsdlFuVm1abVZ5QUNnY2MyVjBUV0Z1ZFdGc1EyOXNiM0pwZW1GMGFXOXVVR0ZzWlhSMFpRQUhGMWRCVTAxQ1QxbGZUVVZOVDFKWlgweFBRMEZVU1U5T0F5d1RWMEZUVFVKUFdWOU5SVTFQVWxsZlUwbGFSUU10RWxkQlUwMUNUMWxmVjBGVFRWOVFRVWRGVXdNdUhrRlRVMFZOUWt4WlUwTlNTVkJVWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01BR2tGVFUwVk5Ra3haVTBOU1NWQlVYMDFGVFU5U1dWOVRTVnBGQXdFV1YwRlRUVUpQV1Y5VFZFRlVSVjlNVDBOQlZFbFBUZ01DRWxkQlUwMUNUMWxmVTFSQlZFVmZVMGxhUlFNRElFZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdvY1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVTBsYVJRTUxFbFpKUkVWUFgxSkJUVjlNVDBOQlZFbFBUZ01FRGxaSlJFVlBYMUpCVFY5VFNWcEZBd1VSVjA5U1MxOVNRVTFmVEU5RFFWUkpUMDREQmcxWFQxSkxYMUpCVFY5VFNWcEZBd2NtVDFSSVJWSmZSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RENDSlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3a1lSMUpCVUVoSlExTmZUMVZVVUZWVVgweFBRMEZVU1U5T0F4Z1VSMUpCVUVoSlExTmZUMVZVVUZWVVgxTkpXa1VER1JSSFFrTmZVRUZNUlZSVVJWOU1UME5CVkVsUFRnTU1FRWRDUTE5UVFVeEZWRlJGWDFOSldrVUREUmhDUjE5UVVrbFBVa2xVV1Y5TlFWQmZURTlEUVZSSlQwNEREaFJDUjE5UVVrbFBVa2xVV1Y5TlFWQmZVMGxhUlFNUERrWlNRVTFGWDB4UFEwRlVTVTlPQXhBS1JsSkJUVVZmVTBsYVJRTVJGMEpCUTB0SFVrOVZUa1JmVFVGUVgweFBRMEZVU1U5T0F4SVRRa0ZEUzBkU1QxVk9SRjlOUVZCZlUwbGFSUU1URWxSSlRFVmZSRUZVUVY5TVQwTkJWRWxQVGdNVURsUkpURVZmUkVGVVFWOVRTVnBGQXhVU1QwRk5YMVJKVEVWVFgweFBRMEZVU1U5T0F4WU9UMEZOWDFSSlRFVlRYMU5KV2tVREZ4VkJWVVJKVDE5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESWhGQlZVUkpUMTlDVlVaR1JWSmZVMGxhUlFNakdVTklRVTVPUlV4Zk1WOUNWVVpHUlZKZlRFOURRVlJKVDA0REdoVkRTRUZPVGtWTVh6RmZRbFZHUmtWU1gxTkpXa1VER3hsRFNFRk9Ua1ZNWHpKZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXh3VlEwaEJUazVGVEY4eVgwSlZSa1pGVWw5VFNWcEZBeDBaUTBoQlRrNUZURjh6WDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01lRlVOSVFVNU9SVXhmTTE5Q1ZVWkdSVkpmVTBsYVJRTWZHVU5JUVU1T1JVeGZORjlDVlVaR1JWSmZURTlEUVZSSlQwNERJQlZEU0VGT1RrVk1YelJmUWxWR1JrVlNYMU5KV2tVRElSWkRRVkpVVWtsRVIwVmZVa0ZOWDB4UFEwRlVTVTlPQXlRU1EwRlNWRkpKUkVkRlgxSkJUVjlUU1ZwRkF5VVJRazlQVkY5U1QwMWZURTlEUVZSSlQwNERKZzFDVDA5VVgxSlBUVjlUU1ZwRkF5Y1dRMEZTVkZKSlJFZEZYMUpQVFY5TVQwTkJWRWxQVGdNb0VrTkJVbFJTU1VSSFJWOVNUMDFmVTBsYVJRTXBIVVJGUWxWSFgwZEJUVVZDVDFsZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXlvWlJFVkNWVWRmUjBGTlJVSlBXVjlOUlUxUFVsbGZVMGxhUlFNcklXZGxkRmRoYzIxQ2IzbFBabVp6WlhSR2NtOXRSMkZ0WlVKdmVVOW1abk5sZEFBQkczTmxkRkJ5YjJkeVlXMURiM1Z1ZEdWeVFuSmxZV3R3YjJsdWRBQzlBUjF5WlhObGRGQnliMmR5WVcxRGIzVnVkR1Z5UW5KbFlXdHdiMmx1ZEFDK0FSbHpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFMOEJHM0psYzJWMFVtVmhaRWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURBQVJwelpYUlhjbWwwWlVkaVRXVnRiM0o1UW5KbFlXdHdiMmx1ZEFEQkFSeHlaWE5sZEZkeWFYUmxSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBTUlCREdkbGRGSmxaMmx6ZEdWeVFRRERBUXhuWlhSU1pXZHBjM1JsY2tJQXhBRU1aMlYwVW1WbmFYTjBaWEpEQU1VQkRHZGxkRkpsWjJsemRHVnlSQURHQVF4blpYUlNaV2RwYzNSbGNrVUF4d0VNWjJWMFVtVm5hWE4wWlhKSUFNZ0JER2RsZEZKbFoybHpkR1Z5VEFESkFReG5aWFJTWldkcGMzUmxja1lBeWdFUloyVjBVSEp2WjNKaGJVTnZkVzUwWlhJQXl3RVBaMlYwVTNSaFkydFFiMmx1ZEdWeUFNd0JHV2RsZEU5d1kyOWtaVUYwVUhKdlozSmhiVU52ZFc1MFpYSUF6UUVGWjJWMFRGa0F6Z0VkWkhKaGQwSmhZMnRuY205MWJtUk5ZWEJVYjFkaGMyMU5aVzF2Y25rQXp3RVlaSEpoZDFScGJHVkVZWFJoVkc5WFlYTnRUV1Z0YjNKNUFOQUJFMlJ5WVhkUFlXMVViMWRoYzIxTlpXMXZjbmtBMFFFR1oyVjBSRWxXQU5JQkIyZGxkRlJKVFVFQTB3RUdaMlYwVkUxQkFOUUJCbWRsZEZSQlF3RFZBUk4xY0dSaGRHVkVaV0oxWjBkQ1RXVnRiM0o1QU5ZQkNBTFhBUWtJQVFCQkFBc0IyQUVLNytjQjNBRlRBRUh5NWNzSEpEbEJvTUdDQlNRNlFkaXc0UUlrTzBHSWtDQWtQRUh5NWNzSEpEMUJvTUdDQlNRK1FkaXc0UUlrUDBHSWtDQWtRRUh5NWNzSEpFRkJvTUdDQlNSQ1FkaXc0UUlrUTBHSWtDQWtSQXViQWdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRU1kU0lCQkVBZ0FVRUJhdzROQVFFQkFnSUNBZ01EQkFRRkJnY0xJNElDQkVBamd3SUVRQ0FBUVlBQ1NBMEpJQUJCL3dOS0lnRUVmeUFBUVlBU1NBVWdBUXNOQ1FVamd3SkZJZ0VFZnlBQVFZQUNTQVVnQVFzTkNRc0xDeUFBUVlDdDBRQnFEd3NnQUVFQkkrMEJJZ0VqOVFGRklnQUVmeUFCUlFVZ0FBc2JRUTUwYWtHQXJkQUFhZzhMSUFCQmdKQithaU9EQWdSL0k0QUNFQUpCQVhFRlFRQUxRUTEwYWc4TElBQWo3Z0ZCRFhScVFZRFp4Z0JxRHdzZ0FFR0FrSDVxRHd0QkFDRUJBbjhqZ3dJRVFDT0JBaEFDUVFkeElRRUxJQUZCQVVnTEJIOUJBUVVnQVF0QkRIUWdBR3BCZ1BCOWFnOExJQUJCZ0ZCcUR3c2dBRUdBbWRFQWFnc0pBQ0FBRUFFdEFBQUx3d0VBUVFBa2hBSkJBQ1NGQWtFQUpJWUNRUUFraHdKQkFDU0lBa0VBSklrQ1FRQWtpZ0pCQUNTTEFrRUFKSXdDUVFBa2pRSkJBQ1NPQWtFQUpJOENRUUFra0FKQkFDU1JBa0VBSkpJQ1FRQWtrd0lqZ2dJRVFBOExJNE1DQkVCQkVTU0ZBa0dBQVNTTUFrRUFKSVlDUVFBa2h3SkIvd0VraUFKQjFnQWtpUUpCQUNTS0FrRU5KSXNDQlVFQkpJVUNRYkFCSkl3Q1FRQWtoZ0pCRXlTSEFrRUFKSWdDUWRnQkpJa0NRUUVraWdKQnpRQWtpd0lMUVlBQ0pJNENRZjcvQXlTTkFnc0xBQ0FBRUFFZ0FUb0FBQXVKQVFFQ2YwRUFKTzhCUVFFazhBRkJ4d0lRQWlJQlJTVHhBU0FCUVFGT0lnQUVRQ0FCUVFOTUlRQUxJQUFrOGdFZ0FVRUZUaUlBQkVBZ0FVRUdUQ0VBQ3lBQUpQTUJJQUZCRDA0aUFBUkFJQUZCRTB3aEFBc2dBQ1QwQVNBQlFSbE9JZ0FFUUNBQlFSNU1JUUFMSUFBazlRRkJBU1R0QVVFQUpPNEJJNEFDUVFBUUJDT0JBa0VCRUFRTEx3QkIwZjREUWY4QkVBUkIwdjREUWY4QkVBUkIwLzREUWY4QkVBUkIxUDREUWY4QkVBUkIxZjREUWY4QkVBUUx0QWdCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBQ0lCUVFGR0RRRUNRQ0FCUVFKckRnc0RCQVVHQndnSkNnc01EUUFMREEwTFFmTGx5d2NrT1VHZ3dZSUZKRHBCMkxEaEFpUTdRWWlRSUNROFFmTGx5d2NrUFVHZ3dZSUZKRDVCMkxEaEFpUS9RWWlRSUNSQVFmTGx5d2NrUVVHZ3dZSUZKRUpCMkxEaEFpUkRRWWlRSUNSRURBd0xRZi8vL3dja09VSGoydjRISkRwQmdPS1FCQ1E3UVFBa1BFSC8vLzhISkQxQjQ5citCeVErUVlEaWtBUWtQMEVBSkVCQi8vLy9CeVJCUWVQYS9nY2tRa0dBNHBBRUpFTkJBQ1JFREFzTFFmLy8vd2NrT1VHRWlmNEhKRHBCdXZUUUJDUTdRUUFrUEVILy8vOEhKRDFCc2Y3dkF5UStRWUNJQWlRL1FRQWtRRUgvLy84SEpFRkIvOHVPQXlSQ1FmOEJKRU5CQUNSRURBb0xRY1hOL3dja09VR0V1Ym9HSkRwQnFkYVJCQ1E3UVlqaTZBSWtQRUgvLy84SEpEMUI0OXIrQnlRK1FZRGlrQVFrUDBFQUpFQkIvLy8vQnlSQlFlUGEvZ2NrUWtHQTRwQUVKRU5CQUNSRURBa0xRZi8vL3dja09VR0Evc3NDSkRwQmdJVDlCeVE3UVFBa1BFSC8vLzhISkQxQmdQN0xBaVErUVlDRS9RY2tQMEVBSkVCQi8vLy9CeVJCUVlEK3l3SWtRa0dBaFAwSEpFTkJBQ1JFREFnTFFmLy8vd2NrT1VHeC91OERKRHBCeGNjQkpEdEJBQ1E4UWYvLy93Y2tQVUdFaWY0SEpENUJ1dlRRQkNRL1FRQWtRRUgvLy84SEpFRkJoSW4rQnlSQ1FicjAwQVFrUTBFQUpFUU1Cd3RCQUNRNVFZU0pBaVE2UVlDOC93Y2tPMEgvLy84SEpEeEJBQ1E5UVlTSkFpUStRWUM4L3dja1AwSC8vLzhISkVCQkFDUkJRWVNKQWlSQ1FZQzgvd2NrUTBILy8vOEhKRVFNQmd0QnBmLy9CeVE1UVpTcC9nY2tPa0gvcWRJRUpEdEJBQ1E4UWFYLy93Y2tQVUdVcWY0SEpENUIvNm5TQkNRL1FRQWtRRUdsLy84SEpFRkJsS24rQnlSQ1FmK3AwZ1FrUTBFQUpFUU1CUXRCLy8vL0J5UTVRWUQrL3dja09rR0FnUHdISkR0QkFDUThRZi8vL3dja1BVR0EvdjhISkQ1QmdJRDhCeVEvUVFBa1FFSC8vLzhISkVGQmdQNy9CeVJDUVlDQS9BY2tRMEVBSkVRTUJBdEIvLy8vQnlRNVFZRCsvd2NrT2tHQWxPMERKRHRCQUNROFFmLy8vd2NrUFVIL3k0NERKRDVCL3dFa1AwRUFKRUJCLy8vL0J5UkJRYkgrN3dNa1FrR0FpQUlrUTBFQUpFUU1Bd3RCLy8vL0J5UTVRZi9MamdNa09rSC9BU1E3UVFBa1BFSC8vLzhISkQxQmhJbitCeVErUWJyMDBBUWtQMEVBSkVCQi8vLy9CeVJCUWJIKzd3TWtRa0dBaUFJa1EwRUFKRVFNQWd0Qi8vLy9CeVE1UWQ2WnNnUWtPa0dNcGNrQ0pEdEJBQ1E4UWYvLy93Y2tQVUdFaWY0SEpENUJ1dlRRQkNRL1FRQWtRRUgvLy84SEpFRkI0OXIrQnlSQ1FZRGlrQVFrUTBFQUpFUU1BUXRCLy8vL0J5UTVRYVhMbGdVa09rSFNwTWtDSkR0QkFDUThRZi8vL3dja1BVR2x5NVlGSkQ1QjBxVEpBaVEvUVFBa1FFSC8vLzhISkVGQnBjdVdCU1JDUWRLa3lRSWtRMEVBSkVRTEM5NElBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCaUFGSEJFQWdBQ0lCUWVFQVJnMEJJQUZCRkVZTkFpQUJRY1lBUmcwRElBRkIyUUJHRFFRZ0FVSEdBVVlOQkNBQlFZWUJSZzBGSUFGQnFBRkdEUVVnQVVHL0FVWU5CaUFCUWM0QlJnMEdJQUZCMFFGR0RRWWdBVUh3QVVZTkJpQUJRU2RHRFFjZ0FVSEpBRVlOQnlBQlFkd0FSZzBISUFGQnN3RkdEUWNnQVVISkFVWU5DQ0FCUWZBQVJnMEpJQUZCeGdCR0RRb2dBVUhUQVVZTkN3d01DMEgvdVpZRkpEbEJnUDcvQnlRNlFZREdBU1E3UVFBa1BFSC91WllGSkQxQmdQNy9CeVErUVlER0FTUS9RUUFrUUVIL3VaWUZKRUZCZ1A3L0J5UkNRWURHQVNSRFFRQWtSQXdMQzBILy8vOEhKRGxCLzh1T0F5UTZRZjhCSkR0QkFDUThRZi8vL3dja1BVR0VpZjRISkQ1QnV2VFFCQ1EvUVFBa1FFSC8vLzhISkVGQi84dU9BeVJDUWY4QkpFTkJBQ1JFREFvTFFmLy8vd2NrT1VHRWlmNEhKRHBCdXZUUUJDUTdRUUFrUEVILy8vOEhKRDFCc2Y3dkF5UStRWUNJQWlRL1FRQWtRRUgvLy84SEpFRkJoSW4rQnlSQ1FicjAwQVFrUTBFQUpFUU1DUXRCLyt2V0JTUTVRWlQvL3dja09rSEN0TFVGSkR0QkFDUThRUUFrUFVILy8vOEhKRDVCaEluK0J5US9RYnIwMEFRa1FFRUFKRUZCLy8vL0J5UkNRWVNKL2dja1EwRzY5TkFFSkVRTUNBdEIvLy8vQnlRNVFZVGJ0Z1VrT2tINzVva0NKRHRCQUNROFFmLy8vd2NrUFVHQTV2MEhKRDVCZ0lUUkJDUS9RUUFrUUVILy8vOEhKRUZCLy92cUFpUkNRWUNBL0Fja1EwSC9BU1JFREFjTFFaei8vd2NrT1VILzY5SUVKRHBCODZpT0F5UTdRYnIwQUNROFFjS0svd2NrUFVHQXJQOEhKRDVCZ1BUUUJDUS9RWUNBcUFJa1FFSC8vLzhISkVGQmhJbitCeVJDUWJyMDBBUWtRMEVBSkVRTUJndEJnUDZ2QXlRNVFmLy8vd2NrT2tIS3BQMEhKRHRCQUNROFFmLy8vd2NrUFVILy8vOEhKRDVCLzh1T0F5US9RZjhCSkVCQi8vLy9CeVJCUWVQYS9nY2tRa0dBNHBBRUpFTkJBQ1JFREFVTFFmKzVsZ1VrT1VHQS92OEhKRHBCZ01ZQkpEdEJBQ1E4UWRMRy9RY2tQVUdBZ05nR0pENUJnSUNNQXlRL1FRQWtRRUgvQVNSQlFmLy8vd2NrUWtINy92OEhKRU5CLzRrQ0pFUU1CQXRCenYvL0J5UTVRZS9mandNa09rR3hpUElFSkR0QjJyVHBBaVE4UWYvLy93Y2tQVUdBNXYwSEpENUJnSVRSQkNRL1FRQWtRRUgvLy84SEpFRkIvOHVPQXlSQ1FmOEJKRU5CQUNSRURBTUxRZi8vL3dja09VR0VpZjRISkRwQnV2VFFCQ1E3UVFBa1BFSC8vLzhISkQxQmdQNERKRDVCZ0lqR0FTUS9RWUNVQVNSQVFmLy8vd2NrUVVIL3k0NERKRUpCL3dFa1EwRUFKRVFNQWd0Qi8vLy9CeVE1UWYvTGpnTWtPa0gvQVNRN1FRQWtQRUdBL3Y4SEpEMUJnSUQ4QnlRK1FZQ0FqQU1rUDBFQUpFQkIvLy8vQnlSQlFiSCs3d01rUWtHQWlBSWtRMEVBSkVRTUFRdEIvLy8vQnlRNVFZVGJ0Z1VrT2tINzVva0NKRHRCQUNROFFmLy8vd2NrUFVIajJ2NEhKRDVCNDlyK0J5US9RUUFrUUVILy8vOEhKRUZCLzh1T0F5UkNRZjhCSkVOQkFDUkVDd3RLQVFKL1FRQVFCeU9EQWdSQUR3c2pnZ0lFUUNPREFrVUVRQThMQzBHMEFpRUFBMEFDUUNBQVFjTUNTZzBBSUFBUUFpQUJhaUVCSUFCQkFXb2hBQXdCQ3dzZ0FVSC9BWEVRQ0F2Y0FRQkJBQ1RtQVVFQUpPY0JRUUFrNkFGQkFDVHBBVUVBSk9vQlFRQWs2d0ZCQUNUc0FVR1FBU1RvQVNPREFnUkFRY0grQTBHQkFSQUVRY1QrQTBHUUFSQUVRY2YrQTBIOEFSQUVCVUhCL2dOQmhRRVFCRUhHL2dOQi93RVFCRUhIL2dOQi9BRVFCRUhJL2dOQi93RVFCRUhKL2dOQi93RVFCQXRCa0FFazZBRkJ3UDREUVpBQkVBUkJ6LzREUVFBUUJFSHcvZ05CQVJBRUk0SUNCRUFqZ3dJRVFFRUFKT2dCUWNEK0EwRUFFQVJCd2Y0RFFZQUJFQVJCeFA0RFFRQVFCQVZCQUNUb0FVSEEvZ05CQUJBRVFjSCtBMEdFQVJBRUN3c1FDUXR1QUNPREFnUkFRZWorQTBIQUFSQUVRZW4rQTBIL0FSQUVRZXIrQTBIQkFSQUVRZXYrQTBFTkVBUUZRZWorQTBIL0FSQUVRZW4rQTBIL0FSQUVRZXIrQTBIL0FSQUVRZXYrQTBIL0FSQUVDeU9EQWlPQ0FpT0NBaHNFUUVIcC9nTkJJQkFFUWV2K0EwR0tBUkFFQ3d0V0FFR1EvZ05CZ0FFUUJFR1IvZ05CdndFUUJFR1MvZ05COHdFUUJFR1QvZ05Cd1FFUUJFR1UvZ05CdndFUUJDT0NBZ1JBUVpIK0EwRS9FQVJCa3Y0RFFRQVFCRUdUL2dOQkFCQUVRWlQrQTBHNEFSQUVDd3NzQUVHVi9nTkIvd0VRQkVHVy9nTkJQeEFFUVpmK0EwRUFFQVJCbVA0RFFRQVFCRUdaL2dOQnVBRVFCQXN6QUVHYS9nTkIvd0FRQkVHYi9nTkIvd0VRQkVHYy9nTkJud0VRQkVHZC9nTkJBQkFFUVo3K0EwRzRBUkFFUVFFa2dRRUxMUUJCbi80RFFmOEJFQVJCb1A0RFFmOEJFQVJCb2Y0RFFRQVFCRUdpL2dOQkFCQUVRYVArQTBHL0FSQUVDMXdBSUFCQmdBRnhRUUJISktZQklBQkJ3QUJ4UVFCSEpLVUJJQUJCSUhGQkFFY2twQUVnQUVFUWNVRUFSeVNqQVNBQVFRaHhRUUJISktvQklBQkJCSEZCQUVja3FRRWdBRUVDY1VFQVJ5U29BU0FBUVFGeFFRQkhKS2NCQzBVQVFROGtrd0ZCRHlTVUFVRVBKSlVCUVE4a2xnRkJBQ1NYQVVFQUpKZ0JRUUFrbVFGQkFDU2FBVUgvQUNTYkFVSC9BQ1NjQVVFQkpKMEJRUUVrbmdGQkFDU2ZBUXU5QVFCQkFDU2dBVUVBSktFQlFRQWtvZ0ZCQVNTakFVRUJKS1FCUVFFa3BRRkJBU1NtQVVFQkpLY0JRUUVrcUFGQkFTU3BBVUVCSktvQlFRRWtxd0ZCQUNTc0FVRUFKSzBCUVFBa3J3RkJBQ1N3QVJBTUVBMFFEaEFQUWFUK0EwSDNBQkFFUVFja29RRkJCeVNpQVVHbC9nTkI4d0VRQkVIekFSQVFRYWIrQTBIeEFSQUVRUUVrcXdFamdnSUVRRUdrL2dOQkFCQUVRUUFrb1FGQkFDU2lBVUdsL2dOQkFCQUVRUUFRRUVHbS9nTkI4QUFRQkVFQUpLc0JDeEFSQ3o0QUlBQkJBWEZCQUVja3RRRWdBRUVDY1VFQVJ5UzJBU0FBUVFSeFFRQkhKTGNCSUFCQkNIRkJBRWNrdUFFZ0FFRVFjVUVBUnlTNUFTQUFKTFFCQ3o0QUlBQkJBWEZCQUVja3V3RWdBRUVDY1VFQVJ5UzhBU0FBUVFSeFFRQkhKTDBCSUFCQkNIRkJBRWNrdmdFZ0FFRVFjVUVBUnlTL0FTQUFKTG9CQzNnQVFRQWt3QUZCQUNUQkFVRUFKTUlCUVFBa3hRRkJBQ1RHQVVFQUpNY0JRUUFrd3dGQkFDVEVBU09EQWdSQVFZVCtBMEVlRUFSQm9EMGt3UUVGUVlUK0EwR3JBUkFFUWN6WEFpVEJBUXRCaC80RFFmZ0JFQVJCK0FFa3h3RWpnZ0lFUUNPREFrVUVRRUdFL2dOQkFCQUVRUVFrd1FFTEN3dERBRUVBSk1nQlFRQWt5UUVqZ3dJRVFFR0MvZ05CL0FBUUJFRUFKTW9CUVFBa3l3RkJBQ1RNQVFWQmd2NERRZjRBRUFSQkFDVEtBVUVCSk1zQlFRQWt6QUVMQzNVQUk0TUNCRUJCOFA0RFFmZ0JFQVJCei80RFFmNEJFQVJCemY0RFFmNEFFQVJCZ1A0RFFjOEJFQVJCai80RFFlRUJFQVJCN1A0RFFmNEJFQVJCOWY0RFFZOEJFQVFGUWZEK0EwSC9BUkFFUWMvK0EwSC9BUkFFUWMzK0EwSC9BUkFFUVlEK0EwSFBBUkFFUVkvK0EwSGhBUkFFQ3d1YUFRRUNmMEhEQWhBQ0lnRkJ3QUZHSWdBRWZ5QUFCU0FCUVlBQlJpTXdJZ0FnQUJzTEJFQkJBU1NEQWdWQkFDU0RBZ3RCQUNTZEFrR0FxTmE1QnlTVUFrRUFKSlVDUVFBa2xnSkJnS2pXdVFja2x3SkJBQ1NZQWtFQUpKa0NJeThFUUVFQkpJSUNCVUVBSklJQ0N4QURFQVVRQmhBS0VBc1FFa0VBRUJOQi8vOERJN1FCRUFSQjRRRVFGRUdQL2dNanVnRVFCQkFWRUJZUUZ3dEtBQ0FBUVFCS0pDOGdBVUVBU2lRd0lBSkJBRW9rTVNBRFFRQktKRElnQkVFQVNpUXpJQVZCQUVva05DQUdRUUJLSkRVZ0IwRUFTaVEySUFoQkFFb2tOeUFKUVFCS0pEZ1FHQXNGQUNPZEFndTVBUUJCZ0FnamhRSTZBQUJCZ1FnamhnSTZBQUJCZ2dnamh3STZBQUJCZ3dnamlBSTZBQUJCaEFnamlRSTZBQUJCaFFnamlnSTZBQUJCaGdnaml3STZBQUJCaHdnampBSTZBQUJCaUFnampRSTdBUUJCaWdnampnSTdBUUJCakFnamp3STJBZ0JCa1FnamtBSkJBRWM2QUFCQmtnZ2prUUpCQUVjNkFBQkJrd2dqa2dKQkFFYzZBQUJCbEFnamt3SkJBRWM2QUFCQmxRZ2pnZ0pCQUVjNkFBQkJsZ2dqZ3dKQkFFYzZBQUJCbHdnamhBSkJBRWM2QUFBTGFBQkJ5QWtqN1FFN0FRQkJ5Z2tqN2dFN0FRQkJ6QWtqN3dGQkFFYzZBQUJCelFrajhBRkJBRWM2QUFCQnpna2o4UUZCQUVjNkFBQkJ6d2tqOGdGQkFFYzZBQUJCMEFrajh3RkJBRWM2QUFCQjBRa2o5QUZCQUVjNkFBQkIwZ2tqOVFGQkFFYzZBQUFMTlFCQitna2p3QUUyQWdCQi9na2p3UUUyQWdCQmdnb2p3d0ZCQUVjNkFBQkJoUW9qeEFGQkFFYzZBQUJCaGY0REk4SUJFQVFMV0FCQjNnb2pWa0VBUnpvQUFFSGZDaU5aTmdJQVFlTUtJMW8yQWdCQjV3b2pXellDQUVIc0NpTmNOZ0lBUWZFS0kxMDZBQUJCOGdvalhqb0FBRUgzQ2lOZlFRQkhPZ0FBUWZnS0kyQTJBZ0JCL1FvallUc0JBQXM5QUVHUUN5TnJRUUJIT2dBQVFaRUxJMjQyQWdCQmxRc2piellDQUVHWkN5TndOZ0lBUVo0TEkzRTJBZ0JCb3dzamNqb0FBRUdrQ3lOek9nQUFDenNBUWZRTEk0c0JRUUJIT2dBQVFmVUxJNDBCTmdJQVFma0xJNDRCTmdJQVFmMExJNDhCTmdJQVFZSU1JNUFCTmdJQVFZY01JNUlCT3dFQUM0UUJBQkFiUWJJSUkrY0JOZ0lBUWJZSUk5d0JPZ0FBUWNUK0F5UG9BUkFFUWVRSUk3SUJRUUJIT2dBQVFlVUlJN01CUVFCSE9nQUFFQndRSFVHc0NpT3NBVFlDQUVHd0NpT3RBVG9BQUVHeENpT3ZBVG9BQUJBZUVCOUJ3Z3NqZWtFQVJ6b0FBRUhEQ3lOOU5nSUFRY2NMSTM0MkFnQkJ5d3NqZnpzQkFCQWdRUUFrblFJTHVRRUFRWUFJTFFBQUpJVUNRWUVJTFFBQUpJWUNRWUlJTFFBQUpJY0NRWU1JTFFBQUpJZ0NRWVFJTFFBQUpJa0NRWVVJTFFBQUpJb0NRWVlJTFFBQUpJc0NRWWNJTFFBQUpJd0NRWWdJTHdFQUpJMENRWW9JTHdFQUpJNENRWXdJS0FJQUpJOENRWkVJTFFBQVFRQktKSkFDUVpJSUxRQUFRUUJLSkpFQ1FaTUlMUUFBUVFCS0pKSUNRWlFJTFFBQVFRQktKSk1DUVpVSUxRQUFRUUJLSklJQ1FaWUlMUUFBUVFCS0pJTUNRWmNJTFFBQVFRQktKSVFDQzE0QkFYOUJBQ1RuQVVFQUpPZ0JRY1QrQTBFQUVBUkJ3ZjRERUFKQmZIRWhBVUVBSk53QlFjSCtBeUFCRUFRZ0FBUkFBa0JCQUNFQUEwQWdBRUdBMkFWT0RRRWdBRUdBeVFWcVFmOEJPZ0FBSUFCQkFXb2hBQXdBQUFzQUN3c0xpQUVCQVg4ajNnRWhBU0FBUVlBQmNVRUFSeVRlQVNBQVFjQUFjVUVBUnlUZkFTQUFRU0J4UVFCSEpPQUJJQUJCRUhGQkFFY2s0UUVnQUVFSWNVRUFSeVRpQVNBQVFRUnhRUUJISk9NQklBQkJBbkZCQUVjazVBRWdBRUVCY1VFQVJ5VGxBU1BlQVVVZ0FTQUJHd1JBUVFFUUl3c2dBVVVpQUFSL0k5NEJCU0FBQ3dSQVFRQVFJd3NMS2dCQjVBZ3RBQUJCQUVva3NnRkI1UWd0QUFCQkFFb2tzd0ZCLy84REVBSVFFMEdQL2dNUUFoQVVDMmdBUWNnSkx3RUFKTzBCUWNvSkx3RUFKTzRCUWN3SkxRQUFRUUJLSk84QlFjMEpMUUFBUVFCS0pQQUJRYzRKTFFBQVFRQktKUEVCUWM4SkxRQUFRUUJLSlBJQlFkQUpMUUFBUVFCS0pQTUJRZEVKTFFBQVFRQktKUFFCUWRJSkxRQUFRUUJLSlBVQkMwY0FRZm9KS0FJQUpNQUJRZjRKS0FJQUpNRUJRWUlLTFFBQVFRQktKTU1CUVlVS0xRQUFRUUJLSk1RQlFZWCtBeEFDSk1JQlFZYitBeEFDSk1VQlFZZitBeEFDSk1jQkN3Y0FRUUFrc0FFTFdBQkIzZ290QUFCQkFFb2tWa0hmQ2lnQ0FDUlpRZU1LS0FJQUpGcEI1d29vQWdBa1cwSHNDaWdDQUNSY1FmRUtMUUFBSkYxQjhnb3RBQUFrWGtIM0NpMEFBRUVBU2lSZlFmZ0tLQUlBSkdCQi9Rb3ZBUUFrWVFzOUFFR1FDeTBBQUVFQVNpUnJRWkVMS0FJQUpHNUJsUXNvQWdBa2IwR1pDeWdDQUNSd1FaNExLQUlBSkhGQm93c3RBQUFrY2tHa0N5MEFBQ1J6Q3pzQVFmUUxMUUFBUVFCS0pJc0JRZlVMS0FJQUpJMEJRZmtMS0FJQUpJNEJRZjBMS0FJQUpJOEJRWUlNS0FJQUpKQUJRWWNNTHdFQUpKSUJDOGtCQVFGL0VDSkJzZ2dvQWdBazV3RkJ0Z2d0QUFBazNBRkJ4UDRERUFJazZBRkJ3UDRERUFJUUpCQWxRWUQrQXhBQ1FmOEJjeVRWQVNQVkFTSUFRUkJ4UVFCSEpOWUJJQUJCSUhGQkFFY2sxd0VRSmhBblFhd0tLQUlBSkt3QlFiQUtMUUFBSkswQlFiRUtMUUFBSks4QlFRQWtzQUVRS1JBcVFjSUxMUUFBUVFCS0pIcEJ3d3NvQWdBa2ZVSEhDeWdDQUNSK1Fjc0xMd0VBSkg4UUswRUFKSjBDUVlDbzFya0hKSlFDUVFBa2xRSkJBQ1NXQWtHQXFOYTVCeVNYQWtFQUpKZ0NRUUFrbVFJTEJRQWpnd0lMQlFBamx3SUxCUUFqbUFJTEJRQWptUUlMeFFJQkJYOGpTU0VHQW44Q2Z5QUJRUUJLSWdVRVFDQUFRUWhLSVFVTElBVUxCRUFqU0NBRVJpRUZDeUFGQ3dSL0lBQWdCa1lGSUFVTEJFQWdBMEVCYXhBQ1FTQnhRUUJISVFVZ0F4QUNRU0J4UVFCSElRaEJBQ0VEQTBBZ0EwRUlTQVJBUVFjZ0Eyc2dBeUFGSUFoSEd5SURJQUJxSWdSQm9BRk1CRUFnQVVHZ0FXd2dCR3BCQTJ4QmdNa0ZhaUlISUFjdEFBQTZBQUFnQVVHZ0FXd2dCR3BCQTJ4Qmdja0ZhaUFITFFBQk9nQUFJQUZCb0FGc0lBUnFRUU5zUVlMSkJXb2dCeTBBQWpvQUFDQUJRYUFCYkNBRWFrR0FrUVJxSUFCQkFDQURhMnNnQVVHZ0FXeHFRZmlRQkdvdEFBQWlCRUVEY1NJSFFRUnlJQWNnQkVFRWNSczZBQUFnQ1VFQmFpRUpDeUFEUVFGcUlRTU1BUXNMQlNBRUpFZ0xJQUFnQms0RVFDQUFRUWhxSVFZZ0FDQUNRUWR4SWdoSUJFQWdCaUFJYWlFR0N3c2dCaVJKSUFrTEtRQWdBRUdBa0FKR0JFQWdBVUdBQVdzZ0FVR0FBV29nQVVHQUFYRWJJUUVMSUFGQkJIUWdBR29MU2dBZ0FFRURkQ0FCUVFGMGFpSUFRUUZxUVQ5eElnRkJRR3NnQVNBQ0cwR0FrQVJxTFFBQUlRRWdBRUUvY1NJQVFVQnJJQUFnQWh0QmdKQUVhaTBBQUNBQlFmOEJjVUVJZEhJTHVRRUFJQUVRQWlBQVFRRjBkVUVEY1NFQUlBRkJ5UDREUmdSQUl6MGhBUUpBSUFCRkRRQUNRQUpBQWtBZ0FFRUJhdzREQUFFQ0F3c2pQaUVCREFJTEl6OGhBUXdCQ3lOQUlRRUxCU0FCUWNuK0EwWUVRQ05CSVFFQ1FDQUFSUTBBQWtBQ1FBSkFJQUJCQVdzT0F3QUJBZ01MSTBJaEFRd0NDeU5ESVFFTUFRc2pSQ0VCQ3dVak9TRUJBa0FnQUVVTkFBSkFBa0FDUUNBQVFRRnJEZ01BQVFJREN5TTZJUUVNQWdzak95RUJEQUVMSXp3aEFRc0xDeUFCQzZJREFRWi9JQUVnQUJBeUlBVkJBWFJxSWdCQmdKQithaUFDUVFGeFFRMTBJZ0ZxTFFBQUlSRWdBRUdCa0g1cUlBRnFMUUFBSVJJZ0F5RUFBMEFnQUNBRVRBUkFJQUFnQTJzZ0Jtb2lEaUFJU0FSQVFRY2dBR3NoQlNBTFFRQklJZ0lFZnlBQ0JTQUxRU0J4UlFzaEFVRUFJUUlDZjBFQklBVWdBQ0FCR3lJQmRDQVNjUVJBUVFJaEFnc2dBa0VCYWdzZ0FrRUJJQUYwSUJGeEd5RUNJNE1DQkg4Z0MwRUFUaUlCQkg4Z0FRVWdERUVBVGdzRkk0TUNDd1IvSUF0QkIzRWhCU0FNUVFCT0lnRUVRQ0FNUVFkeElRVUxJQVVnQWlBQkVETWlCVUVmY1VFRGRDRVBJQVZCNEFkeFFRVjFRUU4wSVFFZ0JVR0ErQUZ4UVFwMVFRTjBCU0FDUWNmK0F5QUtJQXBCQUV3Yklnb1FOQ0lGUVlDQS9BZHhRUkIxSVE4Z0JVR0EvZ054UVFoMUlRRWdCVUgvQVhFTElRVWdCeUFJYkNBT2FrRURiQ0FKYWlJUUlBODZBQUFnRUVFQmFpQUJPZ0FBSUJCQkFtb2dCVG9BQUNBSFFhQUJiQ0FPYWtHQWtRUnFJQUpCQTNFaUFVRUVjaUFCSUF0QmdBRnhRUUJIUVFBZ0MwRUFUaHNiT2dBQUlBMUJBV29oRFFzZ0FFRUJhaUVBREFFTEN5QU5DMzRCQTM4Z0EwRUhjU0VEUVFBZ0FpQUNRUU4xUVFOMGF5QUFHeUVIUWFBQklBQnJRUWNnQUVFSWFrR2dBVW9iSVFoQmZ5RUNJNE1DQkVBZ0JFR0EwSDVxTFFBQUlnSkJDSEZCQUVjaENTQUNRY0FBY1FSQVFRY2dBMnNoQXdzTElBWWdCU0FKSUFjZ0NDQURJQUFnQVVHZ0FVR0F5UVZCQUNBQ1FYOFFOUXVsQWdFQmZ5QURRUWR4SVFNZ0JTQUdFRElnQkVHQTBINXFMUUFBSWdSQndBQnhCSDlCQnlBRGF3VWdBd3RCQVhScUlnTkJnSkIrYWlBRVFRaHhRUUJISWdWQkRYUnFMUUFBSVFZZ0EwR0JrSDVxSUFWQkFYRkJEWFJxTFFBQUlRVWdBa0VIY1NFRFFRQWhBaUFCUWFBQmJDQUFha0VEYkVHQXlRVnFJQVJCQjNFQ2YwRUJJQU5CQnlBRGF5QUVRU0J4R3lJRGRDQUZjUVJBUVFJaEFnc2dBa0VCYWdzZ0FrRUJJQU4wSUFaeEd5SUNRUUFRTXlJRFFSOXhRUU4wT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUhKQldvZ0EwSGdCM0ZCQlhWQkEzUTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdza0ZhaUFEUVlENEFYRkJDblZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJnSkVFYWlBQ1FRTnhJZ2RCQkhJZ0J5QUVRWUFCY1JzNkFBQUx4QUVBSUFRZ0JSQXlJQU5CQjNGQkFYUnFJZ1JCZ0pCK2FpMEFBQ0VGUVFBaEF5QUJRYUFCYkNBQWFrRURiRUdBeVFWcUFuOGdCRUdCa0g1cUxRQUFRUUZCQnlBQ1FRZHhheUlDZEhFRVFFRUNJUU1MSUFOQkFXb0xJQU5CQVNBQ2RDQUZjUnNpQTBISC9nTVFOQ0lDUVlDQS9BZHhRUkIxT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUhKQldvZ0FrR0EvZ054UVFoMU9nQUFJQUZCb0FGc0lBQnFRUU5zUVlMSkJXb2dBam9BQUNBQlFhQUJiQ0FBYWtHQWtRUnFJQU5CQTNFNkFBQUwxZ0VCQm44Z0EwRURkU0VMQTBBZ0JFR2dBVWdFUUNBRUlBVnFJZ1pCZ0FKT0JFQWdCa0dBQW1zaEJnc2dDMEVGZENBQ2FpQUdRUU4xYWlJSlFZQ1FmbW90QUFBaENFRUFJUW9qTndSQUlBUWdBQ0FHSUFrZ0NCQXhJZ2RCQUVvRVFFRUJJUW9nQjBFQmF5QUVhaUVFQ3dzZ0NrVWpOaUlISUFjYkJFQWdCQ0FBSUFZZ0F5QUpJQUVnQ0JBMklnZEJBRW9FUUNBSFFRRnJJQVJxSVFRTEJTQUtSUVJBSTRNQ0JFQWdCQ0FBSUFZZ0F5QUpJQUVnQ0JBM0JTQUVJQUFnQmlBRElBRWdDQkE0Q3dzTElBUkJBV29oQkF3QkN3c0xNZ0VEZnlQckFTRURJQUFqN0FFaUJFZ0VRQThMUVFBZ0EwRUhheUlEYXlFRklBQWdBU0FDSUFBZ0JHc2dBeUFGRURrTHZRVUJEMzhDUUVFbklRa0RRQ0FKUVFCSURRRWdDVUVDZENJSFFZRDhBMm9pQXhBQ0lRSWdBMEVCYWhBQ0lRb2dBMEVDYWhBQ0lRTWdBa0VRYXlFQ0lBcEJDR3NoQ2tFSUlRUWdBUVJBUVJBaEJDQURJQU5CQVhGcklRTUxJQUFnQWs0aUJRUkFJQUFnQWlBRWFrZ2hCUXNnQlFSQUlBZEJnL3dEYWhBQ0lnVkJnQUZ4UVFCSElRc2dCVUVnY1VFQVJ5RU9RWUNBQWlBREVESWdCQ0FBSUFKcklnSnJRUUZySUFJZ0JVSEFBSEViUVFGMGFpSURRWUNRZm1vZ0JVRUljVUVBUnlPREFpSUNJQUliUVFGeFFRMTBJZ0pxTFFBQUlROGdBMEdCa0g1cUlBSnFMUUFBSVJCQkJ5RUhBMEFnQjBFQVRnUkFRUUFoQ0FKL1FRRkJBQ0FISWdKQkIydHJJQUlnRGhzaUFuUWdFSEVFUUVFQ0lRZ0xJQWhCQVdvTElBaEJBU0FDZENBUGNSc2lDQVJBUVFjZ0Iyc2dDbW9pQmtFQVRpSUNCRUFnQmtHZ0FVd2hBZ3NnQWdSQVFRQWhERUVBSVEwajVRRkZJNE1DSWdJZ0Foc2lBa1VFUUNBQVFhQUJiQ0FHYWtHQWtRUnFMUUFBSWdOQkEzRWlCRUVBU3lBTElBc2JCRUJCQVNFTUJTQURRUVJ4UVFCSEk0TUNJZ01nQXhzaUF3UkFJQVJCQUVzaEF3dEJBVUVBSUFNYklRMExDeUFDUlFSQUlBeEZJZ1FFZnlBTlJRVWdCQXNoQWdzZ0FnUkFJNE1DQkVBZ0FFR2dBV3dnQm1wQkEyeEJnTWtGYWlBRlFRZHhJQWhCQVJBeklnUkJIM0ZCQTNRNkFBQWdBRUdnQVd3Z0JtcEJBMnhCZ2NrRmFpQUVRZUFIY1VFRmRVRURkRG9BQUNBQVFhQUJiQ0FHYWtFRGJFR0N5UVZxSUFSQmdQZ0JjVUVLZFVFRGREb0FBQVVnQUVHZ0FXd2dCbXBCQTJ4QmdNa0ZhaUFJUWNuK0EwSEkvZ01nQlVFUWNSc1FOQ0lEUVlDQS9BZHhRUkIxT2dBQUlBQkJvQUZzSUFacVFRTnNRWUhKQldvZ0EwR0EvZ054UVFoMU9nQUFJQUJCb0FGc0lBWnFRUU5zUVlMSkJXb2dBem9BQUFzTEN3c2dCMEVCYXlFSERBRUxDd3NnQ1VFQmF5RUpEQUFBQ3dBTEMyWUJBbjlCZ0lBQ1FZQ1FBaVBoQVJzaEFTT0RBaUlDSStVQklBSWJCRUFnQUNBQlFZQzRBa0dBc0FJajRnRWJJK29CSUFCcVFmOEJjVUVBSStrQkVEa0xJK0FCQkVBZ0FDQUJRWUM0QWtHQXNBSWozd0ViRURvTEkrUUJCRUFnQUNQakFSQTdDd3NsQVFGL0FrQURRQ0FBUVpBQlNnMEJJQUJCL3dGeEVEd2dBRUVCYWlFQURBQUFDd0FMQzBZQkFuOERRQ0FCUVpBQlRrVUVRRUVBSVFBRFFDQUFRYUFCU0FSQUlBRkJvQUZzSUFCcVFZQ1JCR3BCQURvQUFDQUFRUUZxSVFBTUFRc0xJQUZCQVdvaEFRd0JDd3NMSFFFQmYwR1AvZ01RQWtFQklBQjBjaUlCSkxvQlFZLytBeUFCRUFRTEN3QkJBU1M4QVVFQkVEOExMQUVDZnlOYklnQkJBRW9pQVFSQUkxUWhBUXNnQUVFQmF5QUFJQUViSWdCRkJFQkJBQ1JXQ3lBQUpGc0xMQUVDZnlOd0lnQkJBRW9pQVFSQUkya2hBUXNnQUVFQmF5QUFJQUViSWdCRkJFQkJBQ1JyQ3lBQUpIQUxMQUVDZnlOK0lnQkJBRW9pQVFSQUkzZ2hBUXNnQUVFQmF5QUFJQUViSWdCRkJFQkJBQ1I2Q3lBQUpINExNQUVDZnlPUEFTSUFRUUJLSWdFRVFDT0tBU0VCQ3lBQVFRRnJJQUFnQVJzaUFFVUVRRUVBSklzQkN5QUFKSThCQzBBQkFuOUJsUDRERUFKQitBRnhJUUZCay80RElBQkIvd0Z4SWdJUUJFR1UvZ01nQVNBQVFRaDFJZ0J5RUFRZ0FpUlRJQUFrVlNOVEkxVkJDSFJ5SkZnTFhRRUNmeU5oSWdFalRYVWhBQ0FCSUFCcklBQWdBV29qVEJzaUFFSC9EMHdpQVFSL0kwMUJBRW9GSUFFTEJFQWdBQ1JoSUFBUVJTTmhJZ0VqVFhVaEFDQUJJQUJySUFBZ0FXb2pUQnNoQUFzZ0FFSC9EMG9FUUVFQUpGWUxDeWtCQVg4allFRUJheUlBUVFCTUJFQWpTeVJnSTB0QkFFb2pYeU5mR3dSQUVFWUxCU0FBSkdBTEMwNEJBMzhqV2tFQmF5SUJRUUJNQkVBalVpSUJCRUFqWENFQUlBQkJEMGdqVVNOUkd3Ui9JQUJCQVdvRkkxRkZJZ0lFUUNBQVFRQktJUUlMSUFCQkFXc2dBQ0FDR3dza1hBc0xJQUVrV2d0T0FRTi9JMjlCQVdzaUFVRUFUQVJBSTJjaUFRUkFJM0VoQUNBQVFROUlJMllqWmhzRWZ5QUFRUUZxQlNObVJTSUNCRUFnQUVFQVNpRUNDeUFBUVFGcklBQWdBaHNMSkhFTEN5QUJKRzhMVmdFRGZ5T09BVUVCYXlJQlFRQk1CRUFqaGdFaUFRUkFJNUFCSVFBZ0FFRVBTQ09GQVNPRkFSc0VmeUFBUVFGcUJTT0ZBVVVpQWdSQUlBQkJBRW9oQWdzZ0FFRUJheUFBSUFJYkN5U1FBUXNMSUFFa2pnRUxuUUVCQW45QmdNQUFJNFFDZENJQklRSWpyQUVnQUdvaUFDQUJUZ1JBSUFBZ0Ftc2tyQUVDUUFKQUFrQUNRQUpBSTY4QklnQUVRQ0FBUVFKR0RRRUNRQ0FBUVFSckRnUURBQVFGQUFzTUJRc1FRUkJDRUVNUVJBd0VDeEJCRUVJUVF4QkVFRWNNQXdzUVFSQkNFRU1RUkF3Q0N4QkJFRUlRUXhCRUVFY01BUXNRU0JCSkVFb0xJQUJCQVdwQkIzRWtyd0ZCQVE4RklBQWtyQUVMUVFBTGJnRUJmd0pBQWtBQ1FBSkFJQUJCQVVjRVFDQUFRUUpyRGdNQkFnTUVDeU5YSWdBamx3RkhJUUVnQUNTWEFTQUJEd3NqYkNJQkk1Z0JSeUVBSUFFa21BRWdBQThMSTNzaUFDT1pBVWNoQVNBQUpKa0JJQUVQQ3lPTUFTSUJJNW9CUnlFQUlBRWttZ0VnQUE4TFFRQUxWUUFDUUFKQUFrQWdBRUVCUndSQUlBQkJBa1lOQVNBQVFRTkdEUUlNQXd0QkFTQUJkRUdCQVhGQkFFY1BDMEVCSUFGMFFZY0JjVUVBUnc4TFFRRWdBWFJCL2dCeFFRQkhEd3RCQVNBQmRFRUJjVUVBUnd0d0FRRi9JMWtnQUdzaUFVRUFUQVJBSUFFa1dVR0FFQ05ZYTBFQ2RDSUFRUUowSUFBamhBSWJKRmtqV1NBQlFSOTFJZ0FnQUNBQmFuTnJKRmtqWGtFQmFrRUhjU1JlQlNBQkpGa0xJMWNqVmlJQUlBQWJCSDhqWEFWQkR3OExJMDRqWGhCTkJIOUJBUVZCZnd0c1FROXFDMlFCQVg4amJpQUFheUlCSkc0Z0FVRUFUQVJBUVlBUUkyMXJRUUowSTRRQ2RDUnVJMjRnQVVFZmRTSUFJQUFnQVdwemF5UnVJM05CQVdwQkIzRWtjd3NqYkNOcklnQWdBQnNFZnlOeEJVRVBEd3NqWXlOekVFMEVmMEVCQlVGL0MyeEJEMm9MOGdFQkFuOGpmU0FBYXlJQlFRQk1CRUFnQVNSOVFZQVFJM3hyUVFGMEk0UUNkQ1I5STMwZ0FVRWZkU0lBSUFBZ0FXcHpheVI5STM5QkFXcEJIM0VrZndVZ0FTUjlDeU9BQVNFQkkzc2plaUlBSUFBYkJFQWpnUUVFUUVHYy9nTVFBa0VGZFVFUGNTSUJKSUFCUVFBa2dRRUxCVUVQRHdzamZ5SUNRUUYxUWJEK0Eyb1FBaUFDUVFGeFJVRUNkSFZCRDNFaEFFRUFJUUlDUUFKQUFrQUNRQ0FCQkVBZ0FVRUJSZzBCSUFGQkFrWU5BZ3dEQ3lBQVFRUjFJUUFNQXd0QkFTRUNEQUlMSUFCQkFYVWhBRUVDSVFJTUFRc2dBRUVDZFNFQVFRUWhBZ3NnQWtFQVNnUi9JQUFnQW0wRlFRQUxRUTlxQzRZQkFRSi9JNDBCSUFCcklnRkJBRXdFUUNPUkFTT0hBWFFqaEFKMElBRkJIM1VpQUNBQUlBRnFjMnNoQVNPU0FTSUFRUUYxSWdJZ0FFRUJjU0FDUVFGeGN5SUNRUTUwY2lJQVFiOS9jU0FDUVFaMGNpQUFJNGdCR3lTU0FRc2dBU1NOQVNPTUFTT0xBU0lBSUFBYkJIOGprQUVGUVE4UEMwRi9RUUVqa2dGQkFYRWJiRUVQYWdzd0FDQUFRVHhHQkVCQi93QVBDeUFBUVR4clFhQ05CbXdnQVd4QkEzVkJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMExrd0VCQVg5QkFDU2RBU0FBUVE4am93RWJJQUZCRHlPa0FSdHFJQUpCRHlPbEFSdHFJQU5CRHlPbUFSdHFJUVFnQUVFUEk2Y0JHeUFCUVE4anFBRWJhaUFDUVE4anFRRWJhaUVCSUFOQkR5T3FBUnNoQTBFQUpKNEJRUUFrbndFZ0JDT2hBVUVCYWhCU0lRQWdBU0FEYWlPaUFVRUJhaEJTSVFFZ0FDU2JBU0FCSkp3QklBRkIvd0Z4SUFCQi93RnhRUWgwY2d1ZEF3RUZmeU5LSUFCcUlnRWtTaU5aSUFGclFRQk1JZ0ZGQkVCQkFSQk1JUUVMSTJJZ0FHb2lCQ1JpSTI0Z0JHdEJBRXdpQkVVRVFFRUNFRXdoQkFzamRDQUFhaVIwSTRFQlJTSUNCRUFqZlNOMGEwRUFTaUVDQ3lBQ1JTSUNSUVJBUVFNUVRDRUNDeU9DQVNBQWFpU0NBU09OQVNPQ0FXdEJBRXdpQlVVRVFFRUVFRXdoQlFzZ0FRUkFJMG9oQTBFQUpFb2dBeEJPSkpNQkN5QUVCRUFqWWlFRFFRQWtZaUFERUU4a2xBRUxJQUlFUUNOMElRTkJBQ1IwSUFNUVVDU1ZBUXNnQlFSQUk0SUJJUU5CQUNTQ0FTQURFRkVrbGdFTEFuOGdBU0FFSUFFYklnRkZCRUFnQWlFQkN5QUJSUXNFUUNBRklRRUxJQUVFUUVFQkpKOEJDeU90QVNPdUFTQUFiR29pQVVHQWdJQUNJNFFDZENJQVRnUkFJQUVnQUdzaEFTT2ZBU0lBSTUwQklBQWJJZ0JGQkVBam5nRWhBQXNnQUFSQUk1TUJJNVFCSTVVQkk1WUJFRk1hQlNBQkpLMEJDeU93QVNJQ1FRRjBRWUNad1FCcUlnQWptd0ZCQW1vNkFBQWdBRUVCYWlPY0FVRUNham9BQUNBQ1FRRnFJZ0Fqc1FGQkFYVkJBV3RPQkg4Z0FFRUJhd1VnQUFza3NBRUxJQUVrclFFTHBBTUJCbjhnQUJCT0lRRWdBQkJQSVFJZ0FCQlFJUU1nQUJCUklRUWdBU1NUQVNBQ0pKUUJJQU1rbFFFZ0JDU1dBU090QVNPdUFTQUFiR29pQlVHQWdJQUNJNFFDZEU0RVFDQUZRWUNBZ0FJamhBSjBheUVGSUFFZ0FpQURJQVFRVXlFQUk3QUJRUUYwUVlDWndRQnFJZ1lnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQVpCQVdvZ0FFSC9BWEZCQW1vNkFBQWpPQVJBSUFGQkQwRVBRUThRVXlFQUk3QUJRUUYwUVlDWklXb2lBU0FBUVlEK0EzRkJDSFZCQW1vNkFBQWdBVUVCYWlBQVFmOEJjVUVDYWpvQUFFRVBJQUpCRDBFUEVGTWhBQ093QVVFQmRFR0FtU2xxSWdJZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBRUgvQVhGQkFtbzZBQUJCRDBFUElBTkJEeEJUSVFBanNBRkJBWFJCZ0preGFpSURJQUJCZ1A0RGNVRUlkVUVDYWpvQUFDQURRUUZxSUFCQi93RnhRUUpxT2dBQVFROUJEMEVQSUFRUVV5RUFJN0FCUVFGMFFZQ1pPV29pQkNBQVFZRCtBM0ZCQ0hWQkFtbzZBQUFnQkVFQmFpQUFRZjhCY1VFQ2Fqb0FBQXNqc0FGQkFXb2lBQ094QVVFQmRVRUJhMDRFZnlBQVFRRnJCU0FBQ3lTd0FRc2dCU1N0QVFzZUFRRi9JQUFRU3lFQklBRkZJelVqTlJzRVFDQUFFRlFGSUFBUVZRc0xMd0VDZjBIWEFDT0VBblFoQVNPZ0FTRUFBMEFnQUNBQlRnUkFJQUVRVmlBQUlBRnJJUUFNQVFzTElBQWtvQUVMSVFBZ0FFR20vZ05HQkVCQnB2NERFQUpCZ0FGeElRQWdBRUh3QUhJUEMwRi9DNXdCQVFGL0k5VUJJUUFqMWdFRVFDQUFRWHR4SUFCQkJISWp6UUViSVFBZ0FFRitjU0FBUVFGeUk5QUJHeUVBSUFCQmQzRWdBRUVJY2lQT0FSc2hBQ0FBUVgxeElBQkJBbklqendFYklRQUZJOWNCQkVBZ0FFRitjU0FBUVFGeUk5RUJHeUVBSUFCQmZYRWdBRUVDY2lQU0FSc2hBQ0FBUVh0eElBQkJCSElqMHdFYklRQWdBRUYzY1NBQVFRaHlJOVFCR3lFQUN3c2dBRUh3QVhJTHp3SUJBWDhnQUVHQWdBSklCRUJCZnc4TElBQkJnSUFDVGlJQkJIOGdBRUdBd0FKSUJTQUJDd1JBUVg4UEN5QUFRWURBQTA0aUFRUi9JQUJCZ1B3RFNBVWdBUXNFUUNBQVFZQkFhaEFDRHdzZ0FFR0EvQU5PSWdFRWZ5QUFRWi85QTB3RklBRUxCRUJCL3dGQmZ5UGNBVUVDU0JzUEN5QUFRYzMrQTBZRVFFSC9BU0VCUWMzK0F4QUNRUUZ4UlFSQVFmNEJJUUVMSTRRQ1JRUkFJQUZCLzM1eElRRUxJQUVQQ3lBQVFjVCtBMFlFUUNBQUkrZ0JFQVFqNkFFUEN5QUFRWkQrQTA0aUFRUi9JQUJCcHY0RFRBVWdBUXNFUUJCWElBQVFXQThMSUFCQnNQNERUaUlCQkg4Z0FFRy8vZ05NQlNBQkN3UkFFRmRCZnc4TElBQkJoUDREUmdSQUlBQWp3UUZCZ1A0RGNVRUlkU0lCRUFRZ0FROExJQUJCaGY0RFJnUkFJQUFqd2dFUUJDUENBUThMSUFCQmovNERSZ1JBSTdvQlFlQUJjZzhMSUFCQmdQNERSZ1JBRUZrUEMwRi9DeWtCQVg4ajJRRWdBRVlFUUVFQkpOc0JDeUFBRUZvaUFVRi9SZ1IvSUFBUUFnVWdBVUgvQVhFTEM3TUNBUVIvSS9FQkJFQVBDeVB5QVNFRkkvTUJJUU1nQUVIL1Awd0VRQ0FEQkg4Z0FVRVFjVVVGSUFNTFJRUkFJQUZCRDNFaUJBUkFJQVJCQ2tZRVFFRUJKTzhCQ3dWQkFDVHZBUXNMQlNBQVFmLy9BRXdFUUNQMUFTSUVSU0lDQkg4Z0FnVWdBRUgvM3dCTUN3UkFJQUZCRDNFajdRRWdBeHNoQWlBRkJIOGdBVUVmY1NFQklBSkI0QUZ4QlNQMEFRUi9JQUZCL3dCeElRRWdBa0dBQVhFRlFRQWdBaUFFR3dzTElRQWdBQ0FCY2lUdEFRVWo3UUZCL3dGeElBRkJBRXBCQ0hSeUpPMEJDd1VnQTBVaUJBUi9JQUJCLzc4QlRBVWdCQXNFUUNQd0FTQUZJQVViQkVBajdRRkJIM0VnQVVIZ0FYRnlKTzBCRHdzZ0FVRVBjU0FCUVFOeEkvVUJHeVR1QVFVZ0EwVWlBZ1IvSUFCQi8vOEJUQVVnQWdzRVFDQUZCRUFnQVVFQmNVRUFSeVR3QVFzTEN3c0xDeWdBSUFCQkJIVkJEM0VrVUNBQVFRaHhRUUJISkZFZ0FFRUhjU1JTSUFCQitBRnhRUUJLSkZjTEtBQWdBRUVFZFVFUGNTUmxJQUJCQ0hGQkFFY2taaUFBUVFkeEpHY2dBRUg0QVhGQkFFb2tiQXNzQUNBQVFRUjFRUTl4SklRQklBQkJDSEZCQUVja2hRRWdBRUVIY1NTR0FTQUFRZmdCY1VFQVNpU01BUXM0QUNBQVFRUjFKSWNCSUFCQkNIRkJBRWNraUFFZ0FFRUhjU0lBSklrQklBQkJBWFFpQUVFQlNBUkFRUUVoQUFzZ0FFRURkQ1NSQVF0akFRRi9RUUVrVmlOYlJRUkFRY0FBSkZzTFFZQVFJMWhyUVFKMElnQkJBblFnQUNPRUFoc2tXU05TSkZvalVDUmNJMWdrWVNOTElnQWtZQ0FBUVFCS0lnQUVmeU5OUVFCS0JTQUFDeVJmSTAxQkFFb0VRQkJHQ3lOWFJRUkFRUUFrVmdzTE1nQkJBU1JySTNCRkJFQkJ3QUFrY0F0QmdCQWpiV3RCQW5RamhBSjBKRzRqWnlSdkkyVWtjU05zUlFSQVFRQWthd3NMTGdCQkFTUjZJMzVGQkVCQmdBSWtmZ3RCZ0JBamZHdEJBWFFqaEFKMEpIMUJBQ1IvSTN0RkJFQkJBQ1I2Q3d0QkFFRUJKSXNCSTQ4QlJRUkFRY0FBSkk4QkN5T1JBU09IQVhRamhBSjBKSTBCSTRZQkpJNEJJNFFCSkpBQlFmLy9BU1NTQVNPTUFVVUVRRUVBSklzQkN3dnFCQUVCZnlBQVFhYitBMGNpQWdSQUk2c0JSU0VDQ3lBQ0JFQkJBQThMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQ1FaRCtBMGNFUUNBQ1FaSCtBMnNPRmdJR0NnNFZBd2NMRHdFRUNBd1FGUVVKRFJFU0V4UVZDeUFCUWZBQWNVRUVkU1JMSUFGQkNIRkJBRWNrVENBQlFRZHhKRTBNRlFzZ0FVR0FBWEZCQUVja2V3d1VDeUFCUVFaMVFRTnhKRTRnQVVFL2NTUlBRY0FBSTA5ckpGc01Fd3NnQVVFR2RVRURjU1JqSUFGQlAzRWtaRUhBQUNOa2F5UndEQklMSUFFa2RVR0FBaU4xYXlSK0RCRUxJQUZCUDNFa2d3RkJ3QUFqZ3dGckpJOEJEQkFMSUFFUVhRd1BDeUFCRUY0TURndEJBU1NCQVNBQlFRVjFRUTl4SkhZTURRc2dBUkJmREF3TElBRWtVeU5WUVFoMElBRnlKRmdNQ3dzZ0FTUm9JMnBCQ0hRZ0FYSWtiUXdLQ3lBQkpIY2plVUVJZENBQmNpUjhEQWtMSUFFUVlBd0lDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKRlFnQVVFSGNTSUFKRlVqVXlBQVFRaDBjaVJZRUdFTERBY0xJQUZCZ0FGeEJFQWdBVUhBQUhGQkFFY2thU0FCUVFkeElnQWthaU5vSUFCQkNIUnlKRzBRWWdzTUJnc2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5UjRJQUZCQjNFaUFDUjVJM2NnQUVFSWRISWtmQkJqQ3d3RkN5QUJRWUFCY1FSQUlBRkJ3QUJ4UVFCSEpJb0JFR1FMREFRTElBRkJCSFZCQjNFa29RRWdBVUVIY1NTaUFVRUJKSjBCREFNTElBRVFFRUVCSko0QkRBSUxJQUZCZ0FGeFFRQkhKS3NCSUFGQmdBRnhSUVJBQWtCQmtQNERJUUlEUUNBQ1FhYitBMDROQVNBQ1FRQVFCQ0FDUVFGcUlRSU1BQUFMQUFzTERBRUxRUUVQQzBFQkN6d0JBWDhnQUVFSWRDRUJRUUFoQUFOQUFrQWdBRUdmQVVvTkFDQUFRWUQ4QTJvZ0FDQUJhaEFDRUFRZ0FFRUJhaUVBREFFTEMwR0VCU1Q3QVFzakFRRi9JL1lCRUFJaEFDUDNBUkFDUWY4QmNTQUFRZjhCY1VFSWRISkI4UDhEY1FzbkFRRi9JL2dCRUFJaEFDUDVBUkFDUWY4QmNTQUFRZjhCY1VFSWRISkI4RDl4UVlDQUFtb0xoQUVCQTM4amd3SkZCRUFQQ3lBQVFZQUJjVVVqL0FFai9BRWJCRUJCQUNUOEFTUDZBUkFDUVlBQmNpRUFJL29CSUFBUUJBOExFR2NoQVJCb0lRSWdBRUgvZm5GQkFXcEJCSFFoQXlBQVFZQUJjUVJBUVFFay9BRWdBeVQ5QVNBQkpQNEJJQUlrL3dFaitnRWdBRUgvZm5FUUJBVWdBU0FDSUFNUWN5UDZBVUgvQVJBRUN3dGVBUVIvSTBjaEF5TkdJQUJHSWdKRkJFQWdBQ0FEUmlFQ0N5QUNCRUFnQUVFQmF5SUVFQUpCdjM5eElnSkJQM0VpQlVGQWF5QUZJQUFnQTBZYlFZQ1FCR29nQVRvQUFDQUNRWUFCY1FSQUlBUWdBa0VCYWtHQUFYSVFCQXNMQ3p3QkFYOENRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVnQVVFQ1JnMENJQUZCQTBZTkF3d0VDMEVKRHd0QkF3OExRUVVQQzBFSER3dEJBQXNsQVFGL1FRRWp4d0VRYXlJQ2RDQUFjVUVBUnlJQUJIOUJBU0FDZENBQmNVVUZJQUFMQzRVQkFRUi9BMEFnQWlBQVNBUkFJQUpCQkdvaEFpUEJBU0lCUVFScVFmLy9BM0VpQXlUQkFTUEdBUVJBSThRQklRUWp3d0VFUUNQRkFTVENBVUVCSkwwQlFRSVFQMEVBSk1NQlFRRWt4QUVGSUFRRVFFRUFKTVFCQ3dzZ0FTQURFR3dFUUNQQ0FVRUJhaUlCUWY4QlNnUkFRUUVrd3dGQkFDRUJDeUFCSk1JQkN3c01BUXNMQ3d3QUk4QUJFRzFCQUNUQUFRdEdBUUYvSThFQklRQkJBQ1RCQVVHRS9nTkJBQkFFSThZQkJIOGdBRUVBRUd3Rkk4WUJDd1JBSThJQlFRRnFJZ0JCL3dGS0JFQkJBU1REQVVFQUlRQUxJQUFrd2dFTEM0SUJBUU4vSThZQklRRWdBRUVFY1VFQVJ5VEdBU0FBUVFOeElRSWdBVVVFUUNQSEFSQnJJUUFnQWhCcklRTWp3UUVoQVNQR0FRUi9RUUVnQUhRZ0FYRUZRUUVnQUhRZ0FYRkJBRWNpQUFSL1FRRWdBM1FnQVhFRklBQUxDd1JBSThJQlFRRnFJZ0JCL3dGS0JFQkJBU1REQVVFQUlRQUxJQUFrd2dFTEN5QUNKTWNCQy9FR0FRSi9Ba0FDUUNBQVFjMytBMFlFUUVITi9nTWdBVUVCY1JBRURBRUxJQUJCMFA0RFJpT0NBaUlDSUFJYkJFQkJBQ1NDQWtIL0FTU09BZ3dDQ3lBQVFZQ0FBa2dFUUNBQUlBRVFYQXdCQ3lBQVFZQ0FBazRpQWdSQUlBQkJnTUFDU0NFQ0N5QUNEUUVnQUVHQXdBTk9JZ0lFUUNBQVFZRDhBMGdoQWdzZ0FnUkFJQUJCZ0VCcUlBRVFCQXdDQ3lBQVFZRDhBMDRpQWdSQUlBQkJuLzBEVENFQ0N5QUNCRUFqM0FGQkFrNFBDeUFBUWFEOUEwNGlBZ1JBSUFCQi8vMERUQ0VDQ3lBQ0RRQWdBRUdDL2dOR0JFQWdBVUVCY1VFQVJ5VEtBU0FCUVFKeFFRQkhKTXNCSUFGQmdBRnhRUUJISk13QlFRRVBDeUFBUVpEK0EwNGlBZ1JBSUFCQnB2NERUQ0VDQ3lBQ0JFQVFWeUFBSUFFUVpROExJQUJCc1A0RFRpSUNCRUFnQUVHLy9nTk1JUUlMSUFJRVFCQlhDeUFBUWNEK0EwNGlBZ1JBSUFCQnkvNERUQ0VDQ3lBQ0JFQWdBRUhBL2dOR0JFQWdBUkFrREFNTElBQkJ3ZjREUmdSQVFjSCtBeUFCUWZnQmNVSEIvZ01RQWtFSGNYSkJnQUZ5RUFRTUFnc2dBRUhFL2dOR0JFQkJBQ1RvQVNBQVFRQVFCQXdDQ3lBQVFjWCtBMFlFUUNBQkpOMEJEQU1MSUFCQnh2NERSZ1JBSUFFUVpnd0RDd0pBQWtBQ1FBSkFJQUFpQWtIRC9nTkhCRUFnQWtIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTVHBBUXdHQ3lBQkpPb0JEQVVMSUFFazZ3RU1CQXNnQVNUc0FRd0RDd3dDQ3lQNkFTQUFSZ1JBSUFFUWFRd0JDeU9CQWlBQVJpSUNSUVJBSTRBQ0lBQkdJUUlMSUFJRVFDUDhBUVJBQW44ai9nRWlBa0dBZ0FGT0lnTUVRQ0FDUWYvL0FVd2hBd3NnQTBVTEJFQWdBa0dBb0FOT0lnTUVRQ0FDUWYrL0Ewd2hBd3NMSUFNTkFnc0xJQUFqUlU0aUFnUkFJQUFqUjB3aEFnc2dBZ1JBSUFBZ0FSQnFEQUlMSUFCQmhQNERUaUlDQkVBZ0FFR0gvZ05NSVFJTElBSUVRQkJ1QWtBQ1FBSkFBa0FnQUNJQ1FZVCtBMGNFUUNBQ1FZWCtBMnNPQXdFQ0F3UUxFRzhNQlFzQ1FDUEdBUVJBSThRQkRRRWp3d0VFUUVFQUpNTUJDd3NnQVNUQ0FRc01CUXNnQVNURkFTUEVBU1BHQVNJQUlBQWJCRUFnQVNUQ0FVRUFKTVFCQ3d3RUN5QUJFSEFNQXdzTUFnc2dBRUdBL2dOR0JFQWdBVUgvQVhNazFRRWoxUUVpQWtFUWNVRUFSeVRXQVNBQ1FTQnhRUUJISk5jQkN5QUFRWS8rQTBZRVFDQUJFQlFNQWdzZ0FFSC8vd05HQkVBZ0FSQVREQUlMUVFFUEMwRUFEd3RCQVFzZkFDUGFBU0FBUmdSQVFRRWsyd0VMSUFBZ0FSQnhCRUFnQUNBQkVBUUxDMW9CQTM4RFFBSkFJQU1nQWs0TkFDQUFJQU5xRUZzaEJTQUJJQU5xSVFRRFFDQUVRZisvQWtvRVFDQUVRWUJBYWlFRURBRUxDeUFFSUFVUWNpQURRUUZxSVFNTUFRc0xJL3NCUVNBamhBSjBJQUpCQkhWc2FpVDdBUXR5QVFKL0kvd0JSUVJBRHd0QkVDRUFJLzRCSS84QkFuOGovUUVpQVVFUVNBUkFJQUVoQUFzZ0FBc1FjeVArQVNBQWFpVCtBU1AvQVNBQWFpVC9BU0FCSUFCcklnRWsvUUVqK2dFaEFDQUJRUUJNQkVCQkFDVDhBU0FBUWY4QkVBUUZJQUFnQVVFRWRVRUJhMEgvZm5FUUJBc0xRd0VCZndKL0lBQkZJZ0pGQkVBZ0FFRUJSaUVDQ3lBQ0N3Ui9JK2dCSTkwQlJnVWdBZ3NFUUNBQlFRUnlJZ0ZCd0FCeEJFQVFRQXNGSUFGQmUzRWhBUXNnQVF2NkFRRUZmeVBlQVVVRVFBOExJOXdCSVFNZ0F5UG9BU0lFUVpBQlRnUi9RUUVGSStjQklnSkIrQUlqaEFKMElnQk9CSDlCQWdWQkEwRUFJQUlnQUU0YkN3c2lBVWNFUUVIQi9nTVFBaUVBSUFFazNBRkJBQ0VDQWtBQ1FBSkFBa0FnQVFSQUlBRkJBV3NPQXdFQ0F3UUxJQUJCZkhFaUFFRUljVUVBUnlFQ0RBTUxJQUJCZlhGQkFYSWlBRUVRY1VFQVJ5RUNEQUlMSUFCQmZuRkJBbklpQUVFZ2NVRUFSeUVDREFFTElBQkJBM0loQUFzZ0FnUkFFRUFMSUFGRkJFQVFkQXNnQVVFQlJnUkFRUUVrdXdGQkFCQS9DMEhCL2dNZ0FTQUFFSFVRQkFVZ0JFR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUFoQjFFQVFMQ3d1ZkFRRUJmeVBlQVFSQUkrY0JJQUJxSk9jQkl6UWhBUU5BSStjQlFRUWpoQUlpQUhSQnlBTWdBSFFqNkFGQm1RRkdHMDRFUUNQbkFVRUVJNFFDSWdCMFFjZ0RJQUIwSStnQlFaa0JSaHRySk9jQkkrZ0JJZ0JCa0FGR0JFQWdBUVJBRUQwRklBQVFQQXNRUGtGL0pFaEJmeVJKQlNBQVFaQUJTQVJBSUFGRkJFQWdBQkE4Q3dzTFFRQWdBRUVCYWlBQVFaa0JTaHNrNkFFTUFRc0xDeEIyQ3pjQkFYOUJCQ09FQWlJQWRFSElBeUFBZENQb0FVR1pBVVliSVFBRFFDUG1BU0FBVGdSQUlBQVFkeVBtQVNBQWF5VG1BUXdCQ3dzTHVBRUJCSDhqekFGRkJFQVBDd05BSUFNZ0FFZ0VRQ0FEUVFScUlRTUNmeVBJQVNJQ1FRUnFJZ0ZCLy84RFNnUkFJQUZCZ0lBRWF5RUJDeUFCQ3lUSUFVRUJRUUpCQnlQTEFSc2lCSFFnQW5GQkFFY2lBZ1JBUVFFZ0JIUWdBWEZGSVFJTElBSUVRRUdCL2dOQmdmNERFQUpCQVhSQkFXcEIvd0Z4RUFRanlRRkJBV29pQVVFSVJnUkFRUUFreVFGQkFTUytBVUVERUQ5Qmd2NERRWUwrQXhBQ1FmOStjUkFFUVFBa3pBRUZJQUVreVFFTEN3d0JDd3NMa0FFQUkvc0JRUUJLQkVBait3RWdBR29oQUVFQUpQc0JDeU9QQWlBQWFpU1BBaU9UQWtVRVFDTXlCRUFqNWdFZ0FHb2s1Z0VRZUFVZ0FCQjNDeU14QkVBam9BRWdBR29rb0FFUVZ3VWdBQkJXQ3lBQUVIa0xJek1FUUNQQUFTQUFhaVRBQVJCdUJTQUFFRzBMSTVZQ0lBQnFJZ0FqbEFKT0JFQWpsUUpCQVdva2xRSWdBQ09VQW1zaEFBc2dBQ1NXQWdzTEFFRUVFSG9qamdJUUFnc25BUUYvUVFRUWVpT09Ba0VCYWtILy93TnhFQUloQUJCN1FmOEJjU0FBUWY4QmNVRUlkSElMREFCQkJCQjZJQUFnQVJCeUN6SUJBWDlCQVNBQWRFSC9BWEVoQWlBQlFRQktCRUFqakFJZ0FuSkIvd0Z4Skl3Q0JTT01BaUFDUWY4QmMzRWtqQUlMQ3dnQVFRVWdBQkIrQ3pnQkFYOGdBVUVBVGdSQUlBQkJEM0VnQVVFUGNXcEJFSEZCQUVjUWZ3VWdBVUVmZFNJQ0lBRWdBbXB6UVE5eElBQkJEM0ZMRUg4TEN3Z0FRUWNnQUJCK0N3Z0FRUVlnQUJCK0N3Z0FRUVFnQUJCK0N6a0JBWDhnQVVHQS9nTnhRUWgxSVFJZ0FDQUJRZjhCY1NJQkVIRUVRQ0FBSUFFUUJBc2dBRUVCYWlJQUlBSVFjUVJBSUFBZ0FoQUVDd3NOQUVFSUVIb2dBQ0FCRUlRQkMxZ0FJQUlFUUNBQklBQkIvLzhEY1NJQWFpQUFJQUZ6Y3lJQ1FSQnhRUUJIRUg4Z0FrR0FBbkZCQUVjUWd3RUZJQUFnQVdwQi8vOERjU0lDSUFCQi8vOERjVWtRZ3dFZ0FDQUJjeUFDYzBHQUlIRkJBRWNRZndzTENnQkJCQkI2SUFBUVd3dVlCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTERCVUxFSHhCLy84RGNTSUFRWUQrQTNGQkNIVWtoZ0lnQUVIL0FYRWtod0lNRHdzamh3SkIvd0Z4STRZQ1FmOEJjVUVJZEhJamhRSVFmUXdUQ3lPSEFrSC9BWEVqaGdKQi93RnhRUWgwY2tFQmFrSC8vd054SWdCQmdQNERjVUVJZFNTR0Fnd1RDeU9HQWlJQVFRRVFnQUVnQUVFQmFrSC9BWEVpQUNTR0Fnd05DeU9HQWlJQVFYOFFnQUVnQUVFQmEwSC9BWEVpQUNTR0Fnd05DeEI3UWY4QmNTU0dBZ3dOQ3lPRkFpSUFRWUFCY1VHQUFVWVFnd0VnQUVFQmRDQUFRZjhCY1VFSGRuSkIvd0Z4SklVQ0RBMExFSHhCLy84RGNTT05BaENGQVF3SUN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNpSUFJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlJZ0ZCQUJDR0FTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSW9DSUFCQi93RnhKSXNDUVFBUWdnRkJDQThMSTRjQ1FmOEJjU09HQWtIL0FYRkJDSFJ5RUljQlFmOEJjU1NGQWd3TEN5T0hBa0gvQVhFamhnSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0dBZ3dMQ3lPSEFpSUFRUUVRZ0FFZ0FFRUJha0gvQVhFaUFDU0hBZ3dGQ3lPSEFpSUFRWDhRZ0FFZ0FFRUJhMEgvQVhFaUFDU0hBZ3dGQ3hCN1FmOEJjU1NIQWd3RkN5T0ZBaUlBUVFGeFFRQkxFSU1CSUFCQkIzUWdBRUgvQVhGQkFYWnlRZjhCY1NTRkFnd0ZDMEYvRHdzampnSkJBbXBCLy84RGNTU09BZ3dFQ3lBQVJSQ0JBVUVBRUlJQkRBTUxJQUJGRUlFQlFRRVFnZ0VNQWdzampnSkJBV3BCLy84RGNTU09BZ3dCQzBFQUVJRUJRUUFRZ2dGQkFCQi9DMEVFRHdzZ0FFSC9BWEVraHdKQkNBdUhCZ0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVRUndSQUlBQkJFV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTRNQ0JFQkJ6ZjRERUljQlFmOEJjU0lBUVFGeEJFQkJ6ZjRESUFCQmZuRWlBRUdBQVhFRWYwRUFKSVFDSUFCQi8zNXhCVUVCSklRQ0lBQkJnQUZ5Q3hCOVFjUUFEd3NMUVFFa2t3SU1FQXNRZkVILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWlPT0FrRUNha0gvL3dOeEpJNENEQkVMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRVQ0VIME1FQXNqaVFKQi93RnhJNGdDUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraUFJTUVBc2ppQUlpQUVFQkVJQUJJQUJCQVdwQi93RnhKSWdDSTRnQ1JSQ0JBVUVBRUlJQkRBNExJNGdDSWdCQmZ4Q0FBU0FBUVFGclFmOEJjU1NJQWlPSUFrVVFnUUZCQVJDQ0FRd05DeEI3UWY4QmNTU0lBZ3dLQ3lPRkFpSUJRWUFCY1VHQUFVWWhBQ09NQWtFRWRrRUJjU0FCUVFGMGNrSC9BWEVraFFJTUNnc1FleUVBSTQ0Q0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NPQWtFSUR3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISWlBQ09KQWtIL0FYRWppQUpCL3dGeFFRaDBjaUlCUVFBUWhnRWdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NLQWlBQVFmOEJjU1NMQWtFQUVJSUJRUWdQQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDSEFVSC9BWEVraFFJTUNBc2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtpQUlNQ0FzamlRSWlBRUVCRUlBQklBQkJBV3BCL3dGeElnQWtpUUlnQUVVUWdRRkJBQkNDQVF3R0N5T0pBaUlBUVg4UWdBRWdBRUVCYTBIL0FYRWlBQ1NKQWlBQVJSQ0JBVUVCRUlJQkRBVUxFSHRCL3dGeEpJa0NEQUlMSTRVQ0lnRkJBWEZCQVVZaEFDT01Ba0VFZGtFQmNVRUhkQ0FCUWY4QmNVRUJkbklraFFJTUFndEJmdzhMSTQ0Q1FRRnFRZi8vQTNFa2pnSU1BUXNnQUJDREFVRUFFSUVCUVFBUWdnRkJBQkIvQzBFRUR3c2dBRUgvQVhFa2lRSkJDQXZpQmdFQ2Z3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJJRWNFUUNBQVFTRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9NQWtFSGRrRUJjUVJBSTQ0Q1FRRnFRZi8vQTNFa2pnSUZFSHNoQUNPT0FpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VramdJTFFRZ1BDeEI4UWYvL0EzRWlBRUdBL2dOeFFRaDFKSW9DSUFCQi93RnhKSXNDSTQ0Q1FRSnFRZi8vQTNFa2pnSU1GQXNqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElpQUNPRkFoQjlEQThMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSklvQ0RBMExJNG9DSWdCQkFSQ0FBU0FBUVFGcVFmOEJjU0lBSklvQ0RBNExJNG9DSWdCQmZ4Q0FBU0FBUVFGclFmOEJjU0lBSklvQ0RBNExFSHRCL3dGeEpJb0NEQTRMUVFaQkFDT01BaUlDUVFWMlFRRnhRUUJMR3lJQlFlQUFjaUFCSUFKQkJIWkJBWEZCQUVzYklRRWpoUUloQUNBQ1FRWjJRUUZ4UVFCTEJIOGdBQ0FCYTBIL0FYRUZJQUZCQm5JZ0FTQUFRUTl4UVFsTEd5SUJRZUFBY2lBQklBQkJtUUZMR3lJQklBQnFRZjhCY1FzaUFFVVFnUUVnQVVIZ0FIRkJBRWNRZ3dGQkFCQi9JQUFraFFJTURnc2pqQUpCQjNaQkFYRkJBRXNFUUJCN0lRQWpqZ0lnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJNENCU09PQWtFQmFrSC8vd054Skk0Q0MwRUlEd3NqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElpQUNBQVFmLy9BM0ZCQUJDR0FTQUFRUUYwUWYvL0EzRWlBRUdBL2dOeFFRaDFKSW9DSUFCQi93RnhKSXNDUVFBUWdnRkJDQThMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5SWdBUWh3RkIvd0Z4SklVQ0RBY0xJNHNDUWY4QmNTT0tBa0gvQVhGQkNIUnlRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDFKSW9DREFVTEk0c0NJZ0JCQVJDQUFTQUFRUUZxUWY4QmNTSUFKSXNDREFZTEk0c0NJZ0JCZnhDQUFTQUFRUUZyUWY4QmNTSUFKSXNDREFZTEVIdEIvd0Z4SklzQ0RBWUxJNFVDUVg5elFmOEJjU1NGQWtFQkVJSUJRUUVRZnd3R0MwRi9Ed3NnQUVIL0FYRWtpd0pCQ0E4TElBQkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtpZ0lnQUVIL0FYRWtpd0lNQXdzZ0FFVVFnUUZCQUJDQ0FRd0NDeUFBUlJDQkFVRUJFSUlCREFFTEk0NENRUUZxUWYvL0EzRWtqZ0lMUVFRTDJ3VUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFUQkhCRUFnQUVFeGF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pqQUpCQkhaQkFYRUVRQ09PQWtFQmFrSC8vd054Skk0Q0JSQjdJUUFqamdJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSTRDQzBFSUR3c1FmRUgvL3dOeEpJMENJNDRDUVFKcVFmLy9BM0VramdJTUVRc2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISWlBQ09GQWhCOURBNExJNDBDUVFGcVFmLy9BM0VralFKQkNBOExJNHNDUWY4QmNTT0tBa0gvQVhGQkNIUnlJZ0VRaHdFaUFFRUJFSUFCSUFCQkFXcEIvd0Z4SWdCRkVJRUJRUUFRZ2dFZ0FTQUFFSDBNRGdzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJaUFSQ0hBU0lBUVg4UWdBRWdBRUVCYTBIL0FYRWlBRVVRZ1FGQkFSQ0NBU0FCSUFBUWZRd05DeU9MQWtIL0FYRWppZ0pCL3dGeFFRaDBjaEI3UWY4QmNSQjlEQXNMUVFBUWdnRkJBQkIvUVFFUWd3RU1Dd3NqakFKQkJIWkJBWEZCQVVZRVFCQjdJUUFqamdJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSTRDQlNPT0FrRUJha0gvL3dOeEpJNENDMEVJRHdzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJaUFDT05Ba0VBRUlZQkk0MENJQUJxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSW9DSUFCQi93RnhKSXNDUVFBUWdnRkJDQThMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5SWdBUWh3RkIvd0Z4SklVQ0RBWUxJNDBDUVFGclFmLy9BM0VralFKQkNBOExJNFVDSWdCQkFSQ0FBU0FBUVFGcVFmOEJjU0lBSklVQ0lBQkZFSUVCUVFBUWdnRU1CZ3NqaFFJaUFFRi9FSUFCSUFCQkFXdEIvd0Z4SWdBa2hRSWdBRVVRZ1FGQkFSQ0NBUXdGQ3hCN1FmOEJjU1NGQWd3REMwRUFFSUlCUVFBUWZ5T01Ba0VFZGtFQmNVRUFUUkNEQVF3REMwRi9Ed3NnQUVFQmEwSC8vd054SWdCQmdQNERjVUVJZFNTS0FpQUFRZjhCY1NTTEFnd0JDeU9PQWtFQmFrSC8vd054Skk0Q0MwRUVDNElDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCd0FCSEJFQWdBRUhCQUVZTkFRSkFJQUJCd2dCckRnNERCQVVHQndnSkVRb0xEQTBPRHdBTERBOExEQThMSTRjQ0pJWUNEQTRMSTRnQ0pJWUNEQTBMSTRrQ0pJWUNEQXdMSTRvQ0pJWUNEQXNMSTRzQ0pJWUNEQW9MSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5RUljQlFmOEJjU1NHQWd3SkN5T0ZBaVNHQWd3SUN5T0dBaVNIQWd3SEN5T0lBaVNIQWd3R0N5T0pBaVNIQWd3RkN5T0tBaVNIQWd3RUN5T0xBaVNIQWd3REN5T0xBa0gvQVhFamlnSkIvd0Z4UVFoMGNoQ0hBVUgvQVhFa2h3SU1BZ3NqaFFJa2h3SU1BUXRCZnc4TFFRUUwvUUVBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUJIQkVBZ0FFSFJBRVlOQVFKQUlBQkIwZ0JyRGc0UUF3UUZCZ2NJQ1FvUUN3d05EZ0FMREE0TEk0WUNKSWdDREE0TEk0Y0NKSWdDREEwTEk0a0NKSWdDREF3TEk0b0NKSWdDREFzTEk0c0NKSWdDREFvTEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUVJY0JRZjhCY1NTSUFnd0pDeU9GQWlTSUFnd0lDeU9HQWlTSkFnd0hDeU9IQWlTSkFnd0dDeU9JQWlTSkFnd0ZDeU9LQWlTSkFnd0VDeU9MQWlTSkFnd0RDeU9MQWtIL0FYRWppZ0pCL3dGeFFRaDBjaENIQVVIL0FYRWtpUUlNQWdzamhRSWtpUUlNQVF0QmZ3OExRUVFML1FFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFCSEJFQWdBRUhoQUVZTkFRSkFJQUJCNGdCckRnNERCQkFGQmdjSUNRb0xEQkFORGdBTERBNExJNFlDSklvQ0RBNExJNGNDSklvQ0RBMExJNGdDSklvQ0RBd0xJNGtDSklvQ0RBc0xJNHNDSklvQ0RBb0xJNHNDUWY4QmNTT0tBa0gvQVhGQkNIUnlFSWNCUWY4QmNTU0tBZ3dKQ3lPRkFpU0tBZ3dJQ3lPR0FpU0xBZ3dIQ3lPSEFpU0xBZ3dHQ3lPSUFpU0xBZ3dGQ3lPSkFpU0xBZ3dFQ3lPS0FpU0xBZ3dEQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2hDSEFVSC9BWEVraXdJTUFnc2poUUlraXdJTUFRdEJmdzhMUVFRTGxBTUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBRWNFUUNBQVFmRUFSZzBCQWtBZ0FFSHlBR3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFJBQXNNRHdzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJamhnSVFmUXdQQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2lPSEFoQjlEQTRMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5STRnQ0VIME1EUXNqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElqaVFJUWZRd01DeU9MQWtIL0FYRWppZ0pCL3dGeFFRaDBjaU9LQWhCOURBc0xJNHNDUWY4QmNTT0tBa0gvQVhGQkNIUnlJNHNDRUgwTUNnc2ovQUZGQkVBQ1FDT3lBUVJBUVFFa2tBSU1BUXNqdEFFanVnRnhRUjl4UlFSQVFRRWtrUUlNQVF0QkFTU1NBZ3NMREFrTEk0c0NRZjhCY1NPS0FrSC9BWEZCQ0hSeUk0VUNFSDBNQ0FzamhnSWtoUUlNQndzamh3SWtoUUlNQmdzamlBSWtoUUlNQlFzamlRSWtoUUlNQkFzamlnSWtoUUlNQXdzaml3SWtoUUlNQWdzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJUWh3RkIvd0Z4SklVQ0RBRUxRWDhQQzBFRUN6Y0JBWDhnQVVFQVRnUkFJQUJCL3dGeElBQWdBV3BCL3dGeFN4Q0RBUVVnQVVFZmRTSUNJQUVnQW1weklBQkIvd0Z4U2hDREFRc0xOQUVDZnlPRkFpSUJJQUJCL3dGeElnSVFnQUVnQVNBQ0VKQUJJQUFnQVdwQi93RnhJZ0VraFFJZ0FVVVFnUUZCQUJDQ0FRdFhBUUovSTRVQ0lnRWdBR29qakFKQkJIWkJBWEZxUWY4QmNTSUNJQUFnQVhOelFSQnhRUUJIRUg4Z0FFSC9BWEVnQVdvampBSkJCSFpCQVhGcVFZQUNjVUVBU3hDREFTQUNKSVVDSUFKRkVJRUJRUUFRZ2dFTGd3SUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHQUFVY0VRQ0FCUVlFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2poZ0lRa1FFTUVBc2pod0lRa1FFTUR3c2ppQUlRa1FFTURnc2ppUUlRa1FFTURRc2ppZ0lRa1FFTURBc2ppd0lRa1FFTUN3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VRa1FFTUNnc2poUUlRa1FFTUNRc2poZ0lRa2dFTUNBc2pod0lRa2dFTUJ3c2ppQUlRa2dFTUJnc2ppUUlRa2dFTUJRc2ppZ0lRa2dFTUJBc2ppd0lRa2dFTUF3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VRa2dFTUFnc2poUUlRa2dFTUFRdEJmdzhMUVFRTE53RUNmeU9GQWlJQklBQkIvd0Z4UVg5c0lnSVFnQUVnQVNBQ0VKQUJJQUVnQUd0Qi93RnhJZ0VraFFJZ0FVVVFnUUZCQVJDQ0FRdFhBUUovSTRVQ0lnRWdBR3NqakFKQkJIWkJBWEZyUWY4QmNTSUNJQUFnQVhOelFSQnhRUUJIRUg4Z0FTQUFRZjhCY1dzampBSkJCSFpCQVhGclFZQUNjVUVBU3hDREFTQUNKSVVDSUFKRkVJRUJRUUVRZ2dFTGd3SUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHUUFVY0VRQ0FCUVpFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2poZ0lRbEFFTUVBc2pod0lRbEFFTUR3c2ppQUlRbEFFTURnc2ppUUlRbEFFTURRc2ppZ0lRbEFFTURBc2ppd0lRbEFFTUN3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VRbEFFTUNnc2poUUlRbEFFTUNRc2poZ0lRbFFFTUNBc2pod0lRbFFFTUJ3c2ppQUlRbFFFTUJnc2ppUUlRbFFFTUJRc2ppZ0lRbFFFTUJBc2ppd0lRbFFFTUF3c2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VRbFFFTUFnc2poUUlRbFFFTUFRdEJmdzhMUVFRTEl3RUJmeU9GQWlBQWNTSUJKSVVDSUFGRkVJRUJRUUFRZ2dGQkFSQi9RUUFRZ3dFTEp3RUJmeU9GQWlBQWMwSC9BWEVpQVNTRkFpQUJSUkNCQVVFQUVJSUJRUUFRZjBFQUVJTUJDNE1DQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUlnRkJvQUZIQkVBZ0FVR2hBV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTRZQ0VKY0JEQkFMSTRjQ0VKY0JEQThMSTRnQ0VKY0JEQTRMSTRrQ0VKY0JEQTBMSTRvQ0VKY0JEQXdMSTRzQ0VKY0JEQXNMSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5RUljQkVKY0JEQW9MSTRVQ0VKY0JEQWtMSTRZQ0VKZ0JEQWdMSTRjQ0VKZ0JEQWNMSTRnQ0VKZ0JEQVlMSTRrQ0VKZ0JEQVVMSTRvQ0VKZ0JEQVFMSTRzQ0VKZ0JEQU1MSTRzQ1FmOEJjU09LQWtIL0FYRkJDSFJ5RUljQkVKZ0JEQUlMSTRVQ0VKZ0JEQUVMUVg4UEMwRUVDeVVBSTRVQ0lBQnlRZjhCY1NJQUpJVUNJQUJGRUlFQlFRQVFnZ0ZCQUJCL1FRQVFnd0VMTEFFQmZ5T0ZBaUlCSUFCQi93RnhRWDlzSWdBUWdBRWdBU0FBRUpBQklBQWdBV3BGRUlFQlFRRVFnZ0VMZ3dJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQWlBVUd3QVVjRVFDQUJRYkVCYXc0UEFRSURCQVVHQndnSkNnc01EUTRQRUFzamhnSVFtZ0VNRUFzamh3SVFtZ0VNRHdzamlBSVFtZ0VNRGdzamlRSVFtZ0VNRFFzamlnSVFtZ0VNREFzaml3SVFtZ0VNQ3dzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJUWh3RVFtZ0VNQ2dzamhRSVFtZ0VNQ1FzamhnSVFtd0VNQ0Fzamh3SVFtd0VNQndzamlBSVFtd0VNQmdzamlRSVFtd0VNQlFzamlnSVFtd0VNQkFzaml3SVFtd0VNQXdzaml3SkIvd0Z4STRvQ1FmOEJjVUVJZEhJUWh3RVFtd0VNQWdzamhRSVFtd0VNQVF0QmZ3OExRUVFMT3dFQmZ5QUFFRm9pQVVGL1JnUi9JQUFRQWdVZ0FRdEIvd0Z4SUFCQkFXb2lBUkJhSWdCQmYwWUVmeUFCRUFJRklBQUxRZjhCY1VFSWRISUxDd0JCQ0JCNklBQVFuUUVMTXdBZ0FFR0FBWEZCZ0FGR0VJTUJJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU0lBUlJDQkFVRUFFSUlCUVFBUWZ5QUFDekVBSUFCQkFYRkJBRXNRZ3dFZ0FFRUhkQ0FBUWY4QmNVRUJkbkpCL3dGeElnQkZFSUVCUVFBUWdnRkJBQkIvSUFBTE9RRUJmeU9NQWtFRWRrRUJjU0FBUVFGMGNrSC9BWEVoQVNBQVFZQUJjVUdBQVVZUWd3RWdBU0lBUlJDQkFVRUFFSUlCUVFBUWZ5QUFDem9CQVg4ampBSkJCSFpCQVhGQkIzUWdBRUgvQVhGQkFYWnlJUUVnQUVFQmNVRUJSaENEQVNBQklnQkZFSUVCUVFBUWdnRkJBQkIvSUFBTEtRQWdBRUdBQVhGQmdBRkdFSU1CSUFCQkFYUkIvd0Z4SWdCRkVJRUJRUUFRZ2dGQkFCQi9JQUFMUkFFQ2Z5QUFRUUZ4UVFGR0lRRWdBRUdBQVhGQmdBRkdJUUlnQUVIL0FYRkJBWFlpQUVHQUFYSWdBQ0FDR3lJQVJSQ0JBVUVBRUlJQlFRQVFmeUFCRUlNQklBQUxLZ0FnQUVFUGNVRUVkQ0FBUWZBQmNVRUVkbklpQUVVUWdRRkJBQkNDQVVFQUVIOUJBQkNEQVNBQUN5MEJBWDhnQUVFQmNVRUJSaUVCSUFCQi93RnhRUUYySWdCRkVJRUJRUUFRZ2dGQkFCQi9JQUVRZ3dFZ0FBc2RBRUVCSUFCMElBRnhRZjhCY1VVUWdRRkJBQkNDQVVFQkVIOGdBUXV4Q0FFR2Z3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRUhjU0lHSWdVRVFDQUZRUUZyRGdjQkFnTUVCUVlIQ0FzamhnSWhBUXdIQ3lPSEFpRUJEQVlMSTRnQ0lRRU1CUXNqaVFJaEFRd0VDeU9LQWlFQkRBTUxJNHNDSVFFTUFnc2ppd0pCL3dGeEk0b0NRZjhCY1VFSWRISVFod0VoQVF3QkN5T0ZBaUVCQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGeFFRUjFJZ1VpQkFSQUlBUkJBV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSUFCQkIwd0VmMEVCSVFJZ0FSQ2ZBUVVnQUVFUFRBUi9RUUVoQWlBQkVLQUJCVUVBQ3dzaEF3d1BDeUFBUVJkTUJIOUJBU0VDSUFFUW9RRUZJQUJCSDB3RWYwRUJJUUlnQVJDaUFRVkJBQXNMSVFNTURnc2dBRUVuVEFSL1FRRWhBaUFCRUtNQkJTQUFRUzlNQkg5QkFTRUNJQUVRcEFFRlFRQUxDeUVEREEwTElBQkJOMHdFZjBFQklRSWdBUkNsQVFVZ0FFRS9UQVIvUVFFaEFpQUJFS1lCQlVFQUN3c2hBd3dNQ3lBQVFjY0FUQVIvUVFFaEFrRUFJQUVRcHdFRklBQkJ6d0JNQkg5QkFTRUNRUUVnQVJDbkFRVkJBQXNMSVFNTUN3c2dBRUhYQUV3RWYwRUJJUUpCQWlBQkVLY0JCU0FBUWQ4QVRBUi9RUUVoQWtFRElBRVFwd0VGUVFBTEN5RUREQW9MSUFCQjV3Qk1CSDlCQVNFQ1FRUWdBUkNuQVFVZ0FFSHZBRXdFZjBFQklRSkJCU0FCRUtjQkJVRUFDd3NoQXd3SkN5QUFRZmNBVEFSL1FRRWhBa0VHSUFFUXB3RUZJQUJCL3dCTUJIOUJBU0VDUVFjZ0FSQ25BUVZCQUFzTElRTU1DQXNnQUVHSEFVd0VmMEVCSVFJZ0FVRitjUVVnQUVHUEFVd0VmMEVCSVFJZ0FVRjljUVZCQUFzTElRTU1Cd3NnQUVHWEFVd0VmMEVCSVFJZ0FVRjdjUVVnQUVHZkFVd0VmMEVCSVFJZ0FVRjNjUVZCQUFzTElRTU1CZ3NnQUVHbkFVd0VmMEVCSVFJZ0FVRnZjUVVnQUVHdkFVd0VmMEVCSVFJZ0FVRmZjUVZCQUFzTElRTU1CUXNnQUVHM0FVd0VmMEVCSVFJZ0FVRy9mM0VGSUFCQnZ3Rk1CSDlCQVNFQ0lBRkIvMzV4QlVFQUN3c2hBd3dFQ3lBQVFjY0JUQVIvUVFFaEFpQUJRUUZ5QlNBQVFjOEJUQVIvUVFFaEFpQUJRUUp5QlVFQUN3c2hBd3dEQ3lBQVFkY0JUQVIvUVFFaEFpQUJRUVJ5QlNBQVFkOEJUQVIvUVFFaEFpQUJRUWh5QlVFQUN3c2hBd3dDQ3lBQVFlY0JUQVIvUVFFaEFpQUJRUkJ5QlNBQVFlOEJUQVIvUVFFaEFpQUJRU0J5QlVFQUN3c2hBd3dCQ3lBQVFmY0JUQVIvUVFFaEFpQUJRY0FBY2dVZ0FFSC9BVXdFZjBFQklRSWdBVUdBQVhJRlFRQUxDeUVEQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQmlJRUJFQWdCRUVCYXc0SEFRSURCQVVHQndnTElBTWtoZ0lNQndzZ0F5U0hBZ3dHQ3lBREpJZ0NEQVVMSUFNa2lRSU1CQXNnQXlTS0Fnd0RDeUFESklzQ0RBSUxJQVZCQkVnaUJBUi9JQVFGSUFWQkIwb0xCRUFqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElnQXhCOUN3d0JDeUFESklVQ0MwRUVRWDhnQWhzTHF3UUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUJSd1JBSUFCQndRRnJEZzhCQWhFREJBVUdCd2dKQ2dzUURBME9DeU9NQWtFSGRrRUJjUTBSREE0TEk0MENFSjRCUWYvL0EzRWhBQ09OQWtFQ2FrSC8vd054SkkwQ0lBQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBa0VFRHdzampBSkJCM1pCQVhFTkVRd09DeU9NQWtFSGRrRUJjUTBRREF3TEk0MENRUUpyUWYvL0EzRWlBQ1NOQWlBQUk0Y0NRZjhCY1NPR0FrSC9BWEZCQ0hSeUVJVUJEQTBMRUhzUWtRRU1EUXNqalFKQkFtdEIvLzhEY1NJQUpJMENJQUFqamdJUWhRRkJBQ1NPQWd3TEN5T01Ba0VIZGtFQmNVRUJSdzBLREFjTEk0MENJZ0FRbmdGQi8vOERjU1NPQWlBQVFRSnFRZi8vQTNFa2pRSU1DUXNqakFKQkIzWkJBWEZCQVVZTkJ3d0tDeEI3UWY4QmNSQ29BU0VBSTQ0Q1FRRnFRZi8vQTNFa2pnSWdBQThMSTR3Q1FRZDJRUUZ4UVFGSERRZ2pqUUpCQW10Qi8vOERjU0lBSkkwQ0lBQWpqZ0pCQW1wQi8vOERjUkNGQVF3RkN4QjdFSklCREFZTEk0MENRUUpyUWYvL0EzRWlBQ1NOQWlBQUk0NENFSVVCUVFna2pnSU1CQXRCZnc4TEk0MENJZ0FRbmdGQi8vOERjU1NPQWlBQVFRSnFRZi8vQTNFa2pRSkJEQThMSTQwQ1FRSnJRZi8vQTNFaUFDU05BaUFBSTQ0Q1FRSnFRZi8vQTNFUWhRRUxFSHhCLy84RGNTU09BZ3RCQ0E4TEk0NENRUUZxUWYvL0EzRWtqZ0pCQkE4TEk0NENRUUpxUWYvL0EzRWtqZ0pCREF1cUJBRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQVVjRVFDQUFRZEVCYXc0UEFRSU5Bd1FGQmdjSUNRMEtEUXNNRFFzampBSkJCSFpCQVhFTkR5T05BaUlBRUo0QlFmLy9BM0VramdJZ0FFRUNha0gvL3dOeEpJMENRUXdQQ3lPTkFpSUFFSjRCUWYvL0EzRWhBU0FBUVFKcVFmLy9BM0VralFJZ0FVR0EvZ054UVFoMUpJZ0NJQUZCL3dGeEpJa0NRUVFQQ3lPTUFrRUVka0VCY1EwTERBd0xJNHdDUVFSMlFRRnhEUW9qalFKQkFtdEIvLzhEY1NJQkpJMENJQUVqamdKQkFtcEIvLzhEY1JDRkFRd0xDeU9OQWtFQ2EwSC8vd054SWdFa2pRSWdBU09KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENGQVF3TEN4QjdFSlFCREFzTEk0MENRUUpyUWYvL0EzRWlBU1NOQWlBQkk0NENFSVVCUVJBa2pnSU1DUXNqakFKQkJIWkJBWEZCQVVjTkNDT05BaUlCRUo0QlFmLy9BM0VramdJZ0FVRUNha0gvL3dOeEpJMENRUXdQQ3lPTkFpSUJFSjRCUWYvL0EzRWtqZ0pCQVNTekFTQUJRUUpxUWYvL0EzRWtqUUlNQndzampBSkJCSFpCQVhGQkFVWU5CUXdFQ3lPTUFrRUVka0VCY1VFQlJ3MERJNDBDUVFKclFmLy9BM0VpQVNTTkFpQUJJNDRDUVFKcVFmLy9BM0VRaFFFTUJBc1FleENWQVF3RkN5T05Ba0VDYTBILy93TnhJZ0VralFJZ0FTT09BaENGQVVFWUpJNENEQU1MUVg4UEN5T09Ba0VDYWtILy93TnhKSTRDUVF3UEN4QjhRZi8vQTNFa2pnSUxRUWdQQ3lPT0FrRUJha0gvL3dOeEpJNENRUVFMblFNQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBVWNFUUNBQVFlRUJhdzRQQVFJTEN3TUVCUVlIQ0FzTEN3a0tDd3NRZTBIL0FYRkJnUDREYWlPRkFoQjlEQXNMSTQwQ0lnQVFuZ0ZCLy84RGNTRUJJQUJCQW1wQi8vOERjU1NOQWlBQlFZRCtBM0ZCQ0hVa2lnSWdBVUgvQVhFa2l3SkJCQThMSTRjQ1FZRCtBMm9qaFFJUWZVRUVEd3NqalFKQkFtdEIvLzhEY1NJQkpJMENJQUVqaXdKQi93RnhJNG9DUWY4QmNVRUlkSElRaFFGQkNBOExFSHNRbHdFTUJ3c2pqUUpCQW10Qi8vOERjU0lCSkkwQ0lBRWpqZ0lRaFFGQklDU09Ba0VJRHdzUWUwRVlkRUVZZFNFQkk0MENJQUZCQVJDR0FTT05BaUFCYWtILy93TnhKSTBDUVFBUWdRRkJBQkNDQVNPT0FrRUJha0gvL3dOeEpJNENRUXdQQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2lTT0FrRUVEd3NRZkVILy93TnhJNFVDRUgwampnSkJBbXBCLy84RGNTU09Ba0VFRHdzUWV4Q1lBUXdDQ3lPTkFrRUNhMEgvL3dOeElnRWtqUUlnQVNPT0FoQ0ZBVUVvSkk0Q1FRZ1BDMEYvRHdzampnSkJBV3BCLy84RGNTU09Ba0VFQzlZREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFnQUVIeEFXc09Ed0VDQXcwRUJRWUhDQWtLRFEwTERBMExFSHRCL3dGeFFZRCtBMm9RaHdGQi93RnhKSVVDREEwTEk0MENJZ0FRbmdGQi8vOERjU0VCSUFCQkFtcEIvLzhEY1NTTkFpQUJRWUQrQTNGQkNIVWtoUUlnQVVIL0FYRWtqQUlNRFFzamh3SkJnUDREYWhDSEFVSC9BWEVraFFJTURBdEJBQ1N5QVF3TEN5T05Ba0VDYTBILy93TnhJZ0VralFJZ0FTT01Ba0gvQVhFamhRSkIvd0Z4UVFoMGNoQ0ZBVUVJRHdzUWV4Q2FBUXdJQ3lPTkFrRUNhMEgvL3dOeElnRWtqUUlnQVNPT0FoQ0ZBVUV3Skk0Q1FRZ1BDeEI3UVJoMFFSaDFJUUVqalFJaEFFRUFFSUVCUVFBUWdnRWdBQ0FCUVFFUWhnRWdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NLQWlBQVFmOEJjU1NMQWlPT0FrRUJha0gvL3dOeEpJNENRUWdQQ3lPTEFrSC9BWEVqaWdKQi93RnhRUWgwY2lTTkFrRUlEd3NRZkVILy93TnhFSWNCUWY4QmNTU0ZBaU9PQWtFQ2FrSC8vd054Skk0Q0RBVUxRUUVrc3dFTUJBc1FleENiQVF3Q0N5T05Ba0VDYTBILy93TnhJZ0FralFJZ0FDT09BaENGQVVFNEpJNENRUWdQQzBGL0R3c2pqZ0pCQVdwQi8vOERjU1NPQWd0QkJBdmpBUUVCZnlPT0FrRUJha0gvL3dOeElRRWprZ0lFUUNBQlFRRnJRZi8vQTNFaEFRc2dBU1NPQWdKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRTSUJCRUFnQVVFQlJnMEJBa0FnQVVFQ2F3NE5Bd1FGQmdjSUNRb0xEQTBPRHdBTERBOExJQUFRaUFFUEN5QUFFSWtCRHdzZ0FCQ0tBUThMSUFBUWl3RVBDeUFBRUl3QkR3c2dBQkNOQVE4TElBQVFqZ0VQQ3lBQUVJOEJEd3NnQUJDVEFROExJQUFRbGdFUEN5QUFFSmtCRHdzZ0FCQ2NBUThMSUFBUXFRRVBDeUFBRUtvQkR3c2dBQkNyQVE4TElBQVFyQUVMdmdFQkFuOUJBQ1N5QVVHUC9nTVFBa0VCSUFCMFFYOXpjU0lCSkxvQlFZLytBeUFCRUFRampRSkJBbXRCLy84RGNTU05BaU9OQWlJQkk0NENJZ0pCL3dGeEVBUWdBVUVCYWlBQ1FZRCtBM0ZCQ0hVUUJBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09Bd01FQlFBTERBVUxRUUFrdXdGQndBQWtqZ0lNQkF0QkFDUzhBVUhJQUNTT0Fnd0RDMEVBSkwwQlFkQUFKSTRDREFJTFFRQWt2Z0ZCMkFBa2pnSU1BUXRCQUNTL0FVSGdBQ1NPQWdzTCtRRUJBMzhqc3dFRVFFRUJKTElCUVFBa3N3RUxJN1FCSTdvQmNVRWZjVUVBU2dSQUk1RUNSU095QVNJQ0lBSWJCSDhqdXdFanRRRWlBQ0FBR3dSL1FRQVFyZ0ZCQVFVanZBRWp0Z0VpQUNBQUd3Ui9RUUVRcmdGQkFRVWp2UUVqdHdFaUFDQUFHd1IvUVFJUXJnRkJBUVVqdmdFanVBRWlBQ0FBR3dSL1FRTVFyZ0ZCQVFVanZ3RWp1UUVpQUNBQUd3Ui9RUVFRcmdGQkFRVkJBQXNMQ3dzTEJVRUFDd1JBSTVBQ0lnQWprUUlnQUJzRWYwRUFKSkVDUVFBa2tBSkJBQ1NTQWtFQUpKTUNRUmdGUVJRTElRRUxJNUFDSWdBamtRSWdBQnNFUUVFQUpKRUNRUUFra0FKQkFDU1NBa0VBSkpNQ0N5QUJEd3RCQUF1N0FRRUNmMEVCSkowQ0k1SUNCRUFqamdJUUFrSC9BWEVRclFFUWVrRUFKSkVDUVFBa2tBSkJBQ1NTQWtFQUpKTUNDeEN2QVNJQVFRQktCRUFnQUJCNkMwRUVJUUVqa0FJaUFDT1JBaUFBRzBVaUFBUi9JNU1DUlFVZ0FBc0VRQ09PQWhBQ1FmOEJjUkN0QVNFQkN5T01Ba0h3QVhFa2pBSWdBVUVBVEFSQUlBRVBDeUFCRUhvam1RSkJBV29pQUNPWEFrNEVmeU9ZQWtFQmFpU1lBaUFBSTVjQ2F3VWdBQXNrbVFJampnSWoyQUZHQkVCQkFTVGJBUXNnQVFzRkFDT3dBUXZNQVFFRWZ5QUFRWDlCZ0FnZ0FFRUFTQnNnQUVFQVNoc2hBMEVBSVFBRFFBSi9BbjhnQkVVaUFRUkFJQUJGSVFFTElBRUxCRUFnQWtVaEFRc2dBUXNFUUNQYkFVVWhBUXNnQVFSQUVMQUJRUUJJQkVCQkFTRUVCU09QQWtIUXBBUWpoQUowVGdSQVFRRWhBQVVnQTBGL1NpSUJCRUFqc0FFZ0EwNGhBUXRCQVNBQ0lBRWJJUUlMQ3d3QkN3c2dBQVJBSTQ4Q1FkQ2tCQ09FQW5SckpJOENJNW9DRHdzZ0FnUkFJNXNDRHdzajJ3RUVRRUVBSk5zQkk1d0NEd3NqamdKQkFXdEIvLzhEY1NTT0FrRi9Dd2NBUVg4UXNnRUxPUUVEZndOQUlBSWdBRWdpQXdSL0lBRkJBRTRGSUFNTEJFQkJmeEN5QVNFQklBSkJBV29oQWd3QkN3c2dBVUVBU0FSQUlBRVBDMEVBQ3dVQUk1UUNDd1VBSTVVQ0N3VUFJNVlDQzE4QkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQUVRQ0FBSWdGQkFVWU5BUUpBSUFGQkFtc09CZ01FQlFZSENBQUxEQWdMSTgwQkR3c2owQUVQQ3lQT0FROExJODhCRHdzajBRRVBDeVBTQVE4TEk5TUJEd3NqMUFFUEMwRUFDNHNCQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBQ0lDUVFGR0RRRUNRQ0FDUVFKckRnWURCQVVHQndnQUN3d0lDeUFCUVFCSEpNMEJEQWNMSUFGQkFFY2swQUVNQmdzZ0FVRUFSeVRPQVF3RkN5QUJRUUJISk04QkRBUUxJQUZCQUVjazBRRU1Bd3NnQVVFQVJ5VFNBUXdDQ3lBQlFRQkhKTk1CREFFTElBRkJBRWNrMUFFTEMxVUJBWDlCQUNTVEFpQUFFTGdCUlFSQVFRRWhBUXNnQUVFQkVMa0JJQUVFUUVFQlFRRkJBRUVCUVFBZ0FFRURUQnNpQVNQV0FTSUFJQUFiR3lBQlJTUFhBU0lBSUFBYkd3UkFRUUVrdndGQkJCQS9Dd3NMQ1FBZ0FFRUFFTGtCQzVvQkFDQUFRUUJLQkVCQkFCQzZBUVZCQUJDN0FRc2dBVUVBU2dSQVFRRVF1Z0VGUVFFUXV3RUxJQUpCQUVvRVFFRUNFTG9CQlVFQ0VMc0JDeUFEUVFCS0JFQkJBeEM2QVFWQkF4QzdBUXNnQkVFQVNnUkFRUVFRdWdFRlFRUVF1d0VMSUFWQkFFb0VRRUVGRUxvQkJVRUZFTHNCQ3lBR1FRQktCRUJCQmhDNkFRVkJCaEM3QVFzZ0IwRUFTZ1JBUVFjUXVnRUZRUWNRdXdFTEN3Y0FJQUFrMkFFTEJ3QkJmeVRZQVFzSEFDQUFKTmtCQ3djQVFYOGsyUUVMQndBZ0FDVGFBUXNIQUVGL0pOb0JDd1VBSTRVQ0N3VUFJNFlDQ3dVQUk0Y0NDd1VBSTRnQ0N3VUFJNGtDQ3dVQUk0b0NDd1VBSTRzQ0N3VUFJNHdDQ3dVQUk0NENDd1VBSTQwQ0N3c0FJNDRDRUFKQi93RnhDd1VBSStnQkM4RURBUXAvUVlDQUFrR0FrQUlqNFFFYklRbEJnTGdDUVlDd0FpUGlBUnNoQ2dOQUlBWkJnQUpJQkVCQkFDRUZBMEFnQlVHQUFrZ0VRQ0FKSUFaQkEzVkJCWFFnQ21vZ0JVRURkV29pQTBHQWtINXFMUUFBRURJaENDQUdRUWh2SVFGQkJ5QUZRUWh2YXlFSFFRQWhBZ0ovSUFCQkFFb2pnd0lpQkNBRUd3UkFJQU5CZ05CK2FpMEFBQ0VDQ3lBQ1FjQUFjUXNFUUVFSElBRnJJUUVMUVFBaEJDQUJRUUYwSUFocUlnTkJnSkIrYWtFQlFRQWdBa0VJY1JzaUJFRUJjVUVOZEdvdEFBQWhDRUVBSVFFZ0EwR0JrSDVxSUFSQkFYRkJEWFJxTFFBQVFRRWdCM1J4QkVCQkFpRUJDeUFCUVFGcUlBRkJBU0FIZENBSWNSc2hBU0FHUVFoMElBVnFRUU5zSVFjZ0FFRUFTaU9EQWlJRElBTWJCRUFnQWtFSGNTQUJRUUFRTXlJQlFSOXhRUU4wSVFRZ0FVSGdCM0ZCQlhWQkEzUWhBeUFCUVlENEFYRkJDblZCQTNRaEFpQUhRWUNoQzJvaUFTQUVPZ0FBSUFGQkFXb2dBem9BQUNBQlFRSnFJQUk2QUFBRklBZEJnS0VMYWlJQ0lBRkJ4LzRERURRaUFVR0FnUHdIY1VFUWRUb0FBQ0FDUVFGcUlBRkJnUDREY1VFSWRUb0FBQ0FDUVFKcUlBRTZBQUFMSUFWQkFXb2hCUXdCQ3dzZ0JrRUJhaUVHREFFTEN3dmRBd0VNZndOQUlBTkJGMDVGQkVCQkFDRUNBMEFnQWtFZlNBUkFRUUZCQUNBQ1FROUtHeUVKSUFOQkQyc2dBeUFEUVE5S0cwRUVkQ0lISUFKQkQydHFJQUlnQjJvZ0FrRVBTaHNoQjBHQWtBSkJnSUFDSUFOQkQwb2JJUXRCeC80RElRcEJmeUVCUVg4aENFRUFJUVFEUUNBRVFRaElCRUJCQUNFQUEwQWdBRUVGU0FSQUlBQkJBM1FnQkdwQkFuUWlCVUdDL0FOcUVBSWdCMFlFUUNBRlFZUDhBMm9RQWlFR1FRRkJBQ0FHUVFoeFFRQkhJNE1DSTRNQ0d4c2dDVVlFUUVFSUlRUkJCU0VBSUFZaUNFRVFjUVIvUWNuK0F3VkJ5UDREQ3lFS0N3c2dBRUVCYWlFQURBRUxDeUFFUVFGcUlRUU1BUXNMSUFoQkFFZ2pnd0lpQmlBR0d3UkFRWUM0QWtHQXNBSWo0Z0ViSVFSQmZ5RUFRUUFoQVFOQUlBRkJJRWdFUUVFQUlRVURRQ0FGUVNCSUJFQWdCVUVGZENBRWFpQUJhaUlHUVlDUWZtb3RBQUFnQjBZRVFFRWdJUVVnQmlFQVFTQWhBUXNnQlVFQmFpRUZEQUVMQ3lBQlFRRnFJUUVNQVFzTElBQkJBRTRFZnlBQVFZRFFmbW90QUFBRlFYOExJUUVMUVFBaEFBTkFJQUJCQ0VnRVFDQUhJQXNnQ1VFQVFRY2dBQ0FDUVFOMElBTkJBM1FnQUdwQitBRkJnS0VYSUFvZ0FTQUlFRFVhSUFCQkFXb2hBQXdCQ3dzZ0FrRUJhaUVDREFFTEN5QURRUUZxSVFNTUFRc0xDNW9DQVFsL0EwQWdCRUVJVGtVRVFFRUFJUUVEUUNBQlFRVklCRUFnQVVFRGRDQUVha0VDZENJQVFZRDhBMm9RQWhvZ0FFR0IvQU5xRUFJYUlBQkJndndEYWhBQ0lRSkJBU0VGSStNQkJFQWdBa0VDYjBFQlJnUkFJQUpCQVdzaEFndEJBaUVGQ3lBQVFZUDhBMm9RQWlFR1FRQWhCMEVCUVFBZ0JrRUljVUVBUnlPREFpT0RBaHNiSVFkQnlQNERJUWhCeWY0RFFjaitBeUFHUVJCeEd5RUlRUUFoQUFOQUlBQWdCVWdFUUVFQUlRTURRQ0FEUVFoSUJFQWdBQ0FDYWtHQWdBSWdCMEVBUVFjZ0F5QUVRUU4wSUFGQkJIUWdBMm9nQUVFRGRHcEJ3QUJCZ0tFZ0lBaEJmeUFHRURVYUlBTkJBV29oQXd3QkN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFSQkFXb2hCQXdCQ3dzTEJRQWp3UUVMQlFBandnRUxCUUFqeFFFTEdBRUJmeVBIQVNFQUk4WUJCRUFnQUVFRWNpRUFDeUFBQ3pBQkFYOERRQUpBSUFCQi8vOERUZzBBSUFCQmdMWEpCR29nQUJCYk9nQUFJQUJCQVdvaEFBd0JDd3RCQUNUYkFRc1dBQkFBUHdCQmxBRklCRUJCbEFFL0FHdEFBQm9MQ3dNQUFRc2RBQUpBQWtBQ1FDT2VBZzRDQVFJQUN3QUxRUUFoQUFzZ0FCQ3lBUXNIQUNBQUpKNENDeVVBQWtBQ1FBSkFBa0FqbmdJT0F3RUNBd0FMQUF0QkFTRUFDMEYvSVFFTElBRVFzZ0VMQURNUWMyOTFjbU5sVFdGd2NHbHVaMVZTVENGamIzSmxMMlJwYzNRdlkyOXlaUzUxYm5SdmRXTm9aV1F1ZDJGemJTNXRZWEE9IikpLmluc3RhbmNlOwpjb25zdCBiPW5ldyBVaW50OEFycmF5KGEuZXhwb3J0cy5tZW1vcnkuYnVmZmVyKTtyZXR1cm57aW5zdGFuY2U6YSxieXRlTWVtb3J5OmIsdHlwZToiV2ViIEFzc2VtYmx5In19O2xldCByLHUsRSxjO2M9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9CT09UX1JPTV9MT0NBVElPTjowLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjowLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOjAsCldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU6MCxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTjowLHBhdXNlZDohMCx1cGRhdGVJZDp2b2lkIDAsdGltZVN0YW1wc1VudGlsUmVhZHk6MCxmcHNUaW1lU3RhbXBzOltdLHNwZWVkOjAsZnJhbWVTa2lwQ291bnRlcjowLGN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjooYSk9Pntjb25zdCBiPW4oYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPwooYy5ncmFwaGljc1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoSi5iaW5kKHZvaWQgMCxjKSxjLmdyYXBoaWNzV29ya2VyUG9ydCkpOiJNRU1PUlkiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLm1lbW9yeVdvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoTS5iaW5kKHZvaWQgMCxjKSxjLm1lbW9yeVdvcmtlclBvcnQpKToiQ09OVFJPTExFUiI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGMuY29udHJvbGxlcldvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoTC5iaW5kKHZvaWQgMCxjKSxjLmNvbnRyb2xsZXJXb3JrZXJQb3J0KSk6IkFVRElPIj09PWIubWVzc2FnZS53b3JrZXJJZCYmKGMuYXVkaW9Xb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEsuYmluZCh2b2lkIDAsYyksYy5hdWRpb1dvcmtlclBvcnQpKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLklOU1RBTlRJQVRFX1dBU006KGFzeW5jKCk9PntsZXQgYTthPWF3YWl0IFAocCk7CmMud2FzbUluc3RhbmNlPWEuaW5zdGFuY2U7Yy53YXNtQnl0ZU1lbW9yeT1hLmJ5dGVNZW1vcnk7ayhoKHt0eXBlOmEudHlwZX0sYi5tZXNzYWdlSWQpKX0pKCk7YnJlYWs7Y2FzZSBmLkNPTkZJRzpjLndhc21JbnN0YW5jZS5leHBvcnRzLmNvbmZpZy5hcHBseShjLGIubWVzc2FnZS5jb25maWcpO2Mub3B0aW9ucz1iLm1lc3NhZ2Uub3B0aW9ucztrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlJFU0VUX0FVRElPX1FVRVVFOmMud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUExBWTppZighYy5wYXVzZWR8fCFjLndhc21JbnN0YW5jZXx8IWMud2FzbUJ5dGVNZW1vcnkpe2soaCh7ZXJyb3I6ITB9LGIubWVzc2FnZUlkKSk7YnJlYWt9Yy5wYXVzZWQ9ITE7Yy5mcHNUaW1lU3RhbXBzPVtdO3coYyk7Yy5mcmFtZVNraXBDb3VudGVyPTA7Yy5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQowO2Mub3B0aW9ucy5pc0diY0NvbG9yaXphdGlvbkVuYWJsZWQ/Yy5vcHRpb25zLmdiY0NvbG9yaXphdGlvblBhbGV0dGUmJmMud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0TWFudWFsQ29sb3JpemF0aW9uUGFsZXR0ZSgid2FzbWJveWdiIGJyb3duIHJlZCBkYXJrYnJvd24gZ3JlZW4gZGFya2dyZWVuIGludmVydGVkIHBhc3RlbG1peCBvcmFuZ2UgeWVsbG93IGJsdWUgZGFya2JsdWUgZ3JheXNjYWxlIi5zcGxpdCgiICIpLmluZGV4T2YoYy5vcHRpb25zLmdiY0NvbG9yaXphdGlvblBhbGV0dGUudG9Mb3dlckNhc2UoKSkpOmMud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0TWFudWFsQ29sb3JpemF0aW9uUGFsZXR0ZSgwKTtGKGMsMUUzL2Mub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBBVVNFOmMucGF1c2VkPSEwO2MudXBkYXRlSWQmJihjbGVhclRpbWVvdXQoYy51cGRhdGVJZCksYy51cGRhdGVJZD12b2lkIDApO2soaCh2b2lkIDAsCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP2Mud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPTA7bGV0IGQ9Yy53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7Yi5tZXNzYWdlLnN0YXJ0JiYoYT1iLm1lc3NhZ2Uuc3RhcnQpO2IubWVzc2FnZS5lbmQmJihkPWIubWVzc2FnZS5lbmQpO2E9Yy53YXNtQnl0ZU1lbW9yeS5zbGljZShhLGQpLmJ1ZmZlcjtrKGgoe3R5cGU6Zi5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSBmLkdFVF9XQVNNX0NPTlNUQU5UOmsoaCh7dHlwZTpmLkdFVF9XQVNNX0NPTlNUQU5ULApyZXNwb25zZTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5GT1JDRV9PVVRQVVRfRlJBTUU6QyhjKTticmVhaztjYXNlIGYuU0VUX1NQRUVEOmMuc3BlZWQ9Yi5tZXNzYWdlLnNwZWVkO2MuZnBzVGltZVN0YW1wcz1bXTtjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTYwO3coYyk7Yy5mcmFtZVNraXBDb3VudGVyPTA7Yy5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCk7YnJlYWs7Y2FzZSBmLklTX0dCQzphPTA8Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5pc0dCQygpO2soaCh7dHlwZTpmLklTX0dCQyxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coIlVua25vd24gV2FzbUJveSBXb3JrZXIgbWVzc2FnZToiLGIpfX0sZ2V0RlBTOigpPT4wPGMudGltZVN0YW1wc1VudGlsUmVhZHk/CmMuc3BlZWQmJjA8Yy5zcGVlZD9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSpjLnNwZWVkOmMub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlOmMuZnBzVGltZVN0YW1wcz9jLmZwc1RpbWVTdGFtcHMubGVuZ3RoOjB9O3EoYy5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

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
var version = "0.3.7";
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
//# sourceMappingURL=wasmboy.wasm.cjs.js.map
