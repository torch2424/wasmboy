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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBKKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX0xPQ0FUSU9OLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBLKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkFVRElPX0xBVEVOQ1k6YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQpiLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gTChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gQShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTisKZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQihhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIE0oYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhaztjYXNlIGYuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfQk9PVF9ST01fTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JBTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfTE9DQVRJT04udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlNFVF9NRU1PUlk6ZD1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2QuaW5jbHVkZXMoZy5CT09UX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkJPT1RfUk9NXSksYS5XQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSxhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9SQU0pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUkFNXSksYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuR0FNRUJPWV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5HQU1FQk9ZX01FTU9SWV0pLAphLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OKSxhLndhc21JbnN0YW5jZS5leHBvcnRzLmxvYWRTdGF0ZSgpKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLlNFVF9NRU1PUllfRE9ORX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX01FTU9SWTp7ZD17dHlwZTpmLkdFVF9NRU1PUll9O2xldCBsPVtdO3ZhciBjPWIubWVzc2FnZS5tZW1vcnlUeXBlcztpZihjLmluY2x1ZGVzKGcuQk9PVF9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXt2YXIgZT0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGUsZSthLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX1NJWkUudmFsdWVPZigpKX1lbHNlIGU9bmV3IFVpbnQ4QXJyYXk7ZT1lLmJ1ZmZlcjtkW2cuQk9PVF9ST01dPWU7bC5wdXNoKGUpfWlmKGMuaW5jbHVkZXMoZy5DQVJUUklER0VfUk9NKSl7aWYoYS53YXNtQnl0ZU1lbW9yeSl7ZT1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIG09dm9pZCAwOzA9PT1lP209MzI3Njg6MTw9ZSYmMz49ZT9tPTIwOTcxNTI6NTw9ZSYmNj49ZT9tPTI2MjE0NDoxNTw9ZSYmMTk+PWU/bT0yMDk3MTUyOjI1PD1lJiYzMD49ZSYmKG09ODM4ODYwOCk7ZT1tP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04sYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rbSk6Cm5ldyBVaW50OEFycmF5fWVsc2UgZT1uZXcgVWludDhBcnJheTtlPWUuYnVmZmVyO2RbZy5DQVJUUklER0VfUk9NXT1lO2wucHVzaChlKX1jLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JBTSkmJihlPUEoYSkuYnVmZmVyLGRbZy5DQVJUUklER0VfUkFNXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkNBUlRSSURHRV9IRUFERVIpJiYoYS53YXNtQnl0ZU1lbW9yeT8oZT1hLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMDgsZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGUsZSsyNykpOmU9bmV3IFVpbnQ4QXJyYXksZT1lLmJ1ZmZlcixkW2cuQ0FSVFJJREdFX0hFQURFUl09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5HQU1FQk9ZX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLApkW2cuR0FNRUJPWV9NRU1PUlldPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiYoZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcixkW2cuUEFMRVRURV9NRU1PUlldPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5zYXZlU3RhdGUoKSxjPUIoYSkuYnVmZmVyLGRbZy5JTlRFUk5BTF9TVEFURV09YyxsLnB1c2goYykpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGQsYi5tZXNzYWdlSWQpLGwpfX19ZnVuY3Rpb24gTihhKXtsZXQgYj0idW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKTtmb3IoO2EuZnBzVGltZVN0YW1wc1swXTxiLTFFMzspYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCk7CmEuZnBzVGltZVN0YW1wcy5wdXNoKGIpO2EudGltZVN0YW1wc1VudGlsUmVhZHktLTswPmEudGltZVN0YW1wc1VudGlsUmVhZHkmJihhLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTApO3JldHVybiBifWZ1bmN0aW9uIHcoYSl7YS50aW1lU3RhbXBzVW50aWxSZWFkeT05MD49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU/MS4yNSpNYXRoLmZsb29yKGEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKToxMjB9ZnVuY3Rpb24gQyhhKXtsZXQgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gRChhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUUtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0YoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEYoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRT1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksRChhKSwhMDtOKGEpO2xldCBjPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoYj0+e2xldCBkO2M/eChhLGIpOihkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksCmIoZCkpfSkpLnRoZW4oYj0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEMoYSk7bGV0IGQ9e3R5cGU6Zi5VUERBVEVEfTtkW2cuQ0FSVFJJREdFX1JBTV09QShhKS5idWZmZXI7ZFtnLkdBTUVCT1lfTUVNT1JZXT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtkW2cuUEFMRVRURV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTisKYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtkW2cuSU5URVJOQUxfU1RBVEVdPUIoYSkuYnVmZmVyO09iamVjdC5rZXlzKGQpLmZvckVhY2goYT0+e3ZvaWQgMD09PWRbYV0mJihkW2FdPShuZXcgVWludDhBcnJheSkuYnVmZmVyKX0pO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKGQpLFtkW2cuQ0FSVFJJREdFX1JBTV0sZFtnLkdBTUVCT1lfTUVNT1JZXSxkW2cuUEFMRVRURV9NRU1PUlldLGRbZy5JTlRFUk5BTF9TVEFURV1dKTsyPT09Yj9rKGgoe3R5cGU6Zi5CUkVBS1BPSU5UfSkpOkQoYSl9ZWxzZSBrKGgoe3R5cGU6Zi5DUkFTSEVEfSkpLGEucGF1c2VkPSEwfSl9ZnVuY3Rpb24geChhLGIpe3ZhciBkPS0xO2Q9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvKDEwMjQpOzEhPT1kJiZiKGQpO2lmKDE9PT1kKXtkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0TnVtYmVyT2ZTYW1wbGVzSW5BdWRpb0J1ZmZlcigpOwpsZXQgYz1yPj11Oy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmM/KEcoYSxkKSxzZXRUaW1lb3V0KCgpPT57dyhhKTt4KGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooRyhhLGQpLHgoYSxiKSl9fWZ1bmN0aW9uIEcoYSxiKXt2YXIgZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtsZXQgYz17dHlwZTpmLlVQREFURUQsYXVkaW9CdWZmZXI6ZCxudW1iZXJPZlNhbXBsZXM6YixmcHM6cixhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6NjA8YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9O2Q9W2RdO2lmKGEub3B0aW9ucyYmYS5vcHRpb25zLmVuYWJsZUF1ZGlvRGVidWdnaW5nKXt2YXIgZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwxQnVmZmVyPWU7ZC5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwyQnVmZmVyPWU7ZC5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWwzQnVmZmVyPWU7ZC5wdXNoKGUpO2I9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjLmNoYW5uZWw0QnVmZmVyPWI7ZC5wdXNoKGIpfWEuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoYyksCmQpO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpfWxldCBwPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsdjtwfHwodj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2xldCBmPXtDT05ORUNUOiJDT05ORUNUIixJTlNUQU5USUFURV9XQVNNOiJJTlNUQU5USUFURV9XQVNNIixDTEVBUl9NRU1PUlk6IkNMRUFSX01FTU9SWSIsQ0xFQVJfTUVNT1JZX0RPTkU6IkNMRUFSX01FTU9SWV9ET05FIixHRVRfTUVNT1JZOiJHRVRfTUVNT1JZIixTRVRfTUVNT1JZOiJTRVRfTUVNT1JZIixTRVRfTUVNT1JZX0RPTkU6IlNFVF9NRU1PUllfRE9ORSIsR0VUX0NPTlNUQU5UUzoiR0VUX0NPTlNUQU5UUyIsR0VUX0NPTlNUQU5UU19ET05FOiJHRVRfQ09OU1RBTlRTX0RPTkUiLENPTkZJRzoiQ09ORklHIixSRVNFVF9BVURJT19RVUVVRToiUkVTRVRfQVVESU9fUVVFVUUiLFBMQVk6IlBMQVkiLEJSRUFLUE9JTlQ6IkJSRUFLUE9JTlQiLFBBVVNFOiJQQVVTRSIsClVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCIsRk9SQ0VfT1VUUFVUX0ZSQU1FOiJGT1JDRV9PVVRQVVRfRlJBTUUiLFNFVF9TUEVFRDoiU0VUX1NQRUVEIixJU19HQkM6IklTX0dCQyJ9LGc9e0JPT1RfUk9NOiJCT09UX1JPTSIsQ0FSVFJJREdFX1JBTToiQ0FSVFJJREdFX1JBTSIsQ0FSVFJJREdFX1JPTToiQ0FSVFJJREdFX1JPTSIsQ0FSVFJJREdFX0hFQURFUjoiQ0FSVFJJREdFX0hFQURFUiIsR0FNRUJPWV9NRU1PUlk6IkdBTUVCT1lfTUVNT1JZIixQQUxFVFRFX01FTU9SWToiUEFMRVRURV9NRU1PUlkiLElOVEVSTkFMX1NUQVRFOiJJTlRFUk5BTF9TVEFURSJ9LAp0PTAseT17fSxIPShhLGIpPT57bGV0IGM9IltXYXNtQm95XSI7LTk5OTkhPT1hJiYoYys9YCAweCR7YS50b1N0cmluZygxNil9IGApOy05OTk5IT09YiYmKGMrPWAgMHgke2IudG9TdHJpbmcoMTYpfSBgKTtjb25zb2xlLmxvZyhjKX0sej17aW5kZXg6e2NvbnNvbGVMb2c6SCxjb25zb2xlTG9nVGltZW91dDooYSxiLGMpPT57eVthXXx8KHlbYV09ITAsSChhLGIpLHNldFRpbWVvdXQoKCk9PntkZWxldGUgeVthXX0sYykpfX0sZW52OnthYm9ydDooKT0+e2NvbnNvbGUuZXJyb3IoIkFzc2VtYmx5U2NyaXB0IEltcG9ydCBPYmplY3QgQWJvcnRlZCEiKX19fSxJPWFzeW5jIGE9PntsZXQgYj12b2lkIDA7cmV0dXJuIGI9V2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmc/YXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcoZmV0Y2goYSkseik6YXdhaXQgKGFzeW5jKCk9Pntjb25zdCBiPWF3YWl0IGZldGNoKGEpLnRoZW4oYT0+YS5hcnJheUJ1ZmZlcigpKTtyZXR1cm4gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYiwKeil9KSgpfSxPPWFzeW5jIGE9PnthPUJ1ZmZlci5mcm9tKGEuc3BsaXQoIiwiKVsxXSwiYmFzZTY0Iik7cmV0dXJuIGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGEseil9LFA9YXN5bmMgYT0+e2E9KGE/YXdhaXQgSSgiZGF0YTphcHBsaWNhdGlvbi93YXNtO2Jhc2U2NCxBR0Z6YlFFQUFBQUJmUkJnQUFGL1lBRi9BWDlnQVg4QVlBQUFZQUovZndGL1lBSi9md0JnQTM5L2Z3QmdCbjkvZjM5L2Z3QmdCSDkvZjM4QVlBZC9mMzkvZjM5L0FHQUlmMzkvZjM5L2YzOEFZQXAvZjM5L2YzOS9mMzkvQUdBRGYzOS9BWDlnQkg5L2YzOEJmMkFGZjM5L2YzOEJmMkFOZjM5L2YzOS9mMzkvZjM5L2Z3Ri9BZzBCQTJWdWRnVmhZbTl5ZEFBSUE1WUJsQUVGQlFZQUJBWU1CQUVDQVFNQ0FnTURBd3NBQXdNREF3TURBd01BQUFBQURnUVBDUWNIQlFJQ0F3RUJBUUVCRFFJQ0F3RUFBUUVGQXdJQ0FnSUVBZ0lDQWdRRkJnUURBZ0lDQUFVR0FRRUJBUUVCQVFFQ0FnRUNBZ0VCQWdFQkFRRUJBUUVCQWdBQUFBRUFBUUFBQUFJS0FnTUNBd0lEQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlEQXdBQUFBQURBd01DQVFRQ0JRTUJBQUVHM2d1WUFuOEJRUUFMZndGQkFBdC9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUVlDQUFRdC9BRUdBa0FFTGZ3QkJnSUFDQzM4QVFZQ1FBd3QvQUVHQWdBRUxmd0JCZ0JBTGZ3QkJnSUFFQzM4QVFZQ1FCQXQvQUVHQUFRdC9BRUdBa1FRTGZ3QkJnTGdCQzM4QVFZREpCUXQvQUVHQTJBVUxmd0JCZ0tFTEMzOEFRWUNBREF0L0FFR0FvUmNMZndCQmdJQUpDMzhBUVlDaElBdC9BRUdBK0FBTGZ3QkJnSkFFQzM4QVFZQ0pIUXQvQUVHQW1TRUxmd0JCZ0lBSUMzOEFRWUNaS1F0L0FFR0FnQWdMZndCQmdKa3hDMzhBUVlDQUNBdC9BRUdBbVRrTGZ3QkJnSUFJQzM4QVFZQ1p3UUFMZndCQmdJQUlDMzhBUVlDWnlRQUxmd0JCZ0lBSUMzOEFRWUNaMFFBTGZ3QkJnQlFMZndCQmdLM1JBQXQvQUVHQWlQZ0RDMzhBUVlDMXlRUUxmd0JCLy84REMzOEFRUUFMZndCQmdMWE5CQXQvQUVHVUFRdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVg4TGZ3RkJmd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCL3dBTGZ3RkIvd0FMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVg4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVHZ0NRdC9BVUVBQ3dlZEVXa0diV1Z0YjNKNUFnQUhYMTloYkd4dll3QUlDRjlmY21WMFlXbHVBQWtKWDE5eVpXeGxZWE5sQUFvSlgxOWpiMnhzWldOMEFKQUJDMTlmY25SMGFWOWlZWE5sQTVZQ0JtTnZibVpwWndBU0RtaGhjME52Y21WVGRHRnlkR1ZrQUJNSmMyRjJaVk4wWVhSbEFCWUpiRzloWkZOMFlYUmxBQnNGYVhOSFFrTUFIQkpuWlhSVGRHVndjMUJsY2xOMFpYQlRaWFFBSFF0blpYUlRkR1Z3VTJWMGN3QWVDR2RsZEZOMFpYQnpBQjhWWlhobFkzVjBaVTExYkhScGNHeGxSbkpoYldWekFHc01aWGhsWTNWMFpVWnlZVzFsQUdvWlpYaGxZM1YwWlVaeVlXMWxRVzVrUTJobFkydEJkV1JwYndDU0FSVmxlR1ZqZFhSbFZXNTBhV3hEYjI1a2FYUnBiMjRBa3dFTFpYaGxZM1YwWlZOMFpYQUFaeFJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFCc0RHZGxkRU41WTJ4bFUyVjBjd0J0Q1dkbGRFTjVZMnhsY3dCdURuTmxkRXB2ZVhCaFpGTjBZWFJsQUhBZloyVjBUblZ0WW1WeVQyWlRZVzF3YkdWelNXNUJkV1JwYjBKMVptWmxjZ0JvRUdOc1pXRnlRWFZrYVc5Q2RXWm1aWElBRnh4elpYUk5ZVzUxWVd4RGIyeHZjbWw2WVhScGIyNVFZV3hsZEhSbEFBMFhWMEZUVFVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0RExoTlhRVk5OUWs5WlgwMUZUVTlTV1Y5VFNWcEZBeThTVjBGVFRVSlBXVjlYUVZOTlgxQkJSMFZUQXpBZVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMHhQUTBGVVNVOU9Bd0lhUVZOVFJVMUNURmxUUTFKSlVGUmZUVVZOVDFKWlgxTkpXa1VEQXhaWFFWTk5RazlaWDFOVVFWUkZYMHhQUTBGVVNVOU9Bd1FTVjBGVFRVSlBXVjlUVkVGVVJWOVRTVnBGQXdVZ1IwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVEU5RFFWUkpUMDREREJ4SFFVMUZRazlaWDBsT1ZFVlNUa0ZNWDAxRlRVOVNXVjlUU1ZwRkF3MFNWa2xFUlU5ZlVrRk5YMHhQUTBGVVNVOU9Bd1lPVmtsRVJVOWZVa0ZOWDFOSldrVURCeEZYVDFKTFgxSkJUVjlNVDBOQlZFbFBUZ01JRFZkUFVrdGZVa0ZOWDFOSldrVURDU1pQVkVoRlVsOUhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNS0lrOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMU5KV2tVREN4aEhVa0ZRU0VsRFUxOVBWVlJRVlZSZlRFOURRVlJKVDA0REdoUkhVa0ZRU0VsRFUxOVBWVlJRVlZSZlUwbGFSUU1iRkVkQ1ExOVFRVXhGVkZSRlgweFBRMEZVU1U5T0F3NFFSMEpEWDFCQlRFVlVWRVZmVTBsYVJRTVBHRUpIWDFCU1NVOVNTVlJaWDAxQlVGOU1UME5CVkVsUFRnTVFGRUpIWDFCU1NVOVNTVlJaWDAxQlVGOVRTVnBGQXhFT1JsSkJUVVZmVEU5RFFWUkpUMDRERWdwR1VrRk5SVjlUU1ZwRkF4TVhRa0ZEUzBkU1QxVk9SRjlOUVZCZlRFOURRVlJKVDA0REZCTkNRVU5MUjFKUFZVNUVYMDFCVUY5VFNWcEZBeFVTVkVsTVJWOUVRVlJCWDB4UFEwRlVTVTlPQXhZT1ZFbE1SVjlFUVZSQlgxTkpXa1VERnhKUFFVMWZWRWxNUlZOZlRFOURRVlJKVDA0REdBNVBRVTFmVkVsTVJWTmZVMGxhUlFNWkZVRlZSRWxQWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01rRVVGVlJFbFBYMEpWUmtaRlVsOVRTVnBGQXlVWlEwaEJUazVGVEY4eFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNY0ZVTklRVTVPUlV4Zk1WOUNWVVpHUlZKZlUwbGFSUU1kR1VOSVFVNU9SVXhmTWw5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESGhWRFNFRk9Ua1ZNWHpKZlFsVkdSa1ZTWDFOSldrVURIeGxEU0VGT1RrVk1Yek5mUWxWR1JrVlNYMHhQUTBGVVNVOU9BeUFWUTBoQlRrNUZURjh6WDBKVlJrWkZVbDlUU1ZwRkF5RVpRMGhCVGs1RlRGODBYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWlGVU5JUVU1T1JVeGZORjlDVlVaR1JWSmZVMGxhUlFNakZrTkJVbFJTU1VSSFJWOVNRVTFmVEU5RFFWUkpUMDRESmhKRFFWSlVVa2xFUjBWZlVrRk5YMU5KV2tVREp4RkNUMDlVWDFKUFRWOU1UME5CVkVsUFRnTW9EVUpQVDFSZlVrOU5YMU5KV2tVREtSWkRRVkpVVWtsRVIwVmZVazlOWDB4UFEwRlVTVTlPQXlvU1EwRlNWRkpKUkVkRlgxSlBUVjlUU1ZwRkF5c2RSRVZDVlVkZlIwRk5SVUpQV1Y5TlJVMVBVbGxmVEU5RFFWUkpUMDRETEJsRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOVRTVnBGQXkwaFoyVjBWMkZ6YlVKdmVVOW1abk5sZEVaeWIyMUhZVzFsUW05NVQyWm1jMlYwQUFzYmMyVjBVSEp2WjNKaGJVTnZkVzUwWlhKQ2NtVmhhM0J2YVc1MEFIRWRjbVZ6WlhSUWNtOW5jbUZ0UTI5MWJuUmxja0p5WldGcmNHOXBiblFBY2hselpYUlNaV0ZrUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUhNYmNtVnpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFIUWFjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUFkUnh5WlhObGRGZHlhWFJsUjJKTlpXMXZjbmxDY21WaGEzQnZhVzUwQUhZTVoyVjBVbVZuYVhOMFpYSkJBSGNNWjJWMFVtVm5hWE4wWlhKQ0FIZ01aMlYwVW1WbmFYTjBaWEpEQUhrTVoyVjBVbVZuYVhOMFpYSkVBSG9NWjJWMFVtVm5hWE4wWlhKRkFIc01aMlYwVW1WbmFYTjBaWEpJQUh3TVoyVjBVbVZuYVhOMFpYSk1BSDBNWjJWMFVtVm5hWE4wWlhKR0FINFJaMlYwVUhKdlozSmhiVU52ZFc1MFpYSUFmdzluWlhSVGRHRmphMUJ2YVc1MFpYSUFnQUVaWjJWMFQzQmpiMlJsUVhSUWNtOW5jbUZ0UTI5MWJuUmxjZ0NCQVFWblpYUk1XUUNDQVFwblpYUlRZM0p2Ykd4WUFJTUJDbWRsZEZOamNtOXNiRmtBaEFFS1oyVjBWMmx1Wkc5M1dBQ0ZBUXBuWlhSWGFXNWtiM2RaQUlZQkhXUnlZWGRDWVdOclozSnZkVzVrVFdGd1ZHOVhZWE50VFdWdGIzSjVBSWNCR0dSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllUUNJQVJOa2NtRjNUMkZ0Vkc5WFlYTnRUV1Z0YjNKNUFJa0JCbWRsZEVSSlZnQ0tBUWRuWlhSVVNVMUJBSXNCQm1kbGRGUk5RUUNNQVFablpYUlVRVU1BalFFVGRYQmtZWFJsUkdWaWRXZEhRazFsYlc5eWVRQ09BUlJmWDNObGRFRnlaM1Z0Wlc1MGMweGxibWQwYUFDVUFRZ0Nqd0VLK2IwQ2xBR1ZBZ0VFZnlBQktBSUFJZ0pCQVhGRkJFQkJBRUdRQ0VHVkFrRU9FQUFBQ3lBQ1FYeHhJZ0pCOFAvLy93TkpRUUFnQWtFUVR4dEZCRUJCQUVHUUNFR1hBa0VPRUFBQUN5QUNRWUFDU1FSQUlBSkJCSFloQWdVZ0FrRWZJQUpuYXlJRFFRUnJka0VRY3lFQ0lBTkJCMnNoQXdzZ0FrRVFTVUVBSUFOQkYwa2JSUVJBUVFCQmtBaEJwQUpCRGhBQUFBc2dBU2dDRkNFRUlBRW9BaEFpQlFSQUlBVWdCRFlDRkFzZ0JBUkFJQVFnQlRZQ0VBc2dBU0FBSUFJZ0EwRUVkR3BCQW5ScUtBSmdSZ1JBSUFBZ0FpQURRUVIwYWtFQ2RHb2dCRFlDWUNBRVJRUkFJQUFnQTBFQ2RHb2lCQ2dDQkVGK0lBSjNjU0VCSUFRZ0FUWUNCQ0FCUlFSQUlBQWdBQ2dDQUVGK0lBTjNjVFlDQUFzTEN3di9Bd0VIZnlBQlJRUkFRUUJCa0FoQnpRRkJEaEFBQUFzZ0FTZ0NBQ0lFUVFGeFJRUkFRUUJCa0FoQnp3RkJEaEFBQUFzZ0FVRVFhaUFCS0FJQVFYeHhhaUlGS0FJQUlnSkJBWEVFUUNBRVFYeHhRUkJxSUFKQmZIRnFJZ05COFAvLy93TkpCRUFDZnlBQUlBVVFBU0FCSUFNZ0JFRURjWElpQkRZQ0FDQUJRUkJxSUFFb0FnQkJmSEZxSWdVb0FnQUxJUUlMQ3lBRVFRSnhCRUFDZnlBQlFRUnJLQUlBSWdNb0FnQWlCMEVCY1VVRVFFRUFRWkFJUWVRQlFSQVFBQUFMSUFkQmZIRkJFR29nQkVGOGNXb2lDRUh3Ly8vL0Ewa0VmeUFBSUFNUUFTQURJQWdnQjBFRGNYSWlCRFlDQUNBREJTQUJDd3NoQVFzZ0JTQUNRUUp5TmdJQUlBUkJmSEVpQTBIdy8vLy9BMGxCQUNBRFFSQlBHMFVFUUVFQVFaQUlRZk1CUVE0UUFBQUxJQVVnQXlBQlFSQnFha2NFUUVFQVFaQUlRZlFCUVE0UUFBQUxJQVZCQkdzZ0FUWUNBQ0FEUVlBQ1NRUkFJQU5CQkhZaEF3VWdBMEVmSUFObmF5SUVRUVJyZGtFUWN5RURJQVJCQjJzaEJnc2dBMEVRU1VFQUlBWkJGMGtiUlFSQVFRQkJrQWhCaEFKQkRoQUFBQXNnQUNBRElBWkJCSFJxUVFKMGFpZ0NZQ0VFSUFGQkFEWUNFQ0FCSUFRMkFoUWdCQVJBSUFRZ0FUWUNFQXNnQUNBRElBWkJCSFJxUVFKMGFpQUJOZ0pnSUFBZ0FDZ0NBRUVCSUFaMGNqWUNBQ0FBSUFaQkFuUnFJZ0FnQUNnQ0JFRUJJQU4wY2pZQ0JBdlJBUUVDZnlBQ1FROXhSVUVBSUFGQkQzRkZRUUFnQVNBQ1RSc2JSUVJBUVFCQmtBaEJnZ05CQlJBQUFBc2dBQ2dDb0F3aUF3UkFJQUVnQTBFUWFra0VRRUVBUVpBSVFZd0RRUkFRQUFBTElBTWdBVUVRYTBZRVFBSi9JQU1vQWdBaEJDQUJRUkJyQ3lFQkN3VWdBU0FBUWFRTWFra0VRRUVBUVpBSVFaZ0RRUVVRQUFBTEN5QUNJQUZySWdKQk1Fa0VRQThMSUFFZ0JFRUNjU0FDUVNCclFRRnljallDQUNBQlFRQTJBaEFnQVVFQU5nSVVJQUVnQW1wQkVHc2lBa0VDTmdJQUlBQWdBallDb0F3Z0FDQUJFQUlMbmdFQkEzOGpBQ0lDUlFSQVFRRS9BQ0lBU2dSL1FRRWdBR3RBQUVFQVNBVkJBQXNFUUFBTFFjQUpJUUpCd0FsQkFEWUNBRUhnRlVFQU5nSUFBMEFnQVVFWFNRUkFJQUZCQW5SQndBbHFRUUEyQWdSQkFDRUFBMEFnQUVFUVNRUkFJQUFnQVVFRWRHcEJBblJCd0FscVFRQTJBbUFnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTFFjQUpRZkFWUHdCQkVIUVFBMEhBQ1NRQUN5QUNDOThCQVFGL0lBRkJnQUpKQkVBZ0FVRUVkaUVCQlFKL0lBRkIrUC8vL3dGSkJFQWdBVUVCUVJzZ0FXZHJkR3BCQVdzaEFRc2dBUXRCSHlBQloyc2lBa0VFYTNaQkVITWhBU0FDUVFkcklRSUxJQUZCRUVsQkFDQUNRUmRKRzBVRVFFRUFRWkFJUWRJQ1FRNFFBQUFMSUFBZ0FrRUNkR29vQWdSQmZ5QUJkSEVpQVFSL0lBQWdBV2dnQWtFRWRHcEJBblJxS0FKZ0JTQUFLQUlBUVg4Z0FrRUJhblJ4SWdFRWZ5QUFJQUZvSWdGQkFuUnFLQUlFSWdKRkJFQkJBRUdRQ0VIZkFrRVNFQUFBQ3lBQUlBSm9JQUZCQkhScVFRSjBhaWdDWUFWQkFBc0xDNGNCQVFKL0lBRW9BZ0FoQXlBQ1FROXhCRUJCQUVHUUNFSHRBa0VPRUFBQUN5QURRWHh4SUFKcklnUkJJRThFUUNBQklBSWdBMEVDY1hJMkFnQWdBaUFCUVJCcWFpSUJJQVJCRUd0QkFYSTJBZ0FnQUNBQkVBSUZJQUVnQTBGK2NUWUNBQ0FCUVJCcUlnQWdBU2dDQUVGOGNXb2dBQ0FCS0FJQVFYeHhhaWdDQUVGOWNUWUNBQXNMcWdJQkEzOGpBUVJBUVFCQmtBaEI5QU5CRGhBQUFBc2dBU0lEUWZELy8vOERUd1JBUWNBSVFaQUlRYzBEUVI0UUFBQUxJQUFnQTBFUGFrRndjU0lCUVJBZ0FVRVFTeHNpQVJBRklnUkZCRUJCQVNRQlFRQWtBU0FBSUFFUUJTSUVSUVJBSUFGQitQLy8vd0ZKQkg4Z0FVRUJRUnNnQVdkcmRFRUJhMm9GSUFFTFFSQS9BQ0lFUVJCMFFSQnJJQUFvQXFBTVIzUnFRZi8vQTJwQmdJQjhjVUVRZGlFRklBUWdCU0FFSUFWS0cwQUFRUUJJQkVBZ0JVQUFRUUJJQkVBQUN3c2dBQ0FFUVJCMFB3QkJFSFFRQXlBQUlBRVFCU0lFUlFSQVFRQkJrQWhCZ0FSQkZCQUFBQXNMQ3lBRUtBSUFRWHh4SUFGSkJFQkJBRUdRQ0VHSUJFRU9FQUFBQ3lBRVFRQTJBZ1FnQkNBQ05nSUlJQVFnQXpZQ0RDQUFJQVFRQVNBQUlBUWdBUkFHSUFRTERRQVFCQ0FBSUFFUUIwRVFhZ3RoQVFKL0lBQkJ2QWxMQkVBZ0FFRVFheUlCS0FJRUlnSkJnSUNBZ0g5eElBSkJBV3BCZ0lDQWdIOXhSd1JBUVFCQmdBbEI3UUJCQXhBQUFBc2dBU0FDUVFGcU5nSUVJQUVvQWdCQkFYRUVRRUVBUVlBSlFmQUFRUTRRQUFBTEN5QUFDeE1BSUFCQnZBbExCRUFnQUVFUWF4Q1JBUXNMandJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVNZFE0T0FBRUJBUUlDQWdJREF3UUVCUVlIQ3lQOUFRUkFJLzRCQkVBZ0FFR0FBa2dOQ1NBQVFZQVNTRUVBSUFCQi93TktHdzBKQlVFQUlBQkJnQUpJSS80Qkd3MEpDd3NMSUFCQmdLM1JBR29QQ3lBQVFZQ0FBV3NoQVNBQlFRQWo3d0VpQUVVajl3RWJCSDlCQVFVZ0FBdEJEblJxUVlDdDBRQnFEd3NnQUVHQWtINXFJLzRCQkg5QnovNERFQXN0QUFCQkFYRUZRUUFMUVExMGFnOExJQUFqOEFGQkRYUnFRWURaeGdCcUR3c2dBRUdBa0g1cUR3c2dBRUVCSS80QkJIOUI4UDRERUFzdEFBQkJCM0VGUVFBTElnRWdBVUVCU1J0QkRIUnFRWUR3ZldvUEN5QUFRWUJRYWc4TElBQkJnSm5SQUdvTHd3RUFRUUFrL3dGQkFDU0FBa0VBSklFQ1FRQWtnZ0pCQUNTREFrRUFKSVFDUVFBa2hRSkJBQ1NHQWtFQUpJY0NRUUFraUFKQkFDU0pBa0VBSklvQ1FRQWtpd0pCQUNTTUFrRUFKSTBDUVFBa2pnSWovUUVFUUE4TEkvNEJCRUJCRVNTQUFrR0FBU1NIQWtFQUpJRUNRUUFrZ2dKQi93RWtnd0pCMWdBa2hBSkJBQ1NGQWtFTkpJWUNCVUVCSklBQ1FiQUJKSWNDUVFBa2dRSkJFeVNDQWtFQUpJTUNRZGdCSklRQ1FRRWtoUUpCelFBa2hnSUxRWUFDSklrQ1FmNy9BeVNJQWd1aENBQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFPRFFBQkFnTUVCUVlIQ0FrS0N3d05DMEh5NWNzSEpEdEJvTUdDQlNROFFkaXc0UUlrUFVHSWtDQWtQa0h5NWNzSEpEOUJvTUdDQlNSQVFkaXc0UUlrUVVHSWtDQWtRa0h5NWNzSEpFTkJvTUdDQlNSRVFkaXc0UUlrUlVHSWtDQWtSZ3dNQzBILy8vOEhKRHRCNDlyK0J5UThRWURpa0FRa1BVRUFKRDVCLy8vL0J5US9RZVBhL2dja1FFR0E0cEFFSkVGQkFDUkNRZi8vL3dja1EwSGoydjRISkVSQmdPS1FCQ1JGUVFBa1Jnd0xDMEgvLy84SEpEdEJoSW4rQnlROFFicjAwQVFrUFVFQUpENUIvLy8vQnlRL1FiSCs3d01rUUVHQWlBSWtRVUVBSkVKQi8vLy9CeVJEUWYvTGpnTWtSRUgvQVNSRlFRQWtSZ3dLQzBIRnpmOEhKRHRCaExtNkJpUThRYW5Xa1FRa1BVR0k0dWdDSkQ1Qi8vLy9CeVEvUWVQYS9nY2tRRUdBNHBBRUpFRkJBQ1JDUWYvLy93Y2tRMEhqMnY0SEpFUkJnT0tRQkNSRlFRQWtSZ3dKQzBILy8vOEhKRHRCZ1A3TEFpUThRWUNFL1Fja1BVRUFKRDVCLy8vL0J5US9RWUQreXdJa1FFR0FoUDBISkVGQkFDUkNRZi8vL3dja1EwR0Evc3NDSkVSQmdJVDlCeVJGUVFBa1Jnd0lDMEgvLy84SEpEdEJzZjd2QXlROFFjWEhBU1E5UVFBa1BrSC8vLzhISkQ5QmhJbitCeVJBUWJyMDBBUWtRVUVBSkVKQi8vLy9CeVJEUVlTSi9nY2tSRUc2OU5BRUpFVkJBQ1JHREFjTFFRQWtPMEdFaVFJa1BFR0F2UDhISkQxQi8vLy9CeVErUVFBa1AwR0VpUUlrUUVHQXZQOEhKRUZCLy8vL0J5UkNRUUFrUTBHRWlRSWtSRUdBdlA4SEpFVkIvLy8vQnlSR0RBWUxRYVgvL3dja08wR1VxZjRISkR4Qi82blNCQ1E5UVFBa1BrR2wvLzhISkQ5QmxLbitCeVJBUWYrcDBnUWtRVUVBSkVKQnBmLy9CeVJEUVpTcC9nY2tSRUgvcWRJRUpFVkJBQ1JHREFVTFFmLy8vd2NrTzBHQS92OEhKRHhCZ0lEOEJ5UTlRUUFrUGtILy8vOEhKRDlCZ1A3L0J5UkFRWUNBL0Fja1FVRUFKRUpCLy8vL0J5UkRRWUQrL3dja1JFR0FnUHdISkVWQkFDUkdEQVFMUWYvLy93Y2tPMEdBL3Y4SEpEeEJnSlR0QXlROVFRQWtQa0gvLy84SEpEOUIvOHVPQXlSQVFmOEJKRUZCQUNSQ1FmLy8vd2NrUTBHeC91OERKRVJCZ0lnQ0pFVkJBQ1JHREFNTFFmLy8vd2NrTzBIL3k0NERKRHhCL3dFa1BVRUFKRDVCLy8vL0J5US9RWVNKL2dja1FFRzY5TkFFSkVGQkFDUkNRZi8vL3dja1EwR3gvdThESkVSQmdJZ0NKRVZCQUNSR0RBSUxRZi8vL3dja08wSGVtYklFSkR4QmpLWEpBaVE5UVFBa1BrSC8vLzhISkQ5QmhJbitCeVJBUWJyMDBBUWtRVUVBSkVKQi8vLy9CeVJEUWVQYS9nY2tSRUdBNHBBRUpFVkJBQ1JHREFFTFFmLy8vd2NrTzBHbHk1WUZKRHhCMHFUSkFpUTlRUUFrUGtILy8vOEhKRDlCcGN1V0JTUkFRZEtreVFJa1FVRUFKRUpCLy8vL0J5UkRRYVhMbGdVa1JFSFNwTWtDSkVWQkFDUkdDd3ZhQ0FBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHSUFVY0VRQ0FBUWVFQVJnMEJJQUJCRkVZTkFpQUFRY1lBUmcwRElBQkIyUUJHRFFRZ0FFSEdBVVlOQkNBQVFZWUJSZzBGSUFCQnFBRkdEUVVnQUVHL0FVWU5CaUFBUWM0QlJnMEdJQUJCMFFGR0RRWWdBRUh3QVVZTkJpQUFRU2RHRFFjZ0FFSEpBRVlOQnlBQVFkd0FSZzBISUFCQnN3RkdEUWNnQUVISkFVWU5DQ0FBUWZBQVJnMEpJQUJCeGdCR0RRb2dBRUhUQVVZTkN3d01DMEgvdVpZRkpEdEJnUDcvQnlROFFZREdBU1E5UVFBa1BrSC91WllGSkQ5QmdQNy9CeVJBUVlER0FTUkJRUUFrUWtIL3VaWUZKRU5CZ1A3L0J5UkVRWURHQVNSRlFRQWtSZ3dMQzBILy8vOEhKRHRCLzh1T0F5UThRZjhCSkQxQkFDUStRZi8vL3dja1AwR0VpZjRISkVCQnV2VFFCQ1JCUVFBa1FrSC8vLzhISkVOQi84dU9BeVJFUWY4QkpFVkJBQ1JHREFvTFFmLy8vd2NrTzBHRWlmNEhKRHhCdXZUUUJDUTlRUUFrUGtILy8vOEhKRDlCc2Y3dkF5UkFRWUNJQWlSQlFRQWtRa0gvLy84SEpFTkJoSW4rQnlSRVFicjAwQVFrUlVFQUpFWU1DUXRCLyt2V0JTUTdRWlQvL3dja1BFSEN0TFVGSkQxQkFDUStRUUFrUDBILy8vOEhKRUJCaEluK0J5UkJRYnIwMEFRa1FrRUFKRU5CLy8vL0J5UkVRWVNKL2dja1JVRzY5TkFFSkVZTUNBdEIvLy8vQnlRN1FZVGJ0Z1VrUEVINzVva0NKRDFCQUNRK1FmLy8vd2NrUDBHQTV2MEhKRUJCZ0lUUkJDUkJRUUFrUWtILy8vOEhKRU5CLy92cUFpUkVRWUNBL0Fja1JVSC9BU1JHREFjTFFaei8vd2NrTzBILzY5SUVKRHhCODZpT0F5UTlRYnIwQUNRK1FjS0svd2NrUDBHQXJQOEhKRUJCZ1BUUUJDUkJRWUNBcUFJa1FrSC8vLzhISkVOQmhJbitCeVJFUWJyMDBBUWtSVUVBSkVZTUJndEJnUDZ2QXlRN1FmLy8vd2NrUEVIS3BQMEhKRDFCQUNRK1FmLy8vd2NrUDBILy8vOEhKRUJCLzh1T0F5UkJRZjhCSkVKQi8vLy9CeVJEUWVQYS9nY2tSRUdBNHBBRUpFVkJBQ1JHREFVTFFmKzVsZ1VrTzBHQS92OEhKRHhCZ01ZQkpEMUJBQ1ErUWRMRy9RY2tQMEdBZ05nR0pFQkJnSUNNQXlSQlFRQWtRa0gvQVNSRFFmLy8vd2NrUkVINy92OEhKRVZCLzRrQ0pFWU1CQXRCenYvL0J5UTdRZS9mandNa1BFR3hpUElFSkQxQjJyVHBBaVErUWYvLy93Y2tQMEdBNXYwSEpFQkJnSVRSQkNSQlFRQWtRa0gvLy84SEpFTkIvOHVPQXlSRVFmOEJKRVZCQUNSR0RBTUxRZi8vL3dja08wR0VpZjRISkR4QnV2VFFCQ1E5UVFBa1BrSC8vLzhISkQ5QmdQNERKRUJCZ0lqR0FTUkJRWUNVQVNSQ1FmLy8vd2NrUTBIL3k0NERKRVJCL3dFa1JVRUFKRVlNQWd0Qi8vLy9CeVE3UWYvTGpnTWtQRUgvQVNROVFRQWtQa0dBL3Y4SEpEOUJnSUQ4QnlSQVFZQ0FqQU1rUVVFQUpFSkIvLy8vQnlSRFFiSCs3d01rUkVHQWlBSWtSVUVBSkVZTUFRdEIvLy8vQnlRN1FZVGJ0Z1VrUEVINzVva0NKRDFCQUNRK1FmLy8vd2NrUDBIajJ2NEhKRUJCNDlyK0J5UkJRUUFrUWtILy8vOEhKRU5CLzh1T0F5UkVRZjhCSkVWQkFDUkdDd3ZSQWdFQ2YwRUFKT2dCUVFBazZRRkJBQ1RxQVVFQUpPc0JRUUFrN0FGQkFDVHRBVUVBSk80QlFaQUJKT29CSS80QkJFQkJ3ZjRERUF0QmdRRTZBQUJCeFA0REVBdEJrQUU2QUFCQngvNERFQXRCL0FFNkFBQUZRY0grQXhBTFFZVUJPZ0FBUWNiK0F4QUxRZjhCT2dBQVFjZitBeEFMUWZ3Qk9nQUFRY2orQXhBTFFmOEJPZ0FBUWNuK0F4QUxRZjhCT2dBQUMwR1FBU1RxQVVIQS9nTVFDMEdSQVRvQUFFSFAvZ01RQzBFQU9nQUFRZkQrQXhBTFFRRTZBQUFqL1FFRVFDUCtBUVJBUVFBazZnRkJ3UDRERUF0QkFEb0FBRUhCL2dNUUMwR0FBVG9BQUVIRS9nTVFDMEVBT2dBQUJVRUFKT29CUWNEK0F4QUxRUUE2QUFCQndmNERFQXRCaEFFNkFBQUxDMEVBRUEwQ1FDUCtBUTBBUVFBai9RRWovZ0ViRFFCQnRBSWhBQU5BSUFCQnd3Sk1CRUFnQVNBQUVBc3RBQUJxSVFFZ0FFRUJhaUVBREFFTEN5QUJRZjhCY1JBT0N3dnhCQUJCQUNTa0FVRUFKS1VCUVFBa3BnRkJBU1NuQVVFQkpLZ0JRUUVrcVFGQkFTU3FBVUVCSktzQlFRRWtyQUZCQVNTdEFVRUJKSzRCUVFFa3J3RkJBQ1N3QVVFQUpMSUJRUUFrc1FGQkFDU3pBVUdRL2dNUUMwR0FBVG9BQUVHUi9nTVFDMEcvQVRvQUFFR1MvZ01RQzBIekFUb0FBRUdUL2dNUUMwSEJBVG9BQUVHVS9nTVFDMEcvQVRvQUFDUDlBUVJBUVpIK0F4QUxRVDg2QUFCQmt2NERFQXRCQURvQUFFR1QvZ01RQzBFQU9nQUFRWlQrQXhBTFFiZ0JPZ0FBQzBHVi9nTVFDMEgvQVRvQUFFR1cvZ01RQzBFL09nQUFRWmYrQXhBTFFRQTZBQUJCbVA0REVBdEJBRG9BQUVHWi9nTVFDMEc0QVRvQUFFR2EvZ01RQzBIL0FEb0FBRUdiL2dNUUMwSC9BVG9BQUVHYy9nTVFDMEdmQVRvQUFFR2QvZ01RQzBFQU9nQUFRWjcrQXhBTFFiZ0JPZ0FBUVFFa2d3RkJuLzRERUF0Qi93RTZBQUJCb1A0REVBdEIvd0U2QUFCQm9mNERFQXRCQURvQUFFR2kvZ01RQzBFQU9nQUFRYVArQXhBTFFiOEJPZ0FBUWFUK0F4QUxRZmNBT2dBQVFRY2twUUZCQnlTbUFVR2wvZ01RQzBIekFUb0FBRUVCSktvQlFRRWtxUUZCQVNTb0FVRUJKS2NCUVFBa3JnRkJBQ1N0QVVFQkpLd0JRUUVrcXdGQnB2NERFQXRCOFFFNkFBQkJBU1N2QVNQOUFRUkFRYVQrQXhBTFFRQTZBQUJCQUNTbEFVRUFKS1lCUWFYK0F4QUxRUUE2QUFCQkFDU3FBVUVBSktrQlFRQWtxQUZCQUNTbkFVRUFKSzRCUVFBa3JRRkJBQ1NzQVVFQUpLc0JRYWIrQXhBTFFmQUFPZ0FBUVFBa3J3RUxRUThrbHdGQkR5U1lBVUVQSkprQlFROGttZ0ZCQUNTYkFVRUFKSndCUVFBa25RRkJBQ1NlQVVIL0FDU2ZBVUgvQUNTZ0FVRUJKS0VCUVFFa29nRkJBQ1NqQVF2VUJnRUJmMEhEQWhBTExRQUFJZ0JCd0FGR0JIOUJBUVVnQUVHQUFVWkJBQ015R3dzRVFFRUJKUDRCQlVFQUpQNEJDMEVBSkpVQ1FZQ28xcmtISkk4Q1FRQWtrQUpCQUNTUkFrR0FxTmE1QnlTU0FrRUFKSk1DUVFBa2xBSWpNUVJBUVFFay9RRUZRUUFrL1FFTEVBeEJBQ1R4QVVFQkpQSUJRY2NDRUFzdEFBQWlBRVVrOHdFZ0FFRURUVUVBSUFCQkFVOGJKUFFCSUFCQkJrMUJBQ0FBUVFWUEd5VDFBU0FBUVJOTlFRQWdBRUVQVHhzazlnRWdBRUVlVFVFQUlBQkJHVThiSlBjQlFRRWs3d0ZCQUNUd0FVSFAvZ01RQzBFQU9nQUFRZkQrQXhBTFFRRTZBQUJCMGY0REVBdEIvd0U2QUFCQjB2NERFQXRCL3dFNkFBQkIwLzRERUF0Qi93RTZBQUJCMVA0REVBdEIvd0U2QUFCQjFmNERFQXRCL3dFNkFBQVFEeVArQVFSQVFlaitBeEFMUWNBQk9nQUFRZW4rQXhBTFFmOEJPZ0FBUWVyK0F4QUxRY0VCT2dBQVFlditBeEFMUVEwNkFBQUZRZWorQXhBTFFmOEJPZ0FBUWVuK0F4QUxRZjhCT2dBQVFlcitBeEFMUWY4Qk9nQUFRZXYrQXhBTFFmOEJPZ0FBQ3lQK0FVRUFJLzBCR3dSQVFlbitBeEFMUVNBNkFBQkI2LzRERUF0QmlnRTZBQUFMRUJCQkFDUzNBVUVBSkxnQlFRQWt1UUZCQUNTNkFVRUFKTHNCUVFBa3RnRkIvLzhERUF0QkFEb0FBRUVCSkwwQlFRQWt2Z0ZCQUNTL0FVRUFKTUFCUVFBa3dRRkI0UUVrdkFGQmovNERFQXRCNFFFNkFBQkJBQ1RDQVVFQUpNTUJRUUFreEFGQkFDVElBVUVBSk1rQlFRQWt5Z0ZCQUNURkFVRUFKTVlCSS80QkJFQkJoUDRERUF0Qkhqb0FBRUdnUFNUREFRVkJoUDRERUF0QnF3RTZBQUJCek5jQ0pNTUJDMEdIL2dNUUMwSDRBVG9BQUVINEFTVEtBU1A5QVFSQUkvNEJSUVJBUVlUK0F4QUxRUUE2QUFCQkJDVERBUXNMUVFBa3l3RkJBQ1RNQVNQK0FRUkFRWUwrQXhBTFFmd0FPZ0FBUVFBa3pRRUZRWUwrQXhBTFFmNEFPZ0FBUVFFa3pRRUxRUUFremdFai9nRUVRRUh3L2dNUUMwSDRBVG9BQUVIUC9nTVFDMEgrQVRvQUFFSE4vZ01RQzBIK0FEb0FBRUdBL2dNUUMwSFBBVG9BQUVHUC9nTVFDMEhoQVRvQUFFSHMvZ01RQzBIK0FUb0FBRUgxL2dNUUMwR1BBVG9BQUFWQjhQNERFQXRCL3dFNkFBQkJ6LzRERUF0Qi93RTZBQUJCemY0REVBdEIvd0U2QUFCQmdQNERFQXRCendFNkFBQkJqLzRERUF0QjRRRTZBQUFMQzBvQUlBQkJBRW9rTVNBQlFRQktKRElnQWtFQVNpUXpJQU5CQUVva05DQUVRUUJLSkRVZ0JVRUFTaVEySUFaQkFFb2tOeUFIUVFCS0pEZ2dDRUVBU2lRNUlBbEJBRW9rT2hBUkN3VUFJNVVDQzVrQ0FFR3NDaU9sQVRZQ0FFR3dDaU9tQVRZQ0FFRzBDaU9uQVVFQVJ6b0FBRUcxQ2lPb0FVRUFSem9BQUVHMkNpT3BBVUVBUnpvQUFFRzNDaU9xQVVFQVJ6b0FBRUc0Q2lPckFVRUFSem9BQUVHNUNpT3NBVUVBUnpvQUFFRzZDaU90QVVFQVJ6b0FBRUc3Q2lPdUFVRUFSem9BQUVHOENpT3ZBVUVBUnpvQUFFRzlDaU93QVRZQ0FFSENDaU94QVRvQUFFSERDaU95QVRvQUFFSEVDaU9YQVRvQUFFSEZDaU9ZQVRvQUFFSEdDaU9aQVRvQUFFSEhDaU9hQVRvQUFFSElDaU9iQVVFQVJ6b0FBRUhKQ2lPY0FVRUFSem9BQUVIS0NpT2RBVUVBUnpvQUFFSExDaU9lQVVFQVJ6b0FBRUhNQ2lPZkFUb0FBRUhOQ2lPZ0FUb0FBRUhPQ2lPaEFVRUFSem9BQUVIUENpT2lBVUVBUnpvQUFBdnFBUUJCM2dvalNUWUNBRUhpQ2lOS09nQUFRZU1LSTB0QkFFYzZBQUJCNUFvalREb0FBRUhsQ2lOTk9nQUFRZWNLSTA0N0FRQkI2QW9qVHpvQUFFSHBDaU5RUVFCSE9nQUFRZW9LSTFFNkFBQkI2d29qVWpvQUFFSHNDaU5UUVFCSE9nQUFRZTBLSTFRNkFBQkI3Z29qVlVFQVJ6b0FBRUh2Q2lOV1FRQkhPZ0FBUWZBS0kxYzJBZ0JCOUFvaldEWUNBRUg0Q2lOWk5nSUFRZndLSTFwQkFFYzZBQUJCL1Fvald6WUNBRUdCQ3lOY05nSUFRWVVMSTEwNkFBQkJoZ3NqWGpvQUFFR0hDeU5mUVFCSE9nQUFRWWdMSTJBMkFnQkJqQXNqWVRzQkFFR1BDeU5pUVFCSE9nQUFDL2dKQUVHQUNDT0FBam9BQUVHQkNDT0JBam9BQUVHQ0NDT0NBam9BQUVHRENDT0RBam9BQUVHRUNDT0VBam9BQUVHRkNDT0ZBam9BQUVHR0NDT0dBam9BQUVHSENDT0hBam9BQUVHSUNDT0lBanNCQUVHS0NDT0pBanNCQUVHTUNDT0tBallDQUVHUkNDT0xBa0VBUnpvQUFFR1NDQ09NQWtFQVJ6b0FBRUdUQ0NPTkFrRUFSem9BQUVHVUNDT09Ba0VBUnpvQUFFR1ZDQ1A5QVVFQVJ6b0FBRUdXQ0NQK0FVRUFSem9BQUVHWENDUC9BVUVBUnpvQUFFR3lDQ1BwQVRZQ0FFRzJDQ1BxQVRvQUFFRzNDQ1ByQVRvQUFFRzRDQ1BzQVRvQUFFRzVDQ1B0QVRvQUFFRzZDQ1B1QVRvQUFFRzdDQ1BlQVRvQUFFRzhDQ1BmQVRvQUFFRzlDQ1BnQVVFQVJ6b0FBRUcrQ0NQaEFVRUFSem9BQUVHL0NDUGlBVUVBUnpvQUFFSEFDQ1BqQVVFQVJ6b0FBRUhCQ0NQa0FVRUFSem9BQUVIQ0NDUGxBVUVBUnpvQUFFSERDQ1BtQVVFQVJ6b0FBRUhFQ0NQbkFVRUFSem9BQUVIa0NDTzBBVUVBUnpvQUFFSGxDQ08xQVVFQVJ6b0FBRUgwQ0NPMkFUb0FBRUgxQ0NPM0FVRUFSem9BQUVIMkNDTzRBVUVBUnpvQUFFSDNDQ081QVVFQVJ6b0FBRUg0Q0NPNkFVRUFSem9BQUVINUNDTzdBVUVBUnpvQUFFR0VDU084QVRvQUFFR0ZDU085QVVFQVJ6b0FBRUdHQ1NPK0FVRUFSem9BQUVHSENTTy9BVUVBUnpvQUFFR0lDU1BBQVVFQVJ6b0FBRUdKQ1NQQkFVRUFSem9BQUVHV0NTUFhBVFlDQUVHWENTUFlBVUVBUnpvQUFFR1lDU1BaQVVFQVJ6b0FBRUhJQ1NQdkFUc0JBRUhLQ1NQd0FUc0JBRUhNQ1NQeEFVRUFSem9BQUVITkNTUHlBVUVBUnpvQUFFSE9DU1B6QVVFQVJ6b0FBRUhQQ1NQMEFVRUFSem9BQUVIUUNTUDFBVUVBUnpvQUFFSFJDU1AyQVVFQVJ6b0FBRUhTQ1NQM0FVRUFSem9BQUVIVENTUDRBVFlDQUVIWENTUDVBVUVBUnpvQUFFSFlDU1A2QVRZQ0FFSGNDU1A3QVRZQ0FFSGdDU1A4QVRZQ0FFSDZDU1BDQVRZQ0FFSCtDU1BEQVRZQ0FFR0NDaVBFQVRZQ0FFR0dDaVBGQVVFQVJ6b0FBRUdIQ2lQR0FVRUFSem9BQUVHSUNpUEhBVFlDQUVHTUNpUElBVFlDQUVHUUNpUEpBVUVBUnpvQUFFR1JDaVBLQVRZQ0FCQVVFQlZCa0Fzall6WUNBRUdYQ3lOa09nQUFRWmdMSTJVN0FRQkJtZ3NqWmpvQUFFR2JDeU5uUVFCSE9nQUFRWndMSTJnNkFBQkJuUXNqYVRvQUFFR2VDeU5xUVFCSE9nQUFRWjhMSTJzNkFBQkJvQXNqYkVFQVJ6b0FBRUdoQ3lOdFFRQkhPZ0FBUWFJTEkyNDJBZ0JCcGdzamJ6WUNBRUdxQ3lOd05nSUFRYTRMSTNGQkFFYzZBQUJCcndzamNqWUNBRUd6Q3lOek5nSUFRYmNMSTNRNkFBQkJ1QXNqZFRvQUFFSENDeU4yTmdJQVFjb0xJM2M3QVFCQnpBc2plRG9BQUVIT0N5TjVPZ0FBUWM4TEkzcEJBRWM2QUFCQjBBc2plem9BQUVIUkN5TjhRUUJIT2dBQVFkSUxJMzFCQUVjNkFBQkIwd3NqZmpZQ0FFSFhDeU4vTmdJQVFkc0xJNEFCTmdJQVFlTUxJNEVCTmdJQVFlY0xJNElCT2dBQVFlZ0xJNE1CUVFCSE9nQUFRZWtMSTRRQk5nSUFRZlFMSTRVQk5nSUFRZmdMSTRZQk93RUFRZm9MSTRjQk9nQUFRZnNMSTRnQlFRQkhPZ0FBUWZ3TEk0a0JPZ0FBUWYwTEk0b0JPZ0FBUWY0TEk0c0JRUUJIT2dBQVFmOExJNHdCT2dBQVFZRU1JNDBCUVFCSE9nQUFRWU1NSTQ0QlFRQkhPZ0FBUVlRTUk0OEJRUUJIT2dBQVFZa01JNUFCTmdJQVFZME1JNUVCTmdJQVFaRU1JNUlCUVFCSE9nQUFRWklNSTVNQk5nSUFRWllNSTVRQk5nSUFRWm9NSTVZQk93RUFRUUFrbFFJTEJ3QkJBQ1N6QVF1ZUFnQkJyQW9vQWdBa3BRRkJzQW9vQWdBa3BnRkJ0QW90QUFCQkFFc2twd0ZCdFFvdEFBQkJBRXNrcUFGQnRnb3RBQUJCQUVza3FRRkJ0d290QUFCQkFFc2txZ0ZCdUFvdEFBQkJBRXNrcXdGQnVRb3RBQUJCQUVza3JBRkJ1Z290QUFCQkFFc2tyUUZCdXdvdEFBQkJBRXNrcmdGQnZBb3RBQUJCQUVza3J3RkJ2UW9vQWdBa3NBRkJ3Z290QUFBa3NRRkJ3d290QUFBa3NnRkJ4QW90QUFBa2x3RkJ4UW90QUFBa21BRkJ4Z290QUFBa21RRkJ4d290QUFBa21nRkJ5QW90QUFCQkFFc2ttd0ZCeVFvdEFBQkJBRXNrbkFGQnlnb3RBQUJCQUVza25RRkJ5d290QUFCQkFFc2tuZ0ZCekFvdEFBQWtud0ZCelFvdEFBQWtvQUZCemdvdEFBQkJBRXNrb1FGQnp3b3RBQUJCQUVza29nRkJBQ1N6QVF2d0FRQWpTVUV5YkVHQUNHb29BZ0FrU1VIaUNpMEFBQ1JLUWVNS0xRQUFRUUJMSkV0QjVBb3RBQUFrVEVIbENpMEFBQ1JOUWVjS0x3RUFKRTVCNkFvdEFBQWtUMEhwQ2kwQUFFRUFTeVJRUWVvS0xRQUFKRkZCNndvdEFBQWtVa0hzQ2kwQUFFRUFTeVJUUWUwS0xRQUFKRlJCN2dvdEFBQkJBRXNrVlVIdkNpMEFBRUVBU3lSV1FmQUtLQUlBSkZkQjlBb29BZ0FrV0VINENpZ0NBQ1JaUWZ3S0xRQUFRUUJMSkZwQi9Rb29BZ0FrVzBHQkN5Z0NBQ1JjUVlVTExRQUFKRjFCaGdzdEFBQWtYa0dIQ3kwQUFFRUFTeVJmUVlnTExRQUFKR0JCakFzdEFBQWtZVUdQQ3kwQUFFRUFTeVJpQzY4QkFDTmpRVEpzUVlBSWFpZ0NBQ1JqUVpjTExRQUFKR1JCbUFzdkFRQWtaVUdhQ3kwQUFDUm1RWnNMTFFBQVFRQkxKR2RCbkFzdEFBQWthRUdkQ3kwQUFDUnBRWjRMTFFBQVFRQkxKR3BCbndzdEFBQWthMEdnQ3kwQUFFRUFTeVJzUWFFTExRQUFRUUJMSkcxQm9nc29BZ0FrYmtHbUN5Z0NBQ1J2UWFvTEtBSUFKSEJCcmdzdEFBQkJBRXNrY1VHdkN5Z0NBQ1J5UWJNTEtBSUFKSE5CdHdzdEFBQWtkRUc0Q3kwQUFDUjFDNDBKQUVHQUNDMEFBQ1NBQWtHQkNDMEFBQ1NCQWtHQ0NDMEFBQ1NDQWtHRENDMEFBQ1NEQWtHRUNDMEFBQ1NFQWtHRkNDMEFBQ1NGQWtHR0NDMEFBQ1NHQWtHSENDMEFBQ1NIQWtHSUNDOEJBQ1NJQWtHS0NDOEJBQ1NKQWtHTUNDZ0NBQ1NLQWtHUkNDMEFBRUVBU3lTTEFrR1NDQzBBQUVFQVN5U01Ba0dUQ0MwQUFFRUFTeVNOQWtHVUNDMEFBRUVBU3lTT0FrR1ZDQzBBQUVFQVN5VDlBVUdXQ0MwQUFFRUFTeVQrQVVHWENDMEFBRUVBU3lUL0FVR3lDQ2dDQUNUcEFTUHFBVUV5YkVHRUNHb3RBQUFrNmdGQnR3Z3RBQUFrNndGQnVBZ3RBQUFrN0FGQnVRZ3RBQUFrN1FGQnVnZ3RBQUFrN2dGQnV3Z3RBQUFrM2dGQnZBZ3RBQUFrM3dGQnZRZ3RBQUJCQUVzazRBRkJ2Z2d0QUFCQkFFc2s0UUZCdndndEFBQkJBRXNrNGdGQndBZ3RBQUJCQUVzazR3RkJ3UWd0QUFCQkFFc2s1QUZCd2dndEFBQkJBRXNrNVFGQnd3Z3RBQUJCQUVzazVnRkJ4QWd0QUFCQkFFc2s1d0ZCNUFndEFBQkJBRXNrdEFGQjVRZ3RBQUJCQUVza3RRRkI5QWd0QUFBa3RnRkI5UWd0QUFCQkFFc2t0d0ZCOWdndEFBQkJBRXNrdUFGQjl3Z3RBQUJCQUVza3VRRkIrQWd0QUFCQkFFc2t1Z0ZCK1FndEFBQkJBRXNrdXdGQmhBa3RBQUFrdkFGQmhRa3RBQUJCQUVza3ZRRkJoZ2t0QUFCQkFFc2t2Z0ZCaHdrdEFBQkJBRXNrdndGQmlBa3RBQUJCQUVza3dBRkJpUWt0QUFCQkFFc2t3UUZCbGdrb0FnQWsxd0ZCbHdrdEFBQkJBRXNrMkFGQm1Ba3RBQUJCQUVzazJRRkJ5QWt2QVFBazd3RkJ5Z2t2QVFBazhBRkJ6QWt0QUFCQkFFc2s4UUZCelFrdEFBQkJBRXNrOGdGQnpna3RBQUJCQUVzazh3RkJ6d2t0QUFCQkFFc2s5QUZCMEFrdEFBQkJBRXNrOVFGQjBRa3RBQUJCQUVzazlnRkIwZ2t0QUFCQkFFc2s5d0ZCMHdrb0FnQWsrQUZCMXdrdEFBQkJBRXNrK1FGQjJBa29BZ0FrK2dGQjNBa29BZ0FrK3dGQjRBa29BZ0FrL0FGQitna29BZ0Frd2dGQi9na29BZ0Frd3dGQmdnb29BZ0FreEFGQmhnb3RBQUJCQUVza3hRRkJod290QUFCQkFFc2t4Z0ZCaUFvb0FnQWt4d0ZCakFvb0FnQWt5QUZCa0FvdEFBQkJBRXNreVFGQmtRb29BZ0FreWdFUUdCQVpFQm9qZGtFeWJFR0FDR29vQWdBa2RrSEtDeThCQUNSM1Fjd0xMUUFBSkhoQnpnc3RBQUFrZVVIUEN5MEFBRUVBU3lSNlFkQUxMUUFBSkh0QjBRc3RBQUJCQUVza2ZFSFNDeTBBQUVFQVN5UjlRZE1MS0FJQUpINUIxd3NvQWdBa2YwSGJDeWdDQUNTQUFVSGpDeWdDQUNTQkFVSG5DeWdDQUNTQ0FVSG9DeTBBQUVFQVN5U0RBVUhwQ3lnQ0FDU0VBU09GQVVFeWJFR0FDR29vQWdBa2hRRkIrQXN0QUFBa2hnRkIrZ3N0QUFBa2h3RkIrd3N0QUFCQkFFc2tpQUZCL0FzdEFBQWtpUUZCL1FzdEFBQWtpZ0ZCL2dzdEFBQkJBRXNraXdGQi93c3RBQUFrakFGQmdRd3RBQUJCQUVza2pRRkJnd3d0QUFCQkFFc2tqZ0ZCaEF3dEFBQkJBRXNrandGQmlRd29BZ0Fra0FGQmpRd29BZ0Fra1FGQmtRd3RBQUJCQUVza2tnRkJrZ3dvQWdBa2t3RkJsZ3dvQWdBa2xBRkJtZ3d2QVFBa2xnRkJBQ1NWQWtHQXFOYTVCeVNQQWtFQUpKQUNRUUFra1FKQmdLald1UWNra2dKQkFDU1RBa0VBSkpRQ0N3VUFJLzRCQ3dVQUk1SUNDd1VBSTVNQ0N3VUFJNVFDQzU0Q0FRZC9JQUFqU0NJSFJrRUFJQVFqUjBaQkFDQUFRUWhLUVFBZ0FVRUFTaHNiR3dSQUlBTkJBV3NRQ3kwQUFFRWdjVUVBUnlFSUlBTVFDeTBBQUVFZ2NVRUFSeUVKQTBBZ0JrRUlTQVJBSUFCQkJ5QUdheUFHSUFnZ0NVY2JJZ1JxSWdOQm9BRk1CRUFDZnlBRElBRkJvQUZzSWdwcUlndEJBMndpQmtHQXlRVnFJZ01nQXkwQUFEb0FBQ0FHUVlISkJXb2dBeTBBQVRvQUFDQUdRWUxKQldvZ0F5MEFBam9BQUNBTFFZQ1JCR29nQ2lBQVFRQWdCR3RyYWtINGtBUnFMUUFBSWdOQkEzRWlCa0VFY2lBR0lBTkJCSEViT2dBQUlBVkJBV29MSVFVTElBUkJBV29oQmd3QkN3c0ZJQVFrUndzZ0FDQUhUZ1IvSUFCQkNHb2hBU0FBSUFKQkIzRWlBRWdFZnlBQUlBRnFCU0FCQ3dVZ0J3c2tTQ0FGQzYwQkFDQUJFQXN0QUFBZ0FFRUJkSFZCQTNFaEFDQUJRY2orQTBZRVFDTS9JUUVDUUFKQUFrQUNRQ0FBUVFGckRnTUFBUUlEQ3lOQUlRRU1BZ3NqUVNFQkRBRUxJMEloQVFzRklBRkJ5ZjREUmdSQUkwTWhBUUpBQWtBQ1FBSkFJQUJCQVdzT0F3QUJBZ01MSTBRaEFRd0NDeU5GSVFFTUFRc2pSaUVCQ3dVak95RUJBa0FDUUFKQUFrQWdBRUVCYXc0REFBRUNBd3NqUENFQkRBSUxJejBoQVF3QkN5TStJUUVMQ3dzZ0FRdmdBd0VHZnlBQ1FRRnhRUTEwSWc4aERpQU9JQUVpQWtHQWtBSkdCSDhnQUVHQUFXc2dBRUdBQVdvZ0FFR0FBWEViQlNBQUMwRUVkQ0FDYWlBRlFRRjBhaUlBUVlDUWZtcHFMUUFBSVJFZ0R5QUFRWUdRZm1wcUxRQUFJUklnQXlFQUEwQWdBQ0FFVEFSQUlBWWdBQ0FEYTJvaUR5QUlTQVJBQW44Z0VrRUJRUWNnQUdzZ0FFRUJJQXRCSUhGRklBdEJBRWdiR3lJQ2RIRUVmMEVDQlVFQUN5SUJRUUZxSUFFZ0VVRUJJQUowY1JzaEJTUCtBUVIvUVFFZ0RFRUFUaUFMUVFCT0d3VkJBQXNFZnlBTFFRZHhJUUVnREVFQVRpSUNCSDhnREVFSGNRVWdBUXRCQTNRZ0JVRUJkR29pQVVFQmFrRS9jU0lPUVVCcklBNGdBaHRCZ0pBRWFpMEFBRUVJZENBQlFUOXhJZ0ZCUUdzZ0FTQUNHMEdBa0FScUxRQUFjaUlCUVI5eFFRTjBJUTRnQVVIZ0IzRkJCWFpCQTNRaEFpQUJRWUQ0QVhGQkNuWkJBM1FGSUFWQngvNERJQW9nQ2tFQVRCc2lDaEFoSWdGQmdJRDhCM0ZCRUhZaERpQUJRWUQrQTNGQkNIWWhBaUFCUWY4QmNRc2hBU0FKSUE4Z0J5QUliR3BCQTJ4cUloQWdEam9BQUNBUUlBSTZBQUVnRUNBQk9nQUNJQThnQjBHZ0FXeHFRWUNSQkdvZ0JVRURjU0lCUVFSeUlBRWdDMEdBQVhGQkFDQUxRUUJPR3hzNkFBQWdEVUVCYWdzaERRc2dBRUVCYWlFQURBRUxDeUFOQzlJQ0FDQURRUWR4SVFNZ0JTQUZRWUNRQWtZRWZ5QUdRWUFCYXlBR1FZQUJhaUFHUVlBQmNSc0ZJQVlMUVFSMGFpRUZJQVVnQkVHQTBINXFMUUFBSWdSQndBQnhCSDlCQnlBRGF3VWdBd3RCQVhScUlnTkJnSkIrYWlBRVFRaHhRUUJISWdWQkRYUnFMUUFBSVFZZ0FDQUJRYUFCYkdwQkEyeEJnTWtGYWlBRVFRZHhRUU4wSUFOQmdaQithaUFGUVFGeFFRMTBhaTBBQUVFQklBSkJCM0VpQWtFSElBSnJJQVJCSUhFYklnTjBjUVIvUVFJRlFRQUxJZ0pCQVdvZ0FpQUdRUUVnQTNSeEd5SURRUUYwYWlJQ1FRRnFRVDl4UVlDUUJHb3RBQUJCQ0hRZ0FrRS9jVUdBa0FScUxRQUFjaUlDUVI5eFFRTjBPZ0FBSUFBZ0FVR2dBV3hxSWdCQkEyd2lBVUdCeVFWcUlBSkI0QWR4UVFWMlFRTjBPZ0FBSUFGQmdza0ZhaUFDUVlENEFYRkJDblpCQTNRNkFBQWdBRUdBa1FScUlBTkJBM0VpQUVFRWNpQUFJQVJCZ0FGeEd6b0FBQXZMQVFBZ0JDQUVRWUNRQWtZRWZ5QUZRWUFCYXlBRlFZQUJhaUFGUVlBQmNSc0ZJQVVMUVFSMGFpQURRUWR4UVFGMGFpSURRWUNRZm1vdEFBQWhCQ0FBSUFGQm9BRnNhaUlGUVFOc0lnRkJnTWtGYWlBRFFZR1FmbW90QUFCQkFVRUhJQUpCQjNGcklnSjBjUVIvUVFJRlFRQUxJZ0JCQVdvZ0FDQUVRUUVnQW5SeEcwSC9BWEVpQWtISC9nTVFJU0lBUVlDQS9BZHhRUkIyT2dBQUlBRkJnY2tGYWlBQVFZRCtBM0ZCQ0hZNkFBQWdBVUdDeVFWcUlBQTZBQUFnQlVHQWtRUnFJQUpCQTNFNkFBQUx4d0lCQjM4Z0EwRURkU0VMQTBBZ0JFR2dBVWdFUUNBQ0lBdEJCWFJxQW44Z0JDQUZhaUlHUVlBQ1RnUkFJQVpCZ0FKcklRWUxJQVlMUVFOMWFpSUtRWUNRZm1vdEFBQWhDRUVBSVFjak9RUkFJQVFnQUNBR0lBb2dDQkFnSWdsQkFFb0VRQUovUVFFaEJ5QUVJQWxCQVd0cUN5RUVDd3NnQjBWQkFDTTRHd1JBUVFBaENTQURRUWR4SVFkQkFDQUdJQVpCQTNWQkEzUnJJQVFiSVF4QmZ5RUdJLzRCQkVBQ2Z5QUtRWURRZm1vdEFBQWlCa0VJY1VFQVJ5RUpRUWNnQjJzZ0J5QUdRY0FBY1JzTElRY0xJQVFnQ0NBQklBa2dERUdnQVNBRWEwRUhJQVJCQ0dwQm9BRktHeUFISUFRZ0FFR2dBVUdBeVFWQkFDQUdRWDhRSWlJR1FRRnJhaUFFSUFaQkFFb2JJUVFGSUFkRkJFQWovZ0VFUUNBRUlBQWdCaUFESUFvZ0FTQUlFQ01GSUFRZ0FDQUdJQU1nQVNBSUVDUUxDd3NnQkVFQmFpRUVEQUVMQ3d1VkJRRVBmMEVuSVFjRFFDQUhRUUJPQkVBZ0IwRUNkQ0lGUVlEOEEyb2lBaEFMTFFBQUlRTWdBa0VCYWhBTExRQUFJUVlnQWtFQ2FoQUxMUUFBSVFRZ0JrRUlheUVLSUFBZ0EwRVFheUlESUFFRWZ5QUVJQVJCQVhGcklRUkJFQVZCQ0FzaUFtcElRUUFnQUNBRFRoc0VRQ0FGUVlQOEEyb1FDeTBBQUNJR1FZQUJjVUVBUnlFTElBWkJJSEZCQUVjaERDQUdRUWh4UVFCSEkvNEJJZ1VnQlJ0QkFYRkJEWFFpQlNBRVFRUjBRWUNBQW1vZ0FpQUFJQU5ySWdKclFRRnJJQUlnQmtIQUFIRWJRUUYwYWlJQ1FZQ1FmbXBxTFFBQUlRMGdCU0FDUVlHUWZtcHFMUUFBSVE1QkJ5RUVBMEFnQkVFQVRnUkFJQTVCQVVFQUlBUkJCMnRySUFRZ0RCc2lBM1J4Qkg5QkFnVkJBQXNpQWtFQmFpQUNJQTFCQVNBRGRIRWJJZ01FUUNBS1FRY2dCR3RxSWdKQm9BRk1RUUFnQWtFQVRoc0VRRUVBSVFWQkFDRUlJK2NCUlNQK0FTSUpJQWtiSWdsRkJFQWdBaUFBUWFBQmJHcEJnSkVFYWkwQUFDSVBRUU54SWhCQkFFdEJBQ0FMR3dSQVFRRWhCUVVnRUVFQVMwRUFJQTlCQkhGQkFDUCtBUnNiUlVVaENBc0xRUUZCQUNBSVJTQUZHeUFKR3dSQUkvNEJCRUFnQWlBQVFhQUJiR3BCQTJ3aUFrR0F5UVZxSUFaQkIzRkJBM1FnQTBFQmRHb2lBMEVCYWtFL2NVSEFrQVJxTFFBQVFRaDBJQU5CUDNGQndKQUVhaTBBQUhJaUEwRWZjVUVEZERvQUFDQUNRWUhKQldvZ0EwSGdCM0ZCQlhaQkEzUTZBQUFnQWtHQ3lRVnFJQU5CZ1BnQmNVRUtka0VEZERvQUFBVWdBaUFBUWFBQmJHcEJBMndpQWtHQXlRVnFJQU5CeWY0RFFjaitBeUFHUVJCeEd4QWhJZ05CZ0lEOEIzRkJFSFk2QUFBZ0FrR0J5UVZxSUFOQmdQNERjVUVJZGpvQUFDQUNRWUxKQldvZ0F6b0FBQXNMQ3dzZ0JFRUJheUVFREFFTEN3c2dCMEVCYXlFSERBRUxDd3VCQVFFQ2YwR0FnQUpCZ0pBQ0krTUJHeUVCUVFFajV3RWovZ0ViQkVBZ0FDQUJRWUM0QWtHQXNBSWo1QUViSUFBajdBRnFRZjhCY1VFQUkrc0JFQ1VMSStJQkJFQWdBQ1B1QVNJQ1RnUkFJQUFnQVVHQXVBSkJnTEFDSStFQkd5QUFJQUpySSswQlFRZHJJZ0ZCQUNBQmF4QWxDd3NqNWdFRVFDQUFJK1VCRUNZTEN5RUFRWS8rQXhBTExRQUFRUUVnQUhSeUlnQWt2QUZCai80REVBc2dBRG9BQUF2cUFRRURmeU5mUlVFQkkxVWJCRUFQQ3lOZ1FRRnJJZ0JCQUV3RVFDTktCRUFqU2lSZ0FuOGpZU0lCSTB4MUlRQkJBU05MQkg5QkFTUmlJQUVnQUdzRklBQWdBV29MSWdCQi93OUtEUUFhUVFBTEJFQkJBQ1JWQ3lOTVFRQktCRUFnQUNSaElBQkJDSFZCQjNFaUFrR1UvZ01RQ3kwQUFFSDRBWEZ5SVFGQmsvNERFQXNnQUVIL0FYRWlBRG9BQUVHVS9nTVFDeUFCT2dBQUlBQWtVaUFDSkZRalVpTlVRUWgwY2lSWEFuOGpZU0lCSTB4MUlRQkJBU05MQkg5QkFTUmlJQUVnQUdzRklBQWdBV29MUWY4UFNnMEFHa0VBQ3dSQVFRQWtWUXNMQlVFSUpHQUxCU0FBSkdBTEM4RUhBUUovSUFBanNBRnFJZ0JCZ01BQUkvOEJkQ0lDVGdSQUlBQWdBbXNrc0FFQ1FBSkFBa0FDUUFKQUFrQWpzUUZCQVdwQkIzRWlBZzRJQUFVQkJRSUZBd1FGQ3lOVFFRQWpXeUlBUVFCS0d3UkFJQUJCQVdzaUFFVUVRRUVBSkZVTEN5QUFKRnNDZnlOcVFRQWpjaUlBUVFCS0d3UkFJQUJCQVdzaEFBc2dBQXRGQkVCQkFDUnNDeUFBSkhJQ2Z5TjZRUUFqZ0FFaUFFRUFTaHNFUUNBQVFRRnJJUUFMSUFBTFJRUkFRUUFrZkFzZ0FDU0FBUUovSTQwQlFRQWprd0VpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtqZ0VMSUFBa2t3RU1CQXNqVTBFQUkxc2lBRUVBU2hzRVFDQUFRUUZySWdCRkJFQkJBQ1JWQ3dzZ0FDUmJBbjhqYWtFQUkzSWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2JBc2dBQ1J5QW44amVrRUFJNEFCSWdCQkFFb2JCRUFnQUVFQmF5RUFDeUFBQzBVRVFFRUFKSHdMSUFBa2dBRUNmeU9OQVVFQUk1TUJJZ0JCQUVvYkJFQWdBRUVCYXlFQUN5QUFDMFVFUUVFQUpJNEJDeUFBSkpNQkVDa01Bd3NqVTBFQUkxc2lBRUVBU2hzRVFDQUFRUUZySWdCRkJFQkJBQ1JWQ3dzZ0FDUmJBbjhqYWtFQUkzSWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2JBc2dBQ1J5QW44amVrRUFJNEFCSWdCQkFFb2JCRUFnQUVFQmF5RUFDeUFBQzBVRVFFRUFKSHdMSUFBa2dBRUNmeU9OQVVFQUk1TUJJZ0JCQUVvYkJFQWdBRUVCYXlFQUN5QUFDMFVFUUVFQUpJNEJDeUFBSkpNQkRBSUxJMU5CQUNOYklnQkJBRW9iQkVBZ0FFRUJheUlBUlFSQVFRQWtWUXNMSUFBa1d3Si9JMnBCQUNOeUlnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkd3TElBQWtjZ0ovSTNwQkFDT0FBU0lBUVFCS0d3UkFJQUJCQVdzaEFBc2dBQXRGQkVCQkFDUjhDeUFBSklBQkFuOGpqUUZCQUNPVEFTSUFRUUJLR3dSQUlBQkJBV3NoQUFzZ0FBdEZCRUJCQUNTT0FRc2dBQ1NUQVJBcERBRUxJMWxCQVdzaUFFRUFUQVJBSTFFRVFDTmFRUUFqVVNJQUd3UkFJMXdpQVVFQmFpQUJRUUZySTFBYlFROXhJZ0ZCRDBrRVFDQUJKRndGUVFBa1dnc0xCVUVJSVFBTEN5QUFKRmtqY0VFQmF5SUFRUUJNQkVBamFBUkFJM0ZCQUNOb0lnQWJCRUFqY3lJQlFRRnFJQUZCQVdzalp4dEJEM0VpQVVFUFNRUkFJQUVrY3dWQkFDUnhDd3NGUVFnaEFBc0xJQUFrY0NPUkFVRUJheUlBUVFCTUJFQWppUUVFUUNPU0FVRUFJNGtCSWdBYkJFQWpsQUVpQVVFQmFpQUJRUUZySTRnQkcwRVBjU0lCUVE5SkJFQWdBU1NVQVFWQkFDU1NBUXNMQlVFSUlRQUxDeUFBSkpFQkN5QUNKTEVCUVFFUEJTQUFKTEFCQzBFQUM4RUJBUUYvSTFnZ0FHc2hBQU5BSUFCQkFFd0VRRUdBRUNOWGEwRUNkQ0lCUVFKMElBRWovd0ViSkZnaldDQUFRUjkxSWdFZ0FDQUJhbk5ySVFBalhrRUJha0VIY1NSZURBRUxDeUFBSkZnalZrRUFJMVViQkg4alhFRVBjUVZCRHc4TElRQUNmeU5lSVFFQ1FBSkFBa0FDUUNOTlFRRnJEZ01BQVFJREMwRUJJQUYwUVlFQmNVRUFSd3dEQzBFQklBRjBRWWNCY1VFQVJ3d0NDMEVCSUFGMFFmNEFjVUVBUnd3QkMwRUJJQUYwUVFGeEN3Ui9RUUVGUVg4TElBQnNRUTlxQzdvQkFRRi9JMjhnQUdzaEFBTkFJQUJCQUV3RVFFR0FFQ051YTBFQ2RDUC9BWFFrYnlOdklBQkJIM1VpQVNBQUlBRnFjMnNoQUNOMVFRRnFRUWR4SkhVTUFRc0xJQUFrYnlOdFFRQWpiQnNFZnlOelFROXhCVUVQRHdzaEFBSi9JM1VoQVFKQUFrQUNRQUpBSTJSQkFXc09Bd0FCQWdNTFFRRWdBWFJCZ1FGeFFRQkhEQU1MUVFFZ0FYUkJod0Z4UVFCSERBSUxRUUVnQVhSQi9nQnhRUUJIREFFTFFRRWdBWFJCQVhFTEJIOUJBUVZCZndzZ0FHeEJEMm9MaUFJQkEzOGpmVVZCQVNOOEd3UkFRUThQQ3lPQ0FTRURJNE1CQkVCQm5QNERFQXN0QUFCQkJYWWlBeVNDQVVFQUpJTUJDeU9FQVNPQkFVRUJjVVZCQW5SMVFROXhJUUlDUUFKQUFrQUNRQUpBSUFNT0F3QUJBZ01MSUFKQkJIVWhBZ3dEQzBFQklRRU1BZ3NnQWtFQmRTRUNRUUloQVF3QkN5QUNRUUoxSVFKQkJDRUJDeUFCUVFCTEJIOGdBaUFCYlFWQkFBdEJEMm9oQWlOL0lBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBamZtdEJBWFFqL3dGMEpIOGpmeUFBUVI5MUlnRWdBQ0FCYW5OcklRQWpnUUZCQVdvaEFRTkFJQUZCSUU0RVFDQUJRU0JySVFFTUFRc0xJQUVrZ1FFamdRRkJBWFZCc1A0RGFoQUxMUUFBSklRQkRBRUxDeUFBSkg4Z0FndVBBUUVDZnlPUUFTQUFheUlBUVFCTUJFQWpsUUVqaWdGMEkvOEJkQ0FBUVI5MUlnRWdBQ0FCYW5OcklRQWpsZ0VpQVVFQmRTSUNJQUZCQVhFZ0FrRUJjWE1pQVVFT2RISWlBa0cvZjNFZ0FVRUdkSElnQWlPTEFSc2tsZ0VMUVFBZ0FDQUFRUUJJR3lTUUFTT1BBVUVBSTQ0Qkd3Ui9JNVFCUVE5eEJVRVBEd3RCZjBFQkk1WUJRUUZ4RzJ4QkQyb0w1UUVCQVg5QkFDU2hBU0FBUVE4anF3RWJJQUZCRHlPc0FSdHFJQUpCRHlPdEFSdHFJQU5CRHlPdUFSdHFJUVJCQUNTaUFVRUFKS01CQW45Qi93QWdBRUVQSTZjQkd5QUJRUThqcUFFYmFpQUNRUThqcVFFYmFpQURRUThqcWdFYmFpSUFRVHhHRFFBYUk2VUJRUUZxSUFCQlBHdEJvSTBHYkd4QkEzVkJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMExJUUlDZnlPbUFVRUJhaUVCUWY4QUlBUkJQRVlOQUJvZ0FTQUVRVHhyUWFDTkJteHNRUU4xUWFDTkJtMUJQR3BCb0kwR2JFR004UUp0Q3lFQUlBSWtud0VnQUNTZ0FTQUFRZjhCY1NBQ1FmOEJjVUVJZEhJTG5BTUJCWDhnQUNOSmFpSUJKRWtqV0NBQmEwRUFUQ0lCUlFSQUkxWWlBaU9iQVVjaEFTQUNKSnNCQ3lBQUkyTnFJZ0lrWXlOdklBSnJRUUJNSWdKRkJFQWpiU0lFSTV3QlJ5RUNJQVFrbkFFTElBQWpkbW9rZGtFQUkzOGpkbXRCQUVvamd3RWJSU0lFUlFSQUkzMGlCU09kQVVjaEJDQUZKSjBCQ3lBQUk0VUJhaVNGQVNPUUFTT0ZBV3RCQUV3aUJVVUVRQ09QQVNJREk1NEJSeUVGSUFNa25nRUxJQUVFUUNOSklRTkJBQ1JKSUFNUUt5U1hBUXNnQWdSQUkyTWhBMEVBSkdNZ0F4QXNKSmdCQ3lBRUJFQWpkaUVEUVFBa2RpQURFQzBrbVFFTElBVUVRQ09GQVNFRFFRQWtoUUVnQXhBdUpKb0JDMEVCSUFWQkFTQUVRUUVnQWlBQkd4c2JCRUJCQVNTakFRc2dBQ095QVdvaUFFR0FnSUFDSS84QmRFSEUyQUp0SWdGT0JFQWdBQ0FCYXlFQVFRRWpvZ0ZCQVNPaEFTT2pBUnNiQkVBamx3RWptQUVqbVFFam1nRVFMeG9GSUFBa3NnRUxJN01CSWdGQkFYUkJnSm5CQUdvaUFpT2ZBVUVDYWpvQUFDQUNJNkFCUVFKcU9nQUJJQUZCQVdvaUFVSC8vd05PQkg4Z0FVRUJhd1VnQVFza3N3RUxJQUFrc2dFTGxnTUJCbjhnQUJBcklRRWdBQkFzSVFJZ0FCQXRJUVFnQUJBdUlRVWdBU1NYQVNBQ0pKZ0JJQVFrbVFFZ0JTU2FBU0FBSTdJQmFpSUFRWUNBZ0FJai93RjBRY1RZQW0xT0JFQWdBRUdBZ0lBQ0kvOEJkRUhFMkFKdGF5RUFJQUVnQWlBRUlBVVFMeUVESTdNQlFRRjBRWUNad1FCcUlnWWdBMEdBL2dOeFFRaDJRUUpxT2dBQUlBWWdBMEgvQVhGQkFtbzZBQUVqT2dSQUlBRkJEMEVQUVE4UUx5RUJJN01CUVFGMFFZQ1pJV29pQXlBQlFZRCtBM0ZCQ0haQkFtbzZBQUFnQXlBQlFmOEJjVUVDYWpvQUFVRVBJQUpCRDBFUEVDOGhBU096QVVFQmRFR0FtU2xxSWdJZ0FVR0EvZ054UVFoMlFRSnFPZ0FBSUFJZ0FVSC9BWEZCQW1vNkFBRkJEMEVQSUFSQkR4QXZJUUVqc3dGQkFYUkJnSmt4YWlJQ0lBRkJnUDREY1VFSWRrRUNham9BQUNBQ0lBRkIvd0Z4UVFKcU9nQUJRUTlCRDBFUElBVVFMeUVCSTdNQlFRRjBRWUNaT1dvaUFpQUJRWUQrQTNGQkNIWkJBbW82QUFBZ0FpQUJRZjhCY1VFQ2Fqb0FBUXNqc3dGQkFXb2lBVUgvL3dOT0JIOGdBVUVCYXdVZ0FRc2tzd0VMSUFBa3NnRUxRUUVDZjBIWEFDUC9BWFFoQUNPa0FTRUJBMEFnQVNBQVRnUkFJQUFRS2tWQkFDTTNHd1JBSUFBUU1BVWdBQkF4Q3lBQklBQnJJUUVNQVFzTElBRWtwQUVMeWdNQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RGF3NFhBQVVLRHhNQkJnc1FGQUlIREJFVkF3Z05FaFlFQ1E0WEMwR1EvZ01RQ3kwQUFFR0FBWElQQzBHVi9nTVFDeTBBQUVIL0FYSVBDMEdhL2dNUUN5MEFBRUgvQUhJUEMwR2YvZ01RQ3kwQUFFSC9BWElQQzBHay9nTVFDeTBBQUE4TFFaSCtBeEFMTFFBQVFUOXlEd3RCbHY0REVBc3RBQUJCUDNJUEMwR2IvZ01RQ3kwQUFFSC9BWElQQzBHZy9nTVFDeTBBQUVIL0FYSVBDMEdsL2dNUUN5MEFBQThMUVpMK0F4QUxMUUFBRHd0QmwvNERFQXN0QUFBUEMwR2MvZ01RQ3kwQUFFR2ZBWElQQzBHaC9nTVFDeTBBQUE4TFFZQUJRUUFqcndFYklnQkJBWElnQUVGK2NTTlZHeUlBUVFKeUlBQkJmWEVqYkJzaUFFRUVjaUFBUVh0eEkzd2JJZ0JCQ0hJZ0FFRjNjU09PQVJ0QjhBQnlEd3RCay80REVBc3RBQUJCL3dGeUR3dEJtUDRERUFzdEFBQkIvd0Z5RHd0Qm5mNERFQXN0QUFCQi93RnlEd3RCb3Y0REVBc3RBQUFQQzBHVS9nTVFDeTBBQUVHL0FYSVBDMEdaL2dNUUN5MEFBRUcvQVhJUEMwR2UvZ01RQ3kwQUFFRy9BWElQQzBHai9nTVFDeTBBQUVHL0FYSVBDMEYvQzQwQkFRRi9JOWNCSVFBajJBRUVmeUFBUVh0eElBQkJCSElqendFYklnQkJmbkVnQUVFQmNpUFNBUnNpQUVGM2NTQUFRUWh5STlBQkd5SUFRWDF4SUFCQkFuSWowUUViQlNQWkFRUi9JQUJCZm5FZ0FFRUJjaVBUQVJzaUFFRjljU0FBUVFKeUk5UUJHeUlBUVh0eElBQkJCSElqMVFFYklnQkJkM0VnQUVFSWNpUFdBUnNGSUFBTEMwSHdBWElMOUFJQkFYOGdBRUdBZ0FKSUJFQkJmdzhMSUFCQmdNQUNTRUVBSUFCQmdJQUNUaHNFUUVGL0R3c2dBRUdBL0FOSVFRQWdBRUdBd0FOT0d3UkFJQUJCZ0VCcUVBc3RBQUFQQ3lBQVFaLzlBMHhCQUNBQVFZRDhBMDRiQkVCQi93RkJmeVBlQVVFQ1NCc1BDeUFBUWMzK0EwWUVRRUhOL2dNUUN5MEFBRUVCY1FSL1FmOEJCVUgrQVFzaUFDQUFRZjkrY1NQL0FSc1BDeUFBUWNUK0EwWUVRQ1BxQVNFQklBQVFDeUFCT2dBQUkrb0JEd3NnQUVHbS9nTk1RUUFnQUVHUS9nTk9Hd1JBRURJZ0FCQXpEd3NnQUVHdi9nTk1RUUFnQUVHbi9nTk9Hd1JBUWY4QkR3c2dBRUcvL2dOTVFRQWdBRUd3L2dOT0d3UkFFRElqZkFSQUk0RUJRUUYxUWJEK0Eyb1FDeTBBQUE4TFFYOFBDeUFBUVlUK0EwWUVRQ1BEQVVHQS9nTnhRUWgySVFFZ0FCQUxJQUU2QUFBZ0FROExJQUJCaGY0RFJnUkFJOFFCSVFFZ0FCQUxJQUU2QUFBanhBRVBDeUFBUVkvK0EwWUVRQ084QVVIZ0FYSVBDeUFBUVlEK0EwWUVRQkEwRHd0QmZ3c3NBUUYvSUFBajJ3RkdCRUJCQVNUZEFRc2dBQkExSWdGQmYwWUVmeUFBRUFzdEFBQUZJQUZCL3dGeEN3dWFBZ0VDZnlQekFRUkFEd3NqOUFFaEF5UDFBU0VDSUFCQi96OU1CRUFnQVVFUWNVVkJBQ0FDRzBVRVFDQUJRUTl4SWdBRVFDQUFRUXBHQkVCQkFTVHhBUXNGUVFBazhRRUxDd1VnQUVILy93Qk1CRUFnQUVILzN3Qk1RUUVqOXdFaUFCc0VRQ0FCUVE5eEkrOEJJQUliSVFJZ0F3Ui9JQUZCSDNFaEFTQUNRZUFCY1FVajlnRUVmeUFCUWY4QWNTRUJJQUpCZ0FGeEJVRUFJQUlnQUJzTEN5QUJjaVR2QVFVajd3RkIvd0Z4SUFGQkFFcEJDSFJ5Sk84QkN3VkJBQ0FBUWYrL0FVd2dBaHNFUUNQeUFVRUFJQU1iQkVBajd3RkJIM0VnQVVIZ0FYRnlKTzhCRHdzZ0FVRVBjU0FCUVFOeEkvY0JHeVR3QVFWQkFDQUFRZi8vQVV3Z0Foc0VRQ0FEQkVBZ0FVRUJjVUVBUnlUeUFRc0xDd3NMQzZvQkFRSi9RUUVrVlNOYlJRUkFRY0FBSkZzTFFZQVFJMWRyUVFKMElnQkJBblFnQUNQL0FSc2tXQ05SQkVBalVTUlpCVUVJSkZrTFFRRWtXaU5QSkZ3alZ5UmhJMG9FUUNOS0pHQUZRUWdrWUF0QkFTTk1RUUJLSWdBalNrRUFTaHNrWDBFQUpHSWdBQVIvQW44allTSUFJMHgxSVFGQkFTTkxCSDlCQVNSaUlBQWdBV3NGSUFBZ0FXb0xRZjhQU2cwQUdrRUFDd1ZCQUFzRVFFRUFKRlVMSTFaRkJFQkJBQ1JWQ3d1TkFRRUNmeUFBUVFkeElnRWtWQ05TSUFGQkNIUnlKRmNqVTBVaUFRUkFJQUJCd0FCeFFRQkhJUUVMSTdFQlFRRnhJZ0pGQkVBZ0FVRUFJMXRCQUVvYkJFQWpXMEVCYXlSYlFRQWpXMFVnQUVHQUFYRWJCRUJCQUNSVkN3c0xJQUJCd0FCeFFRQkhKRk1nQUVHQUFYRUVRQkE0STFOQkFFRUFJMXRCd0FCR0lBSWJHd1JBSTF0QkFXc2tXd3NMQzhzQkFRSi9JQUJCQjNFaUFpUnJJMmtnQWtFSWRISWtiaU94QVVFQmNTRUNJMnBGSWdFRVFDQUFRY0FBY1VFQVJ5RUJDeUFDUlFSQUlBRkJBQ055UVFCS0d3UkFJM0pCQVdza2NrRUFJM0pGSUFCQmdBRnhHd1JBUVFBa2JBc0xDeUFBUWNBQWNVRUFSeVJxSUFCQmdBRnhCRUJCQVNSc0kzSkZCRUJCd0FBa2NndEJnQkFqYm10QkFuUWovd0YwSkc4amFBUkFJMmdrY0FWQkNDUndDMEVCSkhFalppUnpJMjFGQkVCQkFDUnNDeU5xUVFCQkFDTnlRY0FBUmlBQ0d4c0VRQ055UVFGckpISUxDd3UrQVFFQmZ5QUFRUWR4SWdFa2V5TjVJQUZCQ0hSeUpINGpzUUZCQVhFaUFVVUVRRUVBSUFCQndBQnhJM29iUVFBamdBRkJBRW9iQkVBamdBRkJBV3NrZ0FGQkFDT0FBVVVnQUVHQUFYRWJCRUJCQUNSOEN3c0xJQUJCd0FCeFFRQkhKSG9nQUVHQUFYRUVRRUVCSkh3amdBRkZCRUJCZ0FJa2dBRUxRWUFRSTM1clFRRjBJLzhCZENSL0kzOUJCbW9rZjBFQUpJRUJJMzFGQkVCQkFDUjhDeU42UVFCQkFDT0FBVUdBQWtZZ0FSc2JCRUFqZ0FGQkFXc2tnQUVMQ3d2VEFRRUNmeU9OQVVVaUFRUkFJQUJCd0FCeFFRQkhJUUVMSTdFQlFRRnhJZ0pGQkVBZ0FVRUFJNU1CUVFCS0d3UkFJNU1CUVFGckpKTUJRUUFqa3dGRklBQkJnQUZ4R3dSQVFRQWtqZ0VMQ3dzZ0FFSEFBSEZCQUVja2pRRWdBRUdBQVhFRVFFRUJKSTRCSTVNQlJRUkFRY0FBSkpNQkN5T1ZBU09LQVhRai93RjBKSkFCSTRrQkJFQWppUUVra1FFRlFRZ2trUUVMUVFFa2tnRWpod0VrbEFGQi8vOEJKSllCSTQ4QlJRUkFRUUFramdFTEk0MEJRUUJCQUNPVEFVSEFBRVlnQWhzYkJFQWprd0ZCQVdza2t3RUxDd3ZYQndBanJ3RkZRUUFnQUVHbS9nTkhHd1JBUVFBUEN3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJrUDREYXc0WEFBSUdDZzRWQXdjTER3RUVDQXdRRlFVSkRSRVNFeFFWQ3lOTElRQWdBVUh3QUhGQkJIWWtTaUFCUVFoeFFRQkhKRXNnQVVFSGNTUk1JMkpCQUNOTFJVRUFJQUFiR3dSQVFRQWtWUXNNRkF0QkFDQUJRWUFCY1VFQVJ5SUFJMzBiQkVCQkFDU0VBUXNnQUNSOUlBQkZCRUFnQUNSOEN3d1RDeUFCUVFaMVFRTnhKRTBnQVVFL2NTUk9RY0FBSTA1ckpGc01FZ3NnQVVFR2RVRURjU1JrSUFGQlAzRWtaVUhBQUNObGF5UnlEQkVMSUFFa2QwR0FBaU4zYXlTQUFRd1FDeUFCUVQ5eEpJWUJRY0FBSTRZQmF5U1RBUXdQQ3lOVkJFQkJBQ05hSTFFYkJFQWpYRUVCYWtFUGNTUmNDeU5RSUFGQkNIRkJBRWRIQkVCQkVDTmNhMEVQY1NSY0N3c2dBVUVFZFVFUGNTUlBJQUZCQ0hGQkFFY2tVQ0FCUVFkeEpGRWdBVUg0QVhGQkFFc2lBQ1JXSUFCRkJFQkJBQ1JWQ3d3T0N5TnNCRUJCQUNOeEkyZ2JCRUFqYzBFQmFrRVBjU1J6Q3lObklBRkJDSEZCQUVkSEJFQkJFQ056YTBFUGNTUnpDd3NnQVVFRWRVRVBjU1JtSUFGQkNIRkJBRWNrWnlBQlFRZHhKR2dnQVVINEFYRkJBRXNpQUNSdElBQkZCRUFnQUNSc0N3d05DMEVCSklNQklBRkJCWFZCRDNFa2VBd01DeU9PQVFSQVFRQWprZ0VqaVFFYkJFQWpsQUZCQVdwQkQzRWtsQUVMSTRnQklBRkJDSEZCQUVkSEJFQkJFQ09VQVd0QkQzRWtsQUVMQ3lBQlFRUjFRUTl4SkljQklBRkJDSEZCQUVja2lBRWdBVUVIY1NTSkFTQUJRZmdCY1VFQVN5SUFKSThCSUFCRkJFQWdBQ1NPQVFzTUN3c2dBU1JTSUFFalZFRUlkSElrVnd3S0N5QUJKR2tnQVNOclFRaDBjaVJ1REFrTElBRWtlU0FCSTN0QkNIUnlKSDRNQ0FzZ0FVRUVkU1NLQVNBQlFRaHhRUUJISklzQklBRkJCM0VpQUNTTUFTQUFRUUYwSWdCQkFVZ0VmMEVCQlNBQUMwRURkQ1NWQVF3SEN5QUJFRGtNQmdzZ0FSQTZEQVVMSUFFUU93d0VDeUFCRUR3TUF3c2dBVUVFZFVFSGNTU2xBU0FCUVFkeEpLWUJRUUVrb1FFTUFnc2dBVUdBQVhGQkFFY2txZ0VnQVVIQUFIRkJBRWNrcVFFZ0FVRWdjVUVBUnlTb0FTQUJRUkJ4UVFCSEpLY0JJQUZCQ0hGQkFFY2tyZ0VnQVVFRWNVRUFSeVN0QVNBQlFRSnhRUUJISkt3QklBRkJBWEZCQUVja3F3RkJBU1NpQVF3QkN5T3ZBU0lBQkg5QkFBVWdBVUdBQVhFTEJFQkJCeVN4QVVFQUpGNUJBQ1IxQ3lBQlFZQUJjVVZCQUNBQUd3UkFRWkQrQXlFQUEwQWdBRUdtL2dOSUJFQWdBRUVBRUVNZ0FFRUJhaUVBREFFTEN3c2dBVUdBQVhGQkFFY2tyd0VMUVFFTFh3RUNmMEVBSk9rQlFRQWs2Z0ZCeFA0REVBdEJBRG9BQUVIQi9nTVFDeTBBQUVGOGNTRUNRUUFrM2dGQndmNERFQXNnQWpvQUFDQUFCRUFEUUNBQlFZRFlCVWdFUUNBQlFZREpCV3BCL3dFNkFBQWdBVUVCYWlFQkRBRUxDd3NMeVFFQkEzOGovZ0ZGQkVBUEN5QUFRWUFCY1VWQkFDUDVBUnNFUUVFQUpQa0JRZFgrQXhBTExRQUFRWUFCY2lFQVFkWCtBeEFMSUFBNkFBQVBDMEhSL2dNUUN5MEFBRUVJZEVIUy9nTVFDeTBBQUhKQjhQOERjU0VCUWRQK0F4QUxMUUFBUVFoMFFkVCtBeEFMTFFBQWNrSHdQM0ZCZ0lBQ2FpRUNJQUJCLzM1eFFRRnFRUVIwSVFNZ0FFR0FBWEVFUUVFQkpQa0JJQU1rK2dFZ0FTVDdBU0FDSlB3QlFkWCtBeEFMSUFCQi8zNXhPZ0FBQlNBQklBSWdBeEJFUWRYK0F4QUxRZjhCT2dBQUN3dkRBUUVFZndOQUlBSWdBRWdFUUNBQ1FRUnFJUUlqd3dFaUFVRUVha0gvL3dOeElnTWt3d0VqeVFFRVFDUEdBU0VFSThVQkJFQWp5QUVreEFGQkFTUy9BVUVDRUNoQkFDVEZBVUVCSk1ZQkJTQUVCRUJCQUNUR0FRc0xJQUZCQVFKL0FrQUNRQUpBQWtBQ1FDUEtBUTRFQUFFQ0F3UUxRUWtNQkF0QkF3d0RDMEVGREFJTFFRY01BUXRCQUFzaUFYUnhCSDhnQTBFQklBRjBjVVVGUVFBTEJFQWp4QUZCQVdvaUFVSC9BVW9FZjBFQkpNVUJRUUFGSUFFTEpNUUJDd3NNQVFzTEM4c0JBUU4vSThrQklRRWdBRUVFY1VFQVJ5VEpBU0FBUVFOeElRTWdBVVVFUUFKL0FrQUNRQUpBQWtBQ1FDUEtBUTRFQUFFQ0F3UUxRUWtNQkF0QkF3d0RDMEVGREFJTFFRY01BUXRCQUFzaEFRSi9Ba0FDUUFKQUFrQUNRQ0FERGdRQUFRSURCQXRCQ1F3RUMwRUREQU1MUVFVTUFndEJCd3dCQzBFQUN5RUFJOE1CSVFJanlRRUVmeUFDUVFFZ0FYUnhCU0FDUVFFZ0FIUnhRUUFnQWtFQklBRjBjUnNMQkVBanhBRkJBV29pQUVIL0FVb0VmMEVCSk1VQlFRQUZJQUFMSk1RQkN3c2dBeVRLQVF1NkNnRURmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERFQXNnQVVFQmNUb0FBQXdCQ3lBQVFkRCtBMFpCQUNQOUFSc0VRRUVBSlAwQlFmOEJKSWtDREFJTElBQkJnSUFDU0FSQUlBQWdBUkEzREFFTElBQkJnTUFDU0VFQUlBQkJnSUFDVGhzTkFTQUFRWUQ4QTBoQkFDQUFRWURBQTA0YkJFQWdBRUdBUUdvUUN5QUJPZ0FBREFJTElBQkJuLzBEVEVFQUlBQkJnUHdEVGhzRVFDUGVBVUVDVGc4TElBQkIvLzBEVEVFQUlBQkJvUDBEVGhzTkFDQUFRWUwrQTBZRVFDQUJRUUp4UVFCSEpNMEJJQUZCZ0FGeFFRQkhKTTRCUVFFUEN5QUFRYWIrQTB4QkFDQUFRWkQrQTA0YkJFQVFNaUFBSUFFUVBROExJQUJCdi80RFRFRUFJQUJCc1A0RFRoc0VRQkF5STN3RVFDT0JBVUVCZFVHdy9nTnFFQXNnQVRvQUFBd0NDd3dDQ3lBQVFjditBMHhCQUNBQVFjRCtBMDRiQkVBZ0FFSEEvZ05HQkVBajRBRWhBQ0FCUVlBQmNVRUFSeVRnQVNBQlFjQUFjVUVBUnlUaEFTQUJRU0J4UVFCSEpPSUJJQUZCRUhGQkFFY2s0d0VnQVVFSWNVRUFSeVRrQVNBQlFRUnhRUUJISk9VQklBRkJBbkZCQUVjazVnRWdBVUVCY1VFQVJ5VG5BU1BnQVVWQkFDQUFHd1JBUVFFUVBndEJBQ1BnQVNBQUd3UkFRUUFRUGdzTUF3c2dBRUhCL2dOR0JFQWdBVUg0QVhGQndmNERFQXN0QUFCQkIzRnlRWUFCY2lFQVFjSCtBeEFMSUFBNkFBQU1BZ3NnQUVIRS9nTkdCRUJCQUNUcUFTQUFFQXRCQURvQUFBd0NDeUFBUWNYK0EwWUVRQ0FCSk44QkRBTUxJQUJCeHY0RFJnUkFRUUFoQUNBQlFRaDBJUUVEUUNBQVFaOEJUQVJBSUFBZ0FXb1FDeTBBQUNFQ0lBQkJnUHdEYWhBTElBSTZBQUFnQUVFQmFpRUFEQUVMQzBHRUJTVDRBUXdEQ3dKQUFrQUNRQUpBSUFCQncvNERSd1JBSUFCQnd2NERhdzRLQVFRRUJBUUVCQVFEQWdRTElBRWs2d0VNQmdzZ0FTVHNBUXdGQ3lBQkpPMEJEQVFMSUFFazdnRU1Bd3NNQWdzZ0FFSFYvZ05HQkVBZ0FSQS9EQUVMUVFFZ0FFSFAvZ05HSUFCQjhQNERSaHNFUUNQNUFRUkFJL3NCSWdKQi8vOEJURUVBSUFKQmdJQUJUaHNFZjBFQkJTQUNRZisvQTB4QkFDQUNRWUNnQTA0YkN3MENDd3NnQUVIci9nTk1RUUFnQUVIby9nTk9Hd1JBUVFFZ0FFSHIvZ05HSUFCQjZmNERSaHNFUUNBQVFRRnJJZ01RQ3kwQUFFRy9mM0VpQWtFL2NTSUVRVUJySUFRZ0FFSHIvZ05HRzBHQWtBUnFJQUU2QUFBZ0FrR0FBWEVFUUNBREVBc2dBa0VCYWtHQUFYSTZBQUFMQ3d3Q0N5QUFRWWYrQTB4QkFDQUFRWVQrQTA0YkJFQWp3Z0VRUUVFQUpNSUJBa0FDUUFKQUFrQWdBRUdFL2dOSEJFQWdBRUdGL2dOckRnTUJBZ01FQ3lQREFTRUFRUUFrd3dGQmhQNERFQXRCQURvQUFDUEpBUVIvSUFCQkFRSi9Ba0FDUUFKQUFrQUNRQ1BLQVE0RUFBRUNBd1FMUVFrTUJBdEJBd3dEQzBFRkRBSUxRUWNNQVF0QkFBdDBjUVZCQUFzRVFDUEVBVUVCYWlJQVFmOEJTZ1IvUVFFa3hRRkJBQVVnQUFza3hBRUxEQVVMQWtBanlRRUVRQ1BHQVEwQkk4VUJCRUJCQUNURkFRc0xJQUVreEFFTERBVUxJQUVreUFFanhnRkJBQ1BKQVJzRVFDQUJKTVFCUVFBa3hnRUxEQVFMSUFFUVFRd0RDd3dDQ3lBQVFZRCtBMFlFUUNBQlFmOEJjeVRYQVNQWEFTSUNRUkJ4UVFCSEpOZ0JJQUpCSUhGQkFFY2syUUVMSUFCQmovNERSZ1JBSUFGQkFYRkJBRWNrdlFFZ0FVRUNjVUVBUnlTK0FTQUJRUVJ4UVFCSEpMOEJJQUZCQ0hGQkFFY2t3QUVnQVVFUWNVRUFSeVRCQVNBQkpMd0JEQUlMSUFCQi8vOERSZ1JBSUFGQkFYRkJBRWNrdHdFZ0FVRUNjVUVBUnlTNEFTQUJRUVJ4UVFCSEpMa0JJQUZCQ0hGQkFFY2t1Z0VnQVVFUWNVRUFSeVM3QVNBQkpMWUJEQUlMREFFTFFRQVBDMEVCQ3lJQUlBQWozQUZHQkVCQkFTVGRBUXNnQUNBQkVFSUVRQ0FBRUFzZ0FUb0FBQXNMV0FFRGZ3TkFJQU1nQWtnRVFDQUFJQU5xRURZaEJTQUJJQU5xSVFRRFFDQUVRZisvQWtvRVFDQUVRWUJBYWlFRURBRUxDeUFFSUFVUVF5QURRUUZxSVFNTUFRc0xJL2dCUVNBai93RjBJQUpCQkhWc2FpVDRBUXM2QUNQcUFTUGZBVVpCQUNBQVFRRkdRUUVnQUJzYkJFQWdBVUVFY2lJQlFjQUFjUVJBUVFFa3ZnRkJBUkFvQ3dVZ0FVRjdjU0VCQ3lBQkMvd0NBUVIvSStBQlJRUkFEd3NqNmdFaUFrR1FBVTRFZjBFQkJTUHBBU0lBUWZnQ0kvOEJkQ0lCVGdSL1FRSUZRUU5CQUNBQUlBRk9Hd3NMSWdBajNnRkhCRUJCd2Y0REVBc3RBQUFoQXlBQUpONEJRUUFoQVFKQUFrQUNRQUpBSUFBaUFnUkFJQUpCQVdzT0F3RUNBd1FMSUFOQmZIRWlBMEVJY1VFQVJ5RUJEQU1MSUFOQmZYRkJBWElpQTBFUWNVRUFSeUVCREFJTElBTkJmbkZCQW5JaUEwRWdjVUVBUnlFQkRBRUxJQU5CQTNJaEF3c2dBUVJBUVFFa3ZnRkJBUkFvQ3lBQ1JRUkFJL2tCQkVBait3RWovQUVqK2dFaUFVRVFTQVIvSUFFRlFSQUxJZ0FRUkNBQUkvc0JhaVQ3QVNBQUkvd0JhaVQ4QVNBQklBQnJJZ0FrK2dFZ0FFRUFUQVJBUVFBaytRRkIxZjRERUF0Qi93RTZBQUFGUWRYK0F4QUxJQUJCQkhWQkFXdEIvMzV4T2dBQUN3c0xJQUpCQVVZRVFFRUJKTDBCUVFBUUtBc2dBaUFERUVVaEFFSEIvZ01RQ3lBQU9nQUFCU0FDUVprQlJnUkFJQUJCd2Y0REVBc3RBQUFRUlNFQVFjSCtBeEFMSUFBNkFBQUxDd3VBQWdFRGZ5UGdBUVJBSUFBajZRRnFKT2tCSXpZaEF3TkFJK2tCUVFRai93RWlBSFJCeUFNZ0FIUWo2Z0ZCbVFGR0cwNEVRQ1BwQVVFRUkvOEJJZ0IwUWNnRElBQjBJK29CSWdGQm1RRkdHMnNrNlFFZ0FVR1FBVVlFUUNBREJFQkJBQ0VBQTBBZ0FFR1FBVXdFUUNBQVFmOEJjUkFuSUFCQkFXb2hBQXdCQ3dzRklBRVFKd3RCQUNFQUEwQWdBRUdRQVVnRVFFRUFJUUlEUUNBQ1FhQUJTQVJBSUFJZ0FFR2dBV3hxUVlDUkJHcEJBRG9BQUNBQ1FRRnFJUUlNQVFzTElBQkJBV29oQUF3QkN3dEJmeVJIUVg4a1NBVWdBVUdRQVVnRVFDQURSUVJBSUFFUUp3c0xDMEVBSUFGQkFXb2dBVUdaQVVvYkpPb0JEQUVMQ3dzUVJndkdBUUVEZnlQT0FVVUVRQThMQTBBZ0F5QUFTQVJBSUFOQkJHb2hBd0ovSThzQklnSkJCR29pQVVILy93TktCRUFnQVVHQWdBUnJJUUVMSUFFTEpNc0JJQUpCQVVFQ1FRY2p6UUViSWdKMGNRUi9JQUZCQVNBQ2RIRkZCVUVBQ3dSQVFZSCtBeEFMTFFBQVFRRjBRUUZxUWY4QmNTRUJRWUgrQXhBTElBRTZBQUFqekFGQkFXb2lBVUVJUmdSQVFRQWt6QUZCQVNUQUFVRURFQ2hCZ3Y0REVBc3RBQUJCLzM1eElRRkJndjRERUFzZ0FUb0FBRUVBSk00QkJTQUJKTXdCQ3dzTUFRc0xDOXdCQVFGL0kvZ0JRUUJLQkVBZ0FDUDRBV29oQUVFQUpQZ0JDeUFBSTRvQ2FpU0tBaU9PQWtVRVFDTTBCRUFnQUNQb0FXb2s2QUZCQkNQL0FTSUJkRUhJQXlBQmRDUHFBVUdaQVVZYklRRURRQ1BvQVNBQlRnUkFJQUVRUnlQb0FTQUJheVRvQVF3QkN3c0ZJQUFRUndzak13UkFJQUFqcEFGcUpLUUJFRElGSUFBUUtrVkJBQ00zR3dSQUlBQVFNQVVnQUJBeEN3c2dBQkJJQ3lNMUJFQWdBQ1BDQVdva3dnRWp3Z0VRUUVFQUpNSUJCU0FBRUVBTElBQWprUUpxSWdBamp3Sk9CSDhqa0FKQkFXb2trQUlnQUNPUEFtc0ZJQUFMSkpFQ0N5d0JBWDlCQkJCSkk0a0NRUUZxUWYvL0EzRVFDeTBBQUVFSWRDRUFRUVFRU1NBQUk0a0NFQXN0QUFCeUN6OEJBWDhnQVVHQS9nTnhRUWgySVFJZ0FDQUJRZjhCY1NJQkVFSUVRQ0FBRUFzZ0FUb0FBQXNnQUVFQmFpSUFJQUlRUWdSQUlBQVFDeUFDT2dBQUN3dkdBUUFnQWdSQUlBRWdBRUgvL3dOeElnQnpJQUFnQVdweklnQkJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUdBQW5GQkFFZEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NGSUFBZ0FXcEIvLzhEY1NJQ0lBQkIvLzhEY1VsQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBaUFBSUFGemMwR0FJSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc0xDNW9JQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBT0VCTUFBUUlEQkFVR0J3Z0pDZ3NNRFE0UEN4QktRZi8vQTNFaUFFR0EvZ054UVFoMkpJRUNJQUJCL3dGeEpJSUNEQThMSTRJQ1FmOEJjU09CQWtIL0FYRkJDSFJ5SVFBamdBSWhBVUVFRUVrZ0FDQUJFRU1NRVFzamdnSkIvd0Z4STRFQ1FmOEJjVUVJZEhKQkFXcEIvLzhEY1NFQURCRUxJNEVDSWdCQkQzRkJBV3BCRUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmFrSC9BWEVpQUNTQkFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0RBOExRUUVqZ1FJaUFFRVBjVXRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJhMEgvQVhFaUFDU0JBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd3T0MwRUVFRWtqaVFJUUN5MEFBQ1NCQWd3TEN5T0FBaUlBUVlBQmNVR0FBVVpCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzZ0FFRUJkQ0FBUWY4QmNVRUhkbkpCL3dGeEpJQUNEQXNMRUVwQi8vOERjU0VBSTRnQ0lRRkJDQkJKSUFBZ0FSQkxEQWdMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SWdBamdnSkIvd0Z4STRFQ1FmOEJjVUVJZEhJaUFVRUFFRXdnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FpT0hBa0cvQVhFa2h3SkJDQThMSTRJQ1FmOEJjU09CQWtIL0FYRkJDSFJ5SVFCQkJCQkpJQUFRTmtIL0FYRWtnQUlNQ1FzamdnSkIvd0Z4STRFQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NFQURBa0xJNElDSWdCQkQzRkJBV3BCRUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmFrSC9BWEVpQUNTQ0FpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0RBY0xRUUVqZ2dJaUFFRVBjVXRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJhMEgvQVhFaUFDU0NBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd3R0MwRUVFRWtqaVFJUUN5MEFBQ1NDQWd3REN5T0FBaUlBUVFGeFFRQkxRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSUFCQkIzUWdBRUgvQVhGQkFYWnlRZjhCY1NTQUFnd0RDMEYvRHdzamlRSkJBbXBCLy84RGNTU0pBZ3dDQ3lPSkFrRUJha0gvL3dOeEpJa0NEQUVMSTRjQ1FmOEFjU1NIQWlPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0MwRUVEd3NnQUVHQS9nTnhRUWgySklFQ0lBQkIvd0Z4SklJQ1FRZ0w4Z2dCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFUWF3NFFBQUVDQXdRRkJnY0lDUW9MREEwT0R4QUxJLzRCQkVCQkJCQkpRYzMrQXhBMlFmOEJjU0lBSVFFZ0FFRUJjUVJBSUFGQmZuRWlBRUdBQVhFRWYwRUFKUDhCSUFCQi8zNXhCVUVCSlA4QklBQkJnQUZ5Q3lFQVFRUVFTVUhOL2dNZ0FCQkRRY1FBRHdzTFFRRWtqZ0lNRUFzUVNrSC8vd054SWdCQmdQNERjVUVJZGlTREFpQUFRZjhCY1NTRUFpT0pBa0VDYWtILy93TnhKSWtDREJFTEk0UUNRZjhCY1NPREFrSC9BWEZCQ0hSeUlRQWpnQUloQVVFRUVFa2dBQ0FCRUVNTUVBc2poQUpCL3dGeEk0TUNRZjhCY1VFSWRISkJBV3BCLy84RGNTRUFEQkFMSTRNQ0lnQkJEM0ZCQVdwQkVIRkJBRWRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJha0gvQVhFa2d3SWpnd0pGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SU1EZ3RCQVNPREFpSUFRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZyUWY4QmNTU0RBaU9EQWtWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWNBQWNrSC9BWEVraHdJTURRdEJCQkJKSTRrQ0VBc3RBQUFrZ3dJTUNnc2pnQUlpQVVHQUFYRkJnQUZHSVFBamh3SkJCSFpCQVhFZ0FVRUJkSEpCL3dGeEpJQUNEQW9MUVFRUVNTT0pBaEFMTFFBQUlRQWppUUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJa0NRUWdQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lJQUk0UUNRZjhCY1NPREFrSC9BWEZCQ0hSeUlnRkJBQkJNSUFBZ0FXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2hRSWdBRUgvQVhFa2hnSWpod0pCdndGeEpJY0NRUWdQQ3lPRUFrSC9BWEVqZ3dKQi93RnhRUWgwY2lFQVFRUVFTU0FBRURaQi93RnhKSUFDREFnTEk0UUNRZjhCY1NPREFrSC9BWEZCQ0hSeVFRRnJRZi8vQTNFaEFBd0lDeU9FQWlJQVFROXhRUUZxUVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMSUFCQkFXcEIvd0Z4SWdBa2hBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFnd0dDMEVCSTRRQ0lnQkJEM0ZMUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBQkJBV3RCL3dGeElnQWtoQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWNBQWNrSC9BWEVraHdJTUJRdEJCQkJKSTRrQ0VBc3RBQUFraEFJTUFnc2pnQUlpQVVFQmNTRUFJNGNDUVFSMlFRRnhRUWQwSUFGQi93RnhRUUYyY2lTQUFnd0NDMEYvRHdzamlRSkJBV3BCLy84RGNTU0pBZ3dCQ3lBQVFRQktCRUFqaHdKQkVISkIvd0Z4SkljQ0JTT0hBa0h2QVhFa2h3SUxJNGNDUWY4QWNTU0hBaU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDQzBFRUR3c2dBRUdBL2dOeFFRaDJKSU1DSUFCQi93RnhKSVFDUVFnTGpRb0JBbjhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJJR3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPSEFrRUhka0VCY1FSQUk0a0NRUUZxUWYvL0EzRWtpUUlGUVFRUVNTT0pBaEFMTFFBQUlRQWppUUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJa0NDMEVJRHdzUVNrSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FpT0pBa0VDYWtILy93TnhKSWtDREJBTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQWpnQUloQVVFRUVFa2dBQ0FCRUVNZ0FFRUJha0gvL3dOeElnQkJnUDREY1VFSWRpU0ZBaUFBUWY4QmNTU0dBZ3dQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2tFQmFrSC8vd054SVFBTUR3c2poUUlpQUVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGcVFmOEJjU0lBSklVQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJTURRdEJBU09GQWlJQVFROXhTMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnJRZjhCY1NJQUpJVUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDREF3TFFRUVFTU09KQWhBTExRQUFKSVVDREFvTFFRWkJBQ09IQWlJQ1FRVjJRUUZ4UVFCTEd5SUFRZUFBY2lBQUlBSkJCSFpCQVhGQkFFc2JJUUVqZ0FJaEFDQUNRUVoyUVFGeFFRQkxCSDhnQUNBQmEwSC9BWEVGSUFGQkJuSWdBU0FBUVE5eFFRbExHeUlCUWVBQWNpQUJJQUJCbVFGTEd5SUJJQUJxUWY4QmNRc2lBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTElBRkI0QUJ4UVFCSFFRQkxCRUFqaHdKQkVISkIvd0Z4SkljQ0JTT0hBa0h2QVhFa2h3SUxJNGNDUWQ4QmNTU0hBaUFBSklBQ0RBb0xJNGNDUVFkMlFRRnhRUUJMQkVCQkJCQkpJNGtDRUFzdEFBQWhBQ09KQWlBQVFSaDBRUmgxYWtILy93TnhRUUZxUWYvL0EzRWtpUUlGSTRrQ1FRRnFRZi8vQTNFa2lRSUxRUWdQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lJQUlBQkJBQkJNSUFCQkFYUkIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2hRSWdBRUgvQVhFa2hnSWpod0pCdndGeEpJY0NRUWdQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTU0FBRURaQi93RnhKSUFDSUFCQkFXcEIvLzhEY1NJQVFZRCtBM0ZCQ0hZa2hRSWdBRUgvQVhFa2hnSU1Cd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEpCQVd0Qi8vOERjU0VBREFjTEk0WUNJZ0JCRDNGQkFXcEJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYWtIL0FYRWlBQ1NHQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDREFVTFFRRWpoZ0lpQUVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmEwSC9BWEVpQUNTR0FpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBZ3dFQzBFRUVFa2ppUUlRQ3kwQUFDU0dBZ3dDQ3lPQUFrRi9jMEgvQVhFa2dBSWpod0pCd0FCeVFmOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SU1BZ3RCZnc4TEk0a0NRUUZxUWYvL0EzRWtpUUlMUVFRUEN5QUFRWUQrQTNGQkNIWWtoUUlnQUVIL0FYRWtoZ0pCQ0F1a0NRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQk1Hc09FQUFCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9IQWtFRWRrRUJjUVJBSTRrQ1FRRnFRZi8vQTNFa2lRSUZRUVFRU1NPSkFoQUxMUUFBSVFBamlRSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054SklrQ0MwRUlEd3NRU2tILy93TnhKSWdDSTRrQ1FRSnFRZi8vQTNFa2lRSU1FQXNqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUNPQUFpRUJRUVFRU1NBQUlBRVFReUFBUVFGclFmLy9BM0VpQUVHQS9nTnhRUWgySklVQ0lBQkIvd0Z4SklZQ0RBOExJNGdDUVFGcVFmLy9BM0VraUFKQkNBOExJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQkIvLzhEY1NJQUVEWWlBVUVQY1VFQmFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUJRUUZxUWY4QmNTSUJSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ1FRUVFTU0FBSUFFUVF3d05DeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNVRUJJQUJCLy84RGNTSUFFRFlpQVVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQVVFQmEwSC9BWEVpQVVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWNBQWNrSC9BWEVraHdKQkJCQkpJQUFnQVJCRERBd0xJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSkk0a0NFQXN0QUFBaEFVRUVFRWtnQUVILy93TnhJQUZCL3dGeEVFTU1DZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrRVFja0gvQVhFa2h3SU1DZ3NqaHdKQkJIWkJBWEVFUUVFRUVFa2ppUUlRQ3kwQUFDRUFJNGtDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU0pBZ1VqaVFKQkFXcEIvLzhEY1NTSkFndEJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SWdBamlBSkJBQkJNSUFBamlBSnFRZi8vQTNFaUFFR0EvZ054UVFoMkpJVUNJQUJCL3dGeEpJWUNJNGNDUWI4QmNTU0hBa0VJRHdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRWtnQUJBMlFmOEJjU1NBQWlBQVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMkpJVUNJQUJCL3dGeEpJWUNEQWNMSTRnQ1FRRnJRZi8vQTNFa2lBSkJDQThMSTRBQ0lnQkJEM0ZCQVdwQkVIRkJBRWRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJha0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NEQVVMUVFFamdBSWlBRUVQY1V0QkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYTBIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQndBQnlRZjhCY1NTSEFnd0VDMEVFRUVramlRSVFDeTBBQUNTQUFnd0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FRUjJRUUZ4UVFCTlFRQkxCRUFqaHdKQkVISkIvd0Z4SkljQ0JTT0hBa0h2QVhFa2h3SUxEQUlMUVg4UEN5T0pBa0VCYWtILy93TnhKSWtDQzBFRUMva0JBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJRR29PRUE4QUFRSURCQVVHQnc4SUNRb0xEQTBPQ3lPQ0FpU0JBZ3dPQ3lPREFpU0JBZ3dOQ3lPRUFpU0JBZ3dNQ3lPRkFpU0JBZ3dMQ3lPR0FpU0JBZ3dLQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTU0FBRURaQi93RnhKSUVDREFrTEk0QUNKSUVDREFnTEk0RUNKSUlDREFjTEk0TUNKSUlDREFZTEk0UUNKSUlDREFVTEk0VUNKSUlDREFRTEk0WUNKSUlDREFNTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJKSUFBUU5rSC9BWEVrZ2dJTUFnc2pnQUlrZ2dJTUFRdEJmdzhMUVFRTCtnRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSFFBR3NPRUFBQkR3SURCQVVHQndnSkR3b0xEQTBPQ3lPQkFpU0RBZ3dPQ3lPQ0FpU0RBZ3dOQ3lPRUFpU0RBZ3dNQ3lPRkFpU0RBZ3dMQ3lPR0FpU0RBZ3dLQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTU0FBRURaQi93RnhKSU1DREFrTEk0QUNKSU1DREFnTEk0RUNKSVFDREFjTEk0SUNKSVFDREFZTEk0TUNKSVFDREFVTEk0VUNKSVFDREFRTEk0WUNKSVFDREFNTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJKSUFBUU5rSC9BWEVraEFJTUFnc2pnQUlraEFJTUFRdEJmdzhMUVFRTCtnRUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSGdBR3NPRUFBQkFnTVBCQVVHQndnSkNnc1BEQTBPQ3lPQkFpU0ZBZ3dPQ3lPQ0FpU0ZBZ3dOQ3lPREFpU0ZBZ3dNQ3lPRUFpU0ZBZ3dMQ3lPR0FpU0ZBZ3dLQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTU0FBRURaQi93RnhKSVVDREFrTEk0QUNKSVVDREFnTEk0RUNKSVlDREFjTEk0SUNKSVlDREFZTEk0TUNKSVlDREFVTEk0UUNKSVlDREFRTEk0VUNKSVlDREFNTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJKSUFBUU5rSC9BWEVraGdJTUFnc2pnQUlraGdJTUFRdEJmdzhMUVFRTDJnTUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCckRoQUFBUUlEQkFVR0J3Z0pDZ3NNRFE0UUR3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBQ09CQWlFQlFRUVFTU0FBSUFFUVF3d1BDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBSTRJQ0lRRkJCQkJKSUFBZ0FSQkREQTRMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFBamd3SWhBVUVFRUVrZ0FDQUJFRU1NRFFzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFDT0VBaUVCUVFRUVNTQUFJQUVRUXd3TUN5T0dBa0gvQVhFamhRSWlBRUgvQVhGQkNIUnlJUUZCQkJCSklBRWdBQkJEREFzTEk0WUNJZ0JCL3dGeEk0VUNRZjhCY1VFSWRISWhBVUVFRUVrZ0FTQUFFRU1NQ2dzaitRRkZCRUFDUUNPMEFRUkFRUUVraXdJTUFRc2p0Z0VqdkFGeFFSOXhSUVJBUVFFa2pBSU1BUXRCQVNTTkFnc0xEQWtMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFBamdBSWhBVUVFRUVrZ0FDQUJFRU1NQ0FzamdRSWtnQUlNQndzamdnSWtnQUlNQmdzamd3SWtnQUlNQlFzamhBSWtnQUlNQkFzamhRSWtnQUlNQXdzamhnSWtnQUlNQWdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRWtnQUJBMlFmOEJjU1NBQWd3QkMwRi9Ed3RCQkF1a0FnRUZmeU9BQWlJRElRUWdBRUgvQVhFaUFTRUNJQUZCQUU4RVFDQUVRUTl4SUFKQkQzRnFRUkJ4UVFCSFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxCU0FDUVI5MklnVWdBaUFGYW5OQkQzRWdCRUVQY1V0QkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc0xJQUZCQUU4RVFDQURRZjhCY1NBQklBTnFRZjhCY1V0QkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0ZJQUZCSDNZaUFpQUJJQUpxY3lBRFFmOEJjVXBCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzTElBQWdBMnBCL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBZ3V2QVFFQ2Z5QUFJNEFDSWdGcUk0Y0NRUVIyUVFGeGFrSC9BWEVpQWlBQUlBRnpjMEVRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFCSUFCQi93RnhhaU9IQWtFRWRrRUJjV3BCZ0FKeFFRQkxRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSUFJa2dBSWdBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFndjRBUUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHQUFXc09FQUFCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9CQWhCVkRCQUxJNElDRUZVTUR3c2pnd0lRVlF3T0N5T0VBaEJWREEwTEk0VUNFRlVNREFzamhnSVFWUXdMQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTU0FBRURZUVZRd0tDeU9BQWhCVkRBa0xJNEVDRUZZTUNBc2pnZ0lRVmd3SEN5T0RBaEJXREFZTEk0UUNFRllNQlFzamhRSVFWZ3dFQ3lPR0FoQldEQU1MSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQkpJQUFRTmhCV0RBSUxJNEFDRUZZTUFRdEJmdzhMUVFRTHF3SUJCWDhqZ0FJaUF5RUVRUUFnQUVIL0FYRnJJZ0VoQWlBQlFRQk9CRUFnQkVFUGNTQUNRUTl4YWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3dVZ0FrRWZkU0lGSUFJZ0JXcHpRUTl4SUFSQkQzRkxRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMQ3lBQlFRQk9CRUFnQTBIL0FYRWdBU0FEYWtIL0FYRkxRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMQlNBQlFSOTFJZ0lnQVNBQ2FuTWdBMEgvQVhGS1FRQkxCRUFqaHdKQkVISkIvd0Z4SkljQ0JTT0hBa0h2QVhFa2h3SUxDeUFESUFCclFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrSEFBSEpCL3dGeEpJY0NDN01CQVFKL0k0QUNJZ0VnQUdzamh3SkJCSFpCQVhGclFmOEJjU0lDSUFBZ0FYTnpRUkJ4UVFCSFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxJQUVnQUVIL0FYRnJJNGNDUVFSMlFRRnhhMEdBQW5GQkFFdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWlTQUFpQUNSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBZ3Y0QVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR1FBV3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPQkFoQllEQkFMSTRJQ0VGZ01Ed3NqZ3dJUVdBd09DeU9FQWhCWURBMExJNFVDRUZnTURBc2poZ0lRV0F3TEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWVFXQXdLQ3lPQUFoQllEQWtMSTRFQ0VGa01DQXNqZ2dJUVdRd0hDeU9EQWhCWkRBWUxJNFFDRUZrTUJRc2poUUlRV1F3RUN5T0dBaEJaREFNTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJKSUFBUU5oQlpEQUlMSTRBQ0VGa01BUXRCZnc4TFFRUUw1d2tBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQm9BRnJEaEFBQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNqZ1FJamdBSnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SU1FQXNqZ2dJamdBSnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SU1Ed3NqZ3dJamdBSnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SU1EZ3NqaEFJamdBSnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SU1EUXNqaFFJamdBSnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SU1EQXNqaGdJamdBSnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SU1Dd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUVFRUVFa2dBQkEySTRBQ2NTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQklISkIvd0Z4SkljQ0RBb0xJNEFDSWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNQ1FzamdRSWpnQUp6UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDREFnTEk0SUNJNEFDYzBIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWd3SEN5T0RBaU9BQW5OQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJTUJnc2poQUlqZ0FKelFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0RBVUxJNFVDSTRBQ2MwSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFnd0VDeU9HQWlPQUFuTkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SU1Bd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUVFRUVFa2dBQkEySTRBQ2MwSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFnd0NDMEVBSklBQ0k0Y0NRWUFCY2tIL0FYRWtod0lqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWd3QkMwRi9Ed3NqaHdKQjd3RnhKSWNDUVFRTG9BSUJCSDhqZ0FJaUFpRURRUUFnQUVIL0FYRnJJZ0FoQVNBQVFRQk9CRUFnQTBFUGNTQUJRUTl4YWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3dVZ0FVRWZkU0lFSUFFZ0JHcHpRUTl4SUFOQkQzRkxRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMQ3lBQVFRQk9CRUFnQWtIL0FYRWdBQ0FDYWtIL0FYRkxRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMQlNBQVFSOTFJZ0VnQUNBQmFuTWdBa0gvQVhGS1FRQkxCRUFqaHdKQkVISkIvd0Z4SkljQ0JTT0hBa0h2QVhFa2h3SUxDeUFBSUFKcVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQndBQnlRZjhCY1NTSEFndk1CZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHd0FXc09FQUFCQWdNRUJRWUhDQWtLQ3d3TkRnOFFDeU9CQWlPQUFuSkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQkFMSTRJQ0k0QUNja0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaU9IQWtIdkFYRWtod0lNRHdzamd3SWpnQUp5UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWd3T0N5T0VBaU9BQW5KQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJamh3SkI3d0Z4SkljQ0RBMExJNFVDSTRBQ2NrSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpT0hBa0h2QVhFa2h3SU1EQXNqaGdJamdBSnlRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJNGNDUWU4QmNTU0hBZ3dMQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTU0FBRURZamdBSnlRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJNGNDUWU4QmNTU0hBZ3dLQ3lPQUFrSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpT0hBa0h2QVhFa2h3SU1DUXNqZ1FJUVhBd0lDeU9DQWhCY0RBY0xJNE1DRUZ3TUJnc2poQUlRWEF3RkN5T0ZBaEJjREFRTEk0WUNFRndNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRWtnQUJBMkVGd01BZ3NqZ0FJUVhBd0JDMEYvRHd0QkJBdEZBUUovSUFBUU5TSUJRWDlHQkg4Z0FCQUxMUUFBQlNBQkMwSC9BWEVoQWlBQ0lBQkJBV29pQVJBMUlnQkJmMFlFZnlBQkVBc3RBQUFGSUFBTFFmOEJjVUVJZEhJTCtSRUJCWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFSGNTSUZEZ2dBQVFJREJBVUdCd2dMSTRFQ0lRRU1Cd3NqZ2dJaEFRd0dDeU9EQWlFQkRBVUxJNFFDSVFFTUJBc2poUUloQVF3REN5T0dBaUVCREFJTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRRkJCQkJKSUFFUU5pRUJEQUVMSTRBQ0lRRUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZkFCY1VFRWRpSUVEaEFBQVFJREJBVUdCd2dKQ2dzTURRNFBFQXNnQUVFSFRBUi9JQUZCZ0FGeFFZQUJSa0VBU3dSQUk0Y0NRUkJ5UWY4QmNTU0hBZ1VqaHdKQjd3RnhKSWNDQ3lBQlFRRjBJQUZCL3dGeFFRZDJja0gvQVhFaUFrVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdKQkFRVWdBRUVQVEFSL0lBRkJBWEZCQUV0QkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBVUVIZENBQlFmOEJjVUVCZG5KQi93RnhJZ0pGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NRUUVGUVFBTEN5RUREQThMSUFCQkYwd0VmeU9IQWtFRWRrRUJjU0FCUVFGMGNrSC9BWEVoQWlBQlFZQUJjVUdBQVVaQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SkJBUVVnQUVFZlRBUi9JNGNDUVFSMlFRRnhRUWQwSUFGQi93RnhRUUYyY2lFQ0lBRkJBWEZCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzZ0FrVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdKQkFRVkJBQXNMSVFNTURnc2dBRUVuVEFSL0lBRkJBWFJCL3dGeElRSWdBVUdBQVhGQmdBRkdRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSUFKRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDUVFFRklBQkJMMHdFZnlBQlFRRnhJUUFnQVVIL0FYRkJBWFlpQWtHQUFYSWdBaUFCUVlBQmNVR0FBVVliSWdKQi93RnhSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpQUFRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMUVFFRlFRQUxDeUVEREEwTElBQkJOMHdFZnlBQlFROXhRUVIwSUFGQjhBRnhRUVIyY2lJQ1JVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdKQkFRVWdBRUUvVEFSL0lBRkIvd0Z4UVFGMklnSkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0lBRkJBWEZCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWd0QkFRVkJBQXNMSVFNTURBc2dBRUhIQUV3RWZ5QUJJZ0pCQVhGRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQklISkIvd0Z4SkljQ1FRRUZJQUJCendCTUJIOGdBU0lDUVFKeFJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFrRUJCVUVBQ3dzaEF3d0xDeUFBUWRjQVRBUi9JQUVpQWtFRWNVVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrRWdja0gvQVhFa2h3SkJBUVVnQUVIZkFFd0VmeUFCSWdKQkNIRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NRUUVGUVFBTEN5RUREQW9MSUFCQjV3Qk1CSDhnQVNJQ1FSQnhSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRU0J5UWY4QmNTU0hBa0VCQlNBQVFlOEFUQVIvSUFFaUFrRWdjVVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0pCQVFWQkFBc0xJUU1NQ1FzZ0FFSDNBRXdFZnlBQklnSkJ3QUJ4UlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWtFQkJTQUFRZjhBVEFSL0lBRWlBa0dBQVhGRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQklISkIvd0Z4SkljQ1FRRUZRUUFMQ3lFRERBZ0xJQUJCaHdGTUJIOUJBU0VESUFGQmZuRUZJQUJCandGTUJIOUJBU0VESUFGQmZYRUZRUUFMQ3lFQ0RBY0xJQUJCbHdGTUJIOUJBU0VESUFGQmUzRUZJQUJCbndGTUJIOUJBU0VESUFGQmQzRUZRUUFMQ3lFQ0RBWUxJQUJCcHdGTUJIOUJBU0VESUFGQmIzRUZJQUJCcndGTUJIOUJBU0VESUFGQlgzRUZRUUFMQ3lFQ0RBVUxJQUJCdHdGTUJIOUJBU0VESUFGQnYzOXhCU0FBUWI4QlRBUi9RUUVoQXlBQlFmOStjUVZCQUFzTElRSU1CQXNnQUVISEFVd0VmMEVCSVFNZ0FVRUJjZ1VnQUVIUEFVd0VmMEVCSVFNZ0FVRUNjZ1ZCQUFzTElRSU1Bd3NnQUVIWEFVd0VmMEVCSVFNZ0FVRUVjZ1VnQUVIZkFVd0VmMEVCSVFNZ0FVRUljZ1ZCQUFzTElRSU1BZ3NnQUVIbkFVd0VmMEVCSVFNZ0FVRVFjZ1VnQUVIdkFVd0VmMEVCSVFNZ0FVRWdjZ1ZCQUFzTElRSU1BUXNnQUVIM0FVd0VmMEVCSVFNZ0FVSEFBSElGSUFCQi93Rk1CSDlCQVNFRElBRkJnQUZ5QlVFQUN3c2hBZ3NDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQlE0SUFBRUNBd1FGQmdjSUN5QUNKSUVDREFjTElBSWtnZ0lNQmdzZ0FpU0RBZ3dGQ3lBQ0pJUUNEQVFMSUFJa2hRSU1Bd3NnQWlTR0Fnd0NDMEVCSUFSQkIwc2dCRUVFU1JzRVFDT0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUlBSVFRd3NNQVFzZ0FpU0FBZ3RCQkVGL0lBTWJDNVlGQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQndBRnJEaEFBQVFJUkF3UUZCZ2NJQ1FvTERBME9Ed3NqaHdKQkIzWkJBWEVORVF3VEN5T0lBaUVBUVFnUVNTQUFFRjVCLy84RGNTRUFJNGdDUVFKcVFmLy9BM0VraUFJZ0FFR0EvZ054UVFoMkpJRUNJQUJCL3dGeEpJSUNRUVFQQ3lPSEFrRUhka0VCY1VVTkRnd05DeU9IQWtFSGRrRUJjUTBNSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9KQWtFQ2FrSC8vd054SVFGQkNCQkpJQUFnQVJCTERBMExJNGdDUVFKclFmLy9BM0VpQUNTSUFpT0NBa0gvQVhFamdRSkIvd0Z4UVFoMGNpRUJRUWdRU1NBQUlBRVFTd3dOQzBFRUVFa2ppUUlRQ3kwQUFCQlZEQTBMSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9KQWlFQlFRZ1FTU0FBSUFFUVMwRUFKSWtDREFzTEk0Y0NRUWQyUVFGeFJRMEtEQXdMSTRnQ0lRQkJDQkJKSUFBUVhrSC8vd054SklrQ0lBQkJBbXBCLy84RGNTU0lBZ3dKQ3lPSEFrRUhka0VCY1EwSERBWUxRUVFRU1NPSkFoQUxMUUFBRUY4aEFDT0pBa0VCYWtILy93TnhKSWtDSUFBUEN5T0hBa0VIZGtFQmNVVU5CQ09JQWtFQ2EwSC8vd054SWdBa2lBSWppUUpCQW1wQi8vOERjU0VCUVFnUVNTQUFJQUVRU3d3RkN5T0lBa0VDYTBILy93TnhJZ0FraUFJamlRSkJBbXBCLy84RGNTRUJRUWdRU1NBQUlBRVFTd3dFQzBFRUVFa2ppUUlRQ3kwQUFCQldEQVVMSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9KQWlFQlFRZ1FTU0FBSUFFUVMwRUlKSWtDREFNTFFYOFBDeU9KQWtFQ2FrSC8vd054SklrQ1FRd1BDeEJLUWYvL0EzRWtpUUlMUVFnUEN5T0pBa0VCYWtILy93TnhKSWtDUVFRUEN5T0lBaUVBUVFnUVNTQUFFRjVCLy84RGNTU0pBaUFBUVFKcVFmLy9BM0VraUFKQkRBdktCQUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUZyRGhBQUFRSU5Bd1FGQmdjSUNRMEtEUXNNRFFzamh3SkJCSFpCQVhFTkR3d1JDeU9JQWlFQVFRZ1FTU0FBRUY1Qi8vOERjU0VCSUFCQkFtcEIvLzhEY1NTSUFpQUJRWUQrQTNGQkNIWWtnd0lnQVVIL0FYRWtoQUpCQkE4TEk0Y0NRUVIyUVFGeFJRME1EQXNMSTRjQ1FRUjJRUUZ4RFFvamlBSkJBbXRCLy84RGNTSUFKSWdDSTRrQ1FRSnFRZi8vQTNFaEFVRUlFRWtnQUNBQkVFc01Dd3NqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlJUUZCQ0JCSklBQWdBUkJMREFzTFFRUVFTU09KQWhBTExRQUFFRmdNQ3dzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRrQ0lRRkJDQkJKSUFBZ0FSQkxRUkFraVFJTUNRc2pod0pCQkhaQkFYRkZEUWdNQ2dzamlBSWhBRUVJRUVrZ0FCQmVRZi8vQTNFa2lRSkJBU1MxQVNBQVFRSnFRZi8vQTNFa2lBSU1Cd3NqaHdKQkJIWkJBWEVOQlF3RUN5T0hBa0VFZGtFQmNVVU5BeU9JQWtFQ2EwSC8vd054SWdBa2lBSWppUUpCQW1wQi8vOERjU0VCUVFnUVNTQUFJQUVRU3d3RUMwRUVFRWtqaVFJUUN5MEFBQkJaREFVTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFpRUJRUWdRU1NBQUlBRVFTMEVZSklrQ0RBTUxRWDhQQ3lPSkFrRUNha0gvL3dOeEpJa0NRUXdQQ3hCS1FmLy9BM0VraVFJTFFRZ1BDeU9KQWtFQmFrSC8vd054SklrQ1FRUVBDeU9JQWlFQVFRZ1FTU0FBRUY1Qi8vOERjU1NKQWlBQVFRSnFRZi8vQTNFa2lBSkJEQXVVQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI0QUZyRGhBQUFRSUxDd01FQlFZSENBc0xDd2tLQ3d0QkJCQkpJNGtDRUFzdEFBQWhBQ09BQWlFQlFRUVFTU0FBUWY4QmNVR0EvZ05xSUFFUVF3d0xDeU9JQWlFQVFRZ1FTU0FBRUY1Qi8vOERjU0VCSUFCQkFtcEIvLzhEY1NTSUFpQUJRWUQrQTNGQkNIWWtoUUlnQVVIL0FYRWtoZ0pCQkE4TEk0SUNRWUQrQTJvaEFDT0FBaUVCUVFRUVNTQUFJQUVRUTBFRUR3c2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRRkJDQkJKSUFBZ0FSQkxRUWdQQzBFRUVFa2ppUUlRQ3kwQUFDT0FBbkVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRU0J5UWY4QmNTU0hBaU9IQWtIdkFYRWtod0lNQndzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRrQ0lRRkJDQkJKSUFBZ0FSQkxRU0FraVFKQkNBOExRUVFRU1NPSkFoQUxMQUFBSVFBamlBSWdBRUVCRUV3Z0FDT0lBbXBCLy84RGNTU0lBaU9IQWtIL0FIRWtod0lqaHdKQnZ3RnhKSWNDSTRrQ1FRRnFRZi8vQTNFa2lRSkJEQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SklrQ1FRUVBDeEJLUWYvL0EzRWhBQ09BQWlFQlFRUVFTU0FBSUFFUVF5T0pBa0VDYWtILy93TnhKSWtDUVFRUEMwRUVFRWtqaVFJUUN5MEFBQ09BQW5OQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWlPSEFrSGZBWEVraHdJamh3SkI3d0Z4SkljQ0RBSUxJNGdDUVFKclFmLy9BM0VpQUNTSUFpT0pBaUVCUVFnUVNTQUFJQUVRUzBFb0pJa0NRUWdQQzBGL0R3c2ppUUpCQVdwQi8vOERjU1NKQWtFRUMvb0VBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVdzT0VBQUJBZ01OQkFVR0J3Z0pDZzBOQ3d3TkMwRUVFRWtqaVFJUUN5MEFBQ0VBUVFRUVNTQUFRZjhCY1VHQS9nTnFFRFpCL3dGeEpJQUNEQTBMSTRnQ0lRQkJDQkJKSUFBUVhrSC8vd054SVFFZ0FFRUNha0gvL3dOeEpJZ0NJQUZCZ1A0RGNVRUlkaVNBQWlBQlFmOEJjU1NIQWd3TkN5T0NBa0dBL2dOcUlRQkJCQkJKSUFBUU5rSC9BWEVrZ0FJTURBdEJBQ1MwQVF3TEN5T0lBa0VDYTBILy93TnhJZ0FraUFJamh3SkIvd0Z4STRBQ1FmOEJjVUVJZEhJaEFVRUlFRWtnQUNBQkVFdEJDQThMUVFRUVNTT0pBaEFMTFFBQUk0QUNja0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaU9IQWtIdkFYRWtod0lNQ0FzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRrQ0lRRkJDQkJKSUFBZ0FSQkxRVEFraVFKQkNBOExRUVFRU1NPSkFoQUxMUUFBSVFBamh3SkIvd0J4SkljQ0k0Y0NRYjhCY1NTSEFpT0lBaUlCSUFCQkdIUkJHSFVpQUVFQkVFd2dBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkaVNGQWlBQVFmOEJjU1NHQWlPSkFrRUJha0gvL3dOeEpJa0NRUWdQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lTSUFrRUlEd3NRU2tILy93TnhJUUJCQkJCSklBQVFOa0gvQVhFa2dBSWppUUpCQW1wQi8vOERjU1NKQWd3RkMwRUJKTFVCREFRTFFRUVFTU09KQWhBTExRQUFFRndNQWdzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRrQ0lRRkJDQkJKSUFBZ0FSQkxRVGdraVFKQkNBOExRWDhQQ3lPSkFrRUJha0gvL3dOeEpJa0NDMEVFQzd3QkFRRi9JNGtDUVFGcVFmLy9BM0VpQVVFQmEwSC8vd054SUFFampRSWJKSWtDQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUh3QVhGQkJIWU9Ed0FCQWdNRUJRWUhDQWtLQ3d3TkRnOExJQUFRVFE4TElBQVFUZzhMSUFBUVR3OExJQUFRVUE4TElBQVFVUThMSUFBUVVnOExJQUFRVXc4TElBQVFWQThMSUFBUVZ3OExJQUFRV2c4TElBQVFXdzhMSUFBUVhROExJQUFRWUE4TElBQVFZUThMSUFBUVlnOExJQUFRWXd1MkFRRUNmMEVBSkxRQlFZLytBeEFMTFFBQVFYNGdBSGR4SWdFa3ZBRkJqLzRERUFzZ0FUb0FBQ09JQWtFQ2EwSC8vd054SklnQ0k0a0NJUUVqaUFJaUFoQUxJQUU2QUFBZ0FrRUJhaEFMSUFGQmdQNERjVUVJZGpvQUFBSkFBa0FDUUFKQUFrQUNRQ0FBRGdVQUFRSURCQVVMUVFBa3ZRRkJ3QUFraVFJTUJBdEJBQ1MrQVVISUFDU0pBZ3dEQzBFQUpMOEJRZEFBSklrQ0RBSUxRUUFrd0FGQjJBQWtpUUlNQVF0QkFDVEJBVUhnQUNTSkFnc0w1d0VCQVg4anRRRUVRRUVCSkxRQlFRQWt0UUVMSTdZQkk3d0JjVUVmY1VFQVN3UkFJNHdDUlVFQUk3UUJHd1IvSTcwQlFRQWp0d0ViQkg5QkFCQmxRUUVGSTc0QlFRQWp1QUViQkg5QkFSQmxRUUVGSTc4QlFRQWp1UUViQkg5QkFoQmxRUUVGSThBQlFRQWp1Z0ViQkg5QkF4QmxRUUVGSThFQlFRQWp1d0ViQkg5QkJCQmxRUUVGUVFBTEN3c0xDd1ZCQUFzRWYwRUJJNHdDSTRzQ0d3Ui9RUUFrakFKQkFDU0xBa0VBSkkwQ1FRQWtqZ0pCR0FWQkZBc0ZRUUFMSVFCQkFTT01BaU9MQWhzRVFFRUFKSXdDUVFBa2l3SkJBQ1NOQWtFQUpJNENDeUFBRHd0QkFBdXRBUUVDZjBFQkpKVUNJNDBDQkVBamlRSVFDeTBBQUJCa0VFbEJBQ1NNQWtFQUpJc0NRUUFralFKQkFDU09BZ3NRWmlJQlFRQktCRUFnQVJCSkMwRUFJNDRDUlVFQkk0d0NJNHNDR3hzRWZ5T0pBaEFMTFFBQUVHUUZRUVFMSVFFamh3SkI4QUZ4SkljQ0lBRkJBRXdFUUNBQkR3c2dBUkJKSTVRQ1FRRnFJZ0Fqa2dKT0JIOGprd0pCQVdva2t3SWdBQ09TQW1zRklBQUxKSlFDSTRrQ0k5b0JSZ1JBUVFFazNRRUxJQUVMQlFBanN3RUxxUUVCQTM4Z0FFRi9RWUFJSUFCQkFFZ2JJQUJCQUVvYklRQURRQ1BkQVVWQkFDQUJSVUVBUVFBZ0FrVWdBeHNiR3dSQUVHZEJBRWdFUUVFQklRTUZJNG9DUWRDa0JDUC9BWFJPQkVCQkFTRUNCVUVCSUFFanN3RWdBRTVCQUNBQVFYOUtHeHNoQVFzTERBRUxDeUFDQkVBamlnSkIwS1FFSS84QmRHc2tpZ0pCQUE4TElBRUVRRUVCRHdzajNRRUVRRUVBSk4wQlFRSVBDeU9KQWtFQmEwSC8vd054SklrQ1FYOExCZ0JCZnhCcEN6TUJBbjhEUUNBQlFRQk9RUUFnQWlBQVNCc0VRRUYvRUdraEFTQUNRUUZxSVFJTUFRc0xJQUZCQUVnRVFDQUJEd3RCQUFzRkFDT1BBZ3NGQUNPUUFnc0ZBQ09SQWd2eEFRRUJmMEVBSkk0Q0FuOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQTRJQUFFQ0F3UUZCZ2NJQ3lQUEFRd0lDeVBTQVF3SEN5UFFBUXdHQ3lQUkFRd0ZDeVBUQVF3RUN5UFVBUXdEQ3lQVkFRd0NDeVBXQVF3QkMwRUFDMFVoQVFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQURnZ0FBUUlEQkFVR0J3Z0xRUUVrendFTUJ3dEJBU1RTQVF3R0MwRUJKTkFCREFVTFFRRWswUUVNQkF0QkFTVFRBUXdEQzBFQkpOUUJEQUlMUVFFazFRRU1BUXRCQVNUV0FRc2dBUVJBUVFFZ0FFRURUQ0lCUVFBajJBRWJCSDlCQVFWQkFBc2dBVVZCQUNQWkFSc2JCRUJCQVNUQkFVRUVFQ2dMQ3d1U0FRQWdBRUVBU2dSQVFRQVFid1ZCQUNUUEFRc2dBVUVBU2dSQVFRRVFid1ZCQUNUU0FRc2dBa0VBU2dSQVFRSVFid1ZCQUNUUUFRc2dBMEVBU2dSQVFRTVFid1ZCQUNUUkFRc2dCRUVBU2dSQVFRUVFid1ZCQUNUVEFRc2dCVUVBU2dSQVFRVVFid1ZCQUNUVUFRc2dCa0VBU2dSQVFRWVFid1ZCQUNUVkFRc2dCMEVBU2dSQVFRY1Fid1ZCQUNUV0FRc0xCd0FnQUNUYUFRc0hBRUYvSk5vQkN3Y0FJQUFrMndFTEJ3QkJmeVRiQVFzSEFDQUFKTndCQ3djQVFYOGszQUVMQlFBamdBSUxCUUFqZ1FJTEJRQWpnZ0lMQlFBamd3SUxCUUFqaEFJTEJRQWpoUUlMQlFBamhnSUxCUUFqaHdJTEJRQWppUUlMQlFBamlBSUxDZ0FqaVFJUUN5MEFBQXNGQUNQcUFRc0ZBQ1ByQVFzRkFDUHNBUXNGQUNQdEFRc0ZBQ1B1QVF2VUF3RUpmMEdBZ0FKQmdKQUNJK01CR3lFRVFZQzRBa0dBc0FJajVBRWJJUWtEUUNBR1FZQUNTQVJBUVFBaEJRTkFJQVZCZ0FKSUJFQWdDU0FHUVFOMVFRVjBhaUFGUVFOMWFpSUhRWUNRZm1vdEFBQWhBU0FHUVFodklRSkJCeUFGUVFodmF5RUlJQVFnQkVHQWtBSkdCSDhnQVVHQUFXc2dBVUdBQVdvZ0FVR0FBWEViQlNBQkMwRUVkR29oQXlBQVFRQktRUUFqL2dFYkJIOGdCMEdBMEg1cUxRQUFCVUVBQ3lJQlFjQUFjUVJBUVFjZ0Ftc2hBZ3NnQVVFSWNVVkZRUTEwSWdjZ0F5QUNRUUYwYWlJRFFZQ1FmbXBxTFFBQUlRSWdCeUFEUVlHUWZtcHFMUUFBUVFFZ0NIUnhCSDlCQWdWQkFBc2lBMEVCYWlBRElBSkJBU0FJZEhFYklRTWdCU0FHUVFoMGFrRURiQ0VDSUFCQkFFcEJBQ1ArQVJzRVFDQUNRWUNoQzJvaUFpQUJRUWR4UVFOMElBTkJBWFJxSWdGQkFXcEJQM0ZCZ0pBRWFpMEFBRUVJZENBQlFUOXhRWUNRQkdvdEFBQnlJZ0ZCSDNGQkEzUTZBQUFnQWlBQlFlQUhjVUVGZGtFRGREb0FBU0FDSUFGQmdQZ0JjVUVLZGtFRGREb0FBZ1VnQWtHQW9RdHFJZ0VnQTBISC9nTVFJU0lEUVlDQS9BZHhRUkIyT2dBQUlBRWdBMEdBL2dOeFFRaDJPZ0FCSUFFZ0F6b0FBZ3NnQlVFQmFpRUZEQUVMQ3lBR1FRRnFJUVlNQVFzTEM5a0RBUXQvQTBBZ0FrRVhTQVJBUVFBaEJRTkFJQVZCSDBnRVFDQUZRUTlLSVFrZ0FpSUJRUTlLQkg4Z0FVRVBhd1VnQVF0QkJIUWlBU0FGUVE5cmFpQUJJQVZxSUFWQkQwb2JJUWRCeC80RElRcEJmeUVEUVFBaEFBTkFJQUJCQ0VnRVFFRUFJUVFEUUNBRVFRVklCRUFnQnlBQUlBUkJBM1JxUVFKMElnRkJndndEYWhBTExRQUFSZ1JBSUFrZ0FVR0QvQU5xRUFzdEFBQWlBVUVJY1VFQUkvNEJHMFZGUmdSQUFuOUJCU0VFUWNuK0EwSEkvZ01nQVNJRFFSQnhHeUVLUVFnTElRQUxDeUFFUVFGcUlRUU1BUXNMSUFCQkFXb2hBQXdCQ3dzZ0EwRUFTRUVBSS80Qkd3Ui9RWUM0QWtHQXNBSWo1QUViSVFoQmZ5RUFRUUFoQkFOQUlBUkJJRWdFUUVFQUlRWURRQ0FHUVNCSUJFQWdCeUFFSUFnZ0JrRUZkR3BxSWdGQmdKQithaTBBQUVZRVFBSi9RU0FoQkVFZ0lRWWdBUXNoQUFzZ0JrRUJhaUVHREFFTEN5QUVRUUZxSVFRTUFRc0xJQUJCQUU0RWZ5QUFRWURRZm1vdEFBQUZRWDhMQlVGL0N5RUJRWUNRQWtHQWdBSWdBa0VQU2hzaENFRUFJUUFEUUNBQVFRaElCRUFnQnlBSUlBbEJBRUVISUFBZ0JVRURkQ0FBSUFKQkEzUnFRZmdCUVlDaEZ5QUtJQUVnQXhBaUdpQUFRUUZxSVFBTUFRc0xJQVZCQVdvaEJRd0JDd3NnQWtFQmFpRUNEQUVMQ3d1WUFnRUpmd05BSUFSQkNFZ0VRRUVBSVFJRFFDQUNRUVZJQkVBZ0JDQUNRUU4wYWtFQ2RDSUJRWUQ4QTJvUUN5MEFBQm9nQVVHQi9BTnFFQXN0QUFBYUlBRkJndndEYWhBTExRQUFJUUJCQVNFRkkrVUJCRUFDZjBFQ0lRVWdBRUVDYjBFQlJnUi9JQUJCQVdzRklBQUxDeUVBQ3lBQlFZUDhBMm9RQ3kwQUFDSUdRUWh4UVFBai9nRWJSVVVoQjBISi9nTkJ5UDRESUFaQkVIRWJJUWhCQUNFQkEwQWdBU0FGU0FSQVFRQWhBd05BSUFOQkNFZ0VRQ0FBSUFGcVFZQ0FBaUFIUVFCQkJ5QURJQVJCQTNRZ0F5QUNRUVIwYWlBQlFRTjBha0hBQUVHQW9TQWdDRUYvSUFZUUlob2dBMEVCYWlFRERBRUxDeUFCUVFGcUlRRU1BUXNMSUFKQkFXb2hBZ3dCQ3dzZ0JFRUJhaUVFREFFTEN3c0ZBQ1BEQVFzRkFDUEVBUXNGQUNQSUFRc1NBUUYvSThvQklnQkJCSElnQUNQSkFSc0xMZ0VCZndOQUlBQkIvLzhEU0FSQUlBQkJnTFhKQkdvZ0FCQTJPZ0FBSUFCQkFXb2hBQXdCQ3d0QkFDVGRBUXRsQUVIeTVjc0hKRHRCb01HQ0JTUThRZGl3NFFJa1BVR0lrQ0FrUGtIeTVjc0hKRDlCb01HQ0JTUkFRZGl3NFFJa1FVR0lrQ0FrUWtIeTVjc0hKRU5Cb01HQ0JTUkVRZGl3NFFJa1JVR0lrQ0FrUmo4QVFaUUJTQVJBUVpRQlB3QnJRQUFhQ3dzREFBRUx2QUVCQW44Z0FDZ0NCQ0lDUWYvLy8vOEFjU0VCSUFBb0FnQkJBWEVFUUVFQVFZQUpRZm9BUVE0UUFBQUxJQUZCQVVZRVFBSkFBa0FDUUNBQUtBSUlEZ01DQWdBQkN5QUFLQUlRSWdFRVFDQUJRYndKVHdSQUlBRkJFR3NRa1FFTEN3d0JDd0FMSUFKQmdJQ0FnSGh4QkVCQkFFR0FDVUgrQUVFU0VBQUFDeUFBSUFBb0FnQkJBWEkyQWdBakFDQUFFQUlGSUFGQkFFMEVRRUVBUVlBSlFZZ0JRUkFRQUFBTElBQWdBVUVCYXlBQ1FZQ0FnSUIvY1hJMkFnUUxDeHdBQWtBQ1FBSkFJNWNDRGdJQkFnQUxBQXRCQUNFQUN5QUFFR2tMSFFBQ1FBSkFBa0FqbHdJT0F3RUJBZ0FMQUF0QmZ5RUJDeUFCRUdrTEJ3QWdBQ1NYQWdzTHZ3RUVBRUdBQ0FzdEhnQUFBQUVBQUFBQkFBQUFIZ0FBQUg0QWJBQnBBR0lBTHdCeUFIUUFMd0IwQUd3QWN3Qm1BQzRBZEFCekFFR3dDQXMzS0FBQUFBRUFBQUFCQUFBQUtBQUFBR0VBYkFCc0FHOEFZd0JoQUhRQWFRQnZBRzRBSUFCMEFHOEFid0FnQUd3QVlRQnlBR2NBWlFCQjhBZ0xMUjRBQUFBQkFBQUFBUUFBQUI0QUFBQitBR3dBYVFCaUFDOEFjZ0IwQUM4QWNBQjFBSElBWlFBdUFIUUFjd0JCb0FrTEZRTUFBQUFnQUFBQUFBQUFBQ0FBQUFBQUFBQUFJQUF6RUhOdmRYSmpaVTFoY0hCcGJtZFZVa3doWTI5eVpTOWthWE4wTDJOdmNtVXVkVzUwYjNWamFHVmtMbmRoYzIwdWJXRnciKToKInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93fHwidW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmP2F3YWl0IEkoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZlJCZ0FBRi9ZQUYvQVg5Z0FYOEFZQUFBWUFKL2Z3Ri9ZQUovZndCZ0EzOS9md0JnQm45L2YzOS9md0JnQkg5L2YzOEFZQWQvZjM5L2YzOS9BR0FJZjM5L2YzOS9mMzhBWUFwL2YzOS9mMzkvZjM5L0FHQURmMzkvQVg5Z0JIOS9mMzhCZjJBRmYzOS9mMzhCZjJBTmYzOS9mMzkvZjM5L2YzOS9md0YvQWcwQkEyVnVkZ1ZoWW05eWRBQUlBNVlCbEFFRkJRWUFCQVlNQkFFQ0FRTUNBZ01EQXdzQUF3TURBd01EQXdNQUFBQUFEZ1FQQ1FjSEJRSUNBd0VCQVFFQkRRSUNBd0VBQVFFRkF3SUNBZ0lFQWdJQ0FnUUZCZ1FEQWdJQ0FBVUdBUUVCQVFFQkFRRUNBZ0VDQWdFQkFnRUJBUUVCQVFFQkFnQUFBQUVBQVFBQUFBSUtBZ01DQXdJREFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJREF3QUFBQUFEQXdNQ0FRUUNCUU1CQUFFRzNndVlBbjhCUVFBTGZ3RkJBQXQvQUVFQUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFZQ0FBUXQvQUVHQWtBRUxmd0JCZ0lBQ0MzOEFRWUNRQXd0L0FFR0FnQUVMZndCQmdCQUxmd0JCZ0lBRUMzOEFRWUNRQkF0L0FFR0FBUXQvQUVHQWtRUUxmd0JCZ0xnQkMzOEFRWURKQlF0L0FFR0EyQVVMZndCQmdLRUxDMzhBUVlDQURBdC9BRUdBb1JjTGZ3QkJnSUFKQzM4QVFZQ2hJQXQvQUVHQStBQUxmd0JCZ0pBRUMzOEFRWUNKSFF0L0FFR0FtU0VMZndCQmdJQUlDMzhBUVlDWktRdC9BRUdBZ0FnTGZ3QkJnSmt4QzM4QVFZQ0FDQXQvQUVHQW1Ua0xmd0JCZ0lBSUMzOEFRWUNad1FBTGZ3QkJnSUFJQzM4QVFZQ1p5UUFMZndCQmdJQUlDMzhBUVlDWjBRQUxmd0JCZ0JRTGZ3QkJnSzNSQUF0L0FFR0FpUGdEQzM4QVFZQzF5UVFMZndCQi8vOERDMzhBUVFBTGZ3QkJnTFhOQkF0L0FFR1VBUXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQi93QUxmd0ZCL3dBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFR2dDUXQvQVVFQUN3ZWRFV2tHYldWdGIzSjVBZ0FIWDE5aGJHeHZZd0FJQ0Y5ZmNtVjBZV2x1QUFrSlgxOXlaV3hsWVhObEFBb0pYMTlqYjJ4c1pXTjBBSkFCQzE5ZmNuUjBhVjlpWVhObEE1WUNCbU52Ym1acFp3QVNEbWhoYzBOdmNtVlRkR0Z5ZEdWa0FCTUpjMkYyWlZOMFlYUmxBQllKYkc5aFpGTjBZWFJsQUJzRmFYTkhRa01BSEJKblpYUlRkR1Z3YzFCbGNsTjBaWEJUWlhRQUhRdG5aWFJUZEdWd1UyVjBjd0FlQ0dkbGRGTjBaWEJ6QUI4VlpYaGxZM1YwWlUxMWJIUnBjR3hsUm5KaGJXVnpBR3NNWlhobFkzVjBaVVp5WVcxbEFHb1paWGhsWTNWMFpVWnlZVzFsUVc1a1EyaGxZMnRCZFdScGJ3Q1NBUlZsZUdWamRYUmxWVzUwYVd4RGIyNWthWFJwYjI0QWt3RUxaWGhsWTNWMFpWTjBaWEFBWnhSblpYUkRlV05zWlhOUVpYSkRlV05zWlZObGRBQnNER2RsZEVONVkyeGxVMlYwY3dCdENXZGxkRU41WTJ4bGN3QnVEbk5sZEVwdmVYQmhaRk4wWVhSbEFIQWZaMlYwVG5WdFltVnlUMlpUWVcxd2JHVnpTVzVCZFdScGIwSjFabVpsY2dCb0VHTnNaV0Z5UVhWa2FXOUNkV1ptWlhJQUZ4eHpaWFJOWVc1MVlXeERiMnh2Y21sNllYUnBiMjVRWVd4bGRIUmxBQTBYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERMaE5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXk4U1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF6QWVRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdJYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREF4WlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdRU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3VWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RERCeEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBdzBTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdZT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQnhGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNSURWZFBVa3RmVWtGTlgxTkpXa1VEQ1NaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTUtJazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURDeGhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNERHaFJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNYkZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9BdzRRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1QR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01RRkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF4RU9SbEpCVFVWZlRFOURRVlJKVDA0REVncEdVa0ZOUlY5VFNWcEZBeE1YUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERGQk5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhVU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4WU9WRWxNUlY5RVFWUkJYMU5KV2tVREZ4SlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERHQTVQUVUxZlZFbE1SVk5mVTBsYVJRTVpGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNa0VVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF5VVpRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWNGVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZVMGxhUlFNZEdVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlRFOURRVlJKVDA0REhoVkRTRUZPVGtWTVh6SmZRbFZHUmtWU1gxTkpXa1VESHhsRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXlBVlEwaEJUazVGVEY4elgwSlZSa1pGVWw5VFNWcEZBeUVaUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01pRlVOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVTBsYVJRTWpGa05CVWxSU1NVUkhSVjlTUVUxZlRFOURRVlJKVDA0REpoSkRRVkpVVWtsRVIwVmZVa0ZOWDFOSldrVURKeEZDVDA5VVgxSlBUVjlNVDBOQlZFbFBUZ01vRFVKUFQxUmZVazlOWDFOSldrVURLUlpEUVZKVVVrbEVSMFZmVWs5TlgweFBRMEZVU1U5T0F5b1NRMEZTVkZKSlJFZEZYMUpQVFY5VFNWcEZBeXNkUkVWQ1ZVZGZSMEZOUlVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0RExCbEVSVUpWUjE5SFFVMUZRazlaWDAxRlRVOVNXVjlUU1ZwRkF5MGhaMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBc2JjMlYwVUhKdlozSmhiVU52ZFc1MFpYSkNjbVZoYTNCdmFXNTBBSEVkY21WelpYUlFjbTluY21GdFEyOTFiblJsY2tKeVpXRnJjRzlwYm5RQWNobHpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFITWJjbVZ6WlhSU1pXRmtSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBSFFhYzJWMFYzSnBkR1ZIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBZFJ4eVpYTmxkRmR5YVhSbFIySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFIWU1aMlYwVW1WbmFYTjBaWEpCQUhjTVoyVjBVbVZuYVhOMFpYSkNBSGdNWjJWMFVtVm5hWE4wWlhKREFIa01aMlYwVW1WbmFYTjBaWEpFQUhvTVoyVjBVbVZuYVhOMFpYSkZBSHNNWjJWMFVtVm5hWE4wWlhKSUFId01aMlYwVW1WbmFYTjBaWEpNQUgwTVoyVjBVbVZuYVhOMFpYSkdBSDRSWjJWMFVISnZaM0poYlVOdmRXNTBaWElBZnc5blpYUlRkR0ZqYTFCdmFXNTBaWElBZ0FFWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dDQkFRVm5aWFJNV1FDQ0FRcG5aWFJUWTNKdmJHeFlBSU1CQ21kbGRGTmpjbTlzYkZrQWhBRUtaMlYwVjJsdVpHOTNXQUNGQVFwblpYUlhhVzVrYjNkWkFJWUJIV1J5WVhkQ1lXTnJaM0p2ZFc1a1RXRndWRzlYWVhOdFRXVnRiM0o1QUljQkdHUnlZWGRVYVd4bFJHRjBZVlJ2VjJGemJVMWxiVzl5ZVFDSUFSTmtjbUYzVDJGdFZHOVhZWE50VFdWdGIzSjVBSWtCQm1kbGRFUkpWZ0NLQVFkblpYUlVTVTFCQUlzQkJtZGxkRlJOUVFDTUFRWm5aWFJVUVVNQWpRRVRkWEJrWVhSbFJHVmlkV2RIUWsxbGJXOXllUUNPQVJSZlgzTmxkRUZ5WjNWdFpXNTBjMHhsYm1kMGFBQ1VBUWdDandFSytiMENsQUdWQWdFRWZ5QUJLQUlBSWdKQkFYRkZCRUJCQUVHUUNFR1ZBa0VPRUFBQUN5QUNRWHh4SWdKQjhQLy8vd05KUVFBZ0FrRVFUeHRGQkVCQkFFR1FDRUdYQWtFT0VBQUFDeUFDUVlBQ1NRUkFJQUpCQkhZaEFnVWdBa0VmSUFKbmF5SURRUVJyZGtFUWN5RUNJQU5CQjJzaEF3c2dBa0VRU1VFQUlBTkJGMGtiUlFSQVFRQkJrQWhCcEFKQkRoQUFBQXNnQVNnQ0ZDRUVJQUVvQWhBaUJRUkFJQVVnQkRZQ0ZBc2dCQVJBSUFRZ0JUWUNFQXNnQVNBQUlBSWdBMEVFZEdwQkFuUnFLQUpnUmdSQUlBQWdBaUFEUVFSMGFrRUNkR29nQkRZQ1lDQUVSUVJBSUFBZ0EwRUNkR29pQkNnQ0JFRitJQUozY1NFQklBUWdBVFlDQkNBQlJRUkFJQUFnQUNnQ0FFRitJQU4zY1RZQ0FBc0xDd3YvQXdFSGZ5QUJSUVJBUVFCQmtBaEJ6UUZCRGhBQUFBc2dBU2dDQUNJRVFRRnhSUVJBUVFCQmtBaEJ6d0ZCRGhBQUFBc2dBVUVRYWlBQktBSUFRWHh4YWlJRktBSUFJZ0pCQVhFRVFDQUVRWHh4UVJCcUlBSkJmSEZxSWdOQjhQLy8vd05KQkVBQ2Z5QUFJQVVRQVNBQklBTWdCRUVEY1hJaUJEWUNBQ0FCUVJCcUlBRW9BZ0JCZkhGcUlnVW9BZ0FMSVFJTEN5QUVRUUp4QkVBQ2Z5QUJRUVJyS0FJQUlnTW9BZ0FpQjBFQmNVVUVRRUVBUVpBSVFlUUJRUkFRQUFBTElBZEJmSEZCRUdvZ0JFRjhjV29pQ0VIdy8vLy9BMGtFZnlBQUlBTVFBU0FESUFnZ0IwRURjWElpQkRZQ0FDQURCU0FCQ3dzaEFRc2dCU0FDUVFKeU5nSUFJQVJCZkhFaUEwSHcvLy8vQTBsQkFDQURRUkJQRzBVRVFFRUFRWkFJUWZNQlFRNFFBQUFMSUFVZ0F5QUJRUkJxYWtjRVFFRUFRWkFJUWZRQlFRNFFBQUFMSUFWQkJHc2dBVFlDQUNBRFFZQUNTUVJBSUFOQkJIWWhBd1VnQTBFZklBTm5heUlFUVFScmRrRVFjeUVESUFSQkIyc2hCZ3NnQTBFUVNVRUFJQVpCRjBrYlJRUkFRUUJCa0FoQmhBSkJEaEFBQUFzZ0FDQURJQVpCQkhScVFRSjBhaWdDWUNFRUlBRkJBRFlDRUNBQklBUTJBaFFnQkFSQUlBUWdBVFlDRUFzZ0FDQURJQVpCQkhScVFRSjBhaUFCTmdKZ0lBQWdBQ2dDQUVFQklBWjBjallDQUNBQUlBWkJBblJxSWdBZ0FDZ0NCRUVCSUFOMGNqWUNCQXZSQVFFQ2Z5QUNRUTl4UlVFQUlBRkJEM0ZGUVFBZ0FTQUNUUnNiUlFSQVFRQkJrQWhCZ2dOQkJSQUFBQXNnQUNnQ29Bd2lBd1JBSUFFZ0EwRVFha2tFUUVFQVFaQUlRWXdEUVJBUUFBQUxJQU1nQVVFUWEwWUVRQUovSUFNb0FnQWhCQ0FCUVJCckN5RUJDd1VnQVNBQVFhUU1ha2tFUUVFQVFaQUlRWmdEUVFVUUFBQUxDeUFDSUFGcklnSkJNRWtFUUE4TElBRWdCRUVDY1NBQ1FTQnJRUUZ5Y2pZQ0FDQUJRUUEyQWhBZ0FVRUFOZ0lVSUFFZ0FtcEJFR3NpQWtFQ05nSUFJQUFnQWpZQ29Bd2dBQ0FCRUFJTG5nRUJBMzhqQUNJQ1JRUkFRUUUvQUNJQVNnUi9RUUVnQUd0QUFFRUFTQVZCQUFzRVFBQUxRY0FKSVFKQndBbEJBRFlDQUVIZ0ZVRUFOZ0lBQTBBZ0FVRVhTUVJBSUFGQkFuUkJ3QWxxUVFBMkFnUkJBQ0VBQTBBZ0FFRVFTUVJBSUFBZ0FVRUVkR3BCQW5SQndBbHFRUUEyQW1BZ0FFRUJhaUVBREFFTEN5QUJRUUZxSVFFTUFRc0xRY0FKUWZBVlB3QkJFSFFRQTBIQUNTUUFDeUFDQzk4QkFRRi9JQUZCZ0FKSkJFQWdBVUVFZGlFQkJRSi9JQUZCK1AvLy93RkpCRUFnQVVFQlFSc2dBV2RyZEdwQkFXc2hBUXNnQVF0Qkh5QUJaMnNpQWtFRWEzWkJFSE1oQVNBQ1FRZHJJUUlMSUFGQkVFbEJBQ0FDUVJkSkcwVUVRRUVBUVpBSVFkSUNRUTRRQUFBTElBQWdBa0VDZEdvb0FnUkJmeUFCZEhFaUFRUi9JQUFnQVdnZ0FrRUVkR3BCQW5ScUtBSmdCU0FBS0FJQVFYOGdBa0VCYW5SeElnRUVmeUFBSUFGb0lnRkJBblJxS0FJRUlnSkZCRUJCQUVHUUNFSGZBa0VTRUFBQUN5QUFJQUpvSUFGQkJIUnFRUUowYWlnQ1lBVkJBQXNMQzRjQkFRSi9JQUVvQWdBaEF5QUNRUTl4QkVCQkFFR1FDRUh0QWtFT0VBQUFDeUFEUVh4eElBSnJJZ1JCSUU4RVFDQUJJQUlnQTBFQ2NYSTJBZ0FnQWlBQlFSQnFhaUlCSUFSQkVHdEJBWEkyQWdBZ0FDQUJFQUlGSUFFZ0EwRitjVFlDQUNBQlFSQnFJZ0FnQVNnQ0FFRjhjV29nQUNBQktBSUFRWHh4YWlnQ0FFRjljVFlDQUFzTHFnSUJBMzhqQVFSQVFRQkJrQWhCOUFOQkRoQUFBQXNnQVNJRFFmRC8vLzhEVHdSQVFjQUlRWkFJUWMwRFFSNFFBQUFMSUFBZ0EwRVBha0Z3Y1NJQlFSQWdBVUVRU3hzaUFSQUZJZ1JGQkVCQkFTUUJRUUFrQVNBQUlBRVFCU0lFUlFSQUlBRkIrUC8vL3dGSkJIOGdBVUVCUVJzZ0FXZHJkRUVCYTJvRklBRUxRUkEvQUNJRVFSQjBRUkJySUFBb0FxQU1SM1JxUWYvL0EycEJnSUI4Y1VFUWRpRUZJQVFnQlNBRUlBVktHMEFBUVFCSUJFQWdCVUFBUVFCSUJFQUFDd3NnQUNBRVFSQjBQd0JCRUhRUUF5QUFJQUVRQlNJRVJRUkFRUUJCa0FoQmdBUkJGQkFBQUFzTEN5QUVLQUlBUVh4eElBRkpCRUJCQUVHUUNFR0lCRUVPRUFBQUN5QUVRUUEyQWdRZ0JDQUNOZ0lJSUFRZ0F6WUNEQ0FBSUFRUUFTQUFJQVFnQVJBR0lBUUxEUUFRQkNBQUlBRVFCMEVRYWd0aEFRSi9JQUJCdkFsTEJFQWdBRUVRYXlJQktBSUVJZ0pCZ0lDQWdIOXhJQUpCQVdwQmdJQ0FnSDl4UndSQVFRQkJnQWxCN1FCQkF4QUFBQXNnQVNBQ1FRRnFOZ0lFSUFFb0FnQkJBWEVFUUVFQVFZQUpRZkFBUVE0UUFBQUxDeUFBQ3hNQUlBQkJ2QWxMQkVBZ0FFRVFheENSQVFzTGp3SUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFTWRRNE9BQUVCQVFJQ0FnSURBd1FFQlFZSEN5UDlBUVJBSS80QkJFQWdBRUdBQWtnTkNTQUFRWUFTU0VFQUlBQkIvd05LR3cwSkJVRUFJQUJCZ0FKSUkvNEJHdzBKQ3dzTElBQkJnSzNSQUdvUEN5QUFRWUNBQVdzaEFTQUJRUUFqN3dFaUFFVWo5d0ViQkg5QkFRVWdBQXRCRG5ScVFZQ3QwUUJxRHdzZ0FFR0FrSDVxSS80QkJIOUJ6LzRERUFzdEFBQkJBWEVGUVFBTFFRMTBhZzhMSUFBajhBRkJEWFJxUVlEWnhnQnFEd3NnQUVHQWtINXFEd3NnQUVFQkkvNEJCSDlCOFA0REVBc3RBQUJCQjNFRlFRQUxJZ0VnQVVFQlNSdEJESFJxUVlEd2ZXb1BDeUFBUVlCUWFnOExJQUJCZ0puUkFHb0x3d0VBUVFBay93RkJBQ1NBQWtFQUpJRUNRUUFrZ2dKQkFDU0RBa0VBSklRQ1FRQWtoUUpCQUNTR0FrRUFKSWNDUVFBa2lBSkJBQ1NKQWtFQUpJb0NRUUFraXdKQkFDU01Ba0VBSkkwQ1FRQWtqZ0lqL1FFRVFBOExJLzRCQkVCQkVTU0FBa0dBQVNTSEFrRUFKSUVDUVFBa2dnSkIvd0VrZ3dKQjFnQWtoQUpCQUNTRkFrRU5KSVlDQlVFQkpJQUNRYkFCSkljQ1FRQWtnUUpCRXlTQ0FrRUFKSU1DUWRnQkpJUUNRUUVraFFKQnpRQWtoZ0lMUVlBQ0pJa0NRZjcvQXlTSUFndWhDQUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBT0RRQUJBZ01FQlFZSENBa0tDd3dOQzBIeTVjc0hKRHRCb01HQ0JTUThRZGl3NFFJa1BVR0lrQ0FrUGtIeTVjc0hKRDlCb01HQ0JTUkFRZGl3NFFJa1FVR0lrQ0FrUWtIeTVjc0hKRU5Cb01HQ0JTUkVRZGl3NFFJa1JVR0lrQ0FrUmd3TUMwSC8vLzhISkR0QjQ5citCeVE4UVlEaWtBUWtQVUVBSkQ1Qi8vLy9CeVEvUWVQYS9nY2tRRUdBNHBBRUpFRkJBQ1JDUWYvLy93Y2tRMEhqMnY0SEpFUkJnT0tRQkNSRlFRQWtSZ3dMQzBILy8vOEhKRHRCaEluK0J5UThRYnIwMEFRa1BVRUFKRDVCLy8vL0J5US9RYkgrN3dNa1FFR0FpQUlrUVVFQUpFSkIvLy8vQnlSRFFmL0xqZ01rUkVIL0FTUkZRUUFrUmd3S0MwSEZ6ZjhISkR0QmhMbTZCaVE4UWFuV2tRUWtQVUdJNHVnQ0pENUIvLy8vQnlRL1FlUGEvZ2NrUUVHQTRwQUVKRUZCQUNSQ1FmLy8vd2NrUTBIajJ2NEhKRVJCZ09LUUJDUkZRUUFrUmd3SkMwSC8vLzhISkR0QmdQN0xBaVE4UVlDRS9RY2tQVUVBSkQ1Qi8vLy9CeVEvUVlEK3l3SWtRRUdBaFAwSEpFRkJBQ1JDUWYvLy93Y2tRMEdBL3NzQ0pFUkJnSVQ5QnlSRlFRQWtSZ3dJQzBILy8vOEhKRHRCc2Y3dkF5UThRY1hIQVNROVFRQWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSkIvLy8vQnlSRFFZU0ovZ2NrUkVHNjlOQUVKRVZCQUNSR0RBY0xRUUFrTzBHRWlRSWtQRUdBdlA4SEpEMUIvLy8vQnlRK1FRQWtQMEdFaVFJa1FFR0F2UDhISkVGQi8vLy9CeVJDUVFBa1EwR0VpUUlrUkVHQXZQOEhKRVZCLy8vL0J5UkdEQVlMUWFYLy93Y2tPMEdVcWY0SEpEeEIvNm5TQkNROVFRQWtQa0dsLy84SEpEOUJsS24rQnlSQVFmK3AwZ1FrUVVFQUpFSkJwZi8vQnlSRFFaU3AvZ2NrUkVIL3FkSUVKRVZCQUNSR0RBVUxRZi8vL3dja08wR0EvdjhISkR4QmdJRDhCeVE5UVFBa1BrSC8vLzhISkQ5QmdQNy9CeVJBUVlDQS9BY2tRVUVBSkVKQi8vLy9CeVJEUVlEKy93Y2tSRUdBZ1B3SEpFVkJBQ1JHREFRTFFmLy8vd2NrTzBHQS92OEhKRHhCZ0pUdEF5UTlRUUFrUGtILy8vOEhKRDlCLzh1T0F5UkFRZjhCSkVGQkFDUkNRZi8vL3dja1EwR3gvdThESkVSQmdJZ0NKRVZCQUNSR0RBTUxRZi8vL3dja08wSC95NDRESkR4Qi93RWtQVUVBSkQ1Qi8vLy9CeVEvUVlTSi9nY2tRRUc2OU5BRUpFRkJBQ1JDUWYvLy93Y2tRMEd4L3U4REpFUkJnSWdDSkVWQkFDUkdEQUlMUWYvLy93Y2tPMEhlbWJJRUpEeEJqS1hKQWlROVFRQWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSkIvLy8vQnlSRFFlUGEvZ2NrUkVHQTRwQUVKRVZCQUNSR0RBRUxRZi8vL3dja08wR2x5NVlGSkR4QjBxVEpBaVE5UVFBa1BrSC8vLzhISkQ5QnBjdVdCU1JBUWRLa3lRSWtRVUVBSkVKQi8vLy9CeVJEUWFYTGxnVWtSRUhTcE1rQ0pFVkJBQ1JHQ3d2YUNBQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR0lBVWNFUUNBQVFlRUFSZzBCSUFCQkZFWU5BaUFBUWNZQVJnMERJQUJCMlFCR0RRUWdBRUhHQVVZTkJDQUFRWVlCUmcwRklBQkJxQUZHRFFVZ0FFRy9BVVlOQmlBQVFjNEJSZzBHSUFCQjBRRkdEUVlnQUVId0FVWU5CaUFBUVNkR0RRY2dBRUhKQUVZTkJ5QUFRZHdBUmcwSElBQkJzd0ZHRFFjZ0FFSEpBVVlOQ0NBQVFmQUFSZzBKSUFCQnhnQkdEUW9nQUVIVEFVWU5Dd3dNQzBIL3VaWUZKRHRCZ1A3L0J5UThRWURHQVNROVFRQWtQa0gvdVpZRkpEOUJnUDcvQnlSQVFZREdBU1JCUVFBa1FrSC91WllGSkVOQmdQNy9CeVJFUVlER0FTUkZRUUFrUmd3TEMwSC8vLzhISkR0Qi84dU9BeVE4UWY4QkpEMUJBQ1ErUWYvLy93Y2tQMEdFaWY0SEpFQkJ1dlRRQkNSQlFRQWtRa0gvLy84SEpFTkIvOHVPQXlSRVFmOEJKRVZCQUNSR0RBb0xRZi8vL3dja08wR0VpZjRISkR4QnV2VFFCQ1E5UVFBa1BrSC8vLzhISkQ5QnNmN3ZBeVJBUVlDSUFpUkJRUUFrUWtILy8vOEhKRU5CaEluK0J5UkVRYnIwMEFRa1JVRUFKRVlNQ1F0Qi8rdldCU1E3UVpULy93Y2tQRUhDdExVRkpEMUJBQ1ErUVFBa1AwSC8vLzhISkVCQmhJbitCeVJCUWJyMDBBUWtRa0VBSkVOQi8vLy9CeVJFUVlTSi9nY2tSVUc2OU5BRUpFWU1DQXRCLy8vL0J5UTdRWVRidGdVa1BFSDc1b2tDSkQxQkFDUStRZi8vL3dja1AwR0E1djBISkVCQmdJVFJCQ1JCUVFBa1FrSC8vLzhISkVOQi8vdnFBaVJFUVlDQS9BY2tSVUgvQVNSR0RBY0xRWnovL3dja08wSC82OUlFSkR4Qjg2aU9BeVE5UWJyMEFDUStRY0tLL3dja1AwR0FyUDhISkVCQmdQVFFCQ1JCUVlDQXFBSWtRa0gvLy84SEpFTkJoSW4rQnlSRVFicjAwQVFrUlVFQUpFWU1CZ3RCZ1A2dkF5UTdRZi8vL3dja1BFSEtwUDBISkQxQkFDUStRZi8vL3dja1AwSC8vLzhISkVCQi84dU9BeVJCUWY4QkpFSkIvLy8vQnlSRFFlUGEvZ2NrUkVHQTRwQUVKRVZCQUNSR0RBVUxRZis1bGdVa08wR0EvdjhISkR4QmdNWUJKRDFCQUNRK1FkTEcvUWNrUDBHQWdOZ0dKRUJCZ0lDTUF5UkJRUUFrUWtIL0FTUkRRZi8vL3dja1JFSDcvdjhISkVWQi80a0NKRVlNQkF0Qnp2Ly9CeVE3UWUvZmp3TWtQRUd4aVBJRUpEMUIyclRwQWlRK1FmLy8vd2NrUDBHQTV2MEhKRUJCZ0lUUkJDUkJRUUFrUWtILy8vOEhKRU5CLzh1T0F5UkVRZjhCSkVWQkFDUkdEQU1MUWYvLy93Y2tPMEdFaWY0SEpEeEJ1dlRRQkNROVFRQWtQa0gvLy84SEpEOUJnUDRESkVCQmdJakdBU1JCUVlDVUFTUkNRZi8vL3dja1EwSC95NDRESkVSQi93RWtSVUVBSkVZTUFndEIvLy8vQnlRN1FmL0xqZ01rUEVIL0FTUTlRUUFrUGtHQS92OEhKRDlCZ0lEOEJ5UkFRWUNBakFNa1FVRUFKRUpCLy8vL0J5UkRRYkgrN3dNa1JFR0FpQUlrUlVFQUpFWU1BUXRCLy8vL0J5UTdRWVRidGdVa1BFSDc1b2tDSkQxQkFDUStRZi8vL3dja1AwSGoydjRISkVCQjQ5citCeVJCUVFBa1FrSC8vLzhISkVOQi84dU9BeVJFUWY4QkpFVkJBQ1JHQ3d2UkFnRUNmMEVBSk9nQlFRQWs2UUZCQUNUcUFVRUFKT3NCUVFBazdBRkJBQ1R0QVVFQUpPNEJRWkFCSk9vQkkvNEJCRUJCd2Y0REVBdEJnUUU2QUFCQnhQNERFQXRCa0FFNkFBQkJ4LzRERUF0Qi9BRTZBQUFGUWNIK0F4QUxRWVVCT2dBQVFjYitBeEFMUWY4Qk9nQUFRY2YrQXhBTFFmd0JPZ0FBUWNqK0F4QUxRZjhCT2dBQVFjbitBeEFMUWY4Qk9nQUFDMEdRQVNUcUFVSEEvZ01RQzBHUkFUb0FBRUhQL2dNUUMwRUFPZ0FBUWZEK0F4QUxRUUU2QUFBai9RRUVRQ1ArQVFSQVFRQWs2Z0ZCd1A0REVBdEJBRG9BQUVIQi9nTVFDMEdBQVRvQUFFSEUvZ01RQzBFQU9nQUFCVUVBSk9vQlFjRCtBeEFMUVFBNkFBQkJ3ZjRERUF0QmhBRTZBQUFMQzBFQUVBMENRQ1ArQVEwQVFRQWovUUVqL2dFYkRRQkJ0QUloQUFOQUlBQkJ3d0pNQkVBZ0FTQUFFQXN0QUFCcUlRRWdBRUVCYWlFQURBRUxDeUFCUWY4QmNSQU9Dd3Z4QkFCQkFDU2tBVUVBSktVQlFRQWtwZ0ZCQVNTbkFVRUJKS2dCUVFFa3FRRkJBU1NxQVVFQkpLc0JRUUVrckFGQkFTU3RBVUVCSks0QlFRRWtyd0ZCQUNTd0FVRUFKTElCUVFBa3NRRkJBQ1N6QVVHUS9nTVFDMEdBQVRvQUFFR1IvZ01RQzBHL0FUb0FBRUdTL2dNUUMwSHpBVG9BQUVHVC9nTVFDMEhCQVRvQUFFR1UvZ01RQzBHL0FUb0FBQ1A5QVFSQVFaSCtBeEFMUVQ4NkFBQkJrdjRERUF0QkFEb0FBRUdUL2dNUUMwRUFPZ0FBUVpUK0F4QUxRYmdCT2dBQUMwR1YvZ01RQzBIL0FUb0FBRUdXL2dNUUMwRS9PZ0FBUVpmK0F4QUxRUUE2QUFCQm1QNERFQXRCQURvQUFFR1ovZ01RQzBHNEFUb0FBRUdhL2dNUUMwSC9BRG9BQUVHYi9nTVFDMEgvQVRvQUFFR2MvZ01RQzBHZkFUb0FBRUdkL2dNUUMwRUFPZ0FBUVo3K0F4QUxRYmdCT2dBQVFRRWtnd0ZCbi80REVBdEIvd0U2QUFCQm9QNERFQXRCL3dFNkFBQkJvZjRERUF0QkFEb0FBRUdpL2dNUUMwRUFPZ0FBUWFQK0F4QUxRYjhCT2dBQVFhVCtBeEFMUWZjQU9nQUFRUWNrcFFGQkJ5U21BVUdsL2dNUUMwSHpBVG9BQUVFQkpLb0JRUUVrcVFGQkFTU29BVUVCSktjQlFRQWtyZ0ZCQUNTdEFVRUJKS3dCUVFFa3F3RkJwdjRERUF0QjhRRTZBQUJCQVNTdkFTUDlBUVJBUWFUK0F4QUxRUUE2QUFCQkFDU2xBVUVBSktZQlFhWCtBeEFMUVFBNkFBQkJBQ1NxQVVFQUpLa0JRUUFrcUFGQkFDU25BVUVBSks0QlFRQWtyUUZCQUNTc0FVRUFKS3NCUWFiK0F4QUxRZkFBT2dBQVFRQWtyd0VMUVE4a2x3RkJEeVNZQVVFUEpKa0JRUThrbWdGQkFDU2JBVUVBSkp3QlFRQWtuUUZCQUNTZUFVSC9BQ1NmQVVIL0FDU2dBVUVCSktFQlFRRWtvZ0ZCQUNTakFRdlVCZ0VCZjBIREFoQUxMUUFBSWdCQndBRkdCSDlCQVFVZ0FFR0FBVVpCQUNNeUd3c0VRRUVCSlA0QkJVRUFKUDRCQzBFQUpKVUNRWUNvMXJrSEpJOENRUUFra0FKQkFDU1JBa0dBcU5hNUJ5U1NBa0VBSkpNQ1FRQWtsQUlqTVFSQVFRRWsvUUVGUVFBay9RRUxFQXhCQUNUeEFVRUJKUElCUWNjQ0VBc3RBQUFpQUVVazh3RWdBRUVEVFVFQUlBQkJBVThiSlBRQklBQkJCazFCQUNBQVFRVlBHeVQxQVNBQVFSTk5RUUFnQUVFUFR4c2s5Z0VnQUVFZVRVRUFJQUJCR1U4YkpQY0JRUUVrN3dGQkFDVHdBVUhQL2dNUUMwRUFPZ0FBUWZEK0F4QUxRUUU2QUFCQjBmNERFQXRCL3dFNkFBQkIwdjRERUF0Qi93RTZBQUJCMC80REVBdEIvd0U2QUFCQjFQNERFQXRCL3dFNkFBQkIxZjRERUF0Qi93RTZBQUFRRHlQK0FRUkFRZWorQXhBTFFjQUJPZ0FBUWVuK0F4QUxRZjhCT2dBQVFlcitBeEFMUWNFQk9nQUFRZXYrQXhBTFFRMDZBQUFGUWVqK0F4QUxRZjhCT2dBQVFlbitBeEFMUWY4Qk9nQUFRZXIrQXhBTFFmOEJPZ0FBUWV2K0F4QUxRZjhCT2dBQUN5UCtBVUVBSS8wQkd3UkFRZW4rQXhBTFFTQTZBQUJCNi80REVBdEJpZ0U2QUFBTEVCQkJBQ1MzQVVFQUpMZ0JRUUFrdVFGQkFDUzZBVUVBSkxzQlFRQWt0Z0ZCLy84REVBdEJBRG9BQUVFQkpMMEJRUUFrdmdGQkFDUy9BVUVBSk1BQlFRQWt3UUZCNFFFa3ZBRkJqLzRERUF0QjRRRTZBQUJCQUNUQ0FVRUFKTU1CUVFBa3hBRkJBQ1RJQVVFQUpNa0JRUUFreWdGQkFDVEZBVUVBSk1ZQkkvNEJCRUJCaFA0REVBdEJIam9BQUVHZ1BTVERBUVZCaFA0REVBdEJxd0U2QUFCQnpOY0NKTU1CQzBHSC9nTVFDMEg0QVRvQUFFSDRBU1RLQVNQOUFRUkFJLzRCUlFSQVFZVCtBeEFMUVFBNkFBQkJCQ1REQVFzTFFRQWt5d0ZCQUNUTUFTUCtBUVJBUVlMK0F4QUxRZndBT2dBQVFRQWt6UUVGUVlMK0F4QUxRZjRBT2dBQVFRRWt6UUVMUVFBa3pnRWovZ0VFUUVIdy9nTVFDMEg0QVRvQUFFSFAvZ01RQzBIK0FUb0FBRUhOL2dNUUMwSCtBRG9BQUVHQS9nTVFDMEhQQVRvQUFFR1AvZ01RQzBIaEFUb0FBRUhzL2dNUUMwSCtBVG9BQUVIMS9nTVFDMEdQQVRvQUFBVkI4UDRERUF0Qi93RTZBQUJCei80REVBdEIvd0U2QUFCQnpmNERFQXRCL3dFNkFBQkJnUDRERUF0Qnp3RTZBQUJCai80REVBdEI0UUU2QUFBTEMwb0FJQUJCQUVva01TQUJRUUJLSkRJZ0FrRUFTaVF6SUFOQkFFb2tOQ0FFUVFCS0pEVWdCVUVBU2lRMklBWkJBRW9rTnlBSFFRQktKRGdnQ0VFQVNpUTVJQWxCQUVva09oQVJDd1VBSTVVQ0M1a0NBRUdzQ2lPbEFUWUNBRUd3Q2lPbUFUWUNBRUcwQ2lPbkFVRUFSem9BQUVHMUNpT29BVUVBUnpvQUFFRzJDaU9wQVVFQVJ6b0FBRUczQ2lPcUFVRUFSem9BQUVHNENpT3JBVUVBUnpvQUFFRzVDaU9zQVVFQVJ6b0FBRUc2Q2lPdEFVRUFSem9BQUVHN0NpT3VBVUVBUnpvQUFFRzhDaU92QVVFQVJ6b0FBRUc5Q2lPd0FUWUNBRUhDQ2lPeEFUb0FBRUhEQ2lPeUFUb0FBRUhFQ2lPWEFUb0FBRUhGQ2lPWUFUb0FBRUhHQ2lPWkFUb0FBRUhIQ2lPYUFUb0FBRUhJQ2lPYkFVRUFSem9BQUVISkNpT2NBVUVBUnpvQUFFSEtDaU9kQVVFQVJ6b0FBRUhMQ2lPZUFVRUFSem9BQUVITUNpT2ZBVG9BQUVITkNpT2dBVG9BQUVIT0NpT2hBVUVBUnpvQUFFSFBDaU9pQVVFQVJ6b0FBQXZxQVFCQjNnb2pTVFlDQUVIaUNpTktPZ0FBUWVNS0kwdEJBRWM2QUFCQjVBb2pURG9BQUVIbENpTk5PZ0FBUWVjS0kwNDdBUUJCNkFvalR6b0FBRUhwQ2lOUVFRQkhPZ0FBUWVvS0kxRTZBQUJCNndvalVqb0FBRUhzQ2lOVFFRQkhPZ0FBUWUwS0kxUTZBQUJCN2dvalZVRUFSem9BQUVIdkNpTldRUUJIT2dBQVFmQUtJMWMyQWdCQjlBb2pXRFlDQUVINENpTlpOZ0lBUWZ3S0kxcEJBRWM2QUFCQi9Rb2pXellDQUVHQkN5TmNOZ0lBUVlVTEkxMDZBQUJCaGdzalhqb0FBRUdIQ3lOZlFRQkhPZ0FBUVlnTEkyQTJBZ0JCakFzallUc0JBRUdQQ3lOaVFRQkhPZ0FBQy9nSkFFR0FDQ09BQWpvQUFFR0JDQ09CQWpvQUFFR0NDQ09DQWpvQUFFR0RDQ09EQWpvQUFFR0VDQ09FQWpvQUFFR0ZDQ09GQWpvQUFFR0dDQ09HQWpvQUFFR0hDQ09IQWpvQUFFR0lDQ09JQWpzQkFFR0tDQ09KQWpzQkFFR01DQ09LQWpZQ0FFR1JDQ09MQWtFQVJ6b0FBRUdTQ0NPTUFrRUFSem9BQUVHVENDT05Ba0VBUnpvQUFFR1VDQ09PQWtFQVJ6b0FBRUdWQ0NQOUFVRUFSem9BQUVHV0NDUCtBVUVBUnpvQUFFR1hDQ1AvQVVFQVJ6b0FBRUd5Q0NQcEFUWUNBRUcyQ0NQcUFUb0FBRUczQ0NQckFUb0FBRUc0Q0NQc0FUb0FBRUc1Q0NQdEFUb0FBRUc2Q0NQdUFUb0FBRUc3Q0NQZUFUb0FBRUc4Q0NQZkFUb0FBRUc5Q0NQZ0FVRUFSem9BQUVHK0NDUGhBVUVBUnpvQUFFRy9DQ1BpQVVFQVJ6b0FBRUhBQ0NQakFVRUFSem9BQUVIQkNDUGtBVUVBUnpvQUFFSENDQ1BsQVVFQVJ6b0FBRUhEQ0NQbUFVRUFSem9BQUVIRUNDUG5BVUVBUnpvQUFFSGtDQ08wQVVFQVJ6b0FBRUhsQ0NPMUFVRUFSem9BQUVIMENDTzJBVG9BQUVIMUNDTzNBVUVBUnpvQUFFSDJDQ080QVVFQVJ6b0FBRUgzQ0NPNUFVRUFSem9BQUVINENDTzZBVUVBUnpvQUFFSDVDQ083QVVFQVJ6b0FBRUdFQ1NPOEFUb0FBRUdGQ1NPOUFVRUFSem9BQUVHR0NTTytBVUVBUnpvQUFFR0hDU08vQVVFQVJ6b0FBRUdJQ1NQQUFVRUFSem9BQUVHSkNTUEJBVUVBUnpvQUFFR1dDU1BYQVRZQ0FFR1hDU1BZQVVFQVJ6b0FBRUdZQ1NQWkFVRUFSem9BQUVISUNTUHZBVHNCQUVIS0NTUHdBVHNCQUVITUNTUHhBVUVBUnpvQUFFSE5DU1B5QVVFQVJ6b0FBRUhPQ1NQekFVRUFSem9BQUVIUENTUDBBVUVBUnpvQUFFSFFDU1AxQVVFQVJ6b0FBRUhSQ1NQMkFVRUFSem9BQUVIU0NTUDNBVUVBUnpvQUFFSFRDU1A0QVRZQ0FFSFhDU1A1QVVFQVJ6b0FBRUhZQ1NQNkFUWUNBRUhjQ1NQN0FUWUNBRUhnQ1NQOEFUWUNBRUg2Q1NQQ0FUWUNBRUgrQ1NQREFUWUNBRUdDQ2lQRUFUWUNBRUdHQ2lQRkFVRUFSem9BQUVHSENpUEdBVUVBUnpvQUFFR0lDaVBIQVRZQ0FFR01DaVBJQVRZQ0FFR1FDaVBKQVVFQVJ6b0FBRUdSQ2lQS0FUWUNBQkFVRUJWQmtBc2pZellDQUVHWEN5TmtPZ0FBUVpnTEkyVTdBUUJCbWdzalpqb0FBRUdiQ3lOblFRQkhPZ0FBUVp3TEkyZzZBQUJCblFzamFUb0FBRUdlQ3lOcVFRQkhPZ0FBUVo4TEkyczZBQUJCb0FzamJFRUFSem9BQUVHaEN5TnRRUUJIT2dBQVFhSUxJMjQyQWdCQnBnc2piellDQUVHcUN5TndOZ0lBUWE0TEkzRkJBRWM2QUFCQnJ3c2pjallDQUVHekN5TnpOZ0lBUWJjTEkzUTZBQUJCdUFzamRUb0FBRUhDQ3lOMk5nSUFRY29MSTNjN0FRQkJ6QXNqZURvQUFFSE9DeU41T2dBQVFjOExJM3BCQUVjNkFBQkIwQXNqZXpvQUFFSFJDeU44UVFCSE9nQUFRZElMSTMxQkFFYzZBQUJCMHdzamZqWUNBRUhYQ3lOL05nSUFRZHNMSTRBQk5nSUFRZU1MSTRFQk5nSUFRZWNMSTRJQk9nQUFRZWdMSTRNQlFRQkhPZ0FBUWVrTEk0UUJOZ0lBUWZRTEk0VUJOZ0lBUWZnTEk0WUJPd0VBUWZvTEk0Y0JPZ0FBUWZzTEk0Z0JRUUJIT2dBQVFmd0xJNGtCT2dBQVFmMExJNG9CT2dBQVFmNExJNHNCUVFCSE9nQUFRZjhMSTR3Qk9nQUFRWUVNSTQwQlFRQkhPZ0FBUVlNTUk0NEJRUUJIT2dBQVFZUU1JNDhCUVFCSE9nQUFRWWtNSTVBQk5nSUFRWTBNSTVFQk5nSUFRWkVNSTVJQlFRQkhPZ0FBUVpJTUk1TUJOZ0lBUVpZTUk1UUJOZ0lBUVpvTUk1WUJPd0VBUVFBa2xRSUxCd0JCQUNTekFRdWVBZ0JCckFvb0FnQWtwUUZCc0Fvb0FnQWtwZ0ZCdEFvdEFBQkJBRXNrcHdGQnRRb3RBQUJCQUVza3FBRkJ0Z290QUFCQkFFc2txUUZCdHdvdEFBQkJBRXNrcWdGQnVBb3RBQUJCQUVza3F3RkJ1UW90QUFCQkFFc2tyQUZCdWdvdEFBQkJBRXNrclFGQnV3b3RBQUJCQUVza3JnRkJ2QW90QUFCQkFFc2tyd0ZCdlFvb0FnQWtzQUZCd2dvdEFBQWtzUUZCd3dvdEFBQWtzZ0ZCeEFvdEFBQWtsd0ZCeFFvdEFBQWttQUZCeGdvdEFBQWttUUZCeHdvdEFBQWttZ0ZCeUFvdEFBQkJBRXNrbXdGQnlRb3RBQUJCQUVza25BRkJ5Z290QUFCQkFFc2tuUUZCeXdvdEFBQkJBRXNrbmdGQnpBb3RBQUFrbndGQnpRb3RBQUFrb0FGQnpnb3RBQUJCQUVza29RRkJ6d290QUFCQkFFc2tvZ0ZCQUNTekFRdndBUUFqU1VFeWJFR0FDR29vQWdBa1NVSGlDaTBBQUNSS1FlTUtMUUFBUVFCTEpFdEI1QW90QUFBa1RFSGxDaTBBQUNSTlFlY0tMd0VBSkU1QjZBb3RBQUFrVDBIcENpMEFBRUVBU3lSUVFlb0tMUUFBSkZGQjZ3b3RBQUFrVWtIc0NpMEFBRUVBU3lSVFFlMEtMUUFBSkZSQjdnb3RBQUJCQUVza1ZVSHZDaTBBQUVFQVN5UldRZkFLS0FJQUpGZEI5QW9vQWdBa1dFSDRDaWdDQUNSWlFmd0tMUUFBUVFCTEpGcEIvUW9vQWdBa1cwR0JDeWdDQUNSY1FZVUxMUUFBSkYxQmhnc3RBQUFrWGtHSEN5MEFBRUVBU3lSZlFZZ0xMUUFBSkdCQmpBc3RBQUFrWVVHUEN5MEFBRUVBU3lSaUM2OEJBQ05qUVRKc1FZQUlhaWdDQUNSalFaY0xMUUFBSkdSQm1Bc3ZBUUFrWlVHYUN5MEFBQ1JtUVpzTExRQUFRUUJMSkdkQm5Bc3RBQUFrYUVHZEN5MEFBQ1JwUVo0TExRQUFRUUJMSkdwQm53c3RBQUFrYTBHZ0N5MEFBRUVBU3lSc1FhRUxMUUFBUVFCTEpHMUJvZ3NvQWdBa2JrR21DeWdDQUNSdlFhb0xLQUlBSkhCQnJnc3RBQUJCQUVza2NVR3ZDeWdDQUNSeVFiTUxLQUlBSkhOQnR3c3RBQUFrZEVHNEN5MEFBQ1IxQzQwSkFFR0FDQzBBQUNTQUFrR0JDQzBBQUNTQkFrR0NDQzBBQUNTQ0FrR0RDQzBBQUNTREFrR0VDQzBBQUNTRUFrR0ZDQzBBQUNTRkFrR0dDQzBBQUNTR0FrR0hDQzBBQUNTSEFrR0lDQzhCQUNTSUFrR0tDQzhCQUNTSkFrR01DQ2dDQUNTS0FrR1JDQzBBQUVFQVN5U0xBa0dTQ0MwQUFFRUFTeVNNQWtHVENDMEFBRUVBU3lTTkFrR1VDQzBBQUVFQVN5U09Ba0dWQ0MwQUFFRUFTeVQ5QVVHV0NDMEFBRUVBU3lUK0FVR1hDQzBBQUVFQVN5VC9BVUd5Q0NnQ0FDVHBBU1BxQVVFeWJFR0VDR290QUFBazZnRkJ0d2d0QUFBazZ3RkJ1QWd0QUFBazdBRkJ1UWd0QUFBazdRRkJ1Z2d0QUFBazdnRkJ1d2d0QUFBazNnRkJ2QWd0QUFBazN3RkJ2UWd0QUFCQkFFc2s0QUZCdmdndEFBQkJBRXNrNFFGQnZ3Z3RBQUJCQUVzazRnRkJ3QWd0QUFCQkFFc2s0d0ZCd1FndEFBQkJBRXNrNUFGQndnZ3RBQUJCQUVzazVRRkJ3d2d0QUFCQkFFc2s1Z0ZCeEFndEFBQkJBRXNrNXdGQjVBZ3RBQUJCQUVza3RBRkI1UWd0QUFCQkFFc2t0UUZCOUFndEFBQWt0Z0ZCOVFndEFBQkJBRXNrdHdGQjlnZ3RBQUJCQUVza3VBRkI5d2d0QUFCQkFFc2t1UUZCK0FndEFBQkJBRXNrdWdGQitRZ3RBQUJCQUVza3V3RkJoQWt0QUFBa3ZBRkJoUWt0QUFCQkFFc2t2UUZCaGdrdEFBQkJBRXNrdmdGQmh3a3RBQUJCQUVza3Z3RkJpQWt0QUFCQkFFc2t3QUZCaVFrdEFBQkJBRXNrd1FGQmxna29BZ0FrMXdGQmx3a3RBQUJCQUVzazJBRkJtQWt0QUFCQkFFc2syUUZCeUFrdkFRQWs3d0ZCeWdrdkFRQWs4QUZCekFrdEFBQkJBRXNrOFFGQnpRa3RBQUJCQUVzazhnRkJ6Z2t0QUFCQkFFc2s4d0ZCendrdEFBQkJBRXNrOUFGQjBBa3RBQUJCQUVzazlRRkIwUWt0QUFCQkFFc2s5Z0ZCMGdrdEFBQkJBRXNrOXdGQjB3a29BZ0FrK0FGQjF3a3RBQUJCQUVzaytRRkIyQWtvQWdBaytnRkIzQWtvQWdBayt3RkI0QWtvQWdBay9BRkIrZ2tvQWdBa3dnRkIvZ2tvQWdBa3d3RkJnZ29vQWdBa3hBRkJoZ290QUFCQkFFc2t4UUZCaHdvdEFBQkJBRXNreGdGQmlBb29BZ0FreHdGQmpBb29BZ0FreUFGQmtBb3RBQUJCQUVza3lRRkJrUW9vQWdBa3lnRVFHQkFaRUJvamRrRXliRUdBQ0dvb0FnQWtka0hLQ3k4QkFDUjNRY3dMTFFBQUpIaEJ6Z3N0QUFBa2VVSFBDeTBBQUVFQVN5UjZRZEFMTFFBQUpIdEIwUXN0QUFCQkFFc2tmRUhTQ3kwQUFFRUFTeVI5UWRNTEtBSUFKSDVCMXdzb0FnQWtmMEhiQ3lnQ0FDU0FBVUhqQ3lnQ0FDU0JBVUhuQ3lnQ0FDU0NBVUhvQ3kwQUFFRUFTeVNEQVVIcEN5Z0NBQ1NFQVNPRkFVRXliRUdBQ0dvb0FnQWtoUUZCK0FzdEFBQWtoZ0ZCK2dzdEFBQWtod0ZCK3dzdEFBQkJBRXNraUFGQi9Bc3RBQUFraVFGQi9Rc3RBQUFraWdGQi9nc3RBQUJCQUVza2l3RkIvd3N0QUFBa2pBRkJnUXd0QUFCQkFFc2tqUUZCZ3d3dEFBQkJBRXNramdGQmhBd3RBQUJCQUVza2p3RkJpUXdvQWdBa2tBRkJqUXdvQWdBa2tRRkJrUXd0QUFCQkFFc2trZ0ZCa2d3b0FnQWtrd0ZCbGd3b0FnQWtsQUZCbWd3dkFRQWtsZ0ZCQUNTVkFrR0FxTmE1QnlTUEFrRUFKSkFDUVFBa2tRSkJnS2pXdVFja2tnSkJBQ1NUQWtFQUpKUUNDd1VBSS80QkN3VUFJNUlDQ3dVQUk1TUNDd1VBSTVRQ0M1NENBUWQvSUFBalNDSUhSa0VBSUFRalIwWkJBQ0FBUVFoS1FRQWdBVUVBU2hzYkd3UkFJQU5CQVdzUUN5MEFBRUVnY1VFQVJ5RUlJQU1RQ3kwQUFFRWdjVUVBUnlFSkEwQWdCa0VJU0FSQUlBQkJCeUFHYXlBR0lBZ2dDVWNiSWdScUlnTkJvQUZNQkVBQ2Z5QURJQUZCb0FGc0lncHFJZ3RCQTJ3aUJrR0F5UVZxSWdNZ0F5MEFBRG9BQUNBR1FZSEpCV29nQXkwQUFUb0FBQ0FHUVlMSkJXb2dBeTBBQWpvQUFDQUxRWUNSQkdvZ0NpQUFRUUFnQkd0cmFrSDRrQVJxTFFBQUlnTkJBM0VpQmtFRWNpQUdJQU5CQkhFYk9nQUFJQVZCQVdvTElRVUxJQVJCQVdvaEJnd0JDd3NGSUFRa1J3c2dBQ0FIVGdSL0lBQkJDR29oQVNBQUlBSkJCM0VpQUVnRWZ5QUFJQUZxQlNBQkN3VWdCd3NrU0NBRkM2MEJBQ0FCRUFzdEFBQWdBRUVCZEhWQkEzRWhBQ0FCUWNqK0EwWUVRQ00vSVFFQ1FBSkFBa0FDUUNBQVFRRnJEZ01BQVFJREN5TkFJUUVNQWdzalFTRUJEQUVMSTBJaEFRc0ZJQUZCeWY0RFJnUkFJME1oQVFKQUFrQUNRQUpBSUFCQkFXc09Bd0FCQWdNTEkwUWhBUXdDQ3lORklRRU1BUXNqUmlFQkN3VWpPeUVCQWtBQ1FBSkFBa0FnQUVFQmF3NERBQUVDQXdzalBDRUJEQUlMSXowaEFRd0JDeU0rSVFFTEN3c2dBUXZnQXdFR2Z5QUNRUUZ4UVExMElnOGhEaUFPSUFFaUFrR0FrQUpHQkg4Z0FFR0FBV3NnQUVHQUFXb2dBRUdBQVhFYkJTQUFDMEVFZENBQ2FpQUZRUUYwYWlJQVFZQ1FmbXBxTFFBQUlSRWdEeUFBUVlHUWZtcHFMUUFBSVJJZ0F5RUFBMEFnQUNBRVRBUkFJQVlnQUNBRGEyb2lEeUFJU0FSQUFuOGdFa0VCUVFjZ0FHc2dBRUVCSUF0QklIRkZJQXRCQUVnYkd5SUNkSEVFZjBFQ0JVRUFDeUlCUVFGcUlBRWdFVUVCSUFKMGNSc2hCU1ArQVFSL1FRRWdERUVBVGlBTFFRQk9Hd1ZCQUFzRWZ5QUxRUWR4SVFFZ0RFRUFUaUlDQkg4Z0RFRUhjUVVnQVF0QkEzUWdCVUVCZEdvaUFVRUJha0UvY1NJT1FVQnJJQTRnQWh0QmdKQUVhaTBBQUVFSWRDQUJRVDl4SWdGQlFHc2dBU0FDRzBHQWtBUnFMUUFBY2lJQlFSOXhRUU4wSVE0Z0FVSGdCM0ZCQlhaQkEzUWhBaUFCUVlENEFYRkJDblpCQTNRRklBVkJ4LzRESUFvZ0NrRUFUQnNpQ2hBaElnRkJnSUQ4QjNGQkVIWWhEaUFCUVlEK0EzRkJDSFloQWlBQlFmOEJjUXNoQVNBSklBOGdCeUFJYkdwQkEyeHFJaEFnRGpvQUFDQVFJQUk2QUFFZ0VDQUJPZ0FDSUE4Z0IwR2dBV3hxUVlDUkJHb2dCVUVEY1NJQlFRUnlJQUVnQzBHQUFYRkJBQ0FMUVFCT0d4czZBQUFnRFVFQmFnc2hEUXNnQUVFQmFpRUFEQUVMQ3lBTkM5SUNBQ0FEUVFkeElRTWdCU0FGUVlDUUFrWUVmeUFHUVlBQmF5QUdRWUFCYWlBR1FZQUJjUnNGSUFZTFFRUjBhaUVGSUFVZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ05CZ0pCK2FpQUVRUWh4UVFCSElnVkJEWFJxTFFBQUlRWWdBQ0FCUWFBQmJHcEJBMnhCZ01rRmFpQUVRUWR4UVFOMElBTkJnWkIrYWlBRlFRRnhRUTEwYWkwQUFFRUJJQUpCQjNFaUFrRUhJQUpySUFSQklIRWJJZ04wY1FSL1FRSUZRUUFMSWdKQkFXb2dBaUFHUVFFZ0EzUnhHeUlEUVFGMGFpSUNRUUZxUVQ5eFFZQ1FCR290QUFCQkNIUWdBa0UvY1VHQWtBUnFMUUFBY2lJQ1FSOXhRUU4wT2dBQUlBQWdBVUdnQVd4cUlnQkJBMndpQVVHQnlRVnFJQUpCNEFkeFFRVjJRUU4wT2dBQUlBRkJnc2tGYWlBQ1FZRDRBWEZCQ25aQkEzUTZBQUFnQUVHQWtRUnFJQU5CQTNFaUFFRUVjaUFBSUFSQmdBRnhHem9BQUF2TEFRQWdCQ0FFUVlDUUFrWUVmeUFGUVlBQmF5QUZRWUFCYWlBRlFZQUJjUnNGSUFVTFFRUjBhaUFEUVFkeFFRRjBhaUlEUVlDUWZtb3RBQUFoQkNBQUlBRkJvQUZzYWlJRlFRTnNJZ0ZCZ01rRmFpQURRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSL1FRSUZRUUFMSWdCQkFXb2dBQ0FFUVFFZ0FuUnhHMEgvQVhFaUFrSEgvZ01RSVNJQVFZQ0EvQWR4UVJCMk9nQUFJQUZCZ2NrRmFpQUFRWUQrQTNGQkNIWTZBQUFnQVVHQ3lRVnFJQUE2QUFBZ0JVR0FrUVJxSUFKQkEzRTZBQUFMeHdJQkIzOGdBMEVEZFNFTEEwQWdCRUdnQVVnRVFDQUNJQXRCQlhScUFuOGdCQ0FGYWlJR1FZQUNUZ1JBSUFaQmdBSnJJUVlMSUFZTFFRTjFhaUlLUVlDUWZtb3RBQUFoQ0VFQUlRY2pPUVJBSUFRZ0FDQUdJQW9nQ0JBZ0lnbEJBRW9FUUFKL1FRRWhCeUFFSUFsQkFXdHFDeUVFQ3dzZ0IwVkJBQ000R3dSQVFRQWhDU0FEUVFkeElRZEJBQ0FHSUFaQkEzVkJBM1JySUFRYklReEJmeUVHSS80QkJFQUNmeUFLUVlEUWZtb3RBQUFpQmtFSWNVRUFSeUVKUVFjZ0Iyc2dCeUFHUWNBQWNSc0xJUWNMSUFRZ0NDQUJJQWtnREVHZ0FTQUVhMEVISUFSQkNHcEJvQUZLR3lBSElBUWdBRUdnQVVHQXlRVkJBQ0FHUVg4UUlpSUdRUUZyYWlBRUlBWkJBRW9iSVFRRklBZEZCRUFqL2dFRVFDQUVJQUFnQmlBRElBb2dBU0FJRUNNRklBUWdBQ0FHSUFNZ0FTQUlFQ1FMQ3dzZ0JFRUJhaUVFREFFTEN3dVZCUUVQZjBFbklRY0RRQ0FIUVFCT0JFQWdCMEVDZENJRlFZRDhBMm9pQWhBTExRQUFJUU1nQWtFQmFoQUxMUUFBSVFZZ0FrRUNhaEFMTFFBQUlRUWdCa0VJYXlFS0lBQWdBMEVRYXlJRElBRUVmeUFFSUFSQkFYRnJJUVJCRUFWQkNBc2lBbXBJUVFBZ0FDQURUaHNFUUNBRlFZUDhBMm9RQ3kwQUFDSUdRWUFCY1VFQVJ5RUxJQVpCSUhGQkFFY2hEQ0FHUVFoeFFRQkhJLzRCSWdVZ0JSdEJBWEZCRFhRaUJTQUVRUVIwUVlDQUFtb2dBaUFBSUFOcklnSnJRUUZySUFJZ0JrSEFBSEViUVFGMGFpSUNRWUNRZm1wcUxRQUFJUTBnQlNBQ1FZR1FmbXBxTFFBQUlRNUJCeUVFQTBBZ0JFRUFUZ1JBSUE1QkFVRUFJQVJCQjJ0cklBUWdEQnNpQTNSeEJIOUJBZ1ZCQUFzaUFrRUJhaUFDSUExQkFTQURkSEViSWdNRVFDQUtRUWNnQkd0cUlnSkJvQUZNUVFBZ0FrRUFUaHNFUUVFQUlRVkJBQ0VJSStjQlJTUCtBU0lKSUFrYklnbEZCRUFnQWlBQVFhQUJiR3BCZ0pFRWFpMEFBQ0lQUVFOeEloQkJBRXRCQUNBTEd3UkFRUUVoQlFVZ0VFRUFTMEVBSUE5QkJIRkJBQ1ArQVJzYlJVVWhDQXNMUVFGQkFDQUlSU0FGR3lBSkd3UkFJLzRCQkVBZ0FpQUFRYUFCYkdwQkEyd2lBa0dBeVFWcUlBWkJCM0ZCQTNRZ0EwRUJkR29pQTBFQmFrRS9jVUhBa0FScUxRQUFRUWgwSUFOQlAzRkJ3SkFFYWkwQUFISWlBMEVmY1VFRGREb0FBQ0FDUVlISkJXb2dBMEhnQjNGQkJYWkJBM1E2QUFBZ0FrR0N5UVZxSUFOQmdQZ0JjVUVLZGtFRGREb0FBQVVnQWlBQVFhQUJiR3BCQTJ3aUFrR0F5UVZxSUFOQnlmNERRY2orQXlBR1FSQnhHeEFoSWdOQmdJRDhCM0ZCRUhZNkFBQWdBa0dCeVFWcUlBTkJnUDREY1VFSWRqb0FBQ0FDUVlMSkJXb2dBem9BQUFzTEN3c2dCRUVCYXlFRURBRUxDd3NnQjBFQmF5RUhEQUVMQ3d1QkFRRUNmMEdBZ0FKQmdKQUNJK01CR3lFQlFRRWo1d0VqL2dFYkJFQWdBQ0FCUVlDNEFrR0FzQUlqNUFFYklBQWo3QUZxUWY4QmNVRUFJK3NCRUNVTEkrSUJCRUFnQUNQdUFTSUNUZ1JBSUFBZ0FVR0F1QUpCZ0xBQ0krRUJHeUFBSUFKckkrMEJRUWRySWdGQkFDQUJheEFsQ3dzajVnRUVRQ0FBSStVQkVDWUxDeUVBUVkvK0F4QUxMUUFBUVFFZ0FIUnlJZ0FrdkFGQmovNERFQXNnQURvQUFBdnFBUUVEZnlOZlJVRUJJMVViQkVBUEN5TmdRUUZySWdCQkFFd0VRQ05LQkVBalNpUmdBbjhqWVNJQkkweDFJUUJCQVNOTEJIOUJBU1JpSUFFZ0FHc0ZJQUFnQVdvTElnQkIvdzlLRFFBYVFRQUxCRUJCQUNSVkN5Tk1RUUJLQkVBZ0FDUmhJQUJCQ0hWQkIzRWlBa0dVL2dNUUN5MEFBRUg0QVhGeUlRRkJrLzRERUFzZ0FFSC9BWEVpQURvQUFFR1UvZ01RQ3lBQk9nQUFJQUFrVWlBQ0pGUWpVaU5VUVFoMGNpUlhBbjhqWVNJQkkweDFJUUJCQVNOTEJIOUJBU1JpSUFFZ0FHc0ZJQUFnQVdvTFFmOFBTZzBBR2tFQUN3UkFRUUFrVlFzTEJVRUlKR0FMQlNBQUpHQUxDOEVIQVFKL0lBQWpzQUZxSWdCQmdNQUFJLzhCZENJQ1RnUkFJQUFnQW1za3NBRUNRQUpBQWtBQ1FBSkFBa0Fqc1FGQkFXcEJCM0VpQWc0SUFBVUJCUUlGQXdRRkN5TlRRUUFqV3lJQVFRQktHd1JBSUFCQkFXc2lBRVVFUUVFQUpGVUxDeUFBSkZzQ2Z5TnFRUUFqY2lJQVFRQktHd1JBSUFCQkFXc2hBQXNnQUF0RkJFQkJBQ1JzQ3lBQUpISUNmeU42UVFBamdBRWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2ZBc2dBQ1NBQVFKL0k0MEJRUUFqa3dFaUFFRUFTaHNFUUNBQVFRRnJJUUFMSUFBTFJRUkFRUUFramdFTElBQWtrd0VNQkFzalUwRUFJMXNpQUVFQVNoc0VRQ0FBUVFGcklnQkZCRUJCQUNSVkN3c2dBQ1JiQW44amFrRUFJM0lpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtiQXNnQUNSeUFuOGpla0VBSTRBQklnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkh3TElBQWtnQUVDZnlPTkFVRUFJNU1CSWdCQkFFb2JCRUFnQUVFQmF5RUFDeUFBQzBVRVFFRUFKSTRCQ3lBQUpKTUJFQ2tNQXdzalUwRUFJMXNpQUVFQVNoc0VRQ0FBUVFGcklnQkZCRUJCQUNSVkN3c2dBQ1JiQW44amFrRUFJM0lpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtiQXNnQUNSeUFuOGpla0VBSTRBQklnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkh3TElBQWtnQUVDZnlPTkFVRUFJNU1CSWdCQkFFb2JCRUFnQUVFQmF5RUFDeUFBQzBVRVFFRUFKSTRCQ3lBQUpKTUJEQUlMSTFOQkFDTmJJZ0JCQUVvYkJFQWdBRUVCYXlJQVJRUkFRUUFrVlFzTElBQWtXd0ovSTJwQkFDTnlJZ0JCQUVvYkJFQWdBRUVCYXlFQUN5QUFDMFVFUUVFQUpHd0xJQUFrY2dKL0kzcEJBQ09BQVNJQVFRQktHd1JBSUFCQkFXc2hBQXNnQUF0RkJFQkJBQ1I4Q3lBQUpJQUJBbjhqalFGQkFDT1RBU0lBUVFCS0d3UkFJQUJCQVdzaEFBc2dBQXRGQkVCQkFDU09BUXNnQUNTVEFSQXBEQUVMSTFsQkFXc2lBRUVBVEFSQUkxRUVRQ05hUVFBalVTSUFHd1JBSTF3aUFVRUJhaUFCUVFGckkxQWJRUTl4SWdGQkQwa0VRQ0FCSkZ3RlFRQWtXZ3NMQlVFSUlRQUxDeUFBSkZramNFRUJheUlBUVFCTUJFQWphQVJBSTNGQkFDTm9JZ0FiQkVBamN5SUJRUUZxSUFGQkFXc2paeHRCRDNFaUFVRVBTUVJBSUFFa2N3VkJBQ1J4Q3dzRlFRZ2hBQXNMSUFBa2NDT1JBVUVCYXlJQVFRQk1CRUFqaVFFRVFDT1NBVUVBSTRrQklnQWJCRUFqbEFFaUFVRUJhaUFCUVFGckk0Z0JHMEVQY1NJQlFROUpCRUFnQVNTVUFRVkJBQ1NTQVFzTEJVRUlJUUFMQ3lBQUpKRUJDeUFDSkxFQlFRRVBCU0FBSkxBQkMwRUFDOEVCQVFGL0kxZ2dBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTlhhMEVDZENJQlFRSjBJQUVqL3dFYkpGZ2pXQ0FBUVI5MUlnRWdBQ0FCYW5OcklRQWpYa0VCYWtFSGNTUmVEQUVMQ3lBQUpGZ2pWa0VBSTFVYkJIOGpYRUVQY1FWQkR3OExJUUFDZnlOZUlRRUNRQUpBQWtBQ1FDTk5RUUZyRGdNQUFRSURDMEVCSUFGMFFZRUJjVUVBUnd3REMwRUJJQUYwUVljQmNVRUFSd3dDQzBFQklBRjBRZjRBY1VFQVJ3d0JDMEVCSUFGMFFRRnhDd1IvUVFFRlFYOExJQUJzUVE5cUM3b0JBUUYvSTI4Z0FHc2hBQU5BSUFCQkFFd0VRRUdBRUNOdWEwRUNkQ1AvQVhRa2J5TnZJQUJCSDNVaUFTQUFJQUZxYzJzaEFDTjFRUUZxUVFkeEpIVU1BUXNMSUFBa2J5TnRRUUFqYkJzRWZ5TnpRUTl4QlVFUER3c2hBQUovSTNVaEFRSkFBa0FDUUFKQUkyUkJBV3NPQXdBQkFnTUxRUUVnQVhSQmdRRnhRUUJIREFNTFFRRWdBWFJCaHdGeFFRQkhEQUlMUVFFZ0FYUkIvZ0J4UVFCSERBRUxRUUVnQVhSQkFYRUxCSDlCQVFWQmZ3c2dBR3hCRDJvTGlBSUJBMzhqZlVWQkFTTjhHd1JBUVE4UEN5T0NBU0VESTRNQkJFQkJuUDRERUFzdEFBQkJCWFlpQXlTQ0FVRUFKSU1CQ3lPRUFTT0JBVUVCY1VWQkFuUjFRUTl4SVFJQ1FBSkFBa0FDUUFKQUlBTU9Bd0FCQWdNTElBSkJCSFVoQWd3REMwRUJJUUVNQWdzZ0FrRUJkU0VDUVFJaEFRd0JDeUFDUVFKMUlRSkJCQ0VCQ3lBQlFRQkxCSDhnQWlBQmJRVkJBQXRCRDJvaEFpTi9JQUJySVFBRFFDQUFRUUJNQkVCQmdCQWpmbXRCQVhRai93RjBKSDhqZnlBQVFSOTFJZ0VnQUNBQmFuTnJJUUFqZ1FGQkFXb2hBUU5BSUFGQklFNEVRQ0FCUVNCcklRRU1BUXNMSUFFa2dRRWpnUUZCQVhWQnNQNERhaEFMTFFBQUpJUUJEQUVMQ3lBQUpIOGdBZ3VQQVFFQ2Z5T1FBU0FBYXlJQVFRQk1CRUFqbFFFamlnRjBJLzhCZENBQVFSOTFJZ0VnQUNBQmFuTnJJUUFqbGdFaUFVRUJkU0lDSUFGQkFYRWdBa0VCY1hNaUFVRU9kSElpQWtHL2YzRWdBVUVHZEhJZ0FpT0xBUnNrbGdFTFFRQWdBQ0FBUVFCSUd5U1FBU09QQVVFQUk0NEJHd1IvSTVRQlFROXhCVUVQRHd0QmYwRUJJNVlCUVFGeEcyeEJEMm9MNVFFQkFYOUJBQ1NoQVNBQVFROGpxd0ViSUFGQkR5T3NBUnRxSUFKQkR5T3RBUnRxSUFOQkR5T3VBUnRxSVFSQkFDU2lBVUVBSktNQkFuOUIvd0FnQUVFUEk2Y0JHeUFCUVE4anFBRWJhaUFDUVE4anFRRWJhaUFEUVE4anFnRWJhaUlBUVR4R0RRQWFJNlVCUVFGcUlBQkJQR3RCb0kwR2JHeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMSVFJQ2Z5T21BVUVCYWlFQlFmOEFJQVJCUEVZTkFCb2dBU0FFUVR4clFhQ05CbXhzUVFOMVFhQ05CbTFCUEdwQm9JMEdiRUdNOFFKdEN5RUFJQUlrbndFZ0FDU2dBU0FBUWY4QmNTQUNRZjhCY1VFSWRISUxuQU1CQlg4Z0FDTkphaUlCSkVraldDQUJhMEVBVENJQlJRUkFJMVlpQWlPYkFVY2hBU0FDSkpzQkN5QUFJMk5xSWdJa1l5TnZJQUpyUVFCTUlnSkZCRUFqYlNJRUk1d0JSeUVDSUFRa25BRUxJQUFqZG1va2RrRUFJMzhqZG10QkFFb2pnd0ViUlNJRVJRUkFJMzBpQlNPZEFVY2hCQ0FGSkowQkN5QUFJNFVCYWlTRkFTT1FBU09GQVd0QkFFd2lCVVVFUUNPUEFTSURJNTRCUnlFRklBTWtuZ0VMSUFFRVFDTkpJUU5CQUNSSklBTVFLeVNYQVFzZ0FnUkFJMk1oQTBFQUpHTWdBeEFzSkpnQkN5QUVCRUFqZGlFRFFRQWtkaUFERUMwa21RRUxJQVVFUUNPRkFTRURRUUFraFFFZ0F4QXVKSm9CQzBFQklBVkJBU0FFUVFFZ0FpQUJHeHNiQkVCQkFTU2pBUXNnQUNPeUFXb2lBRUdBZ0lBQ0kvOEJkRUhFMkFKdElnRk9CRUFnQUNBQmF5RUFRUUVqb2dGQkFTT2hBU09qQVJzYkJFQWpsd0VqbUFFam1RRWptZ0VRTHhvRklBQWtzZ0VMSTdNQklnRkJBWFJCZ0puQkFHb2lBaU9mQVVFQ2Fqb0FBQ0FDSTZBQlFRSnFPZ0FCSUFGQkFXb2lBVUgvL3dOT0JIOGdBVUVCYXdVZ0FRc2tzd0VMSUFBa3NnRUxsZ01CQm44Z0FCQXJJUUVnQUJBc0lRSWdBQkF0SVFRZ0FCQXVJUVVnQVNTWEFTQUNKSmdCSUFRa21RRWdCU1NhQVNBQUk3SUJhaUlBUVlDQWdBSWovd0YwUWNUWUFtMU9CRUFnQUVHQWdJQUNJLzhCZEVIRTJBSnRheUVBSUFFZ0FpQUVJQVVRTHlFREk3TUJRUUYwUVlDWndRQnFJZ1lnQTBHQS9nTnhRUWgyUVFKcU9nQUFJQVlnQTBIL0FYRkJBbW82QUFFak9nUkFJQUZCRDBFUFFROFFMeUVCSTdNQlFRRjBRWUNaSVdvaUF5QUJRWUQrQTNGQkNIWkJBbW82QUFBZ0F5QUJRZjhCY1VFQ2Fqb0FBVUVQSUFKQkQwRVBFQzhoQVNPekFVRUJkRUdBbVNscUlnSWdBVUdBL2dOeFFRaDJRUUpxT2dBQUlBSWdBVUgvQVhGQkFtbzZBQUZCRDBFUElBUkJEeEF2SVFFanN3RkJBWFJCZ0preGFpSUNJQUZCZ1A0RGNVRUlka0VDYWpvQUFDQUNJQUZCL3dGeFFRSnFPZ0FCUVE5QkQwRVBJQVVRTHlFQkk3TUJRUUYwUVlDWk9Xb2lBaUFCUVlEK0EzRkJDSFpCQW1vNkFBQWdBaUFCUWY4QmNVRUNham9BQVFzanN3RkJBV29pQVVILy93Tk9CSDhnQVVFQmF3VWdBUXNrc3dFTElBQWtzZ0VMUVFFQ2YwSFhBQ1AvQVhRaEFDT2tBU0VCQTBBZ0FTQUFUZ1JBSUFBUUtrVkJBQ00zR3dSQUlBQVFNQVVnQUJBeEN5QUJJQUJySVFFTUFRc0xJQUVrcEFFTHlnTUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERhdzRYQUFVS0R4TUJCZ3NRRkFJSERCRVZBd2dORWhZRUNRNFhDMEdRL2dNUUN5MEFBRUdBQVhJUEMwR1YvZ01RQ3kwQUFFSC9BWElQQzBHYS9nTVFDeTBBQUVIL0FISVBDMEdmL2dNUUN5MEFBRUgvQVhJUEMwR2svZ01RQ3kwQUFBOExRWkgrQXhBTExRQUFRVDl5RHd0Qmx2NERFQXN0QUFCQlAzSVBDMEdiL2dNUUN5MEFBRUgvQVhJUEMwR2cvZ01RQ3kwQUFFSC9BWElQQzBHbC9nTVFDeTBBQUE4TFFaTCtBeEFMTFFBQUR3dEJsLzRERUFzdEFBQVBDMEdjL2dNUUN5MEFBRUdmQVhJUEMwR2gvZ01RQ3kwQUFBOExRWUFCUVFBanJ3RWJJZ0JCQVhJZ0FFRitjU05WR3lJQVFRSnlJQUJCZlhFamJCc2lBRUVFY2lBQVFYdHhJM3diSWdCQkNISWdBRUYzY1NPT0FSdEI4QUJ5RHd0QmsvNERFQXN0QUFCQi93RnlEd3RCbVA0REVBc3RBQUJCL3dGeUR3dEJuZjRERUFzdEFBQkIvd0Z5RHd0Qm92NERFQXN0QUFBUEMwR1UvZ01RQ3kwQUFFRy9BWElQQzBHWi9nTVFDeTBBQUVHL0FYSVBDMEdlL2dNUUN5MEFBRUcvQVhJUEMwR2ovZ01RQ3kwQUFFRy9BWElQQzBGL0M0MEJBUUYvSTljQklRQWoyQUVFZnlBQVFYdHhJQUJCQkhJanp3RWJJZ0JCZm5FZ0FFRUJjaVBTQVJzaUFFRjNjU0FBUVFoeUk5QUJHeUlBUVgxeElBQkJBbklqMFFFYkJTUFpBUVIvSUFCQmZuRWdBRUVCY2lQVEFSc2lBRUY5Y1NBQVFRSnlJOVFCR3lJQVFYdHhJQUJCQkhJajFRRWJJZ0JCZDNFZ0FFRUljaVBXQVJzRklBQUxDMEh3QVhJTDlBSUJBWDhnQUVHQWdBSklCRUJCZnc4TElBQkJnTUFDU0VFQUlBQkJnSUFDVGhzRVFFRi9Ed3NnQUVHQS9BTklRUUFnQUVHQXdBTk9Hd1JBSUFCQmdFQnFFQXN0QUFBUEN5QUFRWi85QTB4QkFDQUFRWUQ4QTA0YkJFQkIvd0ZCZnlQZUFVRUNTQnNQQ3lBQVFjMytBMFlFUUVITi9nTVFDeTBBQUVFQmNRUi9RZjhCQlVIK0FRc2lBQ0FBUWY5K2NTUC9BUnNQQ3lBQVFjVCtBMFlFUUNQcUFTRUJJQUFRQ3lBQk9nQUFJK29CRHdzZ0FFR20vZ05NUVFBZ0FFR1EvZ05PR3dSQUVESWdBQkF6RHdzZ0FFR3YvZ05NUVFBZ0FFR24vZ05PR3dSQVFmOEJEd3NnQUVHLy9nTk1RUUFnQUVHdy9nTk9Hd1JBRURJamZBUkFJNEVCUVFGMVFiRCtBMm9RQ3kwQUFBOExRWDhQQ3lBQVFZVCtBMFlFUUNQREFVR0EvZ054UVFoMklRRWdBQkFMSUFFNkFBQWdBUThMSUFCQmhmNERSZ1JBSThRQklRRWdBQkFMSUFFNkFBQWp4QUVQQ3lBQVFZLytBMFlFUUNPOEFVSGdBWElQQ3lBQVFZRCtBMFlFUUJBMER3dEJmd3NzQVFGL0lBQWoyd0ZHQkVCQkFTVGRBUXNnQUJBMUlnRkJmMFlFZnlBQUVBc3RBQUFGSUFGQi93RnhDd3VhQWdFQ2Z5UHpBUVJBRHdzajlBRWhBeVAxQVNFQ0lBQkIvejlNQkVBZ0FVRVFjVVZCQUNBQ0cwVUVRQ0FCUVE5eElnQUVRQ0FBUVFwR0JFQkJBU1R4QVFzRlFRQWs4UUVMQ3dVZ0FFSC8vd0JNQkVBZ0FFSC8zd0JNUVFFajl3RWlBQnNFUUNBQlFROXhJKzhCSUFJYklRSWdBd1IvSUFGQkgzRWhBU0FDUWVBQmNRVWo5Z0VFZnlBQlFmOEFjU0VCSUFKQmdBRnhCVUVBSUFJZ0FCc0xDeUFCY2lUdkFRVWo3d0ZCL3dGeElBRkJBRXBCQ0hSeUpPOEJDd1ZCQUNBQVFmKy9BVXdnQWhzRVFDUHlBVUVBSUFNYkJFQWo3d0ZCSDNFZ0FVSGdBWEZ5Sk84QkR3c2dBVUVQY1NBQlFRTnhJL2NCR3lUd0FRVkJBQ0FBUWYvL0FVd2dBaHNFUUNBREJFQWdBVUVCY1VFQVJ5VHlBUXNMQ3dzTEM2b0JBUUovUVFFa1ZTTmJSUVJBUWNBQUpGc0xRWUFRSTFkclFRSjBJZ0JCQW5RZ0FDUC9BUnNrV0NOUkJFQWpVU1JaQlVFSUpGa0xRUUVrV2lOUEpGd2pWeVJoSTBvRVFDTktKR0FGUVFna1lBdEJBU05NUVFCS0lnQWpTa0VBU2hza1gwRUFKR0lnQUFSL0FuOGpZU0lBSTB4MUlRRkJBU05MQkg5QkFTUmlJQUFnQVdzRklBQWdBV29MUWY4UFNnMEFHa0VBQ3dWQkFBc0VRRUVBSkZVTEkxWkZCRUJCQUNSVkN3dU5BUUVDZnlBQVFRZHhJZ0VrVkNOU0lBRkJDSFJ5SkZjalUwVWlBUVJBSUFCQndBQnhRUUJISVFFTEk3RUJRUUZ4SWdKRkJFQWdBVUVBSTF0QkFFb2JCRUFqVzBFQmF5UmJRUUFqVzBVZ0FFR0FBWEViQkVCQkFDUlZDd3NMSUFCQndBQnhRUUJISkZNZ0FFR0FBWEVFUUJBNEkxTkJBRUVBSTF0QndBQkdJQUliR3dSQUkxdEJBV3NrV3dzTEM4c0JBUUovSUFCQkIzRWlBaVJySTJrZ0FrRUlkSElrYmlPeEFVRUJjU0VDSTJwRklnRUVRQ0FBUWNBQWNVRUFSeUVCQ3lBQ1JRUkFJQUZCQUNOeVFRQktHd1JBSTNKQkFXc2tja0VBSTNKRklBQkJnQUZ4R3dSQVFRQWtiQXNMQ3lBQVFjQUFjVUVBUnlScUlBQkJnQUZ4QkVCQkFTUnNJM0pGQkVCQndBQWtjZ3RCZ0JBamJtdEJBblFqL3dGMEpHOGphQVJBSTJna2NBVkJDQ1J3QzBFQkpIRWpaaVJ6STIxRkJFQkJBQ1JzQ3lOcVFRQkJBQ055UWNBQVJpQUNHeHNFUUNOeVFRRnJKSElMQ3d1K0FRRUJmeUFBUVFkeElnRWtleU41SUFGQkNIUnlKSDRqc1FGQkFYRWlBVVVFUUVFQUlBQkJ3QUJ4STNvYlFRQWpnQUZCQUVvYkJFQWpnQUZCQVdza2dBRkJBQ09BQVVVZ0FFR0FBWEViQkVCQkFDUjhDd3NMSUFCQndBQnhRUUJISkhvZ0FFR0FBWEVFUUVFQkpId2pnQUZGQkVCQmdBSWtnQUVMUVlBUUkzNXJRUUYwSS84QmRDUi9JMzlCQm1va2YwRUFKSUVCSTMxRkJFQkJBQ1I4Q3lONlFRQkJBQ09BQVVHQUFrWWdBUnNiQkVBamdBRkJBV3NrZ0FFTEN3dlRBUUVDZnlPTkFVVWlBUVJBSUFCQndBQnhRUUJISVFFTEk3RUJRUUZ4SWdKRkJFQWdBVUVBSTVNQlFRQktHd1JBSTVNQlFRRnJKSk1CUVFBamt3RkZJQUJCZ0FGeEd3UkFRUUFramdFTEN3c2dBRUhBQUhGQkFFY2tqUUVnQUVHQUFYRUVRRUVCSkk0Qkk1TUJSUVJBUWNBQUpKTUJDeU9WQVNPS0FYUWovd0YwSkpBQkk0a0JCRUFqaVFFa2tRRUZRUWdra1FFTFFRRWtrZ0VqaHdFa2xBRkIvLzhCSkpZQkk0OEJSUVJBUVFBa2pnRUxJNDBCUVFCQkFDT1RBVUhBQUVZZ0Foc2JCRUFqa3dGQkFXc2trd0VMQ3d2WEJ3QWpyd0ZGUVFBZ0FFR20vZ05IR3dSQVFRQVBDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RGF3NFhBQUlHQ2c0VkF3Y0xEd0VFQ0F3UUZRVUpEUkVTRXhRVkN5TkxJUUFnQVVId0FIRkJCSFlrU2lBQlFRaHhRUUJISkVzZ0FVRUhjU1JNSTJKQkFDTkxSVUVBSUFBYkd3UkFRUUFrVlFzTUZBdEJBQ0FCUVlBQmNVRUFSeUlBSTMwYkJFQkJBQ1NFQVFzZ0FDUjlJQUJGQkVBZ0FDUjhDd3dUQ3lBQlFRWjFRUU54SkUwZ0FVRS9jU1JPUWNBQUkwNXJKRnNNRWdzZ0FVRUdkVUVEY1NSa0lBRkJQM0VrWlVIQUFDTmxheVJ5REJFTElBRWtkMEdBQWlOM2F5U0FBUXdRQ3lBQlFUOXhKSVlCUWNBQUk0WUJheVNUQVF3UEN5TlZCRUJCQUNOYUkxRWJCRUFqWEVFQmFrRVBjU1JjQ3lOUUlBRkJDSEZCQUVkSEJFQkJFQ05jYTBFUGNTUmNDd3NnQVVFRWRVRVBjU1JQSUFGQkNIRkJBRWNrVUNBQlFRZHhKRkVnQVVINEFYRkJBRXNpQUNSV0lBQkZCRUJCQUNSVkN3d09DeU5zQkVCQkFDTnhJMmdiQkVBamMwRUJha0VQY1NSekN5Tm5JQUZCQ0hGQkFFZEhCRUJCRUNOemEwRVBjU1J6Q3dzZ0FVRUVkVUVQY1NSbUlBRkJDSEZCQUVja1p5QUJRUWR4SkdnZ0FVSDRBWEZCQUVzaUFDUnRJQUJGQkVBZ0FDUnNDd3dOQzBFQkpJTUJJQUZCQlhWQkQzRWtlQXdNQ3lPT0FRUkFRUUFqa2dFamlRRWJCRUFqbEFGQkFXcEJEM0VrbEFFTEk0Z0JJQUZCQ0hGQkFFZEhCRUJCRUNPVUFXdEJEM0VrbEFFTEN5QUJRUVIxUVE5eEpJY0JJQUZCQ0hGQkFFY2tpQUVnQVVFSGNTU0pBU0FCUWZnQmNVRUFTeUlBSkk4QklBQkZCRUFnQUNTT0FRc01Dd3NnQVNSU0lBRWpWRUVJZEhJa1Z3d0tDeUFCSkdrZ0FTTnJRUWgwY2lSdURBa0xJQUVrZVNBQkkzdEJDSFJ5Skg0TUNBc2dBVUVFZFNTS0FTQUJRUWh4UVFCSEpJc0JJQUZCQjNFaUFDU01BU0FBUVFGMElnQkJBVWdFZjBFQkJTQUFDMEVEZENTVkFRd0hDeUFCRURrTUJnc2dBUkE2REFVTElBRVFPd3dFQ3lBQkVEd01Bd3NnQVVFRWRVRUhjU1NsQVNBQlFRZHhKS1lCUVFFa29RRU1BZ3NnQVVHQUFYRkJBRWNrcWdFZ0FVSEFBSEZCQUVja3FRRWdBVUVnY1VFQVJ5U29BU0FCUVJCeFFRQkhKS2NCSUFGQkNIRkJBRWNrcmdFZ0FVRUVjVUVBUnlTdEFTQUJRUUp4UVFCSEpLd0JJQUZCQVhGQkFFY2txd0ZCQVNTaUFRd0JDeU92QVNJQUJIOUJBQVVnQVVHQUFYRUxCRUJCQnlTeEFVRUFKRjVCQUNSMUN5QUJRWUFCY1VWQkFDQUFHd1JBUVpEK0F5RUFBMEFnQUVHbS9nTklCRUFnQUVFQUVFTWdBRUVCYWlFQURBRUxDd3NnQVVHQUFYRkJBRWNrcndFTFFRRUxYd0VDZjBFQUpPa0JRUUFrNmdGQnhQNERFQXRCQURvQUFFSEIvZ01RQ3kwQUFFRjhjU0VDUVFBazNnRkJ3ZjRERUFzZ0Fqb0FBQ0FBQkVBRFFDQUJRWURZQlVnRVFDQUJRWURKQldwQi93RTZBQUFnQVVFQmFpRUJEQUVMQ3dzTHlRRUJBMzhqL2dGRkJFQVBDeUFBUVlBQmNVVkJBQ1A1QVJzRVFFRUFKUGtCUWRYK0F4QUxMUUFBUVlBQmNpRUFRZFgrQXhBTElBQTZBQUFQQzBIUi9nTVFDeTBBQUVFSWRFSFMvZ01RQ3kwQUFISkI4UDhEY1NFQlFkUCtBeEFMTFFBQVFRaDBRZFQrQXhBTExRQUFja0h3UDNGQmdJQUNhaUVDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKUGtCSUFNaytnRWdBU1Q3QVNBQ0pQd0JRZFgrQXhBTElBQkIvMzV4T2dBQUJTQUJJQUlnQXhCRVFkWCtBeEFMUWY4Qk9nQUFDd3ZEQVFFRWZ3TkFJQUlnQUVnRVFDQUNRUVJxSVFJand3RWlBVUVFYWtILy93TnhJZ01rd3dFanlRRUVRQ1BHQVNFRUk4VUJCRUFqeUFFa3hBRkJBU1MvQVVFQ0VDaEJBQ1RGQVVFQkpNWUJCU0FFQkVCQkFDVEdBUXNMSUFGQkFRSi9Ba0FDUUFKQUFrQUNRQ1BLQVE0RUFBRUNBd1FMUVFrTUJBdEJBd3dEQzBFRkRBSUxRUWNNQVF0QkFBc2lBWFJ4Qkg4Z0EwRUJJQUYwY1VVRlFRQUxCRUFqeEFGQkFXb2lBVUgvQVVvRWYwRUJKTVVCUVFBRklBRUxKTVFCQ3dzTUFRc0xDOHNCQVFOL0k4a0JJUUVnQUVFRWNVRUFSeVRKQVNBQVFRTnhJUU1nQVVVRVFBSi9Ba0FDUUFKQUFrQUNRQ1BLQVE0RUFBRUNBd1FMUVFrTUJBdEJBd3dEQzBFRkRBSUxRUWNNQVF0QkFBc2hBUUovQWtBQ1FBSkFBa0FDUUNBRERnUUFBUUlEQkF0QkNRd0VDMEVEREFNTFFRVU1BZ3RCQnd3QkMwRUFDeUVBSThNQklRSWp5UUVFZnlBQ1FRRWdBWFJ4QlNBQ1FRRWdBSFJ4UVFBZ0FrRUJJQUYwY1JzTEJFQWp4QUZCQVdvaUFFSC9BVW9FZjBFQkpNVUJRUUFGSUFBTEpNUUJDd3NnQXlUS0FRdTZDZ0VEZndKQUFrQWdBRUhOL2dOR0JFQkJ6ZjRERUFzZ0FVRUJjVG9BQUF3QkN5QUFRZEQrQTBaQkFDUDlBUnNFUUVFQUpQMEJRZjhCSklrQ0RBSUxJQUJCZ0lBQ1NBUkFJQUFnQVJBM0RBRUxJQUJCZ01BQ1NFRUFJQUJCZ0lBQ1Roc05BU0FBUVlEOEEwaEJBQ0FBUVlEQUEwNGJCRUFnQUVHQVFHb1FDeUFCT2dBQURBSUxJQUJCbi8wRFRFRUFJQUJCZ1B3RFRoc0VRQ1BlQVVFQ1RnOExJQUJCLy8wRFRFRUFJQUJCb1AwRFRoc05BQ0FBUVlMK0EwWUVRQ0FCUVFKeFFRQkhKTTBCSUFGQmdBRnhRUUJISk00QlFRRVBDeUFBUWFiK0EweEJBQ0FBUVpEK0EwNGJCRUFRTWlBQUlBRVFQUThMSUFCQnYvNERURUVBSUFCQnNQNERUaHNFUUJBeUkzd0VRQ09CQVVFQmRVR3cvZ05xRUFzZ0FUb0FBQXdDQ3d3Q0N5QUFRY3YrQTB4QkFDQUFRY0QrQTA0YkJFQWdBRUhBL2dOR0JFQWo0QUVoQUNBQlFZQUJjVUVBUnlUZ0FTQUJRY0FBY1VFQVJ5VGhBU0FCUVNCeFFRQkhKT0lCSUFGQkVIRkJBRWNrNHdFZ0FVRUljVUVBUnlUa0FTQUJRUVJ4UVFCSEpPVUJJQUZCQW5GQkFFY2s1Z0VnQVVFQmNVRUFSeVRuQVNQZ0FVVkJBQ0FBR3dSQVFRRVFQZ3RCQUNQZ0FTQUFHd1JBUVFBUVBnc01Bd3NnQUVIQi9nTkdCRUFnQVVINEFYRkJ3ZjRERUFzdEFBQkJCM0Z5UVlBQmNpRUFRY0grQXhBTElBQTZBQUFNQWdzZ0FFSEUvZ05HQkVCQkFDVHFBU0FBRUF0QkFEb0FBQXdDQ3lBQVFjWCtBMFlFUUNBQkpOOEJEQU1MSUFCQnh2NERSZ1JBUVFBaEFDQUJRUWgwSVFFRFFDQUFRWjhCVEFSQUlBQWdBV29RQ3kwQUFDRUNJQUJCZ1B3RGFoQUxJQUk2QUFBZ0FFRUJhaUVBREFFTEMwR0VCU1Q0QVF3REN3SkFBa0FDUUFKQUlBQkJ3LzREUndSQUlBQkJ3djREYXc0S0FRUUVCQVFFQkFRREFnUUxJQUVrNndFTUJnc2dBU1RzQVF3RkN5QUJKTzBCREFRTElBRWs3Z0VNQXdzTUFnc2dBRUhWL2dOR0JFQWdBUkEvREFFTFFRRWdBRUhQL2dOR0lBQkI4UDREUmhzRVFDUDVBUVJBSS9zQklnSkIvLzhCVEVFQUlBSkJnSUFCVGhzRWYwRUJCU0FDUWYrL0EweEJBQ0FDUVlDZ0EwNGJDdzBDQ3dzZ0FFSHIvZ05NUVFBZ0FFSG8vZ05PR3dSQVFRRWdBRUhyL2dOR0lBQkI2ZjREUmhzRVFDQUFRUUZySWdNUUN5MEFBRUcvZjNFaUFrRS9jU0lFUVVCcklBUWdBRUhyL2dOR0cwR0FrQVJxSUFFNkFBQWdBa0dBQVhFRVFDQURFQXNnQWtFQmFrR0FBWEk2QUFBTEN3d0NDeUFBUVlmK0EweEJBQ0FBUVlUK0EwNGJCRUFqd2dFUVFFRUFKTUlCQWtBQ1FBSkFBa0FnQUVHRS9nTkhCRUFnQUVHRi9nTnJEZ01CQWdNRUN5UERBU0VBUVFBa3d3RkJoUDRERUF0QkFEb0FBQ1BKQVFSL0lBQkJBUUovQWtBQ1FBSkFBa0FDUUNQS0FRNEVBQUVDQXdRTFFRa01CQXRCQXd3REMwRUZEQUlMUVFjTUFRdEJBQXQwY1FWQkFBc0VRQ1BFQVVFQmFpSUFRZjhCU2dSL1FRRWt4UUZCQUFVZ0FBc2t4QUVMREFVTEFrQWp5UUVFUUNQR0FRMEJJOFVCQkVCQkFDVEZBUXNMSUFFa3hBRUxEQVVMSUFFa3lBRWp4Z0ZCQUNQSkFSc0VRQ0FCSk1RQlFRQWt4Z0VMREFRTElBRVFRUXdEQ3d3Q0N5QUFRWUQrQTBZRVFDQUJRZjhCY3lUWEFTUFhBU0lDUVJCeFFRQkhKTmdCSUFKQklIRkJBRWNrMlFFTElBQkJqLzREUmdSQUlBRkJBWEZCQUVja3ZRRWdBVUVDY1VFQVJ5UytBU0FCUVFSeFFRQkhKTDhCSUFGQkNIRkJBRWNrd0FFZ0FVRVFjVUVBUnlUQkFTQUJKTHdCREFJTElBQkIvLzhEUmdSQUlBRkJBWEZCQUVja3R3RWdBVUVDY1VFQVJ5UzRBU0FCUVFSeFFRQkhKTGtCSUFGQkNIRkJBRWNrdWdFZ0FVRVFjVUVBUnlTN0FTQUJKTFlCREFJTERBRUxRUUFQQzBFQkN5SUFJQUFqM0FGR0JFQkJBU1RkQVFzZ0FDQUJFRUlFUUNBQUVBc2dBVG9BQUFzTFdBRURmd05BSUFNZ0FrZ0VRQ0FBSUFOcUVEWWhCU0FCSUFOcUlRUURRQ0FFUWYrL0Frb0VRQ0FFUVlCQWFpRUVEQUVMQ3lBRUlBVVFReUFEUVFGcUlRTU1BUXNMSS9nQlFTQWovd0YwSUFKQkJIVnNhaVQ0QVFzNkFDUHFBU1BmQVVaQkFDQUFRUUZHUVFFZ0FCc2JCRUFnQVVFRWNpSUJRY0FBY1FSQVFRRWt2Z0ZCQVJBb0N3VWdBVUY3Y1NFQkN5QUJDL3dDQVFSL0krQUJSUVJBRHdzajZnRWlBa0dRQVU0RWYwRUJCU1BwQVNJQVFmZ0NJLzhCZENJQlRnUi9RUUlGUVFOQkFDQUFJQUZPR3dzTElnQWozZ0ZIQkVCQndmNERFQXN0QUFBaEF5QUFKTjRCUVFBaEFRSkFBa0FDUUFKQUlBQWlBZ1JBSUFKQkFXc09Bd0VDQXdRTElBTkJmSEVpQTBFSWNVRUFSeUVCREFNTElBTkJmWEZCQVhJaUEwRVFjVUVBUnlFQkRBSUxJQU5CZm5GQkFuSWlBMEVnY1VFQVJ5RUJEQUVMSUFOQkEzSWhBd3NnQVFSQVFRRWt2Z0ZCQVJBb0N5QUNSUVJBSS9rQkJFQWord0VqL0FFaitnRWlBVUVRU0FSL0lBRUZRUkFMSWdBUVJDQUFJL3NCYWlUN0FTQUFJL3dCYWlUOEFTQUJJQUJySWdBaytnRWdBRUVBVEFSQVFRQWsrUUZCMWY0REVBdEIvd0U2QUFBRlFkWCtBeEFMSUFCQkJIVkJBV3RCLzM1eE9nQUFDd3NMSUFKQkFVWUVRRUVCSkwwQlFRQVFLQXNnQWlBREVFVWhBRUhCL2dNUUN5QUFPZ0FBQlNBQ1Faa0JSZ1JBSUFCQndmNERFQXN0QUFBUVJTRUFRY0grQXhBTElBQTZBQUFMQ3d1QUFnRURmeVBnQVFSQUlBQWo2UUZxSk9rQkl6WWhBd05BSStrQlFRUWovd0VpQUhSQnlBTWdBSFFqNmdGQm1RRkdHMDRFUUNQcEFVRUVJLzhCSWdCMFFjZ0RJQUIwSStvQklnRkJtUUZHRzJzazZRRWdBVUdRQVVZRVFDQURCRUJCQUNFQUEwQWdBRUdRQVV3RVFDQUFRZjhCY1JBbklBQkJBV29oQUF3QkN3c0ZJQUVRSnd0QkFDRUFBMEFnQUVHUUFVZ0VRRUVBSVFJRFFDQUNRYUFCU0FSQUlBSWdBRUdnQVd4cVFZQ1JCR3BCQURvQUFDQUNRUUZxSVFJTUFRc0xJQUJCQVdvaEFBd0JDd3RCZnlSSFFYOGtTQVVnQVVHUUFVZ0VRQ0FEUlFSQUlBRVFKd3NMQzBFQUlBRkJBV29nQVVHWkFVb2JKT29CREFFTEN3c1FSZ3ZHQVFFRGZ5UE9BVVVFUUE4TEEwQWdBeUFBU0FSQUlBTkJCR29oQXdKL0k4c0JJZ0pCQkdvaUFVSC8vd05LQkVBZ0FVR0FnQVJySVFFTElBRUxKTXNCSUFKQkFVRUNRUWNqelFFYklnSjBjUVIvSUFGQkFTQUNkSEZGQlVFQUN3UkFRWUgrQXhBTExRQUFRUUYwUVFGcVFmOEJjU0VCUVlIK0F4QUxJQUU2QUFBanpBRkJBV29pQVVFSVJnUkFRUUFrekFGQkFTVEFBVUVERUNoQmd2NERFQXN0QUFCQi8zNXhJUUZCZ3Y0REVBc2dBVG9BQUVFQUpNNEJCU0FCSk13QkN3c01BUXNMQzl3QkFRRi9JL2dCUVFCS0JFQWdBQ1A0QVdvaEFFRUFKUGdCQ3lBQUk0b0NhaVNLQWlPT0FrVUVRQ00wQkVBZ0FDUG9BV29rNkFGQkJDUC9BU0lCZEVISUF5QUJkQ1BxQVVHWkFVWWJJUUVEUUNQb0FTQUJUZ1JBSUFFUVJ5UG9BU0FCYXlUb0FRd0JDd3NGSUFBUVJ3c2pNd1JBSUFBanBBRnFKS1FCRURJRklBQVFLa1ZCQUNNM0d3UkFJQUFRTUFVZ0FCQXhDd3NnQUJCSUN5TTFCRUFnQUNQQ0FXb2t3Z0Vqd2dFUVFFRUFKTUlCQlNBQUVFQUxJQUFqa1FKcUlnQWpqd0pPQkg4amtBSkJBV29ra0FJZ0FDT1BBbXNGSUFBTEpKRUNDeXdCQVg5QkJCQkpJNGtDUVFGcVFmLy9BM0VRQ3kwQUFFRUlkQ0VBUVFRUVNTQUFJNGtDRUFzdEFBQnlDejhCQVg4Z0FVR0EvZ054UVFoMklRSWdBQ0FCUWY4QmNTSUJFRUlFUUNBQUVBc2dBVG9BQUFzZ0FFRUJhaUlBSUFJUVFnUkFJQUFRQ3lBQ09nQUFDd3ZHQVFBZ0FnUkFJQUVnQUVILy93TnhJZ0J6SUFBZ0FXcHpJZ0JCRUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVHQUFuRkJBRWRCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzRklBQWdBV3BCLy84RGNTSUNJQUJCLy84RGNVbEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWlBQUlBRnpjMEdBSUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NMQzVvSUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQU9FQk1BQVFJREJBVUdCd2dKQ2dzTURRNFBDeEJLUWYvL0EzRWlBRUdBL2dOeFFRaDJKSUVDSUFCQi93RnhKSUlDREE4TEk0SUNRZjhCY1NPQkFrSC9BWEZCQ0hSeUlRQWpnQUloQVVFRUVFa2dBQ0FCRUVNTUVRc2pnZ0pCL3dGeEk0RUNRZjhCY1VFSWRISkJBV3BCLy84RGNTRUFEQkVMSTRFQ0lnQkJEM0ZCQVdwQkVIRkJBRWRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJha0gvQVhFaUFDU0JBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NEQThMUVFFamdRSWlBRUVQY1V0QkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYTBIL0FYRWlBQ1NCQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQndBQnlRZjhCY1NTSEFnd09DMEVFRUVramlRSVFDeTBBQUNTQkFnd0xDeU9BQWlJQVFZQUJjVUdBQVVaQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBRUVCZENBQVFmOEJjVUVIZG5KQi93RnhKSUFDREFzTEVFcEIvLzhEY1NFQUk0Z0NJUUZCQ0JCSklBQWdBUkJMREFnTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlnQWpnZ0pCL3dGeEk0RUNRZjhCY1VFSWRISWlBVUVBRUV3Z0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRpU0ZBaUFBUWY4QmNTU0dBaU9IQWtHL0FYRWtod0pCQ0E4TEk0SUNRZjhCY1NPQkFrSC9BWEZCQ0hSeUlRQkJCQkJKSUFBUU5rSC9BWEVrZ0FJTUNRc2pnZ0pCL3dGeEk0RUNRZjhCY1VFSWRISkJBV3RCLy84RGNTRUFEQWtMSTRJQ0lnQkJEM0ZCQVdwQkVIRkJBRWRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJha0gvQVhFaUFDU0NBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NEQWNMUVFFamdnSWlBRUVQY1V0QkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYTBIL0FYRWlBQ1NDQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQndBQnlRZjhCY1NTSEFnd0dDMEVFRUVramlRSVFDeTBBQUNTQ0Fnd0RDeU9BQWlJQVFRRnhRUUJMUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTElBQkJCM1FnQUVIL0FYRkJBWFp5UWY4QmNTU0FBZ3dEQzBGL0R3c2ppUUpCQW1wQi8vOERjU1NKQWd3Q0N5T0pBa0VCYWtILy93TnhKSWtDREFFTEk0Y0NRZjhBY1NTSEFpT0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NDMEVFRHdzZ0FFR0EvZ054UVFoMkpJRUNJQUJCL3dGeEpJSUNRUWdMOGdnQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRVFhdzRRQUFFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSS80QkJFQkJCQkJKUWMzK0F4QTJRZjhCY1NJQUlRRWdBRUVCY1FSQUlBRkJmbkVpQUVHQUFYRUVmMEVBSlA4QklBQkIvMzV4QlVFQkpQOEJJQUJCZ0FGeUN5RUFRUVFRU1VITi9nTWdBQkJEUWNRQUR3c0xRUUVramdJTUVBc1FTa0gvL3dOeElnQkJnUDREY1VFSWRpU0RBaUFBUWY4QmNTU0VBaU9KQWtFQ2FrSC8vd054SklrQ0RCRUxJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlJUUFqZ0FJaEFVRUVFRWtnQUNBQkVFTU1FQXNqaEFKQi93RnhJNE1DUWY4QmNVRUlkSEpCQVdwQi8vOERjU0VBREJBTEk0TUNJZ0JCRDNGQkFXcEJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYWtIL0FYRWtnd0lqZ3dKRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lNRGd0QkFTT0RBaUlBUVE5eFMwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGclFmOEJjU1NEQWlPREFrVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SU1EUXRCQkJCSkk0a0NFQXN0QUFBa2d3SU1DZ3NqZ0FJaUFVR0FBWEZCZ0FGR0lRQWpod0pCQkhaQkFYRWdBVUVCZEhKQi93RnhKSUFDREFvTFFRUVFTU09KQWhBTExRQUFJUUFqaVFJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSWtDUVFnUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpSUFJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlJZ0ZCQUJCTUlBQWdBV3BCLy84RGNTSUFRWUQrQTNGQkNIWWtoUUlnQUVIL0FYRWtoZ0lqaHdKQnZ3RnhKSWNDUVFnUEN5T0VBa0gvQVhFamd3SkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklBQ0RBZ0xJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlRUUZyUWYvL0EzRWhBQXdJQ3lPRUFpSUFRUTl4UVFGcVFSQnhRUUJIUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBQkJBV3BCL3dGeElnQWtoQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBZ3dHQzBFQkk0UUNJZ0JCRDNGTFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxJQUJCQVd0Qi93RnhJZ0FraEFJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SU1CUXRCQkJCSkk0a0NFQXN0QUFBa2hBSU1BZ3NqZ0FJaUFVRUJjU0VBSTRjQ1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpU0FBZ3dDQzBGL0R3c2ppUUpCQVdwQi8vOERjU1NKQWd3QkN5QUFRUUJLQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSTRjQ1FmOEFjU1NIQWlPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0MwRUVEd3NnQUVHQS9nTnhRUWgySklNQ0lBQkIvd0Z4SklRQ1FRZ0xqUW9CQW44Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCSUdzT0VBQUJBZ01FQlFZSENBa0tDd3dORGc4UUN5T0hBa0VIZGtFQmNRUkFJNGtDUVFGcVFmLy9BM0VraVFJRlFRUVFTU09KQWhBTExRQUFJUUFqaVFJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSWtDQzBFSUR3c1FTa0gvL3dOeElnQkJnUDREY1VFSWRpU0ZBaUFBUWY4QmNTU0dBaU9KQWtFQ2FrSC8vd054SklrQ0RCQUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUFqZ0FJaEFVRUVFRWtnQUNBQkVFTWdBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkaVNGQWlBQVFmOEJjU1NHQWd3UEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElRQU1Ed3NqaFFJaUFFRVBjVUVCYWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnFRZjhCY1NJQUpJVUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SU1EUXRCQVNPRkFpSUFRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZyUWY4QmNTSUFKSVVDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtIQUFISkIvd0Z4SkljQ0RBd0xRUVFRU1NPSkFoQUxMUUFBSklVQ0RBb0xRUVpCQUNPSEFpSUNRUVYyUVFGeFFRQkxHeUlBUWVBQWNpQUFJQUpCQkhaQkFYRkJBRXNiSVFFamdBSWhBQ0FDUVFaMlFRRnhRUUJMQkg4Z0FDQUJhMEgvQVhFRklBRkJCbklnQVNBQVFROXhRUWxMR3lJQlFlQUFjaUFCSUFCQm1RRkxHeUlCSUFCcVFmOEJjUXNpQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJQUZCNEFCeFFRQkhRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSTRjQ1FkOEJjU1NIQWlBQUpJQUNEQW9MSTRjQ1FRZDJRUUZ4UVFCTEJFQkJCQkJKSTRrQ0VBc3RBQUFoQUNPSkFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VraVFJRkk0a0NRUUZxUWYvL0EzRWtpUUlMUVFnUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpSUFJQUJCQUJCTUlBQkJBWFJCLy84RGNTSUFRWUQrQTNGQkNIWWtoUUlnQUVIL0FYRWtoZ0lqaHdKQnZ3RnhKSWNDUVFnUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklBQ0lBQkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIWWtoUUlnQUVIL0FYRWtoZ0lNQndzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NFQURBY0xJNFlDSWdCQkQzRkJBV3BCRUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmFrSC9BWEVpQUNTR0FpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0RBVUxRUUVqaGdJaUFFRVBjVXRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJhMEgvQVhFaUFDU0dBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd3RUMwRUVFRWtqaVFJUUN5MEFBQ1NHQWd3Q0N5T0FBa0YvYzBIL0FYRWtnQUlqaHdKQndBQnlRZjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNQWd0QmZ3OExJNGtDUVFGcVFmLy9BM0VraVFJTFFRUVBDeUFBUVlEK0EzRkJDSFlraFFJZ0FFSC9BWEVraGdKQkNBdWtDUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJNR3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPSEFrRUVka0VCY1FSQUk0a0NRUUZxUWYvL0EzRWtpUUlGUVFRUVNTT0pBaEFMTFFBQUlRQWppUUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJa0NDMEVJRHdzUVNrSC8vd054SklnQ0k0a0NRUUpxUWYvL0EzRWtpUUlNRUFzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFDT0FBaUVCUVFRUVNTQUFJQUVRUXlBQVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMkpJVUNJQUJCL3dGeEpJWUNEQThMSTRnQ1FRRnFRZi8vQTNFa2lBSkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQkpJQUJCLy84RGNTSUFFRFlpQVVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFCUVFGcVFmOEJjU0lCUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NRUVFRU1NBQUlBRVFRd3dOQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTVUVCSUFCQi8vOERjU0lBRURZaUFVRVBjVXRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FVRUJhMEgvQVhFaUFVVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SkJCQkJKSUFBZ0FSQkREQXdMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQkpJNGtDRUFzdEFBQWhBVUVFRUVrZ0FFSC8vd054SUFGQi93RnhFRU1NQ2dzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpT0hBa0VRY2tIL0FYRWtod0lNQ2dzamh3SkJCSFpCQVhFRVFFRUVFRWtqaVFJUUN5MEFBQ0VBSTRrQ0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NKQWdVamlRSkJBV3BCLy84RGNTU0pBZ3RCQ0E4TEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlnQWppQUpCQUJCTUlBQWppQUpxUWYvL0EzRWlBRUdBL2dOeFFRaDJKSVVDSUFCQi93RnhKSVlDSTRjQ1FiOEJjU1NIQWtFSUR3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVrZ0FCQTJRZjhCY1NTQUFpQUFRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDJKSVVDSUFCQi93RnhKSVlDREFjTEk0Z0NRUUZyUWYvL0EzRWtpQUpCQ0E4TEk0QUNJZ0JCRDNGQkFXcEJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYWtIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDREFVTFFRRWpnQUlpQUVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmEwSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBZ3dFQzBFRUVFa2ppUUlRQ3kwQUFDU0FBZ3dDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRUVIyUVFGeFFRQk5RUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMREFJTFFYOFBDeU9KQWtFQmFrSC8vd054SklrQ0MwRUVDL2tCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCUUdvT0VBOEFBUUlEQkFVR0J3OElDUW9MREEwT0N5T0NBaVNCQWd3T0N5T0RBaVNCQWd3TkN5T0VBaVNCQWd3TUN5T0ZBaVNCQWd3TEN5T0dBaVNCQWd3S0N5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklFQ0RBa0xJNEFDSklFQ0RBZ0xJNEVDSklJQ0RBY0xJNE1DSklJQ0RBWUxJNFFDSklJQ0RBVUxJNFVDSklJQ0RBUUxJNFlDSklJQ0RBTUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQVFOa0gvQVhFa2dnSU1BZ3NqZ0FJa2dnSU1BUXRCZnc4TFFRUUwrZ0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQUdzT0VBQUJEd0lEQkFVR0J3Z0pEd29MREEwT0N5T0JBaVNEQWd3T0N5T0NBaVNEQWd3TkN5T0VBaVNEQWd3TUN5T0ZBaVNEQWd3TEN5T0dBaVNEQWd3S0N5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklNQ0RBa0xJNEFDSklNQ0RBZ0xJNEVDSklRQ0RBY0xJNElDSklRQ0RBWUxJNE1DSklRQ0RBVUxJNFVDSklRQ0RBUUxJNFlDSklRQ0RBTUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQVFOa0gvQVhFa2hBSU1BZ3NqZ0FJa2hBSU1BUXRCZnc4TFFRUUwrZ0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQUdzT0VBQUJBZ01QQkFVR0J3Z0pDZ3NQREEwT0N5T0JBaVNGQWd3T0N5T0NBaVNGQWd3TkN5T0RBaVNGQWd3TUN5T0VBaVNGQWd3TEN5T0dBaVNGQWd3S0N5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklVQ0RBa0xJNEFDSklVQ0RBZ0xJNEVDSklZQ0RBY0xJNElDSklZQ0RBWUxJNE1DSklZQ0RBVUxJNFFDSklZQ0RBUUxJNFVDSklZQ0RBTUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQVFOa0gvQVhFa2hnSU1BZ3NqZ0FJa2hnSU1BUXRCZnc4TFFRUUwyZ01CQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQnJEaEFBQVFJREJBVUdCd2dKQ2dzTURRNFFEd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUNPQkFpRUJRUVFRU1NBQUlBRVFRd3dQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQUk0SUNJUUZCQkJCSklBQWdBUkJEREE0TEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQWpnd0loQVVFRUVFa2dBQ0FCRUVNTURRc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBQ09FQWlFQlFRUVFTU0FBSUFFUVF3d01DeU9HQWtIL0FYRWpoUUlpQUVIL0FYRkJDSFJ5SVFGQkJCQkpJQUVnQUJCRERBc0xJNFlDSWdCQi93RnhJNFVDUWY4QmNVRUlkSEloQVVFRUVFa2dBU0FBRUVNTUNnc2orUUZGQkVBQ1FDTzBBUVJBUVFFa2l3SU1BUXNqdGdFanZBRnhRUjl4UlFSQVFRRWtqQUlNQVF0QkFTU05BZ3NMREFrTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQWpnQUloQVVFRUVFa2dBQ0FCRUVNTUNBc2pnUUlrZ0FJTUJ3c2pnZ0lrZ0FJTUJnc2pnd0lrZ0FJTUJRc2poQUlrZ0FJTUJBc2poUUlrZ0FJTUF3c2poZ0lrZ0FJTUFnc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVrZ0FCQTJRZjhCY1NTQUFnd0JDMEYvRHd0QkJBdWtBZ0VGZnlPQUFpSURJUVFnQUVIL0FYRWlBU0VDSUFGQkFFOEVRQ0FFUVE5eElBSkJEM0ZxUVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMQlNBQ1FSOTJJZ1VnQWlBRmFuTkJEM0VnQkVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NMSUFGQkFFOEVRQ0FEUWY4QmNTQUJJQU5xUWY4QmNVdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NGSUFGQkgzWWlBaUFCSUFKcWN5QURRZjhCY1VwQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0xJQUFnQTJwQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWd1dkFRRUNmeUFBSTRBQ0lnRnFJNGNDUVFSMlFRRnhha0gvQVhFaUFpQUFJQUZ6YzBFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQklBQkIvd0Z4YWlPSEFrRUVka0VCY1dwQmdBSnhRUUJMUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTElBSWtnQUlnQWtWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBZ3Y0QVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR0FBV3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPQkFoQlZEQkFMSTRJQ0VGVU1Ed3NqZ3dJUVZRd09DeU9FQWhCVkRBMExJNFVDRUZVTURBc2poZ0lRVlF3TEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWVFWUXdLQ3lPQUFoQlZEQWtMSTRFQ0VGWU1DQXNqZ2dJUVZnd0hDeU9EQWhCV0RBWUxJNFFDRUZZTUJRc2poUUlRVmd3RUN5T0dBaEJXREFNTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJKSUFBUU5oQldEQUlMSTRBQ0VGWU1BUXRCZnc4TFFRUUxxd0lCQlg4amdBSWlBeUVFUVFBZ0FFSC9BWEZySWdFaEFpQUJRUUJPQkVBZ0JFRVBjU0FDUVE5eGFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N3VWdBa0VmZFNJRklBSWdCV3B6UVE5eElBUkJEM0ZMUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTEN5QUJRUUJPQkVBZ0EwSC9BWEVnQVNBRGFrSC9BWEZMUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTEJTQUJRUjkxSWdJZ0FTQUNhbk1nQTBIL0FYRktRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMQ3lBRElBQnJRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDQzdNQkFRSi9JNEFDSWdFZ0FHc2pod0pCQkhaQkFYRnJRZjhCY1NJQ0lBQWdBWE56UVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMSUFFZ0FFSC9BWEZySTRjQ1FRUjJRUUZ4YTBHQUFuRkJBRXRCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzZ0FpU0FBaUFDUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd2NEFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdRQVdzT0VBQUJBZ01FQlFZSENBa0tDd3dORGc4UUN5T0JBaEJZREJBTEk0SUNFRmdNRHdzamd3SVFXQXdPQ3lPRUFoQllEQTBMSTRVQ0VGZ01EQXNqaGdJUVdBd0xDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNTQUFFRFlRV0F3S0N5T0FBaEJZREFrTEk0RUNFRmtNQ0FzamdnSVFXUXdIQ3lPREFoQlpEQVlMSTRRQ0VGa01CUXNqaFFJUVdRd0VDeU9HQWhCWkRBTUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQVFOaEJaREFJTEk0QUNFRmtNQVF0QmZ3OExRUVFMNXdrQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJvQUZyRGhBQUFRSURCQVVHQndnSkNnc01EUTRQRUFzamdRSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNRUFzamdnSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNRHdzamd3SWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNRGdzamhBSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNRFFzamhRSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNREFzamhnSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNQ3dzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRWtnQUJBMkk0QUNjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NEQW9MSTRBQ0lnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdJTUNRc2pnUUlqZ0FKelFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0RBZ0xJNElDSTRBQ2MwSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFnd0hDeU9EQWlPQUFuTkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SU1CZ3NqaEFJamdBSnpRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NEQVVMSTRVQ0k0QUNjMEgvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBZ3dFQ3lPR0FpT0FBbk5CL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRWtnQUJBMkk0QUNjMEgvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBZ3dDQzBFQUpJQUNJNGNDUVlBQmNrSC9BWEVraHdJamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFnd0JDMEYvRHdzamh3SkI3d0Z4SkljQ1FRUUxvQUlCQkg4amdBSWlBaUVEUVFBZ0FFSC9BWEZySWdBaEFTQUFRUUJPQkVBZ0EwRVBjU0FCUVE5eGFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N3VWdBVUVmZFNJRUlBRWdCR3B6UVE5eElBTkJEM0ZMUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTEN5QUFRUUJPQkVBZ0FrSC9BWEVnQUNBQ2FrSC9BWEZMUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTEJTQUFRUjkxSWdFZ0FDQUJhbk1nQWtIL0FYRktRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMQ3lBQUlBSnFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBZ3ZNQmdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR3dBV3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPQkFpT0FBbkpCL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lqaHdKQjd3RnhKSWNDREJBTEk0SUNJNEFDY2tIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTUR3c2pnd0lqZ0FKeVFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd09DeU9FQWlPQUFuSkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQTBMSTRVQ0k0QUNja0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaU9IQWtIdkFYRWtod0lNREFzamhnSWpnQUp5UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWd3TEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWWpnQUp5UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWd3S0N5T0FBa0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaU9IQWtIdkFYRWtod0lNQ1FzamdRSVFYQXdJQ3lPQ0FoQmNEQWNMSTRNQ0VGd01CZ3NqaEFJUVhBd0ZDeU9GQWhCY0RBUUxJNFlDRUZ3TUF3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVrZ0FCQTJFRndNQWdzamdBSVFYQXdCQzBGL0R3dEJCQXRGQVFKL0lBQVFOU0lCUVg5R0JIOGdBQkFMTFFBQUJTQUJDMEgvQVhFaEFpQUNJQUJCQVdvaUFSQTFJZ0JCZjBZRWZ5QUJFQXN0QUFBRklBQUxRZjhCY1VFSWRISUwrUkVCQlg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRUhjU0lGRGdnQUFRSURCQVVHQndnTEk0RUNJUUVNQndzamdnSWhBUXdHQ3lPREFpRUJEQVVMSTRRQ0lRRU1CQXNqaFFJaEFRd0RDeU9HQWlFQkRBSUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUZCQkJCSklBRVFOaUVCREFFTEk0QUNJUUVMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkaUlFRGhBQUFRSURCQVVHQndnSkNnc01EUTRQRUFzZ0FFRUhUQVIvSUFGQmdBRnhRWUFCUmtFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUJRUUYwSUFGQi93RnhRUWQyY2tIL0FYRWlBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SkJBUVVnQUVFUFRBUi9JQUZCQVhGQkFFdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQVVFSGRDQUJRZjhCY1VFQmRuSkIvd0Z4SWdKRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDUVFFRlFRQUxDeUVEREE4TElBQkJGMHdFZnlPSEFrRUVka0VCY1NBQlFRRjBja0gvQVhFaEFpQUJRWUFCY1VHQUFVWkJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWtWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0pCQVFVZ0FFRWZUQVIvSTRjQ1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpRUNJQUZCQVhGQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SkJBUVZCQUFzTElRTU1EZ3NnQUVFblRBUi9JQUZCQVhSQi93RnhJUUlnQVVHQUFYRkJnQUZHUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTElBSkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ1FRRUZJQUJCTDB3RWZ5QUJRUUZ4SVFBZ0FVSC9BWEZCQVhZaUFrR0FBWElnQWlBQlFZQUJjVUdBQVVZYklnSkIvd0Z4UlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaUFBUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTFFRRUZRUUFMQ3lFRERBMExJQUJCTjB3RWZ5QUJRUTl4UVFSMElBRkI4QUZ4UVFSMmNpSUNSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpT0hBa0h2QVhFa2h3SkJBUVVnQUVFL1RBUi9JQUZCL3dGeFFRRjJJZ0pGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJQUZCQVhGQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFndEJBUVZCQUFzTElRTU1EQXNnQUVISEFFd0VmeUFCSWdKQkFYRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NRUUVGSUFCQnp3Qk1CSDhnQVNJQ1FRSnhSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRU0J5UWY4QmNTU0hBa0VCQlVFQUN3c2hBd3dMQ3lBQVFkY0FUQVIvSUFFaUFrRUVjVVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0pCQVFVZ0FFSGZBRXdFZnlBQklnSkJDSEZGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCSUhKQi93RnhKSWNDUVFFRlFRQUxDeUVEREFvTElBQkI1d0JNQkg4Z0FTSUNRUkJ4UlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWtFQkJTQUFRZThBVEFSL0lBRWlBa0VnY1VWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdKQkFRVkJBQXNMSVFNTUNRc2dBRUgzQUV3RWZ5QUJJZ0pCd0FCeFJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFrRUJCU0FBUWY4QVRBUi9JQUVpQWtHQUFYRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NRUUVGUVFBTEN5RUREQWdMSUFCQmh3Rk1CSDlCQVNFRElBRkJmbkVGSUFCQmp3Rk1CSDlCQVNFRElBRkJmWEVGUVFBTEN5RUNEQWNMSUFCQmx3Rk1CSDlCQVNFRElBRkJlM0VGSUFCQm53Rk1CSDlCQVNFRElBRkJkM0VGUVFBTEN5RUNEQVlMSUFCQnB3Rk1CSDlCQVNFRElBRkJiM0VGSUFCQnJ3Rk1CSDlCQVNFRElBRkJYM0VGUVFBTEN5RUNEQVVMSUFCQnR3Rk1CSDlCQVNFRElBRkJ2Mzl4QlNBQVFiOEJUQVIvUVFFaEF5QUJRZjkrY1FWQkFBc0xJUUlNQkFzZ0FFSEhBVXdFZjBFQklRTWdBVUVCY2dVZ0FFSFBBVXdFZjBFQklRTWdBVUVDY2dWQkFBc0xJUUlNQXdzZ0FFSFhBVXdFZjBFQklRTWdBVUVFY2dVZ0FFSGZBVXdFZjBFQklRTWdBVUVJY2dWQkFBc0xJUUlNQWdzZ0FFSG5BVXdFZjBFQklRTWdBVUVRY2dVZ0FFSHZBVXdFZjBFQklRTWdBVUVnY2dWQkFBc0xJUUlNQVFzZ0FFSDNBVXdFZjBFQklRTWdBVUhBQUhJRklBQkIvd0ZNQkg5QkFTRURJQUZCZ0FGeUJVRUFDd3NoQWdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0JRNElBQUVDQXdRRkJnY0lDeUFDSklFQ0RBY0xJQUlrZ2dJTUJnc2dBaVNEQWd3RkN5QUNKSVFDREFRTElBSWtoUUlNQXdzZ0FpU0dBZ3dDQzBFQklBUkJCMHNnQkVFRVNSc0VRQ09HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNTQUFJQUlRUXdzTUFRc2dBaVNBQWd0QkJFRi9JQU1iQzVZRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUZyRGhBQUFRSVJBd1FGQmdjSUNRb0xEQTBPRHdzamh3SkJCM1pCQVhFTkVRd1RDeU9JQWlFQVFRZ1FTU0FBRUY1Qi8vOERjU0VBSTRnQ1FRSnFRZi8vQTNFa2lBSWdBRUdBL2dOeFFRaDJKSUVDSUFCQi93RnhKSUlDUVFRUEN5T0hBa0VIZGtFQmNVVU5EZ3dOQ3lPSEFrRUhka0VCY1EwTUk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFrRUNha0gvL3dOeElRRkJDQkJKSUFBZ0FSQkxEQTBMSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9DQWtIL0FYRWpnUUpCL3dGeFFRaDBjaUVCUVFnUVNTQUFJQUVRU3d3TkMwRUVFRWtqaVFJUUN5MEFBQkJWREEwTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFpRUJRUWdRU1NBQUlBRVFTMEVBSklrQ0RBc0xJNGNDUVFkMlFRRnhSUTBLREF3TEk0Z0NJUUJCQ0JCSklBQVFYa0gvL3dOeEpJa0NJQUJCQW1wQi8vOERjU1NJQWd3SkN5T0hBa0VIZGtFQmNRMEhEQVlMUVFRUVNTT0pBaEFMTFFBQUVGOGhBQ09KQWtFQmFrSC8vd054SklrQ0lBQVBDeU9IQWtFSGRrRUJjVVVOQkNPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFKQkFtcEIvLzhEY1NFQlFRZ1FTU0FBSUFFUVN3d0ZDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWppUUpCQW1wQi8vOERjU0VCUVFnUVNTQUFJQUVRU3d3RUMwRUVFRWtqaVFJUUN5MEFBQkJXREFVTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFpRUJRUWdRU1NBQUlBRVFTMEVJSklrQ0RBTUxRWDhQQ3lPSkFrRUNha0gvL3dOeEpJa0NRUXdQQ3hCS1FmLy9BM0VraVFJTFFRZ1BDeU9KQWtFQmFrSC8vd054SklrQ1FRUVBDeU9JQWlFQVFRZ1FTU0FBRUY1Qi8vOERjU1NKQWlBQVFRSnFRZi8vQTNFa2lBSkJEQXZLQkFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGckRoQUFBUUlOQXdRRkJnY0lDUTBLRFFzTURRc2pod0pCQkhaQkFYRU5Ed3dSQ3lPSUFpRUFRUWdRU1NBQUVGNUIvLzhEY1NFQklBQkJBbXBCLy84RGNTU0lBaUFCUVlEK0EzRkJDSFlrZ3dJZ0FVSC9BWEVraEFKQkJBOExJNGNDUVFSMlFRRnhSUTBNREFzTEk0Y0NRUVIyUVFGeERRb2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NRUUpxUWYvL0EzRWhBVUVJRUVrZ0FDQUJFRXNNQ3dzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRRQ1FmOEJjU09EQWtIL0FYRkJDSFJ5SVFGQkNCQkpJQUFnQVJCTERBc0xRUVFRU1NPSkFoQUxMUUFBRUZnTUN3c2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCSklBQWdBUkJMUVJBa2lRSU1DUXNqaHdKQkJIWkJBWEZGRFFnTUNnc2ppQUloQUVFSUVFa2dBQkJlUWYvL0EzRWtpUUpCQVNTMUFTQUFRUUpxUWYvL0EzRWtpQUlNQndzamh3SkJCSFpCQVhFTkJRd0VDeU9IQWtFRWRrRUJjVVVOQXlPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFKQkFtcEIvLzhEY1NFQlFRZ1FTU0FBSUFFUVN3d0VDMEVFRUVramlRSVFDeTBBQUJCWkRBVUxJNGdDUVFKclFmLy9BM0VpQUNTSUFpT0pBaUVCUVFnUVNTQUFJQUVRUzBFWUpJa0NEQU1MUVg4UEN5T0pBa0VDYWtILy93TnhKSWtDUVF3UEN4QktRZi8vQTNFa2lRSUxRUWdQQ3lPSkFrRUJha0gvL3dOeEpJa0NRUVFQQ3lPSUFpRUFRUWdRU1NBQUVGNUIvLzhEY1NTSkFpQUFRUUpxUWYvL0EzRWtpQUpCREF1VUJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFGckRoQUFBUUlMQ3dNRUJRWUhDQXNMQ3drS0N3dEJCQkJKSTRrQ0VBc3RBQUFoQUNPQUFpRUJRUVFRU1NBQVFmOEJjVUdBL2dOcUlBRVFRd3dMQ3lPSUFpRUFRUWdRU1NBQUVGNUIvLzhEY1NFQklBQkJBbXBCLy84RGNTU0lBaUFCUVlEK0EzRkJDSFlraFFJZ0FVSC9BWEVraGdKQkJBOExJNElDUVlEK0Eyb2hBQ09BQWlFQlFRUVFTU0FBSUFFUVEwRUVEd3NqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUZCQ0JCSklBQWdBUkJMUVFnUEMwRUVFRWtqaVFJUUN5MEFBQ09BQW5FaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWlPSEFrSHZBWEVraHdJTUJ3c2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCSklBQWdBUkJMUVNBa2lRSkJDQThMUVFRUVNTT0pBaEFMTEFBQUlRQWppQUlnQUVFQkVFd2dBQ09JQW1wQi8vOERjU1NJQWlPSEFrSC9BSEVraHdJamh3SkJ2d0Z4SkljQ0k0a0NRUUZxUWYvL0EzRWtpUUpCREE4TEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUpJa0NRUVFQQ3hCS1FmLy9BM0VoQUNPQUFpRUJRUVFRU1NBQUlBRVFReU9KQWtFQ2FrSC8vd054SklrQ1FRUVBDMEVFRUVramlRSVFDeTBBQUNPQUFuTkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQUlMSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9KQWlFQlFRZ1FTU0FBSUFFUVMwRW9KSWtDUVFnUEMwRi9Ed3NqaVFKQkFXcEIvLzhEY1NTSkFrRUVDL29FQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FXc09FQUFCQWdNTkJBVUdCd2dKQ2cwTkN3d05DMEVFRUVramlRSVFDeTBBQUNFQVFRUVFTU0FBUWY4QmNVR0EvZ05xRURaQi93RnhKSUFDREEwTEk0Z0NJUUJCQ0JCSklBQVFYa0gvL3dOeElRRWdBRUVDYWtILy93TnhKSWdDSUFGQmdQNERjVUVJZGlTQUFpQUJRZjhCY1NTSEFnd05DeU9DQWtHQS9nTnFJUUJCQkJCSklBQVFOa0gvQVhFa2dBSU1EQXRCQUNTMEFRd0xDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWpod0pCL3dGeEk0QUNRZjhCY1VFSWRISWhBVUVJRUVrZ0FDQUJFRXRCQ0E4TFFRUVFTU09KQWhBTExRQUFJNEFDY2tIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTUNBc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCSklBQWdBUkJMUVRBa2lRSkJDQThMUVFRUVNTT0pBaEFMTFFBQUlRQWpod0pCL3dCeEpJY0NJNGNDUWI4QmNTU0hBaU9JQWlJQklBQkJHSFJCR0hVaUFFRUJFRXdnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FpT0pBa0VCYWtILy93TnhKSWtDUVFnUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpU0lBa0VJRHdzUVNrSC8vd054SVFCQkJCQkpJQUFRTmtIL0FYRWtnQUlqaVFKQkFtcEIvLzhEY1NTSkFnd0ZDMEVCSkxVQkRBUUxRUVFRU1NPSkFoQUxMUUFBRUZ3TUFnc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCSklBQWdBUkJMUVRna2lRSkJDQThMUVg4UEN5T0pBa0VCYWtILy93TnhKSWtDQzBFRUM3d0JBUUYvSTRrQ1FRRnFRZi8vQTNFaUFVRUJhMEgvL3dOeElBRWpqUUliSklrQ0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFlPRHdBQkFnTUVCUVlIQ0FrS0N3d05EZzhMSUFBUVRROExJQUFRVGc4TElBQVFUdzhMSUFBUVVBOExJQUFRVVE4TElBQVFVZzhMSUFBUVV3OExJQUFRVkE4TElBQVFWdzhMSUFBUVdnOExJQUFRV3c4TElBQVFYUThMSUFBUVlBOExJQUFRWVE4TElBQVFZZzhMSUFBUVl3dTJBUUVDZjBFQUpMUUJRWS8rQXhBTExRQUFRWDRnQUhkeElnRWt2QUZCai80REVBc2dBVG9BQUNPSUFrRUNhMEgvL3dOeEpJZ0NJNGtDSVFFamlBSWlBaEFMSUFFNkFBQWdBa0VCYWhBTElBRkJnUDREY1VFSWRqb0FBQUpBQWtBQ1FBSkFBa0FDUUNBQURnVUFBUUlEQkFVTFFRQWt2UUZCd0FBa2lRSU1CQXRCQUNTK0FVSElBQ1NKQWd3REMwRUFKTDhCUWRBQUpJa0NEQUlMUVFBa3dBRkIyQUFraVFJTUFRdEJBQ1RCQVVIZ0FDU0pBZ3NMNXdFQkFYOGp0UUVFUUVFQkpMUUJRUUFrdFFFTEk3WUJJN3dCY1VFZmNVRUFTd1JBSTR3Q1JVRUFJN1FCR3dSL0k3MEJRUUFqdHdFYkJIOUJBQkJsUVFFRkk3NEJRUUFqdUFFYkJIOUJBUkJsUVFFRkk3OEJRUUFqdVFFYkJIOUJBaEJsUVFFRkk4QUJRUUFqdWdFYkJIOUJBeEJsUVFFRkk4RUJRUUFqdXdFYkJIOUJCQkJsUVFFRlFRQUxDd3NMQ3dWQkFBc0VmMEVCSTR3Q0k0c0NHd1IvUVFBa2pBSkJBQ1NMQWtFQUpJMENRUUFramdKQkdBVkJGQXNGUVFBTElRQkJBU09NQWlPTEFoc0VRRUVBSkl3Q1FRQWtpd0pCQUNTTkFrRUFKSTRDQ3lBQUR3dEJBQXV0QVFFQ2YwRUJKSlVDSTQwQ0JFQWppUUlRQ3kwQUFCQmtFRWxCQUNTTUFrRUFKSXNDUVFBa2pRSkJBQ1NPQWdzUVppSUJRUUJLQkVBZ0FSQkpDMEVBSTQ0Q1JVRUJJNHdDSTRzQ0d4c0VmeU9KQWhBTExRQUFFR1FGUVFRTElRRWpod0pCOEFGeEpJY0NJQUZCQUV3RVFDQUJEd3NnQVJCSkk1UUNRUUZxSWdBamtnSk9CSDhqa3dKQkFXb2trd0lnQUNPU0Ftc0ZJQUFMSkpRQ0k0a0NJOW9CUmdSQVFRRWszUUVMSUFFTEJRQWpzd0VMcVFFQkEzOGdBRUYvUVlBSUlBQkJBRWdiSUFCQkFFb2JJUUFEUUNQZEFVVkJBQ0FCUlVFQVFRQWdBa1VnQXhzYkd3UkFFR2RCQUVnRVFFRUJJUU1GSTRvQ1FkQ2tCQ1AvQVhST0JFQkJBU0VDQlVFQklBRWpzd0VnQUU1QkFDQUFRWDlLR3hzaEFRc0xEQUVMQ3lBQ0JFQWppZ0pCMEtRRUkvOEJkR3NraWdKQkFBOExJQUVFUUVFQkR3c2ozUUVFUUVFQUpOMEJRUUlQQ3lPSkFrRUJhMEgvL3dOeEpJa0NRWDhMQmdCQmZ4QnBDek1CQW44RFFDQUJRUUJPUVFBZ0FpQUFTQnNFUUVGL0VHa2hBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0ZBQ09QQWdzRkFDT1FBZ3NGQUNPUkFndnhBUUVCZjBFQUpJNENBbjhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUE0SUFBRUNBd1FGQmdjSUN5UFBBUXdJQ3lQU0FRd0hDeVBRQVF3R0N5UFJBUXdGQ3lQVEFRd0VDeVBVQVF3REN5UFZBUXdDQ3lQV0FRd0JDMEVBQzBVaEFRSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFEZ2dBQVFJREJBVUdCd2dMUVFFa3p3RU1Cd3RCQVNUU0FRd0dDMEVCSk5BQkRBVUxRUUVrMFFFTUJBdEJBU1RUQVF3REMwRUJKTlFCREFJTFFRRWsxUUVNQVF0QkFTVFdBUXNnQVFSQVFRRWdBRUVEVENJQlFRQWoyQUViQkg5QkFRVkJBQXNnQVVWQkFDUFpBUnNiQkVCQkFTVEJBVUVFRUNnTEN3dVNBUUFnQUVFQVNnUkFRUUFRYndWQkFDVFBBUXNnQVVFQVNnUkFRUUVRYndWQkFDVFNBUXNnQWtFQVNnUkFRUUlRYndWQkFDVFFBUXNnQTBFQVNnUkFRUU1RYndWQkFDVFJBUXNnQkVFQVNnUkFRUVFRYndWQkFDVFRBUXNnQlVFQVNnUkFRUVVRYndWQkFDVFVBUXNnQmtFQVNnUkFRUVlRYndWQkFDVFZBUXNnQjBFQVNnUkFRUWNRYndWQkFDVFdBUXNMQndBZ0FDVGFBUXNIQUVGL0pOb0JDd2NBSUFBazJ3RUxCd0JCZnlUYkFRc0hBQ0FBSk53QkN3Y0FRWDhrM0FFTEJRQWpnQUlMQlFBamdRSUxCUUFqZ2dJTEJRQWpnd0lMQlFBamhBSUxCUUFqaFFJTEJRQWpoZ0lMQlFBamh3SUxCUUFqaVFJTEJRQWppQUlMQ2dBamlRSVFDeTBBQUFzRkFDUHFBUXNGQUNQckFRc0ZBQ1BzQVFzRkFDUHRBUXNGQUNQdUFRdlVBd0VKZjBHQWdBSkJnSkFDSStNQkd5RUVRWUM0QWtHQXNBSWo1QUViSVFrRFFDQUdRWUFDU0FSQVFRQWhCUU5BSUFWQmdBSklCRUFnQ1NBR1FRTjFRUVYwYWlBRlFRTjFhaUlIUVlDUWZtb3RBQUFoQVNBR1FRaHZJUUpCQnlBRlFRaHZheUVJSUFRZ0JFR0FrQUpHQkg4Z0FVR0FBV3NnQVVHQUFXb2dBVUdBQVhFYkJTQUJDMEVFZEdvaEF5QUFRUUJLUVFBai9nRWJCSDhnQjBHQTBINXFMUUFBQlVFQUN5SUJRY0FBY1FSQVFRY2dBbXNoQWdzZ0FVRUljVVZGUVExMElnY2dBeUFDUVFGMGFpSURRWUNRZm1wcUxRQUFJUUlnQnlBRFFZR1FmbXBxTFFBQVFRRWdDSFJ4Qkg5QkFnVkJBQXNpQTBFQmFpQURJQUpCQVNBSWRIRWJJUU1nQlNBR1FRaDBha0VEYkNFQ0lBQkJBRXBCQUNQK0FSc0VRQ0FDUVlDaEMyb2lBaUFCUVFkeFFRTjBJQU5CQVhScUlnRkJBV3BCUDNGQmdKQUVhaTBBQUVFSWRDQUJRVDl4UVlDUUJHb3RBQUJ5SWdGQkgzRkJBM1E2QUFBZ0FpQUJRZUFIY1VFRmRrRURkRG9BQVNBQ0lBRkJnUGdCY1VFS2RrRURkRG9BQWdVZ0FrR0FvUXRxSWdFZ0EwSEgvZ01RSVNJRFFZQ0EvQWR4UVJCMk9nQUFJQUVnQTBHQS9nTnhRUWgyT2dBQklBRWdBem9BQWdzZ0JVRUJhaUVGREFFTEN5QUdRUUZxSVFZTUFRc0xDOWtEQVF0L0EwQWdBa0VYU0FSQVFRQWhCUU5BSUFWQkgwZ0VRQ0FGUVE5S0lRa2dBaUlCUVE5S0JIOGdBVUVQYXdVZ0FRdEJCSFFpQVNBRlFROXJhaUFCSUFWcUlBVkJEMG9iSVFkQngvNERJUXBCZnlFRFFRQWhBQU5BSUFCQkNFZ0VRRUVBSVFRRFFDQUVRUVZJQkVBZ0J5QUFJQVJCQTNScVFRSjBJZ0ZCZ3Z3RGFoQUxMUUFBUmdSQUlBa2dBVUdEL0FOcUVBc3RBQUFpQVVFSWNVRUFJLzRCRzBWRlJnUkFBbjlCQlNFRVFjbitBMEhJL2dNZ0FTSURRUkJ4R3lFS1FRZ0xJUUFMQ3lBRVFRRnFJUVFNQVFzTElBQkJBV29oQUF3QkN3c2dBMEVBU0VFQUkvNEJHd1IvUVlDNEFrR0FzQUlqNUFFYklRaEJmeUVBUVFBaEJBTkFJQVJCSUVnRVFFRUFJUVlEUUNBR1FTQklCRUFnQnlBRUlBZ2dCa0VGZEdwcUlnRkJnSkIrYWkwQUFFWUVRQUovUVNBaEJFRWdJUVlnQVFzaEFBc2dCa0VCYWlFR0RBRUxDeUFFUVFGcUlRUU1BUXNMSUFCQkFFNEVmeUFBUVlEUWZtb3RBQUFGUVg4TEJVRi9DeUVCUVlDUUFrR0FnQUlnQWtFUFNoc2hDRUVBSVFBRFFDQUFRUWhJQkVBZ0J5QUlJQWxCQUVFSElBQWdCVUVEZENBQUlBSkJBM1JxUWZnQlFZQ2hGeUFLSUFFZ0F4QWlHaUFBUVFGcUlRQU1BUXNMSUFWQkFXb2hCUXdCQ3dzZ0FrRUJhaUVDREFFTEN3dVlBZ0VKZndOQUlBUkJDRWdFUUVFQUlRSURRQ0FDUVFWSUJFQWdCQ0FDUVFOMGFrRUNkQ0lCUVlEOEEyb1FDeTBBQUJvZ0FVR0IvQU5xRUFzdEFBQWFJQUZCZ3Z3RGFoQUxMUUFBSVFCQkFTRUZJK1VCQkVBQ2YwRUNJUVVnQUVFQ2IwRUJSZ1IvSUFCQkFXc0ZJQUFMQ3lFQUN5QUJRWVA4QTJvUUN5MEFBQ0lHUVFoeFFRQWovZ0ViUlVVaEIwSEovZ05CeVA0RElBWkJFSEViSVFoQkFDRUJBMEFnQVNBRlNBUkFRUUFoQXdOQUlBTkJDRWdFUUNBQUlBRnFRWUNBQWlBSFFRQkJCeUFESUFSQkEzUWdBeUFDUVFSMGFpQUJRUU4wYWtIQUFFR0FvU0FnQ0VGL0lBWVFJaG9nQTBFQmFpRUREQUVMQ3lBQlFRRnFJUUVNQVFzTElBSkJBV29oQWd3QkN3c2dCRUVCYWlFRURBRUxDd3NGQUNQREFRc0ZBQ1BFQVFzRkFDUElBUXNTQVFGL0k4b0JJZ0JCQkhJZ0FDUEpBUnNMTGdFQmZ3TkFJQUJCLy84RFNBUkFJQUJCZ0xYSkJHb2dBQkEyT2dBQUlBQkJBV29oQUF3QkN3dEJBQ1RkQVF0bEFFSHk1Y3NISkR0Qm9NR0NCU1E4UWRpdzRRSWtQVUdJa0NBa1BrSHk1Y3NISkQ5Qm9NR0NCU1JBUWRpdzRRSWtRVUdJa0NBa1FrSHk1Y3NISkVOQm9NR0NCU1JFUWRpdzRRSWtSVUdJa0NBa1JqOEFRWlFCU0FSQVFaUUJQd0JyUUFBYUN3c0RBQUVMdkFFQkFuOGdBQ2dDQkNJQ1FmLy8vLzhBY1NFQklBQW9BZ0JCQVhFRVFFRUFRWUFKUWZvQVFRNFFBQUFMSUFGQkFVWUVRQUpBQWtBQ1FDQUFLQUlJRGdNQ0FnQUJDeUFBS0FJUUlnRUVRQ0FCUWJ3SlR3UkFJQUZCRUdzUWtRRUxDd3dCQ3dBTElBSkJnSUNBZ0hoeEJFQkJBRUdBQ1VIK0FFRVNFQUFBQ3lBQUlBQW9BZ0JCQVhJMkFnQWpBQ0FBRUFJRklBRkJBRTBFUUVFQVFZQUpRWWdCUVJBUUFBQUxJQUFnQVVFQmF5QUNRWUNBZ0lCL2NYSTJBZ1FMQ3h3QUFrQUNRQUpBSTVjQ0RnSUJBZ0FMQUF0QkFDRUFDeUFBRUdrTEhRQUNRQUpBQWtBamx3SU9Bd0VCQWdBTEFBdEJmeUVCQ3lBQkVHa0xCd0FnQUNTWEFnc0x2d0VFQUVHQUNBc3RIZ0FBQUFFQUFBQUJBQUFBSGdBQUFINEFiQUJwQUdJQUx3QnlBSFFBTHdCMEFHd0Fjd0JtQUM0QWRBQnpBRUd3Q0FzM0tBQUFBQUVBQUFBQkFBQUFLQUFBQUdFQWJBQnNBRzhBWXdCaEFIUUFhUUJ2QUc0QUlBQjBBRzhBYndBZ0FHd0FZUUJ5QUdjQVpRQkI4QWdMTFI0QUFBQUJBQUFBQVFBQUFCNEFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDOEFjQUIxQUhJQVpRQXVBSFFBY3dCQm9Ba0xGUU1BQUFBZ0FBQUFBQUFBQUNBQUFBQUFBQUFBSUFBekVITnZkWEpqWlUxaGNIQnBibWRWVWt3aFkyOXlaUzlrYVhOMEwyTnZjbVV1ZFc1MGIzVmphR1ZrTG5kaGMyMHViV0Z3Iik6CmF3YWl0IE8oImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCZlJCZ0FBRi9ZQUYvQVg5Z0FYOEFZQUFBWUFKL2Z3Ri9ZQUovZndCZ0EzOS9md0JnQm45L2YzOS9md0JnQkg5L2YzOEFZQWQvZjM5L2YzOS9BR0FJZjM5L2YzOS9mMzhBWUFwL2YzOS9mMzkvZjM5L0FHQURmMzkvQVg5Z0JIOS9mMzhCZjJBRmYzOS9mMzhCZjJBTmYzOS9mMzkvZjM5L2YzOS9md0YvQWcwQkEyVnVkZ1ZoWW05eWRBQUlBNVlCbEFFRkJRWUFCQVlNQkFFQ0FRTUNBZ01EQXdzQUF3TURBd01EQXdNQUFBQUFEZ1FQQ1FjSEJRSUNBd0VCQVFFQkRRSUNBd0VBQVFFRkF3SUNBZ0lFQWdJQ0FnUUZCZ1FEQWdJQ0FBVUdBUUVCQVFFQkFRRUNBZ0VDQWdFQkFnRUJBUUVCQVFFQkFnQUFBQUVBQVFBQUFBSUtBZ01DQXdJREFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJREF3QUFBQUFEQXdNQ0FRUUNCUU1CQUFFRzNndVlBbjhCUVFBTGZ3RkJBQXQvQUVFQUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFZQ0FBUXQvQUVHQWtBRUxmd0JCZ0lBQ0MzOEFRWUNRQXd0L0FFR0FnQUVMZndCQmdCQUxmd0JCZ0lBRUMzOEFRWUNRQkF0L0FFR0FBUXQvQUVHQWtRUUxmd0JCZ0xnQkMzOEFRWURKQlF0L0FFR0EyQVVMZndCQmdLRUxDMzhBUVlDQURBdC9BRUdBb1JjTGZ3QkJnSUFKQzM4QVFZQ2hJQXQvQUVHQStBQUxmd0JCZ0pBRUMzOEFRWUNKSFF0L0FFR0FtU0VMZndCQmdJQUlDMzhBUVlDWktRdC9BRUdBZ0FnTGZ3QkJnSmt4QzM4QVFZQ0FDQXQvQUVHQW1Ua0xmd0JCZ0lBSUMzOEFRWUNad1FBTGZ3QkJnSUFJQzM4QVFZQ1p5UUFMZndCQmdJQUlDMzhBUVlDWjBRQUxmd0JCZ0JRTGZ3QkJnSzNSQUF0L0FFR0FpUGdEQzM4QVFZQzF5UVFMZndCQi8vOERDMzhBUVFBTGZ3QkJnTFhOQkF0L0FFR1VBUXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQi93QUxmd0ZCL3dBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFR2dDUXQvQVVFQUN3ZWRFV2tHYldWdGIzSjVBZ0FIWDE5aGJHeHZZd0FJQ0Y5ZmNtVjBZV2x1QUFrSlgxOXlaV3hsWVhObEFBb0pYMTlqYjJ4c1pXTjBBSkFCQzE5ZmNuUjBhVjlpWVhObEE1WUNCbU52Ym1acFp3QVNEbWhoYzBOdmNtVlRkR0Z5ZEdWa0FCTUpjMkYyWlZOMFlYUmxBQllKYkc5aFpGTjBZWFJsQUJzRmFYTkhRa01BSEJKblpYUlRkR1Z3YzFCbGNsTjBaWEJUWlhRQUhRdG5aWFJUZEdWd1UyVjBjd0FlQ0dkbGRGTjBaWEJ6QUI4VlpYaGxZM1YwWlUxMWJIUnBjR3hsUm5KaGJXVnpBR3NNWlhobFkzVjBaVVp5WVcxbEFHb1paWGhsWTNWMFpVWnlZVzFsUVc1a1EyaGxZMnRCZFdScGJ3Q1NBUlZsZUdWamRYUmxWVzUwYVd4RGIyNWthWFJwYjI0QWt3RUxaWGhsWTNWMFpWTjBaWEFBWnhSblpYUkRlV05zWlhOUVpYSkRlV05zWlZObGRBQnNER2RsZEVONVkyeGxVMlYwY3dCdENXZGxkRU41WTJ4bGN3QnVEbk5sZEVwdmVYQmhaRk4wWVhSbEFIQWZaMlYwVG5WdFltVnlUMlpUWVcxd2JHVnpTVzVCZFdScGIwSjFabVpsY2dCb0VHTnNaV0Z5UVhWa2FXOUNkV1ptWlhJQUZ4eHpaWFJOWVc1MVlXeERiMnh2Y21sNllYUnBiMjVRWVd4bGRIUmxBQTBYVjBGVFRVSlBXVjlOUlUxUFVsbGZURTlEUVZSSlQwNERMaE5YUVZOTlFrOVpYMDFGVFU5U1dWOVRTVnBGQXk4U1YwRlRUVUpQV1Y5WFFWTk5YMUJCUjBWVEF6QWVRVk5UUlUxQ1RGbFRRMUpKVUZSZlRVVk5UMUpaWDB4UFEwRlVTVTlPQXdJYVFWTlRSVTFDVEZsVFExSkpVRlJmVFVWTlQxSlpYMU5KV2tVREF4WlhRVk5OUWs5WlgxTlVRVlJGWDB4UFEwRlVTVTlPQXdRU1YwRlRUVUpQV1Y5VFZFRlVSVjlUU1ZwRkF3VWdSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlRFOURRVlJKVDA0RERCeEhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5VFNWcEZBdzBTVmtsRVJVOWZVa0ZOWDB4UFEwRlVTVTlPQXdZT1ZrbEVSVTlmVWtGTlgxTkpXa1VEQnhGWFQxSkxYMUpCVFY5TVQwTkJWRWxQVGdNSURWZFBVa3RmVWtGTlgxTkpXa1VEQ1NaUFZFaEZVbDlIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTUtJazlVU0VWU1gwZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURDeGhIVWtGUVNFbERVMTlQVlZSUVZWUmZURTlEUVZSSlQwNERHaFJIVWtGUVNFbERVMTlQVlZSUVZWUmZVMGxhUlFNYkZFZENRMTlRUVV4RlZGUkZYMHhQUTBGVVNVOU9BdzRRUjBKRFgxQkJURVZVVkVWZlUwbGFSUU1QR0VKSFgxQlNTVTlTU1ZSWlgwMUJVRjlNVDBOQlZFbFBUZ01RRkVKSFgxQlNTVTlTU1ZSWlgwMUJVRjlUU1ZwRkF4RU9SbEpCVFVWZlRFOURRVlJKVDA0REVncEdVa0ZOUlY5VFNWcEZBeE1YUWtGRFMwZFNUMVZPUkY5TlFWQmZURTlEUVZSSlQwNERGQk5DUVVOTFIxSlBWVTVFWDAxQlVGOVRTVnBGQXhVU1ZFbE1SVjlFUVZSQlgweFBRMEZVU1U5T0F4WU9WRWxNUlY5RVFWUkJYMU5KV2tVREZ4SlBRVTFmVkVsTVJWTmZURTlEUVZSSlQwNERHQTVQUVUxZlZFbE1SVk5mVTBsYVJRTVpGVUZWUkVsUFgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNa0VVRlZSRWxQWDBKVlJrWkZVbDlUU1ZwRkF5VVpRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWNGVU5JUVU1T1JVeGZNVjlDVlVaR1JWSmZVMGxhUlFNZEdVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlRFOURRVlJKVDA0REhoVkRTRUZPVGtWTVh6SmZRbFZHUmtWU1gxTkpXa1VESHhsRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXlBVlEwaEJUazVGVEY4elgwSlZSa1pGVWw5VFNWcEZBeUVaUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlNVDBOQlZFbFBUZ01pRlVOSVFVNU9SVXhmTkY5Q1ZVWkdSVkpmVTBsYVJRTWpGa05CVWxSU1NVUkhSVjlTUVUxZlRFOURRVlJKVDA0REpoSkRRVkpVVWtsRVIwVmZVa0ZOWDFOSldrVURKeEZDVDA5VVgxSlBUVjlNVDBOQlZFbFBUZ01vRFVKUFQxUmZVazlOWDFOSldrVURLUlpEUVZKVVVrbEVSMFZmVWs5TlgweFBRMEZVU1U5T0F5b1NRMEZTVkZKSlJFZEZYMUpQVFY5VFNWcEZBeXNkUkVWQ1ZVZGZSMEZOUlVKUFdWOU5SVTFQVWxsZlRFOURRVlJKVDA0RExCbEVSVUpWUjE5SFFVMUZRazlaWDAxRlRVOVNXVjlUU1ZwRkF5MGhaMlYwVjJGemJVSnZlVTltWm5ObGRFWnliMjFIWVcxbFFtOTVUMlptYzJWMEFBc2JjMlYwVUhKdlozSmhiVU52ZFc1MFpYSkNjbVZoYTNCdmFXNTBBSEVkY21WelpYUlFjbTluY21GdFEyOTFiblJsY2tKeVpXRnJjRzlwYm5RQWNobHpaWFJTWldGa1IySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFITWJjbVZ6WlhSU1pXRmtSMkpOWlcxdmNubENjbVZoYTNCdmFXNTBBSFFhYzJWMFYzSnBkR1ZIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBZFJ4eVpYTmxkRmR5YVhSbFIySk5aVzF2Y25sQ2NtVmhhM0J2YVc1MEFIWU1aMlYwVW1WbmFYTjBaWEpCQUhjTVoyVjBVbVZuYVhOMFpYSkNBSGdNWjJWMFVtVm5hWE4wWlhKREFIa01aMlYwVW1WbmFYTjBaWEpFQUhvTVoyVjBVbVZuYVhOMFpYSkZBSHNNWjJWMFVtVm5hWE4wWlhKSUFId01aMlYwVW1WbmFYTjBaWEpNQUgwTVoyVjBVbVZuYVhOMFpYSkdBSDRSWjJWMFVISnZaM0poYlVOdmRXNTBaWElBZnc5blpYUlRkR0ZqYTFCdmFXNTBaWElBZ0FFWloyVjBUM0JqYjJSbFFYUlFjbTluY21GdFEyOTFiblJsY2dDQkFRVm5aWFJNV1FDQ0FRcG5aWFJUWTNKdmJHeFlBSU1CQ21kbGRGTmpjbTlzYkZrQWhBRUtaMlYwVjJsdVpHOTNXQUNGQVFwblpYUlhhVzVrYjNkWkFJWUJIV1J5WVhkQ1lXTnJaM0p2ZFc1a1RXRndWRzlYWVhOdFRXVnRiM0o1QUljQkdHUnlZWGRVYVd4bFJHRjBZVlJ2VjJGemJVMWxiVzl5ZVFDSUFSTmtjbUYzVDJGdFZHOVhZWE50VFdWdGIzSjVBSWtCQm1kbGRFUkpWZ0NLQVFkblpYUlVTVTFCQUlzQkJtZGxkRlJOUVFDTUFRWm5aWFJVUVVNQWpRRVRkWEJrWVhSbFJHVmlkV2RIUWsxbGJXOXllUUNPQVJSZlgzTmxkRUZ5WjNWdFpXNTBjMHhsYm1kMGFBQ1VBUWdDandFSytiMENsQUdWQWdFRWZ5QUJLQUlBSWdKQkFYRkZCRUJCQUVHUUNFR1ZBa0VPRUFBQUN5QUNRWHh4SWdKQjhQLy8vd05KUVFBZ0FrRVFUeHRGQkVCQkFFR1FDRUdYQWtFT0VBQUFDeUFDUVlBQ1NRUkFJQUpCQkhZaEFnVWdBa0VmSUFKbmF5SURRUVJyZGtFUWN5RUNJQU5CQjJzaEF3c2dBa0VRU1VFQUlBTkJGMGtiUlFSQVFRQkJrQWhCcEFKQkRoQUFBQXNnQVNnQ0ZDRUVJQUVvQWhBaUJRUkFJQVVnQkRZQ0ZBc2dCQVJBSUFRZ0JUWUNFQXNnQVNBQUlBSWdBMEVFZEdwQkFuUnFLQUpnUmdSQUlBQWdBaUFEUVFSMGFrRUNkR29nQkRZQ1lDQUVSUVJBSUFBZ0EwRUNkR29pQkNnQ0JFRitJQUozY1NFQklBUWdBVFlDQkNBQlJRUkFJQUFnQUNnQ0FFRitJQU4zY1RZQ0FBc0xDd3YvQXdFSGZ5QUJSUVJBUVFCQmtBaEJ6UUZCRGhBQUFBc2dBU2dDQUNJRVFRRnhSUVJBUVFCQmtBaEJ6d0ZCRGhBQUFBc2dBVUVRYWlBQktBSUFRWHh4YWlJRktBSUFJZ0pCQVhFRVFDQUVRWHh4UVJCcUlBSkJmSEZxSWdOQjhQLy8vd05KQkVBQ2Z5QUFJQVVRQVNBQklBTWdCRUVEY1hJaUJEWUNBQ0FCUVJCcUlBRW9BZ0JCZkhGcUlnVW9BZ0FMSVFJTEN5QUVRUUp4QkVBQ2Z5QUJRUVJyS0FJQUlnTW9BZ0FpQjBFQmNVVUVRRUVBUVpBSVFlUUJRUkFRQUFBTElBZEJmSEZCRUdvZ0JFRjhjV29pQ0VIdy8vLy9BMGtFZnlBQUlBTVFBU0FESUFnZ0IwRURjWElpQkRZQ0FDQURCU0FCQ3dzaEFRc2dCU0FDUVFKeU5nSUFJQVJCZkhFaUEwSHcvLy8vQTBsQkFDQURRUkJQRzBVRVFFRUFRWkFJUWZNQlFRNFFBQUFMSUFVZ0F5QUJRUkJxYWtjRVFFRUFRWkFJUWZRQlFRNFFBQUFMSUFWQkJHc2dBVFlDQUNBRFFZQUNTUVJBSUFOQkJIWWhBd1VnQTBFZklBTm5heUlFUVFScmRrRVFjeUVESUFSQkIyc2hCZ3NnQTBFUVNVRUFJQVpCRjBrYlJRUkFRUUJCa0FoQmhBSkJEaEFBQUFzZ0FDQURJQVpCQkhScVFRSjBhaWdDWUNFRUlBRkJBRFlDRUNBQklBUTJBaFFnQkFSQUlBUWdBVFlDRUFzZ0FDQURJQVpCQkhScVFRSjBhaUFCTmdKZ0lBQWdBQ2dDQUVFQklBWjBjallDQUNBQUlBWkJBblJxSWdBZ0FDZ0NCRUVCSUFOMGNqWUNCQXZSQVFFQ2Z5QUNRUTl4UlVFQUlBRkJEM0ZGUVFBZ0FTQUNUUnNiUlFSQVFRQkJrQWhCZ2dOQkJSQUFBQXNnQUNnQ29Bd2lBd1JBSUFFZ0EwRVFha2tFUUVFQVFaQUlRWXdEUVJBUUFBQUxJQU1nQVVFUWEwWUVRQUovSUFNb0FnQWhCQ0FCUVJCckN5RUJDd1VnQVNBQVFhUU1ha2tFUUVFQVFaQUlRWmdEUVFVUUFBQUxDeUFDSUFGcklnSkJNRWtFUUE4TElBRWdCRUVDY1NBQ1FTQnJRUUZ5Y2pZQ0FDQUJRUUEyQWhBZ0FVRUFOZ0lVSUFFZ0FtcEJFR3NpQWtFQ05nSUFJQUFnQWpZQ29Bd2dBQ0FCRUFJTG5nRUJBMzhqQUNJQ1JRUkFRUUUvQUNJQVNnUi9RUUVnQUd0QUFFRUFTQVZCQUFzRVFBQUxRY0FKSVFKQndBbEJBRFlDQUVIZ0ZVRUFOZ0lBQTBBZ0FVRVhTUVJBSUFGQkFuUkJ3QWxxUVFBMkFnUkJBQ0VBQTBBZ0FFRVFTUVJBSUFBZ0FVRUVkR3BCQW5SQndBbHFRUUEyQW1BZ0FFRUJhaUVBREFFTEN5QUJRUUZxSVFFTUFRc0xRY0FKUWZBVlB3QkJFSFFRQTBIQUNTUUFDeUFDQzk4QkFRRi9JQUZCZ0FKSkJFQWdBVUVFZGlFQkJRSi9JQUZCK1AvLy93RkpCRUFnQVVFQlFSc2dBV2RyZEdwQkFXc2hBUXNnQVF0Qkh5QUJaMnNpQWtFRWEzWkJFSE1oQVNBQ1FRZHJJUUlMSUFGQkVFbEJBQ0FDUVJkSkcwVUVRRUVBUVpBSVFkSUNRUTRRQUFBTElBQWdBa0VDZEdvb0FnUkJmeUFCZEhFaUFRUi9JQUFnQVdnZ0FrRUVkR3BCQW5ScUtBSmdCU0FBS0FJQVFYOGdBa0VCYW5SeElnRUVmeUFBSUFGb0lnRkJBblJxS0FJRUlnSkZCRUJCQUVHUUNFSGZBa0VTRUFBQUN5QUFJQUpvSUFGQkJIUnFRUUowYWlnQ1lBVkJBQXNMQzRjQkFRSi9JQUVvQWdBaEF5QUNRUTl4QkVCQkFFR1FDRUh0QWtFT0VBQUFDeUFEUVh4eElBSnJJZ1JCSUU4RVFDQUJJQUlnQTBFQ2NYSTJBZ0FnQWlBQlFSQnFhaUlCSUFSQkVHdEJBWEkyQWdBZ0FDQUJFQUlGSUFFZ0EwRitjVFlDQUNBQlFSQnFJZ0FnQVNnQ0FFRjhjV29nQUNBQktBSUFRWHh4YWlnQ0FFRjljVFlDQUFzTHFnSUJBMzhqQVFSQVFRQkJrQWhCOUFOQkRoQUFBQXNnQVNJRFFmRC8vLzhEVHdSQVFjQUlRWkFJUWMwRFFSNFFBQUFMSUFBZ0EwRVBha0Z3Y1NJQlFSQWdBVUVRU3hzaUFSQUZJZ1JGQkVCQkFTUUJRUUFrQVNBQUlBRVFCU0lFUlFSQUlBRkIrUC8vL3dGSkJIOGdBVUVCUVJzZ0FXZHJkRUVCYTJvRklBRUxRUkEvQUNJRVFSQjBRUkJySUFBb0FxQU1SM1JxUWYvL0EycEJnSUI4Y1VFUWRpRUZJQVFnQlNBRUlBVktHMEFBUVFCSUJFQWdCVUFBUVFCSUJFQUFDd3NnQUNBRVFSQjBQd0JCRUhRUUF5QUFJQUVRQlNJRVJRUkFRUUJCa0FoQmdBUkJGQkFBQUFzTEN5QUVLQUlBUVh4eElBRkpCRUJCQUVHUUNFR0lCRUVPRUFBQUN5QUVRUUEyQWdRZ0JDQUNOZ0lJSUFRZ0F6WUNEQ0FBSUFRUUFTQUFJQVFnQVJBR0lBUUxEUUFRQkNBQUlBRVFCMEVRYWd0aEFRSi9JQUJCdkFsTEJFQWdBRUVRYXlJQktBSUVJZ0pCZ0lDQWdIOXhJQUpCQVdwQmdJQ0FnSDl4UndSQVFRQkJnQWxCN1FCQkF4QUFBQXNnQVNBQ1FRRnFOZ0lFSUFFb0FnQkJBWEVFUUVFQVFZQUpRZkFBUVE0UUFBQUxDeUFBQ3hNQUlBQkJ2QWxMQkVBZ0FFRVFheENSQVFzTGp3SUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVFTWRRNE9BQUVCQVFJQ0FnSURBd1FFQlFZSEN5UDlBUVJBSS80QkJFQWdBRUdBQWtnTkNTQUFRWUFTU0VFQUlBQkIvd05LR3cwSkJVRUFJQUJCZ0FKSUkvNEJHdzBKQ3dzTElBQkJnSzNSQUdvUEN5QUFRWUNBQVdzaEFTQUJRUUFqN3dFaUFFVWo5d0ViQkg5QkFRVWdBQXRCRG5ScVFZQ3QwUUJxRHdzZ0FFR0FrSDVxSS80QkJIOUJ6LzRERUFzdEFBQkJBWEVGUVFBTFFRMTBhZzhMSUFBajhBRkJEWFJxUVlEWnhnQnFEd3NnQUVHQWtINXFEd3NnQUVFQkkvNEJCSDlCOFA0REVBc3RBQUJCQjNFRlFRQUxJZ0VnQVVFQlNSdEJESFJxUVlEd2ZXb1BDeUFBUVlCUWFnOExJQUJCZ0puUkFHb0x3d0VBUVFBay93RkJBQ1NBQWtFQUpJRUNRUUFrZ2dKQkFDU0RBa0VBSklRQ1FRQWtoUUpCQUNTR0FrRUFKSWNDUVFBa2lBSkJBQ1NKQWtFQUpJb0NRUUFraXdKQkFDU01Ba0VBSkkwQ1FRQWtqZ0lqL1FFRVFBOExJLzRCQkVCQkVTU0FBa0dBQVNTSEFrRUFKSUVDUVFBa2dnSkIvd0VrZ3dKQjFnQWtoQUpCQUNTRkFrRU5KSVlDQlVFQkpJQUNRYkFCSkljQ1FRQWtnUUpCRXlTQ0FrRUFKSU1DUWRnQkpJUUNRUUVraFFKQnpRQWtoZ0lMUVlBQ0pJa0NRZjcvQXlTSUFndWhDQUFDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBT0RRQUJBZ01FQlFZSENBa0tDd3dOQzBIeTVjc0hKRHRCb01HQ0JTUThRZGl3NFFJa1BVR0lrQ0FrUGtIeTVjc0hKRDlCb01HQ0JTUkFRZGl3NFFJa1FVR0lrQ0FrUWtIeTVjc0hKRU5Cb01HQ0JTUkVRZGl3NFFJa1JVR0lrQ0FrUmd3TUMwSC8vLzhISkR0QjQ5citCeVE4UVlEaWtBUWtQVUVBSkQ1Qi8vLy9CeVEvUWVQYS9nY2tRRUdBNHBBRUpFRkJBQ1JDUWYvLy93Y2tRMEhqMnY0SEpFUkJnT0tRQkNSRlFRQWtSZ3dMQzBILy8vOEhKRHRCaEluK0J5UThRYnIwMEFRa1BVRUFKRDVCLy8vL0J5US9RYkgrN3dNa1FFR0FpQUlrUVVFQUpFSkIvLy8vQnlSRFFmL0xqZ01rUkVIL0FTUkZRUUFrUmd3S0MwSEZ6ZjhISkR0QmhMbTZCaVE4UWFuV2tRUWtQVUdJNHVnQ0pENUIvLy8vQnlRL1FlUGEvZ2NrUUVHQTRwQUVKRUZCQUNSQ1FmLy8vd2NrUTBIajJ2NEhKRVJCZ09LUUJDUkZRUUFrUmd3SkMwSC8vLzhISkR0QmdQN0xBaVE4UVlDRS9RY2tQVUVBSkQ1Qi8vLy9CeVEvUVlEK3l3SWtRRUdBaFAwSEpFRkJBQ1JDUWYvLy93Y2tRMEdBL3NzQ0pFUkJnSVQ5QnlSRlFRQWtSZ3dJQzBILy8vOEhKRHRCc2Y3dkF5UThRY1hIQVNROVFRQWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSkIvLy8vQnlSRFFZU0ovZ2NrUkVHNjlOQUVKRVZCQUNSR0RBY0xRUUFrTzBHRWlRSWtQRUdBdlA4SEpEMUIvLy8vQnlRK1FRQWtQMEdFaVFJa1FFR0F2UDhISkVGQi8vLy9CeVJDUVFBa1EwR0VpUUlrUkVHQXZQOEhKRVZCLy8vL0J5UkdEQVlMUWFYLy93Y2tPMEdVcWY0SEpEeEIvNm5TQkNROVFRQWtQa0dsLy84SEpEOUJsS24rQnlSQVFmK3AwZ1FrUVVFQUpFSkJwZi8vQnlSRFFaU3AvZ2NrUkVIL3FkSUVKRVZCQUNSR0RBVUxRZi8vL3dja08wR0EvdjhISkR4QmdJRDhCeVE5UVFBa1BrSC8vLzhISkQ5QmdQNy9CeVJBUVlDQS9BY2tRVUVBSkVKQi8vLy9CeVJEUVlEKy93Y2tSRUdBZ1B3SEpFVkJBQ1JHREFRTFFmLy8vd2NrTzBHQS92OEhKRHhCZ0pUdEF5UTlRUUFrUGtILy8vOEhKRDlCLzh1T0F5UkFRZjhCSkVGQkFDUkNRZi8vL3dja1EwR3gvdThESkVSQmdJZ0NKRVZCQUNSR0RBTUxRZi8vL3dja08wSC95NDRESkR4Qi93RWtQVUVBSkQ1Qi8vLy9CeVEvUVlTSi9nY2tRRUc2OU5BRUpFRkJBQ1JDUWYvLy93Y2tRMEd4L3U4REpFUkJnSWdDSkVWQkFDUkdEQUlMUWYvLy93Y2tPMEhlbWJJRUpEeEJqS1hKQWlROVFRQWtQa0gvLy84SEpEOUJoSW4rQnlSQVFicjAwQVFrUVVFQUpFSkIvLy8vQnlSRFFlUGEvZ2NrUkVHQTRwQUVKRVZCQUNSR0RBRUxRZi8vL3dja08wR2x5NVlGSkR4QjBxVEpBaVE5UVFBa1BrSC8vLzhISkQ5QnBjdVdCU1JBUWRLa3lRSWtRVUVBSkVKQi8vLy9CeVJEUWFYTGxnVWtSRUhTcE1rQ0pFVkJBQ1JHQ3d2YUNBQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR0lBVWNFUUNBQVFlRUFSZzBCSUFCQkZFWU5BaUFBUWNZQVJnMERJQUJCMlFCR0RRUWdBRUhHQVVZTkJDQUFRWVlCUmcwRklBQkJxQUZHRFFVZ0FFRy9BVVlOQmlBQVFjNEJSZzBHSUFCQjBRRkdEUVlnQUVId0FVWU5CaUFBUVNkR0RRY2dBRUhKQUVZTkJ5QUFRZHdBUmcwSElBQkJzd0ZHRFFjZ0FFSEpBVVlOQ0NBQVFmQUFSZzBKSUFCQnhnQkdEUW9nQUVIVEFVWU5Dd3dNQzBIL3VaWUZKRHRCZ1A3L0J5UThRWURHQVNROVFRQWtQa0gvdVpZRkpEOUJnUDcvQnlSQVFZREdBU1JCUVFBa1FrSC91WllGSkVOQmdQNy9CeVJFUVlER0FTUkZRUUFrUmd3TEMwSC8vLzhISkR0Qi84dU9BeVE4UWY4QkpEMUJBQ1ErUWYvLy93Y2tQMEdFaWY0SEpFQkJ1dlRRQkNSQlFRQWtRa0gvLy84SEpFTkIvOHVPQXlSRVFmOEJKRVZCQUNSR0RBb0xRZi8vL3dja08wR0VpZjRISkR4QnV2VFFCQ1E5UVFBa1BrSC8vLzhISkQ5QnNmN3ZBeVJBUVlDSUFpUkJRUUFrUWtILy8vOEhKRU5CaEluK0J5UkVRYnIwMEFRa1JVRUFKRVlNQ1F0Qi8rdldCU1E3UVpULy93Y2tQRUhDdExVRkpEMUJBQ1ErUVFBa1AwSC8vLzhISkVCQmhJbitCeVJCUWJyMDBBUWtRa0VBSkVOQi8vLy9CeVJFUVlTSi9nY2tSVUc2OU5BRUpFWU1DQXRCLy8vL0J5UTdRWVRidGdVa1BFSDc1b2tDSkQxQkFDUStRZi8vL3dja1AwR0E1djBISkVCQmdJVFJCQ1JCUVFBa1FrSC8vLzhISkVOQi8vdnFBaVJFUVlDQS9BY2tSVUgvQVNSR0RBY0xRWnovL3dja08wSC82OUlFSkR4Qjg2aU9BeVE5UWJyMEFDUStRY0tLL3dja1AwR0FyUDhISkVCQmdQVFFCQ1JCUVlDQXFBSWtRa0gvLy84SEpFTkJoSW4rQnlSRVFicjAwQVFrUlVFQUpFWU1CZ3RCZ1A2dkF5UTdRZi8vL3dja1BFSEtwUDBISkQxQkFDUStRZi8vL3dja1AwSC8vLzhISkVCQi84dU9BeVJCUWY4QkpFSkIvLy8vQnlSRFFlUGEvZ2NrUkVHQTRwQUVKRVZCQUNSR0RBVUxRZis1bGdVa08wR0EvdjhISkR4QmdNWUJKRDFCQUNRK1FkTEcvUWNrUDBHQWdOZ0dKRUJCZ0lDTUF5UkJRUUFrUWtIL0FTUkRRZi8vL3dja1JFSDcvdjhISkVWQi80a0NKRVlNQkF0Qnp2Ly9CeVE3UWUvZmp3TWtQRUd4aVBJRUpEMUIyclRwQWlRK1FmLy8vd2NrUDBHQTV2MEhKRUJCZ0lUUkJDUkJRUUFrUWtILy8vOEhKRU5CLzh1T0F5UkVRZjhCSkVWQkFDUkdEQU1MUWYvLy93Y2tPMEdFaWY0SEpEeEJ1dlRRQkNROVFRQWtQa0gvLy84SEpEOUJnUDRESkVCQmdJakdBU1JCUVlDVUFTUkNRZi8vL3dja1EwSC95NDRESkVSQi93RWtSVUVBSkVZTUFndEIvLy8vQnlRN1FmL0xqZ01rUEVIL0FTUTlRUUFrUGtHQS92OEhKRDlCZ0lEOEJ5UkFRWUNBakFNa1FVRUFKRUpCLy8vL0J5UkRRYkgrN3dNa1JFR0FpQUlrUlVFQUpFWU1BUXRCLy8vL0J5UTdRWVRidGdVa1BFSDc1b2tDSkQxQkFDUStRZi8vL3dja1AwSGoydjRISkVCQjQ5citCeVJCUVFBa1FrSC8vLzhISkVOQi84dU9BeVJFUWY4QkpFVkJBQ1JHQ3d2UkFnRUNmMEVBSk9nQlFRQWs2UUZCQUNUcUFVRUFKT3NCUVFBazdBRkJBQ1R0QVVFQUpPNEJRWkFCSk9vQkkvNEJCRUJCd2Y0REVBdEJnUUU2QUFCQnhQNERFQXRCa0FFNkFBQkJ4LzRERUF0Qi9BRTZBQUFGUWNIK0F4QUxRWVVCT2dBQVFjYitBeEFMUWY4Qk9nQUFRY2YrQXhBTFFmd0JPZ0FBUWNqK0F4QUxRZjhCT2dBQVFjbitBeEFMUWY4Qk9nQUFDMEdRQVNUcUFVSEEvZ01RQzBHUkFUb0FBRUhQL2dNUUMwRUFPZ0FBUWZEK0F4QUxRUUU2QUFBai9RRUVRQ1ArQVFSQVFRQWs2Z0ZCd1A0REVBdEJBRG9BQUVIQi9nTVFDMEdBQVRvQUFFSEUvZ01RQzBFQU9nQUFCVUVBSk9vQlFjRCtBeEFMUVFBNkFBQkJ3ZjRERUF0QmhBRTZBQUFMQzBFQUVBMENRQ1ArQVEwQVFRQWovUUVqL2dFYkRRQkJ0QUloQUFOQUlBQkJ3d0pNQkVBZ0FTQUFFQXN0QUFCcUlRRWdBRUVCYWlFQURBRUxDeUFCUWY4QmNSQU9Dd3Z4QkFCQkFDU2tBVUVBSktVQlFRQWtwZ0ZCQVNTbkFVRUJKS2dCUVFFa3FRRkJBU1NxQVVFQkpLc0JRUUVrckFGQkFTU3RBVUVCSks0QlFRRWtyd0ZCQUNTd0FVRUFKTElCUVFBa3NRRkJBQ1N6QVVHUS9nTVFDMEdBQVRvQUFFR1IvZ01RQzBHL0FUb0FBRUdTL2dNUUMwSHpBVG9BQUVHVC9nTVFDMEhCQVRvQUFFR1UvZ01RQzBHL0FUb0FBQ1A5QVFSQVFaSCtBeEFMUVQ4NkFBQkJrdjRERUF0QkFEb0FBRUdUL2dNUUMwRUFPZ0FBUVpUK0F4QUxRYmdCT2dBQUMwR1YvZ01RQzBIL0FUb0FBRUdXL2dNUUMwRS9PZ0FBUVpmK0F4QUxRUUE2QUFCQm1QNERFQXRCQURvQUFFR1ovZ01RQzBHNEFUb0FBRUdhL2dNUUMwSC9BRG9BQUVHYi9nTVFDMEgvQVRvQUFFR2MvZ01RQzBHZkFUb0FBRUdkL2dNUUMwRUFPZ0FBUVo3K0F4QUxRYmdCT2dBQVFRRWtnd0ZCbi80REVBdEIvd0U2QUFCQm9QNERFQXRCL3dFNkFBQkJvZjRERUF0QkFEb0FBRUdpL2dNUUMwRUFPZ0FBUWFQK0F4QUxRYjhCT2dBQVFhVCtBeEFMUWZjQU9nQUFRUWNrcFFGQkJ5U21BVUdsL2dNUUMwSHpBVG9BQUVFQkpLb0JRUUVrcVFGQkFTU29BVUVCSktjQlFRQWtyZ0ZCQUNTdEFVRUJKS3dCUVFFa3F3RkJwdjRERUF0QjhRRTZBQUJCQVNTdkFTUDlBUVJBUWFUK0F4QUxRUUE2QUFCQkFDU2xBVUVBSktZQlFhWCtBeEFMUVFBNkFBQkJBQ1NxQVVFQUpLa0JRUUFrcUFGQkFDU25BVUVBSks0QlFRQWtyUUZCQUNTc0FVRUFKS3NCUWFiK0F4QUxRZkFBT2dBQVFRQWtyd0VMUVE4a2x3RkJEeVNZQVVFUEpKa0JRUThrbWdGQkFDU2JBVUVBSkp3QlFRQWtuUUZCQUNTZUFVSC9BQ1NmQVVIL0FDU2dBVUVCSktFQlFRRWtvZ0ZCQUNTakFRdlVCZ0VCZjBIREFoQUxMUUFBSWdCQndBRkdCSDlCQVFVZ0FFR0FBVVpCQUNNeUd3c0VRRUVCSlA0QkJVRUFKUDRCQzBFQUpKVUNRWUNvMXJrSEpJOENRUUFra0FKQkFDU1JBa0dBcU5hNUJ5U1NBa0VBSkpNQ1FRQWtsQUlqTVFSQVFRRWsvUUVGUVFBay9RRUxFQXhCQUNUeEFVRUJKUElCUWNjQ0VBc3RBQUFpQUVVazh3RWdBRUVEVFVFQUlBQkJBVThiSlBRQklBQkJCazFCQUNBQVFRVlBHeVQxQVNBQVFSTk5RUUFnQUVFUFR4c2s5Z0VnQUVFZVRVRUFJQUJCR1U4YkpQY0JRUUVrN3dGQkFDVHdBVUhQL2dNUUMwRUFPZ0FBUWZEK0F4QUxRUUU2QUFCQjBmNERFQXRCL3dFNkFBQkIwdjRERUF0Qi93RTZBQUJCMC80REVBdEIvd0U2QUFCQjFQNERFQXRCL3dFNkFBQkIxZjRERUF0Qi93RTZBQUFRRHlQK0FRUkFRZWorQXhBTFFjQUJPZ0FBUWVuK0F4QUxRZjhCT2dBQVFlcitBeEFMUWNFQk9nQUFRZXYrQXhBTFFRMDZBQUFGUWVqK0F4QUxRZjhCT2dBQVFlbitBeEFMUWY4Qk9nQUFRZXIrQXhBTFFmOEJPZ0FBUWV2K0F4QUxRZjhCT2dBQUN5UCtBVUVBSS8wQkd3UkFRZW4rQXhBTFFTQTZBQUJCNi80REVBdEJpZ0U2QUFBTEVCQkJBQ1MzQVVFQUpMZ0JRUUFrdVFGQkFDUzZBVUVBSkxzQlFRQWt0Z0ZCLy84REVBdEJBRG9BQUVFQkpMMEJRUUFrdmdGQkFDUy9BVUVBSk1BQlFRQWt3UUZCNFFFa3ZBRkJqLzRERUF0QjRRRTZBQUJCQUNUQ0FVRUFKTU1CUVFBa3hBRkJBQ1RJQVVFQUpNa0JRUUFreWdGQkFDVEZBVUVBSk1ZQkkvNEJCRUJCaFA0REVBdEJIam9BQUVHZ1BTVERBUVZCaFA0REVBdEJxd0U2QUFCQnpOY0NKTU1CQzBHSC9nTVFDMEg0QVRvQUFFSDRBU1RLQVNQOUFRUkFJLzRCUlFSQVFZVCtBeEFMUVFBNkFBQkJCQ1REQVFzTFFRQWt5d0ZCQUNUTUFTUCtBUVJBUVlMK0F4QUxRZndBT2dBQVFRQWt6UUVGUVlMK0F4QUxRZjRBT2dBQVFRRWt6UUVMUVFBa3pnRWovZ0VFUUVIdy9nTVFDMEg0QVRvQUFFSFAvZ01RQzBIK0FUb0FBRUhOL2dNUUMwSCtBRG9BQUVHQS9nTVFDMEhQQVRvQUFFR1AvZ01RQzBIaEFUb0FBRUhzL2dNUUMwSCtBVG9BQUVIMS9nTVFDMEdQQVRvQUFBVkI4UDRERUF0Qi93RTZBQUJCei80REVBdEIvd0U2QUFCQnpmNERFQXRCL3dFNkFBQkJnUDRERUF0Qnp3RTZBQUJCai80REVBdEI0UUU2QUFBTEMwb0FJQUJCQUVva01TQUJRUUJLSkRJZ0FrRUFTaVF6SUFOQkFFb2tOQ0FFUVFCS0pEVWdCVUVBU2lRMklBWkJBRW9rTnlBSFFRQktKRGdnQ0VFQVNpUTVJQWxCQUVva09oQVJDd1VBSTVVQ0M1a0NBRUdzQ2lPbEFUWUNBRUd3Q2lPbUFUWUNBRUcwQ2lPbkFVRUFSem9BQUVHMUNpT29BVUVBUnpvQUFFRzJDaU9wQVVFQVJ6b0FBRUczQ2lPcUFVRUFSem9BQUVHNENpT3JBVUVBUnpvQUFFRzVDaU9zQVVFQVJ6b0FBRUc2Q2lPdEFVRUFSem9BQUVHN0NpT3VBVUVBUnpvQUFFRzhDaU92QVVFQVJ6b0FBRUc5Q2lPd0FUWUNBRUhDQ2lPeEFUb0FBRUhEQ2lPeUFUb0FBRUhFQ2lPWEFUb0FBRUhGQ2lPWUFUb0FBRUhHQ2lPWkFUb0FBRUhIQ2lPYUFUb0FBRUhJQ2lPYkFVRUFSem9BQUVISkNpT2NBVUVBUnpvQUFFSEtDaU9kQVVFQVJ6b0FBRUhMQ2lPZUFVRUFSem9BQUVITUNpT2ZBVG9BQUVITkNpT2dBVG9BQUVIT0NpT2hBVUVBUnpvQUFFSFBDaU9pQVVFQVJ6b0FBQXZxQVFCQjNnb2pTVFlDQUVIaUNpTktPZ0FBUWVNS0kwdEJBRWM2QUFCQjVBb2pURG9BQUVIbENpTk5PZ0FBUWVjS0kwNDdBUUJCNkFvalR6b0FBRUhwQ2lOUVFRQkhPZ0FBUWVvS0kxRTZBQUJCNndvalVqb0FBRUhzQ2lOVFFRQkhPZ0FBUWUwS0kxUTZBQUJCN2dvalZVRUFSem9BQUVIdkNpTldRUUJIT2dBQVFmQUtJMWMyQWdCQjlBb2pXRFlDQUVINENpTlpOZ0lBUWZ3S0kxcEJBRWM2QUFCQi9Rb2pXellDQUVHQkN5TmNOZ0lBUVlVTEkxMDZBQUJCaGdzalhqb0FBRUdIQ3lOZlFRQkhPZ0FBUVlnTEkyQTJBZ0JCakFzallUc0JBRUdQQ3lOaVFRQkhPZ0FBQy9nSkFFR0FDQ09BQWpvQUFFR0JDQ09CQWpvQUFFR0NDQ09DQWpvQUFFR0RDQ09EQWpvQUFFR0VDQ09FQWpvQUFFR0ZDQ09GQWpvQUFFR0dDQ09HQWpvQUFFR0hDQ09IQWpvQUFFR0lDQ09JQWpzQkFFR0tDQ09KQWpzQkFFR01DQ09LQWpZQ0FFR1JDQ09MQWtFQVJ6b0FBRUdTQ0NPTUFrRUFSem9BQUVHVENDT05Ba0VBUnpvQUFFR1VDQ09PQWtFQVJ6b0FBRUdWQ0NQOUFVRUFSem9BQUVHV0NDUCtBVUVBUnpvQUFFR1hDQ1AvQVVFQVJ6b0FBRUd5Q0NQcEFUWUNBRUcyQ0NQcUFUb0FBRUczQ0NQckFUb0FBRUc0Q0NQc0FUb0FBRUc1Q0NQdEFUb0FBRUc2Q0NQdUFUb0FBRUc3Q0NQZUFUb0FBRUc4Q0NQZkFUb0FBRUc5Q0NQZ0FVRUFSem9BQUVHK0NDUGhBVUVBUnpvQUFFRy9DQ1BpQVVFQVJ6b0FBRUhBQ0NQakFVRUFSem9BQUVIQkNDUGtBVUVBUnpvQUFFSENDQ1BsQVVFQVJ6b0FBRUhEQ0NQbUFVRUFSem9BQUVIRUNDUG5BVUVBUnpvQUFFSGtDQ08wQVVFQVJ6b0FBRUhsQ0NPMUFVRUFSem9BQUVIMENDTzJBVG9BQUVIMUNDTzNBVUVBUnpvQUFFSDJDQ080QVVFQVJ6b0FBRUgzQ0NPNUFVRUFSem9BQUVINENDTzZBVUVBUnpvQUFFSDVDQ083QVVFQVJ6b0FBRUdFQ1NPOEFUb0FBRUdGQ1NPOUFVRUFSem9BQUVHR0NTTytBVUVBUnpvQUFFR0hDU08vQVVFQVJ6b0FBRUdJQ1NQQUFVRUFSem9BQUVHSkNTUEJBVUVBUnpvQUFFR1dDU1BYQVRZQ0FFR1hDU1BZQVVFQVJ6b0FBRUdZQ1NQWkFVRUFSem9BQUVISUNTUHZBVHNCQUVIS0NTUHdBVHNCQUVITUNTUHhBVUVBUnpvQUFFSE5DU1B5QVVFQVJ6b0FBRUhPQ1NQekFVRUFSem9BQUVIUENTUDBBVUVBUnpvQUFFSFFDU1AxQVVFQVJ6b0FBRUhSQ1NQMkFVRUFSem9BQUVIU0NTUDNBVUVBUnpvQUFFSFRDU1A0QVRZQ0FFSFhDU1A1QVVFQVJ6b0FBRUhZQ1NQNkFUWUNBRUhjQ1NQN0FUWUNBRUhnQ1NQOEFUWUNBRUg2Q1NQQ0FUWUNBRUgrQ1NQREFUWUNBRUdDQ2lQRUFUWUNBRUdHQ2lQRkFVRUFSem9BQUVHSENpUEdBVUVBUnpvQUFFR0lDaVBIQVRZQ0FFR01DaVBJQVRZQ0FFR1FDaVBKQVVFQVJ6b0FBRUdSQ2lQS0FUWUNBQkFVRUJWQmtBc2pZellDQUVHWEN5TmtPZ0FBUVpnTEkyVTdBUUJCbWdzalpqb0FBRUdiQ3lOblFRQkhPZ0FBUVp3TEkyZzZBQUJCblFzamFUb0FBRUdlQ3lOcVFRQkhPZ0FBUVo4TEkyczZBQUJCb0FzamJFRUFSem9BQUVHaEN5TnRRUUJIT2dBQVFhSUxJMjQyQWdCQnBnc2piellDQUVHcUN5TndOZ0lBUWE0TEkzRkJBRWM2QUFCQnJ3c2pjallDQUVHekN5TnpOZ0lBUWJjTEkzUTZBQUJCdUFzamRUb0FBRUhDQ3lOMk5nSUFRY29MSTNjN0FRQkJ6QXNqZURvQUFFSE9DeU41T2dBQVFjOExJM3BCQUVjNkFBQkIwQXNqZXpvQUFFSFJDeU44UVFCSE9nQUFRZElMSTMxQkFFYzZBQUJCMHdzamZqWUNBRUhYQ3lOL05nSUFRZHNMSTRBQk5nSUFRZU1MSTRFQk5nSUFRZWNMSTRJQk9nQUFRZWdMSTRNQlFRQkhPZ0FBUWVrTEk0UUJOZ0lBUWZRTEk0VUJOZ0lBUWZnTEk0WUJPd0VBUWZvTEk0Y0JPZ0FBUWZzTEk0Z0JRUUJIT2dBQVFmd0xJNGtCT2dBQVFmMExJNG9CT2dBQVFmNExJNHNCUVFCSE9nQUFRZjhMSTR3Qk9nQUFRWUVNSTQwQlFRQkhPZ0FBUVlNTUk0NEJRUUJIT2dBQVFZUU1JNDhCUVFCSE9nQUFRWWtNSTVBQk5nSUFRWTBNSTVFQk5nSUFRWkVNSTVJQlFRQkhPZ0FBUVpJTUk1TUJOZ0lBUVpZTUk1UUJOZ0lBUVpvTUk1WUJPd0VBUVFBa2xRSUxCd0JCQUNTekFRdWVBZ0JCckFvb0FnQWtwUUZCc0Fvb0FnQWtwZ0ZCdEFvdEFBQkJBRXNrcHdGQnRRb3RBQUJCQUVza3FBRkJ0Z290QUFCQkFFc2txUUZCdHdvdEFBQkJBRXNrcWdGQnVBb3RBQUJCQUVza3F3RkJ1UW90QUFCQkFFc2tyQUZCdWdvdEFBQkJBRXNrclFGQnV3b3RBQUJCQUVza3JnRkJ2QW90QUFCQkFFc2tyd0ZCdlFvb0FnQWtzQUZCd2dvdEFBQWtzUUZCd3dvdEFBQWtzZ0ZCeEFvdEFBQWtsd0ZCeFFvdEFBQWttQUZCeGdvdEFBQWttUUZCeHdvdEFBQWttZ0ZCeUFvdEFBQkJBRXNrbXdGQnlRb3RBQUJCQUVza25BRkJ5Z290QUFCQkFFc2tuUUZCeXdvdEFBQkJBRXNrbmdGQnpBb3RBQUFrbndGQnpRb3RBQUFrb0FGQnpnb3RBQUJCQUVza29RRkJ6d290QUFCQkFFc2tvZ0ZCQUNTekFRdndBUUFqU1VFeWJFR0FDR29vQWdBa1NVSGlDaTBBQUNSS1FlTUtMUUFBUVFCTEpFdEI1QW90QUFBa1RFSGxDaTBBQUNSTlFlY0tMd0VBSkU1QjZBb3RBQUFrVDBIcENpMEFBRUVBU3lSUVFlb0tMUUFBSkZGQjZ3b3RBQUFrVWtIc0NpMEFBRUVBU3lSVFFlMEtMUUFBSkZSQjdnb3RBQUJCQUVza1ZVSHZDaTBBQUVFQVN5UldRZkFLS0FJQUpGZEI5QW9vQWdBa1dFSDRDaWdDQUNSWlFmd0tMUUFBUVFCTEpGcEIvUW9vQWdBa1cwR0JDeWdDQUNSY1FZVUxMUUFBSkYxQmhnc3RBQUFrWGtHSEN5MEFBRUVBU3lSZlFZZ0xMUUFBSkdCQmpBc3RBQUFrWVVHUEN5MEFBRUVBU3lSaUM2OEJBQ05qUVRKc1FZQUlhaWdDQUNSalFaY0xMUUFBSkdSQm1Bc3ZBUUFrWlVHYUN5MEFBQ1JtUVpzTExRQUFRUUJMSkdkQm5Bc3RBQUFrYUVHZEN5MEFBQ1JwUVo0TExRQUFRUUJMSkdwQm53c3RBQUFrYTBHZ0N5MEFBRUVBU3lSc1FhRUxMUUFBUVFCTEpHMUJvZ3NvQWdBa2JrR21DeWdDQUNSdlFhb0xLQUlBSkhCQnJnc3RBQUJCQUVza2NVR3ZDeWdDQUNSeVFiTUxLQUlBSkhOQnR3c3RBQUFrZEVHNEN5MEFBQ1IxQzQwSkFFR0FDQzBBQUNTQUFrR0JDQzBBQUNTQkFrR0NDQzBBQUNTQ0FrR0RDQzBBQUNTREFrR0VDQzBBQUNTRUFrR0ZDQzBBQUNTRkFrR0dDQzBBQUNTR0FrR0hDQzBBQUNTSEFrR0lDQzhCQUNTSUFrR0tDQzhCQUNTSkFrR01DQ2dDQUNTS0FrR1JDQzBBQUVFQVN5U0xBa0dTQ0MwQUFFRUFTeVNNQWtHVENDMEFBRUVBU3lTTkFrR1VDQzBBQUVFQVN5U09Ba0dWQ0MwQUFFRUFTeVQ5QVVHV0NDMEFBRUVBU3lUK0FVR1hDQzBBQUVFQVN5VC9BVUd5Q0NnQ0FDVHBBU1BxQVVFeWJFR0VDR290QUFBazZnRkJ0d2d0QUFBazZ3RkJ1QWd0QUFBazdBRkJ1UWd0QUFBazdRRkJ1Z2d0QUFBazdnRkJ1d2d0QUFBazNnRkJ2QWd0QUFBazN3RkJ2UWd0QUFCQkFFc2s0QUZCdmdndEFBQkJBRXNrNFFGQnZ3Z3RBQUJCQUVzazRnRkJ3QWd0QUFCQkFFc2s0d0ZCd1FndEFBQkJBRXNrNUFGQndnZ3RBQUJCQUVzazVRRkJ3d2d0QUFCQkFFc2s1Z0ZCeEFndEFBQkJBRXNrNXdGQjVBZ3RBQUJCQUVza3RBRkI1UWd0QUFCQkFFc2t0UUZCOUFndEFBQWt0Z0ZCOVFndEFBQkJBRXNrdHdGQjlnZ3RBQUJCQUVza3VBRkI5d2d0QUFCQkFFc2t1UUZCK0FndEFBQkJBRXNrdWdGQitRZ3RBQUJCQUVza3V3RkJoQWt0QUFBa3ZBRkJoUWt0QUFCQkFFc2t2UUZCaGdrdEFBQkJBRXNrdmdGQmh3a3RBQUJCQUVza3Z3RkJpQWt0QUFCQkFFc2t3QUZCaVFrdEFBQkJBRXNrd1FGQmxna29BZ0FrMXdGQmx3a3RBQUJCQUVzazJBRkJtQWt0QUFCQkFFc2syUUZCeUFrdkFRQWs3d0ZCeWdrdkFRQWs4QUZCekFrdEFBQkJBRXNrOFFGQnpRa3RBQUJCQUVzazhnRkJ6Z2t0QUFCQkFFc2s4d0ZCendrdEFBQkJBRXNrOUFGQjBBa3RBQUJCQUVzazlRRkIwUWt0QUFCQkFFc2s5Z0ZCMGdrdEFBQkJBRXNrOXdGQjB3a29BZ0FrK0FGQjF3a3RBQUJCQUVzaytRRkIyQWtvQWdBaytnRkIzQWtvQWdBayt3RkI0QWtvQWdBay9BRkIrZ2tvQWdBa3dnRkIvZ2tvQWdBa3d3RkJnZ29vQWdBa3hBRkJoZ290QUFCQkFFc2t4UUZCaHdvdEFBQkJBRXNreGdGQmlBb29BZ0FreHdGQmpBb29BZ0FreUFGQmtBb3RBQUJCQUVza3lRRkJrUW9vQWdBa3lnRVFHQkFaRUJvamRrRXliRUdBQ0dvb0FnQWtka0hLQ3k4QkFDUjNRY3dMTFFBQUpIaEJ6Z3N0QUFBa2VVSFBDeTBBQUVFQVN5UjZRZEFMTFFBQUpIdEIwUXN0QUFCQkFFc2tmRUhTQ3kwQUFFRUFTeVI5UWRNTEtBSUFKSDVCMXdzb0FnQWtmMEhiQ3lnQ0FDU0FBVUhqQ3lnQ0FDU0JBVUhuQ3lnQ0FDU0NBVUhvQ3kwQUFFRUFTeVNEQVVIcEN5Z0NBQ1NFQVNPRkFVRXliRUdBQ0dvb0FnQWtoUUZCK0FzdEFBQWtoZ0ZCK2dzdEFBQWtod0ZCK3dzdEFBQkJBRXNraUFGQi9Bc3RBQUFraVFGQi9Rc3RBQUFraWdGQi9nc3RBQUJCQUVza2l3RkIvd3N0QUFBa2pBRkJnUXd0QUFCQkFFc2tqUUZCZ3d3dEFBQkJBRXNramdGQmhBd3RBQUJCQUVza2p3RkJpUXdvQWdBa2tBRkJqUXdvQWdBa2tRRkJrUXd0QUFCQkFFc2trZ0ZCa2d3b0FnQWtrd0ZCbGd3b0FnQWtsQUZCbWd3dkFRQWtsZ0ZCQUNTVkFrR0FxTmE1QnlTUEFrRUFKSkFDUVFBa2tRSkJnS2pXdVFja2tnSkJBQ1NUQWtFQUpKUUNDd1VBSS80QkN3VUFJNUlDQ3dVQUk1TUNDd1VBSTVRQ0M1NENBUWQvSUFBalNDSUhSa0VBSUFRalIwWkJBQ0FBUVFoS1FRQWdBVUVBU2hzYkd3UkFJQU5CQVdzUUN5MEFBRUVnY1VFQVJ5RUlJQU1RQ3kwQUFFRWdjVUVBUnlFSkEwQWdCa0VJU0FSQUlBQkJCeUFHYXlBR0lBZ2dDVWNiSWdScUlnTkJvQUZNQkVBQ2Z5QURJQUZCb0FGc0lncHFJZ3RCQTJ3aUJrR0F5UVZxSWdNZ0F5MEFBRG9BQUNBR1FZSEpCV29nQXkwQUFUb0FBQ0FHUVlMSkJXb2dBeTBBQWpvQUFDQUxRWUNSQkdvZ0NpQUFRUUFnQkd0cmFrSDRrQVJxTFFBQUlnTkJBM0VpQmtFRWNpQUdJQU5CQkhFYk9nQUFJQVZCQVdvTElRVUxJQVJCQVdvaEJnd0JDd3NGSUFRa1J3c2dBQ0FIVGdSL0lBQkJDR29oQVNBQUlBSkJCM0VpQUVnRWZ5QUFJQUZxQlNBQkN3VWdCd3NrU0NBRkM2MEJBQ0FCRUFzdEFBQWdBRUVCZEhWQkEzRWhBQ0FCUWNqK0EwWUVRQ00vSVFFQ1FBSkFBa0FDUUNBQVFRRnJEZ01BQVFJREN5TkFJUUVNQWdzalFTRUJEQUVMSTBJaEFRc0ZJQUZCeWY0RFJnUkFJME1oQVFKQUFrQUNRQUpBSUFCQkFXc09Bd0FCQWdNTEkwUWhBUXdDQ3lORklRRU1BUXNqUmlFQkN3VWpPeUVCQWtBQ1FBSkFBa0FnQUVFQmF3NERBQUVDQXdzalBDRUJEQUlMSXowaEFRd0JDeU0rSVFFTEN3c2dBUXZnQXdFR2Z5QUNRUUZ4UVExMElnOGhEaUFPSUFFaUFrR0FrQUpHQkg4Z0FFR0FBV3NnQUVHQUFXb2dBRUdBQVhFYkJTQUFDMEVFZENBQ2FpQUZRUUYwYWlJQVFZQ1FmbXBxTFFBQUlSRWdEeUFBUVlHUWZtcHFMUUFBSVJJZ0F5RUFBMEFnQUNBRVRBUkFJQVlnQUNBRGEyb2lEeUFJU0FSQUFuOGdFa0VCUVFjZ0FHc2dBRUVCSUF0QklIRkZJQXRCQUVnYkd5SUNkSEVFZjBFQ0JVRUFDeUlCUVFGcUlBRWdFVUVCSUFKMGNSc2hCU1ArQVFSL1FRRWdERUVBVGlBTFFRQk9Hd1ZCQUFzRWZ5QUxRUWR4SVFFZ0RFRUFUaUlDQkg4Z0RFRUhjUVVnQVF0QkEzUWdCVUVCZEdvaUFVRUJha0UvY1NJT1FVQnJJQTRnQWh0QmdKQUVhaTBBQUVFSWRDQUJRVDl4SWdGQlFHc2dBU0FDRzBHQWtBUnFMUUFBY2lJQlFSOXhRUU4wSVE0Z0FVSGdCM0ZCQlhaQkEzUWhBaUFCUVlENEFYRkJDblpCQTNRRklBVkJ4LzRESUFvZ0NrRUFUQnNpQ2hBaElnRkJnSUQ4QjNGQkVIWWhEaUFCUVlEK0EzRkJDSFloQWlBQlFmOEJjUXNoQVNBSklBOGdCeUFJYkdwQkEyeHFJaEFnRGpvQUFDQVFJQUk2QUFFZ0VDQUJPZ0FDSUE4Z0IwR2dBV3hxUVlDUkJHb2dCVUVEY1NJQlFRUnlJQUVnQzBHQUFYRkJBQ0FMUVFCT0d4czZBQUFnRFVFQmFnc2hEUXNnQUVFQmFpRUFEQUVMQ3lBTkM5SUNBQ0FEUVFkeElRTWdCU0FGUVlDUUFrWUVmeUFHUVlBQmF5QUdRWUFCYWlBR1FZQUJjUnNGSUFZTFFRUjBhaUVGSUFVZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ05CZ0pCK2FpQUVRUWh4UVFCSElnVkJEWFJxTFFBQUlRWWdBQ0FCUWFBQmJHcEJBMnhCZ01rRmFpQUVRUWR4UVFOMElBTkJnWkIrYWlBRlFRRnhRUTEwYWkwQUFFRUJJQUpCQjNFaUFrRUhJQUpySUFSQklIRWJJZ04wY1FSL1FRSUZRUUFMSWdKQkFXb2dBaUFHUVFFZ0EzUnhHeUlEUVFGMGFpSUNRUUZxUVQ5eFFZQ1FCR290QUFCQkNIUWdBa0UvY1VHQWtBUnFMUUFBY2lJQ1FSOXhRUU4wT2dBQUlBQWdBVUdnQVd4cUlnQkJBMndpQVVHQnlRVnFJQUpCNEFkeFFRVjJRUU4wT2dBQUlBRkJnc2tGYWlBQ1FZRDRBWEZCQ25aQkEzUTZBQUFnQUVHQWtRUnFJQU5CQTNFaUFFRUVjaUFBSUFSQmdBRnhHem9BQUF2TEFRQWdCQ0FFUVlDUUFrWUVmeUFGUVlBQmF5QUZRWUFCYWlBRlFZQUJjUnNGSUFVTFFRUjBhaUFEUVFkeFFRRjBhaUlEUVlDUWZtb3RBQUFoQkNBQUlBRkJvQUZzYWlJRlFRTnNJZ0ZCZ01rRmFpQURRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSL1FRSUZRUUFMSWdCQkFXb2dBQ0FFUVFFZ0FuUnhHMEgvQVhFaUFrSEgvZ01RSVNJQVFZQ0EvQWR4UVJCMk9nQUFJQUZCZ2NrRmFpQUFRWUQrQTNGQkNIWTZBQUFnQVVHQ3lRVnFJQUE2QUFBZ0JVR0FrUVJxSUFKQkEzRTZBQUFMeHdJQkIzOGdBMEVEZFNFTEEwQWdCRUdnQVVnRVFDQUNJQXRCQlhScUFuOGdCQ0FGYWlJR1FZQUNUZ1JBSUFaQmdBSnJJUVlMSUFZTFFRTjFhaUlLUVlDUWZtb3RBQUFoQ0VFQUlRY2pPUVJBSUFRZ0FDQUdJQW9nQ0JBZ0lnbEJBRW9FUUFKL1FRRWhCeUFFSUFsQkFXdHFDeUVFQ3dzZ0IwVkJBQ000R3dSQVFRQWhDU0FEUVFkeElRZEJBQ0FHSUFaQkEzVkJBM1JySUFRYklReEJmeUVHSS80QkJFQUNmeUFLUVlEUWZtb3RBQUFpQmtFSWNVRUFSeUVKUVFjZ0Iyc2dCeUFHUWNBQWNSc0xJUWNMSUFRZ0NDQUJJQWtnREVHZ0FTQUVhMEVISUFSQkNHcEJvQUZLR3lBSElBUWdBRUdnQVVHQXlRVkJBQ0FHUVg4UUlpSUdRUUZyYWlBRUlBWkJBRW9iSVFRRklBZEZCRUFqL2dFRVFDQUVJQUFnQmlBRElBb2dBU0FJRUNNRklBUWdBQ0FHSUFNZ0FTQUlFQ1FMQ3dzZ0JFRUJhaUVFREFFTEN3dVZCUUVQZjBFbklRY0RRQ0FIUVFCT0JFQWdCMEVDZENJRlFZRDhBMm9pQWhBTExRQUFJUU1nQWtFQmFoQUxMUUFBSVFZZ0FrRUNhaEFMTFFBQUlRUWdCa0VJYXlFS0lBQWdBMEVRYXlJRElBRUVmeUFFSUFSQkFYRnJJUVJCRUFWQkNBc2lBbXBJUVFBZ0FDQURUaHNFUUNBRlFZUDhBMm9RQ3kwQUFDSUdRWUFCY1VFQVJ5RUxJQVpCSUhGQkFFY2hEQ0FHUVFoeFFRQkhJLzRCSWdVZ0JSdEJBWEZCRFhRaUJTQUVRUVIwUVlDQUFtb2dBaUFBSUFOcklnSnJRUUZySUFJZ0JrSEFBSEViUVFGMGFpSUNRWUNRZm1wcUxRQUFJUTBnQlNBQ1FZR1FmbXBxTFFBQUlRNUJCeUVFQTBBZ0JFRUFUZ1JBSUE1QkFVRUFJQVJCQjJ0cklBUWdEQnNpQTNSeEJIOUJBZ1ZCQUFzaUFrRUJhaUFDSUExQkFTQURkSEViSWdNRVFDQUtRUWNnQkd0cUlnSkJvQUZNUVFBZ0FrRUFUaHNFUUVFQUlRVkJBQ0VJSStjQlJTUCtBU0lKSUFrYklnbEZCRUFnQWlBQVFhQUJiR3BCZ0pFRWFpMEFBQ0lQUVFOeEloQkJBRXRCQUNBTEd3UkFRUUVoQlFVZ0VFRUFTMEVBSUE5QkJIRkJBQ1ArQVJzYlJVVWhDQXNMUVFGQkFDQUlSU0FGR3lBSkd3UkFJLzRCQkVBZ0FpQUFRYUFCYkdwQkEyd2lBa0dBeVFWcUlBWkJCM0ZCQTNRZ0EwRUJkR29pQTBFQmFrRS9jVUhBa0FScUxRQUFRUWgwSUFOQlAzRkJ3SkFFYWkwQUFISWlBMEVmY1VFRGREb0FBQ0FDUVlISkJXb2dBMEhnQjNGQkJYWkJBM1E2QUFBZ0FrR0N5UVZxSUFOQmdQZ0JjVUVLZGtFRGREb0FBQVVnQWlBQVFhQUJiR3BCQTJ3aUFrR0F5UVZxSUFOQnlmNERRY2orQXlBR1FSQnhHeEFoSWdOQmdJRDhCM0ZCRUhZNkFBQWdBa0dCeVFWcUlBTkJnUDREY1VFSWRqb0FBQ0FDUVlMSkJXb2dBem9BQUFzTEN3c2dCRUVCYXlFRURBRUxDd3NnQjBFQmF5RUhEQUVMQ3d1QkFRRUNmMEdBZ0FKQmdKQUNJK01CR3lFQlFRRWo1d0VqL2dFYkJFQWdBQ0FCUVlDNEFrR0FzQUlqNUFFYklBQWo3QUZxUWY4QmNVRUFJK3NCRUNVTEkrSUJCRUFnQUNQdUFTSUNUZ1JBSUFBZ0FVR0F1QUpCZ0xBQ0krRUJHeUFBSUFKckkrMEJRUWRySWdGQkFDQUJheEFsQ3dzajVnRUVRQ0FBSStVQkVDWUxDeUVBUVkvK0F4QUxMUUFBUVFFZ0FIUnlJZ0FrdkFGQmovNERFQXNnQURvQUFBdnFBUUVEZnlOZlJVRUJJMVViQkVBUEN5TmdRUUZySWdCQkFFd0VRQ05LQkVBalNpUmdBbjhqWVNJQkkweDFJUUJCQVNOTEJIOUJBU1JpSUFFZ0FHc0ZJQUFnQVdvTElnQkIvdzlLRFFBYVFRQUxCRUJCQUNSVkN5Tk1RUUJLQkVBZ0FDUmhJQUJCQ0hWQkIzRWlBa0dVL2dNUUN5MEFBRUg0QVhGeUlRRkJrLzRERUFzZ0FFSC9BWEVpQURvQUFFR1UvZ01RQ3lBQk9nQUFJQUFrVWlBQ0pGUWpVaU5VUVFoMGNpUlhBbjhqWVNJQkkweDFJUUJCQVNOTEJIOUJBU1JpSUFFZ0FHc0ZJQUFnQVdvTFFmOFBTZzBBR2tFQUN3UkFRUUFrVlFzTEJVRUlKR0FMQlNBQUpHQUxDOEVIQVFKL0lBQWpzQUZxSWdCQmdNQUFJLzhCZENJQ1RnUkFJQUFnQW1za3NBRUNRQUpBQWtBQ1FBSkFBa0Fqc1FGQkFXcEJCM0VpQWc0SUFBVUJCUUlGQXdRRkN5TlRRUUFqV3lJQVFRQktHd1JBSUFCQkFXc2lBRVVFUUVFQUpGVUxDeUFBSkZzQ2Z5TnFRUUFqY2lJQVFRQktHd1JBSUFCQkFXc2hBQXNnQUF0RkJFQkJBQ1JzQ3lBQUpISUNmeU42UVFBamdBRWlBRUVBU2hzRVFDQUFRUUZySVFBTElBQUxSUVJBUVFBa2ZBc2dBQ1NBQVFKL0k0MEJRUUFqa3dFaUFFRUFTaHNFUUNBQVFRRnJJUUFMSUFBTFJRUkFRUUFramdFTElBQWtrd0VNQkFzalUwRUFJMXNpQUVFQVNoc0VRQ0FBUVFGcklnQkZCRUJCQUNSVkN3c2dBQ1JiQW44amFrRUFJM0lpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtiQXNnQUNSeUFuOGpla0VBSTRBQklnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkh3TElBQWtnQUVDZnlPTkFVRUFJNU1CSWdCQkFFb2JCRUFnQUVFQmF5RUFDeUFBQzBVRVFFRUFKSTRCQ3lBQUpKTUJFQ2tNQXdzalUwRUFJMXNpQUVFQVNoc0VRQ0FBUVFGcklnQkZCRUJCQUNSVkN3c2dBQ1JiQW44amFrRUFJM0lpQUVFQVNoc0VRQ0FBUVFGcklRQUxJQUFMUlFSQVFRQWtiQXNnQUNSeUFuOGpla0VBSTRBQklnQkJBRW9iQkVBZ0FFRUJheUVBQ3lBQUMwVUVRRUVBSkh3TElBQWtnQUVDZnlPTkFVRUFJNU1CSWdCQkFFb2JCRUFnQUVFQmF5RUFDeUFBQzBVRVFFRUFKSTRCQ3lBQUpKTUJEQUlMSTFOQkFDTmJJZ0JCQUVvYkJFQWdBRUVCYXlJQVJRUkFRUUFrVlFzTElBQWtXd0ovSTJwQkFDTnlJZ0JCQUVvYkJFQWdBRUVCYXlFQUN5QUFDMFVFUUVFQUpHd0xJQUFrY2dKL0kzcEJBQ09BQVNJQVFRQktHd1JBSUFCQkFXc2hBQXNnQUF0RkJFQkJBQ1I4Q3lBQUpJQUJBbjhqalFGQkFDT1RBU0lBUVFCS0d3UkFJQUJCQVdzaEFBc2dBQXRGQkVCQkFDU09BUXNnQUNTVEFSQXBEQUVMSTFsQkFXc2lBRUVBVEFSQUkxRUVRQ05hUVFBalVTSUFHd1JBSTF3aUFVRUJhaUFCUVFGckkxQWJRUTl4SWdGQkQwa0VRQ0FCSkZ3RlFRQWtXZ3NMQlVFSUlRQUxDeUFBSkZramNFRUJheUlBUVFCTUJFQWphQVJBSTNGQkFDTm9JZ0FiQkVBamN5SUJRUUZxSUFGQkFXc2paeHRCRDNFaUFVRVBTUVJBSUFFa2N3VkJBQ1J4Q3dzRlFRZ2hBQXNMSUFBa2NDT1JBVUVCYXlJQVFRQk1CRUFqaVFFRVFDT1NBVUVBSTRrQklnQWJCRUFqbEFFaUFVRUJhaUFCUVFGckk0Z0JHMEVQY1NJQlFROUpCRUFnQVNTVUFRVkJBQ1NTQVFzTEJVRUlJUUFMQ3lBQUpKRUJDeUFDSkxFQlFRRVBCU0FBSkxBQkMwRUFDOEVCQVFGL0kxZ2dBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTlhhMEVDZENJQlFRSjBJQUVqL3dFYkpGZ2pXQ0FBUVI5MUlnRWdBQ0FCYW5OcklRQWpYa0VCYWtFSGNTUmVEQUVMQ3lBQUpGZ2pWa0VBSTFVYkJIOGpYRUVQY1FWQkR3OExJUUFDZnlOZUlRRUNRQUpBQWtBQ1FDTk5RUUZyRGdNQUFRSURDMEVCSUFGMFFZRUJjVUVBUnd3REMwRUJJQUYwUVljQmNVRUFSd3dDQzBFQklBRjBRZjRBY1VFQVJ3d0JDMEVCSUFGMFFRRnhDd1IvUVFFRlFYOExJQUJzUVE5cUM3b0JBUUYvSTI4Z0FHc2hBQU5BSUFCQkFFd0VRRUdBRUNOdWEwRUNkQ1AvQVhRa2J5TnZJQUJCSDNVaUFTQUFJQUZxYzJzaEFDTjFRUUZxUVFkeEpIVU1BUXNMSUFBa2J5TnRRUUFqYkJzRWZ5TnpRUTl4QlVFUER3c2hBQUovSTNVaEFRSkFBa0FDUUFKQUkyUkJBV3NPQXdBQkFnTUxRUUVnQVhSQmdRRnhRUUJIREFNTFFRRWdBWFJCaHdGeFFRQkhEQUlMUVFFZ0FYUkIvZ0J4UVFCSERBRUxRUUVnQVhSQkFYRUxCSDlCQVFWQmZ3c2dBR3hCRDJvTGlBSUJBMzhqZlVWQkFTTjhHd1JBUVE4UEN5T0NBU0VESTRNQkJFQkJuUDRERUFzdEFBQkJCWFlpQXlTQ0FVRUFKSU1CQ3lPRUFTT0JBVUVCY1VWQkFuUjFRUTl4SVFJQ1FBSkFBa0FDUUFKQUlBTU9Bd0FCQWdNTElBSkJCSFVoQWd3REMwRUJJUUVNQWdzZ0FrRUJkU0VDUVFJaEFRd0JDeUFDUVFKMUlRSkJCQ0VCQ3lBQlFRQkxCSDhnQWlBQmJRVkJBQXRCRDJvaEFpTi9JQUJySVFBRFFDQUFRUUJNQkVCQmdCQWpmbXRCQVhRai93RjBKSDhqZnlBQVFSOTFJZ0VnQUNBQmFuTnJJUUFqZ1FGQkFXb2hBUU5BSUFGQklFNEVRQ0FCUVNCcklRRU1BUXNMSUFFa2dRRWpnUUZCQVhWQnNQNERhaEFMTFFBQUpJUUJEQUVMQ3lBQUpIOGdBZ3VQQVFFQ2Z5T1FBU0FBYXlJQVFRQk1CRUFqbFFFamlnRjBJLzhCZENBQVFSOTFJZ0VnQUNBQmFuTnJJUUFqbGdFaUFVRUJkU0lDSUFGQkFYRWdBa0VCY1hNaUFVRU9kSElpQWtHL2YzRWdBVUVHZEhJZ0FpT0xBUnNrbGdFTFFRQWdBQ0FBUVFCSUd5U1FBU09QQVVFQUk0NEJHd1IvSTVRQlFROXhCVUVQRHd0QmYwRUJJNVlCUVFGeEcyeEJEMm9MNVFFQkFYOUJBQ1NoQVNBQVFROGpxd0ViSUFGQkR5T3NBUnRxSUFKQkR5T3RBUnRxSUFOQkR5T3VBUnRxSVFSQkFDU2lBVUVBSktNQkFuOUIvd0FnQUVFUEk2Y0JHeUFCUVE4anFBRWJhaUFDUVE4anFRRWJhaUFEUVE4anFnRWJhaUlBUVR4R0RRQWFJNlVCUVFGcUlBQkJQR3RCb0kwR2JHeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMSVFJQ2Z5T21BVUVCYWlFQlFmOEFJQVJCUEVZTkFCb2dBU0FFUVR4clFhQ05CbXhzUVFOMVFhQ05CbTFCUEdwQm9JMEdiRUdNOFFKdEN5RUFJQUlrbndFZ0FDU2dBU0FBUWY4QmNTQUNRZjhCY1VFSWRISUxuQU1CQlg4Z0FDTkphaUlCSkVraldDQUJhMEVBVENJQlJRUkFJMVlpQWlPYkFVY2hBU0FDSkpzQkN5QUFJMk5xSWdJa1l5TnZJQUpyUVFCTUlnSkZCRUFqYlNJRUk1d0JSeUVDSUFRa25BRUxJQUFqZG1va2RrRUFJMzhqZG10QkFFb2pnd0ViUlNJRVJRUkFJMzBpQlNPZEFVY2hCQ0FGSkowQkN5QUFJNFVCYWlTRkFTT1FBU09GQVd0QkFFd2lCVVVFUUNPUEFTSURJNTRCUnlFRklBTWtuZ0VMSUFFRVFDTkpJUU5CQUNSSklBTVFLeVNYQVFzZ0FnUkFJMk1oQTBFQUpHTWdBeEFzSkpnQkN5QUVCRUFqZGlFRFFRQWtkaUFERUMwa21RRUxJQVVFUUNPRkFTRURRUUFraFFFZ0F4QXVKSm9CQzBFQklBVkJBU0FFUVFFZ0FpQUJHeHNiQkVCQkFTU2pBUXNnQUNPeUFXb2lBRUdBZ0lBQ0kvOEJkRUhFMkFKdElnRk9CRUFnQUNBQmF5RUFRUUVqb2dGQkFTT2hBU09qQVJzYkJFQWpsd0VqbUFFam1RRWptZ0VRTHhvRklBQWtzZ0VMSTdNQklnRkJBWFJCZ0puQkFHb2lBaU9mQVVFQ2Fqb0FBQ0FDSTZBQlFRSnFPZ0FCSUFGQkFXb2lBVUgvL3dOT0JIOGdBVUVCYXdVZ0FRc2tzd0VMSUFBa3NnRUxsZ01CQm44Z0FCQXJJUUVnQUJBc0lRSWdBQkF0SVFRZ0FCQXVJUVVnQVNTWEFTQUNKSmdCSUFRa21RRWdCU1NhQVNBQUk3SUJhaUlBUVlDQWdBSWovd0YwUWNUWUFtMU9CRUFnQUVHQWdJQUNJLzhCZEVIRTJBSnRheUVBSUFFZ0FpQUVJQVVRTHlFREk3TUJRUUYwUVlDWndRQnFJZ1lnQTBHQS9nTnhRUWgyUVFKcU9nQUFJQVlnQTBIL0FYRkJBbW82QUFFak9nUkFJQUZCRDBFUFFROFFMeUVCSTdNQlFRRjBRWUNaSVdvaUF5QUJRWUQrQTNGQkNIWkJBbW82QUFBZ0F5QUJRZjhCY1VFQ2Fqb0FBVUVQSUFKQkQwRVBFQzhoQVNPekFVRUJkRUdBbVNscUlnSWdBVUdBL2dOeFFRaDJRUUpxT2dBQUlBSWdBVUgvQVhGQkFtbzZBQUZCRDBFUElBUkJEeEF2SVFFanN3RkJBWFJCZ0preGFpSUNJQUZCZ1A0RGNVRUlka0VDYWpvQUFDQUNJQUZCL3dGeFFRSnFPZ0FCUVE5QkQwRVBJQVVRTHlFQkk3TUJRUUYwUVlDWk9Xb2lBaUFCUVlEK0EzRkJDSFpCQW1vNkFBQWdBaUFCUWY4QmNVRUNham9BQVFzanN3RkJBV29pQVVILy93Tk9CSDhnQVVFQmF3VWdBUXNrc3dFTElBQWtzZ0VMUVFFQ2YwSFhBQ1AvQVhRaEFDT2tBU0VCQTBBZ0FTQUFUZ1JBSUFBUUtrVkJBQ00zR3dSQUlBQVFNQVVnQUJBeEN5QUJJQUJySVFFTUFRc0xJQUVrcEFFTHlnTUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERhdzRYQUFVS0R4TUJCZ3NRRkFJSERCRVZBd2dORWhZRUNRNFhDMEdRL2dNUUN5MEFBRUdBQVhJUEMwR1YvZ01RQ3kwQUFFSC9BWElQQzBHYS9nTVFDeTBBQUVIL0FISVBDMEdmL2dNUUN5MEFBRUgvQVhJUEMwR2svZ01RQ3kwQUFBOExRWkgrQXhBTExRQUFRVDl5RHd0Qmx2NERFQXN0QUFCQlAzSVBDMEdiL2dNUUN5MEFBRUgvQVhJUEMwR2cvZ01RQ3kwQUFFSC9BWElQQzBHbC9nTVFDeTBBQUE4TFFaTCtBeEFMTFFBQUR3dEJsLzRERUFzdEFBQVBDMEdjL2dNUUN5MEFBRUdmQVhJUEMwR2gvZ01RQ3kwQUFBOExRWUFCUVFBanJ3RWJJZ0JCQVhJZ0FFRitjU05WR3lJQVFRSnlJQUJCZlhFamJCc2lBRUVFY2lBQVFYdHhJM3diSWdCQkNISWdBRUYzY1NPT0FSdEI4QUJ5RHd0QmsvNERFQXN0QUFCQi93RnlEd3RCbVA0REVBc3RBQUJCL3dGeUR3dEJuZjRERUFzdEFBQkIvd0Z5RHd0Qm92NERFQXN0QUFBUEMwR1UvZ01RQ3kwQUFFRy9BWElQQzBHWi9nTVFDeTBBQUVHL0FYSVBDMEdlL2dNUUN5MEFBRUcvQVhJUEMwR2ovZ01RQ3kwQUFFRy9BWElQQzBGL0M0MEJBUUYvSTljQklRQWoyQUVFZnlBQVFYdHhJQUJCQkhJanp3RWJJZ0JCZm5FZ0FFRUJjaVBTQVJzaUFFRjNjU0FBUVFoeUk5QUJHeUlBUVgxeElBQkJBbklqMFFFYkJTUFpBUVIvSUFCQmZuRWdBRUVCY2lQVEFSc2lBRUY5Y1NBQVFRSnlJOVFCR3lJQVFYdHhJQUJCQkhJajFRRWJJZ0JCZDNFZ0FFRUljaVBXQVJzRklBQUxDMEh3QVhJTDlBSUJBWDhnQUVHQWdBSklCRUJCZnc4TElBQkJnTUFDU0VFQUlBQkJnSUFDVGhzRVFFRi9Ed3NnQUVHQS9BTklRUUFnQUVHQXdBTk9Hd1JBSUFCQmdFQnFFQXN0QUFBUEN5QUFRWi85QTB4QkFDQUFRWUQ4QTA0YkJFQkIvd0ZCZnlQZUFVRUNTQnNQQ3lBQVFjMytBMFlFUUVITi9nTVFDeTBBQUVFQmNRUi9RZjhCQlVIK0FRc2lBQ0FBUWY5K2NTUC9BUnNQQ3lBQVFjVCtBMFlFUUNQcUFTRUJJQUFRQ3lBQk9nQUFJK29CRHdzZ0FFR20vZ05NUVFBZ0FFR1EvZ05PR3dSQUVESWdBQkF6RHdzZ0FFR3YvZ05NUVFBZ0FFR24vZ05PR3dSQVFmOEJEd3NnQUVHLy9nTk1RUUFnQUVHdy9nTk9Hd1JBRURJamZBUkFJNEVCUVFGMVFiRCtBMm9RQ3kwQUFBOExRWDhQQ3lBQVFZVCtBMFlFUUNQREFVR0EvZ054UVFoMklRRWdBQkFMSUFFNkFBQWdBUThMSUFCQmhmNERSZ1JBSThRQklRRWdBQkFMSUFFNkFBQWp4QUVQQ3lBQVFZLytBMFlFUUNPOEFVSGdBWElQQ3lBQVFZRCtBMFlFUUJBMER3dEJmd3NzQVFGL0lBQWoyd0ZHQkVCQkFTVGRBUXNnQUJBMUlnRkJmMFlFZnlBQUVBc3RBQUFGSUFGQi93RnhDd3VhQWdFQ2Z5UHpBUVJBRHdzajlBRWhBeVAxQVNFQ0lBQkIvejlNQkVBZ0FVRVFjVVZCQUNBQ0cwVUVRQ0FCUVE5eElnQUVRQ0FBUVFwR0JFQkJBU1R4QVFzRlFRQWs4UUVMQ3dVZ0FFSC8vd0JNQkVBZ0FFSC8zd0JNUVFFajl3RWlBQnNFUUNBQlFROXhJKzhCSUFJYklRSWdBd1IvSUFGQkgzRWhBU0FDUWVBQmNRVWo5Z0VFZnlBQlFmOEFjU0VCSUFKQmdBRnhCVUVBSUFJZ0FCc0xDeUFCY2lUdkFRVWo3d0ZCL3dGeElBRkJBRXBCQ0hSeUpPOEJDd1ZCQUNBQVFmKy9BVXdnQWhzRVFDUHlBVUVBSUFNYkJFQWo3d0ZCSDNFZ0FVSGdBWEZ5Sk84QkR3c2dBVUVQY1NBQlFRTnhJL2NCR3lUd0FRVkJBQ0FBUWYvL0FVd2dBaHNFUUNBREJFQWdBVUVCY1VFQVJ5VHlBUXNMQ3dzTEM2b0JBUUovUVFFa1ZTTmJSUVJBUWNBQUpGc0xRWUFRSTFkclFRSjBJZ0JCQW5RZ0FDUC9BUnNrV0NOUkJFQWpVU1JaQlVFSUpGa0xRUUVrV2lOUEpGd2pWeVJoSTBvRVFDTktKR0FGUVFna1lBdEJBU05NUVFCS0lnQWpTa0VBU2hza1gwRUFKR0lnQUFSL0FuOGpZU0lBSTB4MUlRRkJBU05MQkg5QkFTUmlJQUFnQVdzRklBQWdBV29MUWY4UFNnMEFHa0VBQ3dWQkFBc0VRRUVBSkZVTEkxWkZCRUJCQUNSVkN3dU5BUUVDZnlBQVFRZHhJZ0VrVkNOU0lBRkJDSFJ5SkZjalUwVWlBUVJBSUFCQndBQnhRUUJISVFFTEk3RUJRUUZ4SWdKRkJFQWdBVUVBSTF0QkFFb2JCRUFqVzBFQmF5UmJRUUFqVzBVZ0FFR0FBWEViQkVCQkFDUlZDd3NMSUFCQndBQnhRUUJISkZNZ0FFR0FBWEVFUUJBNEkxTkJBRUVBSTF0QndBQkdJQUliR3dSQUkxdEJBV3NrV3dzTEM4c0JBUUovSUFCQkIzRWlBaVJySTJrZ0FrRUlkSElrYmlPeEFVRUJjU0VDSTJwRklnRUVRQ0FBUWNBQWNVRUFSeUVCQ3lBQ1JRUkFJQUZCQUNOeVFRQktHd1JBSTNKQkFXc2tja0VBSTNKRklBQkJnQUZ4R3dSQVFRQWtiQXNMQ3lBQVFjQUFjVUVBUnlScUlBQkJnQUZ4QkVCQkFTUnNJM0pGQkVCQndBQWtjZ3RCZ0JBamJtdEJBblFqL3dGMEpHOGphQVJBSTJna2NBVkJDQ1J3QzBFQkpIRWpaaVJ6STIxRkJFQkJBQ1JzQ3lOcVFRQkJBQ055UWNBQVJpQUNHeHNFUUNOeVFRRnJKSElMQ3d1K0FRRUJmeUFBUVFkeElnRWtleU41SUFGQkNIUnlKSDRqc1FGQkFYRWlBVVVFUUVFQUlBQkJ3QUJ4STNvYlFRQWpnQUZCQUVvYkJFQWpnQUZCQVdza2dBRkJBQ09BQVVVZ0FFR0FBWEViQkVCQkFDUjhDd3NMSUFCQndBQnhRUUJISkhvZ0FFR0FBWEVFUUVFQkpId2pnQUZGQkVCQmdBSWtnQUVMUVlBUUkzNXJRUUYwSS84QmRDUi9JMzlCQm1va2YwRUFKSUVCSTMxRkJFQkJBQ1I4Q3lONlFRQkJBQ09BQVVHQUFrWWdBUnNiQkVBamdBRkJBV3NrZ0FFTEN3dlRBUUVDZnlPTkFVVWlBUVJBSUFCQndBQnhRUUJISVFFTEk3RUJRUUZ4SWdKRkJFQWdBVUVBSTVNQlFRQktHd1JBSTVNQlFRRnJKSk1CUVFBamt3RkZJQUJCZ0FGeEd3UkFRUUFramdFTEN3c2dBRUhBQUhGQkFFY2tqUUVnQUVHQUFYRUVRRUVCSkk0Qkk1TUJSUVJBUWNBQUpKTUJDeU9WQVNPS0FYUWovd0YwSkpBQkk0a0JCRUFqaVFFa2tRRUZRUWdra1FFTFFRRWtrZ0VqaHdFa2xBRkIvLzhCSkpZQkk0OEJSUVJBUVFBa2pnRUxJNDBCUVFCQkFDT1RBVUhBQUVZZ0Foc2JCRUFqa3dGQkFXc2trd0VMQ3d2WEJ3QWpyd0ZGUVFBZ0FFR20vZ05IR3dSQVFRQVBDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RGF3NFhBQUlHQ2c0VkF3Y0xEd0VFQ0F3UUZRVUpEUkVTRXhRVkN5TkxJUUFnQVVId0FIRkJCSFlrU2lBQlFRaHhRUUJISkVzZ0FVRUhjU1JNSTJKQkFDTkxSVUVBSUFBYkd3UkFRUUFrVlFzTUZBdEJBQ0FCUVlBQmNVRUFSeUlBSTMwYkJFQkJBQ1NFQVFzZ0FDUjlJQUJGQkVBZ0FDUjhDd3dUQ3lBQlFRWjFRUU54SkUwZ0FVRS9jU1JPUWNBQUkwNXJKRnNNRWdzZ0FVRUdkVUVEY1NSa0lBRkJQM0VrWlVIQUFDTmxheVJ5REJFTElBRWtkMEdBQWlOM2F5U0FBUXdRQ3lBQlFUOXhKSVlCUWNBQUk0WUJheVNUQVF3UEN5TlZCRUJCQUNOYUkxRWJCRUFqWEVFQmFrRVBjU1JjQ3lOUUlBRkJDSEZCQUVkSEJFQkJFQ05jYTBFUGNTUmNDd3NnQVVFRWRVRVBjU1JQSUFGQkNIRkJBRWNrVUNBQlFRZHhKRkVnQVVINEFYRkJBRXNpQUNSV0lBQkZCRUJCQUNSVkN3d09DeU5zQkVCQkFDTnhJMmdiQkVBamMwRUJha0VQY1NSekN5Tm5JQUZCQ0hGQkFFZEhCRUJCRUNOemEwRVBjU1J6Q3dzZ0FVRUVkVUVQY1NSbUlBRkJDSEZCQUVja1p5QUJRUWR4SkdnZ0FVSDRBWEZCQUVzaUFDUnRJQUJGQkVBZ0FDUnNDd3dOQzBFQkpJTUJJQUZCQlhWQkQzRWtlQXdNQ3lPT0FRUkFRUUFqa2dFamlRRWJCRUFqbEFGQkFXcEJEM0VrbEFFTEk0Z0JJQUZCQ0hGQkFFZEhCRUJCRUNPVUFXdEJEM0VrbEFFTEN5QUJRUVIxUVE5eEpJY0JJQUZCQ0hGQkFFY2tpQUVnQVVFSGNTU0pBU0FCUWZnQmNVRUFTeUlBSkk4QklBQkZCRUFnQUNTT0FRc01Dd3NnQVNSU0lBRWpWRUVJZEhJa1Z3d0tDeUFCSkdrZ0FTTnJRUWgwY2lSdURBa0xJQUVrZVNBQkkzdEJDSFJ5Skg0TUNBc2dBVUVFZFNTS0FTQUJRUWh4UVFCSEpJc0JJQUZCQjNFaUFDU01BU0FBUVFGMElnQkJBVWdFZjBFQkJTQUFDMEVEZENTVkFRd0hDeUFCRURrTUJnc2dBUkE2REFVTElBRVFPd3dFQ3lBQkVEd01Bd3NnQVVFRWRVRUhjU1NsQVNBQlFRZHhKS1lCUVFFa29RRU1BZ3NnQVVHQUFYRkJBRWNrcWdFZ0FVSEFBSEZCQUVja3FRRWdBVUVnY1VFQVJ5U29BU0FCUVJCeFFRQkhKS2NCSUFGQkNIRkJBRWNrcmdFZ0FVRUVjVUVBUnlTdEFTQUJRUUp4UVFCSEpLd0JJQUZCQVhGQkFFY2txd0ZCQVNTaUFRd0JDeU92QVNJQUJIOUJBQVVnQVVHQUFYRUxCRUJCQnlTeEFVRUFKRjVCQUNSMUN5QUJRWUFCY1VWQkFDQUFHd1JBUVpEK0F5RUFBMEFnQUVHbS9nTklCRUFnQUVFQUVFTWdBRUVCYWlFQURBRUxDd3NnQVVHQUFYRkJBRWNrcndFTFFRRUxYd0VDZjBFQUpPa0JRUUFrNmdGQnhQNERFQXRCQURvQUFFSEIvZ01RQ3kwQUFFRjhjU0VDUVFBazNnRkJ3ZjRERUFzZ0Fqb0FBQ0FBQkVBRFFDQUJRWURZQlVnRVFDQUJRWURKQldwQi93RTZBQUFnQVVFQmFpRUJEQUVMQ3dzTHlRRUJBMzhqL2dGRkJFQVBDeUFBUVlBQmNVVkJBQ1A1QVJzRVFFRUFKUGtCUWRYK0F4QUxMUUFBUVlBQmNpRUFRZFgrQXhBTElBQTZBQUFQQzBIUi9nTVFDeTBBQUVFSWRFSFMvZ01RQ3kwQUFISkI4UDhEY1NFQlFkUCtBeEFMTFFBQVFRaDBRZFQrQXhBTExRQUFja0h3UDNGQmdJQUNhaUVDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKUGtCSUFNaytnRWdBU1Q3QVNBQ0pQd0JRZFgrQXhBTElBQkIvMzV4T2dBQUJTQUJJQUlnQXhCRVFkWCtBeEFMUWY4Qk9nQUFDd3ZEQVFFRWZ3TkFJQUlnQUVnRVFDQUNRUVJxSVFJand3RWlBVUVFYWtILy93TnhJZ01rd3dFanlRRUVRQ1BHQVNFRUk4VUJCRUFqeUFFa3hBRkJBU1MvQVVFQ0VDaEJBQ1RGQVVFQkpNWUJCU0FFQkVCQkFDVEdBUXNMSUFGQkFRSi9Ba0FDUUFKQUFrQUNRQ1BLQVE0RUFBRUNBd1FMUVFrTUJBdEJBd3dEQzBFRkRBSUxRUWNNQVF0QkFBc2lBWFJ4Qkg4Z0EwRUJJQUYwY1VVRlFRQUxCRUFqeEFGQkFXb2lBVUgvQVVvRWYwRUJKTVVCUVFBRklBRUxKTVFCQ3dzTUFRc0xDOHNCQVFOL0k4a0JJUUVnQUVFRWNVRUFSeVRKQVNBQVFRTnhJUU1nQVVVRVFBSi9Ba0FDUUFKQUFrQUNRQ1BLQVE0RUFBRUNBd1FMUVFrTUJBdEJBd3dEQzBFRkRBSUxRUWNNQVF0QkFBc2hBUUovQWtBQ1FBSkFBa0FDUUNBRERnUUFBUUlEQkF0QkNRd0VDMEVEREFNTFFRVU1BZ3RCQnd3QkMwRUFDeUVBSThNQklRSWp5UUVFZnlBQ1FRRWdBWFJ4QlNBQ1FRRWdBSFJ4UVFBZ0FrRUJJQUYwY1JzTEJFQWp4QUZCQVdvaUFFSC9BVW9FZjBFQkpNVUJRUUFGSUFBTEpNUUJDd3NnQXlUS0FRdTZDZ0VEZndKQUFrQWdBRUhOL2dOR0JFQkJ6ZjRERUFzZ0FVRUJjVG9BQUF3QkN5QUFRZEQrQTBaQkFDUDlBUnNFUUVFQUpQMEJRZjhCSklrQ0RBSUxJQUJCZ0lBQ1NBUkFJQUFnQVJBM0RBRUxJQUJCZ01BQ1NFRUFJQUJCZ0lBQ1Roc05BU0FBUVlEOEEwaEJBQ0FBUVlEQUEwNGJCRUFnQUVHQVFHb1FDeUFCT2dBQURBSUxJQUJCbi8wRFRFRUFJQUJCZ1B3RFRoc0VRQ1BlQVVFQ1RnOExJQUJCLy8wRFRFRUFJQUJCb1AwRFRoc05BQ0FBUVlMK0EwWUVRQ0FCUVFKeFFRQkhKTTBCSUFGQmdBRnhRUUJISk00QlFRRVBDeUFBUWFiK0EweEJBQ0FBUVpEK0EwNGJCRUFRTWlBQUlBRVFQUThMSUFCQnYvNERURUVBSUFCQnNQNERUaHNFUUJBeUkzd0VRQ09CQVVFQmRVR3cvZ05xRUFzZ0FUb0FBQXdDQ3d3Q0N5QUFRY3YrQTB4QkFDQUFRY0QrQTA0YkJFQWdBRUhBL2dOR0JFQWo0QUVoQUNBQlFZQUJjVUVBUnlUZ0FTQUJRY0FBY1VFQVJ5VGhBU0FCUVNCeFFRQkhKT0lCSUFGQkVIRkJBRWNrNHdFZ0FVRUljVUVBUnlUa0FTQUJRUVJ4UVFCSEpPVUJJQUZCQW5GQkFFY2s1Z0VnQVVFQmNVRUFSeVRuQVNQZ0FVVkJBQ0FBR3dSQVFRRVFQZ3RCQUNQZ0FTQUFHd1JBUVFBUVBnc01Bd3NnQUVIQi9nTkdCRUFnQVVINEFYRkJ3ZjRERUFzdEFBQkJCM0Z5UVlBQmNpRUFRY0grQXhBTElBQTZBQUFNQWdzZ0FFSEUvZ05HQkVCQkFDVHFBU0FBRUF0QkFEb0FBQXdDQ3lBQVFjWCtBMFlFUUNBQkpOOEJEQU1MSUFCQnh2NERSZ1JBUVFBaEFDQUJRUWgwSVFFRFFDQUFRWjhCVEFSQUlBQWdBV29RQ3kwQUFDRUNJQUJCZ1B3RGFoQUxJQUk2QUFBZ0FFRUJhaUVBREFFTEMwR0VCU1Q0QVF3REN3SkFBa0FDUUFKQUlBQkJ3LzREUndSQUlBQkJ3djREYXc0S0FRUUVCQVFFQkFRREFnUUxJQUVrNndFTUJnc2dBU1RzQVF3RkN5QUJKTzBCREFRTElBRWs3Z0VNQXdzTUFnc2dBRUhWL2dOR0JFQWdBUkEvREFFTFFRRWdBRUhQL2dOR0lBQkI4UDREUmhzRVFDUDVBUVJBSS9zQklnSkIvLzhCVEVFQUlBSkJnSUFCVGhzRWYwRUJCU0FDUWYrL0EweEJBQ0FDUVlDZ0EwNGJDdzBDQ3dzZ0FFSHIvZ05NUVFBZ0FFSG8vZ05PR3dSQVFRRWdBRUhyL2dOR0lBQkI2ZjREUmhzRVFDQUFRUUZySWdNUUN5MEFBRUcvZjNFaUFrRS9jU0lFUVVCcklBUWdBRUhyL2dOR0cwR0FrQVJxSUFFNkFBQWdBa0dBQVhFRVFDQURFQXNnQWtFQmFrR0FBWEk2QUFBTEN3d0NDeUFBUVlmK0EweEJBQ0FBUVlUK0EwNGJCRUFqd2dFUVFFRUFKTUlCQWtBQ1FBSkFBa0FnQUVHRS9nTkhCRUFnQUVHRi9nTnJEZ01CQWdNRUN5UERBU0VBUVFBa3d3RkJoUDRERUF0QkFEb0FBQ1BKQVFSL0lBQkJBUUovQWtBQ1FBSkFBa0FDUUNQS0FRNEVBQUVDQXdRTFFRa01CQXRCQXd3REMwRUZEQUlMUVFjTUFRdEJBQXQwY1FWQkFBc0VRQ1BFQVVFQmFpSUFRZjhCU2dSL1FRRWt4UUZCQUFVZ0FBc2t4QUVMREFVTEFrQWp5UUVFUUNQR0FRMEJJOFVCQkVCQkFDVEZBUXNMSUFFa3hBRUxEQVVMSUFFa3lBRWp4Z0ZCQUNQSkFSc0VRQ0FCSk1RQlFRQWt4Z0VMREFRTElBRVFRUXdEQ3d3Q0N5QUFRWUQrQTBZRVFDQUJRZjhCY3lUWEFTUFhBU0lDUVJCeFFRQkhKTmdCSUFKQklIRkJBRWNrMlFFTElBQkJqLzREUmdSQUlBRkJBWEZCQUVja3ZRRWdBVUVDY1VFQVJ5UytBU0FCUVFSeFFRQkhKTDhCSUFGQkNIRkJBRWNrd0FFZ0FVRVFjVUVBUnlUQkFTQUJKTHdCREFJTElBQkIvLzhEUmdSQUlBRkJBWEZCQUVja3R3RWdBVUVDY1VFQVJ5UzRBU0FCUVFSeFFRQkhKTGtCSUFGQkNIRkJBRWNrdWdFZ0FVRVFjVUVBUnlTN0FTQUJKTFlCREFJTERBRUxRUUFQQzBFQkN5SUFJQUFqM0FGR0JFQkJBU1RkQVFzZ0FDQUJFRUlFUUNBQUVBc2dBVG9BQUFzTFdBRURmd05BSUFNZ0FrZ0VRQ0FBSUFOcUVEWWhCU0FCSUFOcUlRUURRQ0FFUWYrL0Frb0VRQ0FFUVlCQWFpRUVEQUVMQ3lBRUlBVVFReUFEUVFGcUlRTU1BUXNMSS9nQlFTQWovd0YwSUFKQkJIVnNhaVQ0QVFzNkFDUHFBU1BmQVVaQkFDQUFRUUZHUVFFZ0FCc2JCRUFnQVVFRWNpSUJRY0FBY1FSQVFRRWt2Z0ZCQVJBb0N3VWdBVUY3Y1NFQkN5QUJDL3dDQVFSL0krQUJSUVJBRHdzajZnRWlBa0dRQVU0RWYwRUJCU1BwQVNJQVFmZ0NJLzhCZENJQlRnUi9RUUlGUVFOQkFDQUFJQUZPR3dzTElnQWozZ0ZIQkVCQndmNERFQXN0QUFBaEF5QUFKTjRCUVFBaEFRSkFBa0FDUUFKQUlBQWlBZ1JBSUFKQkFXc09Bd0VDQXdRTElBTkJmSEVpQTBFSWNVRUFSeUVCREFNTElBTkJmWEZCQVhJaUEwRVFjVUVBUnlFQkRBSUxJQU5CZm5GQkFuSWlBMEVnY1VFQVJ5RUJEQUVMSUFOQkEzSWhBd3NnQVFSQVFRRWt2Z0ZCQVJBb0N5QUNSUVJBSS9rQkJFQWord0VqL0FFaitnRWlBVUVRU0FSL0lBRUZRUkFMSWdBUVJDQUFJL3NCYWlUN0FTQUFJL3dCYWlUOEFTQUJJQUJySWdBaytnRWdBRUVBVEFSQVFRQWsrUUZCMWY0REVBdEIvd0U2QUFBRlFkWCtBeEFMSUFCQkJIVkJBV3RCLzM1eE9nQUFDd3NMSUFKQkFVWUVRRUVCSkwwQlFRQVFLQXNnQWlBREVFVWhBRUhCL2dNUUN5QUFPZ0FBQlNBQ1Faa0JSZ1JBSUFCQndmNERFQXN0QUFBUVJTRUFRY0grQXhBTElBQTZBQUFMQ3d1QUFnRURmeVBnQVFSQUlBQWo2UUZxSk9rQkl6WWhBd05BSStrQlFRUWovd0VpQUhSQnlBTWdBSFFqNmdGQm1RRkdHMDRFUUNQcEFVRUVJLzhCSWdCMFFjZ0RJQUIwSStvQklnRkJtUUZHRzJzazZRRWdBVUdRQVVZRVFDQURCRUJCQUNFQUEwQWdBRUdRQVV3RVFDQUFRZjhCY1JBbklBQkJBV29oQUF3QkN3c0ZJQUVRSnd0QkFDRUFBMEFnQUVHUUFVZ0VRRUVBSVFJRFFDQUNRYUFCU0FSQUlBSWdBRUdnQVd4cVFZQ1JCR3BCQURvQUFDQUNRUUZxSVFJTUFRc0xJQUJCQVdvaEFBd0JDd3RCZnlSSFFYOGtTQVVnQVVHUUFVZ0VRQ0FEUlFSQUlBRVFKd3NMQzBFQUlBRkJBV29nQVVHWkFVb2JKT29CREFFTEN3c1FSZ3ZHQVFFRGZ5UE9BVVVFUUE4TEEwQWdBeUFBU0FSQUlBTkJCR29oQXdKL0k4c0JJZ0pCQkdvaUFVSC8vd05LQkVBZ0FVR0FnQVJySVFFTElBRUxKTXNCSUFKQkFVRUNRUWNqelFFYklnSjBjUVIvSUFGQkFTQUNkSEZGQlVFQUN3UkFRWUgrQXhBTExRQUFRUUYwUVFGcVFmOEJjU0VCUVlIK0F4QUxJQUU2QUFBanpBRkJBV29pQVVFSVJnUkFRUUFrekFGQkFTVEFBVUVERUNoQmd2NERFQXN0QUFCQi8zNXhJUUZCZ3Y0REVBc2dBVG9BQUVFQUpNNEJCU0FCSk13QkN3c01BUXNMQzl3QkFRRi9JL2dCUVFCS0JFQWdBQ1A0QVdvaEFFRUFKUGdCQ3lBQUk0b0NhaVNLQWlPT0FrVUVRQ00wQkVBZ0FDUG9BV29rNkFGQkJDUC9BU0lCZEVISUF5QUJkQ1BxQVVHWkFVWWJJUUVEUUNQb0FTQUJUZ1JBSUFFUVJ5UG9BU0FCYXlUb0FRd0JDd3NGSUFBUVJ3c2pNd1JBSUFBanBBRnFKS1FCRURJRklBQVFLa1ZCQUNNM0d3UkFJQUFRTUFVZ0FCQXhDd3NnQUJCSUN5TTFCRUFnQUNQQ0FXb2t3Z0Vqd2dFUVFFRUFKTUlCQlNBQUVFQUxJQUFqa1FKcUlnQWpqd0pPQkg4amtBSkJBV29ra0FJZ0FDT1BBbXNGSUFBTEpKRUNDeXdCQVg5QkJCQkpJNGtDUVFGcVFmLy9BM0VRQ3kwQUFFRUlkQ0VBUVFRUVNTQUFJNGtDRUFzdEFBQnlDejhCQVg4Z0FVR0EvZ054UVFoMklRSWdBQ0FCUWY4QmNTSUJFRUlFUUNBQUVBc2dBVG9BQUFzZ0FFRUJhaUlBSUFJUVFnUkFJQUFRQ3lBQ09nQUFDd3ZHQVFBZ0FnUkFJQUVnQUVILy93TnhJZ0J6SUFBZ0FXcHpJZ0JCRUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVHQUFuRkJBRWRCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzRklBQWdBV3BCLy84RGNTSUNJQUJCLy84RGNVbEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWlBQUlBRnpjMEdBSUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NMQzVvSUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQU9FQk1BQVFJREJBVUdCd2dKQ2dzTURRNFBDeEJLUWYvL0EzRWlBRUdBL2dOeFFRaDJKSUVDSUFCQi93RnhKSUlDREE4TEk0SUNRZjhCY1NPQkFrSC9BWEZCQ0hSeUlRQWpnQUloQVVFRUVFa2dBQ0FCRUVNTUVRc2pnZ0pCL3dGeEk0RUNRZjhCY1VFSWRISkJBV3BCLy84RGNTRUFEQkVMSTRFQ0lnQkJEM0ZCQVdwQkVIRkJBRWRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJha0gvQVhFaUFDU0JBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NEQThMUVFFamdRSWlBRUVQY1V0QkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYTBIL0FYRWlBQ1NCQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQndBQnlRZjhCY1NTSEFnd09DMEVFRUVramlRSVFDeTBBQUNTQkFnd0xDeU9BQWlJQVFZQUJjVUdBQVVaQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBRUVCZENBQVFmOEJjVUVIZG5KQi93RnhKSUFDREFzTEVFcEIvLzhEY1NFQUk0Z0NJUUZCQ0JCSklBQWdBUkJMREFnTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlnQWpnZ0pCL3dGeEk0RUNRZjhCY1VFSWRISWlBVUVBRUV3Z0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRpU0ZBaUFBUWY4QmNTU0dBaU9IQWtHL0FYRWtod0pCQ0E4TEk0SUNRZjhCY1NPQkFrSC9BWEZCQ0hSeUlRQkJCQkJKSUFBUU5rSC9BWEVrZ0FJTUNRc2pnZ0pCL3dGeEk0RUNRZjhCY1VFSWRISkJBV3RCLy84RGNTRUFEQWtMSTRJQ0lnQkJEM0ZCQVdwQkVIRkJBRWRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJha0gvQVhFaUFDU0NBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NEQWNMUVFFamdnSWlBRUVQY1V0QkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYTBIL0FYRWlBQ1NDQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQndBQnlRZjhCY1NTSEFnd0dDMEVFRUVramlRSVFDeTBBQUNTQ0Fnd0RDeU9BQWlJQVFRRnhRUUJMUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTElBQkJCM1FnQUVIL0FYRkJBWFp5UWY4QmNTU0FBZ3dEQzBGL0R3c2ppUUpCQW1wQi8vOERjU1NKQWd3Q0N5T0pBa0VCYWtILy93TnhKSWtDREFFTEk0Y0NRZjhBY1NTSEFpT0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NDMEVFRHdzZ0FFR0EvZ054UVFoMkpJRUNJQUJCL3dGeEpJSUNRUWdMOGdnQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRVFhdzRRQUFFQ0F3UUZCZ2NJQ1FvTERBME9EeEFMSS80QkJFQkJCQkJKUWMzK0F4QTJRZjhCY1NJQUlRRWdBRUVCY1FSQUlBRkJmbkVpQUVHQUFYRUVmMEVBSlA4QklBQkIvMzV4QlVFQkpQOEJJQUJCZ0FGeUN5RUFRUVFRU1VITi9nTWdBQkJEUWNRQUR3c0xRUUVramdJTUVBc1FTa0gvL3dOeElnQkJnUDREY1VFSWRpU0RBaUFBUWY4QmNTU0VBaU9KQWtFQ2FrSC8vd054SklrQ0RCRUxJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlJUUFqZ0FJaEFVRUVFRWtnQUNBQkVFTU1FQXNqaEFKQi93RnhJNE1DUWY4QmNVRUlkSEpCQVdwQi8vOERjU0VBREJBTEk0TUNJZ0JCRDNGQkFXcEJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYWtIL0FYRWtnd0lqZ3dKRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lNRGd0QkFTT0RBaUlBUVE5eFMwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFBUVFGclFmOEJjU1NEQWlPREFrVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SU1EUXRCQkJCSkk0a0NFQXN0QUFBa2d3SU1DZ3NqZ0FJaUFVR0FBWEZCZ0FGR0lRQWpod0pCQkhaQkFYRWdBVUVCZEhKQi93RnhKSUFDREFvTFFRUVFTU09KQWhBTExRQUFJUUFqaVFJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSWtDUVFnUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpSUFJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlJZ0ZCQUJCTUlBQWdBV3BCLy84RGNTSUFRWUQrQTNGQkNIWWtoUUlnQUVIL0FYRWtoZ0lqaHdKQnZ3RnhKSWNDUVFnUEN5T0VBa0gvQVhFamd3SkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklBQ0RBZ0xJNFFDUWY4QmNTT0RBa0gvQVhGQkNIUnlRUUZyUWYvL0EzRWhBQXdJQ3lPRUFpSUFRUTl4UVFGcVFSQnhRUUJIUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTElBQkJBV3BCL3dGeElnQWtoQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBZ3dHQzBFQkk0UUNJZ0JCRDNGTFFRQkxCRUFqaHdKQklISkIvd0Z4SkljQ0JTT0hBa0hmQVhFa2h3SUxJQUJCQVd0Qi93RnhJZ0FraEFJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SU1CUXRCQkJCSkk0a0NFQXN0QUFBa2hBSU1BZ3NqZ0FJaUFVRUJjU0VBSTRjQ1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpU0FBZ3dDQzBGL0R3c2ppUUpCQVdwQi8vOERjU1NKQWd3QkN5QUFRUUJLQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSTRjQ1FmOEFjU1NIQWlPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0MwRUVEd3NnQUVHQS9nTnhRUWgySklNQ0lBQkIvd0Z4SklRQ1FRZ0xqUW9CQW44Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCSUdzT0VBQUJBZ01FQlFZSENBa0tDd3dORGc4UUN5T0hBa0VIZGtFQmNRUkFJNGtDUVFGcVFmLy9BM0VraVFJRlFRUVFTU09KQWhBTExRQUFJUUFqaVFJZ0FFRVlkRUVZZFdwQi8vOERjVUVCYWtILy93TnhKSWtDQzBFSUR3c1FTa0gvL3dOeElnQkJnUDREY1VFSWRpU0ZBaUFBUWY4QmNTU0dBaU9KQWtFQ2FrSC8vd054SklrQ0RCQUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUFqZ0FJaEFVRUVFRWtnQUNBQkVFTWdBRUVCYWtILy93TnhJZ0JCZ1A0RGNVRUlkaVNGQWlBQVFmOEJjU1NHQWd3UEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElRQU1Ed3NqaFFJaUFFRVBjVUVCYWtFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQVFRRnFRZjhCY1NJQUpJVUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SU1EUXRCQVNPRkFpSUFRUTl4UzBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N5QUFRUUZyUWY4QmNTSUFKSVVDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtIQUFISkIvd0Z4SkljQ0RBd0xRUVFRU1NPSkFoQUxMUUFBSklVQ0RBb0xRUVpCQUNPSEFpSUNRUVYyUVFGeFFRQkxHeUlBUWVBQWNpQUFJQUpCQkhaQkFYRkJBRXNiSVFFamdBSWhBQ0FDUVFaMlFRRnhRUUJMQkg4Z0FDQUJhMEgvQVhFRklBRkJCbklnQVNBQVFROXhRUWxMR3lJQlFlQUFjaUFCSUFCQm1RRkxHeUlCSUFCcVFmOEJjUXNpQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJQUZCNEFCeFFRQkhRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMSTRjQ1FkOEJjU1NIQWlBQUpJQUNEQW9MSTRjQ1FRZDJRUUZ4UVFCTEJFQkJCQkJKSTRrQ0VBc3RBQUFoQUNPSkFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VraVFJRkk0a0NRUUZxUWYvL0EzRWtpUUlMUVFnUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpSUFJQUJCQUJCTUlBQkJBWFJCLy84RGNTSUFRWUQrQTNGQkNIWWtoUUlnQUVIL0FYRWtoZ0lqaHdKQnZ3RnhKSWNDUVFnUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklBQ0lBQkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIWWtoUUlnQUVIL0FYRWtoZ0lNQndzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NFQURBY0xJNFlDSWdCQkQzRkJBV3BCRUhGQkFFZEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmFrSC9BWEVpQUNTR0FpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0RBVUxRUUVqaGdJaUFFRVBjVXRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FFRUJhMEgvQVhFaUFDU0dBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd3RUMwRUVFRWtqaVFJUUN5MEFBQ1NHQWd3Q0N5T0FBa0YvYzBIL0FYRWtnQUlqaHdKQndBQnlRZjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNQWd0QmZ3OExJNGtDUVFGcVFmLy9BM0VraVFJTFFRUVBDeUFBUVlEK0EzRkJDSFlraFFJZ0FFSC9BWEVraGdKQkNBdWtDUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJNR3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPSEFrRUVka0VCY1FSQUk0a0NRUUZxUWYvL0EzRWtpUUlGUVFRUVNTT0pBaEFMTFFBQUlRQWppUUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJa0NDMEVJRHdzUVNrSC8vd054SklnQ0k0a0NRUUpxUWYvL0EzRWtpUUlNRUFzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFDT0FBaUVCUVFRUVNTQUFJQUVRUXlBQVFRRnJRZi8vQTNFaUFFR0EvZ054UVFoMkpJVUNJQUJCL3dGeEpJWUNEQThMSTRnQ1FRRnFRZi8vQTNFa2lBSkJDQThMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQkpJQUJCLy84RGNTSUFFRFlpQVVFUGNVRUJha0VRY1VFQVIwRUFTd1JBSTRjQ1FTQnlRZjhCY1NTSEFnVWpod0pCM3dGeEpJY0NDeUFCUVFGcVFmOEJjU0lCUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NRUVFRU1NBQUlBRVFRd3dOQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQVFRUVFTVUVCSUFCQi8vOERjU0lBRURZaUFVRVBjVXRCQUVzRVFDT0hBa0VnY2tIL0FYRWtod0lGSTRjQ1FkOEJjU1NIQWdzZ0FVRUJhMEgvQVhFaUFVVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FjQUFja0gvQVhFa2h3SkJCQkJKSUFBZ0FSQkREQXdMSTRZQ1FmOEJjU09GQWtIL0FYRkJDSFJ5SVFCQkJCQkpJNGtDRUFzdEFBQWhBVUVFRUVrZ0FFSC8vd054SUFGQi93RnhFRU1NQ2dzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpT0hBa0VRY2tIL0FYRWtod0lNQ2dzamh3SkJCSFpCQVhFRVFFRUVFRWtqaVFJUUN5MEFBQ0VBSTRrQ0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NKQWdVamlRSkJBV3BCLy84RGNTU0pBZ3RCQ0E4TEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlnQWppQUpCQUJCTUlBQWppQUpxUWYvL0EzRWlBRUdBL2dOeFFRaDJKSVVDSUFCQi93RnhKSVlDSTRjQ1FiOEJjU1NIQWtFSUR3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVrZ0FCQTJRZjhCY1NTQUFpQUFRUUZyUWYvL0EzRWlBRUdBL2dOeFFRaDJKSVVDSUFCQi93RnhKSVlDREFjTEk0Z0NRUUZyUWYvL0EzRWtpQUpCQ0E4TEk0QUNJZ0JCRDNGQkFXcEJFSEZCQUVkQkFFc0VRQ09IQWtFZ2NrSC9BWEVraHdJRkk0Y0NRZDhCY1NTSEFnc2dBRUVCYWtIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDREFVTFFRRWpnQUlpQUVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NnQUVFQmEwSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBZ3dFQzBFRUVFa2ppUUlRQ3kwQUFDU0FBZ3dDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRUVIyUVFGeFFRQk5RUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMREFJTFFYOFBDeU9KQWtFQmFrSC8vd054SklrQ0MwRUVDL2tCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCUUdvT0VBOEFBUUlEQkFVR0J3OElDUW9MREEwT0N5T0NBaVNCQWd3T0N5T0RBaVNCQWd3TkN5T0VBaVNCQWd3TUN5T0ZBaVNCQWd3TEN5T0dBaVNCQWd3S0N5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklFQ0RBa0xJNEFDSklFQ0RBZ0xJNEVDSklJQ0RBY0xJNE1DSklJQ0RBWUxJNFFDSklJQ0RBVUxJNFVDSklJQ0RBUUxJNFlDSklJQ0RBTUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQVFOa0gvQVhFa2dnSU1BZ3NqZ0FJa2dnSU1BUXRCZnc4TFFRUUwrZ0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhRQUdzT0VBQUJEd0lEQkFVR0J3Z0pEd29MREEwT0N5T0JBaVNEQWd3T0N5T0NBaVNEQWd3TkN5T0VBaVNEQWd3TUN5T0ZBaVNEQWd3TEN5T0dBaVNEQWd3S0N5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklNQ0RBa0xJNEFDSklNQ0RBZ0xJNEVDSklRQ0RBY0xJNElDSklRQ0RBWUxJNE1DSklRQ0RBVUxJNFVDSklRQ0RBUUxJNFlDSklRQ0RBTUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQVFOa0gvQVhFa2hBSU1BZ3NqZ0FJa2hBSU1BUXRCZnc4TFFRUUwrZ0VBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUhnQUdzT0VBQUJBZ01QQkFVR0J3Z0pDZ3NQREEwT0N5T0JBaVNGQWd3T0N5T0NBaVNGQWd3TkN5T0RBaVNGQWd3TUN5T0VBaVNGQWd3TEN5T0dBaVNGQWd3S0N5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWkIvd0Z4SklVQ0RBa0xJNEFDSklVQ0RBZ0xJNEVDSklZQ0RBY0xJNElDSklZQ0RBWUxJNE1DSklZQ0RBVUxJNFFDSklZQ0RBUUxJNFVDSklZQ0RBTUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQVFOa0gvQVhFa2hnSU1BZ3NqZ0FJa2hnSU1BUXRCZnc4TFFRUUwyZ01CQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQnJEaEFBQVFJREJBVUdCd2dKQ2dzTURRNFFEd3NqaGdKQi93RnhJNFVDUWY4QmNVRUlkSEloQUNPQkFpRUJRUVFRU1NBQUlBRVFRd3dQQ3lPR0FrSC9BWEVqaFFKQi93RnhRUWgwY2lFQUk0SUNJUUZCQkJCSklBQWdBUkJEREE0TEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQWpnd0loQVVFRUVFa2dBQ0FCRUVNTURRc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBQ09FQWlFQlFRUVFTU0FBSUFFUVF3d01DeU9HQWtIL0FYRWpoUUlpQUVIL0FYRkJDSFJ5SVFGQkJCQkpJQUVnQUJCRERBc0xJNFlDSWdCQi93RnhJNFVDUWY4QmNVRUlkSEloQVVFRUVFa2dBU0FBRUVNTUNnc2orUUZGQkVBQ1FDTzBBUVJBUVFFa2l3SU1BUXNqdGdFanZBRnhRUjl4UlFSQVFRRWtqQUlNQVF0QkFTU05BZ3NMREFrTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQWpnQUloQVVFRUVFa2dBQ0FCRUVNTUNBc2pnUUlrZ0FJTUJ3c2pnZ0lrZ0FJTUJnc2pnd0lrZ0FJTUJRc2poQUlrZ0FJTUJBc2poUUlrZ0FJTUF3c2poZ0lrZ0FJTUFnc2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVrZ0FCQTJRZjhCY1NTQUFnd0JDMEYvRHd0QkJBdWtBZ0VGZnlPQUFpSURJUVFnQUVIL0FYRWlBU0VDSUFGQkFFOEVRQ0FFUVE5eElBSkJEM0ZxUVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMQlNBQ1FSOTJJZ1VnQWlBRmFuTkJEM0VnQkVFUGNVdEJBRXNFUUNPSEFrRWdja0gvQVhFa2h3SUZJNGNDUWQ4QmNTU0hBZ3NMSUFGQkFFOEVRQ0FEUWY4QmNTQUJJQU5xUWY4QmNVdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NGSUFGQkgzWWlBaUFCSUFKcWN5QURRZjhCY1VwQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc0xJQUFnQTJwQi93RnhJZ0FrZ0FJZ0FFVkJBRXNFUUNPSEFrR0FBWEpCL3dGeEpJY0NCU09IQWtIL0FIRWtod0lMSTRjQ1FiOEJjU1NIQWd1dkFRRUNmeUFBSTRBQ0lnRnFJNGNDUVFSMlFRRnhha0gvQVhFaUFpQUFJQUZ6YzBFUWNVRUFSMEVBU3dSQUk0Y0NRU0J5UWY4QmNTU0hBZ1VqaHdKQjN3RnhKSWNDQ3lBQklBQkIvd0Z4YWlPSEFrRUVka0VCY1dwQmdBSnhRUUJMUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTElBSWtnQUlnQWtWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBZ3Y0QVFBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR0FBV3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPQkFoQlZEQkFMSTRJQ0VGVU1Ed3NqZ3dJUVZRd09DeU9FQWhCVkRBMExJNFVDRUZVTURBc2poZ0lRVlF3TEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWVFWUXdLQ3lPQUFoQlZEQWtMSTRFQ0VGWU1DQXNqZ2dJUVZnd0hDeU9EQWhCV0RBWUxJNFFDRUZZTUJRc2poUUlRVmd3RUN5T0dBaEJXREFNTEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUlRQkJCQkJKSUFBUU5oQldEQUlMSTRBQ0VGWU1BUXRCZnc4TFFRUUxxd0lCQlg4amdBSWlBeUVFUVFBZ0FFSC9BWEZySWdFaEFpQUJRUUJPQkVBZ0JFRVBjU0FDUVE5eGFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N3VWdBa0VmZFNJRklBSWdCV3B6UVE5eElBUkJEM0ZMUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTEN5QUJRUUJPQkVBZ0EwSC9BWEVnQVNBRGFrSC9BWEZMUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTEJTQUJRUjkxSWdJZ0FTQUNhbk1nQTBIL0FYRktRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMQ3lBRElBQnJRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0hBQUhKQi93RnhKSWNDQzdNQkFRSi9JNEFDSWdFZ0FHc2pod0pCQkhaQkFYRnJRZjhCY1NJQ0lBQWdBWE56UVJCeFFRQkhRUUJMQkVBamh3SkJJSEpCL3dGeEpJY0NCU09IQWtIZkFYRWtod0lMSUFFZ0FFSC9BWEZySTRjQ1FRUjJRUUZ4YTBHQUFuRkJBRXRCQUVzRVFDT0hBa0VRY2tIL0FYRWtod0lGSTRjQ1FlOEJjU1NIQWdzZ0FpU0FBaUFDUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCd0FCeVFmOEJjU1NIQWd2NEFRQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUdRQVdzT0VBQUJBZ01FQlFZSENBa0tDd3dORGc4UUN5T0JBaEJZREJBTEk0SUNFRmdNRHdzamd3SVFXQXdPQ3lPRUFoQllEQTBMSTRVQ0VGZ01EQXNqaGdJUVdBd0xDeU9HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNTQUFFRFlRV0F3S0N5T0FBaEJZREFrTEk0RUNFRmtNQ0FzamdnSVFXUXdIQ3lPREFoQlpEQVlMSTRRQ0VGa01CUXNqaFFJUVdRd0VDeU9HQWhCWkRBTUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUJCQkJCSklBQVFOaEJaREFJTEk0QUNFRmtNQVF0QmZ3OExRUVFMNXdrQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJvQUZyRGhBQUFRSURCQVVHQndnSkNnc01EUTRQRUFzamdRSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNRUFzamdnSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNRHdzamd3SWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNRGdzamhBSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNRFFzamhRSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNREFzamhnSWpnQUp4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0lNQ3dzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRWtnQUJBMkk0QUNjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NEQW9MSTRBQ0lnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdJTUNRc2pnUUlqZ0FKelFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0RBZ0xJNElDSTRBQ2MwSC9BWEVpQUNTQUFpQUFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFnd0hDeU9EQWlPQUFuTkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SU1CZ3NqaEFJamdBSnpRZjhCY1NJQUpJQUNJQUJGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NEQVVMSTRVQ0k0QUNjMEgvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBZ3dFQ3lPR0FpT0FBbk5CL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lNQXdzamhnSkIvd0Z4STRVQ1FmOEJjVUVJZEhJaEFFRUVFRWtnQUJBMkk0QUNjMEgvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBZ3dDQzBFQUpJQUNJNGNDUVlBQmNrSC9BWEVraHdJamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFnd0JDMEYvRHdzamh3SkI3d0Z4SkljQ1FRUUxvQUlCQkg4amdBSWlBaUVEUVFBZ0FFSC9BWEZySWdBaEFTQUFRUUJPQkVBZ0EwRVBjU0FCUVE5eGFrRVFjVUVBUjBFQVN3UkFJNGNDUVNCeVFmOEJjU1NIQWdVamh3SkIzd0Z4SkljQ0N3VWdBVUVmZFNJRUlBRWdCR3B6UVE5eElBTkJEM0ZMUVFCTEJFQWpod0pCSUhKQi93RnhKSWNDQlNPSEFrSGZBWEVraHdJTEN5QUFRUUJPQkVBZ0FrSC9BWEVnQUNBQ2FrSC9BWEZMUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTEJTQUFRUjkxSWdFZ0FDQUJhbk1nQWtIL0FYRktRUUJMQkVBamh3SkJFSEpCL3dGeEpJY0NCU09IQWtIdkFYRWtod0lMQ3lBQUlBSnFSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ3QUJ5UWY4QmNTU0hBZ3ZNQmdBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR3dBV3NPRUFBQkFnTUVCUVlIQ0FrS0N3d05EZzhRQ3lPQkFpT0FBbkpCL3dGeElnQWtnQUlnQUVWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0lqaHdKQjd3RnhKSWNDREJBTEk0SUNJNEFDY2tIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTUR3c2pnd0lqZ0FKeVFmOEJjU0lBSklBQ0lBQkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ0k0Y0NRZThCY1NTSEFnd09DeU9FQWlPQUFuSkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQTBMSTRVQ0k0QUNja0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaU9IQWtIdkFYRWtod0lNREFzamhnSWpnQUp5UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWd3TEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpRUFRUVFRU1NBQUVEWWpnQUp5UWY4QmNTSUFKSUFDSUFCRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDSTRjQ1FlOEJjU1NIQWd3S0N5T0FBa0gvQVhFaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaU9IQWtIdkFYRWtod0lNQ1FzamdRSVFYQXdJQ3lPQ0FoQmNEQWNMSTRNQ0VGd01CZ3NqaEFJUVhBd0ZDeU9GQWhCY0RBUUxJNFlDRUZ3TUF3c2poZ0pCL3dGeEk0VUNRZjhCY1VFSWRISWhBRUVFRUVrZ0FCQTJFRndNQWdzamdBSVFYQXdCQzBGL0R3dEJCQXRGQVFKL0lBQVFOU0lCUVg5R0JIOGdBQkFMTFFBQUJTQUJDMEgvQVhFaEFpQUNJQUJCQVdvaUFSQTFJZ0JCZjBZRWZ5QUJFQXN0QUFBRklBQUxRZjhCY1VFSWRISUwrUkVCQlg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRUhjU0lGRGdnQUFRSURCQVVHQndnTEk0RUNJUUVNQndzamdnSWhBUXdHQ3lPREFpRUJEQVVMSTRRQ0lRRU1CQXNqaFFJaEFRd0RDeU9HQWlFQkRBSUxJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUZCQkJCSklBRVFOaUVCREFFTEk0QUNJUUVMQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWZBQmNVRUVkaUlFRGhBQUFRSURCQVVHQndnSkNnc01EUTRQRUFzZ0FFRUhUQVIvSUFGQmdBRnhRWUFCUmtFQVN3UkFJNGNDUVJCeVFmOEJjU1NIQWdVamh3SkI3d0Z4SkljQ0N5QUJRUUYwSUFGQi93RnhRUWQyY2tIL0FYRWlBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SkJBUVVnQUVFUFRBUi9JQUZCQVhGQkFFdEJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQVVFSGRDQUJRZjhCY1VFQmRuSkIvd0Z4SWdKRlFRQkxCRUFqaHdKQmdBRnlRZjhCY1NTSEFnVWpod0pCL3dCeEpJY0NDeU9IQWtHL0FYRWtod0lqaHdKQjN3RnhKSWNDUVFFRlFRQUxDeUVEREE4TElBQkJGMHdFZnlPSEFrRUVka0VCY1NBQlFRRjBja0gvQVhFaEFpQUJRWUFCY1VHQUFVWkJBRXNFUUNPSEFrRVFja0gvQVhFa2h3SUZJNGNDUWU4QmNTU0hBZ3NnQWtWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtIZkFYRWtod0pCQVFVZ0FFRWZUQVIvSTRjQ1FRUjJRUUZ4UVFkMElBRkIvd0Z4UVFGMmNpRUNJQUZCQVhGQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFnc2dBa1ZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SkJBUVZCQUFzTElRTU1EZ3NnQUVFblRBUi9JQUZCQVhSQi93RnhJUUlnQVVHQUFYRkJnQUZHUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTElBSkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkIzd0Z4SkljQ1FRRUZJQUJCTDB3RWZ5QUJRUUZ4SVFBZ0FVSC9BWEZCQVhZaUFrR0FBWElnQWlBQlFZQUJjVUdBQVVZYklnSkIvd0Z4UlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUWQ4QmNTU0hBaUFBUVFCTEJFQWpod0pCRUhKQi93RnhKSWNDQlNPSEFrSHZBWEVraHdJTFFRRUZRUUFMQ3lFRERBMExJQUJCTjB3RWZ5QUJRUTl4UVFSMElBRkI4QUZ4UVFSMmNpSUNSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRZDhCY1NTSEFpT0hBa0h2QVhFa2h3SkJBUVVnQUVFL1RBUi9JQUZCL3dGeFFRRjJJZ0pGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCM3dGeEpJY0NJQUZCQVhGQkFFc0VRQ09IQWtFUWNrSC9BWEVraHdJRkk0Y0NRZThCY1NTSEFndEJBUVZCQUFzTElRTU1EQXNnQUVISEFFd0VmeUFCSWdKQkFYRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NRUUVGSUFCQnp3Qk1CSDhnQVNJQ1FRSnhSVUVBU3dSQUk0Y0NRWUFCY2tIL0FYRWtod0lGSTRjQ1FmOEFjU1NIQWdzamh3SkJ2d0Z4SkljQ0k0Y0NRU0J5UWY4QmNTU0hBa0VCQlVFQUN3c2hBd3dMQ3lBQVFkY0FUQVIvSUFFaUFrRUVjVVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0VnY2tIL0FYRWtod0pCQVFVZ0FFSGZBRXdFZnlBQklnSkJDSEZGUVFCTEJFQWpod0pCZ0FGeVFmOEJjU1NIQWdVamh3SkIvd0J4SkljQ0N5T0hBa0cvQVhFa2h3SWpod0pCSUhKQi93RnhKSWNDUVFFRlFRQUxDeUVEREFvTElBQkI1d0JNQkg4Z0FTSUNRUkJ4UlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWtFQkJTQUFRZThBVEFSL0lBRWlBa0VnY1VWQkFFc0VRQ09IQWtHQUFYSkIvd0Z4SkljQ0JTT0hBa0gvQUhFa2h3SUxJNGNDUWI4QmNTU0hBaU9IQWtFZ2NrSC9BWEVraHdKQkFRVkJBQXNMSVFNTUNRc2dBRUgzQUV3RWZ5QUJJZ0pCd0FCeFJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FTQnlRZjhCY1NTSEFrRUJCU0FBUWY4QVRBUi9JQUVpQWtHQUFYRkZRUUJMQkVBamh3SkJnQUZ5UWY4QmNTU0hBZ1VqaHdKQi93QnhKSWNDQ3lPSEFrRy9BWEVraHdJamh3SkJJSEpCL3dGeEpJY0NRUUVGUVFBTEN5RUREQWdMSUFCQmh3Rk1CSDlCQVNFRElBRkJmbkVGSUFCQmp3Rk1CSDlCQVNFRElBRkJmWEVGUVFBTEN5RUNEQWNMSUFCQmx3Rk1CSDlCQVNFRElBRkJlM0VGSUFCQm53Rk1CSDlCQVNFRElBRkJkM0VGUVFBTEN5RUNEQVlMSUFCQnB3Rk1CSDlCQVNFRElBRkJiM0VGSUFCQnJ3Rk1CSDlCQVNFRElBRkJYM0VGUVFBTEN5RUNEQVVMSUFCQnR3Rk1CSDlCQVNFRElBRkJ2Mzl4QlNBQVFiOEJUQVIvUVFFaEF5QUJRZjkrY1FWQkFBc0xJUUlNQkFzZ0FFSEhBVXdFZjBFQklRTWdBVUVCY2dVZ0FFSFBBVXdFZjBFQklRTWdBVUVDY2dWQkFBc0xJUUlNQXdzZ0FFSFhBVXdFZjBFQklRTWdBVUVFY2dVZ0FFSGZBVXdFZjBFQklRTWdBVUVJY2dWQkFBc0xJUUlNQWdzZ0FFSG5BVXdFZjBFQklRTWdBVUVRY2dVZ0FFSHZBVXdFZjBFQklRTWdBVUVnY2dWQkFBc0xJUUlNQVFzZ0FFSDNBVXdFZjBFQklRTWdBVUhBQUhJRklBQkIvd0ZNQkg5QkFTRURJQUZCZ0FGeUJVRUFDd3NoQWdzQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0JRNElBQUVDQXdRRkJnY0lDeUFDSklFQ0RBY0xJQUlrZ2dJTUJnc2dBaVNEQWd3RkN5QUNKSVFDREFRTElBSWtoUUlNQXdzZ0FpU0dBZ3dDQzBFQklBUkJCMHNnQkVFRVNSc0VRQ09HQWtIL0FYRWpoUUpCL3dGeFFRaDBjaUVBUVFRUVNTQUFJQUlRUXdzTUFRc2dBaVNBQWd0QkJFRi9JQU1iQzVZRkFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJ3QUZyRGhBQUFRSVJBd1FGQmdjSUNRb0xEQTBPRHdzamh3SkJCM1pCQVhFTkVRd1RDeU9JQWlFQVFRZ1FTU0FBRUY1Qi8vOERjU0VBSTRnQ1FRSnFRZi8vQTNFa2lBSWdBRUdBL2dOeFFRaDJKSUVDSUFCQi93RnhKSUlDUVFRUEN5T0hBa0VIZGtFQmNVVU5EZ3dOQ3lPSEFrRUhka0VCY1EwTUk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFrRUNha0gvL3dOeElRRkJDQkJKSUFBZ0FSQkxEQTBMSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9DQWtIL0FYRWpnUUpCL3dGeFFRaDBjaUVCUVFnUVNTQUFJQUVRU3d3TkMwRUVFRWtqaVFJUUN5MEFBQkJWREEwTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFpRUJRUWdRU1NBQUlBRVFTMEVBSklrQ0RBc0xJNGNDUVFkMlFRRnhSUTBLREF3TEk0Z0NJUUJCQ0JCSklBQVFYa0gvL3dOeEpJa0NJQUJCQW1wQi8vOERjU1NJQWd3SkN5T0hBa0VIZGtFQmNRMEhEQVlMUVFRUVNTT0pBaEFMTFFBQUVGOGhBQ09KQWtFQmFrSC8vd054SklrQ0lBQVBDeU9IQWtFSGRrRUJjVVVOQkNPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFKQkFtcEIvLzhEY1NFQlFRZ1FTU0FBSUFFUVN3d0ZDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWppUUpCQW1wQi8vOERjU0VCUVFnUVNTQUFJQUVRU3d3RUMwRUVFRWtqaVFJUUN5MEFBQkJXREFVTEk0Z0NRUUpyUWYvL0EzRWlBQ1NJQWlPSkFpRUJRUWdRU1NBQUlBRVFTMEVJSklrQ0RBTUxRWDhQQ3lPSkFrRUNha0gvL3dOeEpJa0NRUXdQQ3hCS1FmLy9BM0VraVFJTFFRZ1BDeU9KQWtFQmFrSC8vd054SklrQ1FRUVBDeU9JQWlFQVFRZ1FTU0FBRUY1Qi8vOERjU1NKQWlBQVFRSnFRZi8vQTNFa2lBSkJEQXZLQkFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGckRoQUFBUUlOQXdRRkJnY0lDUTBLRFFzTURRc2pod0pCQkhaQkFYRU5Ed3dSQ3lPSUFpRUFRUWdRU1NBQUVGNUIvLzhEY1NFQklBQkJBbXBCLy84RGNTU0lBaUFCUVlEK0EzRkJDSFlrZ3dJZ0FVSC9BWEVraEFKQkJBOExJNGNDUVFSMlFRRnhSUTBNREFzTEk0Y0NRUVIyUVFGeERRb2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NRUUpxUWYvL0EzRWhBVUVJRUVrZ0FDQUJFRXNNQ3dzamlBSkJBbXRCLy84RGNTSUFKSWdDSTRRQ1FmOEJjU09EQWtIL0FYRkJDSFJ5SVFGQkNCQkpJQUFnQVJCTERBc0xRUVFRU1NPSkFoQUxMUUFBRUZnTUN3c2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCSklBQWdBUkJMUVJBa2lRSU1DUXNqaHdKQkJIWkJBWEZGRFFnTUNnc2ppQUloQUVFSUVFa2dBQkJlUWYvL0EzRWtpUUpCQVNTMUFTQUFRUUpxUWYvL0EzRWtpQUlNQndzamh3SkJCSFpCQVhFTkJRd0VDeU9IQWtFRWRrRUJjVVVOQXlPSUFrRUNhMEgvL3dOeElnQWtpQUlqaVFKQkFtcEIvLzhEY1NFQlFRZ1FTU0FBSUFFUVN3d0VDMEVFRUVramlRSVFDeTBBQUJCWkRBVUxJNGdDUVFKclFmLy9BM0VpQUNTSUFpT0pBaUVCUVFnUVNTQUFJQUVRUzBFWUpJa0NEQU1MUVg4UEN5T0pBa0VDYWtILy93TnhKSWtDUVF3UEN4QktRZi8vQTNFa2lRSUxRUWdQQ3lPSkFrRUJha0gvL3dOeEpJa0NRUVFQQ3lPSUFpRUFRUWdRU1NBQUVGNUIvLzhEY1NTSkFpQUFRUUpxUWYvL0EzRWtpQUpCREF1VUJRRUJmd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFGckRoQUFBUUlMQ3dNRUJRWUhDQXNMQ3drS0N3dEJCQkJKSTRrQ0VBc3RBQUFoQUNPQUFpRUJRUVFRU1NBQVFmOEJjVUdBL2dOcUlBRVFRd3dMQ3lPSUFpRUFRUWdRU1NBQUVGNUIvLzhEY1NFQklBQkJBbXBCLy84RGNTU0lBaUFCUVlEK0EzRkJDSFlraFFJZ0FVSC9BWEVraGdKQkJBOExJNElDUVlEK0Eyb2hBQ09BQWlFQlFRUVFTU0FBSUFFUVEwRUVEd3NqaUFKQkFtdEIvLzhEY1NJQUpJZ0NJNFlDUWY4QmNTT0ZBa0gvQVhGQkNIUnlJUUZCQ0JCSklBQWdBUkJMUVFnUEMwRUVFRWtqaVFJUUN5MEFBQ09BQW5FaUFDU0FBaUFBUlVFQVN3UkFJNGNDUVlBQmNrSC9BWEVraHdJRkk0Y0NRZjhBY1NTSEFnc2pod0pCdndGeEpJY0NJNGNDUVNCeVFmOEJjU1NIQWlPSEFrSHZBWEVraHdJTUJ3c2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCSklBQWdBUkJMUVNBa2lRSkJDQThMUVFRUVNTT0pBaEFMTEFBQUlRQWppQUlnQUVFQkVFd2dBQ09JQW1wQi8vOERjU1NJQWlPSEFrSC9BSEVraHdJamh3SkJ2d0Z4SkljQ0k0a0NRUUZxUWYvL0EzRWtpUUpCREE4TEk0WUNRZjhCY1NPRkFrSC9BWEZCQ0hSeUpJa0NRUVFQQ3hCS1FmLy9BM0VoQUNPQUFpRUJRUVFRU1NBQUlBRVFReU9KQWtFQ2FrSC8vd054SklrQ1FRUVBDMEVFRUVramlRSVFDeTBBQUNPQUFuTkIvd0Z4SWdBa2dBSWdBRVZCQUVzRVFDT0hBa0dBQVhKQi93RnhKSWNDQlNPSEFrSC9BSEVraHdJTEk0Y0NRYjhCY1NTSEFpT0hBa0hmQVhFa2h3SWpod0pCN3dGeEpJY0NEQUlMSTRnQ1FRSnJRZi8vQTNFaUFDU0lBaU9KQWlFQlFRZ1FTU0FBSUFFUVMwRW9KSWtDUVFnUEMwRi9Ed3NqaVFKQkFXcEIvLzhEY1NTSkFrRUVDL29FQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FXc09FQUFCQWdNTkJBVUdCd2dKQ2cwTkN3d05DMEVFRUVramlRSVFDeTBBQUNFQVFRUVFTU0FBUWY4QmNVR0EvZ05xRURaQi93RnhKSUFDREEwTEk0Z0NJUUJCQ0JCSklBQVFYa0gvL3dOeElRRWdBRUVDYWtILy93TnhKSWdDSUFGQmdQNERjVUVJZGlTQUFpQUJRZjhCY1NTSEFnd05DeU9DQWtHQS9nTnFJUUJCQkJCSklBQVFOa0gvQVhFa2dBSU1EQXRCQUNTMEFRd0xDeU9JQWtFQ2EwSC8vd054SWdBa2lBSWpod0pCL3dGeEk0QUNRZjhCY1VFSWRISWhBVUVJRUVrZ0FDQUJFRXRCQ0E4TFFRUVFTU09KQWhBTExRQUFJNEFDY2tIL0FYRWlBQ1NBQWlBQVJVRUFTd1JBSTRjQ1FZQUJja0gvQVhFa2h3SUZJNGNDUWY4QWNTU0hBZ3NqaHdKQnZ3RnhKSWNDSTRjQ1FkOEJjU1NIQWlPSEFrSHZBWEVraHdJTUNBc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCSklBQWdBUkJMUVRBa2lRSkJDQThMUVFRUVNTT0pBaEFMTFFBQUlRQWpod0pCL3dCeEpJY0NJNGNDUWI4QmNTU0hBaU9JQWlJQklBQkJHSFJCR0hVaUFFRUJFRXdnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZGlTRkFpQUFRZjhCY1NTR0FpT0pBa0VCYWtILy93TnhKSWtDUVFnUEN5T0dBa0gvQVhFamhRSkIvd0Z4UVFoMGNpU0lBa0VJRHdzUVNrSC8vd054SVFCQkJCQkpJQUFRTmtIL0FYRWtnQUlqaVFKQkFtcEIvLzhEY1NTSkFnd0ZDMEVCSkxVQkRBUUxRUVFRU1NPSkFoQUxMUUFBRUZ3TUFnc2ppQUpCQW10Qi8vOERjU0lBSklnQ0k0a0NJUUZCQ0JCSklBQWdBUkJMUVRna2lRSkJDQThMUVg4UEN5T0pBa0VCYWtILy93TnhKSWtDQzBFRUM3d0JBUUYvSTRrQ1FRRnFRZi8vQTNFaUFVRUJhMEgvL3dOeElBRWpqUUliSklrQ0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFlPRHdBQkFnTUVCUVlIQ0FrS0N3d05EZzhMSUFBUVRROExJQUFRVGc4TElBQVFUdzhMSUFBUVVBOExJQUFRVVE4TElBQVFVZzhMSUFBUVV3OExJQUFRVkE4TElBQVFWdzhMSUFBUVdnOExJQUFRV3c4TElBQVFYUThMSUFBUVlBOExJQUFRWVE4TElBQVFZZzhMSUFBUVl3dTJBUUVDZjBFQUpMUUJRWS8rQXhBTExRQUFRWDRnQUhkeElnRWt2QUZCai80REVBc2dBVG9BQUNPSUFrRUNhMEgvL3dOeEpJZ0NJNGtDSVFFamlBSWlBaEFMSUFFNkFBQWdBa0VCYWhBTElBRkJnUDREY1VFSWRqb0FBQUpBQWtBQ1FBSkFBa0FDUUNBQURnVUFBUUlEQkFVTFFRQWt2UUZCd0FBa2lRSU1CQXRCQUNTK0FVSElBQ1NKQWd3REMwRUFKTDhCUWRBQUpJa0NEQUlMUVFBa3dBRkIyQUFraVFJTUFRdEJBQ1RCQVVIZ0FDU0pBZ3NMNXdFQkFYOGp0UUVFUUVFQkpMUUJRUUFrdFFFTEk3WUJJN3dCY1VFZmNVRUFTd1JBSTR3Q1JVRUFJN1FCR3dSL0k3MEJRUUFqdHdFYkJIOUJBQkJsUVFFRkk3NEJRUUFqdUFFYkJIOUJBUkJsUVFFRkk3OEJRUUFqdVFFYkJIOUJBaEJsUVFFRkk4QUJRUUFqdWdFYkJIOUJBeEJsUVFFRkk4RUJRUUFqdXdFYkJIOUJCQkJsUVFFRlFRQUxDd3NMQ3dWQkFBc0VmMEVCSTR3Q0k0c0NHd1IvUVFBa2pBSkJBQ1NMQWtFQUpJMENRUUFramdKQkdBVkJGQXNGUVFBTElRQkJBU09NQWlPTEFoc0VRRUVBSkl3Q1FRQWtpd0pCQUNTTkFrRUFKSTRDQ3lBQUR3dEJBQXV0QVFFQ2YwRUJKSlVDSTQwQ0JFQWppUUlRQ3kwQUFCQmtFRWxCQUNTTUFrRUFKSXNDUVFBa2pRSkJBQ1NPQWdzUVppSUJRUUJLQkVBZ0FSQkpDMEVBSTQ0Q1JVRUJJNHdDSTRzQ0d4c0VmeU9KQWhBTExRQUFFR1FGUVFRTElRRWpod0pCOEFGeEpJY0NJQUZCQUV3RVFDQUJEd3NnQVJCSkk1UUNRUUZxSWdBamtnSk9CSDhqa3dKQkFXb2trd0lnQUNPU0Ftc0ZJQUFMSkpRQ0k0a0NJOW9CUmdSQVFRRWszUUVMSUFFTEJRQWpzd0VMcVFFQkEzOGdBRUYvUVlBSUlBQkJBRWdiSUFCQkFFb2JJUUFEUUNQZEFVVkJBQ0FCUlVFQVFRQWdBa1VnQXhzYkd3UkFFR2RCQUVnRVFFRUJJUU1GSTRvQ1FkQ2tCQ1AvQVhST0JFQkJBU0VDQlVFQklBRWpzd0VnQUU1QkFDQUFRWDlLR3hzaEFRc0xEQUVMQ3lBQ0JFQWppZ0pCMEtRRUkvOEJkR3NraWdKQkFBOExJQUVFUUVFQkR3c2ozUUVFUUVFQUpOMEJRUUlQQ3lPSkFrRUJhMEgvL3dOeEpJa0NRWDhMQmdCQmZ4QnBDek1CQW44RFFDQUJRUUJPUVFBZ0FpQUFTQnNFUUVGL0VHa2hBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0ZBQ09QQWdzRkFDT1FBZ3NGQUNPUkFndnhBUUVCZjBFQUpJNENBbjhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUE0SUFBRUNBd1FGQmdjSUN5UFBBUXdJQ3lQU0FRd0hDeVBRQVF3R0N5UFJBUXdGQ3lQVEFRd0VDeVBVQVF3REN5UFZBUXdDQ3lQV0FRd0JDMEVBQzBVaEFRSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFEZ2dBQVFJREJBVUdCd2dMUVFFa3p3RU1Cd3RCQVNUU0FRd0dDMEVCSk5BQkRBVUxRUUVrMFFFTUJBdEJBU1RUQVF3REMwRUJKTlFCREFJTFFRRWsxUUVNQVF0QkFTVFdBUXNnQVFSQVFRRWdBRUVEVENJQlFRQWoyQUViQkg5QkFRVkJBQXNnQVVWQkFDUFpBUnNiQkVCQkFTVEJBVUVFRUNnTEN3dVNBUUFnQUVFQVNnUkFRUUFRYndWQkFDVFBBUXNnQVVFQVNnUkFRUUVRYndWQkFDVFNBUXNnQWtFQVNnUkFRUUlRYndWQkFDVFFBUXNnQTBFQVNnUkFRUU1RYndWQkFDVFJBUXNnQkVFQVNnUkFRUVFRYndWQkFDVFRBUXNnQlVFQVNnUkFRUVVRYndWQkFDVFVBUXNnQmtFQVNnUkFRUVlRYndWQkFDVFZBUXNnQjBFQVNnUkFRUWNRYndWQkFDVFdBUXNMQndBZ0FDVGFBUXNIQUVGL0pOb0JDd2NBSUFBazJ3RUxCd0JCZnlUYkFRc0hBQ0FBSk53QkN3Y0FRWDhrM0FFTEJRQWpnQUlMQlFBamdRSUxCUUFqZ2dJTEJRQWpnd0lMQlFBamhBSUxCUUFqaFFJTEJRQWpoZ0lMQlFBamh3SUxCUUFqaVFJTEJRQWppQUlMQ2dBamlRSVFDeTBBQUFzRkFDUHFBUXNGQUNQckFRc0ZBQ1BzQVFzRkFDUHRBUXNGQUNQdUFRdlVBd0VKZjBHQWdBSkJnSkFDSStNQkd5RUVRWUM0QWtHQXNBSWo1QUViSVFrRFFDQUdRWUFDU0FSQVFRQWhCUU5BSUFWQmdBSklCRUFnQ1NBR1FRTjFRUVYwYWlBRlFRTjFhaUlIUVlDUWZtb3RBQUFoQVNBR1FRaHZJUUpCQnlBRlFRaHZheUVJSUFRZ0JFR0FrQUpHQkg4Z0FVR0FBV3NnQVVHQUFXb2dBVUdBQVhFYkJTQUJDMEVFZEdvaEF5QUFRUUJLUVFBai9nRWJCSDhnQjBHQTBINXFMUUFBQlVFQUN5SUJRY0FBY1FSQVFRY2dBbXNoQWdzZ0FVRUljVVZGUVExMElnY2dBeUFDUVFGMGFpSURRWUNRZm1wcUxRQUFJUUlnQnlBRFFZR1FmbXBxTFFBQVFRRWdDSFJ4Qkg5QkFnVkJBQXNpQTBFQmFpQURJQUpCQVNBSWRIRWJJUU1nQlNBR1FRaDBha0VEYkNFQ0lBQkJBRXBCQUNQK0FSc0VRQ0FDUVlDaEMyb2lBaUFCUVFkeFFRTjBJQU5CQVhScUlnRkJBV3BCUDNGQmdKQUVhaTBBQUVFSWRDQUJRVDl4UVlDUUJHb3RBQUJ5SWdGQkgzRkJBM1E2QUFBZ0FpQUJRZUFIY1VFRmRrRURkRG9BQVNBQ0lBRkJnUGdCY1VFS2RrRURkRG9BQWdVZ0FrR0FvUXRxSWdFZ0EwSEgvZ01RSVNJRFFZQ0EvQWR4UVJCMk9nQUFJQUVnQTBHQS9nTnhRUWgyT2dBQklBRWdBem9BQWdzZ0JVRUJhaUVGREFFTEN5QUdRUUZxSVFZTUFRc0xDOWtEQVF0L0EwQWdBa0VYU0FSQVFRQWhCUU5BSUFWQkgwZ0VRQ0FGUVE5S0lRa2dBaUlCUVE5S0JIOGdBVUVQYXdVZ0FRdEJCSFFpQVNBRlFROXJhaUFCSUFWcUlBVkJEMG9iSVFkQngvNERJUXBCZnlFRFFRQWhBQU5BSUFCQkNFZ0VRRUVBSVFRRFFDQUVRUVZJQkVBZ0J5QUFJQVJCQTNScVFRSjBJZ0ZCZ3Z3RGFoQUxMUUFBUmdSQUlBa2dBVUdEL0FOcUVBc3RBQUFpQVVFSWNVRUFJLzRCRzBWRlJnUkFBbjlCQlNFRVFjbitBMEhJL2dNZ0FTSURRUkJ4R3lFS1FRZ0xJUUFMQ3lBRVFRRnFJUVFNQVFzTElBQkJBV29oQUF3QkN3c2dBMEVBU0VFQUkvNEJHd1IvUVlDNEFrR0FzQUlqNUFFYklRaEJmeUVBUVFBaEJBTkFJQVJCSUVnRVFFRUFJUVlEUUNBR1FTQklCRUFnQnlBRUlBZ2dCa0VGZEdwcUlnRkJnSkIrYWkwQUFFWUVRQUovUVNBaEJFRWdJUVlnQVFzaEFBc2dCa0VCYWlFR0RBRUxDeUFFUVFGcUlRUU1BUXNMSUFCQkFFNEVmeUFBUVlEUWZtb3RBQUFGUVg4TEJVRi9DeUVCUVlDUUFrR0FnQUlnQWtFUFNoc2hDRUVBSVFBRFFDQUFRUWhJQkVBZ0J5QUlJQWxCQUVFSElBQWdCVUVEZENBQUlBSkJBM1JxUWZnQlFZQ2hGeUFLSUFFZ0F4QWlHaUFBUVFGcUlRQU1BUXNMSUFWQkFXb2hCUXdCQ3dzZ0FrRUJhaUVDREFFTEN3dVlBZ0VKZndOQUlBUkJDRWdFUUVFQUlRSURRQ0FDUVFWSUJFQWdCQ0FDUVFOMGFrRUNkQ0lCUVlEOEEyb1FDeTBBQUJvZ0FVR0IvQU5xRUFzdEFBQWFJQUZCZ3Z3RGFoQUxMUUFBSVFCQkFTRUZJK1VCQkVBQ2YwRUNJUVVnQUVFQ2IwRUJSZ1IvSUFCQkFXc0ZJQUFMQ3lFQUN5QUJRWVA4QTJvUUN5MEFBQ0lHUVFoeFFRQWovZ0ViUlVVaEIwSEovZ05CeVA0RElBWkJFSEViSVFoQkFDRUJBMEFnQVNBRlNBUkFRUUFoQXdOQUlBTkJDRWdFUUNBQUlBRnFRWUNBQWlBSFFRQkJCeUFESUFSQkEzUWdBeUFDUVFSMGFpQUJRUU4wYWtIQUFFR0FvU0FnQ0VGL0lBWVFJaG9nQTBFQmFpRUREQUVMQ3lBQlFRRnFJUUVNQVFzTElBSkJBV29oQWd3QkN3c2dCRUVCYWlFRURBRUxDd3NGQUNQREFRc0ZBQ1BFQVFzRkFDUElBUXNTQVFGL0k4b0JJZ0JCQkhJZ0FDUEpBUnNMTGdFQmZ3TkFJQUJCLy84RFNBUkFJQUJCZ0xYSkJHb2dBQkEyT2dBQUlBQkJBV29oQUF3QkN3dEJBQ1RkQVF0bEFFSHk1Y3NISkR0Qm9NR0NCU1E4UWRpdzRRSWtQVUdJa0NBa1BrSHk1Y3NISkQ5Qm9NR0NCU1JBUWRpdzRRSWtRVUdJa0NBa1FrSHk1Y3NISkVOQm9NR0NCU1JFUWRpdzRRSWtSVUdJa0NBa1JqOEFRWlFCU0FSQVFaUUJQd0JyUUFBYUN3c0RBQUVMdkFFQkFuOGdBQ2dDQkNJQ1FmLy8vLzhBY1NFQklBQW9BZ0JCQVhFRVFFRUFRWUFKUWZvQVFRNFFBQUFMSUFGQkFVWUVRQUpBQWtBQ1FDQUFLQUlJRGdNQ0FnQUJDeUFBS0FJUUlnRUVRQ0FCUWJ3SlR3UkFJQUZCRUdzUWtRRUxDd3dCQ3dBTElBSkJnSUNBZ0hoeEJFQkJBRUdBQ1VIK0FFRVNFQUFBQ3lBQUlBQW9BZ0JCQVhJMkFnQWpBQ0FBRUFJRklBRkJBRTBFUUVFQVFZQUpRWWdCUVJBUUFBQUxJQUFnQVVFQmF5QUNRWUNBZ0lCL2NYSTJBZ1FMQ3h3QUFrQUNRQUpBSTVjQ0RnSUJBZ0FMQUF0QkFDRUFDeUFBRUdrTEhRQUNRQUpBQWtBamx3SU9Bd0VCQWdBTEFBdEJmeUVCQ3lBQkVHa0xCd0FnQUNTWEFnc0x2d0VFQUVHQUNBc3RIZ0FBQUFFQUFBQUJBQUFBSGdBQUFINEFiQUJwQUdJQUx3QnlBSFFBTHdCMEFHd0Fjd0JtQUM0QWRBQnpBRUd3Q0FzM0tBQUFBQUVBQUFBQkFBQUFLQUFBQUdFQWJBQnNBRzhBWXdCaEFIUUFhUUJ2QUc0QUlBQjBBRzhBYndBZ0FHd0FZUUJ5QUdjQVpRQkI4QWdMTFI0QUFBQUJBQUFBQVFBQUFCNEFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDOEFjQUIxQUhJQVpRQXVBSFFBY3dCQm9Ba0xGUU1BQUFBZ0FBQUFBQUFBQUNBQUFBQUFBQUFBSUFBekVITnZkWEpqWlUxaGNIQnBibWRWVWt3aFkyOXlaUzlrYVhOMEwyTnZjbVV1ZFc1MGIzVmphR1ZrTG5kaGMyMHViV0Z3IikpLmluc3RhbmNlOwpjb25zdCBiPW5ldyBVaW50OEFycmF5KGEuZXhwb3J0cy5tZW1vcnkuYnVmZmVyKTtyZXR1cm57aW5zdGFuY2U6YSxieXRlTWVtb3J5OmIsdHlwZToiV2ViIEFzc2VtYmx5In19LHIsdSxFLGM7Yz17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCwKV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sc3BlZWQ6MCxmcmFtZVNraXBDb3VudGVyOjAsY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kczowLG1lc3NhZ2VIYW5kbGVyOmE9PntsZXQgYj1uKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8KKGMuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEouYmluZCh2b2lkIDAsYyksYy5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKE0uYmluZCh2b2lkIDAsYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEwuYmluZCh2b2lkIDAsYyksYy5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihjLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShLLmJpbmQodm9pZCAwLGMpLGMuYXVkaW9Xb3JrZXJQb3J0KSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBQKHApOwpjLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2Mud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2soaCh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgZi5DT05GSUc6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkoYyxiLm1lc3NhZ2UuY29uZmlnKTtjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SRVNFVF9BVURJT19RVUVVRTpjLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBMQVk6aWYoIWMucGF1c2VkfHwhYy53YXNtSW5zdGFuY2V8fCFjLndhc21CeXRlTWVtb3J5KXtrKGgoe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfWMucGF1c2VkPSExO2MuZnBzVGltZVN0YW1wcz1bXTt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0KMDtjLm9wdGlvbnMuaXNHYmNDb2xvcml6YXRpb25FbmFibGVkP2Mub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlJiZjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoIndhc21ib3lnYiBicm93biByZWQgZGFya2Jyb3duIGdyZWVuIGRhcmtncmVlbiBpbnZlcnRlZCBwYXN0ZWxtaXggb3JhbmdlIHllbGxvdyBibHVlIGRhcmtibHVlIGdyYXlzY2FsZSIuc3BsaXQoIiAiKS5pbmRleE9mKGMub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlLnRvTG93ZXJDYXNlKCkpKTpjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoMCk7RihjLDFFMy9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5QQVVTRTpjLnBhdXNlZD0hMDtjLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KGMudXBkYXRlSWQpLGMudXBkYXRlSWQ9dm9pZCAwKTtrKGgodm9pZCAwLApiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SVU5fV0FTTV9FWFBPUlQ6YT1iLm1lc3NhZ2UucGFyYW1ldGVycz9jLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdLmFwcGx5KHZvaWQgMCxiLm1lc3NhZ2UucGFyYW1ldGVycyk6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XSgpO2soaCh7dHlwZTpmLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBkPWMud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoZD1iLm1lc3NhZ2UuZW5kKTthPWMud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxkKS5idWZmZXI7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgZi5HRVRfV0FTTV9DT05TVEFOVDprKGgoe3R5cGU6Zi5HRVRfV0FTTV9DT05TVEFOVCwKcmVzcG9uc2U6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuRk9SQ0VfT1VUUFVUX0ZSQU1FOkMoYyk7YnJlYWs7Y2FzZSBmLlNFVF9TUEVFRDpjLnNwZWVkPWIubWVzc2FnZS5zcGVlZDtjLmZwc1RpbWVTdGFtcHM9W107Yy50aW1lU3RhbXBzVW50aWxSZWFkeT02MDt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0wO2Mud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2JyZWFrO2Nhc2UgZi5JU19HQkM6YT0wPGMud2FzbUluc3RhbmNlLmV4cG9ydHMuaXNHQkMoKTtrKGgoe3R5cGU6Zi5JU19HQkMscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKCJVbmtub3duIFdhc21Cb3kgV29ya2VyIG1lc3NhZ2U6IixiKX19LGdldEZQUzooKT0+MDxjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PwpjLnNwZWVkJiYwPGMuc3BlZWQ/Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUqYy5zcGVlZDpjLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpjLmZwc1RpbWVTdGFtcHM/Yy5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGMubWVzc2FnZUhhbmRsZXIpfSkoKQo=";

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
var version = "0.7.1";
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
	"lib:deploy:np": "np --no-cleanup",
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
	"rollup-plugin-serve": "^1.0.2",
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
