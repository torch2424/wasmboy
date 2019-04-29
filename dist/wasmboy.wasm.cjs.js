'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// API For adding plugins for WasmBoy
// Should follow the Rollup Plugin API
// https://rollupjs.org/guide/en#plugins
// Plugins have the following supported hooks
// And properties
const WASMBOY_PLUGIN = {
  name: 'wasmboy-plugin REQUIRED',
  graphics: rgbaArray => {},
  // Returns undefined. Edit object in place
  audio: (audioContext, headAudioNode, channelId) => {},
  // Return AudioNode, which will be connected to the destination node eventually.
  saveState: saveStateObject => {},
  // Returns undefined. Edit object in place.
  setCanvas: canvasElement => {},
  // Returns undefined. Edit object in place.
  breakpoint: () => {},
  ready: () => {},
  play: () => {},
  pause: () => {},
  loadedAndStarted: () => {}
};

class WasmBoyPluginsService {
  constructor() {
    this.plugins = {};
    this.pluginIdCounter = 0;
  }

  addPlugin(pluginObject) {
    // Verify the plugin
    if (!pluginObject && typeof pluginObject !== 'object') {
      throw new Error('Invalid Plugin Object');
    }

    if (!pluginObject.name) {
      throw new Error('Added plugin must have a "name" property');
    } // Add the plugin to our plugin container


    const id = this.pluginIdCounter;
    this.plugins[this.pluginIdCounter] = pluginObject;
    this.pluginIdCounter++; // Return a function to remove the plugin

    return () => {
      this.removePlugin(id);
    };
  }

  removePlugin(id) {
    delete this.plugins[id];
  }

  runHook(hookConfig) {
    if (!WASMBOY_PLUGIN[hookConfig.key] || typeof WASMBOY_PLUGIN[hookConfig.key] !== 'function') {
      throw new Error('No such hook as ' + hookConfig.key);
    }

    Object.keys(this.plugins).forEach(pluginKey => {
      const plugin = this.plugins[pluginKey];

      if (plugin[hookConfig.key]) {
        let hookResponse = undefined;

        try {
          hookResponse = plugin[hookConfig.key].apply(null, hookConfig.params);
        } catch (e) {
          console.error(`There was an error running the '${hookConfig.key}' hook, on the ${plugin.name} plugin.`);
          console.error(e);
        }

        if (hookConfig.callback) {
          hookConfig.callback(hookResponse);
        }
      }
    });
  }

}

const WasmBoyPlugins = new WasmBoyPluginsService();

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

// Handles rendering graphics using the HTML5 Canvas
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
    } // Set the imageDataArray to our plugins


    WasmBoyPlugins.runHook({
      key: 'graphics',
      params: [this.imageDataArray]
    }); // Add our new imageData

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

const DEFAULT_AUDIO_LATENCY_IN_SECONDS = DEFAULT_AUDIO_LATENCY_IN_MILLI / 1000; // Seems like the super quiet popping, and the wace form spikes in the visualizer,
// are caused by the sample rate :P
// Thus need to figure out why that is.

const WASMBOY_SAMPLE_RATE = 44100;
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
    this.recordingAnchor = undefined;
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

    source.playbackRate.setValueAtTime(playbackRate, this.audioContext.currentTime); // Set up our "final node", as in the one that will be connected
    // to the destination (output)

    let finalNode = source; // Call our callback/plugins, if we have one

    if (updateAudioCallback) {
      const responseNode = updateAudioCallback(this.audioContext, finalNode, this.id);

      if (responseNode) {
        finalNode = responseNode;
      }
    } // Call our plugins


    WasmBoyPlugins.runHook({
      key: 'audio',
      params: [this.audioContext, finalNode, this.id],
      callback: hookResponse => {
        if (hookResponse) {
          finalNode.connect(hookResponse);
          finalNode = hookResponse;
        }
      }
    }); // Lastly, apply our gain node to mute/unmute

    if (this.gainNode) {
      finalNode.connect(this.gainNode);
      finalNode = this.gainNode;
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

  WasmBoyPlugins.runHook({
    key: 'saveState',
    params: [saveState]
  });
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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBKKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX0xPQ0FUSU9OLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBLKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkFVRElPX0xBVEVOQ1k6YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQpiLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gTChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gQShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTisKZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQihhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIE0oYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhaztjYXNlIGYuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfQk9PVF9ST01fTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JBTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfTE9DQVRJT04udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlNFVF9NRU1PUlk6ZD1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2QuaW5jbHVkZXMoZy5CT09UX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkJPT1RfUk9NXSksYS5XQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSxhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9SQU0pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUkFNXSksYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuR0FNRUJPWV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5HQU1FQk9ZX01FTU9SWV0pLAphLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OKSxhLndhc21JbnN0YW5jZS5leHBvcnRzLmxvYWRTdGF0ZSgpKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLlNFVF9NRU1PUllfRE9ORX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX01FTU9SWTp7ZD17dHlwZTpmLkdFVF9NRU1PUll9O2NvbnN0IGw9W107dmFyIGM9Yi5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKGMuaW5jbHVkZXMoZy5CT09UX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX0xPQ0FUSU9OLnZhbHVlT2YoKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlK2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fU0laRS52YWx1ZU9mKCkpfWVsc2UgZT1uZXcgVWludDhBcnJheTtlPWUuYnVmZmVyO2RbZy5CT09UX1JPTV09ZTtsLnB1c2goZSl9aWYoYy5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXtlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD1lJiYzPj1lP209MjA5NzE1Mjo1PD1lJiY2Pj1lP209MjYyMTQ0OjE1PD1lJiYxOT49ZT9tPTIwOTcxNTI6MjU8PWUmJjMwPj1lJiYobT04Mzg4NjA4KTtlPW0/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTittKToKbmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGU9QShhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmRbZy5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9QihhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT1jLGwucHVzaChjKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCxiLm1lc3NhZ2VJZCksbCl9fX1mdW5jdGlvbiBOKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpOwphLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB3KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEMoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gRChhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUUtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0YoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEYoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRT1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksRChhKSwhMDtOKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZDtjP3goYSxiKTooZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLApiKGQpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEMoYSk7Y29uc3QgZD17dHlwZTpmLlVQREFURUR9O2RbZy5DQVJUUklER0VfUkFNXT1BKGEpLmJ1ZmZlcjtkW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5JTlRFUk5BTF9TVEFURV09QihhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChkKSxbZFtnLkNBUlRSSURHRV9SQU1dLGRbZy5HQU1FQk9ZX01FTU9SWV0sZFtnLlBBTEVUVEVfTUVNT1JZXSxkW2cuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/ayhoKHt0eXBlOmYuQlJFQUtQT0lOVH0pKTpEKGEpfWVsc2UgayhoKHt0eXBlOmYuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHgoYSxiKXt2YXIgZD0tMTtkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbygxMDI0KTsxIT09ZCYmYihkKTtpZigxPT09ZCl7ZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXIoKTsKY29uc3QgYz1yPj11Oy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmM/KEcoYSxkKSxzZXRUaW1lb3V0KCgpPT57dyhhKTt4KGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooRyhhLGQpLHgoYSxiKSl9fWZ1bmN0aW9uIEcoYSxiKXt2YXIgZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjb25zdCBjPXt0eXBlOmYuVVBEQVRFRCxhdWRpb0J1ZmZlcjpkLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX07ZD1bZF07aWYoYS5vcHRpb25zJiZhLm9wdGlvbnMuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDFCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDJCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDNCdWZmZXI9ZTtkLnB1c2goZSk7Yj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDRCdWZmZXI9YjtkLnB1c2goYil9YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChjKSwKZCk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCl9Y29uc3QgcD0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCB2O3B8fCh2PXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgZj17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLApVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQiLEZPUkNFX09VVFBVVF9GUkFNRToiRk9SQ0VfT1VUUFVUX0ZSQU1FIixTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSxnPXtCT09UX1JPTToiQk9PVF9ST00iLENBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTsKbGV0IHQ9MCx5PXt9O2NvbnN0IEg9KGEsYik9PntsZXQgYz0iW1dhc21Cb3ldIjstOTk5OSE9PWEmJihjKz1gIDB4JHthLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1iJiYoYys9YCAweCR7Yi50b1N0cmluZygxNil9IGApO2NvbnNvbGUubG9nKGMpfSx6PXtpbmRleDp7Y29uc29sZUxvZzpILGNvbnNvbGVMb2dUaW1lb3V0OihhLGIsYyk9Pnt5W2FdfHwoeVthXT0hMCxIKGEsYiksc2V0VGltZW91dCgoKT0+e2RlbGV0ZSB5W2FdfSxjKSl9fX0sST1hc3luYyhhKT0+e2xldCBiPXZvaWQgMDtyZXR1cm4gYj1XZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZz9hd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZVN0cmVhbWluZyhmZXRjaChhKSx6KTphd2FpdCAoYXN5bmMoKT0+e2NvbnN0IGI9YXdhaXQgZmV0Y2goYSkudGhlbigoYSk9PmEuYXJyYXlCdWZmZXIoKSk7cmV0dXJuIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGIseil9KSgpfSxPPWFzeW5jKGEpPT57YT1CdWZmZXIuZnJvbShhLnNwbGl0KCIsIilbMV0sCiJiYXNlNjQiKTtyZXR1cm4gYXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYSx6KX0sUD1hc3luYyhhKT0+e2E9KGE/YXdhaXQgSSgiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJnUUVRWUFBQVlBcC9mMzkvZjM5L2YzOS9BR0FCZndGL1lBRi9BR0FDZjM4QVlBSi9md0YvWUFBQmYyQURmMzkvQUdBR2YzOS9mMzkvQUdBSGYzOS9mMzkvZndGL1lBTi9mMzhCZjJBSGYzOS9mMzkvZndCZ0JIOS9mMzhCZjJBSWYzOS9mMzkvZjM4QVlBVi9mMzkvZndGL1lBMS9mMzkvZjM5L2YzOS9mMzkvQVg4RDVRSGpBUUFDQWdBRUFBQURBd0FBQUFBQUFBQURBQUFEQXdBQUFBQUJCZ0FBQUFBQUFBQUFBd01BQUFBQUFBQUFBQVlHQmdZT0JRb0ZEd2tMQ0FnSEJBTUFBQU1BQUFBQUFBTUFBQUFBQWdJRkFnSUdBQUlDQlF3REF3TUFBZ1lDQWdRREF3TURBd01BQXdBREFBTUFBd1VEQmdZREJBSUZBd0FBQXdVRUJ3QUZBQU1BQXdNR0JnUUVBd1FEQXdNRUJBY0NBZ0lDQWdJQ0FnSUVBd01DQXdNQ0F3TUNBd01DQWdJQ0FnSUNBZ0lDQWdVQ0FnSUNBZ0lEQmdZR0FnWUNCZ1lHQWdRREF3MERBQU1BQXdBR0JnWUdCZ1lHQmdZR0JnWURBQUFHQmdZR0FBQUFBZ01GQkFRQmNBQUJCUU1CQUFBR3VneWxBbjhBUVFBTGZ3QkJnQWdMZndCQmdBZ0xmd0JCZ0FnTGZ3QkJnQkFMZndCQmdJQUJDMzhBUVlDUUFRdC9BRUdBZ0FJTGZ3QkJnSkFEQzM4QVFZQ0FBUXQvQUVHQUVBdC9BRUdBZ0FRTGZ3QkJnSkFFQzM4QVFZQUJDMzhBUVlDUkJBdC9BRUdBdUFFTGZ3QkJnTWtGQzM4QVFZRFlCUXQvQUVHQW9Rc0xmd0JCZ0lBTUMzOEFRWUNoRnd0L0FFR0FnQWtMZndCQmdLRWdDMzhBUVlENEFBdC9BRUdBa0FRTGZ3QkJnSWtkQzM4QVFZQ1pJUXQvQUVHQWdBZ0xmd0JCZ0prcEMzOEFRWUNBQ0F0L0FFR0FtVEVMZndCQmdJQUlDMzhBUVlDWk9RdC9BRUdBZ0FnTGZ3QkJnSm5CQUF0L0FFR0FnQWdMZndCQmdKbkpBQXQvQUVHQWdBZ0xmd0JCZ0puUkFBdC9BRUdBRkF0L0FFR0FyZEVBQzM4QVFZQ0krQU1MZndCQmdMWEpCQXQvQUVILy93TUxmd0JCQUF0L0FFR0F0YzBFQzM4QVFaUUJDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQjZQNERDMzhCUWVuK0F3dC9BVUhyL2dNTGZ3RkJmd3QvQVVGL0MzOEJRUUFMZndGQndBQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhBQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVR0FBZ3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSEFBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVSC9BQXQvQVVIL0FBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQnhOZ0NDMzhCUVFBTGZ3RkJBQXQvQVVHQWdBZ0xmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVg4TGZ3RkJmd3QvQVVGL0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZEgrQXd0L0FVSFMvZ01MZndGQjAvNERDMzhCUWRUK0F3dC9BVUhWL2dNTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFjLytBd3QvQVVIdy9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZ0tqV3VRY0xmd0ZCQUF0L0FVRUFDMzhCUVlDbzFya0hDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFndC9BVUVBQzM4QlFRQUxCN3NRWVFadFpXMXZjbmtDQUFWMFlXSnNaUUVBQm1OdmJtWnBad0FaRG1oaGMwTnZjbVZUZEdGeWRHVmtBQm9KYzJGMlpWTjBZWFJsQUNFSmJHOWhaRk4wWVhSbEFDd0ZhWE5IUWtNQUxSSm5aWFJUZEdWd2MxQmxjbE4wWlhCVFpYUUFMZ3RuWlhSVGRHVndVMlYwY3dBdkNHZGxkRk4wWlhCekFEQVZaWGhsWTNWMFpVMTFiSFJwY0d4bFJuSmhiV1Z6QUxzQkRHVjRaV04xZEdWR2NtRnRaUUM2QVFoZmMyVjBZWEpuWXdEaEFSbGxlR1ZqZFhSbFJuSmhiV1ZCYm1SRGFHVmphMEYxWkdsdkFPQUJGV1Y0WldOMWRHVlZiblJwYkVOdmJtUnBkR2x2YmdEaUFRdGxlR1ZqZFhSbFUzUmxjQUMzQVJSblpYUkRlV05zWlhOUVpYSkRlV05zWlZObGRBQzhBUXhuWlhSRGVXTnNaVk5sZEhNQXZRRUpaMlYwUTNsamJHVnpBTDRCRG5ObGRFcHZlWEJoWkZOMFlYUmxBTU1CSDJkbGRFNTFiV0psY2s5bVUyRnRjR3hsYzBsdVFYVmthVzlDZFdabVpYSUF1QUVRWTJ4bFlYSkJkV1JwYjBKMVptWmxjZ0FvSEhObGRFMWhiblZoYkVOdmJHOXlhWHBoZEdsdmJsQmhiR1YwZEdVQUJ4ZFhRVk5OUWs5WlgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNc0UxZEJVMDFDVDFsZlRVVk5UMUpaWDFOSldrVURMUkpYUVZOTlFrOVpYMWRCVTAxZlVFRkhSVk1ETGg1QlUxTkZUVUpNV1ZORFVrbFFWRjlOUlUxUFVsbGZURTlEUVZSSlQwNERBQnBCVTFORlRVSk1XVk5EVWtsUVZGOU5SVTFQVWxsZlUwbGFSUU1CRmxkQlUwMUNUMWxmVTFSQlZFVmZURTlEUVZSSlQwNERBaEpYUVZOTlFrOVpYMU5VUVZSRlgxTkpXa1VEQXlCSFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01LSEVkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVREN4SldTVVJGVDE5U1FVMWZURTlEUVZSSlQwNERCQTVXU1VSRlQxOVNRVTFmVTBsYVJRTUZFVmRQVWt0ZlVrRk5YMHhQUTBGVVNVOU9Bd1lOVjA5U1MxOVNRVTFmVTBsYVJRTUhKazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdnaVQxUklSVkpmUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZVMGxhUlFNSkdFZFNRVkJJU1VOVFgwOVZWRkJWVkY5TVQwTkJWRWxQVGdNWUZFZFNRVkJJU1VOVFgwOVZWRkJWVkY5VFNWcEZBeGtVUjBKRFgxQkJURVZVVkVWZlRFOURRVlJKVDA0RERCQkhRa05mVUVGTVJWUlVSVjlUU1ZwRkF3MFlRa2RmVUZKSlQxSkpWRmxmVFVGUVgweFBRMEZVU1U5T0F3NFVRa2RmVUZKSlQxSkpWRmxmVFVGUVgxTkpXa1VERHc1R1VrRk5SVjlNVDBOQlZFbFBUZ01RQ2taU1FVMUZYMU5KV2tVREVSZENRVU5MUjFKUFZVNUVYMDFCVUY5TVQwTkJWRWxQVGdNU0UwSkJRMHRIVWs5VlRrUmZUVUZRWDFOSldrVURFeEpVU1V4RlgwUkJWRUZmVEU5RFFWUkpUMDRERkE1VVNVeEZYMFJCVkVGZlUwbGFSUU1WRWs5QlRWOVVTVXhGVTE5TVQwTkJWRWxQVGdNV0RrOUJUVjlVU1V4RlUxOVRTVnBGQXhjVlFWVkVTVTlmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeUlSUVZWRVNVOWZRbFZHUmtWU1gxTkpXa1VESXhsRFNFRk9Ua1ZNWHpGZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXhvVlEwaEJUazVGVEY4eFgwSlZSa1pGVWw5VFNWcEZBeHNaUTBoQlRrNUZURjh5WDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01jRlVOSVFVNU9SVXhmTWw5Q1ZVWkdSVkpmVTBsYVJRTWRHVU5JUVU1T1JVeGZNMTlDVlVaR1JWSmZURTlEUVZSSlQwNERIaFZEU0VGT1RrVk1Yek5mUWxWR1JrVlNYMU5KV2tVREh4bERTRUZPVGtWTVh6UmZRbFZHUmtWU1gweFBRMEZVU1U5T0F5QVZRMGhCVGs1RlRGODBYMEpWUmtaRlVsOVRTVnBGQXlFV1EwRlNWRkpKUkVkRlgxSkJUVjlNVDBOQlZFbFBUZ01rRWtOQlVsUlNTVVJIUlY5U1FVMWZVMGxhUlFNbEVVSlBUMVJmVWs5TlgweFBRMEZVU1U5T0F5WU5RazlQVkY5U1QwMWZVMGxhUlFNbkZrTkJVbFJTU1VSSFJWOVNUMDFmVEU5RFFWUkpUMDRES0JKRFFWSlVVa2xFUjBWZlVrOU5YMU5KV2tVREtSMUVSVUpWUjE5SFFVMUZRazlaWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01xR1VSRlFsVkhYMGRCVFVWQ1QxbGZUVVZOVDFKWlgxTkpXa1VES3lGblpYUlhZWE50UW05NVQyWm1jMlYwUm5KdmJVZGhiV1ZDYjNsUFptWnpaWFFBQVJ0elpYUlFjbTluY21GdFEyOTFiblJsY2tKeVpXRnJjRzlwYm5RQXhBRWRjbVZ6WlhSUWNtOW5jbUZ0UTI5MWJuUmxja0p5WldGcmNHOXBiblFBeFFFWmMyVjBVbVZoWkVkaVRXVnRiM0o1UW5KbFlXdHdiMmx1ZEFER0FSdHlaWE5sZEZKbFlXUkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUF4d0VhYzJWMFYzSnBkR1ZIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBeUFFY2NtVnpaWFJYY21sMFpVZGlUV1Z0YjNKNVFuSmxZV3R3YjJsdWRBREpBUXhuWlhSU1pXZHBjM1JsY2tFQXlnRU1aMlYwVW1WbmFYTjBaWEpDQU1zQkRHZGxkRkpsWjJsemRHVnlRd0RNQVF4blpYUlNaV2RwYzNSbGNrUUF6UUVNWjJWMFVtVm5hWE4wWlhKRkFNNEJER2RsZEZKbFoybHpkR1Z5U0FEUEFReG5aWFJTWldkcGMzUmxja3dBMEFFTVoyVjBVbVZuYVhOMFpYSkdBTkVCRVdkbGRGQnliMmR5WVcxRGIzVnVkR1Z5QU5JQkQyZGxkRk4wWVdOclVHOXBiblJsY2dEVEFSbG5aWFJQY0dOdlpHVkJkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFOUUJCV2RsZEV4WkFOVUJIV1J5WVhkQ1lXTnJaM0p2ZFc1a1RXRndWRzlYWVhOdFRXVnRiM0o1QU5ZQkdHUnlZWGRVYVd4bFJHRjBZVlJ2VjJGemJVMWxiVzl5ZVFEWEFSTmtjbUYzVDJGdFZHOVhZWE50VFdWdGIzSjVBTmdCQm1kbGRFUkpWZ0RaQVFkblpYUlVTVTFCQU5vQkJtZGxkRlJOUVFEYkFRWm5aWFJVUVVNQTNBRVRkWEJrWVhSbFJHVmlkV2RIUWsxbGJXOXllUURkQVFnQzNnRUpDQUVBUVFBTEFkOEJDdm56QWVNQlV3QkI4dVhMQnlRNVFhREJnZ1VrT2tIWXNPRUNKRHRCaUpBZ0pEeEI4dVhMQnlROVFhREJnZ1VrUGtIWXNPRUNKRDlCaUpBZ0pFQkI4dVhMQnlSQlFhREJnZ1VrUWtIWXNPRUNKRU5CaUpBZ0pFUUxwZ0lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkRIVWlBUVJBSUFGQkFVWU5BUUpBSUFGQkFtc09EQUlDQXdNREF3UUVCUVVHQndBTERBY0xJNGdDQkVBamlRSUVRQ0FBUVlBQ1NBMEpJQUJCL3dOS0lnRUVmeUFBUVlBU1NBVWdBUXNOQ1FVamlRSkZJZ0VFZnlBQVFZQUNTQVVnQVFzTkNRc0xDeUFBUVlDdDBRQnFEd3NnQUVFQkkvTUJJZ0VqK3dGRklnQUVmeUFCUlFVZ0FBc2JRUTUwYWtHQXJkQUFhZzhMSUFCQmdKQithaU9KQWdSL0k0WUNFQUpCQVhFRlFRQUxRUTEwYWc4TElBQWo5QUZCRFhScVFZRFp4Z0JxRHdzZ0FFR0FrSDVxRHd0QkFDRUJBbjhqaVFJRVFDT0hBaEFDUVFkeElRRUxJQUZCQVVnTEJIOUJBUVVnQVF0QkRIUWdBR3BCZ1BCOWFnOExJQUJCZ0ZCcUR3c2dBRUdBbWRFQWFnc0pBQ0FBRUFFdEFBQUx3d0VBUVFBa2lnSkJBQ1NMQWtFQUpJd0NRUUFralFKQkFDU09Ba0VBSkk4Q1FRQWtrQUpCQUNTUkFrRUFKSklDUVFBa2t3SkJBQ1NVQWtFQUpKVUNRUUFrbGdKQkFDU1hBa0VBSkpnQ1FRQWttUUlqaUFJRVFBOExJNGtDQkVCQkVTU0xBa0dBQVNTU0FrRUFKSXdDUVFBa2pRSkIvd0VramdKQjFnQWtqd0pCQUNTUUFrRU5KSkVDQlVFQkpJc0NRYkFCSkpJQ1FRQWtqQUpCRXlTTkFrRUFKSTRDUWRnQkpJOENRUUVra0FKQnpRQWtrUUlMUVlBQ0pKUUNRZjcvQXlTVEFnc0xBQ0FBRUFFZ0FUb0FBQXVKQVFFQ2YwRUFKUFVCUVFFazlnRkJ4d0lRQWlJQlJTVDNBU0FCUVFGT0lnQUVRQ0FCUVFOTUlRQUxJQUFrK0FFZ0FVRUZUaUlBQkVBZ0FVRUdUQ0VBQ3lBQUpQa0JJQUZCRDA0aUFBUkFJQUZCRTB3aEFBc2dBQ1Q2QVNBQlFSbE9JZ0FFUUNBQlFSNU1JUUFMSUFBayt3RkJBU1R6QVVFQUpQUUJJNFlDUVFBUUJDT0hBa0VCRUFRTEx3QkIwZjREUWY4QkVBUkIwdjREUWY4QkVBUkIwLzREUWY4QkVBUkIxUDREUWY4QkVBUkIxZjREUWY4QkVBUUxzQWdBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQ3dNRUJRWUhDQWtLQ3d3TkFBc01EUXRCOHVYTEJ5UTVRYURCZ2dVa09rSFlzT0VDSkR0QmlKQWdKRHhCOHVYTEJ5UTlRYURCZ2dVa1BrSFlzT0VDSkQ5QmlKQWdKRUJCOHVYTEJ5UkJRYURCZ2dVa1FrSFlzT0VDSkVOQmlKQWdKRVFNREF0Qi8vLy9CeVE1UWVQYS9nY2tPa0dBNHBBRUpEdEJBQ1E4UWYvLy93Y2tQVUhqMnY0SEpENUJnT0tRQkNRL1FRQWtRRUgvLy84SEpFRkI0OXIrQnlSQ1FZRGlrQVFrUTBFQUpFUU1Dd3RCLy8vL0J5UTVRWVNKL2dja09rRzY5TkFFSkR0QkFDUThRZi8vL3dja1BVR3gvdThESkQ1QmdJZ0NKRDlCQUNSQVFmLy8vd2NrUVVIL3k0NERKRUpCL3dFa1EwRUFKRVFNQ2d0QnhjMy9CeVE1UVlTNXVnWWtPa0dwMXBFRUpEdEJpT0xvQWlROFFmLy8vd2NrUFVIajJ2NEhKRDVCZ09LUUJDUS9RUUFrUUVILy8vOEhKRUZCNDlyK0J5UkNRWURpa0FRa1EwRUFKRVFNQ1F0Qi8vLy9CeVE1UVlEK3l3SWtPa0dBaFAwSEpEdEJBQ1E4UWYvLy93Y2tQVUdBL3NzQ0pENUJnSVQ5QnlRL1FRQWtRRUgvLy84SEpFRkJnUDdMQWlSQ1FZQ0UvUWNrUTBFQUpFUU1DQXRCLy8vL0J5UTVRYkgrN3dNa09rSEZ4d0VrTzBFQUpEeEIvLy8vQnlROVFZU0ovZ2NrUGtHNjlOQUVKRDlCQUNSQVFmLy8vd2NrUVVHRWlmNEhKRUpCdXZUUUJDUkRRUUFrUkF3SEMwRUFKRGxCaElrQ0pEcEJnTHovQnlRN1FmLy8vd2NrUEVFQUpEMUJoSWtDSkQ1QmdMei9CeVEvUWYvLy93Y2tRRUVBSkVGQmhJa0NKRUpCZ0x6L0J5UkRRZi8vL3dja1JBd0dDMEdsLy84SEpEbEJsS24rQnlRNlFmK3AwZ1FrTzBFQUpEeEJwZi8vQnlROVFaU3AvZ2NrUGtIL3FkSUVKRDlCQUNSQVFhWC8vd2NrUVVHVXFmNEhKRUpCLzZuU0JDUkRRUUFrUkF3RkMwSC8vLzhISkRsQmdQNy9CeVE2UVlDQS9BY2tPMEVBSkR4Qi8vLy9CeVE5UVlEKy93Y2tQa0dBZ1B3SEpEOUJBQ1JBUWYvLy93Y2tRVUdBL3Y4SEpFSkJnSUQ4QnlSRFFRQWtSQXdFQzBILy8vOEhKRGxCZ1A3L0J5UTZRWUNVN1FNa08wRUFKRHhCLy8vL0J5UTlRZi9MamdNa1BrSC9BU1EvUVFBa1FFSC8vLzhISkVGQnNmN3ZBeVJDUVlDSUFpUkRRUUFrUkF3REMwSC8vLzhISkRsQi84dU9BeVE2UWY4QkpEdEJBQ1E4UWYvLy93Y2tQVUdFaWY0SEpENUJ1dlRRQkNRL1FRQWtRRUgvLy84SEpFRkJzZjd2QXlSQ1FZQ0lBaVJEUVFBa1JBd0NDMEgvLy84SEpEbEIzcG15QkNRNlFZeWx5UUlrTzBFQUpEeEIvLy8vQnlROVFZU0ovZ2NrUGtHNjlOQUVKRDlCQUNSQVFmLy8vd2NrUVVIajJ2NEhKRUpCZ09LUUJDUkRRUUFrUkF3QkMwSC8vLzhISkRsQnBjdVdCU1E2UWRLa3lRSWtPMEVBSkR4Qi8vLy9CeVE5UWFYTGxnVWtQa0hTcE1rQ0pEOUJBQ1JBUWYvLy93Y2tRVUdseTVZRkpFSkIwcVRKQWlSRFFRQWtSQXNMMmdnQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmlBRkhCRUFnQUVIaEFFWU5BU0FBUVJSR0RRSWdBRUhHQUVZTkF5QUFRZGtBUmcwRUlBQkJ4Z0ZHRFFRZ0FFR0dBVVlOQlNBQVFhZ0JSZzBGSUFCQnZ3RkdEUVlnQUVIT0FVWU5CaUFBUWRFQlJnMEdJQUJCOEFGR0RRWWdBRUVuUmcwSElBQkJ5UUJHRFFjZ0FFSGNBRVlOQnlBQVFiTUJSZzBISUFCQnlRRkdEUWdnQUVId0FFWU5DU0FBUWNZQVJnMEtJQUJCMHdGR0RRc01EQXRCLzdtV0JTUTVRWUQrL3dja09rR0F4Z0VrTzBFQUpEeEIvN21XQlNROVFZRCsvd2NrUGtHQXhnRWtQMEVBSkVCQi83bVdCU1JCUVlEKy93Y2tRa0dBeGdFa1EwRUFKRVFNQ3d0Qi8vLy9CeVE1UWYvTGpnTWtPa0gvQVNRN1FRQWtQRUgvLy84SEpEMUJoSW4rQnlRK1FicjAwQVFrUDBFQUpFQkIvLy8vQnlSQlFmL0xqZ01rUWtIL0FTUkRRUUFrUkF3S0MwSC8vLzhISkRsQmhJbitCeVE2UWJyMDBBUWtPMEVBSkR4Qi8vLy9CeVE5UWJIKzd3TWtQa0dBaUFJa1AwRUFKRUJCLy8vL0J5UkJRWVNKL2dja1FrRzY5TkFFSkVOQkFDUkVEQWtMUWYvcjFnVWtPVUdVLy84SEpEcEJ3clMxQlNRN1FRQWtQRUVBSkQxQi8vLy9CeVErUVlTSi9nY2tQMEc2OU5BRUpFQkJBQ1JCUWYvLy93Y2tRa0dFaWY0SEpFTkJ1dlRRQkNSRURBZ0xRZi8vL3dja09VR0UyN1lGSkRwQisrYUpBaVE3UVFBa1BFSC8vLzhISkQxQmdPYjlCeVErUVlDRTBRUWtQMEVBSkVCQi8vLy9CeVJCUWYvNzZnSWtRa0dBZ1B3SEpFTkIvd0VrUkF3SEMwR2MvLzhISkRsQi8rdlNCQ1E2UWZPb2pnTWtPMEc2OUFBa1BFSENpdjhISkQxQmdLei9CeVErUVlEMDBBUWtQMEdBZ0tnQ0pFQkIvLy8vQnlSQlFZU0ovZ2NrUWtHNjlOQUVKRU5CQUNSRURBWUxRWUQrcndNa09VSC8vLzhISkRwQnlxVDlCeVE3UVFBa1BFSC8vLzhISkQxQi8vLy9CeVErUWYvTGpnTWtQMEgvQVNSQVFmLy8vd2NrUVVIajJ2NEhKRUpCZ09LUUJDUkRRUUFrUkF3RkMwSC91WllGSkRsQmdQNy9CeVE2UVlER0FTUTdRUUFrUEVIU3h2MEhKRDFCZ0lEWUJpUStRWUNBakFNa1AwRUFKRUJCL3dFa1FVSC8vLzhISkVKQisvNy9CeVJEUWYrSkFpUkVEQVFMUWM3Ly93Y2tPVUh2MzQ4REpEcEJzWWp5QkNRN1FkcTA2UUlrUEVILy8vOEhKRDFCZ09iOUJ5UStRWUNFMFFRa1AwRUFKRUJCLy8vL0J5UkJRZi9MamdNa1FrSC9BU1JEUVFBa1JBd0RDMEgvLy84SEpEbEJoSW4rQnlRNlFicjAwQVFrTzBFQUpEeEIvLy8vQnlROVFZRCtBeVErUVlDSXhnRWtQMEdBbEFFa1FFSC8vLzhISkVGQi84dU9BeVJDUWY4QkpFTkJBQ1JFREFJTFFmLy8vd2NrT1VIL3k0NERKRHBCL3dFa08wRUFKRHhCZ1A3L0J5UTlRWUNBL0Fja1BrR0FnSXdESkQ5QkFDUkFRZi8vL3dja1FVR3gvdThESkVKQmdJZ0NKRU5CQUNSRURBRUxRZi8vL3dja09VR0UyN1lGSkRwQisrYUpBaVE3UVFBa1BFSC8vLzhISkQxQjQ5citCeVErUWVQYS9nY2tQMEVBSkVCQi8vLy9CeVJCUWYvTGpnTWtRa0gvQVNSRFFRQWtSQXNMU2dFQ2YwRUFFQWNqaVFJRVFBOExJNGdDQkVBamlRSkZCRUFQQ3d0QnRBSWhBQU5BQWtBZ0FFSERBa29OQUNBQUVBSWdBV29oQVNBQVFRRnFJUUFNQVFzTElBRkIvd0Z4RUFnTDNBRUFRUUFrN0FGQkFDVHRBVUVBSk80QlFRQWs3d0ZCQUNUd0FVRUFKUEVCUVFBazhnRkJrQUVrN2dFamlRSUVRRUhCL2dOQmdRRVFCRUhFL2dOQmtBRVFCRUhIL2dOQi9BRVFCQVZCd2Y0RFFZVUJFQVJCeHY0RFFmOEJFQVJCeC80RFFmd0JFQVJCeVA0RFFmOEJFQVJCeWY0RFFmOEJFQVFMUVpBQkpPNEJRY0QrQTBHUUFSQUVRYy8rQTBFQUVBUkI4UDREUVFFUUJDT0lBZ1JBSTRrQ0JFQkJBQ1R1QVVIQS9nTkJBQkFFUWNIK0EwR0FBUkFFUWNUK0EwRUFFQVFGUVFBazdnRkJ3UDREUVFBUUJFSEIvZ05CaEFFUUJBc0xFQWtMYmdBamlRSUVRRUhvL2dOQndBRVFCRUhwL2dOQi93RVFCRUhxL2dOQndRRVFCRUhyL2dOQkRSQUVCVUhvL2dOQi93RVFCRUhwL2dOQi93RVFCRUhxL2dOQi93RVFCRUhyL2dOQi93RVFCQXNqaVFJamlBSWppQUliQkVCQjZmNERRU0FRQkVIci9nTkJpZ0VRQkFzTFZnQkJrUDREUVlBQkVBUkJrZjREUWI4QkVBUkJrdjREUWZNQkVBUkJrLzREUWNFQkVBUkJsUDREUWI4QkVBUWppQUlFUUVHUi9nTkJQeEFFUVpMK0EwRUFFQVJCay80RFFRQVFCRUdVL2dOQnVBRVFCQXNMTEFCQmxmNERRZjhCRUFSQmx2NERRVDhRQkVHWC9nTkJBQkFFUVpqK0EwRUFFQVJCbWY0RFFiZ0JFQVFMTXdCQm12NERRZjhBRUFSQm0vNERRZjhCRUFSQm5QNERRWjhCRUFSQm5mNERRUUFRQkVHZS9nTkJ1QUVRQkVFQkpJVUJDeTBBUVovK0EwSC9BUkFFUWFEK0EwSC9BUkFFUWFIK0EwRUFFQVJCb3Y0RFFRQVFCRUdqL2dOQnZ3RVFCQXRjQUNBQVFZQUJjVUVBUnlTc0FTQUFRY0FBY1VFQVJ5U3JBU0FBUVNCeFFRQkhKS29CSUFCQkVIRkJBRWNrcVFFZ0FFRUljVUVBUnlTd0FTQUFRUVJ4UVFCSEpLOEJJQUJCQW5GQkFFY2tyZ0VnQUVFQmNVRUFSeVN0QVF0RkFFRVBKSmtCUVE4a21nRkJEeVNiQVVFUEpKd0JRUUFrblFGQkFDU2VBVUVBSko4QlFRQWtvQUZCL3dBa29RRkIvd0Frb2dGQkFTU2pBVUVCSktRQlFRQWtwUUVMdlFFQVFRQWtwZ0ZCQUNTbkFVRUFKS2dCUVFFa3FRRkJBU1NxQVVFQkpLc0JRUUVrckFGQkFTU3RBVUVCSks0QlFRRWtyd0ZCQVNTd0FVRUJKTEVCUVFBa3NnRkJBQ1N6QVVFQUpMVUJRUUFrdGdFUURCQU5FQTRRRDBHay9nTkI5d0FRQkVFSEpLY0JRUWNrcUFGQnBmNERRZk1CRUFSQjh3RVFFRUdtL2dOQjhRRVFCRUVCSkxFQkk0Z0NCRUJCcFA0RFFRQVFCRUVBSktjQlFRQWtxQUZCcGY0RFFRQVFCRUVBRUJCQnB2NERRZkFBRUFSQkFDU3hBUXNRRVFzK0FDQUFRUUZ4UVFCSEpMc0JJQUJCQW5GQkFFY2t2QUVnQUVFRWNVRUFSeVM5QVNBQVFRaHhRUUJISkw0QklBQkJFSEZCQUVja3Z3RWdBQ1M2QVFzK0FDQUFRUUZ4UVFCSEpNRUJJQUJCQW5GQkFFY2t3Z0VnQUVFRWNVRUFSeVREQVNBQVFRaHhRUUJISk1RQklBQkJFSEZCQUVja3hRRWdBQ1RBQVF0NEFFRUFKTVlCUVFBa3h3RkJBQ1RJQVVFQUpNc0JRUUFrekFGQkFDVE5BVUVBSk1rQlFRQWt5Z0VqaVFJRVFFR0UvZ05CSGhBRVFhQTlKTWNCQlVHRS9nTkJxd0VRQkVITTF3SWt4d0VMUVlmK0EwSDRBUkFFUWZnQkpNMEJJNGdDQkVBamlRSkZCRUJCaFA0RFFRQVFCRUVFSk1jQkN3c0xRd0JCQUNUT0FVRUFKTThCSTRrQ0JFQkJndjREUWZ3QUVBUkJBQ1RRQVVFQUpORUJRUUFrMGdFRlFZTCtBMEgrQUJBRVFRQWswQUZCQVNUUkFVRUFKTklCQ3d0MUFDT0pBZ1JBUWZEK0EwSDRBUkFFUWMvK0EwSCtBUkFFUWMzK0EwSCtBQkFFUVlEK0EwSFBBUkFFUVkvK0EwSGhBUkFFUWV6K0EwSCtBUkFFUWZYK0EwR1BBUkFFQlVIdy9nTkIvd0VRQkVIUC9nTkIvd0VRQkVITi9nTkIvd0VRQkVHQS9nTkJ6d0VRQkVHUC9nTkI0UUVRQkFzTG1nRUJBbjlCd3dJUUFpSUJRY0FCUmlJQUJIOGdBQVVnQVVHQUFVWWpNQ0lBSUFBYkN3UkFRUUVraVFJRlFRQWtpUUlMUVFBa293SkJnS2pXdVFja21nSkJBQ1NiQWtFQUpKd0NRWUNvMXJrSEpKMENRUUFrbmdKQkFDU2ZBaU12QkVCQkFTU0lBZ1ZCQUNTSUFnc1FBeEFGRUFZUUNoQUxFQkpCQUJBVFFmLy9BeU82QVJBRVFlRUJFQlJCai80REk4QUJFQVFRRlJBV0VCY0xTZ0FnQUVFQVNpUXZJQUZCQUVva01DQUNRUUJLSkRFZ0EwRUFTaVF5SUFSQkFFb2tNeUFGUVFCS0pEUWdCa0VBU2lRMUlBZEJBRW9rTmlBSVFRQktKRGNnQ1VFQVNpUTRFQmdMQlFBam93SUx1UUVBUVlBSUk0c0NPZ0FBUVlFSUk0d0NPZ0FBUVlJSUk0MENPZ0FBUVlNSUk0NENPZ0FBUVlRSUk0OENPZ0FBUVlVSUk1QUNPZ0FBUVlZSUk1RUNPZ0FBUVljSUk1SUNPZ0FBUVlnSUk1TUNPd0VBUVlvSUk1UUNPd0VBUVl3SUk1VUNOZ0lBUVpFSUk1WUNRUUJIT2dBQVFaSUlJNWNDUVFCSE9nQUFRWk1JSTVnQ1FRQkhPZ0FBUVpRSUk1a0NRUUJIT2dBQVFaVUlJNGdDUVFCSE9nQUFRWllJSTRrQ1FRQkhPZ0FBUVpjSUk0b0NRUUJIT2dBQUMyZ0FRY2dKSS9NQk93RUFRY29KSS9RQk93RUFRY3dKSS9VQlFRQkhPZ0FBUWMwSkkvWUJRUUJIT2dBQVFjNEpJL2NCUVFCSE9nQUFRYzhKSS9nQlFRQkhPZ0FBUWRBSkkva0JRUUJIT2dBQVFkRUpJL29CUVFCSE9nQUFRZElKSS9zQlFRQkhPZ0FBQ3pVQVFmb0pJOFlCTmdJQVFmNEpJOGNCTmdJQVFZSUtJOGtCUVFCSE9nQUFRWVVLSThvQlFRQkhPZ0FBUVlYK0F5UElBUkFFQzFnQVFkNEtJMWRCQUVjNkFBQkIzd29qV2pZQ0FFSGpDaU5iTmdJQVFlY0tJMXcyQWdCQjdBb2pYVFlDQUVIeENpTmVPZ0FBUWZJS0kxODZBQUJCOXdvallFRUFSem9BQUVINENpTmhOZ0lBUWYwS0kySTdBUUFMUFFCQmtBc2pia0VBUnpvQUFFR1JDeU54TmdJQVFaVUxJM0kyQWdCQm1Rc2pjellDQUVHZUN5TjBOZ0lBUWFNTEkzVTZBQUJCcEFzamRqb0FBQXM3QUVIMEN5T1JBVUVBUnpvQUFFSDFDeU9UQVRZQ0FFSDVDeU9VQVRZQ0FFSDlDeU9WQVRZQ0FFR0NEQ09XQVRZQ0FFR0hEQ09ZQVRzQkFBdUhBUUFRRzBHeUNDUHRBVFlDQUVHMkNDUGlBVG9BQUVIRS9nTWo3Z0VRQkVIa0NDTzRBVUVBUnpvQUFFSGxDQ081QVVFQVJ6b0FBQkFjRUIxQnJBb2pzZ0UyQWdCQnNBb2pzd0U2QUFCQnNRb2p0UUU2QUFBUUhoQWZRY0lMSTM1QkFFYzZBQUJCd3dzamdRRTJBZ0JCeHdzamdnRTJBZ0JCeXdzamd3RTdBUUFRSUVFQUpLTUNDN2tCQUVHQUNDMEFBQ1NMQWtHQkNDMEFBQ1NNQWtHQ0NDMEFBQ1NOQWtHRENDMEFBQ1NPQWtHRUNDMEFBQ1NQQWtHRkNDMEFBQ1NRQWtHR0NDMEFBQ1NSQWtHSENDMEFBQ1NTQWtHSUNDOEJBQ1NUQWtHS0NDOEJBQ1NVQWtHTUNDZ0NBQ1NWQWtHUkNDMEFBRUVBU2lTV0FrR1NDQzBBQUVFQVNpU1hBa0dUQ0MwQUFFRUFTaVNZQWtHVUNDMEFBRUVBU2lTWkFrR1ZDQzBBQUVFQVNpU0lBa0dXQ0MwQUFFRUFTaVNKQWtHWENDMEFBRUVBU2lTS0FndGVBUUYvUVFBazdRRkJBQ1R1QVVIRS9nTkJBQkFFUWNIK0F4QUNRWHh4SVFGQkFDVGlBVUhCL2dNZ0FSQUVJQUFFUUFKQVFRQWhBQU5BSUFCQmdOZ0ZUZzBCSUFCQmdNa0Zha0gvQVRvQUFDQUFRUUZxSVFBTUFBQUxBQXNMQzRnQkFRRi9JK1FCSVFFZ0FFR0FBWEZCQUVjazVBRWdBRUhBQUhGQkFFY2s1UUVnQUVFZ2NVRUFSeVRtQVNBQVFSQnhRUUJISk9jQklBQkJDSEZCQUVjazZBRWdBRUVFY1VFQVJ5VHBBU0FBUVFKeFFRQkhKT29CSUFCQkFYRkJBRWNrNndFajVBRkZJQUVnQVJzRVFFRUJFQ01MSUFGRklnQUVmeVBrQVFVZ0FBc0VRRUVBRUNNTEN5b0FRZVFJTFFBQVFRQktKTGdCUWVVSUxRQUFRUUJLSkxrQlFmLy9BeEFDRUJOQmovNERFQUlRRkF0b0FFSElDUzhCQUNUekFVSEtDUzhCQUNUMEFVSE1DUzBBQUVFQVNpVDFBVUhOQ1MwQUFFRUFTaVQyQVVIT0NTMEFBRUVBU2lUM0FVSFBDUzBBQUVFQVNpVDRBVUhRQ1MwQUFFRUFTaVQ1QVVIUkNTMEFBRUVBU2lUNkFVSFNDUzBBQUVFQVNpVDdBUXRIQUVINkNTZ0NBQ1RHQVVIK0NTZ0NBQ1RIQVVHQ0NpMEFBRUVBU2lUSkFVR0ZDaTBBQUVFQVNpVEtBVUdGL2dNUUFpVElBVUdHL2dNUUFpVExBVUdIL2dNUUFpVE5BUXNIQUVFQUpMWUJDMWdBUWQ0S0kxZEJBRWM2QUFCQjN3b29BZ0FrV2tIakNpZ0NBQ1JiUWVjS0tBSUFKRnhCN0Fvb0FnQWtYVUh4Q2kwQUFDUmVRZklLTFFBQUpGOUI5d290QUFCQkFFb2tZRUg0Q2lnQ0FDUmhRZjBLTHdFQUpHSUxQUUJCa0FzdEFBQkJBRW9rYmtHUkN5Z0NBQ1J4UVpVTEtBSUFKSEpCbVFzb0FnQWtjMEdlQ3lnQ0FDUjBRYU1MTFFBQUpIVkJwQXN0QUFBa2RnczdBRUgwQ3kwQUFFRUFTaVNSQVVIMUN5Z0NBQ1NUQVVINUN5Z0NBQ1NVQVVIOUN5Z0NBQ1NWQVVHQ0RDZ0NBQ1NXQVVHSERDOEJBQ1NZQVF2TUFRRUJmeEFpUWJJSUtBSUFKTzBCUWJZSUxRQUFKT0lCUWNUK0F4QUNKTzRCUWNEK0F4QUNFQ1FRSlVHQS9nTVFBa0gvQVhNazJ3RWoyd0VpQUVFUWNVRUFSeVRjQVNBQVFTQnhRUUJISk4wQkVDWVFKMEdzQ2lnQ0FDU3lBVUd3Q2kwQUFDU3pBVUd4Q2kwQUFDUzFBVUVBSkxZQkVDa1FLa0hDQ3kwQUFFRUFTaVIrUWNNTEtBSUFKSUVCUWNjTEtBSUFKSUlCUWNzTEx3RUFKSU1CRUN0QkFDU2pBa0dBcU5hNUJ5U2FBa0VBSkpzQ1FRQWtuQUpCZ0tqV3VRY2tuUUpCQUNTZUFrRUFKSjhDQ3dVQUk0a0NDd1VBSTUwQ0N3VUFJNTRDQ3dVQUk1OENDOGNDQVFaL0kwa2hCZ0ovQW44Z0FVRUFTaUlGQkVBZ0FFRUlTaUVGQ3lBRkN3UkFJMGdnQkVZaEJRc2dCUXNFZnlBQUlBWkdCU0FGQ3dSQUlBTkJBV3NRQWtFZ2NVRUFSeUVJSUFNUUFrRWdjVUVBUnlFSlFRQWhCUU5BSUFWQkNFZ0VRRUVISUFWcklBVWdDQ0FKUnhzaUJTQUFhaUlEUWFBQlRBUkFJQUZCb0FGc0lBTnFRUU5zUVlESkJXb2lCQzBBQUNFS0lBUWdDam9BQUNBQlFhQUJiQ0FEYWtFRGJFR0J5UVZxSUFRdEFBRTZBQUFnQVVHZ0FXd2dBMnBCQTJ4Qmdza0ZhaUFFTFFBQ09nQUFJQUZCb0FGc0lBTnFRWUNSQkdvZ0FFRUFJQVZyYXlBQlFhQUJiR3BCK0pBRWFpMEFBQ0lEUVFOeElnUkJCSElnQkNBRFFRUnhHem9BQUNBSFFRRnFJUWNMSUFWQkFXb2hCUXdCQ3dzRklBUWtTQXNnQUNBR1RnUkFJQUJCQ0dvaUFTQUNRUWR4SWdKcUlBRWdBQ0FDU0JzaEJnc2dCaVJKSUFjTEtRQWdBRUdBa0FKR0JFQWdBVUdBQVdzZ0FVR0FBV29nQVVHQUFYRWJJUUVMSUFGQkJIUWdBR29MU2dBZ0FFRURkQ0FCUVFGMGFpSUFRUUZxUVQ5eElnRkJRR3NnQVNBQ0cwR0FrQVJxTFFBQUlRRWdBRUUvY1NJQVFVQnJJQUFnQWh0QmdKQUVhaTBBQUNBQlFmOEJjVUVJZEhJTHlBRUFJQUVRQWlBQVFRRjBkVUVEY1NFQUlBRkJ5UDREUmdSQUl6MGhBUUpBSUFCRkRRQUNRQUpBQWtBQ1FDQUFRUUZyRGdNQkFnTUFDd3dEQ3lNK0lRRU1BZ3NqUHlFQkRBRUxJMEFoQVFzRklBRkJ5ZjREUmdSQUkwRWhBUUpBSUFCRkRRQUNRQUpBQWtBQ1FDQUFRUUZyRGdNQkFnTUFDd3dEQ3lOQ0lRRU1BZ3NqUXlFQkRBRUxJMFFoQVFzRkl6a2hBUUpBSUFCRkRRQUNRQUpBQWtBQ1FDQUFRUUZyRGdNQkFnTUFDd3dEQ3lNNklRRU1BZ3NqT3lFQkRBRUxJendoQVFzTEN5QUJDNW9EQVFaL0lBRWdBQkF5SUFWQkFYUnFJZ0JCZ0pCK2FpQUNRUUZ4UVExMElnRnFMUUFBSVJFZ0FFR0JrSDVxSUFGcUxRQUFJUklnQXlFQUEwQWdBQ0FFVEFSQUlBQWdBMnNnQm1vaURpQUlTQVJBUVFBaEJRSi9RUUZCQnlBQWF5QUFJQXRCQUVnaUFRUi9JQUVGSUF0QklIRkZDeHNpQVhRZ0VuRUVRRUVDSVFVTElBVkJBV29MSUFWQkFTQUJkQ0FSY1JzaEFpT0pBZ1IvSUF0QkFFNGlBUVIvSUFFRklBeEJBRTRMQlNPSkFnc0VmeUFMUVFkeElRRWdERUVBVGlJRkJFQWdERUVIY1NFQkN5QUJJQUlnQlJBeklnVkJIM0ZCQTNRaEFTQUZRZUFIY1VFRmRVRURkQ0VQSUFWQmdQZ0JjVUVLZFVFRGRBVWdBa0hIL2dNZ0NpQUtRUUJNR3lJS0VEUWlCVUdBZ1B3SGNVRVFkU0VCSUFWQmdQNERjVUVJZFNFUElBVkIvd0Z4Q3lFRklBY2dDR3dnRG1wQkEyd2dDV29pRUNBQk9nQUFJQkJCQVdvZ0R6b0FBQ0FRUVFKcUlBVTZBQUFnQjBHZ0FXd2dEbXBCZ0pFRWFpQUNRUU54SWdGQkJISWdBU0FMUVlBQmNVRUFSMEVBSUF0QkFFNGJHem9BQUNBTlFRRnFJUTBMSUFCQkFXb2hBQXdCQ3dzZ0RRdCtBUU4vSUFOQkIzRWhBMEVBSUFJZ0FrRURkVUVEZEdzZ0FCc2hCMEdnQVNBQWEwRUhJQUJCQ0dwQm9BRktHeUVJUVg4aEFpT0pBZ1JBSUFSQmdOQithaTBBQUNJQ1FRaHhRUUJISVFrZ0FrSEFBSEVFUUVFSElBTnJJUU1MQ3lBR0lBVWdDU0FISUFnZ0F5QUFJQUZCb0FGQmdNa0ZRUUFnQWtGL0VEVUxvUUlCQVg4Z0EwRUhjU0VESUFVZ0JoQXlJQVJCZ05CK2FpMEFBQ0lFUWNBQWNRUi9RUWNnQTJzRklBTUxRUUYwYWlJRlFZQ1FmbW9nQkVFSWNVRUFSeUlHUVExMGFpMEFBQ0VISUFKQkIzRWhBMEVBSVFJZ0FVR2dBV3dnQUdwQkEyeEJnTWtGYWlBRVFRZHhBbjhnQlVHQmtINXFJQVpCQVhGQkRYUnFMUUFBUVFFZ0EwRUhJQU5ySUFSQklIRWJJZ04wY1FSQVFRSWhBZ3NnQWtFQmFnc2dBa0VCSUFOMElBZHhHeUlEUVFBUU15SUNRUjl4UVFOME9nQUFJQUZCb0FGc0lBQnFRUU5zUVlISkJXb2dBa0hnQjNGQkJYVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnc2tGYWlBQ1FZRDRBWEZCQ25WQkEzUTZBQUFnQVVHZ0FXd2dBR3BCZ0pFRWFpQURRUU54SWdCQkJISWdBQ0FFUVlBQmNSczZBQUFMeEFFQUlBUWdCUkF5SUFOQkIzRkJBWFJxSWdSQmdKQithaTBBQUNFRlFRQWhBeUFCUWFBQmJDQUFha0VEYkVHQXlRVnFBbjhnQkVHQmtINXFMUUFBUVFGQkJ5QUNRUWR4YXlJQ2RIRUVRRUVDSVFNTElBTkJBV29MSUFOQkFTQUNkQ0FGY1JzaUEwSEgvZ01RTkNJQ1FZQ0EvQWR4UVJCMU9nQUFJQUZCb0FGc0lBQnFRUU5zUVlISkJXb2dBa0dBL2dOeFFRaDFPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZTEpCV29nQWpvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRTZBQUFMMWdFQkJuOGdBMEVEZFNFTEEwQWdCRUdnQVVnRVFDQUVJQVZxSWdaQmdBSk9CRUFnQmtHQUFtc2hCZ3NnQzBFRmRDQUNhaUFHUVFOMWFpSUlRWUNRZm1vdEFBQWhCMEVBSVFrak53UkFJQVFnQUNBR0lBZ2dCeEF4SWdwQkFFb0VRRUVCSVFrZ0NrRUJheUFFYWlFRUN3c2dDVVVqTmlJS0lBb2JCRUFnQkNBQUlBWWdBeUFJSUFFZ0J4QTJJZ1pCQUVvRVFDQUdRUUZySUFScUlRUUxCU0FKUlFSQUk0a0NCRUFnQkNBQUlBWWdBeUFJSUFFZ0J4QTNCU0FFSUFBZ0JpQURJQUVnQnhBNEN3c0xJQVJCQVdvaEJBd0JDd3NMTWdFRGZ5UHhBU0VESUFBajhnRWlCRWdFUUE4TFFRQWdBMEVIYXlJRGF5RUZJQUFnQVNBQ0lBQWdCR3NnQXlBRkVEa0x2QVVCRDM4Q1FFRW5JUWNEUUNBSFFRQklEUUVnQjBFQ2RDSUdRWUQ4QTJvaUFoQUNJUU1nQWtFQmFoQUNJUWdnQWtFQ2FoQUNJUVFnQTBFUWF5RUZJQWhCQ0dzaERFRUlJUU1nQVFSQVFSQWhBeUFFSUFSQkFYRnJJUVFMSUFBZ0JVNGlBZ1JBSUFBZ0F5QUZha2doQWdzZ0FnUkFJQVpCZy93RGFoQUNJZ1pCZ0FGeFFRQkhJUWdnQmtFZ2NVRUFSeUVOUVlDQUFpQUVFRElnQXlBQUlBVnJJZ0pyUVFGcklBSWdCa0hBQUhFYlFRRjBhaUlDUVlDUWZtb2dCa0VJY1VFQVJ5T0pBaUlFSUFRYlFRRnhRUTEwSWdScUxRQUFJUTRnQWtHQmtINXFJQVJxTFFBQUlROUJCeUVGQTBBZ0JVRUFUZ1JBUVFBaEF3Si9RUUZCQUNBRlFRZHJheUFGSUEwYklnSjBJQTl4QkVCQkFpRURDeUFEUVFGcUN5QURRUUVnQW5RZ0RuRWJJZ29FUUVFSElBVnJJQXhxSWdOQkFFNGlBZ1JBSUFOQm9BRk1JUUlMSUFJRVFFRUFJUXRCQUNFRUkrc0JSU09KQWlJQ0lBSWJJZ0pGQkVBZ0FFR2dBV3dnQTJwQmdKRUVhaTBBQUNJSklSQWdDVUVEY1NJSlFRQkxJQWdnQ0JzRVFFRUJJUXNGSUJCQkJIRkJBRWNqaVFJaUJDQUVHeUlFQkVBZ0NVRUFTeUVFQzBFQlFRQWdCQnNoQkFzTElBSkZCRUFnQzBVaUFnUkFJQVJGSVFJTEN5QUNCRUFqaVFJRVFDQUFRYUFCYkNBRGFrRURiRUdBeVFWcUlBWkJCM0VnQ2tFQkVETWlBa0VmY1VFRGREb0FBQ0FBUWFBQmJDQURha0VEYkVHQnlRVnFJQUpCNEFkeFFRVjFRUU4wT2dBQUlBQkJvQUZzSUFOcVFRTnNRWUxKQldvZ0FrR0ErQUZ4UVFwMVFRTjBPZ0FBQlNBQVFhQUJiQ0FEYWtFRGJFR0F5UVZxSUFwQnlmNERRY2orQXlBR1FSQnhHeEEwSWdKQmdJRDhCM0ZCRUhVNkFBQWdBRUdnQVd3Z0EycEJBMnhCZ2NrRmFpQUNRWUQrQTNGQkNIVTZBQUFnQUVHZ0FXd2dBMnBCQTJ4Qmdza0ZhaUFDT2dBQUN3c0xDeUFGUVFGcklRVU1BUXNMQ3lBSFFRRnJJUWNNQUFBTEFBc0xaZ0VDZjBHQWdBSkJnSkFDSStjQkd5RUJJNGtDSWdJajZ3RWdBaHNFUUNBQUlBRkJnTGdDUVlDd0FpUG9BUnNqOEFFZ0FHcEIvd0Z4UVFBajd3RVFPUXNqNWdFRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBsQVJzUU9nc2o2Z0VFUUNBQUkra0JFRHNMQ3lVQkFYOENRQU5BSUFCQmtBRktEUUVnQUVIL0FYRVFQQ0FBUVFGcUlRQU1BQUFMQUFzTFJnRUNmd05BSUFGQmtBRk9SUVJBUVFBaEFBTkFJQUJCb0FGSUJFQWdBVUdnQVd3Z0FHcEJnSkVFYWtFQU9nQUFJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUVMQ3dzYkFFR1AvZ01RQWtFQklBQjBjaUlBSk1BQlFZLytBeUFBRUFRTEN3QkJBU1RDQVVFQkVEOExMQUVDZnlOY0lnQkJBRW9pQVFSQUkxVWhBUXNnQVFSQUlBQkJBV3NpQUVVRVFFRUFKRmNMQ3lBQUpGd0xMQUVDZnlOeklnQkJBRW9pQVFSQUkyd2hBUXNnQUVFQmF5QUFJQUViSWdCRkJFQkJBQ1J1Q3lBQUpITUxMZ0VDZnlPQ0FTSUFRUUJLSWdFRVFDTjhJUUVMSUFCQkFXc2dBQ0FCR3lJQVJRUkFRUUFrZmdzZ0FDU0NBUXN3QVFKL0k1VUJJZ0JCQUVvaUFRUkFJNUFCSVFFTElBQkJBV3NnQUNBQkd5SUFSUVJBUVFBa2tRRUxJQUFrbFFFTFJ3RUNmeUFBSkdKQmxQNERFQUpCK0FGeElRRkJrLzRESUFCQi93RnhJZ0lRQkVHVS9nTWdBU0FBUVFoMVFRZHhJZ0J5RUFRZ0FpUlVJQUFrVmlOVUkxWkJDSFJ5SkZrTHFBRUJBbjhqVjBVaUFBUi9JQUFGSTJCRkN3UkFEd3NqWVVFQmF5SUFRUUJNQkVBalRBUkFJMHdrWVFKL0kySWlBU05PZFNFQVFRRWpUUVIvUVFFa1l5QUJJQUJyQlNBQUlBRnFDeUlBUWY4UFNnMEFHa0VBQ3dSQVFRQWtWd3NqVGtFQVNnUkFJQUFRUlFKL0kySWlBU05PZFNFQVFRRWpUUVIvUVFFa1l5QUJJQUJyQlNBQUlBRnFDMEgvRDBvTkFCcEJBQXNFUUVFQUpGY0xDd1ZCQ0NSaEN3VWdBQ1JoQ3d0T0FRTi9JMXRCQVdzaUFVRUFUQVJBSTFNaUFRUkFJMTBoQUNBQVFROUlJMUlqVWhzRWZ5QUFRUUZxQlNOU1JTSUNCRUFnQUVFQVNpRUNDeUFBUVFGcklBQWdBaHNMSkYwTEN5QUJKRnNMVGdFRGZ5TnlRUUZySWdGQkFFd0VRQ05xSWdFRVFDTjBJUUFnQUVFUFNDTnBJMmtiQkg4Z0FFRUJhZ1VqYVVVaUFnUkFJQUJCQUVvaEFnc2dBRUVCYXlBQUlBSWJDeVIwQ3dzZ0FTUnlDMVlCQTM4amxBRkJBV3NpQVVFQVRBUkFJNHdCSWdFRVFDT1dBU0VBSUFCQkQwZ2ppd0VqaXdFYkJIOGdBRUVCYWdVaml3RkZJZ0lFUUNBQVFRQktJUUlMSUFCQkFXc2dBQ0FDR3dza2xnRUxDeUFCSkpRQkM1MEJBUUovUVlEQUFDT0tBblFpQVNFQ0k3SUJJQUJxSWdBZ0FVNEVRQ0FBSUFKckpMSUJBa0FDUUFKQUFrQUNRQ08xQVVFQmFrRUhjU0lBQkVBZ0FFRUNSZzBCQWtBZ0FFRUVhdzRFQXdBRUJRQUxEQVVMRUVFUVFoQkRFRVFNQkFzUVFSQkNFRU1RUkJCR0RBTUxFRUVRUWhCREVFUU1BZ3NRUVJCQ0VFTVFSQkJHREFFTEVFY1FTQkJKQ3lBQUpMVUJRUUVQQlNBQUpMSUJDMEVBQzNNQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBQ1FDQUFRUUpyRGdNQ0F3UUFDd3dFQ3lOWUlnQWpuUUZISVFFZ0FDU2RBU0FCRHdzamJ5SUFJNTRCUnlFQklBQWtuZ0VnQVE4TEkzOGlBQ09mQVVjaEFTQUFKSjhCSUFFUEN5T1NBU0lBSTZBQlJ5RUJJQUFrb0FFZ0FROExRUUFMVlFBQ1FBSkFBa0FnQUVFQlJ3UkFJQUJCQWtZTkFTQUFRUU5HRFFJTUF3dEJBU0FCZEVHQkFYRkJBRWNQQzBFQklBRjBRWWNCY1VFQVJ3OExRUUVnQVhSQi9nQnhRUUJIRHd0QkFTQUJkRUVCY1VFQVJ3dHlBUUYvSTFvZ0FHc2hBQU5BSUFCQkFFd0VRRUdBRUNOWmEwRUNkQ0lCUVFKMElBRWppZ0liSkZvaldpQUFRUjkxSWdFZ0FDQUJhbk5ySVFBalgwRUJha0VIY1NSZkRBRUxDeUFBSkZvaldDTlhJZ0FnQUJzRWZ5TmRCVUVQRHdzalR5TmZFRXdFZjBFQkJVRi9DMnhCRDJvTGF3RUJmeU54SUFCcklRQURRQ0FBUVFCTUJFQkJnQkFqY0d0QkFuUWppZ0owSkhFamNTQUFRUjkxSWdFZ0FDQUJhbk5ySVFBamRrRUJha0VIY1NSMkRBRUxDeUFBSkhFamJ5TnVJZ0FnQUJzRWZ5TjBCVUVQRHdzalppTjJFRXdFZjBFQkJVRi9DMnhCRDJvTER3QWpnd0ZCQVhWQnNQNERhaEFDQ3lvQkFYOGpnd0ZCQVdvaEFBTkFJQUJCSUU0RVFDQUFRU0JySVFBTUFRc0xJQUFrZ3dFUVR5U0dBUXZyQVFFRGZ5TitSU0lDQkg4Z0FnVWpmMFVMQkVCQkR3OExJNFFCSVFJamhRRUVRRUdjL2dNUUFrRUZkVUVQY1NJQ0pJUUJRUUFraFFFTEk0WUJJNE1CUVFGeFJVRUNkSFZCRDNFaEFRSkFBa0FDUUFKQUlBSUVRQ0FDUVFGR0RRRWdBa0VDUmcwQ0RBTUxJQUZCQkhVaEFRd0RDMEVCSVFNTUFnc2dBVUVCZFNFQlFRSWhBd3dCQ3lBQlFRSjFJUUZCQkNFREN5QURRUUJLQkg4Z0FTQURiUVZCQUF0QkQyb2hBaU9CQVNBQWF5RUFBMEFnQUVFQVRBUkFRWUFRSTRBQmEwRUJkQ09LQW5Ra2dRRWpnUUVnQUVFZmRTSUJJQUFnQVdwemF5RUFFRkFNQVFzTElBQWtnUUVnQWd1T0FRRUNmeU9UQVNBQWF5SUFRUUJNQkVBamx3RWpqUUYwSTRvQ2RDQUFRUjkxSWdFZ0FDQUJhbk5ySVFBam1BRWlBVUVCZFNJQ0lBRkJBWEVnQWtFQmNYTWlBVUVPZEhJaUFrRy9mM0VnQVVFR2RISWdBaU9PQVJza21BRUxRUUFnQUNBQVFRQklHeVNUQVNPU0FTT1JBU0lBSUFBYkJIOGpsZ0VGUVE4UEMwRi9RUUVqbUFGQkFYRWJiRUVQYWdzd0FDQUFRVHhHQkVCQi93QVBDeUFBUVR4clFhQ05CbXdnQVd4QkEzVkJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMExsd0VCQVg5QkFDU2pBU0FBUVE4anFRRWJJQUZCRHlPcUFSdHFJQUpCRHlPckFSdHFJQU5CRHlPc0FSdHFJUVFnQUVFUEk2MEJHeUFCUVE4anJnRWJhaUVBSUFBZ0FrRVBJNjhCRzJvaEFTQURRUThqc0FFYklRTkJBQ1NrQVVFQUpLVUJJQVFqcHdGQkFXb1FVeUVBSUFFZ0Eyb2pxQUZCQVdvUVV5RUJJQUFrb1FFZ0FTU2lBU0FCUWY4QmNTQUFRZjhCY1VFSWRISUxvZ01CQlg4alNpQUFhaUlCSkVvaldpQUJhMEVBVENJQlJRUkFRUUVRU3lFQkN5TmtJQUJxSWdJa1pDTnhJQUpyUVFCTUlnVkZCRUJCQWhCTElRVUxJM2NnQUdva2R5T0ZBVVVpQWdSQUk0RUJJM2RyUVFCS0lRSUxJQUpGSWdSRkJFQkJBeEJMSVFRTEk0Y0JJQUJxSkljQkk1TUJJNGNCYTBFQVRDSUNSUVJBUVFRUVN5RUNDeUFCQkVBalNpRURRUUFrU2lBREVFMGttUUVMSUFVRVFDTmtJUU5CQUNSa0lBTVFUaVNhQVFzZ0JBUkFJM2NoQTBFQUpIY2dBeEJSSkpzQkN5QUNCRUFqaHdFaEEwRUFKSWNCSUFNUVVpU2NBUXNDZnlBQklBVWdBUnNpQVVVRVFDQUVJUUVMSUFGRkN3UkFJQUloQVFzZ0FRUkFRUUVrcFFFTFFZQ0FnQUlqaWdKMEk3UUJiU0lFSVFJanN3RWdBR29pQVNBRVRnUkFJQUVnQW1zaEFTT2xBU0lBSTZNQklBQWJJZ0JGQkVBanBBRWhBQXNnQUFSQUk1a0JJNW9CSTVzQkk1d0JFRlFhQlNBQkpMTUJDeU8yQVNJQ1FRRjBRWUNad1FCcUlnQWpvUUZCQW1vNkFBQWdBRUVCYWlPaUFVRUNham9BQUNBQ1FRRnFJZ0FqdHdGQkFYVkJBV3RPQkg4Z0FFRUJhd1VnQUFza3RnRUxJQUVrc3dFTHFBTUJCbjhnQUJCTklRRWdBQkJPSVFJZ0FCQlJJUVFnQUJCU0lRVWdBU1NaQVNBQ0pKb0JJQVFrbXdFZ0JTU2NBU096QVNBQWFpSUFRWUNBZ0FJamlnSjBJN1FCYlU0RVFDQUFRWUNBZ0FJamlnSjBJN1FCYldzaEFDQUJJQUlnQkNBRkVGUWhBeU8yQVVFQmRFR0FtY0VBYWlJR0lBTkJnUDREY1VFSWRVRUNham9BQUNBR1FRRnFJQU5CL3dGeFFRSnFPZ0FBSXpnRVFDQUJRUTlCRDBFUEVGUWhBU08yQVVFQmRFR0FtU0ZxSWdNZ0FVR0EvZ054UVFoMVFRSnFPZ0FBSUFOQkFXb2dBVUgvQVhGQkFtbzZBQUJCRHlBQ1FROUJEeEJVSVFFanRnRkJBWFJCZ0prcGFpSUNJQUZCZ1A0RGNVRUlkVUVDYWpvQUFDQUNRUUZxSUFGQi93RnhRUUpxT2dBQVFROUJEeUFFUVE4UVZDRUJJN1lCUVFGMFFZQ1pNV29pQWlBQlFZRCtBM0ZCQ0hWQkFtbzZBQUFnQWtFQmFpQUJRZjhCY1VFQ2Fqb0FBRUVQUVE5QkR5QUZFRlFoQVNPMkFVRUJkRUdBbVRscUlnSWdBVUdBL2dOeFFRaDFRUUpxT2dBQUlBSkJBV29nQVVIL0FYRkJBbW82QUFBTEk3WUJRUUZxSWdFanR3RkJBWFZCQVd0T0JIOGdBVUVCYXdVZ0FRc2t0Z0VMSUFBa3N3RUxIZ0VCZnlBQUVFb2hBU0FCUlNNMUl6VWJCRUFnQUJCVkJTQUFFRllMQ3k4QkFuOUIxd0FqaWdKMElRRWpwZ0VoQUFOQUlBQWdBVTRFUUNBQkVGY2dBQ0FCYXlFQURBRUxDeUFBSktZQkM2UURBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHUS9nTkhCRUFnQUVHVi9nTkdEUUVDUUNBQVFaSCtBMnNPRmdZTEVCUUFCd3dSRlFNSURSSVdCQWtPRXhjRkNnOEFDd3dYQzBHUS9nTVFBa0dBQVhJUEMwR1YvZ01RQWtIL0FYSVBDMEdhL2dNUUFrSC9BSElQQzBHZi9nTVFBa0gvQVhJUEMwR2svZ01RQWc4TFFaSCtBeEFDUVQ5eUR3dEJsdjRERUFKQlAzSVBDMEdiL2dNUUFrSC9BWElQQzBHZy9nTVFBa0gvQVhJUEMwR2wvZ01RQWc4TFFaTCtBeEFDRHd0QmwvNERFQUlQQzBHYy9nTVFBa0dmQVhJUEMwR2gvZ01RQWc4TFFZQUJRUUFqc1FFYklRQWdBRUVCY2lBQVFYNXhJMWNiSVFBZ0FFRUNjaUFBUVgxeEkyNGJJUUFnQUVFRWNpQUFRWHR4STM0YklRQWdBRUVJY2lBQVFYZHhJNUVCRzBId0FISVBDMEdUL2dNUUFrSC9BWElQQzBHWS9nTVFBa0gvQVhJUEMwR2QvZ01RQWtIL0FYSVBDMEdpL2dNUUFnOExRWlQrQXhBQ1FiOEJjZzhMUVpuK0F4QUNRYjhCY2c4TFFaNytBeEFDUWI4QmNnOExRYVArQXhBQ1FiOEJjZzhMUVg4TG5BRUJBWDhqMndFaEFDUGNBUVJBSUFCQmUzRWdBRUVFY2lQVEFSc2hBQ0FBUVg1eElBQkJBWElqMWdFYklRQWdBRUYzY1NBQVFRaHlJOVFCR3lFQUlBQkJmWEVnQUVFQ2NpUFZBUnNoQUFVajNRRUVRQ0FBUVg1eElBQkJBWElqMXdFYklRQWdBRUY5Y1NBQVFRSnlJOWdCR3lFQUlBQkJlM0VnQUVFRWNpUFpBUnNoQUNBQVFYZHhJQUJCQ0hJajJnRWJJUUFMQ3lBQVFmQUJjZ3YwQWdFQmZ5QUFRWUNBQWtnRVFFRi9Ed3NnQUVHQWdBSk9JZ0VFZnlBQVFZREFBa2dGSUFFTEJFQkJmdzhMSUFCQmdNQURUaUlCQkg4Z0FFR0EvQU5JQlNBQkN3UkFJQUJCZ0VCcUVBSVBDeUFBUVlEOEEwNGlBUVIvSUFCQm4vMERUQVVnQVFzRVFFSC9BVUYvSStJQlFRSklHdzhMSUFCQnpmNERSZ1JBUWY4QklRQkJ6ZjRERUFKQkFYRkZCRUJCL2dFaEFBc2ppZ0pGQkVBZ0FFSC9mbkVoQUFzZ0FBOExJQUJCeFA0RFJnUkFJQUFqN2dFUUJDUHVBUThMSUFCQmtQNERUaUlCQkg4Z0FFR20vZ05NQlNBQkN3UkFFRmdnQUJCWkR3c2dBRUduL2dOT0lnRUVmeUFBUWEvK0Ewd0ZJQUVMQkVCQi93RVBDeUFBUWJEK0EwNGlBUVIvSUFCQnYvNERUQVVnQVFzRVFCQllJMzRFUUJCUER3dEJmdzhMSUFCQmhQNERSZ1JBSUFBanh3RkJnUDREY1VFSWRTSUFFQVFnQUE4TElBQkJoZjREUmdSQUlBQWp5QUVRQkNQSUFROExJQUJCai80RFJnUkFJOEFCUWVBQmNnOExJQUJCZ1A0RFJnUkFFRm9QQzBGL0N5a0JBWDhqM3dFZ0FFWUVRRUVCSk9FQkN5QUFFRnNpQVVGL1JnUi9JQUFRQWdVZ0FVSC9BWEVMQzdZQ0FRUi9JL2NCQkVBUEN5UDRBU0VFSS9rQklRTWdBRUgvUDB3RVFDQURCSDhnQVVFUWNVVUZJQU1MUlFSQUlBRkJEM0VpQUFSQUlBQkJDa1lFUUVFQkpQVUJDd1ZCQUNUMUFRc0xCU0FBUWYvL0FFd0VRQ1A3QVNJRlJTSUNSUVJBSUFCQi85OEFUQ0VDQ3lBQ0JFQWdBVUVQY1NQekFTQURHeUVBSUFRRWZ5QUJRUjl4SVFFZ0FFSGdBWEVGSS9vQkJIOGdBVUgvQUhFaEFTQUFRWUFCY1FWQkFDQUFJQVViQ3dzaEFDQUFJQUZ5SlBNQkJTUHpBVUgvQVhFZ0FVRUFTa0VJZEhJazh3RUxCU0FEUlNJQ0JIOGdBRUgvdndGTUJTQUNDd1JBSS9ZQklBUWdCQnNFUUNQekFVRWZjU0FCUWVBQmNYSWs4d0VQQ3lBQlFROXhJQUZCQTNFait3RWJKUFFCQlNBRFJTSUNCRUFnQUVILy93Rk1JUUlMSUFJRVFDQUVCRUFnQVVFQmNVRUFSeVQyQVFzTEN3c0xDMEFCQVg4alRTRUJJQUJCOEFCeFFRUjFKRXdnQUVFSWNVRUFSeVJOSUFCQkIzRWtUaUFCQkg4alRVVWlBQVIvSTJNRklBQUxCU0FCQ3dSQVFRQWtWd3NMTWdFQmZ5QUFRWUFCY1VFQVJ5RUJJMzlGSWdBRWZ5QUJCU0FBQ3dSQVFRQWtoZ0VMSUFFa2Z5QUJSUVJBSUFFa2Znc0xOQUFnQUVFRWRVRVBjU1JSSUFCQkNIRkJBRWNrVWlBQVFRZHhKRk1nQUVINEFYRkJBRW9pQUNSWUlBQkZCRUFnQUNSWEN3czBBQ0FBUVFSMVFROXhKR2dnQUVFSWNVRUFSeVJwSUFCQkIzRWthaUFBUWZnQmNVRUFTaUlBSkc4Z0FFVUVRQ0FBSkc0TEN6a0FJQUJCQkhWQkQzRWtpZ0VnQUVFSWNVRUFSeVNMQVNBQVFRZHhKSXdCSUFCQitBRnhRUUJLSWdBa2tnRWdBRVVFUUNBQUpKRUJDd3M0QUNBQVFRUjFKSTBCSUFCQkNIRkJBRWNramdFZ0FFRUhjU0lBSkk4QklBQkJBWFFpQUVFQlNBUkFRUUVoQUFzZ0FFRURkQ1NYQVF1akFRRUNmMEVCSkZjalhFVUVRQ05MSkZ3TFFZQVFJMWxyUVFKMElnQkJBblFnQUNPS0Foc2tXaU5USkZzalVTUmRJMWtrWWlOTUJFQWpUQ1JoQlVFSUpHRUxJMHhCQUVvaUFBUi9JQUFGSTA1QkFFb0xKR0JCQUNSakkwNUJBRW9pQUFSL0FuOGpZaUlCSTA1MUlRQkJBU05OQkg5QkFTUmpJQUVnQUdzRklBQWdBV29MUWY4UFNnMEFHa0VBQ3dVZ0FBc0VRRUVBSkZjTEkxaEZCRUJCQUNSWEN3dXBBUUVEZnlBQVFRZHhJZ0lrVmlOVUlBSkJDSFJ5SkZranRRRkJBWEZCQVVZaEF5TlZSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2dBMFVFUUNOY1FRQktJZ0lFZnlBQkJTQUNDd1JBSTF4QkFXc2tYQ0FBUVlBQmNVVWlBUVIvSTF4RkJTQUJDd1JBUVFBa1Z3c0xDeUFBUWNBQWNVRUFSeVJWSUFCQmdBRnhCRUFRWkFKL0lBTkZJZ0FFUUNOY0kwdEdJUUFMSUFBTEJIOGpWUVVnQUFzRVFDTmNRUUZySkZ3TEN3c3hBRUVCSkc0amMwVUVRQ05sSkhNTFFZQVFJM0JyUVFKMEk0b0NkQ1J4STJva2NpTm9KSFFqYjBVRVFFRUFKRzRMQzZrQkFRTi9JQUJCQjNFaUFpUnRJMnNnQWtFSWRISWtjQ08xQVVFQmNVRUJSaUVESTJ4RklnRUVRQ0FBUWNBQWNVRUFSeUVCQ3lBRFJRUkFJM05CQUVvaUFnUi9JQUVGSUFJTEJFQWpjMEVCYXlSeklBQkJnQUZ4UlNJQkJIOGpjMFVGSUFFTEJFQkJBQ1J1Q3dzTElBQkJ3QUJ4UVFCSEpHd2dBRUdBQVhFRVFCQm1BbjhnQTBVaUFBUkFJM01qWlVZaEFBc2dBQXNFZnlOc0JTQUFDd1JBSTNOQkFXc2tjd3NMQ3pzQVFRRWtmaU9DQVVVRVFDTjRKSUlCQzBHQUVDT0FBV3RCQVhRamlnSjBKSUVCSTRFQlFRWnFKSUVCUVFBa2d3RWpmMFVFUUVFQUpINExDNjhCQVFOL0lBQkJCM0VpQWlSOUkzc2dBa0VJZEhJa2dBRWp0UUZCQVhGQkFVWWlBMFVFUUNOOFJTSUJCRUFnQUVIQUFIRkJBRWNoQVFzamdnRkJBRW9pQWdSL0lBRUZJQUlMQkVBamdnRkJBV3NrZ2dFZ0FFR0FBWEZGSWdFRWZ5T0NBVVVGSUFFTEJFQkJBQ1IrQ3dzTElBQkJ3QUJ4UVFCSEpId2dBRUdBQVhFRVFCQm9BbjhnQTBVaUFBUkFJNElCSTNoR0lRQUxJQUFMQkg4amZBVWdBQXNFUUNPQ0FVRUJheVNDQVFzTEMwRUFRUUVra1FFamxRRkZCRUFqaUFFa2xRRUxJNWNCSTQwQmRDT0tBblFra3dFampBRWtsQUVqaWdFa2xnRkIvLzhCSkpnQkk1SUJSUVJBUVFBa2tRRUxDNklCQVFOL0k3VUJRUUZ4UVFGR0lRSWprQUZGSWdFRVFDQUFRY0FBY1VFQVJ5RUJDeUFDUlFSQUk1VUJRUUJLSWdNRWZ5QUJCU0FEQ3dSQUk1VUJRUUZySkpVQklBQkJnQUZ4UlNJQkJIOGpsUUZGQlNBQkN3UkFRUUFra1FFTEN3c2dBRUhBQUhGQkFFY2trQUVnQUVHQUFYRUVRQkJxQW44Z0FrVWlBQVJBSTVVQkk0Z0JSaUVBQ3lBQUN3Ui9JNUFCQlNBQUN3UkFJNVVCUVFGckpKVUJDd3NML2dNQkFYOGdBRUdtL2dOSElnSUVRQ094QVVVaEFnc2dBZ1JBUVFBUEN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJrUDREUndSQUlBQkJtdjREUmcwQkFrQWdBRUdSL2dOckRoWURCd3NQQUFRSURCQUFCUWtORVFBR0NnNFNFeFFWQUFzTUZRc2dBUkJlREJVTElBRVFYd3dVQ3lBQlFRWjFRUU54SkU4Z0FVRS9jU1JRSTBzalVHc2tYQXdUQ3lBQlFRWjFRUU54SkdZZ0FVRS9jU1JuSTJValoyc2tjd3dTQ3lBQkpIa2plQ041YXlTQ0FRd1JDeUFCUVQ5eEpJa0JJNGdCSTRrQmF5U1ZBUXdRQ3lBQkVHQU1Ed3NnQVJCaERBNExRUUVraFFFZ0FVRUZkVUVQY1NSNkRBMExJQUVRWWd3TUN5QUJKRlFqVmtFSWRDQUJjaVJaREFzTElBRWtheU50UVFoMElBRnlKSEFNQ2dzZ0FTUjdJMzFCQ0hRZ0FYSWtnQUVNQ1FzZ0FSQmpEQWdMSUFFUVpRd0hDeUFCRUdjTUJnc2dBUkJwREFVTElBRVFhd3dFQ3lBQlFRUjFRUWR4SktjQklBRkJCM0VrcUFGQkFTU2pBUXdEQ3lBQkVCQkJBU1NrQVF3Q0N5T3hBU0lDUlNJQUJFQWdBVUdBQVhFaEFBc2dBQVJBUVFja3RRRkJBQ1JmUVFBa2Rnc2dBVUdBQVhGRklBSWdBaHNFUUFKQVFaRCtBeUVBQTBBZ0FFR20vZ05PRFFFZ0FFRUFFSGtnQUVFQmFpRUFEQUFBQ3dBTEN5QUJRWUFCY1VFQVJ5U3hBUXdCQzBFQkR3dEJBUXM4QVFGL0lBQkJDSFFoQVVFQUlRQURRQUpBSUFCQm53RktEUUFnQUVHQS9BTnFJQUFnQVdvUUFoQUVJQUJCQVdvaEFBd0JDd3RCaEFVa2dRSUxJd0VCZnlQOEFSQUNJUUFqL1FFUUFrSC9BWEVnQUVIL0FYRkJDSFJ5UWZEL0EzRUxKd0VCZnlQK0FSQUNJUUFqL3dFUUFrSC9BWEVnQUVIL0FYRkJDSFJ5UWZBL2NVR0FnQUpxQzRRQkFRTi9JNGtDUlFSQUR3c2dBRUdBQVhGRkk0SUNJNElDR3dSQVFRQWtnZ0lqZ0FJUUFrR0FBWEloQUNPQUFpQUFFQVFQQ3hCdUlRRVFieUVDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKSUlDSUFNa2d3SWdBU1NFQWlBQ0pJVUNJNEFDSUFCQi8zNXhFQVFGSUFFZ0FpQURFSG9qZ0FKQi93RVFCQXNMWGdFRWZ5TkhJUU1qUmlBQVJpSUNSUVJBSUFBZ0EwWWhBZ3NnQWdSQUlBQkJBV3NpQkJBQ1FiOS9jU0lDUVQ5eElnVkJRR3NnQlNBQUlBTkdHMEdBa0FScUlBRTZBQUFnQWtHQUFYRUVRQ0FFSUFKQkFXcEJnQUZ5RUFRTEN3c3hBQUpBQWtBQ1FBSkFJQUFFUUFKQUlBQkJBV3NPQXdJREJBQUxEQVFMUVFrUEMwRUREd3RCQlE4TFFRY1BDMEVBQ3lVQkFYOUJBU1BOQVJCeUlnSjBJQUJ4UVFCSElnQUVmMEVCSUFKMElBRnhSUVVnQUFzTGhRRUJCSDhEUUNBQ0lBQklCRUFnQWtFRWFpRUNJOGNCSWdGQkJHcEIvLzhEY1NJREpNY0JJOHdCQkVBanlnRWhCQ1BKQVFSQUk4c0JKTWdCUVFFa3d3RkJBaEEvUVFBa3lRRkJBU1RLQVFVZ0JBUkFRUUFreWdFTEN5QUJJQU1RY3dSQUk4Z0JRUUZxSWdGQi93RktCRUJCQVNUSkFVRUFJUUVMSUFFa3lBRUxDd3dCQ3dzTERBQWp4Z0VRZEVFQUpNWUJDMFlCQVg4anh3RWhBRUVBSk1jQlFZVCtBMEVBRUFRanpBRUVmeUFBUVFBUWN3VWp6QUVMQkVBanlBRkJBV29pQUVIL0FVb0VRRUVCSk1rQlFRQWhBQXNnQUNUSUFRc0xnZ0VCQTM4anpBRWhBU0FBUVFSeFFRQkhKTXdCSUFCQkEzRWhBaUFCUlFSQUk4MEJFSEloQUNBQ0VISWhBeVBIQVNFQkk4d0JCSDlCQVNBQWRDQUJjUVZCQVNBQWRDQUJjVUVBUnlJQUJIOUJBU0FEZENBQmNRVWdBQXNMQkVBanlBRkJBV29pQUVIL0FVb0VRRUVCSk1rQlFRQWhBQXNnQUNUSUFRc0xJQUlrelFFTGhRY0JBbjhDUUFKQUlBQkJ6ZjREUmdSQVFjMytBeUFCUVFGeEVBUU1BUXNnQUVIUS9nTkdJNGdDSWdJZ0Foc0VRRUVBSklnQ1FmOEJKSlFDREFJTElBQkJnSUFDU0FSQUlBQWdBUkJkREFFTElBQkJnSUFDVGlJQ0JFQWdBRUdBd0FKSUlRSUxJQUlOQVNBQVFZREFBMDRpQWdSQUlBQkJnUHdEU0NFQ0N5QUNCRUFnQUVHQVFHb2dBUkFFREFJTElBQkJnUHdEVGlJQ0JFQWdBRUdmL1FOTUlRSUxJQUlFUUNQaUFVRUNUZzhMSUFCQm9QMERUaUlDQkVBZ0FFSC8vUU5NSVFJTElBSU5BQ0FBUVlMK0EwWUVRQ0FCUVFGeFFRQkhKTkFCSUFGQkFuRkJBRWNrMFFFZ0FVR0FBWEZCQUVjazBnRkJBUThMSUFCQmtQNERUaUlDQkVBZ0FFR20vZ05NSVFJTElBSUVRQkJZSUFBZ0FSQnNEd3NnQUVHdy9nTk9JZ0lFUUNBQVFiLytBMHdoQWdzZ0FnUkFFRmdqZmdSQUk0TUJRUUYxUWJEK0Eyb2dBUkFFREFJTERBSUxJQUJCd1A0RFRpSUNCRUFnQUVITC9nTk1JUUlMSUFJRVFDQUFRY0QrQTBZRVFDQUJFQ1FNQXdzZ0FFSEIvZ05HQkVCQndmNERJQUZCK0FGeFFjSCtBeEFDUVFkeGNrR0FBWElRQkF3Q0N5QUFRY1QrQTBZRVFFRUFKTzRCSUFCQkFCQUVEQUlMSUFCQnhmNERSZ1JBSUFFazR3RU1Bd3NnQUVIRy9nTkdCRUFnQVJCdERBTUxBa0FDUUFKQUFrQWdBRUhEL2dOSEJFQWdBRUhDL2dOckRnb0JCQVFFQkFRRUJBTUNCQXNnQVNUdkFRd0dDeUFCSlBBQkRBVUxJQUVrOFFFTUJBc2dBU1R5QVF3REN3d0NDeU9BQWlBQVJnUkFJQUVRY0F3QkN5T0hBaUFBUmlJQ1JRUkFJNFlDSUFCR0lRSUxJQUlFUUNPQ0FnUkFBbjhqaEFJaUEwR0FnQUZPSWdJRVFDQURRZi8vQVV3aEFnc2dBa1VMQkVBZ0EwR0FvQU5PSWdJRVFDQURRZisvQTB3aEFnc0xJQUlOQWdzTElBQWpSVTRpQWdSQUlBQWpSMHdoQWdzZ0FnUkFJQUFnQVJCeERBSUxJQUJCaFA0RFRpSUNCRUFnQUVHSC9nTk1JUUlMSUFJRVFCQjFBa0FDUUFKQUFrQWdBRUdFL2dOSEJFQWdBRUdGL2dOckRnTUJBZ01FQ3hCMkRBVUxBa0FqekFFRVFDUEtBUTBCSThrQkJFQkJBQ1RKQVFzTElBRWt5QUVMREFVTElBRWt5d0VqeWdFanpBRWlBQ0FBR3dSQUlBRWt5QUZCQUNUS0FRc01CQXNnQVJCM0RBTUxEQUlMSUFCQmdQNERSZ1JBSUFGQi93RnpKTnNCSTlzQklnSkJFSEZCQUVjazNBRWdBa0VnY1VFQVJ5VGRBUXNnQUVHUC9nTkdCRUFnQVJBVURBSUxJQUJCLy84RFJnUkFJQUVRRXd3Q0MwRUJEd3RCQUE4TFFRRUxId0FqNEFFZ0FFWUVRRUVCSk9FQkN5QUFJQUVRZUFSQUlBQWdBUkFFQ3d0YUFRTi9BMEFDUUNBRElBSk9EUUFnQUNBRGFoQmNJUVVnQVNBRGFpRUVBMEFnQkVIL3Z3SktCRUFnQkVHQVFHb2hCQXdCQ3dzZ0JDQUZFSGtnQTBFQmFpRUREQUVMQ3lPQkFrRWdJNG9DZENBQ1FRUjFiR29rZ1FJTGNnRUNmeU9DQWtVRVFBOExRUkFoQUNPRUFpT0ZBZ0ovSTRNQ0lnRkJFRWdFUUNBQklRQUxJQUFMRUhvamhBSWdBR29raEFJamhRSWdBR29raFFJZ0FTQUFheUlBSklNQ0k0QUNJUUVnQUVFQVRBUkFRUUFrZ2dJZ0FVSC9BUkFFQlNBQklBQkJCSFZCQVd0Qi8zNXhFQVFMQzBBQkFYOGdBRVVpQWdSL0lBSUZJQUJCQVVZTElnQUVmeVB1QVNQakFVWUZJQUFMQkVBZ0FVRUVjaUlCUWNBQWNRUkFFRUFMQlNBQlFYdHhJUUVMSUFFTC9nRUJCWDhqNUFGRkJFQVBDeVBpQVNFQUlBQWo3Z0VpQWtHUUFVNEVmMEVCQlVINEFpT0tBblFpQVNFREkrMEJJZ1FnQVU0RWYwRUNCVUVEUVFBZ0JDQURUaHNMQ3lJQlJ3UkFRY0grQXhBQ0lRQWdBU1RpQVVFQUlRSUNRQUpBQWtBQ1FDQUJCRUFnQVVFQmF3NERBUUlEQkFzZ0FFRjhjU0lBUVFoeFFRQkhJUUlNQXdzZ0FFRjljVUVCY2lJQVFSQnhRUUJISVFJTUFnc2dBRUYrY1VFQ2NpSUFRU0J4UVFCSElRSU1BUXNnQUVFRGNpRUFDeUFDQkVBUVFBc2dBVVVFUUJCN0N5QUJRUUZHQkVCQkFTVEJBVUVBRUQ4TFFjSCtBeUFCSUFBUWZCQUVCU0FDUVprQlJnUkFRY0grQXlBQlFjSCtBeEFDRUh3UUJBc0xDNThCQVFGL0krUUJCRUFqN1FFZ0FHb2s3UUVqTkNFQkEwQWo3UUZCQkNPS0FpSUFkRUhJQXlBQWRDUHVBVUdaQVVZYlRnUkFJKzBCUVFRamlnSWlBSFJCeUFNZ0FIUWo3Z0ZCbVFGR0cyc2s3UUVqN2dFaUFFR1FBVVlFUUNBQkJFQVFQUVVnQUJBOEN4QStRWDhrU0VGL0pFa0ZJQUJCa0FGSUJFQWdBVVVFUUNBQUVEd0xDd3RCQUNBQVFRRnFJQUJCbVFGS0d5VHVBUXdCQ3dzTEVIMExOd0VCZjBFRUk0b0NJZ0IwUWNnRElBQjBJKzRCUVprQlJoc2hBQU5BSSt3QklBQk9CRUFnQUJCK0krd0JJQUJySk93QkRBRUxDd3U0QVFFRWZ5UFNBVVVFUUE4TEEwQWdBeUFBU0FSQUlBTkJCR29oQXdKL0k4NEJJZ0ZCQkdvaUFrSC8vd05LQkVBZ0FrR0FnQVJySVFJTElBSUxKTTRCUVFGQkFrRUhJOUVCR3lJRWRDQUJjVUVBUnlJQkJFQkJBU0FFZENBQ2NVVWhBUXNnQVFSQVFZSCtBMEdCL2dNUUFrRUJkRUVCYWtIL0FYRVFCQ1BQQVVFQmFpSUJRUWhHQkVCQkFDVFBBVUVCSk1RQlFRTVFQMEdDL2dOQmd2NERFQUpCLzM1eEVBUkJBQ1RTQVFVZ0FTVFBBUXNMREFFTEN3dVJBUUFqZ1FKQkFFb0VRQ09CQWlBQWFpRUFRUUFrZ1FJTEk1VUNJQUJxSkpVQ0k1a0NSUVJBSXpJRVFDUHNBU0FBYWlUc0FSQi9CU0FBRUg0TEl6RUVRQ09tQVNBQWFpU21BUkJZQlNBQUVGY0xJQUFRZ0FFTEl6TUVRQ1BHQVNBQWFpVEdBUkIxQlNBQUVIUUxJNXdDSUFCcUlnQWptZ0pPQkVBam13SkJBV29rbXdJZ0FDT2FBbXNoQUFzZ0FDU2NBZ3NNQUVFRUVJRUJJNVFDRUFJTEtRRUJmMEVFRUlFQkk1UUNRUUZxUWYvL0EzRVFBaUVBRUlJQlFmOEJjU0FBUWY4QmNVRUlkSElMRFFCQkJCQ0JBU0FBSUFFUWVRc3dBRUVCSUFCMFFmOEJjU0VBSUFGQkFFb0VRQ09TQWlBQWNrSC9BWEVra2dJRkk1SUNJQUJCL3dGemNTU1NBZ3NMQ1FCQkJTQUFFSVVCQ3pvQkFYOGdBVUVBVGdSQUlBQkJEM0VnQVVFUGNXcEJFSEZCQUVjUWhnRUZJQUZCSDNVaUFpQUJJQUpxYzBFUGNTQUFRUTl4U3hDR0FRc0xDUUJCQnlBQUVJVUJDd2tBUVFZZ0FCQ0ZBUXNKQUVFRUlBQVFoUUVMUFFFQ2Z5QUJRWUQrQTNGQkNIVWhBaUFCUWY4QmNTSUJJUU1nQUNBQkVIZ0VRQ0FBSUFNUUJBc2dBRUVCYWlJQUlBSVFlQVJBSUFBZ0FoQUVDd3NPQUVFSUVJRUJJQUFnQVJDTEFRdGFBQ0FDQkVBZ0FFSC8vd054SWdBZ0FXb2dBQ0FCYzNNaUFFRVFjVUVBUnhDR0FTQUFRWUFDY1VFQVJ4Q0tBUVVnQUNBQmFrSC8vd054SWdJZ0FFSC8vd054U1JDS0FTQUFJQUZ6SUFKelFZQWdjVUVBUnhDR0FRc0xDd0JCQkJDQkFTQUFFRndMcVFVQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVDUUNBQVFRSnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMREJVTEVJTUJRZi8vQTNFaUFFR0EvZ054UVFoMUpJd0NJQUJCL3dGeEpJMENEQThMSTQwQ1FmOEJjU09NQWtIL0FYRkJDSFJ5STRzQ0VJUUJEQk1MSTQwQ1FmOEJjU09NQWtIL0FYRkJDSFJ5UVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkl3Q0RCTUxJNHdDSWdCQkFSQ0hBU0FBUVFGcVFmOEJjU0lBSkl3Q0RBMExJNHdDSWdCQmZ4Q0hBU0FBUVFGclFmOEJjU0lBSkl3Q0RBMExFSUlCUWY4QmNTU01BZ3dOQ3lPTEFpSUFRWUFCY1VHQUFVWVFpZ0VnQUVFQmRDQUFRZjhCY1VFSGRuSkIvd0Z4SklzQ0RBMExFSU1CUWYvL0EzRWprd0lRakFFTUNBc2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISWlBQ09OQWtIL0FYRWpqQUpCL3dGeFFRaDBjaUlCUVFBUWpRRWdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NRQWlBQVFmOEJjU1NSQWtFQUVJa0JRUWdQQ3lPTkFrSC9BWEVqakFKQi93RnhRUWgwY2hDT0FVSC9BWEVraXdJTUN3c2pqUUpCL3dGeEk0d0NRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtqQUlNQ3dzampRSWlBRUVCRUljQklBQkJBV3BCL3dGeElnQWtqUUlNQlFzampRSWlBRUYvRUljQklBQkJBV3RCL3dGeElnQWtqUUlNQlFzUWdnRkIvd0Z4SkkwQ0RBVUxJNHNDSWdCQkFYRkJBRXNRaWdFZ0FFRUhkQ0FBUWY4QmNVRUJkbkpCL3dGeEpJc0NEQVVMUVg4UEN5T1VBa0VDYWtILy93TnhKSlFDREFRTElBQkZFSWdCUVFBUWlRRU1Bd3NnQUVVUWlBRkJBUkNKQVF3Q0N5T1VBa0VCYWtILy93TnhKSlFDREFFTFFRQVFpQUZCQUJDSkFVRUFFSVlCQzBFRUR3c2dBRUgvQVhFa2pRSkJDQXVaQmdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFUVJ3UkFJQUJCRVVZTkFRSkFJQUJCRW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2ppUUlFUUVITi9nTVFqZ0ZCL3dGeElnQkJBWEVFUUVITi9nTWdBRUYrY1NJQVFZQUJjUVIvUVFBa2lnSWdBRUgvZm5FRlFRRWtpZ0lnQUVHQUFYSUxFSVFCUWNRQUR3c0xRUUVrbVFJTUVBc1Fnd0ZCLy84RGNTSUFRWUQrQTNGQkNIVWtqZ0lnQUVIL0FYRWtqd0lqbEFKQkFtcEIvLzhEY1NTVUFnd1JDeU9QQWtIL0FYRWpqZ0pCL3dGeFFRaDBjaU9MQWhDRUFRd1FDeU9QQWtIL0FYRWpqZ0pCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NPQWd3UUN5T09BaUlBUVFFUWh3RWdBRUVCYWtIL0FYRWtqZ0lqamdKRkVJZ0JRUUFRaVFFTURnc2pqZ0lpQUVGL0VJY0JJQUJCQVd0Qi93RnhKSTRDSTQ0Q1JSQ0lBVUVCRUlrQkRBMExFSUlCUWY4QmNTU09BZ3dLQ3lPTEFpSUJRWUFCY1VHQUFVWWhBQ09TQWtFRWRrRUJjU0FCUVFGMGNrSC9BWEVraXdJTUNnc1FnZ0VoQUNPVUFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VrbEFKQkNBOExJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlJZ0FqandKQi93RnhJNDRDUWY4QmNVRUlkSElpQVVFQUVJMEJJQUFnQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVra0FJZ0FFSC9BWEVra1FKQkFCQ0pBVUVJRHdzamp3SkIvd0Z4STQ0Q1FmOEJjVUVJZEhJUWpnRkIvd0Z4SklzQ0RBZ0xJNDhDUWY4QmNTT09Ba0gvQVhGQkNIUnlRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDFKSTRDREFnTEk0OENJZ0JCQVJDSEFTQUFRUUZxUWY4QmNTSUFKSThDSUFCRkVJZ0JRUUFRaVFFTUJnc2pqd0lpQUVGL0VJY0JJQUJCQVd0Qi93RnhJZ0FrandJZ0FFVVFpQUZCQVJDSkFRd0ZDeENDQVVIL0FYRWtqd0lNQWdzaml3SWlBVUVCY1VFQlJpRUFJNUlDUVFSMlFRRnhRUWQwSUFGQi93RnhRUUYyY2lTTEFnd0NDMEYvRHdzamxBSkJBV3BCLy84RGNTU1VBZ3dCQ3lBQUVJb0JRUUFRaUFGQkFCQ0pBVUVBRUlZQkMwRUVEd3NnQUVIL0FYRWtqd0pCQ0F2MUJnRUNmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCSUVjRVFDQUFRU0ZHRFFFQ1FDQUFRU0pyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEk1SUNRUWQyUVFGeEJFQWpsQUpCQVdwQi8vOERjU1NVQWdVUWdnRWhBQ09VQWlBQVFSaDBRUmgxYWtILy93TnhRUUZxUWYvL0EzRWtsQUlMUVFnUEN4Q0RBVUgvL3dOeElnQkJnUDREY1VFSWRTU1FBaUFBUWY4QmNTU1JBaU9VQWtFQ2FrSC8vd054SkpRQ0RCUUxJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlJZ0FqaXdJUWhBRU1Ed3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVra0FJTURRc2prQUlpQUVFQkVJY0JJQUJCQVdwQi93RnhJZ0Fra0FJTURnc2prQUlpQUVGL0VJY0JJQUJCQVd0Qi93RnhJZ0Fra0FJTURnc1FnZ0ZCL3dGeEpKQUNEQTRMUVFaQkFDT1NBaUlDUVFWMlFRRnhRUUJMR3lJQVFlQUFjaUFBSUFKQkJIWkJBWEZCQUVzYklRQWppd0loQVNBQ1FRWjJRUUZ4UVFCTEJIOGdBU0FBYTBIL0FYRUZJQUVnQUVFR2NpQUFJQUZCRDNGQkNVc2JJZ0JCNEFCeUlBQWdBVUdaQVVzYklnQnFRZjhCY1FzaUFVVVFpQUVnQUVIZ0FIRkJBRWNRaWdGQkFCQ0dBU0FCSklzQ0RBNExJNUlDUVFkMlFRRnhRUUJMQkVBUWdnRWhBQ09VQWlBQVFSaDBRUmgxYWtILy93TnhRUUZxUWYvL0EzRWtsQUlGSTVRQ1FRRnFRZi8vQTNFa2xBSUxRUWdQQ3lPUkFrSC9BWEVqa0FKQi93RnhRUWgwY2lJQUlBQkIvLzhEY1VFQUVJMEJJQUJCQVhSQi8vOERjU0lBUVlEK0EzRkJDSFVra0FJZ0FFSC9BWEVra1FKQkFCQ0pBVUVJRHdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJaUFCQ09BVUgvQVhFa2l3SU1Cd3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVra0FJTUJRc2prUUlpQUVFQkVJY0JJQUJCQVdwQi93RnhJZ0Fra1FJTUJnc2prUUlpQUVGL0VJY0JJQUJCQVd0Qi93RnhJZ0Fra1FJTUJnc1FnZ0ZCL3dGeEpKRUNEQVlMSTRzQ1FYOXpRZjhCY1NTTEFrRUJFSWtCUVFFUWhnRU1CZ3RCZnc4TElBQkIvd0Z4SkpFQ1FRZ1BDeUFBUVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkpBQ0lBQkIvd0Z4SkpFQ0RBTUxJQUJGRUlnQlFRQVFpUUVNQWdzZ0FFVVFpQUZCQVJDSkFRd0JDeU9VQWtFQmFrSC8vd054SkpRQ0MwRUVDL0VGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUV3UndSQUlBQkJNVVlOQVFKQUlBQkJNbXNPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamtnSkJCSFpCQVhFRVFDT1VBa0VCYWtILy93TnhKSlFDQlJDQ0FTRUFJNVFDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU1VBZ3RCQ0E4TEVJTUJRZi8vQTNFa2t3SWpsQUpCQW1wQi8vOERjU1NVQWd3UkN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpSUFJNHNDRUlRQkRBNExJNU1DUVFGcVFmLy9BM0Vra3dKQkNBOExJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlJZ0FRamdFaUFVRUJFSWNCSUFGQkFXcEIvd0Z4SWdGRkVJZ0JRUUFRaVFFZ0FDQUJFSVFCREE0TEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUlnQVFqZ0VpQVVGL0VJY0JJQUZCQVd0Qi93RnhJZ0ZGRUlnQlFRRVFpUUVnQUNBQkVJUUJEQTBMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5RUlJQlFmOEJjUkNFQVF3TEMwRUFFSWtCUVFBUWhnRkJBUkNLQVF3TEN5T1NBa0VFZGtFQmNVRUJSZ1JBRUlJQklRQWpsQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpKUUNCU09VQWtFQmFrSC8vd054SkpRQ0MwRUlEd3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElpQUNPVEFrRUFFSTBCSTVNQ0lBQnFRZi8vQTNFaUFFR0EvZ054UVFoMUpKQUNJQUJCL3dGeEpKRUNRUUFRaVFGQkNBOExJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlJZ0FRamdGQi93RnhKSXNDREFZTEk1TUNRUUZyUWYvL0EzRWtrd0pCQ0E4TEk0c0NJZ0JCQVJDSEFTQUFRUUZxUWY4QmNTSUFKSXNDSUFCRkVJZ0JRUUFRaVFFTUJnc2ppd0lpQUVGL0VJY0JJQUJCQVd0Qi93RnhJZ0FraXdJZ0FFVVFpQUZCQVJDSkFRd0ZDeENDQVVIL0FYRWtpd0lNQXd0QkFCQ0pBVUVBRUlZQkk1SUNRUVIyUVFGeFFRQk5FSW9CREFNTFFYOFBDeUFBUVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkpBQ0lBQkIvd0Z4SkpFQ0RBRUxJNVFDUVFGcVFmLy9BM0VrbEFJTFFRUUxnZ0lBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhBQUVjRVFDQUFRY0VBUmcwQkFrQWdBRUhDQUdzT0RnTUVCUVlIQ0FrUkNnc01EUTRQQUFzTUR3c01Ed3NqalFJa2pBSU1EZ3NqamdJa2pBSU1EUXNqandJa2pBSU1EQXNqa0FJa2pBSU1Dd3Nqa1FJa2pBSU1DZ3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRamdGQi93RnhKSXdDREFrTEk0c0NKSXdDREFnTEk0d0NKSTBDREFjTEk0NENKSTBDREFZTEk0OENKSTBDREFVTEk1QUNKSTBDREFRTEk1RUNKSTBDREFNTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJNEJRZjhCY1NTTkFnd0NDeU9MQWlTTkFnd0JDMEYvRHd0QkJBdjlBUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBRWNFUUNBQVFkRUFSZzBCQWtBZ0FFSFNBR3NPRGhBREJBVUdCd2dKQ2hBTERBME9BQXNNRGdzampBSWtqZ0lNRGdzampRSWtqZ0lNRFFzamp3SWtqZ0lNREFzamtBSWtqZ0lNQ3dzamtRSWtqZ0lNQ2dzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRkIvd0Z4Skk0Q0RBa0xJNHNDSkk0Q0RBZ0xJNHdDSkk4Q0RBY0xJNDBDSkk4Q0RBWUxJNDRDSkk4Q0RBVUxJNUFDSkk4Q0RBUUxJNUVDSkk4Q0RBTUxJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFSTRCUWY4QmNTU1BBZ3dDQ3lPTEFpU1BBZ3dCQzBGL0R3dEJCQXY5QVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQUVjRVFDQUFRZUVBUmcwQkFrQWdBRUhpQUdzT0RnTUVFQVVHQndnSkNnc01FQTBPQUFzTURnc2pqQUlra0FJTURnc2pqUUlra0FJTURRc2pqZ0lra0FJTURBc2pqd0lra0FJTUN3c2prUUlra0FJTUNnc2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0ZCL3dGeEpKQUNEQWtMSTRzQ0pKQUNEQWdMSTR3Q0pKRUNEQWNMSTQwQ0pKRUNEQVlMSTQ0Q0pKRUNEQVVMSTQ4Q0pKRUNEQVFMSTVBQ0pKRUNEQU1MSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5RUk0QlFmOEJjU1NSQWd3Q0N5T0xBaVNSQWd3QkMwRi9Ed3RCQkF1YkF3QUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUFSd1JBSUFCQjhRQkdEUUVDUUNBQVFmSUFhdzRPQXdRRkJnY0lDUW9MREEwT0R4RUFDd3dQQ3lPUkFrSC9BWEVqa0FKQi93RnhRUWgwY2lPTUFoQ0VBUXdQQ3lPUkFrSC9BWEVqa0FKQi93RnhRUWgwY2lPTkFoQ0VBUXdPQ3lPUkFrSC9BWEVqa0FKQi93RnhRUWgwY2lPT0FoQ0VBUXdOQ3lPUkFrSC9BWEVqa0FKQi93RnhRUWgwY2lPUEFoQ0VBUXdNQ3lPUkFrSC9BWEVqa0FKQi93RnhRUWgwY2lPUUFoQ0VBUXdMQ3lPUkFrSC9BWEVqa0FKQi93RnhRUWgwY2lPUkFoQ0VBUXdLQ3lPQ0FrVUVRQUpBSTdnQkJFQkJBU1NXQWd3QkN5TzZBU1BBQVhGQkgzRkZCRUJCQVNTWEFnd0JDMEVCSkpnQ0N3c01DUXNqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElqaXdJUWhBRU1DQXNqakFJa2l3SU1Cd3NqalFJa2l3SU1CZ3NqamdJa2l3SU1CUXNqandJa2l3SU1CQXNqa0FJa2l3SU1Bd3Nqa1FJa2l3SU1BZ3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRamdGQi93RnhKSXNDREFFTFFYOFBDMEVFQ3pjQkFYOGdBVUVBVGdSQUlBQkIvd0Z4SUFBZ0FXcEIvd0Z4U3hDS0FRVWdBVUVmZFNJQ0lBRWdBbXB6SUFCQi93RnhTaENLQVFzTE5BRUNmeU9MQWlJQklBQkIvd0Z4SWdJUWh3RWdBU0FDRUpjQklBQWdBV3BCL3dGeElnQWtpd0lnQUVVUWlBRkJBQkNKQVF0WUFRSi9JNHNDSWdFZ0FHb2prZ0pCQkhaQkFYRnFRZjhCY1NJQ0lBQWdBWE56UVJCeFFRQkhFSVlCSUFCQi93RnhJQUZxSTVJQ1FRUjJRUUZ4YWtHQUFuRkJBRXNRaWdFZ0FpU0xBaUFDUlJDSUFVRUFFSWtCQzRzQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR0FBVWNFUUNBQVFZRUJSZzBCQWtBZ0FFR0NBV3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzampBSVFtQUVNRUFzampRSVFtQUVNRHdzampnSVFtQUVNRGdzamp3SVFtQUVNRFFzamtBSVFtQUVNREFzamtRSVFtQUVNQ3dzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRVFtQUVNQ2dzaml3SVFtQUVNQ1FzampBSVFtUUVNQ0FzampRSVFtUUVNQndzampnSVFtUUVNQmdzamp3SVFtUUVNQlFzamtBSVFtUUVNQkFzamtRSVFtUUVNQXdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRVFtUUVNQWdzaml3SVFtUUVNQVF0QmZ3OExRUVFMTndFQ2Z5T0xBaUlCSUFCQi93RnhRWDlzSWdJUWh3RWdBU0FDRUpjQklBRWdBR3RCL3dGeElnQWtpd0lnQUVVUWlBRkJBUkNKQVF0WUFRSi9JNHNDSWdFZ0FHc2prZ0pCQkhaQkFYRnJRZjhCY1NJQ0lBQWdBWE56UVJCeFFRQkhFSVlCSUFFZ0FFSC9BWEZySTVJQ1FRUjJRUUZ4YTBHQUFuRkJBRXNRaWdFZ0FpU0xBaUFDUlJDSUFVRUJFSWtCQzRzQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR1FBVWNFUUNBQVFaRUJSZzBCQWtBZ0FFR1NBV3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzampBSVFtd0VNRUFzampRSVFtd0VNRHdzampnSVFtd0VNRGdzamp3SVFtd0VNRFFzamtBSVFtd0VNREFzamtRSVFtd0VNQ3dzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRVFtd0VNQ2dzaml3SVFtd0VNQ1FzampBSVFuQUVNQ0FzampRSVFuQUVNQndzampnSVFuQUVNQmdzamp3SVFuQUVNQlFzamtBSVFuQUVNQkFzamtRSVFuQUVNQXdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRVFuQUVNQWdzaml3SVFuQUVNQVF0QmZ3OExRUVFMSWdBaml3SWdBSEVpQUNTTEFpQUFSUkNJQVVFQUVJa0JRUUVRaGdGQkFCQ0tBUXNtQUNPTEFpQUFjMEgvQVhFaUFDU0xBaUFBUlJDSUFVRUFFSWtCUVFBUWhnRkJBQkNLQVF1TEFnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJvQUZIQkVBZ0FFR2hBVVlOQVFKQUlBQkJvZ0ZyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEk0d0NFSjRCREJBTEk0MENFSjRCREE4TEk0NENFSjRCREE0TEk0OENFSjRCREEwTEk1QUNFSjRCREF3TEk1RUNFSjRCREFzTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJNEJFSjRCREFvTEk0c0NFSjRCREFrTEk0d0NFSjhCREFnTEk0MENFSjhCREFjTEk0NENFSjhCREFZTEk0OENFSjhCREFVTEk1QUNFSjhCREFRTEk1RUNFSjhCREFNTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJNEJFSjhCREFJTEk0c0NFSjhCREFFTFFYOFBDMEVFQ3lZQUk0c0NJQUJ5UWY4QmNTSUFKSXNDSUFCRkVJZ0JRUUFRaVFGQkFCQ0dBVUVBRUlvQkN5d0JBWDhqaXdJaUFTQUFRZjhCY1VGL2JDSUFFSWNCSUFFZ0FCQ1hBU0FBSUFGcVJSQ0lBVUVCRUlrQkM0c0NBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUd3QVVjRVFDQUFRYkVCUmcwQkFrQWdBRUd5QVdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pqQUlRb1FFTUVBc2pqUUlRb1FFTUR3c2pqZ0lRb1FFTURnc2pqd0lRb1FFTURRc2prQUlRb1FFTURBc2prUUlRb1FFTUN3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRb1FFTUNnc2ppd0lRb1FFTUNRc2pqQUlRb2dFTUNBc2pqUUlRb2dFTUJ3c2pqZ0lRb2dFTUJnc2pqd0lRb2dFTUJRc2prQUlRb2dFTUJBc2prUUlRb2dFTUF3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRb2dFTUFnc2ppd0lRb2dFTUFRdEJmdzhMUVFRTE93RUJmeUFBRUZzaUFVRi9SZ1IvSUFBUUFnVWdBUXRCL3dGeElBQkJBV29pQVJCYklnQkJmMFlFZnlBQkVBSUZJQUFMUWY4QmNVRUlkSElMREFCQkNCQ0JBU0FBRUtRQkN6UUFJQUJCZ0FGeFFZQUJSaENLQVNBQVFRRjBJQUJCL3dGeFFRZDJja0gvQVhFaUFFVVFpQUZCQUJDSkFVRUFFSVlCSUFBTE1nQWdBRUVCY1VFQVN4Q0tBU0FBUVFkMElBQkIvd0Z4UVFGMmNrSC9BWEVpQUVVUWlBRkJBQkNKQVVFQUVJWUJJQUFMT0FFQmZ5T1NBa0VFZGtFQmNTQUFRUUYwY2tIL0FYRWhBU0FBUVlBQmNVR0FBVVlRaWdFZ0FVVVFpQUZCQUJDSkFVRUFFSVlCSUFFTE9RRUJmeU9TQWtFRWRrRUJjVUVIZENBQVFmOEJjVUVCZG5JaEFTQUFRUUZ4UVFGR0VJb0JJQUZGRUlnQlFRQVFpUUZCQUJDR0FTQUJDeW9BSUFCQmdBRnhRWUFCUmhDS0FTQUFRUUYwUWY4QmNTSUFSUkNJQVVFQUVJa0JRUUFRaGdFZ0FBczlBUUYvSUFCQi93RnhRUUYySWdGQmdBRnlJQUVnQUVHQUFYRkJnQUZHR3lJQlJSQ0lBVUVBRUlrQlFRQVFoZ0VnQUVFQmNVRUJSaENLQVNBQkN5c0FJQUJCRDNGQkJIUWdBRUh3QVhGQkJIWnlJZ0JGRUlnQlFRQVFpUUZCQUJDR0FVRUFFSW9CSUFBTEtnRUJmeUFBUWY4QmNVRUJkaUlCUlJDSUFVRUFFSWtCUVFBUWhnRWdBRUVCY1VFQlJoQ0tBU0FCQ3g0QVFRRWdBSFFnQVhGQi93RnhSUkNJQVVFQUVJa0JRUUVRaGdFZ0FRdk5DQUVGZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFSGNTSUVCRUFnQkVFQlJnMEJBa0FnQkVFQ2F3NEdBd1FGQmdjSUFBc01DQXNqakFJaEFRd0hDeU9OQWlFQkRBWUxJNDRDSVFFTUJRc2pqd0loQVF3RUN5T1FBaUVCREFNTEk1RUNJUUVNQWdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRWhBUXdCQ3lPTEFpRUJDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnVUVRQ0FGUVFGR0RRRUNRQ0FGUVFKckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJQUJCQjB3RWZ5QUJFS1lCSVFKQkFRVWdBRUVQVEFSL0lBRVFwd0VoQWtFQkJVRUFDd3NoQXd3UEN5QUFRUmRNQkg4Z0FSQ29BU0VDUVFFRklBQkJIMHdFZnlBQkVLa0JJUUpCQVFWQkFBc0xJUU1NRGdzZ0FFRW5UQVIvSUFFUXFnRWhBa0VCQlNBQVFTOU1CSDhnQVJDckFTRUNRUUVGUVFBTEN5RUREQTBMSUFCQk4wd0VmeUFCRUt3QklRSkJBUVVnQUVFL1RBUi9JQUVRclFFaEFrRUJCVUVBQ3dzaEF3d01DeUFBUWNjQVRBUi9RUUFnQVJDdUFTRUNRUUVGSUFCQnp3Qk1CSDlCQVNBQkVLNEJJUUpCQVFWQkFBc0xJUU1NQ3dzZ0FFSFhBRXdFZjBFQ0lBRVFyZ0VoQWtFQkJTQUFRZDhBVEFSL1FRTWdBUkN1QVNFQ1FRRUZRUUFMQ3lFRERBb0xJQUJCNXdCTUJIOUJCQ0FCRUs0QklRSkJBUVVnQUVIdkFFd0VmMEVGSUFFUXJnRWhBa0VCQlVFQUN3c2hBd3dKQ3lBQVFmY0FUQVIvUVFZZ0FSQ3VBU0VDUVFFRklBQkIvd0JNQkg5QkJ5QUJFSzRCSVFKQkFRVkJBQXNMSVFNTUNBc2dBRUdIQVV3RWZ5QUJRWDV4SVFKQkFRVWdBRUdQQVV3RWZ5QUJRWDF4SVFKQkFRVkJBQXNMSVFNTUJ3c2dBRUdYQVV3RWZ5QUJRWHR4SVFKQkFRVWdBRUdmQVV3RWZ5QUJRWGR4SVFKQkFRVkJBQXNMSVFNTUJnc2dBRUduQVV3RWZ5QUJRVzl4SVFKQkFRVWdBRUd2QVV3RWZ5QUJRVjl4SVFKQkFRVkJBQXNMSVFNTUJRc2dBRUczQVV3RWZ5QUJRYjkvY1NFQ1FRRUZJQUJCdndGTUJIOGdBVUgvZm5FaEFrRUJCVUVBQ3dzaEF3d0VDeUFBUWNjQlRBUi9JQUZCQVhJaEFrRUJCU0FBUWM4QlRBUi9JQUZCQW5JaEFrRUJCVUVBQ3dzaEF3d0RDeUFBUWRjQlRBUi9JQUZCQkhJaEFrRUJCU0FBUWQ4QlRBUi9JQUZCQ0hJaEFrRUJCVUVBQ3dzaEF3d0NDeUFBUWVjQlRBUi9JQUZCRUhJaEFrRUJCU0FBUWU4QlRBUi9JQUZCSUhJaEFrRUJCVUVBQ3dzaEF3d0JDeUFBUWZjQlRBUi9JQUZCd0FCeUlRSkJBUVVnQUVIL0FVd0VmeUFCUVlBQmNpRUNRUUVGUVFBTEN5RURDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQWdCQVJBSUFSQkFVWU5BUUpBSUFSQkFtc09CZ01FQlFZSENBQUxEQWdMSUFJa2pBSU1Cd3NnQWlTTkFnd0dDeUFDSkk0Q0RBVUxJQUlrandJTUJBc2dBaVNRQWd3REN5QUNKSkVDREFJTElBVkJCRWdpQUFSL0lBQUZJQVZCQjBvTEJFQWprUUpCL3dGeEk1QUNRZjhCY1VFSWRISWdBaENFQVFzTUFRc2dBaVNMQWd0QkJFRi9JQU1iQzdzRUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFVY0VRQ0FBUWNFQlJnMEJBa0FnQUVIQ0FXc09EZ01TQkFVR0J3Z0pDZ3NNRVEwT0FBc01EZ3Nqa2dKQkIzWkJBWEVORVF3T0N5T1RBaENsQVVILy93TnhJUUFqa3dKQkFtcEIvLzhEY1NTVEFpQUFRWUQrQTNGQkNIVWtqQUlnQUVIL0FYRWtqUUpCQkE4TEk1SUNRUWQyUVFGeERSRU1EZ3Nqa2dKQkIzWkJBWEVORUF3TUN5T1RBa0VDYTBILy93TnhJZ0Fra3dJZ0FDT05Ba0gvQVhFampBSkIvd0Z4UVFoMGNoQ01BUXdOQ3hDQ0FSQ1lBUXdOQ3lPVEFrRUNhMEgvL3dOeElnQWtrd0lnQUNPVUFoQ01BVUVBSkpRQ0RBc0xJNUlDUVFkMlFRRnhRUUZIRFFvTUJ3c2prd0lpQUJDbEFVSC8vd054SkpRQ0lBQkJBbXBCLy84RGNTU1RBZ3dKQ3lPU0FrRUhka0VCY1VFQlJnMEhEQW9MRUlJQlFmOEJjUkN2QVNFQUk1UUNRUUZxUWYvL0EzRWtsQUlnQUE4TEk1SUNRUWQyUVFGeFFRRkhEUWdqa3dKQkFtdEIvLzhEY1NJQUpKTUNJQUFqbEFKQkFtcEIvLzhEY1JDTUFRd0ZDeENDQVJDWkFRd0dDeU9UQWtFQ2EwSC8vd054SWdBa2t3SWdBQ09VQWhDTUFVRUlKSlFDREFRTFFYOFBDeU9UQWlJQUVLVUJRZi8vQTNFa2xBSWdBRUVDYWtILy93TnhKSk1DUVF3UEN5T1RBa0VDYTBILy93TnhJZ0Fra3dJZ0FDT1VBa0VDYWtILy93TnhFSXdCQ3hDREFVSC8vd054SkpRQ0MwRUlEd3NqbEFKQkFXcEIvLzhEY1NTVUFrRUVEd3NqbEFKQkFtcEIvLzhEY1NTVUFrRU1DNkFFQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUZIQkVBZ0FFSFJBVVlOQVFKQUlBQkIwZ0ZyRGc0REFBUUZCZ2NJQ1FvQUN3QU1EUUFMREEwTEk1SUNRUVIyUVFGeERROE1EUXNqa3dJaUFSQ2xBVUgvL3dOeElRQWdBVUVDYWtILy93TnhKSk1DSUFCQmdQNERjVUVJZFNTT0FpQUFRZjhCY1NTUEFrRUVEd3Nqa2dKQkJIWkJBWEVORHd3TUN5T1NBa0VFZGtFQmNRME9JNU1DUVFKclFmLy9BM0VpQUNTVEFpQUFJNVFDUVFKcVFmLy9BM0VRakFFTUN3c2prd0pCQW10Qi8vOERjU0lBSkpNQ0lBQWpqd0pCL3dGeEk0NENRZjhCY1VFSWRISVFqQUVNQ3dzUWdnRVFtd0VNQ3dzamt3SkJBbXRCLy84RGNTSUFKSk1DSUFBamxBSVFqQUZCRUNTVUFnd0pDeU9TQWtFRWRrRUJjVUVCUncwSURBWUxJNU1DSWdBUXBRRkIvLzhEY1NTVUFrRUJKTGtCSUFCQkFtcEIvLzhEY1NTVEFnd0hDeU9TQWtFRWRrRUJjVUVCUmcwRkRBZ0xJNUlDUVFSMlFRRnhRUUZIRFFjamt3SkJBbXRCLy84RGNTSUFKSk1DSUFBamxBSkJBbXBCLy84RGNSQ01BUXdFQ3hDQ0FSQ2NBUXdGQ3lPVEFrRUNhMEgvL3dOeElnQWtrd0lnQUNPVUFoQ01BVUVZSkpRQ0RBTUxRWDhQQ3lPVEFpSUFFS1VCUWYvL0EzRWtsQUlnQUVFQ2FrSC8vd054SkpNQ1FRd1BDeENEQVVILy93TnhKSlFDQzBFSUR3c2psQUpCQVdwQi8vOERjU1NVQWtFRUR3c2psQUpCQW1wQi8vOERjU1NVQWtFTUM3RURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFGSEJFQWdBRUhoQVVZTkFRSkFJQUJCNGdGckRnNERBQUFFQlFZSENBa0FBQUFLQ3dBTERBc0xFSUlCUWY4QmNVR0EvZ05xSTRzQ0VJUUJEQXNMSTVNQ0lnRVFwUUZCLy84RGNTRUFJQUZCQW1wQi8vOERjU1NUQWlBQVFZRCtBM0ZCQ0hVa2tBSWdBRUgvQVhFa2tRSkJCQThMSTQwQ1FZRCtBMm9qaXdJUWhBRkJCQThMSTVNQ1FRSnJRZi8vQTNFaUFDU1RBaUFBSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5RUl3QlFRZ1BDeENDQVJDZUFRd0hDeU9UQWtFQ2EwSC8vd054SWdBa2t3SWdBQ09VQWhDTUFVRWdKSlFDUVFnUEN4Q0NBVUVZZEVFWWRTRUFJNU1DSUFCQkFSQ05BU09UQWlBQWFrSC8vd054SkpNQ1FRQVFpQUZCQUJDSkFTT1VBa0VCYWtILy93TnhKSlFDUVF3UEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpU1VBa0VFRHdzUWd3RkIvLzhEY1NPTEFoQ0VBU09VQWtFQ2FrSC8vd054SkpRQ1FRUVBDeENDQVJDZkFRd0NDeU9UQWtFQ2EwSC8vd054SWdBa2t3SWdBQ09VQWhDTUFVRW9KSlFDUVFnUEMwRi9Ed3NqbEFKQkFXcEIvLzhEY1NTVUFrRUVDK2NEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGSEJFQWdBRUh4QVVZTkFRSkFJQUJCOGdGckRnNERCQUFGQmdjSUNRb0xBQUFNRFFBTERBMExFSUlCUWY4QmNVR0EvZ05xRUk0QlFmOEJjU1NMQWd3TkN5T1RBaUlCRUtVQlFmLy9BM0VoQUNBQlFRSnFRZi8vQTNFa2t3SWdBRUdBL2dOeFFRaDFKSXNDSUFCQi93RnhKSklDREEwTEk0MENRWUQrQTJvUWpnRkIvd0Z4SklzQ0RBd0xRUUFrdUFFTUN3c2prd0pCQW10Qi8vOERjU0lBSkpNQ0lBQWprZ0pCL3dGeEk0c0NRZjhCY1VFSWRISVFqQUZCQ0E4TEVJSUJFS0VCREFnTEk1TUNRUUpyUWYvL0EzRWlBQ1NUQWlBQUk1UUNFSXdCUVRBa2xBSkJDQThMRUlJQlFSaDBRUmgxSVFBamt3SWhBVUVBRUlnQlFRQVFpUUVnQVNBQVFRRVFqUUVnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTUUFpQUFRZjhCY1NTUkFpT1VBa0VCYWtILy93TnhKSlFDUVFnUEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpU1RBa0VJRHdzUWd3RkIvLzhEY1JDT0FVSC9BWEVraXdJamxBSkJBbXBCLy84RGNTU1VBZ3dGQzBFQkpMa0JEQVFMRUlJQkVLSUJEQUlMSTVNQ1FRSnJRZi8vQTNFaUFDU1RBaUFBSTVRQ0VJd0JRVGdrbEFKQkNBOExRWDhQQ3lPVUFrRUJha0gvL3dOeEpKUUNDMEVFQzlnQkFRRi9JNVFDUVFGcVFmLy9BM0VoQVNPWUFnUkFJQUZCQVd0Qi8vOERjU0VCQ3lBQkpKUUNBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdFRVFDQUJRUUZyRGc0QkFnTUVCUVlIQ0FrS0N3d05EZzhMSUFBUWp3RVBDeUFBRUpBQkR3c2dBQkNSQVE4TElBQVFrZ0VQQ3lBQUVKTUJEd3NnQUJDVUFROExJQUFRbFFFUEN5QUFFSllCRHdzZ0FCQ2FBUThMSUFBUW5RRVBDeUFBRUtBQkR3c2dBQkNqQVE4TElBQVFzQUVQQ3lBQUVMRUJEd3NnQUJDeUFROExJQUFRc3dFTHZnRUJBbjlCQUNTNEFVR1AvZ01RQWtFQklBQjBRWDl6Y1NJQkpNQUJRWS8rQXlBQkVBUWprd0pCQW10Qi8vOERjU1NUQWlPVEFpSUJJNVFDSWdKQi93RnhFQVFnQVVFQmFpQUNRWUQrQTNGQkNIVVFCQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQXdNRUJRQUxEQVVMUVFBa3dRRkJ3QUFrbEFJTUJBdEJBQ1RDQVVISUFDU1VBZ3dEQzBFQUpNTUJRZEFBSkpRQ0RBSUxRUUFreEFGQjJBQWtsQUlNQVF0QkFDVEZBVUhnQUNTVUFnc0wrUUVCQTM4anVRRUVRRUVCSkxnQlFRQWt1UUVMSTdvQkk4QUJjVUVmY1VFQVNnUkFJNWNDUlNPNEFTSUNJQUliQkg4andRRWp1d0VpQUNBQUd3Ui9RUUFRdFFGQkFRVWp3Z0VqdkFFaUFDQUFHd1IvUVFFUXRRRkJBUVVqd3dFanZRRWlBQ0FBR3dSL1FRSVF0UUZCQVFVanhBRWp2Z0VpQUNBQUd3Ui9RUU1RdFFGQkFRVWp4UUVqdndFaUFDQUFHd1IvUVFRUXRRRkJBUVZCQUFzTEN3c0xCVUVBQ3dSQUk1WUNJZ0FqbHdJZ0FCc0VmMEVBSkpjQ1FRQWtsZ0pCQUNTWUFrRUFKSmtDUVJnRlFSUUxJUUVMSTVZQ0lnQWpsd0lnQUJzRVFFRUFKSmNDUVFBa2xnSkJBQ1NZQWtFQUpKa0NDeUFCRHd0QkFBdStBUUVDZjBFQkpLTUNJNWdDQkVBamxBSVFBa0gvQVhFUXRBRVFnUUZCQUNTWEFrRUFKSllDUVFBa21BSkJBQ1NaQWdzUXRnRWlBRUVBU2dSQUlBQVFnUUVMUVFRaEFDT1dBaUlCSTVjQ0lBRWJSU0lCQkg4am1RSkZCU0FCQ3dSQUk1UUNFQUpCL3dGeEVMUUJJUUFMSTVJQ1FmQUJjU1NTQWlBQVFRQk1CRUFnQUE4TElBQVFnUUVqbndKQkFXb2lBU09kQWs0RWZ5T2VBa0VCYWlTZUFpQUJJNTBDYXdVZ0FRc2tud0lqbEFJajNnRkdCRUJCQVNUaEFRc2dBQXNGQUNPMkFRdk1BUUVFZnlBQVFYOUJnQWdnQUVFQVNCc2dBRUVBU2hzaEEwRUFJUUFEUUFKL0FuOGdCRVVpQVFSQUlBQkZJUUVMSUFFTEJFQWdBa1VoQVFzZ0FRc0VRQ1BoQVVVaEFRc2dBUVJBRUxjQlFRQklCRUJCQVNFRUJTT1ZBa0hRcEFRamlnSjBUZ1JBUVFFaEFBVWdBMEYvU2lJQkJFQWp0Z0VnQTA0aEFRdEJBU0FDSUFFYklRSUxDd3dCQ3dzZ0FBUkFJNVVDUWRDa0JDT0tBblJySkpVQ0k2QUNEd3NnQWdSQUk2RUNEd3NqNFFFRVFFRUFKT0VCSTZJQ0R3c2psQUpCQVd0Qi8vOERjU1NVQWtGL0N3Y0FRWDhRdVFFTE9RRURmd05BSUFJZ0FFZ2lBd1IvSUFGQkFFNEZJQU1MQkVCQmZ4QzVBU0VCSUFKQkFXb2hBZ3dCQ3dzZ0FVRUFTQVJBSUFFUEMwRUFDd1VBSTVvQ0N3VUFJNXNDQ3dVQUk1d0NDMXNBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCQWtBZ0FFRUNhdzRHQXdRRkJnY0lBQXNNQ0FzajB3RVBDeVBXQVE4TEk5UUJEd3NqMVFFUEN5UFhBUThMSTlnQkR3c2oyUUVQQ3lQYUFROExRUUFMaHdFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCUmcwQkFrQWdBRUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBVUVBUnlUVEFRd0hDeUFCUVFCSEpOWUJEQVlMSUFGQkFFY2sxQUVNQlFzZ0FVRUFSeVRWQVF3RUN5QUJRUUJISk5jQkRBTUxJQUZCQUVjazJBRU1BZ3NnQVVFQVJ5VFpBUXdCQ3lBQlFRQkhKTm9CQ3d0VkFRRi9RUUFrbVFJZ0FCQy9BVVVFUUVFQklRRUxJQUJCQVJEQUFTQUJCRUJCQVVFQlFRQkJBVUVBSUFCQkEwd2JJZ0FqM0FFaUFTQUJHeHNnQUVVajNRRWlBQ0FBR3hzRVFFRUJKTVVCUVFRUVB3c0xDd2tBSUFCQkFCREFBUXVhQVFBZ0FFRUFTZ1JBUVFBUXdRRUZRUUFRd2dFTElBRkJBRW9FUUVFQkVNRUJCVUVCRU1JQkN5QUNRUUJLQkVCQkFoREJBUVZCQWhEQ0FRc2dBMEVBU2dSQVFRTVF3UUVGUVFNUXdnRUxJQVJCQUVvRVFFRUVFTUVCQlVFRUVNSUJDeUFGUVFCS0JFQkJCUkRCQVFWQkJSRENBUXNnQmtFQVNnUkFRUVlRd1FFRlFRWVF3Z0VMSUFkQkFFb0VRRUVIRU1FQkJVRUhFTUlCQ3dzSEFDQUFKTjRCQ3djQVFYOGszZ0VMQndBZ0FDVGZBUXNIQUVGL0pOOEJDd2NBSUFBazRBRUxCd0JCZnlUZ0FRc0ZBQ09MQWdzRkFDT01BZ3NGQUNPTkFnc0ZBQ09PQWdzRkFDT1BBZ3NGQUNPUUFnc0ZBQ09SQWdzRkFDT1NBZ3NGQUNPVUFnc0ZBQ09UQWdzTEFDT1VBaEFDUWY4QmNRc0ZBQ1B1QVF1dkF3RUtmMEdBZ0FKQmdKQUNJK2NCR3lFSlFZQzRBa0dBc0FJajZBRWJJUW9EUUNBRlFZQUNTQVJBUVFBaEJBTkFJQVJCZ0FKSUJFQWdDU0FGUVFOMVFRVjBJQXBxSUFSQkEzVnFJZ0pCZ0pCK2FpMEFBQkF5SVFjZ0JVRUlieUVCUVFjZ0JFRUliMnNoQmtFQUlRTUNmeUFBUVFCS0k0a0NJZ2dnQ0JzRVFDQUNRWURRZm1vdEFBQWhBd3NnQTBIQUFIRUxCRUJCQnlBQmF5RUJDMEVBSVFJZ0FVRUJkQ0FIYWlJSFFZQ1FmbXBCQVVFQUlBTkJDSEViSWdKQkRYUnFMUUFBSVFoQkFDRUJJQWRCZ1pCK2FpQUNRUTEwYWkwQUFFRUJJQVowY1FSQVFRSWhBUXNnQVVFQmFpQUJRUUVnQm5RZ0NIRWJJUUVnQlVFSWRDQUVha0VEYkNFQ0lBQkJBRW9qaVFJaUJpQUdHd1JBSUFKQmdLRUxhaUlDSUFOQkIzRWdBVUVBRURNaUFVRWZjVUVEZERvQUFDQUNRUUZxSUFGQjRBZHhRUVYxUVFOME9nQUFJQUpCQW1vZ0FVR0ErQUZ4UVFwMVFRTjBPZ0FBQlNBQ1FZQ2hDMm9pQXlBQlFjZitBeEEwSWdGQmdJRDhCM0ZCRUhVNkFBQWdBMEVCYWlBQlFZRCtBM0ZCQ0hVNkFBQWdBMEVDYWlBQk9nQUFDeUFFUVFGcUlRUU1BUXNMSUFWQkFXb2hCUXdCQ3dzTDJ3TUJESDhEUUNBRVFSZE9SUVJBUVFBaEF3TkFJQU5CSDBnRVFFRUJRUUFnQTBFUFNpSUhHeUVKSUFSQkQyc2dCQ0FFUVE5S0lnQWJRUVIwSWdVZ0EwRVBhMm9nQXlBRmFpQUhHeUVJUVlDUUFrR0FnQUlnQUJzaENrSEgvZ01oQjBGL0lRWkJmeUVGUVFBaEFRTkFJQUZCQ0VnRVFFRUFJUUFEUUNBQVFRVklCRUFnQUVFRGRDQUJha0VDZENJQ1FZTDhBMm9RQWlBSVJnUkFJQUpCZy93RGFoQUNJUUpCQVVFQUlBSkJDSEZCQUVjamlRSWppUUliR3lBSlJnUkFRUWdoQVVFRklRQWdBaUlGUVJCeEJIOUJ5ZjREQlVISS9nTUxJUWNMQ3lBQVFRRnFJUUFNQVFzTElBRkJBV29oQVF3QkN3c2dCVUVBU0NPSkFpSUFJQUFiQkVCQmdMZ0NRWUN3QWlQb0FSc2hDMEYvSVFCQkFDRUNBMEFnQWtFZ1NBUkFRUUFoQVFOQUlBRkJJRWdFUUNBQlFRVjBJQXRxSUFKcUlnWkJnSkIrYWkwQUFDQUlSZ1JBUVNBaEFrRWdJUUVnQmlFQUN5QUJRUUZxSVFFTUFRc0xJQUpCQVdvaEFnd0JDd3NnQUVFQVRnUi9JQUJCZ05CK2FpMEFBQVZCZndzaEJndEJBQ0VBQTBBZ0FFRUlTQVJBSUFnZ0NpQUpRUUJCQnlBQUlBTkJBM1FnQkVFRGRDQUFha0g0QVVHQW9SY2dCeUFHSUFVUU5Sb2dBRUVCYWlFQURBRUxDeUFEUVFGcUlRTU1BUXNMSUFSQkFXb2hCQXdCQ3dzTG1nSUJDWDhEUUNBRVFRaE9SUVJBUVFBaEFRTkFJQUZCQlVnRVFDQUJRUU4wSUFScVFRSjBJZ0JCZ1B3RGFoQUNHaUFBUVlIOEEyb1FBaG9nQUVHQy9BTnFFQUloQWtFQklRVWo2UUVFUUNBQ1FRSnZRUUZHQkVBZ0FrRUJheUVDQzBFQ0lRVUxJQUJCZy93RGFoQUNJUVpCQUNFSFFRRkJBQ0FHUVFoeFFRQkhJNGtDSTRrQ0d4c2hCMEhJL2dNaENFSEovZ05CeVA0RElBWkJFSEViSVFoQkFDRUFBMEFnQUNBRlNBUkFRUUFoQXdOQUlBTkJDRWdFUUNBQUlBSnFRWUNBQWlBSFFRQkJCeUFESUFSQkEzUWdBVUVFZENBRGFpQUFRUU4wYWtIQUFFR0FvU0FnQ0VGL0lBWVFOUm9nQTBFQmFpRUREQUVMQ3lBQVFRRnFJUUFNQVFzTElBRkJBV29oQVF3QkN3c2dCRUVCYWlFRURBRUxDd3NGQUNQSEFRc0ZBQ1BJQVFzRkFDUExBUXNZQVFGL0k4MEJJUUFqekFFRVFDQUFRUVJ5SVFBTElBQUxNQUVCZndOQUFrQWdBRUgvL3dOT0RRQWdBRUdBdGNrRWFpQUFFRnc2QUFBZ0FFRUJhaUVBREFFTEMwRUFKT0VCQ3hZQUVBQS9BRUdVQVVnRVFFR1VBVDhBYTBBQUdnc0xBd0FCQ3gwQUFrQUNRQUpBSTZRQ0RnSUJBZ0FMQUF0QkFDRUFDeUFBRUxrQkN3Y0FJQUFrcEFJTEpRQUNRQUpBQWtBQ1FDT2tBZzREQVFJREFBc0FDMEVCSVFBTFFYOGhBUXNnQVJDNUFRc0FNeEJ6YjNWeVkyVk5ZWEJ3YVc1blZWSk1JV052Y21VdlpHbHpkQzlqYjNKbExuVnVkRzkxWTJobFpDNTNZWE50TG0xaGNBPT0iKToKInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93fHwidW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmP2F3YWl0IEkoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZ1FFUVlBQUFZQXAvZjM5L2YzOS9mMzkvQUdBQmZ3Ri9ZQUYvQUdBQ2YzOEFZQUovZndGL1lBQUJmMkFEZjM5L0FHQUdmMzkvZjM5L0FHQUhmMzkvZjM5L2Z3Ri9ZQU4vZjM4QmYyQUhmMzkvZjM5L2Z3QmdCSDkvZjM4QmYyQUlmMzkvZjM5L2YzOEFZQVYvZjM5L2Z3Ri9ZQTEvZjM5L2YzOS9mMzkvZjM5L0FYOEQ1UUhqQVFBQ0FnQUVBQUFEQXdBQUFBQUFBQUFEQUFBREF3QUFBQUFCQmdBQUFBQUFBQUFBQXdNQUFBQUFBQUFBQUFZR0JnWU9CUW9GRHdrTENBZ0hCQU1BQUFNQUFBQUFBQU1BQUFBQUFnSUZBZ0lHQUFJQ0JRd0RBd01BQWdZQ0FnUURBd01EQXdNQUF3QURBQU1BQXdVREJnWURCQUlGQXdBQUF3VUVCd0FGQUFNQUF3TUdCZ1FFQXdRREF3TUVCQWNDQWdJQ0FnSUNBZ0lFQXdNQ0F3TUNBd01DQXdNQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJREJnWUdBZ1lDQmdZR0FnUURBdzBEQUFNQUF3QUdCZ1lHQmdZR0JnWUdCZ1lEQUFBR0JnWUdBQUFBQWdNRkJBUUJjQUFCQlFNQkFBQUd1Z3lsQW44QVFRQUxmd0JCZ0FnTGZ3QkJnQWdMZndCQmdBZ0xmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FFQXQvQUVHQWdBUUxmd0JCZ0pBRUMzOEFRWUFCQzM4QVFZQ1JCQXQvQUVHQXVBRUxmd0JCZ01rRkMzOEFRWURZQlF0L0FFR0FvUXNMZndCQmdJQU1DMzhBUVlDaEZ3dC9BRUdBZ0FrTGZ3QkJnS0VnQzM4QVFZRDRBQXQvQUVHQWtBUUxmd0JCZ0lrZEMzOEFRWUNaSVF0L0FFR0FnQWdMZndCQmdKa3BDMzhBUVlDQUNBdC9BRUdBbVRFTGZ3QkJnSUFJQzM4QVFZQ1pPUXQvQUVHQWdBZ0xmd0JCZ0puQkFBdC9BRUdBZ0FnTGZ3QkJnSm5KQUF0L0FFR0FnQWdMZndCQmdKblJBQXQvQUVHQUZBdC9BRUdBcmRFQUMzOEFRWUNJK0FNTGZ3QkJnTFhKQkF0L0FFSC8vd01MZndCQkFBdC9BRUdBdGMwRUMzOEFRWlFCQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkI2UDREQzM4QlFlbitBd3QvQVVIci9nTUxmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJ3QUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIQUFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBQWd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhBQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJ4TmdDQzM4QlFRQUxmd0ZCQUF0L0FVR0FnQWdMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWRIK0F3dC9BVUhTL2dNTGZ3RkIwLzREQzM4QlFkVCtBd3QvQVVIVi9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRYy8rQXd0L0FVSHcvZ01MZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmdLald1UWNMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBZ3QvQVVFQUMzOEJRUUFMQjdzUVlRWnRaVzF2Y25rQ0FBVjBZV0pzWlFFQUJtTnZibVpwWndBWkRtaGhjME52Y21WVGRHRnlkR1ZrQUJvSmMyRjJaVk4wWVhSbEFDRUpiRzloWkZOMFlYUmxBQ3dGYVhOSFFrTUFMUkpuWlhSVGRHVndjMUJsY2xOMFpYQlRaWFFBTGd0blpYUlRkR1Z3VTJWMGN3QXZDR2RsZEZOMFpYQnpBREFWWlhobFkzVjBaVTExYkhScGNHeGxSbkpoYldWekFMc0JER1Y0WldOMWRHVkdjbUZ0WlFDNkFRaGZjMlYwWVhKbll3RGhBUmxsZUdWamRYUmxSbkpoYldWQmJtUkRhR1ZqYTBGMVpHbHZBT0FCRldWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJnRGlBUXRsZUdWamRYUmxVM1JsY0FDM0FSUm5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkQUM4QVF4blpYUkRlV05zWlZObGRITUF2UUVKWjJWMFEzbGpiR1Z6QUw0QkRuTmxkRXB2ZVhCaFpGTjBZWFJsQU1NQkgyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWElBdUFFUVkyeGxZWEpCZFdScGIwSjFabVpsY2dBb0hITmxkRTFoYm5WaGJFTnZiRzl5YVhwaGRHbHZibEJoYkdWMGRHVUFCeGRYUVZOTlFrOVpYMDFGVFU5U1dWOU1UME5CVkVsUFRnTXNFMWRCVTAxQ1QxbGZUVVZOVDFKWlgxTkpXa1VETFJKWFFWTk5RazlaWDFkQlUwMWZVRUZIUlZNRExoNUJVMU5GVFVKTVdWTkRVa2xRVkY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQUJwQlUxTkZUVUpNV1ZORFVrbFFWRjlOUlUxUFVsbGZVMGxhUlFNQkZsZEJVMDFDVDFsZlUxUkJWRVZmVEU5RFFWUkpUMDREQWhKWFFWTk5RazlaWDFOVVFWUkZYMU5KV2tVREF5QkhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNS0hFZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURDeEpXU1VSRlQxOVNRVTFmVEU5RFFWUkpUMDREQkE1V1NVUkZUMTlTUVUxZlUwbGFSUU1GRVZkUFVrdGZVa0ZOWDB4UFEwRlVTVTlPQXdZTlYwOVNTMTlTUVUxZlUwbGFSUU1ISms5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3Z2lUMVJJUlZKZlIwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVTBsYVJRTUpHRWRTUVZCSVNVTlRYMDlWVkZCVlZGOU1UME5CVkVsUFRnTVlGRWRTUVZCSVNVTlRYMDlWVkZCVlZGOVRTVnBGQXhrVVIwSkRYMUJCVEVWVVZFVmZURTlEUVZSSlQwNEREQkJIUWtOZlVFRk1SVlJVUlY5VFNWcEZBdzBZUWtkZlVGSkpUMUpKVkZsZlRVRlFYMHhQUTBGVVNVOU9BdzRVUWtkZlVGSkpUMUpKVkZsZlRVRlFYMU5KV2tVRER3NUdVa0ZOUlY5TVQwTkJWRWxQVGdNUUNrWlNRVTFGWDFOSldrVURFUmRDUVVOTFIxSlBWVTVFWDAxQlVGOU1UME5CVkVsUFRnTVNFMEpCUTB0SFVrOVZUa1JmVFVGUVgxTkpXa1VERXhKVVNVeEZYMFJCVkVGZlRFOURRVlJKVDA0REZBNVVTVXhGWDBSQlZFRmZVMGxhUlFNVkVrOUJUVjlVU1V4RlUxOU1UME5CVkVsUFRnTVdEazlCVFY5VVNVeEZVMTlUU1ZwRkF4Y1ZRVlZFU1U5ZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXlJUlFWVkVTVTlmUWxWR1JrVlNYMU5KV2tVREl4bERTRUZPVGtWTVh6RmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4b1ZRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOVRTVnBGQXhzWlEwaEJUazVGVEY4eVgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNY0ZVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlUwbGFSUU1kR1VOSVFVNU9SVXhmTTE5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESGhWRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDFOSldrVURIeGxEU0VGT1RrVk1YelJmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeUFWUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlUU1ZwRkF5RVdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNa0VrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTWxFVUpQVDFSZlVrOU5YMHhQUTBGVVNVOU9BeVlOUWs5UFZGOVNUMDFmVTBsYVJRTW5Ga05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0REtCSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURLUjFFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNcUdVUkZRbFZIWDBkQlRVVkNUMWxmVFVWTlQxSlpYMU5KV2tVREt5Rm5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRQUFSdHpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUF4QUVkY21WelpYUlFjbTluY21GdFEyOTFiblJsY2tKeVpXRnJjRzlwYm5RQXhRRVpjMlYwVW1WaFpFZGlUV1Z0YjNKNVFuSmxZV3R3YjJsdWRBREdBUnR5WlhObGRGSmxZV1JIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBeHdFYWMyVjBWM0pwZEdWSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQXlBRWNjbVZ6WlhSWGNtbDBaVWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURKQVF4blpYUlNaV2RwYzNSbGNrRUF5Z0VNWjJWMFVtVm5hWE4wWlhKQ0FNc0JER2RsZEZKbFoybHpkR1Z5UXdETUFReG5aWFJTWldkcGMzUmxja1FBelFFTVoyVjBVbVZuYVhOMFpYSkZBTTRCREdkbGRGSmxaMmx6ZEdWeVNBRFBBUXhuWlhSU1pXZHBjM1JsY2t3QTBBRU1aMlYwVW1WbmFYTjBaWEpHQU5FQkVXZGxkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFOSUJEMmRsZEZOMFlXTnJVRzlwYm5SbGNnRFRBUmxuWlhSUGNHTnZaR1ZCZEZCeWIyZHlZVzFEYjNWdWRHVnlBTlFCQldkbGRFeFpBTlVCSFdSeVlYZENZV05yWjNKdmRXNWtUV0Z3Vkc5WFlYTnRUV1Z0YjNKNUFOWUJHR1J5WVhkVWFXeGxSR0YwWVZSdlYyRnpiVTFsYlc5eWVRRFhBUk5rY21GM1QyRnRWRzlYWVhOdFRXVnRiM0o1QU5nQkJtZGxkRVJKVmdEWkFRZG5aWFJVU1UxQkFOb0JCbWRsZEZSTlFRRGJBUVpuWlhSVVFVTUEzQUVUZFhCa1lYUmxSR1ZpZFdkSFFrMWxiVzl5ZVFEZEFRZ0MzZ0VKQ0FFQVFRQUxBZDhCQ3ZuekFlTUJVd0JCOHVYTEJ5UTVRYURCZ2dVa09rSFlzT0VDSkR0QmlKQWdKRHhCOHVYTEJ5UTlRYURCZ2dVa1BrSFlzT0VDSkQ5QmlKQWdKRUJCOHVYTEJ5UkJRYURCZ2dVa1FrSFlzT0VDSkVOQmlKQWdKRVFMcGdJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJESFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPREFJQ0F3TURBd1FFQlFVR0J3QUxEQWNMSTRnQ0JFQWppUUlFUUNBQVFZQUNTQTBKSUFCQi93TktJZ0VFZnlBQVFZQVNTQVVnQVFzTkNRVWppUUpGSWdFRWZ5QUFRWUFDU0FVZ0FRc05DUXNMQ3lBQVFZQ3QwUUJxRHdzZ0FFRUJJL01CSWdFait3RkZJZ0FFZnlBQlJRVWdBQXNiUVE1MGFrR0FyZEFBYWc4TElBQkJnSkIrYWlPSkFnUi9JNFlDRUFKQkFYRUZRUUFMUVExMGFnOExJQUFqOUFGQkRYUnFRWURaeGdCcUR3c2dBRUdBa0g1cUR3dEJBQ0VCQW44amlRSUVRQ09IQWhBQ1FRZHhJUUVMSUFGQkFVZ0xCSDlCQVFVZ0FRdEJESFFnQUdwQmdQQjlhZzhMSUFCQmdGQnFEd3NnQUVHQW1kRUFhZ3NKQUNBQUVBRXRBQUFMd3dFQVFRQWtpZ0pCQUNTTEFrRUFKSXdDUVFBa2pRSkJBQ1NPQWtFQUpJOENRUUFra0FKQkFDU1JBa0VBSkpJQ1FRQWtrd0pCQUNTVUFrRUFKSlVDUVFBa2xnSkJBQ1NYQWtFQUpKZ0NRUUFrbVFJamlBSUVRQThMSTRrQ0JFQkJFU1NMQWtHQUFTU1NBa0VBSkl3Q1FRQWtqUUpCL3dFa2pnSkIxZ0FrandKQkFDU1FBa0VOSkpFQ0JVRUJKSXNDUWJBQkpKSUNRUUFrakFKQkV5U05Ba0VBSkk0Q1FkZ0JKSThDUVFFa2tBSkJ6UUFra1FJTFFZQUNKSlFDUWY3L0F5U1RBZ3NMQUNBQUVBRWdBVG9BQUF1SkFRRUNmMEVBSlBVQlFRRWs5Z0ZCeHdJUUFpSUJSU1QzQVNBQlFRRk9JZ0FFUUNBQlFRTk1JUUFMSUFBaytBRWdBVUVGVGlJQUJFQWdBVUVHVENFQUN5QUFKUGtCSUFGQkQwNGlBQVJBSUFGQkUwd2hBQXNnQUNUNkFTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQWsrd0ZCQVNUekFVRUFKUFFCSTRZQ1FRQVFCQ09IQWtFQkVBUUxMd0JCMGY0RFFmOEJFQVJCMHY0RFFmOEJFQVJCMC80RFFmOEJFQVJCMVA0RFFmOEJFQVJCMWY0RFFmOEJFQVFMc0FnQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0N3TUVCUVlIQ0FrS0N3d05BQXNNRFF0Qjh1WExCeVE1UWFEQmdnVWtPa0hZc09FQ0pEdEJpSkFnSkR4Qjh1WExCeVE5UWFEQmdnVWtQa0hZc09FQ0pEOUJpSkFnSkVCQjh1WExCeVJCUWFEQmdnVWtRa0hZc09FQ0pFTkJpSkFnSkVRTURBdEIvLy8vQnlRNVFlUGEvZ2NrT2tHQTRwQUVKRHRCQUNROFFmLy8vd2NrUFVIajJ2NEhKRDVCZ09LUUJDUS9RUUFrUUVILy8vOEhKRUZCNDlyK0J5UkNRWURpa0FRa1EwRUFKRVFNQ3d0Qi8vLy9CeVE1UVlTSi9nY2tPa0c2OU5BRUpEdEJBQ1E4UWYvLy93Y2tQVUd4L3U4REpENUJnSWdDSkQ5QkFDUkFRZi8vL3dja1FVSC95NDRESkVKQi93RWtRMEVBSkVRTUNndEJ4YzMvQnlRNVFZUzV1Z1lrT2tHcDFwRUVKRHRCaU9Mb0FpUThRZi8vL3dja1BVSGoydjRISkQ1QmdPS1FCQ1EvUVFBa1FFSC8vLzhISkVGQjQ5citCeVJDUVlEaWtBUWtRMEVBSkVRTUNRdEIvLy8vQnlRNVFZRCt5d0lrT2tHQWhQMEhKRHRCQUNROFFmLy8vd2NrUFVHQS9zc0NKRDVCZ0lUOUJ5US9RUUFrUUVILy8vOEhKRUZCZ1A3TEFpUkNRWUNFL1Fja1EwRUFKRVFNQ0F0Qi8vLy9CeVE1UWJIKzd3TWtPa0hGeHdFa08wRUFKRHhCLy8vL0J5UTlRWVNKL2dja1BrRzY5TkFFSkQ5QkFDUkFRZi8vL3dja1FVR0VpZjRISkVKQnV2VFFCQ1JEUVFBa1JBd0hDMEVBSkRsQmhJa0NKRHBCZ0x6L0J5UTdRZi8vL3dja1BFRUFKRDFCaElrQ0pENUJnTHovQnlRL1FmLy8vd2NrUUVFQUpFRkJoSWtDSkVKQmdMei9CeVJEUWYvLy93Y2tSQXdHQzBHbC8vOEhKRGxCbEtuK0J5UTZRZitwMGdRa08wRUFKRHhCcGYvL0J5UTlRWlNwL2dja1BrSC9xZElFSkQ5QkFDUkFRYVgvL3dja1FVR1VxZjRISkVKQi82blNCQ1JEUVFBa1JBd0ZDMEgvLy84SEpEbEJnUDcvQnlRNlFZQ0EvQWNrTzBFQUpEeEIvLy8vQnlROVFZRCsvd2NrUGtHQWdQd0hKRDlCQUNSQVFmLy8vd2NrUVVHQS92OEhKRUpCZ0lEOEJ5UkRRUUFrUkF3RUMwSC8vLzhISkRsQmdQNy9CeVE2UVlDVTdRTWtPMEVBSkR4Qi8vLy9CeVE5UWYvTGpnTWtQa0gvQVNRL1FRQWtRRUgvLy84SEpFRkJzZjd2QXlSQ1FZQ0lBaVJEUVFBa1JBd0RDMEgvLy84SEpEbEIvOHVPQXlRNlFmOEJKRHRCQUNROFFmLy8vd2NrUFVHRWlmNEhKRDVCdXZUUUJDUS9RUUFrUUVILy8vOEhKRUZCc2Y3dkF5UkNRWUNJQWlSRFFRQWtSQXdDQzBILy8vOEhKRGxCM3BteUJDUTZRWXlseVFJa08wRUFKRHhCLy8vL0J5UTlRWVNKL2dja1BrRzY5TkFFSkQ5QkFDUkFRZi8vL3dja1FVSGoydjRISkVKQmdPS1FCQ1JEUVFBa1JBd0JDMEgvLy84SEpEbEJwY3VXQlNRNlFkS2t5UUlrTzBFQUpEeEIvLy8vQnlROVFhWExsZ1VrUGtIU3BNa0NKRDlCQUNSQVFmLy8vd2NrUVVHbHk1WUZKRUpCMHFUSkFpUkRRUUFrUkFzTDJnZ0FBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJpQUZIQkVBZ0FFSGhBRVlOQVNBQVFSUkdEUUlnQUVIR0FFWU5BeUFBUWRrQVJnMEVJQUJCeGdGR0RRUWdBRUdHQVVZTkJTQUFRYWdCUmcwRklBQkJ2d0ZHRFFZZ0FFSE9BVVlOQmlBQVFkRUJSZzBHSUFCQjhBRkdEUVlnQUVFblJnMEhJQUJCeVFCR0RRY2dBRUhjQUVZTkJ5QUFRYk1CUmcwSElBQkJ5UUZHRFFnZ0FFSHdBRVlOQ1NBQVFjWUFSZzBLSUFCQjB3RkdEUXNNREF0Qi83bVdCU1E1UVlEKy93Y2tPa0dBeGdFa08wRUFKRHhCLzdtV0JTUTlRWUQrL3dja1BrR0F4Z0VrUDBFQUpFQkIvN21XQlNSQlFZRCsvd2NrUWtHQXhnRWtRMEVBSkVRTUN3dEIvLy8vQnlRNVFmL0xqZ01rT2tIL0FTUTdRUUFrUEVILy8vOEhKRDFCaEluK0J5UStRYnIwMEFRa1AwRUFKRUJCLy8vL0J5UkJRZi9MamdNa1FrSC9BU1JEUVFBa1JBd0tDMEgvLy84SEpEbEJoSW4rQnlRNlFicjAwQVFrTzBFQUpEeEIvLy8vQnlROVFiSCs3d01rUGtHQWlBSWtQMEVBSkVCQi8vLy9CeVJCUVlTSi9nY2tRa0c2OU5BRUpFTkJBQ1JFREFrTFFmL3IxZ1VrT1VHVS8vOEhKRHBCd3JTMUJTUTdRUUFrUEVFQUpEMUIvLy8vQnlRK1FZU0ovZ2NrUDBHNjlOQUVKRUJCQUNSQlFmLy8vd2NrUWtHRWlmNEhKRU5CdXZUUUJDUkVEQWdMUWYvLy93Y2tPVUdFMjdZRkpEcEIrK2FKQWlRN1FRQWtQRUgvLy84SEpEMUJnT2I5QnlRK1FZQ0UwUVFrUDBFQUpFQkIvLy8vQnlSQlFmLzc2Z0lrUWtHQWdQd0hKRU5CL3dFa1JBd0hDMEdjLy84SEpEbEIvK3ZTQkNRNlFmT29qZ01rTzBHNjlBQWtQRUhDaXY4SEpEMUJnS3ovQnlRK1FZRDAwQVFrUDBHQWdLZ0NKRUJCLy8vL0J5UkJRWVNKL2dja1FrRzY5TkFFSkVOQkFDUkVEQVlMUVlEK3J3TWtPVUgvLy84SEpEcEJ5cVQ5QnlRN1FRQWtQRUgvLy84SEpEMUIvLy8vQnlRK1FmL0xqZ01rUDBIL0FTUkFRZi8vL3dja1FVSGoydjRISkVKQmdPS1FCQ1JEUVFBa1JBd0ZDMEgvdVpZRkpEbEJnUDcvQnlRNlFZREdBU1E3UVFBa1BFSFN4djBISkQxQmdJRFlCaVErUVlDQWpBTWtQMEVBSkVCQi93RWtRVUgvLy84SEpFSkIrLzcvQnlSRFFmK0pBaVJFREFRTFFjNy8vd2NrT1VIdjM0OERKRHBCc1lqeUJDUTdRZHEwNlFJa1BFSC8vLzhISkQxQmdPYjlCeVErUVlDRTBRUWtQMEVBSkVCQi8vLy9CeVJCUWYvTGpnTWtRa0gvQVNSRFFRQWtSQXdEQzBILy8vOEhKRGxCaEluK0J5UTZRYnIwMEFRa08wRUFKRHhCLy8vL0J5UTlRWUQrQXlRK1FZQ0l4Z0VrUDBHQWxBRWtRRUgvLy84SEpFRkIvOHVPQXlSQ1FmOEJKRU5CQUNSRURBSUxRZi8vL3dja09VSC95NDRESkRwQi93RWtPMEVBSkR4QmdQNy9CeVE5UVlDQS9BY2tQa0dBZ0l3REpEOUJBQ1JBUWYvLy93Y2tRVUd4L3U4REpFSkJnSWdDSkVOQkFDUkVEQUVMUWYvLy93Y2tPVUdFMjdZRkpEcEIrK2FKQWlRN1FRQWtQRUgvLy84SEpEMUI0OXIrQnlRK1FlUGEvZ2NrUDBFQUpFQkIvLy8vQnlSQlFmL0xqZ01rUWtIL0FTUkRRUUFrUkFzTFNnRUNmMEVBRUFjamlRSUVRQThMSTRnQ0JFQWppUUpGQkVBUEN3dEJ0QUloQUFOQUFrQWdBRUhEQWtvTkFDQUFFQUlnQVdvaEFTQUFRUUZxSVFBTUFRc0xJQUZCL3dGeEVBZ0wzQUVBUVFBazdBRkJBQ1R0QVVFQUpPNEJRUUFrN3dGQkFDVHdBVUVBSlBFQlFRQWs4Z0ZCa0FFazdnRWppUUlFUUVIQi9nTkJnUUVRQkVIRS9nTkJrQUVRQkVISC9nTkIvQUVRQkFWQndmNERRWVVCRUFSQnh2NERRZjhCRUFSQngvNERRZndCRUFSQnlQNERRZjhCRUFSQnlmNERRZjhCRUFRTFFaQUJKTzRCUWNEK0EwR1FBUkFFUWMvK0EwRUFFQVJCOFA0RFFRRVFCQ09JQWdSQUk0a0NCRUJCQUNUdUFVSEEvZ05CQUJBRVFjSCtBMEdBQVJBRVFjVCtBMEVBRUFRRlFRQWs3Z0ZCd1A0RFFRQVFCRUhCL2dOQmhBRVFCQXNMRUFrTGJnQWppUUlFUUVIby9nTkJ3QUVRQkVIcC9nTkIvd0VRQkVIcS9nTkJ3UUVRQkVIci9nTkJEUkFFQlVIby9nTkIvd0VRQkVIcC9nTkIvd0VRQkVIcS9nTkIvd0VRQkVIci9nTkIvd0VRQkFzamlRSWppQUlqaUFJYkJFQkI2ZjREUVNBUUJFSHIvZ05CaWdFUUJBc0xWZ0JCa1A0RFFZQUJFQVJCa2Y0RFFiOEJFQVJCa3Y0RFFmTUJFQVJCay80RFFjRUJFQVJCbFA0RFFiOEJFQVFqaUFJRVFFR1IvZ05CUHhBRVFaTCtBMEVBRUFSQmsvNERRUUFRQkVHVS9nTkJ1QUVRQkFzTExBQkJsZjREUWY4QkVBUkJsdjREUVQ4UUJFR1gvZ05CQUJBRVFaaitBMEVBRUFSQm1mNERRYmdCRUFRTE13QkJtdjREUWY4QUVBUkJtLzREUWY4QkVBUkJuUDREUVo4QkVBUkJuZjREUVFBUUJFR2UvZ05CdUFFUUJFRUJKSVVCQ3kwQVFaLytBMEgvQVJBRVFhRCtBMEgvQVJBRVFhSCtBMEVBRUFSQm92NERRUUFRQkVHai9nTkJ2d0VRQkF0Y0FDQUFRWUFCY1VFQVJ5U3NBU0FBUWNBQWNVRUFSeVNyQVNBQVFTQnhRUUJISktvQklBQkJFSEZCQUVja3FRRWdBRUVJY1VFQVJ5U3dBU0FBUVFSeFFRQkhKSzhCSUFCQkFuRkJBRWNrcmdFZ0FFRUJjVUVBUnlTdEFRdEZBRUVQSkprQlFROGttZ0ZCRHlTYkFVRVBKSndCUVFBa25RRkJBQ1NlQVVFQUpKOEJRUUFrb0FGQi93QWtvUUZCL3dBa29nRkJBU1NqQVVFQkpLUUJRUUFrcFFFTHZRRUFRUUFrcGdGQkFDU25BVUVBSktnQlFRRWtxUUZCQVNTcUFVRUJKS3NCUVFFa3JBRkJBU1N0QVVFQkpLNEJRUUVrcndGQkFTU3dBVUVCSkxFQlFRQWtzZ0ZCQUNTekFVRUFKTFVCUVFBa3RnRVFEQkFORUE0UUQwR2svZ05COXdBUUJFRUhKS2NCUVFja3FBRkJwZjREUWZNQkVBUkI4d0VRRUVHbS9nTkI4UUVRQkVFQkpMRUJJNGdDQkVCQnBQNERRUUFRQkVFQUpLY0JRUUFrcUFGQnBmNERRUUFRQkVFQUVCQkJwdjREUWZBQUVBUkJBQ1N4QVFzUUVRcytBQ0FBUVFGeFFRQkhKTHNCSUFCQkFuRkJBRWNrdkFFZ0FFRUVjVUVBUnlTOUFTQUFRUWh4UVFCSEpMNEJJQUJCRUhGQkFFY2t2d0VnQUNTNkFRcytBQ0FBUVFGeFFRQkhKTUVCSUFCQkFuRkJBRWNrd2dFZ0FFRUVjVUVBUnlUREFTQUFRUWh4UVFCSEpNUUJJQUJCRUhGQkFFY2t4UUVnQUNUQUFRdDRBRUVBSk1ZQlFRQWt4d0ZCQUNUSUFVRUFKTXNCUVFBa3pBRkJBQ1ROQVVFQUpNa0JRUUFreWdFamlRSUVRRUdFL2dOQkhoQUVRYUE5Sk1jQkJVR0UvZ05CcXdFUUJFSE0xd0lreHdFTFFZZitBMEg0QVJBRVFmZ0JKTTBCSTRnQ0JFQWppUUpGQkVCQmhQNERRUUFRQkVFRUpNY0JDd3NMUXdCQkFDVE9BVUVBSk04Qkk0a0NCRUJCZ3Y0RFFmd0FFQVJCQUNUUUFVRUFKTkVCUVFBazBnRUZRWUwrQTBIK0FCQUVRUUFrMEFGQkFTVFJBVUVBSk5JQkN3dDFBQ09KQWdSQVFmRCtBMEg0QVJBRVFjLytBMEgrQVJBRVFjMytBMEgrQUJBRVFZRCtBMEhQQVJBRVFZLytBMEhoQVJBRVFleitBMEgrQVJBRVFmWCtBMEdQQVJBRUJVSHcvZ05CL3dFUUJFSFAvZ05CL3dFUUJFSE4vZ05CL3dFUUJFR0EvZ05CendFUUJFR1AvZ05CNFFFUUJBc0xtZ0VCQW45Qnd3SVFBaUlCUWNBQlJpSUFCSDhnQUFVZ0FVR0FBVVlqTUNJQUlBQWJDd1JBUVFFa2lRSUZRUUFraVFJTFFRQWtvd0pCZ0tqV3VRY2ttZ0pCQUNTYkFrRUFKSndDUVlDbzFya0hKSjBDUVFBa25nSkJBQ1NmQWlNdkJFQkJBU1NJQWdWQkFDU0lBZ3NRQXhBRkVBWVFDaEFMRUJKQkFCQVRRZi8vQXlPNkFSQUVRZUVCRUJSQmovNERJOEFCRUFRUUZSQVdFQmNMU2dBZ0FFRUFTaVF2SUFGQkFFb2tNQ0FDUVFCS0pERWdBMEVBU2lReUlBUkJBRW9rTXlBRlFRQktKRFFnQmtFQVNpUTFJQWRCQUVva05pQUlRUUJLSkRjZ0NVRUFTaVE0RUJnTEJRQWpvd0lMdVFFQVFZQUlJNHNDT2dBQVFZRUlJNHdDT2dBQVFZSUlJNDBDT2dBQVFZTUlJNDRDT2dBQVFZUUlJNDhDT2dBQVFZVUlJNUFDT2dBQVFZWUlJNUVDT2dBQVFZY0lJNUlDT2dBQVFZZ0lJNU1DT3dFQVFZb0lJNVFDT3dFQVFZd0lJNVVDTmdJQVFaRUlJNVlDUVFCSE9nQUFRWklJSTVjQ1FRQkhPZ0FBUVpNSUk1Z0NRUUJIT2dBQVFaUUlJNWtDUVFCSE9nQUFRWlVJSTRnQ1FRQkhPZ0FBUVpZSUk0a0NRUUJIT2dBQVFaY0lJNG9DUVFCSE9nQUFDMmdBUWNnSkkvTUJPd0VBUWNvSkkvUUJPd0VBUWN3SkkvVUJRUUJIT2dBQVFjMEpJL1lCUVFCSE9nQUFRYzRKSS9jQlFRQkhPZ0FBUWM4SkkvZ0JRUUJIT2dBQVFkQUpJL2tCUVFCSE9nQUFRZEVKSS9vQlFRQkhPZ0FBUWRJSkkvc0JRUUJIT2dBQUN6VUFRZm9KSThZQk5nSUFRZjRKSThjQk5nSUFRWUlLSThrQlFRQkhPZ0FBUVlVS0k4b0JRUUJIT2dBQVFZWCtBeVBJQVJBRUMxZ0FRZDRLSTFkQkFFYzZBQUJCM3dvaldqWUNBRUhqQ2lOYk5nSUFRZWNLSTF3MkFnQkI3QW9qWFRZQ0FFSHhDaU5lT2dBQVFmSUtJMTg2QUFCQjl3b2pZRUVBUnpvQUFFSDRDaU5oTmdJQVFmMEtJMkk3QVFBTFBRQkJrQXNqYmtFQVJ6b0FBRUdSQ3lOeE5nSUFRWlVMSTNJMkFnQkJtUXNqY3pZQ0FFR2VDeU4wTmdJQVFhTUxJM1U2QUFCQnBBc2pkam9BQUFzN0FFSDBDeU9SQVVFQVJ6b0FBRUgxQ3lPVEFUWUNBRUg1Q3lPVUFUWUNBRUg5Q3lPVkFUWUNBRUdDRENPV0FUWUNBRUdIRENPWUFUc0JBQXVIQVFBUUcwR3lDQ1B0QVRZQ0FFRzJDQ1BpQVRvQUFFSEUvZ01qN2dFUUJFSGtDQ080QVVFQVJ6b0FBRUhsQ0NPNUFVRUFSem9BQUJBY0VCMUJyQW9qc2dFMkFnQkJzQW9qc3dFNkFBQkJzUW9qdFFFNkFBQVFIaEFmUWNJTEkzNUJBRWM2QUFCQnd3c2pnUUUyQWdCQnh3c2pnZ0UyQWdCQnl3c2pnd0U3QVFBUUlFRUFKS01DQzdrQkFFR0FDQzBBQUNTTEFrR0JDQzBBQUNTTUFrR0NDQzBBQUNTTkFrR0RDQzBBQUNTT0FrR0VDQzBBQUNTUEFrR0ZDQzBBQUNTUUFrR0dDQzBBQUNTUkFrR0hDQzBBQUNTU0FrR0lDQzhCQUNTVEFrR0tDQzhCQUNTVUFrR01DQ2dDQUNTVkFrR1JDQzBBQUVFQVNpU1dBa0dTQ0MwQUFFRUFTaVNYQWtHVENDMEFBRUVBU2lTWUFrR1VDQzBBQUVFQVNpU1pBa0dWQ0MwQUFFRUFTaVNJQWtHV0NDMEFBRUVBU2lTSkFrR1hDQzBBQUVFQVNpU0tBZ3RlQVFGL1FRQWs3UUZCQUNUdUFVSEUvZ05CQUJBRVFjSCtBeEFDUVh4eElRRkJBQ1RpQVVIQi9nTWdBUkFFSUFBRVFBSkFRUUFoQUFOQUlBQkJnTmdGVGcwQklBQkJnTWtGYWtIL0FUb0FBQ0FBUVFGcUlRQU1BQUFMQUFzTEM0Z0JBUUYvSStRQklRRWdBRUdBQVhGQkFFY2s1QUVnQUVIQUFIRkJBRWNrNVFFZ0FFRWdjVUVBUnlUbUFTQUFRUkJ4UVFCSEpPY0JJQUJCQ0hGQkFFY2s2QUVnQUVFRWNVRUFSeVRwQVNBQVFRSnhRUUJISk9vQklBQkJBWEZCQUVjazZ3RWo1QUZGSUFFZ0FSc0VRRUVCRUNNTElBRkZJZ0FFZnlQa0FRVWdBQXNFUUVFQUVDTUxDeW9BUWVRSUxRQUFRUUJLSkxnQlFlVUlMUUFBUVFCS0pMa0JRZi8vQXhBQ0VCTkJqLzRERUFJUUZBdG9BRUhJQ1M4QkFDVHpBVUhLQ1M4QkFDVDBBVUhNQ1MwQUFFRUFTaVQxQVVITkNTMEFBRUVBU2lUMkFVSE9DUzBBQUVFQVNpVDNBVUhQQ1MwQUFFRUFTaVQ0QVVIUUNTMEFBRUVBU2lUNUFVSFJDUzBBQUVFQVNpVDZBVUhTQ1MwQUFFRUFTaVQ3QVF0SEFFSDZDU2dDQUNUR0FVSCtDU2dDQUNUSEFVR0NDaTBBQUVFQVNpVEpBVUdGQ2kwQUFFRUFTaVRLQVVHRi9nTVFBaVRJQVVHRy9nTVFBaVRMQVVHSC9nTVFBaVROQVFzSEFFRUFKTFlCQzFnQVFkNEtJMWRCQUVjNkFBQkIzd29vQWdBa1drSGpDaWdDQUNSYlFlY0tLQUlBSkZ4QjdBb29BZ0FrWFVIeENpMEFBQ1JlUWZJS0xRQUFKRjlCOXdvdEFBQkJBRW9rWUVINENpZ0NBQ1JoUWYwS0x3RUFKR0lMUFFCQmtBc3RBQUJCQUVva2JrR1JDeWdDQUNSeFFaVUxLQUlBSkhKQm1Rc29BZ0FrYzBHZUN5Z0NBQ1IwUWFNTExRQUFKSFZCcEFzdEFBQWtkZ3M3QUVIMEN5MEFBRUVBU2lTUkFVSDFDeWdDQUNTVEFVSDVDeWdDQUNTVUFVSDlDeWdDQUNTVkFVR0NEQ2dDQUNTV0FVR0hEQzhCQUNTWUFRdk1BUUVCZnhBaVFiSUlLQUlBSk8wQlFiWUlMUUFBSk9JQlFjVCtBeEFDSk80QlFjRCtBeEFDRUNRUUpVR0EvZ01RQWtIL0FYTWsyd0VqMndFaUFFRVFjVUVBUnlUY0FTQUFRU0J4UVFCSEpOMEJFQ1lRSjBHc0NpZ0NBQ1N5QVVHd0NpMEFBQ1N6QVVHeENpMEFBQ1MxQVVFQUpMWUJFQ2tRS2tIQ0N5MEFBRUVBU2lSK1FjTUxLQUlBSklFQlFjY0xLQUlBSklJQlFjc0xMd0VBSklNQkVDdEJBQ1NqQWtHQXFOYTVCeVNhQWtFQUpKc0NRUUFrbkFKQmdLald1UWNrblFKQkFDU2VBa0VBSko4Q0N3VUFJNGtDQ3dVQUk1MENDd1VBSTU0Q0N3VUFJNThDQzhjQ0FRWi9JMGtoQmdKL0FuOGdBVUVBU2lJRkJFQWdBRUVJU2lFRkN5QUZDd1JBSTBnZ0JFWWhCUXNnQlFzRWZ5QUFJQVpHQlNBRkN3UkFJQU5CQVdzUUFrRWdjVUVBUnlFSUlBTVFBa0VnY1VFQVJ5RUpRUUFoQlFOQUlBVkJDRWdFUUVFSElBVnJJQVVnQ0NBSlJ4c2lCU0FBYWlJRFFhQUJUQVJBSUFGQm9BRnNJQU5xUVFOc1FZREpCV29pQkMwQUFDRUtJQVFnQ2pvQUFDQUJRYUFCYkNBRGFrRURiRUdCeVFWcUlBUXRBQUU2QUFBZ0FVR2dBV3dnQTJwQkEyeEJnc2tGYWlBRUxRQUNPZ0FBSUFGQm9BRnNJQU5xUVlDUkJHb2dBRUVBSUFWcmF5QUJRYUFCYkdwQitKQUVhaTBBQUNJRFFRTnhJZ1JCQkhJZ0JDQURRUVJ4R3pvQUFDQUhRUUZxSVFjTElBVkJBV29oQlF3QkN3c0ZJQVFrU0FzZ0FDQUdUZ1JBSUFCQkNHb2lBU0FDUVFkeElnSnFJQUVnQUNBQ1NCc2hCZ3NnQmlSSklBY0xLUUFnQUVHQWtBSkdCRUFnQVVHQUFXc2dBVUdBQVdvZ0FVR0FBWEViSVFFTElBRkJCSFFnQUdvTFNnQWdBRUVEZENBQlFRRjBhaUlBUVFGcVFUOXhJZ0ZCUUdzZ0FTQUNHMEdBa0FScUxRQUFJUUVnQUVFL2NTSUFRVUJySUFBZ0FodEJnSkFFYWkwQUFDQUJRZjhCY1VFSWRISUx5QUVBSUFFUUFpQUFRUUYwZFVFRGNTRUFJQUZCeVA0RFJnUkFJejBoQVFKQUlBQkZEUUFDUUFKQUFrQUNRQ0FBUVFGckRnTUJBZ01BQ3d3REN5TStJUUVNQWdzalB5RUJEQUVMSTBBaEFRc0ZJQUZCeWY0RFJnUkFJMEVoQVFKQUlBQkZEUUFDUUFKQUFrQUNRQ0FBUVFGckRnTUJBZ01BQ3d3REN5TkNJUUVNQWdzalF5RUJEQUVMSTBRaEFRc0ZJemtoQVFKQUlBQkZEUUFDUUFKQUFrQUNRQ0FBUVFGckRnTUJBZ01BQ3d3REN5TTZJUUVNQWdzak95RUJEQUVMSXp3aEFRc0xDeUFCQzVvREFRWi9JQUVnQUJBeUlBVkJBWFJxSWdCQmdKQithaUFDUVFGeFFRMTBJZ0ZxTFFBQUlSRWdBRUdCa0g1cUlBRnFMUUFBSVJJZ0F5RUFBMEFnQUNBRVRBUkFJQUFnQTJzZ0Jtb2lEaUFJU0FSQVFRQWhCUUovUVFGQkJ5QUFheUFBSUF0QkFFZ2lBUVIvSUFFRklBdEJJSEZGQ3hzaUFYUWdFbkVFUUVFQ0lRVUxJQVZCQVdvTElBVkJBU0FCZENBUmNSc2hBaU9KQWdSL0lBdEJBRTRpQVFSL0lBRUZJQXhCQUU0TEJTT0pBZ3NFZnlBTFFRZHhJUUVnREVFQVRpSUZCRUFnREVFSGNTRUJDeUFCSUFJZ0JSQXpJZ1ZCSDNGQkEzUWhBU0FGUWVBSGNVRUZkVUVEZENFUElBVkJnUGdCY1VFS2RVRURkQVVnQWtISC9nTWdDaUFLUVFCTUd5SUtFRFFpQlVHQWdQd0hjVUVRZFNFQklBVkJnUDREY1VFSWRTRVBJQVZCL3dGeEN5RUZJQWNnQ0d3Z0RtcEJBMndnQ1dvaUVDQUJPZ0FBSUJCQkFXb2dEem9BQUNBUVFRSnFJQVU2QUFBZ0IwR2dBV3dnRG1wQmdKRUVhaUFDUVFOeElnRkJCSElnQVNBTFFZQUJjVUVBUjBFQUlBdEJBRTRiR3pvQUFDQU5RUUZxSVEwTElBQkJBV29oQUF3QkN3c2dEUXQrQVFOL0lBTkJCM0VoQTBFQUlBSWdBa0VEZFVFRGRHc2dBQnNoQjBHZ0FTQUFhMEVISUFCQkNHcEJvQUZLR3lFSVFYOGhBaU9KQWdSQUlBUkJnTkIrYWkwQUFDSUNRUWh4UVFCSElRa2dBa0hBQUhFRVFFRUhJQU5ySVFNTEN5QUdJQVVnQ1NBSElBZ2dBeUFBSUFGQm9BRkJnTWtGUVFBZ0FrRi9FRFVMb1FJQkFYOGdBMEVIY1NFRElBVWdCaEF5SUFSQmdOQithaTBBQUNJRVFjQUFjUVIvUVFjZ0Eyc0ZJQU1MUVFGMGFpSUZRWUNRZm1vZ0JFRUljVUVBUnlJR1FRMTBhaTBBQUNFSElBSkJCM0VoQTBFQUlRSWdBVUdnQVd3Z0FHcEJBMnhCZ01rRmFpQUVRUWR4QW44Z0JVR0JrSDVxSUFaQkFYRkJEWFJxTFFBQVFRRWdBMEVISUFOcklBUkJJSEViSWdOMGNRUkFRUUloQWdzZ0FrRUJhZ3NnQWtFQklBTjBJQWR4R3lJRFFRQVFNeUlDUVI5eFFRTjBPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZSEpCV29nQWtIZ0IzRkJCWFZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNRWUQ0QVhGQkNuVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQmdKRUVhaUFEUVFOeElnQkJCSElnQUNBRVFZQUJjUnM2QUFBTHhBRUFJQVFnQlJBeUlBTkJCM0ZCQVhScUlnUkJnSkIrYWkwQUFDRUZRUUFoQXlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxQW44Z0JFR0JrSDVxTFFBQVFRRkJCeUFDUVFkeGF5SUNkSEVFUUVFQ0lRTUxJQU5CQVdvTElBTkJBU0FDZENBRmNSc2lBMEhIL2dNUU5DSUNRWUNBL0FkeFFSQjFPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZSEpCV29nQWtHQS9nTnhRUWgxT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUxKQldvZ0Fqb0FBQ0FCUWFBQmJDQUFha0dBa1FScUlBTkJBM0U2QUFBTDFnRUJCbjhnQTBFRGRTRUxBMEFnQkVHZ0FVZ0VRQ0FFSUFWcUlnWkJnQUpPQkVBZ0JrR0FBbXNoQmdzZ0MwRUZkQ0FDYWlBR1FRTjFhaUlJUVlDUWZtb3RBQUFoQjBFQUlRa2pOd1JBSUFRZ0FDQUdJQWdnQnhBeElncEJBRW9FUUVFQklRa2dDa0VCYXlBRWFpRUVDd3NnQ1VVak5pSUtJQW9iQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEEySWdaQkFFb0VRQ0FHUVFGcklBUnFJUVFMQlNBSlJRUkFJNGtDQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEEzQlNBRUlBQWdCaUFESUFFZ0J4QTRDd3NMSUFSQkFXb2hCQXdCQ3dzTE1nRURmeVB4QVNFRElBQWo4Z0VpQkVnRVFBOExRUUFnQTBFSGF5SURheUVGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRGtMdkFVQkQzOENRRUVuSVFjRFFDQUhRUUJJRFFFZ0IwRUNkQ0lHUVlEOEEyb2lBaEFDSVFNZ0FrRUJhaEFDSVFnZ0FrRUNhaEFDSVFRZ0EwRVFheUVGSUFoQkNHc2hERUVJSVFNZ0FRUkFRUkFoQXlBRUlBUkJBWEZySVFRTElBQWdCVTRpQWdSQUlBQWdBeUFGYWtnaEFnc2dBZ1JBSUFaQmcvd0RhaEFDSWdaQmdBRnhRUUJISVFnZ0JrRWdjVUVBUnlFTlFZQ0FBaUFFRURJZ0F5QUFJQVZySWdKclFRRnJJQUlnQmtIQUFIRWJRUUYwYWlJQ1FZQ1FmbW9nQmtFSWNVRUFSeU9KQWlJRUlBUWJRUUZ4UVExMElnUnFMUUFBSVE0Z0FrR0JrSDVxSUFScUxRQUFJUTlCQnlFRkEwQWdCVUVBVGdSQVFRQWhBd0ovUVFGQkFDQUZRUWRyYXlBRklBMGJJZ0owSUE5eEJFQkJBaUVEQ3lBRFFRRnFDeUFEUVFFZ0FuUWdEbkViSWdvRVFFRUhJQVZySUF4cUlnTkJBRTRpQWdSQUlBTkJvQUZNSVFJTElBSUVRRUVBSVF0QkFDRUVJK3NCUlNPSkFpSUNJQUliSWdKRkJFQWdBRUdnQVd3Z0EycEJnSkVFYWkwQUFDSUpJUkFnQ1VFRGNTSUpRUUJMSUFnZ0NCc0VRRUVCSVFzRklCQkJCSEZCQUVjamlRSWlCQ0FFR3lJRUJFQWdDVUVBU3lFRUMwRUJRUUFnQkJzaEJBc0xJQUpGQkVBZ0MwVWlBZ1JBSUFSRklRSUxDeUFDQkVBamlRSUVRQ0FBUWFBQmJDQURha0VEYkVHQXlRVnFJQVpCQjNFZ0NrRUJFRE1pQWtFZmNVRURkRG9BQUNBQVFhQUJiQ0FEYWtFRGJFR0J5UVZxSUFKQjRBZHhRUVYxUVFOME9nQUFJQUJCb0FGc0lBTnFRUU5zUVlMSkJXb2dBa0dBK0FGeFFRcDFRUU4wT2dBQUJTQUFRYUFCYkNBRGFrRURiRUdBeVFWcUlBcEJ5ZjREUWNqK0F5QUdRUkJ4R3hBMElnSkJnSUQ4QjNGQkVIVTZBQUFnQUVHZ0FXd2dBMnBCQTJ4Qmdja0ZhaUFDUVlEK0EzRkJDSFU2QUFBZ0FFR2dBV3dnQTJwQkEyeEJnc2tGYWlBQ09nQUFDd3NMQ3lBRlFRRnJJUVVNQVFzTEN5QUhRUUZySVFjTUFBQUxBQXNMWmdFQ2YwR0FnQUpCZ0pBQ0krY0JHeUVCSTRrQ0lnSWo2d0VnQWhzRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBvQVJzajhBRWdBR3BCL3dGeFFRQWo3d0VRT1FzajVnRUVRQ0FBSUFGQmdMZ0NRWUN3QWlQbEFSc1FPZ3NqNmdFRVFDQUFJK2tCRURzTEN5VUJBWDhDUUFOQUlBQkJrQUZLRFFFZ0FFSC9BWEVRUENBQVFRRnFJUUFNQUFBTEFBc0xSZ0VDZndOQUlBRkJrQUZPUlFSQVFRQWhBQU5BSUFCQm9BRklCRUFnQVVHZ0FXd2dBR3BCZ0pFRWFrRUFPZ0FBSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN3c2JBRUdQL2dNUUFrRUJJQUIwY2lJQUpNQUJRWS8rQXlBQUVBUUxDd0JCQVNUQ0FVRUJFRDhMTEFFQ2Z5TmNJZ0JCQUVvaUFRUkFJMVVoQVFzZ0FRUkFJQUJCQVdzaUFFVUVRRUVBSkZjTEN5QUFKRndMTEFFQ2Z5TnpJZ0JCQUVvaUFRUkFJMndoQVFzZ0FFRUJheUFBSUFFYklnQkZCRUJCQUNSdUN5QUFKSE1MTGdFQ2Z5T0NBU0lBUVFCS0lnRUVRQ044SVFFTElBQkJBV3NnQUNBQkd5SUFSUVJBUVFBa2Znc2dBQ1NDQVFzd0FRSi9JNVVCSWdCQkFFb2lBUVJBSTVBQklRRUxJQUJCQVdzZ0FDQUJHeUlBUlFSQVFRQWtrUUVMSUFBa2xRRUxSd0VDZnlBQUpHSkJsUDRERUFKQitBRnhJUUZCay80RElBQkIvd0Z4SWdJUUJFR1UvZ01nQVNBQVFRaDFRUWR4SWdCeUVBUWdBaVJVSUFBa1ZpTlVJMVpCQ0hSeUpGa0xxQUVCQW44alYwVWlBQVIvSUFBRkkyQkZDd1JBRHdzallVRUJheUlBUVFCTUJFQWpUQVJBSTB3a1lRSi9JMklpQVNOT2RTRUFRUUVqVFFSL1FRRWtZeUFCSUFCckJTQUFJQUZxQ3lJQVFmOFBTZzBBR2tFQUN3UkFRUUFrVndzalRrRUFTZ1JBSUFBUVJRSi9JMklpQVNOT2RTRUFRUUVqVFFSL1FRRWtZeUFCSUFCckJTQUFJQUZxQzBIL0Qwb05BQnBCQUFzRVFFRUFKRmNMQ3dWQkNDUmhDd1VnQUNSaEN3dE9BUU4vSTF0QkFXc2lBVUVBVEFSQUkxTWlBUVJBSTEwaEFDQUFRUTlJSTFJalVoc0VmeUFBUVFGcUJTTlNSU0lDQkVBZ0FFRUFTaUVDQ3lBQVFRRnJJQUFnQWhzTEpGMExDeUFCSkZzTFRnRURmeU55UVFGcklnRkJBRXdFUUNOcUlnRUVRQ04wSVFBZ0FFRVBTQ05wSTJrYkJIOGdBRUVCYWdVamFVVWlBZ1JBSUFCQkFFb2hBZ3NnQUVFQmF5QUFJQUliQ3lSMEN3c2dBU1J5QzFZQkEzOGpsQUZCQVdzaUFVRUFUQVJBSTR3QklnRUVRQ09XQVNFQUlBQkJEMGdqaXdFaml3RWJCSDhnQUVFQmFnVWppd0ZGSWdJRVFDQUFRUUJLSVFJTElBQkJBV3NnQUNBQ0d3c2tsZ0VMQ3lBQkpKUUJDNTBCQVFKL1FZREFBQ09LQW5RaUFTRUNJN0lCSUFCcUlnQWdBVTRFUUNBQUlBSnJKTElCQWtBQ1FBSkFBa0FDUUNPMUFVRUJha0VIY1NJQUJFQWdBRUVDUmcwQkFrQWdBRUVFYXc0RUF3QUVCUUFMREFVTEVFRVFRaEJERUVRTUJBc1FRUkJDRUVNUVJCQkdEQU1MRUVFUVFoQkRFRVFNQWdzUVFSQkNFRU1RUkJCR0RBRUxFRWNRU0JCSkN5QUFKTFVCUVFFUEJTQUFKTElCQzBFQUMzTUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQUNRQ0FBUVFKckRnTUNBd1FBQ3d3RUN5TllJZ0FqblFGSElRRWdBQ1NkQVNBQkR3c2pieUlBSTU0QlJ5RUJJQUFrbmdFZ0FROExJMzhpQUNPZkFVY2hBU0FBSko4QklBRVBDeU9TQVNJQUk2QUJSeUVCSUFBa29BRWdBUThMUVFBTFZRQUNRQUpBQWtBZ0FFRUJSd1JBSUFCQkFrWU5BU0FBUVFOR0RRSU1Bd3RCQVNBQmRFR0JBWEZCQUVjUEMwRUJJQUYwUVljQmNVRUFSdzhMUVFFZ0FYUkIvZ0J4UVFCSER3dEJBU0FCZEVFQmNVRUFSd3R5QVFGL0kxb2dBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTlphMEVDZENJQlFRSjBJQUVqaWdJYkpGb2pXaUFBUVI5MUlnRWdBQ0FCYW5OcklRQWpYMEVCYWtFSGNTUmZEQUVMQ3lBQUpGb2pXQ05YSWdBZ0FCc0VmeU5kQlVFUER3c2pUeU5mRUV3RWYwRUJCVUYvQzJ4QkQyb0xhd0VCZnlOeElBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBamNHdEJBblFqaWdKMEpIRWpjU0FBUVI5MUlnRWdBQ0FCYW5OcklRQWpka0VCYWtFSGNTUjJEQUVMQ3lBQUpIRWpieU51SWdBZ0FCc0VmeU4wQlVFUER3c2paaU4yRUV3RWYwRUJCVUYvQzJ4QkQyb0xEd0FqZ3dGQkFYVkJzUDREYWhBQ0N5b0JBWDhqZ3dGQkFXb2hBQU5BSUFCQklFNEVRQ0FBUVNCcklRQU1BUXNMSUFBa2d3RVFUeVNHQVF2ckFRRURmeU4rUlNJQ0JIOGdBZ1VqZjBVTEJFQkJEdzhMSTRRQklRSWpoUUVFUUVHYy9nTVFBa0VGZFVFUGNTSUNKSVFCUVFBa2hRRUxJNFlCSTRNQlFRRnhSVUVDZEhWQkQzRWhBUUpBQWtBQ1FBSkFJQUlFUUNBQ1FRRkdEUUVnQWtFQ1JnMENEQU1MSUFGQkJIVWhBUXdEQzBFQklRTU1BZ3NnQVVFQmRTRUJRUUloQXd3QkN5QUJRUUoxSVFGQkJDRURDeUFEUVFCS0JIOGdBU0FEYlFWQkFBdEJEMm9oQWlPQkFTQUFheUVBQTBBZ0FFRUFUQVJBUVlBUUk0QUJhMEVCZENPS0FuUWtnUUVqZ1FFZ0FFRWZkU0lCSUFBZ0FXcHpheUVBRUZBTUFRc0xJQUFrZ1FFZ0FndU9BUUVDZnlPVEFTQUFheUlBUVFCTUJFQWpsd0VqalFGMEk0b0NkQ0FBUVI5MUlnRWdBQ0FCYW5OcklRQWptQUVpQVVFQmRTSUNJQUZCQVhFZ0FrRUJjWE1pQVVFT2RISWlBa0cvZjNFZ0FVRUdkSElnQWlPT0FSc2ttQUVMUVFBZ0FDQUFRUUJJR3lTVEFTT1NBU09SQVNJQUlBQWJCSDhqbGdFRlFROFBDMEYvUVFFam1BRkJBWEViYkVFUGFnc3dBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMbHdFQkFYOUJBQ1NqQVNBQVFROGpxUUViSUFGQkR5T3FBUnRxSUFKQkR5T3JBUnRxSUFOQkR5T3NBUnRxSVFRZ0FFRVBJNjBCR3lBQlFROGpyZ0ViYWlFQUlBQWdBa0VQSTY4Qkcyb2hBU0FEUVE4anNBRWJJUU5CQUNTa0FVRUFKS1VCSUFRanB3RkJBV29RVXlFQUlBRWdBMm9qcUFGQkFXb1FVeUVCSUFBa29RRWdBU1NpQVNBQlFmOEJjU0FBUWY4QmNVRUlkSElMb2dNQkJYOGpTaUFBYWlJQkpFb2pXaUFCYTBFQVRDSUJSUVJBUVFFUVN5RUJDeU5rSUFCcUlnSWtaQ054SUFKclFRQk1JZ1ZGQkVCQkFoQkxJUVVMSTNjZ0FHb2tkeU9GQVVVaUFnUkFJNEVCSTNkclFRQktJUUlMSUFKRklnUkZCRUJCQXhCTElRUUxJNGNCSUFCcUpJY0JJNU1CSTRjQmEwRUFUQ0lDUlFSQVFRUVFTeUVDQ3lBQkJFQWpTaUVEUVFBa1NpQURFRTBrbVFFTElBVUVRQ05rSVFOQkFDUmtJQU1RVGlTYUFRc2dCQVJBSTNjaEEwRUFKSGNnQXhCUkpKc0JDeUFDQkVBamh3RWhBMEVBSkljQklBTVFVaVNjQVFzQ2Z5QUJJQVVnQVJzaUFVVUVRQ0FFSVFFTElBRkZDd1JBSUFJaEFRc2dBUVJBUVFFa3BRRUxRWUNBZ0FJamlnSjBJN1FCYlNJRUlRSWpzd0VnQUdvaUFTQUVUZ1JBSUFFZ0Ftc2hBU09sQVNJQUk2TUJJQUFiSWdCRkJFQWpwQUVoQUFzZ0FBUkFJNWtCSTVvQkk1c0JJNXdCRUZRYUJTQUJKTE1CQ3lPMkFTSUNRUUYwUVlDWndRQnFJZ0Fqb1FGQkFtbzZBQUFnQUVFQmFpT2lBVUVDYWpvQUFDQUNRUUZxSWdBanR3RkJBWFZCQVd0T0JIOGdBRUVCYXdVZ0FBc2t0Z0VMSUFFa3N3RUxxQU1CQm44Z0FCQk5JUUVnQUJCT0lRSWdBQkJSSVFRZ0FCQlNJUVVnQVNTWkFTQUNKSm9CSUFRa213RWdCU1NjQVNPekFTQUFhaUlBUVlDQWdBSWppZ0owSTdRQmJVNEVRQ0FBUVlDQWdBSWppZ0owSTdRQmJXc2hBQ0FCSUFJZ0JDQUZFRlFoQXlPMkFVRUJkRUdBbWNFQWFpSUdJQU5CZ1A0RGNVRUlkVUVDYWpvQUFDQUdRUUZxSUFOQi93RnhRUUpxT2dBQUl6Z0VRQ0FCUVE5QkQwRVBFRlFoQVNPMkFVRUJkRUdBbVNGcUlnTWdBVUdBL2dOeFFRaDFRUUpxT2dBQUlBTkJBV29nQVVIL0FYRkJBbW82QUFCQkR5QUNRUTlCRHhCVUlRRWp0Z0ZCQVhSQmdKa3BhaUlDSUFGQmdQNERjVUVJZFVFQ2Fqb0FBQ0FDUVFGcUlBRkIvd0Z4UVFKcU9nQUFRUTlCRHlBRVFROFFWQ0VCSTdZQlFRRjBRWUNaTVdvaUFpQUJRWUQrQTNGQkNIVkJBbW82QUFBZ0FrRUJhaUFCUWY4QmNVRUNham9BQUVFUFFROUJEeUFGRUZRaEFTTzJBVUVCZEVHQW1UbHFJZ0lnQVVHQS9nTnhRUWgxUVFKcU9nQUFJQUpCQVdvZ0FVSC9BWEZCQW1vNkFBQUxJN1lCUVFGcUlnRWp0d0ZCQVhWQkFXdE9CSDhnQVVFQmF3VWdBUXNrdGdFTElBQWtzd0VMSGdFQmZ5QUFFRW9oQVNBQlJTTTFJelViQkVBZ0FCQlZCU0FBRUZZTEN5OEJBbjlCMXdBamlnSjBJUUVqcGdFaEFBTkFJQUFnQVU0RVFDQUJFRmNnQUNBQmF5RUFEQUVMQ3lBQUpLWUJDNlFEQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR1EvZ05IQkVBZ0FFR1YvZ05HRFFFQ1FDQUFRWkgrQTJzT0ZnWUxFQlFBQnd3UkZRTUlEUklXQkFrT0V4Y0ZDZzhBQ3d3WEMwR1EvZ01RQWtHQUFYSVBDMEdWL2dNUUFrSC9BWElQQzBHYS9nTVFBa0gvQUhJUEMwR2YvZ01RQWtIL0FYSVBDMEdrL2dNUUFnOExRWkgrQXhBQ1FUOXlEd3RCbHY0REVBSkJQM0lQQzBHYi9nTVFBa0gvQVhJUEMwR2cvZ01RQWtIL0FYSVBDMEdsL2dNUUFnOExRWkwrQXhBQ0R3dEJsLzRERUFJUEMwR2MvZ01RQWtHZkFYSVBDMEdoL2dNUUFnOExRWUFCUVFBanNRRWJJUUFnQUVFQmNpQUFRWDV4STFjYklRQWdBRUVDY2lBQVFYMXhJMjRiSVFBZ0FFRUVjaUFBUVh0eEkzNGJJUUFnQUVFSWNpQUFRWGR4STVFQkcwSHdBSElQQzBHVC9nTVFBa0gvQVhJUEMwR1kvZ01RQWtIL0FYSVBDMEdkL2dNUUFrSC9BWElQQzBHaS9nTVFBZzhMUVpUK0F4QUNRYjhCY2c4TFFabitBeEFDUWI4QmNnOExRWjcrQXhBQ1FiOEJjZzhMUWFQK0F4QUNRYjhCY2c4TFFYOExuQUVCQVg4ajJ3RWhBQ1BjQVFSQUlBQkJlM0VnQUVFRWNpUFRBUnNoQUNBQVFYNXhJQUJCQVhJajFnRWJJUUFnQUVGM2NTQUFRUWh5STlRQkd5RUFJQUJCZlhFZ0FFRUNjaVBWQVJzaEFBVWozUUVFUUNBQVFYNXhJQUJCQVhJajF3RWJJUUFnQUVGOWNTQUFRUUp5STlnQkd5RUFJQUJCZTNFZ0FFRUVjaVBaQVJzaEFDQUFRWGR4SUFCQkNISWoyZ0ViSVFBTEN5QUFRZkFCY2d2MEFnRUJmeUFBUVlDQUFrZ0VRRUYvRHdzZ0FFR0FnQUpPSWdFRWZ5QUFRWURBQWtnRklBRUxCRUJCZnc4TElBQkJnTUFEVGlJQkJIOGdBRUdBL0FOSUJTQUJDd1JBSUFCQmdFQnFFQUlQQ3lBQVFZRDhBMDRpQVFSL0lBQkJuLzBEVEFVZ0FRc0VRRUgvQVVGL0krSUJRUUpJR3c4TElBQkJ6ZjREUmdSQVFmOEJJUUJCemY0REVBSkJBWEZGQkVCQi9nRWhBQXNqaWdKRkJFQWdBRUgvZm5FaEFBc2dBQThMSUFCQnhQNERSZ1JBSUFBajdnRVFCQ1B1QVE4TElBQkJrUDREVGlJQkJIOGdBRUdtL2dOTUJTQUJDd1JBRUZnZ0FCQlpEd3NnQUVHbi9nTk9JZ0VFZnlBQVFhLytBMHdGSUFFTEJFQkIvd0VQQ3lBQVFiRCtBMDRpQVFSL0lBQkJ2LzREVEFVZ0FRc0VRQkJZSTM0RVFCQlBEd3RCZnc4TElBQkJoUDREUmdSQUlBQWp4d0ZCZ1A0RGNVRUlkU0lBRUFRZ0FBOExJQUJCaGY0RFJnUkFJQUFqeUFFUUJDUElBUThMSUFCQmovNERSZ1JBSThBQlFlQUJjZzhMSUFCQmdQNERSZ1JBRUZvUEMwRi9DeWtCQVg4ajN3RWdBRVlFUUVFQkpPRUJDeUFBRUZzaUFVRi9SZ1IvSUFBUUFnVWdBVUgvQVhFTEM3WUNBUVIvSS9jQkJFQVBDeVA0QVNFRUkva0JJUU1nQUVIL1Awd0VRQ0FEQkg4Z0FVRVFjVVVGSUFNTFJRUkFJQUZCRDNFaUFBUkFJQUJCQ2tZRVFFRUJKUFVCQ3dWQkFDVDFBUXNMQlNBQVFmLy9BRXdFUUNQN0FTSUZSU0lDUlFSQUlBQkIvOThBVENFQ0N5QUNCRUFnQVVFUGNTUHpBU0FER3lFQUlBUUVmeUFCUVI5eElRRWdBRUhnQVhFRkkvb0JCSDhnQVVIL0FIRWhBU0FBUVlBQmNRVkJBQ0FBSUFVYkN3c2hBQ0FBSUFGeUpQTUJCU1B6QVVIL0FYRWdBVUVBU2tFSWRISWs4d0VMQlNBRFJTSUNCSDhnQUVIL3Z3Rk1CU0FDQ3dSQUkvWUJJQVFnQkJzRVFDUHpBVUVmY1NBQlFlQUJjWElrOHdFUEN5QUJRUTl4SUFGQkEzRWord0ViSlBRQkJTQURSU0lDQkVBZ0FFSC8vd0ZNSVFJTElBSUVRQ0FFQkVBZ0FVRUJjVUVBUnlUMkFRc0xDd3NMQzBBQkFYOGpUU0VCSUFCQjhBQnhRUVIxSkV3Z0FFRUljVUVBUnlSTklBQkJCM0VrVGlBQkJIOGpUVVVpQUFSL0kyTUZJQUFMQlNBQkN3UkFRUUFrVndzTE1nRUJmeUFBUVlBQmNVRUFSeUVCSTM5RklnQUVmeUFCQlNBQUN3UkFRUUFraGdFTElBRWtmeUFCUlFSQUlBRWtmZ3NMTkFBZ0FFRUVkVUVQY1NSUklBQkJDSEZCQUVja1VpQUFRUWR4SkZNZ0FFSDRBWEZCQUVvaUFDUllJQUJGQkVBZ0FDUlhDd3MwQUNBQVFRUjFRUTl4SkdnZ0FFRUljVUVBUnlScElBQkJCM0VrYWlBQVFmZ0JjVUVBU2lJQUpHOGdBRVVFUUNBQUpHNExDemtBSUFCQkJIVkJEM0VraWdFZ0FFRUljVUVBUnlTTEFTQUFRUWR4Skl3QklBQkIrQUZ4UVFCS0lnQWtrZ0VnQUVVRVFDQUFKSkVCQ3dzNEFDQUFRUVIxSkkwQklBQkJDSEZCQUVja2pnRWdBRUVIY1NJQUpJOEJJQUJCQVhRaUFFRUJTQVJBUVFFaEFBc2dBRUVEZENTWEFRdWpBUUVDZjBFQkpGY2pYRVVFUUNOTEpGd0xRWUFRSTFsclFRSjBJZ0JCQW5RZ0FDT0tBaHNrV2lOVEpGc2pVU1JkSTFra1lpTk1CRUFqVENSaEJVRUlKR0VMSTB4QkFFb2lBQVIvSUFBRkkwNUJBRW9MSkdCQkFDUmpJMDVCQUVvaUFBUi9BbjhqWWlJQkkwNTFJUUJCQVNOTkJIOUJBU1JqSUFFZ0FHc0ZJQUFnQVdvTFFmOFBTZzBBR2tFQUN3VWdBQXNFUUVFQUpGY0xJMWhGQkVCQkFDUlhDd3VwQVFFRGZ5QUFRUWR4SWdJa1ZpTlVJQUpCQ0hSeUpGa2p0UUZCQVhGQkFVWWhBeU5WUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQTBVRVFDTmNRUUJLSWdJRWZ5QUJCU0FDQ3dSQUkxeEJBV3NrWENBQVFZQUJjVVVpQVFSL0kxeEZCU0FCQ3dSQVFRQWtWd3NMQ3lBQVFjQUFjVUVBUnlSVklBQkJnQUZ4QkVBUVpBSi9JQU5GSWdBRVFDTmNJMHRHSVFBTElBQUxCSDhqVlFVZ0FBc0VRQ05jUVFGckpGd0xDd3N4QUVFQkpHNGpjMFVFUUNObEpITUxRWUFRSTNCclFRSjBJNG9DZENSeEkyb2tjaU5vSkhRamIwVUVRRUVBSkc0TEM2a0JBUU4vSUFCQkIzRWlBaVJ0STJzZ0FrRUlkSElrY0NPMUFVRUJjVUVCUmlFREkyeEZJZ0VFUUNBQVFjQUFjVUVBUnlFQkN5QURSUVJBSTNOQkFFb2lBZ1IvSUFFRklBSUxCRUFqYzBFQmF5UnpJQUJCZ0FGeFJTSUJCSDhqYzBVRklBRUxCRUJCQUNSdUN3c0xJQUJCd0FCeFFRQkhKR3dnQUVHQUFYRUVRQkJtQW44Z0EwVWlBQVJBSTNNalpVWWhBQXNnQUFzRWZ5TnNCU0FBQ3dSQUkzTkJBV3NrY3dzTEN6c0FRUUVrZmlPQ0FVVUVRQ040SklJQkMwR0FFQ09BQVd0QkFYUWppZ0owSklFQkk0RUJRUVpxSklFQlFRQWtnd0VqZjBVRVFFRUFKSDRMQzY4QkFRTi9JQUJCQjNFaUFpUjlJM3NnQWtFSWRISWtnQUVqdFFGQkFYRkJBVVlpQTBVRVFDTjhSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2pnZ0ZCQUVvaUFnUi9JQUVGSUFJTEJFQWpnZ0ZCQVdza2dnRWdBRUdBQVhGRklnRUVmeU9DQVVVRklBRUxCRUJCQUNSK0N3c0xJQUJCd0FCeFFRQkhKSHdnQUVHQUFYRUVRQkJvQW44Z0EwVWlBQVJBSTRJQkkzaEdJUUFMSUFBTEJIOGpmQVVnQUFzRVFDT0NBVUVCYXlTQ0FRc0xDMEVBUVFFa2tRRWpsUUZGQkVBamlBRWtsUUVMSTVjQkk0MEJkQ09LQW5Ra2t3RWpqQUVrbEFFamlnRWtsZ0ZCLy84QkpKZ0JJNUlCUlFSQVFRQWtrUUVMQzZJQkFRTi9JN1VCUVFGeFFRRkdJUUlqa0FGRklnRUVRQ0FBUWNBQWNVRUFSeUVCQ3lBQ1JRUkFJNVVCUVFCS0lnTUVmeUFCQlNBREN3UkFJNVVCUVFGckpKVUJJQUJCZ0FGeFJTSUJCSDhqbFFGRkJTQUJDd1JBUVFBa2tRRUxDd3NnQUVIQUFIRkJBRWNra0FFZ0FFR0FBWEVFUUJCcUFuOGdBa1VpQUFSQUk1VUJJNGdCUmlFQUN5QUFDd1IvSTVBQkJTQUFDd1JBSTVVQlFRRnJKSlVCQ3dzTC9nTUJBWDhnQUVHbS9nTkhJZ0lFUUNPeEFVVWhBZ3NnQWdSQVFRQVBDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RFJ3UkFJQUJCbXY0RFJnMEJBa0FnQUVHUi9nTnJEaFlEQndzUEFBUUlEQkFBQlFrTkVRQUdDZzRTRXhRVkFBc01GUXNnQVJCZURCVUxJQUVRWHd3VUN5QUJRUVoxUVFOeEpFOGdBVUUvY1NSUUkwc2pVR3NrWEF3VEN5QUJRUVoxUVFOeEpHWWdBVUUvY1NSbkkyVWpaMnNrY3d3U0N5QUJKSGtqZUNONWF5U0NBUXdSQ3lBQlFUOXhKSWtCSTRnQkk0a0JheVNWQVF3UUN5QUJFR0FNRHdzZ0FSQmhEQTRMUVFFa2hRRWdBVUVGZFVFUGNTUjZEQTBMSUFFUVlnd01DeUFCSkZRalZrRUlkQ0FCY2lSWkRBc0xJQUVrYXlOdFFRaDBJQUZ5SkhBTUNnc2dBU1I3STMxQkNIUWdBWElrZ0FFTUNRc2dBUkJqREFnTElBRVFaUXdIQ3lBQkVHY01CZ3NnQVJCcERBVUxJQUVRYXd3RUN5QUJRUVIxUVFkeEpLY0JJQUZCQjNFa3FBRkJBU1NqQVF3REN5QUJFQkJCQVNTa0FRd0NDeU94QVNJQ1JTSUFCRUFnQVVHQUFYRWhBQXNnQUFSQVFRY2t0UUZCQUNSZlFRQWtkZ3NnQVVHQUFYRkZJQUlnQWhzRVFBSkFRWkQrQXlFQUEwQWdBRUdtL2dOT0RRRWdBRUVBRUhrZ0FFRUJhaUVBREFBQUN3QUxDeUFCUVlBQmNVRUFSeVN4QVF3QkMwRUJEd3RCQVFzOEFRRi9JQUJCQ0hRaEFVRUFJUUFEUUFKQUlBQkJud0ZLRFFBZ0FFR0EvQU5xSUFBZ0FXb1FBaEFFSUFCQkFXb2hBQXdCQ3d0QmhBVWtnUUlMSXdFQmZ5UDhBUkFDSVFBai9RRVFBa0gvQVhFZ0FFSC9BWEZCQ0hSeVFmRC9BM0VMSndFQmZ5UCtBUkFDSVFBai93RVFBa0gvQVhFZ0FFSC9BWEZCQ0hSeVFmQS9jVUdBZ0FKcUM0UUJBUU4vSTRrQ1JRUkFEd3NnQUVHQUFYRkZJNElDSTRJQ0d3UkFRUUFrZ2dJamdBSVFBa0dBQVhJaEFDT0FBaUFBRUFRUEN4QnVJUUVRYnlFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSklJQ0lBTWtnd0lnQVNTRUFpQUNKSVVDSTRBQ0lBQkIvMzV4RUFRRklBRWdBaUFERUhvamdBSkIvd0VRQkFzTFhnRUVmeU5ISVFNalJpQUFSaUlDUlFSQUlBQWdBMFloQWdzZ0FnUkFJQUJCQVdzaUJCQUNRYjkvY1NJQ1FUOXhJZ1ZCUUdzZ0JTQUFJQU5HRzBHQWtBUnFJQUU2QUFBZ0FrR0FBWEVFUUNBRUlBSkJBV3BCZ0FGeUVBUUxDd3N4QUFKQUFrQUNRQUpBSUFBRVFBSkFJQUJCQVdzT0F3SURCQUFMREFRTFFRa1BDMEVERHd0QkJROExRUWNQQzBFQUN5VUJBWDlCQVNQTkFSQnlJZ0owSUFCeFFRQkhJZ0FFZjBFQklBSjBJQUZ4UlFVZ0FBc0xoUUVCQkg4RFFDQUNJQUJJQkVBZ0FrRUVhaUVDSThjQklnRkJCR3BCLy84RGNTSURKTWNCSTh3QkJFQWp5Z0VoQkNQSkFRUkFJOHNCSk1nQlFRRWt3d0ZCQWhBL1FRQWt5UUZCQVNUS0FRVWdCQVJBUVFBa3lnRUxDeUFCSUFNUWN3UkFJOGdCUVFGcUlnRkIvd0ZLQkVCQkFTVEpBVUVBSVFFTElBRWt5QUVMQ3d3QkN3c0xEQUFqeGdFUWRFRUFKTVlCQzBZQkFYOGp4d0VoQUVFQUpNY0JRWVQrQTBFQUVBUWp6QUVFZnlBQVFRQVFjd1VqekFFTEJFQWp5QUZCQVdvaUFFSC9BVW9FUUVFQkpNa0JRUUFoQUFzZ0FDVElBUXNMZ2dFQkEzOGp6QUVoQVNBQVFRUnhRUUJISk13QklBQkJBM0VoQWlBQlJRUkFJODBCRUhJaEFDQUNFSEloQXlQSEFTRUJJOHdCQkg5QkFTQUFkQ0FCY1FWQkFTQUFkQ0FCY1VFQVJ5SUFCSDlCQVNBRGRDQUJjUVVnQUFzTEJFQWp5QUZCQVdvaUFFSC9BVW9FUUVFQkpNa0JRUUFoQUFzZ0FDVElBUXNMSUFJa3pRRUxoUWNCQW44Q1FBSkFJQUJCemY0RFJnUkFRYzMrQXlBQlFRRnhFQVFNQVFzZ0FFSFEvZ05HSTRnQ0lnSWdBaHNFUUVFQUpJZ0NRZjhCSkpRQ0RBSUxJQUJCZ0lBQ1NBUkFJQUFnQVJCZERBRUxJQUJCZ0lBQ1RpSUNCRUFnQUVHQXdBSklJUUlMSUFJTkFTQUFRWURBQTA0aUFnUkFJQUJCZ1B3RFNDRUNDeUFDQkVBZ0FFR0FRR29nQVJBRURBSUxJQUJCZ1B3RFRpSUNCRUFnQUVHZi9RTk1JUUlMSUFJRVFDUGlBVUVDVGc4TElBQkJvUDBEVGlJQ0JFQWdBRUgvL1FOTUlRSUxJQUlOQUNBQVFZTCtBMFlFUUNBQlFRRnhRUUJISk5BQklBRkJBbkZCQUVjazBRRWdBVUdBQVhGQkFFY2swZ0ZCQVE4TElBQkJrUDREVGlJQ0JFQWdBRUdtL2dOTUlRSUxJQUlFUUJCWUlBQWdBUkJzRHdzZ0FFR3cvZ05PSWdJRVFDQUFRYi8rQTB3aEFnc2dBZ1JBRUZnamZnUkFJNE1CUVFGMVFiRCtBMm9nQVJBRURBSUxEQUlMSUFCQndQNERUaUlDQkVBZ0FFSEwvZ05NSVFJTElBSUVRQ0FBUWNEK0EwWUVRQ0FCRUNRTUF3c2dBRUhCL2dOR0JFQkJ3ZjRESUFGQitBRnhRY0grQXhBQ1FRZHhja0dBQVhJUUJBd0NDeUFBUWNUK0EwWUVRRUVBSk80QklBQkJBQkFFREFJTElBQkJ4ZjREUmdSQUlBRWs0d0VNQXdzZ0FFSEcvZ05HQkVBZ0FSQnREQU1MQWtBQ1FBSkFBa0FnQUVIRC9nTkhCRUFnQUVIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTVHZBUXdHQ3lBQkpQQUJEQVVMSUFFazhRRU1CQXNnQVNUeUFRd0RDd3dDQ3lPQUFpQUFSZ1JBSUFFUWNBd0JDeU9IQWlBQVJpSUNSUVJBSTRZQ0lBQkdJUUlMSUFJRVFDT0NBZ1JBQW44amhBSWlBMEdBZ0FGT0lnSUVRQ0FEUWYvL0FVd2hBZ3NnQWtVTEJFQWdBMEdBb0FOT0lnSUVRQ0FEUWYrL0Ewd2hBZ3NMSUFJTkFnc0xJQUFqUlU0aUFnUkFJQUFqUjB3aEFnc2dBZ1JBSUFBZ0FSQnhEQUlMSUFCQmhQNERUaUlDQkVBZ0FFR0gvZ05NSVFJTElBSUVRQkIxQWtBQ1FBSkFBa0FnQUVHRS9nTkhCRUFnQUVHRi9nTnJEZ01CQWdNRUN4QjJEQVVMQWtBanpBRUVRQ1BLQVEwQkk4a0JCRUJCQUNUSkFRc0xJQUVreUFFTERBVUxJQUVreXdFanlnRWp6QUVpQUNBQUd3UkFJQUVreUFGQkFDVEtBUXNNQkFzZ0FSQjNEQU1MREFJTElBQkJnUDREUmdSQUlBRkIvd0Z6Sk5zQkk5c0JJZ0pCRUhGQkFFY2szQUVnQWtFZ2NVRUFSeVRkQVFzZ0FFR1AvZ05HQkVBZ0FSQVVEQUlMSUFCQi8vOERSZ1JBSUFFUUV3d0NDMEVCRHd0QkFBOExRUUVMSHdBajRBRWdBRVlFUUVFQkpPRUJDeUFBSUFFUWVBUkFJQUFnQVJBRUN3dGFBUU4vQTBBQ1FDQURJQUpPRFFBZ0FDQURhaEJjSVFVZ0FTQURhaUVFQTBBZ0JFSC92d0pLQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUhrZ0EwRUJhaUVEREFFTEN5T0JBa0VnSTRvQ2RDQUNRUVIxYkdva2dRSUxjZ0VDZnlPQ0FrVUVRQThMUVJBaEFDT0VBaU9GQWdKL0k0TUNJZ0ZCRUVnRVFDQUJJUUFMSUFBTEVIb2poQUlnQUdva2hBSWpoUUlnQUdva2hRSWdBU0FBYXlJQUpJTUNJNEFDSVFFZ0FFRUFUQVJBUVFBa2dnSWdBVUgvQVJBRUJTQUJJQUJCQkhWQkFXdEIvMzV4RUFRTEMwQUJBWDhnQUVVaUFnUi9JQUlGSUFCQkFVWUxJZ0FFZnlQdUFTUGpBVVlGSUFBTEJFQWdBVUVFY2lJQlFjQUFjUVJBRUVBTEJTQUJRWHR4SVFFTElBRUwvZ0VCQlg4ajVBRkZCRUFQQ3lQaUFTRUFJQUFqN2dFaUFrR1FBVTRFZjBFQkJVSDRBaU9LQW5RaUFTRURJKzBCSWdRZ0FVNEVmMEVDQlVFRFFRQWdCQ0FEVGhzTEN5SUJSd1JBUWNIK0F4QUNJUUFnQVNUaUFVRUFJUUlDUUFKQUFrQUNRQ0FCQkVBZ0FVRUJhdzREQVFJREJBc2dBRUY4Y1NJQVFRaHhRUUJISVFJTUF3c2dBRUY5Y1VFQmNpSUFRUkJ4UVFCSElRSU1BZ3NnQUVGK2NVRUNjaUlBUVNCeFFRQkhJUUlNQVFzZ0FFRURjaUVBQ3lBQ0JFQVFRQXNnQVVVRVFCQjdDeUFCUVFGR0JFQkJBU1RCQVVFQUVEOExRY0grQXlBQklBQVFmQkFFQlNBQ1Faa0JSZ1JBUWNIK0F5QUJRY0grQXhBQ0VId1FCQXNMQzU4QkFRRi9JK1FCQkVBajdRRWdBR29rN1FFak5DRUJBMEFqN1FGQkJDT0tBaUlBZEVISUF5QUFkQ1B1QVVHWkFVWWJUZ1JBSSswQlFRUWppZ0lpQUhSQnlBTWdBSFFqN2dGQm1RRkdHMnNrN1FFajdnRWlBRUdRQVVZRVFDQUJCRUFRUFFVZ0FCQThDeEErUVg4a1NFRi9KRWtGSUFCQmtBRklCRUFnQVVVRVFDQUFFRHdMQ3d0QkFDQUFRUUZxSUFCQm1RRktHeVR1QVF3QkN3c0xFSDBMTndFQmYwRUVJNG9DSWdCMFFjZ0RJQUIwSSs0QlFaa0JSaHNoQUFOQUkrd0JJQUJPQkVBZ0FCQitJK3dCSUFCckpPd0JEQUVMQ3d1NEFRRUVmeVBTQVVVRVFBOExBMEFnQXlBQVNBUkFJQU5CQkdvaEF3Si9JODRCSWdGQkJHb2lBa0gvL3dOS0JFQWdBa0dBZ0FScklRSUxJQUlMSk00QlFRRkJBa0VISTlFQkd5SUVkQ0FCY1VFQVJ5SUJCRUJCQVNBRWRDQUNjVVVoQVFzZ0FRUkFRWUgrQTBHQi9nTVFBa0VCZEVFQmFrSC9BWEVRQkNQUEFVRUJhaUlCUVFoR0JFQkJBQ1RQQVVFQkpNUUJRUU1RUDBHQy9nTkJndjRERUFKQi8zNXhFQVJCQUNUU0FRVWdBU1RQQVFzTERBRUxDd3VSQVFBamdRSkJBRW9FUUNPQkFpQUFhaUVBUVFBa2dRSUxJNVVDSUFCcUpKVUNJNWtDUlFSQUl6SUVRQ1BzQVNBQWFpVHNBUkIvQlNBQUVINExJekVFUUNPbUFTQUFhaVNtQVJCWUJTQUFFRmNMSUFBUWdBRUxJek1FUUNQR0FTQUFhaVRHQVJCMUJTQUFFSFFMSTV3Q0lBQnFJZ0FqbWdKT0JFQWptd0pCQVdva213SWdBQ09hQW1zaEFBc2dBQ1NjQWdzTUFFRUVFSUVCSTVRQ0VBSUxLUUVCZjBFRUVJRUJJNVFDUVFGcVFmLy9BM0VRQWlFQUVJSUJRZjhCY1NBQVFmOEJjVUVJZEhJTERRQkJCQkNCQVNBQUlBRVFlUXN3QUVFQklBQjBRZjhCY1NFQUlBRkJBRW9FUUNPU0FpQUFja0gvQVhFa2tnSUZJNUlDSUFCQi93RnpjU1NTQWdzTENRQkJCU0FBRUlVQkN6b0JBWDhnQVVFQVRnUkFJQUJCRDNFZ0FVRVBjV3BCRUhGQkFFY1FoZ0VGSUFGQkgzVWlBaUFCSUFKcWMwRVBjU0FBUVE5eFN4Q0dBUXNMQ1FCQkJ5QUFFSVVCQ3drQVFRWWdBQkNGQVFzSkFFRUVJQUFRaFFFTFBRRUNmeUFCUVlEK0EzRkJDSFVoQWlBQlFmOEJjU0lCSVFNZ0FDQUJFSGdFUUNBQUlBTVFCQXNnQUVFQmFpSUFJQUlRZUFSQUlBQWdBaEFFQ3dzT0FFRUlFSUVCSUFBZ0FSQ0xBUXRhQUNBQ0JFQWdBRUgvL3dOeElnQWdBV29nQUNBQmMzTWlBRUVRY1VFQVJ4Q0dBU0FBUVlBQ2NVRUFSeENLQVFVZ0FDQUJha0gvL3dOeElnSWdBRUgvL3dOeFNSQ0tBU0FBSUFGeklBSnpRWUFnY1VFQVJ4Q0dBUXNMQ3dCQkJCQ0JBU0FBRUZ3THFRVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTERCVUxFSU1CUWYvL0EzRWlBRUdBL2dOeFFRaDFKSXdDSUFCQi93RnhKSTBDREE4TEk0MENRZjhCY1NPTUFrSC9BWEZCQ0hSeUk0c0NFSVFCREJNTEk0MENRZjhCY1NPTUFrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJd0NEQk1MSTR3Q0lnQkJBUkNIQVNBQVFRRnFRZjhCY1NJQUpJd0NEQTBMSTR3Q0lnQkJmeENIQVNBQVFRRnJRZjhCY1NJQUpJd0NEQTBMRUlJQlFmOEJjU1NNQWd3TkN5T0xBaUlBUVlBQmNVR0FBVVlRaWdFZ0FFRUJkQ0FBUWY4QmNVRUhkbkpCL3dGeEpJc0NEQTBMRUlNQlFmLy9BM0Vqa3dJUWpBRU1DQXNqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElpQUNPTkFrSC9BWEVqakFKQi93RnhRUWgwY2lJQlFRQVFqUUVnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTUUFpQUFRZjhCY1NTUkFrRUFFSWtCUVFnUEN5T05Ba0gvQVhFampBSkIvd0Z4UVFoMGNoQ09BVUgvQVhFa2l3SU1Dd3NqalFKQi93RnhJNHdDUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVrakFJTUN3c2pqUUlpQUVFQkVJY0JJQUJCQVdwQi93RnhJZ0FralFJTUJRc2pqUUlpQUVGL0VJY0JJQUJCQVd0Qi93RnhJZ0FralFJTUJRc1FnZ0ZCL3dGeEpJMENEQVVMSTRzQ0lnQkJBWEZCQUVzUWlnRWdBRUVIZENBQVFmOEJjVUVCZG5KQi93RnhKSXNDREFVTFFYOFBDeU9VQWtFQ2FrSC8vd054SkpRQ0RBUUxJQUJGRUlnQlFRQVFpUUVNQXdzZ0FFVVFpQUZCQVJDSkFRd0NDeU9VQWtFQmFrSC8vd054SkpRQ0RBRUxRUUFRaUFGQkFCQ0pBVUVBRUlZQkMwRUVEd3NnQUVIL0FYRWtqUUpCQ0F1WkJnRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRVFSd1JBSUFCQkVVWU5BUUpBSUFCQkVtc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqaVFJRVFFSE4vZ01RamdGQi93RnhJZ0JCQVhFRVFFSE4vZ01nQUVGK2NTSUFRWUFCY1FSL1FRQWtpZ0lnQUVIL2ZuRUZRUUVraWdJZ0FFR0FBWElMRUlRQlFjUUFEd3NMUVFFa21RSU1FQXNRZ3dGQi8vOERjU0lBUVlEK0EzRkJDSFVramdJZ0FFSC9BWEVrandJamxBSkJBbXBCLy84RGNTU1VBZ3dSQ3lPUEFrSC9BWEVqamdKQi93RnhRUWgwY2lPTEFoQ0VBUXdRQ3lPUEFrSC9BWEVqamdKQi93RnhRUWgwY2tFQmFrSC8vd054SWdCQmdQNERjVUVJZFNTT0Fnd1FDeU9PQWlJQVFRRVFod0VnQUVFQmFrSC9BWEVramdJampnSkZFSWdCUVFBUWlRRU1EZ3NqamdJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4Skk0Q0k0NENSUkNJQVVFQkVJa0JEQTBMRUlJQlFmOEJjU1NPQWd3S0N5T0xBaUlCUVlBQmNVR0FBVVloQUNPU0FrRUVka0VCY1NBQlFRRjBja0gvQVhFa2l3SU1DZ3NRZ2dFaEFDT1VBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2xBSkJDQThMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5SWdBamp3SkIvd0Z4STQ0Q1FmOEJjVUVJZEhJaUFVRUFFSTBCSUFBZ0FXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tBSWdBRUgvQVhFa2tRSkJBQkNKQVVFSUR3c2pqd0pCL3dGeEk0NENRZjhCY1VFSWRISVFqZ0ZCL3dGeEpJc0NEQWdMSTQ4Q1FmOEJjU09PQWtIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkk0Q0RBZ0xJNDhDSWdCQkFSQ0hBU0FBUVFGcVFmOEJjU0lBSkk4Q0lBQkZFSWdCUVFBUWlRRU1CZ3NqandJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4SWdBa2p3SWdBRVVRaUFGQkFSQ0pBUXdGQ3hDQ0FVSC9BWEVrandJTUFnc2ppd0lpQVVFQmNVRUJSaUVBSTVJQ1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpU0xBZ3dDQzBGL0R3c2psQUpCQVdwQi8vOERjU1NVQWd3QkN5QUFFSW9CUVFBUWlBRkJBQkNKQVVFQUVJWUJDMEVFRHdzZ0FFSC9BWEVrandKQkNBdjFCZ0VDZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQklFY0VRQ0FBUVNGR0RRRUNRQ0FBUVNKckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJNUlDUVFkMlFRRnhCRUFqbEFKQkFXcEIvLzhEY1NTVUFnVVFnZ0VoQUNPVUFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VrbEFJTFFRZ1BDeENEQVVILy93TnhJZ0JCZ1A0RGNVRUlkU1NRQWlBQVFmOEJjU1NSQWlPVUFrRUNha0gvL3dOeEpKUUNEQlFMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5SWdBaml3SVFoQUVNRHdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhKQkFXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tBSU1EUXNqa0FJaUFFRUJFSWNCSUFCQkFXcEIvd0Z4SWdBa2tBSU1EZ3Nqa0FJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4SWdBa2tBSU1EZ3NRZ2dGQi93RnhKSkFDREE0TFFRWkJBQ09TQWlJQ1FRVjJRUUZ4UVFCTEd5SUFRZUFBY2lBQUlBSkJCSFpCQVhGQkFFc2JJUUFqaXdJaEFTQUNRUVoyUVFGeFFRQkxCSDhnQVNBQWEwSC9BWEVGSUFFZ0FFRUdjaUFBSUFGQkQzRkJDVXNiSWdCQjRBQnlJQUFnQVVHWkFVc2JJZ0JxUWY4QmNRc2lBVVVRaUFFZ0FFSGdBSEZCQUVjUWlnRkJBQkNHQVNBQkpJc0NEQTRMSTVJQ1FRZDJRUUZ4UVFCTEJFQVFnZ0VoQUNPVUFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VrbEFJRkk1UUNRUUZxUWYvL0EzRWtsQUlMUVFnUEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpSUFJQUJCLy84RGNVRUFFSTBCSUFCQkFYUkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tBSWdBRUgvQVhFa2tRSkJBQkNKQVVFSUR3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISWlBQkNPQVVIL0FYRWtpd0lNQndzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tBSU1CUXNqa1FJaUFFRUJFSWNCSUFCQkFXcEIvd0Z4SWdBa2tRSU1CZ3Nqa1FJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4SWdBa2tRSU1CZ3NRZ2dGQi93RnhKSkVDREFZTEk0c0NRWDl6UWY4QmNTU0xBa0VCRUlrQlFRRVFoZ0VNQmd0QmZ3OExJQUJCL3dGeEpKRUNRUWdQQ3lBQVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpKQUNJQUJCL3dGeEpKRUNEQU1MSUFCRkVJZ0JRUUFRaVFFTUFnc2dBRVVRaUFGQkFSQ0pBUXdCQ3lPVUFrRUJha0gvL3dOeEpKUUNDMEVFQy9FRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFd1J3UkFJQUJCTVVZTkFRSkFJQUJCTW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2prZ0pCQkhaQkFYRUVRQ09VQWtFQmFrSC8vd054SkpRQ0JSQ0NBU0VBSTVRQ0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NVQWd0QkNBOExFSU1CUWYvL0EzRWtrd0lqbEFKQkFtcEIvLzhEY1NTVUFnd1JDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBjaUlBSTRzQ0VJUUJEQTRMSTVNQ1FRRnFRZi8vQTNFa2t3SkJDQThMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5SWdBUWpnRWlBVUVCRUljQklBRkJBV3BCL3dGeElnRkZFSWdCUVFBUWlRRWdBQ0FCRUlRQkRBNExJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlJZ0FRamdFaUFVRi9FSWNCSUFGQkFXdEIvd0Z4SWdGRkVJZ0JRUUVRaVFFZ0FDQUJFSVFCREEwTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJSUJRZjhCY1JDRUFRd0xDMEVBRUlrQlFRQVFoZ0ZCQVJDS0FRd0xDeU9TQWtFRWRrRUJjVUVCUmdSQUVJSUJJUUFqbEFJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSlFDQlNPVUFrRUJha0gvL3dOeEpKUUNDMEVJRHdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJaUFDT1RBa0VBRUkwQkk1TUNJQUJxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSkFDSUFCQi93RnhKSkVDUVFBUWlRRkJDQThMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5SWdBUWpnRkIvd0Z4SklzQ0RBWUxJNU1DUVFGclFmLy9BM0Vra3dKQkNBOExJNHNDSWdCQkFSQ0hBU0FBUVFGcVFmOEJjU0lBSklzQ0lBQkZFSWdCUVFBUWlRRU1CZ3NqaXdJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4SWdBa2l3SWdBRVVRaUFGQkFSQ0pBUXdGQ3hDQ0FVSC9BWEVraXdJTUF3dEJBQkNKQVVFQUVJWUJJNUlDUVFSMlFRRnhRUUJORUlvQkRBTUxRWDhQQ3lBQVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpKQUNJQUJCL3dGeEpKRUNEQUVMSTVRQ1FRRnFRZi8vQTNFa2xBSUxRUVFMZ2dJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFFY0VRQ0FBUWNFQVJnMEJBa0FnQUVIQ0FHc09EZ01FQlFZSENBa1JDZ3NNRFE0UEFBc01Ed3NNRHdzampRSWtqQUlNRGdzampnSWtqQUlNRFFzamp3SWtqQUlNREFzamtBSWtqQUlNQ3dzamtRSWtqQUlNQ2dzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRkIvd0Z4Skl3Q0RBa0xJNHNDSkl3Q0RBZ0xJNHdDSkkwQ0RBY0xJNDRDSkkwQ0RBWUxJNDhDSkkwQ0RBVUxJNUFDSkkwQ0RBUUxJNUVDSkkwQ0RBTUxJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFSTRCUWY4QmNTU05BZ3dDQ3lPTEFpU05BZ3dCQzBGL0R3dEJCQXY5QVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQUVjRVFDQUFRZEVBUmcwQkFrQWdBRUhTQUdzT0RoQURCQVVHQndnSkNoQUxEQTBPQUFzTURnc2pqQUlramdJTURnc2pqUUlramdJTURRc2pqd0lramdJTURBc2prQUlramdJTUN3c2prUUlramdJTUNnc2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0ZCL3dGeEpJNENEQWtMSTRzQ0pJNENEQWdMSTR3Q0pJOENEQWNMSTQwQ0pJOENEQVlMSTQ0Q0pJOENEQVVMSTVBQ0pJOENEQVFMSTVFQ0pJOENEQU1MSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5RUk0QlFmOEJjU1NQQWd3Q0N5T0xBaVNQQWd3QkMwRi9Ed3RCQkF2OUFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIZ0FFY0VRQ0FBUWVFQVJnMEJBa0FnQUVIaUFHc09EZ01FRUFVR0J3Z0pDZ3NNRUEwT0FBc01EZ3NqakFJa2tBSU1EZ3NqalFJa2tBSU1EUXNqamdJa2tBSU1EQXNqandJa2tBSU1Dd3Nqa1FJa2tBSU1DZ3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRamdGQi93RnhKSkFDREFrTEk0c0NKSkFDREFnTEk0d0NKSkVDREFjTEk0MENKSkVDREFZTEk0NENKSkVDREFVTEk0OENKSkVDREFRTEk1QUNKSkVDREFNTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJNEJRZjhCY1NTUkFnd0NDeU9MQWlTUkFnd0JDMEYvRHd0QkJBdWJBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFBUndSQUlBQkI4UUJHRFFFQ1FDQUFRZklBYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEVBQ3d3UEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT01BaENFQVF3UEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT05BaENFQVF3T0N5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT09BaENFQVF3TkN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT1BBaENFQVF3TUN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT1FBaENFQVF3TEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT1JBaENFQVF3S0N5T0NBa1VFUUFKQUk3Z0JCRUJCQVNTV0Fnd0JDeU82QVNQQUFYRkJIM0ZGQkVCQkFTU1hBZ3dCQzBFQkpKZ0NDd3NNQ1FzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJaml3SVFoQUVNQ0FzampBSWtpd0lNQndzampRSWtpd0lNQmdzampnSWtpd0lNQlFzamp3SWtpd0lNQkFzamtBSWtpd0lNQXdzamtRSWtpd0lNQWdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRkIvd0Z4SklzQ0RBRUxRWDhQQzBFRUN6Y0JBWDhnQVVFQVRnUkFJQUJCL3dGeElBQWdBV3BCL3dGeFN4Q0tBUVVnQVVFZmRTSUNJQUVnQW1weklBQkIvd0Z4U2hDS0FRc0xOQUVDZnlPTEFpSUJJQUJCL3dGeElnSVFod0VnQVNBQ0VKY0JJQUFnQVdwQi93RnhJZ0FraXdJZ0FFVVFpQUZCQUJDSkFRdFlBUUovSTRzQ0lnRWdBR29qa2dKQkJIWkJBWEZxUWY4QmNTSUNJQUFnQVhOelFSQnhRUUJIRUlZQklBQkIvd0Z4SUFGcUk1SUNRUVIyUVFGeGFrR0FBbkZCQUVzUWlnRWdBaVNMQWlBQ1JSQ0lBVUVBRUlrQkM0c0NBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdBQVVjRVFDQUFRWUVCUmcwQkFrQWdBRUdDQVdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pqQUlRbUFFTUVBc2pqUUlRbUFFTUR3c2pqZ0lRbUFFTURnc2pqd0lRbUFFTURRc2prQUlRbUFFTURBc2prUUlRbUFFTUN3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRbUFFTUNnc2ppd0lRbUFFTUNRc2pqQUlRbVFFTUNBc2pqUUlRbVFFTUJ3c2pqZ0lRbVFFTUJnc2pqd0lRbVFFTUJRc2prQUlRbVFFTUJBc2prUUlRbVFFTUF3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRbVFFTUFnc2ppd0lRbVFFTUFRdEJmdzhMUVFRTE53RUNmeU9MQWlJQklBQkIvd0Z4UVg5c0lnSVFod0VnQVNBQ0VKY0JJQUVnQUd0Qi93RnhJZ0FraXdJZ0FFVVFpQUZCQVJDSkFRdFlBUUovSTRzQ0lnRWdBR3Nqa2dKQkJIWkJBWEZyUWY4QmNTSUNJQUFnQVhOelFSQnhRUUJIRUlZQklBRWdBRUgvQVhGckk1SUNRUVIyUVFGeGEwR0FBbkZCQUVzUWlnRWdBaVNMQWlBQ1JSQ0lBVUVCRUlrQkM0c0NBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdRQVVjRVFDQUFRWkVCUmcwQkFrQWdBRUdTQVdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pqQUlRbXdFTUVBc2pqUUlRbXdFTUR3c2pqZ0lRbXdFTURnc2pqd0lRbXdFTURRc2prQUlRbXdFTURBc2prUUlRbXdFTUN3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRbXdFTUNnc2ppd0lRbXdFTUNRc2pqQUlRbkFFTUNBc2pqUUlRbkFFTUJ3c2pqZ0lRbkFFTUJnc2pqd0lRbkFFTUJRc2prQUlRbkFFTUJBc2prUUlRbkFFTUF3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRbkFFTUFnc2ppd0lRbkFFTUFRdEJmdzhMUVFRTElnQWppd0lnQUhFaUFDU0xBaUFBUlJDSUFVRUFFSWtCUVFFUWhnRkJBQkNLQVFzbUFDT0xBaUFBYzBIL0FYRWlBQ1NMQWlBQVJSQ0lBVUVBRUlrQlFRQVFoZ0ZCQUJDS0FRdUxBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCb0FGSEJFQWdBRUdoQVVZTkFRSkFJQUJCb2dGckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJNHdDRUo0QkRCQUxJNDBDRUo0QkRBOExJNDRDRUo0QkRBNExJNDhDRUo0QkRBMExJNUFDRUo0QkRBd0xJNUVDRUo0QkRBc0xJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFSTRCRUo0QkRBb0xJNHNDRUo0QkRBa0xJNHdDRUo4QkRBZ0xJNDBDRUo4QkRBY0xJNDRDRUo4QkRBWUxJNDhDRUo4QkRBVUxJNUFDRUo4QkRBUUxJNUVDRUo4QkRBTUxJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFSTRCRUo4QkRBSUxJNHNDRUo4QkRBRUxRWDhQQzBFRUN5WUFJNHNDSUFCeVFmOEJjU0lBSklzQ0lBQkZFSWdCUVFBUWlRRkJBQkNHQVVFQUVJb0JDeXdCQVg4aml3SWlBU0FBUWY4QmNVRi9iQ0lBRUljQklBRWdBQkNYQVNBQUlBRnFSUkNJQVVFQkVJa0JDNHNDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHd0FVY0VRQ0FBUWJFQlJnMEJBa0FnQUVHeUFXc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqakFJUW9RRU1FQXNqalFJUW9RRU1Ed3NqamdJUW9RRU1EZ3NqandJUW9RRU1EUXNqa0FJUW9RRU1EQXNqa1FJUW9RRU1Dd3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRamdFUW9RRU1DZ3NqaXdJUW9RRU1DUXNqakFJUW9nRU1DQXNqalFJUW9nRU1Cd3NqamdJUW9nRU1CZ3NqandJUW9nRU1CUXNqa0FJUW9nRU1CQXNqa1FJUW9nRU1Bd3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRamdFUW9nRU1BZ3NqaXdJUW9nRU1BUXRCZnc4TFFRUUxPd0VCZnlBQUVGc2lBVUYvUmdSL0lBQVFBZ1VnQVF0Qi93RnhJQUJCQVdvaUFSQmJJZ0JCZjBZRWZ5QUJFQUlGSUFBTFFmOEJjVUVJZEhJTERBQkJDQkNCQVNBQUVLUUJDelFBSUFCQmdBRnhRWUFCUmhDS0FTQUFRUUYwSUFCQi93RnhRUWQyY2tIL0FYRWlBRVVRaUFGQkFCQ0pBVUVBRUlZQklBQUxNZ0FnQUVFQmNVRUFTeENLQVNBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFaUFFVVFpQUZCQUJDSkFVRUFFSVlCSUFBTE9BRUJmeU9TQWtFRWRrRUJjU0FBUVFGMGNrSC9BWEVoQVNBQVFZQUJjVUdBQVVZUWlnRWdBVVVRaUFGQkFCQ0pBVUVBRUlZQklBRUxPUUVCZnlPU0FrRUVka0VCY1VFSGRDQUFRZjhCY1VFQmRuSWhBU0FBUVFGeFFRRkdFSW9CSUFGRkVJZ0JRUUFRaVFGQkFCQ0dBU0FCQ3lvQUlBQkJnQUZ4UVlBQlJoQ0tBU0FBUVFGMFFmOEJjU0lBUlJDSUFVRUFFSWtCUVFBUWhnRWdBQXM5QVFGL0lBQkIvd0Z4UVFGMklnRkJnQUZ5SUFFZ0FFR0FBWEZCZ0FGR0d5SUJSUkNJQVVFQUVJa0JRUUFRaGdFZ0FFRUJjVUVCUmhDS0FTQUJDeXNBSUFCQkQzRkJCSFFnQUVId0FYRkJCSFp5SWdCRkVJZ0JRUUFRaVFGQkFCQ0dBVUVBRUlvQklBQUxLZ0VCZnlBQVFmOEJjVUVCZGlJQlJSQ0lBVUVBRUlrQlFRQVFoZ0VnQUVFQmNVRUJSaENLQVNBQkN4NEFRUUVnQUhRZ0FYRkIvd0Z4UlJDSUFVRUFFSWtCUVFFUWhnRWdBUXZOQ0FFRmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRUhjU0lFQkVBZ0JFRUJSZzBCQWtBZ0JFRUNhdzRHQXdRRkJnY0lBQXNNQ0FzampBSWhBUXdIQ3lPTkFpRUJEQVlMSTQ0Q0lRRU1CUXNqandJaEFRd0VDeU9RQWlFQkRBTUxJNUVDSVFFTUFnc2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VoQVF3QkN5T0xBaUVCQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGeFFRUjFJZ1VFUUNBRlFRRkdEUUVDUUNBRlFRSnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSUFCQkIwd0VmeUFCRUtZQklRSkJBUVVnQUVFUFRBUi9JQUVRcHdFaEFrRUJCVUVBQ3dzaEF3d1BDeUFBUVJkTUJIOGdBUkNvQVNFQ1FRRUZJQUJCSDB3RWZ5QUJFS2tCSVFKQkFRVkJBQXNMSVFNTURnc2dBRUVuVEFSL0lBRVFxZ0VoQWtFQkJTQUFRUzlNQkg4Z0FSQ3JBU0VDUVFFRlFRQUxDeUVEREEwTElBQkJOMHdFZnlBQkVLd0JJUUpCQVFVZ0FFRS9UQVIvSUFFUXJRRWhBa0VCQlVFQUN3c2hBd3dNQ3lBQVFjY0FUQVIvUVFBZ0FSQ3VBU0VDUVFFRklBQkJ6d0JNQkg5QkFTQUJFSzRCSVFKQkFRVkJBQXNMSVFNTUN3c2dBRUhYQUV3RWYwRUNJQUVRcmdFaEFrRUJCU0FBUWQ4QVRBUi9RUU1nQVJDdUFTRUNRUUVGUVFBTEN5RUREQW9MSUFCQjV3Qk1CSDlCQkNBQkVLNEJJUUpCQVFVZ0FFSHZBRXdFZjBFRklBRVFyZ0VoQWtFQkJVRUFDd3NoQXd3SkN5QUFRZmNBVEFSL1FRWWdBUkN1QVNFQ1FRRUZJQUJCL3dCTUJIOUJCeUFCRUs0QklRSkJBUVZCQUFzTElRTU1DQXNnQUVHSEFVd0VmeUFCUVg1eElRSkJBUVVnQUVHUEFVd0VmeUFCUVgxeElRSkJBUVZCQUFzTElRTU1Cd3NnQUVHWEFVd0VmeUFCUVh0eElRSkJBUVVnQUVHZkFVd0VmeUFCUVhkeElRSkJBUVZCQUFzTElRTU1CZ3NnQUVHbkFVd0VmeUFCUVc5eElRSkJBUVVnQUVHdkFVd0VmeUFCUVY5eElRSkJBUVZCQUFzTElRTU1CUXNnQUVHM0FVd0VmeUFCUWI5L2NTRUNRUUVGSUFCQnZ3Rk1CSDhnQVVIL2ZuRWhBa0VCQlVFQUN3c2hBd3dFQ3lBQVFjY0JUQVIvSUFGQkFYSWhBa0VCQlNBQVFjOEJUQVIvSUFGQkFuSWhBa0VCQlVFQUN3c2hBd3dEQ3lBQVFkY0JUQVIvSUFGQkJISWhBa0VCQlNBQVFkOEJUQVIvSUFGQkNISWhBa0VCQlVFQUN3c2hBd3dDQ3lBQVFlY0JUQVIvSUFGQkVISWhBa0VCQlNBQVFlOEJUQVIvSUFGQklISWhBa0VCQlVFQUN3c2hBd3dCQ3lBQVFmY0JUQVIvSUFGQndBQnlJUUpCQVFVZ0FFSC9BVXdFZnlBQlFZQUJjaUVDUVFFRlFRQUxDeUVEQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQkFSQUlBUkJBVVlOQVFKQUlBUkJBbXNPQmdNRUJRWUhDQUFMREFnTElBSWtqQUlNQndzZ0FpU05BZ3dHQ3lBQ0pJNENEQVVMSUFJa2p3SU1CQXNnQWlTUUFnd0RDeUFDSkpFQ0RBSUxJQVZCQkVnaUFBUi9JQUFGSUFWQkIwb0xCRUFqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElnQWhDRUFRc01BUXNnQWlTTEFndEJCRUYvSUFNYkM3c0VBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSEFBVWNFUUNBQVFjRUJSZzBCQWtBZ0FFSENBV3NPRGdNU0JBVUdCd2dKQ2dzTUVRME9BQXNNRGdzamtnSkJCM1pCQVhFTkVRd09DeU9UQWhDbEFVSC8vd054SVFBamt3SkJBbXBCLy84RGNTU1RBaUFBUVlEK0EzRkJDSFVrakFJZ0FFSC9BWEVralFKQkJBOExJNUlDUVFkMlFRRnhEUkVNRGdzamtnSkJCM1pCQVhFTkVBd01DeU9UQWtFQ2EwSC8vd054SWdBa2t3SWdBQ09OQWtIL0FYRWpqQUpCL3dGeFFRaDBjaENNQVF3TkN4Q0NBUkNZQVF3TkN5T1RBa0VDYTBILy93TnhJZ0Fra3dJZ0FDT1VBaENNQVVFQUpKUUNEQXNMSTVJQ1FRZDJRUUZ4UVFGSERRb01Cd3Nqa3dJaUFCQ2xBVUgvL3dOeEpKUUNJQUJCQW1wQi8vOERjU1NUQWd3SkN5T1NBa0VIZGtFQmNVRUJSZzBIREFvTEVJSUJRZjhCY1JDdkFTRUFJNVFDUVFGcVFmLy9BM0VrbEFJZ0FBOExJNUlDUVFkMlFRRnhRUUZIRFFnamt3SkJBbXRCLy84RGNTSUFKSk1DSUFBamxBSkJBbXBCLy84RGNSQ01BUXdGQ3hDQ0FSQ1pBUXdHQ3lPVEFrRUNhMEgvL3dOeElnQWtrd0lnQUNPVUFoQ01BVUVJSkpRQ0RBUUxRWDhQQ3lPVEFpSUFFS1VCUWYvL0EzRWtsQUlnQUVFQ2FrSC8vd054SkpNQ1FRd1BDeU9UQWtFQ2EwSC8vd054SWdBa2t3SWdBQ09VQWtFQ2FrSC8vd054RUl3QkN4Q0RBVUgvL3dOeEpKUUNDMEVJRHdzamxBSkJBV3BCLy84RGNTU1VBa0VFRHdzamxBSkJBbXBCLy84RGNTU1VBa0VNQzZBRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGSEJFQWdBRUhSQVVZTkFRSkFJQUJCMGdGckRnNERBQVFGQmdjSUNRb0FDd0FNRFFBTERBMExJNUlDUVFSMlFRRnhEUThNRFFzamt3SWlBUkNsQVVILy93TnhJUUFnQVVFQ2FrSC8vd054SkpNQ0lBQkJnUDREY1VFSWRTU09BaUFBUWY4QmNTU1BBa0VFRHdzamtnSkJCSFpCQVhFTkR3d01DeU9TQWtFRWRrRUJjUTBPSTVNQ1FRSnJRZi8vQTNFaUFDU1RBaUFBSTVRQ1FRSnFRZi8vQTNFUWpBRU1Dd3Nqa3dKQkFtdEIvLzhEY1NJQUpKTUNJQUFqandKQi93RnhJNDRDUWY4QmNVRUlkSElRakFFTUN3c1FnZ0VRbXdFTUN3c2prd0pCQW10Qi8vOERjU0lBSkpNQ0lBQWpsQUlRakFGQkVDU1VBZ3dKQ3lPU0FrRUVka0VCY1VFQlJ3MElEQVlMSTVNQ0lnQVFwUUZCLy84RGNTU1VBa0VCSkxrQklBQkJBbXBCLy84RGNTU1RBZ3dIQ3lPU0FrRUVka0VCY1VFQlJnMEZEQWdMSTVJQ1FRUjJRUUZ4UVFGSERRY2prd0pCQW10Qi8vOERjU0lBSkpNQ0lBQWpsQUpCQW1wQi8vOERjUkNNQVF3RUN4Q0NBUkNjQVF3RkN5T1RBa0VDYTBILy93TnhJZ0Fra3dJZ0FDT1VBaENNQVVFWUpKUUNEQU1MUVg4UEN5T1RBaUlBRUtVQlFmLy9BM0VrbEFJZ0FFRUNha0gvL3dOeEpKTUNRUXdQQ3hDREFVSC8vd054SkpRQ0MwRUlEd3NqbEFKQkFXcEIvLzhEY1NTVUFrRUVEd3NqbEFKQkFtcEIvLzhEY1NTVUFrRU1DN0VEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFVWU5BUUpBSUFCQjRnRnJEZzREQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRUlJQlFmOEJjVUdBL2dOcUk0c0NFSVFCREFzTEk1TUNJZ0VRcFFGQi8vOERjU0VBSUFGQkFtcEIvLzhEY1NTVEFpQUFRWUQrQTNGQkNIVWtrQUlnQUVIL0FYRWtrUUpCQkE4TEk0MENRWUQrQTJvaml3SVFoQUZCQkE4TEk1TUNRUUpyUWYvL0EzRWlBQ1NUQWlBQUk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJd0JRUWdQQ3hDQ0FSQ2VBUXdIQ3lPVEFrRUNhMEgvL3dOeElnQWtrd0lnQUNPVUFoQ01BVUVnSkpRQ1FRZ1BDeENDQVVFWWRFRVlkU0VBSTVNQ0lBQkJBUkNOQVNPVEFpQUFha0gvL3dOeEpKTUNRUUFRaUFGQkFCQ0pBU09VQWtFQmFrSC8vd054SkpRQ1FRd1BDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBjaVNVQWtFRUR3c1Fnd0ZCLy84RGNTT0xBaENFQVNPVUFrRUNha0gvL3dOeEpKUUNRUVFQQ3hDQ0FSQ2ZBUXdDQ3lPVEFrRUNhMEgvL3dOeElnQWtrd0lnQUNPVUFoQ01BVUVvSkpRQ1FRZ1BDMEYvRHdzamxBSkJBV3BCLy84RGNTU1VBa0VFQytjREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFnQUVIeEFVWU5BUUpBSUFCQjhnRnJEZzREQkFBRkJnY0lDUW9MQUFBTURRQUxEQTBMRUlJQlFmOEJjVUdBL2dOcUVJNEJRZjhCY1NTTEFnd05DeU9UQWlJQkVLVUJRZi8vQTNFaEFDQUJRUUpxUWYvL0EzRWtrd0lnQUVHQS9nTnhRUWgxSklzQ0lBQkIvd0Z4SkpJQ0RBMExJNDBDUVlEK0Eyb1FqZ0ZCL3dGeEpJc0NEQXdMUVFBa3VBRU1Dd3Nqa3dKQkFtdEIvLzhEY1NJQUpKTUNJQUFqa2dKQi93RnhJNHNDUWY4QmNVRUlkSElRakFGQkNBOExFSUlCRUtFQkRBZ0xJNU1DUVFKclFmLy9BM0VpQUNTVEFpQUFJNVFDRUl3QlFUQWtsQUpCQ0E4TEVJSUJRUmgwUVJoMUlRQWprd0loQVVFQUVJZ0JRUUFRaVFFZ0FTQUFRUUVRalFFZ0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTU1FBaUFBUWY4QmNTU1JBaU9VQWtFQmFrSC8vd054SkpRQ1FRZ1BDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBjaVNUQWtFSUR3c1Fnd0ZCLy84RGNSQ09BVUgvQVhFa2l3SWpsQUpCQW1wQi8vOERjU1NVQWd3RkMwRUJKTGtCREFRTEVJSUJFS0lCREFJTEk1TUNRUUpyUWYvL0EzRWlBQ1NUQWlBQUk1UUNFSXdCUVRna2xBSkJDQThMUVg4UEN5T1VBa0VCYWtILy93TnhKSlFDQzBFRUM5Z0JBUUYvSTVRQ1FRRnFRZi8vQTNFaEFTT1lBZ1JBSUFGQkFXdEIvLzhEY1NFQkN5QUJKSlFDQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGckRnNEJBZ01FQlFZSENBa0tDd3dORGc4TElBQVFqd0VQQ3lBQUVKQUJEd3NnQUJDUkFROExJQUFRa2dFUEN5QUFFSk1CRHdzZ0FCQ1VBUThMSUFBUWxRRVBDeUFBRUpZQkR3c2dBQkNhQVE4TElBQVFuUUVQQ3lBQUVLQUJEd3NnQUJDakFROExJQUFRc0FFUEN5QUFFTEVCRHdzZ0FCQ3lBUThMSUFBUXN3RUx2Z0VCQW45QkFDUzRBVUdQL2dNUUFrRUJJQUIwUVg5emNTSUJKTUFCUVkvK0F5QUJFQVFqa3dKQkFtdEIvLzhEY1NTVEFpT1RBaUlCSTVRQ0lnSkIvd0Z4RUFRZ0FVRUJhaUFDUVlEK0EzRkJDSFVRQkFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0F3TUVCUUFMREFVTFFRQWt3UUZCd0FBa2xBSU1CQXRCQUNUQ0FVSElBQ1NVQWd3REMwRUFKTU1CUWRBQUpKUUNEQUlMUVFBa3hBRkIyQUFrbEFJTUFRdEJBQ1RGQVVIZ0FDU1VBZ3NMK1FFQkEzOGp1UUVFUUVFQkpMZ0JRUUFrdVFFTEk3b0JJOEFCY1VFZmNVRUFTZ1JBSTVjQ1JTTzRBU0lDSUFJYkJIOGp3UUVqdXdFaUFDQUFHd1IvUVFBUXRRRkJBUVVqd2dFanZBRWlBQ0FBR3dSL1FRRVF0UUZCQVFVand3RWp2UUVpQUNBQUd3Ui9RUUlRdFFGQkFRVWp4QUVqdmdFaUFDQUFHd1IvUVFNUXRRRkJBUVVqeFFFanZ3RWlBQ0FBR3dSL1FRUVF0UUZCQVFWQkFBc0xDd3NMQlVFQUN3UkFJNVlDSWdBamx3SWdBQnNFZjBFQUpKY0NRUUFrbGdKQkFDU1lBa0VBSkprQ1FSZ0ZRUlFMSVFFTEk1WUNJZ0FqbHdJZ0FCc0VRRUVBSkpjQ1FRQWtsZ0pCQUNTWUFrRUFKSmtDQ3lBQkR3dEJBQXUrQVFFQ2YwRUJKS01DSTVnQ0JFQWpsQUlRQWtIL0FYRVF0QUVRZ1FGQkFDU1hBa0VBSkpZQ1FRQWttQUpCQUNTWkFnc1F0Z0VpQUVFQVNnUkFJQUFRZ1FFTFFRUWhBQ09XQWlJQkk1Y0NJQUViUlNJQkJIOGptUUpGQlNBQkN3UkFJNVFDRUFKQi93RnhFTFFCSVFBTEk1SUNRZkFCY1NTU0FpQUFRUUJNQkVBZ0FBOExJQUFRZ1FFam53SkJBV29pQVNPZEFrNEVmeU9lQWtFQmFpU2VBaUFCSTUwQ2F3VWdBUXNrbndJamxBSWozZ0ZHQkVCQkFTVGhBUXNnQUFzRkFDTzJBUXZNQVFFRWZ5QUFRWDlCZ0FnZ0FFRUFTQnNnQUVFQVNoc2hBMEVBSVFBRFFBSi9BbjhnQkVVaUFRUkFJQUJGSVFFTElBRUxCRUFnQWtVaEFRc2dBUXNFUUNQaEFVVWhBUXNnQVFSQUVMY0JRUUJJQkVCQkFTRUVCU09WQWtIUXBBUWppZ0owVGdSQVFRRWhBQVVnQTBGL1NpSUJCRUFqdGdFZ0EwNGhBUXRCQVNBQ0lBRWJJUUlMQ3d3QkN3c2dBQVJBSTVVQ1FkQ2tCQ09LQW5SckpKVUNJNkFDRHdzZ0FnUkFJNkVDRHdzajRRRUVRRUVBSk9FQkk2SUNEd3NqbEFKQkFXdEIvLzhEY1NTVUFrRi9Dd2NBUVg4UXVRRUxPUUVEZndOQUlBSWdBRWdpQXdSL0lBRkJBRTRGSUFNTEJFQkJmeEM1QVNFQklBSkJBV29oQWd3QkN3c2dBVUVBU0FSQUlBRVBDMEVBQ3dVQUk1b0NDd1VBSTVzQ0N3VUFJNXdDQzFzQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCUmcwQkFrQWdBRUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2owd0VQQ3lQV0FROExJOVFCRHdzajFRRVBDeVBYQVE4TEk5Z0JEd3NqMlFFUEN5UGFBUThMUVFBTGh3RUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQlJnMEJBa0FnQUVFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQVVFQVJ5VFRBUXdIQ3lBQlFRQkhKTllCREFZTElBRkJBRWNrMUFFTUJRc2dBVUVBUnlUVkFRd0VDeUFCUVFCSEpOY0JEQU1MSUFGQkFFY2syQUVNQWdzZ0FVRUFSeVRaQVF3QkN5QUJRUUJISk5vQkN3dFZBUUYvUVFBa21RSWdBQkMvQVVVRVFFRUJJUUVMSUFCQkFSREFBU0FCQkVCQkFVRUJRUUJCQVVFQUlBQkJBMHdiSWdBajNBRWlBU0FCR3hzZ0FFVWozUUVpQUNBQUd4c0VRRUVCSk1VQlFRUVFQd3NMQ3drQUlBQkJBQkRBQVF1YUFRQWdBRUVBU2dSQVFRQVF3UUVGUVFBUXdnRUxJQUZCQUVvRVFFRUJFTUVCQlVFQkVNSUJDeUFDUVFCS0JFQkJBaERCQVFWQkFoRENBUXNnQTBFQVNnUkFRUU1Rd1FFRlFRTVF3Z0VMSUFSQkFFb0VRRUVFRU1FQkJVRUVFTUlCQ3lBRlFRQktCRUJCQlJEQkFRVkJCUkRDQVFzZ0JrRUFTZ1JBUVFZUXdRRUZRUVlRd2dFTElBZEJBRW9FUUVFSEVNRUJCVUVIRU1JQkN3c0hBQ0FBSk40QkN3Y0FRWDhrM2dFTEJ3QWdBQ1RmQVFzSEFFRi9KTjhCQ3djQUlBQWs0QUVMQndCQmZ5VGdBUXNGQUNPTEFnc0ZBQ09NQWdzRkFDT05BZ3NGQUNPT0Fnc0ZBQ09QQWdzRkFDT1FBZ3NGQUNPUkFnc0ZBQ09TQWdzRkFDT1VBZ3NGQUNPVEFnc0xBQ09VQWhBQ1FmOEJjUXNGQUNQdUFRdXZBd0VLZjBHQWdBSkJnSkFDSStjQkd5RUpRWUM0QWtHQXNBSWo2QUViSVFvRFFDQUZRWUFDU0FSQVFRQWhCQU5BSUFSQmdBSklCRUFnQ1NBRlFRTjFRUVYwSUFwcUlBUkJBM1ZxSWdKQmdKQithaTBBQUJBeUlRY2dCVUVJYnlFQlFRY2dCRUVJYjJzaEJrRUFJUU1DZnlBQVFRQktJNGtDSWdnZ0NCc0VRQ0FDUVlEUWZtb3RBQUFoQXdzZ0EwSEFBSEVMQkVCQkJ5QUJheUVCQzBFQUlRSWdBVUVCZENBSGFpSUhRWUNRZm1wQkFVRUFJQU5CQ0hFYklnSkJEWFJxTFFBQUlRaEJBQ0VCSUFkQmdaQithaUFDUVExMGFpMEFBRUVCSUFaMGNRUkFRUUloQVFzZ0FVRUJhaUFCUVFFZ0JuUWdDSEViSVFFZ0JVRUlkQ0FFYWtFRGJDRUNJQUJCQUVvamlRSWlCaUFHR3dSQUlBSkJnS0VMYWlJQ0lBTkJCM0VnQVVFQUVETWlBVUVmY1VFRGREb0FBQ0FDUVFGcUlBRkI0QWR4UVFWMVFRTjBPZ0FBSUFKQkFtb2dBVUdBK0FGeFFRcDFRUU4wT2dBQUJTQUNRWUNoQzJvaUF5QUJRY2YrQXhBMElnRkJnSUQ4QjNGQkVIVTZBQUFnQTBFQmFpQUJRWUQrQTNGQkNIVTZBQUFnQTBFQ2FpQUJPZ0FBQ3lBRVFRRnFJUVFNQVFzTElBVkJBV29oQlF3QkN3c0wyd01CREg4RFFDQUVRUmRPUlFSQVFRQWhBd05BSUFOQkgwZ0VRRUVCUVFBZ0EwRVBTaUlIR3lFSklBUkJEMnNnQkNBRVFROUtJZ0FiUVFSMElnVWdBMEVQYTJvZ0F5QUZhaUFIR3lFSVFZQ1FBa0dBZ0FJZ0FCc2hDa0hIL2dNaEIwRi9JUVpCZnlFRlFRQWhBUU5BSUFGQkNFZ0VRRUVBSVFBRFFDQUFRUVZJQkVBZ0FFRURkQ0FCYWtFQ2RDSUNRWUw4QTJvUUFpQUlSZ1JBSUFKQmcvd0RhaEFDSVFKQkFVRUFJQUpCQ0hGQkFFY2ppUUlqaVFJYkd5QUpSZ1JBUVFnaEFVRUZJUUFnQWlJRlFSQnhCSDlCeWY0REJVSEkvZ01MSVFjTEN5QUFRUUZxSVFBTUFRc0xJQUZCQVdvaEFRd0JDd3NnQlVFQVNDT0pBaUlBSUFBYkJFQkJnTGdDUVlDd0FpUG9BUnNoQzBGL0lRQkJBQ0VDQTBBZ0FrRWdTQVJBUVFBaEFRTkFJQUZCSUVnRVFDQUJRUVYwSUF0cUlBSnFJZ1pCZ0pCK2FpMEFBQ0FJUmdSQVFTQWhBa0VnSVFFZ0JpRUFDeUFCUVFGcUlRRU1BUXNMSUFKQkFXb2hBZ3dCQ3dzZ0FFRUFUZ1IvSUFCQmdOQithaTBBQUFWQmZ3c2hCZ3RCQUNFQUEwQWdBRUVJU0FSQUlBZ2dDaUFKUVFCQkJ5QUFJQU5CQTNRZ0JFRURkQ0FBYWtINEFVR0FvUmNnQnlBR0lBVVFOUm9nQUVFQmFpRUFEQUVMQ3lBRFFRRnFJUU1NQVFzTElBUkJBV29oQkF3QkN3c0xtZ0lCQ1g4RFFDQUVRUWhPUlFSQVFRQWhBUU5BSUFGQkJVZ0VRQ0FCUVFOMElBUnFRUUowSWdCQmdQd0RhaEFDR2lBQVFZSDhBMm9RQWhvZ0FFR0MvQU5xRUFJaEFrRUJJUVVqNlFFRVFDQUNRUUp2UVFGR0JFQWdBa0VCYXlFQ0MwRUNJUVVMSUFCQmcvd0RhaEFDSVFaQkFDRUhRUUZCQUNBR1FRaHhRUUJISTRrQ0k0a0NHeHNoQjBISS9nTWhDRUhKL2dOQnlQNERJQVpCRUhFYklRaEJBQ0VBQTBBZ0FDQUZTQVJBUVFBaEF3TkFJQU5CQ0VnRVFDQUFJQUpxUVlDQUFpQUhRUUJCQnlBRElBUkJBM1FnQVVFRWRDQURhaUFBUVFOMGFrSEFBRUdBb1NBZ0NFRi9JQVlRTlJvZ0EwRUJhaUVEREFFTEN5QUFRUUZxSVFBTUFRc0xJQUZCQVdvaEFRd0JDd3NnQkVFQmFpRUVEQUVMQ3dzRkFDUEhBUXNGQUNQSUFRc0ZBQ1BMQVFzWUFRRi9JODBCSVFBanpBRUVRQ0FBUVFSeUlRQUxJQUFMTUFFQmZ3TkFBa0FnQUVILy93Tk9EUUFnQUVHQXRja0VhaUFBRUZ3NkFBQWdBRUVCYWlFQURBRUxDMEVBSk9FQkN4WUFFQUEvQUVHVUFVZ0VRRUdVQVQ4QWEwQUFHZ3NMQXdBQkN4MEFBa0FDUUFKQUk2UUNEZ0lCQWdBTEFBdEJBQ0VBQ3lBQUVMa0JDd2NBSUFBa3BBSUxKUUFDUUFKQUFrQUNRQ09rQWc0REFRSURBQXNBQzBFQklRQUxRWDhoQVFzZ0FSQzVBUXNBTXhCemIzVnlZMlZOWVhCd2FXNW5WVkpNSVdOdmNtVXZaR2x6ZEM5amIzSmxMblZ1ZEc5MVkyaGxaQzUzWVhOdExtMWhjQT09Iik6CmF3YWl0IE8oImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZ1FFUVlBQUFZQXAvZjM5L2YzOS9mMzkvQUdBQmZ3Ri9ZQUYvQUdBQ2YzOEFZQUovZndGL1lBQUJmMkFEZjM5L0FHQUdmMzkvZjM5L0FHQUhmMzkvZjM5L2Z3Ri9ZQU4vZjM4QmYyQUhmMzkvZjM5L2Z3QmdCSDkvZjM4QmYyQUlmMzkvZjM5L2YzOEFZQVYvZjM5L2Z3Ri9ZQTEvZjM5L2YzOS9mMzkvZjM5L0FYOEQ1UUhqQVFBQ0FnQUVBQUFEQXdBQUFBQUFBQUFEQUFBREF3QUFBQUFCQmdBQUFBQUFBQUFBQXdNQUFBQUFBQUFBQUFZR0JnWU9CUW9GRHdrTENBZ0hCQU1BQUFNQUFBQUFBQU1BQUFBQUFnSUZBZ0lHQUFJQ0JRd0RBd01BQWdZQ0FnUURBd01EQXdNQUF3QURBQU1BQXdVREJnWURCQUlGQXdBQUF3VUVCd0FGQUFNQUF3TUdCZ1FFQXdRREF3TUVCQWNDQWdJQ0FnSUNBZ0lFQXdNQ0F3TUNBd01DQXdNQ0FnSUNBZ0lDQWdJQ0FnVUNBZ0lDQWdJREJnWUdBZ1lDQmdZR0FnUURBdzBEQUFNQUF3QUdCZ1lHQmdZR0JnWUdCZ1lEQUFBR0JnWUdBQUFBQWdNRkJBUUJjQUFCQlFNQkFBQUd1Z3lsQW44QVFRQUxmd0JCZ0FnTGZ3QkJnQWdMZndCQmdBZ0xmd0JCZ0JBTGZ3QkJnSUFCQzM4QVFZQ1FBUXQvQUVHQWdBSUxmd0JCZ0pBREMzOEFRWUNBQVF0L0FFR0FFQXQvQUVHQWdBUUxmd0JCZ0pBRUMzOEFRWUFCQzM4QVFZQ1JCQXQvQUVHQXVBRUxmd0JCZ01rRkMzOEFRWURZQlF0L0FFR0FvUXNMZndCQmdJQU1DMzhBUVlDaEZ3dC9BRUdBZ0FrTGZ3QkJnS0VnQzM4QVFZRDRBQXQvQUVHQWtBUUxmd0JCZ0lrZEMzOEFRWUNaSVF0L0FFR0FnQWdMZndCQmdKa3BDMzhBUVlDQUNBdC9BRUdBbVRFTGZ3QkJnSUFJQzM4QVFZQ1pPUXQvQUVHQWdBZ0xmd0JCZ0puQkFBdC9BRUdBZ0FnTGZ3QkJnSm5KQUF0L0FFR0FnQWdMZndCQmdKblJBQXQvQUVHQUZBdC9BRUdBcmRFQUMzOEFRWUNJK0FNTGZ3QkJnTFhKQkF0L0FFSC8vd01MZndCQkFBdC9BRUdBdGMwRUMzOEFRWlFCQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkI2UDREQzM4QlFlbitBd3QvQVVIci9nTUxmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJ3QUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVIQUFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUdBQWd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUhBQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVE4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUgvQUF0L0FVSC9BQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJ4TmdDQzM4QlFRQUxmd0ZCQUF0L0FVR0FnQWdMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRi9DMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWRIK0F3dC9BVUhTL2dNTGZ3RkIwLzREQzM4QlFkVCtBd3QvQVVIVi9nTUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRYy8rQXd0L0FVSHcvZ01MZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmdLald1UWNMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFFTGZ3RkJBZ3QvQVVFQUMzOEJRUUFMQjdzUVlRWnRaVzF2Y25rQ0FBVjBZV0pzWlFFQUJtTnZibVpwWndBWkRtaGhjME52Y21WVGRHRnlkR1ZrQUJvSmMyRjJaVk4wWVhSbEFDRUpiRzloWkZOMFlYUmxBQ3dGYVhOSFFrTUFMUkpuWlhSVGRHVndjMUJsY2xOMFpYQlRaWFFBTGd0blpYUlRkR1Z3VTJWMGN3QXZDR2RsZEZOMFpYQnpBREFWWlhobFkzVjBaVTExYkhScGNHeGxSbkpoYldWekFMc0JER1Y0WldOMWRHVkdjbUZ0WlFDNkFRaGZjMlYwWVhKbll3RGhBUmxsZUdWamRYUmxSbkpoYldWQmJtUkRhR1ZqYTBGMVpHbHZBT0FCRldWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJnRGlBUXRsZUdWamRYUmxVM1JsY0FDM0FSUm5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkQUM4QVF4blpYUkRlV05zWlZObGRITUF2UUVKWjJWMFEzbGpiR1Z6QUw0QkRuTmxkRXB2ZVhCaFpGTjBZWFJsQU1NQkgyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWElBdUFFUVkyeGxZWEpCZFdScGIwSjFabVpsY2dBb0hITmxkRTFoYm5WaGJFTnZiRzl5YVhwaGRHbHZibEJoYkdWMGRHVUFCeGRYUVZOTlFrOVpYMDFGVFU5U1dWOU1UME5CVkVsUFRnTXNFMWRCVTAxQ1QxbGZUVVZOVDFKWlgxTkpXa1VETFJKWFFWTk5RazlaWDFkQlUwMWZVRUZIUlZNRExoNUJVMU5GVFVKTVdWTkRVa2xRVkY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQUJwQlUxTkZUVUpNV1ZORFVrbFFWRjlOUlUxUFVsbGZVMGxhUlFNQkZsZEJVMDFDVDFsZlUxUkJWRVZmVEU5RFFWUkpUMDREQWhKWFFWTk5RazlaWDFOVVFWUkZYMU5KV2tVREF5QkhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNS0hFZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURDeEpXU1VSRlQxOVNRVTFmVEU5RFFWUkpUMDREQkE1V1NVUkZUMTlTUVUxZlUwbGFSUU1GRVZkUFVrdGZVa0ZOWDB4UFEwRlVTVTlPQXdZTlYwOVNTMTlTUVUxZlUwbGFSUU1ISms5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3Z2lUMVJJUlZKZlIwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVTBsYVJRTUpHRWRTUVZCSVNVTlRYMDlWVkZCVlZGOU1UME5CVkVsUFRnTVlGRWRTUVZCSVNVTlRYMDlWVkZCVlZGOVRTVnBGQXhrVVIwSkRYMUJCVEVWVVZFVmZURTlEUVZSSlQwNEREQkJIUWtOZlVFRk1SVlJVUlY5VFNWcEZBdzBZUWtkZlVGSkpUMUpKVkZsZlRVRlFYMHhQUTBGVVNVOU9BdzRVUWtkZlVGSkpUMUpKVkZsZlRVRlFYMU5KV2tVRER3NUdVa0ZOUlY5TVQwTkJWRWxQVGdNUUNrWlNRVTFGWDFOSldrVURFUmRDUVVOTFIxSlBWVTVFWDAxQlVGOU1UME5CVkVsUFRnTVNFMEpCUTB0SFVrOVZUa1JmVFVGUVgxTkpXa1VERXhKVVNVeEZYMFJCVkVGZlRFOURRVlJKVDA0REZBNVVTVXhGWDBSQlZFRmZVMGxhUlFNVkVrOUJUVjlVU1V4RlUxOU1UME5CVkVsUFRnTVdEazlCVFY5VVNVeEZVMTlUU1ZwRkF4Y1ZRVlZFU1U5ZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXlJUlFWVkVTVTlmUWxWR1JrVlNYMU5KV2tVREl4bERTRUZPVGtWTVh6RmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4b1ZRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOVRTVnBGQXhzWlEwaEJUazVGVEY4eVgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNY0ZVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlUwbGFSUU1kR1VOSVFVNU9SVXhmTTE5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESGhWRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDFOSldrVURIeGxEU0VGT1RrVk1YelJmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeUFWUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlUU1ZwRkF5RVdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNa0VrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTWxFVUpQVDFSZlVrOU5YMHhQUTBGVVNVOU9BeVlOUWs5UFZGOVNUMDFmVTBsYVJRTW5Ga05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0REtCSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURLUjFFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNcUdVUkZRbFZIWDBkQlRVVkNUMWxmVFVWTlQxSlpYMU5KV2tVREt5Rm5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRQUFSdHpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUF4QUVkY21WelpYUlFjbTluY21GdFEyOTFiblJsY2tKeVpXRnJjRzlwYm5RQXhRRVpjMlYwVW1WaFpFZGlUV1Z0YjNKNVFuSmxZV3R3YjJsdWRBREdBUnR5WlhObGRGSmxZV1JIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBeHdFYWMyVjBWM0pwZEdWSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQXlBRWNjbVZ6WlhSWGNtbDBaVWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURKQVF4blpYUlNaV2RwYzNSbGNrRUF5Z0VNWjJWMFVtVm5hWE4wWlhKQ0FNc0JER2RsZEZKbFoybHpkR1Z5UXdETUFReG5aWFJTWldkcGMzUmxja1FBelFFTVoyVjBVbVZuYVhOMFpYSkZBTTRCREdkbGRGSmxaMmx6ZEdWeVNBRFBBUXhuWlhSU1pXZHBjM1JsY2t3QTBBRU1aMlYwVW1WbmFYTjBaWEpHQU5FQkVXZGxkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFOSUJEMmRsZEZOMFlXTnJVRzlwYm5SbGNnRFRBUmxuWlhSUGNHTnZaR1ZCZEZCeWIyZHlZVzFEYjNWdWRHVnlBTlFCQldkbGRFeFpBTlVCSFdSeVlYZENZV05yWjNKdmRXNWtUV0Z3Vkc5WFlYTnRUV1Z0YjNKNUFOWUJHR1J5WVhkVWFXeGxSR0YwWVZSdlYyRnpiVTFsYlc5eWVRRFhBUk5rY21GM1QyRnRWRzlYWVhOdFRXVnRiM0o1QU5nQkJtZGxkRVJKVmdEWkFRZG5aWFJVU1UxQkFOb0JCbWRsZEZSTlFRRGJBUVpuWlhSVVFVTUEzQUVUZFhCa1lYUmxSR1ZpZFdkSFFrMWxiVzl5ZVFEZEFRZ0MzZ0VKQ0FFQVFRQUxBZDhCQ3ZuekFlTUJVd0JCOHVYTEJ5UTVRYURCZ2dVa09rSFlzT0VDSkR0QmlKQWdKRHhCOHVYTEJ5UTlRYURCZ2dVa1BrSFlzT0VDSkQ5QmlKQWdKRUJCOHVYTEJ5UkJRYURCZ2dVa1FrSFlzT0VDSkVOQmlKQWdKRVFMcGdJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJESFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPREFJQ0F3TURBd1FFQlFVR0J3QUxEQWNMSTRnQ0JFQWppUUlFUUNBQVFZQUNTQTBKSUFCQi93TktJZ0VFZnlBQVFZQVNTQVVnQVFzTkNRVWppUUpGSWdFRWZ5QUFRWUFDU0FVZ0FRc05DUXNMQ3lBQVFZQ3QwUUJxRHdzZ0FFRUJJL01CSWdFait3RkZJZ0FFZnlBQlJRVWdBQXNiUVE1MGFrR0FyZEFBYWc4TElBQkJnSkIrYWlPSkFnUi9JNFlDRUFKQkFYRUZRUUFMUVExMGFnOExJQUFqOUFGQkRYUnFRWURaeGdCcUR3c2dBRUdBa0g1cUR3dEJBQ0VCQW44amlRSUVRQ09IQWhBQ1FRZHhJUUVMSUFGQkFVZ0xCSDlCQVFVZ0FRdEJESFFnQUdwQmdQQjlhZzhMSUFCQmdGQnFEd3NnQUVHQW1kRUFhZ3NKQUNBQUVBRXRBQUFMd3dFQVFRQWtpZ0pCQUNTTEFrRUFKSXdDUVFBa2pRSkJBQ1NPQWtFQUpJOENRUUFra0FKQkFDU1JBa0VBSkpJQ1FRQWtrd0pCQUNTVUFrRUFKSlVDUVFBa2xnSkJBQ1NYQWtFQUpKZ0NRUUFrbVFJamlBSUVRQThMSTRrQ0JFQkJFU1NMQWtHQUFTU1NBa0VBSkl3Q1FRQWtqUUpCL3dFa2pnSkIxZ0FrandKQkFDU1FBa0VOSkpFQ0JVRUJKSXNDUWJBQkpKSUNRUUFrakFKQkV5U05Ba0VBSkk0Q1FkZ0JKSThDUVFFa2tBSkJ6UUFra1FJTFFZQUNKSlFDUWY3L0F5U1RBZ3NMQUNBQUVBRWdBVG9BQUF1SkFRRUNmMEVBSlBVQlFRRWs5Z0ZCeHdJUUFpSUJSU1QzQVNBQlFRRk9JZ0FFUUNBQlFRTk1JUUFMSUFBaytBRWdBVUVGVGlJQUJFQWdBVUVHVENFQUN5QUFKUGtCSUFGQkQwNGlBQVJBSUFGQkUwd2hBQXNnQUNUNkFTQUJRUmxPSWdBRVFDQUJRUjVNSVFBTElBQWsrd0ZCQVNUekFVRUFKUFFCSTRZQ1FRQVFCQ09IQWtFQkVBUUxMd0JCMGY0RFFmOEJFQVJCMHY0RFFmOEJFQVJCMC80RFFmOEJFQVJCMVA0RFFmOEJFQVJCMWY0RFFmOEJFQVFMc0FnQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0N3TUVCUVlIQ0FrS0N3d05BQXNNRFF0Qjh1WExCeVE1UWFEQmdnVWtPa0hZc09FQ0pEdEJpSkFnSkR4Qjh1WExCeVE5UWFEQmdnVWtQa0hZc09FQ0pEOUJpSkFnSkVCQjh1WExCeVJCUWFEQmdnVWtRa0hZc09FQ0pFTkJpSkFnSkVRTURBdEIvLy8vQnlRNVFlUGEvZ2NrT2tHQTRwQUVKRHRCQUNROFFmLy8vd2NrUFVIajJ2NEhKRDVCZ09LUUJDUS9RUUFrUUVILy8vOEhKRUZCNDlyK0J5UkNRWURpa0FRa1EwRUFKRVFNQ3d0Qi8vLy9CeVE1UVlTSi9nY2tPa0c2OU5BRUpEdEJBQ1E4UWYvLy93Y2tQVUd4L3U4REpENUJnSWdDSkQ5QkFDUkFRZi8vL3dja1FVSC95NDRESkVKQi93RWtRMEVBSkVRTUNndEJ4YzMvQnlRNVFZUzV1Z1lrT2tHcDFwRUVKRHRCaU9Mb0FpUThRZi8vL3dja1BVSGoydjRISkQ1QmdPS1FCQ1EvUVFBa1FFSC8vLzhISkVGQjQ5citCeVJDUVlEaWtBUWtRMEVBSkVRTUNRdEIvLy8vQnlRNVFZRCt5d0lrT2tHQWhQMEhKRHRCQUNROFFmLy8vd2NrUFVHQS9zc0NKRDVCZ0lUOUJ5US9RUUFrUUVILy8vOEhKRUZCZ1A3TEFpUkNRWUNFL1Fja1EwRUFKRVFNQ0F0Qi8vLy9CeVE1UWJIKzd3TWtPa0hGeHdFa08wRUFKRHhCLy8vL0J5UTlRWVNKL2dja1BrRzY5TkFFSkQ5QkFDUkFRZi8vL3dja1FVR0VpZjRISkVKQnV2VFFCQ1JEUVFBa1JBd0hDMEVBSkRsQmhJa0NKRHBCZ0x6L0J5UTdRZi8vL3dja1BFRUFKRDFCaElrQ0pENUJnTHovQnlRL1FmLy8vd2NrUUVFQUpFRkJoSWtDSkVKQmdMei9CeVJEUWYvLy93Y2tSQXdHQzBHbC8vOEhKRGxCbEtuK0J5UTZRZitwMGdRa08wRUFKRHhCcGYvL0J5UTlRWlNwL2dja1BrSC9xZElFSkQ5QkFDUkFRYVgvL3dja1FVR1VxZjRISkVKQi82blNCQ1JEUVFBa1JBd0ZDMEgvLy84SEpEbEJnUDcvQnlRNlFZQ0EvQWNrTzBFQUpEeEIvLy8vQnlROVFZRCsvd2NrUGtHQWdQd0hKRDlCQUNSQVFmLy8vd2NrUVVHQS92OEhKRUpCZ0lEOEJ5UkRRUUFrUkF3RUMwSC8vLzhISkRsQmdQNy9CeVE2UVlDVTdRTWtPMEVBSkR4Qi8vLy9CeVE5UWYvTGpnTWtQa0gvQVNRL1FRQWtRRUgvLy84SEpFRkJzZjd2QXlSQ1FZQ0lBaVJEUVFBa1JBd0RDMEgvLy84SEpEbEIvOHVPQXlRNlFmOEJKRHRCQUNROFFmLy8vd2NrUFVHRWlmNEhKRDVCdXZUUUJDUS9RUUFrUUVILy8vOEhKRUZCc2Y3dkF5UkNRWUNJQWlSRFFRQWtSQXdDQzBILy8vOEhKRGxCM3BteUJDUTZRWXlseVFJa08wRUFKRHhCLy8vL0J5UTlRWVNKL2dja1BrRzY5TkFFSkQ5QkFDUkFRZi8vL3dja1FVSGoydjRISkVKQmdPS1FCQ1JEUVFBa1JBd0JDMEgvLy84SEpEbEJwY3VXQlNRNlFkS2t5UUlrTzBFQUpEeEIvLy8vQnlROVFhWExsZ1VrUGtIU3BNa0NKRDlCQUNSQVFmLy8vd2NrUVVHbHk1WUZKRUpCMHFUSkFpUkRRUUFrUkFzTDJnZ0FBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJpQUZIQkVBZ0FFSGhBRVlOQVNBQVFSUkdEUUlnQUVIR0FFWU5BeUFBUWRrQVJnMEVJQUJCeGdGR0RRUWdBRUdHQVVZTkJTQUFRYWdCUmcwRklBQkJ2d0ZHRFFZZ0FFSE9BVVlOQmlBQVFkRUJSZzBHSUFCQjhBRkdEUVlnQUVFblJnMEhJQUJCeVFCR0RRY2dBRUhjQUVZTkJ5QUFRYk1CUmcwSElBQkJ5UUZHRFFnZ0FFSHdBRVlOQ1NBQVFjWUFSZzBLSUFCQjB3RkdEUXNNREF0Qi83bVdCU1E1UVlEKy93Y2tPa0dBeGdFa08wRUFKRHhCLzdtV0JTUTlRWUQrL3dja1BrR0F4Z0VrUDBFQUpFQkIvN21XQlNSQlFZRCsvd2NrUWtHQXhnRWtRMEVBSkVRTUN3dEIvLy8vQnlRNVFmL0xqZ01rT2tIL0FTUTdRUUFrUEVILy8vOEhKRDFCaEluK0J5UStRYnIwMEFRa1AwRUFKRUJCLy8vL0J5UkJRZi9MamdNa1FrSC9BU1JEUVFBa1JBd0tDMEgvLy84SEpEbEJoSW4rQnlRNlFicjAwQVFrTzBFQUpEeEIvLy8vQnlROVFiSCs3d01rUGtHQWlBSWtQMEVBSkVCQi8vLy9CeVJCUVlTSi9nY2tRa0c2OU5BRUpFTkJBQ1JFREFrTFFmL3IxZ1VrT1VHVS8vOEhKRHBCd3JTMUJTUTdRUUFrUEVFQUpEMUIvLy8vQnlRK1FZU0ovZ2NrUDBHNjlOQUVKRUJCQUNSQlFmLy8vd2NrUWtHRWlmNEhKRU5CdXZUUUJDUkVEQWdMUWYvLy93Y2tPVUdFMjdZRkpEcEIrK2FKQWlRN1FRQWtQRUgvLy84SEpEMUJnT2I5QnlRK1FZQ0UwUVFrUDBFQUpFQkIvLy8vQnlSQlFmLzc2Z0lrUWtHQWdQd0hKRU5CL3dFa1JBd0hDMEdjLy84SEpEbEIvK3ZTQkNRNlFmT29qZ01rTzBHNjlBQWtQRUhDaXY4SEpEMUJnS3ovQnlRK1FZRDAwQVFrUDBHQWdLZ0NKRUJCLy8vL0J5UkJRWVNKL2dja1FrRzY5TkFFSkVOQkFDUkVEQVlMUVlEK3J3TWtPVUgvLy84SEpEcEJ5cVQ5QnlRN1FRQWtQRUgvLy84SEpEMUIvLy8vQnlRK1FmL0xqZ01rUDBIL0FTUkFRZi8vL3dja1FVSGoydjRISkVKQmdPS1FCQ1JEUVFBa1JBd0ZDMEgvdVpZRkpEbEJnUDcvQnlRNlFZREdBU1E3UVFBa1BFSFN4djBISkQxQmdJRFlCaVErUVlDQWpBTWtQMEVBSkVCQi93RWtRVUgvLy84SEpFSkIrLzcvQnlSRFFmK0pBaVJFREFRTFFjNy8vd2NrT1VIdjM0OERKRHBCc1lqeUJDUTdRZHEwNlFJa1BFSC8vLzhISkQxQmdPYjlCeVErUVlDRTBRUWtQMEVBSkVCQi8vLy9CeVJCUWYvTGpnTWtRa0gvQVNSRFFRQWtSQXdEQzBILy8vOEhKRGxCaEluK0J5UTZRYnIwMEFRa08wRUFKRHhCLy8vL0J5UTlRWUQrQXlRK1FZQ0l4Z0VrUDBHQWxBRWtRRUgvLy84SEpFRkIvOHVPQXlSQ1FmOEJKRU5CQUNSRURBSUxRZi8vL3dja09VSC95NDRESkRwQi93RWtPMEVBSkR4QmdQNy9CeVE5UVlDQS9BY2tQa0dBZ0l3REpEOUJBQ1JBUWYvLy93Y2tRVUd4L3U4REpFSkJnSWdDSkVOQkFDUkVEQUVMUWYvLy93Y2tPVUdFMjdZRkpEcEIrK2FKQWlRN1FRQWtQRUgvLy84SEpEMUI0OXIrQnlRK1FlUGEvZ2NrUDBFQUpFQkIvLy8vQnlSQlFmL0xqZ01rUWtIL0FTUkRRUUFrUkFzTFNnRUNmMEVBRUFjamlRSUVRQThMSTRnQ0JFQWppUUpGQkVBUEN3dEJ0QUloQUFOQUFrQWdBRUhEQWtvTkFDQUFFQUlnQVdvaEFTQUFRUUZxSVFBTUFRc0xJQUZCL3dGeEVBZ0wzQUVBUVFBazdBRkJBQ1R0QVVFQUpPNEJRUUFrN3dGQkFDVHdBVUVBSlBFQlFRQWs4Z0ZCa0FFazdnRWppUUlFUUVIQi9nTkJnUUVRQkVIRS9nTkJrQUVRQkVISC9nTkIvQUVRQkFWQndmNERRWVVCRUFSQnh2NERRZjhCRUFSQngvNERRZndCRUFSQnlQNERRZjhCRUFSQnlmNERRZjhCRUFRTFFaQUJKTzRCUWNEK0EwR1FBUkFFUWMvK0EwRUFFQVJCOFA0RFFRRVFCQ09JQWdSQUk0a0NCRUJCQUNUdUFVSEEvZ05CQUJBRVFjSCtBMEdBQVJBRVFjVCtBMEVBRUFRRlFRQWs3Z0ZCd1A0RFFRQVFCRUhCL2dOQmhBRVFCQXNMRUFrTGJnQWppUUlFUUVIby9nTkJ3QUVRQkVIcC9nTkIvd0VRQkVIcS9nTkJ3UUVRQkVIci9nTkJEUkFFQlVIby9nTkIvd0VRQkVIcC9nTkIvd0VRQkVIcS9nTkIvd0VRQkVIci9nTkIvd0VRQkFzamlRSWppQUlqaUFJYkJFQkI2ZjREUVNBUUJFSHIvZ05CaWdFUUJBc0xWZ0JCa1A0RFFZQUJFQVJCa2Y0RFFiOEJFQVJCa3Y0RFFmTUJFQVJCay80RFFjRUJFQVJCbFA0RFFiOEJFQVFqaUFJRVFFR1IvZ05CUHhBRVFaTCtBMEVBRUFSQmsvNERRUUFRQkVHVS9nTkJ1QUVRQkFzTExBQkJsZjREUWY4QkVBUkJsdjREUVQ4UUJFR1gvZ05CQUJBRVFaaitBMEVBRUFSQm1mNERRYmdCRUFRTE13QkJtdjREUWY4QUVBUkJtLzREUWY4QkVBUkJuUDREUVo4QkVBUkJuZjREUVFBUUJFR2UvZ05CdUFFUUJFRUJKSVVCQ3kwQVFaLytBMEgvQVJBRVFhRCtBMEgvQVJBRVFhSCtBMEVBRUFSQm92NERRUUFRQkVHai9nTkJ2d0VRQkF0Y0FDQUFRWUFCY1VFQVJ5U3NBU0FBUWNBQWNVRUFSeVNyQVNBQVFTQnhRUUJISktvQklBQkJFSEZCQUVja3FRRWdBRUVJY1VFQVJ5U3dBU0FBUVFSeFFRQkhKSzhCSUFCQkFuRkJBRWNrcmdFZ0FFRUJjVUVBUnlTdEFRdEZBRUVQSkprQlFROGttZ0ZCRHlTYkFVRVBKSndCUVFBa25RRkJBQ1NlQVVFQUpKOEJRUUFrb0FGQi93QWtvUUZCL3dBa29nRkJBU1NqQVVFQkpLUUJRUUFrcFFFTHZRRUFRUUFrcGdGQkFDU25BVUVBSktnQlFRRWtxUUZCQVNTcUFVRUJKS3NCUVFFa3JBRkJBU1N0QVVFQkpLNEJRUUVrcndGQkFTU3dBVUVCSkxFQlFRQWtzZ0ZCQUNTekFVRUFKTFVCUVFBa3RnRVFEQkFORUE0UUQwR2svZ05COXdBUUJFRUhKS2NCUVFja3FBRkJwZjREUWZNQkVBUkI4d0VRRUVHbS9nTkI4UUVRQkVFQkpMRUJJNGdDQkVCQnBQNERRUUFRQkVFQUpLY0JRUUFrcUFGQnBmNERRUUFRQkVFQUVCQkJwdjREUWZBQUVBUkJBQ1N4QVFzUUVRcytBQ0FBUVFGeFFRQkhKTHNCSUFCQkFuRkJBRWNrdkFFZ0FFRUVjVUVBUnlTOUFTQUFRUWh4UVFCSEpMNEJJQUJCRUhGQkFFY2t2d0VnQUNTNkFRcytBQ0FBUVFGeFFRQkhKTUVCSUFCQkFuRkJBRWNrd2dFZ0FFRUVjVUVBUnlUREFTQUFRUWh4UVFCSEpNUUJJQUJCRUhGQkFFY2t4UUVnQUNUQUFRdDRBRUVBSk1ZQlFRQWt4d0ZCQUNUSUFVRUFKTXNCUVFBa3pBRkJBQ1ROQVVFQUpNa0JRUUFreWdFamlRSUVRRUdFL2dOQkhoQUVRYUE5Sk1jQkJVR0UvZ05CcXdFUUJFSE0xd0lreHdFTFFZZitBMEg0QVJBRVFmZ0JKTTBCSTRnQ0JFQWppUUpGQkVCQmhQNERRUUFRQkVFRUpNY0JDd3NMUXdCQkFDVE9BVUVBSk04Qkk0a0NCRUJCZ3Y0RFFmd0FFQVJCQUNUUUFVRUFKTkVCUVFBazBnRUZRWUwrQTBIK0FCQUVRUUFrMEFGQkFTVFJBVUVBSk5JQkN3dDFBQ09KQWdSQVFmRCtBMEg0QVJBRVFjLytBMEgrQVJBRVFjMytBMEgrQUJBRVFZRCtBMEhQQVJBRVFZLytBMEhoQVJBRVFleitBMEgrQVJBRVFmWCtBMEdQQVJBRUJVSHcvZ05CL3dFUUJFSFAvZ05CL3dFUUJFSE4vZ05CL3dFUUJFR0EvZ05CendFUUJFR1AvZ05CNFFFUUJBc0xtZ0VCQW45Qnd3SVFBaUlCUWNBQlJpSUFCSDhnQUFVZ0FVR0FBVVlqTUNJQUlBQWJDd1JBUVFFa2lRSUZRUUFraVFJTFFRQWtvd0pCZ0tqV3VRY2ttZ0pCQUNTYkFrRUFKSndDUVlDbzFya0hKSjBDUVFBa25nSkJBQ1NmQWlNdkJFQkJBU1NJQWdWQkFDU0lBZ3NRQXhBRkVBWVFDaEFMRUJKQkFCQVRRZi8vQXlPNkFSQUVRZUVCRUJSQmovNERJOEFCRUFRUUZSQVdFQmNMU2dBZ0FFRUFTaVF2SUFGQkFFb2tNQ0FDUVFCS0pERWdBMEVBU2lReUlBUkJBRW9rTXlBRlFRQktKRFFnQmtFQVNpUTFJQWRCQUVva05pQUlRUUJLSkRjZ0NVRUFTaVE0RUJnTEJRQWpvd0lMdVFFQVFZQUlJNHNDT2dBQVFZRUlJNHdDT2dBQVFZSUlJNDBDT2dBQVFZTUlJNDRDT2dBQVFZUUlJNDhDT2dBQVFZVUlJNUFDT2dBQVFZWUlJNUVDT2dBQVFZY0lJNUlDT2dBQVFZZ0lJNU1DT3dFQVFZb0lJNVFDT3dFQVFZd0lJNVVDTmdJQVFaRUlJNVlDUVFCSE9nQUFRWklJSTVjQ1FRQkhPZ0FBUVpNSUk1Z0NRUUJIT2dBQVFaUUlJNWtDUVFCSE9nQUFRWlVJSTRnQ1FRQkhPZ0FBUVpZSUk0a0NRUUJIT2dBQVFaY0lJNG9DUVFCSE9nQUFDMmdBUWNnSkkvTUJPd0VBUWNvSkkvUUJPd0VBUWN3SkkvVUJRUUJIT2dBQVFjMEpJL1lCUVFCSE9nQUFRYzRKSS9jQlFRQkhPZ0FBUWM4SkkvZ0JRUUJIT2dBQVFkQUpJL2tCUVFCSE9nQUFRZEVKSS9vQlFRQkhPZ0FBUWRJSkkvc0JRUUJIT2dBQUN6VUFRZm9KSThZQk5nSUFRZjRKSThjQk5nSUFRWUlLSThrQlFRQkhPZ0FBUVlVS0k4b0JRUUJIT2dBQVFZWCtBeVBJQVJBRUMxZ0FRZDRLSTFkQkFFYzZBQUJCM3dvaldqWUNBRUhqQ2lOYk5nSUFRZWNLSTF3MkFnQkI3QW9qWFRZQ0FFSHhDaU5lT2dBQVFmSUtJMTg2QUFCQjl3b2pZRUVBUnpvQUFFSDRDaU5oTmdJQVFmMEtJMkk3QVFBTFBRQkJrQXNqYmtFQVJ6b0FBRUdSQ3lOeE5nSUFRWlVMSTNJMkFnQkJtUXNqY3pZQ0FFR2VDeU4wTmdJQVFhTUxJM1U2QUFCQnBBc2pkam9BQUFzN0FFSDBDeU9SQVVFQVJ6b0FBRUgxQ3lPVEFUWUNBRUg1Q3lPVUFUWUNBRUg5Q3lPVkFUWUNBRUdDRENPV0FUWUNBRUdIRENPWUFUc0JBQXVIQVFBUUcwR3lDQ1B0QVRZQ0FFRzJDQ1BpQVRvQUFFSEUvZ01qN2dFUUJFSGtDQ080QVVFQVJ6b0FBRUhsQ0NPNUFVRUFSem9BQUJBY0VCMUJyQW9qc2dFMkFnQkJzQW9qc3dFNkFBQkJzUW9qdFFFNkFBQVFIaEFmUWNJTEkzNUJBRWM2QUFCQnd3c2pnUUUyQWdCQnh3c2pnZ0UyQWdCQnl3c2pnd0U3QVFBUUlFRUFKS01DQzdrQkFFR0FDQzBBQUNTTEFrR0JDQzBBQUNTTUFrR0NDQzBBQUNTTkFrR0RDQzBBQUNTT0FrR0VDQzBBQUNTUEFrR0ZDQzBBQUNTUUFrR0dDQzBBQUNTUkFrR0hDQzBBQUNTU0FrR0lDQzhCQUNTVEFrR0tDQzhCQUNTVUFrR01DQ2dDQUNTVkFrR1JDQzBBQUVFQVNpU1dBa0dTQ0MwQUFFRUFTaVNYQWtHVENDMEFBRUVBU2lTWUFrR1VDQzBBQUVFQVNpU1pBa0dWQ0MwQUFFRUFTaVNJQWtHV0NDMEFBRUVBU2lTSkFrR1hDQzBBQUVFQVNpU0tBZ3RlQVFGL1FRQWs3UUZCQUNUdUFVSEUvZ05CQUJBRVFjSCtBeEFDUVh4eElRRkJBQ1RpQVVIQi9nTWdBUkFFSUFBRVFBSkFRUUFoQUFOQUlBQkJnTmdGVGcwQklBQkJnTWtGYWtIL0FUb0FBQ0FBUVFGcUlRQU1BQUFMQUFzTEM0Z0JBUUYvSStRQklRRWdBRUdBQVhGQkFFY2s1QUVnQUVIQUFIRkJBRWNrNVFFZ0FFRWdjVUVBUnlUbUFTQUFRUkJ4UVFCSEpPY0JJQUJCQ0hGQkFFY2s2QUVnQUVFRWNVRUFSeVRwQVNBQVFRSnhRUUJISk9vQklBQkJBWEZCQUVjazZ3RWo1QUZGSUFFZ0FSc0VRRUVCRUNNTElBRkZJZ0FFZnlQa0FRVWdBQXNFUUVFQUVDTUxDeW9BUWVRSUxRQUFRUUJLSkxnQlFlVUlMUUFBUVFCS0pMa0JRZi8vQXhBQ0VCTkJqLzRERUFJUUZBdG9BRUhJQ1M4QkFDVHpBVUhLQ1M4QkFDVDBBVUhNQ1MwQUFFRUFTaVQxQVVITkNTMEFBRUVBU2lUMkFVSE9DUzBBQUVFQVNpVDNBVUhQQ1MwQUFFRUFTaVQ0QVVIUUNTMEFBRUVBU2lUNUFVSFJDUzBBQUVFQVNpVDZBVUhTQ1MwQUFFRUFTaVQ3QVF0SEFFSDZDU2dDQUNUR0FVSCtDU2dDQUNUSEFVR0NDaTBBQUVFQVNpVEpBVUdGQ2kwQUFFRUFTaVRLQVVHRi9nTVFBaVRJQVVHRy9nTVFBaVRMQVVHSC9nTVFBaVROQVFzSEFFRUFKTFlCQzFnQVFkNEtJMWRCQUVjNkFBQkIzd29vQWdBa1drSGpDaWdDQUNSYlFlY0tLQUlBSkZ4QjdBb29BZ0FrWFVIeENpMEFBQ1JlUWZJS0xRQUFKRjlCOXdvdEFBQkJBRW9rWUVINENpZ0NBQ1JoUWYwS0x3RUFKR0lMUFFCQmtBc3RBQUJCQUVva2JrR1JDeWdDQUNSeFFaVUxLQUlBSkhKQm1Rc29BZ0FrYzBHZUN5Z0NBQ1IwUWFNTExRQUFKSFZCcEFzdEFBQWtkZ3M3QUVIMEN5MEFBRUVBU2lTUkFVSDFDeWdDQUNTVEFVSDVDeWdDQUNTVUFVSDlDeWdDQUNTVkFVR0NEQ2dDQUNTV0FVR0hEQzhCQUNTWUFRdk1BUUVCZnhBaVFiSUlLQUlBSk8wQlFiWUlMUUFBSk9JQlFjVCtBeEFDSk80QlFjRCtBeEFDRUNRUUpVR0EvZ01RQWtIL0FYTWsyd0VqMndFaUFFRVFjVUVBUnlUY0FTQUFRU0J4UVFCSEpOMEJFQ1lRSjBHc0NpZ0NBQ1N5QVVHd0NpMEFBQ1N6QVVHeENpMEFBQ1MxQVVFQUpMWUJFQ2tRS2tIQ0N5MEFBRUVBU2lSK1FjTUxLQUlBSklFQlFjY0xLQUlBSklJQlFjc0xMd0VBSklNQkVDdEJBQ1NqQWtHQXFOYTVCeVNhQWtFQUpKc0NRUUFrbkFKQmdLald1UWNrblFKQkFDU2VBa0VBSko4Q0N3VUFJNGtDQ3dVQUk1MENDd1VBSTU0Q0N3VUFJNThDQzhjQ0FRWi9JMGtoQmdKL0FuOGdBVUVBU2lJRkJFQWdBRUVJU2lFRkN5QUZDd1JBSTBnZ0JFWWhCUXNnQlFzRWZ5QUFJQVpHQlNBRkN3UkFJQU5CQVdzUUFrRWdjVUVBUnlFSUlBTVFBa0VnY1VFQVJ5RUpRUUFoQlFOQUlBVkJDRWdFUUVFSElBVnJJQVVnQ0NBSlJ4c2lCU0FBYWlJRFFhQUJUQVJBSUFGQm9BRnNJQU5xUVFOc1FZREpCV29pQkMwQUFDRUtJQVFnQ2pvQUFDQUJRYUFCYkNBRGFrRURiRUdCeVFWcUlBUXRBQUU2QUFBZ0FVR2dBV3dnQTJwQkEyeEJnc2tGYWlBRUxRQUNPZ0FBSUFGQm9BRnNJQU5xUVlDUkJHb2dBRUVBSUFWcmF5QUJRYUFCYkdwQitKQUVhaTBBQUNJRFFRTnhJZ1JCQkhJZ0JDQURRUVJ4R3pvQUFDQUhRUUZxSVFjTElBVkJBV29oQlF3QkN3c0ZJQVFrU0FzZ0FDQUdUZ1JBSUFCQkNHb2lBU0FDUVFkeElnSnFJQUVnQUNBQ1NCc2hCZ3NnQmlSSklBY0xLUUFnQUVHQWtBSkdCRUFnQVVHQUFXc2dBVUdBQVdvZ0FVR0FBWEViSVFFTElBRkJCSFFnQUdvTFNnQWdBRUVEZENBQlFRRjBhaUlBUVFGcVFUOXhJZ0ZCUUdzZ0FTQUNHMEdBa0FScUxRQUFJUUVnQUVFL2NTSUFRVUJySUFBZ0FodEJnSkFFYWkwQUFDQUJRZjhCY1VFSWRISUx5QUVBSUFFUUFpQUFRUUYwZFVFRGNTRUFJQUZCeVA0RFJnUkFJejBoQVFKQUlBQkZEUUFDUUFKQUFrQUNRQ0FBUVFGckRnTUJBZ01BQ3d3REN5TStJUUVNQWdzalB5RUJEQUVMSTBBaEFRc0ZJQUZCeWY0RFJnUkFJMEVoQVFKQUlBQkZEUUFDUUFKQUFrQUNRQ0FBUVFGckRnTUJBZ01BQ3d3REN5TkNJUUVNQWdzalF5RUJEQUVMSTBRaEFRc0ZJemtoQVFKQUlBQkZEUUFDUUFKQUFrQUNRQ0FBUVFGckRnTUJBZ01BQ3d3REN5TTZJUUVNQWdzak95RUJEQUVMSXp3aEFRc0xDeUFCQzVvREFRWi9JQUVnQUJBeUlBVkJBWFJxSWdCQmdKQithaUFDUVFGeFFRMTBJZ0ZxTFFBQUlSRWdBRUdCa0g1cUlBRnFMUUFBSVJJZ0F5RUFBMEFnQUNBRVRBUkFJQUFnQTJzZ0Jtb2lEaUFJU0FSQVFRQWhCUUovUVFGQkJ5QUFheUFBSUF0QkFFZ2lBUVIvSUFFRklBdEJJSEZGQ3hzaUFYUWdFbkVFUUVFQ0lRVUxJQVZCQVdvTElBVkJBU0FCZENBUmNSc2hBaU9KQWdSL0lBdEJBRTRpQVFSL0lBRUZJQXhCQUU0TEJTT0pBZ3NFZnlBTFFRZHhJUUVnREVFQVRpSUZCRUFnREVFSGNTRUJDeUFCSUFJZ0JSQXpJZ1ZCSDNGQkEzUWhBU0FGUWVBSGNVRUZkVUVEZENFUElBVkJnUGdCY1VFS2RVRURkQVVnQWtISC9nTWdDaUFLUVFCTUd5SUtFRFFpQlVHQWdQd0hjVUVRZFNFQklBVkJnUDREY1VFSWRTRVBJQVZCL3dGeEN5RUZJQWNnQ0d3Z0RtcEJBMndnQ1dvaUVDQUJPZ0FBSUJCQkFXb2dEem9BQUNBUVFRSnFJQVU2QUFBZ0IwR2dBV3dnRG1wQmdKRUVhaUFDUVFOeElnRkJCSElnQVNBTFFZQUJjVUVBUjBFQUlBdEJBRTRiR3pvQUFDQU5RUUZxSVEwTElBQkJBV29oQUF3QkN3c2dEUXQrQVFOL0lBTkJCM0VoQTBFQUlBSWdBa0VEZFVFRGRHc2dBQnNoQjBHZ0FTQUFhMEVISUFCQkNHcEJvQUZLR3lFSVFYOGhBaU9KQWdSQUlBUkJnTkIrYWkwQUFDSUNRUWh4UVFCSElRa2dBa0hBQUhFRVFFRUhJQU5ySVFNTEN5QUdJQVVnQ1NBSElBZ2dBeUFBSUFGQm9BRkJnTWtGUVFBZ0FrRi9FRFVMb1FJQkFYOGdBMEVIY1NFRElBVWdCaEF5SUFSQmdOQithaTBBQUNJRVFjQUFjUVIvUVFjZ0Eyc0ZJQU1MUVFGMGFpSUZRWUNRZm1vZ0JFRUljVUVBUnlJR1FRMTBhaTBBQUNFSElBSkJCM0VoQTBFQUlRSWdBVUdnQVd3Z0FHcEJBMnhCZ01rRmFpQUVRUWR4QW44Z0JVR0JrSDVxSUFaQkFYRkJEWFJxTFFBQVFRRWdBMEVISUFOcklBUkJJSEViSWdOMGNRUkFRUUloQWdzZ0FrRUJhZ3NnQWtFQklBTjBJQWR4R3lJRFFRQVFNeUlDUVI5eFFRTjBPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZSEpCV29nQWtIZ0IzRkJCWFZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNRWUQ0QVhGQkNuVkJBM1E2QUFBZ0FVR2dBV3dnQUdwQmdKRUVhaUFEUVFOeElnQkJCSElnQUNBRVFZQUJjUnM2QUFBTHhBRUFJQVFnQlJBeUlBTkJCM0ZCQVhScUlnUkJnSkIrYWkwQUFDRUZRUUFoQXlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxQW44Z0JFR0JrSDVxTFFBQVFRRkJCeUFDUVFkeGF5SUNkSEVFUUVFQ0lRTUxJQU5CQVdvTElBTkJBU0FDZENBRmNSc2lBMEhIL2dNUU5DSUNRWUNBL0FkeFFSQjFPZ0FBSUFGQm9BRnNJQUJxUVFOc1FZSEpCV29nQWtHQS9nTnhRUWgxT2dBQUlBRkJvQUZzSUFCcVFRTnNRWUxKQldvZ0Fqb0FBQ0FCUWFBQmJDQUFha0dBa1FScUlBTkJBM0U2QUFBTDFnRUJCbjhnQTBFRGRTRUxBMEFnQkVHZ0FVZ0VRQ0FFSUFWcUlnWkJnQUpPQkVBZ0JrR0FBbXNoQmdzZ0MwRUZkQ0FDYWlBR1FRTjFhaUlJUVlDUWZtb3RBQUFoQjBFQUlRa2pOd1JBSUFRZ0FDQUdJQWdnQnhBeElncEJBRW9FUUVFQklRa2dDa0VCYXlBRWFpRUVDd3NnQ1VVak5pSUtJQW9iQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEEySWdaQkFFb0VRQ0FHUVFGcklBUnFJUVFMQlNBSlJRUkFJNGtDQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEEzQlNBRUlBQWdCaUFESUFFZ0J4QTRDd3NMSUFSQkFXb2hCQXdCQ3dzTE1nRURmeVB4QVNFRElBQWo4Z0VpQkVnRVFBOExRUUFnQTBFSGF5SURheUVGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRGtMdkFVQkQzOENRRUVuSVFjRFFDQUhRUUJJRFFFZ0IwRUNkQ0lHUVlEOEEyb2lBaEFDSVFNZ0FrRUJhaEFDSVFnZ0FrRUNhaEFDSVFRZ0EwRVFheUVGSUFoQkNHc2hERUVJSVFNZ0FRUkFRUkFoQXlBRUlBUkJBWEZySVFRTElBQWdCVTRpQWdSQUlBQWdBeUFGYWtnaEFnc2dBZ1JBSUFaQmcvd0RhaEFDSWdaQmdBRnhRUUJISVFnZ0JrRWdjVUVBUnlFTlFZQ0FBaUFFRURJZ0F5QUFJQVZySWdKclFRRnJJQUlnQmtIQUFIRWJRUUYwYWlJQ1FZQ1FmbW9nQmtFSWNVRUFSeU9KQWlJRUlBUWJRUUZ4UVExMElnUnFMUUFBSVE0Z0FrR0JrSDVxSUFScUxRQUFJUTlCQnlFRkEwQWdCVUVBVGdSQVFRQWhBd0ovUVFGQkFDQUZRUWRyYXlBRklBMGJJZ0owSUE5eEJFQkJBaUVEQ3lBRFFRRnFDeUFEUVFFZ0FuUWdEbkViSWdvRVFFRUhJQVZySUF4cUlnTkJBRTRpQWdSQUlBTkJvQUZNSVFJTElBSUVRRUVBSVF0QkFDRUVJK3NCUlNPSkFpSUNJQUliSWdKRkJFQWdBRUdnQVd3Z0EycEJnSkVFYWkwQUFDSUpJUkFnQ1VFRGNTSUpRUUJMSUFnZ0NCc0VRRUVCSVFzRklCQkJCSEZCQUVjamlRSWlCQ0FFR3lJRUJFQWdDVUVBU3lFRUMwRUJRUUFnQkJzaEJBc0xJQUpGQkVBZ0MwVWlBZ1JBSUFSRklRSUxDeUFDQkVBamlRSUVRQ0FBUWFBQmJDQURha0VEYkVHQXlRVnFJQVpCQjNFZ0NrRUJFRE1pQWtFZmNVRURkRG9BQUNBQVFhQUJiQ0FEYWtFRGJFR0J5UVZxSUFKQjRBZHhRUVYxUVFOME9nQUFJQUJCb0FGc0lBTnFRUU5zUVlMSkJXb2dBa0dBK0FGeFFRcDFRUU4wT2dBQUJTQUFRYUFCYkNBRGFrRURiRUdBeVFWcUlBcEJ5ZjREUWNqK0F5QUdRUkJ4R3hBMElnSkJnSUQ4QjNGQkVIVTZBQUFnQUVHZ0FXd2dBMnBCQTJ4Qmdja0ZhaUFDUVlEK0EzRkJDSFU2QUFBZ0FFR2dBV3dnQTJwQkEyeEJnc2tGYWlBQ09nQUFDd3NMQ3lBRlFRRnJJUVVNQVFzTEN5QUhRUUZySVFjTUFBQUxBQXNMWmdFQ2YwR0FnQUpCZ0pBQ0krY0JHeUVCSTRrQ0lnSWo2d0VnQWhzRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBvQVJzajhBRWdBR3BCL3dGeFFRQWo3d0VRT1FzajVnRUVRQ0FBSUFGQmdMZ0NRWUN3QWlQbEFSc1FPZ3NqNmdFRVFDQUFJK2tCRURzTEN5VUJBWDhDUUFOQUlBQkJrQUZLRFFFZ0FFSC9BWEVRUENBQVFRRnFJUUFNQUFBTEFBc0xSZ0VDZndOQUlBRkJrQUZPUlFSQVFRQWhBQU5BSUFCQm9BRklCRUFnQVVHZ0FXd2dBR3BCZ0pFRWFrRUFPZ0FBSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN3c2JBRUdQL2dNUUFrRUJJQUIwY2lJQUpNQUJRWS8rQXlBQUVBUUxDd0JCQVNUQ0FVRUJFRDhMTEFFQ2Z5TmNJZ0JCQUVvaUFRUkFJMVVoQVFzZ0FRUkFJQUJCQVdzaUFFVUVRRUVBSkZjTEN5QUFKRndMTEFFQ2Z5TnpJZ0JCQUVvaUFRUkFJMndoQVFzZ0FFRUJheUFBSUFFYklnQkZCRUJCQUNSdUN5QUFKSE1MTGdFQ2Z5T0NBU0lBUVFCS0lnRUVRQ044SVFFTElBQkJBV3NnQUNBQkd5SUFSUVJBUVFBa2Znc2dBQ1NDQVFzd0FRSi9JNVVCSWdCQkFFb2lBUVJBSTVBQklRRUxJQUJCQVdzZ0FDQUJHeUlBUlFSQVFRQWtrUUVMSUFBa2xRRUxSd0VDZnlBQUpHSkJsUDRERUFKQitBRnhJUUZCay80RElBQkIvd0Z4SWdJUUJFR1UvZ01nQVNBQVFRaDFRUWR4SWdCeUVBUWdBaVJVSUFBa1ZpTlVJMVpCQ0hSeUpGa0xxQUVCQW44alYwVWlBQVIvSUFBRkkyQkZDd1JBRHdzallVRUJheUlBUVFCTUJFQWpUQVJBSTB3a1lRSi9JMklpQVNOT2RTRUFRUUVqVFFSL1FRRWtZeUFCSUFCckJTQUFJQUZxQ3lJQVFmOFBTZzBBR2tFQUN3UkFRUUFrVndzalRrRUFTZ1JBSUFBUVJRSi9JMklpQVNOT2RTRUFRUUVqVFFSL1FRRWtZeUFCSUFCckJTQUFJQUZxQzBIL0Qwb05BQnBCQUFzRVFFRUFKRmNMQ3dWQkNDUmhDd1VnQUNSaEN3dE9BUU4vSTF0QkFXc2lBVUVBVEFSQUkxTWlBUVJBSTEwaEFDQUFRUTlJSTFJalVoc0VmeUFBUVFGcUJTTlNSU0lDQkVBZ0FFRUFTaUVDQ3lBQVFRRnJJQUFnQWhzTEpGMExDeUFCSkZzTFRnRURmeU55UVFGcklnRkJBRXdFUUNOcUlnRUVRQ04wSVFBZ0FFRVBTQ05wSTJrYkJIOGdBRUVCYWdVamFVVWlBZ1JBSUFCQkFFb2hBZ3NnQUVFQmF5QUFJQUliQ3lSMEN3c2dBU1J5QzFZQkEzOGpsQUZCQVdzaUFVRUFUQVJBSTR3QklnRUVRQ09XQVNFQUlBQkJEMGdqaXdFaml3RWJCSDhnQUVFQmFnVWppd0ZGSWdJRVFDQUFRUUJLSVFJTElBQkJBV3NnQUNBQ0d3c2tsZ0VMQ3lBQkpKUUJDNTBCQVFKL1FZREFBQ09LQW5RaUFTRUNJN0lCSUFCcUlnQWdBVTRFUUNBQUlBSnJKTElCQWtBQ1FBSkFBa0FDUUNPMUFVRUJha0VIY1NJQUJFQWdBRUVDUmcwQkFrQWdBRUVFYXc0RUF3QUVCUUFMREFVTEVFRVFRaEJERUVRTUJBc1FRUkJDRUVNUVJCQkdEQU1MRUVFUVFoQkRFRVFNQWdzUVFSQkNFRU1RUkJCR0RBRUxFRWNRU0JCSkN5QUFKTFVCUVFFUEJTQUFKTElCQzBFQUMzTUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQUNRQ0FBUVFKckRnTUNBd1FBQ3d3RUN5TllJZ0FqblFGSElRRWdBQ1NkQVNBQkR3c2pieUlBSTU0QlJ5RUJJQUFrbmdFZ0FROExJMzhpQUNPZkFVY2hBU0FBSko4QklBRVBDeU9TQVNJQUk2QUJSeUVCSUFBa29BRWdBUThMUVFBTFZRQUNRQUpBQWtBZ0FFRUJSd1JBSUFCQkFrWU5BU0FBUVFOR0RRSU1Bd3RCQVNBQmRFR0JBWEZCQUVjUEMwRUJJQUYwUVljQmNVRUFSdzhMUVFFZ0FYUkIvZ0J4UVFCSER3dEJBU0FCZEVFQmNVRUFSd3R5QVFGL0kxb2dBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTlphMEVDZENJQlFRSjBJQUVqaWdJYkpGb2pXaUFBUVI5MUlnRWdBQ0FCYW5OcklRQWpYMEVCYWtFSGNTUmZEQUVMQ3lBQUpGb2pXQ05YSWdBZ0FCc0VmeU5kQlVFUER3c2pUeU5mRUV3RWYwRUJCVUYvQzJ4QkQyb0xhd0VCZnlOeElBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBamNHdEJBblFqaWdKMEpIRWpjU0FBUVI5MUlnRWdBQ0FCYW5OcklRQWpka0VCYWtFSGNTUjJEQUVMQ3lBQUpIRWpieU51SWdBZ0FCc0VmeU4wQlVFUER3c2paaU4yRUV3RWYwRUJCVUYvQzJ4QkQyb0xEd0FqZ3dGQkFYVkJzUDREYWhBQ0N5b0JBWDhqZ3dGQkFXb2hBQU5BSUFCQklFNEVRQ0FBUVNCcklRQU1BUXNMSUFBa2d3RVFUeVNHQVF2ckFRRURmeU4rUlNJQ0JIOGdBZ1VqZjBVTEJFQkJEdzhMSTRRQklRSWpoUUVFUUVHYy9nTVFBa0VGZFVFUGNTSUNKSVFCUVFBa2hRRUxJNFlCSTRNQlFRRnhSVUVDZEhWQkQzRWhBUUpBQWtBQ1FBSkFJQUlFUUNBQ1FRRkdEUUVnQWtFQ1JnMENEQU1MSUFGQkJIVWhBUXdEQzBFQklRTU1BZ3NnQVVFQmRTRUJRUUloQXd3QkN5QUJRUUoxSVFGQkJDRURDeUFEUVFCS0JIOGdBU0FEYlFWQkFBdEJEMm9oQWlPQkFTQUFheUVBQTBBZ0FFRUFUQVJBUVlBUUk0QUJhMEVCZENPS0FuUWtnUUVqZ1FFZ0FFRWZkU0lCSUFBZ0FXcHpheUVBRUZBTUFRc0xJQUFrZ1FFZ0FndU9BUUVDZnlPVEFTQUFheUlBUVFCTUJFQWpsd0VqalFGMEk0b0NkQ0FBUVI5MUlnRWdBQ0FCYW5OcklRQWptQUVpQVVFQmRTSUNJQUZCQVhFZ0FrRUJjWE1pQVVFT2RISWlBa0cvZjNFZ0FVRUdkSElnQWlPT0FSc2ttQUVMUVFBZ0FDQUFRUUJJR3lTVEFTT1NBU09SQVNJQUlBQWJCSDhqbGdFRlFROFBDMEYvUVFFam1BRkJBWEViYkVFUGFnc3dBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMbHdFQkFYOUJBQ1NqQVNBQVFROGpxUUViSUFGQkR5T3FBUnRxSUFKQkR5T3JBUnRxSUFOQkR5T3NBUnRxSVFRZ0FFRVBJNjBCR3lBQlFROGpyZ0ViYWlFQUlBQWdBa0VQSTY4Qkcyb2hBU0FEUVE4anNBRWJJUU5CQUNTa0FVRUFKS1VCSUFRanB3RkJBV29RVXlFQUlBRWdBMm9qcUFGQkFXb1FVeUVCSUFBa29RRWdBU1NpQVNBQlFmOEJjU0FBUWY4QmNVRUlkSElMb2dNQkJYOGpTaUFBYWlJQkpFb2pXaUFCYTBFQVRDSUJSUVJBUVFFUVN5RUJDeU5rSUFCcUlnSWtaQ054SUFKclFRQk1JZ1ZGQkVCQkFoQkxJUVVMSTNjZ0FHb2tkeU9GQVVVaUFnUkFJNEVCSTNkclFRQktJUUlMSUFKRklnUkZCRUJCQXhCTElRUUxJNGNCSUFCcUpJY0JJNU1CSTRjQmEwRUFUQ0lDUlFSQVFRUVFTeUVDQ3lBQkJFQWpTaUVEUVFBa1NpQURFRTBrbVFFTElBVUVRQ05rSVFOQkFDUmtJQU1RVGlTYUFRc2dCQVJBSTNjaEEwRUFKSGNnQXhCUkpKc0JDeUFDQkVBamh3RWhBMEVBSkljQklBTVFVaVNjQVFzQ2Z5QUJJQVVnQVJzaUFVVUVRQ0FFSVFFTElBRkZDd1JBSUFJaEFRc2dBUVJBUVFFa3BRRUxRWUNBZ0FJamlnSjBJN1FCYlNJRUlRSWpzd0VnQUdvaUFTQUVUZ1JBSUFFZ0Ftc2hBU09sQVNJQUk2TUJJQUFiSWdCRkJFQWpwQUVoQUFzZ0FBUkFJNWtCSTVvQkk1c0JJNXdCRUZRYUJTQUJKTE1CQ3lPMkFTSUNRUUYwUVlDWndRQnFJZ0Fqb1FGQkFtbzZBQUFnQUVFQmFpT2lBVUVDYWpvQUFDQUNRUUZxSWdBanR3RkJBWFZCQVd0T0JIOGdBRUVCYXdVZ0FBc2t0Z0VMSUFFa3N3RUxxQU1CQm44Z0FCQk5JUUVnQUJCT0lRSWdBQkJSSVFRZ0FCQlNJUVVnQVNTWkFTQUNKSm9CSUFRa213RWdCU1NjQVNPekFTQUFhaUlBUVlDQWdBSWppZ0owSTdRQmJVNEVRQ0FBUVlDQWdBSWppZ0owSTdRQmJXc2hBQ0FCSUFJZ0JDQUZFRlFoQXlPMkFVRUJkRUdBbWNFQWFpSUdJQU5CZ1A0RGNVRUlkVUVDYWpvQUFDQUdRUUZxSUFOQi93RnhRUUpxT2dBQUl6Z0VRQ0FCUVE5QkQwRVBFRlFoQVNPMkFVRUJkRUdBbVNGcUlnTWdBVUdBL2dOeFFRaDFRUUpxT2dBQUlBTkJBV29nQVVIL0FYRkJBbW82QUFCQkR5QUNRUTlCRHhCVUlRRWp0Z0ZCQVhSQmdKa3BhaUlDSUFGQmdQNERjVUVJZFVFQ2Fqb0FBQ0FDUVFGcUlBRkIvd0Z4UVFKcU9nQUFRUTlCRHlBRVFROFFWQ0VCSTdZQlFRRjBRWUNaTVdvaUFpQUJRWUQrQTNGQkNIVkJBbW82QUFBZ0FrRUJhaUFCUWY4QmNVRUNham9BQUVFUFFROUJEeUFGRUZRaEFTTzJBVUVCZEVHQW1UbHFJZ0lnQVVHQS9nTnhRUWgxUVFKcU9nQUFJQUpCQVdvZ0FVSC9BWEZCQW1vNkFBQUxJN1lCUVFGcUlnRWp0d0ZCQVhWQkFXdE9CSDhnQVVFQmF3VWdBUXNrdGdFTElBQWtzd0VMSGdFQmZ5QUFFRW9oQVNBQlJTTTFJelViQkVBZ0FCQlZCU0FBRUZZTEN5OEJBbjlCMXdBamlnSjBJUUVqcGdFaEFBTkFJQUFnQVU0RVFDQUJFRmNnQUNBQmF5RUFEQUVMQ3lBQUpLWUJDNlFEQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR1EvZ05IQkVBZ0FFR1YvZ05HRFFFQ1FDQUFRWkgrQTJzT0ZnWUxFQlFBQnd3UkZRTUlEUklXQkFrT0V4Y0ZDZzhBQ3d3WEMwR1EvZ01RQWtHQUFYSVBDMEdWL2dNUUFrSC9BWElQQzBHYS9nTVFBa0gvQUhJUEMwR2YvZ01RQWtIL0FYSVBDMEdrL2dNUUFnOExRWkgrQXhBQ1FUOXlEd3RCbHY0REVBSkJQM0lQQzBHYi9nTVFBa0gvQVhJUEMwR2cvZ01RQWtIL0FYSVBDMEdsL2dNUUFnOExRWkwrQXhBQ0R3dEJsLzRERUFJUEMwR2MvZ01RQWtHZkFYSVBDMEdoL2dNUUFnOExRWUFCUVFBanNRRWJJUUFnQUVFQmNpQUFRWDV4STFjYklRQWdBRUVDY2lBQVFYMXhJMjRiSVFBZ0FFRUVjaUFBUVh0eEkzNGJJUUFnQUVFSWNpQUFRWGR4STVFQkcwSHdBSElQQzBHVC9nTVFBa0gvQVhJUEMwR1kvZ01RQWtIL0FYSVBDMEdkL2dNUUFrSC9BWElQQzBHaS9nTVFBZzhMUVpUK0F4QUNRYjhCY2c4TFFabitBeEFDUWI4QmNnOExRWjcrQXhBQ1FiOEJjZzhMUWFQK0F4QUNRYjhCY2c4TFFYOExuQUVCQVg4ajJ3RWhBQ1BjQVFSQUlBQkJlM0VnQUVFRWNpUFRBUnNoQUNBQVFYNXhJQUJCQVhJajFnRWJJUUFnQUVGM2NTQUFRUWh5STlRQkd5RUFJQUJCZlhFZ0FFRUNjaVBWQVJzaEFBVWozUUVFUUNBQVFYNXhJQUJCQVhJajF3RWJJUUFnQUVGOWNTQUFRUUp5STlnQkd5RUFJQUJCZTNFZ0FFRUVjaVBaQVJzaEFDQUFRWGR4SUFCQkNISWoyZ0ViSVFBTEN5QUFRZkFCY2d2MEFnRUJmeUFBUVlDQUFrZ0VRRUYvRHdzZ0FFR0FnQUpPSWdFRWZ5QUFRWURBQWtnRklBRUxCRUJCZnc4TElBQkJnTUFEVGlJQkJIOGdBRUdBL0FOSUJTQUJDd1JBSUFCQmdFQnFFQUlQQ3lBQVFZRDhBMDRpQVFSL0lBQkJuLzBEVEFVZ0FRc0VRRUgvQVVGL0krSUJRUUpJR3c4TElBQkJ6ZjREUmdSQVFmOEJJUUJCemY0REVBSkJBWEZGQkVCQi9nRWhBQXNqaWdKRkJFQWdBRUgvZm5FaEFBc2dBQThMSUFCQnhQNERSZ1JBSUFBajdnRVFCQ1B1QVE4TElBQkJrUDREVGlJQkJIOGdBRUdtL2dOTUJTQUJDd1JBRUZnZ0FCQlpEd3NnQUVHbi9nTk9JZ0VFZnlBQVFhLytBMHdGSUFFTEJFQkIvd0VQQ3lBQVFiRCtBMDRpQVFSL0lBQkJ2LzREVEFVZ0FRc0VRQkJZSTM0RVFCQlBEd3RCZnc4TElBQkJoUDREUmdSQUlBQWp4d0ZCZ1A0RGNVRUlkU0lBRUFRZ0FBOExJQUJCaGY0RFJnUkFJQUFqeUFFUUJDUElBUThMSUFCQmovNERSZ1JBSThBQlFlQUJjZzhMSUFCQmdQNERSZ1JBRUZvUEMwRi9DeWtCQVg4ajN3RWdBRVlFUUVFQkpPRUJDeUFBRUZzaUFVRi9SZ1IvSUFBUUFnVWdBVUgvQVhFTEM3WUNBUVIvSS9jQkJFQVBDeVA0QVNFRUkva0JJUU1nQUVIL1Awd0VRQ0FEQkg4Z0FVRVFjVVVGSUFNTFJRUkFJQUZCRDNFaUFBUkFJQUJCQ2tZRVFFRUJKUFVCQ3dWQkFDVDFBUXNMQlNBQVFmLy9BRXdFUUNQN0FTSUZSU0lDUlFSQUlBQkIvOThBVENFQ0N5QUNCRUFnQVVFUGNTUHpBU0FER3lFQUlBUUVmeUFCUVI5eElRRWdBRUhnQVhFRkkvb0JCSDhnQVVIL0FIRWhBU0FBUVlBQmNRVkJBQ0FBSUFVYkN3c2hBQ0FBSUFGeUpQTUJCU1B6QVVIL0FYRWdBVUVBU2tFSWRISWs4d0VMQlNBRFJTSUNCSDhnQUVIL3Z3Rk1CU0FDQ3dSQUkvWUJJQVFnQkJzRVFDUHpBVUVmY1NBQlFlQUJjWElrOHdFUEN5QUJRUTl4SUFGQkEzRWord0ViSlBRQkJTQURSU0lDQkVBZ0FFSC8vd0ZNSVFJTElBSUVRQ0FFQkVBZ0FVRUJjVUVBUnlUMkFRc0xDd3NMQzBBQkFYOGpUU0VCSUFCQjhBQnhRUVIxSkV3Z0FFRUljVUVBUnlSTklBQkJCM0VrVGlBQkJIOGpUVVVpQUFSL0kyTUZJQUFMQlNBQkN3UkFRUUFrVndzTE1nRUJmeUFBUVlBQmNVRUFSeUVCSTM5RklnQUVmeUFCQlNBQUN3UkFRUUFraGdFTElBRWtmeUFCUlFSQUlBRWtmZ3NMTkFBZ0FFRUVkVUVQY1NSUklBQkJDSEZCQUVja1VpQUFRUWR4SkZNZ0FFSDRBWEZCQUVvaUFDUllJQUJGQkVBZ0FDUlhDd3MwQUNBQVFRUjFRUTl4SkdnZ0FFRUljVUVBUnlScElBQkJCM0VrYWlBQVFmZ0JjVUVBU2lJQUpHOGdBRVVFUUNBQUpHNExDemtBSUFCQkJIVkJEM0VraWdFZ0FFRUljVUVBUnlTTEFTQUFRUWR4Skl3QklBQkIrQUZ4UVFCS0lnQWtrZ0VnQUVVRVFDQUFKSkVCQ3dzNEFDQUFRUVIxSkkwQklBQkJDSEZCQUVja2pnRWdBRUVIY1NJQUpJOEJJQUJCQVhRaUFFRUJTQVJBUVFFaEFBc2dBRUVEZENTWEFRdWpBUUVDZjBFQkpGY2pYRVVFUUNOTEpGd0xRWUFRSTFsclFRSjBJZ0JCQW5RZ0FDT0tBaHNrV2lOVEpGc2pVU1JkSTFra1lpTk1CRUFqVENSaEJVRUlKR0VMSTB4QkFFb2lBQVIvSUFBRkkwNUJBRW9MSkdCQkFDUmpJMDVCQUVvaUFBUi9BbjhqWWlJQkkwNTFJUUJCQVNOTkJIOUJBU1JqSUFFZ0FHc0ZJQUFnQVdvTFFmOFBTZzBBR2tFQUN3VWdBQXNFUUVFQUpGY0xJMWhGQkVCQkFDUlhDd3VwQVFFRGZ5QUFRUWR4SWdJa1ZpTlVJQUpCQ0hSeUpGa2p0UUZCQVhGQkFVWWhBeU5WUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQTBVRVFDTmNRUUJLSWdJRWZ5QUJCU0FDQ3dSQUkxeEJBV3NrWENBQVFZQUJjVVVpQVFSL0kxeEZCU0FCQ3dSQVFRQWtWd3NMQ3lBQVFjQUFjVUVBUnlSVklBQkJnQUZ4QkVBUVpBSi9JQU5GSWdBRVFDTmNJMHRHSVFBTElBQUxCSDhqVlFVZ0FBc0VRQ05jUVFGckpGd0xDd3N4QUVFQkpHNGpjMFVFUUNObEpITUxRWUFRSTNCclFRSjBJNG9DZENSeEkyb2tjaU5vSkhRamIwVUVRRUVBSkc0TEM2a0JBUU4vSUFCQkIzRWlBaVJ0STJzZ0FrRUlkSElrY0NPMUFVRUJjVUVCUmlFREkyeEZJZ0VFUUNBQVFjQUFjVUVBUnlFQkN5QURSUVJBSTNOQkFFb2lBZ1IvSUFFRklBSUxCRUFqYzBFQmF5UnpJQUJCZ0FGeFJTSUJCSDhqYzBVRklBRUxCRUJCQUNSdUN3c0xJQUJCd0FCeFFRQkhKR3dnQUVHQUFYRUVRQkJtQW44Z0EwVWlBQVJBSTNNalpVWWhBQXNnQUFzRWZ5TnNCU0FBQ3dSQUkzTkJBV3NrY3dzTEN6c0FRUUVrZmlPQ0FVVUVRQ040SklJQkMwR0FFQ09BQVd0QkFYUWppZ0owSklFQkk0RUJRUVpxSklFQlFRQWtnd0VqZjBVRVFFRUFKSDRMQzY4QkFRTi9JQUJCQjNFaUFpUjlJM3NnQWtFSWRISWtnQUVqdFFGQkFYRkJBVVlpQTBVRVFDTjhSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2pnZ0ZCQUVvaUFnUi9JQUVGSUFJTEJFQWpnZ0ZCQVdza2dnRWdBRUdBQVhGRklnRUVmeU9DQVVVRklBRUxCRUJCQUNSK0N3c0xJQUJCd0FCeFFRQkhKSHdnQUVHQUFYRUVRQkJvQW44Z0EwVWlBQVJBSTRJQkkzaEdJUUFMSUFBTEJIOGpmQVVnQUFzRVFDT0NBVUVCYXlTQ0FRc0xDMEVBUVFFa2tRRWpsUUZGQkVBamlBRWtsUUVMSTVjQkk0MEJkQ09LQW5Ra2t3RWpqQUVrbEFFamlnRWtsZ0ZCLy84QkpKZ0JJNUlCUlFSQVFRQWtrUUVMQzZJQkFRTi9JN1VCUVFGeFFRRkdJUUlqa0FGRklnRUVRQ0FBUWNBQWNVRUFSeUVCQ3lBQ1JRUkFJNVVCUVFCS0lnTUVmeUFCQlNBREN3UkFJNVVCUVFGckpKVUJJQUJCZ0FGeFJTSUJCSDhqbFFGRkJTQUJDd1JBUVFBa2tRRUxDd3NnQUVIQUFIRkJBRWNra0FFZ0FFR0FBWEVFUUJCcUFuOGdBa1VpQUFSQUk1VUJJNGdCUmlFQUN5QUFDd1IvSTVBQkJTQUFDd1JBSTVVQlFRRnJKSlVCQ3dzTC9nTUJBWDhnQUVHbS9nTkhJZ0lFUUNPeEFVVWhBZ3NnQWdSQVFRQVBDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RFJ3UkFJQUJCbXY0RFJnMEJBa0FnQUVHUi9nTnJEaFlEQndzUEFBUUlEQkFBQlFrTkVRQUdDZzRTRXhRVkFBc01GUXNnQVJCZURCVUxJQUVRWHd3VUN5QUJRUVoxUVFOeEpFOGdBVUUvY1NSUUkwc2pVR3NrWEF3VEN5QUJRUVoxUVFOeEpHWWdBVUUvY1NSbkkyVWpaMnNrY3d3U0N5QUJKSGtqZUNONWF5U0NBUXdSQ3lBQlFUOXhKSWtCSTRnQkk0a0JheVNWQVF3UUN5QUJFR0FNRHdzZ0FSQmhEQTRMUVFFa2hRRWdBVUVGZFVFUGNTUjZEQTBMSUFFUVlnd01DeUFCSkZRalZrRUlkQ0FCY2lSWkRBc0xJQUVrYXlOdFFRaDBJQUZ5SkhBTUNnc2dBU1I3STMxQkNIUWdBWElrZ0FFTUNRc2dBUkJqREFnTElBRVFaUXdIQ3lBQkVHY01CZ3NnQVJCcERBVUxJQUVRYXd3RUN5QUJRUVIxUVFkeEpLY0JJQUZCQjNFa3FBRkJBU1NqQVF3REN5QUJFQkJCQVNTa0FRd0NDeU94QVNJQ1JTSUFCRUFnQVVHQUFYRWhBQXNnQUFSQVFRY2t0UUZCQUNSZlFRQWtkZ3NnQVVHQUFYRkZJQUlnQWhzRVFBSkFRWkQrQXlFQUEwQWdBRUdtL2dOT0RRRWdBRUVBRUhrZ0FFRUJhaUVBREFBQUN3QUxDeUFCUVlBQmNVRUFSeVN4QVF3QkMwRUJEd3RCQVFzOEFRRi9JQUJCQ0hRaEFVRUFJUUFEUUFKQUlBQkJud0ZLRFFBZ0FFR0EvQU5xSUFBZ0FXb1FBaEFFSUFCQkFXb2hBQXdCQ3d0QmhBVWtnUUlMSXdFQmZ5UDhBUkFDSVFBai9RRVFBa0gvQVhFZ0FFSC9BWEZCQ0hSeVFmRC9BM0VMSndFQmZ5UCtBUkFDSVFBai93RVFBa0gvQVhFZ0FFSC9BWEZCQ0hSeVFmQS9jVUdBZ0FKcUM0UUJBUU4vSTRrQ1JRUkFEd3NnQUVHQUFYRkZJNElDSTRJQ0d3UkFRUUFrZ2dJamdBSVFBa0dBQVhJaEFDT0FBaUFBRUFRUEN4QnVJUUVRYnlFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSklJQ0lBTWtnd0lnQVNTRUFpQUNKSVVDSTRBQ0lBQkIvMzV4RUFRRklBRWdBaUFERUhvamdBSkIvd0VRQkFzTFhnRUVmeU5ISVFNalJpQUFSaUlDUlFSQUlBQWdBMFloQWdzZ0FnUkFJQUJCQVdzaUJCQUNRYjkvY1NJQ1FUOXhJZ1ZCUUdzZ0JTQUFJQU5HRzBHQWtBUnFJQUU2QUFBZ0FrR0FBWEVFUUNBRUlBSkJBV3BCZ0FGeUVBUUxDd3N4QUFKQUFrQUNRQUpBSUFBRVFBSkFJQUJCQVdzT0F3SURCQUFMREFRTFFRa1BDMEVERHd0QkJROExRUWNQQzBFQUN5VUJBWDlCQVNQTkFSQnlJZ0owSUFCeFFRQkhJZ0FFZjBFQklBSjBJQUZ4UlFVZ0FBc0xoUUVCQkg4RFFDQUNJQUJJQkVBZ0FrRUVhaUVDSThjQklnRkJCR3BCLy84RGNTSURKTWNCSTh3QkJFQWp5Z0VoQkNQSkFRUkFJOHNCSk1nQlFRRWt3d0ZCQWhBL1FRQWt5UUZCQVNUS0FRVWdCQVJBUVFBa3lnRUxDeUFCSUFNUWN3UkFJOGdCUVFGcUlnRkIvd0ZLQkVCQkFTVEpBVUVBSVFFTElBRWt5QUVMQ3d3QkN3c0xEQUFqeGdFUWRFRUFKTVlCQzBZQkFYOGp4d0VoQUVFQUpNY0JRWVQrQTBFQUVBUWp6QUVFZnlBQVFRQVFjd1VqekFFTEJFQWp5QUZCQVdvaUFFSC9BVW9FUUVFQkpNa0JRUUFoQUFzZ0FDVElBUXNMZ2dFQkEzOGp6QUVoQVNBQVFRUnhRUUJISk13QklBQkJBM0VoQWlBQlJRUkFJODBCRUhJaEFDQUNFSEloQXlQSEFTRUJJOHdCQkg5QkFTQUFkQ0FCY1FWQkFTQUFkQ0FCY1VFQVJ5SUFCSDlCQVNBRGRDQUJjUVVnQUFzTEJFQWp5QUZCQVdvaUFFSC9BVW9FUUVFQkpNa0JRUUFoQUFzZ0FDVElBUXNMSUFJa3pRRUxoUWNCQW44Q1FBSkFJQUJCemY0RFJnUkFRYzMrQXlBQlFRRnhFQVFNQVFzZ0FFSFEvZ05HSTRnQ0lnSWdBaHNFUUVFQUpJZ0NRZjhCSkpRQ0RBSUxJQUJCZ0lBQ1NBUkFJQUFnQVJCZERBRUxJQUJCZ0lBQ1RpSUNCRUFnQUVHQXdBSklJUUlMSUFJTkFTQUFRWURBQTA0aUFnUkFJQUJCZ1B3RFNDRUNDeUFDQkVBZ0FFR0FRR29nQVJBRURBSUxJQUJCZ1B3RFRpSUNCRUFnQUVHZi9RTk1JUUlMSUFJRVFDUGlBVUVDVGc4TElBQkJvUDBEVGlJQ0JFQWdBRUgvL1FOTUlRSUxJQUlOQUNBQVFZTCtBMFlFUUNBQlFRRnhRUUJISk5BQklBRkJBbkZCQUVjazBRRWdBVUdBQVhGQkFFY2swZ0ZCQVE4TElBQkJrUDREVGlJQ0JFQWdBRUdtL2dOTUlRSUxJQUlFUUJCWUlBQWdBUkJzRHdzZ0FFR3cvZ05PSWdJRVFDQUFRYi8rQTB3aEFnc2dBZ1JBRUZnamZnUkFJNE1CUVFGMVFiRCtBMm9nQVJBRURBSUxEQUlMSUFCQndQNERUaUlDQkVBZ0FFSEwvZ05NSVFJTElBSUVRQ0FBUWNEK0EwWUVRQ0FCRUNRTUF3c2dBRUhCL2dOR0JFQkJ3ZjRESUFGQitBRnhRY0grQXhBQ1FRZHhja0dBQVhJUUJBd0NDeUFBUWNUK0EwWUVRRUVBSk80QklBQkJBQkFFREFJTElBQkJ4ZjREUmdSQUlBRWs0d0VNQXdzZ0FFSEcvZ05HQkVBZ0FSQnREQU1MQWtBQ1FBSkFBa0FnQUVIRC9nTkhCRUFnQUVIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTVHZBUXdHQ3lBQkpQQUJEQVVMSUFFazhRRU1CQXNnQVNUeUFRd0RDd3dDQ3lPQUFpQUFSZ1JBSUFFUWNBd0JDeU9IQWlBQVJpSUNSUVJBSTRZQ0lBQkdJUUlMSUFJRVFDT0NBZ1JBQW44amhBSWlBMEdBZ0FGT0lnSUVRQ0FEUWYvL0FVd2hBZ3NnQWtVTEJFQWdBMEdBb0FOT0lnSUVRQ0FEUWYrL0Ewd2hBZ3NMSUFJTkFnc0xJQUFqUlU0aUFnUkFJQUFqUjB3aEFnc2dBZ1JBSUFBZ0FSQnhEQUlMSUFCQmhQNERUaUlDQkVBZ0FFR0gvZ05NSVFJTElBSUVRQkIxQWtBQ1FBSkFBa0FnQUVHRS9nTkhCRUFnQUVHRi9nTnJEZ01CQWdNRUN4QjJEQVVMQWtBanpBRUVRQ1BLQVEwQkk4a0JCRUJCQUNUSkFRc0xJQUVreUFFTERBVUxJQUVreXdFanlnRWp6QUVpQUNBQUd3UkFJQUVreUFGQkFDVEtBUXNNQkFzZ0FSQjNEQU1MREFJTElBQkJnUDREUmdSQUlBRkIvd0Z6Sk5zQkk5c0JJZ0pCRUhGQkFFY2szQUVnQWtFZ2NVRUFSeVRkQVFzZ0FFR1AvZ05HQkVBZ0FSQVVEQUlMSUFCQi8vOERSZ1JBSUFFUUV3d0NDMEVCRHd0QkFBOExRUUVMSHdBajRBRWdBRVlFUUVFQkpPRUJDeUFBSUFFUWVBUkFJQUFnQVJBRUN3dGFBUU4vQTBBQ1FDQURJQUpPRFFBZ0FDQURhaEJjSVFVZ0FTQURhaUVFQTBBZ0JFSC92d0pLQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUhrZ0EwRUJhaUVEREFFTEN5T0JBa0VnSTRvQ2RDQUNRUVIxYkdva2dRSUxjZ0VDZnlPQ0FrVUVRQThMUVJBaEFDT0VBaU9GQWdKL0k0TUNJZ0ZCRUVnRVFDQUJJUUFMSUFBTEVIb2poQUlnQUdva2hBSWpoUUlnQUdva2hRSWdBU0FBYXlJQUpJTUNJNEFDSVFFZ0FFRUFUQVJBUVFBa2dnSWdBVUgvQVJBRUJTQUJJQUJCQkhWQkFXdEIvMzV4RUFRTEMwQUJBWDhnQUVVaUFnUi9JQUlGSUFCQkFVWUxJZ0FFZnlQdUFTUGpBVVlGSUFBTEJFQWdBVUVFY2lJQlFjQUFjUVJBRUVBTEJTQUJRWHR4SVFFTElBRUwvZ0VCQlg4ajVBRkZCRUFQQ3lQaUFTRUFJQUFqN2dFaUFrR1FBVTRFZjBFQkJVSDRBaU9LQW5RaUFTRURJKzBCSWdRZ0FVNEVmMEVDQlVFRFFRQWdCQ0FEVGhzTEN5SUJSd1JBUWNIK0F4QUNJUUFnQVNUaUFVRUFJUUlDUUFKQUFrQUNRQ0FCQkVBZ0FVRUJhdzREQVFJREJBc2dBRUY4Y1NJQVFRaHhRUUJISVFJTUF3c2dBRUY5Y1VFQmNpSUFRUkJ4UVFCSElRSU1BZ3NnQUVGK2NVRUNjaUlBUVNCeFFRQkhJUUlNQVFzZ0FFRURjaUVBQ3lBQ0JFQVFRQXNnQVVVRVFCQjdDeUFCUVFGR0JFQkJBU1RCQVVFQUVEOExRY0grQXlBQklBQVFmQkFFQlNBQ1Faa0JSZ1JBUWNIK0F5QUJRY0grQXhBQ0VId1FCQXNMQzU4QkFRRi9JK1FCQkVBajdRRWdBR29rN1FFak5DRUJBMEFqN1FGQkJDT0tBaUlBZEVISUF5QUFkQ1B1QVVHWkFVWWJUZ1JBSSswQlFRUWppZ0lpQUhSQnlBTWdBSFFqN2dGQm1RRkdHMnNrN1FFajdnRWlBRUdRQVVZRVFDQUJCRUFRUFFVZ0FCQThDeEErUVg4a1NFRi9KRWtGSUFCQmtBRklCRUFnQVVVRVFDQUFFRHdMQ3d0QkFDQUFRUUZxSUFCQm1RRktHeVR1QVF3QkN3c0xFSDBMTndFQmYwRUVJNG9DSWdCMFFjZ0RJQUIwSSs0QlFaa0JSaHNoQUFOQUkrd0JJQUJPQkVBZ0FCQitJK3dCSUFCckpPd0JEQUVMQ3d1NEFRRUVmeVBTQVVVRVFBOExBMEFnQXlBQVNBUkFJQU5CQkdvaEF3Si9JODRCSWdGQkJHb2lBa0gvL3dOS0JFQWdBa0dBZ0FScklRSUxJQUlMSk00QlFRRkJBa0VISTlFQkd5SUVkQ0FCY1VFQVJ5SUJCRUJCQVNBRWRDQUNjVVVoQVFzZ0FRUkFRWUgrQTBHQi9nTVFBa0VCZEVFQmFrSC9BWEVRQkNQUEFVRUJhaUlCUVFoR0JFQkJBQ1RQQVVFQkpNUUJRUU1RUDBHQy9nTkJndjRERUFKQi8zNXhFQVJCQUNUU0FRVWdBU1RQQVFzTERBRUxDd3VSQVFBamdRSkJBRW9FUUNPQkFpQUFhaUVBUVFBa2dRSUxJNVVDSUFCcUpKVUNJNWtDUlFSQUl6SUVRQ1BzQVNBQWFpVHNBUkIvQlNBQUVINExJekVFUUNPbUFTQUFhaVNtQVJCWUJTQUFFRmNMSUFBUWdBRUxJek1FUUNQR0FTQUFhaVRHQVJCMUJTQUFFSFFMSTV3Q0lBQnFJZ0FqbWdKT0JFQWptd0pCQVdva213SWdBQ09hQW1zaEFBc2dBQ1NjQWdzTUFFRUVFSUVCSTVRQ0VBSUxLUUVCZjBFRUVJRUJJNVFDUVFGcVFmLy9BM0VRQWlFQUVJSUJRZjhCY1NBQVFmOEJjVUVJZEhJTERRQkJCQkNCQVNBQUlBRVFlUXN3QUVFQklBQjBRZjhCY1NFQUlBRkJBRW9FUUNPU0FpQUFja0gvQVhFa2tnSUZJNUlDSUFCQi93RnpjU1NTQWdzTENRQkJCU0FBRUlVQkN6b0JBWDhnQVVFQVRnUkFJQUJCRDNFZ0FVRVBjV3BCRUhGQkFFY1FoZ0VGSUFGQkgzVWlBaUFCSUFKcWMwRVBjU0FBUVE5eFN4Q0dBUXNMQ1FCQkJ5QUFFSVVCQ3drQVFRWWdBQkNGQVFzSkFFRUVJQUFRaFFFTFBRRUNmeUFCUVlEK0EzRkJDSFVoQWlBQlFmOEJjU0lCSVFNZ0FDQUJFSGdFUUNBQUlBTVFCQXNnQUVFQmFpSUFJQUlRZUFSQUlBQWdBaEFFQ3dzT0FFRUlFSUVCSUFBZ0FSQ0xBUXRhQUNBQ0JFQWdBRUgvL3dOeElnQWdBV29nQUNBQmMzTWlBRUVRY1VFQVJ4Q0dBU0FBUVlBQ2NVRUFSeENLQVFVZ0FDQUJha0gvL3dOeElnSWdBRUgvL3dOeFNSQ0tBU0FBSUFGeklBSnpRWUFnY1VFQVJ4Q0dBUXNMQ3dCQkJCQ0JBU0FBRUZ3THFRVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTERCVUxFSU1CUWYvL0EzRWlBRUdBL2dOeFFRaDFKSXdDSUFCQi93RnhKSTBDREE4TEk0MENRZjhCY1NPTUFrSC9BWEZCQ0hSeUk0c0NFSVFCREJNTEk0MENRZjhCY1NPTUFrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJd0NEQk1MSTR3Q0lnQkJBUkNIQVNBQVFRRnFRZjhCY1NJQUpJd0NEQTBMSTR3Q0lnQkJmeENIQVNBQVFRRnJRZjhCY1NJQUpJd0NEQTBMRUlJQlFmOEJjU1NNQWd3TkN5T0xBaUlBUVlBQmNVR0FBVVlRaWdFZ0FFRUJkQ0FBUWY4QmNVRUhkbkpCL3dGeEpJc0NEQTBMRUlNQlFmLy9BM0Vqa3dJUWpBRU1DQXNqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElpQUNPTkFrSC9BWEVqakFKQi93RnhRUWgwY2lJQlFRQVFqUUVnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTUUFpQUFRZjhCY1NTUkFrRUFFSWtCUVFnUEN5T05Ba0gvQVhFampBSkIvd0Z4UVFoMGNoQ09BVUgvQVhFa2l3SU1Dd3NqalFKQi93RnhJNHdDUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVrakFJTUN3c2pqUUlpQUVFQkVJY0JJQUJCQVdwQi93RnhJZ0FralFJTUJRc2pqUUlpQUVGL0VJY0JJQUJCQVd0Qi93RnhJZ0FralFJTUJRc1FnZ0ZCL3dGeEpJMENEQVVMSTRzQ0lnQkJBWEZCQUVzUWlnRWdBRUVIZENBQVFmOEJjVUVCZG5KQi93RnhKSXNDREFVTFFYOFBDeU9VQWtFQ2FrSC8vd054SkpRQ0RBUUxJQUJGRUlnQlFRQVFpUUVNQXdzZ0FFVVFpQUZCQVJDSkFRd0NDeU9VQWtFQmFrSC8vd054SkpRQ0RBRUxRUUFRaUFGQkFCQ0pBVUVBRUlZQkMwRUVEd3NnQUVIL0FYRWtqUUpCQ0F1WkJnRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRVFSd1JBSUFCQkVVWU5BUUpBSUFCQkVtc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqaVFJRVFFSE4vZ01RamdGQi93RnhJZ0JCQVhFRVFFSE4vZ01nQUVGK2NTSUFRWUFCY1FSL1FRQWtpZ0lnQUVIL2ZuRUZRUUVraWdJZ0FFR0FBWElMRUlRQlFjUUFEd3NMUVFFa21RSU1FQXNRZ3dGQi8vOERjU0lBUVlEK0EzRkJDSFVramdJZ0FFSC9BWEVrandJamxBSkJBbXBCLy84RGNTU1VBZ3dSQ3lPUEFrSC9BWEVqamdKQi93RnhRUWgwY2lPTEFoQ0VBUXdRQ3lPUEFrSC9BWEVqamdKQi93RnhRUWgwY2tFQmFrSC8vd054SWdCQmdQNERjVUVJZFNTT0Fnd1FDeU9PQWlJQVFRRVFod0VnQUVFQmFrSC9BWEVramdJampnSkZFSWdCUVFBUWlRRU1EZ3NqamdJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4Skk0Q0k0NENSUkNJQVVFQkVJa0JEQTBMRUlJQlFmOEJjU1NPQWd3S0N5T0xBaUlCUVlBQmNVR0FBVVloQUNPU0FrRUVka0VCY1NBQlFRRjBja0gvQVhFa2l3SU1DZ3NRZ2dFaEFDT1VBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2xBSkJDQThMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5SWdBamp3SkIvd0Z4STQ0Q1FmOEJjVUVJZEhJaUFVRUFFSTBCSUFBZ0FXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tBSWdBRUgvQVhFa2tRSkJBQkNKQVVFSUR3c2pqd0pCL3dGeEk0NENRZjhCY1VFSWRISVFqZ0ZCL3dGeEpJc0NEQWdMSTQ4Q1FmOEJjU09PQWtIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkk0Q0RBZ0xJNDhDSWdCQkFSQ0hBU0FBUVFGcVFmOEJjU0lBSkk4Q0lBQkZFSWdCUVFBUWlRRU1CZ3NqandJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4SWdBa2p3SWdBRVVRaUFGQkFSQ0pBUXdGQ3hDQ0FVSC9BWEVrandJTUFnc2ppd0lpQVVFQmNVRUJSaUVBSTVJQ1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpU0xBZ3dDQzBGL0R3c2psQUpCQVdwQi8vOERjU1NVQWd3QkN5QUFFSW9CUVFBUWlBRkJBQkNKQVVFQUVJWUJDMEVFRHdzZ0FFSC9BWEVrandKQkNBdjFCZ0VDZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQklFY0VRQ0FBUVNGR0RRRUNRQ0FBUVNKckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJNUlDUVFkMlFRRnhCRUFqbEFKQkFXcEIvLzhEY1NTVUFnVVFnZ0VoQUNPVUFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VrbEFJTFFRZ1BDeENEQVVILy93TnhJZ0JCZ1A0RGNVRUlkU1NRQWlBQVFmOEJjU1NSQWlPVUFrRUNha0gvL3dOeEpKUUNEQlFMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5SWdBaml3SVFoQUVNRHdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhKQkFXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tBSU1EUXNqa0FJaUFFRUJFSWNCSUFCQkFXcEIvd0Z4SWdBa2tBSU1EZ3Nqa0FJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4SWdBa2tBSU1EZ3NRZ2dGQi93RnhKSkFDREE0TFFRWkJBQ09TQWlJQ1FRVjJRUUZ4UVFCTEd5SUFRZUFBY2lBQUlBSkJCSFpCQVhGQkFFc2JJUUFqaXdJaEFTQUNRUVoyUVFGeFFRQkxCSDhnQVNBQWEwSC9BWEVGSUFFZ0FFRUdjaUFBSUFGQkQzRkJDVXNiSWdCQjRBQnlJQUFnQVVHWkFVc2JJZ0JxUWY4QmNRc2lBVVVRaUFFZ0FFSGdBSEZCQUVjUWlnRkJBQkNHQVNBQkpJc0NEQTRMSTVJQ1FRZDJRUUZ4UVFCTEJFQVFnZ0VoQUNPVUFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VrbEFJRkk1UUNRUUZxUWYvL0EzRWtsQUlMUVFnUEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpSUFJQUJCLy84RGNVRUFFSTBCSUFCQkFYUkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tBSWdBRUgvQVhFa2tRSkJBQkNKQVVFSUR3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISWlBQkNPQVVIL0FYRWtpd0lNQndzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tBSU1CUXNqa1FJaUFFRUJFSWNCSUFCQkFXcEIvd0Z4SWdBa2tRSU1CZ3Nqa1FJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4SWdBa2tRSU1CZ3NRZ2dGQi93RnhKSkVDREFZTEk0c0NRWDl6UWY4QmNTU0xBa0VCRUlrQlFRRVFoZ0VNQmd0QmZ3OExJQUJCL3dGeEpKRUNRUWdQQ3lBQVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpKQUNJQUJCL3dGeEpKRUNEQU1MSUFCRkVJZ0JRUUFRaVFFTUFnc2dBRVVRaUFGQkFSQ0pBUXdCQ3lPVUFrRUJha0gvL3dOeEpKUUNDMEVFQy9FRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFd1J3UkFJQUJCTVVZTkFRSkFJQUJCTW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2prZ0pCQkhaQkFYRUVRQ09VQWtFQmFrSC8vd054SkpRQ0JSQ0NBU0VBSTVRQ0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NVQWd0QkNBOExFSU1CUWYvL0EzRWtrd0lqbEFKQkFtcEIvLzhEY1NTVUFnd1JDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBjaUlBSTRzQ0VJUUJEQTRMSTVNQ1FRRnFRZi8vQTNFa2t3SkJDQThMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5SWdBUWpnRWlBVUVCRUljQklBRkJBV3BCL3dGeElnRkZFSWdCUVFBUWlRRWdBQ0FCRUlRQkRBNExJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlJZ0FRamdFaUFVRi9FSWNCSUFGQkFXdEIvd0Z4SWdGRkVJZ0JRUUVRaVFFZ0FDQUJFSVFCREEwTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJSUJRZjhCY1JDRUFRd0xDMEVBRUlrQlFRQVFoZ0ZCQVJDS0FRd0xDeU9TQWtFRWRrRUJjVUVCUmdSQUVJSUJJUUFqbEFJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSlFDQlNPVUFrRUJha0gvL3dOeEpKUUNDMEVJRHdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJaUFDT1RBa0VBRUkwQkk1TUNJQUJxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSkFDSUFCQi93RnhKSkVDUVFBUWlRRkJDQThMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5SWdBUWpnRkIvd0Z4SklzQ0RBWUxJNU1DUVFGclFmLy9BM0Vra3dKQkNBOExJNHNDSWdCQkFSQ0hBU0FBUVFGcVFmOEJjU0lBSklzQ0lBQkZFSWdCUVFBUWlRRU1CZ3NqaXdJaUFFRi9FSWNCSUFCQkFXdEIvd0Z4SWdBa2l3SWdBRVVRaUFGQkFSQ0pBUXdGQ3hDQ0FVSC9BWEVraXdJTUF3dEJBQkNKQVVFQUVJWUJJNUlDUVFSMlFRRnhRUUJORUlvQkRBTUxRWDhQQ3lBQVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpKQUNJQUJCL3dGeEpKRUNEQUVMSTVRQ1FRRnFRZi8vQTNFa2xBSUxRUVFMZ2dJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFFY0VRQ0FBUWNFQVJnMEJBa0FnQUVIQ0FHc09EZ01FQlFZSENBa1JDZ3NNRFE0UEFBc01Ed3NNRHdzampRSWtqQUlNRGdzampnSWtqQUlNRFFzamp3SWtqQUlNREFzamtBSWtqQUlNQ3dzamtRSWtqQUlNQ2dzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRkIvd0Z4Skl3Q0RBa0xJNHNDSkl3Q0RBZ0xJNHdDSkkwQ0RBY0xJNDRDSkkwQ0RBWUxJNDhDSkkwQ0RBVUxJNUFDSkkwQ0RBUUxJNUVDSkkwQ0RBTUxJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFSTRCUWY4QmNTU05BZ3dDQ3lPTEFpU05BZ3dCQzBGL0R3dEJCQXY5QVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQUVjRVFDQUFRZEVBUmcwQkFrQWdBRUhTQUdzT0RoQURCQVVHQndnSkNoQUxEQTBPQUFzTURnc2pqQUlramdJTURnc2pqUUlramdJTURRc2pqd0lramdJTURBc2prQUlramdJTUN3c2prUUlramdJTUNnc2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0ZCL3dGeEpJNENEQWtMSTRzQ0pJNENEQWdMSTR3Q0pJOENEQWNMSTQwQ0pJOENEQVlMSTQ0Q0pJOENEQVVMSTVBQ0pJOENEQVFMSTVFQ0pJOENEQU1MSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5RUk0QlFmOEJjU1NQQWd3Q0N5T0xBaVNQQWd3QkMwRi9Ed3RCQkF2OUFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIZ0FFY0VRQ0FBUWVFQVJnMEJBa0FnQUVIaUFHc09EZ01FRUFVR0J3Z0pDZ3NNRUEwT0FBc01EZ3NqakFJa2tBSU1EZ3NqalFJa2tBSU1EUXNqamdJa2tBSU1EQXNqandJa2tBSU1Dd3Nqa1FJa2tBSU1DZ3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRamdGQi93RnhKSkFDREFrTEk0c0NKSkFDREFnTEk0d0NKSkVDREFjTEk0MENKSkVDREFZTEk0NENKSkVDREFVTEk0OENKSkVDREFRTEk1QUNKSkVDREFNTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJNEJRZjhCY1NTUkFnd0NDeU9MQWlTUkFnd0JDMEYvRHd0QkJBdWJBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFBUndSQUlBQkI4UUJHRFFFQ1FDQUFRZklBYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEVBQ3d3UEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT01BaENFQVF3UEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT05BaENFQVF3T0N5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT09BaENFQVF3TkN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT1BBaENFQVF3TUN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT1FBaENFQVF3TEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT1JBaENFQVF3S0N5T0NBa1VFUUFKQUk3Z0JCRUJCQVNTV0Fnd0JDeU82QVNQQUFYRkJIM0ZGQkVCQkFTU1hBZ3dCQzBFQkpKZ0NDd3NNQ1FzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJaml3SVFoQUVNQ0FzampBSWtpd0lNQndzampRSWtpd0lNQmdzampnSWtpd0lNQlFzamp3SWtpd0lNQkFzamtBSWtpd0lNQXdzamtRSWtpd0lNQWdzamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJUWpnRkIvd0Z4SklzQ0RBRUxRWDhQQzBFRUN6Y0JBWDhnQVVFQVRnUkFJQUJCL3dGeElBQWdBV3BCL3dGeFN4Q0tBUVVnQVVFZmRTSUNJQUVnQW1weklBQkIvd0Z4U2hDS0FRc0xOQUVDZnlPTEFpSUJJQUJCL3dGeElnSVFod0VnQVNBQ0VKY0JJQUFnQVdwQi93RnhJZ0FraXdJZ0FFVVFpQUZCQUJDSkFRdFlBUUovSTRzQ0lnRWdBR29qa2dKQkJIWkJBWEZxUWY4QmNTSUNJQUFnQVhOelFSQnhRUUJIRUlZQklBQkIvd0Z4SUFGcUk1SUNRUVIyUVFGeGFrR0FBbkZCQUVzUWlnRWdBaVNMQWlBQ1JSQ0lBVUVBRUlrQkM0c0NBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdBQVVjRVFDQUFRWUVCUmcwQkFrQWdBRUdDQVdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pqQUlRbUFFTUVBc2pqUUlRbUFFTUR3c2pqZ0lRbUFFTURnc2pqd0lRbUFFTURRc2prQUlRbUFFTURBc2prUUlRbUFFTUN3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRbUFFTUNnc2ppd0lRbUFFTUNRc2pqQUlRbVFFTUNBc2pqUUlRbVFFTUJ3c2pqZ0lRbVFFTUJnc2pqd0lRbVFFTUJRc2prQUlRbVFFTUJBc2prUUlRbVFFTUF3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRbVFFTUFnc2ppd0lRbVFFTUFRdEJmdzhMUVFRTE53RUNmeU9MQWlJQklBQkIvd0Z4UVg5c0lnSVFod0VnQVNBQ0VKY0JJQUVnQUd0Qi93RnhJZ0FraXdJZ0FFVVFpQUZCQVJDSkFRdFlBUUovSTRzQ0lnRWdBR3Nqa2dKQkJIWkJBWEZyUWY4QmNTSUNJQUFnQVhOelFSQnhRUUJIRUlZQklBRWdBRUgvQVhGckk1SUNRUVIyUVFGeGEwR0FBbkZCQUVzUWlnRWdBaVNMQWlBQ1JSQ0lBVUVCRUlrQkM0c0NBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdRQVVjRVFDQUFRWkVCUmcwQkFrQWdBRUdTQVdzT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2pqQUlRbXdFTUVBc2pqUUlRbXdFTUR3c2pqZ0lRbXdFTURnc2pqd0lRbXdFTURRc2prQUlRbXdFTURBc2prUUlRbXdFTUN3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRbXdFTUNnc2ppd0lRbXdFTUNRc2pqQUlRbkFFTUNBc2pqUUlRbkFFTUJ3c2pqZ0lRbkFFTUJnc2pqd0lRbkFFTUJRc2prQUlRbkFFTUJBc2prUUlRbkFFTUF3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VRbkFFTUFnc2ppd0lRbkFFTUFRdEJmdzhMUVFRTElnQWppd0lnQUhFaUFDU0xBaUFBUlJDSUFVRUFFSWtCUVFFUWhnRkJBQkNLQVFzbUFDT0xBaUFBYzBIL0FYRWlBQ1NMQWlBQVJSQ0lBVUVBRUlrQlFRQVFoZ0ZCQUJDS0FRdUxBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCb0FGSEJFQWdBRUdoQVVZTkFRSkFJQUJCb2dGckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJNHdDRUo0QkRCQUxJNDBDRUo0QkRBOExJNDRDRUo0QkRBNExJNDhDRUo0QkRBMExJNUFDRUo0QkRBd0xJNUVDRUo0QkRBc0xJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFSTRCRUo0QkRBb0xJNHNDRUo0QkRBa0xJNHdDRUo4QkRBZ0xJNDBDRUo4QkRBY0xJNDRDRUo4QkRBWUxJNDhDRUo4QkRBVUxJNUFDRUo4QkRBUUxJNUVDRUo4QkRBTUxJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFSTRCRUo4QkRBSUxJNHNDRUo4QkRBRUxRWDhQQzBFRUN5WUFJNHNDSUFCeVFmOEJjU0lBSklzQ0lBQkZFSWdCUVFBUWlRRkJBQkNHQVVFQUVJb0JDeXdCQVg4aml3SWlBU0FBUWY4QmNVRi9iQ0lBRUljQklBRWdBQkNYQVNBQUlBRnFSUkNJQVVFQkVJa0JDNHNDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHd0FVY0VRQ0FBUWJFQlJnMEJBa0FnQUVHeUFXc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqakFJUW9RRU1FQXNqalFJUW9RRU1Ed3NqamdJUW9RRU1EZ3NqandJUW9RRU1EUXNqa0FJUW9RRU1EQXNqa1FJUW9RRU1Dd3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRamdFUW9RRU1DZ3NqaXdJUW9RRU1DUXNqakFJUW9nRU1DQXNqalFJUW9nRU1Cd3NqamdJUW9nRU1CZ3NqandJUW9nRU1CUXNqa0FJUW9nRU1CQXNqa1FJUW9nRU1Bd3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRamdFUW9nRU1BZ3NqaXdJUW9nRU1BUXRCZnc4TFFRUUxPd0VCZnlBQUVGc2lBVUYvUmdSL0lBQVFBZ1VnQVF0Qi93RnhJQUJCQVdvaUFSQmJJZ0JCZjBZRWZ5QUJFQUlGSUFBTFFmOEJjVUVJZEhJTERBQkJDQkNCQVNBQUVLUUJDelFBSUFCQmdBRnhRWUFCUmhDS0FTQUFRUUYwSUFCQi93RnhRUWQyY2tIL0FYRWlBRVVRaUFGQkFCQ0pBVUVBRUlZQklBQUxNZ0FnQUVFQmNVRUFTeENLQVNBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFaUFFVVFpQUZCQUJDSkFVRUFFSVlCSUFBTE9BRUJmeU9TQWtFRWRrRUJjU0FBUVFGMGNrSC9BWEVoQVNBQVFZQUJjVUdBQVVZUWlnRWdBVVVRaUFGQkFCQ0pBVUVBRUlZQklBRUxPUUVCZnlPU0FrRUVka0VCY1VFSGRDQUFRZjhCY1VFQmRuSWhBU0FBUVFGeFFRRkdFSW9CSUFGRkVJZ0JRUUFRaVFGQkFCQ0dBU0FCQ3lvQUlBQkJnQUZ4UVlBQlJoQ0tBU0FBUVFGMFFmOEJjU0lBUlJDSUFVRUFFSWtCUVFBUWhnRWdBQXM5QVFGL0lBQkIvd0Z4UVFGMklnRkJnQUZ5SUFFZ0FFR0FBWEZCZ0FGR0d5SUJSUkNJQVVFQUVJa0JRUUFRaGdFZ0FFRUJjVUVCUmhDS0FTQUJDeXNBSUFCQkQzRkJCSFFnQUVId0FYRkJCSFp5SWdCRkVJZ0JRUUFRaVFGQkFCQ0dBVUVBRUlvQklBQUxLZ0VCZnlBQVFmOEJjVUVCZGlJQlJSQ0lBVUVBRUlrQlFRQVFoZ0VnQUVFQmNVRUJSaENLQVNBQkN4NEFRUUVnQUhRZ0FYRkIvd0Z4UlJDSUFVRUFFSWtCUVFFUWhnRWdBUXZOQ0FFRmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRUhjU0lFQkVBZ0JFRUJSZzBCQWtBZ0JFRUNhdzRHQXdRRkJnY0lBQXNNQ0FzampBSWhBUXdIQ3lPTkFpRUJEQVlMSTQ0Q0lRRU1CUXNqandJaEFRd0VDeU9RQWlFQkRBTUxJNUVDSVFFTUFnc2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFqZ0VoQVF3QkN5T0xBaUVCQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGeFFRUjFJZ1VFUUNBRlFRRkdEUUVDUUNBRlFRSnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSUFCQkIwd0VmeUFCRUtZQklRSkJBUVVnQUVFUFRBUi9JQUVRcHdFaEFrRUJCVUVBQ3dzaEF3d1BDeUFBUVJkTUJIOGdBUkNvQVNFQ1FRRUZJQUJCSDB3RWZ5QUJFS2tCSVFKQkFRVkJBQXNMSVFNTURnc2dBRUVuVEFSL0lBRVFxZ0VoQWtFQkJTQUFRUzlNQkg4Z0FSQ3JBU0VDUVFFRlFRQUxDeUVEREEwTElBQkJOMHdFZnlBQkVLd0JJUUpCQVFVZ0FFRS9UQVIvSUFFUXJRRWhBa0VCQlVFQUN3c2hBd3dNQ3lBQVFjY0FUQVIvUVFBZ0FSQ3VBU0VDUVFFRklBQkJ6d0JNQkg5QkFTQUJFSzRCSVFKQkFRVkJBQXNMSVFNTUN3c2dBRUhYQUV3RWYwRUNJQUVRcmdFaEFrRUJCU0FBUWQ4QVRBUi9RUU1nQVJDdUFTRUNRUUVGUVFBTEN5RUREQW9MSUFCQjV3Qk1CSDlCQkNBQkVLNEJJUUpCQVFVZ0FFSHZBRXdFZjBFRklBRVFyZ0VoQWtFQkJVRUFDd3NoQXd3SkN5QUFRZmNBVEFSL1FRWWdBUkN1QVNFQ1FRRUZJQUJCL3dCTUJIOUJCeUFCRUs0QklRSkJBUVZCQUFzTElRTU1DQXNnQUVHSEFVd0VmeUFCUVg1eElRSkJBUVVnQUVHUEFVd0VmeUFCUVgxeElRSkJBUVZCQUFzTElRTU1Cd3NnQUVHWEFVd0VmeUFCUVh0eElRSkJBUVVnQUVHZkFVd0VmeUFCUVhkeElRSkJBUVZCQUFzTElRTU1CZ3NnQUVHbkFVd0VmeUFCUVc5eElRSkJBUVVnQUVHdkFVd0VmeUFCUVY5eElRSkJBUVZCQUFzTElRTU1CUXNnQUVHM0FVd0VmeUFCUWI5L2NTRUNRUUVGSUFCQnZ3Rk1CSDhnQVVIL2ZuRWhBa0VCQlVFQUN3c2hBd3dFQ3lBQVFjY0JUQVIvSUFGQkFYSWhBa0VCQlNBQVFjOEJUQVIvSUFGQkFuSWhBa0VCQlVFQUN3c2hBd3dEQ3lBQVFkY0JUQVIvSUFGQkJISWhBa0VCQlNBQVFkOEJUQVIvSUFGQkNISWhBa0VCQlVFQUN3c2hBd3dDQ3lBQVFlY0JUQVIvSUFGQkVISWhBa0VCQlNBQVFlOEJUQVIvSUFGQklISWhBa0VCQlVFQUN3c2hBd3dCQ3lBQVFmY0JUQVIvSUFGQndBQnlJUUpCQVFVZ0FFSC9BVXdFZnlBQlFZQUJjaUVDUVFFRlFRQUxDeUVEQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQkFSQUlBUkJBVVlOQVFKQUlBUkJBbXNPQmdNRUJRWUhDQUFMREFnTElBSWtqQUlNQndzZ0FpU05BZ3dHQ3lBQ0pJNENEQVVMSUFJa2p3SU1CQXNnQWlTUUFnd0RDeUFDSkpFQ0RBSUxJQVZCQkVnaUFBUi9JQUFGSUFWQkIwb0xCRUFqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElnQWhDRUFRc01BUXNnQWlTTEFndEJCRUYvSUFNYkM3c0VBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSEFBVWNFUUNBQVFjRUJSZzBCQWtBZ0FFSENBV3NPRGdNU0JBVUdCd2dKQ2dzTUVRME9BQXNNRGdzamtnSkJCM1pCQVhFTkVRd09DeU9UQWhDbEFVSC8vd054SVFBamt3SkJBbXBCLy84RGNTU1RBaUFBUVlEK0EzRkJDSFVrakFJZ0FFSC9BWEVralFKQkJBOExJNUlDUVFkMlFRRnhEUkVNRGdzamtnSkJCM1pCQVhFTkVBd01DeU9UQWtFQ2EwSC8vd054SWdBa2t3SWdBQ09OQWtIL0FYRWpqQUpCL3dGeFFRaDBjaENNQVF3TkN4Q0NBUkNZQVF3TkN5T1RBa0VDYTBILy93TnhJZ0Fra3dJZ0FDT1VBaENNQVVFQUpKUUNEQXNMSTVJQ1FRZDJRUUZ4UVFGSERRb01Cd3Nqa3dJaUFCQ2xBVUgvL3dOeEpKUUNJQUJCQW1wQi8vOERjU1NUQWd3SkN5T1NBa0VIZGtFQmNVRUJSZzBIREFvTEVJSUJRZjhCY1JDdkFTRUFJNVFDUVFGcVFmLy9BM0VrbEFJZ0FBOExJNUlDUVFkMlFRRnhRUUZIRFFnamt3SkJBbXRCLy84RGNTSUFKSk1DSUFBamxBSkJBbXBCLy84RGNSQ01BUXdGQ3hDQ0FSQ1pBUXdHQ3lPVEFrRUNhMEgvL3dOeElnQWtrd0lnQUNPVUFoQ01BVUVJSkpRQ0RBUUxRWDhQQ3lPVEFpSUFFS1VCUWYvL0EzRWtsQUlnQUVFQ2FrSC8vd054SkpNQ1FRd1BDeU9UQWtFQ2EwSC8vd054SWdBa2t3SWdBQ09VQWtFQ2FrSC8vd054RUl3QkN4Q0RBVUgvL3dOeEpKUUNDMEVJRHdzamxBSkJBV3BCLy84RGNTU1VBa0VFRHdzamxBSkJBbXBCLy84RGNTU1VBa0VNQzZBRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGSEJFQWdBRUhSQVVZTkFRSkFJQUJCMGdGckRnNERBQVFGQmdjSUNRb0FDd0FNRFFBTERBMExJNUlDUVFSMlFRRnhEUThNRFFzamt3SWlBUkNsQVVILy93TnhJUUFnQVVFQ2FrSC8vd054SkpNQ0lBQkJnUDREY1VFSWRTU09BaUFBUWY4QmNTU1BBa0VFRHdzamtnSkJCSFpCQVhFTkR3d01DeU9TQWtFRWRrRUJjUTBPSTVNQ1FRSnJRZi8vQTNFaUFDU1RBaUFBSTVRQ1FRSnFRZi8vQTNFUWpBRU1Dd3Nqa3dKQkFtdEIvLzhEY1NJQUpKTUNJQUFqandKQi93RnhJNDRDUWY4QmNVRUlkSElRakFFTUN3c1FnZ0VRbXdFTUN3c2prd0pCQW10Qi8vOERjU0lBSkpNQ0lBQWpsQUlRakFGQkVDU1VBZ3dKQ3lPU0FrRUVka0VCY1VFQlJ3MElEQVlMSTVNQ0lnQVFwUUZCLy84RGNTU1VBa0VCSkxrQklBQkJBbXBCLy84RGNTU1RBZ3dIQ3lPU0FrRUVka0VCY1VFQlJnMEZEQWdMSTVJQ1FRUjJRUUZ4UVFGSERRY2prd0pCQW10Qi8vOERjU0lBSkpNQ0lBQWpsQUpCQW1wQi8vOERjUkNNQVF3RUN4Q0NBUkNjQVF3RkN5T1RBa0VDYTBILy93TnhJZ0Fra3dJZ0FDT1VBaENNQVVFWUpKUUNEQU1MUVg4UEN5T1RBaUlBRUtVQlFmLy9BM0VrbEFJZ0FFRUNha0gvL3dOeEpKTUNRUXdQQ3hDREFVSC8vd054SkpRQ0MwRUlEd3NqbEFKQkFXcEIvLzhEY1NTVUFrRUVEd3NqbEFKQkFtcEIvLzhEY1NTVUFrRU1DN0VEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFVWU5BUUpBSUFCQjRnRnJEZzREQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRUlJQlFmOEJjVUdBL2dOcUk0c0NFSVFCREFzTEk1TUNJZ0VRcFFGQi8vOERjU0VBSUFGQkFtcEIvLzhEY1NTVEFpQUFRWUQrQTNGQkNIVWtrQUlnQUVIL0FYRWtrUUpCQkE4TEk0MENRWUQrQTJvaml3SVFoQUZCQkE4TEk1TUNRUUpyUWYvL0EzRWlBQ1NUQWlBQUk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVJd0JRUWdQQ3hDQ0FSQ2VBUXdIQ3lPVEFrRUNhMEgvL3dOeElnQWtrd0lnQUNPVUFoQ01BVUVnSkpRQ1FRZ1BDeENDQVVFWWRFRVlkU0VBSTVNQ0lBQkJBUkNOQVNPVEFpQUFha0gvL3dOeEpKTUNRUUFRaUFGQkFCQ0pBU09VQWtFQmFrSC8vd054SkpRQ1FRd1BDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBjaVNVQWtFRUR3c1Fnd0ZCLy84RGNTT0xBaENFQVNPVUFrRUNha0gvL3dOeEpKUUNRUVFQQ3hDQ0FSQ2ZBUXdDQ3lPVEFrRUNhMEgvL3dOeElnQWtrd0lnQUNPVUFoQ01BVUVvSkpRQ1FRZ1BDMEYvRHdzamxBSkJBV3BCLy84RGNTU1VBa0VFQytjREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFnQUVIeEFVWU5BUUpBSUFCQjhnRnJEZzREQkFBRkJnY0lDUW9MQUFBTURRQUxEQTBMRUlJQlFmOEJjVUdBL2dOcUVJNEJRZjhCY1NTTEFnd05DeU9UQWlJQkVLVUJRZi8vQTNFaEFDQUJRUUpxUWYvL0EzRWtrd0lnQUVHQS9nTnhRUWgxSklzQ0lBQkIvd0Z4SkpJQ0RBMExJNDBDUVlEK0Eyb1FqZ0ZCL3dGeEpJc0NEQXdMUVFBa3VBRU1Dd3Nqa3dKQkFtdEIvLzhEY1NJQUpKTUNJQUFqa2dKQi93RnhJNHNDUWY4QmNVRUlkSElRakFGQkNBOExFSUlCRUtFQkRBZ0xJNU1DUVFKclFmLy9BM0VpQUNTVEFpQUFJNVFDRUl3QlFUQWtsQUpCQ0E4TEVJSUJRUmgwUVJoMUlRQWprd0loQVVFQUVJZ0JRUUFRaVFFZ0FTQUFRUUVRalFFZ0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTU1FBaUFBUWY4QmNTU1JBaU9VQWtFQmFrSC8vd054SkpRQ1FRZ1BDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBjaVNUQWtFSUR3c1Fnd0ZCLy84RGNSQ09BVUgvQVhFa2l3SWpsQUpCQW1wQi8vOERjU1NVQWd3RkMwRUJKTGtCREFRTEVJSUJFS0lCREFJTEk1TUNRUUpyUWYvL0EzRWlBQ1NUQWlBQUk1UUNFSXdCUVRna2xBSkJDQThMUVg4UEN5T1VBa0VCYWtILy93TnhKSlFDQzBFRUM5Z0JBUUYvSTVRQ1FRRnFRZi8vQTNFaEFTT1lBZ1JBSUFGQkFXdEIvLzhEY1NFQkN5QUJKSlFDQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGckRnNEJBZ01FQlFZSENBa0tDd3dORGc4TElBQVFqd0VQQ3lBQUVKQUJEd3NnQUJDUkFROExJQUFRa2dFUEN5QUFFSk1CRHdzZ0FCQ1VBUThMSUFBUWxRRVBDeUFBRUpZQkR3c2dBQkNhQVE4TElBQVFuUUVQQ3lBQUVLQUJEd3NnQUJDakFROExJQUFRc0FFUEN5QUFFTEVCRHdzZ0FCQ3lBUThMSUFBUXN3RUx2Z0VCQW45QkFDUzRBVUdQL2dNUUFrRUJJQUIwUVg5emNTSUJKTUFCUVkvK0F5QUJFQVFqa3dKQkFtdEIvLzhEY1NTVEFpT1RBaUlCSTVRQ0lnSkIvd0Z4RUFRZ0FVRUJhaUFDUVlEK0EzRkJDSFVRQkFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0F3TUVCUUFMREFVTFFRQWt3UUZCd0FBa2xBSU1CQXRCQUNUQ0FVSElBQ1NVQWd3REMwRUFKTU1CUWRBQUpKUUNEQUlMUVFBa3hBRkIyQUFrbEFJTUFRdEJBQ1RGQVVIZ0FDU1VBZ3NMK1FFQkEzOGp1UUVFUUVFQkpMZ0JRUUFrdVFFTEk3b0JJOEFCY1VFZmNVRUFTZ1JBSTVjQ1JTTzRBU0lDSUFJYkJIOGp3UUVqdXdFaUFDQUFHd1IvUVFBUXRRRkJBUVVqd2dFanZBRWlBQ0FBR3dSL1FRRVF0UUZCQVFVand3RWp2UUVpQUNBQUd3Ui9RUUlRdFFGQkFRVWp4QUVqdmdFaUFDQUFHd1IvUVFNUXRRRkJBUVVqeFFFanZ3RWlBQ0FBR3dSL1FRUVF0UUZCQVFWQkFBc0xDd3NMQlVFQUN3UkFJNVlDSWdBamx3SWdBQnNFZjBFQUpKY0NRUUFrbGdKQkFDU1lBa0VBSkprQ1FSZ0ZRUlFMSVFFTEk1WUNJZ0FqbHdJZ0FCc0VRRUVBSkpjQ1FRQWtsZ0pCQUNTWUFrRUFKSmtDQ3lBQkR3dEJBQXUrQVFFQ2YwRUJKS01DSTVnQ0JFQWpsQUlRQWtIL0FYRVF0QUVRZ1FGQkFDU1hBa0VBSkpZQ1FRQWttQUpCQUNTWkFnc1F0Z0VpQUVFQVNnUkFJQUFRZ1FFTFFRUWhBQ09XQWlJQkk1Y0NJQUViUlNJQkJIOGptUUpGQlNBQkN3UkFJNVFDRUFKQi93RnhFTFFCSVFBTEk1SUNRZkFCY1NTU0FpQUFRUUJNQkVBZ0FBOExJQUFRZ1FFam53SkJBV29pQVNPZEFrNEVmeU9lQWtFQmFpU2VBaUFCSTUwQ2F3VWdBUXNrbndJamxBSWozZ0ZHQkVCQkFTVGhBUXNnQUFzRkFDTzJBUXZNQVFFRWZ5QUFRWDlCZ0FnZ0FFRUFTQnNnQUVFQVNoc2hBMEVBSVFBRFFBSi9BbjhnQkVVaUFRUkFJQUJGSVFFTElBRUxCRUFnQWtVaEFRc2dBUXNFUUNQaEFVVWhBUXNnQVFSQUVMY0JRUUJJQkVCQkFTRUVCU09WQWtIUXBBUWppZ0owVGdSQVFRRWhBQVVnQTBGL1NpSUJCRUFqdGdFZ0EwNGhBUXRCQVNBQ0lBRWJJUUlMQ3d3QkN3c2dBQVJBSTVVQ1FkQ2tCQ09LQW5SckpKVUNJNkFDRHdzZ0FnUkFJNkVDRHdzajRRRUVRRUVBSk9FQkk2SUNEd3NqbEFKQkFXdEIvLzhEY1NTVUFrRi9Dd2NBUVg4UXVRRUxPUUVEZndOQUlBSWdBRWdpQXdSL0lBRkJBRTRGSUFNTEJFQkJmeEM1QVNFQklBSkJBV29oQWd3QkN3c2dBVUVBU0FSQUlBRVBDMEVBQ3dVQUk1b0NDd1VBSTVzQ0N3VUFJNXdDQzFzQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCUmcwQkFrQWdBRUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2owd0VQQ3lQV0FROExJOVFCRHdzajFRRVBDeVBYQVE4TEk5Z0JEd3NqMlFFUEN5UGFBUThMUVFBTGh3RUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQlJnMEJBa0FnQUVFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQVVFQVJ5VFRBUXdIQ3lBQlFRQkhKTllCREFZTElBRkJBRWNrMUFFTUJRc2dBVUVBUnlUVkFRd0VDeUFCUVFCSEpOY0JEQU1MSUFGQkFFY2syQUVNQWdzZ0FVRUFSeVRaQVF3QkN5QUJRUUJISk5vQkN3dFZBUUYvUVFBa21RSWdBQkMvQVVVRVFFRUJJUUVMSUFCQkFSREFBU0FCQkVCQkFVRUJRUUJCQVVFQUlBQkJBMHdiSWdBajNBRWlBU0FCR3hzZ0FFVWozUUVpQUNBQUd4c0VRRUVCSk1VQlFRUVFQd3NMQ3drQUlBQkJBQkRBQVF1YUFRQWdBRUVBU2dSQVFRQVF3UUVGUVFBUXdnRUxJQUZCQUVvRVFFRUJFTUVCQlVFQkVNSUJDeUFDUVFCS0JFQkJBaERCQVFWQkFoRENBUXNnQTBFQVNnUkFRUU1Rd1FFRlFRTVF3Z0VMSUFSQkFFb0VRRUVFRU1FQkJVRUVFTUlCQ3lBRlFRQktCRUJCQlJEQkFRVkJCUkRDQVFzZ0JrRUFTZ1JBUVFZUXdRRUZRUVlRd2dFTElBZEJBRW9FUUVFSEVNRUJCVUVIRU1JQkN3c0hBQ0FBSk40QkN3Y0FRWDhrM2dFTEJ3QWdBQ1RmQVFzSEFFRi9KTjhCQ3djQUlBQWs0QUVMQndCQmZ5VGdBUXNGQUNPTEFnc0ZBQ09NQWdzRkFDT05BZ3NGQUNPT0Fnc0ZBQ09QQWdzRkFDT1FBZ3NGQUNPUkFnc0ZBQ09TQWdzRkFDT1VBZ3NGQUNPVEFnc0xBQ09VQWhBQ1FmOEJjUXNGQUNQdUFRdXZBd0VLZjBHQWdBSkJnSkFDSStjQkd5RUpRWUM0QWtHQXNBSWo2QUViSVFvRFFDQUZRWUFDU0FSQVFRQWhCQU5BSUFSQmdBSklCRUFnQ1NBRlFRTjFRUVYwSUFwcUlBUkJBM1ZxSWdKQmdKQithaTBBQUJBeUlRY2dCVUVJYnlFQlFRY2dCRUVJYjJzaEJrRUFJUU1DZnlBQVFRQktJNGtDSWdnZ0NCc0VRQ0FDUVlEUWZtb3RBQUFoQXdzZ0EwSEFBSEVMQkVCQkJ5QUJheUVCQzBFQUlRSWdBVUVCZENBSGFpSUhRWUNRZm1wQkFVRUFJQU5CQ0hFYklnSkJEWFJxTFFBQUlRaEJBQ0VCSUFkQmdaQithaUFDUVExMGFpMEFBRUVCSUFaMGNRUkFRUUloQVFzZ0FVRUJhaUFCUVFFZ0JuUWdDSEViSVFFZ0JVRUlkQ0FFYWtFRGJDRUNJQUJCQUVvamlRSWlCaUFHR3dSQUlBSkJnS0VMYWlJQ0lBTkJCM0VnQVVFQUVETWlBVUVmY1VFRGREb0FBQ0FDUVFGcUlBRkI0QWR4UVFWMVFRTjBPZ0FBSUFKQkFtb2dBVUdBK0FGeFFRcDFRUU4wT2dBQUJTQUNRWUNoQzJvaUF5QUJRY2YrQXhBMElnRkJnSUQ4QjNGQkVIVTZBQUFnQTBFQmFpQUJRWUQrQTNGQkNIVTZBQUFnQTBFQ2FpQUJPZ0FBQ3lBRVFRRnFJUVFNQVFzTElBVkJBV29oQlF3QkN3c0wyd01CREg4RFFDQUVRUmRPUlFSQVFRQWhBd05BSUFOQkgwZ0VRRUVCUVFBZ0EwRVBTaUlIR3lFSklBUkJEMnNnQkNBRVFROUtJZ0FiUVFSMElnVWdBMEVQYTJvZ0F5QUZhaUFIR3lFSVFZQ1FBa0dBZ0FJZ0FCc2hDa0hIL2dNaEIwRi9JUVpCZnlFRlFRQWhBUU5BSUFGQkNFZ0VRRUVBSVFBRFFDQUFRUVZJQkVBZ0FFRURkQ0FCYWtFQ2RDSUNRWUw4QTJvUUFpQUlSZ1JBSUFKQmcvd0RhaEFDSVFKQkFVRUFJQUpCQ0hGQkFFY2ppUUlqaVFJYkd5QUpSZ1JBUVFnaEFVRUZJUUFnQWlJRlFSQnhCSDlCeWY0REJVSEkvZ01MSVFjTEN5QUFRUUZxSVFBTUFRc0xJQUZCQVdvaEFRd0JDd3NnQlVFQVNDT0pBaUlBSUFBYkJFQkJnTGdDUVlDd0FpUG9BUnNoQzBGL0lRQkJBQ0VDQTBBZ0FrRWdTQVJBUVFBaEFRTkFJQUZCSUVnRVFDQUJRUVYwSUF0cUlBSnFJZ1pCZ0pCK2FpMEFBQ0FJUmdSQVFTQWhBa0VnSVFFZ0JpRUFDeUFCUVFGcUlRRU1BUXNMSUFKQkFXb2hBZ3dCQ3dzZ0FFRUFUZ1IvSUFCQmdOQithaTBBQUFWQmZ3c2hCZ3RCQUNFQUEwQWdBRUVJU0FSQUlBZ2dDaUFKUVFCQkJ5QUFJQU5CQTNRZ0JFRURkQ0FBYWtINEFVR0FvUmNnQnlBR0lBVVFOUm9nQUVFQmFpRUFEQUVMQ3lBRFFRRnFJUU1NQVFzTElBUkJBV29oQkF3QkN3c0xtZ0lCQ1g4RFFDQUVRUWhPUlFSQVFRQWhBUU5BSUFGQkJVZ0VRQ0FCUVFOMElBUnFRUUowSWdCQmdQd0RhaEFDR2lBQVFZSDhBMm9RQWhvZ0FFR0MvQU5xRUFJaEFrRUJJUVVqNlFFRVFDQUNRUUp2UVFGR0JFQWdBa0VCYXlFQ0MwRUNJUVVMSUFCQmcvd0RhaEFDSVFaQkFDRUhRUUZCQUNBR1FRaHhRUUJISTRrQ0k0a0NHeHNoQjBISS9nTWhDRUhKL2dOQnlQNERJQVpCRUhFYklRaEJBQ0VBQTBBZ0FDQUZTQVJBUVFBaEF3TkFJQU5CQ0VnRVFDQUFJQUpxUVlDQUFpQUhRUUJCQnlBRElBUkJBM1FnQVVFRWRDQURhaUFBUVFOMGFrSEFBRUdBb1NBZ0NFRi9JQVlRTlJvZ0EwRUJhaUVEREFFTEN5QUFRUUZxSVFBTUFRc0xJQUZCQVdvaEFRd0JDd3NnQkVFQmFpRUVEQUVMQ3dzRkFDUEhBUXNGQUNQSUFRc0ZBQ1BMQVFzWUFRRi9JODBCSVFBanpBRUVRQ0FBUVFSeUlRQUxJQUFMTUFFQmZ3TkFBa0FnQUVILy93Tk9EUUFnQUVHQXRja0VhaUFBRUZ3NkFBQWdBRUVCYWlFQURBRUxDMEVBSk9FQkN4WUFFQUEvQUVHVUFVZ0VRRUdVQVQ4QWEwQUFHZ3NMQXdBQkN4MEFBa0FDUUFKQUk2UUNEZ0lCQWdBTEFBdEJBQ0VBQ3lBQUVMa0JDd2NBSUFBa3BBSUxKUUFDUUFKQUFrQUNRQ09rQWc0REFRSURBQXNBQzBFQklRQUxRWDhoQVFzZ0FSQzVBUXNBTXhCemIzVnlZMlZOWVhCd2FXNW5WVkpNSVdOdmNtVXZaR2x6ZEM5amIzSmxMblZ1ZEc5MVkyaGxaQzUzWVhOdExtMWhjQT09IikpLmluc3RhbmNlOwpjb25zdCBiPW5ldyBVaW50OEFycmF5KGEuZXhwb3J0cy5tZW1vcnkuYnVmZmVyKTtyZXR1cm57aW5zdGFuY2U6YSxieXRlTWVtb3J5OmIsdHlwZToiV2ViIEFzc2VtYmx5In19O2xldCByLHUsRSxjO2M9e2dyYXBoaWNzV29ya2VyUG9ydDp2b2lkIDAsbWVtb3J5V29ya2VyUG9ydDp2b2lkIDAsY29udHJvbGxlcldvcmtlclBvcnQ6dm9pZCAwLGF1ZGlvV29ya2VyUG9ydDp2b2lkIDAsd2FzbUluc3RhbmNlOnZvaWQgMCx3YXNtQnl0ZU1lbW9yeTp2b2lkIDAsb3B0aW9uczp2b2lkIDAsV0FTTUJPWV9CT09UX1JPTV9MT0NBVElPTjowLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjowLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOjAsCldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU6MCxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTjowLHBhdXNlZDohMCx1cGRhdGVJZDp2b2lkIDAsdGltZVN0YW1wc1VudGlsUmVhZHk6MCxmcHNUaW1lU3RhbXBzOltdLHNwZWVkOjAsZnJhbWVTa2lwQ291bnRlcjowLGN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjooYSk9Pntjb25zdCBiPW4oYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPwooYy5ncmFwaGljc1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoSi5iaW5kKHZvaWQgMCxjKSxjLmdyYXBoaWNzV29ya2VyUG9ydCkpOiJNRU1PUlkiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLm1lbW9yeVdvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoTS5iaW5kKHZvaWQgMCxjKSxjLm1lbW9yeVdvcmtlclBvcnQpKToiQ09OVFJPTExFUiI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGMuY29udHJvbGxlcldvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLHEoTC5iaW5kKHZvaWQgMCxjKSxjLmNvbnRyb2xsZXJXb3JrZXJQb3J0KSk6IkFVRElPIj09PWIubWVzc2FnZS53b3JrZXJJZCYmKGMuYXVkaW9Xb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEsuYmluZCh2b2lkIDAsYyksYy5hdWRpb1dvcmtlclBvcnQpKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLklOU1RBTlRJQVRFX1dBU006KGFzeW5jKCk9PntsZXQgYTthPWF3YWl0IFAocCk7CmMud2FzbUluc3RhbmNlPWEuaW5zdGFuY2U7Yy53YXNtQnl0ZU1lbW9yeT1hLmJ5dGVNZW1vcnk7ayhoKHt0eXBlOmEudHlwZX0sYi5tZXNzYWdlSWQpKX0pKCk7YnJlYWs7Y2FzZSBmLkNPTkZJRzpjLndhc21JbnN0YW5jZS5leHBvcnRzLmNvbmZpZy5hcHBseShjLGIubWVzc2FnZS5jb25maWcpO2Mub3B0aW9ucz1iLm1lc3NhZ2Uub3B0aW9ucztrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlJFU0VUX0FVRElPX1FVRVVFOmMud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2soaCh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuUExBWTppZighYy5wYXVzZWR8fCFjLndhc21JbnN0YW5jZXx8IWMud2FzbUJ5dGVNZW1vcnkpe2soaCh7ZXJyb3I6ITB9LGIubWVzc2FnZUlkKSk7YnJlYWt9Yy5wYXVzZWQ9ITE7Yy5mcHNUaW1lU3RhbXBzPVtdO3coYyk7Yy5mcmFtZVNraXBDb3VudGVyPTA7Yy5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQowO2Mub3B0aW9ucy5pc0diY0NvbG9yaXphdGlvbkVuYWJsZWQ/Yy5vcHRpb25zLmdiY0NvbG9yaXphdGlvblBhbGV0dGUmJmMud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0TWFudWFsQ29sb3JpemF0aW9uUGFsZXR0ZSgid2FzbWJveWdiIGJyb3duIHJlZCBkYXJrYnJvd24gZ3JlZW4gZGFya2dyZWVuIGludmVydGVkIHBhc3RlbG1peCBvcmFuZ2UgeWVsbG93IGJsdWUgZGFya2JsdWUgZ3JheXNjYWxlIi5zcGxpdCgiICIpLmluZGV4T2YoYy5vcHRpb25zLmdiY0NvbG9yaXphdGlvblBhbGV0dGUudG9Mb3dlckNhc2UoKSkpOmMud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0TWFudWFsQ29sb3JpemF0aW9uUGFsZXR0ZSgwKTtGKGMsMUUzL2Mub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBBVVNFOmMucGF1c2VkPSEwO2MudXBkYXRlSWQmJihjbGVhclRpbWVvdXQoYy51cGRhdGVJZCksYy51cGRhdGVJZD12b2lkIDApO2soaCh2b2lkIDAsCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP2Mud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOnthPTA7bGV0IGQ9Yy53YXNtQnl0ZU1lbW9yeS5sZW5ndGg7Yi5tZXNzYWdlLnN0YXJ0JiYoYT1iLm1lc3NhZ2Uuc3RhcnQpO2IubWVzc2FnZS5lbmQmJihkPWIubWVzc2FnZS5lbmQpO2E9Yy53YXNtQnl0ZU1lbW9yeS5zbGljZShhLGQpLmJ1ZmZlcjtrKGgoe3R5cGU6Zi5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSBmLkdFVF9XQVNNX0NPTlNUQU5UOmsoaCh7dHlwZTpmLkdFVF9XQVNNX0NPTlNUQU5ULApyZXNwb25zZTpjLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5GT1JDRV9PVVRQVVRfRlJBTUU6QyhjKTticmVhaztjYXNlIGYuU0VUX1NQRUVEOmMuc3BlZWQ9Yi5tZXNzYWdlLnNwZWVkO2MuZnBzVGltZVN0YW1wcz1bXTtjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTYwO3coYyk7Yy5mcmFtZVNraXBDb3VudGVyPTA7Yy5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCk7YnJlYWs7Y2FzZSBmLklTX0dCQzphPTA8Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5pc0dCQygpO2soaCh7dHlwZTpmLklTX0dCQyxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coIlVua25vd24gV2FzbUJveSBXb3JrZXIgbWVzc2FnZToiLGIpfX0sZ2V0RlBTOigpPT4wPGMudGltZVN0YW1wc1VudGlsUmVhZHk/CmMuc3BlZWQmJjA8Yy5zcGVlZD9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSpjLnNwZWVkOmMub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlOmMuZnBzVGltZVN0YW1wcz9jLmZwc1RpbWVTdGFtcHMubGVuZ3RoOjB9O3EoYy5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

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

      WasmBoyPlugins.runHook({
        key: 'ready'
      });
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

      WasmBoyPlugins.runHook({
        key: 'ready'
      });
    }
  };

  return loadROMTask();
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

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

          WasmBoyPlugins.runHook({
            key: 'breakpoint'
          });
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
      WasmBoyPlugins.runHook({
        key: 'setCanvas',
        params: [this.canvasElement]
      });
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

        WasmBoyPlugins.runHook({
          key: 'loadedAndStarted'
        });
      }

      if (this.options.onPlay) {
        this.options.onPlay();
      }

      WasmBoyPlugins.runHook({
        key: 'play'
      }); // Bless the audio, this is to fix any autoplay issues

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
      }

      WasmBoyPlugins.runHook({
        key: 'pause'
      }); // Cancel our update and render loop

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
var version = "0.4.0";
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
	"core:build:asc": "npx asc core/index.ts -b dist/core/core.untouched.wasm -t dist/core/core.untouched.wat -O3 --validate --sourceMap core/dist/core.untouched.wasm.map --memoryBase 0",
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
  addPlugin: WasmBoyPlugins.addPlugin.bind(WasmBoyPlugins),
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
