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
  canvas: (canvasElement, canvasContext, canvasImageData) => {},
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
      this.canvasImageData = this.canvasContext.createImageData(this.canvasElement.width, this.canvasElement.height); // Add some css for smooth 8-bit canvas scaling
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

      this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height); // Doing set canvas here, as multiple sources can re-initialize the graphics
      // TODO: Move setCanvas out of initialize :p

      WasmBoyPlugins.runHook({
        key: 'canvas',
        params: [this.canvasElement, this.canvasContext, this.canvasImageData],
        callback: response => {
          if (!response) {
            return;
          }

          if (response.canvasElement) {
            this.canvasElement = response.canvasElement;
          }

          if (response.canvasContext) {
            this.canvasContext = response.canvasContext;
          }

          if (response.canvasImageData) {
            this.canvasImageData = response.canvasImageData;
          }
        }
      }); // Finally make sure we set our constants for our worker

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
      params: [this.imageDataArray],
      callback: response => {
        if (response) {
          this.imageDataArray = response;
        }
      }
    }); // Add our new imageData

    this.canvasImageData.data.set(this.imageDataArray);
    this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
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

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    if (i % 2) {
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
    } else {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(arguments[i]));
    }
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

    const bootROMObject = _objectSpread2({
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

    await this.worker.postMessage(_objectSpread2({
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

      await this.worker.postMessage(_objectSpread2({
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
      cartridgeObject.cartridgeRom = _objectSpread2({
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
      await this.worker.postMessage(_objectSpread2({
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
      await this.worker.postMessage(_objectSpread2({
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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBKKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX0xPQ0FUSU9OLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBLKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkFVRElPX0xBVEVOQ1k6YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQpiLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gTChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gQShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTisKZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQihhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIE0oYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhaztjYXNlIGYuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfQk9PVF9ST01fTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JBTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfTE9DQVRJT04udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlNFVF9NRU1PUlk6ZD1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2QuaW5jbHVkZXMoZy5CT09UX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkJPT1RfUk9NXSksYS5XQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSxhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9SQU0pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUkFNXSksYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuR0FNRUJPWV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5HQU1FQk9ZX01FTU9SWV0pLAphLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OKSxhLndhc21JbnN0YW5jZS5leHBvcnRzLmxvYWRTdGF0ZSgpKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLlNFVF9NRU1PUllfRE9ORX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX01FTU9SWTp7ZD17dHlwZTpmLkdFVF9NRU1PUll9O2NvbnN0IGw9W107dmFyIGM9Yi5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKGMuaW5jbHVkZXMoZy5CT09UX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX0xPQ0FUSU9OLnZhbHVlT2YoKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlK2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fU0laRS52YWx1ZU9mKCkpfWVsc2UgZT1uZXcgVWludDhBcnJheTtlPWUuYnVmZmVyO2RbZy5CT09UX1JPTV09ZTtsLnB1c2goZSl9aWYoYy5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXtlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD1lJiYzPj1lP209MjA5NzE1Mjo1PD1lJiY2Pj1lP209MjYyMTQ0OjE1PD1lJiYxOT49ZT9tPTIwOTcxNTI6MjU8PWUmJjMwPj1lJiYobT04Mzg4NjA4KTtlPW0/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTittKToKbmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGU9QShhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmRbZy5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9QihhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT1jLGwucHVzaChjKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCxiLm1lc3NhZ2VJZCksbCl9fX1mdW5jdGlvbiBOKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpOwphLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB3KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEMoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gRChhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUUtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0YoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEYoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRT1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksRChhKSwhMDtOKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZDtjP3goYSxiKTooZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLApiKGQpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEMoYSk7Y29uc3QgZD17dHlwZTpmLlVQREFURUR9O2RbZy5DQVJUUklER0VfUkFNXT1BKGEpLmJ1ZmZlcjtkW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5JTlRFUk5BTF9TVEFURV09QihhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChkKSxbZFtnLkNBUlRSSURHRV9SQU1dLGRbZy5HQU1FQk9ZX01FTU9SWV0sZFtnLlBBTEVUVEVfTUVNT1JZXSxkW2cuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/ayhoKHt0eXBlOmYuQlJFQUtQT0lOVH0pKTpEKGEpfWVsc2UgayhoKHt0eXBlOmYuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHgoYSxiKXt2YXIgZD0tMTtkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbygxMDI0KTsxIT09ZCYmYihkKTtpZigxPT09ZCl7ZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXIoKTsKY29uc3QgYz1yPj11Oy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmM/KEcoYSxkKSxzZXRUaW1lb3V0KCgpPT57dyhhKTt4KGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooRyhhLGQpLHgoYSxiKSl9fWZ1bmN0aW9uIEcoYSxiKXt2YXIgZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjb25zdCBjPXt0eXBlOmYuVVBEQVRFRCxhdWRpb0J1ZmZlcjpkLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX07ZD1bZF07aWYoYS5vcHRpb25zJiZhLm9wdGlvbnMuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDFCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDJCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDNCdWZmZXI9ZTtkLnB1c2goZSk7Yj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDRCdWZmZXI9YjtkLnB1c2goYil9YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChjKSwKZCk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCl9Y29uc3QgcD0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCB2O3B8fCh2PXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgZj17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLApVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQiLEZPUkNFX09VVFBVVF9GUkFNRToiRk9SQ0VfT1VUUFVUX0ZSQU1FIixTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSxnPXtCT09UX1JPTToiQk9PVF9ST00iLENBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTsKbGV0IHQ9MCx5PXt9O2NvbnN0IEg9KGEsYik9PntsZXQgYz0iW1dhc21Cb3ldIjstOTk5OSE9PWEmJihjKz1gIDB4JHthLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1iJiYoYys9YCAweCR7Yi50b1N0cmluZygxNil9IGApO2NvbnNvbGUubG9nKGMpfSx6PXtpbmRleDp7Y29uc29sZUxvZzpILGNvbnNvbGVMb2dUaW1lb3V0OihhLGIsYyk9Pnt5W2FdfHwoeVthXT0hMCxIKGEsYiksc2V0VGltZW91dCgoKT0+e2RlbGV0ZSB5W2FdfSxjKSl9fSxlbnY6e2Fib3J0OigpPT57Y29uc29sZS5lcnJvcigiQXNzZW1ibHlTY3JpcHQgSW1wb3J0IE9iamVjdCBBYm9ydGVkISIpfX19LEk9YXN5bmMoYSk9PntsZXQgYj12b2lkIDA7cmV0dXJuIGI9V2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmc/YXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcoZmV0Y2goYSkseik6YXdhaXQgKGFzeW5jKCk9Pntjb25zdCBiPWF3YWl0IGZldGNoKGEpLnRoZW4oKGEpPT5hLmFycmF5QnVmZmVyKCkpOwpyZXR1cm4gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYix6KX0pKCl9LE89YXN5bmMoYSk9PnthPUJ1ZmZlci5mcm9tKGEuc3BsaXQoIiwiKVsxXSwiYmFzZTY0Iik7cmV0dXJuIGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGEseil9LFA9YXN5bmMoYSk9PnthPShhP2F3YWl0IEkoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCaUFFUllBSi9md0YvWUFBQVlBTi9mMzhCZjJBRWYzOS9md0JnQW45L0FHQUJmd0YvWUFOL2YzOEFZQUYvQUdBS2YzOS9mMzkvZjM5L2Z3QmdBQUYvWUFaL2YzOS9mMzhBWUFkL2YzOS9mMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FHQUZmMzkvZjM4QmYyQU5mMzkvZjM5L2YzOS9mMzkvZndGL0FnMEJBMlZ1ZGdWaFltOXlkQUFEQS84Qi9RRUVCQVlCQlFBRUJnQUFCd1VFQlFZR0J3RUhCd2NIQndjSEFRRUZCUUVFQVFFSEJ3RUJBUUVCQVFFSEFRRUhCd0VCQVFFSUNRRUJBUUVCQVFFQkJ3Y0JBUUVCQVFFQkFRa0pDUWtQQUFJQUVBc01DZ29HQkFjQkFRY0JBUUVCQndFQkFRRUZCUUFGQlFrQkJRVUFEUWNIQndFRkNRVUZCQWNIQndjSEFRY0JCd0VIQVFjQUJ3a0pCd1FGQUFjQkFRY0FCQVlCQUFFSEFRY0hDUWtFQkFjRUJ3Y0hCQVFHQlFVRkJRVUZCUVVGQkFjSEJRY0hCUWNIQlFjSEJRVUZCUVVGQlFVRkJRVUFCUVVGQlFVRkJ3a0pDUVVKQlFrSkNRVUVCd2NPQndFSEFRY0JDUWtKQ1FrSkNRa0pDUWtKQndFQkNRa0pDUUVCQkFRQkJRY0FCUU1CQUFFRzFBeXFBbjhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndCQkFBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUNBdC9BRUdBRUF0L0FFR0FnQUVMZndCQmdKQUJDMzhBUVlDQUFndC9BRUdBa0FNTGZ3QkJnSUFCQzM4QVFZQVFDMzhBUVlDQUJBdC9BRUdBa0FRTGZ3QkJnQUVMZndCQmdKRUVDMzhBUVlDNEFRdC9BRUdBeVFVTGZ3QkJnTmdGQzM4QVFZQ2hDd3QvQUVHQWdBd0xmd0JCZ0tFWEMzOEFRWUNBQ1F0L0FFR0FvU0FMZndCQmdQZ0FDMzhBUVlDUUJBdC9BRUdBaVIwTGZ3QkJnSmtoQzM4QVFZQ0FDQXQvQUVHQW1Ta0xmd0JCZ0lBSUMzOEFRWUNaTVF0L0FFR0FnQWdMZndCQmdKazVDMzhBUVlDQUNBdC9BRUdBbWNFQUMzOEFRWUNBQ0F0L0FFR0FtY2tBQzM4QVFZQ0FDQXQvQUVHQW1kRUFDMzhBUVlBVUMzOEFRWUN0MFFBTGZ3QkJnSWo0QXd0L0FFR0F0Y2tFQzM4QVFmLy9Bd3QvQUVFQUMzOEFRWUMxelFRTGZ3QkJsQUVMZndGQkFBdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFSG8vZ01MZndCQjZmNERDMzhBUWV2K0F3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FFSEFBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhBUWNBQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEFRWUFDQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEFRY0FBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkR3dC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRZjhBQzM4QlFmOEFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FFSEUyQUlMZndGQkFBdC9BVUVBQzM4QVFZQ0FDQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0JCMGY0REMzOEFRZEwrQXd0L0FFSFQvZ01MZndCQjFQNERDMzhBUWRYK0F3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3QkJ6LzREQzM4QVFmRCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQmdLald1UWNMZndGQkFBdC9BVUVBQzM4QVFRQUxmd0JCQVF0L0FFRUNDMzhCUVFBTGZ3QkJnQUlMZndGQkFBc0g4QkJsQm0xbGJXOXllUUlBQjE5ZllXeHNiMk1BQ2doZlgzSmxkR0ZwYmdBTUNWOWZjbVZzWldGelpRQVZDVjlmWTI5c2JHVmpkQUFhQzE5ZmNuUjBhVjlpWVhObEE2Z0NCbU52Ym1acFp3QTBEbWhoYzBOdmNtVlRkR0Z5ZEdWa0FEVUpjMkYyWlZOMFlYUmxBRHdKYkc5aFpGTjBZWFJsQUVjRmFYTkhRa01BU0JKblpYUlRkR1Z3YzFCbGNsTjBaWEJUWlhRQVNRdG5aWFJUZEdWd1UyVjBjd0JLQ0dkbGRGTjBaWEJ6QUVzVlpYaGxZM1YwWlUxMWJIUnBjR3hsUm5KaGJXVnpBTlFCREdWNFpXTjFkR1ZHY21GdFpRRFRBUWxmWDNObGRHRnlaMk1BL0FFWlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYndEN0FSVmxlR1ZqZFhSbFZXNTBhV3hEYjI1a2FYUnBiMjRBL1FFTFpYaGxZM1YwWlZOMFpYQUEwQUVVWjJWMFEzbGpiR1Z6VUdWeVEzbGpiR1ZUWlhRQTFRRU1aMlYwUTNsamJHVlRaWFJ6QU5ZQkNXZGxkRU41WTJ4bGN3RFhBUTV6WlhSS2IzbHdZV1JUZEdGMFpRRGNBUjluWlhST2RXMWlaWEpQWmxOaGJYQnNaWE5KYmtGMVpHbHZRblZtWm1WeUFORUJFR05zWldGeVFYVmthVzlDZFdabVpYSUFReHh6WlhSTllXNTFZV3hEYjJ4dmNtbDZZWFJwYjI1UVlXeGxkSFJsQUNJWFYwRlRUVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRETUJOWFFWTk5RazlaWDAxRlRVOVNXVjlUU1ZwRkF6RVNWMEZUVFVKUFdWOVhRVk5OWDFCQlIwVlRBekllUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgweFBRMEZVU1U5T0F3UWFRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDFOSldrVURCUlpYUVZOTlFrOVpYMU5VUVZSRlgweFBRMEZVU1U5T0F3WVNWMEZUVFVKUFdWOVRWRUZVUlY5VFNWcEZBd2NnUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNEREaHhIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXc4U1ZrbEVSVTlmVWtGTlgweFBRMEZVU1U5T0F3Z09Wa2xFUlU5ZlVrRk5YMU5KV2tVRENSRlhUMUpMWDFKQlRWOU1UME5CVkVsUFRnTUtEVmRQVWt0ZlVrRk5YMU5KV2tVREN5WlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01NSWs5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VERFJoSFVrRlFTRWxEVTE5UFZWUlFWVlJmVEU5RFFWUkpUMDRESEJSSFVrRlFTRWxEVTE5UFZWUlFWVlJmVTBsYVJRTWRGRWRDUTE5UVFVeEZWRlJGWDB4UFEwRlVTVTlPQXhBUVIwSkRYMUJCVEVWVVZFVmZVMGxhUlFNUkdFSkhYMUJTU1U5U1NWUlpYMDFCVUY5TVQwTkJWRWxQVGdNU0ZFSkhYMUJTU1U5U1NWUlpYMDFCVUY5VFNWcEZBeE1PUmxKQlRVVmZURTlEUVZSSlQwNERGQXBHVWtGTlJWOVRTVnBGQXhVWFFrRkRTMGRTVDFWT1JGOU5RVkJmVEU5RFFWUkpUMDRERmhOQ1FVTkxSMUpQVlU1RVgwMUJVRjlUU1ZwRkF4Y1NWRWxNUlY5RVFWUkJYMHhQUTBGVVNVOU9BeGdPVkVsTVJWOUVRVlJCWDFOSldrVURHUkpQUVUxZlZFbE1SVk5mVEU5RFFWUkpUMDRER2c1UFFVMWZWRWxNUlZOZlUwbGFSUU1iRlVGVlJFbFBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTW1FVUZWUkVsUFgwSlZSa1pGVWw5VFNWcEZBeWNaUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01lRlVOSVFVNU9SVXhmTVY5Q1ZVWkdSVkpmVTBsYVJRTWZHVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZURTlEUVZSSlQwNERJQlZEU0VGT1RrVk1YekpmUWxWR1JrVlNYMU5KV2tVRElSbERTRUZPVGtWTVh6TmZRbFZHUmtWU1gweFBRMEZVU1U5T0F5SVZRMGhCVGs1RlRGOHpYMEpWUmtaRlVsOVRTVnBGQXlNWlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNa0ZVTklRVTVPUlV4Zk5GOUNWVVpHUlZKZlUwbGFSUU1sRmtOQlVsUlNTVVJIUlY5U1FVMWZURTlEUVZSSlQwNERLQkpEUVZKVVVrbEVSMFZmVWtGTlgxTkpXa1VES1JGQ1QwOVVYMUpQVFY5TVQwTkJWRWxQVGdNcURVSlBUMVJmVWs5TlgxTkpXa1VES3haRFFWSlVVa2xFUjBWZlVrOU5YMHhQUTBGVVNVOU9BeXdTUTBGU1ZGSkpSRWRGWDFKUFRWOVRTVnBGQXkwZFJFVkNWVWRmUjBGTlJVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERMaGxFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeThoWjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBQndiYzJWMFVISnZaM0poYlVOdmRXNTBaWEpDY21WaGEzQnZhVzUwQU4wQkhYSmxjMlYwVUhKdlozSmhiVU52ZFc1MFpYSkNjbVZoYTNCdmFXNTBBTjRCR1hObGRGSmxZV1JIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBM3dFYmNtVnpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFPQUJHbk5sZEZkeWFYUmxSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBT0VCSEhKbGMyVjBWM0pwZEdWSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTRnRU1aMlYwVW1WbmFYTjBaWEpCQU9NQkRHZGxkRkpsWjJsemRHVnlRZ0RrQVF4blpYUlNaV2RwYzNSbGNrTUE1UUVNWjJWMFVtVm5hWE4wWlhKRUFPWUJER2RsZEZKbFoybHpkR1Z5UlFEbkFReG5aWFJTWldkcGMzUmxja2dBNkFFTVoyVjBVbVZuYVhOMFpYSk1BT2tCREdkbGRGSmxaMmx6ZEdWeVJnRHFBUkZuWlhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0RyQVE5blpYUlRkR0ZqYTFCdmFXNTBaWElBN0FFWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dEdEFRVm5aWFJNV1FEdUFSMWtjbUYzUW1GamEyZHliM1Z1WkUxaGNGUnZWMkZ6YlUxbGJXOXllUUR2QVJoa2NtRjNWR2xzWlVSaGRHRlViMWRoYzIxTlpXMXZjbmtBOEFFVFpISmhkMDloYlZSdlYyRnpiVTFsYlc5eWVRRHhBUVpuWlhSRVNWWUE4Z0VIWjJWMFZFbE5RUUR6QVFablpYUlVUVUVBOUFFR1oyVjBWRUZEQVBVQkUzVndaR0YwWlVSbFluVm5SMEpOWlcxdmNua0E5Z0VJQXZjQkNvYVlBdjBCb0FJQkJIOGdBU2dDQUNJRFFRRnhSUVJBUVFCQkdFR1ZBa0VORUFBQUN5QURRWHh4SWdKQkVFOEVmeUFDUWZELy8vOERTUVZCQUF0RkJFQkJBRUVZUVpjQ1FRMFFBQUFMSUFKQmdBSkpCSDhnQWtFRWRpRUNRUUFGSUFKQkh5QUNaMnNpQTBFRWEzWkJFSE1oQWlBRFFRZHJDeUlEUVJkSkJIOGdBa0VRU1FWQkFBdEZCRUJCQUVFWVFhUUNRUTBRQUFBTElBRW9BaFFoQkNBQktBSVFJZ1VFUUNBRklBUTJBaFFMSUFRRVFDQUVJQVUyQWhBTElBTkJCSFFnQW1wQkFuUWdBR29vQW1BZ0FVWUVRQ0FEUVFSMElBSnFRUUowSUFCcUlBUTJBbUFnQkVVRVFDQURRUUowSUFCcUlBTkJBblFnQUdvb0FnUkJBU0FDZEVGL2MzRWlBVFlDQkNBQlJRUkFJQUFnQUNnQ0FFRUJJQU4wUVg5emNUWUNBQXNMQ3d2OUF3RUdmeUFCUlFSQVFRQkJHRUhOQVVFTkVBQUFDeUFCS0FJQUlnTkJBWEZGQkVCQkFFRVlRYzhCUVEwUUFBQUxJQUZCRUdvZ0FTZ0NBRUY4Y1dvaUJDZ0NBQ0lGUVFGeEJFQWdBMEY4Y1VFUWFpQUZRWHh4YWlJQ1FmRC8vLzhEU1FSQUlBQWdCQkFCSUFFZ0EwRURjU0FDY2lJRE5nSUFJQUZCRUdvZ0FTZ0NBRUY4Y1dvaUJDZ0NBQ0VGQ3dzZ0EwRUNjUVJBSUFGQkJHc29BZ0FpQWlnQ0FDSUdRUUZ4UlFSQVFRQkJHRUhrQVVFUEVBQUFDeUFHUVh4eFFSQnFJQU5CZkhGcUlnZEI4UC8vL3dOSkJIOGdBQ0FDRUFFZ0FpQUdRUU54SUFkeUlnTTJBZ0FnQWdVZ0FRc2hBUXNnQkNBRlFRSnlOZ0lBSUFOQmZIRWlBa0VRVHdSL0lBSkI4UC8vL3dOSkJVRUFDMFVFUUVFQVFSaEI4d0ZCRFJBQUFBc2dCQ0FCUVJCcUlBSnFSd1JBUVFCQkdFSDBBVUVORUFBQUN5QUVRUVJySUFFMkFnQWdBa0dBQWtrRWZ5QUNRUVIySVFSQkFBVWdBa0VmSUFKbmF5SUNRUVJyZGtFUWN5RUVJQUpCQjJzTElnTkJGMGtFZnlBRVFSQkpCVUVBQzBVRVFFRUFRUmhCaEFKQkRSQUFBQXNnQTBFRWRDQUVha0VDZENBQWFpZ0NZQ0VDSUFGQkFEWUNFQ0FCSUFJMkFoUWdBZ1JBSUFJZ0FUWUNFQXNnQTBFRWRDQUVha0VDZENBQWFpQUJOZ0pnSUFBZ0FDZ0NBRUVCSUFOMGNqWUNBQ0FEUVFKMElBQnFJQU5CQW5RZ0FHb29BZ1JCQVNBRWRISTJBZ1FMeXdFQkFuOGdBa0VQY1VWQkFDQUJRUTl4UlVFQUlBRWdBazBiRzBVRVFFRUFRUmhCZ2dOQkJCQUFBQXNnQUNnQ29Bd2lBd1JBSUFFZ0EwRVFha2tFUUVFQVFSaEJqQU5CRHhBQUFBc2dBVUVRYXlBRFJnUkFJQU1vQWdBaEJDQUJRUkJySVFFTEJTQUJJQUJCcEF4cVNRUkFRUUJCR0VHWUEwRUVFQUFBQ3dzZ0FpQUJheUlDUVRCSkJFQVBDeUFCSUFSQkFuRWdBa0VnYTBFQmNuSTJBZ0FnQVVFQU5nSVFJQUZCQURZQ0ZDQUJJQUpxUVJCcklnSkJBallDQUNBQUlBSTJBcUFNSUFBZ0FSQUNDNWNCQVFKL1FRRS9BQ0lBU2dSL1FRRWdBR3RBQUVFQVNBVkJBQXNFUUFBTFFhQUNRUUEyQWdCQndBNUJBRFlDQUVFQUlRQURRQUpBSUFCQkYwOE5BQ0FBUVFKMFFhQUNha0VBTmdJRVFRQWhBUU5BQWtBZ0FVRVFUdzBBSUFCQkJIUWdBV3BCQW5SQm9BSnFRUUEyQW1BZ0FVRUJhaUVCREFFTEN5QUFRUUZxSVFBTUFRc0xRYUFDUWRBT1B3QkJFSFFRQTBHZ0FpUUFDeTBBSUFCQjhQLy8vd05QQkVCQnlBQkJHRUhBQTBFZEVBQUFDeUFBUVE5cVFYQnhJZ0JCRUNBQVFSQkxHd3ZkQVFFQmZ5QUJRWUFDU1FSL0lBRkJCSFloQVVFQUJTQUJRZmovLy84QlNRUkFRUUZCR3lBQloydDBJQUZxUVFGcklRRUxJQUZCSHlBQloyc2lBa0VFYTNaQkVITWhBU0FDUVFkckN5SUNRUmRKQkg4Z0FVRVFTUVZCQUF0RkJFQkJBRUVZUWRJQ1FRMFFBQUFMSUFKQkFuUWdBR29vQWdSQmZ5QUJkSEVpQVFSL0lBRm9JQUpCQkhScVFRSjBJQUJxS0FKZ0JTQUFLQUlBUVg4Z0FrRUJhblJ4SWdFRWZ5QUJhQ0lCUVFKMElBQnFLQUlFSWdKRkJFQkJBRUVZUWQ4Q1FSRVFBQUFMSUFKb0lBRkJCSFJxUVFKMElBQnFLQUpnQlVFQUN3c0xRQUVCZno4QUlnSWdBVUgvL3dOcVFZQ0FmSEZCRUhZaUFTQUNJQUZLRzBBQVFRQklCRUFnQVVBQVFRQklCRUFBQ3dzZ0FDQUNRUkIwUHdCQkVIUVFBd3VIQVFFQ2Z5QUJLQUlBSVFNZ0FrRVBjUVJBUVFCQkdFSHRBa0VORUFBQUN5QURRWHh4SUFKcklnUkJJRThFUUNBQklBTkJBbkVnQW5JMkFnQWdBVUVRYWlBQ2FpSUJJQVJCRUd0QkFYSTJBZ0FnQUNBQkVBSUZJQUVnQTBGK2NUWUNBQ0FCUVJCcUlBRW9BZ0JCZkhGcUlBRkJFR29nQVNnQ0FFRjhjV29vQWdCQmZYRTJBZ0FMQzJvQkFuOGdBQ0FCRUFVaUF4QUdJZ0pGQkVBZ0FDQURFQWNnQUNBREVBWWlBa1VFUUVFQVFSaEIzZ05CRHhBQUFBc0xJQUlvQWdCQmZIRWdBMGtFUUVFQVFSaEI0QU5CRFJBQUFBc2dBa0VBTmdJRUlBSWdBVFlDRENBQUlBSVFBU0FBSUFJZ0F4QUlJQUlMSWdFQmZ5TUFJZ0lFZnlBQ0JSQUVJd0FMSUFBUUNTSUFJQUUyQWdnZ0FFRVFhZ3RSQVFGL0lBQW9BZ1FpQVVHQWdJQ0FmM0VnQVVFQmFrR0FnSUNBZjNGSEJFQkJBRUdBQVVIb0FFRUNFQUFBQ3lBQUlBRkJBV28yQWdRZ0FDZ0NBRUVCY1FSQVFRQkJnQUZCNndCQkRSQUFBQXNMRkFBZ0FFR2NBa3NFUUNBQVFSQnJFQXNMSUFBTExRRUJmeUFCS0FJQUlnSkJBWEVFUUVFQVFSaEJtUVJCQWhBQUFBc2dBU0FDUVFGeU5nSUFJQUFnQVJBQ0N5Y0FJQUJCZ0FJb0FnQkxCRUJCc0FGQjZBRkJGa0ViRUFBQUN5QUFRUU4wUVlRQ2FpZ0NBQXZFREFFRGZ3TkFJQUZCQTNGQkFDQUNHd1JBSUFBaUEwRUJhaUVBSUFFaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRRnJJUUlNQVFzTElBQkJBM0ZGQkVBRFFDQUNRUkJKUlFSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FFRUlhaUFCUVFocUtBSUFOZ0lBSUFCQkRHb2dBVUVNYWlnQ0FEWUNBQ0FCUVJCcUlRRWdBRUVRYWlFQUlBSkJFR3NoQWd3QkN3c2dBa0VJY1FSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FVRUlhaUVCSUFCQkNHb2hBQXNnQWtFRWNRUkFJQUFnQVNnQ0FEWUNBQ0FCUVFScUlRRWdBRUVFYWlFQUN5QUNRUUp4QkVBZ0FDQUJMd0VBT3dFQUlBRkJBbW9oQVNBQVFRSnFJUUFMSUFKQkFYRUVRQ0FBSUFFdEFBQTZBQUFMRHdzZ0FrRWdUd1JBQWtBQ1FBSkFJQUJCQTNFaUEwRUJSd1JBSUFOQkFrWU5BU0FEUVFOR0RRSU1Bd3NnQVNnQ0FDRUZJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFOcklRSURRQ0FDUVJGSlJRUkFJQUFnQVVFQmFpZ0NBQ0lEUVFoMElBVkJHSFp5TmdJQUlBQkJCR29nQTBFWWRpQUJRUVZxS0FJQUlnTkJDSFJ5TmdJQUlBQkJDR29nQTBFWWRpQUJRUWxxS0FJQUlnTkJDSFJ5TmdJQUlBQkJER29nQVVFTmFpZ0NBQ0lGUVFoMElBTkJHSFp5TmdJQUlBRkJFR29oQVNBQVFSQnFJUUFnQWtFUWF5RUNEQUVMQ3d3Q0N5QUJLQUlBSVFVZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRSnJJUUlEUUNBQ1FSSkpSUVJBSUFBZ0FVRUNhaWdDQUNJRFFSQjBJQVZCRUhaeU5nSUFJQUJCQkdvZ0EwRVFkaUFCUVFacUtBSUFJZ05CRUhSeU5nSUFJQUJCQ0dvZ0EwRVFkaUFCUVFwcUtBSUFJZ05CRUhSeU5nSUFJQUJCREdvZ0FVRU9haWdDQUNJRlFSQjBJQU5CRUhaeU5nSUFJQUZCRUdvaEFTQUFRUkJxSVFBZ0FrRVFheUVDREFFTEN3d0JDeUFCS0FJQUlRVWdBQ0lEUVFGcUlRQWdBU0lFUVFGcUlRRWdBeUFFTFFBQU9nQUFJQUpCQVdzaEFnTkFJQUpCRTBsRkJFQWdBQ0FCUVFOcUtBSUFJZ05CR0hRZ0JVRUlkbkkyQWdBZ0FFRUVhaUFEUVFoMklBRkJCMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRUlhaUFEUVFoMklBRkJDMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRU1haUFCUVE5cUtBSUFJZ1ZCR0hRZ0EwRUlkbkkyQWdBZ0FVRVFhaUVCSUFCQkVHb2hBQ0FDUVJCcklRSU1BUXNMQ3dzZ0FrRVFjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlEUVFGcUlRQWdBVUVCYWlJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBQ3lBQ1FRaHhCRUFnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUVjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJRFFRRnFJUUFnQVVFQmFpSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUN5QUNRUUp4QkVBZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUJjUVJBSUFBZ0FTMEFBRG9BQUFzTDBnSUJBbjhDUUNBQ0lRTWdBQ0FCUmcwQVFRRWdBQ0FEYWlBQlRTQUJJQU5xSUFCTkd3UkFJQUFnQVNBREVBOE1BUXNnQUNBQlNRUkFJQUZCQjNFZ0FFRUhjVVlFUUFOQUlBQkJCM0VFUUNBRFJRMEVJQU5CQVdzaEF5QUFJZ0pCQVdvaEFDQUJJZ1JCQVdvaEFTQUNJQVF0QUFBNkFBQU1BUXNMQTBBZ0EwRUlTVVVFUUNBQUlBRXBBd0EzQXdBZ0EwRUlheUVESUFCQkNHb2hBQ0FCUVFocUlRRU1BUXNMQ3dOQUlBTUVRQ0FBSWdKQkFXb2hBQ0FCSWdSQkFXb2hBU0FDSUFRdEFBQTZBQUFnQTBFQmF5RUREQUVMQ3dVZ0FVRUhjU0FBUVFkeFJnUkFBMEFnQUNBRGFrRUhjUVJBSUFORkRRUWdBQ0FEUVFGcklnTnFJQUVnQTJvdEFBQTZBQUFNQVFzTEEwQWdBMEVJU1VVRVFDQUFJQU5CQ0dzaUEyb2dBU0FEYWlrREFEY0RBQXdCQ3dzTEEwQWdBd1JBSUFBZ0EwRUJheUlEYWlBQklBTnFMUUFBT2dBQURBRUxDd3NMQ3pnQUl3QkZCRUJCQUVFWVFiY0VRUTBRQUFBTElBQkJEM0ZGUVFBZ0FCdEZCRUJCQUVFWVFiZ0VRUUlRQUFBTEl3QWdBRUVRYXhBTkMwVUJCSDhqQVNNRElnRnJJZ0pCQVhRaUFFR0FBaUFBUVlBQ1N4c2lBMEVBRUFvaUFDQUJJQUlRRUNBQkJFQWdBUkFSQ3lBQUpBTWdBQ0FDYWlRQklBQWdBMm9rQWdzaUFRRi9Jd0VpQVNNQ1R3UkFFQklqQVNFQkN5QUJJQUEyQWdBZ0FVRUVhaVFCQzdZQkFRSi9JQUFvQWdRaUFrSC8vLy8vQUhFaEFTQUFLQUlBUVFGeEJFQkJBRUdBQVVIekFFRU5FQUFBQ3lBQlFRRkdCRUFnQUVFUWFrRUJFUGtCSUFKQmdJQ0FnSGh4QkVBZ0FFR0FnSUNBZURZQ0JBVWpBQ0FBRUEwTEJTQUJRUUJOQkVCQkFFR0FBVUg4QUVFUEVBQUFDeUFBS0FJSUVBNUJFSEVFUUNBQUlBRkJBV3NnQWtHQWdJQ0FmM0Z5TmdJRUJTQUFJQUZCQVd0QmdJQ0FnSHR5TmdJRUlBSkJnSUNBZ0hoeFJRUkFJQUFRRXdzTEN3c1NBQ0FBUVp3Q1N3UkFJQUJCRUdzUUZBc0xPd0VCZnlBQUtBSUVJZ0ZCZ0lDQWdBZHhRWUNBZ0lBQlJ3UkFJQUFnQVVILy8vLy9lSEZCZ0lDQWdBRnlOZ0lFSUFCQkVHcEJBaEQ1QVFzTEhRQWdBQ0FBS0FJRVFmLy8vLzk0Y1RZQ0JDQUFRUkJxUVFRUStRRUxUd0VCZnlBQUtBSUVJZ0ZCZ0lDQWdBZHhRWUNBZ0lBQlJnUkFJQUZCLy8vLy93QnhRUUJMQkVBZ0FCQVhCU0FBSUFGQi8vLy8vM2h4UVlDQWdJQUNjallDQkNBQVFSQnFRUU1RK1FFTEN3dEtBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FKR0JIOGdBVUdBZ0lDQWVIRkZCVUVBQ3dSQUlBQWdBVUgvLy8vL2VIRTJBZ1FnQUVFUWFrRUZFUGtCSXdBZ0FCQU5Dd3Z6QVFFR2Z5TURJZ1VpQWlFREl3RWhBQU5BQWtBZ0F5QUFUdzBBSUFNb0FnQWlCQ2dDQkNJQlFZQ0FnSUFIY1VHQWdJQ0FBMFlFZnlBQlFmLy8vLzhBY1VFQVN3VkJBQXNFUUNBRUVCWWdBaUFFTmdJQUlBSkJCR29oQWdWQkFDQUJRZi8vLy84QWNVVWdBVUdBZ0lDQUIzRWJCRUFqQUNBRUVBMEZJQVFnQVVILy8vLy9CM0UyQWdRTEN5QURRUVJxSVFNTUFRc0xJQUlrQVNBRklRQURRQUpBSUFBZ0FrOE5BQ0FBS0FJQUVCZ2dBRUVFYWlFQURBRUxDeUFGSVFBRFFBSkFJQUFnQWs4TkFDQUFLQUlBSWdFZ0FTZ0NCRUgvLy8vL0IzRTJBZ1FnQVJBWklBQkJCR29oQUF3QkN3c2dCU1FCQzFNQVFmTGx5d2NrUFVHZ3dZSUZKRDVCMkxEaEFpUS9RWWlRSUNSQVFmTGx5d2NrUVVHZ3dZSUZKRUpCMkxEaEFpUkRRWWlRSUNSRVFmTGx5d2NrUlVHZ3dZSUZKRVpCMkxEaEFpUkhRWWlRSUNSSUM1VUNBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVF4MUlnRUVRQ0FCUVFGR0RRRUNRQ0FCUVFKckRnd0NBZ01EQXdNRUJBVUZCZ2NBQ3d3SEN5T01BZ1JBSTQwQ0JFQWdBRUdBQWtnTkNTQUFRWUFTU0VFQUlBQkIvd05LR3cwSkJVRUFJQUJCZ0FKSUk0MENHdzBKQ3dzTElBQkJnSzNSQUdvUEN5QUFRUUVqOXdFaUFFRUFJQUJGSS84Qkd4dEJEblJxUVlDdDBBQnFEd3NnQUVHQWtINXFJNDBDQkg4amlnSVFIVUVCY1FWQkFBdEJEWFJxRHdzZ0FDUDRBVUVOZEdwQmdObkdBR29QQ3lBQVFZQ1FmbW9QQzBFQUlRRUNmeU9OQWdSQUk0c0NFQjFCQjNFaEFRc2dBVUVCU0FzRWYwRUJCU0FCQzBFTWRDQUFha0dBOEgxcUR3c2dBRUdBVUdvUEN5QUFRWUNaMFFCcUN3a0FJQUFRSEMwQUFBdkRBUUJCQUNTT0FrRUFKSThDUVFBa2tBSkJBQ1NSQWtFQUpKSUNRUUFra3dKQkFDU1VBa0VBSkpVQ1FRQWtsZ0pCQUNTWEFrRUFKSmdDUVFBa21RSkJBQ1NhQWtFQUpKc0NRUUFrbkFKQkFDU2RBaU9NQWdSQUR3c2pqUUlFUUVFUkpJOENRWUFCSkpZQ1FRQWtrQUpCQUNTUkFrSC9BU1NTQWtIV0FDU1RBa0VBSkpRQ1FRMGtsUUlGUVFFa2p3SkJzQUVrbGdKQkFDU1FBa0VUSkpFQ1FRQWtrZ0pCMkFFa2t3SkJBU1NVQWtITkFDU1ZBZ3RCZ0FJa21BSkIvdjhESkpjQ0N3c0FJQUFRSENBQk9nQUFDM0VCQVg5QkFDVDVBVUVCSlBvQlFjY0NFQjBpQUVVayt3RWdBRUVEVEVFQUlBQkJBVTRiSlB3QklBQkJCa3hCQUNBQVFRVk9HeVQ5QVNBQVFSTk1RUUFnQUVFUFRoc2svZ0VnQUVFZVRFRUFJQUJCR1U0YkpQOEJRUUVrOXdGQkFDVDRBU09LQWtFQUVCOGppd0pCQVJBZkN5OEFRZEgrQTBIL0FSQWZRZEwrQTBIL0FSQWZRZFArQTBIL0FSQWZRZFQrQTBIL0FSQWZRZFgrQTBIL0FSQWZDN0FJQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdzREJBVUdCd2dKQ2dzTURRQUxEQTBMUWZMbHl3Y2tQVUdnd1lJRkpENUIyTERoQWlRL1FZaVFJQ1JBUWZMbHl3Y2tRVUdnd1lJRkpFSkIyTERoQWlSRFFZaVFJQ1JFUWZMbHl3Y2tSVUdnd1lJRkpFWkIyTERoQWlSSFFZaVFJQ1JJREF3TFFmLy8vd2NrUFVIajJ2NEhKRDVCZ09LUUJDUS9RUUFrUUVILy8vOEhKRUZCNDlyK0J5UkNRWURpa0FRa1EwRUFKRVJCLy8vL0J5UkZRZVBhL2dja1JrR0E0cEFFSkVkQkFDUklEQXNMUWYvLy93Y2tQVUdFaWY0SEpENUJ1dlRRQkNRL1FRQWtRRUgvLy84SEpFRkJzZjd2QXlSQ1FZQ0lBaVJEUVFBa1JFSC8vLzhISkVWQi84dU9BeVJHUWY4QkpFZEJBQ1JJREFvTFFjWE4vd2NrUFVHRXVib0dKRDVCcWRhUkJDUS9RWWppNkFJa1FFSC8vLzhISkVGQjQ5citCeVJDUVlEaWtBUWtRMEVBSkVSQi8vLy9CeVJGUWVQYS9nY2tSa0dBNHBBRUpFZEJBQ1JJREFrTFFmLy8vd2NrUFVHQS9zc0NKRDVCZ0lUOUJ5US9RUUFrUUVILy8vOEhKRUZCZ1A3TEFpUkNRWUNFL1Fja1EwRUFKRVJCLy8vL0J5UkZRWUQreXdJa1JrR0FoUDBISkVkQkFDUklEQWdMUWYvLy93Y2tQVUd4L3U4REpENUJ4Y2NCSkQ5QkFDUkFRZi8vL3dja1FVR0VpZjRISkVKQnV2VFFCQ1JEUVFBa1JFSC8vLzhISkVWQmhJbitCeVJHUWJyMDBBUWtSMEVBSkVnTUJ3dEJBQ1E5UVlTSkFpUStRWUM4L3dja1AwSC8vLzhISkVCQkFDUkJRWVNKQWlSQ1FZQzgvd2NrUTBILy8vOEhKRVJCQUNSRlFZU0pBaVJHUVlDOC93Y2tSMEgvLy84SEpFZ01CZ3RCcGYvL0J5UTlRWlNwL2dja1BrSC9xZElFSkQ5QkFDUkFRYVgvL3dja1FVR1VxZjRISkVKQi82blNCQ1JEUVFBa1JFR2wvLzhISkVWQmxLbitCeVJHUWYrcDBnUWtSMEVBSkVnTUJRdEIvLy8vQnlROVFZRCsvd2NrUGtHQWdQd0hKRDlCQUNSQVFmLy8vd2NrUVVHQS92OEhKRUpCZ0lEOEJ5UkRRUUFrUkVILy8vOEhKRVZCZ1A3L0J5UkdRWUNBL0Fja1IwRUFKRWdNQkF0Qi8vLy9CeVE5UVlEKy93Y2tQa0dBbE8wREpEOUJBQ1JBUWYvLy93Y2tRVUgveTQ0REpFSkIvd0VrUTBFQUpFUkIvLy8vQnlSRlFiSCs3d01rUmtHQWlBSWtSMEVBSkVnTUF3dEIvLy8vQnlROVFmL0xqZ01rUGtIL0FTUS9RUUFrUUVILy8vOEhKRUZCaEluK0J5UkNRYnIwMEFRa1EwRUFKRVJCLy8vL0J5UkZRYkgrN3dNa1JrR0FpQUlrUjBFQUpFZ01BZ3RCLy8vL0J5UTlRZDZac2dRa1BrR01wY2tDSkQ5QkFDUkFRZi8vL3dja1FVR0VpZjRISkVKQnV2VFFCQ1JEUVFBa1JFSC8vLzhISkVWQjQ5citCeVJHUVlEaWtBUWtSMEVBSkVnTUFRdEIvLy8vQnlROVFhWExsZ1VrUGtIU3BNa0NKRDlCQUNSQVFmLy8vd2NrUVVHbHk1WUZKRUpCMHFUSkFpUkRRUUFrUkVILy8vOEhKRVZCcGN1V0JTUkdRZEtreVFJa1IwRUFKRWdMQzlvSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZZ0JSd1JBSUFCQjRRQkdEUUVnQUVFVVJnMENJQUJCeGdCR0RRTWdBRUhaQUVZTkJDQUFRY1lCUmcwRUlBQkJoZ0ZHRFFVZ0FFR29BVVlOQlNBQVFiOEJSZzBHSUFCQnpnRkdEUVlnQUVIUkFVWU5CaUFBUWZBQlJnMEdJQUJCSjBZTkJ5QUFRY2tBUmcwSElBQkIzQUJHRFFjZ0FFR3pBVVlOQnlBQVFja0JSZzBJSUFCQjhBQkdEUWtnQUVIR0FFWU5DaUFBUWRNQlJnMExEQXdMUWYrNWxnVWtQVUdBL3Y4SEpENUJnTVlCSkQ5QkFDUkFRZis1bGdVa1FVR0EvdjhISkVKQmdNWUJKRU5CQUNSRVFmKzVsZ1VrUlVHQS92OEhKRVpCZ01ZQkpFZEJBQ1JJREFzTFFmLy8vd2NrUFVIL3k0NERKRDVCL3dFa1AwRUFKRUJCLy8vL0J5UkJRWVNKL2dja1FrRzY5TkFFSkVOQkFDUkVRZi8vL3dja1JVSC95NDRESkVaQi93RWtSMEVBSkVnTUNndEIvLy8vQnlROVFZU0ovZ2NrUGtHNjlOQUVKRDlCQUNSQVFmLy8vd2NrUVVHeC91OERKRUpCZ0lnQ0pFTkJBQ1JFUWYvLy93Y2tSVUdFaWY0SEpFWkJ1dlRRQkNSSFFRQWtTQXdKQzBILzY5WUZKRDFCbFAvL0J5UStRY0swdFFVa1AwRUFKRUJCQUNSQlFmLy8vd2NrUWtHRWlmNEhKRU5CdXZUUUJDUkVRUUFrUlVILy8vOEhKRVpCaEluK0J5UkhRYnIwMEFRa1NBd0lDMEgvLy84SEpEMUJoTnUyQlNRK1Fmdm1pUUlrUDBFQUpFQkIvLy8vQnlSQlFZRG0vUWNrUWtHQWhORUVKRU5CQUNSRVFmLy8vd2NrUlVILysrb0NKRVpCZ0lEOEJ5UkhRZjhCSkVnTUJ3dEJuUC8vQnlROVFmL3IwZ1FrUGtIenFJNERKRDlCdXZRQUpFQkJ3b3IvQnlSQlFZQ3Mvd2NrUWtHQTlOQUVKRU5CZ0lDb0FpUkVRZi8vL3dja1JVR0VpZjRISkVaQnV2VFFCQ1JIUVFBa1NBd0dDMEdBL3E4REpEMUIvLy8vQnlRK1FjcWsvUWNrUDBFQUpFQkIvLy8vQnlSQlFmLy8vd2NrUWtIL3k0NERKRU5CL3dFa1JFSC8vLzhISkVWQjQ5citCeVJHUVlEaWtBUWtSMEVBSkVnTUJRdEIvN21XQlNROVFZRCsvd2NrUGtHQXhnRWtQMEVBSkVCQjBzYjlCeVJCUVlDQTJBWWtRa0dBZ0l3REpFTkJBQ1JFUWY4QkpFVkIvLy8vQnlSR1Fmdisvd2NrUjBIL2lRSWtTQXdFQzBITy8vOEhKRDFCNzkrUEF5UStRYkdJOGdRa1AwSGF0T2tDSkVCQi8vLy9CeVJCUVlEbS9RY2tRa0dBaE5FRUpFTkJBQ1JFUWYvLy93Y2tSVUgveTQ0REpFWkIvd0VrUjBFQUpFZ01Bd3RCLy8vL0J5UTlRWVNKL2dja1BrRzY5TkFFSkQ5QkFDUkFRZi8vL3dja1FVR0EvZ01rUWtHQWlNWUJKRU5CZ0pRQkpFUkIvLy8vQnlSRlFmL0xqZ01rUmtIL0FTUkhRUUFrU0F3Q0MwSC8vLzhISkQxQi84dU9BeVErUWY4QkpEOUJBQ1JBUVlEKy93Y2tRVUdBZ1B3SEpFSkJnSUNNQXlSRFFRQWtSRUgvLy84SEpFVkJzZjd2QXlSR1FZQ0lBaVJIUVFBa1NBd0JDMEgvLy84SEpEMUJoTnUyQlNRK1Fmdm1pUUlrUDBFQUpFQkIvLy8vQnlSQlFlUGEvZ2NrUWtIajJ2NEhKRU5CQUNSRVFmLy8vd2NrUlVIL3k0NERKRVpCL3dFa1IwRUFKRWdMQzBvQkFuOUJBQkFpSTQwQ0JFQVBDeU9NQWdSQUk0MENSUVJBRHdzTFFiUUNJUUFEUUFKQUlBQkJ3d0pLRFFBZ0FCQWRJQUZxSVFFZ0FFRUJhaUVBREFFTEN5QUJRZjhCY1JBakM5d0JBRUVBSlBBQlFRQWs4UUZCQUNUeUFVRUFKUE1CUVFBazlBRkJBQ1QxQVVFQUpQWUJRWkFCSlBJQkk0MENCRUJCd2Y0RFFZRUJFQjlCeFA0RFFaQUJFQjlCeC80RFFmd0JFQjhGUWNIK0EwR0ZBUkFmUWNiK0EwSC9BUkFmUWNmK0EwSDhBUkFmUWNqK0EwSC9BUkFmUWNuK0EwSC9BUkFmQzBHUUFTVHlBVUhBL2dOQmtBRVFIMEhQL2dOQkFCQWZRZkQrQTBFQkVCOGpqQUlFUUNPTkFnUkFRUUFrOGdGQndQNERRUUFRSDBIQi9nTkJnQUVRSDBIRS9nTkJBQkFmQlVFQUpQSUJRY0QrQTBFQUVCOUJ3ZjREUVlRQkVCOExDeEFrQzIwQUk0MENCRUJCNlA0RFFjQUJFQjlCNmY0RFFmOEJFQjlCNnY0RFFjRUJFQjlCNi80RFFRMFFId1ZCNlA0RFFmOEJFQjlCNmY0RFFmOEJFQjlCNnY0RFFmOEJFQjlCNi80RFFmOEJFQjhMSTQwQ1FRQWpqQUliQkVCQjZmNERRU0FRSDBIci9nTkJpZ0VRSHdzTFZnQkJrUDREUVlBQkVCOUJrZjREUWI4QkVCOUJrdjREUWZNQkVCOUJrLzREUWNFQkVCOUJsUDREUWI4QkVCOGpqQUlFUUVHUi9nTkJQeEFmUVpMK0EwRUFFQjlCay80RFFRQVFIMEdVL2dOQnVBRVFId3NMTEFCQmxmNERRZjhCRUI5Qmx2NERRVDhRSDBHWC9nTkJBQkFmUVpqK0EwRUFFQjlCbWY0RFFiZ0JFQjhMTXdCQm12NERRZjhBRUI5Qm0vNERRZjhCRUI5Qm5QNERRWjhCRUI5Qm5mNERRUUFRSDBHZS9nTkJ1QUVRSDBFQkpJa0JDeTBBUVovK0EwSC9BUkFmUWFEK0EwSC9BUkFmUWFIK0EwRUFFQjlCb3Y0RFFRQVFIMEdqL2dOQnZ3RVFId3RjQUNBQVFZQUJjVUVBUnlTd0FTQUFRY0FBY1VFQVJ5U3ZBU0FBUVNCeFFRQkhKSzRCSUFCQkVIRkJBRWNrclFFZ0FFRUljVUVBUnlTMEFTQUFRUVJ4UVFCSEpMTUJJQUJCQW5GQkFFY2tzZ0VnQUVFQmNVRUFSeVN4QVF0RkFFRVBKSjBCUVE4a25nRkJEeVNmQVVFUEpLQUJRUUFrb1FGQkFDU2lBVUVBSktNQlFRQWtwQUZCL3dBa3BRRkIvd0FrcGdGQkFTU25BVUVCSktnQlFRQWtxUUVMdlFFQVFRQWtxZ0ZCQUNTckFVRUFKS3dCUVFFa3JRRkJBU1N1QVVFQkpLOEJRUUVrc0FGQkFTU3hBVUVCSkxJQlFRRWtzd0ZCQVNTMEFVRUJKTFVCUVFBa3RnRkJBQ1MzQVVFQUpMa0JRUUFrdWdFUUp4QW9FQ2tRS2tHay9nTkI5d0FRSDBFSEpLc0JRUWNrckFGQnBmNERRZk1CRUI5Qjh3RVFLMEdtL2dOQjhRRVFIMEVCSkxVQkk0d0NCRUJCcFA0RFFRQVFIMEVBSktzQlFRQWtyQUZCcGY0RFFRQVFIMEVBRUN0QnB2NERRZkFBRUI5QkFDUzFBUXNRTEFzK0FDQUFRUUZ4UVFCSEpMOEJJQUJCQW5GQkFFY2t3QUVnQUVFRWNVRUFSeVRCQVNBQVFRaHhRUUJISk1JQklBQkJFSEZCQUVja3d3RWdBQ1MrQVFzK0FDQUFRUUZ4UVFCSEpNVUJJQUJCQW5GQkFFY2t4Z0VnQUVFRWNVRUFSeVRIQVNBQVFRaHhRUUJISk1nQklBQkJFSEZCQUVja3lRRWdBQ1RFQVF0NEFFRUFKTW9CUVFBa3l3RkJBQ1RNQVVFQUpNOEJRUUFrMEFGQkFDVFJBVUVBSk0wQlFRQWt6Z0VqalFJRVFFR0UvZ05CSGhBZlFhQTlKTXNCQlVHRS9nTkJxd0VRSDBITTF3SWt5d0VMUVlmK0EwSDRBUkFmUWZnQkpORUJJNHdDQkVBampRSkZCRUJCaFA0RFFRQVFIMEVFSk1zQkN3c0xRd0JCQUNUU0FVRUFKTk1CSTQwQ0JFQkJndjREUWZ3QUVCOUJBQ1RVQVVFQUpOVUJRUUFrMWdFRlFZTCtBMEgrQUJBZlFRQWsxQUZCQVNUVkFVRUFKTllCQ3d0MUFDT05BZ1JBUWZEK0EwSDRBUkFmUWMvK0EwSCtBUkFmUWMzK0EwSCtBQkFmUVlEK0EwSFBBUkFmUVkvK0EwSGhBUkFmUWV6K0EwSCtBUkFmUWZYK0EwR1BBUkFmQlVIdy9nTkIvd0VRSDBIUC9nTkIvd0VRSDBITi9nTkIvd0VRSDBHQS9nTkJ6d0VRSDBHUC9nTkI0UUVRSHdzTGxnRUJBWDlCd3dJUUhTSUFRY0FCUmdSL1FRRUZJQUJCZ0FGR1FRQWpOQnNMQkVCQkFTU05BZ1ZCQUNTTkFndEJBQ1NuQWtHQXFOYTVCeVNlQWtFQUpKOENRUUFrb0FKQmdLald1UWNrb1FKQkFDU2lBa0VBSktNQ0l6TUVRRUVCSkl3Q0JVRUFKSXdDQ3hBZUVDQVFJUkFsRUNZUUxVRUFFQzVCLy84REk3NEJFQjlCNFFFUUwwR1AvZ01qeEFFUUh4QXdFREVRTWd0S0FDQUFRUUJLSkRNZ0FVRUFTaVEwSUFKQkFFb2tOU0FEUVFCS0pEWWdCRUVBU2lRM0lBVkJBRW9rT0NBR1FRQktKRGtnQjBFQVNpUTZJQWhCQUVva095QUpRUUJLSkR3UU13c0ZBQ09uQWd1NUFRQkJnQWdqandJNkFBQkJnUWdqa0FJNkFBQkJnZ2dqa1FJNkFBQkJnd2dqa2dJNkFBQkJoQWdqa3dJNkFBQkJoUWdqbEFJNkFBQkJoZ2dqbFFJNkFBQkJod2dqbGdJNkFBQkJpQWdqbHdJN0FRQkJpZ2dqbUFJN0FRQkJqQWdqbVFJMkFnQkJrUWdqbWdKQkFFYzZBQUJCa2dnam13SkJBRWM2QUFCQmt3Z2puQUpCQUVjNkFBQkJsQWdqblFKQkFFYzZBQUJCbFFnampBSkJBRWM2QUFCQmxnZ2pqUUpCQUVjNkFBQkJsd2dqamdKQkFFYzZBQUFMYUFCQnlBa2o5d0U3QVFCQnlna2orQUU3QVFCQnpBa2orUUZCQUVjNkFBQkJ6UWtqK2dGQkFFYzZBQUJCemdrait3RkJBRWM2QUFCQnp3a2ovQUZCQUVjNkFBQkIwQWtqL1FGQkFFYzZBQUJCMFFrai9nRkJBRWM2QUFCQjBna2ovd0ZCQUVjNkFBQUxOUUJCK2dranlnRTJBZ0JCL2dranl3RTJBZ0JCZ2dvanpRRkJBRWM2QUFCQmhRb2p6Z0ZCQUVjNkFBQkJoZjRESTh3QkVCOExXQUJCM2dvalcwRUFSem9BQUVIZkNpTmVOZ0lBUWVNS0kxODJBZ0JCNXdvallEWUNBRUhzQ2lOaE5nSUFRZkVLSTJJNkFBQkI4Z29qWXpvQUFFSDNDaU5rUVFCSE9nQUFRZmdLSTJVMkFnQkIvUW9qWmpzQkFBczlBRUdRQ3lOeVFRQkhPZ0FBUVpFTEkzVTJBZ0JCbFFzamRqWUNBRUdaQ3lOM05nSUFRWjRMSTNnMkFnQkJvd3NqZVRvQUFFR2tDeU42T2dBQUN6c0FRZlFMSTVVQlFRQkhPZ0FBUWZVTEk1Y0JOZ0lBUWZrTEk1Z0JOZ0lBUWYwTEk1a0JOZ0lBUVlJTUk1b0JOZ0lBUVljTUk1d0JPd0VBQzRnQkFCQTJRYklJSS9FQk5nSUFRYllJSStZQk9nQUFRY1QrQXlQeUFSQWZRZVFJSTd3QlFRQkhPZ0FBUWVVSUk3MEJRUUJIT2dBQUVEY1FPRUdzQ2lPMkFUWUNBRUd3Q2lPM0FUb0FBRUd4Q2lPNUFUb0FBQkE1RURwQndnc2pnZ0ZCQUVjNkFBQkJ3d3NqaFFFMkFnQkJ4d3NqaGdFMkFnQkJ5d3NqaHdFN0FRQVFPMEVBSktjQ0M3a0JBRUdBQ0MwQUFDU1BBa0dCQ0MwQUFDU1FBa0dDQ0MwQUFDU1JBa0dEQ0MwQUFDU1NBa0dFQ0MwQUFDU1RBa0dGQ0MwQUFDU1VBa0dHQ0MwQUFDU1ZBa0dIQ0MwQUFDU1dBa0dJQ0M4QkFDU1hBa0dLQ0M4QkFDU1lBa0dNQ0NnQ0FDU1pBa0dSQ0MwQUFFRUFTaVNhQWtHU0NDMEFBRUVBU2lTYkFrR1RDQzBBQUVFQVNpU2NBa0dVQ0MwQUFFRUFTaVNkQWtHVkNDMEFBRUVBU2lTTUFrR1dDQzBBQUVFQVNpU05Ba0dYQ0MwQUFFRUFTaVNPQWd0ZUFRRi9RUUFrOFFGQkFDVHlBVUhFL2dOQkFCQWZRY0grQXhBZFFYeHhJUUZCQUNUbUFVSEIvZ01nQVJBZklBQUVRQUpBUVFBaEFBTkFJQUJCZ05nRlRnMEJJQUJCZ01rRmFrSC9BVG9BQUNBQVFRRnFJUUFNQUFBTEFBc0xDNElCQVFGL0krZ0JJUUVnQUVHQUFYRkJBRWNrNkFFZ0FFSEFBSEZCQUVjazZRRWdBRUVnY1VFQVJ5VHFBU0FBUVJCeFFRQkhKT3NCSUFCQkNIRkJBRWNrN0FFZ0FFRUVjVUVBUnlUdEFTQUFRUUp4UVFCSEpPNEJJQUJCQVhGQkFFY2s3d0VqNkFGRlFRQWdBUnNFUUVFQkVENExRUUFqNkFFZ0FSc0VRRUVBRUQ0TEN5b0FRZVFJTFFBQVFRQktKTHdCUWVVSUxRQUFRUUJLSkwwQlFmLy9BeEFkRUM1QmovNERFQjBRTHd0b0FFSElDUzhCQUNUM0FVSEtDUzhCQUNUNEFVSE1DUzBBQUVFQVNpVDVBVUhOQ1MwQUFFRUFTaVQ2QVVIT0NTMEFBRUVBU2lUN0FVSFBDUzBBQUVFQVNpVDhBVUhRQ1MwQUFFRUFTaVQ5QVVIUkNTMEFBRUVBU2lUK0FVSFNDUzBBQUVFQVNpVC9BUXRIQUVINkNTZ0NBQ1RLQVVIK0NTZ0NBQ1RMQVVHQ0NpMEFBRUVBU2lUTkFVR0ZDaTBBQUVFQVNpVE9BVUdGL2dNUUhTVE1BVUdHL2dNUUhTVFBBVUdIL2dNUUhTVFJBUXNIQUVFQUpMb0JDMWdBUWQ0S0kxdEJBRWM2QUFCQjN3b29BZ0FrWGtIakNpZ0NBQ1JmUWVjS0tBSUFKR0JCN0Fvb0FnQWtZVUh4Q2kwQUFDUmlRZklLTFFBQUpHTkI5d290QUFCQkFFb2taRUg0Q2lnQ0FDUmxRZjBLTHdFQUpHWUxQUUJCa0FzdEFBQkJBRW9rY2tHUkN5Z0NBQ1IxUVpVTEtBSUFKSFpCbVFzb0FnQWtkMEdlQ3lnQ0FDUjRRYU1MTFFBQUpIbEJwQXN0QUFBa2VnczdBRUgwQ3kwQUFFRUFTaVNWQVVIMUN5Z0NBQ1NYQVVINUN5Z0NBQ1NZQVVIOUN5Z0NBQ1NaQVVHQ0RDZ0NBQ1NhQVVHSERDOEJBQ1NjQVF2TkFRRUJmeEE5UWJJSUtBSUFKUEVCUWJZSUxRQUFKT1lCUWNUK0F4QWRKUElCUWNEK0F4QWRFRDhRUUVHQS9nTVFIVUgvQVhNazN3RWozd0VpQUVFUWNVRUFSeVRnQVNBQVFTQnhRUUJISk9FQkVFRVFRa0dzQ2lnQ0FDUzJBVUd3Q2kwQUFDUzNBVUd4Q2kwQUFDUzVBVUVBSkxvQkVFUVFSVUhDQ3kwQUFFRUFTaVNDQVVIREN5Z0NBQ1NGQVVISEN5Z0NBQ1NHQVVITEN5OEJBQ1NIQVJCR1FRQWtwd0pCZ0tqV3VRY2tuZ0pCQUNTZkFrRUFKS0FDUVlDbzFya0hKS0VDUVFBa29nSkJBQ1NqQWdzRkFDT05BZ3NGQUNPaEFnc0ZBQ09pQWdzRkFDT2pBZ3V5QWdFR2Z5Tk5JZ1VnQUVaQkFDTk1JQVJHUVFBZ0FFRUlTa0VBSUFGQkFFb2JHeHNFUUNBRFFRRnJFQjFCSUhGQkFFY2hDQ0FERUIxQklIRkJBRWNoQ1VFQUlRTURRQ0FEUVFoSUJFQkJCeUFEYXlBRElBZ2dDVWNiSWdjZ0FHb2lBMEdnQVV3RVFDQUJRYUFCYkNBRGFrRURiRUdBeVFWcUlnUXRBQUFoQ2lBRUlBbzZBQUFnQVVHZ0FXd2dBMnBCQTJ4Qmdja0ZhaUFFTFFBQk9nQUFJQUZCb0FGc0lBTnFRUU5zUVlMSkJXb2dCQzBBQWpvQUFDQUJRYUFCYkNBRGFrR0FrUVJxSUFCQkFDQUhhMnNnQVVHZ0FXeHFRZmlRQkdvdEFBQWlBMEVEY1NJRVFRUnlJQVFnQTBFRWNSczZBQUFnQmtFQmFpRUdDeUFIUVFGcUlRTU1BUXNMQlNBRUpFd0xJQUFnQlU0RVFDQUFRUWhxSWdFZ0FrRUhjU0lDYWlBQklBQWdBa2diSVFVTElBVWtUU0FHQ3lrQUlBQkJnSkFDUmdSQUlBRkJnQUZySUFGQmdBRnFJQUZCZ0FGeEd5RUJDeUFCUVFSMElBQnFDMG9BSUFCQkEzUWdBVUVCZEdvaUFFRUJha0UvY1NJQlFVQnJJQUVnQWh0QmdKQUVhaTBBQUNFQklBQkJQM0VpQUVGQWF5QUFJQUliUVlDUUJHb3RBQUFnQVVIL0FYRkJDSFJ5QzhnQkFDQUJFQjBnQUVFQmRIVkJBM0VoQUNBQlFjaitBMFlFUUNOQklRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUWlFQkRBSUxJME1oQVF3QkN5TkVJUUVMQlNBQlFjbitBMFlFUUNORklRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUmlFQkRBSUxJMGNoQVF3QkN5TklJUUVMQlNNOUlRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUGlFQkRBSUxJejhoQVF3QkN5TkFJUUVMQ3dzZ0FRdVBBd0VHZnlBQklBQVFUU0FGUVFGMGFpSUFRWUNRZm1vZ0FrRUJjVUVOZENJQmFpMEFBQ0VSSUFCQmdaQithaUFCYWkwQUFDRVNJQU1oQUFOQUlBQWdCRXdFUUNBQUlBTnJJQVpxSWc0Z0NFZ0VRRUVBSVFVQ2YwRUJRUWNnQUdzZ0FFRUJJQXRCSUhGRklBdEJBRWdiR3lJQmRDQVNjUVJBUVFJaEJRc2dCVUVCYWdzZ0JVRUJJQUYwSUJGeEd5RUNJNDBDQkg5QkFTQU1RUUJPSUF0QkFFNGJCVUVBQ3dSL0lBdEJCM0VoQVNBTVFRQk9JZ1VFUUNBTVFRZHhJUUVMSUFFZ0FpQUZFRTRpQlVFZmNVRURkQ0VCSUFWQjRBZHhRUVYxUVFOMElROGdCVUdBK0FGeFFRcDFRUU4wQlNBQ1FjZitBeUFLSUFwQkFFd2JJZ29RVHlJRlFZQ0EvQWR4UVJCMUlRRWdCVUdBL2dOeFFRaDFJUThnQlVIL0FYRUxJUVVnQnlBSWJDQU9ha0VEYkNBSmFpSVFJQUU2QUFBZ0VFRUJhaUFQT2dBQUlCQkJBbW9nQlRvQUFDQUhRYUFCYkNBT2FrR0FrUVJxSUFKQkEzRWlBVUVFY2lBQklBdEJnQUZ4UVFCSFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzM0QkEzOGdBMEVIY1NFRFFRQWdBaUFDUVFOMVFRTjBheUFBR3lFSFFhQUJJQUJyUVFjZ0FFRUlha0dnQVVvYklRaEJmeUVDSTQwQ0JFQWdCRUdBMEg1cUxRQUFJZ0pCQ0hGQkFFY2hDU0FDUWNBQWNRUkFRUWNnQTJzaEF3c0xJQVlnQlNBSklBY2dDQ0FESUFBZ0FVR2dBVUdBeVFWQkFDQUNRWDhRVUF1aEFnRUJmeUFEUVFkeElRTWdCU0FHRUUwZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ1ZCZ0pCK2FpQUVRUWh4UVFCSElnWkJEWFJxTFFBQUlRY2dBa0VIY1NFRFFRQWhBaUFCUWFBQmJDQUFha0VEYkVHQXlRVnFJQVJCQjNFQ2Z5QUZRWUdRZm1vZ0JrRUJjVUVOZEdvdEFBQkJBU0FEUVFjZ0Eyc2dCRUVnY1JzaUEzUnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQjNFYklnTkJBQkJPSWdKQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQUpCZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRWlBRUVFY2lBQUlBUkJnQUZ4R3pvQUFBdkVBUUFnQkNBRkVFMGdBMEVIY1VFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURKQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0F4QlBJZ0pCZ0lEOEIzRkJFSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FZRCtBM0ZCQ0hVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVlDUkJHb2dBMEVEY1RvQUFBdlVBUUVHZnlBRFFRTjFJUW9EUUNBRVFhQUJTQVJBSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUtRUVYwSUFKcUlBWkJBM1ZxSWdoQmdKQithaTBBQUNFSFFRQWhDU003QkVBZ0JDQUFJQVlnQ0NBSEVFd2lDMEVBU2dSQVFRRWhDU0FMUVFGcklBUnFJUVFMQ3lBSlJVRUFJem9iQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJSSWdaQkFFb0VRQ0FHUVFGcklBUnFJUVFMQlNBSlJRUkFJNDBDQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJTQlNBRUlBQWdCaUFESUFFZ0J4QlRDd3NMSUFSQkFXb2hCQXdCQ3dzTE1nRURmeVAxQVNFRElBQWo5Z0VpQkVnRVFBOExRUUFnQTBFSGF5SURheUVGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRlFMb3dVQkQzOENRRUVuSVFZRFFDQUdRUUJJRFFFZ0JrRUNkQ0lGUVlEOEEyb2lBeEFkSVFJZ0EwRUJhaEFkSVFjZ0EwRUNhaEFkSVFNZ0FrRVFheUVFSUFkQkNHc2hDMEVJSVFJZ0FRUkFRUkFoQWlBRElBTkJBWEZySVFNTElBQWdBaUFFYWtoQkFDQUFJQVJPR3dSQUlBVkJnL3dEYWhBZElnVkJnQUZ4UVFCSElRd2dCVUVnY1VFQVJ5RU5RWUNBQWlBREVFMGdBaUFBSUFScklnTnJRUUZySUFNZ0JVSEFBSEViUVFGMGFpSURRWUNRZm1vZ0JVRUljVUVBUnlPTkFpSUNJQUliUVFGeFFRMTBJZ0pxTFFBQUlRNGdBMEdCa0g1cUlBSnFMUUFBSVE5QkJ5RURBMEFnQTBFQVRnUkFRUUFoQWdKL1FRRkJBQ0FEUVFkcmF5QURJQTBiSWdSMElBOXhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdCSFFnRG5FYklnUUVRRUVISUFOcklBdHFJZ0pCQUU0RWZ5QUNRYUFCVEFWQkFBc0VRRUVBSVFkQkFDRUtJKzhCUlNPTkFpSUlJQWdiSWdoRkJFQWdBRUdnQVd3Z0FtcEJnSkVFYWkwQUFDSUpJUkFnQ1VFRGNTSUpRUUJMUVFBZ0RCc0VRRUVCSVFjRlFRRkJBQ0FKUVFCTFFRQWdFRUVFY1VFQVIwRUFJNDBDR3hzYklRb0xDMEVCUVFBZ0NrVWdCeHNnQ0JzRVFDT05BZ1JBSUFCQm9BRnNJQUpxUVFOc1FZREpCV29nQlVFSGNTQUVRUUVRVGlJRVFSOXhRUU4wT2dBQUlBQkJvQUZzSUFKcVFRTnNRWUhKQldvZ0JFSGdCM0ZCQlhWQkEzUTZBQUFnQUVHZ0FXd2dBbXBCQTJ4Qmdza0ZhaUFFUVlENEFYRkJDblZCQTNRNkFBQUZJQUJCb0FGc0lBSnFRUU5zUVlESkJXb2dCRUhKL2dOQnlQNERJQVZCRUhFYkVFOGlCRUdBZ1B3SGNVRVFkVG9BQUNBQVFhQUJiQ0FDYWtFRGJFR0J5UVZxSUFSQmdQNERjVUVJZFRvQUFDQUFRYUFCYkNBQ2FrRURiRUdDeVFWcUlBUTZBQUFMQ3dzTElBTkJBV3NoQXd3QkN3c0xJQVpCQVdzaEJnd0FBQXNBQ3d0a0FRRi9RWUNBQWtHQWtBSWo2d0ViSVFGQkFTUHZBU09OQWhzRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBzQVJzajlBRWdBR3BCL3dGeFFRQWo4d0VRVkFzajZnRUVRQ0FBSUFGQmdMZ0NRWUN3QWlQcEFSc1FWUXNqN2dFRVFDQUFJKzBCRUZZTEN5VUJBWDhDUUFOQUlBQkJrQUZLRFFFZ0FFSC9BWEVRVnlBQVFRRnFJUUFNQUFBTEFBc0xSZ0VDZndOQUlBRkJrQUZPUlFSQVFRQWhBQU5BSUFCQm9BRklCRUFnQVVHZ0FXd2dBR3BCZ0pFRWFrRUFPZ0FBSUFCQkFXb2hBQXdCQ3dzZ0FVRUJhaUVCREFFTEN3c2JBRUdQL2dNUUhVRUJJQUIwY2lJQUpNUUJRWS8rQXlBQUVCOExDd0JCQVNUR0FVRUJFRm9MTGdFQmZ3Si9JM2NpQUVFQVNnUi9JM0FGUVFBTEJFQWdBRUVCYXlFQUN5QUFSUXNFUUVFQUpISUxJQUFrZHdzeUFRRi9BbjhqaGdFaUFFRUFTZ1IvSTRBQkJVRUFDd1JBSUFCQkFXc2hBQXNnQUVVTEJFQkJBQ1NDQVFzZ0FDU0dBUXN5QVFGL0FuOGptUUVpQUVFQVNnUi9JNVFCQlVFQUN3UkFJQUJCQVdzaEFBc2dBRVVMQkVCQkFDU1ZBUXNnQUNTWkFRdEhBUUovSUFBa1prR1UvZ01RSFVINEFYRWhBVUdUL2dNZ0FFSC9BWEVpQWhBZlFaVCtBeUFCSUFCQkNIVkJCM0VpQUhJUUh5QUNKRmdnQUNSYUkxZ2pXa0VJZEhJa1hRdWlBUUVDZnlOa1JVRUJJMXNiQkVBUEN5TmxRUUZySWdCQkFFd0VRQ05RQkVBalVDUmxBbjhqWmlJQkkxSjFJUUJCQVNOUkJIOUJBU1JuSUFFZ0FHc0ZJQUFnQVdvTElnQkIvdzlLRFFBYVFRQUxCRUJCQUNSYkN5TlNRUUJLQkVBZ0FCQmZBbjhqWmlJQkkxSjFJUUJCQVNOUkJIOUJBU1JuSUFFZ0FHc0ZJQUFnQVdvTFFmOFBTZzBBR2tFQUN3UkFRUUFrV3dzTEJVRUlKR1VMQlNBQUpHVUxDMGNCQW44algwRUJheUlCUVFCTUJFQWpWeUlCQkVBallTRUFJQUJCRDBoQkFDTldHd1IvSUFCQkFXb0ZJQUJCQVdzZ0FFRUFJQUJCQUVvalZoc2JDeVJoQ3dzZ0FTUmZDMGNCQW44amRrRUJheUlCUVFCTUJFQWpiaUlCQkVBamVDRUFJQUJCRDBoQkFDTnRHd1IvSUFCQkFXb0ZJQUJCQVdzZ0FFRUFJQUJCQUVvamJSc2JDeVI0Q3dzZ0FTUjJDMDRCQW44am1BRkJBV3NpQVVFQVRBUkFJNUFCSWdFRVFDT2FBU0VBSUFCQkQwaEJBQ09QQVJzRWZ5QUFRUUZxQlNBQVFRRnJJQUJCQUNBQVFRQktJNDhCR3hzTEpKb0JDd3NnQVNTWUFRdXBBZ0VDZjBHQXdBQWpqZ0owSWdFaEFpTzJBU0FBYWlJQUlBRk9CRUFnQUNBQ2F5UzJBUUpBQWtBQ1FBSkFBa0FqdVFGQkFXcEJCM0VpQUFSQUlBQkJBa1lOQVFKQUlBQkJCR3NPQkFNQUJBVUFDd3dGQ3lOZ0lnRkJBRW9FZnlOWkJVRUFDd1JBSUFGQkFXc2lBVVVFUUVFQUpGc0xDeUFCSkdBUVhCQmRFRjRNQkFzallDSUJRUUJLQkg4aldRVkJBQXNFUUNBQlFRRnJJZ0ZGQkVCQkFDUmJDd3NnQVNSZ0VGd1FYUkJlRUdBTUF3c2pZQ0lCUVFCS0JIOGpXUVZCQUFzRVFDQUJRUUZySWdGRkJFQkJBQ1JiQ3dzZ0FTUmdFRndRWFJCZURBSUxJMkFpQVVFQVNnUi9JMWtGUVFBTEJFQWdBVUVCYXlJQlJRUkFRUUFrV3dzTElBRWtZQkJjRUYwUVhoQmdEQUVMRUdFUVloQmpDeUFBSkxrQlFRRVBCU0FBSkxZQkMwRUFDM1FCQVg4Q1FBSkFBa0FDUUNBQVFRRkhCRUFDUUNBQVFRSnJEZ01DQXdRQUN3d0VDeU5jSWdBam9RRkhJUUVnQUNTaEFTQUJEd3NqY3lJQUk2SUJSeUVCSUFBa29nRWdBUThMSTRNQklnQWpvd0ZISVFFZ0FDU2pBU0FCRHdzamxnRWlBQ09rQVVjaEFTQUFKS1FCSUFFUEMwRUFDMVVBQWtBQ1FBSkFJQUJCQVVjRVFDQUFRUUpHRFFFZ0FFRURSZzBDREFNTFFRRWdBWFJCZ1FGeFFRQkhEd3RCQVNBQmRFR0hBWEZCQUVjUEMwRUJJQUYwUWY0QWNVRUFSdzhMUVFFZ0FYUkJBWEZCQUVjTGNBRUJmeU5lSUFCcklRQURRQ0FBUVFCTUJFQkJnQkFqWFd0QkFuUWlBVUVDZENBQkk0NENHeVJlSTE0Z0FFRWZkU0lCSUFBZ0FXcHpheUVBSTJOQkFXcEJCM0VrWXd3QkN3c2dBQ1JlSTF4QkFDTmJHd1IvSTJFRlFROFBDeU5USTJNUVpnUi9RUUVGUVg4TGJFRVBhZ3RwQVFGL0kzVWdBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTjBhMEVDZENPT0FuUWtkU04xSUFCQkgzVWlBU0FBSUFGcWMyc2hBQ042UVFGcVFRZHhKSG9NQVFzTElBQWtkU056UVFBamNoc0VmeU40QlVFUER3c2phaU42RUdZRWYwRUJCVUYvQzJ4QkQyb0xEd0FqaHdGQkFYVkJzUDREYWhBZEN5c0JBWDhqaHdGQkFXb2hBQU5BSUFCQklFaEZCRUFnQUVFZ2F5RUFEQUVMQ3lBQUpJY0JFR2traWdFTDV3RUJBMzhqZ3dGRlFRRWpnZ0ViQkVCQkR3OExJNGdCSVFJamlRRUVRRUdjL2dNUUhVRUZkVUVQY1NJQ0pJZ0JRUUFraVFFTEk0b0JJNGNCUVFGeFJVRUNkSFZCRDNFaEFRSkFBa0FDUUFKQUlBSUVRQ0FDUVFGR0RRRWdBa0VDUmcwQ0RBTUxJQUZCQkhVaEFRd0RDMEVCSVFNTUFnc2dBVUVCZFNFQlFRSWhBd3dCQ3lBQlFRSjFJUUZCQkNFREN5QURRUUJLQkg4Z0FTQURiUVZCQUF0QkQyb2hBU09GQVNBQWF5RUFBMEFnQUVFQVRBUkFRWUFRSTRRQmEwRUJkQ09PQW5Ra2hRRWpoUUVnQUVFZmRTSUNJQUFnQW1wemF5RUFFR29NQVFzTElBQWtoUUVnQVF1TUFRRUNmeU9YQVNBQWF5SUFRUUJNQkVBam13RWprUUYwSTQ0Q2RDQUFRUjkxSWdFZ0FDQUJhbk5ySVFBam5BRWlBVUVCZFNJQ0lBRkJBWEVnQWtFQmNYTWlBVUVPZEhJaUFrRy9mM0VnQVVFR2RISWdBaU9TQVJza25BRUxRUUFnQUNBQVFRQklHeVNYQVNPV0FVRUFJNVVCR3dSL0k1b0JCVUVQRHd0QmYwRUJJNXdCUVFGeEcyeEJEMm9MTUFBZ0FFRThSZ1JBUWY4QUR3c2dBRUU4YTBHZ2pRWnNJQUZzUVFOMVFhQ05CbTFCUEdwQm9JMEdiRUdNOFFKdEM1Y0JBUUYvUVFBa3B3RWdBRUVQSTYwQkd5QUJRUThqcmdFYmFpQUNRUThqcndFYmFpQURRUThqc0FFYmFpRUVJQUJCRHlPeEFSc2dBVUVQSTdJQkcyb2hBQ0FBSUFKQkR5T3pBUnRxSVFFZ0EwRVBJN1FCR3lFRFFRQWtxQUZCQUNTcEFTQUVJNnNCUVFGcUVHMGhBQ0FCSUFOcUk2d0JRUUZxRUcwaEFTQUFKS1VCSUFFa3BnRWdBVUgvQVhFZ0FFSC9BWEZCQ0hSeUM0TURBUVYvSTA0Z0FHb2lBaVJPSTE0Z0FtdEJBRXdpQWtVRVFFRUJFR1VoQWdzamFDQUFhaUlCSkdnamRTQUJhMEVBVENJQlJRUkFRUUlRWlNFQkN5TjdJQUJxSkh0QkFDT0ZBU043YTBFQVNpT0pBUnRGSWdSRkJFQkJBeEJsSVFRTEk0c0JJQUJxSklzQkk1Y0JJNHNCYTBFQVRDSUZSUVJBUVFRUVpTRUZDeUFDQkVBalRpRURRUUFrVGlBREVHY2tuUUVMSUFFRVFDTm9JUU5CQUNSb0lBTVFhQ1NlQVFzZ0JBUkFJM3NoQTBFQUpIc2dBeEJySko4QkN5QUZCRUFqaXdFaEEwRUFKSXNCSUFNUWJDU2dBUXRCQVNBRlFRRWdCRUVCSUFFZ0Foc2JHd1JBUVFFa3FRRUxRWUNBZ0FJampnSjBJN2dCYlNJQ0lRRWp0d0VnQUdvaUFDQUNUZ1JBSUFBZ0FXc2hBRUVCSTZnQlFRRWpwd0VqcVFFYkd3UkFJNTBCSTU0Qkk1OEJJNkFCRUc0YUJTQUFKTGNCQ3lPNkFTSUNRUUYwUVlDWndRQnFJZ0VqcFFGQkFtbzZBQUFnQVVFQmFpT21BVUVDYWpvQUFDQUNRUUZxSWdFanV3RkJBWFZCQVd0T0JIOGdBVUVCYXdVZ0FRc2t1Z0VMSUFBa3R3RUxxQU1CQm44Z0FCQm5JUUVnQUJCb0lRSWdBQkJySVFRZ0FCQnNJUVVnQVNTZEFTQUNKSjRCSUFRa253RWdCU1NnQVNPM0FTQUFhaUlBUVlDQWdBSWpqZ0owSTdnQmJVNEVRQ0FBUVlDQWdBSWpqZ0owSTdnQmJXc2hBQ0FCSUFJZ0JDQUZFRzRoQXlPNkFVRUJkRUdBbWNFQWFpSUdJQU5CZ1A0RGNVRUlkVUVDYWpvQUFDQUdRUUZxSUFOQi93RnhRUUpxT2dBQUl6d0VRQ0FCUVE5QkQwRVBFRzRoQVNPNkFVRUJkRUdBbVNGcUlnTWdBVUdBL2dOeFFRaDFRUUpxT2dBQUlBTkJBV29nQVVIL0FYRkJBbW82QUFCQkR5QUNRUTlCRHhCdUlRRWp1Z0ZCQVhSQmdKa3BhaUlDSUFGQmdQNERjVUVJZFVFQ2Fqb0FBQ0FDUVFGcUlBRkIvd0Z4UVFKcU9nQUFRUTlCRHlBRVFROFFiaUVCSTdvQlFRRjBRWUNaTVdvaUFpQUJRWUQrQTNGQkNIVkJBbW82QUFBZ0FrRUJhaUFCUWY4QmNVRUNham9BQUVFUFFROUJEeUFGRUc0aEFTTzZBVUVCZEVHQW1UbHFJZ0lnQVVHQS9nTnhRUWgxUVFKcU9nQUFJQUpCQVdvZ0FVSC9BWEZCQW1vNkFBQUxJN29CUVFGcUlnRWp1d0ZCQVhWQkFXdE9CSDhnQVVFQmF3VWdBUXNrdWdFTElBQWt0d0VMSGdFQmZ5QUFFR1FoQVNBQlJVRUFJemtiQkVBZ0FCQnZCU0FBRUhBTEN5OEJBbjlCMXdBampnSjBJUUVqcWdFaEFBTkFJQUFnQVU0RVFDQUJFSEVnQUNBQmF5RUFEQUVMQ3lBQUpLb0JDNlVEQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR1EvZ05IQkVBZ0FFR1YvZ05HRFFFQ1FDQUFRWkgrQTJzT0ZnWUxFQlFBQnd3UkZRTUlEUklXQkFrT0V4Y0ZDZzhBQ3d3WEMwR1EvZ01RSFVHQUFYSVBDMEdWL2dNUUhVSC9BWElQQzBHYS9nTVFIVUgvQUhJUEMwR2YvZ01RSFVIL0FYSVBDMEdrL2dNUUhROExRWkgrQXhBZFFUOXlEd3RCbHY0REVCMUJQM0lQQzBHYi9nTVFIVUgvQVhJUEMwR2cvZ01RSFVIL0FYSVBDMEdsL2dNUUhROExRWkwrQXhBZER3dEJsLzRERUIwUEMwR2MvZ01RSFVHZkFYSVBDMEdoL2dNUUhROExRWUFCUVFBanRRRWJJUUFnQUVFQmNpQUFRWDV4STFzYklRQWdBRUVDY2lBQVFYMXhJM0liSVFBZ0FFRUVjaUFBUVh0eEk0SUJHeUVBSUFCQkNISWdBRUYzY1NPVkFSdEI4QUJ5RHd0QmsvNERFQjFCL3dGeUR3dEJtUDRERUIxQi93RnlEd3RCbmY0REVCMUIvd0Z5RHd0Qm92NERFQjBQQzBHVS9nTVFIVUcvQVhJUEMwR1ovZ01RSFVHL0FYSVBDMEdlL2dNUUhVRy9BWElQQzBHai9nTVFIVUcvQVhJUEMwRi9DNXdCQVFGL0k5OEJJUUFqNEFFRVFDQUFRWHR4SUFCQkJISWoxd0ViSVFBZ0FFRitjU0FBUVFGeUk5b0JHeUVBSUFCQmQzRWdBRUVJY2lQWUFSc2hBQ0FBUVgxeElBQkJBbklqMlFFYklRQUZJK0VCQkVBZ0FFRitjU0FBUVFGeUk5c0JHeUVBSUFCQmZYRWdBRUVDY2lQY0FSc2hBQ0FBUVh0eElBQkJCSElqM1FFYklRQWdBRUYzY1NBQVFRaHlJOTRCR3lFQUN3c2dBRUh3QVhJTDFRSUFJQUJCZ0lBQ1NBUkFRWDhQQ3lBQVFZREFBa2hCQUNBQVFZQ0FBazRiQkVCQmZ3OExJQUJCZ1B3RFNFRUFJQUJCZ01BRFRoc0VRQ0FBUVlCQWFoQWREd3NnQUVHZi9RTk1RUUFnQUVHQS9BTk9Hd1JBUWY4QlFYOGo1Z0ZCQWtnYkR3c2dBRUhOL2dOR0JFQkIvd0VoQUVITi9nTVFIVUVCY1VVRVFFSCtBU0VBQ3lPT0FrVUVRQ0FBUWY5K2NTRUFDeUFBRHdzZ0FFSEUvZ05HQkVBZ0FDUHlBUkFmSS9JQkR3c2dBRUdtL2dOTVFRQWdBRUdRL2dOT0d3UkFFSElnQUJCekR3c2dBRUd2L2dOTVFRQWdBRUduL2dOT0d3UkFRZjhCRHdzZ0FFRy8vZ05NUVFBZ0FFR3cvZ05PR3dSQUVISWpnZ0VFUUJCcER3dEJmdzhMSUFCQmhQNERSZ1JBSUFBanl3RkJnUDREY1VFSWRTSUFFQjhnQUE4TElBQkJoZjREUmdSQUlBQWp6QUVRSHlQTUFROExJQUJCai80RFJnUkFJOFFCUWVBQmNnOExJQUJCZ1A0RFJnUkFFSFFQQzBGL0N5a0JBWDhqNHdFZ0FFWUVRRUVCSk9VQkN5QUFFSFVpQVVGL1JnUi9JQUFRSFFVZ0FVSC9BWEVMQzZRQ0FRTi9JL3NCQkVBUEN5UDhBU0VESS8wQklRSWdBRUgvUDB3RVFDQUNCSDhnQVVFUWNVVUZRUUFMUlFSQUlBRkJEM0VpQUFSQUlBQkJDa1lFUUVFQkpQa0JDd1ZCQUNUNUFRc0xCU0FBUWYvL0FFd0VRQ1AvQVNJRUJIOGdBRUgvM3dCTUJVRUJDd1JBSUFGQkQzRWo5d0VnQWhzaEFDQURCSDhnQVVFZmNTRUJJQUJCNEFGeEJTUCtBUVIvSUFGQi93QnhJUUVnQUVHQUFYRUZRUUFnQUNBRUd3c0xJUUFnQUNBQmNpVDNBUVVqOXdGQi93RnhJQUZCQUVwQkNIUnlKUGNCQ3dWQkFDQUFRZisvQVV3Z0Foc0VRQ1A2QVVFQUlBTWJCRUFqOXdGQkgzRWdBVUhnQVhGeUpQY0JEd3NnQVVFUGNTQUJRUU54SS84Qkd5VDRBUVZCQUNBQVFmLy9BVXdnQWhzRVFDQURCRUFnQVVFQmNVRUFSeVQ2QVFzTEN3c0xDemNCQVg4alVTRUJJQUJCOEFCeFFRUjFKRkFnQUVFSWNVRUFSeVJSSUFCQkIzRWtVa0VBSTJjalVSdEJBQ0FCR3dSQVFRQWtXd3NMTkFBZ0FFRUVkVUVQY1NSVklBQkJDSEZCQUVja1ZpQUFRUWR4SkZjZ0FFSDRBWEZCQUVvaUFDUmNJQUJGQkVBZ0FDUmJDd3MwQUNBQVFRUjFRUTl4Skd3Z0FFRUljVUVBUnlSdElBQkJCM0VrYmlBQVFmZ0JjVUVBU2lJQUpITWdBRVVFUUNBQUpISUxDemtBSUFCQkJIVkJEM0VramdFZ0FFRUljVUVBUnlTUEFTQUFRUWR4SkpBQklBQkIrQUZ4UVFCS0lnQWtsZ0VnQUVVRVFDQUFKSlVCQ3dzNEFDQUFRUVIxSkpFQklBQkJDSEZCQUVja2tnRWdBRUVIY1NJQUpKTUJJQUJCQVhRaUFFRUJTQVJBUVFFaEFBc2dBRUVEZENTYkFRdWJBUUVDZjBFQkpGc2pZRVVFUUNOUEpHQUxRWUFRSTExclFRSjBJZ0JCQW5RZ0FDT09BaHNrWGlOWEpGOGpWU1JoSTEwa1ppTlFCRUFqVUNSbEJVRUlKR1VMUVFFalVrRUFTaUlBSTFCQkFFb2JKR1JCQUNSbklBQUVmd0ovSTJZaUFDTlNkU0VCUVFFalVRUi9RUUVrWnlBQUlBRnJCU0FBSUFGcUMwSC9EMG9OQUJwQkFBc0ZRUUFMQkVCQkFDUmJDeU5jUlFSQVFRQWtXd3NMa1FFQkFuOGdBRUVIY1NJQkpGb2pXQ0FCUVFoMGNpUmRJN2tCUVFGeFFRRkdJUUlqV1VVaUFRUkFJQUJCd0FCeFFRQkhJUUVMSUFKRkJFQkJBQ0FCSTJCQkFFd2JCRUFqWUVFQmF5UmdRUUFqWUVVZ0FFR0FBWEViQkVCQkFDUmJDd3NMSUFCQndBQnhRUUJISkZrZ0FFR0FBWEVFUUJCOUkxbEJBRUVBSTJBalQwWWdBaHNiQkVBallFRUJheVJnQ3dzTE1RQkJBU1J5STNkRkJFQWphU1IzQzBHQUVDTjBhMEVDZENPT0FuUWtkU051SkhZamJDUjRJM05GQkVCQkFDUnlDd3VSQVFFQ2Z5QUFRUWR4SWdFa2NTTnZJQUZCQ0hSeUpIUWp1UUZCQVhGQkFVWWhBaU53UlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQWtVRVFFRUFJQUVqZDBFQVRCc0VRQ04zUVFGckpIZEJBQ04zUlNBQVFZQUJjUnNFUUVFQUpISUxDd3NnQUVIQUFIRkJBRWNrY0NBQVFZQUJjUVJBRUg4amNFRUFRUUFqZHlOcFJpQUNHeHNFUUNOM1FRRnJKSGNMQ3dzK0FFRUJKSUlCSTRZQlJRUkFJM3draGdFTFFZQVFJNFFCYTBFQmRDT09BblFraFFFamhRRkJCbW9raFFGQkFDU0hBU09EQVVVRVFFRUFKSUlCQ3d1YUFRRUNmeUFBUVFkeElnRWtnUUVqZnlBQlFRaDBjaVNFQVNPNUFVRUJjVUVCUmlJQ1JRUkFRUUFnQUVIQUFIRkJBRWNqZ0FFYklRRkJBQ0FCSTRZQlFRQk1Hd1JBSTRZQlFRRnJKSVlCUVFBamhnRkZJQUJCZ0FGeEd3UkFRUUFrZ2dFTEN3c2dBRUhBQUhGQkFFY2tnQUVnQUVHQUFYRUVRQkNCQVNPQUFVRUFRUUFqaGdFamZFWWdBaHNiQkVBamhnRkJBV3NraGdFTEN3dEJBRUVCSkpVQkk1a0JSUVJBSTR3QkpKa0JDeU9iQVNPUkFYUWpqZ0owSkpjQkk1QUJKSmdCSTQ0QkpKb0JRZi8vQVNTY0FTT1dBVVVFUUVFQUpKVUJDd3VMQVFFQ2Z5TzVBVUVCY1VFQlJpRUNJNVFCUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQWtVRVFFRUFJQUVqbVFGQkFFd2JCRUFqbVFGQkFXc2ttUUZCQUNPWkFVVWdBRUdBQVhFYkJFQkJBQ1NWQVFzTEN5QUFRY0FBY1VFQVJ5U1VBU0FBUVlBQmNRUkFFSU1CSTVRQlFRQkJBQ09aQVNPTUFVWWdBaHNiQkVBam1RRkJBV3NrbVFFTEN3dWNCQUFqdFFGRlFRQWdBRUdtL2dOSEd3UkFRUUFQQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQm12NERSZzBCQWtBZ0FFR1IvZ05yRGhZREJ3c1BBQVFJREJBQUJRa05FUUFHQ2c0U0V4UVZBQXNNRlFzZ0FSQjREQlVMUVFBZ0FVR0FBWEZCQUVjaUFDT0RBUnNFUUVFQUpJb0JDeUFBSklNQklBQkZCRUFnQUNTQ0FRc01GQXNnQVVFR2RVRURjU1JUSUFGQlAzRWtWQ05QSTFSckpHQU1Fd3NnQVVFR2RVRURjU1JxSUFGQlAzRWtheU5wSTJ0ckpIY01FZ3NnQVNSOUkzd2pmV3NraGdFTUVRc2dBVUUvY1NTTkFTT01BU09OQVdza21RRU1FQXNnQVJCNURBOExJQUVRZWd3T0MwRUJKSWtCSUFGQkJYVkJEM0VrZmd3TkN5QUJFSHNNREFzZ0FTUllJMXBCQ0hRZ0FYSWtYUXdMQ3lBQkpHOGpjVUVJZENBQmNpUjBEQW9MSUFFa2Z5T0JBVUVJZENBQmNpU0VBUXdKQ3lBQkVId01DQXNnQVJCK0RBY0xJQUVRZ0FFTUJnc2dBUkNDQVF3RkN5QUJFSVFCREFRTElBRkJCSFZCQjNFa3F3RWdBVUVIY1NTc0FVRUJKS2NCREFNTElBRVFLMEVCSktnQkRBSUxJN1VCSWdBRWYwRUFCU0FCUVlBQmNRc0VRRUVISkxrQlFRQWtZMEVBSkhvTElBRkJnQUZ4UlVFQUlBQWJCRUFDUUVHUS9nTWhBQU5BSUFCQnB2NERUZzBCSUFCQkFCQ1NBU0FBUVFGcUlRQU1BQUFMQUFzTElBRkJnQUZ4UVFCSEpMVUJEQUVMUVFFUEMwRUJDendCQVg4Z0FFRUlkQ0VCUVFBaEFBTkFBa0FnQUVHZkFVb05BQ0FBUVlEOEEyb2dBQ0FCYWhBZEVCOGdBRUVCYWlFQURBRUxDMEdFQlNTRkFnc2pBUUYvSTRBQ0VCMGhBQ09CQWhBZFFmOEJjU0FBUWY4QmNVRUlkSEpCOFA4RGNRc25BUUYvSTRJQ0VCMGhBQ09EQWhBZFFmOEJjU0FBUWY4QmNVRUlkSEpCOEQ5eFFZQ0FBbW9MaGdFQkEzOGpqUUpGQkVBUEN5QUFRWUFCY1VWQkFDT0dBaHNFUUVFQUpJWUNJNFFDRUIxQmdBRnlJUUFqaEFJZ0FCQWZEd3NRaHdFaEFSQ0lBU0VDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKSVlDSUFNa2h3SWdBU1NJQWlBQ0pJa0NJNFFDSUFCQi8zNXhFQjhGSUFFZ0FpQURFSk1CSTRRQ1FmOEJFQjhMQzFVQkJIOUJBU05MSWdNZ0FFWWpTaUFBUmhzRVFDQUFRUUZySWdRUUhVRy9mM0VpQWtFL2NTSUZRVUJySUFVZ0FDQURSaHRCZ0pBRWFpQUJPZ0FBSUFKQmdBRnhCRUFnQkNBQ1FRRnFRWUFCY2hBZkN3c0xNUUFDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdNQ0F3UUFDd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzZkFDQUFRUUVqMFFFUWl3RWlBSFJ4Qkg5QkFTQUFkQ0FCY1VVRlFRQUxDNFlCQVFSL0EwQWdBaUFBU0FSQUlBSkJCR29oQWlQTEFTSUJRUVJxUWYvL0EzRWlBeVRMQVNQUUFRUkFJODRCSVFRanpRRUVRQ1BQQVNUTUFVRUJKTWNCUVFJUVdrRUFKTTBCUVFFa3pnRUZJQVFFUUVFQUpNNEJDd3NnQVNBREVJd0JCRUFqekFGQkFXb2lBVUgvQVVvRVFFRUJKTTBCUVFBaEFRc2dBU1RNQVFzTERBRUxDd3NOQUNQS0FSQ05BVUVBSk1vQkMwWUJBWDhqeXdFaEFFRUFKTXNCUVlUK0EwRUFFQjhqMEFFRWZ5QUFRUUFRakFFRlFRQUxCRUFqekFGQkFXb2lBRUgvQVVvRVFFRUJKTTBCUVFBaEFBc2dBQ1RNQVFzTGZ3RURmeVBRQVNFQklBQkJCSEZCQUVjazBBRWdBRUVEY1NFQ0lBRkZCRUFqMFFFUWl3RWhBU0FDRUlzQklRTWp5d0VoQUNQUUFRUi9RUUVnQVhRZ0FIRUZRUUVnQTNRZ0FIRkJBRWRCQUVFQklBRjBJQUJ4R3dzRVFDUE1BVUVCYWlJQVFmOEJTZ1JBUVFFa3pRRkJBQ0VBQ3lBQUpNd0JDd3NnQWlUUkFRdkNCZ0VCZndKQUFrQWdBRUhOL2dOR0JFQkJ6ZjRESUFGQkFYRVFId3dCQ3lBQVFkRCtBMFpCQUNPTUFoc0VRRUVBSkl3Q1FmOEJKSmdDREFJTElBQkJnSUFDU0FSQUlBQWdBUkIzREFFTElBQkJnTUFDU0VFQUlBQkJnSUFDVGhzTkFTQUFRWUQ4QTBoQkFDQUFRWURBQTA0YkJFQWdBRUdBUUdvZ0FSQWZEQUlMSUFCQm4vMERURUVBSUFCQmdQd0RUaHNFUUNQbUFVRUNUZzhMSUFCQi8vMERURUVBSUFCQm9QMERUaHNOQUNBQVFZTCtBMFlFUUNBQlFRRnhRUUJISk5RQklBRkJBbkZCQUVjazFRRWdBVUdBQVhGQkFFY2sxZ0ZCQVE4TElBQkJwdjREVEVFQUlBQkJrUDREVGhzRVFCQnlJQUFnQVJDRkFROExJQUJCdi80RFRFRUFJQUJCc1A0RFRoc0VRQkJ5STRJQkJFQWpod0ZCQVhWQnNQNERhaUFCRUI4TUFnc01BZ3NnQUVITC9nTk1RUUFnQUVIQS9nTk9Hd1JBSUFCQndQNERSZ1JBSUFFUVB3d0RDeUFBUWNIK0EwWUVRRUhCL2dNZ0FVSDRBWEZCd2Y0REVCMUJCM0Z5UVlBQmNoQWZEQUlMSUFCQnhQNERSZ1JBUVFBazhnRWdBRUVBRUI4TUFnc2dBRUhGL2dOR0JFQWdBU1RuQVF3REN5QUFRY2IrQTBZRVFDQUJFSVlCREFNTEFrQUNRQUpBQWtBZ0FFSEQvZ05IQkVBZ0FFSEMvZ05yRGdvQkJBUUVCQVFFQkFNQ0JBc2dBU1R6QVF3R0N5QUJKUFFCREFVTElBRWs5UUVNQkFzZ0FTVDJBUXdEQ3d3Q0N5T0VBaUFBUmdSQUlBRVFpUUVNQVF0QkFTT0tBaUFBUmlPTEFpQUFSaHNFUUNPR0FnUkFJNGdDSWdKQmdJQUJUZ1IvSUFKQi8vOEJUQVZCQUFzRWYwRUJCU0FDUWYrL0EweEJBQ0FDUVlDZ0EwNGJDdzBDQ3dzZ0FDTkxURUVBSUFBalNVNGJCRUFnQUNBQkVJb0JEQUlMSUFCQmgvNERURUVBSUFCQmhQNERUaHNFUUJDT0FRSkFBa0FDUUFKQUlBQkJoUDREUndSQUlBQkJoZjREYXc0REFRSURCQXNRandFTUJRc0NRQ1BRQVFSQUk4NEJEUUVqelFFRVFFRUFKTTBCQ3dzZ0FTVE1BUXNNQlFzZ0FTVFBBU1BPQVVFQUk5QUJHd1JBSUFFa3pBRkJBQ1RPQVFzTUJBc2dBUkNRQVF3REN3d0NDeUFBUVlEK0EwWUVRQ0FCUWY4QmN5VGZBU1BmQVNJQ1FSQnhRUUJISk9BQklBSkJJSEZCQUVjazRRRUxJQUJCai80RFJnUkFJQUVRTHd3Q0N5QUFRZi8vQTBZRVFDQUJFQzRNQWd0QkFROExRUUFQQzBFQkN5QUFJK1FCSUFCR0JFQkJBU1RsQVFzZ0FDQUJFSkVCQkVBZ0FDQUJFQjhMQzF3QkEzOERRQUpBSUFNZ0FrNE5BQ0FBSUFOcUVIWWhCU0FCSUFOcUlRUURRQ0FFUWYrL0FreEZCRUFnQkVHQVFHb2hCQXdCQ3dzZ0JDQUZFSklCSUFOQkFXb2hBd3dCQ3dzamhRSkJJQ09PQW5RZ0FrRUVkV3hxSklVQ0MzTUJBbjhqaGdKRkJFQVBDMEVRSVFBamlBSWppUUlDZnlPSEFpSUJRUkJJQkVBZ0FTRUFDeUFBQ3hDVEFTT0lBaUFBYWlTSUFpT0pBaUFBYWlTSkFpQUJJQUJySWdBa2h3SWpoQUloQVNBQVFRQk1CRUJCQUNTR0FpQUJRZjhCRUI4RklBRWdBRUVFZFVFQmEwSC9mbkVRSHdzTE13QWo4Z0VqNXdGR1FRQWdBRUVCUmtFQklBQWJHd1JBSUFGQkJISWlBVUhBQUhFRVFCQmJDd1VnQVVGN2NTRUJDeUFCQzRFQ0FRVi9JK2dCUlFSQUR3c2o1Z0VoQUNBQUkvSUJJZ0pCa0FGT0JIOUJBUVZCK0FJampnSjBJZ0VoQXlQeEFTSUVJQUZPQkg5QkFnVkJBMEVBSUFRZ0EwNGJDd3NpQVVjRVFFSEIvZ01RSFNFQUlBRWs1Z0ZCQUNFQ0FrQUNRQUpBQWtBZ0FRUkFJQUZCQVdzT0F3RUNBd1FMSUFCQmZIRWlBRUVJY1VFQVJ5RUNEQU1MSUFCQmZYRkJBWElpQUVFUWNVRUFSeUVDREFJTElBQkJmbkZCQW5JaUFFRWdjVUVBUnlFQ0RBRUxJQUJCQTNJaEFBc2dBZ1JBRUZzTElBRkZCRUFRbEFFTElBRkJBVVlFUUVFQkpNVUJRUUFRV2d0QndmNERJQUVnQUJDVkFSQWZCU0FDUVprQlJnUkFRY0grQXlBQlFjSCtBeEFkRUpVQkVCOExDd3VnQVFFQmZ5UG9BUVJBSS9FQklBQnFKUEVCSXpnaEFRTkFJL0VCUVFRampnSWlBSFJCeUFNZ0FIUWo4Z0ZCbVFGR0cwNEVRQ1B4QVVFRUk0NENJZ0IwUWNnRElBQjBJL0lCUVprQlJodHJKUEVCSS9JQklnQkJrQUZHQkVBZ0FRUkFFRmdGSUFBUVZ3c1FXVUYvSkV4QmZ5Uk5CU0FBUVpBQlNBUkFJQUZGQkVBZ0FCQlhDd3NMUVFBZ0FFRUJhaUFBUVprQlNoc2s4Z0VNQVFzTEN4Q1dBUXM0QVFGL1FRUWpqZ0lpQUhSQnlBTWdBSFFqOGdGQm1RRkdHeUVBQTBBajhBRWdBRTRFUUNBQUVKY0JJL0FCSUFCckpQQUJEQUVMQ3d1eUFRRURmeVBXQVVVRVFBOExBMEFnQXlBQVNBUkFJQU5CQkdvaEF3Si9JOUlCSWdKQkJHb2lBVUgvL3dOS0JFQWdBVUdBZ0FScklRRUxJQUVMSk5JQklBSkJBVUVDUVFjajFRRWJJZ0owY1FSL1FRRWdBblFnQVhGRkJVRUFDd1JBUVlIK0EwR0IvZ01RSFVFQmRFRUJha0gvQVhFUUh5UFRBVUVCYWlJQlFRaEdCRUJCQUNUVEFVRUJKTWdCUVFNUVdrR0MvZ05CZ3Y0REVCMUIvMzV4RUI5QkFDVFdBUVVnQVNUVEFRc0xEQUVMQ3d1VkFRQWpoUUpCQUVvRVFDT0ZBaUFBYWlFQVFRQWtoUUlMSTVrQ0lBQnFKSmtDSTUwQ1JRUkFJellFUUNQd0FTQUFhaVR3QVJDWUFRVWdBQkNYQVFzak5RUkFJNm9CSUFCcUpLb0JFSElGSUFBUWNRc2dBQkNaQVFzak53UkFJOG9CSUFCcUpNb0JFSTRCQlNBQUVJMEJDeU9nQWlBQWFpSUFJNTRDVGdSQUk1OENRUUZxSko4Q0lBQWpuZ0pySVFBTElBQWtvQUlMREFCQkJCQ2FBU09ZQWhBZEN5a0JBWDlCQkJDYUFTT1lBa0VCYWtILy93TnhFQjBoQUJDYkFVSC9BWEVnQUVIL0FYRkJDSFJ5Q3c0QVFRUVFtZ0VnQUNBQkVKSUJDekFBUVFFZ0FIUkIvd0Z4SVFBZ0FVRUFTZ1JBSTVZQ0lBQnlRZjhCY1NTV0FnVWpsZ0lnQUVIL0FYTnhKSllDQ3dzSkFFRUZJQUFRbmdFTE9nRUJmeUFCUVFCT0JFQWdBRUVQY1NBQlFROXhha0VRY1VFQVJ4Q2ZBUVVnQVVFZmRTSUNJQUVnQW1welFROXhJQUJCRDNGTEVKOEJDd3NKQUVFSElBQVFuZ0VMQ1FCQkJpQUFFSjRCQ3drQVFRUWdBQkNlQVFzL0FRSi9JQUZCZ1A0RGNVRUlkU0VDSUFGQi93RnhJZ0VoQXlBQUlBRVFrUUVFUUNBQUlBTVFId3NnQUVFQmFpSUFJQUlRa1FFRVFDQUFJQUlRSHdzTERnQkJDQkNhQVNBQUlBRVFwQUVMV2dBZ0FnUkFJQUJCLy84RGNTSUFJQUZxSUFBZ0FYTnpJZ0JCRUhGQkFFY1Fud0VnQUVHQUFuRkJBRWNRb3dFRklBQWdBV3BCLy84RGNTSUNJQUJCLy84RGNVa1Fvd0VnQUNBQmN5QUNjMEdBSUhGQkFFY1Fud0VMQ3dzQVFRUVFtZ0VnQUJCMkM2a0ZBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCUmcwQkFrQWdBRUVDYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN3d1ZDeENjQVVILy93TnhJZ0JCZ1A0RGNVRUlkU1NRQWlBQVFmOEJjU1NSQWd3UEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNpT1BBaENkQVF3VEN5T1JBa0gvQVhFamtBSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTU1FBZ3dUQ3lPUUFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU1FBZ3dOQ3lPUUFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU1FBZ3dOQ3hDYkFVSC9BWEVra0FJTURRc2pqd0lpQUVHQUFYRkJnQUZHRUtNQklBQkJBWFFnQUVIL0FYRkJCM1p5UWY4QmNTU1BBZ3dOQ3hDY0FVSC8vd054STVjQ0VLVUJEQWdMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5SWdBamtRSkIvd0Z4STVBQ1FmOEJjVUVJZEhJaUFVRUFFS1lCSUFBZ0FXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2xBSWdBRUgvQVhFa2xRSkJBQkNpQVVFSUR3c2prUUpCL3dGeEk1QUNRZjhCY1VFSWRISVFwd0ZCL3dGeEpJOENEQXNMSTVFQ1FmOEJjU09RQWtIL0FYRkJDSFJ5UVFGclFmLy9BM0VpQUVHQS9nTnhRUWgxSkpBQ0RBc0xJNUVDSWdCQkFSQ2dBU0FBUVFGcVFmOEJjU0lBSkpFQ0RBVUxJNUVDSWdCQmZ4Q2dBU0FBUVFGclFmOEJjU0lBSkpFQ0RBVUxFSnNCUWY4QmNTU1JBZ3dGQ3lPUEFpSUFRUUZ4UVFCTEVLTUJJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU1NQQWd3RkMwRi9Ed3NqbUFKQkFtcEIvLzhEY1NTWUFnd0VDeUFBUlJDaEFVRUFFS0lCREFNTElBQkZFS0VCUVFFUW9nRU1BZ3NqbUFKQkFXcEIvLzhEY1NTWUFnd0JDMEVBRUtFQlFRQVFvZ0ZCQUJDZkFRdEJCQThMSUFCQi93RnhKSkVDUVFnTG1RWUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJFRWNFUUNBQVFSRkdEUUVDUUNBQVFSSnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSTQwQ0JFQkJ6ZjRERUtjQlFmOEJjU0lBUVFGeEJFQkJ6ZjRESUFCQmZuRWlBRUdBQVhFRWYwRUFKSTRDSUFCQi8zNXhCVUVCSkk0Q0lBQkJnQUZ5Q3hDZEFVSEVBQThMQzBFQkpKMENEQkFMRUp3QlFmLy9BM0VpQUVHQS9nTnhRUWgxSkpJQ0lBQkIvd0Z4SkpNQ0k1Z0NRUUpxUWYvL0EzRWttQUlNRVFzamt3SkIvd0Z4STVJQ1FmOEJjVUVJZEhJamp3SVFuUUVNRUFzamt3SkIvd0Z4STVJQ1FmOEJjVUVJZEhKQkFXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2tnSU1FQXNqa2dJaUFFRUJFS0FCSUFCQkFXcEIvd0Z4SkpJQ0k1SUNSUkNoQVVFQUVLSUJEQTRMSTVJQ0lnQkJmeENnQVNBQVFRRnJRZjhCY1NTU0FpT1NBa1VRb1FGQkFSQ2lBUXdOQ3hDYkFVSC9BWEVra2dJTUNnc2pqd0lpQVVHQUFYRkJnQUZHSVFBamxnSkJCSFpCQVhFZ0FVRUJkSEpCL3dGeEpJOENEQW9MRUpzQklRQWptQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpKZ0NRUWdQQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2lJQUk1TUNRZjhCY1NPU0FrSC9BWEZCQ0hSeUlnRkJBQkNtQVNBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpKUUNJQUJCL3dGeEpKVUNRUUFRb2dGQkNBOExJNU1DUWY4QmNTT1NBa0gvQVhGQkNIUnlFS2NCUWY4QmNTU1BBZ3dJQ3lPVEFrSC9BWEVqa2dKQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNTU0Fnd0lDeU9UQWlJQVFRRVFvQUVnQUVFQmFrSC9BWEVpQUNTVEFpQUFSUkNoQVVFQUVLSUJEQVlMSTVNQ0lnQkJmeENnQVNBQVFRRnJRZjhCY1NJQUpKTUNJQUJGRUtFQlFRRVFvZ0VNQlFzUW13RkIvd0Z4SkpNQ0RBSUxJNDhDSWdGQkFYRkJBVVloQUNPV0FrRUVka0VCY1VFSGRDQUJRZjhCY1VFQmRuSWtqd0lNQWd0QmZ3OExJNWdDUVFGcVFmLy9BM0VrbUFJTUFRc2dBQkNqQVVFQUVLRUJRUUFRb2dGQkFCQ2ZBUXRCQkE4TElBQkIvd0Z4SkpNQ1FRZ0w5UVlCQW44Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFTQkhCRUFnQUVFaFJnMEJBa0FnQUVFaWF3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU9XQWtFSGRrRUJjUVJBSTVnQ1FRRnFRZi8vQTNFa21BSUZFSnNCSVFBam1BSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054SkpnQ0MwRUlEd3NRbkFGQi8vOERjU0lBUVlEK0EzRkJDSFVrbEFJZ0FFSC9BWEVrbFFJam1BSkJBbXBCLy84RGNTU1lBZ3dVQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2lJQUk0OENFSjBCREE4TEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpKUUNEQTBMSTVRQ0lnQkJBUkNnQVNBQVFRRnFRZjhCY1NJQUpKUUNEQTRMSTVRQ0lnQkJmeENnQVNBQVFRRnJRZjhCY1NJQUpKUUNEQTRMRUpzQlFmOEJjU1NVQWd3T0MwRUdRUUFqbGdJaUFrRUZka0VCY1VFQVN4c2lBRUhnQUhJZ0FDQUNRUVIyUVFGeFFRQkxHeUVBSTQ4Q0lRRWdBa0VHZGtFQmNVRUFTd1IvSUFFZ0FHdEIvd0Z4QlNBQklBQkJCbklnQUNBQlFROXhRUWxMR3lJQVFlQUFjaUFBSUFGQm1RRkxHeUlBYWtIL0FYRUxJZ0ZGRUtFQklBQkI0QUJ4UVFCSEVLTUJRUUFRbndFZ0FTU1BBZ3dPQ3lPV0FrRUhka0VCY1VFQVN3UkFFSnNCSVFBam1BSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054SkpnQ0JTT1lBa0VCYWtILy93TnhKSmdDQzBFSUR3c2psUUpCL3dGeEk1UUNRZjhCY1VFSWRISWlBQ0FBUWYvL0EzRkJBQkNtQVNBQVFRRjBRZi8vQTNFaUFFR0EvZ054UVFoMUpKUUNJQUJCL3dGeEpKVUNRUUFRb2dGQkNBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlJZ0FRcHdGQi93RnhKSThDREFjTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpKUUNEQVVMSTVVQ0lnQkJBUkNnQVNBQVFRRnFRZjhCY1NJQUpKVUNEQVlMSTVVQ0lnQkJmeENnQVNBQVFRRnJRZjhCY1NJQUpKVUNEQVlMRUpzQlFmOEJjU1NWQWd3R0N5T1BBa0YvYzBIL0FYRWtqd0pCQVJDaUFVRUJFSjhCREFZTFFYOFBDeUFBUWY4QmNTU1ZBa0VJRHdzZ0FFRUJha0gvL3dOeElnQkJnUDREY1VFSWRTU1VBaUFBUWY4QmNTU1ZBZ3dEQ3lBQVJSQ2hBVUVBRUtJQkRBSUxJQUJGRUtFQlFRRVFvZ0VNQVFzam1BSkJBV3BCLy84RGNTU1lBZ3RCQkF2eEJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQk1FY0VRQ0FBUVRGR0RRRUNRQ0FBUVRKckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJNVlDUVFSMlFRRnhCRUFqbUFKQkFXcEIvLzhEY1NTWUFnVVFtd0VoQUNPWUFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VrbUFJTFFRZ1BDeENjQVVILy93TnhKSmNDSTVnQ1FRSnFRZi8vQTNFa21BSU1FUXNqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElpQUNPUEFoQ2RBUXdPQ3lPWEFrRUJha0gvL3dOeEpKY0NRUWdQQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2lJQUVLY0JJZ0ZCQVJDZ0FTQUJRUUZxUWY4QmNTSUJSUkNoQVVFQUVLSUJJQUFnQVJDZEFRd09DeU9WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaUlBRUtjQklnRkJmeENnQVNBQlFRRnJRZjhCY1NJQlJSQ2hBVUVCRUtJQklBQWdBUkNkQVF3TkN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNoQ2JBVUgvQVhFUW5RRU1Dd3RCQUJDaUFVRUFFSjhCUVFFUW93RU1Dd3NqbGdKQkJIWkJBWEZCQVVZRVFCQ2JBU0VBSTVnQ0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NZQWdVam1BSkJBV3BCLy84RGNTU1lBZ3RCQ0E4TEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUlnQWpsd0pCQUJDbUFTT1hBaUFBYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NVQWlBQVFmOEJjU1NWQWtFQUVLSUJRUWdQQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2lJQUVLY0JRZjhCY1NTUEFnd0dDeU9YQWtFQmEwSC8vd054SkpjQ1FRZ1BDeU9QQWlJQVFRRVFvQUVnQUVFQmFrSC9BWEVpQUNTUEFpQUFSUkNoQVVFQUVLSUJEQVlMSTQ4Q0lnQkJmeENnQVNBQVFRRnJRZjhCY1NJQUpJOENJQUJGRUtFQlFRRVFvZ0VNQlFzUW13RkIvd0Z4Skk4Q0RBTUxRUUFRb2dGQkFCQ2ZBU09XQWtFRWRrRUJjVUVBVFJDakFRd0RDMEYvRHdzZ0FFRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU1VBaUFBUWY4QmNTU1ZBZ3dCQ3lPWUFrRUJha0gvL3dOeEpKZ0NDMEVFQzRJQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBQkhCRUFnQUVIQkFFWU5BUUpBSUFCQndnQnJEZzREQkFVR0J3Z0pFUW9MREEwT0R3QUxEQThMREE4TEk1RUNKSkFDREE0TEk1SUNKSkFDREEwTEk1TUNKSkFDREF3TEk1UUNKSkFDREFzTEk1VUNKSkFDREFvTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUVLY0JRZjhCY1NTUUFnd0pDeU9QQWlTUUFnd0lDeU9RQWlTUkFnd0hDeU9TQWlTUkFnd0dDeU9UQWlTUkFnd0ZDeU9VQWlTUkFnd0VDeU9WQWlTUkFnd0RDeU9WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtrUUlNQWdzamp3SWtrUUlNQVF0QmZ3OExRUVFML1FFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFCSEJFQWdBRUhSQUVZTkFRSkFJQUJCMGdCckRnNFFBd1FGQmdjSUNRb1FDd3dORGdBTERBNExJNUFDSkpJQ0RBNExJNUVDSkpJQ0RBMExJNU1DSkpJQ0RBd0xJNVFDSkpJQ0RBc0xJNVVDSkpJQ0RBb0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCUWY4QmNTU1NBZ3dKQ3lPUEFpU1NBZ3dJQ3lPUUFpU1RBZ3dIQ3lPUkFpU1RBZ3dHQ3lPU0FpU1RBZ3dGQ3lPVUFpU1RBZ3dFQ3lPVkFpU1RBZ3dEQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2hDbkFVSC9BWEVra3dJTUFnc2pqd0lra3dJTUFRdEJmdzhMUVFRTC9RRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBQkhCRUFnQUVIaEFFWU5BUUpBSUFCQjRnQnJEZzREQkJBRkJnY0lDUW9MREJBTkRnQUxEQTRMSTVBQ0pKUUNEQTRMSTVFQ0pKUUNEQTBMSTVJQ0pKUUNEQXdMSTVNQ0pKUUNEQXNMSTVVQ0pKUUNEQW9MSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NVQWd3SkN5T1BBaVNVQWd3SUN5T1FBaVNWQWd3SEN5T1JBaVNWQWd3R0N5T1NBaVNWQWd3RkN5T1RBaVNWQWd3RUN5T1VBaVNWQWd3REN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2xRSU1BZ3NqandJa2xRSU1BUXRCZnc4TFFRUUxtd01BQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUVjRVFDQUFRZkVBUmcwQkFrQWdBRUh5QUdzT0RnTUVCUVlIQ0FrS0N3d05EZzhSQUFzTUR3c2psUUpCL3dGeEk1UUNRZjhCY1VFSWRISWprQUlRblFFTUR3c2psUUpCL3dGeEk1UUNRZjhCY1VFSWRISWprUUlRblFFTURnc2psUUpCL3dGeEk1UUNRZjhCY1VFSWRISWprZ0lRblFFTURRc2psUUpCL3dGeEk1UUNRZjhCY1VFSWRISWprd0lRblFFTURBc2psUUpCL3dGeEk1UUNRZjhCY1VFSWRISWpsQUlRblFFTUN3c2psUUpCL3dGeEk1UUNRZjhCY1VFSWRISWpsUUlRblFFTUNnc2poZ0pGQkVBQ1FDTzhBUVJBUVFFa21nSU1BUXNqdmdFanhBRnhRUjl4UlFSQVFRRWttd0lNQVF0QkFTU2NBZ3NMREFrTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUk0OENFSjBCREFnTEk1QUNKSThDREFjTEk1RUNKSThDREFZTEk1SUNKSThDREFVTEk1TUNKSThDREFRTEk1UUNKSThDREFNTEk1VUNKSThDREFJTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUVLY0JRZjhCY1NTUEFnd0JDMEYvRHd0QkJBczNBUUYvSUFGQkFFNEVRQ0FBUWY4QmNTQUFJQUZxUWY4QmNVc1Fvd0VGSUFGQkgzVWlBaUFCSUFKcWN5QUFRZjhCY1VvUW93RUxDelFCQW44amp3SWlBU0FBUWY4QmNTSUNFS0FCSUFFZ0FoQ3dBU0FBSUFGcVFmOEJjU0lBSkk4Q0lBQkZFS0VCUVFBUW9nRUxXQUVDZnlPUEFpSUJJQUJxSTVZQ1FRUjJRUUZ4YWtIL0FYRWlBaUFBSUFGemMwRVFjVUVBUnhDZkFTQUFRZjhCY1NBQmFpT1dBa0VFZGtFQmNXcEJnQUp4UVFCTEVLTUJJQUlrandJZ0FrVVFvUUZCQUJDaUFRdUxBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCZ0FGSEJFQWdBRUdCQVVZTkFRSkFJQUJCZ2dGckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJNUFDRUxFQkRCQUxJNUVDRUxFQkRBOExJNUlDRUxFQkRBNExJNU1DRUxFQkRBMExJNVFDRUxFQkRBd0xJNVVDRUxFQkRBc0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCRUxFQkRBb0xJNDhDRUxFQkRBa0xJNUFDRUxJQkRBZ0xJNUVDRUxJQkRBY0xJNUlDRUxJQkRBWUxJNU1DRUxJQkRBVUxJNVFDRUxJQkRBUUxJNVVDRUxJQkRBTUxJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCRUxJQkRBSUxJNDhDRUxJQkRBRUxRWDhQQzBFRUN6Y0JBbjhqandJaUFTQUFRZjhCY1VGL2JDSUNFS0FCSUFFZ0FoQ3dBU0FCSUFCclFmOEJjU0lBSkk4Q0lBQkZFS0VCUVFFUW9nRUxXQUVDZnlPUEFpSUJJQUJySTVZQ1FRUjJRUUZ4YTBIL0FYRWlBaUFBSUFGemMwRVFjVUVBUnhDZkFTQUJJQUJCL3dGeGF5T1dBa0VFZGtFQmNXdEJnQUp4UVFCTEVLTUJJQUlrandJZ0FrVVFvUUZCQVJDaUFRdUxBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa0FGSEJFQWdBRUdSQVVZTkFRSkFJQUJCa2dGckRnNERCQVVHQndnSkNnc01EUTRQRUFBTERCQUxJNUFDRUxRQkRCQUxJNUVDRUxRQkRBOExJNUlDRUxRQkRBNExJNU1DRUxRQkRBMExJNVFDRUxRQkRBd0xJNVVDRUxRQkRBc0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCRUxRQkRBb0xJNDhDRUxRQkRBa0xJNUFDRUxVQkRBZ0xJNUVDRUxVQkRBY0xJNUlDRUxVQkRBWUxJNU1DRUxVQkRBVUxJNVFDRUxVQkRBUUxJNVVDRUxVQkRBTUxJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCRUxVQkRBSUxJNDhDRUxVQkRBRUxRWDhQQzBFRUN5SUFJNDhDSUFCeElnQWtqd0lnQUVVUW9RRkJBQkNpQVVFQkVKOEJRUUFRb3dFTEpnQWpqd0lnQUhOQi93RnhJZ0FrandJZ0FFVVFvUUZCQUJDaUFVRUFFSjhCUVFBUW93RUxpd0lBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWFBQlJ3UkFJQUJCb1FGR0RRRUNRQ0FBUWFJQmF3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU9RQWhDM0FRd1FDeU9SQWhDM0FRd1BDeU9TQWhDM0FRd09DeU9UQWhDM0FRd05DeU9VQWhDM0FRd01DeU9WQWhDM0FRd0xDeU9WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaENuQVJDM0FRd0tDeU9QQWhDM0FRd0pDeU9RQWhDNEFRd0lDeU9SQWhDNEFRd0hDeU9TQWhDNEFRd0dDeU9UQWhDNEFRd0ZDeU9VQWhDNEFRd0VDeU9WQWhDNEFRd0RDeU9WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaENuQVJDNEFRd0NDeU9QQWhDNEFRd0JDMEYvRHd0QkJBc21BQ09QQWlBQWNrSC9BWEVpQUNTUEFpQUFSUkNoQVVFQUVLSUJRUUFRbndGQkFCQ2pBUXNzQVFGL0k0OENJZ0VnQUVIL0FYRkJmMndpQUJDZ0FTQUJJQUFRc0FFZ0FDQUJha1VRb1FGQkFSQ2lBUXVMQWdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQnNBRkhCRUFnQUVHeEFVWU5BUUpBSUFCQnNnRnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSTVBQ0VMb0JEQkFMSTVFQ0VMb0JEQThMSTVJQ0VMb0JEQTRMSTVNQ0VMb0JEQTBMSTVRQ0VMb0JEQXdMSTVVQ0VMb0JEQXNMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMb0JEQW9MSTQ4Q0VMb0JEQWtMSTVBQ0VMc0JEQWdMSTVFQ0VMc0JEQWNMSTVJQ0VMc0JEQVlMSTVNQ0VMc0JEQVVMSTVRQ0VMc0JEQVFMSTVVQ0VMc0JEQU1MSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMc0JEQUlMSTQ4Q0VMc0JEQUVMUVg4UEMwRUVDenNCQVg4Z0FCQjFJZ0ZCZjBZRWZ5QUFFQjBGSUFFTFFmOEJjU0FBUVFGcUlnRVFkU0lBUVg5R0JIOGdBUkFkQlNBQUMwSC9BWEZCQ0hSeUN3d0FRUWdRbWdFZ0FCQzlBUXMwQUNBQVFZQUJjVUdBQVVZUW93RWdBRUVCZENBQVFmOEJjVUVIZG5KQi93RnhJZ0JGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFDeklBSUFCQkFYRkJBRXNRb3dFZ0FFRUhkQ0FBUWY4QmNVRUJkbkpCL3dGeElnQkZFS0VCUVFBUW9nRkJBQkNmQVNBQUN6Z0JBWDhqbGdKQkJIWkJBWEVnQUVFQmRISkIvd0Z4SVFFZ0FFR0FBWEZCZ0FGR0VLTUJJQUZGRUtFQlFRQVFvZ0ZCQUJDZkFTQUJDemtCQVg4amxnSkJCSFpCQVhGQkIzUWdBRUgvQVhGQkFYWnlJUUVnQUVFQmNVRUJSaENqQVNBQlJSQ2hBVUVBRUtJQlFRQVFud0VnQVFzcUFDQUFRWUFCY1VHQUFVWVFvd0VnQUVFQmRFSC9BWEVpQUVVUW9RRkJBQkNpQVVFQUVKOEJJQUFMUFFFQmZ5QUFRZjhCY1VFQmRpSUJRWUFCY2lBQklBQkJnQUZ4UVlBQlJoc2lBVVVRb1FGQkFCQ2lBVUVBRUo4QklBQkJBWEZCQVVZUW93RWdBUXNyQUNBQVFROXhRUVIwSUFCQjhBRnhRUVIyY2lJQVJSQ2hBVUVBRUtJQlFRQVFud0ZCQUJDakFTQUFDeW9CQVg4Z0FFSC9BWEZCQVhZaUFVVVFvUUZCQUJDaUFVRUFFSjhCSUFCQkFYRkJBVVlRb3dFZ0FRc2VBRUVCSUFCMElBRnhRZjhCY1VVUW9RRkJBQkNpQVVFQkVKOEJJQUVMeUFnQkJYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJCM0VpQkFSQUlBUkJBVVlOQVFKQUlBUkJBbXNPQmdNRUJRWUhDQUFMREFnTEk1QUNJUUVNQndzamtRSWhBUXdHQ3lPU0FpRUJEQVVMSTVNQ0lRRU1CQXNqbEFJaEFRd0RDeU9WQWlFQkRBSUxJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCSVFFTUFRc2pqd0loQVFzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkU0lGQkVBZ0JVRUJSZzBCQWtBZ0JVRUNhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lBQVFRZE1CSDhnQVJDL0FTRUNRUUVGSUFCQkQwd0VmeUFCRU1BQklRSkJBUVZCQUFzTElRTU1Ed3NnQUVFWFRBUi9JQUVRd1FFaEFrRUJCU0FBUVI5TUJIOGdBUkRDQVNFQ1FRRUZRUUFMQ3lFRERBNExJQUJCSjB3RWZ5QUJFTU1CSVFKQkFRVWdBRUV2VEFSL0lBRVF4QUVoQWtFQkJVRUFDd3NoQXd3TkN5QUFRVGRNQkg4Z0FSREZBU0VDUVFFRklBQkJQMHdFZnlBQkVNWUJJUUpCQVFWQkFBc0xJUU1NREFzZ0FFSEhBRXdFZjBFQUlBRVF4d0VoQWtFQkJTQUFRYzhBVEFSL1FRRWdBUkRIQVNFQ1FRRUZRUUFMQ3lFRERBc0xJQUJCMXdCTUJIOUJBaUFCRU1jQklRSkJBUVVnQUVIZkFFd0VmMEVESUFFUXh3RWhBa0VCQlVFQUN3c2hBd3dLQ3lBQVFlY0FUQVIvUVFRZ0FSREhBU0VDUVFFRklBQkI3d0JNQkg5QkJTQUJFTWNCSVFKQkFRVkJBQXNMSVFNTUNRc2dBRUgzQUV3RWYwRUdJQUVReHdFaEFrRUJCU0FBUWY4QVRBUi9RUWNnQVJESEFTRUNRUUVGUVFBTEN5RUREQWdMSUFCQmh3Rk1CSDhnQVVGK2NTRUNRUUVGSUFCQmp3Rk1CSDhnQVVGOWNTRUNRUUVGUVFBTEN5RUREQWNMSUFCQmx3Rk1CSDhnQVVGN2NTRUNRUUVGSUFCQm53Rk1CSDhnQVVGM2NTRUNRUUVGUVFBTEN5RUREQVlMSUFCQnB3Rk1CSDhnQVVGdmNTRUNRUUVGSUFCQnJ3Rk1CSDhnQVVGZmNTRUNRUUVGUVFBTEN5RUREQVVMSUFCQnR3Rk1CSDhnQVVHL2YzRWhBa0VCQlNBQVFiOEJUQVIvSUFGQi8zNXhJUUpCQVFWQkFBc0xJUU1NQkFzZ0FFSEhBVXdFZnlBQlFRRnlJUUpCQVFVZ0FFSFBBVXdFZnlBQlFRSnlJUUpCQVFWQkFBc0xJUU1NQXdzZ0FFSFhBVXdFZnlBQlFRUnlJUUpCQVFVZ0FFSGZBVXdFZnlBQlFRaHlJUUpCQVFWQkFBc0xJUU1NQWdzZ0FFSG5BVXdFZnlBQlFSQnlJUUpCQVFVZ0FFSHZBVXdFZnlBQlFTQnlJUUpCQVFWQkFBc0xJUU1NQVFzZ0FFSDNBVXdFZnlBQlFjQUFjaUVDUVFFRklBQkIvd0ZNQkg4Z0FVR0FBWEloQWtFQkJVRUFDd3NoQXdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFRRVFDQUVRUUZHRFFFQ1FDQUVRUUpyRGdZREJBVUdCd2dBQ3d3SUN5QUNKSkFDREFjTElBSWtrUUlNQmdzZ0FpU1NBZ3dGQ3lBQ0pKTUNEQVFMSUFJa2xBSU1Bd3NnQWlTVkFnd0NDMEVCSUFWQkIwb2dCVUVFU0JzRVFDT1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpQUNFSjBCQ3d3QkN5QUNKSThDQzBFRVFYOGdBeHNMdXdRQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWNBQlJ3UkFJQUJCd1FGR0RRRUNRQ0FBUWNJQmF3NE9BeElFQlFZSENBa0tDd3dSRFE0QUN3d09DeU9XQWtFSGRrRUJjUTBSREE0TEk1Y0NFTDRCUWYvL0EzRWhBQ09YQWtFQ2FrSC8vd054SkpjQ0lBQkJnUDREY1VFSWRTU1FBaUFBUWY4QmNTU1JBa0VFRHdzamxnSkJCM1pCQVhFTkVRd09DeU9XQWtFSGRrRUJjUTBRREF3TEk1Y0NRUUpyUWYvL0EzRWlBQ1NYQWlBQUk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeUVLVUJEQTBMRUpzQkVMRUJEQTBMSTVjQ1FRSnJRZi8vQTNFaUFDU1hBaUFBSTVnQ0VLVUJRUUFrbUFJTUN3c2psZ0pCQjNaQkFYRkJBVWNOQ2d3SEN5T1hBaUlBRUw0QlFmLy9BM0VrbUFJZ0FFRUNha0gvL3dOeEpKY0NEQWtMSTVZQ1FRZDJRUUZ4UVFGR0RRY01DZ3NRbXdGQi93RnhFTWdCSVFBam1BSkJBV3BCLy84RGNTU1lBaUFBRHdzamxnSkJCM1pCQVhGQkFVY05DQ09YQWtFQ2EwSC8vd054SWdBa2x3SWdBQ09ZQWtFQ2FrSC8vd054RUtVQkRBVUxFSnNCRUxJQkRBWUxJNWNDUVFKclFmLy9BM0VpQUNTWEFpQUFJNWdDRUtVQlFRZ2ttQUlNQkF0QmZ3OExJNWNDSWdBUXZnRkIvLzhEY1NTWUFpQUFRUUpxUWYvL0EzRWtsd0pCREE4TEk1Y0NRUUpyUWYvL0EzRWlBQ1NYQWlBQUk1Z0NRUUpxUWYvL0EzRVFwUUVMRUp3QlFmLy9BM0VrbUFJTFFRZ1BDeU9ZQWtFQmFrSC8vd054SkpnQ1FRUVBDeU9ZQWtFQ2FrSC8vd054SkpnQ1FRd0xvQVFCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBVWNFUUNBQVFkRUJSZzBCQWtBZ0FFSFNBV3NPRGdNQUJBVUdCd2dKQ2dBTEFBd05BQXNNRFFzamxnSkJCSFpCQVhFTkR3d05DeU9YQWlJQkVMNEJRZi8vQTNFaEFDQUJRUUpxUWYvL0EzRWtsd0lnQUVHQS9nTnhRUWgxSkpJQ0lBQkIvd0Z4SkpNQ1FRUVBDeU9XQWtFRWRrRUJjUTBQREF3TEk1WUNRUVIyUVFGeERRNGpsd0pCQW10Qi8vOERjU0lBSkpjQ0lBQWptQUpCQW1wQi8vOERjUkNsQVF3TEN5T1hBa0VDYTBILy93TnhJZ0FrbHdJZ0FDT1RBa0gvQVhFamtnSkIvd0Z4UVFoMGNoQ2xBUXdMQ3hDYkFSQzBBUXdMQ3lPWEFrRUNhMEgvL3dOeElnQWtsd0lnQUNPWUFoQ2xBVUVRSkpnQ0RBa0xJNVlDUVFSMlFRRnhRUUZIRFFnTUJnc2psd0lpQUJDK0FVSC8vd054SkpnQ1FRRWt2UUVnQUVFQ2FrSC8vd054SkpjQ0RBY0xJNVlDUVFSMlFRRnhRUUZHRFFVTUNBc2psZ0pCQkhaQkFYRkJBVWNOQnlPWEFrRUNhMEgvL3dOeElnQWtsd0lnQUNPWUFrRUNha0gvL3dOeEVLVUJEQVFMRUpzQkVMVUJEQVVMSTVjQ1FRSnJRZi8vQTNFaUFDU1hBaUFBSTVnQ0VLVUJRUmdrbUFJTUF3dEJmdzhMSTVjQ0lnQVF2Z0ZCLy84RGNTU1lBaUFBUVFKcVFmLy9BM0VrbHdKQkRBOExFSndCUWYvL0EzRWttQUlMUVFnUEN5T1lBa0VCYWtILy93TnhKSmdDUVFRUEN5T1lBa0VDYWtILy93TnhKSmdDUVF3THNRTUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQVVjRVFDQUFRZUVCUmcwQkFrQWdBRUhpQVdzT0RnTUFBQVFGQmdjSUNRQUFBQW9MQUFzTUN3c1Ftd0ZCL3dGeFFZRCtBMm9qandJUW5RRU1Dd3NqbHdJaUFSQytBVUgvL3dOeElRQWdBVUVDYWtILy93TnhKSmNDSUFCQmdQNERjVUVJZFNTVUFpQUFRZjhCY1NTVkFrRUVEd3Nqa1FKQmdQNERhaU9QQWhDZEFVRUVEd3NqbHdKQkFtdEIvLzhEY1NJQUpKY0NJQUFqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElRcFFGQkNBOExFSnNCRUxjQkRBY0xJNWNDUVFKclFmLy9BM0VpQUNTWEFpQUFJNWdDRUtVQlFTQWttQUpCQ0E4TEVKc0JRUmgwUVJoMUlRQWpsd0lnQUVFQkVLWUJJNWNDSUFCcVFmLy9BM0VrbHdKQkFCQ2hBVUVBRUtJQkk1Z0NRUUZxUWYvL0EzRWttQUpCREE4TEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUpKZ0NRUVFQQ3hDY0FVSC8vd054STQ4Q0VKMEJJNWdDUVFKcVFmLy9BM0VrbUFKQkJBOExFSnNCRUxnQkRBSUxJNWNDUVFKclFmLy9BM0VpQUNTWEFpQUFJNWdDRUtVQlFTZ2ttQUpCQ0E4TFFYOFBDeU9ZQWtFQmFrSC8vd054SkpnQ1FRUUw1d01CQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVVjRVFDQUFRZkVCUmcwQkFrQWdBRUh5QVdzT0RnTUVBQVVHQndnSkNnc0FBQXdOQUFzTURRc1Ftd0ZCL3dGeFFZRCtBMm9RcHdGQi93RnhKSThDREEwTEk1Y0NJZ0VRdmdGQi8vOERjU0VBSUFGQkFtcEIvLzhEY1NTWEFpQUFRWUQrQTNGQkNIVWtqd0lnQUVIL0FYRWtsZ0lNRFFzamtRSkJnUDREYWhDbkFVSC9BWEVrandJTURBdEJBQ1M4QVF3TEN5T1hBa0VDYTBILy93TnhJZ0FrbHdJZ0FDT1dBa0gvQVhFamp3SkIvd0Z4UVFoMGNoQ2xBVUVJRHdzUW13RVF1Z0VNQ0Fzamx3SkJBbXRCLy84RGNTSUFKSmNDSUFBam1BSVFwUUZCTUNTWUFrRUlEd3NRbXdGQkdIUkJHSFVoQUNPWEFpRUJRUUFRb1FGQkFCQ2lBU0FCSUFCQkFSQ21BU0FBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgxSkpRQ0lBQkIvd0Z4SkpVQ0k1Z0NRUUZxUWYvL0EzRWttQUpCQ0E4TEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUpKY0NRUWdQQ3hDY0FVSC8vd054RUtjQlFmOEJjU1NQQWlPWUFrRUNha0gvL3dOeEpKZ0NEQVVMUVFFa3ZRRU1CQXNRbXdFUXV3RU1BZ3NqbHdKQkFtdEIvLzhEY1NJQUpKY0NJQUFqbUFJUXBRRkJPQ1NZQWtFSUR3dEJmdzhMSTVnQ1FRRnFRZi8vQTNFa21BSUxRUVFMMkFFQkFYOGptQUpCQVdwQi8vOERjU0VCSTV3Q0JFQWdBVUVCYTBILy93TnhJUUVMSUFFa21BSUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQVFSQUlBRkJBV3NPRGdFQ0F3UUZCZ2NJQ1FvTERBME9Ed3NnQUJDb0FROExJQUFRcVFFUEN5QUFFS29CRHdzZ0FCQ3JBUThMSUFBUXJBRVBDeUFBRUswQkR3c2dBQkN1QVE4TElBQVFyd0VQQ3lBQUVMTUJEd3NnQUJDMkFROExJQUFRdVFFUEN5QUFFTHdCRHdzZ0FCREpBUThMSUFBUXlnRVBDeUFBRU1zQkR3c2dBQkRNQVF1K0FRRUNmMEVBSkx3QlFZLytBeEFkUVFFZ0FIUkJmM054SWdFa3hBRkJqLzRESUFFUUh5T1hBa0VDYTBILy93TnhKSmNDSTVjQ0lnRWptQUlpQWtIL0FYRVFIeUFCUVFGcUlBSkJnUDREY1VFSWRSQWZBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCQWtBZ0FFRUNhdzREQXdRRkFBc01CUXRCQUNURkFVSEFBQ1NZQWd3RUMwRUFKTVlCUWNnQUpKZ0NEQU1MUVFBa3h3RkIwQUFrbUFJTUFndEJBQ1RJQVVIWUFDU1lBZ3dCQzBFQUpNa0JRZUFBSkpnQ0N3dnBBUUVDZnlPOUFRUkFRUUVrdkFGQkFDUzlBUXNqdmdFanhBRnhRUjl4UVFCS0JFQWptd0pGUVFBanZBRWJCSDhqeFFGQkFDTy9BUnNFZjBFQUVNNEJRUUVGSThZQlFRQWp3QUViQkg5QkFSRE9BVUVCQlNQSEFVRUFJOEVCR3dSL1FRSVF6Z0ZCQVFVanlBRkJBQ1BDQVJzRWYwRURFTTRCUVFFRkk4a0JRUUFqd3dFYkJIOUJCQkRPQVVFQkJVRUFDd3NMQ3dzRlFRQUxCRUJCQVNPYkFpT2FBaHNFZjBFQUpKc0NRUUFrbWdKQkFDU2NBa0VBSkowQ1FSZ0ZRUlFMSVFBTFFRRWptd0lqbWdJYkJFQkJBQ1NiQWtFQUpKb0NRUUFrbkFKQkFDU2RBZ3NnQUE4TFFRQUx0Z0VCQW45QkFTU25BaU9jQWdSQUk1Z0NFQjFCL3dGeEVNMEJFSm9CUVFBa213SkJBQ1NhQWtFQUpKd0NRUUFrblFJTEVNOEJJZ0JCQUVvRVFDQUFFSm9CQzBFRUlRQkJBQ09kQWtWQkFTT2JBaU9hQWhzYkJFQWptQUlRSFVIL0FYRVF6UUVoQUFzamxnSkI4QUZ4SkpZQ0lBQkJBRXdFUUNBQUR3c2dBQkNhQVNPakFrRUJhaUlCSTZFQ1RnUi9JNklDUVFGcUpLSUNJQUVqb1FKckJTQUJDeVNqQWlPWUFpUGlBVVlFUUVFQkpPVUJDeUFBQ3dVQUk3b0JDN0VCQVFOL0lBQkJmMEdBQ0NBQVFRQklHeUFBUVFCS0d5RUNRUUFoQUFOQUkrVUJSVUVBSUFGRlFRQkJBQ0FBUlNBREd4c2JCRUFRMEFGQkFFZ0VRRUVCSVFNRkk1a0NRZENrQkNPT0FuUk9CRUJCQVNFQUJVRUJJQUVqdWdFZ0FrNUJBQ0FDUVg5S0d4c2hBUXNMREFFTEN5QUFCRUFqbVFKQjBLUUVJNDRDZEdza21RSWpwQUlQQ3lBQkJFQWpwUUlQQ3lQbEFRUkFRUUFrNVFFanBnSVBDeU9ZQWtFQmEwSC8vd054SkpnQ1FYOExCd0JCZnhEU0FRczBBUUovQTBBZ0FVRUFUa0VBSUFJZ0FFZ2JCRUJCZnhEU0FTRUJJQUpCQVdvaEFnd0JDd3NnQVVFQVNBUkFJQUVQQzBFQUN3VUFJNTRDQ3dVQUk1OENDd1VBSTZBQ0Mxc0FBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQlJnMEJBa0FnQUVFQ2F3NEdBd1FGQmdjSUFBc01DQXNqMXdFUEN5UGFBUThMSTlnQkR3c2oyUUVQQ3lQYkFROExJOXdCRHdzajNRRVBDeVBlQVE4TFFRQUxod0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCQWtBZ0FFRUNhdzRHQXdRRkJnY0lBQXNNQ0FzZ0FVRUFSeVRYQVF3SEN5QUJRUUJISk5vQkRBWUxJQUZCQUVjazJBRU1CUXNnQVVFQVJ5VFpBUXdFQ3lBQlFRQkhKTnNCREFNTElBRkJBRWNrM0FFTUFnc2dBVUVBUnlUZEFRd0JDeUFCUVFCSEpONEJDd3RSQVFGL1FRQWtuUUlnQUJEWUFVVUVRRUVCSVFFTElBQkJBUkRaQVNBQkJFQkJBVUVCUVFCQkFVRUFJQUJCQTB3YklnQkJBQ1BnQVJzYklBQkZRUUFqNFFFYkd3UkFRUUVreVFGQkJCQmFDd3NMQ1FBZ0FFRUFFTmtCQzVvQkFDQUFRUUJLQkVCQkFCRGFBUVZCQUJEYkFRc2dBVUVBU2dSQVFRRVEyZ0VGUVFFUTJ3RUxJQUpCQUVvRVFFRUNFTm9CQlVFQ0VOc0JDeUFEUVFCS0JFQkJBeERhQVFWQkF4RGJBUXNnQkVFQVNnUkFRUVFRMmdFRlFRUVEyd0VMSUFWQkFFb0VRRUVGRU5vQkJVRUZFTnNCQ3lBR1FRQktCRUJCQmhEYUFRVkJCaERiQVFzZ0IwRUFTZ1JBUVFjUTJnRUZRUWNRMndFTEN3Y0FJQUFrNGdFTEJ3QkJmeVRpQVFzSEFDQUFKT01CQ3djQVFYOGs0d0VMQndBZ0FDVGtBUXNIQUVGL0pPUUJDd1VBSTQ4Q0N3VUFJNUFDQ3dVQUk1RUNDd1VBSTVJQ0N3VUFJNU1DQ3dVQUk1UUNDd1VBSTVVQ0N3VUFJNVlDQ3dVQUk1Z0NDd1VBSTVjQ0N3c0FJNWdDRUIxQi93RnhDd1VBSS9JQkM2c0RBUXAvUVlDQUFrR0FrQUlqNndFYklRaEJnTGdDUVlDd0FpUHNBUnNoQ1FOQUlBVkJnQUpJQkVCQkFDRUVBMEFnQkVHQUFrZ0VRQ0FJSUFWQkEzVkJCWFFnQ1dvZ0JFRURkV29pQWtHQWtINXFMUUFBRUUwaEJpQUZRUWh2SVFGQkJ5QUVRUWh2YXlFSFFRQWhBd0ovSUFCQkFFcEJBQ09OQWhzRVFDQUNRWURRZm1vdEFBQWhBd3NnQTBIQUFIRUxCRUJCQnlBQmF5RUJDMEVBSVFJZ0FVRUJkQ0FHYWlJR1FZQ1FmbXBCQVVFQUlBTkJDSEViSWdKQkRYUnFMUUFBSVFwQkFDRUJJQVpCZ1pCK2FpQUNRUTEwYWkwQUFFRUJJQWQwY1FSQVFRSWhBUXNnQVVFQmFpQUJRUUVnQjNRZ0NuRWJJUUVnQlVFSWRDQUVha0VEYkNFQ0lBQkJBRXBCQUNPTkFoc0VRQ0FDUVlDaEMyb2lBaUFEUVFkeElBRkJBQkJPSWdGQkgzRkJBM1E2QUFBZ0FrRUJhaUFCUWVBSGNVRUZkVUVEZERvQUFDQUNRUUpxSUFGQmdQZ0JjVUVLZFVFRGREb0FBQVVnQWtHQW9RdHFJZ01nQVVISC9nTVFUeUlCUVlDQS9BZHhRUkIxT2dBQUlBTkJBV29nQVVHQS9nTnhRUWgxT2dBQUlBTkJBbW9nQVRvQUFBc2dCRUVCYWlFRURBRUxDeUFGUVFGcUlRVU1BUXNMQzlnREFReC9BMEFnQkVFWFRrVUVRRUVBSVFNRFFDQURRUjlJQkVCQkFVRUFJQU5CRDBvaUJ4c2hDU0FFUVE5cklBUWdCRUVQU2lJQUcwRUVkQ0lGSUFOQkQydHFJQU1nQldvZ0J4c2hDRUdBa0FKQmdJQUNJQUFiSVFwQngvNERJUWRCZnlFR1FYOGhCVUVBSVFFRFFDQUJRUWhJQkVCQkFDRUNBMEFnQWtFRlNBUkFJQUpCQTNRZ0FXcEJBblFpQUVHQy9BTnFFQjBnQ0VZRVFDQUFRWVA4QTJvUUhTRUFRUUZCQUNBQVFRaHhRUUJIUVFBampRSWJHeUFKUmdSQVFRZ2hBVUVGSVFJZ0FDSUZRUkJ4Qkg5QnlmNERCVUhJL2dNTElRY0xDeUFDUVFGcUlRSU1BUXNMSUFGQkFXb2hBUXdCQ3dzZ0JVRUFTRUVBSTQwQ0d3UkFRWUM0QWtHQXNBSWo3QUViSVF0QmZ5RUFRUUFoQWdOQUlBSkJJRWdFUUVFQUlRRURRQ0FCUVNCSUJFQWdBVUVGZENBTGFpQUNhaUlHUVlDUWZtb3RBQUFnQ0VZRVFFRWdJUUpCSUNFQklBWWhBQXNnQVVFQmFpRUJEQUVMQ3lBQ1FRRnFJUUlNQVFzTElBQkJBRTRFZnlBQVFZRFFmbW90QUFBRlFYOExJUVlMUVFBaEFBTkFJQUJCQ0VnRVFDQUlJQW9nQ1VFQVFRY2dBQ0FEUVFOMElBUkJBM1FnQUdwQitBRkJnS0VYSUFjZ0JpQUZFRkFhSUFCQkFXb2hBQXdCQ3dzZ0EwRUJhaUVEREFFTEN5QUVRUUZxSVFRTUFRc0xDNWtDQVFsL0EwQWdCRUVJVGtVRVFFRUFJUUVEUUNBQlFRVklCRUFnQVVFRGRDQUVha0VDZENJQVFZRDhBMm9RSFJvZ0FFR0IvQU5xRUIwYUlBQkJndndEYWhBZElRSkJBU0VGSSswQkJFQWdBa0VDYjBFQlJnUkFJQUpCQVdzaEFndEJBaUVGQ3lBQVFZUDhBMm9RSFNFR1FRQWhCMEVCUVFBZ0JrRUljVUVBUjBFQUk0MENHeHNoQjBISS9nTWhDRUhKL2dOQnlQNERJQVpCRUhFYklRaEJBQ0VBQTBBZ0FDQUZTQVJBUVFBaEF3TkFJQU5CQ0VnRVFDQUFJQUpxUVlDQUFpQUhRUUJCQnlBRElBUkJBM1FnQVVFRWRDQURhaUFBUVFOMGFrSEFBRUdBb1NBZ0NFRi9JQVlRVUJvZ0EwRUJhaUVEREFFTEN5QUFRUUZxSVFBTUFRc0xJQUZCQVdvaEFRd0JDd3NnQkVFQmFpRUVEQUVMQ3dzRkFDUExBUXNGQUNQTUFRc0ZBQ1BQQVFzWUFRRi9JOUVCSVFBajBBRUVRQ0FBUVFSeUlRQUxJQUFMTUFFQmZ3TkFBa0FnQUVILy93Tk9EUUFnQUVHQXRja0VhaUFBRUhZNkFBQWdBRUVCYWlFQURBRUxDMEVBSk9VQkN4WUFFQnMvQUVHVUFVZ0VRRUdVQVQ4QWEwQUFHZ3NMM0FFQUlBQkJuQUpKQkVBUEN5QUFRUkJySVFBQ1FBSkFBa0FDUUFKQUFrQWdBVUVCUndSQUlBRkJBa1lOQVFKQUlBRkJBMnNPQXdNRUJRQUxEQVVMSUFBUUZBd0ZDeUFBS0FJRVFmLy8vLzhBY1VFQVRRUkFRUUJCZ0FGQnl3QkJFUkFBQUFzZ0FDQUFLQUlFUVFGck5nSUVJQUFRRmd3RUN5QUFFQmdNQXdzZ0FDZ0NCQ0lCUVlDQWdJQi9jU0FCUVFGcVFZQ0FnSUIvY1VjRVFFRUFRWUFCUWRZQVFRWVFBQUFMSUFBZ0FVRUJhallDQkNBQlFZQ0FnSUFIY1FSQUlBQVFGd3NNQWdzZ0FCQVpEQUVMUVFCQmdBRkI0UUJCR0JBQUFBc0xMUUFDUUFKQUFrQWdBRUVJYXlnQ0FBNERBQUFCQWdzUEN5QUFLQUlBSWdBRVFDQUFJQUVRK0FFTER3c0FDd01BQVFzZEFBSkFBa0FDUUNPcEFnNENBUUlBQ3dBTFFRQWhBQXNnQUJEU0FRc0hBQ0FBSktrQ0N5VUFBa0FDUUFKQUFrQWpxUUlPQXdFQ0F3QUxBQXRCQVNFQUMwRi9JUUVMSUFFUTBnRUxDNThDQmdCQkNBc3RIZ0FBQUFFQUFBQUJBQUFBSGdBQUFINEFiQUJwQUdJQUx3QnlBSFFBTHdCMEFHd0Fjd0JtQUM0QWRBQnpBRUU0Q3pjb0FBQUFBUUFBQUFFQUFBQW9BQUFBWVFCc0FHd0Fid0JqQUdFQWRBQnBBRzhBYmdBZ0FIUUFid0J2QUNBQWJBQmhBSElBWndCbEFFSHdBQXN0SGdBQUFBRUFBQUFCQUFBQUhnQUFBSDRBYkFCcEFHSUFMd0J5QUhRQUx3QndBSFVBY2dCbEFDNEFkQUJ6QUVHZ0FRc3pKQUFBQUFFQUFBQUJBQUFBSkFBQUFFa0FiZ0JrQUdVQWVBQWdBRzhBZFFCMEFDQUFid0JtQUNBQWNnQmhBRzRBWndCbEFFSFlBUXNqRkFBQUFBRUFBQUFCQUFBQUZBQUFBSDRBYkFCcEFHSUFMd0J5QUhRQUxnQjBBSE1BUVlBQ0N4VURBQUFBRUFBQUFBQUFBQUFRQUFBQUFBQUFBQkFBTXhCemIzVnlZMlZOWVhCd2FXNW5WVkpNSVdOdmNtVXZaR2x6ZEM5amIzSmxMblZ1ZEc5MVkyaGxaQzUzWVhOdExtMWhjQT09Iik6CiJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvd3x8InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZj9hd2FpdCBJKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlBRVJZQUovZndGL1lBQUFZQU4vZjM4QmYyQUVmMzkvZndCZ0FuOS9BR0FCZndGL1lBTi9mMzhBWUFGL0FHQUtmMzkvZjM5L2YzOS9md0JnQUFGL1lBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCMzkvZjM5L2YzOEFZQVIvZjM5L0FYOWdDSDkvZjM5L2YzOS9BR0FGZjM5L2YzOEJmMkFOZjM5L2YzOS9mMzkvZjM5L2Z3Ri9BZzBCQTJWdWRnVmhZbTl5ZEFBREEvOEIvUUVFQkFZQkJRQUVCZ0FBQndVRUJRWUdCd0VIQndjSEJ3Y0hBUUVGQlFFRUFRRUhCd0VCQVFFQkFRRUhBUUVIQndFQkFRRUlDUUVCQVFFQkFRRUJCd2NCQVFFQkFRRUJBUWtKQ1FrUEFBSUFFQXNNQ2dvR0JBY0JBUWNCQVFFQkJ3RUJBUUVGQlFBRkJRa0JCUVVBRFFjSEJ3RUZDUVVGQkFjSEJ3Y0hBUWNCQndFSEFRY0FCd2tKQndRRkFBY0JBUWNBQkFZQkFBRUhBUWNIQ1FrRUJBY0VCd2NIQkFRR0JRVUZCUVVGQlFVRkJBY0hCUWNIQlFjSEJRY0hCUVVGQlFVRkJRVUZCUVVBQlFVRkJRVUZCd2tKQ1FVSkJRa0pDUVVFQndjT0J3RUhBUWNCQ1FrSkNRa0pDUWtKQ1FrSkJ3RUJDUWtKQ1FFQkJBUUJCUWNBQlFNQkFBRUcxQXlxQW44QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3QkJBQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUVBdC9BRUdBZ0FFTGZ3QkJnSkFCQzM4QVFZQ0FBZ3QvQUVHQWtBTUxmd0JCZ0lBQkMzOEFRWUFRQzM4QVFZQ0FCQXQvQUVHQWtBUUxmd0JCZ0FFTGZ3QkJnSkVFQzM4QVFZQzRBUXQvQUVHQXlRVUxmd0JCZ05nRkMzOEFRWUNoQ3d0L0FFR0FnQXdMZndCQmdLRVhDMzhBUVlDQUNRdC9BRUdBb1NBTGZ3QkJnUGdBQzM4QVFZQ1FCQXQvQUVHQWlSMExmd0JCZ0praEMzOEFRWUNBQ0F0L0FFR0FtU2tMZndCQmdJQUlDMzhBUVlDWk1RdC9BRUdBZ0FnTGZ3QkJnSms1QzM4QVFZQ0FDQXQvQUVHQW1jRUFDMzhBUVlDQUNBdC9BRUdBbWNrQUMzOEFRWUNBQ0F0L0FFR0FtZEVBQzM4QVFZQVVDMzhBUVlDdDBRQUxmd0JCZ0lqNEF3dC9BRUdBdGNrRUMzOEFRZi8vQXd0L0FFRUFDMzhBUVlDMXpRUUxmd0JCbEFFTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BRUhvL2dNTGZ3QkI2ZjREQzM4QVFlditBd3QvQVVGL0MzOEJRWDhMZndGQkFBdC9BRUhBQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QVFjQUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhBUVlBQ0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhBUWNBQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWY4QUMzOEJRZjhBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BRUhFMkFJTGZ3RkJBQXQvQVVFQUMzOEFRWUNBQ0F0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRWDhMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndCQjBmNERDMzhBUWRMK0F3dC9BRUhUL2dNTGZ3QkIxUDREQzM4QVFkWCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0JCei80REMzOEFRZkQrQXd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJnS2pXdVFjTGZ3RkJBQXQvQVVFQUMzOEFRUUFMZndCQkFRdC9BRUVDQzM4QlFRQUxmd0JCZ0FJTGZ3RkJBQXNIOEJCbEJtMWxiVzl5ZVFJQUIxOWZZV3hzYjJNQUNnaGZYM0psZEdGcGJnQU1DVjlmY21Wc1pXRnpaUUFWQ1Y5ZlkyOXNiR1ZqZEFBYUMxOWZjblIwYVY5aVlYTmxBNmdDQm1OdmJtWnBad0EwRG1oaGMwTnZjbVZUZEdGeWRHVmtBRFVKYzJGMlpWTjBZWFJsQUR3SmJHOWhaRk4wWVhSbEFFY0ZhWE5IUWtNQVNCSm5aWFJUZEdWd2MxQmxjbE4wWlhCVFpYUUFTUXRuWlhSVGRHVndVMlYwY3dCS0NHZGxkRk4wWlhCekFFc1ZaWGhsWTNWMFpVMTFiSFJwY0d4bFJuSmhiV1Z6QU5RQkRHVjRaV04xZEdWR2NtRnRaUURUQVFsZlgzTmxkR0Z5WjJNQS9BRVpaWGhsWTNWMFpVWnlZVzFsUVc1a1EyaGxZMnRCZFdScGJ3RDdBUlZsZUdWamRYUmxWVzUwYVd4RGIyNWthWFJwYjI0QS9RRUxaWGhsWTNWMFpWTjBaWEFBMEFFVVoyVjBRM2xqYkdWelVHVnlRM2xqYkdWVFpYUUExUUVNWjJWMFEzbGpiR1ZUWlhSekFOWUJDV2RsZEVONVkyeGxjd0RYQVE1elpYUktiM2x3WVdSVGRHRjBaUURjQVI5blpYUk9kVzFpWlhKUFpsTmhiWEJzWlhOSmJrRjFaR2x2UW5WbVptVnlBTkVCRUdOc1pXRnlRWFZrYVc5Q2RXWm1aWElBUXh4elpYUk5ZVzUxWVd4RGIyeHZjbWw2WVhScGIyNVFZV3hsZEhSbEFDSVhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0RE1CTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBekVTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXpJZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd1FhUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQlJaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd1lTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdjZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDRERGh4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3OFNWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd2dPVmtsRVJVOWZVa0ZOWDFOSldrVURDUkZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01LRFZkUFVrdGZVa0ZOWDFOSldrVURDeVpQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNTUlrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVRERSaEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0REhCUkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1kRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F4QVFSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTVJHRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTVNGRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXhNT1JsSkJUVVZmVEU5RFFWUkpUMDRERkFwR1VrRk5SVjlUU1ZwRkF4VVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REZoTkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeGNTVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhnT1ZFbE1SVjlFUVZSQlgxTkpXa1VER1JKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REdnNVBRVTFmVkVsTVJWTmZVMGxhUlFNYkZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01tRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXljWlEwaEJUazVGVEY4eFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZUZVTklRVTVPUlV4Zk1WOUNWVVpHUlZKZlUwbGFSUU1mR1VOSVFVNU9SVXhmTWw5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESUJWRFNFRk9Ua1ZNWHpKZlFsVkdSa1ZTWDFOSldrVURJUmxEU0VGT1RrVk1Yek5mUWxWR1JrVlNYMHhQUTBGVVNVOU9BeUlWUTBoQlRrNUZURjh6WDBKVlJrWkZVbDlUU1ZwRkF5TVpRMGhCVGs1RlRGODBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWtGVU5JUVU1T1JVeGZORjlDVlVaR1JWSmZVMGxhUlFNbEZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRES0JKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVREtSRkNUMDlVWDFKUFRWOU1UME5CVkVsUFRnTXFEVUpQVDFSZlVrOU5YMU5KV2tVREt4WkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXl3U1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5MGRSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRETGhsRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOVRTVnBGQXk4aFoyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQUJ3YmMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFOMEJIWEpsYzJWMFVISnZaM0poYlVOdmRXNTBaWEpDY21WaGEzQnZhVzUwQU40QkdYTmxkRkpsWVdSSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTN3RWJjbVZ6WlhSU1pXRmtSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBT0FCR25ObGRGZHlhWFJsUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQU9FQkhISmxjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUE0Z0VNWjJWMFVtVm5hWE4wWlhKQkFPTUJER2RsZEZKbFoybHpkR1Z5UWdEa0FReG5aWFJTWldkcGMzUmxja01BNVFFTVoyVjBVbVZuYVhOMFpYSkVBT1lCREdkbGRGSmxaMmx6ZEdWeVJRRG5BUXhuWlhSU1pXZHBjM1JsY2tnQTZBRU1aMlYwVW1WbmFYTjBaWEpNQU9rQkRHZGxkRkpsWjJsemRHVnlSZ0RxQVJGblpYUlFjbTluY21GdFEyOTFiblJsY2dEckFROW5aWFJUZEdGamExQnZhVzUwWlhJQTdBRVpaMlYwVDNCamIyUmxRWFJRY205bmNtRnRRMjkxYm5SbGNnRHRBUVZuWlhSTVdRRHVBUjFrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZVFEdkFSaGtjbUYzVkdsc1pVUmhkR0ZVYjFkaGMyMU5aVzF2Y25rQThBRVRaSEpoZDA5aGJWUnZWMkZ6YlUxbGJXOXllUUR4QVFablpYUkVTVllBOGdFSFoyVjBWRWxOUVFEekFRWm5aWFJVVFVFQTlBRUdaMlYwVkVGREFQVUJFM1Z3WkdGMFpVUmxZblZuUjBKTlpXMXZjbmtBOWdFSUF2Y0JDb2FZQXYwQm9BSUJCSDhnQVNnQ0FDSURRUUZ4UlFSQVFRQkJHRUdWQWtFTkVBQUFDeUFEUVh4eElnSkJFRThFZnlBQ1FmRC8vLzhEU1FWQkFBdEZCRUJCQUVFWVFaY0NRUTBRQUFBTElBSkJnQUpKQkg4Z0FrRUVkaUVDUVFBRklBSkJIeUFDWjJzaUEwRUVhM1pCRUhNaEFpQURRUWRyQ3lJRFFSZEpCSDhnQWtFUVNRVkJBQXRGQkVCQkFFRVlRYVFDUVEwUUFBQUxJQUVvQWhRaEJDQUJLQUlRSWdVRVFDQUZJQVEyQWhRTElBUUVRQ0FFSUFVMkFoQUxJQU5CQkhRZ0FtcEJBblFnQUdvb0FtQWdBVVlFUUNBRFFRUjBJQUpxUVFKMElBQnFJQVEyQW1BZ0JFVUVRQ0FEUVFKMElBQnFJQU5CQW5RZ0FHb29BZ1JCQVNBQ2RFRi9jM0VpQVRZQ0JDQUJSUVJBSUFBZ0FDZ0NBRUVCSUFOMFFYOXpjVFlDQUFzTEN3djlBd0VHZnlBQlJRUkFRUUJCR0VITkFVRU5FQUFBQ3lBQktBSUFJZ05CQVhGRkJFQkJBRUVZUWM4QlFRMFFBQUFMSUFGQkVHb2dBU2dDQUVGOGNXb2lCQ2dDQUNJRlFRRnhCRUFnQTBGOGNVRVFhaUFGUVh4eGFpSUNRZkQvLy84RFNRUkFJQUFnQkJBQklBRWdBMEVEY1NBQ2NpSUROZ0lBSUFGQkVHb2dBU2dDQUVGOGNXb2lCQ2dDQUNFRkN3c2dBMEVDY1FSQUlBRkJCR3NvQWdBaUFpZ0NBQ0lHUVFGeFJRUkFRUUJCR0VIa0FVRVBFQUFBQ3lBR1FYeHhRUkJxSUFOQmZIRnFJZ2RCOFAvLy93TkpCSDhnQUNBQ0VBRWdBaUFHUVFOeElBZHlJZ00yQWdBZ0FnVWdBUXNoQVFzZ0JDQUZRUUp5TmdJQUlBTkJmSEVpQWtFUVR3Ui9JQUpCOFAvLy93TkpCVUVBQzBVRVFFRUFRUmhCOHdGQkRSQUFBQXNnQkNBQlFSQnFJQUpxUndSQVFRQkJHRUgwQVVFTkVBQUFDeUFFUVFScklBRTJBZ0FnQWtHQUFra0VmeUFDUVFSMklRUkJBQVVnQWtFZklBSm5heUlDUVFScmRrRVFjeUVFSUFKQkIyc0xJZ05CRjBrRWZ5QUVRUkJKQlVFQUMwVUVRRUVBUVJoQmhBSkJEUkFBQUFzZ0EwRUVkQ0FFYWtFQ2RDQUFhaWdDWUNFQ0lBRkJBRFlDRUNBQklBSTJBaFFnQWdSQUlBSWdBVFlDRUFzZ0EwRUVkQ0FFYWtFQ2RDQUFhaUFCTmdKZ0lBQWdBQ2dDQUVFQklBTjBjallDQUNBRFFRSjBJQUJxSUFOQkFuUWdBR29vQWdSQkFTQUVkSEkyQWdRTHl3RUJBbjhnQWtFUGNVVkJBQ0FCUVE5eFJVRUFJQUVnQWswYkcwVUVRRUVBUVJoQmdnTkJCQkFBQUFzZ0FDZ0NvQXdpQXdSQUlBRWdBMEVRYWtrRVFFRUFRUmhCakFOQkR4QUFBQXNnQVVFUWF5QURSZ1JBSUFNb0FnQWhCQ0FCUVJCcklRRUxCU0FCSUFCQnBBeHFTUVJBUVFCQkdFR1lBMEVFRUFBQUN3c2dBaUFCYXlJQ1FUQkpCRUFQQ3lBQklBUkJBbkVnQWtFZ2EwRUJjbkkyQWdBZ0FVRUFOZ0lRSUFGQkFEWUNGQ0FCSUFKcVFSQnJJZ0pCQWpZQ0FDQUFJQUkyQXFBTUlBQWdBUkFDQzVjQkFRSi9RUUUvQUNJQVNnUi9RUUVnQUd0QUFFRUFTQVZCQUFzRVFBQUxRYUFDUVFBMkFnQkJ3QTVCQURZQ0FFRUFJUUFEUUFKQUlBQkJGMDhOQUNBQVFRSjBRYUFDYWtFQU5nSUVRUUFoQVFOQUFrQWdBVUVRVHcwQUlBQkJCSFFnQVdwQkFuUkJvQUpxUVFBMkFtQWdBVUVCYWlFQkRBRUxDeUFBUVFGcUlRQU1BUXNMUWFBQ1FkQU9Qd0JCRUhRUUEwR2dBaVFBQ3kwQUlBQkI4UC8vL3dOUEJFQkJ5QUJCR0VIQUEwRWRFQUFBQ3lBQVFROXFRWEJ4SWdCQkVDQUFRUkJMR3d2ZEFRRUJmeUFCUVlBQ1NRUi9JQUZCQkhZaEFVRUFCU0FCUWZqLy8vOEJTUVJBUVFGQkd5QUJaMnQwSUFGcVFRRnJJUUVMSUFGQkh5QUJaMnNpQWtFRWEzWkJFSE1oQVNBQ1FRZHJDeUlDUVJkSkJIOGdBVUVRU1FWQkFBdEZCRUJCQUVFWVFkSUNRUTBRQUFBTElBSkJBblFnQUdvb0FnUkJmeUFCZEhFaUFRUi9JQUZvSUFKQkJIUnFRUUowSUFCcUtBSmdCU0FBS0FJQVFYOGdBa0VCYW5SeElnRUVmeUFCYUNJQlFRSjBJQUJxS0FJRUlnSkZCRUJCQUVFWVFkOENRUkVRQUFBTElBSm9JQUZCQkhScVFRSjBJQUJxS0FKZ0JVRUFDd3NMUUFFQmZ6OEFJZ0lnQVVILy93TnFRWUNBZkhGQkVIWWlBU0FDSUFGS0cwQUFRUUJJQkVBZ0FVQUFRUUJJQkVBQUN3c2dBQ0FDUVJCMFB3QkJFSFFRQXd1SEFRRUNmeUFCS0FJQUlRTWdBa0VQY1FSQVFRQkJHRUh0QWtFTkVBQUFDeUFEUVh4eElBSnJJZ1JCSUU4RVFDQUJJQU5CQW5FZ0FuSTJBZ0FnQVVFUWFpQUNhaUlCSUFSQkVHdEJBWEkyQWdBZ0FDQUJFQUlGSUFFZ0EwRitjVFlDQUNBQlFSQnFJQUVvQWdCQmZIRnFJQUZCRUdvZ0FTZ0NBRUY4Y1dvb0FnQkJmWEUyQWdBTEMyb0JBbjhnQUNBQkVBVWlBeEFHSWdKRkJFQWdBQ0FERUFjZ0FDQURFQVlpQWtVRVFFRUFRUmhCM2dOQkR4QUFBQXNMSUFJb0FnQkJmSEVnQTBrRVFFRUFRUmhCNEFOQkRSQUFBQXNnQWtFQU5nSUVJQUlnQVRZQ0RDQUFJQUlRQVNBQUlBSWdBeEFJSUFJTElnRUJmeU1BSWdJRWZ5QUNCUkFFSXdBTElBQVFDU0lBSUFFMkFnZ2dBRUVRYWd0UkFRRi9JQUFvQWdRaUFVR0FnSUNBZjNFZ0FVRUJha0dBZ0lDQWYzRkhCRUJCQUVHQUFVSG9BRUVDRUFBQUN5QUFJQUZCQVdvMkFnUWdBQ2dDQUVFQmNRUkFRUUJCZ0FGQjZ3QkJEUkFBQUFzTEZBQWdBRUdjQWtzRVFDQUFRUkJyRUFzTElBQUxMUUVCZnlBQktBSUFJZ0pCQVhFRVFFRUFRUmhCbVFSQkFoQUFBQXNnQVNBQ1FRRnlOZ0lBSUFBZ0FSQUNDeWNBSUFCQmdBSW9BZ0JMQkVCQnNBRkI2QUZCRmtFYkVBQUFDeUFBUVFOMFFZUUNhaWdDQUF2RURBRURmd05BSUFGQkEzRkJBQ0FDR3dSQUlBQWlBMEVCYWlFQUlBRWlCRUVCYWlFQklBTWdCQzBBQURvQUFDQUNRUUZySVFJTUFRc0xJQUJCQTNGRkJFQURRQ0FDUVJCSlJRUkFJQUFnQVNnQ0FEWUNBQ0FBUVFScUlBRkJCR29vQWdBMkFnQWdBRUVJYWlBQlFRaHFLQUlBTmdJQUlBQkJER29nQVVFTWFpZ0NBRFlDQUNBQlFSQnFJUUVnQUVFUWFpRUFJQUpCRUdzaEFnd0JDd3NnQWtFSWNRUkFJQUFnQVNnQ0FEWUNBQ0FBUVFScUlBRkJCR29vQWdBMkFnQWdBVUVJYWlFQklBQkJDR29oQUFzZ0FrRUVjUVJBSUFBZ0FTZ0NBRFlDQUNBQlFRUnFJUUVnQUVFRWFpRUFDeUFDUVFKeEJFQWdBQ0FCTHdFQU93RUFJQUZCQW1vaEFTQUFRUUpxSVFBTElBSkJBWEVFUUNBQUlBRXRBQUE2QUFBTER3c2dBa0VnVHdSQUFrQUNRQUpBSUFCQkEzRWlBMEVCUndSQUlBTkJBa1lOQVNBRFFRTkdEUUlNQXdzZ0FTZ0NBQ0VGSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRTnJJUUlEUUNBQ1FSRkpSUVJBSUFBZ0FVRUJhaWdDQUNJRFFRaDBJQVZCR0haeU5nSUFJQUJCQkdvZ0EwRVlkaUFCUVFWcUtBSUFJZ05CQ0hSeU5nSUFJQUJCQ0dvZ0EwRVlkaUFCUVFscUtBSUFJZ05CQ0hSeU5nSUFJQUJCREdvZ0FVRU5haWdDQUNJRlFRaDBJQU5CR0haeU5nSUFJQUZCRUdvaEFTQUFRUkJxSVFBZ0FrRVFheUVDREFFTEN3d0NDeUFCS0FJQUlRVWdBQ0FCTFFBQU9nQUFJQUJCQVdvaUEwRUJhaUVBSUFGQkFXb2lCRUVCYWlFQklBTWdCQzBBQURvQUFDQUNRUUpySVFJRFFDQUNRUkpKUlFSQUlBQWdBVUVDYWlnQ0FDSURRUkIwSUFWQkVIWnlOZ0lBSUFCQkJHb2dBMEVRZGlBQlFRWnFLQUlBSWdOQkVIUnlOZ0lBSUFCQkNHb2dBMEVRZGlBQlFRcHFLQUlBSWdOQkVIUnlOZ0lBSUFCQkRHb2dBVUVPYWlnQ0FDSUZRUkIwSUFOQkVIWnlOZ0lBSUFGQkVHb2hBU0FBUVJCcUlRQWdBa0VRYXlFQ0RBRUxDd3dCQ3lBQktBSUFJUVVnQUNJRFFRRnFJUUFnQVNJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBSUFKQkFXc2hBZ05BSUFKQkUwbEZCRUFnQUNBQlFRTnFLQUlBSWdOQkdIUWdCVUVJZG5JMkFnQWdBRUVFYWlBRFFRaDJJQUZCQjJvb0FnQWlBMEVZZEhJMkFnQWdBRUVJYWlBRFFRaDJJQUZCQzJvb0FnQWlBMEVZZEhJMkFnQWdBRUVNYWlBQlFROXFLQUlBSWdWQkdIUWdBMEVJZG5JMkFnQWdBVUVRYWlFQklBQkJFR29oQUNBQ1FSQnJJUUlNQVFzTEN3c2dBa0VRY1FSQUlBQWdBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJRFFRRnFJUUFnQVVFQmFpSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUN5QUNRUWh4QkVBZ0FDQUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUEwRUJhaUVBSUFGQkFXb2lCRUVCYWlFQklBTWdCQzBBQURvQUFBc2dBa0VFY1FSQUlBQWdBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSURRUUZxSVFBZ0FVRUJhaUlFUVFGcUlRRWdBeUFFTFFBQU9nQUFDeUFDUVFKeEJFQWdBQ0FCTFFBQU9nQUFJQUJCQVdvaUEwRUJhaUVBSUFGQkFXb2lCRUVCYWlFQklBTWdCQzBBQURvQUFBc2dBa0VCY1FSQUlBQWdBUzBBQURvQUFBc0wwZ0lCQW44Q1FDQUNJUU1nQUNBQlJnMEFRUUVnQUNBRGFpQUJUU0FCSUFOcUlBQk5Hd1JBSUFBZ0FTQURFQThNQVFzZ0FDQUJTUVJBSUFGQkIzRWdBRUVIY1VZRVFBTkFJQUJCQjNFRVFDQURSUTBFSUFOQkFXc2hBeUFBSWdKQkFXb2hBQ0FCSWdSQkFXb2hBU0FDSUFRdEFBQTZBQUFNQVFzTEEwQWdBMEVJU1VVRVFDQUFJQUVwQXdBM0F3QWdBMEVJYXlFRElBQkJDR29oQUNBQlFRaHFJUUVNQVFzTEN3TkFJQU1FUUNBQUlnSkJBV29oQUNBQklnUkJBV29oQVNBQ0lBUXRBQUE2QUFBZ0EwRUJheUVEREFFTEN3VWdBVUVIY1NBQVFRZHhSZ1JBQTBBZ0FDQURha0VIY1FSQUlBTkZEUVFnQUNBRFFRRnJJZ05xSUFFZ0Eyb3RBQUE2QUFBTUFRc0xBMEFnQTBFSVNVVUVRQ0FBSUFOQkNHc2lBMm9nQVNBRGFpa0RBRGNEQUF3QkN3c0xBMEFnQXdSQUlBQWdBMEVCYXlJRGFpQUJJQU5xTFFBQU9nQUFEQUVMQ3dzTEN6Z0FJd0JGQkVCQkFFRVlRYmNFUVEwUUFBQUxJQUJCRDNGRlFRQWdBQnRGQkVCQkFFRVlRYmdFUVFJUUFBQUxJd0FnQUVFUWF4QU5DMFVCQkg4akFTTURJZ0ZySWdKQkFYUWlBRUdBQWlBQVFZQUNTeHNpQTBFQUVBb2lBQ0FCSUFJUUVDQUJCRUFnQVJBUkN5QUFKQU1nQUNBQ2FpUUJJQUFnQTJva0Fnc2lBUUYvSXdFaUFTTUNUd1JBRUJJakFTRUJDeUFCSUFBMkFnQWdBVUVFYWlRQkM3WUJBUUovSUFBb0FnUWlBa0gvLy8vL0FIRWhBU0FBS0FJQVFRRnhCRUJCQUVHQUFVSHpBRUVORUFBQUN5QUJRUUZHQkVBZ0FFRVFha0VCRVBrQklBSkJnSUNBZ0hoeEJFQWdBRUdBZ0lDQWVEWUNCQVVqQUNBQUVBMExCU0FCUVFCTkJFQkJBRUdBQVVIOEFFRVBFQUFBQ3lBQUtBSUlFQTVCRUhFRVFDQUFJQUZCQVdzZ0FrR0FnSUNBZjNGeU5nSUVCU0FBSUFGQkFXdEJnSUNBZ0h0eU5nSUVJQUpCZ0lDQWdIaHhSUVJBSUFBUUV3c0xDd3NTQUNBQVFad0NTd1JBSUFCQkVHc1FGQXNMT3dFQmZ5QUFLQUlFSWdGQmdJQ0FnQWR4UVlDQWdJQUJSd1JBSUFBZ0FVSC8vLy8vZUhGQmdJQ0FnQUZ5TmdJRUlBQkJFR3BCQWhENUFRc0xIUUFnQUNBQUtBSUVRZi8vLy85NGNUWUNCQ0FBUVJCcVFRUVErUUVMVHdFQmZ5QUFLQUlFSWdGQmdJQ0FnQWR4UVlDQWdJQUJSZ1JBSUFGQi8vLy8vd0J4UVFCTEJFQWdBQkFYQlNBQUlBRkIvLy8vLzNoeFFZQ0FnSUFDY2pZQ0JDQUFRUkJxUVFNUStRRUxDd3RLQVFGL0lBQW9BZ1FpQVVHQWdJQ0FCM0ZCZ0lDQWdBSkdCSDhnQVVHQWdJQ0FlSEZGQlVFQUN3UkFJQUFnQVVILy8vLy9lSEUyQWdRZ0FFRVFha0VGRVBrQkl3QWdBQkFOQ3d2ekFRRUdmeU1ESWdVaUFpRURJd0VoQUFOQUFrQWdBeUFBVHcwQUlBTW9BZ0FpQkNnQ0JDSUJRWUNBZ0lBSGNVR0FnSUNBQTBZRWZ5QUJRZi8vLy84QWNVRUFTd1ZCQUFzRVFDQUVFQllnQWlBRU5nSUFJQUpCQkdvaEFnVkJBQ0FCUWYvLy8vOEFjVVVnQVVHQWdJQ0FCM0ViQkVBakFDQUVFQTBGSUFRZ0FVSC8vLy8vQjNFMkFnUUxDeUFEUVFScUlRTU1BUXNMSUFJa0FTQUZJUUFEUUFKQUlBQWdBazhOQUNBQUtBSUFFQmdnQUVFRWFpRUFEQUVMQ3lBRklRQURRQUpBSUFBZ0FrOE5BQ0FBS0FJQUlnRWdBU2dDQkVILy8vLy9CM0UyQWdRZ0FSQVpJQUJCQkdvaEFBd0JDd3NnQlNRQkMxTUFRZkxseXdja1BVR2d3WUlGSkQ1QjJMRGhBaVEvUVlpUUlDUkFRZkxseXdja1FVR2d3WUlGSkVKQjJMRGhBaVJEUVlpUUlDUkVRZkxseXdja1JVR2d3WUlGSkVaQjJMRGhBaVJIUVlpUUlDUklDNVVDQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFReDFJZ0VFUUNBQlFRRkdEUUVDUUNBQlFRSnJEZ3dDQWdNREF3TUVCQVVGQmdjQUN3d0hDeU9NQWdSQUk0MENCRUFnQUVHQUFrZ05DU0FBUVlBU1NFRUFJQUJCL3dOS0d3MEpCVUVBSUFCQmdBSklJNDBDR3cwSkN3c0xJQUJCZ0szUkFHb1BDeUFBUVFFajl3RWlBRUVBSUFCRkkvOEJHeHRCRG5ScVFZQ3QwQUJxRHdzZ0FFR0FrSDVxSTQwQ0JIOGppZ0lRSFVFQmNRVkJBQXRCRFhScUR3c2dBQ1A0QVVFTmRHcEJnTm5HQUdvUEN5QUFRWUNRZm1vUEMwRUFJUUVDZnlPTkFnUkFJNHNDRUIxQkIzRWhBUXNnQVVFQlNBc0VmMEVCQlNBQkMwRU1kQ0FBYWtHQThIMXFEd3NnQUVHQVVHb1BDeUFBUVlDWjBRQnFDd2tBSUFBUUhDMEFBQXZEQVFCQkFDU09Ba0VBSkk4Q1FRQWtrQUpCQUNTUkFrRUFKSklDUVFBa2t3SkJBQ1NVQWtFQUpKVUNRUUFrbGdKQkFDU1hBa0VBSkpnQ1FRQWttUUpCQUNTYUFrRUFKSnNDUVFBa25BSkJBQ1NkQWlPTUFnUkFEd3NqalFJRVFFRVJKSThDUVlBQkpKWUNRUUFra0FKQkFDU1JBa0gvQVNTU0FrSFdBQ1NUQWtFQUpKUUNRUTBrbFFJRlFRRWtqd0pCc0FFa2xnSkJBQ1NRQWtFVEpKRUNRUUFra2dKQjJBRWtrd0pCQVNTVUFrSE5BQ1NWQWd0QmdBSWttQUpCL3Y4REpKY0NDd3NBSUFBUUhDQUJPZ0FBQzNFQkFYOUJBQ1Q1QVVFQkpQb0JRY2NDRUIwaUFFVWsrd0VnQUVFRFRFRUFJQUJCQVU0YkpQd0JJQUJCQmt4QkFDQUFRUVZPR3lUOUFTQUFRUk5NUVFBZ0FFRVBUaHNrL2dFZ0FFRWVURUVBSUFCQkdVNGJKUDhCUVFFazl3RkJBQ1Q0QVNPS0FrRUFFQjhqaXdKQkFSQWZDeThBUWRIK0EwSC9BUkFmUWRMK0EwSC9BUkFmUWRQK0EwSC9BUkFmUWRUK0EwSC9BUkFmUWRYK0EwSC9BUkFmQzdBSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQUVRQ0FBUVFGR0RRRUNRQ0FBUVFKckRnc0RCQVVHQndnSkNnc01EUUFMREEwTFFmTGx5d2NrUFVHZ3dZSUZKRDVCMkxEaEFpUS9RWWlRSUNSQVFmTGx5d2NrUVVHZ3dZSUZKRUpCMkxEaEFpUkRRWWlRSUNSRVFmTGx5d2NrUlVHZ3dZSUZKRVpCMkxEaEFpUkhRWWlRSUNSSURBd0xRZi8vL3dja1BVSGoydjRISkQ1QmdPS1FCQ1EvUVFBa1FFSC8vLzhISkVGQjQ5citCeVJDUVlEaWtBUWtRMEVBSkVSQi8vLy9CeVJGUWVQYS9nY2tSa0dBNHBBRUpFZEJBQ1JJREFzTFFmLy8vd2NrUFVHRWlmNEhKRDVCdXZUUUJDUS9RUUFrUUVILy8vOEhKRUZCc2Y3dkF5UkNRWUNJQWlSRFFRQWtSRUgvLy84SEpFVkIvOHVPQXlSR1FmOEJKRWRCQUNSSURBb0xRY1hOL3dja1BVR0V1Ym9HSkQ1QnFkYVJCQ1EvUVlqaTZBSWtRRUgvLy84SEpFRkI0OXIrQnlSQ1FZRGlrQVFrUTBFQUpFUkIvLy8vQnlSRlFlUGEvZ2NrUmtHQTRwQUVKRWRCQUNSSURBa0xRZi8vL3dja1BVR0Evc3NDSkQ1QmdJVDlCeVEvUVFBa1FFSC8vLzhISkVGQmdQN0xBaVJDUVlDRS9RY2tRMEVBSkVSQi8vLy9CeVJGUVlEK3l3SWtSa0dBaFAwSEpFZEJBQ1JJREFnTFFmLy8vd2NrUFVHeC91OERKRDVCeGNjQkpEOUJBQ1JBUWYvLy93Y2tRVUdFaWY0SEpFSkJ1dlRRQkNSRFFRQWtSRUgvLy84SEpFVkJoSW4rQnlSR1FicjAwQVFrUjBFQUpFZ01Cd3RCQUNROVFZU0pBaVErUVlDOC93Y2tQMEgvLy84SEpFQkJBQ1JCUVlTSkFpUkNRWUM4L3dja1EwSC8vLzhISkVSQkFDUkZRWVNKQWlSR1FZQzgvd2NrUjBILy8vOEhKRWdNQmd0QnBmLy9CeVE5UVpTcC9nY2tQa0gvcWRJRUpEOUJBQ1JBUWFYLy93Y2tRVUdVcWY0SEpFSkIvNm5TQkNSRFFRQWtSRUdsLy84SEpFVkJsS24rQnlSR1FmK3AwZ1FrUjBFQUpFZ01CUXRCLy8vL0J5UTlRWUQrL3dja1BrR0FnUHdISkQ5QkFDUkFRZi8vL3dja1FVR0EvdjhISkVKQmdJRDhCeVJEUVFBa1JFSC8vLzhISkVWQmdQNy9CeVJHUVlDQS9BY2tSMEVBSkVnTUJBdEIvLy8vQnlROVFZRCsvd2NrUGtHQWxPMERKRDlCQUNSQVFmLy8vd2NrUVVIL3k0NERKRUpCL3dFa1EwRUFKRVJCLy8vL0J5UkZRYkgrN3dNa1JrR0FpQUlrUjBFQUpFZ01Bd3RCLy8vL0J5UTlRZi9MamdNa1BrSC9BU1EvUVFBa1FFSC8vLzhISkVGQmhJbitCeVJDUWJyMDBBUWtRMEVBSkVSQi8vLy9CeVJGUWJIKzd3TWtSa0dBaUFJa1IwRUFKRWdNQWd0Qi8vLy9CeVE5UWQ2WnNnUWtQa0dNcGNrQ0pEOUJBQ1JBUWYvLy93Y2tRVUdFaWY0SEpFSkJ1dlRRQkNSRFFRQWtSRUgvLy84SEpFVkI0OXIrQnlSR1FZRGlrQVFrUjBFQUpFZ01BUXRCLy8vL0J5UTlRYVhMbGdVa1BrSFNwTWtDSkQ5QkFDUkFRZi8vL3dja1FVR2x5NVlGSkVKQjBxVEpBaVJEUVFBa1JFSC8vLzhISkVWQnBjdVdCU1JHUWRLa3lRSWtSMEVBSkVnTEM5b0lBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRWWdCUndSQUlBQkI0UUJHRFFFZ0FFRVVSZzBDSUFCQnhnQkdEUU1nQUVIWkFFWU5CQ0FBUWNZQlJnMEVJQUJCaGdGR0RRVWdBRUdvQVVZTkJTQUFRYjhCUmcwR0lBQkJ6Z0ZHRFFZZ0FFSFJBVVlOQmlBQVFmQUJSZzBHSUFCQkowWU5CeUFBUWNrQVJnMEhJQUJCM0FCR0RRY2dBRUd6QVVZTkJ5QUFRY2tCUmcwSUlBQkI4QUJHRFFrZ0FFSEdBRVlOQ2lBQVFkTUJSZzBMREF3TFFmKzVsZ1VrUFVHQS92OEhKRDVCZ01ZQkpEOUJBQ1JBUWYrNWxnVWtRVUdBL3Y4SEpFSkJnTVlCSkVOQkFDUkVRZis1bGdVa1JVR0EvdjhISkVaQmdNWUJKRWRCQUNSSURBc0xRZi8vL3dja1BVSC95NDRESkQ1Qi93RWtQMEVBSkVCQi8vLy9CeVJCUVlTSi9nY2tRa0c2OU5BRUpFTkJBQ1JFUWYvLy93Y2tSVUgveTQ0REpFWkIvd0VrUjBFQUpFZ01DZ3RCLy8vL0J5UTlRWVNKL2dja1BrRzY5TkFFSkQ5QkFDUkFRZi8vL3dja1FVR3gvdThESkVKQmdJZ0NKRU5CQUNSRVFmLy8vd2NrUlVHRWlmNEhKRVpCdXZUUUJDUkhRUUFrU0F3SkMwSC82OVlGSkQxQmxQLy9CeVErUWNLMHRRVWtQMEVBSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQmhJbitCeVJIUWJyMDBBUWtTQXdJQzBILy8vOEhKRDFCaE51MkJTUStRZnZtaVFJa1AwRUFKRUJCLy8vL0J5UkJRWURtL1Fja1FrR0FoTkVFSkVOQkFDUkVRZi8vL3dja1JVSC8rK29DSkVaQmdJRDhCeVJIUWY4QkpFZ01Cd3RCblAvL0J5UTlRZi9yMGdRa1BrSHpxSTRESkQ5QnV2UUFKRUJCd29yL0J5UkJRWUNzL3dja1FrR0E5TkFFSkVOQmdJQ29BaVJFUWYvLy93Y2tSVUdFaWY0SEpFWkJ1dlRRQkNSSFFRQWtTQXdHQzBHQS9xOERKRDFCLy8vL0J5UStRY3FrL1Fja1AwRUFKRUJCLy8vL0J5UkJRZi8vL3dja1FrSC95NDRESkVOQi93RWtSRUgvLy84SEpFVkI0OXIrQnlSR1FZRGlrQVFrUjBFQUpFZ01CUXRCLzdtV0JTUTlRWUQrL3dja1BrR0F4Z0VrUDBFQUpFQkIwc2I5QnlSQlFZQ0EyQVlrUWtHQWdJd0RKRU5CQUNSRVFmOEJKRVZCLy8vL0J5UkdRZnYrL3dja1IwSC9pUUlrU0F3RUMwSE8vLzhISkQxQjc5K1BBeVErUWJHSThnUWtQMEhhdE9rQ0pFQkIvLy8vQnlSQlFZRG0vUWNrUWtHQWhORUVKRU5CQUNSRVFmLy8vd2NrUlVIL3k0NERKRVpCL3dFa1IwRUFKRWdNQXd0Qi8vLy9CeVE5UVlTSi9nY2tQa0c2OU5BRUpEOUJBQ1JBUWYvLy93Y2tRVUdBL2dNa1FrR0FpTVlCSkVOQmdKUUJKRVJCLy8vL0J5UkZRZi9MamdNa1JrSC9BU1JIUVFBa1NBd0NDMEgvLy84SEpEMUIvOHVPQXlRK1FmOEJKRDlCQUNSQVFZRCsvd2NrUVVHQWdQd0hKRUpCZ0lDTUF5UkRRUUFrUkVILy8vOEhKRVZCc2Y3dkF5UkdRWUNJQWlSSFFRQWtTQXdCQzBILy8vOEhKRDFCaE51MkJTUStRZnZtaVFJa1AwRUFKRUJCLy8vL0J5UkJRZVBhL2dja1FrSGoydjRISkVOQkFDUkVRZi8vL3dja1JVSC95NDRESkVaQi93RWtSMEVBSkVnTEMwb0JBbjlCQUJBaUk0MENCRUFQQ3lPTUFnUkFJNDBDUlFSQUR3c0xRYlFDSVFBRFFBSkFJQUJCd3dKS0RRQWdBQkFkSUFGcUlRRWdBRUVCYWlFQURBRUxDeUFCUWY4QmNSQWpDOXdCQUVFQUpQQUJRUUFrOFFGQkFDVHlBVUVBSlBNQlFRQWs5QUZCQUNUMUFVRUFKUFlCUVpBQkpQSUJJNDBDQkVCQndmNERRWUVCRUI5QnhQNERRWkFCRUI5QngvNERRZndCRUI4RlFjSCtBMEdGQVJBZlFjYitBMEgvQVJBZlFjZitBMEg4QVJBZlFjaitBMEgvQVJBZlFjbitBMEgvQVJBZkMwR1FBU1R5QVVIQS9nTkJrQUVRSDBIUC9nTkJBQkFmUWZEK0EwRUJFQjhqakFJRVFDT05BZ1JBUVFBazhnRkJ3UDREUVFBUUgwSEIvZ05CZ0FFUUgwSEUvZ05CQUJBZkJVRUFKUElCUWNEK0EwRUFFQjlCd2Y0RFFZUUJFQjhMQ3hBa0MyMEFJNDBDQkVCQjZQNERRY0FCRUI5QjZmNERRZjhCRUI5QjZ2NERRY0VCRUI5QjYvNERRUTBRSHdWQjZQNERRZjhCRUI5QjZmNERRZjhCRUI5QjZ2NERRZjhCRUI5QjYvNERRZjhCRUI4TEk0MENRUUFqakFJYkJFQkI2ZjREUVNBUUgwSHIvZ05CaWdFUUh3c0xWZ0JCa1A0RFFZQUJFQjlCa2Y0RFFiOEJFQjlCa3Y0RFFmTUJFQjlCay80RFFjRUJFQjlCbFA0RFFiOEJFQjhqakFJRVFFR1IvZ05CUHhBZlFaTCtBMEVBRUI5QmsvNERRUUFRSDBHVS9nTkJ1QUVRSHdzTExBQkJsZjREUWY4QkVCOUJsdjREUVQ4UUgwR1gvZ05CQUJBZlFaaitBMEVBRUI5Qm1mNERRYmdCRUI4TE13QkJtdjREUWY4QUVCOUJtLzREUWY4QkVCOUJuUDREUVo4QkVCOUJuZjREUVFBUUgwR2UvZ05CdUFFUUgwRUJKSWtCQ3kwQVFaLytBMEgvQVJBZlFhRCtBMEgvQVJBZlFhSCtBMEVBRUI5Qm92NERRUUFRSDBHai9nTkJ2d0VRSHd0Y0FDQUFRWUFCY1VFQVJ5U3dBU0FBUWNBQWNVRUFSeVN2QVNBQVFTQnhRUUJISks0QklBQkJFSEZCQUVja3JRRWdBRUVJY1VFQVJ5UzBBU0FBUVFSeFFRQkhKTE1CSUFCQkFuRkJBRWNrc2dFZ0FFRUJjVUVBUnlTeEFRdEZBRUVQSkowQlFROGtuZ0ZCRHlTZkFVRVBKS0FCUVFBa29RRkJBQ1NpQVVFQUpLTUJRUUFrcEFGQi93QWtwUUZCL3dBa3BnRkJBU1NuQVVFQkpLZ0JRUUFrcVFFTHZRRUFRUUFrcWdGQkFDU3JBVUVBSkt3QlFRRWtyUUZCQVNTdUFVRUJKSzhCUVFFa3NBRkJBU1N4QVVFQkpMSUJRUUVrc3dGQkFTUzBBVUVCSkxVQlFRQWt0Z0ZCQUNTM0FVRUFKTGtCUVFBa3VnRVFKeEFvRUNrUUtrR2svZ05COXdBUUgwRUhKS3NCUVFja3JBRkJwZjREUWZNQkVCOUI4d0VRSzBHbS9nTkI4UUVRSDBFQkpMVUJJNHdDQkVCQnBQNERRUUFRSDBFQUpLc0JRUUFrckFGQnBmNERRUUFRSDBFQUVDdEJwdjREUWZBQUVCOUJBQ1MxQVFzUUxBcytBQ0FBUVFGeFFRQkhKTDhCSUFCQkFuRkJBRWNrd0FFZ0FFRUVjVUVBUnlUQkFTQUFRUWh4UVFCSEpNSUJJQUJCRUhGQkFFY2t3d0VnQUNTK0FRcytBQ0FBUVFGeFFRQkhKTVVCSUFCQkFuRkJBRWNreGdFZ0FFRUVjVUVBUnlUSEFTQUFRUWh4UVFCSEpNZ0JJQUJCRUhGQkFFY2t5UUVnQUNURUFRdDRBRUVBSk1vQlFRQWt5d0ZCQUNUTUFVRUFKTThCUVFBazBBRkJBQ1RSQVVFQUpNMEJRUUFremdFampRSUVRRUdFL2dOQkhoQWZRYUE5Sk1zQkJVR0UvZ05CcXdFUUgwSE0xd0lreXdFTFFZZitBMEg0QVJBZlFmZ0JKTkVCSTR3Q0JFQWpqUUpGQkVCQmhQNERRUUFRSDBFRUpNc0JDd3NMUXdCQkFDVFNBVUVBSk5NQkk0MENCRUJCZ3Y0RFFmd0FFQjlCQUNUVUFVRUFKTlVCUVFBazFnRUZRWUwrQTBIK0FCQWZRUUFrMUFGQkFTVFZBVUVBSk5ZQkN3dDFBQ09OQWdSQVFmRCtBMEg0QVJBZlFjLytBMEgrQVJBZlFjMytBMEgrQUJBZlFZRCtBMEhQQVJBZlFZLytBMEhoQVJBZlFleitBMEgrQVJBZlFmWCtBMEdQQVJBZkJVSHcvZ05CL3dFUUgwSFAvZ05CL3dFUUgwSE4vZ05CL3dFUUgwR0EvZ05CendFUUgwR1AvZ05CNFFFUUh3c0xsZ0VCQVg5Qnd3SVFIU0lBUWNBQlJnUi9RUUVGSUFCQmdBRkdRUUFqTkJzTEJFQkJBU1NOQWdWQkFDU05BZ3RCQUNTbkFrR0FxTmE1QnlTZUFrRUFKSjhDUVFBa29BSkJnS2pXdVFja29RSkJBQ1NpQWtFQUpLTUNJek1FUUVFQkpJd0NCVUVBSkl3Q0N4QWVFQ0FRSVJBbEVDWVFMVUVBRUM1Qi8vOERJNzRCRUI5QjRRRVFMMEdQL2dNanhBRVFIeEF3RURFUU1ndEtBQ0FBUVFCS0pETWdBVUVBU2lRMElBSkJBRW9rTlNBRFFRQktKRFlnQkVFQVNpUTNJQVZCQUVva09DQUdRUUJLSkRrZ0IwRUFTaVE2SUFoQkFFb2tPeUFKUVFCS0pEd1FNd3NGQUNPbkFndTVBUUJCZ0Fnamp3STZBQUJCZ1FnamtBSTZBQUJCZ2dnamtRSTZBQUJCZ3dnamtnSTZBQUJCaEFnamt3STZBQUJCaFFnamxBSTZBQUJCaGdnamxRSTZBQUJCaHdnamxnSTZBQUJCaUFnamx3STdBUUJCaWdnam1BSTdBUUJCakFnam1RSTJBZ0JCa1Fnam1nSkJBRWM2QUFCQmtnZ2ptd0pCQUVjNkFBQkJrd2dqbkFKQkFFYzZBQUJCbEFnam5RSkJBRWM2QUFCQmxRZ2pqQUpCQUVjNkFBQkJsZ2dqalFKQkFFYzZBQUJCbHdnampnSkJBRWM2QUFBTGFBQkJ5QWtqOXdFN0FRQkJ5Z2tqK0FFN0FRQkJ6QWtqK1FGQkFFYzZBQUJCelFraitnRkJBRWM2QUFCQnpna2ord0ZCQUVjNkFBQkJ6d2tqL0FGQkFFYzZBQUJCMEFrai9RRkJBRWM2QUFCQjBRa2ovZ0ZCQUVjNkFBQkIwZ2tqL3dGQkFFYzZBQUFMTlFCQitna2p5Z0UyQWdCQi9na2p5d0UyQWdCQmdnb2p6UUZCQUVjNkFBQkJoUW9qemdGQkFFYzZBQUJCaGY0REk4d0JFQjhMV0FCQjNnb2pXMEVBUnpvQUFFSGZDaU5lTmdJQVFlTUtJMTgyQWdCQjV3b2pZRFlDQUVIc0NpTmhOZ0lBUWZFS0kySTZBQUJCOGdvall6b0FBRUgzQ2lOa1FRQkhPZ0FBUWZnS0kyVTJBZ0JCL1Fvalpqc0JBQXM5QUVHUUN5TnlRUUJIT2dBQVFaRUxJM1UyQWdCQmxRc2pkallDQUVHWkN5TjNOZ0lBUVo0TEkzZzJBZ0JCb3dzamVUb0FBRUdrQ3lONk9nQUFDenNBUWZRTEk1VUJRUUJIT2dBQVFmVUxJNWNCTmdJQVFma0xJNWdCTmdJQVFmMExJNWtCTmdJQVFZSU1JNW9CTmdJQVFZY01JNXdCT3dFQUM0Z0JBQkEyUWJJSUkvRUJOZ0lBUWJZSUkrWUJPZ0FBUWNUK0F5UHlBUkFmUWVRSUk3d0JRUUJIT2dBQVFlVUlJNzBCUVFCSE9nQUFFRGNRT0VHc0NpTzJBVFlDQUVHd0NpTzNBVG9BQUVHeENpTzVBVG9BQUJBNUVEcEJ3Z3NqZ2dGQkFFYzZBQUJCd3dzamhRRTJBZ0JCeHdzamhnRTJBZ0JCeXdzamh3RTdBUUFRTzBFQUpLY0NDN2tCQUVHQUNDMEFBQ1NQQWtHQkNDMEFBQ1NRQWtHQ0NDMEFBQ1NSQWtHRENDMEFBQ1NTQWtHRUNDMEFBQ1NUQWtHRkNDMEFBQ1NVQWtHR0NDMEFBQ1NWQWtHSENDMEFBQ1NXQWtHSUNDOEJBQ1NYQWtHS0NDOEJBQ1NZQWtHTUNDZ0NBQ1NaQWtHUkNDMEFBRUVBU2lTYUFrR1NDQzBBQUVFQVNpU2JBa0dUQ0MwQUFFRUFTaVNjQWtHVUNDMEFBRUVBU2lTZEFrR1ZDQzBBQUVFQVNpU01Ba0dXQ0MwQUFFRUFTaVNOQWtHWENDMEFBRUVBU2lTT0FndGVBUUYvUVFBazhRRkJBQ1R5QVVIRS9nTkJBQkFmUWNIK0F4QWRRWHh4SVFGQkFDVG1BVUhCL2dNZ0FSQWZJQUFFUUFKQVFRQWhBQU5BSUFCQmdOZ0ZUZzBCSUFCQmdNa0Zha0gvQVRvQUFDQUFRUUZxSVFBTUFBQUxBQXNMQzRJQkFRRi9JK2dCSVFFZ0FFR0FBWEZCQUVjazZBRWdBRUhBQUhGQkFFY2s2UUVnQUVFZ2NVRUFSeVRxQVNBQVFSQnhRUUJISk9zQklBQkJDSEZCQUVjazdBRWdBRUVFY1VFQVJ5VHRBU0FBUVFKeFFRQkhKTzRCSUFCQkFYRkJBRWNrN3dFajZBRkZRUUFnQVJzRVFFRUJFRDRMUVFBajZBRWdBUnNFUUVFQUVENExDeW9BUWVRSUxRQUFRUUJLSkx3QlFlVUlMUUFBUVFCS0pMMEJRZi8vQXhBZEVDNUJqLzRERUIwUUx3dG9BRUhJQ1M4QkFDVDNBVUhLQ1M4QkFDVDRBVUhNQ1MwQUFFRUFTaVQ1QVVITkNTMEFBRUVBU2lUNkFVSE9DUzBBQUVFQVNpVDdBVUhQQ1MwQUFFRUFTaVQ4QVVIUUNTMEFBRUVBU2lUOUFVSFJDUzBBQUVFQVNpVCtBVUhTQ1MwQUFFRUFTaVQvQVF0SEFFSDZDU2dDQUNUS0FVSCtDU2dDQUNUTEFVR0NDaTBBQUVFQVNpVE5BVUdGQ2kwQUFFRUFTaVRPQVVHRi9nTVFIU1RNQVVHRy9nTVFIU1RQQVVHSC9nTVFIU1RSQVFzSEFFRUFKTG9CQzFnQVFkNEtJMXRCQUVjNkFBQkIzd29vQWdBa1hrSGpDaWdDQUNSZlFlY0tLQUlBSkdCQjdBb29BZ0FrWVVIeENpMEFBQ1JpUWZJS0xRQUFKR05COXdvdEFBQkJBRW9rWkVINENpZ0NBQ1JsUWYwS0x3RUFKR1lMUFFCQmtBc3RBQUJCQUVva2NrR1JDeWdDQUNSMVFaVUxLQUlBSkhaQm1Rc29BZ0FrZDBHZUN5Z0NBQ1I0UWFNTExRQUFKSGxCcEFzdEFBQWtlZ3M3QUVIMEN5MEFBRUVBU2lTVkFVSDFDeWdDQUNTWEFVSDVDeWdDQUNTWUFVSDlDeWdDQUNTWkFVR0NEQ2dDQUNTYUFVR0hEQzhCQUNTY0FRdk5BUUVCZnhBOVFiSUlLQUlBSlBFQlFiWUlMUUFBSk9ZQlFjVCtBeEFkSlBJQlFjRCtBeEFkRUQ4UVFFR0EvZ01RSFVIL0FYTWszd0VqM3dFaUFFRVFjVUVBUnlUZ0FTQUFRU0J4UVFCSEpPRUJFRUVRUWtHc0NpZ0NBQ1MyQVVHd0NpMEFBQ1MzQVVHeENpMEFBQ1M1QVVFQUpMb0JFRVFRUlVIQ0N5MEFBRUVBU2lTQ0FVSERDeWdDQUNTRkFVSEhDeWdDQUNTR0FVSExDeThCQUNTSEFSQkdRUUFrcHdKQmdLald1UWNrbmdKQkFDU2ZBa0VBSktBQ1FZQ28xcmtISktFQ1FRQWtvZ0pCQUNTakFnc0ZBQ09OQWdzRkFDT2hBZ3NGQUNPaUFnc0ZBQ09qQWd1eUFnRUdmeU5OSWdVZ0FFWkJBQ05NSUFSR1FRQWdBRUVJU2tFQUlBRkJBRW9iR3hzRVFDQURRUUZyRUIxQklIRkJBRWNoQ0NBREVCMUJJSEZCQUVjaENVRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQWdnQ1VjYklnY2dBR29pQTBHZ0FVd0VRQ0FCUWFBQmJDQURha0VEYkVHQXlRVnFJZ1F0QUFBaENpQUVJQW82QUFBZ0FVR2dBV3dnQTJwQkEyeEJnY2tGYWlBRUxRQUJPZ0FBSUFGQm9BRnNJQU5xUVFOc1FZTEpCV29nQkMwQUFqb0FBQ0FCUWFBQmJDQURha0dBa1FScUlBQkJBQ0FIYTJzZ0FVR2dBV3hxUWZpUUJHb3RBQUFpQTBFRGNTSUVRUVJ5SUFRZ0EwRUVjUnM2QUFBZ0JrRUJhaUVHQ3lBSFFRRnFJUU1NQVFzTEJTQUVKRXdMSUFBZ0JVNEVRQ0FBUVFocUlnRWdBa0VIY1NJQ2FpQUJJQUFnQWtnYklRVUxJQVVrVFNBR0N5a0FJQUJCZ0pBQ1JnUkFJQUZCZ0FGcklBRkJnQUZxSUFGQmdBRnhHeUVCQ3lBQlFRUjBJQUJxQzBvQUlBQkJBM1FnQVVFQmRHb2lBRUVCYWtFL2NTSUJRVUJySUFFZ0FodEJnSkFFYWkwQUFDRUJJQUJCUDNFaUFFRkFheUFBSUFJYlFZQ1FCR290QUFBZ0FVSC9BWEZCQ0hSeUM4Z0JBQ0FCRUIwZ0FFRUJkSFZCQTNFaEFDQUJRY2orQTBZRVFDTkJJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalFpRUJEQUlMSTBNaEFRd0JDeU5FSVFFTEJTQUJRY24rQTBZRVFDTkZJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalJpRUJEQUlMSTBjaEFRd0JDeU5JSVFFTEJTTTlJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalBpRUJEQUlMSXo4aEFRd0JDeU5BSVFFTEN3c2dBUXVQQXdFR2Z5QUJJQUFRVFNBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnNGdDRWdFUUVFQUlRVUNmMEVCUVFjZ0FHc2dBRUVCSUF0QklIRkZJQXRCQUVnYkd5SUJkQ0FTY1FSQVFRSWhCUXNnQlVFQmFnc2dCVUVCSUFGMElCRnhHeUVDSTQwQ0JIOUJBU0FNUVFCT0lBdEJBRTRiQlVFQUN3Ui9JQXRCQjNFaEFTQU1RUUJPSWdVRVFDQU1RUWR4SVFFTElBRWdBaUFGRUU0aUJVRWZjVUVEZENFQklBVkI0QWR4UVFWMVFRTjBJUThnQlVHQStBRnhRUXAxUVFOMEJTQUNRY2YrQXlBS0lBcEJBRXdiSWdvUVR5SUZRWUNBL0FkeFFSQjFJUUVnQlVHQS9nTnhRUWgxSVE4Z0JVSC9BWEVMSVFVZ0J5QUliQ0FPYWtFRGJDQUphaUlRSUFFNkFBQWdFRUVCYWlBUE9nQUFJQkJCQW1vZ0JUb0FBQ0FIUWFBQmJDQU9ha0dBa1FScUlBSkJBM0VpQVVFRWNpQUJJQXRCZ0FGeFFRQkhRUUFnQzBFQVRoc2JPZ0FBSUExQkFXb2hEUXNnQUVFQmFpRUFEQUVMQ3lBTkMzNEJBMzhnQTBFSGNTRURRUUFnQWlBQ1FRTjFRUU4wYXlBQUd5RUhRYUFCSUFCclFRY2dBRUVJYWtHZ0FVb2JJUWhCZnlFQ0k0MENCRUFnQkVHQTBINXFMUUFBSWdKQkNIRkJBRWNoQ1NBQ1FjQUFjUVJBUVFjZ0Eyc2hBd3NMSUFZZ0JTQUpJQWNnQ0NBRElBQWdBVUdnQVVHQXlRVkJBQ0FDUVg4UVVBdWhBZ0VCZnlBRFFRZHhJUU1nQlNBR0VFMGdCRUdBMEg1cUxRQUFJZ1JCd0FCeEJIOUJCeUFEYXdVZ0F3dEJBWFJxSWdWQmdKQithaUFFUVFoeFFRQkhJZ1pCRFhScUxRQUFJUWNnQWtFSGNTRURRUUFoQWlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxSUFSQkIzRUNmeUFGUVlHUWZtb2dCa0VCY1VFTmRHb3RBQUJCQVNBRFFRY2dBMnNnQkVFZ2NSc2lBM1J4QkVCQkFpRUNDeUFDUVFGcUN5QUNRUUVnQTNRZ0IzRWJJZ05CQUJCT0lnSkJIM0ZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ2NrRmFpQUNRZUFIY1VFRmRVRURkRG9BQUNBQlFhQUJiQ0FBYWtFRGJFR0N5UVZxSUFKQmdQZ0JjVUVLZFVFRGREb0FBQ0FCUWFBQmJDQUFha0dBa1FScUlBTkJBM0VpQUVFRWNpQUFJQVJCZ0FGeEd6b0FBQXZFQVFBZ0JDQUZFRTBnQTBFSGNVRUJkR29pQkVHQWtINXFMUUFBSVFWQkFDRURJQUZCb0FGc0lBQnFRUU5zUVlESkJXb0NmeUFFUVlHUWZtb3RBQUJCQVVFSElBSkJCM0ZySWdKMGNRUkFRUUloQXdzZ0EwRUJhZ3NnQTBFQklBSjBJQVZ4R3lJRFFjZitBeEJQSWdKQmdJRDhCM0ZCRUhVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ2NrRmFpQUNRWUQrQTNGQkNIVTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdza0ZhaUFDT2dBQUlBRkJvQUZzSUFCcVFZQ1JCR29nQTBFRGNUb0FBQXZVQVFFR2Z5QURRUU4xSVFvRFFDQUVRYUFCU0FSQUlBUWdCV29pQmtHQUFrNEVRQ0FHUVlBQ2F5RUdDeUFLUVFWMElBSnFJQVpCQTNWcUlnaEJnSkIrYWkwQUFDRUhRUUFoQ1NNN0JFQWdCQ0FBSUFZZ0NDQUhFRXdpQzBFQVNnUkFRUUVoQ1NBTFFRRnJJQVJxSVFRTEN5QUpSVUVBSXpvYkJFQWdCQ0FBSUFZZ0F5QUlJQUVnQnhCUklnWkJBRW9FUUNBR1FRRnJJQVJxSVFRTEJTQUpSUVJBSTQwQ0JFQWdCQ0FBSUFZZ0F5QUlJQUVnQnhCU0JTQUVJQUFnQmlBRElBRWdCeEJUQ3dzTElBUkJBV29oQkF3QkN3c0xNZ0VEZnlQMUFTRURJQUFqOWdFaUJFZ0VRQThMUVFBZ0EwRUhheUlEYXlFRklBQWdBU0FDSUFBZ0JHc2dBeUFGRUZRTG93VUJEMzhDUUVFbklRWURRQ0FHUVFCSURRRWdCa0VDZENJRlFZRDhBMm9pQXhBZElRSWdBMEVCYWhBZElRY2dBMEVDYWhBZElRTWdBa0VRYXlFRUlBZEJDR3NoQzBFSUlRSWdBUVJBUVJBaEFpQURJQU5CQVhGcklRTUxJQUFnQWlBRWFraEJBQ0FBSUFST0d3UkFJQVZCZy93RGFoQWRJZ1ZCZ0FGeFFRQkhJUXdnQlVFZ2NVRUFSeUVOUVlDQUFpQURFRTBnQWlBQUlBUnJJZ05yUVFGcklBTWdCVUhBQUhFYlFRRjBhaUlEUVlDUWZtb2dCVUVJY1VFQVJ5T05BaUlDSUFJYlFRRnhRUTEwSWdKcUxRQUFJUTRnQTBHQmtINXFJQUpxTFFBQUlROUJCeUVEQTBBZ0EwRUFUZ1JBUVFBaEFnSi9RUUZCQUNBRFFRZHJheUFESUEwYklnUjBJQTl4QkVCQkFpRUNDeUFDUVFGcUN5QUNRUUVnQkhRZ0RuRWJJZ1FFUUVFSElBTnJJQXRxSWdKQkFFNEVmeUFDUWFBQlRBVkJBQXNFUUVFQUlRZEJBQ0VLSSs4QlJTT05BaUlJSUFnYklnaEZCRUFnQUVHZ0FXd2dBbXBCZ0pFRWFpMEFBQ0lKSVJBZ0NVRURjU0lKUVFCTFFRQWdEQnNFUUVFQklRY0ZRUUZCQUNBSlFRQkxRUUFnRUVFRWNVRUFSMEVBSTQwQ0d4c2JJUW9MQzBFQlFRQWdDa1VnQnhzZ0NCc0VRQ09OQWdSQUlBQkJvQUZzSUFKcVFRTnNRWURKQldvZ0JVRUhjU0FFUVFFUVRpSUVRUjl4UVFOME9nQUFJQUJCb0FGc0lBSnFRUU5zUVlISkJXb2dCRUhnQjNGQkJYVkJBM1E2QUFBZ0FFR2dBV3dnQW1wQkEyeEJnc2tGYWlBRVFZRDRBWEZCQ25WQkEzUTZBQUFGSUFCQm9BRnNJQUpxUVFOc1FZREpCV29nQkVISi9nTkJ5UDRESUFWQkVIRWJFRThpQkVHQWdQd0hjVUVRZFRvQUFDQUFRYUFCYkNBQ2FrRURiRUdCeVFWcUlBUkJnUDREY1VFSWRUb0FBQ0FBUWFBQmJDQUNha0VEYkVHQ3lRVnFJQVE2QUFBTEN3c0xJQU5CQVdzaEF3d0JDd3NMSUFaQkFXc2hCZ3dBQUFzQUN3dGtBUUYvUVlDQUFrR0FrQUlqNndFYklRRkJBU1B2QVNPTkFoc0VRQ0FBSUFGQmdMZ0NRWUN3QWlQc0FSc2o5QUVnQUdwQi93RnhRUUFqOHdFUVZBc2o2Z0VFUUNBQUlBRkJnTGdDUVlDd0FpUHBBUnNRVlFzajdnRUVRQ0FBSSswQkVGWUxDeVVCQVg4Q1FBTkFJQUJCa0FGS0RRRWdBRUgvQVhFUVZ5QUFRUUZxSVFBTUFBQUxBQXNMUmdFQ2Z3TkFJQUZCa0FGT1JRUkFRUUFoQUFOQUlBQkJvQUZJQkVBZ0FVR2dBV3dnQUdwQmdKRUVha0VBT2dBQUlBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBRUxDd3NiQUVHUC9nTVFIVUVCSUFCMGNpSUFKTVFCUVkvK0F5QUFFQjhMQ3dCQkFTVEdBVUVCRUZvTExnRUJmd0ovSTNjaUFFRUFTZ1IvSTNBRlFRQUxCRUFnQUVFQmF5RUFDeUFBUlFzRVFFRUFKSElMSUFBa2R3c3lBUUYvQW44amhnRWlBRUVBU2dSL0k0QUJCVUVBQ3dSQUlBQkJBV3NoQUFzZ0FFVUxCRUJCQUNTQ0FRc2dBQ1NHQVFzeUFRRi9BbjhqbVFFaUFFRUFTZ1IvSTVRQkJVRUFDd1JBSUFCQkFXc2hBQXNnQUVVTEJFQkJBQ1NWQVFzZ0FDU1pBUXRIQVFKL0lBQWtaa0dVL2dNUUhVSDRBWEVoQVVHVC9nTWdBRUgvQVhFaUFoQWZRWlQrQXlBQklBQkJDSFZCQjNFaUFISVFIeUFDSkZnZ0FDUmFJMWdqV2tFSWRISWtYUXVpQVFFQ2Z5TmtSVUVCSTFzYkJFQVBDeU5sUVFGcklnQkJBRXdFUUNOUUJFQWpVQ1JsQW44alppSUJJMUoxSVFCQkFTTlJCSDlCQVNSbklBRWdBR3NGSUFBZ0FXb0xJZ0JCL3c5S0RRQWFRUUFMQkVCQkFDUmJDeU5TUVFCS0JFQWdBQkJmQW44alppSUJJMUoxSVFCQkFTTlJCSDlCQVNSbklBRWdBR3NGSUFBZ0FXb0xRZjhQU2cwQUdrRUFDd1JBUVFBa1d3c0xCVUVJSkdVTEJTQUFKR1VMQzBjQkFuOGpYMEVCYXlJQlFRQk1CRUFqVnlJQkJFQWpZU0VBSUFCQkQwaEJBQ05XR3dSL0lBQkJBV29GSUFCQkFXc2dBRUVBSUFCQkFFb2pWaHNiQ3lSaEN3c2dBU1JmQzBjQkFuOGpka0VCYXlJQlFRQk1CRUFqYmlJQkJFQWplQ0VBSUFCQkQwaEJBQ050R3dSL0lBQkJBV29GSUFCQkFXc2dBRUVBSUFCQkFFb2piUnNiQ3lSNEN3c2dBU1IyQzA0QkFuOGptQUZCQVdzaUFVRUFUQVJBSTVBQklnRUVRQ09hQVNFQUlBQkJEMGhCQUNPUEFSc0VmeUFBUVFGcUJTQUFRUUZySUFCQkFDQUFRUUJLSTQ4Qkd4c0xKSm9CQ3dzZ0FTU1lBUXVwQWdFQ2YwR0F3QUFqamdKMElnRWhBaU8yQVNBQWFpSUFJQUZPQkVBZ0FDQUNheVMyQVFKQUFrQUNRQUpBQWtBanVRRkJBV3BCQjNFaUFBUkFJQUJCQWtZTkFRSkFJQUJCQkdzT0JBTUFCQVVBQ3d3RkN5TmdJZ0ZCQUVvRWZ5TlpCVUVBQ3dSQUlBRkJBV3NpQVVVRVFFRUFKRnNMQ3lBQkpHQVFYQkJkRUY0TUJBc2pZQ0lCUVFCS0JIOGpXUVZCQUFzRVFDQUJRUUZySWdGRkJFQkJBQ1JiQ3dzZ0FTUmdFRndRWFJCZUVHQU1Bd3NqWUNJQlFRQktCSDhqV1FWQkFBc0VRQ0FCUVFGcklnRkZCRUJCQUNSYkN3c2dBU1JnRUZ3UVhSQmVEQUlMSTJBaUFVRUFTZ1IvSTFrRlFRQUxCRUFnQVVFQmF5SUJSUVJBUVFBa1d3c0xJQUVrWUJCY0VGMFFYaEJnREFFTEVHRVFZaEJqQ3lBQUpMa0JRUUVQQlNBQUpMWUJDMEVBQzNRQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBQ1FDQUFRUUpyRGdNQ0F3UUFDd3dFQ3lOY0lnQWpvUUZISVFFZ0FDU2hBU0FCRHdzamN5SUFJNklCUnlFQklBQWtvZ0VnQVE4TEk0TUJJZ0Fqb3dGSElRRWdBQ1NqQVNBQkR3c2psZ0VpQUNPa0FVY2hBU0FBSktRQklBRVBDMEVBQzFVQUFrQUNRQUpBSUFCQkFVY0VRQ0FBUVFKR0RRRWdBRUVEUmcwQ0RBTUxRUUVnQVhSQmdRRnhRUUJIRHd0QkFTQUJkRUdIQVhGQkFFY1BDMEVCSUFGMFFmNEFjVUVBUnc4TFFRRWdBWFJCQVhGQkFFY0xjQUVCZnlOZUlBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBalhXdEJBblFpQVVFQ2RDQUJJNDRDR3lSZUkxNGdBRUVmZFNJQklBQWdBV3B6YXlFQUkyTkJBV3BCQjNFa1l3d0JDd3NnQUNSZUkxeEJBQ05iR3dSL0kyRUZRUThQQ3lOVEkyTVFaZ1IvUVFFRlFYOExiRUVQYWd0cEFRRi9JM1VnQUdzaEFBTkFJQUJCQUV3RVFFR0FFQ04wYTBFQ2RDT09BblFrZFNOMUlBQkJIM1VpQVNBQUlBRnFjMnNoQUNONlFRRnFRUWR4SkhvTUFRc0xJQUFrZFNOelFRQWpjaHNFZnlONEJVRVBEd3NqYWlONkVHWUVmMEVCQlVGL0MyeEJEMm9MRHdBamh3RkJBWFZCc1A0RGFoQWRDeXNCQVg4amh3RkJBV29oQUFOQUlBQkJJRWhGQkVBZ0FFRWdheUVBREFFTEN5QUFKSWNCRUdra2lnRUw1d0VCQTM4amd3RkZRUUVqZ2dFYkJFQkJEdzhMSTRnQklRSWppUUVFUUVHYy9nTVFIVUVGZFVFUGNTSUNKSWdCUVFBa2lRRUxJNG9CSTRjQlFRRnhSVUVDZEhWQkQzRWhBUUpBQWtBQ1FBSkFJQUlFUUNBQ1FRRkdEUUVnQWtFQ1JnMENEQU1MSUFGQkJIVWhBUXdEQzBFQklRTU1BZ3NnQVVFQmRTRUJRUUloQXd3QkN5QUJRUUoxSVFGQkJDRURDeUFEUVFCS0JIOGdBU0FEYlFWQkFBdEJEMm9oQVNPRkFTQUFheUVBQTBBZ0FFRUFUQVJBUVlBUUk0UUJhMEVCZENPT0FuUWtoUUVqaFFFZ0FFRWZkU0lDSUFBZ0FtcHpheUVBRUdvTUFRc0xJQUFraFFFZ0FRdU1BUUVDZnlPWEFTQUFheUlBUVFCTUJFQWptd0Vqa1FGMEk0NENkQ0FBUVI5MUlnRWdBQ0FCYW5OcklRQWpuQUVpQVVFQmRTSUNJQUZCQVhFZ0FrRUJjWE1pQVVFT2RISWlBa0cvZjNFZ0FVRUdkSElnQWlPU0FSc2tuQUVMUVFBZ0FDQUFRUUJJR3lTWEFTT1dBVUVBSTVVQkd3Ui9JNW9CQlVFUER3dEJmMEVCSTV3QlFRRnhHMnhCRDJvTE1BQWdBRUU4UmdSQVFmOEFEd3NnQUVFOGEwR2dqUVpzSUFGc1FRTjFRYUNOQm0xQlBHcEJvSTBHYkVHTThRSnRDNWNCQVFGL1FRQWtwd0VnQUVFUEk2MEJHeUFCUVE4anJnRWJhaUFDUVE4anJ3RWJhaUFEUVE4anNBRWJhaUVFSUFCQkR5T3hBUnNnQVVFUEk3SUJHMm9oQUNBQUlBSkJEeU96QVJ0cUlRRWdBMEVQSTdRQkd5RURRUUFrcUFGQkFDU3BBU0FFSTZzQlFRRnFFRzBoQUNBQklBTnFJNndCUVFGcUVHMGhBU0FBSktVQklBRWtwZ0VnQVVIL0FYRWdBRUgvQVhGQkNIUnlDNE1EQVFWL0kwNGdBR29pQWlST0kxNGdBbXRCQUV3aUFrVUVRRUVCRUdVaEFnc2phQ0FBYWlJQkpHZ2pkU0FCYTBFQVRDSUJSUVJBUVFJUVpTRUJDeU43SUFCcUpIdEJBQ09GQVNON2EwRUFTaU9KQVJ0RklnUkZCRUJCQXhCbElRUUxJNHNCSUFCcUpJc0JJNWNCSTRzQmEwRUFUQ0lGUlFSQVFRUVFaU0VGQ3lBQ0JFQWpUaUVEUVFBa1RpQURFR2NrblFFTElBRUVRQ05vSVFOQkFDUm9JQU1RYUNTZUFRc2dCQVJBSTNzaEEwRUFKSHNnQXhCckpKOEJDeUFGQkVBaml3RWhBMEVBSklzQklBTVFiQ1NnQVF0QkFTQUZRUUVnQkVFQklBRWdBaHNiR3dSQVFRRWtxUUVMUVlDQWdBSWpqZ0owSTdnQmJTSUNJUUVqdHdFZ0FHb2lBQ0FDVGdSQUlBQWdBV3NoQUVFQkk2Z0JRUUVqcHdFanFRRWJHd1JBSTUwQkk1NEJJNThCSTZBQkVHNGFCU0FBSkxjQkN5TzZBU0lDUVFGMFFZQ1p3UUJxSWdFanBRRkJBbW82QUFBZ0FVRUJhaU9tQVVFQ2Fqb0FBQ0FDUVFGcUlnRWp1d0ZCQVhWQkFXdE9CSDhnQVVFQmF3VWdBUXNrdWdFTElBQWt0d0VMcUFNQkJuOGdBQkJuSVFFZ0FCQm9JUUlnQUJCcklRUWdBQkJzSVFVZ0FTU2RBU0FDSko0QklBUWtud0VnQlNTZ0FTTzNBU0FBYWlJQVFZQ0FnQUlqamdKMEk3Z0JiVTRFUUNBQVFZQ0FnQUlqamdKMEk3Z0JiV3NoQUNBQklBSWdCQ0FGRUc0aEF5TzZBVUVCZEVHQW1jRUFhaUlHSUFOQmdQNERjVUVJZFVFQ2Fqb0FBQ0FHUVFGcUlBTkIvd0Z4UVFKcU9nQUFJendFUUNBQlFROUJEMEVQRUc0aEFTTzZBVUVCZEVHQW1TRnFJZ01nQVVHQS9nTnhRUWgxUVFKcU9nQUFJQU5CQVdvZ0FVSC9BWEZCQW1vNkFBQkJEeUFDUVE5QkR4QnVJUUVqdWdGQkFYUkJnSmtwYWlJQ0lBRkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUZCL3dGeFFRSnFPZ0FBUVE5QkR5QUVRUThRYmlFQkk3b0JRUUYwUVlDWk1Xb2lBaUFCUVlEK0EzRkJDSFZCQW1vNkFBQWdBa0VCYWlBQlFmOEJjVUVDYWpvQUFFRVBRUTlCRHlBRkVHNGhBU082QVVFQmRFR0FtVGxxSWdJZ0FVR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBVUgvQVhGQkFtbzZBQUFMSTdvQlFRRnFJZ0VqdXdGQkFYVkJBV3RPQkg4Z0FVRUJhd1VnQVFza3VnRUxJQUFrdHdFTEhnRUJmeUFBRUdRaEFTQUJSVUVBSXprYkJFQWdBQkJ2QlNBQUVIQUxDeThCQW45QjF3QWpqZ0owSVFFanFnRWhBQU5BSUFBZ0FVNEVRQ0FCRUhFZ0FDQUJheUVBREFFTEN5QUFKS29CQzZVREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdRL2dOSEJFQWdBRUdWL2dOR0RRRUNRQ0FBUVpIK0Eyc09GZ1lMRUJRQUJ3d1JGUU1JRFJJV0JBa09FeGNGQ2c4QUN3d1hDMEdRL2dNUUhVR0FBWElQQzBHVi9nTVFIVUgvQVhJUEMwR2EvZ01RSFVIL0FISVBDMEdmL2dNUUhVSC9BWElQQzBHay9nTVFIUThMUVpIK0F4QWRRVDl5RHd0Qmx2NERFQjFCUDNJUEMwR2IvZ01RSFVIL0FYSVBDMEdnL2dNUUhVSC9BWElQQzBHbC9nTVFIUThMUVpMK0F4QWREd3RCbC80REVCMFBDMEdjL2dNUUhVR2ZBWElQQzBHaC9nTVFIUThMUVlBQlFRQWp0UUViSVFBZ0FFRUJjaUFBUVg1eEkxc2JJUUFnQUVFQ2NpQUFRWDF4STNJYklRQWdBRUVFY2lBQVFYdHhJNElCR3lFQUlBQkJDSElnQUVGM2NTT1ZBUnRCOEFCeUR3dEJrLzRERUIxQi93RnlEd3RCbVA0REVCMUIvd0Z5RHd0Qm5mNERFQjFCL3dGeUR3dEJvdjRERUIwUEMwR1UvZ01RSFVHL0FYSVBDMEdaL2dNUUhVRy9BWElQQzBHZS9nTVFIVUcvQVhJUEMwR2ovZ01RSFVHL0FYSVBDMEYvQzV3QkFRRi9JOThCSVFBajRBRUVRQ0FBUVh0eElBQkJCSElqMXdFYklRQWdBRUYrY1NBQVFRRnlJOW9CR3lFQUlBQkJkM0VnQUVFSWNpUFlBUnNoQUNBQVFYMXhJQUJCQW5JajJRRWJJUUFGSStFQkJFQWdBRUYrY1NBQVFRRnlJOXNCR3lFQUlBQkJmWEVnQUVFQ2NpUGNBUnNoQUNBQVFYdHhJQUJCQkhJajNRRWJJUUFnQUVGM2NTQUFRUWh5STk0Qkd5RUFDd3NnQUVId0FYSUwxUUlBSUFCQmdJQUNTQVJBUVg4UEN5QUFRWURBQWtoQkFDQUFRWUNBQWs0YkJFQkJmdzhMSUFCQmdQd0RTRUVBSUFCQmdNQURUaHNFUUNBQVFZQkFhaEFkRHdzZ0FFR2YvUU5NUVFBZ0FFR0EvQU5PR3dSQVFmOEJRWDhqNWdGQkFrZ2JEd3NnQUVITi9nTkdCRUJCL3dFaEFFSE4vZ01RSFVFQmNVVUVRRUgrQVNFQUN5T09Ba1VFUUNBQVFmOStjU0VBQ3lBQUR3c2dBRUhFL2dOR0JFQWdBQ1B5QVJBZkkvSUJEd3NnQUVHbS9nTk1RUUFnQUVHUS9nTk9Hd1JBRUhJZ0FCQnpEd3NnQUVHdi9nTk1RUUFnQUVHbi9nTk9Hd1JBUWY4QkR3c2dBRUcvL2dOTVFRQWdBRUd3L2dOT0d3UkFFSElqZ2dFRVFCQnBEd3RCZnc4TElBQkJoUDREUmdSQUlBQWp5d0ZCZ1A0RGNVRUlkU0lBRUI4Z0FBOExJQUJCaGY0RFJnUkFJQUFqekFFUUh5UE1BUThMSUFCQmovNERSZ1JBSThRQlFlQUJjZzhMSUFCQmdQNERSZ1JBRUhRUEMwRi9DeWtCQVg4ajR3RWdBRVlFUUVFQkpPVUJDeUFBRUhVaUFVRi9SZ1IvSUFBUUhRVWdBVUgvQVhFTEM2UUNBUU4vSS9zQkJFQVBDeVA4QVNFREkvMEJJUUlnQUVIL1Awd0VRQ0FDQkg4Z0FVRVFjVVVGUVFBTFJRUkFJQUZCRDNFaUFBUkFJQUJCQ2tZRVFFRUJKUGtCQ3dWQkFDVDVBUXNMQlNBQVFmLy9BRXdFUUNQL0FTSUVCSDhnQUVILzN3Qk1CVUVCQ3dSQUlBRkJEM0VqOXdFZ0Foc2hBQ0FEQkg4Z0FVRWZjU0VCSUFCQjRBRnhCU1ArQVFSL0lBRkIvd0J4SVFFZ0FFR0FBWEVGUVFBZ0FDQUVHd3NMSVFBZ0FDQUJjaVQzQVFVajl3RkIvd0Z4SUFGQkFFcEJDSFJ5SlBjQkN3VkJBQ0FBUWYrL0FVd2dBaHNFUUNQNkFVRUFJQU1iQkVBajl3RkJIM0VnQVVIZ0FYRnlKUGNCRHdzZ0FVRVBjU0FCUVFOeEkvOEJHeVQ0QVFWQkFDQUFRZi8vQVV3Z0Foc0VRQ0FEQkVBZ0FVRUJjVUVBUnlUNkFRc0xDd3NMQ3pjQkFYOGpVU0VCSUFCQjhBQnhRUVIxSkZBZ0FFRUljVUVBUnlSUklBQkJCM0VrVWtFQUkyY2pVUnRCQUNBQkd3UkFRUUFrV3dzTE5BQWdBRUVFZFVFUGNTUlZJQUJCQ0hGQkFFY2tWaUFBUVFkeEpGY2dBRUg0QVhGQkFFb2lBQ1JjSUFCRkJFQWdBQ1JiQ3dzMEFDQUFRUVIxUVE5eEpHd2dBRUVJY1VFQVJ5UnRJQUJCQjNFa2JpQUFRZmdCY1VFQVNpSUFKSE1nQUVVRVFDQUFKSElMQ3prQUlBQkJCSFZCRDNFa2pnRWdBRUVJY1VFQVJ5U1BBU0FBUVFkeEpKQUJJQUJCK0FGeFFRQktJZ0FrbGdFZ0FFVUVRQ0FBSkpVQkN3czRBQ0FBUVFSMUpKRUJJQUJCQ0hGQkFFY2trZ0VnQUVFSGNTSUFKSk1CSUFCQkFYUWlBRUVCU0FSQVFRRWhBQXNnQUVFRGRDU2JBUXViQVFFQ2YwRUJKRnNqWUVVRVFDTlBKR0FMUVlBUUkxMXJRUUowSWdCQkFuUWdBQ09PQWhza1hpTlhKRjhqVlNSaEkxMGtaaU5RQkVBalVDUmxCVUVJSkdVTFFRRWpVa0VBU2lJQUkxQkJBRW9iSkdSQkFDUm5JQUFFZndKL0kyWWlBQ05TZFNFQlFRRWpVUVIvUVFFa1p5QUFJQUZyQlNBQUlBRnFDMEgvRDBvTkFCcEJBQXNGUVFBTEJFQkJBQ1JiQ3lOY1JRUkFRUUFrV3dzTGtRRUJBbjhnQUVFSGNTSUJKRm9qV0NBQlFRaDBjaVJkSTdrQlFRRnhRUUZHSVFJaldVVWlBUVJBSUFCQndBQnhRUUJISVFFTElBSkZCRUJCQUNBQkkyQkJBRXdiQkVBallFRUJheVJnUVFBallFVWdBRUdBQVhFYkJFQkJBQ1JiQ3dzTElBQkJ3QUJ4UVFCSEpGa2dBRUdBQVhFRVFCQjlJMWxCQUVFQUkyQWpUMFlnQWhzYkJFQWpZRUVCYXlSZ0N3c0xNUUJCQVNSeUkzZEZCRUFqYVNSM0MwR0FFQ04wYTBFQ2RDT09BblFrZFNOdUpIWWpiQ1I0STNORkJFQkJBQ1J5Q3d1UkFRRUNmeUFBUVFkeElnRWtjU052SUFGQkNIUnlKSFFqdVFGQkFYRkJBVVloQWlOd1JTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFamQwRUFUQnNFUUNOM1FRRnJKSGRCQUNOM1JTQUFRWUFCY1JzRVFFRUFKSElMQ3dzZ0FFSEFBSEZCQUVja2NDQUFRWUFCY1FSQUVIOGpjRUVBUVFBamR5TnBSaUFDR3hzRVFDTjNRUUZySkhjTEN3cytBRUVCSklJQkk0WUJSUVJBSTN3a2hnRUxRWUFRSTRRQmEwRUJkQ09PQW5Ra2hRRWpoUUZCQm1va2hRRkJBQ1NIQVNPREFVVUVRRUVBSklJQkN3dWFBUUVDZnlBQVFRZHhJZ0VrZ1FFamZ5QUJRUWgwY2lTRUFTTzVBVUVCY1VFQlJpSUNSUVJBUVFBZ0FFSEFBSEZCQUVjamdBRWJJUUZCQUNBQkk0WUJRUUJNR3dSQUk0WUJRUUZySklZQlFRQWpoZ0ZGSUFCQmdBRnhHd1JBUVFBa2dnRUxDd3NnQUVIQUFIRkJBRWNrZ0FFZ0FFR0FBWEVFUUJDQkFTT0FBVUVBUVFBamhnRWpmRVlnQWhzYkJFQWpoZ0ZCQVdza2hnRUxDd3RCQUVFQkpKVUJJNWtCUlFSQUk0d0JKSmtCQ3lPYkFTT1JBWFFqamdKMEpKY0JJNUFCSkpnQkk0NEJKSm9CUWYvL0FTU2NBU09XQVVVRVFFRUFKSlVCQ3d1TEFRRUNmeU81QVVFQmNVRUJSaUVDSTVRQlJTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFam1RRkJBRXdiQkVBam1RRkJBV3NrbVFGQkFDT1pBVVVnQUVHQUFYRWJCRUJCQUNTVkFRc0xDeUFBUWNBQWNVRUFSeVNVQVNBQVFZQUJjUVJBRUlNQkk1UUJRUUJCQUNPWkFTT01BVVlnQWhzYkJFQWptUUZCQVdza21RRUxDd3VjQkFBanRRRkZRUUFnQUVHbS9nTkhHd1JBUVFBUEN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJrUDREUndSQUlBQkJtdjREUmcwQkFrQWdBRUdSL2dOckRoWURCd3NQQUFRSURCQUFCUWtORVFBR0NnNFNFeFFWQUFzTUZRc2dBUkI0REJVTFFRQWdBVUdBQVhGQkFFY2lBQ09EQVJzRVFFRUFKSW9CQ3lBQUpJTUJJQUJGQkVBZ0FDU0NBUXNNRkFzZ0FVRUdkVUVEY1NSVElBRkJQM0VrVkNOUEkxUnJKR0FNRXdzZ0FVRUdkVUVEY1NScUlBRkJQM0VrYXlOcEkydHJKSGNNRWdzZ0FTUjlJM3dqZldza2hnRU1FUXNnQVVFL2NTU05BU09NQVNPTkFXc2ttUUVNRUFzZ0FSQjVEQThMSUFFUWVnd09DMEVCSklrQklBRkJCWFZCRDNFa2Znd05DeUFCRUhzTURBc2dBU1JZSTFwQkNIUWdBWElrWFF3TEN5QUJKRzhqY1VFSWRDQUJjaVIwREFvTElBRWtmeU9CQVVFSWRDQUJjaVNFQVF3SkN5QUJFSHdNQ0FzZ0FSQitEQWNMSUFFUWdBRU1CZ3NnQVJDQ0FRd0ZDeUFCRUlRQkRBUUxJQUZCQkhWQkIzRWtxd0VnQVVFSGNTU3NBVUVCSktjQkRBTUxJQUVRSzBFQkpLZ0JEQUlMSTdVQklnQUVmMEVBQlNBQlFZQUJjUXNFUUVFSEpMa0JRUUFrWTBFQUpIb0xJQUZCZ0FGeFJVRUFJQUFiQkVBQ1FFR1EvZ01oQUFOQUlBQkJwdjREVGcwQklBQkJBQkNTQVNBQVFRRnFJUUFNQUFBTEFBc0xJQUZCZ0FGeFFRQkhKTFVCREFFTFFRRVBDMEVCQ3p3QkFYOGdBRUVJZENFQlFRQWhBQU5BQWtBZ0FFR2ZBVW9OQUNBQVFZRDhBMm9nQUNBQmFoQWRFQjhnQUVFQmFpRUFEQUVMQzBHRUJTU0ZBZ3NqQVFGL0k0QUNFQjBoQUNPQkFoQWRRZjhCY1NBQVFmOEJjVUVJZEhKQjhQOERjUXNuQVFGL0k0SUNFQjBoQUNPREFoQWRRZjhCY1NBQVFmOEJjVUVJZEhKQjhEOXhRWUNBQW1vTGhnRUJBMzhqalFKRkJFQVBDeUFBUVlBQmNVVkJBQ09HQWhzRVFFRUFKSVlDSTRRQ0VCMUJnQUZ5SVFBamhBSWdBQkFmRHdzUWh3RWhBUkNJQVNFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSklZQ0lBTWtod0lnQVNTSUFpQUNKSWtDSTRRQ0lBQkIvMzV4RUI4RklBRWdBaUFERUpNQkk0UUNRZjhCRUI4TEMxVUJCSDlCQVNOTElnTWdBRVlqU2lBQVJoc0VRQ0FBUVFGcklnUVFIVUcvZjNFaUFrRS9jU0lGUVVCcklBVWdBQ0FEUmh0QmdKQUVhaUFCT2dBQUlBSkJnQUZ4QkVBZ0JDQUNRUUZxUVlBQmNoQWZDd3NMTVFBQ1FBSkFBa0FDUUNBQUJFQUNRQ0FBUVFGckRnTUNBd1FBQ3d3RUMwRUpEd3RCQXc4TFFRVVBDMEVIRHd0QkFBc2ZBQ0FBUVFFajBRRVFpd0VpQUhSeEJIOUJBU0FBZENBQmNVVUZRUUFMQzRZQkFRUi9BMEFnQWlBQVNBUkFJQUpCQkdvaEFpUExBU0lCUVFScVFmLy9BM0VpQXlUTEFTUFFBUVJBSTg0QklRUWp6UUVFUUNQUEFTVE1BVUVCSk1jQlFRSVFXa0VBSk0wQlFRRWt6Z0VGSUFRRVFFRUFKTTRCQ3dzZ0FTQURFSXdCQkVBanpBRkJBV29pQVVIL0FVb0VRRUVCSk0wQlFRQWhBUXNnQVNUTUFRc0xEQUVMQ3dzTkFDUEtBUkNOQVVFQUpNb0JDMFlCQVg4anl3RWhBRUVBSk1zQlFZVCtBMEVBRUI4ajBBRUVmeUFBUVFBUWpBRUZRUUFMQkVBanpBRkJBV29pQUVIL0FVb0VRRUVCSk0wQlFRQWhBQXNnQUNUTUFRc0xmd0VEZnlQUUFTRUJJQUJCQkhGQkFFY2swQUVnQUVFRGNTRUNJQUZGQkVBajBRRVFpd0VoQVNBQ0VJc0JJUU1qeXdFaEFDUFFBUVIvUVFFZ0FYUWdBSEVGUVFFZ0EzUWdBSEZCQUVkQkFFRUJJQUYwSUFCeEd3c0VRQ1BNQVVFQmFpSUFRZjhCU2dSQVFRRWt6UUZCQUNFQUN5QUFKTXdCQ3dzZ0FpVFJBUXZDQmdFQmZ3SkFBa0FnQUVITi9nTkdCRUJCemY0RElBRkJBWEVRSHd3QkN5QUFRZEQrQTBaQkFDT01BaHNFUUVFQUpJd0NRZjhCSkpnQ0RBSUxJQUJCZ0lBQ1NBUkFJQUFnQVJCM0RBRUxJQUJCZ01BQ1NFRUFJQUJCZ0lBQ1Roc05BU0FBUVlEOEEwaEJBQ0FBUVlEQUEwNGJCRUFnQUVHQVFHb2dBUkFmREFJTElBQkJuLzBEVEVFQUlBQkJnUHdEVGhzRVFDUG1BVUVDVGc4TElBQkIvLzBEVEVFQUlBQkJvUDBEVGhzTkFDQUFRWUwrQTBZRVFDQUJRUUZ4UVFCSEpOUUJJQUZCQW5GQkFFY2sxUUVnQVVHQUFYRkJBRWNrMWdGQkFROExJQUJCcHY0RFRFRUFJQUJCa1A0RFRoc0VRQkJ5SUFBZ0FSQ0ZBUThMSUFCQnYvNERURUVBSUFCQnNQNERUaHNFUUJCeUk0SUJCRUFqaHdGQkFYVkJzUDREYWlBQkVCOE1BZ3NNQWdzZ0FFSEwvZ05NUVFBZ0FFSEEvZ05PR3dSQUlBQkJ3UDREUmdSQUlBRVFQd3dEQ3lBQVFjSCtBMFlFUUVIQi9nTWdBVUg0QVhGQndmNERFQjFCQjNGeVFZQUJjaEFmREFJTElBQkJ4UDREUmdSQVFRQWs4Z0VnQUVFQUVCOE1BZ3NnQUVIRi9nTkdCRUFnQVNUbkFRd0RDeUFBUWNiK0EwWUVRQ0FCRUlZQkRBTUxBa0FDUUFKQUFrQWdBRUhEL2dOSEJFQWdBRUhDL2dOckRnb0JCQVFFQkFRRUJBTUNCQXNnQVNUekFRd0dDeUFCSlBRQkRBVUxJQUVrOVFFTUJBc2dBU1QyQVF3REN3d0NDeU9FQWlBQVJnUkFJQUVRaVFFTUFRdEJBU09LQWlBQVJpT0xBaUFBUmhzRVFDT0dBZ1JBSTRnQ0lnSkJnSUFCVGdSL0lBSkIvLzhCVEFWQkFBc0VmMEVCQlNBQ1FmKy9BMHhCQUNBQ1FZQ2dBMDRiQ3cwQ0N3c2dBQ05MVEVFQUlBQWpTVTRiQkVBZ0FDQUJFSW9CREFJTElBQkJoLzREVEVFQUlBQkJoUDREVGhzRVFCQ09BUUpBQWtBQ1FBSkFJQUJCaFA0RFJ3UkFJQUJCaGY0RGF3NERBUUlEQkFzUWp3RU1CUXNDUUNQUUFRUkFJODRCRFFFanpRRUVRRUVBSk0wQkN3c2dBU1RNQVFzTUJRc2dBU1RQQVNQT0FVRUFJOUFCR3dSQUlBRWt6QUZCQUNUT0FRc01CQXNnQVJDUUFRd0RDd3dDQ3lBQVFZRCtBMFlFUUNBQlFmOEJjeVRmQVNQZkFTSUNRUkJ4UVFCSEpPQUJJQUpCSUhGQkFFY2s0UUVMSUFCQmovNERSZ1JBSUFFUUx3d0NDeUFBUWYvL0EwWUVRQ0FCRUM0TUFndEJBUThMUVFBUEMwRUJDeUFBSStRQklBQkdCRUJCQVNUbEFRc2dBQ0FCRUpFQkJFQWdBQ0FCRUI4TEMxd0JBMzhEUUFKQUlBTWdBazROQUNBQUlBTnFFSFloQlNBQklBTnFJUVFEUUNBRVFmKy9Ba3hGQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUpJQklBTkJBV29oQXd3QkN3c2poUUpCSUNPT0FuUWdBa0VFZFd4cUpJVUNDM01CQW44amhnSkZCRUFQQzBFUUlRQWppQUlqaVFJQ2Z5T0hBaUlCUVJCSUJFQWdBU0VBQ3lBQUN4Q1RBU09JQWlBQWFpU0lBaU9KQWlBQWFpU0pBaUFCSUFCcklnQWtod0lqaEFJaEFTQUFRUUJNQkVCQkFDU0dBaUFCUWY4QkVCOEZJQUVnQUVFRWRVRUJhMEgvZm5FUUh3c0xNd0FqOGdFajV3RkdRUUFnQUVFQlJrRUJJQUFiR3dSQUlBRkJCSElpQVVIQUFIRUVRQkJiQ3dVZ0FVRjdjU0VCQ3lBQkM0RUNBUVYvSStnQlJRUkFEd3NqNWdFaEFDQUFJL0lCSWdKQmtBRk9CSDlCQVFWQitBSWpqZ0owSWdFaEF5UHhBU0lFSUFGT0JIOUJBZ1ZCQTBFQUlBUWdBMDRiQ3dzaUFVY0VRRUhCL2dNUUhTRUFJQUVrNWdGQkFDRUNBa0FDUUFKQUFrQWdBUVJBSUFGQkFXc09Bd0VDQXdRTElBQkJmSEVpQUVFSWNVRUFSeUVDREFNTElBQkJmWEZCQVhJaUFFRVFjVUVBUnlFQ0RBSUxJQUJCZm5GQkFuSWlBRUVnY1VFQVJ5RUNEQUVMSUFCQkEzSWhBQXNnQWdSQUVGc0xJQUZGQkVBUWxBRUxJQUZCQVVZRVFFRUJKTVVCUVFBUVdndEJ3ZjRESUFFZ0FCQ1ZBUkFmQlNBQ1Faa0JSZ1JBUWNIK0F5QUJRY0grQXhBZEVKVUJFQjhMQ3d1Z0FRRUJmeVBvQVFSQUkvRUJJQUJxSlBFQkl6Z2hBUU5BSS9FQlFRUWpqZ0lpQUhSQnlBTWdBSFFqOGdGQm1RRkdHMDRFUUNQeEFVRUVJNDRDSWdCMFFjZ0RJQUIwSS9JQlFaa0JSaHRySlBFQkkvSUJJZ0JCa0FGR0JFQWdBUVJBRUZnRklBQVFWd3NRV1VGL0pFeEJmeVJOQlNBQVFaQUJTQVJBSUFGRkJFQWdBQkJYQ3dzTFFRQWdBRUVCYWlBQVFaa0JTaHNrOGdFTUFRc0xDeENXQVFzNEFRRi9RUVFqamdJaUFIUkJ5QU1nQUhRajhnRkJtUUZHR3lFQUEwQWo4QUVnQUU0RVFDQUFFSmNCSS9BQklBQnJKUEFCREFFTEN3dXlBUUVEZnlQV0FVVUVRQThMQTBBZ0F5QUFTQVJBSUFOQkJHb2hBd0ovSTlJQklnSkJCR29pQVVILy93TktCRUFnQVVHQWdBUnJJUUVMSUFFTEpOSUJJQUpCQVVFQ1FRY2oxUUViSWdKMGNRUi9RUUVnQW5RZ0FYRkZCVUVBQ3dSQVFZSCtBMEdCL2dNUUhVRUJkRUVCYWtIL0FYRVFIeVBUQVVFQmFpSUJRUWhHQkVCQkFDVFRBVUVCSk1nQlFRTVFXa0dDL2dOQmd2NERFQjFCLzM1eEVCOUJBQ1RXQVFVZ0FTVFRBUXNMREFFTEN3dVZBUUFqaFFKQkFFb0VRQ09GQWlBQWFpRUFRUUFraFFJTEk1a0NJQUJxSkprQ0k1MENSUVJBSXpZRVFDUHdBU0FBYWlUd0FSQ1lBUVVnQUJDWEFRc2pOUVJBSTZvQklBQnFKS29CRUhJRklBQVFjUXNnQUJDWkFRc2pOd1JBSThvQklBQnFKTW9CRUk0QkJTQUFFSTBCQ3lPZ0FpQUFhaUlBSTU0Q1RnUkFJNThDUVFGcUpKOENJQUFqbmdKcklRQUxJQUFrb0FJTERBQkJCQkNhQVNPWUFoQWRDeWtCQVg5QkJCQ2FBU09ZQWtFQmFrSC8vd054RUIwaEFCQ2JBVUgvQVhFZ0FFSC9BWEZCQ0hSeUN3NEFRUVFRbWdFZ0FDQUJFSklCQ3pBQVFRRWdBSFJCL3dGeElRQWdBVUVBU2dSQUk1WUNJQUJ5UWY4QmNTU1dBZ1VqbGdJZ0FFSC9BWE54SkpZQ0N3c0pBRUVGSUFBUW5nRUxPZ0VCZnlBQlFRQk9CRUFnQUVFUGNTQUJRUTl4YWtFUWNVRUFSeENmQVFVZ0FVRWZkU0lDSUFFZ0FtcHpRUTl4SUFCQkQzRkxFSjhCQ3dzSkFFRUhJQUFRbmdFTENRQkJCaUFBRUo0QkN3a0FRUVFnQUJDZUFRcy9BUUovSUFGQmdQNERjVUVJZFNFQ0lBRkIvd0Z4SWdFaEF5QUFJQUVRa1FFRVFDQUFJQU1RSHdzZ0FFRUJhaUlBSUFJUWtRRUVRQ0FBSUFJUUh3c0xEZ0JCQ0JDYUFTQUFJQUVRcEFFTFdnQWdBZ1JBSUFCQi8vOERjU0lBSUFGcUlBQWdBWE56SWdCQkVIRkJBRWNRbndFZ0FFR0FBbkZCQUVjUW93RUZJQUFnQVdwQi8vOERjU0lDSUFCQi8vOERjVWtRb3dFZ0FDQUJjeUFDYzBHQUlIRkJBRWNRbndFTEN3c0FRUVFRbWdFZ0FCQjJDNmtGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQlJnMEJBa0FnQUVFQ2F3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDd3dWQ3hDY0FVSC8vd054SWdCQmdQNERjVUVJZFNTUUFpQUFRZjhCY1NTUkFnd1BDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBjaU9QQWhDZEFRd1RDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NRQWd3VEN5T1FBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NRQWd3TkN5T1FBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NRQWd3TkN4Q2JBVUgvQVhFa2tBSU1EUXNqandJaUFFR0FBWEZCZ0FGR0VLTUJJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU1NQQWd3TkN4Q2NBVUgvL3dOeEk1Y0NFS1VCREFnTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUlnQWprUUpCL3dGeEk1QUNRZjhCY1VFSWRISWlBVUVBRUtZQklBQWdBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtsQUlnQUVIL0FYRWtsUUpCQUJDaUFVRUlEd3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRcHdGQi93RnhKSThDREFzTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpKQUNEQXNMSTVFQ0lnQkJBUkNnQVNBQVFRRnFRZjhCY1NJQUpKRUNEQVVMSTVFQ0lnQkJmeENnQVNBQVFRRnJRZjhCY1NJQUpKRUNEQVVMRUpzQlFmOEJjU1NSQWd3RkN5T1BBaUlBUVFGeFFRQkxFS01CSUFCQkIzUWdBRUgvQVhGQkFYWnlRZjhCY1NTUEFnd0ZDMEYvRHdzam1BSkJBbXBCLy84RGNTU1lBZ3dFQ3lBQVJSQ2hBVUVBRUtJQkRBTUxJQUJGRUtFQlFRRVFvZ0VNQWdzam1BSkJBV3BCLy84RGNTU1lBZ3dCQzBFQUVLRUJRUUFRb2dGQkFCQ2ZBUXRCQkE4TElBQkIvd0Z4SkpFQ1FRZ0xtUVlCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFDQUFRUkZHRFFFQ1FDQUFRUkpyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEk0MENCRUJCemY0REVLY0JRZjhCY1NJQVFRRnhCRUJCemY0RElBQkJmbkVpQUVHQUFYRUVmMEVBSkk0Q0lBQkIvMzV4QlVFQkpJNENJQUJCZ0FGeUN4Q2RBVUhFQUE4TEMwRUJKSjBDREJBTEVKd0JRZi8vQTNFaUFFR0EvZ054UVFoMUpKSUNJQUJCL3dGeEpKTUNJNWdDUVFKcVFmLy9BM0VrbUFJTUVRc2prd0pCL3dGeEk1SUNRZjhCY1VFSWRISWpqd0lRblFFTUVBc2prd0pCL3dGeEk1SUNRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtrZ0lNRUFzamtnSWlBRUVCRUtBQklBQkJBV3BCL3dGeEpKSUNJNUlDUlJDaEFVRUFFS0lCREE0TEk1SUNJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTU1NBaU9TQWtVUW9RRkJBUkNpQVF3TkN4Q2JBVUgvQVhFa2tnSU1DZ3NqandJaUFVR0FBWEZCZ0FGR0lRQWpsZ0pCQkhaQkFYRWdBVUVCZEhKQi93RnhKSThDREFvTEVKc0JJUUFqbUFJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSmdDUVFnUEN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpSUFJNU1DUWY4QmNTT1NBa0gvQVhGQkNIUnlJZ0ZCQUJDbUFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSlFDSUFCQi93RnhKSlVDUVFBUW9nRkJDQThMSTVNQ1FmOEJjU09TQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NQQWd3SUN5T1RBa0gvQVhFamtnSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU1NBZ3dJQ3lPVEFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU1RBaUFBUlJDaEFVRUFFS0lCREFZTEk1TUNJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTSUFKSk1DSUFCRkVLRUJRUUVRb2dFTUJRc1Ftd0ZCL3dGeEpKTUNEQUlMSTQ4Q0lnRkJBWEZCQVVZaEFDT1dBa0VFZGtFQmNVRUhkQ0FCUWY4QmNVRUJkbklrandJTUFndEJmdzhMSTVnQ1FRRnFRZi8vQTNFa21BSU1BUXNnQUJDakFVRUFFS0VCUVFBUW9nRkJBQkNmQVF0QkJBOExJQUJCL3dGeEpKTUNRUWdMOVFZQkFuOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRU0JIQkVBZ0FFRWhSZzBCQWtBZ0FFRWlhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPV0FrRUhka0VCY1FSQUk1Z0NRUUZxUWYvL0EzRWttQUlGRUpzQklRQWptQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpKZ0NDMEVJRHdzUW5BRkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2xBSWdBRUgvQVhFa2xRSWptQUpCQW1wQi8vOERjU1NZQWd3VUN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpSUFJNDhDRUowQkRBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSlFDREEwTEk1UUNJZ0JCQVJDZ0FTQUFRUUZxUWY4QmNTSUFKSlFDREE0TEk1UUNJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTSUFKSlFDREE0TEVKc0JRZjhCY1NTVUFnd09DMEVHUVFBamxnSWlBa0VGZGtFQmNVRUFTeHNpQUVIZ0FISWdBQ0FDUVFSMlFRRnhRUUJMR3lFQUk0OENJUUVnQWtFR2RrRUJjVUVBU3dSL0lBRWdBR3RCL3dGeEJTQUJJQUJCQm5JZ0FDQUJRUTl4UVFsTEd5SUFRZUFBY2lBQUlBRkJtUUZMR3lJQWFrSC9BWEVMSWdGRkVLRUJJQUJCNEFCeFFRQkhFS01CUVFBUW53RWdBU1NQQWd3T0N5T1dBa0VIZGtFQmNVRUFTd1JBRUpzQklRQWptQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpKZ0NCU09ZQWtFQmFrSC8vd054SkpnQ0MwRUlEd3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElpQUNBQVFmLy9BM0ZCQUJDbUFTQUFRUUYwUWYvL0EzRWlBRUdBL2dOeFFRaDFKSlFDSUFCQi93RnhKSlVDUVFBUW9nRkJDQThMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5SWdBUXB3RkIvd0Z4Skk4Q0RBY0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDFKSlFDREFVTEk1VUNJZ0JCQVJDZ0FTQUFRUUZxUWY4QmNTSUFKSlVDREFZTEk1VUNJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTSUFKSlVDREFZTEVKc0JRZjhCY1NTVkFnd0dDeU9QQWtGL2MwSC9BWEVrandKQkFSQ2lBVUVCRUo4QkRBWUxRWDhQQ3lBQVFmOEJjU1NWQWtFSUR3c2dBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NVQWlBQVFmOEJjU1NWQWd3REN5QUFSUkNoQVVFQUVLSUJEQUlMSUFCRkVLRUJRUUVRb2dFTUFRc2ptQUpCQVdwQi8vOERjU1NZQWd0QkJBdnhCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJNRWNFUUNBQVFURkdEUUVDUUNBQVFUSnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSTVZQ1FRUjJRUUZ4QkVBam1BSkJBV3BCLy84RGNTU1lBZ1VRbXdFaEFDT1lBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa21BSUxRUWdQQ3hDY0FVSC8vd054SkpjQ0k1Z0NRUUpxUWYvL0EzRWttQUlNRVFzamxRSkIvd0Z4STVRQ1FmOEJjVUVJZEhJaUFDT1BBaENkQVF3T0N5T1hBa0VCYWtILy93TnhKSmNDUVFnUEN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpSUFFS2NCSWdGQkFSQ2dBU0FCUVFGcVFmOEJjU0lCUlJDaEFVRUFFS0lCSUFBZ0FSQ2RBUXdPQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2lJQUVLY0JJZ0ZCZnhDZ0FTQUJRUUZyUWY4QmNTSUJSUkNoQVVFQkVLSUJJQUFnQVJDZEFRd05DeU9WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaENiQVVIL0FYRVFuUUVNQ3d0QkFCQ2lBVUVBRUo4QlFRRVFvd0VNQ3dzamxnSkJCSFpCQVhGQkFVWUVRQkNiQVNFQUk1Z0NJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTWUFnVWptQUpCQVdwQi8vOERjU1NZQWd0QkNBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlJZ0FqbHdKQkFCQ21BU09YQWlBQWFrSC8vd054SWdCQmdQNERjVUVJZFNTVUFpQUFRZjhCY1NTVkFrRUFFS0lCUVFnUEN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpSUFFS2NCUWY4QmNTU1BBZ3dHQ3lPWEFrRUJhMEgvL3dOeEpKY0NRUWdQQ3lPUEFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU1BBaUFBUlJDaEFVRUFFS0lCREFZTEk0OENJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTSUFKSThDSUFCRkVLRUJRUUVRb2dFTUJRc1Ftd0ZCL3dGeEpJOENEQU1MUVFBUW9nRkJBQkNmQVNPV0FrRUVka0VCY1VFQVRSQ2pBUXdEQzBGL0R3c2dBRUVCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NVQWlBQVFmOEJjU1NWQWd3QkN5T1lBa0VCYWtILy93TnhKSmdDQzBFRUM0SUNBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUJIQkVBZ0FFSEJBRVlOQVFKQUlBQkJ3Z0JyRGc0REJBVUdCd2dKRVFvTERBME9Ed0FMREE4TERBOExJNUVDSkpBQ0RBNExJNUlDSkpBQ0RBMExJNU1DSkpBQ0RBd0xJNVFDSkpBQ0RBc0xJNVVDSkpBQ0RBb0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCUWY4QmNTU1FBZ3dKQ3lPUEFpU1FBZ3dJQ3lPUUFpU1JBZ3dIQ3lPU0FpU1JBZ3dHQ3lPVEFpU1JBZ3dGQ3lPVUFpU1JBZ3dFQ3lPVkFpU1JBZ3dEQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2hDbkFVSC9BWEVra1FJTUFnc2pqd0lra1FJTUFRdEJmdzhMUVFRTC9RRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBQkhCRUFnQUVIUkFFWU5BUUpBSUFCQjBnQnJEZzRRQXdRRkJnY0lDUW9RQ3d3TkRnQUxEQTRMSTVBQ0pKSUNEQTRMSTVFQ0pKSUNEQTBMSTVNQ0pKSUNEQXdMSTVRQ0pKSUNEQXNMSTVVQ0pKSUNEQW9MSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NTQWd3SkN5T1BBaVNTQWd3SUN5T1FBaVNUQWd3SEN5T1JBaVNUQWd3R0N5T1NBaVNUQWd3RkN5T1VBaVNUQWd3RUN5T1ZBaVNUQWd3REN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2t3SU1BZ3NqandJa2t3SU1BUXRCZnc4TFFRUUwvUUVBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUJIQkVBZ0FFSGhBRVlOQVFKQUlBQkI0Z0JyRGc0REJCQUZCZ2NJQ1FvTERCQU5EZ0FMREE0TEk1QUNKSlFDREE0TEk1RUNKSlFDREEwTEk1SUNKSlFDREF3TEk1TUNKSlFDREFzTEk1VUNKSlFDREFvTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUVLY0JRZjhCY1NTVUFnd0pDeU9QQWlTVUFnd0lDeU9RQWlTVkFnd0hDeU9SQWlTVkFnd0dDeU9TQWlTVkFnd0ZDeU9UQWlTVkFnd0VDeU9VQWlTVkFnd0RDeU9WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtsUUlNQWdzamp3SWtsUUlNQVF0QmZ3OExRUVFMbXdNQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FFY0VRQ0FBUWZFQVJnMEJBa0FnQUVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UkFBc01Ed3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqa0FJUW5RRU1Ed3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqa1FJUW5RRU1EZ3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqa2dJUW5RRU1EUXNqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqa3dJUW5RRU1EQXNqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqbEFJUW5RRU1Dd3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqbFFJUW5RRU1DZ3NqaGdKRkJFQUNRQ084QVFSQVFRRWttZ0lNQVFzanZnRWp4QUZ4UVI5eFJRUkFRUUVrbXdJTUFRdEJBU1NjQWdzTERBa0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlJNDhDRUowQkRBZ0xJNUFDSkk4Q0RBY0xJNUVDSkk4Q0RBWUxJNUlDSkk4Q0RBVUxJNU1DSkk4Q0RBUUxJNVFDSkk4Q0RBTUxJNVVDSkk4Q0RBSUxJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCUWY4QmNTU1BBZ3dCQzBGL0R3dEJCQXMzQVFGL0lBRkJBRTRFUUNBQVFmOEJjU0FBSUFGcVFmOEJjVXNRb3dFRklBRkJIM1VpQWlBQklBSnFjeUFBUWY4QmNVb1Fvd0VMQ3pRQkFuOGpqd0lpQVNBQVFmOEJjU0lDRUtBQklBRWdBaEN3QVNBQUlBRnFRZjhCY1NJQUpJOENJQUJGRUtFQlFRQVFvZ0VMV0FFQ2Z5T1BBaUlCSUFCcUk1WUNRUVIyUVFGeGFrSC9BWEVpQWlBQUlBRnpjMEVRY1VFQVJ4Q2ZBU0FBUWY4QmNTQUJhaU9XQWtFRWRrRUJjV3BCZ0FKeFFRQkxFS01CSUFJa2p3SWdBa1VRb1FGQkFCQ2lBUXVMQWdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmdBRkhCRUFnQUVHQkFVWU5BUUpBSUFCQmdnRnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSTVBQ0VMRUJEQkFMSTVFQ0VMRUJEQThMSTVJQ0VMRUJEQTRMSTVNQ0VMRUJEQTBMSTVRQ0VMRUJEQXdMSTVVQ0VMRUJEQXNMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMRUJEQW9MSTQ4Q0VMRUJEQWtMSTVBQ0VMSUJEQWdMSTVFQ0VMSUJEQWNMSTVJQ0VMSUJEQVlMSTVNQ0VMSUJEQVVMSTVRQ0VMSUJEQVFMSTVVQ0VMSUJEQU1MSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMSUJEQUlMSTQ4Q0VMSUJEQUVMUVg4UEMwRUVDemNCQW44amp3SWlBU0FBUWY4QmNVRi9iQ0lDRUtBQklBRWdBaEN3QVNBQklBQnJRZjhCY1NJQUpJOENJQUJGRUtFQlFRRVFvZ0VMV0FFQ2Z5T1BBaUlCSUFCckk1WUNRUVIyUVFGeGEwSC9BWEVpQWlBQUlBRnpjMEVRY1VFQVJ4Q2ZBU0FCSUFCQi93RnhheU9XQWtFRWRrRUJjV3RCZ0FKeFFRQkxFS01CSUFJa2p3SWdBa1VRb1FGQkFSQ2lBUXVMQWdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtBRkhCRUFnQUVHUkFVWU5BUUpBSUFCQmtnRnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSTVBQ0VMUUJEQkFMSTVFQ0VMUUJEQThMSTVJQ0VMUUJEQTRMSTVNQ0VMUUJEQTBMSTVRQ0VMUUJEQXdMSTVVQ0VMUUJEQXNMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMUUJEQW9MSTQ4Q0VMUUJEQWtMSTVBQ0VMVUJEQWdMSTVFQ0VMVUJEQWNMSTVJQ0VMVUJEQVlMSTVNQ0VMVUJEQVVMSTVRQ0VMVUJEQVFMSTVVQ0VMVUJEQU1MSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMVUJEQUlMSTQ4Q0VMVUJEQUVMUVg4UEMwRUVDeUlBSTQ4Q0lBQnhJZ0FrandJZ0FFVVFvUUZCQUJDaUFVRUJFSjhCUVFBUW93RUxKZ0FqandJZ0FITkIvd0Z4SWdBa2p3SWdBRVVRb1FGQkFCQ2lBVUVBRUo4QlFRQVFvd0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFhQUJSd1JBSUFCQm9RRkdEUUVDUUNBQVFhSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPUUFoQzNBUXdRQ3lPUkFoQzNBUXdQQ3lPU0FoQzNBUXdPQ3lPVEFoQzNBUXdOQ3lPVUFoQzNBUXdNQ3lPVkFoQzNBUXdMQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2hDbkFSQzNBUXdLQ3lPUEFoQzNBUXdKQ3lPUUFoQzRBUXdJQ3lPUkFoQzRBUXdIQ3lPU0FoQzRBUXdHQ3lPVEFoQzRBUXdGQ3lPVUFoQzRBUXdFQ3lPVkFoQzRBUXdEQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2hDbkFSQzRBUXdDQ3lPUEFoQzRBUXdCQzBGL0R3dEJCQXNtQUNPUEFpQUFja0gvQVhFaUFDU1BBaUFBUlJDaEFVRUFFS0lCUVFBUW53RkJBQkNqQVFzc0FRRi9JNDhDSWdFZ0FFSC9BWEZCZjJ3aUFCQ2dBU0FCSUFBUXNBRWdBQ0FCYWtVUW9RRkJBUkNpQVF1TEFnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJzQUZIQkVBZ0FFR3hBVVlOQVFKQUlBQkJzZ0ZyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEk1QUNFTG9CREJBTEk1RUNFTG9CREE4TEk1SUNFTG9CREE0TEk1TUNFTG9CREEwTEk1UUNFTG9CREF3TEk1VUNFTG9CREFzTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUVLY0JFTG9CREFvTEk0OENFTG9CREFrTEk1QUNFTHNCREFnTEk1RUNFTHNCREFjTEk1SUNFTHNCREFZTEk1TUNFTHNCREFVTEk1UUNFTHNCREFRTEk1VUNFTHNCREFNTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUVLY0JFTHNCREFJTEk0OENFTHNCREFFTFFYOFBDMEVFQ3pzQkFYOGdBQkIxSWdGQmYwWUVmeUFBRUIwRklBRUxRZjhCY1NBQVFRRnFJZ0VRZFNJQVFYOUdCSDhnQVJBZEJTQUFDMEgvQVhGQkNIUnlDd3dBUVFnUW1nRWdBQkM5QVFzMEFDQUFRWUFCY1VHQUFVWVFvd0VnQUVFQmRDQUFRZjhCY1VFSGRuSkIvd0Z4SWdCRkVLRUJRUUFRb2dGQkFCQ2ZBU0FBQ3pJQUlBQkJBWEZCQUVzUW93RWdBRUVIZENBQVFmOEJjVUVCZG5KQi93RnhJZ0JGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFDemdCQVg4amxnSkJCSFpCQVhFZ0FFRUJkSEpCL3dGeElRRWdBRUdBQVhGQmdBRkdFS01CSUFGRkVLRUJRUUFRb2dGQkFCQ2ZBU0FCQ3prQkFYOGpsZ0pCQkhaQkFYRkJCM1FnQUVIL0FYRkJBWFp5SVFFZ0FFRUJjVUVCUmhDakFTQUJSUkNoQVVFQUVLSUJRUUFRbndFZ0FRc3FBQ0FBUVlBQmNVR0FBVVlRb3dFZ0FFRUJkRUgvQVhFaUFFVVFvUUZCQUJDaUFVRUFFSjhCSUFBTFBRRUJmeUFBUWY4QmNVRUJkaUlCUVlBQmNpQUJJQUJCZ0FGeFFZQUJSaHNpQVVVUW9RRkJBQkNpQVVFQUVKOEJJQUJCQVhGQkFVWVFvd0VnQVFzckFDQUFRUTl4UVFSMElBQkI4QUZ4UVFSMmNpSUFSUkNoQVVFQUVLSUJRUUFRbndGQkFCQ2pBU0FBQ3lvQkFYOGdBRUgvQVhGQkFYWWlBVVVRb1FGQkFCQ2lBVUVBRUo4QklBQkJBWEZCQVVZUW93RWdBUXNlQUVFQklBQjBJQUZ4UWY4QmNVVVFvUUZCQUJDaUFVRUJFSjhCSUFFTHlBZ0JCWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQjNFaUJBUkFJQVJCQVVZTkFRSkFJQVJCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJNUFDSVFFTUJ3c2prUUloQVF3R0N5T1NBaUVCREFVTEk1TUNJUUVNQkFzamxBSWhBUXdEQ3lPVkFpRUJEQUlMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQklRRU1BUXNqandJaEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRkJFQWdCVUVCUmcwQkFrQWdCVUVDYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5QUFRUWRNQkg4Z0FSQy9BU0VDUVFFRklBQkJEMHdFZnlBQkVNQUJJUUpCQVFWQkFBc0xJUU1NRHdzZ0FFRVhUQVIvSUFFUXdRRWhBa0VCQlNBQVFSOU1CSDhnQVJEQ0FTRUNRUUVGUVFBTEN5RUREQTRMSUFCQkowd0VmeUFCRU1NQklRSkJBUVVnQUVFdlRBUi9JQUVReEFFaEFrRUJCVUVBQ3dzaEF3d05DeUFBUVRkTUJIOGdBUkRGQVNFQ1FRRUZJQUJCUDB3RWZ5QUJFTVlCSVFKQkFRVkJBQXNMSVFNTURBc2dBRUhIQUV3RWYwRUFJQUVReHdFaEFrRUJCU0FBUWM4QVRBUi9RUUVnQVJESEFTRUNRUUVGUVFBTEN5RUREQXNMSUFCQjF3Qk1CSDlCQWlBQkVNY0JJUUpCQVFVZ0FFSGZBRXdFZjBFRElBRVF4d0VoQWtFQkJVRUFDd3NoQXd3S0N5QUFRZWNBVEFSL1FRUWdBUkRIQVNFQ1FRRUZJQUJCN3dCTUJIOUJCU0FCRU1jQklRSkJBUVZCQUFzTElRTU1DUXNnQUVIM0FFd0VmMEVHSUFFUXh3RWhBa0VCQlNBQVFmOEFUQVIvUVFjZ0FSREhBU0VDUVFFRlFRQUxDeUVEREFnTElBQkJod0ZNQkg4Z0FVRitjU0VDUVFFRklBQkJqd0ZNQkg4Z0FVRjljU0VDUVFFRlFRQUxDeUVEREFjTElBQkJsd0ZNQkg4Z0FVRjdjU0VDUVFFRklBQkJud0ZNQkg4Z0FVRjNjU0VDUVFFRlFRQUxDeUVEREFZTElBQkJwd0ZNQkg4Z0FVRnZjU0VDUVFFRklBQkJyd0ZNQkg4Z0FVRmZjU0VDUVFFRlFRQUxDeUVEREFVTElBQkJ0d0ZNQkg4Z0FVRy9mM0VoQWtFQkJTQUFRYjhCVEFSL0lBRkIvMzV4SVFKQkFRVkJBQXNMSVFNTUJBc2dBRUhIQVV3RWZ5QUJRUUZ5SVFKQkFRVWdBRUhQQVV3RWZ5QUJRUUp5SVFKQkFRVkJBQXNMSVFNTUF3c2dBRUhYQVV3RWZ5QUJRUVJ5SVFKQkFRVWdBRUhmQVV3RWZ5QUJRUWh5SVFKQkFRVkJBQXNMSVFNTUFnc2dBRUhuQVV3RWZ5QUJRUkJ5SVFKQkFRVWdBRUh2QVV3RWZ5QUJRU0J5SVFKQkFRVkJBQXNMSVFNTUFRc2dBRUgzQVV3RWZ5QUJRY0FBY2lFQ1FRRUZJQUJCL3dGTUJIOGdBVUdBQVhJaEFrRUJCVUVBQ3dzaEF3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBUUVRQ0FFUVFGR0RRRUNRQ0FFUVFKckRnWURCQVVHQndnQUN3d0lDeUFDSkpBQ0RBY0xJQUlra1FJTUJnc2dBaVNTQWd3RkN5QUNKSk1DREFRTElBSWtsQUlNQXdzZ0FpU1ZBZ3dDQzBFQklBVkJCMG9nQlVFRVNCc0VRQ09WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaUFDRUowQkN3d0JDeUFDSkk4Q0MwRUVRWDhnQXhzTHV3UUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUJSd1JBSUFCQndRRkdEUUVDUUNBQVFjSUJhdzRPQXhJRUJRWUhDQWtLQ3d3UkRRNEFDd3dPQ3lPV0FrRUhka0VCY1EwUkRBNExJNWNDRUw0QlFmLy9BM0VoQUNPWEFrRUNha0gvL3dOeEpKY0NJQUJCZ1A0RGNVRUlkU1NRQWlBQVFmOEJjU1NSQWtFRUR3c2psZ0pCQjNaQkFYRU5FUXdPQ3lPV0FrRUhka0VCY1EwUURBd0xJNWNDUVFKclFmLy9BM0VpQUNTWEFpQUFJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFS1VCREEwTEVKc0JFTEVCREEwTEk1Y0NRUUpyUWYvL0EzRWlBQ1NYQWlBQUk1Z0NFS1VCUVFBa21BSU1Dd3NqbGdKQkIzWkJBWEZCQVVjTkNnd0hDeU9YQWlJQUVMNEJRZi8vQTNFa21BSWdBRUVDYWtILy93TnhKSmNDREFrTEk1WUNRUWQyUVFGeFFRRkdEUWNNQ2dzUW13RkIvd0Z4RU1nQklRQWptQUpCQVdwQi8vOERjU1NZQWlBQUR3c2psZ0pCQjNaQkFYRkJBVWNOQ0NPWEFrRUNhMEgvL3dOeElnQWtsd0lnQUNPWUFrRUNha0gvL3dOeEVLVUJEQVVMRUpzQkVMSUJEQVlMSTVjQ1FRSnJRZi8vQTNFaUFDU1hBaUFBSTVnQ0VLVUJRUWdrbUFJTUJBdEJmdzhMSTVjQ0lnQVF2Z0ZCLy84RGNTU1lBaUFBUVFKcVFmLy9BM0VrbHdKQkRBOExJNWNDUVFKclFmLy9BM0VpQUNTWEFpQUFJNWdDUVFKcVFmLy9BM0VRcFFFTEVKd0JRZi8vQTNFa21BSUxRUWdQQ3lPWUFrRUJha0gvL3dOeEpKZ0NRUVFQQ3lPWUFrRUNha0gvL3dOeEpKZ0NRUXdMb0FRQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQVVjRVFDQUFRZEVCUmcwQkFrQWdBRUhTQVdzT0RnTUFCQVVHQndnSkNnQUxBQXdOQUFzTURRc2psZ0pCQkhaQkFYRU5Ed3dOQ3lPWEFpSUJFTDRCUWYvL0EzRWhBQ0FCUVFKcVFmLy9BM0VrbHdJZ0FFR0EvZ054UVFoMUpKSUNJQUJCL3dGeEpKTUNRUVFQQ3lPV0FrRUVka0VCY1EwUERBd0xJNVlDUVFSMlFRRnhEUTRqbHdKQkFtdEIvLzhEY1NJQUpKY0NJQUFqbUFKQkFtcEIvLzhEY1JDbEFRd0xDeU9YQWtFQ2EwSC8vd054SWdBa2x3SWdBQ09UQWtIL0FYRWprZ0pCL3dGeFFRaDBjaENsQVF3TEN4Q2JBUkMwQVF3TEN5T1hBa0VDYTBILy93TnhJZ0FrbHdJZ0FDT1lBaENsQVVFUUpKZ0NEQWtMSTVZQ1FRUjJRUUZ4UVFGSERRZ01CZ3NqbHdJaUFCQytBVUgvL3dOeEpKZ0NRUUVrdlFFZ0FFRUNha0gvL3dOeEpKY0NEQWNMSTVZQ1FRUjJRUUZ4UVFGR0RRVU1DQXNqbGdKQkJIWkJBWEZCQVVjTkJ5T1hBa0VDYTBILy93TnhJZ0FrbHdJZ0FDT1lBa0VDYWtILy93TnhFS1VCREFRTEVKc0JFTFVCREFVTEk1Y0NRUUpyUWYvL0EzRWlBQ1NYQWlBQUk1Z0NFS1VCUVJna21BSU1Bd3RCZnc4TEk1Y0NJZ0FRdmdGQi8vOERjU1NZQWlBQVFRSnFRZi8vQTNFa2x3SkJEQThMRUp3QlFmLy9BM0VrbUFJTFFRZ1BDeU9ZQWtFQmFrSC8vd054SkpnQ1FRUVBDeU9ZQWtFQ2FrSC8vd054SkpnQ1FRd0xzUU1CQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIZ0FVY0VRQ0FBUWVFQlJnMEJBa0FnQUVIaUFXc09EZ01BQUFRRkJnY0lDUUFBQUFvTEFBc01Dd3NRbXdGQi93RnhRWUQrQTJvamp3SVFuUUVNQ3dzamx3SWlBUkMrQVVILy93TnhJUUFnQVVFQ2FrSC8vd054SkpjQ0lBQkJnUDREY1VFSWRTU1VBaUFBUWY4QmNTU1ZBa0VFRHdzamtRSkJnUDREYWlPUEFoQ2RBVUVFRHdzamx3SkJBbXRCLy84RGNTSUFKSmNDSUFBamxRSkIvd0Z4STVRQ1FmOEJjVUVJZEhJUXBRRkJDQThMRUpzQkVMY0JEQWNMSTVjQ1FRSnJRZi8vQTNFaUFDU1hBaUFBSTVnQ0VLVUJRU0FrbUFKQkNBOExFSnNCUVJoMFFSaDFJUUFqbHdJZ0FFRUJFS1lCSTVjQ0lBQnFRZi8vQTNFa2x3SkJBQkNoQVVFQUVLSUJJNWdDUVFGcVFmLy9BM0VrbUFKQkRBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlKSmdDUVFRUEN4Q2NBVUgvL3dOeEk0OENFSjBCSTVnQ1FRSnFRZi8vQTNFa21BSkJCQThMRUpzQkVMZ0JEQUlMSTVjQ1FRSnJRZi8vQTNFaUFDU1hBaUFBSTVnQ0VLVUJRU2drbUFKQkNBOExRWDhQQ3lPWUFrRUJha0gvL3dOeEpKZ0NRUVFMNXdNQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FVY0VRQ0FBUWZFQlJnMEJBa0FnQUVIeUFXc09EZ01FQUFVR0J3Z0pDZ3NBQUF3TkFBc01EUXNRbXdGQi93RnhRWUQrQTJvUXB3RkIvd0Z4Skk4Q0RBMExJNWNDSWdFUXZnRkIvLzhEY1NFQUlBRkJBbXBCLy84RGNTU1hBaUFBUVlEK0EzRkJDSFVrandJZ0FFSC9BWEVrbGdJTURRc2prUUpCZ1A0RGFoQ25BVUgvQVhFa2p3SU1EQXRCQUNTOEFRd0xDeU9YQWtFQ2EwSC8vd054SWdBa2x3SWdBQ09XQWtIL0FYRWpqd0pCL3dGeFFRaDBjaENsQVVFSUR3c1Ftd0VRdWdFTUNBc2psd0pCQW10Qi8vOERjU0lBSkpjQ0lBQWptQUlRcFFGQk1DU1lBa0VJRHdzUW13RkJHSFJCR0hVaEFDT1hBaUVCUVFBUW9RRkJBQkNpQVNBQklBQkJBUkNtQVNBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpKUUNJQUJCL3dGeEpKVUNJNWdDUVFGcVFmLy9BM0VrbUFKQkNBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlKSmNDUVFnUEN4Q2NBVUgvL3dOeEVLY0JRZjhCY1NTUEFpT1lBa0VDYWtILy93TnhKSmdDREFVTFFRRWt2UUVNQkFzUW13RVF1d0VNQWdzamx3SkJBbXRCLy84RGNTSUFKSmNDSUFBam1BSVFwUUZCT0NTWUFrRUlEd3RCZnc4TEk1Z0NRUUZxUWYvL0EzRWttQUlMUVFRTDJBRUJBWDhqbUFKQkFXcEIvLzhEY1NFQkk1d0NCRUFnQVVFQmEwSC8vd054SVFFTElBRWttQUlDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBWEZCQkhVaUFRUkFJQUZCQVdzT0RnRUNBd1FGQmdjSUNRb0xEQTBPRHdzZ0FCQ29BUThMSUFBUXFRRVBDeUFBRUtvQkR3c2dBQkNyQVE4TElBQVFyQUVQQ3lBQUVLMEJEd3NnQUJDdUFROExJQUFRcndFUEN5QUFFTE1CRHdzZ0FCQzJBUThMSUFBUXVRRVBDeUFBRUx3QkR3c2dBQkRKQVE4TElBQVF5Z0VQQ3lBQUVNc0JEd3NnQUJETUFRdStBUUVDZjBFQUpMd0JRWS8rQXhBZFFRRWdBSFJCZjNOeElnRWt4QUZCai80RElBRVFIeU9YQWtFQ2EwSC8vd054SkpjQ0k1Y0NJZ0VqbUFJaUFrSC9BWEVRSHlBQlFRRnFJQUpCZ1A0RGNVRUlkUkFmQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCUmcwQkFrQWdBRUVDYXc0REF3UUZBQXNNQlF0QkFDVEZBVUhBQUNTWUFnd0VDMEVBSk1ZQlFjZ0FKSmdDREFNTFFRQWt4d0ZCMEFBa21BSU1BZ3RCQUNUSUFVSFlBQ1NZQWd3QkMwRUFKTWtCUWVBQUpKZ0NDd3ZwQVFFQ2Z5TzlBUVJBUVFFa3ZBRkJBQ1M5QVFzanZnRWp4QUZ4UVI5eFFRQktCRUFqbXdKRlFRQWp2QUViQkg4anhRRkJBQ08vQVJzRWYwRUFFTTRCUVFFRkk4WUJRUUFqd0FFYkJIOUJBUkRPQVVFQkJTUEhBVUVBSThFQkd3Ui9RUUlRemdGQkFRVWp5QUZCQUNQQ0FSc0VmMEVERU00QlFRRUZJOGtCUVFBand3RWJCSDlCQkJET0FVRUJCVUVBQ3dzTEN3c0ZRUUFMQkVCQkFTT2JBaU9hQWhzRWYwRUFKSnNDUVFBa21nSkJBQ1NjQWtFQUpKMENRUmdGUVJRTElRQUxRUUVqbXdJam1nSWJCRUJCQUNTYkFrRUFKSm9DUVFBa25BSkJBQ1NkQWdzZ0FBOExRUUFMdGdFQkFuOUJBU1NuQWlPY0FnUkFJNWdDRUIxQi93RnhFTTBCRUpvQlFRQWttd0pCQUNTYUFrRUFKSndDUVFBa25RSUxFTThCSWdCQkFFb0VRQ0FBRUpvQkMwRUVJUUJCQUNPZEFrVkJBU09iQWlPYUFoc2JCRUFqbUFJUUhVSC9BWEVRelFFaEFBc2psZ0pCOEFGeEpKWUNJQUJCQUV3RVFDQUFEd3NnQUJDYUFTT2pBa0VCYWlJQkk2RUNUZ1IvSTZJQ1FRRnFKS0lDSUFFam9RSnJCU0FCQ3lTakFpT1lBaVBpQVVZRVFFRUJKT1VCQ3lBQUN3VUFJN29CQzdFQkFRTi9JQUJCZjBHQUNDQUFRUUJJR3lBQVFRQktHeUVDUVFBaEFBTkFJK1VCUlVFQUlBRkZRUUJCQUNBQVJTQURHeHNiQkVBUTBBRkJBRWdFUUVFQklRTUZJNWtDUWRDa0JDT09BblJPQkVCQkFTRUFCVUVCSUFFanVnRWdBazVCQUNBQ1FYOUtHeHNoQVFzTERBRUxDeUFBQkVBam1RSkIwS1FFSTQ0Q2RHc2ttUUlqcEFJUEN5QUJCRUFqcFFJUEN5UGxBUVJBUVFBazVRRWpwZ0lQQ3lPWUFrRUJhMEgvL3dOeEpKZ0NRWDhMQndCQmZ4RFNBUXMwQVFKL0EwQWdBVUVBVGtFQUlBSWdBRWdiQkVCQmZ4RFNBU0VCSUFKQkFXb2hBZ3dCQ3dzZ0FVRUFTQVJBSUFFUEMwRUFDd1VBSTU0Q0N3VUFJNThDQ3dVQUk2QUNDMXNBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCQWtBZ0FFRUNhdzRHQXdRRkJnY0lBQXNNQ0FzajF3RVBDeVBhQVE4TEk5Z0JEd3NqMlFFUEN5UGJBUThMSTl3QkR3c2ozUUVQQ3lQZUFROExRUUFMaHdFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCUmcwQkFrQWdBRUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBVUVBUnlUWEFRd0hDeUFCUVFCSEpOb0JEQVlMSUFGQkFFY2syQUVNQlFzZ0FVRUFSeVRaQVF3RUN5QUJRUUJISk5zQkRBTUxJQUZCQUVjazNBRU1BZ3NnQVVFQVJ5VGRBUXdCQ3lBQlFRQkhKTjRCQ3d0UkFRRi9RUUFrblFJZ0FCRFlBVVVFUUVFQklRRUxJQUJCQVJEWkFTQUJCRUJCQVVFQlFRQkJBVUVBSUFCQkEwd2JJZ0JCQUNQZ0FSc2JJQUJGUVFBajRRRWJHd1JBUVFFa3lRRkJCQkJhQ3dzTENRQWdBRUVBRU5rQkM1b0JBQ0FBUVFCS0JFQkJBQkRhQVFWQkFCRGJBUXNnQVVFQVNnUkFRUUVRMmdFRlFRRVEyd0VMSUFKQkFFb0VRRUVDRU5vQkJVRUNFTnNCQ3lBRFFRQktCRUJCQXhEYUFRVkJBeERiQVFzZ0JFRUFTZ1JBUVFRUTJnRUZRUVFRMndFTElBVkJBRW9FUUVFRkVOb0JCVUVGRU5zQkN5QUdRUUJLQkVCQkJoRGFBUVZCQmhEYkFRc2dCMEVBU2dSQVFRY1EyZ0VGUVFjUTJ3RUxDd2NBSUFBazRnRUxCd0JCZnlUaUFRc0hBQ0FBSk9NQkN3Y0FRWDhrNHdFTEJ3QWdBQ1RrQVFzSEFFRi9KT1FCQ3dVQUk0OENDd1VBSTVBQ0N3VUFJNUVDQ3dVQUk1SUNDd1VBSTVNQ0N3VUFJNVFDQ3dVQUk1VUNDd1VBSTVZQ0N3VUFJNWdDQ3dVQUk1Y0NDd3NBSTVnQ0VCMUIvd0Z4Q3dVQUkvSUJDNnNEQVFwL1FZQ0FBa0dBa0FJajZ3RWJJUWhCZ0xnQ1FZQ3dBaVBzQVJzaENRTkFJQVZCZ0FKSUJFQkJBQ0VFQTBBZ0JFR0FBa2dFUUNBSUlBVkJBM1ZCQlhRZ0NXb2dCRUVEZFdvaUFrR0FrSDVxTFFBQUVFMGhCaUFGUVFodklRRkJCeUFFUVFodmF5RUhRUUFoQXdKL0lBQkJBRXBCQUNPTkFoc0VRQ0FDUVlEUWZtb3RBQUFoQXdzZ0EwSEFBSEVMQkVCQkJ5QUJheUVCQzBFQUlRSWdBVUVCZENBR2FpSUdRWUNRZm1wQkFVRUFJQU5CQ0hFYklnSkJEWFJxTFFBQUlRcEJBQ0VCSUFaQmdaQithaUFDUVExMGFpMEFBRUVCSUFkMGNRUkFRUUloQVFzZ0FVRUJhaUFCUVFFZ0IzUWdDbkViSVFFZ0JVRUlkQ0FFYWtFRGJDRUNJQUJCQUVwQkFDT05BaHNFUUNBQ1FZQ2hDMm9pQWlBRFFRZHhJQUZCQUJCT0lnRkJIM0ZCQTNRNkFBQWdBa0VCYWlBQlFlQUhjVUVGZFVFRGREb0FBQ0FDUVFKcUlBRkJnUGdCY1VFS2RVRURkRG9BQUFVZ0FrR0FvUXRxSWdNZ0FVSEgvZ01RVHlJQlFZQ0EvQWR4UVJCMU9nQUFJQU5CQVdvZ0FVR0EvZ054UVFoMU9nQUFJQU5CQW1vZ0FUb0FBQXNnQkVFQmFpRUVEQUVMQ3lBRlFRRnFJUVVNQVFzTEM5Z0RBUXgvQTBBZ0JFRVhUa1VFUUVFQUlRTURRQ0FEUVI5SUJFQkJBVUVBSUFOQkQwb2lCeHNoQ1NBRVFROXJJQVFnQkVFUFNpSUFHMEVFZENJRklBTkJEMnRxSUFNZ0JXb2dCeHNoQ0VHQWtBSkJnSUFDSUFBYklRcEJ4LzRESVFkQmZ5RUdRWDhoQlVFQUlRRURRQ0FCUVFoSUJFQkJBQ0VDQTBBZ0FrRUZTQVJBSUFKQkEzUWdBV3BCQW5RaUFFR0MvQU5xRUIwZ0NFWUVRQ0FBUVlQOEEyb1FIU0VBUVFGQkFDQUFRUWh4UVFCSFFRQWpqUUliR3lBSlJnUkFRUWdoQVVFRklRSWdBQ0lGUVJCeEJIOUJ5ZjREQlVISS9nTUxJUWNMQ3lBQ1FRRnFJUUlNQVFzTElBRkJBV29oQVF3QkN3c2dCVUVBU0VFQUk0MENHd1JBUVlDNEFrR0FzQUlqN0FFYklRdEJmeUVBUVFBaEFnTkFJQUpCSUVnRVFFRUFJUUVEUUNBQlFTQklCRUFnQVVFRmRDQUxhaUFDYWlJR1FZQ1FmbW90QUFBZ0NFWUVRRUVnSVFKQklDRUJJQVloQUFzZ0FVRUJhaUVCREFFTEN5QUNRUUZxSVFJTUFRc0xJQUJCQUU0RWZ5QUFRWURRZm1vdEFBQUZRWDhMSVFZTFFRQWhBQU5BSUFCQkNFZ0VRQ0FJSUFvZ0NVRUFRUWNnQUNBRFFRTjBJQVJCQTNRZ0FHcEIrQUZCZ0tFWElBY2dCaUFGRUZBYUlBQkJBV29oQUF3QkN3c2dBMEVCYWlFRERBRUxDeUFFUVFGcUlRUU1BUXNMQzVrQ0FRbC9BMEFnQkVFSVRrVUVRRUVBSVFFRFFDQUJRUVZJQkVBZ0FVRURkQ0FFYWtFQ2RDSUFRWUQ4QTJvUUhSb2dBRUdCL0FOcUVCMGFJQUJCZ3Z3RGFoQWRJUUpCQVNFRkkrMEJCRUFnQWtFQ2IwRUJSZ1JBSUFKQkFXc2hBZ3RCQWlFRkN5QUFRWVA4QTJvUUhTRUdRUUFoQjBFQlFRQWdCa0VJY1VFQVIwRUFJNDBDR3hzaEIwSEkvZ01oQ0VISi9nTkJ5UDRESUFaQkVIRWJJUWhCQUNFQUEwQWdBQ0FGU0FSQVFRQWhBd05BSUFOQkNFZ0VRQ0FBSUFKcVFZQ0FBaUFIUVFCQkJ5QURJQVJCQTNRZ0FVRUVkQ0FEYWlBQVFRTjBha0hBQUVHQW9TQWdDRUYvSUFZUVVCb2dBMEVCYWlFRERBRUxDeUFBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3dzZ0JFRUJhaUVFREFFTEN3c0ZBQ1BMQVFzRkFDUE1BUXNGQUNQUEFRc1lBUUYvSTlFQklRQWowQUVFUUNBQVFRUnlJUUFMSUFBTE1BRUJmd05BQWtBZ0FFSC8vd05PRFFBZ0FFR0F0Y2tFYWlBQUVIWTZBQUFnQUVFQmFpRUFEQUVMQzBFQUpPVUJDeFlBRUJzL0FFR1VBVWdFUUVHVUFUOEFhMEFBR2dzTDNBRUFJQUJCbkFKSkJFQVBDeUFBUVJCcklRQUNRQUpBQWtBQ1FBSkFBa0FnQVVFQlJ3UkFJQUZCQWtZTkFRSkFJQUZCQTJzT0F3TUVCUUFMREFVTElBQVFGQXdGQ3lBQUtBSUVRZi8vLy84QWNVRUFUUVJBUVFCQmdBRkJ5d0JCRVJBQUFBc2dBQ0FBS0FJRVFRRnJOZ0lFSUFBUUZnd0VDeUFBRUJnTUF3c2dBQ2dDQkNJQlFZQ0FnSUIvY1NBQlFRRnFRWUNBZ0lCL2NVY0VRRUVBUVlBQlFkWUFRUVlRQUFBTElBQWdBVUVCYWpZQ0JDQUJRWUNBZ0lBSGNRUkFJQUFRRndzTUFnc2dBQkFaREFFTFFRQkJnQUZCNFFCQkdCQUFBQXNMTFFBQ1FBSkFBa0FnQUVFSWF5Z0NBQTREQUFBQkFnc1BDeUFBS0FJQUlnQUVRQ0FBSUFFUStBRUxEd3NBQ3dNQUFRc2RBQUpBQWtBQ1FDT3BBZzRDQVFJQUN3QUxRUUFoQUFzZ0FCRFNBUXNIQUNBQUpLa0NDeVVBQWtBQ1FBSkFBa0FqcVFJT0F3RUNBd0FMQUF0QkFTRUFDMEYvSVFFTElBRVEwZ0VMQzU4Q0JnQkJDQXN0SGdBQUFBRUFBQUFCQUFBQUhnQUFBSDRBYkFCcEFHSUFMd0J5QUhRQUx3QjBBR3dBY3dCbUFDNEFkQUJ6QUVFNEN6Y29BQUFBQVFBQUFBRUFBQUFvQUFBQVlRQnNBR3dBYndCakFHRUFkQUJwQUc4QWJnQWdBSFFBYndCdkFDQUFiQUJoQUhJQVp3QmxBRUh3QUFzdEhnQUFBQUVBQUFBQkFBQUFIZ0FBQUg0QWJBQnBBR0lBTHdCeUFIUUFMd0J3QUhVQWNnQmxBQzRBZEFCekFFR2dBUXN6SkFBQUFBRUFBQUFCQUFBQUpBQUFBRWtBYmdCa0FHVUFlQUFnQUc4QWRRQjBBQ0FBYndCbUFDQUFjZ0JoQUc0QVp3QmxBRUhZQVFzakZBQUFBQUVBQUFBQkFBQUFGQUFBQUg0QWJBQnBBR0lBTHdCeUFIUUFMZ0IwQUhNQVFZQUNDeFVEQUFBQUVBQUFBQUFBQUFBUUFBQUFBQUFBQUJBQU14QnpiM1Z5WTJWTllYQndhVzVuVlZKTUlXTnZjbVV2WkdsemRDOWpiM0psTG5WdWRHOTFZMmhsWkM1M1lYTnRMbTFoY0E9PSIpOgphd2FpdCBPKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlBRVJZQUovZndGL1lBQUFZQU4vZjM4QmYyQUVmMzkvZndCZ0FuOS9BR0FCZndGL1lBTi9mMzhBWUFGL0FHQUtmMzkvZjM5L2YzOS9md0JnQUFGL1lBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCMzkvZjM5L2YzOEFZQVIvZjM5L0FYOWdDSDkvZjM5L2YzOS9BR0FGZjM5L2YzOEJmMkFOZjM5L2YzOS9mMzkvZjM5L2Z3Ri9BZzBCQTJWdWRnVmhZbTl5ZEFBREEvOEIvUUVFQkFZQkJRQUVCZ0FBQndVRUJRWUdCd0VIQndjSEJ3Y0hBUUVGQlFFRUFRRUhCd0VCQVFFQkFRRUhBUUVIQndFQkFRRUlDUUVCQVFFQkFRRUJCd2NCQVFFQkFRRUJBUWtKQ1FrUEFBSUFFQXNNQ2dvR0JBY0JBUWNCQVFFQkJ3RUJBUUVGQlFBRkJRa0JCUVVBRFFjSEJ3RUZDUVVGQkFjSEJ3Y0hBUWNCQndFSEFRY0FCd2tKQndRRkFBY0JBUWNBQkFZQkFBRUhBUWNIQ1FrRUJBY0VCd2NIQkFRR0JRVUZCUVVGQlFVRkJBY0hCUWNIQlFjSEJRY0hCUVVGQlFVRkJRVUZCUVVBQlFVRkJRVUZCd2tKQ1FVSkJRa0pDUVVFQndjT0J3RUhBUWNCQ1FrSkNRa0pDUWtKQ1FrSkJ3RUJDUWtKQ1FFQkJBUUJCUWNBQlFNQkFBRUcxQXlxQW44QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3QkJBQXQvQUVHQUNBdC9BRUdBQ0F0L0FFR0FDQXQvQUVHQUVBdC9BRUdBZ0FFTGZ3QkJnSkFCQzM4QVFZQ0FBZ3QvQUVHQWtBTUxmd0JCZ0lBQkMzOEFRWUFRQzM4QVFZQ0FCQXQvQUVHQWtBUUxmd0JCZ0FFTGZ3QkJnSkVFQzM4QVFZQzRBUXQvQUVHQXlRVUxmd0JCZ05nRkMzOEFRWUNoQ3d0L0FFR0FnQXdMZndCQmdLRVhDMzhBUVlDQUNRdC9BRUdBb1NBTGZ3QkJnUGdBQzM4QVFZQ1FCQXQvQUVHQWlSMExmd0JCZ0praEMzOEFRWUNBQ0F0L0FFR0FtU2tMZndCQmdJQUlDMzhBUVlDWk1RdC9BRUdBZ0FnTGZ3QkJnSms1QzM4QVFZQ0FDQXQvQUVHQW1jRUFDMzhBUVlDQUNBdC9BRUdBbWNrQUMzOEFRWUNBQ0F0L0FFR0FtZEVBQzM4QVFZQVVDMzhBUVlDdDBRQUxmd0JCZ0lqNEF3dC9BRUdBdGNrRUMzOEFRZi8vQXd0L0FFRUFDMzhBUVlDMXpRUUxmd0JCbEFFTGZ3RkJBQXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BRUhvL2dNTGZ3QkI2ZjREQzM4QVFlditBd3QvQVVGL0MzOEJRWDhMZndGQkFBdC9BRUhBQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QVFjQUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhBUVlBQ0MzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhBUWNBQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJEd3QvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUWY4QUMzOEJRZjhBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BRUhFMkFJTGZ3RkJBQXQvQVVFQUMzOEFRWUNBQ0F0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRWDhMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndCQjBmNERDMzhBUWRMK0F3dC9BRUhUL2dNTGZ3QkIxUDREQzM4QVFkWCtBd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0JCei80REMzOEFRZkQrQXd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJnS2pXdVFjTGZ3RkJBQXQvQVVFQUMzOEFRUUFMZndCQkFRdC9BRUVDQzM4QlFRQUxmd0JCZ0FJTGZ3RkJBQXNIOEJCbEJtMWxiVzl5ZVFJQUIxOWZZV3hzYjJNQUNnaGZYM0psZEdGcGJnQU1DVjlmY21Wc1pXRnpaUUFWQ1Y5ZlkyOXNiR1ZqZEFBYUMxOWZjblIwYVY5aVlYTmxBNmdDQm1OdmJtWnBad0EwRG1oaGMwTnZjbVZUZEdGeWRHVmtBRFVKYzJGMlpWTjBZWFJsQUR3SmJHOWhaRk4wWVhSbEFFY0ZhWE5IUWtNQVNCSm5aWFJUZEdWd2MxQmxjbE4wWlhCVFpYUUFTUXRuWlhSVGRHVndVMlYwY3dCS0NHZGxkRk4wWlhCekFFc1ZaWGhsWTNWMFpVMTFiSFJwY0d4bFJuSmhiV1Z6QU5RQkRHVjRaV04xZEdWR2NtRnRaUURUQVFsZlgzTmxkR0Z5WjJNQS9BRVpaWGhsWTNWMFpVWnlZVzFsUVc1a1EyaGxZMnRCZFdScGJ3RDdBUlZsZUdWamRYUmxWVzUwYVd4RGIyNWthWFJwYjI0QS9RRUxaWGhsWTNWMFpWTjBaWEFBMEFFVVoyVjBRM2xqYkdWelVHVnlRM2xqYkdWVFpYUUExUUVNWjJWMFEzbGpiR1ZUWlhSekFOWUJDV2RsZEVONVkyeGxjd0RYQVE1elpYUktiM2x3WVdSVGRHRjBaUURjQVI5blpYUk9kVzFpWlhKUFpsTmhiWEJzWlhOSmJrRjFaR2x2UW5WbVptVnlBTkVCRUdOc1pXRnlRWFZrYVc5Q2RXWm1aWElBUXh4elpYUk5ZVzUxWVd4RGIyeHZjbWw2WVhScGIyNVFZV3hsZEhSbEFDSVhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0RE1CTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBekVTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXpJZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd1FhUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQlJaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd1lTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdjZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDRERGh4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3OFNWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd2dPVmtsRVJVOWZVa0ZOWDFOSldrVURDUkZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01LRFZkUFVrdGZVa0ZOWDFOSldrVURDeVpQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNTUlrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVRERSaEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0REhCUkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1kRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F4QVFSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTVJHRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTVNGRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXhNT1JsSkJUVVZmVEU5RFFWUkpUMDRERkFwR1VrRk5SVjlUU1ZwRkF4VVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REZoTkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeGNTVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhnT1ZFbE1SVjlFUVZSQlgxTkpXa1VER1JKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REdnNVBRVTFmVkVsTVJWTmZVMGxhUlFNYkZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01tRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXljWlEwaEJUazVGVEY4eFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNZUZVTklRVTVPUlV4Zk1WOUNWVVpHUlZKZlUwbGFSUU1mR1VOSVFVNU9SVXhmTWw5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESUJWRFNFRk9Ua1ZNWHpKZlFsVkdSa1ZTWDFOSldrVURJUmxEU0VGT1RrVk1Yek5mUWxWR1JrVlNYMHhQUTBGVVNVOU9BeUlWUTBoQlRrNUZURjh6WDBKVlJrWkZVbDlUU1ZwRkF5TVpRMGhCVGs1RlRGODBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWtGVU5JUVU1T1JVeGZORjlDVlVaR1JWSmZVMGxhUlFNbEZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRES0JKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVREtSRkNUMDlVWDFKUFRWOU1UME5CVkVsUFRnTXFEVUpQVDFSZlVrOU5YMU5KV2tVREt4WkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXl3U1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5MGRSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRETGhsRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOVRTVnBGQXk4aFoyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQUJ3YmMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFOMEJIWEpsYzJWMFVISnZaM0poYlVOdmRXNTBaWEpDY21WaGEzQnZhVzUwQU40QkdYTmxkRkpsWVdSSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTN3RWJjbVZ6WlhSU1pXRmtSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBT0FCR25ObGRGZHlhWFJsUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQU9FQkhISmxjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUE0Z0VNWjJWMFVtVm5hWE4wWlhKQkFPTUJER2RsZEZKbFoybHpkR1Z5UWdEa0FReG5aWFJTWldkcGMzUmxja01BNVFFTVoyVjBVbVZuYVhOMFpYSkVBT1lCREdkbGRGSmxaMmx6ZEdWeVJRRG5BUXhuWlhSU1pXZHBjM1JsY2tnQTZBRU1aMlYwVW1WbmFYTjBaWEpNQU9rQkRHZGxkRkpsWjJsemRHVnlSZ0RxQVJGblpYUlFjbTluY21GdFEyOTFiblJsY2dEckFROW5aWFJUZEdGamExQnZhVzUwWlhJQTdBRVpaMlYwVDNCamIyUmxRWFJRY205bmNtRnRRMjkxYm5SbGNnRHRBUVZuWlhSTVdRRHVBUjFrY21GM1FtRmphMmR5YjNWdVpFMWhjRlJ2VjJGemJVMWxiVzl5ZVFEdkFSaGtjbUYzVkdsc1pVUmhkR0ZVYjFkaGMyMU5aVzF2Y25rQThBRVRaSEpoZDA5aGJWUnZWMkZ6YlUxbGJXOXllUUR4QVFablpYUkVTVllBOGdFSFoyVjBWRWxOUVFEekFRWm5aWFJVVFVFQTlBRUdaMlYwVkVGREFQVUJFM1Z3WkdGMFpVUmxZblZuUjBKTlpXMXZjbmtBOWdFSUF2Y0JDb2FZQXYwQm9BSUJCSDhnQVNnQ0FDSURRUUZ4UlFSQVFRQkJHRUdWQWtFTkVBQUFDeUFEUVh4eElnSkJFRThFZnlBQ1FmRC8vLzhEU1FWQkFBdEZCRUJCQUVFWVFaY0NRUTBRQUFBTElBSkJnQUpKQkg4Z0FrRUVkaUVDUVFBRklBSkJIeUFDWjJzaUEwRUVhM1pCRUhNaEFpQURRUWRyQ3lJRFFSZEpCSDhnQWtFUVNRVkJBQXRGQkVCQkFFRVlRYVFDUVEwUUFBQUxJQUVvQWhRaEJDQUJLQUlRSWdVRVFDQUZJQVEyQWhRTElBUUVRQ0FFSUFVMkFoQUxJQU5CQkhRZ0FtcEJBblFnQUdvb0FtQWdBVVlFUUNBRFFRUjBJQUpxUVFKMElBQnFJQVEyQW1BZ0JFVUVRQ0FEUVFKMElBQnFJQU5CQW5RZ0FHb29BZ1JCQVNBQ2RFRi9jM0VpQVRZQ0JDQUJSUVJBSUFBZ0FDZ0NBRUVCSUFOMFFYOXpjVFlDQUFzTEN3djlBd0VHZnlBQlJRUkFRUUJCR0VITkFVRU5FQUFBQ3lBQktBSUFJZ05CQVhGRkJFQkJBRUVZUWM4QlFRMFFBQUFMSUFGQkVHb2dBU2dDQUVGOGNXb2lCQ2dDQUNJRlFRRnhCRUFnQTBGOGNVRVFhaUFGUVh4eGFpSUNRZkQvLy84RFNRUkFJQUFnQkJBQklBRWdBMEVEY1NBQ2NpSUROZ0lBSUFGQkVHb2dBU2dDQUVGOGNXb2lCQ2dDQUNFRkN3c2dBMEVDY1FSQUlBRkJCR3NvQWdBaUFpZ0NBQ0lHUVFGeFJRUkFRUUJCR0VIa0FVRVBFQUFBQ3lBR1FYeHhRUkJxSUFOQmZIRnFJZ2RCOFAvLy93TkpCSDhnQUNBQ0VBRWdBaUFHUVFOeElBZHlJZ00yQWdBZ0FnVWdBUXNoQVFzZ0JDQUZRUUp5TmdJQUlBTkJmSEVpQWtFUVR3Ui9JQUpCOFAvLy93TkpCVUVBQzBVRVFFRUFRUmhCOHdGQkRSQUFBQXNnQkNBQlFSQnFJQUpxUndSQVFRQkJHRUgwQVVFTkVBQUFDeUFFUVFScklBRTJBZ0FnQWtHQUFra0VmeUFDUVFSMklRUkJBQVVnQWtFZklBSm5heUlDUVFScmRrRVFjeUVFSUFKQkIyc0xJZ05CRjBrRWZ5QUVRUkJKQlVFQUMwVUVRRUVBUVJoQmhBSkJEUkFBQUFzZ0EwRUVkQ0FFYWtFQ2RDQUFhaWdDWUNFQ0lBRkJBRFlDRUNBQklBSTJBaFFnQWdSQUlBSWdBVFlDRUFzZ0EwRUVkQ0FFYWtFQ2RDQUFhaUFCTmdKZ0lBQWdBQ2dDQUVFQklBTjBjallDQUNBRFFRSjBJQUJxSUFOQkFuUWdBR29vQWdSQkFTQUVkSEkyQWdRTHl3RUJBbjhnQWtFUGNVVkJBQ0FCUVE5eFJVRUFJQUVnQWswYkcwVUVRRUVBUVJoQmdnTkJCQkFBQUFzZ0FDZ0NvQXdpQXdSQUlBRWdBMEVRYWtrRVFFRUFRUmhCakFOQkR4QUFBQXNnQVVFUWF5QURSZ1JBSUFNb0FnQWhCQ0FCUVJCcklRRUxCU0FCSUFCQnBBeHFTUVJBUVFCQkdFR1lBMEVFRUFBQUN3c2dBaUFCYXlJQ1FUQkpCRUFQQ3lBQklBUkJBbkVnQWtFZ2EwRUJjbkkyQWdBZ0FVRUFOZ0lRSUFGQkFEWUNGQ0FCSUFKcVFSQnJJZ0pCQWpZQ0FDQUFJQUkyQXFBTUlBQWdBUkFDQzVjQkFRSi9RUUUvQUNJQVNnUi9RUUVnQUd0QUFFRUFTQVZCQUFzRVFBQUxRYUFDUVFBMkFnQkJ3QTVCQURZQ0FFRUFJUUFEUUFKQUlBQkJGMDhOQUNBQVFRSjBRYUFDYWtFQU5nSUVRUUFoQVFOQUFrQWdBVUVRVHcwQUlBQkJCSFFnQVdwQkFuUkJvQUpxUVFBMkFtQWdBVUVCYWlFQkRBRUxDeUFBUVFGcUlRQU1BUXNMUWFBQ1FkQU9Qd0JCRUhRUUEwR2dBaVFBQ3kwQUlBQkI4UC8vL3dOUEJFQkJ5QUJCR0VIQUEwRWRFQUFBQ3lBQVFROXFRWEJ4SWdCQkVDQUFRUkJMR3d2ZEFRRUJmeUFCUVlBQ1NRUi9JQUZCQkhZaEFVRUFCU0FCUWZqLy8vOEJTUVJBUVFGQkd5QUJaMnQwSUFGcVFRRnJJUUVMSUFGQkh5QUJaMnNpQWtFRWEzWkJFSE1oQVNBQ1FRZHJDeUlDUVJkSkJIOGdBVUVRU1FWQkFBdEZCRUJCQUVFWVFkSUNRUTBRQUFBTElBSkJBblFnQUdvb0FnUkJmeUFCZEhFaUFRUi9JQUZvSUFKQkJIUnFRUUowSUFCcUtBSmdCU0FBS0FJQVFYOGdBa0VCYW5SeElnRUVmeUFCYUNJQlFRSjBJQUJxS0FJRUlnSkZCRUJCQUVFWVFkOENRUkVRQUFBTElBSm9JQUZCQkhScVFRSjBJQUJxS0FKZ0JVRUFDd3NMUUFFQmZ6OEFJZ0lnQVVILy93TnFRWUNBZkhGQkVIWWlBU0FDSUFGS0cwQUFRUUJJQkVBZ0FVQUFRUUJJQkVBQUN3c2dBQ0FDUVJCMFB3QkJFSFFRQXd1SEFRRUNmeUFCS0FJQUlRTWdBa0VQY1FSQVFRQkJHRUh0QWtFTkVBQUFDeUFEUVh4eElBSnJJZ1JCSUU4RVFDQUJJQU5CQW5FZ0FuSTJBZ0FnQVVFUWFpQUNhaUlCSUFSQkVHdEJBWEkyQWdBZ0FDQUJFQUlGSUFFZ0EwRitjVFlDQUNBQlFSQnFJQUVvQWdCQmZIRnFJQUZCRUdvZ0FTZ0NBRUY4Y1dvb0FnQkJmWEUyQWdBTEMyb0JBbjhnQUNBQkVBVWlBeEFHSWdKRkJFQWdBQ0FERUFjZ0FDQURFQVlpQWtVRVFFRUFRUmhCM2dOQkR4QUFBQXNMSUFJb0FnQkJmSEVnQTBrRVFFRUFRUmhCNEFOQkRSQUFBQXNnQWtFQU5nSUVJQUlnQVRZQ0RDQUFJQUlRQVNBQUlBSWdBeEFJSUFJTElnRUJmeU1BSWdJRWZ5QUNCUkFFSXdBTElBQVFDU0lBSUFFMkFnZ2dBRUVRYWd0UkFRRi9JQUFvQWdRaUFVR0FnSUNBZjNFZ0FVRUJha0dBZ0lDQWYzRkhCRUJCQUVHQUFVSG9BRUVDRUFBQUN5QUFJQUZCQVdvMkFnUWdBQ2dDQUVFQmNRUkFRUUJCZ0FGQjZ3QkJEUkFBQUFzTEZBQWdBRUdjQWtzRVFDQUFRUkJyRUFzTElBQUxMUUVCZnlBQktBSUFJZ0pCQVhFRVFFRUFRUmhCbVFSQkFoQUFBQXNnQVNBQ1FRRnlOZ0lBSUFBZ0FSQUNDeWNBSUFCQmdBSW9BZ0JMQkVCQnNBRkI2QUZCRmtFYkVBQUFDeUFBUVFOMFFZUUNhaWdDQUF2RURBRURmd05BSUFGQkEzRkJBQ0FDR3dSQUlBQWlBMEVCYWlFQUlBRWlCRUVCYWlFQklBTWdCQzBBQURvQUFDQUNRUUZySVFJTUFRc0xJQUJCQTNGRkJFQURRQ0FDUVJCSlJRUkFJQUFnQVNnQ0FEWUNBQ0FBUVFScUlBRkJCR29vQWdBMkFnQWdBRUVJYWlBQlFRaHFLQUlBTmdJQUlBQkJER29nQVVFTWFpZ0NBRFlDQUNBQlFSQnFJUUVnQUVFUWFpRUFJQUpCRUdzaEFnd0JDd3NnQWtFSWNRUkFJQUFnQVNnQ0FEWUNBQ0FBUVFScUlBRkJCR29vQWdBMkFnQWdBVUVJYWlFQklBQkJDR29oQUFzZ0FrRUVjUVJBSUFBZ0FTZ0NBRFlDQUNBQlFRUnFJUUVnQUVFRWFpRUFDeUFDUVFKeEJFQWdBQ0FCTHdFQU93RUFJQUZCQW1vaEFTQUFRUUpxSVFBTElBSkJBWEVFUUNBQUlBRXRBQUE2QUFBTER3c2dBa0VnVHdSQUFrQUNRQUpBSUFCQkEzRWlBMEVCUndSQUlBTkJBa1lOQVNBRFFRTkdEUUlNQXdzZ0FTZ0NBQ0VGSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRTnJJUUlEUUNBQ1FSRkpSUVJBSUFBZ0FVRUJhaWdDQUNJRFFRaDBJQVZCR0haeU5nSUFJQUJCQkdvZ0EwRVlkaUFCUVFWcUtBSUFJZ05CQ0hSeU5nSUFJQUJCQ0dvZ0EwRVlkaUFCUVFscUtBSUFJZ05CQ0hSeU5nSUFJQUJCREdvZ0FVRU5haWdDQUNJRlFRaDBJQU5CR0haeU5nSUFJQUZCRUdvaEFTQUFRUkJxSVFBZ0FrRVFheUVDREFFTEN3d0NDeUFCS0FJQUlRVWdBQ0FCTFFBQU9nQUFJQUJCQVdvaUEwRUJhaUVBSUFGQkFXb2lCRUVCYWlFQklBTWdCQzBBQURvQUFDQUNRUUpySVFJRFFDQUNRUkpKUlFSQUlBQWdBVUVDYWlnQ0FDSURRUkIwSUFWQkVIWnlOZ0lBSUFCQkJHb2dBMEVRZGlBQlFRWnFLQUlBSWdOQkVIUnlOZ0lBSUFCQkNHb2dBMEVRZGlBQlFRcHFLQUlBSWdOQkVIUnlOZ0lBSUFCQkRHb2dBVUVPYWlnQ0FDSUZRUkIwSUFOQkVIWnlOZ0lBSUFGQkVHb2hBU0FBUVJCcUlRQWdBa0VRYXlFQ0RBRUxDd3dCQ3lBQktBSUFJUVVnQUNJRFFRRnFJUUFnQVNJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBSUFKQkFXc2hBZ05BSUFKQkUwbEZCRUFnQUNBQlFRTnFLQUlBSWdOQkdIUWdCVUVJZG5JMkFnQWdBRUVFYWlBRFFRaDJJQUZCQjJvb0FnQWlBMEVZZEhJMkFnQWdBRUVJYWlBRFFRaDJJQUZCQzJvb0FnQWlBMEVZZEhJMkFnQWdBRUVNYWlBQlFROXFLQUlBSWdWQkdIUWdBMEVJZG5JMkFnQWdBVUVRYWlFQklBQkJFR29oQUNBQ1FSQnJJUUlNQVFzTEN3c2dBa0VRY1FSQUlBQWdBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJRFFRRnFJUUFnQVVFQmFpSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUN5QUNRUWh4QkVBZ0FDQUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUEwRUJhaUVBSUFGQkFXb2lCRUVCYWlFQklBTWdCQzBBQURvQUFBc2dBa0VFY1FSQUlBQWdBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSURRUUZxSVFBZ0FVRUJhaUlFUVFGcUlRRWdBeUFFTFFBQU9nQUFDeUFDUVFKeEJFQWdBQ0FCTFFBQU9nQUFJQUJCQVdvaUEwRUJhaUVBSUFGQkFXb2lCRUVCYWlFQklBTWdCQzBBQURvQUFBc2dBa0VCY1FSQUlBQWdBUzBBQURvQUFBc0wwZ0lCQW44Q1FDQUNJUU1nQUNBQlJnMEFRUUVnQUNBRGFpQUJUU0FCSUFOcUlBQk5Hd1JBSUFBZ0FTQURFQThNQVFzZ0FDQUJTUVJBSUFGQkIzRWdBRUVIY1VZRVFBTkFJQUJCQjNFRVFDQURSUTBFSUFOQkFXc2hBeUFBSWdKQkFXb2hBQ0FCSWdSQkFXb2hBU0FDSUFRdEFBQTZBQUFNQVFzTEEwQWdBMEVJU1VVRVFDQUFJQUVwQXdBM0F3QWdBMEVJYXlFRElBQkJDR29oQUNBQlFRaHFJUUVNQVFzTEN3TkFJQU1FUUNBQUlnSkJBV29oQUNBQklnUkJBV29oQVNBQ0lBUXRBQUE2QUFBZ0EwRUJheUVEREFFTEN3VWdBVUVIY1NBQVFRZHhSZ1JBQTBBZ0FDQURha0VIY1FSQUlBTkZEUVFnQUNBRFFRRnJJZ05xSUFFZ0Eyb3RBQUE2QUFBTUFRc0xBMEFnQTBFSVNVVUVRQ0FBSUFOQkNHc2lBMm9nQVNBRGFpa0RBRGNEQUF3QkN3c0xBMEFnQXdSQUlBQWdBMEVCYXlJRGFpQUJJQU5xTFFBQU9nQUFEQUVMQ3dzTEN6Z0FJd0JGQkVCQkFFRVlRYmNFUVEwUUFBQUxJQUJCRDNGRlFRQWdBQnRGQkVCQkFFRVlRYmdFUVFJUUFBQUxJd0FnQUVFUWF4QU5DMFVCQkg4akFTTURJZ0ZySWdKQkFYUWlBRUdBQWlBQVFZQUNTeHNpQTBFQUVBb2lBQ0FCSUFJUUVDQUJCRUFnQVJBUkN5QUFKQU1nQUNBQ2FpUUJJQUFnQTJva0Fnc2lBUUYvSXdFaUFTTUNUd1JBRUJJakFTRUJDeUFCSUFBMkFnQWdBVUVFYWlRQkM3WUJBUUovSUFBb0FnUWlBa0gvLy8vL0FIRWhBU0FBS0FJQVFRRnhCRUJCQUVHQUFVSHpBRUVORUFBQUN5QUJRUUZHQkVBZ0FFRVFha0VCRVBrQklBSkJnSUNBZ0hoeEJFQWdBRUdBZ0lDQWVEWUNCQVVqQUNBQUVBMExCU0FCUVFCTkJFQkJBRUdBQVVIOEFFRVBFQUFBQ3lBQUtBSUlFQTVCRUhFRVFDQUFJQUZCQVdzZ0FrR0FnSUNBZjNGeU5nSUVCU0FBSUFGQkFXdEJnSUNBZ0h0eU5nSUVJQUpCZ0lDQWdIaHhSUVJBSUFBUUV3c0xDd3NTQUNBQVFad0NTd1JBSUFCQkVHc1FGQXNMT3dFQmZ5QUFLQUlFSWdGQmdJQ0FnQWR4UVlDQWdJQUJSd1JBSUFBZ0FVSC8vLy8vZUhGQmdJQ0FnQUZ5TmdJRUlBQkJFR3BCQWhENUFRc0xIUUFnQUNBQUtBSUVRZi8vLy85NGNUWUNCQ0FBUVJCcVFRUVErUUVMVHdFQmZ5QUFLQUlFSWdGQmdJQ0FnQWR4UVlDQWdJQUJSZ1JBSUFGQi8vLy8vd0J4UVFCTEJFQWdBQkFYQlNBQUlBRkIvLy8vLzNoeFFZQ0FnSUFDY2pZQ0JDQUFRUkJxUVFNUStRRUxDd3RLQVFGL0lBQW9BZ1FpQVVHQWdJQ0FCM0ZCZ0lDQWdBSkdCSDhnQVVHQWdJQ0FlSEZGQlVFQUN3UkFJQUFnQVVILy8vLy9lSEUyQWdRZ0FFRVFha0VGRVBrQkl3QWdBQkFOQ3d2ekFRRUdmeU1ESWdVaUFpRURJd0VoQUFOQUFrQWdBeUFBVHcwQUlBTW9BZ0FpQkNnQ0JDSUJRWUNBZ0lBSGNVR0FnSUNBQTBZRWZ5QUJRZi8vLy84QWNVRUFTd1ZCQUFzRVFDQUVFQllnQWlBRU5nSUFJQUpCQkdvaEFnVkJBQ0FCUWYvLy8vOEFjVVVnQVVHQWdJQ0FCM0ViQkVBakFDQUVFQTBGSUFRZ0FVSC8vLy8vQjNFMkFnUUxDeUFEUVFScUlRTU1BUXNMSUFJa0FTQUZJUUFEUUFKQUlBQWdBazhOQUNBQUtBSUFFQmdnQUVFRWFpRUFEQUVMQ3lBRklRQURRQUpBSUFBZ0FrOE5BQ0FBS0FJQUlnRWdBU2dDQkVILy8vLy9CM0UyQWdRZ0FSQVpJQUJCQkdvaEFBd0JDd3NnQlNRQkMxTUFRZkxseXdja1BVR2d3WUlGSkQ1QjJMRGhBaVEvUVlpUUlDUkFRZkxseXdja1FVR2d3WUlGSkVKQjJMRGhBaVJEUVlpUUlDUkVRZkxseXdja1JVR2d3WUlGSkVaQjJMRGhBaVJIUVlpUUlDUklDNVVDQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFReDFJZ0VFUUNBQlFRRkdEUUVDUUNBQlFRSnJEZ3dDQWdNREF3TUVCQVVGQmdjQUN3d0hDeU9NQWdSQUk0MENCRUFnQUVHQUFrZ05DU0FBUVlBU1NFRUFJQUJCL3dOS0d3MEpCVUVBSUFCQmdBSklJNDBDR3cwSkN3c0xJQUJCZ0szUkFHb1BDeUFBUVFFajl3RWlBRUVBSUFCRkkvOEJHeHRCRG5ScVFZQ3QwQUJxRHdzZ0FFR0FrSDVxSTQwQ0JIOGppZ0lRSFVFQmNRVkJBQXRCRFhScUR3c2dBQ1A0QVVFTmRHcEJnTm5HQUdvUEN5QUFRWUNRZm1vUEMwRUFJUUVDZnlPTkFnUkFJNHNDRUIxQkIzRWhBUXNnQVVFQlNBc0VmMEVCQlNBQkMwRU1kQ0FBYWtHQThIMXFEd3NnQUVHQVVHb1BDeUFBUVlDWjBRQnFDd2tBSUFBUUhDMEFBQXZEQVFCQkFDU09Ba0VBSkk4Q1FRQWtrQUpCQUNTUkFrRUFKSklDUVFBa2t3SkJBQ1NVQWtFQUpKVUNRUUFrbGdKQkFDU1hBa0VBSkpnQ1FRQWttUUpCQUNTYUFrRUFKSnNDUVFBa25BSkJBQ1NkQWlPTUFnUkFEd3NqalFJRVFFRVJKSThDUVlBQkpKWUNRUUFra0FKQkFDU1JBa0gvQVNTU0FrSFdBQ1NUQWtFQUpKUUNRUTBrbFFJRlFRRWtqd0pCc0FFa2xnSkJBQ1NRQWtFVEpKRUNRUUFra2dKQjJBRWtrd0pCQVNTVUFrSE5BQ1NWQWd0QmdBSWttQUpCL3Y4REpKY0NDd3NBSUFBUUhDQUJPZ0FBQzNFQkFYOUJBQ1Q1QVVFQkpQb0JRY2NDRUIwaUFFVWsrd0VnQUVFRFRFRUFJQUJCQVU0YkpQd0JJQUJCQmt4QkFDQUFRUVZPR3lUOUFTQUFRUk5NUVFBZ0FFRVBUaHNrL2dFZ0FFRWVURUVBSUFCQkdVNGJKUDhCUVFFazl3RkJBQ1Q0QVNPS0FrRUFFQjhqaXdKQkFSQWZDeThBUWRIK0EwSC9BUkFmUWRMK0EwSC9BUkFmUWRQK0EwSC9BUkFmUWRUK0EwSC9BUkFmUWRYK0EwSC9BUkFmQzdBSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQUVRQ0FBUVFGR0RRRUNRQ0FBUVFKckRnc0RCQVVHQndnSkNnc01EUUFMREEwTFFmTGx5d2NrUFVHZ3dZSUZKRDVCMkxEaEFpUS9RWWlRSUNSQVFmTGx5d2NrUVVHZ3dZSUZKRUpCMkxEaEFpUkRRWWlRSUNSRVFmTGx5d2NrUlVHZ3dZSUZKRVpCMkxEaEFpUkhRWWlRSUNSSURBd0xRZi8vL3dja1BVSGoydjRISkQ1QmdPS1FCQ1EvUVFBa1FFSC8vLzhISkVGQjQ5citCeVJDUVlEaWtBUWtRMEVBSkVSQi8vLy9CeVJGUWVQYS9nY2tSa0dBNHBBRUpFZEJBQ1JJREFzTFFmLy8vd2NrUFVHRWlmNEhKRDVCdXZUUUJDUS9RUUFrUUVILy8vOEhKRUZCc2Y3dkF5UkNRWUNJQWlSRFFRQWtSRUgvLy84SEpFVkIvOHVPQXlSR1FmOEJKRWRCQUNSSURBb0xRY1hOL3dja1BVR0V1Ym9HSkQ1QnFkYVJCQ1EvUVlqaTZBSWtRRUgvLy84SEpFRkI0OXIrQnlSQ1FZRGlrQVFrUTBFQUpFUkIvLy8vQnlSRlFlUGEvZ2NrUmtHQTRwQUVKRWRCQUNSSURBa0xRZi8vL3dja1BVR0Evc3NDSkQ1QmdJVDlCeVEvUVFBa1FFSC8vLzhISkVGQmdQN0xBaVJDUVlDRS9RY2tRMEVBSkVSQi8vLy9CeVJGUVlEK3l3SWtSa0dBaFAwSEpFZEJBQ1JJREFnTFFmLy8vd2NrUFVHeC91OERKRDVCeGNjQkpEOUJBQ1JBUWYvLy93Y2tRVUdFaWY0SEpFSkJ1dlRRQkNSRFFRQWtSRUgvLy84SEpFVkJoSW4rQnlSR1FicjAwQVFrUjBFQUpFZ01Cd3RCQUNROVFZU0pBaVErUVlDOC93Y2tQMEgvLy84SEpFQkJBQ1JCUVlTSkFpUkNRWUM4L3dja1EwSC8vLzhISkVSQkFDUkZRWVNKQWlSR1FZQzgvd2NrUjBILy8vOEhKRWdNQmd0QnBmLy9CeVE5UVpTcC9nY2tQa0gvcWRJRUpEOUJBQ1JBUWFYLy93Y2tRVUdVcWY0SEpFSkIvNm5TQkNSRFFRQWtSRUdsLy84SEpFVkJsS24rQnlSR1FmK3AwZ1FrUjBFQUpFZ01CUXRCLy8vL0J5UTlRWUQrL3dja1BrR0FnUHdISkQ5QkFDUkFRZi8vL3dja1FVR0EvdjhISkVKQmdJRDhCeVJEUVFBa1JFSC8vLzhISkVWQmdQNy9CeVJHUVlDQS9BY2tSMEVBSkVnTUJBdEIvLy8vQnlROVFZRCsvd2NrUGtHQWxPMERKRDlCQUNSQVFmLy8vd2NrUVVIL3k0NERKRUpCL3dFa1EwRUFKRVJCLy8vL0J5UkZRYkgrN3dNa1JrR0FpQUlrUjBFQUpFZ01Bd3RCLy8vL0J5UTlRZi9MamdNa1BrSC9BU1EvUVFBa1FFSC8vLzhISkVGQmhJbitCeVJDUWJyMDBBUWtRMEVBSkVSQi8vLy9CeVJGUWJIKzd3TWtSa0dBaUFJa1IwRUFKRWdNQWd0Qi8vLy9CeVE5UWQ2WnNnUWtQa0dNcGNrQ0pEOUJBQ1JBUWYvLy93Y2tRVUdFaWY0SEpFSkJ1dlRRQkNSRFFRQWtSRUgvLy84SEpFVkI0OXIrQnlSR1FZRGlrQVFrUjBFQUpFZ01BUXRCLy8vL0J5UTlRYVhMbGdVa1BrSFNwTWtDSkQ5QkFDUkFRZi8vL3dja1FVR2x5NVlGSkVKQjBxVEpBaVJEUVFBa1JFSC8vLzhISkVWQnBjdVdCU1JHUWRLa3lRSWtSMEVBSkVnTEM5b0lBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRWWdCUndSQUlBQkI0UUJHRFFFZ0FFRVVSZzBDSUFCQnhnQkdEUU1nQUVIWkFFWU5CQ0FBUWNZQlJnMEVJQUJCaGdGR0RRVWdBRUdvQVVZTkJTQUFRYjhCUmcwR0lBQkJ6Z0ZHRFFZZ0FFSFJBVVlOQmlBQVFmQUJSZzBHSUFCQkowWU5CeUFBUWNrQVJnMEhJQUJCM0FCR0RRY2dBRUd6QVVZTkJ5QUFRY2tCUmcwSUlBQkI4QUJHRFFrZ0FFSEdBRVlOQ2lBQVFkTUJSZzBMREF3TFFmKzVsZ1VrUFVHQS92OEhKRDVCZ01ZQkpEOUJBQ1JBUWYrNWxnVWtRVUdBL3Y4SEpFSkJnTVlCSkVOQkFDUkVRZis1bGdVa1JVR0EvdjhISkVaQmdNWUJKRWRCQUNSSURBc0xRZi8vL3dja1BVSC95NDRESkQ1Qi93RWtQMEVBSkVCQi8vLy9CeVJCUVlTSi9nY2tRa0c2OU5BRUpFTkJBQ1JFUWYvLy93Y2tSVUgveTQ0REpFWkIvd0VrUjBFQUpFZ01DZ3RCLy8vL0J5UTlRWVNKL2dja1BrRzY5TkFFSkQ5QkFDUkFRZi8vL3dja1FVR3gvdThESkVKQmdJZ0NKRU5CQUNSRVFmLy8vd2NrUlVHRWlmNEhKRVpCdXZUUUJDUkhRUUFrU0F3SkMwSC82OVlGSkQxQmxQLy9CeVErUWNLMHRRVWtQMEVBSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQmhJbitCeVJIUWJyMDBBUWtTQXdJQzBILy8vOEhKRDFCaE51MkJTUStRZnZtaVFJa1AwRUFKRUJCLy8vL0J5UkJRWURtL1Fja1FrR0FoTkVFSkVOQkFDUkVRZi8vL3dja1JVSC8rK29DSkVaQmdJRDhCeVJIUWY4QkpFZ01Cd3RCblAvL0J5UTlRZi9yMGdRa1BrSHpxSTRESkQ5QnV2UUFKRUJCd29yL0J5UkJRWUNzL3dja1FrR0E5TkFFSkVOQmdJQ29BaVJFUWYvLy93Y2tSVUdFaWY0SEpFWkJ1dlRRQkNSSFFRQWtTQXdHQzBHQS9xOERKRDFCLy8vL0J5UStRY3FrL1Fja1AwRUFKRUJCLy8vL0J5UkJRZi8vL3dja1FrSC95NDRESkVOQi93RWtSRUgvLy84SEpFVkI0OXIrQnlSR1FZRGlrQVFrUjBFQUpFZ01CUXRCLzdtV0JTUTlRWUQrL3dja1BrR0F4Z0VrUDBFQUpFQkIwc2I5QnlSQlFZQ0EyQVlrUWtHQWdJd0RKRU5CQUNSRVFmOEJKRVZCLy8vL0J5UkdRZnYrL3dja1IwSC9pUUlrU0F3RUMwSE8vLzhISkQxQjc5K1BBeVErUWJHSThnUWtQMEhhdE9rQ0pFQkIvLy8vQnlSQlFZRG0vUWNrUWtHQWhORUVKRU5CQUNSRVFmLy8vd2NrUlVIL3k0NERKRVpCL3dFa1IwRUFKRWdNQXd0Qi8vLy9CeVE5UVlTSi9nY2tQa0c2OU5BRUpEOUJBQ1JBUWYvLy93Y2tRVUdBL2dNa1FrR0FpTVlCSkVOQmdKUUJKRVJCLy8vL0J5UkZRZi9MamdNa1JrSC9BU1JIUVFBa1NBd0NDMEgvLy84SEpEMUIvOHVPQXlRK1FmOEJKRDlCQUNSQVFZRCsvd2NrUVVHQWdQd0hKRUpCZ0lDTUF5UkRRUUFrUkVILy8vOEhKRVZCc2Y3dkF5UkdRWUNJQWlSSFFRQWtTQXdCQzBILy8vOEhKRDFCaE51MkJTUStRZnZtaVFJa1AwRUFKRUJCLy8vL0J5UkJRZVBhL2dja1FrSGoydjRISkVOQkFDUkVRZi8vL3dja1JVSC95NDRESkVaQi93RWtSMEVBSkVnTEMwb0JBbjlCQUJBaUk0MENCRUFQQ3lPTUFnUkFJNDBDUlFSQUR3c0xRYlFDSVFBRFFBSkFJQUJCd3dKS0RRQWdBQkFkSUFGcUlRRWdBRUVCYWlFQURBRUxDeUFCUWY4QmNSQWpDOXdCQUVFQUpQQUJRUUFrOFFGQkFDVHlBVUVBSlBNQlFRQWs5QUZCQUNUMUFVRUFKUFlCUVpBQkpQSUJJNDBDQkVCQndmNERRWUVCRUI5QnhQNERRWkFCRUI5QngvNERRZndCRUI4RlFjSCtBMEdGQVJBZlFjYitBMEgvQVJBZlFjZitBMEg4QVJBZlFjaitBMEgvQVJBZlFjbitBMEgvQVJBZkMwR1FBU1R5QVVIQS9nTkJrQUVRSDBIUC9nTkJBQkFmUWZEK0EwRUJFQjhqakFJRVFDT05BZ1JBUVFBazhnRkJ3UDREUVFBUUgwSEIvZ05CZ0FFUUgwSEUvZ05CQUJBZkJVRUFKUElCUWNEK0EwRUFFQjlCd2Y0RFFZUUJFQjhMQ3hBa0MyMEFJNDBDQkVCQjZQNERRY0FCRUI5QjZmNERRZjhCRUI5QjZ2NERRY0VCRUI5QjYvNERRUTBRSHdWQjZQNERRZjhCRUI5QjZmNERRZjhCRUI5QjZ2NERRZjhCRUI5QjYvNERRZjhCRUI4TEk0MENRUUFqakFJYkJFQkI2ZjREUVNBUUgwSHIvZ05CaWdFUUh3c0xWZ0JCa1A0RFFZQUJFQjlCa2Y0RFFiOEJFQjlCa3Y0RFFmTUJFQjlCay80RFFjRUJFQjlCbFA0RFFiOEJFQjhqakFJRVFFR1IvZ05CUHhBZlFaTCtBMEVBRUI5QmsvNERRUUFRSDBHVS9nTkJ1QUVRSHdzTExBQkJsZjREUWY4QkVCOUJsdjREUVQ4UUgwR1gvZ05CQUJBZlFaaitBMEVBRUI5Qm1mNERRYmdCRUI4TE13QkJtdjREUWY4QUVCOUJtLzREUWY4QkVCOUJuUDREUVo4QkVCOUJuZjREUVFBUUgwR2UvZ05CdUFFUUgwRUJKSWtCQ3kwQVFaLytBMEgvQVJBZlFhRCtBMEgvQVJBZlFhSCtBMEVBRUI5Qm92NERRUUFRSDBHai9nTkJ2d0VRSHd0Y0FDQUFRWUFCY1VFQVJ5U3dBU0FBUWNBQWNVRUFSeVN2QVNBQVFTQnhRUUJISks0QklBQkJFSEZCQUVja3JRRWdBRUVJY1VFQVJ5UzBBU0FBUVFSeFFRQkhKTE1CSUFCQkFuRkJBRWNrc2dFZ0FFRUJjVUVBUnlTeEFRdEZBRUVQSkowQlFROGtuZ0ZCRHlTZkFVRVBKS0FCUVFBa29RRkJBQ1NpQVVFQUpLTUJRUUFrcEFGQi93QWtwUUZCL3dBa3BnRkJBU1NuQVVFQkpLZ0JRUUFrcVFFTHZRRUFRUUFrcWdGQkFDU3JBVUVBSkt3QlFRRWtyUUZCQVNTdUFVRUJKSzhCUVFFa3NBRkJBU1N4QVVFQkpMSUJRUUVrc3dGQkFTUzBBVUVCSkxVQlFRQWt0Z0ZCQUNTM0FVRUFKTGtCUVFBa3VnRVFKeEFvRUNrUUtrR2svZ05COXdBUUgwRUhKS3NCUVFja3JBRkJwZjREUWZNQkVCOUI4d0VRSzBHbS9nTkI4UUVRSDBFQkpMVUJJNHdDQkVCQnBQNERRUUFRSDBFQUpLc0JRUUFrckFGQnBmNERRUUFRSDBFQUVDdEJwdjREUWZBQUVCOUJBQ1MxQVFzUUxBcytBQ0FBUVFGeFFRQkhKTDhCSUFCQkFuRkJBRWNrd0FFZ0FFRUVjVUVBUnlUQkFTQUFRUWh4UVFCSEpNSUJJQUJCRUhGQkFFY2t3d0VnQUNTK0FRcytBQ0FBUVFGeFFRQkhKTVVCSUFCQkFuRkJBRWNreGdFZ0FFRUVjVUVBUnlUSEFTQUFRUWh4UVFCSEpNZ0JJQUJCRUhGQkFFY2t5UUVnQUNURUFRdDRBRUVBSk1vQlFRQWt5d0ZCQUNUTUFVRUFKTThCUVFBazBBRkJBQ1RSQVVFQUpNMEJRUUFremdFampRSUVRRUdFL2dOQkhoQWZRYUE5Sk1zQkJVR0UvZ05CcXdFUUgwSE0xd0lreXdFTFFZZitBMEg0QVJBZlFmZ0JKTkVCSTR3Q0JFQWpqUUpGQkVCQmhQNERRUUFRSDBFRUpNc0JDd3NMUXdCQkFDVFNBVUVBSk5NQkk0MENCRUJCZ3Y0RFFmd0FFQjlCQUNUVUFVRUFKTlVCUVFBazFnRUZRWUwrQTBIK0FCQWZRUUFrMUFGQkFTVFZBVUVBSk5ZQkN3dDFBQ09OQWdSQVFmRCtBMEg0QVJBZlFjLytBMEgrQVJBZlFjMytBMEgrQUJBZlFZRCtBMEhQQVJBZlFZLytBMEhoQVJBZlFleitBMEgrQVJBZlFmWCtBMEdQQVJBZkJVSHcvZ05CL3dFUUgwSFAvZ05CL3dFUUgwSE4vZ05CL3dFUUgwR0EvZ05CendFUUgwR1AvZ05CNFFFUUh3c0xsZ0VCQVg5Qnd3SVFIU0lBUWNBQlJnUi9RUUVGSUFCQmdBRkdRUUFqTkJzTEJFQkJBU1NOQWdWQkFDU05BZ3RCQUNTbkFrR0FxTmE1QnlTZUFrRUFKSjhDUVFBa29BSkJnS2pXdVFja29RSkJBQ1NpQWtFQUpLTUNJek1FUUVFQkpJd0NCVUVBSkl3Q0N4QWVFQ0FRSVJBbEVDWVFMVUVBRUM1Qi8vOERJNzRCRUI5QjRRRVFMMEdQL2dNanhBRVFIeEF3RURFUU1ndEtBQ0FBUVFCS0pETWdBVUVBU2lRMElBSkJBRW9rTlNBRFFRQktKRFlnQkVFQVNpUTNJQVZCQUVva09DQUdRUUJLSkRrZ0IwRUFTaVE2SUFoQkFFb2tPeUFKUVFCS0pEd1FNd3NGQUNPbkFndTVBUUJCZ0Fnamp3STZBQUJCZ1FnamtBSTZBQUJCZ2dnamtRSTZBQUJCZ3dnamtnSTZBQUJCaEFnamt3STZBQUJCaFFnamxBSTZBQUJCaGdnamxRSTZBQUJCaHdnamxnSTZBQUJCaUFnamx3STdBUUJCaWdnam1BSTdBUUJCakFnam1RSTJBZ0JCa1Fnam1nSkJBRWM2QUFCQmtnZ2ptd0pCQUVjNkFBQkJrd2dqbkFKQkFFYzZBQUJCbEFnam5RSkJBRWM2QUFCQmxRZ2pqQUpCQUVjNkFBQkJsZ2dqalFKQkFFYzZBQUJCbHdnampnSkJBRWM2QUFBTGFBQkJ5QWtqOXdFN0FRQkJ5Z2tqK0FFN0FRQkJ6QWtqK1FGQkFFYzZBQUJCelFraitnRkJBRWM2QUFCQnpna2ord0ZCQUVjNkFBQkJ6d2tqL0FGQkFFYzZBQUJCMEFrai9RRkJBRWM2QUFCQjBRa2ovZ0ZCQUVjNkFBQkIwZ2tqL3dGQkFFYzZBQUFMTlFCQitna2p5Z0UyQWdCQi9na2p5d0UyQWdCQmdnb2p6UUZCQUVjNkFBQkJoUW9qemdGQkFFYzZBQUJCaGY0REk4d0JFQjhMV0FCQjNnb2pXMEVBUnpvQUFFSGZDaU5lTmdJQVFlTUtJMTgyQWdCQjV3b2pZRFlDQUVIc0NpTmhOZ0lBUWZFS0kySTZBQUJCOGdvall6b0FBRUgzQ2lOa1FRQkhPZ0FBUWZnS0kyVTJBZ0JCL1Fvalpqc0JBQXM5QUVHUUN5TnlRUUJIT2dBQVFaRUxJM1UyQWdCQmxRc2pkallDQUVHWkN5TjNOZ0lBUVo0TEkzZzJBZ0JCb3dzamVUb0FBRUdrQ3lONk9nQUFDenNBUWZRTEk1VUJRUUJIT2dBQVFmVUxJNWNCTmdJQVFma0xJNWdCTmdJQVFmMExJNWtCTmdJQVFZSU1JNW9CTmdJQVFZY01JNXdCT3dFQUM0Z0JBQkEyUWJJSUkvRUJOZ0lBUWJZSUkrWUJPZ0FBUWNUK0F5UHlBUkFmUWVRSUk3d0JRUUJIT2dBQVFlVUlJNzBCUVFCSE9nQUFFRGNRT0VHc0NpTzJBVFlDQUVHd0NpTzNBVG9BQUVHeENpTzVBVG9BQUJBNUVEcEJ3Z3NqZ2dGQkFFYzZBQUJCd3dzamhRRTJBZ0JCeHdzamhnRTJBZ0JCeXdzamh3RTdBUUFRTzBFQUpLY0NDN2tCQUVHQUNDMEFBQ1NQQWtHQkNDMEFBQ1NRQWtHQ0NDMEFBQ1NSQWtHRENDMEFBQ1NTQWtHRUNDMEFBQ1NUQWtHRkNDMEFBQ1NVQWtHR0NDMEFBQ1NWQWtHSENDMEFBQ1NXQWtHSUNDOEJBQ1NYQWtHS0NDOEJBQ1NZQWtHTUNDZ0NBQ1NaQWtHUkNDMEFBRUVBU2lTYUFrR1NDQzBBQUVFQVNpU2JBa0dUQ0MwQUFFRUFTaVNjQWtHVUNDMEFBRUVBU2lTZEFrR1ZDQzBBQUVFQVNpU01Ba0dXQ0MwQUFFRUFTaVNOQWtHWENDMEFBRUVBU2lTT0FndGVBUUYvUVFBazhRRkJBQ1R5QVVIRS9nTkJBQkFmUWNIK0F4QWRRWHh4SVFGQkFDVG1BVUhCL2dNZ0FSQWZJQUFFUUFKQVFRQWhBQU5BSUFCQmdOZ0ZUZzBCSUFCQmdNa0Zha0gvQVRvQUFDQUFRUUZxSVFBTUFBQUxBQXNMQzRJQkFRRi9JK2dCSVFFZ0FFR0FBWEZCQUVjazZBRWdBRUhBQUhGQkFFY2s2UUVnQUVFZ2NVRUFSeVRxQVNBQVFSQnhRUUJISk9zQklBQkJDSEZCQUVjazdBRWdBRUVFY1VFQVJ5VHRBU0FBUVFKeFFRQkhKTzRCSUFCQkFYRkJBRWNrN3dFajZBRkZRUUFnQVJzRVFFRUJFRDRMUVFBajZBRWdBUnNFUUVFQUVENExDeW9BUWVRSUxRQUFRUUJLSkx3QlFlVUlMUUFBUVFCS0pMMEJRZi8vQXhBZEVDNUJqLzRERUIwUUx3dG9BRUhJQ1M4QkFDVDNBVUhLQ1M4QkFDVDRBVUhNQ1MwQUFFRUFTaVQ1QVVITkNTMEFBRUVBU2lUNkFVSE9DUzBBQUVFQVNpVDdBVUhQQ1MwQUFFRUFTaVQ4QVVIUUNTMEFBRUVBU2lUOUFVSFJDUzBBQUVFQVNpVCtBVUhTQ1MwQUFFRUFTaVQvQVF0SEFFSDZDU2dDQUNUS0FVSCtDU2dDQUNUTEFVR0NDaTBBQUVFQVNpVE5BVUdGQ2kwQUFFRUFTaVRPQVVHRi9nTVFIU1RNQVVHRy9nTVFIU1RQQVVHSC9nTVFIU1RSQVFzSEFFRUFKTG9CQzFnQVFkNEtJMXRCQUVjNkFBQkIzd29vQWdBa1hrSGpDaWdDQUNSZlFlY0tLQUlBSkdCQjdBb29BZ0FrWVVIeENpMEFBQ1JpUWZJS0xRQUFKR05COXdvdEFBQkJBRW9rWkVINENpZ0NBQ1JsUWYwS0x3RUFKR1lMUFFCQmtBc3RBQUJCQUVva2NrR1JDeWdDQUNSMVFaVUxLQUlBSkhaQm1Rc29BZ0FrZDBHZUN5Z0NBQ1I0UWFNTExRQUFKSGxCcEFzdEFBQWtlZ3M3QUVIMEN5MEFBRUVBU2lTVkFVSDFDeWdDQUNTWEFVSDVDeWdDQUNTWUFVSDlDeWdDQUNTWkFVR0NEQ2dDQUNTYUFVR0hEQzhCQUNTY0FRdk5BUUVCZnhBOVFiSUlLQUlBSlBFQlFiWUlMUUFBSk9ZQlFjVCtBeEFkSlBJQlFjRCtBeEFkRUQ4UVFFR0EvZ01RSFVIL0FYTWszd0VqM3dFaUFFRVFjVUVBUnlUZ0FTQUFRU0J4UVFCSEpPRUJFRUVRUWtHc0NpZ0NBQ1MyQVVHd0NpMEFBQ1MzQVVHeENpMEFBQ1M1QVVFQUpMb0JFRVFRUlVIQ0N5MEFBRUVBU2lTQ0FVSERDeWdDQUNTRkFVSEhDeWdDQUNTR0FVSExDeThCQUNTSEFSQkdRUUFrcHdKQmdLald1UWNrbmdKQkFDU2ZBa0VBSktBQ1FZQ28xcmtISktFQ1FRQWtvZ0pCQUNTakFnc0ZBQ09OQWdzRkFDT2hBZ3NGQUNPaUFnc0ZBQ09qQWd1eUFnRUdmeU5OSWdVZ0FFWkJBQ05NSUFSR1FRQWdBRUVJU2tFQUlBRkJBRW9iR3hzRVFDQURRUUZyRUIxQklIRkJBRWNoQ0NBREVCMUJJSEZCQUVjaENVRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQWdnQ1VjYklnY2dBR29pQTBHZ0FVd0VRQ0FCUWFBQmJDQURha0VEYkVHQXlRVnFJZ1F0QUFBaENpQUVJQW82QUFBZ0FVR2dBV3dnQTJwQkEyeEJnY2tGYWlBRUxRQUJPZ0FBSUFGQm9BRnNJQU5xUVFOc1FZTEpCV29nQkMwQUFqb0FBQ0FCUWFBQmJDQURha0dBa1FScUlBQkJBQ0FIYTJzZ0FVR2dBV3hxUWZpUUJHb3RBQUFpQTBFRGNTSUVRUVJ5SUFRZ0EwRUVjUnM2QUFBZ0JrRUJhaUVHQ3lBSFFRRnFJUU1NQVFzTEJTQUVKRXdMSUFBZ0JVNEVRQ0FBUVFocUlnRWdBa0VIY1NJQ2FpQUJJQUFnQWtnYklRVUxJQVVrVFNBR0N5a0FJQUJCZ0pBQ1JnUkFJQUZCZ0FGcklBRkJnQUZxSUFGQmdBRnhHeUVCQ3lBQlFRUjBJQUJxQzBvQUlBQkJBM1FnQVVFQmRHb2lBRUVCYWtFL2NTSUJRVUJySUFFZ0FodEJnSkFFYWkwQUFDRUJJQUJCUDNFaUFFRkFheUFBSUFJYlFZQ1FCR290QUFBZ0FVSC9BWEZCQ0hSeUM4Z0JBQ0FCRUIwZ0FFRUJkSFZCQTNFaEFDQUJRY2orQTBZRVFDTkJJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalFpRUJEQUlMSTBNaEFRd0JDeU5FSVFFTEJTQUJRY24rQTBZRVFDTkZJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalJpRUJEQUlMSTBjaEFRd0JDeU5JSVFFTEJTTTlJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalBpRUJEQUlMSXo4aEFRd0JDeU5BSVFFTEN3c2dBUXVQQXdFR2Z5QUJJQUFRVFNBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnNGdDRWdFUUVFQUlRVUNmMEVCUVFjZ0FHc2dBRUVCSUF0QklIRkZJQXRCQUVnYkd5SUJkQ0FTY1FSQVFRSWhCUXNnQlVFQmFnc2dCVUVCSUFGMElCRnhHeUVDSTQwQ0JIOUJBU0FNUVFCT0lBdEJBRTRiQlVFQUN3Ui9JQXRCQjNFaEFTQU1RUUJPSWdVRVFDQU1RUWR4SVFFTElBRWdBaUFGRUU0aUJVRWZjVUVEZENFQklBVkI0QWR4UVFWMVFRTjBJUThnQlVHQStBRnhRUXAxUVFOMEJTQUNRY2YrQXlBS0lBcEJBRXdiSWdvUVR5SUZRWUNBL0FkeFFSQjFJUUVnQlVHQS9nTnhRUWgxSVE4Z0JVSC9BWEVMSVFVZ0J5QUliQ0FPYWtFRGJDQUphaUlRSUFFNkFBQWdFRUVCYWlBUE9nQUFJQkJCQW1vZ0JUb0FBQ0FIUWFBQmJDQU9ha0dBa1FScUlBSkJBM0VpQVVFRWNpQUJJQXRCZ0FGeFFRQkhRUUFnQzBFQVRoc2JPZ0FBSUExQkFXb2hEUXNnQUVFQmFpRUFEQUVMQ3lBTkMzNEJBMzhnQTBFSGNTRURRUUFnQWlBQ1FRTjFRUU4wYXlBQUd5RUhRYUFCSUFCclFRY2dBRUVJYWtHZ0FVb2JJUWhCZnlFQ0k0MENCRUFnQkVHQTBINXFMUUFBSWdKQkNIRkJBRWNoQ1NBQ1FjQUFjUVJBUVFjZ0Eyc2hBd3NMSUFZZ0JTQUpJQWNnQ0NBRElBQWdBVUdnQVVHQXlRVkJBQ0FDUVg4UVVBdWhBZ0VCZnlBRFFRZHhJUU1nQlNBR0VFMGdCRUdBMEg1cUxRQUFJZ1JCd0FCeEJIOUJCeUFEYXdVZ0F3dEJBWFJxSWdWQmdKQithaUFFUVFoeFFRQkhJZ1pCRFhScUxRQUFJUWNnQWtFSGNTRURRUUFoQWlBQlFhQUJiQ0FBYWtFRGJFR0F5UVZxSUFSQkIzRUNmeUFGUVlHUWZtb2dCa0VCY1VFTmRHb3RBQUJCQVNBRFFRY2dBMnNnQkVFZ2NSc2lBM1J4QkVCQkFpRUNDeUFDUVFGcUN5QUNRUUVnQTNRZ0IzRWJJZ05CQUJCT0lnSkJIM0ZCQTNRNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ2NrRmFpQUNRZUFIY1VFRmRVRURkRG9BQUNBQlFhQUJiQ0FBYWtFRGJFR0N5UVZxSUFKQmdQZ0JjVUVLZFVFRGREb0FBQ0FCUWFBQmJDQUFha0dBa1FScUlBTkJBM0VpQUVFRWNpQUFJQVJCZ0FGeEd6b0FBQXZFQVFBZ0JDQUZFRTBnQTBFSGNVRUJkR29pQkVHQWtINXFMUUFBSVFWQkFDRURJQUZCb0FGc0lBQnFRUU5zUVlESkJXb0NmeUFFUVlHUWZtb3RBQUJCQVVFSElBSkJCM0ZySWdKMGNRUkFRUUloQXdzZ0EwRUJhZ3NnQTBFQklBSjBJQVZ4R3lJRFFjZitBeEJQSWdKQmdJRDhCM0ZCRUhVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ2NrRmFpQUNRWUQrQTNGQkNIVTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdza0ZhaUFDT2dBQUlBRkJvQUZzSUFCcVFZQ1JCR29nQTBFRGNUb0FBQXZVQVFFR2Z5QURRUU4xSVFvRFFDQUVRYUFCU0FSQUlBUWdCV29pQmtHQUFrNEVRQ0FHUVlBQ2F5RUdDeUFLUVFWMElBSnFJQVpCQTNWcUlnaEJnSkIrYWkwQUFDRUhRUUFoQ1NNN0JFQWdCQ0FBSUFZZ0NDQUhFRXdpQzBFQVNnUkFRUUVoQ1NBTFFRRnJJQVJxSVFRTEN5QUpSVUVBSXpvYkJFQWdCQ0FBSUFZZ0F5QUlJQUVnQnhCUklnWkJBRW9FUUNBR1FRRnJJQVJxSVFRTEJTQUpSUVJBSTQwQ0JFQWdCQ0FBSUFZZ0F5QUlJQUVnQnhCU0JTQUVJQUFnQmlBRElBRWdCeEJUQ3dzTElBUkJBV29oQkF3QkN3c0xNZ0VEZnlQMUFTRURJQUFqOWdFaUJFZ0VRQThMUVFBZ0EwRUhheUlEYXlFRklBQWdBU0FDSUFBZ0JHc2dBeUFGRUZRTG93VUJEMzhDUUVFbklRWURRQ0FHUVFCSURRRWdCa0VDZENJRlFZRDhBMm9pQXhBZElRSWdBMEVCYWhBZElRY2dBMEVDYWhBZElRTWdBa0VRYXlFRUlBZEJDR3NoQzBFSUlRSWdBUVJBUVJBaEFpQURJQU5CQVhGcklRTUxJQUFnQWlBRWFraEJBQ0FBSUFST0d3UkFJQVZCZy93RGFoQWRJZ1ZCZ0FGeFFRQkhJUXdnQlVFZ2NVRUFSeUVOUVlDQUFpQURFRTBnQWlBQUlBUnJJZ05yUVFGcklBTWdCVUhBQUhFYlFRRjBhaUlEUVlDUWZtb2dCVUVJY1VFQVJ5T05BaUlDSUFJYlFRRnhRUTEwSWdKcUxRQUFJUTRnQTBHQmtINXFJQUpxTFFBQUlROUJCeUVEQTBBZ0EwRUFUZ1JBUVFBaEFnSi9RUUZCQUNBRFFRZHJheUFESUEwYklnUjBJQTl4QkVCQkFpRUNDeUFDUVFGcUN5QUNRUUVnQkhRZ0RuRWJJZ1FFUUVFSElBTnJJQXRxSWdKQkFFNEVmeUFDUWFBQlRBVkJBQXNFUUVFQUlRZEJBQ0VLSSs4QlJTT05BaUlJSUFnYklnaEZCRUFnQUVHZ0FXd2dBbXBCZ0pFRWFpMEFBQ0lKSVJBZ0NVRURjU0lKUVFCTFFRQWdEQnNFUUVFQklRY0ZRUUZCQUNBSlFRQkxRUUFnRUVFRWNVRUFSMEVBSTQwQ0d4c2JJUW9MQzBFQlFRQWdDa1VnQnhzZ0NCc0VRQ09OQWdSQUlBQkJvQUZzSUFKcVFRTnNRWURKQldvZ0JVRUhjU0FFUVFFUVRpSUVRUjl4UVFOME9nQUFJQUJCb0FGc0lBSnFRUU5zUVlISkJXb2dCRUhnQjNGQkJYVkJBM1E2QUFBZ0FFR2dBV3dnQW1wQkEyeEJnc2tGYWlBRVFZRDRBWEZCQ25WQkEzUTZBQUFGSUFCQm9BRnNJQUpxUVFOc1FZREpCV29nQkVISi9nTkJ5UDRESUFWQkVIRWJFRThpQkVHQWdQd0hjVUVRZFRvQUFDQUFRYUFCYkNBQ2FrRURiRUdCeVFWcUlBUkJnUDREY1VFSWRUb0FBQ0FBUWFBQmJDQUNha0VEYkVHQ3lRVnFJQVE2QUFBTEN3c0xJQU5CQVdzaEF3d0JDd3NMSUFaQkFXc2hCZ3dBQUFzQUN3dGtBUUYvUVlDQUFrR0FrQUlqNndFYklRRkJBU1B2QVNPTkFoc0VRQ0FBSUFGQmdMZ0NRWUN3QWlQc0FSc2o5QUVnQUdwQi93RnhRUUFqOHdFUVZBc2o2Z0VFUUNBQUlBRkJnTGdDUVlDd0FpUHBBUnNRVlFzajdnRUVRQ0FBSSswQkVGWUxDeVVCQVg4Q1FBTkFJQUJCa0FGS0RRRWdBRUgvQVhFUVZ5QUFRUUZxSVFBTUFBQUxBQXNMUmdFQ2Z3TkFJQUZCa0FGT1JRUkFRUUFoQUFOQUlBQkJvQUZJQkVBZ0FVR2dBV3dnQUdwQmdKRUVha0VBT2dBQUlBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBRUxDd3NiQUVHUC9nTVFIVUVCSUFCMGNpSUFKTVFCUVkvK0F5QUFFQjhMQ3dCQkFTVEdBVUVCRUZvTExnRUJmd0ovSTNjaUFFRUFTZ1IvSTNBRlFRQUxCRUFnQUVFQmF5RUFDeUFBUlFzRVFFRUFKSElMSUFBa2R3c3lBUUYvQW44amhnRWlBRUVBU2dSL0k0QUJCVUVBQ3dSQUlBQkJBV3NoQUFzZ0FFVUxCRUJCQUNTQ0FRc2dBQ1NHQVFzeUFRRi9BbjhqbVFFaUFFRUFTZ1IvSTVRQkJVRUFDd1JBSUFCQkFXc2hBQXNnQUVVTEJFQkJBQ1NWQVFzZ0FDU1pBUXRIQVFKL0lBQWtaa0dVL2dNUUhVSDRBWEVoQVVHVC9nTWdBRUgvQVhFaUFoQWZRWlQrQXlBQklBQkJDSFZCQjNFaUFISVFIeUFDSkZnZ0FDUmFJMWdqV2tFSWRISWtYUXVpQVFFQ2Z5TmtSVUVCSTFzYkJFQVBDeU5sUVFGcklnQkJBRXdFUUNOUUJFQWpVQ1JsQW44alppSUJJMUoxSVFCQkFTTlJCSDlCQVNSbklBRWdBR3NGSUFBZ0FXb0xJZ0JCL3c5S0RRQWFRUUFMQkVCQkFDUmJDeU5TUVFCS0JFQWdBQkJmQW44alppSUJJMUoxSVFCQkFTTlJCSDlCQVNSbklBRWdBR3NGSUFBZ0FXb0xRZjhQU2cwQUdrRUFDd1JBUVFBa1d3c0xCVUVJSkdVTEJTQUFKR1VMQzBjQkFuOGpYMEVCYXlJQlFRQk1CRUFqVnlJQkJFQWpZU0VBSUFCQkQwaEJBQ05XR3dSL0lBQkJBV29GSUFCQkFXc2dBRUVBSUFCQkFFb2pWaHNiQ3lSaEN3c2dBU1JmQzBjQkFuOGpka0VCYXlJQlFRQk1CRUFqYmlJQkJFQWplQ0VBSUFCQkQwaEJBQ050R3dSL0lBQkJBV29GSUFCQkFXc2dBRUVBSUFCQkFFb2piUnNiQ3lSNEN3c2dBU1IyQzA0QkFuOGptQUZCQVdzaUFVRUFUQVJBSTVBQklnRUVRQ09hQVNFQUlBQkJEMGhCQUNPUEFSc0VmeUFBUVFGcUJTQUFRUUZySUFCQkFDQUFRUUJLSTQ4Qkd4c0xKSm9CQ3dzZ0FTU1lBUXVwQWdFQ2YwR0F3QUFqamdKMElnRWhBaU8yQVNBQWFpSUFJQUZPQkVBZ0FDQUNheVMyQVFKQUFrQUNRQUpBQWtBanVRRkJBV3BCQjNFaUFBUkFJQUJCQWtZTkFRSkFJQUJCQkdzT0JBTUFCQVVBQ3d3RkN5TmdJZ0ZCQUVvRWZ5TlpCVUVBQ3dSQUlBRkJBV3NpQVVVRVFFRUFKRnNMQ3lBQkpHQVFYQkJkRUY0TUJBc2pZQ0lCUVFCS0JIOGpXUVZCQUFzRVFDQUJRUUZySWdGRkJFQkJBQ1JiQ3dzZ0FTUmdFRndRWFJCZUVHQU1Bd3NqWUNJQlFRQktCSDhqV1FWQkFBc0VRQ0FCUVFGcklnRkZCRUJCQUNSYkN3c2dBU1JnRUZ3UVhSQmVEQUlMSTJBaUFVRUFTZ1IvSTFrRlFRQUxCRUFnQVVFQmF5SUJSUVJBUVFBa1d3c0xJQUVrWUJCY0VGMFFYaEJnREFFTEVHRVFZaEJqQ3lBQUpMa0JRUUVQQlNBQUpMWUJDMEVBQzNRQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBQ1FDQUFRUUpyRGdNQ0F3UUFDd3dFQ3lOY0lnQWpvUUZISVFFZ0FDU2hBU0FCRHdzamN5SUFJNklCUnlFQklBQWtvZ0VnQVE4TEk0TUJJZ0Fqb3dGSElRRWdBQ1NqQVNBQkR3c2psZ0VpQUNPa0FVY2hBU0FBSktRQklBRVBDMEVBQzFVQUFrQUNRQUpBSUFCQkFVY0VRQ0FBUVFKR0RRRWdBRUVEUmcwQ0RBTUxRUUVnQVhSQmdRRnhRUUJIRHd0QkFTQUJkRUdIQVhGQkFFY1BDMEVCSUFGMFFmNEFjVUVBUnc4TFFRRWdBWFJCQVhGQkFFY0xjQUVCZnlOZUlBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBalhXdEJBblFpQVVFQ2RDQUJJNDRDR3lSZUkxNGdBRUVmZFNJQklBQWdBV3B6YXlFQUkyTkJBV3BCQjNFa1l3d0JDd3NnQUNSZUkxeEJBQ05iR3dSL0kyRUZRUThQQ3lOVEkyTVFaZ1IvUVFFRlFYOExiRUVQYWd0cEFRRi9JM1VnQUdzaEFBTkFJQUJCQUV3RVFFR0FFQ04wYTBFQ2RDT09BblFrZFNOMUlBQkJIM1VpQVNBQUlBRnFjMnNoQUNONlFRRnFRUWR4SkhvTUFRc0xJQUFrZFNOelFRQWpjaHNFZnlONEJVRVBEd3NqYWlONkVHWUVmMEVCQlVGL0MyeEJEMm9MRHdBamh3RkJBWFZCc1A0RGFoQWRDeXNCQVg4amh3RkJBV29oQUFOQUlBQkJJRWhGQkVBZ0FFRWdheUVBREFFTEN5QUFKSWNCRUdra2lnRUw1d0VCQTM4amd3RkZRUUVqZ2dFYkJFQkJEdzhMSTRnQklRSWppUUVFUUVHYy9nTVFIVUVGZFVFUGNTSUNKSWdCUVFBa2lRRUxJNG9CSTRjQlFRRnhSVUVDZEhWQkQzRWhBUUpBQWtBQ1FBSkFJQUlFUUNBQ1FRRkdEUUVnQWtFQ1JnMENEQU1MSUFGQkJIVWhBUXdEQzBFQklRTU1BZ3NnQVVFQmRTRUJRUUloQXd3QkN5QUJRUUoxSVFGQkJDRURDeUFEUVFCS0JIOGdBU0FEYlFWQkFBdEJEMm9oQVNPRkFTQUFheUVBQTBBZ0FFRUFUQVJBUVlBUUk0UUJhMEVCZENPT0FuUWtoUUVqaFFFZ0FFRWZkU0lDSUFBZ0FtcHpheUVBRUdvTUFRc0xJQUFraFFFZ0FRdU1BUUVDZnlPWEFTQUFheUlBUVFCTUJFQWptd0Vqa1FGMEk0NENkQ0FBUVI5MUlnRWdBQ0FCYW5OcklRQWpuQUVpQVVFQmRTSUNJQUZCQVhFZ0FrRUJjWE1pQVVFT2RISWlBa0cvZjNFZ0FVRUdkSElnQWlPU0FSc2tuQUVMUVFBZ0FDQUFRUUJJR3lTWEFTT1dBVUVBSTVVQkd3Ui9JNW9CQlVFUER3dEJmMEVCSTV3QlFRRnhHMnhCRDJvTE1BQWdBRUU4UmdSQVFmOEFEd3NnQUVFOGEwR2dqUVpzSUFGc1FRTjFRYUNOQm0xQlBHcEJvSTBHYkVHTThRSnRDNWNCQVFGL1FRQWtwd0VnQUVFUEk2MEJHeUFCUVE4anJnRWJhaUFDUVE4anJ3RWJhaUFEUVE4anNBRWJhaUVFSUFCQkR5T3hBUnNnQVVFUEk3SUJHMm9oQUNBQUlBSkJEeU96QVJ0cUlRRWdBMEVQSTdRQkd5RURRUUFrcUFGQkFDU3BBU0FFSTZzQlFRRnFFRzBoQUNBQklBTnFJNndCUVFGcUVHMGhBU0FBSktVQklBRWtwZ0VnQVVIL0FYRWdBRUgvQVhGQkNIUnlDNE1EQVFWL0kwNGdBR29pQWlST0kxNGdBbXRCQUV3aUFrVUVRRUVCRUdVaEFnc2phQ0FBYWlJQkpHZ2pkU0FCYTBFQVRDSUJSUVJBUVFJUVpTRUJDeU43SUFCcUpIdEJBQ09GQVNON2EwRUFTaU9KQVJ0RklnUkZCRUJCQXhCbElRUUxJNHNCSUFCcUpJc0JJNWNCSTRzQmEwRUFUQ0lGUlFSQVFRUVFaU0VGQ3lBQ0JFQWpUaUVEUVFBa1RpQURFR2NrblFFTElBRUVRQ05vSVFOQkFDUm9JQU1RYUNTZUFRc2dCQVJBSTNzaEEwRUFKSHNnQXhCckpKOEJDeUFGQkVBaml3RWhBMEVBSklzQklBTVFiQ1NnQVF0QkFTQUZRUUVnQkVFQklBRWdBaHNiR3dSQVFRRWtxUUVMUVlDQWdBSWpqZ0owSTdnQmJTSUNJUUVqdHdFZ0FHb2lBQ0FDVGdSQUlBQWdBV3NoQUVFQkk2Z0JRUUVqcHdFanFRRWJHd1JBSTUwQkk1NEJJNThCSTZBQkVHNGFCU0FBSkxjQkN5TzZBU0lDUVFGMFFZQ1p3UUJxSWdFanBRRkJBbW82QUFBZ0FVRUJhaU9tQVVFQ2Fqb0FBQ0FDUVFGcUlnRWp1d0ZCQVhWQkFXdE9CSDhnQVVFQmF3VWdBUXNrdWdFTElBQWt0d0VMcUFNQkJuOGdBQkJuSVFFZ0FCQm9JUUlnQUJCcklRUWdBQkJzSVFVZ0FTU2RBU0FDSko0QklBUWtud0VnQlNTZ0FTTzNBU0FBYWlJQVFZQ0FnQUlqamdKMEk3Z0JiVTRFUUNBQVFZQ0FnQUlqamdKMEk3Z0JiV3NoQUNBQklBSWdCQ0FGRUc0aEF5TzZBVUVCZEVHQW1jRUFhaUlHSUFOQmdQNERjVUVJZFVFQ2Fqb0FBQ0FHUVFGcUlBTkIvd0Z4UVFKcU9nQUFJendFUUNBQlFROUJEMEVQRUc0aEFTTzZBVUVCZEVHQW1TRnFJZ01nQVVHQS9nTnhRUWgxUVFKcU9nQUFJQU5CQVdvZ0FVSC9BWEZCQW1vNkFBQkJEeUFDUVE5QkR4QnVJUUVqdWdGQkFYUkJnSmtwYWlJQ0lBRkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUZCL3dGeFFRSnFPZ0FBUVE5QkR5QUVRUThRYmlFQkk3b0JRUUYwUVlDWk1Xb2lBaUFCUVlEK0EzRkJDSFZCQW1vNkFBQWdBa0VCYWlBQlFmOEJjVUVDYWpvQUFFRVBRUTlCRHlBRkVHNGhBU082QVVFQmRFR0FtVGxxSWdJZ0FVR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBVUgvQVhGQkFtbzZBQUFMSTdvQlFRRnFJZ0VqdXdGQkFYVkJBV3RPQkg4Z0FVRUJhd1VnQVFza3VnRUxJQUFrdHdFTEhnRUJmeUFBRUdRaEFTQUJSVUVBSXprYkJFQWdBQkJ2QlNBQUVIQUxDeThCQW45QjF3QWpqZ0owSVFFanFnRWhBQU5BSUFBZ0FVNEVRQ0FCRUhFZ0FDQUJheUVBREFFTEN5QUFKS29CQzZVREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdRL2dOSEJFQWdBRUdWL2dOR0RRRUNRQ0FBUVpIK0Eyc09GZ1lMRUJRQUJ3d1JGUU1JRFJJV0JBa09FeGNGQ2c4QUN3d1hDMEdRL2dNUUhVR0FBWElQQzBHVi9nTVFIVUgvQVhJUEMwR2EvZ01RSFVIL0FISVBDMEdmL2dNUUhVSC9BWElQQzBHay9nTVFIUThMUVpIK0F4QWRRVDl5RHd0Qmx2NERFQjFCUDNJUEMwR2IvZ01RSFVIL0FYSVBDMEdnL2dNUUhVSC9BWElQQzBHbC9nTVFIUThMUVpMK0F4QWREd3RCbC80REVCMFBDMEdjL2dNUUhVR2ZBWElQQzBHaC9nTVFIUThMUVlBQlFRQWp0UUViSVFBZ0FFRUJjaUFBUVg1eEkxc2JJUUFnQUVFQ2NpQUFRWDF4STNJYklRQWdBRUVFY2lBQVFYdHhJNElCR3lFQUlBQkJDSElnQUVGM2NTT1ZBUnRCOEFCeUR3dEJrLzRERUIxQi93RnlEd3RCbVA0REVCMUIvd0Z5RHd0Qm5mNERFQjFCL3dGeUR3dEJvdjRERUIwUEMwR1UvZ01RSFVHL0FYSVBDMEdaL2dNUUhVRy9BWElQQzBHZS9nTVFIVUcvQVhJUEMwR2ovZ01RSFVHL0FYSVBDMEYvQzV3QkFRRi9JOThCSVFBajRBRUVRQ0FBUVh0eElBQkJCSElqMXdFYklRQWdBRUYrY1NBQVFRRnlJOW9CR3lFQUlBQkJkM0VnQUVFSWNpUFlBUnNoQUNBQVFYMXhJQUJCQW5JajJRRWJJUUFGSStFQkJFQWdBRUYrY1NBQVFRRnlJOXNCR3lFQUlBQkJmWEVnQUVFQ2NpUGNBUnNoQUNBQVFYdHhJQUJCQkhJajNRRWJJUUFnQUVGM2NTQUFRUWh5STk0Qkd5RUFDd3NnQUVId0FYSUwxUUlBSUFCQmdJQUNTQVJBUVg4UEN5QUFRWURBQWtoQkFDQUFRWUNBQWs0YkJFQkJmdzhMSUFCQmdQd0RTRUVBSUFCQmdNQURUaHNFUUNBQVFZQkFhaEFkRHdzZ0FFR2YvUU5NUVFBZ0FFR0EvQU5PR3dSQVFmOEJRWDhqNWdGQkFrZ2JEd3NnQUVITi9nTkdCRUJCL3dFaEFFSE4vZ01RSFVFQmNVVUVRRUgrQVNFQUN5T09Ba1VFUUNBQVFmOStjU0VBQ3lBQUR3c2dBRUhFL2dOR0JFQWdBQ1B5QVJBZkkvSUJEd3NnQUVHbS9nTk1RUUFnQUVHUS9nTk9Hd1JBRUhJZ0FCQnpEd3NnQUVHdi9nTk1RUUFnQUVHbi9nTk9Hd1JBUWY4QkR3c2dBRUcvL2dOTVFRQWdBRUd3L2dOT0d3UkFFSElqZ2dFRVFCQnBEd3RCZnc4TElBQkJoUDREUmdSQUlBQWp5d0ZCZ1A0RGNVRUlkU0lBRUI4Z0FBOExJQUJCaGY0RFJnUkFJQUFqekFFUUh5UE1BUThMSUFCQmovNERSZ1JBSThRQlFlQUJjZzhMSUFCQmdQNERSZ1JBRUhRUEMwRi9DeWtCQVg4ajR3RWdBRVlFUUVFQkpPVUJDeUFBRUhVaUFVRi9SZ1IvSUFBUUhRVWdBVUgvQVhFTEM2UUNBUU4vSS9zQkJFQVBDeVA4QVNFREkvMEJJUUlnQUVIL1Awd0VRQ0FDQkg4Z0FVRVFjVVVGUVFBTFJRUkFJQUZCRDNFaUFBUkFJQUJCQ2tZRVFFRUJKUGtCQ3dWQkFDVDVBUXNMQlNBQVFmLy9BRXdFUUNQL0FTSUVCSDhnQUVILzN3Qk1CVUVCQ3dSQUlBRkJEM0VqOXdFZ0Foc2hBQ0FEQkg4Z0FVRWZjU0VCSUFCQjRBRnhCU1ArQVFSL0lBRkIvd0J4SVFFZ0FFR0FBWEVGUVFBZ0FDQUVHd3NMSVFBZ0FDQUJjaVQzQVFVajl3RkIvd0Z4SUFGQkFFcEJDSFJ5SlBjQkN3VkJBQ0FBUWYrL0FVd2dBaHNFUUNQNkFVRUFJQU1iQkVBajl3RkJIM0VnQVVIZ0FYRnlKUGNCRHdzZ0FVRVBjU0FCUVFOeEkvOEJHeVQ0QVFWQkFDQUFRZi8vQVV3Z0Foc0VRQ0FEQkVBZ0FVRUJjVUVBUnlUNkFRc0xDd3NMQ3pjQkFYOGpVU0VCSUFCQjhBQnhRUVIxSkZBZ0FFRUljVUVBUnlSUklBQkJCM0VrVWtFQUkyY2pVUnRCQUNBQkd3UkFRUUFrV3dzTE5BQWdBRUVFZFVFUGNTUlZJQUJCQ0hGQkFFY2tWaUFBUVFkeEpGY2dBRUg0QVhGQkFFb2lBQ1JjSUFCRkJFQWdBQ1JiQ3dzMEFDQUFRUVIxUVE5eEpHd2dBRUVJY1VFQVJ5UnRJQUJCQjNFa2JpQUFRZmdCY1VFQVNpSUFKSE1nQUVVRVFDQUFKSElMQ3prQUlBQkJCSFZCRDNFa2pnRWdBRUVJY1VFQVJ5U1BBU0FBUVFkeEpKQUJJQUJCK0FGeFFRQktJZ0FrbGdFZ0FFVUVRQ0FBSkpVQkN3czRBQ0FBUVFSMUpKRUJJQUJCQ0hGQkFFY2trZ0VnQUVFSGNTSUFKSk1CSUFCQkFYUWlBRUVCU0FSQVFRRWhBQXNnQUVFRGRDU2JBUXViQVFFQ2YwRUJKRnNqWUVVRVFDTlBKR0FMUVlBUUkxMXJRUUowSWdCQkFuUWdBQ09PQWhza1hpTlhKRjhqVlNSaEkxMGtaaU5RQkVBalVDUmxCVUVJSkdVTFFRRWpVa0VBU2lJQUkxQkJBRW9iSkdSQkFDUm5JQUFFZndKL0kyWWlBQ05TZFNFQlFRRWpVUVIvUVFFa1p5QUFJQUZyQlNBQUlBRnFDMEgvRDBvTkFCcEJBQXNGUVFBTEJFQkJBQ1JiQ3lOY1JRUkFRUUFrV3dzTGtRRUJBbjhnQUVFSGNTSUJKRm9qV0NBQlFRaDBjaVJkSTdrQlFRRnhRUUZHSVFJaldVVWlBUVJBSUFCQndBQnhRUUJISVFFTElBSkZCRUJCQUNBQkkyQkJBRXdiQkVBallFRUJheVJnUVFBallFVWdBRUdBQVhFYkJFQkJBQ1JiQ3dzTElBQkJ3QUJ4UVFCSEpGa2dBRUdBQVhFRVFCQjlJMWxCQUVFQUkyQWpUMFlnQWhzYkJFQWpZRUVCYXlSZ0N3c0xNUUJCQVNSeUkzZEZCRUFqYVNSM0MwR0FFQ04wYTBFQ2RDT09BblFrZFNOdUpIWWpiQ1I0STNORkJFQkJBQ1J5Q3d1UkFRRUNmeUFBUVFkeElnRWtjU052SUFGQkNIUnlKSFFqdVFGQkFYRkJBVVloQWlOd1JTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFamQwRUFUQnNFUUNOM1FRRnJKSGRCQUNOM1JTQUFRWUFCY1JzRVFFRUFKSElMQ3dzZ0FFSEFBSEZCQUVja2NDQUFRWUFCY1FSQUVIOGpjRUVBUVFBamR5TnBSaUFDR3hzRVFDTjNRUUZySkhjTEN3cytBRUVCSklJQkk0WUJSUVJBSTN3a2hnRUxRWUFRSTRRQmEwRUJkQ09PQW5Ra2hRRWpoUUZCQm1va2hRRkJBQ1NIQVNPREFVVUVRRUVBSklJQkN3dWFBUUVDZnlBQVFRZHhJZ0VrZ1FFamZ5QUJRUWgwY2lTRUFTTzVBVUVCY1VFQlJpSUNSUVJBUVFBZ0FFSEFBSEZCQUVjamdBRWJJUUZCQUNBQkk0WUJRUUJNR3dSQUk0WUJRUUZySklZQlFRQWpoZ0ZGSUFCQmdBRnhHd1JBUVFBa2dnRUxDd3NnQUVIQUFIRkJBRWNrZ0FFZ0FFR0FBWEVFUUJDQkFTT0FBVUVBUVFBamhnRWpmRVlnQWhzYkJFQWpoZ0ZCQVdza2hnRUxDd3RCQUVFQkpKVUJJNWtCUlFSQUk0d0JKSmtCQ3lPYkFTT1JBWFFqamdKMEpKY0JJNUFCSkpnQkk0NEJKSm9CUWYvL0FTU2NBU09XQVVVRVFFRUFKSlVCQ3d1TEFRRUNmeU81QVVFQmNVRUJSaUVDSTVRQlJTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFam1RRkJBRXdiQkVBam1RRkJBV3NrbVFGQkFDT1pBVVVnQUVHQUFYRWJCRUJCQUNTVkFRc0xDeUFBUWNBQWNVRUFSeVNVQVNBQVFZQUJjUVJBRUlNQkk1UUJRUUJCQUNPWkFTT01BVVlnQWhzYkJFQWptUUZCQVdza21RRUxDd3VjQkFBanRRRkZRUUFnQUVHbS9nTkhHd1JBUVFBUEN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJrUDREUndSQUlBQkJtdjREUmcwQkFrQWdBRUdSL2dOckRoWURCd3NQQUFRSURCQUFCUWtORVFBR0NnNFNFeFFWQUFzTUZRc2dBUkI0REJVTFFRQWdBVUdBQVhGQkFFY2lBQ09EQVJzRVFFRUFKSW9CQ3lBQUpJTUJJQUJGQkVBZ0FDU0NBUXNNRkFzZ0FVRUdkVUVEY1NSVElBRkJQM0VrVkNOUEkxUnJKR0FNRXdzZ0FVRUdkVUVEY1NScUlBRkJQM0VrYXlOcEkydHJKSGNNRWdzZ0FTUjlJM3dqZldza2hnRU1FUXNnQVVFL2NTU05BU09NQVNPTkFXc2ttUUVNRUFzZ0FSQjVEQThMSUFFUWVnd09DMEVCSklrQklBRkJCWFZCRDNFa2Znd05DeUFCRUhzTURBc2dBU1JZSTFwQkNIUWdBWElrWFF3TEN5QUJKRzhqY1VFSWRDQUJjaVIwREFvTElBRWtmeU9CQVVFSWRDQUJjaVNFQVF3SkN5QUJFSHdNQ0FzZ0FSQitEQWNMSUFFUWdBRU1CZ3NnQVJDQ0FRd0ZDeUFCRUlRQkRBUUxJQUZCQkhWQkIzRWtxd0VnQVVFSGNTU3NBVUVCSktjQkRBTUxJQUVRSzBFQkpLZ0JEQUlMSTdVQklnQUVmMEVBQlNBQlFZQUJjUXNFUUVFSEpMa0JRUUFrWTBFQUpIb0xJQUZCZ0FGeFJVRUFJQUFiQkVBQ1FFR1EvZ01oQUFOQUlBQkJwdjREVGcwQklBQkJBQkNTQVNBQVFRRnFJUUFNQUFBTEFBc0xJQUZCZ0FGeFFRQkhKTFVCREFFTFFRRVBDMEVCQ3p3QkFYOGdBRUVJZENFQlFRQWhBQU5BQWtBZ0FFR2ZBVW9OQUNBQVFZRDhBMm9nQUNBQmFoQWRFQjhnQUVFQmFpRUFEQUVMQzBHRUJTU0ZBZ3NqQVFGL0k0QUNFQjBoQUNPQkFoQWRRZjhCY1NBQVFmOEJjVUVJZEhKQjhQOERjUXNuQVFGL0k0SUNFQjBoQUNPREFoQWRRZjhCY1NBQVFmOEJjVUVJZEhKQjhEOXhRWUNBQW1vTGhnRUJBMzhqalFKRkJFQVBDeUFBUVlBQmNVVkJBQ09HQWhzRVFFRUFKSVlDSTRRQ0VCMUJnQUZ5SVFBamhBSWdBQkFmRHdzUWh3RWhBUkNJQVNFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSklZQ0lBTWtod0lnQVNTSUFpQUNKSWtDSTRRQ0lBQkIvMzV4RUI4RklBRWdBaUFERUpNQkk0UUNRZjhCRUI4TEMxVUJCSDlCQVNOTElnTWdBRVlqU2lBQVJoc0VRQ0FBUVFGcklnUVFIVUcvZjNFaUFrRS9jU0lGUVVCcklBVWdBQ0FEUmh0QmdKQUVhaUFCT2dBQUlBSkJnQUZ4QkVBZ0JDQUNRUUZxUVlBQmNoQWZDd3NMTVFBQ1FBSkFBa0FDUUNBQUJFQUNRQ0FBUVFGckRnTUNBd1FBQ3d3RUMwRUpEd3RCQXc4TFFRVVBDMEVIRHd0QkFBc2ZBQ0FBUVFFajBRRVFpd0VpQUhSeEJIOUJBU0FBZENBQmNVVUZRUUFMQzRZQkFRUi9BMEFnQWlBQVNBUkFJQUpCQkdvaEFpUExBU0lCUVFScVFmLy9BM0VpQXlUTEFTUFFBUVJBSTg0QklRUWp6UUVFUUNQUEFTVE1BVUVCSk1jQlFRSVFXa0VBSk0wQlFRRWt6Z0VGSUFRRVFFRUFKTTRCQ3dzZ0FTQURFSXdCQkVBanpBRkJBV29pQVVIL0FVb0VRRUVCSk0wQlFRQWhBUXNnQVNUTUFRc0xEQUVMQ3dzTkFDUEtBUkNOQVVFQUpNb0JDMFlCQVg4anl3RWhBRUVBSk1zQlFZVCtBMEVBRUI4ajBBRUVmeUFBUVFBUWpBRUZRUUFMQkVBanpBRkJBV29pQUVIL0FVb0VRRUVCSk0wQlFRQWhBQXNnQUNUTUFRc0xmd0VEZnlQUUFTRUJJQUJCQkhGQkFFY2swQUVnQUVFRGNTRUNJQUZGQkVBajBRRVFpd0VoQVNBQ0VJc0JJUU1qeXdFaEFDUFFBUVIvUVFFZ0FYUWdBSEVGUVFFZ0EzUWdBSEZCQUVkQkFFRUJJQUYwSUFCeEd3c0VRQ1BNQVVFQmFpSUFRZjhCU2dSQVFRRWt6UUZCQUNFQUN5QUFKTXdCQ3dzZ0FpVFJBUXZDQmdFQmZ3SkFBa0FnQUVITi9nTkdCRUJCemY0RElBRkJBWEVRSHd3QkN5QUFRZEQrQTBaQkFDT01BaHNFUUVFQUpJd0NRZjhCSkpnQ0RBSUxJQUJCZ0lBQ1NBUkFJQUFnQVJCM0RBRUxJQUJCZ01BQ1NFRUFJQUJCZ0lBQ1Roc05BU0FBUVlEOEEwaEJBQ0FBUVlEQUEwNGJCRUFnQUVHQVFHb2dBUkFmREFJTElBQkJuLzBEVEVFQUlBQkJnUHdEVGhzRVFDUG1BVUVDVGc4TElBQkIvLzBEVEVFQUlBQkJvUDBEVGhzTkFDQUFRWUwrQTBZRVFDQUJRUUZ4UVFCSEpOUUJJQUZCQW5GQkFFY2sxUUVnQVVHQUFYRkJBRWNrMWdGQkFROExJQUJCcHY0RFRFRUFJQUJCa1A0RFRoc0VRQkJ5SUFBZ0FSQ0ZBUThMSUFCQnYvNERURUVBSUFCQnNQNERUaHNFUUJCeUk0SUJCRUFqaHdGQkFYVkJzUDREYWlBQkVCOE1BZ3NNQWdzZ0FFSEwvZ05NUVFBZ0FFSEEvZ05PR3dSQUlBQkJ3UDREUmdSQUlBRVFQd3dEQ3lBQVFjSCtBMFlFUUVIQi9nTWdBVUg0QVhGQndmNERFQjFCQjNGeVFZQUJjaEFmREFJTElBQkJ4UDREUmdSQVFRQWs4Z0VnQUVFQUVCOE1BZ3NnQUVIRi9nTkdCRUFnQVNUbkFRd0RDeUFBUWNiK0EwWUVRQ0FCRUlZQkRBTUxBa0FDUUFKQUFrQWdBRUhEL2dOSEJFQWdBRUhDL2dOckRnb0JCQVFFQkFRRUJBTUNCQXNnQVNUekFRd0dDeUFCSlBRQkRBVUxJQUVrOVFFTUJBc2dBU1QyQVF3REN3d0NDeU9FQWlBQVJnUkFJQUVRaVFFTUFRdEJBU09LQWlBQVJpT0xBaUFBUmhzRVFDT0dBZ1JBSTRnQ0lnSkJnSUFCVGdSL0lBSkIvLzhCVEFWQkFBc0VmMEVCQlNBQ1FmKy9BMHhCQUNBQ1FZQ2dBMDRiQ3cwQ0N3c2dBQ05MVEVFQUlBQWpTVTRiQkVBZ0FDQUJFSW9CREFJTElBQkJoLzREVEVFQUlBQkJoUDREVGhzRVFCQ09BUUpBQWtBQ1FBSkFJQUJCaFA0RFJ3UkFJQUJCaGY0RGF3NERBUUlEQkFzUWp3RU1CUXNDUUNQUUFRUkFJODRCRFFFanpRRUVRRUVBSk0wQkN3c2dBU1RNQVFzTUJRc2dBU1RQQVNQT0FVRUFJOUFCR3dSQUlBRWt6QUZCQUNUT0FRc01CQXNnQVJDUUFRd0RDd3dDQ3lBQVFZRCtBMFlFUUNBQlFmOEJjeVRmQVNQZkFTSUNRUkJ4UVFCSEpPQUJJQUpCSUhGQkFFY2s0UUVMSUFCQmovNERSZ1JBSUFFUUx3d0NDeUFBUWYvL0EwWUVRQ0FCRUM0TUFndEJBUThMUVFBUEMwRUJDeUFBSStRQklBQkdCRUJCQVNUbEFRc2dBQ0FCRUpFQkJFQWdBQ0FCRUI4TEMxd0JBMzhEUUFKQUlBTWdBazROQUNBQUlBTnFFSFloQlNBQklBTnFJUVFEUUNBRVFmKy9Ba3hGQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUpJQklBTkJBV29oQXd3QkN3c2poUUpCSUNPT0FuUWdBa0VFZFd4cUpJVUNDM01CQW44amhnSkZCRUFQQzBFUUlRQWppQUlqaVFJQ2Z5T0hBaUlCUVJCSUJFQWdBU0VBQ3lBQUN4Q1RBU09JQWlBQWFpU0lBaU9KQWlBQWFpU0pBaUFCSUFCcklnQWtod0lqaEFJaEFTQUFRUUJNQkVCQkFDU0dBaUFCUWY4QkVCOEZJQUVnQUVFRWRVRUJhMEgvZm5FUUh3c0xNd0FqOGdFajV3RkdRUUFnQUVFQlJrRUJJQUFiR3dSQUlBRkJCSElpQVVIQUFIRUVRQkJiQ3dVZ0FVRjdjU0VCQ3lBQkM0RUNBUVYvSStnQlJRUkFEd3NqNWdFaEFDQUFJL0lCSWdKQmtBRk9CSDlCQVFWQitBSWpqZ0owSWdFaEF5UHhBU0lFSUFGT0JIOUJBZ1ZCQTBFQUlBUWdBMDRiQ3dzaUFVY0VRRUhCL2dNUUhTRUFJQUVrNWdGQkFDRUNBa0FDUUFKQUFrQWdBUVJBSUFGQkFXc09Bd0VDQXdRTElBQkJmSEVpQUVFSWNVRUFSeUVDREFNTElBQkJmWEZCQVhJaUFFRVFjVUVBUnlFQ0RBSUxJQUJCZm5GQkFuSWlBRUVnY1VFQVJ5RUNEQUVMSUFCQkEzSWhBQXNnQWdSQUVGc0xJQUZGQkVBUWxBRUxJQUZCQVVZRVFFRUJKTVVCUVFBUVdndEJ3ZjRESUFFZ0FCQ1ZBUkFmQlNBQ1Faa0JSZ1JBUWNIK0F5QUJRY0grQXhBZEVKVUJFQjhMQ3d1Z0FRRUJmeVBvQVFSQUkvRUJJQUJxSlBFQkl6Z2hBUU5BSS9FQlFRUWpqZ0lpQUhSQnlBTWdBSFFqOGdGQm1RRkdHMDRFUUNQeEFVRUVJNDRDSWdCMFFjZ0RJQUIwSS9JQlFaa0JSaHRySlBFQkkvSUJJZ0JCa0FGR0JFQWdBUVJBRUZnRklBQVFWd3NRV1VGL0pFeEJmeVJOQlNBQVFaQUJTQVJBSUFGRkJFQWdBQkJYQ3dzTFFRQWdBRUVCYWlBQVFaa0JTaHNrOGdFTUFRc0xDeENXQVFzNEFRRi9RUVFqamdJaUFIUkJ5QU1nQUhRajhnRkJtUUZHR3lFQUEwQWo4QUVnQUU0RVFDQUFFSmNCSS9BQklBQnJKUEFCREFFTEN3dXlBUUVEZnlQV0FVVUVRQThMQTBBZ0F5QUFTQVJBSUFOQkJHb2hBd0ovSTlJQklnSkJCR29pQVVILy93TktCRUFnQVVHQWdBUnJJUUVMSUFFTEpOSUJJQUpCQVVFQ1FRY2oxUUViSWdKMGNRUi9RUUVnQW5RZ0FYRkZCVUVBQ3dSQVFZSCtBMEdCL2dNUUhVRUJkRUVCYWtIL0FYRVFIeVBUQVVFQmFpSUJRUWhHQkVCQkFDVFRBVUVCSk1nQlFRTVFXa0dDL2dOQmd2NERFQjFCLzM1eEVCOUJBQ1RXQVFVZ0FTVFRBUXNMREFFTEN3dVZBUUFqaFFKQkFFb0VRQ09GQWlBQWFpRUFRUUFraFFJTEk1a0NJQUJxSkprQ0k1MENSUVJBSXpZRVFDUHdBU0FBYWlUd0FSQ1lBUVVnQUJDWEFRc2pOUVJBSTZvQklBQnFKS29CRUhJRklBQVFjUXNnQUJDWkFRc2pOd1JBSThvQklBQnFKTW9CRUk0QkJTQUFFSTBCQ3lPZ0FpQUFhaUlBSTU0Q1RnUkFJNThDUVFGcUpKOENJQUFqbmdKcklRQUxJQUFrb0FJTERBQkJCQkNhQVNPWUFoQWRDeWtCQVg5QkJCQ2FBU09ZQWtFQmFrSC8vd054RUIwaEFCQ2JBVUgvQVhFZ0FFSC9BWEZCQ0hSeUN3NEFRUVFRbWdFZ0FDQUJFSklCQ3pBQVFRRWdBSFJCL3dGeElRQWdBVUVBU2dSQUk1WUNJQUJ5UWY4QmNTU1dBZ1VqbGdJZ0FFSC9BWE54SkpZQ0N3c0pBRUVGSUFBUW5nRUxPZ0VCZnlBQlFRQk9CRUFnQUVFUGNTQUJRUTl4YWtFUWNVRUFSeENmQVFVZ0FVRWZkU0lDSUFFZ0FtcHpRUTl4SUFCQkQzRkxFSjhCQ3dzSkFFRUhJQUFRbmdFTENRQkJCaUFBRUo0QkN3a0FRUVFnQUJDZUFRcy9BUUovSUFGQmdQNERjVUVJZFNFQ0lBRkIvd0Z4SWdFaEF5QUFJQUVRa1FFRVFDQUFJQU1RSHdzZ0FFRUJhaUlBSUFJUWtRRUVRQ0FBSUFJUUh3c0xEZ0JCQ0JDYUFTQUFJQUVRcEFFTFdnQWdBZ1JBSUFCQi8vOERjU0lBSUFGcUlBQWdBWE56SWdCQkVIRkJBRWNRbndFZ0FFR0FBbkZCQUVjUW93RUZJQUFnQVdwQi8vOERjU0lDSUFCQi8vOERjVWtRb3dFZ0FDQUJjeUFDYzBHQUlIRkJBRWNRbndFTEN3c0FRUVFRbWdFZ0FCQjJDNmtGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFCRUFnQUVFQlJnMEJBa0FnQUVFQ2F3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDd3dWQ3hDY0FVSC8vd054SWdCQmdQNERjVUVJZFNTUUFpQUFRZjhCY1NTUkFnd1BDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBjaU9QQWhDZEFRd1RDeU9SQWtIL0FYRWprQUpCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NRQWd3VEN5T1FBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NRQWd3TkN5T1FBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NRQWd3TkN4Q2JBVUgvQVhFa2tBSU1EUXNqandJaUFFR0FBWEZCZ0FGR0VLTUJJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU1NQQWd3TkN4Q2NBVUgvL3dOeEk1Y0NFS1VCREFnTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUlnQWprUUpCL3dGeEk1QUNRZjhCY1VFSWRISWlBVUVBRUtZQklBQWdBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtsQUlnQUVIL0FYRWtsUUpCQUJDaUFVRUlEd3Nqa1FKQi93RnhJNUFDUWY4QmNVRUlkSElRcHdGQi93RnhKSThDREFzTEk1RUNRZjhCY1NPUUFrSC9BWEZCQ0hSeVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMUpKQUNEQXNMSTVFQ0lnQkJBUkNnQVNBQVFRRnFRZjhCY1NJQUpKRUNEQVVMSTVFQ0lnQkJmeENnQVNBQVFRRnJRZjhCY1NJQUpKRUNEQVVMRUpzQlFmOEJjU1NSQWd3RkN5T1BBaUlBUVFGeFFRQkxFS01CSUFCQkIzUWdBRUgvQVhGQkFYWnlRZjhCY1NTUEFnd0ZDMEYvRHdzam1BSkJBbXBCLy84RGNTU1lBZ3dFQ3lBQVJSQ2hBVUVBRUtJQkRBTUxJQUJGRUtFQlFRRVFvZ0VNQWdzam1BSkJBV3BCLy84RGNTU1lBZ3dCQzBFQUVLRUJRUUFRb2dGQkFCQ2ZBUXRCQkE4TElBQkIvd0Z4SkpFQ1FRZ0xtUVlCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCRUVjRVFDQUFRUkZHRFFFQ1FDQUFRUkpyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEk0MENCRUJCemY0REVLY0JRZjhCY1NJQVFRRnhCRUJCemY0RElBQkJmbkVpQUVHQUFYRUVmMEVBSkk0Q0lBQkIvMzV4QlVFQkpJNENJQUJCZ0FGeUN4Q2RBVUhFQUE4TEMwRUJKSjBDREJBTEVKd0JRZi8vQTNFaUFFR0EvZ054UVFoMUpKSUNJQUJCL3dGeEpKTUNJNWdDUVFKcVFmLy9BM0VrbUFJTUVRc2prd0pCL3dGeEk1SUNRZjhCY1VFSWRISWpqd0lRblFFTUVBc2prd0pCL3dGeEk1SUNRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtrZ0lNRUFzamtnSWlBRUVCRUtBQklBQkJBV3BCL3dGeEpKSUNJNUlDUlJDaEFVRUFFS0lCREE0TEk1SUNJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTU1NBaU9TQWtVUW9RRkJBUkNpQVF3TkN4Q2JBVUgvQVhFa2tnSU1DZ3NqandJaUFVR0FBWEZCZ0FGR0lRQWpsZ0pCQkhaQkFYRWdBVUVCZEhKQi93RnhKSThDREFvTEVKc0JJUUFqbUFJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSmdDUVFnUEN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpSUFJNU1DUWY4QmNTT1NBa0gvQVhGQkNIUnlJZ0ZCQUJDbUFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSlFDSUFCQi93RnhKSlVDUVFBUW9nRkJDQThMSTVNQ1FmOEJjU09TQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NQQWd3SUN5T1RBa0gvQVhFamtnSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU1NBZ3dJQ3lPVEFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU1RBaUFBUlJDaEFVRUFFS0lCREFZTEk1TUNJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTSUFKSk1DSUFCRkVLRUJRUUVRb2dFTUJRc1Ftd0ZCL3dGeEpKTUNEQUlMSTQ4Q0lnRkJBWEZCQVVZaEFDT1dBa0VFZGtFQmNVRUhkQ0FCUWY4QmNVRUJkbklrandJTUFndEJmdzhMSTVnQ1FRRnFRZi8vQTNFa21BSU1BUXNnQUJDakFVRUFFS0VCUVFBUW9nRkJBQkNmQVF0QkJBOExJQUJCL3dGeEpKTUNRUWdMOVFZQkFuOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRU0JIQkVBZ0FFRWhSZzBCQWtBZ0FFRWlhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPV0FrRUhka0VCY1FSQUk1Z0NRUUZxUWYvL0EzRWttQUlGRUpzQklRQWptQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpKZ0NDMEVJRHdzUW5BRkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2xBSWdBRUgvQVhFa2xRSWptQUpCQW1wQi8vOERjU1NZQWd3VUN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpSUFJNDhDRUowQkRBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSlFDREEwTEk1UUNJZ0JCQVJDZ0FTQUFRUUZxUWY4QmNTSUFKSlFDREE0TEk1UUNJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTSUFKSlFDREE0TEVKc0JRZjhCY1NTVUFnd09DMEVHUVFBamxnSWlBa0VGZGtFQmNVRUFTeHNpQUVIZ0FISWdBQ0FDUVFSMlFRRnhRUUJMR3lFQUk0OENJUUVnQWtFR2RrRUJjVUVBU3dSL0lBRWdBR3RCL3dGeEJTQUJJQUJCQm5JZ0FDQUJRUTl4UVFsTEd5SUFRZUFBY2lBQUlBRkJtUUZMR3lJQWFrSC9BWEVMSWdGRkVLRUJJQUJCNEFCeFFRQkhFS01CUVFBUW53RWdBU1NQQWd3T0N5T1dBa0VIZGtFQmNVRUFTd1JBRUpzQklRQWptQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpKZ0NCU09ZQWtFQmFrSC8vd054SkpnQ0MwRUlEd3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElpQUNBQVFmLy9BM0ZCQUJDbUFTQUFRUUYwUWYvL0EzRWlBRUdBL2dOeFFRaDFKSlFDSUFCQi93RnhKSlVDUVFBUW9nRkJDQThMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5SWdBUXB3RkIvd0Z4Skk4Q0RBY0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDFKSlFDREFVTEk1VUNJZ0JCQVJDZ0FTQUFRUUZxUWY4QmNTSUFKSlVDREFZTEk1VUNJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTSUFKSlVDREFZTEVKc0JRZjhCY1NTVkFnd0dDeU9QQWtGL2MwSC9BWEVrandKQkFSQ2lBVUVCRUo4QkRBWUxRWDhQQ3lBQVFmOEJjU1NWQWtFSUR3c2dBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NVQWlBQVFmOEJjU1NWQWd3REN5QUFSUkNoQVVFQUVLSUJEQUlMSUFCRkVLRUJRUUVRb2dFTUFRc2ptQUpCQVdwQi8vOERjU1NZQWd0QkJBdnhCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJNRWNFUUNBQVFURkdEUUVDUUNBQVFUSnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSTVZQ1FRUjJRUUZ4QkVBam1BSkJBV3BCLy84RGNTU1lBZ1VRbXdFaEFDT1lBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa21BSUxRUWdQQ3hDY0FVSC8vd054SkpjQ0k1Z0NRUUpxUWYvL0EzRWttQUlNRVFzamxRSkIvd0Z4STVRQ1FmOEJjVUVJZEhJaUFDT1BBaENkQVF3T0N5T1hBa0VCYWtILy93TnhKSmNDUVFnUEN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpSUFFS2NCSWdGQkFSQ2dBU0FCUVFGcVFmOEJjU0lCUlJDaEFVRUFFS0lCSUFBZ0FSQ2RBUXdPQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2lJQUVLY0JJZ0ZCZnhDZ0FTQUJRUUZyUWY4QmNTSUJSUkNoQVVFQkVLSUJJQUFnQVJDZEFRd05DeU9WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaENiQVVIL0FYRVFuUUVNQ3d0QkFCQ2lBVUVBRUo4QlFRRVFvd0VNQ3dzamxnSkJCSFpCQVhGQkFVWUVRQkNiQVNFQUk1Z0NJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTWUFnVWptQUpCQVdwQi8vOERjU1NZQWd0QkNBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlJZ0FqbHdKQkFCQ21BU09YQWlBQWFrSC8vd054SWdCQmdQNERjVUVJZFNTVUFpQUFRZjhCY1NTVkFrRUFFS0lCUVFnUEN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNpSUFFS2NCUWY4QmNTU1BBZ3dHQ3lPWEFrRUJhMEgvL3dOeEpKY0NRUWdQQ3lPUEFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU1BBaUFBUlJDaEFVRUFFS0lCREFZTEk0OENJZ0JCZnhDZ0FTQUFRUUZyUWY4QmNTSUFKSThDSUFCRkVLRUJRUUVRb2dFTUJRc1Ftd0ZCL3dGeEpJOENEQU1MUVFBUW9nRkJBQkNmQVNPV0FrRUVka0VCY1VFQVRSQ2pBUXdEQzBGL0R3c2dBRUVCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NVQWlBQVFmOEJjU1NWQWd3QkN5T1lBa0VCYWtILy93TnhKSmdDQzBFRUM0SUNBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUJIQkVBZ0FFSEJBRVlOQVFKQUlBQkJ3Z0JyRGc0REJBVUdCd2dKRVFvTERBME9Ed0FMREE4TERBOExJNUVDSkpBQ0RBNExJNUlDSkpBQ0RBMExJNU1DSkpBQ0RBd0xJNVFDSkpBQ0RBc0xJNVVDSkpBQ0RBb0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCUWY4QmNTU1FBZ3dKQ3lPUEFpU1FBZ3dJQ3lPUUFpU1JBZ3dIQ3lPU0FpU1JBZ3dHQ3lPVEFpU1JBZ3dGQ3lPVUFpU1JBZ3dFQ3lPVkFpU1JBZ3dEQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2hDbkFVSC9BWEVra1FJTUFnc2pqd0lra1FJTUFRdEJmdzhMUVFRTC9RRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjBBQkhCRUFnQUVIUkFFWU5BUUpBSUFCQjBnQnJEZzRRQXdRRkJnY0lDUW9RQ3d3TkRnQUxEQTRMSTVBQ0pKSUNEQTRMSTVFQ0pKSUNEQTBMSTVNQ0pKSUNEQXdMSTVRQ0pKSUNEQXNMSTVVQ0pKSUNEQW9MSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NTQWd3SkN5T1BBaVNTQWd3SUN5T1FBaVNUQWd3SEN5T1JBaVNUQWd3R0N5T1NBaVNUQWd3RkN5T1VBaVNUQWd3RUN5T1ZBaVNUQWd3REN5T1ZBa0gvQVhFamxBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2t3SU1BZ3NqandJa2t3SU1BUXRCZnc4TFFRUUwvUUVBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUJIQkVBZ0FFSGhBRVlOQVFKQUlBQkI0Z0JyRGc0REJCQUZCZ2NJQ1FvTERCQU5EZ0FMREE0TEk1QUNKSlFDREE0TEk1RUNKSlFDREEwTEk1SUNKSlFDREF3TEk1TUNKSlFDREFzTEk1VUNKSlFDREFvTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUVLY0JRZjhCY1NTVUFnd0pDeU9QQWlTVUFnd0lDeU9RQWlTVkFnd0hDeU9SQWlTVkFnd0dDeU9TQWlTVkFnd0ZDeU9UQWlTVkFnd0VDeU9VQWlTVkFnd0RDeU9WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtsUUlNQWdzamp3SWtsUUlNQVF0QmZ3OExRUVFMbXdNQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FFY0VRQ0FBUWZFQVJnMEJBa0FnQUVIeUFHc09EZ01FQlFZSENBa0tDd3dORGc4UkFBc01Ed3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqa0FJUW5RRU1Ed3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqa1FJUW5RRU1EZ3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqa2dJUW5RRU1EUXNqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqa3dJUW5RRU1EQXNqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqbEFJUW5RRU1Dd3NqbFFKQi93RnhJNVFDUWY4QmNVRUlkSElqbFFJUW5RRU1DZ3NqaGdKRkJFQUNRQ084QVFSQVFRRWttZ0lNQVFzanZnRWp4QUZ4UVI5eFJRUkFRUUVrbXdJTUFRdEJBU1NjQWdzTERBa0xJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlJNDhDRUowQkRBZ0xJNUFDSkk4Q0RBY0xJNUVDSkk4Q0RBWUxJNUlDSkk4Q0RBVUxJNU1DSkk4Q0RBUUxJNVFDSkk4Q0RBTUxJNVVDSkk4Q0RBSUxJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlFS2NCUWY4QmNTU1BBZ3dCQzBGL0R3dEJCQXMzQVFGL0lBRkJBRTRFUUNBQVFmOEJjU0FBSUFGcVFmOEJjVXNRb3dFRklBRkJIM1VpQWlBQklBSnFjeUFBUWY4QmNVb1Fvd0VMQ3pRQkFuOGpqd0lpQVNBQVFmOEJjU0lDRUtBQklBRWdBaEN3QVNBQUlBRnFRZjhCY1NJQUpJOENJQUJGRUtFQlFRQVFvZ0VMV0FFQ2Z5T1BBaUlCSUFCcUk1WUNRUVIyUVFGeGFrSC9BWEVpQWlBQUlBRnpjMEVRY1VFQVJ4Q2ZBU0FBUWY4QmNTQUJhaU9XQWtFRWRrRUJjV3BCZ0FKeFFRQkxFS01CSUFJa2p3SWdBa1VRb1FGQkFCQ2lBUXVMQWdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmdBRkhCRUFnQUVHQkFVWU5BUUpBSUFCQmdnRnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSTVBQ0VMRUJEQkFMSTVFQ0VMRUJEQThMSTVJQ0VMRUJEQTRMSTVNQ0VMRUJEQTBMSTVRQ0VMRUJEQXdMSTVVQ0VMRUJEQXNMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMRUJEQW9MSTQ4Q0VMRUJEQWtMSTVBQ0VMSUJEQWdMSTVFQ0VMSUJEQWNMSTVJQ0VMSUJEQVlMSTVNQ0VMSUJEQVVMSTVRQ0VMSUJEQVFMSTVVQ0VMSUJEQU1MSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMSUJEQUlMSTQ4Q0VMSUJEQUVMUVg4UEMwRUVDemNCQW44amp3SWlBU0FBUWY4QmNVRi9iQ0lDRUtBQklBRWdBaEN3QVNBQklBQnJRZjhCY1NJQUpJOENJQUJGRUtFQlFRRVFvZ0VMV0FFQ2Z5T1BBaUlCSUFCckk1WUNRUVIyUVFGeGEwSC9BWEVpQWlBQUlBRnpjMEVRY1VFQVJ4Q2ZBU0FCSUFCQi93RnhheU9XQWtFRWRrRUJjV3RCZ0FKeFFRQkxFS01CSUFJa2p3SWdBa1VRb1FGQkFSQ2lBUXVMQWdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtBRkhCRUFnQUVHUkFVWU5BUUpBSUFCQmtnRnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVBQUxEQkFMSTVBQ0VMUUJEQkFMSTVFQ0VMUUJEQThMSTVJQ0VMUUJEQTRMSTVNQ0VMUUJEQTBMSTVRQ0VMUUJEQXdMSTVVQ0VMUUJEQXNMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMUUJEQW9MSTQ4Q0VMUUJEQWtMSTVBQ0VMVUJEQWdMSTVFQ0VMVUJEQWNMSTVJQ0VMVUJEQVlMSTVNQ0VMVUJEQVVMSTVRQ0VMVUJEQVFMSTVVQ0VMVUJEQU1MSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQkVMVUJEQUlMSTQ4Q0VMVUJEQUVMUVg4UEMwRUVDeUlBSTQ4Q0lBQnhJZ0FrandJZ0FFVVFvUUZCQUJDaUFVRUJFSjhCUVFBUW93RUxKZ0FqandJZ0FITkIvd0Z4SWdBa2p3SWdBRVVRb1FGQkFCQ2lBVUVBRUo4QlFRQVFvd0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFhQUJSd1JBSUFCQm9RRkdEUUVDUUNBQVFhSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPUUFoQzNBUXdRQ3lPUkFoQzNBUXdQQ3lPU0FoQzNBUXdPQ3lPVEFoQzNBUXdOQ3lPVUFoQzNBUXdNQ3lPVkFoQzNBUXdMQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2hDbkFSQzNBUXdLQ3lPUEFoQzNBUXdKQ3lPUUFoQzRBUXdJQ3lPUkFoQzRBUXdIQ3lPU0FoQzRBUXdHQ3lPVEFoQzRBUXdGQ3lPVUFoQzRBUXdFQ3lPVkFoQzRBUXdEQ3lPVkFrSC9BWEVqbEFKQi93RnhRUWgwY2hDbkFSQzRBUXdDQ3lPUEFoQzRBUXdCQzBGL0R3dEJCQXNtQUNPUEFpQUFja0gvQVhFaUFDU1BBaUFBUlJDaEFVRUFFS0lCUVFBUW53RkJBQkNqQVFzc0FRRi9JNDhDSWdFZ0FFSC9BWEZCZjJ3aUFCQ2dBU0FCSUFBUXNBRWdBQ0FCYWtVUW9RRkJBUkNpQVF1TEFnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJzQUZIQkVBZ0FFR3hBVVlOQVFKQUlBQkJzZ0ZyRGc0REJBVUdCd2dKQ2dzTURRNFBFQUFMREJBTEk1QUNFTG9CREJBTEk1RUNFTG9CREE4TEk1SUNFTG9CREE0TEk1TUNFTG9CREEwTEk1UUNFTG9CREF3TEk1VUNFTG9CREFzTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUVLY0JFTG9CREFvTEk0OENFTG9CREFrTEk1QUNFTHNCREFnTEk1RUNFTHNCREFjTEk1SUNFTHNCREFZTEk1TUNFTHNCREFVTEk1UUNFTHNCREFRTEk1VUNFTHNCREFNTEk1VUNRZjhCY1NPVUFrSC9BWEZCQ0hSeUVLY0JFTHNCREFJTEk0OENFTHNCREFFTFFYOFBDMEVFQ3pzQkFYOGdBQkIxSWdGQmYwWUVmeUFBRUIwRklBRUxRZjhCY1NBQVFRRnFJZ0VRZFNJQVFYOUdCSDhnQVJBZEJTQUFDMEgvQVhGQkNIUnlDd3dBUVFnUW1nRWdBQkM5QVFzMEFDQUFRWUFCY1VHQUFVWVFvd0VnQUVFQmRDQUFRZjhCY1VFSGRuSkIvd0Z4SWdCRkVLRUJRUUFRb2dGQkFCQ2ZBU0FBQ3pJQUlBQkJBWEZCQUVzUW93RWdBRUVIZENBQVFmOEJjVUVCZG5KQi93RnhJZ0JGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFDemdCQVg4amxnSkJCSFpCQVhFZ0FFRUJkSEpCL3dGeElRRWdBRUdBQVhGQmdBRkdFS01CSUFGRkVLRUJRUUFRb2dGQkFCQ2ZBU0FCQ3prQkFYOGpsZ0pCQkhaQkFYRkJCM1FnQUVIL0FYRkJBWFp5SVFFZ0FFRUJjVUVCUmhDakFTQUJSUkNoQVVFQUVLSUJRUUFRbndFZ0FRc3FBQ0FBUVlBQmNVR0FBVVlRb3dFZ0FFRUJkRUgvQVhFaUFFVVFvUUZCQUJDaUFVRUFFSjhCSUFBTFBRRUJmeUFBUWY4QmNVRUJkaUlCUVlBQmNpQUJJQUJCZ0FGeFFZQUJSaHNpQVVVUW9RRkJBQkNpQVVFQUVKOEJJQUJCQVhGQkFVWVFvd0VnQVFzckFDQUFRUTl4UVFSMElBQkI4QUZ4UVFSMmNpSUFSUkNoQVVFQUVLSUJRUUFRbndGQkFCQ2pBU0FBQ3lvQkFYOGdBRUgvQVhGQkFYWWlBVVVRb1FGQkFCQ2lBVUVBRUo4QklBQkJBWEZCQVVZUW93RWdBUXNlQUVFQklBQjBJQUZ4UWY4QmNVVVFvUUZCQUJDaUFVRUJFSjhCSUFFTHlBZ0JCWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCQjNFaUJBUkFJQVJCQVVZTkFRSkFJQVJCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJNUFDSVFFTUJ3c2prUUloQVF3R0N5T1NBaUVCREFVTEk1TUNJUUVNQkFzamxBSWhBUXdEQ3lPVkFpRUJEQUlMSTVVQ1FmOEJjU09VQWtIL0FYRkJDSFJ5RUtjQklRRU1BUXNqandJaEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZFNJRkJFQWdCVUVCUmcwQkFrQWdCVUVDYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5QUFRUWRNQkg4Z0FSQy9BU0VDUVFFRklBQkJEMHdFZnlBQkVNQUJJUUpCQVFWQkFBc0xJUU1NRHdzZ0FFRVhUQVIvSUFFUXdRRWhBa0VCQlNBQVFSOU1CSDhnQVJEQ0FTRUNRUUVGUVFBTEN5RUREQTRMSUFCQkowd0VmeUFCRU1NQklRSkJBUVVnQUVFdlRBUi9JQUVReEFFaEFrRUJCVUVBQ3dzaEF3d05DeUFBUVRkTUJIOGdBUkRGQVNFQ1FRRUZJQUJCUDB3RWZ5QUJFTVlCSVFKQkFRVkJBQXNMSVFNTURBc2dBRUhIQUV3RWYwRUFJQUVReHdFaEFrRUJCU0FBUWM4QVRBUi9RUUVnQVJESEFTRUNRUUVGUVFBTEN5RUREQXNMSUFCQjF3Qk1CSDlCQWlBQkVNY0JJUUpCQVFVZ0FFSGZBRXdFZjBFRElBRVF4d0VoQWtFQkJVRUFDd3NoQXd3S0N5QUFRZWNBVEFSL1FRUWdBUkRIQVNFQ1FRRUZJQUJCN3dCTUJIOUJCU0FCRU1jQklRSkJBUVZCQUFzTElRTU1DUXNnQUVIM0FFd0VmMEVHSUFFUXh3RWhBa0VCQlNBQVFmOEFUQVIvUVFjZ0FSREhBU0VDUVFFRlFRQUxDeUVEREFnTElBQkJod0ZNQkg4Z0FVRitjU0VDUVFFRklBQkJqd0ZNQkg4Z0FVRjljU0VDUVFFRlFRQUxDeUVEREFjTElBQkJsd0ZNQkg4Z0FVRjdjU0VDUVFFRklBQkJud0ZNQkg4Z0FVRjNjU0VDUVFFRlFRQUxDeUVEREFZTElBQkJwd0ZNQkg4Z0FVRnZjU0VDUVFFRklBQkJyd0ZNQkg4Z0FVRmZjU0VDUVFFRlFRQUxDeUVEREFVTElBQkJ0d0ZNQkg4Z0FVRy9mM0VoQWtFQkJTQUFRYjhCVEFSL0lBRkIvMzV4SVFKQkFRVkJBQXNMSVFNTUJBc2dBRUhIQVV3RWZ5QUJRUUZ5SVFKQkFRVWdBRUhQQVV3RWZ5QUJRUUp5SVFKQkFRVkJBQXNMSVFNTUF3c2dBRUhYQVV3RWZ5QUJRUVJ5SVFKQkFRVWdBRUhmQVV3RWZ5QUJRUWh5SVFKQkFRVkJBQXNMSVFNTUFnc2dBRUhuQVV3RWZ5QUJRUkJ5SVFKQkFRVWdBRUh2QVV3RWZ5QUJRU0J5SVFKQkFRVkJBQXNMSVFNTUFRc2dBRUgzQVV3RWZ5QUJRY0FBY2lFQ1FRRUZJQUJCL3dGTUJIOGdBVUdBQVhJaEFrRUJCVUVBQ3dzaEF3c0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBUUVRQ0FFUVFGR0RRRUNRQ0FFUVFKckRnWURCQVVHQndnQUN3d0lDeUFDSkpBQ0RBY0xJQUlra1FJTUJnc2dBaVNTQWd3RkN5QUNKSk1DREFRTElBSWtsQUlNQXdzZ0FpU1ZBZ3dDQzBFQklBVkJCMG9nQlVFRVNCc0VRQ09WQWtIL0FYRWpsQUpCL3dGeFFRaDBjaUFDRUowQkN3d0JDeUFDSkk4Q0MwRUVRWDhnQXhzTHV3UUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUJSd1JBSUFCQndRRkdEUUVDUUNBQVFjSUJhdzRPQXhJRUJRWUhDQWtLQ3d3UkRRNEFDd3dPQ3lPV0FrRUhka0VCY1EwUkRBNExJNWNDRUw0QlFmLy9BM0VoQUNPWEFrRUNha0gvL3dOeEpKY0NJQUJCZ1A0RGNVRUlkU1NRQWlBQVFmOEJjU1NSQWtFRUR3c2psZ0pCQjNaQkFYRU5FUXdPQ3lPV0FrRUhka0VCY1EwUURBd0xJNWNDUVFKclFmLy9BM0VpQUNTWEFpQUFJNUVDUWY4QmNTT1FBa0gvQVhGQkNIUnlFS1VCREEwTEVKc0JFTEVCREEwTEk1Y0NRUUpyUWYvL0EzRWlBQ1NYQWlBQUk1Z0NFS1VCUVFBa21BSU1Dd3NqbGdKQkIzWkJBWEZCQVVjTkNnd0hDeU9YQWlJQUVMNEJRZi8vQTNFa21BSWdBRUVDYWtILy93TnhKSmNDREFrTEk1WUNRUWQyUVFGeFFRRkdEUWNNQ2dzUW13RkIvd0Z4RU1nQklRQWptQUpCQVdwQi8vOERjU1NZQWlBQUR3c2psZ0pCQjNaQkFYRkJBVWNOQ0NPWEFrRUNhMEgvL3dOeElnQWtsd0lnQUNPWUFrRUNha0gvL3dOeEVLVUJEQVVMRUpzQkVMSUJEQVlMSTVjQ1FRSnJRZi8vQTNFaUFDU1hBaUFBSTVnQ0VLVUJRUWdrbUFJTUJBdEJmdzhMSTVjQ0lnQVF2Z0ZCLy84RGNTU1lBaUFBUVFKcVFmLy9BM0VrbHdKQkRBOExJNWNDUVFKclFmLy9BM0VpQUNTWEFpQUFJNWdDUVFKcVFmLy9BM0VRcFFFTEVKd0JRZi8vQTNFa21BSUxRUWdQQ3lPWUFrRUJha0gvL3dOeEpKZ0NRUVFQQ3lPWUFrRUNha0gvL3dOeEpKZ0NRUXdMb0FRQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQVVjRVFDQUFRZEVCUmcwQkFrQWdBRUhTQVdzT0RnTUFCQVVHQndnSkNnQUxBQXdOQUFzTURRc2psZ0pCQkhaQkFYRU5Ed3dOQ3lPWEFpSUJFTDRCUWYvL0EzRWhBQ0FCUVFKcVFmLy9BM0VrbHdJZ0FFR0EvZ054UVFoMUpKSUNJQUJCL3dGeEpKTUNRUVFQQ3lPV0FrRUVka0VCY1EwUERBd0xJNVlDUVFSMlFRRnhEUTRqbHdKQkFtdEIvLzhEY1NJQUpKY0NJQUFqbUFKQkFtcEIvLzhEY1JDbEFRd0xDeU9YQWtFQ2EwSC8vd054SWdBa2x3SWdBQ09UQWtIL0FYRWprZ0pCL3dGeFFRaDBjaENsQVF3TEN4Q2JBUkMwQVF3TEN5T1hBa0VDYTBILy93TnhJZ0FrbHdJZ0FDT1lBaENsQVVFUUpKZ0NEQWtMSTVZQ1FRUjJRUUZ4UVFGSERRZ01CZ3NqbHdJaUFCQytBVUgvL3dOeEpKZ0NRUUVrdlFFZ0FFRUNha0gvL3dOeEpKY0NEQWNMSTVZQ1FRUjJRUUZ4UVFGR0RRVU1DQXNqbGdKQkJIWkJBWEZCQVVjTkJ5T1hBa0VDYTBILy93TnhJZ0FrbHdJZ0FDT1lBa0VDYWtILy93TnhFS1VCREFRTEVKc0JFTFVCREFVTEk1Y0NRUUpyUWYvL0EzRWlBQ1NYQWlBQUk1Z0NFS1VCUVJna21BSU1Bd3RCZnc4TEk1Y0NJZ0FRdmdGQi8vOERjU1NZQWlBQVFRSnFRZi8vQTNFa2x3SkJEQThMRUp3QlFmLy9BM0VrbUFJTFFRZ1BDeU9ZQWtFQmFrSC8vd054SkpnQ1FRUVBDeU9ZQWtFQ2FrSC8vd054SkpnQ1FRd0xzUU1CQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIZ0FVY0VRQ0FBUWVFQlJnMEJBa0FnQUVIaUFXc09EZ01BQUFRRkJnY0lDUUFBQUFvTEFBc01Dd3NRbXdGQi93RnhRWUQrQTJvamp3SVFuUUVNQ3dzamx3SWlBUkMrQVVILy93TnhJUUFnQVVFQ2FrSC8vd054SkpjQ0lBQkJnUDREY1VFSWRTU1VBaUFBUWY4QmNTU1ZBa0VFRHdzamtRSkJnUDREYWlPUEFoQ2RBVUVFRHdzamx3SkJBbXRCLy84RGNTSUFKSmNDSUFBamxRSkIvd0Z4STVRQ1FmOEJjVUVJZEhJUXBRRkJDQThMRUpzQkVMY0JEQWNMSTVjQ1FRSnJRZi8vQTNFaUFDU1hBaUFBSTVnQ0VLVUJRU0FrbUFKQkNBOExFSnNCUVJoMFFSaDFJUUFqbHdJZ0FFRUJFS1lCSTVjQ0lBQnFRZi8vQTNFa2x3SkJBQkNoQVVFQUVLSUJJNWdDUVFGcVFmLy9BM0VrbUFKQkRBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlKSmdDUVFRUEN4Q2NBVUgvL3dOeEk0OENFSjBCSTVnQ1FRSnFRZi8vQTNFa21BSkJCQThMRUpzQkVMZ0JEQUlMSTVjQ1FRSnJRZi8vQTNFaUFDU1hBaUFBSTVnQ0VLVUJRU2drbUFKQkNBOExRWDhQQ3lPWUFrRUJha0gvL3dOeEpKZ0NRUVFMNXdNQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FVY0VRQ0FBUWZFQlJnMEJBa0FnQUVIeUFXc09EZ01FQUFVR0J3Z0pDZ3NBQUF3TkFBc01EUXNRbXdGQi93RnhRWUQrQTJvUXB3RkIvd0Z4Skk4Q0RBMExJNWNDSWdFUXZnRkIvLzhEY1NFQUlBRkJBbXBCLy84RGNTU1hBaUFBUVlEK0EzRkJDSFVrandJZ0FFSC9BWEVrbGdJTURRc2prUUpCZ1A0RGFoQ25BVUgvQVhFa2p3SU1EQXRCQUNTOEFRd0xDeU9YQWtFQ2EwSC8vd054SWdBa2x3SWdBQ09XQWtIL0FYRWpqd0pCL3dGeFFRaDBjaENsQVVFSUR3c1Ftd0VRdWdFTUNBc2psd0pCQW10Qi8vOERjU0lBSkpjQ0lBQWptQUlRcFFGQk1DU1lBa0VJRHdzUW13RkJHSFJCR0hVaEFDT1hBaUVCUVFBUW9RRkJBQkNpQVNBQklBQkJBUkNtQVNBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpKUUNJQUJCL3dGeEpKVUNJNWdDUVFGcVFmLy9BM0VrbUFKQkNBOExJNVVDUWY4QmNTT1VBa0gvQVhGQkNIUnlKSmNDUVFnUEN4Q2NBVUgvL3dOeEVLY0JRZjhCY1NTUEFpT1lBa0VDYWtILy93TnhKSmdDREFVTFFRRWt2UUVNQkFzUW13RVF1d0VNQWdzamx3SkJBbXRCLy84RGNTSUFKSmNDSUFBam1BSVFwUUZCT0NTWUFrRUlEd3RCZnc4TEk1Z0NRUUZxUWYvL0EzRWttQUlMUVFRTDJBRUJBWDhqbUFKQkFXcEIvLzhEY1NFQkk1d0NCRUFnQVVFQmEwSC8vd054SVFFTElBRWttQUlDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBWEZCQkhVaUFRUkFJQUZCQVdzT0RnRUNBd1FGQmdjSUNRb0xEQTBPRHdzZ0FCQ29BUThMSUFBUXFRRVBDeUFBRUtvQkR3c2dBQkNyQVE4TElBQVFyQUVQQ3lBQUVLMEJEd3NnQUJDdUFROExJQUFRcndFUEN5QUFFTE1CRHdzZ0FCQzJBUThMSUFBUXVRRVBDeUFBRUx3QkR3c2dBQkRKQVE4TElBQVF5Z0VQQ3lBQUVNc0JEd3NnQUJETUFRdStBUUVDZjBFQUpMd0JRWS8rQXhBZFFRRWdBSFJCZjNOeElnRWt4QUZCai80RElBRVFIeU9YQWtFQ2EwSC8vd054SkpjQ0k1Y0NJZ0VqbUFJaUFrSC9BWEVRSHlBQlFRRnFJQUpCZ1A0RGNVRUlkUkFmQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCUmcwQkFrQWdBRUVDYXc0REF3UUZBQXNNQlF0QkFDVEZBVUhBQUNTWUFnd0VDMEVBSk1ZQlFjZ0FKSmdDREFNTFFRQWt4d0ZCMEFBa21BSU1BZ3RCQUNUSUFVSFlBQ1NZQWd3QkMwRUFKTWtCUWVBQUpKZ0NDd3ZwQVFFQ2Z5TzlBUVJBUVFFa3ZBRkJBQ1M5QVFzanZnRWp4QUZ4UVI5eFFRQktCRUFqbXdKRlFRQWp2QUViQkg4anhRRkJBQ08vQVJzRWYwRUFFTTRCUVFFRkk4WUJRUUFqd0FFYkJIOUJBUkRPQVVFQkJTUEhBVUVBSThFQkd3Ui9RUUlRemdGQkFRVWp5QUZCQUNQQ0FSc0VmMEVERU00QlFRRUZJOGtCUVFBand3RWJCSDlCQkJET0FVRUJCVUVBQ3dzTEN3c0ZRUUFMQkVCQkFTT2JBaU9hQWhzRWYwRUFKSnNDUVFBa21nSkJBQ1NjQWtFQUpKMENRUmdGUVJRTElRQUxRUUVqbXdJam1nSWJCRUJCQUNTYkFrRUFKSm9DUVFBa25BSkJBQ1NkQWdzZ0FBOExRUUFMdGdFQkFuOUJBU1NuQWlPY0FnUkFJNWdDRUIxQi93RnhFTTBCRUpvQlFRQWttd0pCQUNTYUFrRUFKSndDUVFBa25RSUxFTThCSWdCQkFFb0VRQ0FBRUpvQkMwRUVJUUJCQUNPZEFrVkJBU09iQWlPYUFoc2JCRUFqbUFJUUhVSC9BWEVRelFFaEFBc2psZ0pCOEFGeEpKWUNJQUJCQUV3RVFDQUFEd3NnQUJDYUFTT2pBa0VCYWlJQkk2RUNUZ1IvSTZJQ1FRRnFKS0lDSUFFam9RSnJCU0FCQ3lTakFpT1lBaVBpQVVZRVFFRUJKT1VCQ3lBQUN3VUFJN29CQzdFQkFRTi9JQUJCZjBHQUNDQUFRUUJJR3lBQVFRQktHeUVDUVFBaEFBTkFJK1VCUlVFQUlBRkZRUUJCQUNBQVJTQURHeHNiQkVBUTBBRkJBRWdFUUVFQklRTUZJNWtDUWRDa0JDT09BblJPQkVCQkFTRUFCVUVCSUFFanVnRWdBazVCQUNBQ1FYOUtHeHNoQVFzTERBRUxDeUFBQkVBam1RSkIwS1FFSTQ0Q2RHc2ttUUlqcEFJUEN5QUJCRUFqcFFJUEN5UGxBUVJBUVFBazVRRWpwZ0lQQ3lPWUFrRUJhMEgvL3dOeEpKZ0NRWDhMQndCQmZ4RFNBUXMwQVFKL0EwQWdBVUVBVGtFQUlBSWdBRWdiQkVCQmZ4RFNBU0VCSUFKQkFXb2hBZ3dCQ3dzZ0FVRUFTQVJBSUFFUEMwRUFDd1VBSTU0Q0N3VUFJNThDQ3dVQUk2QUNDMXNBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBQkVBZ0FFRUJSZzBCQWtBZ0FFRUNhdzRHQXdRRkJnY0lBQXNNQ0FzajF3RVBDeVBhQVE4TEk5Z0JEd3NqMlFFUEN5UGJBUThMSTl3QkR3c2ozUUVQQ3lQZUFROExRUUFMaHdFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQUJFQWdBRUVCUmcwQkFrQWdBRUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBVUVBUnlUWEFRd0hDeUFCUVFCSEpOb0JEQVlMSUFGQkFFY2syQUVNQlFzZ0FVRUFSeVRaQVF3RUN5QUJRUUJISk5zQkRBTUxJQUZCQUVjazNBRU1BZ3NnQVVFQVJ5VGRBUXdCQ3lBQlFRQkhKTjRCQ3d0UkFRRi9RUUFrblFJZ0FCRFlBVVVFUUVFQklRRUxJQUJCQVJEWkFTQUJCRUJCQVVFQlFRQkJBVUVBSUFCQkEwd2JJZ0JCQUNQZ0FSc2JJQUJGUVFBajRRRWJHd1JBUVFFa3lRRkJCQkJhQ3dzTENRQWdBRUVBRU5rQkM1b0JBQ0FBUVFCS0JFQkJBQkRhQVFWQkFCRGJBUXNnQVVFQVNnUkFRUUVRMmdFRlFRRVEyd0VMSUFKQkFFb0VRRUVDRU5vQkJVRUNFTnNCQ3lBRFFRQktCRUJCQXhEYUFRVkJBeERiQVFzZ0JFRUFTZ1JBUVFRUTJnRUZRUVFRMndFTElBVkJBRW9FUUVFRkVOb0JCVUVGRU5zQkN5QUdRUUJLQkVCQkJoRGFBUVZCQmhEYkFRc2dCMEVBU2dSQVFRY1EyZ0VGUVFjUTJ3RUxDd2NBSUFBazRnRUxCd0JCZnlUaUFRc0hBQ0FBSk9NQkN3Y0FRWDhrNHdFTEJ3QWdBQ1RrQVFzSEFFRi9KT1FCQ3dVQUk0OENDd1VBSTVBQ0N3VUFJNUVDQ3dVQUk1SUNDd1VBSTVNQ0N3VUFJNVFDQ3dVQUk1VUNDd1VBSTVZQ0N3VUFJNWdDQ3dVQUk1Y0NDd3NBSTVnQ0VCMUIvd0Z4Q3dVQUkvSUJDNnNEQVFwL1FZQ0FBa0dBa0FJajZ3RWJJUWhCZ0xnQ1FZQ3dBaVBzQVJzaENRTkFJQVZCZ0FKSUJFQkJBQ0VFQTBBZ0JFR0FBa2dFUUNBSUlBVkJBM1ZCQlhRZ0NXb2dCRUVEZFdvaUFrR0FrSDVxTFFBQUVFMGhCaUFGUVFodklRRkJCeUFFUVFodmF5RUhRUUFoQXdKL0lBQkJBRXBCQUNPTkFoc0VRQ0FDUVlEUWZtb3RBQUFoQXdzZ0EwSEFBSEVMQkVCQkJ5QUJheUVCQzBFQUlRSWdBVUVCZENBR2FpSUdRWUNRZm1wQkFVRUFJQU5CQ0hFYklnSkJEWFJxTFFBQUlRcEJBQ0VCSUFaQmdaQithaUFDUVExMGFpMEFBRUVCSUFkMGNRUkFRUUloQVFzZ0FVRUJhaUFCUVFFZ0IzUWdDbkViSVFFZ0JVRUlkQ0FFYWtFRGJDRUNJQUJCQUVwQkFDT05BaHNFUUNBQ1FZQ2hDMm9pQWlBRFFRZHhJQUZCQUJCT0lnRkJIM0ZCQTNRNkFBQWdBa0VCYWlBQlFlQUhjVUVGZFVFRGREb0FBQ0FDUVFKcUlBRkJnUGdCY1VFS2RVRURkRG9BQUFVZ0FrR0FvUXRxSWdNZ0FVSEgvZ01RVHlJQlFZQ0EvQWR4UVJCMU9nQUFJQU5CQVdvZ0FVR0EvZ054UVFoMU9nQUFJQU5CQW1vZ0FUb0FBQXNnQkVFQmFpRUVEQUVMQ3lBRlFRRnFJUVVNQVFzTEM5Z0RBUXgvQTBBZ0JFRVhUa1VFUUVFQUlRTURRQ0FEUVI5SUJFQkJBVUVBSUFOQkQwb2lCeHNoQ1NBRVFROXJJQVFnQkVFUFNpSUFHMEVFZENJRklBTkJEMnRxSUFNZ0JXb2dCeHNoQ0VHQWtBSkJnSUFDSUFBYklRcEJ4LzRESVFkQmZ5RUdRWDhoQlVFQUlRRURRQ0FCUVFoSUJFQkJBQ0VDQTBBZ0FrRUZTQVJBSUFKQkEzUWdBV3BCQW5RaUFFR0MvQU5xRUIwZ0NFWUVRQ0FBUVlQOEEyb1FIU0VBUVFGQkFDQUFRUWh4UVFCSFFRQWpqUUliR3lBSlJnUkFRUWdoQVVFRklRSWdBQ0lGUVJCeEJIOUJ5ZjREQlVISS9nTUxJUWNMQ3lBQ1FRRnFJUUlNQVFzTElBRkJBV29oQVF3QkN3c2dCVUVBU0VFQUk0MENHd1JBUVlDNEFrR0FzQUlqN0FFYklRdEJmeUVBUVFBaEFnTkFJQUpCSUVnRVFFRUFJUUVEUUNBQlFTQklCRUFnQVVFRmRDQUxhaUFDYWlJR1FZQ1FmbW90QUFBZ0NFWUVRRUVnSVFKQklDRUJJQVloQUFzZ0FVRUJhaUVCREFFTEN5QUNRUUZxSVFJTUFRc0xJQUJCQUU0RWZ5QUFRWURRZm1vdEFBQUZRWDhMSVFZTFFRQWhBQU5BSUFCQkNFZ0VRQ0FJSUFvZ0NVRUFRUWNnQUNBRFFRTjBJQVJCQTNRZ0FHcEIrQUZCZ0tFWElBY2dCaUFGRUZBYUlBQkJBV29oQUF3QkN3c2dBMEVCYWlFRERBRUxDeUFFUVFGcUlRUU1BUXNMQzVrQ0FRbC9BMEFnQkVFSVRrVUVRRUVBSVFFRFFDQUJRUVZJQkVBZ0FVRURkQ0FFYWtFQ2RDSUFRWUQ4QTJvUUhSb2dBRUdCL0FOcUVCMGFJQUJCZ3Z3RGFoQWRJUUpCQVNFRkkrMEJCRUFnQWtFQ2IwRUJSZ1JBSUFKQkFXc2hBZ3RCQWlFRkN5QUFRWVA4QTJvUUhTRUdRUUFoQjBFQlFRQWdCa0VJY1VFQVIwRUFJNDBDR3hzaEIwSEkvZ01oQ0VISi9nTkJ5UDRESUFaQkVIRWJJUWhCQUNFQUEwQWdBQ0FGU0FSQVFRQWhBd05BSUFOQkNFZ0VRQ0FBSUFKcVFZQ0FBaUFIUVFCQkJ5QURJQVJCQTNRZ0FVRUVkQ0FEYWlBQVFRTjBha0hBQUVHQW9TQWdDRUYvSUFZUVVCb2dBMEVCYWlFRERBRUxDeUFBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3dzZ0JFRUJhaUVFREFFTEN3c0ZBQ1BMQVFzRkFDUE1BUXNGQUNQUEFRc1lBUUYvSTlFQklRQWowQUVFUUNBQVFRUnlJUUFMSUFBTE1BRUJmd05BQWtBZ0FFSC8vd05PRFFBZ0FFR0F0Y2tFYWlBQUVIWTZBQUFnQUVFQmFpRUFEQUVMQzBFQUpPVUJDeFlBRUJzL0FFR1VBVWdFUUVHVUFUOEFhMEFBR2dzTDNBRUFJQUJCbkFKSkJFQVBDeUFBUVJCcklRQUNRQUpBQWtBQ1FBSkFBa0FnQVVFQlJ3UkFJQUZCQWtZTkFRSkFJQUZCQTJzT0F3TUVCUUFMREFVTElBQVFGQXdGQ3lBQUtBSUVRZi8vLy84QWNVRUFUUVJBUVFCQmdBRkJ5d0JCRVJBQUFBc2dBQ0FBS0FJRVFRRnJOZ0lFSUFBUUZnd0VDeUFBRUJnTUF3c2dBQ2dDQkNJQlFZQ0FnSUIvY1NBQlFRRnFRWUNBZ0lCL2NVY0VRRUVBUVlBQlFkWUFRUVlRQUFBTElBQWdBVUVCYWpZQ0JDQUJRWUNBZ0lBSGNRUkFJQUFRRndzTUFnc2dBQkFaREFFTFFRQkJnQUZCNFFCQkdCQUFBQXNMTFFBQ1FBSkFBa0FnQUVFSWF5Z0NBQTREQUFBQkFnc1BDeUFBS0FJQUlnQUVRQ0FBSUFFUStBRUxEd3NBQ3dNQUFRc2RBQUpBQWtBQ1FDT3BBZzRDQVFJQUN3QUxRUUFoQUFzZ0FCRFNBUXNIQUNBQUpLa0NDeVVBQWtBQ1FBSkFBa0FqcVFJT0F3RUNBd0FMQUF0QkFTRUFDMEYvSVFFTElBRVEwZ0VMQzU4Q0JnQkJDQXN0SGdBQUFBRUFBQUFCQUFBQUhnQUFBSDRBYkFCcEFHSUFMd0J5QUhRQUx3QjBBR3dBY3dCbUFDNEFkQUJ6QUVFNEN6Y29BQUFBQVFBQUFBRUFBQUFvQUFBQVlRQnNBR3dBYndCakFHRUFkQUJwQUc4QWJnQWdBSFFBYndCdkFDQUFiQUJoQUhJQVp3QmxBRUh3QUFzdEhnQUFBQUVBQUFBQkFBQUFIZ0FBQUg0QWJBQnBBR0lBTHdCeUFIUUFMd0J3QUhVQWNnQmxBQzRBZEFCekFFR2dBUXN6SkFBQUFBRUFBQUFCQUFBQUpBQUFBRWtBYmdCa0FHVUFlQUFnQUc4QWRRQjBBQ0FBYndCbUFDQUFjZ0JoQUc0QVp3QmxBRUhZQVFzakZBQUFBQUVBQUFBQkFBQUFGQUFBQUg0QWJBQnBBR0lBTHdCeUFIUUFMZ0IwQUhNQVFZQUNDeFVEQUFBQUVBQUFBQUFBQUFBUUFBQUFBQUFBQUJBQU14QnpiM1Z5WTJWTllYQndhVzVuVlZKTUlXTnZjbVV2WkdsemRDOWpiM0psTG5WdWRHOTFZMmhsWkM1M1lYTnRMbTFoY0E9PSIpKS5pbnN0YW5jZTsKY29uc3QgYj1uZXcgVWludDhBcnJheShhLmV4cG9ydHMubWVtb3J5LmJ1ZmZlcik7cmV0dXJue2luc3RhbmNlOmEsYnl0ZU1lbW9yeTpiLHR5cGU6IldlYiBBc3NlbWJseSJ9fTtsZXQgcix1LEUsYztjPXtncmFwaGljc1dvcmtlclBvcnQ6dm9pZCAwLG1lbW9yeVdvcmtlclBvcnQ6dm9pZCAwLGNvbnRyb2xsZXJXb3JrZXJQb3J0OnZvaWQgMCxhdWRpb1dvcmtlclBvcnQ6dm9pZCAwLHdhc21JbnN0YW5jZTp2b2lkIDAsd2FzbUJ5dGVNZW1vcnk6dm9pZCAwLG9wdGlvbnM6dm9pZCAwLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLApXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxzcGVlZDowLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsbWVzc2FnZUhhbmRsZXI6KGEpPT57Y29uc3QgYj1uKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8KKGMuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEouYmluZCh2b2lkIDAsYyksYy5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKE0uYmluZCh2b2lkIDAsYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEwuYmluZCh2b2lkIDAsYyksYy5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihjLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShLLmJpbmQodm9pZCAwLGMpLGMuYXVkaW9Xb3JrZXJQb3J0KSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBQKHApOwpjLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2Mud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2soaCh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgZi5DT05GSUc6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkoYyxiLm1lc3NhZ2UuY29uZmlnKTtjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SRVNFVF9BVURJT19RVUVVRTpjLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBMQVk6aWYoIWMucGF1c2VkfHwhYy53YXNtSW5zdGFuY2V8fCFjLndhc21CeXRlTWVtb3J5KXtrKGgoe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfWMucGF1c2VkPSExO2MuZnBzVGltZVN0YW1wcz1bXTt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0KMDtjLm9wdGlvbnMuaXNHYmNDb2xvcml6YXRpb25FbmFibGVkP2Mub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlJiZjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoIndhc21ib3lnYiBicm93biByZWQgZGFya2Jyb3duIGdyZWVuIGRhcmtncmVlbiBpbnZlcnRlZCBwYXN0ZWxtaXggb3JhbmdlIHllbGxvdyBibHVlIGRhcmtibHVlIGdyYXlzY2FsZSIuc3BsaXQoIiAiKS5pbmRleE9mKGMub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlLnRvTG93ZXJDYXNlKCkpKTpjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoMCk7RihjLDFFMy9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5QQVVTRTpjLnBhdXNlZD0hMDtjLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KGMudXBkYXRlSWQpLGMudXBkYXRlSWQ9dm9pZCAwKTtrKGgodm9pZCAwLApiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SVU5fV0FTTV9FWFBPUlQ6YT1iLm1lc3NhZ2UucGFyYW1ldGVycz9jLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdLmFwcGx5KHZvaWQgMCxiLm1lc3NhZ2UucGFyYW1ldGVycyk6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XSgpO2soaCh7dHlwZTpmLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBkPWMud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoZD1iLm1lc3NhZ2UuZW5kKTthPWMud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxkKS5idWZmZXI7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgZi5HRVRfV0FTTV9DT05TVEFOVDprKGgoe3R5cGU6Zi5HRVRfV0FTTV9DT05TVEFOVCwKcmVzcG9uc2U6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuRk9SQ0VfT1VUUFVUX0ZSQU1FOkMoYyk7YnJlYWs7Y2FzZSBmLlNFVF9TUEVFRDpjLnNwZWVkPWIubWVzc2FnZS5zcGVlZDtjLmZwc1RpbWVTdGFtcHM9W107Yy50aW1lU3RhbXBzVW50aWxSZWFkeT02MDt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0wO2Mud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2JyZWFrO2Nhc2UgZi5JU19HQkM6YT0wPGMud2FzbUluc3RhbmNlLmV4cG9ydHMuaXNHQkMoKTtrKGgoe3R5cGU6Zi5JU19HQkMscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKCJVbmtub3duIFdhc21Cb3kgV29ya2VyIG1lc3NhZ2U6IixiKX19LGdldEZQUzooKT0+MDxjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PwpjLnNwZWVkJiYwPGMuc3BlZWQ/Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUqYy5zcGVlZDpjLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpjLmZwc1RpbWVTdGFtcHM/Yy5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGMubWVzc2FnZUhhbmRsZXIpfSkoKTsK";

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
        if (exp.isNegative()) {
            exp = exp.multiply(Integer[-1]);
            base = base.modInv(mod);
        }
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
var version = "0.5.0";
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
