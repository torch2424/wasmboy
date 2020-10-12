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

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
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
} else {
  // Create a mock keyval for node
  keyval = {
    get: () => {},
    set: () => {},
    delete: () => {},
    clear: () => {},
    keys: () => {}
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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBKKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX0xPQ0FUSU9OLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBLKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkFVRElPX0xBVEVOQ1k6YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQpiLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gTChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gQShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTisKZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQihhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIE0oYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhaztjYXNlIGYuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfQk9PVF9ST01fTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JBTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfTE9DQVRJT04udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlNFVF9NRU1PUlk6ZD1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2QuaW5jbHVkZXMoZy5CT09UX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkJPT1RfUk9NXSksYS5XQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSxhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9SQU0pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUkFNXSksYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuR0FNRUJPWV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5HQU1FQk9ZX01FTU9SWV0pLAphLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OKSxhLndhc21JbnN0YW5jZS5leHBvcnRzLmxvYWRTdGF0ZSgpKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLlNFVF9NRU1PUllfRE9ORX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX01FTU9SWTp7ZD17dHlwZTpmLkdFVF9NRU1PUll9O2xldCBsPVtdO3ZhciBjPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihjLmluY2x1ZGVzKGcuQk9PVF9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXt2YXIgZT0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGUsZSthLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX1NJWkUudmFsdWVPZigpKX1lbHNlIGU9bmV3IFVpbnQ4QXJyYXk7ZT1lLmJ1ZmZlcjtkW2cuQk9PVF9ST01dPWU7bC5wdXNoKGUpfWlmKGMuaW5jbHVkZXMoZy5DQVJUUklER0VfUk9NKSl7aWYoYS53YXNtQnl0ZU1lbW9yeSl7ZT1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIG09dm9pZCAwOzA9PT1lP209MzI3Njg6MTw9ZSYmMz49ZT9tPTIwOTcxNTI6NTw9ZSYmNj49ZT9tPTI2MjE0NDoxNTw9ZSYmMTk+PWU/bT0yMDk3MTUyOjI1PD1lJiYzMD49ZSYmKG09ODM4ODYwOCk7ZT1tP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbSk6Cm5ldyBVaW50OEFycmF5fWVsc2UgZT1uZXcgVWludDhBcnJheTtlPWUuYnVmZmVyO2RbZy5DQVJUUklER0VfUk9NXT1lO2wucHVzaChlKX1jLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JBTSkmJihlPUEoYSkuYnVmZmVyLGRbZy5DQVJUUklER0VfUkFNXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkNBUlRSSURHRV9IRUFERVIpJiYoYS53YXNtQnl0ZU1lbW9yeT8oZT1hLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMDgsZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGUsZSsyNykpOmU9bmV3IFVpbnQ4QXJyYXksZT1lLmJ1ZmZlcixkW2cuQ0FSVFJJREdFX0hFQURFUl09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5HQU1FQk9ZX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLApkW2cuR0FNRUJPWV9NRU1PUlldPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiYoZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcixkW2cuUEFMRVRURV9NRU1PUlldPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zYXZlU3RhdGUoKSxjPUIoYSkuYnVmZmVyLGRbZy5JTlRFUk5BTF9TVEFURV09YyxsLnB1c2goYykpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGQsYi5tZXNzYWdlSWQpLGwpfX19ZnVuY3Rpb24gTihhKXtsZXQgYj0idW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKTtmb3IoO2EuZnBzVGltZVN0YW1wc1swXTxiLTFFMzspYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCk7CmEuZnBzVGltZVN0YW1wcy5wdXNoKGIpO2EudGltZVN0YW1wc1VudGlsUmVhZHktLTswPmEudGltZVN0YW1wc1VudGlsUmVhZHkmJihhLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTApO3JldHVybiBifWZ1bmN0aW9uIHcoYSl7YS50aW1lU3RhbXBzVW50aWxSZWFkeT05MD49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU/MS4yNSpNYXRoLmZsb29yKGEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKToxMjB9ZnVuY3Rpb24gQyhhKXtsZXQgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gRChhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUUtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0YoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEYoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRT1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksRChhKSwhMDtOKGEpO2xldCBjPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoYj0+e2xldCBkO2M/eChhLGIpOihkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksCmIoZCkpfSkpLnRoZW4oYj0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEMoYSk7bGV0IGQ9e3R5cGU6Zi5VUERBVEVEfTtkW2cuQ0FSVFJJREdFX1JBTV09QShhKS5idWZmZXI7ZFtnLkdBTUVCT1lfTUVNT1JZXT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtkW2cuUEFMRVRURV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTisKYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtkW2cuSU5URVJOQUxfU1RBVEVdPUIoYSkuYnVmZmVyO09iamVjdC5rZXlzKGQpLmZvckVhY2goYT0+e3ZvaWQgMD09PWRbYV0mJihkW2FdPShuZXcgVWludDhBcnJheSkuYnVmZmVyKX0pO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGQpLFtkW2cuQ0FSVFJJREdFX1JBTV0sZFtnLkdBTUVCT1lfTUVNT1JZXSxkW2cuUEFMRVRURV9NRU1PUlldLGRbZy5JTlRFUk5BTF9TVEFURV1dKTsyPT09Yj9rKGgoe3R5cGU6Zi5CUkVBS1BPSU5UfSkpOkQoYSl9ZWxzZSBrKGgoe3R5cGU6Zi5DUkFTSEVEfSkpLGEucGF1c2VkPSEwfSl9ZnVuY3Rpb24geChhLGIpe3ZhciBkPS0xO2Q9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvKDEwMjQpOzEhPT1kJiZiKGQpO2lmKDE9PT1kKXtkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0TnVtYmVyT2ZTYW1wbGVzSW5BdWRpb0J1ZmZlcigpOwpsZXQgYz1yPj11Oy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmM/KEcoYSxkKSxzZXRUaW1lb3V0KCgpPT57dyhhKTt4KGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooRyhhLGQpLHgoYSxiKSl9fWZ1bmN0aW9uIEcoYSxiKXt2YXIgZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtsZXQgYz17dHlwZTpmLlVQREFURUQsYXVkaW9CdWZmZXI6ZCxudW1iZXJPZlNhbXBsZXM6YixmcHM6cixhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6NjA8YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9O2Q9W2RdO2lmKGEub3B0aW9ucyYmYS5vcHRpb25zLmVuYWJsZUF1ZGlvRGVidWdnaW5nKXt2YXIgZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwxQnVmZmVyPWU7ZC5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwyQnVmZmVyPWU7ZC5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwzQnVmZmVyPWU7ZC5wdXNoKGUpO2I9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWw0QnVmZmVyPWI7ZC5wdXNoKGIpfWEuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoYyksCmQpO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpfWxldCBwPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsdjtwfHwodj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2xldCBmPXtDT05ORUNUOiJDT05ORUNUIixJTlNUQU5USUFURV9XQVNNOiJJTlNUQU5USUFURV9XQVNNIixDTEVBUl9NRU1PUlk6IkNMRUFSX01FTU9SWSIsQ0xFQVJfTUVNT1JZX0RPTkU6IkNMRUFSX01FTU9SWV9ET05FIixHRVRfTUVNT1JZOiJHRVRfTUVNT1JZIixTRVRfTUVNT1JZOiJTRVRfTUVNT1JZIixTRVRfTUVNT1JZX0RPTkU6IlNFVF9NRU1PUllfRE9ORSIsR0VUX0NPTlNUQU5UUzoiR0VUX0NPTlNUQU5UUyIsR0VUX0NPTlNUQU5UU19ET05FOiJHRVRfQ09OU1RBTlRTX0RPTkUiLENPTkZJRzoiQ09ORklHIixSRVNFVF9BVURJT19RVUVVRToiUkVTRVRfQVVESU9fUVVFVUUiLFBMQVk6IlBMQVkiLEJSRUFLUE9JTlQ6IkJSRUFLUE9JTlQiLFBBVVNFOiJQQVVTRSIsClVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCIsRk9SQ0VfT1VUUFVUX0ZSQU1FOiJGT1JDRV9PVVRQVVRfRlJBTUUiLFNFVF9TUEVFRDoiU0VUX1NQRUVEIixJU19HQkM6IklTX0dCQyJ9LGc9e0JPT1RfUk9NOiJCT09UX1JPTSIsQ0FSVFJJREdFX1JBTToiQ0FSVFJJREdFX1JBTSIsQ0FSVFJJREdFX1JPTToiQ0FSVFJJREdFX1JPTSIsQ0FSVFJJREdFX0hFQURFUjoiQ0FSVFJJREdFX0hFQURFUiIsR0FNRUJPWV9NRU1PUlk6IkdBTUVCT1lfTUVNT1JZIixQQUxFVFRFX01FTU9SWToiUEFMRVRURV9NRU1PUlkiLElOVEVSTkFMX1NUQVRFOiJJTlRFUk5BTF9TVEFURSJ9LAp0PTAseT17fSxIPShhLGIpPT57bGV0IGM9IltXYXNtQm95XSI7LTk5OTkhPT1hJiYoYys9YCAweCR7YS50b1N0cmluZygxNil9IGApOy05OTk5IT09YiYmKGMrPWAgMHgke2IudG9TdHJpbmcoMTYpfSBgKTtjb25zb2xlLmxvZyhjKX0sej17aW5kZXg6e2NvbnNvbGVMb2c6SCxjb25zb2xlTG9nVGltZW91dDooYSxiLGMpPT57eVthXXx8KHlbYV09ITAsSChhLGIpLHNldFRpbWVvdXQoKCk9PntkZWxldGUgeVthXX0sYykpfX0sZW52OnthYm9ydDooKT0+e2NvbnNvbGUuZXJyb3IoIkFzc2VtYmx5U2NyaXB0IEltcG9ydCBPYmplY3QgQWJvcnRlZCEiKX19fSxJPWFzeW5jIGE9PntsZXQgYj12b2lkIDA7cmV0dXJuIGI9V2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmc/YXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcoZmV0Y2goYSkseik6YXdhaXQgKGFzeW5jKCk9Pntjb25zdCBiPWF3YWl0IGZldGNoKGEpLnRoZW4oYT0+YS5hcnJheUJ1ZmZlcigpKTtyZXR1cm4gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYiwKeil9KSgpfSxPPWFzeW5jIGE9PnthPUJ1ZmZlci5mcm9tKGEuc3BsaXQoIiwiKVsxXSwiYmFzZTY0Iik7cmV0dXJuIGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGEseil9LFA9YXN5bmMgYT0+e2E9KGE/YXdhaXQgSSgiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJmUkJnQVg4QmYyQUJmd0JnQUFGL1lBQUFZQUovZndGL1lBSi9md0JnQTM5L2Z3QmdCbjkvZjM5L2Z3QmdCSDkvZjM4QVlBZC9mMzkvZjM5L0FHQUlmMzkvZjM5L2YzOEFZQXAvZjM5L2YzOS9mMzkvQUdBRGYzOS9BWDlnQkg5L2YzOEJmMkFGZjM5L2YzOEJmMkFOZjM5L2YzOS9mMzkvZjM5L2Z3Ri9BZzBCQTJWdWRnVmhZbTl5ZEFBSUE1TUJrUUVGQlFZQ0JBWU1CQUFCQUFNQkFRTURBd3NDQXdNREF3TURBd01EQWdJQ0FnNEVEd2tIQndVQkFRTUFBQUFBQUEwQkFRTUFBZ0FBQlFNQkFRRUJCQUVCQVFFRUJRWUVBd0VCQVFJRkJnQUFBQUFBQUFBQUFRRUFBUUVBQUFFQUFBQUFBQUFBQUFFQ0FnSUFBZ0FDQWdJQkNnRURBUU1CQXdJQ0FnSUNBZ0lDQWdJQ0FnRURBd0lDQWdJREF3TUJBQVFCQlFNQkFBRUczZ3VZQW44QlFRQUxmd0ZCQUF0L0FFRUFDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBUUMzOEFRWUNBQVF0L0FFR0FrQUVMZndCQmdJQUNDMzhBUVlDUUF3dC9BRUdBZ0FFTGZ3QkJnQkFMZndCQmdJQUVDMzhBUVlDUUJBdC9BRUdBQVF0L0FFR0FrUVFMZndCQmdMZ0JDMzhBUVlESkJRdC9BRUdBMkFVTGZ3QkJnS0VMQzM4QVFZQ0FEQXQvQUVHQW9SY0xmd0JCZ0lBSkMzOEFRWUNoSUF0L0FFR0ErQUFMZndCQmdKQUVDMzhBUVlDSkhRdC9BRUdBbVNFTGZ3QkJnSUFJQzM4QVFZQ1pLUXQvQUVHQWdBZ0xmd0JCZ0preEMzOEFRWUNBQ0F0L0FFR0FtVGtMZndCQmdJQUlDMzhBUVlDWndRQUxmd0JCZ0lBSUMzOEFRWUNaeVFBTGZ3QkJnSUFJQzM4QVFZQ1owUUFMZndCQmdCUUxmd0JCZ0szUkFBdC9BRUdBaVBnREMzOEFRWUMxeVFRTGZ3QkIvLzhEQzM4QVFRQUxmd0JCZ0xYTkJBdC9BRUdVQVF0L0FVRUFDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWDhMZndGQmZ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFUEMzOEJRUThMZndGQkR3dC9BVUVQQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkIvd0FMZndGQi93QUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJmd3QvQVVGL0MzOEJRWDhMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVlDbzFya0hDMzhCUVFBTGZ3RkJBQXQvQVVHQXFOYTVCd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BRUdnQ1F0L0FVRUFDd2ZtRUdVR2JXVnRiM0o1QWdBSFgxOWhiR3h2WXdBSUNGOWZjbVYwWVdsdUFBa0pYMTl5Wld4bFlYTmxBQW9KWDE5amIyeHNaV04wQUkwQkMxOWZjblIwYVY5aVlYTmxBNVlDQm1OdmJtWnBad0FTRG1oaGMwTnZjbVZUZEdGeWRHVmtBQk1KYzJGMlpWTjBZWFJsQUJZSmJHOWhaRk4wWVhSbEFCd0ZhWE5IUWtNQUhSSm5aWFJUZEdWd2MxQmxjbE4wWlhCVFpYUUFIZ3RuWlhSVGRHVndVMlYwY3dBZkNHZGxkRk4wWlhCekFDQVZaWGhsWTNWMFpVMTFiSFJwY0d4bFJuSmhiV1Z6QUd3TVpYaGxZM1YwWlVaeVlXMWxBR3NaWlhobFkzVjBaVVp5WVcxbFFXNWtRMmhsWTJ0QmRXUnBid0NQQVJWbGVHVmpkWFJsVlc1MGFXeERiMjVrYVhScGIyNEFrQUVMWlhobFkzVjBaVk4wWlhBQWFCUm5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkQUJ0REdkbGRFTjVZMnhsVTJWMGN3QnVDV2RsZEVONVkyeGxjd0J2RG5ObGRFcHZlWEJoWkZOMFlYUmxBSEVmWjJWMFRuVnRZbVZ5VDJaVFlXMXdiR1Z6U1c1QmRXUnBiMEoxWm1abGNnQnBFR05zWldGeVFYVmthVzlDZFdabVpYSUFHQnh6WlhSTllXNTFZV3hEYjJ4dmNtbDZZWFJwYjI1UVlXeGxkSFJsQUEwWFYwRlRUVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRETGhOWFFWTk5RazlaWDAxRlRVOVNXVjlUU1ZwRkF5OFNWMEZUVFVKUFdWOVhRVk5OWDFCQlIwVlRBekFlUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgweFBRMEZVU1U5T0F3SWFRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDFOSldrVURBeFpYUVZOTlFrOVpYMU5VUVZSRlgweFBRMEZVU1U5T0F3UVNWMEZUVFVKUFdWOVRWRUZVUlY5VFNWcEZBd1VnUjBGTlJVSlBXVjlKVGxSRlVrNUJURjlOUlUxUFVsbGZURTlEUVZSSlQwNEREQnhIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOVRTVnBGQXcwU1ZrbEVSVTlmVWtGTlgweFBRMEZVU1U5T0F3WU9Wa2xFUlU5ZlVrRk5YMU5KV2tVREJ4RlhUMUpMWDFKQlRWOU1UME5CVkVsUFRnTUlEVmRQVWt0ZlVrRk5YMU5KV2tVRENTWlBWRWhGVWw5SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ01LSWs5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VEQ3hoSFVrRlFTRWxEVTE5UFZWUlFWVlJmVEU5RFFWUkpUMDRER2hSSFVrRlFTRWxEVTE5UFZWUlFWVlJmVTBsYVJRTWJGRWRDUTE5UVFVeEZWRlJGWDB4UFEwRlVTVTlPQXc0UVIwSkRYMUJCVEVWVVZFVmZVMGxhUlFNUEdFSkhYMUJTU1U5U1NWUlpYMDFCVUY5TVQwTkJWRWxQVGdNUUZFSkhYMUJTU1U5U1NWUlpYMDFCVUY5VFNWcEZBeEVPUmxKQlRVVmZURTlEUVZSSlQwNERFZ3BHVWtGTlJWOVRTVnBGQXhNWFFrRkRTMGRTVDFWT1JGOU5RVkJmVEU5RFFWUkpUMDRERkJOQ1FVTkxSMUpQVlU1RVgwMUJVRjlUU1ZwRkF4VVNWRWxNUlY5RVFWUkJYMHhQUTBGVVNVOU9BeFlPVkVsTVJWOUVRVlJCWDFOSldrVURGeEpQUVUxZlZFbE1SVk5mVEU5RFFWUkpUMDRER0E1UFFVMWZWRWxNUlZOZlUwbGFSUU1aRlVGVlJFbFBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWtFVUZWUkVsUFgwSlZSa1pGVWw5VFNWcEZBeVVaUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01jRlVOSVFVNU9SVXhmTVY5Q1ZVWkdSVkpmVTBsYVJRTWRHVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZURTlEUVZSSlQwNERIaFZEU0VGT1RrVk1YekpmUWxWR1JrVlNYMU5KV2tVREh4bERTRUZPVGtWTVh6TmZRbFZHUmtWU1gweFBRMEZVU1U5T0F5QVZRMGhCVGs1RlRGOHpYMEpWUmtaRlVsOVRTVnBGQXlFWlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNaUZVTklRVTVPUlV4Zk5GOUNWVVpHUlZKZlUwbGFSUU1qRmtOQlVsUlNTVVJIUlY5U1FVMWZURTlEUVZSSlQwNERKaEpEUVZKVVVrbEVSMFZmVWtGTlgxTkpXa1VESnhGQ1QwOVVYMUpQVFY5TVQwTkJWRWxQVGdNb0RVSlBUMVJmVWs5TlgxTkpXa1VES1JaRFFWSlVVa2xFUjBWZlVrOU5YMHhQUTBGVVNVOU9BeW9TUTBGU1ZGSkpSRWRGWDFKUFRWOVRTVnBGQXlzZFJFVkNWVWRmUjBGTlJVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERMQmxFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeTBoWjJWMFYyRnpiVUp2ZVU5bVpuTmxkRVp5YjIxSFlXMWxRbTk1VDJabWMyVjBBQXNiYzJWMFVISnZaM0poYlVOdmRXNTBaWEpDY21WaGEzQnZhVzUwQUhJZGNtVnpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUFjeGx6WlhSU1pXRmtSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBSFFiY21WelpYUlNaV0ZrUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUhVYWMyVjBWM0pwZEdWSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQWRoeHlaWE5sZEZkeWFYUmxSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBSGNNWjJWMFVtVm5hWE4wWlhKQkFIZ01aMlYwVW1WbmFYTjBaWEpDQUhrTVoyVjBVbVZuYVhOMFpYSkRBSG9NWjJWMFVtVm5hWE4wWlhKRUFIc01aMlYwVW1WbmFYTjBaWEpGQUh3TVoyVjBVbVZuYVhOMFpYSklBSDBNWjJWMFVtVm5hWE4wWlhKTUFINE1aMlYwVW1WbmFYTjBaWEpHQUg4UloyVjBVSEp2WjNKaGJVTnZkVzUwWlhJQWdBRVBaMlYwVTNSaFkydFFiMmx1ZEdWeUFJRUJHV2RsZEU5d1kyOWtaVUYwVUhKdlozSmhiVU52ZFc1MFpYSUFnZ0VGWjJWMFRGa0Fnd0VkWkhKaGQwSmhZMnRuY205MWJtUk5ZWEJVYjFkaGMyMU5aVzF2Y25rQWhBRVlaSEpoZDFScGJHVkVZWFJoVkc5WFlYTnRUV1Z0YjNKNUFJVUJFMlJ5WVhkUFlXMVViMWRoYzIxTlpXMXZjbmtBaGdFR1oyVjBSRWxXQUljQkIyZGxkRlJKVFVFQWlBRUdaMlYwVkUxQkFJa0JCbWRsZEZSQlF3Q0tBUk4xY0dSaGRHVkVaV0oxWjBkQ1RXVnRiM0o1QUlzQkZGOWZjMlYwUVhKbmRXMWxiblJ6VEdWdVozUm9BSkVCQ0FLTUFRcVN2QUtSQVpVQ0FRUi9JQUVvQWdBaUFrRUJjVVVFUUVFQVFaQUlRWlVDUVE0UUFBQUxJQUpCZkhFaUFrSHcvLy8vQTBsQkFDQUNRUkJQRzBVRVFFRUFRWkFJUVpjQ1FRNFFBQUFMSUFKQmdBSkpCRUFnQWtFRWRpRUNCU0FDUVI4Z0FtZHJJZ05CQkd0MlFSQnpJUUlnQTBFSGF5RURDeUFDUVJCSlFRQWdBMEVYU1J0RkJFQkJBRUdRQ0VHa0FrRU9FQUFBQ3lBQktBSVVJUVFnQVNnQ0VDSUZCRUFnQlNBRU5nSVVDeUFFQkVBZ0JDQUZOZ0lRQ3lBQklBQWdBaUFEUVFSMGFrRUNkR29vQW1CR0JFQWdBQ0FDSUFOQkJIUnFRUUowYWlBRU5nSmdJQVJGQkVBZ0FDQURRUUowYWlJRUtBSUVRWDRnQW5keElRRWdCQ0FCTmdJRUlBRkZCRUFnQUNBQUtBSUFRWDRnQTNkeE5nSUFDd3NMQy84REFRZC9JQUZGQkVCQkFFR1FDRUhOQVVFT0VBQUFDeUFCS0FJQUlnUkJBWEZGQkVCQkFFR1FDRUhQQVVFT0VBQUFDeUFCUVJCcUlBRW9BZ0JCZkhGcUlnVW9BZ0FpQWtFQmNRUkFJQVJCZkhGQkVHb2dBa0Y4Y1dvaUEwSHcvLy8vQTBrRVFBSi9JQUFnQlJBQklBRWdBeUFFUVFOeGNpSUVOZ0lBSUFGQkVHb2dBU2dDQUVGOGNXb2lCU2dDQUFzaEFnc0xJQVJCQW5FRVFBSi9JQUZCQkdzb0FnQWlBeWdDQUNJSFFRRnhSUVJBUVFCQmtBaEI1QUZCRUJBQUFBc2dCMEY4Y1VFUWFpQUVRWHh4YWlJSVFmRC8vLzhEU1FSL0lBQWdBeEFCSUFNZ0NDQUhRUU54Y2lJRU5nSUFJQU1GSUFFTEN5RUJDeUFGSUFKQkFuSTJBZ0FnQkVGOGNTSURRZkQvLy84RFNVRUFJQU5CRUU4YlJRUkFRUUJCa0FoQjh3RkJEaEFBQUFzZ0JTQURJQUZCRUdwcVJ3UkFRUUJCa0FoQjlBRkJEaEFBQUFzZ0JVRUVheUFCTmdJQUlBTkJnQUpKQkVBZ0EwRUVkaUVEQlNBRFFSOGdBMmRySWdSQkJHdDJRUkJ6SVFNZ0JFRUhheUVHQ3lBRFFSQkpRUUFnQmtFWFNSdEZCRUJCQUVHUUNFR0VBa0VPRUFBQUN5QUFJQU1nQmtFRWRHcEJBblJxS0FKZ0lRUWdBVUVBTmdJUUlBRWdCRFlDRkNBRUJFQWdCQ0FCTmdJUUN5QUFJQU1nQmtFRWRHcEJBblJxSUFFMkFtQWdBQ0FBS0FJQVFRRWdCblJ5TmdJQUlBQWdCa0VDZEdvaUFDQUFLQUlFUVFFZ0EzUnlOZ0lFQzlFQkFRSi9JQUpCRDNGRlFRQWdBVUVQY1VWQkFDQUJJQUpOR3h0RkJFQkJBRUdRQ0VHQ0EwRUZFQUFBQ3lBQUtBS2dEQ0lEQkVBZ0FTQURRUkJxU1FSQVFRQkJrQWhCakFOQkVCQUFBQXNnQXlBQlFSQnJSZ1JBQW44Z0F5Z0NBQ0VFSUFGQkVHc0xJUUVMQlNBQklBQkJwQXhxU1FSQVFRQkJrQWhCbUFOQkJSQUFBQXNMSUFJZ0FXc2lBa0V3U1FSQUR3c2dBU0FFUVFKeElBSkJJR3RCQVhKeU5nSUFJQUZCQURZQ0VDQUJRUUEyQWhRZ0FTQUNha0VRYXlJQ1FRSTJBZ0FnQUNBQ05nS2dEQ0FBSUFFUUFndWVBUUVEZnlNQUlnSkZCRUJCQVQ4QUlnQktCSDlCQVNBQWEwQUFRUUJJQlVFQUN3UkFBQXRCd0FraEFrSEFDVUVBTmdJQVFlQVZRUUEyQWdBRFFDQUJRUmRKQkVBZ0FVRUNkRUhBQ1dwQkFEWUNCRUVBSVFBRFFDQUFRUkJKQkVBZ0FDQUJRUVIwYWtFQ2RFSEFDV3BCQURZQ1lDQUFRUUZxSVFBTUFRc0xJQUZCQVdvaEFRd0JDd3RCd0FsQjhCVS9BRUVRZEJBRFFjQUpKQUFMSUFJTDN3RUJBWDhnQVVHQUFra0VRQ0FCUVFSMklRRUZBbjhnQVVINC8vLy9BVWtFUUNBQlFRRkJHeUFCWjJ0MGFrRUJheUVCQ3lBQkMwRWZJQUZuYXlJQ1FRUnJka0VRY3lFQklBSkJCMnNoQWdzZ0FVRVFTVUVBSUFKQkYwa2JSUVJBUVFCQmtBaEIwZ0pCRGhBQUFBc2dBQ0FDUVFKMGFpZ0NCRUYvSUFGMGNTSUJCSDhnQUNBQmFDQUNRUVIwYWtFQ2RHb29BbUFGSUFBb0FnQkJmeUFDUVFGcWRIRWlBUVIvSUFBZ0FXZ2lBVUVDZEdvb0FnUWlBa1VFUUVFQVFaQUlRZDhDUVJJUUFBQUxJQUFnQW1nZ0FVRUVkR3BCQW5ScUtBSmdCVUVBQ3dzTGh3RUJBbjhnQVNnQ0FDRURJQUpCRDNFRVFFRUFRWkFJUWUwQ1FRNFFBQUFMSUFOQmZIRWdBbXNpQkVFZ1R3UkFJQUVnQWlBRFFRSnhjallDQUNBQ0lBRkJFR3BxSWdFZ0JFRVFhMEVCY2pZQ0FDQUFJQUVRQWdVZ0FTQURRWDV4TmdJQUlBRkJFR29pQUNBQktBSUFRWHh4YWlBQUlBRW9BZ0JCZkhGcUtBSUFRWDF4TmdJQUN3dXFBZ0VEZnlNQkJFQkJBRUdRQ0VIMEEwRU9FQUFBQ3lBQklnTkI4UC8vL3dOUEJFQkJ3QWhCa0FoQnpRTkJIaEFBQUFzZ0FDQURRUTlxUVhCeElnRkJFQ0FCUVJCTEd5SUJFQVVpQkVVRVFFRUJKQUZCQUNRQklBQWdBUkFGSWdSRkJFQWdBVUg0Ly8vL0FVa0VmeUFCUVFGQkd5QUJaMnQwUVFGcmFnVWdBUXRCRUQ4QUlnUkJFSFJCRUdzZ0FDZ0NvQXhIZEdwQi8vOERha0dBZ0h4eFFSQjJJUVVnQkNBRklBUWdCVW9iUUFCQkFFZ0VRQ0FGUUFCQkFFZ0VRQUFMQ3lBQUlBUkJFSFEvQUVFUWRCQURJQUFnQVJBRklnUkZCRUJCQUVHUUNFR0FCRUVVRUFBQUN3c0xJQVFvQWdCQmZIRWdBVWtFUUVFQVFaQUlRWWdFUVE0UUFBQUxJQVJCQURZQ0JDQUVJQUkyQWdnZ0JDQUROZ0lNSUFBZ0JCQUJJQUFnQkNBQkVBWWdCQXNOQUJBRUlBQWdBUkFIUVJCcUMyRUJBbjhnQUVHOENVc0VRQ0FBUVJCcklnRW9BZ1FpQWtHQWdJQ0FmM0VnQWtFQmFrR0FnSUNBZjNGSEJFQkJBRUdBQ1VIdEFFRURFQUFBQ3lBQklBSkJBV28yQWdRZ0FTZ0NBRUVCY1FSQVFRQkJnQWxCOEFCQkRoQUFBQXNMSUFBTEV3QWdBRUc4Q1VzRVFDQUFRUkJyRUk0QkN3dVBBZ0VCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFReDFEZzRBQVFFQkFnSUNBZ01EQkFRRkJnY0xJLzBCQkVBai9nRUVRQ0FBUVlBQ1NBMEpJQUJCZ0JKSVFRQWdBRUgvQTBvYkRRa0ZRUUFnQUVHQUFrZ2ovZ0ViRFFrTEN3c2dBRUdBcmRFQWFnOExJQUJCZ0lBQmF5RUJJQUZCQUNQdkFTSUFSU1AzQVJzRWYwRUJCU0FBQzBFT2RHcEJnSzNSQUdvUEN5QUFRWUNRZm1vai9nRUVmMEhQL2dNUUN5MEFBRUVCY1FWQkFBdEJEWFJxRHdzZ0FDUHdBVUVOZEdwQmdObkdBR29QQ3lBQVFZQ1FmbW9QQ3lBQVFRRWovZ0VFZjBIdy9nTVFDeTBBQUVFSGNRVkJBQXNpQVNBQlFRRkpHMEVNZEdwQmdQQjlhZzhMSUFCQmdGQnFEd3NnQUVHQW1kRUFhZ3ZEQVFCQkFDVC9BVUVBSklBQ1FRQWtnUUpCQUNTQ0FrRUFKSU1DUVFBa2hBSkJBQ1NGQWtFQUpJWUNRUUFraHdKQkFDU0lBa0VBSklrQ1FRQWtpZ0pCQUNTTEFrRUFKSXdDUVFBa2pRSkJBQ1NPQWlQOUFRUkFEd3NqL2dFRVFFRVJKSUFDUVlBQkpJY0NRUUFrZ1FKQkFDU0NBa0gvQVNTREFrSFdBQ1NFQWtFQUpJVUNRUTBraGdJRlFRRWtnQUpCc0FFa2h3SkJBQ1NCQWtFVEpJSUNRUUFrZ3dKQjJBRWtoQUpCQVNTRkFrSE5BQ1NHQWd0QmdBSWtpUUpCL3Y4REpJZ0NDNkVJQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBNE5BQUVDQXdRRkJnY0lDUW9MREEwTFFmTGx5d2NrTzBHZ3dZSUZKRHhCMkxEaEFpUTlRWWlRSUNRK1FmTGx5d2NrUDBHZ3dZSUZKRUJCMkxEaEFpUkJRWWlRSUNSQ1FmTGx5d2NrUTBHZ3dZSUZKRVJCMkxEaEFpUkZRWWlRSUNSR0RBd0xRZi8vL3dja08wSGoydjRISkR4QmdPS1FCQ1E5UVFBa1BrSC8vLzhISkQ5QjQ5citCeVJBUVlEaWtBUWtRVUVBSkVKQi8vLy9CeVJEUWVQYS9nY2tSRUdBNHBBRUpFVkJBQ1JHREFzTFFmLy8vd2NrTzBHRWlmNEhKRHhCdXZUUUJDUTlRUUFrUGtILy8vOEhKRDlCc2Y3dkF5UkFRWUNJQWlSQlFRQWtRa0gvLy84SEpFTkIvOHVPQXlSRVFmOEJKRVZCQUNSR0RBb0xRY1hOL3dja08wR0V1Ym9HSkR4QnFkYVJCQ1E5UVlqaTZBSWtQa0gvLy84SEpEOUI0OXIrQnlSQVFZRGlrQVFrUVVFQUpFSkIvLy8vQnlSRFFlUGEvZ2NrUkVHQTRwQUVKRVZCQUNSR0RBa0xRZi8vL3dja08wR0Evc3NDSkR4QmdJVDlCeVE5UVFBa1BrSC8vLzhISkQ5QmdQN0xBaVJBUVlDRS9RY2tRVUVBSkVKQi8vLy9CeVJEUVlEK3l3SWtSRUdBaFAwSEpFVkJBQ1JHREFnTFFmLy8vd2NrTzBHeC91OERKRHhCeGNjQkpEMUJBQ1ErUWYvLy93Y2tQMEdFaWY0SEpFQkJ1dlRRQkNSQlFRQWtRa0gvLy84SEpFTkJoSW4rQnlSRVFicjAwQVFrUlVFQUpFWU1Cd3RCQUNRN1FZU0pBaVE4UVlDOC93Y2tQVUgvLy84SEpENUJBQ1EvUVlTSkFpUkFRWUM4L3dja1FVSC8vLzhISkVKQkFDUkRRWVNKQWlSRVFZQzgvd2NrUlVILy8vOEhKRVlNQmd0QnBmLy9CeVE3UVpTcC9nY2tQRUgvcWRJRUpEMUJBQ1ErUWFYLy93Y2tQMEdVcWY0SEpFQkIvNm5TQkNSQlFRQWtRa0dsLy84SEpFTkJsS24rQnlSRVFmK3AwZ1FrUlVFQUpFWU1CUXRCLy8vL0J5UTdRWUQrL3dja1BFR0FnUHdISkQxQkFDUStRZi8vL3dja1AwR0EvdjhISkVCQmdJRDhCeVJCUVFBa1FrSC8vLzhISkVOQmdQNy9CeVJFUVlDQS9BY2tSVUVBSkVZTUJBdEIvLy8vQnlRN1FZRCsvd2NrUEVHQWxPMERKRDFCQUNRK1FmLy8vd2NrUDBIL3k0NERKRUJCL3dFa1FVRUFKRUpCLy8vL0J5UkRRYkgrN3dNa1JFR0FpQUlrUlVFQUpFWU1Bd3RCLy8vL0J5UTdRZi9MamdNa1BFSC9BU1E5UVFBa1BrSC8vLzhISkQ5QmhJbitCeVJBUWJyMDBBUWtRVUVBSkVKQi8vLy9CeVJEUWJIKzd3TWtSRUdBaUFJa1JVRUFKRVlNQWd0Qi8vLy9CeVE3UWQ2WnNnUWtQRUdNcGNrQ0pEMUJBQ1ErUWYvLy93Y2tQMEdFaWY0SEpFQkJ1dlRRQkNSQlFRQWtRa0gvLy84SEpFTkI0OXIrQnlSRVFZRGlrQVFrUlVFQUpFWU1BUXRCLy8vL0J5UTdRYVhMbGdVa1BFSFNwTWtDSkQxQkFDUStRZi8vL3dja1AwR2x5NVlGSkVCQjBxVEpBaVJCUVFBa1FrSC8vLzhISkVOQnBjdVdCU1JFUWRLa3lRSWtSVUVBSkVZTEM5b0lBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRWWdCUndSQUlBQkI0UUJHRFFFZ0FFRVVSZzBDSUFCQnhnQkdEUU1nQUVIWkFFWU5CQ0FBUWNZQlJnMEVJQUJCaGdGR0RRVWdBRUdvQVVZTkJTQUFRYjhCUmcwR0lBQkJ6Z0ZHRFFZZ0FFSFJBVVlOQmlBQVFmQUJSZzBHSUFCQkowWU5CeUFBUWNrQVJnMEhJQUJCM0FCR0RRY2dBRUd6QVVZTkJ5QUFRY2tCUmcwSUlBQkI4QUJHRFFrZ0FFSEdBRVlOQ2lBQVFkTUJSZzBMREF3TFFmKzVsZ1VrTzBHQS92OEhKRHhCZ01ZQkpEMUJBQ1ErUWYrNWxnVWtQMEdBL3Y4SEpFQkJnTVlCSkVGQkFDUkNRZis1bGdVa1EwR0EvdjhISkVSQmdNWUJKRVZCQUNSR0RBc0xRZi8vL3dja08wSC95NDRESkR4Qi93RWtQVUVBSkQ1Qi8vLy9CeVEvUVlTSi9nY2tRRUc2OU5BRUpFRkJBQ1JDUWYvLy93Y2tRMEgveTQ0REpFUkIvd0VrUlVFQUpFWU1DZ3RCLy8vL0J5UTdRWVNKL2dja1BFRzY5TkFFSkQxQkFDUStRZi8vL3dja1AwR3gvdThESkVCQmdJZ0NKRUZCQUNSQ1FmLy8vd2NrUTBHRWlmNEhKRVJCdXZUUUJDUkZRUUFrUmd3SkMwSC82OVlGSkR0QmxQLy9CeVE4UWNLMHRRVWtQVUVBSkQ1QkFDUS9RZi8vL3dja1FFR0VpZjRISkVGQnV2VFFCQ1JDUVFBa1EwSC8vLzhISkVSQmhJbitCeVJGUWJyMDBBUWtSZ3dJQzBILy8vOEhKRHRCaE51MkJTUThRZnZtaVFJa1BVRUFKRDVCLy8vL0J5US9RWURtL1Fja1FFR0FoTkVFSkVGQkFDUkNRZi8vL3dja1EwSC8rK29DSkVSQmdJRDhCeVJGUWY4QkpFWU1Cd3RCblAvL0J5UTdRZi9yMGdRa1BFSHpxSTRESkQxQnV2UUFKRDVCd29yL0J5US9RWUNzL3dja1FFR0E5TkFFSkVGQmdJQ29BaVJDUWYvLy93Y2tRMEdFaWY0SEpFUkJ1dlRRQkNSRlFRQWtSZ3dHQzBHQS9xOERKRHRCLy8vL0J5UThRY3FrL1Fja1BVRUFKRDVCLy8vL0J5US9RZi8vL3dja1FFSC95NDRESkVGQi93RWtRa0gvLy84SEpFTkI0OXIrQnlSRVFZRGlrQVFrUlVFQUpFWU1CUXRCLzdtV0JTUTdRWUQrL3dja1BFR0F4Z0VrUFVFQUpENUIwc2I5QnlRL1FZQ0EyQVlrUUVHQWdJd0RKRUZCQUNSQ1FmOEJKRU5CLy8vL0J5UkVRZnYrL3dja1JVSC9pUUlrUmd3RUMwSE8vLzhISkR0Qjc5K1BBeVE4UWJHSThnUWtQVUhhdE9rQ0pENUIvLy8vQnlRL1FZRG0vUWNrUUVHQWhORUVKRUZCQUNSQ1FmLy8vd2NrUTBIL3k0NERKRVJCL3dFa1JVRUFKRVlNQXd0Qi8vLy9CeVE3UVlTSi9nY2tQRUc2OU5BRUpEMUJBQ1ErUWYvLy93Y2tQMEdBL2dNa1FFR0FpTVlCSkVGQmdKUUJKRUpCLy8vL0J5UkRRZi9MamdNa1JFSC9BU1JGUVFBa1Jnd0NDMEgvLy84SEpEdEIvOHVPQXlROFFmOEJKRDFCQUNRK1FZRCsvd2NrUDBHQWdQd0hKRUJCZ0lDTUF5UkJRUUFrUWtILy8vOEhKRU5Cc2Y3dkF5UkVRWUNJQWlSRlFRQWtSZ3dCQzBILy8vOEhKRHRCaE51MkJTUThRZnZtaVFJa1BVRUFKRDVCLy8vL0J5US9RZVBhL2dja1FFSGoydjRISkVGQkFDUkNRZi8vL3dja1EwSC95NDRESkVSQi93RWtSVUVBSkVZTEM5RUNBUUovUVFBazZBRkJBQ1RwQVVFQUpPb0JRUUFrNndGQkFDVHNBVUVBSk8wQlFRQWs3Z0ZCa0FFazZnRWovZ0VFUUVIQi9nTVFDMEdCQVRvQUFFSEUvZ01RQzBHUUFUb0FBRUhIL2dNUUMwSDhBVG9BQUFWQndmNERFQXRCaFFFNkFBQkJ4djRERUF0Qi93RTZBQUJCeC80REVBdEIvQUU2QUFCQnlQNERFQXRCL3dFNkFBQkJ5ZjRERUF0Qi93RTZBQUFMUVpBQkpPb0JRY0QrQXhBTFFaQUJPZ0FBUWMvK0F4QUxRUUE2QUFCQjhQNERFQXRCQVRvQUFDUDlBUVJBSS80QkJFQkJBQ1RxQVVIQS9nTVFDMEVBT2dBQVFjSCtBeEFMUVlBQk9nQUFRY1QrQXhBTFFRQTZBQUFGUVFBazZnRkJ3UDRERUF0QkFEb0FBRUhCL2dNUUMwR0VBVG9BQUFzTFFRQVFEUUpBSS80QkRRQkJBQ1A5QVNQK0FSc05BRUcwQWlFQUEwQWdBRUhEQWt3RVFDQUJJQUFRQ3kwQUFHb2hBU0FBUVFGcUlRQU1BUXNMSUFGQi93RnhFQTRMQy9FRUFFRUFKS1FCUVFBa3BRRkJBQ1NtQVVFQkpLY0JRUUVrcUFGQkFTU3BBVUVCSktvQlFRRWtxd0ZCQVNTc0FVRUJKSzBCUVFFa3JnRkJBU1N2QVVFQUpMQUJRUUFrc2dGQkFDU3hBVUVBSkxNQlFaRCtBeEFMUVlBQk9nQUFRWkgrQXhBTFFiOEJPZ0FBUVpMK0F4QUxRZk1CT2dBQVFaUCtBeEFMUWNFQk9nQUFRWlQrQXhBTFFiOEJPZ0FBSS8wQkJFQkJrZjRERUF0QlB6b0FBRUdTL2dNUUMwRUFPZ0FBUVpQK0F4QUxRUUE2QUFCQmxQNERFQXRCdUFFNkFBQUxRWlgrQXhBTFFmOEJPZ0FBUVpiK0F4QUxRVDg2QUFCQmwvNERFQXRCQURvQUFFR1kvZ01RQzBFQU9nQUFRWm4rQXhBTFFiZ0JPZ0FBUVpyK0F4QUxRZjhBT2dBQVFaditBeEFMUWY4Qk9nQUFRWnorQXhBTFFaOEJPZ0FBUVozK0F4QUxRUUE2QUFCQm52NERFQXRCdUFFNkFBQkJBU1NEQVVHZi9nTVFDMEgvQVRvQUFFR2cvZ01RQzBIL0FUb0FBRUdoL2dNUUMwRUFPZ0FBUWFMK0F4QUxRUUE2QUFCQm8vNERFQXRCdndFNkFBQkJwUDRERUF0Qjl3QTZBQUJCQnlTbEFVRUhKS1lCUWFYK0F4QUxRZk1CT2dBQVFRRWtxZ0ZCQVNTcEFVRUJKS2dCUVFFa3B3RkJBQ1N1QVVFQUpLMEJRUUVrckFGQkFTU3JBVUdtL2dNUUMwSHhBVG9BQUVFQkpLOEJJLzBCQkVCQnBQNERFQXRCQURvQUFFRUFKS1VCUVFBa3BnRkJwZjRERUF0QkFEb0FBRUVBSktvQlFRQWtxUUZCQUNTb0FVRUFKS2NCUVFBa3JnRkJBQ1N0QVVFQUpLd0JRUUFrcXdGQnB2NERFQXRCOEFBNkFBQkJBQ1N2QVF0QkR5U1hBVUVQSkpnQlFROGttUUZCRHlTYUFVRUFKSnNCUVFBa25BRkJBQ1NkQVVFQUpKNEJRZjhBSko4QlFmOEFKS0FCUVFFa29RRkJBU1NpQVVFQUpLTUJDOVFHQVFGL1FjTUNFQXN0QUFBaUFFSEFBVVlFZjBFQkJTQUFRWUFCUmtFQUl6SWJDd1JBUVFFay9nRUZRUUFrL2dFTFFRQWtsUUpCZ0tqV3VRY2tqd0pCQUNTUUFrRUFKSkVDUVlDbzFya0hKSklDUVFBa2t3SkJBQ1NVQWlNeEJFQkJBU1Q5QVFWQkFDVDlBUXNRREVFQUpQRUJRUUVrOGdGQnh3SVFDeTBBQUNJQVJTVHpBU0FBUVFOTlFRQWdBRUVCVHhzazlBRWdBRUVHVFVFQUlBQkJCVThiSlBVQklBQkJFMDFCQUNBQVFROVBHeVQyQVNBQVFSNU5RUUFnQUVFWlR4c2s5d0ZCQVNUdkFVRUFKUEFCUWMvK0F4QUxRUUE2QUFCQjhQNERFQXRCQVRvQUFFSFIvZ01RQzBIL0FUb0FBRUhTL2dNUUMwSC9BVG9BQUVIVC9nTVFDMEgvQVRvQUFFSFUvZ01RQzBIL0FUb0FBRUhWL2dNUUMwSC9BVG9BQUJBUEkvNEJCRUJCNlA0REVBdEJ3QUU2QUFCQjZmNERFQXRCL3dFNkFBQkI2djRERUF0QndRRTZBQUJCNi80REVBdEJEVG9BQUFWQjZQNERFQXRCL3dFNkFBQkI2ZjRERUF0Qi93RTZBQUJCNnY0REVBdEIvd0U2QUFCQjYvNERFQXRCL3dFNkFBQUxJLzRCUVFBai9RRWJCRUJCNmY0REVBdEJJRG9BQUVIci9nTVFDMEdLQVRvQUFBc1FFRUVBSkxjQlFRQWt1QUZCQUNTNUFVRUFKTG9CUVFBa3V3RkJBQ1MyQVVILy93TVFDMEVBT2dBQVFRRWt2UUZCQUNTK0FVRUFKTDhCUVFBa3dBRkJBQ1RCQVVIaEFTUzhBVUdQL2dNUUMwSGhBVG9BQUVFQUpNSUJRUUFrd3dGQkFDVEVBVUVBSk1nQlFRQWt5UUZCQUNUS0FVRUFKTVVCUVFBa3hnRWovZ0VFUUVHRS9nTVFDMEVlT2dBQVFhQTlKTU1CQlVHRS9nTVFDMEdyQVRvQUFFSE0xd0lrd3dFTFFZZitBeEFMUWZnQk9nQUFRZmdCSk1vQkkvMEJCRUFqL2dGRkJFQkJoUDRERUF0QkFEb0FBRUVFSk1NQkN3dEJBQ1RMQVVFQUpNd0JJLzRCQkVCQmd2NERFQXRCL0FBNkFBQkJBQ1ROQVFWQmd2NERFQXRCL2dBNkFBQkJBU1ROQVF0QkFDVE9BU1ArQVFSQVFmRCtBeEFMUWZnQk9nQUFRYy8rQXhBTFFmNEJPZ0FBUWMzK0F4QUxRZjRBT2dBQVFZRCtBeEFMUWM4Qk9nQUFRWS8rQXhBTFFlRUJPZ0FBUWV6K0F4QUxRZjRCT2dBQVFmWCtBeEFMUVk4Qk9nQUFCVUh3L2dNUUMwSC9BVG9BQUVIUC9nTVFDMEgvQVRvQUFFSE4vZ01RQzBIL0FUb0FBRUdBL2dNUUMwSFBBVG9BQUVHUC9nTVFDMEhoQVRvQUFBc0xTZ0FnQUVFQVNpUXhJQUZCQUVva01pQUNRUUJLSkRNZ0EwRUFTaVEwSUFSQkFFb2tOU0FGUVFCS0pEWWdCa0VBU2lRM0lBZEJBRW9rT0NBSVFRQktKRGtnQ1VFQVNpUTZFQkVMQlFBamxRSUxtUUlBUWF3S0k2VUJOZ0lBUWJBS0k2WUJOZ0lBUWJRS0k2Y0JRUUJIT2dBQVFiVUtJNmdCUVFCSE9nQUFRYllLSTZrQlFRQkhPZ0FBUWJjS0k2b0JRUUJIT2dBQVFiZ0tJNnNCUVFCSE9nQUFRYmtLSTZ3QlFRQkhPZ0FBUWJvS0k2MEJRUUJIT2dBQVFic0tJNjRCUVFCSE9nQUFRYndLSTY4QlFRQkhPZ0FBUWIwS0k3QUJOZ0lBUWNJS0k3RUJPZ0FBUWNNS0k3SUJPZ0FBUWNRS0k1Y0JPZ0FBUWNVS0k1Z0JPZ0FBUWNZS0k1a0JPZ0FBUWNjS0k1b0JPZ0FBUWNnS0k1c0JRUUJIT2dBQVFja0tJNXdCUVFCSE9nQUFRY29LSTUwQlFRQkhPZ0FBUWNzS0k1NEJRUUJIT2dBQVFjd0tJNThCT2dBQVFjMEtJNkFCT2dBQVFjNEtJNkVCUVFCSE9nQUFRYzhLSTZJQlFRQkhPZ0FBQytvQkFFSGVDaU5KTmdJQVFlSUtJMG82QUFCQjR3b2pTMEVBUnpvQUFFSGtDaU5NT2dBQVFlVUtJMDA2QUFCQjV3b2pUanNCQUVIb0NpTlBPZ0FBUWVrS0kxQkJBRWM2QUFCQjZnb2pVVG9BQUVIckNpTlNPZ0FBUWV3S0kxTkJBRWM2QUFCQjdRb2pWRG9BQUVIdUNpTlZRUUJIT2dBQVFlOEtJMVpCQUVjNkFBQkI4QW9qVnpZQ0FFSDBDaU5ZTmdJQVFmZ0tJMWsyQWdCQi9Bb2pXa0VBUnpvQUFFSDlDaU5iTmdJQVFZRUxJMXcyQWdCQmhRc2pYVG9BQUVHR0N5TmVPZ0FBUVljTEkxOUJBRWM2QUFCQmlBc2pZRFlDQUVHTUN5TmhPd0VBUVk4TEkySkJBRWM2QUFBTHZ3Z0JBWDlCZ0FnamdBSTZBQUJCZ1FnamdRSTZBQUJCZ2dnamdnSTZBQUJCZ3dnamd3STZBQUJCaEFnamhBSTZBQUJCaFFnamhRSTZBQUJCaGdnamhnSTZBQUJCaHdnamh3STZBQUJCaUFnamlBSTdBUUJCaWdnamlRSTdBUUJCakFnamlnSTJBZ0JCa1Fnaml3SkJBRWM2QUFCQmtnZ2pqQUpCQUVjNkFBQkJrd2dqalFKQkFFYzZBQUJCbEFnampnSkJBRWM2QUFCQmxRZ2ovUUZCQUVjNkFBQkJsZ2dqL2dGQkFFYzZBQUJCbHdnai93RkJBRWM2QUFCQnNnZ2o2UUUyQWdBajZnRWhBRUhFL2dNUUN5QUFPZ0FBUWJZSUk5NEJPZ0FBUWJjSUk5OEJPZ0FBUWJnSUkrQUJRUUJIT2dBQVFia0lJK0VCUVFCSE9nQUFRYm9JSStJQlFRQkhPZ0FBUWJzSUkrTUJRUUJIT2dBQVFid0lJK1FCUVFCSE9nQUFRYjBJSStVQlFRQkhPZ0FBUWI0SUkrWUJRUUJIT2dBQVFiOElJK2NCUVFCSE9nQUFRZVFJSTdRQlFRQkhPZ0FBUWVVSUk3VUJRUUJIT2dBQVFjZ0pJKzhCT3dFQVFjb0pJL0FCT3dFQVFjd0pJL0VCUVFCSE9nQUFRYzBKSS9JQlFRQkhPZ0FBUWM0SkkvTUJRUUJIT2dBQVFjOEpJL1FCUVFCSE9nQUFRZEFKSS9VQlFRQkhPZ0FBUWRFSkkvWUJRUUJIT2dBQVFkSUpJL2NCUVFCSE9nQUFRZE1KSS9nQk5nSUFRZGNKSS9rQlFRQkhPZ0FBUWRnSkkvb0JOZ0lBUWR3Skkvc0JOZ0lBUWVBSkkvd0JOZ0lBUWZvSkk4SUJOZ0lBUWY0Skk4TUJOZ0lBUVlJS0k4UUJJZ0EyQWdCQmhnb2p4UUZCQUVjNkFBQkJod29qeGdGQkFFYzZBQUJCaUFvanh3RTJBZ0JCakFvanlBRTJBZ0JCa0FvanlRRkJBRWM2QUFCQmtRb2p5Z0UyQWdCQmhmNERFQXNnQURvQUFCQVVFQlZCa0Fzall6WUNBRUdYQ3lOa09nQUFRWmdMSTJVN0FRQkJtZ3NqWmpvQUFFR2JDeU5uUVFCSE9nQUFRWndMSTJnNkFBQkJuUXNqYVRvQUFFR2VDeU5xUVFCSE9nQUFRWjhMSTJzNkFBQkJvQXNqYkVFQVJ6b0FBRUdoQ3lOdFFRQkhPZ0FBUWFJTEkyNDJBZ0JCcGdzamJ6WUNBRUdxQ3lOd05nSUFRYTRMSTNGQkFFYzZBQUJCcndzamNqWUNBRUd6Q3lOek5nSUFRYmNMSTNRNkFBQkJ1QXNqZFRvQUFFSENDeU4yTmdJQVFjb0xJM2M3QVFCQnpBc2plRG9BQUVIT0N5TjVPZ0FBUWM4TEkzcEJBRWM2QUFCQjBBc2plem9BQUVIUkN5TjhRUUJIT2dBQVFkSUxJMzFCQUVjNkFBQkIwd3NqZmpZQ0FFSFhDeU4vTmdJQVFkc0xJNEFCTmdJQVFlTUxJNEVCTmdJQVFlY0xJNElCT2dBQVFlZ0xJNE1CUVFCSE9nQUFRZWtMSTRRQk5nSUFRZlFMSTRVQk5nSUFRZmdMSTRZQk93RUFRZm9MSTRjQk9nQUFRZnNMSTRnQlFRQkhPZ0FBUWZ3TEk0a0JPZ0FBUWYwTEk0b0JPZ0FBUWY0TEk0c0JRUUJIT2dBQVFmOExJNHdCT2dBQVFZRU1JNDBCUVFCSE9nQUFRWU1NSTQ0QlFRQkhPZ0FBUVlRTUk0OEJRUUJIT2dBQVFZa01JNUFCTmdJQVFZME1JNUVCTmdJQVFaRU1JNUlCUVFCSE9nQUFRWklNSTVNQk5nSUFRWllNSTVRQk5nSUFRWm9NSTVZQk93RUFRUUFrbFFJTHBnRUJBWDlCNUFndEFBQkJBRXNrdEFGQjVRZ3RBQUJCQUVza3RRRkIvLzhERUFzdEFBQWlBRUVCY1VFQVJ5UzNBU0FBUVFKeFFRQkhKTGdCSUFCQkJIRkJBRWNrdVFFZ0FFRUljVUVBUnlTNkFTQUFRUkJ4UVFCSEpMc0JJQUFrdGdGQmovNERFQXN0QUFBaUFFRUJjVUVBUnlTOUFTQUFRUUp4UVFCSEpMNEJJQUJCQkhGQkFFY2t2d0VnQUVFSWNVRUFSeVRBQVNBQVFSQnhRUUJISk1FQklBQWt2QUVMQndCQkFDU3pBUXVlQWdCQnJBb29BZ0FrcFFGQnNBb29BZ0FrcGdGQnRBb3RBQUJCQUVza3B3RkJ0UW90QUFCQkFFc2txQUZCdGdvdEFBQkJBRXNrcVFGQnR3b3RBQUJCQUVza3FnRkJ1QW90QUFCQkFFc2txd0ZCdVFvdEFBQkJBRXNrckFGQnVnb3RBQUJCQUVza3JRRkJ1d290QUFCQkFFc2tyZ0ZCdkFvdEFBQkJBRXNrcndGQnZRb29BZ0Frc0FGQndnb3RBQUFrc1FGQnd3b3RBQUFrc2dGQnhBb3RBQUFrbHdGQnhRb3RBQUFrbUFGQnhnb3RBQUFrbVFGQnh3b3RBQUFrbWdGQnlBb3RBQUJCQUVza213RkJ5UW90QUFCQkFFc2tuQUZCeWdvdEFBQkJBRXNrblFGQnl3b3RBQUJCQUVza25nRkJ6QW90QUFBa253RkJ6UW90QUFBa29BRkJ6Z290QUFCQkFFc2tvUUZCendvdEFBQkJBRXNrb2dGQkFDU3pBUXZ3QVFBalNVRXliRUdBQ0dvb0FnQWtTVUhpQ2kwQUFDUktRZU1LTFFBQVFRQkxKRXRCNUFvdEFBQWtURUhsQ2kwQUFDUk5RZWNLTHdFQUpFNUI2QW90QUFBa1QwSHBDaTBBQUVFQVN5UlFRZW9LTFFBQUpGRkI2d290QUFBa1VrSHNDaTBBQUVFQVN5UlRRZTBLTFFBQUpGUkI3Z290QUFCQkFFc2tWVUh2Q2kwQUFFRUFTeVJXUWZBS0tBSUFKRmRCOUFvb0FnQWtXRUg0Q2lnQ0FDUlpRZndLTFFBQVFRQkxKRnBCL1Fvb0FnQWtXMEdCQ3lnQ0FDUmNRWVVMTFFBQUpGMUJoZ3N0QUFBa1hrR0hDeTBBQUVFQVN5UmZRWWdMTFFBQUpHQkJqQXN0QUFBa1lVR1BDeTBBQUVFQVN5UmlDNjhCQUNOalFUSnNRWUFJYWlnQ0FDUmpRWmNMTFFBQUpHUkJtQXN2QVFBa1pVR2FDeTBBQUNSbVFac0xMUUFBUVFCTEpHZEJuQXN0QUFBa2FFR2RDeTBBQUNScFFaNExMUUFBUVFCTEpHcEJud3N0QUFBa2EwR2dDeTBBQUVFQVN5UnNRYUVMTFFBQVFRQkxKRzFCb2dzb0FnQWtia0dtQ3lnQ0FDUnZRYW9MS0FJQUpIQkJyZ3N0QUFCQkFFc2tjVUd2Q3lnQ0FDUnlRYk1MS0FJQUpITkJ0d3N0QUFBa2RFRzRDeTBBQUNSMUM4OEhBUUYvUVlBSUxRQUFKSUFDUVlFSUxRQUFKSUVDUVlJSUxRQUFKSUlDUVlNSUxRQUFKSU1DUVlRSUxRQUFKSVFDUVlVSUxRQUFKSVVDUVlZSUxRQUFKSVlDUVljSUxRQUFKSWNDUVlnSUx3RUFKSWdDUVlvSUx3RUFKSWtDUVl3SUtBSUFKSW9DUVpFSUxRQUFRUUJMSklzQ1FaSUlMUUFBUVFCTEpJd0NRWk1JTFFBQVFRQkxKSTBDUVpRSUxRQUFRUUJMSkk0Q1FaVUlMUUFBUVFCTEpQMEJRWllJTFFBQVFRQkxKUDRCUVpjSUxRQUFRUUJMSlA4QlFiSUlLQUlBSk9rQlFjVCtBeEFMTFFBQUpPb0JRYllJTFFBQUpONEJRYmNJTFFBQUpOOEJRYmdJTFFBQVFRQkxKT0FCUWJrSUxRQUFRUUJMSk9FQlFib0lMUUFBUVFCTEpPSUJRYnNJTFFBQVFRQkxKT01CUWJ3SUxRQUFRUUJMSk9RQlFiMElMUUFBUVFCTEpPVUJRYjRJTFFBQVFRQkxKT1lCUWI4SUxRQUFRUUJMSk9jQkVCZEJnUDRERUFzdEFBQkIvd0Z6Sk5jQkk5Y0JJZ0JCRUhGQkFFY2syQUVnQUVFZ2NVRUFSeVRaQVVISUNTOEJBQ1R2QVVIS0NTOEJBQ1R3QVVITUNTMEFBRUVBU3lUeEFVSE5DUzBBQUVFQVN5VHlBVUhPQ1MwQUFFRUFTeVR6QVVIUENTMEFBRUVBU3lUMEFVSFFDUzBBQUVFQVN5VDFBVUhSQ1MwQUFFRUFTeVQyQVVIU0NTMEFBRUVBU3lUM0FVSFRDU2dDQUNUNEFVSFhDUzBBQUVFQVN5VDVBVUhZQ1NnQ0FDVDZBVUhjQ1NnQ0FDVDdBVUhnQ1NnQ0FDVDhBVUg2Q1NnQ0FDVENBVUgrQ1NnQ0FDVERBVUdDQ2lnQ0FDVEVBVUdHQ2kwQUFFRUFTeVRGQVVHSENpMEFBRUVBU3lUR0FVR0lDaWdDQUNUSEFVR01DaWdDQUNUSUFVR1FDaTBBQUVFQVN5VEpBVUdSQ2lnQ0FDVEtBUkFaRUJvUUd5TjJRVEpzUVlBSWFpZ0NBQ1IyUWNvTEx3RUFKSGRCekFzdEFBQWtlRUhPQ3kwQUFDUjVRYzhMTFFBQVFRQkxKSHBCMEFzdEFBQWtlMEhSQ3kwQUFFRUFTeVI4UWRJTExRQUFRUUJMSkgxQjB3c29BZ0FrZmtIWEN5Z0NBQ1IvUWRzTEtBSUFKSUFCUWVNTEtBSUFKSUVCUWVjTEtBSUFKSUlCUWVnTExRQUFRUUJMSklNQlFla0xLQUlBSklRQkk0VUJRVEpzUVlBSWFpZ0NBQ1NGQVVINEN5MEFBQ1NHQVVINkN5MEFBQ1NIQVVIN0N5MEFBRUVBU3lTSUFVSDhDeTBBQUNTSkFVSDlDeTBBQUNTS0FVSCtDeTBBQUVFQVN5U0xBVUgvQ3kwQUFDU01BVUdCREMwQUFFRUFTeVNOQVVHRERDMEFBRUVBU3lTT0FVR0VEQzBBQUVFQVN5U1BBVUdKRENnQ0FDU1FBVUdORENnQ0FDU1JBVUdSREMwQUFFRUFTeVNTQVVHU0RDZ0NBQ1NUQVVHV0RDZ0NBQ1NVQVVHYURDOEJBQ1NXQVVFQUpKVUNRWUNvMXJrSEpJOENRUUFra0FKQkFDU1JBa0dBcU5hNUJ5U1NBa0VBSkpNQ1FRQWtsQUlMQlFBai9nRUxCUUFqa2dJTEJRQWprd0lMQlFBamxBSUxuZ0lCQjM4Z0FDTklJZ2RHUVFBZ0JDTkhSa0VBSUFCQkNFcEJBQ0FCUVFCS0d4c2JCRUFnQTBFQmF4QUxMUUFBUVNCeFFRQkhJUWdnQXhBTExRQUFRU0J4UVFCSElRa0RRQ0FHUVFoSUJFQWdBRUVISUFacklBWWdDQ0FKUnhzaUJHb2lBMEdnQVV3RVFBSi9JQU1nQVVHZ0FXd2lDbW9pQzBFRGJDSUdRWURKQldvaUF5QURMUUFBT2dBQUlBWkJnY2tGYWlBRExRQUJPZ0FBSUFaQmdza0ZhaUFETFFBQ09nQUFJQXRCZ0pFRWFpQUtJQUJCQUNBRWEydHFRZmlRQkdvdEFBQWlBMEVEY1NJR1FRUnlJQVlnQTBFRWNSczZBQUFnQlVFQmFnc2hCUXNnQkVFQmFpRUdEQUVMQ3dVZ0JDUkhDeUFBSUFkT0JIOGdBRUVJYWlFQklBQWdBa0VIY1NJQVNBUi9JQUFnQVdvRklBRUxCU0FIQ3lSSUlBVUxyUUVBSUFFUUN5MEFBQ0FBUVFGMGRVRURjU0VBSUFGQnlQNERSZ1JBSXo4aEFRSkFBa0FDUUFKQUlBQkJBV3NPQXdBQkFnTUxJMEFoQVF3Q0N5TkJJUUVNQVFzalFpRUJDd1VnQVVISi9nTkdCRUFqUXlFQkFrQUNRQUpBQWtBZ0FFRUJhdzREQUFFQ0F3c2pSQ0VCREFJTEkwVWhBUXdCQ3lOR0lRRUxCU003SVFFQ1FBSkFBa0FDUUNBQVFRRnJEZ01BQVFJREN5TThJUUVNQWdzalBTRUJEQUVMSXo0aEFRc0xDeUFCQytBREFRWi9JQUpCQVhGQkRYUWlEeUVPSUE0Z0FTSUNRWUNRQWtZRWZ5QUFRWUFCYXlBQVFZQUJhaUFBUVlBQmNSc0ZJQUFMUVFSMElBSnFJQVZCQVhScUlnQkJnSkIrYW1vdEFBQWhFU0FQSUFCQmdaQithbW90QUFBaEVpQURJUUFEUUNBQUlBUk1CRUFnQmlBQUlBTnJhaUlQSUFoSUJFQUNmeUFTUVFGQkJ5QUFheUFBUVFFZ0MwRWdjVVVnQzBFQVNCc2JJZ0owY1FSL1FRSUZRUUFMSWdGQkFXb2dBU0FSUVFFZ0FuUnhHeUVGSS80QkJIOUJBU0FNUVFCT0lBdEJBRTRiQlVFQUN3Ui9JQXRCQjNFaEFTQU1RUUJPSWdJRWZ5QU1RUWR4QlNBQkMwRURkQ0FGUVFGMGFpSUJRUUZxUVQ5eElnNUJRR3NnRGlBQ0cwR0FrQVJxTFFBQVFRaDBJQUZCUDNFaUFVRkFheUFCSUFJYlFZQ1FCR290QUFCeUlnRkJIM0ZCQTNRaERpQUJRZUFIY1VFRmRrRURkQ0VDSUFGQmdQZ0JjVUVLZGtFRGRBVWdCVUhIL2dNZ0NpQUtRUUJNR3lJS0VDSWlBVUdBZ1B3SGNVRVFkaUVPSUFGQmdQNERjVUVJZGlFQ0lBRkIvd0Z4Q3lFQklBa2dEeUFISUFoc2FrRURiR29pRUNBT09nQUFJQkFnQWpvQUFTQVFJQUU2QUFJZ0R5QUhRYUFCYkdwQmdKRUVhaUFGUVFOeElnRkJCSElnQVNBTFFZQUJjVUVBSUF0QkFFNGJHem9BQUNBTlFRRnFDeUVOQ3lBQVFRRnFJUUFNQVFzTElBMEwwZ0lBSUFOQkIzRWhBeUFGSUFWQmdKQUNSZ1IvSUFaQmdBRnJJQVpCZ0FGcUlBWkJnQUZ4R3dVZ0JndEJCSFJxSVFVZ0JTQUVRWURRZm1vdEFBQWlCRUhBQUhFRWYwRUhJQU5yQlNBREMwRUJkR29pQTBHQWtINXFJQVJCQ0hGQkFFY2lCVUVOZEdvdEFBQWhCaUFBSUFGQm9BRnNha0VEYkVHQXlRVnFJQVJCQjNGQkEzUWdBMEdCa0g1cUlBVkJBWEZCRFhScUxRQUFRUUVnQWtFSGNTSUNRUWNnQW1zZ0JFRWdjUnNpQTNSeEJIOUJBZ1ZCQUFzaUFrRUJhaUFDSUFaQkFTQURkSEViSWdOQkFYUnFJZ0pCQVdwQlAzRkJnSkFFYWkwQUFFRUlkQ0FDUVQ5eFFZQ1FCR290QUFCeUlnSkJIM0ZCQTNRNkFBQWdBQ0FCUWFBQmJHb2lBRUVEYkNJQlFZSEpCV29nQWtIZ0IzRkJCWFpCQTNRNkFBQWdBVUdDeVFWcUlBSkJnUGdCY1VFS2RrRURkRG9BQUNBQVFZQ1JCR29nQTBFRGNTSUFRUVJ5SUFBZ0JFR0FBWEViT2dBQUM4c0JBQ0FFSUFSQmdKQUNSZ1IvSUFWQmdBRnJJQVZCZ0FGcUlBVkJnQUZ4R3dVZ0JRdEJCSFJxSUFOQkIzRkJBWFJxSWdOQmdKQithaTBBQUNFRUlBQWdBVUdnQVd4cUlnVkJBMndpQVVHQXlRVnFJQU5CZ1pCK2FpMEFBRUVCUVFjZ0FrRUhjV3NpQW5SeEJIOUJBZ1ZCQUFzaUFFRUJhaUFBSUFSQkFTQUNkSEViUWY4QmNTSUNRY2YrQXhBaUlnQkJnSUQ4QjNGQkVIWTZBQUFnQVVHQnlRVnFJQUJCZ1A0RGNVRUlkam9BQUNBQlFZTEpCV29nQURvQUFDQUZRWUNSQkdvZ0FrRURjVG9BQUF2SEFnRUhmeUFEUVFOMUlRc0RRQ0FFUWFBQlNBUkFJQUlnQzBFRmRHb0NmeUFFSUFWcUlnWkJnQUpPQkVBZ0JrR0FBbXNoQmdzZ0JndEJBM1ZxSWdwQmdKQithaTBBQUNFSVFRQWhCeU01QkVBZ0JDQUFJQVlnQ2lBSUVDRWlDVUVBU2dSQUFuOUJBU0VISUFRZ0NVRUJhMm9MSVFRTEN5QUhSVUVBSXpnYkJFQkJBQ0VKSUFOQkIzRWhCMEVBSUFZZ0JrRURkVUVEZEdzZ0JCc2hERUYvSVFZai9nRUVRQUovSUFwQmdOQithaTBBQUNJR1FRaHhRUUJISVFsQkJ5QUhheUFISUFaQndBQnhHd3NoQndzZ0JDQUlJQUVnQ1NBTVFhQUJJQVJyUVFjZ0JFRUlha0dnQVVvYklBY2dCQ0FBUWFBQlFZREpCVUVBSUFaQmZ4QWpJZ1pCQVd0cUlBUWdCa0VBU2hzaEJBVWdCMFVFUUNQK0FRUkFJQVFnQUNBR0lBTWdDaUFCSUFnUUpBVWdCQ0FBSUFZZ0F5QUJJQWdRSlFzTEN5QUVRUUZxSVFRTUFRc0xDNVVGQVE5L1FTY2hCd05BSUFkQkFFNEVRQ0FIUVFKMElnVkJnUHdEYWlJQ0VBc3RBQUFoQXlBQ1FRRnFFQXN0QUFBaEJpQUNRUUpxRUFzdEFBQWhCQ0FHUVFocklRb2dBQ0FEUVJCcklnTWdBUVIvSUFRZ0JFRUJjV3NoQkVFUUJVRUlDeUlDYWtoQkFDQUFJQU5PR3dSQUlBVkJnL3dEYWhBTExRQUFJZ1pCZ0FGeFFRQkhJUXNnQmtFZ2NVRUFSeUVNSUFaQkNIRkJBRWNqL2dFaUJTQUZHMEVCY1VFTmRDSUZJQVJCQkhSQmdJQUNhaUFDSUFBZ0Eyc2lBbXRCQVdzZ0FpQUdRY0FBY1J0QkFYUnFJZ0pCZ0pCK2Ftb3RBQUFoRFNBRklBSkJnWkIrYW1vdEFBQWhEa0VISVFRRFFDQUVRUUJPQkVBZ0RrRUJRUUFnQkVFSGEyc2dCQ0FNR3lJRGRIRUVmMEVDQlVFQUN5SUNRUUZxSUFJZ0RVRUJJQU4wY1JzaUF3UkFJQXBCQnlBRWEyb2lBa0dnQVV4QkFDQUNRUUJPR3dSQVFRQWhCVUVBSVFnajV3RkZJLzRCSWdrZ0NSc2lDVVVFUUNBQ0lBQkJvQUZzYWtHQWtRUnFMUUFBSWc5QkEzRWlFRUVBUzBFQUlBc2JCRUJCQVNFRkJTQVFRUUJMUVFBZ0QwRUVjVUVBSS80Qkd4dEZSU0VJQ3d0QkFVRUFJQWhGSUFVYklBa2JCRUFqL2dFRVFDQUNJQUJCb0FGc2FrRURiQ0lDUVlESkJXb2dCa0VIY1VFRGRDQURRUUYwYWlJRFFRRnFRVDl4UWNDUUJHb3RBQUJCQ0hRZ0EwRS9jVUhBa0FScUxRQUFjaUlEUVI5eFFRTjBPZ0FBSUFKQmdja0ZhaUFEUWVBSGNVRUZka0VEZERvQUFDQUNRWUxKQldvZ0EwR0ErQUZ4UVFwMlFRTjBPZ0FBQlNBQ0lBQkJvQUZzYWtFRGJDSUNRWURKQldvZ0EwSEovZ05CeVA0RElBWkJFSEViRUNJaUEwR0FnUHdIY1VFUWRqb0FBQ0FDUVlISkJXb2dBMEdBL2dOeFFRaDJPZ0FBSUFKQmdza0ZhaUFET2dBQUN3c0xDeUFFUVFGcklRUU1BUXNMQ3lBSFFRRnJJUWNNQVFzTEM0RUJBUUovUVlDQUFrR0FrQUlqNHdFYklRRkJBU1BuQVNQK0FSc0VRQ0FBSUFGQmdMZ0NRWUN3QWlQa0FSc2dBQ1BzQVdwQi93RnhRUUFqNndFUUpnc2o0Z0VFUUNBQUkrNEJJZ0pPQkVBZ0FDQUJRWUM0QWtHQXNBSWo0UUViSUFBZ0Ftc2o3UUZCQjJzaUFVRUFJQUZyRUNZTEN5UG1BUVJBSUFBajVRRVFKd3NMSVFCQmovNERFQXN0QUFCQkFTQUFkSElpQUNTOEFVR1AvZ01RQ3lBQU9nQUFDK29CQVFOL0kxOUZRUUVqVlJzRVFBOExJMkJCQVdzaUFFRUFUQVJBSTBvRVFDTktKR0FDZnlOaElnRWpUSFVoQUVFQkkwc0VmMEVCSkdJZ0FTQUFhd1VnQUNBQmFnc2lBRUgvRDBvTkFCcEJBQXNFUUVFQUpGVUxJMHhCQUVvRVFDQUFKR0VnQUVFSWRVRUhjU0lDUVpUK0F4QUxMUUFBUWZnQmNYSWhBVUdUL2dNUUN5QUFRZjhCY1NJQU9nQUFRWlQrQXhBTElBRTZBQUFnQUNSU0lBSWtWQ05TSTFSQkNIUnlKRmNDZnlOaElnRWpUSFVoQUVFQkkwc0VmMEVCSkdJZ0FTQUFhd1VnQUNBQmFndEIvdzlLRFFBYVFRQUxCRUJCQUNSVkN3c0ZRUWdrWUFzRklBQWtZQXNMd1FjQkFuOGdBQ093QVdvaUFFR0F3QUFqL3dGMElnSk9CRUFnQUNBQ2F5U3dBUUpBQWtBQ1FBSkFBa0FDUUNPeEFVRUJha0VIY1NJQ0RnZ0FCUUVGQWdVREJBVUxJMU5CQUNOYklnQkJBRW9iQkVBZ0FFRUJheUlBUlFSQVFRQWtWUXNMSUFBa1d3Si9JMnBCQUNOeUlnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkd3TElBQWtjZ0ovSTNwQkFDT0FBU0lBUVFCS0d3UkFJQUJCQVdzaEFBc2dBQXRGQkVCQkFDUjhDeUFBSklBQkFuOGpqUUZCQUNPVEFTSUFRUUJLR3dSQUlBQkJBV3NoQUFzZ0FBdEZCRUJCQUNTT0FRc2dBQ1NUQVF3RUN5TlRRUUFqV3lJQVFRQktHd1JBSUFCQkFXc2lBRVVFUUVFQUpGVUxDeUFBSkZzQ2Z5TnFRUUFqY2lJQVFRQktHd1JBSUFCQkFXc2hBQXNnQUF0RkJFQkJBQ1JzQ3lBQUpISUNmeU42UVFBamdBRWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2ZBc2dBQ1NBQVFKL0k0MEJRUUFqa3dFaUFFRUFTaHNFUUNBQVFRRnJJUUFMSUFBTFJRUkFRUUFramdFTElBQWtrd0VRS2d3REN5TlRRUUFqV3lJQVFRQktHd1JBSUFCQkFXc2lBRVVFUUVFQUpGVUxDeUFBSkZzQ2Z5TnFRUUFqY2lJQVFRQktHd1JBSUFCQkFXc2hBQXNnQUF0RkJFQkJBQ1JzQ3lBQUpISUNmeU42UVFBamdBRWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2ZBc2dBQ1NBQVFKL0k0MEJRUUFqa3dFaUFFRUFTaHNFUUNBQVFRRnJJUUFMSUFBTFJRUkFRUUFramdFTElBQWtrd0VNQWdzalUwRUFJMXNpQUVFQVNoc0VRQ0FBUVFGcklnQkZCRUJCQUNSVkN3c2dBQ1JiQW44amFrRUFJM0lpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtiQXNnQUNSeUFuOGpla0VBSTRBQklnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkh3TElBQWtnQUVDZnlPTkFVRUFJNU1CSWdCQkFFb2JCRUFnQUVFQmF5RUFDeUFBQzBVRVFFRUFKSTRCQ3lBQUpKTUJFQ29NQVFzaldVRUJheUlBUVFCTUJFQWpVUVJBSTFwQkFDTlJJZ0FiQkVBalhDSUJRUUZxSUFGQkFXc2pVQnRCRDNFaUFVRVBTUVJBSUFFa1hBVkJBQ1JhQ3dzRlFRZ2hBQXNMSUFBa1dTTndRUUZySWdCQkFFd0VRQ05vQkVBamNVRUFJMmdpQUJzRVFDTnpJZ0ZCQVdvZ0FVRUJheU5uRzBFUGNTSUJRUTlKQkVBZ0FTUnpCVUVBSkhFTEN3VkJDQ0VBQ3dzZ0FDUndJNUVCUVFGcklnQkJBRXdFUUNPSkFRUkFJNUlCUVFBamlRRWlBQnNFUUNPVUFTSUJRUUZxSUFGQkFXc2ppQUViUVE5eElnRkJEMGtFUUNBQkpKUUJCVUVBSkpJQkN3c0ZRUWdoQUFzTElBQWtrUUVMSUFJa3NRRkJBUThGSUFBa3NBRUxRUUFMd1FFQkFYOGpXQ0FBYXlFQUEwQWdBRUVBVEFSQVFZQVFJMWRyUVFKMElnRkJBblFnQVNQL0FSc2tXQ05ZSUFCQkgzVWlBU0FBSUFGcWMyc2hBQ05lUVFGcVFRZHhKRjRNQVFzTElBQWtXQ05XUVFBalZSc0VmeU5jUVE5eEJVRVBEd3NoQUFKL0kxNGhBUUpBQWtBQ1FBSkFJMDFCQVdzT0F3QUJBZ01MUVFFZ0FYUkJnUUZ4UVFCSERBTUxRUUVnQVhSQmh3RnhRUUJIREFJTFFRRWdBWFJCL2dCeFFRQkhEQUVMUVFFZ0FYUkJBWEVMQkg5QkFRVkJmd3NnQUd4QkQyb0x1Z0VCQVg4amJ5QUFheUVBQTBBZ0FFRUFUQVJBUVlBUUkyNXJRUUowSS84QmRDUnZJMjhnQUVFZmRTSUJJQUFnQVdwemF5RUFJM1ZCQVdwQkIzRWtkUXdCQ3dzZ0FDUnZJMjFCQUNOc0d3Ui9JM05CRDNFRlFROFBDeUVBQW44amRTRUJBa0FDUUFKQUFrQWpaRUVCYXc0REFBRUNBd3RCQVNBQmRFR0JBWEZCQUVjTUF3dEJBU0FCZEVHSEFYRkJBRWNNQWd0QkFTQUJkRUgrQUhGQkFFY01BUXRCQVNBQmRFRUJjUXNFZjBFQkJVRi9DeUFBYkVFUGFndUlBZ0VEZnlOOVJVRUJJM3diQkVCQkR3OExJNElCSVFNamd3RUVRRUdjL2dNUUN5MEFBRUVGZGlJREpJSUJRUUFrZ3dFTEk0UUJJNEVCUVFGeFJVRUNkSFZCRDNFaEFnSkFBa0FDUUFKQUFrQWdBdzREQUFFQ0F3c2dBa0VFZFNFQ0RBTUxRUUVoQVF3Q0N5QUNRUUYxSVFKQkFpRUJEQUVMSUFKQkFuVWhBa0VFSVFFTElBRkJBRXNFZnlBQ0lBRnRCVUVBQzBFUGFpRUNJMzhnQUdzaEFBTkFJQUJCQUV3RVFFR0FFQ04rYTBFQmRDUC9BWFFrZnlOL0lBQkJIM1VpQVNBQUlBRnFjMnNoQUNPQkFVRUJhaUVCQTBBZ0FVRWdUZ1JBSUFGQklHc2hBUXdCQ3dzZ0FTU0JBU09CQVVFQmRVR3cvZ05xRUFzdEFBQWtoQUVNQVFzTElBQWtmeUFDQzQ4QkFRSi9JNUFCSUFCcklnQkJBRXdFUUNPVkFTT0tBWFFqL3dGMElBQkJIM1VpQVNBQUlBRnFjMnNoQUNPV0FTSUJRUUYxSWdJZ0FVRUJjU0FDUVFGeGN5SUJRUTUwY2lJQ1FiOS9jU0FCUVFaMGNpQUNJNHNCR3lTV0FRdEJBQ0FBSUFCQkFFZ2JKSkFCSTQ4QlFRQWpqZ0ViQkg4amxBRkJEM0VGUVE4UEMwRi9RUUVqbGdGQkFYRWJiRUVQYWd2bEFRRUJmMEVBSktFQklBQkJEeU9yQVJzZ0FVRVBJNndCRzJvZ0FrRVBJNjBCRzJvZ0EwRVBJNjRCRzJvaEJFRUFKS0lCUVFBa293RUNmMEgvQUNBQVFROGpwd0ViSUFGQkR5T29BUnRxSUFKQkR5T3BBUnRxSUFOQkR5T3FBUnRxSWdCQlBFWU5BQm9qcFFGQkFXb2dBRUU4YTBHZ2pRWnNiRUVEZFVHZ2pRWnRRVHhxUWFDTkJteEJqUEVDYlFzaEFnSi9JNllCUVFGcUlRRkIvd0FnQkVFOFJnMEFHaUFCSUFSQlBHdEJvSTBHYkd4QkEzVkJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMExJUUFnQWlTZkFTQUFKS0FCSUFCQi93RnhJQUpCL3dGeFFRaDBjZ3VjQXdFRmZ5QUFJMGxxSWdFa1NTTllJQUZyUVFCTUlnRkZCRUFqVmlJQ0k1c0JSeUVCSUFJa213RUxJQUFqWTJvaUFpUmpJMjhnQW10QkFFd2lBa1VFUUNOdElnUWpuQUZISVFJZ0JDU2NBUXNnQUNOMmFpUjJRUUFqZnlOMmEwRUFTaU9EQVJ0RklnUkZCRUFqZlNJRkk1MEJSeUVFSUFVa25RRUxJQUFqaFFGcUpJVUJJNUFCSTRVQmEwRUFUQ0lGUlFSQUk0OEJJZ01qbmdGSElRVWdBeVNlQVFzZ0FRUkFJMGtoQTBFQUpFa2dBeEFzSkpjQkN5QUNCRUFqWXlFRFFRQWtZeUFERUMwa21BRUxJQVFFUUNOMklRTkJBQ1IySUFNUUxpU1pBUXNnQlFSQUk0VUJJUU5CQUNTRkFTQURFQzhrbWdFTFFRRWdCVUVCSUFSQkFTQUNJQUViR3hzRVFFRUJKS01CQ3lBQUk3SUJhaUlBUVlDQWdBSWovd0YwUWNUWUFtMGlBVTRFUUNBQUlBRnJJUUJCQVNPaUFVRUJJNkVCSTZNQkd4c0VRQ09YQVNPWUFTT1pBU09hQVJBd0dnVWdBQ1N5QVFzanN3RWlBVUVCZEVHQW1jRUFhaUlDSTU4QlFRSnFPZ0FBSUFJam9BRkJBbW82QUFFZ0FVRUJhaUlCUWYvL0EwNEVmeUFCUVFGckJTQUJDeVN6QVFzZ0FDU3lBUXVXQXdFR2Z5QUFFQ3doQVNBQUVDMGhBaUFBRUM0aEJDQUFFQzhoQlNBQkpKY0JJQUlrbUFFZ0JDU1pBU0FGSkpvQklBQWpzZ0ZxSWdCQmdJQ0FBaVAvQVhSQnhOZ0NiVTRFUUNBQVFZQ0FnQUlqL3dGMFFjVFlBbTFySVFBZ0FTQUNJQVFnQlJBd0lRTWpzd0ZCQVhSQmdKbkJBR29pQmlBRFFZRCtBM0ZCQ0haQkFtbzZBQUFnQmlBRFFmOEJjVUVDYWpvQUFTTTZCRUFnQVVFUFFROUJEeEF3SVFFanN3RkJBWFJCZ0praGFpSURJQUZCZ1A0RGNVRUlka0VDYWpvQUFDQURJQUZCL3dGeFFRSnFPZ0FCUVE4Z0FrRVBRUThRTUNFQkk3TUJRUUYwUVlDWktXb2lBaUFCUVlEK0EzRkJDSFpCQW1vNkFBQWdBaUFCUWY4QmNVRUNham9BQVVFUFFROGdCRUVQRURBaEFTT3pBVUVCZEVHQW1URnFJZ0lnQVVHQS9nTnhRUWgyUVFKcU9nQUFJQUlnQVVIL0FYRkJBbW82QUFGQkQwRVBRUThnQlJBd0lRRWpzd0ZCQVhSQmdKazVhaUlDSUFGQmdQNERjVUVJZGtFQ2Fqb0FBQ0FDSUFGQi93RnhRUUpxT2dBQkN5T3pBVUVCYWlJQlFmLy9BMDRFZnlBQlFRRnJCU0FCQ3lTekFRc2dBQ1N5QVF0QkFRSi9RZGNBSS84QmRDRUFJNlFCSVFFRFFDQUJJQUJPQkVBZ0FCQXJSVUVBSXpjYkJFQWdBQkF4QlNBQUVESUxJQUVnQUdzaEFRd0JDd3NnQVNTa0FRdktBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR1EvZ05yRGhjQUJRb1BFd0VHQ3hBVUFnY01FUlVEQ0EwU0ZnUUpEaGNMUVpEK0F4QUxMUUFBUVlBQmNnOExRWlgrQXhBTExRQUFRZjhCY2c4TFFacitBeEFMTFFBQVFmOEFjZzhMUVovK0F4QUxMUUFBUWY4QmNnOExRYVQrQXhBTExRQUFEd3RCa2Y0REVBc3RBQUJCUDNJUEMwR1cvZ01RQ3kwQUFFRS9jZzhMUVp2K0F4QUxMUUFBUWY4QmNnOExRYUQrQXhBTExRQUFRZjhCY2c4TFFhWCtBeEFMTFFBQUR3dEJrdjRERUFzdEFBQVBDMEdYL2dNUUN5MEFBQThMUVp6K0F4QUxMUUFBUVo4QmNnOExRYUgrQXhBTExRQUFEd3RCZ0FGQkFDT3ZBUnNpQUVFQmNpQUFRWDV4STFVYklnQkJBbklnQUVGOWNTTnNHeUlBUVFSeUlBQkJlM0VqZkJzaUFFRUljaUFBUVhkeEk0NEJHMEh3QUhJUEMwR1QvZ01RQ3kwQUFFSC9BWElQQzBHWS9nTVFDeTBBQUVIL0FYSVBDMEdkL2dNUUN5MEFBRUgvQVhJUEMwR2kvZ01RQ3kwQUFBOExRWlQrQXhBTExRQUFRYjhCY2c4TFFabitBeEFMTFFBQVFiOEJjZzhMUVo3K0F4QUxMUUFBUWI4QmNnOExRYVArQXhBTExRQUFRYjhCY2c4TFFYOExqUUVCQVg4ajF3RWhBQ1BZQVFSL0lBQkJlM0VnQUVFRWNpUFBBUnNpQUVGK2NTQUFRUUZ5STlJQkd5SUFRWGR4SUFCQkNISWowQUViSWdCQmZYRWdBRUVDY2lQUkFSc0ZJOWtCQkg4Z0FFRitjU0FBUVFGeUk5TUJHeUlBUVgxeElBQkJBbklqMUFFYklnQkJlM0VnQUVFRWNpUFZBUnNpQUVGM2NTQUFRUWh5STlZQkd3VWdBQXNMUWZBQmNndjBBZ0VCZnlBQVFZQ0FBa2dFUUVGL0R3c2dBRUdBd0FKSVFRQWdBRUdBZ0FKT0d3UkFRWDhQQ3lBQVFZRDhBMGhCQUNBQVFZREFBMDRiQkVBZ0FFR0FRR29RQ3kwQUFBOExJQUJCbi8wRFRFRUFJQUJCZ1B3RFRoc0VRRUgvQVVGL0k5NEJRUUpJR3c4TElBQkJ6ZjREUmdSQVFjMytBeEFMTFFBQVFRRnhCSDlCL3dFRlFmNEJDeUlBSUFCQi8zNXhJLzhCR3c4TElBQkJ4UDREUmdSQUkrb0JJUUVnQUJBTElBRTZBQUFqNmdFUEN5QUFRYWIrQTB4QkFDQUFRWkQrQTA0YkJFQVFNeUFBRURRUEN5QUFRYS8rQTB4QkFDQUFRYWYrQTA0YkJFQkIvd0VQQ3lBQVFiLytBMHhCQUNBQVFiRCtBMDRiQkVBUU15TjhCRUFqZ1FGQkFYVkJzUDREYWhBTExRQUFEd3RCZnc4TElBQkJoUDREUmdSQUk4TUJRWUQrQTNGQkNIWWhBU0FBRUFzZ0FUb0FBQ0FCRHdzZ0FFR0YvZ05HQkVBanhBRWhBU0FBRUFzZ0FUb0FBQ1BFQVE4TElBQkJqLzREUmdSQUk3d0JRZUFCY2c4TElBQkJnUDREUmdSQUVEVVBDMEYvQ3l3QkFYOGdBQ1BiQVVZRVFFRUJKTjBCQ3lBQUVEWWlBVUYvUmdSL0lBQVFDeTBBQUFVZ0FVSC9BWEVMQzVvQ0FRSi9JL01CQkVBUEN5UDBBU0VESS9VQklRSWdBRUgvUDB3RVFDQUJRUkJ4UlVFQUlBSWJSUVJBSUFGQkQzRWlBQVJBSUFCQkNrWUVRRUVCSlBFQkN3VkJBQ1R4QVFzTEJTQUFRZi8vQUV3RVFDQUFRZi9mQUV4QkFTUDNBU0lBR3dSQUlBRkJEM0VqN3dFZ0Foc2hBaUFEQkg4Z0FVRWZjU0VCSUFKQjRBRnhCU1AyQVFSL0lBRkIvd0J4SVFFZ0FrR0FBWEVGUVFBZ0FpQUFHd3NMSUFGeUpPOEJCU1B2QVVIL0FYRWdBVUVBU2tFSWRISWs3d0VMQlVFQUlBQkIvNzhCVENBQ0d3UkFJL0lCUVFBZ0F4c0VRQ1B2QVVFZmNTQUJRZUFCY1hJazd3RVBDeUFCUVE5eElBRkJBM0VqOXdFYkpQQUJCVUVBSUFCQi8vOEJUQ0FDR3dSQUlBTUVRQ0FCUVFGeFFRQkhKUElCQ3dzTEN3c0xxZ0VCQW45QkFTUlZJMXRGQkVCQndBQWtXd3RCZ0JBalYydEJBblFpQUVFQ2RDQUFJLzhCR3lSWUkxRUVRQ05SSkZrRlFRZ2tXUXRCQVNSYUkwOGtYQ05YSkdFalNnUkFJMG9rWUFWQkNDUmdDMEVCSTB4QkFFb2lBQ05LUVFCS0d5UmZRUUFrWWlBQUJIOENmeU5oSWdBalRIVWhBVUVCSTBzRWYwRUJKR0lnQUNBQmF3VWdBQ0FCYWd0Qi93OUtEUUFhUVFBTEJVRUFDd1JBUVFBa1ZRc2pWa1VFUUVFQUpGVUxDNDBCQVFKL0lBQkJCM0VpQVNSVUkxSWdBVUVJZEhJa1Z5TlRSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2pzUUZCQVhFaUFrVUVRQ0FCUVFBalcwRUFTaHNFUUNOYlFRRnJKRnRCQUNOYlJTQUFRWUFCY1JzRVFFRUFKRlVMQ3dzZ0FFSEFBSEZCQUVja1V5QUFRWUFCY1FSQUVEa2pVMEVBUVFBalcwSEFBRVlnQWhzYkJFQWpXMEVCYXlSYkN3c0x5d0VCQW44Z0FFRUhjU0lDSkdzamFTQUNRUWgwY2lSdUk3RUJRUUZ4SVFJamFrVWlBUVJBSUFCQndBQnhRUUJISVFFTElBSkZCRUFnQVVFQUkzSkJBRW9iQkVBamNrRUJheVJ5UVFBamNrVWdBRUdBQVhFYkJFQkJBQ1JzQ3dzTElBQkJ3QUJ4UVFCSEpHb2dBRUdBQVhFRVFFRUJKR3dqY2tVRVFFSEFBQ1J5QzBHQUVDTnVhMEVDZENQL0FYUWtieU5vQkVBamFDUndCVUVJSkhBTFFRRWtjU05tSkhNamJVVUVRRUVBSkd3TEkycEJBRUVBSTNKQndBQkdJQUliR3dSQUkzSkJBV3NrY2dzTEM3NEJBUUYvSUFCQkIzRWlBU1I3STNrZ0FVRUlkSElrZmlPeEFVRUJjU0lCUlFSQVFRQWdBRUhBQUhFamVodEJBQ09BQVVFQVNoc0VRQ09BQVVFQmF5U0FBVUVBSTRBQlJTQUFRWUFCY1JzRVFFRUFKSHdMQ3dzZ0FFSEFBSEZCQUVja2VpQUFRWUFCY1FSQVFRRWtmQ09BQVVVRVFFR0FBaVNBQVF0QmdCQWpmbXRCQVhRai93RjBKSDhqZjBFR2FpUi9RUUFrZ1FFamZVVUVRRUVBSkh3TEkzcEJBRUVBSTRBQlFZQUNSaUFCR3hzRVFDT0FBVUVCYXlTQUFRc0xDOU1CQVFKL0k0MEJSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2pzUUZCQVhFaUFrVUVRQ0FCUVFBamt3RkJBRW9iQkVBamt3RkJBV3Nra3dGQkFDT1RBVVVnQUVHQUFYRWJCRUJCQUNTT0FRc0xDeUFBUWNBQWNVRUFSeVNOQVNBQVFZQUJjUVJBUVFFa2pnRWprd0ZGQkVCQndBQWtrd0VMSTVVQkk0b0JkQ1AvQVhRa2tBRWppUUVFUUNPSkFTU1JBUVZCQ0NTUkFRdEJBU1NTQVNPSEFTU1VBVUgvL3dFa2xnRWpqd0ZGQkVCQkFDU09BUXNqalFGQkFFRUFJNU1CUWNBQVJpQUNHeHNFUUNPVEFVRUJheVNUQVFzTEM5Y0hBQ092QVVWQkFDQUFRYWIrQTBjYkJFQkJBQThMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHUS9nTnJEaGNBQWdZS0RoVURCd3NQQVFRSURCQVZCUWtORVJJVEZCVUxJMHNoQUNBQlFmQUFjVUVFZGlSS0lBRkJDSEZCQUVja1N5QUJRUWR4SkV3allrRUFJMHRGUVFBZ0FCc2JCRUJCQUNSVkN3d1VDMEVBSUFGQmdBRnhRUUJISWdBamZSc0VRRUVBSklRQkN5QUFKSDBnQUVVRVFDQUFKSHdMREJNTElBRkJCblZCQTNFa1RTQUJRVDl4SkU1QndBQWpUbXNrV3d3U0N5QUJRUVoxUVFOeEpHUWdBVUUvY1NSbFFjQUFJMlZySkhJTUVRc2dBU1IzUVlBQ0kzZHJKSUFCREJBTElBRkJQM0VraGdGQndBQWpoZ0ZySkpNQkRBOExJMVVFUUVFQUkxb2pVUnNFUUNOY1FRRnFRUTl4SkZ3TEkxQWdBVUVJY1VFQVIwY0VRRUVRSTF4clFROXhKRndMQ3lBQlFRUjFRUTl4SkU4Z0FVRUljVUVBUnlSUUlBRkJCM0VrVVNBQlFmZ0JjVUVBU3lJQUpGWWdBRVVFUUVFQUpGVUxEQTRMSTJ3RVFFRUFJM0VqYUJzRVFDTnpRUUZxUVE5eEpITUxJMmNnQVVFSWNVRUFSMGNFUUVFUUkzTnJRUTl4SkhNTEN5QUJRUVIxUVE5eEpHWWdBVUVJY1VFQVJ5Um5JQUZCQjNFa2FDQUJRZmdCY1VFQVN5SUFKRzBnQUVVRVFDQUFKR3dMREEwTFFRRWtnd0VnQVVFRmRVRVBjU1I0REF3TEk0NEJCRUJCQUNPU0FTT0pBUnNFUUNPVUFVRUJha0VQY1NTVUFRc2ppQUVnQVVFSWNVRUFSMGNFUUVFUUk1UUJhMEVQY1NTVUFRc0xJQUZCQkhWQkQzRWtod0VnQVVFSWNVRUFSeVNJQVNBQlFRZHhKSWtCSUFGQitBRnhRUUJMSWdBa2p3RWdBRVVFUUNBQUpJNEJDd3dMQ3lBQkpGSWdBU05VUVFoMGNpUlhEQW9MSUFFa2FTQUJJMnRCQ0hSeUpHNE1DUXNnQVNSNUlBRWplMEVJZEhJa2Znd0lDeUFCUVFSMUpJb0JJQUZCQ0hGQkFFY2tpd0VnQVVFSGNTSUFKSXdCSUFCQkFYUWlBRUVCU0FSL1FRRUZJQUFMUVFOMEpKVUJEQWNMSUFFUU9nd0dDeUFCRURzTUJRc2dBUkE4REFRTElBRVFQUXdEQ3lBQlFRUjFRUWR4SktVQklBRkJCM0VrcGdGQkFTU2hBUXdDQ3lBQlFZQUJjVUVBUnlTcUFTQUJRY0FBY1VFQVJ5U3BBU0FCUVNCeFFRQkhKS2dCSUFGQkVIRkJBRWNrcHdFZ0FVRUljVUVBUnlTdUFTQUJRUVJ4UVFCSEpLMEJJQUZCQW5GQkFFY2tyQUVnQVVFQmNVRUFSeVNyQVVFQkpLSUJEQUVMSTY4QklnQUVmMEVBQlNBQlFZQUJjUXNFUUVFSEpMRUJRUUFrWGtFQUpIVUxJQUZCZ0FGeFJVRUFJQUFiQkVCQmtQNERJUUFEUUNBQVFhYitBMGdFUUNBQVFRQVFSQ0FBUVFGcUlRQU1BUXNMQ3lBQlFZQUJjVUVBUnlTdkFRdEJBUXRmQVFKL1FRQWs2UUZCQUNUcUFVSEUvZ01RQzBFQU9nQUFRY0grQXhBTExRQUFRWHh4SVFKQkFDVGVBVUhCL2dNUUN5QUNPZ0FBSUFBRVFBTkFJQUZCZ05nRlNBUkFJQUZCZ01rRmFrSC9BVG9BQUNBQlFRRnFJUUVNQVFzTEN3dkpBUUVEZnlQK0FVVUVRQThMSUFCQmdBRnhSVUVBSS9rQkd3UkFRUUFrK1FGQjFmNERFQXN0QUFCQmdBRnlJUUJCMWY0REVBc2dBRG9BQUE4TFFkSCtBeEFMTFFBQVFRaDBRZEwrQXhBTExRQUFja0h3L3dOeElRRkIwLzRERUFzdEFBQkJDSFJCMVA0REVBc3RBQUJ5UWZBL2NVR0FnQUpxSVFJZ0FFSC9mbkZCQVdwQkJIUWhBeUFBUVlBQmNRUkFRUUVrK1FFZ0F5VDZBU0FCSlBzQklBSWsvQUZCMWY0REVBc2dBRUgvZm5FNkFBQUZJQUVnQWlBREVFVkIxZjRERUF0Qi93RTZBQUFMQzhNQkFRUi9BMEFnQWlBQVNBUkFJQUpCQkdvaEFpUERBU0lCUVFScVFmLy9BM0VpQXlUREFTUEpBUVJBSThZQklRUWp4UUVFUUNQSUFTVEVBVUVCSkw4QlFRSVFLVUVBSk1VQlFRRWt4Z0VGSUFRRVFFRUFKTVlCQ3dzZ0FVRUJBbjhDUUFKQUFrQUNRQUpBSThvQkRnUUFBUUlEQkF0QkNRd0VDMEVEREFNTFFRVU1BZ3RCQnd3QkMwRUFDeUlCZEhFRWZ5QURRUUVnQVhSeFJRVkJBQXNFUUNQRUFVRUJhaUlCUWY4QlNnUi9RUUVreFFGQkFBVWdBUXNreEFFTEN3d0JDd3NMeXdFQkEzOGp5UUVoQVNBQVFRUnhRUUJISk1rQklBQkJBM0VoQXlBQlJRUkFBbjhDUUFKQUFrQUNRQUpBSThvQkRnUUFBUUlEQkF0QkNRd0VDMEVEREFNTFFRVU1BZ3RCQnd3QkMwRUFDeUVCQW44Q1FBSkFBa0FDUUFKQUlBTU9CQUFCQWdNRUMwRUpEQVFMUVFNTUF3dEJCUXdDQzBFSERBRUxRUUFMSVFBand3RWhBaVBKQVFSL0lBSkJBU0FCZEhFRklBSkJBU0FBZEhGQkFDQUNRUUVnQVhSeEd3c0VRQ1BFQVVFQmFpSUFRZjhCU2dSL1FRRWt4UUZCQUFVZ0FBc2t4QUVMQ3lBREpNb0JDN29LQVFOL0FrQUNRQ0FBUWMzK0EwWUVRRUhOL2dNUUN5QUJRUUZ4T2dBQURBRUxJQUJCMFA0RFJrRUFJLzBCR3dSQVFRQWsvUUZCL3dFa2lRSU1BZ3NnQUVHQWdBSklCRUFnQUNBQkVEZ01BUXNnQUVHQXdBSklRUUFnQUVHQWdBSk9HdzBCSUFCQmdQd0RTRUVBSUFCQmdNQURUaHNFUUNBQVFZQkFhaEFMSUFFNkFBQU1BZ3NnQUVHZi9RTk1RUUFnQUVHQS9BTk9Hd1JBSTk0QlFRSk9Ed3NnQUVILy9RTk1RUUFnQUVHZy9RTk9HdzBBSUFCQmd2NERSZ1JBSUFGQkFuRkJBRWNrelFFZ0FVR0FBWEZCQUVja3pnRkJBUThMSUFCQnB2NERURUVBSUFCQmtQNERUaHNFUUJBeklBQWdBUkErRHdzZ0FFRy8vZ05NUVFBZ0FFR3cvZ05PR3dSQUVETWpmQVJBSTRFQlFRRjFRYkQrQTJvUUN5QUJPZ0FBREFJTERBSUxJQUJCeS80RFRFRUFJQUJCd1A0RFRoc0VRQ0FBUWNEK0EwWUVRQ1BnQVNFQUlBRkJnQUZ4UVFCSEpPQUJJQUZCd0FCeFFRQkhKT0VCSUFGQklIRkJBRWNrNGdFZ0FVRVFjVUVBUnlUakFTQUJRUWh4UVFCSEpPUUJJQUZCQkhGQkFFY2s1UUVnQVVFQ2NVRUFSeVRtQVNBQlFRRnhRUUJISk9jQkkrQUJSVUVBSUFBYkJFQkJBUkEvQzBFQUkrQUJJQUFiQkVCQkFCQS9Dd3dEQ3lBQVFjSCtBMFlFUUNBQlFmZ0JjVUhCL2dNUUN5MEFBRUVIY1hKQmdBRnlJUUJCd2Y0REVBc2dBRG9BQUF3Q0N5QUFRY1QrQTBZRVFFRUFKT29CSUFBUUMwRUFPZ0FBREFJTElBQkJ4ZjREUmdSQUlBRWszd0VNQXdzZ0FFSEcvZ05HQkVCQkFDRUFJQUZCQ0hRaEFRTkFJQUJCbndGTUJFQWdBQ0FCYWhBTExRQUFJUUlnQUVHQS9BTnFFQXNnQWpvQUFDQUFRUUZxSVFBTUFRc0xRWVFGSlBnQkRBTUxBa0FDUUFKQUFrQWdBRUhEL2dOSEJFQWdBRUhDL2dOckRnb0JCQVFFQkFRRUJBTUNCQXNnQVNUckFRd0dDeUFCSk93QkRBVUxJQUVrN1FFTUJBc2dBU1R1QVF3REN3d0NDeUFBUWRYK0EwWUVRQ0FCRUVBTUFRdEJBU0FBUWMvK0EwWWdBRUh3L2dOR0d3UkFJL2tCQkVBait3RWlBa0gvL3dGTVFRQWdBa0dBZ0FGT0d3Ui9RUUVGSUFKQi83OERURUVBSUFKQmdLQURUaHNMRFFJTEN5QUFRZXYrQTB4QkFDQUFRZWorQTA0YkJFQkJBU0FBUWV2K0EwWWdBRUhwL2dOR0d3UkFJQUJCQVdzaUF4QUxMUUFBUWI5L2NTSUNRVDl4SWdSQlFHc2dCQ0FBUWV2K0EwWWJRWUNRQkdvZ0FUb0FBQ0FDUVlBQmNRUkFJQU1RQ3lBQ1FRRnFRWUFCY2pvQUFBc0xEQUlMSUFCQmgvNERURUVBSUFCQmhQNERUaHNFUUNQQ0FSQkJRUUFrd2dFQ1FBSkFBa0FDUUNBQVFZVCtBMGNFUUNBQVFZWCtBMnNPQXdFQ0F3UUxJOE1CSVFCQkFDVERBVUdFL2dNUUMwRUFPZ0FBSThrQkJIOGdBRUVCQW44Q1FBSkFBa0FDUUFKQUk4b0JEZ1FBQVFJREJBdEJDUXdFQzBFRERBTUxRUVVNQWd0QkJ3d0JDMEVBQzNSeEJVRUFDd1JBSThRQlFRRnFJZ0JCL3dGS0JIOUJBU1RGQVVFQUJTQUFDeVRFQVFzTUJRc0NRQ1BKQVFSQUk4WUJEUUVqeFFFRVFFRUFKTVVCQ3dzZ0FTVEVBUXNNQlFzZ0FTVElBU1BHQVVFQUk4a0JHd1JBSUFFa3hBRkJBQ1RHQVFzTUJBc2dBUkJDREFNTERBSUxJQUJCZ1A0RFJnUkFJQUZCL3dGekpOY0JJOWNCSWdKQkVIRkJBRWNrMkFFZ0FrRWdjVUVBUnlUWkFRc2dBRUdQL2dOR0JFQWdBVUVCY1VFQVJ5UzlBU0FCUVFKeFFRQkhKTDRCSUFGQkJIRkJBRWNrdndFZ0FVRUljVUVBUnlUQUFTQUJRUkJ4UVFCSEpNRUJJQUVrdkFFTUFnc2dBRUgvL3dOR0JFQWdBVUVCY1VFQVJ5UzNBU0FCUVFKeFFRQkhKTGdCSUFGQkJIRkJBRWNrdVFFZ0FVRUljVUVBUnlTNkFTQUJRUkJ4UVFCSEpMc0JJQUVrdGdFTUFnc01BUXRCQUE4TFFRRUxJZ0FnQUNQY0FVWUVRRUVCSk4wQkN5QUFJQUVRUXdSQUlBQVFDeUFCT2dBQUN3dFlBUU4vQTBBZ0F5QUNTQVJBSUFBZ0Eyb1FOeUVGSUFFZ0Eyb2hCQU5BSUFSQi83OENTZ1JBSUFSQmdFQnFJUVFNQVFzTElBUWdCUkJFSUFOQkFXb2hBd3dCQ3dzaitBRkJJQ1AvQVhRZ0FrRUVkV3hxSlBnQkN6b0FJK29CSTk4QlJrRUFJQUJCQVVaQkFTQUFHeHNFUUNBQlFRUnlJZ0ZCd0FCeEJFQkJBU1MrQVVFQkVDa0xCU0FCUVh0eElRRUxJQUVML0FJQkJIOGo0QUZGQkVBUEN5UHFBU0lDUVpBQlRnUi9RUUVGSStrQklnQkIrQUlqL3dGMElnRk9CSDlCQWdWQkEwRUFJQUFnQVU0YkN3c2lBQ1BlQVVjRVFFSEIvZ01RQ3kwQUFDRURJQUFrM2dGQkFDRUJBa0FDUUFKQUFrQWdBQ0lDQkVBZ0FrRUJhdzREQVFJREJBc2dBMEY4Y1NJRFFRaHhRUUJISVFFTUF3c2dBMEY5Y1VFQmNpSURRUkJ4UVFCSElRRU1BZ3NnQTBGK2NVRUNjaUlEUVNCeFFRQkhJUUVNQVFzZ0EwRURjaUVEQ3lBQkJFQkJBU1MrQVVFQkVDa0xJQUpGQkVBaitRRUVRQ1A3QVNQOEFTUDZBU0lCUVJCSUJIOGdBUVZCRUFzaUFCQkZJQUFqK3dGcUpQc0JJQUFqL0FGcUpQd0JJQUVnQUdzaUFDVDZBU0FBUVFCTUJFQkJBQ1Q1QVVIVi9nTVFDMEgvQVRvQUFBVkIxZjRERUFzZ0FFRUVkVUVCYTBIL2ZuRTZBQUFMQ3dzZ0FrRUJSZ1JBUVFFa3ZRRkJBQkFwQ3lBQ0lBTVFSaUVBUWNIK0F4QUxJQUE2QUFBRklBSkJtUUZHQkVBZ0FFSEIvZ01RQ3kwQUFCQkdJUUJCd2Y0REVBc2dBRG9BQUFzTEM0QUNBUU4vSStBQkJFQWdBQ1BwQVdvazZRRWpOaUVEQTBBajZRRkJCQ1AvQVNJQWRFSElBeUFBZENQcUFVR1pBVVliVGdSQUkra0JRUVFqL3dFaUFIUkJ5QU1nQUhRajZnRWlBVUdaQVVZYmF5VHBBU0FCUVpBQlJnUkFJQU1FUUVFQUlRQURRQ0FBUVpBQlRBUkFJQUJCL3dGeEVDZ2dBRUVCYWlFQURBRUxDd1VnQVJBb0MwRUFJUUFEUUNBQVFaQUJTQVJBUVFBaEFnTkFJQUpCb0FGSUJFQWdBaUFBUWFBQmJHcEJnSkVFYWtFQU9nQUFJQUpCQVdvaEFnd0JDd3NnQUVFQmFpRUFEQUVMQzBGL0pFZEJmeVJJQlNBQlFaQUJTQVJBSUFORkJFQWdBUkFvQ3dzTFFRQWdBVUVCYWlBQlFaa0JTaHNrNmdFTUFRc0xDeEJIQzhZQkFRTi9JODRCUlFSQUR3c0RRQ0FESUFCSUJFQWdBMEVFYWlFREFuOGp5d0VpQWtFRWFpSUJRZi8vQTBvRVFDQUJRWUNBQkdzaEFRc2dBUXNreXdFZ0FrRUJRUUpCQnlQTkFSc2lBblJ4Qkg4Z0FVRUJJQUowY1VVRlFRQUxCRUJCZ2Y0REVBc3RBQUJCQVhSQkFXcEIvd0Z4SVFGQmdmNERFQXNnQVRvQUFDUE1BVUVCYWlJQlFRaEdCRUJCQUNUTUFVRUJKTUFCUVFNUUtVR0MvZ01RQ3kwQUFFSC9mbkVoQVVHQy9nTVFDeUFCT2dBQVFRQWt6Z0VGSUFFa3pBRUxDd3dCQ3dzTDNBRUJBWDhqK0FGQkFFb0VRQ0FBSS9nQmFpRUFRUUFrK0FFTElBQWppZ0pxSklvQ0k0NENSUVJBSXpRRVFDQUFJK2dCYWlUb0FVRUVJLzhCSWdGMFFjZ0RJQUYwSStvQlFaa0JSaHNoQVFOQUkrZ0JJQUZPQkVBZ0FSQklJK2dCSUFGckpPZ0JEQUVMQ3dVZ0FCQklDeU16QkVBZ0FDT2tBV29rcEFFUU13VWdBQkFyUlVFQUl6Y2JCRUFnQUJBeEJTQUFFRElMQ3lBQUVFa0xJelVFUUNBQUk4SUJhaVRDQVNQQ0FSQkJRUUFrd2dFRklBQVFRUXNnQUNPUkFtb2lBQ09QQWs0RWZ5T1FBa0VCYWlTUUFpQUFJNDhDYXdVZ0FBc2trUUlMTEFFQmYwRUVFRW9qaVFKQkFXcEIvLzhEY1JBTExRQUFRUWgwSVFCQkJCQktJQUFqaVFJUUN5MEFBSElMUHdFQmZ5QUJRWUQrQTNGQkNIWWhBaUFBSUFGQi93RnhJZ0VRUXdSQUlBQVFDeUFCT2dBQUN5QUFRUUZxSWdBZ0FoQkRCRUFnQUJBTElBSTZBQUFMQzhZQkFDQUNCRUFnQVNBQVFmLy9BM0VpQUhNZ0FDQUJhbk1pQUVFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFZQUNjVUVBUjBFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N3VWdBQ0FCYWtILy93TnhJZ0lnQUVILy93TnhTVUVBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3lBQ0lBQWdBWE56UVlBZ2NVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3dzTG1nZ0JBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQTRRRXdBQkFnTUVCUVlIQ0FrS0N3d05EZzhMRUV0Qi8vOERjU0lBUVlEK0EzRkJDSFlrZ1FJZ0FFSC9BWEVrZ2dJTUR3c2pnZ0pCL3dGeEk0RUNRZjhCY1VFSWRISWhBQ09BQWlFQlFRUVFTaUFBSUFFUVJBd1JDeU9DQWtIL0FYRWpnUUpCL3dGeFFRaDBja0VCYWtILy93TnhJUUFNRVFzamdRSWlBRUVQY1VFQmFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZxUWY4QmNTSUFKSUVDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lNRHd0QkFTT0JBaUlBUVE5eFMwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGclFmOEJjU0lBSklFQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrSEFBSEpCL3dGeEpJY0NEQTRMUVFRUVNpT0pBaEFMTFFBQUpJRUNEQXNMSTRBQ0lnQkJnQUZ4UVlBQlJrRUFTd1JBSTRjQ1FSQnlRZjhCY1NTSEFnVWpod0pCN3dGeEpJY0NDeUFBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVrZ0FJTUN3c1FTMEgvL3dOeElRQWppQUloQVVFSUVFb2dBQ0FCRUV3TUNBc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWlBQ09DQWtIL0FYRWpnUUpCL3dGeFFRaDBjaUlCUVFBUVRTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDJKSVVDSUFCQi93RnhKSVlDSTRjQ1FiOEJjU1NIQWtFSUR3c2pnZ0pCL3dGeEk0RUNRZjhCY1VFSWRISWhBRUVFRUVvZ0FCQTNRZjhCY1NTQUFnd0pDeU9DQWtIL0FYRWpnUUpCL3dGeFFRaDBja0VCYTBILy93TnhJUUFNQ1FzamdnSWlBRUVQY1VFQmFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZxUWY4QmNTSUFKSUlDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lNQnd0QkFTT0NBaUlBUVE5eFMwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGclFmOEJjU0lBSklJQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrSEFBSEpCL3dGeEpJY0NEQVlMUVFRUVNpT0pBaEFMTFFBQUpJSUNEQU1MSTRBQ0lnQkJBWEZCQUV0QkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBRUVIZENBQVFmOEJjVUVCZG5KQi93RnhKSUFDREFNTFFYOFBDeU9KQWtFQ2FrSC8vd054SklrQ0RBSUxJNGtDUVFGcVFmLy9BM0VraVFJTUFRc2pod0pCL3dCeEpJY0NJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lMUVFRUEN5QUFRWUQrQTNGQkNIWWtnUUlnQUVIL0FYRWtnZ0pCQ0F2eUNBRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUkJyRGhBQUFRSURCQVVHQndnSkNnc01EUTRQRUFzai9nRUVRRUVFRUVwQnpmNERFRGRCL3dGeElnQWhBU0FBUVFGeEJFQWdBVUYrY1NJQVFZQUJjUVIvUVFBay93RWdBRUgvZm5FRlFRRWsvd0VnQUVHQUFYSUxJUUJCQkJCS1FjMytBeUFBRUVSQnhBQVBDd3RCQVNTT0Fnd1FDeEJMUWYvL0EzRWlBRUdBL2dOeFFRaDJKSU1DSUFCQi93RnhKSVFDSTRrQ1FRSnFRZi8vQTNFa2lRSU1FUXNqaEFKQi93RnhJNE1DUWY4QmNVRUlkSEloQUNPQUFpRUJRUVFRU2lBQUlBRVFSQXdRQ3lPRUFrSC9BWEVqZ3dKQi93RnhRUWgwY2tFQmFrSC8vd054SVFBTUVBc2pnd0lpQUVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGcVFmOEJjU1NEQWlPREFrVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWd3T0MwRUJJNE1DSWdCQkQzRkxRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMSUFCQkFXdEIvd0Z4SklNQ0k0TUNSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBZ3dOQzBFRUVFb2ppUUlRQ3kwQUFDU0RBZ3dLQ3lPQUFpSUJRWUFCY1VHQUFVWWhBQ09IQWtFRWRrRUJjU0FCUVFGMGNrSC9BWEVrZ0FJTUNndEJCQkJLSTRrQ0VBc3RBQUFoQUNPSkFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VraVFKQkNBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJZ0FqaEFKQi93RnhJNE1DUWY4QmNVRUlkSElpQVVFQUVFMGdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkaVNGQWlBQVFmOEJjU1NHQWlPSEFrRy9BWEVraHdKQkNBOExJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlJUUJCQkJCS0lBQVFOMEgvQVhFa2dBSU1DQXNqaEFKQi93RnhJNE1DUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0VBREFnTEk0UUNJZ0JCRDNGQkFXcEJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYWtIL0FYRWlBQ1NFQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDREFZTFFRRWpoQUlpQUVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmEwSC9BWEVpQUNTRUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBZ3dGQzBFRUVFb2ppUUlRQ3kwQUFDU0VBZ3dDQ3lPQUFpSUJRUUZ4SVFBamh3SkJCSFpCQVhGQkIzUWdBVUgvQVhGQkFYWnlKSUFDREFJTFFYOFBDeU9KQWtFQmFrSC8vd054SklrQ0RBRUxJQUJCQUVvRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzamh3SkIvd0J4SkljQ0k0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SUxRUVFQQ3lBQVFZRCtBM0ZCQ0hZa2d3SWdBRUgvQVhFa2hBSkJDQXVOQ2dFQ2Z3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFZ2F3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJNGNDUVFkMlFRRnhCRUFqaVFKQkFXcEIvLzhEY1NTSkFnVkJCQkJLSTRrQ0VBc3RBQUFoQUNPSkFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VraVFJTFFRZ1BDeEJMUWYvL0EzRWlBRUdBL2dOeFFRaDJKSVVDSUFCQi93RnhKSVlDSTRrQ1FRSnFRZi8vQTNFa2lRSU1FQXNqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUNPQUFpRUJRUVFRU2lBQUlBRVFSQ0FBUVFGcVFmLy9BM0VpQUVHQS9nTnhRUWgySklVQ0lBQkIvd0Z4SklZQ0RBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWhBQXdQQ3lPRkFpSUFRUTl4UVFGcVFSQnhRUUJIUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBQkJBV3BCL3dGeElnQWtoUUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBZ3dOQzBFQkk0VUNJZ0JCRDNGTFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxJQUJCQVd0Qi93RnhJZ0FraFFJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SU1EQXRCQkJCS0k0a0NFQXN0QUFBa2hRSU1DZ3RCQmtFQUk0Y0NJZ0pCQlhaQkFYRkJBRXNiSWdCQjRBQnlJQUFnQWtFRWRrRUJjVUVBU3hzaEFTT0FBaUVBSUFKQkJuWkJBWEZCQUVzRWZ5QUFJQUZyUWY4QmNRVWdBVUVHY2lBQklBQkJEM0ZCQ1VzYklnRkI0QUJ5SUFFZ0FFR1pBVXNiSWdFZ0FHcEIvd0Z4Q3lJQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NnQVVIZ0FIRkJBRWRCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzamh3SkIzd0Z4SkljQ0lBQWtnQUlNQ2dzamh3SkJCM1pCQVhGQkFFc0VRRUVFRUVvamlRSVFDeTBBQUNFQUk0a0NJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTSkFnVWppUUpCQVdwQi8vOERjU1NKQWd0QkNBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJZ0FnQUVFQUVFMGdBRUVCZEVILy93TnhJZ0JCZ1A0RGNVRUlkaVNGQWlBQVFmOEJjU1NHQWlPSEFrRy9BWEVraHdKQkNBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCS0lBQVFOMEgvQVhFa2dBSWdBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkaVNGQWlBQVFmOEJjU1NHQWd3SEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElRQU1Cd3NqaGdJaUFFRVBjVUVCYWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnFRZjhCY1NJQUpJWUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SU1CUXRCQVNPR0FpSUFRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZyUWY4QmNTSUFKSVlDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtIQUFISkIvd0Z4SkljQ0RBUUxRUVFRU2lPSkFoQUxMUUFBSklZQ0RBSUxJNEFDUVg5elFmOEJjU1NBQWlPSEFrSEFBSEpCL3dGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWd3Q0MwRi9Ed3NqaVFKQkFXcEIvLzhEY1NTSkFndEJCQThMSUFCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FrRUlDNlFKQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUV3YXc0UUFBRUNBd1FGQmdjSUNRb0xEQTBPRHhBTEk0Y0NRUVIyUVFGeEJFQWppUUpCQVdwQi8vOERjU1NKQWdWQkJCQktJNGtDRUFzdEFBQWhBQ09KQWlBQVFSaDBRUmgxYWtILy93TnhRUUZxUWYvL0EzRWtpUUlMUVFnUEN4QkxRZi8vQTNFa2lBSWppUUpCQW1wQi8vOERjU1NKQWd3UUN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFJNEFDSVFGQkJCQktJQUFnQVJCRUlBQkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIWWtoUUlnQUVIL0FYRWtoZ0lNRHdzamlBSkJBV3BCLy84RGNTU0lBa0VJRHdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUVILy93TnhJZ0FRTnlJQlFROXhRUUZxUVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMSUFGQkFXcEIvd0Z4SWdGRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0pCQkJCS0lBQWdBUkJFREEwTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJLUVFFZ0FFSC8vd054SWdBUU55SUJRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUJRUUZyUWY4QmNTSUJSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBa0VFRUVvZ0FDQUJFRVFNREFzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9qaVFJUUN5MEFBQ0VCUVFRUVNpQUFRZi8vQTNFZ0FVSC9BWEVRUkF3S0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJNGNDUVJCeVFmOEJjU1NIQWd3S0N5T0hBa0VFZGtFQmNRUkFRUVFRU2lPSkFoQUxMUUFBSVFBamlRSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054SklrQ0JTT0pBa0VCYWtILy93TnhKSWtDQzBFSUR3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWlBQ09JQWtFQUVFMGdBQ09JQW1wQi8vOERjU0lBUVlEK0EzRkJDSFlraFFJZ0FFSC9BWEVraGdJamh3SkJ2d0Z4SkljQ1FRZ1BDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNpQUFFRGRCL3dGeEpJQUNJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFlraFFJZ0FFSC9BWEVraGdJTUJ3c2ppQUpCQVd0Qi8vOERjU1NJQWtFSUR3c2pnQUlpQUVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGcVFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJTUJRdEJBU09BQWlJQVFROXhTMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnJRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDREFRTFFRUVFTaU9KQWhBTExRQUFKSUFDREFJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCQkhaQkFYRkJBRTFCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzTUFndEJmdzhMSTRrQ1FRRnFRZi8vQTNFa2lRSUxRUVFMK1FFQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVGQWFnNFFEd0FCQWdNRUJRWUhEd2dKQ2dzTURRNExJNElDSklFQ0RBNExJNE1DSklFQ0RBMExJNFFDSklFQ0RBd0xJNFVDSklFQ0RBc0xJNFlDSklFQ0RBb0xJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCS0lBQVFOMEgvQVhFa2dRSU1DUXNqZ0FJa2dRSU1DQXNqZ1FJa2dnSU1Cd3NqZ3dJa2dnSU1CZ3NqaEFJa2dnSU1CUXNqaFFJa2dnSU1CQXNqaGdJa2dnSU1Bd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUVFRUVFb2dBQkEzUWY4QmNTU0NBZ3dDQ3lPQUFpU0NBZ3dCQzBGL0R3dEJCQXY2QVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQWF3NFFBQUVQQWdNRUJRWUhDQWtQQ2dzTURRNExJNEVDSklNQ0RBNExJNElDSklNQ0RBMExJNFFDSklNQ0RBd0xJNFVDSklNQ0RBc0xJNFlDSklNQ0RBb0xJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCS0lBQVFOMEgvQVhFa2d3SU1DUXNqZ0FJa2d3SU1DQXNqZ1FJa2hBSU1Cd3NqZ2dJa2hBSU1CZ3NqZ3dJa2hBSU1CUXNqaFFJa2hBSU1CQXNqaGdJa2hBSU1Bd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUVFRUVFb2dBQkEzUWY4QmNTU0VBZ3dDQ3lPQUFpU0VBZ3dCQzBGL0R3dEJCQXY2QVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWVBQWF3NFFBQUVDQXc4RUJRWUhDQWtLQ3c4TURRNExJNEVDSklVQ0RBNExJNElDSklVQ0RBMExJNE1DSklVQ0RBd0xJNFFDSklVQ0RBc0xJNFlDSklVQ0RBb0xJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCS0lBQVFOMEgvQVhFa2hRSU1DUXNqZ0FJa2hRSU1DQXNqZ1FJa2hnSU1Cd3NqZ2dJa2hnSU1CZ3NqZ3dJa2hnSU1CUXNqaEFJa2hnSU1CQXNqaFFJa2hnSU1Bd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUVFRUVFb2dBQkEzUWY4QmNTU0dBZ3dDQ3lPQUFpU0dBZ3dCQzBGL0R3dEJCQXZhQXdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBR3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EaEFQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQUk0RUNJUUZCQkJCS0lBQWdBUkJFREE4TEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQWpnZ0loQVVFRUVFb2dBQ0FCRUVRTURnc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBQ09EQWlFQlFRUVFTaUFBSUFFUVJBd05DeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBSTRRQ0lRRkJCQkJLSUFBZ0FSQkVEQXdMSTRZQ1FmOEJjU09GQWlJQVFmOEJjVUVJZEhJaEFVRUVFRW9nQVNBQUVFUU1Dd3NqaGdJaUFFSC9BWEVqaFFKQi93RnhRUWgwY2lFQlFRUVFTaUFCSUFBUVJBd0tDeVA1QVVVRVFBSkFJN1FCQkVCQkFTU0xBZ3dCQ3lPMkFTTzhBWEZCSDNGRkJFQkJBU1NNQWd3QkMwRUJKSTBDQ3dzTUNRc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBQ09BQWlFQlFRUVFTaUFBSUFFUVJBd0lDeU9CQWlTQUFnd0hDeU9DQWlTQUFnd0dDeU9EQWlTQUFnd0ZDeU9FQWlTQUFnd0VDeU9GQWlTQUFnd0RDeU9HQWlTQUFnd0NDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNpQUFFRGRCL3dGeEpJQUNEQUVMUVg4UEMwRUVDNlFDQVFWL0k0QUNJZ01oQkNBQVFmOEJjU0lCSVFJZ0FVRUFUd1JBSUFSQkQzRWdBa0VQY1dwQkVIRkJBRWRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzRklBSkJIM1lpQlNBQ0lBVnFjMEVQY1NBRVFROXhTMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3dzZ0FVRUFUd1JBSUFOQi93RnhJQUVnQTJwQi93RnhTMEVBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3dVZ0FVRWZkaUlDSUFFZ0FtcHpJQU5CL3dGeFNrRUFTd1JBSTRjQ1FSQnlRZjhCY1NTSEFnVWpod0pCN3dGeEpJY0NDd3NnQUNBRGFrSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0M2OEJBUUovSUFBamdBSWlBV29qaHdKQkJIWkJBWEZxUWY4QmNTSUNJQUFnQVhOelFSQnhRUUJIUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBRWdBRUgvQVhGcUk0Y0NRUVIyUVFGeGFrR0FBbkZCQUV0QkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBaVNBQWlBQ1JVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDQy9nQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRWUFCYXc0UUFBRUNBd1FGQmdjSUNRb0xEQTBPRHhBTEk0RUNFRllNRUFzamdnSVFWZ3dQQ3lPREFoQldEQTRMSTRRQ0VGWU1EUXNqaFFJUVZnd01DeU9HQWhCV0RBc0xJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCS0lBQVFOeEJXREFvTEk0QUNFRllNQ1FzamdRSVFWd3dJQ3lPQ0FoQlhEQWNMSTRNQ0VGY01CZ3NqaEFJUVZ3d0ZDeU9GQWhCWERBUUxJNFlDRUZjTUF3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVvZ0FCQTNFRmNNQWdzamdBSVFWd3dCQzBGL0R3dEJCQXVyQWdFRmZ5T0FBaUlESVFSQkFDQUFRZjhCY1dzaUFTRUNJQUZCQUU0RVFDQUVRUTl4SUFKQkQzRnFRUkJ4UVFCSFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxCU0FDUVI5MUlnVWdBaUFGYW5OQkQzRWdCRUVQY1V0QkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc0xJQUZCQUU0RVFDQURRZjhCY1NBQklBTnFRZjhCY1V0QkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0ZJQUZCSDNVaUFpQUJJQUpxY3lBRFFmOEJjVXBCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzTElBTWdBR3RCL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWNBQWNrSC9BWEVraHdJTHN3RUJBbjhqZ0FJaUFTQUFheU9IQWtFRWRrRUJjV3RCL3dGeElnSWdBQ0FCYzNOQkVIRkJBRWRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FTQUFRZjhCY1dzamh3SkJCSFpCQVhGclFZQUNjVUVBUzBFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUNKSUFDSUFKRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtIQUFISkIvd0Z4SkljQ0MvZ0JBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVpBQmF3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJNEVDRUZrTUVBc2pnZ0lRV1F3UEN5T0RBaEJaREE0TEk0UUNFRmtNRFFzamhRSVFXUXdNQ3lPR0FoQlpEQXNMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTnhCWkRBb0xJNEFDRUZrTUNRc2pnUUlRV2d3SUN5T0NBaEJhREFjTEk0TUNFRm9NQmdzamhBSVFXZ3dGQ3lPRkFoQmFEQVFMSTRZQ0VGb01Bd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUVFRUVFb2dBQkEzRUZvTUFnc2pnQUlRV2d3QkMwRi9Ed3RCQkF2bkNRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdnQVdzT0VBQUJBZ01FQlFZSENBa0tDd3dORGc4UUN5T0JBaU9BQW5FaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWd3UUN5T0NBaU9BQW5FaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWd3UEN5T0RBaU9BQW5FaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWd3T0N5T0VBaU9BQW5FaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWd3TkN5T0ZBaU9BQW5FaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWd3TUN5T0dBaU9BQW5FaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWd3TEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU2lBQUVEY2pnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNQ2dzamdBSWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd0pDeU9CQWlPQUFuTkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SU1DQXNqZ2dJamdBSnpRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NEQWNMSTRNQ0k0QUNjMEgvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBZ3dHQ3lPRUFpT0FBbk5CL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lNQlFzamhRSWpnQUp6UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDREFRTEk0WUNJNEFDYzBIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWd3REN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU2lBQUVEY2pnQUp6UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDREFJTFFRQWtnQUlqaHdKQmdBRnlRZjhCY1NTSEFpT0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NEQUVMUVg4UEN5T0hBa0h2QVhFa2h3SkJCQXVnQWdFRWZ5T0FBaUlDSVFOQkFDQUFRZjhCY1dzaUFDRUJJQUJCQUU0RVFDQURRUTl4SUFGQkQzRnFRUkJ4UVFCSFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxCU0FCUVI5MUlnUWdBU0FFYW5OQkQzRWdBMEVQY1V0QkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc0xJQUJCQUU0RVFDQUNRZjhCY1NBQUlBSnFRZjhCY1V0QkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0ZJQUJCSDNVaUFTQUFJQUZxY3lBQ1FmOEJjVXBCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzTElBQWdBbXBGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDQzh3R0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRYkFCYXc0UUFBRUNBd1FGQmdjSUNRb0xEQTBPRHhBTEk0RUNJNEFDY2tIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTUVBc2pnZ0lqZ0FKeVFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd1BDeU9EQWlPQUFuSkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQTRMSTRRQ0k0QUNja0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaU9IQWtIdkFYRWtod0lNRFFzamhRSWpnQUp5UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWd3TUN5T0dBaU9BQW5KQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJamh3SkI3d0Z4SkljQ0RBc0xJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCS0lBQVFOeU9BQW5KQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJamh3SkI3d0Z4SkljQ0RBb0xJNEFDUWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWd3SkN5T0JBaEJkREFnTEk0SUNFRjBNQndzamd3SVFYUXdHQ3lPRUFoQmREQVVMSTRVQ0VGME1CQXNqaGdJUVhRd0RDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNpQUFFRGNRWFF3Q0N5T0FBaEJkREFFTFFYOFBDMEVFQzBVQkFuOGdBQkEySWdGQmYwWUVmeUFBRUFzdEFBQUZJQUVMUWY4QmNTRUNJQUlnQUVFQmFpSUJFRFlpQUVGL1JnUi9JQUVRQ3kwQUFBVWdBQXRCL3dGeFFRaDBjZ3Y1RVFFRmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUWR4SWdVT0NBQUJBZ01FQlFZSENBc2pnUUloQVF3SEN5T0NBaUVCREFZTEk0TUNJUUVNQlFzamhBSWhBUXdFQ3lPRkFpRUJEQU1MSTRZQ0lRRU1BZ3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQVVFRUVFb2dBUkEzSVFFTUFRc2pnQUloQVFzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIySWdRT0VBQUJBZ01FQlFZSENBa0tDd3dORGc4UUN5QUFRUWRNQkg4Z0FVR0FBWEZCZ0FGR1FRQkxCRUFqaHdKQkVISkIvd0Z4SkljQ0JTT0hBa0h2QVhFa2h3SUxJQUZCQVhRZ0FVSC9BWEZCQjNaeVFmOEJjU0lDUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBa0VCQlNBQVFROU1CSDhnQVVFQmNVRUFTMEVBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3lBQlFRZDBJQUZCL3dGeFFRRjJja0gvQVhFaUFrVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdKQkFRVkJBQXNMSVFNTUR3c2dBRUVYVEFSL0k0Y0NRUVIyUVFGeElBRkJBWFJ5UWY4QmNTRUNJQUZCZ0FGeFFZQUJSa0VBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3lBQ1JVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWtFQkJTQUFRUjlNQkg4amh3SkJCSFpCQVhGQkIzUWdBVUgvQVhGQkFYWnlJUUlnQVVFQmNVRUFTd1JBSTRjQ1FSQnlRZjhCY1NTSEFnVWpod0pCN3dGeEpJY0NDeUFDUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBa0VCQlVFQUN3c2hBd3dPQ3lBQVFTZE1CSDhnQVVFQmRFSC9BWEVoQWlBQlFZQUJjVUdBQVVaQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SkJBUVVnQUVFdlRBUi9JQUZCQVhFaEFDQUJRZjhCY1VFQmRpSUNRWUFCY2lBQ0lBRkJnQUZ4UVlBQlJoc2lBa0gvQVhGRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSUFCQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFndEJBUVZCQUFzTElRTU1EUXNnQUVFM1RBUi9JQUZCRDNGQkJIUWdBVUh3QVhGQkJIWnlJZ0pGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJNGNDUWU4QmNTU0hBa0VCQlNBQVFUOU1CSDhnQVVIL0FYRkJBWFlpQWtWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lnQVVFQmNVRUFTd1JBSTRjQ1FSQnlRZjhCY1NTSEFnVWpod0pCN3dGeEpJY0NDMEVCQlVFQUN3c2hBd3dNQ3lBQVFjY0FUQVIvSUFFaUFrRUJjVVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0pCQVFVZ0FFSFBBRXdFZnlBQklnSkJBbkZGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCSUhKQi93RnhKSWNDUVFFRlFRQUxDeUVEREFzTElBQkIxd0JNQkg4Z0FTSUNRUVJ4UlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWtFQkJTQUFRZDhBVEFSL0lBRWlBa0VJY1VWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdKQkFRVkJBQXNMSVFNTUNnc2dBRUhuQUV3RWZ5QUJJZ0pCRUhGRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQklISkIvd0Z4SkljQ1FRRUZJQUJCN3dCTUJIOGdBU0lDUVNCeFJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFrRUJCVUVBQ3dzaEF3d0pDeUFBUWZjQVRBUi9JQUVpQWtIQUFIRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NRUUVGSUFCQi93Qk1CSDhnQVNJQ1FZQUJjVVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0pCQVFWQkFBc0xJUU1NQ0FzZ0FFR0hBVXdFZjBFQklRTWdBVUYrY1FVZ0FFR1BBVXdFZjBFQklRTWdBVUY5Y1FWQkFBc0xJUUlNQndzZ0FFR1hBVXdFZjBFQklRTWdBVUY3Y1FVZ0FFR2ZBVXdFZjBFQklRTWdBVUYzY1FWQkFBc0xJUUlNQmdzZ0FFR25BVXdFZjBFQklRTWdBVUZ2Y1FVZ0FFR3ZBVXdFZjBFQklRTWdBVUZmY1FWQkFBc0xJUUlNQlFzZ0FFRzNBVXdFZjBFQklRTWdBVUcvZjNFRklBQkJ2d0ZNQkg5QkFTRURJQUZCLzM1eEJVRUFDd3NoQWd3RUN5QUFRY2NCVEFSL1FRRWhBeUFCUVFGeUJTQUFRYzhCVEFSL1FRRWhBeUFCUVFKeUJVRUFDd3NoQWd3REN5QUFRZGNCVEFSL1FRRWhBeUFCUVFSeUJTQUFRZDhCVEFSL1FRRWhBeUFCUVFoeUJVRUFDd3NoQWd3Q0N5QUFRZWNCVEFSL1FRRWhBeUFCUVJCeUJTQUFRZThCVEFSL1FRRWhBeUFCUVNCeUJVRUFDd3NoQWd3QkN5QUFRZmNCVEFSL1FRRWhBeUFCUWNBQWNnVWdBRUgvQVV3RWYwRUJJUU1nQVVHQUFYSUZRUUFMQ3lFQ0N3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUZEZ2dBQVFJREJBVUdCd2dMSUFJa2dRSU1Cd3NnQWlTQ0Fnd0dDeUFDSklNQ0RBVUxJQUlraEFJTUJBc2dBaVNGQWd3REN5QUNKSVlDREFJTFFRRWdCRUVIU3lBRVFRUkpHd1JBSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFnQWhCRUN3d0JDeUFDSklBQ0MwRUVRWDhnQXhzTGxnVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhBQVdzT0VBQUJBaEVEQkFVR0J3Z0pDZ3NNRFE0UEN5T0hBa0VIZGtFQmNRMFJEQk1MSTRnQ0lRQkJDQkJLSUFBUVgwSC8vd054SVFBamlBSkJBbXBCLy84RGNTU0lBaUFBUVlEK0EzRkJDSFlrZ1FJZ0FFSC9BWEVrZ2dKQkJBOExJNGNDUVFkMlFRRnhSUTBPREEwTEk0Y0NRUWQyUVFGeERRd2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NRUUpxUWYvL0EzRWhBVUVJRUVvZ0FDQUJFRXdNRFFzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRJQ1FmOEJjU09CQWtIL0FYRkJDSFJ5SVFGQkNCQktJQUFnQVJCTURBMExRUVFRU2lPSkFoQUxMUUFBRUZZTURRc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCS0lBQWdBUkJNUVFBa2lRSU1Dd3NqaHdKQkIzWkJBWEZGRFFvTURBc2ppQUloQUVFSUVFb2dBQkJmUWYvL0EzRWtpUUlnQUVFQ2FrSC8vd054SklnQ0RBa0xJNGNDUVFkMlFRRnhEUWNNQmd0QkJCQktJNGtDRUFzdEFBQVFZQ0VBSTRrQ1FRRnFRZi8vQTNFa2lRSWdBQThMSTRjQ1FRZDJRUUZ4UlEwRUk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFrRUNha0gvL3dOeElRRkJDQkJLSUFBZ0FSQk1EQVVMSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9KQWtFQ2FrSC8vd054SVFGQkNCQktJQUFnQVJCTURBUUxRUVFRU2lPSkFoQUxMUUFBRUZjTUJRc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCS0lBQWdBUkJNUVFna2lRSU1Bd3RCZnc4TEk0a0NRUUpxUWYvL0EzRWtpUUpCREE4TEVFdEIvLzhEY1NTSkFndEJDQThMSTRrQ1FRRnFRZi8vQTNFa2lRSkJCQThMSTRnQ0lRQkJDQkJLSUFBUVgwSC8vd054SklrQ0lBQkJBbXBCLy84RGNTU0lBa0VNQzhvRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIUUFXc09FQUFCQWcwREJBVUdCd2dKRFFvTkN3d05DeU9IQWtFRWRrRUJjUTBQREJFTEk0Z0NJUUJCQ0JCS0lBQVFYMEgvL3dOeElRRWdBRUVDYWtILy93TnhKSWdDSUFGQmdQNERjVUVJZGlTREFpQUJRZjhCY1NTRUFrRUVEd3NqaHdKQkJIWkJBWEZGRFF3TUN3c2pod0pCQkhaQkFYRU5DaU9JQWtFQ2EwSC8vd054SWdBa2lBSWppUUpCQW1wQi8vOERjU0VCUVFnUVNpQUFJQUVRVEF3TEN5T0lBa0VDYTBILy93TnhJZ0FraUFJamhBSkIvd0Z4STRNQ1FmOEJjVUVJZEhJaEFVRUlFRW9nQUNBQkVFd01Dd3RCQkJCS0k0a0NFQXN0QUFBUVdRd0xDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWppUUloQVVFSUVFb2dBQ0FCRUV4QkVDU0pBZ3dKQ3lPSEFrRUVka0VCY1VVTkNBd0tDeU9JQWlFQVFRZ1FTaUFBRUY5Qi8vOERjU1NKQWtFQkpMVUJJQUJCQW1wQi8vOERjU1NJQWd3SEN5T0hBa0VFZGtFQmNRMEZEQVFMSTRjQ1FRUjJRUUZ4UlEwREk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFrRUNha0gvL3dOeElRRkJDQkJLSUFBZ0FSQk1EQVFMUVFRUVNpT0pBaEFMTFFBQUVGb01CUXNqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNGtDSVFGQkNCQktJQUFnQVJCTVFSZ2tpUUlNQXd0QmZ3OExJNGtDUVFKcVFmLy9BM0VraVFKQkRBOExFRXRCLy84RGNTU0pBZ3RCQ0E4TEk0a0NRUUZxUWYvL0EzRWtpUUpCQkE4TEk0Z0NJUUJCQ0JCS0lBQVFYMEgvL3dOeEpJa0NJQUJCQW1wQi8vOERjU1NJQWtFTUM1UUZBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIZ0FXc09FQUFCQWdzTEF3UUZCZ2NJQ3dzTENRb0xDMEVFRUVvamlRSVFDeTBBQUNFQUk0QUNJUUZCQkJCS0lBQkIvd0Z4UVlEK0Eyb2dBUkJFREFzTEk0Z0NJUUJCQ0JCS0lBQVFYMEgvL3dOeElRRWdBRUVDYWtILy93TnhKSWdDSUFGQmdQNERjVUVJZGlTRkFpQUJRZjhCY1NTR0FrRUVEd3NqZ2dKQmdQNERhaUVBSTRBQ0lRRkJCQkJLSUFBZ0FSQkVRUVFQQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQVVFSUVFb2dBQ0FCRUV4QkNBOExRUVFRU2lPSkFoQUxMUUFBSTRBQ2NTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQklISkIvd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd0hDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWppUUloQVVFSUVFb2dBQ0FCRUV4QklDU0pBa0VJRHd0QkJCQktJNGtDRUFzc0FBQWhBQ09JQWlBQVFRRVFUU0FBSTRnQ2FrSC8vd054SklnQ0k0Y0NRZjhBY1NTSEFpT0hBa0cvQVhFa2h3SWppUUpCQVdwQi8vOERjU1NKQWtFTUR3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWtpUUpCQkE4TEVFdEIvLzhEY1NFQUk0QUNJUUZCQkJCS0lBQWdBUkJFSTRrQ1FRSnFRZi8vQTNFa2lRSkJCQThMUVFRUVNpT0pBaEFMTFFBQUk0QUNjMEgvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaU9IQWtIdkFYRWtod0lNQWdzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRrQ0lRRkJDQkJLSUFBZ0FSQk1RU2draVFKQkNBOExRWDhQQ3lPSkFrRUJha0gvL3dOeEpJa0NRUVFMK2dRQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJhdzRRQUFFQ0F3MEVCUVlIQ0FrS0RRMExEQTBMUVFRUVNpT0pBaEFMTFFBQUlRQkJCQkJLSUFCQi93RnhRWUQrQTJvUU4wSC9BWEVrZ0FJTURRc2ppQUloQUVFSUVFb2dBQkJmUWYvL0EzRWhBU0FBUVFKcVFmLy9BM0VraUFJZ0FVR0EvZ054UVFoMkpJQUNJQUZCL3dGeEpJY0NEQTBMSTRJQ1FZRCtBMm9oQUVFRUVFb2dBQkEzUWY4QmNTU0FBZ3dNQzBFQUpMUUJEQXNMSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9IQWtIL0FYRWpnQUpCL3dGeFFRaDBjaUVCUVFnUVNpQUFJQUVRVEVFSUR3dEJCQkJLSTRrQ0VBc3RBQUFqZ0FKeVFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd0lDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWppUUloQVVFSUVFb2dBQ0FCRUV4Qk1DU0pBa0VJRHd0QkJCQktJNGtDRUFzdEFBQWhBQ09IQWtIL0FIRWtod0lqaHdKQnZ3RnhKSWNDSTRnQ0lnRWdBRUVZZEVFWWRTSUFRUUVRVFNBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMkpJVUNJQUJCL3dGeEpJWUNJNGtDUVFGcVFmLy9BM0VraVFKQkNBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlKSWdDUVFnUEN4QkxRZi8vQTNFaEFFRUVFRW9nQUJBM1FmOEJjU1NBQWlPSkFrRUNha0gvL3dOeEpJa0NEQVVMUVFFa3RRRU1CQXRCQkJCS0k0a0NFQXN0QUFBUVhRd0NDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWppUUloQVVFSUVFb2dBQ0FCRUV4Qk9DU0pBa0VJRHd0QmZ3OExJNGtDUVFGcVFmLy9BM0VraVFJTFFRUUx2QUVCQVg4amlRSkJBV3BCLy84RGNTSUJRUUZyUWYvL0EzRWdBU09OQWhza2lRSUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFmQUJjVUVFZGc0UEFBRUNBd1FGQmdjSUNRb0xEQTBPRHdzZ0FCQk9Ed3NnQUJCUER3c2dBQkJRRHdzZ0FCQlJEd3NnQUJCU0R3c2dBQkJURHdzZ0FCQlVEd3NnQUJCVkR3c2dBQkJZRHdzZ0FCQmJEd3NnQUJCY0R3c2dBQkJlRHdzZ0FCQmhEd3NnQUJCaUR3c2dBQkJqRHdzZ0FCQmtDN1lCQVFKL1FRQWt0QUZCai80REVBc3RBQUJCZmlBQWQzRWlBU1M4QVVHUC9nTVFDeUFCT2dBQUk0Z0NRUUpyUWYvL0EzRWtpQUlqaVFJaEFTT0lBaUlDRUFzZ0FUb0FBQ0FDUVFGcUVBc2dBVUdBL2dOeFFRaDJPZ0FBQWtBQ1FBSkFBa0FDUUFKQUlBQU9CUUFCQWdNRUJRdEJBQ1M5QVVIQUFDU0pBZ3dFQzBFQUpMNEJRY2dBSklrQ0RBTUxRUUFrdndGQjBBQWtpUUlNQWd0QkFDVEFBVUhZQUNTSkFnd0JDMEVBSk1FQlFlQUFKSWtDQ3d2bkFRRUJmeU8xQVFSQVFRRWt0QUZCQUNTMUFRc2p0Z0VqdkFGeFFSOXhRUUJMQkVBampBSkZRUUFqdEFFYkJIOGp2UUZCQUNPM0FSc0VmMEVBRUdaQkFRVWp2Z0ZCQUNPNEFSc0VmMEVCRUdaQkFRVWp2d0ZCQUNPNUFSc0VmMEVDRUdaQkFRVWp3QUZCQUNPNkFSc0VmMEVERUdaQkFRVWp3UUZCQUNPN0FSc0VmMEVFRUdaQkFRVkJBQXNMQ3dzTEJVRUFDd1IvUVFFampBSWppd0liQkg5QkFDU01Ba0VBSklzQ1FRQWtqUUpCQUNTT0FrRVlCVUVVQ3dWQkFBc2hBRUVCSTR3Q0k0c0NHd1JBUVFBa2pBSkJBQ1NMQWtFQUpJMENRUUFramdJTElBQVBDMEVBQzYwQkFRSi9RUUVrbFFJampRSUVRQ09KQWhBTExRQUFFR1VRU2tFQUpJd0NRUUFraXdKQkFDU05Ba0VBSkk0Q0N4Qm5JZ0ZCQUVvRVFDQUJFRW9MUVFBampnSkZRUUVqakFJaml3SWJHd1IvSTRrQ0VBc3RBQUFRWlFWQkJBc2hBU09IQWtId0FYRWtod0lnQVVFQVRBUkFJQUVQQ3lBQkVFb2psQUpCQVdvaUFDT1NBazRFZnlPVEFrRUJhaVNUQWlBQUk1SUNhd1VnQUFza2xBSWppUUlqMmdGR0JFQkJBU1RkQVFzZ0FRc0ZBQ096QVF1cEFRRURmeUFBUVg5QmdBZ2dBRUVBU0JzZ0FFRUFTaHNoQUFOQUk5MEJSVUVBSUFGRlFRQkJBQ0FDUlNBREd4c2JCRUFRYUVFQVNBUkFRUUVoQXdVamlnSkIwS1FFSS84QmRFNEVRRUVCSVFJRlFRRWdBU096QVNBQVRrRUFJQUJCZjBvYkd5RUJDd3NNQVFzTElBSUVRQ09LQWtIUXBBUWovd0YwYXlTS0FrRUFEd3NnQVFSQVFRRVBDeVBkQVFSQVFRQWszUUZCQWc4TEk0a0NRUUZyUWYvL0EzRWtpUUpCZndzR0FFRi9FR29MTXdFQ2Z3TkFJQUZCQUU1QkFDQUNJQUJJR3dSQVFYOFFhaUVCSUFKQkFXb2hBZ3dCQ3dzZ0FVRUFTQVJBSUFFUEMwRUFDd1VBSTQ4Q0N3VUFJNUFDQ3dVQUk1RUNDL0VCQVFGL1FRQWtqZ0lDZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQURnZ0FBUUlEQkFVR0J3Z0xJODhCREFnTEk5SUJEQWNMSTlBQkRBWUxJOUVCREFVTEk5TUJEQVFMSTlRQkRBTUxJOVVCREFJTEk5WUJEQUVMUVFBTFJTRUJBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFPQ0FBQkFnTUVCUVlIQ0F0QkFTVFBBUXdIQzBFQkpOSUJEQVlMUVFFazBBRU1CUXRCQVNUUkFRd0VDMEVCSk5NQkRBTUxRUUVrMUFFTUFndEJBU1RWQVF3QkMwRUJKTllCQ3lBQkJFQkJBU0FBUVFOTUlnRkJBQ1BZQVJzRWYwRUJCVUVBQ3lBQlJVRUFJOWtCR3hzRVFFRUJKTUVCUVFRUUtRc0xDNUlCQUNBQVFRQktCRUJCQUJCd0JVRUFKTThCQ3lBQlFRQktCRUJCQVJCd0JVRUFKTklCQ3lBQ1FRQktCRUJCQWhCd0JVRUFKTkFCQ3lBRFFRQktCRUJCQXhCd0JVRUFKTkVCQ3lBRVFRQktCRUJCQkJCd0JVRUFKTk1CQ3lBRlFRQktCRUJCQlJCd0JVRUFKTlFCQ3lBR1FRQktCRUJCQmhCd0JVRUFKTlVCQ3lBSFFRQktCRUJCQnhCd0JVRUFKTllCQ3dzSEFDQUFKTm9CQ3djQVFYOGsyZ0VMQndBZ0FDVGJBUXNIQUVGL0pOc0JDd2NBSUFBazNBRUxCd0JCZnlUY0FRc0ZBQ09BQWdzRkFDT0JBZ3NGQUNPQ0Fnc0ZBQ09EQWdzRkFDT0VBZ3NGQUNPRkFnc0ZBQ09HQWdzRkFDT0hBZ3NGQUNPSkFnc0ZBQ09JQWdzS0FDT0pBaEFMTFFBQUN3VUFJK29CQzlRREFRbC9RWUNBQWtHQWtBSWo0d0ViSVFSQmdMZ0NRWUN3QWlQa0FSc2hDUU5BSUFaQmdBSklCRUJCQUNFRkEwQWdCVUdBQWtnRVFDQUpJQVpCQTNWQkJYUnFJQVZCQTNWcUlnZEJnSkIrYWkwQUFDRUJJQVpCQ0c4aEFrRUhJQVZCQ0c5cklRZ2dCQ0FFUVlDUUFrWUVmeUFCUVlBQmF5QUJRWUFCYWlBQlFZQUJjUnNGSUFFTFFRUjBhaUVESUFCQkFFcEJBQ1ArQVJzRWZ5QUhRWURRZm1vdEFBQUZRUUFMSWdGQndBQnhCRUJCQnlBQ2F5RUNDeUFCUVFoeFJVVkJEWFFpQnlBRElBSkJBWFJxSWdOQmdKQithbW90QUFBaEFpQUhJQU5CZ1pCK2Ftb3RBQUJCQVNBSWRIRUVmMEVDQlVFQUN5SURRUUZxSUFNZ0FrRUJJQWgwY1JzaEF5QUZJQVpCQ0hScVFRTnNJUUlnQUVFQVNrRUFJLzRCR3dSQUlBSkJnS0VMYWlJQ0lBRkJCM0ZCQTNRZ0EwRUJkR29pQVVFQmFrRS9jVUdBa0FScUxRQUFRUWgwSUFGQlAzRkJnSkFFYWkwQUFISWlBVUVmY1VFRGREb0FBQ0FDSUFGQjRBZHhRUVYyUVFOME9nQUJJQUlnQVVHQStBRnhRUXAyUVFOME9nQUNCU0FDUVlDaEMyb2lBU0FEUWNmK0F4QWlJZ05CZ0lEOEIzRkJFSFk2QUFBZ0FTQURRWUQrQTNGQkNIWTZBQUVnQVNBRE9nQUNDeUFGUVFGcUlRVU1BUXNMSUFaQkFXb2hCZ3dCQ3dzTDJRTUJDMzhEUUNBQ1FSZElCRUJCQUNFRkEwQWdCVUVmU0FSQUlBVkJEMG9oQ1NBQ0lnRkJEMG9FZnlBQlFROXJCU0FCQzBFRWRDSUJJQVZCRDJ0cUlBRWdCV29nQlVFUFNoc2hCMEhIL2dNaENrRi9JUU5CQUNFQUEwQWdBRUVJU0FSQVFRQWhCQU5BSUFSQkJVZ0VRQ0FISUFBZ0JFRURkR3BCQW5RaUFVR0MvQU5xRUFzdEFBQkdCRUFnQ1NBQlFZUDhBMm9RQ3kwQUFDSUJRUWh4UVFBai9nRWJSVVZHQkVBQ2YwRUZJUVJCeWY0RFFjaitBeUFCSWdOQkVIRWJJUXBCQ0FzaEFBc0xJQVJCQVdvaEJBd0JDd3NnQUVFQmFpRUFEQUVMQ3lBRFFRQklRUUFqL2dFYkJIOUJnTGdDUVlDd0FpUGtBUnNoQ0VGL0lRQkJBQ0VFQTBBZ0JFRWdTQVJBUVFBaEJnTkFJQVpCSUVnRVFDQUhJQVFnQ0NBR1FRVjBhbW9pQVVHQWtINXFMUUFBUmdSQUFuOUJJQ0VFUVNBaEJpQUJDeUVBQ3lBR1FRRnFJUVlNQVFzTElBUkJBV29oQkF3QkN3c2dBRUVBVGdSL0lBQkJnTkIrYWkwQUFBVkJmd3NGUVg4TElRRkJnSkFDUVlDQUFpQUNRUTlLR3lFSVFRQWhBQU5BSUFCQkNFZ0VRQ0FISUFnZ0NVRUFRUWNnQUNBRlFRTjBJQUFnQWtFRGRHcEIrQUZCZ0tFWElBb2dBU0FERUNNYUlBQkJBV29oQUF3QkN3c2dCVUVCYWlFRkRBRUxDeUFDUVFGcUlRSU1BUXNMQzVnQ0FRbC9BMEFnQkVFSVNBUkFRUUFoQWdOQUlBSkJCVWdFUUNBRUlBSkJBM1JxUVFKMElnRkJnUHdEYWhBTExRQUFHaUFCUVlIOEEyb1FDeTBBQUJvZ0FVR0MvQU5xRUFzdEFBQWhBRUVCSVFVajVRRUVRQUovUVFJaEJTQUFRUUp2UVFGR0JIOGdBRUVCYXdVZ0FBc0xJUUFMSUFGQmcvd0RhaEFMTFFBQUlnWkJDSEZCQUNQK0FSdEZSU0VIUWNuK0EwSEkvZ01nQmtFUWNSc2hDRUVBSVFFRFFDQUJJQVZJQkVCQkFDRURBMEFnQTBFSVNBUkFJQUFnQVdwQmdJQUNJQWRCQUVFSElBTWdCRUVEZENBRElBSkJCSFJxSUFGQkEzUnFRY0FBUVlDaElDQUlRWDhnQmhBakdpQURRUUZxSVFNTUFRc0xJQUZCQVdvaEFRd0JDd3NnQWtFQmFpRUNEQUVMQ3lBRVFRRnFJUVFNQVFzTEN3VUFJOE1CQ3dVQUk4UUJDd1VBSThnQkN4SUJBWDhqeWdFaUFFRUVjaUFBSThrQkd3c3VBUUYvQTBBZ0FFSC8vd05JQkVBZ0FFR0F0Y2tFYWlBQUVEYzZBQUFnQUVFQmFpRUFEQUVMQzBFQUpOMEJDMlVBUWZMbHl3Y2tPMEdnd1lJRkpEeEIyTERoQWlROVFZaVFJQ1ErUWZMbHl3Y2tQMEdnd1lJRkpFQkIyTERoQWlSQlFZaVFJQ1JDUWZMbHl3Y2tRMEdnd1lJRkpFUkIyTERoQWlSRlFZaVFJQ1JHUHdCQmxBRklCRUJCbEFFL0FHdEFBQm9MQ3dNQUFRdThBUUVDZnlBQUtBSUVJZ0pCLy8vLy93QnhJUUVnQUNnQ0FFRUJjUVJBUVFCQmdBbEIrZ0JCRGhBQUFBc2dBVUVCUmdSQUFrQUNRQUpBSUFBb0FnZ09Bd0lDQUFFTElBQW9BaEFpQVFSQUlBRkJ2QWxQQkVBZ0FVRVFheENPQVFzTERBRUxBQXNnQWtHQWdJQ0FlSEVFUUVFQVFZQUpRZjRBUVJJUUFBQUxJQUFnQUNnQ0FFRUJjallDQUNNQUlBQVFBZ1VnQVVFQVRRUkFRUUJCZ0FsQmlBRkJFQkFBQUFzZ0FDQUJRUUZySUFKQmdJQ0FnSDl4Y2pZQ0JBc0xIQUFDUUFKQUFrQWpsd0lPQWdFQ0FBc0FDMEVBSVFBTElBQVFhZ3NkQUFKQUFrQUNRQ09YQWc0REFRRUNBQXNBQzBGL0lRRUxJQUVRYWdzSEFDQUFKSmNDQ3d1L0FRUUFRWUFJQ3kwZUFBQUFBUUFBQUFFQUFBQWVBQUFBZmdCc0FHa0FZZ0F2QUhJQWRBQXZBSFFBYkFCekFHWUFMZ0IwQUhNQVFiQUlDemNvQUFBQUFRQUFBQUVBQUFBb0FBQUFZUUJzQUd3QWJ3QmpBR0VBZEFCcEFHOEFiZ0FnQUhRQWJ3QnZBQ0FBYkFCaEFISUFad0JsQUVId0NBc3RIZ0FBQUFFQUFBQUJBQUFBSGdBQUFINEFiQUJwQUdJQUx3QnlBSFFBTHdCd0FIVUFjZ0JsQUM0QWRBQnpBRUdnQ1FzVkF3QUFBQ0FBQUFBQUFBQUFJQUFBQUFBQUFBQWdBRE1RYzI5MWNtTmxUV0Z3Y0dsdVoxVlNUQ0ZqYjNKbEwyUnBjM1F2WTI5eVpTNTFiblJ2ZFdOb1pXUXVkMkZ6YlM1dFlYQT0iKToKInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93fHwidW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmP2F3YWl0IEkoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZlJCZ0FYOEJmMkFCZndCZ0FBRi9ZQUFBWUFKL2Z3Ri9ZQUovZndCZ0EzOS9md0JnQm45L2YzOS9md0JnQkg5L2YzOEFZQWQvZjM5L2YzOS9BR0FJZjM5L2YzOS9mMzhBWUFwL2YzOS9mMzkvZjM5L0FHQURmMzkvQVg5Z0JIOS9mMzhCZjJBRmYzOS9mMzhCZjJBTmYzOS9mMzkvZjM5L2YzOS9md0YvQWcwQkEyVnVkZ1ZoWW05eWRBQUlBNU1Ca1FFRkJRWUNCQVlNQkFBQkFBTUJBUU1EQXdzQ0F3TURBd01EQXdNREFnSUNBZzRFRHdrSEJ3VUJBUU1BQUFBQUFBMEJBUU1BQWdBQUJRTUJBUUVCQkFFQkFRRUVCUVlFQXdFQkFRSUZCZ0FBQUFBQUFBQUFBUUVBQVFFQUFBRUFBQUFBQUFBQUFBRUNBZ0lBQWdBQ0FnSUJDZ0VEQVFNQkF3SUNBZ0lDQWdJQ0FnSUNBZ0VEQXdJQ0FnSURBd01CQUFRQkJRTUJBQUVHM2d1WUFuOEJRUUFMZndGQkFBdC9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUVlDQUFRdC9BRUdBa0FFTGZ3QkJnSUFDQzM4QVFZQ1FBd3QvQUVHQWdBRUxmd0JCZ0JBTGZ3QkJnSUFFQzM4QVFZQ1FCQXQvQUVHQUFRdC9BRUdBa1FRTGZ3QkJnTGdCQzM4QVFZREpCUXQvQUVHQTJBVUxmd0JCZ0tFTEMzOEFRWUNBREF0L0FFR0FvUmNMZndCQmdJQUpDMzhBUVlDaElBdC9BRUdBK0FBTGZ3QkJnSkFFQzM4QVFZQ0pIUXQvQUVHQW1TRUxmd0JCZ0lBSUMzOEFRWUNaS1F0L0FFR0FnQWdMZndCQmdKa3hDMzhBUVlDQUNBdC9BRUdBbVRrTGZ3QkJnSUFJQzM4QVFZQ1p3UUFMZndCQmdJQUlDMzhBUVlDWnlRQUxmd0JCZ0lBSUMzOEFRWUNaMFFBTGZ3QkJnQlFMZndCQmdLM1JBQXQvQUVHQWlQZ0RDMzhBUVlDMXlRUUxmd0JCLy84REMzOEFRUUFMZndCQmdMWE5CQXQvQUVHVUFRdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVg4TGZ3RkJmd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCL3dBTGZ3RkIvd0FMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVg4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVHZ0NRdC9BVUVBQ3dmbUVHVUdiV1Z0YjNKNUFnQUhYMTloYkd4dll3QUlDRjlmY21WMFlXbHVBQWtKWDE5eVpXeGxZWE5sQUFvSlgxOWpiMnhzWldOMEFJMEJDMTlmY25SMGFWOWlZWE5sQTVZQ0JtTnZibVpwWndBU0RtaGhjME52Y21WVGRHRnlkR1ZrQUJNSmMyRjJaVk4wWVhSbEFCWUpiRzloWkZOMFlYUmxBQndGYVhOSFFrTUFIUkpuWlhSVGRHVndjMUJsY2xOMFpYQlRaWFFBSGd0blpYUlRkR1Z3VTJWMGN3QWZDR2RsZEZOMFpYQnpBQ0FWWlhobFkzVjBaVTExYkhScGNHeGxSbkpoYldWekFHd01aWGhsWTNWMFpVWnlZVzFsQUdzWlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYndDUEFSVmxlR1ZqZFhSbFZXNTBhV3hEYjI1a2FYUnBiMjRBa0FFTFpYaGxZM1YwWlZOMFpYQUFhQlJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFCdERHZGxkRU41WTJ4bFUyVjBjd0J1Q1dkbGRFTjVZMnhsY3dCdkRuTmxkRXB2ZVhCaFpGTjBZWFJsQUhFZloyVjBUblZ0WW1WeVQyWlRZVzF3YkdWelNXNUJkV1JwYjBKMVptWmxjZ0JwRUdOc1pXRnlRWFZrYVc5Q2RXWm1aWElBR0J4elpYUk5ZVzUxWVd4RGIyeHZjbWw2WVhScGIyNVFZV3hsZEhSbEFBMFhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0RExoTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeThTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXpBZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd0lhUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQXhaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd1FTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdVZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREREJ4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3MFNWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd1lPVmtsRVJVOWZVa0ZOWDFOSldrVURCeEZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01JRFZkUFVrdGZVa0ZOWDFOSldrVURDU1pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNS0lrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVREN4aEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0REdoUkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1iRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F3NFFSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTVBHRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTVFGRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXhFT1JsSkJUVVZmVEU5RFFWUkpUMDRERWdwR1VrRk5SVjlUU1ZwRkF4TVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REZCTkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeFVTVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhZT1ZFbE1SVjlFUVZSQlgxTkpXa1VERnhKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REdBNVBRVTFmVkVsTVJWTmZVMGxhUlFNWkZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01rRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXlVWlEwaEJUazVGVEY4eFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNY0ZVTklRVTVPUlV4Zk1WOUNWVVpHUlZKZlUwbGFSUU1kR1VOSVFVNU9SVXhmTWw5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESGhWRFNFRk9Ua1ZNWHpKZlFsVkdSa1ZTWDFOSldrVURIeGxEU0VGT1RrVk1Yek5mUWxWR1JrVlNYMHhQUTBGVVNVOU9BeUFWUTBoQlRrNUZURjh6WDBKVlJrWkZVbDlUU1ZwRkF5RVpRMGhCVGs1RlRGODBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWlGVU5JUVU1T1JVeGZORjlDVlVaR1JWSmZVMGxhUlFNakZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRESmhKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVREp4RkNUMDlVWDFKUFRWOU1UME5CVkVsUFRnTW9EVUpQVDFSZlVrOU5YMU5KV2tVREtSWkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXlvU1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5c2RSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRETEJsRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOVRTVnBGQXkwaFoyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQUFzYmMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFISWRjbVZ6WlhSUWNtOW5jbUZ0UTI5MWJuUmxja0p5WldGcmNHOXBiblFBY3hselpYUlNaV0ZrUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUhRYmNtVnpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFIVWFjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUFkaHh5WlhObGRGZHlhWFJsUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUhjTVoyVjBVbVZuYVhOMFpYSkJBSGdNWjJWMFVtVm5hWE4wWlhKQ0FIa01aMlYwVW1WbmFYTjBaWEpEQUhvTVoyVjBVbVZuYVhOMFpYSkVBSHNNWjJWMFVtVm5hWE4wWlhKRkFId01aMlYwVW1WbmFYTjBaWEpJQUgwTVoyVjBVbVZuYVhOMFpYSk1BSDRNWjJWMFVtVm5hWE4wWlhKR0FIOFJaMlYwVUhKdlozSmhiVU52ZFc1MFpYSUFnQUVQWjJWMFUzUmhZMnRRYjJsdWRHVnlBSUVCR1dkbGRFOXdZMjlrWlVGMFVISnZaM0poYlVOdmRXNTBaWElBZ2dFRloyVjBURmtBZ3dFZFpISmhkMEpoWTJ0bmNtOTFibVJOWVhCVWIxZGhjMjFOWlcxdmNua0FoQUVZWkhKaGQxUnBiR1ZFWVhSaFZHOVhZWE50VFdWdGIzSjVBSVVCRTJSeVlYZFBZVzFVYjFkaGMyMU5aVzF2Y25rQWhnRUdaMlYwUkVsV0FJY0JCMmRsZEZSSlRVRUFpQUVHWjJWMFZFMUJBSWtCQm1kbGRGUkJRd0NLQVJOMWNHUmhkR1ZFWldKMVowZENUV1Z0YjNKNUFJc0JGRjlmYzJWMFFYSm5kVzFsYm5SelRHVnVaM1JvQUpFQkNBS01BUXFTdkFLUkFaVUNBUVIvSUFFb0FnQWlBa0VCY1VVRVFFRUFRWkFJUVpVQ1FRNFFBQUFMSUFKQmZIRWlBa0h3Ly8vL0EwbEJBQ0FDUVJCUEcwVUVRRUVBUVpBSVFaY0NRUTRRQUFBTElBSkJnQUpKQkVBZ0FrRUVkaUVDQlNBQ1FSOGdBbWRySWdOQkJHdDJRUkJ6SVFJZ0EwRUhheUVEQ3lBQ1FSQkpRUUFnQTBFWFNSdEZCRUJCQUVHUUNFR2tBa0VPRUFBQUN5QUJLQUlVSVFRZ0FTZ0NFQ0lGQkVBZ0JTQUVOZ0lVQ3lBRUJFQWdCQ0FGTmdJUUN5QUJJQUFnQWlBRFFRUjBha0VDZEdvb0FtQkdCRUFnQUNBQ0lBTkJCSFJxUVFKMGFpQUVOZ0pnSUFSRkJFQWdBQ0FEUVFKMGFpSUVLQUlFUVg0Z0FuZHhJUUVnQkNBQk5nSUVJQUZGQkVBZ0FDQUFLQUlBUVg0Z0EzZHhOZ0lBQ3dzTEMvOERBUWQvSUFGRkJFQkJBRUdRQ0VITkFVRU9FQUFBQ3lBQktBSUFJZ1JCQVhGRkJFQkJBRUdRQ0VIUEFVRU9FQUFBQ3lBQlFSQnFJQUVvQWdCQmZIRnFJZ1VvQWdBaUFrRUJjUVJBSUFSQmZIRkJFR29nQWtGOGNXb2lBMEh3Ly8vL0Ewa0VRQUovSUFBZ0JSQUJJQUVnQXlBRVFRTnhjaUlFTmdJQUlBRkJFR29nQVNnQ0FFRjhjV29pQlNnQ0FBc2hBZ3NMSUFSQkFuRUVRQUovSUFGQkJHc29BZ0FpQXlnQ0FDSUhRUUZ4UlFSQVFRQkJrQWhCNUFGQkVCQUFBQXNnQjBGOGNVRVFhaUFFUVh4eGFpSUlRZkQvLy84RFNRUi9JQUFnQXhBQklBTWdDQ0FIUVFOeGNpSUVOZ0lBSUFNRklBRUxDeUVCQ3lBRklBSkJBbkkyQWdBZ0JFRjhjU0lEUWZELy8vOERTVUVBSUFOQkVFOGJSUVJBUVFCQmtBaEI4d0ZCRGhBQUFBc2dCU0FESUFGQkVHcHFSd1JBUVFCQmtBaEI5QUZCRGhBQUFBc2dCVUVFYXlBQk5nSUFJQU5CZ0FKSkJFQWdBMEVFZGlFREJTQURRUjhnQTJkcklnUkJCR3QyUVJCeklRTWdCRUVIYXlFR0N5QURRUkJKUVFBZ0JrRVhTUnRGQkVCQkFFR1FDRUdFQWtFT0VBQUFDeUFBSUFNZ0JrRUVkR3BCQW5ScUtBSmdJUVFnQVVFQU5nSVFJQUVnQkRZQ0ZDQUVCRUFnQkNBQk5nSVFDeUFBSUFNZ0JrRUVkR3BCQW5ScUlBRTJBbUFnQUNBQUtBSUFRUUVnQm5SeU5nSUFJQUFnQmtFQ2RHb2lBQ0FBS0FJRVFRRWdBM1J5TmdJRUM5RUJBUUovSUFKQkQzRkZRUUFnQVVFUGNVVkJBQ0FCSUFKTkd4dEZCRUJCQUVHUUNFR0NBMEVGRUFBQUN5QUFLQUtnRENJREJFQWdBU0FEUVJCcVNRUkFRUUJCa0FoQmpBTkJFQkFBQUFzZ0F5QUJRUkJyUmdSQUFuOGdBeWdDQUNFRUlBRkJFR3NMSVFFTEJTQUJJQUJCcEF4cVNRUkFRUUJCa0FoQm1BTkJCUkFBQUFzTElBSWdBV3NpQWtFd1NRUkFEd3NnQVNBRVFRSnhJQUpCSUd0QkFYSnlOZ0lBSUFGQkFEWUNFQ0FCUVFBMkFoUWdBU0FDYWtFUWF5SUNRUUkyQWdBZ0FDQUNOZ0tnRENBQUlBRVFBZ3VlQVFFRGZ5TUFJZ0pGQkVCQkFUOEFJZ0JLQkg5QkFTQUFhMEFBUVFCSUJVRUFDd1JBQUF0QndBa2hBa0hBQ1VFQU5nSUFRZUFWUVFBMkFnQURRQ0FCUVJkSkJFQWdBVUVDZEVIQUNXcEJBRFlDQkVFQUlRQURRQ0FBUVJCSkJFQWdBQ0FCUVFSMGFrRUNkRUhBQ1dwQkFEWUNZQ0FBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3d0QndBbEI4QlUvQUVFUWRCQURRY0FKSkFBTElBSUwzd0VCQVg4Z0FVR0FBa2tFUUNBQlFRUjJJUUVGQW44Z0FVSDQvLy8vQVVrRVFDQUJRUUZCR3lBQloydDBha0VCYXlFQkN5QUJDMEVmSUFGbmF5SUNRUVJyZGtFUWN5RUJJQUpCQjJzaEFnc2dBVUVRU1VFQUlBSkJGMGtiUlFSQVFRQkJrQWhCMGdKQkRoQUFBQXNnQUNBQ1FRSjBhaWdDQkVGL0lBRjBjU0lCQkg4Z0FDQUJhQ0FDUVFSMGFrRUNkR29vQW1BRklBQW9BZ0JCZnlBQ1FRRnFkSEVpQVFSL0lBQWdBV2dpQVVFQ2RHb29BZ1FpQWtVRVFFRUFRWkFJUWQ4Q1FSSVFBQUFMSUFBZ0FtZ2dBVUVFZEdwQkFuUnFLQUpnQlVFQUN3c0xod0VCQW44Z0FTZ0NBQ0VESUFKQkQzRUVRRUVBUVpBSVFlMENRUTRRQUFBTElBTkJmSEVnQW1zaUJFRWdUd1JBSUFFZ0FpQURRUUp4Y2pZQ0FDQUNJQUZCRUdwcUlnRWdCRUVRYTBFQmNqWUNBQ0FBSUFFUUFnVWdBU0FEUVg1eE5nSUFJQUZCRUdvaUFDQUJLQUlBUVh4eGFpQUFJQUVvQWdCQmZIRnFLQUlBUVgxeE5nSUFDd3VxQWdFRGZ5TUJCRUJCQUVHUUNFSDBBMEVPRUFBQUN5QUJJZ05COFAvLy93TlBCRUJCd0FoQmtBaEJ6UU5CSGhBQUFBc2dBQ0FEUVE5cVFYQnhJZ0ZCRUNBQlFSQkxHeUlCRUFVaUJFVUVRRUVCSkFGQkFDUUJJQUFnQVJBRklnUkZCRUFnQVVINC8vLy9BVWtFZnlBQlFRRkJHeUFCWjJ0MFFRRnJhZ1VnQVF0QkVEOEFJZ1JCRUhSQkVHc2dBQ2dDb0F4SGRHcEIvLzhEYWtHQWdIeHhRUkIySVFVZ0JDQUZJQVFnQlVvYlFBQkJBRWdFUUNBRlFBQkJBRWdFUUFBTEN5QUFJQVJCRUhRL0FFRVFkQkFESUFBZ0FSQUZJZ1JGQkVCQkFFR1FDRUdBQkVFVUVBQUFDd3NMSUFRb0FnQkJmSEVnQVVrRVFFRUFRWkFJUVlnRVFRNFFBQUFMSUFSQkFEWUNCQ0FFSUFJMkFnZ2dCQ0FETmdJTUlBQWdCQkFCSUFBZ0JDQUJFQVlnQkFzTkFCQUVJQUFnQVJBSFFSQnFDMkVCQW44Z0FFRzhDVXNFUUNBQVFSQnJJZ0VvQWdRaUFrR0FnSUNBZjNFZ0FrRUJha0dBZ0lDQWYzRkhCRUJCQUVHQUNVSHRBRUVERUFBQUN5QUJJQUpCQVdvMkFnUWdBU2dDQUVFQmNRUkFRUUJCZ0FsQjhBQkJEaEFBQUFzTElBQUxFd0FnQUVHOENVc0VRQ0FBUVJCckVJNEJDd3VQQWdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUXgxRGc0QUFRRUJBZ0lDQWdNREJBUUZCZ2NMSS8wQkJFQWovZ0VFUUNBQVFZQUNTQTBKSUFCQmdCSklRUUFnQUVIL0Ewb2JEUWtGUVFBZ0FFR0FBa2dqL2dFYkRRa0xDd3NnQUVHQXJkRUFhZzhMSUFCQmdJQUJheUVCSUFGQkFDUHZBU0lBUlNQM0FSc0VmMEVCQlNBQUMwRU9kR3BCZ0szUkFHb1BDeUFBUVlDUWZtb2ovZ0VFZjBIUC9nTVFDeTBBQUVFQmNRVkJBQXRCRFhScUR3c2dBQ1B3QVVFTmRHcEJnTm5HQUdvUEN5QUFRWUNRZm1vUEN5QUFRUUVqL2dFRWYwSHcvZ01RQ3kwQUFFRUhjUVZCQUFzaUFTQUJRUUZKRzBFTWRHcEJnUEI5YWc4TElBQkJnRkJxRHdzZ0FFR0FtZEVBYWd2REFRQkJBQ1QvQVVFQUpJQUNRUUFrZ1FKQkFDU0NBa0VBSklNQ1FRQWtoQUpCQUNTRkFrRUFKSVlDUVFBa2h3SkJBQ1NJQWtFQUpJa0NRUUFraWdKQkFDU0xBa0VBSkl3Q1FRQWtqUUpCQUNTT0FpUDlBUVJBRHdzai9nRUVRRUVSSklBQ1FZQUJKSWNDUVFBa2dRSkJBQ1NDQWtIL0FTU0RBa0hXQUNTRUFrRUFKSVVDUVEwa2hnSUZRUUVrZ0FKQnNBRWtod0pCQUNTQkFrRVRKSUlDUVFBa2d3SkIyQUVraEFKQkFTU0ZBa0hOQUNTR0FndEJnQUlraVFKQi92OERKSWdDQzZFSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQTROQUFFQ0F3UUZCZ2NJQ1FvTERBMExRZkxseXdja08wR2d3WUlGSkR4QjJMRGhBaVE5UVlpUUlDUStRZkxseXdja1AwR2d3WUlGSkVCQjJMRGhBaVJCUVlpUUlDUkNRZkxseXdja1EwR2d3WUlGSkVSQjJMRGhBaVJGUVlpUUlDUkdEQXdMUWYvLy93Y2tPMEhqMnY0SEpEeEJnT0tRQkNROVFRQWtQa0gvLy84SEpEOUI0OXIrQnlSQVFZRGlrQVFrUVVFQUpFSkIvLy8vQnlSRFFlUGEvZ2NrUkVHQTRwQUVKRVZCQUNSR0RBc0xRZi8vL3dja08wR0VpZjRISkR4QnV2VFFCQ1E5UVFBa1BrSC8vLzhISkQ5QnNmN3ZBeVJBUVlDSUFpUkJRUUFrUWtILy8vOEhKRU5CLzh1T0F5UkVRZjhCSkVWQkFDUkdEQW9MUWNYTi93Y2tPMEdFdWJvR0pEeEJxZGFSQkNROVFZamk2QUlrUGtILy8vOEhKRDlCNDlyK0J5UkFRWURpa0FRa1FVRUFKRUpCLy8vL0J5UkRRZVBhL2dja1JFR0E0cEFFSkVWQkFDUkdEQWtMUWYvLy93Y2tPMEdBL3NzQ0pEeEJnSVQ5QnlROVFRQWtQa0gvLy84SEpEOUJnUDdMQWlSQVFZQ0UvUWNrUVVFQUpFSkIvLy8vQnlSRFFZRCt5d0lrUkVHQWhQMEhKRVZCQUNSR0RBZ0xRZi8vL3dja08wR3gvdThESkR4QnhjY0JKRDFCQUNRK1FmLy8vd2NrUDBHRWlmNEhKRUJCdXZUUUJDUkJRUUFrUWtILy8vOEhKRU5CaEluK0J5UkVRYnIwMEFRa1JVRUFKRVlNQnd0QkFDUTdRWVNKQWlROFFZQzgvd2NrUFVILy8vOEhKRDVCQUNRL1FZU0pBaVJBUVlDOC93Y2tRVUgvLy84SEpFSkJBQ1JEUVlTSkFpUkVRWUM4L3dja1JVSC8vLzhISkVZTUJndEJwZi8vQnlRN1FaU3AvZ2NrUEVIL3FkSUVKRDFCQUNRK1FhWC8vd2NrUDBHVXFmNEhKRUJCLzZuU0JDUkJRUUFrUWtHbC8vOEhKRU5CbEtuK0J5UkVRZitwMGdRa1JVRUFKRVlNQlF0Qi8vLy9CeVE3UVlEKy93Y2tQRUdBZ1B3SEpEMUJBQ1ErUWYvLy93Y2tQMEdBL3Y4SEpFQkJnSUQ4QnlSQlFRQWtRa0gvLy84SEpFTkJnUDcvQnlSRVFZQ0EvQWNrUlVFQUpFWU1CQXRCLy8vL0J5UTdRWUQrL3dja1BFR0FsTzBESkQxQkFDUStRZi8vL3dja1AwSC95NDRESkVCQi93RWtRVUVBSkVKQi8vLy9CeVJEUWJIKzd3TWtSRUdBaUFJa1JVRUFKRVlNQXd0Qi8vLy9CeVE3UWYvTGpnTWtQRUgvQVNROVFRQWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSkIvLy8vQnlSRFFiSCs3d01rUkVHQWlBSWtSVUVBSkVZTUFndEIvLy8vQnlRN1FkNlpzZ1FrUEVHTXBja0NKRDFCQUNRK1FmLy8vd2NrUDBHRWlmNEhKRUJCdXZUUUJDUkJRUUFrUWtILy8vOEhKRU5CNDlyK0J5UkVRWURpa0FRa1JVRUFKRVlNQVF0Qi8vLy9CeVE3UWFYTGxnVWtQRUhTcE1rQ0pEMUJBQ1ErUWYvLy93Y2tQMEdseTVZRkpFQkIwcVRKQWlSQlFRQWtRa0gvLy84SEpFTkJwY3VXQlNSRVFkS2t5UUlrUlVFQUpFWUxDOW9JQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVlnQlJ3UkFJQUJCNFFCR0RRRWdBRUVVUmcwQ0lBQkJ4Z0JHRFFNZ0FFSFpBRVlOQkNBQVFjWUJSZzBFSUFCQmhnRkdEUVVnQUVHb0FVWU5CU0FBUWI4QlJnMEdJQUJCemdGR0RRWWdBRUhSQVVZTkJpQUFRZkFCUmcwR0lBQkJKMFlOQnlBQVFja0FSZzBISUFCQjNBQkdEUWNnQUVHekFVWU5CeUFBUWNrQlJnMElJQUJCOEFCR0RRa2dBRUhHQUVZTkNpQUFRZE1CUmcwTERBd0xRZis1bGdVa08wR0EvdjhISkR4QmdNWUJKRDFCQUNRK1FmKzVsZ1VrUDBHQS92OEhKRUJCZ01ZQkpFRkJBQ1JDUWYrNWxnVWtRMEdBL3Y4SEpFUkJnTVlCSkVWQkFDUkdEQXNMUWYvLy93Y2tPMEgveTQ0REpEeEIvd0VrUFVFQUpENUIvLy8vQnlRL1FZU0ovZ2NrUUVHNjlOQUVKRUZCQUNSQ1FmLy8vd2NrUTBIL3k0NERKRVJCL3dFa1JVRUFKRVlNQ2d0Qi8vLy9CeVE3UVlTSi9nY2tQRUc2OU5BRUpEMUJBQ1ErUWYvLy93Y2tQMEd4L3U4REpFQkJnSWdDSkVGQkFDUkNRZi8vL3dja1EwR0VpZjRISkVSQnV2VFFCQ1JGUVFBa1Jnd0pDMEgvNjlZRkpEdEJsUC8vQnlROFFjSzB0UVVrUFVFQUpENUJBQ1EvUWYvLy93Y2tRRUdFaWY0SEpFRkJ1dlRRQkNSQ1FRQWtRMEgvLy84SEpFUkJoSW4rQnlSRlFicjAwQVFrUmd3SUMwSC8vLzhISkR0QmhOdTJCU1E4UWZ2bWlRSWtQVUVBSkQ1Qi8vLy9CeVEvUVlEbS9RY2tRRUdBaE5FRUpFRkJBQ1JDUWYvLy93Y2tRMEgvKytvQ0pFUkJnSUQ4QnlSRlFmOEJKRVlNQnd0Qm5QLy9CeVE3UWYvcjBnUWtQRUh6cUk0REpEMUJ1dlFBSkQ1Qndvci9CeVEvUVlDcy93Y2tRRUdBOU5BRUpFRkJnSUNvQWlSQ1FmLy8vd2NrUTBHRWlmNEhKRVJCdXZUUUJDUkZRUUFrUmd3R0MwR0EvcThESkR0Qi8vLy9CeVE4UWNxay9RY2tQVUVBSkQ1Qi8vLy9CeVEvUWYvLy93Y2tRRUgveTQ0REpFRkIvd0VrUWtILy8vOEhKRU5CNDlyK0J5UkVRWURpa0FRa1JVRUFKRVlNQlF0Qi83bVdCU1E3UVlEKy93Y2tQRUdBeGdFa1BVRUFKRDVCMHNiOUJ5US9RWUNBMkFZa1FFR0FnSXdESkVGQkFDUkNRZjhCSkVOQi8vLy9CeVJFUWZ2Ky93Y2tSVUgvaVFJa1Jnd0VDMEhPLy84SEpEdEI3OStQQXlROFFiR0k4Z1FrUFVIYXRPa0NKRDVCLy8vL0J5US9RWURtL1Fja1FFR0FoTkVFSkVGQkFDUkNRZi8vL3dja1EwSC95NDRESkVSQi93RWtSVUVBSkVZTUF3dEIvLy8vQnlRN1FZU0ovZ2NrUEVHNjlOQUVKRDFCQUNRK1FmLy8vd2NrUDBHQS9nTWtRRUdBaU1ZQkpFRkJnSlFCSkVKQi8vLy9CeVJEUWYvTGpnTWtSRUgvQVNSRlFRQWtSZ3dDQzBILy8vOEhKRHRCLzh1T0F5UThRZjhCSkQxQkFDUStRWUQrL3dja1AwR0FnUHdISkVCQmdJQ01BeVJCUVFBa1FrSC8vLzhISkVOQnNmN3ZBeVJFUVlDSUFpUkZRUUFrUmd3QkMwSC8vLzhISkR0QmhOdTJCU1E4UWZ2bWlRSWtQVUVBSkQ1Qi8vLy9CeVEvUWVQYS9nY2tRRUhqMnY0SEpFRkJBQ1JDUWYvLy93Y2tRMEgveTQ0REpFUkIvd0VrUlVFQUpFWUxDOUVDQVFKL1FRQWs2QUZCQUNUcEFVRUFKT29CUVFBazZ3RkJBQ1RzQVVFQUpPMEJRUUFrN2dGQmtBRWs2Z0VqL2dFRVFFSEIvZ01RQzBHQkFUb0FBRUhFL2dNUUMwR1FBVG9BQUVISC9nTVFDMEg4QVRvQUFBVkJ3ZjRERUF0QmhRRTZBQUJCeHY0REVBdEIvd0U2QUFCQngvNERFQXRCL0FFNkFBQkJ5UDRERUF0Qi93RTZBQUJCeWY0REVBdEIvd0U2QUFBTFFaQUJKT29CUWNEK0F4QUxRWkFCT2dBQVFjLytBeEFMUVFBNkFBQkI4UDRERUF0QkFUb0FBQ1A5QVFSQUkvNEJCRUJCQUNUcUFVSEEvZ01RQzBFQU9nQUFRY0grQXhBTFFZQUJPZ0FBUWNUK0F4QUxRUUE2QUFBRlFRQWs2Z0ZCd1A0REVBdEJBRG9BQUVIQi9nTVFDMEdFQVRvQUFBc0xRUUFRRFFKQUkvNEJEUUJCQUNQOUFTUCtBUnNOQUVHMEFpRUFBMEFnQUVIREFrd0VRQ0FCSUFBUUN5MEFBR29oQVNBQVFRRnFJUUFNQVFzTElBRkIvd0Z4RUE0TEMvRUVBRUVBSktRQlFRQWtwUUZCQUNTbUFVRUJKS2NCUVFFa3FBRkJBU1NwQVVFQkpLb0JRUUVrcXdGQkFTU3NBVUVCSkswQlFRRWtyZ0ZCQVNTdkFVRUFKTEFCUVFBa3NnRkJBQ1N4QVVFQUpMTUJRWkQrQXhBTFFZQUJPZ0FBUVpIK0F4QUxRYjhCT2dBQVFaTCtBeEFMUWZNQk9nQUFRWlArQXhBTFFjRUJPZ0FBUVpUK0F4QUxRYjhCT2dBQUkvMEJCRUJCa2Y0REVBdEJQem9BQUVHUy9nTVFDMEVBT2dBQVFaUCtBeEFMUVFBNkFBQkJsUDRERUF0QnVBRTZBQUFMUVpYK0F4QUxRZjhCT2dBQVFaYitBeEFMUVQ4NkFBQkJsLzRERUF0QkFEb0FBRUdZL2dNUUMwRUFPZ0FBUVpuK0F4QUxRYmdCT2dBQVFacitBeEFMUWY4QU9nQUFRWnYrQXhBTFFmOEJPZ0FBUVp6K0F4QUxRWjhCT2dBQVFaMytBeEFMUVFBNkFBQkJudjRERUF0QnVBRTZBQUJCQVNTREFVR2YvZ01RQzBIL0FUb0FBRUdnL2dNUUMwSC9BVG9BQUVHaC9nTVFDMEVBT2dBQVFhTCtBeEFMUVFBNkFBQkJvLzRERUF0QnZ3RTZBQUJCcFA0REVBdEI5d0E2QUFCQkJ5U2xBVUVISktZQlFhWCtBeEFMUWZNQk9nQUFRUUVrcWdGQkFTU3BBVUVCSktnQlFRRWtwd0ZCQUNTdUFVRUFKSzBCUVFFa3JBRkJBU1NyQVVHbS9nTVFDMEh4QVRvQUFFRUJKSzhCSS8wQkJFQkJwUDRERUF0QkFEb0FBRUVBSktVQlFRQWtwZ0ZCcGY0REVBdEJBRG9BQUVFQUpLb0JRUUFrcVFGQkFDU29BVUVBSktjQlFRQWtyZ0ZCQUNTdEFVRUFKS3dCUVFBa3F3RkJwdjRERUF0QjhBQTZBQUJCQUNTdkFRdEJEeVNYQVVFUEpKZ0JRUThrbVFGQkR5U2FBVUVBSkpzQlFRQWtuQUZCQUNTZEFVRUFKSjRCUWY4QUpKOEJRZjhBSktBQlFRRWtvUUZCQVNTaUFVRUFKS01CQzlRR0FRRi9RY01DRUFzdEFBQWlBRUhBQVVZRWYwRUJCU0FBUVlBQlJrRUFJekliQ3dSQVFRRWsvZ0VGUVFBay9nRUxRUUFrbFFKQmdLald1UWNrandKQkFDU1FBa0VBSkpFQ1FZQ28xcmtISkpJQ1FRQWtrd0pCQUNTVUFpTXhCRUJCQVNUOUFRVkJBQ1Q5QVFzUURFRUFKUEVCUVFFazhnRkJ4d0lRQ3kwQUFDSUFSU1R6QVNBQVFRTk5RUUFnQUVFQlR4c2s5QUVnQUVFR1RVRUFJQUJCQlU4YkpQVUJJQUJCRTAxQkFDQUFRUTlQR3lUMkFTQUFRUjVOUVFBZ0FFRVpUeHNrOXdGQkFTVHZBVUVBSlBBQlFjLytBeEFMUVFBNkFBQkI4UDRERUF0QkFUb0FBRUhSL2dNUUMwSC9BVG9BQUVIUy9nTVFDMEgvQVRvQUFFSFQvZ01RQzBIL0FUb0FBRUhVL2dNUUMwSC9BVG9BQUVIVi9nTVFDMEgvQVRvQUFCQVBJLzRCQkVCQjZQNERFQXRCd0FFNkFBQkI2ZjRERUF0Qi93RTZBQUJCNnY0REVBdEJ3UUU2QUFCQjYvNERFQXRCRFRvQUFBVkI2UDRERUF0Qi93RTZBQUJCNmY0REVBdEIvd0U2QUFCQjZ2NERFQXRCL3dFNkFBQkI2LzRERUF0Qi93RTZBQUFMSS80QlFRQWovUUViQkVCQjZmNERFQXRCSURvQUFFSHIvZ01RQzBHS0FUb0FBQXNRRUVFQUpMY0JRUUFrdUFGQkFDUzVBVUVBSkxvQlFRQWt1d0ZCQUNTMkFVSC8vd01RQzBFQU9nQUFRUUVrdlFGQkFDUytBVUVBSkw4QlFRQWt3QUZCQUNUQkFVSGhBU1M4QVVHUC9nTVFDMEhoQVRvQUFFRUFKTUlCUVFBa3d3RkJBQ1RFQVVFQUpNZ0JRUUFreVFGQkFDVEtBVUVBSk1VQlFRQWt4Z0VqL2dFRVFFR0UvZ01RQzBFZU9nQUFRYUE5Sk1NQkJVR0UvZ01RQzBHckFUb0FBRUhNMXdJa3d3RUxRWWYrQXhBTFFmZ0JPZ0FBUWZnQkpNb0JJLzBCQkVBai9nRkZCRUJCaFA0REVBdEJBRG9BQUVFRUpNTUJDd3RCQUNUTEFVRUFKTXdCSS80QkJFQkJndjRERUF0Qi9BQTZBQUJCQUNUTkFRVkJndjRERUF0Qi9nQTZBQUJCQVNUTkFRdEJBQ1RPQVNQK0FRUkFRZkQrQXhBTFFmZ0JPZ0FBUWMvK0F4QUxRZjRCT2dBQVFjMytBeEFMUWY0QU9nQUFRWUQrQXhBTFFjOEJPZ0FBUVkvK0F4QUxRZUVCT2dBQVFleitBeEFMUWY0Qk9nQUFRZlgrQXhBTFFZOEJPZ0FBQlVIdy9nTVFDMEgvQVRvQUFFSFAvZ01RQzBIL0FUb0FBRUhOL2dNUUMwSC9BVG9BQUVHQS9nTVFDMEhQQVRvQUFFR1AvZ01RQzBIaEFUb0FBQXNMU2dBZ0FFRUFTaVF4SUFGQkFFb2tNaUFDUVFCS0pETWdBMEVBU2lRMElBUkJBRW9rTlNBRlFRQktKRFlnQmtFQVNpUTNJQWRCQUVva09DQUlRUUJLSkRrZ0NVRUFTaVE2RUJFTEJRQWpsUUlMbVFJQVFhd0tJNlVCTmdJQVFiQUtJNllCTmdJQVFiUUtJNmNCUVFCSE9nQUFRYlVLSTZnQlFRQkhPZ0FBUWJZS0k2a0JRUUJIT2dBQVFiY0tJNm9CUVFCSE9nQUFRYmdLSTZzQlFRQkhPZ0FBUWJrS0k2d0JRUUJIT2dBQVFib0tJNjBCUVFCSE9nQUFRYnNLSTY0QlFRQkhPZ0FBUWJ3S0k2OEJRUUJIT2dBQVFiMEtJN0FCTmdJQVFjSUtJN0VCT2dBQVFjTUtJN0lCT2dBQVFjUUtJNWNCT2dBQVFjVUtJNWdCT2dBQVFjWUtJNWtCT2dBQVFjY0tJNW9CT2dBQVFjZ0tJNXNCUVFCSE9nQUFRY2tLSTV3QlFRQkhPZ0FBUWNvS0k1MEJRUUJIT2dBQVFjc0tJNTRCUVFCSE9nQUFRY3dLSTU4Qk9nQUFRYzBLSTZBQk9nQUFRYzRLSTZFQlFRQkhPZ0FBUWM4S0k2SUJRUUJIT2dBQUMrb0JBRUhlQ2lOSk5nSUFRZUlLSTBvNkFBQkI0d29qUzBFQVJ6b0FBRUhrQ2lOTU9nQUFRZVVLSTAwNkFBQkI1d29qVGpzQkFFSG9DaU5QT2dBQVFla0tJMUJCQUVjNkFBQkI2Z29qVVRvQUFFSHJDaU5TT2dBQVFld0tJMU5CQUVjNkFBQkI3UW9qVkRvQUFFSHVDaU5WUVFCSE9nQUFRZThLSTFaQkFFYzZBQUJCOEFvalZ6WUNBRUgwQ2lOWU5nSUFRZmdLSTFrMkFnQkIvQW9qV2tFQVJ6b0FBRUg5Q2lOYk5nSUFRWUVMSTF3MkFnQkJoUXNqWFRvQUFFR0dDeU5lT2dBQVFZY0xJMTlCQUVjNkFBQkJpQXNqWURZQ0FFR01DeU5oT3dFQVFZOExJMkpCQUVjNkFBQUx2d2dCQVg5QmdBZ2pnQUk2QUFCQmdRZ2pnUUk2QUFCQmdnZ2pnZ0k2QUFCQmd3Z2pnd0k2QUFCQmhBZ2poQUk2QUFCQmhRZ2poUUk2QUFCQmhnZ2poZ0k2QUFCQmh3Z2pod0k2QUFCQmlBZ2ppQUk3QVFCQmlnZ2ppUUk3QVFCQmpBZ2ppZ0kyQWdCQmtRZ2ppd0pCQUVjNkFBQkJrZ2dqakFKQkFFYzZBQUJCa3dnampRSkJBRWM2QUFCQmxBZ2pqZ0pCQUVjNkFBQkJsUWdqL1FGQkFFYzZBQUJCbGdnai9nRkJBRWM2QUFCQmx3Z2ovd0ZCQUVjNkFBQkJzZ2dqNlFFMkFnQWo2Z0VoQUVIRS9nTVFDeUFBT2dBQVFiWUlJOTRCT2dBQVFiY0lJOThCT2dBQVFiZ0lJK0FCUVFCSE9nQUFRYmtJSStFQlFRQkhPZ0FBUWJvSUkrSUJRUUJIT2dBQVFic0lJK01CUVFCSE9nQUFRYndJSStRQlFRQkhPZ0FBUWIwSUkrVUJRUUJIT2dBQVFiNElJK1lCUVFCSE9nQUFRYjhJSStjQlFRQkhPZ0FBUWVRSUk3UUJRUUJIT2dBQVFlVUlJN1VCUVFCSE9nQUFRY2dKSSs4Qk93RUFRY29KSS9BQk93RUFRY3dKSS9FQlFRQkhPZ0FBUWMwSkkvSUJRUUJIT2dBQVFjNEpJL01CUVFCSE9nQUFRYzhKSS9RQlFRQkhPZ0FBUWRBSkkvVUJRUUJIT2dBQVFkRUpJL1lCUVFCSE9nQUFRZElKSS9jQlFRQkhPZ0FBUWRNSkkvZ0JOZ0lBUWRjSkkva0JRUUJIT2dBQVFkZ0pJL29CTmdJQVFkd0pJL3NCTmdJQVFlQUpJL3dCTmdJQVFmb0pJOElCTmdJQVFmNEpJOE1CTmdJQVFZSUtJOFFCSWdBMkFnQkJoZ29qeFFGQkFFYzZBQUJCaHdvanhnRkJBRWM2QUFCQmlBb2p4d0UyQWdCQmpBb2p5QUUyQWdCQmtBb2p5UUZCQUVjNkFBQkJrUW9qeWdFMkFnQkJoZjRERUFzZ0FEb0FBQkFVRUJWQmtBc2pZellDQUVHWEN5TmtPZ0FBUVpnTEkyVTdBUUJCbWdzalpqb0FBRUdiQ3lOblFRQkhPZ0FBUVp3TEkyZzZBQUJCblFzamFUb0FBRUdlQ3lOcVFRQkhPZ0FBUVo4TEkyczZBQUJCb0FzamJFRUFSem9BQUVHaEN5TnRRUUJIT2dBQVFhSUxJMjQyQWdCQnBnc2piellDQUVHcUN5TndOZ0lBUWE0TEkzRkJBRWM2QUFCQnJ3c2pjallDQUVHekN5TnpOZ0lBUWJjTEkzUTZBQUJCdUFzamRUb0FBRUhDQ3lOMk5nSUFRY29MSTNjN0FRQkJ6QXNqZURvQUFFSE9DeU41T2dBQVFjOExJM3BCQUVjNkFBQkIwQXNqZXpvQUFFSFJDeU44UVFCSE9nQUFRZElMSTMxQkFFYzZBQUJCMHdzamZqWUNBRUhYQ3lOL05nSUFRZHNMSTRBQk5nSUFRZU1MSTRFQk5nSUFRZWNMSTRJQk9nQUFRZWdMSTRNQlFRQkhPZ0FBUWVrTEk0UUJOZ0lBUWZRTEk0VUJOZ0lBUWZnTEk0WUJPd0VBUWZvTEk0Y0JPZ0FBUWZzTEk0Z0JRUUJIT2dBQVFmd0xJNGtCT2dBQVFmMExJNG9CT2dBQVFmNExJNHNCUVFCSE9nQUFRZjhMSTR3Qk9nQUFRWUVNSTQwQlFRQkhPZ0FBUVlNTUk0NEJRUUJIT2dBQVFZUU1JNDhCUVFCSE9nQUFRWWtNSTVBQk5nSUFRWTBNSTVFQk5nSUFRWkVNSTVJQlFRQkhPZ0FBUVpJTUk1TUJOZ0lBUVpZTUk1UUJOZ0lBUVpvTUk1WUJPd0VBUVFBa2xRSUxwZ0VCQVg5QjVBZ3RBQUJCQUVza3RBRkI1UWd0QUFCQkFFc2t0UUZCLy84REVBc3RBQUFpQUVFQmNVRUFSeVMzQVNBQVFRSnhRUUJISkxnQklBQkJCSEZCQUVja3VRRWdBRUVJY1VFQVJ5UzZBU0FBUVJCeFFRQkhKTHNCSUFBa3RnRkJqLzRERUFzdEFBQWlBRUVCY1VFQVJ5UzlBU0FBUVFKeFFRQkhKTDRCSUFCQkJIRkJBRWNrdndFZ0FFRUljVUVBUnlUQUFTQUFRUkJ4UVFCSEpNRUJJQUFrdkFFTEJ3QkJBQ1N6QVF1ZUFnQkJyQW9vQWdBa3BRRkJzQW9vQWdBa3BnRkJ0QW90QUFCQkFFc2twd0ZCdFFvdEFBQkJBRXNrcUFGQnRnb3RBQUJCQUVza3FRRkJ0d290QUFCQkFFc2txZ0ZCdUFvdEFBQkJBRXNrcXdGQnVRb3RBQUJCQUVza3JBRkJ1Z290QUFCQkFFc2tyUUZCdXdvdEFBQkJBRXNrcmdGQnZBb3RBQUJCQUVza3J3RkJ2UW9vQWdBa3NBRkJ3Z290QUFBa3NRRkJ3d290QUFBa3NnRkJ4QW90QUFBa2x3RkJ4UW90QUFBa21BRkJ4Z290QUFBa21RRkJ4d290QUFBa21nRkJ5QW90QUFCQkFFc2ttd0ZCeVFvdEFBQkJBRXNrbkFGQnlnb3RBQUJCQUVza25RRkJ5d290QUFCQkFFc2tuZ0ZCekFvdEFBQWtud0ZCelFvdEFBQWtvQUZCemdvdEFBQkJBRXNrb1FGQnp3b3RBQUJCQUVza29nRkJBQ1N6QVF2d0FRQWpTVUV5YkVHQUNHb29BZ0FrU1VIaUNpMEFBQ1JLUWVNS0xRQUFRUUJMSkV0QjVBb3RBQUFrVEVIbENpMEFBQ1JOUWVjS0x3RUFKRTVCNkFvdEFBQWtUMEhwQ2kwQUFFRUFTeVJRUWVvS0xRQUFKRkZCNndvdEFBQWtVa0hzQ2kwQUFFRUFTeVJUUWUwS0xRQUFKRlJCN2dvdEFBQkJBRXNrVlVIdkNpMEFBRUVBU3lSV1FmQUtLQUlBSkZkQjlBb29BZ0FrV0VINENpZ0NBQ1JaUWZ3S0xRQUFRUUJMSkZwQi9Rb29BZ0FrVzBHQkN5Z0NBQ1JjUVlVTExRQUFKRjFCaGdzdEFBQWtYa0dIQ3kwQUFFRUFTeVJmUVlnTExRQUFKR0JCakFzdEFBQWtZVUdQQ3kwQUFFRUFTeVJpQzY4QkFDTmpRVEpzUVlBSWFpZ0NBQ1JqUVpjTExRQUFKR1JCbUFzdkFRQWtaVUdhQ3kwQUFDUm1RWnNMTFFBQVFRQkxKR2RCbkFzdEFBQWthRUdkQ3kwQUFDUnBRWjRMTFFBQVFRQkxKR3BCbndzdEFBQWthMEdnQ3kwQUFFRUFTeVJzUWFFTExRQUFRUUJMSkcxQm9nc29BZ0FrYmtHbUN5Z0NBQ1J2UWFvTEtBSUFKSEJCcmdzdEFBQkJBRXNrY1VHdkN5Z0NBQ1J5UWJNTEtBSUFKSE5CdHdzdEFBQWtkRUc0Q3kwQUFDUjFDODhIQVFGL1FZQUlMUUFBSklBQ1FZRUlMUUFBSklFQ1FZSUlMUUFBSklJQ1FZTUlMUUFBSklNQ1FZUUlMUUFBSklRQ1FZVUlMUUFBSklVQ1FZWUlMUUFBSklZQ1FZY0lMUUFBSkljQ1FZZ0lMd0VBSklnQ1FZb0lMd0VBSklrQ1FZd0lLQUlBSklvQ1FaRUlMUUFBUVFCTEpJc0NRWklJTFFBQVFRQkxKSXdDUVpNSUxRQUFRUUJMSkkwQ1FaUUlMUUFBUVFCTEpJNENRWlVJTFFBQVFRQkxKUDBCUVpZSUxRQUFRUUJMSlA0QlFaY0lMUUFBUVFCTEpQOEJRYklJS0FJQUpPa0JRY1QrQXhBTExRQUFKT29CUWJZSUxRQUFKTjRCUWJjSUxRQUFKTjhCUWJnSUxRQUFRUUJMSk9BQlFia0lMUUFBUVFCTEpPRUJRYm9JTFFBQVFRQkxKT0lCUWJzSUxRQUFRUUJMSk9NQlFid0lMUUFBUVFCTEpPUUJRYjBJTFFBQVFRQkxKT1VCUWI0SUxRQUFRUUJMSk9ZQlFiOElMUUFBUVFCTEpPY0JFQmRCZ1A0REVBc3RBQUJCL3dGekpOY0JJOWNCSWdCQkVIRkJBRWNrMkFFZ0FFRWdjVUVBUnlUWkFVSElDUzhCQUNUdkFVSEtDUzhCQUNUd0FVSE1DUzBBQUVFQVN5VHhBVUhOQ1MwQUFFRUFTeVR5QVVIT0NTMEFBRUVBU3lUekFVSFBDUzBBQUVFQVN5VDBBVUhRQ1MwQUFFRUFTeVQxQVVIUkNTMEFBRUVBU3lUMkFVSFNDUzBBQUVFQVN5VDNBVUhUQ1NnQ0FDVDRBVUhYQ1MwQUFFRUFTeVQ1QVVIWUNTZ0NBQ1Q2QVVIY0NTZ0NBQ1Q3QVVIZ0NTZ0NBQ1Q4QVVINkNTZ0NBQ1RDQVVIK0NTZ0NBQ1REQVVHQ0NpZ0NBQ1RFQVVHR0NpMEFBRUVBU3lURkFVR0hDaTBBQUVFQVN5VEdBVUdJQ2lnQ0FDVEhBVUdNQ2lnQ0FDVElBVUdRQ2kwQUFFRUFTeVRKQVVHUkNpZ0NBQ1RLQVJBWkVCb1FHeU4yUVRKc1FZQUlhaWdDQUNSMlFjb0xMd0VBSkhkQnpBc3RBQUFrZUVIT0N5MEFBQ1I1UWM4TExRQUFRUUJMSkhwQjBBc3RBQUFrZTBIUkN5MEFBRUVBU3lSOFFkSUxMUUFBUVFCTEpIMUIwd3NvQWdBa2ZrSFhDeWdDQUNSL1Fkc0xLQUlBSklBQlFlTUxLQUlBSklFQlFlY0xLQUlBSklJQlFlZ0xMUUFBUVFCTEpJTUJRZWtMS0FJQUpJUUJJNFVCUVRKc1FZQUlhaWdDQUNTRkFVSDRDeTBBQUNTR0FVSDZDeTBBQUNTSEFVSDdDeTBBQUVFQVN5U0lBVUg4Q3kwQUFDU0pBVUg5Q3kwQUFDU0tBVUgrQ3kwQUFFRUFTeVNMQVVIL0N5MEFBQ1NNQVVHQkRDMEFBRUVBU3lTTkFVR0REQzBBQUVFQVN5U09BVUdFREMwQUFFRUFTeVNQQVVHSkRDZ0NBQ1NRQVVHTkRDZ0NBQ1NSQVVHUkRDMEFBRUVBU3lTU0FVR1NEQ2dDQUNTVEFVR1dEQ2dDQUNTVUFVR2FEQzhCQUNTV0FVRUFKSlVDUVlDbzFya0hKSThDUVFBa2tBSkJBQ1NSQWtHQXFOYTVCeVNTQWtFQUpKTUNRUUFrbEFJTEJRQWovZ0VMQlFBamtnSUxCUUFqa3dJTEJRQWpsQUlMbmdJQkIzOGdBQ05JSWdkR1FRQWdCQ05IUmtFQUlBQkJDRXBCQUNBQlFRQktHeHNiQkVBZ0EwRUJheEFMTFFBQVFTQnhRUUJISVFnZ0F4QUxMUUFBUVNCeFFRQkhJUWtEUUNBR1FRaElCRUFnQUVFSElBWnJJQVlnQ0NBSlJ4c2lCR29pQTBHZ0FVd0VRQUovSUFNZ0FVR2dBV3dpQ21vaUMwRURiQ0lHUVlESkJXb2lBeUFETFFBQU9nQUFJQVpCZ2NrRmFpQURMUUFCT2dBQUlBWkJnc2tGYWlBRExRQUNPZ0FBSUF0QmdKRUVhaUFLSUFCQkFDQUVhMnRxUWZpUUJHb3RBQUFpQTBFRGNTSUdRUVJ5SUFZZ0EwRUVjUnM2QUFBZ0JVRUJhZ3NoQlFzZ0JFRUJhaUVHREFFTEN3VWdCQ1JIQ3lBQUlBZE9CSDhnQUVFSWFpRUJJQUFnQWtFSGNTSUFTQVIvSUFBZ0FXb0ZJQUVMQlNBSEN5UklJQVVMclFFQUlBRVFDeTBBQUNBQVFRRjBkVUVEY1NFQUlBRkJ5UDREUmdSQUl6OGhBUUpBQWtBQ1FBSkFJQUJCQVdzT0F3QUJBZ01MSTBBaEFRd0NDeU5CSVFFTUFRc2pRaUVCQ3dVZ0FVSEovZ05HQkVBalF5RUJBa0FDUUFKQUFrQWdBRUVCYXc0REFBRUNBd3NqUkNFQkRBSUxJMFVoQVF3QkN5TkdJUUVMQlNNN0lRRUNRQUpBQWtBQ1FDQUFRUUZyRGdNQUFRSURDeU04SVFFTUFnc2pQU0VCREFFTEl6NGhBUXNMQ3lBQkMrQURBUVovSUFKQkFYRkJEWFFpRHlFT0lBNGdBU0lDUVlDUUFrWUVmeUFBUVlBQmF5QUFRWUFCYWlBQVFZQUJjUnNGSUFBTFFRUjBJQUpxSUFWQkFYUnFJZ0JCZ0pCK2Ftb3RBQUFoRVNBUElBQkJnWkIrYW1vdEFBQWhFaUFESVFBRFFDQUFJQVJNQkVBZ0JpQUFJQU5yYWlJUElBaElCRUFDZnlBU1FRRkJCeUFBYXlBQVFRRWdDMEVnY1VVZ0MwRUFTQnNiSWdKMGNRUi9RUUlGUVFBTElnRkJBV29nQVNBUlFRRWdBblJ4R3lFRkkvNEJCSDlCQVNBTVFRQk9JQXRCQUU0YkJVRUFDd1IvSUF0QkIzRWhBU0FNUVFCT0lnSUVmeUFNUVFkeEJTQUJDMEVEZENBRlFRRjBhaUlCUVFGcVFUOXhJZzVCUUdzZ0RpQUNHMEdBa0FScUxRQUFRUWgwSUFGQlAzRWlBVUZBYXlBQklBSWJRWUNRQkdvdEFBQnlJZ0ZCSDNGQkEzUWhEaUFCUWVBSGNVRUZka0VEZENFQ0lBRkJnUGdCY1VFS2RrRURkQVVnQlVISC9nTWdDaUFLUVFCTUd5SUtFQ0lpQVVHQWdQd0hjVUVRZGlFT0lBRkJnUDREY1VFSWRpRUNJQUZCL3dGeEN5RUJJQWtnRHlBSElBaHNha0VEYkdvaUVDQU9PZ0FBSUJBZ0Fqb0FBU0FRSUFFNkFBSWdEeUFIUWFBQmJHcEJnSkVFYWlBRlFRTnhJZ0ZCQkhJZ0FTQUxRWUFCY1VFQUlBdEJBRTRiR3pvQUFDQU5RUUZxQ3lFTkN5QUFRUUZxSVFBTUFRc0xJQTBMMGdJQUlBTkJCM0VoQXlBRklBVkJnSkFDUmdSL0lBWkJnQUZySUFaQmdBRnFJQVpCZ0FGeEd3VWdCZ3RCQkhScUlRVWdCU0FFUVlEUWZtb3RBQUFpQkVIQUFIRUVmMEVISUFOckJTQURDMEVCZEdvaUEwR0FrSDVxSUFSQkNIRkJBRWNpQlVFTmRHb3RBQUFoQmlBQUlBRkJvQUZzYWtFRGJFR0F5UVZxSUFSQkIzRkJBM1FnQTBHQmtINXFJQVZCQVhGQkRYUnFMUUFBUVFFZ0FrRUhjU0lDUVFjZ0Ftc2dCRUVnY1JzaUEzUnhCSDlCQWdWQkFBc2lBa0VCYWlBQ0lBWkJBU0FEZEhFYklnTkJBWFJxSWdKQkFXcEJQM0ZCZ0pBRWFpMEFBRUVJZENBQ1FUOXhRWUNRQkdvdEFBQnlJZ0pCSDNGQkEzUTZBQUFnQUNBQlFhQUJiR29pQUVFRGJDSUJRWUhKQldvZ0FrSGdCM0ZCQlhaQkEzUTZBQUFnQVVHQ3lRVnFJQUpCZ1BnQmNVRUtka0VEZERvQUFDQUFRWUNSQkdvZ0EwRURjU0lBUVFSeUlBQWdCRUdBQVhFYk9nQUFDOHNCQUNBRUlBUkJnSkFDUmdSL0lBVkJnQUZySUFWQmdBRnFJQVZCZ0FGeEd3VWdCUXRCQkhScUlBTkJCM0ZCQVhScUlnTkJnSkIrYWkwQUFDRUVJQUFnQVVHZ0FXeHFJZ1ZCQTJ3aUFVR0F5UVZxSUFOQmdaQithaTBBQUVFQlFRY2dBa0VIY1dzaUFuUnhCSDlCQWdWQkFBc2lBRUVCYWlBQUlBUkJBU0FDZEhFYlFmOEJjU0lDUWNmK0F4QWlJZ0JCZ0lEOEIzRkJFSFk2QUFBZ0FVR0J5UVZxSUFCQmdQNERjVUVJZGpvQUFDQUJRWUxKQldvZ0FEb0FBQ0FGUVlDUkJHb2dBa0VEY1RvQUFBdkhBZ0VIZnlBRFFRTjFJUXNEUUNBRVFhQUJTQVJBSUFJZ0MwRUZkR29DZnlBRUlBVnFJZ1pCZ0FKT0JFQWdCa0dBQW1zaEJnc2dCZ3RCQTNWcUlncEJnSkIrYWkwQUFDRUlRUUFoQnlNNUJFQWdCQ0FBSUFZZ0NpQUlFQ0VpQ1VFQVNnUkFBbjlCQVNFSElBUWdDVUVCYTJvTElRUUxDeUFIUlVFQUl6Z2JCRUJCQUNFSklBTkJCM0VoQjBFQUlBWWdCa0VEZFVFRGRHc2dCQnNoREVGL0lRWWovZ0VFUUFKL0lBcEJnTkIrYWkwQUFDSUdRUWh4UVFCSElRbEJCeUFIYXlBSElBWkJ3QUJ4R3dzaEJ3c2dCQ0FJSUFFZ0NTQU1RYUFCSUFSclFRY2dCRUVJYWtHZ0FVb2JJQWNnQkNBQVFhQUJRWURKQlVFQUlBWkJmeEFqSWdaQkFXdHFJQVFnQmtFQVNoc2hCQVVnQjBVRVFDUCtBUVJBSUFRZ0FDQUdJQU1nQ2lBQklBZ1FKQVVnQkNBQUlBWWdBeUFCSUFnUUpRc0xDeUFFUVFGcUlRUU1BUXNMQzVVRkFROS9RU2NoQndOQUlBZEJBRTRFUUNBSFFRSjBJZ1ZCZ1B3RGFpSUNFQXN0QUFBaEF5QUNRUUZxRUFzdEFBQWhCaUFDUVFKcUVBc3RBQUFoQkNBR1FRaHJJUW9nQUNBRFFSQnJJZ01nQVFSL0lBUWdCRUVCY1dzaEJFRVFCVUVJQ3lJQ2FraEJBQ0FBSUFOT0d3UkFJQVZCZy93RGFoQUxMUUFBSWdaQmdBRnhRUUJISVFzZ0JrRWdjVUVBUnlFTUlBWkJDSEZCQUVjai9nRWlCU0FGRzBFQmNVRU5kQ0lGSUFSQkJIUkJnSUFDYWlBQ0lBQWdBMnNpQW10QkFXc2dBaUFHUWNBQWNSdEJBWFJxSWdKQmdKQithbW90QUFBaERTQUZJQUpCZ1pCK2Ftb3RBQUFoRGtFSElRUURRQ0FFUVFCT0JFQWdEa0VCUVFBZ0JFRUhhMnNnQkNBTUd5SURkSEVFZjBFQ0JVRUFDeUlDUVFGcUlBSWdEVUVCSUFOMGNSc2lBd1JBSUFwQkJ5QUVhMm9pQWtHZ0FVeEJBQ0FDUVFCT0d3UkFRUUFoQlVFQUlRZ2o1d0ZGSS80Qklna2dDUnNpQ1VVRVFDQUNJQUJCb0FGc2FrR0FrUVJxTFFBQUlnOUJBM0VpRUVFQVMwRUFJQXNiQkVCQkFTRUZCU0FRUVFCTFFRQWdEMEVFY1VFQUkvNEJHeHRGUlNFSUN3dEJBVUVBSUFoRklBVWJJQWtiQkVBai9nRUVRQ0FDSUFCQm9BRnNha0VEYkNJQ1FZREpCV29nQmtFSGNVRURkQ0FEUVFGMGFpSURRUUZxUVQ5eFFjQ1FCR290QUFCQkNIUWdBMEUvY1VIQWtBUnFMUUFBY2lJRFFSOXhRUU4wT2dBQUlBSkJnY2tGYWlBRFFlQUhjVUVGZGtFRGREb0FBQ0FDUVlMSkJXb2dBMEdBK0FGeFFRcDJRUU4wT2dBQUJTQUNJQUJCb0FGc2FrRURiQ0lDUVlESkJXb2dBMEhKL2dOQnlQNERJQVpCRUhFYkVDSWlBMEdBZ1B3SGNVRVFkam9BQUNBQ1FZSEpCV29nQTBHQS9nTnhRUWgyT2dBQUlBSkJnc2tGYWlBRE9nQUFDd3NMQ3lBRVFRRnJJUVFNQVFzTEN5QUhRUUZySVFjTUFRc0xDNEVCQVFKL1FZQ0FBa0dBa0FJajR3RWJJUUZCQVNQbkFTUCtBUnNFUUNBQUlBRkJnTGdDUVlDd0FpUGtBUnNnQUNQc0FXcEIvd0Z4UVFBajZ3RVFKZ3NqNGdFRVFDQUFJKzRCSWdKT0JFQWdBQ0FCUVlDNEFrR0FzQUlqNFFFYklBQWdBbXNqN1FGQkIyc2lBVUVBSUFGckVDWUxDeVBtQVFSQUlBQWo1UUVRSndzTElRQkJqLzRERUFzdEFBQkJBU0FBZEhJaUFDUzhBVUdQL2dNUUN5QUFPZ0FBQytvQkFRTi9JMTlGUVFFalZSc0VRQThMSTJCQkFXc2lBRUVBVEFSQUkwb0VRQ05LSkdBQ2Z5TmhJZ0VqVEhVaEFFRUJJMHNFZjBFQkpHSWdBU0FBYXdVZ0FDQUJhZ3NpQUVIL0Qwb05BQnBCQUFzRVFFRUFKRlVMSTB4QkFFb0VRQ0FBSkdFZ0FFRUlkVUVIY1NJQ1FaVCtBeEFMTFFBQVFmZ0JjWEloQVVHVC9nTVFDeUFBUWY4QmNTSUFPZ0FBUVpUK0F4QUxJQUU2QUFBZ0FDUlNJQUlrVkNOU0kxUkJDSFJ5SkZjQ2Z5TmhJZ0VqVEhVaEFFRUJJMHNFZjBFQkpHSWdBU0FBYXdVZ0FDQUJhZ3RCL3c5S0RRQWFRUUFMQkVCQkFDUlZDd3NGUVFna1lBc0ZJQUFrWUFzTHdRY0JBbjhnQUNPd0FXb2lBRUdBd0FBai93RjBJZ0pPQkVBZ0FDQUNheVN3QVFKQUFrQUNRQUpBQWtBQ1FDT3hBVUVCYWtFSGNTSUNEZ2dBQlFFRkFnVURCQVVMSTFOQkFDTmJJZ0JCQUVvYkJFQWdBRUVCYXlJQVJRUkFRUUFrVlFzTElBQWtXd0ovSTJwQkFDTnlJZ0JCQUVvYkJFQWdBRUVCYXlFQUN5QUFDMFVFUUVFQUpHd0xJQUFrY2dKL0kzcEJBQ09BQVNJQVFRQktHd1JBSUFCQkFXc2hBQXNnQUF0RkJFQkJBQ1I4Q3lBQUpJQUJBbjhqalFGQkFDT1RBU0lBUVFCS0d3UkFJQUJCQVdzaEFBc2dBQXRGQkVCQkFDU09BUXNnQUNTVEFRd0VDeU5UUVFBald5SUFRUUJLR3dSQUlBQkJBV3NpQUVVRVFFRUFKRlVMQ3lBQUpGc0NmeU5xUVFBamNpSUFRUUJLR3dSQUlBQkJBV3NoQUFzZ0FBdEZCRUJCQUNSc0N5QUFKSElDZnlONlFRQWpnQUVpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtmQXNnQUNTQUFRSi9JNDBCUVFBamt3RWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2pnRUxJQUFra3dFUUtnd0RDeU5UUVFBald5SUFRUUJLR3dSQUlBQkJBV3NpQUVVRVFFRUFKRlVMQ3lBQUpGc0NmeU5xUVFBamNpSUFRUUJLR3dSQUlBQkJBV3NoQUFzZ0FBdEZCRUJCQUNSc0N5QUFKSElDZnlONlFRQWpnQUVpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtmQXNnQUNTQUFRSi9JNDBCUVFBamt3RWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2pnRUxJQUFra3dFTUFnc2pVMEVBSTFzaUFFRUFTaHNFUUNBQVFRRnJJZ0JGQkVCQkFDUlZDd3NnQUNSYkFuOGpha0VBSTNJaUFFRUFTaHNFUUNBQVFRRnJJUUFMSUFBTFJRUkFRUUFrYkFzZ0FDUnlBbjhqZWtFQUk0QUJJZ0JCQUVvYkJFQWdBRUVCYXlFQUN5QUFDMFVFUUVFQUpId0xJQUFrZ0FFQ2Z5T05BVUVBSTVNQklnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkk0QkN5QUFKSk1CRUNvTUFRc2pXVUVCYXlJQVFRQk1CRUFqVVFSQUkxcEJBQ05SSWdBYkJFQWpYQ0lCUVFGcUlBRkJBV3NqVUJ0QkQzRWlBVUVQU1FSQUlBRWtYQVZCQUNSYUN3c0ZRUWdoQUFzTElBQWtXU053UVFGcklnQkJBRXdFUUNOb0JFQWpjVUVBSTJnaUFCc0VRQ056SWdGQkFXb2dBVUVCYXlObkcwRVBjU0lCUVE5SkJFQWdBU1J6QlVFQUpIRUxDd1ZCQ0NFQUN3c2dBQ1J3STVFQlFRRnJJZ0JCQUV3RVFDT0pBUVJBSTVJQlFRQWppUUVpQUJzRVFDT1VBU0lCUVFGcUlBRkJBV3NqaUFFYlFROXhJZ0ZCRDBrRVFDQUJKSlFCQlVFQUpKSUJDd3NGUVFnaEFBc0xJQUFra1FFTElBSWtzUUZCQVE4RklBQWtzQUVMUVFBTHdRRUJBWDhqV0NBQWF5RUFBMEFnQUVFQVRBUkFRWUFRSTFkclFRSjBJZ0ZCQW5RZ0FTUC9BUnNrV0NOWUlBQkJIM1VpQVNBQUlBRnFjMnNoQUNOZVFRRnFRUWR4SkY0TUFRc0xJQUFrV0NOV1FRQWpWUnNFZnlOY1FROXhCVUVQRHdzaEFBSi9JMTRoQVFKQUFrQUNRQUpBSTAxQkFXc09Bd0FCQWdNTFFRRWdBWFJCZ1FGeFFRQkhEQU1MUVFFZ0FYUkJod0Z4UVFCSERBSUxRUUVnQVhSQi9nQnhRUUJIREFFTFFRRWdBWFJCQVhFTEJIOUJBUVZCZndzZ0FHeEJEMm9MdWdFQkFYOGpieUFBYXlFQUEwQWdBRUVBVEFSQVFZQVFJMjVyUVFKMEkvOEJkQ1J2STI4Z0FFRWZkU0lCSUFBZ0FXcHpheUVBSTNWQkFXcEJCM0VrZFF3QkN3c2dBQ1J2STIxQkFDTnNHd1IvSTNOQkQzRUZRUThQQ3lFQUFuOGpkU0VCQWtBQ1FBSkFBa0FqWkVFQmF3NERBQUVDQXd0QkFTQUJkRUdCQVhGQkFFY01Bd3RCQVNBQmRFR0hBWEZCQUVjTUFndEJBU0FCZEVIK0FIRkJBRWNNQVF0QkFTQUJkRUVCY1FzRWYwRUJCVUYvQ3lBQWJFRVBhZ3VJQWdFRGZ5TjlSVUVCSTN3YkJFQkJEdzhMSTRJQklRTWpnd0VFUUVHYy9nTVFDeTBBQUVFRmRpSURKSUlCUVFBa2d3RUxJNFFCSTRFQlFRRnhSVUVDZEhWQkQzRWhBZ0pBQWtBQ1FBSkFBa0FnQXc0REFBRUNBd3NnQWtFRWRTRUNEQU1MUVFFaEFRd0NDeUFDUVFGMUlRSkJBaUVCREFFTElBSkJBblVoQWtFRUlRRUxJQUZCQUVzRWZ5QUNJQUZ0QlVFQUMwRVBhaUVDSTM4Z0FHc2hBQU5BSUFCQkFFd0VRRUdBRUNOK2EwRUJkQ1AvQVhRa2Z5Ti9JQUJCSDNVaUFTQUFJQUZxYzJzaEFDT0JBVUVCYWlFQkEwQWdBVUVnVGdSQUlBRkJJR3NoQVF3QkN3c2dBU1NCQVNPQkFVRUJkVUd3L2dOcUVBc3RBQUFraEFFTUFRc0xJQUFrZnlBQ0M0OEJBUUovSTVBQklBQnJJZ0JCQUV3RVFDT1ZBU09LQVhRai93RjBJQUJCSDNVaUFTQUFJQUZxYzJzaEFDT1dBU0lCUVFGMUlnSWdBVUVCY1NBQ1FRRnhjeUlCUVE1MGNpSUNRYjkvY1NBQlFRWjBjaUFDSTRzQkd5U1dBUXRCQUNBQUlBQkJBRWdiSkpBQkk0OEJRUUFqamdFYkJIOGpsQUZCRDNFRlFROFBDMEYvUVFFamxnRkJBWEViYkVFUGFndmxBUUVCZjBFQUpLRUJJQUJCRHlPckFSc2dBVUVQSTZ3Qkcyb2dBa0VQSTYwQkcyb2dBMEVQSTY0Qkcyb2hCRUVBSktJQlFRQWtvd0VDZjBIL0FDQUFRUThqcHdFYklBRkJEeU9vQVJ0cUlBSkJEeU9wQVJ0cUlBTkJEeU9xQVJ0cUlnQkJQRVlOQUJvanBRRkJBV29nQUVFOGEwR2dqUVpzYkVFRGRVR2dqUVp0UVR4cVFhQ05CbXhCalBFQ2JRc2hBZ0ovSTZZQlFRRnFJUUZCL3dBZ0JFRThSZzBBR2lBQklBUkJQR3RCb0kwR2JHeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMSVFBZ0FpU2ZBU0FBSktBQklBQkIvd0Z4SUFKQi93RnhRUWgwY2d1Y0F3RUZmeUFBSTBscUlnRWtTU05ZSUFGclFRQk1JZ0ZGQkVBalZpSUNJNXNCUnlFQklBSWttd0VMSUFBalkyb2lBaVJqSTI4Z0FtdEJBRXdpQWtVRVFDTnRJZ1FqbkFGSElRSWdCQ1NjQVFzZ0FDTjJhaVIyUVFBamZ5TjJhMEVBU2lPREFSdEZJZ1JGQkVBamZTSUZJNTBCUnlFRUlBVWtuUUVMSUFBamhRRnFKSVVCSTVBQkk0VUJhMEVBVENJRlJRUkFJNDhCSWdNam5nRkhJUVVnQXlTZUFRc2dBUVJBSTBraEEwRUFKRWtnQXhBc0pKY0JDeUFDQkVBall5RURRUUFrWXlBREVDMGttQUVMSUFRRVFDTjJJUU5CQUNSMklBTVFMaVNaQVFzZ0JRUkFJNFVCSVFOQkFDU0ZBU0FERUM4a21nRUxRUUVnQlVFQklBUkJBU0FDSUFFYkd4c0VRRUVCSktNQkN5QUFJN0lCYWlJQVFZQ0FnQUlqL3dGMFFjVFlBbTBpQVU0RVFDQUFJQUZySVFCQkFTT2lBVUVCSTZFQkk2TUJHeHNFUUNPWEFTT1lBU09aQVNPYUFSQXdHZ1VnQUNTeUFRc2pzd0VpQVVFQmRFR0FtY0VBYWlJQ0k1OEJRUUpxT2dBQUlBSWpvQUZCQW1vNkFBRWdBVUVCYWlJQlFmLy9BMDRFZnlBQlFRRnJCU0FCQ3lTekFRc2dBQ1N5QVF1V0F3RUdmeUFBRUN3aEFTQUFFQzBoQWlBQUVDNGhCQ0FBRUM4aEJTQUJKSmNCSUFJa21BRWdCQ1NaQVNBRkpKb0JJQUFqc2dGcUlnQkJnSUNBQWlQL0FYUkJ4TmdDYlU0RVFDQUFRWUNBZ0FJai93RjBRY1RZQW0xcklRQWdBU0FDSUFRZ0JSQXdJUU1qc3dGQkFYUkJnSm5CQUdvaUJpQURRWUQrQTNGQkNIWkJBbW82QUFBZ0JpQURRZjhCY1VFQ2Fqb0FBU002QkVBZ0FVRVBRUTlCRHhBd0lRRWpzd0ZCQVhSQmdKa2hhaUlESUFGQmdQNERjVUVJZGtFQ2Fqb0FBQ0FESUFGQi93RnhRUUpxT2dBQlFROGdBa0VQUVE4UU1DRUJJN01CUVFGMFFZQ1pLV29pQWlBQlFZRCtBM0ZCQ0haQkFtbzZBQUFnQWlBQlFmOEJjVUVDYWpvQUFVRVBRUThnQkVFUEVEQWhBU096QVVFQmRFR0FtVEZxSWdJZ0FVR0EvZ054UVFoMlFRSnFPZ0FBSUFJZ0FVSC9BWEZCQW1vNkFBRkJEMEVQUVE4Z0JSQXdJUUVqc3dGQkFYUkJnSms1YWlJQ0lBRkJnUDREY1VFSWRrRUNham9BQUNBQ0lBRkIvd0Z4UVFKcU9nQUJDeU96QVVFQmFpSUJRZi8vQTA0RWZ5QUJRUUZyQlNBQkN5U3pBUXNnQUNTeUFRdEJBUUovUWRjQUkvOEJkQ0VBSTZRQklRRURRQ0FCSUFCT0JFQWdBQkFyUlVFQUl6Y2JCRUFnQUJBeEJTQUFFRElMSUFFZ0FHc2hBUXdCQ3dzZ0FTU2tBUXZLQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdRL2dOckRoY0FCUW9QRXdFR0N4QVVBZ2NNRVJVRENBMFNGZ1FKRGhjTFFaRCtBeEFMTFFBQVFZQUJjZzhMUVpYK0F4QUxMUUFBUWY4QmNnOExRWnIrQXhBTExRQUFRZjhBY2c4TFFaLytBeEFMTFFBQVFmOEJjZzhMUWFUK0F4QUxMUUFBRHd0QmtmNERFQXN0QUFCQlAzSVBDMEdXL2dNUUN5MEFBRUUvY2c4TFFaditBeEFMTFFBQVFmOEJjZzhMUWFEK0F4QUxMUUFBUWY4QmNnOExRYVgrQXhBTExRQUFEd3RCa3Y0REVBc3RBQUFQQzBHWC9nTVFDeTBBQUE4TFFaeitBeEFMTFFBQVFaOEJjZzhMUWFIK0F4QUxMUUFBRHd0QmdBRkJBQ092QVJzaUFFRUJjaUFBUVg1eEkxVWJJZ0JCQW5JZ0FFRjljU05zR3lJQVFRUnlJQUJCZTNFamZCc2lBRUVJY2lBQVFYZHhJNDRCRzBId0FISVBDMEdUL2dNUUN5MEFBRUgvQVhJUEMwR1kvZ01RQ3kwQUFFSC9BWElQQzBHZC9nTVFDeTBBQUVIL0FYSVBDMEdpL2dNUUN5MEFBQThMUVpUK0F4QUxMUUFBUWI4QmNnOExRWm4rQXhBTExRQUFRYjhCY2c4TFFaNytBeEFMTFFBQVFiOEJjZzhMUWFQK0F4QUxMUUFBUWI4QmNnOExRWDhMalFFQkFYOGoxd0VoQUNQWUFRUi9JQUJCZTNFZ0FFRUVjaVBQQVJzaUFFRitjU0FBUVFGeUk5SUJHeUlBUVhkeElBQkJDSElqMEFFYklnQkJmWEVnQUVFQ2NpUFJBUnNGSTlrQkJIOGdBRUYrY1NBQVFRRnlJOU1CR3lJQVFYMXhJQUJCQW5JajFBRWJJZ0JCZTNFZ0FFRUVjaVBWQVJzaUFFRjNjU0FBUVFoeUk5WUJHd1VnQUFzTFFmQUJjZ3YwQWdFQmZ5QUFRWUNBQWtnRVFFRi9Ed3NnQUVHQXdBSklRUUFnQUVHQWdBSk9Hd1JBUVg4UEN5QUFRWUQ4QTBoQkFDQUFRWURBQTA0YkJFQWdBRUdBUUdvUUN5MEFBQThMSUFCQm4vMERURUVBSUFCQmdQd0RUaHNFUUVIL0FVRi9JOTRCUVFKSUd3OExJQUJCemY0RFJnUkFRYzMrQXhBTExRQUFRUUZ4Qkg5Qi93RUZRZjRCQ3lJQUlBQkIvMzV4SS84Qkd3OExJQUJCeFA0RFJnUkFJK29CSVFFZ0FCQUxJQUU2QUFBajZnRVBDeUFBUWFiK0EweEJBQ0FBUVpEK0EwNGJCRUFRTXlBQUVEUVBDeUFBUWEvK0EweEJBQ0FBUWFmK0EwNGJCRUJCL3dFUEN5QUFRYi8rQTB4QkFDQUFRYkQrQTA0YkJFQVFNeU44QkVBamdRRkJBWFZCc1A0RGFoQUxMUUFBRHd0QmZ3OExJQUJCaFA0RFJnUkFJOE1CUVlEK0EzRkJDSFloQVNBQUVBc2dBVG9BQUNBQkR3c2dBRUdGL2dOR0JFQWp4QUVoQVNBQUVBc2dBVG9BQUNQRUFROExJQUJCai80RFJnUkFJN3dCUWVBQmNnOExJQUJCZ1A0RFJnUkFFRFVQQzBGL0N5d0JBWDhnQUNQYkFVWUVRRUVCSk4wQkN5QUFFRFlpQVVGL1JnUi9JQUFRQ3kwQUFBVWdBVUgvQVhFTEM1b0NBUUovSS9NQkJFQVBDeVAwQVNFREkvVUJJUUlnQUVIL1Awd0VRQ0FCUVJCeFJVRUFJQUliUlFSQUlBRkJEM0VpQUFSQUlBQkJDa1lFUUVFQkpQRUJDd1ZCQUNUeEFRc0xCU0FBUWYvL0FFd0VRQ0FBUWYvZkFFeEJBU1AzQVNJQUd3UkFJQUZCRDNFajd3RWdBaHNoQWlBREJIOGdBVUVmY1NFQklBSkI0QUZ4QlNQMkFRUi9JQUZCL3dCeElRRWdBa0dBQVhFRlFRQWdBaUFBR3dzTElBRnlKTzhCQlNQdkFVSC9BWEVnQVVFQVNrRUlkSElrN3dFTEJVRUFJQUJCLzc4QlRDQUNHd1JBSS9JQlFRQWdBeHNFUUNQdkFVRWZjU0FCUWVBQmNYSWs3d0VQQ3lBQlFROXhJQUZCQTNFajl3RWJKUEFCQlVFQUlBQkIvLzhCVENBQ0d3UkFJQU1FUUNBQlFRRnhRUUJISlBJQkN3c0xDd3NMcWdFQkFuOUJBU1JWSTF0RkJFQkJ3QUFrV3d0QmdCQWpWMnRCQW5RaUFFRUNkQ0FBSS84Qkd5UllJMUVFUUNOUkpGa0ZRUWdrV1F0QkFTUmFJMDhrWENOWEpHRWpTZ1JBSTBva1lBVkJDQ1JnQzBFQkkweEJBRW9pQUNOS1FRQktHeVJmUVFBa1lpQUFCSDhDZnlOaElnQWpUSFVoQVVFQkkwc0VmMEVCSkdJZ0FDQUJhd1VnQUNBQmFndEIvdzlLRFFBYVFRQUxCVUVBQ3dSQVFRQWtWUXNqVmtVRVFFRUFKRlVMQzQwQkFRSi9JQUJCQjNFaUFTUlVJMUlnQVVFSWRISWtWeU5UUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNqc1FGQkFYRWlBa1VFUUNBQlFRQWpXMEVBU2hzRVFDTmJRUUZySkZ0QkFDTmJSU0FBUVlBQmNSc0VRRUVBSkZVTEN3c2dBRUhBQUhGQkFFY2tVeUFBUVlBQmNRUkFFRGtqVTBFQVFRQWpXMEhBQUVZZ0Foc2JCRUFqVzBFQmF5UmJDd3NMeXdFQkFuOGdBRUVIY1NJQ0pHc2phU0FDUVFoMGNpUnVJN0VCUVFGeElRSWpha1VpQVFSQUlBQkJ3QUJ4UVFCSElRRUxJQUpGQkVBZ0FVRUFJM0pCQUVvYkJFQWpja0VCYXlSeVFRQWpja1VnQUVHQUFYRWJCRUJCQUNSc0N3c0xJQUJCd0FCeFFRQkhKR29nQUVHQUFYRUVRRUVCSkd3amNrVUVRRUhBQUNSeUMwR0FFQ051YTBFQ2RDUC9BWFFrYnlOb0JFQWphQ1J3QlVFSUpIQUxRUUVrY1NObUpITWpiVVVFUUVFQUpHd0xJMnBCQUVFQUkzSkJ3QUJHSUFJYkd3UkFJM0pCQVdza2Nnc0xDNzRCQVFGL0lBQkJCM0VpQVNSN0kza2dBVUVJZEhJa2ZpT3hBVUVCY1NJQlJRUkFRUUFnQUVIQUFIRWplaHRCQUNPQUFVRUFTaHNFUUNPQUFVRUJheVNBQVVFQUk0QUJSU0FBUVlBQmNSc0VRRUVBSkh3TEN3c2dBRUhBQUhGQkFFY2tlaUFBUVlBQmNRUkFRUUVrZkNPQUFVVUVRRUdBQWlTQUFRdEJnQkFqZm10QkFYUWovd0YwSkg4amYwRUdhaVIvUVFBa2dRRWpmVVVFUUVFQUpId0xJM3BCQUVFQUk0QUJRWUFDUmlBQkd4c0VRQ09BQVVFQmF5U0FBUXNMQzlNQkFRSi9JNDBCUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNqc1FGQkFYRWlBa1VFUUNBQlFRQWprd0ZCQUVvYkJFQWprd0ZCQVdza2t3RkJBQ09UQVVVZ0FFR0FBWEViQkVCQkFDU09BUXNMQ3lBQVFjQUFjVUVBUnlTTkFTQUFRWUFCY1FSQVFRRWtqZ0Vqa3dGRkJFQkJ3QUFra3dFTEk1VUJJNG9CZENQL0FYUWtrQUVqaVFFRVFDT0pBU1NSQVFWQkNDU1JBUXRCQVNTU0FTT0hBU1NVQVVILy93RWtsZ0VqandGRkJFQkJBQ1NPQVFzampRRkJBRUVBSTVNQlFjQUFSaUFDR3hzRVFDT1RBVUVCYXlTVEFRc0xDOWNIQUNPdkFVVkJBQ0FBUWFiK0EwY2JCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR1EvZ05yRGhjQUFnWUtEaFVEQndzUEFRUUlEQkFWQlFrTkVSSVRGQlVMSTBzaEFDQUJRZkFBY1VFRWRpUktJQUZCQ0hGQkFFY2tTeUFCUVFkeEpFd2pZa0VBSTB0RlFRQWdBQnNiQkVCQkFDUlZDd3dVQzBFQUlBRkJnQUZ4UVFCSElnQWpmUnNFUUVFQUpJUUJDeUFBSkgwZ0FFVUVRQ0FBSkh3TERCTUxJQUZCQm5WQkEzRWtUU0FCUVQ5eEpFNUJ3QUFqVG1za1d3d1NDeUFCUVFaMVFRTnhKR1FnQVVFL2NTUmxRY0FBSTJWckpISU1FUXNnQVNSM1FZQUNJM2RySklBQkRCQUxJQUZCUDNFa2hnRkJ3QUFqaGdGckpKTUJEQThMSTFVRVFFRUFJMW9qVVJzRVFDTmNRUUZxUVE5eEpGd0xJMUFnQVVFSWNVRUFSMGNFUUVFUUkxeHJRUTl4SkZ3TEN5QUJRUVIxUVE5eEpFOGdBVUVJY1VFQVJ5UlFJQUZCQjNFa1VTQUJRZmdCY1VFQVN5SUFKRllnQUVVRVFFRUFKRlVMREE0TEkyd0VRRUVBSTNFamFCc0VRQ056UVFGcVFROXhKSE1MSTJjZ0FVRUljVUVBUjBjRVFFRVFJM05yUVE5eEpITUxDeUFCUVFSMVFROXhKR1lnQVVFSWNVRUFSeVJuSUFGQkIzRWthQ0FCUWZnQmNVRUFTeUlBSkcwZ0FFVUVRQ0FBSkd3TERBMExRUUVrZ3dFZ0FVRUZkVUVQY1NSNERBd0xJNDRCQkVCQkFDT1NBU09KQVJzRVFDT1VBVUVCYWtFUGNTU1VBUXNqaUFFZ0FVRUljVUVBUjBjRVFFRVFJNVFCYTBFUGNTU1VBUXNMSUFGQkJIVkJEM0VraHdFZ0FVRUljVUVBUnlTSUFTQUJRUWR4SklrQklBRkIrQUZ4UVFCTElnQWtqd0VnQUVVRVFDQUFKSTRCQ3d3TEN5QUJKRklnQVNOVVFRaDBjaVJYREFvTElBRWthU0FCSTJ0QkNIUnlKRzRNQ1FzZ0FTUjVJQUVqZTBFSWRISWtmZ3dJQ3lBQlFRUjFKSW9CSUFGQkNIRkJBRWNraXdFZ0FVRUhjU0lBSkl3QklBQkJBWFFpQUVFQlNBUi9RUUVGSUFBTFFRTjBKSlVCREFjTElBRVFPZ3dHQ3lBQkVEc01CUXNnQVJBOERBUUxJQUVRUFF3REN5QUJRUVIxUVFkeEpLVUJJQUZCQjNFa3BnRkJBU1NoQVF3Q0N5QUJRWUFCY1VFQVJ5U3FBU0FCUWNBQWNVRUFSeVNwQVNBQlFTQnhRUUJISktnQklBRkJFSEZCQUVja3B3RWdBVUVJY1VFQVJ5U3VBU0FCUVFSeFFRQkhKSzBCSUFGQkFuRkJBRWNrckFFZ0FVRUJjVUVBUnlTckFVRUJKS0lCREFFTEk2OEJJZ0FFZjBFQUJTQUJRWUFCY1FzRVFFRUhKTEVCUVFBa1hrRUFKSFVMSUFGQmdBRnhSVUVBSUFBYkJFQkJrUDRESVFBRFFDQUFRYWIrQTBnRVFDQUFRUUFRUkNBQVFRRnFJUUFNQVFzTEN5QUJRWUFCY1VFQVJ5U3ZBUXRCQVF0ZkFRSi9RUUFrNlFGQkFDVHFBVUhFL2dNUUMwRUFPZ0FBUWNIK0F4QUxMUUFBUVh4eElRSkJBQ1RlQVVIQi9nTVFDeUFDT2dBQUlBQUVRQU5BSUFGQmdOZ0ZTQVJBSUFGQmdNa0Zha0gvQVRvQUFDQUJRUUZxSVFFTUFRc0xDd3ZKQVFFRGZ5UCtBVVVFUUE4TElBQkJnQUZ4UlVFQUkva0JHd1JBUVFBaytRRkIxZjRERUFzdEFBQkJnQUZ5SVFCQjFmNERFQXNnQURvQUFBOExRZEgrQXhBTExRQUFRUWgwUWRMK0F4QUxMUUFBY2tIdy93TnhJUUZCMC80REVBc3RBQUJCQ0hSQjFQNERFQXN0QUFCeVFmQS9jVUdBZ0FKcUlRSWdBRUgvZm5GQkFXcEJCSFFoQXlBQVFZQUJjUVJBUVFFaytRRWdBeVQ2QVNBQkpQc0JJQUlrL0FGQjFmNERFQXNnQUVIL2ZuRTZBQUFGSUFFZ0FpQURFRVZCMWY0REVBdEIvd0U2QUFBTEM4TUJBUVIvQTBBZ0FpQUFTQVJBSUFKQkJHb2hBaVBEQVNJQlFRUnFRZi8vQTNFaUF5VERBU1BKQVFSQUk4WUJJUVFqeFFFRVFDUElBU1RFQVVFQkpMOEJRUUlRS1VFQUpNVUJRUUVreGdFRklBUUVRRUVBSk1ZQkN3c2dBVUVCQW44Q1FBSkFBa0FDUUFKQUk4b0JEZ1FBQVFJREJBdEJDUXdFQzBFRERBTUxRUVVNQWd0QkJ3d0JDMEVBQ3lJQmRIRUVmeUFEUVFFZ0FYUnhSUVZCQUFzRVFDUEVBVUVCYWlJQlFmOEJTZ1IvUVFFa3hRRkJBQVVnQVFza3hBRUxDd3dCQ3dzTHl3RUJBMzhqeVFFaEFTQUFRUVJ4UVFCSEpNa0JJQUJCQTNFaEF5QUJSUVJBQW44Q1FBSkFBa0FDUUFKQUk4b0JEZ1FBQVFJREJBdEJDUXdFQzBFRERBTUxRUVVNQWd0QkJ3d0JDMEVBQ3lFQkFuOENRQUpBQWtBQ1FBSkFJQU1PQkFBQkFnTUVDMEVKREFRTFFRTU1Bd3RCQlF3Q0MwRUhEQUVMUVFBTElRQWp3d0VoQWlQSkFRUi9JQUpCQVNBQmRIRUZJQUpCQVNBQWRIRkJBQ0FDUVFFZ0FYUnhHd3NFUUNQRUFVRUJhaUlBUWY4QlNnUi9RUUVreFFGQkFBVWdBQXNreEFFTEN5QURKTW9CQzdvS0FRTi9Ba0FDUUNBQVFjMytBMFlFUUVITi9nTVFDeUFCUVFGeE9nQUFEQUVMSUFCQjBQNERSa0VBSS8wQkd3UkFRUUFrL1FGQi93RWtpUUlNQWdzZ0FFR0FnQUpJQkVBZ0FDQUJFRGdNQVFzZ0FFR0F3QUpJUVFBZ0FFR0FnQUpPR3cwQklBQkJnUHdEU0VFQUlBQkJnTUFEVGhzRVFDQUFRWUJBYWhBTElBRTZBQUFNQWdzZ0FFR2YvUU5NUVFBZ0FFR0EvQU5PR3dSQUk5NEJRUUpPRHdzZ0FFSC8vUU5NUVFBZ0FFR2cvUU5PR3cwQUlBQkJndjREUmdSQUlBRkJBbkZCQUVja3pRRWdBVUdBQVhGQkFFY2t6Z0ZCQVE4TElBQkJwdjREVEVFQUlBQkJrUDREVGhzRVFCQXpJQUFnQVJBK0R3c2dBRUcvL2dOTVFRQWdBRUd3L2dOT0d3UkFFRE1qZkFSQUk0RUJRUUYxUWJEK0Eyb1FDeUFCT2dBQURBSUxEQUlMSUFCQnkvNERURUVBSUFCQndQNERUaHNFUUNBQVFjRCtBMFlFUUNQZ0FTRUFJQUZCZ0FGeFFRQkhKT0FCSUFGQndBQnhRUUJISk9FQklBRkJJSEZCQUVjazRnRWdBVUVRY1VFQVJ5VGpBU0FCUVFoeFFRQkhKT1FCSUFGQkJIRkJBRWNrNVFFZ0FVRUNjVUVBUnlUbUFTQUJRUUZ4UVFCSEpPY0JJK0FCUlVFQUlBQWJCRUJCQVJBL0MwRUFJK0FCSUFBYkJFQkJBQkEvQ3d3REN5QUFRY0grQTBZRVFDQUJRZmdCY1VIQi9nTVFDeTBBQUVFSGNYSkJnQUZ5SVFCQndmNERFQXNnQURvQUFBd0NDeUFBUWNUK0EwWUVRRUVBSk9vQklBQVFDMEVBT2dBQURBSUxJQUJCeGY0RFJnUkFJQUVrM3dFTUF3c2dBRUhHL2dOR0JFQkJBQ0VBSUFGQkNIUWhBUU5BSUFCQm53Rk1CRUFnQUNBQmFoQUxMUUFBSVFJZ0FFR0EvQU5xRUFzZ0Fqb0FBQ0FBUVFGcUlRQU1BUXNMUVlRRkpQZ0JEQU1MQWtBQ1FBSkFBa0FnQUVIRC9nTkhCRUFnQUVIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTVHJBUXdHQ3lBQkpPd0JEQVVMSUFFazdRRU1CQXNnQVNUdUFRd0RDd3dDQ3lBQVFkWCtBMFlFUUNBQkVFQU1BUXRCQVNBQVFjLytBMFlnQUVIdy9nTkdHd1JBSS9rQkJFQWord0VpQWtILy93Rk1RUUFnQWtHQWdBRk9Hd1IvUVFFRklBSkIvNzhEVEVFQUlBSkJnS0FEVGhzTERRSUxDeUFBUWV2K0EweEJBQ0FBUWVqK0EwNGJCRUJCQVNBQVFlditBMFlnQUVIcC9nTkdHd1JBSUFCQkFXc2lBeEFMTFFBQVFiOS9jU0lDUVQ5eElnUkJRR3NnQkNBQVFlditBMFliUVlDUUJHb2dBVG9BQUNBQ1FZQUJjUVJBSUFNUUN5QUNRUUZxUVlBQmNqb0FBQXNMREFJTElBQkJoLzREVEVFQUlBQkJoUDREVGhzRVFDUENBUkJCUVFBa3dnRUNRQUpBQWtBQ1FDQUFRWVQrQTBjRVFDQUFRWVgrQTJzT0F3RUNBd1FMSThNQklRQkJBQ1REQVVHRS9nTVFDMEVBT2dBQUk4a0JCSDhnQUVFQkFuOENRQUpBQWtBQ1FBSkFJOG9CRGdRQUFRSURCQXRCQ1F3RUMwRUREQU1MUVFVTUFndEJCd3dCQzBFQUMzUnhCVUVBQ3dSQUk4UUJRUUZxSWdCQi93RktCSDlCQVNURkFVRUFCU0FBQ3lURUFRc01CUXNDUUNQSkFRUkFJOFlCRFFFanhRRUVRRUVBSk1VQkN3c2dBU1RFQVFzTUJRc2dBU1RJQVNQR0FVRUFJOGtCR3dSQUlBRWt4QUZCQUNUR0FRc01CQXNnQVJCQ0RBTUxEQUlMSUFCQmdQNERSZ1JBSUFGQi93RnpKTmNCSTljQklnSkJFSEZCQUVjazJBRWdBa0VnY1VFQVJ5VFpBUXNnQUVHUC9nTkdCRUFnQVVFQmNVRUFSeVM5QVNBQlFRSnhRUUJISkw0QklBRkJCSEZCQUVja3Z3RWdBVUVJY1VFQVJ5VEFBU0FCUVJCeFFRQkhKTUVCSUFFa3ZBRU1BZ3NnQUVILy93TkdCRUFnQVVFQmNVRUFSeVMzQVNBQlFRSnhRUUJISkxnQklBRkJCSEZCQUVja3VRRWdBVUVJY1VFQVJ5UzZBU0FCUVJCeFFRQkhKTHNCSUFFa3RnRU1BZ3NNQVF0QkFBOExRUUVMSWdBZ0FDUGNBVVlFUUVFQkpOMEJDeUFBSUFFUVF3UkFJQUFRQ3lBQk9nQUFDd3RZQVFOL0EwQWdBeUFDU0FSQUlBQWdBMm9RTnlFRklBRWdBMm9oQkFOQUlBUkIvNzhDU2dSQUlBUkJnRUJxSVFRTUFRc0xJQVFnQlJCRUlBTkJBV29oQXd3QkN3c2orQUZCSUNQL0FYUWdBa0VFZFd4cUpQZ0JDem9BSStvQkk5OEJSa0VBSUFCQkFVWkJBU0FBR3hzRVFDQUJRUVJ5SWdGQndBQnhCRUJCQVNTK0FVRUJFQ2tMQlNBQlFYdHhJUUVMSUFFTC9BSUJCSDhqNEFGRkJFQVBDeVBxQVNJQ1FaQUJUZ1IvUVFFRkkra0JJZ0JCK0FJai93RjBJZ0ZPQkg5QkFnVkJBMEVBSUFBZ0FVNGJDd3NpQUNQZUFVY0VRRUhCL2dNUUN5MEFBQ0VESUFBazNnRkJBQ0VCQWtBQ1FBSkFBa0FnQUNJQ0JFQWdBa0VCYXc0REFRSURCQXNnQTBGOGNTSURRUWh4UVFCSElRRU1Bd3NnQTBGOWNVRUJjaUlEUVJCeFFRQkhJUUVNQWdzZ0EwRitjVUVDY2lJRFFTQnhRUUJISVFFTUFRc2dBMEVEY2lFREN5QUJCRUJCQVNTK0FVRUJFQ2tMSUFKRkJFQWorUUVFUUNQN0FTUDhBU1A2QVNJQlFSQklCSDhnQVFWQkVBc2lBQkJGSUFBait3RnFKUHNCSUFBai9BRnFKUHdCSUFFZ0FHc2lBQ1Q2QVNBQVFRQk1CRUJCQUNUNUFVSFYvZ01RQzBIL0FUb0FBQVZCMWY0REVBc2dBRUVFZFVFQmEwSC9mbkU2QUFBTEN3c2dBa0VCUmdSQVFRRWt2UUZCQUJBcEN5QUNJQU1RUmlFQVFjSCtBeEFMSUFBNkFBQUZJQUpCbVFGR0JFQWdBRUhCL2dNUUN5MEFBQkJHSVFCQndmNERFQXNnQURvQUFBc0xDNEFDQVFOL0krQUJCRUFnQUNQcEFXb2s2UUVqTmlFREEwQWo2UUZCQkNQL0FTSUFkRUhJQXlBQWRDUHFBVUdaQVVZYlRnUkFJK2tCUVFRai93RWlBSFJCeUFNZ0FIUWo2Z0VpQVVHWkFVWWJheVRwQVNBQlFaQUJSZ1JBSUFNRVFFRUFJUUFEUUNBQVFaQUJUQVJBSUFCQi93RnhFQ2dnQUVFQmFpRUFEQUVMQ3dVZ0FSQW9DMEVBSVFBRFFDQUFRWkFCU0FSQVFRQWhBZ05BSUFKQm9BRklCRUFnQWlBQVFhQUJiR3BCZ0pFRWFrRUFPZ0FBSUFKQkFXb2hBZ3dCQ3dzZ0FFRUJhaUVBREFFTEMwRi9KRWRCZnlSSUJTQUJRWkFCU0FSQUlBTkZCRUFnQVJBb0N3c0xRUUFnQVVFQmFpQUJRWmtCU2hzazZnRU1BUXNMQ3hCSEM4WUJBUU4vSTg0QlJRUkFEd3NEUUNBRElBQklCRUFnQTBFRWFpRURBbjhqeXdFaUFrRUVhaUlCUWYvL0Ewb0VRQ0FCUVlDQUJHc2hBUXNnQVFza3l3RWdBa0VCUVFKQkJ5UE5BUnNpQW5SeEJIOGdBVUVCSUFKMGNVVUZRUUFMQkVCQmdmNERFQXN0QUFCQkFYUkJBV3BCL3dGeElRRkJnZjRERUFzZ0FUb0FBQ1BNQVVFQmFpSUJRUWhHQkVCQkFDVE1BVUVCSk1BQlFRTVFLVUdDL2dNUUN5MEFBRUgvZm5FaEFVR0MvZ01RQ3lBQk9nQUFRUUFremdFRklBRWt6QUVMQ3d3QkN3c0wzQUVCQVg4aitBRkJBRW9FUUNBQUkvZ0JhaUVBUVFBaytBRUxJQUFqaWdKcUpJb0NJNDRDUlFSQUl6UUVRQ0FBSStnQmFpVG9BVUVFSS84QklnRjBRY2dESUFGMEkrb0JRWmtCUmhzaEFRTkFJK2dCSUFGT0JFQWdBUkJJSStnQklBRnJKT2dCREFFTEN3VWdBQkJJQ3lNekJFQWdBQ09rQVdva3BBRVFNd1VnQUJBclJVRUFJemNiQkVBZ0FCQXhCU0FBRURJTEN5QUFFRWtMSXpVRVFDQUFJOElCYWlUQ0FTUENBUkJCUVFBa3dnRUZJQUFRUVFzZ0FDT1JBbW9pQUNPUEFrNEVmeU9RQWtFQmFpU1FBaUFBSTQ4Q2F3VWdBQXNra1FJTExBRUJmMEVFRUVvamlRSkJBV3BCLy84RGNSQUxMUUFBUVFoMElRQkJCQkJLSUFBamlRSVFDeTBBQUhJTFB3RUJmeUFCUVlEK0EzRkJDSFloQWlBQUlBRkIvd0Z4SWdFUVF3UkFJQUFRQ3lBQk9nQUFDeUFBUVFGcUlnQWdBaEJEQkVBZ0FCQUxJQUk2QUFBTEM4WUJBQ0FDQkVBZ0FTQUFRZi8vQTNFaUFITWdBQ0FCYW5NaUFFRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRWUFDY1VFQVIwRUFTd1JBSTRjQ1FSQnlRZjhCY1NTSEFnVWpod0pCN3dGeEpJY0NDd1VnQUNBQmFrSC8vd054SWdJZ0FFSC8vd054U1VFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUNJQUFnQVhOelFZQWdjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N3c0xtZ2dCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUE0UUV3QUJBZ01FQlFZSENBa0tDd3dORGc4TEVFdEIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2dRSWdBRUgvQVhFa2dnSU1Ed3NqZ2dKQi93RnhJNEVDUWY4QmNVRUlkSEloQUNPQUFpRUJRUVFRU2lBQUlBRVFSQXdSQ3lPQ0FrSC9BWEVqZ1FKQi93RnhRUWgwY2tFQmFrSC8vd054SVFBTUVRc2pnUUlpQUVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGcVFmOEJjU0lBSklFQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJTUR3dEJBU09CQWlJQVFROXhTMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnJRZjhCY1NJQUpJRUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDREE0TFFRUVFTaU9KQWhBTExRQUFKSUVDREFzTEk0QUNJZ0JCZ0FGeFFZQUJSa0VBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3lBQVFRRjBJQUJCL3dGeFFRZDJja0gvQVhFa2dBSU1Dd3NRUzBILy93TnhJUUFqaUFJaEFVRUlFRW9nQUNBQkVFd01DQXNqaGdKQi93RnhJNFVDUWY4QmNVRUlkSElpQUNPQ0FrSC9BWEVqZ1FKQi93RnhRUWgwY2lJQlFRQVFUU0FBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgySklVQ0lBQkIvd0Z4SklZQ0k0Y0NRYjhCY1NTSEFrRUlEd3NqZ2dKQi93RnhJNEVDUWY4QmNVRUlkSEloQUVFRUVFb2dBQkEzUWY4QmNTU0FBZ3dKQ3lPQ0FrSC9BWEVqZ1FKQi93RnhRUWgwY2tFQmEwSC8vd054SVFBTUNRc2pnZ0lpQUVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGcVFmOEJjU0lBSklJQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJTUJ3dEJBU09DQWlJQVFROXhTMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnJRZjhCY1NJQUpJSUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDREFZTFFRUVFTaU9KQWhBTExRQUFKSUlDREFNTEk0QUNJZ0JCQVhGQkFFdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQUVFSGRDQUFRZjhCY1VFQmRuSkIvd0Z4SklBQ0RBTUxRWDhQQ3lPSkFrRUNha0gvL3dOeEpJa0NEQUlMSTRrQ1FRRnFRZi8vQTNFa2lRSU1BUXNqaHdKQi93QnhKSWNDSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJTFFRUVBDeUFBUVlEK0EzRkJDSFlrZ1FJZ0FFSC9BWEVrZ2dKQkNBdnlDQUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVJCckRoQUFBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2ovZ0VFUUVFRUVFcEJ6ZjRERURkQi93RnhJZ0FoQVNBQVFRRnhCRUFnQVVGK2NTSUFRWUFCY1FSL1FRQWsvd0VnQUVIL2ZuRUZRUUVrL3dFZ0FFR0FBWElMSVFCQkJCQktRYzMrQXlBQUVFUkJ4QUFQQ3d0QkFTU09BZ3dRQ3hCTFFmLy9BM0VpQUVHQS9nTnhRUWgySklNQ0lBQkIvd0Z4SklRQ0k0a0NRUUpxUWYvL0EzRWtpUUlNRVFzamhBSkIvd0Z4STRNQ1FmOEJjVUVJZEhJaEFDT0FBaUVCUVFRUVNpQUFJQUVRUkF3UUN5T0VBa0gvQVhFamd3SkIvd0Z4UVFoMGNrRUJha0gvL3dOeElRQU1FQXNqZ3dJaUFFRVBjVUVCYWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnFRZjhCY1NTREFpT0RBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFnd09DMEVCSTRNQ0lnQkJEM0ZMUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBQkJBV3RCL3dGeEpJTUNJNE1DUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd3TkMwRUVFRW9qaVFJUUN5MEFBQ1NEQWd3S0N5T0FBaUlCUVlBQmNVR0FBVVloQUNPSEFrRUVka0VCY1NBQlFRRjBja0gvQVhFa2dBSU1DZ3RCQkJCS0k0a0NFQXN0QUFBaEFDT0pBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2lRSkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SWdBamhBSkIvd0Z4STRNQ1FmOEJjVUVJZEhJaUFVRUFFRTBnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FpT0hBa0cvQVhFa2h3SkJDQThMSTRRQ1FmOEJjU09EQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtnQUlNQ0FzamhBSkIvd0Z4STRNQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NFQURBZ0xJNFFDSWdCQkQzRkJBV3BCRUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmFrSC9BWEVpQUNTRUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0RBWUxRUUVqaEFJaUFFRVBjVXRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJhMEgvQVhFaUFDU0VBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd3RkMwRUVFRW9qaVFJUUN5MEFBQ1NFQWd3Q0N5T0FBaUlCUVFGeElRQWpod0pCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SklBQ0RBSUxRWDhQQ3lPSkFrRUJha0gvL3dOeEpJa0NEQUVMSUFCQkFFb0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2pod0pCL3dCeEpJY0NJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lMUVFRUEN5QUFRWUQrQTNGQkNIWWtnd0lnQUVIL0FYRWtoQUpCQ0F1TkNnRUNmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRWdhdzRRQUFFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTRjQ1FRZDJRUUZ4QkVBamlRSkJBV3BCLy84RGNTU0pBZ1ZCQkJCS0k0a0NFQXN0QUFBaEFDT0pBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2lRSUxRUWdQQ3hCTFFmLy9BM0VpQUVHQS9nTnhRUWgySklVQ0lBQkIvd0Z4SklZQ0k0a0NRUUpxUWYvL0EzRWtpUUlNRUFzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFDT0FBaUVCUVFRUVNpQUFJQUVRUkNBQVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMkpJVUNJQUJCL3dGeEpJWUNEQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5UVFGcVFmLy9BM0VoQUF3UEN5T0ZBaUlBUVE5eFFRRnFRUkJ4UVFCSFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxJQUJCQVdwQi93RnhJZ0FraFFJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWd3TkMwRUJJNFVDSWdCQkQzRkxRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMSUFCQkFXdEIvd0Z4SWdBa2hRSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRY0FBY2tIL0FYRWtod0lNREF0QkJCQktJNGtDRUFzdEFBQWtoUUlNQ2d0QkJrRUFJNGNDSWdKQkJYWkJBWEZCQUVzYklnQkI0QUJ5SUFBZ0FrRUVka0VCY1VFQVN4c2hBU09BQWlFQUlBSkJCblpCQVhGQkFFc0VmeUFBSUFGclFmOEJjUVVnQVVFR2NpQUJJQUJCRDNGQkNVc2JJZ0ZCNEFCeUlBRWdBRUdaQVVzYklnRWdBR3BCL3dGeEN5SUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzZ0FVSGdBSEZCQUVkQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2pod0pCM3dGeEpJY0NJQUFrZ0FJTUNnc2pod0pCQjNaQkFYRkJBRXNFUUVFRUVFb2ppUUlRQ3kwQUFDRUFJNGtDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU0pBZ1VqaVFKQkFXcEIvLzhEY1NTSkFndEJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SWdBZ0FFRUFFRTBnQUVFQmRFSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FpT0hBa0cvQVhFa2h3SkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtnQUlnQUVFQmFrSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0Fnd0hDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBja0VCYTBILy93TnhJUUFNQndzamhnSWlBRUVQY1VFQmFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZxUWY4QmNTSUFKSVlDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lNQlF0QkFTT0dBaUlBUVE5eFMwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGclFmOEJjU0lBSklZQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrSEFBSEpCL3dGeEpJY0NEQVFMUVFRUVNpT0pBaEFMTFFBQUpJWUNEQUlMSTRBQ1FYOXpRZjhCY1NTQUFpT0hBa0hBQUhKQi93RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd0NDMEYvRHdzamlRSkJBV3BCLy84RGNTU0pBZ3RCQkE4TElBQkJnUDREY1VFSWRpU0ZBaUFBUWY4QmNTU0dBa0VJQzZRSkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFd2F3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJNGNDUVFSMlFRRnhCRUFqaVFKQkFXcEIvLzhEY1NTSkFnVkJCQkJLSTRrQ0VBc3RBQUFoQUNPSkFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VraVFJTFFRZ1BDeEJMUWYvL0EzRWtpQUlqaVFKQkFtcEIvLzhEY1NTSkFnd1FDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBSTRBQ0lRRkJCQkJLSUFBZ0FSQkVJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFlraFFJZ0FFSC9BWEVraGdJTUR3c2ppQUpCQVdwQi8vOERjU1NJQWtFSUR3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVvZ0FFSC8vd054SWdBUU55SUJRUTl4UVFGcVFSQnhRUUJIUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBRkJBV3BCL3dGeElnRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdKQkJCQktJQUFnQVJCRURBMExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCS1FRRWdBRUgvL3dOeElnQVFOeUlCUVE5eFMwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFCUVFGclFmOEJjU0lCUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWtFRUVFb2dBQ0FCRUVRTURBc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVvamlRSVFDeTBBQUNFQlFRUVFTaUFBUWYvL0EzRWdBVUgvQVhFUVJBd0tDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FSQnlRZjhCY1NTSEFnd0tDeU9IQWtFRWRrRUJjUVJBUVFRUVNpT0pBaEFMTFFBQUlRQWppUUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJa0NCU09KQWtFQmFrSC8vd054SklrQ0MwRUlEd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSElpQUNPSUFrRUFFRTBnQUNPSUFtcEIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2hRSWdBRUgvQVhFa2hnSWpod0pCdndGeEpJY0NRUWdQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTaUFBRURkQi93RnhKSUFDSUFCQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2hRSWdBRUgvQVhFa2hnSU1Cd3NqaUFKQkFXdEIvLzhEY1NTSUFrRUlEd3NqZ0FJaUFFRVBjVUVCYWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnFRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SU1CUXRCQVNPQUFpSUFRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZyUWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtIQUFISkIvd0Z4SkljQ0RBUUxRUVFRU2lPSkFoQUxMUUFBSklBQ0RBSUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lqaHdKQkJIWkJBWEZCQUUxQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc01BZ3RCZnc4TEk0a0NRUUZxUWYvL0EzRWtpUUlMUVFRTCtRRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRkFhZzRRRHdBQkFnTUVCUVlIRHdnSkNnc01EUTRMSTRJQ0pJRUNEQTRMSTRNQ0pJRUNEQTBMSTRRQ0pJRUNEQXdMSTRVQ0pJRUNEQXNMSTRZQ0pJRUNEQW9MSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtnUUlNQ1FzamdBSWtnUUlNQ0FzamdRSWtnZ0lNQndzamd3SWtnZ0lNQmdzamhBSWtnZ0lNQlFzamhRSWtnZ0lNQkFzamhnSWtnZ0lNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUJBM1FmOEJjU1NDQWd3Q0N5T0FBaVNDQWd3QkMwRi9Ed3RCQkF2NkFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFhdzRRQUFFUEFnTUVCUVlIQ0FrUENnc01EUTRMSTRFQ0pJTUNEQTRMSTRJQ0pJTUNEQTBMSTRRQ0pJTUNEQXdMSTRVQ0pJTUNEQXNMSTRZQ0pJTUNEQW9MSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtnd0lNQ1FzamdBSWtnd0lNQ0FzamdRSWtoQUlNQndzamdnSWtoQUlNQmdzamd3SWtoQUlNQlFzamhRSWtoQUlNQkFzamhnSWtoQUlNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUJBM1FmOEJjU1NFQWd3Q0N5T0FBaVNFQWd3QkMwRi9Ed3RCQkF2NkFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFlQUFhdzRRQUFFQ0F3OEVCUVlIQ0FrS0N3OE1EUTRMSTRFQ0pJVUNEQTRMSTRJQ0pJVUNEQTBMSTRNQ0pJVUNEQXdMSTRRQ0pJVUNEQXNMSTRZQ0pJVUNEQW9MSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtoUUlNQ1FzamdBSWtoUUlNQ0FzamdRSWtoZ0lNQndzamdnSWtoZ0lNQmdzamd3SWtoZ0lNQlFzamhBSWtoZ0lNQkFzamhRSWtoZ0lNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUJBM1FmOEJjU1NHQWd3Q0N5T0FBaVNHQWd3QkMwRi9Ed3RCQkF2YUF3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUdzT0VBQUJBZ01FQlFZSENBa0tDd3dORGhBUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFJNEVDSVFGQkJCQktJQUFnQVJCRURBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUFqZ2dJaEFVRUVFRW9nQUNBQkVFUU1EZ3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUNPREFpRUJRUVFRU2lBQUlBRVFSQXdOQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQUk0UUNJUUZCQkJCS0lBQWdBUkJFREF3TEk0WUNRZjhCY1NPRkFpSUFRZjhCY1VFSWRISWhBVUVFRUVvZ0FTQUFFRVFNQ3dzamhnSWlBRUgvQVhFamhRSkIvd0Z4UVFoMGNpRUJRUVFRU2lBQklBQVFSQXdLQ3lQNUFVVUVRQUpBSTdRQkJFQkJBU1NMQWd3QkN5TzJBU084QVhGQkgzRkZCRUJCQVNTTUFnd0JDMEVCSkkwQ0N3c01DUXNqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUNPQUFpRUJRUVFRU2lBQUlBRVFSQXdJQ3lPQkFpU0FBZ3dIQ3lPQ0FpU0FBZ3dHQ3lPREFpU0FBZ3dGQ3lPRUFpU0FBZ3dFQ3lPRkFpU0FBZ3dEQ3lPR0FpU0FBZ3dDQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTaUFBRURkQi93RnhKSUFDREFFTFFYOFBDMEVFQzZRQ0FRVi9JNEFDSWdNaEJDQUFRZjhCY1NJQklRSWdBVUVBVHdSQUlBUkJEM0VnQWtFUGNXcEJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc0ZJQUpCSDNZaUJTQUNJQVZxYzBFUGNTQUVRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N3c2dBVUVBVHdSQUlBTkIvd0Z4SUFFZ0EycEIvd0Z4UzBFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N3VWdBVUVmZGlJQ0lBRWdBbXB6SUFOQi93RnhTa0VBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3dzZ0FDQURha0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NDNjhCQVFKL0lBQWpnQUlpQVdvamh3SkJCSFpCQVhGcVFmOEJjU0lDSUFBZ0FYTnpRUkJ4UVFCSFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxJQUVnQUVIL0FYRnFJNGNDUVFSMlFRRnhha0dBQW5GQkFFdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWlTQUFpQUNSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0MvZ0JBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVlBQmF3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJNEVDRUZZTUVBc2pnZ0lRVmd3UEN5T0RBaEJXREE0TEk0UUNFRllNRFFzamhRSVFWZ3dNQ3lPR0FoQldEQXNMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTnhCV0RBb0xJNEFDRUZZTUNRc2pnUUlRVnd3SUN5T0NBaEJYREFjTEk0TUNFRmNNQmdzamhBSVFWd3dGQ3lPRkFoQlhEQVFMSTRZQ0VGY01Bd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUVFRUVFb2dBQkEzRUZjTUFnc2pnQUlRVnd3QkMwRi9Ed3RCQkF1ckFnRUZmeU9BQWlJRElRUkJBQ0FBUWY4QmNXc2lBU0VDSUFGQkFFNEVRQ0FFUVE5eElBSkJEM0ZxUVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMQlNBQ1FSOTFJZ1VnQWlBRmFuTkJEM0VnQkVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NMSUFGQkFFNEVRQ0FEUWY4QmNTQUJJQU5xUWY4QmNVdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NGSUFGQkgzVWlBaUFCSUFKcWN5QURRZjhCY1VwQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0xJQU1nQUd0Qi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SUxzd0VCQW44amdBSWlBU0FBYXlPSEFrRUVka0VCY1d0Qi93RnhJZ0lnQUNBQmMzTkJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBU0FBUWY4QmNXc2pod0pCQkhaQkFYRnJRWUFDY1VFQVMwRUFTd1JBSTRjQ1FSQnlRZjhCY1NTSEFnVWpod0pCN3dGeEpJY0NDeUFDSklBQ0lBSkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrSEFBSEpCL3dGeEpJY0NDL2dCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFaQUJhdzRRQUFFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTRFQ0VGa01FQXNqZ2dJUVdRd1BDeU9EQWhCWkRBNExJNFFDRUZrTURRc2poUUlRV1F3TUN5T0dBaEJaREFzTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJLSUFBUU54QlpEQW9MSTRBQ0VGa01DUXNqZ1FJUVdnd0lDeU9DQWhCYURBY0xJNE1DRUZvTUJnc2poQUlRV2d3RkN5T0ZBaEJhREFRTEk0WUNFRm9NQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUJBM0VGb01BZ3NqZ0FJUVdnd0JDMEYvRHd0QkJBdm5DUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHZ0FXc09FQUFCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9CQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd1FDeU9DQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd1BDeU9EQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd09DeU9FQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd05DeU9GQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd01DeU9HQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd0xDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNpQUFFRGNqZ0FKeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdJTUNnc2pnQUlpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRU0J5UWY4QmNTU0hBZ3dKQ3lPQkFpT0FBbk5CL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lNQ0FzamdnSWpnQUp6UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDREFjTEk0TUNJNEFDYzBIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWd3R0N5T0VBaU9BQW5OQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJTUJRc2poUUlqZ0FKelFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0RBUUxJNFlDSTRBQ2MwSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFnd0RDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNpQUFFRGNqZ0FKelFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0RBSUxRUUFrZ0FJamh3SkJnQUZ5UWY4QmNTU0hBaU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDREFFTFFYOFBDeU9IQWtIdkFYRWtod0pCQkF1Z0FnRUVmeU9BQWlJQ0lRTkJBQ0FBUWY4QmNXc2lBQ0VCSUFCQkFFNEVRQ0FEUVE5eElBRkJEM0ZxUVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMQlNBQlFSOTFJZ1FnQVNBRWFuTkJEM0VnQTBFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NMSUFCQkFFNEVRQ0FDUWY4QmNTQUFJQUpxUWY4QmNVdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NGSUFCQkgzVWlBU0FBSUFGcWN5QUNRZjhCY1VwQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0xJQUFnQW1wRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtIQUFISkIvd0Z4SkljQ0M4d0dBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWJBQmF3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJNEVDSTRBQ2NrSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpT0hBa0h2QVhFa2h3SU1FQXNqZ2dJamdBSnlRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJNGNDUWU4QmNTU0hBZ3dQQ3lPREFpT0FBbkpCL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lqaHdKQjd3RnhKSWNDREE0TEk0UUNJNEFDY2tIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTURRc2poUUlqZ0FKeVFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd01DeU9HQWlPQUFuSkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQXNMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTnlPQUFuSkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQW9MSTRBQ1FmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd0pDeU9CQWhCZERBZ0xJNElDRUYwTUJ3c2pnd0lRWFF3R0N5T0VBaEJkREFVTEk0VUNFRjBNQkFzamhnSVFYUXdEQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTaUFBRURjUVhRd0NDeU9BQWhCZERBRUxRWDhQQzBFRUMwVUJBbjhnQUJBMklnRkJmMFlFZnlBQUVBc3RBQUFGSUFFTFFmOEJjU0VDSUFJZ0FFRUJhaUlCRURZaUFFRi9SZ1IvSUFFUUN5MEFBQVVnQUF0Qi93RnhRUWgwY2d2NUVRRUZmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVFkeElnVU9DQUFCQWdNRUJRWUhDQXNqZ1FJaEFRd0hDeU9DQWlFQkRBWUxJNE1DSVFFTUJRc2poQUloQVF3RUN5T0ZBaUVCREFNTEk0WUNJUUVNQWdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFVRUVFRW9nQVJBM0lRRU1BUXNqZ0FJaEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMklnUU9FQUFCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeUFBUVFkTUJIOGdBVUdBQVhGQmdBRkdRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSUFGQkFYUWdBVUgvQVhGQkIzWnlRZjhCY1NJQ1JVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWtFQkJTQUFRUTlNQkg4Z0FVRUJjVUVBUzBFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUJRUWQwSUFGQi93RnhRUUYyY2tIL0FYRWlBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SkJBUVZCQUFzTElRTU1Ed3NnQUVFWFRBUi9JNGNDUVFSMlFRRnhJQUZCQVhSeVFmOEJjU0VDSUFGQmdBRnhRWUFCUmtFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUNSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFrRUJCU0FBUVI5TUJIOGpod0pCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SVFJZ0FVRUJjVUVBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3lBQ1JVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWtFQkJVRUFDd3NoQXd3T0N5QUFRU2RNQkg4Z0FVRUJkRUgvQVhFaEFpQUJRWUFCY1VHQUFVWkJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWtWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0pCQVFVZ0FFRXZUQVIvSUFGQkFYRWhBQ0FCUWY4QmNVRUJkaUlDUVlBQmNpQUNJQUZCZ0FGeFFZQUJSaHNpQWtIL0FYRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0lBQkJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3RCQVFWQkFBc0xJUU1NRFFzZ0FFRTNUQVIvSUFGQkQzRkJCSFFnQVVId0FYRkJCSFp5SWdKRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWtFQkJTQUFRVDlNQkg4Z0FVSC9BWEZCQVhZaUFrVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJZ0FVRUJjVUVBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQzBFQkJVRUFDd3NoQXd3TUN5QUFRY2NBVEFSL0lBRWlBa0VCY1VWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdKQkFRVWdBRUhQQUV3RWZ5QUJJZ0pCQW5GRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQklISkIvd0Z4SkljQ1FRRUZRUUFMQ3lFRERBc0xJQUJCMXdCTUJIOGdBU0lDUVFSeFJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFrRUJCU0FBUWQ4QVRBUi9JQUVpQWtFSWNVVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SkJBUVZCQUFzTElRTU1DZ3NnQUVIbkFFd0VmeUFCSWdKQkVIRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NRUUVGSUFCQjd3Qk1CSDhnQVNJQ1FTQnhSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRU0J5UWY4QmNTU0hBa0VCQlVFQUN3c2hBd3dKQ3lBQVFmY0FUQVIvSUFFaUFrSEFBSEZGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCSUhKQi93RnhKSWNDUVFFRklBQkIvd0JNQkg4Z0FTSUNRWUFCY1VWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdKQkFRVkJBQXNMSVFNTUNBc2dBRUdIQVV3RWYwRUJJUU1nQVVGK2NRVWdBRUdQQVV3RWYwRUJJUU1nQVVGOWNRVkJBQXNMSVFJTUJ3c2dBRUdYQVV3RWYwRUJJUU1nQVVGN2NRVWdBRUdmQVV3RWYwRUJJUU1nQVVGM2NRVkJBQXNMSVFJTUJnc2dBRUduQVV3RWYwRUJJUU1nQVVGdmNRVWdBRUd2QVV3RWYwRUJJUU1nQVVGZmNRVkJBQXNMSVFJTUJRc2dBRUczQVV3RWYwRUJJUU1nQVVHL2YzRUZJQUJCdndGTUJIOUJBU0VESUFGQi8zNXhCVUVBQ3dzaEFnd0VDeUFBUWNjQlRBUi9RUUVoQXlBQlFRRnlCU0FBUWM4QlRBUi9RUUVoQXlBQlFRSnlCVUVBQ3dzaEFnd0RDeUFBUWRjQlRBUi9RUUVoQXlBQlFRUnlCU0FBUWQ4QlRBUi9RUUVoQXlBQlFRaHlCVUVBQ3dzaEFnd0NDeUFBUWVjQlRBUi9RUUVoQXlBQlFSQnlCU0FBUWU4QlRBUi9RUUVoQXlBQlFTQnlCVUVBQ3dzaEFnd0JDeUFBUWZjQlRBUi9RUUVoQXlBQlFjQUFjZ1VnQUVIL0FVd0VmMEVCSVFNZ0FVR0FBWElGUVFBTEN5RUNDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FGRGdnQUFRSURCQVVHQndnTElBSWtnUUlNQndzZ0FpU0NBZ3dHQ3lBQ0pJTUNEQVVMSUFJa2hBSU1CQXNnQWlTRkFnd0RDeUFDSklZQ0RBSUxRUUVnQkVFSFN5QUVRUVJKR3dSQUk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJLSUFBZ0FoQkVDd3dCQ3lBQ0pJQUNDMEVFUVg4Z0F4c0xsZ1VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFXc09FQUFCQWhFREJBVUdCd2dKQ2dzTURRNFBDeU9IQWtFSGRrRUJjUTBSREJNTEk0Z0NJUUJCQ0JCS0lBQVFYMEgvL3dOeElRQWppQUpCQW1wQi8vOERjU1NJQWlBQVFZRCtBM0ZCQ0hZa2dRSWdBRUgvQVhFa2dnSkJCQThMSTRjQ1FRZDJRUUZ4UlEwT0RBMExJNGNDUVFkMlFRRnhEUXdqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNGtDUVFKcVFmLy9BM0VoQVVFSUVFb2dBQ0FCRUV3TURRc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0SUNRZjhCY1NPQkFrSC9BWEZCQ0hSeUlRRkJDQkJLSUFBZ0FSQk1EQTBMUVFRUVNpT0pBaEFMTFFBQUVGWU1EUXNqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNGtDSVFGQkNCQktJQUFnQVJCTVFRQWtpUUlNQ3dzamh3SkJCM1pCQVhGRkRRb01EQXNqaUFJaEFFRUlFRW9nQUJCZlFmLy9BM0VraVFJZ0FFRUNha0gvL3dOeEpJZ0NEQWtMSTRjQ1FRZDJRUUZ4RFFjTUJndEJCQkJLSTRrQ0VBc3RBQUFRWUNFQUk0a0NRUUZxUWYvL0EzRWtpUUlnQUE4TEk0Y0NRUWQyUVFGeFJRMEVJNGdDUVFKclFmLy9BM0VpQUNTSUFpT0pBa0VDYWtILy93TnhJUUZCQ0JCS0lBQWdBUkJNREFVTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFrRUNha0gvL3dOeElRRkJDQkJLSUFBZ0FSQk1EQVFMUVFRUVNpT0pBaEFMTFFBQUVGY01CUXNqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNGtDSVFGQkNCQktJQUFnQVJCTVFRZ2tpUUlNQXd0QmZ3OExJNGtDUVFKcVFmLy9BM0VraVFKQkRBOExFRXRCLy84RGNTU0pBZ3RCQ0E4TEk0a0NRUUZxUWYvL0EzRWtpUUpCQkE4TEk0Z0NJUUJCQ0JCS0lBQVFYMEgvL3dOeEpJa0NJQUJCQW1wQi8vOERjU1NJQWtFTUM4b0VBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBV3NPRUFBQkFnMERCQVVHQndnSkRRb05Dd3dOQ3lPSEFrRUVka0VCY1EwUERCRUxJNGdDSVFCQkNCQktJQUFRWDBILy93TnhJUUVnQUVFQ2FrSC8vd054SklnQ0lBRkJnUDREY1VFSWRpU0RBaUFCUWY4QmNTU0VBa0VFRHdzamh3SkJCSFpCQVhGRkRRd01Dd3NqaHdKQkJIWkJBWEVOQ2lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFKQkFtcEIvLzhEY1NFQlFRZ1FTaUFBSUFFUVRBd0xDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWpoQUpCL3dGeEk0TUNRZjhCY1VFSWRISWhBVUVJRUVvZ0FDQUJFRXdNQ3d0QkJCQktJNGtDRUFzdEFBQVFXUXdMQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFJaEFVRUlFRW9nQUNBQkVFeEJFQ1NKQWd3SkN5T0hBa0VFZGtFQmNVVU5DQXdLQ3lPSUFpRUFRUWdRU2lBQUVGOUIvLzhEY1NTSkFrRUJKTFVCSUFCQkFtcEIvLzhEY1NTSUFnd0hDeU9IQWtFRWRrRUJjUTBGREFRTEk0Y0NRUVIyUVFGeFJRMERJNGdDUVFKclFmLy9BM0VpQUNTSUFpT0pBa0VDYWtILy93TnhJUUZCQ0JCS0lBQWdBUkJNREFRTFFRUVFTaU9KQWhBTExRQUFFRm9NQlFzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRrQ0lRRkJDQkJLSUFBZ0FSQk1RUmdraVFJTUF3dEJmdzhMSTRrQ1FRSnFRZi8vQTNFa2lRSkJEQThMRUV0Qi8vOERjU1NKQWd0QkNBOExJNGtDUVFGcVFmLy9BM0VraVFKQkJBOExJNGdDSVFCQkNCQktJQUFRWDBILy93TnhKSWtDSUFCQkFtcEIvLzhEY1NTSUFrRU1DNVFGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBV3NPRUFBQkFnc0xBd1FGQmdjSUN3c0xDUW9MQzBFRUVFb2ppUUlRQ3kwQUFDRUFJNEFDSVFGQkJCQktJQUJCL3dGeFFZRCtBMm9nQVJCRURBc0xJNGdDSVFCQkNCQktJQUFRWDBILy93TnhJUUVnQUVFQ2FrSC8vd054SklnQ0lBRkJnUDREY1VFSWRpU0ZBaUFCUWY4QmNTU0dBa0VFRHdzamdnSkJnUDREYWlFQUk0QUNJUUZCQkJCS0lBQWdBUkJFUVFRUEN5T0lBa0VDYTBILy93TnhJZ0FraUFJamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFVRUlFRW9nQUNBQkVFeEJDQThMUVFRUVNpT0pBaEFMTFFBQUk0QUNjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NJNGNDUWU4QmNTU0hBZ3dIQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFJaEFVRUlFRW9nQUNBQkVFeEJJQ1NKQWtFSUR3dEJCQkJLSTRrQ0VBc3NBQUFoQUNPSUFpQUFRUUVRVFNBQUk0Z0Nha0gvL3dOeEpJZ0NJNGNDUWY4QWNTU0hBaU9IQWtHL0FYRWtod0lqaVFKQkFXcEIvLzhEY1NTSkFrRU1Ed3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSElraVFKQkJBOExFRXRCLy84RGNTRUFJNEFDSVFGQkJCQktJQUFnQVJCRUk0a0NRUUpxUWYvL0EzRWtpUUpCQkE4TFFRUVFTaU9KQWhBTExRQUFJNEFDYzBIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTUFnc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCS0lBQWdBUkJNUVNna2lRSkJDQThMUVg4UEN5T0pBa0VCYWtILy93TnhKSWtDUVFRTCtnUUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCYXc0UUFBRUNBdzBFQlFZSENBa0tEUTBMREEwTFFRUVFTaU9KQWhBTExRQUFJUUJCQkJCS0lBQkIvd0Z4UVlEK0Eyb1FOMEgvQVhFa2dBSU1EUXNqaUFJaEFFRUlFRW9nQUJCZlFmLy9BM0VoQVNBQVFRSnFRZi8vQTNFa2lBSWdBVUdBL2dOeFFRaDJKSUFDSUFGQi93RnhKSWNDREEwTEk0SUNRWUQrQTJvaEFFRUVFRW9nQUJBM1FmOEJjU1NBQWd3TUMwRUFKTFFCREFzTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSEFrSC9BWEVqZ0FKQi93RnhRUWgwY2lFQlFRZ1FTaUFBSUFFUVRFRUlEd3RCQkJCS0k0a0NFQXN0QUFBamdBSnlRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJNGNDUWU4QmNTU0hBZ3dJQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFJaEFVRUlFRW9nQUNBQkVFeEJNQ1NKQWtFSUR3dEJCQkJLSTRrQ0VBc3RBQUFoQUNPSEFrSC9BSEVraHdJamh3SkJ2d0Z4SkljQ0k0Z0NJZ0VnQUVFWWRFRVlkU0lBUVFFUVRTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDJKSVVDSUFCQi93RnhKSVlDSTRrQ1FRRnFRZi8vQTNFa2lRSkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SklnQ1FRZ1BDeEJMUWYvL0EzRWhBRUVFRUVvZ0FCQTNRZjhCY1NTQUFpT0pBa0VDYWtILy93TnhKSWtDREFVTFFRRWt0UUVNQkF0QkJCQktJNGtDRUFzdEFBQVFYUXdDQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFJaEFVRUlFRW9nQUNBQkVFeEJPQ1NKQWtFSUR3dEJmdzhMSTRrQ1FRRnFRZi8vQTNFa2lRSUxRUVFMdkFFQkFYOGppUUpCQVdwQi8vOERjU0lCUVFGclFmLy9BM0VnQVNPTkFoc2tpUUlDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRnNFBBQUVDQXdRRkJnY0lDUW9MREEwT0R3c2dBQkJPRHdzZ0FCQlBEd3NnQUJCUUR3c2dBQkJSRHdzZ0FCQlNEd3NnQUJCVER3c2dBQkJVRHdzZ0FCQlZEd3NnQUJCWUR3c2dBQkJiRHdzZ0FCQmNEd3NnQUJCZUR3c2dBQkJoRHdzZ0FCQmlEd3NnQUJCakR3c2dBQkJrQzdZQkFRSi9RUUFrdEFGQmovNERFQXN0QUFCQmZpQUFkM0VpQVNTOEFVR1AvZ01RQ3lBQk9nQUFJNGdDUVFKclFmLy9BM0VraUFJamlRSWhBU09JQWlJQ0VBc2dBVG9BQUNBQ1FRRnFFQXNnQVVHQS9nTnhRUWgyT2dBQUFrQUNRQUpBQWtBQ1FBSkFJQUFPQlFBQkFnTUVCUXRCQUNTOUFVSEFBQ1NKQWd3RUMwRUFKTDRCUWNnQUpJa0NEQU1MUVFBa3Z3RkIwQUFraVFJTUFndEJBQ1RBQVVIWUFDU0pBZ3dCQzBFQUpNRUJRZUFBSklrQ0N3dm5BUUVCZnlPMUFRUkFRUUVrdEFGQkFDUzFBUXNqdGdFanZBRnhRUjl4UVFCTEJFQWpqQUpGUVFBanRBRWJCSDhqdlFGQkFDTzNBUnNFZjBFQUVHWkJBUVVqdmdGQkFDTzRBUnNFZjBFQkVHWkJBUVVqdndGQkFDTzVBUnNFZjBFQ0VHWkJBUVVqd0FGQkFDTzZBUnNFZjBFREVHWkJBUVVqd1FGQkFDTzdBUnNFZjBFRUVHWkJBUVZCQUFzTEN3c0xCVUVBQ3dSL1FRRWpqQUlqaXdJYkJIOUJBQ1NNQWtFQUpJc0NRUUFralFKQkFDU09Ba0VZQlVFVUN3VkJBQXNoQUVFQkk0d0NJNHNDR3dSQVFRQWtqQUpCQUNTTEFrRUFKSTBDUVFBa2pnSUxJQUFQQzBFQUM2MEJBUUovUVFFa2xRSWpqUUlFUUNPSkFoQUxMUUFBRUdVUVNrRUFKSXdDUVFBa2l3SkJBQ1NOQWtFQUpJNENDeEJuSWdGQkFFb0VRQ0FCRUVvTFFRQWpqZ0pGUVFFampBSWppd0liR3dSL0k0a0NFQXN0QUFBUVpRVkJCQXNoQVNPSEFrSHdBWEVraHdJZ0FVRUFUQVJBSUFFUEN5QUJFRW9qbEFKQkFXb2lBQ09TQWs0RWZ5T1RBa0VCYWlTVEFpQUFJNUlDYXdVZ0FBc2tsQUlqaVFJajJnRkdCRUJCQVNUZEFRc2dBUXNGQUNPekFRdXBBUUVEZnlBQVFYOUJnQWdnQUVFQVNCc2dBRUVBU2hzaEFBTkFJOTBCUlVFQUlBRkZRUUJCQUNBQ1JTQURHeHNiQkVBUWFFRUFTQVJBUVFFaEF3VWppZ0pCMEtRRUkvOEJkRTRFUUVFQklRSUZRUUVnQVNPekFTQUFUa0VBSUFCQmYwb2JHeUVCQ3dzTUFRc0xJQUlFUUNPS0FrSFFwQVFqL3dGMGF5U0tBa0VBRHdzZ0FRUkFRUUVQQ3lQZEFRUkFRUUFrM1FGQkFnOExJNGtDUVFGclFmLy9BM0VraVFKQmZ3c0dBRUYvRUdvTE13RUNmd05BSUFGQkFFNUJBQ0FDSUFCSUd3UkFRWDhRYWlFQklBSkJBV29oQWd3QkN3c2dBVUVBU0FSQUlBRVBDMEVBQ3dVQUk0OENDd1VBSTVBQ0N3VUFJNUVDQy9FQkFRRi9RUUFramdJQ2Z3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFEZ2dBQVFJREJBVUdCd2dMSTg4QkRBZ0xJOUlCREFjTEk5QUJEQVlMSTlFQkRBVUxJOU1CREFRTEk5UUJEQU1MSTlVQkRBSUxJOVlCREFFTFFRQUxSU0VCQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBT0NBQUJBZ01FQlFZSENBdEJBU1RQQVF3SEMwRUJKTklCREFZTFFRRWswQUVNQlF0QkFTVFJBUXdFQzBFQkpOTUJEQU1MUVFFazFBRU1BZ3RCQVNUVkFRd0JDMEVCSk5ZQkN5QUJCRUJCQVNBQVFRTk1JZ0ZCQUNQWUFSc0VmMEVCQlVFQUN5QUJSVUVBSTlrQkd4c0VRRUVCSk1FQlFRUVFLUXNMQzVJQkFDQUFRUUJLQkVCQkFCQndCVUVBSk04QkN5QUJRUUJLQkVCQkFSQndCVUVBSk5JQkN5QUNRUUJLQkVCQkFoQndCVUVBSk5BQkN5QURRUUJLQkVCQkF4QndCVUVBSk5FQkN5QUVRUUJLQkVCQkJCQndCVUVBSk5NQkN5QUZRUUJLQkVCQkJSQndCVUVBSk5RQkN5QUdRUUJLQkVCQkJoQndCVUVBSk5VQkN5QUhRUUJLQkVCQkJ4QndCVUVBSk5ZQkN3c0hBQ0FBSk5vQkN3Y0FRWDhrMmdFTEJ3QWdBQ1RiQVFzSEFFRi9KTnNCQ3djQUlBQWszQUVMQndCQmZ5VGNBUXNGQUNPQUFnc0ZBQ09CQWdzRkFDT0NBZ3NGQUNPREFnc0ZBQ09FQWdzRkFDT0ZBZ3NGQUNPR0Fnc0ZBQ09IQWdzRkFDT0pBZ3NGQUNPSUFnc0tBQ09KQWhBTExRQUFDd1VBSStvQkM5UURBUWwvUVlDQUFrR0FrQUlqNHdFYklRUkJnTGdDUVlDd0FpUGtBUnNoQ1FOQUlBWkJnQUpJQkVCQkFDRUZBMEFnQlVHQUFrZ0VRQ0FKSUFaQkEzVkJCWFJxSUFWQkEzVnFJZ2RCZ0pCK2FpMEFBQ0VCSUFaQkNHOGhBa0VISUFWQkNHOXJJUWdnQkNBRVFZQ1FBa1lFZnlBQlFZQUJheUFCUVlBQmFpQUJRWUFCY1JzRklBRUxRUVIwYWlFRElBQkJBRXBCQUNQK0FSc0VmeUFIUVlEUWZtb3RBQUFGUVFBTElnRkJ3QUJ4QkVCQkJ5QUNheUVDQ3lBQlFRaHhSVVZCRFhRaUJ5QURJQUpCQVhScUlnTkJnSkIrYW1vdEFBQWhBaUFISUFOQmdaQithbW90QUFCQkFTQUlkSEVFZjBFQ0JVRUFDeUlEUVFGcUlBTWdBa0VCSUFoMGNSc2hBeUFGSUFaQkNIUnFRUU5zSVFJZ0FFRUFTa0VBSS80Qkd3UkFJQUpCZ0tFTGFpSUNJQUZCQjNGQkEzUWdBMEVCZEdvaUFVRUJha0UvY1VHQWtBUnFMUUFBUVFoMElBRkJQM0ZCZ0pBRWFpMEFBSElpQVVFZmNVRURkRG9BQUNBQ0lBRkI0QWR4UVFWMlFRTjBPZ0FCSUFJZ0FVR0ErQUZ4UVFwMlFRTjBPZ0FDQlNBQ1FZQ2hDMm9pQVNBRFFjZitBeEFpSWdOQmdJRDhCM0ZCRUhZNkFBQWdBU0FEUVlEK0EzRkJDSFk2QUFFZ0FTQURPZ0FDQ3lBRlFRRnFJUVVNQVFzTElBWkJBV29oQmd3QkN3c0wyUU1CQzM4RFFDQUNRUmRJQkVCQkFDRUZBMEFnQlVFZlNBUkFJQVZCRDBvaENTQUNJZ0ZCRDBvRWZ5QUJRUTlyQlNBQkMwRUVkQ0lCSUFWQkQydHFJQUVnQldvZ0JVRVBTaHNoQjBISC9nTWhDa0YvSVFOQkFDRUFBMEFnQUVFSVNBUkFRUUFoQkFOQUlBUkJCVWdFUUNBSElBQWdCRUVEZEdwQkFuUWlBVUdDL0FOcUVBc3RBQUJHQkVBZ0NTQUJRWVA4QTJvUUN5MEFBQ0lCUVFoeFFRQWovZ0ViUlVWR0JFQUNmMEVGSVFSQnlmNERRY2orQXlBQklnTkJFSEViSVFwQkNBc2hBQXNMSUFSQkFXb2hCQXdCQ3dzZ0FFRUJhaUVBREFFTEN5QURRUUJJUVFBai9nRWJCSDlCZ0xnQ1FZQ3dBaVBrQVJzaENFRi9JUUJCQUNFRUEwQWdCRUVnU0FSQVFRQWhCZ05BSUFaQklFZ0VRQ0FISUFRZ0NDQUdRUVYwYW1vaUFVR0FrSDVxTFFBQVJnUkFBbjlCSUNFRVFTQWhCaUFCQ3lFQUN5QUdRUUZxSVFZTUFRc0xJQVJCQVdvaEJBd0JDd3NnQUVFQVRnUi9JQUJCZ05CK2FpMEFBQVZCZndzRlFYOExJUUZCZ0pBQ1FZQ0FBaUFDUVE5S0d5RUlRUUFoQUFOQUlBQkJDRWdFUUNBSElBZ2dDVUVBUVFjZ0FDQUZRUU4wSUFBZ0FrRURkR3BCK0FGQmdLRVhJQW9nQVNBREVDTWFJQUJCQVdvaEFBd0JDd3NnQlVFQmFpRUZEQUVMQ3lBQ1FRRnFJUUlNQVFzTEM1Z0NBUWwvQTBBZ0JFRUlTQVJBUVFBaEFnTkFJQUpCQlVnRVFDQUVJQUpCQTNScVFRSjBJZ0ZCZ1B3RGFoQUxMUUFBR2lBQlFZSDhBMm9RQ3kwQUFCb2dBVUdDL0FOcUVBc3RBQUFoQUVFQklRVWo1UUVFUUFKL1FRSWhCU0FBUVFKdlFRRkdCSDhnQUVFQmF3VWdBQXNMSVFBTElBRkJnL3dEYWhBTExRQUFJZ1pCQ0hGQkFDUCtBUnRGUlNFSFFjbitBMEhJL2dNZ0JrRVFjUnNoQ0VFQUlRRURRQ0FCSUFWSUJFQkJBQ0VEQTBBZ0EwRUlTQVJBSUFBZ0FXcEJnSUFDSUFkQkFFRUhJQU1nQkVFRGRDQURJQUpCQkhScUlBRkJBM1JxUWNBQVFZQ2hJQ0FJUVg4Z0JoQWpHaUFEUVFGcUlRTU1BUXNMSUFGQkFXb2hBUXdCQ3dzZ0FrRUJhaUVDREFFTEN5QUVRUUZxSVFRTUFRc0xDd1VBSThNQkN3VUFJOFFCQ3dVQUk4Z0JDeElCQVg4anlnRWlBRUVFY2lBQUk4a0JHd3N1QVFGL0EwQWdBRUgvL3dOSUJFQWdBRUdBdGNrRWFpQUFFRGM2QUFBZ0FFRUJhaUVBREFFTEMwRUFKTjBCQzJVQVFmTGx5d2NrTzBHZ3dZSUZKRHhCMkxEaEFpUTlRWWlRSUNRK1FmTGx5d2NrUDBHZ3dZSUZKRUJCMkxEaEFpUkJRWWlRSUNSQ1FmTGx5d2NrUTBHZ3dZSUZKRVJCMkxEaEFpUkZRWWlRSUNSR1B3QkJsQUZJQkVCQmxBRS9BR3RBQUJvTEN3TUFBUXU4QVFFQ2Z5QUFLQUlFSWdKQi8vLy8vd0J4SVFFZ0FDZ0NBRUVCY1FSQVFRQkJnQWxCK2dCQkRoQUFBQXNnQVVFQlJnUkFBa0FDUUFKQUlBQW9BZ2dPQXdJQ0FBRUxJQUFvQWhBaUFRUkFJQUZCdkFsUEJFQWdBVUVRYXhDT0FRc0xEQUVMQUFzZ0FrR0FnSUNBZUhFRVFFRUFRWUFKUWY0QVFSSVFBQUFMSUFBZ0FDZ0NBRUVCY2pZQ0FDTUFJQUFRQWdVZ0FVRUFUUVJBUVFCQmdBbEJpQUZCRUJBQUFBc2dBQ0FCUVFGcklBSkJnSUNBZ0g5eGNqWUNCQXNMSEFBQ1FBSkFBa0FqbHdJT0FnRUNBQXNBQzBFQUlRQUxJQUFRYWdzZEFBSkFBa0FDUUNPWEFnNERBUUVDQUFzQUMwRi9JUUVMSUFFUWFnc0hBQ0FBSkpjQ0N3dS9BUVFBUVlBSUN5MGVBQUFBQVFBQUFBRUFBQUFlQUFBQWZnQnNBR2tBWWdBdkFISUFkQUF2QUhRQWJBQnpBR1lBTGdCMEFITUFRYkFJQ3pjb0FBQUFBUUFBQUFFQUFBQW9BQUFBWVFCc0FHd0Fid0JqQUdFQWRBQnBBRzhBYmdBZ0FIUUFid0J2QUNBQWJBQmhBSElBWndCbEFFSHdDQXN0SGdBQUFBRUFBQUFCQUFBQUhnQUFBSDRBYkFCcEFHSUFMd0J5QUhRQUx3QndBSFVBY2dCbEFDNEFkQUJ6QUVHZ0NRc1ZBd0FBQUNBQUFBQUFBQUFBSUFBQUFBQUFBQUFnQURNUWMyOTFjbU5sVFdGd2NHbHVaMVZTVENGamIzSmxMMlJwYzNRdlkyOXlaUzUxYm5SdmRXTm9aV1F1ZDJGemJTNXRZWEE9Iik6CmF3YWl0IE8oImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZlJCZ0FYOEJmMkFCZndCZ0FBRi9ZQUFBWUFKL2Z3Ri9ZQUovZndCZ0EzOS9md0JnQm45L2YzOS9md0JnQkg5L2YzOEFZQWQvZjM5L2YzOS9BR0FJZjM5L2YzOS9mMzhBWUFwL2YzOS9mMzkvZjM5L0FHQURmMzkvQVg5Z0JIOS9mMzhCZjJBRmYzOS9mMzhCZjJBTmYzOS9mMzkvZjM5L2YzOS9md0YvQWcwQkEyVnVkZ1ZoWW05eWRBQUlBNU1Ca1FFRkJRWUNCQVlNQkFBQkFBTUJBUU1EQXdzQ0F3TURBd01EQXdNREFnSUNBZzRFRHdrSEJ3VUJBUU1BQUFBQUFBMEJBUU1BQWdBQUJRTUJBUUVCQkFFQkFRRUVCUVlFQXdFQkFRSUZCZ0FBQUFBQUFBQUFBUUVBQVFFQUFBRUFBQUFBQUFBQUFBRUNBZ0lBQWdBQ0FnSUJDZ0VEQVFNQkF3SUNBZ0lDQWdJQ0FnSUNBZ0VEQXdJQ0FnSURBd01CQUFRQkJRTUJBQUVHM2d1WUFuOEJRUUFMZndGQkFBdC9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUVlDQUFRdC9BRUdBa0FFTGZ3QkJnSUFDQzM4QVFZQ1FBd3QvQUVHQWdBRUxmd0JCZ0JBTGZ3QkJnSUFFQzM4QVFZQ1FCQXQvQUVHQUFRdC9BRUdBa1FRTGZ3QkJnTGdCQzM4QVFZREpCUXQvQUVHQTJBVUxmd0JCZ0tFTEMzOEFRWUNBREF0L0FFR0FvUmNMZndCQmdJQUpDMzhBUVlDaElBdC9BRUdBK0FBTGZ3QkJnSkFFQzM4QVFZQ0pIUXQvQUVHQW1TRUxmd0JCZ0lBSUMzOEFRWUNaS1F0L0FFR0FnQWdMZndCQmdKa3hDMzhBUVlDQUNBdC9BRUdBbVRrTGZ3QkJnSUFJQzM4QVFZQ1p3UUFMZndCQmdJQUlDMzhBUVlDWnlRQUxmd0JCZ0lBSUMzOEFRWUNaMFFBTGZ3QkJnQlFMZndCQmdLM1JBQXQvQUVHQWlQZ0RDMzhBUVlDMXlRUUxmd0JCLy84REMzOEFRUUFMZndCQmdMWE5CQXQvQUVHVUFRdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVg4TGZ3RkJmd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCL3dBTGZ3RkIvd0FMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVg4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVHZ0NRdC9BVUVBQ3dmbUVHVUdiV1Z0YjNKNUFnQUhYMTloYkd4dll3QUlDRjlmY21WMFlXbHVBQWtKWDE5eVpXeGxZWE5sQUFvSlgxOWpiMnhzWldOMEFJMEJDMTlmY25SMGFWOWlZWE5sQTVZQ0JtTnZibVpwWndBU0RtaGhjME52Y21WVGRHRnlkR1ZrQUJNSmMyRjJaVk4wWVhSbEFCWUpiRzloWkZOMFlYUmxBQndGYVhOSFFrTUFIUkpuWlhSVGRHVndjMUJsY2xOMFpYQlRaWFFBSGd0blpYUlRkR1Z3VTJWMGN3QWZDR2RsZEZOMFpYQnpBQ0FWWlhobFkzVjBaVTExYkhScGNHeGxSbkpoYldWekFHd01aWGhsWTNWMFpVWnlZVzFsQUdzWlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYndDUEFSVmxlR1ZqZFhSbFZXNTBhV3hEYjI1a2FYUnBiMjRBa0FFTFpYaGxZM1YwWlZOMFpYQUFhQlJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFCdERHZGxkRU41WTJ4bFUyVjBjd0J1Q1dkbGRFTjVZMnhsY3dCdkRuTmxkRXB2ZVhCaFpGTjBZWFJsQUhFZloyVjBUblZ0WW1WeVQyWlRZVzF3YkdWelNXNUJkV1JwYjBKMVptWmxjZ0JwRUdOc1pXRnlRWFZrYVc5Q2RXWm1aWElBR0J4elpYUk5ZVzUxWVd4RGIyeHZjbWw2WVhScGIyNVFZV3hsZEhSbEFBMFhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0RExoTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeThTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXpBZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd0lhUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQXhaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd1FTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdVZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREREJ4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3MFNWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd1lPVmtsRVJVOWZVa0ZOWDFOSldrVURCeEZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01JRFZkUFVrdGZVa0ZOWDFOSldrVURDU1pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNS0lrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVREN4aEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0REdoUkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1iRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F3NFFSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTVBHRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTVFGRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXhFT1JsSkJUVVZmVEU5RFFWUkpUMDRERWdwR1VrRk5SVjlUU1ZwRkF4TVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REZCTkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeFVTVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhZT1ZFbE1SVjlFUVZSQlgxTkpXa1VERnhKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REdBNVBRVTFmVkVsTVJWTmZVMGxhUlFNWkZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01rRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXlVWlEwaEJUazVGVEY4eFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNY0ZVTklRVTVPUlV4Zk1WOUNWVVpHUlZKZlUwbGFSUU1kR1VOSVFVNU9SVXhmTWw5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESGhWRFNFRk9Ua1ZNWHpKZlFsVkdSa1ZTWDFOSldrVURIeGxEU0VGT1RrVk1Yek5mUWxWR1JrVlNYMHhQUTBGVVNVOU9BeUFWUTBoQlRrNUZURjh6WDBKVlJrWkZVbDlUU1ZwRkF5RVpRMGhCVGs1RlRGODBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWlGVU5JUVU1T1JVeGZORjlDVlVaR1JWSmZVMGxhUlFNakZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRESmhKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVREp4RkNUMDlVWDFKUFRWOU1UME5CVkVsUFRnTW9EVUpQVDFSZlVrOU5YMU5KV2tVREtSWkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXlvU1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5c2RSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRETEJsRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOVRTVnBGQXkwaFoyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQUFzYmMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFISWRjbVZ6WlhSUWNtOW5jbUZ0UTI5MWJuUmxja0p5WldGcmNHOXBiblFBY3hselpYUlNaV0ZrUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUhRYmNtVnpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFIVWFjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUFkaHh5WlhObGRGZHlhWFJsUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUhjTVoyVjBVbVZuYVhOMFpYSkJBSGdNWjJWMFVtVm5hWE4wWlhKQ0FIa01aMlYwVW1WbmFYTjBaWEpEQUhvTVoyVjBVbVZuYVhOMFpYSkVBSHNNWjJWMFVtVm5hWE4wWlhKRkFId01aMlYwVW1WbmFYTjBaWEpJQUgwTVoyVjBVbVZuYVhOMFpYSk1BSDRNWjJWMFVtVm5hWE4wWlhKR0FIOFJaMlYwVUhKdlozSmhiVU52ZFc1MFpYSUFnQUVQWjJWMFUzUmhZMnRRYjJsdWRHVnlBSUVCR1dkbGRFOXdZMjlrWlVGMFVISnZaM0poYlVOdmRXNTBaWElBZ2dFRloyVjBURmtBZ3dFZFpISmhkMEpoWTJ0bmNtOTFibVJOWVhCVWIxZGhjMjFOWlcxdmNua0FoQUVZWkhKaGQxUnBiR1ZFWVhSaFZHOVhZWE50VFdWdGIzSjVBSVVCRTJSeVlYZFBZVzFVYjFkaGMyMU5aVzF2Y25rQWhnRUdaMlYwUkVsV0FJY0JCMmRsZEZSSlRVRUFpQUVHWjJWMFZFMUJBSWtCQm1kbGRGUkJRd0NLQVJOMWNHUmhkR1ZFWldKMVowZENUV1Z0YjNKNUFJc0JGRjlmYzJWMFFYSm5kVzFsYm5SelRHVnVaM1JvQUpFQkNBS01BUXFTdkFLUkFaVUNBUVIvSUFFb0FnQWlBa0VCY1VVRVFFRUFRWkFJUVpVQ1FRNFFBQUFMSUFKQmZIRWlBa0h3Ly8vL0EwbEJBQ0FDUVJCUEcwVUVRRUVBUVpBSVFaY0NRUTRRQUFBTElBSkJnQUpKQkVBZ0FrRUVkaUVDQlNBQ1FSOGdBbWRySWdOQkJHdDJRUkJ6SVFJZ0EwRUhheUVEQ3lBQ1FSQkpRUUFnQTBFWFNSdEZCRUJCQUVHUUNFR2tBa0VPRUFBQUN5QUJLQUlVSVFRZ0FTZ0NFQ0lGQkVBZ0JTQUVOZ0lVQ3lBRUJFQWdCQ0FGTmdJUUN5QUJJQUFnQWlBRFFRUjBha0VDZEdvb0FtQkdCRUFnQUNBQ0lBTkJCSFJxUVFKMGFpQUVOZ0pnSUFSRkJFQWdBQ0FEUVFKMGFpSUVLQUlFUVg0Z0FuZHhJUUVnQkNBQk5nSUVJQUZGQkVBZ0FDQUFLQUlBUVg0Z0EzZHhOZ0lBQ3dzTEMvOERBUWQvSUFGRkJFQkJBRUdRQ0VITkFVRU9FQUFBQ3lBQktBSUFJZ1JCQVhGRkJFQkJBRUdRQ0VIUEFVRU9FQUFBQ3lBQlFSQnFJQUVvQWdCQmZIRnFJZ1VvQWdBaUFrRUJjUVJBSUFSQmZIRkJFR29nQWtGOGNXb2lBMEh3Ly8vL0Ewa0VRQUovSUFBZ0JSQUJJQUVnQXlBRVFRTnhjaUlFTmdJQUlBRkJFR29nQVNnQ0FFRjhjV29pQlNnQ0FBc2hBZ3NMSUFSQkFuRUVRQUovSUFGQkJHc29BZ0FpQXlnQ0FDSUhRUUZ4UlFSQVFRQkJrQWhCNUFGQkVCQUFBQXNnQjBGOGNVRVFhaUFFUVh4eGFpSUlRZkQvLy84RFNRUi9JQUFnQXhBQklBTWdDQ0FIUVFOeGNpSUVOZ0lBSUFNRklBRUxDeUVCQ3lBRklBSkJBbkkyQWdBZ0JFRjhjU0lEUWZELy8vOERTVUVBSUFOQkVFOGJSUVJBUVFCQmtBaEI4d0ZCRGhBQUFBc2dCU0FESUFGQkVHcHFSd1JBUVFCQmtBaEI5QUZCRGhBQUFBc2dCVUVFYXlBQk5nSUFJQU5CZ0FKSkJFQWdBMEVFZGlFREJTQURRUjhnQTJkcklnUkJCR3QyUVJCeklRTWdCRUVIYXlFR0N5QURRUkJKUVFBZ0JrRVhTUnRGQkVCQkFFR1FDRUdFQWtFT0VBQUFDeUFBSUFNZ0JrRUVkR3BCQW5ScUtBSmdJUVFnQVVFQU5nSVFJQUVnQkRZQ0ZDQUVCRUFnQkNBQk5nSVFDeUFBSUFNZ0JrRUVkR3BCQW5ScUlBRTJBbUFnQUNBQUtBSUFRUUVnQm5SeU5nSUFJQUFnQmtFQ2RHb2lBQ0FBS0FJRVFRRWdBM1J5TmdJRUM5RUJBUUovSUFKQkQzRkZRUUFnQVVFUGNVVkJBQ0FCSUFKTkd4dEZCRUJCQUVHUUNFR0NBMEVGRUFBQUN5QUFLQUtnRENJREJFQWdBU0FEUVJCcVNRUkFRUUJCa0FoQmpBTkJFQkFBQUFzZ0F5QUJRUkJyUmdSQUFuOGdBeWdDQUNFRUlBRkJFR3NMSVFFTEJTQUJJQUJCcEF4cVNRUkFRUUJCa0FoQm1BTkJCUkFBQUFzTElBSWdBV3NpQWtFd1NRUkFEd3NnQVNBRVFRSnhJQUpCSUd0QkFYSnlOZ0lBSUFGQkFEWUNFQ0FCUVFBMkFoUWdBU0FDYWtFUWF5SUNRUUkyQWdBZ0FDQUNOZ0tnRENBQUlBRVFBZ3VlQVFFRGZ5TUFJZ0pGQkVCQkFUOEFJZ0JLQkg5QkFTQUFhMEFBUVFCSUJVRUFDd1JBQUF0QndBa2hBa0hBQ1VFQU5nSUFRZUFWUVFBMkFnQURRQ0FCUVJkSkJFQWdBVUVDZEVIQUNXcEJBRFlDQkVFQUlRQURRQ0FBUVJCSkJFQWdBQ0FCUVFSMGFrRUNkRUhBQ1dwQkFEWUNZQ0FBUVFGcUlRQU1BUXNMSUFGQkFXb2hBUXdCQ3d0QndBbEI4QlUvQUVFUWRCQURRY0FKSkFBTElBSUwzd0VCQVg4Z0FVR0FBa2tFUUNBQlFRUjJJUUVGQW44Z0FVSDQvLy8vQVVrRVFDQUJRUUZCR3lBQloydDBha0VCYXlFQkN5QUJDMEVmSUFGbmF5SUNRUVJyZGtFUWN5RUJJQUpCQjJzaEFnc2dBVUVRU1VFQUlBSkJGMGtiUlFSQVFRQkJrQWhCMGdKQkRoQUFBQXNnQUNBQ1FRSjBhaWdDQkVGL0lBRjBjU0lCQkg4Z0FDQUJhQ0FDUVFSMGFrRUNkR29vQW1BRklBQW9BZ0JCZnlBQ1FRRnFkSEVpQVFSL0lBQWdBV2dpQVVFQ2RHb29BZ1FpQWtVRVFFRUFRWkFJUWQ4Q1FSSVFBQUFMSUFBZ0FtZ2dBVUVFZEdwQkFuUnFLQUpnQlVFQUN3c0xod0VCQW44Z0FTZ0NBQ0VESUFKQkQzRUVRRUVBUVpBSVFlMENRUTRRQUFBTElBTkJmSEVnQW1zaUJFRWdUd1JBSUFFZ0FpQURRUUp4Y2pZQ0FDQUNJQUZCRUdwcUlnRWdCRUVRYTBFQmNqWUNBQ0FBSUFFUUFnVWdBU0FEUVg1eE5nSUFJQUZCRUdvaUFDQUJLQUlBUVh4eGFpQUFJQUVvQWdCQmZIRnFLQUlBUVgxeE5nSUFDd3VxQWdFRGZ5TUJCRUJCQUVHUUNFSDBBMEVPRUFBQUN5QUJJZ05COFAvLy93TlBCRUJCd0FoQmtBaEJ6UU5CSGhBQUFBc2dBQ0FEUVE5cVFYQnhJZ0ZCRUNBQlFSQkxHeUlCRUFVaUJFVUVRRUVCSkFGQkFDUUJJQUFnQVJBRklnUkZCRUFnQVVINC8vLy9BVWtFZnlBQlFRRkJHeUFCWjJ0MFFRRnJhZ1VnQVF0QkVEOEFJZ1JCRUhSQkVHc2dBQ2dDb0F4SGRHcEIvLzhEYWtHQWdIeHhRUkIySVFVZ0JDQUZJQVFnQlVvYlFBQkJBRWdFUUNBRlFBQkJBRWdFUUFBTEN5QUFJQVJCRUhRL0FFRVFkQkFESUFBZ0FSQUZJZ1JGQkVCQkFFR1FDRUdBQkVFVUVBQUFDd3NMSUFRb0FnQkJmSEVnQVVrRVFFRUFRWkFJUVlnRVFRNFFBQUFMSUFSQkFEWUNCQ0FFSUFJMkFnZ2dCQ0FETmdJTUlBQWdCQkFCSUFBZ0JDQUJFQVlnQkFzTkFCQUVJQUFnQVJBSFFSQnFDMkVCQW44Z0FFRzhDVXNFUUNBQVFSQnJJZ0VvQWdRaUFrR0FnSUNBZjNFZ0FrRUJha0dBZ0lDQWYzRkhCRUJCQUVHQUNVSHRBRUVERUFBQUN5QUJJQUpCQVdvMkFnUWdBU2dDQUVFQmNRUkFRUUJCZ0FsQjhBQkJEaEFBQUFzTElBQUxFd0FnQUVHOENVc0VRQ0FBUVJCckVJNEJDd3VQQWdFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUXgxRGc0QUFRRUJBZ0lDQWdNREJBUUZCZ2NMSS8wQkJFQWovZ0VFUUNBQVFZQUNTQTBKSUFCQmdCSklRUUFnQUVIL0Ewb2JEUWtGUVFBZ0FFR0FBa2dqL2dFYkRRa0xDd3NnQUVHQXJkRUFhZzhMSUFCQmdJQUJheUVCSUFGQkFDUHZBU0lBUlNQM0FSc0VmMEVCQlNBQUMwRU9kR3BCZ0szUkFHb1BDeUFBUVlDUWZtb2ovZ0VFZjBIUC9nTVFDeTBBQUVFQmNRVkJBQXRCRFhScUR3c2dBQ1B3QVVFTmRHcEJnTm5HQUdvUEN5QUFRWUNRZm1vUEN5QUFRUUVqL2dFRWYwSHcvZ01RQ3kwQUFFRUhjUVZCQUFzaUFTQUJRUUZKRzBFTWRHcEJnUEI5YWc4TElBQkJnRkJxRHdzZ0FFR0FtZEVBYWd2REFRQkJBQ1QvQVVFQUpJQUNRUUFrZ1FKQkFDU0NBa0VBSklNQ1FRQWtoQUpCQUNTRkFrRUFKSVlDUVFBa2h3SkJBQ1NJQWtFQUpJa0NRUUFraWdKQkFDU0xBa0VBSkl3Q1FRQWtqUUpCQUNTT0FpUDlBUVJBRHdzai9nRUVRRUVSSklBQ1FZQUJKSWNDUVFBa2dRSkJBQ1NDQWtIL0FTU0RBa0hXQUNTRUFrRUFKSVVDUVEwa2hnSUZRUUVrZ0FKQnNBRWtod0pCQUNTQkFrRVRKSUlDUVFBa2d3SkIyQUVraEFKQkFTU0ZBa0hOQUNTR0FndEJnQUlraVFKQi92OERKSWdDQzZFSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQTROQUFFQ0F3UUZCZ2NJQ1FvTERBMExRZkxseXdja08wR2d3WUlGSkR4QjJMRGhBaVE5UVlpUUlDUStRZkxseXdja1AwR2d3WUlGSkVCQjJMRGhBaVJCUVlpUUlDUkNRZkxseXdja1EwR2d3WUlGSkVSQjJMRGhBaVJGUVlpUUlDUkdEQXdMUWYvLy93Y2tPMEhqMnY0SEpEeEJnT0tRQkNROVFRQWtQa0gvLy84SEpEOUI0OXIrQnlSQVFZRGlrQVFrUVVFQUpFSkIvLy8vQnlSRFFlUGEvZ2NrUkVHQTRwQUVKRVZCQUNSR0RBc0xRZi8vL3dja08wR0VpZjRISkR4QnV2VFFCQ1E5UVFBa1BrSC8vLzhISkQ5QnNmN3ZBeVJBUVlDSUFpUkJRUUFrUWtILy8vOEhKRU5CLzh1T0F5UkVRZjhCSkVWQkFDUkdEQW9MUWNYTi93Y2tPMEdFdWJvR0pEeEJxZGFSQkNROVFZamk2QUlrUGtILy8vOEhKRDlCNDlyK0J5UkFRWURpa0FRa1FVRUFKRUpCLy8vL0J5UkRRZVBhL2dja1JFR0E0cEFFSkVWQkFDUkdEQWtMUWYvLy93Y2tPMEdBL3NzQ0pEeEJnSVQ5QnlROVFRQWtQa0gvLy84SEpEOUJnUDdMQWlSQVFZQ0UvUWNrUVVFQUpFSkIvLy8vQnlSRFFZRCt5d0lrUkVHQWhQMEhKRVZCQUNSR0RBZ0xRZi8vL3dja08wR3gvdThESkR4QnhjY0JKRDFCQUNRK1FmLy8vd2NrUDBHRWlmNEhKRUJCdXZUUUJDUkJRUUFrUWtILy8vOEhKRU5CaEluK0J5UkVRYnIwMEFRa1JVRUFKRVlNQnd0QkFDUTdRWVNKQWlROFFZQzgvd2NrUFVILy8vOEhKRDVCQUNRL1FZU0pBaVJBUVlDOC93Y2tRVUgvLy84SEpFSkJBQ1JEUVlTSkFpUkVRWUM4L3dja1JVSC8vLzhISkVZTUJndEJwZi8vQnlRN1FaU3AvZ2NrUEVIL3FkSUVKRDFCQUNRK1FhWC8vd2NrUDBHVXFmNEhKRUJCLzZuU0JDUkJRUUFrUWtHbC8vOEhKRU5CbEtuK0J5UkVRZitwMGdRa1JVRUFKRVlNQlF0Qi8vLy9CeVE3UVlEKy93Y2tQRUdBZ1B3SEpEMUJBQ1ErUWYvLy93Y2tQMEdBL3Y4SEpFQkJnSUQ4QnlSQlFRQWtRa0gvLy84SEpFTkJnUDcvQnlSRVFZQ0EvQWNrUlVFQUpFWU1CQXRCLy8vL0J5UTdRWUQrL3dja1BFR0FsTzBESkQxQkFDUStRZi8vL3dja1AwSC95NDRESkVCQi93RWtRVUVBSkVKQi8vLy9CeVJEUWJIKzd3TWtSRUdBaUFJa1JVRUFKRVlNQXd0Qi8vLy9CeVE3UWYvTGpnTWtQRUgvQVNROVFRQWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSkIvLy8vQnlSRFFiSCs3d01rUkVHQWlBSWtSVUVBSkVZTUFndEIvLy8vQnlRN1FkNlpzZ1FrUEVHTXBja0NKRDFCQUNRK1FmLy8vd2NrUDBHRWlmNEhKRUJCdXZUUUJDUkJRUUFrUWtILy8vOEhKRU5CNDlyK0J5UkVRWURpa0FRa1JVRUFKRVlNQVF0Qi8vLy9CeVE3UWFYTGxnVWtQRUhTcE1rQ0pEMUJBQ1ErUWYvLy93Y2tQMEdseTVZRkpFQkIwcVRKQWlSQlFRQWtRa0gvLy84SEpFTkJwY3VXQlNSRVFkS2t5UUlrUlVFQUpFWUxDOW9JQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVlnQlJ3UkFJQUJCNFFCR0RRRWdBRUVVUmcwQ0lBQkJ4Z0JHRFFNZ0FFSFpBRVlOQkNBQVFjWUJSZzBFSUFCQmhnRkdEUVVnQUVHb0FVWU5CU0FBUWI4QlJnMEdJQUJCemdGR0RRWWdBRUhSQVVZTkJpQUFRZkFCUmcwR0lBQkJKMFlOQnlBQVFja0FSZzBISUFCQjNBQkdEUWNnQUVHekFVWU5CeUFBUWNrQlJnMElJQUJCOEFCR0RRa2dBRUhHQUVZTkNpQUFRZE1CUmcwTERBd0xRZis1bGdVa08wR0EvdjhISkR4QmdNWUJKRDFCQUNRK1FmKzVsZ1VrUDBHQS92OEhKRUJCZ01ZQkpFRkJBQ1JDUWYrNWxnVWtRMEdBL3Y4SEpFUkJnTVlCSkVWQkFDUkdEQXNMUWYvLy93Y2tPMEgveTQ0REpEeEIvd0VrUFVFQUpENUIvLy8vQnlRL1FZU0ovZ2NrUUVHNjlOQUVKRUZCQUNSQ1FmLy8vd2NrUTBIL3k0NERKRVJCL3dFa1JVRUFKRVlNQ2d0Qi8vLy9CeVE3UVlTSi9nY2tQRUc2OU5BRUpEMUJBQ1ErUWYvLy93Y2tQMEd4L3U4REpFQkJnSWdDSkVGQkFDUkNRZi8vL3dja1EwR0VpZjRISkVSQnV2VFFCQ1JGUVFBa1Jnd0pDMEgvNjlZRkpEdEJsUC8vQnlROFFjSzB0UVVrUFVFQUpENUJBQ1EvUWYvLy93Y2tRRUdFaWY0SEpFRkJ1dlRRQkNSQ1FRQWtRMEgvLy84SEpFUkJoSW4rQnlSRlFicjAwQVFrUmd3SUMwSC8vLzhISkR0QmhOdTJCU1E4UWZ2bWlRSWtQVUVBSkQ1Qi8vLy9CeVEvUVlEbS9RY2tRRUdBaE5FRUpFRkJBQ1JDUWYvLy93Y2tRMEgvKytvQ0pFUkJnSUQ4QnlSRlFmOEJKRVlNQnd0Qm5QLy9CeVE3UWYvcjBnUWtQRUh6cUk0REpEMUJ1dlFBSkQ1Qndvci9CeVEvUVlDcy93Y2tRRUdBOU5BRUpFRkJnSUNvQWlSQ1FmLy8vd2NrUTBHRWlmNEhKRVJCdXZUUUJDUkZRUUFrUmd3R0MwR0EvcThESkR0Qi8vLy9CeVE4UWNxay9RY2tQVUVBSkQ1Qi8vLy9CeVEvUWYvLy93Y2tRRUgveTQ0REpFRkIvd0VrUWtILy8vOEhKRU5CNDlyK0J5UkVRWURpa0FRa1JVRUFKRVlNQlF0Qi83bVdCU1E3UVlEKy93Y2tQRUdBeGdFa1BVRUFKRDVCMHNiOUJ5US9RWUNBMkFZa1FFR0FnSXdESkVGQkFDUkNRZjhCSkVOQi8vLy9CeVJFUWZ2Ky93Y2tSVUgvaVFJa1Jnd0VDMEhPLy84SEpEdEI3OStQQXlROFFiR0k4Z1FrUFVIYXRPa0NKRDVCLy8vL0J5US9RWURtL1Fja1FFR0FoTkVFSkVGQkFDUkNRZi8vL3dja1EwSC95NDRESkVSQi93RWtSVUVBSkVZTUF3dEIvLy8vQnlRN1FZU0ovZ2NrUEVHNjlOQUVKRDFCQUNRK1FmLy8vd2NrUDBHQS9nTWtRRUdBaU1ZQkpFRkJnSlFCSkVKQi8vLy9CeVJEUWYvTGpnTWtSRUgvQVNSRlFRQWtSZ3dDQzBILy8vOEhKRHRCLzh1T0F5UThRZjhCSkQxQkFDUStRWUQrL3dja1AwR0FnUHdISkVCQmdJQ01BeVJCUVFBa1FrSC8vLzhISkVOQnNmN3ZBeVJFUVlDSUFpUkZRUUFrUmd3QkMwSC8vLzhISkR0QmhOdTJCU1E4UWZ2bWlRSWtQVUVBSkQ1Qi8vLy9CeVEvUWVQYS9nY2tRRUhqMnY0SEpFRkJBQ1JDUWYvLy93Y2tRMEgveTQ0REpFUkIvd0VrUlVFQUpFWUxDOUVDQVFKL1FRQWs2QUZCQUNUcEFVRUFKT29CUVFBazZ3RkJBQ1RzQVVFQUpPMEJRUUFrN2dGQmtBRWs2Z0VqL2dFRVFFSEIvZ01RQzBHQkFUb0FBRUhFL2dNUUMwR1FBVG9BQUVISC9nTVFDMEg4QVRvQUFBVkJ3ZjRERUF0QmhRRTZBQUJCeHY0REVBdEIvd0U2QUFCQngvNERFQXRCL0FFNkFBQkJ5UDRERUF0Qi93RTZBQUJCeWY0REVBdEIvd0U2QUFBTFFaQUJKT29CUWNEK0F4QUxRWkFCT2dBQVFjLytBeEFMUVFBNkFBQkI4UDRERUF0QkFUb0FBQ1A5QVFSQUkvNEJCRUJCQUNUcUFVSEEvZ01RQzBFQU9nQUFRY0grQXhBTFFZQUJPZ0FBUWNUK0F4QUxRUUE2QUFBRlFRQWs2Z0ZCd1A0REVBdEJBRG9BQUVIQi9nTVFDMEdFQVRvQUFBc0xRUUFRRFFKQUkvNEJEUUJCQUNQOUFTUCtBUnNOQUVHMEFpRUFBMEFnQUVIREFrd0VRQ0FCSUFBUUN5MEFBR29oQVNBQVFRRnFJUUFNQVFzTElBRkIvd0Z4RUE0TEMvRUVBRUVBSktRQlFRQWtwUUZCQUNTbUFVRUJKS2NCUVFFa3FBRkJBU1NwQVVFQkpLb0JRUUVrcXdGQkFTU3NBVUVCSkswQlFRRWtyZ0ZCQVNTdkFVRUFKTEFCUVFBa3NnRkJBQ1N4QVVFQUpMTUJRWkQrQXhBTFFZQUJPZ0FBUVpIK0F4QUxRYjhCT2dBQVFaTCtBeEFMUWZNQk9nQUFRWlArQXhBTFFjRUJPZ0FBUVpUK0F4QUxRYjhCT2dBQUkvMEJCRUJCa2Y0REVBdEJQem9BQUVHUy9nTVFDMEVBT2dBQVFaUCtBeEFMUVFBNkFBQkJsUDRERUF0QnVBRTZBQUFMUVpYK0F4QUxRZjhCT2dBQVFaYitBeEFMUVQ4NkFBQkJsLzRERUF0QkFEb0FBRUdZL2dNUUMwRUFPZ0FBUVpuK0F4QUxRYmdCT2dBQVFacitBeEFMUWY4QU9nQUFRWnYrQXhBTFFmOEJPZ0FBUVp6K0F4QUxRWjhCT2dBQVFaMytBeEFMUVFBNkFBQkJudjRERUF0QnVBRTZBQUJCQVNTREFVR2YvZ01RQzBIL0FUb0FBRUdnL2dNUUMwSC9BVG9BQUVHaC9nTVFDMEVBT2dBQVFhTCtBeEFMUVFBNkFBQkJvLzRERUF0QnZ3RTZBQUJCcFA0REVBdEI5d0E2QUFCQkJ5U2xBVUVISktZQlFhWCtBeEFMUWZNQk9nQUFRUUVrcWdGQkFTU3BBVUVCSktnQlFRRWtwd0ZCQUNTdUFVRUFKSzBCUVFFa3JBRkJBU1NyQVVHbS9nTVFDMEh4QVRvQUFFRUJKSzhCSS8wQkJFQkJwUDRERUF0QkFEb0FBRUVBSktVQlFRQWtwZ0ZCcGY0REVBdEJBRG9BQUVFQUpLb0JRUUFrcVFGQkFDU29BVUVBSktjQlFRQWtyZ0ZCQUNTdEFVRUFKS3dCUVFBa3F3RkJwdjRERUF0QjhBQTZBQUJCQUNTdkFRdEJEeVNYQVVFUEpKZ0JRUThrbVFGQkR5U2FBVUVBSkpzQlFRQWtuQUZCQUNTZEFVRUFKSjRCUWY4QUpKOEJRZjhBSktBQlFRRWtvUUZCQVNTaUFVRUFKS01CQzlRR0FRRi9RY01DRUFzdEFBQWlBRUhBQVVZRWYwRUJCU0FBUVlBQlJrRUFJekliQ3dSQVFRRWsvZ0VGUVFBay9nRUxRUUFrbFFKQmdLald1UWNrandKQkFDU1FBa0VBSkpFQ1FZQ28xcmtISkpJQ1FRQWtrd0pCQUNTVUFpTXhCRUJCQVNUOUFRVkJBQ1Q5QVFzUURFRUFKUEVCUVFFazhnRkJ4d0lRQ3kwQUFDSUFSU1R6QVNBQVFRTk5RUUFnQUVFQlR4c2s5QUVnQUVFR1RVRUFJQUJCQlU4YkpQVUJJQUJCRTAxQkFDQUFRUTlQR3lUMkFTQUFRUjVOUVFBZ0FFRVpUeHNrOXdGQkFTVHZBVUVBSlBBQlFjLytBeEFMUVFBNkFBQkI4UDRERUF0QkFUb0FBRUhSL2dNUUMwSC9BVG9BQUVIUy9nTVFDMEgvQVRvQUFFSFQvZ01RQzBIL0FUb0FBRUhVL2dNUUMwSC9BVG9BQUVIVi9nTVFDMEgvQVRvQUFCQVBJLzRCQkVCQjZQNERFQXRCd0FFNkFBQkI2ZjRERUF0Qi93RTZBQUJCNnY0REVBdEJ3UUU2QUFCQjYvNERFQXRCRFRvQUFBVkI2UDRERUF0Qi93RTZBQUJCNmY0REVBdEIvd0U2QUFCQjZ2NERFQXRCL3dFNkFBQkI2LzRERUF0Qi93RTZBQUFMSS80QlFRQWovUUViQkVCQjZmNERFQXRCSURvQUFFSHIvZ01RQzBHS0FUb0FBQXNRRUVFQUpMY0JRUUFrdUFGQkFDUzVBVUVBSkxvQlFRQWt1d0ZCQUNTMkFVSC8vd01RQzBFQU9nQUFRUUVrdlFGQkFDUytBVUVBSkw4QlFRQWt3QUZCQUNUQkFVSGhBU1M4QVVHUC9nTVFDMEhoQVRvQUFFRUFKTUlCUVFBa3d3RkJBQ1RFQVVFQUpNZ0JRUUFreVFGQkFDVEtBVUVBSk1VQlFRQWt4Z0VqL2dFRVFFR0UvZ01RQzBFZU9nQUFRYUE5Sk1NQkJVR0UvZ01RQzBHckFUb0FBRUhNMXdJa3d3RUxRWWYrQXhBTFFmZ0JPZ0FBUWZnQkpNb0JJLzBCQkVBai9nRkZCRUJCaFA0REVBdEJBRG9BQUVFRUpNTUJDd3RCQUNUTEFVRUFKTXdCSS80QkJFQkJndjRERUF0Qi9BQTZBQUJCQUNUTkFRVkJndjRERUF0Qi9nQTZBQUJCQVNUTkFRdEJBQ1RPQVNQK0FRUkFRZkQrQXhBTFFmZ0JPZ0FBUWMvK0F4QUxRZjRCT2dBQVFjMytBeEFMUWY0QU9nQUFRWUQrQXhBTFFjOEJPZ0FBUVkvK0F4QUxRZUVCT2dBQVFleitBeEFMUWY0Qk9nQUFRZlgrQXhBTFFZOEJPZ0FBQlVIdy9nTVFDMEgvQVRvQUFFSFAvZ01RQzBIL0FUb0FBRUhOL2dNUUMwSC9BVG9BQUVHQS9nTVFDMEhQQVRvQUFFR1AvZ01RQzBIaEFUb0FBQXNMU2dBZ0FFRUFTaVF4SUFGQkFFb2tNaUFDUVFCS0pETWdBMEVBU2lRMElBUkJBRW9rTlNBRlFRQktKRFlnQmtFQVNpUTNJQWRCQUVva09DQUlRUUJLSkRrZ0NVRUFTaVE2RUJFTEJRQWpsUUlMbVFJQVFhd0tJNlVCTmdJQVFiQUtJNllCTmdJQVFiUUtJNmNCUVFCSE9nQUFRYlVLSTZnQlFRQkhPZ0FBUWJZS0k2a0JRUUJIT2dBQVFiY0tJNm9CUVFCSE9nQUFRYmdLSTZzQlFRQkhPZ0FBUWJrS0k2d0JRUUJIT2dBQVFib0tJNjBCUVFCSE9nQUFRYnNLSTY0QlFRQkhPZ0FBUWJ3S0k2OEJRUUJIT2dBQVFiMEtJN0FCTmdJQVFjSUtJN0VCT2dBQVFjTUtJN0lCT2dBQVFjUUtJNWNCT2dBQVFjVUtJNWdCT2dBQVFjWUtJNWtCT2dBQVFjY0tJNW9CT2dBQVFjZ0tJNXNCUVFCSE9nQUFRY2tLSTV3QlFRQkhPZ0FBUWNvS0k1MEJRUUJIT2dBQVFjc0tJNTRCUVFCSE9nQUFRY3dLSTU4Qk9nQUFRYzBLSTZBQk9nQUFRYzRLSTZFQlFRQkhPZ0FBUWM4S0k2SUJRUUJIT2dBQUMrb0JBRUhlQ2lOSk5nSUFRZUlLSTBvNkFBQkI0d29qUzBFQVJ6b0FBRUhrQ2lOTU9nQUFRZVVLSTAwNkFBQkI1d29qVGpzQkFFSG9DaU5QT2dBQVFla0tJMUJCQUVjNkFBQkI2Z29qVVRvQUFFSHJDaU5TT2dBQVFld0tJMU5CQUVjNkFBQkI3UW9qVkRvQUFFSHVDaU5WUVFCSE9nQUFRZThLSTFaQkFFYzZBQUJCOEFvalZ6WUNBRUgwQ2lOWU5nSUFRZmdLSTFrMkFnQkIvQW9qV2tFQVJ6b0FBRUg5Q2lOYk5nSUFRWUVMSTF3MkFnQkJoUXNqWFRvQUFFR0dDeU5lT2dBQVFZY0xJMTlCQUVjNkFBQkJpQXNqWURZQ0FFR01DeU5oT3dFQVFZOExJMkpCQUVjNkFBQUx2d2dCQVg5QmdBZ2pnQUk2QUFCQmdRZ2pnUUk2QUFCQmdnZ2pnZ0k2QUFCQmd3Z2pnd0k2QUFCQmhBZ2poQUk2QUFCQmhRZ2poUUk2QUFCQmhnZ2poZ0k2QUFCQmh3Z2pod0k2QUFCQmlBZ2ppQUk3QVFCQmlnZ2ppUUk3QVFCQmpBZ2ppZ0kyQWdCQmtRZ2ppd0pCQUVjNkFBQkJrZ2dqakFKQkFFYzZBQUJCa3dnampRSkJBRWM2QUFCQmxBZ2pqZ0pCQUVjNkFBQkJsUWdqL1FGQkFFYzZBQUJCbGdnai9nRkJBRWM2QUFCQmx3Z2ovd0ZCQUVjNkFBQkJzZ2dqNlFFMkFnQWo2Z0VoQUVIRS9nTVFDeUFBT2dBQVFiWUlJOTRCT2dBQVFiY0lJOThCT2dBQVFiZ0lJK0FCUVFCSE9nQUFRYmtJSStFQlFRQkhPZ0FBUWJvSUkrSUJRUUJIT2dBQVFic0lJK01CUVFCSE9nQUFRYndJSStRQlFRQkhPZ0FBUWIwSUkrVUJRUUJIT2dBQVFiNElJK1lCUVFCSE9nQUFRYjhJSStjQlFRQkhPZ0FBUWVRSUk3UUJRUUJIT2dBQVFlVUlJN1VCUVFCSE9nQUFRY2dKSSs4Qk93RUFRY29KSS9BQk93RUFRY3dKSS9FQlFRQkhPZ0FBUWMwSkkvSUJRUUJIT2dBQVFjNEpJL01CUVFCSE9nQUFRYzhKSS9RQlFRQkhPZ0FBUWRBSkkvVUJRUUJIT2dBQVFkRUpJL1lCUVFCSE9nQUFRZElKSS9jQlFRQkhPZ0FBUWRNSkkvZ0JOZ0lBUWRjSkkva0JRUUJIT2dBQVFkZ0pJL29CTmdJQVFkd0pJL3NCTmdJQVFlQUpJL3dCTmdJQVFmb0pJOElCTmdJQVFmNEpJOE1CTmdJQVFZSUtJOFFCSWdBMkFnQkJoZ29qeFFGQkFFYzZBQUJCaHdvanhnRkJBRWM2QUFCQmlBb2p4d0UyQWdCQmpBb2p5QUUyQWdCQmtBb2p5UUZCQUVjNkFBQkJrUW9qeWdFMkFnQkJoZjRERUFzZ0FEb0FBQkFVRUJWQmtBc2pZellDQUVHWEN5TmtPZ0FBUVpnTEkyVTdBUUJCbWdzalpqb0FBRUdiQ3lOblFRQkhPZ0FBUVp3TEkyZzZBQUJCblFzamFUb0FBRUdlQ3lOcVFRQkhPZ0FBUVo4TEkyczZBQUJCb0FzamJFRUFSem9BQUVHaEN5TnRRUUJIT2dBQVFhSUxJMjQyQWdCQnBnc2piellDQUVHcUN5TndOZ0lBUWE0TEkzRkJBRWM2QUFCQnJ3c2pjallDQUVHekN5TnpOZ0lBUWJjTEkzUTZBQUJCdUFzamRUb0FBRUhDQ3lOMk5nSUFRY29MSTNjN0FRQkJ6QXNqZURvQUFFSE9DeU41T2dBQVFjOExJM3BCQUVjNkFBQkIwQXNqZXpvQUFFSFJDeU44UVFCSE9nQUFRZElMSTMxQkFFYzZBQUJCMHdzamZqWUNBRUhYQ3lOL05nSUFRZHNMSTRBQk5nSUFRZU1MSTRFQk5nSUFRZWNMSTRJQk9nQUFRZWdMSTRNQlFRQkhPZ0FBUWVrTEk0UUJOZ0lBUWZRTEk0VUJOZ0lBUWZnTEk0WUJPd0VBUWZvTEk0Y0JPZ0FBUWZzTEk0Z0JRUUJIT2dBQVFmd0xJNGtCT2dBQVFmMExJNG9CT2dBQVFmNExJNHNCUVFCSE9nQUFRZjhMSTR3Qk9nQUFRWUVNSTQwQlFRQkhPZ0FBUVlNTUk0NEJRUUJIT2dBQVFZUU1JNDhCUVFCSE9nQUFRWWtNSTVBQk5nSUFRWTBNSTVFQk5nSUFRWkVNSTVJQlFRQkhPZ0FBUVpJTUk1TUJOZ0lBUVpZTUk1UUJOZ0lBUVpvTUk1WUJPd0VBUVFBa2xRSUxwZ0VCQVg5QjVBZ3RBQUJCQUVza3RBRkI1UWd0QUFCQkFFc2t0UUZCLy84REVBc3RBQUFpQUVFQmNVRUFSeVMzQVNBQVFRSnhRUUJISkxnQklBQkJCSEZCQUVja3VRRWdBRUVJY1VFQVJ5UzZBU0FBUVJCeFFRQkhKTHNCSUFBa3RnRkJqLzRERUFzdEFBQWlBRUVCY1VFQVJ5UzlBU0FBUVFKeFFRQkhKTDRCSUFCQkJIRkJBRWNrdndFZ0FFRUljVUVBUnlUQUFTQUFRUkJ4UVFCSEpNRUJJQUFrdkFFTEJ3QkJBQ1N6QVF1ZUFnQkJyQW9vQWdBa3BRRkJzQW9vQWdBa3BnRkJ0QW90QUFCQkFFc2twd0ZCdFFvdEFBQkJBRXNrcUFGQnRnb3RBQUJCQUVza3FRRkJ0d290QUFCQkFFc2txZ0ZCdUFvdEFBQkJBRXNrcXdGQnVRb3RBQUJCQUVza3JBRkJ1Z290QUFCQkFFc2tyUUZCdXdvdEFBQkJBRXNrcmdGQnZBb3RBQUJCQUVza3J3RkJ2UW9vQWdBa3NBRkJ3Z290QUFBa3NRRkJ3d290QUFBa3NnRkJ4QW90QUFBa2x3RkJ4UW90QUFBa21BRkJ4Z290QUFBa21RRkJ4d290QUFBa21nRkJ5QW90QUFCQkFFc2ttd0ZCeVFvdEFBQkJBRXNrbkFGQnlnb3RBQUJCQUVza25RRkJ5d290QUFCQkFFc2tuZ0ZCekFvdEFBQWtud0ZCelFvdEFBQWtvQUZCemdvdEFBQkJBRXNrb1FGQnp3b3RBQUJCQUVza29nRkJBQ1N6QVF2d0FRQWpTVUV5YkVHQUNHb29BZ0FrU1VIaUNpMEFBQ1JLUWVNS0xRQUFRUUJMSkV0QjVBb3RBQUFrVEVIbENpMEFBQ1JOUWVjS0x3RUFKRTVCNkFvdEFBQWtUMEhwQ2kwQUFFRUFTeVJRUWVvS0xRQUFKRkZCNndvdEFBQWtVa0hzQ2kwQUFFRUFTeVJUUWUwS0xRQUFKRlJCN2dvdEFBQkJBRXNrVlVIdkNpMEFBRUVBU3lSV1FmQUtLQUlBSkZkQjlBb29BZ0FrV0VINENpZ0NBQ1JaUWZ3S0xRQUFRUUJMSkZwQi9Rb29BZ0FrVzBHQkN5Z0NBQ1JjUVlVTExRQUFKRjFCaGdzdEFBQWtYa0dIQ3kwQUFFRUFTeVJmUVlnTExRQUFKR0JCakFzdEFBQWtZVUdQQ3kwQUFFRUFTeVJpQzY4QkFDTmpRVEpzUVlBSWFpZ0NBQ1JqUVpjTExRQUFKR1JCbUFzdkFRQWtaVUdhQ3kwQUFDUm1RWnNMTFFBQVFRQkxKR2RCbkFzdEFBQWthRUdkQ3kwQUFDUnBRWjRMTFFBQVFRQkxKR3BCbndzdEFBQWthMEdnQ3kwQUFFRUFTeVJzUWFFTExRQUFRUUJMSkcxQm9nc29BZ0FrYmtHbUN5Z0NBQ1J2UWFvTEtBSUFKSEJCcmdzdEFBQkJBRXNrY1VHdkN5Z0NBQ1J5UWJNTEtBSUFKSE5CdHdzdEFBQWtkRUc0Q3kwQUFDUjFDODhIQVFGL1FZQUlMUUFBSklBQ1FZRUlMUUFBSklFQ1FZSUlMUUFBSklJQ1FZTUlMUUFBSklNQ1FZUUlMUUFBSklRQ1FZVUlMUUFBSklVQ1FZWUlMUUFBSklZQ1FZY0lMUUFBSkljQ1FZZ0lMd0VBSklnQ1FZb0lMd0VBSklrQ1FZd0lLQUlBSklvQ1FaRUlMUUFBUVFCTEpJc0NRWklJTFFBQVFRQkxKSXdDUVpNSUxRQUFRUUJMSkkwQ1FaUUlMUUFBUVFCTEpJNENRWlVJTFFBQVFRQkxKUDBCUVpZSUxRQUFRUUJMSlA0QlFaY0lMUUFBUVFCTEpQOEJRYklJS0FJQUpPa0JRY1QrQXhBTExRQUFKT29CUWJZSUxRQUFKTjRCUWJjSUxRQUFKTjhCUWJnSUxRQUFRUUJMSk9BQlFia0lMUUFBUVFCTEpPRUJRYm9JTFFBQVFRQkxKT0lCUWJzSUxRQUFRUUJMSk9NQlFid0lMUUFBUVFCTEpPUUJRYjBJTFFBQVFRQkxKT1VCUWI0SUxRQUFRUUJMSk9ZQlFiOElMUUFBUVFCTEpPY0JFQmRCZ1A0REVBc3RBQUJCL3dGekpOY0JJOWNCSWdCQkVIRkJBRWNrMkFFZ0FFRWdjVUVBUnlUWkFVSElDUzhCQUNUdkFVSEtDUzhCQUNUd0FVSE1DUzBBQUVFQVN5VHhBVUhOQ1MwQUFFRUFTeVR5QVVIT0NTMEFBRUVBU3lUekFVSFBDUzBBQUVFQVN5VDBBVUhRQ1MwQUFFRUFTeVQxQVVIUkNTMEFBRUVBU3lUMkFVSFNDUzBBQUVFQVN5VDNBVUhUQ1NnQ0FDVDRBVUhYQ1MwQUFFRUFTeVQ1QVVIWUNTZ0NBQ1Q2QVVIY0NTZ0NBQ1Q3QVVIZ0NTZ0NBQ1Q4QVVINkNTZ0NBQ1RDQVVIK0NTZ0NBQ1REQVVHQ0NpZ0NBQ1RFQVVHR0NpMEFBRUVBU3lURkFVR0hDaTBBQUVFQVN5VEdBVUdJQ2lnQ0FDVEhBVUdNQ2lnQ0FDVElBVUdRQ2kwQUFFRUFTeVRKQVVHUkNpZ0NBQ1RLQVJBWkVCb1FHeU4yUVRKc1FZQUlhaWdDQUNSMlFjb0xMd0VBSkhkQnpBc3RBQUFrZUVIT0N5MEFBQ1I1UWM4TExRQUFRUUJMSkhwQjBBc3RBQUFrZTBIUkN5MEFBRUVBU3lSOFFkSUxMUUFBUVFCTEpIMUIwd3NvQWdBa2ZrSFhDeWdDQUNSL1Fkc0xLQUlBSklBQlFlTUxLQUlBSklFQlFlY0xLQUlBSklJQlFlZ0xMUUFBUVFCTEpJTUJRZWtMS0FJQUpJUUJJNFVCUVRKc1FZQUlhaWdDQUNTRkFVSDRDeTBBQUNTR0FVSDZDeTBBQUNTSEFVSDdDeTBBQUVFQVN5U0lBVUg4Q3kwQUFDU0pBVUg5Q3kwQUFDU0tBVUgrQ3kwQUFFRUFTeVNMQVVIL0N5MEFBQ1NNQVVHQkRDMEFBRUVBU3lTTkFVR0REQzBBQUVFQVN5U09BVUdFREMwQUFFRUFTeVNQQVVHSkRDZ0NBQ1NRQVVHTkRDZ0NBQ1NSQVVHUkRDMEFBRUVBU3lTU0FVR1NEQ2dDQUNTVEFVR1dEQ2dDQUNTVUFVR2FEQzhCQUNTV0FVRUFKSlVDUVlDbzFya0hKSThDUVFBa2tBSkJBQ1NSQWtHQXFOYTVCeVNTQWtFQUpKTUNRUUFrbEFJTEJRQWovZ0VMQlFBamtnSUxCUUFqa3dJTEJRQWpsQUlMbmdJQkIzOGdBQ05JSWdkR1FRQWdCQ05IUmtFQUlBQkJDRXBCQUNBQlFRQktHeHNiQkVBZ0EwRUJheEFMTFFBQVFTQnhRUUJISVFnZ0F4QUxMUUFBUVNCeFFRQkhJUWtEUUNBR1FRaElCRUFnQUVFSElBWnJJQVlnQ0NBSlJ4c2lCR29pQTBHZ0FVd0VRQUovSUFNZ0FVR2dBV3dpQ21vaUMwRURiQ0lHUVlESkJXb2lBeUFETFFBQU9nQUFJQVpCZ2NrRmFpQURMUUFCT2dBQUlBWkJnc2tGYWlBRExRQUNPZ0FBSUF0QmdKRUVhaUFLSUFCQkFDQUVhMnRxUWZpUUJHb3RBQUFpQTBFRGNTSUdRUVJ5SUFZZ0EwRUVjUnM2QUFBZ0JVRUJhZ3NoQlFzZ0JFRUJhaUVHREFFTEN3VWdCQ1JIQ3lBQUlBZE9CSDhnQUVFSWFpRUJJQUFnQWtFSGNTSUFTQVIvSUFBZ0FXb0ZJQUVMQlNBSEN5UklJQVVMclFFQUlBRVFDeTBBQUNBQVFRRjBkVUVEY1NFQUlBRkJ5UDREUmdSQUl6OGhBUUpBQWtBQ1FBSkFJQUJCQVdzT0F3QUJBZ01MSTBBaEFRd0NDeU5CSVFFTUFRc2pRaUVCQ3dVZ0FVSEovZ05HQkVBalF5RUJBa0FDUUFKQUFrQWdBRUVCYXc0REFBRUNBd3NqUkNFQkRBSUxJMFVoQVF3QkN5TkdJUUVMQlNNN0lRRUNRQUpBQWtBQ1FDQUFRUUZyRGdNQUFRSURDeU04SVFFTUFnc2pQU0VCREFFTEl6NGhBUXNMQ3lBQkMrQURBUVovSUFKQkFYRkJEWFFpRHlFT0lBNGdBU0lDUVlDUUFrWUVmeUFBUVlBQmF5QUFRWUFCYWlBQVFZQUJjUnNGSUFBTFFRUjBJQUpxSUFWQkFYUnFJZ0JCZ0pCK2Ftb3RBQUFoRVNBUElBQkJnWkIrYW1vdEFBQWhFaUFESVFBRFFDQUFJQVJNQkVBZ0JpQUFJQU5yYWlJUElBaElCRUFDZnlBU1FRRkJCeUFBYXlBQVFRRWdDMEVnY1VVZ0MwRUFTQnNiSWdKMGNRUi9RUUlGUVFBTElnRkJBV29nQVNBUlFRRWdBblJ4R3lFRkkvNEJCSDlCQVNBTVFRQk9JQXRCQUU0YkJVRUFDd1IvSUF0QkIzRWhBU0FNUVFCT0lnSUVmeUFNUVFkeEJTQUJDMEVEZENBRlFRRjBhaUlCUVFGcVFUOXhJZzVCUUdzZ0RpQUNHMEdBa0FScUxRQUFRUWgwSUFGQlAzRWlBVUZBYXlBQklBSWJRWUNRQkdvdEFBQnlJZ0ZCSDNGQkEzUWhEaUFCUWVBSGNVRUZka0VEZENFQ0lBRkJnUGdCY1VFS2RrRURkQVVnQlVISC9nTWdDaUFLUVFCTUd5SUtFQ0lpQVVHQWdQd0hjVUVRZGlFT0lBRkJnUDREY1VFSWRpRUNJQUZCL3dGeEN5RUJJQWtnRHlBSElBaHNha0VEYkdvaUVDQU9PZ0FBSUJBZ0Fqb0FBU0FRSUFFNkFBSWdEeUFIUWFBQmJHcEJnSkVFYWlBRlFRTnhJZ0ZCQkhJZ0FTQUxRWUFCY1VFQUlBdEJBRTRiR3pvQUFDQU5RUUZxQ3lFTkN5QUFRUUZxSVFBTUFRc0xJQTBMMGdJQUlBTkJCM0VoQXlBRklBVkJnSkFDUmdSL0lBWkJnQUZySUFaQmdBRnFJQVpCZ0FGeEd3VWdCZ3RCQkhScUlRVWdCU0FFUVlEUWZtb3RBQUFpQkVIQUFIRUVmMEVISUFOckJTQURDMEVCZEdvaUEwR0FrSDVxSUFSQkNIRkJBRWNpQlVFTmRHb3RBQUFoQmlBQUlBRkJvQUZzYWtFRGJFR0F5UVZxSUFSQkIzRkJBM1FnQTBHQmtINXFJQVZCQVhGQkRYUnFMUUFBUVFFZ0FrRUhjU0lDUVFjZ0Ftc2dCRUVnY1JzaUEzUnhCSDlCQWdWQkFBc2lBa0VCYWlBQ0lBWkJBU0FEZEhFYklnTkJBWFJxSWdKQkFXcEJQM0ZCZ0pBRWFpMEFBRUVJZENBQ1FUOXhRWUNRQkdvdEFBQnlJZ0pCSDNGQkEzUTZBQUFnQUNBQlFhQUJiR29pQUVFRGJDSUJRWUhKQldvZ0FrSGdCM0ZCQlhaQkEzUTZBQUFnQVVHQ3lRVnFJQUpCZ1BnQmNVRUtka0VEZERvQUFDQUFRWUNSQkdvZ0EwRURjU0lBUVFSeUlBQWdCRUdBQVhFYk9nQUFDOHNCQUNBRUlBUkJnSkFDUmdSL0lBVkJnQUZySUFWQmdBRnFJQVZCZ0FGeEd3VWdCUXRCQkhScUlBTkJCM0ZCQVhScUlnTkJnSkIrYWkwQUFDRUVJQUFnQVVHZ0FXeHFJZ1ZCQTJ3aUFVR0F5UVZxSUFOQmdaQithaTBBQUVFQlFRY2dBa0VIY1dzaUFuUnhCSDlCQWdWQkFBc2lBRUVCYWlBQUlBUkJBU0FDZEhFYlFmOEJjU0lDUWNmK0F4QWlJZ0JCZ0lEOEIzRkJFSFk2QUFBZ0FVR0J5UVZxSUFCQmdQNERjVUVJZGpvQUFDQUJRWUxKQldvZ0FEb0FBQ0FGUVlDUkJHb2dBa0VEY1RvQUFBdkhBZ0VIZnlBRFFRTjFJUXNEUUNBRVFhQUJTQVJBSUFJZ0MwRUZkR29DZnlBRUlBVnFJZ1pCZ0FKT0JFQWdCa0dBQW1zaEJnc2dCZ3RCQTNWcUlncEJnSkIrYWkwQUFDRUlRUUFoQnlNNUJFQWdCQ0FBSUFZZ0NpQUlFQ0VpQ1VFQVNnUkFBbjlCQVNFSElBUWdDVUVCYTJvTElRUUxDeUFIUlVFQUl6Z2JCRUJCQUNFSklBTkJCM0VoQjBFQUlBWWdCa0VEZFVFRGRHc2dCQnNoREVGL0lRWWovZ0VFUUFKL0lBcEJnTkIrYWkwQUFDSUdRUWh4UVFCSElRbEJCeUFIYXlBSElBWkJ3QUJ4R3dzaEJ3c2dCQ0FJSUFFZ0NTQU1RYUFCSUFSclFRY2dCRUVJYWtHZ0FVb2JJQWNnQkNBQVFhQUJRWURKQlVFQUlBWkJmeEFqSWdaQkFXdHFJQVFnQmtFQVNoc2hCQVVnQjBVRVFDUCtBUVJBSUFRZ0FDQUdJQU1nQ2lBQklBZ1FKQVVnQkNBQUlBWWdBeUFCSUFnUUpRc0xDeUFFUVFGcUlRUU1BUXNMQzVVRkFROS9RU2NoQndOQUlBZEJBRTRFUUNBSFFRSjBJZ1ZCZ1B3RGFpSUNFQXN0QUFBaEF5QUNRUUZxRUFzdEFBQWhCaUFDUVFKcUVBc3RBQUFoQkNBR1FRaHJJUW9nQUNBRFFSQnJJZ01nQVFSL0lBUWdCRUVCY1dzaEJFRVFCVUVJQ3lJQ2FraEJBQ0FBSUFOT0d3UkFJQVZCZy93RGFoQUxMUUFBSWdaQmdBRnhRUUJISVFzZ0JrRWdjVUVBUnlFTUlBWkJDSEZCQUVjai9nRWlCU0FGRzBFQmNVRU5kQ0lGSUFSQkJIUkJnSUFDYWlBQ0lBQWdBMnNpQW10QkFXc2dBaUFHUWNBQWNSdEJBWFJxSWdKQmdKQithbW90QUFBaERTQUZJQUpCZ1pCK2Ftb3RBQUFoRGtFSElRUURRQ0FFUVFCT0JFQWdEa0VCUVFBZ0JFRUhhMnNnQkNBTUd5SURkSEVFZjBFQ0JVRUFDeUlDUVFGcUlBSWdEVUVCSUFOMGNSc2lBd1JBSUFwQkJ5QUVhMm9pQWtHZ0FVeEJBQ0FDUVFCT0d3UkFRUUFoQlVFQUlRZ2o1d0ZGSS80Qklna2dDUnNpQ1VVRVFDQUNJQUJCb0FGc2FrR0FrUVJxTFFBQUlnOUJBM0VpRUVFQVMwRUFJQXNiQkVCQkFTRUZCU0FRUVFCTFFRQWdEMEVFY1VFQUkvNEJHeHRGUlNFSUN3dEJBVUVBSUFoRklBVWJJQWtiQkVBai9nRUVRQ0FDSUFCQm9BRnNha0VEYkNJQ1FZREpCV29nQmtFSGNVRURkQ0FEUVFGMGFpSURRUUZxUVQ5eFFjQ1FCR290QUFCQkNIUWdBMEUvY1VIQWtBUnFMUUFBY2lJRFFSOXhRUU4wT2dBQUlBSkJnY2tGYWlBRFFlQUhjVUVGZGtFRGREb0FBQ0FDUVlMSkJXb2dBMEdBK0FGeFFRcDJRUU4wT2dBQUJTQUNJQUJCb0FGc2FrRURiQ0lDUVlESkJXb2dBMEhKL2dOQnlQNERJQVpCRUhFYkVDSWlBMEdBZ1B3SGNVRVFkam9BQUNBQ1FZSEpCV29nQTBHQS9nTnhRUWgyT2dBQUlBSkJnc2tGYWlBRE9nQUFDd3NMQ3lBRVFRRnJJUVFNQVFzTEN5QUhRUUZySVFjTUFRc0xDNEVCQVFKL1FZQ0FBa0dBa0FJajR3RWJJUUZCQVNQbkFTUCtBUnNFUUNBQUlBRkJnTGdDUVlDd0FpUGtBUnNnQUNQc0FXcEIvd0Z4UVFBajZ3RVFKZ3NqNGdFRVFDQUFJKzRCSWdKT0JFQWdBQ0FCUVlDNEFrR0FzQUlqNFFFYklBQWdBbXNqN1FGQkIyc2lBVUVBSUFGckVDWUxDeVBtQVFSQUlBQWo1UUVRSndzTElRQkJqLzRERUFzdEFBQkJBU0FBZEhJaUFDUzhBVUdQL2dNUUN5QUFPZ0FBQytvQkFRTi9JMTlGUVFFalZSc0VRQThMSTJCQkFXc2lBRUVBVEFSQUkwb0VRQ05LSkdBQ2Z5TmhJZ0VqVEhVaEFFRUJJMHNFZjBFQkpHSWdBU0FBYXdVZ0FDQUJhZ3NpQUVIL0Qwb05BQnBCQUFzRVFFRUFKRlVMSTB4QkFFb0VRQ0FBSkdFZ0FFRUlkVUVIY1NJQ1FaVCtBeEFMTFFBQVFmZ0JjWEloQVVHVC9nTVFDeUFBUWY4QmNTSUFPZ0FBUVpUK0F4QUxJQUU2QUFBZ0FDUlNJQUlrVkNOU0kxUkJDSFJ5SkZjQ2Z5TmhJZ0VqVEhVaEFFRUJJMHNFZjBFQkpHSWdBU0FBYXdVZ0FDQUJhZ3RCL3c5S0RRQWFRUUFMQkVCQkFDUlZDd3NGUVFna1lBc0ZJQUFrWUFzTHdRY0JBbjhnQUNPd0FXb2lBRUdBd0FBai93RjBJZ0pPQkVBZ0FDQUNheVN3QVFKQUFrQUNRQUpBQWtBQ1FDT3hBVUVCYWtFSGNTSUNEZ2dBQlFFRkFnVURCQVVMSTFOQkFDTmJJZ0JCQUVvYkJFQWdBRUVCYXlJQVJRUkFRUUFrVlFzTElBQWtXd0ovSTJwQkFDTnlJZ0JCQUVvYkJFQWdBRUVCYXlFQUN5QUFDMFVFUUVFQUpHd0xJQUFrY2dKL0kzcEJBQ09BQVNJQVFRQktHd1JBSUFCQkFXc2hBQXNnQUF0RkJFQkJBQ1I4Q3lBQUpJQUJBbjhqalFGQkFDT1RBU0lBUVFCS0d3UkFJQUJCQVdzaEFBc2dBQXRGQkVCQkFDU09BUXNnQUNTVEFRd0VDeU5UUVFBald5SUFRUUJLR3dSQUlBQkJBV3NpQUVVRVFFRUFKRlVMQ3lBQUpGc0NmeU5xUVFBamNpSUFRUUJLR3dSQUlBQkJBV3NoQUFzZ0FBdEZCRUJCQUNSc0N5QUFKSElDZnlONlFRQWpnQUVpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtmQXNnQUNTQUFRSi9JNDBCUVFBamt3RWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2pnRUxJQUFra3dFUUtnd0RDeU5UUVFBald5SUFRUUJLR3dSQUlBQkJBV3NpQUVVRVFFRUFKRlVMQ3lBQUpGc0NmeU5xUVFBamNpSUFRUUJLR3dSQUlBQkJBV3NoQUFzZ0FBdEZCRUJCQUNSc0N5QUFKSElDZnlONlFRQWpnQUVpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtmQXNnQUNTQUFRSi9JNDBCUVFBamt3RWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2pnRUxJQUFra3dFTUFnc2pVMEVBSTFzaUFFRUFTaHNFUUNBQVFRRnJJZ0JGQkVCQkFDUlZDd3NnQUNSYkFuOGpha0VBSTNJaUFFRUFTaHNFUUNBQVFRRnJJUUFMSUFBTFJRUkFRUUFrYkFzZ0FDUnlBbjhqZWtFQUk0QUJJZ0JCQUVvYkJFQWdBRUVCYXlFQUN5QUFDMFVFUUVFQUpId0xJQUFrZ0FFQ2Z5T05BVUVBSTVNQklnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkk0QkN5QUFKSk1CRUNvTUFRc2pXVUVCYXlJQVFRQk1CRUFqVVFSQUkxcEJBQ05SSWdBYkJFQWpYQ0lCUVFGcUlBRkJBV3NqVUJ0QkQzRWlBVUVQU1FSQUlBRWtYQVZCQUNSYUN3c0ZRUWdoQUFzTElBQWtXU053UVFGcklnQkJBRXdFUUNOb0JFQWpjVUVBSTJnaUFCc0VRQ056SWdGQkFXb2dBVUVCYXlObkcwRVBjU0lCUVE5SkJFQWdBU1J6QlVFQUpIRUxDd1ZCQ0NFQUN3c2dBQ1J3STVFQlFRRnJJZ0JCQUV3RVFDT0pBUVJBSTVJQlFRQWppUUVpQUJzRVFDT1VBU0lCUVFGcUlBRkJBV3NqaUFFYlFROXhJZ0ZCRDBrRVFDQUJKSlFCQlVFQUpKSUJDd3NGUVFnaEFBc0xJQUFra1FFTElBSWtzUUZCQVE4RklBQWtzQUVMUVFBTHdRRUJBWDhqV0NBQWF5RUFBMEFnQUVFQVRBUkFRWUFRSTFkclFRSjBJZ0ZCQW5RZ0FTUC9BUnNrV0NOWUlBQkJIM1VpQVNBQUlBRnFjMnNoQUNOZVFRRnFRUWR4SkY0TUFRc0xJQUFrV0NOV1FRQWpWUnNFZnlOY1FROXhCVUVQRHdzaEFBSi9JMTRoQVFKQUFrQUNRQUpBSTAxQkFXc09Bd0FCQWdNTFFRRWdBWFJCZ1FGeFFRQkhEQU1MUVFFZ0FYUkJod0Z4UVFCSERBSUxRUUVnQVhSQi9nQnhRUUJIREFFTFFRRWdBWFJCQVhFTEJIOUJBUVZCZndzZ0FHeEJEMm9MdWdFQkFYOGpieUFBYXlFQUEwQWdBRUVBVEFSQVFZQVFJMjVyUVFKMEkvOEJkQ1J2STI4Z0FFRWZkU0lCSUFBZ0FXcHpheUVBSTNWQkFXcEJCM0VrZFF3QkN3c2dBQ1J2STIxQkFDTnNHd1IvSTNOQkQzRUZRUThQQ3lFQUFuOGpkU0VCQWtBQ1FBSkFBa0FqWkVFQmF3NERBQUVDQXd0QkFTQUJkRUdCQVhGQkFFY01Bd3RCQVNBQmRFR0hBWEZCQUVjTUFndEJBU0FCZEVIK0FIRkJBRWNNQVF0QkFTQUJkRUVCY1FzRWYwRUJCVUYvQ3lBQWJFRVBhZ3VJQWdFRGZ5TjlSVUVCSTN3YkJFQkJEdzhMSTRJQklRTWpnd0VFUUVHYy9nTVFDeTBBQUVFRmRpSURKSUlCUVFBa2d3RUxJNFFCSTRFQlFRRnhSVUVDZEhWQkQzRWhBZ0pBQWtBQ1FBSkFBa0FnQXc0REFBRUNBd3NnQWtFRWRTRUNEQU1MUVFFaEFRd0NDeUFDUVFGMUlRSkJBaUVCREFFTElBSkJBblVoQWtFRUlRRUxJQUZCQUVzRWZ5QUNJQUZ0QlVFQUMwRVBhaUVDSTM4Z0FHc2hBQU5BSUFCQkFFd0VRRUdBRUNOK2EwRUJkQ1AvQVhRa2Z5Ti9JQUJCSDNVaUFTQUFJQUZxYzJzaEFDT0JBVUVCYWlFQkEwQWdBVUVnVGdSQUlBRkJJR3NoQVF3QkN3c2dBU1NCQVNPQkFVRUJkVUd3L2dOcUVBc3RBQUFraEFFTUFRc0xJQUFrZnlBQ0M0OEJBUUovSTVBQklBQnJJZ0JCQUV3RVFDT1ZBU09LQVhRai93RjBJQUJCSDNVaUFTQUFJQUZxYzJzaEFDT1dBU0lCUVFGMUlnSWdBVUVCY1NBQ1FRRnhjeUlCUVE1MGNpSUNRYjkvY1NBQlFRWjBjaUFDSTRzQkd5U1dBUXRCQUNBQUlBQkJBRWdiSkpBQkk0OEJRUUFqamdFYkJIOGpsQUZCRDNFRlFROFBDMEYvUVFFamxnRkJBWEViYkVFUGFndmxBUUVCZjBFQUpLRUJJQUJCRHlPckFSc2dBVUVQSTZ3Qkcyb2dBa0VQSTYwQkcyb2dBMEVQSTY0Qkcyb2hCRUVBSktJQlFRQWtvd0VDZjBIL0FDQUFRUThqcHdFYklBRkJEeU9vQVJ0cUlBSkJEeU9wQVJ0cUlBTkJEeU9xQVJ0cUlnQkJQRVlOQUJvanBRRkJBV29nQUVFOGEwR2dqUVpzYkVFRGRVR2dqUVp0UVR4cVFhQ05CbXhCalBFQ2JRc2hBZ0ovSTZZQlFRRnFJUUZCL3dBZ0JFRThSZzBBR2lBQklBUkJQR3RCb0kwR2JHeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMSVFBZ0FpU2ZBU0FBSktBQklBQkIvd0Z4SUFKQi93RnhRUWgwY2d1Y0F3RUZmeUFBSTBscUlnRWtTU05ZSUFGclFRQk1JZ0ZGQkVBalZpSUNJNXNCUnlFQklBSWttd0VMSUFBalkyb2lBaVJqSTI4Z0FtdEJBRXdpQWtVRVFDTnRJZ1FqbkFGSElRSWdCQ1NjQVFzZ0FDTjJhaVIyUVFBamZ5TjJhMEVBU2lPREFSdEZJZ1JGQkVBamZTSUZJNTBCUnlFRUlBVWtuUUVMSUFBamhRRnFKSVVCSTVBQkk0VUJhMEVBVENJRlJRUkFJNDhCSWdNam5nRkhJUVVnQXlTZUFRc2dBUVJBSTBraEEwRUFKRWtnQXhBc0pKY0JDeUFDQkVBall5RURRUUFrWXlBREVDMGttQUVMSUFRRVFDTjJJUU5CQUNSMklBTVFMaVNaQVFzZ0JRUkFJNFVCSVFOQkFDU0ZBU0FERUM4a21nRUxRUUVnQlVFQklBUkJBU0FDSUFFYkd4c0VRRUVCSktNQkN5QUFJN0lCYWlJQVFZQ0FnQUlqL3dGMFFjVFlBbTBpQVU0RVFDQUFJQUZySVFCQkFTT2lBVUVCSTZFQkk2TUJHeHNFUUNPWEFTT1lBU09aQVNPYUFSQXdHZ1VnQUNTeUFRc2pzd0VpQVVFQmRFR0FtY0VBYWlJQ0k1OEJRUUpxT2dBQUlBSWpvQUZCQW1vNkFBRWdBVUVCYWlJQlFmLy9BMDRFZnlBQlFRRnJCU0FCQ3lTekFRc2dBQ1N5QVF1V0F3RUdmeUFBRUN3aEFTQUFFQzBoQWlBQUVDNGhCQ0FBRUM4aEJTQUJKSmNCSUFJa21BRWdCQ1NaQVNBRkpKb0JJQUFqc2dGcUlnQkJnSUNBQWlQL0FYUkJ4TmdDYlU0RVFDQUFRWUNBZ0FJai93RjBRY1RZQW0xcklRQWdBU0FDSUFRZ0JSQXdJUU1qc3dGQkFYUkJnSm5CQUdvaUJpQURRWUQrQTNGQkNIWkJBbW82QUFBZ0JpQURRZjhCY1VFQ2Fqb0FBU002QkVBZ0FVRVBRUTlCRHhBd0lRRWpzd0ZCQVhSQmdKa2hhaUlESUFGQmdQNERjVUVJZGtFQ2Fqb0FBQ0FESUFGQi93RnhRUUpxT2dBQlFROGdBa0VQUVE4UU1DRUJJN01CUVFGMFFZQ1pLV29pQWlBQlFZRCtBM0ZCQ0haQkFtbzZBQUFnQWlBQlFmOEJjVUVDYWpvQUFVRVBRUThnQkVFUEVEQWhBU096QVVFQmRFR0FtVEZxSWdJZ0FVR0EvZ054UVFoMlFRSnFPZ0FBSUFJZ0FVSC9BWEZCQW1vNkFBRkJEMEVQUVE4Z0JSQXdJUUVqc3dGQkFYUkJnSms1YWlJQ0lBRkJnUDREY1VFSWRrRUNham9BQUNBQ0lBRkIvd0Z4UVFKcU9nQUJDeU96QVVFQmFpSUJRZi8vQTA0RWZ5QUJRUUZyQlNBQkN5U3pBUXNnQUNTeUFRdEJBUUovUWRjQUkvOEJkQ0VBSTZRQklRRURRQ0FCSUFCT0JFQWdBQkFyUlVFQUl6Y2JCRUFnQUJBeEJTQUFFRElMSUFFZ0FHc2hBUXdCQ3dzZ0FTU2tBUXZLQXdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdRL2dOckRoY0FCUW9QRXdFR0N4QVVBZ2NNRVJVRENBMFNGZ1FKRGhjTFFaRCtBeEFMTFFBQVFZQUJjZzhMUVpYK0F4QUxMUUFBUWY4QmNnOExRWnIrQXhBTExRQUFRZjhBY2c4TFFaLytBeEFMTFFBQVFmOEJjZzhMUWFUK0F4QUxMUUFBRHd0QmtmNERFQXN0QUFCQlAzSVBDMEdXL2dNUUN5MEFBRUUvY2c4TFFaditBeEFMTFFBQVFmOEJjZzhMUWFEK0F4QUxMUUFBUWY4QmNnOExRYVgrQXhBTExRQUFEd3RCa3Y0REVBc3RBQUFQQzBHWC9nTVFDeTBBQUE4TFFaeitBeEFMTFFBQVFaOEJjZzhMUWFIK0F4QUxMUUFBRHd0QmdBRkJBQ092QVJzaUFFRUJjaUFBUVg1eEkxVWJJZ0JCQW5JZ0FFRjljU05zR3lJQVFRUnlJQUJCZTNFamZCc2lBRUVJY2lBQVFYZHhJNDRCRzBId0FISVBDMEdUL2dNUUN5MEFBRUgvQVhJUEMwR1kvZ01RQ3kwQUFFSC9BWElQQzBHZC9nTVFDeTBBQUVIL0FYSVBDMEdpL2dNUUN5MEFBQThMUVpUK0F4QUxMUUFBUWI4QmNnOExRWm4rQXhBTExRQUFRYjhCY2c4TFFaNytBeEFMTFFBQVFiOEJjZzhMUWFQK0F4QUxMUUFBUWI4QmNnOExRWDhMalFFQkFYOGoxd0VoQUNQWUFRUi9JQUJCZTNFZ0FFRUVjaVBQQVJzaUFFRitjU0FBUVFGeUk5SUJHeUlBUVhkeElBQkJDSElqMEFFYklnQkJmWEVnQUVFQ2NpUFJBUnNGSTlrQkJIOGdBRUYrY1NBQVFRRnlJOU1CR3lJQVFYMXhJQUJCQW5JajFBRWJJZ0JCZTNFZ0FFRUVjaVBWQVJzaUFFRjNjU0FBUVFoeUk5WUJHd1VnQUFzTFFmQUJjZ3YwQWdFQmZ5QUFRWUNBQWtnRVFFRi9Ed3NnQUVHQXdBSklRUUFnQUVHQWdBSk9Hd1JBUVg4UEN5QUFRWUQ4QTBoQkFDQUFRWURBQTA0YkJFQWdBRUdBUUdvUUN5MEFBQThMSUFCQm4vMERURUVBSUFCQmdQd0RUaHNFUUVIL0FVRi9JOTRCUVFKSUd3OExJQUJCemY0RFJnUkFRYzMrQXhBTExRQUFRUUZ4Qkg5Qi93RUZRZjRCQ3lJQUlBQkIvMzV4SS84Qkd3OExJQUJCeFA0RFJnUkFJK29CSVFFZ0FCQUxJQUU2QUFBajZnRVBDeUFBUWFiK0EweEJBQ0FBUVpEK0EwNGJCRUFRTXlBQUVEUVBDeUFBUWEvK0EweEJBQ0FBUWFmK0EwNGJCRUJCL3dFUEN5QUFRYi8rQTB4QkFDQUFRYkQrQTA0YkJFQVFNeU44QkVBamdRRkJBWFZCc1A0RGFoQUxMUUFBRHd0QmZ3OExJQUJCaFA0RFJnUkFJOE1CUVlEK0EzRkJDSFloQVNBQUVBc2dBVG9BQUNBQkR3c2dBRUdGL2dOR0JFQWp4QUVoQVNBQUVBc2dBVG9BQUNQRUFROExJQUJCai80RFJnUkFJN3dCUWVBQmNnOExJQUJCZ1A0RFJnUkFFRFVQQzBGL0N5d0JBWDhnQUNQYkFVWUVRRUVCSk4wQkN5QUFFRFlpQVVGL1JnUi9JQUFRQ3kwQUFBVWdBVUgvQVhFTEM1b0NBUUovSS9NQkJFQVBDeVAwQVNFREkvVUJJUUlnQUVIL1Awd0VRQ0FCUVJCeFJVRUFJQUliUlFSQUlBRkJEM0VpQUFSQUlBQkJDa1lFUUVFQkpQRUJDd1ZCQUNUeEFRc0xCU0FBUWYvL0FFd0VRQ0FBUWYvZkFFeEJBU1AzQVNJQUd3UkFJQUZCRDNFajd3RWdBaHNoQWlBREJIOGdBVUVmY1NFQklBSkI0QUZ4QlNQMkFRUi9JQUZCL3dCeElRRWdBa0dBQVhFRlFRQWdBaUFBR3dzTElBRnlKTzhCQlNQdkFVSC9BWEVnQVVFQVNrRUlkSElrN3dFTEJVRUFJQUJCLzc4QlRDQUNHd1JBSS9JQlFRQWdBeHNFUUNQdkFVRWZjU0FCUWVBQmNYSWs3d0VQQ3lBQlFROXhJQUZCQTNFajl3RWJKUEFCQlVFQUlBQkIvLzhCVENBQ0d3UkFJQU1FUUNBQlFRRnhRUUJISlBJQkN3c0xDd3NMcWdFQkFuOUJBU1JWSTF0RkJFQkJ3QUFrV3d0QmdCQWpWMnRCQW5RaUFFRUNkQ0FBSS84Qkd5UllJMUVFUUNOUkpGa0ZRUWdrV1F0QkFTUmFJMDhrWENOWEpHRWpTZ1JBSTBva1lBVkJDQ1JnQzBFQkkweEJBRW9pQUNOS1FRQktHeVJmUVFBa1lpQUFCSDhDZnlOaElnQWpUSFVoQVVFQkkwc0VmMEVCSkdJZ0FDQUJhd1VnQUNBQmFndEIvdzlLRFFBYVFRQUxCVUVBQ3dSQVFRQWtWUXNqVmtVRVFFRUFKRlVMQzQwQkFRSi9JQUJCQjNFaUFTUlVJMUlnQVVFSWRISWtWeU5UUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNqc1FGQkFYRWlBa1VFUUNBQlFRQWpXMEVBU2hzRVFDTmJRUUZySkZ0QkFDTmJSU0FBUVlBQmNSc0VRRUVBSkZVTEN3c2dBRUhBQUhGQkFFY2tVeUFBUVlBQmNRUkFFRGtqVTBFQVFRQWpXMEhBQUVZZ0Foc2JCRUFqVzBFQmF5UmJDd3NMeXdFQkFuOGdBRUVIY1NJQ0pHc2phU0FDUVFoMGNpUnVJN0VCUVFGeElRSWpha1VpQVFSQUlBQkJ3QUJ4UVFCSElRRUxJQUpGQkVBZ0FVRUFJM0pCQUVvYkJFQWpja0VCYXlSeVFRQWpja1VnQUVHQUFYRWJCRUJCQUNSc0N3c0xJQUJCd0FCeFFRQkhKR29nQUVHQUFYRUVRRUVCSkd3amNrVUVRRUhBQUNSeUMwR0FFQ051YTBFQ2RDUC9BWFFrYnlOb0JFQWphQ1J3QlVFSUpIQUxRUUVrY1NObUpITWpiVVVFUUVFQUpHd0xJMnBCQUVFQUkzSkJ3QUJHSUFJYkd3UkFJM0pCQVdza2Nnc0xDNzRCQVFGL0lBQkJCM0VpQVNSN0kza2dBVUVJZEhJa2ZpT3hBVUVCY1NJQlJRUkFRUUFnQUVIQUFIRWplaHRCQUNPQUFVRUFTaHNFUUNPQUFVRUJheVNBQVVFQUk0QUJSU0FBUVlBQmNSc0VRRUVBSkh3TEN3c2dBRUhBQUhGQkFFY2tlaUFBUVlBQmNRUkFRUUVrZkNPQUFVVUVRRUdBQWlTQUFRdEJnQkFqZm10QkFYUWovd0YwSkg4amYwRUdhaVIvUVFBa2dRRWpmVVVFUUVFQUpId0xJM3BCQUVFQUk0QUJRWUFDUmlBQkd4c0VRQ09BQVVFQmF5U0FBUXNMQzlNQkFRSi9JNDBCUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNqc1FGQkFYRWlBa1VFUUNBQlFRQWprd0ZCQUVvYkJFQWprd0ZCQVdza2t3RkJBQ09UQVVVZ0FFR0FBWEViQkVCQkFDU09BUXNMQ3lBQVFjQUFjVUVBUnlTTkFTQUFRWUFCY1FSQVFRRWtqZ0Vqa3dGRkJFQkJ3QUFra3dFTEk1VUJJNG9CZENQL0FYUWtrQUVqaVFFRVFDT0pBU1NSQVFWQkNDU1JBUXRCQVNTU0FTT0hBU1NVQVVILy93RWtsZ0VqandGRkJFQkJBQ1NPQVFzampRRkJBRUVBSTVNQlFjQUFSaUFDR3hzRVFDT1RBVUVCYXlTVEFRc0xDOWNIQUNPdkFVVkJBQ0FBUWFiK0EwY2JCRUJCQUE4TEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR1EvZ05yRGhjQUFnWUtEaFVEQndzUEFRUUlEQkFWQlFrTkVSSVRGQlVMSTBzaEFDQUJRZkFBY1VFRWRpUktJQUZCQ0hGQkFFY2tTeUFCUVFkeEpFd2pZa0VBSTB0RlFRQWdBQnNiQkVCQkFDUlZDd3dVQzBFQUlBRkJnQUZ4UVFCSElnQWpmUnNFUUVFQUpJUUJDeUFBSkgwZ0FFVUVRQ0FBSkh3TERCTUxJQUZCQm5WQkEzRWtUU0FCUVQ5eEpFNUJ3QUFqVG1za1d3d1NDeUFCUVFaMVFRTnhKR1FnQVVFL2NTUmxRY0FBSTJWckpISU1FUXNnQVNSM1FZQUNJM2RySklBQkRCQUxJQUZCUDNFa2hnRkJ3QUFqaGdGckpKTUJEQThMSTFVRVFFRUFJMW9qVVJzRVFDTmNRUUZxUVE5eEpGd0xJMUFnQVVFSWNVRUFSMGNFUUVFUUkxeHJRUTl4SkZ3TEN5QUJRUVIxUVE5eEpFOGdBVUVJY1VFQVJ5UlFJQUZCQjNFa1VTQUJRZmdCY1VFQVN5SUFKRllnQUVVRVFFRUFKRlVMREE0TEkyd0VRRUVBSTNFamFCc0VRQ056UVFGcVFROXhKSE1MSTJjZ0FVRUljVUVBUjBjRVFFRVFJM05yUVE5eEpITUxDeUFCUVFSMVFROXhKR1lnQVVFSWNVRUFSeVJuSUFGQkIzRWthQ0FCUWZnQmNVRUFTeUlBSkcwZ0FFVUVRQ0FBSkd3TERBMExRUUVrZ3dFZ0FVRUZkVUVQY1NSNERBd0xJNDRCQkVCQkFDT1NBU09KQVJzRVFDT1VBVUVCYWtFUGNTU1VBUXNqaUFFZ0FVRUljVUVBUjBjRVFFRVFJNVFCYTBFUGNTU1VBUXNMSUFGQkJIVkJEM0VraHdFZ0FVRUljVUVBUnlTSUFTQUJRUWR4SklrQklBRkIrQUZ4UVFCTElnQWtqd0VnQUVVRVFDQUFKSTRCQ3d3TEN5QUJKRklnQVNOVVFRaDBjaVJYREFvTElBRWthU0FCSTJ0QkNIUnlKRzRNQ1FzZ0FTUjVJQUVqZTBFSWRISWtmZ3dJQ3lBQlFRUjFKSW9CSUFGQkNIRkJBRWNraXdFZ0FVRUhjU0lBSkl3QklBQkJBWFFpQUVFQlNBUi9RUUVGSUFBTFFRTjBKSlVCREFjTElBRVFPZ3dHQ3lBQkVEc01CUXNnQVJBOERBUUxJQUVRUFF3REN5QUJRUVIxUVFkeEpLVUJJQUZCQjNFa3BnRkJBU1NoQVF3Q0N5QUJRWUFCY1VFQVJ5U3FBU0FCUWNBQWNVRUFSeVNwQVNBQlFTQnhRUUJISktnQklBRkJFSEZCQUVja3B3RWdBVUVJY1VFQVJ5U3VBU0FCUVFSeFFRQkhKSzBCSUFGQkFuRkJBRWNrckFFZ0FVRUJjVUVBUnlTckFVRUJKS0lCREFFTEk2OEJJZ0FFZjBFQUJTQUJRWUFCY1FzRVFFRUhKTEVCUVFBa1hrRUFKSFVMSUFGQmdBRnhSVUVBSUFBYkJFQkJrUDRESVFBRFFDQUFRYWIrQTBnRVFDQUFRUUFRUkNBQVFRRnFJUUFNQVFzTEN5QUJRWUFCY1VFQVJ5U3ZBUXRCQVF0ZkFRSi9RUUFrNlFGQkFDVHFBVUhFL2dNUUMwRUFPZ0FBUWNIK0F4QUxMUUFBUVh4eElRSkJBQ1RlQVVIQi9nTVFDeUFDT2dBQUlBQUVRQU5BSUFGQmdOZ0ZTQVJBSUFGQmdNa0Zha0gvQVRvQUFDQUJRUUZxSVFFTUFRc0xDd3ZKQVFFRGZ5UCtBVVVFUUE4TElBQkJnQUZ4UlVFQUkva0JHd1JBUVFBaytRRkIxZjRERUFzdEFBQkJnQUZ5SVFCQjFmNERFQXNnQURvQUFBOExRZEgrQXhBTExRQUFRUWgwUWRMK0F4QUxMUUFBY2tIdy93TnhJUUZCMC80REVBc3RBQUJCQ0hSQjFQNERFQXN0QUFCeVFmQS9jVUdBZ0FKcUlRSWdBRUgvZm5GQkFXcEJCSFFoQXlBQVFZQUJjUVJBUVFFaytRRWdBeVQ2QVNBQkpQc0JJQUlrL0FGQjFmNERFQXNnQUVIL2ZuRTZBQUFGSUFFZ0FpQURFRVZCMWY0REVBdEIvd0U2QUFBTEM4TUJBUVIvQTBBZ0FpQUFTQVJBSUFKQkJHb2hBaVBEQVNJQlFRUnFRZi8vQTNFaUF5VERBU1BKQVFSQUk4WUJJUVFqeFFFRVFDUElBU1RFQVVFQkpMOEJRUUlRS1VFQUpNVUJRUUVreGdFRklBUUVRRUVBSk1ZQkN3c2dBVUVCQW44Q1FBSkFBa0FDUUFKQUk4b0JEZ1FBQVFJREJBdEJDUXdFQzBFRERBTUxRUVVNQWd0QkJ3d0JDMEVBQ3lJQmRIRUVmeUFEUVFFZ0FYUnhSUVZCQUFzRVFDUEVBVUVCYWlJQlFmOEJTZ1IvUVFFa3hRRkJBQVVnQVFza3hBRUxDd3dCQ3dzTHl3RUJBMzhqeVFFaEFTQUFRUVJ4UVFCSEpNa0JJQUJCQTNFaEF5QUJSUVJBQW44Q1FBSkFBa0FDUUFKQUk4b0JEZ1FBQVFJREJBdEJDUXdFQzBFRERBTUxRUVVNQWd0QkJ3d0JDMEVBQ3lFQkFuOENRQUpBQWtBQ1FBSkFJQU1PQkFBQkFnTUVDMEVKREFRTFFRTU1Bd3RCQlF3Q0MwRUhEQUVMUVFBTElRQWp3d0VoQWlQSkFRUi9JQUpCQVNBQmRIRUZJQUpCQVNBQWRIRkJBQ0FDUVFFZ0FYUnhHd3NFUUNQRUFVRUJhaUlBUWY4QlNnUi9RUUVreFFGQkFBVWdBQXNreEFFTEN5QURKTW9CQzdvS0FRTi9Ba0FDUUNBQVFjMytBMFlFUUVITi9nTVFDeUFCUVFGeE9nQUFEQUVMSUFCQjBQNERSa0VBSS8wQkd3UkFRUUFrL1FGQi93RWtpUUlNQWdzZ0FFR0FnQUpJQkVBZ0FDQUJFRGdNQVFzZ0FFR0F3QUpJUVFBZ0FFR0FnQUpPR3cwQklBQkJnUHdEU0VFQUlBQkJnTUFEVGhzRVFDQUFRWUJBYWhBTElBRTZBQUFNQWdzZ0FFR2YvUU5NUVFBZ0FFR0EvQU5PR3dSQUk5NEJRUUpPRHdzZ0FFSC8vUU5NUVFBZ0FFR2cvUU5PR3cwQUlBQkJndjREUmdSQUlBRkJBbkZCQUVja3pRRWdBVUdBQVhGQkFFY2t6Z0ZCQVE4TElBQkJwdjREVEVFQUlBQkJrUDREVGhzRVFCQXpJQUFnQVJBK0R3c2dBRUcvL2dOTVFRQWdBRUd3L2dOT0d3UkFFRE1qZkFSQUk0RUJRUUYxUWJEK0Eyb1FDeUFCT2dBQURBSUxEQUlMSUFCQnkvNERURUVBSUFCQndQNERUaHNFUUNBQVFjRCtBMFlFUUNQZ0FTRUFJQUZCZ0FGeFFRQkhKT0FCSUFGQndBQnhRUUJISk9FQklBRkJJSEZCQUVjazRnRWdBVUVRY1VFQVJ5VGpBU0FCUVFoeFFRQkhKT1FCSUFGQkJIRkJBRWNrNVFFZ0FVRUNjVUVBUnlUbUFTQUJRUUZ4UVFCSEpPY0JJK0FCUlVFQUlBQWJCRUJCQVJBL0MwRUFJK0FCSUFBYkJFQkJBQkEvQ3d3REN5QUFRY0grQTBZRVFDQUJRZmdCY1VIQi9nTVFDeTBBQUVFSGNYSkJnQUZ5SVFCQndmNERFQXNnQURvQUFBd0NDeUFBUWNUK0EwWUVRRUVBSk9vQklBQVFDMEVBT2dBQURBSUxJQUJCeGY0RFJnUkFJQUVrM3dFTUF3c2dBRUhHL2dOR0JFQkJBQ0VBSUFGQkNIUWhBUU5BSUFCQm53Rk1CRUFnQUNBQmFoQUxMUUFBSVFJZ0FFR0EvQU5xRUFzZ0Fqb0FBQ0FBUVFGcUlRQU1BUXNMUVlRRkpQZ0JEQU1MQWtBQ1FBSkFBa0FnQUVIRC9nTkhCRUFnQUVIQy9nTnJEZ29CQkFRRUJBUUVCQU1DQkFzZ0FTVHJBUXdHQ3lBQkpPd0JEQVVMSUFFazdRRU1CQXNnQVNUdUFRd0RDd3dDQ3lBQVFkWCtBMFlFUUNBQkVFQU1BUXRCQVNBQVFjLytBMFlnQUVIdy9nTkdHd1JBSS9rQkJFQWord0VpQWtILy93Rk1RUUFnQWtHQWdBRk9Hd1IvUVFFRklBSkIvNzhEVEVFQUlBSkJnS0FEVGhzTERRSUxDeUFBUWV2K0EweEJBQ0FBUWVqK0EwNGJCRUJCQVNBQVFlditBMFlnQUVIcC9nTkdHd1JBSUFCQkFXc2lBeEFMTFFBQVFiOS9jU0lDUVQ5eElnUkJRR3NnQkNBQVFlditBMFliUVlDUUJHb2dBVG9BQUNBQ1FZQUJjUVJBSUFNUUN5QUNRUUZxUVlBQmNqb0FBQXNMREFJTElBQkJoLzREVEVFQUlBQkJoUDREVGhzRVFDUENBUkJCUVFBa3dnRUNRQUpBQWtBQ1FDQUFRWVQrQTBjRVFDQUFRWVgrQTJzT0F3RUNBd1FMSThNQklRQkJBQ1REQVVHRS9nTVFDMEVBT2dBQUk4a0JCSDhnQUVFQkFuOENRQUpBQWtBQ1FBSkFJOG9CRGdRQUFRSURCQXRCQ1F3RUMwRUREQU1MUVFVTUFndEJCd3dCQzBFQUMzUnhCVUVBQ3dSQUk4UUJRUUZxSWdCQi93RktCSDlCQVNURkFVRUFCU0FBQ3lURUFRc01CUXNDUUNQSkFRUkFJOFlCRFFFanhRRUVRRUVBSk1VQkN3c2dBU1RFQVFzTUJRc2dBU1RJQVNQR0FVRUFJOGtCR3dSQUlBRWt4QUZCQUNUR0FRc01CQXNnQVJCQ0RBTUxEQUlMSUFCQmdQNERSZ1JBSUFGQi93RnpKTmNCSTljQklnSkJFSEZCQUVjazJBRWdBa0VnY1VFQVJ5VFpBUXNnQUVHUC9nTkdCRUFnQVVFQmNVRUFSeVM5QVNBQlFRSnhRUUJISkw0QklBRkJCSEZCQUVja3Z3RWdBVUVJY1VFQVJ5VEFBU0FCUVJCeFFRQkhKTUVCSUFFa3ZBRU1BZ3NnQUVILy93TkdCRUFnQVVFQmNVRUFSeVMzQVNBQlFRSnhRUUJISkxnQklBRkJCSEZCQUVja3VRRWdBVUVJY1VFQVJ5UzZBU0FCUVJCeFFRQkhKTHNCSUFFa3RnRU1BZ3NNQVF0QkFBOExRUUVMSWdBZ0FDUGNBVVlFUUVFQkpOMEJDeUFBSUFFUVF3UkFJQUFRQ3lBQk9nQUFDd3RZQVFOL0EwQWdBeUFDU0FSQUlBQWdBMm9RTnlFRklBRWdBMm9oQkFOQUlBUkIvNzhDU2dSQUlBUkJnRUJxSVFRTUFRc0xJQVFnQlJCRUlBTkJBV29oQXd3QkN3c2orQUZCSUNQL0FYUWdBa0VFZFd4cUpQZ0JDem9BSStvQkk5OEJSa0VBSUFCQkFVWkJBU0FBR3hzRVFDQUJRUVJ5SWdGQndBQnhCRUJCQVNTK0FVRUJFQ2tMQlNBQlFYdHhJUUVMSUFFTC9BSUJCSDhqNEFGRkJFQVBDeVBxQVNJQ1FaQUJUZ1IvUVFFRkkra0JJZ0JCK0FJai93RjBJZ0ZPQkg5QkFnVkJBMEVBSUFBZ0FVNGJDd3NpQUNQZUFVY0VRRUhCL2dNUUN5MEFBQ0VESUFBazNnRkJBQ0VCQWtBQ1FBSkFBa0FnQUNJQ0JFQWdBa0VCYXc0REFRSURCQXNnQTBGOGNTSURRUWh4UVFCSElRRU1Bd3NnQTBGOWNVRUJjaUlEUVJCeFFRQkhJUUVNQWdzZ0EwRitjVUVDY2lJRFFTQnhRUUJISVFFTUFRc2dBMEVEY2lFREN5QUJCRUJCQVNTK0FVRUJFQ2tMSUFKRkJFQWorUUVFUUNQN0FTUDhBU1A2QVNJQlFSQklCSDhnQVFWQkVBc2lBQkJGSUFBait3RnFKUHNCSUFBai9BRnFKUHdCSUFFZ0FHc2lBQ1Q2QVNBQVFRQk1CRUJCQUNUNUFVSFYvZ01RQzBIL0FUb0FBQVZCMWY0REVBc2dBRUVFZFVFQmEwSC9mbkU2QUFBTEN3c2dBa0VCUmdSQVFRRWt2UUZCQUJBcEN5QUNJQU1RUmlFQVFjSCtBeEFMSUFBNkFBQUZJQUpCbVFGR0JFQWdBRUhCL2dNUUN5MEFBQkJHSVFCQndmNERFQXNnQURvQUFBc0xDNEFDQVFOL0krQUJCRUFnQUNQcEFXb2s2UUVqTmlFREEwQWo2UUZCQkNQL0FTSUFkRUhJQXlBQWRDUHFBVUdaQVVZYlRnUkFJK2tCUVFRai93RWlBSFJCeUFNZ0FIUWo2Z0VpQVVHWkFVWWJheVRwQVNBQlFaQUJSZ1JBSUFNRVFFRUFJUUFEUUNBQVFaQUJUQVJBSUFCQi93RnhFQ2dnQUVFQmFpRUFEQUVMQ3dVZ0FSQW9DMEVBSVFBRFFDQUFRWkFCU0FSQVFRQWhBZ05BSUFKQm9BRklCRUFnQWlBQVFhQUJiR3BCZ0pFRWFrRUFPZ0FBSUFKQkFXb2hBZ3dCQ3dzZ0FFRUJhaUVBREFFTEMwRi9KRWRCZnlSSUJTQUJRWkFCU0FSQUlBTkZCRUFnQVJBb0N3c0xRUUFnQVVFQmFpQUJRWmtCU2hzazZnRU1BUXNMQ3hCSEM4WUJBUU4vSTg0QlJRUkFEd3NEUUNBRElBQklCRUFnQTBFRWFpRURBbjhqeXdFaUFrRUVhaUlCUWYvL0Ewb0VRQ0FCUVlDQUJHc2hBUXNnQVFza3l3RWdBa0VCUVFKQkJ5UE5BUnNpQW5SeEJIOGdBVUVCSUFKMGNVVUZRUUFMQkVCQmdmNERFQXN0QUFCQkFYUkJBV3BCL3dGeElRRkJnZjRERUFzZ0FUb0FBQ1BNQVVFQmFpSUJRUWhHQkVCQkFDVE1BVUVCSk1BQlFRTVFLVUdDL2dNUUN5MEFBRUgvZm5FaEFVR0MvZ01RQ3lBQk9nQUFRUUFremdFRklBRWt6QUVMQ3d3QkN3c0wzQUVCQVg4aitBRkJBRW9FUUNBQUkvZ0JhaUVBUVFBaytBRUxJQUFqaWdKcUpJb0NJNDRDUlFSQUl6UUVRQ0FBSStnQmFpVG9BVUVFSS84QklnRjBRY2dESUFGMEkrb0JRWmtCUmhzaEFRTkFJK2dCSUFGT0JFQWdBUkJJSStnQklBRnJKT2dCREFFTEN3VWdBQkJJQ3lNekJFQWdBQ09rQVdva3BBRVFNd1VnQUJBclJVRUFJemNiQkVBZ0FCQXhCU0FBRURJTEN5QUFFRWtMSXpVRVFDQUFJOElCYWlUQ0FTUENBUkJCUVFBa3dnRUZJQUFRUVFzZ0FDT1JBbW9pQUNPUEFrNEVmeU9RQWtFQmFpU1FBaUFBSTQ4Q2F3VWdBQXNra1FJTExBRUJmMEVFRUVvamlRSkJBV3BCLy84RGNSQUxMUUFBUVFoMElRQkJCQkJLSUFBamlRSVFDeTBBQUhJTFB3RUJmeUFCUVlEK0EzRkJDSFloQWlBQUlBRkIvd0Z4SWdFUVF3UkFJQUFRQ3lBQk9nQUFDeUFBUVFGcUlnQWdBaEJEQkVBZ0FCQUxJQUk2QUFBTEM4WUJBQ0FDQkVBZ0FTQUFRZi8vQTNFaUFITWdBQ0FCYW5NaUFFRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRWUFDY1VFQVIwRUFTd1JBSTRjQ1FSQnlRZjhCY1NTSEFnVWpod0pCN3dGeEpJY0NDd1VnQUNBQmFrSC8vd054SWdJZ0FFSC8vd054U1VFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUNJQUFnQVhOelFZQWdjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N3c0xtZ2dCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUE0UUV3QUJBZ01FQlFZSENBa0tDd3dORGc4TEVFdEIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2dRSWdBRUgvQVhFa2dnSU1Ed3NqZ2dKQi93RnhJNEVDUWY4QmNVRUlkSEloQUNPQUFpRUJRUVFRU2lBQUlBRVFSQXdSQ3lPQ0FrSC9BWEVqZ1FKQi93RnhRUWgwY2tFQmFrSC8vd054SVFBTUVRc2pnUUlpQUVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGcVFmOEJjU0lBSklFQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJTUR3dEJBU09CQWlJQVFROXhTMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnJRZjhCY1NJQUpJRUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDREE0TFFRUVFTaU9KQWhBTExRQUFKSUVDREFzTEk0QUNJZ0JCZ0FGeFFZQUJSa0VBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3lBQVFRRjBJQUJCL3dGeFFRZDJja0gvQVhFa2dBSU1Dd3NRUzBILy93TnhJUUFqaUFJaEFVRUlFRW9nQUNBQkVFd01DQXNqaGdKQi93RnhJNFVDUWY4QmNVRUlkSElpQUNPQ0FrSC9BWEVqZ1FKQi93RnhRUWgwY2lJQlFRQVFUU0FBSUFGcVFmLy9BM0VpQUVHQS9nTnhRUWgySklVQ0lBQkIvd0Z4SklZQ0k0Y0NRYjhCY1NTSEFrRUlEd3NqZ2dKQi93RnhJNEVDUWY4QmNVRUlkSEloQUVFRUVFb2dBQkEzUWY4QmNTU0FBZ3dKQ3lPQ0FrSC9BWEVqZ1FKQi93RnhRUWgwY2tFQmEwSC8vd054SVFBTUNRc2pnZ0lpQUVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGcVFmOEJjU0lBSklJQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJTUJ3dEJBU09DQWlJQVFROXhTMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnJRZjhCY1NJQUpJSUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDREFZTFFRUVFTaU9KQWhBTExRQUFKSUlDREFNTEk0QUNJZ0JCQVhGQkFFdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQUVFSGRDQUFRZjhCY1VFQmRuSkIvd0Z4SklBQ0RBTUxRWDhQQ3lPSkFrRUNha0gvL3dOeEpJa0NEQUlMSTRrQ1FRRnFRZi8vQTNFa2lRSU1BUXNqaHdKQi93QnhKSWNDSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJTFFRUVBDeUFBUVlEK0EzRkJDSFlrZ1FJZ0FFSC9BWEVrZ2dKQkNBdnlDQUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVJCckRoQUFBUUlEQkFVR0J3Z0pDZ3NNRFE0UEVBc2ovZ0VFUUVFRUVFcEJ6ZjRERURkQi93RnhJZ0FoQVNBQVFRRnhCRUFnQVVGK2NTSUFRWUFCY1FSL1FRQWsvd0VnQUVIL2ZuRUZRUUVrL3dFZ0FFR0FBWElMSVFCQkJCQktRYzMrQXlBQUVFUkJ4QUFQQ3d0QkFTU09BZ3dRQ3hCTFFmLy9BM0VpQUVHQS9nTnhRUWgySklNQ0lBQkIvd0Z4SklRQ0k0a0NRUUpxUWYvL0EzRWtpUUlNRVFzamhBSkIvd0Z4STRNQ1FmOEJjVUVJZEhJaEFDT0FBaUVCUVFRUVNpQUFJQUVRUkF3UUN5T0VBa0gvQVhFamd3SkIvd0Z4UVFoMGNrRUJha0gvL3dOeElRQU1FQXNqZ3dJaUFFRVBjVUVCYWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnFRZjhCY1NTREFpT0RBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFnd09DMEVCSTRNQ0lnQkJEM0ZMUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBQkJBV3RCL3dGeEpJTUNJNE1DUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd3TkMwRUVFRW9qaVFJUUN5MEFBQ1NEQWd3S0N5T0FBaUlCUVlBQmNVR0FBVVloQUNPSEFrRUVka0VCY1NBQlFRRjBja0gvQVhFa2dBSU1DZ3RCQkJCS0k0a0NFQXN0QUFBaEFDT0pBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2lRSkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SWdBamhBSkIvd0Z4STRNQ1FmOEJjVUVJZEhJaUFVRUFFRTBnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FpT0hBa0cvQVhFa2h3SkJDQThMSTRRQ1FmOEJjU09EQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtnQUlNQ0FzamhBSkIvd0Z4STRNQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NFQURBZ0xJNFFDSWdCQkQzRkJBV3BCRUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmFrSC9BWEVpQUNTRUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0RBWUxRUUVqaEFJaUFFRVBjVXRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJhMEgvQVhFaUFDU0VBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd3RkMwRUVFRW9qaVFJUUN5MEFBQ1NFQWd3Q0N5T0FBaUlCUVFGeElRQWpod0pCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SklBQ0RBSUxRWDhQQ3lPSkFrRUJha0gvL3dOeEpJa0NEQUVMSUFCQkFFb0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2pod0pCL3dCeEpJY0NJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lMUVFRUEN5QUFRWUQrQTNGQkNIWWtnd0lnQUVIL0FYRWtoQUpCQ0F1TkNnRUNmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRWdhdzRRQUFFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTRjQ1FRZDJRUUZ4QkVBamlRSkJBV3BCLy84RGNTU0pBZ1ZCQkJCS0k0a0NFQXN0QUFBaEFDT0pBaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2lRSUxRUWdQQ3hCTFFmLy9BM0VpQUVHQS9nTnhRUWgySklVQ0lBQkIvd0Z4SklZQ0k0a0NRUUpxUWYvL0EzRWtpUUlNRUFzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFDT0FBaUVCUVFRUVNpQUFJQUVRUkNBQVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMkpJVUNJQUJCL3dGeEpJWUNEQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5UVFGcVFmLy9BM0VoQUF3UEN5T0ZBaUlBUVE5eFFRRnFRUkJ4UVFCSFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxJQUJCQVdwQi93RnhJZ0FraFFJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWd3TkMwRUJJNFVDSWdCQkQzRkxRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMSUFCQkFXdEIvd0Z4SWdBa2hRSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRY0FBY2tIL0FYRWtod0lNREF0QkJCQktJNGtDRUFzdEFBQWtoUUlNQ2d0QkJrRUFJNGNDSWdKQkJYWkJBWEZCQUVzYklnQkI0QUJ5SUFBZ0FrRUVka0VCY1VFQVN4c2hBU09BQWlFQUlBSkJCblpCQVhGQkFFc0VmeUFBSUFGclFmOEJjUVVnQVVFR2NpQUJJQUJCRDNGQkNVc2JJZ0ZCNEFCeUlBRWdBRUdaQVVzYklnRWdBR3BCL3dGeEN5SUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzZ0FVSGdBSEZCQUVkQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2pod0pCM3dGeEpJY0NJQUFrZ0FJTUNnc2pod0pCQjNaQkFYRkJBRXNFUUVFRUVFb2ppUUlRQ3kwQUFDRUFJNGtDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU0pBZ1VqaVFKQkFXcEIvLzhEY1NTSkFndEJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SWdBZ0FFRUFFRTBnQUVFQmRFSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FpT0hBa0cvQVhFa2h3SkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtnQUlnQUVFQmFrSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0Fnd0hDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBja0VCYTBILy93TnhJUUFNQndzamhnSWlBRUVQY1VFQmFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZxUWY4QmNTSUFKSVlDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lNQlF0QkFTT0dBaUlBUVE5eFMwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGclFmOEJjU0lBSklZQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrSEFBSEpCL3dGeEpJY0NEQVFMUVFRUVNpT0pBaEFMTFFBQUpJWUNEQUlMSTRBQ1FYOXpRZjhCY1NTQUFpT0hBa0hBQUhKQi93RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd0NDMEYvRHdzamlRSkJBV3BCLy84RGNTU0pBZ3RCQkE4TElBQkJnUDREY1VFSWRpU0ZBaUFBUWY4QmNTU0dBa0VJQzZRSkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFd2F3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJNGNDUVFSMlFRRnhCRUFqaVFKQkFXcEIvLzhEY1NTSkFnVkJCQkJLSTRrQ0VBc3RBQUFoQUNPSkFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VraVFJTFFRZ1BDeEJMUWYvL0EzRWtpQUlqaVFKQkFtcEIvLzhEY1NTSkFnd1FDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBSTRBQ0lRRkJCQkJLSUFBZ0FSQkVJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFlraFFJZ0FFSC9BWEVraGdJTUR3c2ppQUpCQVdwQi8vOERjU1NJQWtFSUR3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVvZ0FFSC8vd054SWdBUU55SUJRUTl4UVFGcVFSQnhRUUJIUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBRkJBV3BCL3dGeElnRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdKQkJCQktJQUFnQVJCRURBMExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCS1FRRWdBRUgvL3dOeElnQVFOeUlCUVE5eFMwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFCUVFGclFmOEJjU0lCUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWtFRUVFb2dBQ0FCRUVRTURBc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVvamlRSVFDeTBBQUNFQlFRUVFTaUFBUWYvL0EzRWdBVUgvQVhFUVJBd0tDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FSQnlRZjhCY1NTSEFnd0tDeU9IQWtFRWRrRUJjUVJBUVFRUVNpT0pBaEFMTFFBQUlRQWppUUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJa0NCU09KQWtFQmFrSC8vd054SklrQ0MwRUlEd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSElpQUNPSUFrRUFFRTBnQUNPSUFtcEIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2hRSWdBRUgvQVhFa2hnSWpod0pCdndGeEpJY0NRUWdQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTaUFBRURkQi93RnhKSUFDSUFCQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2hRSWdBRUgvQVhFa2hnSU1Cd3NqaUFKQkFXdEIvLzhEY1NTSUFrRUlEd3NqZ0FJaUFFRVBjVUVCYWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnFRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SU1CUXRCQVNPQUFpSUFRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZyUWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtIQUFISkIvd0Z4SkljQ0RBUUxRUVFRU2lPSkFoQUxMUUFBSklBQ0RBSUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lqaHdKQkJIWkJBWEZCQUUxQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc01BZ3RCZnc4TEk0a0NRUUZxUWYvL0EzRWtpUUlMUVFRTCtRRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRkFhZzRRRHdBQkFnTUVCUVlIRHdnSkNnc01EUTRMSTRJQ0pJRUNEQTRMSTRNQ0pJRUNEQTBMSTRRQ0pJRUNEQXdMSTRVQ0pJRUNEQXNMSTRZQ0pJRUNEQW9MSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtnUUlNQ1FzamdBSWtnUUlNQ0FzamdRSWtnZ0lNQndzamd3SWtnZ0lNQmdzamhBSWtnZ0lNQlFzamhRSWtnZ0lNQkFzamhnSWtnZ0lNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUJBM1FmOEJjU1NDQWd3Q0N5T0FBaVNDQWd3QkMwRi9Ed3RCQkF2NkFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFhdzRRQUFFUEFnTUVCUVlIQ0FrUENnc01EUTRMSTRFQ0pJTUNEQTRMSTRJQ0pJTUNEQTBMSTRRQ0pJTUNEQXdMSTRVQ0pJTUNEQXNMSTRZQ0pJTUNEQW9MSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtnd0lNQ1FzamdBSWtnd0lNQ0FzamdRSWtoQUlNQndzamdnSWtoQUlNQmdzamd3SWtoQUlNQlFzamhRSWtoQUlNQkFzamhnSWtoQUlNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUJBM1FmOEJjU1NFQWd3Q0N5T0FBaVNFQWd3QkMwRi9Ed3RCQkF2NkFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFlQUFhdzRRQUFFQ0F3OEVCUVlIQ0FrS0N3OE1EUTRMSTRFQ0pJVUNEQTRMSTRJQ0pJVUNEQTBMSTRNQ0pJVUNEQXdMSTRRQ0pJVUNEQXNMSTRZQ0pJVUNEQW9MSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTjBIL0FYRWtoUUlNQ1FzamdBSWtoUUlNQ0FzamdRSWtoZ0lNQndzamdnSWtoZ0lNQmdzamd3SWtoZ0lNQlFzamhBSWtoZ0lNQkFzamhRSWtoZ0lNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUJBM1FmOEJjU1NHQWd3Q0N5T0FBaVNHQWd3QkMwRi9Ed3RCQkF2YUF3RUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QUdzT0VBQUJBZ01FQlFZSENBa0tDd3dORGhBUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFJNEVDSVFGQkJCQktJQUFnQVJCRURBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUFqZ2dJaEFVRUVFRW9nQUNBQkVFUU1EZ3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUNPREFpRUJRUVFRU2lBQUlBRVFSQXdOQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQUk0UUNJUUZCQkJCS0lBQWdBUkJFREF3TEk0WUNRZjhCY1NPRkFpSUFRZjhCY1VFSWRISWhBVUVFRUVvZ0FTQUFFRVFNQ3dzamhnSWlBRUgvQVhFamhRSkIvd0Z4UVFoMGNpRUJRUVFRU2lBQklBQVFSQXdLQ3lQNUFVVUVRQUpBSTdRQkJFQkJBU1NMQWd3QkN5TzJBU084QVhGQkgzRkZCRUJCQVNTTUFnd0JDMEVCSkkwQ0N3c01DUXNqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUNPQUFpRUJRUVFRU2lBQUlBRVFSQXdJQ3lPQkFpU0FBZ3dIQ3lPQ0FpU0FBZ3dHQ3lPREFpU0FBZ3dGQ3lPRUFpU0FBZ3dFQ3lPRkFpU0FBZ3dEQ3lPR0FpU0FBZ3dDQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTaUFBRURkQi93RnhKSUFDREFFTFFYOFBDMEVFQzZRQ0FRVi9JNEFDSWdNaEJDQUFRZjhCY1NJQklRSWdBVUVBVHdSQUlBUkJEM0VnQWtFUGNXcEJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc0ZJQUpCSDNZaUJTQUNJQVZxYzBFUGNTQUVRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N3c2dBVUVBVHdSQUlBTkIvd0Z4SUFFZ0EycEIvd0Z4UzBFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N3VWdBVUVmZGlJQ0lBRWdBbXB6SUFOQi93RnhTa0VBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3dzZ0FDQURha0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NDNjhCQVFKL0lBQWpnQUlpQVdvamh3SkJCSFpCQVhGcVFmOEJjU0lDSUFBZ0FYTnpRUkJ4UVFCSFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxJQUVnQUVIL0FYRnFJNGNDUVFSMlFRRnhha0dBQW5GQkFFdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWlTQUFpQUNSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0MvZ0JBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVlBQmF3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJNEVDRUZZTUVBc2pnZ0lRVmd3UEN5T0RBaEJXREE0TEk0UUNFRllNRFFzamhRSVFWZ3dNQ3lPR0FoQldEQXNMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTnhCV0RBb0xJNEFDRUZZTUNRc2pnUUlRVnd3SUN5T0NBaEJYREFjTEk0TUNFRmNNQmdzamhBSVFWd3dGQ3lPRkFoQlhEQVFMSTRZQ0VGY01Bd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUVFRUVFb2dBQkEzRUZjTUFnc2pnQUlRVnd3QkMwRi9Ed3RCQkF1ckFnRUZmeU9BQWlJRElRUkJBQ0FBUWY4QmNXc2lBU0VDSUFGQkFFNEVRQ0FFUVE5eElBSkJEM0ZxUVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMQlNBQ1FSOTFJZ1VnQWlBRmFuTkJEM0VnQkVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NMSUFGQkFFNEVRQ0FEUWY4QmNTQUJJQU5xUWY4QmNVdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NGSUFGQkgzVWlBaUFCSUFKcWN5QURRZjhCY1VwQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0xJQU1nQUd0Qi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SUxzd0VCQW44amdBSWlBU0FBYXlPSEFrRUVka0VCY1d0Qi93RnhJZ0lnQUNBQmMzTkJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBU0FBUWY4QmNXc2pod0pCQkhaQkFYRnJRWUFDY1VFQVMwRUFTd1JBSTRjQ1FSQnlRZjhCY1NTSEFnVWpod0pCN3dGeEpJY0NDeUFDSklBQ0lBSkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrSEFBSEpCL3dGeEpJY0NDL2dCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFaQUJhdzRRQUFFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSTRFQ0VGa01FQXNqZ2dJUVdRd1BDeU9EQWhCWkRBNExJNFFDRUZrTURRc2poUUlRV1F3TUN5T0dBaEJaREFzTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJLSUFBUU54QlpEQW9MSTRBQ0VGa01DUXNqZ1FJUVdnd0lDeU9DQWhCYURBY0xJNE1DRUZvTUJnc2poQUlRV2d3RkN5T0ZBaEJhREFRTEk0WUNFRm9NQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRW9nQUJBM0VGb01BZ3NqZ0FJUVdnd0JDMEYvRHd0QkJBdm5DUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHZ0FXc09FQUFCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9CQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd1FDeU9DQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd1BDeU9EQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd09DeU9FQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd05DeU9GQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd01DeU9HQWlPQUFuRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFnd0xDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNpQUFFRGNqZ0FKeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdJTUNnc2pnQUlpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRU0J5UWY4QmNTU0hBZ3dKQ3lPQkFpT0FBbk5CL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lNQ0FzamdnSWpnQUp6UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDREFjTEk0TUNJNEFDYzBIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWd3R0N5T0VBaU9BQW5OQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJTUJRc2poUUlqZ0FKelFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0RBUUxJNFlDSTRBQ2MwSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFnd0RDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNpQUFFRGNqZ0FKelFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0RBSUxRUUFrZ0FJamh3SkJnQUZ5UWY4QmNTU0hBaU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDREFFTFFYOFBDeU9IQWtIdkFYRWtod0pCQkF1Z0FnRUVmeU9BQWlJQ0lRTkJBQ0FBUWY4QmNXc2lBQ0VCSUFCQkFFNEVRQ0FEUVE5eElBRkJEM0ZxUVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMQlNBQlFSOTFJZ1FnQVNBRWFuTkJEM0VnQTBFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NMSUFCQkFFNEVRQ0FDUWY4QmNTQUFJQUpxUWY4QmNVdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NGSUFCQkgzVWlBU0FBSUFGcWN5QUNRZjhCY1VwQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0xJQUFnQW1wRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtIQUFISkIvd0Z4SkljQ0M4d0dBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWJBQmF3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJNEVDSTRBQ2NrSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpT0hBa0h2QVhFa2h3SU1FQXNqZ2dJamdBSnlRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJNGNDUWU4QmNTU0hBZ3dQQ3lPREFpT0FBbkpCL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lqaHdKQjd3RnhKSWNDREE0TEk0UUNJNEFDY2tIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTURRc2poUUlqZ0FKeVFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd01DeU9HQWlPQUFuSkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQXNMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQktJQUFRTnlPQUFuSkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQW9MSTRBQ1FmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd0pDeU9CQWhCZERBZ0xJNElDRUYwTUJ3c2pnd0lRWFF3R0N5T0VBaEJkREFVTEk0VUNFRjBNQkFzamhnSVFYUXdEQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTaUFBRURjUVhRd0NDeU9BQWhCZERBRUxRWDhQQzBFRUMwVUJBbjhnQUJBMklnRkJmMFlFZnlBQUVBc3RBQUFGSUFFTFFmOEJjU0VDSUFJZ0FFRUJhaUlCRURZaUFFRi9SZ1IvSUFFUUN5MEFBQVVnQUF0Qi93RnhRUWgwY2d2NUVRRUZmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVFkeElnVU9DQUFCQWdNRUJRWUhDQXNqZ1FJaEFRd0hDeU9DQWlFQkRBWUxJNE1DSVFFTUJRc2poQUloQVF3RUN5T0ZBaUVCREFNTEk0WUNJUUVNQWdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFVRUVFRW9nQVJBM0lRRU1BUXNqZ0FJaEFRc0NRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMklnUU9FQUFCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeUFBUVFkTUJIOGdBVUdBQVhGQmdBRkdRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSUFGQkFYUWdBVUgvQVhGQkIzWnlRZjhCY1NJQ1JVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWtFQkJTQUFRUTlNQkg4Z0FVRUJjVUVBUzBFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUJRUWQwSUFGQi93RnhRUUYyY2tIL0FYRWlBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SkJBUVZCQUFzTElRTU1Ed3NnQUVFWFRBUi9JNGNDUVFSMlFRRnhJQUZCQVhSeVFmOEJjU0VDSUFGQmdBRnhRWUFCUmtFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUNSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFrRUJCU0FBUVI5TUJIOGpod0pCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SVFJZ0FVRUJjVUVBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3lBQ1JVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWtFQkJVRUFDd3NoQXd3T0N5QUFRU2RNQkg4Z0FVRUJkRUgvQVhFaEFpQUJRWUFCY1VHQUFVWkJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWtWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0pCQVFVZ0FFRXZUQVIvSUFGQkFYRWhBQ0FCUWY4QmNVRUJkaUlDUVlBQmNpQUNJQUZCZ0FGeFFZQUJSaHNpQWtIL0FYRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0lBQkJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3RCQVFWQkFBc0xJUU1NRFFzZ0FFRTNUQVIvSUFGQkQzRkJCSFFnQVVId0FYRkJCSFp5SWdKRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWtFQkJTQUFRVDlNQkg4Z0FVSC9BWEZCQVhZaUFrVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJZ0FVRUJjVUVBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQzBFQkJVRUFDd3NoQXd3TUN5QUFRY2NBVEFSL0lBRWlBa0VCY1VWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdKQkFRVWdBRUhQQUV3RWZ5QUJJZ0pCQW5GRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQklISkIvd0Z4SkljQ1FRRUZRUUFMQ3lFRERBc0xJQUJCMXdCTUJIOGdBU0lDUVFSeFJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFrRUJCU0FBUWQ4QVRBUi9JQUVpQWtFSWNVVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SkJBUVZCQUFzTElRTU1DZ3NnQUVIbkFFd0VmeUFCSWdKQkVIRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NRUUVGSUFCQjd3Qk1CSDhnQVNJQ1FTQnhSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRU0J5UWY4QmNTU0hBa0VCQlVFQUN3c2hBd3dKQ3lBQVFmY0FUQVIvSUFFaUFrSEFBSEZGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCSUhKQi93RnhKSWNDUVFFRklBQkIvd0JNQkg4Z0FTSUNRWUFCY1VWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdKQkFRVkJBQXNMSVFNTUNBc2dBRUdIQVV3RWYwRUJJUU1nQVVGK2NRVWdBRUdQQVV3RWYwRUJJUU1nQVVGOWNRVkJBQXNMSVFJTUJ3c2dBRUdYQVV3RWYwRUJJUU1nQVVGN2NRVWdBRUdmQVV3RWYwRUJJUU1nQVVGM2NRVkJBQXNMSVFJTUJnc2dBRUduQVV3RWYwRUJJUU1nQVVGdmNRVWdBRUd2QVV3RWYwRUJJUU1nQVVGZmNRVkJBQXNMSVFJTUJRc2dBRUczQVV3RWYwRUJJUU1nQVVHL2YzRUZJQUJCdndGTUJIOUJBU0VESUFGQi8zNXhCVUVBQ3dzaEFnd0VDeUFBUWNjQlRBUi9RUUVoQXlBQlFRRnlCU0FBUWM4QlRBUi9RUUVoQXlBQlFRSnlCVUVBQ3dzaEFnd0RDeUFBUWRjQlRBUi9RUUVoQXlBQlFRUnlCU0FBUWQ4QlRBUi9RUUVoQXlBQlFRaHlCVUVBQ3dzaEFnd0NDeUFBUWVjQlRBUi9RUUVoQXlBQlFSQnlCU0FBUWU4QlRBUi9RUUVoQXlBQlFTQnlCVUVBQ3dzaEFnd0JDeUFBUWZjQlRBUi9RUUVoQXlBQlFjQUFjZ1VnQUVIL0FVd0VmMEVCSVFNZ0FVR0FBWElGUVFBTEN5RUNDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FGRGdnQUFRSURCQVVHQndnTElBSWtnUUlNQndzZ0FpU0NBZ3dHQ3lBQ0pJTUNEQVVMSUFJa2hBSU1CQXNnQWlTRkFnd0RDeUFDSklZQ0RBSUxRUUVnQkVFSFN5QUVRUVJKR3dSQUk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJLSUFBZ0FoQkVDd3dCQ3lBQ0pJQUNDMEVFUVg4Z0F4c0xsZ1VCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFXc09FQUFCQWhFREJBVUdCd2dKQ2dzTURRNFBDeU9IQWtFSGRrRUJjUTBSREJNTEk0Z0NJUUJCQ0JCS0lBQVFYMEgvL3dOeElRQWppQUpCQW1wQi8vOERjU1NJQWlBQVFZRCtBM0ZCQ0hZa2dRSWdBRUgvQVhFa2dnSkJCQThMSTRjQ1FRZDJRUUZ4UlEwT0RBMExJNGNDUVFkMlFRRnhEUXdqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNGtDUVFKcVFmLy9BM0VoQVVFSUVFb2dBQ0FCRUV3TURRc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0SUNRZjhCY1NPQkFrSC9BWEZCQ0hSeUlRRkJDQkJLSUFBZ0FSQk1EQTBMUVFRUVNpT0pBaEFMTFFBQUVGWU1EUXNqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNGtDSVFGQkNCQktJQUFnQVJCTVFRQWtpUUlNQ3dzamh3SkJCM1pCQVhGRkRRb01EQXNqaUFJaEFFRUlFRW9nQUJCZlFmLy9BM0VraVFJZ0FFRUNha0gvL3dOeEpJZ0NEQWtMSTRjQ1FRZDJRUUZ4RFFjTUJndEJCQkJLSTRrQ0VBc3RBQUFRWUNFQUk0a0NRUUZxUWYvL0EzRWtpUUlnQUE4TEk0Y0NRUWQyUVFGeFJRMEVJNGdDUVFKclFmLy9BM0VpQUNTSUFpT0pBa0VDYWtILy93TnhJUUZCQ0JCS0lBQWdBUkJNREFVTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFrRUNha0gvL3dOeElRRkJDQkJLSUFBZ0FSQk1EQVFMUVFRUVNpT0pBaEFMTFFBQUVGY01CUXNqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNGtDSVFGQkNCQktJQUFnQVJCTVFRZ2tpUUlNQXd0QmZ3OExJNGtDUVFKcVFmLy9BM0VraVFKQkRBOExFRXRCLy84RGNTU0pBZ3RCQ0E4TEk0a0NRUUZxUWYvL0EzRWtpUUpCQkE4TEk0Z0NJUUJCQ0JCS0lBQVFYMEgvL3dOeEpJa0NJQUJCQW1wQi8vOERjU1NJQWtFTUM4b0VBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBV3NPRUFBQkFnMERCQVVHQndnSkRRb05Dd3dOQ3lPSEFrRUVka0VCY1EwUERCRUxJNGdDSVFCQkNCQktJQUFRWDBILy93TnhJUUVnQUVFQ2FrSC8vd054SklnQ0lBRkJnUDREY1VFSWRpU0RBaUFCUWY4QmNTU0VBa0VFRHdzamh3SkJCSFpCQVhGRkRRd01Dd3NqaHdKQkJIWkJBWEVOQ2lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFKQkFtcEIvLzhEY1NFQlFRZ1FTaUFBSUFFUVRBd0xDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWpoQUpCL3dGeEk0TUNRZjhCY1VFSWRISWhBVUVJRUVvZ0FDQUJFRXdNQ3d0QkJCQktJNGtDRUFzdEFBQVFXUXdMQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFJaEFVRUlFRW9nQUNBQkVFeEJFQ1NKQWd3SkN5T0hBa0VFZGtFQmNVVU5DQXdLQ3lPSUFpRUFRUWdRU2lBQUVGOUIvLzhEY1NTSkFrRUJKTFVCSUFCQkFtcEIvLzhEY1NTSUFnd0hDeU9IQWtFRWRrRUJjUTBGREFRTEk0Y0NRUVIyUVFGeFJRMERJNGdDUVFKclFmLy9BM0VpQUNTSUFpT0pBa0VDYWtILy93TnhJUUZCQ0JCS0lBQWdBUkJNREFRTFFRUVFTaU9KQWhBTExRQUFFRm9NQlFzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRrQ0lRRkJDQkJLSUFBZ0FSQk1RUmdraVFJTUF3dEJmdzhMSTRrQ1FRSnFRZi8vQTNFa2lRSkJEQThMRUV0Qi8vOERjU1NKQWd0QkNBOExJNGtDUVFGcVFmLy9BM0VraVFKQkJBOExJNGdDSVFCQkNCQktJQUFRWDBILy93TnhKSWtDSUFCQkFtcEIvLzhEY1NTSUFrRU1DNVFGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBV3NPRUFBQkFnc0xBd1FGQmdjSUN3c0xDUW9MQzBFRUVFb2ppUUlRQ3kwQUFDRUFJNEFDSVFGQkJCQktJQUJCL3dGeFFZRCtBMm9nQVJCRURBc0xJNGdDSVFCQkNCQktJQUFRWDBILy93TnhJUUVnQUVFQ2FrSC8vd054SklnQ0lBRkJnUDREY1VFSWRpU0ZBaUFCUWY4QmNTU0dBa0VFRHdzamdnSkJnUDREYWlFQUk0QUNJUUZCQkJCS0lBQWdBUkJFUVFRUEN5T0lBa0VDYTBILy93TnhJZ0FraUFJamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFVRUlFRW9nQUNBQkVFeEJDQThMUVFRUVNpT0pBaEFMTFFBQUk0QUNjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NJNGNDUWU4QmNTU0hBZ3dIQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFJaEFVRUlFRW9nQUNBQkVFeEJJQ1NKQWtFSUR3dEJCQkJLSTRrQ0VBc3NBQUFoQUNPSUFpQUFRUUVRVFNBQUk0Z0Nha0gvL3dOeEpJZ0NJNGNDUWY4QWNTU0hBaU9IQWtHL0FYRWtod0lqaVFKQkFXcEIvLzhEY1NTSkFrRU1Ed3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSElraVFKQkJBOExFRXRCLy84RGNTRUFJNEFDSVFGQkJCQktJQUFnQVJCRUk0a0NRUUpxUWYvL0EzRWtpUUpCQkE4TFFRUVFTaU9KQWhBTExRQUFJNEFDYzBIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTUFnc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCS0lBQWdBUkJNUVNna2lRSkJDQThMUVg4UEN5T0pBa0VCYWtILy93TnhKSWtDUVFRTCtnUUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCYXc0UUFBRUNBdzBFQlFZSENBa0tEUTBMREEwTFFRUVFTaU9KQWhBTExRQUFJUUJCQkJCS0lBQkIvd0Z4UVlEK0Eyb1FOMEgvQVhFa2dBSU1EUXNqaUFJaEFFRUlFRW9nQUJCZlFmLy9BM0VoQVNBQVFRSnFRZi8vQTNFa2lBSWdBVUdBL2dOeFFRaDJKSUFDSUFGQi93RnhKSWNDREEwTEk0SUNRWUQrQTJvaEFFRUVFRW9nQUJBM1FmOEJjU1NBQWd3TUMwRUFKTFFCREFzTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSEFrSC9BWEVqZ0FKQi93RnhRUWgwY2lFQlFRZ1FTaUFBSUFFUVRFRUlEd3RCQkJCS0k0a0NFQXN0QUFBamdBSnlRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJNGNDUWU4QmNTU0hBZ3dJQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFJaEFVRUlFRW9nQUNBQkVFeEJNQ1NKQWtFSUR3dEJCQkJLSTRrQ0VBc3RBQUFoQUNPSEFrSC9BSEVraHdJamh3SkJ2d0Z4SkljQ0k0Z0NJZ0VnQUVFWWRFRVlkU0lBUVFFUVRTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDJKSVVDSUFCQi93RnhKSVlDSTRrQ1FRRnFRZi8vQTNFa2lRSkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SklnQ1FRZ1BDeEJMUWYvL0EzRWhBRUVFRUVvZ0FCQTNRZjhCY1NTQUFpT0pBa0VDYWtILy93TnhKSWtDREFVTFFRRWt0UUVNQkF0QkJCQktJNGtDRUFzdEFBQVFYUXdDQ3lPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFJaEFVRUlFRW9nQUNBQkVFeEJPQ1NKQWtFSUR3dEJmdzhMSTRrQ1FRRnFRZi8vQTNFa2lRSUxRUVFMdkFFQkFYOGppUUpCQVdwQi8vOERjU0lCUVFGclFmLy9BM0VnQVNPTkFoc2tpUUlDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRnNFBBQUVDQXdRRkJnY0lDUW9MREEwT0R3c2dBQkJPRHdzZ0FCQlBEd3NnQUJCUUR3c2dBQkJSRHdzZ0FCQlNEd3NnQUJCVER3c2dBQkJVRHdzZ0FCQlZEd3NnQUJCWUR3c2dBQkJiRHdzZ0FCQmNEd3NnQUJCZUR3c2dBQkJoRHdzZ0FCQmlEd3NnQUJCakR3c2dBQkJrQzdZQkFRSi9RUUFrdEFGQmovNERFQXN0QUFCQmZpQUFkM0VpQVNTOEFVR1AvZ01RQ3lBQk9nQUFJNGdDUVFKclFmLy9BM0VraUFJamlRSWhBU09JQWlJQ0VBc2dBVG9BQUNBQ1FRRnFFQXNnQVVHQS9nTnhRUWgyT2dBQUFrQUNRQUpBQWtBQ1FBSkFJQUFPQlFBQkFnTUVCUXRCQUNTOUFVSEFBQ1NKQWd3RUMwRUFKTDRCUWNnQUpJa0NEQU1MUVFBa3Z3RkIwQUFraVFJTUFndEJBQ1RBQVVIWUFDU0pBZ3dCQzBFQUpNRUJRZUFBSklrQ0N3dm5BUUVCZnlPMUFRUkFRUUVrdEFGQkFDUzFBUXNqdGdFanZBRnhRUjl4UVFCTEJFQWpqQUpGUVFBanRBRWJCSDhqdlFGQkFDTzNBUnNFZjBFQUVHWkJBUVVqdmdGQkFDTzRBUnNFZjBFQkVHWkJBUVVqdndGQkFDTzVBUnNFZjBFQ0VHWkJBUVVqd0FGQkFDTzZBUnNFZjBFREVHWkJBUVVqd1FGQkFDTzdBUnNFZjBFRUVHWkJBUVZCQUFzTEN3c0xCVUVBQ3dSL1FRRWpqQUlqaXdJYkJIOUJBQ1NNQWtFQUpJc0NRUUFralFKQkFDU09Ba0VZQlVFVUN3VkJBQXNoQUVFQkk0d0NJNHNDR3dSQVFRQWtqQUpCQUNTTEFrRUFKSTBDUVFBa2pnSUxJQUFQQzBFQUM2MEJBUUovUVFFa2xRSWpqUUlFUUNPSkFoQUxMUUFBRUdVUVNrRUFKSXdDUVFBa2l3SkJBQ1NOQWtFQUpJNENDeEJuSWdGQkFFb0VRQ0FCRUVvTFFRQWpqZ0pGUVFFampBSWppd0liR3dSL0k0a0NFQXN0QUFBUVpRVkJCQXNoQVNPSEFrSHdBWEVraHdJZ0FVRUFUQVJBSUFFUEN5QUJFRW9qbEFKQkFXb2lBQ09TQWs0RWZ5T1RBa0VCYWlTVEFpQUFJNUlDYXdVZ0FBc2tsQUlqaVFJajJnRkdCRUJCQVNUZEFRc2dBUXNGQUNPekFRdXBBUUVEZnlBQVFYOUJnQWdnQUVFQVNCc2dBRUVBU2hzaEFBTkFJOTBCUlVFQUlBRkZRUUJCQUNBQ1JTQURHeHNiQkVBUWFFRUFTQVJBUVFFaEF3VWppZ0pCMEtRRUkvOEJkRTRFUUVFQklRSUZRUUVnQVNPekFTQUFUa0VBSUFCQmYwb2JHeUVCQ3dzTUFRc0xJQUlFUUNPS0FrSFFwQVFqL3dGMGF5U0tBa0VBRHdzZ0FRUkFRUUVQQ3lQZEFRUkFRUUFrM1FGQkFnOExJNGtDUVFGclFmLy9BM0VraVFKQmZ3c0dBRUYvRUdvTE13RUNmd05BSUFGQkFFNUJBQ0FDSUFCSUd3UkFRWDhRYWlFQklBSkJBV29oQWd3QkN3c2dBVUVBU0FSQUlBRVBDMEVBQ3dVQUk0OENDd1VBSTVBQ0N3VUFJNUVDQy9FQkFRRi9RUUFramdJQ2Z3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFEZ2dBQVFJREJBVUdCd2dMSTg4QkRBZ0xJOUlCREFjTEk5QUJEQVlMSTlFQkRBVUxJOU1CREFRTEk5UUJEQU1MSTlVQkRBSUxJOVlCREFFTFFRQUxSU0VCQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBT0NBQUJBZ01FQlFZSENBdEJBU1RQQVF3SEMwRUJKTklCREFZTFFRRWswQUVNQlF0QkFTVFJBUXdFQzBFQkpOTUJEQU1MUVFFazFBRU1BZ3RCQVNUVkFRd0JDMEVCSk5ZQkN5QUJCRUJCQVNBQVFRTk1JZ0ZCQUNQWUFSc0VmMEVCQlVFQUN5QUJSVUVBSTlrQkd4c0VRRUVCSk1FQlFRUVFLUXNMQzVJQkFDQUFRUUJLQkVCQkFCQndCVUVBSk04QkN5QUJRUUJLQkVCQkFSQndCVUVBSk5JQkN5QUNRUUJLQkVCQkFoQndCVUVBSk5BQkN5QURRUUJLQkVCQkF4QndCVUVBSk5FQkN5QUVRUUJLQkVCQkJCQndCVUVBSk5NQkN5QUZRUUJLQkVCQkJSQndCVUVBSk5RQkN5QUdRUUJLQkVCQkJoQndCVUVBSk5VQkN5QUhRUUJLQkVCQkJ4QndCVUVBSk5ZQkN3c0hBQ0FBSk5vQkN3Y0FRWDhrMmdFTEJ3QWdBQ1RiQVFzSEFFRi9KTnNCQ3djQUlBQWszQUVMQndCQmZ5VGNBUXNGQUNPQUFnc0ZBQ09CQWdzRkFDT0NBZ3NGQUNPREFnc0ZBQ09FQWdzRkFDT0ZBZ3NGQUNPR0Fnc0ZBQ09IQWdzRkFDT0pBZ3NGQUNPSUFnc0tBQ09KQWhBTExRQUFDd1VBSStvQkM5UURBUWwvUVlDQUFrR0FrQUlqNHdFYklRUkJnTGdDUVlDd0FpUGtBUnNoQ1FOQUlBWkJnQUpJQkVCQkFDRUZBMEFnQlVHQUFrZ0VRQ0FKSUFaQkEzVkJCWFJxSUFWQkEzVnFJZ2RCZ0pCK2FpMEFBQ0VCSUFaQkNHOGhBa0VISUFWQkNHOXJJUWdnQkNBRVFZQ1FBa1lFZnlBQlFZQUJheUFCUVlBQmFpQUJRWUFCY1JzRklBRUxRUVIwYWlFRElBQkJBRXBCQUNQK0FSc0VmeUFIUVlEUWZtb3RBQUFGUVFBTElnRkJ3QUJ4QkVCQkJ5QUNheUVDQ3lBQlFRaHhSVVZCRFhRaUJ5QURJQUpCQVhScUlnTkJnSkIrYW1vdEFBQWhBaUFISUFOQmdaQithbW90QUFCQkFTQUlkSEVFZjBFQ0JVRUFDeUlEUVFGcUlBTWdBa0VCSUFoMGNSc2hBeUFGSUFaQkNIUnFRUU5zSVFJZ0FFRUFTa0VBSS80Qkd3UkFJQUpCZ0tFTGFpSUNJQUZCQjNGQkEzUWdBMEVCZEdvaUFVRUJha0UvY1VHQWtBUnFMUUFBUVFoMElBRkJQM0ZCZ0pBRWFpMEFBSElpQVVFZmNVRURkRG9BQUNBQ0lBRkI0QWR4UVFWMlFRTjBPZ0FCSUFJZ0FVR0ErQUZ4UVFwMlFRTjBPZ0FDQlNBQ1FZQ2hDMm9pQVNBRFFjZitBeEFpSWdOQmdJRDhCM0ZCRUhZNkFBQWdBU0FEUVlEK0EzRkJDSFk2QUFFZ0FTQURPZ0FDQ3lBRlFRRnFJUVVNQVFzTElBWkJBV29oQmd3QkN3c0wyUU1CQzM4RFFDQUNRUmRJQkVCQkFDRUZBMEFnQlVFZlNBUkFJQVZCRDBvaENTQUNJZ0ZCRDBvRWZ5QUJRUTlyQlNBQkMwRUVkQ0lCSUFWQkQydHFJQUVnQldvZ0JVRVBTaHNoQjBISC9nTWhDa0YvSVFOQkFDRUFBMEFnQUVFSVNBUkFRUUFoQkFOQUlBUkJCVWdFUUNBSElBQWdCRUVEZEdwQkFuUWlBVUdDL0FOcUVBc3RBQUJHQkVBZ0NTQUJRWVA4QTJvUUN5MEFBQ0lCUVFoeFFRQWovZ0ViUlVWR0JFQUNmMEVGSVFSQnlmNERRY2orQXlBQklnTkJFSEViSVFwQkNBc2hBQXNMSUFSQkFXb2hCQXdCQ3dzZ0FFRUJhaUVBREFFTEN5QURRUUJJUVFBai9nRWJCSDlCZ0xnQ1FZQ3dBaVBrQVJzaENFRi9JUUJCQUNFRUEwQWdCRUVnU0FSQVFRQWhCZ05BSUFaQklFZ0VRQ0FISUFRZ0NDQUdRUVYwYW1vaUFVR0FrSDVxTFFBQVJnUkFBbjlCSUNFRVFTQWhCaUFCQ3lFQUN5QUdRUUZxSVFZTUFRc0xJQVJCQVdvaEJBd0JDd3NnQUVFQVRnUi9JQUJCZ05CK2FpMEFBQVZCZndzRlFYOExJUUZCZ0pBQ1FZQ0FBaUFDUVE5S0d5RUlRUUFoQUFOQUlBQkJDRWdFUUNBSElBZ2dDVUVBUVFjZ0FDQUZRUU4wSUFBZ0FrRURkR3BCK0FGQmdLRVhJQW9nQVNBREVDTWFJQUJCQVdvaEFBd0JDd3NnQlVFQmFpRUZEQUVMQ3lBQ1FRRnFJUUlNQVFzTEM1Z0NBUWwvQTBBZ0JFRUlTQVJBUVFBaEFnTkFJQUpCQlVnRVFDQUVJQUpCQTNScVFRSjBJZ0ZCZ1B3RGFoQUxMUUFBR2lBQlFZSDhBMm9RQ3kwQUFCb2dBVUdDL0FOcUVBc3RBQUFoQUVFQklRVWo1UUVFUUFKL1FRSWhCU0FBUVFKdlFRRkdCSDhnQUVFQmF3VWdBQXNMSVFBTElBRkJnL3dEYWhBTExRQUFJZ1pCQ0hGQkFDUCtBUnRGUlNFSFFjbitBMEhJL2dNZ0JrRVFjUnNoQ0VFQUlRRURRQ0FCSUFWSUJFQkJBQ0VEQTBBZ0EwRUlTQVJBSUFBZ0FXcEJnSUFDSUFkQkFFRUhJQU1nQkVFRGRDQURJQUpCQkhScUlBRkJBM1JxUWNBQVFZQ2hJQ0FJUVg4Z0JoQWpHaUFEUVFGcUlRTU1BUXNMSUFGQkFXb2hBUXdCQ3dzZ0FrRUJhaUVDREFFTEN5QUVRUUZxSVFRTUFRc0xDd1VBSThNQkN3VUFJOFFCQ3dVQUk4Z0JDeElCQVg4anlnRWlBRUVFY2lBQUk4a0JHd3N1QVFGL0EwQWdBRUgvL3dOSUJFQWdBRUdBdGNrRWFpQUFFRGM2QUFBZ0FFRUJhaUVBREFFTEMwRUFKTjBCQzJVQVFmTGx5d2NrTzBHZ3dZSUZKRHhCMkxEaEFpUTlRWWlRSUNRK1FmTGx5d2NrUDBHZ3dZSUZKRUJCMkxEaEFpUkJRWWlRSUNSQ1FmTGx5d2NrUTBHZ3dZSUZKRVJCMkxEaEFpUkZRWWlRSUNSR1B3QkJsQUZJQkVCQmxBRS9BR3RBQUJvTEN3TUFBUXU4QVFFQ2Z5QUFLQUlFSWdKQi8vLy8vd0J4SVFFZ0FDZ0NBRUVCY1FSQVFRQkJnQWxCK2dCQkRoQUFBQXNnQVVFQlJnUkFBa0FDUUFKQUlBQW9BZ2dPQXdJQ0FBRUxJQUFvQWhBaUFRUkFJQUZCdkFsUEJFQWdBVUVRYXhDT0FRc0xEQUVMQUFzZ0FrR0FnSUNBZUhFRVFFRUFRWUFKUWY0QVFSSVFBQUFMSUFBZ0FDZ0NBRUVCY2pZQ0FDTUFJQUFRQWdVZ0FVRUFUUVJBUVFCQmdBbEJpQUZCRUJBQUFBc2dBQ0FCUVFGcklBSkJnSUNBZ0g5eGNqWUNCQXNMSEFBQ1FBSkFBa0FqbHdJT0FnRUNBQXNBQzBFQUlRQUxJQUFRYWdzZEFBSkFBa0FDUUNPWEFnNERBUUVDQUFzQUMwRi9JUUVMSUFFUWFnc0hBQ0FBSkpjQ0N3dS9BUVFBUVlBSUN5MGVBQUFBQVFBQUFBRUFBQUFlQUFBQWZnQnNBR2tBWWdBdkFISUFkQUF2QUhRQWJBQnpBR1lBTGdCMEFITUFRYkFJQ3pjb0FBQUFBUUFBQUFFQUFBQW9BQUFBWVFCc0FHd0Fid0JqQUdFQWRBQnBBRzhBYmdBZ0FIUUFid0J2QUNBQWJBQmhBSElBWndCbEFFSHdDQXN0SGdBQUFBRUFBQUFCQUFBQUhnQUFBSDRBYkFCcEFHSUFMd0J5QUhRQUx3QndBSFVBY2dCbEFDNEFkQUJ6QUVHZ0NRc1ZBd0FBQUNBQUFBQUFBQUFBSUFBQUFBQUFBQUFnQURNUWMyOTFjbU5sVFdGd2NHbHVaMVZTVENGamIzSmxMMlJwYzNRdlkyOXlaUzUxYm5SdmRXTm9aV1F1ZDJGemJTNXRZWEE9IikpLmluc3RhbmNlOwpjb25zdCBiPW5ldyBVaW50OEFycmF5KGEuZXhwb3J0cy5tZW1vcnkuYnVmZmVyKTtyZXR1cm57aW5zdGFuY2U6YSxieXRlTWVtb3J5OmIsdHlwZToiV2ViIEFzc2VtYmx5In19LHIsdSxFLGM7Yz17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCwKV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sc3BlZWQ6MCxmcmFtZVNraXBDb3VudGVyOjAsY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kczowLG1lc3NhZ2VIYW5kbGVyOmE9PntsZXQgYj1uKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8KKGMuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEouYmluZCh2b2lkIDAsYyksYy5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKE0uYmluZCh2b2lkIDAsYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEwuYmluZCh2b2lkIDAsYyksYy5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihjLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShLLmJpbmQodm9pZCAwLGMpLGMuYXVkaW9Xb3JrZXJQb3J0KSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBQKHApOwpjLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2Mud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2soaCh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgZi5DT05GSUc6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkoYyxiLm1lc3NhZ2UuY29uZmlnKTtjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SRVNFVF9BVURJT19RVUVVRTpjLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBMQVk6aWYoIWMucGF1c2VkfHwhYy53YXNtSW5zdGFuY2V8fCFjLndhc21CeXRlTWVtb3J5KXtrKGgoe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfWMucGF1c2VkPSExO2MuZnBzVGltZVN0YW1wcz1bXTt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0KMDtjLm9wdGlvbnMuaXNHYmNDb2xvcml6YXRpb25FbmFibGVkP2Mub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlJiZjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoIndhc21ib3lnYiBicm93biByZWQgZGFya2Jyb3duIGdyZWVuIGRhcmtncmVlbiBpbnZlcnRlZCBwYXN0ZWxtaXggb3JhbmdlIHllbGxvdyBibHVlIGRhcmtibHVlIGdyYXlzY2FsZSIuc3BsaXQoIiAiKS5pbmRleE9mKGMub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlLnRvTG93ZXJDYXNlKCkpKTpjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoMCk7RihjLDFFMy9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5QQVVTRTpjLnBhdXNlZD0hMDtjLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KGMudXBkYXRlSWQpLGMudXBkYXRlSWQ9dm9pZCAwKTtrKGgodm9pZCAwLApiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SVU5fV0FTTV9FWFBPUlQ6YT1iLm1lc3NhZ2UucGFyYW1ldGVycz9jLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdLmFwcGx5KHZvaWQgMCxiLm1lc3NhZ2UucGFyYW1ldGVycyk6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XSgpO2soaCh7dHlwZTpmLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBkPWMud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoZD1iLm1lc3NhZ2UuZW5kKTthPWMud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxkKS5idWZmZXI7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgZi5HRVRfV0FTTV9DT05TVEFOVDprKGgoe3R5cGU6Zi5HRVRfV0FTTV9DT05TVEFOVCwKcmVzcG9uc2U6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuRk9SQ0VfT1VUUFVUX0ZSQU1FOkMoYyk7YnJlYWs7Y2FzZSBmLlNFVF9TUEVFRDpjLnNwZWVkPWIubWVzc2FnZS5zcGVlZDtjLmZwc1RpbWVTdGFtcHM9W107Yy50aW1lU3RhbXBzVW50aWxSZWFkeT02MDt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0wO2Mud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2JyZWFrO2Nhc2UgZi5JU19HQkM6YT0wPGMud2FzbUluc3RhbmNlLmV4cG9ydHMuaXNHQkMoKTtrKGgoe3R5cGU6Zi5JU19HQkMscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKCJVbmtub3duIFdhc21Cb3kgV29ya2VyIG1lc3NhZ2U6IixiKX19LGdldEZQUzooKT0+MDxjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PwpjLnNwZWVkJiYwPGMuc3BlZWQ/Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUqYy5zcGVlZDpjLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpjLmZwc1RpbWVTdGFtcHM/Yy5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGMubWVzc2FnZUhhbmRsZXIpfSkoKQo=";

var wasmboyGraphicsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGgoYSxiKXtlP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTprLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGUpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZSlzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugay5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZihhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZCsrLGI9YCR7Yn0tJHtkfWAsMUU1PGQmJihkPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWxldCBlPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsaztlfHwoaz1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZD0wLGwsbj1hPT57YT1hLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJHRVRfQ09OU1RBTlRTX0RPTkUiOmgoZihhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJVUERBVEVEIjp7YT1uZXcgVWludDhDbGFtcGVkQXJyYXkoYS5tZXNzYWdlLmdyYXBoaWNzRnJhbWVCdWZmZXIpO2xldCBiPW5ldyBVaW50OENsYW1wZWRBcnJheSg5MjE2MCk7Zm9yKGxldCBjPTA7MTQ0PmM7KytjKXtsZXQgZT00ODAqYyxmPTY0MCpjO2ZvcihsZXQgYz0wOzE2MD5jOysrYyl7bGV0IGQ9ZSszKmMsZz1mKyhjPDwyKTtiW2crMF09YVtkKzBdO2JbZysxXT1hW2QrMV07YltnKzJdPWFbZCsyXTtiW2crM109MjU1fX1hPWJ9aChmKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bShhPT57YT1hLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpsPWEubWVzc2FnZS5wb3J0c1swXTsKbShuLGwpO2goZih2b2lkIDAsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTIjpsLnBvc3RNZXNzYWdlKGYoe3R5cGU6IkdFVF9DT05TVEFOVFMifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYSl9fSl9KSgpCg==";

var wasmboyAudioWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG0oYSxiKXtjP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpuLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gcChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGMpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoYylzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugbi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZChhLGIscil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksaysrLGI9YCR7Yn0tJHtrfWAsMUU1PGsmJihrPTApKTtyZXR1cm57d29ya2VySWQ6cixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWxldCBjPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsbjtjfHwobj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgaz0wLHE9YT0+e2E9KGEtMSkvMTI3LTE7LjAwOD5NYXRoLmFicyhhKSYmKGE9MCk7cmV0dXJuIGEvMi41fSxsLHQ9YT0+e2NvbnN0IGI9YS5kYXRhP2EuZGF0YTphO2lmKGIubWVzc2FnZSlzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6bShkKGIubWVzc2FnZSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOntjb25zdCBhPXt0eXBlOiJVUERBVEVEIixudW1iZXJPZlNhbXBsZXM6Yi5tZXNzYWdlLm51bWJlck9mU2FtcGxlcyxmcHM6Yi5tZXNzYWdlLmZwcyxhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6Yi5tZXNzYWdlLmFsbG93RmFzdFNwZWVkU3RyZXRjaGluZ30sYz1bXTtbImF1ZGlvQnVmZmVyIiwiY2hhbm5lbDFCdWZmZXIiLCJjaGFubmVsMkJ1ZmZlciIsImNoYW5uZWwzQnVmZmVyIiwiY2hhbm5lbDRCdWZmZXIiXS5mb3JFYWNoKGQ9PntpZihiLm1lc3NhZ2VbZF0pe3t2YXIgZj1uZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZF0pOwp2YXIgZz1iLm1lc3NhZ2UubnVtYmVyT2ZTYW1wbGVzO2NvbnN0IGE9bmV3IEZsb2F0MzJBcnJheShnKTt2YXIgaD1uZXcgRmxvYXQzMkFycmF5KGcpO2xldCBjPTA7Zyo9Mjtmb3IodmFyIGU9MDtlPGc7ZSs9MilhW2NdPXEoZltlXSksYysrO2M9MDtmb3IoZT0xO2U8ZztlKz0yKWhbY109cShmW2VdKSxjKys7Zj1hLmJ1ZmZlcjtoPWguYnVmZmVyfWFbZF09e307YVtkXS5sZWZ0PWY7YVtkXS5yaWdodD1oO2MucHVzaChmKTtjLnB1c2goaCl9fSk7bShkKGEpLGMpfX19O3AoYT0+e2E9YS5kYXRhP2EuZGF0YTphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6bD1hLm1lc3NhZ2UucG9ydHNbMF07cCh0LGwpO20oZCh2b2lkIDAsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTIjpsLnBvc3RNZXNzYWdlKGQoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiQVVESU9fTEFURU5DWSI6bC5wb3N0TWVzc2FnZShkKGEubWVzc2FnZSwKYS5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGEpfX0pfSkoKQo=";

var wasmboyControllerWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihjKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKGMpc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIGUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLGQrKyxiPWAke2J9LSR7ZH1gLDFFNTxkJiYoZD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1sZXQgYz0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmLGU7Y3x8KGU9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtsZXQgZD0wLGYsaz1hPT57fTtnKGE9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNPTk5FQ1QiOmY9CmEubWVzc2FnZS5wb3J0c1swXTtnKGssZik7YT1oKHZvaWQgMCxhLm1lc3NhZ2VJZCk7Yz9zZWxmLnBvc3RNZXNzYWdlKGEsdm9pZCAwKTplLnBvc3RNZXNzYWdlKGEsdm9pZCAwKTticmVhaztjYXNlICJTRVRfSk9ZUEFEX1NUQVRFIjpmLnBvc3RNZXNzYWdlKGgoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCkK";

var wasmboyMemoryWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWxldCBkPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGYsaz0oYSxiKT0+e2NvbnN0IGQ9W107T2JqZWN0LmtleXMoYi5tZXNzYWdlKS5mb3JFYWNoKGE9PnsidHlwZSIhPT1hJiZkLnB1c2goYi5tZXNzYWdlW2FdKX0pO2NvbnN0IGU9YyhiLm1lc3NhZ2UsYi5tZXNzYWdlSWQpO2E/Zi5wb3N0TWVzc2FnZShlLGQpOmcoZSxkKX0sbT1hPT57YT1hLmRhdGE/YS5kYXRhOmE7aWYoYS5tZXNzYWdlKXN3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ0xFQVJfTUVNT1JZX0RPTkUiOmcoYyhhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpLFthLm1lc3NhZ2Uud2FzbUJ5dGVNZW1vcnldKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTX0RPTkUiOmcoYyhhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJTRVRfTUVNT1JZX0RPTkUiOmcoYyhhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfTUVNT1JZIjprKCExLGEpO2JyZWFrO2Nhc2UgIlVQREFURUQiOmsoITEsYSl9fTtsKGE9PnthPWEuZGF0YT9hLmRhdGE6CmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpmPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sZik7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkNMRUFSX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKHt0eXBlOiJDTEVBUl9NRU1PUlkifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmYucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlNFVF9NRU1PUlkiOmsoITAsYSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCkK";

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

  postMessage(message, transfer, timeout) {
    if (!timeout) {
      timeout = 1000;
    }

    const messageObject = getSmartWorkerMessage(message, undefined, this.id);
    const messageId = messageObject.messageId;
    const messageIdListener = new Promise((resolve, reject) => {
      // Set a timeout before killing the message listener
      let messageDroppedTimeout = setTimeout(() => {
        console.warn('Message dropped', message);
        this.removeMessageListener(messageId);
        reject();
      }, timeout); // Listen for a message with the same message id to be returned

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

    BigInteger.prototype.isProbablePrime = function (iterations, rng) {
        var isPrime = isBasicPrime(this);
        if (isPrime !== undefined) return isPrime;
        var n = this.abs();
        var t = iterations === undefined ? 5 : iterations;
        for (var a = [], i = 0; i < t; i++) {
            a.push(bigInt.randBetween(2, n.minus(2), rng));
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
    function randBetween(a, b, rng) {
        a = parseValue(a);
        b = parseValue(b);
        var usedRNG = rng || Math.random;
        var low = min(a, b), high = max(a, b);
        var range = high.subtract(low).add(1);
        if (range.isSmall) return low.add(Math.floor(usedRNG() * range));
        var digits = toBase(range, BASE).value;
        var result = [], restricted = true;
        for (var i = 0; i < digits.length; i++) {
            var top = restricted ? digits[i] : BASE;
            var digit = truncate(usedRNG() * top);
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
const runWasmExport = async (exportKey, parameters, timeout) => {
  if (!WasmBoyLib.worker) {
    return;
  }

  const event = await WasmBoyLib.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.RUN_WASM_EXPORT,
    export: exportKey,
    parameters
  }, undefined, timeout);
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
var version = "0.6.0";
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
	prepare: "run-s core:build lib:build",
	start: "concurrently --kill-others --names \"DEBUGGER,CORE,LIB\" -c \"bgBlue.bold,bgMagenta.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run core:watch\" \"npm run lib:watch:wasm\"",
	"start:ts": "concurrently --kill-others --names \"DEBUGGER,LIBANDCORETS\" -c \"bgBlue.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run lib:watch:ts\"",
	dev: "npm run start",
	watch: "npm run start",
	"dev:ts": "npm run start:ts",
	"watch:ts": "npm run start:ts",
	build: "run-s core:build lib:build:wasm",
	deploy: "run-s lib:deploy demo:deploy",
	prettier: "npm run prettier:lint:fix",
	"prettier:lint": "run-s prettier:lint:message prettier:lint:list",
	"prettier:lint:message": "echo \"Listing unlinted files, will show nothing if everything is fine.\"",
	"prettier:lint:list": "prettier --config .prettierrc --list-different rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
	"prettier:lint:fix": "prettier --config .prettierrc --write rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
	precommit: "pretty-quick --staged",
	"core:watch": "watch \"npm run core:build\" core",
	"core:build": "run-s core:build:asc core:build:dist core:build:done",
	"core:build:asc": "asc core/index.ts -b dist/core/core.untouched.wasm -t dist/core/core.untouched.wat -O3 --converge --sourceMap core/dist/core.untouched.wasm.map --memoryBase 0",
	"core:build:ts": "rollup -c --environment TS",
	"core:build:asc:measure": "npm run core:build:asc -- --measure --noEmit",
	"core:build:ts:measure": "tsc --project core/tsconfig.json --noEmit --extendedDiagnostics",
	"core:build:dist": "run-s core:build:dist:mkdir core:build:dist:cp",
	"core:build:dist:mkdir": "mkdir -p build/assets",
	"core:build:dist:cp": "cp dist/core/*.untouched.* build/assets",
	"core:build:done": "echo \"Built Core!\"",
	"lib:build": "run-s lib:build:wasm lib:build:ts lib:build:ts:getcoreclosure",
	"lib:watch:wasm": "rollup -c -w --environment WASM",
	"lib:build:wasm": "rollup -c --environment PROD,WASM",
	"lib:watch:ts": "rollup -c -w --environment TS",
	"lib:build:ts": "rollup -c --environment PROD,TS",
	"lib:build:ts:esnext": "rollup -c --environment PROD,TS,ES_NEXT",
	"lib:build:ts:getcoreclosure": "rollup -c --environment PROD,TS,GET_CORE_CLOSURE",
	"lib:build:ts:getcoreclosure:closuredebug": "rollup -c --environment PROD,TS,GET_CORE_CLOSURE,CLOSURE_DEBUG",
	"lib:deploy": "run-s core:build lib:build:wasm lib:build:ts lib:deploy:np",
	"lib:deploy:np": "np",
	test: "npm run test:accuracy",
	"test:accuracy": "run-s build test:accuracy:nobuild",
	"test:accuracy:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/accuracy/accuracy-test.js --exit",
	"test:perf": "npm run test:performance",
	"test:performance": "run-s build test:performance:nobuild",
	"test:performance:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/performance/performance-test.js --exit",
	"test:integration": "run-s build test:integration:lib test:integration:headless",
	"test:integration:nobuild": "run-s test:integration:lib test:integration:headless",
	"test:integration:lib": "node --experimental-worker node_modules/mocha/bin/_mocha test/integration/lib-test.js --exit",
	"test:integration:headless": "node --experimental-worker node_modules/mocha/bin/_mocha test/integration/headless-simple.js --timeout 20000 --exit",
	"test:core": "run-s build test:core:savestate",
	"test:core:nobuild": "run-s test:core:savestate",
	"test:core:savestate": "node --experimental-worker node_modules/mocha/bin/_mocha test/core/save-state.js --timeout 10000 --exit",
	"debugger:dev": "npm run debugger:watch",
	"debugger:watch": "rollup -c -w --environment DEBUGGER,SERVE",
	"debugger:build": "rollup -c --environment DEBUGGER",
	"debugger:build:skiplib": "rollup -c --environment DEBUGGER,SKIP_LIB",
	"benchmark:build": "rollup -c --environment PROD,TS,BENCHMARK",
	"benchmark:build:skiplib": "rollup -c --environment PROD,TS,BENCHMARK,SKIP_LIB",
	"benchmark:dev": "npm run benchmark:watch",
	"benchmark:watch": "rollup -c -w --environment BENCHMARK,SERVE",
	"amp:build": "rollup -c --environment PROD,TS,AMP",
	"amp:build:skiplib": "rollup -c --environment PROD,TS,AMP,SKIP_LIB",
	"amp:dev": "npm run amp:watch",
	"amp:watch": "rollup -c -w --environment AMP,SERVE",
	"iframe:dev": "npm run iframe:watch",
	"iframe:watch": "rollup -c -w --environment IFRAME,SERVE",
	"iframe:serve": "serve build/iframe -p 8080",
	"iframe:build": "rollup -c --environment IFRAME",
	"iframe:build:skiplib": "rollup -c --environment IFRAME,SKIP_LIB",
	"demo:build": "run-s core:build lib:build demo:build:apps",
	"demo:build:apps": "run-s debugger:build:skiplib benchmark:build:skiplib amp:build:skiplib iframe:build:skiplib",
	"demo:cname": "echo 'wasmboy.app' > build/CNAME",
	"demo:dist": "cp -r dist/ build/dist",
	"demo:gh-pages": "gh-pages -d build",
	"demo:deploy": "run-s demo:build demo:dist demo:cname demo:gh-pages",
	"wasmerboy:build": "asc demo/wasmerboy/index.ts -b demo/wasmerboy/dist/wasmerboy.wasm -O3 --converge --use abort=wasi_abort --runtime stub --memoryBase 8324096",
	"wasmerboy:start": "cd demo/wasmerboy && wapm run wasmerboy --dir=tobutobugirl tobutobugirl/tobutobugirl.gb && cd .."
};
var files = [
	"dist",
	"core",
	"lib",
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
	"@ampproject/rollup-plugin-closure-compiler": "^0.26.0",
	"@babel/core": "^7.1.2",
	"@babel/plugin-proposal-class-properties": "^7.1.0",
	"@babel/plugin-proposal-export-default-from": "^7.2.0",
	"@babel/plugin-proposal-object-rest-spread": "^7.0.0",
	"@babel/plugin-transform-react-jsx": "^7.0.0",
	"@phosphor/commands": "^1.6.1",
	"@phosphor/default-theme": "^0.1.0",
	"@phosphor/messaging": "^1.2.2",
	"@phosphor/widgets": "^1.6.0",
	"@rollup/plugin-commonjs": "^11.0.2",
	"@rollup/plugin-node-resolve": "^7.1.1",
	"@wasmer/io-devices-lib-assemblyscript": "^0.1.3",
	"as-wasi": "git+https://github.com/jedisct1/as-wasi.git",
	assemblyscript: "^0.15.1",
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
	"hash-generator": "^0.1.0",
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
	"rollup-plugin-copy-glob": "^0.3.1",
	"rollup-plugin-delete": "^0.1.2",
	"rollup-plugin-hash": "^1.3.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-livereload": "^1.3.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-postcss": "^1.6.2",
	"rollup-plugin-replace": "^2.1.0",
	"rollup-plugin-serve": "^0.6.0",
	"rollup-plugin-svelte": "^5.1.1",
	"rollup-plugin-terser": "^5.2.0",
	"rollup-plugin-typescript": "^1.0.0",
	"rollup-plugin-url": "^2.1.0",
	serve: "^11.3.2",
	"shared-gb": "git+https://github.com/torch2424/shared-gb-js.git",
	"source-map-loader": "^0.2.4",
	"stats-lite": "^2.2.0",
	svelte: "^3.19.2",
	terser: "^4.6.6",
	traverse: "^0.6.6",
	tslib: "^1.9.3",
	typescript: "^3.1.3",
	"uglifyjs-webpack-plugin": "^1.2.3",
	"url-loader": "^1.0.1",
	valoo: "^2.1.0",
	watch: "^1.0.2",
	"webpack-dev-server": "^3.11.0"
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
