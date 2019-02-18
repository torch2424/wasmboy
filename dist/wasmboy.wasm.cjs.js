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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBIKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmFtZUluUHJvZ3Jlc3NWaWRlb091dHB1dExvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKX19ZnVuY3Rpb24gSShhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zb3VuZE91dHB1dExvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfMl9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF8zX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzRfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc291bmRPdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7CmJyZWFrO2Nhc2UgZi5BVURJT19MQVRFTkNZOmEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz1iLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gSihhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geihhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLAphLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04rZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQShhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIEsoYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhazsKY2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlTaXplLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpOwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCeXRlc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZVJhbUJhbmtzTG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlTG9jYXRpb24udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZVNpemUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlTG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5TRVRfTUVNT1JZOmQ9T2JqZWN0LmtleXMoYi5tZXNzYWdlKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSwKYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2QuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW2cuR0FNRUJPWV9NRU1PUlldKSxhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksCmEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5TRVRfTUVNT1JZX0RPTkV9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkdFVF9NRU1PUlk6e2Q9e3R5cGU6Zi5HRVRfTUVNT1JZfTtjb25zdCBsPVtdO3ZhciBjPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD1lJiYzPj1lP209MjA5NzE1Mjo1PD1lJiY2Pj1lP209MjYyMTQ0OjE1PD1lJiYxOT49ZT9tPTIwOTcxNTI6MjU8PWUmJjMwPj1lJiYobT04Mzg4NjA4KTtlPW0/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiwKYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbSk6bmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGU9eihhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmRbZy5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9QShhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT1jLGwucHVzaChjKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCxiLm1lc3NhZ2VJZCksbCl9fX1mdW5jdGlvbiBMKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpOwphLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB3KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEIoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gQyhhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUQtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0UoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEUoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRD1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksQyhhKSwhMDtMKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZDtjP3goYSxiKTooZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLApiKGQpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEIoYSk7Y29uc3QgZD17dHlwZTpmLlVQREFURUR9O2RbZy5DQVJUUklER0VfUkFNXT16KGEpLmJ1ZmZlcjtkW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5JTlRFUk5BTF9TVEFURV09QShhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChkKSxbZFtnLkNBUlRSSURHRV9SQU1dLGRbZy5HQU1FQk9ZX01FTU9SWV0sZFtnLlBBTEVUVEVfTUVNT1JZXSxkW2cuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/ayhoKHt0eXBlOmYuQlJFQUtQT0lOVH0pKTpDKGEpfWVsc2UgayhoKHt0eXBlOmYuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHgoYSxiKXt2YXIgZD0tMTtkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbygxMDI0KTsxIT09ZCYmYihkKTtpZigxPT09ZCl7ZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdldEF1ZGlvUXVldWVJbmRleCgpO2NvbnN0IGM9CnI+PXU7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmYz8oRihhLGQpLHNldFRpbWVvdXQoKCk9Pnt3KGEpO3goYSxiKX0sTWF0aC5mbG9vcihNYXRoLmZsb29yKDFFMyooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOihGKGEsZCkseChhLGIpKX19ZnVuY3Rpb24gRihhLGIpe3ZhciBkPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2NvbnN0IGM9e3R5cGU6Zi5VUERBVEVELGF1ZGlvQnVmZmVyOmQsbnVtYmVyT2ZTYW1wbGVzOmIsZnBzOnIsYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nOjYwPGEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlfTtkPVtkXTtpZihhLm9wdGlvbnMmJmEub3B0aW9ucy5lbmFibGVBdWRpb0RlYnVnZ2luZyl7dmFyIGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTiwKYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Yy5jaGFubmVsMUJ1ZmZlcj1lO2QucHVzaChlKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Yy5jaGFubmVsMkJ1ZmZlcj1lO2QucHVzaChlKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Yy5jaGFubmVsM0J1ZmZlcj1lO2QucHVzaChlKTtiPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT04rMipiKS5idWZmZXI7Yy5jaGFubmVsNEJ1ZmZlcj1iO2QucHVzaChiKX1hLmF1ZGlvV29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGMpLApkKTthLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpfWNvbnN0IHA9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgdjtwfHwodj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2NvbnN0IGY9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLEdFVF9NRU1PUlk6IkdFVF9NRU1PUlkiLFNFVF9NRU1PUlk6IlNFVF9NRU1PUlkiLFNFVF9NRU1PUllfRE9ORToiU0VUX01FTU9SWV9ET05FIixHRVRfQ09OU1RBTlRTOiJHRVRfQ09OU1RBTlRTIixHRVRfQ09OU1RBTlRTX0RPTkU6IkdFVF9DT05TVEFOVFNfRE9ORSIsQ09ORklHOiJDT05GSUciLFJFU0VUX0FVRElPX1FVRVVFOiJSRVNFVF9BVURJT19RVUVVRSIsUExBWToiUExBWSIsQlJFQUtQT0lOVDoiQlJFQUtQT0lOVCIsUEFVU0U6IlBBVVNFIiwKVVBEQVRFRDoiVVBEQVRFRCIsQ1JBU0hFRDoiQ1JBU0hFRCIsU0VUX0pPWVBBRF9TVEFURToiU0VUX0pPWVBBRF9TVEFURSIsQVVESU9fTEFURU5DWToiQVVESU9fTEFURU5DWSIsUlVOX1dBU01fRVhQT1JUOiJSVU5fV0FTTV9FWFBPUlQiLEdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOiJHRVRfV0FTTV9NRU1PUllfU0VDVElPTiIsR0VUX1dBU01fQ09OU1RBTlQ6IkdFVF9XQVNNX0NPTlNUQU5UIixGT1JDRV9PVVRQVVRfRlJBTUU6IkZPUkNFX09VVFBVVF9GUkFNRSIsU0VUX1NQRUVEOiJTRVRfU1BFRUQiLElTX0dCQzoiSVNfR0JDIn0sZz17Q0FSVFJJREdFX1JBTToiQ0FSVFJJREdFX1JBTSIsQ0FSVFJJREdFX1JPTToiQ0FSVFJJREdFX1JPTSIsQ0FSVFJJREdFX0hFQURFUjoiQ0FSVFJJREdFX0hFQURFUiIsR0FNRUJPWV9NRU1PUlk6IkdBTUVCT1lfTUVNT1JZIixQQUxFVFRFX01FTU9SWToiUEFMRVRURV9NRU1PUlkiLElOVEVSTkFMX1NUQVRFOiJJTlRFUk5BTF9TVEFURSJ9O2xldCB0PQowLE09e307Y29uc3QgeT17ZW52Ontsb2c6KGEsYixjLGYsZSxnLGgpPT57dmFyIGQ9KG5ldyBVaW50MzJBcnJheSh3YXNtSW5zdGFuY2UuZXhwb3J0cy5tZW1vcnkuYnVmZmVyLGEsMSkpWzBdO2E9U3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLG5ldyBVaW50MTZBcnJheSh3YXNtSW5zdGFuY2UuZXhwb3J0cy5tZW1vcnkuYnVmZmVyLGErNCxkKSk7LTk5OTkhPT1iJiYoYT1hLnJlcGxhY2UoIiQwIixiKSk7LTk5OTkhPT1jJiYoYT1hLnJlcGxhY2UoIiQxIixjKSk7LTk5OTkhPT1mJiYoYT1hLnJlcGxhY2UoIiQyIixmKSk7LTk5OTkhPT1lJiYoYT1hLnJlcGxhY2UoIiQzIixlKSk7LTk5OTkhPT1nJiYoYT1hLnJlcGxhY2UoIiQ0IixnKSk7LTk5OTkhPT1oJiYoYT1hLnJlcGxhY2UoIiQ1IixoKSk7Y29uc29sZS5sb2coIltXYXNtQm95XSAiK2EpfSxoZXhMb2c6KGEsYik9PntpZighTVthXSl7bGV0IGM9IltXYXNtQm95XSI7LTk5OTkhPT1hJiYoYys9YCAweCR7YS50b1N0cmluZygxNil9IGApOwotOTk5OSE9PWImJihjKz1gIDB4JHtiLnRvU3RyaW5nKDE2KX0gYCk7Y29uc29sZS5sb2coYyl9fX19LEc9YXN5bmMoYSk9PntsZXQgYj12b2lkIDA7cmV0dXJuIGI9V2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmc/YXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcoZmV0Y2goYSkseSk6YXdhaXQgKGFzeW5jKCk9Pntjb25zdCBiPWF3YWl0IGZldGNoKGEpLnRoZW4oKGEpPT5hLmFycmF5QnVmZmVyKCkpO3JldHVybiBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShiLHkpfSkoKX0sTj1hc3luYyhhKT0+e2E9QnVmZmVyLmZyb20oYS5zcGxpdCgiLCIpWzFdLCJiYXNlNjQiKTtyZXR1cm4gYXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYSx5KX0sTz1hc3luYyhhKT0+e2E9KGE/YXdhaXQgRygiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJpUUVTWUFwL2YzOS9mMzkvZjM5L0FHQUFBR0FCZndGL1lBSi9md0JnQVg4QVlBSi9md0YvWUFBQmYyQURmMzkvQUdBR2YzOS9mMzkvQUdBSGYzOS9mMzkvZndGL1lBTi9mMzhCZjJBSGYzOS9mMzkvZndCZ0JIOS9mMzhCZjJBSWYzOS9mMzkvZjM4QVlBVi9mMzkvZndGL1lBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0FBQmdBWDhCZndQWkFkY0JBZ0lCQVFNQkFRRUJBUUVCQVFFRUJBRUJBUUFHQVFFQkFRRUJBUUVFQkFFQkFRRUJBUUVCQmdZR0JnNEZDZ29QQ1FzSUNBY0hBd1FCQVFRQkJBRUJBUUVCQWdJRkFnSUNBZ1VNQkFRRUFRSUdBZ0lEQkFRRUJBRUJBUUVFQlFRR0JnUURBZ1VFQVJBRUJRTUhBUVVCQkFFRkJBUUdCZ01GQkFNRUJBUURBd2NDQWdJRUFnSUNBZ0lDQWdNRUJBSUVCQUlFQkFJRUJBSUNBZ0lDQWdJQ0FnSUNCUUlDQWdJQ0FnUUdCZ1lSQmdJR0JnWUNBd1FFRFFRQkJBRUVBUVlHQmdZR0JnWUdCZ1lHQmdRQkFRWUdCZ1lCQVFFQ0JBVUVCQUZ3QUFFRkF3RUFBQWFyREo0Q2Z3QkJBQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUVBdC9BRUdBZ0FFTGZ3QkJnSkFCQzM4QVFZQ0FBZ3QvQUVHQWtBTUxmd0JCZ0lBQkMzOEFRWUFRQzM4QVFZQ0FCQXQvQUVHQWtBUUxmd0JCZ0FFTGZ3QkJnSkVFQzM4QVFZQzRBUXQvQUVHQXlRVUxmd0JCZ05nRkMzOEFRWUNoQ3d0L0FFR0FnQXdMZndCQmdLRVhDMzhBUVlDQUNRdC9BRUdBb1NBTGZ3QkJnUGdBQzM4QVFZQ1FCQXQvQUVHQWlSMExmd0JCZ0praEMzOEFRWUNBQ0F0L0FFR0FtU2tMZndCQmdJQUlDMzhBUVlDWk1RdC9BRUdBZ0FnTGZ3QkJnSms1QzM4QVFZQ0FDQXQvQUVHQW1jRUFDMzhBUVlDQUNBdC9BRUdBbWNrQUMzOEFRWUNBQ0F0L0FFR0FtZEVBQzM4QVFZQ0krQU1MZndCQmdLSEpCQXQvQUVILy93TUxmd0JCQUF0L0FFR0FvYzBFQzM4QVFaUUJDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhQL2dNTGZ3RkJBQXQvQVVIdy9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCL3dBTGZ3RkIvd0FMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCZ0tqV3VRY0xmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJnUGNDQzM4QlFZQ0FDQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCMWY0REMzOEJRZEgrQXd0L0FVSFMvZ01MZndGQjAvNERDMzhCUWRUK0F3dC9BVUhvL2dNTGZ3RkI2LzREQzM4QlFlbitBd3QvQVVGL0MzOEJRUUFMZndGQkFRdC9BVUVDQzM4QVFZQ2h6UVFMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQkFMZndCQmdJQUVDMzhBUVlDUUJBdC9BRUdBa0FRTGZ3QkJnQUVMZndCQmdNa0ZDMzhBUVlDaEN3dC9BRUdBb1JjTGZ3QkJnSm5CQUF0L0FFR0FtY2tBQzM4QVFZQ1owUUFMZndGQkFBc0hxaE53Qm0xbGJXOXllUUlBQlhSaFlteGxBUUFHWTI5dVptbG5BQk1PYUdGelEyOXlaVk4wWVhKMFpXUUFGQWx6WVhabFUzUmhkR1VBR3dsc2IyRmtVM1JoZEdVQUpnVnBjMGRDUXdBbkVtZGxkRk4wWlhCelVHVnlVM1JsY0ZObGRBQW9DMmRsZEZOMFpYQlRaWFJ6QUNrSVoyVjBVM1JsY0hNQUtoVmxlR1ZqZFhSbFRYVnNkR2x3YkdWR2NtRnRaWE1BcndFTVpYaGxZM1YwWlVaeVlXMWxBSzRCQ0Y5elpYUmhjbWRqQU5VQkdXVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVc4QTFBRVZaWGhsWTNWMFpWVnVkR2xzUTI5dVpHbDBhVzl1QU5ZQkMyVjRaV04xZEdWVGRHVndBS3NCRkdkbGRFTjVZMnhsYzFCbGNrTjVZMnhsVTJWMEFMQUJER2RsZEVONVkyeGxVMlYwY3dDeEFRbG5aWFJEZVdOc1pYTUFzZ0VPYzJWMFNtOTVjR0ZrVTNSaGRHVUF0d0VmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnQ3NBUkJqYkdWaGNrRjFaR2x2UW5WbVptVnlBQ0lYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERLaE5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXlzU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF5d2VRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdBYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREFSWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdJU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3TWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RENoeEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd3NTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdRT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQlJGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNR0RWZFBVa3RmVWtGTlgxTkpXa1VEQnlaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTUlJazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURDUmhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNERHQlJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNWkZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9Bd3dRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1OR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01PRkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF3OE9SbEpCVFVWZlRFOURRVlJKVDA0REVBcEdVa0ZOUlY5VFNWcEZBeEVYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERFaE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhNU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4UU9WRWxNUlY5RVFWUkJYMU5KV2tVREZSSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERGZzVQUVUxZlZFbE1SVk5mVTBsYVJRTVhGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNaUVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF5TVpRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWFGVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZVMGxhUlFNYkdVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlRFOURRVlJKVDA0REhCVkRTRUZPVGtWTVh6SmZRbFZHUmtWU1gxTkpXa1VESFJsRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXg0VlEwaEJUazVGVEY4elgwSlZSa1pGVWw5VFNWcEZBeDhaUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01nRlVOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVTBsYVJRTWhGa05CVWxSU1NVUkhSVjlTUVUxZlRFOURRVlJKVDA0REpCSkRRVkpVVWtsRVIwVmZVa0ZOWDFOSldrVURKUlpEUVZKVVVrbEVSMFZmVWs5TlgweFBRMEZVU1U5T0F5WVNRMEZTVkZKSlJFZEZYMUpQVFY5VFNWcEZBeWNkUkVWQ1ZVZGZSMEZOUlVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0REtCbEVSVUpWUjE5SFFVMUZRazlaWDAxRlRVOVNXVjlUU1ZwRkF5a2haMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBQWJjMlYwVUhKdlozSmhiVU52ZFc1MFpYSkNjbVZoYTNCdmFXNTBBTGdCSFhKbGMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFMa0JHWE5sZEZKbFlXUkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUF1Z0ViY21WelpYUlNaV0ZrUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUxzQkduTmxkRmR5YVhSbFIySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFMd0JISEpsYzJWMFYzSnBkR1ZIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBdlFFTVoyVjBVbVZuYVhOMFpYSkJBTDRCREdkbGRGSmxaMmx6ZEdWeVFnQy9BUXhuWlhSU1pXZHBjM1JsY2tNQXdBRU1aMlYwVW1WbmFYTjBaWEpFQU1FQkRHZGxkRkpsWjJsemRHVnlSUURDQVF4blpYUlNaV2RwYzNSbGNrZ0F3d0VNWjJWMFVtVm5hWE4wWlhKTUFNUUJER2RsZEZKbFoybHpkR1Z5UmdERkFSRm5aWFJRY205bmNtRnRRMjkxYm5SbGNnREdBUTluWlhSVGRHRmphMUJ2YVc1MFpYSUF4d0VaWjJWMFQzQmpiMlJsUVhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0RJQVFWblpYUk1XUURKQVIxa2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVRREtBUmhrY21GM1ZHbHNaVVJoZEdGVWIxZGhjMjFOWlcxdmNua0F5d0VUWkhKaGQwOWhiVlJ2VjJGemJVMWxiVzl5ZVFETUFRWm5aWFJFU1ZZQXpRRUhaMlYwVkVsTlFRRE9BUVpuWlhSVVRVRUF6d0VHWjJWMFZFRkRBTkFCRTNWd1pHRjBaVVJsWW5WblIwSk5aVzF2Y25rQTBRRUdkWEJrWVhSbEFLNEJEV1Z0ZFd4aGRHbHZibE4wWlhBQXF3RVNaMlYwUVhWa2FXOVJkV1YxWlVsdVpHVjRBS3dCRDNKbGMyVjBRWFZrYVc5UmRXVjFaUUFpRG5kaGMyMU5aVzF2Y25sVGFYcGxBNDhDSEhkaGMyMUNiM2xKYm5SbGNtNWhiRk4wWVhSbFRHOWpZWFJwYjI0RGtBSVlkMkZ6YlVKdmVVbHVkR1Z5Ym1Gc1UzUmhkR1ZUYVhwbEE1RUNIV2RoYldWQ2IzbEpiblJsY201aGJFMWxiVzl5ZVV4dlkyRjBhVzl1QTVJQ0dXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVk5wZW1VRGt3SVRkbWxrWlc5UGRYUndkWFJNYjJOaGRHbHZiZ09VQWlKbWNtRnRaVWx1VUhKdlozSmxjM05XYVdSbGIwOTFkSEIxZEV4dlkyRjBhVzl1QTVjQ0cyZGhiV1ZpYjNsRGIyeHZjbEJoYkdWMGRHVk1iMk5oZEdsdmJnT1ZBaGRuWVcxbFltOTVRMjlzYjNKUVlXeGxkSFJsVTJsNlpRT1dBaFZpWVdOclozSnZkVzVrVFdGd1RHOWpZWFJwYjI0RG1BSUxkR2xzWlVSaGRHRk5ZWEFEbVFJVGMyOTFibVJQZFhSd2RYUk1iMk5oZEdsdmJnT2FBaEZuWVcxbFFubDBaWE5NYjJOaGRHbHZiZ09jQWhSbllXMWxVbUZ0UW1GdWEzTk1iMk5oZEdsdmJnT2JBZ2dDMGdFSkNBRUFRUUFMQWRNQkNxVGJBZGNCendFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUNBQVFReDFJZ0ZGRFFBQ1FDQUJRUUZyRGcwQkFRRUNBZ0lDQXdNRUJBVUdBQXNNQmdzZ0FFR0FtZEVBYWc4TElBQkJBU000SWdBak9VVWlBUVIvSUFCRkJTQUJDeHRCRG5ScVFZQ1owQUJxRHdzZ0FFR0FrSDVxSXpvRWZ5TTdFQUZCQVhFRlFRQUxRUTEwYWc4TElBQWpQRUVOZEdwQmdObkdBR29QQ3lBQVFZQ1FmbW9QQzBFQUlRRUNmeU02QkVBalBSQUJRUWR4SVFFTElBRkJBVWdMQkVCQkFTRUJDeUFCUVF4MElBQnFRWUR3ZldvUEN5QUFRWUJRYWdzSkFDQUFFQUF0QUFBTG1RRUFRUUFrUGtFQUpEOUJBQ1JBUVFBa1FVRUFKRUpCQUNSRFFRQWtSRUVBSkVWQkFDUkdRUUFrUjBFQUpFaEJBQ1JKUVFBa1NrRUFKRXRCQUNSTVFRQWtUU002QkVCQkVTUS9RWUFCSkVaQkFDUkFRUUFrUVVIL0FTUkNRZFlBSkVOQkFDUkVRUTBrUlFWQkFTUS9RYkFCSkVaQkFDUkFRUk1rUVVFQUpFSkIyQUVrUTBFQkpFUkJ6UUFrUlF0QmdBSWtTRUgrL3dNa1J3dWtBUUVDZjBFQUpFNUJBU1JQUWNjQ0VBRWhBVUVBSkZCQkFDUlJRUUFrVWtFQUpGTkJBQ1E1SUFFRVFDQUJRUUZPSWdBRVFDQUJRUU5NSVFBTElBQUVRRUVCSkZFRklBRkJCVTRpQUFSQUlBRkJCa3doQUFzZ0FBUkFRUUVrVWdVZ0FVRVBUaUlBQkVBZ0FVRVRUQ0VBQ3lBQUJFQkJBU1JUQlNBQlFSbE9JZ0FFUUNBQlFSNU1JUUFMSUFBRVFFRUJKRGtMQ3dzTEJVRUJKRkFMUVFFa09FRUFKRHdMQ3dBZ0FCQUFJQUU2QUFBTEx3QkIwZjREUWY4QkVBUkIwdjREUWY4QkVBUkIwLzREUWY4QkVBUkIxUDREUWY4QkVBUkIxZjREUWY4QkVBUUxtQUVBUVFBa1ZFRUFKRlZCQUNSV1FRQWtWMEVBSkZoQkFDUlpRUUFrV2lNNkJFQkJrQUVrVmtIQS9nTkJrUUVRQkVIQi9nTkJnUUVRQkVIRS9nTkJrQUVRQkVISC9nTkIvQUVRQkFWQmtBRWtWa0hBL2dOQmtRRVFCRUhCL2dOQmhRRVFCRUhHL2dOQi93RVFCRUhIL2dOQi9BRVFCRUhJL2dOQi93RVFCRUhKL2dOQi93RVFCQXRCei80RFFRQVFCRUh3L2dOQkFSQUVDMDhBSXpvRVFFSG8vZ05Cd0FFUUJFSHAvZ05CL3dFUUJFSHEvZ05Cd1FFUUJFSHIvZ05CRFJBRUJVSG8vZ05CL3dFUUJFSHAvZ05CL3dFUUJFSHEvZ05CL3dFUUJFSHIvZ05CL3dFUUJBc0xMd0JCa1A0RFFZQUJFQVJCa2Y0RFFiOEJFQVJCa3Y0RFFmTUJFQVJCay80RFFjRUJFQVJCbFA0RFFiOEJFQVFMTEFCQmxmNERRZjhCRUFSQmx2NERRVDhRQkVHWC9nTkJBQkFFUVpqK0EwRUFFQVJCbWY0RFFiZ0JFQVFMTWdCQm12NERRZjhBRUFSQm0vNERRZjhCRUFSQm5QNERRWjhCRUFSQm5mNERRUUFRQkVHZS9nTkJ1QUVRQkVFQkpHc0xMUUJCbi80RFFmOEJFQVJCb1A0RFFmOEJFQVJCb2Y0RFFRQVFCRUdpL2dOQkFCQUVRYVArQTBHL0FSQUVDemdBUVE4a2JFRVBKRzFCRHlSdVFROGtiMEVBSkhCQkFDUnhRUUFrY2tFQUpITkIvd0FrZEVIL0FDUjFRUUVrZGtFQkpIZEJBQ1I0QzJjQVFRQWtXMEVBSkZ4QkFDUmRRUUVrWGtFQkpGOUJBU1JnUVFFa1lVRUJKR0pCQVNSalFRRWtaRUVCSkdWQkFTUm1RUUFrWjBFQUpHaEJBQ1JwUVFBa2FoQUlFQWtRQ2hBTFFhVCtBMEgzQUJBRVFhWCtBMEh6QVJBRVFhYitBMEh4QVJBRUVBd0xPQUFnQUVFQmNVRUFSeVI1SUFCQkFuRkJBRWNrZWlBQVFRUnhRUUJISkhzZ0FFRUljVUVBUnlSOElBQkJFSEZCQUVja2ZTQUFKSDRMUFFBZ0FFRUJjVUVBUnlSL0lBQkJBbkZCQUVja2dBRWdBRUVFY1VFQVJ5U0JBU0FBUVFoeFFRQkhKSUlCSUFCQkVIRkJBRWNrZ3dFZ0FDU0VBUXRkQUVFQUpJVUJRUUFraGdGQkFDU0hBVUVBSklnQlFRQWtpUUZCQUNTS0FVRUFKSXNCUVFBa2pBRWpPZ1JBUVlUK0EwRWVFQVJCb0Qwa2hnRUZRWVQrQTBHckFSQUVRY3pYQWlTR0FRdEJoLzREUWZnQkVBUkIrQUVraWdFTFFnQkJBQ1NOQVVFQUpJNEJJem9FUUVHQy9nTkIvQUFRQkVFQUpJOEJRUUFra0FGQkFDU1JBUVZCZ3Y0RFFmNEFFQVJCQUNTUEFVRUJKSkFCUVFBa2tRRUxDL1lCQVFKL1FjTUNFQUVpQVVIQUFVWWlBQVIvSUFBRklBRkJnQUZHSXk4aUFDQUFHd3NFUUVFQkpEb0ZRUUFrT2dzUUFoQURFQVVRQmhBSEVBMUJBQkFPUWYvL0F5TitFQVJCNFFFUUQwR1AvZ01qaEFFUUJCQVFFQkVqT2dSQVFmRCtBMEg0QVJBRVFjLytBMEgrQVJBRVFjMytBMEgrQUJBRVFZRCtBMEhQQVJBRVFZLytBMEhoQVJBRVFleitBMEgrQVJBRVFmWCtBMEdQQVJBRUJVSHcvZ05CL3dFUUJFSFAvZ05CL3dFUUJFSE4vZ05CL3dFUUJFR0EvZ05CendFUUJFR1AvZ05CNFFFUUJBdEJBQ1F0UVlDbzFya0hKSklCUVFBa2t3RkJBQ1NVQVVHQXFOYTVCeVNWQVVFQUpKWUJRUUFrbHdFTHJnRUFJQUJCQUVvRVFFRUJKQzRGUVFBa0xnc2dBVUVBU2dSQVFRRWtMd1ZCQUNRdkN5QUNRUUJLQkVCQkFTUXdCVUVBSkRBTElBTkJBRW9FUUVFQkpERUZRUUFrTVFzZ0JFRUFTZ1JBUVFFa01nVkJBQ1F5Q3lBRlFRQktCRUJCQVNRekJVRUFKRE1MSUFaQkFFb0VRRUVCSkRRRlFRQWtOQXNnQjBFQVNnUkFRUUVrTlFWQkFDUTFDeUFJUVFCS0JFQkJBU1EyQlVFQUpEWUxJQWxCQUVvRVFFRUJKRGNGUVFBa053c1FFZ3NNQUNNdEJFQkJBUThMUVFBTHNnRUFRWUFJSXo4NkFBQkJnUWdqUURvQUFFR0NDQ05CT2dBQVFZTUlJMEk2QUFCQmhBZ2pRem9BQUVHRkNDTkVPZ0FBUVlZSUkwVTZBQUJCaHdnalJqb0FBRUdJQ0NOSE93RUFRWW9JSTBnN0FRQkJqQWdqU1RZQ0FDTktCRUJCa1FoQkFUb0FBQVZCa1FoQkFEb0FBQXNqU3dSQVFaSUlRUUU2QUFBRlFaSUlRUUE2QUFBTEkwd0VRRUdUQ0VFQk9nQUFCVUdUQ0VFQU9nQUFDeU5OQkVCQmxBaEJBVG9BQUFWQmxBaEJBRG9BQUFzTHJBRUFRY2dKSXpnN0FRQkJ5Z2tqUERzQkFDTk9CRUJCekFsQkFUb0FBQVZCekFsQkFEb0FBQXNqVHdSQVFjMEpRUUU2QUFBRlFjMEpRUUE2QUFBTEkxQUVRRUhPQ1VFQk9nQUFCVUhPQ1VFQU9nQUFDeU5SQkVCQnp3bEJBVG9BQUFWQnp3bEJBRG9BQUFzalVnUkFRZEFKUVFFNkFBQUZRZEFKUVFBNkFBQUxJMU1FUUVIUkNVRUJPZ0FBQlVIUkNVRUFPZ0FBQ3lNNUJFQkIwZ2xCQVRvQUFBVkIwZ2xCQURvQUFBc0xTd0JCK2dramhRRTJBZ0JCL2dramhnRTJBZ0FqaXdFRVFFR0NDa0VCT2dBQUJVR0NDa0VBT2dBQUN5T01BUVJBUVlVS1FRRTZBQUFGUVlVS1FRQTZBQUFMUVlYK0F5T0hBUkFFQzNnQUk1c0JCRUJCM2dwQkFUb0FBQVZCM2dwQkFEb0FBQXRCM3dvam5BRTJBZ0JCNHdvam5RRTJBZ0JCNXdvam5nRTJBZ0JCN0Fvam53RTJBZ0JCOFFvam9BRTZBQUJCOGdvam9RRTZBQUFqb2dFRVFFSDNDa0VCT2dBQUJVSDNDa0VBT2dBQUMwSDRDaU9qQVRZQ0FFSDlDaU9rQVRzQkFBdFBBQ09sQVFSQVFaQUxRUUU2QUFBRlFaQUxRUUE2QUFBTFFaRUxJNllCTmdJQVFaVUxJNmNCTmdJQVFaa0xJNmdCTmdJQVFaNExJNmtCTmdJQVFhTUxJNm9CT2dBQVFhUUxJNnNCT2dBQUMwWUFJN0FCQkVCQjlBdEJBVG9BQUFWQjlBdEJBRG9BQUF0QjlRc2pzUUUyQWdCQitRc2pzZ0UyQWdCQi9Rc2pzd0UyQWdCQmdnd2p0QUUyQWdCQmh3d2p0UUU3QVFBTG93RUFFQlZCc2dnalZUWUNBRUcyQ0NPWUFUb0FBRUhFL2dNalZoQUVJNWtCQkVCQjVBaEJBVG9BQUFWQjVBaEJBRG9BQUFzam1nRUVRRUhsQ0VFQk9nQUFCVUhsQ0VFQU9nQUFDeEFXRUJkQnJBb2paellDQUVHd0NpTm9PZ0FBUWJFS0kyazZBQUFRR0JBWkk2d0JCRUJCd2d0QkFUb0FBQVZCd2d0QkFEb0FBQXRCd3dzanJRRTJBZ0JCeHdzanJnRTJBZ0JCeXdzanJ3RTdBUUFRR2tFQUpDMExyZ0VBUVlBSUxRQUFKRDlCZ1FndEFBQWtRRUdDQ0MwQUFDUkJRWU1JTFFBQUpFSkJoQWd0QUFBa1EwR0ZDQzBBQUNSRVFZWUlMUUFBSkVWQmh3Z3RBQUFrUmtHSUNDOEJBQ1JIUVlvSUx3RUFKRWhCakFnb0FnQWtTUUovUVFGQmtRZ3RBQUJCQUVvTkFCcEJBQXNrU2dKL1FRRkJrZ2d0QUFCQkFFb05BQnBCQUFza1N3Si9RUUZCa3dndEFBQkJBRW9OQUJwQkFBc2tUQUovUVFGQmxBZ3RBQUJCQUVvTkFCcEJBQXNrVFF0Y0FRRi9RUUFrVlVFQUpGWkJ4UDREUVFBUUJFSEIvZ01RQVVGOGNTRUJRUUFrbUFGQndmNERJQUVRQkNBQUJFQUNRRUVBSVFBRFFDQUFRWUNKSFU0TkFTQUFRWUNRQkdwQi93RTZBQUFnQUVFQmFpRUFEQUFBQ3dBTEN3dUlBUUVCZnlPMkFTRUJJQUJCZ0FGeFFRQkhKTFlCSUFCQndBQnhRUUJISkxjQklBQkJJSEZCQUVja3VBRWdBRUVRY1VFQVJ5UzVBU0FBUVFoeFFRQkhKTG9CSUFCQkJIRkJBRWNrdXdFZ0FFRUNjVUVBUnlTOEFTQUFRUUZ4UVFCSEpMMEJJN1lCUlNBQklBRWJCRUJCQVJBZEN5QUJSU0lBQkg4anRnRUZJQUFMQkVCQkFCQWRDd3MrQUFKL1FRRkI1QWd0QUFCQkFFb05BQnBCQUFza21RRUNmMEVCUWVVSUxRQUFRUUJLRFFBYVFRQUxKSm9CUWYvL0F4QUJFQTVCai80REVBRVFEd3VsQVFCQnlBa3ZBUUFrT0VIS0NTOEJBQ1E4QW45QkFVSE1DUzBBQUVFQVNnMEFHa0VBQ3lST0FuOUJBVUhOQ1MwQUFFRUFTZzBBR2tFQUN5UlBBbjlCQVVIT0NTMEFBRUVBU2cwQUdrRUFDeVJRQW45QkFVSFBDUzBBQUVFQVNnMEFHa0VBQ3lSUkFuOUJBVUhRQ1MwQUFFRUFTZzBBR2tFQUN5UlNBbjlCQVVIUkNTMEFBRUVBU2cwQUdrRUFDeVJUQW45QkFVSFNDUzBBQUVFQVNnMEFHa0VBQ3lRNUMxc0FRZm9KS0FJQUpJVUJRZjRKS0FJQUpJWUJBbjlCQVVHQ0NpMEFBRUVBU2cwQUdrRUFDeVNMQVFKL1FRRkJoUW90QUFCQkFFb05BQnBCQUFza2pBRkJoZjRERUFFa2h3RkJodjRERUFFa2lBRkJoLzRERUFFa2lnRUxCZ0JCQUNScUMzWUFBbjlCQVVIZUNpMEFBRUVBU2cwQUdrRUFDeVNiQVVIZkNpZ0NBQ1NjQVVIakNpZ0NBQ1NkQVVIbkNpZ0NBQ1NlQVVIc0NpZ0NBQ1NmQVVIeENpMEFBQ1NnQVVIeUNpMEFBQ1NoQVFKL1FRRkI5d290QUFCQkFFb05BQnBCQUFza29nRkIrQW9vQWdBa293RkIvUW92QVFBa3BBRUxUZ0FDZjBFQlFaQUxMUUFBUVFCS0RRQWFRUUFMSktVQlFaRUxLQUlBSktZQlFaVUxLQUlBSktjQlFaa0xLQUlBSktnQlFaNExLQUlBSktrQlFhTUxMUUFBSktvQlFhUUxMUUFBSktzQkMwVUFBbjlCQVVIMEN5MEFBRUVBU2cwQUdrRUFDeVN3QVVIMUN5Z0NBQ1N4QVVINUN5Z0NBQ1N5QVVIOUN5Z0NBQ1N6QVVHQ0RDZ0NBQ1MwQVVHSERDOEJBQ1MxQVF2UUFRRUJmeEFjUWJJSUtBSUFKRlZCdGdndEFBQWttQUZCeFA0REVBRWtWa0hBL2dNUUFSQWVFQjlCZ1A0REVBRkIvd0Z6Skw0Qkk3NEJJZ0JCRUhGQkFFY2t2d0VnQUVFZ2NVRUFSeVRBQVJBZ0VDRkJyQW9vQWdBa1owR3dDaTBBQUNSb1FiRUtMUUFBSkdsQkFDUnFFQ01RSkFKL1FRRkJ3Z3N0QUFCQkFFb05BQnBCQUFza3JBRkJ3d3NvQWdBa3JRRkJ4d3NvQWdBa3JnRkJ5d3N2QVFBa3J3RVFKVUVBSkMxQmdLald1UWNra2dGQkFDU1RBVUVBSkpRQlFZQ28xcmtISkpVQlFRQWtsZ0ZCQUNTWEFRc01BQ002QkVCQkFROExRUUFMQlFBamxRRUxCUUFqbGdFTEJRQWpsd0VMMkFJQkJYOENmd0ovSUFGQkFFb2lCUVJBSUFCQkNFb2hCUXNnQlFzRVFDUERBU0FFUmlFRkN5QUZDd1IvSThRQklBQkdCU0FGQ3dSQVFRQWhCVUVBSVFRZ0EwRUJheEFCUVNCeEJFQkJBU0VGQ3lBREVBRkJJSEVFUUVFQklRUUxRUUFoQXdOQUlBTkJDRWdFUUVFSElBTnJJQU1nQkNBRlJ4c2lBeUFBYWtHZ0FVd0VRQ0FBUVFnZ0EydHJJUWNnQUNBRGFpQUJRYUFCYkdwQkEyeEJnTWtGYWlFSlFRQWhCZ05BSUFaQkEwZ0VRQ0FBSUFOcUlBRkJvQUZzYWtFRGJFR0F5UVZxSUFacUlBWWdDV290QUFBNkFBQWdCa0VCYWlFR0RBRUxDeUFBSUFOcUlBRkJvQUZzYWtHQWtRUnFJQUZCb0FGc0lBZHFRWUNSQkdvdEFBQWlCa0VEY1NJSFFRUnlJQWNnQmtFRWNSczZBQUFnQ0VFQmFpRUlDeUFEUVFGcUlRTU1BUXNMQlNBRUpNTUJDeUFBSThRQlRnUkFJQUJCQ0dva3hBRWdBQ0FDUVFodklnUklCRUFqeEFFZ0JHb2t4QUVMQ3lBSUN6Z0JBWDhnQUVHQWtBSkdCRUFnQVVHQUFXb2hBaUFCUVlBQmNRUkFJQUZCZ0FGcklRSUxJQUpCQkhRZ0FHb1BDeUFCUVFSMElBQnFDMG9BSUFCQkEzUWdBVUVCZEdvaUFFRUJha0UvY1NJQlFVQnJJQUVnQWh0QmdKQUVhaTBBQUNFQklBQkJQM0VpQUVGQWF5QUFJQUliUVlDUUJHb3RBQUFnQVVIL0FYRkJDSFJ5QzFFQUlBSkZCRUFnQVJBQklBQkJBWFIxUVFOeElRQUxRZklCSVFFQ1FDQUFSUTBBQWtBQ1FBSkFBa0FnQUVFQmF3NERBUUlEQUFzTUF3dEJvQUVoQVF3Q0MwSFlBQ0VCREFFTFFRZ2hBUXNnQVF1TEF3RUdmeUFCSUFBUUxDQUZRUUYwYWlJQVFZQ1FmbW9nQWtFQmNVRU5kQ0lCYWkwQUFDRVJJQUJCZ1pCK2FpQUJhaTBBQUNFU0lBTWhBQU5BSUFBZ0JFd0VRQ0FBSUFOcklBWnFJZzRnQ0VnRVFFRUhJQUJySVFVZ0MwRUFTQ0lDQkg4Z0FnVWdDMEVnY1VVTElRRkJBQ0VDQW45QkFTQUZJQUFnQVJzaUFYUWdFbkVFUUVFQ0lRSUxJQUpCQVdvTElBSkJBU0FCZENBUmNSc2hBaU02Qkg4Z0MwRUFUaUlCQkg4Z0FRVWdERUVBVGdzRkl6b0xCSDhnQzBFSGNTRUZJQXhCQUU0aUFRUkFJQXhCQjNFaEJRc2dCU0FDSUFFUUxTSUZRUjl4UVFOMElROGdCVUhnQjNGQkJYVkJBM1FoQVNBRlFZRDRBWEZCQ25WQkEzUUZJQUpCeC80RElBb2dDa0VBVEJzaUNrRUFFQzRpQlNFUElBVWlBUXNoQlNBSElBaHNJQTVxUVFOc0lBbHFJaEFnRHpvQUFDQVFRUUZxSUFFNkFBQWdFRUVDYWlBRk9nQUFJQWRCb0FGc0lBNXFRWUNSQkdvZ0FrRURjU0lCUVFSeUlBRWdDMEdBQVhGQkFFZEJBQ0FMUVFCT0d4czZBQUFnRFVFQmFpRU5DeUFBUVFGcUlRQU1BUXNMSUEwTGdBRUJBMzhnQTBFSWJ5RURJQUJGQkVBZ0FpQUNRUWh0UVFOMGF5RUhDMEdnQVNBQWEwRUhJQUJCQ0dwQm9BRktHeUVKUVg4aEFpTTZCRUFnQkVHQTBINXFMUUFBSWdKQkNIRUVRRUVCSVFnTElBSkJ3QUJ4QkVCQkJ5QURheUVEQ3dzZ0JpQUZJQWdnQnlBSklBTWdBQ0FCUWFBQlFZREpCVUVBSUFKQmZ4QXZDNllDQUNBRklBWVFMQ0VHSUFOQkNHOGhBeUFFUVlEUWZtb3RBQUFpQkVIQUFIRUVmMEVISUFOckJTQURDMEVCZENBR2FpSURRWUNRZm1wQkFVRUFJQVJCQ0hFYlFRRnhRUTEwSWdWcUxRQUFJUVlnQTBHQmtINXFJQVZxTFFBQUlRVWdBa0VJYnlFRFFRQWhBaUFCUWFBQmJDQUFha0VEYkVHQXlRVnFJQVJCQjNFQ2YwRUJJQU5CQnlBRGF5QUVRU0J4R3lJRGRDQUZjUVJBUVFJaEFnc2dBa0VCYWdzZ0FrRUJJQU4wSUFaeEd5SUNRUUFRTFNJRFFSOXhRUU4wT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUhKQldvZ0EwSGdCM0ZCQlhWQkEzUTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdza0ZhaUFEUVlENEFYRkJDblZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJnSkVFYWlBQ1FRTnhJZ0JCQkhJZ0FDQUVRWUFCY1JzNkFBQUx0UUVBSUFRZ0JSQXNJQU5CQ0c5QkFYUnFJZ1JCZ0pCK2FpMEFBQ0VGUVFBaEF5QUJRYUFCYkNBQWFrRURiRUdBeVFWcUFuOGdCRUdCa0g1cUxRQUFRUUZCQnlBQ1FRaHZheUlDZEhFRVFFRUNJUU1MSUFOQkFXb0xJQU5CQVNBQ2RDQUZjUnNpQTBISC9nTkJBQkF1SWdJNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ2NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZTEpCV29nQWpvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRTZBQUFMMVFFQkJuOGdBMEVEZFNFTEEwQWdCRUdnQVVnRVFDQUVJQVZxSWdaQmdBSk9CRUFnQmtHQUFtc2hCZ3NnQzBFRmRDQUNhaUFHUVFOMWFpSUpRWUNRZm1vdEFBQWhDRUVBSVFvak5nUkFJQVFnQUNBR0lBa2dDQkFySWdkQkFFb0VRRUVCSVFvZ0IwRUJheUFFYWlFRUN3c2dDa1VqTlNJSElBY2JCRUFnQkNBQUlBWWdBeUFKSUFFZ0NCQXdJZ2RCQUVvRVFDQUhRUUZySUFScUlRUUxCU0FLUlFSQUl6b0VRQ0FFSUFBZ0JpQURJQWtnQVNBSUVERUZJQVFnQUNBR0lBTWdBU0FJRURJTEN3c2dCRUVCYWlFRURBRUxDd3NyQVFGL0kxY2hBeUFBSUFFZ0FpTllJQUJxSWdCQmdBSk9CSDhnQUVHQUFtc0ZJQUFMUVFBZ0F4QXpDekFCQTM4aldTRURJQUFqV2lJRVNBUkFEd3NnQTBFSGF5SURRWDlzSVFVZ0FDQUJJQUlnQUNBRWF5QURJQVVRTXd2RUJRRVBmd0pBUVNjaENRTkFJQWxCQUVnTkFTQUpRUUowSWdSQmdQd0RhaEFCSVFJZ0JFR0IvQU5xRUFFaENpQUVRWUw4QTJvUUFTRURJQUpCRUdzaEFpQUtRUWhySVFwQkNDRUZJQUVFUUVFUUlRVWdBMEVDYjBFQlJnUi9JQU5CQVdzRklBTUxJUU1MSUFBZ0FrNGlCZ1JBSUFBZ0FpQUZha2doQmdzZ0JnUkFJQVJCZy93RGFoQUJJZ1pCZ0FGeFFRQkhJUXNnQmtFZ2NVRUFSeUVPUVlDQUFpQURFQ3dnQUNBQ2F5SUNJQVZyUVg5c1FRRnJJQUlnQmtIQUFIRWJRUUYwYWlJRFFZQ1FmbXBCQVVFQUlBWkJDSEZCQUVjak9pSUNJQUliRzBFQmNVRU5kQ0lDYWkwQUFDRVBJQU5CZ1pCK2FpQUNhaTBBQUNFUVFRY2hCUU5BSUFWQkFFNEVRRUVBSVFnQ2YwRUJJQVVpQWtFSGEwRi9iQ0FDSUE0YklnSjBJQkJ4QkVCQkFpRUlDeUFJUVFGcUN5QUlRUUVnQW5RZ0QzRWJJZ2dFUUVFSElBVnJJQXBxSWdkQkFFNGlBZ1JBSUFkQm9BRk1JUUlMSUFJRVFFRUFJUXhCQUNFTlFRRkJBQ085QVVVak9pSURJQU1iR3lJQ1JRUkFJQUJCb0FGc0lBZHFRWUNSQkdvdEFBQWlBMEVEY1NJRVFRQktJQXNnQ3hzRVFFRUJJUXdGSUFOQkJIRkJBRWNqT2lJRElBTWJJZ01FUUNBRVFRQktJUU1MUVFGQkFDQURHeUVOQ3dzZ0FrVUVRQ0FNUlNJRUJIOGdEVVVGSUFRTElRSUxJQUlFUUNNNkJFQWdBRUdnQVd3Z0IycEJBMnhCZ01rRmFpQUdRUWR4SUFoQkFSQXRJZ1JCSDNGQkEzUTZBQUFnQUVHZ0FXd2dCMnBCQTJ4Qmdja0ZhaUFFUWVBSGNVRUZkVUVEZERvQUFDQUFRYUFCYkNBSGFrRURiRUdDeVFWcUlBUkJnUGdCY1VFS2RVRURkRG9BQUFVZ0FFR2dBV3dnQjJwQkEyeEJnTWtGYWlBSVFjbitBMEhJL2dNZ0JrRVFjUnRCQUJBdUlnTTZBQUFnQUVHZ0FXd2dCMnBCQTJ4Qmdja0ZhaUFET2dBQUlBQkJvQUZzSUFkcVFRTnNRWUxKQldvZ0F6b0FBQXNMQ3dzZ0JVRUJheUVGREFFTEN3c2dDVUVCYXlFSkRBQUFDd0FMQzJZQkFuOUJnSkFDSVFGQmdJQUNRWUNRQWlPNUFSc2hBU002STcwQkl6b2JCRUJCZ0xBQ0lRSWdBQ0FCUVlDNEFrR0FzQUlqdWdFYkVEUUxJN2dCQkVCQmdMQUNJUUlnQUNBQlFZQzRBa0dBc0FJanR3RWJFRFVMSTd3QkJFQWdBQ083QVJBMkN3c2xBUUYvQWtBRFFDQUFRWkFCU3cwQklBQkIvd0Z4RURjZ0FFRUJhaUVBREFBQUN3QUxDMFlCQW44RFFDQUJRWkFCVGtVRVFFRUFJUUFEUUNBQVFhQUJTQVJBSUFGQm9BRnNJQUJxUVlDUkJHcEJBRG9BQUNBQVFRRnFJUUFNQVFzTElBRkJBV29oQVF3QkN3c0xIUUVCZjBHUC9nTVFBVUVCSUFCMGNpSUJKSVFCUVkvK0F5QUJFQVFMQ3dCQkFTU0FBVUVCRURvTFJRRUNmMEdVL2dNUUFVSDRBWEVoQVVHVC9nTWdBRUgvQVhFaUFoQUVRWlQrQXlBQklBQkJDSFVpQUhJUUJDQUNKTkVCSUFBazBnRWowUUVqMGdGQkNIUnlKTk1CQzJZQkFuOGpwQUVpQVNQUEFYVWhBQ0FCSUFCcklBQWdBV29qMEFFYklnQkIvdzlNSWdFRWZ5UFBBVUVBU2dVZ0FRc0VRQ0FBSktRQklBQVFQQ09rQVNJQkk4OEJkU0VBSUFFZ0FHc2dBQ0FCYWlQUUFSc2hBQXNnQUVIL0Qwb0VRRUVBSkpzQkN3c3NBQ09qQVVFQmF5U2pBU09qQVVFQVRBUkFJODRCSktNQkk4NEJRUUJLSTZJQkk2SUJHd1JBRUQwTEN3dGJBUUYvSTUwQlFRRnJKSjBCSTUwQlFRQk1CRUFqMUFFa25RRWpuUUVFUUNPZkFVRVBTQ1BWQVNQVkFSc0VRQ09mQVVFQmFpU2ZBUVVqMVFGRklnQUVRQ09mQVVFQVNpRUFDeUFBQkVBam53RkJBV3NrbndFTEN3c0xDMXNCQVg4anB3RkJBV3NrcHdFanB3RkJBRXdFUUNQV0FTU25BU09uQVFSQUk2a0JRUTlJSTljQkk5Y0JHd1JBSTZrQlFRRnFKS2tCQlNQWEFVVWlBQVJBSTZrQlFRQktJUUFMSUFBRVFDT3BBVUVCYXlTcEFRc0xDd3NMV3dFQmZ5T3lBVUVCYXlTeUFTT3lBVUVBVEFSQUk5Z0JKTElCSTdJQkJFQWp0QUZCRDBnajJRRWoyUUViQkVBanRBRkJBV29rdEFFRkk5a0JSU0lBQkVBanRBRkJBRW9oQUFzZ0FBUkFJN1FCUVFGckpMUUJDd3NMQ3d1T0JnQWpaeUFBYWlSbkkyY2pQZ1IvUVlDQUFRVkJnTUFBQzA0RVFDTm5JejRFZjBHQWdBRUZRWURBQUF0ckpHY0NRQUpBQWtBQ1FBSkFJMmtpQUFSQUlBQkJBbXNPQmdFRkFnVURCQVVMSTU0QlFRQktJZ0FFZnlQS0FRVWdBQXNFUUNPZUFVRUJheVNlQVFzam5nRkZCRUJCQUNTYkFRc2pxQUZCQUVvaUFBUi9JOHNCQlNBQUN3UkFJNmdCUVFGckpLZ0JDeU9vQVVVRVFFRUFKS1VCQ3lPdUFVRUFTaUlBQkg4anpBRUZJQUFMQkVBanJnRkJBV3NrcmdFTEk2NEJSUVJBUVFBa3JBRUxJN01CUVFCS0lnQUVmeVBOQVFVZ0FBc0VRQ096QVVFQmF5U3pBUXNqc3dGRkJFQkJBQ1N3QVFzTUJBc2puZ0ZCQUVvaUFBUi9JOG9CQlNBQUN3UkFJNTRCUVFGckpKNEJDeU9lQVVVRVFFRUFKSnNCQ3lPb0FVRUFTaUlBQkg4anl3RUZJQUFMQkVBanFBRkJBV3NrcUFFTEk2Z0JSUVJBUVFBa3BRRUxJNjRCUVFCS0lnQUVmeVBNQVFVZ0FBc0VRQ091QVVFQmF5U3VBUXNqcmdGRkJFQkJBQ1NzQVFzanN3RkJBRW9pQUFSL0k4MEJCU0FBQ3dSQUk3TUJRUUZySkxNQkN5T3pBVVVFUUVFQUpMQUJDeEErREFNTEk1NEJRUUJLSWdBRWZ5UEtBUVVnQUFzRVFDT2VBVUVCYXlTZUFRc2puZ0ZGQkVCQkFDU2JBUXNqcUFGQkFFb2lBQVIvSThzQkJTQUFDd1JBSTZnQlFRRnJKS2dCQ3lPb0FVVUVRRUVBSktVQkN5T3VBVUVBU2lJQUJIOGp6QUVGSUFBTEJFQWpyZ0ZCQVdza3JnRUxJNjRCUlFSQVFRQWtyQUVMSTdNQlFRQktJZ0FFZnlQTkFRVWdBQXNFUUNPekFVRUJheVN6QVFzanN3RkZCRUJCQUNTd0FRc01BZ3NqbmdGQkFFb2lBQVIvSThvQkJTQUFDd1JBSTU0QlFRRnJKSjRCQ3lPZUFVVUVRRUVBSkpzQkN5T29BVUVBU2lJQUJIOGp5d0VGSUFBTEJFQWpxQUZCQVdza3FBRUxJNmdCUlFSQVFRQWtwUUVMSTY0QlFRQktJZ0FFZnlQTUFRVWdBQXNFUUNPdUFVRUJheVN1QVFzanJnRkZCRUJCQUNTc0FRc2pzd0ZCQUVvaUFBUi9JODBCQlNBQUN3UkFJN01CUVFGckpMTUJDeU96QVVVRVFFRUFKTEFCQ3hBK0RBRUxFRDhRUUJCQkN5TnBRUUZxSkdramFVRUlUZ1JBUVFBa2FRdEJBUThMUVFBTGd3RUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQWdBQ0lCUVFKR0RRRWdBVUVEUmcwQ0lBRkJCRVlOQXd3RUN5TndJOXNCUndSQUk5c0JKSEJCQVE4TFFRQVBDeU54STl3QlJ3UkFJOXdCSkhGQkFROExRUUFQQ3lOeUk5MEJSd1JBSTkwQkpISkJBUThMUVFBUEN5TnpJOTRCUndSQUk5NEJKSE5CQVE4TFFRQVBDMEVBQzFVQUFrQUNRQUpBSUFCQkFVY0VRQ0FBUVFKR0RRRWdBRUVEUmcwQ0RBTUxRUUVnQVhSQmdRRnhRUUJIRHd0QkFTQUJkRUdIQVhGQkFFY1BDMEVCSUFGMFFmNEFjVUVBUnc4TFFRRWdBWFJCQVhGQkFFY0xpZ0VCQVg4am5BRWdBR3NrbkFFam5BRkJBRXdFUUNPY0FTSUJRUjkxSVFCQmdCQWowd0ZyUVFKMEpKd0JJejRFUUNPY0FVRUJkQ1NjQVFzam5BRWdBQ0FCYWlBQWMyc2tuQUVqb1FGQkFXb2tvUUVqb1FGQkNFNEVRRUVBSktFQkN3c2oyd0VqbXdFaUFDQUFHd1IvSTU4QkJVRVBEd3NqNGdFam9RRVFSQVIvUVFFRlFYOExiRUVQYWd1S0FRRUJmeU9tQVNBQWF5U21BU09tQVVFQVRBUkFJNllCSWdGQkgzVWhBRUdBRUNQakFXdEJBblFrcGdFalBnUkFJNllCUVFGMEpLWUJDeU9tQVNBQUlBRnFJQUJ6YXlTbUFTT3JBVUVCYWlTckFTT3JBVUVJVGdSQVFRQWtxd0VMQ3lQY0FTT2xBU0lBSUFBYkJIOGpxUUVGUVE4UEN5UGtBU09yQVJCRUJIOUJBUVZCZnd0c1FROXFDNWtDQVFKL0k2MEJJQUJySkswQkk2MEJRUUJNQkVBanJRRWlBa0VmZFNFQVFZQVFJK1VCYTBFQmRDU3RBU00rQkVBanJRRkJBWFFrclFFTEk2MEJJQUFnQW1vZ0FITnJKSzBCSTY4QlFRRnFKSzhCSTY4QlFTQk9CRUJCQUNTdkFRc0xRUUFoQWlQbUFTRUFJOTBCSTZ3QklnRWdBUnNFUUNOckJFQkJuUDRERUFGQkJYVkJEM0VpQUNUbUFVRUFKR3NMQlVFUER3c2pyd0ZCQW0xQnNQNERhaEFCSVFFanJ3RkJBbThFZnlBQlFROXhCU0FCUVFSMVFROXhDeUVCQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVNBQVFRSkdEUUlNQXdzZ0FVRUVkU0VCREFNTFFRRWhBZ3dDQ3lBQlFRRjFJUUZCQWlFQ0RBRUxJQUZCQW5VaEFVRUVJUUlMSUFKQkFFb0VmeUFCSUFKdEJVRUFDMEVQYWd1ckFRRUJmeU94QVNBQWF5U3hBU094QVVFQVRBUkFJN0VCSVFBajV3RWo2QUYwSWdGQkFYUWdBU00rR3lTeEFTT3hBU0FBUVI5MUlnRWdBQ0FCYW5OckpMRUJJN1VCSWdCQkFYRWhBU0FBUVFGMUlnQWt0UUVqdFFFZ0FTQUFRUUZ4Y3lJQlFRNTBjaVMxQVNQcEFRUkFJN1VCUWI5L2NTUzFBU08xQVNBQlFRWjBjaVMxQVFzTEk5NEJJN0FCSWdBZ0FCc0VmeU8wQVFWQkR3OExRWDlCQVNPMUFVRUJjUnRzUVE5cUN6QUFJQUJCUEVZRVFFSC9BQThMSUFCQlBHdEJvSTBHYkNBQmJFRUliVUdnalFadFFUeHFRYUNOQm14QmpQRUNiUXVjQVFFQmYwRUFKSFlnQUVFUEkxNGJJZ1FnQVdvZ0JFRVBhaU5mR3lJRUlBSnFJQVJCRDJvallCc2hCQ0FESUFJZ0FTQUFRUThqWWhzaUFHb2dBRUVQYWlOakd5SUFhaUFBUVE5cUkyUWJJZ0JxSUFCQkQyb2paUnNoQUVFQUpIZEJBQ1I0SUFNZ0JHb2dCRUVQYWlOaEd5TmNRUUZxRUVraEFTQUFJMTFCQVdvUVNTRUFJQUVrZENBQUpIVWdBRUgvQVhFZ0FVSC9BWEZCQ0hSeUM4TURBUVYvQW44ajJnRWdBR29rMmdGQkFDT2NBU1BhQVd0QkFFb05BQnBCQVFzaUFVVUVRRUVCRUVNaEFRc0NmeVBmQVNBQWFpVGZBVUVBSTZZQkk5OEJhMEVBU2cwQUdrRUJDeUlFUlFSQVFRSVFReUVFQ3dKL0krQUJJQUJxSk9BQkk2MEJJK0FCYTBFQVNpSUNCRUFqYTBVaEFndEJBQ0FDRFFBYVFRRUxJZ0pGQkVCQkF4QkRJUUlMQW44ajRRRWdBR29rNFFGQkFDT3hBU1BoQVd0QkFFb05BQnBCQVFzaUJVVUVRRUVFRUVNaEJRc2dBUVJBSTlvQklRTkJBQ1RhQVNBREVFVWtiQXNnQkFSQUk5OEJJUU5CQUNUZkFTQURFRVlrYlFzZ0FnUkFJK0FCSVFOQkFDVGdBU0FERUVja2Jnc2dCUVJBSStFQklRTkJBQ1RoQVNBREVFZ2tid3NDZnlBQklBUWdBUnNpQVVVRVFDQUNJUUVMSUFGRkN3UkFJQVVoQVFzZ0FRUkFRUUVrZUFzamFDUHFBU0FBYkdva2FDTm9RWUNBZ0FSQmdJQ0FBaU0rRzA0RVFDTm9RWUNBZ0FSQmdJQ0FBaU0rRzJza2FDTjRJZ0FqZGlBQUd5SUJSUVJBSTNjaEFRc2dBUVJBSTJ3amJTTnVJMjhRU2hvTEkyb2lBVUVCZEVHQW1jRUFhaUlBSTNSQkFtbzZBQUFnQUVFQmFpTjFRUUpxT2dBQUlBRkJBV29rYWlOcUkrc0JRUUp0UVFGclRnUkFJMnBCQVdza2Fnc0xDNXdEQVFWL0lBQVFSU0VDSUFBUVJpRUJJQUFRUnlFRElBQVFTQ0VFSUFJa2JDQUJKRzBnQXlSdUlBUWtieU5vSStvQklBQnNhaVJvSTJoQmdJQ0FCRUdBZ0lBQ0l6NGJUZ1JBSTJoQmdJQ0FCRUdBZ0lBQ0l6NGJheVJvSUFJZ0FTQURJQVFRU2lFQUkycEJBWFJCZ0puQkFHb2lCU0FBUVlEK0EzRkJDSFZCQW1vNkFBQWdCVUVCYWlBQVFmOEJjVUVDYWpvQUFDTTNCRUFnQWtFUFFROUJEeEJLSVFBamFrRUJkRUdBbVNGcUlnSWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBSkJBV29nQUVIL0FYRkJBbW82QUFCQkR5QUJRUTlCRHhCS0lRQWpha0VCZEVHQW1TbHFJZ0VnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQUZCQVdvZ0FFSC9BWEZCQW1vNkFBQkJEMEVQSUFOQkR4QktJUUFqYWtFQmRFR0FtVEZxSWdFZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFGQkFXb2dBRUgvQVhGQkFtbzZBQUJCRDBFUFFROGdCQkJLSVFBamFrRUJkRUdBbVRscUlnRWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBRkJBV29nQUVIL0FYRkJBbW82QUFBTEkycEJBV29rYWlOcUkrc0JRUUp0UVFGclRnUkFJMnBCQVdza2Fnc0xDeDRCQVg4Z0FCQkNJUUVnQVVVak5DTTBHd1JBSUFBUVN3VWdBQkJNQ3d0TEFDTmJJejRFZjBHdUFRVkIxd0FMU0FSQUR3c0RRQ05iSXo0RWYwR3VBUVZCMXdBTFRnUkFJejRFZjBHdUFRVkIxd0FMRUUwald5TStCSDlCcmdFRlFkY0FDMnNrV3d3QkN3c0xJUUFnQUVHbS9nTkdCRUJCcHY0REVBRkJnQUZ4SVFBZ0FFSHdBSElQQzBGL0M1d0JBUUYvSTc0QklRQWp2d0VFUUNBQVFYdHhJQUJCQkhJajdBRWJJUUFnQUVGK2NTQUFRUUZ5SSswQkd5RUFJQUJCZDNFZ0FFRUljaVB1QVJzaEFDQUFRWDF4SUFCQkFuSWo3d0ViSVFBRkk4QUJCRUFnQUVGK2NTQUFRUUZ5SS9BQkd5RUFJQUJCZlhFZ0FFRUNjaVB4QVJzaEFDQUFRWHR4SUFCQkJISWo4Z0ViSVFBZ0FFRjNjU0FBUVFoeUkvTUJHeUVBQ3dzZ0FFSHdBWElMendJQkFYOGdBRUdBZ0FKSUJFQkJmdzhMSUFCQmdJQUNUaUlCQkg4Z0FFR0F3QUpJQlNBQkN3UkFRWDhQQ3lBQVFZREFBMDRpQVFSL0lBQkJnUHdEU0FVZ0FRc0VRQ0FBUVlCQWFoQUJEd3NnQUVHQS9BTk9JZ0VFZnlBQVFaLzlBMHdGSUFFTEJFQWptQUZCQWtnRVFFSC9BUThMUVg4UEN5QUFRYzMrQTBZRVFFSC9BU0VCUWMzK0F4QUJRUUZ4UlFSQVFmNEJJUUVMSXo1RkJFQWdBVUgvZm5FaEFRc2dBUThMSUFCQnhQNERSZ1JBSUFBalZoQUVJMVlQQ3lBQVFaRCtBMDRpQVFSL0lBQkJwdjREVEFVZ0FRc0VRQkJPSUFBUVR3OExJQUJCc1A0RFRpSUJCSDhnQUVHLy9nTk1CU0FCQ3dSQUVFNUJmdzhMSUFCQmhQNERSZ1JBSUFBamhnRkJnUDREY1VFSWRTSUJFQVFnQVE4TElBQkJoZjREUmdSQUlBQWpod0VRQkNPSEFROExJQUJCai80RFJnUkFJNFFCUWVBQmNnOExJQUJCZ1A0RFJnUkFFRkFQQzBGL0N5a0JBWDhqeVFFZ0FFWUVRRUVCSk1FQkN5QUFFRkVpQVVGL1JnUkFJQUFRQVE4TElBRkIvd0Z4QzdZQ0FRRi9JMUFFUUE4TElBQkIvejlNQkVBalVnUi9JQUZCRUhGRkJTTlNDMFVFUUNBQlFROXhJZ0lFUUNBQ1FRcEdCRUJCQVNST0N3VkJBQ1JPQ3dzRklBQkIvLzhBVEFSQUl6bEZJZ0lFZnlBQ0JTQUFRZi9mQUV3TEJFQWpVZ1JBSUFGQkQzRWtPQXNnQVNFQ0kxRUVRQ0FDUVI5eElRSWpPRUhnQVhFa09BVWpVd1JBSUFKQi93QnhJUUlqT0VHQUFYRWtPQVVqT1FSQVFRQWtPQXNMQ3lNNElBSnlKRGdGSXpoQi93RnhRUUZCQUNBQlFRQktHMEgvQVhGQkNIUnlKRGdMQlNOU1JTSUNCSDhnQUVIL3Z3Rk1CU0FDQ3dSQUkwOGpVU0lBSUFBYkJFQWpPRUVmY1NRNEl6Z2dBVUhnQVhGeUpEZ1BDeUFCUVE5eElBRkJBM0VqT1Jza1BBVWpVa1VpQWdSL0lBQkIvLzhCVEFVZ0Fnc0VRQ05SQkVBZ0FVRUJjUVJBUVFFa1R3VkJBQ1JQQ3dzTEN3c0xDeXdBSUFCQkJIVkJEM0VrK1FFZ0FFRUljVUVBUnlUVkFTQUFRUWR4Sk5RQklBQkIrQUZ4UVFCS0pOc0JDeXdBSUFCQkJIVkJEM0VrK2dFZ0FFRUljVUVBUnlUWEFTQUFRUWR4Sk5ZQklBQkIrQUZ4UVFCS0pOd0JDeXdBSUFCQkJIVkJEM0VrL0FFZ0FFRUljVUVBUnlUWkFTQUFRUWR4Sk5nQklBQkIrQUZ4UVFCS0pONEJDNEVCQVFGL0lBQkJCSFVrNkFFZ0FFRUljVUVBUnlUcEFTQUFRUWR4SklFQ0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNPQkFpSUJCRUFnQVVFQmF3NEhBUUlEQkFVR0J3Z0xRUWdrNXdFUEMwRVFKT2NCRHd0QklDVG5BUThMUVRBazV3RVBDMEhBQUNUbkFROExRZEFBSk9jQkR3dEI0QUFrNXdFUEMwSHdBQ1RuQVFzTGd3RUJBWDlCQVNTYkFTT2VBVVVFUUVIQUFDU2VBUXRCZ0JBajB3RnJRUUowSkp3Qkl6NEVRQ09jQVVFQmRDU2NBUXNqMUFFa25RRWorUUVrbndFajB3RWtwQUVqemdFaUFDU2pBU0FBUVFCS0lnQUVmeVBQQVVFQVNnVWdBQXNFUUVFQkpLSUJCVUVBSktJQkN5UFBBVUVBU2dSQUVEMExJOXNCUlFSQVFRQWttd0VMQzBjQVFRRWtwUUVqcUFGRkJFQkJ3QUFrcUFFTFFZQVFJK01CYTBFQ2RDU21BU00rQkVBanBnRkJBWFFrcGdFTEk5WUJKS2NCSS9vQkpLa0JJOXdCUlFSQVFRQWtwUUVMQzBBQVFRRWtyQUVqcmdGRkJFQkJnQUlrcmdFTFFZQVFJK1VCYTBFQmRDU3RBU00rQkVBanJRRkJBWFFrclFFTFFRQWtyd0VqM1FGRkJFQkJBQ1NzQVFzTFNRRUJmMEVCSkxBQkk3TUJSUVJBUWNBQUpMTUJDeVBuQVNQb0FYUWlBRUVCZENBQUl6NGJKTEVCSTlnQkpMSUJJL3dCSkxRQlFmLy9BU1MxQVNQZUFVVUVRRUVBSkxBQkN3dFVBQ0FBUVlBQmNVRUFSeVJoSUFCQndBQnhRUUJISkdBZ0FFRWdjVUVBUnlSZklBQkJFSEZCQUVja1hpQUFRUWh4UVFCSEpHVWdBRUVFY1VFQVJ5UmtJQUJCQW5GQkFFY2tZeUFBUVFGeFFRQkhKR0lMaUFVQkFYOGdBRUdtL2dOSElnSUVRQ05tUlNFQ0N5QUNCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUNRWkQrQTBjRVFDQUNRWkgrQTJzT0ZnSUdDZzRWQXdjTER3RUVDQXdRRlFVSkRSRVNFeFFWQ3lBQlFmQUFjVUVFZFNUT0FTQUJRUWh4UVFCSEpOQUJJQUZCQjNFa3p3RU1GUXNnQVVHQUFYRkJBRWNrM1FFTUZBc2dBVUVHZFVFRGNTVGlBU0FCUVQ5eEpQVUJRY0FBSS9VQmF5U2VBUXdUQ3lBQlFRWjFRUU54Sk9RQklBRkJQM0VrOWdGQndBQWo5Z0ZySktnQkRCSUxJQUVrOXdGQmdBSWo5d0ZySks0QkRCRUxJQUZCUDNFaytBRkJ3QUFqK0FGckpMTUJEQkFMSUFFUVZBd1BDeUFCRUZVTURndEJBU1JySUFGQkJYVkJEM0VrK3dFTURRc2dBUkJXREF3TElBRWswUUVqMFFFajBnRkJDSFJ5Sk5NQkRBc0xJQUVrL1FFai9RRWovZ0ZCQ0hSeUpPTUJEQW9MSUFFay93RWovd0VqZ0FKQkNIUnlKT1VCREFrTElBRVFWd3dJQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISk1vQklBRkJCM0VrMGdFajBRRWowZ0ZCQ0hSeUpOTUJFRmdMREFjTElBRkJnQUZ4QkVBZ0FVSEFBSEZCQUVja3l3RWdBVUVIY1NUK0FTUDlBU1ArQVVFSWRISWs0d0VRV1FzTUJnc2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5VE1BU0FCUVFkeEpJQUNJLzhCSTRBQ1FRaDBjaVRsQVJCYUN3d0ZDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKTTBCRUZzTERBUUxJQUZCQkhWQkIzRWtYQ0FCUVFkeEpGMUJBU1IyREFNTElBRVFYRUVCSkhjTUFnc2dBVUdBQVhGQkFFY2taaUFCUVlBQmNVVUVRQUpBUVpEK0F5RUNBMEFnQWtHbS9nTk9EUUVnQWtFQUVBUWdBa0VCYWlFQ0RBQUFDd0FMQ3d3QkMwRUJEd3RCQVFzOEFRRi9JQUJCQ0hRaEFVRUFJUUFEUUFKQUlBQkJud0ZLRFFBZ0FFR0EvQU5xSUFBZ0FXb1FBUkFFSUFCQkFXb2hBQXdCQ3d0QmhBVWt3Z0VMSXdFQmZ5T0VBaEFCSVFBamhRSVFBVUgvQVhFZ0FFSC9BWEZCQ0hSeVFmRC9BM0VMSndFQmZ5T0dBaEFCSVFBamh3SVFBVUgvQVhFZ0FFSC9BWEZCQ0hSeVFmQS9jVUdBZ0FKcUM0TUJBUU4vSXpwRkJFQVBDeUFBUVlBQmNVVWp4UUVqeFFFYkJFQkJBQ1RGQVNPREFoQUJRWUFCY2lFQUk0TUNJQUFRQkE4TEVGOGhBUkJnSVFJZ0FFSC9mbkZCQVdwQkJIUWhBeUFBUVlBQmNRUkFRUUVreFFFZ0F5VEdBU0FCSk1jQklBSWt5QUVqZ3dJZ0FFSC9mbkVRQkFVZ0FTQUNJQU1RYXlPREFrSC9BUkFFQ3d0aUFRTi9JNG9DSUFCR0lnSkZCRUFqaVFJZ0FFWWhBZ3NnQWdSQUlBQkJBV3NpQXhBQlFiOS9jU0lDUVQ5eElnUkJRR3NnQkVFQlFRQWppUUlnQUVZYkcwR0FrQVJxSUFFNkFBQWdBa0dBQVhFRVFDQURJQUpCQVdwQmdBRnlFQVFMQ3dzOEFRRi9Ba0FDUUFKQUFrQWdBQVJBSUFBaUFVRUJSZzBCSUFGQkFrWU5BaUFCUVFOR0RRTU1CQXRCQ1E4TFFRTVBDMEVGRHd0QkJ3OExRUUFMTFFFQmYwRUJJNG9CRUdNaUFuUWdBSEZCQUVjaUFBUi9RUUVnQW5RZ0FYRkZCU0FBQ3dSQVFRRVBDMEVBQzVFQkFRSi9BMEFnQVNBQVNBUkFJQUZCQkdvaEFTT0dBU0lDUVFScUpJWUJJNFlCUWYvL0Ewb0VRQ09HQVVHQWdBUnJKSVlCQ3lPSkFRUkFJNHNCQkVBamlBRWtod0ZCQVNTQkFVRUNFRHBCQUNTTEFVRUJKSXdCQlNPTUFRUkFRUUFrakFFTEN5QUNJNFlCRUdRRVFDT0hBVUVCYWlTSEFTT0hBVUgvQVVvRVFFRUJKSXNCUVFBa2h3RUxDd3NNQVFzTEN3d0FJNFVCRUdWQkFDU0ZBUXRIQVFGL0k0WUJJUUJCQUNTR0FVR0UvZ05CQUJBRUk0a0JCSDhnQUNPR0FSQmtCU09KQVFzRVFDT0hBVUVCYWlTSEFTT0hBVUgvQVVvRVFFRUJKSXNCUVFBa2h3RUxDd3VBQVFFQ2Z5T0pBU0VCSUFCQkJIRkJBRWNraVFFZ0FFRURjU0VDSUFGRkJFQWppZ0VRWXlFQUlBSVFZeUVCSTRrQkJIOGpoZ0ZCQVNBQWRIRUZJNFlCUVFFZ0FIUnhRUUJISWdBRWZ5T0dBVUVCSUFGMGNRVWdBQXNMQkVBamh3RkJBV29raHdFamh3RkIvd0ZLQkVCQkFTU0xBVUVBSkljQkN3c0xJQUlraWdFTDBnWUJBWDhDUUFKQUlBQkJ6ZjREUmdSQVFjMytBeUFCUVFGeEVBUU1BUXNnQUVHQWdBSklCRUFnQUNBQkVGTU1BUXNnQUVHQWdBSk9JZ0lFUUNBQVFZREFBa2doQWdzZ0FnMEJJQUJCZ01BRFRpSUNCRUFnQUVHQS9BTklJUUlMSUFJRVFDQUFRWUJBYWlBQkVBUU1BZ3NnQUVHQS9BTk9JZ0lFUUNBQVFaLzlBMHdoQWdzZ0FnUkFJNWdCUVFKSURRRU1BZ3NnQUVHZy9RTk9JZ0lFUUNBQVFmLzlBMHdoQWdzZ0FnMEFJQUJCZ3Y0RFJnUkFJQUZCQVhGQkFFY2tqd0VnQVVFQ2NVRUFSeVNRQVNBQlFZQUJjVUVBUnlTUkFVRUJEd3NnQUVHUS9nTk9JZ0lFUUNBQVFhYitBMHdoQWdzZ0FnUkFFRTRnQUNBQkVGMFBDeUFBUWJEK0EwNGlBZ1JBSUFCQnYvNERUQ0VDQ3lBQ0JFQVFUZ3NnQUVIQS9nTk9JZ0lFUUNBQVFjditBMHdoQWdzZ0FnUkFJQUJCd1A0RFJnUkFJQUVRSGd3REN5QUFRY0grQTBZRVFFSEIvZ01nQVVINEFYRkJ3ZjRERUFGQkIzRnlRWUFCY2hBRURBSUxJQUJCeFA0RFJnUkFRUUFrVmlBQVFRQVFCQXdDQ3lBQVFjWCtBMFlFUUNBQkpJSUNEQU1MSUFCQnh2NERSZ1JBSUFFUVhnd0RDd0pBQWtBQ1FBSkFJQUFpQWtIRC9nTkhCRUFnQWtIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTUlhEQVlMSUFFa1dBd0ZDeUFCSkZrTUJBc2dBU1JhREFNTERBSUxJNE1DSUFCR0JFQWdBUkJoREFFTEl6MGdBRVlpQWtVRVFDTTdJQUJHSVFJTElBSUVRQ1BGQVFSQUFuOGp4d0ZCZ0lBQlRpSUNCRUFqeHdGQi8vOEJUQ0VDQ3lBQ1JRc0VRQ1BIQVVHQW9BTk9JZ0lFUUNQSEFVSC92d05NSVFJTEN5QUNEUUlMQ3lBQUk0Z0NUaUlDQkVBZ0FDT0pBa3doQWdzZ0FnUkFJQUFnQVJCaURBSUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQm1Ba0FDUUFKQUFrQWdBQ0lDUVlUK0EwY0VRQ0FDUVlYK0Eyc09Bd0VDQXdRTEVHY01CUXNDUUNPSkFRUkFJNHdCRFFFaml3RUVRRUVBSklzQkN3c2dBU1NIQVFzTUJRc2dBU1NJQVNPTUFTT0pBU0lBSUFBYkJFQWppQUVraHdGQkFDU01BUXNNQkFzZ0FSQm9EQU1MREFJTElBQkJnUDREUmdSQUlBRkIvd0Z6Skw0Qkk3NEJJZ0pCRUhGQkFFY2t2d0VnQWtFZ2NVRUFSeVRBQVFzZ0FFR1AvZ05HQkVBZ0FSQVBEQUlMSUFCQi8vOERSZ1JBSUFFUURnd0NDMEVCRHd0QkFBOExRUUVMSHdBajlBRWdBRVlFUUVFQkpNRUJDeUFBSUFFUWFRUkFJQUFnQVJBRUN3dGdBUU4vQTBBQ1FDQURJQUpPRFFBZ0FDQURhaEJTSVFVZ0FTQURhaUVFQTBBZ0JFSC92d0pLQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUdvZ0EwRUJhaUVEREFFTEMwRWdJUU1qd2dFZ0FrRVFiVUhBQUVFZ0l6NGJiR29rd2dFTFp3RUJmeVBGQVVVRVFBOExJOGNCSThnQkk4WUJJZ0JCRUNBQVFSQklHeUlBRUdzanh3RWdBR29reHdFanlBRWdBR29reUFFanhnRWdBR3NreGdFanhnRkJBRXdFUUVFQUpNVUJJNE1DUWY4QkVBUUZJNE1DSThZQlFSQnRRUUZyUWY5K2NSQUVDd3RHQVFKL0k0SUNJUU1DZnlBQVJTSUNSUVJBSUFCQkFVWWhBZ3NnQWdzRWZ5TldJQU5HQlNBQ0N3UkFJQUZCQkhJaUFVSEFBSEVFUUJBN0N3VWdBVUY3Y1NFQkN5QUJDNElDQVFOL0k3WUJSUVJBRHdzam1BRWhBQ0FBSTFZaUFrR1FBVTRFZjBFQkJTTlZJejRFZjBId0JRVkIrQUlMVGdSL1FRSUZRUU5CQUNOVkl6NEVmMEh5QXdWQitRRUxUaHNMQ3lJQlJ3UkFRY0grQXhBQklRQWdBU1NZQVVFQUlRSUNRQUpBQWtBQ1FDQUJCRUFnQVVFQmF3NERBUUlEQkFzZ0FFRjhjU0lBUVFoeFFRQkhJUUlNQXdzZ0FFRjljVUVCY2lJQVFSQnhRUUJISVFJTUFnc2dBRUYrY1VFQ2NpSUFRU0J4UVFCSElRSU1BUXNnQUVFRGNpRUFDeUFDQkVBUU93c2dBVVVFUUJCc0N5QUJRUUZHQkVCQkFTUi9RUUFRT2d0QndmNERJQUVnQUJCdEVBUUZJQUpCbVFGR0JFQkJ3ZjRESUFGQndmNERFQUVRYlJBRUN3c0x0QUVBSTdZQkJFQWpWU0FBYWlSVkEwQWpWUUovSXo0RVFFRUlJMVpCbVFGR0RRRWFRWkFIREFFTFFRUWpWa0daQVVZTkFCcEJ5QU1MVGdSQUkxVUNmeU0rQkVCQkNDTldRWmtCUmcwQkdrR1FCd3dCQzBFRUkxWkJtUUZHRFFBYVFjZ0RDMnNrVlNOV0lnQkJrQUZHQkVBak13UkFFRGdGSUFBUU53c1FPVUYvSk1NQlFYOGt4QUVGSUFCQmtBRklCRUFqTTBVRVFDQUFFRGNMQ3d0QkFDQUFRUUZxSUFCQm1RRktHeVJXREFFTEN3c1FiZ3V6QVFBalZBSi9JejRFUUVFSUkxWkJtUUZHRFFFYVFaQUhEQUVMUVFRalZrR1pBVVlOQUJwQnlBTUxTQVJBRHdzRFFDTlVBbjhqUGdSQVFRZ2pWa0daQVVZTkFScEJrQWNNQVF0QkJDTldRWmtCUmcwQUdrSElBd3RPQkVBQ2Z5TStCRUJCQ0NOV1Faa0JSZzBCR2tHUUJ3d0JDMEVFSTFaQm1RRkdEUUFhUWNnREN4QnZJMVFDZnlNK0JFQkJDQ05XUVprQlJnMEJHa0dRQnd3QkMwRUVJMVpCbVFGR0RRQWFRY2dEQzJza1ZBd0JDd3NMTXdFQmYwRUJJNUFCQkg5QkFnVkJCd3NpQW5RZ0FIRkJBRWNpQUFSL1FRRWdBblFnQVhGRkJTQUFDd1JBUVFFUEMwRUFDNVlCQVFKL0k1RUJSUVJBRHdzRFFDQUJJQUJJQkVBZ0FVRUVhaUVCSTQwQklnSkJCR29ralFFampRRkIvLzhEU2dSQUk0MEJRWUNBQkdza2pRRUxJQUlqalFFUWNRUkFRWUgrQTBHQi9nTVFBVUVCZEVFQmFrSC9BWEVRQkNPT0FVRUJhaVNPQVNPT0FVRUlSZ1JBUVFBa2pnRkJBU1NDQVVFREVEcEJndjREUVlMK0F4QUJRZjkrY1JBRVFRQWtrUUVMQ3d3QkN3c0xpQUVBSThJQlFRQktCRUFqd2dFZ0FHb2hBRUVBSk1JQkN5TkpJQUJxSkVralRVVUVRQ014QkVBalZDQUFhaVJVRUhBRklBQVFid3NqTUFSQUkxc2dBR29rV3dVZ0FCQk5DeUFBRUhJTEl6SUVRQ09GQVNBQWFpU0ZBUkJtQlNBQUVHVUxJNVFCSUFCcUpKUUJJNVFCSTVJQlRnUkFJNU1CUVFGcUpKTUJJNVFCSTVJQmF5U1VBUXNMQ2dCQkJCQnpJMGdRQVFzbUFRRi9RUVFRY3lOSVFRRnFRZi8vQTNFUUFTRUFFSFJCL3dGeElBQkIvd0Z4UVFoMGNnc01BRUVFRUhNZ0FDQUJFR29MTUFFQmYwRUJJQUIwUWY4QmNTRUNJQUZCQUVvRVFDTkdJQUp5UWY4QmNTUkdCU05HSUFKQi93RnpjU1JHQ3lOR0N3a0FRUVVnQUJCM0dndEpBUUYvSUFGQkFFNEVRQ0FBUVE5eElBRkJEM0ZxUVJCeEJFQkJBUkI0QlVFQUVIZ0xCU0FCUVI5MUlnSWdBU0FDYW5OQkQzRWdBRUVQY1VzRVFFRUJFSGdGUVFBUWVBc0xDd2tBUVFjZ0FCQjNHZ3NKQUVFR0lBQVFkeG9MQ1FCQkJDQUFFSGNhQ3pzQkFuOGdBVUdBL2dOeFFRaDFJUUlnQUVFQmFpRURJQUFnQVVIL0FYRWlBUkJwQkVBZ0FDQUJFQVFMSUFNZ0FoQnBCRUFnQXlBQ0VBUUxDd3dBUVFnUWN5QUFJQUVRZlF0MUFDQUNCRUFnQVNBQVFmLy9BM0VpQUdvZ0FDQUJjM01pQWtFUWNRUkFRUUVRZUFWQkFCQjRDeUFDUVlBQ2NRUkFRUUVRZkFWQkFCQjhDd1VnQUNBQmFrSC8vd054SWdJZ0FFSC8vd054U1FSQVFRRVFmQVZCQUJCOEN5QUFJQUZ6SUFKelFZQWdjUVJBUVFFUWVBVkJBQkI0Q3dzTENnQkJCQkJ6SUFBUVVndVJCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNNRXdzUWRVSC8vd054SWdCQmdQNERjVUVJZFNSQUlBQkIvd0Z4SkVFTUR3c2pRVUgvQVhFalFFSC9BWEZCQ0hSeUl6OFFkZ3dSQ3lOQlFmOEJjU05BUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrUUF3UkN5TkFRUUVRZVNOQVFRRnFRZjhCY1NSQUkwQUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBOExJMEJCZnhCNUkwQkJBV3RCL3dGeEpFQWpRQVJBUVFBUWVnVkJBUkI2QzBFQkVIc01EZ3NRZEVIL0FYRWtRQXdMQ3lNL1FZQUJjVUdBQVVZRVFFRUJFSHdGUVFBUWZBc2pQeUlBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVrUHd3TEN4QjFRZi8vQTNFalJ4QitEQWdMSTBWQi93RnhJMFJCL3dGeFFRaDBjaUlBSTBGQi93RnhJMEJCL3dGeFFRaDBjaUlCUVFBUWZ5QUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSVUVBRUh0QkNBOExJMEZCL3dGeEkwQkIvd0Z4UVFoMGNoQ0FBVUgvQVhFa1B3d0pDeU5CUWY4QmNTTkFRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtRQXdKQ3lOQlFRRVFlU05CUVFGcVFmOEJjU1JCSTBFRVFFRUFFSG9GUVFFUWVndEJBQkI3REFjTEkwRkJmeEI1STBGQkFXdEIvd0Z4SkVFalFRUkFRUUFRZWdWQkFSQjZDMEVCRUhzTUJnc1FkRUgvQVhFa1FRd0RDeU0vUVFGeFFRQkxCRUJCQVJCOEJVRUFFSHdMSXo4aUFFRUhkQ0FBUWY4QmNVRUJkbkpCL3dGeEpEOE1Bd3RCZnc4TEkwaEJBbXBCLy84RGNTUklEQUlMSTBoQkFXcEIvLzhEY1NSSURBRUxRUUFRZWtFQUVIdEJBQkI0QzBFRUR3c2dBRUgvQVhFa1FVRUlDeWdCQVg4Z0FFRVlkRUVZZFNJQlFZQUJjUVJBUVlBQ0lBQkJHSFJCR0hWclFYOXNJUUVMSUFFTEtRRUJmeUFBRUlJQklRRWpTQ0FCUVJoMFFSaDFha0gvL3dOeEpFZ2pTRUVCYWtILy93TnhKRWdMMkFVQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkVFY0VRQ0FBUVJGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TTZCRUJCemY0REVJQUJRZjhCY1NJQVFRRnhCRUJCemY0RElBQkJmbkVpQUVHQUFYRUVmMEVBSkQ0Z0FFSC9mbkVGUVFFa1BpQUFRWUFCY2dzUWRrSEVBQThMQzBFQkpFME1FQXNRZFVILy93TnhJZ0JCZ1A0RGNVRUlkU1JDSUFCQi93RnhKRU1qU0VFQ2FrSC8vd054SkVnTUVRc2pRMEgvQVhFalFrSC9BWEZCQ0hSeUl6OFFkZ3dRQ3lORFFmOEJjU05DUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrUWd3UUN5TkNRUUVRZVNOQ1FRRnFRZjhCY1NSQ0kwSUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBNExJMEpCZnhCNUkwSkJBV3RCL3dGeEpFSWpRZ1JBUVFBUWVnVkJBUkI2QzBFQkVIc01EUXNRZEVIL0FYRWtRZ3dLQzBFQlFRQWpQeUlCUVlBQmNVR0FBVVliSVFBalJrRUVka0VCY1NBQlFRRjBja0gvQVhFa1B3d0tDeEIwRUlNQlFRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBQ05EUWY4QmNTTkNRZjhCY1VFSWRISWlBVUVBRUg4Z0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkVJQUJCL3dGeEpFVkJBQkI3UVFnUEN5TkRRZjhCY1NOQ1FmOEJjVUVJZEhJUWdBRkIvd0Z4SkQ4TUNBc2pRMEgvQVhFalFrSC9BWEZCQ0hSeVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpFSU1DQXNqUTBFQkVIa2pRMEVCYWtIL0FYRWtReU5EQkVCQkFCQjZCVUVCRUhvTFFRQVFld3dHQ3lORFFYOFFlU05EUVFGclFmOEJjU1JESTBNRVFFRUFFSG9GUVFFUWVndEJBUkI3REFVTEVIUkIvd0Z4SkVNTUFndEJBVUVBSXo4aUFVRUJjVUVCUmhzaEFDTkdRUVIyUVFGeFFRZDBJQUZCL3dGeFFRRjJjaVEvREFJTFFYOFBDeU5JUVFGcVFmLy9BM0VrU0F3QkN5QUFCRUJCQVJCOEJVRUFFSHdMUVFBUWVrRUFFSHRCQUJCNEMwRUVEd3NnQUVIL0FYRWtRMEVJQzdnR0FRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCSUVjRVFDQUFRU0ZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lOR1FRZDJRUUZ4QkVBalNFRUJha0gvL3dOeEpFZ0ZFSFFRZ3dFTFFRZ1BDeEIxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSU05JUVFKcVFmLy9BM0VrU0F3UUN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFDTS9FSFlnQUVFQmFrSC8vd054SWdCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVVTUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JVRUlEd3NqUkVFQkVIa2pSRUVCYWtIL0FYRWtSQ05FQkVCQkFCQjZCVUVCRUhvTFFRQVFld3dOQ3lORVFYOFFlU05FUVFGclFmOEJjU1JFSTBRRVFFRUFFSG9GUVFFUWVndEJBUkI3REF3TEVIUkIvd0Z4SkVRTUNndEJCa0VBSTBaQkJYWkJBWEZCQUVzYklRRWdBVUhnQUhJZ0FTTkdRUVIyUVFGeFFRQkxHeUVCSTBaQkJuWkJBWEZCQUVzRWZ5TS9JQUZyUWY4QmNRVWdBVUVHY2lBQkl6OGlBRUVQY1VFSlN4c2lBVUhnQUhJZ0FTQUFRWmtCU3hzaUFTQUFha0gvQVhFTElnQUVRRUVBRUhvRlFRRVFlZ3NnQVVIZ0FIRUVRRUVCRUh3RlFRQVFmQXRCQUJCNElBQWtQd3dLQ3lOR1FRZDJRUUZ4UVFCTEJFQVFkQkNEQVFValNFRUJha0gvL3dOeEpFZ0xRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQVNBQlFmLy9BM0ZCQUJCL0lBRkJBWFJCLy84RGNTSUJRWUQrQTNGQkNIVWtSQ0FCUWY4QmNTUkZRUUFRZTBFSUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnRVFnQUZCL3dGeEpEOGdBVUVCYWtILy93TnhJZ0ZCZ1A0RGNVRUlkU1JFSUFGQi93RnhKRVVNQndzalJVSC9BWEVqUkVIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQVVHQS9nTnhRUWgxSkVRZ0FVSC9BWEVrUlVFSUR3c2pSVUVCRUhralJVRUJha0gvQVhFa1JTTkZCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d0ZDeU5GUVg4UWVTTkZRUUZyUWY4QmNTUkZJMFVFUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQVFMRUhSQi93RnhKRVVNQWdzalAwRi9jMEgvQVhFa1AwRUJFSHRCQVJCNERBSUxRWDhQQ3lOSVFRRnFRZi8vQTNFa1NBdEJCQXVVQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFd1J3UkFJQUJCTVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEkwWkJCSFpCQVhFRVFDTklRUUZxUWYvL0EzRWtTQVVRZEJDREFRdEJDQThMRUhWQi8vOERjU1JISTBoQkFtcEIvLzhEY1NSSURCSUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUFJejhRZGd3T0N5TkhRUUZxUWYvL0EzRWtSMEVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdBUWdBRWlBVUVCRUhrZ0FVRUJha0gvQVhFaUFRUkFRUUFRZWdWQkFSQjZDMEVBRUhzTURRc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnQVFnQUVpQVVGL0VIa2dBVUVCYTBIL0FYRWlBUVJBUVFBUWVnVkJBUkI2QzBFQkVIc01EQXNqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSFJCL3dGeEVIWU1EQXRCQUJCN1FRQVFlRUVCRUh3TURBc2pSa0VFZGtFQmNVRUJSZ1JBRUhRUWd3RUZJMGhCQVdwQi8vOERjU1JJQzBFSUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnRWpSMEVBRUg4alJ5QUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkVJQUJCL3dGeEpFVkJBQkI3UVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFCQ0FBVUgvQVhFa1B3d0dDeU5IUVFGclFmLy9BM0VrUjBFSUR3c2pQMEVCRUhralAwRUJha0gvQVhFa1B5TS9CRUJCQUJCNkJVRUJFSG9MUVFBUWV3d0hDeU0vUVg4UWVTTS9RUUZyUWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQVlMRUhSQi93RnhKRDhNQkF0QkFCQjdRUUFRZUNOR1FRUjJRUUZ4UVFCTEJFQkJBQkI4QlVFQkVId0xEQVFMUVg4UEN5QUFRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSUXdDQ3lBQVFmLy9BM0VnQVJCMkRBRUxJMGhCQVdwQi8vOERjU1JJQzBFRUMrUUJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUJIQkVBZ0FFSEJBRVlOQVFKQUlBQkJ3Z0JyRGc0REJBVUdCd2dKRVFvTERBME9Ed0FMREE4TERBOExJMEVrUUF3T0N5TkNKRUFNRFFzalF5UkFEQXdMSTBRa1FBd0xDeU5GSkVBTUNnc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSQURBa0xJejhrUUF3SUN5TkFKRUVNQndzalFpUkJEQVlMSTBNa1FRd0ZDeU5FSkVFTUJBc2pSU1JCREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFVSC9BWEVrUVF3Q0N5TS9KRUVNQVF0QmZ3OExRUVFMM3dFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFCSEJFQWdBRUhSQUVZTkFRSkFJQUJCMGdCckRnNFFBd1FGQmdjSUNRb1FDd3dORGdBTERBNExJMEFrUWd3T0N5TkJKRUlNRFFzalF5UkNEQXdMSTBRa1Fnd0xDeU5GSkVJTUNnc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSQ0RBa0xJejhrUWd3SUN5TkFKRU1NQndzalFTUkREQVlMSTBJa1F3d0ZDeU5FSkVNTUJBc2pSU1JEREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFVSC9BWEVrUXd3Q0N5TS9KRU1NQVF0QmZ3OExRUVFMM3dFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFCSEJFQWdBRUhoQUVZTkFRSkFJQUJCNGdCckRnNERCQkFGQmdjSUNRb0xEQkFORGdBTERBNExJMEFrUkF3T0N5TkJKRVFNRFFzalFpUkVEQXdMSTBNa1JBd0xDeU5GSkVRTUNnc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSRURBa0xJejhrUkF3SUN5TkFKRVVNQndzalFTUkZEQVlMSTBJa1JRd0ZDeU5ESkVVTUJBc2pSQ1JGREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFVSC9BWEVrUlF3Q0N5TS9KRVVNQVF0QmZ3OExRUVFMN0FJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FFY0VRQ0FBUWZFQVJnMEJBa0FnQUVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UkFBc01Ed3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJMEFRZGd3UEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJalFSQjJEQTRMSTBWQi93RnhJMFJCL3dGeFFRaDBjaU5DRUhZTURRc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUkwTVFkZ3dNQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUkJCMkRBc0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpTkZFSFlNQ2dzanhRRkZCRUFDUUNPWkFRUkFRUUVrU2d3QkN5TitJNFFCY1VFZmNVVUVRRUVCSkVzTUFRdEJBU1JNQ3dzTUNRc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUl6OFFkZ3dJQ3lOQUpEOE1Cd3NqUVNRL0RBWUxJMElrUHd3RkN5TkRKRDhNQkFzalJDUS9EQU1MSTBVa1B3d0NDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUZCL3dGeEpEOE1BUXRCZnc4TFFRUUxTUUVCZnlBQlFRQk9CRUFnQUVIL0FYRWdBQ0FCYWtIL0FYRkxCRUJCQVJCOEJVRUFFSHdMQlNBQlFSOTFJZ0lnQVNBQ2FuTWdBRUgvQVhGS0JFQkJBUkI4QlVFQUVId0xDd3MwQVFGL0l6OGdBRUgvQVhFaUFSQjVJejhnQVJDTEFTTS9JQUJxUWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFCQjdDMndCQW44alB5QUFhaU5HUVFSMlFRRnhha0gvQVhFaUFTRUNJejhnQUhNZ0FYTkJFSEVFUUVFQkVIZ0ZRUUFRZUFzalB5QUFRZjhCY1dvalJrRUVka0VCY1dwQmdBSnhRUUJMQkVCQkFSQjhCVUVBRUh3TElBSWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRQVFld3Z4QVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWUFCUndSQUlBRkJnUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lOQUVJd0JEQkFMSTBFUWpBRU1Ed3NqUWhDTUFRd09DeU5ERUl3QkRBMExJMFFRakFFTURBc2pSUkNNQVF3TEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFqQUVNQ2dzalB4Q01BUXdKQ3lOQUVJMEJEQWdMSTBFUWpRRU1Cd3NqUWhDTkFRd0dDeU5ERUkwQkRBVUxJMFFRalFFTUJBc2pSUkNOQVF3REN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFqUUVNQWdzalB4Q05BUXdCQzBGL0R3dEJCQXMzQVFGL0l6OGdBRUgvQVhGQmYyd2lBUkI1SXo4Z0FSQ0xBU00vSUFCclFmOEJjU1EvSXo4RVFFRUFFSG9GUVFFUWVndEJBUkI3QzJ3QkFuOGpQeUFBYXlOR1FRUjJRUUZ4YTBIL0FYRWlBU0VDSXo4Z0FITWdBWE5CRUhFRVFFRUJFSGdGUVFBUWVBc2pQeUFBUWY4QmNXc2pSa0VFZGtFQmNXdEJnQUp4UVFCTEJFQkJBUkI4QlVFQUVId0xJQUlrUHlNL0JFQkJBQkI2QlVFQkVIb0xRUUVRZXd2eEFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUVpBQlJ3UkFJQUZCa1FGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TkFFSThCREJBTEkwRVFqd0VNRHdzalFoQ1BBUXdPQ3lOREVJOEJEQTBMSTBRUWp3RU1EQXNqUlJDUEFRd0xDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRandFTUNnc2pQeENQQVF3SkN5TkFFSkFCREFnTEkwRVFrQUVNQndzalFoQ1FBUXdHQ3lOREVKQUJEQVVMSTBRUWtBRU1CQXNqUlJDUUFRd0RDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRa0FFTUFnc2pQeENRQVF3QkMwRi9Ed3RCQkFzakFDTS9JQUJ4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFSQjRRUUFRZkFzbkFDTS9JQUJ6UWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFCQjdRUUFRZUVFQUVId0w4UUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR2dBVWNFUUNBQlFhRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqUUJDU0FRd1FDeU5CRUpJQkRBOExJMElRa2dFTURnc2pReENTQVF3TkN5TkVFSklCREF3TEkwVVFrZ0VNQ3dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQkVKSUJEQW9MSXo4UWtnRU1DUXNqUUJDVEFRd0lDeU5CRUpNQkRBY0xJMElRa3dFTUJnc2pReENUQVF3RkN5TkVFSk1CREFRTEkwVVFrd0VNQXdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQkVKTUJEQUlMSXo4UWt3RU1BUXRCZnc4TFFRUUxKd0FqUHlBQWNrSC9BWEVrUHlNL0JFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIaEJBQkI4Q3k4QkFYOGpQeUFBUWY4QmNVRi9iQ0lCRUhralB5QUJFSXNCSXo4Z0FXb0VRRUVBRUhvRlFRRVFlZ3RCQVJCN0MvRUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQnNBRkhCRUFnQVVHeEFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJMEFRbFFFTUVBc2pRUkNWQVF3UEN5TkNFSlVCREE0TEkwTVFsUUVNRFFzalJCQ1ZBUXdNQ3lORkVKVUJEQXNMSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDVkFRd0tDeU0vRUpVQkRBa0xJMEFRbGdFTUNBc2pRUkNXQVF3SEN5TkNFSllCREFZTEkwTVFsZ0VNQlFzalJCQ1dBUXdFQ3lORkVKWUJEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDV0FRd0NDeU0vRUpZQkRBRUxRWDhQQzBFRUN6c0JBWDhnQUJCUklnRkJmMFlFZnlBQUVBRUZJQUVMUWY4QmNTQUFRUUZxSWdFUVVTSUFRWDlHQkg4Z0FSQUJCU0FBQzBIL0FYRkJDSFJ5Q3dzQVFRZ1FjeUFBRUpnQkMwTUFJQUJCZ0FGeFFZQUJSZ1JBUVFFUWZBVkJBQkI4Q3lBQVFRRjBJQUJCL3dGeFFRZDJja0gvQVhFaUFBUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRJQUFMUVFBZ0FFRUJjVUVBU3dSQVFRRVFmQVZCQUJCOEN5QUFRUWQwSUFCQi93RnhRUUYyY2tIL0FYRWlBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0SUFBTFR3RUJmMEVCUVFBZ0FFR0FBWEZCZ0FGR0d5RUJJMFpCQkhaQkFYRWdBRUVCZEhKQi93RnhJUUFnQVFSQVFRRVFmQVZCQUJCOEN5QUFCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGdnQUF0UUFRRi9RUUZCQUNBQVFRRnhRUUZHR3lFQkkwWkJCSFpCQVhGQkIzUWdBRUgvQVhGQkFYWnlJUUFnQVFSQVFRRVFmQVZCQUJCOEN5QUFCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGdnQUF0R0FRRi9RUUZCQUNBQVFZQUJjVUdBQVVZYklRRWdBRUVCZEVIL0FYRWhBQ0FCQkVCQkFSQjhCVUVBRUh3TElBQUVRRUVBRUhvRlFRRVFlZ3RCQUJCN1FRQVFlQ0FBQzE0QkFuOUJBVUVBSUFCQkFYRkJBVVliSVFGQkFVRUFJQUJCZ0FGeFFZQUJSaHNoQWlBQVFmOEJjVUVCZGlJQVFZQUJjaUFBSUFJYklnQUVRRUVBRUhvRlFRRVFlZ3RCQUJCN1FRQVFlQ0FCQkVCQkFSQjhCVUVBRUh3TElBQUxNQUFnQUVFUGNVRUVkQ0FBUWZBQmNVRUVkbklpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNFFRQVFmQ0FBQzBJQkFYOUJBVUVBSUFCQkFYRkJBVVliSVFFZ0FFSC9BWEZCQVhZaUFBUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRJQUVFUUVFQkVId0ZRUUFRZkFzZ0FBc2tBRUVCSUFCMElBRnhRZjhCY1FSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQVJCNElBRUxud2dCQm44Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkNHOGlCaUlGQkVBZ0JVRUJhdzRIQVFJREJBVUdCd2dMSTBBaEFRd0hDeU5CSVFFTUJnc2pRaUVCREFVTEkwTWhBUXdFQ3lORUlRRU1Bd3NqUlNFQkRBSUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBU0VCREFFTEl6OGhBUXNDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRTSUZJZ1FFUUNBRVFRRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeUFBUVFkTUJIOUJBU0VDSUFFUW1nRUZJQUJCRDB3RWYwRUJJUUlnQVJDYkFRVkJBQXNMSVFNTUR3c2dBRUVYVEFSL1FRRWhBaUFCRUp3QkJTQUFRUjlNQkg5QkFTRUNJQUVRblFFRlFRQUxDeUVEREE0TElBQkJKMHdFZjBFQklRSWdBUkNlQVFVZ0FFRXZUQVIvUVFFaEFpQUJFSjhCQlVFQUN3c2hBd3dOQ3lBQVFUZE1CSDlCQVNFQ0lBRVFvQUVGSUFCQlAwd0VmMEVCSVFJZ0FSQ2hBUVZCQUFzTElRTU1EQXNnQUVISEFFd0VmMEVCSVFKQkFDQUJFS0lCQlNBQVFjOEFUQVIvUVFFaEFrRUJJQUVRb2dFRlFRQUxDeUVEREFzTElBQkIxd0JNQkg5QkFTRUNRUUlnQVJDaUFRVWdBRUhmQUV3RWYwRUJJUUpCQXlBQkVLSUJCVUVBQ3dzaEF3d0tDeUFBUWVjQVRBUi9RUUVoQWtFRUlBRVFvZ0VGSUFCQjd3Qk1CSDlCQVNFQ1FRVWdBUkNpQVFWQkFBc0xJUU1NQ1FzZ0FFSDNBRXdFZjBFQklRSkJCaUFCRUtJQkJTQUFRZjhBVEFSL1FRRWhBa0VISUFFUW9nRUZRUUFMQ3lFRERBZ0xJQUJCaHdGTUJIOUJBU0VDSUFGQmZuRUZJQUJCandGTUJIOUJBU0VDSUFGQmZYRUZRUUFMQ3lFRERBY0xJQUJCbHdGTUJIOUJBU0VDSUFGQmUzRUZJQUJCbndGTUJIOUJBU0VDSUFGQmQzRUZRUUFMQ3lFRERBWUxJQUJCcHdGTUJIOUJBU0VDSUFGQmIzRUZJQUJCcndGTUJIOUJBU0VDSUFGQlgzRUZRUUFMQ3lFRERBVUxJQUJCdHdGTUJIOUJBU0VDSUFGQnYzOXhCU0FBUWI4QlRBUi9RUUVoQWlBQlFmOStjUVZCQUFzTElRTU1CQXNnQUVISEFVd0VmMEVCSVFJZ0FVRUJjZ1VnQUVIUEFVd0VmMEVCSVFJZ0FVRUNjZ1ZCQUFzTElRTU1Bd3NnQUVIWEFVd0VmMEVCSVFJZ0FVRUVjZ1VnQUVIZkFVd0VmMEVCSVFJZ0FVRUljZ1ZCQUFzTElRTU1BZ3NnQUVIbkFVd0VmMEVCSVFJZ0FVRVFjZ1VnQUVIdkFVd0VmMEVCSVFJZ0FVRWdjZ1ZCQUFzTElRTU1BUXNnQUVIM0FVd0VmMEVCSVFJZ0FVSEFBSElGSUFCQi93Rk1CSDlCQVNFQ0lBRkJnQUZ5QlVFQUN3c2hBd3NDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQVlpQkFSQUlBUkJBV3NPQndFQ0F3UUZCZ2NJQ3lBREpFQU1Cd3NnQXlSQkRBWUxJQU1rUWd3RkN5QURKRU1NQkFzZ0F5UkVEQU1MSUFNa1JRd0NDeUFGUVFSSUlnUUVmeUFFQlNBRlFRZEtDd1JBSTBWQi93RnhJMFJCL3dGeFFRaDBjaUFERUhZTERBRUxJQU1rUHd0QkJFRi9JQUliQys0REFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFVY0VRQ0FBUWNFQmF3NFBBUUlSQXdRRkJnY0lDUW9MRUF3TkRnc2pSa0VIZGtFQmNRMFJEQTRMSTBjUW1RRkIvLzhEY1NFQUkwZEJBbXBCLy84RGNTUkhJQUJCZ1A0RGNVRUlkU1JBSUFCQi93RnhKRUZCQkE4TEkwWkJCM1pCQVhFTkVRd09DeU5HUVFkMlFRRnhEUkFNREFzalIwRUNhMEgvL3dOeEpFY2pSeU5CUWY4QmNTTkFRZjhCY1VFSWRISVFmZ3dOQ3hCMEVJd0JEQTBMSTBkQkFtdEIvLzhEY1NSSEkwY2pTQkIrUVFBa1NBd0xDeU5HUVFkMlFRRnhRUUZIRFFvTUJ3c2pSeENaQVVILy93TnhKRWdqUjBFQ2FrSC8vd054SkVjTUNRc2pSa0VIZGtFQmNVRUJSZzBIREFvTEVIUkIvd0Z4RUtNQklRQWpTRUVCYWtILy93TnhKRWdnQUE4TEkwWkJCM1pCQVhGQkFVY05DQ05IUVFKclFmLy9BM0VrUnlOSEkwaEJBbXBCLy84RGNSQitEQVVMRUhRUWpRRU1CZ3NqUjBFQ2EwSC8vd054SkVjalJ5TklFSDVCQ0NSSURBUUxRWDhQQ3lOSEVKa0JRZi8vQTNFa1NDTkhRUUpxUWYvL0EzRWtSMEVNRHdzalIwRUNhMEgvL3dOeEpFY2pSeU5JUVFKcVFmLy9BM0VRZmdzUWRVSC8vd054SkVnTFFRZ1BDeU5JUVFGcVFmLy9BM0VrU0VFRUR3c2pTRUVDYWtILy93TnhKRWhCREF2VEF3QUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQVVjRVFDQUFRZEVCYXc0UEFRSU5Bd1FGQmdjSUNRMEtEUXNNRFFzalJrRUVka0VCY1EwUERBMExJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUkNJQUJCL3dGeEpFTkJCQThMSTBaQkJIWkJBWEVORHd3TUN5TkdRUVIyUVFGeERRNGpSMEVDYTBILy93TnhKRWNqUnlOSVFRSnFRZi8vQTNFUWZnd0xDeU5IUVFKclFmLy9BM0VrUnlOSEkwTkIvd0Z4STBKQi93RnhRUWgwY2hCK0RBc0xFSFFRandFTUN3c2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJFQ1JJREFrTEkwWkJCSFpCQVhGQkFVY05DQXdHQ3lOSEVKa0JRZi8vQTNFa1NFRUJKSm9CSTBkQkFtcEIvLzhEY1NSSERBY0xJMFpCQkhaQkFYRkJBVVlOQlF3SUN5TkdRUVIyUVFGeFFRRkhEUWNqUjBFQ2EwSC8vd054SkVjalJ5TklRUUpxUWYvL0EzRVFmZ3dFQ3hCMEVKQUJEQVVMSTBkQkFtdEIvLzhEY1NSSEkwY2pTQkIrUVJna1NBd0RDMEYvRHdzalJ4Q1pBVUgvL3dOeEpFZ2pSMEVDYWtILy93TnhKRWRCREE4TEVIVkIvLzhEY1NSSUMwRUlEd3NqU0VFQmFrSC8vd054SkVoQkJBOExJMGhCQW1wQi8vOERjU1JJUVF3TDhBSUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUZIQkVBZ0FFSGhBV3NPRHdFQ0N3c0RCQVVHQndnTEN3c0pDZ3NMRUhSQi93RnhRWUQrQTJvalB4QjJEQXNMSTBjUW1RRkIvLzhEY1NFQUkwZEJBbXBCLy84RGNTUkhJQUJCZ1A0RGNVRUlkU1JFSUFCQi93RnhKRVZCQkE4TEkwRkJnUDREYWlNL0VIWkJCQThMSTBkQkFtdEIvLzhEY1NSSEkwY2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVINUJDQThMRUhRUWtnRU1Cd3NqUjBFQ2EwSC8vd054SkVjalJ5TklFSDVCSUNSSVFRZ1BDeEIwRUlJQlFSaDBRUmgxSVFBalJ5QUFRUUVRZnlOSElBQnFRZi8vQTNFa1IwRUFFSHBCQUJCN0kwaEJBV3BCLy84RGNTUklRUXdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElrU0VFRUR3c1FkVUgvL3dOeEl6OFFkaU5JUVFKcVFmLy9BM0VrU0VFRUR3c1FkQkNUQVF3Q0N5TkhRUUpyUWYvL0EzRWtSeU5ISTBnUWZrRW9KRWhCQ0E4TFFYOFBDeU5JUVFGcVFmLy9BM0VrU0VFRUM2Y0RBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJSd1JBSUFCQjhRRnJEZzhCQWdNTkJBVUdCd2dKQ2cwTkN3d05DeEIwUWY4QmNVR0EvZ05xRUlBQlFmOEJjU1EvREEwTEkwY1FtUUZCLy84RGNTRUFJMGRCQW1wQi8vOERjU1JISUFCQmdQNERjVUVJZFNRL0lBQkIvd0Z4SkVZTURRc2pRVUdBL2dOcUVJQUJRZjhCY1NRL0RBd0xRUUFrbVFFTUN3c2pSMEVDYTBILy93TnhKRWNqUnlOR1FmOEJjU00vUWY4QmNVRUlkSElRZmtFSUR3c1FkQkNWQVF3SUN5TkhRUUpyUWYvL0EzRWtSeU5ISTBnUWZrRXdKRWhCQ0E4TEVIUVFnZ0VoQUVFQUVIcEJBQkI3STBjZ0FFRVlkRUVZZFNJQVFRRVFmeU5ISUFCcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlNOSVFRRnFRZi8vQTNFa1NFRUlEd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlKRWRCQ0E4TEVIVkIvLzhEY1JDQUFVSC9BWEVrUHlOSVFRSnFRZi8vQTNFa1NBd0ZDMEVCSkpvQkRBUUxFSFFRbGdFTUFnc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJPQ1JJUVFnUEMwRi9Ed3NqU0VFQmFrSC8vd054SkVnTFFRUUwzQUVCQVg4alNFRUJha0gvL3dOeEpFZ2pUQVJBSTBoQkFXdEIvLzhEY1NSSUN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lCQkVBZ0FVRUJSZzBCQWtBZ0FVRUNhdzROQXdRRkJnY0lDUW9MREEwT0R3QUxEQThMSUFBUWdRRVBDeUFBRUlRQkR3c2dBQkNGQVE4TElBQVFoZ0VQQ3lBQUVJY0JEd3NnQUJDSUFROExJQUFRaVFFUEN5QUFFSW9CRHdzZ0FCQ09BUThMSUFBUWtRRVBDeUFBRUpRQkR3c2dBQkNYQVE4TElBQVFwQUVQQ3lBQUVLVUJEd3NnQUJDbUFROExJQUFRcHdFTHdnRUJBbjlCQUNTWkFVR1AvZ01RQVVFQklBQjBRWDl6Y1NJQkpJUUJRWS8rQXlBQkVBUWpSMEVDYTBILy93TnhKRWNDUUNOS0lnRWpTeUFCR3cwQUN5TkhJZ0VqU0NJQ1FmOEJjUkFFSUFGQkFXb2dBa0dBL2dOeFFRaDFFQVFDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdNREJBVUFDd3dGQzBFQUpIOUJ3QUFrU0F3RUMwRUFKSUFCUWNnQUpFZ01Bd3RCQUNTQkFVSFFBQ1JJREFJTFFRQWtnZ0ZCMkFBa1NBd0JDMEVBSklNQlFlQUFKRWdMQy9rQkFRTi9JNW9CQkVCQkFTU1pBVUVBSkpvQkN5TitJNFFCY1VFZmNVRUFTZ1JBSTB0Rkk1a0JJZ0lnQWhzRWZ5Ti9JM2tpQUNBQUd3Ui9RUUFRcVFGQkFRVWpnQUVqZWlJQUlBQWJCSDlCQVJDcEFVRUJCU09CQVNON0lnQWdBQnNFZjBFQ0VLa0JRUUVGSTRJQkkzd2lBQ0FBR3dSL1FRTVFxUUZCQVFVamd3RWpmU0lBSUFBYkJIOUJCQkNwQVVFQkJVRUFDd3NMQ3dzRlFRQUxCRUFDZjBFQkkwb2lBQ05MSUFBYkRRQWFRUUFMQkg5QkFDUkxRUUFrU2tFQUpFeEJBQ1JOUVJnRlFSUUxJUUVMQW45QkFTTktJZ0FqU3lBQUd3MEFHa0VBQ3dSQVFRQWtTMEVBSkVwQkFDUk1RUUFrVFFzZ0FROExRUUFMdVFFQkFuOUJBU1F0STB3RVFDTklFQUZCL3dGeEVLZ0JFSE5CQUNSTFFRQWtTa0VBSkV4QkFDUk5DeENxQVNJQlFRQktCRUFnQVJCekMwRUVJUUFDZjBFQkkwb2lBU05MSUFFYkRRQWFRUUFMUlNJQkJIOGpUVVVGSUFFTEJFQWpTQkFCUWY4QmNSQ29BU0VBQ3lOR1FmQUJjU1JHSUFCQkFFd0VRQ0FBRHdzZ0FCQnpJNWNCUVFGcUpKY0JJNWNCSTVVQlRnUkFJNVlCUVFGcUpKWUJJNWNCSTVVQmF5U1hBUXNqU0NPTEFrWUVRRUVCSk1FQkN5QUFDd1FBSTJvTDBnRUJCSDhnQUVGL1FZQUlJQUJCQUVnYklBQkJBRW9iSVFOQkFDRUFBMEFDZndKL0lBUkZJZ0VFUUNBQVJTRUJDeUFCQ3dSQUlBSkZJUUVMSUFFTEJFQWp3UUZGSVFFTElBRUVRQkNyQVVFQVNBUkFRUUVoQkFValNTTStCSDlCb01rSUJVSFFwQVFMVGdSQVFRRWhBQVVnQTBGL1NpSUJCRUFqYWlBRFRpRUJDMEVCSUFJZ0FSc2hBZ3NMREFFTEN5QUFCRUFqU1NNK0JIOUJvTWtJQlVIUXBBUUxheVJKSTR3Q0R3c2dBZ1JBSTQwQ0R3c2p3UUVFUUVFQUpNRUJJNDRDRHdzalNFRUJhMEgvL3dOeEpFaEJmd3NIQUVGL0VLMEJDemtCQTM4RFFDQUNJQUJJSWdNRWZ5QUJRUUJPQlNBREN3UkFRWDhRclFFaEFTQUNRUUZxSVFJTUFRc0xJQUZCQUVnRVFDQUJEd3RCQUFzRkFDT1NBUXNGQUNPVEFRc0ZBQ09VQVF0ZkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lQc0FROExJKzBCRHdzajdnRVBDeVB2QVE4TEkvQUJEd3NqOFFFUEN5UHlBUThMSS9NQkR3dEJBQXVMQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUFpQWtFQlJnMEJBa0FnQWtFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQVVFQVJ5VHNBUXdIQ3lBQlFRQkhKTzBCREFZTElBRkJBRWNrN2dFTUJRc2dBVUVBUnlUdkFRd0VDeUFCUVFCSEpQQUJEQU1MSUFGQkFFY2s4UUVNQWdzZ0FVRUFSeVR5QVF3QkN5QUJRUUJISlBNQkN3dFVBUUYvUVFBa1RTQUFFTE1CUlFSQVFRRWhBUXNnQUVFQkVMUUJJQUVFUUVFQlFRRkJBRUVCUVFBZ0FFRURUQnNpQVNPL0FTSUFJQUFiR3lBQlJTUEFBU0lBSUFBYkd3UkFRUUVrZ3dGQkJCQTZDd3NMQ1FBZ0FFRUFFTFFCQzVvQkFDQUFRUUJLQkVCQkFCQzFBUVZCQUJDMkFRc2dBVUVBU2dSQVFRRVF0UUVGUVFFUXRnRUxJQUpCQUVvRVFFRUNFTFVCQlVFQ0VMWUJDeUFEUVFCS0JFQkJBeEMxQVFWQkF4QzJBUXNnQkVFQVNnUkFRUVFRdFFFRlFRUVF0Z0VMSUFWQkFFb0VRRUVGRUxVQkJVRUZFTFlCQ3lBR1FRQktCRUJCQmhDMUFRVkJCaEMyQVFzZ0IwRUFTZ1JBUVFjUXRRRUZRUWNRdGdFTEN3Y0FJQUFraXdJTEJ3QkJmeVNMQWdzSEFDQUFKTWtCQ3djQVFYOGt5UUVMQndBZ0FDVDBBUXNIQUVGL0pQUUJDd1FBSXo4TEJBQWpRQXNFQUNOQkN3UUFJMElMQkFBalF3c0VBQ05FQ3dRQUkwVUxCQUFqUmdzRUFDTklDd1FBSTBjTEJnQWpTQkFCQ3dRQUkxWUxyd01CQ245QmdJQUNRWUNRQWlPNUFSc2hDVUdBdUFKQmdMQUNJN29CR3lFS0EwQWdCVUdBQWtnRVFFRUFJUVFEUUNBRVFZQUNTQVJBSUFrZ0JVRURkVUVGZENBS2FpQUVRUU4xYWlJRFFZQ1FmbW90QUFBUUxDRUlJQVZCQ0c4aEFVRUhJQVJCQ0c5cklRWkJBQ0VDQW44Z0FFRUFTaU02SWdjZ0J4c0VRQ0FEUVlEUWZtb3RBQUFoQWdzZ0FrSEFBSEVMQkVCQkJ5QUJheUVCQzBFQUlRY2dBVUVCZENBSWFpSURRWUNRZm1wQkFVRUFJQUpCQ0hFYklnZEJBWEZCRFhScUxRQUFJUWhCQUNFQklBTkJnWkIrYWlBSFFRRnhRUTEwYWkwQUFFRUJJQVowY1FSQVFRSWhBUXNnQVVFQmFpQUJRUUVnQm5RZ0NIRWJJUUVnQlVFSWRDQUVha0VEYkNFR0lBQkJBRW9qT2lJRElBTWJCRUFnQWtFSGNTQUJRUUFRTFNJQlFSOXhRUU4wSVFNZ0JrR0FvUXRxSWdJZ0F6b0FBQ0FDUVFGcUlBRkI0QWR4UVFWMVFRTjBPZ0FBSUFKQkFtb2dBVUdBK0FGeFFRcDFRUU4wT2dBQUJTQUJRY2YrQTBFQUVDNGhBa0VBSVFFRFFDQUJRUU5JQkVBZ0JrR0FvUXRxSUFGcUlBSTZBQUFnQVVFQmFpRUJEQUVMQ3dzZ0JFRUJhaUVFREFFTEN5QUZRUUZxSVFVTUFRc0xDOW9EQVF4L0EwQWdBMEVYVGtVRVFFRUFJUUlEUUNBQ1FSOUlCRUJCQVVFQUlBSkJEMG9iSVFrZ0EwRVBheUFESUFOQkQwb2JRUVIwSWdjZ0FrRVBhMm9nQWlBSGFpQUNRUTlLR3lFSFFZQ1FBa0dBZ0FJZ0EwRVBTaHNoQzBISC9nTWhDa0YvSVFGQmZ5RUlRUUFoQkFOQUlBUkJDRWdFUUVFQUlRQURRQ0FBUVFWSUJFQWdBRUVEZENBRWFrRUNkQ0lGUVlMOEEyb1FBU0FIUmdSQUlBVkJnL3dEYWhBQklRWkJBVUVBSUFaQkNIRkJBRWNqT2lNNkd4c2dDVVlFUUVFSUlRUkJCU0VBSUFZaUNFRVFjUVIvUWNuK0F3VkJ5UDREQ3lFS0N3c2dBRUVCYWlFQURBRUxDeUFFUVFGcUlRUU1BUXNMSUFoQkFFZ2pPaUlHSUFZYkJFQkJnTGdDUVlDd0FpTzZBUnNoQkVGL0lRQkJBQ0VCQTBBZ0FVRWdTQVJBUVFBaEJRTkFJQVZCSUVnRVFDQUZRUVYwSUFScUlBRnFJZ1pCZ0pCK2FpMEFBQ0FIUmdSQVFTQWhCU0FHSVFCQklDRUJDeUFGUVFGcUlRVU1BUXNMSUFGQkFXb2hBUXdCQ3dzZ0FFRUFUZ1IvSUFCQmdOQithaTBBQUFWQmZ3c2hBUXRCQUNFQUEwQWdBRUVJU0FSQUlBY2dDeUFKUVFCQkJ5QUFJQUpCQTNRZ0EwRURkQ0FBYWtINEFVR0FvUmNnQ2lBQklBZ1FMeG9nQUVFQmFpRUFEQUVMQ3lBQ1FRRnFJUUlNQVFzTElBTkJBV29oQXd3QkN3c0xtQUlCQ1g4RFFDQUVRUWhPUlFSQVFRQWhBUU5BSUFGQkJVZ0VRQ0FCUVFOMElBUnFRUUowSWdCQmdQd0RhaEFCR2lBQVFZSDhBMm9RQVJvZ0FFR0MvQU5xRUFFaEFrRUJJUVVqdXdFRVFDQUNRUUp2UVFGR0JFQWdBa0VCYXlFQ0MwRUNJUVVMSUFCQmcvd0RhaEFCSVFaQkFDRUhRUUZCQUNBR1FRaHhRUUJISXpvak9oc2JJUWRCeVA0RElRaEJ5ZjREUWNqK0F5QUdRUkJ4R3lFSVFRQWhBQU5BSUFBZ0JVZ0VRRUVBSVFNRFFDQURRUWhJQkVBZ0FDQUNha0dBZ0FJZ0IwRUFRUWNnQXlBRVFRTjBJQUZCQkhRZ0Eyb2dBRUVEZEdwQndBQkJnS0VnSUFoQmZ5QUdFQzhhSUFOQkFXb2hBd3dCQ3dzZ0FFRUJhaUVBREFFTEN5QUJRUUZxSVFFTUFRc0xJQVJCQVdvaEJBd0JDd3NMQlFBamhnRUxCUUFqaHdFTEJRQWppQUVMR0FFQmZ5T0tBU0VBSTRrQkJFQWdBRUVFY2lFQUN5QUFDekFCQVg4RFFBSkFJQUJCLy84RFRnMEFJQUJCZ0tISkJHb2dBQkJTT2dBQUlBQkJBV29oQUF3QkN3dEJBQ1RCQVFzVUFEOEFRWlFCU0FSQVFaUUJQd0JyUUFBYUN3c0RBQUVMSFFBQ1FBSkFBa0FqblFJT0FnRUNBQXNBQzBFQUlRQUxJQUFRclFFTEJ3QWdBQ1NkQWdzbEFBSkFBa0FDUUFKQUk1MENEZ01CQWdNQUN3QUxRUUVoQUF0QmZ5RUJDeUFCRUswQkN3QXpFSE52ZFhKalpVMWhjSEJwYm1kVlVrd2hZMjl5WlM5a2FYTjBMMk52Y21VdWRXNTBiM1ZqYUdWa0xuZGhjMjB1YldGdyIpOgoidW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3d8fCJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY/YXdhaXQgRygiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJpUUVTWUFwL2YzOS9mMzkvZjM5L0FHQUFBR0FCZndGL1lBSi9md0JnQVg4QVlBSi9md0YvWUFBQmYyQURmMzkvQUdBR2YzOS9mMzkvQUdBSGYzOS9mMzkvZndGL1lBTi9mMzhCZjJBSGYzOS9mMzkvZndCZ0JIOS9mMzhCZjJBSWYzOS9mMzkvZjM4QVlBVi9mMzkvZndGL1lBMS9mMzkvZjM5L2YzOS9mMzkvQVg5Z0FBQmdBWDhCZndQWkFkY0JBZ0lCQVFNQkFRRUJBUUVCQVFFRUJBRUJBUUFHQVFFQkFRRUJBUUVFQkFFQkFRRUJBUUVCQmdZR0JnNEZDZ29QQ1FzSUNBY0hBd1FCQVFRQkJBRUJBUUVCQWdJRkFnSUNBZ1VNQkFRRUFRSUdBZ0lEQkFRRUJBRUJBUUVFQlFRR0JnUURBZ1VFQVJBRUJRTUhBUVVCQkFFRkJBUUdCZ01GQkFNRUJBUURBd2NDQWdJRUFnSUNBZ0lDQWdNRUJBSUVCQUlFQkFJRUJBSUNBZ0lDQWdJQ0FnSUNCUUlDQWdJQ0FnUUdCZ1lSQmdJR0JnWUNBd1FFRFFRQkJBRUVBUVlHQmdZR0JnWUdCZ1lHQmdRQkFRWUdCZ1lCQVFFQ0JBVUVCQUZ3QUFFRkF3RUFBQWFyREo0Q2Z3QkJBQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUVBdC9BRUdBZ0FFTGZ3QkJnSkFCQzM4QVFZQ0FBZ3QvQUVHQWtBTUxmd0JCZ0lBQkMzOEFRWUFRQzM4QVFZQ0FCQXQvQUVHQWtBUUxmd0JCZ0FFTGZ3QkJnSkVFQzM4QVFZQzRBUXQvQUVHQXlRVUxmd0JCZ05nRkMzOEFRWUNoQ3d0L0FFR0FnQXdMZndCQmdLRVhDMzhBUVlDQUNRdC9BRUdBb1NBTGZ3QkJnUGdBQzM4QVFZQ1FCQXQvQUVHQWlSMExmd0JCZ0praEMzOEFRWUNBQ0F0L0FFR0FtU2tMZndCQmdJQUlDMzhBUVlDWk1RdC9BRUdBZ0FnTGZ3QkJnSms1QzM4QVFZQ0FDQXQvQUVHQW1jRUFDMzhBUVlDQUNBdC9BRUdBbWNrQUMzOEFRWUNBQ0F0L0FFR0FtZEVBQzM4QVFZQ0krQU1MZndCQmdLSEpCQXQvQUVILy93TUxmd0JCQUF0L0FFR0FvYzBFQzM4QVFaUUJDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhQL2dNTGZ3RkJBQXQvQVVIdy9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCL3dBTGZ3RkIvd0FMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCZ0tqV3VRY0xmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJnUGNDQzM4QlFZQ0FDQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCMWY0REMzOEJRZEgrQXd0L0FVSFMvZ01MZndGQjAvNERDMzhCUWRUK0F3dC9BVUhvL2dNTGZ3RkI2LzREQzM4QlFlbitBd3QvQVVGL0MzOEJRUUFMZndGQkFRdC9BVUVDQzM4QVFZQ2h6UVFMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQkFMZndCQmdJQUVDMzhBUVlDUUJBdC9BRUdBa0FRTGZ3QkJnQUVMZndCQmdNa0ZDMzhBUVlDaEN3dC9BRUdBb1JjTGZ3QkJnSm5CQUF0L0FFR0FtY2tBQzM4QVFZQ1owUUFMZndGQkFBc0hxaE53Qm0xbGJXOXllUUlBQlhSaFlteGxBUUFHWTI5dVptbG5BQk1PYUdGelEyOXlaVk4wWVhKMFpXUUFGQWx6WVhabFUzUmhkR1VBR3dsc2IyRmtVM1JoZEdVQUpnVnBjMGRDUXdBbkVtZGxkRk4wWlhCelVHVnlVM1JsY0ZObGRBQW9DMmRsZEZOMFpYQlRaWFJ6QUNrSVoyVjBVM1JsY0hNQUtoVmxlR1ZqZFhSbFRYVnNkR2x3YkdWR2NtRnRaWE1BcndFTVpYaGxZM1YwWlVaeVlXMWxBSzRCQ0Y5elpYUmhjbWRqQU5VQkdXVjRaV04xZEdWR2NtRnRaVUZ1WkVOb1pXTnJRWFZrYVc4QTFBRVZaWGhsWTNWMFpWVnVkR2xzUTI5dVpHbDBhVzl1QU5ZQkMyVjRaV04xZEdWVGRHVndBS3NCRkdkbGRFTjVZMnhsYzFCbGNrTjVZMnhsVTJWMEFMQUJER2RsZEVONVkyeGxVMlYwY3dDeEFRbG5aWFJEZVdOc1pYTUFzZ0VPYzJWMFNtOTVjR0ZrVTNSaGRHVUF0d0VmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnQ3NBUkJqYkdWaGNrRjFaR2x2UW5WbVptVnlBQ0lYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERLaE5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXlzU1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF5d2VRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdBYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREFSWlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdJU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3TWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RENoeEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBd3NTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdRT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQlJGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNR0RWZFBVa3RmVWtGTlgxTkpXa1VEQnlaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTUlJazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURDUmhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNERHQlJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNWkZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9Bd3dRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1OR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01PRkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF3OE9SbEpCVFVWZlRFOURRVlJKVDA0REVBcEdVa0ZOUlY5VFNWcEZBeEVYUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERFaE5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhNU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4UU9WRWxNUlY5RVFWUkJYMU5KV2tVREZSSlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERGZzVQUVUxZlZFbE1SVk5mVTBsYVJRTVhGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNaUVVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF5TVpRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWFGVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZVMGxhUlFNYkdVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlRFOURRVlJKVDA0REhCVkRTRUZPVGtWTVh6SmZRbFZHUmtWU1gxTkpXa1VESFJsRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXg0VlEwaEJUazVGVEY4elgwSlZSa1pGVWw5VFNWcEZBeDhaUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01nRlVOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVTBsYVJRTWhGa05CVWxSU1NVUkhSVjlTUVUxZlRFOURRVlJKVDA0REpCSkRRVkpVVWtsRVIwVmZVa0ZOWDFOSldrVURKUlpEUVZKVVVrbEVSMFZmVWs5TlgweFBRMEZVU1U5T0F5WVNRMEZTVkZKSlJFZEZYMUpQVFY5VFNWcEZBeWNkUkVWQ1ZVZGZSMEZOUlVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0REtCbEVSVUpWUjE5SFFVMUZRazlaWDAxRlRVOVNXVjlUU1ZwRkF5a2haMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBQWJjMlYwVUhKdlozSmhiVU52ZFc1MFpYSkNjbVZoYTNCdmFXNTBBTGdCSFhKbGMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFMa0JHWE5sZEZKbFlXUkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUF1Z0ViY21WelpYUlNaV0ZrUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUxzQkduTmxkRmR5YVhSbFIySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFMd0JISEpsYzJWMFYzSnBkR1ZIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBdlFFTVoyVjBVbVZuYVhOMFpYSkJBTDRCREdkbGRGSmxaMmx6ZEdWeVFnQy9BUXhuWlhSU1pXZHBjM1JsY2tNQXdBRU1aMlYwVW1WbmFYTjBaWEpFQU1FQkRHZGxkRkpsWjJsemRHVnlSUURDQVF4blpYUlNaV2RwYzNSbGNrZ0F3d0VNWjJWMFVtVm5hWE4wWlhKTUFNUUJER2RsZEZKbFoybHpkR1Z5UmdERkFSRm5aWFJRY205bmNtRnRRMjkxYm5SbGNnREdBUTluWlhSVGRHRmphMUJ2YVc1MFpYSUF4d0VaWjJWMFQzQmpiMlJsUVhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0RJQVFWblpYUk1XUURKQVIxa2NtRjNRbUZqYTJkeWIzVnVaRTFoY0ZSdlYyRnpiVTFsYlc5eWVRREtBUmhrY21GM1ZHbHNaVVJoZEdGVWIxZGhjMjFOWlcxdmNua0F5d0VUWkhKaGQwOWhiVlJ2VjJGemJVMWxiVzl5ZVFETUFRWm5aWFJFU1ZZQXpRRUhaMlYwVkVsTlFRRE9BUVpuWlhSVVRVRUF6d0VHWjJWMFZFRkRBTkFCRTNWd1pHRjBaVVJsWW5WblIwSk5aVzF2Y25rQTBRRUdkWEJrWVhSbEFLNEJEV1Z0ZFd4aGRHbHZibE4wWlhBQXF3RVNaMlYwUVhWa2FXOVJkV1YxWlVsdVpHVjRBS3dCRDNKbGMyVjBRWFZrYVc5UmRXVjFaUUFpRG5kaGMyMU5aVzF2Y25sVGFYcGxBNDhDSEhkaGMyMUNiM2xKYm5SbGNtNWhiRk4wWVhSbFRHOWpZWFJwYjI0RGtBSVlkMkZ6YlVKdmVVbHVkR1Z5Ym1Gc1UzUmhkR1ZUYVhwbEE1RUNIV2RoYldWQ2IzbEpiblJsY201aGJFMWxiVzl5ZVV4dlkyRjBhVzl1QTVJQ0dXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVk5wZW1VRGt3SVRkbWxrWlc5UGRYUndkWFJNYjJOaGRHbHZiZ09VQWlKbWNtRnRaVWx1VUhKdlozSmxjM05XYVdSbGIwOTFkSEIxZEV4dlkyRjBhVzl1QTVjQ0cyZGhiV1ZpYjNsRGIyeHZjbEJoYkdWMGRHVk1iMk5oZEdsdmJnT1ZBaGRuWVcxbFltOTVRMjlzYjNKUVlXeGxkSFJsVTJsNlpRT1dBaFZpWVdOclozSnZkVzVrVFdGd1RHOWpZWFJwYjI0RG1BSUxkR2xzWlVSaGRHRk5ZWEFEbVFJVGMyOTFibVJQZFhSd2RYUk1iMk5oZEdsdmJnT2FBaEZuWVcxbFFubDBaWE5NYjJOaGRHbHZiZ09jQWhSbllXMWxVbUZ0UW1GdWEzTk1iMk5oZEdsdmJnT2JBZ2dDMGdFSkNBRUFRUUFMQWRNQkNxVGJBZGNCendFQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUNBQVFReDFJZ0ZGRFFBQ1FDQUJRUUZyRGcwQkFRRUNBZ0lDQXdNRUJBVUdBQXNNQmdzZ0FFR0FtZEVBYWc4TElBQkJBU000SWdBak9VVWlBUVIvSUFCRkJTQUJDeHRCRG5ScVFZQ1owQUJxRHdzZ0FFR0FrSDVxSXpvRWZ5TTdFQUZCQVhFRlFRQUxRUTEwYWc4TElBQWpQRUVOZEdwQmdObkdBR29QQ3lBQVFZQ1FmbW9QQzBFQUlRRUNmeU02QkVBalBSQUJRUWR4SVFFTElBRkJBVWdMQkVCQkFTRUJDeUFCUVF4MElBQnFRWUR3ZldvUEN5QUFRWUJRYWdzSkFDQUFFQUF0QUFBTG1RRUFRUUFrUGtFQUpEOUJBQ1JBUVFBa1FVRUFKRUpCQUNSRFFRQWtSRUVBSkVWQkFDUkdRUUFrUjBFQUpFaEJBQ1JKUVFBa1NrRUFKRXRCQUNSTVFRQWtUU002QkVCQkVTUS9RWUFCSkVaQkFDUkFRUUFrUVVIL0FTUkNRZFlBSkVOQkFDUkVRUTBrUlFWQkFTUS9RYkFCSkVaQkFDUkFRUk1rUVVFQUpFSkIyQUVrUTBFQkpFUkJ6UUFrUlF0QmdBSWtTRUgrL3dNa1J3dWtBUUVDZjBFQUpFNUJBU1JQUWNjQ0VBRWhBVUVBSkZCQkFDUlJRUUFrVWtFQUpGTkJBQ1E1SUFFRVFDQUJRUUZPSWdBRVFDQUJRUU5NSVFBTElBQUVRRUVCSkZFRklBRkJCVTRpQUFSQUlBRkJCa3doQUFzZ0FBUkFRUUVrVWdVZ0FVRVBUaUlBQkVBZ0FVRVRUQ0VBQ3lBQUJFQkJBU1JUQlNBQlFSbE9JZ0FFUUNBQlFSNU1JUUFMSUFBRVFFRUJKRGtMQ3dzTEJVRUJKRkFMUVFFa09FRUFKRHdMQ3dBZ0FCQUFJQUU2QUFBTEx3QkIwZjREUWY4QkVBUkIwdjREUWY4QkVBUkIwLzREUWY4QkVBUkIxUDREUWY4QkVBUkIxZjREUWY4QkVBUUxtQUVBUVFBa1ZFRUFKRlZCQUNSV1FRQWtWMEVBSkZoQkFDUlpRUUFrV2lNNkJFQkJrQUVrVmtIQS9nTkJrUUVRQkVIQi9nTkJnUUVRQkVIRS9nTkJrQUVRQkVISC9nTkIvQUVRQkFWQmtBRWtWa0hBL2dOQmtRRVFCRUhCL2dOQmhRRVFCRUhHL2dOQi93RVFCRUhIL2dOQi9BRVFCRUhJL2dOQi93RVFCRUhKL2dOQi93RVFCQXRCei80RFFRQVFCRUh3L2dOQkFSQUVDMDhBSXpvRVFFSG8vZ05Cd0FFUUJFSHAvZ05CL3dFUUJFSHEvZ05Cd1FFUUJFSHIvZ05CRFJBRUJVSG8vZ05CL3dFUUJFSHAvZ05CL3dFUUJFSHEvZ05CL3dFUUJFSHIvZ05CL3dFUUJBc0xMd0JCa1A0RFFZQUJFQVJCa2Y0RFFiOEJFQVJCa3Y0RFFmTUJFQVJCay80RFFjRUJFQVJCbFA0RFFiOEJFQVFMTEFCQmxmNERRZjhCRUFSQmx2NERRVDhRQkVHWC9nTkJBQkFFUVpqK0EwRUFFQVJCbWY0RFFiZ0JFQVFMTWdCQm12NERRZjhBRUFSQm0vNERRZjhCRUFSQm5QNERRWjhCRUFSQm5mNERRUUFRQkVHZS9nTkJ1QUVRQkVFQkpHc0xMUUJCbi80RFFmOEJFQVJCb1A0RFFmOEJFQVJCb2Y0RFFRQVFCRUdpL2dOQkFCQUVRYVArQTBHL0FSQUVDemdBUVE4a2JFRVBKRzFCRHlSdVFROGtiMEVBSkhCQkFDUnhRUUFrY2tFQUpITkIvd0FrZEVIL0FDUjFRUUVrZGtFQkpIZEJBQ1I0QzJjQVFRQWtXMEVBSkZ4QkFDUmRRUUVrWGtFQkpGOUJBU1JnUVFFa1lVRUJKR0pCQVNSalFRRWtaRUVCSkdWQkFTUm1RUUFrWjBFQUpHaEJBQ1JwUVFBa2FoQUlFQWtRQ2hBTFFhVCtBMEgzQUJBRVFhWCtBMEh6QVJBRVFhYitBMEh4QVJBRUVBd0xPQUFnQUVFQmNVRUFSeVI1SUFCQkFuRkJBRWNrZWlBQVFRUnhRUUJISkhzZ0FFRUljVUVBUnlSOElBQkJFSEZCQUVja2ZTQUFKSDRMUFFBZ0FFRUJjVUVBUnlSL0lBQkJBbkZCQUVja2dBRWdBRUVFY1VFQVJ5U0JBU0FBUVFoeFFRQkhKSUlCSUFCQkVIRkJBRWNrZ3dFZ0FDU0VBUXRkQUVFQUpJVUJRUUFraGdGQkFDU0hBVUVBSklnQlFRQWtpUUZCQUNTS0FVRUFKSXNCUVFBa2pBRWpPZ1JBUVlUK0EwRWVFQVJCb0Qwa2hnRUZRWVQrQTBHckFSQUVRY3pYQWlTR0FRdEJoLzREUWZnQkVBUkIrQUVraWdFTFFnQkJBQ1NOQVVFQUpJNEJJem9FUUVHQy9nTkIvQUFRQkVFQUpJOEJRUUFra0FGQkFDU1JBUVZCZ3Y0RFFmNEFFQVJCQUNTUEFVRUJKSkFCUVFBa2tRRUxDL1lCQVFKL1FjTUNFQUVpQVVIQUFVWWlBQVIvSUFBRklBRkJnQUZHSXk4aUFDQUFHd3NFUUVFQkpEb0ZRUUFrT2dzUUFoQURFQVVRQmhBSEVBMUJBQkFPUWYvL0F5TitFQVJCNFFFUUQwR1AvZ01qaEFFUUJCQVFFQkVqT2dSQVFmRCtBMEg0QVJBRVFjLytBMEgrQVJBRVFjMytBMEgrQUJBRVFZRCtBMEhQQVJBRVFZLytBMEhoQVJBRVFleitBMEgrQVJBRVFmWCtBMEdQQVJBRUJVSHcvZ05CL3dFUUJFSFAvZ05CL3dFUUJFSE4vZ05CL3dFUUJFR0EvZ05CendFUUJFR1AvZ05CNFFFUUJBdEJBQ1F0UVlDbzFya0hKSklCUVFBa2t3RkJBQ1NVQVVHQXFOYTVCeVNWQVVFQUpKWUJRUUFrbHdFTHJnRUFJQUJCQUVvRVFFRUJKQzRGUVFBa0xnc2dBVUVBU2dSQVFRRWtMd1ZCQUNRdkN5QUNRUUJLQkVCQkFTUXdCVUVBSkRBTElBTkJBRW9FUUVFQkpERUZRUUFrTVFzZ0JFRUFTZ1JBUVFFa01nVkJBQ1F5Q3lBRlFRQktCRUJCQVNRekJVRUFKRE1MSUFaQkFFb0VRRUVCSkRRRlFRQWtOQXNnQjBFQVNnUkFRUUVrTlFWQkFDUTFDeUFJUVFCS0JFQkJBU1EyQlVFQUpEWUxJQWxCQUVvRVFFRUJKRGNGUVFBa053c1FFZ3NNQUNNdEJFQkJBUThMUVFBTHNnRUFRWUFJSXo4NkFBQkJnUWdqUURvQUFFR0NDQ05CT2dBQVFZTUlJMEk2QUFCQmhBZ2pRem9BQUVHRkNDTkVPZ0FBUVlZSUkwVTZBQUJCaHdnalJqb0FBRUdJQ0NOSE93RUFRWW9JSTBnN0FRQkJqQWdqU1RZQ0FDTktCRUJCa1FoQkFUb0FBQVZCa1FoQkFEb0FBQXNqU3dSQVFaSUlRUUU2QUFBRlFaSUlRUUE2QUFBTEkwd0VRRUdUQ0VFQk9nQUFCVUdUQ0VFQU9nQUFDeU5OQkVCQmxBaEJBVG9BQUFWQmxBaEJBRG9BQUFzTHJBRUFRY2dKSXpnN0FRQkJ5Z2tqUERzQkFDTk9CRUJCekFsQkFUb0FBQVZCekFsQkFEb0FBQXNqVHdSQVFjMEpRUUU2QUFBRlFjMEpRUUE2QUFBTEkxQUVRRUhPQ1VFQk9nQUFCVUhPQ1VFQU9nQUFDeU5SQkVCQnp3bEJBVG9BQUFWQnp3bEJBRG9BQUFzalVnUkFRZEFKUVFFNkFBQUZRZEFKUVFBNkFBQUxJMU1FUUVIUkNVRUJPZ0FBQlVIUkNVRUFPZ0FBQ3lNNUJFQkIwZ2xCQVRvQUFBVkIwZ2xCQURvQUFBc0xTd0JCK2dramhRRTJBZ0JCL2dramhnRTJBZ0FqaXdFRVFFR0NDa0VCT2dBQUJVR0NDa0VBT2dBQUN5T01BUVJBUVlVS1FRRTZBQUFGUVlVS1FRQTZBQUFMUVlYK0F5T0hBUkFFQzNnQUk1c0JCRUJCM2dwQkFUb0FBQVZCM2dwQkFEb0FBQXRCM3dvam5BRTJBZ0JCNHdvam5RRTJBZ0JCNXdvam5nRTJBZ0JCN0Fvam53RTJBZ0JCOFFvam9BRTZBQUJCOGdvam9RRTZBQUFqb2dFRVFFSDNDa0VCT2dBQUJVSDNDa0VBT2dBQUMwSDRDaU9qQVRZQ0FFSDlDaU9rQVRzQkFBdFBBQ09sQVFSQVFaQUxRUUU2QUFBRlFaQUxRUUE2QUFBTFFaRUxJNllCTmdJQVFaVUxJNmNCTmdJQVFaa0xJNmdCTmdJQVFaNExJNmtCTmdJQVFhTUxJNm9CT2dBQVFhUUxJNnNCT2dBQUMwWUFJN0FCQkVCQjlBdEJBVG9BQUFWQjlBdEJBRG9BQUF0QjlRc2pzUUUyQWdCQitRc2pzZ0UyQWdCQi9Rc2pzd0UyQWdCQmdnd2p0QUUyQWdCQmh3d2p0UUU3QVFBTG93RUFFQlZCc2dnalZUWUNBRUcyQ0NPWUFUb0FBRUhFL2dNalZoQUVJNWtCQkVCQjVBaEJBVG9BQUFWQjVBaEJBRG9BQUFzam1nRUVRRUhsQ0VFQk9nQUFCVUhsQ0VFQU9nQUFDeEFXRUJkQnJBb2paellDQUVHd0NpTm9PZ0FBUWJFS0kyazZBQUFRR0JBWkk2d0JCRUJCd2d0QkFUb0FBQVZCd2d0QkFEb0FBQXRCd3dzanJRRTJBZ0JCeHdzanJnRTJBZ0JCeXdzanJ3RTdBUUFRR2tFQUpDMExyZ0VBUVlBSUxRQUFKRDlCZ1FndEFBQWtRRUdDQ0MwQUFDUkJRWU1JTFFBQUpFSkJoQWd0QUFBa1EwR0ZDQzBBQUNSRVFZWUlMUUFBSkVWQmh3Z3RBQUFrUmtHSUNDOEJBQ1JIUVlvSUx3RUFKRWhCakFnb0FnQWtTUUovUVFGQmtRZ3RBQUJCQUVvTkFCcEJBQXNrU2dKL1FRRkJrZ2d0QUFCQkFFb05BQnBCQUFza1N3Si9RUUZCa3dndEFBQkJBRW9OQUJwQkFBc2tUQUovUVFGQmxBZ3RBQUJCQUVvTkFCcEJBQXNrVFF0Y0FRRi9RUUFrVlVFQUpGWkJ4UDREUVFBUUJFSEIvZ01RQVVGOGNTRUJRUUFrbUFGQndmNERJQUVRQkNBQUJFQUNRRUVBSVFBRFFDQUFRWUNKSFU0TkFTQUFRWUNRQkdwQi93RTZBQUFnQUVFQmFpRUFEQUFBQ3dBTEN3dUlBUUVCZnlPMkFTRUJJQUJCZ0FGeFFRQkhKTFlCSUFCQndBQnhRUUJISkxjQklBQkJJSEZCQUVja3VBRWdBRUVRY1VFQVJ5UzVBU0FBUVFoeFFRQkhKTG9CSUFCQkJIRkJBRWNrdXdFZ0FFRUNjVUVBUnlTOEFTQUFRUUZ4UVFCSEpMMEJJN1lCUlNBQklBRWJCRUJCQVJBZEN5QUJSU0lBQkg4anRnRUZJQUFMQkVCQkFCQWRDd3MrQUFKL1FRRkI1QWd0QUFCQkFFb05BQnBCQUFza21RRUNmMEVCUWVVSUxRQUFRUUJLRFFBYVFRQUxKSm9CUWYvL0F4QUJFQTVCai80REVBRVFEd3VsQVFCQnlBa3ZBUUFrT0VIS0NTOEJBQ1E4QW45QkFVSE1DUzBBQUVFQVNnMEFHa0VBQ3lST0FuOUJBVUhOQ1MwQUFFRUFTZzBBR2tFQUN5UlBBbjlCQVVIT0NTMEFBRUVBU2cwQUdrRUFDeVJRQW45QkFVSFBDUzBBQUVFQVNnMEFHa0VBQ3lSUkFuOUJBVUhRQ1MwQUFFRUFTZzBBR2tFQUN5UlNBbjlCQVVIUkNTMEFBRUVBU2cwQUdrRUFDeVJUQW45QkFVSFNDUzBBQUVFQVNnMEFHa0VBQ3lRNUMxc0FRZm9KS0FJQUpJVUJRZjRKS0FJQUpJWUJBbjlCQVVHQ0NpMEFBRUVBU2cwQUdrRUFDeVNMQVFKL1FRRkJoUW90QUFCQkFFb05BQnBCQUFza2pBRkJoZjRERUFFa2h3RkJodjRERUFFa2lBRkJoLzRERUFFa2lnRUxCZ0JCQUNScUMzWUFBbjlCQVVIZUNpMEFBRUVBU2cwQUdrRUFDeVNiQVVIZkNpZ0NBQ1NjQVVIakNpZ0NBQ1NkQVVIbkNpZ0NBQ1NlQVVIc0NpZ0NBQ1NmQVVIeENpMEFBQ1NnQVVIeUNpMEFBQ1NoQVFKL1FRRkI5d290QUFCQkFFb05BQnBCQUFza29nRkIrQW9vQWdBa293RkIvUW92QVFBa3BBRUxUZ0FDZjBFQlFaQUxMUUFBUVFCS0RRQWFRUUFMSktVQlFaRUxLQUlBSktZQlFaVUxLQUlBSktjQlFaa0xLQUlBSktnQlFaNExLQUlBSktrQlFhTUxMUUFBSktvQlFhUUxMUUFBSktzQkMwVUFBbjlCQVVIMEN5MEFBRUVBU2cwQUdrRUFDeVN3QVVIMUN5Z0NBQ1N4QVVINUN5Z0NBQ1N5QVVIOUN5Z0NBQ1N6QVVHQ0RDZ0NBQ1MwQVVHSERDOEJBQ1MxQVF2UUFRRUJmeEFjUWJJSUtBSUFKRlZCdGdndEFBQWttQUZCeFA0REVBRWtWa0hBL2dNUUFSQWVFQjlCZ1A0REVBRkIvd0Z6Skw0Qkk3NEJJZ0JCRUhGQkFFY2t2d0VnQUVFZ2NVRUFSeVRBQVJBZ0VDRkJyQW9vQWdBa1owR3dDaTBBQUNSb1FiRUtMUUFBSkdsQkFDUnFFQ01RSkFKL1FRRkJ3Z3N0QUFCQkFFb05BQnBCQUFza3JBRkJ3d3NvQWdBa3JRRkJ4d3NvQWdBa3JnRkJ5d3N2QVFBa3J3RVFKVUVBSkMxQmdLald1UWNra2dGQkFDU1RBVUVBSkpRQlFZQ28xcmtISkpVQlFRQWtsZ0ZCQUNTWEFRc01BQ002QkVCQkFROExRUUFMQlFBamxRRUxCUUFqbGdFTEJRQWpsd0VMMkFJQkJYOENmd0ovSUFGQkFFb2lCUVJBSUFCQkNFb2hCUXNnQlFzRVFDUERBU0FFUmlFRkN5QUZDd1IvSThRQklBQkdCU0FGQ3dSQVFRQWhCVUVBSVFRZ0EwRUJheEFCUVNCeEJFQkJBU0VGQ3lBREVBRkJJSEVFUUVFQklRUUxRUUFoQXdOQUlBTkJDRWdFUUVFSElBTnJJQU1nQkNBRlJ4c2lBeUFBYWtHZ0FVd0VRQ0FBUVFnZ0EydHJJUWNnQUNBRGFpQUJRYUFCYkdwQkEyeEJnTWtGYWlFSlFRQWhCZ05BSUFaQkEwZ0VRQ0FBSUFOcUlBRkJvQUZzYWtFRGJFR0F5UVZxSUFacUlBWWdDV290QUFBNkFBQWdCa0VCYWlFR0RBRUxDeUFBSUFOcUlBRkJvQUZzYWtHQWtRUnFJQUZCb0FGc0lBZHFRWUNSQkdvdEFBQWlCa0VEY1NJSFFRUnlJQWNnQmtFRWNSczZBQUFnQ0VFQmFpRUlDeUFEUVFGcUlRTU1BUXNMQlNBRUpNTUJDeUFBSThRQlRnUkFJQUJCQ0dva3hBRWdBQ0FDUVFodklnUklCRUFqeEFFZ0JHb2t4QUVMQ3lBSUN6Z0JBWDhnQUVHQWtBSkdCRUFnQVVHQUFXb2hBaUFCUVlBQmNRUkFJQUZCZ0FGcklRSUxJQUpCQkhRZ0FHb1BDeUFCUVFSMElBQnFDMG9BSUFCQkEzUWdBVUVCZEdvaUFFRUJha0UvY1NJQlFVQnJJQUVnQWh0QmdKQUVhaTBBQUNFQklBQkJQM0VpQUVGQWF5QUFJQUliUVlDUUJHb3RBQUFnQVVIL0FYRkJDSFJ5QzFFQUlBSkZCRUFnQVJBQklBQkJBWFIxUVFOeElRQUxRZklCSVFFQ1FDQUFSUTBBQWtBQ1FBSkFBa0FnQUVFQmF3NERBUUlEQUFzTUF3dEJvQUVoQVF3Q0MwSFlBQ0VCREFFTFFRZ2hBUXNnQVF1TEF3RUdmeUFCSUFBUUxDQUZRUUYwYWlJQVFZQ1FmbW9nQWtFQmNVRU5kQ0lCYWkwQUFDRVJJQUJCZ1pCK2FpQUJhaTBBQUNFU0lBTWhBQU5BSUFBZ0JFd0VRQ0FBSUFOcklBWnFJZzRnQ0VnRVFFRUhJQUJySVFVZ0MwRUFTQ0lDQkg4Z0FnVWdDMEVnY1VVTElRRkJBQ0VDQW45QkFTQUZJQUFnQVJzaUFYUWdFbkVFUUVFQ0lRSUxJQUpCQVdvTElBSkJBU0FCZENBUmNSc2hBaU02Qkg4Z0MwRUFUaUlCQkg4Z0FRVWdERUVBVGdzRkl6b0xCSDhnQzBFSGNTRUZJQXhCQUU0aUFRUkFJQXhCQjNFaEJRc2dCU0FDSUFFUUxTSUZRUjl4UVFOMElROGdCVUhnQjNGQkJYVkJBM1FoQVNBRlFZRDRBWEZCQ25WQkEzUUZJQUpCeC80RElBb2dDa0VBVEJzaUNrRUFFQzRpQlNFUElBVWlBUXNoQlNBSElBaHNJQTVxUVFOc0lBbHFJaEFnRHpvQUFDQVFRUUZxSUFFNkFBQWdFRUVDYWlBRk9nQUFJQWRCb0FGc0lBNXFRWUNSQkdvZ0FrRURjU0lCUVFSeUlBRWdDMEdBQVhGQkFFZEJBQ0FMUVFCT0d4czZBQUFnRFVFQmFpRU5DeUFBUVFGcUlRQU1BUXNMSUEwTGdBRUJBMzhnQTBFSWJ5RURJQUJGQkVBZ0FpQUNRUWh0UVFOMGF5RUhDMEdnQVNBQWEwRUhJQUJCQ0dwQm9BRktHeUVKUVg4aEFpTTZCRUFnQkVHQTBINXFMUUFBSWdKQkNIRUVRRUVCSVFnTElBSkJ3QUJ4QkVCQkJ5QURheUVEQ3dzZ0JpQUZJQWdnQnlBSklBTWdBQ0FCUWFBQlFZREpCVUVBSUFKQmZ4QXZDNllDQUNBRklBWVFMQ0VHSUFOQkNHOGhBeUFFUVlEUWZtb3RBQUFpQkVIQUFIRUVmMEVISUFOckJTQURDMEVCZENBR2FpSURRWUNRZm1wQkFVRUFJQVJCQ0hFYlFRRnhRUTEwSWdWcUxRQUFJUVlnQTBHQmtINXFJQVZxTFFBQUlRVWdBa0VJYnlFRFFRQWhBaUFCUWFBQmJDQUFha0VEYkVHQXlRVnFJQVJCQjNFQ2YwRUJJQU5CQnlBRGF5QUVRU0J4R3lJRGRDQUZjUVJBUVFJaEFnc2dBa0VCYWdzZ0FrRUJJQU4wSUFaeEd5SUNRUUFRTFNJRFFSOXhRUU4wT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUhKQldvZ0EwSGdCM0ZCQlhWQkEzUTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdza0ZhaUFEUVlENEFYRkJDblZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJnSkVFYWlBQ1FRTnhJZ0JCQkhJZ0FDQUVRWUFCY1JzNkFBQUx0UUVBSUFRZ0JSQXNJQU5CQ0c5QkFYUnFJZ1JCZ0pCK2FpMEFBQ0VGUVFBaEF5QUJRYUFCYkNBQWFrRURiRUdBeVFWcUFuOGdCRUdCa0g1cUxRQUFRUUZCQnlBQ1FRaHZheUlDZEhFRVFFRUNJUU1MSUFOQkFXb0xJQU5CQVNBQ2RDQUZjUnNpQTBISC9nTkJBQkF1SWdJNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ2NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZTEpCV29nQWpvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRTZBQUFMMVFFQkJuOGdBMEVEZFNFTEEwQWdCRUdnQVVnRVFDQUVJQVZxSWdaQmdBSk9CRUFnQmtHQUFtc2hCZ3NnQzBFRmRDQUNhaUFHUVFOMWFpSUpRWUNRZm1vdEFBQWhDRUVBSVFvak5nUkFJQVFnQUNBR0lBa2dDQkFySWdkQkFFb0VRRUVCSVFvZ0IwRUJheUFFYWlFRUN3c2dDa1VqTlNJSElBY2JCRUFnQkNBQUlBWWdBeUFKSUFFZ0NCQXdJZ2RCQUVvRVFDQUhRUUZySUFScUlRUUxCU0FLUlFSQUl6b0VRQ0FFSUFBZ0JpQURJQWtnQVNBSUVERUZJQVFnQUNBR0lBTWdBU0FJRURJTEN3c2dCRUVCYWlFRURBRUxDd3NyQVFGL0kxY2hBeUFBSUFFZ0FpTllJQUJxSWdCQmdBSk9CSDhnQUVHQUFtc0ZJQUFMUVFBZ0F4QXpDekFCQTM4aldTRURJQUFqV2lJRVNBUkFEd3NnQTBFSGF5SURRWDlzSVFVZ0FDQUJJQUlnQUNBRWF5QURJQVVRTXd2RUJRRVBmd0pBUVNjaENRTkFJQWxCQUVnTkFTQUpRUUowSWdSQmdQd0RhaEFCSVFJZ0JFR0IvQU5xRUFFaENpQUVRWUw4QTJvUUFTRURJQUpCRUdzaEFpQUtRUWhySVFwQkNDRUZJQUVFUUVFUUlRVWdBMEVDYjBFQlJnUi9JQU5CQVdzRklBTUxJUU1MSUFBZ0FrNGlCZ1JBSUFBZ0FpQUZha2doQmdzZ0JnUkFJQVJCZy93RGFoQUJJZ1pCZ0FGeFFRQkhJUXNnQmtFZ2NVRUFSeUVPUVlDQUFpQURFQ3dnQUNBQ2F5SUNJQVZyUVg5c1FRRnJJQUlnQmtIQUFIRWJRUUYwYWlJRFFZQ1FmbXBCQVVFQUlBWkJDSEZCQUVjak9pSUNJQUliRzBFQmNVRU5kQ0lDYWkwQUFDRVBJQU5CZ1pCK2FpQUNhaTBBQUNFUVFRY2hCUU5BSUFWQkFFNEVRRUVBSVFnQ2YwRUJJQVVpQWtFSGEwRi9iQ0FDSUE0YklnSjBJQkJ4QkVCQkFpRUlDeUFJUVFGcUN5QUlRUUVnQW5RZ0QzRWJJZ2dFUUVFSElBVnJJQXBxSWdkQkFFNGlBZ1JBSUFkQm9BRk1JUUlMSUFJRVFFRUFJUXhCQUNFTlFRRkJBQ085QVVVak9pSURJQU1iR3lJQ1JRUkFJQUJCb0FGc0lBZHFRWUNSQkdvdEFBQWlBMEVEY1NJRVFRQktJQXNnQ3hzRVFFRUJJUXdGSUFOQkJIRkJBRWNqT2lJRElBTWJJZ01FUUNBRVFRQktJUU1MUVFGQkFDQURHeUVOQ3dzZ0FrVUVRQ0FNUlNJRUJIOGdEVVVGSUFRTElRSUxJQUlFUUNNNkJFQWdBRUdnQVd3Z0IycEJBMnhCZ01rRmFpQUdRUWR4SUFoQkFSQXRJZ1JCSDNGQkEzUTZBQUFnQUVHZ0FXd2dCMnBCQTJ4Qmdja0ZhaUFFUWVBSGNVRUZkVUVEZERvQUFDQUFRYUFCYkNBSGFrRURiRUdDeVFWcUlBUkJnUGdCY1VFS2RVRURkRG9BQUFVZ0FFR2dBV3dnQjJwQkEyeEJnTWtGYWlBSVFjbitBMEhJL2dNZ0JrRVFjUnRCQUJBdUlnTTZBQUFnQUVHZ0FXd2dCMnBCQTJ4Qmdja0ZhaUFET2dBQUlBQkJvQUZzSUFkcVFRTnNRWUxKQldvZ0F6b0FBQXNMQ3dzZ0JVRUJheUVGREFFTEN3c2dDVUVCYXlFSkRBQUFDd0FMQzJZQkFuOUJnSkFDSVFGQmdJQUNRWUNRQWlPNUFSc2hBU002STcwQkl6b2JCRUJCZ0xBQ0lRSWdBQ0FCUVlDNEFrR0FzQUlqdWdFYkVEUUxJN2dCQkVCQmdMQUNJUUlnQUNBQlFZQzRBa0dBc0FJanR3RWJFRFVMSTd3QkJFQWdBQ083QVJBMkN3c2xBUUYvQWtBRFFDQUFRWkFCU3cwQklBQkIvd0Z4RURjZ0FFRUJhaUVBREFBQUN3QUxDMFlCQW44RFFDQUJRWkFCVGtVRVFFRUFJUUFEUUNBQVFhQUJTQVJBSUFGQm9BRnNJQUJxUVlDUkJHcEJBRG9BQUNBQVFRRnFJUUFNQVFzTElBRkJBV29oQVF3QkN3c0xIUUVCZjBHUC9nTVFBVUVCSUFCMGNpSUJKSVFCUVkvK0F5QUJFQVFMQ3dCQkFTU0FBVUVCRURvTFJRRUNmMEdVL2dNUUFVSDRBWEVoQVVHVC9nTWdBRUgvQVhFaUFoQUVRWlQrQXlBQklBQkJDSFVpQUhJUUJDQUNKTkVCSUFBazBnRWowUUVqMGdGQkNIUnlKTk1CQzJZQkFuOGpwQUVpQVNQUEFYVWhBQ0FCSUFCcklBQWdBV29qMEFFYklnQkIvdzlNSWdFRWZ5UFBBVUVBU2dVZ0FRc0VRQ0FBSktRQklBQVFQQ09rQVNJQkk4OEJkU0VBSUFFZ0FHc2dBQ0FCYWlQUUFSc2hBQXNnQUVIL0Qwb0VRRUVBSkpzQkN3c3NBQ09qQVVFQmF5U2pBU09qQVVFQVRBUkFJODRCSktNQkk4NEJRUUJLSTZJQkk2SUJHd1JBRUQwTEN3dGJBUUYvSTUwQlFRRnJKSjBCSTUwQlFRQk1CRUFqMUFFa25RRWpuUUVFUUNPZkFVRVBTQ1BWQVNQVkFSc0VRQ09mQVVFQmFpU2ZBUVVqMVFGRklnQUVRQ09mQVVFQVNpRUFDeUFBQkVBam53RkJBV3NrbndFTEN3c0xDMXNCQVg4anB3RkJBV3NrcHdFanB3RkJBRXdFUUNQV0FTU25BU09uQVFSQUk2a0JRUTlJSTljQkk5Y0JHd1JBSTZrQlFRRnFKS2tCQlNQWEFVVWlBQVJBSTZrQlFRQktJUUFMSUFBRVFDT3BBVUVCYXlTcEFRc0xDd3NMV3dFQmZ5T3lBVUVCYXlTeUFTT3lBVUVBVEFSQUk5Z0JKTElCSTdJQkJFQWp0QUZCRDBnajJRRWoyUUViQkVBanRBRkJBV29rdEFFRkk5a0JSU0lBQkVBanRBRkJBRW9oQUFzZ0FBUkFJN1FCUVFGckpMUUJDd3NMQ3d1T0JnQWpaeUFBYWlSbkkyY2pQZ1IvUVlDQUFRVkJnTUFBQzA0RVFDTm5JejRFZjBHQWdBRUZRWURBQUF0ckpHY0NRQUpBQWtBQ1FBSkFJMmtpQUFSQUlBQkJBbXNPQmdFRkFnVURCQVVMSTU0QlFRQktJZ0FFZnlQS0FRVWdBQXNFUUNPZUFVRUJheVNlQVFzam5nRkZCRUJCQUNTYkFRc2pxQUZCQUVvaUFBUi9JOHNCQlNBQUN3UkFJNmdCUVFGckpLZ0JDeU9vQVVVRVFFRUFKS1VCQ3lPdUFVRUFTaUlBQkg4anpBRUZJQUFMQkVBanJnRkJBV3NrcmdFTEk2NEJSUVJBUVFBa3JBRUxJN01CUVFCS0lnQUVmeVBOQVFVZ0FBc0VRQ096QVVFQmF5U3pBUXNqc3dGRkJFQkJBQ1N3QVFzTUJBc2puZ0ZCQUVvaUFBUi9JOG9CQlNBQUN3UkFJNTRCUVFGckpKNEJDeU9lQVVVRVFFRUFKSnNCQ3lPb0FVRUFTaUlBQkg4anl3RUZJQUFMQkVBanFBRkJBV3NrcUFFTEk2Z0JSUVJBUVFBa3BRRUxJNjRCUVFCS0lnQUVmeVBNQVFVZ0FBc0VRQ091QVVFQmF5U3VBUXNqcmdGRkJFQkJBQ1NzQVFzanN3RkJBRW9pQUFSL0k4MEJCU0FBQ3dSQUk3TUJRUUZySkxNQkN5T3pBVVVFUUVFQUpMQUJDeEErREFNTEk1NEJRUUJLSWdBRWZ5UEtBUVVnQUFzRVFDT2VBVUVCYXlTZUFRc2puZ0ZGQkVCQkFDU2JBUXNqcUFGQkFFb2lBQVIvSThzQkJTQUFDd1JBSTZnQlFRRnJKS2dCQ3lPb0FVVUVRRUVBSktVQkN5T3VBVUVBU2lJQUJIOGp6QUVGSUFBTEJFQWpyZ0ZCQVdza3JnRUxJNjRCUlFSQVFRQWtyQUVMSTdNQlFRQktJZ0FFZnlQTkFRVWdBQXNFUUNPekFVRUJheVN6QVFzanN3RkZCRUJCQUNTd0FRc01BZ3NqbmdGQkFFb2lBQVIvSThvQkJTQUFDd1JBSTU0QlFRRnJKSjRCQ3lPZUFVVUVRRUVBSkpzQkN5T29BVUVBU2lJQUJIOGp5d0VGSUFBTEJFQWpxQUZCQVdza3FBRUxJNmdCUlFSQVFRQWtwUUVMSTY0QlFRQktJZ0FFZnlQTUFRVWdBQXNFUUNPdUFVRUJheVN1QVFzanJnRkZCRUJCQUNTc0FRc2pzd0ZCQUVvaUFBUi9JODBCQlNBQUN3UkFJN01CUVFGckpMTUJDeU96QVVVRVFFRUFKTEFCQ3hBK0RBRUxFRDhRUUJCQkN5TnBRUUZxSkdramFVRUlUZ1JBUVFBa2FRdEJBUThMUVFBTGd3RUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQWdBQ0lCUVFKR0RRRWdBVUVEUmcwQ0lBRkJCRVlOQXd3RUN5TndJOXNCUndSQUk5c0JKSEJCQVE4TFFRQVBDeU54STl3QlJ3UkFJOXdCSkhGQkFROExRUUFQQ3lOeUk5MEJSd1JBSTkwQkpISkJBUThMUVFBUEN5TnpJOTRCUndSQUk5NEJKSE5CQVE4TFFRQVBDMEVBQzFVQUFrQUNRQUpBSUFCQkFVY0VRQ0FBUVFKR0RRRWdBRUVEUmcwQ0RBTUxRUUVnQVhSQmdRRnhRUUJIRHd0QkFTQUJkRUdIQVhGQkFFY1BDMEVCSUFGMFFmNEFjVUVBUnc4TFFRRWdBWFJCQVhGQkFFY0xpZ0VCQVg4am5BRWdBR3NrbkFFam5BRkJBRXdFUUNPY0FTSUJRUjkxSVFCQmdCQWowd0ZyUVFKMEpKd0JJejRFUUNPY0FVRUJkQ1NjQVFzam5BRWdBQ0FCYWlBQWMyc2tuQUVqb1FGQkFXb2tvUUVqb1FGQkNFNEVRRUVBSktFQkN3c2oyd0VqbXdFaUFDQUFHd1IvSTU4QkJVRVBEd3NqNGdFam9RRVFSQVIvUVFFRlFYOExiRUVQYWd1S0FRRUJmeU9tQVNBQWF5U21BU09tQVVFQVRBUkFJNllCSWdGQkgzVWhBRUdBRUNQakFXdEJBblFrcGdFalBnUkFJNllCUVFGMEpLWUJDeU9tQVNBQUlBRnFJQUJ6YXlTbUFTT3JBVUVCYWlTckFTT3JBVUVJVGdSQVFRQWtxd0VMQ3lQY0FTT2xBU0lBSUFBYkJIOGpxUUVGUVE4UEN5UGtBU09yQVJCRUJIOUJBUVZCZnd0c1FROXFDNWtDQVFKL0k2MEJJQUJySkswQkk2MEJRUUJNQkVBanJRRWlBa0VmZFNFQVFZQVFJK1VCYTBFQmRDU3RBU00rQkVBanJRRkJBWFFrclFFTEk2MEJJQUFnQW1vZ0FITnJKSzBCSTY4QlFRRnFKSzhCSTY4QlFTQk9CRUJCQUNTdkFRc0xRUUFoQWlQbUFTRUFJOTBCSTZ3QklnRWdBUnNFUUNOckJFQkJuUDRERUFGQkJYVkJEM0VpQUNUbUFVRUFKR3NMQlVFUER3c2pyd0ZCQW0xQnNQNERhaEFCSVFFanJ3RkJBbThFZnlBQlFROXhCU0FCUVFSMVFROXhDeUVCQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVNBQVFRSkdEUUlNQXdzZ0FVRUVkU0VCREFNTFFRRWhBZ3dDQ3lBQlFRRjFJUUZCQWlFQ0RBRUxJQUZCQW5VaEFVRUVJUUlMSUFKQkFFb0VmeUFCSUFKdEJVRUFDMEVQYWd1ckFRRUJmeU94QVNBQWF5U3hBU094QVVFQVRBUkFJN0VCSVFBajV3RWo2QUYwSWdGQkFYUWdBU00rR3lTeEFTT3hBU0FBUVI5MUlnRWdBQ0FCYW5OckpMRUJJN1VCSWdCQkFYRWhBU0FBUVFGMUlnQWt0UUVqdFFFZ0FTQUFRUUZ4Y3lJQlFRNTBjaVMxQVNQcEFRUkFJN1VCUWI5L2NTUzFBU08xQVNBQlFRWjBjaVMxQVFzTEk5NEJJN0FCSWdBZ0FCc0VmeU8wQVFWQkR3OExRWDlCQVNPMUFVRUJjUnRzUVE5cUN6QUFJQUJCUEVZRVFFSC9BQThMSUFCQlBHdEJvSTBHYkNBQmJFRUliVUdnalFadFFUeHFRYUNOQm14QmpQRUNiUXVjQVFFQmYwRUFKSFlnQUVFUEkxNGJJZ1FnQVdvZ0JFRVBhaU5mR3lJRUlBSnFJQVJCRDJvallCc2hCQ0FESUFJZ0FTQUFRUThqWWhzaUFHb2dBRUVQYWlOakd5SUFhaUFBUVE5cUkyUWJJZ0JxSUFCQkQyb2paUnNoQUVFQUpIZEJBQ1I0SUFNZ0JHb2dCRUVQYWlOaEd5TmNRUUZxRUVraEFTQUFJMTFCQVdvUVNTRUFJQUVrZENBQUpIVWdBRUgvQVhFZ0FVSC9BWEZCQ0hSeUM4TURBUVYvQW44ajJnRWdBR29rMmdGQkFDT2NBU1BhQVd0QkFFb05BQnBCQVFzaUFVVUVRRUVCRUVNaEFRc0NmeVBmQVNBQWFpVGZBVUVBSTZZQkk5OEJhMEVBU2cwQUdrRUJDeUlFUlFSQVFRSVFReUVFQ3dKL0krQUJJQUJxSk9BQkk2MEJJK0FCYTBFQVNpSUNCRUFqYTBVaEFndEJBQ0FDRFFBYVFRRUxJZ0pGQkVCQkF4QkRJUUlMQW44ajRRRWdBR29rNFFGQkFDT3hBU1BoQVd0QkFFb05BQnBCQVFzaUJVVUVRRUVFRUVNaEJRc2dBUVJBSTlvQklRTkJBQ1RhQVNBREVFVWtiQXNnQkFSQUk5OEJJUU5CQUNUZkFTQURFRVlrYlFzZ0FnUkFJK0FCSVFOQkFDVGdBU0FERUVja2Jnc2dCUVJBSStFQklRTkJBQ1RoQVNBREVFZ2tid3NDZnlBQklBUWdBUnNpQVVVRVFDQUNJUUVMSUFGRkN3UkFJQVVoQVFzZ0FRUkFRUUVrZUFzamFDUHFBU0FBYkdva2FDTm9RWUNBZ0FSQmdJQ0FBaU0rRzA0RVFDTm9RWUNBZ0FSQmdJQ0FBaU0rRzJza2FDTjRJZ0FqZGlBQUd5SUJSUVJBSTNjaEFRc2dBUVJBSTJ3amJTTnVJMjhRU2hvTEkyb2lBVUVCZEVHQW1jRUFhaUlBSTNSQkFtbzZBQUFnQUVFQmFpTjFRUUpxT2dBQUlBRkJBV29rYWlOcUkrc0JRUUp0UVFGclRnUkFJMnBCQVdza2Fnc0xDNXdEQVFWL0lBQVFSU0VDSUFBUVJpRUJJQUFRUnlFRElBQVFTQ0VFSUFJa2JDQUJKRzBnQXlSdUlBUWtieU5vSStvQklBQnNhaVJvSTJoQmdJQ0FCRUdBZ0lBQ0l6NGJUZ1JBSTJoQmdJQ0FCRUdBZ0lBQ0l6NGJheVJvSUFJZ0FTQURJQVFRU2lFQUkycEJBWFJCZ0puQkFHb2lCU0FBUVlEK0EzRkJDSFZCQW1vNkFBQWdCVUVCYWlBQVFmOEJjVUVDYWpvQUFDTTNCRUFnQWtFUFFROUJEeEJLSVFBamFrRUJkRUdBbVNGcUlnSWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBSkJBV29nQUVIL0FYRkJBbW82QUFCQkR5QUJRUTlCRHhCS0lRQWpha0VCZEVHQW1TbHFJZ0VnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQUZCQVdvZ0FFSC9BWEZCQW1vNkFBQkJEMEVQSUFOQkR4QktJUUFqYWtFQmRFR0FtVEZxSWdFZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFGQkFXb2dBRUgvQVhGQkFtbzZBQUJCRDBFUFFROGdCQkJLSVFBamFrRUJkRUdBbVRscUlnRWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBRkJBV29nQUVIL0FYRkJBbW82QUFBTEkycEJBV29rYWlOcUkrc0JRUUp0UVFGclRnUkFJMnBCQVdza2Fnc0xDeDRCQVg4Z0FCQkNJUUVnQVVVak5DTTBHd1JBSUFBUVN3VWdBQkJNQ3d0TEFDTmJJejRFZjBHdUFRVkIxd0FMU0FSQUR3c0RRQ05iSXo0RWYwR3VBUVZCMXdBTFRnUkFJejRFZjBHdUFRVkIxd0FMRUUwald5TStCSDlCcmdFRlFkY0FDMnNrV3d3QkN3c0xJUUFnQUVHbS9nTkdCRUJCcHY0REVBRkJnQUZ4SVFBZ0FFSHdBSElQQzBGL0M1d0JBUUYvSTc0QklRQWp2d0VFUUNBQVFYdHhJQUJCQkhJajdBRWJJUUFnQUVGK2NTQUFRUUZ5SSswQkd5RUFJQUJCZDNFZ0FFRUljaVB1QVJzaEFDQUFRWDF4SUFCQkFuSWo3d0ViSVFBRkk4QUJCRUFnQUVGK2NTQUFRUUZ5SS9BQkd5RUFJQUJCZlhFZ0FFRUNjaVB4QVJzaEFDQUFRWHR4SUFCQkJISWo4Z0ViSVFBZ0FFRjNjU0FBUVFoeUkvTUJHeUVBQ3dzZ0FFSHdBWElMendJQkFYOGdBRUdBZ0FKSUJFQkJmdzhMSUFCQmdJQUNUaUlCQkg4Z0FFR0F3QUpJQlNBQkN3UkFRWDhQQ3lBQVFZREFBMDRpQVFSL0lBQkJnUHdEU0FVZ0FRc0VRQ0FBUVlCQWFoQUJEd3NnQUVHQS9BTk9JZ0VFZnlBQVFaLzlBMHdGSUFFTEJFQWptQUZCQWtnRVFFSC9BUThMUVg4UEN5QUFRYzMrQTBZRVFFSC9BU0VCUWMzK0F4QUJRUUZ4UlFSQVFmNEJJUUVMSXo1RkJFQWdBVUgvZm5FaEFRc2dBUThMSUFCQnhQNERSZ1JBSUFBalZoQUVJMVlQQ3lBQVFaRCtBMDRpQVFSL0lBQkJwdjREVEFVZ0FRc0VRQkJPSUFBUVR3OExJQUJCc1A0RFRpSUJCSDhnQUVHLy9nTk1CU0FCQ3dSQUVFNUJmdzhMSUFCQmhQNERSZ1JBSUFBamhnRkJnUDREY1VFSWRTSUJFQVFnQVE4TElBQkJoZjREUmdSQUlBQWpod0VRQkNPSEFROExJQUJCai80RFJnUkFJNFFCUWVBQmNnOExJQUJCZ1A0RFJnUkFFRkFQQzBGL0N5a0JBWDhqeVFFZ0FFWUVRRUVCSk1FQkN5QUFFRkVpQVVGL1JnUkFJQUFRQVE4TElBRkIvd0Z4QzdZQ0FRRi9JMUFFUUE4TElBQkIvejlNQkVBalVnUi9JQUZCRUhGRkJTTlNDMFVFUUNBQlFROXhJZ0lFUUNBQ1FRcEdCRUJCQVNST0N3VkJBQ1JPQ3dzRklBQkIvLzhBVEFSQUl6bEZJZ0lFZnlBQ0JTQUFRZi9mQUV3TEJFQWpVZ1JBSUFGQkQzRWtPQXNnQVNFQ0kxRUVRQ0FDUVI5eElRSWpPRUhnQVhFa09BVWpVd1JBSUFKQi93QnhJUUlqT0VHQUFYRWtPQVVqT1FSQVFRQWtPQXNMQ3lNNElBSnlKRGdGSXpoQi93RnhRUUZCQUNBQlFRQktHMEgvQVhGQkNIUnlKRGdMQlNOU1JTSUNCSDhnQUVIL3Z3Rk1CU0FDQ3dSQUkwOGpVU0lBSUFBYkJFQWpPRUVmY1NRNEl6Z2dBVUhnQVhGeUpEZ1BDeUFCUVE5eElBRkJBM0VqT1Jza1BBVWpVa1VpQWdSL0lBQkIvLzhCVEFVZ0Fnc0VRQ05SQkVBZ0FVRUJjUVJBUVFFa1R3VkJBQ1JQQ3dzTEN3c0xDeXdBSUFCQkJIVkJEM0VrK1FFZ0FFRUljVUVBUnlUVkFTQUFRUWR4Sk5RQklBQkIrQUZ4UVFCS0pOc0JDeXdBSUFCQkJIVkJEM0VrK2dFZ0FFRUljVUVBUnlUWEFTQUFRUWR4Sk5ZQklBQkIrQUZ4UVFCS0pOd0JDeXdBSUFCQkJIVkJEM0VrL0FFZ0FFRUljVUVBUnlUWkFTQUFRUWR4Sk5nQklBQkIrQUZ4UVFCS0pONEJDNEVCQVFGL0lBQkJCSFVrNkFFZ0FFRUljVUVBUnlUcEFTQUFRUWR4SklFQ0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNPQkFpSUJCRUFnQVVFQmF3NEhBUUlEQkFVR0J3Z0xRUWdrNXdFUEMwRVFKT2NCRHd0QklDVG5BUThMUVRBazV3RVBDMEhBQUNUbkFROExRZEFBSk9jQkR3dEI0QUFrNXdFUEMwSHdBQ1RuQVFzTGd3RUJBWDlCQVNTYkFTT2VBVVVFUUVIQUFDU2VBUXRCZ0JBajB3RnJRUUowSkp3Qkl6NEVRQ09jQVVFQmRDU2NBUXNqMUFFa25RRWorUUVrbndFajB3RWtwQUVqemdFaUFDU2pBU0FBUVFCS0lnQUVmeVBQQVVFQVNnVWdBQXNFUUVFQkpLSUJCVUVBSktJQkN5UFBBVUVBU2dSQUVEMExJOXNCUlFSQVFRQWttd0VMQzBjQVFRRWtwUUVqcUFGRkJFQkJ3QUFrcUFFTFFZQVFJK01CYTBFQ2RDU21BU00rQkVBanBnRkJBWFFrcGdFTEk5WUJKS2NCSS9vQkpLa0JJOXdCUlFSQVFRQWtwUUVMQzBBQVFRRWtyQUVqcmdGRkJFQkJnQUlrcmdFTFFZQVFJK1VCYTBFQmRDU3RBU00rQkVBanJRRkJBWFFrclFFTFFRQWtyd0VqM1FGRkJFQkJBQ1NzQVFzTFNRRUJmMEVCSkxBQkk3TUJSUVJBUWNBQUpMTUJDeVBuQVNQb0FYUWlBRUVCZENBQUl6NGJKTEVCSTlnQkpMSUJJL3dCSkxRQlFmLy9BU1MxQVNQZUFVVUVRRUVBSkxBQkN3dFVBQ0FBUVlBQmNVRUFSeVJoSUFCQndBQnhRUUJISkdBZ0FFRWdjVUVBUnlSZklBQkJFSEZCQUVja1hpQUFRUWh4UVFCSEpHVWdBRUVFY1VFQVJ5UmtJQUJCQW5GQkFFY2tZeUFBUVFGeFFRQkhKR0lMaUFVQkFYOGdBRUdtL2dOSElnSUVRQ05tUlNFQ0N5QUNCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUNRWkQrQTBjRVFDQUNRWkgrQTJzT0ZnSUdDZzRWQXdjTER3RUVDQXdRRlFVSkRSRVNFeFFWQ3lBQlFmQUFjVUVFZFNUT0FTQUJRUWh4UVFCSEpOQUJJQUZCQjNFa3p3RU1GUXNnQVVHQUFYRkJBRWNrM1FFTUZBc2dBVUVHZFVFRGNTVGlBU0FCUVQ5eEpQVUJRY0FBSS9VQmF5U2VBUXdUQ3lBQlFRWjFRUU54Sk9RQklBRkJQM0VrOWdGQndBQWo5Z0ZySktnQkRCSUxJQUVrOXdGQmdBSWo5d0ZySks0QkRCRUxJQUZCUDNFaytBRkJ3QUFqK0FGckpMTUJEQkFMSUFFUVZBd1BDeUFCRUZVTURndEJBU1JySUFGQkJYVkJEM0VrK3dFTURRc2dBUkJXREF3TElBRWswUUVqMFFFajBnRkJDSFJ5Sk5NQkRBc0xJQUVrL1FFai9RRWovZ0ZCQ0hSeUpPTUJEQW9MSUFFay93RWovd0VqZ0FKQkNIUnlKT1VCREFrTElBRVFWd3dJQ3lBQlFZQUJjUVJBSUFGQndBQnhRUUJISk1vQklBRkJCM0VrMGdFajBRRWowZ0ZCQ0hSeUpOTUJFRmdMREFjTElBRkJnQUZ4QkVBZ0FVSEFBSEZCQUVja3l3RWdBVUVIY1NUK0FTUDlBU1ArQVVFSWRISWs0d0VRV1FzTUJnc2dBVUdBQVhFRVFDQUJRY0FBY1VFQVJ5VE1BU0FCUVFkeEpJQUNJLzhCSTRBQ1FRaDBjaVRsQVJCYUN3d0ZDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKTTBCRUZzTERBUUxJQUZCQkhWQkIzRWtYQ0FCUVFkeEpGMUJBU1IyREFNTElBRVFYRUVCSkhjTUFnc2dBVUdBQVhGQkFFY2taaUFCUVlBQmNVVUVRQUpBUVpEK0F5RUNBMEFnQWtHbS9nTk9EUUVnQWtFQUVBUWdBa0VCYWlFQ0RBQUFDd0FMQ3d3QkMwRUJEd3RCQVFzOEFRRi9JQUJCQ0hRaEFVRUFJUUFEUUFKQUlBQkJud0ZLRFFBZ0FFR0EvQU5xSUFBZ0FXb1FBUkFFSUFCQkFXb2hBQXdCQ3d0QmhBVWt3Z0VMSXdFQmZ5T0VBaEFCSVFBamhRSVFBVUgvQVhFZ0FFSC9BWEZCQ0hSeVFmRC9BM0VMSndFQmZ5T0dBaEFCSVFBamh3SVFBVUgvQVhFZ0FFSC9BWEZCQ0hSeVFmQS9jVUdBZ0FKcUM0TUJBUU4vSXpwRkJFQVBDeUFBUVlBQmNVVWp4UUVqeFFFYkJFQkJBQ1RGQVNPREFoQUJRWUFCY2lFQUk0TUNJQUFRQkE4TEVGOGhBUkJnSVFJZ0FFSC9mbkZCQVdwQkJIUWhBeUFBUVlBQmNRUkFRUUVreFFFZ0F5VEdBU0FCSk1jQklBSWt5QUVqZ3dJZ0FFSC9mbkVRQkFVZ0FTQUNJQU1RYXlPREFrSC9BUkFFQ3d0aUFRTi9JNG9DSUFCR0lnSkZCRUFqaVFJZ0FFWWhBZ3NnQWdSQUlBQkJBV3NpQXhBQlFiOS9jU0lDUVQ5eElnUkJRR3NnQkVFQlFRQWppUUlnQUVZYkcwR0FrQVJxSUFFNkFBQWdBa0dBQVhFRVFDQURJQUpCQVdwQmdBRnlFQVFMQ3dzOEFRRi9Ba0FDUUFKQUFrQWdBQVJBSUFBaUFVRUJSZzBCSUFGQkFrWU5BaUFCUVFOR0RRTU1CQXRCQ1E4TFFRTVBDMEVGRHd0QkJ3OExRUUFMTFFFQmYwRUJJNG9CRUdNaUFuUWdBSEZCQUVjaUFBUi9RUUVnQW5RZ0FYRkZCU0FBQ3dSQVFRRVBDMEVBQzVFQkFRSi9BMEFnQVNBQVNBUkFJQUZCQkdvaEFTT0dBU0lDUVFScUpJWUJJNFlCUWYvL0Ewb0VRQ09HQVVHQWdBUnJKSVlCQ3lPSkFRUkFJNHNCQkVBamlBRWtod0ZCQVNTQkFVRUNFRHBCQUNTTEFVRUJKSXdCQlNPTUFRUkFRUUFrakFFTEN5QUNJNFlCRUdRRVFDT0hBVUVCYWlTSEFTT0hBVUgvQVVvRVFFRUJKSXNCUVFBa2h3RUxDd3NNQVFzTEN3d0FJNFVCRUdWQkFDU0ZBUXRIQVFGL0k0WUJJUUJCQUNTR0FVR0UvZ05CQUJBRUk0a0JCSDhnQUNPR0FSQmtCU09KQVFzRVFDT0hBVUVCYWlTSEFTT0hBVUgvQVVvRVFFRUJKSXNCUVFBa2h3RUxDd3VBQVFFQ2Z5T0pBU0VCSUFCQkJIRkJBRWNraVFFZ0FFRURjU0VDSUFGRkJFQWppZ0VRWXlFQUlBSVFZeUVCSTRrQkJIOGpoZ0ZCQVNBQWRIRUZJNFlCUVFFZ0FIUnhRUUJISWdBRWZ5T0dBVUVCSUFGMGNRVWdBQXNMQkVBamh3RkJBV29raHdFamh3RkIvd0ZLQkVCQkFTU0xBVUVBSkljQkN3c0xJQUlraWdFTDBnWUJBWDhDUUFKQUlBQkJ6ZjREUmdSQVFjMytBeUFCUVFGeEVBUU1BUXNnQUVHQWdBSklCRUFnQUNBQkVGTU1BUXNnQUVHQWdBSk9JZ0lFUUNBQVFZREFBa2doQWdzZ0FnMEJJQUJCZ01BRFRpSUNCRUFnQUVHQS9BTklJUUlMSUFJRVFDQUFRWUJBYWlBQkVBUU1BZ3NnQUVHQS9BTk9JZ0lFUUNBQVFaLzlBMHdoQWdzZ0FnUkFJNWdCUVFKSURRRU1BZ3NnQUVHZy9RTk9JZ0lFUUNBQVFmLzlBMHdoQWdzZ0FnMEFJQUJCZ3Y0RFJnUkFJQUZCQVhGQkFFY2tqd0VnQVVFQ2NVRUFSeVNRQVNBQlFZQUJjVUVBUnlTUkFVRUJEd3NnQUVHUS9nTk9JZ0lFUUNBQVFhYitBMHdoQWdzZ0FnUkFFRTRnQUNBQkVGMFBDeUFBUWJEK0EwNGlBZ1JBSUFCQnYvNERUQ0VDQ3lBQ0JFQVFUZ3NnQUVIQS9nTk9JZ0lFUUNBQVFjditBMHdoQWdzZ0FnUkFJQUJCd1A0RFJnUkFJQUVRSGd3REN5QUFRY0grQTBZRVFFSEIvZ01nQVVINEFYRkJ3ZjRERUFGQkIzRnlRWUFCY2hBRURBSUxJQUJCeFA0RFJnUkFRUUFrVmlBQVFRQVFCQXdDQ3lBQVFjWCtBMFlFUUNBQkpJSUNEQU1MSUFCQnh2NERSZ1JBSUFFUVhnd0RDd0pBQWtBQ1FBSkFJQUFpQWtIRC9nTkhCRUFnQWtIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTUlhEQVlMSUFFa1dBd0ZDeUFCSkZrTUJBc2dBU1JhREFNTERBSUxJNE1DSUFCR0JFQWdBUkJoREFFTEl6MGdBRVlpQWtVRVFDTTdJQUJHSVFJTElBSUVRQ1BGQVFSQUFuOGp4d0ZCZ0lBQlRpSUNCRUFqeHdGQi8vOEJUQ0VDQ3lBQ1JRc0VRQ1BIQVVHQW9BTk9JZ0lFUUNQSEFVSC92d05NSVFJTEN5QUNEUUlMQ3lBQUk0Z0NUaUlDQkVBZ0FDT0pBa3doQWdzZ0FnUkFJQUFnQVJCaURBSUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQm1Ba0FDUUFKQUFrQWdBQ0lDUVlUK0EwY0VRQ0FDUVlYK0Eyc09Bd0VDQXdRTEVHY01CUXNDUUNPSkFRUkFJNHdCRFFFaml3RUVRRUVBSklzQkN3c2dBU1NIQVFzTUJRc2dBU1NJQVNPTUFTT0pBU0lBSUFBYkJFQWppQUVraHdGQkFDU01BUXNNQkFzZ0FSQm9EQU1MREFJTElBQkJnUDREUmdSQUlBRkIvd0Z6Skw0Qkk3NEJJZ0pCRUhGQkFFY2t2d0VnQWtFZ2NVRUFSeVRBQVFzZ0FFR1AvZ05HQkVBZ0FSQVBEQUlMSUFCQi8vOERSZ1JBSUFFUURnd0NDMEVCRHd0QkFBOExRUUVMSHdBajlBRWdBRVlFUUVFQkpNRUJDeUFBSUFFUWFRUkFJQUFnQVJBRUN3dGdBUU4vQTBBQ1FDQURJQUpPRFFBZ0FDQURhaEJTSVFVZ0FTQURhaUVFQTBBZ0JFSC92d0pLQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUdvZ0EwRUJhaUVEREFFTEMwRWdJUU1qd2dFZ0FrRVFiVUhBQUVFZ0l6NGJiR29rd2dFTFp3RUJmeVBGQVVVRVFBOExJOGNCSThnQkk4WUJJZ0JCRUNBQVFSQklHeUlBRUdzanh3RWdBR29reHdFanlBRWdBR29reUFFanhnRWdBR3NreGdFanhnRkJBRXdFUUVFQUpNVUJJNE1DUWY4QkVBUUZJNE1DSThZQlFSQnRRUUZyUWY5K2NSQUVDd3RHQVFKL0k0SUNJUU1DZnlBQVJTSUNSUVJBSUFCQkFVWWhBZ3NnQWdzRWZ5TldJQU5HQlNBQ0N3UkFJQUZCQkhJaUFVSEFBSEVFUUJBN0N3VWdBVUY3Y1NFQkN5QUJDNElDQVFOL0k3WUJSUVJBRHdzam1BRWhBQ0FBSTFZaUFrR1FBVTRFZjBFQkJTTlZJejRFZjBId0JRVkIrQUlMVGdSL1FRSUZRUU5CQUNOVkl6NEVmMEh5QXdWQitRRUxUaHNMQ3lJQlJ3UkFRY0grQXhBQklRQWdBU1NZQVVFQUlRSUNRQUpBQWtBQ1FDQUJCRUFnQVVFQmF3NERBUUlEQkFzZ0FFRjhjU0lBUVFoeFFRQkhJUUlNQXdzZ0FFRjljVUVCY2lJQVFSQnhRUUJISVFJTUFnc2dBRUYrY1VFQ2NpSUFRU0J4UVFCSElRSU1BUXNnQUVFRGNpRUFDeUFDQkVBUU93c2dBVVVFUUJCc0N5QUJRUUZHQkVCQkFTUi9RUUFRT2d0QndmNERJQUVnQUJCdEVBUUZJQUpCbVFGR0JFQkJ3ZjRESUFGQndmNERFQUVRYlJBRUN3c0x0QUVBSTdZQkJFQWpWU0FBYWlSVkEwQWpWUUovSXo0RVFFRUlJMVpCbVFGR0RRRWFRWkFIREFFTFFRUWpWa0daQVVZTkFCcEJ5QU1MVGdSQUkxVUNmeU0rQkVCQkNDTldRWmtCUmcwQkdrR1FCd3dCQzBFRUkxWkJtUUZHRFFBYVFjZ0RDMnNrVlNOV0lnQkJrQUZHQkVBak13UkFFRGdGSUFBUU53c1FPVUYvSk1NQlFYOGt4QUVGSUFCQmtBRklCRUFqTTBVRVFDQUFFRGNMQ3d0QkFDQUFRUUZxSUFCQm1RRktHeVJXREFFTEN3c1FiZ3V6QVFBalZBSi9JejRFUUVFSUkxWkJtUUZHRFFFYVFaQUhEQUVMUVFRalZrR1pBVVlOQUJwQnlBTUxTQVJBRHdzRFFDTlVBbjhqUGdSQVFRZ2pWa0daQVVZTkFScEJrQWNNQVF0QkJDTldRWmtCUmcwQUdrSElBd3RPQkVBQ2Z5TStCRUJCQ0NOV1Faa0JSZzBCR2tHUUJ3d0JDMEVFSTFaQm1RRkdEUUFhUWNnREN4QnZJMVFDZnlNK0JFQkJDQ05XUVprQlJnMEJHa0dRQnd3QkMwRUVJMVpCbVFGR0RRQWFRY2dEQzJza1ZBd0JDd3NMTXdFQmYwRUJJNUFCQkg5QkFnVkJCd3NpQW5RZ0FIRkJBRWNpQUFSL1FRRWdBblFnQVhGRkJTQUFDd1JBUVFFUEMwRUFDNVlCQVFKL0k1RUJSUVJBRHdzRFFDQUJJQUJJQkVBZ0FVRUVhaUVCSTQwQklnSkJCR29ralFFampRRkIvLzhEU2dSQUk0MEJRWUNBQkdza2pRRUxJQUlqalFFUWNRUkFRWUgrQTBHQi9nTVFBVUVCZEVFQmFrSC9BWEVRQkNPT0FVRUJhaVNPQVNPT0FVRUlSZ1JBUVFBa2pnRkJBU1NDQVVFREVEcEJndjREUVlMK0F4QUJRZjkrY1JBRVFRQWtrUUVMQ3d3QkN3c0xpQUVBSThJQlFRQktCRUFqd2dFZ0FHb2hBRUVBSk1JQkN5TkpJQUJxSkVralRVVUVRQ014QkVBalZDQUFhaVJVRUhBRklBQVFid3NqTUFSQUkxc2dBR29rV3dVZ0FCQk5DeUFBRUhJTEl6SUVRQ09GQVNBQWFpU0ZBUkJtQlNBQUVHVUxJNVFCSUFCcUpKUUJJNVFCSTVJQlRnUkFJNU1CUVFGcUpKTUJJNVFCSTVJQmF5U1VBUXNMQ2dCQkJCQnpJMGdRQVFzbUFRRi9RUVFRY3lOSVFRRnFRZi8vQTNFUUFTRUFFSFJCL3dGeElBQkIvd0Z4UVFoMGNnc01BRUVFRUhNZ0FDQUJFR29MTUFFQmYwRUJJQUIwUWY4QmNTRUNJQUZCQUVvRVFDTkdJQUp5UWY4QmNTUkdCU05HSUFKQi93RnpjU1JHQ3lOR0N3a0FRUVVnQUJCM0dndEpBUUYvSUFGQkFFNEVRQ0FBUVE5eElBRkJEM0ZxUVJCeEJFQkJBUkI0QlVFQUVIZ0xCU0FCUVI5MUlnSWdBU0FDYW5OQkQzRWdBRUVQY1VzRVFFRUJFSGdGUVFBUWVBc0xDd2tBUVFjZ0FCQjNHZ3NKQUVFR0lBQVFkeG9MQ1FCQkJDQUFFSGNhQ3pzQkFuOGdBVUdBL2dOeFFRaDFJUUlnQUVFQmFpRURJQUFnQVVIL0FYRWlBUkJwQkVBZ0FDQUJFQVFMSUFNZ0FoQnBCRUFnQXlBQ0VBUUxDd3dBUVFnUWN5QUFJQUVRZlF0MUFDQUNCRUFnQVNBQVFmLy9BM0VpQUdvZ0FDQUJjM01pQWtFUWNRUkFRUUVRZUFWQkFCQjRDeUFDUVlBQ2NRUkFRUUVRZkFWQkFCQjhDd1VnQUNBQmFrSC8vd054SWdJZ0FFSC8vd054U1FSQVFRRVFmQVZCQUJCOEN5QUFJQUZ6SUFKelFZQWdjUVJBUVFFUWVBVkJBQkI0Q3dzTENnQkJCQkJ6SUFBUVVndVJCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNNRXdzUWRVSC8vd054SWdCQmdQNERjVUVJZFNSQUlBQkIvd0Z4SkVFTUR3c2pRVUgvQVhFalFFSC9BWEZCQ0hSeUl6OFFkZ3dSQ3lOQlFmOEJjU05BUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrUUF3UkN5TkFRUUVRZVNOQVFRRnFRZjhCY1NSQUkwQUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBOExJMEJCZnhCNUkwQkJBV3RCL3dGeEpFQWpRQVJBUVFBUWVnVkJBUkI2QzBFQkVIc01EZ3NRZEVIL0FYRWtRQXdMQ3lNL1FZQUJjVUdBQVVZRVFFRUJFSHdGUVFBUWZBc2pQeUlBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVrUHd3TEN4QjFRZi8vQTNFalJ4QitEQWdMSTBWQi93RnhJMFJCL3dGeFFRaDBjaUlBSTBGQi93RnhJMEJCL3dGeFFRaDBjaUlCUVFBUWZ5QUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSVUVBRUh0QkNBOExJMEZCL3dGeEkwQkIvd0Z4UVFoMGNoQ0FBVUgvQVhFa1B3d0pDeU5CUWY4QmNTTkFRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtRQXdKQ3lOQlFRRVFlU05CUVFGcVFmOEJjU1JCSTBFRVFFRUFFSG9GUVFFUWVndEJBQkI3REFjTEkwRkJmeEI1STBGQkFXdEIvd0Z4SkVFalFRUkFRUUFRZWdWQkFSQjZDMEVCRUhzTUJnc1FkRUgvQVhFa1FRd0RDeU0vUVFGeFFRQkxCRUJCQVJCOEJVRUFFSHdMSXo4aUFFRUhkQ0FBUWY4QmNVRUJkbkpCL3dGeEpEOE1Bd3RCZnc4TEkwaEJBbXBCLy84RGNTUklEQUlMSTBoQkFXcEIvLzhEY1NSSURBRUxRUUFRZWtFQUVIdEJBQkI0QzBFRUR3c2dBRUgvQVhFa1FVRUlDeWdCQVg4Z0FFRVlkRUVZZFNJQlFZQUJjUVJBUVlBQ0lBQkJHSFJCR0hWclFYOXNJUUVMSUFFTEtRRUJmeUFBRUlJQklRRWpTQ0FCUVJoMFFSaDFha0gvL3dOeEpFZ2pTRUVCYWtILy93TnhKRWdMMkFVQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkVFY0VRQ0FBUVJGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TTZCRUJCemY0REVJQUJRZjhCY1NJQVFRRnhCRUJCemY0RElBQkJmbkVpQUVHQUFYRUVmMEVBSkQ0Z0FFSC9mbkVGUVFFa1BpQUFRWUFCY2dzUWRrSEVBQThMQzBFQkpFME1FQXNRZFVILy93TnhJZ0JCZ1A0RGNVRUlkU1JDSUFCQi93RnhKRU1qU0VFQ2FrSC8vd054SkVnTUVRc2pRMEgvQVhFalFrSC9BWEZCQ0hSeUl6OFFkZ3dRQ3lORFFmOEJjU05DUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVrUWd3UUN5TkNRUUVRZVNOQ1FRRnFRZjhCY1NSQ0kwSUVRRUVBRUhvRlFRRVFlZ3RCQUJCN0RBNExJMEpCZnhCNUkwSkJBV3RCL3dGeEpFSWpRZ1JBUVFBUWVnVkJBUkI2QzBFQkVIc01EUXNRZEVIL0FYRWtRZ3dLQzBFQlFRQWpQeUlCUVlBQmNVR0FBVVliSVFBalJrRUVka0VCY1NBQlFRRjBja0gvQVhFa1B3d0tDeEIwRUlNQlFRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBQ05EUWY4QmNTTkNRZjhCY1VFSWRISWlBVUVBRUg4Z0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkVJQUJCL3dGeEpFVkJBQkI3UVFnUEN5TkRRZjhCY1NOQ1FmOEJjVUVJZEhJUWdBRkIvd0Z4SkQ4TUNBc2pRMEgvQVhFalFrSC9BWEZCQ0hSeVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpFSU1DQXNqUTBFQkVIa2pRMEVCYWtIL0FYRWtReU5EQkVCQkFCQjZCVUVCRUhvTFFRQVFld3dHQ3lORFFYOFFlU05EUVFGclFmOEJjU1JESTBNRVFFRUFFSG9GUVFFUWVndEJBUkI3REFVTEVIUkIvd0Z4SkVNTUFndEJBVUVBSXo4aUFVRUJjVUVCUmhzaEFDTkdRUVIyUVFGeFFRZDBJQUZCL3dGeFFRRjJjaVEvREFJTFFYOFBDeU5JUVFGcVFmLy9BM0VrU0F3QkN5QUFCRUJCQVJCOEJVRUFFSHdMUVFBUWVrRUFFSHRCQUJCNEMwRUVEd3NnQUVIL0FYRWtRMEVJQzdnR0FRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCSUVjRVFDQUFRU0ZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lOR1FRZDJRUUZ4QkVBalNFRUJha0gvL3dOeEpFZ0ZFSFFRZ3dFTFFRZ1BDeEIxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSU05JUVFKcVFmLy9BM0VrU0F3UUN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFDTS9FSFlnQUVFQmFrSC8vd054SWdCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVVTUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JVRUlEd3NqUkVFQkVIa2pSRUVCYWtIL0FYRWtSQ05FQkVCQkFCQjZCVUVCRUhvTFFRQVFld3dOQ3lORVFYOFFlU05FUVFGclFmOEJjU1JFSTBRRVFFRUFFSG9GUVFFUWVndEJBUkI3REF3TEVIUkIvd0Z4SkVRTUNndEJCa0VBSTBaQkJYWkJBWEZCQUVzYklRRWdBVUhnQUhJZ0FTTkdRUVIyUVFGeFFRQkxHeUVCSTBaQkJuWkJBWEZCQUVzRWZ5TS9JQUZyUWY4QmNRVWdBVUVHY2lBQkl6OGlBRUVQY1VFSlN4c2lBVUhnQUhJZ0FTQUFRWmtCU3hzaUFTQUFha0gvQVhFTElnQUVRRUVBRUhvRlFRRVFlZ3NnQVVIZ0FIRUVRRUVCRUh3RlFRQVFmQXRCQUJCNElBQWtQd3dLQ3lOR1FRZDJRUUZ4UVFCTEJFQVFkQkNEQVFValNFRUJha0gvL3dOeEpFZ0xRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQVNBQlFmLy9BM0ZCQUJCL0lBRkJBWFJCLy84RGNTSUJRWUQrQTNGQkNIVWtSQ0FCUWY4QmNTUkZRUUFRZTBFSUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnRVFnQUZCL3dGeEpEOGdBVUVCYWtILy93TnhJZ0ZCZ1A0RGNVRUlkU1JFSUFGQi93RnhKRVVNQndzalJVSC9BWEVqUkVIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQVVHQS9nTnhRUWgxSkVRZ0FVSC9BWEVrUlVFSUR3c2pSVUVCRUhralJVRUJha0gvQVhFa1JTTkZCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d0ZDeU5GUVg4UWVTTkZRUUZyUWY4QmNTUkZJMFVFUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQVFMRUhSQi93RnhKRVVNQWdzalAwRi9jMEgvQVhFa1AwRUJFSHRCQVJCNERBSUxRWDhQQ3lOSVFRRnFRZi8vQTNFa1NBdEJCQXVVQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFd1J3UkFJQUJCTVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEkwWkJCSFpCQVhFRVFDTklRUUZxUWYvL0EzRWtTQVVRZEJDREFRdEJDQThMRUhWQi8vOERjU1JISTBoQkFtcEIvLzhEY1NSSURCSUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUFJejhRZGd3T0N5TkhRUUZxUWYvL0EzRWtSMEVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdBUWdBRWlBVUVCRUhrZ0FVRUJha0gvQVhFaUFRUkFRUUFRZWdWQkFSQjZDMEVBRUhzTURRc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnQVFnQUVpQVVGL0VIa2dBVUVCYTBIL0FYRWlBUVJBUVFBUWVnVkJBUkI2QzBFQkVIc01EQXNqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSFJCL3dGeEVIWU1EQXRCQUJCN1FRQVFlRUVCRUh3TURBc2pSa0VFZGtFQmNVRUJSZ1JBRUhRUWd3RUZJMGhCQVdwQi8vOERjU1JJQzBFSUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUlnRWpSMEVBRUg4alJ5QUJha0gvL3dOeElnQkJnUDREY1VFSWRTUkVJQUJCL3dGeEpFVkJBQkI3UVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFCQ0FBVUgvQVhFa1B3d0dDeU5IUVFGclFmLy9BM0VrUjBFSUR3c2pQMEVCRUhralAwRUJha0gvQVhFa1B5TS9CRUJCQUJCNkJVRUJFSG9MUVFBUWV3d0hDeU0vUVg4UWVTTS9RUUZyUWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQVlMRUhSQi93RnhKRDhNQkF0QkFCQjdRUUFRZUNOR1FRUjJRUUZ4UVFCTEJFQkJBQkI4QlVFQkVId0xEQVFMUVg4UEN5QUFRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSUXdDQ3lBQVFmLy9BM0VnQVJCMkRBRUxJMGhCQVdwQi8vOERjU1JJQzBFRUMrUUJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUJIQkVBZ0FFSEJBRVlOQVFKQUlBQkJ3Z0JyRGc0REJBVUdCd2dKRVFvTERBME9Ed0FMREE4TERBOExJMEVrUUF3T0N5TkNKRUFNRFFzalF5UkFEQXdMSTBRa1FBd0xDeU5GSkVBTUNnc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSQURBa0xJejhrUUF3SUN5TkFKRUVNQndzalFpUkJEQVlMSTBNa1FRd0ZDeU5FSkVFTUJBc2pSU1JCREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFVSC9BWEVrUVF3Q0N5TS9KRUVNQVF0QmZ3OExRUVFMM3dFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFCSEJFQWdBRUhSQUVZTkFRSkFJQUJCMGdCckRnNFFBd1FGQmdjSUNRb1FDd3dORGdBTERBNExJMEFrUWd3T0N5TkJKRUlNRFFzalF5UkNEQXdMSTBRa1Fnd0xDeU5GSkVJTUNnc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSQ0RBa0xJejhrUWd3SUN5TkFKRU1NQndzalFTUkREQVlMSTBJa1F3d0ZDeU5FSkVNTUJBc2pSU1JEREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFVSC9BWEVrUXd3Q0N5TS9KRU1NQVF0QmZ3OExRUVFMM3dFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFCSEJFQWdBRUhoQUVZTkFRSkFJQUJCNGdCckRnNERCQkFGQmdjSUNRb0xEQkFORGdBTERBNExJMEFrUkF3T0N5TkJKRVFNRFFzalFpUkVEQXdMSTBNa1JBd0xDeU5GSkVRTUNnc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVJQUJRZjhCY1NSRURBa0xJejhrUkF3SUN5TkFKRVVNQndzalFTUkZEQVlMSTBJa1JRd0ZDeU5ESkVVTUJBc2pSQ1JGREFNTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFVSC9BWEVrUlF3Q0N5TS9KRVVNQVF0QmZ3OExRUVFMN0FJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FFY0VRQ0FBUWZFQVJnMEJBa0FnQUVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UkFBc01Ed3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJMEFRZGd3UEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJalFSQjJEQTRMSTBWQi93RnhJMFJCL3dGeFFRaDBjaU5DRUhZTURRc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUkwTVFkZ3dNQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUkJCMkRBc0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpTkZFSFlNQ2dzanhRRkZCRUFDUUNPWkFRUkFRUUVrU2d3QkN5TitJNFFCY1VFZmNVVUVRRUVCSkVzTUFRdEJBU1JNQ3dzTUNRc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUl6OFFkZ3dJQ3lOQUpEOE1Cd3NqUVNRL0RBWUxJMElrUHd3RkN5TkRKRDhNQkFzalJDUS9EQU1MSTBVa1B3d0NDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUZCL3dGeEpEOE1BUXRCZnc4TFFRUUxTUUVCZnlBQlFRQk9CRUFnQUVIL0FYRWdBQ0FCYWtIL0FYRkxCRUJCQVJCOEJVRUFFSHdMQlNBQlFSOTFJZ0lnQVNBQ2FuTWdBRUgvQVhGS0JFQkJBUkI4QlVFQUVId0xDd3MwQVFGL0l6OGdBRUgvQVhFaUFSQjVJejhnQVJDTEFTTS9JQUJxUWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFCQjdDMndCQW44alB5QUFhaU5HUVFSMlFRRnhha0gvQVhFaUFTRUNJejhnQUhNZ0FYTkJFSEVFUUVFQkVIZ0ZRUUFRZUFzalB5QUFRZjhCY1dvalJrRUVka0VCY1dwQmdBSnhRUUJMQkVCQkFSQjhCVUVBRUh3TElBSWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRQVFld3Z4QVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWUFCUndSQUlBRkJnUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lOQUVJd0JEQkFMSTBFUWpBRU1Ed3NqUWhDTUFRd09DeU5ERUl3QkRBMExJMFFRakFFTURBc2pSUkNNQVF3TEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFqQUVNQ2dzalB4Q01BUXdKQ3lOQUVJMEJEQWdMSTBFUWpRRU1Cd3NqUWhDTkFRd0dDeU5ERUkwQkRBVUxJMFFRalFFTUJBc2pSUkNOQVF3REN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFqUUVNQWdzalB4Q05BUXdCQzBGL0R3dEJCQXMzQVFGL0l6OGdBRUgvQVhGQmYyd2lBUkI1SXo4Z0FSQ0xBU00vSUFCclFmOEJjU1EvSXo4RVFFRUFFSG9GUVFFUWVndEJBUkI3QzJ3QkFuOGpQeUFBYXlOR1FRUjJRUUZ4YTBIL0FYRWlBU0VDSXo4Z0FITWdBWE5CRUhFRVFFRUJFSGdGUVFBUWVBc2pQeUFBUWY4QmNXc2pSa0VFZGtFQmNXdEJnQUp4UVFCTEJFQkJBUkI4QlVFQUVId0xJQUlrUHlNL0JFQkJBQkI2QlVFQkVIb0xRUUVRZXd2eEFRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQ0lCUVpBQlJ3UkFJQUZCa1FGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5TkFFSThCREJBTEkwRVFqd0VNRHdzalFoQ1BBUXdPQ3lOREVJOEJEQTBMSTBRUWp3RU1EQXNqUlJDUEFRd0xDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRandFTUNnc2pQeENQQVF3SkN5TkFFSkFCREFnTEkwRVFrQUVNQndzalFoQ1FBUXdHQ3lOREVKQUJEQVVMSTBRUWtBRU1CQXNqUlJDUUFRd0RDeU5GUWY4QmNTTkVRZjhCY1VFSWRISVFnQUVRa0FFTUFnc2pQeENRQVF3QkMwRi9Ed3RCQkFzakFDTS9JQUJ4SkQ4alB3UkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFSQjRRUUFRZkFzbkFDTS9JQUJ6UWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFCQjdRUUFRZUVFQUVId0w4UUVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBaUFVR2dBVWNFUUNBQlFhRUJhdzRQQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqUUJDU0FRd1FDeU5CRUpJQkRBOExJMElRa2dFTURnc2pReENTQVF3TkN5TkVFSklCREF3TEkwVVFrZ0VNQ3dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQkVKSUJEQW9MSXo4UWtnRU1DUXNqUUJDVEFRd0lDeU5CRUpNQkRBY0xJMElRa3dFTUJnc2pReENUQVF3RkN5TkVFSk1CREFRTEkwVVFrd0VNQXdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQkVKTUJEQUlMSXo4UWt3RU1BUXRCZnc4TFFRUUxKd0FqUHlBQWNrSC9BWEVrUHlNL0JFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIaEJBQkI4Q3k4QkFYOGpQeUFBUWY4QmNVRi9iQ0lCRUhralB5QUJFSXNCSXo4Z0FXb0VRRUVBRUhvRlFRRVFlZ3RCQVJCN0MvRUJBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBSWdGQnNBRkhCRUFnQVVHeEFXc09Ed0VDQXdRRkJnY0lDUW9MREEwT0R4QUxJMEFRbFFFTUVBc2pRUkNWQVF3UEN5TkNFSlVCREE0TEkwTVFsUUVNRFFzalJCQ1ZBUXdNQ3lORkVKVUJEQXNMSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDVkFRd0tDeU0vRUpVQkRBa0xJMEFRbGdFTUNBc2pRUkNXQVF3SEN5TkNFSllCREFZTEkwTVFsZ0VNQlFzalJCQ1dBUXdFQ3lORkVKWUJEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVJDV0FRd0NDeU0vRUpZQkRBRUxRWDhQQzBFRUN6c0JBWDhnQUJCUklnRkJmMFlFZnlBQUVBRUZJQUVMUWY4QmNTQUFRUUZxSWdFUVVTSUFRWDlHQkg4Z0FSQUJCU0FBQzBIL0FYRkJDSFJ5Q3dzQVFRZ1FjeUFBRUpnQkMwTUFJQUJCZ0FGeFFZQUJSZ1JBUVFFUWZBVkJBQkI4Q3lBQVFRRjBJQUJCL3dGeFFRZDJja0gvQVhFaUFBUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRJQUFMUVFBZ0FFRUJjVUVBU3dSQVFRRVFmQVZCQUJCOEN5QUFRUWQwSUFCQi93RnhRUUYyY2tIL0FYRWlBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0SUFBTFR3RUJmMEVCUVFBZ0FFR0FBWEZCZ0FGR0d5RUJJMFpCQkhaQkFYRWdBRUVCZEhKQi93RnhJUUFnQVFSQVFRRVFmQVZCQUJCOEN5QUFCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGdnQUF0UUFRRi9RUUZCQUNBQVFRRnhRUUZHR3lFQkkwWkJCSFpCQVhGQkIzUWdBRUgvQVhGQkFYWnlJUUFnQVFSQVFRRVFmQVZCQUJCOEN5QUFCRUJCQUJCNkJVRUJFSG9MUVFBUWUwRUFFSGdnQUF0R0FRRi9RUUZCQUNBQVFZQUJjVUdBQVVZYklRRWdBRUVCZEVIL0FYRWhBQ0FCQkVCQkFSQjhCVUVBRUh3TElBQUVRRUVBRUhvRlFRRVFlZ3RCQUJCN1FRQVFlQ0FBQzE0QkFuOUJBVUVBSUFCQkFYRkJBVVliSVFGQkFVRUFJQUJCZ0FGeFFZQUJSaHNoQWlBQVFmOEJjVUVCZGlJQVFZQUJjaUFBSUFJYklnQUVRRUVBRUhvRlFRRVFlZ3RCQUJCN1FRQVFlQ0FCQkVCQkFSQjhCVUVBRUh3TElBQUxNQUFnQUVFUGNVRUVkQ0FBUWZBQmNVRUVkbklpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNFFRQVFmQ0FBQzBJQkFYOUJBVUVBSUFCQkFYRkJBVVliSVFFZ0FFSC9BWEZCQVhZaUFBUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRJQUVFUUVFQkVId0ZRUUFRZkFzZ0FBc2tBRUVCSUFCMElBRnhRZjhCY1FSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQVJCNElBRUxud2dCQm44Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkNHOGlCaUlGQkVBZ0JVRUJhdzRIQVFJREJBVUdCd2dMSTBBaEFRd0hDeU5CSVFFTUJnc2pRaUVCREFVTEkwTWhBUXdFQ3lORUlRRU1Bd3NqUlNFQkRBSUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBU0VCREFFTEl6OGhBUXNDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRTSUZJZ1FFUUNBRVFRRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeUFBUVFkTUJIOUJBU0VDSUFFUW1nRUZJQUJCRDB3RWYwRUJJUUlnQVJDYkFRVkJBQXNMSVFNTUR3c2dBRUVYVEFSL1FRRWhBaUFCRUp3QkJTQUFRUjlNQkg5QkFTRUNJQUVRblFFRlFRQUxDeUVEREE0TElBQkJKMHdFZjBFQklRSWdBUkNlQVFVZ0FFRXZUQVIvUVFFaEFpQUJFSjhCQlVFQUN3c2hBd3dOQ3lBQVFUZE1CSDlCQVNFQ0lBRVFvQUVGSUFCQlAwd0VmMEVCSVFJZ0FSQ2hBUVZCQUFzTElRTU1EQXNnQUVISEFFd0VmMEVCSVFKQkFDQUJFS0lCQlNBQVFjOEFUQVIvUVFFaEFrRUJJQUVRb2dFRlFRQUxDeUVEREFzTElBQkIxd0JNQkg5QkFTRUNRUUlnQVJDaUFRVWdBRUhmQUV3RWYwRUJJUUpCQXlBQkVLSUJCVUVBQ3dzaEF3d0tDeUFBUWVjQVRBUi9RUUVoQWtFRUlBRVFvZ0VGSUFCQjd3Qk1CSDlCQVNFQ1FRVWdBUkNpQVFWQkFBc0xJUU1NQ1FzZ0FFSDNBRXdFZjBFQklRSkJCaUFCRUtJQkJTQUFRZjhBVEFSL1FRRWhBa0VISUFFUW9nRUZRUUFMQ3lFRERBZ0xJQUJCaHdGTUJIOUJBU0VDSUFGQmZuRUZJQUJCandGTUJIOUJBU0VDSUFGQmZYRUZRUUFMQ3lFRERBY0xJQUJCbHdGTUJIOUJBU0VDSUFGQmUzRUZJQUJCbndGTUJIOUJBU0VDSUFGQmQzRUZRUUFMQ3lFRERBWUxJQUJCcHdGTUJIOUJBU0VDSUFGQmIzRUZJQUJCcndGTUJIOUJBU0VDSUFGQlgzRUZRUUFMQ3lFRERBVUxJQUJCdHdGTUJIOUJBU0VDSUFGQnYzOXhCU0FBUWI4QlRBUi9RUUVoQWlBQlFmOStjUVZCQUFzTElRTU1CQXNnQUVISEFVd0VmMEVCSVFJZ0FVRUJjZ1VnQUVIUEFVd0VmMEVCSVFJZ0FVRUNjZ1ZCQUFzTElRTU1Bd3NnQUVIWEFVd0VmMEVCSVFJZ0FVRUVjZ1VnQUVIZkFVd0VmMEVCSVFJZ0FVRUljZ1ZCQUFzTElRTU1BZ3NnQUVIbkFVd0VmMEVCSVFJZ0FVRVFjZ1VnQUVIdkFVd0VmMEVCSVFJZ0FVRWdjZ1ZCQUFzTElRTU1BUXNnQUVIM0FVd0VmMEVCSVFJZ0FVSEFBSElGSUFCQi93Rk1CSDlCQVNFQ0lBRkJnQUZ5QlVFQUN3c2hBd3NDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQVlpQkFSQUlBUkJBV3NPQndFQ0F3UUZCZ2NJQ3lBREpFQU1Cd3NnQXlSQkRBWUxJQU1rUWd3RkN5QURKRU1NQkFzZ0F5UkVEQU1MSUFNa1JRd0NDeUFGUVFSSUlnUUVmeUFFQlNBRlFRZEtDd1JBSTBWQi93RnhJMFJCL3dGeFFRaDBjaUFERUhZTERBRUxJQU1rUHd0QkJFRi9JQUliQys0REFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFVY0VRQ0FBUWNFQmF3NFBBUUlSQXdRRkJnY0lDUW9MRUF3TkRnc2pSa0VIZGtFQmNRMFJEQTRMSTBjUW1RRkIvLzhEY1NFQUkwZEJBbXBCLy84RGNTUkhJQUJCZ1A0RGNVRUlkU1JBSUFCQi93RnhKRUZCQkE4TEkwWkJCM1pCQVhFTkVRd09DeU5HUVFkMlFRRnhEUkFNREFzalIwRUNhMEgvL3dOeEpFY2pSeU5CUWY4QmNTTkFRZjhCY1VFSWRISVFmZ3dOQ3hCMEVJd0JEQTBMSTBkQkFtdEIvLzhEY1NSSEkwY2pTQkIrUVFBa1NBd0xDeU5HUVFkMlFRRnhRUUZIRFFvTUJ3c2pSeENaQVVILy93TnhKRWdqUjBFQ2FrSC8vd054SkVjTUNRc2pSa0VIZGtFQmNVRUJSZzBIREFvTEVIUkIvd0Z4RUtNQklRQWpTRUVCYWtILy93TnhKRWdnQUE4TEkwWkJCM1pCQVhGQkFVY05DQ05IUVFKclFmLy9BM0VrUnlOSEkwaEJBbXBCLy84RGNSQitEQVVMRUhRUWpRRU1CZ3NqUjBFQ2EwSC8vd054SkVjalJ5TklFSDVCQ0NSSURBUUxRWDhQQ3lOSEVKa0JRZi8vQTNFa1NDTkhRUUpxUWYvL0EzRWtSMEVNRHdzalIwRUNhMEgvL3dOeEpFY2pSeU5JUVFKcVFmLy9BM0VRZmdzUWRVSC8vd054SkVnTFFRZ1BDeU5JUVFGcVFmLy9BM0VrU0VFRUR3c2pTRUVDYWtILy93TnhKRWhCREF2VEF3QUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQVVjRVFDQUFRZEVCYXc0UEFRSU5Bd1FGQmdjSUNRMEtEUXNNRFFzalJrRUVka0VCY1EwUERBMExJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUkNJQUJCL3dGeEpFTkJCQThMSTBaQkJIWkJBWEVORHd3TUN5TkdRUVIyUVFGeERRNGpSMEVDYTBILy93TnhKRWNqUnlOSVFRSnFRZi8vQTNFUWZnd0xDeU5IUVFKclFmLy9BM0VrUnlOSEkwTkIvd0Z4STBKQi93RnhRUWgwY2hCK0RBc0xFSFFRandFTUN3c2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJFQ1JJREFrTEkwWkJCSFpCQVhGQkFVY05DQXdHQ3lOSEVKa0JRZi8vQTNFa1NFRUJKSm9CSTBkQkFtcEIvLzhEY1NSSERBY0xJMFpCQkhaQkFYRkJBVVlOQlF3SUN5TkdRUVIyUVFGeFFRRkhEUWNqUjBFQ2EwSC8vd054SkVjalJ5TklRUUpxUWYvL0EzRVFmZ3dFQ3hCMEVKQUJEQVVMSTBkQkFtdEIvLzhEY1NSSEkwY2pTQkIrUVJna1NBd0RDMEYvRHdzalJ4Q1pBVUgvL3dOeEpFZ2pSMEVDYWtILy93TnhKRWRCREE4TEVIVkIvLzhEY1NSSUMwRUlEd3NqU0VFQmFrSC8vd054SkVoQkJBOExJMGhCQW1wQi8vOERjU1JJUVF3TDhBSUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUZIQkVBZ0FFSGhBV3NPRHdFQ0N3c0RCQVVHQndnTEN3c0pDZ3NMRUhSQi93RnhRWUQrQTJvalB4QjJEQXNMSTBjUW1RRkIvLzhEY1NFQUkwZEJBbXBCLy84RGNTUkhJQUJCZ1A0RGNVRUlkU1JFSUFCQi93RnhKRVZCQkE4TEkwRkJnUDREYWlNL0VIWkJCQThMSTBkQkFtdEIvLzhEY1NSSEkwY2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVINUJDQThMRUhRUWtnRU1Cd3NqUjBFQ2EwSC8vd054SkVjalJ5TklFSDVCSUNSSVFRZ1BDeEIwRUlJQlFSaDBRUmgxSVFBalJ5QUFRUUVRZnlOSElBQnFRZi8vQTNFa1IwRUFFSHBCQUJCN0kwaEJBV3BCLy84RGNTUklRUXdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElrU0VFRUR3c1FkVUgvL3dOeEl6OFFkaU5JUVFKcVFmLy9BM0VrU0VFRUR3c1FkQkNUQVF3Q0N5TkhRUUpyUWYvL0EzRWtSeU5ISTBnUWZrRW9KRWhCQ0E4TFFYOFBDeU5JUVFGcVFmLy9BM0VrU0VFRUM2Y0RBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJSd1JBSUFCQjhRRnJEZzhCQWdNTkJBVUdCd2dKQ2cwTkN3d05DeEIwUWY4QmNVR0EvZ05xRUlBQlFmOEJjU1EvREEwTEkwY1FtUUZCLy84RGNTRUFJMGRCQW1wQi8vOERjU1JISUFCQmdQNERjVUVJZFNRL0lBQkIvd0Z4SkVZTURRc2pRVUdBL2dOcUVJQUJRZjhCY1NRL0RBd0xRUUFrbVFFTUN3c2pSMEVDYTBILy93TnhKRWNqUnlOR1FmOEJjU00vUWY4QmNVRUlkSElRZmtFSUR3c1FkQkNWQVF3SUN5TkhRUUpyUWYvL0EzRWtSeU5ISTBnUWZrRXdKRWhCQ0E4TEVIUVFnZ0VoQUVFQUVIcEJBQkI3STBjZ0FFRVlkRUVZZFNJQVFRRVFmeU5ISUFCcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlNOSVFRRnFRZi8vQTNFa1NFRUlEd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlKRWRCQ0E4TEVIVkIvLzhEY1JDQUFVSC9BWEVrUHlOSVFRSnFRZi8vQTNFa1NBd0ZDMEVCSkpvQkRBUUxFSFFRbGdFTUFnc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJPQ1JJUVFnUEMwRi9Ed3NqU0VFQmFrSC8vd054SkVnTFFRUUwzQUVCQVg4alNFRUJha0gvL3dOeEpFZ2pUQVJBSTBoQkFXdEIvLzhEY1NSSUN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lCQkVBZ0FVRUJSZzBCQWtBZ0FVRUNhdzROQXdRRkJnY0lDUW9MREEwT0R3QUxEQThMSUFBUWdRRVBDeUFBRUlRQkR3c2dBQkNGQVE4TElBQVFoZ0VQQ3lBQUVJY0JEd3NnQUJDSUFROExJQUFRaVFFUEN5QUFFSW9CRHdzZ0FCQ09BUThMSUFBUWtRRVBDeUFBRUpRQkR3c2dBQkNYQVE4TElBQVFwQUVQQ3lBQUVLVUJEd3NnQUJDbUFROExJQUFRcHdFTHdnRUJBbjlCQUNTWkFVR1AvZ01RQVVFQklBQjBRWDl6Y1NJQkpJUUJRWS8rQXlBQkVBUWpSMEVDYTBILy93TnhKRWNDUUNOS0lnRWpTeUFCR3cwQUN5TkhJZ0VqU0NJQ1FmOEJjUkFFSUFGQkFXb2dBa0dBL2dOeFFRaDFFQVFDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdNREJBVUFDd3dGQzBFQUpIOUJ3QUFrU0F3RUMwRUFKSUFCUWNnQUpFZ01Bd3RCQUNTQkFVSFFBQ1JJREFJTFFRQWtnZ0ZCMkFBa1NBd0JDMEVBSklNQlFlQUFKRWdMQy9rQkFRTi9JNW9CQkVCQkFTU1pBVUVBSkpvQkN5TitJNFFCY1VFZmNVRUFTZ1JBSTB0Rkk1a0JJZ0lnQWhzRWZ5Ti9JM2tpQUNBQUd3Ui9RUUFRcVFGQkFRVWpnQUVqZWlJQUlBQWJCSDlCQVJDcEFVRUJCU09CQVNON0lnQWdBQnNFZjBFQ0VLa0JRUUVGSTRJQkkzd2lBQ0FBR3dSL1FRTVFxUUZCQVFVamd3RWpmU0lBSUFBYkJIOUJCQkNwQVVFQkJVRUFDd3NMQ3dzRlFRQUxCRUFDZjBFQkkwb2lBQ05MSUFBYkRRQWFRUUFMQkg5QkFDUkxRUUFrU2tFQUpFeEJBQ1JOUVJnRlFSUUxJUUVMQW45QkFTTktJZ0FqU3lBQUd3MEFHa0VBQ3dSQVFRQWtTMEVBSkVwQkFDUk1RUUFrVFFzZ0FROExRUUFMdVFFQkFuOUJBU1F0STB3RVFDTklFQUZCL3dGeEVLZ0JFSE5CQUNSTFFRQWtTa0VBSkV4QkFDUk5DeENxQVNJQlFRQktCRUFnQVJCekMwRUVJUUFDZjBFQkkwb2lBU05MSUFFYkRRQWFRUUFMUlNJQkJIOGpUVVVGSUFFTEJFQWpTQkFCUWY4QmNSQ29BU0VBQ3lOR1FmQUJjU1JHSUFCQkFFd0VRQ0FBRHdzZ0FCQnpJNWNCUVFGcUpKY0JJNWNCSTVVQlRnUkFJNVlCUVFGcUpKWUJJNWNCSTVVQmF5U1hBUXNqU0NPTEFrWUVRRUVCSk1FQkN5QUFDd1FBSTJvTDBnRUJCSDhnQUVGL1FZQUlJQUJCQUVnYklBQkJBRW9iSVFOQkFDRUFBMEFDZndKL0lBUkZJZ0VFUUNBQVJTRUJDeUFCQ3dSQUlBSkZJUUVMSUFFTEJFQWp3UUZGSVFFTElBRUVRQkNyQVVFQVNBUkFRUUVoQkFValNTTStCSDlCb01rSUJVSFFwQVFMVGdSQVFRRWhBQVVnQTBGL1NpSUJCRUFqYWlBRFRpRUJDMEVCSUFJZ0FSc2hBZ3NMREFFTEN5QUFCRUFqU1NNK0JIOUJvTWtJQlVIUXBBUUxheVJKSTR3Q0R3c2dBZ1JBSTQwQ0R3c2p3UUVFUUVFQUpNRUJJNDRDRHdzalNFRUJhMEgvL3dOeEpFaEJmd3NIQUVGL0VLMEJDemtCQTM4RFFDQUNJQUJJSWdNRWZ5QUJRUUJPQlNBREN3UkFRWDhRclFFaEFTQUNRUUZxSVFJTUFRc0xJQUZCQUVnRVFDQUJEd3RCQUFzRkFDT1NBUXNGQUNPVEFRc0ZBQ09VQVF0ZkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUNJQlFRRkdEUUVDUUNBQlFRSnJEZ1lEQkFVR0J3Z0FDd3dJQ3lQc0FROExJKzBCRHdzajdnRVBDeVB2QVE4TEkvQUJEd3NqOFFFUEN5UHlBUThMSS9NQkR3dEJBQXVMQVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUFpQWtFQlJnMEJBa0FnQWtFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQVVFQVJ5VHNBUXdIQ3lBQlFRQkhKTzBCREFZTElBRkJBRWNrN2dFTUJRc2dBVUVBUnlUdkFRd0VDeUFCUVFCSEpQQUJEQU1MSUFGQkFFY2s4UUVNQWdzZ0FVRUFSeVR5QVF3QkN5QUJRUUJISlBNQkN3dFVBUUYvUVFBa1RTQUFFTE1CUlFSQVFRRWhBUXNnQUVFQkVMUUJJQUVFUUVFQlFRRkJBRUVCUVFBZ0FFRURUQnNpQVNPL0FTSUFJQUFiR3lBQlJTUEFBU0lBSUFBYkd3UkFRUUVrZ3dGQkJCQTZDd3NMQ1FBZ0FFRUFFTFFCQzVvQkFDQUFRUUJLQkVCQkFCQzFBUVZCQUJDMkFRc2dBVUVBU2dSQVFRRVF0UUVGUVFFUXRnRUxJQUpCQUVvRVFFRUNFTFVCQlVFQ0VMWUJDeUFEUVFCS0JFQkJBeEMxQVFWQkF4QzJBUXNnQkVFQVNnUkFRUVFRdFFFRlFRUVF0Z0VMSUFWQkFFb0VRRUVGRUxVQkJVRUZFTFlCQ3lBR1FRQktCRUJCQmhDMUFRVkJCaEMyQVFzZ0IwRUFTZ1JBUVFjUXRRRUZRUWNRdGdFTEN3Y0FJQUFraXdJTEJ3QkJmeVNMQWdzSEFDQUFKTWtCQ3djQVFYOGt5UUVMQndBZ0FDVDBBUXNIQUVGL0pQUUJDd1FBSXo4TEJBQWpRQXNFQUNOQkN3UUFJMElMQkFBalF3c0VBQ05FQ3dRQUkwVUxCQUFqUmdzRUFDTklDd1FBSTBjTEJnQWpTQkFCQ3dRQUkxWUxyd01CQ245QmdJQUNRWUNRQWlPNUFSc2hDVUdBdUFKQmdMQUNJN29CR3lFS0EwQWdCVUdBQWtnRVFFRUFJUVFEUUNBRVFZQUNTQVJBSUFrZ0JVRURkVUVGZENBS2FpQUVRUU4xYWlJRFFZQ1FmbW90QUFBUUxDRUlJQVZCQ0c4aEFVRUhJQVJCQ0c5cklRWkJBQ0VDQW44Z0FFRUFTaU02SWdjZ0J4c0VRQ0FEUVlEUWZtb3RBQUFoQWdzZ0FrSEFBSEVMQkVCQkJ5QUJheUVCQzBFQUlRY2dBVUVCZENBSWFpSURRWUNRZm1wQkFVRUFJQUpCQ0hFYklnZEJBWEZCRFhScUxRQUFJUWhCQUNFQklBTkJnWkIrYWlBSFFRRnhRUTEwYWkwQUFFRUJJQVowY1FSQVFRSWhBUXNnQVVFQmFpQUJRUUVnQm5RZ0NIRWJJUUVnQlVFSWRDQUVha0VEYkNFR0lBQkJBRW9qT2lJRElBTWJCRUFnQWtFSGNTQUJRUUFRTFNJQlFSOXhRUU4wSVFNZ0JrR0FvUXRxSWdJZ0F6b0FBQ0FDUVFGcUlBRkI0QWR4UVFWMVFRTjBPZ0FBSUFKQkFtb2dBVUdBK0FGeFFRcDFRUU4wT2dBQUJTQUJRY2YrQTBFQUVDNGhBa0VBSVFFRFFDQUJRUU5JQkVBZ0JrR0FvUXRxSUFGcUlBSTZBQUFnQVVFQmFpRUJEQUVMQ3dzZ0JFRUJhaUVFREFFTEN5QUZRUUZxSVFVTUFRc0xDOW9EQVF4L0EwQWdBMEVYVGtVRVFFRUFJUUlEUUNBQ1FSOUlCRUJCQVVFQUlBSkJEMG9iSVFrZ0EwRVBheUFESUFOQkQwb2JRUVIwSWdjZ0FrRVBhMm9nQWlBSGFpQUNRUTlLR3lFSFFZQ1FBa0dBZ0FJZ0EwRVBTaHNoQzBISC9nTWhDa0YvSVFGQmZ5RUlRUUFoQkFOQUlBUkJDRWdFUUVFQUlRQURRQ0FBUVFWSUJFQWdBRUVEZENBRWFrRUNkQ0lGUVlMOEEyb1FBU0FIUmdSQUlBVkJnL3dEYWhBQklRWkJBVUVBSUFaQkNIRkJBRWNqT2lNNkd4c2dDVVlFUUVFSUlRUkJCU0VBSUFZaUNFRVFjUVIvUWNuK0F3VkJ5UDREQ3lFS0N3c2dBRUVCYWlFQURBRUxDeUFFUVFGcUlRUU1BUXNMSUFoQkFFZ2pPaUlHSUFZYkJFQkJnTGdDUVlDd0FpTzZBUnNoQkVGL0lRQkJBQ0VCQTBBZ0FVRWdTQVJBUVFBaEJRTkFJQVZCSUVnRVFDQUZRUVYwSUFScUlBRnFJZ1pCZ0pCK2FpMEFBQ0FIUmdSQVFTQWhCU0FHSVFCQklDRUJDeUFGUVFGcUlRVU1BUXNMSUFGQkFXb2hBUXdCQ3dzZ0FFRUFUZ1IvSUFCQmdOQithaTBBQUFWQmZ3c2hBUXRCQUNFQUEwQWdBRUVJU0FSQUlBY2dDeUFKUVFCQkJ5QUFJQUpCQTNRZ0EwRURkQ0FBYWtINEFVR0FvUmNnQ2lBQklBZ1FMeG9nQUVFQmFpRUFEQUVMQ3lBQ1FRRnFJUUlNQVFzTElBTkJBV29oQXd3QkN3c0xtQUlCQ1g4RFFDQUVRUWhPUlFSQVFRQWhBUU5BSUFGQkJVZ0VRQ0FCUVFOMElBUnFRUUowSWdCQmdQd0RhaEFCR2lBQVFZSDhBMm9RQVJvZ0FFR0MvQU5xRUFFaEFrRUJJUVVqdXdFRVFDQUNRUUp2UVFGR0JFQWdBa0VCYXlFQ0MwRUNJUVVMSUFCQmcvd0RhaEFCSVFaQkFDRUhRUUZCQUNBR1FRaHhRUUJISXpvak9oc2JJUWRCeVA0RElRaEJ5ZjREUWNqK0F5QUdRUkJ4R3lFSVFRQWhBQU5BSUFBZ0JVZ0VRRUVBSVFNRFFDQURRUWhJQkVBZ0FDQUNha0dBZ0FJZ0IwRUFRUWNnQXlBRVFRTjBJQUZCQkhRZ0Eyb2dBRUVEZEdwQndBQkJnS0VnSUFoQmZ5QUdFQzhhSUFOQkFXb2hBd3dCQ3dzZ0FFRUJhaUVBREFFTEN5QUJRUUZxSVFFTUFRc0xJQVJCQVdvaEJBd0JDd3NMQlFBamhnRUxCUUFqaHdFTEJRQWppQUVMR0FFQmZ5T0tBU0VBSTRrQkJFQWdBRUVFY2lFQUN5QUFDekFCQVg4RFFBSkFJQUJCLy84RFRnMEFJQUJCZ0tISkJHb2dBQkJTT2dBQUlBQkJBV29oQUF3QkN3dEJBQ1RCQVFzVUFEOEFRWlFCU0FSQVFaUUJQd0JyUUFBYUN3c0RBQUVMSFFBQ1FBSkFBa0FqblFJT0FnRUNBQXNBQzBFQUlRQUxJQUFRclFFTEJ3QWdBQ1NkQWdzbEFBSkFBa0FDUUFKQUk1MENEZ01CQWdNQUN3QUxRUUVoQUF0QmZ5RUJDeUFCRUswQkN3QXpFSE52ZFhKalpVMWhjSEJwYm1kVlVrd2hZMjl5WlM5a2FYTjBMMk52Y21VdWRXNTBiM1ZqYUdWa0xuZGhjMjB1YldGdyIpOgphd2FpdCBOKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlRRVNZQXAvZjM5L2YzOS9mMzkvQUdBQUFHQUJmd0YvWUFKL2Z3QmdBWDhBWUFKL2Z3Ri9ZQUFCZjJBRGYzOS9BR0FHZjM5L2YzOS9BR0FIZjM5L2YzOS9md0YvWUFOL2YzOEJmMkFIZjM5L2YzOS9md0JnQkg5L2YzOEJmMkFJZjM5L2YzOS9mMzhBWUFWL2YzOS9md0YvWUExL2YzOS9mMzkvZjM5L2YzOS9BWDlnQUFCZ0FYOEJmd1BaQWRjQkFnSUJBUU1CQVFFQkFRRUJBUUVFQkFFQkFRQUdBUUVCQVFFQkFRRUVCQUVCQVFFQkFRRUJCZ1lHQmc0RkNnb1BDUXNJQ0FjSEF3UUJBUVFCQkFFQkFRRUJBZ0lGQWdJQ0FnVU1CQVFFQVFJR0FnSURCQVFFQkFFQkFRRUVCUVFHQmdRREFnVUVBUkFFQlFNSEFRVUJCQUVGQkFRR0JnTUZCQU1FQkFRREF3Y0NBZ0lFQWdJQ0FnSUNBZ01FQkFJRUJBSUVCQUlFQkFJQ0FnSUNBZ0lDQWdJQ0JRSUNBZ0lDQWdRR0JnWVJCZ0lHQmdZQ0F3UUVEUVFCQkFFRUFRWUdCZ1lHQmdZR0JnWUdCZ1FCQVFZR0JnWUJBUUVDQkFVRUJBRndBQUVGQXdFQUFBYXJESjRDZndCQkFBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUNBdC9BRUdBRUF0L0FFR0FnQUVMZndCQmdKQUJDMzhBUVlDQUFndC9BRUdBa0FNTGZ3QkJnSUFCQzM4QVFZQVFDMzhBUVlDQUJBdC9BRUdBa0FRTGZ3QkJnQUVMZndCQmdKRUVDMzhBUVlDNEFRdC9BRUdBeVFVTGZ3QkJnTmdGQzM4QVFZQ2hDd3QvQUVHQWdBd0xmd0JCZ0tFWEMzOEFRWUNBQ1F0L0FFR0FvU0FMZndCQmdQZ0FDMzhBUVlDUUJBdC9BRUdBaVIwTGZ3QkJnSmtoQzM4QVFZQ0FDQXQvQUVHQW1Ta0xmd0JCZ0lBSUMzOEFRWUNaTVF0L0FFR0FnQWdMZndCQmdKazVDMzhBUVlDQUNBdC9BRUdBbWNFQUMzOEFRWUNBQ0F0L0FFR0FtY2tBQzM4QVFZQ0FDQXQvQUVHQW1kRUFDMzhBUVlDSStBTUxmd0JCZ0tISkJBdC9BRUgvL3dNTGZ3QkJBQXQvQUVHQW9jMEVDMzhBUVpRQkMzOEJRUUFMZndGQkFBdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSFAvZ01MZndGQkFBdC9BVUh3L2dNTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVQQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkIvd0FMZndGQi93QUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJnS2pXdVFjTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmdQY0NDMzhCUVlDQUNBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkIxZjREQzM4QlFkSCtBd3QvQVVIUy9nTUxmd0ZCMC80REMzOEJRZFQrQXd0L0FVSG8vZ01MZndGQjYvNERDMzhCUWVuK0F3dC9BVUYvQzM4QlFRQUxmd0ZCQVF0L0FVRUNDMzhBUVlDaHpRUUxmd0JCZ0FnTGZ3QkJnQWdMZndCQmdCQUxmd0JCZ0lBRUMzOEFRWUNRQkF0L0FFR0FrQVFMZndCQmdBRUxmd0JCZ01rRkMzOEFRWUNoQ3d0L0FFR0FvUmNMZndCQmdKbkJBQXQvQUVHQW1ja0FDMzhBUVlDWjBRQUxmd0ZCQUFzSHFoTndCbTFsYlc5eWVRSUFCWFJoWW14bEFRQUdZMjl1Wm1sbkFCTU9hR0Z6UTI5eVpWTjBZWEowWldRQUZBbHpZWFpsVTNSaGRHVUFHd2xzYjJGa1UzUmhkR1VBSmdWcGMwZENRd0FuRW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFBb0MyZGxkRk4wWlhCVFpYUnpBQ2tJWjJWMFUzUmxjSE1BS2hWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUFyd0VNWlhobFkzVjBaVVp5WVcxbEFLNEJDRjl6WlhSaGNtZGpBTlVCR1dWNFpXTjFkR1ZHY21GdFpVRnVaRU5vWldOclFYVmthVzhBMUFFVlpYaGxZM1YwWlZWdWRHbHNRMjl1WkdsMGFXOXVBTllCQzJWNFpXTjFkR1ZUZEdWd0FLc0JGR2RsZEVONVkyeGxjMUJsY2tONVkyeGxVMlYwQUxBQkRHZGxkRU41WTJ4bFUyVjBjd0N4QVFsblpYUkRlV05zWlhNQXNnRU9jMlYwU205NWNHRmtVM1JoZEdVQXR3RWZaMlYwVG5WdFltVnlUMlpUWVcxd2JHVnpTVzVCZFdScGIwSjFabVpsY2dDc0FSQmpiR1ZoY2tGMVpHbHZRblZtWm1WeUFDSVhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0REtoTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeXNTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXl3ZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd0FhUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQVJaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd0lTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdNZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQ2h4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3c1NWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd1FPVmtsRVJVOWZVa0ZOWDFOSldrVURCUkZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01HRFZkUFVrdGZVa0ZOWDFOSldrVURCeVpQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNSUlrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVRENSaEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0REdCUkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1aRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F3d1FSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTU5HRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTU9GRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXc4T1JsSkJUVVZmVEU5RFFWUkpUMDRERUFwR1VrRk5SVjlUU1ZwRkF4RVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REVoTkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeE1TVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhRT1ZFbE1SVjlFUVZSQlgxTkpXa1VERlJKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REZnNVBRVTFmVkVsTVJWTmZVMGxhUlFNWEZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01pRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXlNWlEwaEJUazVGVEY4eFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNYUZVTklRVTVPUlV4Zk1WOUNWVVpHUlZKZlUwbGFSUU1iR1VOSVFVNU9SVXhmTWw5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESEJWRFNFRk9Ua1ZNWHpKZlFsVkdSa1ZTWDFOSldrVURIUmxEU0VGT1RrVk1Yek5mUWxWR1JrVlNYMHhQUTBGVVNVOU9BeDRWUTBoQlRrNUZURjh6WDBKVlJrWkZVbDlUU1ZwRkF4OFpRMGhCVGs1RlRGODBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWdGVU5JUVU1T1JVeGZORjlDVlVaR1JWSmZVMGxhUlFNaEZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRESkJKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVREpSWkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXlZU1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5Y2RSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRES0JsRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOVRTVnBGQXlraFoyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQUFBYmMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFMZ0JIWEpsYzJWMFVISnZaM0poYlVOdmRXNTBaWEpDY21WaGEzQnZhVzUwQUxrQkdYTmxkRkpsWVdSSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQXVnRWJjbVZ6WlhSU1pXRmtSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBTHNCR25ObGRGZHlhWFJsUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUx3QkhISmxjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUF2UUVNWjJWMFVtVm5hWE4wWlhKQkFMNEJER2RsZEZKbFoybHpkR1Z5UWdDL0FReG5aWFJTWldkcGMzUmxja01Bd0FFTVoyVjBVbVZuYVhOMFpYSkVBTUVCREdkbGRGSmxaMmx6ZEdWeVJRRENBUXhuWlhSU1pXZHBjM1JsY2tnQXd3RU1aMlYwVW1WbmFYTjBaWEpNQU1RQkRHZGxkRkpsWjJsemRHVnlSZ0RGQVJGblpYUlFjbTluY21GdFEyOTFiblJsY2dER0FROW5aWFJUZEdGamExQnZhVzUwWlhJQXh3RVpaMlYwVDNCamIyUmxRWFJRY205bmNtRnRRMjkxYm5SbGNnRElBUVZuWlhSTVdRREpBUjFrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZVFES0FSaGtjbUYzVkdsc1pVUmhkR0ZVYjFkaGMyMU5aVzF2Y25rQXl3RVRaSEpoZDA5aGJWUnZWMkZ6YlUxbGJXOXllUURNQVFablpYUkVTVllBelFFSFoyVjBWRWxOUVFET0FRWm5aWFJVVFVFQXp3RUdaMlYwVkVGREFOQUJFM1Z3WkdGMFpVUmxZblZuUjBKTlpXMXZjbmtBMFFFR2RYQmtZWFJsQUs0QkRXVnRkV3hoZEdsdmJsTjBaWEFBcXdFU1oyVjBRWFZrYVc5UmRXVjFaVWx1WkdWNEFLd0JEM0psYzJWMFFYVmthVzlSZFdWMVpRQWlEbmRoYzIxTlpXMXZjbmxUYVhwbEE0OENISGRoYzIxQ2IzbEpiblJsY201aGJGTjBZWFJsVEc5allYUnBiMjREa0FJWWQyRnpiVUp2ZVVsdWRHVnlibUZzVTNSaGRHVlRhWHBsQTVFQ0hXZGhiV1ZDYjNsSmJuUmxjbTVoYkUxbGJXOXllVXh2WTJGMGFXOXVBNUlDR1dkaGJXVkNiM2xKYm5SbGNtNWhiRTFsYlc5eWVWTnBlbVVEa3dJVGRtbGtaVzlQZFhSd2RYUk1iMk5oZEdsdmJnT1VBaUptY21GdFpVbHVVSEp2WjNKbGMzTldhV1JsYjA5MWRIQjFkRXh2WTJGMGFXOXVBNWNDRzJkaGJXVmliM2xEYjJ4dmNsQmhiR1YwZEdWTWIyTmhkR2x2YmdPVkFoZG5ZVzFsWW05NVEyOXNiM0pRWVd4bGRIUmxVMmw2WlFPV0FoVmlZV05yWjNKdmRXNWtUV0Z3VEc5allYUnBiMjREbUFJTGRHbHNaVVJoZEdGTllYQURtUUlUYzI5MWJtUlBkWFJ3ZFhSTWIyTmhkR2x2YmdPYUFoRm5ZVzFsUW5sMFpYTk1iMk5oZEdsdmJnT2NBaFJuWVcxbFVtRnRRbUZ1YTNOTWIyTmhkR2x2YmdPYkFnZ0MwZ0VKQ0FFQVFRQUxBZE1CQ3FUYkFkY0J6d0VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVF4MUlnRkZEUUFDUUNBQlFRRnJEZzBCQVFFQ0FnSUNBd01FQkFVR0FBc01CZ3NnQUVHQW1kRUFhZzhMSUFCQkFTTTRJZ0FqT1VVaUFRUi9JQUJGQlNBQkN4dEJEblJxUVlDWjBBQnFEd3NnQUVHQWtINXFJem9FZnlNN0VBRkJBWEVGUVFBTFFRMTBhZzhMSUFBalBFRU5kR3BCZ05uR0FHb1BDeUFBUVlDUWZtb1BDMEVBSVFFQ2Z5TTZCRUFqUFJBQlFRZHhJUUVMSUFGQkFVZ0xCRUJCQVNFQkN5QUJRUXgwSUFCcVFZRHdmV29QQ3lBQVFZQlFhZ3NKQUNBQUVBQXRBQUFMbVFFQVFRQWtQa0VBSkQ5QkFDUkFRUUFrUVVFQUpFSkJBQ1JEUVFBa1JFRUFKRVZCQUNSR1FRQWtSMEVBSkVoQkFDUkpRUUFrU2tFQUpFdEJBQ1JNUVFBa1RTTTZCRUJCRVNRL1FZQUJKRVpCQUNSQVFRQWtRVUgvQVNSQ1FkWUFKRU5CQUNSRVFRMGtSUVZCQVNRL1FiQUJKRVpCQUNSQVFSTWtRVUVBSkVKQjJBRWtRMEVCSkVSQnpRQWtSUXRCZ0FJa1NFSCsvd01rUnd1a0FRRUNmMEVBSkU1QkFTUlBRY2NDRUFFaEFVRUFKRkJCQUNSUlFRQWtVa0VBSkZOQkFDUTVJQUVFUUNBQlFRRk9JZ0FFUUNBQlFRTk1JUUFMSUFBRVFFRUJKRkVGSUFGQkJVNGlBQVJBSUFGQkJrd2hBQXNnQUFSQVFRRWtVZ1VnQVVFUFRpSUFCRUFnQVVFVFRDRUFDeUFBQkVCQkFTUlRCU0FCUVJsT0lnQUVRQ0FCUVI1TUlRQUxJQUFFUUVFQkpEa0xDd3NMQlVFQkpGQUxRUUVrT0VFQUpEd0xDd0FnQUJBQUlBRTZBQUFMTHdCQjBmNERRZjhCRUFSQjB2NERRZjhCRUFSQjAvNERRZjhCRUFSQjFQNERRZjhCRUFSQjFmNERRZjhCRUFRTG1BRUFRUUFrVkVFQUpGVkJBQ1JXUVFBa1YwRUFKRmhCQUNSWlFRQWtXaU02QkVCQmtBRWtWa0hBL2dOQmtRRVFCRUhCL2dOQmdRRVFCRUhFL2dOQmtBRVFCRUhIL2dOQi9BRVFCQVZCa0FFa1ZrSEEvZ05Ca1FFUUJFSEIvZ05CaFFFUUJFSEcvZ05CL3dFUUJFSEgvZ05CL0FFUUJFSEkvZ05CL3dFUUJFSEovZ05CL3dFUUJBdEJ6LzREUVFBUUJFSHcvZ05CQVJBRUMwOEFJem9FUUVIby9nTkJ3QUVRQkVIcC9nTkIvd0VRQkVIcS9nTkJ3UUVRQkVIci9nTkJEUkFFQlVIby9nTkIvd0VRQkVIcC9nTkIvd0VRQkVIcS9nTkIvd0VRQkVIci9nTkIvd0VRQkFzTEx3QkJrUDREUVlBQkVBUkJrZjREUWI4QkVBUkJrdjREUWZNQkVBUkJrLzREUWNFQkVBUkJsUDREUWI4QkVBUUxMQUJCbGY0RFFmOEJFQVJCbHY0RFFUOFFCRUdYL2dOQkFCQUVRWmorQTBFQUVBUkJtZjREUWJnQkVBUUxNZ0JCbXY0RFFmOEFFQVJCbS80RFFmOEJFQVJCblA0RFFaOEJFQVJCbmY0RFFRQVFCRUdlL2dOQnVBRVFCRUVCSkdzTExRQkJuLzREUWY4QkVBUkJvUDREUWY4QkVBUkJvZjREUVFBUUJFR2kvZ05CQUJBRVFhUCtBMEcvQVJBRUN6Z0FRUThrYkVFUEpHMUJEeVJ1UVE4a2IwRUFKSEJCQUNSeFFRQWtja0VBSkhOQi93QWtkRUgvQUNSMVFRRWtka0VCSkhkQkFDUjRDMmNBUVFBa1cwRUFKRnhCQUNSZFFRRWtYa0VCSkY5QkFTUmdRUUVrWVVFQkpHSkJBU1JqUVFFa1pFRUJKR1ZCQVNSbVFRQWtaMEVBSkdoQkFDUnBRUUFrYWhBSUVBa1FDaEFMUWFUK0EwSDNBQkFFUWFYK0EwSHpBUkFFUWFiK0EwSHhBUkFFRUF3TE9BQWdBRUVCY1VFQVJ5UjVJQUJCQW5GQkFFY2tlaUFBUVFSeFFRQkhKSHNnQUVFSWNVRUFSeVI4SUFCQkVIRkJBRWNrZlNBQUpINExQUUFnQUVFQmNVRUFSeVIvSUFCQkFuRkJBRWNrZ0FFZ0FFRUVjVUVBUnlTQkFTQUFRUWh4UVFCSEpJSUJJQUJCRUhGQkFFY2tnd0VnQUNTRUFRdGRBRUVBSklVQlFRQWtoZ0ZCQUNTSEFVRUFKSWdCUVFBa2lRRkJBQ1NLQVVFQUpJc0JRUUFrakFFak9nUkFRWVQrQTBFZUVBUkJvRDBraGdFRlFZVCtBMEdyQVJBRVFjelhBaVNHQVF0QmgvNERRZmdCRUFSQitBRWtpZ0VMUWdCQkFDU05BVUVBSkk0Qkl6b0VRRUdDL2dOQi9BQVFCRUVBSkk4QlFRQWtrQUZCQUNTUkFRVkJndjREUWY0QUVBUkJBQ1NQQVVFQkpKQUJRUUFra1FFTEMvWUJBUUovUWNNQ0VBRWlBVUhBQVVZaUFBUi9JQUFGSUFGQmdBRkdJeThpQUNBQUd3c0VRRUVCSkRvRlFRQWtPZ3NRQWhBREVBVVFCaEFIRUExQkFCQU9RZi8vQXlOK0VBUkI0UUVRRDBHUC9nTWpoQUVRQkJBUUVCRWpPZ1JBUWZEK0EwSDRBUkFFUWMvK0EwSCtBUkFFUWMzK0EwSCtBQkFFUVlEK0EwSFBBUkFFUVkvK0EwSGhBUkFFUWV6K0EwSCtBUkFFUWZYK0EwR1BBUkFFQlVIdy9nTkIvd0VRQkVIUC9nTkIvd0VRQkVITi9nTkIvd0VRQkVHQS9nTkJ6d0VRQkVHUC9nTkI0UUVRQkF0QkFDUXRRWUNvMXJrSEpKSUJRUUFra3dGQkFDU1VBVUdBcU5hNUJ5U1ZBVUVBSkpZQlFRQWtsd0VMcmdFQUlBQkJBRW9FUUVFQkpDNEZRUUFrTGdzZ0FVRUFTZ1JBUVFFa0x3VkJBQ1F2Q3lBQ1FRQktCRUJCQVNRd0JVRUFKREFMSUFOQkFFb0VRRUVCSkRFRlFRQWtNUXNnQkVFQVNnUkFRUUVrTWdWQkFDUXlDeUFGUVFCS0JFQkJBU1F6QlVFQUpETUxJQVpCQUVvRVFFRUJKRFFGUVFBa05Bc2dCMEVBU2dSQVFRRWtOUVZCQUNRMUN5QUlRUUJLQkVCQkFTUTJCVUVBSkRZTElBbEJBRW9FUUVFQkpEY0ZRUUFrTndzUUVnc01BQ010QkVCQkFROExRUUFMc2dFQVFZQUlJejg2QUFCQmdRZ2pRRG9BQUVHQ0NDTkJPZ0FBUVlNSUkwSTZBQUJCaEFnalF6b0FBRUdGQ0NORU9nQUFRWVlJSTBVNkFBQkJod2dqUmpvQUFFR0lDQ05IT3dFQVFZb0lJMGc3QVFCQmpBZ2pTVFlDQUNOS0JFQkJrUWhCQVRvQUFBVkJrUWhCQURvQUFBc2pTd1JBUVpJSVFRRTZBQUFGUVpJSVFRQTZBQUFMSTB3RVFFR1RDRUVCT2dBQUJVR1RDRUVBT2dBQUN5Tk5CRUJCbEFoQkFUb0FBQVZCbEFoQkFEb0FBQXNMckFFQVFjZ0pJemc3QVFCQnlna2pQRHNCQUNOT0JFQkJ6QWxCQVRvQUFBVkJ6QWxCQURvQUFBc2pUd1JBUWMwSlFRRTZBQUFGUWMwSlFRQTZBQUFMSTFBRVFFSE9DVUVCT2dBQUJVSE9DVUVBT2dBQUN5TlJCRUJCendsQkFUb0FBQVZCendsQkFEb0FBQXNqVWdSQVFkQUpRUUU2QUFBRlFkQUpRUUE2QUFBTEkxTUVRRUhSQ1VFQk9nQUFCVUhSQ1VFQU9nQUFDeU01QkVCQjBnbEJBVG9BQUFWQjBnbEJBRG9BQUFzTFN3QkIrZ2tqaFFFMkFnQkIvZ2tqaGdFMkFnQWppd0VFUUVHQ0NrRUJPZ0FBQlVHQ0NrRUFPZ0FBQ3lPTUFRUkFRWVVLUVFFNkFBQUZRWVVLUVFBNkFBQUxRWVgrQXlPSEFSQUVDM2dBSTVzQkJFQkIzZ3BCQVRvQUFBVkIzZ3BCQURvQUFBdEIzd29qbkFFMkFnQkI0d29qblFFMkFnQkI1d29qbmdFMkFnQkI3QW9qbndFMkFnQkI4UW9qb0FFNkFBQkI4Z29qb1FFNkFBQWpvZ0VFUUVIM0NrRUJPZ0FBQlVIM0NrRUFPZ0FBQzBINENpT2pBVFlDQUVIOUNpT2tBVHNCQUF0UEFDT2xBUVJBUVpBTFFRRTZBQUFGUVpBTFFRQTZBQUFMUVpFTEk2WUJOZ0lBUVpVTEk2Y0JOZ0lBUVprTEk2Z0JOZ0lBUVo0TEk2a0JOZ0lBUWFNTEk2b0JPZ0FBUWFRTEk2c0JPZ0FBQzBZQUk3QUJCRUJCOUF0QkFUb0FBQVZCOUF0QkFEb0FBQXRCOVFzanNRRTJBZ0JCK1FzanNnRTJBZ0JCL1FzanN3RTJBZ0JCZ2d3anRBRTJBZ0JCaHd3anRRRTdBUUFMb3dFQUVCVkJzZ2dqVlRZQ0FFRzJDQ09ZQVRvQUFFSEUvZ01qVmhBRUk1a0JCRUJCNUFoQkFUb0FBQVZCNUFoQkFEb0FBQXNqbWdFRVFFSGxDRUVCT2dBQUJVSGxDRUVBT2dBQUN4QVdFQmRCckFvalp6WUNBRUd3Q2lOb09nQUFRYkVLSTJrNkFBQVFHQkFaSTZ3QkJFQkJ3Z3RCQVRvQUFBVkJ3Z3RCQURvQUFBdEJ3d3NqclFFMkFnQkJ4d3NqcmdFMkFnQkJ5d3NqcndFN0FRQVFHa0VBSkMwTHJnRUFRWUFJTFFBQUpEOUJnUWd0QUFBa1FFR0NDQzBBQUNSQlFZTUlMUUFBSkVKQmhBZ3RBQUFrUTBHRkNDMEFBQ1JFUVlZSUxRQUFKRVZCaHdndEFBQWtSa0dJQ0M4QkFDUkhRWW9JTHdFQUpFaEJqQWdvQWdBa1NRSi9RUUZCa1FndEFBQkJBRW9OQUJwQkFBc2tTZ0ovUVFGQmtnZ3RBQUJCQUVvTkFCcEJBQXNrU3dKL1FRRkJrd2d0QUFCQkFFb05BQnBCQUFza1RBSi9RUUZCbEFndEFBQkJBRW9OQUJwQkFBc2tUUXRjQVFGL1FRQWtWVUVBSkZaQnhQNERRUUFRQkVIQi9nTVFBVUY4Y1NFQlFRQWttQUZCd2Y0RElBRVFCQ0FBQkVBQ1FFRUFJUUFEUUNBQVFZQ0pIVTROQVNBQVFZQ1FCR3BCL3dFNkFBQWdBRUVCYWlFQURBQUFDd0FMQ3d1SUFRRUJmeU8yQVNFQklBQkJnQUZ4UVFCSEpMWUJJQUJCd0FCeFFRQkhKTGNCSUFCQklIRkJBRWNrdUFFZ0FFRVFjVUVBUnlTNUFTQUFRUWh4UVFCSEpMb0JJQUJCQkhGQkFFY2t1d0VnQUVFQ2NVRUFSeVM4QVNBQVFRRnhRUUJISkwwQkk3WUJSU0FCSUFFYkJFQkJBUkFkQ3lBQlJTSUFCSDhqdGdFRklBQUxCRUJCQUJBZEN3cytBQUovUVFGQjVBZ3RBQUJCQUVvTkFCcEJBQXNrbVFFQ2YwRUJRZVVJTFFBQVFRQktEUUFhUVFBTEpKb0JRZi8vQXhBQkVBNUJqLzRERUFFUUR3dWxBUUJCeUFrdkFRQWtPRUhLQ1M4QkFDUThBbjlCQVVITUNTMEFBRUVBU2cwQUdrRUFDeVJPQW45QkFVSE5DUzBBQUVFQVNnMEFHa0VBQ3lSUEFuOUJBVUhPQ1MwQUFFRUFTZzBBR2tFQUN5UlFBbjlCQVVIUENTMEFBRUVBU2cwQUdrRUFDeVJSQW45QkFVSFFDUzBBQUVFQVNnMEFHa0VBQ3lSU0FuOUJBVUhSQ1MwQUFFRUFTZzBBR2tFQUN5UlRBbjlCQVVIU0NTMEFBRUVBU2cwQUdrRUFDeVE1QzFzQVFmb0pLQUlBSklVQlFmNEpLQUlBSklZQkFuOUJBVUdDQ2kwQUFFRUFTZzBBR2tFQUN5U0xBUUovUVFGQmhRb3RBQUJCQUVvTkFCcEJBQXNrakFGQmhmNERFQUVraHdGQmh2NERFQUVraUFGQmgvNERFQUVraWdFTEJnQkJBQ1JxQzNZQUFuOUJBVUhlQ2kwQUFFRUFTZzBBR2tFQUN5U2JBVUhmQ2lnQ0FDU2NBVUhqQ2lnQ0FDU2RBVUhuQ2lnQ0FDU2VBVUhzQ2lnQ0FDU2ZBVUh4Q2kwQUFDU2dBVUh5Q2kwQUFDU2hBUUovUVFGQjl3b3RBQUJCQUVvTkFCcEJBQXNrb2dGQitBb29BZ0Frb3dGQi9Rb3ZBUUFrcEFFTFRnQUNmMEVCUVpBTExRQUFRUUJLRFFBYVFRQUxKS1VCUVpFTEtBSUFKS1lCUVpVTEtBSUFKS2NCUVprTEtBSUFKS2dCUVo0TEtBSUFKS2tCUWFNTExRQUFKS29CUWFRTExRQUFKS3NCQzBVQUFuOUJBVUgwQ3kwQUFFRUFTZzBBR2tFQUN5U3dBVUgxQ3lnQ0FDU3hBVUg1Q3lnQ0FDU3lBVUg5Q3lnQ0FDU3pBVUdDRENnQ0FDUzBBVUdIREM4QkFDUzFBUXZRQVFFQmZ4QWNRYklJS0FJQUpGVkJ0Z2d0QUFBa21BRkJ4UDRERUFFa1ZrSEEvZ01RQVJBZUVCOUJnUDRERUFGQi93RnpKTDRCSTc0QklnQkJFSEZCQUVja3Z3RWdBRUVnY1VFQVJ5VEFBUkFnRUNGQnJBb29BZ0FrWjBHd0NpMEFBQ1JvUWJFS0xRQUFKR2xCQUNScUVDTVFKQUovUVFGQndnc3RBQUJCQUVvTkFCcEJBQXNrckFGQnd3c29BZ0FrclFGQnh3c29BZ0FrcmdGQnl3c3ZBUUFrcndFUUpVRUFKQzFCZ0tqV3VRY2trZ0ZCQUNTVEFVRUFKSlFCUVlDbzFya0hKSlVCUVFBa2xnRkJBQ1NYQVFzTUFDTTZCRUJCQVE4TFFRQUxCUUFqbFFFTEJRQWpsZ0VMQlFBamx3RUwyQUlCQlg4Q2Z3Si9JQUZCQUVvaUJRUkFJQUJCQ0VvaEJRc2dCUXNFUUNQREFTQUVSaUVGQ3lBRkN3Ui9JOFFCSUFCR0JTQUZDd1JBUVFBaEJVRUFJUVFnQTBFQmF4QUJRU0J4QkVCQkFTRUZDeUFERUFGQklIRUVRRUVCSVFRTFFRQWhBd05BSUFOQkNFZ0VRRUVISUFOcklBTWdCQ0FGUnhzaUF5QUFha0dnQVV3RVFDQUFRUWdnQTJ0cklRY2dBQ0FEYWlBQlFhQUJiR3BCQTJ4QmdNa0ZhaUVKUVFBaEJnTkFJQVpCQTBnRVFDQUFJQU5xSUFGQm9BRnNha0VEYkVHQXlRVnFJQVpxSUFZZ0NXb3RBQUE2QUFBZ0JrRUJhaUVHREFFTEN5QUFJQU5xSUFGQm9BRnNha0dBa1FScUlBRkJvQUZzSUFkcVFZQ1JCR290QUFBaUJrRURjU0lIUVFSeUlBY2dCa0VFY1JzNkFBQWdDRUVCYWlFSUN5QURRUUZxSVFNTUFRc0xCU0FFSk1NQkN5QUFJOFFCVGdSQUlBQkJDR29reEFFZ0FDQUNRUWh2SWdSSUJFQWp4QUVnQkdva3hBRUxDeUFJQ3pnQkFYOGdBRUdBa0FKR0JFQWdBVUdBQVdvaEFpQUJRWUFCY1FSQUlBRkJnQUZySVFJTElBSkJCSFFnQUdvUEN5QUJRUVIwSUFCcUMwb0FJQUJCQTNRZ0FVRUJkR29pQUVFQmFrRS9jU0lCUVVCcklBRWdBaHRCZ0pBRWFpMEFBQ0VCSUFCQlAzRWlBRUZBYXlBQUlBSWJRWUNRQkdvdEFBQWdBVUgvQVhGQkNIUnlDMUVBSUFKRkJFQWdBUkFCSUFCQkFYUjFRUU54SVFBTFFmSUJJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXd0Qm9BRWhBUXdDQzBIWUFDRUJEQUVMUVFnaEFRc2dBUXVMQXdFR2Z5QUJJQUFRTENBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnNGdDRWdFUUVFSElBQnJJUVVnQzBFQVNDSUNCSDhnQWdVZ0MwRWdjVVVMSVFGQkFDRUNBbjlCQVNBRklBQWdBUnNpQVhRZ0VuRUVRRUVDSVFJTElBSkJBV29MSUFKQkFTQUJkQ0FSY1JzaEFpTTZCSDhnQzBFQVRpSUJCSDhnQVFVZ0RFRUFUZ3NGSXpvTEJIOGdDMEVIY1NFRklBeEJBRTRpQVFSQUlBeEJCM0VoQlFzZ0JTQUNJQUVRTFNJRlFSOXhRUU4wSVE4Z0JVSGdCM0ZCQlhWQkEzUWhBU0FGUVlENEFYRkJDblZCQTNRRklBSkJ4LzRESUFvZ0NrRUFUQnNpQ2tFQUVDNGlCU0VQSUFVaUFRc2hCU0FISUFoc0lBNXFRUU5zSUFscUloQWdEem9BQUNBUVFRRnFJQUU2QUFBZ0VFRUNhaUFGT2dBQUlBZEJvQUZzSUE1cVFZQ1JCR29nQWtFRGNTSUJRUVJ5SUFFZ0MwR0FBWEZCQUVkQkFDQUxRUUJPR3hzNkFBQWdEVUVCYWlFTkN5QUFRUUZxSVFBTUFRc0xJQTBMZ0FFQkEzOGdBMEVJYnlFRElBQkZCRUFnQWlBQ1FRaHRRUU4wYXlFSEMwR2dBU0FBYTBFSElBQkJDR3BCb0FGS0d5RUpRWDhoQWlNNkJFQWdCRUdBMEg1cUxRQUFJZ0pCQ0hFRVFFRUJJUWdMSUFKQndBQnhCRUJCQnlBRGF5RURDd3NnQmlBRklBZ2dCeUFKSUFNZ0FDQUJRYUFCUVlESkJVRUFJQUpCZnhBdkM2WUNBQ0FGSUFZUUxDRUdJQU5CQ0c4aEF5QUVRWURRZm1vdEFBQWlCRUhBQUhFRWYwRUhJQU5yQlNBREMwRUJkQ0FHYWlJRFFZQ1FmbXBCQVVFQUlBUkJDSEViUVFGeFFRMTBJZ1ZxTFFBQUlRWWdBMEdCa0g1cUlBVnFMUUFBSVFVZ0FrRUlieUVEUVFBaEFpQUJRYUFCYkNBQWFrRURiRUdBeVFWcUlBUkJCM0VDZjBFQklBTkJCeUFEYXlBRVFTQnhHeUlEZENBRmNRUkFRUUloQWdzZ0FrRUJhZ3NnQWtFQklBTjBJQVp4R3lJQ1FRQVFMU0lEUVI5eFFRTjBPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZSEpCV29nQTBIZ0IzRkJCWFZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQURRWUQ0QVhGQkNuVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQmdKRUVhaUFDUVFOeElnQkJCSElnQUNBRVFZQUJjUnM2QUFBTHRRRUFJQVFnQlJBc0lBTkJDRzlCQVhScUlnUkJnSkIrYWkwQUFDRUZRUUFoQXlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxQW44Z0JFR0JrSDVxTFFBQVFRRkJCeUFDUVFodmF5SUNkSEVFUUVFQ0lRTUxJQU5CQVdvTElBTkJBU0FDZENBRmNSc2lBMEhIL2dOQkFCQXVJZ0k2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ09nQUFJQUZCb0FGc0lBQnFRUU5zUVlMSkJXb2dBam9BQUNBQlFhQUJiQ0FBYWtHQWtRUnFJQU5CQTNFNkFBQUwxUUVCQm44Z0EwRURkU0VMQTBBZ0JFR2dBVWdFUUNBRUlBVnFJZ1pCZ0FKT0JFQWdCa0dBQW1zaEJnc2dDMEVGZENBQ2FpQUdRUU4xYWlJSlFZQ1FmbW90QUFBaENFRUFJUW9qTmdSQUlBUWdBQ0FHSUFrZ0NCQXJJZ2RCQUVvRVFFRUJJUW9nQjBFQmF5QUVhaUVFQ3dzZ0NrVWpOU0lISUFjYkJFQWdCQ0FBSUFZZ0F5QUpJQUVnQ0JBd0lnZEJBRW9FUUNBSFFRRnJJQVJxSVFRTEJTQUtSUVJBSXpvRVFDQUVJQUFnQmlBRElBa2dBU0FJRURFRklBUWdBQ0FHSUFNZ0FTQUlFRElMQ3dzZ0JFRUJhaUVFREFFTEN3c3JBUUYvSTFjaEF5QUFJQUVnQWlOWUlBQnFJZ0JCZ0FKT0JIOGdBRUdBQW1zRklBQUxRUUFnQXhBekN6QUJBMzhqV1NFRElBQWpXaUlFU0FSQUR3c2dBMEVIYXlJRFFYOXNJUVVnQUNBQklBSWdBQ0FFYXlBRElBVVFNd3ZFQlFFUGZ3SkFRU2NoQ1FOQUlBbEJBRWdOQVNBSlFRSjBJZ1JCZ1B3RGFoQUJJUUlnQkVHQi9BTnFFQUVoQ2lBRVFZTDhBMm9RQVNFRElBSkJFR3NoQWlBS1FRaHJJUXBCQ0NFRklBRUVRRUVRSVFVZ0EwRUNiMEVCUmdSL0lBTkJBV3NGSUFNTElRTUxJQUFnQWs0aUJnUkFJQUFnQWlBRmFrZ2hCZ3NnQmdSQUlBUkJnL3dEYWhBQklnWkJnQUZ4UVFCSElRc2dCa0VnY1VFQVJ5RU9RWUNBQWlBREVDd2dBQ0FDYXlJQ0lBVnJRWDlzUVFGcklBSWdCa0hBQUhFYlFRRjBhaUlEUVlDUWZtcEJBVUVBSUFaQkNIRkJBRWNqT2lJQ0lBSWJHMEVCY1VFTmRDSUNhaTBBQUNFUElBTkJnWkIrYWlBQ2FpMEFBQ0VRUVFjaEJRTkFJQVZCQUU0RVFFRUFJUWdDZjBFQklBVWlBa0VIYTBGL2JDQUNJQTRiSWdKMElCQnhCRUJCQWlFSUN5QUlRUUZxQ3lBSVFRRWdBblFnRDNFYklnZ0VRRUVISUFWcklBcHFJZ2RCQUU0aUFnUkFJQWRCb0FGTUlRSUxJQUlFUUVFQUlReEJBQ0VOUVFGQkFDTzlBVVVqT2lJRElBTWJHeUlDUlFSQUlBQkJvQUZzSUFkcVFZQ1JCR290QUFBaUEwRURjU0lFUVFCS0lBc2dDeHNFUUVFQklRd0ZJQU5CQkhGQkFFY2pPaUlESUFNYklnTUVRQ0FFUVFCS0lRTUxRUUZCQUNBREd5RU5Dd3NnQWtVRVFDQU1SU0lFQkg4Z0RVVUZJQVFMSVFJTElBSUVRQ002QkVBZ0FFR2dBV3dnQjJwQkEyeEJnTWtGYWlBR1FRZHhJQWhCQVJBdElnUkJIM0ZCQTNRNkFBQWdBRUdnQVd3Z0IycEJBMnhCZ2NrRmFpQUVRZUFIY1VFRmRVRURkRG9BQUNBQVFhQUJiQ0FIYWtFRGJFR0N5UVZxSUFSQmdQZ0JjVUVLZFVFRGREb0FBQVVnQUVHZ0FXd2dCMnBCQTJ4QmdNa0ZhaUFJUWNuK0EwSEkvZ01nQmtFUWNSdEJBQkF1SWdNNkFBQWdBRUdnQVd3Z0IycEJBMnhCZ2NrRmFpQURPZ0FBSUFCQm9BRnNJQWRxUVFOc1FZTEpCV29nQXpvQUFBc0xDd3NnQlVFQmF5RUZEQUVMQ3dzZ0NVRUJheUVKREFBQUN3QUxDMllCQW45QmdKQUNJUUZCZ0lBQ1FZQ1FBaU81QVJzaEFTTTZJNzBCSXpvYkJFQkJnTEFDSVFJZ0FDQUJRWUM0QWtHQXNBSWp1Z0ViRURRTEk3Z0JCRUJCZ0xBQ0lRSWdBQ0FCUVlDNEFrR0FzQUlqdHdFYkVEVUxJN3dCQkVBZ0FDTzdBUkEyQ3dzbEFRRi9Ba0FEUUNBQVFaQUJTdzBCSUFCQi93RnhFRGNnQUVFQmFpRUFEQUFBQ3dBTEMwWUJBbjhEUUNBQlFaQUJUa1VFUUVFQUlRQURRQ0FBUWFBQlNBUkFJQUZCb0FGc0lBQnFRWUNSQkdwQkFEb0FBQ0FBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3dzTEhRRUJmMEdQL2dNUUFVRUJJQUIwY2lJQkpJUUJRWS8rQXlBQkVBUUxDd0JCQVNTQUFVRUJFRG9MUlFFQ2YwR1UvZ01RQVVINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBRVFaVCtBeUFCSUFCQkNIVWlBSElRQkNBQ0pORUJJQUFrMGdFajBRRWowZ0ZCQ0hSeUpOTUJDMllCQW44anBBRWlBU1BQQVhVaEFDQUJJQUJySUFBZ0FXb2owQUViSWdCQi93OU1JZ0VFZnlQUEFVRUFTZ1VnQVFzRVFDQUFKS1FCSUFBUVBDT2tBU0lCSTg4QmRTRUFJQUVnQUdzZ0FDQUJhaVBRQVJzaEFBc2dBRUgvRDBvRVFFRUFKSnNCQ3dzc0FDT2pBVUVCYXlTakFTT2pBVUVBVEFSQUk4NEJKS01CSTg0QlFRQktJNklCSTZJQkd3UkFFRDBMQ3d0YkFRRi9JNTBCUVFGckpKMEJJNTBCUVFCTUJFQWoxQUVrblFFam5RRUVRQ09mQVVFUFNDUFZBU1BWQVJzRVFDT2ZBVUVCYWlTZkFRVWoxUUZGSWdBRVFDT2ZBVUVBU2lFQUN5QUFCRUFqbndGQkFXc2tud0VMQ3dzTEMxc0JBWDhqcHdGQkFXc2twd0VqcHdGQkFFd0VRQ1BXQVNTbkFTT25BUVJBSTZrQlFROUlJOWNCSTljQkd3UkFJNmtCUVFGcUpLa0JCU1BYQVVVaUFBUkFJNmtCUVFCS0lRQUxJQUFFUUNPcEFVRUJheVNwQVFzTEN3c0xXd0VCZnlPeUFVRUJheVN5QVNPeUFVRUFUQVJBSTlnQkpMSUJJN0lCQkVBanRBRkJEMGdqMlFFajJRRWJCRUFqdEFGQkFXb2t0QUVGSTlrQlJTSUFCRUFqdEFGQkFFb2hBQXNnQUFSQUk3UUJRUUZySkxRQkN3c0xDd3VPQmdBalp5QUFhaVJuSTJjalBnUi9RWUNBQVFWQmdNQUFDMDRFUUNObkl6NEVmMEdBZ0FFRlFZREFBQXRySkdjQ1FBSkFBa0FDUUFKQUkya2lBQVJBSUFCQkFtc09CZ0VGQWdVREJBVUxJNTRCUVFCS0lnQUVmeVBLQVFVZ0FBc0VRQ09lQVVFQmF5U2VBUXNqbmdGRkJFQkJBQ1NiQVFzanFBRkJBRW9pQUFSL0k4c0JCU0FBQ3dSQUk2Z0JRUUZySktnQkN5T29BVVVFUUVFQUpLVUJDeU91QVVFQVNpSUFCSDhqekFFRklBQUxCRUFqcmdGQkFXc2tyZ0VMSTY0QlJRUkFRUUFrckFFTEk3TUJRUUJLSWdBRWZ5UE5BUVVnQUFzRVFDT3pBVUVCYXlTekFRc2pzd0ZGQkVCQkFDU3dBUXNNQkFzam5nRkJBRW9pQUFSL0k4b0JCU0FBQ3dSQUk1NEJRUUZySko0QkN5T2VBVVVFUUVFQUpKc0JDeU9vQVVFQVNpSUFCSDhqeXdFRklBQUxCRUFqcUFGQkFXc2txQUVMSTZnQlJRUkFRUUFrcFFFTEk2NEJRUUJLSWdBRWZ5UE1BUVVnQUFzRVFDT3VBVUVCYXlTdUFRc2pyZ0ZGQkVCQkFDU3NBUXNqc3dGQkFFb2lBQVIvSTgwQkJTQUFDd1JBSTdNQlFRRnJKTE1CQ3lPekFVVUVRRUVBSkxBQkN4QStEQU1MSTU0QlFRQktJZ0FFZnlQS0FRVWdBQXNFUUNPZUFVRUJheVNlQVFzam5nRkZCRUJCQUNTYkFRc2pxQUZCQUVvaUFBUi9JOHNCQlNBQUN3UkFJNmdCUVFGckpLZ0JDeU9vQVVVRVFFRUFKS1VCQ3lPdUFVRUFTaUlBQkg4anpBRUZJQUFMQkVBanJnRkJBV3NrcmdFTEk2NEJSUVJBUVFBa3JBRUxJN01CUVFCS0lnQUVmeVBOQVFVZ0FBc0VRQ096QVVFQmF5U3pBUXNqc3dGRkJFQkJBQ1N3QVFzTUFnc2puZ0ZCQUVvaUFBUi9JOG9CQlNBQUN3UkFJNTRCUVFGckpKNEJDeU9lQVVVRVFFRUFKSnNCQ3lPb0FVRUFTaUlBQkg4anl3RUZJQUFMQkVBanFBRkJBV3NrcUFFTEk2Z0JSUVJBUVFBa3BRRUxJNjRCUVFCS0lnQUVmeVBNQVFVZ0FBc0VRQ091QVVFQmF5U3VBUXNqcmdGRkJFQkJBQ1NzQVFzanN3RkJBRW9pQUFSL0k4MEJCU0FBQ3dSQUk3TUJRUUZySkxNQkN5T3pBVVVFUUVFQUpMQUJDeEErREFFTEVEOFFRQkJCQ3lOcFFRRnFKR2tqYVVFSVRnUkFRUUFrYVF0QkFROExRUUFMZ3dFQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBZ0FDSUJRUUpHRFFFZ0FVRURSZzBDSUFGQkJFWU5Bd3dFQ3lOd0k5c0JSd1JBSTlzQkpIQkJBUThMUVFBUEN5TnhJOXdCUndSQUk5d0JKSEZCQVE4TFFRQVBDeU55STkwQlJ3UkFJOTBCSkhKQkFROExRUUFQQ3lOekk5NEJSd1JBSTk0QkpITkJBUThMUVFBUEMwRUFDMVVBQWtBQ1FBSkFJQUJCQVVjRVFDQUFRUUpHRFFFZ0FFRURSZzBDREFNTFFRRWdBWFJCZ1FGeFFRQkhEd3RCQVNBQmRFR0hBWEZCQUVjUEMwRUJJQUYwUWY0QWNVRUFSdzhMUVFFZ0FYUkJBWEZCQUVjTGlnRUJBWDhqbkFFZ0FHc2tuQUVqbkFGQkFFd0VRQ09jQVNJQlFSOTFJUUJCZ0JBajB3RnJRUUowSkp3Qkl6NEVRQ09jQVVFQmRDU2NBUXNqbkFFZ0FDQUJhaUFBYzJza25BRWpvUUZCQVdva29RRWpvUUZCQ0U0RVFFRUFKS0VCQ3dzajJ3RWptd0VpQUNBQUd3Ui9JNThCQlVFUER3c2o0Z0Vqb1FFUVJBUi9RUUVGUVg4TGJFRVBhZ3VLQVFFQmZ5T21BU0FBYXlTbUFTT21BVUVBVEFSQUk2WUJJZ0ZCSDNVaEFFR0FFQ1BqQVd0QkFuUWtwZ0VqUGdSQUk2WUJRUUYwSktZQkN5T21BU0FBSUFGcUlBQnpheVNtQVNPckFVRUJhaVNyQVNPckFVRUlUZ1JBUVFBa3F3RUxDeVBjQVNPbEFTSUFJQUFiQkg4anFRRUZRUThQQ3lQa0FTT3JBUkJFQkg5QkFRVkJmd3RzUVE5cUM1a0NBUUovSTYwQklBQnJKSzBCSTYwQlFRQk1CRUFqclFFaUFrRWZkU0VBUVlBUUkrVUJhMEVCZENTdEFTTStCRUFqclFGQkFYUWtyUUVMSTYwQklBQWdBbW9nQUhOckpLMEJJNjhCUVFGcUpLOEJJNjhCUVNCT0JFQkJBQ1N2QVFzTFFRQWhBaVBtQVNFQUk5MEJJNndCSWdFZ0FSc0VRQ05yQkVCQm5QNERFQUZCQlhWQkQzRWlBQ1RtQVVFQUpHc0xCVUVQRHdzanJ3RkJBbTFCc1A0RGFoQUJJUUVqcndGQkFtOEVmeUFCUVE5eEJTQUJRUVIxUVE5eEN5RUJBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BU0FBUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEFnd0NDeUFCUVFGMUlRRkJBaUVDREFFTElBRkJBblVoQVVFRUlRSUxJQUpCQUVvRWZ5QUJJQUp0QlVFQUMwRVBhZ3VyQVFFQmZ5T3hBU0FBYXlTeEFTT3hBVUVBVEFSQUk3RUJJUUFqNXdFajZBRjBJZ0ZCQVhRZ0FTTStHeVN4QVNPeEFTQUFRUjkxSWdFZ0FDQUJhbk5ySkxFQkk3VUJJZ0JCQVhFaEFTQUFRUUYxSWdBa3RRRWp0UUVnQVNBQVFRRnhjeUlCUVE1MGNpUzFBU1BwQVFSQUk3VUJRYjkvY1NTMUFTTzFBU0FCUVFaMGNpUzFBUXNMSTk0Qkk3QUJJZ0FnQUJzRWZ5TzBBUVZCRHc4TFFYOUJBU08xQVVFQmNSdHNRUTlxQ3pBQUlBQkJQRVlFUUVIL0FBOExJQUJCUEd0Qm9JMEdiQ0FCYkVFSWJVR2dqUVp0UVR4cVFhQ05CbXhCalBFQ2JRdWNBUUVCZjBFQUpIWWdBRUVQSTE0YklnUWdBV29nQkVFUGFpTmZHeUlFSUFKcUlBUkJEMm9qWUJzaEJDQURJQUlnQVNBQVFROGpZaHNpQUdvZ0FFRVBhaU5qR3lJQWFpQUFRUTlxSTJRYklnQnFJQUJCRDJvalpSc2hBRUVBSkhkQkFDUjRJQU1nQkdvZ0JFRVBhaU5oR3lOY1FRRnFFRWtoQVNBQUkxMUJBV29RU1NFQUlBRWtkQ0FBSkhVZ0FFSC9BWEVnQVVIL0FYRkJDSFJ5QzhNREFRVi9BbjhqMmdFZ0FHb2syZ0ZCQUNPY0FTUGFBV3RCQUVvTkFCcEJBUXNpQVVVRVFFRUJFRU1oQVFzQ2Z5UGZBU0FBYWlUZkFVRUFJNllCSTk4QmEwRUFTZzBBR2tFQkN5SUVSUVJBUVFJUVF5RUVDd0ovSStBQklBQnFKT0FCSTYwQkkrQUJhMEVBU2lJQ0JFQWphMFVoQWd0QkFDQUNEUUFhUVFFTElnSkZCRUJCQXhCRElRSUxBbjhqNFFFZ0FHb2s0UUZCQUNPeEFTUGhBV3RCQUVvTkFCcEJBUXNpQlVVRVFFRUVFRU1oQlFzZ0FRUkFJOW9CSVFOQkFDVGFBU0FERUVVa2JBc2dCQVJBSTk4QklRTkJBQ1RmQVNBREVFWWtiUXNnQWdSQUkrQUJJUU5CQUNUZ0FTQURFRWNrYmdzZ0JRUkFJK0VCSVFOQkFDVGhBU0FERUVna2J3c0NmeUFCSUFRZ0FSc2lBVVVFUUNBQ0lRRUxJQUZGQ3dSQUlBVWhBUXNnQVFSQVFRRWtlQXNqYUNQcUFTQUFiR29rYUNOb1FZQ0FnQVJCZ0lDQUFpTStHMDRFUUNOb1FZQ0FnQVJCZ0lDQUFpTStHMnNrYUNONElnQWpkaUFBR3lJQlJRUkFJM2NoQVFzZ0FRUkFJMndqYlNOdUkyOFFTaG9MSTJvaUFVRUJkRUdBbWNFQWFpSUFJM1JCQW1vNkFBQWdBRUVCYWlOMVFRSnFPZ0FBSUFGQkFXb2thaU5xSStzQlFRSnRRUUZyVGdSQUkycEJBV3NrYWdzTEM1d0RBUVYvSUFBUVJTRUNJQUFRUmlFQklBQVFSeUVESUFBUVNDRUVJQUlrYkNBQkpHMGdBeVJ1SUFRa2J5Tm9JK29CSUFCc2FpUm9JMmhCZ0lDQUJFR0FnSUFDSXo0YlRnUkFJMmhCZ0lDQUJFR0FnSUFDSXo0YmF5Um9JQUlnQVNBRElBUVFTaUVBSTJwQkFYUkJnSm5CQUdvaUJTQUFRWUQrQTNGQkNIVkJBbW82QUFBZ0JVRUJhaUFBUWY4QmNVRUNham9BQUNNM0JFQWdBa0VQUVE5QkR4QktJUUFqYWtFQmRFR0FtU0ZxSWdJZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBRUgvQVhGQkFtbzZBQUJCRHlBQlFROUJEeEJLSVFBamFrRUJkRUdBbVNscUlnRWdBRUdBL2dOeFFRaDFRUUpxT2dBQUlBRkJBV29nQUVIL0FYRkJBbW82QUFCQkQwRVBJQU5CRHhCS0lRQWpha0VCZEVHQW1URnFJZ0VnQUVHQS9nTnhRUWgxUVFKcU9nQUFJQUZCQVdvZ0FFSC9BWEZCQW1vNkFBQkJEMEVQUVE4Z0JCQktJUUFqYWtFQmRFR0FtVGxxSWdFZ0FFR0EvZ054UVFoMVFRSnFPZ0FBSUFGQkFXb2dBRUgvQVhGQkFtbzZBQUFMSTJwQkFXb2thaU5xSStzQlFRSnRRUUZyVGdSQUkycEJBV3NrYWdzTEN4NEJBWDhnQUJCQ0lRRWdBVVVqTkNNMEd3UkFJQUFRU3dVZ0FCQk1Dd3RMQUNOYkl6NEVmMEd1QVFWQjF3QUxTQVJBRHdzRFFDTmJJejRFZjBHdUFRVkIxd0FMVGdSQUl6NEVmMEd1QVFWQjF3QUxFRTBqV3lNK0JIOUJyZ0VGUWRjQUMyc2tXd3dCQ3dzTElRQWdBRUdtL2dOR0JFQkJwdjRERUFGQmdBRnhJUUFnQUVId0FISVBDMEYvQzV3QkFRRi9JNzRCSVFBanZ3RUVRQ0FBUVh0eElBQkJCSElqN0FFYklRQWdBRUYrY1NBQVFRRnlJKzBCR3lFQUlBQkJkM0VnQUVFSWNpUHVBUnNoQUNBQVFYMXhJQUJCQW5Jajd3RWJJUUFGSThBQkJFQWdBRUYrY1NBQVFRRnlJL0FCR3lFQUlBQkJmWEVnQUVFQ2NpUHhBUnNoQUNBQVFYdHhJQUJCQkhJajhnRWJJUUFnQUVGM2NTQUFRUWh5SS9NQkd5RUFDd3NnQUVId0FYSUx6d0lCQVg4Z0FFR0FnQUpJQkVCQmZ3OExJQUJCZ0lBQ1RpSUJCSDhnQUVHQXdBSklCU0FCQ3dSQVFYOFBDeUFBUVlEQUEwNGlBUVIvSUFCQmdQd0RTQVVnQVFzRVFDQUFRWUJBYWhBQkR3c2dBRUdBL0FOT0lnRUVmeUFBUVovOUEwd0ZJQUVMQkVBam1BRkJBa2dFUUVIL0FROExRWDhQQ3lBQVFjMytBMFlFUUVIL0FTRUJRYzMrQXhBQlFRRnhSUVJBUWY0QklRRUxJejVGQkVBZ0FVSC9mbkVoQVFzZ0FROExJQUJCeFA0RFJnUkFJQUFqVmhBRUkxWVBDeUFBUVpEK0EwNGlBUVIvSUFCQnB2NERUQVVnQVFzRVFCQk9JQUFRVHc4TElBQkJzUDREVGlJQkJIOGdBRUcvL2dOTUJTQUJDd1JBRUU1QmZ3OExJQUJCaFA0RFJnUkFJQUFqaGdGQmdQNERjVUVJZFNJQkVBUWdBUThMSUFCQmhmNERSZ1JBSUFBamh3RVFCQ09IQVE4TElBQkJqLzREUmdSQUk0UUJRZUFCY2c4TElBQkJnUDREUmdSQUVGQVBDMEYvQ3lrQkFYOGp5UUVnQUVZRVFFRUJKTUVCQ3lBQUVGRWlBVUYvUmdSQUlBQVFBUThMSUFGQi93RnhDN1lDQVFGL0kxQUVRQThMSUFCQi96OU1CRUFqVWdSL0lBRkJFSEZGQlNOU0MwVUVRQ0FCUVE5eElnSUVRQ0FDUVFwR0JFQkJBU1JPQ3dWQkFDUk9Dd3NGSUFCQi8vOEFUQVJBSXpsRklnSUVmeUFDQlNBQVFmL2ZBRXdMQkVBalVnUkFJQUZCRDNFa09Bc2dBU0VDSTFFRVFDQUNRUjl4SVFJak9FSGdBWEVrT0FValV3UkFJQUpCL3dCeElRSWpPRUdBQVhFa09BVWpPUVJBUVFBa09Bc0xDeU00SUFKeUpEZ0ZJemhCL3dGeFFRRkJBQ0FCUVFCS0cwSC9BWEZCQ0hSeUpEZ0xCU05TUlNJQ0JIOGdBRUgvdndGTUJTQUNDd1JBSTA4alVTSUFJQUFiQkVBak9FRWZjU1E0SXpnZ0FVSGdBWEZ5SkRnUEN5QUJRUTl4SUFGQkEzRWpPUnNrUEFValVrVWlBZ1IvSUFCQi8vOEJUQVVnQWdzRVFDTlJCRUFnQVVFQmNRUkFRUUVrVHdWQkFDUlBDd3NMQ3dzTEN5d0FJQUJCQkhWQkQzRWsrUUVnQUVFSWNVRUFSeVRWQVNBQVFRZHhKTlFCSUFCQitBRnhRUUJLSk5zQkN5d0FJQUJCQkhWQkQzRWsrZ0VnQUVFSWNVRUFSeVRYQVNBQVFRZHhKTllCSUFCQitBRnhRUUJLSk53QkN5d0FJQUJCQkhWQkQzRWsvQUVnQUVFSWNVRUFSeVRaQVNBQVFRZHhKTmdCSUFCQitBRnhRUUJLSk40QkM0RUJBUUYvSUFCQkJIVWs2QUVnQUVFSWNVRUFSeVRwQVNBQVFRZHhKSUVDQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ09CQWlJQkJFQWdBVUVCYXc0SEFRSURCQVVHQndnTFFRZ2s1d0VQQzBFUUpPY0JEd3RCSUNUbkFROExRVEFrNXdFUEMwSEFBQ1RuQVE4TFFkQUFKT2NCRHd0QjRBQWs1d0VQQzBId0FDVG5BUXNMZ3dFQkFYOUJBU1NiQVNPZUFVVUVRRUhBQUNTZUFRdEJnQkFqMHdGclFRSjBKSndCSXo0RVFDT2NBVUVCZENTY0FRc2oxQUVrblFFaitRRWtud0VqMHdFa3BBRWp6Z0VpQUNTakFTQUFRUUJLSWdBRWZ5UFBBVUVBU2dVZ0FBc0VRRUVCSktJQkJVRUFKS0lCQ3lQUEFVRUFTZ1JBRUQwTEk5c0JSUVJBUVFBa213RUxDMGNBUVFFa3BRRWpxQUZGQkVCQndBQWtxQUVMUVlBUUkrTUJhMEVDZENTbUFTTStCRUFqcGdGQkFYUWtwZ0VMSTlZQkpLY0JJL29CSktrQkk5d0JSUVJBUVFBa3BRRUxDMEFBUVFFa3JBRWpyZ0ZGQkVCQmdBSWtyZ0VMUVlBUUkrVUJhMEVCZENTdEFTTStCRUFqclFGQkFYUWtyUUVMUVFBa3J3RWozUUZGQkVCQkFDU3NBUXNMU1FFQmYwRUJKTEFCSTdNQlJRUkFRY0FBSkxNQkN5UG5BU1BvQVhRaUFFRUJkQ0FBSXo0YkpMRUJJOWdCSkxJQkkvd0JKTFFCUWYvL0FTUzFBU1BlQVVVRVFFRUFKTEFCQ3d0VUFDQUFRWUFCY1VFQVJ5UmhJQUJCd0FCeFFRQkhKR0FnQUVFZ2NVRUFSeVJmSUFCQkVIRkJBRWNrWGlBQVFRaHhRUUJISkdVZ0FFRUVjVUVBUnlSa0lBQkJBbkZCQUVja1l5QUFRUUZ4UVFCSEpHSUxpQVVCQVg4Z0FFR20vZ05ISWdJRVFDTm1SU0VDQ3lBQ0JFQkJBQThMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQ1FaRCtBMGNFUUNBQ1FaSCtBMnNPRmdJR0NnNFZBd2NMRHdFRUNBd1FGUVVKRFJFU0V4UVZDeUFCUWZBQWNVRUVkU1RPQVNBQlFRaHhRUUJISk5BQklBRkJCM0VrendFTUZRc2dBVUdBQVhGQkFFY2szUUVNRkFzZ0FVRUdkVUVEY1NUaUFTQUJRVDl4SlBVQlFjQUFJL1VCYXlTZUFRd1RDeUFCUVFaMVFRTnhKT1FCSUFGQlAzRWs5Z0ZCd0FBajlnRnJKS2dCREJJTElBRWs5d0ZCZ0FJajl3RnJKSzRCREJFTElBRkJQM0VrK0FGQndBQWorQUZySkxNQkRCQUxJQUVRVkF3UEN5QUJFRlVNRGd0QkFTUnJJQUZCQlhWQkQzRWsrd0VNRFFzZ0FSQldEQXdMSUFFazBRRWowUUVqMGdGQkNIUnlKTk1CREFzTElBRWsvUUVqL1FFai9nRkJDSFJ5Sk9NQkRBb0xJQUVrL3dFai93RWpnQUpCQ0hSeUpPVUJEQWtMSUFFUVZ3d0lDeUFCUVlBQmNRUkFJQUZCd0FCeFFRQkhKTW9CSUFGQkIzRWswZ0VqMFFFajBnRkJDSFJ5Sk5NQkVGZ0xEQWNMSUFGQmdBRnhCRUFnQVVIQUFIRkJBRWNreXdFZ0FVRUhjU1QrQVNQOUFTUCtBVUVJZEhJazR3RVFXUXNNQmdzZ0FVR0FBWEVFUUNBQlFjQUFjVUVBUnlUTUFTQUJRUWR4SklBQ0kvOEJJNEFDUVFoMGNpVGxBUkJhQ3d3RkN5QUJRWUFCY1FSQUlBRkJ3QUJ4UVFCSEpNMEJFRnNMREFRTElBRkJCSFZCQjNFa1hDQUJRUWR4SkYxQkFTUjJEQU1MSUFFUVhFRUJKSGNNQWdzZ0FVR0FBWEZCQUVja1ppQUJRWUFCY1VVRVFBSkFRWkQrQXlFQ0EwQWdBa0dtL2dOT0RRRWdBa0VBRUFRZ0FrRUJhaUVDREFBQUN3QUxDd3dCQzBFQkR3dEJBUXM4QVFGL0lBQkJDSFFoQVVFQUlRQURRQUpBSUFCQm53RktEUUFnQUVHQS9BTnFJQUFnQVdvUUFSQUVJQUJCQVdvaEFBd0JDd3RCaEFVa3dnRUxJd0VCZnlPRUFoQUJJUUFqaFFJUUFVSC9BWEVnQUVIL0FYRkJDSFJ5UWZEL0EzRUxKd0VCZnlPR0FoQUJJUUFqaHdJUUFVSC9BWEVnQUVIL0FYRkJDSFJ5UWZBL2NVR0FnQUpxQzRNQkFRTi9JenBGQkVBUEN5QUFRWUFCY1VVanhRRWp4UUViQkVCQkFDVEZBU09EQWhBQlFZQUJjaUVBSTRNQ0lBQVFCQThMRUY4aEFSQmdJUUlnQUVIL2ZuRkJBV3BCQkhRaEF5QUFRWUFCY1FSQVFRRWt4UUVnQXlUR0FTQUJKTWNCSUFJa3lBRWpnd0lnQUVIL2ZuRVFCQVVnQVNBQ0lBTVFheU9EQWtIL0FSQUVDd3RpQVFOL0k0b0NJQUJHSWdKRkJFQWppUUlnQUVZaEFnc2dBZ1JBSUFCQkFXc2lBeEFCUWI5L2NTSUNRVDl4SWdSQlFHc2dCRUVCUVFBamlRSWdBRVliRzBHQWtBUnFJQUU2QUFBZ0FrR0FBWEVFUUNBRElBSkJBV3BCZ0FGeUVBUUxDd3M4QVFGL0FrQUNRQUpBQWtBZ0FBUkFJQUFpQVVFQlJnMEJJQUZCQWtZTkFpQUJRUU5HRFFNTUJBdEJDUThMUVFNUEMwRUZEd3RCQnc4TFFRQUxMUUVCZjBFQkk0b0JFR01pQW5RZ0FIRkJBRWNpQUFSL1FRRWdBblFnQVhGRkJTQUFDd1JBUVFFUEMwRUFDNUVCQVFKL0EwQWdBU0FBU0FSQUlBRkJCR29oQVNPR0FTSUNRUVJxSklZQkk0WUJRZi8vQTBvRVFDT0dBVUdBZ0FSckpJWUJDeU9KQVFSQUk0c0JCRUFqaUFFa2h3RkJBU1NCQVVFQ0VEcEJBQ1NMQVVFQkpJd0JCU09NQVFSQVFRQWtqQUVMQ3lBQ0k0WUJFR1FFUUNPSEFVRUJhaVNIQVNPSEFVSC9BVW9FUUVFQkpJc0JRUUFraHdFTEN3c01BUXNMQ3d3QUk0VUJFR1ZCQUNTRkFRdEhBUUYvSTRZQklRQkJBQ1NHQVVHRS9nTkJBQkFFSTRrQkJIOGdBQ09HQVJCa0JTT0pBUXNFUUNPSEFVRUJhaVNIQVNPSEFVSC9BVW9FUUVFQkpJc0JRUUFraHdFTEN3dUFBUUVDZnlPSkFTRUJJQUJCQkhGQkFFY2tpUUVnQUVFRGNTRUNJQUZGQkVBamlnRVFZeUVBSUFJUVl5RUJJNGtCQkg4amhnRkJBU0FBZEhFRkk0WUJRUUVnQUhSeFFRQkhJZ0FFZnlPR0FVRUJJQUYwY1FVZ0FBc0xCRUFqaHdGQkFXb2tod0VqaHdGQi93RktCRUJCQVNTTEFVRUFKSWNCQ3dzTElBSWtpZ0VMMGdZQkFYOENRQUpBSUFCQnpmNERSZ1JBUWMzK0F5QUJRUUZ4RUFRTUFRc2dBRUdBZ0FKSUJFQWdBQ0FCRUZNTUFRc2dBRUdBZ0FKT0lnSUVRQ0FBUVlEQUFrZ2hBZ3NnQWcwQklBQkJnTUFEVGlJQ0JFQWdBRUdBL0FOSUlRSUxJQUlFUUNBQVFZQkFhaUFCRUFRTUFnc2dBRUdBL0FOT0lnSUVRQ0FBUVovOUEwd2hBZ3NnQWdSQUk1Z0JRUUpJRFFFTUFnc2dBRUdnL1FOT0lnSUVRQ0FBUWYvOUEwd2hBZ3NnQWcwQUlBQkJndjREUmdSQUlBRkJBWEZCQUVja2p3RWdBVUVDY1VFQVJ5U1FBU0FCUVlBQmNVRUFSeVNSQVVFQkR3c2dBRUdRL2dOT0lnSUVRQ0FBUWFiK0Ewd2hBZ3NnQWdSQUVFNGdBQ0FCRUYwUEN5QUFRYkQrQTA0aUFnUkFJQUJCdi80RFRDRUNDeUFDQkVBUVRnc2dBRUhBL2dOT0lnSUVRQ0FBUWN2K0Ewd2hBZ3NnQWdSQUlBQkJ3UDREUmdSQUlBRVFIZ3dEQ3lBQVFjSCtBMFlFUUVIQi9nTWdBVUg0QVhGQndmNERFQUZCQjNGeVFZQUJjaEFFREFJTElBQkJ4UDREUmdSQVFRQWtWaUFBUVFBUUJBd0NDeUFBUWNYK0EwWUVRQ0FCSklJQ0RBTUxJQUJCeHY0RFJnUkFJQUVRWGd3REN3SkFBa0FDUUFKQUlBQWlBa0hEL2dOSEJFQWdBa0hDL2dOckRnb0JCQVFFQkFRRUJBTUNCQXNnQVNSWERBWUxJQUVrV0F3RkN5QUJKRmtNQkFzZ0FTUmFEQU1MREFJTEk0TUNJQUJHQkVBZ0FSQmhEQUVMSXowZ0FFWWlBa1VFUUNNN0lBQkdJUUlMSUFJRVFDUEZBUVJBQW44anh3RkJnSUFCVGlJQ0JFQWp4d0ZCLy84QlRDRUNDeUFDUlFzRVFDUEhBVUdBb0FOT0lnSUVRQ1BIQVVIL3Z3Tk1JUUlMQ3lBQ0RRSUxDeUFBSTRnQ1RpSUNCRUFnQUNPSkFrd2hBZ3NnQWdSQUlBQWdBUkJpREFJTElBQkJoUDREVGlJQ0JFQWdBRUdIL2dOTUlRSUxJQUlFUUJCbUFrQUNRQUpBQWtBZ0FDSUNRWVQrQTBjRVFDQUNRWVgrQTJzT0F3RUNBd1FMRUdjTUJRc0NRQ09KQVFSQUk0d0JEUUVqaXdFRVFFRUFKSXNCQ3dzZ0FTU0hBUXNNQlFzZ0FTU0lBU09NQVNPSkFTSUFJQUFiQkVBamlBRWtod0ZCQUNTTUFRc01CQXNnQVJCb0RBTUxEQUlMSUFCQmdQNERSZ1JBSUFGQi93RnpKTDRCSTc0QklnSkJFSEZCQUVja3Z3RWdBa0VnY1VFQVJ5VEFBUXNnQUVHUC9nTkdCRUFnQVJBUERBSUxJQUJCLy84RFJnUkFJQUVRRGd3Q0MwRUJEd3RCQUE4TFFRRUxId0FqOUFFZ0FFWUVRRUVCSk1FQkN5QUFJQUVRYVFSQUlBQWdBUkFFQ3d0Z0FRTi9BMEFDUUNBRElBSk9EUUFnQUNBRGFoQlNJUVVnQVNBRGFpRUVBMEFnQkVIL3Z3SktCRUFnQkVHQVFHb2hCQXdCQ3dzZ0JDQUZFR29nQTBFQmFpRUREQUVMQzBFZ0lRTWp3Z0VnQWtFUWJVSEFBRUVnSXo0YmJHb2t3Z0VMWndFQmZ5UEZBVVVFUUE4TEk4Y0JJOGdCSThZQklnQkJFQ0FBUVJCSUd5SUFFR3NqeHdFZ0FHb2t4d0VqeUFFZ0FHb2t5QUVqeGdFZ0FHc2t4Z0VqeGdGQkFFd0VRRUVBSk1VQkk0TUNRZjhCRUFRRkk0TUNJOFlCUVJCdFFRRnJRZjkrY1JBRUN3dEdBUUovSTRJQ0lRTUNmeUFBUlNJQ1JRUkFJQUJCQVVZaEFnc2dBZ3NFZnlOV0lBTkdCU0FDQ3dSQUlBRkJCSElpQVVIQUFIRUVRQkE3Q3dVZ0FVRjdjU0VCQ3lBQkM0SUNBUU4vSTdZQlJRUkFEd3NqbUFFaEFDQUFJMVlpQWtHUUFVNEVmMEVCQlNOVkl6NEVmMEh3QlFWQitBSUxUZ1IvUVFJRlFRTkJBQ05WSXo0RWYwSHlBd1ZCK1FFTFRoc0xDeUlCUndSQVFjSCtBeEFCSVFBZ0FTU1lBVUVBSVFJQ1FBSkFBa0FDUUNBQkJFQWdBVUVCYXc0REFRSURCQXNnQUVGOGNTSUFRUWh4UVFCSElRSU1Bd3NnQUVGOWNVRUJjaUlBUVJCeFFRQkhJUUlNQWdzZ0FFRitjVUVDY2lJQVFTQnhRUUJISVFJTUFRc2dBRUVEY2lFQUN5QUNCRUFRT3dzZ0FVVUVRQkJzQ3lBQlFRRkdCRUJCQVNSL1FRQVFPZ3RCd2Y0RElBRWdBQkJ0RUFRRklBSkJtUUZHQkVCQndmNERJQUZCd2Y0REVBRVFiUkFFQ3dzTHRBRUFJN1lCQkVBalZTQUFhaVJWQTBBalZRSi9JejRFUUVFSUkxWkJtUUZHRFFFYVFaQUhEQUVMUVFRalZrR1pBVVlOQUJwQnlBTUxUZ1JBSTFVQ2Z5TStCRUJCQ0NOV1Faa0JSZzBCR2tHUUJ3d0JDMEVFSTFaQm1RRkdEUUFhUWNnREMyc2tWU05XSWdCQmtBRkdCRUFqTXdSQUVEZ0ZJQUFRTndzUU9VRi9KTU1CUVg4a3hBRUZJQUJCa0FGSUJFQWpNMFVFUUNBQUVEY0xDd3RCQUNBQVFRRnFJQUJCbVFGS0d5UldEQUVMQ3dzUWJndXpBUUFqVkFKL0l6NEVRRUVJSTFaQm1RRkdEUUVhUVpBSERBRUxRUVFqVmtHWkFVWU5BQnBCeUFNTFNBUkFEd3NEUUNOVUFuOGpQZ1JBUVFnalZrR1pBVVlOQVJwQmtBY01BUXRCQkNOV1Faa0JSZzBBR2tISUF3dE9CRUFDZnlNK0JFQkJDQ05XUVprQlJnMEJHa0dRQnd3QkMwRUVJMVpCbVFGR0RRQWFRY2dEQ3hCdkkxUUNmeU0rQkVCQkNDTldRWmtCUmcwQkdrR1FCd3dCQzBFRUkxWkJtUUZHRFFBYVFjZ0RDMnNrVkF3QkN3c0xNd0VCZjBFQkk1QUJCSDlCQWdWQkJ3c2lBblFnQUhGQkFFY2lBQVIvUVFFZ0FuUWdBWEZGQlNBQUN3UkFRUUVQQzBFQUM1WUJBUUovSTVFQlJRUkFEd3NEUUNBQklBQklCRUFnQVVFRWFpRUJJNDBCSWdKQkJHb2tqUUVqalFGQi8vOERTZ1JBSTQwQlFZQ0FCR3NralFFTElBSWpqUUVRY1FSQVFZSCtBMEdCL2dNUUFVRUJkRUVCYWtIL0FYRVFCQ09PQVVFQmFpU09BU09PQVVFSVJnUkFRUUFramdGQkFTU0NBVUVERURwQmd2NERRWUwrQXhBQlFmOStjUkFFUVFBa2tRRUxDd3dCQ3dzTGlBRUFJOElCUVFCS0JFQWp3Z0VnQUdvaEFFRUFKTUlCQ3lOSklBQnFKRWtqVFVVRVFDTXhCRUFqVkNBQWFpUlVFSEFGSUFBUWJ3c2pNQVJBSTFzZ0FHb2tXd1VnQUJCTkN5QUFFSElMSXpJRVFDT0ZBU0FBYWlTRkFSQm1CU0FBRUdVTEk1UUJJQUJxSkpRQkk1UUJJNUlCVGdSQUk1TUJRUUZxSkpNQkk1UUJJNUlCYXlTVUFRc0xDZ0JCQkJCekkwZ1FBUXNtQVFGL1FRUVFjeU5JUVFGcVFmLy9BM0VRQVNFQUVIUkIvd0Z4SUFCQi93RnhRUWgwY2dzTUFFRUVFSE1nQUNBQkVHb0xNQUVCZjBFQklBQjBRZjhCY1NFQ0lBRkJBRW9FUUNOR0lBSnlRZjhCY1NSR0JTTkdJQUpCL3dGemNTUkdDeU5HQ3drQVFRVWdBQkIzR2d0SkFRRi9JQUZCQUU0RVFDQUFRUTl4SUFGQkQzRnFRUkJ4QkVCQkFSQjRCVUVBRUhnTEJTQUJRUjkxSWdJZ0FTQUNhbk5CRDNFZ0FFRVBjVXNFUUVFQkVIZ0ZRUUFRZUFzTEN3a0FRUWNnQUJCM0dnc0pBRUVHSUFBUWR4b0xDUUJCQkNBQUVIY2FDenNCQW44Z0FVR0EvZ054UVFoMUlRSWdBRUVCYWlFRElBQWdBVUgvQVhFaUFSQnBCRUFnQUNBQkVBUUxJQU1nQWhCcEJFQWdBeUFDRUFRTEN3d0FRUWdRY3lBQUlBRVFmUXQxQUNBQ0JFQWdBU0FBUWYvL0EzRWlBR29nQUNBQmMzTWlBa0VRY1FSQVFRRVFlQVZCQUJCNEN5QUNRWUFDY1FSQVFRRVFmQVZCQUJCOEN3VWdBQ0FCYWtILy93TnhJZ0lnQUVILy93TnhTUVJBUVFFUWZBVkJBQkI4Q3lBQUlBRnpJQUp6UVlBZ2NRUkFRUUVRZUFWQkFCQjRDd3NMQ2dCQkJCQnpJQUFRVWd1UkJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc01Fd3NRZFVILy93TnhJZ0JCZ1A0RGNVRUlkU1JBSUFCQi93RnhKRUVNRHdzalFVSC9BWEVqUUVIL0FYRkJDSFJ5SXo4UWRnd1JDeU5CUWY4QmNTTkFRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtRQXdSQ3lOQVFRRVFlU05BUVFGcVFmOEJjU1JBSTBBRVFFRUFFSG9GUVFFUWVndEJBQkI3REE4TEkwQkJmeEI1STBCQkFXdEIvd0Z4SkVBalFBUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURnc1FkRUgvQVhFa1FBd0xDeU0vUVlBQmNVR0FBVVlFUUVFQkVId0ZRUUFRZkFzalB5SUFRUUYwSUFCQi93RnhRUWQyY2tIL0FYRWtQd3dMQ3hCMVFmLy9BM0VqUnhCK0RBZ0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpSUFJMEZCL3dGeEkwQkIvd0Z4UVFoMGNpSUJRUUFRZnlBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JVRUFFSHRCQ0E4TEkwRkIvd0Z4STBCQi93RnhRUWgwY2hDQUFVSC9BWEVrUHd3SkN5TkJRZjhCY1NOQVFmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa1FBd0pDeU5CUVFFUWVTTkJRUUZxUWY4QmNTUkJJMEVFUUVFQUVIb0ZRUUVRZWd0QkFCQjdEQWNMSTBGQmZ4QjVJMEZCQVd0Qi93RnhKRUVqUVFSQVFRQVFlZ1ZCQVJCNkMwRUJFSHNNQmdzUWRFSC9BWEVrUVF3REN5TS9RUUZ4UVFCTEJFQkJBUkI4QlVFQUVId0xJejhpQUVFSGRDQUFRZjhCY1VFQmRuSkIvd0Z4SkQ4TUF3dEJmdzhMSTBoQkFtcEIvLzhEY1NSSURBSUxJMGhCQVdwQi8vOERjU1JJREFFTFFRQVFla0VBRUh0QkFCQjRDMEVFRHdzZ0FFSC9BWEVrUVVFSUN5Z0JBWDhnQUVFWWRFRVlkU0lCUVlBQmNRUkFRWUFDSUFCQkdIUkJHSFZyUVg5c0lRRUxJQUVMS1FFQmZ5QUFFSUlCSVFFalNDQUJRUmgwUVJoMWFrSC8vd054SkVnalNFRUJha0gvL3dOeEpFZ0wyQVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFDQUFRUkZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lNNkJFQkJ6ZjRERUlBQlFmOEJjU0lBUVFGeEJFQkJ6ZjRESUFCQmZuRWlBRUdBQVhFRWYwRUFKRDRnQUVIL2ZuRUZRUUVrUGlBQVFZQUJjZ3NRZGtIRUFBOExDMEVCSkUwTUVBc1FkVUgvL3dOeElnQkJnUDREY1VFSWRTUkNJQUJCL3dGeEpFTWpTRUVDYWtILy93TnhKRWdNRVFzalEwSC9BWEVqUWtIL0FYRkJDSFJ5SXo4UWRnd1FDeU5EUWY4QmNTTkNRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtRZ3dRQ3lOQ1FRRVFlU05DUVFGcVFmOEJjU1JDSTBJRVFFRUFFSG9GUVFFUWVndEJBQkI3REE0TEkwSkJmeEI1STBKQkFXdEIvd0Z4SkVJalFnUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURRc1FkRUgvQVhFa1Fnd0tDMEVCUVFBalB5SUJRWUFCY1VHQUFVWWJJUUFqUmtFRWRrRUJjU0FCUVFGMGNrSC9BWEVrUHd3S0N4QjBFSU1CUVFnUEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJaUFDTkRRZjhCY1NOQ1FmOEJjVUVJZEhJaUFVRUFFSDhnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVWQkFCQjdRUWdQQ3lORFFmOEJjU05DUWY4QmNVRUlkSElRZ0FGQi93RnhKRDhNQ0FzalEwSC9BWEVqUWtIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkVJTUNBc2pRMEVCRUhralEwRUJha0gvQVhFa1F5TkRCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d0dDeU5EUVg4UWVTTkRRUUZyUWY4QmNTUkRJME1FUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQVVMRUhSQi93RnhKRU1NQWd0QkFVRUFJejhpQVVFQmNVRUJSaHNoQUNOR1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpUS9EQUlMUVg4UEN5TklRUUZxUWYvL0EzRWtTQXdCQ3lBQUJFQkJBUkI4QlVFQUVId0xRUUFRZWtFQUVIdEJBQkI0QzBFRUR3c2dBRUgvQVhFa1EwRUlDN2dHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJJRWNFUUNBQVFTRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU5HUVFkMlFRRnhCRUFqU0VFQmFrSC8vd054SkVnRkVIUVFnd0VMUVFnUEN4QjFRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JTTklRUUpxUWYvL0EzRWtTQXdRQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUNNL0VIWWdBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1JFSUFCQi93RnhKRVVNRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkVRZ0FFSC9BWEVrUlVFSUR3c2pSRUVCRUhralJFRUJha0gvQVhFa1JDTkVCRUJCQUJCNkJVRUJFSG9MUVFBUWV3d05DeU5FUVg4UWVTTkVRUUZyUWY4QmNTUkVJMFFFUUVFQUVIb0ZRUUVRZWd0QkFSQjdEQXdMRUhSQi93RnhKRVFNQ2d0QkJrRUFJMFpCQlhaQkFYRkJBRXNiSVFFZ0FVSGdBSElnQVNOR1FRUjJRUUZ4UVFCTEd5RUJJMFpCQm5aQkFYRkJBRXNFZnlNL0lBRnJRZjhCY1FVZ0FVRUdjaUFCSXo4aUFFRVBjVUVKU3hzaUFVSGdBSElnQVNBQVFaa0JTeHNpQVNBQWFrSC9BWEVMSWdBRVFFRUFFSG9GUVFFUWVnc2dBVUhnQUhFRVFFRUJFSHdGUVFBUWZBdEJBQkI0SUFBa1B3d0tDeU5HUVFkMlFRRnhRUUJMQkVBUWRCQ0RBUVVqU0VFQmFrSC8vd054SkVnTFFRZ1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWlBU0FCUWYvL0EzRkJBQkIvSUFGQkFYUkIvLzhEY1NJQlFZRCtBM0ZCQ0hVa1JDQUJRZjhCY1NSRlFRQVFlMEVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdFUWdBRkIvd0Z4SkQ4Z0FVRUJha0gvL3dOeElnRkJnUDREY1VFSWRTUkVJQUZCL3dGeEpFVU1Cd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlRUUZyUWYvL0EzRWlBVUdBL2dOeFFRaDFKRVFnQVVIL0FYRWtSVUVJRHdzalJVRUJFSGtqUlVFQmFrSC9BWEVrUlNORkJFQkJBQkI2QlVFQkVIb0xRUUFRZXd3RkN5TkZRWDhRZVNORlFRRnJRZjhCY1NSRkkwVUVRRUVBRUhvRlFRRVFlZ3RCQVJCN0RBUUxFSFJCL3dGeEpFVU1BZ3NqUDBGL2MwSC9BWEVrUDBFQkVIdEJBUkI0REFJTFFYOFBDeU5JUVFGcVFmLy9BM0VrU0F0QkJBdVVCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUV3UndSQUlBQkJNV3NPRHdFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTBaQkJIWkJBWEVFUUNOSVFRRnFRZi8vQTNFa1NBVVFkQkNEQVF0QkNBOExFSFZCLy84RGNTUkhJMGhCQW1wQi8vOERjU1JJREJJTEkwVkIvd0Z4STBSQi93RnhRUWgwY2lJQUl6OFFkZ3dPQ3lOSFFRRnFRZi8vQTNFa1IwRUlEd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlJZ0FRZ0FFaUFVRUJFSGtnQVVFQmFrSC9BWEVpQVFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHNNRFFzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdBUWdBRWlBVUYvRUhrZ0FVRUJhMEgvQVhFaUFRUkFRUUFRZWdWQkFSQjZDMEVCRUhzTURBc2pSVUgvQVhFalJFSC9BWEZCQ0hSeUVIUkIvd0Z4RUhZTURBdEJBQkI3UVFBUWVFRUJFSHdNREFzalJrRUVka0VCY1VFQlJnUkFFSFFRZ3dFRkkwaEJBV3BCLy84RGNTUklDMEVJRHdzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SWdFalIwRUFFSDhqUnlBQmFrSC8vd054SWdCQmdQNERjVUVJZFNSRUlBQkIvd0Z4SkVWQkFCQjdRUWdQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElpQUJDQUFVSC9BWEVrUHd3R0N5TkhRUUZyUWYvL0EzRWtSMEVJRHdzalAwRUJFSGtqUDBFQmFrSC9BWEVrUHlNL0JFQkJBQkI2QlVFQkVIb0xRUUFRZXd3SEN5TS9RWDhRZVNNL1FRRnJRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQVJCN0RBWUxFSFJCL3dGeEpEOE1CQXRCQUJCN1FRQVFlQ05HUVFSMlFRRnhRUUJMQkVCQkFCQjhCVUVCRUh3TERBUUxRWDhQQ3lBQVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpFUWdBRUgvQVhFa1JRd0NDeUFBUWYvL0EzRWdBUkIyREFFTEkwaEJBV3BCLy84RGNTUklDMEVFQytRQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBQkhCRUFnQUVIQkFFWU5BUUpBSUFCQndnQnJEZzREQkFVR0J3Z0pFUW9MREEwT0R3QUxEQThMREE4TEkwRWtRQXdPQ3lOQ0pFQU1EUXNqUXlSQURBd0xJMFFrUUF3TEN5TkZKRUFNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JBREFrTEl6OGtRQXdJQ3lOQUpFRU1Cd3NqUWlSQkRBWUxJME1rUVF3RkN5TkVKRUVNQkFzalJTUkJEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtRUXdDQ3lNL0pFRU1BUXRCZnc4TFFRUUwzd0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUJIQkVBZ0FFSFJBRVlOQVFKQUlBQkIwZ0JyRGc0UUF3UUZCZ2NJQ1FvUUN3d05EZ0FMREE0TEkwQWtRZ3dPQ3lOQkpFSU1EUXNqUXlSQ0RBd0xJMFFrUWd3TEN5TkZKRUlNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JDREFrTEl6OGtRZ3dJQ3lOQUpFTU1Cd3NqUVNSRERBWUxJMElrUXd3RkN5TkVKRU1NQkFzalJTUkREQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtRd3dDQ3lNL0pFTU1BUXRCZnc4TFFRUUwzd0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUJIQkVBZ0FFSGhBRVlOQVFKQUlBQkI0Z0JyRGc0REJCQUZCZ2NJQ1FvTERCQU5EZ0FMREE0TEkwQWtSQXdPQ3lOQkpFUU1EUXNqUWlSRURBd0xJME1rUkF3TEN5TkZKRVFNQ2dzalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUlBQlFmOEJjU1JFREFrTEl6OGtSQXdJQ3lOQUpFVU1Cd3NqUVNSRkRBWUxJMElrUlF3RkN5TkRKRVVNQkFzalJDUkZEQU1MSTBWQi93RnhJMFJCL3dGeFFRaDBjaENBQVVIL0FYRWtSUXdDQ3lNL0pFVU1BUXRCZnc4TFFRUUw3QUlBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUVjRVFDQUFRZkVBUmcwQkFrQWdBRUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhSQUFzTUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUkwQVFkZ3dQQ3lORlFmOEJjU05FUWY4QmNVRUlkSElqUVJCMkRBNExJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpTkNFSFlNRFFzalJVSC9BWEVqUkVIL0FYRkJDSFJ5STBNUWRnd01DeU5GUWY4QmNTTkVRZjhCY1VFSWRISWpSQkIyREFzTEkwVkIvd0Z4STBSQi93RnhRUWgwY2lORkVIWU1DZ3NqeFFGRkJFQUNRQ09aQVFSQVFRRWtTZ3dCQ3lOK0k0UUJjVUVmY1VVRVFFRUJKRXNNQVF0QkFTUk1Dd3NNQ1FzalJVSC9BWEVqUkVIL0FYRkJDSFJ5SXo4UWRnd0lDeU5BSkQ4TUJ3c2pRU1EvREFZTEkwSWtQd3dGQ3lOREpEOE1CQXNqUkNRL0RBTUxJMFVrUHd3Q0N5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRkIvd0Z4SkQ4TUFRdEJmdzhMUVFRTFNRRUJmeUFCUVFCT0JFQWdBRUgvQVhFZ0FDQUJha0gvQVhGTEJFQkJBUkI4QlVFQUVId0xCU0FCUVI5MUlnSWdBU0FDYW5NZ0FFSC9BWEZLQkVCQkFSQjhCVUVBRUh3TEN3czBBUUYvSXo4Z0FFSC9BWEVpQVJCNUl6OGdBUkNMQVNNL0lBQnFRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN0Myd0JBbjhqUHlBQWFpTkdRUVIyUVFGeGFrSC9BWEVpQVNFQ0l6OGdBSE1nQVhOQkVIRUVRRUVCRUhnRlFRQVFlQXNqUHlBQVFmOEJjV29qUmtFRWRrRUJjV3BCZ0FKeFFRQkxCRUJCQVJCOEJVRUFFSHdMSUFJa1B5TS9CRUJCQUJCNkJVRUJFSG9MUVFBUWV3dnhBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUNJQlFZQUJSd1JBSUFGQmdRRnJEZzhCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU5BRUl3QkRCQUxJMEVRakFFTUR3c2pRaENNQVF3T0N5TkRFSXdCREEwTEkwUVFqQUVNREFzalJSQ01BUXdMQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FFUWpBRU1DZ3NqUHhDTUFRd0pDeU5BRUkwQkRBZ0xJMEVRalFFTUJ3c2pRaENOQVF3R0N5TkRFSTBCREFVTEkwUVFqUUVNQkFzalJSQ05BUXdEQ3lORlFmOEJjU05FUWY4QmNVRUlkSElRZ0FFUWpRRU1BZ3NqUHhDTkFRd0JDMEYvRHd0QkJBczNBUUYvSXo4Z0FFSC9BWEZCZjJ3aUFSQjVJejhnQVJDTEFTTS9JQUJyUWY4QmNTUS9JejhFUUVFQUVIb0ZRUUVRZWd0QkFSQjdDMndCQW44alB5QUFheU5HUVFSMlFRRnhhMEgvQVhFaUFTRUNJejhnQUhNZ0FYTkJFSEVFUUVFQkVIZ0ZRUUFRZUFzalB5QUFRZjhCY1dzalJrRUVka0VCY1d0QmdBSnhRUUJMQkVCQkFSQjhCVUVBRUh3TElBSWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRRVFld3Z4QVFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FDSUJRWkFCUndSQUlBRkJrUUZyRGc4QkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lOQUVJOEJEQkFMSTBFUWp3RU1Ed3NqUWhDUEFRd09DeU5ERUk4QkRBMExJMFFRandFTURBc2pSUkNQQVF3TEN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFqd0VNQ2dzalB4Q1BBUXdKQ3lOQUVKQUJEQWdMSTBFUWtBRU1Cd3NqUWhDUUFRd0dDeU5ERUpBQkRBVUxJMFFRa0FFTUJBc2pSUkNRQVF3REN5TkZRZjhCY1NORVFmOEJjVUVJZEhJUWdBRVFrQUVNQWdzalB4Q1FBUXdCQzBGL0R3dEJCQXNqQUNNL0lBQnhKRDhqUHdSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQVJCNFFRQVFmQXNuQUNNL0lBQnpRZjhCY1NRL0l6OEVRRUVBRUhvRlFRRVFlZ3RCQUJCN1FRQVFlRUVBRUh3TDhRRUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFpQVVHZ0FVY0VRQ0FCUWFFQmF3NFBBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2pRQkNTQVF3UUN5TkJFSklCREE4TEkwSVFrZ0VNRGdzalF4Q1NBUXdOQ3lORUVKSUJEQXdMSTBVUWtnRU1Dd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCRUpJQkRBb0xJejhRa2dFTUNRc2pRQkNUQVF3SUN5TkJFSk1CREFjTEkwSVFrd0VNQmdzalF4Q1RBUXdGQ3lORUVKTUJEQVFMSTBVUWt3RU1Bd3NqUlVIL0FYRWpSRUgvQVhGQkNIUnlFSUFCRUpNQkRBSUxJejhRa3dFTUFRdEJmdzhMUVFRTEp3QWpQeUFBY2tIL0FYRWtQeU0vQkVCQkFCQjZCVUVCRUhvTFFRQVFlMEVBRUhoQkFCQjhDeThCQVg4alB5QUFRZjhCY1VGL2JDSUJFSGtqUHlBQkVJc0JJejhnQVdvRVFFRUFFSG9GUVFFUWVndEJBUkI3Qy9FQkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFJZ0ZCc0FGSEJFQWdBVUd4QVdzT0R3RUNBd1FGQmdjSUNRb0xEQTBPRHhBTEkwQVFsUUVNRUFzalFSQ1ZBUXdQQ3lOQ0VKVUJEQTRMSTBNUWxRRU1EUXNqUkJDVkFRd01DeU5GRUpVQkRBc0xJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBUkNWQVF3S0N5TS9FSlVCREFrTEkwQVFsZ0VNQ0FzalFSQ1dBUXdIQ3lOQ0VKWUJEQVlMSTBNUWxnRU1CUXNqUkJDV0FRd0VDeU5GRUpZQkRBTUxJMFZCL3dGeEkwUkIvd0Z4UVFoMGNoQ0FBUkNXQVF3Q0N5TS9FSllCREFFTFFYOFBDMEVFQ3pzQkFYOGdBQkJSSWdGQmYwWUVmeUFBRUFFRklBRUxRZjhCY1NBQVFRRnFJZ0VRVVNJQVFYOUdCSDhnQVJBQkJTQUFDMEgvQVhGQkNIUnlDd3NBUVFnUWN5QUFFSmdCQzBNQUlBQkJnQUZ4UVlBQlJnUkFRUUVRZkFWQkFCQjhDeUFBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBQUxRUUFnQUVFQmNVRUFTd1JBUVFFUWZBVkJBQkI4Q3lBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFaUFBUkFRUUFRZWdWQkFSQjZDMEVBRUh0QkFCQjRJQUFMVHdFQmYwRUJRUUFnQUVHQUFYRkJnQUZHR3lFQkkwWkJCSFpCQVhFZ0FFRUJkSEpCL3dGeElRQWdBUVJBUVFFUWZBVkJBQkI4Q3lBQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIZ2dBQXRRQVFGL1FRRkJBQ0FBUVFGeFFRRkdHeUVCSTBaQkJIWkJBWEZCQjNRZ0FFSC9BWEZCQVhaeUlRQWdBUVJBUVFFUWZBVkJBQkI4Q3lBQUJFQkJBQkI2QlVFQkVIb0xRUUFRZTBFQUVIZ2dBQXRHQVFGL1FRRkJBQ0FBUVlBQmNVR0FBVVliSVFFZ0FFRUJkRUgvQVhFaEFDQUJCRUJCQVJCOEJVRUFFSHdMSUFBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUFDMTRCQW45QkFVRUFJQUJCQVhGQkFVWWJJUUZCQVVFQUlBQkJnQUZ4UVlBQlJoc2hBaUFBUWY4QmNVRUJkaUlBUVlBQmNpQUFJQUliSWdBRVFFRUFFSG9GUVFFUWVndEJBQkI3UVFBUWVDQUJCRUJCQVJCOEJVRUFFSHdMSUFBTE1BQWdBRUVQY1VFRWRDQUFRZkFCY1VFRWRuSWlBQVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBQkI0UVFBUWZDQUFDMElCQVg5QkFVRUFJQUJCQVhGQkFVWWJJUUVnQUVIL0FYRkJBWFlpQUFSQVFRQVFlZ1ZCQVJCNkMwRUFFSHRCQUJCNElBRUVRRUVCRUh3RlFRQVFmQXNnQUFza0FFRUJJQUIwSUFGeFFmOEJjUVJBUVFBUWVnVkJBUkI2QzBFQUVIdEJBUkI0SUFFTG53Z0JCbjhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQ0c4aUJpSUZCRUFnQlVFQmF3NEhBUUlEQkFVR0J3Z0xJMEFoQVF3SEN5TkJJUUVNQmdzalFpRUJEQVVMSTBNaEFRd0VDeU5FSVFFTUF3c2pSU0VCREFJTEkwVkIvd0Z4STBSQi93RnhRUWgwY2hDQUFTRUJEQUVMSXo4aEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRklnUUVRQ0FFUVFGckRnOEJBZ01FQlFZSENBa0tDd3dORGc4UUN5QUFRUWRNQkg5QkFTRUNJQUVRbWdFRklBQkJEMHdFZjBFQklRSWdBUkNiQVFWQkFBc0xJUU1NRHdzZ0FFRVhUQVIvUVFFaEFpQUJFSndCQlNBQVFSOU1CSDlCQVNFQ0lBRVFuUUVGUVFBTEN5RUREQTRMSUFCQkowd0VmMEVCSVFJZ0FSQ2VBUVVnQUVFdlRBUi9RUUVoQWlBQkVKOEJCVUVBQ3dzaEF3d05DeUFBUVRkTUJIOUJBU0VDSUFFUW9BRUZJQUJCUDB3RWYwRUJJUUlnQVJDaEFRVkJBQXNMSVFNTURBc2dBRUhIQUV3RWYwRUJJUUpCQUNBQkVLSUJCU0FBUWM4QVRBUi9RUUVoQWtFQklBRVFvZ0VGUVFBTEN5RUREQXNMSUFCQjF3Qk1CSDlCQVNFQ1FRSWdBUkNpQVFVZ0FFSGZBRXdFZjBFQklRSkJBeUFCRUtJQkJVRUFDd3NoQXd3S0N5QUFRZWNBVEFSL1FRRWhBa0VFSUFFUW9nRUZJQUJCN3dCTUJIOUJBU0VDUVFVZ0FSQ2lBUVZCQUFzTElRTU1DUXNnQUVIM0FFd0VmMEVCSVFKQkJpQUJFS0lCQlNBQVFmOEFUQVIvUVFFaEFrRUhJQUVRb2dFRlFRQUxDeUVEREFnTElBQkJod0ZNQkg5QkFTRUNJQUZCZm5FRklBQkJqd0ZNQkg5QkFTRUNJQUZCZlhFRlFRQUxDeUVEREFjTElBQkJsd0ZNQkg5QkFTRUNJQUZCZTNFRklBQkJud0ZNQkg5QkFTRUNJQUZCZDNFRlFRQUxDeUVEREFZTElBQkJwd0ZNQkg5QkFTRUNJQUZCYjNFRklBQkJyd0ZNQkg5QkFTRUNJQUZCWDNFRlFRQUxDeUVEREFVTElBQkJ0d0ZNQkg5QkFTRUNJQUZCdjM5eEJTQUFRYjhCVEFSL1FRRWhBaUFCUWY5K2NRVkJBQXNMSVFNTUJBc2dBRUhIQVV3RWYwRUJJUUlnQVVFQmNnVWdBRUhQQVV3RWYwRUJJUUlnQVVFQ2NnVkJBQXNMSVFNTUF3c2dBRUhYQVV3RWYwRUJJUUlnQVVFRWNnVWdBRUhmQVV3RWYwRUJJUUlnQVVFSWNnVkJBQXNMSVFNTUFnc2dBRUhuQVV3RWYwRUJJUUlnQVVFUWNnVWdBRUh2QVV3RWYwRUJJUUlnQVVFZ2NnVkJBQXNMSVFNTUFRc2dBRUgzQVV3RWYwRUJJUUlnQVVIQUFISUZJQUJCL3dGTUJIOUJBU0VDSUFGQmdBRnlCVUVBQ3dzaEF3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBWWlCQVJBSUFSQkFXc09Cd0VDQXdRRkJnY0lDeUFESkVBTUJ3c2dBeVJCREFZTElBTWtRZ3dGQ3lBREpFTU1CQXNnQXlSRURBTUxJQU1rUlF3Q0N5QUZRUVJJSWdRRWZ5QUVCU0FGUVFkS0N3UkFJMFZCL3dGeEkwUkIvd0Z4UVFoMGNpQURFSFlMREFFTElBTWtQd3RCQkVGL0lBSWJDKzREQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhBQVVjRVFDQUFRY0VCYXc0UEFRSVJBd1FGQmdjSUNRb0xFQXdORGdzalJrRUhka0VCY1EwUkRBNExJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUkFJQUJCL3dGeEpFRkJCQThMSTBaQkIzWkJBWEVORVF3T0N5TkdRUWQyUVFGeERSQU1EQXNqUjBFQ2EwSC8vd054SkVjalJ5TkJRZjhCY1NOQVFmOEJjVUVJZEhJUWZnd05DeEIwRUl3QkRBMExJMGRCQW10Qi8vOERjU1JISTBjalNCQitRUUFrU0F3TEN5TkdRUWQyUVFGeFFRRkhEUW9NQndzalJ4Q1pBVUgvL3dOeEpFZ2pSMEVDYWtILy93TnhKRWNNQ1FzalJrRUhka0VCY1VFQlJnMEhEQW9MRUhSQi93RnhFS01CSVFBalNFRUJha0gvL3dOeEpFZ2dBQThMSTBaQkIzWkJBWEZCQVVjTkNDTkhRUUpyUWYvL0EzRWtSeU5ISTBoQkFtcEIvLzhEY1JCK0RBVUxFSFFRalFFTUJnc2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJDQ1JJREFRTFFYOFBDeU5IRUprQlFmLy9BM0VrU0NOSFFRSnFRZi8vQTNFa1IwRU1Ed3NqUjBFQ2EwSC8vd054SkVjalJ5TklRUUpxUWYvL0EzRVFmZ3NRZFVILy93TnhKRWdMUVFnUEN5TklRUUZxUWYvL0EzRWtTRUVFRHdzalNFRUNha0gvL3dOeEpFaEJEQXZUQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBVWNFUUNBQVFkRUJhdzRQQVFJTkF3UUZCZ2NJQ1EwS0RRc01EUXNqUmtFRWRrRUJjUTBQREEwTEkwY1FtUUZCLy84RGNTRUFJMGRCQW1wQi8vOERjU1JISUFCQmdQNERjVUVJZFNSQ0lBQkIvd0Z4SkVOQkJBOExJMFpCQkhaQkFYRU5Ed3dNQ3lOR1FRUjJRUUZ4RFE0alIwRUNhMEgvL3dOeEpFY2pSeU5JUVFKcVFmLy9BM0VRZmd3TEN5TkhRUUpyUWYvL0EzRWtSeU5ISTBOQi93RnhJMEpCL3dGeFFRaDBjaEIrREFzTEVIUVFqd0VNQ3dzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1QkVDUklEQWtMSTBaQkJIWkJBWEZCQVVjTkNBd0dDeU5IRUprQlFmLy9BM0VrU0VFQkpKb0JJMGRCQW1wQi8vOERjU1JIREFjTEkwWkJCSFpCQVhGQkFVWU5CUXdJQ3lOR1FRUjJRUUZ4UVFGSERRY2pSMEVDYTBILy93TnhKRWNqUnlOSVFRSnFRZi8vQTNFUWZnd0VDeEIwRUpBQkRBVUxJMGRCQW10Qi8vOERjU1JISTBjalNCQitRUmdrU0F3REMwRi9Ed3NqUnhDWkFVSC8vd054SkVnalIwRUNha0gvL3dOeEpFZEJEQThMRUhWQi8vOERjU1JJQzBFSUR3c2pTRUVCYWtILy93TnhKRWhCQkE4TEkwaEJBbXBCLy84RGNTUklRUXdMOEFJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFXc09Ed0VDQ3dzREJBVUdCd2dMQ3dzSkNnc0xFSFJCL3dGeFFZRCtBMm9qUHhCMkRBc0xJMGNRbVFGQi8vOERjU0VBSTBkQkFtcEIvLzhEY1NSSElBQkJnUDREY1VFSWRTUkVJQUJCL3dGeEpFVkJCQThMSTBGQmdQNERhaU0vRUhaQkJBOExJMGRCQW10Qi8vOERjU1JISTBjalJVSC9BWEVqUkVIL0FYRkJDSFJ5RUg1QkNBOExFSFFRa2dFTUJ3c2pSMEVDYTBILy93TnhKRWNqUnlOSUVINUJJQ1JJUVFnUEN4QjBFSUlCUVJoMFFSaDFJUUFqUnlBQVFRRVFmeU5ISUFCcVFmLy9BM0VrUjBFQUVIcEJBQkI3STBoQkFXcEIvLzhEY1NSSVFRd1BDeU5GUWY4QmNTTkVRZjhCY1VFSWRISWtTRUVFRHdzUWRVSC8vd054SXo4UWRpTklRUUpxUWYvL0EzRWtTRUVFRHdzUWRCQ1RBUXdDQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFb0pFaEJDQThMUVg4UEN5TklRUUZxUWYvL0EzRWtTRUVFQzZjREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQlJ3UkFJQUJCOFFGckRnOEJBZ01OQkFVR0J3Z0pDZzBOQ3d3TkN4QjBRZjhCY1VHQS9nTnFFSUFCUWY4QmNTUS9EQTBMSTBjUW1RRkIvLzhEY1NFQUkwZEJBbXBCLy84RGNTUkhJQUJCZ1A0RGNVRUlkU1EvSUFCQi93RnhKRVlNRFFzalFVR0EvZ05xRUlBQlFmOEJjU1EvREF3TFFRQWttUUVNQ3dzalIwRUNhMEgvL3dOeEpFY2pSeU5HUWY4QmNTTS9RZjhCY1VFSWRISVFma0VJRHdzUWRCQ1ZBUXdJQ3lOSFFRSnJRZi8vQTNFa1J5TkhJMGdRZmtFd0pFaEJDQThMRUhRUWdnRWhBRUVBRUhwQkFCQjdJMGNnQUVFWWRFRVlkU0lBUVFFUWZ5TkhJQUJxUWYvL0EzRWlBRUdBL2dOeFFRaDFKRVFnQUVIL0FYRWtSU05JUVFGcVFmLy9BM0VrU0VFSUR3c2pSVUgvQVhFalJFSC9BWEZCQ0hSeUpFZEJDQThMRUhWQi8vOERjUkNBQVVIL0FYRWtQeU5JUVFKcVFmLy9BM0VrU0F3RkMwRUJKSm9CREFRTEVIUVFsZ0VNQWdzalIwRUNhMEgvL3dOeEpFY2pSeU5JRUg1Qk9DUklRUWdQQzBGL0R3c2pTRUVCYWtILy93TnhKRWdMUVFRTDNBRUJBWDhqU0VFQmFrSC8vd054SkVnalRBUkFJMGhCQVd0Qi8vOERjU1JJQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRTSUJCRUFnQVVFQlJnMEJBa0FnQVVFQ2F3NE5Bd1FGQmdjSUNRb0xEQTBPRHdBTERBOExJQUFRZ1FFUEN5QUFFSVFCRHdzZ0FCQ0ZBUThMSUFBUWhnRVBDeUFBRUljQkR3c2dBQkNJQVE4TElBQVFpUUVQQ3lBQUVJb0JEd3NnQUJDT0FROExJQUFRa1FFUEN5QUFFSlFCRHdzZ0FCQ1hBUThMSUFBUXBBRVBDeUFBRUtVQkR3c2dBQkNtQVE4TElBQVFwd0VMd2dFQkFuOUJBQ1NaQVVHUC9nTVFBVUVCSUFCMFFYOXpjU0lCSklRQlFZLytBeUFCRUFRalIwRUNhMEgvL3dOeEpFY0NRQ05LSWdFalN5QUJHdzBBQ3lOSElnRWpTQ0lDUWY4QmNSQUVJQUZCQVdvZ0FrR0EvZ054UVFoMUVBUUNRQUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVDUUNBQVFRSnJEZ01EQkFVQUN3d0ZDMEVBSkg5QndBQWtTQXdFQzBFQUpJQUJRY2dBSkVnTUF3dEJBQ1NCQVVIUUFDUklEQUlMUVFBa2dnRkIyQUFrU0F3QkMwRUFKSU1CUWVBQUpFZ0xDL2tCQVFOL0k1b0JCRUJCQVNTWkFVRUFKSm9CQ3lOK0k0UUJjVUVmY1VFQVNnUkFJMHRGSTVrQklnSWdBaHNFZnlOL0kza2lBQ0FBR3dSL1FRQVFxUUZCQVFVamdBRWplaUlBSUFBYkJIOUJBUkNwQVVFQkJTT0JBU043SWdBZ0FCc0VmMEVDRUtrQlFRRUZJNElCSTN3aUFDQUFHd1IvUVFNUXFRRkJBUVVqZ3dFamZTSUFJQUFiQkg5QkJCQ3BBVUVCQlVFQUN3c0xDd3NGUVFBTEJFQUNmMEVCSTBvaUFDTkxJQUFiRFFBYVFRQUxCSDlCQUNSTFFRQWtTa0VBSkV4QkFDUk5RUmdGUVJRTElRRUxBbjlCQVNOS0lnQWpTeUFBR3cwQUdrRUFDd1JBUVFBa1MwRUFKRXBCQUNSTVFRQWtUUXNnQVE4TFFRQUx1UUVCQW45QkFTUXRJMHdFUUNOSUVBRkIvd0Z4RUtnQkVITkJBQ1JMUVFBa1NrRUFKRXhCQUNSTkN4Q3FBU0lCUVFCS0JFQWdBUkJ6QzBFRUlRQUNmMEVCSTBvaUFTTkxJQUViRFFBYVFRQUxSU0lCQkg4alRVVUZJQUVMQkVBalNCQUJRZjhCY1JDb0FTRUFDeU5HUWZBQmNTUkdJQUJCQUV3RVFDQUFEd3NnQUJCekk1Y0JRUUZxSkpjQkk1Y0JJNVVCVGdSQUk1WUJRUUZxSkpZQkk1Y0JJNVVCYXlTWEFRc2pTQ09MQWtZRVFFRUJKTUVCQ3lBQUN3UUFJMm9MMGdFQkJIOGdBRUYvUVlBSUlBQkJBRWdiSUFCQkFFb2JJUU5CQUNFQUEwQUNmd0ovSUFSRklnRUVRQ0FBUlNFQkN5QUJDd1JBSUFKRklRRUxJQUVMQkVBandRRkZJUUVMSUFFRVFCQ3JBVUVBU0FSQVFRRWhCQVVqU1NNK0JIOUJvTWtJQlVIUXBBUUxUZ1JBUVFFaEFBVWdBMEYvU2lJQkJFQWphaUFEVGlFQkMwRUJJQUlnQVJzaEFnc0xEQUVMQ3lBQUJFQWpTU00rQkg5Qm9Na0lCVUhRcEFRTGF5UkpJNHdDRHdzZ0FnUkFJNDBDRHdzandRRUVRRUVBSk1FQkk0NENEd3NqU0VFQmEwSC8vd054SkVoQmZ3c0hBRUYvRUswQkN6a0JBMzhEUUNBQ0lBQklJZ01FZnlBQlFRQk9CU0FEQ3dSQVFYOFFyUUVoQVNBQ1FRRnFJUUlNQVFzTElBRkJBRWdFUUNBQkR3dEJBQXNGQUNPU0FRc0ZBQ09UQVFzRkFDT1VBUXRmQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBQ0lCUVFGR0RRRUNRQ0FCUVFKckRnWURCQVVHQndnQUN3d0lDeVBzQVE4TEkrMEJEd3NqN2dFUEN5UHZBUThMSS9BQkR3c2o4UUVQQ3lQeUFROExJL01CRHd0QkFBdUxBUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQWlBa0VCUmcwQkFrQWdBa0VDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBVUVBUnlUc0FRd0hDeUFCUVFCSEpPMEJEQVlMSUFGQkFFY2s3Z0VNQlFzZ0FVRUFSeVR2QVF3RUN5QUJRUUJISlBBQkRBTUxJQUZCQUVjazhRRU1BZ3NnQVVFQVJ5VHlBUXdCQ3lBQlFRQkhKUE1CQ3d0VUFRRi9RUUFrVFNBQUVMTUJSUVJBUVFFaEFRc2dBRUVCRUxRQklBRUVRRUVCUVFGQkFFRUJRUUFnQUVFRFRCc2lBU08vQVNJQUlBQWJHeUFCUlNQQUFTSUFJQUFiR3dSQVFRRWtnd0ZCQkJBNkN3c0xDUUFnQUVFQUVMUUJDNW9CQUNBQVFRQktCRUJCQUJDMUFRVkJBQkMyQVFzZ0FVRUFTZ1JBUVFFUXRRRUZRUUVRdGdFTElBSkJBRW9FUUVFQ0VMVUJCVUVDRUxZQkN5QURRUUJLQkVCQkF4QzFBUVZCQXhDMkFRc2dCRUVBU2dSQVFRUVF0UUVGUVFRUXRnRUxJQVZCQUVvRVFFRUZFTFVCQlVFRkVMWUJDeUFHUVFCS0JFQkJCaEMxQVFWQkJoQzJBUXNnQjBFQVNnUkFRUWNRdFFFRlFRY1F0Z0VMQ3djQUlBQWtpd0lMQndCQmZ5U0xBZ3NIQUNBQUpNa0JDd2NBUVg4a3lRRUxCd0FnQUNUMEFRc0hBRUYvSlBRQkN3UUFJejhMQkFBalFBc0VBQ05CQ3dRQUkwSUxCQUFqUXdzRUFDTkVDd1FBSTBVTEJBQWpSZ3NFQUNOSUN3UUFJMGNMQmdBalNCQUJDd1FBSTFZTHJ3TUJDbjlCZ0lBQ1FZQ1FBaU81QVJzaENVR0F1QUpCZ0xBQ0k3b0JHeUVLQTBBZ0JVR0FBa2dFUUVFQUlRUURRQ0FFUVlBQ1NBUkFJQWtnQlVFRGRVRUZkQ0FLYWlBRVFRTjFhaUlEUVlDUWZtb3RBQUFRTENFSUlBVkJDRzhoQVVFSElBUkJDRzlySVFaQkFDRUNBbjhnQUVFQVNpTTZJZ2NnQnhzRVFDQURRWURRZm1vdEFBQWhBZ3NnQWtIQUFIRUxCRUJCQnlBQmF5RUJDMEVBSVFjZ0FVRUJkQ0FJYWlJRFFZQ1FmbXBCQVVFQUlBSkJDSEViSWdkQkFYRkJEWFJxTFFBQUlRaEJBQ0VCSUFOQmdaQithaUFIUVFGeFFRMTBhaTBBQUVFQklBWjBjUVJBUVFJaEFRc2dBVUVCYWlBQlFRRWdCblFnQ0hFYklRRWdCVUVJZENBRWFrRURiQ0VHSUFCQkFFb2pPaUlESUFNYkJFQWdBa0VIY1NBQlFRQVFMU0lCUVI5eFFRTjBJUU1nQmtHQW9RdHFJZ0lnQXpvQUFDQUNRUUZxSUFGQjRBZHhRUVYxUVFOME9nQUFJQUpCQW1vZ0FVR0ErQUZ4UVFwMVFRTjBPZ0FBQlNBQlFjZitBMEVBRUM0aEFrRUFJUUVEUUNBQlFRTklCRUFnQmtHQW9RdHFJQUZxSUFJNkFBQWdBVUVCYWlFQkRBRUxDd3NnQkVFQmFpRUVEQUVMQ3lBRlFRRnFJUVVNQVFzTEM5b0RBUXgvQTBBZ0EwRVhUa1VFUUVFQUlRSURRQ0FDUVI5SUJFQkJBVUVBSUFKQkQwb2JJUWtnQTBFUGF5QURJQU5CRDBvYlFRUjBJZ2NnQWtFUGEyb2dBaUFIYWlBQ1FROUtHeUVIUVlDUUFrR0FnQUlnQTBFUFNoc2hDMEhIL2dNaENrRi9JUUZCZnlFSVFRQWhCQU5BSUFSQkNFZ0VRRUVBSVFBRFFDQUFRUVZJQkVBZ0FFRURkQ0FFYWtFQ2RDSUZRWUw4QTJvUUFTQUhSZ1JBSUFWQmcvd0RhaEFCSVFaQkFVRUFJQVpCQ0hGQkFFY2pPaU02R3hzZ0NVWUVRRUVJSVFSQkJTRUFJQVlpQ0VFUWNRUi9RY24rQXdWQnlQNERDeUVLQ3dzZ0FFRUJhaUVBREFFTEN5QUVRUUZxSVFRTUFRc0xJQWhCQUVnak9pSUdJQVliQkVCQmdMZ0NRWUN3QWlPNkFSc2hCRUYvSVFCQkFDRUJBMEFnQVVFZ1NBUkFRUUFoQlFOQUlBVkJJRWdFUUNBRlFRVjBJQVJxSUFGcUlnWkJnSkIrYWkwQUFDQUhSZ1JBUVNBaEJTQUdJUUJCSUNFQkN5QUZRUUZxSVFVTUFRc0xJQUZCQVdvaEFRd0JDd3NnQUVFQVRnUi9JQUJCZ05CK2FpMEFBQVZCZndzaEFRdEJBQ0VBQTBBZ0FFRUlTQVJBSUFjZ0N5QUpRUUJCQnlBQUlBSkJBM1FnQTBFRGRDQUFha0g0QVVHQW9SY2dDaUFCSUFnUUx4b2dBRUVCYWlFQURBRUxDeUFDUVFGcUlRSU1BUXNMSUFOQkFXb2hBd3dCQ3dzTG1BSUJDWDhEUUNBRVFRaE9SUVJBUVFBaEFRTkFJQUZCQlVnRVFDQUJRUU4wSUFScVFRSjBJZ0JCZ1B3RGFoQUJHaUFBUVlIOEEyb1FBUm9nQUVHQy9BTnFFQUVoQWtFQklRVWp1d0VFUUNBQ1FRSnZRUUZHQkVBZ0FrRUJheUVDQzBFQ0lRVUxJQUJCZy93RGFoQUJJUVpCQUNFSFFRRkJBQ0FHUVFoeFFRQkhJem9qT2hzYklRZEJ5UDRESVFoQnlmNERRY2orQXlBR1FSQnhHeUVJUVFBaEFBTkFJQUFnQlVnRVFFRUFJUU1EUUNBRFFRaElCRUFnQUNBQ2FrR0FnQUlnQjBFQVFRY2dBeUFFUVFOMElBRkJCSFFnQTJvZ0FFRURkR3BCd0FCQmdLRWdJQWhCZnlBR0VDOGFJQU5CQVdvaEF3d0JDd3NnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTElBUkJBV29oQkF3QkN3c0xCUUFqaGdFTEJRQWpod0VMQlFBamlBRUxHQUVCZnlPS0FTRUFJNGtCQkVBZ0FFRUVjaUVBQ3lBQUN6QUJBWDhEUUFKQUlBQkIvLzhEVGcwQUlBQkJnS0hKQkdvZ0FCQlNPZ0FBSUFCQkFXb2hBQXdCQ3d0QkFDVEJBUXNVQUQ4QVFaUUJTQVJBUVpRQlB3QnJRQUFhQ3dzREFBRUxIUUFDUUFKQUFrQWpuUUlPQWdFQ0FBc0FDMEVBSVFBTElBQVFyUUVMQndBZ0FDU2RBZ3NsQUFKQUFrQUNRQUpBSTUwQ0RnTUJBZ01BQ3dBTFFRRWhBQXRCZnlFQkN5QUJFSzBCQ3dBekVITnZkWEpqWlUxaGNIQnBibWRWVWt3aFkyOXlaUzlrYVhOMEwyTnZjbVV1ZFc1MGIzVmphR1ZrTG5kaGMyMHViV0Z3IikpLmluc3RhbmNlOwpjb25zdCBiPW5ldyBVaW50OEFycmF5KGEuZXhwb3J0cy5tZW1vcnkuYnVmZmVyKTtyZXR1cm57aW5zdGFuY2U6YSxieXRlTWVtb3J5OmIsdHlwZToiV2ViIEFzc2VtYmx5In19O2xldCByLHUsRCxjO2M9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsCldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sc3BlZWQ6MCxmcmFtZVNraXBDb3VudGVyOjAsY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kczowLG1lc3NhZ2VIYW5kbGVyOihhKT0+e2NvbnN0IGI9bihhKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5DT05ORUNUOiJHUkFQSElDUyI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGMuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSwKcShILmJpbmQodm9pZCAwLGMpLGMuZ3JhcGhpY3NXb3JrZXJQb3J0KSk6Ik1FTU9SWSI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGMubWVtb3J5V29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShLLmJpbmQodm9pZCAwLGMpLGMubWVtb3J5V29ya2VyUG9ydCkpOiJDT05UUk9MTEVSIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5jb250cm9sbGVyV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShKLmJpbmQodm9pZCAwLGMpLGMuY29udHJvbGxlcldvcmtlclBvcnQpKToiQVVESU8iPT09Yi5tZXNzYWdlLndvcmtlcklkJiYoYy5hdWRpb1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoSS5iaW5kKHZvaWQgMCxjKSxjLmF1ZGlvV29ya2VyUG9ydCkpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuSU5TVEFOVElBVEVfV0FTTTooYXN5bmMoKT0+e2xldCBhO2E9YXdhaXQgTyhwKTtjLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2Mud2FzbUJ5dGVNZW1vcnk9CmEuYnl0ZU1lbW9yeTtrKGgoe3R5cGU6YS50eXBlfSxiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIGYuQ09ORklHOmMud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KGMsYi5tZXNzYWdlLmNvbmZpZyk7Yy5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUkVTRVRfQVVESU9fUVVFVUU6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBMQVk6aWYoIWMucGF1c2VkfHwhYy53YXNtSW5zdGFuY2V8fCFjLndhc21CeXRlTWVtb3J5KXtrKGgoe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfWMucGF1c2VkPSExO2MuZnBzVGltZVN0YW1wcz1bXTt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0wO0UoYywxRTMvYy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpOwprKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBBVVNFOmMucGF1c2VkPSEwO2MudXBkYXRlSWQmJihjbGVhclRpbWVvdXQoYy51cGRhdGVJZCksYy51cGRhdGVJZD12b2lkIDApO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUlVOX1dBU01fRVhQT1JUOmE9Yi5tZXNzYWdlLnBhcmFtZXRlcnM/Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XS5hcHBseSh2b2lkIDAsYi5tZXNzYWdlLnBhcmFtZXRlcnMpOmMud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0oKTtrKGgoe3R5cGU6Zi5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046e2E9MDtsZXQgZD1jLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiLm1lc3NhZ2Uuc3RhcnQmJihhPWIubWVzc2FnZS5zdGFydCk7Yi5tZXNzYWdlLmVuZCYmKGQ9Yi5tZXNzYWdlLmVuZCk7CmE9Yy53YXNtQnl0ZU1lbW9yeS5zbGljZShhLGQpLmJ1ZmZlcjtrKGgoe3R5cGU6Zi5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSBmLkdFVF9XQVNNX0NPTlNUQU5UOmsoaCh7dHlwZTpmLkdFVF9XQVNNX0NPTlNUQU5ULHJlc3BvbnNlOmMud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmNvbnN0YW50XS52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkZPUkNFX09VVFBVVF9GUkFNRTpCKGMpO2JyZWFrO2Nhc2UgZi5TRVRfU1BFRUQ6Yy5zcGVlZD1iLm1lc3NhZ2Uuc3BlZWQ7Yy5mcHNUaW1lU3RhbXBzPVtdO2MudGltZVN0YW1wc1VudGlsUmVhZHk9NjA7dyhjKTtjLmZyYW1lU2tpcENvdW50ZXI9MDtjLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtjLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpO2JyZWFrO2Nhc2UgZi5JU19HQkM6YT0wPGMud2FzbUluc3RhbmNlLmV4cG9ydHMuaXNHQkMoKTsKayhoKHt0eXBlOmYuSVNfR0JDLHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZygiVW5rbm93biBXYXNtQm95IFdvcmtlciBtZXNzYWdlOiIsYil9fSxnZXRGUFM6KCk9PjA8Yy50aW1lU3RhbXBzVW50aWxSZWFkeT9jLnNwZWVkJiYwPGMuc3BlZWQ/Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUqYy5zcGVlZDpjLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpjLmZwc1RpbWVTdGFtcHM/Yy5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGMubWVzc2FnZUhhbmRsZXIpfSkoKTsK";

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
